import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';
import {parseCSV} from '../public/metrics.js';
import {scoreRawSamples,attitudeMetrics,courseGeometry,motorMetrics,leadMetrics,positionStepMetrics,imuTraceMetrics,conditionCoverage,noiseSeedAudit} from '../public/qualification-analysis.js';
const input='qa/qualification-work/measurements',output='public/data/matched-qualification';
const protocol=JSON.parse(fs.readFileSync('qa/qualification-work/protocol.json'));
fs.mkdirSync(output,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
function discover(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>{const f=path.join(p,e.name);return e.isDirectory()?discover(f):e.name==='report.json'?[path.dirname(f)]:[];});}
const runs=[],evidence={};
function capture(id,b,name,note,compressed=false){const bytes=compressed?zlib.gzipSync(b):b;const dest=path.join(output,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);evidence[id]={id,path:dest.replace(/^public\//,''),origin:'VM artifacts/matched-qualification-20261120/'+name.replace(/\.gz$/,''),sha256:hash(bytes),originalSha256:hash(b),bytes:bytes.length,classification:'Fresh matched ARM qualification evidence',note};}
for(const p of discover(input)){
 const report=JSON.parse(fs.readFileSync(p+'/report.json')),config=JSON.parse(fs.readFileSync(p+'/config.json'));
 const id=report.stack+'-'+path.basename(p).replace(new RegExp('^'+report.stack+'-'),'');if(runs.some(r=>r.id===id))throw Error('Duplicate attempt '+id);
 const rows=parseCSV(fs.readFileSync(p+'/trajectory.csv','utf8'));
 const run={id,phase:p.includes('-noise/')?'noise-matrix':'baseline',stack:report.stack,shape:report.shape,report,config,noise:report.sensor_profile.level,seed:report.sensor_profile.seed,mode:report.sensor_profile.feedforward,probe:config.tuning?.probe_event??null,telemetry:[],score:null,step:null,geometry:null,evidence:[]};
 const add=(file,compressed=false)=>{const b=fs.readFileSync(p+'/'+file),eid=id+'-'+file;capture(eid,b,id+'/'+file+(compressed?'.gz':''),'Unchanged measured file; original SHA-256 retained'+(compressed?' inside lossless gzip.':'.'),compressed);run.evidence.push(eid);return b;};
 for(const f of ['report.json','config.json','trajectory.csv'])add(f);
 const nativeLog=p+'.log';
 if(fs.existsSync(nativeLog)){const eid=id+'-native.log';capture(eid,fs.readFileSync(nativeLog),id+'/native.log.gz','Original FastDyn/QEMU and native flight-runner output; retained without editing.',true);run.evidence.push(eid);}
 const originalPath=path.dirname(p)===input?path.join(input,run.probe===1?'probe-1.json':'config.json'):p+'.json';
 if(fs.existsSync(originalPath)){
  const b=fs.readFileSync(originalPath);if(hash(b)!==report.hashes.config)throw Error('Original config hash mismatch '+id);
  if(JSON.stringify(canonical(JSON.parse(b)))!==JSON.stringify(canonical(config)))throw Error('Normalized config mismatch '+id);
  capture(id+'-input-config',b,id+'/input-config.json','Exact input bytes identified by report.hashes.config; config.json is the runner-normalized copy.');run.originalConfigVerified=true;
 }
 const raw=add('scoring-inputs.bin',true),noise=add('noise-inputs.bin',true),sensor=add('sensor-inputs.bin',true);
 if(hash(noise)!==report.sensor_profile.noise_input_sha256||hash(sensor)!==report.sensor_profile.sensor_input_sha256||hash(raw)!==report.sensor_profile.scoring_input_sha256)throw Error('Raw trace hash mismatch '+id);
 run.noiseTrace=imuTraceMetrics(noise,report.simulated_seconds,{noNoise:run.noise==='none'});
 run.sensorTrace=imuTraceMetrics(sensor,report.simulated_seconds,{quantized:true});
 try{run.score=scoreRawSamples(raw,report.lap_start_s,report.lap_end_s);run.score.rms_residual_m=run.score.rms_m-report.tracking_rms_m;run.score.max_residual_m=run.score.max_m-report.tracking_max_m;run.score.verified=Math.abs(run.score.rms_residual_m)<1e-10&&Math.abs(run.score.max_residual_m)<1e-10;}catch(e){run.scoringError=e.message;}
 if(report.shape==='attitude-step'){
  const calibration=add('calibration.csv',true);try{run.step=attitudeMetrics(parseCSV(calibration.toString()),run.probe);}catch(e){run.stepError=e.message;}
 }
 const actuator=add('actuator-trace.bin',true);try{run.motors=motorMetrics(actuator,run.stack,report.lap_start_s,report.lap_end_s);}catch(e){run.motorError=e.message;}
 const lead=add('tilt-lead.csv',true);try{run.lead=leadMetrics(parseCSV(lead.toString()),run.mode,report.sensor_profile.attitude_gain_per_s,report.lap_start_s,report.lap_end_s);}catch(e){run.leadError=e.message;}
 if(report.shape==='figure-eight')run.geometry=courseGeometry(rows,report.lap_start_s,report.lap_end_s);
 if(report.shape==='step')run.positionStep=positionStepMetrics(rows,report.lap_start_s,report.lap_end_s);
 // Charts use a compact 20 Hz view; all original CSV and 8 kHz scoring bytes remain downloadable.
 if(run.phase==='baseline'&&report.shape!=='attitude-step')run.telemetry=rows.filter((_,i)=>i%5===0||i===rows.length-1).map(r=>({...Object.fromEntries(['time_s','x_m','y_m','z_m','ref_x','ref_y','ref_z','roll_rad','pitch_rad','yaw_rad'].map(k=>[k,r[k]])),error:Math.hypot(r.x_m-r.ref_x,r.y_m-r.ref_y,r.z_m-r.ref_z)}));
 run.landed=report.final_armed===false&&report.final_motors.every(m=>m===0)&&Math.abs(report.final_position[2]-.1)<.03;
 run.acceptance={armedMode:report.armed_observed===true&&report.mode_observed===true,
  tracking:report.shape==='attitude-step'?null:run.score?.verified===true&&run.score.rms_m<protocol.gates.rms_m&&run.score.max_m<protocol.gates.max_error_m,
  tiltClamp:report.tilt_clamp_updates===protocol.gates.tilt_clamp_updates,
  landing:run.landed&&report.grounded_stopped_samples>=4000,
  course:run.geometry?run.geometry.passed:null};
 run.passed=report.passed===true&&Object.values(run.acceptance).every(v=>v===true||v===null);
 runs.push(run);
}
runs.sort((a,b)=>a.id.localeCompare(b.id));
const pairs=[];
for(const c of runs.filter(r=>r.stack==='cognipilot')){
 const b=runs.find(r=>r.stack==='betaflight'&&r.phase===c.phase&&r.shape===c.shape&&r.probe===c.probe&&r.mode===c.mode&&r.noise===c.noise&&r.seed===c.seed);
 if(!b)continue;
 const noiseMatch=c.report.sensor_profile.noise_input_sha256===b.report.sensor_profile.noise_input_sha256;
 const shared=['plant','plant_description','offboard','runner'].every(k=>c.report.hashes[k]===b.report.hashes[k]);
 const counters=[c,b].every(r=>r.report.sensor_profile.measured_counts_25_to_26_s?.length>=4&&r.report.sensor_profile.measured_counts_25_to_26_s.slice(0,4).every(v=>v===1600));
 pairs.push({phase:c.phase,shape:c.shape,mode:c.mode,noise:c.noise,seed:c.seed,probe:c.probe,cognipilot:c.id,betaflight:b.id,identical_noise:noiseMatch,shared_artifacts:shared,matched_counters:counters,identical_config_file:c.report.hashes.config===b.report.hashes.config,identical_config_values:JSON.stringify(canonical(c.config))===JSON.stringify(canonical(b.config)),verified_raw_scores:c.score?.verified===true&&b.score?.verified===true});
}
const coverage=conditionCoverage(runs,protocol);
const seedAudit=noiseSeedAudit(runs,protocol);
// Keep coordinator/checkpoint provenance as well as individual flight records.
function walkFiles(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>{const f=path.join(p,e.name);return e.isDirectory()?walkFiles(f):[f];});}
const campaignRecords=walkFiles(input).filter(p=>['campaign.json','planned-cases.json','resource-checkpoint.json'].includes(path.basename(p))||/^(?:resume-)?worker-\d+\.(?:log|sh|exit)$/.test(path.basename(p)));
for(const p of campaignRecords){const relative=path.relative(input,p);capture('campaign-record-'+relative.replaceAll('/','-'),fs.readFileSync(p),'campaign/'+relative,'Original coordinator record or saved checkpoint. A checkpoint can predate a completed child flight; individual immutable reports determine counted outcomes.');}
capture('matched-protocol',fs.readFileSync('qa/qualification-work/protocol.json'),'protocol.json','Criteria frozen before these flights. Descriptive comparison only.');
const exactLoop=JSON.parse(fs.readFileSync('qa/qualification-work/exact-loop-check/checks.json'));
capture('exact-flight-loop-check',fs.readFileSync('qa/qualification-work/exact-loop-check/checks.json'),'exact-loop-check.json','Numerical oracle, derivative and integrated-orientation checks of the exact compiled flight library.');
const archive=output+'/qualification-source.tar';
if(fs.existsSync(archive)){const bytes=fs.readFileSync(archive);evidence['matched-source-archive']={id:'matched-source-archive',path:archive.replace(/^public\//,''),origin:'VM matched-qualification-20261120/source',sha256:hash(bytes),bytes:bytes.length,classification:'Frozen source, configuration and executable archive',note:'Tracked bases, binary patches, untracked files, submodule revision lists, generated code, firmware ELFs, flight runner and checker. Includes build configuration and runtime hashes. Use together with the source-rebuild supplements: Betaflight requires the preserved November 13 adapter. Toolchains and all submodule sources are not embedded.'};}
const nativeLog=input+'/native-integration-tests.log';
let nativeChecks=null;
if(fs.existsSync(nativeLog)){
 const log=fs.readFileSync(nativeLog);nativeChecks={integrationPassed:log.toString().includes('test result: ok. 2 passed; 0 failed; 0 ignored'),scope:'Separate host-native Zephyr image, not the frozen ARM campaign firmware. Valid-reference echo, invalid-ingress rejection and odometry-before-plan.'};
 capture('native-integration-checks',log,'native-integration-tests.log',nativeChecks.scope);
 const p=output+'/native-checks.tar.gz';if(fs.existsSync(p)){const b=fs.readFileSync(p);evidence['native-checks-archive']={id:'native-checks-archive',path:p.replace(/^public\//,''),origin:'VM matched-qualification-20261120/native-build',sha256:hash(b),bytes:b.length,classification:'Rebuilt native firmware integration checks',note:nativeChecks.scope};}
}
let firmwareRebuilds=null;
const rebuildCheck='qa/qualification-work/firmware-rebuild-checks.json';
if(fs.existsSync(rebuildCheck)){
 const bytes=fs.readFileSync(rebuildCheck);firmwareRebuilds=JSON.parse(bytes);
 const analyzer=fs.readFileSync('scripts/verify-firmware-rebuilds.mjs');if(hash(analyzer)!==firmwareRebuilds.analyzerSha256)throw Error('Firmware verifier source differs from report');
 capture('firmware-rebuild-verifier',analyzer,'verify-firmware-rebuilds.mjs','Independent ELF load-segment verification code; analysis only.');
 for(const check of firmwareRebuilds.checks){
  if(!runs.filter(r=>r.stack===check.stack).every(r=>r.report.hashes.firmware===check.frozenElfSha256))throw Error('Rebuild evidence does not identify campaign firmware: '+check.stack);
  const p=output+'/'+check.stack+'-source-rebuild.tar.gz';
  if(fs.existsSync(p)){const b=fs.readFileSync(p),id=check.stack+'-rebuild-archive';evidence[id]={id,path:p.replace(/^public\//,''),origin:'VM matched-qualification-20261120/'+check.stack+'-source-rebuild',sha256:hash(b),bytes:b.length,classification:'Independent native build evidence',note:firmwareRebuilds.scope};}
 }
 capture('firmware-rebuild-checks',bytes,'firmware-rebuild-checks.json',firmwareRebuilds.scope);
}
const tuning=['cognipilot','betaflight'].map(stack=>{const probes=runs.filter(r=>r.stack===stack&&r.shape==='attitude-step');return {stack,completed:probes.length,passed:probes.filter(r=>r.passed&&r.step?.qualified).length,qualified:[0,1,2,3].every(p=>probes.some(r=>r.probe===p&&r.passed&&r.step?.qualified))};});
const noNoiseRepeats=['cognipilot','betaflight'].flatMap(stack=>['off','omega'].map(mode=>{
 const r=runs.filter(r=>r.phase==='noise-matrix'&&r.stack===stack&&r.mode===mode&&r.noise==='none');
 const same=file=>r.length===5&&r.every(x=>evidence[x.id+'-'+file].originalSha256===evidence[r[0].id+'-'+file].originalSha256);
 return {stack,mode,completed:r.length,trajectoryIdentical:same('trajectory.csv'),actuatorIdentical:same('actuator-trace.bin')};
}));
const baselines=runs.filter(r=>r.phase==='baseline'&&r.shape!=='attitude-step'),matrix=runs.filter(r=>r.phase==='noise-matrix');
const checks=[
 {id:'generated-loop',label:'Exact flight-library oracle, derivative and orientation checks',completed:exactLoop.passed?1:0,planned:1,passed:exactLoop.passed===true},
 {id:'native-ingress',label:'Rebuilt native firmware integration checks',completed:nativeChecks?.integrationPassed?2:0,planned:2,passed:nativeChecks?.integrationPassed===true},
 {id:'attitude',label:'Signed attitude response',completed:tuning.reduce((s,t)=>s+t.completed,0),planned:8,passed:tuning.every(t=>t.qualified)},
 {id:'baseline',label:'Hover, step, square, figure-eight off/on',completed:baselines.length,planned:10,passed:baselines.length===10&&baselines.every(r=>r.passed)},
 {id:'matrix',label:'40 s lap: three noise profiles × five repeats × off/on',completed:matrix.length,planned:60,passed:matrix.length===60&&matrix.every(r=>r.passed)},
 {id:'parity',label:'Paired config, shared artifacts, noise bytes and counters',completed:pairs.length,planned:39,passed:pairs.length===39&&pairs.every(p=>p.identical_config_values&&p.identical_noise&&p.shared_artifacts&&p.matched_counters)&&seedAudit.every(s=>s.passed)},
 {id:'raw-scoring',label:'Raw scoring, input cadence, configuration and commands',completed:runs.filter(r=>r.score?.verified&&r.originalConfigVerified&&r.lead?.passed&&r.noiseTrace?.passed&&r.sensorTrace?.passed).length,planned:78,passed:runs.length===78&&runs.every(r=>r.score?.verified&&r.originalConfigVerified&&r.lead?.passed&&r.noiseTrace?.passed&&r.sensorTrace?.passed)},
 {id:'repeatability',label:'No-noise trajectory and motor-byte repeatability',completed:noNoiseRepeats.filter(r=>r.trajectoryIdentical&&r.actuatorIdentical).length,planned:4,passed:noNoiseRepeats.every(r=>r.trajectoryIdentical&&r.actuatorIdentical)}
];
capture('matched-analysis-source',fs.readFileSync('public/qualification-analysis.js'),'qualification-analysis.js','Independent analysis of saved raw measurements; does not execute a flight.');
evidence['matched-analysis-source'].origin='Local public/qualification-analysis.js';
capture('matched-import-source',fs.readFileSync('scripts/import-qualification.mjs'),'import-qualification.mjs','Dataset assembly and evidence verification; analysis only.');
evidence['matched-import-source'].origin='Local scripts/import-qualification.mjs';
const result={schemaVersion:1,date:'2026-11-20',scope:protocol.scope,protocol,coverage,seedAudit,exactLoop,nativeChecks,firmwareRebuilds,checks,fixedReferenceQualified:coverage.complete&&checks.every(c=>c.passed),noNoiseRepeats,runs,pairs,tuning,evidence};
fs.writeFileSync(output+'/summary.json',JSON.stringify(result));
console.log(JSON.stringify({runs:runs.length,landed:runs.filter(r=>r.landed).length,passed:runs.filter(r=>r.passed).length,pairs:pairs.length,tuning}));

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {scoreRawSamples,attitudeMetrics,courseGeometry,motorMetrics,leadMetrics,positionStepMetrics,imuTraceMetrics,conditionCoverage,noiseSeedAudit} from '../public/qualification-analysis.js';
import {armImage} from '../scripts/verify-firmware-rebuilds.mjs';
test('Sensor audit rejects cadence gaps, nonzero no-noise inputs and off-grid sensor values',()=>{
 const b=Buffer.alloc(3*28);[1,5,10].forEach((t,i)=>b.writeUInt32LE(t,i*28));
 assert.ok(imuTraceMetrics(b,.00125,{noNoise:true}).passed);
 const gap=Buffer.from(b);gap.writeUInt32LE(9,28);assert.throws(()=>imuTraceMetrics(gap,.00125),/schedule/);
 const bad=Buffer.from(b);bad.writeFloatLE(.5/(16.4*180/Math.PI),4);assert.throws(()=>imuTraceMetrics(bad,.00125,{quantized:true}),/quantization/);assert.throws(()=>imuTraceMetrics(bad,.00125,{noNoise:true}),/nonzero/);
 assert.throws(()=>imuTraceMetrics(b.subarray(0,56),.00125),/Incomplete/);
});
test('Rebuild verification ignores debug-only bytes but detects program and memory-layout changes',()=>{
 const b=Buffer.alloc(160);b.write('7f454c46',0,'hex');b[4]=1;b[5]=1;b.writeUInt16LE(2,16);b.writeUInt16LE(40,18);b.writeUInt32LE(0x70000000,24);b.writeUInt32LE(52,28);b.writeUInt16LE(32,42);b.writeUInt16LE(1,44);
 [1,100,0x70000000,0x70000000,4,16,5,4].forEach((x,i)=>b.writeUInt32LE(x,52+i*4));b.writeUInt32LE(0x12345678,100);
 const expected=armImage(b).imageSha256,debug=Buffer.from(b);debug[140]=99;assert.equal(armImage(debug).imageSha256,expected);
 for(const offset of [24,36,60,64,72,76,100]){const changed=Buffer.from(b);changed[offset]^=1;assert.notEqual(armImage(changed).imageSha256,expected);}
 assert.throws(()=>armImage(b.subarray(0,102)),/Invalid load/);const foreign=Buffer.from(b);foreign.writeUInt16LE(183,18);assert.throws(()=>armImage(foreign),/ARM executable/);
});
test('Lead checks reject missing samples and malformed channels',()=>{
 const rows=[0,.004,.008].map(t=>({time_s:t,lead_roll_rad:.01,lead_pitch_rad:0,omega_roll_rad_s:.06,omega_pitch_rad_s:0,roll_us:1508,pitch_us:1500,command_roll_rad:.01,command_pitch_rad:0}));
 assert.ok(leadMetrics(rows,'omega',6,0,.008).passed);
 assert.equal(leadMetrics(rows,'off',6,0,.008).passed,false);
 assert.throws(()=>leadMetrics(rows.slice(1),'omega',6,0,.008),/Incomplete/);
 delete rows[1].roll_us;assert.throws(()=>leadMetrics(rows,'omega',6,0,.008),/Missing/);
});
test('Position-step metrics retain overshoot and distinguish an unsettled hold',()=>{
 const rows=Array.from({length:1502},(_,i)=>{const t=24.99+i*.01;return {time_s:t,ref_x:t<25?0:.5,x_m:t<25?0:.5*(1-Math.exp(-(t-25)/.4))};});
 const m=positionStepMetrics(rows,25,40);assert.ok(Math.abs(m.rise_10_90_s-.4*Math.log(9))<.02);assert.equal(m.overshoot_fraction,0);assert.ok(m.settling_1cm_s>1.5&&m.settling_1cm_s<1.6);
 rows.at(-1).x_m=.55;const bad=positionStepMetrics(rows,25,40);assert.equal(bad.settling_1cm_s,null);assert.ok(Math.abs(bad.overshoot_fraction-.1)<1e-10);
});
test('Motor statistics use identical 1600 Hz samples across different transport cadences',()=>{
 const cg=Buffer.alloc(3*16),bf=Buffer.alloc(15*64);
 for(let i=0;i<3;i++)for(let j=0;j<4;j++)cg.writeFloatLE(i*.25,i*16+j*4);
 for(let i=0;i<15;i++){bf.writeUInt32LE(i+1,i*64+4);for(let j=0;j<4;j++)bf.writeFloatLE(Math.floor(i/5)*.25,i*64+8+j*4);}
 const a=motorMetrics(cg,'cognipilot',.000625,.001875),b=motorMetrics(bf,'betaflight',.000625,.001875);
 assert.deepEqual(a,b);assert.equal(a.slew_rms_per_s,400);assert.equal(a.lower_fraction,1/3);assert.equal(a.maximum,.5);
 bf.writeUInt32LE(0,4*64+4);assert.throws(()=>motorMetrics(bf,'betaflight',.000625,.001875),/sequence/);
});
test('Full-rate scoring uses held references and includes exact endpoints',()=>{
 const b=Buffer.alloc(3*56);[[0,3,4,0,0,0,0],[.000125,3,4,0,3,0,0],[.00025,3,4,0,3,4,0]].forEach((r,i)=>r.forEach((v,j)=>b.writeDoubleLE(v,i*56+j*8)));
 const m=scoreRawSamples(b,0,.00025);assert.equal(m.samples,3);assert.equal(m.rms_m,Math.sqrt(41/3));assert.equal(m.max_m,5);assert.equal(m.iae_m_s,13/16000);
 assert.throws(()=>scoreRawSamples(b.subarray(0,b.length-1),0,.00025),/Truncated/);assert.throws(()=>scoreRawSamples(b,0,.0005),/count/);
 b.writeDoubleLE(.0002,56);assert.throws(()=>scoreRawSamples(b,0,.00025),/timestamp/);
});
test('Attitude analysis treats signed responses symmetrically and rejects incomplete holds',()=>{
 for(const event of [0,1,2,3]){const key=event<2?'roll_actual':'pitch_actual',sign=event%2?-1:1;
 const rows=Array.from({length:2400},(_,i)=>{const t=24.8+i*.000625;return {time_s:t,[key]:t<25?0:sign*5*Math.PI/180*(1-Math.exp(-(t-25)/(.3/Math.log(9))))};});
 const m=attitudeMetrics(rows,event);assert.ok(m.qualified);assert.ok(Math.abs(m.rise_10_90_s-.3)<.001);assert.equal(m.overshoot_fraction,0);assert.throws(()=>attitudeMetrics(rows.slice(0,500),event),/Incomplete/);}
});
test('Figure-eight qualification rejects hover, missing lobes and a second lap',()=>{
 const points=[[0,0],[5,5],[5,-5],[-5,5],[-5,-5],[0,0]];const rows=points.map(([x,y],i)=>({time_s:25+i,x_m:x,y_m:y,z_m:2}));
 assert.ok(courseGeometry(rows,25,30).passed);assert.equal(courseGeometry(rows.slice(0,4),25,30).passed,false);assert.equal(courseGeometry([{time_s:25,x_m:0,y_m:0,z_m:2}],25,30).passed,false);
 assert.equal(courseGeometry([...rows,{time_s:31,x_m:3,y_m:3,z_m:2}],25,31).passed,false);
});
test('New paired measurements preserve noise hashes, full-rate scores and exact flight-library identity',()=>{
 const q=JSON.parse(fs.readFileSync(new URL('../public/data/matched-qualification/summary.json',import.meta.url)));
 assert.ok(q.pairs.length);for(const p of q.pairs){assert.ok(p.identical_config_values);assert.ok(p.identical_noise);assert.ok(p.shared_artifacts);assert.ok(p.matched_counters);assert.ok(p.verified_raw_scores);}
 for(const r of q.runs){assert.ok(r.originalConfigVerified);assert.ok(r.lead?.passed);}
 for(const c of q.firmwareRebuilds?.checks??[]){assert.ok(c.loadImageIdentical);assert.ok(q.runs.filter(r=>r.stack===c.stack).every(r=>r.report.hashes.firmware===c.frozenElfSha256));}
 for(const r of q.runs){assert.equal(r.report.hashes.offboard,q.exactLoop.hashes.library);const e=q.evidence[r.id+'-scoring-inputs.bin'];const raw=zlib.gunzipSync(fs.readFileSync(new URL('../public/'+e.path,import.meta.url)));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),r.report.sensor_profile.scoring_input_sha256);if(r.score)assert.ok(r.score.verified);}
});

test('Campaign coverage cannot substitute repeated conditions for missing planned seeds',()=>{const protocol={stacks:['cognipilot'],baseline:['hover'],modes:['off'],noise:['none'],seeds:[1,2]};const probe=p=>({stack:'cognipilot',phase:'baseline',shape:'attitude-step',mode:'off',noise:'realistic',seed:1,probe:p});const runs=[0,1,2,3].map(probe).concat([{stack:'cognipilot',phase:'baseline',shape:'hover',mode:'off',noise:'realistic',seed:1}], [1,2].map(seed=>({stack:'cognipilot',phase:'noise-matrix',shape:'figure-eight',mode:'off',noise:'none',seed})));assert.equal(conditionCoverage(runs,protocol).complete,true);const duplicate=runs.slice(0,-1).concat(runs.at(-2));const r=conditionCoverage(duplicate,protocol);assert.equal(r.complete,false);assert.equal(r.missing.length,1);assert.equal(r.duplicates.length,1);const wrong=runs.slice();wrong[6]={...wrong[6],seed:3};assert.equal(conditionCoverage(wrong,protocol).unexpected.length,1);});

test('Noise matching checks off/on identity and distinct seeded innovations',()=>{const protocol={stacks:['cognipilot'],noise:['realistic'],modes:['off','omega'],seeds:[1,2]};const rows=[1,2].flatMap(seed=>['off','omega'].map(mode=>({stack:'cognipilot',phase:'noise-matrix',noise:'realistic',seed,mode,report:{sensor_profile:{noise_input_sha256:'noise-'+seed}}})));assert.equal(noiseSeedAudit(rows,protocol)[0].passed,true);assert.equal(noiseSeedAudit(rows.slice(1),protocol)[0].passed,false);const wrong=structuredClone(rows);wrong[1].report.sensor_profile.noise_input_sha256='other';assert.equal(noiseSeedAudit(wrong,protocol)[0].equalWithinSeed,false);wrong.forEach(r=>r.report.sensor_profile.noise_input_sha256='same');assert.equal(noiseSeedAudit(wrong,protocol)[0].passed,false);});

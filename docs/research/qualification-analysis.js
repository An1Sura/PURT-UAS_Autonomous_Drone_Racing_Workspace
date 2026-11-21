// Independent analysis of stored measurements. No controller or simulator runs here.
export function conditionCoverage(runs,protocol){
 const key=r=>[r.stack,r.phase,r.shape,r.mode,r.noise,r.seed,r.shape==='attitude-step'?r.probe:null].join('|');
 const expected=[];
 for(const stack of protocol.stacks){
  for(let probe=0;probe<4;probe++)expected.push(key({stack,phase:'baseline',shape:'attitude-step',mode:'off',noise:'realistic',seed:1,probe}));
  for(const shape of protocol.baseline)for(const mode of shape==='figure-eight'?protocol.modes:['off'])expected.push(key({stack,phase:'baseline',shape,mode,noise:'realistic',seed:1}));
  for(const noise of protocol.noise)for(const seed of protocol.seeds)for(const mode of protocol.modes)expected.push(key({stack,phase:'noise-matrix',shape:'figure-eight',noise,seed,mode}));
 }
 const counts=new Map();for(const r of runs){const k=key(r);counts.set(k,(counts.get(k)??0)+1);}
 const missing=expected.filter(k=>!counts.has(k)),duplicates=[...counts].filter(([,n])=>n>1).map(([condition,attempts])=>({condition,attempts})),unexpected=[...counts.keys()].filter(k=>!expected.includes(k));
 return {planned:expected.length,uniqueCompleted:expected.filter(k=>counts.has(k)).length,missing,duplicates,unexpected,complete:missing.length===0&&duplicates.length===0&&unexpected.length===0};
}
export function noiseSeedAudit(runs,protocol){
 return protocol.stacks.flatMap(stack=>protocol.noise.map(noise=>{
  const cells=protocol.seeds.map(seed=>runs.filter(r=>r.phase==='noise-matrix'&&r.stack===stack&&r.noise===noise&&r.seed===seed));
  const completeSeeds=cells.filter(rs=>rs.length===protocol.modes.length&&protocol.modes.every(mode=>rs.some(r=>r.mode===mode))).length;
  const equalWithinSeed=cells.every(rs=>new Set(rs.map(r=>r.report.sensor_profile.noise_input_sha256)).size<=1);
  const distinctInnovations=new Set(cells.filter(rs=>rs.length).map(rs=>rs[0].report.sensor_profile.noise_input_sha256)).size;
  return {stack,noise,completeSeeds,plannedSeeds:protocol.seeds.length,equalWithinSeed,distinctInnovations,passed:completeSeeds===protocol.seeds.length&&equalWithinSeed&&distinctInnovations===(noise==='none'?1:protocol.seeds.length)};
 }));
}
export function imuTraceMetrics(buffer,duration,{quantized=false,noNoise=false}={}){
 const view=new DataView(buffer.buffer??buffer,buffer.byteOffset??0,buffer.byteLength),count=view.byteLength/28;
 if(view.byteLength%28||count!==Math.round(duration*1600)+1)throw Error('Incomplete IMU trace');
 const sum=Array(6).fill(0),squares=Array(6).fill(0);let maxQuantizationResidual=0,maxAbs=0;
 for(let i=0;i<count;i++){
  if(view.getUint32(i*28,true)!==(i===0?1:i*5))throw Error('Invalid IMU trace schedule');
  for(let axis=0;axis<6;axis++){
   const value=view.getFloat32(i*28+4+axis*4,true);if(!Number.isFinite(value))throw Error('Non-finite IMU sample');
   sum[axis]+=value;squares[axis]+=value*value;maxAbs=Math.max(maxAbs,Math.abs(value));
   if(quantized){const c=value*(axis<3?16.4*180/Math.PI:2048/9.80665);if(Math.abs(c)>32767.002)throw Error('IMU sample exceeds declared range');maxQuantizationResidual=Math.max(maxQuantizationResidual,Math.abs(c-Math.round(c)));}
  }
 }
 if(quantized&&maxQuantizationResidual>.002)throw Error('IMU sample is off the declared quantization grid');
 if(noNoise&&maxAbs!==0)throw Error('No-noise trace contains a nonzero innovation');
 return {samples:count,hz:1600,startupSampleTick:1,subsequentTickSpacing:5,mean:sum.map(v=>v/count),rms:squares.map(v=>Math.sqrt(v/count)),maxQuantizationResidualCounts:maxQuantizationResidual,passed:true,scope:quantized?'Host expected quantized sensor boundary; not a direct onboard readback.':'Recorded exogenous IMU innovations before adding vehicle motion.'};
}
export function scoreRawSamples(buffer, start, end, hz=8000) {
  const view=new DataView(buffer.buffer ?? buffer,buffer.byteOffset??0,buffer.byteLength);
  if(view.byteLength%56)throw Error('Truncated scoring record');
  const n=view.byteLength/56, expected=Math.round((end-start)*hz)+1;
  if(n!==expected)throw Error(`Scoring count ${n}, expected ${expected}`);
  let sum=0,max=0,iae=0,ise=0,previous=0,z2=0,zmax=0,zbias=0;
  for(let i=0;i<n;i++){
    const r=Array.from({length:7},(_,j)=>view.getFloat64(i*56+j*8,true));
    if(!r.every(Number.isFinite)||Math.abs(r[0]-(start+i/hz))>1e-8)throw Error('Invalid scoring timestamp/value');
    const error=Math.hypot(r[1]-r[4],r[2]-r[5],r[3]-r[6]);
    const ez=r[3]-r[6];z2+=ez*ez;zmax=Math.max(zmax,Math.abs(ez));zbias+=ez;
    sum+=error*error;max=Math.max(max,error);
    if(i){iae+=(previous+error)/(2*hz);ise+=(previous*previous+error*error)/(2*hz);}
    previous=error;
  }
  return {samples:n,hz,start_s:start,end_s:end,rms_m:Math.sqrt(sum/n),max_m:max,iae_m_s:iae,ise_m2_s:ise,altitude_rms_m:Math.sqrt(z2/n),altitude_max_m:zmax,altitude_bias_m:zbias/n};
}
export function motorMetrics(buffer,stack,start,end){
 const bf=stack==='betaflight',stride=bf?64:16,offset=bf?8:0,dt=1/1600;
 if(buffer.byteLength%stride)throw Error('Truncated actuator frame');
 const v=new DataView(buffer.buffer??buffer,buffer.byteOffset??0,buffer.byteLength);
 let samples=0,upper=0,lower=0,slew=0,previous=null,min=Infinity,max=-Infinity;
 for(let i=0;i<v.byteLength/stride;i++){
  if(bf&&(i+1)%5)continue; // Sample both decoded motor outputs on identical 625 us boundaries.
  const t=(i+1)/(bf?8000:1600);if(t<start||t>end)continue;
  if(bf&&v.getUint32(i*stride+4,true)!==i+1)throw Error('Non-contiguous actuator sequence');
  const m=Array.from({length:4},(_,j)=>v.getFloat32(i*stride+offset+4*j,true));
  if(!m.every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('Invalid normalized motor command');
  min=Math.min(min,...m);max=Math.max(max,...m);upper+=m.some(x=>x>=.999);lower+=m.some(x=>x<=.001);
  if(previous)slew+=m.reduce((s,x,j)=>s+((x-previous[j])/dt)**2,0)/4;
  previous=m;samples++;
 }
 if(!samples)throw Error('No actuator samples in window');
 return {samples,hz:1600,minimum:min,maximum:max,upper_fraction:upper/samples,lower_fraction:lower/samples,slew_rms_per_s:samples>1?Math.sqrt(slew/(samples-1)):null,scope:'Decoded normalized commands at common 1600 Hz; slew includes intentional control action, quantization and noise, not CPU jitter or electrical motor timing.'};
}
export function leadMetrics(rows,mode,gain,start,end){
 if(!['off','omega'].includes(mode)||!Number.isFinite(gain)||gain<=0)throw Error('Invalid lead mode/gain');
 const samples=rows.filter(r=>r.time_s>=start&&r.time_s<=end);if(!samples.length)throw Error('No lead samples');
 if(samples.length!==Math.round((end-start)*250)+1)throw Error('Incomplete command schedule');
 let identity=0,quantization=0,peak=0,schedule=0;
 for(let i=0;i<samples.length;i++){
  const r=samples[i];if(i)schedule=Math.max(schedule,Math.abs(r.time_s-samples[i-1].time_s-.004));
  for(const axis of ['roll','pitch']){
   const lead=r['lead_'+axis+'_rad'],omega=r['omega_'+axis+'_rad_s'];
   if(![lead,omega,r[axis+'_us'],r['command_'+axis+'_rad']].every(Number.isFinite))throw Error('Missing or invalid command measurement');
   identity=Math.max(identity,Math.abs(lead-(mode==='omega'?omega/gain:0)));
   quantization=Math.max(quantization,Math.abs((r[axis+'_us']-1500)/500*35*Math.PI/180-r['command_'+axis+'_rad']));
   peak=Math.max(peak,Math.abs(lead));
  }
 }
 return {samples:samples.length,gain_per_s:gain,identity_max_error_rad:identity,quantization_max_error_deg:quantization*180/Math.PI,peak_lead_deg:peak*180/Math.PI,command_period_max_error_s:schedule,passed:identity<1e-12&&quantization<=.035*Math.PI/180+1e-12&&schedule<1e-10,scope:'Recorded host-generated lead and integer RC encoding; not a direct firmware setpoint readback.'};
}
export function positionStepMetrics(rows,start,end){
 const samples=rows.filter(r=>r.time_s>=start&&r.time_s<=end),before=rows.filter(r=>r.time_s<start).at(-1);
 if(!before||samples.length<2||Math.abs(samples.at(-1).time_s-end)>.011)throw Error('Incomplete position-step window');
 const target=samples.at(-1).ref_x,base=before.x_m,delta=target-base;
 if(Math.abs(target-.5)>1e-5||Math.abs(delta)<.1)throw Error('Unexpected position-step reference');
 const crossing=level=>samples.find(r=>(r.x_m-base)/delta>=level)?.time_s;
 const t10=crossing(.1),t90=crossing(.9);
 const outside=samples.findLastIndex(r=>Math.abs(r.x_m-target)>.01);
 const tail=samples.filter(r=>r.time_s>=end-2);
 return {target_m:target,rise_10_90_s:t10==null||t90==null?null:t90-t10,overshoot_fraction:Math.max(0,...samples.map(r=>(r.x_m-target)/delta)),settling_1cm_s:outside===samples.length-1?null:samples[outside+1].time_s-start,terminal_bias_m:tail.reduce((s,r)=>s+r.x_m-target,0)/tail.length,scope:'Descriptive 100 Hz position measurements, nominal 0.5 m east step, ±1 cm settling through the end of the hold. No additional pass/fail threshold selected from these results.'};
}
export function attitudeMetrics(rows,event) {
  if(!Number.isInteger(event)||event<0||event>3)throw Error('Invalid signed probe');
  const axis=event<2?'roll':'pitch',sign=event%2?-1:1,target=sign*5*Math.PI/180,start=25;
  const before=rows.filter(r=>r.time_s<start).at(-1);
  const samples=rows.filter(r=>r.time_s>=start&&r.time_s<start+1.2);
  if(!before||samples.length<1900||samples.at(-1).time_s<26.199)throw Error('Incomplete attitude scoring window');
  const base=before[axis+'_actual'],delta=target-base;
  const cross=l=>samples.find(r=>(r[axis+'_actual']-base)/delta>=l)?.time_s;
  const t10=cross(.1),t90=cross(.9),rise=t10==null||t90==null?null:t90-t10;
  const overshoot=Math.max(0,...samples.map(r=>(r[axis+'_actual']-base)/delta-1));
  const lastBad=samples.filter(r=>Math.abs(r[axis+'_actual']-target)>Math.PI/180).at(-1);
  const settling=lastBad&&lastBad.time_s-start>=1.1?null:(lastBad?lastBad.time_s-start:0)+.000625;
  return {axis,sign,target_deg:sign*5,rise_10_90_s:rise,overshoot_fraction:overshoot,settling_1_deg_s:settling,
    qualified:rise!=null&&rise>=.2&&rise<=.4&&overshoot<.2&&settling!=null&&settling<=1,
    samples:rows.filter(r=>r.time_s>=24.8&&r.time_s<26.3).filter((_,i)=>i%4===0).map(r=>({t:r.time_s-start,actual_deg:r[axis+'_actual']*180/Math.PI,command_deg:r[axis+'_command']*180/Math.PI}))};
}
export function courseGeometry(rows,start,end){
  let gate=0,returned=false,extra=false,finish=null;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
  for(const r of rows.filter(r=>r.time_s>=start&&r.time_s<=end)){
    const {x_m:x,y_m:y,z_m:z}=r;
    [x,y].forEach((v,i)=>{lo[i]=Math.min(lo[i],v);hi[i]=Math.max(hi[i],v);});
    const g=[x>2&&y>2,x>2&&y< -2,x< -2&&y>2,x< -2&&y< -2];
    if(gate<4&&g[gate])gate++;
    if(gate===4&&!returned&&Math.hypot(x,y)<.75&&Math.abs(z-2)<.75){returned=true;finish=r.time_s;}
    if(returned&&g[0])extra=true;
  }
  const extent=[0,1].every(i=>lo[i]<=-4.25&&hi[i]>=4.25);
  return {ordered_quadrants:gate,returned_to_center:returned,extra_lap:extra,extents_covered:extent,completion_timestamp_s:finish,passed:gate===4&&returned&&extent&&!extra};
}

// Analysis utilities. These never run a flight controller or alter stored results.
export function parseCSV(text){
 const lines=text.trim().split(/\r?\n/),keys=lines.shift().split(',');
 return lines.filter(Boolean).map((line,i)=>{const values=line.split(',');if(values.length!==keys.length)throw Error(`CSV row ${i+2} has the wrong column count`);return Object.fromEntries(keys.map((k,j)=>[k,values[j]==='true'?1:values[j]==='false'?0:Number.isFinite(Number(values[j]))?Number(values[j]):values[j]]));});
}
export const norm=(v)=>Math.hypot(...v);
export function rms(values){return values.length?Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length):null;}
export function derivative(rows,keys){return rows.map((r,i)=>{const a=rows[Math.max(0,i-1)],b=rows[Math.min(rows.length-1,i+1)],dt=b.time_s-a.time_s;return keys.map(k=>dt>0?(b[k]-a[k])/dt:0);});}
export function analyzeFlight(rows,report){
 const lap=rows.filter(r=>r.time_s>=report.lap_start_s&&r.time_s<=report.lap_end_s);
 if(!lap.length)throw Error('No telemetry within lap window');
 const errors=lap.map(r=>norm([r.x_m-r.ref_x,r.y_m-r.ref_y,r.z_m-r.ref_z]));
 const v=derivative(rows,['x_m','y_m','z_m']);
 const trajectory=rows.map((r,i)=>({...r,ex:r.x_m-r.ref_x,ey:r.y_m-r.ref_y,ez:r.z_m-r.ref_z,error:norm([r.x_m-r.ref_x,r.y_m-r.ref_y,r.z_m-r.ref_z]),vx:v[i][0],vy:v[i][1],vz:v[i][2],speed:norm(v[i])}));
 const acc=derivative(trajectory,['vx','vy','vz']);trajectory.forEach((r,i)=>{r.ax=acc[i][0];r.ay=acc[i][1];r.az=acc[i][2];r.acceleration=norm(acc[i]);});
 let path=0,iae=0,ise=0;for(let i=1;i<lap.length;i++){const a=lap[i-1],b=lap[i],dt=b.time_s-a.time_s;path+=norm([b.ref_x-a.ref_x,b.ref_y-a.ref_y,b.ref_z-a.ref_z]);iae+=dt*(errors[i]+errors[i-1])/2;ise+=dt*(errors[i]**2+errors[i-1]**2)/2;}
 return {trajectory,metrics:{sampled_rms_m:rms(errors),sampled_max_m:Math.max(...errors),reference_length_m:path,mean_reference_speed_m_s:path/(report.lap_end_s-report.lap_start_s),iae_m_s:iae,ise_m2_s:ise,samples:lap.length,sample_period_s:rows[1].time_s-rows[0].time_s,method:'Lap-window CSV samples; equal-weight RMS; trapezoidal IAE/ISE; finite differences for velocity/acceleration. No smoothing or phase alignment. Full-resolution runner report remains authoritative.'}};
}
export function assessParity(a,b){
 const checks=['config','plant','plant_description','offboard','runner'].map(key=>({key,match:!!a.hashes?.[key]&&a.hashes[key]===b.hashes?.[key]}));
 return {checks,qualified:false,reason:'Matching hashes are necessary but not sufficient. Command mapping, realized sensor inputs, deterministic repeats, same-rule tuning and all validation stages still require evidence.'};
}
export function canEvaluateFinal(gates,margin){return gates.length===4&&gates.every(g=>g.status==='passed')&&Number.isFinite(margin?.errorRatio)&&Number.isFinite(margin?.speedRatio)&&!!margin?.frozenBeforeEvaluation;}
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function ffRates({mass,thrust,jerk,x,y,z}){if(!(thrust>0))throw Error('Positive collective thrust required');const h=jerk.map((v,i)=>mass/thrust*(v-dot(z,jerk)*z[i]));return [-dot(h,y),dot(h,x)];}
export function headingTilt(direction,yaw){const c=Math.cos(yaw),s=Math.sin(yaw),x=c*direction[0]+s*direction[1],y=-s*direction[0]+c*direction[1],z=direction[2];return [Math.atan2(-y,Math.hypot(x,z)),Math.atan2(x,z)];}
export function scientificSummary(rows){const good=rows.filter(r=>Number.isFinite(r.rms));return {n:rows.length,passed:rows.filter(r=>r.passed).length,meanRms:good.length?good.reduce((s,r)=>s+r.rms,0)/good.length:null};}
// Diagnostic reconstruction, not recovered full-rate measurements: actual position is
// linearly interpolated; the 100 Hz reference is held exactly as in shared_sil.rs.
export function reconstructHeldReferenceRms(rows,start,end,hz=8000){
 let sum=0,count=0;
 for(let i=0;i<rows.length-1;i++){
  const a=rows[i],b=rows[i+1],first=Math.ceil((a.time_s-1e-9)*hz),last=Math.ceil((b.time_s-1e-9)*hz);
  for(let tick=first;tick<last;tick++){
   const t=tick/hz;if(t<start||t>end)continue;
   const u=(t-a.time_s)/(b.time_s-a.time_s);
   sum+=['x','y','z'].reduce((s,axis)=>s+((1-u)*a[axis+'_m']+u*b[axis+'_m']-a['ref_'+axis])**2,0);count++;
  }
 }
 return {rms_m:count?Math.sqrt(sum/count):null,samples:count,method:'Linear reconstruction of position at 8000 Hz; zero-order-held 100 Hz reference; not raw high-rate telemetry'};
}
// Display interpolation only; metrics continue to use the original measurements.
export function sampleRecordedPose(rows,t){
 if(!rows.length)throw Error('No recorded pose samples');
 if(t<=rows[0].time_s)return rows[0];if(t>=rows.at(-1).time_s)return rows.at(-1);
 let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time_s<=t)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],u=(t-a.time_s)/(b.time_s-a.time_s),r={...a,time_s:t};
 for(const key of ['x_m','y_m','z_m','roll_rad','pitch_rad','yaw_rad'])r[key]=a[key]+u*(b[key]-a[key]);
 return r;
}

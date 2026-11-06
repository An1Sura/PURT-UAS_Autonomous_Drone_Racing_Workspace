const body = document.getElementById('arm-speed-rows');
const status = document.getElementById('arm-speed-status');
try {
 const response = await fetch('../results/arm-speed/betaflight-attempts.json', {cache:'no-store'});
 if (!response.ok) throw Error('HTTP '+response.status);
 const attempts = await response.json();
 const groups = new Map();
 for (const a of attempts) {
  const r=a.report, lap=a.config.course.lap_time_s, noise=r.sensor_profile.level;
  if (!Number.isFinite(r.tracking_rms_m)||!Number.isFinite(r.tracking_max_m)) throw Error('Incomplete report');
  const key=lap+'|'+noise+'|'+r.sensor_profile.feedforward;
  if(!groups.has(key)) groups.set(key,{lap,noise,mode:r.sensor_profile.feedforward,passed:0,count:0,lo:Infinity,hi:0,max:0});
  const g=groups.get(key);g.count++;g.passed+=a.passed===true?1:0;g.lo=Math.min(g.lo,r.tracking_rms_m);g.hi=Math.max(g.hi,r.tracking_rms_m);g.max=Math.max(g.max,r.tracking_max_m);
 }
 body.replaceChildren();
 for(const g of groups.values()){
  const row=document.createElement('tr');
  for(const value of [g.lap+' s',g.noise+' / lead '+g.mode,g.passed+' / '+g.count,g.lo.toFixed(3)+'–'+g.hi.toFixed(3),g.max.toFixed(3)]){const td=document.createElement('td');td.textContent=value;row.append(td)}
  body.append(row);
 }
 const confirmations=new Map();
 for(const a of attempts.filter(a=>a.id.startsWith('confirm-'))){const lap=a.config.course.lap_time_s;if(!confirmations.has(lap))confirmations.set(lap,[]);confirmations.get(lap).push(a);}
 const confirmed=[...confirmations].filter(([lap,runs])=>runs.length===15&&runs.every(a=>a.passed===true)).map(([lap])=>lap).sort((a,b)=>a-b);
 status.textContent=attempts.length+' completed attempts in this published snapshot. '+(confirmed.length?confirmed[0]+' s passed all 15 noise/seed confirmations; ARM tuning prerequisites remain open. ':'Speed confirmation is in progress. ')+'CogniPilot’s new ARM speed sweep is queued separately. Failed attempts are retained.';
} catch(error) {status.textContent='Speed reports unavailable: '+error.message+'. No substitute results are shown.';}

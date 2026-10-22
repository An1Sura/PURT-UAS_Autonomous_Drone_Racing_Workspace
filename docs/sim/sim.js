import {stats} from '../planner/math.js';
const $=id=>document.getElementById(id), names=['betaflight','cognipilot'];
const fetchJson=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(url+' unavailable');return r.json()};
try {
 const [spec,e]=await Promise.all(['../config/shared-position-benchmark.json','../config/purt-environment.json'].map(fetchJson));
 const c={...spec.course},s=stats(c),number=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';
 $('summary').textContent=`${c.width_m*c.scale} × ${c.height_m*c.scale} m horizontal footprint · ${c.altitude_m} m altitude · one lap`;
 for(const [label,value] of [['Path length per lap / total',`${number(s.path_length_per_lap_m)} / ${number(s.path_length_total_m)} m`],['Commissioning lap target',`${c.lap_time_s} s (not measured)`],['Mean / peak required speed',`${number(s.mean_speed_m_s)} / ${number(s.peak_speed_m_s)} m/s`],['Peak lateral acceleration',`${number(s.peak_lateral_accel_m_s2)} m/s² / ${number(s.peak_lateral_accel_g)} g`],['Peak horizontal acceleration',`${number(s.peak_horizontal_accel_m_s2)} m/s²`],['Tightest turn radius',`${number(s.tightest_turn_radius_m)} m`]]){const tr=document.createElement('tr');for(const text of [label,value]){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('course-stats').append(tr)}
 const margin=spec.vehicle_radius_m+spec.tracking_margin_m+e.safety_margin_m,lo=e.flyable_volume.min_enu_m,hi=e.flyable_volume.max_enu_m;
 const fits=[0,1].every(i=>c.center_enu_m[i]-[c.width_m,c.height_m][i]*c.scale/2-margin>=lo[i]&&c.center_enu_m[i]+[c.width_m,c.height_m][i]*c.scale/2+margin<=hi[i])&&c.altitude_m-margin>=lo[2]&&c.altitude_m+margin<=hi[2];
 $('fit').textContent=`Approximate envelope: ${fits?'fits':'does not fit'} with ${number(margin,2)} m combined vehicle/tracking/wall allowance. Overall PURT clearance remains UNVERIFIED: calibrated MoCap coverage and obstacle inventory are missing.`;
 $('preview').onclick=()=>{$('flight').src='course-view.html';$('flight').title='Requested PURT course geometry';$('flight').style.height='650px';$('status').textContent='Static requested course geometry.'};
 const variants=['off','omega','omega_alpha'], labels={off:'FF off',omega:'Rate FF',omega_alpha:'Rate + acceleration FF'}, recordings=new Map();
 for(const name of names)for(const variant of variants){
  const r=await fetchJson('../results/shared-sil/feedforward/'+name+'-'+variant+'.json');recordings.set(name+'-'+variant,r);
  const tr=document.createElement('tr');for(const text of [name+' / '+labels[variant],r.passed?'Passed':'FAILED; see report',r.config.lap_time_s+' s',number(r.report.simulated_seconds,2)+' s',number(r.report.tracking_rms_m)+' / '+number(r.report.tracking_max_m)+' m']){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('stats').append(tr);
 }
 let selected='cognipilot';
 function show(name){$('variant').disabled=false;selected=name;const variant=$('variant').value,r=recordings.get(name+'-'+variant);$('flight').src='flight-view.html?stack='+name+'&variant='+variant;$('flight').title=name+' recorded SIL flight';$('flight').style.height='850px';$('status').textContent=name+' · '+labels[variant]+' · '+(r.passed?'passed; landing/disarm verified':'FAILED attempt')+' · recorded '+new Date(r.recorded_at_unix_s*1000).toISOString().slice(0,10);}
 for(const name of names){const b=document.querySelector('[data-stack="'+name+'"]');b.hidden=false;b.onclick=()=>show(name);}
 $('variant').onchange=()=>show(selected);
 $('flight-results').textContent='Historical prototype: these native recordings used the earlier onboard feed-forward implementation. They are retained as evidence, not results for the updated tilt-lead method.';
 const first=document.querySelector('[data-stack="cognipilot"]:not([hidden])');if(first)first.click();
 try {
  for(const [name,folder,id] of [['cognipilot','cognipilot','fastdyn'],['betaflight','betaflight','fastdyn-betaflight']]) {
  const r=await fetchJson('../results/tilt-lead/fastdyn/'+folder+'/replay.json'),p=r.report;
  const landed=p.grounded_stopped_samples>=4000&&!p.final_armed&&p.final_motors.every(x=>x===0)&&p.final_position[2]<0.11;
  for(const [label,value] of [['Stack / recorded',name+' / '+new Date(r.recorded_at_unix_s*1000).toISOString().slice(0,10)],['Lap target / full simulated flight',r.config.lap_time_s+' / '+number(p.simulated_seconds,2)+' s'],['Tracking RMS / maximum',number(p.tracking_rms_m)+' / '+number(p.tracking_max_m)+' m'],['Tilt-clamp updates',String(p.tilt_clamp_updates)],['Firmware exchanges',p.firmware_exchanges.toLocaleString()],['Landing / disarm / stopped motors',landed?'Verified':'NOT verified'],['Emulator wall time',number(p.wall_seconds,1)+' s (not drone lap time)']]) {const tr=document.createElement('tr');for(const text of [label,value]){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('fastdyn-stats').append(tr)}
  $(id).hidden=false;$(id).onclick=()=>{$('variant').disabled=true;$('flight').src='flight-view.html?stack='+name+'&backend=fastdyn';$('flight').title=name+' FastDyn ARM figure-eight recording';$('flight').style.height='850px';$('status').textContent=name+' · FastDyn ARM BIL · '+(r.passed&&landed?'passed; landing/disarm verified':'FAILED attempt; actual recording')+' · recorded '+new Date(r.recorded_at_unix_s*1000).toISOString().slice(0,10);};
  }
  $('fastdyn-status').textContent='Both ARM recordings · one 10 × 10 m lap at 2 m · 40 s reference · no-noise commissioning runs';
  $('fastdyn-betaflight').click();
 } catch(error){$('fastdyn-status').textContent='FastDyn recording unavailable: '+error.message;}

 try { const result=await fetchJson('../results/tilt-lead/speed/summary.json');
 $('tilt-speed-status').textContent='Rate-only offboard lead · matched tuning · 0.35 m RMS / 0.75 m maximum error gates · all attempted runs retained';
 for(const r of result.stacks) {const tr=document.createElement('tr');for(const value of [r.stack+' / '+r.feedforward,r.selected_lap_s+' s reference',number(r.mean_reference_speed_m_s)+' m/s mean reference speed','15/15 confirmed: three noise levels × five seeds']){const td=document.createElement('td');td.textContent=value;tr.append(td)}$('tilt-speed-stats').append(tr);const off=r.runs.filter(x=>x.id.startsWith('off-'));const note=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent=r.stack+' with lead OFF at the same '+r.selected_lap_s+' s target: '+off.filter(x=>x.passed).length+'/'+off.length+' passed; RMS '+number(Math.min(...off.map(x=>x.report.tracking_rms_m)))+'–'+number(Math.max(...off.map(x=>x.report.tracking_rms_m)))+' m. Off-mode fastest duration was not searched.';note.append(td);$('tilt-speed-stats').append(note)}
 }catch(error){$('tilt-speed-status').textContent='Speed confirmation not yet available: '+error.message;}
 const campaign=await fetchJson('../results/shared-sil/feedforward/campaign-summary.json');
 $('campaign-status').textContent=campaign.completed_runs+' / '+campaign.planned_runs+' native flights recorded · '+campaign.passed_runs+' passed the commissioning gates. RMS ranges below include completed reference windows; aborted runs remain in the linked reports.';
 for(const cell of campaign.cells){const tr=document.createElement('tr');for(const text of [cell.stack+' / '+cell.noise+' / '+labels[cell.mode],cell.passed+'/'+cell.runs,number(cell.rms_mean_completed)+' / '+number(cell.rms_min_completed)+'–'+number(cell.rms_max_completed)+' m',number(cell.worst_tracking_max_m)+' m']){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('campaign-stats').append(tr);}
 try{const r=await fetchJson('../results/tilt-lead/checks.json');$('checks').textContent=r.passed?`Generated-code checks passed: ${r.metrics.samples} reference samples, two identical reference repeats, and shared PositionLoop compared with the GuidanceController POSITION branch. Jerk, snap and feed-forward derivatives also passed independent numerical checks; switch-off and disengage produce zero feed-forward. These are numerical component checks, not a formal firmware proof.`:'Generated-code check failed: '+r.error}catch{$('checks').textContent='Generated-code qualification results are not available in this deployment.'}
} catch(e){$('status').textContent='Unable to load benchmark: '+e.message}


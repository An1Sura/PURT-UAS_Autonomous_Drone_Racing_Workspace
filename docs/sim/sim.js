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
 function show(name){selected=name;const variant=$('variant').value,r=recordings.get(name+'-'+variant);$('flight').src='flight-view.html?stack='+name+'&variant='+variant;$('flight').title=name+' recorded SIL flight';$('flight').style.height='850px';$('status').textContent=name+' · '+labels[variant]+' · '+(r.passed?'passed; landing/disarm verified':'FAILED attempt')+' · recorded '+new Date(r.recorded_at_unix_s*1000).toISOString().slice(0,10);}
 for(const name of names){const b=document.querySelector('[data-stack="'+name+'"]');b.hidden=false;b.onclick=()=>show(name);}
 $('variant').onchange=()=>show(selected);
 $('flight-results').textContent='Actual native firmware flights using the same plant and timed reference. All variants are shown, including losses; these are commissioning results, not a fastest-speed claim.';
 const first=document.querySelector('[data-stack="cognipilot"]:not([hidden])');if(first)first.click();
 const campaign=await fetchJson('../results/shared-sil/feedforward/campaign-summary.json');
 $('campaign-status').textContent=campaign.completed_runs+' / '+campaign.planned_runs+' native flights recorded · '+campaign.passed_runs+' passed the commissioning gates. RMS ranges below include completed reference windows; aborted runs remain in the linked reports.';
 for(const cell of campaign.cells){const tr=document.createElement('tr');for(const text of [cell.stack+' / '+cell.noise+' / '+labels[cell.mode],cell.passed+'/'+cell.runs,number(cell.rms_mean_completed)+' / '+number(cell.rms_min_completed)+'–'+number(cell.rms_max_completed)+' m',number(cell.worst_tracking_max_m)+' m']){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('campaign-stats').append(tr);}
 try{const r=await fetchJson('../results/shared-sil/feedforward/checks.json');$('checks').textContent=r.passed?`Generated-code checks passed: ${r.metrics.samples} reference samples, two identical reference repeats, and shared PositionLoop compared with the GuidanceController POSITION branch. Jerk, snap and feed-forward derivatives also passed independent numerical checks; switch-off and disengage produce zero feed-forward. These are numerical component checks, not a formal firmware proof.`:'Generated-code check failed: '+r.error}catch{$('checks').textContent='Generated-code qualification results are not available in this deployment.'}
} catch(e){$('status').textContent='Unable to load benchmark: '+e.message}


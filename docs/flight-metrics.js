const body=document.getElementById('flight-metric-rows');
if(body){
 const flights=[
  ['CogniPilot · 40 s baseline','../results/tilt-lead/fastdyn/cognipilot/flight-summary.json'],
  ['Betaflight TROPIC · 40 s baseline','../results/tilt-lead/fastdyn/betaflight-nxp/flight-summary.json'],
  ['Betaflight TROPIC · 33 s individual pass*','../results/arm-speed/betaflight-33s/flight-summary.json']
 ];
 for(const [label,url] of flights){
  const row=document.createElement('tr');
  try{
   const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
   const s=await response.json();
   const values=[s.recorded_course_distance_m,s.recorded_mean_speed_m_s,s.recorded_peak_speed_m_s,s.course_altitude_rms_error_m];
   if(!values.every(Number.isFinite))throw Error('Incomplete metrics');
   const first=document.createElement('td'),link=document.createElement('a');link.href=url;link.textContent=label;first.append(link);row.append(first);
   for(const [i,value]of values.entries()){const td=document.createElement('td');td.textContent=value.toFixed(i===3?3:2);row.append(td);}
  }catch(error){const td=document.createElement('td');td.colSpan=5;td.textContent=label+': unavailable ('+error.message+')';row.append(td);}
  body.append(row);
 }
}

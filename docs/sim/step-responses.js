const table=document.querySelector('#step-rows');
const status=document.querySelector('#step-status');
try {
 const response=await fetch('../results/rate-matched-steps-20261113/summary.json');
 if(!response.ok)throw new Error(`HTTP ${response.status}`);
 const data=await response.json();
 const seconds=n=>n==null?'Not reached':`${n.toFixed(3)} s`;
 for(const f of data.flights){
  const row=document.createElement('tr');
  for(const value of [`${f.test} / ${f.stack}`,seconds(f.rise_10_90_s),seconds(f.settling_5_percent_s),f.overshoot_percent==null?'Unavailable':`${f.overshoot_percent.toFixed(1)}%`,f.completed_and_landed?'Completed + landed':`Failed: ${f.error}`]){
   const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  table.append(row);
 }
 status.textContent=data.status || `${data.flights.filter(f=>f.completed_and_landed).length}/${data.flights.length} displayed diagnostic flights completed and landed. See retained attempts and scope below.`;
}catch(error){status.textContent=`Step results could not be loaded: ${error.message}`;}

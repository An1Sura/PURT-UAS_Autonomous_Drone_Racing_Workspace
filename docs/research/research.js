const targets=[
 {name:'CogniPilot',board:'TROPIC · RT1064 · Cortex-M7',folder:'cognipilot',css:'cg',label:'Existing ARM baseline'},
 {name:'Betaflight',board:'TROPIC · RT1064 · Cortex-M7',folder:'betaflight-nxp',css:'',label:'New NXP commissioning'},
 {name:'Betaflight',board:'OMNIBUSF4 · STM32F405 · Cortex-M4',folder:'betaflight',css:'',label:'Prior STM32 baseline'}
];
const root=document.getElementById('results');root.replaceChildren();
for(const target of targets){
 const card=document.createElement('article');card.className='card '+target.css;root.append(card);
 const add=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;card.append(el);return el};
 add('p',target.label,'eyebrow');add('h3',target.name);add('p',target.board,'caption');
 const url='../results/tilt-lead/fastdyn/'+target.folder+'/report.json';
 try{
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const r=await response.json();
  if(!Number.isFinite(r.tracking_rms_m)||!Number.isFinite(r.tracking_max_m))throw Error('Missing tracking measurements');
  add('div',r.tracking_rms_m.toFixed(3)+' m','metric');add('p','3D tracking RMS · course window','caption');
  const landed=r.grounded_stopped_samples>=4000&&r.final_armed===false&&r.final_motors?.length===4&&r.final_motors.every(v=>v===0)&&r.final_position?.[2]<0.11;
  const list=add('dl','');for(const [k,v] of [['Maximum error',r.tracking_max_m.toFixed(3)+' m'],['Reference lap',(r.lap_end_s-r.lap_start_s)+' s'],['Full simulated run',r.simulated_seconds+' s'],['Landing / disarm',landed?'Verified':'Not verified']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;list.append(dt,dd)}
  add('span',r.passed&&landed?'COMMISSIONING PASSED':'NOT QUALIFIED','status');
  const link=add('a','Read raw report ↗');link.href=url;link.style.display='block';link.style.marginTop='18px';
 }catch(error){add('p','Report unavailable: '+error.message+'. No substitute values are shown.','note')}
}

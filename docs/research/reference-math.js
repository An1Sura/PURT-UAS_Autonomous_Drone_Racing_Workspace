// Independent analytic checks of the saved Modelica reference; never used to fly firmware.
import {cross,dot,norm} from './metrics.js';
export function figureEight(t,T=33,width=10,height=10){
 if(!(T>0&&width>0&&height>0))throw Error('Positive duration and dimensions required');
 const u=Math.max(0,Math.min(1,t/T)),q=2*Math.PI*(10*u**3-15*u**4+6*u**5);
 const dq=2*Math.PI*30*u*u*(1-u)**2/T,ddq=2*Math.PI*60*u*(1-u)*(1-2*u)/T**2;
 const dddq=2*Math.PI*60*(1-6*u+6*u*u)/T**3,ddddq=2*Math.PI*360*(2*u-1)/T**4;
 const p=[width/2*Math.sin(q),height/2*Math.sin(2*q),2];
 const v=[width/2*Math.cos(q)*dq,height*Math.cos(2*q)*dq,0];
 const a=[width/2*(-Math.sin(q)*dq*dq+Math.cos(q)*ddq),height*(-2*Math.sin(2*q)*dq*dq+Math.cos(2*q)*ddq),0];
 const j=[width/2*(-Math.cos(q)*dq**3-3*Math.sin(q)*dq*ddq+Math.cos(q)*dddq),height*(-4*Math.cos(2*q)*dq**3-6*Math.sin(2*q)*dq*ddq+Math.cos(2*q)*dddq),0];
 const snap=[width/2*(Math.sin(q)*dq**4-6*Math.cos(q)*dq*dq*ddq-3*Math.sin(q)*ddq*ddq-4*Math.sin(q)*dq*dddq+Math.cos(q)*ddddq),height*(8*Math.sin(2*q)*dq**4-24*Math.cos(2*q)*dq*dq*ddq-6*Math.sin(2*q)*ddq*ddq-8*Math.sin(2*q)*dq*dddq+Math.cos(2*q)*ddddq),0];
 return {p,v,a,j,snap};
}
export function courseMetrics(T=33,width=10,height=10,n=20000){
 let length=0,peakSpeed=0,peakAcceleration=0,peakNormal=0,maxCurvature=0;
 let previous=figureEight(0,T,width,height).p;
 for(let i=0;i<=n;i++){
  const {p,v,a}=figureEight(i*T/n,T,width,height),speed=norm(v);
  length+=norm(p.map((x,k)=>x-previous[k]));previous=p;
  peakSpeed=Math.max(peakSpeed,speed);peakAcceleration=Math.max(peakAcceleration,norm(a));
  if(speed>1e-6){const curvature=norm(cross(v,a))/speed**3;maxCurvature=Math.max(maxCurvature,curvature);peakNormal=Math.max(peakNormal,norm(cross(v,a))/speed);}
 }
 return {duration_s:T,length_m:length,mean_speed_m_s:length/T,peak_speed_m_s:peakSpeed,peak_acceleration_m_s2:peakAcceleration,peak_normal_acceleration_m_s2:peakNormal,min_radius_m:1/maxCurvature};
}
const unit=v=>v.map(x=>x/norm(v));
export function desiredFrame(t,T){
 const r=figureEight(t,T),f=[r.a[0],r.a[1],r.a[2]+9.80665],z=unit(f),heading=[1,0,0];
 // Same heading-axis construction as Benchmarks.Feedforward: y = normalize(z × heading).
 const y=unit(cross(z,heading)),x=cross(y,z),h=r.j.map((a,i)=>(a-dot(z,r.j)*z[i])/norm(f));
 const p=-dot(h,y),q=dot(h,x),w=[p,q,p*dot(heading,z)/dot(heading,x)];
 return {x,y,z,w};
}
export function quatMultiply(a,b){return [a[0]*b[0]-dot(a.slice(1),b.slice(1)),a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];}
export function quatRotate(q,v){const a=quatMultiply(quatMultiply(q,[0,...v]),[q[0],-q[1],-q[2],-q[3]]);return a.slice(1);}
export function integratedOrientationError(T=33,dt=.005){
 let q=[1,0,0,0],maxAxisError=0,maxNormError=0;const n=Math.ceil(T/dt);dt=T/n;
 for(let i=0;i<n;i++){
  const w=desiredFrame((i+.5)*dt,T).w,theta=norm(w)*dt;
  const dq=theta<1e-14?[1,0,0,0]:[Math.cos(theta/2),...w.map(x=>x/norm(w)*Math.sin(theta/2))];
  q=quatMultiply(q,dq);maxNormError=Math.max(maxNormError,Math.abs(norm(q)-1));
  const target=desiredFrame((i+1)*dt,T);
  for(const [key,e] of [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]])maxAxisError=Math.max(maxAxisError,norm(quatRotate(q,e).map((v,k)=>v-target[key][k])));
 }
 return {step_s:dt,samples:n,max_axis_vector_error:maxAxisError,max_quaternion_norm_error:maxNormError};
}

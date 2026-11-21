import fs from 'node:fs';
import crypto from 'node:crypto';
import {figureEight,courseMetrics,integratedOrientationError,desiredFrame} from '../public/reference-math.js';
import {norm,dot} from '../public/metrics.js';
const checks=[];
function check(name,passed,detail,values={}){checks.push({name,passed,detail,values});}
const coarse=courseMetrics(33,10,10,10000),fine=courseMetrics(33,10,10,20000);
check('Reference geometry quadrature',Math.abs(coarse.length_m-fine.length_m)<1e-5,'Path length converges within 10 µm between 10,000 and 20,000 intervals.',{coarse:coarse.length_m,fine:fine.length_m});
let dv=0,da=0,dj=0,ds=0,orthogonal=0;
const h=1e-4;
for(let i=1;i<3300;i++){
 const t=i*.01,l=figureEight(t-h),m=figureEight(t),r=figureEight(t+h);
 for(let k=0;k<3;k++){
  dv=Math.max(dv,Math.abs((r.p[k]-l.p[k])/(2*h)-m.v[k]));
  da=Math.max(da,Math.abs((r.v[k]-l.v[k])/(2*h)-m.a[k]));
  dj=Math.max(dj,Math.abs((r.a[k]-l.a[k])/(2*h)-m.j[k]));
  ds=Math.max(ds,Math.abs((r.j[k]-l.j[k])/(2*h)-m.snap[k]));
 }
 const f=desiredFrame(t,33);orthogonal=Math.max(orthogonal,Math.abs(dot(f.x,f.y)),Math.abs(dot(f.y,f.z)),Math.abs(dot(f.z,f.x)),Math.abs(norm(f.x)-1),Math.abs(norm(f.y)-1),Math.abs(norm(f.z)-1));
}
check('Analytic derivatives through snap',Math.max(dv,da,dj,ds)<1e-6,'Centered finite differences at 3,299 interior times; each derivative residual below 10⁻⁶ in its own SI units.',{velocity_m_s:dv,acceleration_m_s2:da,jerk_m_s3:dj,snap_m_s4:ds});
check('Desired-frame orthonormality',orthogonal<1e-12,'Axes are unit length and mutually perpendicular throughout the trajectory.',{maximum_residual:orthogonal});
const q1=integratedOrientationError(33,.01),q2=integratedOrientationError(33,.005);
check('Quaternion integration and refinement',q2.max_axis_vector_error<1e-5&&q2.max_axis_vector_error<q1.max_axis_vector_error*.3&&q2.max_quaternion_norm_error<1e-10,'Midpoint body-rate exponential integration reproduces the analytic desired axes; halving the step reduces error by approximately four.',{coarse:q1,fine:q2});
const sized=courseMetrics(33,20,20),timed=courseMetrics(66);let scaleError=0;
for(const [a,b]of [[sized.length_m,2*fine.length_m],[sized.peak_speed_m_s,2*fine.peak_speed_m_s],[sized.peak_acceleration_m_s2,2*fine.peak_acceleration_m_s2],[timed.peak_speed_m_s,fine.peak_speed_m_s/2],[timed.peak_acceleration_m_s2,fine.peak_acceleration_m_s2/4]])scaleError=Math.max(scaleError,Math.abs(a-b));
check('Size and duration scaling',scaleError<1e-10,'Doubling size doubles distance/speed/acceleration; doubling duration halves speed and quarters acceleration.',{maximum_residual:scaleError});
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={date:'2026-11-20',scope:'Independent analytic and numerical audit; no firmware execution or formal proof',passed:checks.every(c=>c.passed),checks,course33:fine,sourceHashes:{analytic:sha('public/reference-math.js'),modelica:sha('public/data/sources/src/modelica_models/Benchmarks/Trajectory.mo')}};
fs.writeFileSync('public/data/math-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;

// Analyze recorded ground truth only. This does not run or modify a simulation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [dir] = process.argv.slice(2);
if (!dir) throw Error('Usage: node tools/summarize-flight.mjs FLIGHT_DIRECTORY');
const csv = fs.readFileSync(path.join(dir, 'trajectory.csv'), 'utf8');
const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
const lines = csv.trim().split('\n'), names = lines.shift().trim().split(',');
const required = ['time_s','x_m','y_m','z_m','ref_x','ref_y','ref_z','armed','m0','m1','m2','m3'];
if (required.some(k => !names.includes(k))) throw Error('Missing required trajectory columns');
const rows = lines.map(line => {
  const values = line.split(',').map(Number);
  if (values.length !== names.length || values.some(v => !Number.isFinite(v))) throw Error('Invalid sample');
  return Object.fromEntries(names.map((k,i) => [k,values[i]]));
});
if (rows.length < 2 || rows.some((r,i) => i && r.time_s <= rows[i-1].time_s)) throw Error('Nonmonotonic or empty recording');
const start = report.lap_start_s, end = report.lap_end_s;
if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Error('Missing measured-report course window');
const course = rows.filter(r => r.time_s >= start && r.time_s <= end);
if (course.length < 2 || Math.abs(course[0].time_s-start)>0.011 || Math.abs(course.at(-1).time_s-end)>0.011) throw Error('Incomplete course window');
let distance = 0, referenceDistance = 0, peakSpeed = 0, altitudeSquared = 0, altitudeMax = 0;
let maxZ = -Infinity, minZ = Infinity, saturated = 0;
for (let i=0;i<course.length;i++) {
  const r = course[i], dz = r.z_m-r.ref_z;
  altitudeSquared += dz*dz;
  altitudeMax = Math.max(altitudeMax, Math.abs(dz));
  maxZ = Math.max(maxZ,r.z_m); minZ = Math.min(minZ,r.z_m);
  if ([r.m0,r.m1,r.m2,r.m3].some(m => m >= 0.999 || m <= 0.001)) saturated++;
  if (i) {
    const p = course[i-1], dt = r.time_s-p.time_s;
    const ds = Math.hypot(r.x_m-p.x_m,r.y_m-p.y_m,r.z_m-p.z_m);
    distance += ds;
    referenceDistance += Math.hypot(r.ref_x-p.ref_x,r.ref_y-p.ref_y,r.ref_z-p.ref_z);
    peakSpeed = Math.max(peakSpeed,ds/dt);
  }
}
const final = rows.at(-1);
const result = {
  schema: 1, stack: report.stack, qualification: 'Recorded ground-truth summary; not hardware timing or a confirmed maximum speed',
  trajectory_sha256: crypto.createHash('sha256').update(csv).digest('hex'), hashes: report.hashes,
  course_window_s: [start,end], requested_lap_s: end-start,
  recorded_course_distance_m: distance, sampled_reference_distance_m: referenceDistance,
  recorded_mean_speed_m_s: distance/(end-start), recorded_peak_speed_m_s: peakSpeed,
  speed_method: 'Adjacent recorded position differences, normally 10 ms; sampled path length, not exact continuous arclength',
  course_altitude_rms_error_m: Math.sqrt(altitudeSquared/course.length), course_altitude_max_error_m: altitudeMax,
  course_altitude_range_m: [minZ,maxZ],
  course_motor_bound_sample_fraction: saturated/course.length,
  motor_bound_definition: 'Any recorded normalized command <=0.001 or >=0.999; 100 Hz samples can miss between-sample saturation',
  final_sample: {time_s:final.time_s,altitude_m:final.z_m,armed:final.armed,motors:[final.m0,final.m1,final.m2,final.m3]},
  report_passed: report.passed,
  unavailable: ['onboard estimator error','actual rate PID decomposition','physical driver latency','physical loop jitter'],
  tuning_note: 'Inherited parameters; this summary does not establish current ARM same-rule tuning qualification'
};
fs.writeFileSync(path.join(dir,'flight-summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

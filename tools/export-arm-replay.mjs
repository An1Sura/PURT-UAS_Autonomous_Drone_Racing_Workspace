// Export only completed measured flight data; does not execute or synthesize flights.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [dir, metadataPath] = process.argv.slice(2);
if (!dir || !metadataPath) throw Error('Usage: node tools/export-arm-replay.mjs FLIGHT_DIR METADATA_JSON');
const read = name => fs.readFileSync(path.join(dir,name),'utf8');
const report=JSON.parse(read('report.json')), config=JSON.parse(read('config.json'));
const metadata=JSON.parse(fs.readFileSync(metadataPath,'utf8'));
if(!Number.isFinite(metadata.recorded_at_unix_s)||!metadata.provenance?.board)throw Error('Missing recording time/board provenance');
if(!report.passed || report.final_armed!==false || report.final_motors?.length!==4 || !report.final_motors.every(v=>v===0) || report.final_position?.[2]>=0.11 || report.grounded_stopped_samples<4000)throw Error('Not a verified completed landing');
const csv=read('trajectory.csv'), lines=csv.trim().split('\n');
if(!lines.shift().startsWith('time_s,x_m,y_m,z_m,roll_rad,pitch_rad,yaw_rad,'))throw Error('Unexpected trajectory schema');
const rows=[];
for(const line of lines){const r=line.split(',').map(Number);if(r.length<16||r.some(v=>!Number.isFinite(v)))throw Error('Invalid trajectory sample');const previous=rows.at(-1);const dt=previous?r[0]-previous[0]:0;if(previous&&dt<=0)throw Error('Nonmonotonic timestamps');const speed=previous?Math.hypot(r[1]-previous[1],r[2]-previous[2],r[3]-previous[3])/dt:0;rows.push([...r.slice(0,7),speed]);}
if(Math.abs(rows.at(-1)[0]-report.simulated_seconds)>0.011)throw Error('Missing final sample');
const trajectory_sha256=crypto.createHash('sha256').update(csv).digest('hex');
const replay={config:config.course,passed:true,report,rows,stack:report.stack,...metadata,provenance:{...metadata.provenance,trajectory_sha256,display_speed:'10 ms finite difference of recorded ground-truth position; not physical sensor speed'}};
fs.writeFileSync(path.join(dir,'replay.json'),JSON.stringify(replay));
console.log(JSON.stringify({samples:rows.length,final_time:rows.at(-1)[0],trajectory_sha256}));

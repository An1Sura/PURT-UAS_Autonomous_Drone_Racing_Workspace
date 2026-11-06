// Decode retained guest DTCM from the exact c9530644... TROPIC ELF only.
// Post-termination output motors are zeroed by shutdown: intentionally omitted.
import fs from 'node:fs';
import crypto from 'node:crypto';
const [file,id]=process.argv.slice(2);
if(!file||!id)throw Error('Usage: node tools/summarize-bf-snapshot.mjs DTCM_FILE FLIGHT_ID');
const b=fs.readFileSync(file),base=0x1cd00;
if(b.length!==256*1024||b.readUInt32LE(base)!==0x42464431)throw Error('Not the pinned Betaflight DTCM layout');
const request=b.readUInt32LE(base+8),response=b.readUInt32LE(base+12),time=b.readBigUInt64LE(base+264);
if(b.readUInt32LE(base+4)!==4||request!==response||time!==BigInt(response)*125n)throw Error('Not a completed, terminated handshake');
const floats=(offset,n)=>Array.from({length:n},(_,i)=>b.readFloatLE(offset+4*i));
const pid=Object.fromEntries(['roll','pitch','yaw'].map((axis,i)=>[axis,Object.fromEntries(['P','I','D','F','S','Sum'].map((k,j)=>[k,b.readFloatLE(0x249d4+24*i+4*j)]))]));
console.log(JSON.stringify({
 qualification:'Retained post-termination memory snapshot, not an in-flight time series or physical timing measurement',
 flight_id:id,firmware_sha256:'c9530644680b907053022efa349bd0564701dd09ead526c862ac76d71755423f',
 dtcm_sha256:crypto.createHash('sha256').update(b).digest('hex'),stage:4,sequence:response,sim_time_s:Number(time)/1e6,
 filtered_body_gyro_deg_s:floats(0x24f14+28,3),rc_setpoint_deg_s:floats(0xe7d4,3),pid,
 simulated_scheduling:{gyro_sample_rate_hz:b.readUInt16LE(0x24f14),gyro_target_loop_us:b.readUInt32LE(0x24f14+4),gyro_sample_loop_us:b.readUInt32LE(0x24f14+8),target_pid_loop_us:b.readUInt32LE(0x24a1c),motor_updates:b.readUInt32LE(base+272),motor_updates_per_sim_second:b.readUInt32LE(base+272)/(Number(time)/1e6),qualification:'Configured periods and simulated counter totals; not physical execution speed or jitter'},
 raw_little_endian_hex:{pidData:b.subarray(0x249d4,0x249d4+72).toString('hex'),gyroADCf:b.subarray(0x24f14+28,0x24f14+40).toString('hex'),setpointRate:b.subarray(0xe7d4,0xe7d4+12).toString('hex')},
 limitation:'adrFastdynRun shutdown clears output motors and changes stage, but does not update PID/gyro state. Read motor end state from the independent flight report, not this post-termination output buffer. This snapshot does not establish the origin of integral growth.'
},null,2));

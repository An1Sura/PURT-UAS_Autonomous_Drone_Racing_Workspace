import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fixedProtocolStatus,memoryFootprint,memoryRegions,numbersData,baselinePair} from '../public/benchmark-guide.js';
import {figureEight} from '../public/reference-math.js';
import {armImage} from '../scripts/verify-firmware-rebuilds.mjs';
const app=new URL('../',import.meta.url),d=JSON.parse(fs.readFileSync(new URL('public/data/dataset.json',app)));
const archive=name=>new URL('public/data/matched-qualification/'+name,app).pathname;
test('Fixed-reference qualification passes without promoting broader project gates',()=>{
 assert.equal(fixedProtocolStatus(d).passed,true);assert.ok(d.gates.some(g=>g.status!=='passed'));
 for(const mutate of [x=>x.matchedQualification.runs.pop(),x=>x.matchedQualification.runs[0].landed=false,x=>x.matchedQualification.checks.pop(),x=>x.matchedQualification.coverage.complete=false,x=>x.matchedQualification.checks[0].passed=false]){const x=structuredClone(d);mutate(x);assert.equal(fixedProtocolStatus(x).passed,false);}
});
test('ELF allocation excludes holes and avoids counting overlapping mappings twice',()=>{
 const segment=(v,p,f,m)=>({virtualAddress:v,physicalAddress:p,fileBytes:f,memoryBytes:m});
 const m=memoryFootprint([segment(0x20000000,0x70000000,8,16),segment(0x20000008,0x70000004,4,16),segment(0,0x70000100,4,4)]);
 assert.equal(m.flashPayloadBytes,12);assert.equal(m.ramAllocatedBytes,28);
 assert.throws(()=>memoryFootprint([segment(0x30000000,0x70000000,4,4)]),/Unmapped/);
 assert.throws(()=>memoryFootprint([segment(0,0x30000000,4,4)]),/outside/);
 assert.throws(()=>memoryFootprint([segment(0,0x70000000,5,4)]),/Invalid/);
});
test('Memory allocations are verified against both frozen ELFs and archived board memory maps',()=>{
 for(const c of d.matchedQualification.firmwareRebuilds.checks){
  const bytes=execFileSync('tar',['-xOf',archive('qualification-source.tar'),'source/'+c.stack+'.elf'],{maxBuffer:50e6});
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.frozenElfSha256);
  const image=armImage(bytes);assert.equal(image.imageSha256,c.frozen.imageSha256);assert.deepEqual(memoryFootprint(image.segments),memoryFootprint(c.frozen.segments));
 }
 const map=execFileSync('tar',['-xOzf',archive('betaflight-source-rebuild.tar.gz'),'betaflight-source-rebuild/obj/betaflight_MIMXRT1064_MR_VMU_TROPIC.map'],{maxBuffer:30e6,encoding:'utf8'});
 const dts=execFileSync('tar',['-xOzf',archive('cognipilot-source-rebuild.tar.gz'),'arm-source-rebuild-env/cerebri_rdd2/zephyr/zephyr.dts'],{maxBuffer:10e6,encoding:'utf8'});
 for(const region of memoryRegions.filter(r=>r.kind==='ram')){const line=map.match(new RegExp('^'+region.name+'\\s+(0x[0-9a-f]+)\\s+(0x[0-9a-f]+)','m'));assert.ok(line);assert.equal(Number(line[1]),region.start);assert.equal(Number(line[2]),region.end-region.start);assert.ok(dts.includes('reg = < 0x'+region.start.toString(16)+' 0x'+(region.end-region.start).toString(16)+' >;'));}
 assert.match(map,/FLASH_CONFIG\s+0x703fe000\s+0x00002000/);assert.ok(dts.includes('reg = < 0x0 0x400000 >;'));
});
test('Racing numbers use paired current baselines and keep lead conditions separate',()=>{
 for(const mode of ['off','omega']){const x=numbersData(d,mode);assert.equal(x.runs.length,2);assert.deepEqual(x.runs.map(r=>r.stack),['cognipilot','betaflight']);for(const r of x.runs){assert.equal(r.mode,mode);assert.equal(r.phase,'baseline');assert.equal(r.config.course.lap_time_s,40);assert.equal(r.seed,1);assert.equal(r.noise,'realistic');assert.ok(r.score.verified);}for(const rs of x.realistic){assert.equal(rs.length,5);assert.ok(rs.every(r=>r.mode===mode));}assert.ok(x.repeats.every(rs=>rs.length===30));}
 assert.throws(()=>baselinePair(d,'choose-best-per-stack'),/Unknown/);
});
test('Reference demand uses course geometry and duration, with the expected time scaling',()=>{
 const x=numbersData(d);assert.ok(Math.abs(x.reference.length_m-d.mathAudit.course33.length_m)<1e-8);assert.ok(Math.abs(x.reference.peak_speed_m_s/d.mathAudit.course33.peak_speed_m_s-33/40)<1e-10);assert.ok(Math.abs(x.reference.peak_normal_acceleration_m_s2/d.mathAudit.course33.peak_normal_acceleration_m_s2-(33/40)**2)<1e-10);
 // The saved reference is held at 100 Hz; allow up to one held-reference interval.
 for(const r of x.runs)for(const sample of r.telemetry.filter(s=>s.time_s>=25&&s.time_s<=65)){const p=figureEight(sample.time_s-25,40,10,10).p;assert.ok(Math.hypot(p[0]-sample.ref_x,p[1]-sample.ref_y)<x.reference.peak_speed_m_s*.01001);}
});

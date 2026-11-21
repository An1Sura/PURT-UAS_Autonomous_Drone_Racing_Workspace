import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceClaims, evidenceManifest, chartEvidence, flightRecordsHTML} from '../public/evidence-links.js';
import {nav} from '../public/content.js';
const d=JSON.parse(fs.readFileSync(new URL('../public/data/dataset.json',import.meta.url)));
const read=id=>JSON.parse(fs.readFileSync(new URL('../public/'+d.evidence[id].path,import.meta.url)));

test('Every section has scoped evidence and every claim resolves to an identified artifact',()=>{
  const m=evidenceManifest(d);
  for(const [section] of nav.filter(([id])=>id!=='references'))assert.ok(m.claims.some(c=>c.sections.includes(section)),section);
  for(const c of m.claims){assert.ok(c.method&&c.limits&&c.kind,c.id);assert.ok(c.sources.length);for(const s of c.sources){assert.ok(s.locator);assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.path.startsWith('data/'));}}
  const missing=structuredClone(d);delete missing.evidence['matched-protocol'];assert.throws(()=>evidenceManifest(missing),/Missing evidence/);
});
test('Completion claims agree with original flight reports rather than a hardcoded pass count',()=>{
  const claims=evidenceClaims(d),c=claims.find(c=>c.id==='completion');
  const reports=d.matchedQualification.runs.map(r=>read(r.id+'-report.json'));
  assert.equal(c.value.attempts,reports.length);
  assert.equal(c.value.passed,reports.filter(r=>r.passed).length);
  assert.equal(c.value.landed,reports.filter(r=>r.final_armed===false&&r.final_motors.every(m=>m===0)&&r.grounded_stopped_samples>=4000).length);
  const incomplete=structuredClone(d);incomplete.matchedQualification.runs.pop();
  assert.equal(evidenceClaims(incomplete)[0].value.attempts,reports.length-1);
});
test('Graph provenance covers each rendered chart family without substituting historical traces',()=>{
  const ids=['sweep-chart',...Array.from({length:4},(_,i)=>'fresh-probe-'+i),'fresh-position-step','fresh-hover','fresh-square',...['off','omega'].flatMap(mode=>['path','error','altitude'].map(t=>'fresh-'+t+'-'+mode)),...['chart','compare'].flatMap(p=>['attitude-step','rate-step','position-step'].map(t=>p+'-'+t)),...['xy','altitude','error','error-x','error-y','error-z','speed','acceleration','roll','pitch','yaw','command-roll','command-pitch','lead-roll','lead-pitch','omega-ff-roll','omega-ff-pitch','motors-cg','motors-bf'].map(t=>'chart-'+t)];
  for(const id of ids){const p=chartEvidence(d,id);const m=evidenceManifest(d,[{id,...p}]);assert.ok(m.claims[0].sources.length);assert.ok(p.method);if(id.startsWith('fresh-')){assert.match(p.family,/November 20/);assert.ok(p.sources.some(s=>s.id.endsWith('-input-config')));}else assert.doesNotMatch(p.family,/November 20/);}
  assert.throws(()=>chartEvidence(d,'new-unmapped-graph'),/Missing chart evidence/);
});
test('Assumptions and unsupported hardware inference remain explicitly separated',()=>{
  const claims=evidenceClaims(d);assert.equal(claims.find(c=>c.id==='vehicle').kind,'Model assumptions');
  assert.match(claims.find(c=>c.id==='matching').limits,/not measured physical execution time/);
  assert.match(claims.find(c=>c.id==='mathematics').limits,/not a proof/);
  assert.match(claims.find(c=>c.id==='historical').limits,/separate/);
  assert.match(claims.find(c=>c.id==='tuning').limits,/have not been completed/);
});
test('All matched attempts expose original configurations and raw per-flight evidence',()=>{
  const html=flightRecordsHTML(d);
  for(const r of d.matchedQualification.runs){for(const id of [...r.evidence,r.id+'-input-config'])assert.ok(html.includes('data-evidence="'+id+'"'),id);}
});

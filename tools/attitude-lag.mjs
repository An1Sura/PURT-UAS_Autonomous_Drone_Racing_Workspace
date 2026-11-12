// Analyze recorded flights only. This does not run or modify a simulation.
// Fits actual roll/pitch ~ gain * commanded tilt(t - delay) over each lap window,
// using flights extracted from the raw-data-nov-20261110 release
// (flight-campaigns.tar.gz). Usage:
//   node tools/attitude-lag.mjs <extracted>/artifacts <lap_s> > docs/results/arm-speed/attitude-lag-33s.json
import fs from 'node:fs';
import path from 'node:path';

const [root, lapArg] = process.argv.slice(2);
if (!root || !lapArg) throw Error('Usage: node tools/attitude-lag.mjs ARTIFACTS_DIR LAP_SECONDS');
const lap = Number(lapArg);
const campaigns = {
  betaflight: 'arm-speed-bf-omega-20261106',
  cognipilot: 'arm-speed-cognipilot-hardened-20261106',
};

function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const head = lines[0].split(',');
  const cols = Object.fromEntries(head.map((h) => [h, new Float64Array(lines.length - 1)]));
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(',');
    for (let j = 0; j < head.length; j++) cols[head[j]][i - 1] = Number(v[j]);
  }
  return cols;
}

// Commands are held between stick updates, so use the last sample at or before t.
function held(ts, vs, t) {
  if (t < ts[0]) return vs[0];
  let lo = 0, hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return vs[lo];
}

const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const deg = (r) => +(r * 180 / Math.PI).toFixed(3);
const delays = [];
for (let d = -100; d <= 600; d += 2) delays.push(d / 1000);

function fitDelay(t, actual, cmdT, cmd) {
  let best = null;
  for (const d of delays) {
    const x = t.map((ti) => held(cmdT, cmd, ti - d));
    let sxy = 0, sxx = 0;
    for (let i = 0; i < t.length; i++) { sxy += x[i] * actual[i]; sxx += x[i] * x[i]; }
    const g = sxy / sxx;
    const r = rms(t.map((_, i) => actual[i] - g * x[i]));
    if (!best || r < best.resid) best = { delay_ms: Math.round(d * 1000), gain: +g.toFixed(4), resid: r };
  }
  return { delay_ms: best.delay_ms, gain: best.gain, residual_deg: deg(best.resid) };
}

const flights = [];
for (const [stack, dir] of Object.entries(campaigns)) {
  const base = path.join(root, dir);
  const pattern = new RegExp(`^(confirm|refine|off)-${lap}(-|$)`);
  for (const id of fs.readdirSync(base).filter((n) => pattern.test(n) && !/-(ram|runtime)$/.test(n)).sort()) {
    const run = path.join(base, id);
    if (!fs.existsSync(path.join(run, 'tilt-lead.csv'))) continue;
    const rep = JSON.parse(fs.readFileSync(path.join(run, 'report.json'), 'utf8'));
    const tl = readCsv(path.join(run, 'tilt-lead.csv'));
    const tr = readCsv(path.join(run, 'trajectory.csv'));
    const idx = [];
    for (let i = 0; i < tr.time_s.length; i++) if (tr.time_s[i] >= rep.lap_start_s && tr.time_s[i] <= rep.lap_end_s) idx.push(i);
    const t = idx.map((i) => tr.time_s[i]);
    const posErr = idx.map((i) => Math.hypot(tr.x_m[i] - tr.ref_x[i], tr.y_m[i] - tr.ref_y[i], tr.z_m[i] - tr.ref_z[i]));
    const axes = {};
    for (const ax of ['roll', 'pitch']) {
      const act = idx.map((i) => tr[`${ax}_rad`][i]);
      const cmd = tl[`command_${ax}_rad`], ref = tl[`reference_${ax}_rad`];
      axes[ax] = {
        command_to_actual: fitDelay(t, act, tl.time_s, cmd),
        reference_to_actual: fitDelay(t, act, tl.time_s, ref),
        tilt_error_vs_reference_rms_deg: deg(rms(t.map((ti, k) => act[k] - held(tl.time_s, ref, ti)))),
      };
    }
    flights.push({
      stack, campaign: dir, id, lead: rep.sensor_profile.feedforward, noise: rep.sensor_profile.level, seed: rep.sensor_profile.seed,
      report_passed: rep.passed, report_tracking_rms_m: rep.tracking_rms_m, report_tracking_max_m: rep.tracking_max_m,
      recomputed_max_m: +Math.max(...posErr).toFixed(6), samples: t.length, runner_sha256: rep.hashes.runner, firmware_sha256: rep.hashes.firmware, axes,
    });
  }
}

const range = (xs) => [Math.min(...xs), Math.max(...xs)];
const summary = [];
for (const stack of Object.keys(campaigns)) for (const lead of ['omega', 'off']) {
  const f = flights.filter((x) => x.stack === stack && x.lead === lead);
  if (!f.length) continue;
  const pick = (ax, kind) => f.map((x) => x.axes[ax][kind].delay_ms);
  summary.push({
    stack, lead, flights: f.length,
    command_to_actual_delay_ms: { roll: range(pick('roll', 'command_to_actual')), pitch: range(pick('pitch', 'command_to_actual')) },
    reference_to_actual_delay_ms: { roll: range(pick('roll', 'reference_to_actual')), pitch: range(pick('pitch', 'reference_to_actual')) },
    command_gain: range(f.flatMap((x) => [x.axes.roll.command_to_actual.gain, x.axes.pitch.command_to_actual.gain])),
    roll_fit_residual_deg: range(f.map((x) => x.axes.roll.command_to_actual.residual_deg)),
    tracking_max_m: range(f.map((x) => x.report_tracking_max_m)),
  });
}

// Matched noise/seed confirmation pairs (lead on): Betaflight minus CogniPilot maximum error.
const matched = [];
for (const bf of flights.filter((x) => x.stack === 'betaflight' && x.id.startsWith('confirm-'))) {
  const cg = flights.find((x) => x.stack === 'cognipilot' && x.id === bf.id);
  if (cg) matched.push({ id: bf.id, betaflight_max_m: bf.report_tracking_max_m, cognipilot_max_m: cg.report_tracking_max_m, difference_m: +(bf.report_tracking_max_m - cg.report_tracking_max_m).toFixed(6) });
}

console.log(JSON.stringify({
  qualification: 'Analysis of recorded simulation trajectories only. Pure delay plus gain is an aggregate fit of the whole attitude path; it does not separate estimator, filters or rate control and makes no hardware timing claim. Euler roll/pitch are compared with commanded tilt, an approximation near 14 degrees of tilt.',
  method: `Lap window from each report. Actual attitude at 100 Hz; commanded and reference tilt at 250 Hz, held between updates. Delay searched from -100 to 600 ms in 2 ms steps; least-squares gain per delay; minimum residual selected. Effective resolution is about 4 ms (stick period).`,
  source: { release: 'raw-data-nov-20261110', asset: 'flight-campaigns.tar.gz', asset_sha256: 'b95b5f33e1c990b320272c23308ff0e50d15862be1a79a71a67a351bbb6ee593', tool: 'tools/attitude-lag.mjs' },
  lap_s: lap, note_on_rms: 'Recomputed maximum error equals each report exactly; this tool does not restate RMS. Use report values.',
  summary, matched_pairs: matched, flights,
}, null, 1));

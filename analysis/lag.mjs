// One-off analysis: commanded tilt -> actual tilt delay/gain for recorded 33 s flights.
// Usage: node lag.mjs <artifacts-dir> > out.json
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
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

// Zero-order hold: last sample at or before t (commands are held between stick updates).
function zoh(ts, vs, t) {
  let lo = 0, hi = ts.length - 1;
  if (t < ts[0]) return vs[0];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return vs[lo];
}

const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);

function fitDelay(t, actual, cmdT, cmd, delays) {
  // For each delay, least-squares gain g in actual ~ g * cmd(t - d); pick min residual.
  let best = null;
  for (const d of delays) {
    let sxy = 0, sxx = 0;
    const x = new Float64Array(t.length);
    for (let i = 0; i < t.length; i++) { x[i] = zoh(cmdT, cmd, t[i] - d); sxy += x[i] * actual[i]; sxx += x[i] * x[i]; }
    const g = sxy / sxx;
    let r = 0;
    for (let i = 0; i < t.length; i++) { const e = actual[i] - g * x[i]; r += e * e; }
    r = Math.sqrt(r / t.length);
    if (!best || r < best.resid) best = { delay_ms: Math.round(d * 1000), gain: g, resid: r };
  }
  return best;
}

const delays = [];
for (let d = -0.1; d <= 0.6 + 1e-9; d += 0.002) delays.push(Number(d.toFixed(3)));

const out = [];
for (const [stack, dir] of Object.entries(campaigns)) {
  const base = path.join(root, dir);
  for (const id of fs.readdirSync(base).filter((n) => /^(confirm|refine|off)-33(-|$)/.test(n) && !/-(ram|runtime)$/.test(n)).sort()) {
    const run = path.join(base, id);
    if (!fs.existsSync(path.join(run, 'tilt-lead.csv'))) continue;
    const rep = JSON.parse(fs.readFileSync(path.join(run, 'report.json'), 'utf8'));
    const tl = readCsv(path.join(run, 'tilt-lead.csv'));
    const tr = readCsv(path.join(run, 'trajectory.csv'));
    const [t0, t1] = [rep.lap_start_s, rep.lap_end_s];
    const idx = [];
    for (let i = 0; i < tr.time_s.length; i++) if (tr.time_s[i] >= t0 && tr.time_s[i] <= t1) idx.push(i);
    const t = idx.map((i) => tr.time_s[i]);
    const act = { roll: idx.map((i) => tr.roll_rad[i]), pitch: idx.map((i) => tr.pitch_rad[i]) };
    const posErr = idx.map((i) => Math.hypot(tr.x_m[i] - tr.ref_x[i], tr.y_m[i] - tr.ref_y[i], tr.z_m[i] - tr.ref_z[i]));
    const res = { stack, id, lead: rep.sensor_profile.feedforward, noise: rep.sensor_profile.level, seed: rep.sensor_profile.seed,
      passed: rep.passed, report_rms_m: rep.tracking_rms_m, report_max_m: rep.tracking_max_m,
      check_pos_rms_m: rms(posErr), check_pos_max_m: Math.max(...posErr), samples: t.length, axes: {} };
    for (const ax of ['roll', 'pitch']) {
      const cmd = tl[`command_${ax}_rad`], ref = tl[`reference_${ax}_rad`];
      const fitCmd = fitDelay(t, act[ax], tl.time_s, cmd, delays);
      const fitRef = fitDelay(t, act[ax], tl.time_s, ref, delays);
      const errRef = t.map((ti, k) => act[ax][k] - zoh(tl.time_s, ref, ti));
      const errCmd = t.map((ti, k) => act[ax][k] - zoh(tl.time_s, cmd, ti));
      res.axes[ax] = {
        cmd_delay_ms: fitCmd.delay_ms, cmd_gain: +fitCmd.gain.toFixed(4), cmd_resid_deg: +(fitCmd.resid * 180 / Math.PI).toFixed(3),
        ref_delay_ms: fitRef.delay_ms, ref_gain: +fitRef.gain.toFixed(4), ref_resid_deg: +(fitRef.resid * 180 / Math.PI).toFixed(3),
        tilt_err_vs_ref_rms_deg: +(rms(errRef) * 180 / Math.PI).toFixed(3),
        tilt_err_vs_cmd_rms_deg: +(rms(errCmd) * 180 / Math.PI).toFixed(3),
        actual_rms_deg: +(rms(act[ax]) * 180 / Math.PI).toFixed(3),
      };
    }
    out.push(res);
  }
}
console.log(JSON.stringify(out, null, 1));

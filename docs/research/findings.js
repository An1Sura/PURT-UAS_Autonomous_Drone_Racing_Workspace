// Speed comparison under docs/results/arm-speed/speed-rule.json, computed from report files.
// Shows nothing it cannot compute; a missing file leaves an explicit message.
const base = '../results/arm-speed/';
const status = document.getElementById('findings-status');
const RMS = 0.35, MAX = 0.75;

const get = async (path) => {
  const r = await fetch(base + path, { cache: 'no-store' });
  if (!r.ok) throw Error(path + ': HTTP ' + r.status);
  return r.json();
};
const tracked = (a) => a.report.tracking_rms_m < RMS && a.report.tracking_max_m < MAX && a.report.tilt_clamp_updates === 0 && a.geometry?.passed === true;
const landed = (r) => r.final_armed === false && r.final_motors?.length === 4 && r.final_motors.every((v) => v === 0) && r.grounded_stopped_samples > 0;
const lapOf = (a) => a.config.course.lap_time_s;

function confirmations(attempts) {
  const sets = new Map();
  for (const a of attempts.filter((x) => x.id.startsWith('confirm-') && x.report.sensor_profile.feedforward === 'omega')) {
    if (!sets.has(lapOf(a))) sets.set(lapOf(a), []);
    sets.get(lapOf(a)).push(a);
  }
  return [...sets].sort((p, q) => p[0] - q[0]).map(([lap, runs]) => ({
    lap, runs: runs.length, tracked: runs.filter(tracked).length, landed: runs.filter((a) => landed(a.report)).length,
    worst: Math.max(...runs.map((a) => a.report.tracking_max_m)),
    complete: runs.length === 15 && new Set(runs.map((a) => a.report.sensor_profile.level + '|' + a.report.sensor_profile.seed)).size === 15,
  }));
}
const shortest = (sets) => sets.find((s) => s.complete && s.tracked === 15) || null;

function el(tag, text, cls, parent) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  if (parent) parent.append(e);
  return e;
}
function table(parent, head, rows) {
  const wrap = el('div', undefined, 'table-wrap', parent);
  const t = el('table', undefined, undefined, wrap);
  const tr = el('tr', undefined, undefined, el('thead', undefined, undefined, t));
  for (const h of head) el('th', h, undefined, tr);
  const tb = el('tbody', undefined, undefined, t);
  for (const r of rows) { const row = el('tr', undefined, undefined, tb); for (const c of r) el('td', c, undefined, row); }
}
const span = (r, f = (v) => String(v)) => (r[0] === r[1] ? f(r[0]) : f(r[0]) + '–' + f(r[1]));

try {
  const [bfAttempts, cgSummary, lag, pwm, pwmRead, oneshot, oneRead] = await Promise.all([
    get('betaflight-attempts.json'), get('cognipilot-summary.json'), get('attitude-lag-33s.json'),
    get('betaflight-pwm-paired-35s/report.json'), get('betaflight-pwm-paired-35s/readback.json'),
    get('betaflight-oneshot35/report.json'), get('betaflight-oneshot35/readback.json'),
  ]);
  const stacks = [
    { name: 'Betaflight', css: '', sets: confirmations(bfAttempts), all: bfAttempts },
    { name: 'CogniPilot', css: 'cg', sets: confirmations(cgSummary.runs), all: cgSummary.runs },
  ];
  for (const s of stacks) s.best = shortest(s.sets);
  if (!stacks.every((s) => s.best)) throw Error('a stack has no complete tracking confirmation');

  const cards = document.getElementById('findings-cards');
  cards.replaceChildren();
  for (const s of stacks) {
    const card = el('article', undefined, 'card ' + s.css, cards);
    el('p', 'Tilt lead on · TROPIC ARM', 'eyebrow', card);
    el('h3', s.name, undefined, card);
    el('div', s.best.lap + ' s', 'metric', card);
    el('p', 'Shortest lap passing tracking on 15/15', 'caption', card);
    const shorter = s.sets.filter((x) => x.lap < s.best.lap).map((x) => x.lap + ' s: ' + x.tracked + '/' + x.runs);
    const single = s.all.filter((a) => !a.id.startsWith('confirm-') && lapOf(a) === s.best.lap - 1 && a.report.sensor_profile.feedforward === 'omega');
    const below = shorter.length ? shorter.join(', ') : single.map((a) => (s.best.lap - 1) + ' s: one flight at ' + a.report.tracking_max_m.toFixed(3) + ' m').join(', ');
    const dl = el('dl', undefined, undefined, card);
    for (const [k, v] of [['Worst maximum error', s.best.worst.toFixed(3) + ' m'], ['Margin to 0.75 m', ((MAX - s.best.worst) * 1000).toFixed(0) + ' mm'], ['Next shorter lap', below || 'not flown'], ['Landed at that lap', s.best.landed + ' / 15']]) {
      el('dt', k, undefined, dl); el('dd', v, undefined, dl);
    }
  }
  const tie = stacks[0].best.lap === stacks[1].best.lap;
  const verdict = el('article', undefined, 'card', cards);
  el('p', 'Verdict under the committed rule', 'eyebrow', verdict);
  el('h3', tie ? 'Tie' : (stacks[0].best.lap < stacks[1].best.lap ? 'Betaflight' : 'CogniPilot') + ' shorter', undefined, verdict);
  const diffs = lag.matched_pairs.map((p) => p.difference_m);
  const distinct = new Set(lag.matched_pairs.map((p) => p.id.startsWith('confirm-' + lag.lap_s + '-none') ? 'none' : p.id)).size;
  el('p', tie ? 'Indistinguishable at 1 s resolution with tilt lead on.' : '', undefined, verdict);
  el('p', `In ${distinct} distinct matched flights at ${lag.lap_s} s, CogniPilot's maximum error was ${(Math.min(...diffs) * 1000).toFixed(0)}–${(Math.max(...diffs) * 1000).toFixed(0)} mm lower. That is a measured margin, not a faster lap.`, 'caption', verdict);
  el('span', 'LEAD-OFF CELLS NOT YET FLOWN', 'status pending', verdict);

  const lagBox = document.getElementById('findings-lag');
  lagBox.replaceChildren();
  table(lagBox, ['Stack, lead', 'Flights', 'Command → attitude delay, roll / pitch', 'Delay left after lead, roll / pitch', 'Gain', 'Maximum error'],
    lag.summary.map((g) => [
      (g.stack === 'betaflight' ? 'Betaflight' : 'CogniPilot') + ', lead ' + (g.lead === 'omega' ? 'on' : 'off'), String(g.flights),
      span(g.command_to_actual_delay_ms.roll) + ' / ' + span(g.command_to_actual_delay_ms.pitch) + ' ms',
      g.lead === 'off' ? 'no lead applied' : span(g.reference_to_actual_delay_ms.roll) + ' / ' + span(g.reference_to_actual_delay_ms.pitch) + ' ms',
      span(g.command_gain, (v) => v.toFixed(3)), span(g.tracking_max_m, (v) => v.toFixed(3)) + ' m',
    ]));

  const protoBox = document.getElementById('findings-protocol');
  protoBox.replaceChildren();
  table(protoBox, ['Betaflight motor protocol', 'PID period read back', 'Motor updates / simulated s', 'RMS / maximum', 'Landing'],
    [['PWM', pwm, pwmRead], ['OneShot125', oneshot, oneRead]].map(([n, r, rb]) => [
      n, rb.simulated_scheduling.target_pid_loop_us + ' µs', String(rb.simulated_scheduling.motor_updates_per_sim_second),
      r.tracking_rms_m.toFixed(3) + ' / ' + r.tracking_max_m.toFixed(3) + ' m', landed(r) ? 'Verified' : 'Not verified (armed at ' + r.final_position[2].toFixed(2) + ' m)',
    ]));
  const same = ['firmware', 'plant', 'offboard', 'runner'].every((k) => pwm.hashes[k] === oneshot.hashes[k]);
  el('p', same ? 'Both flights share firmware, plant, offboard-library and runner hashes; the configuration differs only in motor protocol.' : 'Warning: these two flights do not share all hashes.', 'note', protoBox);

  status.textContent = 'Computed from report files on load. Rule: speed-rule.json. No hardware timing claim.';
} catch (error) {
  status.textContent = 'Findings unavailable: ' + error.message + '. No substitute values are shown.';
}

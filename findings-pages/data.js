// Values copied from the repository and rounded to the places shown:
//   Betaflight: docs/results/arm-speed/betaflight-attempts.json (66 flights, runner 7c9ade, PWM)
//   CogniPilot: docs/results/arm-speed/cognipilot-summary.json (42 flights, runner f2ef29)
//   Attitude lag: docs/results/arm-speed/attitude-lag-33s.json (tools/attitude-lag.mjs)
//   Protocol pair: docs/results/arm-speed/betaflight-pwm-paired-35s and betaflight-oneshot35
// Each row is [typical error, maximum error, peak tilt]. Every flight on both stacks had
// zero tilt clamps and passed the course-geometry check. "landed" is false only where the
// report ended with the drone still armed; null means not scored.

const RMS_LIMIT = 0.35;
const MAX_LIMIT = 0.75;
const DATA_DATE = "2026-11-12";

const CONFIRM = {
  33: { none: [0.2893, 0.7312, 14.17], realistic: [[0.2889, 0.7282, 14.17], [0.2887, 0.7289, 14.17], [0.2887, 0.7295, 14.17], [0.2889, 0.7283, 14.14], [0.2890, 0.7284, 14.14]], harsh: [[0.2876, 0.7291, 14.18], [0.2882, 0.7280, 14.15], [0.2874, 0.7329, 14.18], [0.2884, 0.7255, 14.15], [0.2891, 0.7236, 14.13]], landFail: [2, 3] },
  34: { none: [0.2718, 0.6887, 13.48], realistic: [[0.2716, 0.6895, 13.47], [0.2721, 0.6899, 13.48], [0.2715, 0.6895, 13.46], [0.2716, 0.6885, 13.46], [0.2718, 0.6871, 13.47]], harsh: [[0.2704, 0.6898, 13.50], [0.2705, 0.6881, 13.46], [0.2705, 0.6938, 13.47], [0.2707, 0.6861, 13.46], [0.2728, 0.6846, 13.46]], landFail: [2, 5] },
  35: { none: [0.2561, 0.6526, 12.82], realistic: [[0.2560, 0.6520, 12.83], [0.2557, 0.6513, 12.83], [0.2558, 0.6536, 12.82], [0.2555, 0.6512, 12.80], [0.2562, 0.6526, 12.78]], harsh: [[0.2545, 0.6529, 12.84], [0.2547, 0.6515, 12.82], [0.2553, 0.6572, 12.80], [0.2548, 0.6505, 12.80], [0.2571, 0.6478, 12.80]], landFail: [2] },
  40: { none: [0.1946, 0.5071, 10.15], realistic: [[0.1946, 0.5053, 10.13], [0.1943, 0.5038, 10.13], [0.1950, 0.5076, 10.12], [0.1942, 0.5032, 10.14], [0.1949, 0.5034, 10.13]], harsh: [[0.1952, 0.5121, 10.10], [0.1945, 0.5072, 10.13], [0.1987, 0.5158, 10.14], [0.1943, 0.5065, 10.15], [0.1969, 0.5013, 10.10]], landFail: [3] }
};

function row(stack, id, lap, noise, seed, values, phase, lead, landed) {
  return { stack, id, lap, noise, seed, rms: values[0], max: values[1], tilt: values[2], phase, lead, landed };
}
const bf = (id, lap, noise, seed, values, phase, landed) => row("bf", id, lap, noise, seed, values, phase, "on", landed);
const cp = (id, lap, noise, seed, values, phase, lead, landed) => row("cp", id, lap, noise, seed, values, phase, lead, landed);

const BETAFLIGHT = [
  bf("coarse-40", 40, "realistic", 1, [0.1946, 0.5053, 10.13], "search", true),
  bf("coarse-35", 35, "realistic", 1, [0.2560, 0.6520, 12.83], "search", true),
  bf("coarse-30", 30, "realistic", 1, [0.3507, 0.8675, 16.57], "search", null),
  bf("refine-34", 34, "realistic", 1, [0.2716, 0.6895, 13.47], "search", true),
  bf("refine-33", 33, "realistic", 1, [0.2889, 0.7282, 14.17], "search", true),
  bf("refine-32", 32, "realistic", 1, [0.3076, 0.7714, 14.91], "search", null)
];
for (const lap of [33, 34, 35, 40]) {
  const set = CONFIRM[lap];
  for (let seed = 1; seed <= 5; seed += 1) BETAFLIGHT.push(bf(`confirm-${lap}-none-${seed}`, lap, "none", seed, set.none, "confirm", true));
  set.realistic.forEach((v, i) => BETAFLIGHT.push(bf(`confirm-${lap}-realistic-${i + 1}`, lap, "realistic", i + 1, v, "confirm", true)));
  set.harsh.forEach((v, i) => BETAFLIGHT.push(bf(`confirm-${lap}-harsh-${i + 1}`, lap, "harsh", i + 1, v, "confirm", !set.landFail.includes(i + 1))));
}

// Generated from cognipilot-summary.json with jq; exact report values, rounded.
const COGNIPILOT = [
  cp("coarse-40", 40, "realistic", 1, [0.1942, 0.4959, 10.16], "search", "on", true),
  cp("coarse-35", 35, "realistic", 1, [0.2517, 0.638, 12.88], "search", "on", true),
  cp("coarse-30", 30, "realistic", 1, [0.3416, 0.8405, 16.68], "search", "on", true),
  cp("refine-34", 34, "realistic", 1, [0.2661, 0.6728, 13.53], "search", "on", true),
  cp("refine-33", 33, "realistic", 1, [0.2825, 0.7094, 14.25], "search", "on", true),
  cp("refine-32", 32, "realistic", 1, [0.3003, 0.7495, 14.99], "search", "on", true),
  cp("refine-31", 31, "realistic", 1, [0.3201, 0.7939, 15.81], "search", "on", true),
  cp("confirm-32-none-1", 32, "none", 1, [0.2996, 0.7519, 15.03], "confirm", "on", true),
  cp("confirm-32-none-2", 32, "none", 2, [0.2996, 0.7519, 15.03], "confirm", "on", true),
  cp("confirm-32-none-3", 32, "none", 3, [0.2996, 0.7519, 15.03], "confirm", "on", true),
  cp("confirm-32-none-4", 32, "none", 4, [0.2996, 0.7519, 15.03], "confirm", "on", true),
  cp("confirm-32-none-5", 32, "none", 5, [0.2996, 0.7519, 15.03], "confirm", "on", true),
  cp("confirm-32-realistic-1", 32, "realistic", 1, [0.3003, 0.7495, 14.99], "confirm", "on", true),
  cp("confirm-32-realistic-2", 32, "realistic", 2, [0.3008, 0.7522, 15.01], "confirm", "on", true),
  cp("confirm-32-realistic-3", 32, "realistic", 3, [0.3007, 0.7522, 15.01], "confirm", "on", true),
  cp("confirm-32-realistic-4", 32, "realistic", 4, [0.3005, 0.7521, 14.99], "confirm", "on", true),
  cp("confirm-32-realistic-5", 32, "realistic", 5, [0.301, 0.7549, 15.01], "confirm", "on", true),
  cp("confirm-32-harsh-1", 32, "harsh", 1, [0.2991, 0.7424, 14.98], "confirm", "on", true),
  cp("confirm-32-harsh-2", 32, "harsh", 2, [0.3014, 0.7568, 15.01], "confirm", "on", true),
  cp("confirm-32-harsh-3", 32, "harsh", 3, [0.3015, 0.7525, 14.99], "confirm", "on", true),
  cp("confirm-32-harsh-4", 32, "harsh", 4, [0.3005, 0.7518, 15.01], "confirm", "on", true),
  cp("confirm-32-harsh-5", 32, "harsh", 5, [0.3008, 0.7562, 15.02], "confirm", "on", true),
  cp("confirm-33-none-1", 33, "none", 1, [0.2815, 0.7112, 14.27], "confirm", "on", true),
  cp("confirm-33-none-2", 33, "none", 2, [0.2815, 0.7112, 14.27], "confirm", "on", true),
  cp("confirm-33-none-3", 33, "none", 3, [0.2815, 0.7112, 14.27], "confirm", "on", true),
  cp("confirm-33-none-4", 33, "none", 4, [0.2815, 0.7112, 14.27], "confirm", "on", true),
  cp("confirm-33-none-5", 33, "none", 5, [0.2815, 0.7112, 14.27], "confirm", "on", true),
  cp("confirm-33-realistic-1", 33, "realistic", 1, [0.2825, 0.7094, 14.25], "confirm", "on", true),
  cp("confirm-33-realistic-2", 33, "realistic", 2, [0.2832, 0.7129, 14.23], "confirm", "on", true),
  cp("confirm-33-realistic-3", 33, "realistic", 3, [0.2832, 0.7126, 14.25], "confirm", "on", true),
  cp("confirm-33-realistic-4", 33, "realistic", 4, [0.2832, 0.7123, 14.25], "confirm", "on", true),
  cp("confirm-33-realistic-5", 33, "realistic", 5, [0.2829, 0.7137, 14.24], "confirm", "on", true),
  cp("confirm-33-harsh-1", 33, "harsh", 1, [0.2814, 0.7037, 14.24], "confirm", "on", true),
  cp("confirm-33-harsh-2", 33, "harsh", 2, [0.2831, 0.7164, 14.24], "confirm", "on", true),
  cp("confirm-33-harsh-3", 33, "harsh", 3, [0.2837, 0.7131, 14.25], "confirm", "on", true),
  cp("confirm-33-harsh-4", 33, "harsh", 4, [0.2825, 0.7102, 14.23], "confirm", "on", true),
  cp("confirm-33-harsh-5", 33, "harsh", 5, [0.2827, 0.7155, 14.26], "confirm", "on", true),
  cp("off-33-realistic-1", 33, "realistic", 1, [0.1873, 0.4751, 15.2], "comparator", "off", true),
  cp("off-33-realistic-2", 33, "realistic", 2, [0.1876, 0.4777, 15.2], "comparator", "off", true),
  cp("off-33-realistic-3", 33, "realistic", 3, [0.1876, 0.4776, 15.2], "comparator", "off", true),
  cp("off-33-realistic-4", 33, "realistic", 4, [0.1873, 0.4772, 15.21], "comparator", "off", true),
  cp("off-33-realistic-5", 33, "realistic", 5, [0.1877, 0.4796, 15.21], "comparator", "off", true)
];

const FLIGHTS = [...BETAFLIGHT, ...COGNIPILOT];
const STACK_NAME = { bf: "Betaflight", cp: "CogniPilot" };

function tracked(f, gate) {
  return f.rms < RMS_LIMIT && f.max < gate;
}

// Shortest lap whose full 15-run confirmation passes, for one stack and lead setting.
function shortestConfirmed(stack, gate, needLanding, lead = "on") {
  const sets = FLIGHTS.filter((f) => f.stack === stack && f.lead === lead && f.phase === "confirm");
  const laps = [...new Set(sets.map((f) => f.lap))].sort((a, b) => a - b);
  for (const lap of laps) {
    const set = sets.filter((f) => f.lap === lap);
    if (set.length === 15 && set.every((f) => tracked(f, gate) && (!needLanding || f.landed))) return lap;
  }
  return null;
}

// docs/results/arm-speed/attitude-lag-33s.json, summary block (33 s flights).
const LAG = [
  { stack: "bf", lead: "on", flights: 16, cmdRoll: [162, 168], cmdPitch: [150, 190], refRoll: [2, 2], refPitch: [2, 42], gain: [0.998, 1.032], resid: [0.042, 0.15], max: [0.7236, 0.7329] },
  { stack: "cp", lead: "on", flights: 16, cmdRoll: [172, 178], cmdPitch: [172, 192], refRoll: [12, 18], refPitch: [22, 42], gain: [0.992, 1.008], resid: [0.011, 0.043], max: [0.7037, 0.7164] },
  { stack: "cp", lead: "off", flights: 5, cmdRoll: [172, 172], cmdPitch: [172, 178], refRoll: [172, 172], refPitch: [172, 178], gain: [0.997, 1.001], resid: [0.011, 0.013], max: [0.4751, 0.4796] }
];
// Betaflight minus CogniPilot maximum error at 33 s, matched noise and seed (metres).
const MATCHED_33 = [
  ["harsh-1", 0.0254], ["harsh-2", 0.0115], ["harsh-3", 0.0198], ["harsh-4", 0.0154], ["harsh-5", 0.0081],
  ["none-1 to 5", 0.0200], ["realistic-1", 0.0188], ["realistic-2", 0.0160], ["realistic-3", 0.0169], ["realistic-4", 0.0160], ["realistic-5", 0.0147]
];

// Same firmware, plant, offboard library and runner 8781a1; only the motor protocol differs.
const PROTOCOL_PAIR = {
  setting: "35 s lap, harsh noise, seed 2, lead on",
  pwm: { period_us: 2000, rate_hz: 500, rms: 0.2547, max: 0.6515, landed: false, note: "Still armed at 0.60 m; yaw integral 227; still yawing at -33 deg/s at the end" },
  oneshot: { period_us: 500, rate_hz: 2000, rms: 0.2557, max: 0.6567, landed: true, note: "Grounded, disarmed, motors stopped" }
};

const RISKS = [
  { sev: "Blocker", status: "open", title: "Lead off decides the result, and it is not flown", text: "With lead on, both stacks tie at 33 s. CogniPilot's five lead-off flights at 33 s had 0.48 m worst error, so shorter laps look possible. Betaflight has never flown lead off on this test bed.", action: "Run both lead-off searches under the committed rule in speed-rule.json." },
  { sev: "Blocker", status: "open", title: "Betaflight's landing failures may come from our setup", text: "One matched pair at 35 s changed only the motor protocol. PWM ran the loop at 500 Hz and did not land. OneShot125 ran it at 2000 Hz and landed. Tracking was almost the same.", action: "Do not present CogniPilot's better landing as a stack strength. Decide Betaflight's protocol before the lead-off flights." },
  { sev: "Major", status: "open", title: "The two campaigns used different runner programs", text: "Betaflight used runner 7c9ade and CogniPilot used f2ef29.", action: "Rerun Betaflight at 32 s and 33 s on f2ef29 and compare the numbers (rule: runner_parity)." },
  { sev: "Major", status: "open", title: "Our documents still forbid this claim", text: "docs/simulation-qualification.md counts landing as a gate and says not to report 33 s as a confirmed speed.", action: "Use the two named results from the rule: a tracking result and a full-mission result. Update that document with the result." },
  { sev: "Major", status: "open", title: "The same gain does not mean the same step response", text: "Both stacks use K = 6/s. In the earlier non-ARM test, Betaflight overshot by up to 19.94 percent and CogniPilot did not. K = 6/s was not retested on this test bed.", action: "Keep K = 6/s and say it was not retested." },
  { sev: "Major", status: "open", title: "The search code uses the old rule", text: "The runner counts a landing failure as a failed lap time, so it can stop too early.", action: "Follow the rule: treat landing-only failures as tracking passes and continue the search by hand." },
  { sev: "Major", status: "open", title: "\"Faster\" will be misheard", text: "We mean the shortest planned lap each stack can follow within the limits. Not computer speed or a race lap.", action: "Open the talk with the one-sentence definition from the rule." },
  { sev: "Major", status: "open", title: "15 runs are not 15 separate tests", text: "The five no-noise runs give the same result, so there are 11 distinct flights. The noise levels are assumed.", action: "Say \"11 distinct flights across assumed noise levels\"." },
  { sev: "Blocker", status: "resolved", title: "The rule was not written down", text: "The rule is now in docs/results/arm-speed/speed-rule.json. It says openly that lead-on results were known when it was written.", action: "Cite its commit in every result." },
  { sev: "Blocker", status: "resolved", title: "CogniPilot had no result under the rule", text: "CogniPilot's lead-on campaign finished: 33 s passed 15 of 15, and 32 s passed 2 of 15.", action: "None." },
  { sev: "Blocker", status: "resolved", title: "One computer held the only copy of the data", text: "The raw flights, rerun programs and FastDyn source bundles are now in the raw-data-nov-20261110 release and copied to this Mac, with checksums verified.", action: "None." },
  { sev: "Blocker", status: "resolved", title: "Logs could not show where the stacks differ", text: "All 33 s flights recorded commanded and actual tilt. The lag analysis is in attitude-lag-33s.json. It still cannot name a cause inside the firmware.", action: "Say \"where the difference appears\", not \"because of\"." },
  { sev: "Nit", status: "open", title: "32 s was close for CogniPilot", text: "CogniPilot's 32 s search flight passed at 0.7495 m. Twelve of its 15 confirmations failed by 2 to 7 mm.", action: "Show the margin. Do not move the 0.75 m limit." }
];

const OUTCOMES = {
  now: { label: "Today: lead on only", winner: "Tie at 33 s", say: "With tilt lead on, both stacks pass 33 s on all 15 runs and fail at 32 s. Under the rule, that is indistinguishable at 1 s resolution. CogniPilot's worst error is 8 to 25 mm lower in every matched flight." },
  cpoff: { label: "CogniPilot lead off confirmed below 33 s, Betaflight lead off not", winner: "No winner yet", say: "We show CogniPilot's lead-off result as one cell and mark Betaflight's lead-off cell as not flown. The rule needs both stacks' better setting." },
  all: { label: "All four cells confirmed", winner: "Rule decides", say: "We show the two-by-two table. The shorter of each stack's two settings is its score. Equal scores are a tie. Landing appears in a separate table." }
};

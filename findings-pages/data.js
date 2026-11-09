// Values copied from docs/results/arm-speed/betaflight-attempts.json and
// rounded to the places shown. Each row is [typical error, maximum error, tilt].
// "landed" is false only where the report ended with the drone still armed.

const CONFIRM = {
  33: { none: [0.2893, 0.7312, 14.17], realistic: [[0.2889, 0.7282, 14.17], [0.2887, 0.7289, 14.17], [0.2887, 0.7295, 14.17], [0.2889, 0.7283, 14.14], [0.2890, 0.7284, 14.14]], harsh: [[0.2876, 0.7291, 14.18], [0.2882, 0.7280, 14.15], [0.2874, 0.7329, 14.18], [0.2884, 0.7255, 14.15], [0.2891, 0.7236, 14.13]], landFail: [2, 3] },
  34: { none: [0.2718, 0.6887, 13.48], realistic: [[0.2716, 0.6895, 13.47], [0.2721, 0.6899, 13.48], [0.2715, 0.6895, 13.46], [0.2716, 0.6885, 13.46], [0.2718, 0.6871, 13.47]], harsh: [[0.2704, 0.6898, 13.50], [0.2705, 0.6881, 13.46], [0.2705, 0.6938, 13.47], [0.2707, 0.6861, 13.46], [0.2728, 0.6846, 13.46]], landFail: [2, 5] },
  35: { none: [0.2561, 0.6526, 12.82], realistic: [[0.2560, 0.6520, 12.83], [0.2557, 0.6513, 12.83], [0.2558, 0.6536, 12.82], [0.2555, 0.6512, 12.80], [0.2562, 0.6526, 12.78]], harsh: [[0.2545, 0.6529, 12.84], [0.2547, 0.6515, 12.82], [0.2553, 0.6572, 12.80], [0.2548, 0.6505, 12.80], [0.2571, 0.6478, 12.80]], landFail: [2] },
  40: { none: [0.1946, 0.5071, 10.15], realistic: [[0.1946, 0.5053, 10.13], [0.1943, 0.5038, 10.13], [0.1950, 0.5076, 10.12], [0.1942, 0.5032, 10.14], [0.1949, 0.5034, 10.13]], harsh: [[0.1952, 0.5121, 10.10], [0.1945, 0.5072, 10.13], [0.1987, 0.5158, 10.14], [0.1943, 0.5065, 10.15], [0.1969, 0.5013, 10.10]], landFail: [3] }
};

const RMS_LIMIT = 0.35;
const MAX_LIMIT = 0.75;

function row(id, lap, noise, seed, values, phase, landed) {
  return { id, lap, noise, seed, rms: values[0], max: values[1], tilt: values[2], phase, landed };
}

const BETAFLIGHT = [
  row("coarse-40", 40, "realistic", 1, [0.1946, 0.5053, 10.13], "search", true),
  row("coarse-35", 35, "realistic", 1, [0.2560, 0.6520, 12.83], "search", true),
  row("coarse-30", 30, "realistic", 1, [0.3507, 0.8675, 16.57], "search", null),
  row("refine-34", 34, "realistic", 1, [0.2716, 0.6895, 13.47], "search", true),
  row("refine-33", 33, "realistic", 1, [0.2889, 0.7282, 14.17], "search", true),
  row("refine-32", 32, "realistic", 1, [0.3076, 0.7714, 14.91], "search", null)
];

for (const lap of [33, 34, 35, 40]) {
  const set = CONFIRM[lap];
  for (let seed = 1; seed <= 5; seed += 1) {
    BETAFLIGHT.push(row(`confirm-${lap}-none-${seed}`, lap, "none", seed, set.none, "confirm", true));
  }
  set.realistic.forEach((values, index) => {
    BETAFLIGHT.push(row(`confirm-${lap}-realistic-${index + 1}`, lap, "realistic", index + 1, values, "confirm", true));
  });
  set.harsh.forEach((values, index) => {
    const seed = index + 1;
    BETAFLIGHT.push(row(`confirm-${lap}-harsh-${seed}`, lap, "harsh", seed, values, "confirm", !set.landFail.includes(seed)));
  });
}

// CogniPilot flights published in the repository. Each is one flight.
const COGNIPILOT = [
  { id: "cognipilot-39s", lap: 39, rms: 0.2037, max: 0.5198, note: "One flight. It passed and landed." },
  { id: "cognipilot-35s-repeat", lap: 35, rms: 0.2517, max: 0.6380, note: "One flight, realistic noise, seed 1. It passed and landed." }
];

const CONFIRMED_LAPS = [33, 34, 35, 40];

function tracked(f, gate) {
  return f.rms < RMS_LIMIT && f.max < gate;
}

function shortestConfirmed(gate, needLanding) {
  for (const lap of CONFIRMED_LAPS) {
    const set = BETAFLIGHT.filter((f) => f.phase === "confirm" && f.lap === lap);
    if (set.every((f) => tracked(f, gate) && (!needLanding || f.landed))) return lap;
  }
  return null;
}

const RISKS = [
  { sev: "Blocker", title: "The rule is not written down yet", text: "We already know Betaflight's results. We have not read the newest CogniPilot results. If we set the rule after reading them, nobody can trust it.", action: "Commit the rule before opening those results." },
  { sev: "Blocker", title: "Our own documents forbid this claim", text: "The qualification document says a failed landing does not count, and says not to report 33 s as a confirmed reliable speed.", action: "Report two results: a tracking result and a full-mission result. Say \"under this stated rule\" in the headline." },
  { sev: "Blocker", title: "Betaflight has flown only one lead setting here", text: "The rule uses the better of tilt lead on and off. Betaflight has never flown with lead off on this test bed.", action: "Fly Betaflight with lead off. This takes about 47 minutes." },
  { sev: "Blocker", title: "A CogniPilot win could be dismissed", text: "Betaflight's control loop ran 500 times a second because of a setting we chose. It is also a proposed port, and it did better on an older board at the same settings.", action: "Show every rate separately, and state how Betaflight was set up." },
  { sev: "Blocker", title: "Logs cannot name a cause", text: "The logs do not record gyro readings, rate commands or the estimator. They can show where the response differs. They cannot show why.", action: "Say \"where the difference appears\". Do not say \"because of\"." },
  { sev: "Blocker", title: "One computer holds the unread results", text: "The virtual machine holds the only copy of the unread results and the editable source. Its search also cannot resume, so a stalled flight restarts the whole search.", action: "Copy everything off first. Then measure how often flights stall." },
  { sev: "Major", title: "A tie is likely with lead on", text: "Estimates put CogniPilot close to the 0.75 m limit at 32 s. A tie at 33 s is the likely lead-on result. These are estimates, not measurements.", action: "Write the tie sentence now. Do not add a tie-breaker later." },
  { sev: "Major", title: "Lead off is unknown and could mislead", text: "CogniPilot tracked better with lead off in the earlier, non-ARM runs. Those runs may not carry over, and the reason is not checked.", action: "Fly it, and report it as a separate result." },
  { sev: "Major", title: "The same gain does not mean the same response", text: "Both stacks use K = 6/s. At that gain, Betaflight overshoots by up to 19.94 percent, close to the 20 percent limit. CogniPilot does not overshoot.", action: "Keep K = 6/s and say it was not retested on this test bed." },
  { sev: "Major", title: "The search code uses the old rule", text: "The current search counts a landing failure as a failed lap time, so it may stop too early.", action: "Score stored results again under the new rule. Fly extra flights only where needed." },
  { sev: "Major", title: "The two campaigns used different runner programs", text: "Betaflight used one version of the program that runs the test. CogniPilot's newest campaign used another.", action: "Rerun Betaflight at 32 s and 33 s on the same version. This takes about 35 minutes." },
  { sev: "Major", title: "\"Faster\" will be misheard", text: "People may think we mean a faster computer or a race lap. We mean the shortest planned lap each stack can follow within the limits.", action: "Open the talk with one sentence that defines it." },
  { sev: "Major", title: "15 runs are not 15 separate tests", text: "The five no-noise runs give the same result. That leaves 11 distinct flights. The noise levels are also assumed, not measured.", action: "Say \"11 distinct flights across assumed noise levels\"." },
  { sev: "Major", title: "Stalled flights must not count as failures", text: "A flight that stalls tells us nothing about speed. It is neither a pass nor a fail.", action: "Rerun it, keep the record, and publish the number of stalls." },
  { sev: "Nit", title: "One small gap is not a finding", text: "At 35 s the two stacks differ by 0.004 m in typical error. CogniPilot flew that lap once.", action: "Do not present this gap as a result." },
  { sev: "Nit", title: "31 s was never flown", text: "The search stops at the first failed lap time, so it never tried 31 s for Betaflight.", action: "Say \"shortest passing 33 s, failed at 32 s, within the times tested\"." }
];

const OUTCOMES = {
  none: { label: "No new CogniPilot results", say: "Betaflight has a provisional tracking result of 33 s. We have one paired flight at 35 s. The answer is unresolved. We show the 40 s comparison and the plan." },
  screen: { label: "Search finished, confirmation partial", say: "We show the range of lap times for each stack and setting, and mark each as not confirmed. We do not name a winner." },
  one: { label: "One lead setting confirmed", say: "We answer for that setting only. We mark the other setting as still to do." },
  all: { label: "All tests confirmed", say: "We show a table of both stacks and both settings. We name a tie or a winner using the committed rule. We show landing in a separate table." }
};

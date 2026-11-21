// Evidence references describe the specific experiment family, not just its upstream repository.
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const stacks = ['cognipilot', 'betaflight'];
const unique = values => [...new Set(values)];
const refs = (ids, locator) => unique(ids).map(id => ({id, locator}));
const runRefs = (runs, files) => runs.flatMap(run => refs(files.map(file => run.id + '-' + file), run.id));
const historyRefs = files => stacks.flatMap(stack => refs(files.map(file => stack + '-' + file), 'Historical 33 s figure-eight'));
const sourceButton = ({id, locator}) => `<span class="source-item"><button data-evidence="${esc(id)}">${esc(id)} ↗</button>${locator ? `<small>${esc(locator)}</small>` : ''}</span>`;
export function evidenceDetails(title, sources, method = '') {
  return `<details class="evidence-details"><summary>${esc(title)}</summary>${method ? `<p class="small">${esc(method)}</p>` : ''}<div class="source-links">${sources.map(sourceButton).join('')}</div></details>`;
}

export function evidenceClaims(d) {
  const q = d.matchedQualification;
  const runs = q.runs;
  const protocols = refs(['matched-protocol'], 'Declared settings, limits and scope; independently checked against retained runs.');
  const analysis = refs(['matched-analysis-source', 'matched-import-source'], 'Frozen analyze* functions and import qualification logic.');
  return [
    {id: 'completion', sections: ['overview', 'comparison', 'methodology'], title: 'Completed and landed flights', kind: 'Recorded simulation',
      value: {attempts: runs.length, landed: runs.filter(r => r.landed).length, passed: runs.filter(r => r.passed).length},
      method: 'Count the retained run IDs. Landing uses final_armed=false, zero final_motors, grounded_stopped_samples and the protocol ground threshold. Attitude probes and trajectory tests have different acceptance criteria.',
      limits: 'Completing these fixed-reference tests does not establish maximum speed or real-flight reliability.',
      sources: [...protocols, ...analysis, ...runRefs(runs, ['report.json'])]},
    {id: 'tracking', sections: ['overview', 'comparison', 'methodology'], title: 'Tracking errors and repeated-noise statistics', kind: 'Derived from raw simulation samples',
      value: {independentlyVerified: runs.filter(r => r.score?.verified).length, noiseRepetitions: runs.filter(r => r.phase === 'noise-matrix').length},
      method: 'RMS = sqrt(mean(||position − held reference||²)); peak = largest 3D error. Use each run’s score.start_s/end_s inclusively at 8 kHz. Figure-eight: t=25–65 s. Noise rows use arithmetic mean and sample SD (N−1) across five seeds; none-profile repeats test determinism.',
      limits: 'Charts use a 20 Hz display subset of 100 Hz telemetry. Table scores use the full raw scoring stream. Assumed noise profiles are not calibrated aircraft noise.',
      sources: [...protocols, ...analysis, ...runRefs(runs.filter(r => !r.step), ['scoring-inputs.bin', 'report.json'])]},
    {id: 'response', sections: ['comparison', 'methodology'], title: 'Signed attitude and position-step response', kind: 'Derived from simulation traces',
      value: {attitudeProbes: runs.filter(r => r.step).length, qualifiedAttitudeProbes: runs.filter(r => r.step?.qualified && r.passed).length},
      method: 'Attitude: nominal ±5° roll/pitch, 10–90% rise, peak overshoot and ±1° settling within the declared hold. Position: 0.5 m east step, 10–90% rise, ±1 cm settling and final 2 s mean bias. See analysis source for crossings and hold windows.',
      limits: 'These are plant responses, combining onboard estimation/control and modeled vehicle dynamics. They do not isolate estimator error or CPU execution time.',
      sources: [...analysis, ...runRefs(runs.filter(r => r.step), ['calibration.csv', 'report.json']), ...runRefs(runs.filter(r => r.positionStep), ['trajectory.csv', 'report.json'])]},
    {id: 'matching', sections: ['overview', 'comparison', 'parity', 'firmware', 'methodology'], title: 'Matched timing, commands and sensor inputs', kind: 'Observed simulation counters and traces',
      value: {pairs: q.pairs.length, identicalConfigs: q.pairs.filter(p => p.identical_config_values).length, identicalNoise: q.pairs.filter(p => p.identical_noise).length, sharedArtifacts: q.pairs.filter(p => p.shared_artifacts).length},
      method: 'Compare parsed original configurations and shared artifact hashes; compare paired noise bytes; check sensor_profile.measured_counts_25_to_26_s, trace cadence, quantization and lead/RC identity. Inspect any run’s report and input files in the flight records below.',
      limits: 'Host expected sensor traces are not firmware setpoint readbacks. 1,600 Hz/625 µs is emulated scheduling, not measured physical execution time. Virtual DShot600 does not model electrical signaling.',
      sources: [...protocols, ...analysis, ...refs(['matched-source-archive'], 'Frozen runner, shared loop, plant, firmware and source overlays')]},
    {id: 'vehicle', sections: ['overview', 'race', 'architecture', 'parity', 'math', 'sensitivity'], title: 'Vehicle and facility parameters', kind: 'Model assumptions',
      method: 'Read mass, geometry, inertia, drag and rotor constants from the saved plant model description and source. The existing model uses 2 kg and a 500 mm opposite-motor diagonal. The PURT box is a provisional visualization envelope.',
      limits: 'These are simulation parameters, not measured mass, drag, inertia or calibrated motion-capture coverage of the physical drone/facility.',
      sources: refs(['plant', 'Vehicles/Templates/QuadrotorPlant.mo', 'Vehicles/Rdd2/Plant.mo', 'environment'], 'Model defaults / provisional environment configuration')},
    {id: 'firmware', sections: ['overview', 'architecture', 'firmware', 'comparison'], title: 'TROPIC RT1064 firmware and source identity', kind: 'Archived binaries and rebuild comparison',
      value: {loadedProgramsReproduced: q.firmwareRebuilds.checks.filter(c => c.loadImageIdentical).length},
      method: 'Flight reports identify the loaded firmware, runner, shared library and plant hashes. Rebuild verification compares executable load bytes and memory layout against the frozen flight images; full-ELF equality is reported separately.',
      limits: 'The release contains simulation builds with disclosed adaptations. A source hash identifies bytes; it does not prove correctness, stock defaults or physical-board readiness.',
      sources: refs(['matched-source-archive', 'firmware-rebuild-checks', 'firmware-rebuild-verifier', 'cognipilot-rebuild-archive', 'betaflight-rebuild-archive', 'step-repositories'], 'Source bases, patches, build commands and binary identities')},
    {id: 'historical', sections: ['overview', 'race', 'analytics', 'comparison', 'parity', 'sensitivity'], title: 'Historical 33 s laps and retained speed attempts', kind: 'Earlier simulation family',
      value: {retainedAttempts: d.attempts.length, displayedReferenceLap_s: 33},
      method: 'The earlier figure-eight view uses t=25–58 s and 100 Hz saved positions. Saved-sample RMS and reconstructed 8 kHz held-reference RMS are distinct calculations. Campaign arrays retain unsuccessful and incomplete attempts as well as passes.',
      limits: 'These older binaries and input conditions are separate from the new fixed-40 s qualification. A requested 33 s reference is not proof of a newly matched fastest lap.',
      sources: [...historyRefs(['report', 'config', 'trajectory', 'campaign']), ...refs(['qualification-audit', 'math-audit'], 'Historical sampling reconstruction and scope')]},
    {id: 'historical-steps', sections: ['overview', 'analytics', 'comparison', 'firmware'], title: 'Earlier Acro, attitude and position steps', kind: 'Separate simulation diagnostic',
      method: 'Use the original step samples, nominal commands and report hold windows. Rise is 10–90%; settling uses the earlier 5% band. The Acro command-map discrepancy remains disclosed in the method record.',
      limits: 'The older Acro diagnostic is not covered by the new fixed-heading ANGLE/ATTITUDE qualification. Different probes and time windows must not be pooled.',
      sources: [...refs(['steps', 'step-method', 'step-analysis-source', 'step-config'], 'Earlier step protocol, analysis and command-map scope'), ...stacks.flatMap(stack => ['attitude-step', 'rate-step', 'position-step'].flatMap(test => refs([`${stack}-${test}-csv`, `${stack}-${test}-report`], test)))]},
    {id: 'mathematics', sections: ['architecture', 'math', 'comparison', 'methodology'], title: 'Generated controller mathematics', kind: 'Scoped numerical checks',
      value: {orientationSamples: d.generatedOrientation.metrics.samples, orientationMaxError_rad: d.generatedOrientation.metrics.integrated_orientation_max_error_rad},
      method: 'Check generated shared-loop output against the oracle, finite differences and integrated orientation. The exact flight-library check is distinct from current source snapshots and earlier isolated checks.',
      limits: 'Integration checks assume zero state error and fixed heading. Numerical agreement is not a proof of global nonlinear stability or complete estimator equivalence.',
      sources: refs(['exact-flight-loop-check', 'generated-orientation', 'orientation-trace', 'math-audit', 'Benchmarks/PositionLoop.mo', 'Benchmarks/Feedforward.mo', 'Benchmarks/Trajectory.mo'], 'Named checks, residuals, scope and equations')},
    {id: 'tuning', sections: ['comparison', 'parity', 'sensitivity', 'methodology'], title: 'Gain selection and optimization scope', kind: 'Recorded tuning plus proposed experiments',
      value: {selectedAttitudeGain_per_s: q.protocol.tuning.selected_gain_per_s},
      method: 'The existing equal-budget native tuning selected 6/s. Signed ARM probes requalify that choice under the new protocol. Parameter proposals are exports only; they do not launch flights or create results.',
      limits: 'A new maximum-speed sweep and physical delay compensation study have not been completed under this protocol.',
      sources: refs(['native-tuning', 'tuning-rule', 'matched-protocol', 'matched-analysis-source'], 'Selection rule, recorded outcomes and requalification')},
    {id: 'validation', sections: ['architecture', 'math', 'methodology'], title: 'Ideal-attitude and host-native checks', kind: 'Separate validation experiments',
      value: {idealFlights: d.idealValidation.length, earlierArmRepeats: d.armValidation.length},
      method: 'Keep ideal-attitude missions, four earlier ARM rate repeats and rebuilt host-native ingress tests in separate groups. Compare saved trajectory hashes for deterministic repeats.',
      limits: 'Ideal-attitude runs contain no flight firmware. Host-native checks do not measure ARM hardware latency.',
      sources: refs(['ideal-hover', 'ideal-step', 'ideal-square', 'ideal-figure-eight', 'ideal-figure-eight-repeat', 'ideal-validation-archive', 'arm-validation-archive', 'native-integration-checks', 'native-checks-archive'], 'Per-experiment reports, build output and artifacts')}
  ];
}

export function claimsHTML(d, section) {
  const claims = evidenceClaims(d).filter(c => section === 'references' || c.sections.includes(section));
  return `<details class="panel claims-panel" ${section === 'references' ? 'open' : ''}><summary>Evidence behind this ${section === 'references' ? 'site' : 'section'}</summary><p class="small">Each result is tied to its experiment and calculation. Assumptions and unmeasured hardware properties are labeled separately. SHA-256 verifies file identity, not scientific correctness.</p>${claims.map(c => `<article class="claim-record" id="claim-${c.id}"><h3>${esc(c.title)} <span class="pill blue">${esc(c.kind)}</span></h3>${c.value ? `<dl class="claim-values">${Object.entries(c.value).map(([key,value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>` : ''}<p>${esc(c.method)}</p><p class="small muted">${esc(c.limits)}</p>${evidenceDetails('Inspect supporting files ('+c.sources.length+')', c.sources)}</article>`).join('')}<button data-export-claims>Download claims and source hashes (JSON)</button></details>`;
}

export function flightRecordsHTML(d) {
  return `<details class="panel"><summary>All ${d.matchedQualification.runs.length} matched flight records · reports, settings and raw inputs</summary><p class="small">Every retained attempt in this campaign. Open a file for its path, SHA-256 and download. Large files are in the published release with their exact extraction paths.</p>${d.matchedQualification.runs.map(r => evidenceDetails(`${r.id} · ${r.passed ? 'passed' : 'inspect result'} · scoring ${r.score.start_s}–${r.score.end_s} s`, [...refs(r.evidence, 'Original per-flight artifact'), ...refs([r.id+'-input-config'], 'Original submitted configuration')], `Landing: ${r.landed ? 'verified' : 'not verified'}. Score: ${r.score.hz} Hz, ${r.score.samples} samples. ${r.step ? 'Attitude acceptance uses calibration.csv; trajectory-error gates do not apply to the attitude probe.' : 'Trajectory acceptance uses the frozen protocol gates.'}`)).join('')}</details>`;
}

export function chartEvidence(d, id) {
  const q = d.matchedQualification;
  let runs, files = ['trajectory.csv', 'report.json', 'input-config'], method;
  if (id === 'sweep-chart') return {family:'Historical speed-screening campaigns', method:'Each plotted point is a retained campaign attempt with finite reported RMS, filtered by the selected stack, noise and lead condition. Incomplete attempts without RMS remain in the attempt table. Values are original runner scores, not resampled trajectory scores or a newly matched maximum-speed result.', sources:historyRefs(['campaign'])};
  if (/^fresh-probe-[0-3]$/.test(id)) {
    runs = q.runs.filter(r => r.step && r.probe === Number(id.at(-1)));
    files = ['calibration.csv', 'report.json', 'input-config'];
    method = 'Original calibration samples: actual_deg versus time from the step, t<1.2 s. Nominal ±5° reference; no phase shift or smoothing. Metrics use the complete declared hold.';
  } else if (['fresh-position-step', 'fresh-hover', 'fresh-square'].includes(id)) {
    const shape = {'fresh-position-step':'step','fresh-hover':'hover','fresh-square':'square'}[id];
    runs = q.runs.filter(r => r.phase === 'baseline' && r.shape === shape);
    method = 'Display uses saved telemetry in the declared test window (position step includes 1 s before onset). Coordinates are world ENU, metres. The full 100 Hz trajectory supplies response metrics; 8 kHz raw scoring supplies tracking tables.';
  } else if (/^fresh-(path|error|altitude)-(off|omega)$/.test(id)) {
    const mode = id.split('-').at(-1);
    runs = q.runs.filter(r => r.phase === 'baseline' && r.shape === 'figure-eight' && r.mode === mode);
    method = '20 Hz display subset of saved 100 Hz telemetry. Path/error use t=25–65 s; altitude includes the complete 83 s flight. Table RMS/peak use original 8 kHz scoring, not these display points.';
  }
  if (runs) return {family: 'November 20 matched ARM qualification', method, windows: runs.map(r => ({id:r.id,start_s:r.score.start_s,end_s:r.score.end_s})), sources: [...runRefs(runs,files),...refs(['matched-analysis-source','matched-import-source'],'Scoring and display import')]};
  const step = id.match(/^(?:compare|chart)-(attitude-step|rate-step|position-step)$/)?.[1];
  if (step) return {family:'November 13 matched-rate step diagnostics', method:'Original step samples plotted relative to the step onset; nominal command and response retained without time alignment. Metric hold windows and mapping limitations are in the method report.', sources:[...stacks.flatMap(s=>refs([`${s}-${step}-csv`,`${s}-${step}-report`],step)),...refs(['steps','step-method','step-analysis-source'],'Recorded metrics and analysis')]};
  if (/^chart-(xy|altitude|error(?:-[xyz])?|speed|acceleration|roll|pitch|yaw|command-(?:roll|pitch)|lead-(?:roll|pitch)|omega-ff-(?:roll|pitch)|motors-(?:cg|bf))$/.test(id)) {
    let sources = historyRefs(['trajectory','report']);
    if (/command|lead|omega-ff/.test(id)) sources.push(...historyRefs(['tilt-lead']));
    return {family:'Historical 33 s figure-eight',method:'Saved 100 Hz plant positions/orientations/motor commands and, where shown, 250 Hz host tilt-lead traces. Angles convert radians to degrees; speed/acceleration use finite differences. Path uses t=25–58 s. No time alignment. These data use the earlier binaries, not the new fixed-40 s qualification.', sources};
  }
  throw new Error('Missing chart evidence mapping: '+id);
}

export function evidenceManifest(d, claims = evidenceClaims(d)) {
  return {scope:'Source index; simulation evidence, not physical validation', importedAt:d.importedAt, claims:claims.map(c=>({...c,sources:c.sources.map(s=>{
    const e=d.evidence[s.id];
    if(!e)throw new Error('Missing evidence: '+s.id);
    return {...s,path:e.path,sha256:e.sha256,bytes:e.bytes,classification:e.classification,archive:e.archive??null};
  })}))};
}

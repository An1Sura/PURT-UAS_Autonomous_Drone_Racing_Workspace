# Implementation and qualification status

This tracks the master prompt without treating an interface or an old result as fresh experimental completion.

| Requested deliverable | Implemented now | Remaining scientific work |
|---|---|---|
| 1. Separate research page | Separate comparison published on GitHub Pages; original game/sim bytes preserved | None for separation |
| 2. Light academic UI | Twelve responsive sections; desktop/mobile QA | Further content review |
| 3–4. Logos and source access | Official CG/BF artwork; GitHub corner link | Additional institutional marks only from approved originals |
| 5. Canonical vehicle | Existing 2 kg, 500 mm diagonal plant preserved; exact description and runtime hashes retained | Physical vehicle identification remains outside this simulation task |
| 6–8. Shared loop, mappings, FF | Existing actual Modelica/Rust implementation inspected; generated artifacts and traces linked | Full current-build signs/mode/saturation gates; integrated orientation now passed for the declared scope; optional alpha disabled |
| 9. Course | Actual 10 × 10 m at 2 m; fixed 40 s matched campaign completed | Fresh maximum-speed boundary |
| 10. 3D viewer | Synchronized recorded positions/orientations, orbit/top/follow, controls | Browser is a replay/analysis interface; VM execution remains through the existing native runner |
| 11. Fair/deterministic comparison | 39 paired conditions; original config, artifact, input-noise and observed-counter checks; five identical no-noise repeats per stack/lead setting | Full yaw/Acro mappings remain separate |
| 12. Four stages | Completed fixed-reference protocol shown first; broader scope retained separately | Fresh maximum-speed boundary, full Acro/yaw mapping and physical timing |
| 13. Analytics | Recorded and derived charts; original 250 Hz FF traces; six step probes | Estimator/body-rate histories, CPU timing, energy, designed frequency excitation |
| 14. Parity matrix | Compiled defaults, configured values, counter evidence, unknowns | Firmware readbacks and exhaustive command-map validation |
| 15. Firmware comparison | Both source rebuilds reproduce loaded programs; Betaflight matches the complete ELF; RT1064 target is explicit | Runtime memory/CPU timing instrumentation |
| 16. Mathematical evidence | Model equations, assumptions, numerical tests and limitations | Formal proof and full model/firmware equivalence not established |
| 17. Evidence inspector | Per-graph sources, claim calculations, all 78 flight records, original hashes and matching source-rebuild supplements | Toolchain and submodule downloads still needed when reproducing on another machine |
| 18. Statistics comparison (replaces visible paper) | Completed 78-flight fixed-reference campaign, paired metrics, definitions, response plots and new replays; paper draft archived | Fresh speed sweep and separately declared optimization experiments |
| 19. Sensitivity | Actual recorded noise/lap/FF filters; proposal exporter | New controlled parameter sweeps; no fabricated response curves |
| 20. Reports/exports | Canonical dataset, 78 fresh flight records, source-rebuild supplements, immutable originals, CSV/SVG/JSON/hash exports | Physical measurements and future campaigns remain separate evidence families |

## Evidence families

- **Historical figure-eight archive:** CG 42 attempts; BF PWM 66 attempts. Selected pair is 33 s / realistic / seed 1. Same plant and offboard hash, different runners and command arrival. No final ranking.
- **Matched-rate virtual-DShot steps, November 13:** six displayed noise-free probes. Same config/plant/offboard/runner hashes and observed 1,600 Hz counters. Different firmware hashes from figure-eight archive. Single-axis probes are not full attitude tuning or physical processor latency.
- **Generated-code numerical checks:** the recorded check references the exact historical offboard library. It is not a flight or a formal floating-point proof.
- **New local application checks:** deterministic analysis tests and browser acceptance only; not additional flight attempts.

## Immediate reproducibility work

1. Freeze the exact historical scoring source. The held-reference reconstruction already reproduces both selected RMS reports within 1 µm; keep originals unchanged.
2. Recover/freeze full source overlays, dependency revisions, generated components and toolchain hashes. Audit controller-equation changes separately from I/O and scheduling adaptations.
3. Keep the added VM storage available for retained attempts. Parallel FastDyn sessions require distinct monitor ports, QMP sockets, RAM files and output directories; identical firmware/plant/runner binaries remain frozen.
4. Use existing Rust/Devenv experiment commands for new runs; do not add a parallel flight controller or another workspace runner.
5. Requalify gates in order. Set statistical margins before final data acquisition, retain all outcomes and report the tested grid resolution.

Physical radio integration, flashing and MoCap procedures are outside this task.

## Fresh work completed after the audit

The existing Rust/Rumoca generated-code checker was rerun successfully, using memory-backed VM output. It passed 4,001 numerical samples, two identical reference repeats and the oracle/derivative checks. Generated artifacts and hashes are available on the published comparison page. Subsequently, five ideal-attitude checks and four frozen-firmware ARM repeats passed. Their exact evidence and the extended orientation checker are stored separately from the historical library.

## Current validation status

Stage 2 passed for its declared numerical and ideal-flight scope. The new November 20 fixed-reference campaign additionally verifies original configuration bytes, common input values, shared artifact hashes, signed attitude response, 250 Hz host command encoding, identical seeded IMU innovations, 1,600 Hz firmware counters, and independent raw 8 kHz scoring. Its per-check progress is generated from actual completed measurements in `public/data/matched-qualification/summary.json`; partial campaigns are not called complete.

The existing VM now has eight CPUs, 8 GiB RAM and a 96 GiB disk. The resource change occurred between flights after a saved checkpoint. All earlier artifacts remain available.

## November 20 matched ARM campaign

The comparison page now separates fresh matched results from the collapsed historical archive. Both TROPIC RT1064 simulation ELFs use the same 2 kg / 500 mm diagonal Rumoca plant, 8 kHz physics, 1,600 Hz IMU/control updates, 100 Hz shared position loop, 250 Hz RC commands, virtual DShot600, and gain 6/s. Onboard controller equations are unchanged. Four signed 5-degree probes per stack passed the frozen rise/overshoot/settling rule.

The frozen plan completed November 21 with **78/78 flights passed and landed**: eight attitude probes, ten baseline flights, and sixty figure-eight repetitions (two stacks × three noise profiles × five seeds × lead off/on). The 40 s reference duration is a qualification condition, not a newly measured speed limit. All reports, original configuration bytes, raw noise/scoring/motor traces and source overlays are retained. Normalized configuration formatting is distinguished from original file hashes.

All eight fixed-reference check groups passed, covering all 78 distinct planned conditions and 39 matched pairs. Independent scoring reproduces every report; all six stack/noise seed groups pass their innovation audit. Five no-noise repetitions per stack and lead setting reproduce identical trajectory and actuator bytes. `qa/completed-qualification-checks.json` records the final assertions; the derived dataset remains the page's source of truth.

A separate West rebuild corrected the stale host-native Zephyr setup. Both previously ignored firmware integration tests passed, in addition to the 61 native unit checks. The host-native executable is archived separately from the frozen ARM images.

Not established by this fixed-reference protocol: a fresh maximum-speed boundary, full Acro/yaw equivalence, electrical DShot timing, physical CPU latency/jitter, calibrated MoCap noise/delay, or globally valid stability proofs. No superiority/non-inferiority hypothesis is assigned to these descriptive results.

## Firmware reconstruction evidence

CogniPilot was rebuilt through the pinned West/CMake workflow. The executable load segments, addresses, zero-initialized memory, entry point and permissions match the frozen flight ELF; debug metadata differs. Betaflight was rebuilt through its existing Make workflow and matches the complete frozen ELF byte-for-byte. Its original November 13 adapter was recovered from the retained archive, and its 1,600 Hz virtual-sensor constant was verified against the frozen binary. The later diagnostic adapter and initial unsuccessful rebuilds remain recorded. No flight firmware was replaced during the campaign.

Use `qualification-source.tar` together with `cognipilot-source-rebuild.tar.gz` and `betaflight-source-rebuild.tar.gz`. The Betaflight supplement contains the required archived adapter and exact build flags. `firmware-rebuild-checks.json` records the independent ELF analysis. These are simulation artifacts, not a hardware flashing package.

## November 21 evidence-link audit

The website now exposes scoped source references under every graph and a claim/source index for every section. Claim counts come from retained records and are cross-checked against original reports. All matched attempts have report/config/trajectory/raw-input/log access; large originals retain their exact release extraction path. 44 analysis tests passed, including all 896 original evidence hashes. Browser checks cover all twelve sections and source-record exports. These checks improve traceability; they do not upgrade assumptions to measurements, qualify physical hardware, or establish a new speed limit.

## Matched status and metric interpretation

The fixed-reference protocol is reported as passed only while all eight required checks, coverage and completed flight records agree. Missing checks or runs cannot be hidden by a “passed” metadata label. Current parity, firmware identity and static memory are shown first; historical 33 s configuration comparisons remain in a labeled disclosure. The metric guide compares the same lead condition for both stacks and distinguishes reference timing, measured response, assumed model parameters and hardware-only measurements. No new firmware flights were needed for this display/analysis change.

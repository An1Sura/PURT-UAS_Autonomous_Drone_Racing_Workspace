# CogniPilot for Autonomous Drone Racing

**Simulation-only comparison of CogniPilot and Betaflight.** The website displays recorded ARM firmware runs in FastDyn/QEMU using a shared Rumoca plant. It does not connect to a live drone. The existing Acro game and original simulation pages remain separate. Publication was authorized on November 21, 2026.

## Open locally

```sh
npm start
```

Visit <http://127.0.0.1:8770/research/flight-control-benchmark/>. Node.js is the only runtime dependency; the pinned Three.js files and official logos are local. The server binds only to `127.0.0.1`, accepts read-only requests and serves only `public/`.

The browser renders **recorded firmware trajectories**. It does not run Betaflight or CogniPilot, replace the Rumoca plant, send radio commands, or start VM campaigns. The existing Acro service files are unchanged. Its firmware session finished before the VM storage restart.

## What is implemented

- Twelve comparison sections, light layout, official stack logos, persistent project GitHub link.
- New paired 40 s figure-eight recordings on the comparison page, selectable tilt lead off/on, with recorded takeoff and landing through 83 s. Playback uses actual telemetry timestamps and never substitutes display interpolation for scoring.
- Historical 33 s recordings remain available separately, with recorded orientations, takeoff/landing, orbit/top/follow cameras, timeline and speed controls.
- 108 historical campaign attempts (42 CogniPilot and 66 Betaflight PWM), including failures; six matched-rate step diagnostics as a separate family.
- Position/reference/error/velocity/acceleration/attitude/motor charts, original 250 Hz tilt and feed-forward traces, step-response graphs, sensitivity filters, CSV and SVG exports.
- Parameter parity and artifact identities, per-value evidence inspector, immutable source files and SHA256SUMS.
- Four-stage qualification gates, a frozen matched-flight protocol and clearly labeled optimization-proposal export. These exports do not execute experiments.
- Mathematical explanation, interactive tilt-lead algebra, independent numerical unit checks.
- Statistics comparison with paired values, signed differences, response graphs and metric definitions. The paper is hidden; its draft is retained in `archive/` and `qa/`.

## Dataset and provenance

`public/data/dataset.json` is the canonical dataset consumed by the replay, charts, comparison, source inspector and methodology. `npm run data` rebuilds it from the existing sibling repository snapshot and locally copied VM evidence. This importer is analysis code, not a replacement flight orchestrator.

The exact historical plant-description digest is:

```
fdb12c3379b56d2d18f0ccaab3c62d15d2f97281f55270f37b837ea9c980b91c
```

It matches both selected flight reports and the later step-test reports. Compiled defaults: 2 kg; 0.25 m arms / 0.50 m opposite-motor diagonal; inertia `(0.0216667, 0.0216667, 0.04)` kg·m²; 12.5/25 ms asymmetric motor constants. The user requested keeping the existing geometry. No plant was rescaled or retuned.

`public/data/sources/` holds current VM source snapshots for inspection. These include local edits and are explicitly **not** advertised as complete source for rebuilding historical binaries. Upstream HEAD alone is insufficient; earlier source-recovery bundles and full patches remain necessary.

The original October 8, 2026 PDF was not found in accessible attachments. The supplied detailed master prompt is implemented as a requirements brief pending cross-check against that PDF.

## Findings that must not be hidden

1. The selected historical 33 s recordings share plant, position-loop and configuration hashes, but runner hashes and command ingress differ. The later 1.6 kHz virtual-DShot step tests do not retroactively qualify those recordings.
2. Independent 25–58 s CSV RMS is **0.2905199 m CG / 0.2968343 m BF**. Legacy reports state **0.2824601 m / 0.2888542 m**. Maximum-error values agree. Both VM originals match the local report/trajectory bytes. An 8 kHz reconstruction using linearly interpolated position and a held 100 Hz reference reproduces the reports within 1 µm. This supports sampling phase as the explanation; reconstructed samples are not raw measurements.
3. `4 * Ct * omegaMax²` gives **41.3751272 N**, while the configured command map uses **41.3749272 N**. The tiny 0.0002 N difference is disclosed; no experiment configuration was silently changed.
4. Original `calibration.csv` files for these two selected flights contain headers only. They do not provide gyro/body-rate data. Actual rate-command/estimator histories are marked unavailable instead of inferred from Euler derivatives.
5. The model already has quadratic and linear drag. This does not establish that the shared position controller compensates drag or that drag explains the speed limit.
6. The VM now has **8 virtual CPUs, 8 GiB RAM and a 96 GiB disk**. Completed flights were checkpointed before resizing; no active flight was interrupted and no prior evidence was deleted.

## Qualification scope

A browser preview is not a qualified research result. Read `IMPLEMENTATION-STATUS.md` before presenting comparative claims. In particular, do not call 33 s a current fair cross-stack maximum-speed result, treat QEMU wall time as physical latency, infer battery energy from motor commands, or describe these simulation builds as flash-ready hardware firmware.

The matched campaign started November 20 and completed November 21: **78/78 planned flights passed**, with **39 paired conditions**. It closes raw-scoring provenance, seeded-noise parity and signed ARM attitude checks within its fixed-heading ANGLE/ATTITUDE scope. The comparison page and `public/data/matched-qualification/summary.json` hold the individual checks and original records. The fixed 40 s repeated campaign is distinct from a new maximum-speed sweep and from full Acro/yaw qualification. Earlier failed or incomplete outcomes remain retained. The comparison is descriptive; no winner or non-inferiority claim is required.

## Verification

```sh
npm test
```

The 44 analysis tests pass. Tests cover claim-to-artifact coverage, graph provenance, report-backed counts, evidence integrity, identical selected reference samples, final-sample/landing state, source model identity, RMS discrepancy preservation, frame/sign/lead algebra, step-metric recomputation, gate enforcement, retained failures, and byte-identical original pages.

`qa/browser-results.json` records checks of all twelve sections, desktop/mobile overflow, replay controls, evidence dialogs, CSV/comparison/proposal/protocol exports and external requests. Browser tests use the available local Playwright/Chrome runtime, not a public testing service.

## Branding and dependencies

- CogniPilot SVG: official `CogniPilot/artwork`, complete light-background mark, unmodified. Brand guidelines reviewed; clear space preserved.
- Betaflight PNG: official `betaflight/betaflight/images/bf_logo.png`, unmodified. No invented SVG.
- Purdue/PURT identification is text, not a fabricated institutional logo. Other partner marks are not substituted or invented.
- Three.js 0.180.0 and OrbitControls: local pinned distribution; MIT license in `public/vendor/three-LICENSE.txt`.

GitHub Pages serves the replacement comparison at `docs/research/`. The old conference dashboard implementation is removed; its history remains in Git. Large evidence files are preserved in the `matched-simulation-20261121` GitHub Release with SHA-256 checksums.

## Fresh generated-code validation, November 20

The existing Rust `shared-loop-check` successfully regenerated Trajectory, PositionLoop and PositionOracle with Rumoca and ran **4,001 numerical samples**. Two reference repeats matched, guidance-oracle maximum residual was zero, and derivative checks passed. This is a fresh numerical validation, not a firmware flight.

The compiler digest matches the historical check. PositionLoop and Trajectory source digests match their recorded inputs. The new library digest (`20df0677…`) differs from the historical flight library (`220db232…`); artifacts are not substituted.

Reproduction used the existing VM checkout and command:

```sh
src/cerebri_rdd2/target/release/xtask shared-loop-check \
  docs/config/shared-position-benchmark.json \
  src/modelica_models \
  /nix/store/8svmn9i1pd53gbffk5x623nsnh5dr61g-rumoca-0.10.0/bin/rumoca \
  /dev/shm/purt-research-check-20261120
```

The output directory was memory-backed, avoiding the nearly full VM disk. `public/data/fresh-generated/checks.json` and `artifacts.tar.gz` preserve the report, generated files, compilation logs and library. This partial Stage 2 evidence does not pass the other qualification stages.

## November 20 comparison update

- The visible title is **CogniPilot for Autonomous Drone Racing**; the paper and workspace label are hidden. `#paper` redirects to `#comparison`.
- Four fresh ARM rate-step attempts passed and landed: two per stack, no noise. Each pair has byte-identical trajectory hashes and verified 1,600 Hz counters. The frozen November 13 runner and firmware hashes match the displayed step family.
- Five ideal-attitude runs passed: hover, position step, square, figure-eight and a byte-identical figure-eight repeat. Their model overrides attitude only; common compiled parameters match the original plant.
- The existing Rust checker now integrates generated feed-forward body rates. Across 4,001 samples, the largest orientation residual was **6.9765448e-7 rad**, below the declared 2e-4 rad bound; quaternion norm drift was 2.5535e-15. This zero-state-error/fixed-heading check does not establish arbitrary closed-loop stability.
- Independent analytic checks verify derivatives through snap, frame orthonormality, quaternion integration refinement and size/time scaling.
- Validation changes extend the numerical checker and the native runner's input-matching and raw-measurement logging. Onboard controller equations, frozen flight firmware and the existing game/sim files were preserved.

**Validation status:** shared-controller isolation (stage 2) passes its declared numerical and ideal-flight checks. See the current matched campaign below for additional completed checks. The site does not assign a winner.

## Matched ARM qualification batch

`#comparison` leads with the new measurements; historical recordings are collapsed below them. The plan is frozen in `public/data/matched-qualification/protocol.json`: eight signed attitude probes, ten baseline flights, and sixty 40 s figure-eight repetitions across three noise profiles, five seeds and tilt lead off/on. Both stacks retain their onboard controller equations.

Shared settings: TROPIC RT1064 emulation; the same Rumoca plant and generated position loop; 2 kg and 500 mm diagonal; 8 kHz plant stepping; 1,600 Hz IMU/control scheduling; 100 Hz position updates; 250 Hz integer RC commands; virtual DShot600; equal 6/s attitude gain. Firmware counters, original config bytes and seeded IMU innovation files support matching. Ground-truth position feedback and assumed noise amplitudes remain explicit limitations.

Tracking scores are independently recomputed from stored 8 kHz binary measurements. The page adds signed attitude responses, 0.5 m position-step metrics, figure-eight path/error/altitude graphs, motor-limit fractions and repeatability statistics. Noise-free repeats test determinism rather than five independent noise realizations. Mean and sample standard deviation include every completed case, including failures.

All eight checks for this fixed-reference protocol passed. Each stack completed 39 flights; all 39 paired conditions match their configuration values, shared artifact identities, input-noise bytes and observed counters. All 78 scores reproduce the stored reports, and the four no-noise stack/lead groups each contain five byte-identical trajectories and motor traces.

The displayed 40 s figure-eight recordings use realistic noise, seed 1:

| Tilt lead | CogniPilot RMS / peak | Betaflight RMS / peak |
|---|---|---|
| Off | 0.1410 / 0.3473 m | 0.2025 / 0.5012 m |
| On | 0.1966 / 0.4995 m | 0.1426 / 0.3424 m |

These are paired condition measurements, not an overall ranking. The complete 60-run noise matrix is available on the page alongside both recorded 83 s takeoff-to-landing sequences.

The importer also audits the full sensor/noise trace cadence and quantization, command timing and encoding, distinct planned conditions, and the original acceptance thresholds. Expected host sensor traces are distinguished from onboard readbacks. Native coordinator records, launch scripts and the resource checkpoint accompany individual reports and logs. Frozen configuration metadata retains its preflight status labels; the derived summary reports qualification from the completed measurements.

Data refresh uses the existing native Rust campaign outputs copied from the VM:

```sh
node scripts/import-qualification.mjs
npm run data
```

The importer performs analysis only; it neither executes firmware nor replaces the project-native Rust/West workflow. The frozen source/executable archive and separately rebuilt native firmware checks are included in the downloadable evidence release.

## GitHub Pages and full evidence

[Open the simulation comparison](https://an1sura.github.io/PURT-UAS_Autonomous_Drone_Racing_Workspace/research/#comparison). Static Pages files are in `docs/research/`; editable application code, analysis and tests are in `web/flight-comparison/`. The Pages deployment uses `main:/docs`. No backend or physical flight command is exposed.

From `web/flight-comparison`, `npm start` previews the checked-in Pages export when a full local dataset is absent. For independent raw-data verification, download `simulation-evidence-20261121.tar.gz` and `SHA256SUMS` from the [evidence release](https://github.com/An1Sura/PURT-UAS_Autonomous_Drone_Racing_Workspace/releases/tag/matched-simulation-20261121), verify the archive, and extract it under `public/`:

```sh
shasum -a 256 -c SHA256SUMS
mkdir -p public
tar -xzf simulation-evidence-20261121.tar.gz -C public
npm test
```

The archive restores the complete `public/data/` tree, including compressed raw measurements, source overlays and simulation binaries. `npm test` recomputes and verifies the data rather than launching firmware. The original simulation-page hashes are checked against this repository; sibling Acro-game files are checked when that separate checkout is present. `npm run data` can reimport historical records from the repository root (`BENCHMARK_REPO` overrides its location). Reimporting new VM flights requires the native campaign files, not just page screenshots.

Rebuild the static export from the restored full evidence:

```sh
npm run build -- --output ../../docs/research --archive simulation-evidence-20261121.tar.gz
```

`data/evidence-storage.json` maps every original file to Pages or its exact archive entry. Each evidence dialog retains the individual file hash. `data/SHA256SUMS` verifies the deployed data files; `data/ORIGINAL-SHA256SUMS` preserves the original evidence manifest for the extracted archive. `npm run build` packages recorded data only; it is not a simulation runner.

## Evidence audit · November 21

Every chart has a **Data and calculation** disclosure and a downloadable **Source record** with original paths, SHA-256 digests, experiment family and calculation method. Every section has an evidence summary distinguishing measured simulation results, derived quantities, model assumptions and unmeasured hardware properties. The comparison also exposes every retained matched flight’s input configuration, report, raw traces and logs.

The **References & sources** section exports the site’s claim/source index. It distinguishes the 40 s matched qualification from the historical 33 s recordings and earlier Acro probes. `qa/evidence-results.json` records a browser audit of all twelve sections, every rendered graph’s provenance, missing evidence IDs, archive extraction paths and source-record downloads. The original 896 evidence digests and the 1.35 GB release archive remain unchanged; this update does not alter or rerun the simulations.

## Understanding the current results

The methodology and parameter-parity pages default to the completed **fixed-40 s matched ARM protocol** (8/8 check groups, 78/78 flights, 39 pairs). The broader project gates stay separate: fresh speed limits, full Acro/yaw mapping and physical timing are not marked complete. Original pre-flight configuration labels remain intact; completion is computed from final evidence.

**What do the numbers mean?** (`#numbers`) uses matched realistic-noise/seed-1 baselines, with a shared lead-off/on selector. It explains RMS/peak/altitude error, attitude rise/overshoot/settling, repeatability, motor saturation, planned course speed and why update rate differs from response latency. Values and course demands are computed from the dataset, not filled manually.

Firmware cards now use the current campaign’s frozen binaries. Static flash payload / RAM mapped by ELF are **229,328 / 260,340 bytes for CogniPilot** and **536,964 / 359,240 bytes for Betaflight**. These are unions of ELF load ranges, verified against the original ELF hashes, the archived Betaflight linker map and CogniPilot generated Devicetree. They exclude unrepresented reservations and do not establish runtime high-water memory, CPU utilization or electrical DShot timing. `tests/benchmark-guide.test.mjs` independently checks both archived images and memory maps; `qa/guide-results.json` records UI verification.

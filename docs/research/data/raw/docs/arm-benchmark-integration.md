# Shared ARM benchmark: integration and qualification

Updated October 22, 2026 against *CogniPilot vs Betaflight Flight Control Benchmark 2*.

## Execution path

```mermaid
flowchart LR
  T[Shared trajectory eFMU] --> P[Shared PositionLoop eFMU: 100 Hz]
  S[Rumoca quadrotor plant] -->|truth position and attitude| P
  P --> M[Normal stick mapping: tilt reference + omega / K]
  M -->|250 Hz commands| F[One ARM autopilot binary in FastDyn / QEMU]
  S -->|simulated IMU| F
  F -->|motor commands| S
  S --> L[Recorded truth, errors, tilt lead and limits]
  L --> V[Web flight replay and stats]
```

Run one autopilot at a time; the firmware does not execute inside the webpage.
Both adapters use the same course, plant, generated position loop and report format.
FastDyn manages rehosting and QEMU executes the ARM instructions. Shared-memory
adapters exchange virtual sensor and actuator data. The viewer replays the recorded
trajectory, including its actual final state.

## Cutover from the earlier prototype

The earlier recorded prototype injected rate and acceleration feed-forward into
modified firmware through extra RC channels. The updated method adds **omega/K
to the offboard tilt command**, then sends only ordinary roll, pitch, throttle,
yaw, arm and mode inputs. Betaflight PID and CogniPilot controller equations are
restored to upstream. Simulator clock/sensor/motor hooks remain; these binaries
are benchmark builds, not unmodified deployable hardware firmware.

Rate feed-forward is the first supported lead. Acceleration lead is rejected until
rate-only qualification establishes a need and its inversion is validated. No
acceleration term is silently sent through spare channels. Betaflight angle F is
zero. CogniPilot native gain tuning configures an existing generated tunable
parameter; ARM gains require regeneration/rebuild. Runtime mapping must use the
same gain as the firmware.

`tilt-lead.csv` records reference tilt, omega, lead, final clamped command and RC
values. A run with any tilt-clamp update fails qualification. Existing tracking,
arming, mode, geofence, ground-contact, disarm and stopped-motor gates remain.

## Team entry points

After building the pinned runner, offboard library and ARM firmware as documented
in `fastdyn/betaflight/README.md` and the existing RDD2 build instructions:

```sh
# Inside the rdd2 Devenv shell, from the workspace root:
src/cerebri_rdd2/target/release/xtask shared-loop-check \
  docs/config/shared-position-benchmark.json src/modelica_models \
  .devenv/state/results/rumoca/bin/rumoca artifacts/tilt-lead-generated
devenv -P rdd2 tasks run rdd2:benchmark:fastdyn:betaflight
devenv -P rdd2 tasks run rdd2:benchmark:fastdyn:cognipilot
```

Run the last two **sequentially**. FastDyn currently kills previous QEMU instances
on startup. Each task creates a fresh recording and mapped-memory directory.
`ADR_FLIGHT_SHAPE`, `ADR_SEED`, and `ADR_NOISE` select the test, seed and noise
profile; defaults are figure-eight, 1 and none. The configurations are
`fastdyn/betaflight/flight.toml` and `fastdyn/cognipilot/flight.toml`. Both read
`docs/config/shared-position-benchmark.json` through the common runner.
Native project interfaces remain Cargo for the runner, Make for Betaflight,
West/CMake for CogniPilot, and the FastDyn CLI for rehosting.

## Qualification gates before a performance claim

1. Generated reference and position-controller numerical checks; repeatability,
   sign, gain and feed-forward disengagement checks.
2. Ideal-attitude isolation and native hover, step, square, figure-eight gates.
3. Identical attitude tuning rule: 5-degree steps in both directions on both axes,
   realistic noise, gain candidates 2, 3, 4, 5, 6, 8, 10, 12 per second; 10–90%
   rise between 0.2 and 0.4 s, under 20% overshoot, settling within 1 degree by
   1 second. Reject a candidate on any failed probe. Preserve all attempts.
4. Rebuild ARM firmware with selected gains, verify actual command/rate behavior,
   then repeat ARM flights. A mathematical lead identity alone does not establish
   exact Betaflight response through its filter/PID, nor exact large-angle behavior.
5. Only after qualification: speed sweep, feed-forward off/on, three noise levels
   and at least five seeds per cell. Report losses and spread, not only best runs.
6. Hardware team measures IMU/SPI/DMA/interrupt delay and jitter. Add measured
   timing distributions before hardware validation; verify MoCap coverage and
   trainer-link behavior separately.

## Limits that remain material

The current emulation uses virtual I/O, not full peripheral timing. Betaflight
executes on the selected STM32F405 target and CogniPilot on TROPIC; this does not
identify the team's physical Betaflight board. Firmware exchange schedules and
sensor quantization differ. Noise levels are diagnostic assumptions. QEMU wall
seconds are computer runtime, never flight speed or hardware latency. The web
replay does not establish hardware readiness. Numerical checks are not formal
proofs of the complete firmware.

No non-inferiority margin is asserted: the PDF gives examples, and the team must
fix the scientific margins before comparison. Existing commissioning gates are
engineering checks, not an agreed non-inferiority test.

## Recorded results from this cutover

Both ARM runs use the same 10 × 10 m course at 2 m, one 40 s reference lap
(25–65 s), and an 83 s complete mission. Both have zero tilt clamps, four ordered
course quadrants, return to center, ground contact, firmware disarm, and all four
motor commands zero. The final trajectory sample is retained in the replay.

| ARM stack | RMS tracking error | Maximum error | Firmware exchanges |
|---|---:|---:|---:|
| Betaflight / STM32F405 | 0.143412 m | 0.348384 m | 664,000 |
| CogniPilot / TROPIC | 0.190634 m | 0.491917 m | 132,800 |

These are same-time 3D position errors during the reference lap, not distances to
the nearest point on the curve. The baseline uses no added noise and truth position
feedback. Firmware exchange count is not a physical IMU sample count.

[ARM reports and full trajectories](results/tilt-lead/fastdyn/),
[tuning measurements and all attempted gains](results/tilt-lead/tuning/),
[build/test/run logs](evidence/tilt-lead-2026-10-22/).
The runner has 53 passing unit tests and two ignored tests. Twelve initial
commissioning runs (ideal and both native stacks: hover, step, square, figure-eight)
passed; their reports retain their original pre-tuning configuration.

Both ARM reports have identical plant, offboard-library, runner and config hashes.
The native speed campaign kept its existing offboard library immutable. Its binary
hash differs from the ARM library, but the generated PositionLoop C and shared shim
are byte-identical: [source checksums](evidence/tilt-lead-2026-10-22/source-identity.txt).
[ARM-library numerical checks](results/tilt-lead/arm-library-checks.json) identify
that exact library; [regenerated checks](results/tilt-lead/checks.json) cover the
subsequent gain-6 generation. Numerical-check “pending gates” describe status at
generation time, not the later flight results.

Legacy actuator CSV columns named for extra feed-forward channels now contain
neutral values. The actual normal-stick lead is logged in `tilt-lead.csv`.
Raw actuator binaries and full calibration time series remain on the VM and local
workspace; published hashes identify the ARM actuator traces.

## What the speed screening can establish

Native speed screening uses the same gain-6 profiles, unchanged RMS <0.35 m and
maximum <0.75 m gates, zero clamps, complete course and verified landing. It searches
a descending coarse grid and refines in 1 s increments. The candidate must pass
all 15 confirmations (none/realistic/harsh diagnostic noise × seeds 1–5); failed
candidates are retained. Five realistic-noise comparisons disable tilt lead at
the selected duration. This is not a separately optimized feed-forward-off search.
No-noise seeds have identical inputs and do not establish independent robustness.

These tests are exploratory screening, not a final stack ranking. Actual onboard
rate-command lead diagnostics and estimator-error diagnostics remain incomplete;
that qualification must precede a scientific performance claim. The ARM speed
boundary and physical-board timing are not measured by the native sweep.

The completed lead-on native sweep selected **26 s for Betaflight** (1.813 m/s
mean reference speed) and **33 s for CogniPilot** (1.429 m/s). There were 28
Betaflight attempts and 42 CogniPilot attempts, including rejected candidates and
comparators. The selected duration passed 15/15 confirmations for each stack.
CogniPilot's 32 s candidate failed confirmation, including a 0.751889 m no-noise
maximum error; the 0.75 m gate was retained.

At those same durations, lead-off comparisons passed 0/5 for Betaflight and 5/5
for CogniPilot. CogniPilot lead-off RMS was approximately 0.187–0.188 m, better
than its lead-on results. Thus the lead-on search is not evidence of CogniPilot's
best achievable configuration. Do not treat these two selected times as a final
performance ranking; verify its command/derivative behavior and search off-mode
performance before selecting the next baseline.

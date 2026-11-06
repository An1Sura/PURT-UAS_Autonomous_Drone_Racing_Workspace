# Simulation qualification against the supplied benchmark

Reference: *CogniPilot vs Betaflight Flight Control Benchmark 2 (2).pdf*, 13 pages, supplied by the team; read November 6, 2026. This is the normal-stick/offboard tilt-lead design. Do not reintroduce onboard feed-forward control changes. The main comparison isolates onboard estimation, attitude control and rate control using one generated position loop and one plant.

## Acceptance and evidence

Existing engineering gates remain RMS <0.35 m, maximum error <0.75 m, zero tilt-clamp updates, ordered course quadrants, full extents, center return, no second lap, and landing/disarm/stopped motors. They are not an agreed non-inferiority margin. Report the fastest **tested and confirmed reference duration**, not a global physical maximum or a precise race-gate lap time.

| PDF requirement | Existing evidence | Remaining qualification |
|---|---|---|
| 1.1 Deterministic exchange | Native repeat traces and sequence checks; current BF 40 s no-noise seeds 1 and 3 have identical trajectory hashes, including one read-only observation run | Repeat the selected current ARM configurations and report trace equality/spread |
| 1.2 Seeded noise/vibration | Shared noise generator; none/realistic/harsh levels | ARM confirmations; sensor delivery/quantization differences remain disclosed |
| 1.3–1.4 Stick mapping | Shared six-channel commands, 250 Hz schedule, 35° tilt; configured Betaflight smoothing off | Current ARM sign/steady-tilt and exact yaw-scale parity qualification |
| 1.5 Lead rate-command check | Algebraic/numerical identity and tilt-lead logs | Actual onboard rate-command comparison on each axis; the algebra test is insufficient |
| 2.1–2.2 Generated controller | Rumoca-generated trajectory/position C; GuidanceController oracle checks and hashes | Preserve exact library hashes with every new campaign |
| 2.3 Ideal-attitude isolation | Existing ideal hover, step, square and figure-eight reports | Compare current selected speed candidates to the ideal baseline |
| 2.4 Integrated feed-forward consistency | Derivative numerical checks | Explicit integrated-attitude comparison required; derivative checks alone do not close this item |
| Same-rule attitude tuning | Native four-sign/axis step campaign selected gain 6/s | Requalify current ARM firmware; NXP inherited gain is not a new tuning measurement |
| Stage 3 baseline sequence | Current ARM figure-eight/landing; NXP hover and position step | Both modes and complete current-target hover/step/square qualification |
| Stage 3 speed/repeats | Native speed campaign; new FastDyn ARM campaign underway | On/off searches, three noise levels and five seeds per selected cell; preserve every failure |
| Stage 4 position/actuator scores | Position RMS/max, altitude summaries, clamp counts, motor/disarm state, trajectories and actuator traces; partial actual ARM yaw PID/gyro telemetry validated against motor records | Altitude/overshoot summaries, estimator-vs-truth error, attitude tracking and actual rate-command decomposition |
| Conference timing claims | Simulator execution and exchange counts only | Physical loop latency, driver overhead and hardware jitter require measured hardware; QEMU runtime cannot substitute |

The PDF's five-repeat requirement and equal tuning rule apply to both stacks. Its non-inferiority ratios are examples, not approved thresholds. No superiority claim is justified until prerequisite gates, parity limits and scientific margins are settled.

## Targets

- CogniPilot: TROPIC RT1064 Cortex-M7 / Zephyr, pinned existing ARM binary.
- Betaflight: MR_VMU_TROPIC RT1064 Cortex-M7, pinned proposed NXP support plus simulation I/O adapter; stock control equations.
- ArduPilot: existing FastDyn ArduCopter 4.6.2 FMUv3 STM32F427 Cortex-M4 binary, explicitly permitted by the user; separate integration target, not a matched-board timing result.
- PX4: official nxp_mr-tropic_default RT1064 Cortex-M7 / NuttX; simulation-only storage/peripheral changes, no controller changes.

The PDF's primary controlled comparison is CogniPilot/Betaflight. Adding ArduPilot/PX4 does not automatically make their native Guided/Position modes comparable to the shared-position-loop experiment. Their command boundary and vehicle/sensor conditions must be matched or labeled separately.

## Execution

The existing Rust `shared-sil-speed` command now accepts a FastDyn backend through `RDD2_SPEED_FASTDYN_CONFIG` and `RDD2_SPEED_FASTDYN_EXECUTABLE`. It invokes the same supervised `shared-sil` mission from the supplied FastDyn configuration. No Python benchmark runner was added. A fresh output directory is mandatory; the predeclared rule and all failed attempts are retained. QEMU jobs are sequential because FastDyn's startup stops existing QEMU processes.

Current sweep uses the unchanged 10 × 10 m figure-eight at 2 m, the same generated position loop/plant, and descending lap targets with 1-second refinement. Results remain exploratory until the unresolved prerequisite rows above pass. A run with a shorter reference but excessive error, clamp activity, incomplete course or failed landing does not count as faster successful flight.

## November 6 integration audit

The inherited ArduPilot FastDyn demo contained register/function overrides of arming checks. `ARMING_CHECK=1` alone did not restore those checks. The checked-hook configuration removes the identified arming, INS-calibration, barometer and compass-validity overrides. Attempts 09–10 use the restored checks; earlier attempts are diagnostic only. Actual firmware debug information identified a 1 MHz timer ABI, 8 kHz raw IMU FIFO sampling, and barometer frontend fields. Correcting those interfaces allowed EKF tilt/yaw alignment and GPS fusion. Attempt 10 accepted normal simulated calibration but refused arming because logging and terrain storage remain unavailable. No ArduPilot flight is qualified.

### Current speed finding

The 33 s Betaflight TROPIC candidate passed 13/15 confirmations. Harsh-noise seeds 2 and 3 failed landing/disarm despite meeting course tracking limits. Seed 2 never contacted the ground (recorded minimum landing-phase altitude 0.174 m), ending at 0.610 m armed with nonzero motor outputs. Oscillating yaw and opposing motor commands increase during descent; this observation does not yet identify the cause. The 34 s candidate also finished at 13/15, with harsh-noise seeds 2 and 5 failing. The 35 s candidate finished at 14/15, with harsh-noise seed 2 failing landing. The 40 s candidate also finished at 14/15, with harsh-noise seed 3 failing landing. The PWM campaign ended after 66 attempts (58 passes) with no qualified candidate. A separately isolated protocol diagnostic is pending; it must not be reported as a fix before it runs. Do not report 33 s as a confirmed reliable speed.

### Fresh-setup blocker

The original upstream FastDyn branch and both historical commit URLs are unavailable. Verified full-history backups survive locally; current VM tests continue. Clean network-only reproduction and cache CI remain blocked until those sources are made available again. See [source recovery](fastdyn-source-recovery.md).

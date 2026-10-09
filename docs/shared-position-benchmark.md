# Shared-controller SIL: current evidence

Updated October 9, 2026. The supplied benchmark PDF defines the architecture: one generated trajectory and position loop commands Betaflight ANGLE or CogniPilot ATTITUDE against the same Rumoca/FMI plant. That flight path is now implemented and exercised. This is commissioning evidence, not completion of every PDF qualification gate.

## New full-course recordings

One **10 × 10 m** figure eight, **2 m altitude**, minimum-jerk phase, **80 s timed reference**. Both runs use the same generated offboard library and full-dynamics plant; their hashes are embedded in the reports.

| Stack | Same-time position RMS | Maximum error | Reference duration | Full run | End state |
|---|---:|---:|---:|---:|---|
| Betaflight ANGLE | 0.066723 m | 0.175127 m | 80 s | 123 s | Grounded, disarmed, all motors zero |
| CogniPilot ATTITUDE | 0.134227 m | 0.271192 m | 80 s | 123 s | Grounded, disarmed, all motors zero |

[Watch actual telemetry](sim/) · [All attempt reports](results/shared-sil/attempts/) · [Source map](repository-map.md).

The acceptance thresholds were set before these runs: course RMS <0.35 m, maximum <0.75 m, correct armed self-level mode, and at least 0.5 s grounded/disarmed/stopped at the end. These are commissioning thresholds. Faster-flight qualification must predeclare its own repeatability and accuracy rules. No fastest-lap claim is made here.

Timing: 0–8 s estimator warmup; arm at 8 s; takeoff 9–15 s; hover 15–25 s; course 25–105 s; end hold 105–110 s; descent 110–118 s; settle through 123 s. Touchdown detection triggers disarm. Height near 0.0984 m is the plant's resting body height, not a missing landing. The lap duration is the commanded reference window, not an independent geometric crossing measurement. RMS is sqrt(mean(||p_actual(t) − p_reference(t)||²)) over the course window at the plant tick rate. Total runtime includes warmup/takeoff/landing. Host wall time is separately recorded and is not flight or hardware latency.

## What changed

- New native Rust `shared-sil` command loads the same generated trajectory and position controller for both stacks, updates position control at 100 Hz and sticks at 250 Hz, and records actual full-plant motion.
- Betaflight's simulator-only patch provides sequential packet IDs, timestamp validation and one main-thread sensor/scheduler/motor exchange at 8000 Hz. It retains stock flight-control and estimator algorithms. Normal arming remains enabled.
- The common IMU source samples at 1600 Hz. Betaflight holds those samples across its 8000 Hz packets; CogniPilot exchanges at 1600 Hz. CogniPilot stick delivery can be quantized by up to 0.5 ms. This remaining difference is explicit.
- Both RC receivers require negative yaw-stick encoding for the common positive ENU yaw rate. Initial square/figure-eight trials exposed the incorrect sign; those failures are preserved rather than relabeled as completed flights.
- Shared takeoff/landing comes from the generated position loop, without the old simulator-assisted throttle laws.
- Optional ideal-attitude physics isolates the outer position loop using the same motor/force model. Full firmware runs load the unchanged full-dynamics plant artifact; ideal tests do not execute firmware.
- Old website replay payloads were removed. New replays retain genuine final samples; Three.js only displays telemetry.

## Checks and limits

Native Rust tests: **45 passed, 2 ignored**. Generated reference/oracle checks passed. Ideal-attitude hover, step, square and figure-eight checks passed. Both real stacks passed hover, step, square and full-course commissioning runs (the initial square tests predate the final yaw mapping; corrected full-course flights are the current evidence). Betaflight's two full-course repeats had byte-identical 100 Hz trajectory CSV and complete 8000 Hz response traces. CogniPilot’s two corrected full-course repeats also had byte-identical CSV and motor traces. See [repeatability hashes](results/shared-sil/repeatability-sha256.txt).

Still required before full PDF qualification or a fair speed ranking:

- Empirical Betaflight hover-throttle calibration; current conversion uses nominal sqrt(mg/Tmax). RC smoothing is OFF, angle limit 35 degrees, yaw limit 200 degrees/s; CogniPilot native yaw normalization is 3.5 rad/s.
- Expanded commanded-versus-estimated attitude and saturation diagnostics, and independent geometric course-completion gates.
- Motor-vibration noise model and the prescribed three noise levels with at least five seeds per level, alternating stacks. Current published flights are noise-free; noise magnitudes in the harness are diagnostic assumptions, not measured IMU data.
- Matched sensor delivery/timing, measured physical vehicle properties and hardware latency tests. SIL uses plant-truth position feedback; it does not reproduce a measured QTM pipeline.
- PURT origin, obstacle inventory and calibrated MoCap coverage survey. The course fits the approximate room box, but actual clearance/coverage remains unverified.
- Equal-budget gain tuning and shorter-lap speed search. These 80 s runs do not demonstrate CogniPilot surpassing Betaflight.

## Reproduce in the existing VM

Use the tested revisions and [dependency patches](../patches/README.md). The exercised environment is Ubuntu Linux with Nix/Devenv, not NixOS. From the workspace root inside the RDD2 shell:

```sh
cargo test --locked --manifest-path src/cerebri_rdd2/xtask/Cargo.toml
cargo build --release --locked --manifest-path src/cerebri_rdd2/xtask/Cargo.toml
src/cerebri_rdd2/target/release/xtask shared-loop-check \
  docs/config/shared-position-benchmark.json src/modelica_models \
  .devenv/state/results/rumoca/bin/rumoca artifacts/shared-loop
src/cerebri_rdd2/target/release/xtask shared-sil \
  docs/config/shared-position-benchmark.json \
  src/modelica_models/artifacts/vehicles/rdd2/plant/Vehicles_Rdd2_Plant \
  artifacts/shared-loop/libshared_loop.so \
  artifacts/shared-loop/betaflight-stock/obj/main/betaflight_SITL.elf \
  betaflight artifacts/shared-sil/bf-fresh-run figure-eight
```

For CogniPilot, substitute `src/cerebri_rdd2/build-native_sim/zephyr/zephyr.exe`, stack `cognipilot`, and a fresh output directory. Never overwrite an attempt. Each run produces `config.json`, `trajectory.csv`, `actuator-trace.bin`, `firmware.log`, `report.json` and `replay.json`; Betaflight also saves provisioning commands/logs. The website is a replay, not a browser physics simulation. These native runs were launched on the VM; the old native-position web-run API is not the new benchmark launcher.

Large binary traces and original 100 Hz CSV remain in the VM under `artifacts/shared-sil`. Website replay exports are sampled at 20 Hz, retain the final sample, and do not recompute report metrics. Earlier failures remain in the attempt reports and VM, with no fabricated landing. Old recordings remain recoverable from Git history.

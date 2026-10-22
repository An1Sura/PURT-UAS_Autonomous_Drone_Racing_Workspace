> Historical prototype report. The October 22 cutover replaces onboard extra-channel feed-forward with normal-stick offboard tilt lead. See [current integration and qualification](arm-benchmark-integration.md). Numbers below belong to the earlier implementation.

# Shared-controller SIL: current evidence

Updated October 13, 2026. The updated PDF’s rate and acceleration feed-forward is implemented in both native stacks. One shared Rumoca/FMU plant and generated position loop fly a **10 × 10 m figure eight at 2 m altitude**, one **40 s reference lap**, **83 s full run**. This is commissioning evidence, not full PDF qualification or a fastest-lap ranking.

[Six actual recordings](sim/) · [Implementation, equations and remaining gates](feedforward-update.md) · [Repository provenance](repository-map.md) · [Previous baseline](archive/shared-position-2026-10-09.md)

## Measured noise-free results

| Stack | Feed-forward | RMS error (m) | Maximum error (m) |
|---|---|---:|---:|
| betaflight | off | 0.217412 | 0.539437 |
| betaflight | omega | 0.142423 | 0.348755 |
| betaflight | omega_alpha | 0.142516 | 0.348471 |
| cognipilot | off | 0.188374 | 0.470864 |
| cognipilot | omega | 0.209842 | 0.550253 |
| cognipilot | omega_alpha | 0.213908 | 0.565317 |

Feed-forward improves Betaflight here, but worsens CogniPilot with the current gains. All six recordings land, disarm and stop their motors. All **60 campaign runs** passed predeclared RMS <0.35 m, maximum <0.75 m and landing gates: two stacks × three assumed noise levels × five seeds × FF off/full. Rate-only flights are additional diagnostics. No upper actuator saturation occurred in campaign course windows.

Each stack’s five noise-free repeats have identical trajectory and actuator traces. FF off also reproduces preserved pre-change firmware’s trajectory CSV and actuator trace byte-for-byte under the same configuration.

## Timing and interpretation

Warmup 0–8 s; arm at 8 s; takeoff 9–15 s; hover 15–25 s; course 25–65 s; hold 65–70 s; descent 70–78 s; settle through 83 s. The sole cumulative reference lap ends at 65 s. Lap time is the reference window, not an independent geometric crossing. RMS is sqrt(mean(||actual position − same-time reference||²)) over that window. Host execution time is not hardware latency.

Plant: 8 kHz; IMU: 1.6 kHz; position loop: 100 Hz; stick schedule: 250 Hz. CogniPilot has up to 0.5 ms stick-delivery quantization and synthetic GNSS for navigation/arming; Betaflight GPS is disabled. Position feedback is plant truth. Noise and motor harmonics are assumed diagnostic models. The black grid and green PURT boundary remain; approximate room-envelope fit does not establish surveyed obstacle clearance or calibrated MoCap coverage.

## Verification and limits

47 native Rust tests passed, 2 ignored; 16 Betaflight PID tests passed; generated CogniPilot C checks passed; ideal hover, step, square and figure-eight passed. Generated formula checks use a finite-difference oracle. Existing Lean proofs do not prove the new firmware or feed-forward implementation.

Matched attitude-step tuning, measured Kf calibration, physical sign checks, hardware builds/latency tests, independent crossing gates, measured sensor parity and equal-budget speed optimization remain. Simulation hover calibration does not replace physical calibration. See the detailed update for derivative assumptions and C2 joins.

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


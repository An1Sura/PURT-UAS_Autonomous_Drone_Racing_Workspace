# Recorded ARM step-response tests — November 12, 2026

These are new bounded diagnostic flights, not figure-eight replay estimates or physical hardware measurements. Both execute TROPIC RT1064 Cortex-M7 firmware in FastDyn/QEMU against the same Rumoca-generated RDD2 plant and generated PC position controller.

## Inputs and measured outputs

| Test | Input at simulated t = 25 s | Measurement | Loops included |
|---|---|---|---|
| Attitude | +5° roll for 1.2 s, then position recovery | Plant roll angle | Onboard attitude and rate loops, mixer, actuator and plant |
| Acro rate | +10°/s body roll for 0.4 s, zero rate for 0.2 s, then attitude/position recovery | Plant body roll angular velocity, not differentiated Euler angle | Onboard rate loop, mixer, actuator and plant; attitude loop bypassed during pulse |
| Position | +0.5 m east, held for 10 s and through landing | Plant east position | Shared PC position loop plus each stack's attitude/rate loops |

Initial hover is 2 m. The test starts after identical arm/takeoff/warmup scheduling. Shared altitude control remains active during roll probes. The attitude and rate probes intentionally permit lateral drift; the figure-eight tracking-error gates do not apply. Completion requires the recorded recovery, native disarm, ground contact and stopped motor commands. Raw report `passed` means those diagnostic completion checks, not a predeclared response-performance qualification.

Only positive roll and positive east are tested here, once per stack without added sensor noise. Pitch, yaw, negative steps, noise repeats and physical measurements remain future work. This is not a fastest-flight comparison.

## Common settings and remaining differences

- Same plant and offboard-library hashes, vehicle, 8 kHz plant integration, 100 Hz PC controller, 250 Hz RC scheduling, nominal 1.6 kHz IMU samples, seed 1, no added noise, no offboard tilt lead.
- Onboard controller equations are unchanged. Existing gains are retained; this campaign measures them and does not establish equal current-target tuning.
- Betaflight uses its NXP TROPIC simulation firmware, OneShot125, PID denominator 1, ANGLE for attitude/position and ANGLE disabled for Acro. The published CLI transcript records the applied settings. The absence of ANGLE is the adapter's Acro mode check; HORIZON is not configured.
- CogniPilot uses its Zephyr TROPIC FastDyn firmware and virtual DShot motor path. Its mode is read back explicitly (Acro 0 / attitude 1).
- The adapter sends Betaflight packets at 8 kHz while holding the sampled IMU; CogniPilot exchanges at 1.6 kHz. These are not identical ingress timing or motor-protocol implementations and cannot establish physical driver latency.
- For the same requested 10°/s, RC values differ: CogniPilot maps full roll stick to 6 rad/s; Betaflight ACTUAL rates are configured to a linear 200°/s full scale. Integer microsecond rounding makes CogniPilot's nominal decoded request approximately 10.31°/s versus Betaflight's 10°/s. Graphs show the requested 10°/s; this quantization is not hidden as a controller error.
- Raw report tuning labels inherited from older campaigns are not evidence of new tuning. Use this document's scope and the frozen configuration.

## How metrics are calculated

The plot and metrics come from `step-response.csv`, sampled every 0.625 ms before advancing the plant. The command timestamp is the host request, not proof of the exact firmware-consumption instant. Mode-switch checks allow 100 ms for processing.

Rise time is the difference between first 10% and 90% crossings from the mean measured baseline over the preceding 0.2 s toward the requested target. Overshoot is the positive peak above the target, divided by step amplitude, during the held-input window. Settling is the first sample after the last departure from a ±5% amplitude band, with at least 0.1 s remaining in the held window. An absent settling result means it was not demonstrated within the window. End-of-hold error uses the last 0.1 s. The attitude and position plots stop at the evaluation-window end. The Acro plot also shows the subsequent zero-rate interval; position recovery is outside that plot.

The analysis tool is `tools/plot-step-responses.py`. `summary.json` includes full firmware, runner, plant, library and configuration hashes plus SHA-256 of each raw step-response log. The CSVs alongside the graph expose the plotted time windows at original sampling rate.

## Source provenance

- CogniPilot: the existing workspace's `src/cerebri_rdd2` TROPIC Zephyr firmware; exact ELF hash in each report.
- Betaflight: NXP-support source revision `e1d8d27f59fa166bd637f59d465437212cdc9cdd`, TROPIC configuration revision `43f9df5ee4adf747603b4ade0daddeab2c4b100c`, with the existing simulation interface; this is not the unpatched hardware flashing image.
- Modelica plant: `CogniPilot/modelica_models` revision `a41f7c0c00b55c1bf54f03c9b66b901ba8e43c6f`, exported with Rumoca. The plant hash is recorded per flight.
- FastDyn/QEMU: the workspace's pinned FastDyn installation and existing TROPIC rehosting configurations. Their resolved configuration and run logs are retained.
- New step injection and logging are confined to the host runner, `xtask/src/shared_sil.rs`; the before/after patch accompanies the results. No autopilot controller equations were edited.

## Retained larger-pulse failures

The initial Acro probe requested 30°/s for 0.6 s, then zero rate for 0.6 s. Both stacks tracked the rate command but aborted during subsequent position recovery: Betaflight at 32.052 s (45.05° tilt), CogniPilot at 31.881 s (45.01° tilt). Those are failed flights, not successful landings. The follow-up reduced the shared pulse amplitude and duration to limit drift; no autopilot gains or equations changed. Both runner versions and all eight attempt folders are retained. A complete explanation of the larger recovery instability requires further investigation; these runs alone do not prove an autopilot defect.

Source revisions checked directly in the VM:

- [Cerebri RDD2](https://github.com/CogniPilot/cerebri_rdd2/tree/bf784c752f7767bd1a8712a7fc64c5b522000323), with existing local emulation changes and the separately preserved runner changes.
- [Modelica command mapping](https://github.com/CogniPilot/modelica_models/blob/a41f7c0c00b55c1bf54f03c9b66b901ba8e43c6f/Vehicles/Rdd2/CommandMapping.mo).
- [Rumoca](https://github.com/CogniPilot/rumoca/tree/4d0e521d9a0bd2527808dbce2c5689834d1a0349).
- [FastDyn](https://github.com/jgoppert/FastDyn/tree/94c85f3e47be410e8d760b7f8207eb1580d7cd4c).
- [QEMU fork](https://github.com/Arslan8/qemu/tree/99b54836ded8dc3271eba52deee7453efc0a13b9).

These checkout revisions identify the source context; generated artifacts are identified by their hashes, rather than assuming an unmodified checkout reproduces a locally patched binary. Existing source-recovery bundles and firmware evidence are in the [raw-data release](https://github.com/An1Sura/PURT-UAS_Autonomous_Drone_Racing_Workspace/releases/tag/raw-data-nov-20261110).

Command changes are evaluated on the 100 Hz host-controller grid. Nominal pulse boundaries can therefore differ by one 10 ms sample because of floating-point boundary evaluation; the actual requested-command samples are retained. Metrics use the stated fixed evaluation windows, and the summary also reports observed command-hold duration. The `mode_matches` column is a check against the requested mode, not an onboard mode enumeration.

## Reproducing the host changes

`runner.patch` applies to the preserved pre-test `shared_sil.before.rs` in the raw archive. `runner-v1.rs` is the first six-flight runner (including the retained larger-pulse failures); `runner-v2.rs` contains only the smaller Acro probe revision. Build the native `cerebri-rdd2-xtask` Cargo package in the existing CogniPilot Devenv toolchain. The raw archive contains both frozen runner binaries, resolved FastDyn configurations and exact launch scripts/environment paths. Use fresh output directories; the runner deliberately rejects existing flight folders.

The analysis is reproducible with:

```sh
python3 tools/plot-step-responses.py <extracted-step-tests-20261112-directory> docs/results/step-tests-20261112
```

Dependencies: NumPy and Matplotlib. This analyzes recorded data; it does not rerun firmware or synthesize responses.

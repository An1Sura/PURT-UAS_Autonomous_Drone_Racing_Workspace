# Rate-matched virtual-DShot ARM step tests — November 13, 2026

This is a controlled simulation-scheduling experiment on TROPIC RT1064 ARM firmware in FastDyn/QEMU. Both stacks use the same Rumoca plant, virtual DShot codec, 1,600 Hz fresh IMU schedule, 1,600 Hz control/motor-update schedule, 100 Hz PC position controller and 250 Hz command generation. Latest commands are delivered on the same 625 µs sensor boundaries. Controller equations and gains are unchanged.

## What changed and why

The previous DShot campaign ran Betaflight's gyro/PID at 8 kHz while CogniPilot exchanged sensors and motor commands at 1.6 kHz. Its graphs remain archived in [the previous campaign](../dshot-steps-20261112/README.md).

For this experiment:

- Betaflight's virtual gyro is built with `VIRTUAL_GYRO_SAMPLE_RATE_HZ=1600`. Normal configuration uses DShot600, telemetry off, `pid_process_denom=1` and `imu_process_denom=1`. The firmware must read back a 625 µs PID period.
- Betaflight's normal mode logic drops its attitude-estimator task to 100 Hz outside angle modes. An `ADR_FASTDYN`-only scheduling override keeps that task at the sensor rate in Acro too. Its equations remain unchanged. This is an explicit experiment, not a stock hardware default.
- CogniPilot retains its 625 µs rate loop and now uses 1,600 Hz estimator and attitude-guidance releases in `CONFIG_RDD2_FASTDYN` builds, replacing the native 1,000 Hz and 200 Hz dividers for this experiment. Generated-model sample-period parameters are set to 625 µs before recalibration; equations and gains are unchanged. The host reads separate estimator, guidance and motor-publication counters. A completion barrier prevents the next host input from overwriting an unconsumed estimator/guidance release. Hardware/native defaults remain unchanged.
- Betaflight's transport clock still advances at 8 kHz so its scheduler can run other tasks between sensor/control updates. These transport calls are **not** 8 kHz sensor samples or motor writes. The plant also retains its 125 µs integration step.
- Both receive the latest 250 Hz virtual-pilot command on the next shared 625 µs boundary. This removes the earlier host-delivery scheduling difference; internal receiver processing remains part of each stack.

## Verification, not just labels

Between simulated t=25 and t=26 seconds, the runner reads firmware counters and rejects a flight unless Betaflight records exactly 1,600 gyro reads, accelerometer reads, attitude-task calls and motor writes, and CogniPilot records exactly 1,600 motor publications, sensor/motor exchanges, navigation-estimator steps and guidance-controller steps. The graph analysis independently checks Betaflight's raw motor-write trace, including every inter-update interval in that second, PID-period readback and both stacks' DShot quantization. Reports and summary contain the observed counts and source/configuration hashes.

The preliminary Betaflight attitude attempt was rejected because counters showed 1,600 gyro/accelerometer reads but only 800 attitude updates. Mode logic had applied its default estimator divider. The corrected experiment explicitly sets that divider to one and fixes the Acro-mode rate switch. A subsequent provisional campaign verified sensor/motor matching but retained CogniPilot’s native estimator/guidance dividers; it is also excluded from the final displayed campaign. The final campaign uses a rebuilt CogniPilot firmware with those internal rates and model sample periods matched too. The preliminary CogniPilot attitude flight was allowed to finish; both preliminary attempts are retained separately and excluded from the displayed final campaign.

## Tests and scoring

After takeoff to 2 m, at t=25 seconds:

| Probe | Command | Response | Scoring window |
|---|---|---|---|
| Attitude | +5° roll | Plant roll angle | 1.2 s |
| Acro | +10°/s roll rate, then zero | Plant body roll rate | 0.4 s positive pulse |
| Position | +0.5 m east | Plant east position | 10 s |

Rise time is the first 10%–90% crossing interval relative to the pre-step baseline. Settling requires remaining inside ±5% for the rest of the held-input window with at least 0.1 s remaining. Overshoot is the peak excess over the nominal command. A flight can complete and land without meeting the settling criterion. Landing requires ground contact, native disarm and stopped motors; intentional roll-probe drift is not scored as a figure-eight failure.

These remain single noise-free positive-axis probes. Integer RC encoding gives CogniPilot approximately 10.31°/s for the nominal 10°/s command, versus approximately 10°/s for Betaflight. That input quantization is not removed by matching update rates.

## What this comparison does and does not establish

The same physical plant, motor-command encoding and nominal sensor/control schedules remove specific confounding variables from the previous plots. They do **not** make the stacks identical: sensor numerical representation, filters, estimator algorithms, receiver processing and controller implementations differ. Plant truth supplies the PC position feedback. No real processor execution time, ISR/SPI/DMA cost, physical DShot waveform, ESC telemetry or radio latency is measured. Matching task frequency does not establish equal hardware jitter or reliability.

These builds are simulation-only and must not be flashed as hardware firmware. The figure-eight recordings below the step graphs retain their previous configurations; they were not rerun or relabeled by this campaign. This campaign is not a fastest-lap or retuning qualification.

## Reproduce the figures

The source patches, configurations, per-flight reports and hashes accompany these results. The unchanged DShot codec and its exhaustive command/checksum tests are in the previous campaign. Source repositories remain CogniPilot `cerebri_rdd2`, `modelica_models`, Rumoca, FastDyn and its QEMU fork, and Betaflight's NXP TROPIC branch, with the disclosed local simulation patches.

```sh
python3 tools/plot-step-responses.py <raw-campaign-directory> docs/results/rate-matched-steps-20261113 --rate-folder-suffix '' --protocol-label 'Matched 1.6 kHz sensor/control schedule · virtual DShot' --matched-rates
```

`repositories.json` records the VM repository HEADs. These were already modified benchmark working trees: the included patches are incremental from the preceding DShot campaign, not complete overlays against pristine upstream HEADs. Frozen firmware/runner hashes identify the executed builds; earlier source-recovery bundles and prior campaign patches remain necessary for a full rebuild. The complete raw campaign and frozen binaries are retained locally.

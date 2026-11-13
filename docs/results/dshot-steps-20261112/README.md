# DShot ARM step-response rerun

Both TROPIC RT1064 firmware builds now feed the same command-level, unidirectional DShot frame codec before their motor outputs reach the shared Rumoca plant. This reruns the prior positive-roll attitude and Acro probes and positive-east position step. Onboard controller equations and gains are unchanged.

## What changed

Previously Betaflight selected OneShot125 and converted 1000–2000 analog motor values to normalized plant inputs. CogniPilot computed DShot codes but published its pre-quantization floats to the simulation. Calling that a matched DShot benchmark would have been incorrect.

Now:

- **Betaflight:** selects `DSHOT600`, telemetry off, PID denominator 1. Its normal DShot mixer endpoint logic produces native throttle values. The simulation adapter rounds them to integer codes, encodes a DShot frame, validates/decodes it, then passes normalized values to the plant. A simulation-only virtual device replaces physical FlexIO/DMA initialization. Firmware readback must confirm DShot600; an old ELF fails that check.
- **CogniPilot:** retains its existing `motor_to_dshot` mapping, then encodes and decodes those actual integer codes before publishing the plant input. A separate tagged `rdd2_fastdyn_dshot_frames` mailbox carries the actual frames to the host, which validates their checksum and decodes them directly. The old PWM-microsecond topic is not used for this ARM plant input. This change applies only under `CONFIG_RDD2_LOCKSTEP`; the physical driver and controller equations are unchanged.
- **Shared codec:** code 0 stops; codes 48–2047 map to `(code − 48) / 1999`; reserved commands 1–47 are rejected. The 16-bit frame contains the 11-bit code, telemetry-request bit (off), and 4-bit XOR checksum. The exact same header is compiled into both simulation firmwares.

The codec checks cover all 2,048 possible command values and all 32,768 single-bit corruptions of their frames. See `codec-checks.txt` and `test_codec.c`.

## What remains different

This matches **virtual DShot command encoding and quantization**, not physical ESC signaling. No 600 kbit/s waveform, transmission delay, FlexIO/DMA cost, bidirectional telemetry or hardware interrupts are measured. The nominal DShot600 selection must not be presented as an emulated electrical timing benchmark.

Betaflight firmware readback reports a **125 µs configured PID period**, versus the earlier OneShot125 configuration's 500 µs. CogniPilot still exchanges motor/sensor data at 1.6 kHz. Both use a nominal 1.6 kHz sensor stream, but Betaflight receives held samples in 8 kHz packets while CogniPilot exchanges at 1.6 kHz. This is a comparison of these stack configurations, not isolated controller equations at identical execution rates. The change in Betaflight's scheduling is part of the protocol configuration change and is not hidden as a gain improvement.

Both share the same plant/library/configuration hashes, vehicle, initial state, takeoff schedule, 100 Hz PC position loop, 250 Hz RC schedule, no added sensor noise, no offboard tilt lead, and existing attitude gains. Plant position feedback is ground truth. The old figure-eight recordings are unchanged and do not become DShot-qualified through this rerun.

## Tests and scoring

At simulated time 25 s, after takeoff to 2 m:

| Test | Input | Measured output | Evaluation window |
|---|---|---|---|
| Attitude | +5° roll | Plant roll angle | 1.2 s |
| Acro | +10°/s roll rate, then zero rate | Plant body roll rate | 0.4 s positive pulse, followed by 0.2 s zero-rate hold |
| Position | +0.5 m east | Plant east position | 10 s |

The command grid makes the nominal 1.2 s attitude pulse last 1.21 s; metrics retain the same 1.2 s window as the previous campaign. Integer RC mapping differs between stacks; the requested 10°/s is nominally encoded as approximately 10.31°/s by CogniPilot and 10°/s by Betaflight before firmware dynamics. That quantization remains documented rather than being interpreted as a pure controller error.

Commands and plant response are logged at 1,600 Hz. Rise time uses first 10% and 90% crossings relative to the preceding 0.2 s baseline. Settling requires the response to stay within ±5% of step amplitude for the remainder of the held-input window, with at least 0.1 s remaining. Overshoot uses the peak above target within that window. No settling value means it was not demonstrated within the window.

A completed flight requires recovery, ground contact, native disarm and stopped motors. This is separate from tight step tracking. Roll probes intentionally permit drift; figure-eight tracking-error gates do not apply. This is one noise-free positive-axis test per type and stack, not a repeated statistical qualification or maximum-speed search.

## Evidence and reproduction

Each report and `summary.json` identifies the new firmware and runner hashes, along with the unchanged Rumoca plant and generated position-loop hashes. The source patches and shared codec are included here. The previous mixed-protocol results remain in [the earlier campaign](../step-tests-20261112/README.md).

Source bases are the same pinned repositories documented there: CogniPilot `cerebri_rdd2` and `modelica_models`, Rumoca, FastDyn, its QEMU fork, and Betaflight's NXP TROPIC branch. These are locally patched simulation builds, not hardware flashing packages.

Build checks: CogniPilot and the Rust runner built with the existing pinned toolchain. Betaflight's first build stopped on two unused physical-clock functions in the existing simulation patch; the retry retained them as warnings (`-Wno-error=unused-function`). The full build logs are preserved with the raw local campaign.

Recreate the graph with:

```sh
python3 tools/plot-step-responses.py <raw-campaign-directory> docs/results/dshot-steps-20261112 --rate-folder-suffix '' --protocol-label 'Matched virtual DShot encoding · electrical timing not simulated'
```

## Preliminary attempts retained

Two preliminary attitude flights completed, but an end-to-end inspection showed that CogniPilot’s legacy PWM-topic serialization was rounding decoded values again. Those runs are excluded from the matched comparison. The preliminary campaign was stopped between flights, the tagged frame mailbox was added, and all six displayed tests were started again with new hashes. The preliminary folders and build logs are retained locally under `artifacts/dshot-steps-20261112`; the corrected campaign is `artifacts/dshot-matched-steps-20261112`.

The analysis also checks every recorded motor value against the DShot code grid. The maximum residual from an integer code is included in the summary; it must be below 0.001 code units (allowing float representation error). Betaflight's binary motor-update counter is read at t = 25 and 26 s to report observed writes over that second, separately from the configured PID period. This validates the simulated execution record, not real-time hardware performance.

Campaign dates span November 12–13, 2026. Existing `tuning_status` fields inherited from earlier native campaigns are not evidence of a new matched ARM tuning qualification; this document and the measured response windows define the scope of these tests.

## Storage interruptions and retries

The corrected campaign's first CogniPilot Acro attempt stopped around 18.8 simulated seconds with `No space left on device`; both following position attempts also failed to start normally because of storage exhaustion. These are execution failures, not controller-performance failures. All available partial logs are retained. After creating and verifying a compressed backup of a redundant hardware-build source copy, its uncompressed duplicate was removed to free space. Only the three affected cases were retried in fresh `-retry01` folders, using the same frozen runner, firmware and configuration. `run-map.json` selects those explicit retry folders; the summary retains the failed attempts too.

For this campaign, add `--run-map docs/results/dshot-steps-20261112/run-map.json` to the graph-generation command above.

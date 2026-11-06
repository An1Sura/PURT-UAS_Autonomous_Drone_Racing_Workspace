# Betaflight harsh-noise landing investigation

Status: observed failure, cause not established. The running ARM speed campaign is unchanged.

## What was measured

At a 33 s reference duration, harsh-noise seeds 2 and 3 fail landing/disarm while their course RMS and maximum errors remain below 0.35 m and 0.75 m. Seed 2 has 0.28824 m RMS and 0.72797 m maximum error; it finishes at 0.60951 m altitude, still armed. Its recorded minimum altitude during descent is 0.17354 m, above the 0.13 m contact-verification threshold. This is not merely a missed debounce on an otherwise successful ground contact.

In seed 2, yaw and opposite motor-pair differences grow after the course. At the final sample, normalized motor commands are approximately `[0.96336, 0.31590, 0.96312, 0.32083]`. A successful realistic-noise seed reaches ground and disarms on the same schedule. Different noise conditions and seeds prevent attributing the difference to a single cause without further controlled tests.

Sources: [all published attempts](results/arm-speed/betaflight-attempts.json), [failed altitude trace](results/arm-speed/failed-landing-harsh-2.csv), [original trace hash](results/arm-speed/failed-landing-source.json). Firmware SHA-256 is `c9530644680b907053022efa349bd0564701dd09ead526c862ac76d71755423f`; plant SHA-256 is `284cced3ceec15128886d05753900b8ae47f38570ce0112c50e801356de97654`.

## Source-backed sign check

The inspected editable sources used by this experiment are:

- Cerebri `xtask/src/shared_sil.rs`, `Bf::step`: applies the packet conversions and maps motor outputs as `[m1, m0, m2, m3]`.
- Betaflight `src/main/drivers/fastdyn_adr.c`, `adrFastdynGyro`: converts rad/s into the virtual gyro's raw units and undoes the board's CW180 mounting before normal firmware alignment.
- Betaflight `src/main/flight/mixer_init.c`: Quad-X order is rear-right, front-right, rear-left, front-left; yaw coefficients are `[-1,+1,+1,-1]`.
- Betaflight `src/main/flight/mixer.c`: normal non-reversed yaw mixing negates the yaw PID contribution before applying those coefficients.
- CogniPilot Modelica `Vehicles/Rdd2/package.mo`: command order is front-right, rear-right, rear-left, front-left; FLU yaw moment signs are `[-1,+1,-1,+1]`. `Vehicles/Rdd2/Plant.mo` uses this geometry, not the generic template's default ordering.

After the adapter's permutation and the firmware mixer's sign, a positive yaw PID output produces positive plant FLU yaw moment. A positive measured FLU yaw rate with zero commanded rate gives negative rate error. Thus the static sign chain is negative feedback. This check does not prove closed-loop stability, correct dynamics, or timing parity.

## Why motor spread matters

The Rumoca plant computes rotor thrust from squared rotor speed. Algebraically, the mean of squared speeds equals squared mean speed plus speed variance. Therefore a large yaw differential can affect total thrust even when the average motor command falls. The logged commands are not instantaneous rotor speeds: the plant includes motor lag. Do not calculate actual thrust from command squares and present it as a measurement.


## Read-only ARM telemetry now validated

A native C observer reads the current Betaflight binary’s shared DTCM file without writing guest memory or pausing QEMU. Addresses come from this exact ELF’s symbols; layouts come from its adapter, PID and gyro headers. Samples are accepted only when the completed request/response handshake stays unchanged across the read.

On `confirm-40-none-3`, it captured 14,909 irregular samples from 57.6525 to 82.99975 simulated seconds, including actual filtered yaw gyro, RC yaw-rate setpoint, yaw PID components and motor commands. At 199 timestamps shared with the flight CSV, motor commands agree after the documented permutation to within 5.0e-10. The entire flight trajectory is byte-identical to `confirm-40-none-1`, which ran without this observer. This is evidence for this witnessed repeat, not proof that observation can never affect timing.

The observer missed the final 0.25 ms and reports exit code 1; the flight itself passed. Its data are explicitly partial diagnostics, not a complete flight recording. The 40 s harsh-noise seed-2 capture also completed: 49,099 partial diagnostic samples, with 616 exact motor-timestamp matches (maximum difference below 5e-10). That flight passed; its course peak absolute yaw integral was 7.409, and descent peak was 2.895, far below the retained shorter-run failed snapshots. These are observed peaks, not guaranteed continuous-time maxima. The passing trace does not establish why other cases fail. [Raw capture](results/arm-speed/yaw-observer/harsh-40.csv.gz) · [Validation and phase statistics](results/arm-speed/yaw-observer/harsh-40-validation.json).

[Validation and hashes](results/arm-speed/yaw-observer/validation.json) · [All 14,909 raw samples, gzip CSV](results/arm-speed/yaw-observer/baseline-tail.csv.gz) · observer source: `tools/observe-betaflight-arm.c`. These memory offsets are valid only for the pinned ELF. This does not measure physical loop speed, latency or jitter, or close the PDF’s all-axis rate-command requirement.

## Retained failed-run PID state

The exact-binary DTCM snapshots from harsh-noise seed 2 show the following retained controller state. These are post-termination snapshots: the shutdown path does not change PID/gyro fields, but it **does zero the shared output motors**, so motor end-state evidence must come from the original flight reports.

| Failed reference | Simulated end | Yaw P | Yaw I | Yaw F | Yaw sum |
|---|---:|---:|---:|---:|---:|
| 33 s | 76 s | −20.472 | −320.000 | −0.730 | −341.202 |
| 35 s | 78 s | 56.456 | 226.924 | 1.118 | 284.497 |

Yaw D and S are zero in both snapshots. The 33 s yaw integral reaches the configured 320 limit; a large integral contribution also remains in the 35 s failure. This is consistent with persistent opposing motor commands and motivates a yaw damping/integrator investigation. It does not prove why the integral grows or justify simply removing it. Roll and pitch PID sums in these snapshots have magnitudes below 1.7.

[33 s raw values/bytes and memory hash](results/arm-speed/yaw-observer/failed-33-final-snapshot.json) · [35 s raw values/bytes and memory hash](results/arm-speed/yaw-observer/failed-35-final-snapshot.json). `tools/summarize-bf-snapshot.mjs` rejects incorrect size, magic, stage or inconsistent final sequence/time.

## Protocol-imposed loop rate

Both failed-run snapshots report an 8,000 Hz gyro sample rate, a 125 µs gyro sample period, and a 2,000 µs configured PID period. The 33 s flight recorded 38,000 motor updates in 76 simulated seconds; the 35 s flight recorded 39,000 in 78 seconds. Both equal 500 motor updates per simulated second. The 8 kHz exchange schedule is therefore not the PID/motor-loop rate.

The adapter selects `motor_pwm_protocol = PWM`. In the pinned Betaflight source, `src/main/config/config.c` limits this protocol using `BRUSHLESS_MOTORS_PWM_RATE`; normal validation raises `pid_process_denom` to satisfy that restriction. A separate OneShot125 diagnostic requests denominator 1 and allows stock validation to raise it as needed. This retains analog endpoint units and controller equations. DShot is rejected by the new configuration parser because its endpoint encoding is different. The protocol diagnostic is not yet a result and does not replace the PWM baseline. Actual scheduling must be read back after it runs.

## Required next checks

1. Record actual gyro inputs, yaw setpoint, yaw PID components, filtered rates and rotor speeds on the exact ARM target.
2. Separate random IMU noise from the assumed motor-harmonic disturbance using identical seeds and unchanged plant/controller settings.
3. Run signed yaw-rate/attitude probes and quantify damping, settling, saturation and frequency response. Apply the same declared tuning criterion to both stacks before comparing speed.
4. Check sensor hold, quantization and declared loop periods against actual firmware updates. Simulator exchange frequency is imposed, not measured hardware loop capability.
5. Rerun full takeoff/course/landing confirmations after any justified adapter or parameter change, retaining this failed baseline.

Do not change onboard controller equations, reverse yaw signs without evidence, weaken landing gates, force-disarm an airborne aircraft, or call the 33 s setting confirmed. This is simulation research evidence, not a hardware-flight readiness result.

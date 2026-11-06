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

## Required next checks

1. Record actual gyro inputs, yaw setpoint, yaw PID components, filtered rates and rotor speeds on the exact ARM target.
2. Separate random IMU noise from the assumed motor-harmonic disturbance using identical seeds and unchanged plant/controller settings.
3. Run signed yaw-rate/attitude probes and quantify damping, settling, saturation and frequency response. Apply the same declared tuning criterion to both stacks before comparing speed.
4. Check sensor hold, quantization and declared loop periods against actual firmware updates. Simulator exchange frequency is imposed, not measured hardware loop capability.
5. Rerun full takeoff/course/landing confirmations after any justified adapter or parameter change, retaining this failed baseline.

Do not change onboard controller equations, reverse yaw signs without evidence, weaken landing gates, force-disarm an airborne aircraft, or call the 33 s setting confirmed. This is simulation research evidence, not a hardware-flight readiness result.

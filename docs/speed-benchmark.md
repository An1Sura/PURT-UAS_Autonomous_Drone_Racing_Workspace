# Improving CogniPilot against a Betaflight baseline

The objective is **to make CogniPilot faster than Betaflight on the same figure-eight course and identical drones**, while preserving accurate and reliable flight. Betaflight provides a documented performance baseline; CogniPilot is the optimization target.

The current work is the **SIL foundation before separate latency tests**. First establish autonomous flight, shared physics, command interfaces and recorded baseline behavior. Then use the latency experiments to investigate control, communication and driver timing, guide CogniPilot changes, and test whether those changes improve flight performance. Existing SIL transport timings are not isolated controller-latency measurements.

This document defines the direction of the next experiment. The current website shows fixed diagnostic recordings; an automated maximum-speed search and a qualified ranking have **not** been implemented.

## Keep the course and acceptance rules fixed

Use the current 8 × 4 m figure eight at 1.5 m altitude as the initial simulation course. One lap includes both lobes, in the same prescribed order. Keep the plant, motor limits, initial conditions, disturbances and sensor conditions common. Physical testing needs the model calibrated to the two identical drones and the usable PURT volume measured.

Choose and record the following before collecting ranked runs:

| Rule | Required decision / implementation |
| --- | --- |
| Lap timing | Same start/finish gates and interpolation rule, with ordered intermediate gates to prevent counting the centre crossing halfway through as a finish |
| Start condition | Same readiness, initial position, velocity and attitude; separate standing-start and flying-start experiments if both are studied |
| Tracking validity | Fixed maximum position-error/corridor and altitude tolerances; report RMS as well as worst error |
| Completion | All gates in order; no extra lap or skipped lobe; no abort; accepted landing and disarm after the timed lap |
| Operating limits | Common actuator/vehicle limits, declared saturation policy and identical boundary/obstacle checks |
| Repeatability | Fixed repeat count, required success rate, disturbance seeds and reported timing spread |
| Tuning | Record Betaflight baseline settings and the allowed CogniPilot changes; retain tuning history and all attempts |
| Autonomous control level | State which waypoint/outer-loop controller is included for each stack; do not silently compare different parts of the control pipeline |

These thresholds and gates are not yet a qualified common runtime validator. The existing Betaflight checker uses four quadrant gates and a tolerant centre return; it is useful integration evidence, not an exact race-clock implementation. Assumed profile limits and PURT margins are not measured hardware capability or clearance.

## Speed search

Start with a passing baseline, then reduce requested lap duration while preserving geometry. At fixed course size, the reference's velocity scales inversely with time and its acceleration scales inversely with time squared. Those exact-real scaling identities are [Lean-checked](formal-verification.md); actual tracking still requires runs.

Use a coarse duration sweep to find the transition between valid and invalid runs, then refine around that interval. Track failures as outcomes, not samples to discard. Because tuning, estimator state and disturbances can produce nonmonotonic results, do not assume every slower setting passes or a single successful fast run establishes a reliable limit. Repeat the candidate settings under the preregistered trial rules.

After the SIL baseline and separate latency tests, the improvement evaluation should show:

- CogniPilot performance before and after changes, relative to the documented Betaflight baseline, under common validity and repeatability rules.
- Measured lap-time distribution and success rate at that setting.
- Mean course speed (path length divided by measured lap time), peak measured speed, tracking RMS/max error and saturation.
- Why faster settings fail: tracking, turn acceleration, actuator limits, estimator, transport or planner cap.
- Separate setup, takeoff, hold, landing and total mission durations.

A fastest tested valid setting is evidence within the explored range and conditions, not a proof of a global physical optimum. Replay speed, host runtime and simulation throughput are not racing lap time.

## Why 25.13 s versus the configured reference is not the answer

The latest Betaflight mode uses native constant-phase motion; CogniPilot now follows a 40-second minimum-jerk reference with acceleration feedforward. Those are configured diagnostic behaviors, not independently optimized speed limits. Their 41.745 s and 69.000 s full recordings include setup and landing.

Betaflight's pinned native pattern is capped at 0.25 rad/s, giving a minimum native cycle of approximately 25.13 seconds for this mode. Requesting a shorter lap or increasing its cruise parameter alone does not bypass that cap. A sweep must report this as a **native planner limit**, not conclude that Betaflight's controller or hardware cannot fly faster.

The next implementation step is a common reference/control interface with observable actual setpoints, matched sensor/timing conditions, and shared lap/validity scoring. If the native mode remains as a separate experiment, label its command-rate cap explicitly and do not mix that result with an unrestricted-controller experiment. Firmware changes must be versioned, documented and rerun; never silently remove checks or limits to improve a score.

## Hardware path

Complete the CogniPilot drone's assembly and soldering, identify both firmware/configuration versions, and establish the position-feedback interface. Measure the shared vehicle dynamics and validate the drivers and timing. SIL develops the command, scoring and logging software first; hardware tests then evaluate the same declared experiment under measured facility conditions.

## First implemented experiment

Acceleration feedforward and the 40-second reference are now tested and published. See the [October 4 before/after study](cognipilot-speed-experiment.md) for all attempts, unchanged assumed limits, and why this is progress toward the goal rather than a win over Betaflight.

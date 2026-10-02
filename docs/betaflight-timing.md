# Betaflight native figure-eight timing

The pinned adapter used to request 56 cm/s and hold the native figure-eight pattern for 45 seconds. This did **not** produce a 45-second lap. Betaflight raised the cruise speed to its 1 m/s minimum, and its pattern rate reached the 0.25 rad/s cap. With the configured 4 m radius, a native cycle takes 25.132741 seconds. A 45-second hold therefore commanded about 1.79 cycles.

The corrected adapter calculates the firmware's effective rate before setting the HOLD duration:

```
radius_m = round(width_m * scale * 50) / 100
requested_speed_cm_s = round(2*pi * radius_m * 100 / requested_lap_s)
rate_rad_s = min(max(requested_speed_cm_s / 100, 1.0) / radius_m, 0.25)
native_period_s = 2*pi / rate_rad_s
hold_deciseconds = ceil(native_period_s * laps * 10)
```

For the current 8 × 4 m course, the corrected hold is 252 deciseconds (25.2 seconds). This changes the adapter's mission duration, not the pinned firmware, plant, gains, arming checks or safety limits. CogniPilot retains its 45-second minimum-jerk reference and five-second end hold. Betaflight's constant-phase pattern is a distinct diagnostic mode; these flights do not establish equal-time tracking performance.

The native hold timer includes pattern settling, and the vehicle can lag its target. Therefore the formula alone is not proof of a completed lap. The adapter also checks ground-truth samples for four ordered quadrant gates followed by a centre return above 80% of the requested altitude. Quadrant thresholds are 40% of each half-axis; centre tolerance is 25% of the long half-axis and 50% of the short half-axis (1 m each for this course). A successful run must have exactly the requested number of completions and no extra quadrant gates. This is a geometric completion test with stated tolerances, not an exact race-gate lap-time measurement.

Native mission completion, firmware disarm, ground contact, vertical rest and two seconds of stopped motors are still required. The public replay uses the actual recorded positions and retains the final sample. Failed attempts remain available in the VM's immutable run directories.

## Sources

- [Pinned Betaflight navigation implementation](https://github.com/betaflight/betaflight/blob/744f95fa31542c4c906f18072348a366ab11b6b7/src/main/flight/flight_plan_nav.c): `FP_MIN_CRUISE_MPS`, `FP_PATTERN_MAX_RATE_RADS`, Gerono pattern phase update and HOLD timer.
- [Official SITL autopilot guide](https://betaflight.com/docs/development/autopilot/SITL_Autopilot_Testing_Gazebo): waypoint speed uses cm/s and HOLD duration uses deciseconds.
- [Official 2026.6 release notes](https://betaflight.com/docs/wiki/release/Betaflight-2026-6-Release-Notes): autonomous navigation is experimental, simulation-focused work. Current documentation differs on pattern availability; this benchmark follows the pinned source, not an assumed hardware capability.

## Verification on October 2, 2026

Four adapter tests passed, including speed-floor/rate-cap regression cases and rejection of two or incomplete laps. The patch applies to the pinned source. Native run `1790925641463995931` passed on both stacks. Betaflight recorded exactly one geometric completion and zero extra quadrant gates, then landed and disarmed, with stopped motors and ground rest; total recording 40.315 s. See the [measured rundown](timing-rundown.md).

Failed attempts are preserved: `1790925283535033605` used a server process whose executable had been replaced during rebuilding (resolved by restarting the idle server); `1790925373711260652` aborted on invalid XY estimation; `1790925493552221258` failed EEPROM provisioning before takeoff. The latter two are unresolved intermittent limitations of this setup. The successful retry used the same configuration and checks. Full native logs/trajectories remain in the VM; compact reports are in `docs/results/betaflight-timing-fix/`.

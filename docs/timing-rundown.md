# Flight timing rundown

The fixed course is 8 × 4 m at 1.5 m altitude. One figure eight is requested. The common planning target is 45 seconds, but the native Betaflight mode cannot follow that target with its current speed floor. Its effective pattern period is 25.132741 seconds; the adapter requests a 25.2-second HOLD then LAND. CogniPilot follows the 45-second minimum-jerk reference, holds for five seconds, then lands.

## Actual recordings — October 2, 2026

Run `1790925641463995931`, unchanged pinned firmware and plant:

| Stack | Pattern timing | Recorded total | Completion | Tracking RMS |
|---|---|---|---|---|
| Betaflight | 25.132741 s native period; 25.2 s HOLD | 40.315 s | One geometric lap, zero extra quadrant gates; landed and disarmed | Not comparable to the common time law |
| CogniPilot | 45 s reference | 74.000 s | Native reference run passed; final armed state false | 0.294747 m |

Betaflight passed its final centre-return gate at simulation timestamp 32.4275 s. That is a cumulative timestamp including setup, not a measured lap duration. The geometric gate tolerances are 1 m around the centre for this course; see [the verification method](betaflight-timing.md). Final Betaflight position was approximately (-0.0447, -0.0596, 0.09837) m with near-zero vertical speed and 2.97 seconds of stopped-motor ground rest. Its last 15 seconds before landing had 0.01854 m altitude RMS relative to 1.5 m; this is an altitude-only diagnostic, not 3D trajectory RMS.

The shared planning geometry has 24.3889 m path length, peak required speed 1.4810 m/s, peak lateral acceleration 0.5260 m/s² (0.05364 g), and tightest radius 0.8350 m. Those speed/acceleration values use the 45-second minimum-jerk reference, not Betaflight’s native phase law. Velocity and acceleration follow analytic derivatives; numerical sampling estimates maxima and integrates path length.

CogniPilot RMS compares ground truth with its reference at the same timestamp, including terminal hold. Betaflight is not scored against that reference. Both use the same plant, but sensor paths, scheduler timing, warmup and takeoff/landing differ. Betaflight uses wall-clock-coupled SITL streaming; CogniPilot uses the lockstep exchange. These results do not support a fair stack ranking.

The approximate PURT envelope contains this course under the assumed configured margins. Actual calibrated coverage and obstacles remain unknown; this is not flight clearance. See [PURT evidence](purt-environment.md) and the [fixed configuration](config/figure-eight.json).

Earlier attempts are retained: a server restart was needed after rebuilding; one native flight aborted when the XY estimator became invalid; another failed during EEPROM provisioning before takeoff. Those intermittent failures remain unresolved and are not counted as successful runs. [Attempt records](results/betaflight-timing-fix/) accompany the [current recordings](sim/).

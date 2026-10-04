# Flight timing rundown — current October 4 recordings

One 8 × 4 m figure eight at 1.5 m altitude. The current CogniPilot reference is 40 seconds with acceleration feedforward; five seconds of terminal hold follow. Betaflight is the retained successful baseline with its original 45-second request, 25.132741-second native period and 25.2-second HOLD. Configurations remain attached to their own recordings.

| Stack | Source run | Pattern timing | Recorded total | Tracking / outcome |
|---|---|---|---|---|
| Betaflight | 1791151996186426613 | 25.132741 s native | 41.745 s | One geometric lap, zero extra gates; landed and disarmed |
| CogniPilot | 1791152185013782398 | 40 s reference + 5 s hold | 69.000 s | 0.257486 m RMS, 0.558227 m max; diagnostic passed, landed/disarmed |

CogniPilot's cumulative reference lap ends at 49 s (9 s setup + 40 s); hold ends at 54 s, full recording at 69 s. This is a scheduled reference boundary, not a ground-truth gate time. Betaflight's completion gate is at timestamp 33.69 s including setup, not a lap duration. Betaflight rests on the ground with stopped motors for 3.0575 s. Different sensors, timing, takeoff/landing and phase laws prevent a qualified speed ranking.

Current 40-second geometry stats: path 24.3889 m per lap and total, mean reference speed 0.60972 m/s, peak speed 1.66608 m/s, peak lateral acceleration 0.66573 m/s² / 0.06789 g, tightest radius 0.83502 m. These come from analytic derivatives and numerical sampling, not measured hardware limits.

The nominal course fits the approximate configured PURT boxes. Actual clearance remains unqualified: the measured tracking maximum exceeds the assumed 0.15 m margin, and calibrated coverage/obstacles require measurements. See the [complete experiment history](cognipilot-speed-experiment.md), including both failed subsequent Betaflight attempts and the exact RMS window.

---

# Historical October 2 timing rundown

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

# Timing rundown — October 5

See [the complete speed-search report](speed-search.md) for every candidate, methods, thresholds and limitations.

| Stack | Course timing setting | Full recorded duration | Course RMS / maximum |
| --- | --- | --- | --- |
| Betaflight | 23.700000 s native period (23.7 s request) | 50.023 s | 0.1939 / 0.3463 m |
| CogniPilot | 23.7 s reference | 52.700 s | 0.1279 / 0.2240 m |

One lap only. Path length = 24.388894 m. Mean required course speed = path length / timing setting. Tightest geometric turn radius = 0.835023 m. The native BF period uses quantized cruise speed and is not an exact measured race-clock duration. CG smooth-phase required peak speed = 1.666341 m/s, peak lateral acceleration = 0.729638 m/s² (0.074402 g).

| Stack | Scored course window (plant seconds) | Entry into finish tolerance (plant seconds) | Lap count |
| --- | --- | --- | --- |
| Betaflight | 19.195–42.72 | 40.96 | 1 |
| CogniPilot | 9–32.7 | 31.36375 | 1 |

Course RMS is sqrt(mean(squared 3D distance to the course polyline)); maximum is the largest distance. CG timed RMS = 0.165887 m and maximum = 0.251326 m over the reference plus five-second hold; this retains the original unshifted target. BF timed-reference error is not measured. Finish-tolerance entry can precede the nominal end; do not divide path length by that timestamp and call it exact measured speed.

Betaflight includes a ten-second native settling hover. CogniPilot uses simulator-assisted takeoff/landing. Full durations also include initialization and post-touchdown rest. The plant is shared but sensors, scheduler and takeoff conditions differ: 400 Hz wall-clock-coupled BF versus 1600 Hz lockstep CG. No hardware or matched-latency conclusion follows.

PURT: approximate envelope 53.34 × 28.956 × 9.144 m, assumed origin and margins. Calibrated mocap coverage is absent; combined fit is **unverified**. The black grid and green outline remain unchanged.


Three selected lap repeats passed for each stack. An additional VM-page rerun passed CogniPilot but Betaflight aborted during the pre-lap hover because its XY estimator became invalid (native reason 1). The check was not disabled. Selected-setting observations are therefore 3/4 successful Betaflight attempts and 4/4 CogniPilot attempts in this final set; these small counts are not reliability estimates. Startup/estimator freshness remains unresolved.

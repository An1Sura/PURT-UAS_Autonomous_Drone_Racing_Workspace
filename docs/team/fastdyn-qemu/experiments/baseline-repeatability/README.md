# FastDyn/QEMU Baseline Repeatability Experiment

## Objective
Evaluate the repeatability of the CogniPilot RDD2 20-second simulated mission using FastDyn/QEMU on Ubuntu ARM64 running in UTM on an Apple M2 Mac.

## Results

| Run | Passed | Maximum Altitude | Maximum Tilt | Overall Execution Time |
|---|---|---|---|---|
| 1 | Yes | 2.0506 m | 15.3472° | 3.170 s |
| 2 | Yes | 2.0506 m | 15.3472° | 3.054 s |
| 3 | Yes | 2.0506 m | 15.3472° | 3.081 s |
| 4 | Yes | 2.0506 m | 15.3472° | 3.113 s |
| 5 | Yes | 2.0506 m | 15.3472° | 3.019 s |

## Summary

- **Success rate:** 5/5 missions passed
- **Simulated duration:** 20 seconds per mission
- **Average overall execution time:** 3.087 seconds
- **Average overall speedup:** Approximately 6.48× real-time
- **Maximum altitude and tilt:** Identical to four decimal places across all five runs

## Interpretation

The experiment demonstrates repeatable mission outcomes under the tested simulation configuration. Host execution time varied slightly between runs.

These results do not establish physical IMU driver latency, SPI/DMA timing, or real-world flight performance.

## Next Steps

- Analyze controller timing and simulation instrumentation
- Investigate simulated sensor latency and jitter
- Test additional flight trajectories
- Compare results with future firmware changes

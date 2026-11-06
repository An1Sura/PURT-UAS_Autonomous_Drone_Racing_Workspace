# Timing and estimator comparison: next experiments

## Current evidence and limits

The November 5 Betaflight MR_VMU_TROPIC / MIMXRT1064 build has completed a FastDyn/QEMU hover and a 10 × 10 m figure-eight at 2 m. The earlier CogniPilot TROPIC ARM recording uses the same plant. These establish executable firmware-to-plant integration and trajectory tracking. They do not establish physical loop latency, Zephyr driver overhead, or that either stack is faster on a real board.

The NXP Betaflight adapter supplies time and virtual sensors directly. Its 8 kHz exchange schedule is an imposed simulation setting, not measured achievable hardware performance. The earlier native 26 s / 33 s speed-screening results are a different experiment and require requalification after changing firmware revisions.

## Timing experiment

Measure these boundaries using one timestamp clock per run:

| Event | Measurement |
|---|---|
| IMU data-ready edge | Hardware sample availability, using a logic analyzer |
| ISR entry / exit | Interrupt response and ISR duration |
| SPI transfer start / DMA completion | Transfer time, interrupt load, missed transfers |
| Driver publication | Sample age at driver output |
| Estimator start / end | Estimation execution time and sample age |
| Controller start / end | Control execution time and period |
| Motor output submission / physical edge | Software-to-actuator latency |

Report median, p95, p99, maximum, standard deviation, period error relative to the intended period, deadline misses, FIFO overflow, dropped samples and reset count. State observation duration and sample count. Account for timestamp rollover and logging overhead. Buffer records in memory and drain outside the measured loop; avoid printing each sample in the ISR.

For CogniPilot/Zephyr, `CONFIG_TIMING_FUNCTIONS` and `timing_counter_get()`/`timing_cycles_get()` provide execution instrumentation. Verify the selected timer and its frequency against the actual board: it can differ from the kernel timer. See [Zephyr's timing documentation](https://docs.zephyrproject.org/latest/kernel/timing_functions/index.html). Cross-check with GPIO pulses and a logic analyzer before interpreting cycle-to-time conversions.

Use identical board revision, CPU clock, IMU/ODR, SPI clock, filtering, control rate, motor protocol, telemetry/logging load and compiler optimization when comparing implementations. To isolate Zephyr driver overhead, compare equivalent acquisition paths with the same hardware and sampling conditions; a complete flight-stack difference cannot be attributed entirely to its driver.

| Stack | Role in the next comparison | Remaining qualification |
|---|---|---|
| CogniPilot | Zephyr-based candidate; TROPIC ARM simulation baseline exists | Instrument physical acquisition/control pipeline |
| Betaflight | Higher-performance reference; TROPIC PR firmware now runs in simulation | Requalify tuning/speed on this revision; verify board and real peripherals |
| ArduPilot | Initial performance target | Select supported matched hardware and instrument equivalent boundaries; earlier Guided square is not timing evidence |
| PX4 | Additional reference | Select supported hardware and equivalent instrumentation; no matched result claimed |

Outperforming ArduPilot or Betaflight is the research objective, not an established outcome. Do not mix different MCU results into a claim about RTOS overhead.

## Integration research grounded in the current source

Inspected `src/modelica_models/Estimation/MultiSensorInvariant/predictNominal.mo`: it subtracts gyro/accelerometer bias and propagates with `LieGroups.SE23.Quat.exp_mixed`, then normalizes the quaternion. The mocap external-odometry predictor also uses that exponential, with a different state and input model. These are candidate components to study; their presence does not establish that every firmware path uses them.

The current IMU predictor accepts one measured angular velocity and specific-force vector for an interval. First compare that interval-constant input assumption with an endpoint-interpolated alternative. A trapezoidal average of successive vectors is a useful baseline, but it is not automatically an exact SO(3) update: changing rotation axes introduces noncommuting increments (coning). Acceleration integration must also account for changing orientation, gravity, biases and timestamps.

A controlled experiment should:

1. Replay identical timestamped IMU sequences into the current predictor, a trapezoidal/midpoint candidate, and a Lie-group FOH candidate, outside the flight controller first.
2. Use analytic constant-rate, linearly changing same-axis rate, noncommuting coning, rest/gravity and accelerated-translation cases, plus irregular sample intervals.
3. Compare orientation geodesic error, velocity/position error, quaternion norm, covariance consistency and execution cost. Preserve the same estimator correction schedule and noise assumptions.
4. Make the timing causal: using the next sample means the interval result is available only when that sample arrives. Include buffering/sample-age cost rather than granting the candidate future information for free.
5. Only after component validation, run identical flight seeds/noise and compare tracking, estimator error and deadline misses. Keep a separate experiment configuration; leave the commissioning baseline intact.

Forster, Carlone, Dellaert and Scaramuzza's [On-Manifold Preintegration](https://arxiv.org/abs/1512.02363) compresses IMU observations between keyframes into relative-motion constraints for optimization, including bias correction. It supports this research direction but is not evidence that replacing a high-rate recursive flight estimator with factor-graph preintegration will reduce control-loop latency. That must be measured.

No FOH/preintegration performance improvement or physical timing result is claimed yet. The next deliverables are an isolated predictor comparison and timestamped hardware traces, followed by matched statistical analysis.

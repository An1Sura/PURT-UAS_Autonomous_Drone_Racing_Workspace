# Common benchmark architecture

The goal is to make CogniPilot faster than Betaflight under the same course and vehicle constraints while maintaining accurate, reliable flight. This SIL stage establishes the flight baseline before separate latency tests guide CogniPilot improvements. The [speed-benchmark plan](speed-benchmark.md) separates that goal from the current integration recordings.

The benchmark compares Betaflight and CogniPilot on one Rumoca-generated quadrotor plant. The plant supplies sensor observations to each stack's adapter and receives its motor commands. Geometry, requested trajectory, actuator model and physical initial conditions belong to the benchmark rather than separate simulator models.

CogniPilot uses Zephyr native_sim and shared-memory lockstep, with external position/velocity/yaw reference ingress. Betaflight uses its native SITL sensor/motor transport and native figure-eight planner. The latter's quantized phase clock differs from the shared minimum-jerk reference. Sensor and scheduler parity remain unresolved, so results are integration diagnostics rather than a stack ranking.

The native Rust xtask owns simulation behavior and the loopback simulation server. Root Devenv tasks coordinate builds and runs. Source changes are stored in `patches/cerebri-rdd2-benchmark.patch`; generated binaries and full simulation logs stay in the editable dependency workspace.

The current fixed configuration is [figure-eight.json](config/figure-eight.json). Each recording embeds its configuration and report. [Flight Simulation & Stats](sim/) shows actual recorded motion and retains failed attempts. The [PURT environment](config/purt-environment.json) describes an approximate published envelope, not a surveyed clear-flight volume.

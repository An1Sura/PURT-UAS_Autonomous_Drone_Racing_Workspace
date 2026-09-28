# RDD2 validation and remaining blockers

Validated in the existing Ubuntu aarch64 Lima VM with Devenv 2.2.1 and Nix
2.35.2. Dependency revisions and source changes are recorded in
[patches/README.md](../patches/README.md). The development machine's signed-cache
configuration is a machine setting, not a repository change.

## Successful runs

- RDD2 native firmware builds and the official `rdd2:simulation:sil:test` passes.
- The SIL mission runs for 44 simulated seconds at 625 microseconds per step:
  70,400 steps, five corners reached, takeoff and landing, no mission failures.
- After the benchmark extraction, original and refactored runners produce
  byte-identical 70,400-row trajectory CSVs with the same firmware and plant.
- The strict comparison passes: duration difference 0; position RMSE
  7.14e-24 m, altitude RMSE 0, attitude p95 4.97e-17 degrees. Tiny nonzero
  comparator values arise from floating-point interpolation of identical logs.
- 25 runner unit/protocol tests pass; the normally ignored firmware integration
  test was also run explicitly and passes (26 tests exercised).
- The compiler repair passes nine focused assertion/function tests and 17
  existing initialization tests. These are separate from the runner tests.

SIL records `provider_mode: caller-selected`, which upstream labels a
non-qualifying provider configuration. Mission checks pass, but this is not an
upstream pinned-provider qualification or a four-stack performance comparison.

## Modelica qualification is not fully passing

The repaired native Cargo build of the Rumoca Python binding completes both
45-second Modelica scenarios and produces CSV, JSON, HTML, Markdown and plots.
The GPS scenario passes. Optical-flow navigation error reaches 13.9579 m
against a 0.5 m limit; local/global track difference is 0.7891 m against 0.5 m.
Both scenarios fly the box and land. Drift grows mostly after landing; lack
of vertical measurement fusion is a hypothesis, not a proven root cause.

The official packaged Modelica workflow builds its patched Nix packages but
segfaults in `model.simulate` (`run_waypoint_qualification.py:110`). Clean Python
environment and single-thread/unlimited-stack diagnostic runs reproduce exit
139. The native crash is not localized. The successful native-build results
do not establish correctness of the optimized packaged runtime.

The broader 20-model MSL compiler check did not pass: eight simulations
completed, nine models failed DAE construction and three failed solve-IR
evaluation. OpenModelica was also unavailable, preventing reference comparison.
There is no matched pre-fix canary or MSL parity claim; the full 566-model sweep
was not run. Compiler-wide validation remains outstanding.

## What remains for the benchmark

Betaflight and PX4 adapters are not implemented. ArduPilot now passes a
[disarmed connection probe and 145-second Guided flight diagnostic](ardupilot-adapter.md),
but has no shared-sensor qualification. The diagnostic completed 232,000 steps,
takeoff, a time-indexed square, landing and disarming. Its 3D tracking RMSE was
0.06252 m in one run; this is not a controller comparison. The retained
CogniPilot mission uses stack-specific planning and truth-assisted takeoff;
it is a regression baseline. The shared time-indexed reference is now connected to both stacks; see
[the new diagnostic](shared-reference.md). CogniPilot RMS error is 0.04715 m and
ArduPilot 0.06252 m over matching 25-second square windows. Sensor conditions
and takeoff/landing must still be aligned before comparing controllers fairly. Default Modelica and
SIL missions differ and must not be compared as if they were identical.

Reported exchange timing includes transport and host scheduling; it is not
isolated controller execution latency. Configurable shared noise, delays,
disturbances, comparative tracking metrics, overshoot and settling analysis remain future
work. See [the implementation guide](common-benchmark.md).

# Common flight-stack benchmark: first implementation

The implementation provides a common lockstep boundary and a
[shared time-indexed square reference for CogniPilot and ArduPilot](shared-reference.md).
Both fly the same compiled plant; sensor paths and takeoff/landing remain
unmatched. Betaflight and PX4 remain integration targets.

## What runs now

The project-native implementation lives in `src/cerebri_rdd2/xtask`:

- `src/benchmark.rs`: sensor and actuator records, `FlightStackAdapter`, the
  exchange/physics-commit boundary, held 10 Hz GNSS observations, and metrics.
- `src/cognipilot.rs`: conversion to CogniPilot's wire records and its existing
  shared-memory exchange. The adapter contains no vehicle dynamics.
- `src/mission.rs` and `missions/rdd2-square-baseline-v1.json`: the explicit
  baseline mission used by the runner and embedded in each report.
- `src/main.rs`: existing RDD2 qualification scheduling and diagnostics. These
  remain RDD2-specific; extracting the exchange does not make them universal.
- `src/physics.rs`: the existing FMI 3 host, implementing `Dynamics` without
  changing the quadrotor model or integration step.

For each 625 microsecond interval, the runner samples the shared plant's IMU
and held GNSS observation, sends a command through the adapter, checks the
response timestamp and motor values, then advances physics once. Failed or
stale exchanges cannot advance physics. The adapter receives sensor samples,
not a handle to the plant. ArduPilot explicitly opts into simulator state for
its internal sensor generation; that path is not sensor-parity qualified. The existing initialization and readiness sequence
is preserved.

The neutral record specifies body FLU angular velocity in rad/s and specific
force in m/s²; GNSS observations use world ENU meters and m/s. Motor commands
are normalized [0,1] in the FMI plant's motor order. Each new adapter must
explicitly map its axes, motor ordering and actuator units to this contract.
The current sensor model is the existing deterministic baseline: it does not
yet implement configurable noise, transport delays or disturbances.

## Run and inspect

Inside the existing Linux VM, from `~/autonomous-drone-bench`:

```sh
~/.nix-profile/bin/devenv -P rdd2 tasks run rdd2:benchmark:test
~/.nix-profile/bin/devenv -P rdd2 tasks run rdd2:simulation:sil:test
```

The native test entry point, usable in a Rust environment without Devenv:

```sh
cd src/cerebri_rdd2
cargo test --locked --package cerebri-rdd2-xtask
```

The normal mission runner accepts `--stack cognipilot` (also its default).
Selecting `betaflight`, `px4`, or `ardupilot` fails explicitly before simulation;
it cannot silently substitute CogniPilot or another physics simulator.

The SIL report and canonical trajectory remain at
`src/cerebri_rdd2/artifacts/sil/mission.json` and `mission-trajectory.csv`.
The report adds `adapter`, `baseline_mission`, and `exchange_metrics`:

- Mean, population standard deviation, p95 and maximum exchange round-trip
  time in microseconds. These include wire conversion, transport, OS scheduling
  and firmware response. They are not isolated controller execution latency
  or control-loop deadline jitter, and they do not drive simulation time.
- Armed motor sample count and the count at normalized endpoints 0 or 1.
  Counts include arming transitions and use the adapter's normalized outputs;
  they cannot recover unclipped controller demand.

Tracking error, overshoot, settling time, and true execution timing still need
an agreed commanded reference and additional instrumentation. Comparing two
observed flight logs only measures their difference.

## Scientific boundary still to implement

The preserved demo flies a 0.5 m box at 1.5 m altitude for 44 seconds. It uses
CogniPilot's waypoint planner and a runner-side takeoff/landing throttle law
that reads plant altitude. It is a regression fixture, not yet an identical
time-indexed trajectory for four controllers. The pure Modelica qualifier has
a different mission, so its default trace is not a matching reference.

The `enu-square-diagnostic-v1` reference now defines time-indexed ENU position,
velocity and yaw independently of the adapter. ArduPilot consumes it through
Guided mode; CogniPilot consumes it through a new external-reference mode,
while retaining the original mission as a regression test. The next
slice must align sensor configuration and takeoff/landing. Select and record a common
control level: a shared outer controller feeding body-rate/thrust commands,
or each stack's own supported navigation controller. These are different
experiments and must not be mixed in one ranking. Remove or standardize the
baseline truth-assisted takeoff law before claiming a fair comparison.

## Remaining adapter work

| Stack | Candidate simulator boundary | Status / first validation |
| --- | --- | --- |
| CogniPilot | Existing shared-memory lockstep | Connected; shared reference diagnostic and original regression mission both pass |
| Betaflight | Native SITL simulator sensor/PWM interface | Not connected; pin a revision and validate signs, units, motor order and clock behavior |
| PX4 | MAVLink simulator interface | Not connected; validate sensor coverage and lockstep actuator response at a pinned revision |
| ArduPilot | External JSON SITL backend | Copter-4.7.1 passes the disarmed probe and a 145-second Guided diagnostic; shared sensor parity remains unqualified |

Official references reviewed for the next implementation:

- [Betaflight SITL](https://betaflight.com/docs/development/SITL) and
  [simulator source](https://github.com/betaflight/betaflight/blob/master/src/platform/SIMULATOR/sitl.c).
- [PX4 simulation](https://docs.px4.io/main/en/simulation/).
- [ArduPilot JSON interface](https://ardupilot.org/dev/docs/sitl-with-JSON.html)
  and [protocol examples](https://github.com/ArduPilot/ardupilot/blob/master/libraries/SITL/examples/JSON/readme.md).

These links describe candidate interfaces, not evidence that those stacks have
passed this benchmark. Each adapter must use the same FMI plant; Gazebo,
JSBSim or another stack-specific plant is not a substitute.

## Preserving this change

The editable dependency checkout contains the implementation. Because `src/`
is not tracked by the root workspace, its source change is also saved as
`patches/cerebri-rdd2-benchmark.patch`, based on firmware revision
`bf784c752f7767bd1a8712a7fc64c5b522000323`. On a clean checkout at that revision,
apply it once from the workspace root:

```sh
git -C src/cerebri_rdd2 apply --check ../../patches/cerebri-rdd2-benchmark.patch
git -C src/cerebri_rdd2 apply ../../patches/cerebri-rdd2-benchmark.patch
```

It is already applied in the development VM. See [dependency patches](../patches/README.md)
for the complete set of setup/compiler repairs needed on a fresh checkout.

## Validation of this first implementation

- 25 unit/protocol tests pass through `rdd2:benchmark:test`.
- The normally ignored native firmware integration test was run explicitly
  with the built firmware and passes (26 tests exercised in total).
- Original and refactored runners each pass the 44-second flight with the same
  firmware executable and FMI library. Their 70,400-row trajectory CSV files
  are byte-for-byte identical.
- The comparator passes with zero allowed duration difference and 1e-9 limits
  for position/altitude meters and attitude degrees. Its floating-point
  interpolation reports position RMSE 7.14e-24 m despite identical inputs.
- The regular `rdd2:simulation:sil:test` command passes after the extraction.
- An attempted `--stack px4` run exits with an explicit not-implemented error.
- The dependency patch passes `git apply --check` against the original source;
  changed files pass whitespace checks.

The recorded host timing is diagnostic only: a compiler build ran concurrently
with one regression flight. No cross-stack performance conclusion follows.
The separate packaged Modelica crash and optical-flow qualification failures
from the earlier setup work have not been resolved by this extraction.

# ArduPilot JSON adapter: connection and flight diagnostics

ArduPilot is now connected to the same Rumoca-generated FMI plant as CogniPilot.
It passes a disarmed transport test and an experimental Guided flight. Neither
is a qualified four-stack comparison. Betaflight now has a separate native-pattern diagnostic; PX4 remains unimplemented.

The tested release is `Copter-4.7.1`, commit
`dbe792162d06cab66c3475fd5556bf7a120f119e`. ArduPilot source is unmodified.
The adapter/probe lives in the RDD2 native Rust runner and is preserved in
`patches/cerebri-rdd2-benchmark.patch` with the earlier benchmark foundation.

## Use the existing VM

From `~/autonomous-drone-bench` in the VM:

```sh
~/.nix-profile/bin/devenv -P rdd2 tasks run rdd2:benchmark:ardupilot:probe
```

This first runs CogniPilot SIL to build and validate the shared plant, then
launches the previously built ArduCopter binary for 8,000 exchanges at 1600 Hz
(five simulated seconds). Each probe uses a fresh directory below
`src/cerebri_rdd2/artifacts/ardupilot-probe/`, containing:

- `report.json`: success/failure, step and frame counts, timing, failure reason,
  and SHA-256 fingerprints of the executable, plant library and FMI description.
- `ardupilot.log`: firmware startup and sensor-ingress diagnostics.
- `probe.parm`: the exact parameters used.
- `mission-trajectory.csv`: plant position and attitude, not a commanded path.

Run one probe at a time: parallel allocation of the remaining SITL serial ports
is not yet implemented. The child process is stopped when the test finishes or fails. Physics only
advances after a valid response. Nonzero motor output fails before plant commit.
The default probe sends no arming command. Manual RC and RDD2 square-plan
commands remain rejected; the opt-in flight diagnostic uses a separate MAVLink
command link.

## Reproduce on a fresh Linux checkout

Apply the dependency patches as described in [patches/README.md](../patches/README.md).
Use the root source task to fetch the pinned ArduPilot checkout:

```sh
devenv -P rdd2 tasks run sources:ensure:ardupilot
```

The native build below was tested in a normal Ubuntu 24.04 aarch64 shell,
outside Devenv's Python environment. Its prerequisites are:

```sh
sudo apt-get update
sudo apt-get install --no-install-recommends g++ python3-empy python3-future python3-pexpect python3-lxml python3-yaml pkg-config
```

From the workspace root:

```sh
cd src/ardupilot
git rev-parse HEAD
# Verify dbe792162d06cab66c3475fd5556bf7a120f119e before building.
git submodule update --init --recursive --depth 1 \
  modules/waf modules/mavlink modules/gtest modules/gbenchmark \
  modules/littlefs modules/lwip modules/DroneCAN/DSDL \
  modules/DroneCAN/pydronecan modules/DroneCAN/dronecan_dsdlc \
  modules/DroneCAN/libcanard
./waf configure --board sitl --disable-scripting
./waf copter -j4
```

Do not run Waf with sudo. The probe task verifies the source revision and
requires `build/sitl/bin/arducopter`; it does not install system packages or
silently build another release. The report's revision is explicitly an expected
revision; the executable hash identifies what actually ran.

The runner also works natively without Devenv, using Rust and `sha256sum`:

```sh
cd src/cerebri_rdd2
cargo xtask ardupilot-probe \
  --executable ../ardupilot/build/sitl/bin/arducopter \
  --plant-directory ../modelica_models/artifacts/vehicles/rdd2/plant/Vehicles_Rdd2_Plant
```

Run the existing SIL workflow first to produce the compiled FMI library.
The probe discovers the host library from the FMI model identifier; no random
generated filename or x86-specific path is hardcoded.

## Protocol and coordinate contract

The adapter listens on an ephemeral loopback UDP port, passed to the child via
`--sim-port-out`. It accepts the pinned protocol's 16- or 32-channel packets,
validates lengths, magic and PWM range, and binds the session to the first peer.
After bootstrap it requires contiguous frame counters and 1600 Hz replies.
Duplicates are ignored; gaps/resets, malformed data and response timeouts fail.
No lost packet causes a physics step or an implicit vehicle reset.

The initial packet advertises ArduPilot's default rate before receiving any
physics timestamp. It is used only to establish the peer; it does not advance
physics. Subsequent replies must match the shared 625-microsecond step.
JSON replies carry no timestamp, so the adapter associates responses with the
current request using the contiguous frame counter. This is not a firmware
execution-time measurement.

Conversions are explicit and unit-tested:

- World ENU to NED: `[east,north,up]` becomes `[north,east,-up]`.
- Body FLU to FRD: `[forward,left,up]` becomes `[forward,-left,-up]`.
- RPY becomes `[roll,-pitch,pi/2-yaw]` for these frame conventions.
- Quad-X servo order FR, BL, FL, BR maps to plant order FR, BR, BL, FL:
  zero-based channel indices `[0,3,1,2]`.
- PWM 1000..2000 maps to normalized 0..1; disabled output 0 maps to 0.
  Other PWM values are rejected, not silently clipped.

Source references for this pinned protocol and mixer:
[SIM_JSON.h](https://github.com/ArduPilot/ardupilot/blob/dbe792162d06cab66c3475fd5556bf7a120f119e/libraries/SITL/SIM_JSON.h),
[SIM_JSON.cpp](https://github.com/ArduPilot/ardupilot/blob/dbe792162d06cab66c3475fd5556bf7a120f119e/libraries/SITL/SIM_JSON.cpp),
[AP_MotorsMatrix.cpp](https://github.com/ArduPilot/ardupilot/blob/dbe792162d06cab66c3475fd5556bf7a120f119e/libraries/AP_Motors/AP_MotorsMatrix.cpp).

## Scientific limits and next work

Unlike CogniPilot's direct sensor ingestion, this JSON backend requires explicit
simulation position, velocity and attitude. ArduPilot then generates additional
sensor streams internally, including magnetic field. `SensorFrame` therefore
has an explicit optional `SimulatorState`; CogniPilot receives `None`, and this
probe supplies `Some`. The adapter still cannot advance or access the plant.

The adapter does not consume the shared held GNSS observation as a direct GNSS
measurement. Internal noise, delays, sensor update rates, actuator thrust curve
and estimator behavior have not been harmonized. Shared physics alone does not
establish sensor parity. `no_lockstep` stays false; the test does not enable
truth-as-estimator or bypass arming checks.

Before flight comparison: resolve shared sensor injection and connect the
common commanded trajectory/control level to the other stacks. Motor impulse
signs and ArduPilot arming/mode/setpoint mapping are now exercised by the
opt-in diagnostic below. `fastdyn-mission --stack
ardupilot` still fails deliberately; this probe is a separate, explicitly
limited qualification command.

## Validation

The pinned ArduCopter build succeeds. The real adapter passes 8,000 contiguous
steps with no motor actuation, both directly and through the workspace task.
The accompanying CogniPilot 44-second SIL flight passes. There are 31 passing
unit/protocol tests, including coordinate conversion, motor ordering, malformed
packets, bootstrap negotiation, rate changes, duplicate frames, frame gaps,
missing peers, and rejection of armed commands. The separate native CogniPilot firmware integration test also passes (32 tests
exercised in total). CogniPilot's full trajectory remains byte-identical to the
previous baseline.


## Opt-in Guided flight diagnostic

```sh
# Workspace root; runs CogniPilot SIL and the disarmed probe first:
devenv -P rdd2 tasks run rdd2:benchmark:ardupilot:flight

# Native runner, after building the common plant and ArduCopter:
cd src/cerebri_rdd2
cargo xtask ardupilot-probe --flight-diagnostic \
  --executable ../ardupilot/build/sitl/bin/arducopter \
  --plant-directory ../modelica_models/artifacts/vehicles/rdd2/plant/Vehicles_Rdd2_Plant \
  --output artifacts/ardupilot-flight
```

The diagnostic first checks each rotor's roll, pitch and yaw response using
independent instances of the same plant. It then runs 145 simulated seconds:
90 seconds for estimator initialization, normal Guided arming during 90–100 s,
takeoff to 1.5 m at 100 s, reference commands during 110–135 s, and landing.
Normal arming checks remain enabled; no force-arm or truth estimator is used.
An earlier 30–40 s arming window failed with `Need Position Estimate`, despite
a GPS fix. The longer fixed warmup allows EKF3 to start using GPS.

`reference.rs` defines `enu-square-diagnostic-v1`: a 0.5 m ENU square at 1.5 m,
four 5-second minimum-jerk edges followed by a five-second hold, yaw zero ENU.
Position and velocity feedforward plus yaw are sent at 20 Hz in local NED.
This fixture differs from the legacy CogniPilot mission. A new
[CogniPilot external-reference diagnostic](shared-reference.md) now uses the
same reference. Sensor conditions remain unmatched, so neither run establishes
a controller ranking.

The loopback MAVLink 1 client uses the pinned generated dialect layouts;
heartbeat, mode and arm packets are checked against generated C fixtures.
It records command acknowledgements, GPS fix and EKF flags, rejects stale
heartbeats, and requires armed Guided mode throughout reference delivery.
The diagnostic stops on nonfinite state, horizontal displacement above 5 m,
altitude above 4 m, or roll/pitch above 0.8 rad. Completion requires observed
takeoff, altitude below 0.2 m and disarmed status. These are diagnostic bounds,
not tracking-accuracy acceptance criteria. The child is stopped on every exit.

Each flight folder also contains `commanded-trajectory.csv` with the actual
20 Hz references sent. The report identifies the reference and records 3D
position RMSE and maximum error against the continuous reference over
110–135 s, plus final position and motor impulse check status. Exchange timing
still includes transport and scheduling. Sensor noise/delay parity and motor
thrust-curve equivalence remain unqualified.

The validated run completed all **232,000** contiguous steps with no duplicates,
normal arm/takeoff/land acknowledgements and final disarmed status. Tracking
RMSE was **0.06252 m**, maximum error **0.09441 m** over 40,000 physics samples;
maximum flight altitude was **1.70516 m**. These are single-run diagnostics,
not comparative benchmark scores. Unit/protocol/reference tests: **35 passed**.


## Configurable figure-eight step (October 2)

The separate `rdd2:benchmark:ardupilot:figure-eight` task now accepts the shared
`docs/config/figure-eight.json` through `ardupilot-probe --config PATH`. It retains
the pinned binary, motor impulse checks, normal arming and at least 90 seconds of
estimator warmup. Position/velocity/yaw commands use the same 20 Hz timed
reference as the configurable CogniPilot run. The two-lap test passed, including
landing, with 0.09634 m overall RMSE over the reference plus terminal hold.
The historical 0.06252 m square score above is not a figure-eight score.

This pinned firmware uses `WP_SPD` (m/s) and `WP_ACC` (m/s²); the older
`WPNAV_SPEED`/`WPNAV_ACCEL` equivalents multiply these values by 100. Parameter
values are saved in each run's `probe.parm`. See [the timing rundown](timing-rundown.md)
for per-lap errors, sensor/timing qualifications and reproducible tasks. ArduPilot
results remain non-comparable until sensor, timing and takeoff conditions match.

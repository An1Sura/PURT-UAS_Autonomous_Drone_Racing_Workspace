# ArduPilot JSON adapter: connection qualification

ArduPilot is now connected to the same Rumoca-generated FMI plant as CogniPilot.
This is a **disarmed transport test**, not an autonomous flight or a controller
comparison. Betaflight and PX4 remain unimplemented.

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
No arming command is sent, and flight commands are rejected by this adapter.

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

Before flight comparison: validate motor-response signs with impulse tests,
resolve shared sensor injection, define the common commanded trajectory/control
level, and implement arming/mode/setpoint mapping. `fastdyn-mission --stack
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

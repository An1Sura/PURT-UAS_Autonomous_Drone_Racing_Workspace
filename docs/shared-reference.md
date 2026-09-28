# Two-stack shared-reference diagnostic

CogniPilot and ArduPilot now consume the same `enu-square-diagnostic-v1`
position, velocity and yaw reference. Both run against the same compiled FMI
plant. This removes the different-square-planner confound from the measured
square window; sensor paths and takeoff/landing still differ.

## Run

After applying the tested dependency patches and building ArduPilot as described
in [its guide](ardupilot-adapter.md), run from the workspace root:

```sh
devenv -P rdd2 tasks run \
  rdd2:benchmark:cognipilot:reference \
  rdd2:benchmark:ardupilot:flight
```

The task graph rebuilds and qualifies CogniPilot's original SIL baseline first,
then runs the two diagnostics. Repository locks serialize their runner tasks.
The original `rdd2:simulation:sil:test` remains the legacy regression fixture.

Native CogniPilot invocation, after building its firmware and common plant:

```sh
cd src/cerebri_rdd2
cargo xtask fastdyn-mission --external-reference \
  --native-sim build-native_sim/zephyr/zephyr.exe \
  --shared-memory artifacts/cognipilot-reference/lockstep.bin \
  --plant-directory ../modelica_models/artifacts/vehicles/rdd2/plant/Vehicles_Rdd2_Plant \
  --report artifacts/cognipilot-reference/report.json \
  --trajectory artifacts/cognipilot-reference/mission-trajectory.csv
```

CogniPilot writes its report, measured trajectory and `commanded-trajectory.csv`
under `artifacts/cognipilot-reference/`. Subsequent runs replace those files;
archive a run before repeating it. ArduPilot creates separate `run-*` folders.

## Recorded result

| Measurement, shared 25-second square-and-hold window | CogniPilot | ArduPilot |
| --- | --- | --- |
| Reference samples sent at 20 Hz | 500 | 500 |
| Physics samples evaluated at 1,600 Hz | 40,000 | 40,000 |
| 3D position RMS error | 0.04715 m | 0.06252 m |
| Maximum 3D position error | 0.08642 m | 0.09441 m |
| Complete flight, landing and disarming | Pass | Pass |

The reference samples agree to within `2.39e-15` in their numeric values and
`1.43e-14` seconds in relative timing. The reports have identical plant-library
and FMI-description SHA-256 fingerprints. See the [recorded verification](results/shared-reference.json).
CogniPilot's square window is simulation time 8.5–33.5 s in this run; ArduPilot's
is 110–135 s. Warmup and takeoff are outside the scored window.

These are diagnostic observations, **not a qualified ranking**. CogniPilot
still uses the legacy simulator-assisted takeoff/landing throttle law, while
ArduPilot uses its own Guided takeoff and landing. Internal sensor generation,
noise, delays and estimator behavior are not harmonized. The shared-clock step
does not imply identical sensor update rates. Host exchange timing is not
isolated controller execution time. HIL/BIL was not validated in this change.

## CogniPilot command path

The native runner samples `reference.rs` and sends the canonical ENU reference
through `PilotCommand`. The adapter converts it to the generated
`LocalPositionCommandData` record. The existing trajectory publisher accepts
this simulation ingress while the internal waypoint mission is empty; its
generated waypoint planner does not run the external trajectory.

Navigation, guidance, rate control, actuator allocation, health checks and
arming logic remain active. No controller gains or plant parameters changed.
The topic keeps its single publisher. Once external-reference mode is selected,
an internal waypoint plan is rejected until restart.

The firmware rejects non-finite, future, stale, wrong-frame or masked references,
backward timestamps, changes to an already-published timestamp, and mixed
internal/external plans. Guidance retains its existing 100 ms freshness check.
The runner checks that the firmware echoes each current local reference after
allowing for the existing output publication interval. This run performed
31,500 successful echo checks during the scored window.

## Coordinate-origin correction

CogniPilot's estimator captures a GNSS origin at the drone's resting height.
Here that is 200.098 m MSL, or 0.098 m above the benchmark's ENU datum. Sending
an unconverted 1.5 m local command produced an unintended physical height offset.

The firmware now exposes its captured origin as read-only metadata. The adapter
subtracts that fixed offset from canonical position commands; velocity and yaw
are unchanged. For this run a canonical 1.5 m target becomes 1.402 m in the
estimator's local frame. This is a coordinate conversion, not truth-position
feedback or a controller gain adjustment. Reports record the origin used.

The lockstep ABI is versioned with magic `0x52444735`, a 1,264-byte layout,
external-reference input and navigation-origin output. Both C and Rust assert
the layout. Rebuild firmware and runner together; old binaries are incompatible.
The FastDyn transport has the corresponding fields, but only native SIL was
exercised here.

## Validation and next step

- 37 unit/protocol tests pass, plus two explicitly run native firmware tests.
- Real firmware echoes valid external references and rejects future, stale,
  non-finite and mixed-plan inputs.
- The legacy CogniPilot qualification passes and its trajectory is byte-identical
  to the original benchmark baseline.
- The new CogniPilot flight, ArduPilot disarmed probe and ArduPilot flight all pass
  through the workspace task graph.

Next, align sensor delivery and document the remaining frame/actuator semantics,
then replace or standardize the takeoff and landing paths. Repeated trials and
matched disturbances are needed before making controller-performance claims.

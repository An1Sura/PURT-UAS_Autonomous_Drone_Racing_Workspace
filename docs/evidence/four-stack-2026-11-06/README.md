> Update: [November 6 qualification audit](../qualification-2026-11-06/README.md) supersedes the earlier arming-check claim: inherited FastDyn hooks also bypassed checks. The checked configuration removes those overrides. ArduPilot estimator alignment now succeeds; logging/terrain storage remain blocked. PX4 now reaches the NuttX scheduler. Neither has a qualified flight.

# Actual integration attempts — November 6, 2026

No new PX4 or ArduPilot figure-eight flight has passed. The existing CogniPilot and Betaflight recordings are unchanged. Their equal 40 s reference lap and 83 s full schedule are prescribed inputs, not measured maximum-speed limits.

## ArduPilot: Rumoca → FMU → FastDyn → ARM firmware

The user selected the existing upstream FastDyn STM32F427/Cortex-M4 target instead of a TROPIC port. The upstream precompiled `arducopter_v462` ARM ELF has SHA-256 `3fc6ee14e94f5f8b4133b06747145a8e40c7755940b9f87fdab1ad4323c0aa8c`. It is sourced from [FastDyn at 94c85f3](https://github.com/jgoppert/FastDyn/tree/94c85f3e47be410e8d760b7f8207eb1580d7cd4c), `virtuals/physics/flight_controllers/courbet/bin/arducopter_v462`. This does not establish a reproducible build of that binary from an independently checked ArduPilot source revision.

The plant is `FastDyn.Copter`, wrapping CogniPilot `Vehicles.Templates.QuadrotorPlant`, compiled with the installed Rumoca 0.10.0 executable into FMI 3 C, then a native aarch64-linux shared library. The [FMU description](modelDescription.xml), [binary hashes](commissioning-firmware.sha256), [source changes](fastdyn-fmi.patch), and [seven passing loader tests](ardupilot-fmi-compatibility-test.log) are retained here. The loader now reads the actual FMI token and library name from XML. Frame adaptation explicitly converts ENU/FLU plant outputs to NED/FRD firmware inputs; an extra magnetometer sign conversion was removed for already-FRD data. No onboard controller equation was changed.

The plant library hash is `02304d76ceae876d5b0d1e9ccb90a092010a38a3c787b37e1711db087f7e8df3`. This is a different plant configuration from the shared RDD2 benchmark: upstream mass is 2.5644001 kg, arm length 0.25 m, and its other defaults are retained. This is a ground integration diagnosis, not sensor or vehicle parity. Its large emulated memory allocation is inherited from upstream rehosting and is not the physical board's RAM specification.

Five attempts are retained in the VM. Attempt 01 failed on an unavailable SVD; numeric-address configuration resolved that. Attempt 02 exposed the upstream demo's force-arm/default checks settings and was stopped; it is not qualifying evidence. Attempts 03–05 retained `ARMING_CHECK=1` and `--no-force-arm`. ENU/FLU and compass-frame fixes were tested in attempts 04 and 05. [Attempt 05](ardupilot-commissioning05.log) still fails normal arming after 120 wall-clock seconds with EKF attitude and magnetic-field prearm errors. No takeoff, landing or tracking score is claimed. The helper is still the upstream commissioning mission, not the requested figure-eight.

Native reproduction, from the pinned FastDyn checkout after applying `fastdyn-fmi.patch` and copying the metadata test into `tests/unit/`:

```sh
pytest tests/unit/test_fmu_runtime_metadata.py tests/unit/test_fmu_build.py
meson setup build-ardupilot -Dqemu_path=/absolute/path/to/qemu -Ddevice_models=true -Denable_phy=true -Denable_fmu=true -Denable_flight_controllers=true
meson compile -C build-ardupilot -j2
```

Compile the model using the workspace's existing Rumoca and Modelica sources (the installed compiler does not support upstream's `--build` switch):

```sh
rumoca compile modelica/FastDyn/Copter.mo --model FastDyn.Copter --source-root modelica --source-root /absolute/path/to/modelica_models --output /absolute/path/to/ardupilot-rumoca-plant-framed --target fmi3
```

Compile generated `sources/model.c` as a shared library with `-shared -fPIC -O2 -DFMI3_OVERRIDE_FUNCTION_PREFIX=1`, FMI 3 headers and `-lm`. Use the actual `CoSimulation.modelIdentifier` for the filename under `binaries/aarch64-linux/`. Set `FASTDYN_FMI_OUTPUT` to that generated FMU directory, `FASTDYN_QEMU_PATH` to the pinned QEMU executable, and `FASTDYN_PARAM_FILE` to `fastdyn/ardupilot/commissioning.param`. Run the supplied `fastdyn/ardupilot/upstream-commissioning.toml` with native `fastdyn run -c ... -o ... --no-build-fmu`. Activate the FastDyn virtual environment first so its MAVLink helpers are available. Run QEMU jobs sequentially: upstream FastDyn stops existing QEMU processes.

Next: resolve the actual estimator sensor/frame/timestamp mismatch while retaining checks; then connect the shared timed figure-eight and matched plant/sensor configuration. Do not interpret a forced-arm demonstration as completion.

## PX4: TROPIC ARM startup, not a Rumoca flight yet

Official PX4 source `bf59c29e8b8cb9ac66729efc8ce26e41a875f634`, `nxp_mr-tropic_default`, RT1064/Cortex-M7/NuttX. The unchanged hardware build is preserved in VM `artifacts/px4-hardware-build/`; its earlier evidence remains in `../px4-tropic-2026-11-05/`.

The simulation variant adds `-DADR_FASTDYN=ON` to the native target's CMake arguments. [Patch](px4-ram-storage.patch): a volatile 256 KiB NOR-like parameter store replaces unavailable ROM flash calls, keeping bounds checks and erase/program semantics. It does not persist across runs. This is a simulation-only artifact, **not the firmware to flash**. Simulation ELF SHA-256: `1dc124e8007a089f9b70ddb7a14a291f7432b856d15f13630ae20dc5e1ea0107`.

The first patched run passed the ROM fault but [waited for SNVS RTC enable](px4-boot03-position.txt). `fastdyn/px4/snvs_px4.c` is a separate model using QEMU virtual time for the 32768 Hz counters, enable and LP→HP synchronization. Native C tests cover fractional counter progression, synchronization and stopped-counter behavior. The original model used by existing recordings is unchanged. Alarms, tamper, security and physical RTC accuracy are not modeled.

Build this additional model through FastDyn's native `boardrunner/boardrunner_sdk` CMake project, target `snvs_px4`, after copying its source into the model directory. Use `fastdyn/px4/boot-probe.toml` with the simulation ELF and the pinned QEMU/runtime paths. FastDyn pin is as above; QEMU pin is `99b54836ded8dc3271eba52deee7453efc0a13b9`.

[Attempt 05 debugger evidence](px4-boot05-position.txt) reaches `board_app_initialize` and waits in `imxrt_clock` for `USDHC_PRSSTAT_SDSTB` during SD-card initialization. This demonstrates progress beyond RTC startup, not full startup or flight. Next work is explicit absent-card handling or USDHC device emulation, then real sensor/actuator integration with the common Rumoca plant. No PX4 plant connection currently exists.

## What can be compared

Only the pre-existing CogniPilot and Betaflight ARM recordings currently provide figure-eight trajectories. Neither these boot attempts nor host runtime measure physical loop latency, Zephyr driver overhead, jitter or superiority over ArduPilot. No new replay was fabricated for either incomplete stack.

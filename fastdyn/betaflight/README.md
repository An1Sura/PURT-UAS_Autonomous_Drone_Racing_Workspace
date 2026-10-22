# Betaflight ARM flight through FastDyn

On October 22, 2026, the patched OMNIBUSF4 ARM firmware completed the shared
10 × 10 m figure-eight at 2 m altitude: one 40 s reference lap, 83 s full mission,
0.143348 m RMS / 0.350121 m maximum tracking error. Landing, firmware disarm,
and all four stopped motors were verified. A preceding 53 s hover test passed.

## What actually executes

Betaflight ARM ELF → FastDyn/QEMU Cortex-M4 → shared-memory virtual sensor,
receiver, motor and clock interface → existing Rust shared-sil runner → same
Rumoca plant and generated position controller used by CogniPilot.

The ARM build retains Betaflight's scheduler, attitude/rate controllers, estimator,
mixer and arming checks. Project changes inject plant IMU samples, MSP receiver
frames and deterministic time, capture mixer output, and add the existing
benchmark feed-forward terms. This is **modified benchmark firmware**, not an
unmodified board firmware flight or a complete peripheral emulation. Physical
interrupts are disabled after startup; SPI/DMA/EXTI/PWM latency is not measured.
The boot-only MPU identity and ADC fixtures do not generate flight sensor data.
Accelerometer quantization is 2048 counts/g (native SITL uses 256). Different
board targets and firmware schedules remain comparison limitations.

## Pinned sources

- Betaflight: `744f95fa31542c4c906f18072348a366ab11b6b7` plus [ARM patch](../../patches/betaflight-fastdyn.patch).
- Official Betaflight config: `96910e90881573589b2a6c41f7392b7afad63973`, `configs/AIRB/OMNIBUSF4/config.h` (STM32F405). This does not identify the team's physical board.
- FastDyn: `94c85f3e47be410e8d760b7f8207eb1580d7cd4c`.
- QEMU: `99b54836ded8dc3271eba52deee7453efc0a13b9`.
- Compiler: Arm GNU 15.2.1, overriding upstream's compiler version requirement.
- Rust integration: [Cerebri patch](../../patches/cerebri-rdd2-benchmark.patch); `betaflight_fastdyn.rs` provides the ARM transport.

## Reproduce

Use the existing `rdd2` Devenv shell. Apply the ARM patch to a clean pinned
Betaflight checkout (do not layer the native SITL patch onto it), then build:

```sh
make CONFIG=OMNIBUSF4 CONFIG_DIR=/absolute/path/to/betaflight/config \
  ARM_SDK_PREFIX=arm-none-eabi- GCC_REQUIRED_VERSION=15.2.1 \
  EXTRA_FLAGS="-DADR_FASTDYN -DUSE_MSP_CLI_COMMAND" -j2
```

Apply the Cerebri patch to its pinned clean checkout and build with
`cargo build --release -p cerebri-rdd2-xtask`. Copy the two model C files into
FastDyn's `boardrunner/boardrunner_sdk/model/`, then build their CMake targets
`stm32f405_boot` and `stm32f405_spi`.

The [flight config](flight.toml) records the exact existing workspace plant,
controller and mission inputs. From the pinned FastDyn checkout, set absolute
paths for `ADR_WORKSPACE`, `BETAFLIGHT_ARM_ELF`, `FASTDYN_QEMU_PATH`,
`ADR_FLIGHT_OUTPUT`, and a **fresh** `ADR_MEMORY_DIR` for each run. Set
`FASTDYN_QEMU_MEMORY_DIR` to that same directory and
`ADR_FLIGHT_SHAPE=figure-eight` (or `hover` for qualification). Run the pinned
FastDyn venv executable with `fastdyn run -c /absolute/path/to/flight.toml -o
/absolute/path/to/new-output`. Keep instruction tracing off; redirect FastDyn's
working-directory `debug.log` and `io.log` to `/dev/null` to avoid filling disk.

## Evidence and limits

[Report and actual trajectory](../../docs/results/fastdyn/betaflight-figure-eight/),
[build/test/run evidence](../../docs/evidence/betaflight-fastdyn-2026-10-22/),
and [older unsuccessful boot probes](../../docs/evidence/betaflight-fastdyn-2026-10-21/).
The report identifies exact firmware, runner, plant and controller SHA-256 values.
664,000 acknowledged ARM exchanges cover 83 simulated seconds. Wall time was
150.127 s; this is emulator execution cost, not drone lap time or hardware latency.
The four ordered trajectory quadrants and return to center were checked from
recorded samples. The replay is downsampled to 20 Hz and retains the final sample.
Full 100 Hz trajectory is published; the binary actuator trace is retained locally
and on the VM with its checksum in evidence.

This is a no-noise, plant-truth-position commissioning run using the existing
native hover-throttle calibration. It does not establish maximum racing speed,
sensor parity, real MoCap coverage, or readiness to flash/fly physical hardware.

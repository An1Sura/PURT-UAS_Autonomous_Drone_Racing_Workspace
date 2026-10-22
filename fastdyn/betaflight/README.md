# Betaflight OMNIBUSF4 FastDyn bring-up

Status: **experimental boot probe, not a flight backend**. The existing Betaflight
flight recordings remain Linux SITL recordings. No new FastDyn Betaflight flight,
lap time, tracking error, landing, or hardware latency result is established here.

## Sources and board

* Betaflight: `744f95fa31542c4c906f18072348a366ab11b6b7`.
* Official board-config repository: `96910e90881573589b2a6c41f7392b7afad63973`.
* Target: [AIRB/OMNIBUSF4](https://github.com/betaflight/config/blob/96910e90881573589b2a6c41f7392b7afad63973/configs/AIRB/OMNIBUSF4/config.h),
  STM32F405, Cortex-M4. This is the selected emulation target, not an identification
  of the team's physical Betaflight board. The Tropic CogniPilot target is different.
* FastDyn: `94c85f3e47be410e8d760b7f8207eb1580d7cd4c`.
* Arslan8/QEMU: `99b54836ded8dc3271eba52deee7453efc0a13b9`.
* Compiler actually used: Arm GNU 15.2.1; the Make compiler-version requirement
  was explicitly overridden. This differs from the upstream default toolchain.

The two peripheral models in this directory are project-written additions, not
upstream Betaflight drivers or a complete upstream FastDyn OMNIBUSF4 model.
The ARM firmware source was not modified for these probes.

## Verified progress (October 21, 2026)

1. Board-specific ELF and HEX built. ELF SHA-256:
   `e38bcad0b514f1851077c2a1f4a69d6089293a77c5e522a7a106be7a1144f559`.
2. FastDyn/QEMU executes the actual ARM firmware, with debugger backtraces.
3. Initial firmware repeatedly entered `Reset_Handler`. RTC backup storage and
   RCC clock-status behavior were missing. `stm32f405_boot.c` moves execution
   past this loop to `mpu6000SpiDetect` (probe 09).
4. The polled SPI fixture moves execution past the SPI-ready wait (probe 10).
5. Current blocker: `sensorsAutodetect` polls ADC1 status at `0x40012000`, bit 2,
   which remains zero. ADC conversion completion is not modeled.
6. Standalone assertions pass for oscillator enable/ready behavior, clock
   selection, backup-register retention/subword accesses, and SPI identity
   transactions, chip select, and receive-ready clearing.

Evidence: [logs, debugger traces, source revisions and firmware checksums](../../docs/evidence/betaflight-fastdyn-2026-10-21/).
The diagnostic runs are bounded and end by timeout; timeout is not flight success.

## Model limitations

`stm32f405_boot.c` uses immediate oscillator-ready transitions and infers a warm
reset from the repeated CCM-enable write in this firmware's reset sequence.
It is a boot approximation, not a complete reset controller. Flash control is
minimal; the executable flash bank is writable file-backed memory, without
accurate erase/program timing or protection semantics.

`stm32f405_spi.c` is explicitly a **boot-only identity fixture**: SPI1 reports an
MPU6000 WHO_AM_I and product revision. It does not provide plant-driven inertial
samples, sample timing, DMA, or interrupts. SPI2/3 represent absent devices.
No motor/PWM/DShot model, receiver stream, or autonomous command interface has
been connected. It must not produce benchmark results or replace the website's
recordings in its present state.

## Reproduce using the existing VM

Use the repository's Devenv `rdd2` shell for build tools. The current clean
Betaflight dependency worktree is `artifacts/betaflight-fastdyn`; the existing
FastDyn dependency worktree is `artifacts/fastdyn-pinned`.

Build the board firmware inside its source directory:

```sh
make CONFIG=OMNIBUSF4 \
  CONFIG_DIR="$HOME/autonomous-drone-bench/src/betaflight/src/config" \
  ARM_SDK_PREFIX=arm-none-eabi- GCC_REQUIRED_VERSION=15.2.1 -j2
```

Copy the two model C files to FastDyn's `boardrunner/boardrunner_sdk/model/`,
then use its existing configured CMake build:

```sh
cmake -S boardrunner/boardrunner_sdk -B boardrunner/boardrunner_sdk/build
cmake --build boardrunner/boardrunner_sdk/build \
  --target stm32f405_boot stm32f405_spi -j2
```

From the workspace root, build the standalone tests and pass both plugin paths:

```sh
cc fastdyn/betaflight/test_boot_models.c -ldl -o /tmp/test_betaflight_boot_models
/tmp/test_betaflight_boot_models \
  artifacts/fastdyn-pinned/boardrunner/boardrunner_sdk/build/stm32f405_boot.so \
  artifacts/fastdyn-pinned/boardrunner/boardrunner_sdk/build/stm32f405_spi.so
```

Run FastDyn from its source root, supplying absolute paths to the QEMU binary,
firmware ELF, config and output directory. Use the existing pinned FastDyn venv.

```sh
export FASTDYN_QEMU_PATH=/absolute/path/to/qemu-system-arm
export BETAFLIGHT_ARM_ELF=/absolute/path/to/betaflight_STM32F405_OMNIBUSF4.elf
timeout -k 5 55 /absolute/path/to/venv/bin/fastdyn run \
  -c /absolute/path/to/omnibusf4.toml -o /absolute/path/to/new-probe
```

The config disables QEMU instruction tracing. FastDyn additionally writes
`debug.log` and `io.log` in its working directory: both were redirected to
`/dev/null` for these probes, after preserving useful diagnostic evidence.
The VM has under 1 GB free; unrestricted tracing previously filled it.
GDB is enabled for diagnosis on port 1234; disable it when not debugging.

## Remaining work before using this for a flight

Implement and validate ADC startup, real plant-driven MPU6000 sampling and
SPI/DMA/EXTI scheduling, receiver/autonomous command injection, and timer/DMA
motor command extraction. Then connect the existing common Rumoca plant and
10 x 10 m figure-eight at 2 m altitude. Require actual armed flight, one lap,
tracking measurements, and firmware disarm plus stopped motors at landing.
Only publish a FastDyn Betaflight replay after those checks pass. Emulated
instruction time alone cannot establish real-board latency.

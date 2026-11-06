# Betaflight TROPIC / FastDyn integration

This is a separate ARM commissioning target. The existing STM32F405 results remain historical measurements; they are not evidence that the RT1064 target has the same tuning or speed limit.

## Sources and actual target

| Component | Source / pinned revision |
|---|---|
| Betaflight NXP firmware | [PR #15852](https://github.com/betaflight/betaflight/pull/15852), `e1d8d27f59fa166bd637f59d465437212cdc9cdd` |
| MR_VMU_TROPIC configuration | [config PR #1230](https://github.com/betaflight/config/pull/1230), `43f9df5ee4adf747603b4ade0daddeab2c4b100c` |
| NXP SDK | `mcux-devices-rt`, `3664324bd1240a92e05a31301f6636a7a19f01d2` |
| TinyUSB | `86ad6e56c1700e85f1c5678607a762cfe3aa2f47` |
| FastDyn | `jgoppert/FastDyn`, `94c85f3e47be410e8d760b7f8207eb1580d7cd4c` |
| QEMU | Existing pinned FastDyn build, `99b54836ded8dc3271eba52deee7453efc0a13b9` |
| Plant | `CogniPilot/modelica_models`, `a41f7c0c00b55c1bf54f03c9b66b901ba8e43c6f`; generated Rumoca plant SHA-256 `284cced3ceec15128886d05753900b8ae47f38570ce0112c50e801356de97654` |

The compiled target is **MR_VMU_TROPIC / MIMXRT1064 / ARM Cortex-M7**. The pinned board configuration names schematic SPF-94468 Rev D and ICM45686. This does not identify the revision or IMU on the team's physical board. QEMU uses the firmware's boot vectors at `0x70002000`, 4 MB XIP flash, 256 KB ITCM, 256 KB DTCM and 512 KB OCRAM2. The mailbox lives in DTCM.

## What runs

The real ARM Betaflight executable runs its scheduler, estimator and flight controllers. Our simulation adapter supplies virtual gyro/accelerometer readings, normal RC channels and simulated time, and captures motor commands. The host runs the shared generated position loop and Rumoca plant. Stock controller equations are not edited by this adapter.

This does **not** emulate measured IMU latency, SPI/DMA throughput, internal ADC behavior, flash programming, or physical CPU timing. The adapter advances firmware time in lockstep and disables hardware interrupts after startup. Its cycle counts cannot establish driver overhead or hardware loop speed.

## Build distinction

The unpatched PR firmware was successfully compiled with Arm GNU 15.2.1 before simulation changes. Its ELF SHA-256 is `cd22d3c03acc848259b15397e771a1e999ce7a86b8fe23439e2b6ee10fc0ddb8`; its HEX SHA-256 is `ba43d9ad0c9e8232f6ef2bbc88ff7e030270495d70aaf34c308907d988095393`. These are build artifacts, not hardware-qualified flight firmware.

The simulation build additionally enables `ADR_FASTDYN`, `USE_MSP_CLI_COMMAND`, `USE_VIRTUAL_GYRO`, `USE_VIRTUAL_ACC` and `VIRTUAL_GYRO_SAMPLE_RATE_HZ=8000`. Do not flash this simulation variant to fly a drone.

Native build command, from the pinned Betaflight checkout, with the compiler on PATH:

```sh
make CONFIG=MR_VMU_TROPIC ARM_SDK_PREFIX=arm-none-eabi- GCC_REQUIRED_VERSION=15.2.1 -j2
```

Initialize the pinned `src/config`, `lib/modules/mcux-devices-rt`, `lib/modules/tinyusb` and `lib/modules/mavlink` submodules first; the config checkout must use the revision above. The simulation patch is retained in [the evidence directory](evidence/betaflight-nxp-2026-11-05/betaflight-nxp-fastdyn.patch). Apply it only to the matching firmware revision and add the simulation flags through Make's `EXTRA_FLAGS`.

## Startup diagnosis, November 5

1. Unmodified startup rejected the emulator's GPT2/SysTick timing. The simulation variant uses the existing host-controlled clock interface instead.
2. Flash-backed configuration writes faulted against protected XIP memory. The simulation variant uses upstream `CONFIG_IN_RAM`.
3. The default 4,096-byte RAM settings area was too small: the compiled parameter registry serializes to 4,779 bytes. Its capacity is now 8,192 bytes, matching the target's flash configuration allocation. Configuration validation remains enabled.
4. Internal ADC initialization waited indefinitely for an unmodeled conversion. `USE_ADC_INTERNAL` is excluded only for `ADR_FASTDYN`.
5. Hover attempt 04 passed: 53 s simulated time, 424,000 firmware exchanges, RMS 0.024720754 m, maximum error 0.030520613 m. Final state was disarmed, all motors zero, plant height 0.098365558 m at ground contact.

The earlier failed attempts are retained in VM artifacts. The subsequent figure-eight also passed: one 40 s reference lap within an 83 s full mission, RMS 0.194592934 m, maximum 0.507111253 m, zero tilt clamps, 664,000 firmware exchanges, and verified landing/disarm with zero final motor commands. [Raw report](results/tilt-lead/fastdyn/betaflight-nxp/report.json) and [recording](results/tilt-lead/fastdyn/betaflight-nxp/replay.json) retain the actual final sample. This is not hardware qualification.

## Interpretation of inherited settings

The common configuration retains the previously selected attitude gain of 6/s. Its `tuning_status` field describes the earlier native tuning campaign; it is not a new RT1064 step-response qualification. The 26 s Betaflight native speed result also belongs to the earlier firmware revision. Requalify tuning and speed on this NXP revision before making performance claims.

After provisioning the pinned firmware and existing plant/runtime, the canonical run task is `devenv -P rdd2 tasks run rdd2:benchmark:fastdyn:betaflight-nxp`. It invokes FastDyn with `fastdyn/betaflight-nxp/flight.toml`; no separate runner is required.

The canonical task also passed a 58 s position-step flight (RMS 0.147306308 m, maximum 0.500849954 m) and verified landing. This position step is not the four-probe attitude-gain qualification. The STM32 figure-eight regression retained exactly 0.143412353 m RMS / 0.348383841 m maximum with the updated transport. See [step report](evidence/betaflight-nxp-2026-11-05/step-report.json) and [regression report](evidence/betaflight-nxp-2026-11-05/stm32-regression-report.json).

[Next timing and estimator experiments](timing-and-preintegration-plan.md) distinguish simulation evidence from physical timing and propose controlled FOH/preintegration comparisons.

# Hardware preparation and PDF compliance

Reviewed the 13-page “CogniPilot vs Betaflight Flight Control Benchmark 2 (2)” supplied November 5. PDF SHA-256: `8ac9f0a93ef2836ce95be2ebd73ad7c646f2c8a72066d756d3473b733f239744`. The dated document states October 8; the local copy is identified by hash rather than an assumed revision number.

## What we can explain and demonstrate now

One shared trajectory and one shared position controller run on the host. They compute tilt, yaw rate and thrust. The per-stack mapping adds the trajectory rate lead to ordinary tilt commands, using the selected attitude gain. Each ARM autopilot then runs its own estimator, attitude/rate controller and mixer in QEMU, with FastDyn connecting it to the same Rumoca plant. The webpage replays actual recorded positions; it does not run ARM firmware in the browser.

The PDF explicitly retains offboard feed-forward in the angle inputs. Removing extra onboard feed-forward modifications does not mean removing that offboard lead. Current recordings use the normal-stick method. Simulator transport/clock/sensor hooks remain and are disclosed; hardware firmware is built separately.

## Exact compiled hardware targets

| Item | CogniPilot hardware build | Betaflight hardware build |
|---|---|---|
| Board / MCU | `mr_vmu_tropic/mimxrt1064`, Cortex-M7 | `MR_VMU_TROPIC`, `MIMXRT1064`, Cortex-M7 |
| Firmware source | `CogniPilot/cerebri_rdd2@bf784c752f7767bd1a8712a7fc64c5b522000323`, workspace patches | NXP PR #15852 at `e1d8d27f59fa166bd637f59d465437212cdc9cdd`, unpatched hardware artifact |
| Board definitions | `zephyr_boards@1d7c17e875938082f024e80d114ac82c25aa53a9` | config PR #1230 at `43f9df5ee4adf747603b4ade0daddeab2c4b100c`, identifies SPF-94468 Rev D |
| RTOS | Zephyr `5ddc8c25b49aa10b5daf0ac7555baaf0f12ecc83` | Betaflight scheduler, not Zephyr |
| IMU selected in sources | ICM45686, 1600 Hz gyro/accelerometer, 10 MHz maximum SPI clock | ICM45686 in the pinned board configuration; live operating settings unverified |
| Receiver configuration | CRSF, LPUART8; node label `sbus0` does **not** mean SBUS—the compatible is `tbs,crsf` | UART8 selected; receiver protocol and endpoint settings still need hardware commissioning |
| Motor output | FlexIO DShot600 configured | Actual ESC mode/rate must be set and matched during commissioning |
| SPI DMA | `CONFIG_SPI_NXP_LPSPI_DMA` disabled in this build | No measured SPI/DMA result claimed |
| Simulation hooks | `CONFIG_CEREBRI_LOCKSTEP` and `CONFIG_RDD2_FASTDYN` disabled | No `adrFastdyn` symbols in the preserved hardware ELF |

These are verified **build settings**, not observations of the user's physical board. Board revision, installed IMU, actual airframe mass/inertia, propulsion and wiring remain unverified. The shared 2 kg plant is the benchmark model, not a measured weight of the assembled drone.

## Firmware artifacts prepared

Local bundle: `firmware/hardware-handoff-2026-11-05/` (binaries remain local; checksums and build evidence are in the repository).

- CogniPilot: application ELF, signed BIN/HEX, generated Devicetree and `.config`; separate MCUboot ELF/BIN/HEX; generated runner and domain metadata.
- Betaflight: clean NXP PR ELF and HEX, preserved before applying emulator changes.
- `SHA256SUMS`: all 13 original bundle files verified after copying from the VM.

CogniPilot application ELF SHA-256: `ff13925affb598595d75194f1a5554371d9217675667e8cb71e87d0669564481`.
CogniPilot signed BIN SHA-256: `b167d76aa6aeed02ed35321281a07b83ba60cbe3beb65ae20739d43d0adb99f6`.
Betaflight ELF SHA-256: `cd22d3c03acc848259b15397e771a1e999ce7a86b8fe23439e2b6ee10fc0ddb8`.

CogniPilot rebuilt successfully through `devenv -P rdd2 tasks run rdd2:firmware:build`. MCUboot uses the upstream development signing key; this is a development bundle, not a production-secured release. No private signing key is included.

**Build-ready is not receiver-compatible, flight-qualified, or a completed hardware flash.** No board was flashed. Do not substitute the QEMU binaries for these hardware images.

## Receiver identification and integration issue

The photo identifies **FrSky Archer Plus R6 Lite / R6L**, a receiver, not the handheld transmitter; installation is unverified and the user reports no receiver currently installed. Its labels show SBUS IN/OUT and FBUS/S.Port. The [FrSky product description](https://www.frsky-rc.biz/ws/frsky-archer-plus-r6-lite-sr6-lite.html) lists SBUS and FBUS; it does not establish a CRSF output.

The existing CogniPilot CRSF configuration is therefore not a verified match. A reviewed SBUS option would need all of:

1. Select upstream `futaba,sbus` on the actual connected UART, with 100000 baud, even parity and two stop bits. Zephyr's SBUS driver configures these framing values.
2. Verify physical polarity/inversion. The UART driver supports `rx-invert`, but board circuitry and the chosen receiver cable must be checked before choosing it.
3. Convert raw SBUS channel counts to the microsecond-scale values expected by `src/interfaces/rc.c`. The inspected SBUS driver emits raw 11-bit values; blindly changing Devicetree would make the command scaling wrong.
4. Handle frame-lost/failsafe indications. The inspected driver defines both flags but does not invalidate the application's channels for failsafe; frame-lost handling logs status and still parses channels. Test valid/lost/recovered frames and stale-input timeout before flight.
5. Verify channel order, center/endpoints, ATTITUDE/ANGLE selection, arm and kill with props removed.

A CRSF-capable receiver shared by both drones is the alternative consistent with the current CogniPilot build. The photo does not authorize assuming the team has one. The user identifies the transmitter as RadioMaster TX16S MkII (Mode 2). Its RF module variant, receiver binding mode, installation and wiring must be resolved before a final radio profile is generated.

## Flash workflow, prepared but not executed

The CogniPilot generated runners are J-Link (default, `MIMXRT1064`), LinkServer and pyOCD (`mimxrt1064`). Its sysbuild metadata specifies MCUboot first, then the signed application. The repository's native `nix run .#flash` / Devenv flash task checks that order and flight configuration before invoking West. Preserve those checks; do not flash a signed application at a guessed address or overwrite an unknown bootloader casually.

Betaflight's clean HEX contains linked addresses. Its NXP bootloader/programmer procedure and the board's debug probe still need confirmation against the physical board. Do not apply STM32 DFU instructions to this RT1064 target.

## PDF checklist and honest completion status

| PDF requirement | Current evidence / remaining work |
|---|---|
| Shared generated trajectory and position loop | Implemented; generated-code checks and hashes retained |
| Same plant, normal sticks, 250 Hz command schedule | Implemented; sensor delivery/quantization differences documented |
| Identical-input repeatability | Prior native evidence exists; new NXP campaign repeats still required |
| Known-pattern onboard rate-command check (1.5) | Full per-stack internal-rate telemetry comparison remains outstanding |
| Ideal-attitude and same-math tests (2.2–2.3) | Prior checks retained; not a hardware result |
| Integrate feed-forward and compare attitude (2.4) | Numerical derivative checks exist; do not substitute them for the full integrated-attitude gate |
| Same-rule tuning and speed/noise sweeps | Earlier native campaign exists; NXP revision needs new tuning and both off/on sweeps, 3 noise levels × 5 seeds |
| ARM flight integration | Both stacks have actual shared-plant recordings; NXP Betaflight hover, position step and figure-eight passed |
| Stock onboard control equations | Normal-stick implementation preserves equations; gains/limits may change by the common rule; emulator I/O patches are separate |
| Per-stack estimator and feedback-share metrics | Not all required diagnostics are present; full stage 4 is not complete |
| PC robot pilot: QTM in, same eFMUs, trainer out | Hardware command path is not yet implemented/qualified; transmitter trainer protocol remains unknown |
| CogniPilot onboard logger at ≥1 kHz | SystemView tracing exists, but it is not evidence of the required complete flight-variable logger |
| Real-flight override/geofence/stale-data rules | Requirements recorded below; end-to-end hardware behavior unverified |

We must not say the entire PDF or the autonomous hardware system is complete merely because a figure-eight simulation passed.

## Real-flight requirements kept separate from simulation

The PDF's real-flight sequence uses **human takeoff and landing**. The human holds the trainer switch to grant the PC control. Arm and kill remain human-owned; the PC must not transmit authority over them. Stale mocap over 50 ms causes relinquishment; outer-geofence excursion or tilt over 45 degrees also hands back. Exact calibrated inner/outer boxes still need site data. The PDF's trainer latency estimate is not a measured value for this radio.

Before freezing the comparison, agree on non-inferiority margins; 1.1× error and 0.9× speed in the PDF are examples, not accepted measured results. Preserve all failed runs, off/on comparisons and seed/noise cells. Keep any subsequent controller/driver optimization as a separate experiment from the stock baseline.

## Team handoff

- Simulation work: source pins, baseline recordings, normal-stick mapping, qualification gaps and updated statistics are reviewable in this repo.
- Receiver/communications work: identify the handheld transmitter and trainer input; decide SBUS adaptation versus common CRSF receivers; verify wiring/polarity/endpoints and override behavior.
- Driver/timing work: use the actual ICM45686 build configuration above, not an assumed ICM42688. Measure acquisition-to-motor latency and jitter separately from emulated time.
- Reviewer checkpoint: review the compliance table and receiver mismatch before calling this ready for autonomous flight. No message has been sent to the team automatically.

## November 6 scope and handoff update

Current work focuses on CogniPilot and Betaflight on TROPIC. See [the PC virtual-pilot handoff](tropic-pc-pilot-handoff.md) for new flight results, hardware setup steps and conference completion gates. ArduPilot/PX4 historical evidence is retained outside the active scope.

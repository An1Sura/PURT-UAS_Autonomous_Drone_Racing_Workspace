# Four-stack TROPIC integration

The comparison requires real ARM firmware, explicit board targets, FastDyn/QEMU execution, and the same Rumoca plant. A compiled binary is not a completed simulation. Host build time and QEMU wall time are not measurements of physical control-loop latency.

## Source and target evidence

| Stack | Source inspected | Target and current boundary |
|---|---|---|
| CogniPilot | `CogniPilot/cerebri_rdd2`, `bf784c752f7767bd1a8712a7fc64c5b522000323` | TROPIC RT1064 / Cortex-M7 / Zephyr; existing recorded shared-plant flight |
| Betaflight | NXP PR #15852, `e1d8d27f59fa166bd637f59d465437212cdc9cdd` | MR_VMU_TROPIC RT1064 / Cortex-M7; existing recorded shared-plant flight; proposed upstream support |
| PX4 | `PX4/PX4-Autopilot`, `bf59c29e8b8cb9ac66729efc8ce26e41a875f634` | Official `nxp_mr-tropic_default`, MIMXRT1064DVL6A / Cortex-M7 / NuttX; build and rehosting in progress, no flight result |
| ArduPilot | Local `dbe792162d06cab66c3475fd5556bf7a120f119e`; current upstream hwdef directory at `d41c21f3baba1512bb19a9d6ecc34b88fdb034d0` | No TROPIC/RT1064 target found in inspected sources; a board/HAL port or additional source evidence is needed |

PX4 evidence: [board configuration](https://github.com/PX4/PX4-Autopilot/blob/bf59c29e8b8cb9ac66729efc8ce26e41a875f634/boards/nxp/mr-tropic/default.px4board), [NuttX configuration](https://github.com/PX4/PX4-Autopilot/blob/bf59c29e8b8cb9ac66729efc8ce26e41a875f634/boards/nxp/mr-tropic/nuttx-config/nsh/defconfig), and [linker layout](https://github.com/PX4/PX4-Autopilot/blob/bf59c29e8b8cb9ac66729efc8ce26e41a875f634/boards/nxp/mr-tropic/nuttx-config/scripts/script.ld).

ArduPilot's [inspected hardware definitions](https://github.com/ArduPilot/ardupilot/tree/d41c21f3baba1512bb19a9d6ecc34b88fdb034d0/libraries/AP_HAL_ChibiOS/hwdef) do not provide the required target. FastDyn's existing [Copter example](https://github.com/jgoppert/FastDyn/blob/c235932a60a7bb839e59cac111920fb3b5cbf1aa/configs/copter462.toml) uses STM32F427 / Cortex-M4 and a different plant. It cannot be labeled a matched TROPIC result. Earlier ArduPilot Guided-mode results remain separate evidence.

## PX4 build work

The native build command is `make nxp_mr-tropic_default -j2` inside the pinned checkout. The workspace's RDD2 Devenv shell supplies Arm GNU 15.2.1. PX4's own `Tools/setup/requirements.txt` supplies Python dependencies in a dedicated virtual environment.

Resolved setup failures:

1. Missing `kconfiglib` prevented configuration. Install the project's declared Python dependencies.
2. The CycloneDDS IDL generator crashed with SIGBUS even for `-h`. PX4 hardcoded `/usr/bin/gcc`, while this environment supplied Nix libraries. Selecting the active host `cc` fixed message generation. The [one-line build-only patch](evidence/px4-tropic-2026-11-05/host-compiler.patch) changes no flight-controller code.
3. PX4 replaces `PYTHONPATH` for ROS IDL generation. Dependencies visible only through the shell were then missing. Install requirements with `PYTHONPATH` and `PYTHONHOME` unset and explicitly select the virtual environment's Python through `CMAKE_ARGS=-DPython3_EXECUTABLE=/absolute/path/to/px4-venv/bin/python`.

[Source revision](evidence/px4-tropic-2026-11-05/revision.txt), [submodule revisions](evidence/px4-tropic-2026-11-05/submodules.txt), and [resolved Python dependencies](evidence/px4-tropic-2026-11-05/python-requirements.txt) are retained. Failed build logs remain in the VM artifacts.

## Rehosting requirements

PX4's linker layout uses 384 KiB ITCM, 128 KiB DTCM (including a reserved 1 KiB region), and 512 KiB OCRAM. Its application flash begins at `0x70020000`; the exact initial vector must be checked against the resulting ELF. Betaflight's 256/256 KiB TCM partition and vector address must not be copied blindly.

After a successful build, verify ELF architecture, vector addresses and loaded segments; then probe startup under the pinned FastDyn/QEMU. Resolve actual peripheral dependencies before adding the sensor/actuator exchange. The integration must retain the shared trajectory, position-loop boundary, sensor conditions and plant. A successful boot alone does not qualify hover, tracking or landing.

No PX4 or ArduPilot tracking error, lap time, landing result or hardware timing is currently claimed by this work.

### Final-link failure and compiler comparison

Attempt 04 compiled the firmware sources with Arm GNU 15.2.1 but failed at the final link: `R_ARM_PREL31` could not reach `.text.__udivmoddi4` from its `.ARM.exidx` entry. The linker reported flash 2,314,124 / 3,932,160 bytes, SRAM 111,156 / 524,288 bytes, and ITCM 231,144 / 393,216 bytes; memory capacity was not the reported failure. [Full log](evidence/px4-tropic-2026-11-05/px4-tropic-build04.log).

[PX4's Ubuntu guidance](https://docs.px4.io/main/en/dev_setup/dev_env_linux) documents the Ubuntu ARM compiler, including GCC 13.2.1. A fresh comparison build uses Ubuntu package `gcc-arm-none-eabi` version `15:13.2.rel1-2`, retaining the original linker script and control code. The failed GCC 15 build is preserved separately. Do not treat the failed link's size report as evidence of a runnable firmware image.

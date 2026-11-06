# November 6 qualification work

## Actual ARM speed flights

`../../results/arm-speed/betaflight-attempts.json` contains completed runs from the live FastDyn/QEMU campaign. Firmware: Betaflight MR_VMU_TROPIC / RT1064 / Cortex-M7, SHA-256 `c9530644680b907053022efa349bd0564701dd09ead526c862ac76d71755423f`. Shared Rumoca plant: `284cced3ceec15128886d05753900b8ae47f38570ce0112c50e801356de97654`. Each report records controller, configuration, runner and firmware hashes.

The 33-second candidate passed initial screening but passed only 13/15 confirmations: harsh-noise seeds 2 and 3 failed landing/disarm. Its tracking errors remained within limits, but both finished airborne with motors running. The 32-second screening run exceeded the 0.75 m maximum-error limit. The sweep is now testing slower candidates; no confirmed maximum-speed setting is available. Earlier 26/33-second native results are not these ARM results. Current ARM tuning/rate-command prerequisites remain open; see [the PDF checklist](../../simulation-qualification.md).

An operator scheduling error interrupted `confirm-33-realistic-3` at approximately 98 wall seconds: the installed `pidwait` does not accept `-p`, and the subsequent PX4 startup stopped QEMU. The incomplete trace/log/runtime are preserved in VM `artifacts/arm-speed-interrupted-20261106/`. This is an infrastructure interruption, not an accuracy pass or failure. The identical cell is rerun before the campaign advances. No interrupted trajectory is published as a completed recording.

## ArduPilot interface audit

Target: upstream FastDyn ArduCopter 4.6.2 ELF, CubeBlack/FMUv3/STM32F427/Cortex-M4 as identified by its debug information. Exact binary hash and source pin remain in the prior integration report. This is a different plant configuration from the RDD2 comparison.

- The inherited demo bypassed several arming checks. `ARMING_CHECK=1` alone was insufficient. The checked-hook files remove the identified bypasses; earlier attempts are diagnostic, not qualifying evidence.
- Firmware debug information and disassembly establish a 1 MHz ChibiOS time counter. The earlier adapter returned a millisecond-quantized 10 kHz counter.
- FIFO delivery now follows 8 kHz raw sample availability instead of supplying 24 samples on every poll. Samples in a batch currently hold the latest plant reading; this is not a hardware FIFO latency model.
- Actual Rumoca pressure/temperature outputs now enter the normal barometer frontend, including timestamps. EKF tilt/yaw alignment and GPS fusion complete.
- Supply voltage uses the ARM hard-float return register. Virtual parameter-storage health follows the actual bounded RAM store.
- Attempt 10 still refuses arming: logging and terrain storage are unresolved. No figure-eight or landing is claimed.
- The helper now fails on unconfirmed GPS fusion or missing disarm near ground. Five native tests pass. Firmware messages alone still do not establish plant ground contact and stopped motors.

`fastdyn-checked-integration.patch` is a scoped patch against pinned FastDyn `94c85f3e47be410e8d760b7f8207eb1580d7cd4c`. Use `fastdyn/ardupilot/checked-hooks` with the exact pinned ELF; numerical hook addresses are not portable across binaries. The filesystem correction removes an inherited buffer overflow but does not implement the missing full filesystem ABI.

## PX4 boot probe

Target: official `nxp_mr-tropic_default` / RT1064 / Cortex-M7 / NuttX, source `bf59c29e8b8cb9ac66729efc8ce26e41a875f634`. The simulation-only no-SD variant has ELF hash `013c93d1c9334012bc128c2668bbd18b421aa2557c6ba69d6fec17c8fde01024`.

Probe 06 reaches `up_idle` / `nx_start`; debugger inspection shows advancing `g_system_ticks` and eight allocated task pointers. This establishes progress beyond board initialization, not functioning flight modules or plant integration. A later task-name inspection occurred after the bounded probe ended and failed to connect; that failed inspection is retained. No PX4 flight result exists. The no-SD/volatile-storage build is not hardware firmware to flash.

All timing here is simulated time or emulator wall time. No physical driver latency, Zephyr overhead or hardware performance ranking has been measured.

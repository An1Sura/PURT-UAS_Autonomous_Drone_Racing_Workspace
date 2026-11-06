# TROPIC PC virtual-pilot handoff — November 6, 2026

## Scope and readiness

Active stacks: CogniPilot and Betaflight, both targeting TROPIC RT1064 Cortex-M7. ArduPilot and PX4 are out of the current scope; their historical evidence is retained. The waiting ArduPilot job was canceled without interrupting CogniPilot.

**This is a development handoff, not a flight-qualified release. No fastest reliable ARM setting has been selected.** Hardware binaries exist, but the receiver path and PC trainer bridge are not commissioned. Do not flash the FastDyn/QEMU ELF to a physical drone.

## What runs where

QTM/mocap → PC trajectory + position controller → USB/Arduino bridge → TX16S trainer input → radio RF link → receiver → TROPIC firmware → ESCs/motors.

Mocap feeds position back to the PC continuously. CogniPilot still executes its estimator, attitude/rate loops and mixer onboard. The PC supplies ordinary pilot commands; copying the simulation recording onto the board does not make it fly the recorded path.

The simulation counterpart uses the generated Rumoca plant as truth and FastDyn/QEMU to execute ARM binaries. Browser graphics replay recorded truth. The existing simulation's 100 Hz position loop and 250 Hz stick schedule are software settings, not measurements of the radio link.

## Verified builds and hardware facts

See [hardware-readiness.md](hardware-readiness.md) for source commits, hashes, build settings and programmer metadata.

- CogniPilot: `mr_vmu_tropic/mimxrt1064`, Zephyr, ICM45686 configuration, DShot600, current CRSF input on LPUART8.
- Betaflight: `MR_VMU_TROPIC` / `MIMXRT1064`, NXP PR #15852, separate unpatched hardware ELF/HEX.
- User-specified transmitter: RadioMaster TX16S MkII, Mode 2. Internal RF module variant and installed firmware remain unknown.
- Photo: FrSky Archer Plus R6 Lite/R6L, labels SBUS IN/OUT and FBUS/S.Port. User says no receiver is currently installed. The photo does not establish installation, binding or wiring.
- Arduino model, prior bridge source, signal voltage/polarity, trainer cable and firmware are unknown. PPM and SBUS are not interchangeable electrical/protocol assumptions.

The CRSF firmware is not a verified match for the pictured receiver. A reviewed SBUS integration needs channel-count conversion, UART framing/polarity, failsafe and stale-frame handling; changing only a Devicetree compatible is insufficient. Do not choose pin numbers or a firmware receiver configuration from the photograph alone.

## New simulation evidence

One 10 × 10 m figure-eight at 2 m altitude. These rows are separate observations, not a matched fastest-speed comparison.

| Run | Reference lap | Full simulated duration | 3D RMS / maximum error | End state |
|---|---:|---:|---:|---|
| CogniPilot, realistic noise seed 1 | 39 s | 82 s | 0.203729 / 0.519773 m | Passed, grounded, disarmed, all four motors zero |
| Betaflight OneShot125 diagnostic, harsh noise seed 2 | 35 s | 78 s | 0.255711 / 0.656725 m | Passed, grounded, disarmed, all four motors zero |
| CogniPilot, realistic noise seed 1 | 35 s requested | Stopped at 39.63925 s overall | Partial data only; not a completed-lap metric | Shared-memory response timeout, still armed |

Raw reports: [CogniPilot 39 s](results/arm-speed/cognipilot-39s/report.json), [Betaflight diagnostic](results/arm-speed/betaflight-oneshot35/report.json), [incomplete CogniPilot run](results/arm-speed/cognipilot-35s-incomplete/report.json).

The CogniPilot timeout is an infrastructure/firmware-response failure, not proof that 35 s exceeds its tracking capability. A repeat and timeout diagnosis are needed before interpreting the search boundary. The reports' inherited `passed_common_step_rule` refers to native tuning; ARM requalification is outstanding.

The original Betaflight PWM campaign completed 66 attempts: 58 passed and 8 failed. Confirmation groups were 13/15 at 33 s, 13/15 at 34 s, 14/15 at 35 s and 14/15 at 40 s. Landing failures mean none qualifies. The new OneShot125 result is one diagnostic, not a replacement for all 15 confirmations or proof of a root-cause fix.

## Setup sequence to finish

1. Inventory the actual board revision, IMU, ESCs/motors, mass and propellers; verify against the build and plant. Confirm the debug probe and existing bootloader.
2. Identify TX internal/external RF module and receiver firmware. Confirm a compatible RF binding mode using the exact manuals. Recover the Arduino source and identify its board and trainer signal before connecting it.
3. Implement/test the receiver protocol in the actual firmware with valid, malformed, lost, stale and recovered frames. Check channel units, order, endpoints and neutral values for both stacks.
4. Connect QTM rigid-body position/attitude to the PC controller, explicitly transform QTM coordinates to the configured ENU frame, verify timestamps/units and calibrate the course origin.
5. Implement the bridge using the measured trainer timing and endpoint mapping. Human arm/kill channels remain human-owned. Trainer authority requires the pilot's held switch. PC loss or stale mocap must relinquish control; do not replay the last command indefinitely.
6. Match the measured command rate, latency and jitter in simulation; rerun hover, 0.5 m step, square, figure-eight, noisy confirmations and landing. Preserve failures and hashes.
7. With propellers removed, flash the reviewed hardware build in the documented MCUboot/application order using the actual probe; verify orientation, receiver channels, motor order, override and all link-loss cases.
8. Under the team's flight-test procedure: manual takeoff, hover/override check, low-speed short autonomous segment, then one figure-eight. The supplied benchmark document calls for human takeoff/landing for real flights. A 35/39 s SIL result is not the initial physical-flight speed.

Skipping HIL does not validate the radio, wiring, estimator or propulsion. These bench and incremental-flight checks remain required. The PDF's 50 ms stale-mocap and 45-degree tilt handback requirements need end-to-end verification; calibrated inner/outer PURT geofences remain site inputs.

## Conference completion checklist

- [x] Shared Rumoca plant and generated offboard controller; real ARM firmware through FastDyn/QEMU for both TROPIC targets.
- [x] Source/binary hashes, flight logs, failed attempts and replay infrastructure retained.
- [x] Separate hardware build bundle prepared; no physical flash claimed.
- [ ] Diagnose/repeat CogniPilot 35 s response timeout; complete the speed/noise campaign without treating transport failures as aerodynamic limits.
- [ ] Read back actual PID period for OneShot125; paired PWM comparison with the same runner; full 3-noise × 5-seed confirmations and off/on comparison.
- [ ] Complete ARM same-rule attitude tuning, rate-command sign/scale tests and integrated-attitude checks from the PDF.
- [ ] Freeze matched sensor, command, startup and landing conditions; report deviations explicitly.
- [ ] Final plots: timed-reference tracking, altitude, errors, actual speed, actuator saturation and pass/fail counts; distinguish reference lap from measured completion and wall time.
- [ ] Resolve receiver/bridge/mocap integration and measure physical latency/jitter separately. QEMU exchange rate is not MCU latency or Zephyr overhead.
- [ ] Publish a reproducible source recovery path for the deleted upstream FastDyn branch; retain existing verified source bundles meanwhile.

No claim that CogniPilot is faster than Betaflight, or that either stack is ready for autonomous physical flight, is supported yet.

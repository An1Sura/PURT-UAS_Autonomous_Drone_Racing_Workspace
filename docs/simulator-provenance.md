# Where the flight simulations run — audited October 16, 2026

**The current Betaflight results are native Linux SITL measurements. FastDyn has not executed those recordings.** A separate CogniPilot TROPIC ARM binary-in-the-loop (BIL) acceptance mission now passes in FastDyn/QEMU; see the report below. The existing figure-eight recordings remain native SIL.

## Betaflight: source → modified executable → measured run

| Evidence | Verified value |
|---|---|
| Official source | [betaflight/betaflight at the tested commit](https://github.com/betaflight/betaflight/tree/744f95fa31542c4c906f18072348a366ab11b6b7) |
| Base revision | `744f95fa31542c4c906f18072348a366ab11b6b7` |
| Build checkout in the Lima Linux VM | `/home/suraa.guest/autonomous-drone-bench/artifacts/shared-loop/betaflight-stock` |
| Checkout lineage | Build checkout → local `src/betaflight` → official GitHub repository; both remote listings are saved below |
| Executable | `artifacts/shared-loop/betaflight-stock/obj/main/betaflight_SITL.elf` |
| Executable type | AArch64 Linux ELF; native VM process, not an RT1060 firmware binary |
| Executable SHA-256 | `18d653f2112570722b3fdc10c9d0aa42ffccd285bcb59498890ef7f6b3f5d43f` |
| Local modifications | Deterministic simulator transport/scheduler coordination, Dyad transport fixes, and explicit external rate/acceleration feed-forward hooks; full patch saved below |
| Adapter | Our Rust `src/cerebri_rdd2/xtask/src/shared_sil.rs`; not an upstream ready-made Betaflight–Rumoca adapter |
| Physics | Rumoca-generated `Vehicles.Rdd2.Plant`, loaded through FMI by `xtask/src/physics.rs` |

The native build uses `make TARGET=SITL EXTRA_FLAGS="-DENABLE_SIMULATOR_GYROPID_SYNC=1 -DADR_LOCKSTEP=1" -j4`. The patched binary retains Betaflight's native feedback controllers, estimator and mixer; it is not an unmodified stock-firmware benchmark. The latest receiver provisioning enables all sixteen channels. The tested external acceleration gains are independently calibrated per axis.

The runner sends sensor packets and RC-style commands to localhost UDP port 9003, receives motor/status packets on port 9002, checks sequence numbers and simulated timestamps, maps the motor ordering, and advances the shared plant. The exchange uses 125 μs simulated ticks. These ports are local to the VM. The browser reads recorded trajectory data; it does not run Betaflight.

### Downloadable audit evidence

- [Official-source remote](evidence/simulator-provenance-2026-10-16/betaflight-upstream.txt), [build-checkout remote](evidence/simulator-provenance-2026-10-16/betaflight-build-origin.txt), and [base commit](evidence/simulator-provenance-2026-10-16/betaflight-revision.txt).
- [Exact local source patch](evidence/simulator-provenance-2026-10-16/betaflight-local-changes.patch), [binary checksum](evidence/simulator-provenance-2026-10-16/betaflight-binary.sha256), and [binary type](evidence/simulator-provenance-2026-10-16/betaflight-binary-type.txt).
- [Adapter excerpt showing launch and UDP exchange](evidence/simulator-provenance-2026-10-16/betaflight-adapter-excerpt.txt).
- [Actual calibration run report](evidence/simulator-provenance-2026-10-16/betaflight-measured-run.json) and [selected configuration](evidence/simulator-provenance-2026-10-16/betaflight-selected-config.json).

The example report records a **49-second rate-ramp calibration flight**, 392,000 firmware exchanges, observed arming, final disarm, and four zero final motor commands. Its firmware hash exactly matches the saved executable checksum. Its plant hash is `284cced3ceec15128886d05753900b8ae47f38570ce0112c50e801356de97654`. This is evidence of execution and provenance; its position error must not be presented as a figure-eight speed result. Full trajectories and compressed actuator traces remain in the VM at `artifacts/shared-sil/calibration-betaflight-03/axis-2-F-400/`.

## FastDyn: what it contributes and what is still missing

### Runtime bring-up, October 16

The missing runtime described below has now been built in the Linux VM. An isolated FastDyn checkout at RDD2's pinned revision `94c85f3e47be410e8d760b7f8207eb1580d7cd4c` is used, leaving the original checkout untouched. QEMU is built from `Arslan8/qemu` revision `99b54836ded8dc3271eba52deee7453efc0a13b9` with the FastDyn virtual-time compatibility patch. The native peripheral models and dedicated TROPIC ARM ELF also built successfully.

The actual execution path is **TROPIC Cortex-M7 ELF → FastDyn/QEMU → shared-memory lockstep → upstream Rust mission/FMI host → Rumoca RDD2 plant → motor feedback**. This first validation uses the upstream 44-second acceptance mission, not the 10 × 10 m figure-eight speed benchmark. Betaflight remains native Linux SITL; no Betaflight ARM FastDyn configuration has been validated.

Bring-up fixes and limitations:

- The initial firmware command selected an older checkout outside the benchmark. Building from the actual `src/cerebri_rdd2` directory corrected this.
- The sysbuild aggregate HEX packaging target failed; the application CMake target successfully built the ARM ELF required by FastDyn.
- The ELF's verified `_vector_table` is `0x70020400`, reflecting its MCUboot application layout. The supplied emulator configuration assumed `0x70002000`, causing an immediate HardFault. The saved run configuration uses the actual ELF address. QEMU loads the application directly; this does not validate MCUboot execution.
- On the ARM64 host, the x86 `_mm_pause` hint is replaced with the ARM `yield` hint. The optional x86-only Triton dependency is excluded; symbolic analysis is not used in this mission.
- The QEMU patch was adapted to upstream context changes; already-disabled debug printing was left disabled. Required virtual-time changes remain applied.
- Full vendor-database downloads and verbose `io.log` output exhausted VM storage during setup/attempt 02. Unused newly downloaded vendor files were removed. The complete attempt-02 I/O trace was archived on the Mac, and subsequent verbose I/O output is directed to `/dev/null`. Acceptance reports, trajectory data, and normal mission logs remain enabled.
- Attempt 01 failed at reset. Attempt 02 reached autonomous takeoff and mission flight but was interrupted by storage exhaustion; it is not a passing run. Attempt 03 completed and passed the upstream mission checks without relaxing their thresholds.

#### Measured result — attempt 03

| Measurement | Actual result |
|---|---:|
| Mission | `rdd2-square-baseline-v1`, 0.5 m side, 1.5 m takeoff altitude |
| Simulated duration | 44.000 s |
| Controller exchanges / plant steps | 70,400 / 70,400 |
| Rate-controller releases | 1,600 per simulated second |
| Vehicle waypoint corners reached | 5 |
| Maximum altitude | 1.537061 m |
| Final altitude / vertical speed | 0.098366 m / approximately 0 m/s |
| Firmware armed then disarmed after flight | Yes |
| Overall wall time | 230.462 s |
| Overall simulation speed | 0.190921 × real time |
| Acceptance | `passed: true`, no failures |

Read the [original JSON report](evidence/fastdyn-2026-10-16/mission-report.json), [acceptance output](evidence/fastdyn-2026-10-16/acceptance.log), and [execution log including the actual QEMU command](evidence/fastdyn-2026-10-16/mission.log). The full trajectory remains in the VM at `artifacts/fastdyn-validation-03/mission-trajectory.csv` and in the Mac's `benchmark-work/fastdyn-2026-10-16/` archive; its [checksum](evidence/fastdyn-2026-10-16/trajectory.sha256) is published.

This is a **local-source integration pass**, not an unmodified pinned-provider qualification: the report's `provider_mode` is `unknown` because the raw native entry point was invoked, and local firmware/model changes are retained in the evidence patches. The reported navigation error concerns estimator-versus-truth agreement, not figure-eight tracking accuracy. Host exchange timings and the 0.19× execution speed are emulator measurements, not physical MCU latency or drone flight speed.

Exact [binary hashes](evidence/fastdyn-2026-10-16/binaries.sha256), [FastDyn portability patch](evidence/fastdyn-2026-10-16/fastdyn-arm64.patch), [applied QEMU patch](evidence/fastdyn-2026-10-16/qemu-applied.patch), and [run configuration](evidence/fastdyn-2026-10-16/fastdyn-tropic-built-vector.toml) are retained as evidence.

### Earlier missing-runtime audit (retained history)

[FastDyn](https://github.com/jgoppert/FastDyn) provides QEMU-based firmware rehosting. The checked-out revision is `c235932a60a7bb839e59cac111920fb3b5cbf1aa`, verified from the actual VM checkout—not inferred from the West manifest. See the [revision](evidence/simulator-provenance-2026-10-16/fastdyn-revision.txt) and [upstream remote](evidence/simulator-provenance-2026-10-16/fastdyn-upstream.txt).

The pinned RDD2 integration explicitly uses the same FMI host and Rumoca plant for native and rehosted ARM firmware. Its [upstream workflow documentation](evidence/simulator-provenance-2026-10-16/rdd2-fastdyn-upstream.md) identifies `fastdyn/mr_vmu_tropic.toml`, the ARM build configuration, and `xtask fastdyn-ci`. This provides the design for an additional binary-validation stage without substituting another quadrotor physics model.

The audit invoked `xtask fastdyn-ci` with explicit FastDyn/workspace paths and a separate output directory. It failed before starting QEMU:

```text
[ci] launching rehosted cerebri_rdd2 mission
Error: cannot launch FastDyn
Caused by:
    No such file or directory (os error 2)
```

[Raw acceptance-check output](evidence/simulator-provenance-2026-10-16/fastdyn-check.log). The expected FastDyn executable/runtime, patched QEMU and dedicated RDD2 FastDyn ARM build were not present. The VM had approximately 1.4 GB free after compressing completed calibration traces. No FastDyn flight or hardware-latency result is claimed.

### Required FastDyn validation stage

1. Provide enough VM storage and build the project-owned FastDyn/patched-QEMU runtime.
2. Build the RDD2 ARM image with its dedicated FastDyn configuration, retaining source/compiler checks. The ordinary hardware image and native Linux executable are different artifacts.
3. Run the canonical RDD2 FastDyn acceptance mission and retain its configuration, logs, executable hashes, trajectory and acceptance report.
4. Extend/validate the shared figure-eight command boundary for the rehosted binary, then compare against the same plant/reference and explicit timing assumptions.
5. For Betaflight ARM BIL, independently establish a supported board/rehosting configuration and validate its peripheral/command mappings. The current native UDP adapter does not establish that support.

FastDyn instruction-counted execution also does not automatically measure real RT1060 interrupt, DMA, sensor or bus latency. Those require the team's physical timing tests. Native SIL, ARM BIL and physical HIL results must remain separately labeled.

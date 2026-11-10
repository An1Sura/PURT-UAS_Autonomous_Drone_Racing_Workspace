# November raw simulation data

Prepared 2026-11-10 for peer analysis. Publication branch: `raw-data-nov`; main and its Pages content are not changed by this handoff. Lead-off searches are on hold pending a separately committed scoring rule. Five historical lead-off comparator runs already existed in the completed CogniPilot campaign; they are retained, not a new search.

## Assets

- `flight-campaigns.tar.gz`: complete CogniPilot hardened campaign and Betaflight PWM campaign directories, OneShot125 diagnostic directory, their coordinator logs, and the original incomplete CogniPilot coarse-35 attempt/config/log. Includes trajectories, tilt-lead CSVs, configs, reports, native logs, traces, retained RAM and FastDyn runtime files. Extracted paths retain their `artifacts/` prefixes.
- `pwm-paired-20261110.tar.gz`: requested paired PWM run, including failed landing, log, RAM, config and FastDyn configuration.
- `rerun-binaries.tar.gz`: runners 7c9ade and f2ef29, reconstructed exact runner 8781a1, both TROPIC simulation ELFs, Rumoca plant, shared offboard library and FastDyn flight configurations.
- Two FastDyn Git bundles recover the otherwise unavailable tested/source-workspace revisions. The working-tree patch belongs to the tested source. These bundles do not include every external dependency/submodule, QEMU build or Nix store.
- `SHA256SUMS`: asset and small-file checksums. `FLIGHT-SHA256SUMS`: checksums of individual files inside the four complete campaign/diagnostic directories.

Large binary archives are intended as Release assets tagged `raw-data-nov-20261110` targeting this branch. Do not infer upload completion from this README; inspect the actual Release asset list. The branch retains checksums and small reports for review.

Verify downloaded assets with `shasum -a 256 -c SHA256SUMS`. Extract archives into a new directory, then use `sha256sum -c FLIGHT-SHA256SUMS` from that directory. The extra original incomplete CogniPilot directory is protected by the archive checksum; it is not part of that four-directory per-file manifest.

## Matched protocol experiment

One 35 s reference lap, harsh noise, seed 2. Both runs used firmware c9530644680b907053022efa349bd0564701dd09ead526c862ac76d71755423f, plant 284cced3ceec15128886d05753900b8ae47f38570ce0112c50e801356de97654, offboard library 220db232fd2cae1744afcfd4eb773d6b2dbe37b97f5f36124849344281ec9a3d and runner 8781a14f7ec763a4b2248213af41d2e9da1823c32d919c4f655ce5a4ac2448ad. The runner was rebuilt from preserved pre-hardening source and matches that SHA-256 byte-for-byte. Current source files were restored afterward; the frozen f2ef29 binary remains intact.

The configuration differs only in `stacks.betaflight.motor_protocol`: PWM versus ONESHOT125; requested pid_process_denom is 1 in both. Stock firmware validation changes the effective scheduling.

| Readback/result | PWM | OneShot125 |
|---|---:|---:|
| PID target period | 2000 us | 500 us |
| Motor updates over 78 simulated seconds | 39000 | 156000 |
| Simulated motor update rate | 500 Hz | 2000 Hz |
| Tracking RMS | 0.254669 m | 0.255711 m |
| Tracking maximum | 0.651466 m | 0.656725 m |
| Verified landing | No | Yes |

PWM remained armed at final height 0.600780 m. Its report retains actual final motor outputs. Post-termination shared-memory motor outputs are cleared by shutdown and must not be used to claim landing. The decoder intentionally omits those outputs; it reads preserved PID scheduling and counter fields from the exact pinned ELF layout.

This single paired result supports an effect of protocol-dependent scheduling in this simulator. It is not a hardware loop-speed measurement, a repeated causal qualification, or proof that the ESC signaling waveform itself caused the difference. Firmware equations and gains were unchanged.

## Reproduction constraints

Runners are Linux VM binaries, not macOS executables. Use the repository's native FastDyn/QEMU environment and pinned dependencies, preserve shared-library dependencies and regenerate absolute workspace paths. Run exactly one QEMU flight at a time: the current FastDyn startup can terminate existing QEMU instances. Firmware ELFs here are simulation builds, not physical-flight flashing images.

FastDyn tested revision: 94c85f3e47be410e8d760b7f8207eb1580d7cd4c. QEMU pin: 99b54836 (full workspace pin in the existing repo). Source recovery is not a claim that a fresh machine can execute the archive without building dependencies. See existing docs/fastdyn-source-recovery.md and docs/arm-benchmark-integration.md.

Failed and incomplete attempts have not been removed or relabeled. Noise profiles are assumed simulation inputs, not calibrated hardware noise. No lead-off optimization has been started for this request.

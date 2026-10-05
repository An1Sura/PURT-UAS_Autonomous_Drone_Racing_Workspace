# Editable dependency patches

This workspace ignores `src/` because each dependency is its own Git repository.
These patches preserve all dependency code changes alongside the root workspace
changes, without vendoring their build trees or changing upstream repositories.

| Repository | Tested base commit | Patch |
| --- | --- | --- |
| `betaflight/betaflight` | `744f95fa31542c4c906f18072348a366ab11b6b7` | `betaflight-sitl-speed.patch` |
| `CogniPilot/cerebri_rdd2` | `bf784c752f7767bd1a8712a7fc64c5b522000323` | `cerebri-rdd2-benchmark.patch` |
| `CogniPilot/rumoca` | `4d0e521d9a0bd2527808dbce2c5689834d1a0349` | `rumoca-runtime-fixes.patch` |
| `CogniPilot/modelica_models` | `a41f7c0c00b55c1bf54f03c9b66b901ba8e43c6f` | `modelica-report-fixes.patch` |

The firmware patch adds the shared sensor/actuator boundary, CogniPilot external-reference ingress, a smooth timed figure-eight generator, the native Betaflight/FMI diagnostic, and the two-stack simulation web server. Rebuild runner and firmware together after applying the patch. Betaflight is pinned to `744f95fa31542c4c906f18072348a366ab11b6b7`.

The compiler patch fixes deferred clock assertion evaluation and the Python package vendor hash. The model patch fixes signal selection and report provenance paths.

## Apply once on a fresh workspace

Run `./setup rdd2`, then, in the Devenv shell at the workspace root:

```sh
devenv -P rdd2 tasks run sources:ensure:cerebri_rdd2 sources:ensure:rumoca sources:ensure:modelica_models
git -C src/cerebri_rdd2 rev-parse HEAD
git -C src/rumoca rev-parse HEAD
git -C src/modelica_models rev-parse HEAD
```

Verify the revisions against the table. Existing checkouts are not automatically
reset by workspace setup. If a checkout contains local work, preserve it before
selecting the tested revision. The firmware integration branch can move;
the table records the tested commit, not an assurance about its current tip.

From the workspace root, check and apply the patches:

```sh
git -C src/cerebri_rdd2 apply --check ../../patches/cerebri-rdd2-benchmark.patch
git -C src/rumoca apply --check ../../patches/rumoca-runtime-fixes.patch
git -C src/modelica_models apply --check ../../patches/modelica-report-fixes.patch

git -C src/cerebri_rdd2 apply ../../patches/cerebri-rdd2-benchmark.patch
git -C src/rumoca apply ../../patches/rumoca-runtime-fixes.patch
git -C src/modelica_models apply ../../patches/modelica-report-fixes.patch

devenv -P rdd2 tasks run rdd2:benchmark:test
devenv -P rdd2 tasks run rdd2:simulation:sil:test
```

Stop if a check fails; do not force a patch onto a different source version.
In the existing development VM these changes are already applied. A reverse
check (`git apply --reverse --check PATCH`) can confirm an applied patch.

These are native Git patches, not a second build system. Native Cargo/West
workflows remain available. Generated binaries, caches, VM configuration and
large simulation logs are intentionally outside this repository.

Read [validation and limits](../docs/rdd2-validation.md) before interpreting a
successful SIL result as a matched two-stack benchmark.

The historical unpatched Betaflight adapter accounted for the pinned firmware's 1 m/s cruise floor and 0.25 rad/s pattern-rate cap, then verifies the recorded figure-eight count independently of native landing state. See [timing diagnosis and validation](../docs/betaflight-timing.md).

## October 5 speed search

The current Betaflight recording uses a research-patched SITL build. On the pinned clean checkout:

```sh
git -C src/betaflight apply --check ../../patches/betaflight-sitl-speed.patch
git -C src/betaflight apply ../../patches/betaflight-sitl-speed.patch
make -C src/betaflight TARGET=SITL -j4
cargo build --release --manifest-path src/cerebri_rdd2/xtask/Cargo.toml
```

The patch serializes Dyad stream creation, writes and updates; initializes Dyad before its thread; and yields between update iterations. A sanitizer found a heap-use-after-free in the previous startup. Ten fresh provisioning trials passed after the repair. Flight results use the release build, not the sanitizer build.

SITL figure-eight commands update every 10 ms and include analytic velocity feedforward with smooth phase-speed ramps over the first and last 10% of the lap. The matching adapter enforces a 0.35 rad/s peak phase-rate cap and rounds duration up to deciseconds. Historical constant-phase trials used the intermediate patch, before these ramps. The final build requires a single smooth-phase lap. Physical tilt, motor and plant limits were not raised. These changes are simulation research code, not a tested hardware configuration.

The native runner now supports per-stack configs, geometric accuracy scoring and actual telemetry export. Run from the workspace root:

```sh
src/cerebri_rdd2/target/release/xtask speed-score CONFIG REPORT TRAJECTORY SCORE_JSON
src/cerebri_rdd2/target/release/xtask speed-export cognipilot TRIAL_DIRECTORY REPLAY_JSON
```

See [all results and qualification limits](../docs/speed-search.md). Both dependency patches passed clean-base application checks. The original Lean specification does not prove the new schedules or the changed Betaflight cap.

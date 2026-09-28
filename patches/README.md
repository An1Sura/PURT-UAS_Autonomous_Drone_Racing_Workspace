# Editable dependency patches

This workspace ignores `src/` because each dependency is its own Git repository.
These patches preserve all dependency code changes alongside the root workspace
changes, without vendoring their build trees or changing upstream repositories.

| Repository | Tested base commit | Patch |
| --- | --- | --- |
| `CogniPilot/cerebri_rdd2` | `bf784c752f7767bd1a8712a7fc64c5b522000323` | `cerebri-rdd2-benchmark.patch` |
| `CogniPilot/rumoca` | `4d0e521d9a0bd2527808dbce2c5689834d1a0349` | `rumoca-runtime-fixes.patch` |
| `CogniPilot/modelica_models` | `a41f7c0c00b55c1bf54f03c9b66b901ba8e43c6f` | `modelica-report-fixes.patch` |

The firmware patch adds the shared sensor/actuator boundary, CogniPilot adapter,
mission fixtures, metrics, tests, the ArduPilot JSON connection probe, and a
bounded Guided flight diagnostic with a stack-independent reference.
The ArduPilot source itself is unmodified; see [its build and usage guide](../docs/ardupilot-adapter.md). The compiler patch fixes deferred clock
assertion evaluation and the Python package vendor hash. The model patch fixes
signal selection and report provenance paths. Physics, controller gains and
acceptance thresholds are unchanged.

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
successful SIL result as a complete four-stack benchmark.

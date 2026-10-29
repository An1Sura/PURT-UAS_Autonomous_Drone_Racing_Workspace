# RDD2 FastDyn firmware build in Docker on Apple Silicon

Date: October 29, 2026  
Status: firmware and mission-helper builds reported successful; clean rebuild and fresh-container reproduction pending.

## Purpose and scope

Record the standalone West/Cargo build used in an existing CogniPilot Docker
environment on an Apple Silicon Mac. This complements [Pierson's UTM/Ubuntu
ARM64 setup](setup-mac-arm64.md). His [mission results](mission-results.md)
belong to a separate environment and are not results from this Docker build.

The team repository contains documentation and integration configuration. The
existing `/env/src/cerebri_rdd2` checkout in Docker is the firmware application.
Cloning the team repository does not recreate that West workspace or install
the firmware toolchain. Keep the two checkouts separate.

This document was prepared from the contributor's terminal transcript and team
documentation, reviewed at team commit `c2343cec1874a8936b13c8e2e1d656df234020a1`.
Commands below have not yet been rerun in the contributor's container. Missing
environment details must be captured before calling this a reproducible setup.

## Current evidence

| Item | Status or location |
|---|---|
| Host | Apple Silicon Mac; record exact macOS version |
| Docker image, image ID and mounts | Pending capture |
| Linux container architecture | Pending `uname -m`; do not infer from the Mac |
| Firmware source | `/env/src/cerebri_rdd2`; full revision pending |
| Firmware build | `/env/src/cerebri_rdd2/build-mr_vmu_tropic-fastdyn` |
| Firmware ELF | `build-mr_vmu_tropic-fastdyn/zephyr/zephyr.elf`; successful build reported |
| Board | `mr_vmu_tropic`; capture exact board qualifier from CMake cache |
| Configuration | `fastdyn/prj.conf`; confirm cached value |
| Overlay | `fastdyn/mr_vmu_tropic.overlay`; confirm cached value |
| ARM compiler | Earlier session reported GNU 15.2.1; capture compiler path and version |
| Mission host | `tools/fastdyn_mission/target/release/cerebri-rdd2-mission` appeared in terminal output |
| Modelica source | `/env/src/models/modelica_models`, short revision `d319854` |
| Rumoca used | `0.9.20`, confirmed by `--version` |
| Rumoca binary | `build-mr_vmu_tropic-fastdyn/tools/rumoca/v0.9.20/rumoca` |
| Modelica-pinned Rumoca | `149c2ff3939937f5a1345db600830ae4a9a83ca9` |
| FMI3 plant export | Failed; see blocker below |
| Full Docker simulation | Not demonstrated by this session |

## 1. Capture the Docker environment on the Mac

Run in the **Mac terminal**, outside Docker:

```bash
sw_vers
uname -m
docker version
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

Set the actual name from that list, then inspect only the relevant fields:

```bash
RDD2_CONTAINER='replace-with-your-existing-container-name'
docker inspect "$RDD2_CONTAINER" --format 'Image reference={{.Config.Image}} Image ID={{.Image}}'
docker inspect "$RDD2_CONTAINER" --format '{{json .Mounts}}'
docker image inspect "$(docker inspect "$RDD2_CONTAINER" --format '{{.Image}}')" \
  --format 'OS={{.Os}} Architecture={{.Architecture}} Digests={{json .RepoDigests}}'
```

Record the original Docker creation command, image/Dockerfile, mounts and any
manual installations. These are currently missing; this guide does not yet
provide a verified fresh-container bootstrap command. Avoid publishing local
private mount paths without reviewing them.

## 2. Capture the working build before changing it

Run inside the **existing CogniPilot container**, using its normal development
shell. Do not reinitialize West or update dependencies just to collect evidence.

```bash
cd /env/src/cerebri_rdd2
uname -m
cat /etc/os-release
west --version
cmake --version
ninja --version
rustc --version
cargo --version
git rev-parse HEAD
git status --short
git -C /env/src/models/modelica_models rev-parse HEAD
git -C /env/src/models/modelica_models status --short
west topdir
west manifest --freeze
```

`west manifest --freeze` records resolved dependency revisions. Also record
local source modifications: commit IDs alone do not describe a modified checkout.

Read the existing build's cached settings:

```bash
grep -E '^(BOARD|BOARD_QUALIFIERS|CACHED_BOARD|CONF_FILE|EXTRA_CONF_FILE|DTC_OVERLAY_FILE|EXTRA_DTC_OVERLAY_FILE|CMAKE_C_COMPILER|ZEPHYR_TOOLCHAIN_VARIANT|ZEPHYR_SDK_INSTALL_DIR|GNUARMEMB_TOOLCHAIN_PATH|CROSS_COMPILE|.*RUMOCA.*):' \
  build-mr_vmu_tropic-fastdyn/CMakeCache.txt
```

Record relevant shell variables without dumping the entire environment:

```bash
printf 'ZEPHYR_TOOLCHAIN_VARIANT=%s\n' "${ZEPHYR_TOOLCHAIN_VARIANT-<unset>}"
printf 'ZEPHYR_SDK_INSTALL_DIR=%s\n' "${ZEPHYR_SDK_INSTALL_DIR-<unset>}"
printf 'GNUARMEMB_TOOLCHAIN_PATH=%s\n' "${GNUARMEMB_TOOLCHAIN_PATH-<unset>}"
printf 'CROSS_COMPILE=%s\n' "${CROSS_COMPILE-<unset>}"
printf 'CCACHE_DIR=%s\n' "${CCACHE_DIR-<unset>}"
```

Use the compiler path recorded in `CMAKE_C_COMPILER` to run `--version`.
An unset shell variable can be normal when CMake or the development environment
already selected the toolchain. Do not invent values to fill the table.

## 3. Verify the existing artifacts

Inside Docker:

```bash
cd /env/src/cerebri_rdd2
ls -lh build-mr_vmu_tropic-fastdyn/zephyr/zephyr.elf
file build-mr_vmu_tropic-fastdyn/zephyr/zephyr.elf
sha256sum build-mr_vmu_tropic-fastdyn/zephyr/zephyr.elf
ls -lh tools/fastdyn_mission/target/release/cerebri-rdd2-mission
file tools/fastdyn_mission/target/release/cerebri-rdd2-mission
sha256sum tools/fastdyn_mission/target/release/cerebri-rdd2-mission
./build-mr_vmu_tropic-fastdyn/tools/rumoca/v0.9.20/rumoca --version
```

The firmware should be an ARM ELF. The mission helper is a Linux host executable
whose architecture must match the execution environment. ELF file size includes
debug and other metadata; it is not the firmware's flash usage. Use the linker's
memory report for flash/RAM claims. Checksums identify artifacts; they do not
demonstrate execution, correctness or bit-for-bit reproducibility across builds.

## 4. Repeat the firmware build in a separate directory

This is a proposed validation command based on the team's West build procedure.
First confirm the cached board, configuration, overlay and any extra CMake
options from step 2. Preserve those settings when reproducing this build.

The earlier session reported `ccache: Permission denied`; a writable cache was
used as the workaround:

```bash
export CCACHE_DIR=/tmp/rdd2-ccache
mkdir -p "$CCACHE_DIR"
test -w "$CCACHE_DIR"
```

This addresses an unwritable cache directory. It is not a general fix for an
unexecutable `ccache` binary; inspect the actual error if it persists.

In **Bash inside Docker**, after confirming the cache settings:

```bash
cd /env/src/cerebri_rdd2
RDD2_BOARD='mr_vmu_tropic/mimxrt1064' # Replace with the exact confirmed board target.
set -o pipefail
west build \
  -b "$RDD2_BOARD" \
  -d build-mr_vmu_tropic-fastdyn-validation \
  . -- \
  -DCONF_FILE=fastdyn/prj.conf \
  -DDTC_OVERLAY_FILE=fastdyn/mr_vmu_tropic.overlay \
  2>&1 | tee /tmp/rdd2-firmware-validation.log
```

Use a previously unused validation directory for a clean build. This preserves
the existing successful build. If the cache shows additional options, reproduce
them explicitly; the example cannot recover options absent from the transcript.
The team's UTM guide uses the unqualified board `mr_vmu_tropic`; do not assume
that both spellings are interchangeable at every Zephyr revision.

After a successful exit, verify the new ELF:

```bash
file build-mr_vmu_tropic-fastdyn-validation/zephyr/zephyr.elf
sha256sum build-mr_vmu_tropic-fastdyn-validation/zephyr/zephyr.elf
```

Record the linker memory summary and full command. A fresh build directory in
an existing container validates a rebuild, not fresh-machine setup.

## 5. Mission-helper build (optional companion check)

The helper is separate from the firmware. The team guide uses Cargo directly:

```bash
cd /env/src/cerebri_rdd2
set -o pipefail
cargo build --release --locked \
  --manifest-path tools/fastdyn_mission/Cargo.toml \
  2>&1 | tee /tmp/rdd2-mission-build.log
```

`--locked` requires a compatible existing Cargo lockfile. If it fails, record
the error and inspect the checkout's lockfile rather than silently updating
dependencies. The team's earlier documented command omitted `--locked`; this
stricter repeat-build check has not been verified in this Docker environment.

## 6. Known blocker: Modelica FMI3 plant export

This command was attempted at Modelica revision `d319854` with Rumoca `0.9.20`:

```bash
cd /env/src/models/modelica_models
/env/src/cerebri_rdd2/build-mr_vmu_tropic-fastdyn/tools/rumoca/v0.9.20/rumoca compile \
  Vehicles/Rdd2/AvionicsPlant.mo \
  --source-root . \
  --model Vehicles.Rdd2.AvionicsPlant \
  --target fmi3 \
  --output artifacts/vehicles/rdd2/plant
```

Observed error:

```text
rumoca::codegen::EC001
template error: unsupported expression: while projecting function
`RigidBody.attitudeRate`: binary rhs has unknown dimensions
```

The executable lists `fmi3`, but that does not establish support for every
expression in this model. `flake.nix` pins Rumoca commit
`149c2ff3939937f5a1345db600830ae4a9a83ca9`; testing that compiler is a proposed
next experiment, not a confirmed fix. No successful test of it was supplied.

At this checkout, `tools/modelica_models_cli.py` was absent and
`modelica-models` was not on PATH. Instructions for newer CLI revisions should
not be substituted without checking the source revision.

A successful export must still be followed by checking whether generated C
requires compilation and verifying the resulting shared library's architecture.
The directory name `x86_64-linux` alone is insufficient: Pierson's guide reports
an ARM64 library under that name. Inspect binaries using `file`.

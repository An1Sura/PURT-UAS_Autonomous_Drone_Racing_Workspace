# FastDyn/QEMU Setup — Apple Silicon (ARM64)

**PURT-UAS Autonomous Drone Racing**

**Tested platform:** Apple Silicon M2 Mac, Ubuntu ARM64 in UTM  
**Firmware:** CogniPilot Cerebri RDD2 / Zephyr RTOS  
**Simulation:** FastDyn + patched QEMU + Rumoca/Modelica  
**Status:** Successful 20-second autonomous mission (October 8, 2026)

## Overview

This guide documents the environment used to run CogniPilot RDD2 firmware through FastDyn and QEMU on an Apple Silicon Mac.

FastDyn integrates the emulated Cortex-M7 firmware with a simulated vehicle. QEMU executes the ARM firmware, while the generated Rumoca/Modelica plant provides vehicle dynamics.

This setup allows firmware testing without physical flight hardware.

> **Reproducibility note:** These commands were recovered from a successful debugging session, not yet revalidated on a clean Ubuntu installation. The initial source checkout and some dependencies were already present. Additional setup may be required on a fresh machine.

## 1. System Requirements

- Apple Silicon Mac (tested on M2)
- UTM virtualization software
- Ubuntu ARM64 virtual machine
- Git, Nix, Rust/Cargo, C/C++ build tools
- Access to CogniPilot Cerebri RDD2 and FastDyn source repositories

Verify that Ubuntu is running on ARM64:

```bash
uname -m
```

Expected:

```text
aarch64
```

## 2. Install Python 3.13 Using uv

The tested Ubuntu environment used Python 3.14.4 by default. Installing Python 3.13 with `apt` failed because the packages were unavailable.

The working solution was Astral's `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh

source "$HOME/.local/bin/env"

uv python install 3.13
uv python find 3.13
```

The resulting installation used Python 3.13.16.

## 3. Configure the FastDyn Python Environment

From the existing FastDyn source checkout:

```bash
cd ~/projects/github/FastDyn

uv venv --python 3.13 fastdyn-env

source fastdyn-env/bin/activate

uv pip install -r requirements.txt
uv pip install -e ./src
uv pip install distlib
```

Verify:

```bash
python --version
fastdyn --help
```

The tested environment returned Python 3.13.16 and displayed FastDyn commands including `run`, `probe-run`, and `timing-summary`.

## 4. Build FastDyn and Patched QEMU

The following setup command was executed:

```bash
cd ~/projects/github/FastDyn

source fastdyn-env/bin/activate

source ./setup.sh --build-qemu --with-rumoca
```

The session confirmed that patched QEMU already existed, but the FastDyn plugin initially failed to build on ARM64.

### ARM64 compilation issue

The FastDyn source used the x86-specific header:

```c
#include <immintrin.h>
```

and the intrinsic:

```c
_mm_pause();
```

These caused compilation errors on ARM64.

A local architecture-dependent replacement was introduced:

```c
#if defined(__x86_64__) || defined(__i386__)
#include <immintrin.h>
#define FASTDYN_CPU_RELAX() _mm_pause()
#elif defined(__aarch64__)
#define FASTDYN_CPU_RELAX() \
    __asm__ __volatile__("yield" ::: "memory")
#else
#define FASTDYN_CPU_RELAX() ((void)0)
#endif
```

The two `_mm_pause()` calls in `core/core.c` were replaced with `FASTDYN_CPU_RELAX()`.

Rebuilding then succeeded:

```bash
ninja -C build
```

**Important:** This was a local FastDyn source modification, not a change to the PURT team repository. Check whether upstream FastDyn already supports ARM64 before applying it. The fix has not been separately validated as an upstream patch.

Verify the resulting files:

```bash
ls -lh build/libfastdyn.so
ls -lh ../qemu/build/qemu-system-arm
ls -lh ../qemu/ws/monitor.elf
```

All three files existed in the successful environment.

## 5. Build CogniPilot RDD2 Firmware

Enter the existing Cerebri RDD2 checkout:

```bash
cd ~/projects/github/cerebri_rdd2

nix develop
```

Build the FastDyn-specific firmware:

```bash
west build -p always \
  -b mr_vmu_tropic \
  -d build-mr_vmu_tropic-fastdyn \
  . \
  -- \
  -DCONF_FILE=fastdyn/prj.conf \
  -DDTC_OVERLAY_FILE=fastdyn/mr_vmu_tropic.overlay
```

This builds Zephyr firmware using the FastDyn lockstep configuration and simulated device interfaces.

The tested build generated the Rumoca controller components and successfully linked:

```text
build-mr_vmu_tropic-fastdyn/zephyr/zephyr.elf
```

Verify:

```bash
ls -lh build-mr_vmu_tropic-fastdyn/zephyr/zephyr.elf
```

Exit the Nix shell before returning to the separate FastDyn Python environment.

## 6. Build the Mission Helper

An initial simulation attempt failed because the `cerebri-rdd2-mission` helper executable had not been built.

The following command resolved that issue:

```bash
cd ~/projects/github/cerebri_rdd2

cargo build --release \
  --manifest-path tools/fastdyn_mission/Cargo.toml
```

The release build completed successfully.

## 7. Configure the Simulation Paths

Activate FastDyn's Python environment:

```bash
source ~/projects/github/FastDyn/fastdyn-env/bin/activate
```

Set the paths:

```bash
export FASTDYN_ROOT="$HOME/projects/github/FastDyn"
export FASTDYN_QEMU_PATH="$HOME/projects/github/qemu/build/qemu-system-arm"
export FASTDYN_MONITOR_ELF="$HOME/projects/github/qemu/ws/monitor.elf"

export CEREBRI_RDD2_ROOT="$HOME/projects/github/cerebri_rdd2"
export RDD2_WORKSPACE_ROOT="$CEREBRI_RDD2_ROOT/.devenv/state/west"
export RDD2_FASTDYN_BUILD_DIR="$CEREBRI_RDD2_ROOT/build-mr_vmu_tropic-fastdyn"
```

### Configuration-path issue

The tested configuration did not resolve some `${VARIABLE}` placeholders inside `fastdyn/mr_vmu_tropic.toml`.

This caused errors such as:

```text
QEMU executable not found:
${FASTDYN_QEMU_PATH}
```

and:

```text
No such file or directory:
${RDD2_FASTDYN_BUILD_DIR}/zephyr/zephyr.elf
```

The local workaround was to replace unresolved placeholders with actual paths inside `fastdyn/mr_vmu_tropic.toml`.

For other machines, use the appropriate absolute paths rather than copying a different user's home directory.

Back up the TOML file before editing it, and validate it afterward:

```bash
python -c "import tomllib; tomllib.load(open('fastdyn/mr_vmu_tropic.toml', 'rb')); print('TOML valid')"
```

## 8. Generate the Rumoca Vehicle Plant

A later simulation attempt failed because the FMI plant model description was missing.

Locate the Modelica source directory:

```bash
cd ~/projects/github/cerebri_rdd2

export RDD2_MODELICA_MODELS_ROOT="$PWD/.devenv/state/west/models/modelica_models"
```

Export the plant:

```bash
MODELICA_MODELS_ROOT="$RDD2_MODELICA_MODELS_ROOT" \
  nix run "$RDD2_MODELICA_MODELS_ROOT#rdd2-export-plant"
```

Configure the generated plant paths:

```bash
export RDD2_RUMOCA_PLANT_DESCRIPTION="$RDD2_MODELICA_MODELS_ROOT/artifacts/vehicles/rdd2/plant/modelDescription.xml"

export RDD2_RUMOCA_PLANT_LIBRARY="$RDD2_MODELICA_MODELS_ROOT/artifacts/vehicles/rdd2/plant/binaries/x86_64-linux/Vehicles_Rdd2_AvionicsPlant.so"
```

Verify:

```bash
test -f "$RDD2_RUMOCA_PLANT_DESCRIPTION" && echo "Plant description found"

test -f "$RDD2_RUMOCA_PLANT_LIBRARY" && echo "Plant library found"
```

**Architecture note:** The generated binary was an ARM64 ELF shared library even though the directory was named `x86_64-linux`. Verify your actual binary architecture using `file`; do not assume the directory name identifies the compiled architecture.

## 9. Execute the Mission

With the firmware, helper, QEMU, FastDyn plugin, and Rumoca plant available, run:

```bash
cd ~/projects/github/cerebri_rdd2

bash fastdyn/run_mission.sh
```

For this successful run, GDB startup-pausing settings were disabled:

```toml
enable_gdb = false
stop_on_start = false
```

The mission completed with:

```text
RDD2 mission passed=true
simulated=20.0s
mission_speedup=21.6137x
overall_speedup=3.8678x
max_alt=2.0506m
```

Inspect the report:

```bash
cat artifacts/bil/work/cerebri_rdd2_mission.json
```

The output directory also contains mission telemetry, timing data, and trajectory records.

## 10. Verified Results

| Metric | Result |
|---|---:|
| Mission passed | true |
| Simulated duration | 20.0 s |
| Controller ticks expected | 32,000 |
| Plant timestep | 0.02 s |
| Plant steps | 1,000 |
| Motor messages | 1,000 |
| Flight-state messages | 1,000 |
| Maximum altitude | 2.051 m |
| Maximum tilt | 15.347° |
| Final altitude | 0.098 m |
| Firmware armed | true |
| Firmware disarmed | true |
| RC and IMU healthy | true |
| Automatic level response | observed |
| Reported failures | none |
| Overall execution time | 5.171 s |

The result demonstrates successful execution of a CogniPilot RDD2 mission using FastDyn/QEMU and the generated vehicle plant.

It does **not** establish hardware driver latency, physical flight performance, or a CogniPilot-versus-Betaflight speed comparison.

## 11. Remaining Work

- Revalidate this guide on a clean Ubuntu ARM64 installation.
- Record exact Git commit hashes for each dependency.
- Investigate and upstream the ARM64 compatibility fix.
- Run repeated missions and compare the results.
- Test additional trajectories, including a figure eight.
- Analyze simulation timing and controller behavior.
- Coordinate results with the team's existing SIL benchmark.

## References

- [PURT Autonomous Drone Racing Workspace](https://github.com/An1Sura/PURT-UAS_Autonomous_Drone_Racing_Workspace)
- [CogniPilot Cerebri RDD2](https://github.com/CogniPilot/cerebri_rdd2)
- [CogniPilot Workspace](https://github.com/CogniPilot/cognipilot_workspace)

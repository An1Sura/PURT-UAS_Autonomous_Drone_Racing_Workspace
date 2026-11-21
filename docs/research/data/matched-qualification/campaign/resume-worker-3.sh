#!/usr/bin/env bash
set -euo pipefail
export PATH=/nix/store/kjcsvsmw31zad29q3inbxncsnriwcrq1-devenv-profile/bin:$PATH
root=/home/suraa.guest/autonomous-drone-bench
out=$root/artifacts/matched-qualification-20261120
export ADR_WORKSPACE=$root RDD2_WORKSPACE_ROOT=$root CEREBRI_RDD2_ROOT=$root/src/cerebri_rdd2
export FASTDYN_QEMU_PATH=$root/.devenv/state/fastdyn-pinned/qemu/build/qemu-system-arm
export FASTDYN_MONITOR_ELF=$root/.devenv/state/fastdyn-pinned/qemu/ws/monitor.elf
export RDD2_SPEED_FASTDYN_EXECUTABLE=$root/.devenv/state/fastdyn-pinned/venv/bin/fastdyn
cd $root/artifacts/fastdyn-pinned
run_plan() {
 local stack=$1 plan=$2 dest=$3
 export RDD2_SPEED_FASTDYN_CONFIG=$out/$stack.toml
 if [ "$stack" = cognipilot ]; then
  export RDD2_FASTDYN_BUILD_DIR=$root/artifacts/benchmark-validation-20261120/cognipilot-build
 else
  export RDD2_FASTDYN_BUILD_DIR=$root/src/betaflight-nxp/obj/main BETAFLIGHT_NXP_ELF=$out/source/betaflight.elf
 fi
 $out/coordinator shared-sil-campaign "$out/$plan" "$root/src/modelica_models/artifacts/vehicles/rdd2/plant/Vehicles_Rdd2_Plant" "$out/source/libshared_loop.so" "$out/source/$stack.elf" "$stack" "$out/$dest"
}
export FASTDYN_MONITOR_PORT=5556 FASTDYN_QMP_SOCKET=$out/worker-3.sock
trap 'echo $? > "$out/worker-3.exit"' EXIT
run_plan betaflight betaflight-remaining-plan.json betaflight-noise/resumed
run_plan cognipilot cognipilot-noise-part-3.json cognipilot-noise/part-3

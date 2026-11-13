#!/usr/bin/env bash
set -eu
export PATH=/nix/store/kjcsvsmw31zad29q3inbxncsnriwcrq1-devenv-profile/bin:$PATH
root=/home/suraa.guest/autonomous-drone-bench
out=$root/artifacts/rate-matched-full-20261113
mkdir -p "$out"
cp "$root/src/cerebri_rdd2/target/release/xtask" "$out/xtask"
jq '.timing={matched_hz:1600,command_delivery:"latest 250 Hz command on 625 us sensor boundaries",scope:"simulation scheduling experiment"} | .controller.feedforward="off" | .tuning={probe_event:0} | .stacks.betaflight.motor_protocol="DSHOT600" | .stacks.betaflight.pid_process_denom=1 | .qualification.status="step_response_diagnostic_not_speed_qualification" | .stacks.cognipilot.motor_protocol="DSHOT600_VIRTUAL" | .actuator_model={encoding:"shared unidirectional DShot frame codec",telemetry:false,electrical_timing:"not simulated"}' "$root/artifacts/arm-speed-cognipilot-hardened-20261106/confirm-33-harsh-1/config.json" > "$out/config.json"
sed 's|${ADR_WORKSPACE}/artifacts/protocol-study-target/release/xtask|${ADR_WORKSPACE}/artifacts/rate-matched-full-20261113/xtask|' "$root/artifacts/betaflight-protocol-study.toml" > "$out/betaflight.toml"
sed 's|${CEREBRI_RDD2_ROOT}/target/release/xtask|${ADR_WORKSPACE}/artifacts/rate-matched-full-20261113/xtask|' "$root/fastdyn/cognipilot/flight.toml" > "$out/cognipilot.toml"
export ADR_WORKSPACE=$root RDD2_WORKSPACE_ROOT=$root CEREBRI_RDD2_ROOT=$root/src/cerebri_rdd2
export RDD2_SHARED_CONFIG=$out/config.json
export RDD2_SHARED_PLANT=$root/src/modelica_models/artifacts/vehicles/rdd2/plant/Vehicles_Rdd2_Plant
export RDD2_SHARED_LIBRARY=$root/artifacts/tilt-lead-generated/libshared_loop.so
export FASTDYN_QEMU_PATH=$root/.devenv/state/fastdyn-pinned/qemu/build/qemu-system-arm
export FASTDYN_MONITOR_ELF=$root/.devenv/state/fastdyn-pinned/qemu/ws/monitor.elf
export BETAFLIGHT_NXP_ELF=$root/src/betaflight-nxp/obj/main/betaflight_MIMXRT1064_MR_VMU_TROPIC.elf
export ADR_SEED=1 ADR_NOISE=none
cd "$root/artifacts/fastdyn-pinned"
for shape in attitude-step rate-step position-step; do
 for stack in cognipilot betaflight; do
  id=$stack-$shape
  export ADR_FLIGHT_SHAPE=$shape ADR_FLIGHT_OUTPUT=$out/$id
  export ADR_MEMORY_DIR=$out/$id-ram FASTDYN_QEMU_MEMORY_DIR=$out/$id-ram
  if [ "$stack" = betaflight ]; then
   export RDD2_FASTDYN_BUILD_DIR=$root/src/betaflight-nxp/obj/main
  else
   export RDD2_FASTDYN_BUILD_DIR=$root/src/cerebri_rdd2/build-mr_vmu_tropic-fastdyn/cerebri_rdd2
  fi
  date -Is
  echo "START $id"
  set +e
  env -u PYTHONPATH -u PYTHONHOME "$root/.devenv/state/fastdyn-pinned/venv/bin/fastdyn" run -c "$out/$stack.toml" -o "$out/$id-runtime" > "$out/$id.log" 2>&1
  code=$?
  set -e
  echo "$code" > "$out/$id.exit"
  [ ! -f "$out/$id/actuator-trace.bin" ] || gzip "$out/$id/actuator-trace.bin"
  find "$out/$id" -name "*.csv" -exec gzip {} \;
  echo "END $id exit=$code"
 done
done

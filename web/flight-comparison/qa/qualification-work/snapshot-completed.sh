#!/usr/bin/env bash
set -euo pipefail
out=/home/suraa.guest/autonomous-drone-bench/artifacts/matched-qualification-20261120
cd "$out"
roots=()
for d in cognipilot-attitude-0 cognipilot-attitude-1 betaflight-attitude-0 cognipilot-baseline cognipilot-baseline-resumed betaflight-baseline betaflight-noise cognipilot-noise; do
 [ ! -d "$d" ] || roots+=("$d")
done
find "${roots[@]}" -name report.json -print0 | while IFS= read -r -d '' report; do
 dir=${report%/report.json}
 printf '%s\0' "$dir"
 for f in "$dir.json" "$dir.log"; do [ ! -f "$f" ] || printf '%s\0' "$f"; done
done > completed-snapshot-files.nul
find "${roots[@]}" -type f \( -name campaign.json -o -name planned-cases.json \) -print0 >> completed-snapshot-files.nul
for f in config.json probe-1.json protocol.json resource-checkpoint.json native-integration-tests.log worker-0.log worker-1.log worker-2.log worker-3.log resume-worker-0.sh resume-worker-1.sh resume-worker-2.sh resume-worker-3.sh worker-0.exit worker-1.exit worker-2.exit worker-3.exit; do [ ! -f "$f" ] || printf '%s\0' "$f" >> completed-snapshot-files.nul; done
tar --null -T completed-snapshot-files.nul -czf completed-measurements.tar.gz
find "${roots[@]}" -name report.json | wc -l

# Autonomous Flight Lab: Three.js replay

[Open the published replay](https://an1sura.github.io/autonomous-drone-bench/replay/).

The viewer uses Three.js 0.180.0 with WebGL2, a shaded procedural drone,
and orbit/chase/onboard/top cameras. The requested scene is a black void with a
0.5 m square floor grid and green display boundary lines. Betaflight flight
trails are orange; CogniPilot trails are blue, independent of the UI theme.
The green 4 × 4 × 3 m box is a visual guide, not an enforced simulation geofence.
The previous decorative hangar, launch pad, reflections and bloom were removed.
Three.js and its controls are loaded from the version-pinned esm.sh CDN; see the
[upstream MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
Internet access to that CDN and WebGL2 are required. A visible error replaces the
loading message when initialization fails.

## Recordings

The current October 2 configuration is [figure-eight.json](../config/figure-eight.json).
The [editable planner](../planner/) recalculates geometry and timing; it does not
change existing recorded flights. The [rundown](../timing-rundown.md) distinguishes
calculated requirements, actual run times and measured tracking errors.

- **Betaflight:** native pattern mapped from the config, 54.960 s recording,
  native LAND and disarm on repeat. The first attempt aborted with estimator
  reason 1 and is retained. This native phase law differs from the shared reference.
- **CogniPilot:** two 20 s shared-reference laps, hold and assisted landing, 69 s
  including setup and observation.
- **ArduPilot:** the same two 20 s shared-reference laps, 90 s estimator warmup,
  normal Guided takeoff and LAND, 165 s total. Purple identifies ArduPilot; the
  requested orange Betaflight and blue CogniPilot colors are retained.
- **Betaflight before tuning:** historical October 1 baseline; no landing.

Current reports and 20 Hz trajectories are in [results/configurable](../results/configurable/).
Earlier successful landing evidence and tuning reports remain historical.

Embedded data are sampled at approximately 20 Hz from full-rate trajectory CSVs,
with the exact final row retained. Columns are time in seconds, ENU position in
metres, FLU roll/pitch/yaw in radians, and approximate speed in metres/second.
Speed is derived from the recorded position. The tuned/baseline viewer samples
match the corresponding CSV position and attitude values to six decimal places.
Position is linearly interpolated; attitude uses quaternion interpolation with
ZYX Euler conversion (`Rz(yaw) Ry(pitch) Rx(roll)`). The scene preserves Z-up ENU.

The grid, boundary, drone body, lighting and propeller animation are illustrative.
Rotor spin is not measured RPM. The dashed figure eight is reference geometry,
not a claim that all controllers received the same timed command. No cosmetic
scene objects participate in physics or collision detection. This is a **recorded
SIL replay**, not a firmware simulation running in the browser and not a fair
cross-stack performance ranking.

## Source and publishing

`source.html` is the editable fragment with its embedded recordings. `index.html`
is the standalone exported page served by GitHub Pages from `main/docs`.
Update both together. The viewer is static; it does not need a second workspace
build system, package installation, physics engine or simulation runner.

Controls preserve the selected recording, replay time, camera mode and speed.
Playback starts only on request. Old saved-state versions are ignored so the
new tuned recording opens by default. Runtime checks cover load errors and lost
WebGL contexts. Public layout supports small screens; orbit supports drag/zoom,
while the named cameras remain available to keyboard users through the select.

## Refresh after flight changes

Rerun the affected `rdd2:benchmark:betaflight:figure-eight` or
`rdd2:benchmark:cognipilot:figure-eight` Devenv task after each flight-logic change;
rerun both if shared plant or sensor behavior changes. Check the native report,
then replace the affected embedded trajectory with approximately 20 Hz samples
from the new full-rate CSV, retaining the exact final row. Update dates, source
paths and end-state descriptions, export `source.html` to `index.html`, and
verify playback and the GitHub Pages deployment. This is a required development
workflow, not a browser-triggered simulation or an unattended CI promise.

The current configurable runner requires landing and stores the exact input
configuration in the report/evidence. All three affected recordings were rerun
on October 2. Native tests passed 43 cases with two ignored; browser/native
geometry calculations agree. The earlier Betaflight abort remains visible in
the evidence and rundown.

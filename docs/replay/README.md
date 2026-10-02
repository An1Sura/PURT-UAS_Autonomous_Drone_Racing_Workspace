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

- **Betaflight landed, October 2:** `betaflight-landing/run-1`, yaw I = 20,
  40.14 seconds; native figure-eight hold followed by a LAND waypoint and
  automatic firmware disarm. Ground truth settled at 0.09837 m (vehicle centre),
  with zero motor commands for over two seconds. See [recorded evidence](evidence/betaflight-landing-2026-10-02/report.json).
- **Betaflight before tuning, October 1:** `betaflight-hover/baseline-final`,
  yaw I = 80, 36.9675 seconds; historical baseline with no landing sequence.
- **CogniPilot, September 28:** existing 44-second recorded figure-eight mission,
  including takeoff, hold and landing.

The Betaflight pair's provenance, metrics and unsuccessful repeat are documented
in [the tuning report](../betaflight-tuning.md). CogniPilot's older recording and
limitations are documented in [the figure-eight report](../figure-eight.md).
The replaced September 28 Betaflight replay remains recoverable in Git history.

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

The October 2 change adds a 25-second native HOLD/figure-eight followed by a
LAND waypoint. The runner fails on premature disarm, landing timeout, or failure
to rest near the ground with zero motor commands for two seconds. Pre-landing
altitude diagnostics are kept separately; the descent is not hover error.
CogniPilot logic was unchanged, so its existing dated recording is retained.

Validation on October 2: two consecutive native landing runs passed (40.14 s and
41.43 s); the native Rust suite passed 40 tests with two ignored. The cumulative
Cerebri patch applies cleanly to its pinned source. Earlier intermittent SITL
startup and estimator failures remain documented; two passes are not a hardware
flight qualification.

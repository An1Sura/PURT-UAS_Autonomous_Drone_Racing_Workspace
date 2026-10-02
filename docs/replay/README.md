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

- **Betaflight tuned, October 1:** `betaflight-hover/tuned-final`, yaw I = 20,
  36.965 seconds; completed diagnostic, no qualified landing.
- **Betaflight before tuning, October 1:** `betaflight-hover/baseline-final`,
  yaw I = 80, 36.9675 seconds; same plant and firmware as the tuned recording.
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

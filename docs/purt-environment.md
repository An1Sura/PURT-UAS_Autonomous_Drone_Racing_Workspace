# PURT environment: evidence, assumptions and survey

The replay keeps the requested black grid and green display boundary. The green
4 × 4 × 3 m replay box is a visual guide, not the PURT room or a flight geofence.
Use the [planner](planner/) for the separate room-fit check and top-down view.

## What the five photos establish

| Feature | Evidence | Classification / limitation |
|---|---|---|
| Room structure | Images 1, 4, 5 show a large hangar, repeated wall bays, exposed steel trusses and suspended rails | Observed from photo; rectangular envelope is assumed, dimensions need measurement |
| Ceiling | Images 1, 3, 5 show a high trussed roof with fixtures below it | Needs a real measurement of the lowest permitted flight height, not just roof height |
| Walls and nets | Insulated/metal walls and large segmented door; portable net frame in image 1; mesh at mezzanine in image 3 | Observed from photo; a continuous netted flight boundary cannot be established |
| Floor | Concrete slab joints and worn yellow markings | Observed from photo; spacing and meaning need measurement |
| Cameras | Several tripod instruments in images 2 and 4 | Needs a real measurement/inventory; filming cameras/lights cannot all be identified as mocap units |
| Fixed obstacles | Columns, mezzanine, stairs and equipment near walls | Observed from photo; boxes need surveyed coordinates |
| Scale references | People, personnel doors, scissor lift and equipment | No known exact dimensions or camera calibration supplied; none used as a metre ruler |

**No dimension is labeled “measured from photo.”** Perspective, occlusion and lens
distortion do not support an accurate metric reconstruction here. Empty obstacle
arrays mean the inventory is missing; they do not certify an empty facility.

## Published dimensions supplied by the user

Purdue's [facility page](https://engineering.purdue.edu/PURT/capabilities) describes
20,000 ft² (1,858.06 m²), a 30 ft (9.144 m) ceiling and 60 Oqus cameras, with
300 Hz / 12 MP and 1100 Hz / 3 MP capture modes. These are published capabilities,
not measurements from these photos or end-to-end control-loop latency.

The additional description supplied in this chat gives an approximate capture
envelope of 175 × 95 × 30 ft = **53.34 × 28.956 × 9.144 m**, and 58 cameras
(56 tracking + two video). Its footprint is 16,625 ft², so it must not be silently
treated as the same quantity as the 20,000 ft² total facility area. The camera
counts may refer to different installations/dates; the current inventory remains
unconfirmed. Camera coordinates and the current calibrated region are unknown.
The supplied calibration residuals are not an IID sensor-noise model and are not
copied into the simulation as one.

## Loadable files

- [purt-environment.json](config/purt-environment.json): published approximate
  envelope used as an **assumed** centred box; actual mocap coverage remains null.
  Fit is **unverified**, not passed.
- [purt-nominal-assumed.json](config/purt-nominal-assumed.json): assumes coverage
  fills that envelope and no obstacles, solely for an upper-bound calculation.
- [purt-example-assumed.json](config/purt-example-assumed.json): small synthetic
  6 × 4 × 3 m example for exercising a rejection; it is not the PURT room.

Coordinates are ENU metres. The proposed origin is the centre-floor marker;
orientation and the transform to the actual QTM L-frame must be surveyed.
Each box has `min_enu_m`, `max_enu_m`, `status`, and `reference`. Add obstacles
with the same fields. JSON is consumed by `figure-plan` and the browser planner.
It defines preflight geometry checks, not new physical collision surfaces in
the Rumoca plant. All stack profiles are checked against the same path envelope.

Default inflation is 0.40 m vehicle bounding radius + 0.15 m tracking margin +
0.50 m wall/net safety margin = **1.05 m**. These three numbers are assumptions.
The checker conservatively applies them to both flyable bounds and mocap bounds,
and rejects overlap of the inflated path bounding box with any obstacle box.
This can reject some curved paths that would fit a less conservative exact check.
At a fixed centre and altitude, it reports the largest conservative uniform scale.
A vertical conflict returns zero; missing coverage returns unknown.

For the nominal full-envelope case, the 2 × 1 m base figure eight has a geometric
upper-bound scale of **25.62** (51.24 × 25.62 m). This is NOT approval to fly it:
current coverage, obstacles and approved margins are missing, and speed/accel
limits generally demand a much longer lap time at that scale.

## What to measure on site

1. Locate the QTM calibration origin and record its axis directions and transform
   to the proposed ENU frame. Measure at least two floor reference points.
2. Survey the permitted flight polygon/box, closed door/net positions, and minimum
   clearance below lights, rails and trusses. Record the lowest obstruction.
3. Export the current QTM camera inventory and calibrated poses; distinguish
   tracking cameras from video cameras. Record the calibration date and residuals.
4. Validate marker visibility and accuracy throughout the planned altitude range;
   map weak/occluded regions as excluded boxes, not “full room coverage.”
5. Measure each column, stair/mezzanine intrusion, net stand, camera tripod and
   retained equipment bounding box in that same frame.
6. Measure propeller-tip envelope and approve wall/net, tracking and vertical
   margins with the facility team. Measure mocap-to-controller latency/jitter
   under the actual marker set and streaming mode.

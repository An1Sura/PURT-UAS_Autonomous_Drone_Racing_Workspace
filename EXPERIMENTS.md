# Autonomous drone benchmark

This experiment branch is copied directly from
https://github.com/CogniPilot/cognipilot_workspace, retaining its Git history.
The starting revision is `cda870823bb0502a1af44f84c2490d645115dce1`.
`upstream` points to that official repository. See README.md for upstream setup.

## First milestone: reproduce the RDD2 baseline

On a Linux development machine, from this checkout:

```sh
./setup rdd2
devenv -P rdd2 tasks run rdd2:simulation:modelica:test
devenv -P rdd2 tasks run rdd2:simulation:sil:test
```

Record both the workspace commit and the commits of every populated `src/`
repository before evaluating changes. The workspace lock pins its environment;
editable source repositories can follow branches and must also be recorded.
Keep the same revisions and parameters for repeated baseline runs.

The initial SIL result is expected at
`src/cerebri_rdd2/artifacts/sil/mission.json`, with the canonical trajectory at
`src/cerebri_rdd2/artifacts/sil/mission-trajectory.csv`.

For the next milestone:

```sh
devenv -P rdd2 tasks run rdd2:simulation:bil:test
devenv -P rdd2 tasks run rdd2:simulation:compare
```

The comparison report is under
`src/cerebri_rdd2/artifacts/trajectory-comparison/`. These tasks compare execution
modes of CogniPilot; they do not compare four flight stacks.

## Sources and ownership

- `CogniPilot/cognipilot_workspace`: development environment and task graph.
- `CogniPilot/cerebri_rdd2`: multirotor firmware and SIL/BIL runners.
- `CogniPilot/modelica_models`: plant, controller, estimator, and mission models.
- `CogniPilot/rumoca`: Modelica compiler and execution tools.
- Other dependencies remain those selected by upstream, including the external
  `jgoppert/FastDyn` repository for BIL.

Keep native changes in their owning `src/` repository. That directory is ignored
by the workspace; firmware and model changes need their own branches and remote
repositories to persist. Preserve upstream licenses and notices in each project.

## Comparison protocol to implement

1. Reproduce the existing bounded RDD2 mission before adding a racing course.
2. Agree on airframe mass/inertia, rotor thrust and lag, sensor rates/noise,
   initial state, coordinate conventions, actuator order, and trajectory.
3. Define the comparison boundary: identical body-rate/thrust commands for
   inner-loop testing, or a documented common autonomy interface for trajectory
   testing. Record every adapter and any external controller.
4. Run nominal and disturbed cases with fixed seeds and equal tuning budgets.
5. Measure trajectory error, completion/failure rate, saturation, and response
   to delay. Rank lap times only among successful runs meeting the same limits.
6. Add Betaflight, PX4, and ArduPilot adapters individually. None is integrated
   into this initial experiment branch.

Host execution time is not a measurement of flight-controller latency. Measure
sensor-to-actuator latency and jitter on target hardware. BIL is an emulated
ARM execution path; HIL requires the physical controller and a defined interface
between simulated sensors and actuator outputs. Sensor injection that bypasses
the IMU driver does not validate the physical SPI/DMA acquisition path.

## Current verification

- Official workspace cloned with original Git history and upstream revision.
- Task names and artifact paths checked against upstream docs/rdd2.md.
- Simulation not run: this session has neither Nix nor Devenv installed.
- Private GitHub repository: https://github.com/An1Sura/autonomous-drone-bench
- Scope: the upstream workspace only; use the RDD2 profile to fetch its required
  sources. Other flight stacks and vehicle applications are not copied here.

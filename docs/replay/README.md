# Flight replay

The combined [Flight Simulation & Stats page](../sim/) contains the fixed one-lap PURT course, Betaflight and CogniPilot recordings, and stats. This directory's entry point redirects there.

Native SIL records live in `docs/results/shared-sil/feedforward/`. The October 16 CogniPilot ARM FastDyn figure-eight is separate at `docs/results/fastdyn/figure-eight/`. Each includes the configuration, measured report, and sampled ground-truth trajectory with the original final sample retained. The viewer does not invent motion or landing. Rerun affected stacks whenever flight logic or configuration changes.

Use the VM-connected page to create new local recordings. GitHub Pages serves saved records only. Black grid, green approximate PURT boundary, orange Betaflight and blue CogniPilot are retained.

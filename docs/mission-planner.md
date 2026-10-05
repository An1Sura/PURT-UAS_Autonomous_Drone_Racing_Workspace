# Flight Simulation & Stats

The [public simulation](https://an1sura.github.io/autonomous-drone-bench/sim/) shows the selected October 5 speed-search recordings: one 8 × 4 m figure eight at 1.5 m altitude. CogniPilot uses a 23.7-second smooth reference. Betaflight uses its separately tested native-pattern setting. See [exact settings, errors and repeats](speed-search.md).

The fixed page has no editable stats controls. `docs/config/stack-configs.json` holds each tested configuration, while `figure-eight.json` supplies the shared geometry and CogniPilot reference. The native server rejects mismatched geometry. **Rerun both** runs one fresh attempt per stack, preserving failures and scoring accuracy separately from native completion. Three-repeat selection is documented in the campaign; a single button click is not that qualification.

The green envelope comes from the PURT configuration (approximately 53.34 × 28.956 × 9.144 m). The viewer retains the black grid, orange Betaflight and blue CogniPilot paths. PURT overview shows the facility extent; close camera views keep the small drone visible. Actual calibrated coverage and obstacle positions are still unknown.

Use the public page for saved recordings. To rerun both stacks, open [the local page](http://127.0.0.1:8766/sim/) while the Mac and VM are running. Start its existing native server using `devenv -P rdd2 up mission-planner` in the VM repository. The process name remains unchanged for compatibility with the current installation. The page’s **Rerun both** button sends both fixed stack configs.

Runs are sequential, save their exact config and preserve failed partial trajectories. Each recorded result is labeled passed or failed. Sensor/timing differences remain; do not rank the stacks from these results. Native artifacts stay under `src/cerebri_rdd2/artifacts/mission-planner/`. Historical measurements for both remaining stacks are retained; the public page uses their current recordings.


Three selected lap repeats passed for each stack. An additional VM-page rerun passed CogniPilot but Betaflight aborted during the pre-lap hover because its XY estimator became invalid (native reason 1). The check was not disabled. Selected-setting observations are therefore 3/4 successful Betaflight attempts and 4/4 CogniPilot attempts in this final set; these small counts are not reliability estimates. Startup/estimator freshness remains unresolved.

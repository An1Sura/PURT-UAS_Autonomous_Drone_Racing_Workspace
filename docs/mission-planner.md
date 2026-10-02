# Flight Simulation & Stats

The [simulation page](https://an1sura.github.io/autonomous-drone-bench/sim/) now uses a fixed PURT single-lap configuration. There are no editable mission, profile or environment controls.

The course is 2 × 1 m at 1.5 m altitude, with one requested 30-second figure-eight lap, a five-second hold and landing. Thirty seconds is within the existing Betaflight native pattern adapter’s supported duration. Betaflight’s quantized native clock is not exactly the common CogniPilot/ArduPilot clock; a requested lap is not proof of actual completion, particularly on failed attempts.

The green envelope comes from the PURT configuration (approximately 53.34 × 28.956 × 9.144 m). The viewer retains the black grid, orange Betaflight and blue CogniPilot paths, with ArduPilot purple. PURT overview shows the facility extent; close camera views keep the small drone visible. Actual calibrated coverage and obstacle positions are still unknown.

Use the public page for saved recordings. To rerun all three stacks, open [the local page](http://127.0.0.1:8766/sim/) while the Mac and VM are running. Start its existing native server using `devenv -P rdd2 up mission-planner` in the VM repository. The process name remains unchanged for compatibility with the current installation. The page’s **Rerun all three** button uses only the fixed config.

Runs are sequential, save their exact config and preserve failed partial trajectories. Each recorded result is labeled passed or failed. Sensor/timing differences remain; do not rank the stacks from these results. Native artifacts stay under `src/cerebri_rdd2/artifacts/mission-planner/`. Historical multi-lap reports remain dated evidence rather than being relabeled as single-lap results.

All three stacks passed the fixed single-lap retry. The first Betaflight attempt failed during configuration with a native heap-allocation error; its status is retained in `docs/results/single-lap/first-attempt-status.json`. The successful recordings contain the original final samples.

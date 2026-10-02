# Flight Simulation & Stats

The [simulation page](https://an1sura.github.io/autonomous-drone-bench/sim/) now uses a fixed PURT single-lap configuration. There are no editable mission, profile or environment controls.

The course is 8 × 4 m at 1.5 m altitude, with one requested 45-second figure-eight lap, a five-second hold and landing. Forty-five seconds is within the existing Betaflight native pattern adapter’s supported duration. Betaflight’s quantized native clock is not exactly the CogniPilot reference clock; a requested lap is not proof of actual completion, particularly on failed attempts.

The green envelope comes from the PURT configuration (approximately 53.34 × 28.956 × 9.144 m). The viewer retains the black grid, orange Betaflight and blue CogniPilot paths. PURT overview shows the facility extent; close camera views keep the small drone visible. Actual calibrated coverage and obstacle positions are still unknown.

Use the public page for saved recordings. To rerun both stacks, open [the local page](http://127.0.0.1:8766/sim/) while the Mac and VM are running. Start its existing native server using `devenv -P rdd2 up mission-planner` in the VM repository. The process name remains unchanged for compatibility with the current installation. The page’s **Rerun both** button uses only the fixed config.

Runs are sequential, save their exact config and preserve failed partial trajectories. Each recorded result is labeled passed or failed. Sensor/timing differences remain; do not rank the stacks from these results. Native artifacts stay under `src/cerebri_rdd2/artifacts/mission-planner/`. Historical measurements for both remaining stacks are retained; the public page uses their current recordings.


The current course scales both horizontal dimensions by four while keeping altitude fixed. Its path is 24.3889 m, peak required speed 1.4810 m/s and peak lateral acceleration 0.5260 m/s² at a 45-second lap target. This fits the assumed profile limits including their reserve factor; actual calibrated PURT coverage remains unverified.

The 8 × 4 m, one-lap / 45-second configuration was rerun on both stacks. All passed; every public recording embeds this exact config. Recorded durations include setup and landing, not just the lap.

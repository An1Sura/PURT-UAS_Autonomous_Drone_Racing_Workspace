# Mission Planner

The [combined page](https://an1sura.github.io/autonomous-drone-bench/planner/) contains configuration, room-fit checks and flight playback. For fresh simulations, use the **[VM-connected page](http://127.0.0.1:8766/planner/)** on the Mac hosting the existing Lima VM.

The public GitHub Pages site is static. It cannot execute firmware or operate the VM. Its connection link opens the same interface served locally. No GitHub token, public tunnel or cloud compute account is required.

## Use

1. Keep the VM running. In the repository's RDD2 environment, start `devenv -P rdd2 up mission-planner`. The existing pinned firmware binaries and generated plant must already be built using the benchmark tasks.
2. Open the connected page. Click **Run all three** for the current config, or edit a mission field with **Run after edits** checked.
3. After 1.5 seconds without another edit, the page submits an immutable config/environment snapshot. It runs Betaflight, CogniPilot, then ArduPilot sequentially to avoid transport/CPU interference.
4. Each stack shows queued, running, passed or failed. **Watch** appears when that attempt has a usable recording, including failed partial flights. Playback stays on this page with the same black grid and stack colors.

Changing the config immediately hides the old recording. Results from an older request cannot be presented as matching the new config. An active batch finishes; only the newest waiting batch is retained, and older waiting batches are marked superseded. Turning off automatic runs stops future edit-triggered submissions, not an already accepted simulation.

The standalone native entry point is `cargo run --release --locked --package cerebri-rdd2-xtask -- mission-server WORKSPACE_ROOT` in `src/cerebri_rdd2`. Devenv supervises the optional web process; simulation behavior remains in the existing native adapters. Do not run separate benchmark tasks concurrently with the web runner.

## Scope and records

Jobs are saved under `src/cerebri_rdd2/artifacts/mission-planner/<id>/`, including config, environment, plan, status, each firmware log/report and full trajectory. Web playback downsamples to approximately 20 Hz and retains the exact final sample. Speed shown in playback is calculated from adjacent retained positions.

The endpoint binds only to loopback on port 8766. It checks Host and Origin and accepts same-origin JSON submissions; it neither provides general shell execution nor exposes arbitrary filesystem paths. Lima forwards this local port to the Mac. Keep it local.

Interactive batches support three stack profiles, up to 300 seconds of reference/hold, and up to 180 seconds of setup/landing per stack. Each adapter still enforces its own tighter geometry, duration, sensor and mode constraints. An unsupported configuration fails explicitly; the other stacks still run. A rejected environment fit rejects the batch before flight.

Actual calibrated PURT coverage remains unknown. Betaflight still uses its native figure-eight clock and may abort its autonomous mode. CogniPilot uses assisted takeoff/landing; ArduPilot retains warmup and arming checks. A passed job is not sensor/timing parity or a hardware flight-safety certification. Failed attempts are never silently replaced with prior successful recordings.

The worker requires the Mac/VM to remain awake. This version keeps job history on disk; reloading the browser resets its current-run selection. Stopping the server during flight is not a cancel workflow; allow the current batch to finish before shutdown.

## Verification

The page launched a baseline batch and then automatically launched a second batch after changing lap time from 20 to 22 seconds. CogniPilot and ArduPilot passed in both batches. Betaflight failed its native autonomous-mode check; both failures and partial trajectories were retained. The 22-second CogniPilot recording was verified in the embedded 3D viewer. Unit tests verified final-sample retention and rejection of nonfinite trajectory values. No controller/plant logic was changed for this web integration.

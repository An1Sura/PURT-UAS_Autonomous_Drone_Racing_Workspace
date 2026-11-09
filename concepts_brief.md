# CogniPilot and Betaflight Speed Comparison on the TROPIC ARM Simulation

* **Author:** Lohen Chen
* **Date:** 2026-11-09

## Overview

This work answers one question for a research presentation around 2026-11-16: is CogniPilot faster than Betaflight, and if so why and how, and if not, what steps get it there?

The test bed is the shared TROPIC RT1064 ARM firmware simulation (FastDyn and QEMU). All claims stay limited to simulation. None apply to hardware timing.

"Faster" has one meaning here: the shorter reference lap duration, on a 1 second grid, that a stack can follow while meeting all of these on all 15 runs (three noise levels times seeds 1 to 5):

* root-mean-square (RMS) position error below 0.35 m
* maximum position error below 0.75 m
* zero tilt clamps
* course geometry correct

Each stack uses its better setting of offboard tilt lead (on or off). Both use attitude gain K = 6/s. Equal times are a tie. Landing and disarm are scored and reported separately.

The audience is researchers who may open the repository and check the numbers. The value of the work is a result they can check, including a tie or a loss, with every failed attempt still visible.

Main conclusions from the seven reviews:

1. The rule can be defended, but only if it is committed before anyone reads the unread CogniPilot results on the virtual machine (VM).
2. Betaflight's 33 s is not yet its score under this rule, because lead off has never been flown for Betaflight on TROPIC.
3. With lead on, the likely result is a tie at 33 s. Lead off is the only setting likely to separate the stacks.
4. The planned "8 kHz versus 1.6 kHz" disclosure is misleading as worded. It must be replaced.
5. Existing logs can show where the attitude response differs. They cannot show which firmware stage causes the difference.
6. Compute fits the week. The larger risks are the state of the VM, stalled flights and the time needed for analysis and publishing.

## Analysis

### Reviewer status

| Lens | Status |
| --- | --- |
| `egm-design` | completed |
| `egm-codebase-details` | completed |
| `egm-zoom-out` | completed |
| `egm-comprehension` | completed |
| `egm-implementation-readiness` | completed |
| `egm-structural` | completed |
| `egm-inventive-catalyst` | completed |

No reviewer could read the VM or `src/`, which are not available on this checkout. Anything that depends on them is marked unverified. The extrapolations below are reviewer arithmetic, not measurements.

### Fact check of the stated facts

**These hold:**

* 66 Betaflight attempts and 58 passes.
* 15 of 15 runs meet the tracking gates at 33, 34, 35 and 40 s. The worst maximum error at 33 s is 0.7329 m (harsh noise, seed 3).
* 32 s failed on one flight (0.7714 m, realistic noise, seed 1).
* 30 s failed on one flight (RMS 0.3507 m, maximum 0.8675 m). It failed both error gates.
* The six confirmation failures are all harsh-noise landing failures that ended armed.
* The CogniPilot 35 s and 39 s figures, the Betaflight 35 s figures and the shared config hash `aabe2b...`.
* Wall times, serial QEMU execution, native screening results (26 s and 33 s) and the 2026-11-07 snapshot.

**These need correcting:**

| Stated fact | Correction | Source |
| --- | --- | --- |
| Betaflight 8 kHz vs CogniPilot 1.6 kHz | True only for packet exchanges. Both stacks receive new IMU data at 1600 Hz, and Betaflight's 8 kHz packets hold the same sample. Betaflight's control and motor loop ran at 500 Hz under PWM. CogniPilot's control loop rate is not in any committed file the reviewers read. | `docs/results/arm-speed/betaflight-33s/report.json:63,71`; `docs/yaw-noise-investigation.md:55` |
| Betaflight scores 33 s under the rule | 33 s is an upper bound. It is lead-on and PWM only. Zero lead-off flights exist on TROPIC. The native 0 of 5 was at 26 s and says little about 32 s on ARM. | `docs/results/arm-speed/betaflight-attempts.json`; `docs/arm-benchmark-integration.md:159` |
| Only the attitude path, firmware and schedule differ | Also different: CogniPilot uses synthetic GNSS while Betaflight has GPS disabled; CogniPilot has up to 0.5 ms of stick timing rounding; Betaflight's PWM setting; and the runner program in the hardened campaign (`f2ef29`) versus the Betaflight campaign (`7c9ade`). | `docs/shared-position-benchmark.md:28`; `docs/results/arm-speed/campaign-state.json:12,17` |
| `tilt-lead.csv` exists for some runs, implying the speed runs | It exists only for three 40 s no-noise runs under `docs/results/tilt-lead/fastdyn/`. No directory under `docs/results/arm-speed/` has commanded tilt. | File search |
| 15 runs | The five no-noise seeds give identical results, so there are 11 distinct flights. The noise levels are assumed, not measured. | `docs/arm-benchmark-integration.md:145`; `docs/optimization-sequence.md:15` |
| FastDyn upstream sources are gone | Upstream is gone, but `docs/fastdyn-source-recovery.md:10` says full-history bundles exist under `artifacts/source-recovery/` and on the VM. A file search did not find that directory on this checkout. It may be ignored by search, so check it. | `docs/fastdyn-source-recovery.md` |

The VM's size, its stopped state and the Mac's size cannot be confirmed from the repository.

### Inventive contradictions and how to resolve them

**1. Strong evidence versus a small compute budget.** This is mostly a false conflict. Betaflight needed four confirmation sets because landing failures forced it to step back. Under the new rule, 33 s would have been selected on the first set.

* Screen on one flight per lap time, then confirm only the shortest passing time (split the work).
* Stop a candidate at its first tracking failure, and fly the likely failures first (adapt to results).
* Copy the VM contents off the machine before new work (prepare a fallback).
* Trade-off: stopping early gives no count of passes out of 15 at failed durations. Run all 15 at the selected time so the landing table is complete.

**2. Fair treatment versus each stack's best setting, with a rule written after Betaflight's results were seen.**

* Commit the rule before the unread data is opened. This blindness can be used only once.
* Show all four combinations of stack and lead mode.
* Trade-off: a committed rule can only be changed by a visible amendment, and four cells make a busier slide.

**3. Equal gain versus each stack's best gain.** A common K of 6/s is a fair rule, but it does not give equal responses (see Major risks).

* Keep K fixed and disclose it. Run a pass-or-fail check at K = 6 only, if the ARM path can do it without a rebuild.
* Trade-off: this does not show that K = 6 is best on ARM, and a failed check would weaken the headline days before the talk.

**4. Depth of explanation versus no new campaign.**

* Treat recorded flights as measurements of the system. Fit lag and gain from commanded tilt to actual attitude. This costs no compute.
* Trade-off: the fit is one overall figure for the whole attitude path, and Euler-angle comparison is approximate at about 14 degrees of tilt.

**5. A clear winner versus a 1 s grid with a sharp gate.** Betaflight passes 33 s by 0.017 m and fails 32 s by 0.021 m. Publish maximum error against lap time for both stacks and read the single lap time from that curve.

* Trade-off: more material than one number, and some will read it as hedging.

**Ideal Final Result.** One committed rule and one scoring step read every retained attempt and produce the verdict, the error curve and the landing table. New flights are used only for the cells that are missing, and no firmware is rebuilt.

### Risks

#### Blocker

**B1. The rule is not committed before the unread data is opened (all lenses).** Betaflight's results are already known, so the rule is after the fact on that side. The CogniPilot side can still be set in advance, but only until someone reads the VM results.

* The commit should fix: gates, grid, search order, how a tie is declared, how stalled flights are handled, retry limit, fallback, binary and runner hashes, lead modes and Betaflight's motor protocol.
* The presentation should cite that commit.

**B2. The repository's own text forbids the claim (six lenses).**

* `docs/simulation-qualification.md:7` lists landing as a gate.
* `docs/simulation-qualification.md:39` says a failed landing "does not count as faster successful flight".
* `docs/simulation-qualification.md:47` says "Do not report 33 s as a confirmed reliable speed".
* `docs/simulation-qualification.md:24` says no superiority claim is justified until the prerequisite gates and margins are settled.
* The same position appears in `docs/yaw-noise-investigation.md:67`, `docs/tropic-pc-pilot-handoff.md:71`, `docs/research/index.html:6`, and `docs/results/arm-speed/campaign-state.json:5-9`.

This does not reopen the landing decision. It requires two named results on the same attempts, for example "tracking result" and "full-mission result". Betaflight then reads "33 s tracking result, 13 of 15 landed; no full-mission candidate". The documents must state that this is a scoped, exploratory result and not a qualified ranking. A bare "is faster" headline would still conflict with line 24 of the qualification document, so the wording must be "under this stated rule".

**B3. Betaflight has not been scored under the rule (six lenses).** Lead off has not been flown on TROPIC. The runner accepts `off` as a mode (`patches/cerebri-rdd2-benchmark.patch:6369-6380`), so a search should be possible, but no committed record shows it working on ARM. A full 21-flight search takes about 47 minutes. Until it is done, 33 s stays "provisional, lead-on".

**B4. A CogniPilot win can be dismissed because of how Betaflight was set up (design, structural, comprehension).**

* Betaflight ran its control and motor loop at 500 Hz, set by the PWM protocol.
* It is a proposed NXP port with a simulation adapter (`docs/simulation-qualification.md:29`).
* With the same config at 40 s, the STM32F405 build scored RMS 0.143 m and maximum 0.348 m. The TROPIC build scored RMS 0.195 m and maximum 0.507 m. That gap is unexplained and is far larger than the 0.004 m RMS gap between the stacks at 35 s.
* A speech slide reading "8 kHz versus 1.6 kHz" would plant the wrong idea.

Requirements:

* Show a table with separate rows for plant, IMU, exchange, control and motor rate, stick and position rates.
* Read back CogniPilot's control rate or mark it unknown.
* Label the stack "Betaflight (proposed TROPIC port, PWM, 500 Hz loop in this simulation)".
* Disclose the STM32F405 gap.
* Decide how OneShot125 is treated (see Open decisions).

**B5. "Why" cannot be answered as a cause from the committed logs (all lenses, rated Blocker as framed by two).**

* The only matched pair with commanded and actual tilt is `docs/results/tilt-lead/fastdyn/betaflight-nxp` and `docs/results/tilt-lead/fastdyn/cognipilot`: 40 s, no noise, lead on, same config `a6d0ca`, firmware hashes matching the campaigns, different runners.
* Do not use `docs/results/tilt-lead/fastdyn/betaflight`, which is the STM32F405 build.
* Attitude is logged at 100 Hz and commanded tilt at 250 Hz. There is no gyro, rate command or estimator state.
* The exchange difference is at most about 0.5 ms, against a 167 ms attitude time constant at K = 6/s, or about 0.3 percent. It is a disclosed limit, not an explanation.

The claim must narrow to "where the difference appears". Use three evidence levels: observed, consistent with, and not measured. Allowed wording: "stack X turns tilt commands into attitude N ms sooner, and this tracks the position error difference". Not allowed: "because of its estimator".

**B6. The VM is a single point of failure, and the search cannot resume (implementation readiness).**

* `flight()` stops the whole search on any incomplete flight (`patches/cerebri-rdd2-benchmark.patch:6357-6360`), and each search requires a new output directory (`:6386`), so a stall restarts from the 40 s step.
* For a 28-flight search with a per-flight failure rate of 5 percent, the expected cost is about 64 attempts. At 15 percent it is about 620.
* Retrying single cells costs 28 divided by (1 minus the failure rate).
* The only failure data is one timeout in three published runs, before the hardening.
* Measure the failure rate from VM logs first. Sources and results exist only on the VM. FastDyn kills other QEMU instances at startup, so a resumed job and a new job can kill each other. Disk had 1.4 GB free on 10-16 (`docs/simulator-provenance.md:130`).

#### Major

**M1. A tie is the likely lead-on result.** Five lenses estimated CogniPilot lead-on at about 0.748 to 0.763 m at 32 s, against the 0.75 m gate. These are extrapolations from one or two flights, and error rises about 0.04 m per second. Native CogniPilot also failed 32 s at 0.7519 m (`docs/arm-benchmark-integration.md:156`).

* Plan for four outcomes: win, tie, loss and inconclusive.
* A tie means "not faster" and follows the "steps to get there" branch.
* Write the tie sentence now: "indistinguishable at 1 s resolution under this rule".
* Do not add a tie-breaker or a finer grid after seeing a tie.
* Show the margin to 0.75 m beside every lap time.

**M2. Lead off is the deciding unknown, and it may be misleading.** Native CogniPilot with lead off reached a maximum of about 0.475 m at 33 s, against about 0.71 m with lead on. Native results may not carry over: Betaflight went from 26 s native to 33 s on ARM. `docs/arm-benchmark-integration.md:161-164` also warns that the lead-off behavior needs checking. One possible reason, untested, is that the lead formula (omega divided by K) leads CogniPilot too much, because its native attitude response is faster than K implies.

**M3. The rule moves results in both directions, and the talk should say so.** Separating landing helps Betaflight, which otherwise has no qualified time. The better-of-lead clause probably helps CogniPilot. Keeping the 0.75 m gate has already cost CogniPilot a native 32 s result. The result is "best of two lead settings at equal K", not "each stack at its best". If CogniPilot wins only with lead off, the headline must say that.

**M4. Equal K is the same rule, not the same response.** Natively, both stacks qualified K of 5 and 6.

| At K = 6 | Rise time | Overshoot |
| --- | --- | --- |
| Betaflight | 0.31 s | up to 19.94 percent (limit 20) |
| CogniPilot | 0.262 s | 0 |

Requalification on TROPIC is open (`docs/simulation-qualification.md:18`). ARM reports say `tuning_status: passed_common_step_rule`, while `docs/results/arm-speed/betaflight-33s/metadata.json` says qualification is pending, so do not quote the report label. Changing K requires a rebuild and triggers the rerun rule in `AGENTS.md`.

**M5. The compute budget fits only with an ordered plan.** CogniPilot wall time is about 6.8 seconds per simulated second, and a mission lasts lap time plus 43 s. A 15-run confirmation is about 2.2 hours.

| Plan | CogniPilot flights | Time |
| --- | --- | --- |
| Lean: bracket both modes, one 15-run confirmation | about 32 | about 5 h |
| Existing search, both modes, first confirmation passes | about 54 | about 9 h |
| Existing search with Betaflight-style fallback | about 142 | about 23 h |
| Full on/off confirmation at every grid point from 30 to 40 s | 330 | about 50 h, not realistic |

Betaflight adds about 47 minutes for lead off, or up to about 5 hours for both modes in full. Supply depends on uptime: about 275 usable flights at an assumed 60 percent uptime, about 83 if only nights are available. Stalls are not yet root-caused (`docs/optimization-sequence.md:7,33`). The Mac must stay awake on power, because sleep could trip the 30 s wall watchdog (inference, not tested).

**M6. The search code implements the old rule.** A pass requires `report.passed`, which includes landing (`patches/cerebri-rdd2-benchmark.patch:6340`). A landing failure stops the descent during screening and costs another 15 flights during confirmation.

* Each attempt stores tracking, clamps, geometry and landing separately, so attempts can be re-scored without new flights.
* The one gap is a screening flight that failed only on landing, where nothing faster was tried.
* A scoring tool must not be workspace Python (`AGENTS.md:28`). Browser JavaScript, `jq` or project-native Rust are allowed.

**M7. The runners differ between campaigns (one lens rated this Blocker).** The fix is cheap: rerun Betaflight on `f2ef29` at 32 and 33 s, about 35 minutes. Otherwise disclose the difference on the results slide. `docs/betaflight-protocol-study.md:14` already sets this standard. Encouraging, but not proof: Betaflight at 40 s no noise was numerically identical under runners `8faf4e` and `7c9ade`.

**M8. "Faster" will be misheard (comprehension).** The audience may hear CPU speed, race lap time or vehicle limit.

* Say "shortest commanded lap schedule on one 47 m figure-eight that both stacks can follow within 0.75 m worst-case error at K = 6/s".
* The limit is the gate, not the vehicle: tilt peaks near 14 degrees against a 35-degree limit.
* The error is same-time error, so a drone on the path but late fails.
* Do not show wall time (133 s against about 545 s). It invites "CogniPilot is four times slower".
* The dashboard title "Making CogniPilot more competitive" (`docs/research/index.html:7`) primes a bias reading. Consider changing it for this talk.

**M9. Do not overclaim the 15 runs.** Say "11 distinct flights across assumed noise levels". At 33 s, RMS varies only from 0.2874 to 0.2893 m across all noise, so noise tests tracking very little.

**M10. The shared control loop may be most of the error.** An old ideal-attitude run at 40 s has a maximum of 0.4813 m, against 0.4919 m for CogniPilot and 0.5071 m for Betaflight. That run is stale (K = 2, different hashes). A rerun at K = 6 on current hashes takes seconds of wall time if the native path still works. If the gap stays small, the honest message is that stack choice moves the limit by little.

**M11. Evidence layout (structural).** Keep one source of truth:

* One rule file beside the data, for example `docs/results/arm-speed/speed-rule.json`. The runner's `predeclared-rule.json` is a precedent.
* A `cognipilot-attempts.json` in the same format as the Betaflight file.
* Verdicts derived from rule plus attempts at render time. Do not type them by hand.
* Use one matrix per stack and lead mode, with cell states: pass, tracking fail, landing fail, incomplete, not run.
* `docs/arm-speed.js:4` hardcodes Betaflight. Captions in `docs/research/index.html:6,10` and the static `speed-and-landing.svg` must be changed or they will contradict the verdict.

**M12. Incomplete flights.** A stalled or truncated flight counts as neither pass nor fail. Rerun the same cell, with a stated retry limit, retain it and publish the stall count (`docs/optimization-sequence.md:9`).

**M13. "Steps to get there" may have little measured behind it.** Lead mode is the only setting that can be changed without a rebuild. Split the slide into measured steps and untested ideas, each with the measurement that would test it. Express the gap in centimetres at the next grid point. Onboard changes stay in separate configurations (`docs/optimization-sequence.md:27`).

**M14. What triggers the `AGENTS.md` rerun and publish rules.**

| Change | Rerun or republish needed? |
| --- | --- |
| Re-scoring existing reports | No flights. Labels must change. |
| Lead off or new lap times, same binaries | Refresh `docs/replay/source.html` and `index.html` from the actual trajectory if a new flight is presented. Update dates and provenance, and verify GitHub Pages. |
| A flight that passes tracking but fails landing | Label it. Never animate a landing absent from the recording. |
| Host watchdog or search-order change | Not flight logic if traces are proven identical. Disclose the hash. |
| Read-only observer | No, if a byte-identical trace is shown. Only Betaflight has shown this. |
| Firmware or adapter telemetry | Yes. Full rerun on both stacks. Do not do this week. |
| K change | Yes. Do not do this week. |
| OneShot125 as the Betaflight baseline | Yes, adapter timing. Needs 15 confirmations. |

**M15. Prepared answer for the native gap.** Someone will ask why Betaflight went from 26 s native to 33 s on ARM. Answer: firmware and target differ, native is a different experiment, and it is excluded from the ranking.

#### Nit

* Do not present the 0.004 m RMS difference at 35 s as a finding. It is one CogniPilot flight.
* The `omega_*_us` and `alpha_*_us` columns in `trajectory.csv` are legacy neutral values. Do not plot them as lead.
* `docs/arm-benchmark-integration.md:89` still says Betaflight runs on STM32F405. `docs/betaflight-protocol-study.md:1,24` says no flight has completed, and a OneShot report exists. Mark or fix them before citing them.
* 31 s was never flown because the search stops at the first failure. Say "shortest passing 33 s, failed at 32 s, tested grid only".
* State that reproduction is possible from retained sources only, because clean setup is blocked (`docs/fastdyn-source-recovery.md:28`).

### Where the lenses disagreed

| Topic | Positions | How this brief treats it |
| --- | --- | --- |
| VM first or rule first | One lens said inspect and log the VM first. The others said commit the rule first. | Commit first. It takes minutes and removes the conflict. |
| Step probes at K = 6 on ARM | Three lenses favor running them. Zoom-out and readiness would cut them. ARM support is unverified. | Run only if no rebuild is needed; otherwise disclose. |
| OneShot125 | Design: a required fairness variable. Readiness: small labelled check. Structural and zoom-out: leave it out. | Open decision for the author. |
| Rerun Betaflight on the new runner | Most: rerun a subset. Readiness: optionally rerun all. | Rerun a subset first. |
| First flights | Readiness: Betaflight first, because it is cheap. Zoom-out: CogniPilot lead off first. | Betaflight lead off first. It takes under an hour and sets the target. |

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * A written rule, committed before the unread CogniPilot results are opened.
  * A win, tie, loss or inconclusive verdict for the four combinations of stack and lead mode, under that rule.
  * A separate landing table, with the original full-mission result shown beside the tracking result.
  * A measured description of where the attitude response differs, with causes marked as not measured.
  * Accurate disclosure of timing rates and of the Betaflight setup.
  * Measured steps toward a win, separated from untested ideas.
  * Every failed and incomplete attempt retained and shown.
  * Replay and GitHub Pages updated from actual recordings if new flights are presented.
* **Out-of-Scope Non-Goals:**
  * Hardware timing, jitter or physical flight claims.
  * Any firmware change or firmware telemetry this week.
  * Tuning K or changing K on ARM this week.
  * Fixing Betaflight landing, or finding its root cause.
  * Clean FastDyn reproduction.
  * ArduPilot and PX4.
  * Global maximum speed or race-gate lap time claims.
  * A CogniPilot observer equivalent to the Betaflight yaw observer.

## Alternatives Weighed

* **Requiring landing inside the speed pass rule.** Rejected by author: landing is scored separately.
* **Maintainer attribution.** Rejected by author: the work names no maintainer.

The options below are reviewer recommendations for the author to confirm. They are not author decisions.

* **Confirming all 15 runs at every lap time in both modes.** Proposed rejection: about 330 CogniPilot flights and 50 hours, which leaves no time for analysis.
* **Adding instrumented firmware to explain the cause.** Proposed rejection: it changes the binary hashes and forces a full rerun for both stacks.
* **Requalifying or sweeping K on ARM.** Proposed rejection: CogniPilot needs a rebuild per gain, and changing K triggers the rerun rule. A native sweep can be a separately labelled next step.
* **A tie-breaker on RMS or a finer grid after a tie.** Proposed rejection: either would be a new rule written after the data was seen.
* **Dropping lead off to save time.** Proposed rejection: it is the most likely way to separate the stacks, and the native result shows lead-on alone does not show CogniPilot's best.
* **Leading with paired same-speed error and no lap-time verdict.** Partly adopted: show that error beside the verdict. The audience still asked a lap-time question, so the verdict stays.
* **Using the unread hardened results as they are.** Proposed rejection: that search used the landing-inclusive rule, and landing failures may have stopped its descent. Re-score it and fill in the missing cells.
* **Using the old `tilt-lead/fastdyn/betaflight` run for lag.** Proposed rejection: it is the STM32F405 build.

## Key Decisions & Staging for Next Steps

### Decided by the author

* The definition of faster, the gates, the 1 s grid, the 15-run set and the better-of-lead rule.
* K = 6/s for both stacks.
* Equal times are a tie.
* Landing is scored and reported separately.
* Simulation-only claims.

### Open decisions for the author

| Decision | Reviewer recommendation |
| --- | --- |
| Wording that reconciles this result with `docs/simulation-qualification.md:24,47` | Two named results, and "under this stated rule" in the headline. |
| OneShot125 | Keep PWM as the primary. Add a small labelled OneShot check at 31 to 33 s, about 11 minutes, that can only downgrade a win to "marginal". Read back the real loop rate. |
| Is a tie a "not faster" result? | Yes. Follow the "steps to get there" branch. |
| Stop at first tracking failure, or fly all 15 | Stop early at failed candidates, for both stacks. Fly all 15 at the selected time. |
| Runner parity | Rerun Betaflight 32 and 33 s on `f2ef29`. |
| What counts as a "marginal" win | A win whose verdict flips if the maximum-error gate moves by plus or minus 0.02 m. Reported as description, with the 0.75 m gate unchanged. |
| Search runner | Use the unmodified runner and re-score, unless the measured failure rate is above about 2 percent. Then add per-cell retry to the Rust search and prove traces are unchanged. |

### Staged plan

**Stage 0, Monday 11-09 evening to Tuesday 11-10 morning: secure the rule and the data.**

1. Commit the versioned rule, the definition sentence and the tie sentence, before reading any VM results.
2. Start the VM. Confirm that no coordinator or QEMU has resumed. Check free disk.
3. Copy the hardened and legacy campaign folders, logs, `src/` and FastDyn bundles to the Mac unchanged, with hashes.
4. From the logs, compute the stall rate, real time per flight and hashes. Check whether each flight kept `tilt-lead.csv` and whether the hardened search reached a usable lead-on set.

**Stage 1, Tuesday 11-10: cheap cells.**

5. Betaflight lead off, using the same search order.
6. Betaflight 32 and 33 s on runner `f2ef29`, with a trace comparison.
7. Rerun the ideal-attitude case at K = 6 on current hashes.
8. Compute the 40 s lag from the matched pair, against both the reference tilt and the final command.
9. Go or no-go, Tuesday night: if CogniPilot flights are not producing results, fall back to both modes at 32 and 33 s, plus 15 runs on the better mode.

**Stage 2, Tuesday night to Thursday 11-12: CogniPilot.**

10. CogniPilot lead off, screening down from the coarse grid, then refined to 1 s. Declare in advance that any landing-only screening stop is followed by extra flights.
11. CogniPilot lead on, unless a valid set already exists on the VM.
12. 15-run confirmation at the shortest candidate. Fall back only on tracking failure. Keep every attempt.

**Stage 3, Friday 11-13: freeze and score.**

13. Data freeze at noon. No new flights after this, except reruns of incomplete cells.
14. Run the scorer. Produce the 2-by-2 table, the error curve, the landing table and the margins.
15. Compute lag at the deciding lap times if the logs exist.

**Stage 4, Saturday 11-14 to Sunday 11-15: publish and prepare.**

16. Update the qualification text, the dashboard, the state file and the captions together.
17. Refresh the replay from actual trajectories, keep the final sample, and verify GitHub Pages once.
18. Write the three required slides: definition and rule, verdict and landing table, where the difference appears and what is not measured.

### If the campaign is only partly finished

| Outcome | What the presentation says |
| --- | --- |
| No new CogniPilot data | Betaflight 33 s tracking, provisional. One paired 35 s comparison. "Unresolved." Show the 40 s lag pair and the plan. |
| Screening done, confirmation partial | Report brackets per stack and mode, labelled unconfirmed. No winner. |
| One mode confirmed | Answer for that mode only. Mark the other as pending. |
| All confirmed | The 2-by-2 table, a tie or winner by the committed rule, and a separate landing table. |

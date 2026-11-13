# Drag Feedforward in the Shared Position Loop: What the Model Test Shows and What to Say in the Talk

* **Author:** Lohen Chen
* **Date:** 2026-11-13

## Overview

On 2026-11-13 a model-only test was run on the shared benchmark loop. It used Rumoca and the real shared Modelica blocks, but no firmware and no noise, with one run per case. The results are in `/Users/lohenchen/Desktop/pure-model-lead-20261113/RESULTS.md`. The test asked why path tracking is worse with offboard tilt lead on than with it off.

Terms used in this brief:

* **Tilt lead.** An extra tilt added to the stick command, equal to the planned tilt rate divided by the attitude gain K (K = 6/s).
* **Attitude lag.** The attitude follows a tilt command about 1/K = 167 ms late. The recorded runs show 150 to 192 ms.
* **Drag feedforward.** Telling the position loop in advance how much air drag to push against, here using the plant's own drag formula at the planned speed.
* **Gates.** The pass limits: worst position error below 0.75 m, RMS error below 0.35 m, no tilt-clamp events, and correct course geometry.

The author's hypothesis has three parts:

1. Lead-on tracking is worse because the shared position loop does not account for drag.
2. The attitude lag happened to cancel part of the drag error, which is why lead off looked better.
3. Adding drag feedforward cut the lead-on worst error at the 33 s lap from 0.774 m to 0.359 m. In single noise-free model runs it stayed under the worst-error and tilt limits down to a 22 s lap, the shortest lap tried.

The proposal is to present this in the research talk (about 2026-11-16) as the "step to get faster". Adding drag feedforward to the shared loop for both CogniPilot and Betaflight would come later.

All seven reviewers came to the same main conclusion:

* The model supports a narrower claim than the one proposed. In this model, drag error and lag error point in opposite directions and partly cancel. The tilt lead removes the lag error as designed, which leaves the drag error exposed.
* That is a useful finding for one slide.
* The model does not show that drag is the only cause. It does not rule out firmware, because it contains none.
* "Measured" is the wrong word. These are model results.
* The 22 s figure cannot be presented as a lap result. The margin is 0.026 m, and RMS and the other gates were not checked.
* Any change to the shared loop is a new experiment under a new rule. It is not a fix to apply before the talk.

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

Limits on what was checked:

* No reviewer could read the a41f7c0 source that the runs used, or the firmware under `src/`, which is not checked out.
* No reviewer parsed the output CSVs. The direction of each error and where along the lap it happens are taken from RESULTS.md and not rechecked.
* Arithmetic in this brief that is not in RESULTS.md is reviewer arithmetic, not new runs.

### What the evidence does support

* **The harness uses the real shared blocks.** These are `Benchmarks.Trajectory`, `PositionLoop` and `Feedforward`, plus the full RDD2 plant with a prescribed attitude. The lead is added to the stick the same way as in the flown runner (`patches/cerebri-rdd2-benchmark.patch:4841-4854`; `LeadIsolation.mo:44-45`). Position feedback is plant truth in both (codebase-details).
* **The drag feedforward formula is correct.** Its form, frame, sign and coefficients match the plant (`QuadrotorPlant.mo:40-42,135-136`; `drag-comp/LeadIsolation.mo:9-12,37-40`). The QEMU benchmark plant carries the same coefficients (`docs/evidence/four-stack-2026-11-06/modelDescription.xml:173,176`). No wiring bug was found that changes 0.774 → 0.359 m (codebase-details).
* **Drag is needed for the lead-off advantage.** Without drag, lead on beats lead off (0.312 vs 0.534 m). With drag, the order flips (0.774 vs 0.520 m) (`RESULTS.md:40-43`).
* **The cancellation story makes a correct prediction.** At shorter laps, adding drag feedforward to lead-off runs makes them worse (27 s: 0.837 vs 0.718 m), because it removes the drag error that the lag was offsetting (`RESULTS.md:69`; structural).
* **The lead works as designed.** Lead × K matches the tilt-target rate (0.96–1.03), and the recorded runs show only 2–42 ms between the target and the actual attitude (`RESULTS.md:49-50`; `attitude-lag-33s.json`).
* **A rough size check fits.** The expected along-track lateness is about the drag acceleration divided by the position gain: 0.61 / 1.5 ≈ 0.41 m. That is close to 0.704 − 0.290 m (codebase-details, inventive-catalyst, structural). This is a rough check, not a proof.

### Risks

#### Blocker

**B1. "Caused by drag, not by attitude delay or firmware" claims more than the model shows (all seven lenses).**

* The model has no firmware, so it can show only that firmware is not needed to reproduce the pattern. It cannot rule firmware out.
* The lag is a real error in its own right. With drag off, lag and no lead still give 0.534 m, with the drone ahead of the reference.
* Three numbers show that drag is not the only error source:
  * With ideal attitude and drag off, error is still 0.290 m (see M2).
  * Drag feedforward with lead on leaves 0.359 m, which is above the 0.312 m of the no-drag case.
  * Feedforward helps lead-on runs but hurts lead-off runs at short laps.
* Lead and feedforward are needed together.
* Supported wording: "In the model, drag error and lag error partly cancel. The lead removes the lag error as designed, which exposes the drag error the loop does not account for."

**B2. "Measured" and "22 s" cannot go in the talk as results (all seven lenses).**

* Every feedforward number comes from one noise-free model run per case (`RESULTS.md:73`). The model leaves out noise, the 250 Hz stick schedule, the estimator, filters and the rate loop (`RESULTS.md:26`).
* At 22 s the worst error is 0.724 m against 0.75 m, a margin of 0.026 m.
* That margin is smaller than the 0.04–0.07 m gap between the model and the QEMU runs. That gap was measured only at 33 s and only without feedforward, so it cannot be carried over to 22 s.
* Where the two can be compared, they give different verdicts. At 33 s with lead on, the model fails (0.774 m) and the QEMU runs pass (0.70–0.73 m).
* The lap table has no RMS values, although RMS is a gate. It also has no tilt-clamp count, geometry check or center-return check.
* "Peak tilt 29.8°" appears to be the actual attitude. The runner counts a clamp on the stick command including lead, which is larger (`cerebri-rdd2-benchmark.patch:4845-4848`; codebase-details, structural).
* 22 s is the shortest lap tried, not a limit that was found.
* Under the committed rule, "faster" means 15 of 15 QEMU runs across three noise levels (`speed-rule.json:5,36-40`). This result has none of that.
* "Flights" in RESULTS.md:5 and :60 means QEMU firmware simulation, not hardware. An audience will hear "real drone" unless told otherwise (comprehension, implementation-readiness).

**B3. Adding drag feedforward to the shared loop cannot fit inside the committed rule (design, zoom-out, structural, implementation-readiness, codebase-details).**

* The rule fixes `offboard_sha256` and `base_config_id ...-v3`, and allows only firmware and feedforward mode to differ between runs (`speed-rule.json:9,14,22`).
* It also forbids changes after any run is observed (`:52`), and the data freeze is 2026-11-14 12:00 (`:87`).
* A shared-loop change creates a new configuration. It would need a new rule committed before any run with drag feedforward.
* Under AGENTS.md it would also trigger every native rerun, a replay refresh, landing checks and a Pages publish.
* None of this fits before the talk.

**B4. The scratch folder cannot reproduce its own tables (design, codebase-details, implementation-readiness, structural, inventive-catalyst).**

* The top-level `LeadIsolation.mo:12` and `LeadCases.mo:10-15` pass `pos(forceFraction = ...)`. RESULTS.md:29-30 says this crashes every run, so these files did not produce `out/` (`orig/LeadIsolation.mo` probably did).
* There is no harness for the drag-off cases, so how drag was zeroed is not recorded.
* `modelica-report-fixes.patch` is cited but not in the folder.
* Not recorded: the Rumoca binary hash, the exact commands, the end time for each case (end times changed on crash retries), and a hash for each CSV.
* The Desktop `modelica_models` clone does not match the run base:
  * `Vehicles/Rdd2/LogLinearController.mo:7-9` sets position and velocity gains {3,3,4} and {3.5,3.5,4}, against the `Controller` defaults {1.5,1.5,2} and {2.2,2.2,2.5} (`LogLinear/package.mo:302-303`).
  * The shared-position patch will not apply to this clone (codebase-details).
  * Which gains a41f7c0 and the flown generated C actually use is unverified. This matters because the size of the drag error scales inversely with the position gain.

#### Major

**M1. Perfect knowledge of drag (all seven lenses).**

* The feedforward copies the plant's exact coefficients, uses ground speed as airspeed (there is no wind), and uses the true attitude.
* So 0.359 m is a best case for the benchmark plant. It says nothing about hardware.
* The plant's own drag values are assumptions, and measuring drag is listed as future work in `docs/cognipilot-speed-experiment.md:11`.
* No test was run with wrong coefficients (for example 0.5× and 1.5×).

**M2. The 0.29 m error left with ideal attitude and no drag is unexplained (all seven lenses).**

* With near-ideal attitude, no drag and lead off, worst error is 0.290 m (`RESULTS.md:41`). That is about 37% of the 0.774 m case and is larger than some of the gains being claimed.
* Candidates, none tested:
  * Integral windup during the climb. `pos.engage = true` from t = 0 (`drag-comp/LeadIsolation.mo:30`), so the integrator runs through the ground start and the climb to 2 m before the lap begins. With Ki = 0.05 it decays slowly (codebase-details, likely).
  * Motor lag of 12.5 or 25 ms.
  * The 100 Hz sample-and-hold.
  * The heading-only reference attitude mixing horizontal error into vertical error.
  * Height error inside the 3D error.
* Until this is split up, no one can say drag is the main remaining term at 22 s.

**M3. Drag feedforward is not the same as removing drag (structural).**

* With feedforward, the drone feels the drag at its actual speed minus the drag at the planned speed. That leftover acts as extra damping on speed error.
* This is why ideal attitude with feedforward (0.271 m) beats ideal attitude with no drag at all (0.290 m).
* A control case is missing: drag off, feedforward on. It would separate the two effects.

**M4. The lead does not include the change in the drag term (design, codebase-details, inventive-catalyst, implementation-readiness, comprehension).**

* The feedforward is added only to the reference acceleration. The lead is still computed from the trajectory's own jerk and snap (`modelica-shared-position.patch`, Feedforward block lines 86-89), so the rate of change of the drag term is never led.
* With feedforward on, lead × K no longer equals the tilt-target rate.
* RESULTS.md does not say which case the 0.96–1.03 lead check used.
* This also bears on qualification item 2.4, integrated feedforward consistency (`docs/simulation-qualification.md:16-17`).

**M5. "Affects both stacks equally" is not shown (all seven lenses).**

* The input is the same for both stacks. The effect depends on how much lag each stack has left over:
  * Betaflight pitch command-to-actual: 150–190 ms; CogniPilot: 172–192 ms.
  * Reference-to-actual: 2–42 ms against 12–42 ms (`attitude-lag-33s.json`).
* The matched-pair gaps between the stacks at 33 s are only 0.008–0.025 m, and the feedforward changes errors by about 0.4 m. It could reorder the stacks.
* It could also change which lead mode is each stack's better cell, and the rule scores each stack by its better cell (`speed-rule.json:70`).
* Firmware drag compensation is unverified (`src/` is absent), but neither stack can see the position reference. Both receive angle-mode sticks only, with no onboard feedforward allowed (`simulation-qualification.md:3`).
* Two things to confirm are off: Betaflight's `patternVelocityFeedforward` and CogniPilot's legacy `reference_lead_s` (codebase-details).

**M6. The wrong baseline: the model's own lead-off result already reaches 27 s (zoom-out, structural, comprehension, codebase-details).**

* Lead off without feedforward passes the worst-error limit at 30 s (0.606 m) and 27 s (0.718 m) (`RESULTS.md:68-69`).
* So the model's gain from feedforward is 27 → 22 s, not 33 → 22 s.
* The lead-off searches already in the rule may beat 33 s with no code change.

**M7. Timing against the blind lead-off searches (design, zoom-out, implementation-readiness, inventive-catalyst, structural).**

* The lead-off runs below 33 s are the only blind part of the rule (`speed-rule.json:82-84`).
* Showing a drag story before they are scored can look like an after-the-fact explanation of why lead off won.
* The model also makes a lead-off prediction that can be checked: pass at 27 s, fail at 25 s, about 0.04 m pessimistic. A written, timestamped prediction made before those results are seen is a free test of whether the model carries over to firmware.

**M8. The model does not prove the result carries over to QEMU (design, structural).**

* Agreement on two numbers, one per lead mode, shows consistency, not cause.
* The model uses a first-order lag, while the recorded fits are a pure delay. Codebase-details estimates the size difference on this course at under 1%.
* No one has checked whether the error in the QEMU runs is also along-track lateness.
* Test proposed by design: one labelled QEMU diagnostic pair with plant drag set to zero. The model predicts the lead-on/lead-off order reverses.

**M9. Where to put the feedforward is undecided, and two of the obvious places break existing checks (implementation-readiness, design, inventive-catalyst, zoom-out).**

* Inside `Trajectory`, it fails the analytic acceleration check (`cerebri-rdd2-benchmark.patch:4561-4563,4672`).
* Inside `PositionLoop`, it fails the `PositionOracle` equivalence check (`:4642-4653,4676`).
* Written by hand in the Rust runner or C shim, it breaks "all controller mathematics from generated C" (`:4727`).
* Moving it out of the loop does not avoid regeneration or the reruns, because `offboard_sha256` covers both blocks (inventive-catalyst).

**M10. Cost and missing plan (implementation-readiness, design).**

* A full adoption needs: patch update, regeneration with `xtask shared-loop-check`, the ideal-attitude checks, native reruns for both stacks, and a four-cell campaign of sequential QEMU flights. Design estimates roughly 250 flights, and the Betaflight PWM campaign alone took 66 attempts.
* It also needs landing checks, with Betaflight PWM landing failures expected again, and a replay and Pages refresh.
* No owners, stage gates or stopping rule are named.

**M11. Raising the position gain is another lever (codebase-details).**

* Drag lateness scales roughly with 1/kp.
* The talk should not present feedforward as the only way to reduce it.

#### Nit

* **The peak speed in RESULTS.md is wrong** (codebase-details, inventive-catalyst; also my own check). "Reference peaks about 2.7 m/s" (`RESULTS.md:58-59`) should be about 4.0 m/s at 33 s, and about 6 m/s at 22 s. The stated 0.61 m/s² peak feedforward matches 4.0 m/s, not 2.7. Confirm from `traj.velocity` in a CSV.
* **Two different "0.29 m" values.** 0.290 is a worst error (`RESULTS.md:41`) and 0.291 is an RMS (`:36`). Name the case and the measure each time.
* **The near-ideal attitude, lead-on row** (1.010 m) adds a lead where there is no lag to cancel. Label it as an over-lead control, not evidence.
* **Reported tables leave out runs.** Lead 0.25 and 0.75 were run but not reported. The lead 0.5, drag-off CSV exists, but its row is missing.
* **Disabling the lead also disables the alpha feedforward.** `pos.feedforwardEnabled = leadScale > 0` turns it off in lead-off runs (`drag-comp/LeadIsolation.mo:31`). Harmless here, but state it.
* **The forceFraction check covered one case only.** It tested 33 s without feedforward. It was not repeated for feedforward or short laps.
* **"Peak motor command 0.74 at 22 s"** does not name the case.
* **speed-rule.json:3 still says "DRAFT ... Not in force until committed"**, and its open decisions (`:95-99`) are still listed, although commit 4b20b6c added the file. Reconcile this before the talk cites the rule.
* **"Today 33 s" needs its basis.** It is lead-on, tracking only, and Betaflight has landing failures. `simulation-qualification.md:47` says not to report 33 s as a confirmed reliable speed.
* **The talk needs a one-line glossary**: tilt lead, K, stick command, shared position loop, feedforward, gates, and "lap" meaning a planned schedule.

### Where the lenses disagreed

| Topic | Positions | How this brief treats it |
| --- | --- | --- |
| Show 22 s at all | Zoom-out: drop it. Others: only on a slide marked as a model-only projection. | Recommend leaving it out. If used, it must carry every qualifier in B2 (open decision). |
| Fit drag from existing recordings | Inventive-catalyst: fit drag from the recorded runs, with no new flights. Implementation-readiness: `trajectory.csv` has no velocity or acceleration columns, and the fit can only return the plant's own assumed values. | A fit can check that the QEMU plant matches the Modelica plant, but it cannot measure real drag. It needs extra logged signals first. |
| Where the feedforward lives | Design, inventive-catalyst: in the reference layer, with matching jerk and snap. Implementation-readiness: a new generated `DragFeedforward` block feeding the summed reference input. | These fit together: a separate generated block computed from the reference, which also outputs the jerk term. Decide this in the new rule, not now. |
| Severity of the Desktop clone mismatch | Codebase-details: Blocker for reproducibility. Others: Major. | Blocker (B4) for presenting numbers, because the gains set the size of the drag error. |

### Proposals from the inventive and design lenses (proposals, not author decisions)

* **Turn the data freeze into a test.** Before the lead-off results are opened, write down the model's lead-off prediction with a timestamp. A correct prediction is the strongest evidence available for the talk. A wrong one shows where the model fails.
* **Test the drag hypothesis on recorded QEMU runs, with no new flights:**
  * *Phase test.* Drag error should peak at peak speed (the center crossing). Lag error should peak at the turn apexes.
  * *Size test.* Regress along-track error on planned speed and on planned acceleration.
  * *Scaling test.* Compare across the Betaflight 40, 35, 34, 33 and 32 s runs. Drag error grows more slowly with shorter laps than lag error does.
* **Run model sweeps as extends-modifiers**, which work, to avoid the crashing PositionLoop modifier:
  * Feedforward scale {0, 0.5, 0.8, 1.0, 1.2, 1.5}.
  * Lag {150, 170, 190 ms}.
  * Laps {22, 20, 18 s}.
  * Report the margin as a range across the sweep.
* **An integral term or disturbance observer** is a later option for hardware, where drag really is unknown. The current integrator (Ki = 0.05, about a 30 s time constant) cannot absorb drag.
* **Plan for hardware drag measurement (deferred).** Fly constant-speed straight passes at several speeds in each direction, indoors with no wind. Log motion-capture velocity, the body x/y accelerometer and attitude. The fit must include rotor drag, which the plant does not model. No airframe, owner or logging setup exists yet.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * One honest slide on the model diagnosis: drag and lag partly cancel, and the lead removes the lag as designed. Use the wording in B1, the word "model" throughout, and the required scope wording from `speed-rule.json:89-92`.
  * Keep the committed rule and the in-progress lead-off searches exactly as they are until the data freeze.
  * A written, timestamped model prediction for the lead-off searches, made only if those results are still unseen.
  * A reproducibility record for the scratch study:
    * the base commit and the gains it used, both patches, and the Rumoca binary;
    * for each CSV: the model file hash, the command and the end time;
    * how drag was zeroed in the drag-off runs.
  * Small model checks before any number goes on a slide:
    * RMS and stick-command tilt for every lap case;
    * the drag-off, feedforward-on control case;
    * 0.5× and 1.5× drag coefficients;
    * the lead check repeated with feedforward on;
    * one rerun with the integrator starting when the lap starts.
  * Correct the peak-speed line in RESULTS.md.
* **Out-of-Scope Non-Goals:**
  * Any change to the shared loop, offboard hash or benchmark config before the talk.
  * Any lap-time claim from the model, including "22 s".
  * Any claim about hardware drag or physical speed.
  * Claiming that firmware is ruled out, or that both stacks benefit equally.
  * Mixing results with and without drag feedforward in one ranking.
  * Tracing the 0.29 m error to its source before the talk, beyond the single integrator rerun.
  * Hardware drag measurement flights.

## Alternatives Weighed

The author's concept proposes two things: present the result as the "step to get faster", and later add drag feedforward to the shared loop. Every option below is a reviewer proposal for the author to confirm. None is an author decision.

* **Present "measured step to get faster, 33 s to 22 s".** Proposed rejection:
  * The results are model output from single noise-free runs.
  * The 22 s margin (0.026 m) is smaller than the known gap between model and QEMU.
  * RMS and the other gates were not checked.
  * The rule's required wording does not allow it.
  * The fair baseline is the model's own lead-off result of 27 s, not 33 s.
* **Add drag feedforward to the shared loop before the talk.** Proposed rejection:
  * It changes the fixed offboard hash and config.
  * It voids both completed campaigns and the blind lead-off searches.
  * Under AGENTS.md it triggers a full rerun and republish, which cannot finish in three days.
* **Put the feedforward inside `Trajectory`.** Proposed rejection: it fails the analytic acceleration check in `shared-loop-check`.
* **Put the feedforward inside `PositionLoop`.** Proposed rejection: it fails the `PositionOracle` equivalence check. It also ties the plant's coefficients into a generic controller block.
* **Write the feedforward by hand in the Rust runner or C shim.** Proposed rejection: it breaks the rule that all controller mathematics come from generated C.
* **Keep the feedforward on measured attitude.** Proposed rejection for any future version:
  * It puts the attitude estimate into what should be a reference-only path.
  * It differs per stack.
  * Rotating by the planned attitude costs little error below 30° of tilt and keeps the input identical for both stacks.
* **Raise the integral gain to absorb drag.** Proposed rejection for now:
  * It amplifies noise and can interact with the lead.
  * It adds a tuning value that the rule would have to freeze.
  * Keep it as a hardware-era option.
* **Fit "real" drag from the existing `trajectory.csv` files.** Proposed rejection as a drag measurement:
  * The files have no velocity or specific-force columns.
  * Any fit would only return the simulated plant's assumed values.
  * It is still useful to confirm that the QEMU plant matches the Modelica plant.

## Key Decisions & Staging for Next Steps

### Decided by the author

* Shortest-lap definition, gates, K = 6/s and lead modes, as fixed in the committed rule (`speed-rule.json`).
* Simulation-only claims.
* Drag feedforward in the shared loop is "consider later", not planned work.

### Open decisions for the author

| Decision | Reviewer recommendation |
| --- | --- |
| Headline wording for the talk | "Model diagnosis," not "measured step." Use the B1 wording, and name the 0.29 m remaining loop error as not yet traced to a source. |
| Show 22 s at all | Leave it out. If shown, label it: model only, no firmware, no noise, exact drag, one run, margin 0.026 m, RMS unchecked, shortest lap tried. |
| Pre-register a lead-off prediction | Yes, if lead-off results are still unseen. Otherwise state that any comparison was made after the results were seen. |
| Gains used at a41f7c0 | Check with `git show a41f7c0:Control/Multirotor/LogLinear/package.mo` and against the flown generated C before quoting any model number. |
| Whether a future drag-feedforward rule is wanted | Only after the model checks show the gain survives wrong coefficients and the control case. If yes, write rule version 2 with config `...-v4` and commit it before any run. |
| Wait for the lead-off freeze before any v4 work | Yes. Keep all v4 code and config away from the VM until after 2026-11-14 12:00. |

### Staged plan

**Stage 0, before 2026-11-14 12:00 (freeze).**

1. Do not change the VM, config or rule.
2. If lead-off results are unseen, commit a timestamped model prediction for the lead-off cells: pass at 27 s, fail at 25 s, plus the stated model bias.
3. Fix the DRAFT status line in `speed-rule.json` if the rule is in force.

**Stage 1, 2026-11-13 to 11-15: make the scratch study checkable.**

4. Record the run manifest: base commit and gains, both patches, Rumoca hash, and for each CSV the model file, command, end time and hash. Record the drag-off method.
5. Export from the existing CSVs:
   * RMS for each lap case;
   * stick-command tilt including lead;
   * along-track, cross-track and vertical error, and the time of the worst point;
   * peak reference speed.
6. Run a few new model cases, retrying any Rumoca crash with a different end time and logging every retry:
   * the drag-off, feedforward-on control case;
   * feedforward at 0.5× and 1.5×, at 33 s and 27 s;
   * the lead check with feedforward on;
   * one rerun with the integrator starting when the lap starts.
7. Correct the peak-speed line in RESULTS.md.

**Stage 2, the talk (about 2026-11-16).**

8. Show the committed-rule result in its required wording, separately from the model.
9. Show one model slide with three error-along-the-lap curves: lag with drag, lead with drag, and lead with drag and feedforward. Add one sentence on why the lag puts the drone ahead.
10. Suggested smallest honest message (comprehension, zoom-out, design and structural converged on this):
    > "In a noise-free model of our shared position loop and plant, with no firmware, the lead-on penalty comes from drag that the loop does not account for. Without the lead, the slow attitude response happened to offset part of that drag error. The lead works as designed. Adding the model's own drag formula to the loop roughly halved worst error at the 33 s schedule (0.77 → 0.36 m), leaving about 0.3 m of loop error not yet traced to a source. This is a hypothesis for the next firmware simulation campaign, under a new rule. No hardware result."
11. Mention that the model's lead-off prediction exists and, if the results are in, whether it held.

**Stage 3, after the talk, only if adopted.**

12. Write and commit rule version 2 and config `...-v4`, with drag feedforward as a declared factor.
13. Add a separate generated `DragFeedforward` block computed from the reference, including its jerk and snap terms. Take its coefficients from one source shared with the plant, enforced by `shared-loop-check`. Add a new oracle test.
14. Acceptance test with feedforward off: the new library must reproduce `confirm-33-none-1` `trajectory.csv` byte for byte for both stacks.
15. Stage gate: one QEMU flight per stack at 33 s, lead on, no noise, with feedforward.
    * Expected: worst error at or below about 0.45 m and mean along-track error near zero.
    * Stop and revisit the drag explanation if the improvement is less than half the model prediction.
16. Full campaign under rule version 2, following the AGENTS.md rules:
    * all native reruns, keeping failed attempts;
    * landing checks;
    * replay refresh from actual trajectories;
    * Pages publish.

    Keep the v3 recordings labelled with their original dates.
17. Hardware drag measurement is a separate later workstream. It needs an owner, an airframe and logging.

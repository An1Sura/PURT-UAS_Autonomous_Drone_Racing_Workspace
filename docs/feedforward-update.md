# Shared feed-forward SIL update

Updated October 13, 2026. This implements the updated PDF’s shared rotation-rate and angular-acceleration inputs for Betaflight ANGLE and CogniPilot ATTITUDE. These are native firmware flights with one generated offboard PositionLoop and the same full-dynamics Rumoca/FMI plant. They are commissioning measurements, not proof that either stack is fastest or that the complete PDF qualification is finished.

## Fixed experiment

One 10 × 10 m figure eight at 2 m altitude in the existing approximate PURT envelope. The final comparison uses a 40 s minimum-jerk reference: 47.147 m path length, 1.179 m/s mean and 3.293 m/s peak reference speed; peak normal acceleration 1.627 m/s² (0.166 g), peak horizontal acceleration 1.654 m/s², tightest radius 0.597 m. These are reference calculations, not measured flight statistics.

Timing is common: estimator warmup 0–8 s, arm at 8 s, takeoff 9–15 s, hover to 25 s, course 25–65 s, end hold to 70 s, descent to 78 s, settle through 83 s. Landing passes only with native disarm, plant height/vertical-speed checks, and stopped motors for at least 0.5 s. Host wall time is not a latency measurement. The displayed 40 s lap is the reference window, not an independently detected finish-line crossing.

Accuracy thresholds remain the previously declared commissioning limits: same-time course position RMS <0.35 m and maximum error <0.75 m. They were not relaxed after examining faster results. A failed accuracy gate remains a failed result even if the drone lands.

## Implementation and source

- `modelica_models/Benchmarks/Trajectory.mo`: analytic position, velocity, acceleration, jerk and snap for the timed figure eight and smooth square legs. These are within-leg derivatives: quintic minimum-jerk joins preserve position, velocity and acceleration, but do not guarantee continuous jerk/snap across holds or square corners; impulsive endpoint terms are not modeled. The discontinuous half-metre position-step diagnostic has zero derivative feed-forward; it is not represented as a differentiable trajectory.
- `Benchmarks/Feedforward.mo` and `normalizeJet.mo`: the PDF expression uses **commanded thrust** and the **desired attitude axes** from the shared position controller, with mass 2 kg. With `v=T*z`, `dv=m*jerk`, and `ddv=m*snap`, differentiating `v/|v|` gives `dz=(m/T)(jerk-z*(z·jerk))`. Body rates are `{-y·dz, x·dz, y·dx}`; the derivative gives body angular acceleration. The snap calculation holds the feedback correction locally fixed; it does not differentiate estimator noise or the integral/feedback state. Reference yaw is fixed at zero for this experiment. Arbitrary changing-yaw trajectories require the corresponding heading derivatives and are not claimed supported.
- `Benchmarks/PositionLoop.mo`: exports bounded rate and acceleration inputs alongside the existing angle/thrust outputs. Generated C, not a second Rust controller, calculates them. The shared-library ABI is versioned to reject obsolete libraries.
- CogniPilot GuidanceController adds roll/pitch rate feed-forward in ATTITUDE mode. It has a separate ATTITUDE gain parameter, initially preserving `{2,2,1}`. RateControlAllocator adds `I*alpha` while retaining its existing proportional and gyroscopic terms. Default-zero inputs preserve existing Modelica consumers. Firmware uses a timestamp-paired local ZROS companion message for acceleration, preserving the upstream Synapse wire schema.
- CogniPilot transport carries zero-index RC channels 6–11 through the six existing ManualControl auxiliary fields and reconstructs normal RC input events. The first trial exposed these channels being dropped; regression coverage now prevents that omission.
- Betaflight `pid.c` adds roll/pitch rate feed-forward **after** its attitude filter and substitutes supplied angular acceleration into the rate-loop F input. Native yaw has the opposite sign to body-FLU yaw. The input is gated by arming, ANGLE mode, receiver validity, failsafe and the FF switch. The existing feedback equations, filters, estimators and mixers are retained.

Channel layout: 6 enable; 7/8 roll/pitch rate at ±4 rad/s; 9/10/11 roll/pitch/yaw acceleration at ±20 rad/s². One integer PWM unit represents 0.008 rad/s or 0.04 rad/s². Both stacks use the same channel encoding. Off, disarmed or inactive commands clear the new channels. Native receiver/failsafe handling remains enabled.

Betaflight’s native `angle_feedforward=0` avoids duplicate angle feed-forward, and `d_max_roll/pitch/yaw=0` prevents the supplied acceleration from also boosting D-max. These settings apply to both off and on comparisons. Thus “off” means the stock feedback path **under the same recorded configuration**, not the historical default configuration.

Betaflight hover throttle was measured from the actual commanded PWM over 30–35 s of the shared-plant hover: **0.6885788423** (501 samples, PWM 1688–1689). This is a closed-loop simulation equilibrium calibration, not a physical thrust-stand measurement. The same frozen value is used for all final Betaflight cells.

Exact changes are saved in `patches/modelica-shared-position.patch`, `patches/cerebri-rdd2-benchmark.patch`, and `patches/betaflight-sitl-lockstep.patch`. See [the repository map](repository-map.md). Native firmware, runner, plant, generated-library and configuration hashes accompany each result.

## Verification and interpretation

Independent finite-difference checks cover jerk, snap, body rates and angular acceleration against generated single-precision code. PositionLoop still matches the existing GuidanceController POSITION oracle. These are numerical checks, not a formal floating-point proof or closed-loop stability proof. The historical GNC Lean proof scope is unchanged.

Native Rust regression tests: 47 passed, 2 ignored. Betaflight native PID suite: 16 passed, including new rate/acceleration signs, FF-off and failsafe checks. Executed CogniPilot generated-code checks verify ±4/±20 clamps, off/disarm zeros and all-axis `M=I*alpha` scaling. No hardware-target build or physical props-off test is claimed by these host tests.

At the initial 80 s target, angular acceleration rounded to zero at the specified RC resolution. Rate-only and rate-plus-acceleration therefore produced identical traces. This is why the final diagnostic includes a 40 s reference where acceleration feed-forward becomes representable. On the first final 40 s flights, the delivered acceleration peak was `{0.08,0,0}` rad/s²: this course exercised the roll acceleration channel, while pitch/yaw acceleration still quantized to zero. All-axis generated/native unit tests cover the other hooks; these flights do not validate nonzero pitch/yaw acceleration on hardware. Initial nominal-reference experiments and the dropped-channel CogniPilot attempts are retained as superseded diagnostics, not mixed into final aggregates.

The final diagnostic matrix contains three assumed noise profiles and five seeds for each stack with FF off/on. White-noise standard deviations are `(0,0)`, `(0.002 rad/s,0.03 m/s²)`, and `(0.01 rad/s,0.15 m/s²)`. The approximate normal generator sums twelve uniforms. A common four-motor two-blade harmonic model uses phase rate `2*1100*normalized_motor` rad/s and amplitude one quarter of the corresponding noise standard deviation, scaled by each motor command. Its fixed phase offsets, amplitudes and command-derived frequency are diagnostic assumptions, **not measured motor/IMU spectra**. Each stack’s own motor history drives the same vibration model. Position feedback is plant truth.

Both stacks receive a 1600 Hz common IMU model; Betaflight’s 8000 Hz packet schedule holds those samples, while CogniPilot exchanges at 1600 Hz. Offboard updates are 100 Hz and stick scheduling is 250 Hz. CogniPilot delivery can be quantized by up to 0.5 ms. CogniPilot retains synthetic GNSS in its existing arming/navigation pipeline, while Betaflight GPS is disabled; this remaining sensor-path difference must be resolved or justified before a parity claim. Stack campaigns run concurrently on the host; host execution time is excluded from the comparison. These are not physical latency results or a fully matched timing experiment.

## Remaining PDF qualification gates

Equal-budget attitude step-response tuning and Betaflight Kf ramp calibration are not complete; default feedback/F gains are retained. Native estimated-attitude error, FF-versus-feedback torque share, an independently detected geometric finish, the full speed-limit search, hardware-target builds, physical sign checks and measured receiver/IMU/MoCap timing remain separate work. PURT’s calibrated coverage, obstacle locations and origin still need an on-site survey. The published results must not be used to claim a non-inferiority margin or hardware performance advantage.

## Reproduction

Use the pinned dependencies and complete updated patches. In the normal RDD2 Devenv shell, the project-native commands are:

```sh
cargo build --release --manifest-path src/cerebri_rdd2/xtask/Cargo.toml
src/cerebri_rdd2/target/release/xtask shared-loop-check \
  docs/config/shared-position-benchmark.json src/modelica_models \
  .devenv/state/results/rumoca/bin/rumoca artifacts/shared-loop
```

After building native firmware, run `shared-sil CONFIG PLANT_DIRECTORY GENERATED_LIBRARY BINARY STACK NEW_OUTPUT_DIRECTORY figure-eight SEED NOISE`. Set `controller.feedforward` to `off`, `omega`, or `omega_alpha` in the saved config. Use a new output directory for every attempt. `shared-sil-campaign CONFIG PLANT_DIRECTORY GENERATED_LIBRARY BINARY STACK NEW_OUTPUT_ROOT` executes all 30 off/on cells for one stack and updates `campaign.json` after every attempt. It retains failures and logs instead of stopping at the first loss. Betaflight uses fixed local UDP ports, so run only one Betaflight flight at a time.

After both campaigns and the rate-only diagnostics finish, `shared-sil-export BF_CAMPAIGN CG_CAMPAIGN BF_RATE_ONLY CG_RATE_ONLY OUTPUT` verifies all 60 matrix reports, calculates native motor-command saturation/slew metrics, checks noise-free repeatability, and exports six fixed-seed replays. Replays are reduced to 20 Hz and nine decimal places for the page, with the real final sample retained; reported errors use the original plant-rate measurements. Every cell’s original report and full-resolution traces stay in the VM.

## Published outcome

All 60 matrix flights passed. The six noise-free off/rate/full recordings and exact error table are in [the current rundown](shared-position-benchmark.md). Full feed-forward reduced Betaflight RMS from 0.217412 m to 0.142516 m and increased CogniPilot RMS from 0.188374 m to 0.213908 m at the same 40 s reference. Both stock-parity checks reproduced complete trajectory and actuator traces byte-for-byte. The component checks file retains its original generic pending-gates list; flight completion is established separately by the campaign reports. Its pre-hover-calibration configuration hash differs from flight configs, while the generated library hash is identical. Superseded raw attempts remain in the VM under artifacts/shared-sil.

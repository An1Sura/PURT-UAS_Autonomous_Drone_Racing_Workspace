# What the benchmark mathematics proves

The project now uses CogniPilot's [gnc_lean](https://github.com/CogniPilot/gnc_lean/tree/0c01537b94677d38c0547a72c1dc12a7e87db234) as an actual pinned Lean dependency. The checked statements are in [ADR/Benchmark.lean](../proofs/ADR/Benchmark.lean). They describe exact real-number equations. A passing proof is conditional on its hypotheses and on those equations matching the implementation being used.

## Checked claims

| Benchmark claim | Lean theorem(s) | Assumptions and interpretation |
|---|---|---|
| Same quintic timing polynomial as the implementation | `source_polynomial_matches` | Algebraic equality with GNC's polynomial; no floating-point equivalence claim |
| Phase begins at 0 and ends at 2π | `phase_start`, `phase_finish` | Positive lap duration |
| Phase moves strictly forward through one cycle | `phase_strictly_increases` | Time inside `[0,T]`, `T > 0`; this concerns the reference, not actual aircraft motion |
| Position derivatives are the stated velocity and acceleration | `x_derivative`, `y_derivative`, `dx_derivative`, `dy_derivative`, `timed_x_derivative`, `timed_y_derivative`, `vx_derivative`, `vy_derivative` | Exact analytic chain/product rules |
| Reference starts and ends at rest | `rest_at_start`, `rest_at_end` | End theorem requires positive duration; both velocity and acceleration vanish |
| Figure-eight geometry closes | `closed_curve` | `x=A sin(q)`, `y=B sin(2q)` |
| Reference stays within its half-width and half-height | `x_bound`, `y_bound` | Nonnegative half-axes; yaw specifies aircraft heading, not path rotation |
| Inflated bounds contain a tracking vehicle | `containment` | **Requires** a valid tracking-error bound and measured containing interval; neither is established for PURT by this theorem |
| Scaling size by k scales coordinates and path length by k | `scaled_geometry`, `density_scaling`, `path_length_scaling` | Nonnegative size factor for length; exact integral, not the sampled numeric length |
| Scaling size by k and time by s scales velocity by k/s | `phase_stretch`, `rate_stretch`, `velocity_scaling` | Nonzero time factor; physical use requires positive time and size |
| Acceleration scales by k/s² | `accel_stretch`, `acceleration_scaling` | Same time condition |
| Curvature scales by 1/k | `curvature_scaling` | Positive size factor; signed curvature as defined by the analytic formula |
| Tangential phase acceleration cancels from the lateral cross product | `lateral_cross` | Exact planar algebra; converting to lateral acceleration requires nonzero speed |
| Betaflight's present native phase rate is 1/4 rad/s | `betaflight_effective_rate` | Model uses the pinned firmware's 1 m/s floor, 1/4 rad/s cap, 4 m radius and requested 0.56 m/s speed |
| Its native period is 8π seconds | `betaflight_period` | Same native-rate model |
| The old 45-second HOLD commanded between one and two cycles | `old_hold_exceeds_one_cycle`, `old_hold_between_one_and_two_cycles` | Pattern phase running continuously; does not account for settling or tracking lag |
| Correct rounded HOLD is exactly 252 deciseconds | `corrected_hold_bounds`, `corrected_hold_deciseconds` | Exact real arithmetic with proved π bounds |
| Upward rounding adds less than 0.1 seconds | `decisecond_rounding` | Exact mathematical ceiling; runtime floating-point rounding is not verified |

GNC supplies the quintic blend derivatives, endpoint behavior and rate bound. The benchmark also checks the bound on its scaled phase rate via `phase_rate_bound`. The audit traverses theorem dependencies and rejects `sorryAx`, custom axioms and unchecked native-decision axioms. The permitted foundational axioms match GNC's policy.

## What remains unproved

| Claim | Current evidence / missing work |
|---|---|
| Displayed path length, peak speed, peak lateral acceleration and minimum turn radius are exact | They are numerical quadrature/grid estimates. Integral/scaling identities are proved; numerical error bounds and global extrema certification are not. |
| Rust and JavaScript implement the specification for every input | Source correspondence was reviewed and hashes are recorded. Formal refinement, IEEE floating-point error, parser and overflow verification are missing. |
| The lap checker proves exact topological winding or an exact crossing time | It checks ordered sampled geometric gates with explicit tolerances. It is a runtime diagnostic, not a Lean theorem about all trajectories. |
| Every Betaflight/CogniPilot run will complete and land | Only actual recorded-run checks support completion. Intermittent estimator/provisioning failures remain. Controller stability, actuator saturation, and scheduler guarantees are not proved. |
| The course is physically safe inside PURT | Published approximate dimensions and assumed margins are not a calibrated free-space survey. A real error bound, mocap coverage and obstacle measurements are still required. |
| The two stacks are scientifically interchangeable | Sensors, time law, execution timing and takeoff/landing differ. Equal physics alone does not establish parity. |
| Hardware, soldering, communication links or timing drivers are correct | No formal hardware/software model or real measurement has been supplied for those claims. |

The proof files leave these claims out rather than admitting them. There is no meaningful finite proof of “everything” without a defined model and explicit requirements. This package establishes the listed mathematical foundations; it does not upgrade empirical results into universal guarantees.

## Reproduction and provenance

Use the [native Lake instructions](../proofs/README.md). The [verification record](../proofs/verification.json) lists toolchain, pins, theorem names and hashes. The [source snapshot](../proofs/source-snapshot.sha256) records the reviewed math, native patch and config. The new CI job checks both the snapshot and proofs. No flight logic or saved trajectory was changed for this proof work.

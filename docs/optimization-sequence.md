# Ordered benchmark qualification and optimization

Active targets: CogniPilot and Betaflight on TROPIC RT1064. This implements the November 6 work order; it is not a claim of completed qualification.

## 1. Resolve incomplete execution before speed selection

Observed CogniPilot coarse-35 stopped at 39.63925 simulation seconds while waiting for shared-memory response 63423. The transport's normal per-exchange wall timeout is two seconds. The retained log does not distinguish host scheduling starvation from a firmware hang. Increasing that timeout alone would not prove a root-cause fix.

The native speed-search code previously treated every failed process as a flight-performance boundary. It now writes a blocked diagnostic and refuses selection after an unknown execution error or truncated run. Known full-duration tracking/landing failures and explicit envelope/tilt aborts remain valid flight failures. Both process success and the report's passed flag are required for a pass. Focused Rust tests cover the timeout, truncation, landing failure, tilt abort and completed flight; existing geometry rejection also passes.

The ongoing legacy campaign executable is unchanged. Its recordings are diagnostic only: its coarse-35 timeout invalidates a fastest-setting claim from that search. The correction is in the workspace patch and VM source, tested separately from the active executable. An actual repeat of coarse-35, timeout root-cause diagnosis and a fresh corrected campaign remain outstanding.

## 2. Fair baseline qualification

Keep onboard control equations unchanged. Requalify attitude gains on the current ARM binaries using the same step-response rule, verify command signs/scales and the PDF's integrated-attitude checks, then run both offboard-lead modes. Use identical shared trajectory, plant, limits, noise/seed matrix and startup/end-state criteria. Repeat each candidate across all 15 declared noise/seed cells; preserve every failed or incomplete attempt. No-noise seeds are repeatability checks, not independent random trials.

Betaflight OneShot125 has one successful diagnostic; actual scheduling readback, matched PWM comparison and full confirmations are outstanding. Neither the 39-second CogniPilot recording nor the 35-second Betaflight diagnostic is a selected fastest baseline.

## 3. Physical timing measurements

Requires connected, identified TROPIC hardware and measurement equipment. No physical timing result exists yet. Measure sensor data-ready, SPI acquisition completion, estimator/controller start/end and actuator submission, retaining clock definitions, units, sample count, workload and build hashes. Report latency distributions, period jitter and missed deadlines. QEMU wall runtime and scheduled exchange frequency are not substitutes. Optimize the largest measured contributor only after baseline evidence is captured.

## 4. Separate experiments

First compare delayed position/velocity feedback with and without time-aligned prediction, using identical timestamped samples and dropout patterns. Keep ideal plant-truth feedback as a separately labeled baseline. The delay distribution must come from measurements or be explicitly labeled assumed; the current virtual pilot uses truth and cannot establish real-world estimator benefits.

Then compare the current integration method with FOH/trapezoidal and appropriate Lie-group integration against the same continuous-time reference and IMU samples. Report attitude/state errors and execution cost before attempting faster laps. These are proposals, not implemented algorithms or demonstrated improvements. Any onboard equation changes belong to separate optimization configurations, never silently to the stock comparison.

Conference claims remain limited to measured completed flights and identified limitations. Physical-flight readiness, hardware jitter superiority and a global maximum speed are not established.

## Exact-repeat result and host watchdog hardening

The original 35-second CogniPilot configuration was rerun unchanged and passed: RMS 0.251667 m, maximum 0.638027 m, full duration 78 s, disarmed, four stopped motors and grounded final height 0.098366 m. Config, firmware, plant, offboard library and runner hashes match the failed attempt. See [raw report](results/arm-speed/cognipilot-35s-repeat/report.json). This establishes a successful repeat, not the cause or elimination of intermittent stalls.

The host transport now rechecks the response sequence before declaring a deadline failure, uses a bounded 30-second wall-clock watchdog instead of the two-second steady-state allowance, and logs recovered waits of at least two seconds. It does not advance simulated time or resend stale commands during the wait. This is simulation-host resilience, not a relaxed physical-flight safety timeout or firmware timing claim. Onboard binaries and control equations are unchanged.

Native tests: 55 passed, 2 ignored. Frozen new runner SHA-256: f2ef29affdaa7ec6c92e281357e115dcb3d6801ca390765fd5f76e0992a53b92. A fresh campaign is scheduled after the active legacy flight, in artifacts/arm-speed-cognipilot-hardened-20261106; all earlier attempts remain retained. Results are pending.

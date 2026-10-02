# Flight timing rundown

The fixed course is 8 × 4 m at 1.5 m altitude, with one requested 45-second figure-eight lap, five-second hold and landing. The path is 24.3889 m, peak required speed 1.4810 m/s, peak lateral acceleration 0.5260 m/s² (0.05364 g), and tightest geometric radius 0.8350 m.

[Open current recordings and measured stats](sim/). Recorded duration includes setup, takeoff, hold and landing; it is not the lap time. The CogniPilot reference starts after its configured readiness/takeoff phase. Betaflight's native constant-phase clock is quantized by its cruise-speed settings, so the requested lap duration does not prove identical timing.

CogniPilot RMS error compares ground truth to the reference at the same timestamp, including the terminal hold. Betaflight is not scored against that shared time law. Both stacks use the same plant, but sensors, scheduler timing and takeoff/landing behavior differ; these results do not support a fair ranking.

Path length is numerically integrated over the analytic figure eight. Velocity and acceleration follow its analytic derivatives with a minimum-jerk lap phase. Numerical sampling estimates maxima. The [configuration](config/figure-eight.json) records assumed limits and margins. Actual PURT coverage remains unknown; the approximate published envelope is not flight clearance. See [PURT evidence](purt-environment.md).

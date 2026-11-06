# Betaflight protocol scheduling diagnostic — queued, not a result

The existing PWM baseline remains intact. Its native firmware validation sets a 2,000 µs PID period; retained counters show 500 motor updates per simulated second, despite 8,000 simulation exchanges per second. See [the source-backed memory investigation](yaw-noise-investigation.md).

This experiment tests a specific hypothesis: changing the normal virtual motor protocol may change the control period and the yaw response during a previously failed landing. It does not assume that a faster loop will help. The passing 40 s harsh-noise seed-2 flight demonstrates that PWM/500 Hz alone does not force failure.

## Predeclared comparison

- Target: unchanged Betaflight TROPIC RT1064 ELF, SHA-256 `c9530644680b907053022efa349bd0564701dd09ead526c862ac76d71755423f`.
- Reference: 10 × 10 m, 2 m altitude, one 35 s reference lap; harsh noise, seed 2. This baseline failed landing with the same plant and gains.
- Experimental change: normal `motor_pwm_protocol = ONESHOT125`, requesting `pid_process_denom = 1`. Betaflight's normal validation remains enabled and may raise the denominator. Source predicts a minimum 500 µs period with this protocol; actual retained settings and counters must confirm it.
- Both allowed protocols use the existing analog output endpoint encoding. DShot is rejected because its encoding would require a different adapter. No physical ESC signaling is emulated by this study.
- Controller equations, gains, plant, noise, stick schedule and landing gates remain unchanged. Failure is retained. A single diagnostic pass cannot qualify a faster reference duration.
- Before any improvement claim: rerun the PWM baseline with the same new runner, compare actual timing/counters and telemetry, and repeat the full noise/seed qualification after a justified configuration decision.

## Isolation and readiness

The optional configuration parser is in the Cerebri benchmark patch. It defaults to the exact existing PWM command and rejects unsupported protocols, invalid types and out-of-range denominators. Its native test passes. The diagnostic executable is built separately under VM `artifacts/protocol-study-target/release/xtask`, SHA-256 `8781a14f7ec763a4b2248213af41d2e9da1823c32d919c4f655ce5a4ac2448ad`.

The baseline runner stays at SHA-256 `7c9ade8116c66f1e6e0dad59fdf57bc461a1e9efecd7691c3eee599788e81693`; it was verified unchanged after building the diagnostic. Its active Betaflight campaign and queued CogniPilot campaign therefore keep their original executable. The diagnostic has a separate TOML copy whose mission-helper command points to the separate executable. Its configuration is [betaflight-oneshot125-study.json](config/betaflight-oneshot125-study.json).

The PWM campaign is complete with no qualified candidate. Execution order is the already-running CogniPilot flight → protocol diagnostic → remaining CogniPilot campaign → ArduPilot commissioning. Only the CogniPilot campaign coordinator is paused between flights; its current flight continues normally. A shell exit handler resumes the coordinator after the diagnostic, including failure. The diagnostic refuses to start while another QEMU process is active. It has a 400-second wall-time limit. No queued campaign was cancelled.

**No protocol-study flight has completed yet.** Build and parser tests are preparation only. This change does not establish hardware readiness, a hardware loop rate, lower latency, or a faster reliable flight.

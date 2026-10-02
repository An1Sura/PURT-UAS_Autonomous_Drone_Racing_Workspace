# Shared trajectory reference

The common reference is a Gerono figure eight: x = A sin θ, y = B sin(2θ), at fixed altitude. A and B are half the scaled horizontal dimensions. One lap uses θ = 2π(10u³ − 15u⁴ + 6u⁵), where u is elapsed lap time divided by target lap duration. This starts and ends the reference with zero velocity and acceleration.

The current [configuration](config/figure-eight.json) requests an 8 × 4 m figure eight, 1.5 m altitude, one 45-second lap and a five-second end hold. CogniPilot consumes the time-indexed reference through its external-reference interface. Betaflight receives corresponding native radius/cruise/hold settings; this does not establish identical phase timing.

Tracking error compares plant ground truth with the reference at the same simulation timestamp, without nearest-path alignment or time shifting. Betaflight has no directly comparable shared-reference RMS score. Read [the current rundown](timing-rundown.md) before comparing recordings.

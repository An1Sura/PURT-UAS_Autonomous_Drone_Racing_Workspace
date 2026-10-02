# RDD2 validation and limits

The current benchmark scope is Betaflight and CogniPilot. The baseline workflow remains pure Modelica, Zephyr native_sim SIL, then trajectory comparison. The benchmark runs both firmware stacks against the same generated quadrotor plant.

The [simulation page](sim/) embeds the latest actual recordings and their reports. Each result includes the exact requested configuration. A successful run must satisfy its native diagnostic checks; failed attempts remain explicit. The native test suite checks protocol behavior, trajectory geometry, timing, environment fit and web-recording downsampling.

The current fixed course is 8 × 4 m, one requested 45-second lap, at 1.5 m altitude. Sensor paths, takeoff/landing assistance and lockstep versus wall-paced execution are unmatched. A common plant is established; fair timing comparison and hardware validation are not. PURT's calibrated coverage and physical obstacles require an on-site survey.

See [patch instructions](../patches/README.md), [shared reference](shared-reference.md), and [flight statistics](timing-rundown.md).

Two-stack removal verification: 36 native tests passed, two ignored. Both refreshed firmware runs passed on the unchanged retry. The first attempt’s intermittent native-mode failure is retained in `docs/results/single-lap/two-stack-first-attempt.json`. The native patch passes both reverse verification and a clean-base application check.

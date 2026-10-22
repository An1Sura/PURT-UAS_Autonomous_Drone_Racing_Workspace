# Betaflight ARM FastDyn flight evidence — October 22, 2026

`flight.log`: completed FastDyn figure-eight execution. The raw flight report,
full 100 Hz trajectory, runtime configuration and 20 Hz replay are in
`../../results/fastdyn/betaflight-figure-eight/`. The replay preserves the final
sample; its geometry check verifies four ordered quadrants and return to center.

`build.log`: final ARM build; `rust-tests.log`: 53 passed, 2 intentionally ignored;
`model-tests.log`: boot/ADC/SPI assertions, including the 16-bit chip-select fix.
`checksums.json`: original report, configuration, trajectory and binary actuator
trace hashes. The 41 MB trace is retained in the VM's
`artifacts/betaflight-fastdyn-flight07/flight/` and the local export, not uploaded.

Attempts 01–05 are failures retained for diagnosis: unavailable CLI field,
startup handshake/reset handling, gyro detection/chip-select access width,
configuration activation, and scheduler cycle-counter continuity. Attempt 06
is the passing hover qualification. Earlier report backend labels may reflect
pre-fix metadata and must not be treated as successful native recordings.

Final run: one 40 s reference lap within 83 simulated seconds; 0.1433482924 m RMS,
0.3501205385 m maximum tracking error; 664000 acknowledged firmware exchanges;
final armed=false; all motors=0; ground height=0.0983655583 m.

The common plant and generated controller hashes match the CogniPilot FastDyn
recording. The board, firmware timing and sensor quantization do not match;
results are commissioning evidence, not a fair hardware-latency ranking or
maximum-speed conclusion. Betaflight uses a dedicated virtual-I/O ARM build.

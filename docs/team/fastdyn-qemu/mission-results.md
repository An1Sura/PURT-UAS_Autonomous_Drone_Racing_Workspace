# CogniPilot RDD2 — FastDyn/QEMU Mission Results

**Project:** PURT-UAS Autonomous Drone Racing  
**Contributor:** Pierson Darling  
**Test Date:** October 8, 2026  
**Platform:** Apple Silicon M2 / UTM / Ubuntu ARM64  
**Firmware:** CogniPilot Cerebri RDD2 (Zephyr RTOS)  
**Simulation:** FastDyn + QEMU + Rumoca/Modelica

## 1. Objective

Establish a functional baseline for executing CogniPilot RDD2 firmware through FastDyn/QEMU on an Apple Silicon ARM64 environment.

The purpose of this experiment was to confirm that the firmware could execute a simulated autonomous mission and produce valid flight reports before conducting additional trajectory, controller, and timing experiments.

## 2. Simulation Architecture

```text
Apple Silicon M2
    |
    v
UTM — Ubuntu ARM64
    |
    v
FastDyn Simulation Framework
    |
    +---- QEMU (emulated Cortex-M7)
    |         |
    |         v
    |    CogniPilot RDD2
    |    Zephyr Firmware
    |
    +---- Rumoca/Modelica
              |
              v
       Vehicle Dynamics
```

QEMU executes the flight-control firmware, while the vehicle model simulates physical behavior and exchanges data with the controller.

## 3. Mission Results

**Mission status: PASSED**

| Metric | Result |
|---|---:|
| Simulated mission duration | 20.0 s |
| Expected controller ticks | 32,000 |
| Controller frequency | 1,600 Hz |
| Plant steps | 1,000 |
| Plant update frequency | 50 Hz |
| Maximum altitude | 2.0506 m |
| Maximum tilt | 15.347° |
| Final altitude | 0.098 m |
| Mission execution speedup | 21.61× |
| Overall execution speedup | 3.87× |
| Overall execution time | 5.171 s |

### Validation

| Check | Result |
|---|---|
| Mission completed | PASS |
| Firmware armed | PASS |
| Firmware disarmed | PASS |
| RC interface healthy | PASS |
| IMU healthy | PASS |
| Automatic leveling observed | PASS |
| Mission report generated | PASS |

## 4. Execution

The mission was launched using:

```bash
cd ~/projects/github/cerebri_rdd2
bash fastdyn/run_mission.sh
```

The command uses the locally built RDD2 firmware, FastDyn/QEMU environment, mission helper, and generated Rumoca plant.

The mission report was inspected using:

```bash
cat artifacts/bil/work/cerebri_rdd2_mission.json
```

See [Mac ARM64 Setup](setup-mac-arm64.md) for environment installation, firmware build instructions, and troubleshooting.

## 5. Interpretation

The simulation confirms that CogniPilot RDD2 can execute a complete simulated flight mission in the tested FastDyn/QEMU environment.

This provides a baseline for future experiments involving:

- Mission repeatability
- Additional flight trajectories
- Figure-eight course execution
- Controller timing and latency characterization
- Simulation-based firmware debugging

### Limitations

This experiment does not yet establish:

- Physical hardware performance
- Actual IMU/SPI/DMA driver latency
- A maximum autonomous flight speed
- A direct CogniPilot vs. Betaflight comparison
- Performance on Ani's shared 10 × 10 m figure-eight benchmark

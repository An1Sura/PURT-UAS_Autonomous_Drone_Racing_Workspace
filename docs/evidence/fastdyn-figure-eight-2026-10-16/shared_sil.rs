//! Real firmware, one generated position loop, one timed course, one FMI plant.
use crate::{
    benchmark::{FlightStackAdapter, PilotCommand, SensorFrame, SyntheticGnss},
    cognipilot::CogniPilotAdapter,
    physics::{self, Plant},
    shared_memory::Transport,
};
use anyhow::{Context, Result, bail, ensure};
use libloading::Library;
use serde::Serialize;
use serde_json::{Value, json};
use std::{
    ffi::OsString,
    fs::{self, File},
    io::{BufWriter, Write},
    net::UdpSocket,
    path::{Path, PathBuf},
    process::{Child, Command},
    thread,
    time::{Duration, Instant},
};
const DT: f64 = 0.000125;
const TMAX: f64 = 41.3749272;
struct ChildGuard(Child);
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
#[derive(Clone, Copy, Default, Serialize)]
struct Sticks {
    roll: f64,
    pitch: f64,
    yaw_rate: f64,
    thrust: f64,
    omega: [f64; 3],
    alpha: [f64; 3],
    feedforward: u8,
}
impl Sticks {
    fn channels(self, stack: &str, arm: bool, active: bool, hover: f64) -> [i32; 16] {
        let mut rc = [1500; 16];
        let tilt = 35f64.to_radians();
        rc[0] = (1500. + 500. * (self.roll / tilt).clamp(-1., 1.)).round() as i32;
        rc[1] = (1500. + 500. * (self.pitch / tilt).clamp(-1., 1.)).round() as i32;
        let yaw_full = if stack == "cognipilot" {
            3.5
        } else {
            200f64.to_radians()
        };
        rc[3] = (1500. + 500. * (-self.yaw_rate / yaw_full).clamp(-1., 1.)).round() as i32;
        let throttle = if stack == "betaflight" {
            hover * (self.thrust / (2. * 9.80665)).max(0.).sqrt()
        } else {
            (self.thrust / TMAX).max(0.).sqrt()
        };
        rc[2] = if active {
            (1000. + 1000. * throttle.clamp(0., 1.)).round() as i32
        } else {
            1000
        };
        rc[4] = if arm { 2000 } else { 1000 };
        rc[5] = 1500;
        rc[6] = if active && arm && self.feedforward > 0 {
            2000
        } else {
            1000
        };
        if rc[6] > 1500 {
            for j in 0..2 {
                rc[7 + j] = (1500. + 500. * (self.omega[j] / 4.).clamp(-1., 1.)).round() as i32;
            }
            if self.feedforward == 2 {
                for j in 0..3 {
                    rc[9 + j] =
                        (1500. + 500. * (self.alpha[j] / 20.).clamp(-1., 1.)).round() as i32;
                }
            }
        }
        rc
    }
}
struct Offboard {
    _lib: Library,
    reference: unsafe extern "C" fn(i32, *mut f32) -> u32,
    control: unsafe extern "C" fn(*const f32, i32, *mut f32) -> u32,
}
impl Offboard {
    fn open(
        path: &Path,
        width: f32,
        height: f32,
        altitude: f32,
        duration: f32,
        shape: i32,
    ) -> Result<Self> {
        unsafe {
            let lib = Library::new(path)?;
            ensure!(
                lib.get::<unsafe extern "C" fn() -> u32>(b"shared_abi_version\0")?() == 2,
                "offboard ABI mismatch"
            );
            let start = *lib.get::<unsafe extern "C" fn(f32, f32, f32, f32)>(b"shared_start\0")?;
            let shape_fn = *lib.get::<unsafe extern "C" fn(i32)>(b"shared_shape\0")?;
            let reference = *lib.get(b"shared_reference\0")?;
            let control = *lib.get(b"shared_control\0")?;
            start(width, height, altitude, duration);
            shape_fn(shape);
            Ok(Self {
                _lib: lib,
                reference,
                control,
            })
        }
    }
    fn reference(&self, engage: bool) -> Result<[f64; 17]> {
        let mut out = [0.; 17];
        ensure!(
            unsafe { (self.reference)(i32::from(engage), out.as_mut_ptr()) } == 0,
            "trajectory error signal"
        );
        ensure!(out.iter().all(|v| v.is_finite()), "nonfinite reference");
        Ok(out.map(f64::from))
    }
    fn control(
        &self,
        plant: &Plant,
        r: &[f64; 17],
        active: bool,
        feedforward: u8,
    ) -> Result<Sticks> {
        let mut i = [0f32; 27];
        i[..3].copy_from_slice(&plant.position().map(|x| x as f32));
        i[3..6].copy_from_slice(&plant.velocity().map(|x| x as f32));
        i[6..10].copy_from_slice(&quaternion(plant.euler()).map(|x| x as f32));
        for j in 0..3 {
            i[10 + j] = r[1 + j] as f32;
            i[13 + j] = r[4 + j] as f32;
            i[16 + j] = r[7 + j] as f32;
        }
        i[19] = r[10] as f32;
        for j in 0..6 {
            i[20 + j] = r[11 + j] as f32;
        }
        i[26] = f32::from(feedforward > 0);
        let mut o = [0f32; 26];
        ensure!(
            unsafe { (self.control)(i.as_ptr(), i32::from(active), o.as_mut_ptr()) } == 0,
            "position loop error signal"
        );
        ensure!(
            o.iter().all(|x| x.is_finite()) && (!active || o[4] == 1.),
            "invalid position-loop output {o:?}"
        );
        Ok(Sticks {
            roll: o[0] as f64,
            pitch: o[1] as f64,
            yaw_rate: o[2] as f64,
            thrust: o[3] as f64,
            omega: [o[20] as f64, o[21] as f64, o[22] as f64],
            alpha: [o[23] as f64, o[24] as f64, o[25] as f64],
            feedforward,
        })
    }
}
fn quaternion([r, p, y]: [f64; 3]) -> [f64; 4] {
    let (sr, cr) = (r / 2.).sin_cos();
    let (sp, cp) = (p / 2.).sin_cos();
    let (sy, cy) = (y / 2.).sin_cos();
    [
        cr * cp * cy + sr * sp * sy,
        sr * cp * cy - cr * sp * sy,
        cr * sp * cy + sr * cp * sy,
        cr * cp * sy - sr * sp * cy,
    ]
}
fn ramp(u: f64) -> (f64, f64, f64) {
    let u = u.clamp(0., 1.);
    (
        u.powi(3) * (10. + u * (-15. + 6. * u)),
        30. * u * u * (1. - u).powi(2),
        60. * u * (1. - u) * (1. - 2. * u),
    )
}
#[derive(Default, Serialize)]
struct Report {
    passed: bool,
    stack: String,
    shape: String,
    simulated_seconds: f64,
    wall_seconds: f64,
    armed_observed: bool,
    mode_observed: bool,
    final_armed: bool,
    final_motors: [f32; 4],
    final_position: [f64; 3],
    tracking_rms_m: Option<f64>,
    tracking_max_m: f64,
    maximum_tilt_deg: f64,
    commanded_rate_ff_peak_rad_s: [f64; 2],
    commanded_accel_ff_peak_rad_s2: [f64; 3],
    samples: u64,
    firmware_exchanges: u64,
    offboard_updates: u64,
    stick_updates: u64,
    grounded_stopped_samples: u64,
    arming_flags: u32,
    error: Option<String>,
    hashes: Value,
    sensor_profile: Value,
    qualification: String,
    lap_start_s: f64,
    lap_end_s: f64,
}
struct Bf {
    socket: UdpSocket,
    _child: ChildGuard,
}
impl Bf {
    fn open(binary: &Path, out: &Path, cfg: &Value) -> Result<Self> {
        let socket = UdpSocket::bind("127.0.0.1:9002")
            .context("Betaflight motor port busy; stop other BF simulations")?;
        socket.set_read_timeout(Some(Duration::from_secs(10)))?;
        let config = "map AETR1234\nset max_aux_channels = 12\nfeature -GPS\nset mag_hardware = NONE\naux 0 0 0 1700 2100 0 0\naux 1 1 1 1300 1700 0 0\nset angle_limit = 35\nset rates_type = ACTUAL\nset roll_rc_rate = 20\nset pitch_rc_rate = 20\nset yaw_rc_rate = 20\nset roll_srate = 20\nset pitch_srate = 20\nset yaw_srate = 20\nset roll_expo = 0\nset pitch_expo = 0\nset yaw_expo = 0\nset deadband = 0\nset yaw_deadband = 0\nset rc_smoothing = OFF\nset thr_mid = 50\nset thr_expo = 0\nset thrust_linear = 0\nset angle_feedforward = 0\nset d_max_roll = 0\nset d_max_pitch = 0\nset d_max_yaw = 0\n";
        let mut config = config.to_string();
        if let Some(gain) = cfg["tuning"]["attitude_gain_per_s"].as_f64() {
            ensure!(
                gain.is_finite() && (1.0..=20.0).contains(&gain),
                "invalid attitude gain"
            );
            config.push_str(&format!(
                "set angle_p_gain = {}\n",
                (gain * 10.0).round() as u32
            ));
        }
        if let Some(gain) = cfg["tuning"]["betaflight_f_gain"].as_u64() {
            ensure!(gain <= 1000, "invalid feedforward gain");
            for axis in ["roll", "pitch", "yaw"] {
                config.push_str(&format!("set f_{axis} = {gain}\n"));
            }
        }
        if let Some(gains) = cfg["tuning"]["betaflight_f_gains"].as_array() {
            ensure!(gains.len() == 3, "three F gains required");
            for (axis, g) in ["roll", "pitch", "yaw"].iter().zip(gains) {
                let gain = g.as_u64().context("integer F gain")?;
                ensure!(gain <= 1000, "F gain out of range");
                config.push_str(&format!("set f_{axis} = {gain}\n"));
            }
        }
        fs::write(out.join("config.txt"), config)?;
        let p = Command::new(binary)
            .arg("--config")
            .arg(out.join("config.txt"))
            .current_dir(out)
            .output()?;
        let text = [p.stdout, p.stderr].concat();
        fs::write(out.join("provision.log"), &text)?;
        ensure!(
            p.status.success() && !String::from_utf8_lossy(&text).contains("INVALID"),
            "Betaflight provisioning failed; inspect provision.log"
        );
        let log = File::create(out.join("firmware.log"))?;
        let child = ChildGuard(
            Command::new(binary)
                .current_dir(out)
                .stdout(log.try_clone()?)
                .stderr(log)
                .spawn()?,
        );
        let deadline = Instant::now() + Duration::from_secs(15);
        while !fs::read_to_string(out.join("firmware.log"))?.contains("ADR_LOCKSTEP_READY") {
            ensure!(Instant::now() < deadline, "Betaflight startup timeout");
            thread::sleep(Duration::from_millis(10));
        }
        Ok(Self {
            socket,
            _child: child,
        })
    }
    fn step(
        &self,
        plant: &Plant,
        tick: u32,
        rc: [i32; 16],
        fresh: bool,
        gyro: [f32; 3],
        acc: [f32; 3],
    ) -> Result<([f32; 4], bool, bool, u32, Vec<u8>)> {
        let q = quaternion(plant.euler());
        let p = plant.position();
        let v = plant.velocity();
        let vals = [
            tick as f64 * DT,
            gyro[0] as f64,
            -gyro[1] as f64,
            gyro[2] as f64,
            -acc[0] as f64,
            -acc[1] as f64,
            -acc[2] as f64,
            q[3],
            q[2],
            q[1],
            q[0],
            v[0],
            v[1],
            v[2],
            -86.9212 - p[0] / (111319.49079327358 * 40.4237f64.to_radians().cos()),
            40.4237 - p[1] / 111319.49079327358,
            200. + p[2],
            101325.,
        ];
        let mut input = vals
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<_>>();
        input.extend(tick.to_le_bytes());
        input.extend(u32::from(fresh).to_le_bytes());
        for c in rc {
            input.extend((c as u16).to_le_bytes());
        }
        self.socket.send_to(&input, "127.0.0.1:9003")?;
        let mut out = [0; 128];
        let (n, peer) = self.socket.recv_from(&mut out)?;
        ensure!(
            n == 64 && peer.ip().is_loopback(),
            "invalid BF response {n}"
        );
        let u = |i| u32::from_le_bytes(out[i..i + 4].try_into().unwrap());
        ensure!(
            u(0) == 1
                && u(4) == tick
                && u64::from_le_bytes(out[48..56].try_into().unwrap()) == tick as u64 * 125,
            "stale BF response"
        );
        let m: [f32; 4] = std::array::from_fn(|i| {
            f32::from_le_bytes(out[8 + i * 4..12 + i * 4].try_into().unwrap())
        });
        ensure!(
            m.iter().all(|v| v.is_finite() && (0.0..=1.).contains(v)),
            "invalid motors"
        );
        Ok((
            [m[1], m[0], m[2], m[3]],
            u(24) != 0,
            u(32) != 0,
            u(28),
            out[..64].to_vec(),
        ))
    }
}
struct Noise {
    state: u64,
    gyro: f64,
    acc: f64,
    phase: [f64; 4],
}
impl Noise {
    fn normal(&mut self) -> f64 {
        let mut sum = 0.;
        for _ in 0..12 {
            self.state ^= self.state << 13;
            self.state ^= self.state >> 7;
            self.state ^= self.state << 17;
            sum += (self.state >> 11) as f64 / ((1u64 << 53) as f64);
        }
        sum - 6.
    }
    fn apply(&mut self, g: [f32; 3], a: [f32; 3], motors: [f32; 4]) -> ([f32; 3], [f32; 3]) {
        let mut g = g;
        let mut a = a;
        for k in 0..4 {
            self.phase[k] =
                (self.phase[k] + 2. * 1100. * motors[k] as f64 / 1600.) % std::f64::consts::TAU;
        }
        for j in 0..3 {
            let vibration = (0..4)
                .map(|k| (self.phase[k] + (k + j) as f64 * 1.7).sin() * motors[k] as f64)
                .sum::<f64>()
                / 4.;
            g[j] += (0.25 * self.gyro * vibration) as f32;
            a[j] += (0.25 * self.acc * vibration) as f32;
            g[j] += (self.gyro * self.normal()) as f32;
            a[j] += (self.acc * self.normal()) as f32;
        }
        (g, a)
    }
}
pub fn run(args: impl Iterator<Item = OsString>) -> Result<()> {
    let a: Vec<_> = args.collect();
    ensure!(
        a.len() >= 7,
        "shared-sil CONFIG PLANT_DIRECTORY GENERATED_LIBRARY BINARY STACK OUTPUT_DIRECTORY SHAPE [SEED NOISE]"
    );
    let cfg: Value = serde_json::from_slice(&fs::read(&a[0])?)?;
    let c = &cfg["course"];
    let stack = a[4].to_str().context("stack utf8")?;
    let fastdyn_memory = std::env::var_os("RDD2_SHARED_FASTDYN_MEMORY").map(PathBuf::from);
    ensure!(
        fastdyn_memory.is_none() || stack == "cognipilot",
        "FastDyn transport supports CogniPilot ARM firmware only"
    );
    ensure!(
        fastdyn_memory.is_none() || cfg["tuning"]["attitude_gain_per_s"].is_null(),
        "FastDyn uses compiled firmware gains; native host gain overrides are unsupported"
    );
    let shape = a[6].to_str().context("shape utf8")?;
    ensure!(
        ["ideal", "cognipilot", "betaflight"].contains(&stack),
        "unsupported stack"
    );
    ensure!(
        [
            "hover",
            "step",
            "square",
            "figure-eight",
            "attitude-step",
            "rate-ramp"
        ]
        .contains(&shape),
        "unsupported shape"
    );
    ensure!(
        c["width_m"] == 10 && c["height_m"] == 10 && c["altitude_m"] == 2 && c["laps"] == 1,
        "fixed qualification is 10x10 at 2 m, one lap"
    );
    ensure!(
        c["scale"] == 1
            && c["center_enu_m"] == json!([0, 0])
            && c["yaw_rad"] == 0
            && c["phase_law"] == "minimum_jerk_each_lap",
        "unsupported course placement or phase"
    );
    ensure!(
        cfg["controller"]["sample_rate_hz"] == 100
            && cfg["controller"]["tilt_limit_deg"] == 35
            && cfg["controller"]["yaw_rate_limit_deg_s"] == 200
            && cfg["controller"]["translational_correction_fraction"] == 0.7,
        "config does not match generated controller"
    );
    let duration = match shape {
        "attitude-step" => {
            if cfg["tuning"]["probe_event"].is_number() {
                6.
            } else {
                24.
            }
        }
        "rate-ramp" => {
            if cfg["tuning"]["probe_event"].is_number() {
                6.
            } else {
                18.
            }
        }
        "hover" => 10.,
        "step" => 15.,
        "square" => 40.,
        _ => c["lap_time_s"].as_f64().context("lap time")?,
    };
    let shape_id = match shape {
        "attitude-step" | "rate-ramp" => 0,
        "hover" => 0,
        "step" => 1,
        "square" => 2,
        _ => 3,
    };
    let out = PathBuf::from(&a[5]);
    ensure!(
        !out.exists(),
        "use a fresh output directory to preserve every attempt"
    );
    fs::create_dir_all(&out)?;
    let out = out.canonicalize()?;
    let generated = PathBuf::from(&a[2]).canonicalize()?;
    let binary = PathBuf::from(&a[3]).canonicalize()?;
    let (lib, description) = physics::host_paths(&PathBuf::from(&a[1]))?;
    let seed = a
        .get(7)
        .map(|s| s.to_str().unwrap().parse::<u64>())
        .transpose()?
        .unwrap_or(1);
    ensure!(seed > 0, "seed must be positive");
    let level = a.get(8).and_then(|s| s.to_str()).unwrap_or("none");
    let (gs, asigma) = match level {
        "none" => (0., 0.),
        "realistic" => (0.002, 0.03),
        "harsh" => (0.01, 0.15),
        _ => bail!("unknown noise"),
    };
    let ff_mode = cfg["controller"]["feedforward"].as_str().unwrap_or("off");
    let ff = match ff_mode {
        "off" => 0,
        "omega" => 1,
        "omega_alpha" => 2,
        _ => bail!("unknown feedforward mode"),
    };
    let mut noise = Noise {
        phase: [0.; 4],
        state: seed,
        gyro: gs,
        acc: asigma,
    };
    let mut report=Report{stack:stack.into(),shape:shape.into(),lap_start_s:25.,lap_end_s:25.+duration,
  qualification:"shared offboard loop, real native self-level firmware; commissioning flight, not a matched-hardware performance ranking".into(),
  hashes:json!({"plant":physics::file_sha256(&lib)?,"plant_description":physics::file_sha256(&description)?,"offboard":physics::file_sha256(&generated)?,"firmware":physics::file_sha256(&binary)?,"runner":physics::file_sha256(&std::env::current_exe()?)?,"config":physics::file_sha256(Path::new(&a[0]))?}),
  sensor_profile:json!({"feedforward":ff_mode,"seed":seed,"level":level,"imu_hz":1600,"gyro_std_rad_s":gs,"accel_std_m_s2":asigma,"distribution":"12-uniform sum approximation; assumed diagnostic magnitudes, not measured hardware","motor_vibration":"deterministic two-blade harmonic at 2*1100*normalized_motor rad/s; fixed per-motor and per-axis phase offsets; amplitude 0.25*IMU noise std scaled by motor command, assumed diagnostic model","position_feedback":"plant truth","betaflight_hover_throttle":cfg["stacks"]["betaflight"]["hover_throttle"],"hover_calibration_status":cfg["stacks"]["betaflight"]["hover_throttle_status"],"rc_smoothing":"OFF","position_loop_hz":100,"stick_schedule_hz":250,"master_tick_hz":8000,"sensor_and_command_ingress":"BF packets at 8000Hz hold 1600Hz IMU; CG reads latest at 1600Hz (up to 0.5ms stick-delivery quantization)"}),..Report::default()};
    if stack == "ideal" {
        report.qualification = "ideal attitude isolation test; no flight firmware executed".into();
        report.hashes["firmware"] = Value::Null;
    }
    report.sensor_profile["execution_backend"] = json!(if fastdyn_memory.is_some() {
        "fastdyn-qemu-arm"
    } else {
        "native-sil"
    });
    if fastdyn_memory.is_some() {
        report.qualification = "FastDyn/QEMU ARM BIL; shared generated offboard loop and plant; local-source commissioning run, not physical hardware latency".into();
    }
    fs::write(out.join("config.json"), serde_json::to_vec_pretty(&cfg)?)?;
    let mut trajectory = BufWriter::new(File::create(out.join("trajectory.csv"))?);
    writeln!(
        trajectory,
        "time_s,x_m,y_m,z_m,roll_rad,pitch_rad,yaw_rad,ref_x,ref_y,ref_z,armed,mode,m0,m1,m2,m3,ff_enable,omega_roll_us,omega_pitch_us,alpha_roll_us,alpha_pitch_us,alpha_yaw_us,throttle_us"
    )?;
    let mut trace = BufWriter::new(File::create(out.join("actuator-trace.bin"))?);
    let calibration = ["attitude-step", "rate-ramp"].contains(&shape);
    report.sensor_profile["tuning"] = cfg["tuning"].clone();
    if calibration {
        report.qualification = "Attitude/rate calibration flight: shared altitude control, intentional lateral drift; course tracking gates do not apply; landing gates retained".into();
    }
    let mut cal_log = BufWriter::new(File::create(out.join("calibration.csv"))?);
    writeln!(
        cal_log,
        "time_s,roll_command,pitch_command,yaw_rate_command,omega_x,omega_y,omega_z,alpha_x,alpha_y,alpha_z,roll_actual,pitch_actual,yaw_actual,gyro_x,gyro_y,gyro_z"
    )?;
    let mut rows = Vec::<Vec<f64>>::new();
    let wall = Instant::now();
    let result = (|| -> Result<()> {
        let mut plant = Plant::open(&lib, &description)?;
        let offboard = Offboard::open(
            &generated,
            if shape == "square" { 1. } else { 10. },
            if shape == "square" { 1. } else { 10. },
            2.,
            duration as f32,
            shape_id,
        )?;
        let mut transport = if stack == "cognipilot" {
            Some(if let Some(memory) = &fastdyn_memory {
                Transport::open(memory, &binary, Duration::from_secs(60))?
            } else {
                Transport::create_direct(&out.join("lockstep.shm"))?
            })
        } else {
            None
        };
        let _cg = if stack == "cognipilot" && fastdyn_memory.is_none() {
            let log = File::create(out.join("firmware.log"))?;
            Some(ChildGuard(
                Command::new(&binary)
                    .env("RDD2_LOCKSTEP_SHM", out.join("lockstep.shm"))
                    .env(
                        "RDD2_SIL_ATTITUDE_GAIN",
                        cfg["tuning"]["attitude_gain_per_s"]
                            .as_f64()
                            .unwrap_or(2.0)
                            .to_string(),
                    )
                    .stdout(log.try_clone()?)
                    .stderr(log)
                    .spawn()?,
            ))
        } else {
            None
        };
        let mut bf = if stack == "betaflight" {
            Some(Bf::open(&binary, &out, &cfg)?)
        } else {
            None
        };
        let mut gnss = SyntheticGnss::default();
        let mut motors = [0.; 4];
        let mut sticks = Sticks::default();
        let mut channels = [1500; 16];
        let mut sampled = plant.imu_flu();
        let (mut armed, mut mode) = (false, false);
        let (mut touchdown, mut ground_count) = (false, 0u64);
        let (mut sum, mut count) = (0., 0u64);
        let mut last_ref = [0.; 17];
        let mut lap_started = false;
        let end = report.lap_end_s;
        let land_start = end + 5.;
        let land_end = land_start + 8.;
        let finish = land_end + 5.;
        let hover = cfg["stacks"]["betaflight"]["hover_throttle"]
            .as_f64()
            .unwrap_or((2. * 9.80665 / TMAX).sqrt());
        for tick in 1..=(finish / DT).round() as u32 {
            let t = tick as f64 * DT;
            let arm = t >= 8. && !touchdown;
            let active = t >= 9. && !touchdown;
            if tick % 80 == 0 {
                let is_lap = t >= 25. && t <= end;
                let mut r = if is_lap {
                    let r = offboard.reference(lap_started)?;
                    lap_started = true;
                    r
                } else if t > end {
                    last_ref
                } else {
                    offboard.reference(false)?
                };
                if t < 15. {
                    let (b, v, a) = ramp((t - 9.) / 6.);
                    r[3] = 0.1 + 1.9 * b;
                    r[6] = 1.9 * v / 6.;
                    r[9] = 1.9 * a / 36.;
                }
                if t >= land_start {
                    let (b, v, a) = ramp((t - land_start) / 8.);
                    r[3] = 2. - 2.3 * b;
                    r[6] = -2.3 * v / 8.;
                    r[9] = -2.3 * a / 64.;
                }
                if t > end {
                    r[4..10].fill(0.);
                    if t >= land_start {
                        let (_, v, a) = ramp((t - land_start) / 8.);
                        r[6] = -2.3 * v / 8.;
                        r[9] = -2.3 * a / 64.;
                    }
                }
                if !is_lap {
                    r[11..17].fill(0.);
                }
                last_ref = r;
                sticks = offboard.control(&plant, &r, active, ff)?;
                if calibration && is_lap {
                    calibration_sticks(
                        &mut sticks,
                        shape,
                        t - 25.0 + 6.0 * cfg["tuning"]["probe_event"].as_u64().unwrap_or(0) as f64,
                    );
                }
                report.offboard_updates += 1;
            }
            let fresh = tick == 1 || tick % 32 == 0;
            if fresh {
                channels = sticks.channels(stack, arm, active, hover);
                report.stick_updates += 1;
                if channels[6] > 1750 {
                    for j in 0..2 {
                        report.commanded_rate_ff_peak_rad_s[j] = report
                            .commanded_rate_ff_peak_rad_s[j]
                            .max(((channels[7 + j] - 1500) as f64 * 4. / 500.).abs());
                    }
                    for j in 0..3 {
                        report.commanded_accel_ff_peak_rad_s2[j] = report
                            .commanded_accel_ff_peak_rad_s2[j]
                            .max(((channels[9 + j] - 1500) as f64 * 20. / 500.).abs());
                    }
                }
            }
            if tick == 1 || tick % 5 == 0 {
                let (g, a) = plant.imu_flu();
                sampled = noise.apply(g, a, motors);
            }
            if let Some(b) = bf.as_mut() {
                let (m, ar, mo, flags, bytes) =
                    b.step(&plant, tick, channels, fresh, sampled.0, sampled.1)?;
                motors = m;
                armed = ar;
                mode = mo;
                report.arming_flags = flags;
                trace.write_all(&bytes)?;
                report.firmware_exchanges += 1;
            }
            if let Some(tr) = transport.as_mut() {
                if tick % 5 == 0 {
                    let mut adapter = CogniPilotAdapter {
                        exchange: |i: &crate::protocol::LockstepInputs, timeout| {
                            tr.exchange(i, timeout)
                        },
                        origin_enu_m: None,
                    };
                    let s = SensorFrame {
                        target_time_ns: tick as u64 * 125_000,
                        gyro_flu_rad_s: sampled.0,
                        specific_force_flu_m_s2: sampled.1,
                        gnss: gnss.sample(
                            plant.position(),
                            plant.velocity(),
                            tick as u64 * 125_000,
                        ),
                        simulator_state: None,
                    };
                    let response = adapter.step(
                        &s,
                        &PilotCommand {
                            channels_us: channels,
                            square_plan: None,
                            reference: None,
                        },
                        Duration::from_secs(if tick == 5 { 30 } else { 2 }),
                    )?;
                    motors = response.motors;
                    armed = response.diagnostics.flight_state.armed;
                    mode = response.diagnostics.flight_state.flight_mode == 1;
                    trace.write_all(
                        &motors
                            .iter()
                            .flat_map(|v| v.to_le_bytes())
                            .collect::<Vec<_>>(),
                    )?;
                    report.firmware_exchanges += 1;
                }
            }
            if stack == "ideal" {
                armed = arm;
                mode = true;
                let q = quaternion([sticks.roll, sticks.pitch, 0.]);
                plant.set_ideal_attitude(q)?;
                motors = if active {
                    [(sticks.thrust / TMAX).max(0.).sqrt().clamp(0., 1.) as f32; 4]
                } else {
                    [0.; 4]
                };
            }
            if (10.0..land_start).contains(&t) {
                ensure!(
                    armed,
                    "firmware failed to remain armed at {t:.3}; flags={}",
                    report.arming_flags
                );
                ensure!(mode, "self-level mode not active at {t:.3}");
            }
            if calibration && tick % 5 == 0 {
                let e = plant.euler();
                let g = plant.imu_flu().0;
                let row = [
                    t,
                    sticks.roll,
                    sticks.pitch,
                    sticks.yaw_rate,
                    sticks.omega[0],
                    sticks.omega[1],
                    sticks.omega[2],
                    sticks.alpha[0],
                    sticks.alpha[1],
                    sticks.alpha[2],
                    e[0],
                    e[1],
                    e[2],
                    g[0] as f64,
                    g[1] as f64,
                    g[2] as f64,
                ];
                writeln!(
                    cal_log,
                    "{}",
                    row.iter()
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                        .join(",")
                )?;
            }
            plant.step(motors, DT)?;
            let p = plant.position();
            let e = plant.euler();
            ensure!(
                p.iter().chain(e.iter()).all(|v| v.is_finite()),
                "nonfinite plant"
            );
            let outside = !(p[0].abs() < 24. && p[1].abs() < 12. && p[2] < 8.);
            let tilt = (e[0].cos() * e[1].cos()).clamp(-1., 1.).acos().to_degrees();
            report.maximum_tilt_deg = report.maximum_tilt_deg.max(tilt);
            let excessive_tilt = tilt >= 45.;
            if t >= land_start && p[2] < 0.13 && plant.vertical_speed().abs() < 0.1 {
                ground_count += 1;
            } else {
                ground_count = 0;
            }
            if ground_count >= 4000 {
                touchdown = true;
            }
            report.armed_observed |= armed;
            report.mode_observed |= armed && mode;
            if !armed
                && p[2] < 0.13
                && plant.vertical_speed().abs() < 0.1
                && motors.iter().all(|v| *v < 0.001)
            {
                report.grounded_stopped_samples += 1;
            } else {
                report.grounded_stopped_samples = 0;
            }
            if (25.0..=end).contains(&t) {
                let err = (0..3)
                    .map(|j| (p[j] - last_ref[1 + j]).powi(2))
                    .sum::<f64>()
                    .sqrt();
                sum += err * err;
                count += 1;
                report.tracking_max_m = report.tracking_max_m.max(err);
            }
            report.samples += 1;
            report.simulated_seconds = t;
            report.final_position = p;
            report.final_armed = armed;
            report.final_motors = motors;
            if outside || excessive_tilt || tick % 80 == 0 || tick == (finish / DT).round() as u32 {
                let row = vec![
                    t,
                    p[0],
                    p[1],
                    p[2],
                    e[0],
                    e[1],
                    e[2],
                    last_ref[1],
                    last_ref[2],
                    last_ref[3],
                    f64::from(armed),
                    f64::from(mode),
                    motors[0] as f64,
                    motors[1] as f64,
                    motors[2] as f64,
                    motors[3] as f64,
                    channels[6] as f64,
                    channels[7] as f64,
                    channels[8] as f64,
                    channels[9] as f64,
                    channels[10] as f64,
                    channels[11] as f64,
                    channels[2] as f64,
                ];
                writeln!(
                    trajectory,
                    "{}",
                    row.iter()
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                        .join(",")
                )?;
                rows.push(row);
            }
            if count > 0 {
                report.tracking_rms_m = Some((sum / count as f64).sqrt());
            }
            ensure!(!outside, "PURT envelope abort at {p:?}");
            ensure!(!excessive_tilt, "tilt abort {tilt:.2} deg at {t:.3}");
        }
        ensure!(
            report.armed_observed && report.mode_observed,
            "no valid armed self-level flight"
        );
        ensure!(
            report.grounded_stopped_samples >= 4000 && !report.final_armed,
            "landing/disarm/motor-stop not verified"
        );
        ensure!(
            calibration
                || (report.tracking_rms_m.is_some_and(|r| r < 0.35)
                    && report.tracking_max_m < 0.75),
            "commissioning accuracy threshold exceeded"
        );
        Ok(())
    })();
    report.wall_seconds = wall.elapsed().as_secs_f64();
    report.passed = result.is_ok();
    report.error = result.as_ref().err().map(|e| format!("{e:#}"));
    cal_log.flush()?;
    trajectory.flush()?;
    trace.flush()?;
    fs::write(out.join("report.json"), serde_json::to_vec_pretty(&report)?)?;
    let replay_cfg = json!({"width_m":10,"height_m":10,"scale":1,"altitude_m":2,"center_enu_m":[0,0],"lap_time_s":duration,"laps":1,"phase_law":"minimum_jerk_each_lap","id":cfg["id"]});
    fs::write(
        out.join("replay.json"),
        serde_json::to_vec(
            &json!({"stack":stack,"passed":report.passed,"config":replay_cfg,"report":report,"rows":rows.iter().enumerate().map(|(i,r)| {let mut v=r[..7].to_vec();let speed=if i==0{0.}else{let prev=&rows[i-1];(1..4).map(|j|(r[j]-prev[j]).powi(2)).sum::<f64>().sqrt()/(r[0]-prev[0])};v.push(speed);v}).collect::<Vec<_>>()}),
        )?,
    )?;
    println!("{}", serde_json::to_string(&report)?);
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn feedforward_channels_preserve_sign_clamp_and_switch_off() {
        let s = Sticks {
            omega: [8., -8., 0.],
            alpha: [40., -40., 20.],
            feedforward: 2,
            ..Sticks::default()
        };
        for stack in ["betaflight", "cognipilot"] {
            let rc = s.channels(stack, true, true, 0.68);
            assert_eq!(&rc[6..12], &[2000, 2000, 1000, 2000, 1000, 2000]);
            let rc = s.channels(stack, false, true, 0.68);
            assert_eq!(&rc[6..12], &[1000, 1500, 1500, 1500, 1500, 1500]);
            let rc = Sticks {
                feedforward: 0,
                ..s
            }
            .channels(stack, true, true, 0.68);
            assert_eq!(&rc[6..12], &[1000, 1500, 1500, 1500, 1500, 1500]);
        }
    }
    #[test]
    fn common_sticks_have_known_center_hover_and_yaw_scale() {
        let s = Sticks {
            thrust: 2. * 9.80665,
            yaw_rate: 200f64.to_radians(),
            ..Sticks::default()
        };
        let cg = s.channels("cognipilot", true, true, 0.6885);
        let bf = s.channels("betaflight", true, true, 0.6885);
        assert_eq!(&cg[..2], &[1500, 1500]);
        assert_eq!(bf[3], 1000);
        assert_eq!(cg[3], 1001);
        assert_eq!(cg[5], 1500);
        assert_eq!(s.channels("betaflight", false, false, 0.6885)[2], 1000);
    }
    #[test]
    fn noise_seed_repeats_and_profile_zero_is_exact() {
        let mut a = Noise {
            phase: [0.; 4],
            state: 9,
            gyro: 0.01,
            acc: 0.1,
        };
        let mut b = Noise {
            phase: [0.; 4],
            state: 9,
            gyro: 0.01,
            acc: 0.1,
        };
        for _ in 0..100 {
            assert_eq!(
                a.apply([0.; 3], [1.; 3], [0.7; 4]),
                b.apply([0.; 3], [1.; 3], [0.7; 4])
            );
        }
        let mut z = Noise {
            phase: [0.; 4],
            state: 9,
            gyro: 0.,
            acc: 0.,
        };
        assert_eq!(z.apply([2.; 3], [3.; 3], [0.7; 4]), ([2.; 3], [3.; 3]));
    }
}

/// Native reproducible diagnostic matrix. Every failure retains its own directory.
/// Each stack must use its own output root; BF owns the single simulator UDP port.
pub fn campaign(args: impl Iterator<Item = OsString>) -> Result<()> {
    let a: Vec<_> = args.collect();
    ensure!(
        a.len() == 6,
        "shared-sil-campaign CONFIG PLANT_DIRECTORY GENERATED_LIBRARY BINARY STACK OUTPUT_ROOT"
    );
    let mut cfg: Value = serde_json::from_slice(&fs::read(&a[0])?)?;
    let out = PathBuf::from(&a[5]);
    ensure!(!out.exists(), "campaign output already exists; preserve it");
    fs::create_dir_all(&out)?;
    let mut reports = Vec::new();
    for level in ["none", "realistic", "harsh"] {
        for seed in 1..=5 {
            for mode in ["off", "omega_alpha"] {
                cfg["controller"]["feedforward"] = json!(mode);
                let id = format!("{level}-seed-{seed}-{mode}");
                let config = out.join(format!("{id}.json"));
                fs::write(&config, serde_json::to_vec_pretty(&cfg)?)?;
                let flight = out.join(&id);
                let log = File::create(out.join(format!("{id}.log")))?;
                let status = Command::new(std::env::current_exe()?)
                    .arg("shared-sil")
                    .arg(&config)
                    .args(&a[1..5])
                    .arg(&flight)
                    .arg("figure-eight")
                    .arg(seed.to_string())
                    .arg(level)
                    .stdout(log.try_clone()?)
                    .stderr(log)
                    .status()?;
                let report = fs::read(flight.join("report.json"))
                    .ok()
                    .and_then(|b| serde_json::from_slice::<Value>(&b).ok());
                reports.push(json!({"id":id,"exit_success":status.success(),"report":report}));
                fs::write(
                    out.join("campaign.json"),
                    serde_json::to_vec_pretty(
                        &json!({"scope":"diagnostic SIL noise matrix; assumed IMU noise and motor harmonic; unmatched gain tuning","planned_runs":30,"completed_runs":reports.len(),"runs":reports}),
                    )?,
                )?;
                println!(
                    "{id}: {}",
                    if status.success() {
                        "passed"
                    } else {
                        "FAILED; retained"
                    }
                );
            }
        }
    }
    Ok(())
}

/// Publish measured recordings and a complete matrix; refuses partial campaigns.
pub fn export(args: impl Iterator<Item = OsString>) -> Result<()> {
    use std::io::Read;
    let a: Vec<PathBuf> = args.map(PathBuf::from).collect();
    ensure!(
        a.len() == 5,
        "shared-sil-export BF_CAMPAIGN CG_CAMPAIGN BF_RATE_ONLY CG_RATE_ONLY OUTPUT"
    );
    let out = &a[4];
    fs::create_dir_all(out.join("reports"))?;
    let mut all = Vec::<Value>::new();
    let mut cells = Vec::<Value>::new();
    let mut repeatability = Vec::new();
    for (idx, stack) in ["betaflight", "cognipilot"].iter().enumerate() {
        let campaign: Value = serde_json::from_slice(&fs::read(a[idx].join("campaign.json"))?)?;
        ensure!(
            campaign["completed_runs"] == 30,
            "{stack} campaign is incomplete"
        );
        let mut selected = Vec::new();
        for entry in campaign["runs"].as_array().context("campaign runs")? {
            let id = entry["id"].as_str().context("run id")?;
            let dir = a[idx].join(id);
            let report_path = dir.join("report.json");
            let mut report: Value = serde_json::from_slice(&fs::read(&report_path)?)?;
            let record = |field: &str| -> Result<f64> {
                report[field]
                    .as_f64()
                    .with_context(|| format!("missing {field}"))
            };
            let start = record("lap_start_s")?;
            let end = record("lap_end_s")?;
            let frame_len = if *stack == "betaflight" { 64 } else { 16 };
            let dt = if *stack == "betaflight" { DT } else { 5. * DT };
            let trace_path = dir.join("actuator-trace.bin");
            ensure!(
                fs::metadata(&trace_path)?.len() % frame_len as u64 == 0,
                "truncated actuator frame"
            );
            let mut reader = std::io::BufReader::new(File::open(&trace_path)?);
            let mut frame = vec![0u8; frame_len];
            let (mut i, mut n, mut upper, mut lower) = (0u64, 0u64, 0u64, 0u64);
            let (mut slew, mut previous) = (0., None::<[f64; 4]>);
            loop {
                match reader.read_exact(&mut frame) {
                    Ok(()) => {}
                    Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                    Err(e) => return Err(e.into()),
                };
                i += 1;
                let t = i as f64 * dt;
                if t < start || t > end {
                    continue;
                }
                let offset = if *stack == "betaflight" { 8 } else { 0 };
                let m: [f64; 4] = std::array::from_fn(|j| {
                    f32::from_le_bytes(
                        frame[offset + 4 * j..offset + 4 * j + 4]
                            .try_into()
                            .unwrap(),
                    ) as f64
                });
                ensure!(m.iter().all(|x| x.is_finite()), "nonfinite actuator trace");
                upper += u64::from(m.iter().any(|v| *v >= 0.999));
                lower += u64::from(m.iter().any(|v| *v <= 0.001));
                if let Some(p) = previous {
                    slew += (0..4).map(|j| ((m[j] - p[j]) / dt).powi(2)).sum::<f64>() / 4.;
                }
                previous = Some(m);
                n += 1;
            }
            report["actuator_postprocessing"] = json!({"samples":n,"sample_period_s":dt,"any_motor_upper_limit_fraction":(n>0).then(||upper as f64/n as f64),"any_motor_lower_limit_fraction":(n>0).then(||lower as f64/n as f64),"command_slew_rms_per_s":(n>1).then(||(slew/(n-1) as f64).sqrt()),"scope":"native normalized motor commands during reference window; slew includes demanded motion and quantization, not an isolated motor-noise measurement","original_report_sha256":physics::file_sha256(&report_path)?,"trajectory_sha256":physics::file_sha256(&dir.join("trajectory.csv"))?,"actuator_trace_sha256":physics::file_sha256(&trace_path)?});
            let name = format!("{stack}-{id}");
            fs::write(
                out.join("reports").join(format!("{name}.json")),
                serde_json::to_vec_pretty(&report)?,
            )?;
            if id == "none-seed-1-off" || id == "none-seed-1-omega_alpha" {
                let mode = report["sensor_profile"]["feedforward"]
                    .as_str()
                    .unwrap()
                    .to_owned();
                selected.push((mode, dir.clone(), report.clone()));
            }
            all.push(report);
        }
        let rate_dir = &a[idx + 2];
        let rate_report: Value = serde_json::from_slice(&fs::read(rate_dir.join("report.json"))?)?;
        selected.push(("omega".into(), rate_dir.clone(), rate_report));
        for (mode, dir, report) in selected {
            let mut replay: Value = serde_json::from_slice(&fs::read(dir.join("replay.json"))?)?;
            let rows = replay["rows"].as_array().context("replay rows")?;
            let last = rows.len() - 1;
            let slim: Vec<Value> = rows
                .iter()
                .enumerate()
                .filter(|(i, _)| i % 5 == 0 || *i == last)
                .map(|(_, r)| {
                    json!(
                        r.as_array()
                            .unwrap()
                            .iter()
                            .map(|v| (v.as_f64().unwrap() * 1e9).round() / 1e9)
                            .collect::<Vec<_>>()
                    )
                })
                .collect();
            replay["rows"] = json!(slim);
            replay["report"] = report;
            replay["recorded_at_unix_s"] = json!(
                fs::metadata(dir.join("report.json"))?
                    .modified()?
                    .duration_since(std::time::UNIX_EPOCH)?
                    .as_secs()
            );
            replay["selection"] =
                json!("fixed seed 1, no-noise diagnostic; not selected for best error");
            fs::write(
                out.join(format!("{stack}-{mode}.json")),
                serde_json::to_vec(&replay)?,
            )?;
        }
        for noise in ["none", "realistic", "harsh"] {
            for mode in ["off", "omega_alpha"] {
                let rs: Vec<&Value> = all
                    .iter()
                    .filter(|r| {
                        r["stack"] == *stack
                            && r["sensor_profile"]["level"] == noise
                            && r["sensor_profile"]["feedforward"] == mode
                    })
                    .collect();
                ensure!(rs.len() == 5, "incomplete result cell");
                let complete: Vec<f64> = rs
                    .iter()
                    .filter(|r| {
                        r["simulated_seconds"].as_f64().unwrap_or(0.)
                            >= r["lap_end_s"].as_f64().unwrap()
                    })
                    .filter_map(|r| r["tracking_rms_m"].as_f64())
                    .collect();
                let mean = if complete.is_empty() {
                    None
                } else {
                    Some(complete.iter().sum::<f64>() / complete.len() as f64)
                };
                let min = complete.iter().copied().reduce(f64::min);
                let max = complete.iter().copied().reduce(f64::max);
                cells.push(json!({"stack":stack,"noise":noise,"mode":mode,"runs":5,"passed":rs.iter().filter(|r|r["passed"]==true).count(),"completed_reference_windows":complete.len(),"rms_mean_completed":mean,"rms_min_completed":min,"rms_max_completed":max,"worst_tracking_max_m":rs.iter().filter_map(|r|r["tracking_max_m"].as_f64()).reduce(f64::max),"worst_upper_saturation_fraction":rs.iter().filter_map(|r|r["actuator_postprocessing"]["any_motor_upper_limit_fraction"].as_f64()).reduce(f64::max)}));
                if noise == "none" {
                    let first = rs[0];
                    repeatability.push(json!({"stack":stack,"mode":mode,"repeats":5,"trajectory_byte_identical":rs.iter().all(|r|r["actuator_postprocessing"]["trajectory_sha256"]==first["actuator_postprocessing"]["trajectory_sha256"]),"actuator_trace_byte_identical":rs.iter().all(|r|r["actuator_postprocessing"]["actuator_trace_sha256"]==first["actuator_postprocessing"]["actuator_trace_sha256"])}));
                }
            }
        }
    }
    fs::write(
        out.join("campaign-summary.json"),
        serde_json::to_vec_pretty(
            &json!({"exported_at_unix_s":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_secs(),"planned_runs":60,"completed_runs":all.len(),"passed_runs":all.iter().filter(|r|r["passed"]==true).count(),"scope":"40-second commissioning reference; assumed noise; gains not matched; not a fastest-flight or physical latency result","cells":cells,"no_noise_repeatability":repeatability}),
        )?,
    )?;
    Ok(())
}

/// Identical open-loop attitude probes; shared altitude loop remains active.
fn calibration_sticks(sticks: &mut Sticks, shape: &str, t: f64) {
    let event = (t / 6.0).floor() as usize;
    let u = t % 6.0;
    if shape == "attitude-step" && u < 1.2 && event < 4 {
        sticks.roll = 0.;
        sticks.pitch = 0.;
        sticks.omega = [0.; 3];
        sticks.alpha = [0.; 3];
        sticks.feedforward = 0;
        let target = 5f64.to_radians() * if event % 2 == 0 { 1. } else { -1. };
        if event < 2 {
            sticks.roll = target;
        } else {
            sticks.pitch = target;
        }
    }
    if shape == "rate-ramp" && u < 1.2 && event < 3 {
        // Paired ramps: +0.04 rad then -0.04 rad; zero net attitude change.
        // Both signs use alpha magnitude 1 rad/s^2 and peak rate 0.2 rad/s.
        let reverse = u >= 0.6;
        let v = if reverse { u - 0.6 } else { u };
        let (a, r, al) = if v < 0.2 {
            (0.5 * v * v, v, 1.)
        } else if v < 0.4 {
            (
                0.02 + 0.2 * (v - 0.2) - 0.5 * (v - 0.2).powi(2),
                0.4 - v,
                -1.,
            )
        } else {
            (0.04, 0., 0.)
        };
        let (angle, rate, alpha) = if reverse {
            (0.04 - a, -r, -al)
        } else {
            (a, r, al)
        };
        sticks.roll = 0.;
        sticks.pitch = 0.;
        sticks.yaw_rate = 0.;
        sticks.omega = [0.; 3];
        sticks.alpha = [0.; 3];
        sticks.feedforward = 2;
        if event == 0 {
            sticks.roll = angle;
        } else if event == 1 {
            sticks.pitch = angle;
        } else {
            sticks.yaw_rate = rate;
        }
        sticks.omega[event] = rate;
        sticks.alpha[event] = alpha;
    }
}

//! PDF stage-two generated-code checks. This command does not fly firmware.
use anyhow::{Context, Result, ensure};
use libloading::Library;
use serde_json::{Value, json};
use std::{ffi::OsString, fs, io::Write, path::PathBuf, process::Command};

pub fn run(args: impl Iterator<Item = OsString>) -> Result<()> {
    let a: Vec<PathBuf> = args.map(PathBuf::from).collect();
    ensure!(
        a.len() == 4,
        "shared-loop-check CONFIG MODELICA_ROOT RUMOCA OUTPUT_DIRECTORY"
    );
    let cfg: Value = serde_json::from_slice(&fs::read(&a[0])?)?;
    let course = &cfg["course"];
    let scalar = |name: &str| -> Result<f32> {
        let v = course[name]
            .as_f64()
            .with_context(|| format!("course.{name} missing"))?;
        ensure!(v.is_finite() && v > 0. && v <= 3600., "invalid {name}");
        Ok(v as f32)
    };
    let dimensions = [
        scalar("width_m")?,
        scalar("height_m")?,
        scalar("altitude_m")?,
        scalar("lap_time_s")?,
    ];
    ensure!(
        course["laps"] == 1 && course["phase_law"] == "minimum_jerk_each_lap",
        "requires one minimum-jerk lap"
    );
    ensure!(
        course["scale"] == 1 && course["center_enu_m"] == json!([0, 0]) && course["yaw_rad"] == 0,
        "this qualification uses scale=1, centre=[0,0], yaw=0; do not silently ignore placement"
    );
    ensure!(
        cfg["controller"]["sample_rate_hz"] == 100
            && cfg["controller"]["tilt_limit_deg"] == 35
            && cfg["controller"]["yaw_rate_limit_deg_s"] == 200
            && cfg["controller"]["translational_correction_fraction"] == 0.7,
        "controller settings must match the generated Modelica defaults for this qualification"
    );
    fs::create_dir_all(&a[3])?;
    let root = fs::canonicalize(&a[1])?;
    let out = fs::canonicalize(&a[3])?;
    let mut hashes = serde_json::Map::new();
    hashes.insert("config".into(), json!(crate::physics::file_sha256(&a[0])?));
    hashes.insert("rumoca".into(), json!(crate::physics::file_sha256(&a[2])?));
    for model in ["Trajectory", "PositionLoop", "PositionOracle"] {
        let source = root.join(format!("Benchmarks/{model}.mo"));
        let output = Command::new(&a[2])
            .arg("compile")
            .arg(&source)
            .args(["--model", &format!("Benchmarks.{model}"), "--source-root"])
            .arg(&root)
            .args(["--target", "galec-production", "--output"])
            .arg(&out)
            .output()?;
        fs::write(
            out.join(format!("{model}-build.log")),
            [output.stdout, output.stderr].concat(),
        )?;
        ensure!(
            output.status.success(),
            "{model} generation failed; see build log"
        );
        hashes.insert(
            format!("{model}_source"),
            json!(crate::physics::file_sha256(&source)?),
        );
        hashes.insert(
            format!("{model}_efmu"),
            json!(crate::physics::file_sha256(
                &out.join(format!("Benchmarks_{model}.efmu"))
            )?),
        );
    }
    let shim = out.join("shared_loop_shim.c");
    fs::write(&shim, include_str!("shared_loop_shim.c"))?;
    let library = out.join("libshared_loop.so");
    let mut cc = Command::new("cc");
    cc.args(["-std=c11", "-O2", "-fPIC", "-shared"]).arg(&shim);
    for model in ["Trajectory", "PositionLoop", "PositionOracle"] {
        let dir = out.join(format!("Benchmarks_{model}/ProductionCode"));
        cc.arg("-I")
            .arg(&dir)
            .arg(dir.join(format!("Benchmarks_{model}.c")));
    }
    let build = cc
        .arg(out.join("Benchmarks_Trajectory/ProductionCode/rumoca_galec_kernels.c"))
        .arg("-lm")
        .arg("-o")
        .arg(&library)
        .output()?;
    fs::write(
        out.join("cc-build.log"),
        [build.stdout, build.stderr].concat(),
    )?;
    ensure!(build.status.success(), "C build failed; see cc-build.log");
    hashes.insert(
        "library".into(),
        json!(crate::physics::file_sha256(&library)?),
    );
    hashes.insert("shim".into(), json!(crate::physics::file_sha256(&shim)?));
    let result = unsafe { check(&library, dimensions, &out) };
    let report = match &result {
        Ok(metrics) => {
            json!({"passed":true,"scope":"generated-code numerical checks only; not a flight or full PDF qualification","hashes":hashes,"metrics":metrics})
        }
        Err(e) => {
            json!({"passed":false,"scope":"generated-code numerical checks","hashes":hashes,"error":format!("{e:#}")})
        }
    };
    fs::write(out.join("checks.json"), serde_json::to_vec_pretty(&report)?)?;
    result.map(|_| ())
}

// This is an independently evaluated f64 numerical oracle, not the flight generator.
fn analytic(t: f64, d: [f32; 4]) -> [f64; 9] {
    let [w, h, z, tmax] = d.map(f64::from);
    let u = (t / tmax).clamp(0., 1.);
    let q = std::f64::consts::TAU * u.powi(3) * (10. + u * (-15. + 6. * u));
    let v = std::f64::consts::TAU * 30. * u * u * (1. - u).powi(2) / tmax;
    let a = std::f64::consts::TAU * 60. * u * (1. - u) * (1. - 2. * u) / (tmax * tmax);
    [
        w / 2. * q.sin(),
        h / 2. * (2. * q).sin(),
        z,
        w / 2. * q.cos() * v,
        h * (2. * q).cos() * v,
        0.,
        w / 2. * (-q.sin() * v * v + q.cos() * a),
        h * (-2. * (2. * q).sin() * v * v + (2. * q).cos() * a),
        0.,
    ]
}

unsafe fn check(path: &std::path::Path, d: [f32; 4], out: &std::path::Path) -> Result<Value> {
    // The compiler specifies single-instance, non-reentrant workspaces. Calls are serial.
    let lib = unsafe { Library::new(path)? };
    let start = unsafe { lib.get::<unsafe extern "C" fn(f32, f32, f32, f32)>(b"shared_start\0")? };
    let reference =
        unsafe { lib.get::<unsafe extern "C" fn(i32, *mut f32) -> u32>(b"shared_reference\0")? };
    let control = unsafe {
        lib.get::<unsafe extern "C" fn(*const f32, i32, *mut f32) -> u32>(b"shared_control\0")?
    };
    let steps = (f64::from(d[3]) * 100.).ceil() as usize;
    let mut csv = fs::File::create(out.join("reference.csv"))?;
    writeln!(
        csv,
        "time_s,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s,ax_m_s2,ay_m_s2,az_m_s2,yaw_rad,jx,jy,jz,sx,sy,sz"
    )?;
    let mut first = Vec::new();
    let (mut math_error, mut time_error, mut controller_error) = (0f64, 0f64, 0f64);
    let (mut jerk_error, mut snap_error, mut omega_error, mut alpha_error) =
        (0f64, 0f64, 0f64, 0f64);
    let mut low = [f32::INFINITY; 3];
    let mut high = [f32::NEG_INFINITY; 3];
    for repeat in 0..2 {
        unsafe {
            start(d[0], d[1], d[2], d[3]);
        }
        for i in 0..=steps {
            let mut r = [0f32; 17];
            ensure!(
                unsafe { reference(i32::from(i != 0), r.as_mut_ptr()) } == 0,
                "trajectory error at {i}"
            );
            ensure!(r.iter().all(|v| v.is_finite()), "nonfinite reference");
            if repeat == 0 {
                first.push(r);
                writeln!(
                    csv,
                    "{}",
                    r.iter()
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                        .join(",")
                )?;
                let time = (i as f64 / 100.).min(f64::from(d[3]));
                time_error = time_error.max((f64::from(r[0]) - time).abs());
                for (actual, want) in r[1..10].iter().zip(analytic(time, d)) {
                    math_error = math_error.max((f64::from(*actual) - want).abs());
                }
                if i > 1 && i + 1 < steps {
                    let minus = analytic(time - 0.01, d);
                    let plus = analytic(time + 0.01, d);
                    let mid = analytic(time, d);
                    for j in 0..3 {
                        jerk_error = jerk_error.max(
                            (f64::from(r[11 + j]) - (plus[6 + j] - minus[6 + j]) / 0.02).abs(),
                        );
                        snap_error = snap_error.max(
                            (f64::from(r[14 + j])
                                - (plus[6 + j] - 2. * mid[6 + j] + minus[6 + j]) / 0.0001)
                                .abs(),
                        );
                    }
                }
                for j in 0..3 {
                    low[j] = low[j].min(r[j + 1]);
                    high[j] = high[j].max(r[j + 1]);
                }
            } else {
                ensure!(r == first[i], "generated reference not repeatable at {i}");
            }
            let yaw = i as f32 * 0.007;
            let mut input = [0f32; 27];
            input[0] = r[1] + 0.2 * yaw.sin();
            input[1] = r[2] - 0.1 * yaw.cos();
            input[2] = r[3];
            input[3..6].copy_from_slice(&r[4..7]);
            input[6] = (yaw / 2.).cos();
            input[9] = (yaw / 2.).sin();
            input[10..13].copy_from_slice(&r[1..4]);
            input[13..16].copy_from_slice(&r[4..7]);
            input[16..19].copy_from_slice(&r[7..10]);
            input[19] = r[10];
            input[20..26].copy_from_slice(&r[11..17]);
            input[26] = 1.;
            let engaged = i % 101 != 0;
            let mut c = [0f32; 26];
            ensure!(
                unsafe { control(input.as_ptr(), i32::from(engaged), c.as_mut_ptr()) } == 0,
                "controller error at {i}"
            );
            ensure!(c.iter().all(|v| v.is_finite()), "nonfinite control at {i}");
            if engaged && i > 2 && i + 2 < steps {
                let q = [c[5] as f64, c[6] as f64, c[7] as f64, c[8] as f64];
                let z = [
                    2. * (q[1] * q[3] + q[0] * q[2]),
                    2. * (q[2] * q[3] - q[0] * q[1]),
                    1. - 2. * (q[1] * q[1] + q[2] * q[2]),
                ];
                let force = z.map(|v| v * c[3] as f64);
                let j = std::array::from_fn(|k| 2. * r[11 + k] as f64);
                let snap = std::array::from_fn(|k| 2. * r[14 + k] as f64);
                let w = numeric_force_omega(force, j, snap, 0.);
                let wm = numeric_force_omega(force, j, snap, -0.001);
                let wp = numeric_force_omega(force, j, snap, 0.001);
                for j in 0..3 {
                    omega_error = omega_error.max((f64::from(c[20 + j]) - w[j]).abs());
                    alpha_error =
                        alpha_error.max((f64::from(c[23 + j]) - (wp[j] - wm[j]) / 0.002).abs());
                }
            }
            if !engaged {
                ensure!(
                    c[20..26].iter().all(|x| *x == 0.),
                    "FF must clear when disengaged"
                );
            }
            input[26] = 0.;
            let mut disabled = [0f32; 26];
            ensure!(
                unsafe { control(input.as_ptr(), i32::from(engaged), disabled.as_mut_ptr()) } == 0,
                "disabled FF step failed"
            );
            ensure!(
                disabled[20..26].iter().all(|x| *x == 0.),
                "FF switch off must produce zeros"
            );
            for (left, right) in [
                (3, 12),
                (5, 13),
                (6, 14),
                (7, 15),
                (8, 16),
                (9, 17),
                (10, 18),
                (11, 19),
            ] {
                controller_error = controller_error.max(f64::from((c[left] - c[right]).abs()));
            }
            ensure!(
                c[0].abs() <= 0.610866 && c[1].abs() <= 0.610866 && c[2].abs() <= 3.490659,
                "command clamp failure"
            );
            if !engaged {
                ensure!(
                    c[4] == 0. && c[9..12].iter().all(|v| v.abs() < 1e-6),
                    "disengage must clear integral and validity"
                );
            }
        }
    }
    // Integrated orientation gate: zero state error, fixed heading, drag-free
    // reference force. This isolates generated FF, not changing feedback forces.
    unsafe { start(d[0], d[1], d[2], d[3]); }
    let mut orientation_csv = fs::File::create(out.join("orientation-check.csv"))?;
    writeln!(orientation_csv, "time_s,error_rad,desired_w,desired_x,desired_y,desired_z,integrated_w,integrated_x,integrated_y,integrated_z")?;
    let mut integrated_q = [1.0f64, 0., 0., 0.];
    let mut previous_w = [0.0f64; 3];
    let mut orientation_max_error = 0.0f64;
    let mut quaternion_norm_error = 0.0f64;
    for i in 0..=steps {
        let mut r = [0f32; 17];
        ensure!(unsafe { reference(i32::from(i != 0), r.as_mut_ptr()) } == 0, "orientation reference failed");
        let mut input = [0f32; 27];
        input[0..3].copy_from_slice(&r[1..4]);
        input[3..6].copy_from_slice(&r[4..7]);
        input[6] = 1.;
        input[10..13].copy_from_slice(&r[1..4]);
        input[13..16].copy_from_slice(&r[4..7]);
        input[16..19].copy_from_slice(&r[7..10]);
        input[19] = r[10];
        input[20..26].copy_from_slice(&r[11..17]);
        input[26] = 1.;
        let mut c = [0f32; 26];
        ensure!(unsafe { control(input.as_ptr(), 1, c.as_mut_ptr()) } == 0, "orientation controller failed");
        let desired = [c[5] as f64, c[6] as f64, c[7] as f64, c[8] as f64];
        let desired_norm = desired.iter().map(|v| v*v).sum::<f64>().sqrt();
        let desired = desired.map(|v| v/desired_norm);
        let w = [c[20] as f64, c[21] as f64, c[22] as f64];
        ensure!(w.iter().all(|v| v.is_finite() && v.abs()<3.99), "orientation FF clipped or nonfinite");
        if i == 0 { integrated_q = desired; } else {
            let step_w = std::array::from_fn(|k| 0.5*(previous_w[k]+w[k]));
            let angle = dot(step_w, step_w).sqrt()*0.01;
            let delta = if angle<1e-14 { [1.,0.,0.,0.] } else {
                let factor = (angle/2.).sin()*0.01/angle;
                [(angle/2.).cos(),step_w[0]*factor,step_w[1]*factor,step_w[2]*factor]
            };
            integrated_q = quat_product(integrated_q, delta);
        }
        previous_w = w;
        let qnorm = integrated_q.iter().map(|v|v*v).sum::<f64>().sqrt();
        quaternion_norm_error = quaternion_norm_error.max((qnorm-1.).abs());
        let cosine = integrated_q.iter().zip(desired).map(|(a,b)|a*b).sum::<f64>().abs()/qnorm;
        let error = 2.*cosine.clamp(-1.,1.).acos();
        orientation_max_error = orientation_max_error.max(error);
        writeln!(orientation_csv,"{},{},{},{},{},{},{},{},{},{}",r[0],error,desired[0],desired[1],desired[2],desired[3],integrated_q[0],integrated_q[1],integrated_q[2],integrated_q[3])?;
    }
    ensure!(orientation_max_error < 0.0002, "integrated FF orientation mismatch: {orientation_max_error} rad");
    ensure!(quaternion_norm_error < 1e-10, "integrated quaternion norm drift");
    ensure!(
        jerk_error < 0.0002 && snap_error < 0.0002 && omega_error < 0.0002 && alpha_error < 0.0002,
        "feedforward derivative mismatch: {jerk_error}, {snap_error}, {omega_error}, {alpha_error}"
    );
    ensure!(time_error < 1e-5, "sample clock drift {time_error}");
    ensure!(
        math_error < 0.0002,
        "reference numerical error {math_error}"
    );
    ensure!(
        controller_error < 0.00001,
        "GuidanceController mismatch {controller_error}"
    );
    ensure!(
        (high[0] - low[0] - d[0]).abs() < 0.001 && (high[1] - low[1] - d[1]).abs() < 0.001,
        "wrong figure-eight footprint"
    );
    Ok(
        json!({"integrated_orientation_max_error_rad":orientation_max_error,"integrated_quaternion_norm_max_error":quaternion_norm_error,"integrated_orientation_scope":"generated FF, zero position/velocity/orientation state error and fixed heading; reference-force derivatives only; not general closed-loop stability", "jerk_fd_max_error":jerk_error,"snap_fd_max_error":snap_error,"omega_fd_max_error":omega_error,"alpha_fd_max_error":alpha_error,"feedforward_off_and_disengage_zero":true,"samples":steps+1,"exact_reference_repeats":2,"sample_rate_hz":100,
        "position_velocity_acceleration_max_absolute_error":math_error,"clock_max_error_s":time_error,
        "guidance_oracle_max_absolute_error":controller_error,"bounds_min_enu_m":low,"bounds_max_enu_m":high,
        "precision":"generated IEEE float32 versus f64 analytic oracle; not formal floating-point proof",
        "pending_gates":["Betaflight packet lockstep","ideal-attitude common-plant flight","stock ANGLE/ATTITUDE hover and step tests","closed-loop takeoff, square, figure eight and landing","noise and speed campaign"]}),
    )
}

fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    (0..3).map(|i| a[i] * b[i]).sum()
}
fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn unit(a: [f64; 3]) -> [f64; 3] {
    let n = dot(a, a).sqrt();
    a.map(|x| x / n)
}
fn force_axes(f: [f64; 3], j: [f64; 3], s: [f64; 3], t: f64) -> [[f64; 3]; 3] {
    let z = unit(std::array::from_fn(|i| {
        f[i] + j[i] * t + 0.5 * s[i] * t * t
    }));
    let y = unit(cross(z, [1., 0., 0.]));
    [cross(y, z), y, z]
}
fn numeric_force_omega(f: [f64; 3], j: [f64; 3], s: [f64; 3], t: f64) -> [f64; 3] {
    let a = force_axes(f, j, s, t);
    let m = force_axes(f, j, s, t - 0.0001);
    let p = force_axes(f, j, s, t + 0.0001);
    let dx = std::array::from_fn(|i| (p[0][i] - m[0][i]) / 0.0002);
    let dz = std::array::from_fn(|i| (p[2][i] - m[2][i]) / 0.0002);
    [-dot(a[1], dz), dot(a[0], dz), dot(a[1], dx)]
}

fn quat_product(a: [f64;4], b: [f64;4]) -> [f64;4] {
    [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
     a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
     a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
     a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]]
}

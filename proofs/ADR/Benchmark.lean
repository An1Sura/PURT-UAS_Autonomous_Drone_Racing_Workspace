import GNC.Planning.SmoothStep
import Mathlib.Analysis.SpecialFunctions.Trigonometric.Deriv
import Mathlib.Analysis.Real.Pi.Bounds
import Mathlib.MeasureTheory.Integral.IntervalIntegral.Basic

/-! Real-number specification of the benchmark. This is not a verification of
Rust/JavaScript floating-point execution, firmware, sensors or physical flight.
A/B are half-width/half-height; yaw is a heading, not a rotation of the path. -/
noncomputable section
namespace ADR

def phase (T t : ℝ) := GNC.Planning.SmoothStep.blend 0 T 0 (2*Real.pi) t
def phaseRate (T t : ℝ) := GNC.Planning.SmoothStep.blendVelocity 0 T 0 (2*Real.pi) t
def phaseAccel (T t : ℝ) := GNC.Planning.SmoothStep.blendAcceleration 0 T 0 (2*Real.pi) t

theorem phase_derivative (T t : ℝ) : HasDerivAt (phase T) (phaseRate T t) t :=
  GNC.Planning.SmoothStep.blend_derivative 0 T 0 (2*Real.pi) t

theorem phaseRate_derivative (T t : ℝ) : HasDerivAt (phaseRate T) (phaseAccel T t) t :=
  GNC.Planning.SmoothStep.blendVelocity_derivative 0 T 0 (2*Real.pi) t

theorem phase_start (T : ℝ) (hT : 0 < T) : phase T 0 = 0 := by
  exact GNC.Planning.SmoothStep.blend_before hT (le_refl 0)

theorem phase_finish (T : ℝ) (hT : 0 < T) : phase T T = 2*Real.pi := by
  exact GNC.Planning.SmoothStep.blend_after hT (by simp)

theorem phase_rest_start (T : ℝ) : phaseRate T 0 = 0 ∧ phaseAccel T 0 = 0 := by
  simp [phaseRate, phaseAccel, GNC.Planning.SmoothStep.blendVelocity, GNC.Planning.SmoothStep.blendAcceleration,
    GNC.Planning.SmoothStep.velocity, GNC.Planning.SmoothStep.acceleration, GNC.Planning.SmoothStep.join]

theorem phase_rest_finish (T : ℝ) (hT : 0 < T) :
    phaseRate T T = 0 ∧ phaseAccel T T = 0 := by
  simp [phaseRate, phaseAccel, GNC.Planning.SmoothStep.blendVelocity, GNC.Planning.SmoothStep.blendAcceleration,
    div_self (ne_of_gt hT), GNC.Planning.SmoothStep.velocity, GNC.Planning.SmoothStep.acceleration, GNC.Planning.SmoothStep.join, GNC.Planning.SmoothStep.first, GNC.Planning.SmoothStep.second]

theorem phase_rate_bound (T t : ℝ) (hT : 0 < T) :
    |phaseRate T t| ≤ 2*Real.pi*(15/8)/T := by
  simpa [phaseRate, abs_of_pos Real.pi_pos] using
    (GNC.Planning.SmoothStep.blendVelocity_bound (a:=0) (d:=T) (start:=0) (finish:=2*Real.pi) (t:=t) hT)

def x (A q : ℝ) := A * Real.sin q
def y (B q : ℝ) := B * Real.sin (2*q)
def dx (A q : ℝ) := A * Real.cos q
def dy (B q : ℝ) := 2*B * Real.cos (2*q)
def ddx (A q : ℝ) := -A * Real.sin q
def ddy (B q : ℝ) := -4*B * Real.sin (2*q)

theorem x_derivative (A q : ℝ) : HasDerivAt (x A) (dx A q) q := by
  exact (Real.hasDerivAt_sin q).const_mul A

theorem y_derivative (B q : ℝ) : HasDerivAt (y B) (dy B q) q := by
  convert (((hasDerivAt_id q).const_mul 2).sin).const_mul B using 1 <;> simp [y,dy] <;> ring

theorem dx_derivative (A q : ℝ) : HasDerivAt (dx A) (ddx A q) q := by
  convert (Real.hasDerivAt_cos q).const_mul A using 1 <;> simp [dx,ddx] <;> ring

theorem dy_derivative (B q : ℝ) : HasDerivAt (dy B) (ddy B q) q := by
  convert (((hasDerivAt_id q).const_mul 2).cos).const_mul (2*B) using 1 <;> simp [dy,ddy] <;> ring

theorem closed_curve (A B : ℝ) :
    x A 0 = 0 ∧ y B 0 = 0 ∧ x A (2*Real.pi) = 0 ∧ y B (2*Real.pi) = 0 := by
  simp [x,y,show 2*(2*Real.pi) = 2*Real.pi+2*Real.pi by ring, Real.sin_add]

theorem x_bound (A q : ℝ) (hA : 0 ≤ A) : |x A q| ≤ A := by
  simpa [x,abs_mul,abs_of_nonneg hA] using mul_le_mul_of_nonneg_left (Real.abs_sin_le_one q) hA

theorem y_bound (B q : ℝ) (hB : 0 ≤ B) : |y B q| ≤ B := by
  simpa [y,abs_mul,abs_of_nonneg hB] using mul_le_mul_of_nonneg_left (Real.abs_sin_le_one (2*q)) hB

-- Inflated axis bounds imply room containment only IF the error bound holds.
theorem containment (p centre half margin err lo hi : ℝ)
    (hp : |p| ≤ half) (he : |err| ≤ margin)
    (hl : lo ≤ centre-half-margin) (hh : centre+half+margin ≤ hi) :
    lo ≤ centre+p+err ∧ centre+p+err ≤ hi := by
  obtain ⟨hp0,hp1⟩ := abs_le.mp hp
  obtain ⟨he0,he1⟩ := abs_le.mp he
  constructor <;> linarith

theorem scaled_geometry (A B k q : ℝ) :
    x (k*A) q = k*x A q ∧ y (k*B) q = k*y B q := by
  constructor <;> simp [x,y] <;> ring

def vx (A T t : ℝ) := dx A (phase T t) * phaseRate T t
def vy (B T t : ℝ) := dy B (phase T t) * phaseRate T t

theorem timed_x_derivative (A T t : ℝ) :
    HasDerivAt (fun s => x A (phase T s)) (vx A T t) t :=
  (x_derivative A (phase T t)).comp t (phase_derivative T t)

theorem timed_y_derivative (B T t : ℝ) :
    HasDerivAt (fun s => y B (phase T s)) (vy B T t) t :=
  (y_derivative B (phase T t)).comp t (phase_derivative T t)

def ax (A T t : ℝ) := ddx A (phase T t) * (phaseRate T t)^2 + dx A (phase T t)*phaseAccel T t
def ay (B T t : ℝ) := ddy B (phase T t) * (phaseRate T t)^2 + dy B (phase T t)*phaseAccel T t

theorem vx_derivative (A T t : ℝ) : HasDerivAt (vx A T) (ax A T t) t := by
  convert ((dx_derivative A (phase T t)).comp t (phase_derivative T t)).mul
    (phaseRate_derivative T t) using 1 <;> simp [vx,ax] <;> ring

theorem vy_derivative (B T t : ℝ) : HasDerivAt (vy B T) (ay B T t) t := by
  convert ((dy_derivative B (phase T t)).comp t (phase_derivative T t)).mul
    (phaseRate_derivative T t) using 1 <;> simp [vy,ay] <;> ring

theorem rest_at_end (A B T : ℝ) (hT : 0 < T) :
    vx A T T = 0 ∧ vy B T T = 0 ∧ ax A T T = 0 ∧ ay B T T = 0 := by
  obtain ⟨hv,ha⟩ := phase_rest_finish T hT
  simp [vx,vy,ax,ay,hv,ha]

-- The phase at a proportionally stretched time is unchanged.
theorem phase_stretch (T t s : ℝ) (hs : s ≠ 0) : phase (s*T) (s*t) = phase T t := by
  simp only [phase,GNC.Planning.SmoothStep.blend,sub_zero,zero_add]
  congr 2
  field_simp

theorem rate_stretch (T t s : ℝ) (hs : s ≠ 0) : phaseRate (s*T) (s*t) = phaseRate T t / s := by
  simp only [phaseRate,GNC.Planning.SmoothStep.blendVelocity,sub_zero]
  rw [mul_div_mul_left t T hs]
  ring

theorem accel_stretch (T t s : ℝ) (hs : s ≠ 0) : phaseAccel (s*T) (s*t) = phaseAccel T t / s^2 := by
  simp only [phaseAccel,GNC.Planning.SmoothStep.blendAcceleration,sub_zero]
  rw [mul_div_mul_left t T hs]
  ring

theorem velocity_scaling (A B T t k s : ℝ) (hs : s ≠ 0) :
    vx (k*A) (s*T) (s*t) = k/s * vx A T t ∧
    vy (k*B) (s*T) (s*t) = k/s * vy B T t := by
  simp [vx,vy,dx,dy,phase_stretch T t s hs,rate_stretch T t s hs]
  constructor <;> ring

theorem acceleration_scaling (A B T t k s : ℝ) (hs : s ≠ 0) :
    ax (k*A) (s*T) (s*t) = k/s^2 * ax A T t ∧
    ay (k*B) (s*T) (s*t) = k/s^2 * ay B T t := by
  simp [ax,ay,ddx,ddy,dx,dy,phase_stretch T t s hs,
    rate_stretch T t s hs,accel_stretch T t s hs]
  constructor <;> ring

-- Time-tangential acceleration cancels out of the planar cross product.
theorem lateral_cross (px py pxx pyy w alpha : ℝ) :
    (px*w)*(pyy*w^2+py*alpha)-(py*w)*(pxx*w^2+px*alpha) =
    (px*pyy-py*pxx)*w^3 := by ring

def nativeRate (radius speed : ℝ) := min (max speed 1 / radius) (1/4)
def nativePeriod (radius speed : ℝ) := 2*Real.pi / nativeRate radius speed

theorem betaflight_effective_rate : nativeRate 4 (56/100) = 1/4 := by norm_num [nativeRate]
theorem betaflight_period : nativePeriod 4 (56/100) = 8*Real.pi := by
  rw [nativePeriod,betaflight_effective_rate]; ring

theorem old_hold_exceeds_one_cycle : nativePeriod 4 (56/100) < 45 := by
  rw [betaflight_period]
  nlinarith [Real.pi_lt_four]

-- Positive time rounded upward to deciseconds never shortens the command,
-- and adds less than one decisecond. This is an exact-real specification.
theorem decisecond_rounding (duration : ℝ) :
    duration ≤ (⌈duration*10⌉ : ℤ)/10 ∧ (⌈duration*10⌉ : ℤ)/10 < duration+1/10 := by
  constructor
  · have h := Int.le_ceil (duration*10); linarith
  · have h := Int.ceil_lt_add_one (duration*10); linarith


theorem corrected_hold_bounds :
    (251:ℝ)/10 < nativePeriod 4 (56/100) ∧ nativePeriod 4 (56/100) < (252:ℝ)/10 := by
  rw [betaflight_period]
  constructor <;> nlinarith [Real.pi_gt_d2,Real.pi_lt_d4]

theorem corrected_hold_deciseconds : ⌈nativePeriod 4 (56/100)*10⌉ = (252:ℤ) := by
  apply Int.ceil_eq_iff.mpr
  obtain ⟨hl,hu⟩ := corrected_hold_bounds
  constructor <;> norm_num <;> linarith

def density (A B q : ℝ) := Real.sqrt ((dx A q)^2+(dy B q)^2)
def pathLength (A B : ℝ) := ∫ q in (0:ℝ)..2*Real.pi, density A B q

theorem density_scaling (A B k q : ℝ) (hk : 0 ≤ k) :
    density (k*A) (k*B) q = k*density A B q := by
  unfold density dx dy
  rw [show (k*A*Real.cos q)^2+(2*(k*B)*Real.cos (2*q))^2 =
    k^2*((A*Real.cos q)^2+(2*B*Real.cos (2*q))^2) by ring]
  rw [Real.sqrt_mul (sq_nonneg k),Real.sqrt_sq hk]

theorem path_length_scaling (A B k : ℝ) (hk : 0 ≤ k) :
    pathLength (k*A) (k*B) = k*pathLength A B := by
  unfold pathLength
  simp_rw [density_scaling A B k _ hk]
  exact intervalIntegral.integral_const_mul k (density A B)

def signedCurvature (A B q : ℝ) :=
    (dx A q*ddy B q-dy B q*ddx A q) / (density A B q)^3

theorem curvature_scaling (A B k q : ℝ) (hk : 0 < k) :
    signedCurvature (k*A) (k*B) q = signedCurvature A B q / k := by
  unfold signedCurvature
  rw [density_scaling A B k q hk.le]
  unfold dx dy ddx ddy
  field_simp
  <;> ring


theorem phase_strictly_increases (T : ℝ) (hT : 0 < T) :
    StrictMonoOn (phase T) (Set.Icc 0 T) := by
  apply strictMonoOn_of_deriv_pos (convex_Icc 0 T)
  · intro t _
    exact (phase_derivative T t).continuousAt.continuousWithinAt
  · intro t ht
    rw [interior_Icc] at ht
    rw [(phase_derivative T t).deriv]
    have hu0 : 0 < t/T := div_pos ht.1 hT
    have hu1 : t/T < 1 := (div_lt_one hT).mpr ht.2
    have hu2 : 0 < 1-t/T := sub_pos.mpr hu1
    simp only [phaseRate,GNC.Planning.SmoothStep.blendVelocity,sub_zero,
      GNC.Planning.SmoothStep.velocity,GNC.Planning.SmoothStep.join,
      if_neg (not_le.mpr hu0),if_pos hu1.le,GNC.Planning.SmoothStep.first]
    positivity

theorem source_polynomial_matches (u : ℝ) :
    u^3*(10+u*(-15+6*u)) = GNC.Planning.SmoothStep.polynomial u := by
  unfold GNC.Planning.SmoothStep.polynomial
  ring

theorem rest_at_start (A B T : ℝ) :
    vx A T 0 = 0 ∧ vy B T 0 = 0 ∧ ax A T 0 = 0 ∧ ay B T 0 = 0 := by
  obtain ⟨hv,ha⟩ := phase_rest_start T
  simp [vx,vy,ax,ay,hv,ha]

theorem old_hold_between_one_and_two_cycles :
    1 < 45 / nativePeriod 4 (56/100) ∧ 45 / nativePeriod 4 (56/100) < 2 := by
  have hp : 0 < nativePeriod 4 (56/100) := by rw [betaflight_period]; positivity
  constructor
  · rw [lt_div_iff₀ hp]
    simpa using old_hold_exceeds_one_cycle
  · rw [div_lt_iff₀ hp,betaflight_period]
    nlinarith [Real.pi_gt_three]

end ADR

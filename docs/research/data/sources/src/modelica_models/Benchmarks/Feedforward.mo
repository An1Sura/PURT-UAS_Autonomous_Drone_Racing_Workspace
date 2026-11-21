within Benchmarks;
block Feedforward "Differential-flatness derivatives, fixed reference yaw, ENU/FLU"
  input Real thrust; input Real desiredQuaternion[4]; input Real jerk[3]; input Real snap[3];
  input Real yaw; input Boolean enabled;
  output Real omega[3]; output Real alpha[3];
protected
  Real x[3]; Real dx[3]; Real ddx[3];
  Real y[3]; Real dy[3]; Real ddy[3];
  Real z[3]; Real dz[3]; Real ddz[3]; Real heading[3];
equation
  heading = {cos(yaw),sin(yaw),0.0};
  (z,dz,ddz) = Benchmarks.normalizeJet(
    if thrust > 0.001 then thrust*LieGroups.SO3.Quat.rotate(desiredQuaternion,{0.0,0.0,1.0}) else {0.0,0.0,1.0},
    if thrust > 0.001 then 2.0*jerk else zeros(3),
    if thrust > 0.001 then 2.0*snap else zeros(3));
  (y,dy,ddy) = Benchmarks.normalizeJet(cross(z,heading),cross(dz,heading),cross(ddz,heading));
  x = cross(y,z); dx = cross(dy,z)+cross(y,dz);
  ddx = cross(ddy,z)+2*cross(dy,dz)+cross(y,ddz);
  omega = if enabled and thrust > 0.001 then MathUtilities.clipVector({-y*dz,x*dz,y*dx},-4.0,4.0) else zeros(3);
  alpha = if enabled and thrust > 0.001 then MathUtilities.clipVector({-dy*dz-y*ddz,dx*dz+x*ddz,dy*dx+y*ddx},-20.0,20.0) else zeros(3);
end Feedforward;

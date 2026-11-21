within Benchmarks;
model IdealAttitudePlant "Test gate: common RDD2 forces, motors, drag and ground; prescribed attitude only"
  input Real idealQuaternion[4](start={1,0,0,0});
  extends Vehicles.Rdd2.Plant(dynamics(idealAttitude=true,attitudeOverride=idealQuaternion));
end IdealAttitudePlant;

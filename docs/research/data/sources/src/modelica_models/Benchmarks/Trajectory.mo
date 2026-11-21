within Benchmarks;
block Trajectory "One shared, engage-triggered timed reference for square or figure eight"
  parameter Real samplePeriod = 0.01;
  parameter Real width = 10.0;
  parameter Real height = 10.0;
  parameter Real altitude = 2.0;
  parameter Real lapTime = 80.0;
  parameter Integer shape = 3 "0 hover; 1 half-metre step; 2 square; 3 figure eight";
  input Boolean engage(start = false);
  output Real position[3];
  output Real velocity[3];
  output Real acceleration[3];
  output Real jerk[3];
  output Real snap[3];
  output Real yaw;
  output Real elapsed;
protected
  Real dddq;
  Real ddddq;
  discrete Integer tick(start = 0, fixed = true);
  Real u;
  Real q;
  Real dq;
  Real ddq;
  Real blend;
  Real blendRate;
  Real blendAccel;
  Real localTime;
  Real legTime;
  Real leg;
  Real startPoint[2];
  Real endPoint[2];
  Real delta[2];
equation
  dddq = 2*3.141592653589793*60*(1-6*u+6*u^2)/lapTime^3;
  ddddq = 2*3.141592653589793*360*(2*u-1)/lapTime^4;
  elapsed = min(tick*samplePeriod,lapTime);
  u = MathUtilities.clip(elapsed/lapTime,0.0,1.0);
  q = 2.0*3.141592653589793*u^3*(10.0+u*(-15.0+6.0*u));
  dq = 2.0*3.141592653589793*30.0*u^2*(1.0-u)^2/lapTime;
  ddq = 2.0*3.141592653589793*60.0*u*(1.0-u)*(1.0-2.0*u)/lapTime^2;
  legTime = lapTime/4.0;
  leg = min(3.0,floor(elapsed/legTime));
  localTime = MathUtilities.clip((elapsed-leg*legTime)/legTime,0.0,1.0);
  blend = localTime^3*(10.0+localTime*(-15.0+6.0*localTime));
  blendRate = 30.0*localTime^2*(1.0-localTime)^2/legTime;
  blendAccel = 60.0*localTime*(1.0-localTime)*(1.0-2.0*localTime)/legTime^2;
  startPoint = if leg < 0.5 then {0.0,0.0} elseif leg < 1.5 then {width,0.0} elseif leg < 2.5 then {width,height} else {0.0,height};
  endPoint = if leg < 0.5 then {width,0.0} elseif leg < 1.5 then {width,height} elseif leg < 2.5 then {0.0,height} else {0.0,0.0};
  delta = endPoint-startPoint;
  position = if shape == 3 then {width/2.0*sin(q),height/2.0*sin(2.0*q),altitude}
    elseif shape == 2 then {startPoint[1]+delta[1]*blend,startPoint[2]+delta[2]*blend,altitude}
    elseif shape == 1 then {if elapsed >= 1.0 then 0.5 else 0.0,0.0,altitude} else {0.0,0.0,altitude};
  velocity = if shape == 3 then {width/2.0*cos(q)*dq,height*cos(2.0*q)*dq,0.0}
    elseif shape == 2 then {delta[1]*blendRate,delta[2]*blendRate,0.0} else zeros(3);
  acceleration = if shape == 3 then {width/2.0*(-sin(q)*dq^2+cos(q)*ddq),height*(-2.0*sin(2.0*q)*dq^2+cos(2.0*q)*ddq),0.0}
    elseif shape == 2 then {delta[1]*blendAccel,delta[2]*blendAccel,0.0} else zeros(3);
  jerk = if shape == 3 then {width/2*(-cos(q)*dq^3-3*sin(q)*dq*ddq+cos(q)*dddq),
    height*(-4*cos(2*q)*dq^3-6*sin(2*q)*dq*ddq+cos(2*q)*dddq),0.0}
    elseif shape == 2 then {delta[1],delta[2],0.0}*60*(1-6*localTime+6*localTime^2)/legTime^3 else zeros(3);
  snap = if shape == 3 then {width/2*(sin(q)*dq^4-6*cos(q)*dq^2*ddq-3*sin(q)*ddq^2-4*sin(q)*dq*dddq+cos(q)*ddddq),
    height*(8*sin(2*q)*dq^4-24*cos(2*q)*dq^2*ddq-6*sin(2*q)*ddq^2-8*sin(2*q)*dq*dddq+cos(2*q)*ddddq),0.0}
    elseif shape == 2 then {delta[1],delta[2],0.0}*360*(2*localTime-1)/legTime^4 else zeros(3);
  yaw = 0.0;
algorithm
  when sample(0.0,samplePeriod) then
    tick := if not engage then 0 elseif pre(tick)*samplePeriod < lapTime then pre(tick)+1 else pre(tick);
  end when;
end Trajectory;

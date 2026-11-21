import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sampleRecordedPose} from './metrics.js';
const colors=[0x2877c7,0xd67b32];
export function createViewer(container,flights,onTime){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xf7f9fb);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;container.prepend(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(42,1,.05,200);camera.position.set(10,12,14);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=true;controls.minDistance=1.5;controls.maxDistance=85;controls.maxPolarAngle=Math.PI*.49;
 scene.add(new THREE.HemisphereLight(0xffffff,0xb8c5d0,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(8,20,10);light.castShadow=true;light.shadow.mapSize.set(1024,1024);scene.add(light);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(70,55),new THREE.MeshStandardMaterial({color:0xf7f9fb,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(40,40,0xc7d2da,0xe3e9ee);grid.material.transparent=true;grid.material.opacity=.65;scene.add(grid);
 const point=r=>new THREE.Vector3(r.x_m,r.z_m,-r.y_m);
 const line=(points,color,dashed=false)=>{const g=new THREE.BufferGeometry().setFromPoints(points);const m=dashed?new THREE.LineDashedMaterial({color,dashSize:.15,gapSize:.10,transparent:true,opacity:.8}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.85});const l=new THREE.Line(g,m);l.computeLineDistances();scene.add(l);return l;};
 const firstTime=Math.min(...flights.map(f=>f.telemetry[0].time_s)),lastTime=Math.max(...flights.map(f=>f.telemetry.at(-1).time_s));
 const ref=flights[0].telemetry.filter(r=>r.time_s>=flights[0].report.lap_start_s&&r.time_s<=flights[0].report.lap_end_s).filter((_,i)=>i%3===0);line(ref.map(r=>new THREE.Vector3(r.ref_x,r.ref_z,-r.ref_y)),0x82919d,true);
 for(const f of flights)line(f.telemetry.filter((_,i)=>i%3===0).map(point),colors[flights.indexOf(f)]);
 // Geometric reference bounds only. No inferred obstacles or calibrated capture region.
 line([[-5,2,-5],[5,2,-5],[5,2,5],[-5,2,5],[-5,2,-5]].map(p=>new THREE.Vector3(...p)),0xbbc6cc,true);
 const box=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(53.34,9.144,28.956)),new THREE.LineBasicMaterial({color:0x99b4a2,transparent:true,opacity:.35}));box.position.y=9.144/2;scene.add(box);
 const labels=[];function label(text,x,z){const c=document.createElement('canvas');c.width=384;c.height=64;const ctx=c.getContext('2d');ctx.font='26px sans-serif';ctx.fillStyle='#7d8f9c';ctx.textAlign='center';ctx.fillText(text,192,42);const texture=new THREE.CanvasTexture(c),sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true}));sp.position.set(x,.1,z);sp.scale.set(3.8,.63,1);scene.add(sp);labels.push(sp);}
 label('EAST  →',7,7);label('NORTH  ↑',-7,-6);label('10 × 10 m',0,6.3);
 function drone(color){const g=new THREE.Group(),dark=new THREE.MeshStandardMaterial({color:0x293b48,roughness:.6,metalness:.2}),accent=new THREE.MeshStandardMaterial({color,roughness:.35});const body=new THREE.Mesh(new THREE.BoxGeometry(.21,.09,.15),dark);body.castShadow=true;g.add(body);const battery=new THREE.Mesh(new THREE.BoxGeometry(.14,.07,.10),accent);battery.position.y=.07;g.add(battery);const d=.25/Math.sqrt(2);for(const [x,z] of [[d,d],[-d,d],[-d,-d],[d,-d]]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.25,.025,.025),dark);arm.position.set(x/2,0,z/2);arm.rotation.y=-Math.atan2(z,x);g.add(arm);const motor=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.045,12),accent);motor.position.set(x,.015,z);g.add(motor);const prop=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.002,24),new THREE.MeshStandardMaterial({color,transparent:true,opacity:.22,side:THREE.DoubleSide}));prop.position.set(x,.045,z);g.add(prop);const leg=new THREE.Mesh(new THREE.BoxGeometry(.015,.10,.015),dark);leg.position.set(x*.8,-.06,z*.8);g.add(leg);}const nose=new THREE.Mesh(new THREE.SphereGeometry(.025,12,8),new THREE.MeshBasicMaterial({color}));nose.position.set(.12,.02,0);g.add(nose);scene.add(g);return g;}
 const vehicles=colors.map(drone),C=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),Ci=C.clone().invert();
 let time=25,playing=false,speed=1,mode='orbit',disposed=false,last=performance.now(),lastNotify=0;
 const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(container);
 function frame(now){if(disposed)return;requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;if(playing){time=Math.min(lastTime,time+dt*speed);if(time>=lastTime)playing=false;}
 flights.forEach((f,i)=>{const r=sampleRecordedPose(f.telemetry,time);vehicles[i].position.copy(point(r));const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(r.roll_rad,r.pitch_rad,r.yaw_rad,'ZYX'));vehicles[i].quaternion.copy(C).multiply(q).multiply(Ci);});
 if(mode==='follow-cognipilot'||mode==='follow-betaflight'){const p=vehicles[mode==='follow-cognipilot'?0:1].position;controls.target.lerp(p,.12);camera.position.lerp(p.clone().add(new THREE.Vector3(2.8,2.5,3.5)),.07);}controls.update();renderer.render(scene,camera);
 if(now-lastNotify>50){onTime(time,playing);lastNotify=now;}}
 requestAnimationFrame(frame);
 return {get time(){return time;},get playing(){return playing;},setTime(t){time=Math.max(firstTime,Math.min(lastTime,t));onTime(time,playing);},play(){playing=!playing;},setSpeed(v){speed=v;},setCamera(v){mode=v;if(v==='top'){camera.position.set(0,23,.01);controls.target.set(0,0,0);}else if(v==='orbit'){camera.position.set(10,12,14);controls.target.set(0,1,0);}controls.update();},destroy(){disposed=true;resize.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}}});renderer.dispose();renderer.domElement.remove();}};
}

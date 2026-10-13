import assert from 'node:assert/strict';
import {rigFoot,sagaRigPose} from '../.checks/saga-animation.js';
const pose=p=>sagaRigPose({time:0,motion:true,...p});
for(const boundary of [0,Math.PI*1.2,Math.PI*2]){
 const a=rigFoot(boundary-1e-6),z=rigFoot(boundary+1e-6);
 assert.ok(Math.hypot(a.x-z.x,a.y-z.y)<1e-5,'foot motion is continuous across lift-off and loop boundaries');
}
let previous=pose({walking:true,gait:1,phase:0});
for(let i=1;i<=240;i++){
 const next=pose({time:i/60,walking:true,gait:1,phase:i/60*5.6});
 assert.ok(Math.abs(next.near.x-previous.near.x)<.015,'short steps do not snap between render frames');
 assert.ok(Math.abs(next.near.y)<=.035 && Math.abs(next.tail)<.031 && Math.abs(next.head)<=.0021,'the rig stays within gentle movement limits');
 previous=next;
}
assert.ok(Math.abs(rigFoot(Math.PI*2*.3).x)<1e-10,'the first supporting paw begins under the hip, not sliding forward');
assert.equal(rigFoot(Math.PI*.4).y,0,'stance keeps the foot on the ground');
assert.ok(rigFoot(Math.PI*1.6).y<0,'return lifts the paw briefly');
assert.equal(pose({time:1,walking:true,attack:.6,hurt:.8,motion:false}).near.x,0);
assert.equal(pose({time:1,walking:true,attack:.6,hurt:.8,motion:false}).head,0);
assert.equal(pose({attack:.8}).state,'attack');
assert.equal(pose({cast:.8,ward:true}).state,'ward');
const landing=pose({walking:false,gait:1,phase:Math.PI*1.6,landing:1});
assert.ok(landing.near.y===0,'an interrupted swing can land without moving horizontally');
assert.equal(landing.near.x,rigFoot(Math.PI*1.6).x);
const rest=pose({walking:false,gait:1,phase:Math.PI,time:1});
const later=pose({walking:false,gait:1,phase:Math.PI,time:2});
assert.deepEqual(rest.near,later.near,'a resting paw holds the planted stance');
assert.deepEqual(rest.far,later.far,'the other resting paw does not slide inward');
assert.equal(rest.state,'idle');
const beetleA=rigFoot(0),beetleB=rigFoot(Math.PI*.4);
assert.ok(-beetleB.x*1.5 > -beetleA.x*1.5,'a left-facing beetle moves its planted foot right relative to its body');
console.log('PASS Saga continuous rig: planted stance, eased foot return, continuous loop boundaries, gentle joint limits, action state and reduced motion.');

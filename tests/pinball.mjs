import assert from'node:assert/strict';import{Game,STEP,FLIPPERS,TARGETS,RADIUS}from'../.checks/pinball-game.js';import{play}from'./pinball-bot.mjs';
const controls={left:false,right:false,launch:false};const tick=(g,seconds,input=controls)=>{for(let t=0;t<seconds-1e-10;t+=STEP)g.update(STEP,input);};const ball=g=>{g.launch(1);g.balls[0].launcher=false;g.balls[0].cool=0;return g.balls[0];};
{
 const g=new Game();tick(g,.5,{...controls,launch:true});assert.ok(g.charge>.44&&g.charging);g.update(STEP);assert.equal(g.state,'play');assert.equal(g.balls.length,1);assert.ok(g.balls[0].vy<-1100);assert.equal(g.launch(1),false);g.pause(true);const before=g.save();tick(g,1,{left:true,right:true,launch:true});assert.equal(g.save(),before);assert.equal(g.charge,0);g.pause(false);tick(g,.1);assert.equal(g.angles[0],FLIPPERS[0].rest);
 const cancel=new Game();tick(cancel,.4,{...controls,launch:true});cancel.release();tick(cancel,.1);assert.equal(cancel.state,'ready','cancelled launch does not release a ball');
}
{
 const g=new Game(),b=ball(g);Object.assign(b,{x:420,y:800,vx:0,vy:450});tick(g,.045,{...controls,left:true});assert.ok(b.vy<0,'the rising flipper transfers momentum to the ball');assert.ok(Math.hypot(b.vx,b.vy)<=1550.01);
 const r=new Game(),p=ball(r);Object.assign(p,{x:580,y:800,vx:0,vy:450});tick(r,.045,{...controls,right:true});assert.ok(p.vy<0);
 const c=new Game(),a=ball(c);Object.assign(a,{x:500,y:550,vx:100,vy:0});c.balls.push({...a,id:c.nextId++,x:516,vx:-100});c.maxBalls=2;c.multiball=true;c.update(STEP);assert.ok(a.vx<0&&c.balls[1].vx>0);assert.ok(Math.hypot(a.x-c.balls[1].x,a.y-c.balls[1].y)>=RADIUS*2-.1);
}
{
 const g=new Game(),b=ball(g);for(let i=0;i<3;i++){Object.assign(b,{...TARGETS[i],y:TARGETS[i].y+22,vx:0,vy:-250,cool:0});g.update(STEP);}assert.equal(g.rescues,1);assert.equal(g.score,13000);assert.ok(g.lamps.every(Boolean));assert.ok(g.events.some(e=>e.t==='rescue'));tick(g,3.1);assert.ok(g.lamps.every(v=>!v));
}
{
 const g=new Game();for(let i=0;i<3;i++){const b=ball(g);Object.assign(b,{x:715,y:500,vx:0,vy:-300});g.update(STEP);assert.equal(b.rail,'right');assert.ok(Game.load(g.save()),'ramp entry is resumable');tick(g,.86);if(i<2){assert.equal(g.state,'ready');assert.equal(g.ballNo,1);assert.equal(g.locks,i+1);}}
 assert.ok(g.multiball);assert.equal(g.balls.length,3);assert.equal(g.maxBalls,3);assert.equal(g.locks,0);assert.ok(g.balls.every(b=>b.moon));assert.ok(g.events.some(e=>e.t==='multiball'));
 const dust=new Game(),b=ball(dust);Object.assign(b,{x:780,y:240,vx:0,vy:-300});dust.update(STEP);assert.equal(b.rail,'dust');tick(dust,.7);assert.equal(dust.locks,1);
}
{
 const g=new Game(),b=ball(g);Object.assign(b,{x:500,y:1025,vx:0,vy:100});g.update(STEP);assert.equal(g.ballNo,1);assert.equal(g.balls.length,1);assert.ok(g.events.some(e=>e.t==='save'));g.saveUntil=0;Object.assign(g.balls[0],{x:500,y:1025,vx:0,vy:100});g.update(STEP);assert.equal(g.ballNo,2);assert.equal(g.state,'ready');
 for(let i=0;i<2;i++){const p=ball(g);g.saveUntil=0;Object.assign(p,{x:500,y:1025,vx:0,vy:100});g.update(STEP);}assert.ok(g.ended);assert.equal(Game.load(g.save()),null);
 const practice=new Game('practice');for(let i=0;i<4;i++){const p=ball(practice);practice.saveUntil=0;Object.assign(p,{x:500,y:1025,vx:0,vy:100});practice.update(STEP);}assert.equal(practice.state,'ready');assert.equal(practice.ballNo,5);
}
{
 const g=new Game();g.launch(1);for(let i=0;i<3;i++){assert.ok(g.nudge());if(i<2)tick(g,.46);}assert.ok(g.tiltUntil>g.time);assert.equal(g.nudge(),false);tick(g,.08,{left:true,right:true,launch:false});assert.equal(g.angles[0],FLIPPERS[0].rest);
 const a=new Game('arcade',12),b=new Game('arcade',12);a.launch(.8);b.launch(.8);for(let i=0;i<60;i++)a.update(1/60);for(let i=0;i<240;i++)b.update(STEP);assert.deepEqual(a.balls,b.balls,'frame subdivision does not change physics');
 const restored=Game.load(a.save());assert.ok(restored?.paused);restored.pause(false);a.release();tick(a,.2);tick(restored,.2);assert.equal(restored.save(),a.save());
 for(const patch of[{v:2},{state:'over'},{score:-1},{balls:[]},{angles:[99,0]},{lamps:[]},{locks:3},{mode:'casino'},{accumulator:9}]){const s=JSON.parse(a.save());Object.assign(s,patch);assert.equal(Game.load(JSON.stringify(s)),null);}assert.equal(Game.load('broken'),null);
}
let snapshots=0;for(let seed=1;seed<=3;seed++){const g=play(seed,.6+seed*.1,80,run=>{if(!run.ended){snapshots++;assert.ok(Game.load(run.save()),`save at ${run.time.toFixed(3)}s`);}});assert.ok(g.score>=1000);assert.ok(g.hits+g.ramps>0);console.log(`Seed ${seed}: ${g.score} points, ${g.hits} bumper hits, ${g.ramps} ramps, peak ${g.maxBalls} balls.`);}
console.log(`Pinball: charge/cancel, physical flippers, ball collisions, rescue, ramps/dust/locks/multiball, saves, drains, practice, tilt and ${snapshots} in-play snapshots pass.`);

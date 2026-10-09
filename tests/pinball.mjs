import assert from'node:assert/strict';import{Game,STEP,FLIPPERS,TARGETS,RADIUS,MAX_SPEED,SLINGS,LAUNCH}from'../.checks/pinball-game.js';import{play}from'./pinball-bot.mjs';
const controls={left:false,right:false,launch:false};const tick=(g,seconds,input=controls)=>{for(let t=0;t<seconds-1e-10;t+=STEP)g.update(STEP,input);};const ball=g=>{g.launch(1);g.balls[0].launcher=false;g.balls[0].cool=0;return g.balls[0];};
{
 const g=new Game();tick(g,.5,{...controls,launch:true});assert.ok(g.charge>.44&&g.charging);g.update(STEP);assert.equal(g.state,'play');assert.equal(g.balls.length,1);assert.ok(g.balls[0].vy<-900);assert.ok(g.balls[0].launcher&&Math.abs(g.balls[0].x-LAUNCH.x)<1);assert.equal(g.launch(1),false);g.pause(true);const before=g.save();tick(g,1,{left:true,right:true,launch:true});assert.equal(g.save(),before);assert.equal(g.charge,0);g.pause(false);tick(g,.1);assert.equal(g.angles[0],FLIPPERS[0].rest);
 const cancel=new Game();tick(cancel,.4,{...controls,launch:true});cancel.release();tick(cancel,.1);assert.equal(cancel.state,'ready','cancelled launch does not release a ball');
}
{
 const g=new Game(),b=ball(g);Object.assign(b,{x:420,y:800,vx:0,vy:450});tick(g,.045,{...controls,left:true});assert.ok(b.vy<0,'the rising flipper transfers momentum to the ball');assert.ok(Math.hypot(b.vx,b.vy)<=MAX_SPEED+.01);
 const r=new Game(),p=ball(r);Object.assign(p,{x:580,y:800,vx:0,vy:450});tick(r,.045,{...controls,right:true});assert.ok(p.vy<0);
 const c=new Game(),a=ball(c);Object.assign(a,{x:500,y:550,vx:100,vy:0});c.balls.push({...a,id:c.nextId++,x:516,vx:-100});c.maxBalls=2;c.multiball=true;c.update(STEP);assert.ok(a.vx<0&&c.balls[1].vx>0);assert.ok(Math.hypot(a.x-c.balls[1].x,a.y-c.balls[1].y)>=RADIUS*2-.1);
}
{
 const g=new Game(),b=ball(g);for(let i=0;i<3;i++){Object.assign(b,{...TARGETS[i],y:TARGETS[i].y+22,vx:0,vy:-250,cool:0});g.update(STEP);}assert.equal(g.rescues,1);assert.equal(g.score,13000);assert.ok(g.lamps.every(Boolean));assert.ok(g.events.some(e=>e.t==='rescue'));tick(g,3.1);assert.ok(g.lamps.every(v=>!v));
}
{
 const g=new Game();for(let i=0;i<3;i++){const b=ball(g);Object.assign(b,{x:730,y:505,vx:0,vy:-300});g.update(STEP);assert.equal(b.rail,'right');assert.ok(Game.load(g.save()),'ramp entry is resumable');tick(g,1.11);if(i<2){assert.equal(g.state,'ready');assert.equal(g.ballNo,1);assert.equal(g.locks,i+1);}}
 assert.ok(g.multiball);assert.equal(g.balls.length,3);assert.equal(g.maxBalls,3);assert.equal(g.locks,0);assert.ok(g.balls.every(b=>b.moon));assert.ok(g.events.some(e=>e.t==='multiball'));
 assert.ok(g.events.some(e=>e.t==='dust'),'a locked berry lands in the dry dust');
 const bridge=new Game(),b=ball(bridge);Object.assign(b,{x:270,y:505,vx:0,vy:-300});bridge.update(STEP);assert.equal(b.rail,'left');tick(bridge,2.71);assert.equal(b.rail,null);assert.equal(bridge.ramps,1);assert.equal(bridge.score,3000);assert.ok(b.x>560&&b.x<626&&b.y<800,'the bridge run sets the berry down above the right flipper');
}
{
 // The launcher: a weak shot settles back on the plunger for another go, a firm one rides the ramp and drops in under the bridge.
 const weak=new Game();weak.launch(.05);tick(weak,2);assert.equal(weak.state,'ready');assert.equal(weak.balls.length,0);assert.equal(weak.ballNo,1);
 const firm=new Game();firm.launch(.6);tick(firm,.4);assert.equal(firm.balls[0].rail,'launch');assert.ok(Game.load(firm.save()));tick(firm,1.31);const f=firm.balls[0];assert.ok(!f.rail&&!f.launcher&&Math.abs(f.x-500)<40&&f.y>150&&f.y<215);assert.equal(firm.ramps,0);assert.equal(firm.score,0);
 // A cushion kicks a berry that strikes it and only guides one that rolls down it.
 const [sx,sy,ex,ey]=SLINGS[0],mx=(sx+ex)/2+14,my=(sy+ey)/2-6;
 const struck=new Game(),s=ball(struck);Object.assign(s,{x:mx+4,y:my,vx:-420,vy:60});tick(struck,.03);assert.ok(struck.events.some(e=>e.t==='sling'));assert.ok(s.vx>350&&s.vy<0,'kicked out and up, away from the cushion');
 const rolled=new Game(),r=ball(rolled);Object.assign(r,{x:sx+15,y:sy-2,vx:0,vy:0});tick(rolled,.25);assert.ok(!rolled.events.some(e=>e.t==='sling'));assert.ok(r.y>sy+20,'it rolled on down');
 // A shot leaves faster from the tip of the paw than from beside the pivot.
 const shot=d=>{const g=new Game(),p=ball(g),fl=FLIPPERS[0];Object.assign(p,{x:fl.x+Math.cos(fl.rest)*d+13,y:fl.y+Math.sin(fl.rest)*d-24,vx:0,vy:0});tick(g,.1);let top=0;for(let i=0;i<30;i++){g.update(STEP,{...controls,left:true});top=Math.max(top,Math.hypot(p.vx,p.vy));}return top;};
 const near=shot(20),far=shot(85);assert.ok(near>700&&far>near+150,`near the pivot ${near.toFixed(0)}, off the tip ${far.toFixed(0)}`);
 // A slow berry on a raised paw comes to rest there.
 const held=new Game(),h=ball(held);Object.assign(h,{x:430,y:700,vx:0,vy:50});tick(held,3,{...controls,left:true});assert.ok(Math.hypot(h.vx,h.vy)<20&&h.y<800&&h.x<FLIPPERS[0].x+60,'caught');
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
 for(const patch of[{v:3},{state:'over'},{score:-1},{balls:[]},{angles:[99,0]},{lamps:[]},{locks:3},{mode:'casino'},{accumulator:9}]){const s=JSON.parse(a.save());Object.assign(s,patch);assert.equal(Game.load(JSON.stringify(s)),null);}assert.equal(Game.load('broken'),null);
}
// Nothing painted solid is ever crossed: off a ramp, the berry stays on the felt, clear of the cushion islands, the side lanes and the stonework.
const felt=b=>b.x>160&&b.x<840&&b.y>140&&!(b.y>640&&(b.x<300||b.x>700))&&!(b.y<470&&(b.x<296||b.x>704));
let snapshots=0;for(let seed=1;seed<=3;seed++){const g=play(seed,.6+seed*.1,80,run=>{for(const b of run.balls)if(!b.rail&&!b.launcher)assert.ok(felt(b),`berry off the felt at ${b.x.toFixed(0)}, ${b.y.toFixed(0)}`);if(!run.ended){snapshots++;assert.ok(Game.load(run.save()),`save at ${run.time.toFixed(3)}s`);}});assert.ok(g.score>=1000);assert.ok(g.hits+g.ramps>0);console.log(`Seed ${seed}: ${g.score} points, ${g.hits} bumper hits, ${g.ramps} ramps, peak ${g.maxBalls} balls.`);}
console.log(`Pinball: charge/cancel, the launcher, physical flippers, catches, cushions, ball collisions, rescue, ramps/dust/locks/multiball, saves, drains, practice, tilt, a berry kept on the felt and ${snapshots} in-play snapshots pass.`);

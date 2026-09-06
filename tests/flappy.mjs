import assert from 'node:assert/strict';
import {FlappyGame,FLIGHT} from '../.checks/flappy-game.js';
const tick=(g,n)=>{for(let i=0;i<n;i++)g.step(1/120)};
const idle=new FlappyGame(1);tick(idle,120);assert.equal(idle.y,250);idle.flap();assert.equal(idle.state,'playing');assert(idle.vy<0);tick(idle,12);assert(idle.y<250);idle.pause();const pos=idle.y;tick(idle,120);assert.equal(idle.y,pos);idle.pause();assert.equal(idle.state,'playing');
const fall=new FlappyGame(2);fall.flap();tick(fall,300);assert.equal(fall.state,'lost');
const crash=new FlappyGame(3);crash.flap();crash.gates=[{id:0,x:210,center:380,gap:164,passed:false}];crash.y=100;crash.step(1/120);assert.equal(crash.state,'lost');
const rear=new FlappyGame(4);rear.flap();rear.gates=[{id:0,x:110,center:380,gap:164,passed:false}];rear.y=100;rear.step(1/120);assert.equal(rear.state,'lost','rear chinchilla also collides');
const score=new FlappyGame(5);score.flap();score.gates=[{id:0,x:65,center:250,gap:198,passed:false}];score.step(1/120);assert.equal(score.score,1);tick(score,4);assert.equal(score.score,1,'each gate scores once');
for(const seed of [1,42,93]){const g=new FlappyGame(seed);g.flap();for(let i=0;i<120*65&&g.state==='playing';i++){const next=g.gates.find(v=>v.x+74>FLIGHT.x[1]-FLIGHT.radius);const target=next?.center??250;if(g.y>target+10&&g.vy>0)g.flap();g.step(1/120)}console.log(`Seed ${seed}: ${g.score} checkpoints, ${g.state}, ${g.time.toFixed(1)}s.`);assert.equal(g.state,'won');assert.equal(g.score,20);const time=g.time;tick(g,120);assert.equal(g.time,time)}
console.log('Passed shared flaps, gravity, pause, front/rear collisions, single scoring and three complete 20-checkpoint flights.');

for(const offset of [0,40]){const g=new FlappyGame(9);g.flap();g.gates=[{id:0,x:190,center:250,gap:198,passed:false}];for(let i=0;i<130&&g.score===0;i++){g.y=250+offset;g.vy=0;g.step(1/120)}assert.equal(g.score,1);assert.equal(g.perfect,offset===0?1:0);assert.equal(g.points,offset===0?150:100);assert.equal(g.gates[0].centers.length,2,'both characters measured');}
assert.equal(rear.hitHero,1);assert.equal(rear.hitReason,'a checkpoint');assert(!rear.canRetry);tick(rear,67);assert(rear.canRetry);assert.equal(rear.score,0);assert(rear.events.includes('crash'));
console.log('Passed two-character center bonuses, ordinary scoring, collision attribution and retry cooldown.');

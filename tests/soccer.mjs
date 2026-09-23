import assert from 'node:assert/strict';
import {SoccerGame,MATCH_SECONDS,BAR} from '../.checks/soccer-game.js';
const fresh=()=>{const g=new SoccerGame();g.start();return g};
const tick=(g,t,input)=>{for(let i=0;i<t*120;i++)g.step(1/120,input)};
const move=fresh();tick(move,.5,{x:1,y:0,sprint:true});assert(move.players[0].x>33);assert(move.players[0].stamina<1);move.pause();const t=move.time;tick(move,2);assert.equal(move.time,t);move.pause();
const pass=fresh();assert(pass.pass());assert.equal(pass.owner,null);assert(Math.hypot(pass.ball.vx,pass.ball.vy)>25);assert(!pass.shoot());
const shot=fresh();shot.aim={x:100,y:30};assert(shot.shoot());assert(shot.ball.vx>50);assert.equal(shot.lock,.18);
for(const team of [0,1]){const g=fresh();g.owner=null;g.ball={x:team===0?99.9:.1,y:30,vx:team===0?52:-52,vy:0,z:0,vz:0,spin:0};g.step(1/120);assert.equal(g.score[team],1);assert.equal(g.state,'goal');tick(g,2.1);assert.equal(g.state,'playing');assert.equal(g.players[g.owner].team,team===0?1:0);assert.equal(g.score[team],1)}
const post=fresh();post.owner=null;post.ball={x:99.9,y:10,vx:52,vy:0,z:0,vz:0,spin:0};post.step(1/120);assert.equal(post.score[0],0);assert(post.ball.vx<0);
const tackle=fresh();tackle.lock=0;tackle.players[4].x=tackle.players[0].x+.5;tackle.players[4].y=tackle.players[0].y;tackle.step(1/120);assert.equal(tackle.owner,4);assert(tackle.lock>0);
const change=fresh();change.switchPlayer();assert(change.active!==0);assert(!change.players[change.active].keeper);
const end=fresh();tick(end,110);assert.equal(end.state,'finished');assert(end.time>=MATCH_SECONDS);assert(end.players.every(p=>p.x>=2&&p.x<=98&&p.y>=3&&p.y<=57));console.log(`Full match: ${end.score.join('–')}, ${end.time.toFixed(1)}s.`);console.log('Passed movement/sprint, pause, passing, shooting, goals/kickoffs, rebound, tackling, player switching and complete match.');
const attack=fresh();for(let i=0;i<120*20&&attack.score[0]===0;i++){const p=attack.players[attack.active];if(attack.owner===attack.active&&p.x>80){attack.aim={x:100,y:p.y<30?35.5:24.5};attack.shoot()}attack.step(1/120,{x:attack.owner===attack.active?1:0,y:p.y>22?-1:0,sprint:true})}assert(attack.score[0]>0,'normal movement and a far-corner shot from close in can score');console.log('Passed a player-controlled scoring attack.');

// The cup, the Fluff meter, the Cloud Chip, golden goal and Enzo's dash.
const cup=(round)=>{const g=new SoccerGame({mode:'cup',round});g.start();return g};
assert.deepEqual([0,1,2].map(r=>cup(r).rival.id),['viscacha','degu','ember']);
assert.equal(fresh().rival.id,'ember');assert.equal(fresh().players[4].name,'Enzo');assert.equal(cup(0).players[4].name,'Vito');
const noMeter=fresh();assert(!noMeter.chip(),'the chip needs a full meter');
const chip=fresh();chip.meter=1;chip.players[0].x=68;chip.players[0].y=30;chip.aim={x:100,y:28};chip.lock=0;
for(const p of chip.players)if(p.team===1&&!p.keeper){p.x=80;p.y=28}
assert(chip.chip());assert.equal(chip.meter,0);assert(chip.ball.vz>0);let peak=0,stolen=false;
for(let i=0;i<120*3&&chip.state==='playing';i++){chip.step(1/120);peak=Math.max(peak,chip.ball.z);if(chip.owner!==null&&chip.players[chip.owner].team===1)stolen=true}
assert(!stolen,'a chip sails over defenders and the keeper');assert.equal(chip.score[0],1,'a chip from 32 out dips under the bar');assert(peak>BAR);
const passGain=fresh();passGain.meter=0;assert(passGain.pass());for(let i=0;i<240&&passGain.owner===null;i++)passGain.step(1/120);assert.equal(passGain.players[passGain.owner].team,0);assert(passGain.meter>=.2,'a completed pass fills the meter');
const tackleGain=fresh();tackleGain.meter=0;tackleGain.owner=5;tackleGain.lock=0;tackleGain.players[1].x=tackleGain.players[5].x+.5;tackleGain.players[1].y=tackleGain.players[5].y;tackleGain.step(1/120);assert.equal(tackleGain.owner,1);assert(tackleGain.meter>=.25);
const bar=fresh();bar.owner=null;bar.ball={x:99.9,y:30,z:5,vx:52,vy:0,vz:0,spin:0};bar.step(1/120);assert.equal(bar.score[0],0);assert.equal(bar.owner,7,'over the bar is a goal kick');
const golden=cup(1);golden.time=MATCH_SECONDS-.01;golden.owner=null;golden.ball={x:50,y:30,z:0,vx:0,vy:0,vz:0,spin:0};tick(golden,.1);
assert(golden.golden);assert.equal(golden.state,'playing');golden.owner=null;golden.ball={x:99.9,y:30,z:0,vx:52,vy:0,vz:0,spin:0};golden.step(1/120);assert.equal(golden.state,'goal');tick(golden,2.1);assert.equal(golden.state,'finished');assert.equal(golden.winner,0);
const draw=fresh();draw.time=MATCH_SECONDS-.01;draw.owner=null;draw.ball={x:50,y:30,z:0,vx:0,vy:0,vz:0,spin:0};tick(draw,.1);assert.equal(draw.state,'finished');assert.equal(draw.winner,null);
const dash=fresh();dash.owner=4;dash.lock=5;dash.aiTime=0;dash.players[4].x=60;dash.players[4].dashCool=0;for(const p of dash.players)if(p.team===0){p.x=5;p.y=5}
const x0=dash.players[4].x;dash.step(1/120);assert(dash.players[4].dash>0,'Enzo dashes with the ball');tick(dash,.3);assert(x0-dash.players[4].x>.3*8.5*1.5);
const viscacha=cup(0);viscacha.owner=4;viscacha.lock=5;viscacha.players[4].x=60;viscacha.players[4].dashCool=0;viscacha.step(1/120);assert.equal(viscacha.players[4].dash,0,'only Enzo dashes');
const stats=fresh();stats.shoot();assert.equal(stats.shots[0],1);tick(stats,1);assert(stats.possession[0]+stats.possession[1]>0);
const faces=fresh();tick(faces,.3,{x:-1,y:0,sprint:false});assert.equal(faces.players[0].face,-1);
// A whole cup final plays out with the computer on both sides of the ball.
const final=cup(2);for(let i=0;i<120*300&&final.state!=='finished';i++){const p=final.players[final.active];if(final.owner===final.active&&p.x>65){final.aim={x:100,y:p.y<30?24.5:35.5};final.shoot()}final.step(1/120,{x:final.owner===final.active?1:Math.sign(final.ball.x-p.x),y:final.owner===final.active?Math.sign(30-p.y)*.5:Math.sign(final.ball.y-p.y),sprint:true})}assert.equal(final.state,'finished');assert.notEqual(final.winner,null,'a cup match always has a winner');
console.log(`Cup final with a simple bot: ${final.score.join('–')}${final.golden?' after golden goal':''}.`);
console.log('Passed the cup draw, Fluff meter, Cloud Chip, goal kicks, golden goal, Ember Dash, stats and facing.');

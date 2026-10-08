import assert from 'node:assert/strict';
import { Game, HOME, CAGE, BOWL, CRATE, GAP, HIDES, NIGHTS, dist } from '../.checks/moonlight-game.js';
import { play } from './moonlight-bot.mjs';
const at=(g,p)=>Object.assign(g.hero,p);
{
 const g=new Game();g.update(2);assert.equal(g.time,0,'clock waits for first move');g.go(BOWL);g.update(1);assert.ok(g.time>0);g.pause(true);const before=g.save();g.update(1,{x:1,y:1});assert.equal(g.save(),before);assert.equal(g.trail.length,0);
}
{
 const g=new Game();assert.equal(g.active,'dora');g.switch();assert.equal(g.active,'enzo');at(g,CAGE);assert.ok(g.interact());assert.ok(g.rescued);assert.ok(g.friend);assert.equal(g.friendHome,false);
 const d=new Game();at(d,CAGE);assert.equal(d.interact(),false);assert.equal(d.rescued,false);at(d,GAP[0]);assert.ok(d.interact());assert.ok(dist(d.hero,GAP[1])<1);d.switch();at(d,GAP[0]);assert.equal(d.interact(),false);
}
{
 const g=new Game();at(g,BOWL);assert.ok(g.interact());assert.equal(g.hero.dust,22);g.update(1);assert.ok(g.hero.dust<22);at(g,HIDES[0]);assert.ok(g.interact());assert.equal(g.hero.hidden,true);g.update(.1,{x:1,y:0});assert.equal(g.hero.hidden,false);
 assert.ok(g.ability());assert.equal(g.hero.cooldown,4);assert.equal(g.ability(),false);g.switch();at(g,CRATE);assert.ok(g.interact());assert.ok(g.walkable(CRATE));assert.ok(g.ability());assert.equal(g.hero.cooldown,8);
}
{
 const g=new Game();assert.equal(g.walkable(CRATE),false);assert.equal(g.walkable({x:400,y:50}),false);g.go({x:400,y:50});assert.equal(g.trail.length,0);for(const n of NIGHTS)for(const p of n.treats)assert.ok(g.path(g.hero,p).length,'every treat has a legal path');assert.ok(g.path(g.hero,CAGE).length);assert.ok(g.path(g.hero,HOME).length);
 const o=g.owls[0];Object.assign(o,{x:700,y:180,angle:Math.PI});assert.equal(g.visible(o,{x:500,y:180}),false,'cottage blocks sight');Object.assign(o,{x:800,y:300,angle:0});assert.equal(g.visible(o,{x:850,y:300}),true);assert.equal(g.visible(o,{x:750,y:300}),false,'behind the owl');
}
{
 const g=new Game();g.started=true;const o=g.owls[0];Object.assign(o,{x:160,y:425,angle:0,dwell:10});at(g,{x:190,y:425});g.update(2);g.update(.2);assert.equal(g.catches,1);assert.equal(g.hero.x,160);assert.ok(g.events.some(e=>e.t==='caught'));const p=new Game(0,'practice');p.started=true;p.time=1000;p.update(.1);assert.equal(p.state,'playing');const t=new Game();t.started=true;t.time=179.99;t.update(.1);assert.equal(t.state,'lost');
}
{
 const g=new Game();g.go(BOWL);g.update(1);g.events=[];const loaded=Game.load(g.save());assert.ok(loaded?.paused);assert.equal(loaded.time,g.time);assert.equal(loaded.trail.length,0);loaded.pause(false);g.pause(false);g.update(.5,{x:1,y:0});loaded.update(.5,{x:1,y:0});assert.equal(loaded.save(),g.save(),'restored patrols replay deterministically');
 for(let n=0;n<3;n++)assert.ok(Game.load(new Game(n).save()),'every fresh night is resumable');
 for(const patch of [{v:2},{time:-1},{night:7},{heroes:[]},{owls:[]},{treats:[]},{active:'fox'},{rescued:true},{friendHome:true}]){const s=JSON.parse(g.save());Object.assign(s,patch);assert.equal(Game.load(JSON.stringify(s)),null);}const s=JSON.parse(g.save());s.heroes[0].x=400;s.heroes[0].y=50;assert.equal(Game.load(JSON.stringify(s)),null);assert.equal(Game.load('{'),null);
}
{
 const g=new Game();g.pushed=true;Object.assign(g.hero,{x:677.63,y:390});g.go({x:840,y:490});for(let i=0;i<200&&dist(g.hero,{x:840,y:490})>10;i++)g.update(.1);assert.ok(dist(g.hero,{x:840,y:490})<10,'navigation cannot cut across the small gap between corridor edges');
 const n=new Game();n.started=true;const o=n.owls[0];Object.assign(o,{x:875,y:275,angle:Math.PI,dwell:1,curious:0,heard:0});Object.assign(n.hero,{x:835,y:275});n.update(.1,{x:1,y:0});assert.ok(o.heard>0,'noisy stone attracts an owl');
 const quiet=new Game();quiet.started=true;const q=quiet.owls[0];Object.assign(q,{x:875,y:275,angle:Math.PI,dwell:1});Object.assign(quiet.hero,{x:835,y:275});quiet.update(.1,{x:1,y:0,sneak:true});assert.equal(q.heard,0,'creeping avoids the noise');
}
{
 const g=new Game(),x=g.hero.x;assert.ok(g.ability());g.update(.1);assert.ok(g.hero.x>x+20,'quiet dash moves from a standstill');g.pause(true);const stop={x:g.hero.x,y:g.hero.y};g.pause(false);g.update(.1);assert.equal(g.hero.x,stop.x);assert.equal(g.hero.y,stop.y);g.go({x:NaN,y:200});assert.equal(g.trail.length,0);
 const alarm=new Game();alarm.started=true;Object.assign(alarm.heroes[1],{x:235,y:455});Object.assign(alarm.owls[0],{x:205,y:455,angle:0,dwell:10});alarm.update(.7);assert.ok(alarm.events.some(e=>e.t==='alert'));assert.match(alarm.note,/Enzo is being watched/);assert.ok(alarm.attention(alarm.heroes[1])>.25);assert.equal(alarm.attention(alarm.heroes[0]),0);alarm.heroes[1].hidden=true;assert.equal(alarm.attention(alarm.heroes[1]),0);alarm.update(.2);alarm.heroes[1].hidden=false;alarm.update(.2);assert.equal(alarm.events.filter(e=>e.t==='alert').length,1,'a small suspicion dip does not spam warning cues');alarm.heroes[1].hidden=true;alarm.update(.6);alarm.heroes[1].hidden=false;alarm.update(.7);assert.equal(alarm.events.filter(e=>e.t==='alert').length,2,'warnings rearm after attention settles');
 const practice=play(0,'practice');assert.equal(practice.state,'won');assert.equal(practice.stars,0,'practice does not advertise unearned stars');
}
let snapshots=0;
for(let n=0;n<3;n++){const g=play(n,'night',0,run=>{if(run.state==='playing'){snapshots++;assert.ok(Game.load(run.save()),`legal snapshot at night ${n+1}, ${run.time.toFixed(2)}s`);}});console.log(`Night ${n+1}: ${g.state}, ${g.catches} catches, ${g.time.toFixed(1)} seconds`);assert.equal(g.state,'won');assert.equal(g.collected,g.treats.length);assert.ok(g.rescued&&g.friendHome);assert.ok(g.heroes.every(h=>h.home));assert.ok(g.stars>=1);assert.equal(Game.load(g.save()),null,'finished runs are not resumable');}
const varied=play(2,'night',7,run=>{if(run.state==='playing'){snapshots++;assert.ok(Game.load(run.save()),`snapshot after a catch at ${run.time.toFixed(2)}s`);}});assert.equal(varied.state,'won');assert.ok(varied.catches>0);
console.log(`Validated ${snapshots} snapshots during complete heists.`);
console.log('Moonlight Mischief: legal paths, abilities, rescue, hiding, dry dust, cones, catches, timeouts, save validation and three complete heists pass.');

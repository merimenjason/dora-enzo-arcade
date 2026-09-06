import assert from 'node:assert/strict';
import {PitGame,ORBS,RECIPES} from '../.checks/pit-game.js';
const fresh=()=>{const g=new PitGame(42);g.playing=true;return g};
const enemy=(g,x,z,boss=false)=>({id:g.serial++,x,z,hp:100,maxHp:100,boss,slow:0,burn:0,poison:0,flash:0});
const tick=(g,t,input)=>{for(let i=0;i<t*60;i++)g.step(1/60,input)};
const follow=fresh();follow.enemies=[enemy(follow,5,5)];follow.fireTime=100;tick(follow,1);assert(follow.enemies[0].x<5&&follow.enemies[0].z<5,'predators pursue in both axes');
const fire=fresh();fire.orbs=[{kind:'seed',rank:1},{kind:'stone',rank:1},{kind:'thorn',rank:1}];fire.step(1/60);assert.equal(fire.balls.length,3,'all equipped weapons fire automatically');assert(fire.balls.every(b=>Number.isFinite(b.vx)&&Number.isFinite(b.vz)));
const gems=fresh();gems.enemies=[enemy(gems,4,0)];gems.hit(gems.enemies[0],200);assert.equal(gems.xp,0);assert.equal(gems.gems.length,1);gems.x=4;gems.step(1/60);assert(gems.xp>0);assert.equal(gems.gems.length,0);
const touch=fresh();touch.enemies=[enemy(touch,.78,0)];touch.fireTime=100;touch.step(1/60);assert.equal(touch.hp,90);const hp=touch.hp;touch.step(1/60);assert.equal(touch.hp,hp,'contact grace period');
const armor=fresh();armor.passives.shell=3;armor.enemies=[enemy(armor,.78,0,true)];armor.fireTime=100;armor.step(1/60);assert(Math.abs(armor.hp-87.9)<.001,'boss contact uses armor and is not instantly fatal');
const aura=fresh();aura.orbs=[{kind:'gale',rank:1}];aura.enemies=[enemy(aura,1,0),enemy(aura,8,0)];aura.fire();assert(aura.enemies[0].hp<100);assert.equal(aura.enemies[1].hp,100);
for(let i=0;i<RECIPES.length;i++){const g=fresh(),r=RECIPES[i];g.orbs=[{kind:r.a,rank:2},{kind:r.b,rank:2}];assert(g.fuse(i));assert.equal(g.orbs[0].kind,r.result)}
const level=fresh();level.xp=35;level.step(1/60);assert.equal(level.choice.length,3);assert(level.choice.some(c=>c.category==='Passive item'));const time=level.time;tick(level,1);assert.equal(level.time,time);assert(level.choose(level.choice[0].id));
const end=fresh();end.time=180;end.spawnWave();assert.equal(end.alive.filter(e=>e.boss).length,1);end.spawnWave();assert.equal(end.alive.filter(e=>e.boss).length,1);end.hit(end.alive.find(e=>e.boss),9999);end.step(1/60);assert(end.won);end.passives.hay=2;end.descend();assert.equal(end.depth,2);assert.equal(end.time,0);assert.equal(end.rank('hay'),2);assert(!end.bossSpawned);
const pause=fresh();pause.paused=true;tick(pause,2);assert.equal(pause.time,0);
const run=fresh();let maxEnemies=0;for(let i=0;i<60*240&&!run.won&&!run.lost;i++){if(run.choice.length){const card=run.choice.find(c=>c.id==='extra')||run.choice.find(c=>c.id==='power')||run.choice.find(c=>c.id==='heart')||run.choice[0];run.choose(card.id)}if(run.charge>=50)run.burst();const a=run.time*.2;run.step(1/60,{x:Math.cos(a),z:Math.sin(a)});maxEnemies=Math.max(maxEnemies,run.alive.length);assert(run.balls.length<=180&&run.gems.length<=160&&run.alive.length<=81);assert(Number.isFinite(run.hp));}
console.log(`Survival simulation: ${run.time.toFixed(1)} seconds, level ${run.level}, ${run.kills} predators, peak ${maxEnemies}, ${run.won?'won':run.lost?'lost':'ongoing'}.`);
assert(run.time>60,'ordinary moving/automatic attacks survive the opening minute');
assert.equal(Object.keys(ORBS).length,20);console.log('Passed pursuit, automatic weapons, XP collection, contact protection, aura range, eight evolutions, level-up pause, boss victory, next night and bounded simulation.');

import assert from 'node:assert/strict';
import {Adventure,blocked,pathfind} from '../.checks/arpg-game.js';
const fresh=()=>{const g=new Adventure();g.playing=true;return g};
const tick=(g,seconds)=>{for(let i=0;i<seconds*120;i++)g.step(1/120)};
const g=fresh();
assert(blocked(-5,0));assert(blocked(12,0));
const route=pathfind({x:0,z:2},{x:0,z:-6});
assert(route.length>5);assert(route.every(p=>!blocked(p.x,p.z,.53)));
g.enemies.forEach(e=>{e.stun=1000});g.command({x:0,z:-6});tick(g,6);
assert(Math.hypot(g.hero.x,g.hero.z+6)<.5,'click movement routes around the central altar');
assert(Math.hypot(g.heroes[1].x-g.hero.x,g.heroes[1].z-g.hero.z)<7,'companion stays nearby');
const combat=fresh();combat.keyboardAttack();tick(combat,3);
assert(combat.enemies.some(e=>e.hp<e.maxHp),'click-to-attack lands hits');
assert(combat.events.includes('slash'),'Grey companion fights automatically');
const skill=fresh();skill.special({x:0,z:0});assert.equal(skill.shots.length,5);skill.special();assert.equal(skill.shots.length,5);
skill.swap(1);const near=skill.enemies[0];near.x=skill.hero.x;near.z=skill.hero.z-2;skill.special();assert(near.hp<near.maxHp);assert(near.stun>0);
skill.hero.face=Math.PI;const pos=skill.hero.x;skill.dodge();assert(skill.hero.x<pos);assert.equal(skill.stamina,70);skill.dodge();assert.equal(skill.stamina,70);
const bond=fresh();bond.bond=50;const enemy=bond.enemies[0];enemy.x=-1;enemy.z=6;bond.burst();assert.equal(enemy.hp,0);assert(bond.bond<50);assert(bond.effects.filter(e=>e.kind==='burst').length===2);
const heal=fresh();heal.hp=80;heal.loot.push({x:heal.hero.x,z:heal.hero.z,id:99,heal:true,value:7});heal.step(1/120);assert.equal(heal.hp,100);assert.equal(heal.treats,7);
const cover=fresh();cover.enemies.forEach(e=>e.stun=100);cover.heroes[0].x=0;cover.heroes[0].z=0;cover.heroes[1].x=10;cover.heroes[1].z=10;cover.shots.push({x:0,z:-6,vx:0,vz:6,life:3,damage:20,enemy:true});tick(cover,1.5);assert.equal(cover.hp,150,'altar blocks hostile projectile');
const hit=fresh();hit.enemies.forEach(e=>e.stun=100);hit.shots.push({x:-1,z:6,vx:0,vz:6,life:1,damage:20,enemy:true});tick(hit,.4);assert.equal(hit.hp,130,'hostile projectile damages shared courage');
const pause=fresh();pause.paused=true;pause.command({x:3,z:3});pause.special();tick(pause,2);assert.equal(pause.time,0);assert.equal(pause.target,null);assert.equal(pause.shots.length,0);
const reset=fresh();reset.ranged=1.25;reset.treats=10;reset.roomTreats=6;reset.hp=-1;reset.step(1/120);assert.equal(reset.revivals,1);assert.equal(reset.hp,150);assert.equal(reset.ranged,1.25);assert.equal(reset.treats,6);
// Play all three encounters through normal attack/ability commands with a simple bot.
const run=fresh();let elapsed=0;
for(let room=0;room<3;room++){
 for(let frame=0;frame<120*180&&!run.cleared;frame++){
  if(frame%30===0)run.keyboardAttack();
  if(frame%60===0)run.special();
  if(run.bond>=50&&run.living.some(e=>run.heroes.some(h=>Math.hypot(h.x-e.x,h.z-e.z)<4)))run.burst();
  run.step(1/120);elapsed++;
 }
 assert.equal(run.cleared,true,`chamber ${room+1} is completable`);
 assert.equal(run.revivals,0,'simple combat strategy survives');
 if(room<2){assert(run.reward);run.choose(room===0?'ranged':'heart');assert.equal(run.hp,run.maxHp);run.enter();tick(run,12);assert(Math.hypot(run.hero.x,run.hero.z+9.8)<2.6,'exit is reachable');run.enter();assert.equal(run.room,room+1)}
}
assert(run.won);assert(run.treats>50);assert.equal(run.maxHp,185);
console.log(`Passed: navigation, companion combat, abilities, collision, healing, pause/reset, and all three encounters (${(elapsed/120).toFixed(1)}s combat).`);

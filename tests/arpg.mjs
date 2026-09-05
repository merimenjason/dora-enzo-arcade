import assert from 'node:assert/strict';
import {Adventure,blocked,pathfind} from '../.checks/arpg-game.js';
import {generateFloor} from '../.checks/dungeon.js';
import {SKILLS} from '../.checks/skills.js';
const fresh=(seed=42)=>{const g=new Adventure(seed);g.playing=true;return g};
const tick=(g,seconds)=>{for(let i=0;i<seconds*120;i++)g.step(1/120)};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
assert.deepEqual(generateFloor(7,0),generateFloor(7,0),'seed reproduces geometry and spawns');
assert.notDeepEqual(generateFloor(7,0),generateFloor(8,0));
assert.notDeepEqual(generateFloor(7,0).blocks,generateFloor(7,1).blocks);
for(let seed=0;seed<100;seed++)for(let depth=0;depth<6;depth++){
 const floor=generateFloor(seed,depth),start={x:0,z:8};
 for(const goal of [...floor.spawns,{x:0,z:-10}]){
  assert(!blocked(goal.x,goal.z,.85,floor.blocks),'spawn and exit have space');
  const path=pathfind(start,goal,floor.blocks,.85);assert(path.length&&distance(path.at(-1),goal)<1.6,`floor ${seed}/${depth} has reachable spawns and exit`);
  assert(path.every(p=>!blocked(p.x,p.z,.85,floor.blocks)));
 }
 assert.equal(floor.spawns.some(e=>e.type===2),(depth+1)%3===0);
}
const nav=fresh();nav.enemies.forEach(e=>e.stun=1000);nav.command({x:0,z:-10});tick(nav,20);assert(distance(nav.hero,{x:0,z:-10})<.5,'click navigates both randomized doorways');assert(distance(nav.heroes[0],nav.heroes[1])<3,'companion follows through doorways');
const leveling=fresh();leveling.gainXp(70+105+140);assert.equal(leveling.level,4);assert.equal(leveling.xp,0);assert.equal(leveling.skillPoints,4);assert.equal(leveling.maxHp,186);assert.equal(leveling.hp,186);
assert.equal(leveling.learn('storm'),false,'cannot skip parents');assert(leveling.learn('seed'));assert(leveling.learn('haste'));assert(leveling.learn('storm'));assert.equal(leveling.skills.storm,1);leveling.special({x:0,z:0});assert.equal(leveling.shots.length,7);leveling.special();assert.equal(leveling.shots.length,7,'cooldown prevents duplicate cast');
const gate=fresh();gate.skillPoints=20;assert(gate.learn('seed'));assert.equal(gate.learn('haste'),false,'level requirement enforced');assert(gate.learn('seed'));assert(gate.learn('seed'));assert.equal(gate.learn('seed'),false,'max rank enforced');assert.equal(gate.learn('missing'),false);gate.skillPoints=0;assert.equal(gate.learn('guard'),false,'no negative points');
const stats=fresh();stats.level=4;stats.skillPoints=40;for(const n of SKILLS)for(let i=0;i<n.max;i++)assert(stats.learn(n.id));assert.equal(stats.maxHp,225);stats.takeDamage(100);assert.equal(stats.hp,143);assert.equal(stats.burstCost,40);stats.enemies.forEach(e=>{e.x=0;e.z=-9});stats.bond=40;stats.burst();assert.equal(stats.hp,173);assert.equal(stats.bond,0);stats.special({x:0,z:0});assert.equal(stats.shots.length,9);assert(stats.shots.every(s=>s.stun===.9||Math.abs(s.stun-.9)<1e-9));assert(Math.abs(stats.hero.special-1.98)<.001);
const cleave=fresh();cleave.floor.blocks=[];cleave.skills={claw:1,cleave:2,whirl:1};cleave.swap(1);const h=cleave.hero;cleave.enemies.forEach((e,i)=>{e.x=h.x+i*.1;e.z=h.z-1;e.stun=100});const second=cleave.enemies[1];cleave.attack(1,cleave.enemies[0]);assert(second.hp<second.maxHp,'cleave hits secondary target');const old=second.hp;cleave.special();assert(second.hp<old,'whirl damages nearby enemies');
const cover=fresh();cover.enemies.forEach(e=>e.stun=100);cover.floor.blocks=[{x:-1,z:6,w:2,d:.8,h:1}];cover.shots.push({x:-1,z:4,vx:0,vz:6,life:3,damage:20,enemy:true});tick(cover,1);assert.equal(cover.hp,150,'generated walls stop projectiles');
const reset=fresh();const killed=reset.enemies[0];reset.damage(killed,999);const xp=reset.xp;reset.hp=-1;reset.step(1/120);assert.equal(reset.revivals,1);assert.equal(reset.xp,xp);reset.damage(reset.enemies[0],999);assert.equal(reset.xp,xp,'retry cannot farm XP from the same enemy');
const pause=fresh();pause.paused=true;pause.command({x:3,z:3});pause.special();tick(pause,2);assert.equal(pause.time,0);assert.equal(pause.shots.length,0);assert(pause.learn('guard'),'skill spending works while paused');
const heal=fresh();heal.hp=80;heal.loot.push({x:heal.hero.x,z:heal.hero.z,id:99,heal:true,value:7});heal.step(1/120);assert.equal(heal.hp,100);assert.equal(heal.treats,7);
const dodge=fresh();dodge.dodge();assert.equal(dodge.stamina,70);dodge.dodge();assert.equal(dodge.stamina,70);
// Normal movement, targeting and abilities complete generated floors with the AI companion.
for(const seed of [1,42,93]){
 const run=fresh(seed);let elapsed=0;
 for(let room=0;room<4;room++){
  for(let frame=0;frame<120*240&&!run.cleared;frame++){
   if(frame%30===0)run.keyboardAttack();if(frame%60===0)run.special();
   if(run.bond>=run.burstCost&&run.living.some(e=>run.heroes.some(h=>distance(h,e)<4)))run.burst();
   for(const id of ['seed','haste','storm','guard','focus','claw','vigor'])if(!run.skillReason(id))run.learn(id);
   run.step(1/120);elapsed++;
  }
  assert(run.cleared,`seed ${seed}, floor ${room+1} completes; ${run.living.length} left, hero ${JSON.stringify(run.hero)}`);assert(run.reward);assert(!run.won,'guardian does not end descent');
  const level=run.level,skills={...run.skills};run.choose('heart');run.enter();tick(run,25);assert(distance(run.hero,{x:0,z:-9.8})<2.6,'exit can be reached');run.enter();assert.equal(run.room,room+1);assert.equal(run.level,level);assert.deepEqual(run.skills,skills);assert.equal(run.xpClaimed.size,0);
 }
 assert(run.level>=6);console.log(`Seed ${seed}: four floors completed, level ${run.level}, ${run.revivals} revivals, ${(elapsed/120).toFixed(1)}s combat.`);
}
console.log('Passed 600 generated-floor connectivity checks, progression/skills, combat modifiers, and multi-floor playthroughs.');

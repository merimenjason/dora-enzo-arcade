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
const leveling=fresh();leveling.gainXp(70+105+140);assert.equal(leveling.level,4);assert.equal(leveling.xp,0);assert.equal(leveling.skillPoints,4);assert.equal(leveling.maxHp,186);
assert.equal(leveling.learn('sanctuary'),false);assert(leveling.learn('hush'));assert(leveling.learn('brittle'));assert(leveling.learn('sanctuary'));
const gate=fresh();gate.skillPoints=20;assert(gate.learn('hush'));assert.equal(gate.learn('brittle'),false,'level gate enforced');assert(gate.learn('hush'));assert(gate.learn('hush'));assert.equal(gate.learn('hush'),false,'rank cap enforced');assert.equal(gate.learn('missing'),false);gate.skillPoints=0;assert.equal(gate.learn('decoy'),false);
const arena=()=>{const g=fresh();g.floor.blocks=[];g.heroes[0].x=0;g.heroes[0].z=0;g.heroes[1].x=9;g.heroes[1].z=9;g.enemies=g.enemies.slice(0,2);g.enemies.forEach((e,i)=>{e.x=i*2;e.z=-3;e.hp=e.maxHp=1000;e.type='mite';e.cooldown=100;e.stun=0});return g};
const seal=arena();seal.skills={hush:2,brittle:2};seal.special({x:0,z:-3});tick(seal,.2);assert(seal.enemies[0].stun>1,'volley actually immobilizes on impact');const frozen=seal.enemies[0],where={x:frozen.x,z:frozen.z};tick(seal,.1);assert.equal(distance(frozen,where),0,'immobilized foe cannot move');const hp=frozen.hp;seal.damage(frozen,10);assert.equal(hp-frozen.hp,14,'Cracking Silence boosts damage to sealed foes');const boss=seal.enemies[1];boss.type='boss';boss.stun=0;seal.immobilize(boss,2);assert.equal(boss.stun,1,'guardians resist half the duration');
const area=arena();area.skills={sanctuary:2};area.special({x:0,z:5});assert.equal(area.enemies[0].stun,2);area.hero.special=0;area.enemies[0].stun=0;area.floor.blocks=[{x:0,z:-1.5,w:8,d:.5,h:1}];area.special({x:0,z:5});assert.equal(area.enemies[0].stun,0,'seal field respects cover');
const double=arena();double.skills={decoy:1,lingering:2,echo:2};double.special({x:10,z:0});assert.equal(double.decoy.life,8);assert.equal(double.decoy.hp,65);assert.equal(double.decoyCooldown,10);const original=double.decoy;double.hero.special=0;double.special();assert.equal(double.decoy,original,'decoy has independent recharge');double.heroes[0].x=4;double.heroes[0].z=0;double.enemies[0].x=original.x;double.enemies[0].z=original.z-1;double.enemies[0].cooldown=0;const partyHp=double.hp;double.step(1/120);assert(double.decoy.hp<65,'nearby melee targets the decoy');assert.equal(double.hp,partyHp);const foeHp=double.enemies[0].hp;double.breakDecoy();assert.equal(double.decoy,null);assert.equal(foeHp-double.enemies[0].hp,50,'Parting Puff damages on breaking');
const expired=arena();expired.skills={decoy:1,echo:1};expired.special();expired.decoy.life=.001;expired.step(.01);assert.equal(expired.decoy,null,'decoy expires');
const intercepted=arena();intercepted.skills={decoy:1};intercepted.special();const d=intercepted.decoy;intercepted.shots=[{x:d.x,z:d.z+.1,vx:0,vz:-1,life:1,damage:10,enemy:true}];intercepted.step(.01);assert.equal(d.hp,25,'decoy absorbs hostile projectile');assert.equal(intercepted.hp,150);
const form=arena();form.skills={stonefur:2,ironhide:3,return:2};form.swap(1);form.special();assert.equal(form.transform,6);assert.equal(form.transformCooldown,12);const oldHp=form.hp;form.takeDamage(100);assert(Math.abs(oldHp-form.hp-65)<.001);form.hero.special=0;form.special();assert.equal(form.transform,6,'no duration stacking');form.hp=80;form.enemies.forEach(e=>e.stun=100);tick(form,6.1);assert.equal(form.transform,0);assert.equal(form.hp,110,'Gentle Return heals once when form ends');tick(form,1);assert.equal(form.hp,110);form.active=0;const whiteHp=form.hp;form.transform=2;form.takeDamage(10);assert.equal(form.hp,whiteHp-10,'Stonefur protection requires Grey to lead');form.setup(1);assert.equal(form.transform,0);assert.equal(form.decoy,null);
const stance=arena();assert.equal(stance.equipStance('thrust'),false);stance.skills={smash:2,thrust:2,pillar:2};assert(stance.equipStance('smash'));stance.swap(1);const foe=stance.enemies[0];foe.x=stance.hero.x;foe.z=stance.hero.z-1;let before=foe.hp;stance.attack(1,foe);assert.equal(before-foe.hp,38);assert.equal(stance.hero.cooldown,.75);assert(stance.equipStance('thrust'));assert.equal(stance.meleeRange,2.75);stance.hero.cooldown=0;before=foe.hp;stance.attack(1,foe);assert.equal(before-foe.hp,27);assert.equal(stance.hero.cooldown,.59);stance.equipStance('pillar');const nearby=stance.enemies[1];nearby.x=foe.x+.3;nearby.z=foe.z;stance.hero.cooldown=0;before=nearby.hp;stance.attack(1,foe);assert.equal(before-nearby.hp,14,'Rooted Tail cleaves');before=stance.hp;stance.takeDamage(100);assert.equal(before-stance.hp,80);stance.paused=true;assert(stance.equipStance('smash'),'equip through paused tree');
const cover=fresh();cover.enemies.forEach(e=>e.stun=100);cover.floor.blocks=[{x:-1,z:6,w:2,d:.8,h:1}];cover.shots.push({x:-1,z:4,vx:0,vz:6,life:3,damage:20,enemy:true});tick(cover,1);assert.equal(cover.hp,150,'generated walls stop projectiles');
const reset=fresh();const killed=reset.enemies[0];reset.damage(killed,999);const xp=reset.xp;reset.hp=-1;reset.step(1/120);assert.equal(reset.revivals,1);assert.equal(reset.xp,xp);reset.damage(reset.enemies[0],999);assert.equal(reset.xp,xp,'retry cannot farm XP from the same enemy');
const pause=fresh();pause.paused=true;pause.command({x:3,z:3});pause.special();tick(pause,2);assert.equal(pause.time,0);assert.equal(pause.shots.length,0);assert(pause.learn('decoy'),'skill spending works while paused');
const heal=fresh();heal.hp=80;heal.loot.push({x:heal.hero.x,z:heal.hero.z,id:99,heal:true,value:7});heal.step(1/120);assert.equal(heal.hp,100);assert.equal(heal.treats,7);
const dodge=fresh();dodge.dodge();assert.equal(dodge.stamina,70);dodge.dodge();assert.equal(dodge.stamina,70);
// Normal movement, targeting and abilities complete generated floors with the AI companion.
for(const seed of [1,42,93]){
 const run=fresh(seed);let elapsed=0;
 for(let room=0;room<4;room++){
  for(let frame=0;frame<120*240&&!run.cleared;frame++){
   if(frame%30===0)run.keyboardAttack();if(frame%60===0)run.special();
   if(run.bond>=run.burstCost&&run.living.some(e=>run.heroes.some(h=>distance(h,e)<4)))run.burst();
   for(const id of ['hush','brittle','sanctuary','decoy','lingering','echo','smash','stonefur'])if(!run.skillReason(id))run.learn(id);
   run.step(1/120);elapsed++;
  }
  assert(run.cleared,`seed ${seed}, floor ${room+1} completes; ${run.living.length} left, hero ${JSON.stringify(run.hero)}`);assert(run.reward);assert(!run.won,'guardian does not end descent');
  const level=run.level,skills={...run.skills};run.choose('heart');run.enter();tick(run,25);assert(distance(run.hero,{x:0,z:-9.8})<2.6,'exit can be reached');run.enter();assert.equal(run.room,room+1);assert.equal(run.level,level);assert.deepEqual(run.skills,skills);assert.equal(run.transform,0);assert.equal(run.decoy,null);assert.equal(run.xpClaimed.size,0);
 }
 assert(run.level>=6);console.log(`Seed ${seed}: four floors completed, level ${run.level}, ${run.revivals} revivals, ${(elapsed/120).toFixed(1)}s combat.`);
}
console.log('Passed 600 generated-floor connectivity checks, progression/skills, combat modifiers, and multi-floor playthroughs.');

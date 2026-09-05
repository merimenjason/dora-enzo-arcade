import assert from 'node:assert/strict';
import {PitGame,RECIPES} from '../.checks/pit-game.js';
const fresh=(seed=42)=>{const g=new PitGame(seed);g.playing=true;g.auto=false;return g};
const tick=(g,t,input)=>{for(let i=0;i<t*120;i++)g.step(1/120,input)};
const enemy=(g,x,z,boss=false)=>({id:g.serial++,x,z,hp:100,maxHp:100,boss,slow:0,burn:0,poison:0,flash:0});
const ball=(g,x,z,vx,vz,kind='seed')=>({id:g.serial++,x,z,vx,vz,kind,damage:10,life:5,last:-1,lock:0,returns:0});
const wall=fresh();wall.enemies=[enemy(wall,0,-8)];wall.balls=[ball(wall,5.7,0,15,-1)];tick(wall,.05);assert(wall.balls[0].vx<0);assert(wall.balls[0].x<=5.75);
const top=fresh();top.enemies=[enemy(top,0,3)];top.balls=[ball(top,0,-10.9,1,-15)];tick(top,.05);assert(top.balls[0].vz>0);
const collide=fresh();const target=enemy(collide,0,0);collide.enemies=[target];collide.balls=[ball(collide,0,1.3,0,-15)];tick(collide,.07);assert(target.hp<100);assert(collide.balls[0].vz>0,'enemy contact reflects projectile');
const catchBall=fresh();catchBall.balls=[ball(catchBall,-.78,7.1,0,15)];tick(catchBall,.02);assert(catchBall.balls[0].vz<0);assert.equal(catchBall.balls[0].returns,1);assert(catchBall.balls[0].damage>10);
const escape=fresh();escape.balls=[ball(escape,4,8.9,0,15)];tick(escape,.1);assert.equal(escape.balls.length,0);
const fire=fresh();fire.auto=true;fire.step(1/120);assert.equal(fire.balls.length,2);assert.deepEqual(new Set(fire.balls.map(b=>b.kind)),new Set(['seed','stone']));assert(fire.balls.every(b=>b.vz<0));fire.fire();assert.equal(fire.balls.length,2);fire.extra=1;fire.fireTime=0;fire.fire();assert.equal(fire.balls.length,6);
const status=fresh();status.enemies=[enemy(status,0,0),enemy(status,1,0),enemy(status,2,0),enemy(status,0,-2)];status.apply(status.enemies[0],ball(status,0,0,0,0,'steam'));assert(status.enemies.every(e=>e.slow>0&&e.burn>0));let hp=status.enemies[0].hp;tick(status,.2);assert(status.enemies[0].hp<hp);
const chain=fresh();chain.enemies=[enemy(chain,0,0),enemy(chain,1,0),enemy(chain,2,0),enemy(chain,0,-2)];chain.apply(chain.enemies[0],ball(chain,0,0,0,0,'tempest'));assert(chain.enemies.every(e=>e.poison>0&&e.hp<100));
for(let i=0;i<RECIPES.length;i++){const g=fresh(),r=RECIPES[i];assert.equal(g.fuse(i),false);g.orbs=[{kind:r.a,rank:2},{kind:r.b,rank:2}];g.paused=true;assert.equal(g.fuse(i),true);assert.deepEqual(g.orbs,[{kind:r.result,rank:1}]);assert.equal(g.fuse(i),false)}
const upgrade=fresh();upgrade.xp=35;upgrade.step(1/120);assert.equal(upgrade.level,2);assert.equal(upgrade.choice.length,3);const time=upgrade.time;tick(upgrade,1);assert.equal(upgrade.time,time);assert.equal(upgrade.choose('invalid'),false);assert(upgrade.choose(upgrade.choice[0].id));assert.equal(upgrade.choice.length,0);
const pause=fresh();pause.paused=true;pause.auto=true;tick(pause,2);assert.equal(pause.time,0);assert.equal(pause.balls.length,0);
const breach=fresh();breach.enemies=[enemy(breach,0,5.1)];breach.step(1/120);assert.equal(breach.hp,88);
const bossBreach=fresh();bossBreach.wave=12;bossBreach.enemies=[enemy(bossBreach,0,5.1,true)];bossBreach.step(1/120);assert(bossBreach.lost);assert(!bossBreach.won,'boss breach is never a victory');
const win=fresh();win.wave=12;const boss=enemy(win,0,0,true);win.enemies=[boss];win.hit(boss,200);win.step(1/120);assert(win.won);const inventory=JSON.stringify(win.orbs);win.descend();assert.equal(win.depth,2);assert.equal(win.wave,1);assert.equal(JSON.stringify(win.orbs),inventory);assert.equal(win.hp,win.maxHp);
const burst=fresh();burst.charge=50;burst.balls=[ball(burst,0,0,0,15)];burst.burst();assert.equal(burst.charge,0);assert(burst.balls[0].vz<0);
const run=fresh(11);run.auto=true;for(let i=0;i<120*160&&!run.lost&&!run.won;i++){if(run.choice.length){const c=run.choice.find(c=>c.id==='extra')||run.choice.find(c=>c.id==='power')||run.choice[0];run.choose(c.id)}const target=run.alive.sort((a,b)=>b.z-a.z)[0];if(target)run.aim={x:target.x,z:target.z};if(run.charge>=50)run.burst();run.step(1/120)}
console.log(`Simulation: wave ${run.wave}, ${run.kills} kills, ${run.hp} courage, ${run.won?'won':run.lost?'lost':'ongoing'}, level ${run.level}.`);assert.equal(run.wave,12);assert(run.won,'normal auto-fire, aim and upgrades can complete a pit');
console.log('Passed ricochets, paw rebounds, elemental effects, fusion, upgrade gating, pause, breach loss, boss victory and a complete run.');

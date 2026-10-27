import assert from 'node:assert/strict';
import {FighterGame,ROSTER} from '../.checks/fighter-game.js';
const fresh=()=>{const g=new FighterGame();g.start();g.intro=0;g.ai=false;return g};
const tick=(g,t,a={move:0},b={move:0})=>{for(let i=0;i<t*120;i++)g.step(1/120,a,b)};
const hit=fresh();hit.fighters[0].x=0;hit.fighters[1].x=1.5;assert(hit.attack(0,'jab'));tick(hit,.3);assert.equal(hit.fighters[1].hp,93);tick(hit,.2);assert.equal(hit.fighters[1].hp,93,'one hit per attack');
const guard=fresh();guard.fighters[0].x=0;guard.fighters[1].x=1.5;guard.attack(0,'kick');tick(guard,.3,{move:0},{move:0,block:true});assert(guard.fighters[1].hp>98,'block reduces damage');
const shot=fresh();shot.fighters[0].meter=34;assert(!shot.attack(0,'special'));shot.fighters[0].meter=50;assert(shot.attack(0,'special'));assert.equal(shot.fighters[0].meter,15);tick(shot,1);assert(shot.fighters[1].hp<100,'projectile connects at range');
const jump=fresh();jump.fighters[0].vy=7.2;tick(jump,.2);assert(jump.fighters[0].y>0);tick(jump,1);assert.equal(jump.fighters[0].y,0);const before=jump.time;jump.pause();tick(jump,2);assert.equal(jump.time,before);
const rounds=fresh();rounds.fighters[1].hp=0;rounds.step(1/120);assert.equal(rounds.state,'round');assert.equal(rounds.wins[0],1);rounds.next();assert.equal(rounds.round,2);assert.equal(rounds.fighters[1].hp,100);rounds.intro=0;rounds.fighters[1].hp=0;rounds.step(1/120);assert.equal(rounds.state,'match');rounds.next();assert.equal(rounds.opponent,1);assert.equal(rounds.round,1);assert.deepEqual(rounds.wins,[0,0]);
const draw=fresh();draw.time=.001;draw.step(1/120);assert.equal(draw.result,2);assert.deepEqual(draw.wins,[0,0]);
let wins=0;for(const id of ROSTER.map(r=>r.id)){const g=new FighterGame();g.pick(id);g.start();for(let i=0;i<120*70&&g.active;i++){const [p,r]=g.fighters,d=Math.abs(r.x-p.x);g.step(1/120,{move:d>1.7?Math.sign(r.x-p.x):0,jab:d<1.85,kick:d>=1.85&&d<2.3,special:d>=2.3&&p.meter>=35});for(const f of g.fighters){assert(Number.isFinite(f.x));assert(f.hp>=0&&f.hp<=100);assert(f.meter>=0&&f.meter<=100)}}assert(['round','match'].includes(g.state));if(g.result===0)wins++;console.log(`${id}: ${g.message}, ${g.fighters.map(f=>Math.round(f.hp)).join(' / ')} HP`)}assert(wins>0,'CPU is beatable');
const ladder=fresh();for(let match=0;match<6;match++){for(let r=0;r<2;r++){ladder.intro=0;ladder.fighters[1].hp=0;ladder.step(1/120);if(r===0)ladder.next()}ladder.next()}assert.equal(ladder.state,'champion');
console.log('Passed strikes, guard damage, specials, jumps, pause, rounds, draws, seven AI matchups and arcade ladder.');
for(const state of ['select','fight','paused','round','match','champion'])for(const {id} of ROSTER){const select=fresh();select.state=state;select.opponent=4;select.wins=[1,1];select.pick(id);assert.equal(select.state,'select');assert.equal(select.fighters[0].id,id);assert.equal(select.selected,id);assert(!select.rivals.includes(id));assert.equal(select.opponent,0);assert.deepEqual(select.wins,[0,0]);select.start();assert.equal(select.fighters[0].id,id)}
for(const direction of [1,-1]){const motion=fresh();motion.fighters[0].x=-3*direction;motion.fighters[1].x=3*direction;motion.fighters[0].facing=direction;tick(motion,.06,{move:0,down:true,block:true});tick(motion,.06,{move:direction,down:true,block:true});tick(motion,.06,{move:direction});motion.step(1/120,{move:direction,jab:true});assert.equal(motion.fighters[0].attack,'special','quarter circle toward opponent launches fireball');assert(motion.fighters[0].meter<20)}
const expired=fresh();tick(expired,.05,{move:0,down:true});tick(expired,.7);tick(expired,.05,{move:1,down:true});expired.step(1/120,{move:1,jab:true});assert.equal(expired.fighters[0].attack,'jab','expired motion remains a normal jab');
for(const {id} of ROSTER){const special=fresh();special.pick(id);special.start();special.intro=0;special.ai=false;assert(special.attack(0,'special'));tick(special,.15);assert.equal(special.shots.length,id==='owl'?3:1);assert(special.shots.every(s=>s.kind===id));if(id==='snake')assert(special.shots[0].y<.4)}
const tape=fresh();tape.pick('agent');tape.start();tape.intro=0;tape.ai=false;tape.attack(0,'special');tick(tape,.8);assert(tape.fighters[1].slow>0);tick(tape,1.5);assert.equal(tape.fighters[1].slow,0);
console.log('Selection from all screens, all special projectiles, mirrored motion inputs, input expiry and tape slow/recovery passed.');

// Rising attacks, supers and story mode.
const risers=await import('../.checks/fighter-game.js');
const {RISERS,SUPERS,STORY,SPECIAL_COST,RISING_COST,SUPER_COST}=risers;
assert.deepEqual([SPECIAL_COST,RISING_COST,SUPER_COST],[35,20,100]);
for(const {id} of ROSTER){
 const g=fresh();g.pick(id);g.start();g.intro=0;g.ai=false;
 g.fighters[0].meter=20;g.fighters[0].x=0;g.fighters[1].x=1.4;assert(g.attack(0,'rising'),id+' rising costs 20');
 assert.equal(g.fighters[0].meter,0);assert(g.fighters[0].vy>7,'rising lifts the fighter');
 tick(g,.2);assert(g.fighters[1].hp<100,'rising connects up close');
 assert(g.fighters[0].y>0,'rising leaves the ground');
 const air=fresh();air.pick(id);air.start();air.intro=0;air.ai=false;air.fighters[0].meter=100;air.fighters[0].y=1.2;
 assert(!air.attack(0,'rising'),'rising is grounded only');assert(!air.attack(0,'super'),'super is grounded only');
 const s=fresh();s.pick(id);s.start();s.intro=0;s.ai=false;s.fighters[0].meter=100;
 assert(s.attack(0,'super'));assert.equal(s.fighters[0].meter,0);tick(s,.15);
 assert.equal(s.shots.length,SUPERS[id].hits,id+' super fires every projectile');
 assert(s.shots.some(x=>x.delay>0),'super projectiles are staggered');
 tick(s,2.2);assert(s.fighters[1].hp<70,'super chips a big chunk');
}
const noMeter=fresh();noMeter.fighters[0].meter=19;assert(!noMeter.attack(0,'rising'));noMeter.fighters[0].meter=99;assert(!noMeter.attack(0,'super'));
for(const direction of [1,-1]){const dp=fresh();dp.fighters[0].x=-3*direction;dp.fighters[1].x=3*direction;dp.fighters[0].facing=direction;dp.fighters[0].meter=100;
 tick(dp,.05,{move:direction});tick(dp,.05,{move:0,down:true,block:true});tick(dp,.05,{move:direction,down:true,block:true});
 dp.step(1/120,{move:direction,down:true,jab:true});assert.equal(dp.fighters[0].attack,'rising','dragon punch motion triggers the rising attack')}
const story=fresh();story.pick('dora');story.start('story');
assert.equal(story.state,'story');assert.equal(story.mode,'story');assert.equal(story.beat.chapter,1);
assert.equal(story.beat.place,STORY[story.rivals[0]].place);
story.advance();assert.equal(story.state,'fight');
for(let chapter=0;chapter<6;chapter++){
 for(let r=0;r<2;r++){story.intro=0;story.fighters[1].hp=0;story.step(1/120);if(r===0)story.next()}
 story.next();assert.equal(story.state,'story');assert.equal(story.beat.title,chapter===5?'OATH TAKEN':'CHAPTER CLEARED');
 story.advance();
 if(chapter<5){assert.equal(story.state,'story');assert.equal(story.beat.chapter,chapter+2);story.advance();assert.equal(story.state,'fight')}
}
assert.equal(story.state,'champion');
const lost=fresh();lost.pick('enzo');lost.start('story');lost.advance();lost.intro=0;lost.fighters[0].hp=0;lost.step(1/120);lost.next();lost.intro=0;lost.fighters[0].hp=0;lost.step(1/120);
assert.equal(lost.state,'match');lost.next();assert.equal(lost.state,'fight');assert.equal(lost.opponent,0,'losing repeats the same chapter');
console.log('Passed rising attacks, dragon punch motion, seven supers, meter costs and the seven-chapter story mode.');

// Training mode.
const solo=(g,t,a={move:0})=>{for(let i=0;i<t*120;i++)g.step(1/120,a)};
const tr=new FighterGame();tr.pick('dora');tr.start('training');tr.intro=0;
assert.equal(tr.mode,'training');assert.equal(tr.state,'fight');assert.equal(tr.fighters[0].meter,100);
const clock=tr.time;solo(tr,3);assert.equal(tr.time,clock,'training has no round timer');
tr.fighters[1].hp=1;tr.step(1/120);assert.equal(tr.fighters[1].hp,100,'dummy heals instead of losing');
assert.equal(tr.state,'fight','training never ends a round');
tr.fighters[0].hp=5;tr.step(1/120);assert.equal(tr.fighters[0].hp,100,'player is topped up too');
tr.fighters[0].meter=0;tr.step(1/120);assert.equal(tr.fighters[0].meter,100,'power stays full');
tr.fighters[0].x=0;tr.fighters[1].x=1.5;tr.attack(0,'jab');solo(tr,.3);
assert(tr.training.hits>0&&tr.training.damage>0,'combo damage is measured');
const peak=tr.training.best;assert(peak>0);solo(tr,1.5);assert.equal(tr.training.damage,0,'the combo counter drops when the combo ends');
assert.equal(tr.training.best,peak,'best combo damage is kept');
tr.resetTraining();assert.deepEqual(tr.training,{damage:0,best:0,hits:0,bestCombo:0});
tr.intro=0;tr.setDummy('block');tr.fighters[0].x=0;tr.fighters[1].x=1.5;tr.attack(0,'kick');solo(tr,.4);
assert(tr.fighters[1].hp>95,'blocking dummy guards');
tr.setDummy('jump');solo(tr,.5);assert(tr.fighters[1].y>0,'jumping dummy hops');
tr.setDummy('fight');solo(tr,3);assert(tr.state==='fight','fighting dummy keeps training running');
const back=new FighterGame();back.pick('owl');back.start('training');back.start('arcade');
assert.equal(back.mode,'arcade');assert.equal(back.time,60);
console.log('Passed training mode: no timer, healing dummy, infinite power, four dummy behaviours and combo tracking.');

// The citizenship journey runs south to north in a fixed order.
const {STORY_ORDER,STORY_INTRO,STORY_END}=risers;
assert.deepEqual(STORY_ORDER,['dora','enzo','fox','snake','owl','agent','trump']);
const road=new FighterGame();road.pick('dora');road.start('story');
assert.deepEqual(road.rivals,STORY_ORDER.filter(id=>id!=='dora'),'story skips your own fighter but keeps the route order');
assert.equal(road.rivals[road.rivals.length-1],'trump','the naturalization hearing is last');
assert(road.beat.text.startsWith(STORY_INTRO),'chapter one opens with the premise');
assert.equal(road.beat.title,'CHAPTER 1 OF 6');
for(let chapter=0;chapter<6;chapter++){road.advance();assert.equal(road.state,'fight');for(let r=0;r<2;r++){road.intro=0;road.fighters[1].hp=0;road.step(1/120);if(r===0)road.next()}road.next();if(chapter<5){road.advance();assert.equal(road.beat.title,`CHAPTER ${chapter+2} OF 6`)}}
assert.equal(road.beat.title,'OATH TAKEN');assert(road.beat.text.endsWith(STORY_END),'the finale grants citizenship');
road.advance();assert.equal(road.state,'champion');
const arcade=new FighterGame();arcade.pick('dora');arcade.start('arcade');
assert.equal(arcade.rivals.length,6,'arcade still fights every other fighter');
console.log('Passed the south-to-north citizenship route, fixed rival order and the oath ending.');

// Paw Fighter II: hit-stop, cancels, scaling, throws, guard, CPU levels, modes, saves and trials.
const {HIT,THROW_DAMAGE,CHIP,STAGES,HOME,TRIALS,DIFFICULTY,readProfile,writeProfile,record}=risers;
const close=(a=0,b=1.5)=>{const g=fresh();g.fighters[0].x=a;g.fighters[1].x=b;return g};
const stop=close();stop.attack(0,'jab');tick(stop,.13);assert(stop.hitstop>0,'a landed hit freezes the fight');const frozen=stop.fighters[0].attackTime;stop.step(1/120);assert.equal(stop.fighters[0].attackTime,frozen,'nothing moves during hit-stop');assert(stop.shake>0,'and the screen shakes');assert(stop.events.some(e=>e.kind==='hit'&&e.move==='jab'),'the page hears about the hit');
const chain=close();chain.attack(0,'jab');tick(chain,.14);assert(!chain.attack(0,'kick'),'a kick cannot start during the jab on its own');assert(chain.attack(0,'kick',true),'but a connected jab cancels into a kick');tick(chain,.3);assert.equal(chain.fighters[0].combo,2,'the kick links');assert(Math.abs(chain.fighters[1].hp-(100-7-11*.88))<1e-9,'the second hit is scaled down');
const whiff=fresh();whiff.attack(0,'jab');tick(whiff,.14);assert(!whiff.attack(0,'kick',true),'a jab that missed cannot cancel');
const tap=close();tap.step(1/120,{move:0,jab:true});tick(tap,.15,{move:0});tap.step(1/120,{move:0,kick:true});tick(tap,.4,{move:0});assert.equal(tap.fighters[0].combo,2,'tapping kick during a landed jab cancels it from the input buffer');
const special=close();special.attack(0,'jab');tick(special,.14);special.attack(0,'kick',true);tick(special,.22);assert(special.attack(0,'special',true),'kick cancels into the special');tick(special,.6);assert.equal(special.fighters[0].combo,3);
const grab=close(0,1.2);grab.step(1/120,{move:0,jab:true,kick:true});assert.equal(grab.fighters[0].attack,'throw','jab and kick together throw');tick(grab,.5,{move:0},{move:0,block:true});assert.equal(grab.fighters[1].hp,100-THROW_DAMAGE,'throws go through a guard');assert(grab.events.some(e=>e.kind==='throw'));
const far=close(0,2.5);far.attack(0,'throw');tick(far,.5);assert.equal(far.fighters[1].hp,100,'a throw out of reach whiffs');assert(far.events.some(e=>e.kind==='whiff'));
const tech=close(0,1.2);tech.attack(0,'throw');tick(tech,.12,{move:0});tech.step(1/120,{move:0},{move:0,jab:true,kick:true});tick(tech,.5);assert.equal(tech.fighters[1].hp,100,'jab and kick while grabbed breaks the throw');assert(tech.events.some(e=>e.kind==='break'));
const both=close(0,1.2);both.step(1/120,{move:0,throw:true},{move:0,throw:true});tick(both,.5);assert.deepEqual(both.fighters.map(f=>f.hp),[100,100],'two throws at once break');
const chip=close();chip.attack(0,'kick');tick(chip,.3,{move:0},{move:0,block:true});assert.equal(chip.fighters[1].hp,100,'blocked normals do no damage');
const chipSpecial=close();chipSpecial.attack(0,'special');tick(chipSpecial,.5,{move:0},{move:0,block:true});assert(Math.abs(chipSpecial.fighters[1].hp-(100-17*CHIP))<1e-9,'blocked specials chip');
const wall=close();let broke=false;for(let n=0;n<12&&!broke;n++){wall.fighters[0].x=0;wall.fighters[1].x=1.6;wall.fighters[0].cooldown=0;wall.fighters[0].attack=null;wall.attack(0,'kick');tick(wall,.3,{move:0},{move:0,block:true});broke=wall.events.some(e=>e.kind==='guardbreak')}
assert(broke,'enough blocked hits break the guard');assert(wall.fighters[1].stun>.5,'a guard break leaves them open');
const rest=close();rest.fighters[1].guard=20;tick(rest,1.5);assert(rest.fighters[1].guard>40,'the guard refills when left alone');
const clash=close(-3,3);clash.attack(0,'special');clash.attack(1,'special');tick(clash,1);assert(clash.events.some(e=>e.kind==='clash'),'fireballs cancel each other');assert.deepEqual(clash.fighters.map(f=>f.hp),[100,100]);
console.log('Passed hit-stop, shake, cancels, the input buffer, damage scaling, throws, throw breaks, chip, guard break and fireball clashes.');
// CPU levels: a hard CPU beats an easy one far more often than not
let hard=0,games=0;for(const id of ROSTER.map(r=>r.id))for(let s=0;s<3;s++){const g=new FighterGame();g.seed=11+s*97;g.pick(id);g.start();g.intro=0;g.demo='easy';g.difficulty='hard';for(let i=0;i<120*65&&g.active;i++)g.step(1/120);games++;if(g.result===1)hard++}
console.log(`hard CPU beat easy CPU in ${hard} of ${games} rounds`);assert(hard>=games*.7,'hard plays better than easy');
assert.deepEqual(Object.keys(DIFFICULTY),['easy','normal','hard']);
// modes
const vs=new FighterGame();vs.pick('dora');vs.startVersus('enzo','docks');vs.intro=0;assert.equal(vs.fighters[1].id,'enzo');assert.equal(vs.stage,'docks');vs.fighters[0].x=0;vs.fighters[1].x=1.5;tick(vs,.3,{move:0},{move:0,jab:true});assert(vs.fighters[0].hp<100,'player two drives the right side');
vs.fighters[0].hp=0;vs.step(1/120);vs.next();vs.intro=0;vs.fighters[0].hp=0;vs.step(1/120);assert.equal(vs.state,'match');assert.equal(vs.message,'PLAYER 2 WINS');vs.next();assert.equal(vs.state,'fight');assert.deepEqual(vs.wins,[0,0],'a versus match ends in a rematch');
const mirror=new FighterGame();mirror.pick('fox');mirror.startVersus('fox');assert.deepEqual(mirror.fighters.map(f=>f.id),['fox','fox'],'mirror matches are allowed in versus');
const arcadeStage=new FighterGame();arcadeStage.pick('dora');arcadeStage.start();assert.equal(arcadeStage.stage,HOME[arcadeStage.rival]);assert.equal(Object.keys(STAGES).length,8);
const surv=new FighterGame();surv.pick('dora');surv.start('survival');surv.intro=0;surv.fighters[0].hp=50;surv.fighters[1].hp=0;surv.step(1/120);assert.equal(surv.state,'match','one round per rival in survival');surv.next();assert.equal(surv.streak,1);assert.equal(surv.fighters[0].hp,80,'health carries over with 30 back');assert.equal(surv.opponent,1);
surv.intro=0;surv.fighters[0].hp=0;surv.step(1/120);assert.equal(surv.state,'result','a loss ends the run');assert.equal(surv.message,'1 DEFEATED');
const ta=new FighterGame();ta.pick('owl');ta.start('timeattack');ta.intro=0;tick(ta,2);assert(Math.abs(ta.clock-2)<.05,'time attack keeps a clock');for(let match=0;match<6;match++){for(let r=0;r<2;r++){ta.intro=0;ta.fighters[1].hp=0;ta.step(1/120);if(r===0)ta.next()}ta.next()}assert.equal(ta.state,'champion');
// saves
const blank=readProfile('nonsense');assert.equal(blank.difficulty,'normal');assert.equal(blank.medals.dora.arcade,false);assert.deepEqual(readProfile(null),blank);
const prof=readProfile(null);ta.selected='owl';let news=record(prof,ta);assert(news.includes('NEW BEST TIME'));assert(prof.medals.owl.time>0);
const champ=new FighterGame();champ.pick('enzo');champ.start();champ.state='champion';news=record(prof,champ);assert(prof.medals.enzo.arcade&&news.some(n=>n.includes('ALTERNATE')),'clearing arcade unlocks alternate colours');
record(prof,surv);assert.equal(prof.medals.dora.survival,1);prof.alt.enzo=true;prof.difficulty='hard';
const again=readProfile(writeProfile(prof));assert.deepEqual(again,prof,'a profile survives a save and load');
assert.equal(readProfile(JSON.stringify({v:1,alt:{fox:true},medals:{}})).alt.fox,undefined,'alternate colours need the arcade medal');
// combo trials
const trial=new FighterGame();trial.pick('dora');trial.start('training');trial.intro=0;trial.setTrial(0);trial.fighters[0].x=0;trial.fighters[1].x=1.5;trial.attack(0,'jab');tick(trial,.14,{move:0});trial.attack(0,'kick',true);tick(trial,.4,{move:0});assert(trial.trialDone,'jab into kick clears the first trial');news=record(prof,trial);assert(news.includes('TRIAL CLEARED'));assert(prof.trials['dora:0']);
const trial2=new FighterGame();trial2.pick('enzo');trial2.start('training');trial2.intro=0;trial2.setTrial(1);trial2.fighters[0].x=0;trial2.fighters[1].x=1.5;trial2.attack(0,'jab');tick(trial2,.5,{move:0});trial2.attack(0,'kick');tick(trial2,.5,{move:0});assert(!trial2.trialDone,'hits that do not link do not count');
assert.equal(TRIALS.length,5);
console.log('Passed CPU levels, versus, mirror matches, eight arenas, survival, time attack, saves, medals, alternate colours and combo trials.');

import assert from 'node:assert/strict';
import {KartGame,KartCup,TRACKS,CLASSES,POINTS,YOU,CIRCUIT,LAPS,trackPoint,patchAt,loadKart,recordRace,recordCup} from '../.checks/kart-game.js';
const input={gas:true,brake:false,steer:0,drift:false};
const tick=(g,t,i=input)=>{for(let n=0;n<Math.ceil(t*120);n++)g.step(1/120,i)};
const fresh=()=>{const g=new KartGame();g.start();tick(g,3.1);return g};
const countdown=new KartGame();countdown.start();tick(countdown,1);countdown.pause();const left=countdown.countdown;tick(countdown,1);assert.equal(countdown.countdown,left);countdown.pause();tick(countdown,2.1);assert.equal(countdown.state,'racing');
const drive=fresh();tick(drive,3);assert(drive.speed>20);const s=drive.s;drive.pause();tick(drive,2);assert.equal(drive.s,s);drive.pause();tick(drive,1,{...input,gas:false,brake:true});assert(drive.speed<3);
const drift=fresh();tick(drift,2);tick(drift,.8,{...input,steer:1,drift:true});assert(drift.drift>.65);drift.step(1/120,input);assert(drift.boost>1);assert.equal(drift.drift,0);
const dirt=fresh();dirt.lane=8;tick(dirt,3);assert(dirt.speed<=11);tick(dirt,3,{...input,steer:1});assert.equal(dirt.lane,9);
const pickup=fresh();pickup.s=29.99;pickup.speed=20;pickup.step(1/120,input);assert.equal(pickup.item,'boost');assert(pickup.useItem());assert.equal(pickup.item,null);assert(pickup.boost>0);assert(!pickup.useItem());
const freeze=fresh();freeze.item='frost';freeze.rivals[0].s=freeze.s+1;assert(freeze.useItem());assert(freeze.rivals.some(r=>r.slow===3));freeze.item='dust';freeze.s=50;freeze.rivals.forEach(r=>r.s=35);assert(freeze.useItem());assert(freeze.rivals.every(r=>r.slow===3));
const save=fresh();save.item='frost';save.rivals.forEach(r=>r.s=save.s-10);assert(!save.useItem());assert.equal(save.item,'frost');
const pad=fresh();pad.s=64.99;pad.lane=3;pad.speed=20;pad.step(1/120,input);assert(pad.boost>0);
const lap=fresh();lap.s=CIRCUIT-.01;lap.speed=20;lap.step(1/120,input);assert.equal(lap.lap,2);
const race=fresh();for(let i=0;i<120*60&&race.state!=='finished';i++){if(race.item)race.useItem();race.step(1/120,input)}assert.equal(race.state,'finished');assert.equal(race.s,CIRCUIT*LAPS);assert(race.finishPlace>=1&&race.finishPlace<=5);console.log(`Complete race: ${race.finishTime.toFixed(1)}s, place ${race.finishPlace}/5.`);const time=race.time;tick(race,1);assert.equal(race.time,time);
for(let s=0;s<720;s+=7){const p=trackPoint(s,3);assert(Number.isFinite(p.x));assert(Math.abs(Math.hypot(p.tx,p.tz)-1)<1e-9)}const a=trackPoint(0),b=trackPoint(CIRCUIT);assert(Math.hypot(a.x-b.x,a.z-b.z)<1e-9);
console.log('Passed countdown/pause, acceleration/brakes, drift boost, off-road penalty, pickups, all items, boost strip, laps, closed track and complete race.');
// every circuit closes on itself, has unit tangents, and keeps its pads and patches on the road
for(const t of TRACKS){const a=trackPoint(0,0,t),b=trackPoint(CIRCUIT,0,t);assert(Math.hypot(a.x-b.x,a.z-b.z)<1e-9,t.id);for(let s=0;s<CIRCUIT;s+=3){const p=trackPoint(s,6,t);assert(Math.abs(Math.hypot(p.tx,p.tz)-1)<1e-9);const q=trackPoint(s+CIRCUIT/2,0,t);assert(Math.hypot(p.x-q.x,p.z-q.z)>14,`${t.id} road keeps clear of the far side`)}for(const p of [...t.pads,...t.patches])assert(Math.abs(p.lane)<5.6&&p.s>0&&p.s<CIRCUIT)}
assert.deepEqual(TRACKS.map(t=>t.id),['dust','canyon','frost']);assert.equal(new KartGame().track.id,'dust');
// mud caps speed, ice steals grip; the patch is announced once
const mud=new KartGame(1);mud.start();tick(mud,3.1);const m=TRACKS[1].patches[0];mud.s=m.s+1;mud.lane=m.lane;mud.speed=22;mud.step(1/120,input);assert(mud.speed<=14);assert.match(mud.message,/Mud/);
const ice=new KartGame(2);ice.start();tick(ice,3.1);const p0=TRACKS[2].patches[2];ice.s=p0.s;ice.lane=p0.lane;ice.speed=20;tick(ice,.2,{...input,steer:1});const iced=ice.lane-p0.lane;const dry=new KartGame(2);dry.start();tick(dry,3.1);dry.s=p0.s-40;dry.lane=p0.lane;dry.speed=20;tick(dry,.2,{...input,steer:1});assert(iced<(dry.lane-p0.lane)*.5,'ice cuts steering');
assert.equal(patchAt(TRACKS[0],100,0),null);assert(patchAt(TRACKS[1],TRACKS[1].patches[0].s+CIRCUIT+2,TRACKS[1].patches[0].lane),'patches repeat each lap');
// each circuit's own gold strips fire on every lap
for(const [i,t] of TRACKS.entries())for(const lapBase of [0,CIRCUIT]){const g=new KartGame(i);g.start();tick(g,3.1);const pd=t.pads[1];g.s=lapBase+pd.s-.01;g.lane=pd.lane;g.speed=20;g.boost=0;g.step(1/120,input);assert(g.boost>0,`${t.id} strip at ${pd.s}`)}
// faster classes field faster rivals
assert(new KartGame(0,'summit').rivals[3].speed>new KartGame(0,'boulder').rivals[3].speed&&new KartGame(0,'boulder').rivals[3].speed>new KartGame(0,'pebble').rivals[3].speed);
// finishing order and cup points
const done=new KartGame();done.start();tick(done,3.1);done.rivals[3].finish=.05;done.rivals[3].s=CIRCUIT*LAPS;done.rivals[0].s=500;done.rivals[1].s=600;done.rivals[2].s=700;done.s=CIRCUIT*LAPS-.01;done.speed=20;done.step(1/120,input);assert.equal(done.state,'finished');assert.deepEqual(done.order(),['Mountain Cougar',YOU,'Sly Snake','Night Owl','Copper Fox']);
const cup=new KartCup('pebble');assert.equal(cup.game().track.id,'dust');cup.add(done.order());assert.equal(cup.points[YOU],POINTS[1]);assert.equal(cup.game().track.id,'canyon');cup.add([YOU,'Mountain Cougar','Sly Snake','Night Owl','Copper Fox']);assert.equal(cup.points[YOU],17);assert.equal(cup.points['Mountain Cougar'],17);assert.equal(cup.place,1,'Dora & Enzo win a tie');cup.add(['Mountain Cougar',YOU,'Sly Snake','Night Owl','Copper Fox']);assert(cup.done);assert.equal(cup.place,2);cup.add([YOU]);assert.equal(cup.points[YOU],24,'a finished cup takes no more races');
// saving
const sv=loadKart('nonsense');assert.deepEqual(sv,{best:{},cups:{}});assert(recordRace(sv,'dust',30));assert(!recordRace(sv,'dust',31));assert(recordRace(sv,'dust',29));assert(recordCup(sv,'boulder',2));assert(!recordCup(sv,'boulder',3));assert(recordCup(sv,'boulder',1));assert.deepEqual(loadKart(JSON.stringify(sv)),{best:{dust:29},cups:{boulder:1}});
// balance: holding gas alone wins Pebble races but not Summit; good driving wins Summit
const driver=(g,skill)=>{g.start();for(let i=0;i<120*90&&g.state!=='finished';i++){let steer=0,drift=false;if(skill){const u=g.s%CIRCUIT;let target=0;const pd=g.track.pads.map(p=>({...p,d:(p.s-u+CIRCUIT)%CIRCUIT})).sort((a,b)=>a.d-b.d)[0];if(pd.d<22)target=pd.lane;for(let a=0;a<14;a++){const hit=patchAt(g.track,g.s+a,target);if(hit){target=hit.lane>0?target-3.2:target+3.2;break}}steer=Math.max(-1,Math.min(1,(target-g.lane)*1.5));if(Math.abs(steer)<.15){steer=(Math.floor(g.time/1.6)%2?1:-1)*.2;drift=g.time%1.6<.75}}if(g.item)g.useItem();g.step(1/120,{gas:true,brake:false,steer,drift})}assert.equal(g.state,'finished');return g.finishPlace};
const places=sp=>TRACKS.map((_,i)=>[driver(new KartGame(i,sp),false),driver(new KartGame(i,sp),true)]);
const pebble=places('pebble'),summit=places('summit');console.log(`Gas only / good driver places · Pebble ${pebble.map(p=>p.join('/')).join(' ')} · Summit ${summit.map(p=>p.join('/')).join(' ')}`);
assert(pebble.every(([g])=>g===1),'gas alone wins every Pebble race');assert(summit.filter(([g])=>g>1).length>=2,'gas alone loses most Summit races');assert(summit.every(([,s])=>s<=2),'good driving reaches the podium top two in Summit');
console.log('Passed three closed circuits, mud and ice, per-circuit strips, speed classes, finishing order, cup points and ties, saving and balance.');

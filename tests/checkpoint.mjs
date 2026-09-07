import assert from 'node:assert/strict';
import {CheckpointGame,Rng,makeDay,makeTraveler,violations,REGIONS,SPECIES,PURPOSES,PAY_PER_TRAVELER,FINE,RENT,rentFor} from '../.checks/checkpoint-game.js';

// Rules escalate over the week.
const day1=makeDay(1),day7=makeDay(7);
assert.equal(day1.day,1);assert(day1.quota<day7.quota,'quotas grow');
assert(day7.rules.length>day1.rules.length,'later days add rules');
assert(day7.checkWeight&&day7.checkSeal,'weight and seal checks arrive later');
assert(day1.rules.some(r=>r.id==='name'),'the name rule is present from the start');
for(let d=1;d<=7;d++){const day=makeDay(d);assert(day.allowed.length>0,'at least one region stays open');assert(day.allowedPurposes.length>0);assert(day.dialogue.length>10,'Enzo always says something')}

// A clean traveler has no violations; each planted fault is detectable.
const rng=new Rng(3);
const clean=makeTraveler(day7,rng,true);assert.deepEqual(clean.flags,[],'forced clean travelers pass');
assert.deepEqual(violations(clean.papers,day7),[],'the checker agrees');
let faulty=0,pristine=0;
for(let i=0;i<400;i++){const t=makeTraveler(makeDay((i%7)+1),rng);
 assert.deepEqual(t.flags,violations(t.papers,makeDay((i%7)+1)),'flags always match the rule checker');
 assert(REGIONS.includes(t.papers.region)&&SPECIES.includes(t.papers.species)&&PURPOSES.includes(t.papers.purpose));
 assert(t.line.length>3,'every traveler says a line');
 if(t.flags.length)faulty++;else pristine++}
assert(faulty>80&&pristine>80,'the queue mixes valid and invalid papers');

// Each individual violation is caught.
const day=makeDay(7),base=makeTraveler(day,new Rng(11),true).papers;
assert.deepEqual(violations({...base,expires:day.date-1},day),['expired']);
assert.deepEqual(violations({...base,permitName:'NOTDORA'},day),['name']);
assert.deepEqual(violations({...base,hasPermit:false},day),['permit']);
assert.deepEqual(violations({...base,sealed:false},day),['seal']);
assert.deepEqual(violations({...base,statedWeight:base.weight+40},day),['weight']);
assert.deepEqual(violations({...base,statedWeight:base.weight+10},day),[],'small weight drift is tolerated');
assert.deepEqual(violations({...base,species:day.bannedSpecies[0]},day),['species']);
const closed=REGIONS.find(r=>!day.allowed.includes(r));
assert.deepEqual(violations({...base,region:closed,permitRegion:closed},day),['region']);

// Scoring: correct calls pay, wrong calls cite and fine.
const g=new CheckpointGame(5);
assert.equal(g.state,'briefing');g.begin();assert.equal(g.state,'shift');
const start=g.credits,bad=g.traveler.flags.length>0;
const v=g.decide(bad?false:true);
assert(v.correct,'a correct call is correct');assert.equal(g.citations,0);
assert.equal(g.credits,start+PAY_PER_TRAVELER,'correct calls pay');
g.nextTraveler();
const before=g.credits,wrong=g.traveler.flags.length>0;
const w=g.decide(wrong?true:false);
assert(!w.correct);assert.equal(g.citations,1,'wrong calls cite');
assert.equal(g.credits,before+PAY_PER_TRAVELER-FINE,'wrong calls are fined');
assert(w.reason.includes('CITATION'));
assert.equal(g.processed,2);assert.equal(g.approved+g.denied,2);
assert.equal(g.log.length,2,'every decision is logged');

// Detaining only applies to a denied traveler who really was in violation.
const det=new CheckpointGame(9);det.begin();
while(!det.traveler.flags.length){det.decide(true);det.nextTraveler()}
det.decide(false);assert(det.detain(),'a denied violator can be detained');
const credits=det.credits;assert(!det.detain()||det.credits>=credits);
const ok=new CheckpointGame(9);ok.begin();while(ok.traveler.flags.length){ok.decide(false);ok.nextTraveler()}
ok.decide(true);assert(!ok.detain(),'approved travelers cannot be detained');

// A full shift ends at quota, charges rent, then rolls into the next day.
const shift=new CheckpointGame(21);shift.begin();
const quota=shift.day.quota;
for(let i=0;i<quota;i++){assert.equal(shift.state,'shift');shift.decide(shift.traveler.flags.length===0);shift.nextTraveler()}
assert.equal(shift.state,'report','the shift ends at quota');
assert.equal(shift.processed,quota);
assert.equal(shift.accuracy,100,'a perfect shift reports full accuracy');
shift.nextDay();assert.equal(shift.day.day,2);assert.equal(shift.processed,0);assert.equal(shift.state,'briefing');

// A perfect week reaches the good ending; bankruptcy closes the booth.
const week=new CheckpointGame(33);
for(let d=0;d<7;d++){week.begin();const q=week.day.quota;
 for(let i=0;i<q;i++){week.decide(week.traveler.flags.length===0);week.nextTraveler()}
 assert.equal(week.state,'report');week.nextDay()}
assert.equal(week.state,'ending');
assert.equal(week.ending.title,'PAPERS IN ORDER','a clean week earns the good ending');
const broke=new CheckpointGame(4);broke.begin();broke.credits=1;broke.endDay();
assert.equal(broke.credits,0,'rent can wipe you out');
broke.nextDay();assert.equal(broke.state,'ending');assert.equal(broke.ending.title,'BOOTH CLOSED');
assert.equal(RENT,14);
assert(rentFor(7)>rentFor(1),'rent climbs across the week');
// Careless work closes the booth; careful work pays for the ending.
const sloppy=new CheckpointGame(33);
for(let d=0;d<7&&sloppy.state!=='ending';d++){sloppy.begin();for(let i=0;i<sloppy.day.quota;i++){sloppy.decide(sloppy.traveler.flags.length>0);sloppy.nextTraveler()}sloppy.nextDay()}
assert.equal(sloppy.ending.title,'BOOTH CLOSED','always getting it wrong loses the booth');

// The same seed always produces the same queue.
const runA=new CheckpointGame(77),runB=new CheckpointGame(77);
runA.begin();runB.begin();
for(let i=0;i<6;i++){assert.deepEqual(runA.traveler.papers,runB.traveler.papers,'seeded runs match');
 runA.decide(true);runB.decide(true);runA.nextTraveler();runB.nextTraveler()}
const other=new CheckpointGame(78);other.begin();
assert.notDeepEqual(other.traveler.papers,runA.traveler.papers,'different seeds differ');

console.log('Passed checkpoint rules, escalating days, every violation type, pay/fines, detention, quotas, rent, both endings and seeded determinism.');

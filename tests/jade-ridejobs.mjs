// Jade Street, the sixteenth pass's ride jobs: four Hawker Tales built round the fifteenth pass's rides. The ice-cream
// chime lures the bats off their posts for a cone (two each, then they are full) while you photograph what they guard;
// the dragon-boat delivery's timer only fits a boat with the partner on the drum, whose surge hits harder; the tandem
// parcel run needs the partner on the back saddle to toss each parcel (F); the luge job is a chase down Siloso Road.
// Each has a giver with painted portraits and body, a par, and the job list's counts still come from the data.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSION, SIDE, PEOPLE } from '../.checks/jade-story.js';
import { tossRange, rideTag } from '../.checks/jade-ridejobs.js';
import { treatTime, CONES, LOUD } from '../.checks/jade-aware.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES } from '../.checks/jade-art.js';
import { tierOf } from '../.checks/jade-load.js';
import { tagOption } from '../.checks/jade-tag.js';
import { travelPlan, travelText, CHAIN_SAVE } from '../.checks/jade-mrt.js';
import { listContracts } from '../.checks/jade-contracts.js';
import { MISSIONS } from '../.checks/jade-story.js';
import { newSave } from '../.checks/jade-save.js';
import { T } from '../.checks/jade-city.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const JOBS = ['k20', 'k21', 'k22', 'k23'];
function at(id, i, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? false, diff: o.diff ?? 'normal' });
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const stepOf = (id, t) => MISSION[id].steps.findIndex(s => s.t === t);

test('four ride jobs, one per ride, each with a painted giver, a par and a real place', () => {
  for (const id of JOBS) assert.ok(SIDE.some(m => m.id === id), id);
  const rides = JOBS.map(id => MISSION[id].steps.find(s => s.t === 'ride').kind);
  assert.deepEqual(rides, ['icecream', 'dragon', 'tandem', 'luge']);
  for (const id of JOBS) {
    const m = MISSION[id]; assert.ok(PAR[id] > 0, `${id} par`);
    const g = PEOPLE[m.giver]; assert.ok(g, `${id} giver`);
    assert.ok(FRAMES[g.face] && FRAMES[`npc-${m.giver}-idle-0`] || ['bala', 'helang'].includes(m.giver), `${id}: ${m.giver} painted`);
  }
  assert.equal(MISSION.k20.steps.find(s => s.t === 'case').skin, 'bat');
  assert.ok(MISSION.k22.steps.some(s => s.t === 'toss') && MISSION.k21.steps.some(s => s.t === 'paddle'));
  assert.ok(!JOBS.some(id => MISSION[id].steps.some(s => s.t === 'race')), 'no races or time trials');
});

test('each job hands you a ride that is clear of the giver and props and moves when you press on (Picnic Post once spawned its tandem on Uncle Bala)', () => {
  for (const id of JOBS) {
    const s = missionSave(id, { assist: true, diff: 'normal' }); const w = new World(s, 9); w.quiet = true;
    w.step(NO_INPUT, DT); // the givers take their places
    w.startMission(MISSION[id]); w.talk = null; const run = w.run, i = stepOf(id, 'ride'); run.snap = run.snapshot(i); run.enter(i);
    const r = run.ride; assert.ok(r, `${id}: a ride`); w.placePlayer(r.b.x, r.b.y + 40); w.enter(r);
    for (let k = 0; k < 90; k++) { if (w.talk) w.talk = null; w.step(NO_INPUT, DT); }
    let best = 0;
    for (const [mx, my] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x0 = r.b.x, y0 = r.b.y; for (let k = 0; k < 40; k++) w.step({ ...NO_INPUT, mx, my }, DT); best = Math.max(best, Math.hypot(r.b.x - x0, r.b.y - y0)); }
    assert.ok(best > 40, `${id}: the ${r.kind} moves (${best.toFixed(0)})`);
  }
});

test('pedal rides are never booked for speeding (Picnic Post crosses a silver zone at tandem speed)', () => {
  const s = missionSave('k22', { assist: false, diff: 'normal' }); const w = new World(s, 9); w.quiet = true; w.step(NO_INPUT, DT);
  const z = w.c.sg.silver[0], x = (z[0] + z[2]) / 2 * T + T / 2, y = (z[1] + z[3]) / 2 * T + T / 2;
  const fined = kind => {
    const r = w.addRide(kind, x, y, 0, false, 0, true); w.placePlayer(x, y + 40); w.enter(r);
    for (let k = 0; k < 30 && w.p.ride !== r; k++) w.step(NO_INPUT, DT);
    assert.equal(w.p.ride, r, kind); w.ticket = null; w.fineCd.clear();
    r.b.x = x; r.b.y = y; r.b.speed = 360; const f0 = w.fx.length; w.step(NO_INPUT, DT);
    const hit = w.fx.slice(f0).some(f => f.kind === 'speeding') || w.ticket?.kind === 'speeding';
    w.exit(); for (let k = 0; k < 30; k++) w.step(NO_INPUT, DT); w.ticket = null; return hit;
  };
  assert.ok(!fined('tandem') && !fined('bike'), 'pedals: no speeding');
  assert.ok(fined('scooter'), 'a scooter still is');
});

test('the ice-cream chime is a lure: a hungry guard comes, eats (blind) and goes back; two cones and they are full', () => {
  assert.ok(LOUD.chime > 400);
  assert.ok(treatTime({ s: { settings: { assist: true, diff: 'normal' } } }) > treatTime({ s: { settings: { assist: false, diff: 'hard' } } }));
  assert.equal(CONES, 2);
  const { w, run } = at('k20', stepOf('k20', 'case'));
  w.step(NO_INPUT, DT); const g = run.actors.find(a => a.mind); assert.ok(g, 'a guard'); // (minds start on the first step)
  const r = w.rides.find(q => q.kind === 'icecream');
  // drive the bike up beside the guard and ring the chime
  w.placePlayer(g.b.x + 150, g.b.y); r.b.x = w.p.x; r.b.y = w.p.y; w.p.ride = r; r.driver = w.p;
  w.p.chimeT = 0; w.honk();
  for (let k = 0; k < 30 && !g.mind.wantTreat && !(g.mind.treat > 0); k++) w.step(NO_INPUT, DT);
  assert.ok(g.mind.wantTreat || g.mind.treat > 0, 'heard it and wants an ice cream');
  let ate = false;
  for (let k = 0; k < 60 * 20 && !ate; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; ate = (g.mind.treat ?? 0) > 0; }
  assert.ok(ate, 'came over and is eating'); assert.equal(g.mind.cones, 1);
  for (let k = 0; k < 60 * 14; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  assert.equal(g.mind.treat, 0, 'finished the cone');
  g.mind.cones = CONES; w.p.chimeT = 0; w.honk(); for (let k = 0; k < 30; k++) w.step(NO_INPUT, DT); assert.ok(!g.mind.wantTreat && !(g.mind.treat > 0), 'full after two');
});

test('the tandem parcel run: F tosses only with the partner aboard and a mark in reach, and four tosses finish it', () => {
  const { w, run, st } = at('k22', stepOf('k22', 'toss'));
  assert.equal(run.items.length, 4); assert.equal(run.progress, 'Parcels 0/4');
  assert.equal(rideTag(run), null, 'not on the tandem: nothing to toss');
  w.step(NO_INPUT, DT); assert.match(run.label, /tandem/i);
  const r = w.rides.find(q => q.kind === 'tandem' && q.parked && Math.hypot(q.b.x - w.p.x, q.b.y - w.p.y) < 2000) ?? w.rides.find(q => q.kind === 'tandem');
  w.placePlayer(r.b.x, r.b.y + 40); w.mate.b.x = r.b.x + 30; w.mate.b.y = r.b.y + 40; w.p.act = null; w.enter(r);
  for (let k = 0; k < 240 && w.mate.seat !== r; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  assert.equal(w.p.ride, r, 'on the tandem'); assert.equal(w.mate.seat, r, 'the partner on the back saddle');
  for (const it of run.items) {
    r.b.x = it.x + tossRange(run) - 40; r.b.y = it.y; r.b.speed = 0; w.step(NO_INPUT, DT);
    w.mate.tossT = 0;
    const o = tagOption(w); assert.equal(o?.kind, 'toss', 'F offers the toss'); o.go();
    assert.ok(it.got && w.mate.tossT > 0, 'tossed, with its animation');
  }
  const solo = at('k22', stepOf('k22', 'toss')); solo.w.step(NO_INPUT, DT); assert.equal(rideTag(solo.run), null, 'on foot: no toss');
  assert.notEqual(run.cur, st, 'the step is done');
});

test('the dragon-boat delivery: the drum is the point (crewed with surges makes it, alone does not)', () => {
  // on Normal without Assist: a perfect crew makes it with time to spare; alone (the partner kept off the boat) even
  // perfect surges are too slow
  const o = { assist: false, diff: 'normal' };
  const crew = playMission('k21', 'perfect', 3, o), solo = playMission('k21', 'perfect', 3, { ...o, solo: 1, each: w => { if (w.mate.seat) w.mate.seat = null; } });
  assert.ok(crew.won, 'crewed with surges'); assert.ok(!solo.won || solo.fails > 0, 'alone and without surges it runs out of time');
});

test('every ride job is won by the bots, and the new art streams (never core)', () => {
  for (const id of JOBS) assert.ok(playMission(id, 'casual', 5).won, `${id} casual`);
  for (const a of ['atlas-act16', 'atlas-cast16-far', 'atlas-cast16-south', 'atlas-stands16', 'atlas-lake16']) assert.notEqual(tierOf(a), 'core', a);
  for (const h of ['dora', 'enzo']) for (const f of ['toss-0', 'toss-1', 'ride-bell-0', 'ride-bell-1', 'ride-stroke-0', 'ride-stroke-1', 'serve-0', 'serve-1']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
  for (const b of ['chweekueh', 'yongsiak', 'riversatay', 'jazzbar', 'lakeshop', 'laketea']) for (let l = 0; l < 4; l++) assert.ok(FRAMES[`biz-${b}-${l}`], `${b} ${l}`);
  assert.ok(FRAMES['lake-bank']);
});
function late(cash = 300) {
  const s = newSave(5); s.started = true; s.story.intro = true; s.story.ch = 9; s.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)]; s.cash = cash;
  const w = new World(s, 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT); return w;
}

test('Route me chains two rides when that is clearly quicker than one, and names both', () => {
  const w = late(0), E = w.c.east;
  // a stretched ferry (its far pier moved out past Changi) makes the cable car then the ferry worth it from Sentosa
  const far = { ...E.ferry.stops[1], x: E.ferry.stops[1].x + T * 140, y: E.ferry.stops[1].y };
  w.c = { ...w.c, east: { ...E, ferry: { ...E.ferry, stops: [{ ...E.ferry.stops[0], x: E.cable.stops[0].x + T * 2, y: E.cable.stops[0].y }, far] } } };
  const a = E.cable.stops[1]; w.placePlayer(a.x - T * 3, a.y);
  const t = travelPlan(w, far.x, far.y + T * 2);
  assert.ok(t?.then, 'two rides'); assert.equal(t.via, 'cable'); assert.equal(t.then.via, 'ferry');
  assert.match(travelText(t), /Cable car: .* then Ferry: /);
  assert.ok(CHAIN_SAVE > 0.1, 'only when clearly quicker');
  // on the real map, the one-ride plans stand (the MRT reaches Sentosa)
  const r = late(); r.placePlayer(a.x - T * 3, a.y); const z = r.c.isle.stations.find(s => s.id === 'stn-changi');
  assert.ok(!travelPlan(r, z.x, z.y + T * 3)?.then);
});

test('a new night deals its contracts one a frame on the street (never three in one step), all at once on the phone', () => {
  const w = late();
  listContracts(w); w.s.night++;
  assert.equal(listContracts(w, true).filter(l => l.tag === 'offer').length, 1, 'one this frame');
  assert.equal(listContracts(w, true).filter(l => l.tag === 'offer').length, 2);
  assert.equal(listContracts(w).filter(l => l.tag === 'offer').length, 3, 'the phone deals the rest');
  w.s.night++; for (let k = 0; k < 4; k++) w.step(NO_INPUT, DT);
  assert.equal(w.s.contracts.offers.length, 3, 'a few frames on the street deal all three');
});
// 21-11: a River Run retry picked the bumboat left out mid-river from the try before, which nobody could step into
test('a ride step never hands you a boat out of reach of the bank', () => {
  const { w, run } = at('m59', 1); const r1 = run.ride;
  assert.ok(r1 && w.boardable(r1.b.x, r1.b.y), 'the first boat waits by the steps');
  let spot = null;
  for (let dy = -4; dy <= 4 && !spot; dy += 0.5) for (let dx = -4; dx <= 4 && !spot; dx += 0.5) {
    const x = r1.b.x + dx * T, y = r1.b.y + dy * T;
    if (Math.hypot(dx, dy) * T < 240 && w.c.solid && !w.boardable(x, y) && w.rideSpot('boat', x, y)) spot = [x, y];
  }
  assert.ok(spot, 'there is open water out of reach near the steps');
  r1.b.x = spot[0]; r1.b.y = spot[1]; r1.parked = true;
  run.enter(1); w.talk = null;
  assert.ok(run.ride && run.ride !== r1, 'the stranded boat is not offered again');
  assert.ok(w.boardable(run.ride.b.x, run.ride.b.y), 'the new boat can be boarded from the bank');
});
console.log(`jade ride jobs: ${n} tests ok`);

// Jade Street, the fifteenth pass's four rides: a tandem bike at the East Coast Park racks, the ice-cream uncle's
// motorbike and sidecar on Orchard Road, a Skyline Luge cart on Sentosa and a dragon boat at Clarke Quay. Their stats,
// one of each parked in the right district beside what it belongs to, their seats and the partner boarding each (the
// one-seat luge gives the partner their own cart), what makes each one ride differently, getting on and off, and
// every painted frame the drawing can ask for.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, S, districtAt, city } from '../.checks/jade-city.js';
import { mvT } from '../.checks/jade-layout.js';
import { MISSIONS, SIDE } from '../.checks/jade-story.js';
import { newSave } from '../.checks/jade-save.js';
import { VEHICLES, VEHICLE_KINDS, OWN_COPY, onWater } from '../.checks/jade-move.js';
import { NEW_RIDES } from '../.checks/jade-rides.js';
import { nearestFree } from '../.checks/jade-nav.js';
import { leaveSeat } from '../.checks/jade-duo.js';
import { FRAMES, FILL } from '../.checks/jade-art.js';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const allDone = MISSIONS.map(m => m.id);
const OLD = ['scooter', 'trishaw', 'tuktuk', 'van', 'boat', 'bike'], NEW = ['tandem', 'icecream', 'luge', 'dragon'];
const tile = (x, y) => [Math.floor(x / T), Math.floor(y / T)];
function world(o = {}) {
  const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.story.ch = 9; s.done = [...allDone, ...SIDE.map(m => m.id)]; s.cash = 300;
  s.settings.diff = 'normal'; s.settings.assist = false;
  const w = new World(s, o.seed ?? 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT); return w;
}
/** stand beside a ride, press the action, and step until on it */
function board(w, r) {
  const [fx, fy] = nearestFree(c, 'foot', r.b.x, r.b.y + 30, w.open, 3);
  w.placePlayer(fx, fy); w.p.act = null; w.findNear();
  assert.equal(w.near?.kind, 'ride', `${r.kind}: a ride prompt`); assert.equal(w.near.ride, r, `${r.kind}: the prompt is for this ride`);
  w.interact(); for (let k = 0; k < 40; k++) w.step(NO_INPUT, DT);
  assert.equal(w.p.ride, r, `on the ${r.kind}`);
}
/** ride alone: the partner gets off and is posted a long way back (a post, so they don't wander back aboard) */
function alone(w) {
  leaveSeat(w, w.mate); w.mate.act = null; w.mate.b.x -= 600; w.mate.ai.mode = 'post'; w.mate.ai.story = true; w.mate.ai.at = [w.mate.b.x, w.mate.b.y];
  w.step(NO_INPUT, DT); assert.equal(w.mate.seat, null, 'riding alone');
}
/** the partner, beside you, follows you onto the ride */
function mateAboard(w, r) {
  for (let k = 0; k < 120 && w.mate.seat !== r; k++) w.step(NO_INPUT, DT);
  return w.mate.seat === r;
}

test('the four new rides: names, blurbs, stats, seats and classes, each unlike the six older kinds', () => {
  assert.deepEqual(VEHICLE_KINDS, [...OLD, ...NEW, 'cab', 'kayak']); // (the twentieth pass's two perk rides after them: tests/jade-twenty.mjs)
  for (const k of NEW) {
    const v = VEHICLES[k]; assert.ok(v.name && v.blurb.length > 40, k);
    // no older kind shares its speed, size, class and seats
    for (const o of OLD) { const u = VEHICLES[o]; assert.ok(u.speed !== v.speed || u.len !== v.len || u.cls !== v.cls || u.seats !== v.seats, `${k} vs ${o}`); }
  }
  assert.equal(VEHICLES.tandem.seats, 2); assert.equal(VEHICLES.tandem.cls, 'small');
  assert.equal(VEHICLES.icecream.seats, 2); assert.equal(VEHICLES.icecream.cls, 'big'); assert.ok(VEHICLES.icecream.cargo < VEHICLES.trishaw.cargo, 'a small freezer');
  assert.equal(VEHICLES.luge.seats, 1); assert.ok(OWN_COPY.has('luge') && OWN_COPY.has('bike') && !OWN_COPY.has('scooter'));
  assert.ok(VEHICLE_KINDS.every(k => k === 'luge' || VEHICLES[k].speed < VEHICLES.luge.speed), 'the luge is the quickest ride');
  assert.ok(VEHICLES.luge.cargo < VEHICLES.bike.cargo && VEHICLES.luge.len < VEHICLES.bike.len, 'the luge is small and low');
  assert.equal(VEHICLES.dragon.cls, 'boat'); assert.equal(VEHICLES.dragon.seats, 2); assert.ok(onWater('dragon') && onWater('boat') && !onWater('tandem'));
  assert.ok(VEHICLES.dragon.len > VEHICLES.boat.len && VEHICLES.dragon.turn < VEHICLES.boat.turn && VEHICLES.dragon.speed > VEHICLES.boat.speed, 'long, quick, slow to turn');
});

test('one of each, parked in the right district beside what it belongs to, after every older ride', () => {
  // (the sixteenth pass adds a second dragon boat, on Jurong Lake, after these four)
  // (and the seventeenth pass's Ubin rides after those: the rental's bikes and tandem, a boat on Ketam Quarry)
  // (and the eighteenth pass's Kallang rides after those: the rowing club's dragon boats and a sampan, bikes, scooters)
  // (and the nineteenth pass's Mandai rides after those: a boat on the reservoir, bikes, scooters)
  // (and the twenty-first pass's island rides after those: a kayak and a bike)
  // (and the twenty-second pass's Bukit Timah rides after those: bikes on the Rail Corridor, a scooter at Beauty World;
  // then the twenty-fourth pass's Kranji rides: bikes and a scooter; then the twenty-fifth pass's Punggol rides: bikes
  // and a kayak; then the twenty-sixth pass's Bishan rides)
  const BS = c.bishan.park.length; assert.deepEqual(c.parking.slice(-BS).map(p => p.d), c.bishan.park.map(() => 'bishan'));
  const PG = c.punggol.park.length + BS; assert.deepEqual(c.parking.slice(-PG, -BS).map(p => p.d), c.punggol.park.map(() => 'punggol'));
  const KR = c.kranji.park.length + PG; assert.deepEqual(c.parking.slice(-KR, -PG).map(p => p.d), c.kranji.park.map(() => 'kranji'));
  const BK = c.bukit.park.length + KR; assert.deepEqual(c.parking.slice(-BK, -KR).map(p => p.d), c.bukit.park.map(() => 'bukit'));
  const IS = c.islands.park.length + BK; assert.deepEqual(c.parking.slice(-IS, -BK).map(p => p.d), c.islands.park.map(() => 'islands'));
  const MD = c.mandai.park.length + IS; assert.deepEqual(c.parking.slice(-MD, -IS).map(p => p.d), c.mandai.park.map(() => 'mandai'));
  const KL = c.kallang.park.length + MD; assert.deepEqual(c.parking.slice(-KL, -MD).map(p => p.d), c.kallang.park.map(() => 'kallang'));
  const UB = c.ubin.park.length + KL; assert.deepEqual(c.parking.slice(-UB, -KL).map(p => p.d), c.ubin.park.map(() => 'pulau'));
  const tail = c.parking.slice(-NEW.length - 1 - UB, -1 - UB); const lake = c.parking[c.parking.length - 1 - UB];
  assert.equal(lake.kind, 'dragon'); assert.equal(lake.d, 'jurong'); assert.equal(c.solid[tile(lake.x, lake.y)[1] * W + tile(lake.x, lake.y)[0]], S.WATER, 'the lake boat floats');
  assert.deepEqual(tail.map(p => p.kind), NEW, 'appended last, so older rides keep their ids and seeded paint');
  for (const k of NEW) assert.equal(c.parking.filter(p => p.kind === k && p.d !== 'pulau' && p.d !== 'kallang' && p.d !== 'mandai').length, k === 'dragon' ? 2 : 1, k);
  const want = { tandem: 'katong', icecream: 'orchard', luge: 'resort', dragon: 'quay' };
  for (const p of tail) {
    assert.equal(p.d, want[p.kind], p.kind); assert.equal(districtAt(...tile(p.x, p.y)), p.d, `${p.kind} stands in ${p.d}`);
    const i = tile(p.x, p.y)[1] * W + tile(p.x, p.y)[0];
    if (p.kind === 'dragon') assert.equal(c.solid[i], S.WATER, 'the dragon boat floats'); else assert.equal(c.solid[i], S.OPEN, `${p.kind} on open ground`);
  }
  const near = (p, x, y, r) => Math.hypot(p.x - x, p.y - y) < r * T;
  const [ta, ic, lu, dr] = tail;
  assert.ok(c.parking.some(b => b.kind === 'bike' && near(ta, b.x, b.y, 5)), 'the tandem by a hired bike');
  assert.ok(near(ic, c.places.ion.x, c.places.ion.y, 5), 'the ice-cream motorbike outside ION Orchard');
  assert.ok(near(lu, c.places.skytower.x, c.places.skytower.y, 6), 'the luge on Siloso Road by the sky tower');
  assert.ok(near(dr, c.places['mk-quay'].x, c.places['mk-quay'].y, 30) && Math.abs(dr.y - c.parking.find(b => b.kind === 'boat' && b.d === 'quay').y) < T, 'the dragon boat on the river at Clarke Quay');
  for (const r of NEW_RIDES) { const [x, y] = mvT(...r.at); assert.ok([...tail, lake].some(p => tile(p.x, p.y)[0] === x && tile(p.x, p.y)[1] === y), r.kind); }
  // the older rides' ids and paint are as they were: the new ones come last
  const w = world(); assert.deepEqual(w.rides.slice(-NEW.length - 1 - UB, -UB).map(r => r.kind), [...NEW, 'dragon']);
});

test('getting on each new ride from its prompt, riding it and getting off', () => {
  for (const k of NEW) {
    const w = world(); const r = w.rides.find(q => q.kind === k);
    board(w, r); assert.ok(w.p.anim.startsWith('ride'));
    assert.match(w.near?.label ?? 'Ride the ' + VEHICLES[k].name.toLowerCase(), /./);
    const [x0, y0] = [r.b.x, r.b.y];
    for (let i = 0; i < 60; i++) w.step({ ...NO_INPUT, mx: 1 }, DT);
    assert.ok(Math.hypot(r.b.x - x0, r.b.y - y0) > 20, `${k} moves`);
    for (let i = 0; i < 60; i++) w.step({ ...NO_INPUT, mx: -1 }, DT);
    for (let i = 0; i < 90; i++) w.step(NO_INPUT, DT);
    assert.ok(w.exit(), `get off the ${k}`); assert.equal(w.p.ride, null);
    assert.equal(c.solid[Math.floor(w.p.y / T) * W + Math.floor(w.p.x / T)], S.OPEN, `standing on open ground after the ${k}`);
    if (k === 'dragon') assert.ok(w.s.stats.boated > 0 && w.s.stats.driven === 0, 'the dragon boat counts as boating');
  }
});

test('the partner boards each one: the back saddle, the sidecar, the drum, and their own luge cart', () => {
  for (const k of NEW) {
    const w = world(); const r = w.rides.find(q => q.kind === k);
    board(w, r);
    w.mate.b.x = r.b.x + 20; w.mate.b.y = r.b.y + 20; w.mate.act = null; w.mate.ai.mode = 'follow';
    assert.ok(mateAboard(w, r), `the partner boards the ${k}`);
    // still aboard while you ride, and off with you when you get off
    for (let i = 0; i < 60; i++) w.step({ ...NO_INPUT, mx: k === 'dragon' ? -1 : 1 }, DT);
    assert.equal(w.mate.seat, r, `the partner stays on the ${k}`);
    for (let i = 0; i < 90; i++) w.step(NO_INPUT, DT);
    assert.ok(w.exit()); for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT);
    assert.equal(w.mate.seat, null, `the partner gets off the ${k} too`);
  }
  // Tab on a shared ride hands it over: the partner drives and you take the other seat (or your own luge cart)
  for (const k of NEW) {
    const w = world(); const r = w.rides.find(q => q.kind === k); board(w, r);
    w.mate.b.x = r.b.x + 20; w.mate.b.y = r.b.y + 20; w.mate.act = null; w.mate.ai.mode = 'follow'; assert.ok(mateAboard(w, r));
    const was = w.p.who; assert.ok(w.switchHero()); assert.notEqual(w.p.who, was); assert.equal(w.p.ride, r); assert.equal(w.mate.seat, r, `${k}: swapped seats`);
  }
});

/** the top speed a ride reaches along a straight, flat run (dt steps of full stick) */
function topSpeed(w, r, mx = 1, steps = 80) { let best = 0; for (let i = 0; i < steps; i++) { w.step({ ...NO_INPUT, mx }, DT); best = Math.max(best, r.b.speed); } return best; }
test('each rides its own way: two pedal the tandem, the drum surges the dragon boat, the luge belongs on Sentosa, the chime stops the street', () => {
  // the tandem: quicker with the partner pedalling behind than alone
  {
    const solo = world(); const r1 = solo.rides.find(q => q.kind === 'tandem'); board(solo, r1); alone(solo);
    const duo = world(); const r2 = duo.rides.find(q => q.kind === 'tandem'); board(duo, r2); duo.mate.b.x = r2.b.x + 20; duo.mate.b.y = r2.b.y + 20; duo.mate.act = null; duo.mate.ai.mode = 'follow'; assert.ok(mateAboard(duo, r2));
    const a = topSpeed(solo, r1), b = topSpeed(duo, r2);
    assert.ok(b > a * 1.25, `two pedalling ${b.toFixed(0)} vs one ${a.toFixed(0)}`);
    assert.ok(b > VEHICLES.bike.speed, 'with both pedalling it beats a hired bike');
  }
  // the dragon boat: with the partner on the drum, a surge comes back in half the time
  {
    const w = world(); const r = w.rides.find(q => q.kind === 'dragon'); board(w, r);
    w.mate.b.x = r.b.x + 20; w.mate.b.y = r.b.y - 40; w.mate.act = null; w.mate.ai.mode = 'follow'; assert.ok(mateAboard(w, r));
    w.p.boostCd = 0; w.step({ ...NO_INPUT, mx: -1, dash: true }, DT); assert.ok(w.p.boostCd > 1 && w.p.boostCd <= 1.2, `drum surge cooldown ${w.p.boostCd}`);
    const s = world(); const q = s.rides.find(x => x.kind === 'dragon'); board(s, q); alone(s);
    s.p.boostCd = 0; s.step({ ...NO_INPUT, mx: -1, dash: true }, DT); assert.ok(s.p.boostCd > 2, 'alone, the usual surge');
  }
  // the luge: quickest on Sentosa, scraping along anywhere else
  {
    const w = world(); const r = w.rides.find(q => q.kind === 'luge'); board(w, r); alone(w);
    const home = topSpeed(w, r);
    assert.ok(home > VEHICLES.scooter.speed, `the luge on Sentosa ${home.toFixed(0)}`);
    // the same cart, carried to Orchard Road
    const o = world(); const lu = o.rides.find(q => q.kind === 'luge'), ic = o.rides.find(q => q.kind === 'icecream');
    lu.b.x = ic.b.x + 3 * T; lu.b.y = ic.b.y; board(o, lu); alone(o);
    const away = topSpeed(o, lu);
    assert.ok(away < home * 0.8, `off Sentosa ${away.toFixed(0)} vs ${home.toFixed(0)}`);
  }
  // the ice-cream chime: townsfolk stop instead of scattering, and it makes no horn noise for guards to hear
  {
    const w = world(); const r = w.rides.find(q => q.kind === 'icecream'); board(w, r);
    for (const pd of w.peds.slice(0, 3)) { pd.x = r.b.x + 60; pd.y = r.b.y + 40; pd.scare = 0; pd.wait = 0; }
    w.p.boostCd = 0; w.fx.length = 0; w.honk();
    assert.ok(w.fx.some(f => f.t === 'honk' && f.kind === 'icecream'), 'the chime plays');
    for (const pd of w.peds.slice(0, 3)) { assert.equal(pd.scare, 0, 'not scared'); assert.ok(pd.wait > 1, 'stops for a treat'); }
    const t = world(); const sc = t.rides.find(q => q.kind === 'scooter' && !q.locked && t.open.has(districtAt(...tile(q.b.x, q.b.y)))); board(t, sc);
    for (const pd of t.peds.slice(0, 3)) { pd.x = sc.b.x + 60; pd.y = sc.b.y + 40; pd.scare = 0; }
    t.p.boostCd = 0; t.honk(); assert.ok(t.peds.slice(0, 3).every(pd => pd.scare === 1), 'a scooter horn scatters them');
  }
});

test('every frame the drawing asks for on the new rides is painted, for both heroes', () => {
  const need = ['v-tandem', 'v-icecream', 'v-luge', 'v-dragon'];
  for (const h of ['dora', 'enzo']) for (const f of ['ride-tandem', 'tandem-back', 'ride-moto', 'sidecar', 'ride-luge', 'ride-paddle', 'drum']) for (const i of [0, 1]) need.push(`${h}-${f}-${i}`);
  // the partner's actions on a seat, and the bump, are the older shared frames
  for (const h of ['dora', 'enzo']) for (const f of ['pass-aim', 'pass-grab', 'pass-cheer', 'pass-duck', 'pass-wave', 'ride-bump']) need.push(`${h}-${f}`);
  for (const f of need) { assert.ok(FRAMES[f], `painted: ${f}`); assert.ok(FILL[f] > 0.1, `${f} is not blank (${FILL[f]})`); }
  // the two frames of each cycle are cut to one box, so a rider never jumps on the seat
  for (const h of ['dora', 'enzo']) for (const f of ['ride-tandem', 'tandem-back', 'ride-moto', 'sidecar', 'ride-luge', 'ride-paddle', 'drum']) {
    const a = FRAMES[`${h}-${f}-0`], b = FRAMES[`${h}-${f}-1`]; assert.deepEqual([a[3], a[4]], [b[3], b[4]], `${h}-${f}`);
  }
  // the riders are the hired bike rider's size
  for (const h of ['dora', 'enzo']) { const bike = FRAMES[`${h}-ride-bike-0`][4]; for (const f of ['ride-tandem-0', 'ride-moto-0', 'ride-luge-0', 'ride-paddle-0']) assert.ok(Math.abs(FRAMES[`${h}-${f}`][4] - bike) < bike * 0.2, `${h}-${f}`); }
});

console.log(`jade rides: ${n} tests passed (the tandem, the ice-cream motorbike, the luge cart and the dragon boat)`);

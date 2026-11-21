// Jade Street, the twentieth pass: deeper districts, no new district or chapter. Every district past Chinatown gets a
// side gig board (Toa Payoh, Marina Bay, Tiong Bahru and Katong two), run by its own givers round its own landmarks; the
// new step `rounds` (lib/jade-rounds.ts) is a round of drop-offs (serve, drape a garland, hang a cage or lantern), each
// stop handed over with E and its own pose. Six more Hawker Tales (k33 to k38) go to the districts with fewest, three
// trophies to the new gigs, and a giver past Chinatown texts about their gig (with Route me). These tests check the
// boards and routes are where a player can walk or steer, the timers leave a first-timer room on Normal, the step
// plays as the HUD says, and the counts.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, jobCounts } from '../.checks/jade-story.js';
import { newSave, TROPHIES, checkTrophies } from '../.checks/jade-save.js';
import { city, T, W, DISTRICTS, districtAt, passable } from '../.checks/jade-city.js';
import { field } from '../.checks/jade-nav.js';
import { GIG_DEFS, gigBoards, gigMission, startGig } from '../.checks/jade-gigs.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { DROP_R, ACT_DUR } from '../.checks/jade-rounds.js';
import { FOOT, VEHICLES } from '../.checks/jade-move.js';
import { DIFF } from '../.checks/jade-diff.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { phoneStep } from '../.checks/jade-phone.js';
import { playMission, missionSave, gigCases, contractSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const LATER = DISTRICTS.slice(5);
const TALES = ['k33', 'k34', 'k35', 'k36', 'k37', 'k38'];
const all = new Set(DISTRICTS);
/** a world with the whole story done (every district open), assist as asked */
function done(seed = 3, o = {}) {
  const s = contractSave(seed, 1); s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  const w = new World(s, seed); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT);
  return w;
}
const tileOf = ([x, y]) => [Math.floor(x / T), Math.floor(y / T)];
const settle = (w, s = 1) => { for (let i = 0; i < s / DT; i++) w.step(NO_INPUT, DT); };

test('every district past Chinatown has a side gig board; the thinnest have two; Chinatown’s come first, unchanged', () => {
  assert.deepEqual(GIG_DEFS.slice(0, 13).map(g => g.id), ['delivery-market', 'delivery-temple', 'delivery-canal', 'delivery-docks', 'delivery-arcade', 'taxi-market', 'taxi-docks', 'race-street', 'roof-market', 'roof-arcade', 'cook', 'dumplings', 'locks']);
  assert.deepEqual(GIG_DEFS.slice(13).map(g => g.id), GIG20_DEFS.map(g => g.id));
  assert.equal(new Set(GIG_DEFS.map(g => g.id)).size, GIG_DEFS.length, 'gig ids are unique');
  for (const d of LATER) assert.ok(GIG20_DEFS.some(g => g.d === d), `${d} has a side gig`);
  for (const d of ['heartland', 'bay', 'tiong', 'katong']) assert.equal(GIG20_DEFS.filter(g => g.d === d).length, 2, `${d} has two`);
  for (const g of GIG20_DEFS) {
    assert.ok(PEOPLE[g.giver], `${g.id}: ${g.giver} is a person`);
    assert.equal(c.places[g.giver]?.d ?? g.d, g.d, `${g.id}: ${g.giver} stands in ${g.d}`);
  }
});

test('each board stands on open ground in its own district, a few steps from every other board', () => {
  const w = done();
  const b = gigBoards(w);
  assert.equal(b.length, GIG_DEFS.length, 'every board is up once the story is done');
  for (const g of GIG20_DEFS) {
    const at = b.find(x => x.id === g.id); assert.ok(at, g.id);
    const [tx, ty] = tileOf([at.x, at.y]);
    assert.equal(districtAt(tx, ty), g.d, `${g.id} board is in ${g.d}`);
    assert.ok(passable(c, 'foot', tx, ty), `${g.id} board is on walkable ground`);
    for (const o of b) if (o.id !== g.id) assert.ok(Math.hypot(o.x - at.x, o.y - at.y) > 2.5 * T, `${g.id} and ${o.id} boards are apart`);
  }
});

test('the boards go up with their districts: none until the first job, none in a district not yet open', () => {
  const s = newSave(5); s.started = true; s.story.intro = true;
  let w = new World(s, 5); w.quiet = true;
  assert.equal(gigBoards(w).length, 0);
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm25') + 1).map(m => m.id);
  w = new World(s, 5); w.quiet = true;
  const up = gigBoards(w).map(g => g.id);
  for (const g of GIG20_DEFS) assert.equal(up.includes(g.id), w.open.has(g.d), `${g.id} is up exactly when ${g.d} is open`);
  assert.ok(up.includes('mooncakes-tp') && !up.includes('buoy-sprint'));
});

test('every new gig builds; every stop is where its step is played (on foot, on the bike, on the water)', () => {
  const w = done();
  for (const g of GIG20_DEFS) {
    const r = gigMission(w, g.id); assert.ok(r, g.id);
    assert.equal(r.d, g.d); assert.ok(r.reward >= 50 && r.reward <= 90, `${g.id} pays like a gig (${r.reward})`);
    for (const st of r.m.steps) {
      const spots = st.t === 'rounds' ? st.drops : st.t === 'collect' ? st.items : st.t === 'race' ? st.marks : st.t === 'pickup' ? [st.at] : st.t === 'deliver' ? [st.to] : st.t === 'goto' ? [st.at] : st.t === 'ride' && st.near ? [st.near] : [];
      const cls = st.t === 'race' && st.ride && st.ride !== 'foot' ? VEHICLES[st.ride].cls : st.t === 'ride' ? null : 'foot';
      for (const sp of spots) {
        const [tx, ty] = typeof sp === 'string' ? tileOf([c.places[sp].x, c.places[sp].y]) : sp;
        if (cls) assert.ok(passable(c, cls, tx, ty), `${g.id} ${st.t}: ${tx},${ty} is ${cls}-passable`);
        assert.equal(districtAt(tx, ty), g.d, `${g.id} ${st.t}: ${tx},${ty} is in ${g.d}`);
      }
    }
  }
});

/** the shortest walk round a set of stops, nearest first from `from` (tiles) */
function walk(from, stops, cls = 'foot') {
  let cur = from, left = stops.slice(), tot = 0;
  while (left.length) {
    const f = field(c, cls, cur[0], cur[1], all);
    let k = -1, bd = Infinity;
    left.forEach(([x, y], i) => { const d = f.dist[y * W + x]; if (d >= 0 && d < bd) { bd = d; k = i; } });
    assert.ok(k >= 0, `stop ${left[0]} is reachable from ${cur}`);
    tot += bd / 10; cur = left[k]; left.splice(k, 1);
  }
  return tot;
}
test('the rounds’ and catches’ timers leave a first-timer room on Normal, and are tight but fair on Hard', () => {
  const w = done();
  for (const g of GIG20_DEFS) {
    const r = gigMission(w, g.id), b = gigBoards(w).find(x => x.id === g.id), home = tileOf([b.x, b.y]);
    for (const st of r.m.steps) {
      if (st.t !== 'rounds' && st.t !== 'collect') continue;
      const stops = st.t === 'rounds' ? st.drops : st.items;
      const run = walk(home, stops) * T / FOOT.run, acts = st.t === 'rounds' ? stops.length * ACT_DUR[st.act] : 0;
      const normal = st.time * DIFF.normal.timer, hard = st.time * DIFF.hard.timer;
      assert.ok(normal >= run * 1.3 + acts + 6, `${g.id}: Normal ${normal.toFixed(0)}s against a ${run.toFixed(0)}s run`);
      assert.ok(hard >= run * 1.05 + acts + 2, `${g.id}: Hard ${hard.toFixed(0)}s against a ${run.toFixed(0)}s run`);
      assert.ok(normal <= run * 3 + acts + 30, `${g.id}: not a stroll either (${normal.toFixed(0)}s)`);
    }
  }
});

test('rounds: carry the round, E at a stop plays its pose and hands one over; the gold line goes on to the next', () => {
  const w = done(4);
  const b = w.gigs().find(x => x.id === 'garlands-li'); w.placePlayer(b.x, b.y + 20);
  startGig(w, 'garlands-li'); settle(w, 0.2);
  const run = w.run; assert.equal(run.cur.t, 'rounds');
  assert.equal(w.p.carry, 'garland'); assert.equal(run.progress, 'Draped 0/5');
  assert.match(run.label, /Drape a garland/);
  const tg = run.target(), first = run.items.reduce((a, it) => Math.hypot(it.x - w.p.x, it.y - w.p.y) < Math.hypot(a.x - w.p.x, a.y - w.p.y) ? it : a);
  assert.deepEqual(tg, [first.x, first.y], 'the line points at the nearest stop');
  assert.equal(run.nearAction(w.p.x, w.p.y), null, 'no prompt away from a stop');
  w.placePlayer(first.x, first.y + DROP_R * 0.6); w.step(NO_INPUT, DT);
  const nr = run.nearAction(w.p.x, w.p.y); assert.ok(nr && nr.kind === 'job' && nr.id.startsWith('drop:'));
  assert.equal(nr.label, 'Drape the garland');
  w.step(NO_INPUT, DT); assert.match(run.label, /^E: drape the garland/);
  run.jobAct(nr.id); assert.equal(w.p.act?.n, 'drape', 'the drape pose plays');
  settle(w, 1.2);
  assert.ok(first.got); assert.equal(run.progress, 'Draped 1/5');
  assert.notDeepEqual(run.target(), [first.x, first.y], 'the line moves on');
  // the rest, then the gig pays
  for (const it of run.items) if (!it.got) { w.placePlayer(it.x, it.y + 30); w.step(NO_INPUT, DT); run.jobAct(run.nearAction(w.p.x, w.p.y).id); settle(w, 1.2); }
  settle(w, 1);
  assert.equal(w.s.best['gig:garlands-li'], 1); assert.equal(w.p.carry, null);
});

test('rounds: no prompt from a ride (hop off first, as the HUD says); the clock running out fails with a hint', () => {
  const w = done(6);
  const b = w.gigs().find(x => x.id === 'croissants'); w.placePlayer(b.x, b.y + 20);
  startGig(w, 'croissants'); settle(w, 0.2);
  const run = w.run, it = run.items[0];
  const r = w.addRide('scooter', it.x, it.y + 30, 0, false, 0, true); w.p.ride = r; w.p.b.x = it.x; w.p.b.y = it.y + 30;
  w.step(NO_INPUT, DT);
  assert.equal(run.nearAction(w.p.x, w.p.y), null); assert.match(run.label, /^Hop off \(E\), then hand over the box of pastries/);
  w.p.ride = null;
  run.timer = 0.05; settle(w, 0.5);
  assert.ok(w.failed, 'the round fails when the clock runs out'); assert.match(w.failed.reason, /Follow the gold line from stop to stop/);
});

test('the hang pose faces the hook; the hero frames for the new poses are painted, both heroes, job tier', () => {
  for (const h of ['dora', 'enzo']) for (const f of ['drape-0', 'drape-1', 'hang-up', 'admire']) {
    const fr = FRAMES[`${h}-${f}`]; assert.ok(fr, `${h}-${f}`);
    assert.equal(tierOf(ATLASES[fr[0]]), 'job', `${h}-${f} is job art (every hero frame is core or job)`);
  }
});

test('the carried things are painted, each in the zone of its district', () => {
  const want = { 'g20-croissants': 'tiong', 'g20-cage': 'tiong', 'g20-chweekueh': 'tiong', 'g20-batik': 'glam', 'g20-laksa': 'katong', 'g20-potong': 'orchard' };
  for (const [f, d] of Object.entries(want)) { const fr = FRAMES[f]; assert.ok(fr, f); assert.equal(tierOf(ATLASES[fr[0]]), ZONE_OF[d], `${f} streams with ${d}`); }
  // every item a new gig or tale carries is painted
  const w = done();
  for (const g of GIG20_DEFS) for (const st of gigMission(w, g.id).m.steps) for (const it of [st.item, st.loot]) if (it) assert.ok(FRAMES[it], `${g.id}: ${it} is painted`);
  for (const id of TALES) for (const st of MISSION[id].steps) for (const it of [st.item, st.loot]) if (it) assert.ok(FRAMES[it], `${id}: ${it} is painted`);
});

test('six more Hawker Tales, k33 to k38, for the districts with fewest; each opens after its giver’s story job', () => {
  assert.deepEqual(SIDE.slice(-6).map(m => m.id), TALES);
  const where = id => c.places[MISSION[id].at].d;
  assert.deepEqual(TALES.map(where), ['tiong', 'tiong', 'katong', 'katong', 'heartland', 'bay']);
  for (const id of TALES) {
    const m = MISSION[id]; assert.equal(m.ch, 0); assert.ok(m.side && MISSIONS.some(x => x.id === m.side), `${id} opens after a story job`);
    assert.ok(+m.side.slice(1) <= 85, `${id} opens after a job of chapters 1 to 11`);
    assert.ok(m.reward >= 250 && m.reward <= 350);
    assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
    assert.doesNotMatch(m.blurb + m.steps.map(s => s.label ?? '').join(' '), /finale|the end\b|ending/i, `${id} is a tale, not an ending`);
  }
  assert.equal(jobCounts(newSave()).talesAll, SIDE.length);
});

test('three trophies for the new gigs, nothing like a finale', () => {
  const ids = ['every-corner', 'rounds', 'wheels-wakes'];
  for (const id of ids) assert.ok(TROPHIES.some(t => t.id === id), id);
  assert.equal(new Set(TROPHIES.map(t => t.id)).size, TROPHIES.length);
  const s = contractSave(1, 1);
  assert.equal(checkTrophies(s).filter(n => ['Every Corner', 'Round the Houses', 'Wheels and Wakes'].includes(n)).length, 0);
  for (const id of ['river-taxi', 'ubin-loop', 'buoy-sprint']) s.best['gig:' + id] = 1;
  assert.ok(checkTrophies(s).includes('Wheels and Wakes'));
  for (const g of GIG20_DEFS) s.best['gig:' + g.id] = 1;
  const got = checkTrophies(s); assert.ok(got.includes('Every Corner') && got.includes('Round the Houses'));
});

test('a giver past Chinatown texts about their gig (once, one a night) with the gig to route to', () => {
  const w = done(8);
  w.s.msgs = []; w.tick = 0;
  for (let i = 0; i < 4; i++) { w.tick = 30 * (i + 1); phoneStep(w); }
  const gig = w.s.msgs.filter(m => m.gig);
  assert.equal(gig.length, 1, 'one gig text a night');
  const g = GIG20_DEFS.find(x => x.id === gig[0].gig); assert.equal(gig[0].from, g.giver);
  assert.ok(w.gigs().some(b => b.id === g.id), 'its board is up (the text’s Route me goes there)');
  w.s.night++; w.tick = 30 * 9; phoneStep(w);
  const two = w.s.msgs.filter(m => m.gig); assert.equal(two.length, 2); assert.notEqual(two[1].gig, two[0].gig, 'the next night, another giver');
});

test('first-timer play: the bot clears each new gig and tale on Normal reading the HUD, and on Hard', () => {
  for (const [label, id, opts] of gigCases()) {
    const r = playMission(label, 'normal', 61, { ...opts(contractSave(61, 1)), assist: false, diff: 'normal' });
    assert.ok(r.won, `${label} on Normal: ${JSON.stringify(r)}`);
    const h = playMission(label, 'normal', 91, { ...opts(contractSave(91, 1)), assist: false, diff: 'hard' });
    assert.ok(h.won, `${label} on Hard: ${JSON.stringify(h)}`);
    void id;
  }
  for (const id of TALES) {
    const r = playMission(id, 'normal', 61, { assist: false, diff: 'normal' }); assert.ok(r.won, `${id} on Normal: ${JSON.stringify(r)}`);
    const h = playMission(id, 'normal', 91, { assist: false, diff: 'hard' }); assert.ok(h.won, `${id} on Hard: ${JSON.stringify(h)}`);
  }
  void missionSave;
});

console.log(`jade (twentieth pass, side gigs past Chinatown): ${n} tests ok`);

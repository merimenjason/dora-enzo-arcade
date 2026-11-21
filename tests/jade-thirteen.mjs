// Jade Street, the thirteenth pass (polish): the one-time MRT and cable car hints, the free-roam route plaque, a fair
// Changi Village Stakeout, Hard contracts clearly harder than Normal ones, the partner's quicker round of the tills,
// and the Atas Bats' own flight.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE } from '../.checks/jade-story.js';
import { newSave } from '../.checks/jade-save.js';
import { DISTRICTS, T, districtAt } from '../.checks/jade-city.js';
import { stationById } from '../.checks/jade-mrt.js';
import { settleLessons, MRT_HINT_S, MRT_JOB, CABLE_JOB } from '../.checks/jade-tutor.js';
import { contractMission, HARD_CON } from '../.checks/jade-proc.js';
import { BIZ } from '../.checks/jade-biz.js';
import { sendRound, ROUND_OFF } from '../.checks/jade-empire.js';
import { startGang, BAT_FLIGHT } from '../.checks/jade-gangs.js';
import { dist } from '../.checks/jade-rng.js';
import { missionSave, playMission, contractCase } from './jade-bot.mjs';
import { readFileSync } from 'node:fs';
import { travelPlan, travelHint, travelText, TRAVEL_SAVE } from '../.checks/jade-mrt.js';
import { FERRY_RIDE, FERRY_SPEED } from '../.checks/jade-cable.js';
import { planeIn, PLANE_EVERY, PLANE_FLY } from '../.checks/jade-farfest.js';
import { Notices } from '../.checks/jade-notice.js';
import { phoneStep } from '../.checks/jade-phone.js';
import { pounceWho } from '../.checks/jade-tag.js';
import { listContracts } from '../.checks/jade-contracts.js';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const BASICS = ['move', 'run', 'dash', 'hop', 'map', 'market', 'ride', 'boost', 'honk', 'fire', 'tag', 'heat', 'hide', 'sneak', 'switch'];
const steps = (w, sec, each) => { for (let i = 0; i < sec * 60; i++) { w.step(NO_INPUT, DT); w.talk = null; w.ui = null; each?.(w); } };

test('the MRT hint shows once, briefly, is saved at once, and never comes back after a job or a ride', () => {
  const s = missionSave('m25', { assist: true }); s.learned = [...s.learned, ...BASICS];
  const w = new World(s, 4); w.quiet = true; w.s.story.intro = true;
  w.startMission(MISSION.m25); w.talk = null; w.finishMission(MISSION.m25); w.run = null; w.talk = null; w.ui = null;
  steps(w, 0.5);
  assert.equal(w.tutor.cur, 'mrt', 'it shows when the island opens');
  assert.ok(w.s.learned.includes('mrt'), 'and is learned (saved) the moment it shows');
  const stn = stationById(w, 'stn-chinatown'); assert.deepEqual(w.waypoint, [stn.x, stn.y], 'routed to the station while it shows');
  // a ride (or a job) puts it away at once, and it does not come back afterwards
  w.p.ride = w.addRide('scooter', w.p.x, w.p.y, 0, false, 0, true); w.p.ride.parked = false; steps(w, 0.2);
  assert.notEqual(w.tutor.cur, 'mrt', 'gone on a ride'); assert.equal(w.waypoint, null, 'with its route');
  w.exit(); steps(w, 3);
  assert.notEqual(w.tutor.cur, 'mrt', 'and not back once off the ride');
  // left alone it goes after MRT_HINT_S seconds on screen
  const w2 = new World({ ...s, learned: s.learned.filter(x => x !== 'mrt') }, 4); w2.quiet = true; steps(w2, 0.5);
  assert.equal(w2.tutor.cur, 'mrt'); steps(w2, MRT_HINT_S + 1); assert.notEqual(w2.tutor.cur, 'mrt'); assert.equal(w2.waypoint, null);
  assert.ok(MRT_HINT_S <= 12, 'briefly');
});

test('saves that rode the MRT or skipped past Madame Glint’s job never see the hint (or its route plaque)', () => {
  for (const [why, s] of [
    ['past m26', (() => { const s = missionSave('m40', {}); s.learned = BASICS.slice(); return s; })()],
    ['rode once', (() => { const s = missionSave('m26', {}); s.learned = BASICS.slice(); s.stats.mrt = 1; return s; })()],
    ['chapter eight', (() => { const s = missionSave('m53', {}); s.learned = BASICS.slice(); return s; })()],
  ]) {
    const w = new World(s, 5); w.quiet = true; w.s.story.intro = true;
    assert.ok(w.s.learned.includes('mrt'), `${why}: learned on load`);
    let seen = false; steps(w, 3, w => { if (w.tutor.cur === 'mrt' || w.mrtGuide) seen = true; });
    assert.ok(!seen, `${why}: no hint, no route to the station`);
  }
  const s = { done: [CABLE_JOB, MRT_JOB], learned: [] }; settleLessons(s); assert.deepEqual(s.learned.sort(), ['cable', 'mrt']);
  const s2 = { done: [], learned: [], stats: { mrt: 0 } }; settleLessons(s2); assert.deepEqual(s2.learned, [], 'a fresh save keeps both hints');
});

test('free roam in Katong, Orchard Road or Changi: the plaque is never "To Chinatown station"; the route leads to the next giver', () => {
  for (const [id, safe] of [['m47', 'safe-orchard'], ['m50', 'safe-katong'], ['m54', 'safe-katong']]) {
    const s = missionSave(id, { assist: true }); s.learned = BASICS.slice(); s.safe = safe; s.learned = s.learned.filter(x => x !== 'mrt');
    const w = new World(s, 6); w.quiet = true; w.s.story.intro = true;
    assert.ok(['orchard', 'katong'].includes(districtAt(Math.floor(w.p.x / T), Math.floor(w.p.y / T))), `${id}: out east`);
    steps(w, 2);
    const stn = stationById(w, 'stn-chinatown');
    assert.ok(!w.waypoint || w.waypoint[0] !== stn.x || w.waypoint[1] !== stn.y, `${id}: no pin on Chinatown station`);
    // (the goal is the next giver; when that is far, the line goes to the nearer station of a quicker ride first)
    const o = w.objective(); assert.deepEqual(w.goal(), w.nextGiver(), `${id}: the route leads to the next job’s giver (${MISSION[id].title})`);
    if (w.travel) assert.deepEqual(o, [w.travel.from.x, w.travel.from.y], `${id}: via the ${w.travel.via}`); else assert.deepEqual(o, w.nextGiver());
    assert.ok(!w.travel || w.travel.from.id !== 'stn-chinatown', `${id}: never Chinatown station from out east`);
  }
});

test('Changi Village Stakeout is fair: the partner waits off the courier’s path, and the casual bot gets it first time', () => {
  const seg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
  for (const m of [...MISSIONS, ...SIDE]) for (const st of m.steps) if (st.t === 'tail' && st.relay) {
    const pts = [st.from, ...st.route]; let d = Infinity; for (let i = Math.max(0, st.relay.at - 1); i < pts.length - 1; i++) d = Math.min(d, seg(st.relay.spot, pts[i], pts[i + 1]));
    assert.ok(d >= 1, `${m.id}: the partner waits ${d.toFixed(1)} tiles from the path (at least one)`);
    if (m.id === 'm53') assert.ok(d >= 2.5, `m53: well clear of the courier (${d.toFixed(1)} tiles)`);
  }
  let first = 0; for (let k = 0; k < 10; k++) { const r = playMission('m53', 'casual', k); assert.ok(r.won); if (!r.fails) first++; }
  assert.ok(first >= 9, `casual first try ${first}/10`);
});

test('Hard contracts: a getaway after the work on two- and three-star contracts, sharper tails; Normal and Assist unchanged', () => {
  let added = 0, checked = 0;
  for (let k = 0; k < 60; k++) {
    const { c } = contractCase(2000 + k);
    const easy = contractMission(c, true, false), easyHard = contractMission(c, true, true);
    assert.deepEqual(easyHard.steps, easy.steps, 'Assist: Hard changes nothing');
    const nm = contractMission(c, false, false), hd = contractMission(c, false, true);
    assert.equal(nm.steps.length, c.steps.length, 'Normal adds no getaway');
    const had = c.steps.some(s => s.t === 'heat');
    if (!had && c.stars >= HARD_CON.getawayStars) {
      checked++; const i = hd.steps.findIndex(s => s.t === 'heat'); assert.ok(i > 0, `${c.kind}: a getaway on Hard`); added++;
      assert.equal(hd.steps.length, nm.steps.length + 1);
      assert.ok(hd.steps.slice(i + 1).every(s => s.t === 'talk' || s.t === 'goto'), `${c.kind}: after the work, before the walk back`);
      assert.equal(hd.steps[i].level, HARD_CON.getaway);
    } else assert.equal(hd.steps.length, nm.steps.length, 'one-star or already hot: no extra step');
    for (let j = 0; j < c.steps.length; j++) if (c.steps[j].t === 'tail') { const hj = hd.steps.find(s => s.t === 'tail'); assert.ok((hj.calm ?? 1) > (c.steps[j].calm ?? 1)); }
  }
  assert.ok(added >= 10 && checked === added, `getaways on ${added} of 60`);
});

test('the partner’s round of every till takes about a minute, and they never pop into view', () => {
  const s = newSave(5); s.started = true; s.story.intro = true; s.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)];
  for (const d of DISTRICTS) s.rep[d] = 60; s.cash = 900000; s.settings.assist = true; s.learned = BASICS.concat(['mrt', 'cable', 'empire']);
  const w = new World(s, 9); w.quiet = true; w.emp.off = true;
  for (const b of BIZ) w.buyBiz(b.id);
  s.empire.rank = 2; for (const b of BIZ) s.biz[b.id].bank = 50;
  const cash = s.cash; assert.equal(sendRound(w), null);
  let t = 0, last = [w.mate.x, w.mate.y], pops = 0;
  while (w.emp.round && t < 240) {
    const going = !!w.emp.round?.at; w.step(NO_INPUT, DT); t += DT; w.talk = null; w.ui = null;
    // (on the way to a till; back home, the partner's usual catch-up out of sight brings them to your side)
    const m = [w.mate.x, w.mate.y]; if (going && dist(m[0], m[1], last[0], last[1]) > 100 && dist(m[0], m[1], w.p.x, w.p.y) <= ROUND_OFF) pops++; last = m;
  }
  assert.equal(w.emp.round, null, 'back'); assert.ok(t < 90, `the round took ${t.toFixed(0)} s (was about 140 s, up to four minutes)`);
  assert.ok(s.cash >= cash + 32 * 50, 'every till handed over'); assert.equal(pops, 0, 'no jumps in view');
});

test('the Atas Bats fly their own way: rarer, longer weaving glides, and a startled bat swerves away from you', () => {
  const s = missionSave('m53', {}); s.learned = BASICS.slice(); s.safe = 'safe-katong';
  const flights = { bats: [], mynahs: [] };
  for (const kind of ['bats', 'mynahs']) for (let seed = 1; seed <= 9; seed++) {
    const sv = kind === 'mynahs' ? (() => { const x = missionSave('m45', {}); x.learned = BASICS.slice(); x.safe = 'safe-india'; return x; })() : s;
    const w = new World(sv, seed); w.quiet = true; w.gangs.wait = 1e9; w.gangs.ev = null;
    { const h = w.c.places[sv.safe]; w.placePlayer(h.x, h.y + T * 0.6); } // (the open pavement in front of the safe house; a new game now starts a step further out)
    const ev = startGang(w, kind); assert.ok(ev, `${kind} start`);
    const m = ev.mobs[0]; const [x0, y0] = [w.p.x + 150, w.p.y]; m.b.x = x0; m.b.y = y0; m.fly = undefined; m.st = 'run';
    let up = null, hs = [];
    for (let i = 0; i < 600 && m.st === 'run'; i++) {
      w.step(NO_INPUT, DT); w.talk = null; w.ui = null;
      if (m.fly !== undefined && !up) { up = { d0: dist(m.b.x, m.b.y, w.p.x, w.p.y), t: 0, g0: m.goal, regoal: false }; hs = []; }
      if (up && m.fly !== undefined) { up.t += DT; hs.push(m.b.h); if (m.goal !== up.g0) up.regoal = true; }
      if (up && m.fly === undefined) { flights[kind].push({ gain: dist(m.b.x, m.b.y, w.p.x, w.p.y) - up.d0, t: up.t, regoal: up.regoal, turn: Math.max(...hs.map(h => Math.abs(Math.atan2(Math.sin(h - hs[0]), Math.cos(h - hs[0]))))) }); break; }
    }
  }
  if (process.env.V) console.log(JSON.stringify(flights));
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
  assert.ok(flights.bats.length >= 4 && flights.mynahs.length >= 4, `flights seen ${flights.bats.length}, ${flights.mynahs.length}`);
  assert.ok(avg(flights.bats, f => f.t) > avg(flights.mynahs, f => f.t) * 1.4, 'bats glide longer');
  assert.ok(flights.bats.every(f => f.gain > 0), 'a startled bat ends further from you');
  assert.ok(flights.bats.every(f => f.turn > 0.3) && flights.mynahs.filter(f => !f.regoal).every(f => f.turn < 0.05) && flights.mynahs.filter(f => !f.regoal).length >= flights.mynahs.length - 3, 'bats weave and curve; mynahs fly straight (but for a new goal mid-flight)');
  assert.ok(BAT_FLIGHT.roamRate < 0.25, 'and take off less often when left alone');
});


// ── playtest 2 (17-11-2026)
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const late = (o = {}) => { const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.story.ch = 9; s.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)]; s.cash = o.cash ?? 300;
  const w = new World(s, o.seed ?? 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT); return w; };

test('M1: a far target chains the MRT (Chinatown to Changi), Route me heads for the station, and the cards say how far', () => {
  const w = late(); const a = stationById(w, 'stn-chinatown'), z = stationById(w, 'stn-changi') ?? w.c.isle.stations.find(q => q.d === 'changi');
  w.placePlayer(a.x, a.y + T * 2); w.step(NO_INPUT, DT);
  const t = travelPlan(w, z.x + T * 4, z.y + T * 2); assert.ok(t, 'a plan for the far end of the island');
  assert.equal(t.via, 'mrt'); assert.equal(t.from.id, 'stn-chinatown'); assert.equal(districtAt(Math.floor(t.to.x / T), Math.floor(t.to.y / T)), 'changi');
  assert.ok(t.secs <= t.direct * (1 - TRAVEL_SAVE), 'only when it is clearly quicker');
  assert.match(travelText(t), /MRT/); assert.match(travelHint(w, z.x, z.y), /by MRT/);
  assert.equal(travelPlan(w, a.x + T * 6, a.y), null, 'a street away is walked');
  w.waypoint = [z.x + T * 4, z.y + T * 2]; const o = w.objective();
  assert.ok(w.travel && dist(o[0], o[1], a.x, a.y) < T * 2, 'the gold line goes to the station first');
  const broke = late({ cash: 0 }); broke.placePlayer(a.x, a.y + T * 2); broke.step(NO_INPUT, DT);
  assert.notEqual(travelPlan(broke, z.x, z.y)?.via, 'mrt', 'no MRT without the fare');
  assert.match(src('app/jade-street/contracts.tsx'), /con-far-/); assert.match(src('app/jade-street/empire.tsx'), /emp-raid-far/);
});

test('M2: the title preloads the opening painting and the loader and a new game wait for it', () => {
  const page = src('app/jade-street/page.tsx'), ex = src('app/jade-street/extras.tsx');
  assert.match(page, /preloadPic\(STORY_FIRST\)/); assert.match(page, /picReady\(STORY_FIRST\)/);
  assert.match(ex, /preloadPic\(STORY_FIRST\)/, 'the loading bar counts the first painting');
});

test('m1: the tag-team prompt names who you pounce on', () => {
  const w = late(); const names = new Set();
  for (const skin of ['mac', 'bat', 'otter', undefined]) { const a = { id: 900, kind: 'crow', skin, x: 0, y: 0 }; w.run = { actors: [a], cur: { t: 'chase' } }; names.add(pounceWho(w, 900)); }
  w.run = null;
  assert.ok(names.has('the macaque') && names.has('the bat'), [...names].join(', ')); assert.ok(names.size >= 3);
});

test('m2: a pinned contract is offered even when its giver has a Hawker Tale', () => {
  const w = late(); const ls = listContracts(w); assert.ok(ls.length);
  const l = ls[0]; w.s.contracts.pin = l.which; w.s.done = w.s.done.filter(id => !(MISSION[id]?.side && MISSION[id].giver === l.c.giver));
  const g = w.c.places[l.c.giver] ?? w.c.places[l.c.at]; if (!g) return;
  w.placePlayer(g.x, g.y + T * 0.8); for (let i = 0; i < 4; i++) w.step(NO_INPUT, DT);
  assert.ok(w.near?.kind === 'contract' || w.near?.kind === 'job', 'something is offered');
  if (w.near?.kind === 'job') assert.notEqual(MISSION[w.near.id]?.giver, l.c.giver, 'not the tale over the pinned contract');
});

test('m3, m4: the switch-box jobs rewire a switch box, and Teh Tarik Time has its own counter', () => {
  const light = [...MISSIONS, ...SIDE].flatMap(m => m.steps.filter(st => st.t === 'mini' && st.kind === 'wires').map(st => [m.id, st.label]));
  for (const id of ['m38', 'm50']) assert.ok(light.some(([m, l]) => m === id && /light/i.test(l)), `${id} names the lights`);
  const minis = src('app/jade-street/minis.tsx'), page = src('app/jade-street/page.tsx');
  assert.match(minis, /bg-mg-switch/); assert.match(minis, /Lights on!/); assert.match(page, /lights=\{/);
  assert.match(src('lib/jade-art.ts'), /'bg-mg-switch'/, 'the painted switch box is packed');
  assert.equal(MISSION.k11.giver, 'raju'); assert.match(page, /The teh tarik stall at Tekka/); assert.match(src('app/jade-street/sg.tsx'), /head\?\.\[0\]/);
});

test('m5, m6, m8, m9, P7, P8: E turns the comic, × picks a way, the Empire banner is fetched early, the day contract leads', () => {
  assert.match(src('app/jade-street/story.tsx'), /'e'/);
  const jobs = src('app/jade-street/jobs.tsx'); assert.match(jobs, /onClose=\{\(\) => pick\(two\[0\]\)\}/); assert.match(jobs, /fmt\(w\.s\.cash\)/);
  assert.match(src('app/jade-street/page.tsx'), /preloadPic\('bg-empire'\)/);
  const con = src('app/jade-street/contracts.tsx'); assert.match(con, /day: 0/); assert.match(con, /con-tier/);
  assert.match(src('app/jade-street/empire.tsx'), /buy your first property/);
  assert.match(src('app/jade-street/panels.tsx'), /setTab\('menu'\)/);
});

test('m7: a new game starts clear of the safe house, and no job is texted until Opening Night is done', () => {
  const s = newSave(3); s.started = true; s.story.intro = true; const w = new World(s, 3); w.quiet = true; w.step(NO_INPUT, DT);
  assert.notEqual(w.near?.kind, 'safe', 'the first E is not the safe house'); if (w.near) assert.ok(!/safe house/i.test(w.near.label));
  for (let k = 0; k < 40; k++) { w.tick = k * 30; phoneStep(w); }
  assert.equal(s.msgs.filter(m => m.kind === 'job').length, 0, 'Chef Mo waits');
  s.done.push('m1'); for (let k = 40; k < 80; k++) { w.tick = k * 30; phoneStep(w); }
  assert.ok(s.msgs.some(m => m.kind === 'job'), 'and texts once it is done');
});

test('P1: the taxi arriving replaces "on its way"; P2: the ferry crossing is quicker; P6: plane spotting counts down', () => {
  const q = new Notices(); q.push('Grab: a taxi is on its way', 'good'); q.drop('taxi is on its way'); q.push('Your taxi is here: E to get in', 'good');
  assert.deepEqual(q.shown.map(x => x.msg), ['Your taxi is here: E to get in']);
  assert.match(src('lib/jade-taxi.ts'), /'taxi is on its way'\)/);
  assert.ok(FERRY_RIDE >= 2, 'the crossing runs at least twice the shore ferry'); assert.ok(FERRY_SPEED * FERRY_RIDE >= 600);
  assert.match(src('app/jade-street/duo.tsx'), /On the ferry with you/);
  const w = late(); w.time = PLANE_FLY + 1; assert.equal(Math.ceil(planeIn(w)), PLANE_EVERY - PLANE_FLY - 1); w.time = 1; assert.equal(planeIn(w), 0);
});

console.log(`jade (thirteenth pass): ${n} tests ok`);
await import('./jade-fourteen.mjs');

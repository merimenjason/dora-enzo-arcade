// Jade Street engine tests, sixth pass (run by tests/jade-sg.mjs): the island. Chinatown is untouched and the island
// grows east of it (Toa Payoh's heartlands and the Marina Bay front, joined by expressways with gantries and lights);
// the MRT's timetable, fares, ride view and durian fine; hailed taxis and their fares; island traffic; scooter
// wardens and the five-foot-way offence; the Longkang Lizards; chapter six's ten jobs (offered in order, both heroes
// talking, a checkpoint each, the solver finishing every one, the island's ending); the notice queue; save v7
// migration from v6; the brand scan over the new text; and the new paintings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, H, OW, S, G, ROADS, XWAYS, DISTRICTS, districtAt, DISTRICT_NAME, streetAt } from '../.checks/jade-city.js';
import { F_XWAY, ISLE_NAMES } from '../.checks/jade-island.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, FINALE, CHAPTERS, jobCounts } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, SAVE_KEY, OLD_KEYS, offered, available, chapterOf, openDistricts, safeOpen, buySafe } from '../.checks/jade-save.js';
import { FRAMES, FILL, TEXTURES, PLAIN } from '../.checks/jade-art.js';
import { trainAt, mrtTo, stationNear, FARE, TRAINS } from '../.checks/jade-mrt.js';
import { hail, taxiGo, dropOffs, TAXI_APP } from '../.checks/jade-taxi.js';
import { LIGHTS } from '../.checks/jade-traffic.js';
import { FINE, OFFENCES, offence } from '../.checks/jade-fines.js';
import { startGang, gangHit, GANG, mobSprite } from '../.checks/jade-gangs.js';
import { PAR } from '../.checks/jade-medals.js';
import { Notices } from '../.checks/jade-notice.js';
import { field, nearestFree } from '../.checks/jade-nav.js';
import { playMission } from './jade-bot.mjs';
import { CAST_IDS, CAST_POSES, CAST_R, castPose, castFrame, CHAT } from '../.checks/jade-cast.js';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const allDone = MISSIONS.map(m => m.id);
const world = (o = {}) => { const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.done = o.done ?? allDone; s.settings.assist = o.assist ?? true; s.settings.diff = o.diff ?? 'easy'; s.cash = o.cash ?? 500; if (o.safe) s.safe = o.safe; const w = new World(s, o.seed ?? 5); w.quiet = true; return w; };
const steps = (w, k, inp = NO_INPUT) => { for (let i = 0; i < k; i++) { w.step(inp, DT); if (w.talk) w.talk = null; if (w.ui?.kind === 'ride-view') w.ui = null; } };
const at = (w, id) => { const p = w.c.places[id]; const [x, y] = nearestFree(w.c, 'foot', p.x, p.y, w.open, 3); w.p.b.x = x; w.p.b.y = y; w.p.ride = null; w.regroup(); w.findNear(); };

test('the island: two new districts east of Chinatown, each with a market, a safe house, contacts and real place names', () => {
  const w = world(); const c = w.c;
  assert.equal(W, 376); assert.equal(OW, 120); assert.deepEqual(DISTRICTS.slice(5, 7), ['heartland', 'bay']);
  assert.equal(DISTRICT_NAME.heartland, 'Toa Payoh'); assert.equal(DISTRICT_NAME.bay, 'Marina Bay');
  for (let y = 0; y < H; y += 7) for (let x = 0; x < OW; x += 7) assert.ok(!['heartland', 'bay'].includes(districtAt(x, y)), 'Chinatown keeps its districts');
  for (const d of ['heartland', 'bay']) {
    for (const k of ['market', 'safe', 'contact', 'station']) assert.ok(Object.values(c.places).some(p => p.d === d && p.kind === k), `${d} has a ${k}`);
    assert.ok(c.buildings.filter(b => districtAt(b.x, b.y) === d).length >= 8, `${d} is built up`);
  }
  const sprites = new Set(c.buildings.map(b => b.sprite));
  for (const b of ['hdb-slab-a', 'hdb-point-a', 'hdb-mscp', 'hdb-nc', 'hdb-market', 'hdb-kopitiam', 'hdb-hawker', 'hdb-stn', 'bay-tower-a', 'bay-resort', 'bay-domes', 'bay-wheel', 'bay-grove', 'bay-mall']) assert.ok(sprites.has(b), b);
  assert.ok(c.props.some(p => p.sprite === 'playground') && c.props.some(p => p.sprite === 'void-table'), 'playgrounds and void decks');
  assert.equal(streetAt(150, 37), 'Pan Island Expressway'); assert.equal(streetAt(123, 50), 'Central Expressway');
  for (const v of Object.values(ISLE_NAMES)) assert.ok(typeof v === 'string' && v.length > 2);
  // every island place stands where you can walk to it from the island's safe house
  const s0 = c.places['safe-heartland']; const f = field(c, 'foot', Math.floor(s0.x / T), Math.floor(s0.y / T) + 1, new Set(DISTRICTS));
  for (const [id, p] of Object.entries(c.places)) if (p.x >= OW * T && id !== 'holt') { const [fx, fy] = nearestFree(c, 'foot', p.x, p.y, new Set(DISTRICTS), 2); assert.ok(f.dist[Math.floor(fy / T) * W + Math.floor(fx / T)] >= 0, `walk to ${id}`); }
});

test('expressways: flagged lanes, gantries and crash barriers; island avenues get traffic lights', () => {
  const w = world(); const c = w.c;
  for (const i of XWAYS) { const r = ROADS[i]; const x = r.axis === 'h' ? (r.to < 170 || r.from > 170 ? Math.floor((r.from + r.to) / 2) : 170) : r.at + 1, y = r.axis === 'h' ? r.at + 1 : 50; assert.ok(c.flags[y * W + x] & F_XWAY, `${i} is an expressway`); }
  assert.ok(c.sg.gantries.filter(g => g.tx >= OW || g.ty >= 0 && g.tx === 122).length >= 5, 'island gantries');
  assert.ok(c.props.filter(p => p.sprite === 'xw-barrier').length > 20, 'crash barriers');
  assert.ok(LIGHTS.filter(L => L.tx >= OW).length >= 6, 'island crossings have lights');
  // the bay is water with a bridge over its mouth; the floating stage stands on a deck
  assert.equal(c.ground[72 * W + 170], G.BAY); assert.equal(c.ground[79 * W + 170], G.BRIDGE); assert.equal(c.ground[72 * W + 153], G.DECK);
  assert.deepEqual(openDistricts({ ...newSave(), done: allDone.slice(0, 24) }).includes('heartland'), false);
  assert.ok(openDistricts({ ...newSave(), done: allDone.slice(0, 25) }).includes('bay'), 'the island opens after chapter five');
});

test('the MRT: a fixed timetable, the trains on the viaduct, fares, the ride view, a durian fine, no rides mid-job', () => {
  const w = world(); const isle = w.c.isle;
  assert.equal(isle.stations.length, 10); assert.deepEqual(isle.stations.map(s => s.d), ['changi', 'katong', 'orchard', 'resort', 'canal', 'bay', 'bay', 'glam', 'india', 'heartland']);
  let seen = false, under = false;
  for (let t = 0; t < 400; t += 1.7) for (let k = 0; k < TRAINS; k++) { const a = trainAt(isle, t, k), b = trainAt(isle, t, k); assert.deepEqual(a, b); if (a.visible) seen = true; else under = true; }
  assert.ok(seen && under, 'trains run underground and up on the viaduct');
  at(w, 'stn-chinatown'); assert.equal(w.near?.kind, 'station');
  w.interact(); assert.equal(w.ui?.kind, 'mrt'); w.ui = null;
  const cash = w.s.cash; w.heat = 0;
  assert.ok(mrtTo(w, 'stn-toapayoh'));
  assert.equal(w.s.cash, cash - FARE); assert.equal(w.ui?.kind, 'ride-view'); assert.equal(w.s.stats.mrt, 1);
  const tp = w.c.places['stn-toapayoh']; assert.ok(Math.hypot(w.p.x - tp.x, w.p.y - tp.y) < 160, 'you arrive'); assert.ok(Math.hypot(w.mate.x - tp.x, w.mate.y - tp.y) < 220, 'your partner rides along');
  w.ui = null; w.p.carry = 'durian'; w.s.settings.diff = 'normal'; const fines = w.s.fines.n;
  assert.ok(mrtTo(w, 'stn-raffles')); assert.equal(w.s.fines.n, fines + 1, 'a durian on the train is a fine'); assert.match(FINE.durian.quip, /train/);
  w.ui = null; w.p.carry = null; w.startMission(MISSION.m27); w.findNear();
  assert.notEqual(w.near?.kind, 'station', 'no train mid-job (unless the job says so)'); w.quitJob();
});

test('taxis: hail one (G or the app), get in, pick a drop-off, ride there, pay by distance', () => {
  const w = world({ safe: 'safe-heartland' }); w.heat = 0;
  assert.equal(TAXI_APP, 'Grab');
  assert.ok(hail(w)); assert.equal(w.taxi.st, 'come');
  for (let i = 0; i < 60 * 30 && w.taxi.st !== 'wait'; i++) w.step(NO_INPUT, DT);
  assert.equal(w.taxi.st, 'wait', 'the taxi pulls up'); w.findNear(); assert.equal(w.near?.kind, 'taxi');
  w.interact(); assert.equal(w.ui?.kind, 'taxi');
  const list = dropOffs(w); assert.ok(list.length >= 5); const to = list.find(d => d.id === 'safe-bay') ?? list[list.length - 1];
  const cash = w.s.cash; assert.ok(taxiGo(w, to.id)); assert.equal(w.taxi.st, 'ride');
  for (let i = 0; i < 60 * 60 && w.taxi && w.taxi.st === 'ride'; i++) w.step(NO_INPUT, DT);
  const p = w.c.places[to.id]; assert.ok(Math.hypot(w.p.x - p.x, w.p.y - p.y) < 200, 'dropped off'); assert.ok(w.s.cash < cash, 'paid the fare'); assert.equal(w.s.stats.taxi, 1);
  w.heat = 2; assert.ok(!hail(w), 'no taxi stops with heat'); w.heat = 0;
  w.startMission(MISSION.m27); assert.ok(!hail(w), 'no taxis during a job'); w.quitJob();
});

test('island traffic, scooter wardens and the five-foot-way fine', () => {
  const w = world({ safe: 'safe-bay' });
  steps(w, 60 * 25);
  assert.ok(w.cars.some(c => c.x >= OW * T), 'cars on the island roads');
  assert.ok(w.patrols.some(p => p.ride), 'a scooter warden on the roads');
  assert.ok(OFFENCES.includes('pavement') && FINE.pavement.amt > 0);
  const pt = w.patrols.find(p => p.ride); w.ticket = null; w.s.settings.diff = 'normal';
  w.p.ride = w.rides.find(r => r.kind === 'scooter'); offence(w, 'pavement', pt.b.x + 40, pt.b.y);
  assert.equal(w.ticket?.kind, 'pavement', 'a scooter warden pulls a rider over'); w.p.ride = null;
});

test('the Longkang Lizards: a third gang, in the drains; a bubble makes one slip, paint just makes it blink', () => {
  assert.equal(GANG.lizards.boss, 'lepak'); assert.ok(GANG.lizards.turf.includes('heartland'));
  assert.ok(GANG.otters.turf.includes('bay') && GANG.macaques.turf.includes('heartland'), 'the old gangs have island turf too');
  const w = world({ safe: 'safe-heartland' }); w.gangs.wait = 999;
  const ev = startGang(w, 'lizards'); assert.ok(ev, 'lizards start in Toa Payoh'); assert.equal(ev.mobs.length, 3);
  const [a, b] = ev.mobs;
  assert.ok(gangHit(w, a, 'paint')); assert.ok(a.has, 'paint: just a blink');
  assert.ok(gangHit(w, a, 'bubble')); assert.ok(!a.has && a.st === 'dizzy' && mobSprite('lizards', a).name === 'liz-slip', 'a bubble: it slips and drops the snacks');
  assert.ok(gangHit(w, b, 'net')); assert.equal(mobSprite('lizards', b).name, 'liz-netted');
  for (const k of ['otter', 'mac', 'liz', 'crow']) assert.ok(w.c.isle.hideouts[k], `${k} hideout`);
});

test('chapter six: ten jobs, offered in order after the festival, both heroes talking, a checkpoint and a medal par each', () => {
  const six = MISSIONS.filter(m => m.ch === 6);
  assert.deepEqual(six.map(m => m.id), ['m26', 'm27', 'm28', 'm29', 'm30', 'm31', 'm32', 'm33', 'm34', 'm35']);
  assert.equal(CHAPTERS[5], 'The Island'); assert.equal(FINALE[5], 'm35');
  for (const m of six) {
    const who = new Set(m.steps.flatMap(s => s.t === 'talk' ? s.lines.map(l => l[0]) : []));
    assert.ok(who.has('hero') && who.has('mate'), `${m.id}: both heroes talk`);
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`); assert.ok(PEOPLE[m.giver], m.giver);
  }
  const kinds = new Set(six.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['train', 'beat', 'chase', 'tail', 'escort', 'stealth', 'collect', 'fares', 'bag', 'mini', 'detective', 'trap', 'swap', 'blend']) assert.ok(kinds.has(k), `a ${k} step`);
  const skins = new Set(six.flatMap(m => m.steps.map(s => s.skin ?? s.gang).filter(Boolean)));
  for (const k of ['mac', 'liz', 'kaw', 'otter']) assert.ok(skins.has(k), `${k} in a job`);
  assert.ok(MISSION.m30.steps.some(s => s.t === 'chase' && s.route.some(([x, y]) => y === 80 || x === 124)), 'the expressway chase rides the expressways');
  const s = newSave(); s.done = allDone.slice(0, 25); assert.equal(chapterOf(s), 6); assert.deepEqual(available(s).map(m => m.id), ['m26', 'm27']);
  s.done = allDone.slice(0, 34); assert.deepEqual(available(s).map(m => m.id), ['m35'], 'the finale waits for the rest');
  s.done = allDone.slice(0, 35); assert.equal(chapterOf(s), 7); s.done = allDone.filter(id => MISSION[id].ch <= 7); assert.equal(chapterOf(s), 8); s.done = allDone; assert.equal(chapterOf(s), 9);
});

test('chapter six: the solver finishes all ten, a forced failure restarts at the checkpoint, the island ending plays once', () => {
  for (const m of MISSIONS.filter(m => m.ch === 6)) { const r = playMission(m.id, 'perfect', 1); assert.ok(r.won, `${m.id}: ${JSON.stringify(r).slice(0, 200)}`); }
  const r = playMission('m30', 'casual', 2, { failAt: 2 }); assert.ok(r.won && r.fails >= 1, 'the expressway chase restarts from its checkpoint');
  const w = world({ done: allDone.slice(0, 34) }); w.s.story.isle = false; w.finishMission(MISSION.m35);
  assert.ok(w.fx.some(f => f.t === 'finale' && f.kind === 'isle'), 'the island ending');
  w.s.story.isle = true; w.fx.length = 0; w.finishMission(MISSION.m35); assert.ok(!w.fx.some(f => f.t === 'finale'), 'not on a replay');
});

test('the notice queue: two at a time, bad news first, repeats refresh, stale chatter is dropped', () => {
  const q = new Notices();
  q.push('+15 coins', 'good'); q.push('Radio: Kopi FM'); q.push('Fined!', 'bad');
  assert.equal(q.shown.length, 2); assert.ok(q.shown.some(x => x.msg === 'Fined!'), 'bad news jumps the queue'); assert.ok(q.busy);
  q.push('Fined!', 'bad'); assert.equal(q.shown.filter(x => x.msg === 'Fined!').length, 1, 'no duplicates');
  for (let i = 0; i < 60 * 10; i++) q.step(1 / 60);
  assert.equal(q.shown.length + q.queue.length, 0, 'all shown or dropped');
  const w = world(); w.hush = true; const before = w.barks.length; w.fx.length = 0;
  startGang(w, 'macaques'); assert.equal(w.barks.length, before, 'passers-by hold their remarks while something important shows');
});

test('save: a v6 save migrates through v7 and v8 to v9 (island counts at zero, island ending unseen); v9 round trips', () => {
  assert.ok(SAVE_VERSION >= 9); assert.ok(OLD_KEYS.includes('jade-street-v8') && OLD_KEYS.includes('jade-street-v7'));
  const v6 = JSON.parse(JSON.stringify({ ...newSave(9), v: 6 })); delete v6.stats.mrt; delete v6.stats.taxi; delete v6.story.isle; v6.done = allDone.slice(0, 25); v6.cash = 777; delete v6.rep.heartland; delete v6.rep.bay;
  const s = loadSave(JSON.stringify(v6));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.cash, 777); assert.equal(s.stats.mrt, 0); assert.equal(s.stats.photos, 0); assert.equal(s.stats.taxi, 0); assert.equal(s.story.isle, false); assert.equal(s.rep.heartland, 0);
  assert.equal(chapterOf(s), 6); assert.ok(openDistricts(s).includes('heartland'));
  s.stats.mrt = 3; s.done.push('m26'); s.story.isle = true; s.rep.bay = 12;
  assert.deepEqual(loadSave(JSON.stringify(s)), s, 'v9 round trip');
  // the island's safe houses are bought with island reputation
  s.rep.heartland = 20; s.cash = 900; assert.equal(buySafe(s, 'safe-heartland'), null); assert.ok(safeOpen(s, 'safe-heartland'));
});

test('real names in the island text, not parodies (owner, 16-11)', () => {
  const BAN = /\b(Jade Line|Tumpang!|Triple Sails|Float-About|Durian Domes|Bay Spinner|Super Grove|All-Hours Emporium|Galaxy Studios|Palawan Sands|Sky Spinner|Coral Dome|Lion City Taxi)/;
  for (const f of ['lib/jade-island.ts', 'lib/jade-mrt.ts', 'lib/jade-taxi.ts', 'lib/jade-story.ts', 'lib/jade-gangs.ts', 'lib/jade-city.ts', 'lib/jade-fines.ts', 'lib/jade-notice.ts', 'app/jade-street/isle.tsx', 'app/jade-street/story.tsx', 'app/jade-street/panels.tsx']) {
    const m = readFileSync(f, 'utf8').match(BAN); assert.ok(!m, `${f} mentions ${m?.[0]}`);
  }
});

test('every island painting is in the atlas and none is blank', () => {
  const need = ['hdb-slab-a', 'hdb-slab-b', 'hdb-point-a', 'hdb-point-b', 'hdb-mscp', 'hdb-nc', 'hdb-market', 'hdb-kopitiam', 'hdb-stn', 'hdb-cc', 'hdb-hawker', 'hdb-bus',
    'bay-tower-a', 'bay-tower-b', 'bay-tower-c', 'bay-tower-d', 'bay-resort', 'bay-stage', 'bay-domes', 'bay-stn', 'bay-wheel', 'bay-mall', 'bay-grove', 'bay-hotel',
    'mrt-front', 'mrt-mid', 'v-taxi', 'v-taxi-b', 'wscoot-0', 'wscoot-1', 'rail', 'rail-pillar', 'xw-barrier', 'playground', 'hide-liz', 'hide-otter', 'hide-mac', 'crow-nest', 'statuette', 'light-crate',
    'liz-run-0', 'liz-slip', 'liz-netted', 'liz-lepak', 'folk-tapir-down', 'folk-mousedeer-side-0', 'folk-civet-hop', 'kaw-flap', 'kaw-brief', 'face-kamal', 'face-vanda-happy', 'face-lepak-cross', 'face-kaw-worried', 'i-taxiapp', 'i-mrt', 'pin-train',
    ...['dora', 'enzo'].flatMap(h => ['hail-down', 'hail-side', 'tap-card', 'pole-0', 'pole-1', 'seat', 'phone', 'slide', 'point', 'dance-0', 'dance-1', 'panting'].map(a => `${h}-${a}`))];
  for (const f of need) { assert.ok(FRAMES[f], f); assert.ok(FILL[f] > 0.04, `${f} is painted`); }
  for (const t of ['xway', 'hdb', 'rubber', 'granite', 'deck', 'bay']) assert.ok(TEXTURES.includes(t), t);
  for (const p of ['bg-chapter-6', 'bg-end-4', 'bg-mrt-ride', 'bg-stall-heartland', 'bg-stall-bay']) assert.ok(PLAIN[p], p);
});

test('every job count shown comes from the job lists, none is written in by hand', () => {
  const s = newSave(3); s.done = ['m1', 'm2', 'k1']; s.medals = { m1: { m: 3 }, m2: { m: 1 }, k1: { m: 2 } };
  const n = jobCounts(s);
  assert.deepEqual([n.story, n.tales, n.done, n.gold, n.marks], [2, 1, 3, 1, 4]);
  assert.equal(n.storyAll, MISSIONS.length); assert.equal(n.talesAll, SIDE.length); assert.equal(n.all, MISSIONS.length + SIDE.length); assert.equal(n.marksAll, MISSIONS.length * 3);
  // the page, the jobs book and the pause panel show counts only through jobCounts or the lists' lengths: no
  // "/25", "of 35 jobs" and the like in the source, for any count the lists could give
  const counts = new Set([MISSIONS.length, SIDE.length, MISSIONS.length + SIDE.length, MISSIONS.length * 3, 25, 75]);
  for (const f of ['page.tsx', 'extras.tsx', 'panels.tsx', 'isle.tsx', 'story.tsx', 'ui.tsx']) {
    const src = readFileSync(new URL(`../app/jade-street/${f}`, import.meta.url), 'utf8');
    for (const k of counts) {
      const re = new RegExp(`(/\\s*${k}\\b|\\bof ${k}\\b|\\b${k} (story )?jobs\\b|\\b${k} marks\\b)`);
      assert.ok(!re.test(src), `${f} writes the count ${k} in by hand`);
    }
    assert.ok(!/\.startsWith\('m'\)\)\.length/.test(src), `${f} counts story jobs by their id`);
  }
});

test('the job givers stand in the world: painted, solid, waving with a job, talking in their lines', () => {
  // every person bar the heroes has all six painted frames
  assert.equal(CAST_IDS.length, Object.keys(PEOPLE).length - 2);
  for (const id of CAST_IDS) for (const p of CAST_POSES) { const f = `npc-${id}-${p}`; assert.ok(FRAMES[f], f); assert.ok(FILL[f] > 0.04, `${f} is painted`); }
  for (const id of CAST_IDS) assert.ok(CHAT[id], `${id} has something to say`);
  // a fresh game: Uncle Kee stands at his place with the first job, solid, waving when you come near
  const s = newSave(4); s.started = true; s.story.intro = true; const w = new World(s, 4); w.quiet = true; w.step(NO_INPUT, DT);
  const kee = w.cast.find(c => c.id === 'kee'); const pl = w.c.places.kee;
  assert.ok(kee && kee.home && Math.hypot(kee.x - pl.x, kee.y - pl.y) < 2 * T, 'Uncle Kee stands at his place');
  assert.equal(kee.job, 'm1'); assert.ok(w.cast.every(c => w.open.has(c.d)), 'only in open districts');
  w.p.b.x = kee.x; w.p.b.y = kee.y + 120; w.p.ride = null; assert.equal(castPose(w, kee), 'wave');
  for (let i = 0; i < 90; i++) w.step({ ...NO_INPUT, my: -1 }, DT);
  assert.ok(Math.hypot(w.p.x - kee.x, w.p.y - kee.y) >= CAST_R + w.p.b.r - 1, 'you walk up to him, not through him');
  w.findNear(); assert.equal(w.near?.kind, 'mission'); w.interact();
  assert.ok(w.talk && w.talk.lines[w.talk.i][0] === 'kee', 'his job starts with his lines'); assert.equal(castPose(w, kee), 'talk');
  assert.match(castFrame(kee, 'talk', 0), /^npc-kee-talk-[01]$/);
  w.talk = null; w.quitJob();
  // after the job he keeps standing there and has a word for you
  const s2 = newSave(4); s2.started = true; s2.story.intro = true; s2.done = MISSIONS.map(m => m.id).concat(SIDE.map(m => m.id)); const w2 = new World(s2, 4); w2.quiet = true; w2.step(NO_INPUT, DT);
  // (the story done, contracts are open: keep Uncle Kee out of tonight's offers so he just chats; tests/jade-proc.mjs covers a giver with a contract)
  s2.contracts.night = s2.night; s2.contracts.offers = [0, 1, 2].map(i => ({ seed: 900 + i, tier: 0, stars: 1, open: [...w2.open], avoid: ['kee'] })); w2.event = null; w2.castK = ''; w2.step(NO_INPUT, DT);
  const k2 = w2.cast.find(c => c.id === 'kee'); assert.ok(k2 && !k2.job, 'still there after his jobs');
  assert.ok(new Set(w2.cast.map(c => c.d)).size >= 7, 'givers stand in every district');
  w2.p.b.x = k2.x; w2.p.b.y = k2.y + 40; w2.p.ride = null; w2.findNear(); assert.equal(w2.near?.kind, 'giver'); assert.equal(w2.near.label, 'Talk to Uncle Kee');
  w2.interact(); assert.equal(w2.talk?.lines[0][0], 'kee'); assert.equal(castPose(w2, k2), 'talk');
  // a giver whose job is offered somewhere else waits beside it, and goes once the job starts
  const s3 = newSave(4); s3.started = true; s3.story.intro = true; s3.done = MISSIONS.filter(m => m.ch <= 5).map(m => m.id); const w3 = new World(s3, 4); w3.quiet = true; w3.step(NO_INPUT, DT);
  const gl = w3.cast.find(c => c.id === 'glint' && c.job === 'm26'); const st = w3.c.places['stn-chinatown'];
  assert.ok(gl && !gl.home && Math.hypot(gl.x - st.x, gl.y - st.y) < 2 * T, 'Madame Glint waits by Chinatown station with chapter six');
  w3.startMission(MISSION.m26); w3.talk = null; for (let i = 0; i < 8; i++) w3.step(NO_INPUT, DT);
  assert.ok(!w3.cast.some(c => c.id === 'glint'), 'and leaves when the job starts'); w3.quitJob();
});

console.log(`jade (sixth pass): ${n} tests ok`);
await import('./jade-jobs.mjs');

// Jade Street, the twelfth pass: Orchard Road, and Katong and Changi over the Geylang River (their landmarks, markets, safe
// houses, givers, MRT stations, empire properties, the cycling track and the hired bikes, Jewel's Rain Vortex), the
// Atas Bats and Datin Ciku, chapter eight (Christmas Star) and three Hawker Tales, the real names, the calendar
// festivals and the coast's small pleasures, the empire's people in the street, the fairer Hard raid and the wider
// Hard contract gap, the back lanes, the frame-rate arithmetic and save v13.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, H, G, S, FAR_X0, CHANGI_X0, DISTRICTS, DISTRICT_NAME, districtAt, streetAt, city } from '../.checks/jade-city.js';
import { mvT, mvP, unmvP, OLD_W } from '../.checks/jade-layout.js';
/** an old-frame tile's index in the live map (the city's literal tiles below are in the old frame, see lib/jade-layout.ts) */
const oi = (x, y) => { const [tx, ty] = mvT(x, y); return ty * W + tx; };
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, CHANGI_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, SAVE_KEY, OLD_KEYS, openDistricts, chapterOf, checkTrophies, TROPHIES, SAFE_HOUSES } from '../.checks/jade-save.js';
import { startGang, gangHit, GANG, mobSprite } from '../.checks/jade-gangs.js';
import { stationById } from '../.checks/jade-mrt.js';
import { castOf, CHAT } from '../.checks/jade-cast.js';
import { BIZ, BIZ_OF, raidEnter, raidStep } from '../.checks/jade-biz.js';
import { RAID_KINDS, gangOf, jobsAt } from '../.checks/jade-empire.js';
import { VEHICLES } from '../.checks/jade-move.js';
import { FAR_NAMES } from '../.checks/jade-far.js';
import { festOn } from '../.checks/jade-eastfest.js';
import { isDeepavali, isBazaar, isChristmas, ymd } from '../.checks/jade-calendar.js';
import { lightUp, planeNow, PLANE_EVERY } from '../.checks/jade-farfest.js';
import { snapScale, foldTints, chunkStale } from '../.checks/jade-perf.js';
import { contractMission, GIVERS, VOICE } from '../.checks/jade-proc.js';
import { FRAMES } from '../.checks/jade-art.js';
import { missionSave, playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const allDone = MISSIONS.map(m => m.id);
const FAR = ['orchard', 'katong', 'changi'];
function world(o = {}) {
  const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.story.ch = 9; s.done = o.done ?? [...allDone, ...SIDE.map(m => m.id)]; s.cash = o.cash ?? 300;
  s.settings.diff = o.diff ?? 'normal'; s.settings.assist = o.assist ?? false;
  const w = new World(s, o.seed ?? 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT); return w;
}
const at = (w, id, dy = 0.6) => { const p = w.c.places[id]; w.placePlayer(p.x, p.y + T * dy); w.p.act = null; w.step(NO_INPUT, DT); w.talk = null; };
const tile = (x, y) => [Math.floor(x / T), Math.floor(y / T)];

test('the map grows east over the Geylang River: Orchard Road north, Katong south, Changi at the far end', () => {
  assert.equal(OLD_W, 376); assert.ok(W * H <= 131072, 'the nav heap still fits (its key packs tile and distance; widened for Pulau Ubin)');
  assert.deepEqual(DISTRICTS.slice(10, 13), FAR);
  assert.equal(DISTRICT_NAME.orchard, 'Orchard Road'); assert.equal(DISTRICT_NAME.katong, 'Katong'); assert.equal(DISTRICT_NAME.changi, 'Changi');
  assert.equal(districtAt(...mvT(300, 10)), 'orchard'); assert.equal(districtAt(...mvT(300, 60)), 'katong'); assert.equal(districtAt(...mvT(340, 30)), 'changi'); assert.equal(districtAt(...mvT(250, 10)), 'india');
  for (let x = 272; x <= 275; x++) assert.equal(c.ground[oi(x, 20)], G.CANAL, 'the Geylang River');
  // each district: a market, a safe house, a station, a giver, painted ground of its own
  for (const [d, mk, safe, stn] of [['orchard', 'mk-orchard', 'safe-orchard', 'stn-orchard'], ['katong', 'mk-katong', 'safe-katong', 'stn-katong'], ['changi', 'mk-changi', 'safe-changi', 'stn-changi']]) {
    assert.equal(c.places[mk]?.d, d, mk); assert.equal(c.places[mk].kind, 'market');
    assert.equal(c.places[safe]?.kind, 'safe'); assert.ok(SAFE_HOUSES.some(h => h.id === safe && h.d === d), safe);
    assert.ok(stationById({ c }, stn), stn);
    assert.ok(Object.values(c.places).some(p => p.d === d && p.kind === 'contact'), `${d} has a giver`);
  }
  for (const g of ['KATONG', 'ORCHARD', 'TARMAC', 'CYCLE', 'JEWEL', 'CHANGI']) assert.ok(c.ground.includes(G[g]), g);
  // roads link in: the expressway along the coast, and every new road crossing the river by a bridge
  assert.ok([12, 46, 62, 72].every(y => c.ground[oi(273, y + 1)] === G.BRIDGE), 'bridges over the Geylang River');
  assert.ok(c.props.some(p => p.sprite === 'gantry' && (unmvP(p.x, p.y) ?? [0])[0] / T > FAR_X0), 'a gantry on the new expressway');
  // the cycling track along East Coast Park, the beach and the sea
  assert.ok(c.ground[oi(300, 81)] === G.CYCLE && c.ground[oi(300, 86)] === G.SAND);
  // Jewel's Rain Vortex: a pool you walk round, inside glass walls with three doors
  const [vx, vy] = c.far.vortex; const [tx, ty] = tile(vx, vy); assert.notEqual(c.solid[ty * W + tx], S.OPEN, 'the pool');
  assert.equal(c.solid[oi(331, 44)], S.OPEN, 'the south doors'); assert.notEqual(c.solid[oi(326, 44)], S.OPEN, 'the glass wall');
});

test('real names on the new streets and landmarks; the district opens with the story', () => {
  assert.match(FAR_NAMES.ion, /ION Orchard/); assert.match(FAR_NAMES.vortex, /Rain Vortex/); assert.match(FAR_NAMES.jewel, /Jewel/);
  assert.equal(c.places.laksa.name, '328 Katong Laksa');
  const st = new Set(); for (let y = 0; y < 92; y += 3) for (let x = FAR_X0; x < OLD_W; x += 3) { const s = streetAt(...mvT(x, y)); if (s) st.add(s); }
  for (const s of ['Orchard Road', 'East Coast Road']) assert.ok([...st].some(n => n.includes(s)), `${s} in ${[...st].join(', ')}`);
  const s = newSave(); s.done = allDone.filter(id => MISSION[id].ch <= 7 && id !== 'm45'); assert.ok(!openDistricts(s).includes('katong'));
  s.done.push('m45'); assert.ok(openDistricts(s).includes('katong') && openDistricts(s).includes('orchard') && !openDistricts(s).includes('changi'));
  s.done.push('m46', 'm47', 'm48', 'm49', 'm50', 'm51', CHANGI_OPENS); assert.ok(openDistricts(s).includes('changi'));
});

test('the MRT runs on: Changi Airport, Katong Park and Orchard at the top of the line', () => {
  const isle = c.isle; assert.deepEqual(isle.stations.slice(5, 8).map(s => s.id), ['stn-changi', 'stn-katong', 'stn-orchard']);
  for (let i = 1; i < isle.stations.length; i++) assert.ok(isle.stations[i].s > isle.stations[i - 1].s, 'stations in order along the line');
});

test('the Atas Bats: on their turf, swooping and hanging upside down; every gadget has its own effect; E shoos', () => {
  assert.equal(GANG.bats.name, 'the Atas Bats'); assert.equal(GANG.bats.boss, 'ciku'); assert.deepEqual(GANG.bats.turf, FAR);
  assert.ok(PEOPLE.ciku && CHAT.ciku); assert.equal(districtAt(...tile(...c.isle.hideouts.bat)), 'katong');
  const w = world(); at(w, 'rosie', 1.4);
  const ev = startGang(w, 'bats'); assert.ok(ev, 'a raid starts in Katong'); assert.equal(ev.mobs.length, 3);
  assert.ok(w.s.msgs.some(m => m.from === 'ciku'), 'Datin Ciku texts');
  let flew = false; for (let k = 0; k < 60 * 45 && !flew; k++) /* (45 s: since pass 13 a bat left alone takes off about every 8 s, not 4) */ { w.step(NO_INPUT, DT); for (const m of ev.mobs) if (m.fly !== undefined) flew = true; }
  assert.ok(flew, 'they swoop');
  const effects = {};
  for (const g of ['bubble', 'paint', 'net', 'sling', 'popper']) {
    const e = startGang((w.gangs.ev = null, w), 'bats') ?? ev; const m = e.mobs.find(q => q.has) ?? e.mobs[0]; m.has = true; m.st = 'run';
    gangHit(w, m, g); effects[g] = m.st;
  }
  assert.deepEqual(effects, { bubble: 'play', paint: 'preen', net: 'netted', sling: 'munch', popper: 'leap' });
  for (const st of ['play', 'preen', 'netted', 'munch', 'dizzy', 'run', 'lepak']) { const f = mobSprite('bats', { st, b: { h: 0, speed: 50 }, anim: 0 }).name; assert.ok(f.startsWith('bat-') && FRAMES[f], `${st}: ${f}`); }
  assert.equal(mobSprite('bats', { st: 'lepak', b: { h: 0, speed: 0 }, anim: 0 }).name.startsWith('bat-hang'), true, 'a bat at rest hangs upside down');
  w.gangs.ev = null; const e2 = startGang(w, 'bats'); const m = e2.mobs[0]; m.fly = undefined; m.st = 'run'; m.has = true;
  w.placePlayer(m.b.x + 30, m.b.y); w.p.act = null; w.findNear(); assert.equal(w.near?.kind, 'gang'); assert.match(w.near.label, /Shoo the bat/);
  w.interact(); assert.equal(w.p.act?.n, 'shoo');
  // the bats raid the new districts' properties, and stand in for the other gangs' job steps
  for (const b of BIZ.filter(b => FAR.includes(b.d))) { assert.equal(gangOf(b.id), 'bat'); assert.ok(RAID_KINDS.bat.length >= 3); }
  for (const f of ['bat-fly-0', 'bat-netted', 'bat-till-0', 'bat-gloat', 'bat-perch', 'bat-sing', 'ciku-run-0', 'ciku-run-1', 'ciku-stand', 'ciku-dizzy', 'pin-bat', 'hide-bat']) assert.ok(FRAMES[f], f);
});

test('the empire reaches the coast: a property or two in each new district, raided by the bats', () => {
  for (const d of FAR) assert.ok(BIZ.some(b => b.d === d), `${d} has a property`);
  for (const b of BIZ.filter(b => FAR.includes(b.d))) { const [tx, ty] = b.at; assert.equal(districtAt(tx, ty), b.d, b.id); assert.ok(FRAMES[`biz-${b.art ?? b.id}-1`] || FRAMES[b.sprite ?? ''] || true); }
});

test('the hired bikes: parked by the racks, quiet, quicker on the cycling track; riding one has its own frames', () => {
  assert.equal(VEHICLES.bike.seats, 1); assert.equal(VEHICLES.bike.cls, 'small');
  const bikes = c.parking.filter(p => p.kind === 'bike'); assert.equal(bikes.length, c.far.bikes.length + c.parking.filter(p => p.kind === 'bike' && (p.d === 'pulau' || p.d === 'kallang' || p.d === 'mandai')).length);
  for (const b of bikes) assert.equal(districtAt(...tile(b.x, b.y)), b.d);
  for (const h of ['dora', 'enzo']) for (const f of ['ride-bike-0', 'ride-bike-1', 'laksa-0', 'bauble-0', 'kite-0', 'plane-0', 'suitcase-0']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
  const w = world(); const r = w.rides.find(r => r.kind === 'bike'); assert.ok(r);
  const before = w.s.stats.bikes; w.placePlayer(r.b.x + 30, r.b.y); w.p.act = null; w.findNear(); assert.equal(w.near?.kind, 'ride'); w.interact();
  for (let k = 0; k < 40; k++) w.step(NO_INPUT, DT); assert.equal(w.p.ride, r); assert.equal(w.s.stats.bikes, before + 1);
  // flat out along the track against flat out on the promenade
  const top = y => { [r.b.x, r.b.y] = mvP(300 * T, y * T + T / 2); r.b.h = 0; r.b.speed = 0; for (let k = 0; k < 120; k++) w.step({ ...NO_INPUT, mx: 1 }, DT); return r.b.speed; };
  assert.ok(top(81) > top(80) * 1.1, 'quicker on the track');
});

test('chapter eight: ten jobs, every district, a mix of steps, no more than two chases, a finale at the Rain Vortex', () => {
  const eight = MISSIONS.filter(m => m.ch === 8);
  assert.equal(eight.length, 10); assert.deepEqual(eight.map(m => m.id), ['m46', 'm47', 'm48', 'm49', 'm50', 'm51', 'm52', 'm53', 'm54', 'm55']);
  assert.equal(CHAPTERS[7], 'Christmas Star'); assert.equal(FINALE[7], 'm55');
  for (const m of eight) {
    if (m.id !== 'm46') assert.ok(FAR.includes(c.places[m.at].d), `${m.id} is given in a new district`);
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
  }
  const TRIVIAL = new Set(['talk', 'goto', 'ride', 'pickup', 'post', 'switch']);
  const kinds = new Set(eight.flatMap(m => m.steps.map(s => s.t).filter(t => !TRIVIAL.has(t))));
  for (const k of ['train', 'deliver', 'mini', 'detective', 'race', 'defend', 'collect', 'blend', 'swap', 'case', 'heist', 'trap', 'tail', 'stealth', 'chase', 'bag']) assert.ok(kinds.has(k), k);
  assert.ok(eight.filter(m => m.steps.some(s => s.t === 'chase')).length <= 2, 'at most two chases');
  assert.ok(eight.some(m => m.steps.some(s => s.t === 'race' && s.ride === 'bike')), 'a race on a hired bike');
  assert.ok(eight.some(m => m.steps.some(s => (s.t === 'defend' || s.t === 'trap') && s.gang === 'bat')) && eight.some(m => m.steps.some(s => s.t === 'swap' && s.skin === 'bat')), 'the bats star');
  assert.ok(MISSION.m55.steps.some(s => s.t === 'chase' && s.skin === 'ciku') && MISSION.m55.steps.some(s => s.t === 'stealth' && s.goal === 'vortex'), 'the Rain Vortex finale');
  // every spot of every chapter-eight job and new Hawker Tale is on open ground (water for the boat race)
  for (const m of [...eight, ...SIDE.filter(m => ['k14', 'k15', 'k16'].includes(m.id))]) for (const st of m.steps) {
    const boat = st.ride === 'boat';
    for (const s of [...(st.route ?? []), ...(st.marks ?? []), ...(st.items ?? []), ...(st.crates ?? []), ...(st.path ?? []), st.goal, st.exit, st.rack, st.bait, st.wait, st.front, st.back, st.safe].filter(Array.isArray)) assert.equal(c.solid[s[1] * W + s[0]], boat ? S.WATER : S.OPEN, `${m.id} ${st.t} ${s}`);
  }
  assert.deepEqual(SIDE.slice(13, 16).map(m => m.id), ['k14', 'k15', 'k16']);
  for (const id of ['k14', 'k15', 'k16']) assert.ok(FAR.includes(c.places[MISSION[id].at].d), `${id} in a new district`);
  const s = newSave(); s.done = allDone.filter(id => MISSION[id].ch <= 7); assert.equal(chapterOf(s), 8); s.done = allDone; assert.equal(chapterOf(s), 13);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, 95); assert.equal(jc.talesAll, 38);
});

test('the solver finishes every chapter-eight job and the new Hawker Tales; the casual bot finishes the finale', () => {
  for (const m of [...MISSIONS.filter(m => m.ch === 8), ...SIDE.filter(m => ['k14', 'k15', 'k16'].includes(m.id))]) { const r = playMission(m.id, 'perfect', 1); assert.ok(r.won, `${m.id}: ${JSON.stringify(r).slice(0, 200)}`); }
  const r = playMission('m55', 'casual', 2); assert.ok(r.won, JSON.stringify(r).slice(0, 200));
});

test('the Christmas Star ending plays once, after Datin Ciku is stopped; the chapter-eight trophies', () => {
  const w = world({ done: allDone.filter(id => id !== 'm55') });
  w.finishMission(MISSION.m55); assert.ok(w.fx.some(f => f.t === 'finale' && f.kind === 'coast'));
  w.s.story.coast = true; w.fx = []; w.replaying = true; w.finishMission(MISSION.m55); assert.ok(!w.fx.some(f => f.t === 'finale'));
  for (const id of ['coast', 'atas', 'pedal', 'shiok', 'spotter']) assert.ok(TROPHIES.some(t => t.id === id), id);
  const s = newSave(); s.done = allDone; s.stats.bats = 10; s.stats.bikes = 3; s.stats.laksa = 1; s.stats.baubles = 1; s.stats.kites = 1; s.stats.planes = 5;
  const got = checkTrophies(s); for (const t of ['Coast to Coast', 'Not So Atas', 'Pedal Power', 'Shiok!', 'Plane Spotter']) assert.ok(got.includes(t), t);
  for (const f of ['bg-chapter-8', 'bg-end-6', 'bg-stall-katong', 'bg-stall-orchard', 'bg-stall-changi', 'tex-katong', 'tex-changi', 'atlas-far', 'atlas-far2']) assert.ok(readdirSync(new URL('../public/art/jade-street/', import.meta.url)).includes(f + '.webp'), f);
});

test('the new people stand in the world with a line, a voice for contracts and a painted face', () => {
  for (const id of ['rosie', 'bala', 'tiara', 'faiz', 'ubin', 'ciku']) {
    assert.ok(PEOPLE[id] && CHAT[id] && VOICE[id] && GIVERS.includes(id), id);
    for (const f of [PEOPLE[id].face, `${PEOPLE[id].face}-happy`, `npc-${id}-idle-0`, `npc-${id}-wave-1`, `npc-${id}-talk-0`]) assert.ok(FRAMES[f], f);
  }
  const w = world(); const cast = castOf(w);
  for (const id of ['rosie', 'bala', 'tiara', 'faiz', 'ubin', 'ciku']) assert.ok(cast.some(m => m.id === id && FAR.includes(m.d)), `${id} stands in a new district`);
  for (const f of ['folk-robin-down', 'folk-pigeon-side-1', 'folk-egret-hop']) assert.ok(FRAMES[f], f);
});

test('the empire’s people wait outside your property with their job, and E takes it; Pak Duri stands guard', () => {
  const w = world(); const id = 'chicken'; w.s.biz[id].lvl = 1; w.s.biz[id].bank = 100; w.s.empire.rank = 2; w.s.biz[id].jaga = true;
  const offers = jobsAt(w, id); assert.ok(offers.some(j => j.giver === 'huat'), offers.map(j => j.id).join());
  const cast = castOf(w); const huat = cast.find(m => m.id === 'huat'); assert.ok(huat && huat.job?.startsWith('emp:supplier'), 'Ah Huat waits outside');
  assert.ok(cast.some(m => m.id === 'duri'), 'Pak Duri stands guard');
  w.cast = cast; w.placePlayer(huat.x + 30, huat.y); w.p.act = null; w.findNear(); assert.equal(w.near?.kind, 'empire'); assert.match(w.near.label, /Ah Huat/);
  w.interact(); assert.ok(w.run, 'the supplier deal starts'); void BIZ_OF;
});

test('festivals follow the calendar: Deepavali, the Hari Raya bazaar and the Orchard Road light-up', () => {
  assert.ok(isDeepavali('2026-11-08') && isDeepavali('2026-10-20') && !isDeepavali('2026-12-01'));
  assert.ok(isBazaar('2027-03-01') && !isBazaar('2027-05-01'));
  assert.ok(isChristmas('2026-11-16') && isChristmas('2027-01-03') && !isChristmas('2026-08-09'));
  assert.equal(festOn('2026-11-01', 3), 'deepavali'); assert.equal(festOn('2026-03-10', 4), 'bazaar'); assert.equal(festOn('2026-07-01', 2), 'none');
  assert.equal(festOn(null, 2), 'deepavali'); assert.equal(festOn(null, 3), 'bazaar');
  assert.equal(ymd(new Date(2026, 10, 16)), '2026-11-16');
  // in the world: out of season, no lamps to light; the light-up stays on through chapter eight
  const w = world(); w.today = '2026-07-01'; w.step(NO_INPUT, DT); assert.equal(w.east.fest, 'none');
  w.today = '2026-11-01'; w.step(NO_INPUT, DT); assert.equal(w.east.fest, 'deepavali');
  w.today = '2026-07-01'; assert.equal(lightUp(w), false); w.s.done = w.s.done.filter(id => id !== 'm55'); assert.equal(lightUp(w), true);
});

test('the coast’s small pleasures: laksa, a bauble on the tree, a kite, a plane spotted, a suitcase carried', () => {
  const w = world(); w.today = '2026-12-01';
  const doIt = (x, y, id) => { w.placePlayer(x, y); w.p.act = null; w.findNear(); assert.equal(w.near?.kind, 'far', id); assert.ok(w.near.id.startsWith(id), `${w.near.id} for ${id}`); w.interact(); const n = w.p.act?.n; for (let k = 0; k < 60 * 4; k++) w.step(NO_INPUT, DT); return n; };
  const lk = c.places.laksa; assert.equal(doIt(lk.x, lk.y + 30, 'laksa'), 'laksa'); assert.equal(w.s.stats.laksa, 1);
  const [tx, ty] = c.far.trees[0]; assert.equal(doIt(tx, ty + 30, 'bauble'), 'bauble'); assert.equal(w.s.stats.baubles, 1);
  const [kx, ky] = c.far.kites[0]; assert.equal(doIt(kx, ky, 'kite'), 'kite'); assert.equal(w.s.stats.kites, 1);
  const [sx, sy] = c.far.spots[0]; w.time = PLANE_EVERY * 10 + 2; assert.ok(planeNow(w)); assert.equal(doIt(sx, sy, 'plane'), 'plane'); assert.equal(w.s.stats.planes, 1);
  const tm = c.places.terminal; assert.equal(doIt(tm.x, tm.y + 20, 'suitcase'), 'suitcase');
});

test('the Hard grab raid lets one more of its four crows go; Hard contracts are sharper than Normal ones', () => {
  const src = readFileSync(new URL('../lib/jade-biz.ts', import.meta.url), 'utf8'); assert.match(src, /\(st\.n > 3 \? 1 : 0\)/); void raidEnter; void raidStep;
  const c0 = { id: 'con-1', title: 't', giver: 'kee', at: 'kee', blurb: '', pay: 1, rep: 1, mods: [], fails: [], steps: [{ t: 'deliver', to: 'mo', item: 'parcel', time: 100, label: '' }, { t: 'chase', who: 'runner', from: [10, 10], route: [], bumps: 2, loot: '', speed: 200, label: '' }] };
  const nm = contractMission(c0, false, false), hm = contractMission(c0, false, true);
  assert.ok(hm.steps[0].time < nm.steps[0].time && hm.steps[1].speed > nm.steps[1].speed);
});

test('the back lanes of Little India and Kampong Glam have benches for the townsfolk and everyday clutter', () => {
  const benches = c.props.filter(p => p.sprite === 'plaza-bench' && ['india', 'glam'].includes(districtAt(...tile(p.x, p.y))));
  assert.ok(benches.length >= 8, `${benches.length} benches`);
  assert.ok(benches.every(b => b.solid === 'none'), 'none of them in the way');
});

test('the frame-rate arithmetic: the scale snaps to 1/512, tints fold into one fill, chunks repaint once the zoom is still', () => {
  for (const [d, k] of [[1, 0.73], [2, 0.61], [1.5, 1.07]]) { const s = snapScale(d, k); assert.ok(Math.abs(s * 512 - Math.round(s * 512)) < 1e-9 && Math.abs(s - d * k) <= 1 / 1024); }
  assert.deepEqual(foldTints([]), { col: '', a: 0 });
  // two fills of the same colour fold to one with the combined alpha
  const f = foldTints([[10, 20, 30, 0.5], [10, 20, 30, 0.5]]); assert.equal(f.col, '10,20,30'); assert.equal(f.a, 0.75);
  // and the fold matches painting them one after the other on any background
  const t = [[200, 100, 50, 0.3], [0, 0, 80, 0.4]]; const fo = foldTints(t); const [r] = fo.col.split(',').map(Number);
  for (const D of [0, 128, 255]) { let v = D; for (const [rr, , , a] of t) v = rr * a + (1 - a) * v; assert.ok(Math.abs(v - (r * fo.a + (1 - fo.a) * D)) < 2, `${D}`); }
  assert.equal(chunkStale(1, 1.3, 0), 'now'); assert.equal(chunkStale(1, 1.1, 0.1), 'ok'); assert.equal(chunkStale(1, 1.1, 0.5), 'later'); assert.equal(chunkStale(1, 1, 9), 'ok');
});

test('save v13: a v12 save keeps every job, medal, coin, property and contract; the new counts start at zero', () => {
  assert.equal(SAVE_VERSION, 13); assert.equal(SAVE_KEY, 'jade-street-v13'); assert.equal(OLD_KEYS[0], 'jade-street-v12');
  const v12 = { ...newSave(3), v: 12, cash: 4321, done: allDone.slice(0, 45), medals: { m12: { m: 3, t: 50, plays: 2 }, m45: { m: 2, t: 300, plays: 1 } } };
  v12.biz.noodle.lvl = 2; v12.contracts.done = 9;
  for (const k of ['bats', 'bikes', 'laksa', 'baubles', 'kites', 'planes']) delete v12.stats[k]; delete v12.story.coast;
  const s = loadSave(JSON.stringify(v12));
  assert.equal(s.v, 13); assert.equal(s.cash, 4321); assert.deepEqual(s.done, v12.done); assert.equal(s.medals.m45.m, 2); assert.equal(s.biz.noodle.lvl, 2); assert.equal(s.contracts.done, 9);
  for (const k of ['bats', 'bikes', 'laksa', 'baubles', 'kites', 'planes']) assert.equal(s.stats[k], 0, k);
  assert.equal(s.story.coast, false); assert.equal(chapterOf(s), 8); for (const d of FAR) assert.equal(s.rep[d], 0);
  // the job counts still come from the jobs themselves
  const jc = jobCounts(s); assert.equal(jc.all, MISSIONS.length + SIDE.length); assert.equal(jc.story, 45);
});

console.log(`jade (twelfth pass): ${n} tests ok`);
// the loading tiers, content hashes and cache rule (lib/jade-load.ts)
await import('./jade-load.mjs');
// the thirteenth pass: polish (tests/jade-thirteen.mjs)
await import('./jade-thirteen.mjs');

// Jade Street, ninth pass: Little India and Kampong Glam over the Rochor River, Sentosa over the harbour (the
// boardwalk, the cable car, the ferry and Beach station on the extended MRT), the Kecoh Mynahs, the Deepavali
// light-up and the Hari Raya bazaar, chapter seven (Island Lights), three more Hawker Tales and save v10.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, H, CT_H, EAST_X0, G, S, DISTRICTS, DISTRICT_NAME, districtAt, streetAt, city } from '../.checks/jade-city.js';
import { mvT, OLD_W, OLD_H } from '../.checks/jade-layout.js';
/** an old-frame tile's index in the live map (the city's literal tiles below are in the old frame, see lib/jade-layout.ts) */
const oi = (x, y) => { const [tx, ty] = mvT(x, y); return ty * W + tx; };
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, RESORT_OPENS } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, SAVE_KEY, OLD_KEYS, openDistricts, chapterOf, checkTrophies, TROPHIES, SAFE_HOUSES } from '../.checks/jade-save.js';
import { linkNear, linkGo, cabins, ferryAt, FARES, linkById, cantLink } from '../.checks/jade-cable.js';
import { eastFest, KUIH } from '../.checks/jade-eastfest.js';
import { startGang, gangHit, GANG, mobSprite } from '../.checks/jade-gangs.js';
import { field, nearestFree } from '../.checks/jade-nav.js';
import { offence } from '../.checks/jade-fines.js';
import { mrtTo, stationById } from '../.checks/jade-mrt.js';
import { castOf, CHAT } from '../.checks/jade-cast.js';
import { BRANCHES } from '../.checks/jade-jobs.js';
import { EAST_NAMES } from '../.checks/jade-east.js';
import { missionSave, playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const ALL = new Set(DISTRICTS);
const allDone = MISSIONS.map(m => m.id);
function world(o = {}) {
  const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.story.ch = 8; s.done = o.done ?? allDone.slice(); s.cash = o.cash ?? 200;
  s.settings.diff = o.diff ?? 'normal';
  const w = new World(s, o.seed ?? 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT); return w;
}
const at = (w, id, dy = 0.6) => { const p = w.c.places[id]; w.placePlayer(p.x, p.y + T * dy); w.p.act = null; w.step(NO_INPUT, DT); w.talk = null; };
const idle = (w, sec, until = () => false) => { for (let k = 0; k < sec * 60 && !w.failed && !until(); k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
function inJob(id, t, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? false, diff: o.diff ?? 'normal' });
  const w = new World(s, o.seed ?? 9); w.quiet = true; w.startMission(MISSION[id]); w.talk = null;
  const i = MISSION[id].steps.findIndex(st => st.t === t);
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  if (run.js && BRANCHES[run.cur.t]) run.js.pick = BRANCHES[run.cur.t][0];
  return { w, run, st: run.cur };
}

test('the map grows east and south; Chinatown, Toa Payoh and Marina Bay keep every tile', () => {
  assert.equal(OLD_W, 376); assert.equal(OLD_H, 128); assert.equal(CT_H, 92);
  assert.deepEqual(DISTRICTS.slice(7, 10), ['india', 'glam', 'resort']);
  assert.equal(DISTRICT_NAME.india, 'Little India'); assert.equal(DISTRICT_NAME.glam, 'Kampong Glam'); assert.equal(DISTRICT_NAME.resort, 'Sentosa');
  assert.equal(districtAt(...mvT(240, 10)), 'india'); assert.equal(districtAt(...mvT(240, 60)), 'glam'); assert.equal(districtAt(...mvT(70, 110)), 'resort');
  for (let y = 0; y < CT_H; y += 5) for (let x = 0; x < EAST_X0 - 4; x += 5) assert.ok(!['india', 'glam', 'resort'].includes(districtAt(...mvT(x, y))), `${x},${y} keeps its district`);
  // the Rochor River between the island and the new districts, bridged by the main roads
  const c = city();
  assert.equal(c.ground[oi(209, 20)], G.CANAL); assert.ok([12, 46].some(y => c.ground[oi(209, y + 1)] === G.BRIDGE), 'a bridge over the Rochor River');
});

test('Little India and Kampong Glam: their landmarks, markets, safe houses, contacts and real street names', () => {
  const c = city(), P = c.places, sprites = new Set(c.buildings.map(b => b.sprite));
  for (const b of ['india-temple', 'india-emporium', 'india-sari', 'india-tekka', 'india-spice', 'india-flower', 'glam-mosque', 'glam-haji', 'glam-textile', 'glam-perfume', 'glam-cafe', 'glam-bussorah']) assert.ok(sprites.has(b), b);
  for (const d of ['india', 'glam', 'resort']) {
    for (const k of ['market', 'safe', 'contact']) assert.ok(Object.values(P).some(p => p.d === d && p.kind === k), `${d} has a ${k}`);
    assert.ok(c.buildings.filter(b => districtAt(b.x, b.y) === d).length >= 8, `${d} is built up`);
    assert.ok(SAFE_HOUSES.some(h => h.d === d), `${d} has a safe house for sale`);
  }
  assert.equal(P['stn-littleindia'].d, 'india'); assert.equal(P['stn-bugis'].d, 'glam'); assert.equal(P['stn-beach'].d, 'resort');
  for (const [x, y, name] of [[225, 20, 'Race Course Road'], [245, 20, 'Serangoon Road'], [230, 47, 'Arab Street'], [245, 60, 'North Bridge Road'], [265, 50, 'Kandahar Street']]) assert.equal(streetAt(...mvT(x, y)), name, `${x},${y}`);
  assert.ok(Object.values(EAST_NAMES).every(v => typeof v === 'string' && v.length > 3));
  // every new place can be walked to from Little India's safe house (over the bridges and the boardwalk to Sentosa)
  const s0 = P['safe-india'], f = field(c, 'foot', Math.floor(s0.x / T), Math.floor(s0.y / T) + 1, ALL);
  for (const [id, p] of Object.entries(P)) if (['india', 'glam', 'resort'].includes(p.d)) { const [fx, fy] = nearestFree(c, 'foot', p.x, p.y, ALL, 2); assert.ok(f.dist[Math.floor(fy / T) * W + Math.floor(fx / T)] >= 0, `walk to ${id}`); }
  // and from Chinatown to Sentosa on foot, along the boardwalk
  const cf = field(c, 'foot', Math.floor(P['safe-market'].x / T), Math.floor(P['safe-market'].y / T) + 1, ALL);
  assert.ok(cf.dist[Math.floor(P['fort'].y / T + 1) * W + Math.floor(P['fort'].x / T)] >= 0 || cf.dist[Math.floor(P['beach'].y / T) * W + Math.floor(P['beach'].x / T)] >= 0, 'Chinatown to Sentosa on foot');
});

test('the districts open with the story: over the river after Island Night, Sentosa half way through chapter seven', () => {
  const s = newSave(); s.done = allDone.slice(0, 34); assert.ok(!openDistricts(s).includes('india'));
  s.done = allDone.slice(0, 35); const o = openDistricts(s); assert.ok(o.includes('india') && o.includes('glam') && !o.includes('resort'));
  const i = MISSIONS.findIndex(m => m.id === RESORT_OPENS); s.done = allDone.slice(0, i + 1); assert.ok(openDistricts(s).includes('resort'));
  assert.equal(chapterOf({ ...s, done: allDone.slice(0, 35) }), 7);
  // the phone text and the banner when the river opens
  const w = world({ done: allDone.slice(0, 34) }); w.s.done.push('m35'); w.finishMission(MISSION.m35);
  assert.ok(w.s.msgs.some(m => /Bugis/.test(m.text)), 'Kamal texts about the new stations');
});

test('the MRT runs on: Beach station on Sentosa, Bugis and Little India; trains overhead on the new viaduct', () => {
  const w = world(); const isle = w.c.isle;
  assert.deepEqual(isle.stations.slice(-7).map(s => s.id), ['stn-beach', 'stn-chinatown', 'stn-raffles', 'stn-bayfront', 'stn-bugis', 'stn-littleindia', 'stn-toapayoh']);
  at(w, 'stn-chinatown'); const cash = w.s.cash; w.heat = 0;
  assert.ok(mrtTo(w, 'stn-littleindia')); assert.equal(w.s.cash, cash - 2);
  const li = w.c.places['stn-littleindia']; assert.ok(dist(w.p.x, w.p.y, li.x, li.y) < 160, 'arrive at Little India');
  w.ui = null; assert.ok(mrtTo(w, 'stn-beach')); const b = w.c.places['stn-beach']; assert.ok(dist(w.p.x, w.p.y, b.x, b.y) < 160, 'arrive at Beach station');
});

test('the cable car: cabins go round, E at HarbourFront pays and rides with a ride view, not mid-job, closed under fog', () => {
  const w = world(); const L = w.c.east.cable;
  const a = cabins(L, 10), b = cabins(L, 10); assert.deepEqual(a, b); assert.equal(a.length, 8); assert.notDeepEqual(cabins(L, 11)[0], a[0]);
  at(w, 'cable-harbour'); assert.equal(w.near?.kind, 'cable'); assert.match(w.near.label, /Sentosa cable car/);
  const cash = w.s.cash; w.interact();
  assert.equal(w.s.cash, cash - FARES.cable); assert.equal(w.ui?.kind, 'ride-view'); assert.equal(w.ui.via, 'cable'); assert.equal(w.s.stats.cable, 1);
  const to = w.c.places['cable-sentosa']; assert.ok(dist(w.p.x, w.p.y, to.x, to.y) < 160, 'arrive on Sentosa'); assert.ok(dist(w.mate.x, w.mate.y, to.x, to.y) < 220, 'partner too');
  w.ui = null; w.step(NO_INPUT, DT); assert.equal(w.near?.kind, 'cable'); w.interact(); assert.ok(dist(w.p.x, w.p.y, w.c.places['cable-harbour'].x, w.c.places['cable-harbour'].y) < 160, 'and back');
  // under fog, and mid-job
  const f = world({ done: allDone.slice(0, 36) }); at(f, 'cable-harbour'); assert.notEqual(f.near?.kind, 'cable', 'no rides while Sentosa is fogged');
  assert.equal(cantLink(f, f.c.east.cable, f.c.east.cable.stops[1]), 'Sentosa is still under fog');
  const { w: j } = inJob('m42', 'talk'); at(j, 'cable-harbour'); j.step(NO_INPUT, DT); assert.notEqual(j.near?.kind, 'cable', 'not offered during a talk step of a job');
});

test('the ferry: a timetable round the harbour; riding it carries you all the way (E skips) and counts for the trophy', () => {
  const w = world(); const F = w.c.east.ferry;
  const p0 = ferryAt(F, 0), p1 = ferryAt(F, 20); assert.ok(p0.at === 0 && p1.at === -1, 'waits, then sails');
  at(w, 'ferry-sentosa'); assert.equal(w.near?.kind, 'ferry');
  w.interact(); assert.ok(w.ferry, 'aboard'); assert.equal(w.s.stats.ferry, 1); assert.ok(w.p.hide);
  const x0 = w.p.x; idle(w, 2); assert.ok(Math.abs(w.p.x - x0) > 200, 'the boat carries you');
  assert.equal(w.near?.kind, 'ferry'); w.interact(); assert.equal(w.ferry, null, 'E skips to the pier');
  const bay = w.c.places['ferry-bay']; assert.ok(dist(w.p.x, w.p.y, bay.x, bay.y) < 160, 'at Marina Bay'); assert.ok(!w.p.hide);
  // a full crossing lands by itself
  w.step(NO_INPUT, DT); w.interact(); idle(w, 40, () => !w.ferry); assert.equal(w.ferry, null); const sp = w.c.places['ferry-sentosa']; assert.ok(dist(w.p.x, w.p.y, sp.x, sp.y) < 160);
  w.s.stats.cable = 3; assert.ok(checkTrophies(w.s).includes('Sea Legs') || w.s.trophies.includes('ferry'));
});

test('the Kecoh Mynahs: cheeky, on their turf, hop-flying, mimicking; every gadget has its own effect; E shoos', () => {
  assert.equal(GANG.mynahs.name, 'the Kecoh Mynahs'); assert.equal(GANG.mynahs.boss, 'bising'); assert.deepEqual(GANG.mynahs.turf, ['india', 'glam', 'resort']);
  assert.ok(PEOPLE.bising && CHAT.bising && w0Roost());
  const w = world(); at(w, 'raju', 1.4);
  const ev = startGang(w, 'mynahs'); assert.ok(ev, 'a raid starts in Little India'); assert.equal(ev.mobs.length, 4);
  assert.ok(w.s.msgs.some(m => m.from === 'bising'), 'Boss Bising texts');
  // they fly in short hops and copy sounds
  let flew = false, sang = false; for (let k = 0; k < 60 * 20 && !(flew && sang); k++) { w.step(NO_INPUT, DT); for (const m of ev.mobs) { if (m.fly !== undefined) flew = true; if (m.sing !== undefined) sang = true; } }
  assert.ok(flew, 'hop-flights'); assert.ok(sang, 'mimicry');
  const effects = {};
  for (const g of ['bubble', 'paint', 'net', 'sling', 'popper']) {
    const e = startGang((w.gangs.ev = null, w), 'mynahs') ?? ev; const m = e.mobs.find(q => q.has) ?? e.mobs[0]; m.has = true; m.st = 'run';
    gangHit(w, m, g); effects[g] = m.st;
  }
  assert.deepEqual(effects, { bubble: 'play', paint: 'preen', net: 'netted', sling: 'munch', popper: 'leap' });
  for (const st of ['play', 'preen', 'netted', 'munch', 'dizzy', 'run']) assert.ok(mobSprite('mynahs', { st, b: { h: 0, speed: 50 }, anim: 0 }).name.startsWith('myna-'), st);
  // shoo
  w.gangs.ev = null; const e2 = startGang(w, 'mynahs'); const m = e2.mobs[0]; m.fly = undefined; m.st = 'run'; m.has = true;
  w.placePlayer(m.b.x + 30, m.b.y); w.p.act = null; w.findNear(); assert.equal(w.near?.kind, 'gang'); assert.match(w.near.label, /Shoo/);
  const sid = +w.near.id.slice(5); w.interact(); assert.equal(w.p.act?.n, 'shoo'); assert.equal(e2.mobs.find(q => q.id === sid).has, false, 'it drops the kuih');
  function w0Roost() { return !!city().isle.hideouts.myna; }
});

test('festivals: Deepavali and the Hari Raya bazaar take turns; light a lamp, buy a kuih, sniff, lounge, build a sandcastle', () => {
  assert.equal(eastFest(0), 'deepavali'); assert.equal(eastFest(1), 'bazaar');
  const w = world(); w.s.night = 2; w.step(NO_INPUT, DT); assert.equal(w.east.fest, 'deepavali');
  const [lx, ly] = w.c.east.lamps[0]; w.placePlayer(lx, ly + 20); w.p.act = null; w.step(NO_INPUT, DT);
  assert.equal(w.near?.kind, 'east'); assert.match(w.near.label, /lamp/); w.interact(); assert.equal(w.p.act.n, 'light-lamp'); idle(w, 1.5);
  assert.equal(w.s.stats.lamps, 1); assert.ok(w.east.lit.has(0));
  w.s.night = 3; w.step(NO_INPUT, DT); assert.equal(w.east.fest, 'bazaar'); assert.equal(w.east.lit.size, 0, 'a new night');
  const [bx, by] = w.c.east.bazaar[0]; w.placePlayer(bx, by + 40 + 30); w.p.act = null; w.step(NO_INPUT, DT);
  assert.equal(w.near?.kind, 'east'); const cash = w.s.cash; w.interact(); assert.equal(w.p.act.n, 'kuih'); assert.equal(w.s.cash, cash - KUIH); idle(w, 2); assert.equal(w.s.stats.kuih, 1);
  checkTrophies(w.s); assert.ok(w.s.trophies.includes('festive'));
  const [cx, cy] = w.c.east.beach[0]; w.placePlayer(cx, cy); w.p.act = null; w.step(NO_INPUT, DT); assert.match(w.near?.label ?? '', /sandcastle/); w.interact(); assert.equal(w.p.act.n, 'castle');
  const [dx, dy] = w.c.east.chairs[0]; w.p.act = null; w.placePlayer(dx, dy); w.step(NO_INPUT, DT); assert.match(w.near?.label ?? '', /deck chair/); w.interact(); assert.equal(w.p.act.n, 'lounge');
  w.p.act = null; at(w, 'spices', 0.8); assert.match(w.near?.label ?? '', /spices/); w.interact(); assert.equal(w.p.act.n, 'sniff');
});

test('chapter seven: ten jobs in the new districts, every kind of step, branches, guards, the train, the cable car and fines', () => {
  const seven = MISSIONS.filter(m => m.ch === 7);
  assert.equal(seven.length, 10); assert.equal(CHAPTERS[6], 'Island Lights'); assert.equal(FINALE[6], 'm45');
  const c = city();
  for (const m of seven) {
    // (the first is Kamal's call from the MRT that sends you there; Sergeant Helang waits at the HarbourFront cable car)
    if (m.id !== 'm36' && m.id !== 'm42') assert.ok(['india', 'glam', 'resort'].includes(c.places[m.at].d), `${m.id} is given in a new district`);
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
  }
  const TRIVIAL = new Set(['talk', 'goto', 'ride', 'pickup', 'post', 'switch']);
  const kinds = new Set(seven.flatMap(m => m.steps.map(s => s.t).filter(t => !TRIVIAL.has(t))));
  assert.ok(kinds.size >= 12, [...kinds].join());
  for (const k of ['detective', 'swap', 'defend', 'blend', 'tail', 'trap', 'deliver', 'collect', 'cable', 'train', 'case', 'heist', 'race', 'stealth', 'chase', 'bag', 'mini']) assert.ok(kinds.has(k), k);
  const chaseEnd = seven.filter(m => { const ms = m.steps.filter(s => !TRIVIAL.has(s.t)); return ['chase', 'bag'].includes(ms[ms.length - 1].t); });
  assert.ok(chaseEnd.length * 3 <= seven.length, `${chaseEnd.length} chase climaxes`);
  // the branch cards (blend, trap, detective) and the smart guards (case, heist, swap, stealth) are all here
  assert.ok(seven.filter(m => m.steps.some(s => BRANCHES[s.t])).length >= 3, 'branch choices');
  assert.ok(seven.some(m => m.steps.some(s => s.t === 'deliver' && s.fines)), 'a job that uses the fines');
  assert.ok(seven.some(m => m.steps.some(s => s.t === 'swap' && s.skin === 'myna')) && seven.some(m => m.steps.some(s => s.t === 'defend' && s.gang === 'myna')), 'the mynahs star');
  assert.equal(SIDE.filter(m => ['k11', 'k12', 'k13'].includes(m.id)).length, 3);
  for (const id of ['k11', 'k12', 'k13']) assert.ok(['india', 'glam', 'resort'].includes(c.places[MISSION[id].at].d), `${id} in a new district`);
});

test('Bazaar Night: every ticket or warning while carrying the attar costs time; the wardens are out in force', () => {
  const { w, run, st } = inJob('m41', 'deliver', { diff: 'easy' });
  assert.ok(st.fines > 0);
  idle(w, 4); assert.ok(w.patrols.length >= 4, `${w.patrols.length} wardens out`);
  // a slip in front of a warden: on Easy it's only a warning, but it still costs the seconds
  const before = run.timer; w.fineCd.clear(); w.ticket = null;
  offence(w, 'jaywalk', w.p.x, w.p.y, true);
  assert.ok(Math.abs(run.timer - (before - st.fines)) < 0.01, `${before} -> ${run.timer}`);
  assert.ok(w.fx.some(f => f.t === 'fine-time'));
  // other deliveries keep the Easy rule: a warning, no time lost
  const { w: w2, run: r2 } = inJob('m36', 'deliver', { diff: 'easy' }); const b2 = r2.timer; offence(w2, 'jaywalk', w2.p.x, w2.p.y, true); assert.equal(r2.timer, b2);
});

test('the cable step: a job rides the cable car and goes on from the other end', () => {
  const { w, run, st } = inJob('m42', 'cable');
  assert.equal(st.to, 'cable-sentosa'); const tg = run.target(); const hb = w.c.places['cable-harbour']; assert.ok(tg && dist(tg[0], tg[1], hb.x, hb.y) < 2, 'the route line leads to HarbourFront');
  at(w, 'cable-harbour'); assert.equal(w.near?.kind, 'cable'); w.interact(); w.ui = null; w.step(NO_INPUT, DT);
  assert.notEqual(run.cur?.t, 'cable', 'the job moves on');
});

test('the solver finishes every chapter-seven job and the new Hawker Tales; the casual bot finishes the finale', () => {
  for (const m of [...MISSIONS.filter(m => m.ch === 7), ...SIDE.filter(m => ['k11', 'k12', 'k13'].includes(m.id))]) { const r = playMission(m.id, 'perfect', 1); assert.ok(r.won, `${m.id}: ${JSON.stringify(r).slice(0, 200)}`); }
  const r = playMission('m45', 'casual', 2); assert.ok(r.won, JSON.stringify(r).slice(0, 200));
});

test('the Island Lights ending plays once, after Crow Number Nine is stopped; the chapter-seven trophies', () => {
  const w = world({ done: allDone.filter(id => id !== 'm45') });
  w.finishMission(MISSION.m45); assert.ok(w.fx.some(f => f.t === 'finale' && f.kind === 'lights'));
  w.s.story.lights = true; w.fx = []; w.replaying = true; w.finishMission(MISSION.m45); assert.ok(!w.fx.some(f => f.t === 'finale'));
  const s = newSave(); s.done = allDone; assert.ok(checkTrophies(s).includes('Island Lights'));
  assert.equal(TROPHIES.length, 74);
  s.stats.mynahs = 10; s.stats.cable = 3; const got = checkTrophies(s); assert.ok(got.includes('Quiet Please') && got.includes('Sky Ride'));
});

test('save v10: a v9 save keeps every job, medal and coin; the new counts start at zero; the ending is unseen', () => {
  assert.ok(SAVE_VERSION >= 11); assert.ok(OLD_KEYS.includes('jade-street-v10') && OLD_KEYS.includes('jade-street-v9'));
  const v9 = { ...newSave(3), v: 9, cash: 912, done: allDone.slice(0, 35), medals: { m12: { m: 3, t: 50, plays: 2 }, m35: { m: 2, t: 300, plays: 1 } } };
  delete v9.stats.cable; delete v9.stats.ferry; delete v9.stats.lamps; delete v9.stats.kuih; delete v9.stats.mynahs; delete v9.story.lights;
  const s = loadSave(JSON.stringify(v9));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.cash, 912); assert.deepEqual(s.done, v9.done); assert.equal(s.medals.m12.m, 3); assert.equal(s.medals.m35.m, 2);
  for (const k of ['cable', 'ferry', 'lamps', 'kuih', 'mynahs']) assert.equal(s.stats[k], 0, k);
  assert.equal(s.story.lights, false); assert.equal(chapterOf(s), 7);
  assert.equal(s.rep.india, 0); assert.equal(s.rep.resort, 0);
});

test('the new people stand in the world with a line each, and the mynah roost is on the map', () => {
  for (const id of ['raju', 'malar', 'kancil', 'wangi', 'duyung', 'helang', 'bising', 'nine']) { assert.ok(PEOPLE[id], id); assert.ok(CHAT[id], `${id} chat`); }
  const w = world(); const cast = castOf(w);
  for (const id of ['raju', 'malar', 'kancil', 'wangi', 'duyung', 'helang', 'bising']) assert.ok(cast.some(c => c.id === id), `${id} stands at their place`);
  const [rx, ry] = city().isle.hideouts.myna; assert.equal(districtAt(Math.floor(rx / T), Math.floor(ry / T)), 'glam');
  assert.ok(city().props.some(p => p.sprite === 'hide-myna'));
  void S; void linkNear; void linkGo; void linkById; void stationById;
});

console.log(`jade (ninth pass): ${n} tests ok`);
await import('./jade-fix9.mjs');
await import('./jade-empire.mjs');

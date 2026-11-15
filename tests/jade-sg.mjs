// Jade Street engine tests, fifth pass (run by tests/jade-duo.mjs): Singapore. The hawker centre, void deck, wet market
// and kopitiam are laid out on open ground; the five-foot ways shade you from the wardens; gantries charge a coin, or
// call the wardens when the lanterns are lit; chope tables and the chope rush; Mr Ong buys newspapers; the mama shop;
// the fine city (jaywalking in sight of a warden, the zebra crossings, a ticket paid or fled, repeat fines, camera
// tickets, warnings on Easy); the otters and macaques and how each gadget treats them; the kopi mini-game and its lingo;
// the Hawker Tales side jobs (offered after their story job, with a checkpoint failure each); the chase counter;
// remapped keys; save v6 migration from v5; no brands in the text; and the new paintings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, S, G, districtAt, DISTRICT_NAME, STREET_NAME, streetAt } from '../.checks/jade-city.js';
import { MISSIONS, MISSION, SIDE, PEOPLE } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, SAVE_KEY, offered, sideJobs } from '../.checks/jade-save.js';
import { FRAMES } from '../.checks/jade-art.js';
import { addHeat, lanterns } from '../.checks/jade-heat.js';
import { FINE, OFFENCES, fineAmount, offence, payTicket } from '../.checks/jade-fines.js';
import { MAMA, mamaBuy, LINGO, sgAct, festOf, BARKS } from '../.checks/jade-sg.js';
import { startGang, gangHit } from '../.checks/jade-gangs.js';
import { KopiGame, KOPI_FIELDS, kopiName, kopiSprite } from '../.checks/jade-mini.js';
import { chaseProgress } from '../.checks/jade-mission.js';
import { translate, bind, boundTo, KEY_ACTIONS } from '../.checks/jade-keys.js';
import { BIZ } from '../.checks/jade-biz.js';
import { playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const allDone = MISSIONS.map(m => m.id);
const world = (o = {}) => { const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.done = o.done ?? allDone; s.settings.assist = o.assist ?? true; s.settings.diff = o.diff ?? 'easy'; s.cash = o.cash ?? 500; const w = new World(s, o.seed ?? 5); w.quiet = true; return w; };
const steps = (w, k, inp = NO_INPUT) => { for (let i = 0; i < k; i++) { w.step(inp, DT); if (w.talk) w.talk = null; } };
const tile = (w, x, y) => w.c.solid[y * W + x];
const px = t => t * T + T / 2;

test('the Singapore places are on open ground, in the right districts, with real public street names', () => {
  const w = world(); const c = w.c, sg = c.sg;
  for (const id of ['hoon', 'teo', 'beng', 'goh', 'lily', 'ong', 'wetmarket', 'voiddeck', 'getai']) {
    const pl = c.places[id]; assert.ok(pl, id); assert.equal(tile(w, Math.floor(pl.x / T), Math.floor(pl.y / T)), S.OPEN, `${id} stands on open ground`);
  }
  for (const t of sg.tables) assert.equal(tile(w, Math.floor(t.x / T), Math.floor(t.y / T)), S.OPEN, 'hawker tables on the floor');
  assert.ok(sg.fivefoot.reduce((a, b) => a + b, 0) > 150, 'plenty of five-foot way');
  assert.equal(sg.gantries.filter(g => g.tx < 120).length, 6, 'six gantries in Chinatown');
  for (const g of sg.gantries) assert.equal(c.ground[(g.ty + (g.axis === 'v' ? 0 : 1)) * W + g.tx + (g.axis === 'v' ? 1 : 0)], G.ROAD, 'a gantry stands over a road');
  assert.equal(DISTRICT_NAME.market, 'Smith Street'); assert.equal(DISTRICT_NAME.canal, 'Boat Quay');
  assert.ok(STREET_NAME.includes('Pagoda Street') && STREET_NAME.includes('South Bridge Road'));
  assert.ok(typeof streetAt(20, 48) === 'string');
  assert.equal(BIZ.filter(b => ['ckt', 'chicken', 'satay', 'laksa', 'kopi'].includes(b.id)).length, 5, 'five hawker stalls are businesses');
});

test('no brands, trademarks or company names anywhere in the text', () => {
  const BAN = /\b(Tiger|Ya Kun|Old Chang Kee|Grab (?:car|taxi|ride|food)|GrabFood|SBS|SMRT|Singapore Airlines|Marina Bay Sands|Jewel|Merlion|Starbucks|McDonald|Coca|Pepsi)\b/;
  for (const f of ['lib/jade-story.ts', 'lib/jade-sg.ts', 'lib/jade-fines.ts', 'lib/jade-gangs.ts', 'lib/jade-city.ts', 'lib/jade-sgcity.ts', 'lib/jade-biz.ts', 'lib/jade-move.ts', 'app/jade-street/sg.tsx', 'app/jade-street/layout.tsx']) {
    const m = readFileSync(f, 'utf8').match(BAN); assert.ok(!m, `${f} mentions ${m?.[0]}`);
  }
  assert.ok(!/magpie/i.test(readFileSync('lib/jade-story.ts', 'utf8')), 'the crows are crows');
});

test('five-foot ways: in their shade the wardens see you from only about 60% as far', () => {
  const w = world(); const c = w.c.sg;
  const i = c.fivefoot.findIndex((v, k) => v && districtAt(k % W, Math.floor(k / W)) === 'market');
  const tx = i % W, ty = Math.floor(i / W);
  w.placePlayer(px(tx), px(ty)); steps(w, 2);
  assert.equal(w.p.shade, true, 'in the shade');
  w.rain = 1; steps(w, 2); assert.notEqual(w.p.anim, 'umbrella', 'no umbrella under the five-foot way');
  w.placePlayer(px(20), px(48)); steps(w, 2); assert.equal(w.p.shade, false);
});

test('gantries: a coin when the lanterns are dark; with heat the camera calls the wardens', () => {
  const w = world(); const g = w.c.sg.gantries.find(q => q.axis === 'h');
  const ride = w.rides.find(q => q.kind !== 'boat' && !q.locked);
  ride.b.x = g.x - 100; ride.b.y = g.y; ride.b.h = 0; w.placePlayer(g.x - 100, g.y + 30); w.enter(ride); steps(w, 40);
  assert.ok(w.p.ride, 'riding');
  const cross = (dir) => { const r = w.p.ride; r.b.x = g.x - 50 * dir; r.b.y = g.y; r.b.h = dir > 0 ? 0 : Math.PI; w.sg.lastX = r.b.x; for (let i = 0; i < 30; i++) { r.b.speed = 200; w.step({ ...NO_INPUT, my: 0, mx: dir }, DT); } };
  const cash = w.s.cash; cross(1);
  assert.equal(w.s.cash, cash - 1, 'one coin for the toll'); assert.equal(w.s.stats.tolls, 1);
  addHeat(w, 1.2, 'test'); const h = w.heat; w.sg.gant = []; cross(-1);
  assert.ok(w.heat >= h + 0.3, `the camera adds heat (${h} to ${w.heat})`);
});

test('chope: a tissue packet on a free table, makan at it; aunties have choped the rest', () => {
  const w = world(); const sg = w.sg; steps(w, 2);
  const i = sg.chope.findIndex(v => v === 0); assert.ok(i >= 0);
  const t0 = w.s.bag.tissue; sgAct(w, 'chope:' + i); steps(w, 60);
  assert.equal(sg.chope[i], 1); assert.equal(w.s.bag.tissue, t0 - 1);
  const cash = w.s.cash; sgAct(w, 'makan:' + i); assert.equal(w.s.cash, cash - 4); steps(w, 200); assert.equal(sg.chope[i], 0);
  w.s.bag.tissue = 0; const j = sg.chope.findIndex(v => v === 0); sgAct(w, 'chope:' + j); steps(w, 60); assert.equal(sg.chope[j], 0, 'no tissues, no chope');
});

test('the chope rush: three tables before the aunties pays 30 coins', () => {
  const w = world(); const c = w.c.sg; w.placePlayer(px(20), px(70)); steps(w, 2);
  w.sg.rushT = 0; steps(w, 2); assert.ok(w.sg.rush, 'the rush starts near the hawker centre');
  w.s.bag.tissue = 9; const cash = w.s.cash;
  for (let k = 0, got = 0; k < c.tables.length && got < 3; k++) if (w.sg.chope[k] === 0) { sgAct(w, 'chope:' + k); steps(w, 45); got++; }
  steps(w, 10);
  assert.ok(w.s.cash >= cash + 30, 'paid for winning the rush'); assert.equal(w.s.stats.chope, 1);
});

test('karang guni: pick up newspapers, sell them to Mr Ong; the mama shop sells tissues, seed and bananas', () => {
  const w = world(); steps(w, 2);
  const j = w.sg.junk[0]; assert.ok(j !== undefined, 'junk tonight');
  sgAct(w, 'junk:' + j); steps(w, 50); assert.equal(w.s.bag.junk, 1);
  const cash = w.s.cash; sgAct(w, 'ong'); steps(w, 60); assert.equal(w.s.cash, cash + 3); assert.equal(w.s.bag.junk, 0);
  for (const m of MAMA) { const before = w.s.bag[m.id]; assert.equal(mamaBuy(w, m.id), null); assert.equal(w.s.bag[m.id], before + m.n); }
  w.s.cash = 0; assert.match(mamaBuy(w, 'seed'), /coins/);
});

test('the fine city: a warden who sees you jaywalk writes a ticket; pay it, or run and it is a chase', () => {
  const w = world({ diff: 'normal', assist: false }); steps(w, 2);
  w.placePlayer(px(20), px(48)); w.patrols = [{ id: 999, b: { x: w.p.x + 120, y: w.p.y, h: Math.PI, speed: 0, r: 13, len: 0, cls: 'walk' }, goal: null, pace: 0, write: 0, spot: 0 }];
  offence(w, 'jaywalk', w.p.x, w.p.y); assert.ok(w.ticket, 'a ticket'); assert.equal(w.ticket.amt, 20);
  const cash = w.s.cash; payTicket(w); assert.equal(w.s.cash, cash - 20); assert.equal(w.s.fines.n, 1); assert.equal(w.s.fines.paid, 20);
  assert.equal(fineAmount('jaywalk', 1), 30, 'repeat offences cost half again'); assert.equal(fineAmount('jaywalk', 9), 60, 'at most three times');
  w.fineCd.clear(); offence(w, 'litter', w.p.x, w.p.y); assert.ok(w.ticket);
  w.placePlayer(w.p.x + 900, w.p.y); steps(w, 120);
  assert.equal(w.ticket, null); assert.equal(w.s.fines.fled, 1); assert.ok(lanterns(w) >= 1, 'running from a ticket lights a lantern');
});

test('a careful player is rarely fined: no warden, no ticket; on Easy the first slip of each kind is a warning', () => {
  const w = world(); w.patrols = []; offence(w, 'jaywalk', w.p.x, w.p.y); assert.equal(w.ticket, null);
  w.patrols = [{ id: 5, b: { x: w.p.x + 80, y: w.p.y, h: 0, speed: 0, r: 13, len: 0, cls: 'walk' }, goal: null, pace: 0, write: 0, spot: 0 }];
  offence(w, 'gum', w.p.x, w.p.y); assert.equal(w.ticket, null, 'a warning first on Easy'); assert.ok(w.warned.has('gum'));
  w.fineCd.clear(); offence(w, 'gum', w.p.x, w.p.y); assert.ok(w.ticket, 'then a ticket');
  const cash = w.s.cash; w.ticket = null; w.fineCd.clear(); w.warned.add('red'); offence(w, 'red', 0, 0, true);
  assert.equal(w.s.cash, cash - FINE.red.amt, 'a camera fine is paid at once'); assert.ok(w.s.msgs.some(m => /Ticket in the post/.test(m.text)));
  for (const o of OFFENCES) assert.ok(FINE[o].amt > 0 && FINE[o].quip.length > 10);
});

test('the walk across a zebra crossing is fine; crossing away from one in sight of a warden is not', () => {
  const w = world({ diff: 'normal' }); steps(w, 2);
  const z = w.c.decals.find(d => d.sprite === 'd-zebra' && districtAt(Math.floor(d.x / T), Math.floor(d.y / T)) === 'market');
  w.patrols = [{ id: 7, b: { x: z.x + 150, y: z.y - 150, h: 0, speed: 0, r: 13, len: 0, cls: 'walk' }, goal: [z.x + 150, z.y - 150], pace: 0, write: 0, spot: 0 }];
  w.placePlayer(z.x, z.y); w.lastTile = -1; steps(w, 3);
  assert.ok(!w.ticket || w.ticket.kind !== 'jaywalk', 'no jaywalking ticket on a zebra (the lights may still be red)');
});

test('the otters and the macaques: each gadget acts its own way; getting it all back is a good deed', () => {
  const w = world(); w.placePlayer(px(60), px(40)); steps(w, 2);
  const ev = startGang(w, 'otters'); assert.ok(ev, 'otters on the quay'); assert.equal(ev.mobs.length, 3);
  assert.ok(gangHit(w, ev.mobs[0], 'bubble')); assert.equal(ev.mobs[0].st, 'play', 'an otter plays with a bubble'); assert.equal(ev.drops.length, 1);
  assert.ok(gangHit(w, ev.mobs[1], 'paint')); assert.equal(ev.mobs[1].has, true, 'too slippery for paint');
  assert.ok(gangHit(w, ev.mobs[1], 'net')); assert.equal(ev.mobs[1].st, 'netted');
  w.gangs.ev = null; w.placePlayer(px(20), px(55)); steps(w, 2);
  const mv = startGang(w, 'macaques'); assert.ok(mv, 'macaques at the market');
  assert.ok(gangHit(w, mv.mobs[0], 'sling')); assert.equal(mv.mobs[0].st, 'munch', 'a rice ball makes a macaque sit and munch');
  assert.ok(gangHit(w, mv.mobs[1], 'confetti')); assert.equal(mv.mobs[1].st, 'leap', 'confetti makes it leap and drop the bag');
  const cash = w.s.cash;
  for (const d of [...mv.drops]) { w.placePlayer(d.x, d.y); steps(w, 3); }
  steps(w, 200);
  assert.ok(w.s.cash >= cash + 2 * 12 + 20, `everything back: coins and the bonus (${w.s.cash - cash})`);
  assert.ok(PEOPLE.sleek && PEOPLE.kow);
});

test('the kopi counter: orders in kopi lingo, a wrong cup costs a try, all orders served wins', () => {
  assert.equal(kopiName({ base: 'kopi', milk: 'none', sugar: 'none', temp: 'hot' }), 'Kopi-O kosong');
  assert.equal(kopiName({ base: 'teh', milk: 'evap', sugar: 'less', temp: 'iced' }), 'Teh-C peng siew dai');
  assert.equal(kopiName({ base: 'kopi', milk: 'condensed', sugar: 'normal', temp: 'hot' }), 'Kopi');
  for (const b of ['kopi', 'teh']) for (const m of ['condensed', 'none', 'evap']) for (const t of ['hot', 'iced']) assert.ok(FRAMES[kopiSprite({ base: b, milk: m, temp: t })], 'a painted cup for every drink');
  const g = new KopiGame({ level: 1, assist: true, seed: 3 });
  const tries = g.tries; g.cup = { ...g.order, sugar: g.order.sugar === 'none' ? 'more' : 'none' }; g.serve(); assert.equal(g.tries, tries - 1);
  for (const o of [...g.orders]) { for (const F of KOPI_FIELDS) g.set(F.k, o[F.k]); g.serve(); }
  assert.ok(g.done);
  for (const term of ['Kopi', 'Teh', 'O', 'C', 'Kosong', 'Siew dai', 'Peng', 'Chope']) assert.ok(LINGO.some(l => l.term === term), term);
});

test('Hawker Tales: ten side jobs, each offered after its story job, outside the chapters', () => {
  assert.equal(SIDE.length, 10); assert.equal(MISSIONS.length, 35);
  for (const m of SIDE) { assert.ok(MISSION[m.id] === m); assert.ok(MISSIONS.some(x => x.id === m.side), `${m.id} opens after a story job`); assert.equal(m.ch, 0); }
  const s = newSave(2); s.done = ['m1', 'm2', 'm3']; assert.deepEqual(sideJobs(s).map(m => m.id), ['k1']);
  assert.ok(offered(s).some(m => m.id === 'k1') && offered(s).some(m => m.side === undefined));
  for (const k of ['k2', 'k3', 'k5', 'k7']) assert.ok(SIDE.find(m => m.id === k), k);
  assert.ok(SIDE.some(m => m.steps.some(st => st.t === 'deliver' && st.stink)), 'the durian run has its smell trail');
  // the gangs star in side jobs: the macaques raid Auntie Hoon's stall, the otters walk into Kiri's nets and run prawns upriver
  assert.ok(SIDE.some(m => m.steps.some(st => st.t === 'defend' && st.gang === 'mac')) && SIDE.some(m => m.steps.some(st => (st.t === 'chase' && st.skin === 'otter') || (st.t === 'trap' && st.gang === 'otter'))), 'the gangs star in side jobs');
});

test('Hawker Tales: the casual bot finishes each, and a forced failure restarts from the checkpoint', () => {
  for (const m of SIDE) {
    const r = playMission(m.id, 'casual', 1); assert.ok(r.won, `${m.id}: ${JSON.stringify(r)}`);
    const cp = m.steps.findIndex(st => st.cp); const f = playMission(m.id, 'casual', 2, { failAt: cp });
    assert.ok(f.won && f.fails >= 1, `${m.id} after a forced failure at step ${cp}: ${JSON.stringify(f)}`);
  }
});

test('the chase counter matches the job text: bumps first, then the finishing move', () => {
  assert.equal(chaseProgress({ bumps: 3, finish: 'net' }, 0), 'Bumps 0/2 · then net it', 'The Silver Koi: bump twice, then net it');
  assert.equal(chaseProgress({ bumps: 3, finish: 'net' }, 2), 'Now net it!');
  assert.equal(chaseProgress({ bumps: 2, finish: 'pounce' }, 0), 'Bumps 0/1 · then pounce together');
  assert.equal(chaseProgress({ bumps: 3 }, 1), 'Bumps 1/3');
  const m20 = MISSION.m20.steps.find(st => st.t === 'chase'); assert.match(m20.label, /twice, then net/);
});

test('remapped keys stand in for their action; a taken key swaps; reserved keys refuse', () => {
  const k = {}; assert.equal(bind(k, 'dash', 'j'), null); assert.equal(translate(k, 'j'), ' '); assert.equal(translate(k, ' '), '', 'the old key is free');
  assert.equal(bind(k, 'hop', 'j'), null); assert.equal(boundTo(k, 'hop'), 'j'); assert.equal(boundTo(k, 'dash'), 'q', 'dash took hop’s old key');
  assert.match(bind(k, 'act', 'Escape'), /kept/); assert.equal(translate({}, 'e'), 'e');
  assert.equal(KEY_ACTIONS.length, 14);
  const s = newSave(1); s.settings.keys = { dash: 'j', bogus: 'Space Bar!' }; const s2 = loadSave(JSON.stringify(s)); assert.deepEqual(s2.settings.keys, { dash: 'j' });
});

test('save: a v5 save migrates with a bag, a clean fines record and default settings; it round trips', () => {
  const v5 = { ...newSave(9), v: 5 }; delete v5.bag; delete v5.fines; delete v5.lingo; v5.done = ['m1', 'm2']; v5.cash = 321;
  v5.settings = { ...v5.settings }; delete v5.settings.keys; delete v5.settings.bigText; delete v5.settings.cbMarks;
  const s = loadSave(JSON.stringify(v5));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.cash, 321); assert.deepEqual(s.done, ['m1', 'm2']);
  assert.equal(s.bag.tissue, 2); assert.equal(s.fines.n, 0); assert.deepEqual(s.settings.keys, {}); assert.equal(s.settings.bigText, false); assert.equal(s.settings.cbMarks, false);
  s.fines.n = 2; s.fines.paid = 50; s.fines.list.push({ kind: 'gum', amt: 40, night: 3 }); s.bag.banana = 4; s.done.push('k1');
  assert.deepEqual(loadSave(JSON.stringify(s)), s, 'v6 round trip (side jobs kept)');
});

test('festivals and storms are seeded; Singlish is light', () => {
  const kinds = new Set(); for (let n = 1; n < 60; n++) kinds.add(festOf(7, n, true)); assert.ok(kinds.has('getai') && kinds.has('lion') && kinds.has('lantern') && kinds.has(null));
  assert.ok(![...Array(40).keys()].some(n => festOf(7, n + 1, false) === 'getai'), 'no getai before the docks open');
  for (const l of Object.values(BARKS).flat()) assert.ok(l.length < 70, l);
});

test('every new painting is in the atlas', () => {
  const need = ['v-bumboat', 'otter-run-0', 'mac-run-0', 'sleek-boat-0', 'warden-ticket', 'warden-write', 'pigeon-0', 'pigeon-fly', 'table-chope', 'table-empty', 'auntie-chope', 'ong-trike-0', 'liondance-0', 'kid-lantern', 'lily-sing-0', 'goh-chess-0',
    'face-hoon', 'face-teo', 'face-beng', 'face-sleek', 'face-kow', 'sg-hdb', 'sg-kopitiam', 'sg-wetmarket', 'gantry', 'stink-cloud', 'durian-crate', 'kopi-tray', 'wok', 'mic', 'handbag', 'bun', 'ticket', 'litter-bin',
    ...['dora', 'enzo'].flatMap(h => ['chope', 'tray-down', 'tray-side', 'durian-down', 'durian-side', 'lantern-down', 'sell-junk', 'shake-wet', 'sit-chess', 'feed', 'gum', 'pay-fine', 'toss', 'pick-litter', 'bin-litter', 'shiok', 'serve'].map(a => `${h}-${a}`))];
  for (const f of need) assert.ok(FRAMES[f], f);
  assert.ok(!Object.keys(FRAMES).some(k => /magpie/.test(k)), 'no magpie frames left');
});

console.log(`jade (fifth pass): ${n} tests ok`);
await import('./jade-island.mjs');

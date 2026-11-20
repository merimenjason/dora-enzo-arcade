// Jade Street, the eleventh pass: procedural contracts. The generator (lib/jade-proc.ts) is deterministic and only
// makes valid jobs (over a thousand seeds, with Chinatown alone open and with the whole island): every place and spot in
// an open district and reachable on foot from the giver, two to four core steps, compatible modifiers, painted items and
// faces, clean text. The phone's contracts (lib/jade-contracts.ts): three offers, a fresh one after each finish and a new
// deal each night, the contract of the day the same for everyone, the rivals' pushback and its retake, the modifiers in
// play (no rides, partner busy, storm, graveyard shift), the giver's bark on a fail, the v11 → v12 save migration,
// jobCounts and the three new trophies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { city, T, W, districtAt, CT_DISTRICTS } from '../.checks/jade-city.js';
import { field } from '../.checks/jade-nav.js';
import { MISSIONS, SIDE, PEOPLE, jobCounts } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_KEY, OLD_KEYS, SAVE_VERSION, TROPHIES, checkTrophies, openDistricts, offered } from '../.checks/jade-save.js';
import { bizRate, BIZ } from '../.checks/jade-biz.js';
import { genContract, makeCtx, contractMission, GIVERS, VOICE, GANG, ITEMS, KINDS, MODS, MOD_NAME, MOD_TEXT, KIND_NAME } from '../.checks/jade-proc.js';
import { listContracts, startContract, contractDone, contractNight, contractOf, dailyRef, tierOf, starsFor, contestFactor, routeContract, contractTarget, nextContract, dayPaid, CONTRACTS_OPEN } from '../.checks/jade-contracts.js';
import { tagOption } from '../.checks/jade-tag.js';
import { FRAMES } from '../.checks/jade-art.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const ALL = ['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort'];
/** a save past the first ending (or the whole story), reputation everywhere */
function past(seed = 5, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true;
  s.done = o.all ? [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)] : MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === CONTRACTS_OPEN) + 1).map(m => m.id);
  for (const d of ALL) s.rep[d] = 50; s.cash = 500; s.settings.assist = o.assist ?? true; s.settings.diff = o.assist === false ? 'normal' : 'easy';
  return s;
}
const world = (s, seed = 9) => { const w = new World(s, seed); w.quiet = true; w.event = { day: o_day, need: 0 }; return w; };
const o_day = '2026-11-16';
const idle = (w, sec) => { for (let i = 0; i < sec * 60; i++) w.step(NO_INPUT, DT); };
// the painted item frames the scene draws (lib/jade-scene.ts itemSprite)
const SCENE = readFileSync(new URL('../lib/jade-scene.ts', import.meta.url), 'utf8');
const ITEM_MAP = Object.fromEntries([...SCENE.match(/export function itemSprite[^]*?\n}/)[0].matchAll(/(\w+): '([\w-]+)'/g)].map(m => [m[1], m[2]]));
const itemFrame = it => FRAMES[ITEM_MAP[it] ?? it] ? (ITEM_MAP[it] ?? it) : null;

/** every tile pair and place name a step points at */
function spotsOf(st) {
  const tiles = [], places = [];
  const walk = (v, key) => {
    if (Array.isArray(v)) { if (v.length === 2 && v.every(x => Number.isInteger(x)) && key !== 'lines') tiles.push(v); else v.forEach(x => walk(x, key)); }
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    else if (typeof v === 'string' && (key === 'at' || key === 'to' || key === 'from') && v !== 'loot' && !/\s/.test(v)) places.push(v);
  };
  for (const [k, v] of Object.entries(st)) if (k !== 'lines' && k !== 'label') walk(v, k);
  return { tiles, places };
}
/** a contract is valid: it stands up in the city it was made for */
function checkContract(ctx, k, open) {
  const gp = c.places[k.giver]; assert.ok(gp, `${k.id}: giver ${k.giver} has a place`);
  assert.ok(open.includes(gp.d) || k.ref.contest, `${k.id}: giver's district open`);
  assert.ok(GIVERS.includes(k.giver) && PEOPLE[k.giver], `${k.id}: a known giver`);
  assert.ok(FRAMES[PEOPLE[k.giver].face] && FRAMES[`npc-${k.giver}-idle-0`], `${k.id}: the giver is painted, face and body`);
  assert.ok(k.core.length >= 2 && k.core.length <= 4, `${k.id}: ${k.core.length} core steps (${k.core.join()})`);
  assert.ok(k.steps.length >= 3 && k.steps[0].t === 'talk' && k.steps.at(-1).t === 'talk');
  const f = field(c, 'foot', Math.floor(gp.x / T), Math.floor(gp.y / T), new Set(open));
  const reach = ([tx, ty]) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (f.dist[(ty + dy) * W + tx + dx] >= 0) return true; return false; };
  for (const st of k.steps) {
    if (st.t === 'talk') { for (const l of st.lines) assert.ok(typeof l[1] === 'string' && l[1].length > 3 && !/undefined|NaN|\bA [aeiou]/.test(l[1]), `${k.id}: line "${l[1]}"`); continue; }
    assert.ok(st.label && !/undefined|NaN/.test(st.label), `${k.id}: label ${st.label}`);
    const { tiles, places } = spotsOf(st);
    for (const t of tiles) {
      if (st.t === 'race' && st.ride !== 'foot' && st.ride !== undefined) continue; // a road race: checked by its own field
      assert.ok(open.includes(districtAt(t[0], t[1])), `${k.id} ${st.t}: tile ${t} in an open district`);
      if (st.t !== 'race') assert.ok(reach(t), `${k.id} ${st.t}: tile ${t} reachable on foot from ${k.giver}`);
    }
    for (const p of places) if (c.places[p]) assert.ok(open.includes(c.places[p].d), `${k.id} ${st.t}: place ${p} open`);
    if ('item' in st && st.item && st.t !== 'collect') assert.ok(itemFrame(st.item), `${k.id} ${st.t}: item ${st.item} painted`);
  }
  assert.ok(k.pay > 0 && Number.isInteger(k.pay) && k.rep >= 3);
  assert.ok(k.title && k.blurb && !/undefined|NaN|\ba [aeiou]|\bA [aeiou]/.test(k.title + ' ' + k.blurb), `${k.id}: text "${k.title}" "${k.blurb}"`);
  // modifiers only where they fit
  for (const m of k.mods) assert.ok(MODS.includes(m));
  if (k.mods.includes('foot')) assert.ok(!['race', 'heist'].includes(k.kind) || k.steps.every(s => s.t !== 'ride'));
  if (k.mods.includes('solo')) assert.ok(!['heist', 'blend', 'stand', 'parade', 'retake'].includes(k.kind));
  if (k.mods.includes('timer')) assert.ok(['courier', 'crack', 'sweep', 'sleuth', 'undercover'].includes(k.kind));
  assert.ok(k.mods.length <= 2 && new Set(k.mods).size === k.mods.length);
}

test('the tables: givers, voices, gangs, items, kinds and modifiers are complete', () => {
  for (const g of GIVERS) { assert.ok(c.places[g], `place for ${g}`); assert.ok(VOICE[g] && VOICE[g].hi.length && VOICE[g].ok.length && VOICE[g].oops.length, `voice for ${g}`); assert.ok(PEOPLE[g]?.face, `face for ${g}`); }
  assert.ok(GIVERS.filter(g => FRAMES[PEOPLE[g].face] && FRAMES[`npc-${g}-idle-0`]).length >= 16, 'most givers are painted, face and body (the rest give no contracts until they are)');
  for (const [id, gg] of Object.entries(GANG)) { assert.ok(gg.name && gg.one && gg.taunt.length && gg.brag.length, id); assert.ok(FRAMES[gg.boss] || FRAMES['face-' + gg.boss] || PEOPLE[gg.boss], `boss face for ${id}`); }
  for (const it of ITEMS) assert.ok(itemFrame(it.id), `item ${it.id} painted`);
  for (const k of KINDS) assert.ok(KIND_NAME[k]);
  for (const m of MODS) assert.ok(MOD_NAME[m] && MOD_TEXT[m]);
});

test('determinism: the same reference makes the same contract, in a fresh context too', () => {
  for (let s = 0; s < 60; s++) {
    const ref = { seed: 1000 + s * 37, tier: s % 7, stars: 1 + (s % 3), open: s % 2 ? ALL : CT_DISTRICTS };
    const a = genContract(makeCtx(ref.open), ref), b = genContract(makeCtx(ref.open), { ...ref });
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), `seed ${ref.seed}`);
    // a forced giver and kind (as the save stores them) rebuild it exactly
    const c2 = genContract(makeCtx(ref.open), { ...ref, giver: a.giver, kind: a.kind });
    assert.equal(c2.giver, a.giver); assert.equal(c2.kind, a.kind);
  }
});

test('validity: 1200 seeds, Chinatown alone and the whole island, every star', () => {
  const kinds = {}, mods = {}; let fall = 0;
  for (const [open, nSeeds] of [[CT_DISTRICTS, 500], [ALL, 700]]) {
    const ctx = makeCtx(open);
    for (let s = 0; s < nSeeds; s++) {
      const ref = { seed: 50000 + s * 7919, tier: s % 7, stars: 1 + (s % 3), open };
      const k = genContract(ctx, ref); checkContract(ctx, k, open);
      kinds[k.kind] = (kinds[k.kind] ?? 0) + 1; for (const m of k.mods) mods[m] = (mods[m] ?? 0) + 1;
      if (k.title === 'Errand Round') fall++;
    }
  }
  for (const k of KINDS.filter(x => x !== 'retake')) assert.ok((kinds[k] ?? 0) >= 12, `kind ${k} turns up (${kinds[k] ?? 0})`);
  for (const m of MODS) assert.ok((mods[m] ?? 0) >= 20, `modifier ${m} turns up (${mods[m] ?? 0})`);
  assert.ok(fall <= 6, `the fallback is rare (${fall})`);
});

test('every contract line has a mood with a painted portrait for the speaker', () => {
  let lines = 0;
  for (let i = 0; i < 300; i++) {
    const open = i % 2 ? ALL : CT_DISTRICTS, k = genContract(makeCtx(open), { seed: 3000 + i * 131, tier: i % 7, stars: 1 + (i % 3), open });
    for (const st of k.steps) if (st.t === 'talk') for (const [who, , mood] of st.lines) {
      lines++; const speakers = who === 'hero' || who === 'mate' ? ['dora', 'enzo'] : [who];
      for (const sp of speakers) { const base = PEOPLE[sp]?.face ?? `face-${sp}`; assert.ok(FRAMES[base], `${base} painted`); if (mood !== 'calm') assert.ok(FRAMES[`${base}-${mood}`], `${base}-${mood} painted (${k.id})`); }
    }
  }
  assert.ok(lines > 900);
});

test('scaling: pay climbs with stars and tier', () => {
  const avg = (stars, tier) => { let t = 0; for (let s = 0; s < 80; s++) t += genContract(makeCtx(ALL), { seed: 9000 + s, tier, stars, open: ALL }).pay; return t / 80; };
  assert.ok(avg(2, 0) > avg(1, 0) && avg(3, 0) > avg(2, 0)); assert.ok(avg(2, 6) > avg(2, 0) * 1.6);
  assert.deepEqual([0, 1, 2].map(i => starsFor(i, 0)), [1, 1, 2]); assert.deepEqual([0, 1, 2].map(i => starsFor(i, 6)), [2, 2, 3]);
});

test('contracts open after the Phoenix Drum: three offers, a new one after each finish, a new deal each night', () => {
  const early = newSave(3); early.done = ['m1']; const w0 = world(early); assert.equal(listContracts(w0).length, 0);
  const s = past(7), w = world(s);
  const ls = listContracts(w), offers = ls.filter(l => l.tag === 'offer');
  assert.equal(offers.length, 3); assert.equal(new Set(offers.map(l => l.c.giver)).size, 3, 'three different givers');
  const busy = offered(s).map(m => m.giver); for (const l of offers) assert.ok(!busy.includes(l.c.giver), 'not a giver with a story job on offer');
  assert.ok(ls.some(l => l.tag === 'day'), 'the contract of the day');
  // the same save lists the same contracts (they are stored as references and rebuilt)
  const again = loadSave(JSON.stringify(s)), w2 = world(again);
  assert.deepEqual(listContracts(w2).map(l => l.c.id), ls.map(l => l.c.id));
  // finish the first: it is replaced, the others stay
  const before = s.contracts.offers.map(r => r.seed);
  assert.equal(startContract(w, 'o0'), null); assert.ok(w.run?.m.id.startsWith('con-'));
  assert.ok(w.banner.sub.startsWith('Contract'));
  w.run.cleanup(true); w.run = null;
  contractDone(w, `con:o0:${before[0]}`, 80);
  assert.equal(s.contracts.done, 1); assert.notEqual(s.contracts.offers[0].seed, before[0]); assert.deepEqual(s.contracts.offers.slice(1).map(r => r.seed), before.slice(1));
  // a new night: all three fresh
  s.night++; const fresh = listContracts(w).filter(l => l.tag === 'offer').map(l => l.c.ref.seed);
  assert.ok(fresh.every(x => !before.includes(x))); assert.equal(fresh.length, 3);
  // jobCounts and the jobs book read the save
  s.contracts.kinds = { race: 2, heist: 1 }; s.contracts.retaken = 1;
  const jc = jobCounts(s); assert.equal(jc.contracts, 1); assert.equal(jc.contractKinds, 2); assert.equal(jc.retaken, 1);
});

test('the contract of the day: one per date, the same for every player, best time kept, full pay once', () => {
  const a = contractOf(dailyRef('2026-11-16')), b = contractOf(dailyRef('2026-11-16')), d2 = contractOf(dailyRef('2026-11-17'));
  assert.deepEqual(a, b); assert.notEqual(a.ref.seed, d2.ref.seed);
  const w1 = world(past(1)), w2 = world(past(999, { all: true }));
  const l1 = listContracts(w1).find(l => l.tag === 'day'), l2 = listContracts(w2).find(l => l.tag === 'day');
  assert.equal(l1.c.id, l2.c.id); assert.deepEqual(l1.c.steps, l2.c.steps);
  assert.ok(CT_DISTRICTS.includes(l1.c.d));
  const s = w1.s; assert.equal(dayPaid(w1), false);
  startContract(w1, 'day'); assert.equal(w1.run.gig.reward, l1.c.pay); w1.run.cleanup(true); w1.run = null;
  contractDone(w1, `con:day:${l1.c.ref.seed}`, 140); assert.equal(s.contracts.dayBest, 140); assert.equal(dayPaid(w1), true);
  contractDone(w1, `con:day:${l1.c.ref.seed}`, 120); assert.equal(s.contracts.dayBest, 120); assert.equal(s.contracts.dayRuns, 2);
  contractDone(w1, `con:day:${l1.c.ref.seed}`, 160); assert.equal(s.contracts.dayBest, 120);
  startContract(w1, 'day'); assert.equal(w1.run.gig.reward, Math.round(l1.c.pay / 4), 'a replay pays a quarter'); w1.run.cleanup(true); w1.run = null;
  // a new date: a new contract, the record starts again
  w1.event = { day: '2026-11-17', need: 0 }; assert.equal(dayPaid(w1), false);
  assert.ok(checkTrophies(s).includes('cotd') || s.trophies.includes('cotd'));
});

test('pushback: the rivals contest a district you own a property in, its tills drop, the retake wins it back', () => {
  const s = past(11, { all: true }); s.biz.noodle.lvl = 2; const w = world(s);
  const b = BIZ.find(x => x.id === 'noodle');
  let night = 0; while (!s.contracts.contest && night < 60) { s.night++; night++; contractNight(w); }
  assert.ok(s.contracts.contest, 'a contest within a few nights'); assert.ok(night <= 20, `within ${night} nights`);
  const ct = s.contracts.contest; assert.equal(ct.d, b.d);
  assert.equal(contestFactor(s, b.d), 0.75); assert.equal(contestFactor(s, 'temple' === b.d ? 'canal' : 'temple'), 1);
  const open = openDistricts(s), base = { ...s, contracts: { ...s.contracts, contest: null } };
  assert.ok(bizRate(s, 'noodle', open).rate < bizRate(base, 'noodle', open).rate * 0.8);
  s.night += 3; assert.equal(contestFactor(s, b.d), 0.6, 'dug in after three nights');
  // only one contest at a time
  contractNight(w); assert.equal(s.contracts.contest, ct);
  const push = listContracts(w).find(l => l.tag === 'push'); assert.ok(push); assert.equal(push.c.kind, 'retake'); assert.equal(push.c.d, b.d);
  checkContract(makeCtx(open), push.c, open);
  startContract(w, 'push'); w.run.cleanup(true); w.run = null;
  const sub = contractDone(w, `con:push:${push.c.ref.seed}`, 200);
  assert.equal(s.contracts.contest, null); assert.equal(s.contracts.retaken, 1); assert.ok(/yours again/.test(sub));
  assert.equal(contestFactor(s, b.d), 1);
  // no property, no contest
  const s2 = past(12, { all: true }), w3 = world(s2); for (let i = 0; i < 40; i++) { s2.night++; contractNight(w3); } assert.equal(s2.contracts.contest, null);
});

test('in the world: the giver offers the contract in person, the gold line and the plaque lead there, Route me pins it', () => {
  const s = past(21, { all: true }), w = world(s); idle(w, 0.1);
  const l = listContracts(w).find(x => x.tag === 'offer');
  const g = w.cast.find(x => x.id === l.c.giver && x.home); assert.ok(g, 'the giver stands at their place'); assert.ok(g.job?.startsWith('con:'), 'and waves');
  w.placePlayer(g.x, g.y + 30); w.step(NO_INPUT, DT);
  assert.ok(w.near && (w.near.kind === 'contract' || w.near.kind === 'mission'), `a prompt (${w.near?.kind})`);
  const near = []; for (const x of listContracts(w)) { const gg = w.cast.find(y => y.id === x.c.giver); if (gg) near.push(gg); }
  assert.ok(contractTarget(w), 'the gold line has somewhere to go'); assert.ok(nextContract(w));
  const back = [w.p.x, w.p.y]; const far = Object.values(c.places).filter(pl => pl.d === 'market' || pl.d === 'temple').sort((a, b2) => Math.hypot(b2.x - g.x, b2.y - g.y) - Math.hypot(a.x - g.x, a.y - g.y))[0]; w.placePlayer(far.x, far.y + T); w.step(NO_INPUT, DT);
  assert.equal(routeContract(w, l.which), null); assert.equal(s.contracts.pin, l.which); assert.ok(w.waypoint && w.route.length > 2, 'a route line to the giver');
  w.placePlayer(...back); w.step(NO_INPUT, DT);
  assert.equal(nextContract(w).which, l.which, 'the plaque shows the pinned contract');
  if (w.near.kind === 'contract') { w.interact?.(); }
  startContract(w, l.which); assert.ok(w.run); assert.equal(w.run.m.giver, l.c.giver);
  // and a quit leaves the offer where it was
  w.quitJob(); assert.equal(listContracts(w).find(x => x.which === l.which).c.id, l.c.id);
});

test('modifiers in play: no rides, partner busy, storm, graveyard shift; they all end with the job', () => {
  const s = past(31, { all: true }), w = world(s); idle(w, 0.1);
  const mk = mods => { const base = contractOf({ seed: 4242, tier: 2, stars: 2, open: openDistricts(s) }); return { ...base, mods, kind: 'courier' }; };
  w.startMission(contractMission(mk(['foot', 'solo', 'rain', 'night']), true), { key: 'con:test:1', reward: 10, d: 'market' });
  assert.equal(w.rainForce, 0.9); assert.equal(w.dark, true);
  const r = w.rides.find(x => !x.broken && !x.locked); if (r) { w.enter(r); assert.equal(w.p.act, null, 'no climbing on'); }
  assert.equal(tagOption(w), null, 'no tag-team moves with the partner busy');
  w.quitJob(); assert.equal(w.rainForce, null); assert.equal(w.dark, false);
  // a fail: the giver has something to say
  const m = contractMission(mk([]), true); w.startMission(m, { key: 'con:test:2', reward: 10, d: 'market' }); w.drain();
  w.fail('Out of time!'); const fx = w.drain(); assert.ok(fx.some(f => f.t === 'toast' && m.fails.some(x => f.msg.includes(x))), 'the giver barks');
  w.quitJob();
});

test('save v12: a v11 save keeps everything and gets an empty contracts book; junk is repaired', () => {
  assert.ok(SAVE_VERSION >= 12); assert.ok(OLD_KEYS.includes('jade-street-v11'));
  const v11 = { v: 11, seed: 5, cash: 999, night: 30, done: ['m1', 'm25'], medals: { m1: { m: 2, t: 40, plays: 1 } }, biz: { noodle: { lvl: 2, bank: 5, tonight: 0, hist: [], raids: 0, defended: 0 } }, empire: { rank: 2, jobs: { taxi: 1 }, last: {} } };
  const s = loadSave(JSON.stringify(v11));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.cash, 999); assert.deepEqual(s.done, v11.done); assert.equal(s.biz.noodle.lvl, 2); assert.equal(s.empire.rank, 2);
  assert.deepEqual(s.contracts.offers, []); assert.equal(s.contracts.done, 0); assert.equal(s.contracts.contest, null);
  // a v12 save round-trips its contracts
  s.contracts.offers = [{ seed: 12345, tier: 2, stars: 2, open: ['market', 'temple'], giver: 'kee', kind: 'courier', avoid: ['mo'] }]; s.contracts.done = 7; s.contracts.kinds = { courier: 7 }; s.contracts.contest = { d: 'market', gang: 'crow', night: 28 }; s.contracts.day = '2026-11-16'; s.contracts.dayBest = 99; s.contracts.dayPaid = true;
  const back = loadSave(JSON.stringify(s)); assert.deepEqual(back.contracts, s.contracts);
  // junk is repaired, not trusted
  const junk = loadSave(JSON.stringify({ ...s, contracts: { offers: [{ seed: 'x' }, null, { seed: 1, stars: 9, open: [] }], done: -4, contest: { d: 'mars', gang: 'crow' }, day: 'soon', kinds: { 'bad key!': 3 } } }));
  assert.deepEqual(junk.contracts.offers, []); assert.equal(junk.contracts.done, 0); assert.equal(junk.contracts.contest, null); assert.equal(junk.contracts.day, ''); assert.deepEqual(junk.contracts.kinds, {});
  // and the oldest saves still come forward
  const v3 = loadSave(JSON.stringify({ v: 3, seed: 2, cash: 50, done: ['m1'], rep: { market: 5 } })); assert.equal(v3.v, SAVE_VERSION); assert.equal(v3.contracts.done, 0);
});

test('trophies: Contractor, Job of the Day, Turf Holder', () => {
  for (const id of ['contractor', 'cotd', 'turf']) assert.ok(TROPHIES.some(t => t.id === id), id);
  assert.equal(TROPHIES.length, 59);
  const s = past(41); s.contracts.done = 10; s.contracts.dayRuns = 1; s.contracts.retaken = 3;
  const got = checkTrophies(s); for (const id of ['contractor', 'cotd', 'turf']) assert.ok(got.includes(id) || s.trophies.includes(id), id);
});

test('tiers: rank, territory and contracts done raise the tier, capped at six', () => {
  const s = past(51); assert.equal(tierOf(s), 0);
  s.empire.rank = 2; assert.equal(tierOf(s), 2);
  for (const id of ['noodle', 'bumboat', 'kopitiam', 'prata']) s.biz[id].lvl = 1; assert.ok(tierOf(s) >= 3);
  s.contracts.done = 80; assert.equal(tierOf(s), 6);
});

console.log(`jade (eleventh pass, contracts): ${n} tests ok`);
await import('./jade-twelve.mjs');

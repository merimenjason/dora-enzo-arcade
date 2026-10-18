import assert from 'node:assert/strict';
import * as G from '../.checks/hay-bale-game.js';

const { UNITS, UNIT_IDS, SNACKS, SNACK_IDS } = G;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}

// ---- the roster ----

const ROSTER = [
  ['wren', 1, 2, 1, 'sell'], ['mouse', 1, 2, 1, 'faint'], ['ladybird', 1, 1, 2, 'startBattle'],
  ['toad', 1, 2, 2, 'faint'], ['bee', 1, 1, 1, 'startBattle'], ['dormouse', 1, 1, 3, 'endTurn'],
  ['hedgehog', 2, 3, 2, 'faint'], ['squirrel', 2, 2, 3, 'startTurn'], ['robin', 2, 2, 3, 'friendSummoned'],
  ['mole', 2, 1, 4, 'hurt'], ['frog', 2, 3, 3, 'friendAheadFaints'], ['pip', 2, 2, 2, 'buy'],
  ['badger', 3, 4, 3, 'beforeAttack'], ['otter', 3, 3, 4, 'endTurn'], ['magpie', 3, 3, 3, 'startTurn'],
  ['rabbit', 3, 3, 4, 'friendAte'], ['porcupine', 3, 2, 5, 'hurt'], ['beaver', 3, 3, 3, 'faint'],
  ['stoat', 4, 5, 3, 'knockOut'], ['tortoise', 4, 2, 6, 'startBattle'], ['crow', 4, 4, 4, 'friendFaints'],
  ['skunk', 4, 3, 5, 'startBattle'], ['raccoon', 4, 4, 4, 'startBattle'], ['hare', 4, 4, 3, 'startBattle'],
  ['boar', 5, 6, 6, 'beforeAttack'], ['bear', 5, 5, 8, 'startBattle'], ['stag', 5, 6, 5, 'faint'],
  ['duchess', 5, 3, 6, 'endTurn'], ['hawk', 5, 5, 5, 'startBattle'], ['goose', 5, 5, 7, 'hurt'],
];

test('roster: 30 units, six per tier', () => {
  assert.equal(UNIT_IDS.length, 30);
  for (const t of [1, 2, 3, 4, 5]) assert.equal(UNIT_IDS.filter((id) => UNITS[id].tier === t).length, 6, `tier ${t}`);
});

test('roster: stats and triggers match the spec', () => {
  assert.deepEqual(UNIT_IDS, ROSTER.map((r) => r[0]));
  for (const [id, tier, a, h, on] of ROSTER) {
    const u = UNITS[id];
    assert.deepEqual([u.id, u.tier, u.a, u.h, u.on], [id, tier, a, h, on], id);
  }
});

test('roster: 8 snacks with their tiers', () => {
  assert.deepEqual(SNACK_IDS.map((id) => [id, SNACKS[id].tier]),
    [['apple', 1], ['raisin', 1], ['honey', 2], ['hay', 2], ['mint', 3], ['chilli', 3], ['seed', 4], ['cake', 5]]);
});

test('roster: every unit has three ability lines', () => {
  for (const id of UNIT_IDS) {
    assert.equal(UNITS[id].text.length, 3, id);
    for (const line of UNITS[id].text) assert.ok(line.length > 8, `${id}: ${line}`);
    assert.equal(typeof UNITS[id].run, 'function', id);
  }
});

// ---- fights ----

const { fight, Rand } = G;
let nextUid = 1;
/** A unit with the spec's base stats (or `extra` for tokens and odd cases). */
const u = (id, level = 1, extra = {}) => { const d = UNITS[id]; return { uid: nextUid++, id, a: d?.a ?? 0, h: d?.h ?? 1, level, xp: 0, status: null, tmpA: 0, ...extra }; };
const tok = (id, a, h, extra = {}) => u(id, 1, { a, h, ...extra });
/** The events after a unit's ability first fires. */
const after = (ev, unit) => { const i = ev.findIndex((e) => e.k === 'ability' && e.uid === unit.uid); assert.ok(i >= 0, `${unit.id} fires`); return ev.slice(i + 1); };
const next = (ev, k) => ev.find((e) => e.k === k);

const ABILITY = {
  ladybird: (n) => { const w = u('wren'), s = u('ladybird', n); const ev = fight([w, s], [tok('log', 0, 50)], 1, null).events; assert.deepEqual(next(after(ev, s), 'buff'), { k: 'buff', uid: w.uid, a: 2 + n, h: 1 }); },
  bee: (n) => { const s = u('bee', n), e = tok('log', 0, 50); assert.equal(next(after(fight([s], [e], 1, null).events, s), 'hit').dmg, n); },
  toad: (n) => { const s = u('toad', n), w = u('wren'); const ev = fight([s, w], [tok('fawn', 5, 50)], 1, null).events; assert.deepEqual(next(after(ev, s), 'buff'), { k: 'buff', uid: w.uid, a: 2 + n, h: 1 + n }); },
  hedgehog: (n) => {
    const s = u('hedgehog', n), m = u('mole'), f = tok('fawn', 5, 50);
    const ev = after(fight([s, m], [f], 1, null).events, s);
    assert.ok(ev.some((e) => e.k === 'hit' && e.uid === m.uid && e.dmg === 2 * n), 'hits a friend');
    assert.ok(ev.some((e) => e.k === 'hit' && e.uid === f.uid && e.dmg === 2 * n), 'hits a rival');
  },
  mouse: (n) => { const s = u('mouse', n); const e = next(after(fight([s], [tok('fawn', 5, 50)], 1, null).events, s), 'summon'); assert.deepEqual([e.unit.id, e.unit.a, e.unit.h, e.side, e.at], ['mouselet', n, n, 0, 0]); },
  robin: (n) => {
    const s = u('robin', n); const ev = fight([u('mouse'), s], [tok('fawn', 5, 50)], 1, null).events;
    const sum = next(ev, 'summon'); assert.deepEqual(next(after(ev, s), 'buff'), { k: 'buff', uid: sum.unit.uid, a: 1 + n, h: 1 + n });
  },
  mole: (n) => { const s = u('mole', n); assert.deepEqual(next(after(fight([s], [tok('fawn', 1, 50)], 1, null).events, s), 'buff'), { k: 'buff', uid: s.uid, a: 1 + 2 * n, h: 3 }); },
  frog: (n) => { const s = u('frog', n); assert.deepEqual(next(after(fight([u('wren'), s], [tok('fawn', 5, 50)], 1, null).events, s), 'buff'), { k: 'buff', uid: s.uid, a: 3 + 2 * n, h: 3 + 2 * n }); },
  badger: (n) => { const s = u('badger', n), w = u('wren'); const e = next(after(fight([s], [tok('log', 0, 50), w], 1, null).events, s), 'hit'); assert.deepEqual([e.uid, e.dmg], [w.uid, 2 * n]); },
  porcupine: (n) => { const s = u('porcupine', n), f = tok('fawn', 1, 50); const e = next(after(fight([s], [f], 1, null).events, s), 'hit'); assert.deepEqual([e.uid, e.dmg], [f.uid, 2 * n]); },
  beaver: (n) => { const s = u('beaver', n); const e = next(after(fight([s], [tok('fawn', 5, 50)], 1, null).events, s), 'summon'); assert.deepEqual([e.unit.id, e.unit.a, e.unit.h], ['log', 0, 6 * n]); },
  stoat: (n) => { const s = u('stoat', n); assert.deepEqual(next(after(fight([s], [u('wren'), tok('log', 0, 50)], 1, null).events, s), 'buff'), { k: 'buff', uid: s.uid, a: 5 + 2 * n, h: 1 + 2 * n }); },
  tortoise: (n) => { const s = u('tortoise', n); const ev = after(fight([u('wren'), u('mole'), u('toad'), s], [tok('log', 0, 50)], 1, null).events, s); assert.equal(ev.filter((e) => e.k === 'status' && e.status === 'shell').length, n); },
  crow: (n) => { const s = u('crow', n); assert.deepEqual(next(after(fight([u('wren'), s], [tok('fawn', 5, 50)], 1, null).events, s), 'buff'), { k: 'buff', uid: s.uid, a: 4 + n, h: 4 + n }); },
  skunk: (n) => { const s = u('skunk', n), e = tok('log', 0, 30); assert.equal(next(after(fight([s], [e], 1, null).events, s), 'buff').h, [21, 11, 1][n - 1]); },
  raccoon: (n) => { const s = u('raccoon', n), e = tok('fawn', 5, 50); const ev = after(fight([s], [e], 1, null).events, s); assert.deepEqual(ev.filter((x) => x.k === 'buff').slice(0, 2).map((x) => [x.uid, x.a]), [[e.uid, Math.max(0, 5 - 2 * n)], [s.uid, 4 + Math.min(5, 2 * n)]]); },
  hare: (n) => { const s = u('hare', n), f = tok('fawn', 0, 20); const e = next(after(fight([s], [tok('log', 0, 50), f], 1, null).events, s), 'hit'); assert.deepEqual([e.uid, e.dmg], [f.uid, 2 * n]); },
  boar: (n) => { const s = u('boar', n); assert.equal(next(after(fight([s], [tok('log', 0, 50)], 1, null).events, s), 'buff').a, 6 + 2 * n); },
  bear: (n) => {
    const w = u('wren'), s = u('bear', n), m = u('mole'); const ev = after(fight([w, s, m], [tok('log', 0, 50)], 1, null).events, s);
    assert.deepEqual(ev.filter((x) => x.k === 'buff').slice(0, 2).map((x) => [x.uid, x.h]), [[w.uid, 1 + 3 * n], [m.uid, 4 + 3 * n]]);
  },
  stag: (n) => { const s = u('stag', n); const e = next(after(fight([s], [tok('fawn', 9, 50)], 1, null).events, s), 'summon'); assert.deepEqual([e.unit.id, e.unit.a, e.unit.h], ['fawn', 4 * n, 4 * n]); },
  hawk: (n) => { const s = u('hawk', n), f = tok('fawn', 3, 50); const e = next(after(fight([s], [tok('log', 0, 50), f], 1, null).events, s), 'hit'); assert.deepEqual([e.uid, e.dmg], [f.uid, 5 * n]); },
  goose: (n) => { const s = u('goose', n), w = u('wren'); assert.deepEqual(next(after(fight([s, w], [tok('fawn', 1, 50)], 1, null).events, s), 'buff'), { k: 'buff', uid: w.uid, a: 2 + n, h: 1 }); },
};
for (const [id, check] of Object.entries(ABILITY)) for (const n of [1, 3]) test(`fight: ${id} at level ${n}`, () => check(n));

test('fight: simultaneous hits', () => {
  const l = tok('fawn', 2, 4), r = tok('fawn', 3, 2);
  const { result, events } = fight([l], [r], 1, null);
  assert.equal(result, 'win');
  assert.deepEqual(events.filter((e) => e.k === 'hit').map((e) => [e.uid, e.dmg, e.h]), [[r.uid, 2, 0], [l.uid, 3, 1]]);
  assert.deepEqual(events.at(-1), { k: 'end', result: 'win' });
});

test('fight: ability order: higher attack first, ties to the left', () => {
  const b = u('bee'), h = u('hawk');
  let ev = fight([b, tok('fawn', 9, 50)], [h], 1, null).events.filter((e) => e.k === 'ability').map((e) => e.uid);
  assert.deepEqual(ev.slice(0, 2), [h.uid, b.uid]);
  const b1 = u('bee', 1, { h: 5 }), b2 = u('bee', 1, { h: 5 });
  ev = fight([b1], [b2], 1, null).events.filter((e) => e.k === 'ability').map((e) => e.uid);
  assert.deepEqual(ev.slice(0, 2), [b1.uid, b2.uid]);
});

test('fight: statuses: shell, mint, chilli', () => {
  const s = tok('fawn', 1, 10, { status: 'shell' });
  assert.deepEqual(fight([s], [tok('fawn', 5, 50)], 1, null).events.filter((e) => e.k === 'hit' && e.uid === s.uid).map((e) => e.dmg), [1, 5, 5]);
  const m = tok('fawn', 1, 10, { status: 'mint' });
  assert.deepEqual(fight([m], [tok('fawn', 5, 50)], 1, null).events.filter((e) => e.k === 'hit' && e.uid === m.uid).map((e) => e.dmg).slice(0, 2), [4, 4]);
  const c = tok('fawn', 1, 50, { status: 'chilli' }), back = tok('log', 0, 50);
  const ev = fight([c], [tok('log', 0, 50), back], 1, null).events;
  assert.ok(ev.some((e) => e.k === 'hit' && e.uid === back.uid && e.dmg === 2), 'chilli splashes the enemy behind');
});

test('fight: summons never make a line longer than 5', () => {
  const mice = [1, 2, 3, 4, 5].map(() => u('mouse'));
  const { events } = fight(mice, [u('hedgehog', 3)], 1, null);
  assert.equal(events.filter((e) => e.k === 'summon').length, 5);
  for (const e of events) if (e.k === 'line') assert.ok(e.uids.length <= 5);
});

test('fight: chained faints end in a draw', () => {
  const hogs = () => [u('hedgehog', 1, { h: 1 }), u('hedgehog', 1, { h: 1 })];
  const { result, rounds } = fight(hogs(), hogs(), 1, null);
  assert.equal(result, 'draw'); assert.ok(rounds <= 2, `${rounds} rounds`);
});

test('fight: zero attack fronts draw at once', () => {
  const { result, rounds } = fight([tok('log', 0, 6)], [tok('log', 0, 6)], 1, null);
  assert.equal(result, 'draw'); assert.ok(rounds < 3, `${rounds} rounds`);
});

test("fight: dora's perk gives the front +0/+2 before abilities", () => {
  const w = u('wren'), b = u('bee');
  const ev = fight([w, b], [tok('log', 0, 50)], 1, 'dora').events;
  assert.deepEqual(ev[0], { k: 'buff', uid: w.uid, a: 2, h: 3 });
  assert.notDeepEqual(fight([u('wren')], [tok('log', 0, 50)], 1, null).events[0]?.k, 'buff');
});

test('fight: same seed, same events; seeds can differ', () => {
  const line = () => [u('bee', 3, { uid: 1 })], foes = () => [tok('log', 0, 50, { uid: 2 }), tok('log', 0, 50, { uid: 3 }), tok('log', 0, 50, { uid: 4 })];
  assert.deepEqual(fight(line(), foes(), 7, null), fight(line(), foes(), 7, null));
  const targets = new Set();
  for (let s = 1; s <= 20; s++) targets.add(next(fight(line(), foes(), s, null).events, 'hit').uid);
  assert.ok(targets.size > 1, 'the bee picks different targets');
});

test('fight: leaves its inputs untouched', () => {
  const l = [u('stoat'), u('mouse', 2, { status: 'shell', tmpA: 3 })], r = [u('hedgehog', 3), u('goose')];
  const before = JSON.stringify([l, r]);
  fight(l, r, 3, 'dora');
  assert.equal(JSON.stringify([l, r]), before);
});

test('fight: 500 random lines never reach 200 rounds', () => {
  const rand = new Rand(99);
  let most = 0;
  for (let i = 0; i < 500; i++) {
    const line = () => Array.from({ length: 1 + rand.int(5) }, () => u(UNIT_IDS[rand.int(30)], 1 + rand.int(3)));
    const r = fight(line(), line(), i, rand.int(2) ? 'dora' : null);
    assert.ok(['win', 'loss', 'draw'].includes(r.result));
    most = Math.max(most, r.rounds);
  }
  assert.ok(most < 200, `longest fight ${most} rounds`);
});

// ---- the shop and the run ----

const { Run, levelOf, crewName, shopTier, slotCounts } = G;
const none = () => [];
/** A run with a fixed rival (empty unless given) and a shop holding exactly these units and snacks. */
const runWith = (coach = 'dora', rival = none, opt = {}) => new Run(11, coach, { rival, ...opt });
const stock = (run, ids = [], snacks = []) => {
  run.units = ids.map((id) => ({ kind: 'unit', unit: run.spawn(id), frozen: false }));
  run.snacks = snacks.map((id) => ({ kind: 'snack', snack: id, cost: 3, frozen: false }));
  return run;
};
const place = (run, at, id, extra = {}) => { run.line[at] = { ...run.spawn(id), ...extra }; return run.line[at]; };
const tierOf = (s) => (s.kind === 'unit' ? UNITS[s.unit.id].tier : SNACKS[s.snack].tier);

test('run: a new run', () => {
  const run = new Run(1, 'dora');
  assert.deepEqual([run.turn, run.acorns, run.hearts, run.bales, run.phase], [1, 10, 5, 0, 'shop']);
  assert.deepEqual([run.units.length, run.snacks.length], [3, 1]);
  for (const s of [...run.units, ...run.snacks]) assert.equal(tierOf(s), 1);
  assert.deepEqual(run.line, [null, null, null, null, null]);
});

test('run: slots and tiers by turn', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 14].map(shopTier), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.deepEqual([1, 4, 5, 8, 9].map(slotCounts), [[3, 1], [3, 1], [4, 1], [4, 1], [5, 2]]);
  const run = runWith('dora', none);
  place(run, 0, 'wren');
  for (let t = 1; t < 9; t++) run.endTurn();
  assert.equal(run.turn, 9);
  assert.deepEqual([run.units.length, run.snacks.length], [5, 2]);
  const seen = new Set();
  for (let i = 0; i < 60; i++) { run.acorns = 10; run.roll(); for (const s of run.units) seen.add(tierOf(s)); }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5]);
});

test('run: buy, sell and acorns', () => {
  const run = stock(runWith(), ['wren', 'mouse', 'toad']);
  assert.equal(run.buy(0, 0), true); assert.equal(run.acorns, 7); assert.equal(run.line[0].id, 'wren'); assert.equal(run.units[0], null);
  run.buy(1, 3);
  const mouse = run.line[3];
  assert.equal(run.sell(0), true);
  assert.deepEqual([run.acorns, run.line[0], mouse.a], [5, null, 3], 'refund 1 and the wren buffs the mouse');
  place(run, 2, 'toad', { level: 2, xp: 2 });
  run.sell(2); assert.equal(run.acorns, 7);
});

test('run: merging levels up and adds a bonus unit', () => {
  const run = stock(runWith(), ['toad', 'toad', 'toad']);
  run.buy(0, 0); run.buy(1, 0);
  assert.deepEqual([run.line[0].a, run.line[0].h, run.line[0].xp, run.line[0].level], [3, 3, 1, 1]);
  run.buy(2, 0);
  assert.deepEqual([run.line[0].a, run.line[0].h, run.line[0].xp, run.line[0].level], [4, 4, 2, 2]);
  assert.equal(run.units.length, 3, 'the bonus took an emptied slot');
  assert.equal(tierOf(run.units[0]), 2);
  assert.deepEqual([0, 1, 2, 4, 5, 9].map(levelOf), [1, 1, 2, 2, 3, 3]);
  const b = runWith(); b.acorns = 30;
  place(b, 0, 'wren'); place(b, 1, 'wren', { a: 5, h: 1 });
  assert.equal(b.move(1, 0), true);
  assert.deepEqual([b.line[0].a, b.line[0].h, b.line[0].xp, b.line[1]], [6, 2, 1, null], 'moving onto a copy merges');
  place(b, 1, 'mole');
  b.move(0, 1); assert.deepEqual([b.line[0].id, b.line[1].id], ['mole', 'wren'], 'moving onto another unit swaps');
});

test('run: feed: snacks per the spec', () => {
  const feed = (snack, id = 'mole', extra = {}) => { const r = stock(runWith(), [], [snack]); const t = place(r, 0, id, extra); assert.equal(r.feed(0, 0), true); assert.equal(r.acorns, 7); return [r, t]; };
  assert.deepEqual(((t) => [t.a, t.h])(feed('apple')[1]), [2, 5]);
  assert.equal(feed('raisin')[1].tmpA, 3);
  assert.equal(feed('honey')[1].status, 'shell');
  assert.equal(feed('mint')[1].status, 'mint');
  assert.equal(feed('chilli')[1].status, 'chilli');
  assert.deepEqual(((t) => [t.a, t.h])(feed('cake')[1]), [4, 7]);
  const [sr, st] = feed('seed', 'mole', { xp: 1 });
  assert.deepEqual([st.xp, st.level, sr.units.length], [2, 2, 1], 'a seed levels up and adds a bonus unit');
  const hay = stock(runWith(), [], ['hay']); const a = place(hay, 0, 'mole'), b = place(hay, 3, 'wren');
  hay.feed(0, 0); assert.deepEqual([a.a, a.h, b.a, b.h], [2, 5, 3, 2]);
  const rab = stock(runWith(), [], ['apple']); const w = place(rab, 0, 'wren'); place(rab, 1, 'rabbit', { level: 2 });
  rab.feed(0, 0); assert.deepEqual([w.a, w.h], [3, 4], 'the rabbit adds 2 health');
});

test('run: freeze survives a roll and the next turn', () => {
  const run = runWith(); place(run, 0, 'wren');
  const kept = run.units[1].unit.uid;
  assert.equal(run.freeze('unit', 1), true);
  run.roll(); assert.equal(run.units[1].unit.uid, kept);
  run.endTurn(); assert.equal(run.turn, 2); assert.equal(run.units[1].unit.uid, kept); assert.equal(run.units[1].frozen, true);
  run.freeze('unit', 1); assert.equal(run.units[1].frozen, false);
});

test("run: enzo's first roll is free each turn; dora's is not", () => {
  const e = runWith('enzo'); e.roll(); assert.equal(e.acorns, 10); e.roll(); assert.equal(e.acorns, 9);
  place(e, 0, 'wren'); e.endTurn(); e.roll(); assert.equal(e.acorns, 10);
  const d = runWith('dora'); d.roll(); assert.equal(d.acorns, 9);
});

test('run: shop triggers: squirrel, magpie, pip, otter, dormouse and duchess', () => {
  const sq = runWith(); place(sq, 0, 'squirrel'); sq.endTurn(); assert.equal(sq.snacks[0].cost, 2);
  place(sq, 1, 'squirrel', { level: 3 }); sq.endTurn(); assert.equal(sq.snacks[0].cost, 0, 'never below 0');
  const mg = runWith(); place(mg, 0, 'magpie', { level: 2 }); mg.endTurn(); assert.equal(mg.acorns, 12);
  const pp = stock(runWith(), ['pip']); const w = place(pp, 0, 'wren'), m = place(pp, 1, 'mole');
  pp.buy(0, 2); assert.deepEqual([w.h, m.h], [2, 5]);
  const ot = runWith(); const ow = place(ot, 0, 'wren'); place(ot, 1, 'otter', { level: 3 }); ot.endTurn(); assert.deepEqual([ow.a, ow.h], [5, 4]);
  const dd = runWith(); const dm = place(dd, 0, 'dormouse'); const du = place(dd, 1, 'duchess');
  dd.endTurn(); dd.endTurn();
  assert.deepEqual([dm.a, dm.h, du.a, du.h], [3, 7, 3, 6], 'end-turn buffs last');
});

test('run: raisin attack lasts one fight', () => {
  const run = stock(runWith(), [], ['raisin']); place(run, 0, 'mole');
  run.feed(0, 0);
  const out = run.endTurn();
  assert.equal(out.left[0].tmpA, 3); assert.equal(run.line[0].tmpA, 0);
});

test('run: illegal actions change nothing', () => {
  const run = stock(runWith(), ['wren', 'mole', 'toad'], ['apple']);
  place(run, 0, 'bee'); place(run, 1, 'bee'); place(run, 2, 'bee'); place(run, 3, 'bee'); place(run, 4, 'bee');
  const before = JSON.stringify(run);
  assert.equal(run.buy(0, 0), false, 'full line, no match');
  assert.equal(run.buy(9, 0), false, 'no such slot');
  assert.equal(run.sell(7), false);
  assert.equal(run.freeze('unit', 9), false);
  assert.equal(run.move(2, 2), false);
  assert.equal(JSON.stringify(run), before);
  const poor = stock(runWith(), ['wren'], ['apple']); poor.acorns = 2;
  const p0 = JSON.stringify(poor);
  assert.equal(poor.buy(0, 0), false, 'too few acorns');
  assert.equal(poor.feed(0, 0), false, 'no acorns and nobody to feed');
  poor.acorns = 10; const p1 = JSON.stringify(poor);
  assert.equal(poor.feed(0, 0), false, 'a snack on an empty slot');
  assert.equal(poor.sell(0), false, 'selling an empty slot');
  assert.equal(JSON.stringify(poor), p1); assert.notEqual(p0, p1);
});

test('run: the run ends', () => {
  const won = runWith('dora', none); place(won, 0, 'boar', { level: 3 });
  for (let i = 0; i < 10; i++) assert.equal(won.endTurn().result, 'win');
  assert.deepEqual([won.phase, won.bales, won.hearts], ['won', 10, 5]);
  assert.equal(won.endTurn(), null);
  const big = () => [{ uid: 900, id: 'boar', a: 50, h: 50, level: 3, xp: 5, status: null, tmpA: 0 }];
  const lost = runWith('dora', big);
  for (let i = 0; i < 5; i++) assert.equal(lost.endTurn().result, 'loss');
  assert.deepEqual([lost.phase, lost.hearts, lost.bales], ['over', 0, 0]);
  const drawn = runWith('dora', none);
  assert.equal(drawn.endTurn().result, 'draw');
  assert.deepEqual([drawn.hearts, drawn.bales, drawn.turn], [5, 0, 2]);
  assert.match(crewName([u('wren'), u('boar')], 1), /^The Boar's \w+$/);
  assert.match(crewName([u('duchess')], 2), /^The Duchess's \w+$/);
});

test('run: save round-trips', () => {
  const a = stock(new Run(5, 'enzo'), ['wren', 'mole', 'toad'], ['honey']);
  a.buy(0, 0); a.feed(0, 0); a.freeze('unit', 1); a.roll();
  const b = Run.load(JSON.stringify(a));
  assert.ok(b);
  assert.equal(JSON.stringify(b), JSON.stringify(a));
  a.endTurn(); b.endTurn();
  assert.equal(JSON.stringify(b), JSON.stringify(a));
});

test('run: malformed saves load as null', () => {
  const good = JSON.parse(JSON.stringify(new Run(5, 'dora')));
  const bad = [null, 'x', '{"v":2}', JSON.stringify({ ...good, line: [null, null, null, null, null, null] }),
    JSON.stringify({ ...good, line: [{ uid: 1, id: 'dragon', a: 1, h: 1, level: 1, xp: 0, status: null, tmpA: 0 }, null, null, null, null] }),
    JSON.stringify({ ...good, hearts: -1 }), JSON.stringify({ ...good, coach: 'owl' }), JSON.stringify({ ...good, units: [{ kind: 'unit', frozen: false }] }), JSON.stringify({ ...good, last: { result: 'maybe' } })];
  for (const raw of bad) assert.equal(Run.load(raw), null, String(raw).slice(0, 60));
  assert.ok(Run.load(JSON.stringify(good)));
});

// ---- the buying policy, ghosts and the profile ----

const { choose, playShop, act, worth, ghost, freshProfile, loadProfile, record } = G;

test('policy: fills an empty line on turn 1', () => {
  const run = new Run(3, 'dora');
  playShop(run);
  assert.equal(run.line.filter(Boolean).length, 3);
  assert.equal(run.acorns, 1);
});

test('policy: merges a copy it can afford', () => {
  const run = stock(runWith(), ['mole']);
  for (const [i, id] of ['wren', 'bee', 'mole', 'toad', 'dormouse'].entries()) place(run, i, id);
  run.acorns = 3;
  assert.deepEqual(choose(run), { k: 'buy', i: 0, to: 2 });
});

test('policy: never takes an illegal action', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const run = new Run(seed, seed % 2 ? 'dora' : 'enzo', { rival: none });
    for (let t = 0; t < 6; t++) {
      for (let n = 0; n < 40; n++) { const a = choose(run); if (!a) break; assert.equal(act(run, a), true, `seed ${seed}: ${JSON.stringify(a)}`); }
      run.endTurn();
    }
  }
});

test('policy: playShop puts the strongest at the front', () => {
  const run = new Run(8, 'dora');
  for (let t = 0; t < 4; t++) { playShop(run); run.endTurn(); }
  const line = run.line.filter(Boolean);
  for (let i = 1; i < line.length; i++) assert.ok(line[i - 1].a + line[i - 1].h >= line[i].a + line[i].h);
});

test('ghosts: deterministic and growing', () => {
  assert.deepEqual(ghost(5, 1), ghost(5, 1));
  assert.deepEqual(ghost(5, 6), ghost(5, 6));
  const mean = (t) => { let s = 0; for (let k = 1; k <= 50; k++) s += worth(ghost(k * 7919, t)); return s / 50; };
  const [m1, m5, m9] = [mean(1), mean(5), mean(9)];
  assert.ok(m1 < m5 && m5 < m9, `${m1} < ${m5} < ${m9}`);
  for (const u of ghost(5, 4)) assert.ok(u.uid >= 1e6, 'ghost uids never clash with a player\'s');
});

test('ghosts: the run fights them', () => {
  const run = new Run(21, 'dora');
  playShop(run);
  const out = run.endTurn();
  assert.ok(out.rival.line.length > 0);
  assert.match(out.rival.name, /^The .+'s \w+$/);
});

test('profile: record counts a run once', () => {
  const run = runWith('dora', none); place(run, 0, 'boar', { level: 3 });
  let p = record(freshProfile(), run);
  assert.equal(p.runs, 0, 'a run still in the shop is not recorded');
  for (let i = 0; i < 10; i++) run.endTurn();
  p = record(p, run);
  assert.deepEqual([p.runs, p.wins, p.best, p.won], [1, 1, 10, ['boar']]);
  assert.deepEqual(record(p, run), p);
  const lost = new Run(12, 'dora', { rival: () => [{ uid: 900, id: 'boar', a: 50, h: 50, level: 3, xp: 5, status: null, tmpA: 0 }] });
  for (let i = 0; i < 5; i++) lost.endTurn();
  const q = record(p, lost);
  assert.deepEqual([q.runs, q.wins, q.best], [2, 1, 10]);
});

test('profile: malformed saves load fresh', () => {
  for (const raw of [null, 'x', '{"v":2}', '{"v":1,"runs":-1,"wins":0,"best":0,"won":[],"last":0}', '{"v":1,"runs":1,"wins":0,"best":11,"won":[],"last":0}', '{"v":1,"runs":1,"wins":0,"best":1,"won":"x","last":0}'])
    assert.deepEqual(loadProfile(raw), freshProfile(), String(raw));
  assert.deepEqual(loadProfile('{"v":1,"runs":3,"wins":1,"best":10,"won":["boar","dragon"],"last":4}').won, ['boar']);
});

// ---- final review fixes ----

test('review: ghosts never keep a raisin past a fight', () => {
  // only the last turn's Raisins count; kept for good they pile up to over +1 a unit by turn 14
  let sum = 0, n = 0;
  for (let k = 1; k <= 100; k++) for (const u of ghost(k * 104729 + 14, 14)) { sum += u.tmpA; n++; }
  assert.ok(sum / n < 0.4, `mean raisin attack ${(sum / n).toFixed(2)}`);
});

test('review: an ability that changes nothing does not keep a stalled fight going', () => {
  const r = fight([u('badger', 1, { a: 0, h: 5 })], [u('mole', 1, { a: 0, h: 5 })], 1, null);
  assert.equal(r.result, 'draw'); assert.ok(r.rounds < 3, `${r.rounds} rounds`);
});

test('review: a chilli front with no attack still splashes', () => {
  const w = u('wren', 1, { a: 0, h: 1 });
  const r = fight([tok('log', 0, 9, { status: 'chilli' })], [tok('log', 0, 9), w], 1, null);
  assert.ok(r.events.some((e) => e.k === 'faint' && e.uid === w.uid), 'the wren behind is splashed out');
});

test('review: a bonus unit fills an empty shop slot first, and the shop never outgrows its 7 boxes', () => {
  const run = stock(runWith(), ['toad', 'toad', 'toad', 'mole']);
  run.buy(0, 0); run.buy(1, 0); run.buy(2, 0);
  assert.equal(run.units.length, 4, 'the bonus went into an emptied slot');
  assert.equal(tierOf(run.units[0]), 2);
  const full = stock(runWith(), ['wren', 'wren', 'wren', 'wren', 'wren', 'wren', 'wren']);
  place(full, 0, 'mole', { xp: 1 }); full.snacks = [{ kind: 'snack', snack: 'seed', cost: 0, frozen: false }];
  full.feed(0, 0);
  assert.equal(full.units.length, 7);
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl engine');

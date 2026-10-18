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

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl engine');

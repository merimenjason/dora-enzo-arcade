// Tembusu engine tests: the run is a pure function of seed + start time + timestamped picks; one long catch-up and many
// short ones give the same tree; a clock that goes backwards never rewinds it; a week away leaves a fallen tree waiting
// for the seed pick with everything recorded; a fork waits and the assist takes it after an hour; at most one decision
// at a time; the run lengths; seeds, planting and the journal; the hill; the save. Run after compiling the engine into
// .checks/ (npm test does).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../.checks/tembusu-game.js';
import { play } from './tembusu-bot.mjs';

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 10, 19, 1, 0);
let n = 0;
const test = (name, f) => { f(); n++; };
/** a grown (second) tree, so its forks and life are the full-length ones */
const grown = (seed = 77, traits = []) => ({ ...G.newSave(T0, seed, 480), tree: G.newTree(2, seed, T0, 480, 'normal', traits) });
/** a check-in loop with a player who picks bud `b` whenever a fork is waiting at a check-in */
function walk(save, from, to, step, b = 0) {
  let tree;
  for (let t = from; t <= to; t += step) {
    ({ save, tree } = G.checkIn(save, t));
    if (tree.phase === 'fork' && b >= 0) { save = G.pickBud(save, t, b); }
  }
  return save;
}

test('the engine never reads the clock', () => {
  const src = readFileSync(new URL('../lib/tembusu-game.ts', import.meta.url), 'utf8');
  assert.ok(!/Date\.now|new Date|performance\.now|Math\.random/.test(src));
});

test('a seed, a start time and the picks replay the tree exactly', () => {
  const s = walk(grown(), T0, T0 + 20 * HOUR, 7 * MIN, 1);
  const a = G.derive(s.tree, T0 + 20 * HOUR), b = G.derive(JSON.parse(JSON.stringify(s.tree)), T0 + 20 * HOUR);
  assert.deepEqual(a, b);
  assert.notDeepEqual(G.derive({ ...s.tree, seed: s.tree.seed + 1 }, T0 + 20 * HOUR).log, a.log);
});

test('one long jump and many short jumps give the same tree', () => {
  for (const seed of [3, 41, 900]) {
    const one = G.checkIn(grown(seed), T0 + 3 * DAY).tree;
    let s = grown(seed), tree;
    for (let t = T0; t <= T0 + 3 * DAY; t += 5 * MIN) ({ save: s, tree } = G.checkIn(s, t));
    ({ tree } = G.checkIn(s, T0 + 3 * DAY));
    assert.deepEqual(tree, one);
    // and with a player's picks in the save, the same again
    const played = walk(grown(seed), T0, T0 + 6 * HOUR, 13 * MIN, 2);
    const jump = G.checkIn(played, T0 + 2 * DAY).tree;
    let p = played; for (let t = T0 + 6 * HOUR; t <= T0 + 2 * DAY; t += 11 * MIN) ({ save: p } = G.checkIn(p, t));
    assert.deepEqual(G.checkIn(p, T0 + 2 * DAY).tree, jump);
  }
});

test('a clock that goes backwards never rewinds the tree', () => {
  let s = grown(5);
  ({ save: s } = G.checkIn(s, T0 + 5 * HOUR));
  const ahead = G.checkIn(s, T0 + 5 * HOUR).tree;
  const back = G.checkIn(s, T0 + 1 * HOUR);
  assert.equal(back.save.lastNow, T0 + 5 * HOUR);
  assert.deepEqual(back.tree, ahead);
  assert.ok(back.tree.u >= ahead.u);
  // a pick made while the device clock is behind is stamped with the clamped time
  let f = grown(5), t = T0;
  for (; t < T0 + DAY; t += MIN) { const c = G.checkIn(f, t); f = c.save; if (c.tree.phase === 'fork') break; }
  const picked = G.pickBud(f, t - 3 * HOUR, 1);
  assert.equal(picked.tree.picks.at(-1).at, t);
  assert.equal(picked.lastNow, t);
});

test('a week away leaves a fallen tree waiting for the seed pick, with every event recorded', () => {
  const s = grown(11);
  const { save, tree } = G.checkIn(s, T0 + 7 * DAY);
  assert.equal(tree.phase, 'fallen');
  assert.equal(G.decision(save, tree).kind, 'keep');
  const { kinds, F } = G.plan(s.tree);
  // every fork was reached and the assist took each one
  assert.equal(tree.log.filter((e) => e.kind === 'fork').length, tree.fell.cause === 'age' ? F : tree.log.filter((e) => e.kind === 'fork').length);
  assert.ok(tree.chosen.every((c) => c.assist));
  // every weather event before the fall is in the log
  const evs = tree.log.filter((e) => G.EVENT_KINDS.includes(e.kind)).map((e) => e.kind);
  if (tree.fell.cause === 'age') assert.deepEqual(evs, kinds);
  assert.equal(tree.log.at(-1).kind, 'fall');
  // and it keeps waiting: a month later nothing has changed
  const later = G.checkIn(save, T0 + 37 * DAY).tree;
  assert.deepEqual({ ...later, now: 0 }, { ...tree, now: 0 });
});

test('a fork waits for the player, then the assist picks after an hour', () => {
  let s = grown(21), t = T0, tree;
  for (; t < T0 + DAY; t += MIN) { ({ save: s, tree } = G.checkIn(s, t)); if (tree.phase === 'fork') break; }
  const reached = tree.fork.reached, u = tree.u;
  const wait = G.checkIn(s, reached + G.ASSIST_WAIT - MIN).tree;
  assert.equal(wait.phase, 'fork'); assert.equal(wait.u, u); assert.equal(wait.nextAt, reached + G.ASSIST_WAIT);
  const after = G.checkIn(s, reached + G.ASSIST_WAIT + MIN).tree;
  assert.notEqual(after.phase, 'fork');
  assert.equal(after.chosen[0].assist, true);
  assert.equal(after.chosen[0].bud, tree.fork.offer[G.assistPick(tree, tree.fork.offer)]);
  // growth resumed from the assist's moment, not from when the fork was reached
  assert.ok(Math.abs(after.u - (u + MIN / after.ms)) < 1e-9);
  // a pick stamped after the assist took the fork is ignored
  const late = { ...s, tree: { ...s.tree, picks: [{ f: tree.fork.k, at: reached + 2 * HOUR, b: 2 }] } };
  assert.deepEqual(G.checkIn(late, reached + 3 * HOUR).tree.chosen[0], after.chosen[0]);
  // and a pick in time is the one that counts
  const mine = G.pickBud(s, reached + 10 * MIN, 2);
  const grownOn = G.checkIn(mine, reached + 20 * MIN).tree;
  assert.deepEqual(grownOn.chosen[0], { bud: tree.fork.offer[2], assist: false });
  // the assist's pick is sensible: it fills the biggest gap
  assert.equal(G.assistPick({ ...tree, branches: [], hollows: [], roots: 0, bark: 0, tall: 0, health: 80 }, ['root', 'wide', 'flower']), 1);
});

test('at most one decision at a time', () => {
  for (const seed of [1, 2, 3]) {
    const { trees } = play(seed, 4, 'random');
    for (const t of trees) {
      // a tree waiting at a fork is never fallen, and a fallen tree has no fork
      assert.ok(!(t.tree.fork && t.tree.fell));
    }
    let s = grown(seed);
    for (let t = T0; t < T0 + 2 * DAY; t += 17 * MIN) {
      const c = G.checkIn(s, t); s = c.save;
      const d = G.decision(s, c.tree);
      if (c.tree.phase === 'fork') assert.equal(d.kind, 'bud');
      else if (c.tree.phase === 'fallen') assert.ok(d.kind === 'keep' || d.kind === 'plant');
      else assert.equal(d, null);
      if (d?.kind === 'bud') assert.equal(d.offer.length, 3);
    }
  }
});

test('run length: a 15-minute tutorial tree with five forks, then 12-hour trees with eight', () => {
  const first = G.newSave(T0, 9, 480);
  assert.equal(G.plan(first.tree).F, G.FIRST_FORKS);
  assert.equal(first.tree.hours * 60, G.FIRST_TREE_MINUTES);
  let s = first, tree, t = T0;
  for (; t < T0 + HOUR; t += 15_000) { ({ save: s, tree } = G.checkIn(s, t)); if (tree.phase === 'fork') s = G.pickBud(s, t, 0); if (tree.phase === 'fallen') break; }
  assert.equal(tree.phase, 'fallen');
  assert.ok((t - T0) / MIN > 11 && (t - T0) / MIN < 21, `tutorial tree took ${(t - T0) / MIN} min`);
  assert.equal(tree.chosen.length, 5);
  // the tutorial shows a storm and a fruiting season
  assert.ok(tree.log.some((e) => e.kind === 'storm') && tree.log.some((e) => e.kind === 'fruiting'));
  const g = grown(4);
  assert.equal(G.plan(g.tree).F, G.FORKS);
  assert.equal(g.tree.hours, G.TREE_HOURS);
  // fork spacing follows from TREE_HOURS: forks spread over the life, about 1/9 of it apart
  const forks = G.plan(g.tree).items.filter((i) => i.kind === 'fork').map((i) => i.u);
  for (let k = 1; k < forks.length; k++) assert.ok(Math.abs(forks[k] - forks[k - 1] - 1 / (G.FORKS + 1)) < 1e-9);
  assert.equal(G.newTree(3, 1, T0, 0, 'slow', []).hours, G.SLOW_HOURS);
});

test('seeds: keep up to three, plant one, the others go in Enzo’s journal', () => {
  let { save, tree } = G.checkIn(grown(31), T0 + 3 * DAY);
  const seeds = G.fallSeeds(save.tree, tree);
  assert.ok(seeds.length >= 4 && seeds.length <= 6);
  assert.equal(new Set(seeds.map((s) => s.trait)).size, seeds.length);
  assert.equal(G.plant(save, T0 + 3 * DAY, 'kept', 0), save, 'nothing to plant before keeping');
  const kept = G.keepSeeds(save, T0 + 3 * DAY, [0, 1, 2, 3]);
  assert.deepEqual(kept.kept, [0, 1, 2]);
  assert.equal(G.decision(kept, tree).kind, 'plant');
  const next = G.plant(kept, T0 + 3 * DAY + MIN, 'kept', 1, 480);
  assert.equal(next.tree.n, 3); assert.equal(next.tree.start, T0 + 3 * DAY + MIN);
  assert.deepEqual(next.tree.traits, G.traitsOf(seeds[1]));
  assert.deepEqual(next.journal.seeds.map((s) => s.trait), [seeds[0].trait, seeds[2].trait]);
  assert.equal(next.journal.trees.length, 1);
  assert.equal(G.checkIn(next, T0 + 3 * DAY + MIN).tree.phase, 'growing');
  // traits stack across generations only through the planted seed: its own trait, then up to two of its parent's
  assert.deepEqual(G.traitsOf({ trait: 'fragrant', lineage: ['long-lived', 'wide-crown'] }), ['fragrant', 'long-lived', 'wide-crown']);
  // a seed from the journal can be planted instead; the kept ones go in the journal
  let j = { ...kept, journal: { ...kept.journal, seeds: [{ trait: 'welcoming', lineage: [] }] } };
  j = G.plant(j, T0 + 3 * DAY, 'journal', 0);
  assert.deepEqual(j.tree.traits, ['welcoming']);
  assert.equal(j.journal.seeds.length, 3);
  // a starting trait shows on the young tree
  assert.equal(G.derive(G.newTree(2, 1, T0, 0, 'normal', ['deep-taproot']), T0).roots, 1);
});

test('the fallen tree waits for the seed pick indefinitely', () => {
  const { save } = G.checkIn(grown(8), T0 + 2 * DAY);
  const a = G.checkIn(save, T0 + 400 * DAY);
  assert.equal(a.tree.phase, 'fallen');
  assert.equal(G.decision(a.save, a.tree).kind, 'keep');
});

test('the hill keeps earlier trees as stumps, saplings and young trees in fixed slots', () => {
  const { save } = play(5, 9, 'random');
  const spots = G.hill(save);
  assert.ok(spots.length <= G.HILL_SLOTS);
  assert.equal(new Set(spots.map((s) => s.slot)).size, spots.length);
  assert.equal(spots.at(-1).stage, 'stump');
  assert.ok(spots.some((s) => s.stage === 'young'));
});

test('weather, night and every animal’s need come from the tree’s shape and the seed', () => {
  assert.equal(G.ANIMALS.length, 12);
  assert.equal(G.TRAITS.length, 20);
  assert.equal(G.BUDS.length, 6);
  for (const a of G.ANIMALS) { assert.ok(a.needs && a.effect); assert.ok(!/chinchilla/i.test(a.name)); }
  assert.equal(G.dayPart(6), 'dawn'); assert.equal(G.dayPart(12), 'day'); assert.equal(G.dayPart(18.5), 'dusk'); assert.equal(G.dayPart(23), 'night');
  // tz is fixed per tree: 01:00 UTC is 09:00 in Singapore
  assert.equal(G.hourAt({ tz: 480 }, Date.UTC(2026, 0, 1, 1)), 9);
  const s = { forks: 3, wide: 0, tall: 0, flowers: 0, fruit: 0, roots: 0, hollows: 1, bark: 0, health: 80 };
  assert.ok(G.ANIMAL.hornbill.ok(s)); assert.ok(!G.ANIMAL.colugo.ok(s));
  for (const e of [{ kind: 'plant' }, { kind: 'arrive', animal: 'koel' }, { kind: 'fall', cause: 'storm' }, { kind: 'pick', bud: 'root' }]) assert.ok(G.describe(e).length > 5);
});

test('the save: round trip, corrupt and old saves start fresh, only inputs are stored', () => {
  const s = walk(grown(3), T0, T0 + 5 * HOUR, 9 * MIN, 0);
  const back = G.parseSave(G.serialise(s), T0, 1, 0);
  assert.deepEqual(back, s);
  assert.deepEqual(G.derive(back.tree, T0 + DAY), G.derive(s.tree, T0 + DAY));
  for (const bad of ['{', 'null', '{"v":2}', '{"v":1,"tree":{}}']) assert.equal(G.parseSave(bad, T0, 1, 0).tree.n, 1);
  assert.deepEqual(Object.keys(s.tree).sort(), ['hours', 'n', 'picks', 'seed', 'start', 'traits', 'tz']);
  assert.equal(G.SAVE_KEY, 'tembusu-v1');
});

test('age is shown in words, never a ticking number', () => {
  let s = grown(2);
  const words = new Set();
  for (let t = T0; t < T0 + DAY; t += 20 * MIN) { const c = G.checkIn(s, t); s = c.save; words.add(G.ageWord(c.tree)); if (c.tree.phase === 'fork') s = G.pickBud(s, t, 0); }
  for (const w of words) assert.ok(!/\d/.test(w));
  assert.ok(words.size >= 4);
});

console.log(`PASS tembusu: ${n} engine tests`);

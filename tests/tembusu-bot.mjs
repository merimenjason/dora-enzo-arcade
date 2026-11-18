// Tembusu bots: many trees, one after another on one save, played through the engine with the clock driven from
// outside. Each player checks in at a human pace (every 20-200 minutes of real time, or not at all for a day), picks
// buds with its own strategy, keeps three seeds and plants one.
//   random  - any bud, any seed.
//   assist  - never picks: every fork waits an hour and the assist takes it.
//   always-X (one per bud type) - picks bud X whenever it is offered, otherwise at random.
// Checks: all 12 animals live in some tree and all 20 traits turn up on dropped seeds; no always-X strategy beats the
// others by a wide margin; a grown tree's life on the growth clock averages TREE_HOURS. `--quick` runs fewer trees.
import assert from 'node:assert/strict';
import * as G from '../.checks/tembusu-game.js';

const QUICK = process.argv.includes('--quick');
const MIN = 60_000, HOUR = 60 * MIN;

/** a small seeded generator for the bot's own choices (never the engine's) */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** how a tree went, for scoring: animals that lived there, reaching old age, health at the end */
export const score = (t) => t.ever.length * 2 + (t.fell?.cause === 'age' ? 4 : 0) + Math.floor(t.health / 25);

/**
 * Plays `trees` trees on one save. Returns every finished tree's summary.
 * strategy: 'random' | 'assist' | 'always-<bud>'
 */
export function play(seed, trees, strategy = 'random', { startHour = 9, tz = 480 } = {}) {
  const R = rng(seed * 31 + 7);
  let now = Date.UTC(2026, 10, 19, startHour - tz / 60, 0);
  let save = G.newSave(now, seed, tz);
  const out = [];
  let guard = 0;
  while (out.length < trees && guard++ < 100000) {
    // the next check-in: usually within a few hours, sometimes a whole day away
    now += R() < 0.1 ? 24 * HOUR : (20 + R() * 180) * MIN * (save.tree.n === 1 ? 0.05 : 1);
    let { save: s, tree } = G.checkIn(save, now); save = s;
    const d = G.decision(save, tree);
    if (d?.kind === 'bud' && strategy !== 'assist') {
      let b = Math.floor(R() * 3);
      if (strategy.startsWith('always-')) { const want = strategy.slice(7); if (d.offer.includes(want)) b = d.offer.indexOf(want); }
      save = G.pickBud(save, now, b);
    } else if (d?.kind === 'keep') {
      const idx = [0, 1, 2, 3, 4, 5].filter(() => R() < 0.6).slice(0, 3);
      save = G.keepSeeds(save, now, idx.length ? idx : [0]);
    } else if (d?.kind === 'plant') {
      const growth = (tree.fell.at - save.tree.start - waitedOf(tree)) / HOUR;
      out.push({ n: tree.n, tree, hours: save.tree.hours, growth, seeds: G.fallSeeds(save.tree, tree), score: score(tree), chosen: tree.chosen });
      const fromJournal = save.journal.seeds.length && R() < 0.25;
      save = G.plant(save, now, fromJournal ? 'journal' : 'kept', fromJournal ? Math.floor(R() * save.journal.seeds.length) : Math.floor(R() * d.kept.length));
    }
  }
  return { trees: out, save };
}
/** real time a tree spent waiting at forks */
function waitedOf(tree) {
  let w = 0;
  for (let i = 0; i < tree.log.length; i++) {
    const e = tree.log[i];
    if (e.kind === 'pick' || e.kind === 'assist') { const f = tree.log.slice(0, i).reverse().find((x) => x.kind === 'fork'); if (f) w += e.at - f.at; }
  }
  return w;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = QUICK ? 6 : 20, PER = QUICK ? 10 : 16;
  const animals = new Set(), traits = new Set();
  const grown = [];
  const byStrategy = {};
  const strategies = ['random', 'assist', ...G.BUDS.map((b) => `always-${b}`)];
  for (const st of strategies) {
    const scores = [];
    for (let k = 0; k < N; k++) {
      const { trees } = play(1000 + k * 17, PER, st, { startHour: (k * 5) % 24 });
      for (const t of trees) {
        t.tree.ever.forEach((a) => animals.add(a));
        t.seeds.forEach((s) => traits.add(s.trait));
        if (t.n > 1) { grown.push(t.growth / t.hours); scores.push(t.score); }
      }
    }
    byStrategy[st] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  const mean = grown.reduce((a, b) => a + b, 0) / grown.length;
  console.log('mean score by strategy:', Object.fromEntries(Object.entries(byStrategy).map(([k, v]) => [k, +v.toFixed(2)])));
  console.log(`grown trees: ${grown.length}, mean life ${(mean * G.TREE_HOURS).toFixed(2)} h at normal speed (TREE_HOURS ${G.TREE_HOURS})`);
  console.log(`animals reached: ${animals.size}/12, traits reached: ${traits.size}/20`);
  const missingA = G.ANIMALS.map((a) => a.id).filter((a) => !animals.has(a));
  const missingT = G.TRAITS.map((t) => t.id).filter((t) => !traits.has(t));
  assert.deepEqual(missingA, [], `animals never reached: ${missingA}`);
  assert.deepEqual(missingT, [], `traits never reached: ${missingT}`);
  const always = G.BUDS.map((b) => byStrategy[`always-${b}`]).sort((a, b) => b - a);
  assert.ok(always[0] <= always[1] * 1.2, `one always-pick strategy wins by a wide margin: ${always[0].toFixed(2)} vs ${always[1].toFixed(2)}`);
  assert.ok(always[0] <= byStrategy.random * 1.3, `an always-pick strategy beats random picking by a wide margin: ${always[0].toFixed(2)} vs ${byStrategy.random.toFixed(2)}`);
  assert.ok(Math.abs(mean - 1) < 0.1, `a grown tree's life averages ${(mean * G.TREE_HOURS).toFixed(2)} h, not about ${G.TREE_HOURS}`);
  console.log('PASS tembusu bot: every animal and trait reachable, no dominant bud, trees average TREE_HOURS');
}

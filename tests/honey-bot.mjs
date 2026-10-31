// Honeycomb Hollow bots. Three players work through all sixty chambers over many seeds: a random player (any turn
// that does something), a greedy player (the turn that best moves the goals on), and a look-ahead player that tries
// its best few turns and the best reply to each, guessing the refills with a different seed so it can't peek at the
// real ones. Checks: every comb starts with no match and at least one move; no cascade runs away; the look-ahead bot
// clears every chamber at a healthy rate inside its move limit; the random bot rarely clears the later chambers.
// `--quick` (in `npm test`) plays fewer seeds; `--tune` plays each chamber without a limit and prints the TUNE table
// (moves, and moves left for two and three stars) for lib/honey-levels.ts.
import assert from 'node:assert/strict';
import { HoneyGame, CHAMBERS, Rng, NONE } from '../.checks/honey-game.js';

const quick = process.argv.includes('--quick'), tune = process.argv.includes('--tune');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const list = only ? CHAMBERS.filter((c) => only.split(',').includes(c.id)) : CHAMBERS;

/** How good a position is for the goals: honey first, then the harder goals, plus a little for specials in hand. */
function value(g) {
  if (g.over?.won) return 1e5 + g.moves * 100;
  let v = 0;
  for (const x of g.goals()) {
    if (x.key === 'honey') v -= x.left * 1;
    else if (x.key === 'bees') v -= x.left * 14;
    else if (x.key === 'acorns') v -= x.left * 12;
    else if (x.key === 'moss') v -= x.left * 3;
    else if (x.key === 'dew') v -= x.left * 10;
  }
  const C = g.cells, cb = g.comb;
  for (let i = 0; i < cb.n; i++) {
    const p = C[i].p; if (!p) continue;
    if (p.k === 'drop' && p.sp !== NONE) v += p.sp === 3 ? 5 : 2.5;
    if (p.k === 'acorn') { let d = 0, j = i; while (cb.below[j] >= 0) { d++; j = cb.below[j]; } v -= d * 1.6; }
    if (p.k === 'wax') v -= p.bee ? p.hp * 4 : p.hp * 0.6;
    if (p.k === 'wasp') v -= 3;
  }
  if (g.over && !g.over.won) v -= 1e4;
  return v;
}
function play(g, rnd) { const c = g.clone(rnd.int(2 ** 31)); c.turn; return c; }
function sim(g, m, rnd) { const c = g.clone(rnd.int(2 ** 31)); c.turn(m.t, m.dir); return c; }

const players = {
  random: (g, rnd) => { const ms = g.allMoves(); return ms[rnd.int(ms.length)]; },
  greedy: (g, rnd) => { let best = null, bv = -Infinity; for (const m of g.allMoves()) { const v = value(sim(g, m, rnd)) + rnd.next() * 0.01; if (v > bv) { bv = v; best = m; } } return best; },
  lookahead: (g, rnd) => {
    const first = g.allMoves().map((m) => { const c = sim(g, m, rnd); return { m, c, v: value(c) + rnd.next() * 0.01 }; }).sort((a, b) => b.v - a.v);
    if (!first.length) return null;
    if (first[0].c.over?.won) return first[0].m;
    let best = first[0].m, bv = -Infinity;
    for (const f of first.slice(0, 4)) {
      let v2 = f.v;
      if (!f.c.over) { v2 = -Infinity; for (const m of f.c.allMoves()) v2 = Math.max(v2, value(sim(f.c, m, rnd))); if (v2 === -Infinity) v2 = f.v; }
      const v = f.v * 0.35 + v2 * 0.65;
      if (v > bv) { bv = v; best = f.m; }
    }
    return best;
  },
};
void play;

/** Plays one game; returns turns used to win, or null. */
function run(ch, seed, who, limit) {
  const g = new HoneyGame(limit ? { ...ch, moves: limit } : { ...ch, moves: 250 }, seed), rnd = new Rng(seed * 77 + 5);
  assert.ok(!g.cells.some((_, i) => g.matchAt(i)), `${ch.id} seed ${seed}: the comb starts with no match`);
  assert.ok(g.findMove(), `${ch.id} seed ${seed}: the comb starts with a move`);
  while (!g.over) {
    const m = players[who](g, rnd); assert.ok(m, `${ch.id} seed ${seed}: there is always a move`);
    const st = g.turn(m.t, m.dir); assert.ok(st && st[0].t !== 'bounce', `${ch.id}: the bot's turn works`);
    assert.ok(g.findMove() || g.over, `${ch.id} seed ${seed}: never stuck without a move`);
  }
  assert.ok(g.bestChain < 60, `${ch.id} seed ${seed}: no runaway cascade (${g.bestChain})`);
  return g.over.won ? { turns: g.turns, stars: g.over.stars } : null;
}

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const t0 = Date.now();
if (tune) {
  const seeds = Number(process.argv.find((a) => a.startsWith('--seeds='))?.slice(8) ?? 16);
  const out = [];
  for (const ch of list) {
    const need = [];
    for (let s = 1; s <= seeds; s++) { const r = run(ch, 1000 + s, 'lookahead', 0); need.push(r ? r.turns : 250); }
    const p25 = pct(need, 0.25), p50 = pct(need, 0.5), p70 = pct(need, 0.7), p90 = pct(need, 0.9);
    const moves = p90 + 3, three = Math.max(2, moves - p25), two = Math.max(1, Math.min(three - 1, moves - p70));
    out.push(`  ${ch.id}: [${moves}, ${two}, ${three}],`);
    console.log(`${ch.id.padEnd(4)} needs p25 ${p25} p50 ${p50} p90 ${p90} → moves ${moves}, ★★ at ${two} left, ★★★ at ${three} left`);
  }
  console.log(out.join('\n'));
} else {
  const seeds = quick ? 2 : 10, rows = [];
  for (const ch of list) {
    const r = {};
    for (const who of ['random', 'greedy', 'lookahead']) {
      let w = 0, st = 0; const n = who === 'lookahead' ? seeds : seeds * 2;
      for (let s = 1; s <= n; s++) { const x = run(ch, 50 + s, who, ch.moves); if (x) { w++; st += x.stars; } }
      r[who] = w / n; if (who === 'lookahead') r.stars = w ? st / w : 0;
    }
    rows.push([ch.id, r]);
    console.log(`${ch.id.padEnd(4)} random ${(r.random * 100).toFixed(0).padStart(3)}%  greedy ${(r.greedy * 100).toFixed(0).padStart(3)}%  look-ahead ${(r.lookahead * 100).toFixed(0).padStart(3)}% (${r.stars.toFixed(1)}★)  moves ${ch.moves}`);
  }
  const look = rows.map(([, r]) => r.lookahead), later = rows.filter(([id]) => /^[hq]/.test(id)).map(([, r]) => r.random);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log(`look-ahead wins ${(avg(look) * 100).toFixed(0)}% on average; random wins ${(avg(later) * 100).toFixed(0)}% of the later chambers`);
  if (!only) {
    assert.ok(avg(look) >= (quick ? 0.7 : 0.78), 'the look-ahead bot clears the chambers at a healthy rate');
    for (const [id, r] of rows) assert.ok(r.lookahead >= (quick ? 0.5 : 0.5), `${id}: the look-ahead bot can clear it (${r.lookahead})`);
    assert.ok(avg(later) <= 0.35, 'the random bot rarely clears the later chambers');
  }
}
console.log(`honey bots ok in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

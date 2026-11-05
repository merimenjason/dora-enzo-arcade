// Turn Order bots. The conductor plays the solver's choice every round and must plant every acorn. The myopic player
// looks one round ahead only: it keeps the acorn alive this round and moves it as near the pot as it can, like a player
// who reads the ghost but doesn't plan. The random player swaps at random, and the do-nothing player never swaps. The
// gardens should be beyond the do-nothing player, hard on the random one, and a fair fight for the myopic one. Run
// after `npm test` has compiled the engine into .checks/ (or `npm run bot:order`).
import assert from 'node:assert/strict';
import { Run, BOARDS, solve, round, swapped, acorn } from '../.checks/order-game.js';

const quick = process.argv.includes('--quick');
const choices = (r) => [-1, ...r.order.slice(0, -1).map((_, i) => i)];
const conductor = (r) => solve(r.board).firsts[0] ?? -1;
const dist = (b) => { const a = acorn(b); return b.potted ? -1 : a ? Math.abs(a.x - b.pot.x) + Math.abs(a.y - b.pot.y) : 99; };
const myopic = (r) => {
  let best = -1, score = Infinity;
  for (const c of choices(r)) { const nb = round(r.board, swapped(r.order, c)).board; const s = nb.lost && !nb.potted ? 100 : dist(nb); if (s < score) { score = s; best = c; } }
  return best;
};
const random = (r) => { r.botSeed = ((r.botSeed ?? r.seed) * 1103515245 + 12345) >>> 0; const c = choices(r); return c[r.botSeed % c.length]; };
const never = () => -1;
function play(seed, bot) {
  const r = new Run(seed);
  for (let guard = 0; guard < 400 && !r.over; guard++) {
    if (r.phase === 'pick') { r.pick(r.offer.includes('heart') ? 'heart' : r.offer[0]); continue; }
    const c = bot(r); if (c >= 0) r.swap(c);
    r.go();
  }
  return r;
}
const t0 = Date.now();
const N = quick ? 4 : 10;
const sum = (name, bot) => {
  const rs = Array.from({ length: N }, (_, i) => play(500 + i * 13, bot));
  const won = rs.filter((r) => r.phase === 'won').length, avg = rs.reduce((a, r) => a + (r.phase === 'won' ? BOARDS : r.ix), 0) / N;
  const fails = rs.reduce((a, r) => a + r.stats.fails, 0) / N;
  console.log(`${name.padEnd(10)} ${won}/${N} won, ${avg.toFixed(1)} gardens planted on average, ${fails.toFixed(1)} slips a run`);
  return { won, avg };
};
const C = sum('conductor', conductor), M = sum('myopic', myopic), R = sum('random', random), D = sum('never', never);
assert.equal(C.won, N, 'the conductor plants every acorn');
assert.equal(D.avg, 0, 'leaving the queue alone never plants the first acorn');
assert.ok(R.avg <= C.avg - 6, 'random swapping gets nowhere near');
assert.ok(M.avg < C.avg, 'reading only one round ahead isn’t enough to win every time');
console.log(`Turn Order bots passed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

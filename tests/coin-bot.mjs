// Coin of the Realm bots. The planner looks two hand-overs ahead, treating any mood Enzo hasn't heard as fair (it
// never peeks), and steers clear of Grumbles. The greedy player takes an open order it can reach right now and
// otherwise goes wherever. The random player spends the coin anywhere it can. Towns should be winnable by planning,
// harder by grabbing, and out of reach at random. Run after `npm test` has compiled the engine into .checks/ (or
// `npm run bot:coin`).
import assert from 'node:assert/strict';
import { Run, TOWNS, dist, isTrade, SELLS } from '../.checks/coin-game.js';

const quick = process.argv.includes('--quick');
const clone = (r) => {
  const c = Object.assign(Object.create(Run.prototype), structuredClone({ ...r, town: undefined }));
  c.town = r.town;
  // the planner only knows what Enzo has heard
  c.moods = r.moods.map((m, i) => (r.known[i] ? m : 'fair'));
  return c;
};
const sellers = (r) => r.town.folk.filter((f) => isTrade(f.kind) && !(r.known[f.id] && r.moods[f.id] === 'grumpy') && r.orders.some((o) => !o.done && o.good === SELLS[f.kind])).map((f) => f.id);
const leaf = (r, start) => {
  if (r.phase === 'pick' || r.phase === 'won') return 1000;
  if (r.phase === 'lost') return -1000;
  let v = (r.planks - start.planks) * 20 - (r.ix === start.ix && r.day > start.day ? 8 * (r.day - start.day) : 0);
  if (r.day !== start.day) v -= (start.hours - start.hour) * 3;
  const d = dist(r.town.adj, r.holder, r.grumbles), s = sellers(r);
  if (s.length) v -= Math.min(...s.map((i) => d[i])) * 2;
  if (!r.mayorUsed) v += 1;
  return v;
};
function search(r, depth, start) {
  if (depth === 0 || r.phase !== 'play') return { v: leaf(r, start), move: -1 };
  let best = { v: -Infinity, move: -1 };
  const opts = r.targets();
  for (const t of opts.length ? opts : [-1]) {
    const c = clone(r); const ev = t < 0 ? c.wait() : c.pass(t);
    const v = search(c, depth - 1, start).v - (ev.some((e) => e.k === 'snatch') ? 60 : 0);
    if (v > best.v) best = { v, move: t };
  }
  return best;
}
const planner = (r) => search(r, 2, r).move;
const greedy = (r) => { const t = r.targets(), s = sellers(r).filter((i) => t.includes(i)); return s.length ? s[0] : t.length ? t[0] : -1; };
const random = (r) => { r.botSeed = ((r.botSeed ?? r.seed) * 1103515245 + 12345) >>> 0; const t = r.targets(); return t.length ? t[r.botSeed % t.length] : -1; };
function play(seed, bot) {
  const r = new Run(seed);
  for (let guard = 0; guard < 2000 && !r.over; guard++) {
    if (r.phase === 'pick') { r.pick(r.offer[0]); continue; }
    const t = bot(r); if (t < 0) r.wait(); else r.pass(t);
  }
  return r;
}
const t0 = Date.now();
const N = quick ? 6 : 30;
const sum = (name, bot) => {
  const rs = Array.from({ length: N }, (_, i) => play(900 + i * 17, bot));
  const won = rs.filter((r) => r.phase === 'won').length, towns = rs.reduce((a, r) => a + r.stats.towns, 0) / N;
  const snatched = rs.reduce((a, r) => a + r.stats.snatched, 0) / N, planks = rs.reduce((a, r) => a + r.stats.planks, 0) / N;
  console.log(`${name.padEnd(8)} ${won}/${N} won, ${towns.toFixed(1)} bridges built on average, ${planks.toFixed(1)} planks, snatched ${snatched.toFixed(1)} times a run`);
  return { won, towns };
};
const P = sum('planner', planner), G = sum('greedy', greedy), R = sum('random', random);
if (!quick) assert.ok(P.won >= N * 0.3, 'planning wins a fair share of runs');
assert.ok(P.towns >= 2, 'planning builds at least two bridges on average');
assert.ok(G.towns < P.towns, 'grabbing the nearest order does worse than planning');
assert.ok(R.towns <= P.towns - 1.5, 'spending at random gets nowhere near');
assert.equal(R.won, 0, 'random spending never wins');
console.log(`Coin of the Realm bots passed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

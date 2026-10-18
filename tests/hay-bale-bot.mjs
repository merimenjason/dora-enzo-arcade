// Hay Bale Brawl's bot: whole runs played by the buying policy the rival ghosts also use, and by a random buyer, over
// seeded runs, with balance gates. The policy should win a fair share of runs (its coach is its edge over the ghosts),
// a random buyer almost none, and no unit should be left on the shelf or win everything.
import assert from 'node:assert/strict';
import { Run, Rand, UNITS, UNIT_IDS, LINE, UNIT_COST, choose, playShop, MAX_ROUNDS } from '../.checks/hay-bale-game.js';

const SEEDS = 300, started = Date.now();

/** A buyer that puts random shop units into random legal slots while it can afford one. */
function randomPicker(rand) {
  return (run) => {
    if (run.acorns < UNIT_COST) return null;
    const moves = [];
    run.units.forEach((s, i) => {
      if (s?.kind !== 'unit') return;
      for (let to = 0; to < LINE; to++) if (!run.line[to] || run.line[to].id === s.unit.id) moves.push({ k: 'buy', i, to });
    });
    return moves.length ? rand.pick(moves) : null;
  };
}

function play(seed, picker) {
  const run = new Run(seed, seed % 2 ? 'dora' : 'enzo');
  const bought = new Set();
  let rounds = 0, firstLoss = 0;
  const pick = (r) => { const a = picker(r); if (a?.k === 'buy') bought.add(r.units[a.i].unit.id); return a; };
  while (run.phase === 'shop') {
    playShop(run, pick);
    const out = run.endTurn();
    rounds = Math.max(rounds, out.events.filter((e) => e.k === 'attack').length / 2);
    if (out.result === 'loss' && !firstLoss) firstLoss = run.turn - (run.phase === 'shop' ? 1 : 0);
  }
  return { won: run.phase === 'won', bales: run.bales, bought, line: run.line.filter(Boolean).map((u) => u.id), rounds, firstLoss };
}

const runs = [], randoms = [];
for (let s = 1; s <= SEEDS; s++) {
  runs.push(play(s, choose));
  randoms.push(play(s + 50000, randomPicker(new Rand(s))));
}
const wins = runs.filter((r) => r.won), win = wins.length / SEEDS, randomWin = randoms.filter((r) => r.won).length / SEEDS;
const bought = Object.fromEntries(UNIT_IDS.map((id) => [id, runs.filter((r) => r.bought.has(id)).length]));
const inWins = Object.fromEntries(UNIT_IDS.map((id) => [id, wins.filter((r) => r.line.includes(id)).length]));
const tierInWins = [0, 0, 0, 0, 0, 0];
for (const r of wins) for (const id of new Set(r.line)) tierInWins[UNITS[id].tier]++;
const maxRounds = Math.max(...runs.map((r) => r.rounds), ...randoms.map((r) => r.rounds));
const mean = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2);
const table = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(', ');

console.log(`policy wins ${(win * 100).toFixed(1)}% (Dora ${runs.filter((r, i) => r.won && i % 2 === 0).length}, Enzo ${runs.filter((r, i) => r.won && i % 2 === 1).length}); random buyer ${(randomWin * 100).toFixed(1)}%`);
console.log(`mean bales ${mean(runs.map((r) => r.bales))}; mean turn of the first loss ${mean(runs.filter((r) => r.firstLoss).map((r) => r.firstLoss))}`);
console.log(`bought in runs: ${table(bought)}`);
console.log(`in ${wins.length} winning lines: ${table(inWins)}`);
console.log(`tiers in winning lines: ${tierInWins.slice(1).join(' / ')}; longest fight ${maxRounds} rounds; ${((Date.now() - started) / 1000).toFixed(1)} s`);

assert.ok(win >= 0.30 && win <= 0.55, `policy wins ${win}`);
assert.ok(randomWin < 0.05, `random buyer wins ${randomWin}`);
for (const id of UNIT_IDS) assert.ok(bought[id] / SEEDS >= 0.02, `${id} is bought in ${bought[id]} runs`);
for (const id of UNIT_IDS) assert.ok(inWins[id] / wins.length <= 0.5, `${id} is in ${inWins[id]} of ${wins.length} winning lines`);
for (const t of [1, 2, 3, 4, 5]) assert.ok(tierInWins[t] > 0, `tier ${t} appears in winning lines`);
assert.ok(maxRounds < MAX_ROUNDS, `longest fight ${maxRounds} rounds`);
console.log('PASS Hay Bale Brawl bot');

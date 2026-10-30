// Lucky Pips · the bots. A sensible greedy player and a random one play many seeded runs, and the suite checks:
// the greedy player wins a fair share at Foggier 0, the random player almost never wins, Foggier 5 is harder,
// nothing hits absurdly hard, every battle and run ends in a bounded number of turns, and every tool turns up in
// some winning run. `--quick` (used by `npm test`) plays fewer runs with looser bounds.
import assert from 'node:assert/strict';
import { newRun, poolFor, MAX_TURNS } from '../.checks/pips-game.js';
import { TOOLS } from '../.checks/pips-tools.js';
import { playRun, mulberry } from './pips-ai.mjs';

const quick = process.argv.includes('--quick');
const N = quick ? 40 : 300;
const all = poolFor({ meadow: true, midway: true, won: true, foggy: true });
const LEAD = ['dora', 'enzo', 'both'];

function batch(kind, fog, n, seed0) {
  const out = { wins: 0, runs: 0, byLead: {}, turns: 0, maxHit: 0, maxTurns: 0, maxSteps: 0, used: new Set(), areas: [0, 0, 0, 0] };
  for (const lead of LEAD) {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const run = newRun({ seed: seed0 + i * 7919 + lead.length * 104729, lead, fog, pool: all });
      const { steps } = playRun(run, kind, mulberry(seed0 * 3 + i * 31 + lead.length));
      assert.ok(run.screen === 'won' || run.screen === 'lost', `run ${lead}/${i} never finished (${run.screen})`);
      out.runs++; out.turns += run.stats.turns;
      out.maxHit = Math.max(out.maxHit, run.stats.maxHit);
      out.maxTurns = Math.max(out.maxTurns, run.stats.turns);
      out.maxSteps = Math.max(out.maxSteps, steps);
      if (run.battle) assert.ok(run.battle.turn < MAX_TURNS, `a battle ran ${run.battle.turn} turns`);
      if (run.screen === 'won') { w++; out.areas[3]++; run.used.forEach(id => out.used.add(id)); } else out.areas[run.area]++;
    }
    out.byLead[lead] = w / n; out.wins += w;
  }
  out.rate = out.wins / out.runs;
  return out;
}
const pct = x => `${Math.round(x * 100)}%`;
const t0 = Date.now();
const g = batch('greedy', 0, N, 1000);
console.log(`greedy, Foggier 0: ${pct(g.rate)} of ${g.runs} runs (Dora ${pct(g.byLead.dora)}, Enzo ${pct(g.byLead.enzo)}, Side by Side ${pct(g.byLead.both)}); ended in areas ${g.areas.join('/')}; ${Math.round(g.turns / g.runs)} turns a run; biggest hit ${g.maxHit}`);
const r = batch('random', 0, N, 5000);
console.log(`random, Foggier 0: ${pct(r.rate)} of ${r.runs} runs; ended in areas ${r.areas.join('/')}`);
const f5 = batch('greedy', 5, quick ? 20 : 100, 9000);
console.log(`greedy, Foggier 5: ${pct(f5.rate)} of ${f5.runs} runs (Dora ${pct(f5.byLead.dora)}, Enzo ${pct(f5.byLead.enzo)}, Side by Side ${pct(f5.byLead.both)})`);

if (quick) assert.ok(g.rate >= 0.25 && g.rate <= 0.72, `greedy wins ${pct(g.rate)}`);
else {
  assert.ok(g.rate >= 0.35 && g.rate <= 0.6, `greedy should win 35–60% at Foggier 0, won ${pct(g.rate)}`);
  for (const l of LEAD) assert.ok(g.byLead[l] >= 0.28 && g.byLead[l] <= 0.68, `${l} leads win ${pct(g.byLead[l])}`);
}
assert.ok(r.rate <= 0.02, `random play should almost never win (${pct(r.rate)})`);
assert.ok(f5.rate < g.rate, 'Foggier 5 is harder than Foggier 0');
assert.ok(g.maxHit <= 80, `no absurd hits (${g.maxHit})`);
assert.ok(g.maxTurns <= 160 && g.maxSteps < 3000, `runs stay bounded (${g.maxTurns} turns, ${g.maxSteps} steps)`);
const unused = TOOLS.map(t => t.id).filter(id => !g.used.has(id));
if (quick) assert.ok(unused.length <= TOOLS.length / 2, `tools never used in a win: ${unused.join(', ')}`);
else assert.deepEqual(unused, [], `tools never used in a winning run: ${unused.join(', ')}`);
console.log(`pips bots: passed in ${((Date.now() - t0) / 1000).toFixed(1)}s${quick ? ' (quick)' : ''}`);

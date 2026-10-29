// Snowdrift's bots, with no upgrades. A human-like player who holds on downslopes (and under cave roofs) and lets go
// near the crests, reacting a tenth of a second late, must reach every day's lodge with sane daylight to spare (less
// on later days). A player who never presses must be caught by the dusk from day 2 on, and one who always holds must
// be caught too. Prints each day's daylight to spare. `--quick` skips the slower endless check.
// Needs the engine compiled to .checks/ (npm run bot:snowdrift does that).
import assert from 'node:assert/strict';
import { SnowGame, VALLEY_IDS, VALLEYS, playRun, TPS, fmtTime } from '../.checks/snowdrift-game.js';
import { human, expert, planRun } from './snowdrift-bot-policy.mjs';

const quick = process.argv.includes('--quick');

const never = () => false;
const always = () => true;

const rows = [];
let prev = Infinity;
for (const [i, id] of VALLEY_IDS.entries()) {
  const V = VALLEYS[id];
  const h = playRun(new SnowGame({ kind: 'day', valley: id }), human());
  const n = playRun(new SnowGame({ kind: 'day', valley: id }), never);
  const a = playRun(new SnowGame({ kind: 'day', valley: id }), always);
  rows.push({ day: i + 1, valley: V.name, human: h.phase === 'finish' ? `lodge ${fmtTime(h.finishT)} · ${h.spare.toFixed(1)}s spare` : `caught at ${h.distance}/${Math.round(h.lodge)}`,
    cocoa: `${h.cocoa}/${h.cocoaTotal}`, flakes: h.flakes, smooth: h.smooths, tumbles: h.tumbles, falls: h.falls,
    never: n.phase === 'finish' ? `lodge ${n.spare.toFixed(1)}s` : `caught ${Math.round((100 * n.distance) / n.lodge)}%`,
    always: a.phase === 'finish' ? `lodge ${a.spare.toFixed(1)}s` : `caught ${Math.round((100 * a.distance) / a.lodge)}%` });
  assert.equal(h.phase, 'finish', `the human-like bot reaches the ${V.name} lodge`);
  assert.ok(h.spare >= 6, `${V.name}: at least 6 seconds of daylight to spare (${h.spare.toFixed(1)})`);
  assert.ok(h.spare <= 60, `${V.name}: not a walk in the park (${h.spare.toFixed(1)}s spare)`);
  assert.ok(h.spare < V.spare, `${V.name}: the daylight medal (${V.spare}s) asks for better than the plain rhythm (${h.spare.toFixed(1)}s)`);
  assert.ok(h.spare <= prev + 4, `${V.name}: later days are tighter`);
  prev = h.spare;
  if (i >= 1) assert.equal(n.phase, 'caught', `never pressing is caught in ${V.name}`);
  assert.equal(a.phase, 'caught', `always holding is caught in ${V.name}`);
}
console.table(rows);

if (!quick) {
  // the daylight medal asks for more than the plain rhythm, but a careful run (flips, or a planner) can win it
  for (const id of VALLEY_IDS) {
    const V = VALLEYS[id];
    let best = playRun(new SnowGame({ kind: 'day', valley: id }), human()).spare, how = 'rhythm';
    for (const lag of [0, 2, 4]) for (const room of [5, 7, 9]) { const g = playRun(new SnowGame({ kind: 'day', valley: id }), expert(lag, room)); if (g.phase === 'finish' && g.spare > best) { best = g.spare; how = `flips (lag ${lag}, room ${room})`; } }
    const p = planRun(new SnowGame({ kind: 'day', valley: id }));
    if (p.phase === 'finish' && p.spare > best) { best = p.spare; how = 'planner'; }
    console.log(`${V.name}: best ${best.toFixed(1)}s of daylight spare by ${how}; the medal asks ${V.spare}s`);
    assert.ok(best >= V.spare, `${V.name}: the daylight medal can be won`);
  }

  // the endless hills go on and on: the human-like bot gets a fair way before the night catches it
  for (const seed of [1, 2, 3]) {
    const g = playRun(new SnowGame({ kind: 'endless', seed, daily: false }), human(), TPS * 900);
    console.log(`Moonlit Hills seed ${seed}: ${g.distance} units, ${g.smooths} smooth landings, ${g.phase}`);
    assert.equal(g.phase, 'caught', 'the night always wins in the end');
    assert.ok(g.distance > 1500, 'a fair way before the night catches you');
  }
}
console.log('PASS snowdrift bots');

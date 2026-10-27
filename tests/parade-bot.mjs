// Kit Parade solver checks: every level is replayed from its stored solution (jobs on set ticks, by kit number) for
// three stars; doing nothing fails every level but the first; taking away any key job makes the level fail; and a
// seeded player whose clicks land a little early or late still clears most levels, while random clicking does not.
import assert from 'node:assert/strict';
import { LEVELS, JOBS, TPS, replay } from '../.checks/parade-game.js';

// a seeded generator, so a run replays exactly
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const table = [];
let jitterWins = 0, jitterRuns = 0, randomWins = 0, randomRuns = 0;
for (const [i, L] of LEVELS.entries()) {
  const g = replay(i, L.solution), r = g.result();
  assert.ok(r.cleared, `${L.id}: the stored solution brings ${L.need} kits home (got ${r.saved})`);
  assert.equal(r.stars, 3, `${L.id}: the stored solution earns three stars (${r.used} jobs, home by ${(r.time / TPS).toFixed(1)} s)`);
  assert.equal(g.log.length, L.solution.length, `${L.id}: every stored job could be given`);
  const again = replay(i, L.solution);
  assert.ok(again.saved === g.saved && again.tick === g.tick && Buffer.from(again.mask).equals(Buffer.from(g.mask)), `${L.id}: a replay is exact`);

  const idle = replay(i, []).result();
  if (i === 0) assert.ok(idle.cleared, `${L.id}: the first level clears by just watching`);
  else assert.ok(!idle.cleared, `${L.id}: doing nothing does not clear it (${idle.saved} of ${L.need})`);

  for (const k of L.key) {
    const without = replay(i, L.solution.filter((_, j) => j !== k)).result();
    assert.ok(!without.cleared, `${L.id}: without its key ${L.solution[k].job} (job ${k}) the level fails (${without.saved} of ${L.need})`);
  }

  // a player with human timing: each click a few ticks early or late
  let wins = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const r2 = rng(seed * 101 + i), shifted = L.solution.map((a) => ({ ...a, t: Math.max(1, a.t + Math.round((r2() * 2 - 1) * 3)) }));
    if (replay(i, shifted).result().cleared) wins++;
  }
  jitterWins += wins; jitterRuns += 6;
  // a player clicking at random with the same jobs
  let lucky = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const r3 = rng(seed * 977 + i), jobs = JOBS.filter((j) => L.jobs[j]), acts = [];
    for (let n = 0; n < L.solution.length + 1 && jobs.length; n++) acts.push({ t: 25 + Math.floor(r3() * L.rate * L.kits), k: Math.floor(r3() * Math.min(L.kits, 4)), job: jobs[Math.floor(r3() * jobs.length)] });
    if (replay(i, acts).result().cleared) lucky++;
  }
  if (i > 0) { randomWins += lucky; randomRuns += 4; }
  table.push({ level: L.id, name: L.name, saved: `${r.saved}/${L.kits} (need ${L.need})`, jobs: r.used, home: `${(r.time / TPS).toFixed(1)} s`, par: `${L.par.jobs} · ${L.par.time} s`, keys: L.key.length, nudged: `${wins}/6`, random: `${lucky}/4` });
}
console.table(table);
assert.ok(jitterWins / jitterRuns >= 0.85, `clicks a few ticks off still clear most levels (${jitterWins}/${jitterRuns})`);
assert.ok(randomWins / randomRuns <= 0.25, `random clicking rarely clears a level (${randomWins}/${randomRuns})`);
console.log(`Kit Parade bot: all ${LEVELS.length} stored solutions earn three stars, idling fails ${LEVELS.length - 1} levels, every key job matters, nudged clicks clear ${jitterWins}/${jitterRuns}, random clicks ${randomWins}/${randomRuns}.`);

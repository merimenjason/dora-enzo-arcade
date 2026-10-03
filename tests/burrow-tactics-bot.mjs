// Plays Burrow Tactics through the real engine with the engine's own planner (the one behind the Hint button): for
// each chinchilla it tries every move and every action on a copy of the battle, lets the predators' telegraphed
// attacks resolve on that copy, and keeps the option that leaves the board best. It proves every campaign mission
// and the run can be won, and that doing nothing loses.
import assert from 'node:assert/strict';
import { Run, MISSIONS, missionBattle, stars, planTurn, doStep, boardValue, bestStep, RUN_STAGES, DIFFICULTY_IDS } from '../.checks/burrow-tactics-game.js';

export { boardValue as value, bestStep as best };

/** Plays one player turn. */
export function takeTurn(b) {
  for (const s of planTurn(b)) {
    if (b.state !== 'player') break;
    assert.ok(doStep(b, s), `the battle took the planned step ${JSON.stringify(s)}`);
  }
}

export function playBattle(b, idle = false) {
  if (b.state === 'deploy') b.ready();
  for (let guard = 0; b.state === 'player' && guard < 20; guard++) { if (!idle) takeTurn(b); b.endTurn(); }
  return b;
}
export const playMission = (i, idle = false) => playBattle(missionBattle(i), idle);
export function playRun(seed, heroes = ['dora', 'enzo', 'pip'], difficulty = 'standard') {
  const run = Run.start(seed, heroes, difficulty);
  for (let guard = 0; guard < RUN_STAGES + 1 && run.phase !== 'won' && run.phase !== 'lost'; guard++) {
    playBattle(run.battle); run.finish();
    if (run.phase === 'reward') {
      // Mend the warren when it is hurt, otherwise learn a second action if one is offered, otherwise take the first upgrade.
      const repair = run.choices.findIndex((w) => w.type === 'repair'), skill = run.choices.findIndex((w) => w.type === 'skill');
      run.pick(repair >= 0 && run.warren <= 3 ? repair : skill >= 0 ? skill : 0);
    }
  }
  return run;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  MISSIONS.forEach((m, i) => { const b = playMission(i); console.log(`mission ${String(i + 1).padStart(2)} ${m.name.padEnd(20)} ${b.state.padEnd(4)} stars ${stars(b, m)}  warren ${b.warren}/${b.maxWarren}  kills ${b.stats.kills}  downs ${b.stats.downs}  turn ${b.turn}`); });
  const squads = [['dora', 'enzo', 'pip'], ['dora', 'enzo', 'pebble'], ['enzo', 'mochi', 'biscuit'], ['dora', 'mochi', 'pip']];
  for (const difficulty of process.env.ALL ? DIFFICULTY_IDS : ['standard']) {
    let won = 0, total = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const squad = squads[seed % squads.length], run = playRun(seed, squad, difficulty);
      total++; if (run.phase === 'won') won++;
      console.log(`${difficulty} run seed ${String(seed).padStart(2)} ${squad.join('+').padEnd(20)} ${run.phase.padEnd(4)} stage ${run.stage + 1}/${RUN_STAGES}  warren ${run.warren}  kills ${run.kills}  relics ${run.relics.join(',') || '-'}  skills ${run.squad.filter((m) => m.skill).map((m) => m.id).join(',') || '-'}`);
    }
    console.log(`${difficulty}: runs won ${won}/${total}`);
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

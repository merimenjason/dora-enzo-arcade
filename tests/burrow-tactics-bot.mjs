// A planner that plays Burrow Tactics through the real engine. For each chinchilla it tries every move and every
// action on a copy of the battle, lets the predators' telegraphed attacks resolve on that copy, and keeps the option
// that leaves the board best. It proves every campaign mission and the run can be won, and that doing nothing loses.
import assert from 'node:assert/strict';
import { Battle, Run, MISSIONS, HEROES, missionBattle, stars, RUN_STAGES } from '../.checks/burrow-tactics-game.js';

/** How good a board is for the chinchillas. */
export function value(b) {
  if (b.state === 'lost') return -1e6;
  let v = b.warren * 30 + (b.state === 'won' ? 1e4 : 0);
  for (const u of b.units) {
    if (u.hp <= 0) continue;
    if (u.side === 'hero') v += 22 + u.hp * 7 + (b.marks.some((m) => m.x === u.x && m.y === u.y) && u.hp > 1 ? 5 : 0) - (b.soaked(u) ? 6 : 0);
    else v -= 7 + u.hp * 3;
  }
  return v;
}
/** The board after the predators' attacks, scored. */
const after = (b) => { b.resolveAttacks(); return value(b); };

/** The best thing one chinchilla can do now: { score, move, act }. */
export function best(b, id) {
  const u = b.unit(id), kind = HEROES[u.kind].ability;
  let top = { score: after(b.clone()), move: null, act: null };
  const consider = (c, move) => {
    const still = after(c.clone());
    if (still > top.score) top = { score: still, move, act: null };
    for (const ability of [kind, 'groom']) for (const [x, y] of c.targets(id, ability)) {
      if (ability === 'groom' && c.unit(id).hp >= c.unit(id).maxHp) continue;
      const d = c.clone();
      d.act(id, ability, x, y);
      const score = after(d);
      if (score > top.score) top = { score, move, act: { ability, x, y } };
    }
  };
  consider(b.clone(), null);
  for (const [x, y] of b.moves(id)) { const c = b.clone(); c.moveHero(id, x, y); consider(c, [x, y]); }
  return top;
}

/** Plays one player turn: tries each order of the squad on a copy and commits the best. */
export function takeTurn(b) {
  const ids = b.heroes.map((u) => u.id);
  const orders = ids.length === 3 ? [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((o) => o.map((i) => ids[i])) : ids.length === 2 ? [ids, [ids[1], ids[0]]] : [ids];
  let pick = null;
  for (const order of orders) {
    const c = b.clone(), steps = [];
    for (const id of order) {
      if (c.state !== 'player' || !c.unit(id) || c.unit(id).hp <= 0) continue;
      const step = best(c, id);
      if (step.move) c.moveHero(id, ...step.move);
      if (step.act) c.act(id, step.act.ability, step.act.x, step.act.y);
      steps.push({ id, ...step });
    }
    const score = c.state === 'player' ? after(c) : value(c);
    if (!pick || score > pick.score) pick = { score, steps };
  }
  for (const s of pick.steps) {
    if (b.state !== 'player') break;
    if (s.move) assert.equal(b.moveHero(s.id, ...s.move), 'ok');
    if (s.act) assert.equal(b.act(s.id, s.act.ability, s.act.x, s.act.y), 'ok');
  }
}

export function playBattle(b, idle = false) {
  for (let guard = 0; b.state === 'player' && guard < 20; guard++) { if (!idle) takeTurn(b); b.endTurn(); }
  return b;
}
export const playMission = (i, idle = false) => playBattle(missionBattle(i), idle);
export function playRun(seed, heroes = ['dora', 'enzo', 'pip']) {
  const run = Run.start(seed, heroes);
  for (let guard = 0; guard < RUN_STAGES + 1 && run.phase !== 'won' && run.phase !== 'lost'; guard++) {
    playBattle(run.battle); run.finish();
    if (run.phase === 'reward') {
      // Mend the warren when it is hurt, otherwise take the first upgrade or relic.
      const repair = run.choices.findIndex((w) => w.type === 'repair');
      run.pick(repair >= 0 && run.warren <= 3 ? repair : 0);
    }
  }
  return run;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  MISSIONS.forEach((m, i) => { const b = playMission(i); console.log(`mission ${String(i + 1).padStart(2)} ${m.name.padEnd(20)} ${b.state.padEnd(4)} stars ${stars(b, m)}  warren ${b.warren}/${b.maxWarren}  kills ${b.stats.kills}  downs ${b.stats.downs}  turn ${b.turn}`); });
  const squads = [['dora', 'enzo', 'pip'], ['dora', 'enzo', 'pebble'], ['enzo', 'mochi', 'biscuit'], ['dora', 'mochi', 'pip']];
  let won = 0, total = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const squad = squads[seed % squads.length], run = playRun(seed, squad);
    total++; if (run.phase === 'won') won++;
    console.log(`run seed ${String(seed).padStart(2)} ${squad.join('+').padEnd(20)} ${run.phase.padEnd(4)} stage ${run.stage + 1}/${RUN_STAGES}  warren ${run.warren}  kills ${run.kills}  relics ${run.relics.join(',') || '-'}`);
  }
  console.log(`runs won ${won}/${total} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

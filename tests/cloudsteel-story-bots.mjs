// A player for the Cloudsteel story: walks the areas by path-finding over the world's own walkable test, talks to
// everyone, picks things up, lifts the lantern at bridges, stones and seals, and fights every duel with the
// human-paced fight bot from cloudsteel-bots.mjs. `full` collects every quipu and upgrade and takes every optional
// duel; otherwise it keeps to the main path.
import { World, idleW, LANTERN, nextGoal } from '../.checks/cloudsteel-world.js';
import { Fight, idleInput } from '../.checks/cloudsteel-game.js';
import { makeBot } from './cloudsteel-bots.mjs';

// cells are offset so that no waypoint sits exactly on the edge of a walkable shape
const CELL = 0.4, OFF = 0.137;
/** A* over a grid of the world's walkable test; returns waypoints from Dora to (tx, tz), or null */
export function path(w, tx, tz, near = 0.5) {
  const key = (i, j) => i * 100003 + j, ci = (v) => Math.round((v - OFF) / CELL), at = (i) => i * CELL + OFF;
  const si = ci(w.x), sj = ci(w.z), open = [[0, si, sj]], g = new Map([[key(si, sj), 0]]), from = new Map();
  const ok = (i, j) => w.walkable(at(i), at(j));
  let n = 0;
  while (open.length && n++ < 60000) {
    let b = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[b][0]) b = k;
    const [, i, j] = open.splice(b, 1)[0], gc = g.get(key(i, j));
    if (Math.hypot(at(i) - tx, at(j) - tz) <= near) {
      const out = []; let k = key(i, j), p = [i, j];
      while (p) { out.unshift({ x: at(p[0]), z: at(p[1]) }); p = from.get(k); if (p) k = key(p[0], p[1]); }
      return out;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = i + di, c = j + dj; if (!ok(a, c)) continue;
      if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
      const ng = gc + Math.hypot(di, dj); const kk = key(a, c);
      if (ng < (g.get(kk) ?? Infinity)) { g.set(kk, ng); from.set(kk, [i, j]); open.push([ng + Math.hypot(at(a) - tx, at(c) - tz) / CELL, a, c]); }
    }
  }
  return null;
}

/** runs one duel the world handed over; returns whether Dora won */
function fightDuel(w, opts, log) {
  const d = w.duel, bot = makeBot({ seed: opts.seed + w.stats.duels * 13, reaction: opts.reaction ?? 16, jitter: opts.jitter ?? 5 });
  for (let tries = 0; tries < 3; tries++) {
    const g = new Fight(opts.seed * 31 + tries + w.stats.duels, opts.assist ?? true, { rounds: [{ title: d.title, foes: d.foes }], ups: w.ups });
    let n = 0;
    while (n++ < 60 * 600 && !g.over) {
      g.tick(bot(g));
      if (g.phase === 'lost' && g.stats.falls < 2) g.retryRound();
    }
    const s = { ticks: g.stats.ticks, deflects: g.stats.deflects, falls: g.stats.falls, finishers: g.stats.finishers, damage: g.stats.damage };
    if (g.phase === 'won') { w.placeFromFight(g.x, g.z, g.face, g.enzo.x, g.enzo.z); w.endDuel(true, s); log.push(`won ${d.id} in ${Math.round(g.stats.ticks / 60)}s, ${g.stats.falls} falls`); return true; }
    w.endDuel(false, s); log.push(`lost ${d.id}`);
    return false;
  }
  return false;
}

/** plays the whole story; returns { w, log, ok } */
export function playStory({ seed = 1, full = true, assist = true, reaction, jitter, maxTicks = 60 * 60 * 90 } = {}) {
  const w = new World(), log = [], opts = { seed, assist, reaction, jitter };
  let ticks = 0, pressed = false;
  /** one tick: talk through anything that starts, fight any duel */
  const step = (inp = idleW()) => {
    if (w.mode === 'talk') { pressed = !pressed; inp = { ...idleW(), act: pressed, choose: w.choosing ? 1 : 0 }; }
    w.tick(inp); ticks++;
    if (w.mode === 'duel') fightDuel(w, opts, log);
    if (ticks > maxTicks) throw new Error(`the story ran too long: ${log.slice(-5).join('; ')} at ${w.area} ${w.x.toFixed(1)},${w.z.toFixed(1)}`);
  };
  const settle = () => { let k = 0; while (w.mode !== 'walk' && w.mode !== 'end' && k++ < 6000) step(); };
  /** walks to (x, z); returns false if there is no way */
  const go = (x, z, near = 0.5) => {
    settle(); if (w.mode === 'end') return true;
    for (let tries = 0; tries < 12; tries++) {
      const p = path(w, x, z, near); if (!p) return false;
      let i = 1, stuck = 0, lastD = 1e9;
      while (i < p.length) {
        if (w.mode === 'end') return true;
        if (w.mode !== 'walk') { const area = w.area; settle(); if (w.area !== area) return true; break; }
        const q = p[i], dx = q.x - w.x, dz = q.z - w.z, d = Math.hypot(dx, dz);
        if (d < 0.18) { i++; continue; }
        step({ ...idleW(), x: dx / d, z: dz / d });
        if (d >= lastD - 1e-4) { if (++stuck > 40) break; } else stuck = 0; lastD = d;
      }
      if (Math.hypot(w.x - x, w.z - z) <= near + 0.3) return true;
    }
    return Math.hypot(w.x - x, w.z - z) <= near + 0.3;
  };
  const press = (k) => { step({ ...idleW(), [k]: true }); step(); settle(); };
  const use = (x, z) => { if (!go(x, z, 1.2)) throw new Error(`cannot reach ${x},${z} in ${w.area} from ${w.x.toFixed(1)},${w.z.toFixed(1)} (${w.mode}): ${log.slice(-4).join("; ")}`); press("act"); };
  const lantern = () => press('lantern');
  const travel = (area, x, z) => { if (!go(x, z, 0.4) || w.area !== area) { settle(); if (w.area !== area) throw new Error(`did not reach ${area} (at ${w.area} ${w.x.toFixed(1)},${w.z.toFixed(1)})`); } settle(); };
  /** crosses lit planks one lantern at a time towards (x, z) */
  const crossTo = (x, z) => {
    for (let k = 0; k < 20; k++) {
      lantern();
      if (go(x, z, 0.6)) return;
      // walk to the furthest lit plank towards the goal
      let best = null, bd = Math.hypot(w.x - x, w.z - z);
      for (const pl of w.areaDef.planks) if (w.isLit(pl.id)) { const d = Math.hypot(pl.x - x, pl.z - z); if (d < bd - 0.5) { bd = d; best = pl; } }
      if (!best || !go(best.x, best.z, 0.3)) throw new Error(`stuck on the bridge at ${w.x.toFixed(1)},${w.z.toFixed(1)}`);
    }
    throw new Error('could not cross');
  };

  settle();
  // ---------------------------------------------------------------- the Rain Terrace
  use(-5.6, 5);
  if (full) { use(6, 12); use(-12.5, 10); use(-12, -3); use(28, -8); use(32, -8); }
  go(0, -4); settle(); // Atoq's plaza: the duel starts by itself
  if (!w.won('atoq')) throw new Error('Atoq was not beaten');
  if (full) use(-5.6, 5);
  go(1.6, -22.2, 0.3); lantern();
  if (!w.has('gate:sun')) throw new Error('the sun-stone did not open the gate');
  travel('forest', 0, -27.6);
  // ---------------------------------------------------------------- the Cloud-Forest Path
  if (full) { use(-2.2, 10.8); use(20, -8.5); use(-1.6, -9.6); }
  use(12.8, -23.5);
  go(11, -26.6, 0.3); crossTo(11, -47);
  settle();
  if (!w.got('jade')) throw new Error('Tupa did not hand over the jade glass');
  if (full) {
    use(19, -51);
    go(2.2, -48.5, 0.3); crossTo(-12, -48.5);
    use(-21.5, -49); use(-23.5, -45.5);
    go(-11, -48.5, 0.4); crossTo(3, -48.5);
  }
  go(10, -54); settle();
  if (!w.won('ambush')) throw new Error('the ambush was not won');
  travel('citadel', 10, -79.4);
  // ---------------------------------------------------------------- the Citadel Gate
  go(0, -3.2, 0.3); lantern();
  if (!w.has('gate:outer')) throw new Error('the jade seal did not open');
  if (full) {
    use(-6, -6.6); use(-12, -23); use(19, -10.5);
    go(-12.3, -15, 0.3); lantern(); if (!w.has('gate:west')) throw new Error('the west door did not open');
    use(-31, -15); use(-33, -11);
  }
  for (const [x, z] of [[-6.6, -15], [0, -17.6], [6.6, -15]]) { go(x, z, 0.3); lantern(); }
  if (!w.has('gate:worlds')) throw new Error('the three stones did not open the inner gate');
  go(0, -33); settle();
  if (!w.done) throw new Error(`the story did not end: ${log.slice(-3).join('; ')}`);
  return { w, log, ticks };
}
/** plays the main path knowing nothing but the quest arrow: walks to `nextGoal`, lifts the lantern where it says to,
 *  reads every talk and fights every duel. Each goal is checked on the way: it is in Dora's area, there is a way to it
 *  on foot, and reaching it moves the story on. Returns the goals it was given, in order */
export function playByGoals({ seed = 1, maxSteps = 200 } = {}) {
  const w = new World(), log = [], goals = [], opts = { seed, assist: true };
  let pressed = false, ticks = 0;
  const step = (inp = idleW()) => {
    if (w.mode === 'talk') { pressed = !pressed; inp = { ...idleW(), act: pressed, choose: w.choosing ? 2 : 0 }; }
    w.tick(inp); ticks++;
    if (w.mode === 'duel') fightDuel(w, opts, log);
    if (ticks > 60 * 60 * 60) throw new Error(`the arrow led nowhere: ${goals.slice(-3).map((g) => g.label).join('; ')}`);
  };
  const settle = () => { let k = 0; while (w.mode !== 'walk' && w.mode !== 'end' && k++ < 6000) step(); };
  const progress = () => `${w.area}|${[...w.flags].sort()}|${[...w.lit].sort()}|${[...w.wonDuels].sort()}|${w.seq}`;
  settle();
  for (let n = 0; n < maxSteps && !w.done; n++) {
    const g = nextGoal(w); if (!g) throw new Error('no goal before the end');
    if (g.area !== w.area) throw new Error(`the goal "${g.label}" is in ${g.area}, Dora is in ${w.area}`);
    if (!path(w, g.x, g.z, 1.2)) throw new Error(`no way on foot to "${g.label}" at ${g.x},${g.z}`);
    goals.push(g); const before = progress();
    // walk the way the arrow leads, a step at a time, until the goal is reached or the story moves on
    for (let k = 0; k < 60 * 120 && progress() === before && !w.done; k++) {
      settle(); if (progress() !== before || w.done) break;
      const d = Math.hypot(g.x - w.x, g.z - w.z);
      if (g.act === 'lantern' && d < 0.5) { step({ ...idleW(), lantern: true }); step(); settle(); break; }
      if (d < 0.25) break;
      const p = d < 1.2 ? null : path(w, g.x, g.z, 0.5); if (d >= 1.2 && (!p || p.length < 2)) break;
      const q = p ? p[Math.min(2, p.length - 1)] : g, dx = q.x - w.x, dz = q.z - w.z, l = Math.hypot(dx, dz) || 1;
      const x0 = w.x, z0 = w.z; for (let s = 0; s < 6; s++) step({ ...idleW(), x: dx / l, z: dz / l });
      // wedged on a corner the grid cut: try the directions nearest the one wanted until one moves
      if (Math.hypot(w.x - x0, w.z - z0) < 0.01 && w.mode === 'walk') {
        const a0 = Math.atan2(dx, dz);
        for (const da of [0.5, -0.5, 1, -1, 1.5, -1.5]) { const x1 = w.x, z1 = w.z; for (let s = 0; s < 8; s++) step({ ...idleW(), x: Math.sin(a0 + da), z: Math.cos(a0 + da) }); if (Math.hypot(w.x - x1, w.z - z1) > 0.05) break; }
      }
    }
    settle();
    if (progress() === before && !w.done) throw new Error(`reaching "${g.label}" did not move the story on (at ${w.area} ${w.x.toFixed(1)},${w.z.toFixed(1)})`);
  }
  if (!w.done) throw new Error('the arrow did not lead to the end');
  return { w, goals, log };
}
export { idleInput };

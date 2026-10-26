// Puttering Paws search helpers, shared by the bot and the engine suite. They drive the compiled engine in .checks/.
import { PuttGame, getHole, DT, PICKUP, tileAt } from '../.checks/putt-game.js';

export const ANGLES = Array.from({ length: 180 }, (_, i) => i * 2);
export const POWERS = [0.03, 0.05, 0.07, 0.1, 0.13, 0.17, 0.21, 0.26, 0.32, 0.38, 0.45, 0.53, 0.62, 0.72, 0.84, 1];
/** Waits worth trying before a putt: four evenly through the shortest repeat of the hole's moving parts (a windmill's
 *  sails repeat every quarter turn, a sleepwalker every full walk). */
export function waitsFor(id) {
  const s = getHole(id).spec, cycles = [...(s.windmills ?? []).map((m) => m.period / 4), ...(s.movers ?? []).map((m) => m.period)];
  if (!cycles.length) return [0];
  const c = Math.min(...cycles); return [0, c / 4, c / 2, (3 * c) / 4].map((w) => Math.round(w * 60) / 60);
}
const timed = (id) => waitsFor(id).length > 1;

// One reusable game per hole: restAt() puts the ball back, so a putt costs only its roll.
const games = new Map();
function gameFor(id) {
  let g = games.get(id);
  if (!g) { g = new PuttGame({ hole: id, players: ['dora'] }); g.autoAim = false; games.set(id, g); }
  return g;
}

/** Plays one putt from a resting state. Returns the next resting state, or { sunk } when it drops. */
export function simulate(id, state, [angle, power, wait = 0]) {
  const g = gameFor(id);
  g.restAt(state.x, state.z, state.clock, state.strokes); g.acorns = state.acorn ? [id] : [];
  for (let t = 0; t < wait - 1e-9; t += DT) g.step();
  g.setAim((angle * Math.PI) / 180, power);
  if (!g.putt()) return null;
  let n = 0;
  while (g.mode !== 'aim' && g.mode !== 'sunk' && n++ < 60 * 40) g.step();
  const acorn = g.acorns.includes(id);
  if (g.mode === 'sunk') { const score = g.scores[0][0]; return { sunk: score < PICKUP, picked: score >= PICKUP, strokes: score, acorn }; }
  return { x: g.ball.x, z: g.ball.z, clock: g.clock, strokes: g.strokes, acorn };
}

/** Lower is closer: tiles to the cup along the course, then a little for straight-line distance, plus strokes spent. */
export function closeness(id, s) {
  const h = getHole(id), t = tileAt(h, s.x, s.z), f = t ? h.flow[t.r][t.c] : Infinity;
  return (Number.isFinite(f) ? f : 99) + Math.hypot(s.x - h.cup.x, s.z - h.cup.z) * 0.05 + s.strokes * 4;
}

/** Beam search for a line of putts that holes out within `limit` strokes (and picks up the acorn when asked). */
export function search(id, { limit, acorn = false, beam = 10, shots } = {}) {
  const h = getHole(id), step = timed(id) ? 4 : 2;
  const grid = shots ?? waitsFor(id).flatMap((w) => ANGLES.filter((a) => a % step === 0).flatMap((a) => POWERS.map((p) => [a, p, w])));
  if (timed(id)) beam = Math.min(beam, 6);
  let layer = [{ state: { x: h.tee.x, z: h.tee.z, clock: 0, strokes: 0, acorn: false }, line: [] }];
  for (let depth = 1; depth <= limit; depth++) {
    const next = new Map();
    for (const { state, line } of layer) {
      for (const shot of grid) {
        const r = simulate(id, state, shot);
        if (!r) continue;
        if (r.sunk && r.strokes <= limit && (!acorn || r.acorn)) return { line: [...line, shot], strokes: r.strokes };
        if (r.sunk || r.picked || r.strokes >= limit) continue;
        const key = `${Math.round(r.x * 4)},${Math.round(r.z * 4)},${r.acorn}`;
        const score = closeness(id, r) - (acorn && r.acorn ? 50 : 0);
        const old = next.get(key);
        if (!old || score < old.score) next.set(key, { state: r, line: [...line, shot], score });
      }
    }
    layer = [...next.values()].sort((a, b) => a.score - b.score).slice(0, beam);
    if (!layer.length) break;
  }
  return null;
}

/** A careful player, the way a person plays: starts from the game's suggested aim (straight at the cup, or at the furthest
 *  bit of course in plain view), tries a little either side of it and every power, picks the one that looks best one putt
 *  ahead, then misses it a little (angle and power noise from `rand`). It never hunts for bank shots across the hole. */
export function noisyRound(id, rand, { angleNoise = 5, powerNoise = 0.2, spread = 16 } = {}) {
  const h = getHole(id), g = gameFor(id);
  let state = { x: h.tee.x, z: h.tee.z, clock: 0, strokes: 0, acorn: false };
  for (let n = 0; n < 12; n++) {
    g.restAt(state.x, state.z, state.clock, state.strokes);
    const aim = (g.suggestAim() * 180) / Math.PI;
    const grid = waitsFor(id).flatMap((w) => Array.from({ length: spread / 2 + 1 }, (_, i) => aim - spread + i * 4).flatMap((a) => POWERS.map((p) => [a, p, w])));
    let best = null, bestScore = Infinity;
    for (const shot of grid) {
      const r = simulate(id, state, shot); if (!r) continue;
      const score = r.sunk ? -100 + shot[1] : r.picked ? 1e6 : closeness(id, r);
      if (score < bestScore) { bestScore = score; best = shot; }
    }
    const missed = [best[0] + (rand() * 2 - 1) * angleNoise, Math.min(1, Math.max(0.02, best[1] * (1 + (rand() * 2 - 1) * powerNoise))), best[2]];
    const r = simulate(id, state, missed);
    if (r.sunk || r.picked) return r.strokes;
    state = r;
  }
  return PICKUP;
}

export function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

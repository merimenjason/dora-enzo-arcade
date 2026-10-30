// Moonhop's search bot, shared by tests/orbit-bot.mjs and the level tools: a breadth-first search over leaps, where
// every leap is played with the real inputs (point at a spot on the moon, hold until the ring reaches a charge, let
// go, and maybe puff once in mid-air) on a copy of the game. A state is the moon the pair stand on and the fireflies
// gathered so far; the first (fewest-leap) way to reach each state is kept. To save time the leaps from one spot share
// their beginnings: the walk and the charge are played once per aim, and each charge level branches off as the ring
// passes it (exactly the inputs `play` gives, so every route found replays with `play`).
import { Hop, play, walkTo, DT } from '../.checks/orbit-game.js';

const TAU = Math.PI * 2;
export const CHARGES = [0.02, 0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92, 1];
export const dynamic = (s) => s.moons.some((m) => m.path || m.spin || m.pulse) || s.flies.some((f) => f.path);
const key = (h) => h.moon + ':' + h.got.map((g) => (g ? 1 : 0)).join('');

/** Plays out the rest of a flight (and any rewind) the way `play` does. */
function land(g, steps) { let k = steps; while (g.mode === 'fly' && k++ < 4000) g.tick({}); while (g.mode === 'lost' && k++ < 4000) g.tick({}); return g; }

/** Every leap the bot tries from one spot, and where each one ends: [{ act, g }]. */
export function leaps(h, { angles = 24, charges = CHARGES, puff = false, waits = null } = {}) {
  const out = [], s = h.s, ws = waits ?? (dynamic(s) ? [0, 1.1, 2.2] : [0]);
  for (const wait of ws) {
    const base = h.clone();
    for (let w = Math.round(wait / DT); w > 0 && base.mode === 'stand'; w--) base.tick({});
    if (base.mode !== 'stand') continue;
    const from = base.moon;
    for (let i = 0; i < angles; i++) {
      const at = -Math.PI + (i * TAU) / angles, w = base.clone();
      const ptr = (q) => [q.mx[q.moon] + Math.cos(at) * 400, q.my[q.moon] + Math.sin(at) * 400];
      let ci = 0, k = 0;
      while (w.mode === 'stand' && w.moon === from && ci < charges.length && k < 4000) {
        if (w.charge >= charges[ci]) {
          const charge = charges[ci++], g = w.clone();
          g.tick({ jump: false, point: ptr(g) });
          if (g.mode !== 'fly') continue;
          const act = { at, charge, wait };
          if (!puff) { out.push({ act, g: land(g, k) }); continue; }
          // fly on, branching off a puff at each moment and direction
          let f = 0;
          for (const t of [0.35, 0.7]) {
            const at2 = Math.max(1, Math.round(t / DT));
            while (g.mode === 'fly' && f < at2 - 1) { g.tick({}); f++; }
            if (g.mode !== 'fly') break;
            for (const dir of [Math.PI / 2, -Math.PI / 2, 0, Math.PI]) {
              const p = g.clone(), d = dir + Math.atan2(p.vy, p.vx);
              p.tick({ jump: true, point: [p.x + Math.cos(d) * 100, p.y + Math.sin(d) * 100] }); p.tick({ jump: false });
              out.push({ act: { ...act, puff: { t, dir, rel: true } }, g: land(p, k) });
            }
          }
          out.push({ act, g: land(g, k) });
          continue;
        }
        w.tick({ jump: true, point: ptr(w) }); k++;
      }
    }
  }
  return out;
}

/** Finds the fewest-leap route home (with the golden firefly when `gold`), or null. `robust` keeps only leaps a
 *  person could repeat: a little off in aim or power still ends the same way. */
export function solve(s, { gold = true, maxLeaps = 14, maxNodes = 400, robust = false, tol = [0.05, 0.035], ...opt } = {}) {
  const start = new Hop(s), seen = new Set([key(start)]);
  let layer = [{ h: start, route: [] }], nodes = 0;
  for (let depth = 0; depth < maxLeaps && layer.length; depth++) {
    const next = [];
    for (const { h, route } of layer) {
      if (++nodes > maxNodes) return null;
      const tries = leaps(h, opt);
      for (const hole of s.holes ?? []) {
        for (const [mi, at] of [[hole.a, hole.aAt], [hole.b, hole.bAt]]) {
          if (mi !== h.moon) continue;
          const g = h.clone(); if (walkTo(g, at)) tries.push({ act: { walk: at }, g });
        }
      }
      for (const { act: a, g } of tries) {
        const r = [...route, a];
        if (g.done) { if ((!gold || g.goldGot()) && (!robust || 'walk' in a || steady(h, a, g, tol))) return { route: r, leaps: g.leaps, time: g.result().time, nodes }; continue; }
        if (g.mode !== 'stand') continue;
        const k = key(g); if (seen.has(k)) continue;
        if (robust && !('walk' in a) && !steady(h, a, g, tol)) continue;
        seen.add(k); next.push({ h: g, route: r });
      }
    }
    layer = next;
  }
  return null;
}

/** A leap a person could repeat: a little off in aim or power still ends the same way. */
function steady(h, a, g, [ta, tc] = [0.05, 0.035]) {
  const want = g.done ? 'done' : key(g);
  for (const [da, dc] of [[ta, 0], [-ta, 0], [0, tc], [0, -tc]]) {
    const b = { ...a, at: a.at + da, charge: Math.min(1, Math.max(0.01, a.charge + dc)) };
    const k = h.clone();
    if (!play(k, b)) return false;
    if ((k.done ? 'done' : key(k)) !== want) return false;
  }
  return true;
}

/** Replays a route with `play` and reports how it went. */
export function check(s, route) {
  const h = new Hop(s);
  for (const st of route) { if (h.done) break; if ('walk' in st) walkTo(h, st.walk); else play(h, st); }
  return h;
}

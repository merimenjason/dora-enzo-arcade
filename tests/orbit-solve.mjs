// Moonhop's search bot, shared by tests/orbit-bot.mjs and the level tools: a breadth-first search over leaps, where
// every leap is played with the real inputs (point at a spot on the moon, hold until the ring reaches a charge, let
// go, and maybe puff once in mid-air) on a copy of the game. A state is the moon the pair stand on and the fireflies
// gathered so far; the first (fewest-leap) way to reach each state is kept.
import { Hop, play, walkTo } from '../.checks/orbit-game.js';

const TAU = Math.PI * 2;
export const dynamic = (s) => s.moons.some((m) => m.path || m.spin || m.pulse) || s.flies.some((f) => f.path);
const key = (h) => h.moon + ':' + h.got.map((g) => (g ? 1 : 0)).join('');

/** All the leaps the bot tries from one standing spot. */
export function actions(s, { angles = 24, charges = [0.02, 0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92, 1], puff = false, waits = null } = {}) {
  const out = [], ws = waits ?? (dynamic(s) ? [0, 1.1, 2.2] : [0]);
  for (const wait of ws) for (let i = 0; i < angles; i++) for (const charge of charges) {
    const at = -Math.PI + (i * TAU) / angles;
    out.push({ at, charge, wait });
    if (puff) for (const t of [0.35, 0.7]) for (const dir of [Math.PI / 2, -Math.PI / 2, 0, Math.PI]) out.push({ at, charge, wait, puff: { t, dir, rel: true } });
  }
  return out;
}

/** Finds the fewest-leap route home (with the golden firefly when `gold`), or null. */
export function solve(s, { gold = true, maxLeaps = 14, maxNodes = 400, robust = false, ...opt } = {}) {
  const start = new Hop(s), seen = new Set([key(start)]);
  let layer = [{ h: start, route: [] }], nodes = 0;
  const acts = actions(s, opt);
  for (let depth = 0; depth < maxLeaps && layer.length; depth++) {
    const next = [];
    for (const { h, route } of layer) {
      if (++nodes > maxNodes) return null;
      const tries = [...acts];
      for (const hole of s.holes ?? []) {
        if (hole.a === h.moon) tries.push({ walk: hole.aAt });
        if (hole.b === h.moon) tries.push({ walk: hole.bAt });
      }
      for (const a of tries) {
        const g = h.clone();
        if ('walk' in a) { if (!walkTo(g, a.walk)) continue; }
        else if (!play(g, a)) continue;
        const r = [...route, a];
        if (g.done) { if ((!gold || g.goldGot()) && (!robust || 'walk' in a || steady(h, a, g))) return { route: r, leaps: g.leaps, time: g.result().time, nodes }; continue; }
        if (g.mode !== 'stand') continue;
        const k = key(g); if (seen.has(k)) continue;
        if (robust && !('walk' in a) && !steady(h, a, g)) continue;
        seen.add(k); next.push({ h: g, route: r });
      }
    }
    layer = next;
  }
  return null;
}

/** A leap a person could repeat: a little off in aim or power still ends the same way. */
function steady(h, a, g) {
  const want = g.done ? 'done' : key(g);
  for (const [da, dc] of [[0.05, 0], [-0.05, 0], [0, 0.035], [0, -0.035]]) {
    const b = { ...a, at: a.at + da, charge: Math.min(1, Math.max(0.01, a.charge + dc)) };
    const k = h.clone();
    if (!play(k, b)) return false;
    if ((k.done ? 'done' : key(k)) !== want) return false;
  }
  return true;
}

/** Replays a route and reports how it went. */
export function check(s, route) {
  const h = new Hop(s);
  for (const st of route) { if (h.done) break; if ('walk' in st) walkTo(h, st.walk); else play(h, st); }
  return h;
}

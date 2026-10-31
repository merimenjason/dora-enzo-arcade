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
/** Where a leap ends: the moon and the fireflies, or home with the fireflies (so a last leap that snatches the
 *  golden firefly on the way in must snatch it every time). */
const end = (h) => (h.done ? 'done:' : '') + key(h);

/** Plays out the rest of a flight (and any rewind) the way `play` does. */
function land(g, steps) { let k = steps; while (g.mode === 'fly' && k++ < 4000) g.tick({}); while (g.mode === 'lost' && k++ < 4000) g.tick({}); return g; }

/** Every leap the bot tries from one spot, and where each one ends, one at a time: { act, g }. */
function* tryLeaps(h, { angles = 24, charges = CHARGES, puff = false, waits = null } = {}) {
  const s = h.s, ws = waits ?? (dynamic(s) ? [0, 1.1, 2.2] : [0]);
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
          if (!puff) { yield { act, g: land(g, k) }; continue; }
          // fly on, branching off a puff at each moment and direction
          let f = 0;
          for (const t of [0.35, 0.7]) {
            const at2 = Math.max(1, Math.round(t / DT));
            while (g.mode === 'fly' && f < at2 - 1) { g.tick({}); f++; }
            if (g.mode !== 'fly') break;
            for (const dir of [Math.PI / 2, -Math.PI / 2, 0, Math.PI]) {
              const p = g.clone(), d = dir + Math.atan2(p.vy, p.vx);
              p.tick({ jump: true, point: [p.x + Math.cos(d) * 100, p.y + Math.sin(d) * 100] }); p.tick({ jump: false });
              yield { act: { ...act, puff: { t, dir, rel: true } }, g: land(p, k) };
            }
          }
          yield { act, g: land(g, k) };
          continue;
        }
        w.tick({ jump: true, point: ptr(w) }); k++;
      }
    }
  }
}
/** Every leap the bot tries from one spot, and where each one ends: [{ act, g }]. */
export function leaps(h, opt = {}) { return [...tryLeaps(h, opt)]; }

/** Everything the bot tries from one spot, in order: the hinted step first (when there is one), then every leap,
 *  then walking into each rabbit hole there. */
function* tries(h, s, opt, hinted) {
  if (hinted) {
    const g = h.clone();
    if ('walk' in hinted) { if (walkTo(g, hinted.walk)) yield { act: hinted, g, hint: true }; }
    else if ((opt.puff || !hinted.puff) && play(g, hinted)) yield { act: hinted, g, hint: true }; // no puffs in a search without them
  }
  yield* tryLeaps(h, opt);
  for (const hole of s.holes ?? []) {
    for (const [mi, at] of [[hole.a, hole.aAt], [hole.b, hole.bAt]]) {
      if (mi !== h.moon) continue;
      const g = h.clone(); if (walkTo(g, at)) yield { act: { walk: at }, g };
    }
  }
}

/** Finds the fewest-leap route home (with the golden firefly when `gold`), or null. `robust` keeps only leaps a
 *  person could repeat: a little off in aim or power still ends the same way. `hint` is a route found before (the
 *  saved one): it only changes the order things are tried in, never what counts, so the route found still has the
 *  fewest leaps (every shorter layer is searched in full), but when the hint still works its layer finds the way home
 *  first instead of last, and the search stops as soon as the way home turns up. */
export function solve(s, { gold = true, maxLeaps = 14, maxNodes = 400, robust = false, tol = TOL, hint = null, stats = null, ...opt } = {}) {
  const start = new Hop(s), seen = new Set([key(start)]);
  let layer = [{ h: start, route: [], onHint: !!hint?.length }], nodes = 0;
  for (let depth = 0; depth < maxLeaps && layer.length; depth++) {
    const next = [];
    for (const { h, route, onHint } of layer) {
      if (++nodes > maxNodes) { if (stats) stats.capped = true; return null; }
      for (const { act: a, g, hint: fromHint } of tries(h, s, opt, onHint ? hint[depth] : null)) {
        const r = [...route, a];
        if (g.done) { if ((!gold || g.goldGot()) && (!robust || 'walk' in a || steady(h, a, g, tol))) return { route: r, leaps: g.leaps, time: g.result().time, nodes }; continue; }
        if (g.mode !== 'stand') continue;
        const k = key(g); if (seen.has(k)) continue;
        if (robust && !('walk' in a) && !steady(h, a, g, tol)) continue;
        seen.add(k);
        // the hinted route's next spot goes first in its layer
        if (fromHint && depth + 1 < hint.length) next.unshift({ h: g, route: r, onHint: true });
        else next.push({ h: g, route: r, onHint: false });
      }
    }
    layer = next;
  }
  return null;
}

/** How far off a repeatable leap may be: aim (rad) and charge either way. */
export const TOL = [0.05, 0.035];
/** A leap a person could repeat: anywhere up to `tol` off in aim or in power still ends the same way, checked every
 *  0.005 rad of aim and every step of the ring (it fills 1/132 a step), so there is no gap in the middle that only an
 *  exact hand would find. The outermost offsets go first: they are the likeliest to fail. */
export function steadyLeap(...a) { return steady(...a); }
const AIM_Q = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1], POW_Q = [1, 0.8, 0.6, 0.4, 0.2];
function steady(h, a, g, [ta, tc] = TOL) {
  const want = end(g);
  const same = (da, dc) => {
    const k = h.clone();
    return play(k, { ...a, at: a.at + da, charge: Math.min(1, Math.max(0.01, a.charge + dc)) }) && end(k) === want;
  };
  for (const q of AIM_Q) if (!same(ta * q, 0) || !same(-ta * q, 0)) return false;
  for (const q of POW_Q) if (!same(0, tc * q) || !same(0, -tc * q)) return false;
  return true;
}

/** The narrowest leap of a route: how far its aim (rad) and its power can each go wrong, either way, before some leap
 *  ends differently (measured outwards in `step`s up to `cap`, so a window is the clean stretch round the leap). */
export function window(s, route, { step = [0.005, 0.007], cap = [0.12, 0.084] } = {}) {
  const h = new Hop(s);
  let aim = cap[0], power = cap[1];
  const reach = (st, want, f, i) => {
    for (let d = step[i]; d <= cap[i] + 1e-9; d += step[i]) {
      const b = f(d); if (!b) return cap[i];
      const k = h.clone();
      if (!play(k, b) || end(k) !== want) return d - step[i];
    }
    return cap[i];
  };
  for (const st of route) {
    if (h.done) break;
    if ('walk' in st) { walkTo(h, st.walk); continue; }
    const g = h.clone(); play(g, st); const want = end(g);
    aim = Math.min(aim, reach(st, want, (d) => ({ ...st, at: st.at + d }), 0), reach(st, want, (d) => ({ ...st, at: st.at - d }), 0));
    // a full ring can't be overcharged, and a tap can't be undercharged
    power = Math.min(power, reach(st, want, (d) => (st.charge + d > 1 + 1e-9 ? null : { ...st, charge: st.charge + d }), 1), reach(st, want, (d) => (st.charge - d < 0.01 ? null : { ...st, charge: st.charge - d }), 1));
    play(h, st);
  }
  return { aim, power };
}

/** Checks a route found before, leap by leap: it gets home with every firefly (and the golden one when `gold`) and
 *  every leap is one a person could repeat. Returns { leaps, time } or null. */
export function verify(s, route, { gold = true, tol = TOL } = {}) {
  const h = new Hop(s);
  for (const st of route) {
    if (h.done) return null;
    if ('walk' in st) { if (!walkTo(h, st.walk)) return null; continue; }
    const g = h.clone();
    if (!play(g, st) || !steady(h, st, g, tol)) return null;
    play(h, st);
  }
  for (let k = 0; k < 4 && !h.done; k++) h.tick({});
  return h.done && h.got.every((on, i) => on || (s.flies[i].gold && !gold)) ? { leaps: h.leaps, time: h.result().time } : null;
}

/** Replays a route with `play` and reports how it went. */
export function check(s, route) {
  const h = new Hop(s);
  for (const st of route) { if (h.done) break; if ('walk' in st) walkTo(h, st.walk); else play(h, st); }
  return h;
}

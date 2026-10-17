// Solvers for the test suite: each reads a microgame's state and returns a raw Frame.
// Tasks 3-6 fill SOLVERS and push their host index onto READY_HOSTS.
import { IDLE } from '../.checks/whisker-ware-game.js';

export const SOLVERS = {};
export const READY_HOSTS = [];

// ── Enzo · Snack Shack ────────────────────────────────────────────────────────

SOLVERS.stuff = (s, t) => ({ ...IDLE, down: t % 2 === 0 });

// Plans backwards from the last landing: at each landing the bowl must stand in a set from which every later landing is still reachable.
const meet = (A, B) => {
  const out = [];
  for (const [a, b] of A) for (const [c, d] of B) { const lo = Math.max(a, c), hi = Math.min(b, d); if (lo <= hi) out.push([lo, hi]); }
  return out;
};
const grow = (A, d) => A.map(([a, b]) => [Math.max(34, a - d), Math.min(446, b + d)]);
SOLVERS.catch = s => {
  const events = s.items.map(m => ({ kind: m.kind, x: m.x, at: s.t + (250 - m.y) / m.v }));
  for (let k = s.spawned; k < s.queue.length; k++) events.push({ kind: s.queue[k].kind, x: s.queue[k].x, at: k * s.gap + 1 + 270 / (2.4 + 0.3 * k) });
  events.sort((p, q) => p.at - q.at);
  const fit = e => (e.kind === 'raisin' ? [[e.x - 28, e.x + 28]] : [[34, e.x - 42], [e.x + 42, 446]]);
  let G = [[34, 446]];
  const sets = [];
  for (let k = events.length - 1; k >= 0; k--) {
    G = meet(k === events.length - 1 ? G : grow(G, (events[k + 1].at - events[k].at) * 5.4), fit(events[k]));
    sets[k] = G;
  }
  let tx = s.bowl.x;
  if (events.length && sets[0].length) {
    let best = Infinity;
    for (const [a, b] of sets[0]) { const c = Math.max(a, Math.min(b, s.bowl.x)); if (Math.abs(c - s.bowl.x) < best) { best = Math.abs(c - s.bowl.x); tx = c; } }
  }
  return { ...IDLE, x: tx, y: 260 };
};

SOLVERS.sort = (s, t) => {
  if (!s.item) return IDLE;
  const on = t % 2 === 0;
  return s.item.kind === 'acorn' ? { ...IDLE, right: on } : { ...IDLE, left: on };
};

SOLVERS.sniff = s => (s.open ? { ...IDLE, pick: s.slot[s.raisin] + 1 } : IDLE);

SOLVERS.gnaw = s => ({ ...IDLE, down: Math.abs(s.notch - 180) < s.window / 2 - 1 && s.t > 0 && s.notch < 400 });

// Same planner as catch, but raisins are optional: take one only if every pebble after it can still be dodged.
const without = (R, e) => {
  const out = [];
  for (const [a, b] of R) { if (a < e.x - 42) out.push([a, Math.min(b, e.x - 42)]); if (b > e.x + 42) out.push([Math.max(a, e.x + 42), b]); }
  return out;
};
SOLVERS.raisin = s => {
  const mult = [1, 1.08, 1.16][s.level - 1];
  const events = s.items.map(m => ({ kind: m.kind, x: m.x, at: s.t + (250 - m.y) / m.v }));
  let next = s.next;
  for (let k = s.spawned; k < s.queue.length && events.length < 14; k++) {
    const t = next + 1, ramp = Math.min(1, t / 600), v = (2.6 + 1.6 * ramp) * mult;
    events.push({ kind: s.queue[k].kind, x: [120, 240, 360][s.queue[k].chute], at: t + 270 / v });
    next += Math.round(40 - 18 * ramp);
  }
  events.sort((p, q) => p.at - q.at);
  const dodges = (R, from, at) => {
    for (let k = from; k < events.length; k++) {
      R = grow(R, (events[k].at - at) * 5.4); at = events[k].at;
      if (events[k].kind === 'pebble') { R = without(R, events[k]); if (!R.length) return false; }
    }
    return true;
  };
  let R = [[s.bowl.x, s.bowl.x]], at = s.t;
  const chosen = [];
  for (let k = 0; k < events.length; k++) {
    const e = events[k];
    R = grow(R, (e.at - at) * 5.4); at = e.at;
    if (e.kind === 'pebble') { const w = without(R, e); if (w.length) R = w; chosen.push(e); continue; }
    const c = meet(R, [[e.x - 28, e.x + 28]]);
    if (c.length && dodges(c, k + 1, at)) { R = c; chosen.push(e); }
  }
  let G = [[34, 446]];
  const sets = [];
  for (let k = chosen.length - 1; k >= 0; k--) {
    const fitK = chosen[k].kind === 'raisin' ? [[chosen[k].x - 28, chosen[k].x + 28]] : [[34, chosen[k].x - 42], [chosen[k].x + 42, 446]];
    G = meet(k === chosen.length - 1 ? G : grow(G, (chosen[k + 1].at - chosen[k].at) * 5.4), fitK);
    sets[k] = G;
  }
  let tx = s.bowl.x;
  if (chosen.length && sets[0].length) {
    let best = Infinity;
    for (const [a, b] of sets[0]) { const c = Math.max(a, Math.min(b, s.bowl.x)); if (Math.abs(c - s.bowl.x) < best) { best = Math.abs(c - s.bowl.x); tx = c; } }
  }
  return { ...IDLE, x: tx, y: 260 };
};

READY_HOSTS.push(0);

// ── Dora · Dust Spa ───────────────────────────────────────────────────────────

SOLVERS.dust = (s, t) => ({ ...IDLE, left: Math.floor(t / 3) % 2 === 0, right: Math.floor(t / 3) % 2 === 1 });

SOLVERS.balance = s => ({ ...IDLE, left: s.tilt > 0.05, right: s.tilt < -0.05 });

SOLVERS.fluff = s => ({ ...IDLE, down: s.size < s.centre });

SOLVERS.hop = s => {
  if (s.jump) return IDLE;
  const log = s.logs.find(l => l.x > 90);
  return { ...IDLE, down: !!log && log.x - s.dora.x <= 70 };
};

SOLVERS.comb = s => {
  const left = s.tangles.filter(g => !g.done);
  if (!left.length) return IDLE;
  left.sort((a, b) => Math.hypot(a.x - s.comb.x, a.y - s.comb.y) - Math.hypot(b.x - s.comb.x, b.y - s.comb.y));
  return { ...IDLE, x: left[0].x, y: left[0].y, down: true };
};

SOLVERS.shelf = (s, t) => {
  const next = s.shelves[s.level];
  return { ...IDLE, down: !!next && Math.abs(next.x - s.dora.x) <= 20 && t % 2 === 0 };
};

READY_HOSTS.push(1);

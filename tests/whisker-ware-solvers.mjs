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

// ── The Owl · Night Watch ─────────────────────────────────────────────────────

// Walk while her back is turned; let go as soon as she starts to turn.
SOLVERS.sneak = s => ({ ...IDLE, down: s.owl === 'back' });

SOLVERS.hide = s => ({ ...IDLE, x: s.shadow.x, y: 270 });

SOLVERS.hush = s => {
  const live = s.toys.filter(g => g.state === 'squeak').sort((a, b) => a.at - b.at);
  return live.length ? { ...IDLE, pick: live[0].spot + 1 } : IDLE;
};

SOLVERS.find = s => ({ ...IDLE, x: s.acorn.x, y: s.acorn.y, down: Math.hypot(s.acorn.x - s.lantern.x, s.acorn.y - s.lantern.y) < 10 });

// Plans a path on a 5-unit grid: mark every (tick, cell) a known feather would hit (those in the air, plus the planned
// ones still to spawn), then work backwards for the cells from which Dora can keep clear until the end, and walk forwards
// through them. A plan is kept until a feather spawns or Dora strays from it.
const CELLS = 87, HORIZON = 150, cellX = i => 25 + 5 * i;
const plans = new WeakMap();
function planDodge(s) {
  const bad = Array.from({ length: HORIZON + 2 }, () => new Uint8Array(CELLS));
  const feathers = s.feathers.map(f => ({ ...f }));
  for (let k = s.spawned; k < s.plan.length; k++) {
    const at = k * s.gap + 1 - s.t;
    if (k % 3 === 0 || k * s.gap > 270 || at > HORIZON) continue;
    const p = s.plan[k];
    feathers.push({ x0: p.x, ph: p.ph, age: -at, y: -20 - s.v * at, v: s.v });
  }
  for (const f of feathers) for (let tau = 1; tau <= HORIZON + 1; tau++) {
    const y = f.y + f.v * tau;
    if (y < 244 - 8 || y > 296 + 8) continue;
    const x = f.x0 + 17.14 * Math.sin(f.ph + 0.07 * (f.age + tau));
    for (let i = Math.max(0, Math.ceil((x - 31 - 25) / 5)); i <= Math.min(CELLS - 1, Math.floor((x + 31 - 25) / 5)); i++) bad[tau][i] = 1;
  }
  const ok = Array.from({ length: HORIZON + 2 }, () => new Uint8Array(CELLS));
  for (let i = 0; i < CELLS; i++) ok[HORIZON + 1][i] = bad[HORIZON + 1][i] ? 0 : 1;
  for (let tau = HORIZON; tau >= 1; tau--) for (let i = 0; i < CELLS; i++) {
    if (!bad[tau][i] && (ok[tau + 1][i] || (i > 0 && ok[tau + 1][i - 1]) || (i < CELLS - 1 && ok[tau + 1][i + 1]))) ok[tau][i] = 1;
  }
  let i = Math.round((s.dora.x - 25) / 5);
  const path = [i];
  for (let tau = 1; tau <= HORIZON; tau++) {
    let pick = -1;
    for (const d of [0, -1, 1]) { const j = i + d; if (j >= 0 && j < CELLS && ok[tau][j] && (pick < 0 || Math.abs(j - 43) < Math.abs(pick - 43) - 2)) pick = j; }
    if (pick < 0) pick = i;
    path.push(pick); i = pick;
  }
  return { t0: s.t, spawned: s.spawned, path };
}
SOLVERS.dodge = s => {
  let p = plans.get(s);
  const k = p ? s.t - p.t0 : 0;
  if (!p || p.spawned !== s.spawned || k >= HORIZON - 4 || Math.abs(s.dora.x - cellX(p.path[k])) > 6) { p = planDodge(s); plans.set(s, p); p.last = s.t - 1; }
  // steps this real tick will run = steps the last one ran (1 at tier 0, 2 at tier 5)
  const stride = Math.max(1, s.t - p.last);
  p.last = s.t;
  return { ...IDLE, x: cellX(p.path[Math.min(HORIZON, s.t - p.t0 + stride)]), y: 270 };
};

SOLVERS.moon = s => {
  if (s.jump) return IDLE;
  const h = s.hazards.find(g => g.x + g.w > s.dora.x);
  return { ...IDLE, down: !!h && h.x - s.dora.x <= 18 };
};

READY_HOSTS.push(2);

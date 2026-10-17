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

// One held arrow per item: a single swipe each, so nothing is left over to hit the next item.
SOLVERS.sort = s => (!s.item ? IDLE : s.item.kind === 'acorn' ? { ...IDLE, right: true } : { ...IDLE, left: true });

SOLVERS.sniff = s => (s.open ? { ...IDLE, pick: s.slot[s.raisin] + 1 } : IDLE);

// Bites as the notch reaches the middle of the tooth.
SOLVERS.gnaw = s => ({ ...IDLE, down: s.t > 0 && s.notch <= s.tooth + 1 });

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

// Leans back once the tilt is plain to see, as a player would.
SOLVERS.balance = s => ({ ...IDLE, left: s.tilt > 0.3, right: s.tilt < -0.3 });

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

// Held while the next shelf is lined up: one press per shelf.
SOLVERS.shelf = s => {
  const next = s.shelves[s.level];
  return { ...IDLE, down: !!next && Math.abs(next.x - s.dora.x) <= 20 };
};

READY_HOSTS.push(1);

// ── The Owl · Night Watch ─────────────────────────────────────────────────────

// Walk while her back is turned; let go as soon as she starts to turn.
// Waits until the Owl has properly turned away before setting off again.
SOLVERS.sneak = s => ({ ...IDLE, down: s.owl === 'back' && s.phase > 9 });

SOLVERS.hide = s => ({ ...IDLE, x: s.shadow.x, y: 270 });

SOLVERS.hush = s => {
  const live = s.toys.filter(g => g.state === 'squeak').sort((a, b) => a.at - b.at);
  return live.length ? { ...IDLE, pick: live[0].spot + 1 } : IDLE;
};

SOLVERS.find = s => ({ ...IDLE, x: s.acorn.x, y: s.acorn.y, down: Math.hypot(s.acorn.x - s.lantern.x, s.acorn.y - s.lantern.y) < 10 });

// Dodges by eye: stands still until a feather will pass through Dora's spot in the next 60 ticks, then steps to the nearest
// spot that stays clear and can be reached without running into another feather on the way, and keeps to that spot while
// it stays clear rather than changing its mind.
const SWAY = 1.2 / 0.07, goals = new WeakMap();
SOLVERS.dodge = s => {
  const fs = s.feathers.map(f => ({ f, k0: (244 - f.y) / f.v, k1: (296 - f.y) / f.v })).filter(o => o.k1 >= 0 && o.k0 <= 60);
  const at = (o, k) => o.f.x0 + SWAY * Math.sin(o.f.ph + 0.07 * (o.f.age + k));
  // is x clear by `gap` of every feather at Dora's height between ticks a and b from now?
  const clear = (x, a, b, gap) => fs.every(o => {
    for (let k = Math.max(a, o.k0); k <= Math.min(b, o.k1); k += 2) if (Math.abs(at(o, k) - x) < gap) return false;
    return true;
  });
  const goal = goals.get(s);
  if (goal !== undefined && goal !== s.dora.x && clear(goal, Math.abs(goal - s.dora.x) / 5, 60, 30)) return { ...IDLE, x: goal, y: 270 };
  goals.delete(s);
  if (clear(s.dora.x, 0, 60, 30)) return { ...IDLE, x: s.dora.x, y: 270 };
  let best = s.dora.x, d = Infinity;
  for (let x = 24; x <= 456; x += 4) {
    const dist = Math.abs(x - s.dora.x);
    if (dist >= d || !clear(x, dist / 5, 60, 34)) continue;
    let ok = true;
    for (let p = 0; p <= dist && ok; p += 5) ok = clear(s.dora.x + Math.sign(x - s.dora.x) * p, p / 5, p / 5 + 1, 24);
    if (ok) { d = dist; best = x; }
  }
  goals.set(s, best);
  return { ...IDLE, x: best, y: 270 };
};

SOLVERS.moon = s => {
  if (s.jump) return IDLE;
  const h = s.hazards.find(g => g.x + g.w > s.dora.x);
  return { ...IDLE, down: !!h && h.x - s.dora.x <= 18 };
};

READY_HOSTS.push(2);

// ── The Fox · Trick Fair ──────────────────────────────────────────────────────

SOLVERS.pick = s => (s.open ? { ...IDLE, pick: s.slot[s.cards.findIndex(c => c.suit === s.target)] + 1 } : IDLE);

SOLVERS.pop = s => {
  let lane = -1, best = Infinity;
  for (const b of s.balloons) if (b.state === 'up' && b.y <= 320 && b.y < best) { best = b.y; lane = b.lane; }
  return lane < 0 ? IDLE : { ...IDLE, pick: lane + 1 };
};

// Holds Space through the swing and lets go as the power crosses the middle of the band.
SOLVERS.aim = s => ({ ...IDLE, down: !(s.mode === 'swing' && (s.rising ? s.power >= s.centre - 0.005 : s.power <= s.centre + 0.005)) });

SOLVERS.stack = s => ({ ...IDLE, down: !!s.crate && !s.crate.falling && Math.abs(s.crate.x - s.top.x) <= 10 });

SOLVERS.count = s => (s.open ? { ...IDLE, pick: s.right + 1 } : IDLE);

// Throws when a peg will be under the ring as it lands, 30 ticks from now.
SOLVERS.ring = s => {
  if (s.flying || !s.left) return IDLE;
  const ahead = s.pegs.some(p => Math.abs(((p.x + s.v * 30) % 480) - 240) <= 10);
  return { ...IDLE, down: ahead };
};

READY_HOSTS.push(3);

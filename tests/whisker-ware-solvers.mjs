// Solvers for the test suite: each reads a microgame's state and returns a raw Frame.
// Tasks 3-6 fill SOLVERS and push their host index onto READY_HOSTS.
import { IDLE } from '../.checks/whisker-ware-game.js';

export const SOLVERS = {};
export const READY_HOSTS = [];

// ── Enzo · Snack Shack ────────────────────────────────────────────────────────

SOLVERS.stuff = (s, t) => ({ ...IDLE, down: t % 2 === 0 });

SOLVERS.catch = s => {
  const bx = s.bowl.x;
  const raisins = s.items.filter(m => m.kind === 'raisin');
  const r = raisins.length ? raisins.reduce((a, b) => (b.y > a.y ? b : a)) : null;
  let tx = r ? r.x : bx;
  // a pebble that lands before the raisin is a wall: never stand within 50 of it, never cross it
  for (const p of s.items) {
    if (p.kind !== 'pebble' || (r && p.y <= r.y)) continue;
    if (Math.abs(bx - p.x) < 50) tx = p.x + (p.x > 240 ? -80 : 80);
    else if (Math.abs(tx - p.x) < 50 || (bx - p.x) * (tx - p.x) < 0) tx = p.x + (bx < p.x ? -50 : 50);
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

SOLVERS.raisin = s => {
  const bx = s.bowl.x;
  const danger = new Set(s.items.filter(m => m.kind === 'pebble' && m.y > 100).map(m => m.chute));
  let best = null, bestEta = 1e9;
  for (const m of s.items) {
    if (m.kind !== 'raisin' || m.y > 250) continue;
    if (s.items.some(p => p.kind === 'pebble' && p.chute === m.chute && p.y > m.y)) continue;
    const eta = (250 - m.y) / m.v;
    if (Math.abs(m.x - bx) / 6 > eta - 1) continue;
    if (eta < bestEta) { best = m; bestEta = eta; }
  }
  let tx = best ? best.x : bx;
  if (!best && danger.has(Math.round((bx - 120) / 120))) {
    const safe = [0, 1, 2].filter(c => !danger.has(c)).map(c => 120 + 120 * c);
    if (safe.length) tx = safe.reduce((a, b) => (Math.abs(b - bx) < Math.abs(a - bx) ? b : a));
  }
  return { ...IDLE, x: tx, y: 260 };
};

READY_HOSTS.push(0);

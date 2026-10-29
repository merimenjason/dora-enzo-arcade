// A human-like climbing bot for Ropeclimb that plays the real engine in 1 player mode, steering one climber at a time
// while the other holds on. From each settled spot it tries the moves a player would: walking to a ledge's edge, its
// middle, or the tub, and leaps of several strengths and aims, with or without claws out. It plays each move forward
// on a copy of the game (hauling a dangling partner up if a leap ends on the rope) and searches best-first for a way to
// the next dust-bath tub. Then it plays that route for real with a human's wobble on every charge and aim, and plans
// again whenever a leap goes wrong. It must climb every floor from its tub, and the pair standing still must get
// nowhere. `node tests/ropeclimb-bot.mjs` climbs all twelve floors; `--quick` climbs three (what `npm test` runs).
import assert from 'node:assert/strict';
import { RopeclimbGame, Rng, idleInput, TUB_COUNT, HZ, BODY, clockText } from '../.checks/ropeclimb-game.js';

const QUICK = process.argv.includes('--quick');
const HARD = process.argv.includes('--hard');
const VERBOSE = process.argv.includes('--verbose');
const only = process.argv.find((a) => a.startsWith('--floor='));
const CHARGES = [0.1, 0.35, 0.6, 0.8, 1];
const AIMS = [-1, -0.55, 0, 0.55, 1];
const BUDGET = { expand: 260, settle: 300, haul: 300, walk: 160 };

const pad = (inp, who) => inp[who];
/** Plays one move on `g` (mutating it); returns false if the move makes no sense from here. */
function play(g, a, wobble = null) {
  const swapTo = (who) => { if (g.active !== who) { const inp = idleInput(); inp.swap = true; g.step(inp); } };
  if (a.k === 'walk') {
    const c = g.c(a.who); if (c.mode !== 'stand') return false;
    swapTo(a.who);
    for (let i = 0; i < BUDGET.walk; i++) {
      const d = a.x - g.c(a.who).x; if (Math.abs(d) < 3) break;
      const inp = idleInput(); pad(inp, a.who).x = Math.max(-1, Math.min(1, d / 10)); g.step(inp);
      if (g.c(a.who).mode !== 'stand') break;
    }
  } else if (a.k === 'leap') {
    const c = g.c(a.who); if (c.mode !== 'stand' && c.mode !== 'grip') return false;
    swapTo(a.who);
    const charge = Math.max(0, Math.min(1, a.charge + (wobble ? wobble.range(-0.05, 0.05) : 0)));
    const aim = a.aim === 0 ? 0 : Math.max(-1, Math.min(1, a.aim + (wobble ? wobble.range(-0.08, 0.08) : 0)));
    const hold = Math.max(1, Math.round(charge * 0.75 * HZ));
    for (let i = 0; i < hold; i++) { const inp = idleInput(); const p = pad(inp, a.who); p.jump = true; p.grip = c.mode === 'grip'; p.x = aim * 0.1; g.step(inp); }
    // release, steering toward the aim and with claws out if this move wants them
    for (let i = 0; i < 90; i++) {
      const inp = idleInput(), p = pad(inp, a.who); p.x = aim; p.grip = a.grip && i > 6; g.step(inp);
      if (i > 2 && g.c(a.who).mode !== 'air') break;
    }
  } else if (a.k === 'shimmy') {
    const c = g.c(a.who); if (c.mode !== 'grip' || c.grip?.k !== 'post') return false;
    swapTo(a.who);
    for (let i = 0; i < 100; i++) { const inp = idleInput(), p = pad(inp, a.who); p.up = true; p.grip = true; g.step(inp); }
  } else if (a.k === 'wait') {
    for (let i = 0; i < a.t; i++) { const inp = idleInput(); g.step(inp); }
  }
  settle(g);
  return true;
}
/** Lets things come to rest; if a partner is left dangling, the one holding on hauls them up. */
function settle(g) {
  for (let i = 0; i < BUDGET.settle && !g.stable() && g.phase !== 'won'; i++) {
    const inp = idleInput(), me = g.c(g.active);
    if (me.mode === 'air') { pad(inp, g.active).grip = true; }
    g.step(inp);
    // dangling on the rope with nothing to grab: let the partner haul
    if (i > 40 && me.mode === 'air' && g.loaded(g.c(g.active === 'dora' ? 'enzo' : 'dora'))) {
      const swap = idleInput(); swap.swap = true; g.step(swap);
      for (let j = 0; j < BUDGET.haul && !g.stable(); j++) { const h = idleInput(); pad(h, g.active).up = true; pad(h, g.active).grip = true; g.step(h); }
    }
  }
}

/** The moves worth trying from here. */
function moves(g) {
  const out = [], tub = g.world.tubs[g.tub + 1];
  for (const who of ['dora', 'enzo']) {
    const c = g.c(who);
    if (c.mode === 'stand' && c.on >= 0 && c.on < 1000) {
      const s = g.world.solids[c.on], lo = Math.max(s.x, BODY.hw) + 3, hi = Math.min(s.x + s.w, 480 - BODY.hw) - 3;
      for (const x of [lo, (lo + hi) / 2, hi]) if (Math.abs(x - c.x) > 8) out.push({ k: 'walk', who, x });
      if (tub && Math.abs(c.y - tub.y) < 2) out.push({ k: 'walk', who, x: tub.x + (who === 'dora' ? -12 : 12) });
    }
    if (c.mode === 'grip' && c.grip?.k === 'post') out.push({ k: 'shimmy', who });
    // claws out, as the game plays by default
    if (c.mode === 'stand' || c.mode === 'grip') for (const charge of CHARGES) for (const aim of AIMS) out.push({ k: 'leap', who, charge, aim, grip: true });
  }
  out.push({ k: 'wait', t: 45 });
  return out;
}
const key = (g) => [g.dora, g.enzo].map((c) => `${Math.round(c.x / 10)},${Math.round(c.y / 8)},${c.mode[0]}`).join('|');
/** Height (mostly the lower climber's, since you climb together), less falls; on the tub's floor, closeness to the tub. */
function score(g) {
  const tub = g.world.tubs[g.tub + 1];
  let s = Math.min(g.dora.y, g.enzo.y) + 0.4 * Math.max(g.dora.y, g.enzo.y) - g.stats.falls * 40;
  if (tub) for (const c of [g.dora, g.enzo]) if (Math.abs(c.y - tub.y) < 2) s += 80 - Math.min(80, Math.abs(c.x - tub.x) * 0.25);
  return s;
}
/** Climbed: the next tub reached (or the top), or both climbers standing up on the next floor. */
const done = (g, from) => {
  if (g.tub > from || g.phase === 'won') return true;
  const t = g.world.tubs[from + 1];
  return !!t && [g.dora, g.enzo].every((c) => c.mode === 'stand' && c.y >= t.y);
};

/**
 * Best-first search from `g` for the next real gain: a settled spot at least `gain` higher (by score) than here, or
 * the next tub. Returns the moves to get there, or null if none turns up within `budget` expansions.
 */
function plan(g0, from, budget, gain = 24) {
  const s0 = score(g0), open = [{ g: g0, path: [], s: s0 }], seen = new Set([key(g0)]);
  let best = null;
  for (let n = 0; n < budget && open.length; n++) {
    open.sort((a, b) => b.s - a.s);
    const node = open.shift();
    for (const a of moves(node.g)) {
      const g = node.g.clone();
      if (!play(g, a)) continue;
      if (done(g, from)) return [...node.path, a];
      if (!g.stable()) continue;
      const k = key(g); if (seen.has(k)) continue; seen.add(k);
      const next = { g, path: [...node.path, a], s: score(g) };
      if (!best || next.s > best.s) best = next;
      open.push(next);
    }
    if (best && best.s >= s0 + gain) return best.path;
  }
  if (VERBOSE) console.log('  no gain within', budget, 'from', [g0.dora, g0.enzo].map((c) => `${c.who} ${c.mode} ${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' · '), 'seen', seen.size);
  return null;
}

/** Climbs from tub `i` to tub `i + 1` the way a player would; returns how it went. */
function climbFloor(i, seed) {
  const g = new RopeclimbGame({ seed, players: 1, tub: i, hard: HARD });
  const wobble = new Rng(seed * 7 + 1);
  let plans = 0, moves = 0, budget = 12;
  while (!done(g, i) && plans < 120 && g.stats.ticks < HZ * 60 * 12) {
    const route = plan(g.clone(), i, budget); plans++;
    if (!route) { if (budget >= 400) break; budget = Math.min(400, budget * 3); continue; }
    budget = 12;
    // play the route with a human's wobble; plan again as soon as a move lands somewhere else than planned
    for (const a of route) {
      const want = g.clone(); play(want, a);
      play(g, a, wobble); moves++;
      if (done(g, i) || key(g) !== key(want)) break;
    }
    if (VERBOSE) console.log(`  ${clockText(g.stats.ticks)} ${[g.dora, g.enzo].map((c) => `${c.who} ${c.mode} ${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' · ')}`);
  }
  return { ok: done(g, i), ticks: g.stats.ticks, falls: g.stats.falls, jumps: g.stats.jumps, catches: g.stats.catches, replans: plans, moves, height: Math.round(g.height) };
}

// ---- standing still gets nowhere
{
  const g = new RopeclimbGame({ seed: 5, players: 1 });
  const h0 = g.height;
  for (let i = 0; i < HZ * 60; i++) g.step(idleInput());
  assert.ok(g.height <= h0 + 1 && g.stats.best <= h0 + 1 && g.tub === 0, 'a pair that stands still for a minute climbs nothing');
  console.log('PASS standing still for a minute climbs nothing');
}

// ---- every floor, from its tub
const floors = only ? [Number(only.split('=')[1])] : QUICK ? [0, 4, 8] : Array.from({ length: TUB_COUNT }, (_, i) => i);
const results = [];
for (const i of floors) {
  const t0 = performance.now(), r = climbFloor(i, 1000 + i);
  results.push({ i, ...r });
  console.log(`${r.ok ? 'PASS' : 'FAIL'} floor ${i + 1} (from tub ${i}): ${r.ok ? 'climbed' : `stuck at ${r.height}`} in ${clockText(r.ticks)}, ${r.jumps} leaps, ${r.falls} falls, ${r.catches} catches, ${r.replans} plans (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}
const total = results.reduce((s, r) => s + r.ticks, 0);
console.log(`total climbing time ${clockText(total)}, falls ${results.reduce((s, r) => s + r.falls, 0)}`);
for (const r of results) assert.ok(r.ok, `floor ${r.i + 1} can be climbed from its tub`);
assert.ok(results.every((r) => r.ticks < HZ * 60 * 8), 'no floor takes the bot more than eight minutes');
console.log(`PASS the bot climbed ${results.length} floor${results.length === 1 ? '' : 's'}`);
void VERBOSE;

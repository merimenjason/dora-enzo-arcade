// The Sunken Bellspire: the Bell Rope with and without the helping hand. With assist on (the default), a hook catches
// itself, the swing keeps itself, a jump flies to the aimed hook or ledge, and dropping off goes home; Strict (and
// assist off) keeps the free swing. The engine checks each rule in both modes, every aim in every rope room is checked
// against the walls, the hazards and the route planner, and human-paced bots (a reaction delay, sloppy timing, random
// release moments) cross every rope crossing in both modes.
// Run from tests/bellspire.mjs (after compiling the engine into .checks/), or on its own for the bots' table.
import assert from 'node:assert/strict';
import { BellspireGame, freshSave, INFO, COLS, ROWS, TILE, NO_INPUT, BASE_ABILITIES, NOTE_GAP, roomById, roomOfTile } from '../.checks/bellspire-game.js';
import { ropeAim, hookInReach, boxClear, support, HERO_W, HERO_H, ASSIST_REACH, ASSIST_AMP, ROPE_REACH } from '../.checks/bellspire-physics.js';
import { Graph, HeroAnimator } from '../.checks/bellspire-nav.js';

const ASSIST = { assist: true, strict: false }, STRICT = { assist: false, strict: true }, OFF = { assist: false, strict: false };
const I = (o = {}) => ({ ...NO_INPUT, ...o });
const quiet = (g) => { g.dialog = null; g.enemies = []; };
/** a save that has finished the citadel with the Bell Rope (and the Echo Step, so every belfry door is open) */
const done = (extra = ['rope', 'echo']) => {
  const s = freshSave();
  s.abilities = [...BASE_ABILITIES, ...extra];
  s.spells = ['whirl', 'bolt', 'ember', 'chime'];
  s.flags.push('script:intro', 'script:firstDark', 'script:wayra', 'script:bell', 'keeper', 'boss:frog', 'boss:hydra', 'boss:puma', 'boss:warden', 'boss:mother', 'boss:condor', 'boss:clappers', 'script:belfryCall', 'script:cliff', 'script:wind', 'script:echo');
  s.heroes.dora.level = s.heroes.enzo.level = 12;
  return s;
};
const world = (room, c, r) => { const rm = roomById(room); return { x: (rm.gx * COLS + c) * TILE + 8, y: (rm.gy * ROWS + r + 1) * TILE }; };
const game = (settings, room, c, r, seed = 3) => {
  const g = new BellspireGame(done(), settings, seed);
  g.teleport(room, c, r); quiet(g);
  for (let i = 0; i < 4; i++) { g.step(I()); quiet(g); }
  return g;
};
/** Put Dora in the air at (x, y) (feet), moving (vx, vy). */
const airAt = (g, x, y, vx = 0, vy = 0) => { const b = g.body; Object.assign(b, { x, y, vx, vy, ground: false, climb: false, rope: null, fly: null }); };
const hooksOf = (room) => INFO.get(room).hooks;

/** The rope crossings: where a player starts, the goal (a stand spot, or reaching a room) and which way it is. */
export const CROSSINGS = [
  { name: 'ropecellar', room: 'ropecellar', from: [16, 8], to: [4, 5] },
  { name: 'ropeloft', room: 'ropeloft', from: [26, 5], to: [4, 9] },
  { name: 'ropegallery', room: 'ropegallery', from: [3, 14], to: [25, 14] },
  { name: 'ropehall', room: 'ropehall', from: [24, 14], to: [4, 9] },
  // the louvres' hook is reached from the echo bell's notes: ring it, then start on the second note
  { name: 'louvres', room: 'louvres', from: [22, 13], to: [2, 5], setup: (g) => {
    const q = INFO.get('louvres').things.find((t) => t.ch === 'Q');
    g.ringEcho(q);
    for (let i = 0; i < NOTE_GAP + 2; i++) { g.step(I()); quiet(g); }
    Object.assign(g.body, world('louvres', 16, 7), { vx: 0, vy: 0, ground: true });
    g.step(I()); quiet(g);
  } },
  { name: 'bellshaft', room: 'bellshaft', from: [21, 43], to: [6, 39] },
  { name: 'bannerwalk', room: 'bannerwalk', from: [4, 14], to: [19, 7] },
  // the condor bridge is reached by the bannerwalk's far ladder, up through the hatch
  { name: 'condor bridge', room: 'bannerwalk', from: [4, 14], to: [33, 14], then: 'condorbridge' },
];

/**
 * A player at a human pace: they see the world `delay` ticks late (12 to 15), so they jump at a gap a little early or
 * late, hold jump for a sloppy while, double-jump when a hook isn't glowing, and let go of a rope at a random moment
 * (with the helping hand) or on a forward swing they read late (Strict: they press X when a hook looks close, pump
 * with the swing as they saw it, and let go going their way). Returns whether they made it on the first try (no hurt,
 * no fall back, within a time limit).
 */
export function ropeHuman(cr, seed, settings = ASSIST, trace = null) {
  let rs = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = game(settings, cr.room, cr.from[0], cr.from[1], seed);
  cr.setup?.(g);
  const delay = 12 + Math.floor(rnd() * 4);
  const goal = world(cr.room, cr.to[0], cr.to[1]);
  const dir = goal.x > g.body.x ? 1 : -1;
  const seen = [];
  const hp0 = g.leadSave.hp;
  let hold = 0, xHeld = 0, wantRelease = -1, ropeSeen = 0, lastJumpT = -99, edgeSlack = (rnd() - 0.3) * 24, hooks = 0;
  const assisted = settings.assist && !settings.strict;
  for (let t = 0; t < 60 * 40; t++) {
    const b = g.body;
    seen.push({ x: b.x, y: b.y, vy: b.vy, ground: b.ground, rope: b.rope ? { t: b.rope.t, ang: b.rope.ang, av: b.rope.av } : null, fly: !!b.fly, glow: g.ropeGuide.hook && !g.ropeGuide.hook.far, airJumps: b.airJumps, hookNear: !!hookInReach(g.env, b), hookSoon: (g.env.hooks?.() ?? []).some((h) => h.y < b.y - HERO_H - 6 && Math.hypot(h.x - b.x, h.y - b.y + HERO_H) < ROPE_REACH + 36) });
    const s = seen[Math.max(0, seen.length - 1 - delay)];
    let jump = false, rope = false, d = dir;
    if (s.rope) {
      ropeSeen++;
      if (assisted) {
        // a random moment of the swing, seen late
        if (wantRelease < 0) wantRelease = Math.floor(rnd() * 70);
        if (s.rope.t >= wantRelease) jump = true;
      } else {
        // pump with the swing as they saw it; let go on a forward swing (sloppily) once it's big enough
        d = s.rope.av > 0 ? 1 : -1;
        const big = Math.abs(s.rope.ang) > 0.5 + rnd() * 0.4 || s.rope.t > 240;
        if (big && s.rope.av * dir > 0 && s.rope.ang * dir > -0.2) { jump = true; d = dir; }
      }
    } else {
      wantRelease = -1;
      if (s.ground) {
        // jump at the gap ahead (seen late, but they look ahead), or under a hook up high
        const ahead = s.x + dir * (20 + delay * 2.2 + edgeSlack);
        const c = Math.floor(ahead / TILE), r = Math.round(s.y / TILE);
        const gap = (!g.env.solid(c, r) && !g.env.oneway(c, r)) || g.env.hazard(c, r) || g.env.hazard(c, r - 1);
        const under = (g.env.hooks?.() ?? []).some((h) => (h.x - s.x) * dir > -40 && (h.x - s.x) * dir < 120 + rnd() * 20 && h.y < s.y && s.y - h.y < 210);
        if ((gap || under) && t - lastJumpT > 20) { hold = 9 + Math.floor(rnd() * 9); lastJumpT = t; edgeSlack = (rnd() - 0.3) * 24; }
      } else if (!s.fly && s.vy > 0.5 && s.airJumps > 0 && hold <= 0 && t - lastJumpT > delay + 6) {
        // falling, and nothing will catch: a double jump (a little late)
        const catching = assisted ? s.glow : s.hookNear;
        if (!catching) { hold = 8 + Math.floor(rnd() * 8); lastJumpT = t; }
      }
      // Strict: X as soon as a hook looks close enough (they mash it a bit)
      if (!assisted && (s.hookNear || s.hookSoon) && !g.body.ground) { if (xHeld <= 0) { rope = true; xHeld = 3 + Math.floor(rnd() * 4); } }
      if (hold > 0) { jump = true; hold--; }
    }
    if (xHeld > 0) xHeld--;
    // at the ladder up to the next room: ↑
    const up = !!cr.then && g.body.ground && Math.abs(g.body.x - goal.x) < 8;
    if (up) d = 0;
    const before = g.leadSave.hp;
    g.step(I({ left: d < 0, right: d > 0, up, jump, attack: rope })); quiet(g);
    if (g.body.hooked) hooks++;
    if (trace) { const b = g.body, rm = roomById(g.room.id); trace(`${t} ${((b.x - rm.gx * COLS * TILE) / TILE).toFixed(1)},${((b.y - rm.gy * ROWS * TILE) / TILE).toFixed(1)} ${b.rope ? 'ROPE' + b.rope.t : b.fly ? 'FLY' : b.ground ? 'G' : 'air'}${jump ? ' J' : ''}${rope ? ' X' : ''} d${d} hp${g.leadSave.hp}`); }
    if (g.leadSave.hp < before || g.leadSave.hp < hp0) return { ok: false, why: 'hurt', t, hooks, delay };
    if (cr.then ? g.room.id === cr.then : g.body.ground && Math.abs(g.body.x - goal.x) < 24 && Math.abs(g.body.y - goal.y) < 2) return { ok: true, t, hooks, delay };
    // climbing the ladder up to the condor bridge
    if (cr.then && g.body.climb) { for (let i = 0; i < 300 && g.room.id !== cr.then; i++) { g.step(I({ up: true })); quiet(g); } if (g.room.id === cr.then) return { ok: true, t, hooks, delay }; }
  }
  return { ok: false, why: 'time', t: 60 * 40, hooks, delay };
}

export function ropeBots(seeds = 24, log = console.log) {
  const out = {};
  for (const [label, settings] of [['assist', ASSIST], ['strict', STRICT]]) {
    for (const cr of CROSSINGS) {
      let wins = 0, ticks = 0, hooks = 0;
      const why = {};
      for (let s = 1; s <= seeds; s++) {
        const r = ropeHuman(cr, s * 7919, settings);
        if (r.ok) { wins++; ticks += r.t; hooks += r.hooks; } else why[r.why] = (why[r.why] ?? 0) + 1;
      }
      out[`${label}:${cr.name}`] = wins / seeds;
      log(`rope bot ${label.padEnd(6)} ${cr.name.padEnd(13)} ${wins}/${seeds} first try (${Math.round((wins / seeds) * 100)}%), ${wins ? (ticks / wins / 60).toFixed(1) : '-'} s a crossing${Object.keys(why).length ? `, missed: ${Object.entries(why).map(([k, v]) => `${v} ${k}`).join(', ')}` : ''}`);
    }
  }
  return out;
}

export default function rope() {
  let checks = 0;
  const ok = (c, m) => { assert.ok(c, m); checks++; };
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

  // ─── auto-catch ─────────────────────────────────────────────────────────────
  {
    const [h0] = hooksOf('bannerwalk');
    for (const [label, s, catches] of [['assist', ASSIST, true], ['strict', STRICT, false], ['assist off', OFF, false]]) {
      const g = game(s, 'bannerwalk', 4, 14);
      airAt(g, h0.x - 60, h0.y + HERO_H + 50, 2, 0);
      g.step(I()); quiet(g);
      eq(!!g.body.rope, catches, `${label}: in the air about ${(Math.hypot(60, 50) / TILE).toFixed(1)} tiles from a hook, it ${catches ? 'catches itself' : 'doesn’t catch without X'}`);
    }
    const g = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g, h0.x - 80, h0.y + HERO_H + 40);
    g.step(I()); quiet(g);
    ok(g.body.rope && g.body.hooked, `the reach is generous: ${(Math.hypot(80, 40) / TILE).toFixed(1)} tiles away (${ASSIST_REACH / TILE} tiles)`);
    const g2 = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g2, h0.x - 110, h0.y + HERO_H + 40, 3, -4);
    g2.step(I()); quiet(g2);
    ok(!g2.body.rope, 'but not from 7 tiles');
    ok(g2.ropeGuide.hook && !g2.ropeGuide.hook.far, 'where, jumping towards it, it already glows bright with a rope to it: the catch is coming');
    const g2a = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g2a, h0.x - 110, h0.y + HERO_H + 40, 0, 1);
    g2a.step(I()); quiet(g2a);
    ok(g2a.ropeGuide.hook?.far, 'but falling away from it, only faintly: she needs more height');
    const g2b = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g2b, h0.x - 170, h0.y + HERO_H + 40);
    g2b.step(I()); quiet(g2b);
    ok(g2b.ropeGuide.hook?.far, 'and from 11 tiles it glows faintly');
    const g3 = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g3, h0.x - 10, h0.y - 20);
    g3.step(I()); quiet(g3);
    ok(!g3.body.rope, 'a hook below her hands doesn’t catch');
    // standing doesn't catch; X still works
    const g4 = game(ASSIST, 'bellshaft', 21, 43);
    ok(g4.body.ground && !g4.body.rope, 'standing under a hook doesn’t catch it');
    const g5 = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g5, h0.x - 20, h0.y + HERO_H + 40);
    g5.body.skipX = h0.x; g5.body.skipY = h0.y;
    g5.step(I({ attack: true })); quiet(g5);
    ok(g5.body.rope && g5.leadRt.act === null, 'X still throws the rope (even at the hook just let go of), not the sword');
    // Enzo never
    const g6 = game(ASSIST, 'bannerwalk', 4, 14);
    g6.lead = 'enzo';
    airAt(g6, h0.x - 20, h0.y + HERO_H + 40);
    g6.step(I()); quiet(g6);
    ok(!g6.body.rope, 'Enzo’s never caught by the rope');
    // the glow and the preview line
    const g7 = game(ASSIST, 'bannerwalk', 4, 14);
    airAt(g7, h0.x - 120, h0.y + HERO_H + 40, 0, -1);
    g7.step(I()); quiet(g7);
    ok(g7.ropeGuide.hook && g7.ropeGuide.hook.x === h0.x, 'in the air, the guide shows the hook ahead');
    const g8 = game(STRICT, 'bannerwalk', 4, 14);
    airAt(g8, h0.x - 60, h0.y + HERO_H + 40);
    g8.step(I()); quiet(g8);
    eq(g8.ropeGuide, { hook: null, aim: null }, 'Strict shows no guide');
  }

  // ─── the steady swing ───────────────────────────────────────────────────────
  {
    const [h0] = hooksOf('bannerwalk');
    const swingWith = (inp, wind) => {
      const g = game(ASSIST, 'bannerwalk', 4, 14);
      if (wind) g.env.wind = () => wind;
      airAt(g, h0.x - 40, h0.y + HERO_H + 40, 2, 0);
      g.step(I()); quiet(g);
      const xs = [];
      let max = 0;
      for (let i = 0; i < 400; i++) { g.step(I(typeof inp === 'function' ? inp(i) : inp)); quiet(g); if (!g.body.rope) return null; xs.push(+g.body.x.toFixed(3)); if (i > 200) max = Math.max(max, Math.abs(g.body.rope.ang)); }
      return { xs, max, len: Math.hypot(g.body.x - h0.x, g.body.y - HERO_H - h0.y) };
    };
    const still = swingWith({}), pumped = swingWith((i) => ({ right: i % 50 < 25, left: i % 50 >= 25 })), held = swingWith({ right: true }), windy = swingWith({}, 1);
    ok(still && Math.abs(still.max - ASSIST_AMP) < 0.05, `with the helping hand, she swings a steady full arc by herself (${still?.max.toFixed(2)} rad)`);
    ok(Math.abs(still.len - 56) < 1, `on a rope that settles at its length (${still.len.toFixed(1)} px)`);
    eq(pumped.xs, still.xs, 'pumping changes nothing');
    eq(held.xs, still.xs, 'holding a way changes nothing');
    eq(windy.xs, still.xs, 'nor does the wind');
    // Strict: pumping grows the swing, and the wind pushes
    const g = game(STRICT, 'bannerwalk', 4, 14);
    airAt(g, h0.x - 20, h0.y + HERO_H + 40, 0, 0);
    g.step(I({ attack: true })); quiet(g);
    let a0 = 0, a1 = 0;
    for (let i = 0; i < 120; i++) { g.step(I()); quiet(g); a0 = Math.max(a0, Math.abs(g.body.rope.ang)); }
    for (let i = 0; i < 240; i++) { g.step(I({ right: g.body.rope.av > 0, left: g.body.rope.av < 0 })); quiet(g); if (i > 120) a1 = Math.max(a1, Math.abs(g.body.rope.ang)); }
    ok(a1 > a0 + 0.2, `Strict: pumping grows the swing (${a0.toFixed(2)} → ${a1.toFixed(2)} rad)`);
  }

  // ─── guided release ─────────────────────────────────────────────────────────
  {
    // the cellar: one hook over the spikes, the chest ledge to the west, the floor to the east
    const [h] = hooksOf('ropecellar');
    const caught = (s = ASSIST) => { const g = game(s, 'ropecellar', 16, 8); airAt(g, h.x + 30, h.y + HERO_H + 50, -1, 0); g.body.homeX = world('ropecellar', 16, 8).x; g.body.homeY = world('ropecellar', 16, 8).y; g.step(I()); quiet(g); return g; };
    const g = caught();
    ok(g.body.rope, 'caught the cellar’s hook');
    g.step(I({ left: true })); quiet(g);
    const aim = g.ropeGuide.aim;
    ok(aim && aim.kind === 'ledge' && aim.x < h.x, `holding ← aims at a ledge to the west (${aim && ((aim.x / TILE) % COLS).toFixed(1)})`);
    ok(aim.path.length > 8, 'with a dotted arc to it');
    g.step(I({ right: true })); quiet(g);
    ok(g.ropeGuide.aim?.x > h.x, 'holding → aims east');
    g.step(I()); quiet(g);
    ok(g.ropeGuide.aim && Math.sign(g.ropeGuide.aim.x - h.x) === g.body.face, 'holding neither aims the way she faces');
    // jump at ANY point of the swing: always the same ledge
    const lands = new Set();
    let flightOk = true, smooth = true;
    for (let at = 4; at < 120; at += 9) {
      const g1 = caught();
      for (let i = 0; i < at; i++) { g1.step(I({ left: true })); quiet(g1); }
      const target = g1.ropeGuide.aim;
      g1.step(I({ left: true, jump: true })); quiet(g1);
      if (!g1.body.fly || g1.body.jumped !== 'rope') flightOk = false;
      let prev = { x: g1.body.x, y: g1.body.y }, n = 0;
      while (g1.body.fly && n++ < 200) { g1.step(I({ left: true })); quiet(g1); if (Math.hypot(g1.body.x - prev.x, g1.body.y - prev.y) > 9) smooth = false; prev = { x: g1.body.x, y: g1.body.y }; }
      for (let i = 0; i < 3; i++) { g1.step(I()); quiet(g1); }
      lands.add(`${g1.body.ground}:${Math.round(g1.body.x)},${Math.round(g1.body.y)}:${target && Math.round(target.x)}`);
      eq(g1.leadSave.hp, g1.leadSave.max ?? g1.leadSave.hp, 'no harm');
    }
    eq(lands.size, 1, `a jump at any moment of the swing lands on the same ledge (${[...lands]})`);
    const [land] = lands;
    ok(land.startsWith('true:') && land.endsWith(`:${land.split(':')[1].split(',')[0]}`), 'standing, right on the aimed spot');
    ok(flightOk, 'the jump is a guided flight');
    ok(smooth, 'eased: no step more than 9 px a tick');
  }

  // ─── chaining ───────────────────────────────────────────────────────────────
  {
    const [h1, h2] = hooksOf('ropegallery');
    const g = game(ASSIST, 'ropegallery', 3, 14);
    airAt(g, h1.x - 40, h1.y + HERO_H + 40, 2, 0);
    g.body.homeX = world('ropegallery', 3, 14).x; g.body.homeY = world('ropegallery', 3, 14).y;
    g.step(I({ right: true })); quiet(g);
    ok(g.body.rope?.hx === h1.x, 'the first hook');
    g.step(I({ right: true })); quiet(g);
    eq(g.ropeGuide.aim?.kind, 'hook', 'aims at the next hook');
    g.step(I({ right: true })); g.step(I({ right: true })); g.step(I({ right: true })); g.step(I({ right: true, jump: true })); quiet(g);
    let n = 0;
    while (g.body.fly && n++ < 100) { g.step(I({ right: true })); quiet(g); }
    ok(g.body.rope?.hx === h2.x && g.body.hooked, 'the flight ends on the next hook, caught');
    g.step(I({ right: true })); quiet(g);
    eq(g.ropeGuide.aim?.kind, 'ledge', 'then aims at the far ledge');
    for (let i = 0; i < 6; i++) { g.step(I({ right: true })); quiet(g); }
    g.step(I({ right: true, jump: true })); quiet(g);
    n = 0;
    while (!g.body.ground && n++ < 120) { g.step(I({ right: true })); quiet(g); }
    ok(g.body.ground && g.body.x > h2.x + 32, `hold →, tap jump, tap jump: across the spikes (${((g.body.x / TILE) % COLS).toFixed(1)})`);
    eq(g.leadSave.hp, game(ASSIST, 'ropegallery', 3, 14).leadSave.hp, 'unhurt');
    // and no hook catches itself again until she's landed
    const g2 = game(ASSIST, 'ropegallery', 3, 14);
    airAt(g2, h1.x - 30, h1.y + HERO_H + 40, 2, 0);
    g2.step(I()); quiet(g2);
    g2.body.homeX = NaN; // no home: ↓ just drops
    for (let i = 0; i < 8; i++) { g2.step(I({ down: true })); quiet(g2); }
    ok(!g2.body.rope, '↓ with nowhere to go home to just drops');
    let again = false;
    for (let i = 0; i < 6; i++) { g2.step(I()); quiet(g2); again ||= !!g2.body.rope; }
    ok(!again, 'and the hook just let go of doesn’t catch her again on the way down');
  }

  // ─── the safety net ─────────────────────────────────────────────────────────
  {
    const [h1] = hooksOf('ropegallery');
    // run and jump from the floor, caught, then ↓: home, unhurt, over the spikes
    const g = game(ASSIST, 'ropegallery', 4, 14);
    const home = { x: g.body.x, y: g.body.y };
    const hp = g.leadSave.hp;
    let n = 0;
    while (!g.body.rope && n++ < 120) { g.step(I({ right: true, jump: n < 16 })); quiet(g); }
    ok(g.body.rope, 'jumped and caught the first hook over the spikes');
    for (let i = 0; i < 10; i++) { g.step(I()); quiet(g); }
    g.step(I({ down: true })); quiet(g);
    ok(g.body.fly?.home, '↓ flies back home');
    n = 0;
    while (!g.body.ground && n++ < 120) { g.step(I()); quiet(g); }
    ok(g.body.ground && Math.abs(g.body.y - home.y) < 1 && g.body.x < h1.x - 32, `to the ledge she swung from (${((g.body.x / TILE) % COLS).toFixed(1)}), not the spikes`);
    eq(g.leadSave.hp, hp, 'with no damage');
    // a hit on the rope: home too (the hit still counts)
    const g2 = game(ASSIST, 'ropegallery', 4, 14);
    n = 0;
    while (!g2.body.rope && n++ < 120) { g2.step(I({ right: true, jump: n < 16 })); quiet(g2); }
    g2.hurtLead(3, g2.body.x + 10);
    const hit = g2.leadSave.hp;
    ok(g2.body.fly?.home && !g2.body.rope, 'a hit on the rope sends her home');
    n = 0;
    while (!g2.body.ground && n++ < 120) { g2.step(I()); quiet(g2); }
    ok(g2.body.ground && g2.body.x < h1.x - 32 && hit < hp && g2.leadSave.hp === hit, `safe on the ledge, hurt only by the hit (${g2.leadSave.hp}/${hp})`);
    // Strict: ↓ drops, into the spikes (the pit rule's damage)
    const g3 = game(STRICT, 'ropegallery', 4, 14);
    airAt(g3, h1.x - 20, h1.y + HERO_H + 40);
    g3.step(I({ attack: true })); quiet(g3);
    ok(g3.body.rope, 'Strict: X caught it');
    for (let i = 0; i < 10; i++) { g3.step(I()); quiet(g3); }
    g3.step(I({ down: true })); quiet(g3);
    ok(!g3.body.rope && !g3.body.fly && g3.body.vy >= -0.5, 'Strict: ↓ just drops, no kick and no flight home');
  }

  // ─── tagging on the rope ────────────────────────────────────────────────────
  for (const [label, s] of [['assist', ASSIST], ['strict', STRICT]]) {
    const [h0] = hooksOf('bannerwalk');
    const g = game(s, 'bannerwalk', 4, 14);
    airAt(g, h0.x - 20, h0.y + HERO_H + 40);
    g.step(I({ attack: true })); quiet(g);
    g.tagCd = 0; g.drainEvents();
    g.step(I({ tag: true }));
    const notes = g.drainEvents().filter((e) => e.k === 'note' || e.k === 'toast').map((e) => e.text);
    eq(g.lead, 'dora', `${label}: no tagging on the rope`);
    ok(notes.some((t) => /Dora’s on the rope/.test(t)) || /Dora’s on the rope/.test(g.toast?.text ?? g.noteText ?? ''), `${label}: and it says why (${notes})`);
  }

  // ─── Strict keeps the free swing exactly ───────────────────────────────────
  {
    const [h0] = hooksOf('bannerwalk');
    const trace = (s) => {
      const g = game(s, 'bannerwalk', 9, 14);
      airAt(g, h0.x - 20, h0.y + HERO_H + 40, 2, -1);
      const out = [];
      for (let i = 0; i < 200; i++) { g.step(I({ attack: i === 0, right: i % 40 < 20, left: i % 40 >= 20, jump: i === 150 })); quiet(g); out.push(`${g.body.x.toFixed(4)},${g.body.y.toFixed(4)}`); }
      return out;
    };
    eq(trace(STRICT), trace(OFF), 'Strict and assist-off swing the same free pendulum');
    ok(new Set(trace(STRICT).slice(0, 140)).size > 100, 'which moves');
  }

  // ─── every aim in every rope room: clear, safe and on the planner's map ────
  {
    const s = done();
    const st = { abilities: s.abilities, keeper: true, calmed: ['frog', 'hydra', 'puma', 'warden', 'mother', 'condor', 'clappers'], water: s.water, wind: s.wind };
    const G = new Graph(st);
    let aims = 0, hookAims = 0;
    for (const room of [...new Set(INFO.keys())].filter((id) => hooksOf(id)?.length)) {
      for (const h of hooksOf(room)) {
        const g = game(ASSIST, room, 2, 2);
        for (const d of [-1, 1]) for (let ph = 0; ph < 6.28; ph += 0.4) {
          const a = ASSIST_AMP * Math.sin(ph);
          const b = g.body;
          Object.assign(b, { x: h.x + Math.sin(a) * 56, y: h.y + Math.cos(a) * 56 + HERO_H, ground: false, fly: null, rope: { hx: h.x, hy: h.y, len: 56, ang: a, av: 0, t: 10, ph, amp: ASSIST_AMP, sd: 1 } });
          if (!boxClear(g.env, b.x - HERO_W / 2, b.y - HERO_H, b.x + HERO_W / 2, b.y)) continue;
          const aim = ropeAim(g.env, b, d);
          if (!aim) continue;
          aims++;
          for (const p of aim.path) assert.ok(boxClear(g.env, p.x - HERO_W / 2, p.y - HERO_H, p.x + HERO_W / 2, p.y - 0.5), `${room}: the arc never goes through a wall`);
          for (const p of aim.path) for (let c = Math.floor((p.x - 7) / TILE); c <= Math.floor((p.x + 7) / TILE); c++) for (let r = Math.floor((p.y - HERO_H) / TILE); r <= Math.floor(p.y / TILE); r++) assert.ok(!g.env.hazard(c, r), `${room}: nor through a hazard`);
          assert.equal(roomOfTile(Math.floor(aim.x / TILE), Math.floor((aim.y - 4) / TILE))?.id, room, `${room}: the target is in the same room`);
          if (aim.kind === 'hook') { hookAims++; assert.ok(hooksOf(room).some((k) => k.x === aim.hx && k.y === aim.hy), 'a hook target is a real hook'); continue; }
          const t = { ...b, x: aim.x, y: aim.y, dropT: 0 };
          assert.ok(support(g.env, t), `${room}: a ledge target is something to stand on`);
          const n = G.nodeAt(aim.x, aim.y);
          assert.ok(n.mode === 'ground' && G.expand(n).length > 0, `${room}: and a stand spot the route planner can move on from (${aim.x},${aim.y})`);
        }
      }
    }
    ok(aims > 100, `${aims} aims checked in every rope room, ${hookAims} at a hook: none through a wall or a hazard, every ledge a planner stand spot`);
    // the rope rooms are still crossed by the planner with the guided rope, and the strict proofs still hold (tests/bellspire-belfry.mjs)
    const GA = new Graph(st, true);
    for (const cr of CROSSINGS.filter((c) => !c.then)) {
      const from = world(cr.room, cr.from[0], cr.from[1]), to = world(cr.room, cr.to[0], cr.to[1]);
      const path = GA.path(GA.nodeAt(from.x, from.y), (n) => Math.abs(n.x - to.x) < 24 && n.y === to.y, 20000);
      ok(path, `the planner crosses the ${cr.name} with the guided rope (${path?.length} moves)`);
    }
  }

  // ─── the flight's poses ────────────────────────────────────────────────────
  {
    const base = { ground: false, vx: 3, vy: -1, face: 1, climb: false, swim: false, wade: false, glide: false, wallSlide: false, dash: false, hurt: false, down: false, act: null, castHold: false, lanternUp: false, events: [] };
    const a = new HeroAnimator('dora');
    a.step({ ...base, rope: { ang: 0.3, av: 0.02 }, events: ['hooked'] });
    const seq = [];
    for (let t = 0; t < 70; t++) seq.push(a.step({ ...base, fly: t < 50, ground: t >= 50, vy: t < 50 ? 4 : 0, events: t === 0 ? ['unhooked', 'jumped'] : [] }));
    eq(seq[0].state, 'ropeRelease', 'the flight starts with the release kick');
    eq([seq[20].state, seq[20].frame], ['ropeFly', 78], 'then her own flying pose (frame 78)');
    eq(seq[50].state, 'land', 'and ends in a clean landing, never a hard one');
  }

  // ─── the bots ───────────────────────────────────────────────────────────────
  const rates = ropeBots(24, () => {});
  for (const cr of CROSSINGS) ok(rates[`assist:${cr.name}`] >= 0.95, `with the helping hand, a human-paced player crosses the ${cr.name} first try in ${Math.round(rates[`assist:${cr.name}`] * 100)}% of 24 seeds (needs 95%)`);
  return checks;
}

if (process.argv[1]?.endsWith('bellspire-rope.mjs')) {
  const seeds = Number(process.argv.find((a) => a.startsWith('--seeds='))?.slice(8) ?? 24);
  const one = process.argv.find((a) => a.startsWith('--trace='))?.slice(8);
  if (one) { const [name, seed, mode] = one.split(':'); console.log(ropeHuman(CROSSINGS.find((c) => c.name === name), +seed * 7919, mode === 'strict' ? STRICT : ASSIST, console.log)); }
  else if (process.argv.includes('--bots')) ropeBots(seeds);
  else console.log(`bellspire rope: ${rope()} checks passed`);
}

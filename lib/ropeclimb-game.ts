// Ropeclimb's rules: Dora and Enzo, tied together by a short stretchy rope, climb a giant barn tower from the cellar
// to the weathervane. Hold to charge a leap and release to spring; grip beams, posts and hay with your claws; an
// anchored partner holds the other on the rope, can haul them up, and lets them swing like a pendulum.
// Deterministic and DOM-free: fixed 1/60 s ticks, position-based physics for the two climbers and the rope's links,
// every hazard driven by the tick, and a seeded generator for the rest, so a seed and the same inputs replay a climb
// exactly. y points UP (heights). The tower lives in ropeclimb-world.ts; drawing in ropeclimb-scene.ts.
import {
  buildWorld, TOWER_W, TOP_Y, FLOOR_H, ACORN_COUNT, TUB_COUNT, sectionAt, SECTIONS,
  type World, type Solid, type SectionId,
} from './ropeclimb-world.js';

export { TOWER_W, TOP_Y, FLOOR_H, ACORN_COUNT, TUB_COUNT, SECTIONS, SECTION_IDS, sectionAt } from './ropeclimb-world.js';
export type { World, Solid, Post, Bale, Gust, Lantern, Owl, Tub, Acorn, SectionId } from './ropeclimb-world.js';

// ---------------------------------------------------------------- numbers
export const HZ = 60;
export const DT = 1 / HZ;
/** Gravity, in units a second squared. */
export const G = 1500;
/** A climber's box: half its width and its height; the rope ties on at `waist` above the feet. */
export const BODY = { hw: 9, h: 16, waist: 8 };
/**
 * Leaping: the take-off speed grows from `min` (a hop, about 28 units high) to `max` (a full spring, about 136 units,
 * some eight times their height) over `full` seconds of charge; height grows evenly with the charge. Full aim tilts the
 * leap `tilt` radians from straight up. A leap can still be released `coyote` ticks after walking off a ledge.
 */
export const JUMP = { min: 290, max: 640, full: 0.75, tilt: 0.62, coyote: 6 };
/** Walking speed, the air steering (acceleration and the speed it steers up to), and the fastest fall. */
export const MOVE = { walk: 85, airAcc: 520, airMax: 170, fall: 900 };
/**
 * The rope: its length (`hard` for Hard Knot), how many links, solver passes, how light each link is next to a climber,
 * how much of a taut rope's spring-back is damped, how far it stretches past its length
 * before it stops like a wall, hauling speed (a share of its length a second), the shortest it hauls to, and how fast
 * it pays back out once slack.
 */
export const ROPE = { len: 130, hard: 90, links: 6, iters: 12, linkW: 60, damp: 0.75, stretch: 0.1, haul: 0.6, haulMin: 0.25, payOut: 0.8 };
/**
 * Gripping: how close your claws must be, the ticks after a leap before you can grip again, the fastest you can be
 * rising and still catch a beam from underneath (any faster and you sail up through it), climbing speed up a post,
 * seconds you can hold a hanging partner while gripping or braced on a ledge, and seconds to recover.
 */
export const GRIP = { reach: 6, cool: 9, beamRise: 90, shimmy: 60, hold: 12, brace: 20, rest: 3 };
/** A standing climber who isn't braced is this easy to drag by the rope (an anchored one can't be moved at all). */
export const STAND_GIVE = 0.4;
/** Landing faster than `hard` shakes the screen and dazes you for `daze` ticks. A drop of more than `fall` below where you last stood counts as a fall. */
export const LAND = { hard: 640, daze: 10, fall: 140 };
/** Crumbling straw holds for `hold` ticks once stood on, then is gone for `gone` ticks. */
export const STRAW = { hold: 50, gone: 300 };
/** Knothole gusts: the push on a climber in the air, the top speed they push to, the slide of a standing one, and the warning ticks before one blows. */
export const GUST = { acc: 1500, max: 360, slide: 50, warn: 45 };
/** A swinging lantern's radius, and how hard it knocks you. */
export const LANTERN = { r: 11, knock: 320, daze: 18 };
/**
 * The owls: how far they hear, noise that makes one stir and that wakes her, how fast noise fades a second, the wind-up
 * and flap ticks, how hard the flap blows, and the ticks she sleeps soundly after.
 */
export const OWL = { r: 230, stir: 0.55, wake: 1, fade: 0.28, windup: 40, flap: 50, push: 380, lift: 220, acc: 1700, calm: 300 };
/** Noise: a landing makes `land` per 1,000 units a second of speed, a leap over 60% charge up to `leap`, a rope snapping taut `twang`, the bell `bell`. */
export const NOISE = { land: 0.5, leap: 0.3, twang: 0.35, bell: 1.3 };
/** Ticks the pair spend rolling in a dust-bath tub. */
export const ROLL_TICKS = 110;

// ---------------------------------------------------------------- randomness
/** mulberry32 with its state on show. */
export class Rng {
  constructor(public s: number) { this.s = s >>> 0; }
  next() { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(n: number) { return Math.floor(this.next() * n); }
}

// ---------------------------------------------------------------- input
export type Who = 'dora' | 'enzo';
export const WHO: Who[] = ['dora', 'enzo'];
export const other = (w: Who): Who => (w === 'dora' ? 'enzo' : 'dora');
/** One climber's controls this tick: aim/steer (-1 to 1), haul or climb (up), the leap button and the grip button, held. */
export type Pad = { x: number; up: boolean; jump: boolean; grip: boolean };
/** In 1 player, `swap` hands control to the other climber; in 2 players each pad drives its own climber. */
export type Input = { dora: Pad; enzo: Pad; swap: boolean };
export const idlePad = (): Pad => ({ x: 0, up: false, jump: false, grip: false });
export const idleInput = (): Input => ({ dora: idlePad(), enzo: idlePad(), swap: false });
/** What the climber you aren't steering does in 1 player: holds on to whatever it can. */
const HOLD: Pad = { x: 0, up: false, jump: false, grip: true };

// ---------------------------------------------------------------- state
export type Mode = 'stand' | 'air' | 'grip' | 'roll';
export type GripOn = { k: 'post' | 'side' | 'beam'; id: number; side: -1 | 1 };
export type Climber = {
  who: Who; x: number; y: number; vx: number; vy: number; px: number; py: number;
  mode: Mode; face: 1 | -1; charge: number; charging: boolean; grip: GripOn | null; gripCool: number;
  /** 0 to 1: how tired the claws are from holding a hanging partner. */
  strain: number; daze: number; coyote: number; braced: boolean; slipT: number;
  /** The height last stood or gripped at (falls are measured from it), the highest point of this flight, ticks in the air. */
  safeY: number; peakY: number; air: number;
  /** What it stands on: a solid id, or 1000 + a bale id, or -1. */
  on: number; aim: number;
};
export type OwlState = { noise: number; state: 'sleep' | 'stir' | 'wake' | 'flap' | 'calm'; t: number };
export type Phase = 'climb' | 'roll' | 'won';
export type Mode2 = 1 | 2;
export type Ev =
  | { k: 'jump'; who: Who; charge: number }
  | { k: 'land'; who: Who; v: number; hard: boolean }
  | { k: 'grip'; who: Who }
  | { k: 'let'; who: Who }
  | { k: 'catch'; who: Who; by: Who; v: number }
  | { k: 'yank'; who: Who; v: number }
  | { k: 'drag'; who: Who }
  | { k: 'haul'; who: Who }
  | { k: 'slip'; who: Who }
  | { k: 'strain'; who: Who }
  | { k: 'fall'; who: Who; drop: number }
  | { k: 'crumble'; id: number }
  | { k: 'straw'; id: number }
  | { k: 'bonk'; who: Who; x: number; y: number }
  | { k: 'shove'; who: Who }
  | { k: 'gust'; id: number; dir: 1 | -1 }
  | { k: 'gustWarn'; id: number }
  | { k: 'stir'; id: number }
  | { k: 'hoot'; id: number }
  | { k: 'flap'; id: number }
  | { k: 'blown'; who: Who }
  | { k: 'bell'; v: number }
  | { k: 'acorn'; id: number; who: Who }
  | { k: 'tub'; id: number; fresh: boolean }
  | { k: 'checkpoint'; id: number }
  | { k: 'section'; id: SectionId }
  | { k: 'swap'; who: Who }
  | { k: 'won' };

export type Stats = { ticks: number; falls: number; jumps: number; catches: number; best: number };
export type Opts = { seed: number; players?: Mode2; hard?: boolean; tub?: number; found?: number[]; stats?: Partial<Stats>; active?: Who };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const finite = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function climber(who: Who, x: number, y: number): Climber {
  return { who, x, y, vx: 0, vy: 0, px: x, py: y, mode: 'stand', face: who === 'dora' ? 1 : -1, charge: 0, charging: false, grip: null, gripCool: 0, strain: 0, daze: 0, coyote: 0, braced: false, slipT: 0, safeY: y, peakY: y, air: 0, on: -1, aim: 0 };
}

const BUCKET = 100;
const worldCache = new Map<boolean, { w: World; grid: number[][] }>();
/** The tower and a lookup of solids by 100-unit band of height, built once for each kind (with or without nets). */
function worldFor(nets: boolean) {
  let c = worldCache.get(nets);
  if (!c) {
    const w = buildWorld(nets), grid: number[][] = [];
    for (const s of w.solids) for (let b = Math.max(0, Math.floor(s.y / BUCKET)); b <= Math.floor((s.y + s.h) / BUCKET); b++) (grid[b] ??= []).push(s.id);
    c = { w, grid }; worldCache.set(nets, c);
  }
  return c;
}

export class RopeclimbGame {
  readonly world: World; private grid: number[][];
  readonly seed: number; readonly players: Mode2; readonly hard: boolean; readonly ropeLen: number;
  rng: Rng;
  tick = 0; phase: Phase = 'climb';
  dora: Climber; enzo: Climber;
  /** The climber steered in 1 player. */
  active: Who = 'dora';
  /** The rope's points, Dora's waist first and Enzo's last, with last tick's (for Verlet). */
  rx: number[]; ry: number[]; rpx: number[]; rpy: number[];
  /** The rope's working length as a share of its full length (hauling shortens it). */
  reel = 1;
  /** How tight the rope is: 0 slack, 1 at full length, more when stretched. */
  tension = 0;
  /** Where the rope bends round the corner of a solid it would otherwise cut through (a hatch edge, a block), or null. */
  bend: { x: number; y: number } | null = null;
  owls: OwlState[];
  /** Crumbling straw by solid id: 0 whole, >0 ticks since stood on, <0 ticks until it grows back. */
  straw: Record<number, number> = {};
  bell = { swing: 0, v: 0 };
  /** Acorns found (ever, and on this climb). */
  found: Set<number>; foundNow = 0;
  /** The last tub reached (the checkpoint), the tub being rolled in, and ticks left rolling. */
  tub: number; rolling = -1; rollT = 0;
  stats: Stats;
  section: SectionId;
  events: Ev[] = [];
  private lastFall = -999; private lastTwang = -999;
  /** Each climber's velocity before the rope pulled this tick. */
  private flight: Record<Who, { vx: number; vy: number }> = { dora: { vx: 0, vy: 0 }, enzo: { vx: 0, vy: 0 } };

  constructor(o: Opts) {
    this.seed = o.seed >>> 0; this.rng = new Rng(this.seed);
    this.players = o.players === 2 ? 2 : 1; this.hard = o.hard === true;
    this.ropeLen = this.hard ? ROPE.hard : ROPE.len;
    const c = worldFor(!this.hard); this.world = c.w; this.grid = c.grid;
    this.tub = clamp(Math.floor(finite(o.tub)), 0, TUB_COUNT - 1);
    const t = this.world.tubs[this.tub];
    this.dora = climber('dora', t.x - 14, t.y); this.enzo = climber('enzo', t.x + 14, t.y);
    this.active = o.active === 'enzo' ? 'enzo' : 'dora';
    const n = ROPE.links;
    this.rx = []; this.ry = [];
    for (let i = 0; i <= n; i++) { this.rx.push(t.x - 14 + 28 * i / n); this.ry.push(t.y + BODY.waist - 6 * Math.sin(Math.PI * i / n)); }
    this.rpx = this.rx.slice(); this.rpy = this.ry.slice();
    this.owls = this.world.owls.map(() => ({ noise: 0, state: 'sleep' as const, t: 0 }));
    this.found = new Set((o.found ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < this.world.acorns.length));
    const s = o.stats ?? {};
    this.stats = { ticks: Math.max(0, Math.floor(finite(s.ticks))), falls: Math.max(0, Math.floor(finite(s.falls))), jumps: Math.max(0, Math.floor(finite(s.jumps))), catches: Math.max(0, Math.floor(finite(s.catches))), best: Math.max(t.y, finite(s.best)) };
    this.section = sectionAt(t.y);
  }

  // ---------------------------------------------------------------- helpers
  c(w: Who) { return w === 'dora' ? this.dora : this.enzo; }
  get both() { return [this.dora, this.enzo]; }
  /** The pair's height: the lower climber's feet (the rope means you only really climb together). */
  get height() { return Math.min(this.dora.y, this.enzo.y); }
  /** True when this climber can't be moved by the rope. */
  anchored(c: Climber) { return c.mode === 'grip' || c.mode === 'roll' || (c.mode === 'stand' && c.braced); }
  private inv(c: Climber) { return this.anchored(c) ? 0 : c.mode === 'stand' ? STAND_GIVE : 1; }
  /** The rope's length right now. */
  get ropeNow() { return this.ropeLen * this.reel; }
  /** Straight-line distance between the two waists. */
  get span() { return Math.hypot(this.dora.x - this.enzo.x, this.dora.y - this.enzo.y); }
  solidOn(s: Solid) { if (s.kind !== 'straw') return true; return (this.straw[s.id] ?? 0) >= 0; }
  /** A bale's left edge and its speed this tick. */
  baleX(i: number, tick = this.tick) { const b = this.world.bales[i]; return b.x0 + (b.x1 - b.x0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * (tick + b.phase) / b.period)); }
  /** A lantern's bob position this tick. */
  lanternAt(i: number, tick = this.tick) {
    const l = this.world.lanterns[i], a = l.amp * Math.sin(2 * Math.PI * (tick + l.phase) / l.period);
    return { x: l.x + l.len * Math.sin(a), y: l.y - l.len * Math.cos(a), a };
  }
  /** A gust's state this tick: 'on', 'warn' (about to blow) or 'off'. */
  gustState(i: number, tick = this.tick): 'on' | 'warn' | 'off' {
    const g = this.world.gusts[i], t = (tick + g.phase) % (g.on + g.off);
    return t < g.on ? 'on' : t >= g.on + g.off - GUST.warn ? 'warn' : 'off';
  }
  private near(y0: number, y1: number, fn: (s: Solid) => void) {
    const seen = new Set<number>();
    for (let b = Math.max(0, Math.floor(y0 / BUCKET)); b <= Math.floor(y1 / BUCKET); b++) {
      const list = this.grid[b]; if (!list) continue;
      for (const id of list) { if (seen.has(id)) continue; seen.add(id); fn(this.world.solids[id]); }
    }
  }
  /** Adds noise at a point: every owl in earshot hears some of it, more the closer she is. */
  noise(x: number, y: number, amount: number) {
    this.world.owls.forEach((o, i) => {
      const d = Math.hypot(o.x - x, o.y - y); if (d > OWL.r) return;
      const s = this.owls[i]; if (s.state === 'flap' || s.state === 'calm') return;
      s.noise += amount * (1 - 0.6 * d / OWL.r);
    });
  }

  // ---------------------------------------------------------------- the tick
  step(inp: Input) {
    if (this.phase === 'won') return;
    this.tick++;
    if (this.phase === 'roll') { this.stepRoll(); return; }
    this.stats.ticks++;
    if (inp.swap && this.players === 1) { this.active = other(this.active); this.events.push({ k: 'swap', who: this.active }); for (const c of this.both) c.charging = c.charging && c.who === this.active; }
    const pads: Record<Who, Pad> = { dora: this.padFor('dora', inp), enzo: this.padFor('enzo', inp) };

    // the world moves first: straw, bales, gusts, lanterns, owls, the bell
    for (const k in this.straw) { const id = +k, v = this.straw[id]; if (v > 0) { if (v >= STRAW.hold) { this.straw[id] = -STRAW.gone; this.events.push({ k: 'crumble', id }); } else this.straw[id] = v + 1; } else if (v < 0) { this.straw[id] = v + 1; if (v + 1 === 0) { delete this.straw[id]; this.events.push({ k: 'straw', id }); } } }
    this.world.gusts.forEach((g, i) => {
      if (Math.abs((g.y0 + g.y1) / 2 - this.height) > 420) return;
      const s = this.gustState(i), was = this.gustState(i, this.tick - 1);
      if (s === 'on' && was !== 'on') this.events.push({ k: 'gust', id: i, dir: g.dir });
      if (s === 'warn' && was === 'off') this.events.push({ k: 'gustWarn', id: i });
    });
    this.stepOwls();
    this.bell.v -= this.bell.swing * 0.02; this.bell.v *= 0.985; this.bell.swing += this.bell.v;

    // each climber's own moves
    for (const c of this.both) this.control(c, pads[c.who]);

    // predicted positions, then the rope pulls them together, then the tower stops them
    for (const c of this.both) this.predict(c);
    for (const c of this.both) { this.flight[c.who].vx = c.vx; this.flight[c.who].vy = c.vy; }
    this.solveRope(pads);
    for (const c of this.both) this.collide(c);
    // a taut rope doesn't bounce: the springing back toward the partner is damped, the swing across is kept
    if (this.tension > 0.97) for (const c of this.both) {
      if (c.mode !== 'air') continue;
      const o = this.bend ?? this.c(other(c.who)), dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy) || 1, vr = (c.vx * dx + c.vy * dy) / d;
      if (vr > 0) { const k = vr * ROPE.damp; c.vx -= dx / d * k; c.vy -= dy / d * k; }
    }
    this.hazards();
    this.afterMove();
  }

  private padFor(w: Who, inp: Input): Pad {
    if (this.players === 1 && w !== this.active) return HOLD;
    const p = inp[w]; if (!p) return HOLD;
    return { x: clamp(finite(p.x), -1, 1), up: !!p.up, jump: !!p.jump, grip: !!p.grip };
  }

  private control(c: Climber, p: Pad) {
    if (c.gripCool > 0) c.gripCool--;
    if (c.daze > 0) c.daze--;
    if (c.slipT > 0) c.slipT--;
    if (Math.abs(p.x) > 0.2) c.face = p.x > 0 ? 1 : -1;
    c.aim = Math.abs(p.x) < 0.2 ? 0 : p.x;
    const canLeap = (c.mode === 'stand' || c.mode === 'grip' || c.coyote > 0) && c.daze === 0;
    if (p.jump && canLeap && (c.mode !== 'air')) { c.charging = true; c.charge = Math.min(1, c.charge + DT / JUMP.full); }
    else if (c.charging && !p.jump) { if (canLeap) this.leap(c); c.charging = false; c.charge = 0; }
    else if (c.charging && c.mode === 'air' && c.coyote === 0) { c.charging = false; c.charge = 0; }
    // standing with claws in and not walking braces you: the rope can't pull you off
    c.braced = c.mode === 'stand' && p.grip && Math.abs(p.x) < 0.2 && c.slipT === 0;
    if (c.mode === 'grip') {
      if (!p.grip || c.slipT > 0) { this.letGo(c); return; }
      // climb up a post
      if (p.up && c.grip?.k === 'post' && !this.loaded(c)) {
        const post = this.world.posts[c.grip.id], o = this.c(other(c.who)), ny = Math.min(post.y1 - BODY.h + 4, c.y + GRIP.shimmy * DT);
        if (Math.hypot(c.x - o.x, ny - o.y) < this.ropeNow * 1.02 || this.inv(o) > 0) c.y = ny;
      }
    }
    // hauling: an anchored climber reels in a hanging partner
    if (p.up && this.anchored(c) && c.mode !== 'roll' && this.loaded(c)) {
      this.reel = Math.max(ROPE.haulMin, this.reel - ROPE.haul * DT);
      if (this.tick % 14 === 0) this.events.push({ k: 'haul', who: c.who });
    }
    // a standing climber walks unless charging or braced
    if (c.mode === 'stand') c.vx = c.charging ? 0 : p.x * MOVE.walk;
    else if (c.mode === 'air') {
      const want = p.x * MOVE.airMax;
      if ((p.x > 0 && c.vx < want) || (p.x < 0 && c.vx > want)) c.vx += p.x * MOVE.airAcc * DT;
      if (p.grip && c.gripCool === 0 && c.daze === 0) this.tryGrip(c);
    }
  }

  /** True when this climber is holding the other up: the partner hangs in the air on a tight rope, lower down. */
  loaded(c: Climber) { const o = this.c(other(c.who)); return o.mode === 'air' && this.tension > 0.9 && o.y < c.y + 6 && o.vy > -200; }

  private leap(c: Climber) {
    const ch = c.charge, v = Math.sqrt(JUMP.min * JUMP.min + (JUMP.max * JUMP.max - JUMP.min * JUMP.min) * ch), th = c.aim * JUMP.tilt;
    c.vx = v * Math.sin(th); c.vy = v * Math.cos(th);
    if (c.mode === 'grip' && c.grip?.k === 'side' && Math.sign(c.vx) === c.grip.side * -1) c.vx *= 0.3;
    c.mode = 'air'; c.grip = null; c.gripCool = GRIP.cool; c.coyote = 0; c.on = -1; c.air = 0; c.peakY = c.y;
    this.stats.jumps++;
    this.events.push({ k: 'jump', who: c.who, charge: ch });
    if (ch > 0.6) this.noise(c.x, c.y, NOISE.leap * (ch - 0.6) / 0.4);
  }
  private letGo(c: Climber) { c.mode = 'air'; c.grip = null; c.gripCool = GRIP.cool; c.peakY = c.y; c.air = 0; this.events.push({ k: 'let', who: c.who }); }

  /** Claws out in the air: catches a post, the side of a hay stack, or the underside of a beam. */
  private tryGrip(c: Climber) {
    const r = GRIP.reach, x0 = c.x - BODY.hw - r, x1 = c.x + BODY.hw + r, y0 = c.y - r, y1 = c.y + BODY.h + r;
    for (const p of this.world.posts) {
      if (x1 < p.x - 5 || x0 > p.x + 5 || y1 < p.y0 || y0 > p.y1) continue;
      const side: -1 | 1 = c.x < p.x ? -1 : 1;
      c.x = p.x + side * (5 + BODY.hw - 2); c.y = clamp(c.y, p.y0 - 4, p.y1 - BODY.h + 4); c.face = side === -1 ? 1 : -1;
      return this.gripped(c, { k: 'post', id: p.id, side });
    }
    let hit: GripOn | null = null;
    this.near(y0, y1, (s) => {
      if (hit || !s.grip || !this.solidOn(s) || x1 < s.x || x0 > s.x + s.w || y1 < s.y || y0 > s.y + s.h) return;
      if (s.oneWay) {
        // a beam: hang underneath it (only if mostly below it, and not about to land on it)
        // (rising fast, you pass up through it and land on top instead)
        if (c.y + BODY.h * 0.5 > s.y || c.vy > GRIP.beamRise) return;
        c.y = s.y - BODY.h + 3; c.x = clamp(c.x, s.x + 2, s.x + s.w - 2); hit = { k: 'beam', id: s.id, side: 1 };
      } else {
        // a hay stack's side
        if (c.y + BODY.h * 0.4 > s.y + s.h) return;
        const side: -1 | 1 = c.x < s.x + s.w / 2 ? -1 : 1;
        if (side === -1 && c.x > s.x || side === 1 && c.x < s.x + s.w) return;
        c.x = side === -1 ? s.x - BODY.hw + 1 : s.x + s.w + BODY.hw - 1; c.y = clamp(c.y, s.y - 4, s.y + s.h - BODY.h + 2); c.face = side === -1 ? 1 : -1;
        hit = { k: 'side', id: s.id, side };
      }
    });
    if (hit) this.gripped(c, hit);
  }
  private gripped(c: Climber, g: GripOn) {
    c.mode = 'grip'; c.grip = g; c.vx = 0; c.vy = 0; c.charging = false; c.charge = 0;
    this.settle(c);
    this.events.push({ k: 'grip', who: c.who });
  }
  /** Stood or gripped: a big drop since the last safe height counts as a fall. */
  private settle(c: Climber) {
    const drop = c.safeY - c.y;
    if (drop > LAND.fall) {
      if (this.tick - this.lastFall > 90) this.stats.falls++;
      this.lastFall = this.tick;
      this.events.push({ k: 'fall', who: c.who, drop });
    }
    c.safeY = c.y;
  }

  private predict(c: Climber) {
    c.px = c.x; c.py = c.y;
    if (c.mode === 'grip' || c.mode === 'roll') { c.vx = 0; c.vy = 0; return; }
    c.vy = Math.max(-MOVE.fall, c.vy - G * DT);
    // carried along by a sliding bale
    if (c.mode === 'stand' && c.on >= 1000) { const i = c.on - 1000; c.x += this.baleX(i) - this.baleX(i, this.tick - 1); }
    // knothole gusts
    this.world.gusts.forEach((g, i) => {
      if (c.y + BODY.h < g.y0 || c.y > g.y1 || this.gustState(i) !== 'on') return;
      if (c.mode === 'air') { if (c.vx * g.dir < GUST.max) c.vx += g.dir * GUST.acc * DT; }
      else if (!c.braced) c.x += g.dir * GUST.slide * DT;
    });
    c.x += c.vx * DT; c.y += c.vy * DT;
  }

  /** Verlet links between the two waists; the climbers are the end points, so the rope pulls on them. */
  private solveRope(pads: Record<Who, Pad>) {
    const n = ROPE.links, rx = this.rx, ry = this.ry, d = this.dora, e = this.enzo;
    const rest = this.ropeNow / n;
    for (let i = 1; i < n; i++) {
      const vx = (rx[i] - this.rpx[i]) * 0.97, vy = (ry[i] - this.rpy[i]) * 0.97;
      this.rpx[i] = rx[i]; this.rpy[i] = ry[i];
      rx[i] += vx; ry[i] += vy - G * 0.7 * DT * DT;
      // the wind tugs the rope too
      this.world.gusts.forEach((g, gi) => { if (ry[i] > g.y0 && ry[i] < g.y1 && this.gustState(gi) === 'on') rx[i] += g.dir * 0.6; });
    }
    rx[0] = d.x; ry[0] = d.y + BODY.waist; rx[n] = e.x; ry[n] = e.y + BODY.waist;
    const wd = this.inv(d), we = this.inv(e), w = (i: number) => (i === 0 ? wd : i === n ? we : ROPE.linkW);
    for (let it = 0; it < ROPE.iters; it++) {
      for (let j = 0; j < n; j++) {
        const i = it % 2 === 0 ? j : n - 1 - j, a = i, b = i + 1;
        const dx = rx[b] - rx[a], dy = ry[b] - ry[a], len = Math.hypot(dx, dy);
        if (len <= rest || len < 1e-9) continue;
        const wa = w(a), wb = w(b), sum = wa + wb; if (sum === 0) continue;
        const k = (len - rest) / len / sum;
        rx[a] += dx * k * wa; ry[a] += dy * k * wa; rx[b] -= dx * k * wb; ry[b] -= dy * k * wb;
      }
    }
    // the links drape over ledges and floors (they don't push the climbers, only rest on things); with both climbers
    // in the air nothing holds the rope up, so it falls with them instead of hanging them over a beam like a pulley
    const loose = d.mode === 'air' && e.mode === 'air';
    for (let i = 1; i < n && !loose; i++) {
      const x = rx[i], y = ry[i], py = this.rpy[i];
      this.near(y - 2, y + 2, (s) => {
        if (x < s.x || x > s.x + s.w || !this.solidOn(s)) return;
        const top = s.y + s.h;
        if (y < top && (py >= top - 0.5 || !s.oneWay && y > s.y + s.h * 0.4)) { ry[i] = top + 0.5; this.rpx[i] = rx[i] - (rx[i] - this.rpx[i]) * 0.6; }
      });
      if (ry[i] < 0.5) ry[i] = 0.5;
    }
    // the rope stops like a wall a little past its length; if it would cut through a floor or a block, it bends round
    // that solid's nearest corner instead, so a climber hanging under a floor hangs from the hatch's edge
    const max = this.ropeNow * (1 + ROPE.stretch);
    const b = this.bend = this.bendAt(rx[0], ry[0], rx[n], ry[n]);
    let len: number;
    if (b) {
      const l1 = Math.hypot(rx[0] - b.x, ry[0] - b.y) || 1e-9, l2 = Math.hypot(rx[n] - b.x, ry[n] - b.y) || 1e-9;
      len = l1 + l2;
      if (len > max && wd + we > 0) {
        const over = len - max, m0 = Math.min(l1, over * wd / (wd + we)), m1 = Math.min(l2, over * we / (wd + we));
        rx[0] += (b.x - rx[0]) / l1 * m0; ry[0] += (b.y - ry[0]) / l1 * m0; rx[n] += (b.x - rx[n]) / l2 * m1; ry[n] += (b.y - ry[n]) / l2 * m1;
        len -= m0 + m1;
      }
      // lay the links along the bent rope
      const a1 = Math.hypot(rx[0] - b.x, ry[0] - b.y), a2 = Math.hypot(rx[n] - b.x, ry[n] - b.y), tot = a1 + a2 || 1;
      for (let i = 1; i < n; i++) {
        const t = i / n * tot;
        if (t <= a1) { const f = t / (a1 || 1); rx[i] = rx[0] + (b.x - rx[0]) * f; ry[i] = ry[0] + (b.y - ry[0]) * f; }
        else { const f = (t - a1) / (a2 || 1); rx[i] = b.x + (rx[n] - b.x) * f; ry[i] = b.y + (ry[n] - b.y) * f; }
        this.rpx[i] = rx[i]; this.rpy[i] = ry[i];
      }
    } else {
      const dx = rx[n] - rx[0], dy = ry[n] - ry[0]; len = Math.hypot(dx, dy);
      if (len > max && wd + we > 0) {
        const k = (len - max) / len / (wd + we);
        rx[0] += dx * k * wd; ry[0] += dy * k * wd; rx[n] -= dx * k * we; ry[n] -= dy * k * we;
        len = max;
      }
    }
    // the climbers go where the rope put their waists
    d.x = rx[0]; d.y = ry[0] - BODY.waist; e.x = rx[n]; e.y = ry[n] - BODY.waist;
    this.tension = len / this.ropeNow;
    // pay the rope back out once it's slack and nobody is hauling
    const hauling = (['dora', 'enzo'] as Who[]).some((w2) => pads[w2].up && this.anchored(this.c(w2)));
    if (!hauling && this.reel < 1 && (len < this.ropeNow * 0.92 || !this.loaded(d) && !this.loaded(e))) this.reel = Math.min(1, this.reel + ROPE.payOut * DT);
  }

  /** The corner the straight rope from (ax, ay) to (bx, by) must bend round, if it cuts through a solid. */
  private bendAt(ax: number, ay: number, bx: number, by: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bestT = 2;
    this.near(Math.min(ay, by) - 1, Math.max(ay, by) + 1, (s) => {
      if (s.oneWay || !this.solidOn(s)) return;
      // Liang-Barsky: where along the segment it enters the box, if it does
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dy = by - ay;
      for (const [p, q] of [[-dx, ax - s.x], [dx, s.x + s.w - ax], [-dy, ay - s.y], [dy, s.y + s.h - ay]]) {
        if (p === 0) { if (q < 0) return; continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) return; if (r > t0) t0 = r; } else { if (r < t0) return; if (r < t1) t1 = r; }
      }
      if (t1 - t0 < 1e-6 || t0 >= bestT) return;
      let pick: { x: number; y: number } | null = null, pl = Infinity;
      for (const [cx, cy] of [[s.x - 1, s.y - 1], [s.x + s.w + 1, s.y - 1], [s.x - 1, s.y + s.h + 1], [s.x + s.w + 1, s.y + s.h + 1]]) {
        const l = Math.hypot(ax - cx, ay - cy) + Math.hypot(bx - cx, by - cy);
        if (l < pl) { pl = l; pick = { x: cx, y: cy }; }
      }
      best = pick; bestT = t0;
    });
    return best;
  }

  /** Sweeps a climber from where it was this tick to where it wants to be: across first, then up or down. */
  private collide(c: Climber) {
    if (c.mode === 'grip' || c.mode === 'roll') { c.x = c.px; c.y = c.py; return; }
    const tx = c.x, ty = c.y, hw = BODY.hw, h = BODY.h;
    let x = clamp(tx, hw, TOWER_W - hw), y = c.py, hitX = x !== tx;
    // across
    this.near(y - 2, y + h + 2, (s) => {
      if (s.oneWay || !this.solidOn(s)) return;
      if (y + h <= s.y || y >= s.y + s.h || x + hw <= s.x || x - hw >= s.x + s.w) return;
      if (c.px <= s.x + s.w / 2) x = s.x - hw; else x = s.x + s.w + hw; hitX = true;
    });
    for (let i = 0; i < this.world.bales.length; i++) {
      const b = this.world.bales[i], bx = this.baleX(i);
      if (y + h <= b.y || y >= b.y + b.h || x + hw <= bx || x - hw >= bx + b.w) continue;
      if (c.px <= bx + b.w / 2) x = bx - hw; else x = bx + b.w + hw; hitX = true;
    }
    // up or down
    y = ty; let landed: Solid | null = null, baleOn = -1, head = false;
    this.near(Math.min(y, c.py) - 2, Math.max(y, c.py) + h + 2, (s) => {
      if (!this.solidOn(s)) return;
      if (x + hw <= s.x || x - hw >= s.x + s.w) return;
      const top = s.y + s.h;
      if (y <= c.py && c.py >= top - 0.01 && y < top) { if (y < top || !landed) { y = top; landed = s; } return; }
      if (s.oneWay) return;
      if (y + h > s.y && y < top) {
        if (y > c.py && c.py + h <= s.y + 0.01) {
          // only clipping a corner with the edge of your head: slide off it sideways instead of sticking under it
          const inL = x + hw - s.x, inR = s.x + s.w - (x - hw);
          if (Math.min(inL, inR) < hw * 0.8 && s.w > hw * 2) {
            const nx = inL < inR ? s.x - hw : s.x + s.w + hw;
            if (nx >= hw && nx <= TOWER_W - hw) { x = nx; return; }
          }
          y = s.y - h; head = true;
        }
        else if (y <= c.py) { y = top; landed = s; }
      }
    });
    for (let i = 0; i < this.world.bales.length; i++) {
      const b = this.world.bales[i], bx = this.baleX(i), top = b.y + b.h;
      if (x + hw <= bx || x - hw >= bx + b.w) continue;
      if (y <= c.py && c.py >= top - 3 && y < top) { y = top; baleOn = i; landed = null; }
      else if (y + h > b.y && y < top && y > c.py && c.py + h <= b.y + 0.01) { y = b.y - h; head = true; }
    }
    if (y < 0) { y = 0; landed = this.world.solids[0]; }
    c.x = x; c.y = y;
    const vyBefore = c.vy;
    c.vx = (c.x - c.px) / DT; c.vy = (c.y - c.py) / DT;
    if (hitX) c.vx = 0;
    if (head) { c.vy = Math.min(0, c.vy); if (this.world.bell && this.touches(c, this.world.bell, 3)) this.ring(Math.abs(vyBefore)); }
    const ground = landed !== null || baleOn >= 0;
    if (ground) {
      const impact = -Math.min(vyBefore, c.vy, 0);
      c.vy = 0;
      if (c.mode === 'air') {
        const hard = impact > LAND.hard;
        c.mode = 'stand'; c.charging = false; c.charge = 0;
        if (impact > 60 || c.air > 4) this.events.push({ k: 'land', who: c.who, v: impact, hard });
        if (hard) c.daze = LAND.daze;
        this.noise(c.x, c.y, NOISE.land * impact / 1000);
        if (landed && (landed as Solid).kind === 'bell') this.ring(impact);
        this.settle(c);
      }
      c.on = baleOn >= 0 ? 1000 + baleOn : (landed as unknown as Solid).id;
      c.coyote = JUMP.coyote;
      const ls = landed as Solid | null;
      if (ls && ls.kind === 'straw' && !this.straw[ls.id]) this.straw[ls.id] = 1;
    } else if (c.mode === 'stand') {
      c.mode = 'air'; c.peakY = c.y; c.air = 0; c.on = -1;
    }
  }
  private touches(c: Climber, s: Solid, pad: number) { return c.x + BODY.hw + pad > s.x && c.x - BODY.hw - pad < s.x + s.w && c.y + BODY.h + pad > s.y && c.y - pad < s.y + s.h; }
  private ring(v: number) {
    if (v < 120) return;
    const k = Math.min(1.6, v / 500);
    this.bell.v += 0.012 * k;
    const b = this.world.bell!;
    this.noise(b.x + b.w / 2, b.y + b.h, NOISE.bell * k);
    this.events.push({ k: 'bell', v: k });
  }

  /** Bales shoving, lanterns knocking, owls flapping. */
  private hazards() {
    for (const c of this.both) {
      if (c.mode === 'roll') continue;
      // a bale sliding into a climber gripping beside its path knocks it loose
      for (let i = 0; i < this.world.bales.length; i++) {
        const b = this.world.bales[i], bx = this.baleX(i), v = bx - this.baleX(i, this.tick - 1);
        if (c.y + BODY.h <= b.y || c.y >= b.y + b.h || c.x + BODY.hw <= bx || c.x - BODY.hw >= bx + b.w) continue;
        if (c.mode === 'grip') { this.letGo(c); c.gripCool = 20; }
        c.x = v > 0 ? bx + b.w + BODY.hw : bx - BODY.hw; c.vx = v * HZ * 1.6; c.vy = Math.max(c.vy, 120);
        if (c.mode === 'stand') { c.mode = 'air'; c.on = -1; c.peakY = c.y; }
        this.events.push({ k: 'shove', who: c.who });
      }
      for (let i = 0; i < this.world.lanterns.length; i++) {
        const p = this.lanternAt(i), cx = clamp(p.x, c.x - BODY.hw, c.x + BODY.hw), cy = clamp(p.y, c.y, c.y + BODY.h);
        if (Math.hypot(p.x - cx, p.y - cy) > LANTERN.r || c.daze > 0) continue;
        const dx = c.x - p.x, dy = c.y + BODY.h / 2 - p.y, d = Math.hypot(dx, dy) || 1;
        if (c.mode === 'grip') c.grip = null;
        c.mode = 'air'; c.on = -1; c.peakY = Math.max(c.peakY, c.y); c.gripCool = LANTERN.daze; c.daze = LANTERN.daze;
        c.vx = dx / d * LANTERN.knock; c.vy = Math.max(140, dy / d * LANTERN.knock);
        this.events.push({ k: 'bonk', who: c.who, x: p.x, y: p.y });
        this.noise(c.x, c.y, 0.2);
      }
    }
    this.world.owls.forEach((o, i) => {
      const s = this.owls[i]; if (s.state !== 'flap') return;
      for (const c of this.both) {
        const dx = c.x - o.x, dy = c.y + BODY.h / 2 - o.y, d = Math.hypot(dx, dy) || 1;
        if (d > OWL.r || this.anchored(c)) continue;
        if (s.t === OWL.flap) {
          c.mode = 'air'; c.on = -1; c.grip = null; c.gripCool = 24;
          c.vx += dx / d * OWL.push; c.vy = Math.max(c.vy, OWL.lift); c.peakY = Math.max(c.peakY, c.y);
          this.events.push({ k: 'blown', who: c.who });
        } else if (c.mode === 'air') c.vx += Math.sign(dx || 1) * OWL.acc * DT * (1 - d / OWL.r);
      }
    });
  }

  private stepOwls() {
    this.world.owls.forEach((o, i) => {
      const s = this.owls[i];
      s.noise = Math.max(0, s.noise - OWL.fade * DT);
      switch (s.state) {
        case 'sleep': if (s.noise >= OWL.stir) { s.state = 'stir'; s.t = 0; this.events.push({ k: 'stir', id: i }); } break;
        case 'stir':
          s.t++;
          if (s.noise >= OWL.wake) { s.state = 'wake'; s.t = OWL.windup; this.events.push({ k: 'hoot', id: i }); }
          else if (s.noise < OWL.stir * 0.5 && s.t > 60) s.state = 'sleep';
          break;
        case 'wake': if (--s.t <= 0) { s.state = 'flap'; s.t = OWL.flap; this.events.push({ k: 'flap', id: i }); } break;
        case 'flap': if (--s.t <= 0) { s.state = 'calm'; s.t = OWL.calm; s.noise = 0; } break;
        case 'calm': s.noise = 0; if (--s.t <= 0) s.state = 'sleep'; break;
      }
    });
  }

  private afterMove() {
    // the rope snapping tight: a catch when a partner holds, a yank otherwise
    for (const c of this.both) {
      if (c.mode !== 'air') { c.air = 0; continue; }
      c.air++; c.peakY = Math.max(c.peakY, c.y);
      if (c.coyote > 0) c.coyote--;
    }
    this.ropeEvents();
    // strain: holding a hanging partner tires your claws
    for (const c of this.both) {
      if (this.anchored(c) && c.mode !== 'roll' && this.loaded(c)) {
        const before = c.strain;
        c.strain = Math.min(1, c.strain + DT / (c.mode === 'grip' ? GRIP.hold : GRIP.brace));
        if (before < 0.7 && c.strain >= 0.7) this.events.push({ k: 'strain', who: c.who });
        if (c.strain >= 1) {
          c.strain = 0.6; c.slipT = 50;
          if (c.mode === 'grip') this.letGo(c); else c.braced = false;
          this.events.push({ k: 'slip', who: c.who });
        }
      } else c.strain = Math.max(0, c.strain - DT / GRIP.rest);
    }
    // acorns
    this.world.acorns.forEach((a) => {
      if (this.found.has(a.id)) return;
      for (const c of this.both) if (Math.abs(c.x - a.x) < BODY.hw + 8 && a.y > c.y - 8 && a.y < c.y + BODY.h + 10) { this.found.add(a.id); this.foundNow++; this.events.push({ k: 'acorn', id: a.id, who: c.who }); break; }
    });
    // progress, the section, tubs and the top
    this.stats.best = Math.max(this.stats.best, this.height);
    const sec = sectionAt(this.height + 1);
    if (sec !== this.section) { const up = SECTIONS[sec].y0 > SECTIONS[this.section].y0; this.section = sec; if (up) this.events.push({ k: 'section', id: sec }); }
    if (!this.hard) {
      for (const t of this.world.tubs) {
        if (t.id === 0 && this.tub === 0) continue;
        if (t.id <= this.tub && t.id !== 0) continue;
        if (this.both.every((c) => c.mode === 'stand' && Math.abs(c.y - t.y) < 2 && Math.abs(c.x - t.x) < 44)) { this.startRoll(t.id); break; }
      }
    }
    const ridge = this.world.solids[this.world.solids.length - 1];
    if (this.both.every((c) => c.mode === 'stand' && c.on === ridge.id)) { this.phase = 'won'; this.events.push({ k: 'won' }); }
  }

  /** Tracks the rope's moods for sounds and the screen: catches, yanks and drags. */
  /** Tracks the rope's moods for sounds and the screen: the rope suddenly stopping a flying climber is a catch (when
   * the partner holds on), a yank (when both fly) or a drag (when the partner is pulled along). */
  private ropeEvents() {
    if (this.tension < 0.95 || this.tick - this.lastTwang < 20) return;
    let c: Climber | null = null, dv = 0;
    for (const k of this.both) {
      if (k.mode !== 'air') continue;
      const d = Math.hypot(k.vx - this.flight[k.who].vx, k.vy - this.flight[k.who].vy);
      if (d > dv) { dv = d; c = k; }
    }
    if (!c || dv < 140) return;
    const o = this.c(other(c.who)), v = Math.hypot(this.flight[c.who].vx, this.flight[c.who].vy);
    this.lastTwang = this.tick;
    if (this.anchored(o)) { this.stats.catches++; this.events.push({ k: 'catch', who: c.who, by: o.who, v }); this.noise(o.x, o.y, NOISE.twang); }
    else if (o.mode === 'stand') this.events.push({ k: 'drag', who: o.who });
    else this.events.push({ k: 'yank', who: c.who, v });
  }

  private startRoll(id: number) {
    const t = this.world.tubs[id], fresh = id > this.tub;
    this.phase = 'roll'; this.rolling = id; this.rollT = ROLL_TICKS;
    for (const c of this.both) { c.mode = 'roll'; c.vx = 0; c.vy = 0; c.charging = false; c.charge = 0; c.strain = 0; c.daze = 0; c.grip = null; }
    this.dora.x = t.x - 10; this.enzo.x = t.x + 10; this.dora.y = this.enzo.y = t.y;
    this.reel = 1;
    this.events.push({ k: 'tub', id, fresh });
  }
  private stepRoll() {
    if (--this.rollT > 0) return;
    const id = this.rolling, t = this.world.tubs[id];
    this.phase = 'climb'; this.rolling = -1;
    this.dora.x = t.x - 26; this.enzo.x = t.x + 26;
    for (const c of this.both) { c.mode = 'stand'; c.y = t.y; c.px = c.x; c.py = c.y; c.safeY = c.y; c.on = -1; c.face = c === this.dora ? -1 : 1; }
    // the rope settles between them
    for (let i = 0; i <= ROPE.links; i++) { this.rx[i] = this.dora.x + (this.enzo.x - this.dora.x) * i / ROPE.links; this.ry[i] = t.y + BODY.waist - 8 * Math.sin(Math.PI * i / ROPE.links); }
    this.rpx = this.rx.slice(); this.rpy = this.ry.slice();
    if (id > this.tub) { this.tub = id; this.events.push({ k: 'checkpoint', id }); }
  }

  // ---------------------------------------------------------------- bots and tests
  /** Puts the climbers somewhere (standing, unless told otherwise) with the rope laid between them. For tests and tools. */
  place(d: { x: number; y: number; mode?: Mode }, e: { x: number; y: number; mode?: Mode }) {
    for (const [c, p] of [[this.dora, d], [this.enzo, e]] as const) {
      c.x = c.px = p.x; c.y = c.py = p.y; c.vx = c.vy = 0; c.mode = p.mode ?? 'stand'; c.grip = null; c.charging = false; c.charge = 0; c.safeY = c.peakY = p.y; c.on = -1; c.strain = 0; c.daze = 0;
    }
    const n = ROPE.links;
    for (let i = 0; i <= n; i++) { this.rx[i] = d.x + (e.x - d.x) * i / n; this.ry[i] = d.y + (e.y - d.y) * i / n + BODY.waist; }
    this.rpx = this.rx.slice(); this.rpy = this.ry.slice(); this.reel = 1;
  }
  /** Both climbers settled: standing or gripping, not charging, barely moving. */
  stable() {
    // riding a bale counts as still: it's the bale that moves
    const own = (c: Climber) => c.mode === 'stand' && c.on >= 1000 ? c.vx - (this.baleX(c.on - 1000) - this.baleX(c.on - 1000, this.tick - 1)) * HZ : c.vx;
    return this.phase !== 'roll' && this.both.every((c) => (c.mode === 'stand' || c.mode === 'grip') && !c.charging && Math.abs(own(c)) < 1 && c.daze === 0);
  }
  /** A copy that plays on independently (the tower itself is shared). */
  clone(): RopeclimbGame {
    const g = Object.create(RopeclimbGame.prototype) as RopeclimbGame;
    Object.assign(g, this);
    g.rng = new Rng(this.rng.s);
    g.dora = { ...this.dora, grip: this.dora.grip && { ...this.dora.grip } }; g.enzo = { ...this.enzo, grip: this.enzo.grip && { ...this.enzo.grip } };
    g.rx = this.rx.slice(); g.ry = this.ry.slice(); g.rpx = this.rpx.slice(); g.rpy = this.rpy.slice();
    g.owls = this.owls.map((o) => ({ ...o })); g.straw = { ...this.straw }; g.bell = { ...this.bell };
    g.found = new Set(this.found); g.stats = { ...this.stats }; g.events = []; g.flight = { dora: { ...this.flight.dora }, enzo: { ...this.flight.enzo } };
    return g;
  }
  /** A fingerprint of everything that moves, for replay checks. */
  hash() {
    let h = 2166136261;
    const mix = (v: number) => { h = Math.imul(h ^ Math.round(v * 1000), 16777619) >>> 0; };
    for (const c of this.both) { mix(c.x); mix(c.y); mix(c.vx); mix(c.vy); mix(c.charge); mix(c.strain); mix(c.mode.length); }
    for (let i = 0; i < this.rx.length; i++) { mix(this.rx[i]); mix(this.ry[i]); }
    mix(this.reel); mix(this.tick); mix(this.tub); mix(this.stats.falls); mix(this.found.size); mix(this.rng.s);
    for (const o of this.owls) mix(o.noise);
    return h.toString(16);
  }
  /** The time on the clock, as m:ss.t. */
  get clock() { return clockText(this.stats.ticks); }
}

export const clockText = (ticks: number) => {
  const s = ticks / HZ, m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};

// ---------------------------------------------------------------- medals
/** Fewest-falls medals for a finished climb: gold for none at all. */
export const MEDALS = [{ id: 'gold', name: 'Sure-Footed', falls: 0 }, { id: 'silver', name: 'Steady Paws', falls: 5 }, { id: 'bronze', name: 'Hay Hopper', falls: 15 }] as const;
export const medalFor = (falls: number) => MEDALS.find((m) => falls <= m.falls) ?? null;

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'ropeclimb-v1';
/** A climb in progress, saved at each dust-bath tub (Hard Knot climbs aren't saved). */
export type ClimbSave = { tub: number; players: Mode2; stats: Stats; found: number[] };
export type Best = { ticks: number; falls: number };
export type Save = {
  v: 1;
  climb: ClimbSave | null;
  /** Every acorn ever found. */
  acorns: number[];
  finished: number; hardFinished: number;
  best: { normal: Best | null; hard: Best | null };
  /** Fewest falls on a finished climb. */
  fewest: { normal: number | null; hard: number | null };
  players: Mode2;
  settings: { sound: boolean; music: boolean; shake: boolean; autoGrip: boolean };
};
export const freshSave = (): Save => ({ v: 1, climb: null, acorns: [], finished: 0, hardFinished: 0, best: { normal: null, hard: null }, fewest: { normal: null, hard: null }, players: 1, settings: { sound: true, music: true, shake: true, autoGrip: true } });
const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : d);
const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < ACORN_COUNT))].sort((a, b) => a - b) : []);
const best = (v: unknown): Best | null => {
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>, t = typeof b.ticks === 'number' && b.ticks >= 1 ? int(b.ticks, 1, 1e9, 0) : 0, f = int(b.falls, 0, 1e6, -1);
  return t > 0 && f >= 0 ? { ticks: t, falls: f } : null;
};
/** Reads a save, ignoring anything broken; a missing or corrupt save gives a fresh one. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return s;
    s.acorns = ids(o.acorns);
    s.finished = int(o.finished, 0, 1e6, 0); s.hardFinished = int(o.hardFinished, 0, 1e6, 0);
    if (o.best && typeof o.best === 'object') { const b = o.best as Record<string, unknown>; s.best.normal = best(b.normal); s.best.hard = best(b.hard); }
    if (o.fewest && typeof o.fewest === 'object') { const f = o.fewest as Record<string, unknown>; s.fewest.normal = typeof f.normal === 'number' ? int(f.normal, 0, 1e6, 0) : null; s.fewest.hard = typeof f.hard === 'number' ? int(f.hard, 0, 1e6, 0) : null; }
    s.players = o.players === 2 ? 2 : 1;
    if (o.settings && typeof o.settings === 'object') { const st = o.settings as Record<string, unknown>; s.settings.sound = st.sound !== false; s.settings.music = st.music !== false; s.settings.shake = st.shake !== false; s.settings.autoGrip = st.autoGrip !== false; }
    if (o.climb && typeof o.climb === 'object') {
      const c = o.climb as Record<string, unknown>, st = (c.stats && typeof c.stats === 'object' ? c.stats : {}) as Record<string, unknown>;
      s.climb = {
        tub: int(c.tub, 0, TUB_COUNT - 1, 0), players: c.players === 2 ? 2 : 1, found: ids(c.found),
        stats: { ticks: int(st.ticks, 0, 1e9, 0), falls: int(st.falls, 0, 1e6, 0), jumps: int(st.jumps, 0, 1e7, 0), catches: int(st.catches, 0, 1e7, 0), best: clamp(finite(st.best), 0, TOP_Y) },
      };
    }
  } catch { return freshSave(); }
  return s;
}
/** The climb to save at a tub (none on Hard Knot). */
export const climbSave = (g: RopeclimbGame): ClimbSave | null => (g.hard ? null : { tub: g.tub, players: g.players, stats: { ...g.stats }, found: [...g.found].sort((a, b) => a - b) });
/** Starts a climb from a save (at its tub) or from the bottom. */
export const resume = (c: ClimbSave, seed: number, active?: Who) => new RopeclimbGame({ seed, players: c.players, tub: c.tub, stats: c.stats, found: c.found, active });
/** Records a finished climb: the count, the best time and the fewest falls. Returns which records it set. */
export function recordFinish(s: Save, g: RopeclimbGame) {
  const key = g.hard ? 'hard' : 'normal', run: Best = { ticks: g.stats.ticks, falls: g.stats.falls };
  if (g.hard) s.hardFinished++; else s.finished++;
  const prev = s.best[key], fastest = !prev || run.ticks < prev.ticks;
  if (fastest) s.best[key] = run;
  const pf = s.fewest[key], fewest = pf === null || run.falls < pf;
  if (fewest) s.fewest[key] = run.falls;
  s.climb = null;
  for (const a of g.found) if (!s.acorns.includes(a)) s.acorns.push(a);
  s.acorns.sort((a, b) => a - b);
  return { fastest, fewest };
}
/** Hard Knot opens after the first finished climb. */
export const hardOpen = (s: Save) => s.finished > 0 || s.hardFinished > 0;
export const FLOORS_PER_SECTION = 2;
export const floorOf = (y: number) => Math.max(0, Math.min(TUB_COUNT - 1, Math.floor(y / FLOOR_H)));

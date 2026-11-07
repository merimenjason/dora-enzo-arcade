// The Sunken Bellspire: one hero's body, moved one fixed tick (1/60 s) at a time. Shared by the engine, the route
// planner and the bots, so a planned jump is the same jump the player makes.

export const TICK = 1 / 60;
export const HERO_W = 10, HERO_H = 22;
export const GRAV = 0.32, MAX_FALL = 6, JUMP_V = 6.0, JUMP_CUT = 2.2, AIR_JUMP_V = 5.2;
export const DASH_V = 4.6, DASH_T = 12, DASH_CD = 24;
export const WALL_SLIDE = 1.4, KICK_VX = 2.8, KICK_VY = 5.6, KICK_LOCK = 9;
export const GLIDE_FALL = 0.6;
export const SWIM_SINK = 1.1, SWIM_STROKE = 2.7, SWIM_EXIT_V = 5.4, SWIM_SPEED = 1.35;
export const CLIMB_V = 1.6;
export const RUN = { dora: 2.0, enzo: 1.75 } as const;
/** The Bell Rope: how far from Dora's hands a hook can be caught, the rope's shortest and longest length, the pump
 *  that steering gives each tick, the swing's widest angle and the kick a jump off the rope adds. */
export const ROPE_REACH = 64, ROPE_MIN = 30, ROPE_MAX = 72, ROPE_PUMP = 0.0022, ROPE_MAX_ANG = 1.4, ROPE_KICK = 3.2;
/** The guided Bell Rope (with the helping hand): the reach a hook catches itself from, the rope's resting length, the
 *  steady swing's angle, and how far a guided release can fly (across and up/down). */
export const ASSIST_REACH = 96, ASSIST_LEN = 56, ASSIST_AMP = 1.0, AIM_DX = 15 * 16, AIM_UP = 7 * 16, AIM_DOWN = 10 * 16;
/** Wind: how much a gust of strength 1 adds to the speed a body runs or drifts at (on the ground only while moving,
 *  so a hero can always stand braced), and how fast it carries the Lantern Glide upward. */
export const WIND_RUN = 0.6, WIND_AIR = 1.4, WIND_LIFT = 1.2;

/** What the world says about a tile or a spot; the engine and the planner each provide one. */
export interface Env {
  solid(c: number, r: number): boolean;
  /** A ledge you can stand on from above but jump up through (also the top rung of a ladder). */
  oneway(c: number, r: number): boolean;
  ladder(c: number, r: number): boolean;
  hazard(c: number, r: number): boolean;
  /** The water surface (world y) at this spot, or null where it is dry. */
  surface(x: number, y: number): number | null;
  /** The y below which the water is too deep to dive without the coat, or null. */
  deep(x: number, y: number): number | null;
  /** Floating reed platforms: one-way ledges at a moving height. */
  floats(): { x0: number; x1: number; y: number }[];
  /** The gust here: its sideways strength (signed; 0 is calm). Optional: no wind anywhere without it. */
  wind?(x: number, y: number): number;
  /** Bell hooks Dora's rope can catch (world points). */
  hooks?(): { x: number; y: number }[];
}

export type Caps = {
  speed: number; dash: boolean; double: boolean; wallkick: boolean; glide: boolean; deep: boolean; swimMul: number;
  coyote: number; buffer: number;
  /** the Bell Rope (Dora); how much of a gust reaches the body (1 is all of it; the Windward Jacket takes less) */
  rope?: boolean; windMul?: number;
  /** the guided Bell Rope (the helping hand): hooks catch themselves, the swing keeps itself, a jump flies to a target */
  ropeAssist?: boolean;
};

export type Body = {
  x: number; y: number; vx: number; vy: number;
  ground: boolean; onOneway: boolean; coyote: number; jumpBuf: number; airJumps: number; airDash: boolean;
  dashT: number; dashCd: number; dashDir: 1 | -1; kickT: number; kickDir: 1 | -1; dropT: number;
  climb: boolean; swim: boolean; wade: boolean; glide: boolean; wall: -1 | 0 | 1; face: 1 | -1;
  /** set by `stepBody`: what happened this tick */
  landed: boolean; jumped: '' | 'ground' | 'air' | 'wall' | 'swim' | 'ladder' | 'rope'; hazard: boolean; bonk: boolean; dashed: boolean;
  /** on the Bell Rope: the hook, the rope's length, its angle from straight down (+ is to the hook's right) and how
   *  fast that angle changes; null when not swinging */
  rope: { hx: number; hy: number; len: number; ang: number; av: number; t: number; ph?: number; amp?: number; sd?: 1 | -1; stuck?: number } | null;
  /** a guided flight off the rope (the helping hand): from (x0, y0) to (x1, y1) over `dur` ticks, ending on a hook's
   *  rope or a ledge */
  fly: Fly | null;
  /** where the feet last stood on solid ground or a ledge (the guided rope's safety net), and a hook just let go of
   *  that won't catch itself again until the feet touch down */
  homeX: number; homeY: number; skipX: number; skipY: number;
  /** set by `stepBody`: the rope caught a hook this tick, or was let go of */
  hooked: boolean; unhooked: boolean;
  /** the gust felt this tick (signed) */
  gust: number;
};

export type Fly = { x0: number; y0: number; x1: number; y1: number; arc: number; dur: number; t: number; kind: 'hook' | 'ledge'; hx: number; hy: number; dir: 1 | -1; home?: boolean };
export type RopeAim = { kind: 'hook' | 'ledge'; x: number; y: number; hx: number; hy: number; path: { x: number; y: number }[]; fly: Fly };
export type BodyInput = { dir: -1 | 0 | 1; up: boolean; down: boolean; jumpP: boolean; jumpH: boolean; dashP: boolean; ropeP?: boolean };

export function newBody(x: number, y: number): Body {
  return {
    x, y, vx: 0, vy: 0, ground: false, onOneway: false, coyote: 0, jumpBuf: 0, airJumps: 0, airDash: true, dashT: 0, dashCd: 0, dashDir: 1,
    kickT: 0, kickDir: 1, dropT: 0, climb: false, swim: false, wade: false, glide: false, wall: 0, face: 1,
    landed: false, jumped: '', hazard: false, bonk: false, dashed: false, rope: null, hooked: false, unhooked: false, gust: 0,
    fly: null, homeX: NaN, homeY: NaN, skipX: NaN, skipY: NaN,
  };
}

const T = 16;
const colsOf = (x0: number, x1: number) => [Math.floor(x0 / T), Math.floor((x1 - 0.001) / T)] as const;

/** Is the box [x0,x1)×[y0,y1) clear of solid tiles? */
export function boxClear(env: Env, x0: number, y0: number, x1: number, y1: number) {
  const [c0, c1] = colsOf(x0, x1), [r0, r1] = colsOf(y0, y1);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (env.solid(c, r)) return false;
  return true;
}

function touchesHazard(env: Env, b: Body) {
  const [c0, c1] = colsOf(b.x - HERO_W / 2 - 1, b.x + HERO_W / 2 + 1), [r0, r1] = colsOf(b.y - HERO_H - 1, b.y + 1);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (env.hazard(c, r)) return true;
  return false;
}

function onLadder(env: Env, b: Body, c = Math.floor(b.x / T)) {
  return env.ladder(c, Math.floor((b.y - 4) / T)) || env.ladder(c, Math.floor((b.y - HERO_H / 2) / T));
}
/** Grabbing is forgiving: a ladder whose column is within about 6 px of the hero's middle counts. */
const GRAB = 6;
function ladderNear(env: Env, b: Body, test: (c: number) => boolean): number | null {
  const c = Math.floor(b.x / T);
  if (test(c)) return c;
  for (const cc of [Math.floor((b.x - GRAB) / T), Math.floor((b.x + GRAB) / T)]) if (cc !== c && test(cc)) return cc;
  return null;
}
/** Step into a ladder's column (just inside its edge); the climb then eases the hero to its middle. */
function intoColumn(b: Body, c: number) { b.x = Math.max(c * T + 1, Math.min(c * T + T - 1, b.x)); }

/** Is there something to stand on right under the feet? */
export function support(env: Env, b: Body): 'solid' | 'oneway' | 'float' | null {
  const y = b.y;
  const [c0, c1] = colsOf(b.x - HERO_W / 2, b.x + HERO_W / 2);
  if (Math.abs(y - Math.round(y)) < 0.01 && Math.round(y) % T === 0) {
    const r = Math.round(y) / T;
    for (let c = c0; c <= c1; c++) if (env.solid(c, r)) return 'solid';
    if (b.dropT <= 0) for (let c = c0; c <= c1; c++) if (env.oneway(c, r)) return 'oneway';
  }
  if (b.dropT <= 0) for (const f of env.floats()) if (Math.abs(f.y - y) < 0.01 && b.x + HERO_W / 2 > f.x0 && b.x - HERO_W / 2 < f.x1) return 'float';
  return null;
}

/** The hook the rope would catch from here, if any: the nearest one above Dora's hands within reach. */
export function hookInReach(env: Env, b: Body): { x: number; y: number } | null {
  if (!env.hooks) return null;
  const hx = b.x, hy = b.y - HERO_H;
  let best: { x: number; y: number } | null = null, bd = ROPE_REACH * ROPE_REACH;
  for (const h of env.hooks()) {
    const dx = h.x - hx, dy = h.y - hy;
    if (dy > -6) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = h; }
  }
  return best;
}

// ─── the guided Bell Rope (the helping hand) ────────────────────────────────

/** The hook that catches itself from here (the helping hand): the nearest above Dora's hands within a generous reach,
 *  never the one just let go of. */
export function hookAssist(env: Env, b: Body): { x: number; y: number } | null {
  if (!env.hooks) return null;
  const hx = b.x, hy = b.y - HERO_H;
  let best: { x: number; y: number } | null = null, bd = ASSIST_REACH * ASSIST_REACH;
  for (const h of env.hooks()) {
    if (h.x === b.skipX && h.y === b.skipY) continue;
    const dx = h.x - hx, dy = h.y - hy;
    if (dy > -6) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = h; }
  }
  return best;
}

/** A guided flight's point at u (0 to 1): eased across, on an arc over the straight line. */
export function flyAt(f: Fly, u: number): { x: number; y: number } {
  const e = u * u * (3 - 2 * u);
  return { x: f.x0 + (f.x1 - f.x0) * e, y: f.y0 + (f.y1 - f.y0) * u - f.arc * 4 * u * (1 - u) };
}
function flyFor(x0: number, y0: number, x1: number, y1: number, kind: 'hook' | 'ledge', hx: number, hy: number): Fly {
  const dx = x1 - x0, dist = Math.hypot(dx, y1 - y0);
  const arc = 18 + Math.abs(dx) * 0.12 + Math.max(0, y0 - y1) * 0.35;
  return { x0, y0, x1, y1, arc, dur: Math.round(Math.max(20, Math.min(56, 16 + dist / 4.5))), t: 0, kind, hx, hy, dir: dx >= 0 ? 1 : -1 };
}
const STAND_CACHE = new WeakMap<Env, Map<string, { x: number; y: number }[]>>();
/** The safe spots to stand on around a hook: a floor or ledge tile with room for a hero over it and no hazard on or by
 *  it. (Worked out once per hook from the terrain; checked again live, since doors and planks change.) */
function standsNear(env: Env, h: { x: number; y: number }) {
  let m = STAND_CACHE.get(env);
  if (!m) STAND_CACHE.set(env, (m = new Map()));
  const key = `${h.x},${h.y}`;
  let out = m.get(key);
  if (out) return out;
  out = [];
  const hc = Math.floor(h.x / T), hr = Math.floor(h.y / T);
  for (let r = hr - Math.ceil(AIM_UP / T) + 3; r <= hr + Math.ceil(AIM_DOWN / T) + 4; r++) for (let c = hc - AIM_DX / T; c <= hc + AIM_DX / T; c++) {
    if (!(env.solid(c, r) || env.oneway(c, r))) continue;
    if (env.hazard(c, r) || env.hazard(c - 1, r) || env.hazard(c + 1, r) || env.hazard(c, r - 1)) continue;
    const x = c * T + 8, y = r * T;
    if (!boxClear(env, x - HERO_W / 2 - 1, y - HERO_H - 2, x + HERO_W / 2 + 1, y)) continue;
    // whole width on the floor
    if (!((env.solid(c - 1, r) || env.oneway(c - 1, r)) || (env.solid(c + 1, r) || env.oneway(c + 1, r)))) continue;
    out.push({ x, y });
  }
  m.set(key, out);
  return out;
}
/** Is a flight's path clear: the body's box fits at every point, and touches no hazard. */
function flyClear(env: Env, f: Fly) {
  const n = Math.max(12, Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 6));
  for (let i = 1; i <= n; i++) {
    const p = flyAt(f, i / n);
    if (!boxClear(env, p.x - HERO_W / 2, p.y - HERO_H, p.x + HERO_W / 2, p.y - 0.5)) return false;
    const [c0, c1] = colsOf(p.x - HERO_W / 2 - 1, p.x + HERO_W / 2 + 1), [r0, r1] = colsOf(p.y - HERO_H - 1, p.y + 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (env.hazard(c, r)) return false;
  }
  return true;
}
/** Where a guided release goes from this swing, going `dir`: the next hook that way, or the nearest safe ledge that way
 *  (a ledge well below the swing counts for much less, so the floor under a rope is the last choice), whichever is nearer; only along a clear path. Null when there is nowhere. */
export function ropeAim(env: Env, b: Body, dir: 1 | -1): RopeAim | null {
  const r = b.rope;
  if (!r || !env.hooks) return null;
  const hang = r.hy + ASSIST_LEN + HERO_H;
  const cands: { score: number; kind: 'hook' | 'ledge'; x: number; y: number; hx: number; hy: number }[] = [];
  for (const h of env.hooks()) {
    const dx = (h.x - r.hx) * dir;
    if (h.x === r.hx && h.y === r.hy) continue;
    if (dx < 24 || dx > AIM_DX || h.y < r.hy - AIM_UP || h.y > r.hy + AIM_DOWN) continue;
    cands.push({ score: dx, kind: 'hook', x: h.x, y: h.y + ASSIST_LEN + HERO_H, hx: h.x, hy: h.y });
  }
  for (const p of standsNear(env, { x: r.hx, y: r.hy })) {
    const dx = (p.x - r.hx) * dir;
    if (dx < 40) continue;
    cands.push({ score: dx + Math.max(0, p.y - hang - 24) * 6, kind: 'ledge', x: p.x, y: p.y, hx: NaN, hy: NaN });
  }
  cands.sort((a, c) => a.score - c.score);
  for (const c of cands) {
    if (c.kind === 'ledge') {
      const t = newBody(c.x, c.y);
      if (!support(env, t) || !boxClear(env, c.x - HERO_W / 2, c.y - HERO_H, c.x + HERO_W / 2, c.y)) continue;
    }
    const f = flyFor(b.x, b.y, c.x, c.y, c.kind, c.hx, c.hy);
    if (!flyClear(env, f)) continue;
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i <= 16; i++) path.push(flyAt(f, i / 16));
    return { kind: c.kind, x: c.x, y: c.y, hx: c.hx, hy: c.hy, path, fly: f };
  }
  return null;
}
/** Start a guided flight (off the rope, or back home). */
function startFly(b: Body, f: Fly) {
  if (b.rope) { b.skipX = b.rope.hx; b.skipY = b.rope.hy; }
  b.rope = null; b.unhooked = true; b.fly = { ...f, t: 0 }; b.face = f.dir;
  b.ground = false; b.climb = false; b.glide = false; b.wall = 0; b.kickT = 0; b.dashT = 0;
}
/** Off the rope by ↓ or a hit (the helping hand): fly back to the ledge she swung from, if the way is clear. */
export function ropeBail(env: Env, b: Body): boolean {
  if (!b.rope || Number.isNaN(b.homeX)) return false;
  const f = flyFor(b.x, b.y, b.homeX, b.homeY, 'ledge', NaN, NaN);
  f.home = true;
  if (!flyClear(env, { ...f, x0: b.x, y0: b.y })) {
    // a straight lift, for a path the arc can't take
    f.arc = 0;
    if (!flyClear(env, f)) return false;
  }
  startFly(b, f);
  return true;
}
/** Catch a hook with the guided rope: a steady swing from where she is, the rope reeling to its resting length. */
function catchAssist(b: Body, h: { x: number; y: number }) {
  const dx = b.x - h.x, dy = b.y - HERO_H - h.y;
  const len = Math.max(ROPE_MIN, Math.hypot(dx, dy)), ang = Math.atan2(dx, dy);
  const amp = Math.min(ROPE_MAX_ANG, Math.max(ASSIST_AMP, Math.abs(ang)));
  const sd: 1 | -1 = (b.vx !== 0 ? Math.sign(b.vx) : b.face) >= 0 ? 1 : -1;
  let ph = Math.asin(Math.max(-1, Math.min(1, ang / amp)));
  if (sd < 0) ph = Math.PI - ph;
  b.rope = { hx: h.x, hy: h.y, len, ang, av: 0, t: 0, ph, amp, sd };
  b.hooked = true; b.glide = false; b.wall = 0; b.kickT = 0; b.fly = null;
}
/** One tick of the guided swing: a steady arc by itself (no pumping, no wind), a jump flies to the aimed target, ↓
 *  goes home. */
function swingAssist(b: Body, inp: BodyInput, env: Env, caps: Caps) {
  const r = b.rope!;
  r.t++;
  if (inp.jumpP && r.t > 3) {
    const aim = ropeAim(env, b, (inp.dir || b.face) as 1 | -1);
    if (aim) { startFly(b, aim.fly); b.jumped = 'rope'; b.jumpBuf = 0; return; }
    b.skipX = r.hx; b.skipY = r.hy; letGo(b, caps, true); b.jumpBuf = 0; return;
  }
  if (inp.down && r.t > 6) {
    if (!ropeBail(env, b)) { b.skipX = r.hx; b.skipY = r.hy; letGo(b, caps, false); }
    return;
  }
  b.gust = 0;
  r.len += (ASSIST_LEN - r.len) * 0.1;
  r.amp! += (ASSIST_AMP - r.amp!) * 0.04;
  const w = Math.sqrt(GRAV / r.len);
  const ph = r.ph! + w;
  const a = r.amp! * Math.sin(ph);
  const nx = r.hx + Math.sin(a) * r.len, ny = r.hy + Math.cos(a) * r.len + HERO_H;
  if (!boxClear(env, nx - HERO_W / 2, ny - HERO_H, nx + HERO_W / 2, ny)) {
    // a wall in the way: the swing turns back there
    r.ph = Math.PI - r.ph!; r.stuck = (r.stuck ?? 0) + 1;
    if (r.stuck > 30 || !boxClear(env, b.x - HERO_W / 2, b.y - HERO_H, b.x + HERO_W / 2, b.y)) { b.skipX = r.hx; b.skipY = r.hy; letGo(b, caps, false); }
    b.vx = 0; b.vy = 0;
    return;
  }
  r.stuck = 0;
  r.av = a - r.ang; r.ph = ph;
  b.vx = nx - b.x; b.vy = ny - b.y;
  b.x = nx; b.y = ny; r.ang = a;
  if (Math.abs(r.av) > 0.004) b.face = r.av > 0 ? 1 : -1;
  if (touchesHazard(env, b)) { b.hazard = true; letGo(b, caps, false); }
}
/** One tick of a guided flight: along its eased arc; it ends on a hook's rope or standing on the ledge. */
function flyStep(b: Body, env: Env) {
  const f = b.fly!;
  f.t++;
  const p = flyAt(f, Math.min(1, f.t / f.dur));
  if (!boxClear(env, p.x - HERO_W / 2, p.y - HERO_H, p.x + HERO_W / 2, p.y - 0.5)) {
    // something moved into the way: fall from here
    b.fly = null; b.vx = Math.max(-3, Math.min(3, b.vx)); b.vy = Math.max(0, b.vy);
    return;
  }
  b.vx = p.x - b.x; b.vy = p.y - b.y; b.x = p.x; b.y = p.y; b.face = f.dir;
  if (touchesHazard(env, b)) { b.hazard = true; b.fly = null; return; }
  if (f.t < f.dur) return;
  b.fly = null;
  if (f.kind === 'hook') { catchAssist(b, { x: f.hx, y: f.hy }); b.rope!.sd = f.dir; b.rope!.ph = 0; return; }
  b.x = f.x1; b.y = f.y1; b.vx = 0; b.vy = 0;
  if (support(env, b)) { b.ground = true; b.landed = true; b.skipX = NaN; b.skipY = NaN; b.homeX = b.x; b.homeY = b.y; }
}

/** Let go of the rope: a jump kicks off it, carrying the swing's speed. */
function letGo(b: Body, caps: Caps, kick: boolean) {
  b.rope = null; b.unhooked = true;
  if (kick) { b.vy = Math.min(b.vy, 0) - ROPE_KICK; b.jumped = 'rope'; }
  b.vx = Math.max(-5, Math.min(5, b.vx * 1.1));
  b.airJumps = caps.double ? 1 : 0; b.airDash = true;
}

/** One tick on the rope: a pendulum about the hook, pumped by steering and pushed by the wind. */
function swing(b: Body, inp: BodyInput, env: Env, caps: Caps) {
  const r = b.rope!;
  r.t++;
  if (inp.jumpP && r.t > 2) { letGo(b, caps, true); b.jumpBuf = 0; return; }
  if (inp.down && r.t > 6) { letGo(b, caps, false); return; }
  const w = env.wind?.(b.x, b.y - HERO_H / 2) ?? 0;
  b.gust = w;
  r.av += -(GRAV / r.len) * Math.sin(r.ang) + inp.dir * ROPE_PUMP + w * (caps.windMul ?? 1) * 0.0009;
  r.av *= 0.996;
  let a = r.ang + r.av;
  if (Math.abs(a) > ROPE_MAX_ANG) { a = Math.sign(a) * ROPE_MAX_ANG; r.av = 0; }
  const nx = r.hx + Math.sin(a) * r.len, ny = r.hy + Math.cos(a) * r.len + HERO_H;
  if (!boxClear(env, nx - HERO_W / 2, ny - HERO_H, nx + HERO_W / 2, ny)) {
    // swung into a wall: the swing stops dead there (and slides off if it can't hang)
    r.av = -r.av * 0.2;
    if (!boxClear(env, b.x - HERO_W / 2, b.y - HERO_H, b.x + HERO_W / 2, b.y)) letGo(b, caps, false);
    b.vx = 0; b.vy = 0;
    return;
  }
  b.vx = nx - b.x; b.vy = ny - b.y;
  b.x = nx; b.y = ny; r.ang = a;
  if (Math.abs(r.av) > 0.004) b.face = r.av > 0 ? 1 : -1;
  if (touchesHazard(env, b)) { b.hazard = true; letGo(b, caps, false); }
}

/** Move one tick. Returns nothing; the result flags are on the body. */
export function stepBody(b: Body, inp: BodyInput, env: Env, caps: Caps) {
  b.landed = false; b.jumped = ''; b.hazard = false; b.bonk = false; b.dashed = false; b.hooked = false; b.unhooked = false; b.gust = 0;
  if (caps.ropeAssist) {
    // the guided rope: a flight runs on its own; in the air by a hook, the rope catches itself (or with X)
    if (b.fly) { flyStep(b, env); if (b.fly || b.rope || b.ground) { b.coyote = 0; return; } }
    if (!b.rope && caps.rope && !b.ground && !b.climb && !b.swim && b.dashT <= 0 && !support(env, b)) {
      const h = hookAssist(env, b) ?? (inp.ropeP ? hookInReach(env, b) : null);
      if (h) catchAssist(b, h);
    }
    if (b.rope) { if (b.dashCd > 0) b.dashCd--; swingAssist(b, inp, env, caps); b.ground = false; b.coyote = 0; return; }
  }
  // the Bell Rope: catch a hook in the air, then swing until a jump (or ↓) lets go
  if (!b.rope && inp.ropeP && caps.rope && !b.ground && !b.climb && !b.swim && b.dashT <= 0) {
    const h = hookInReach(env, b);
    if (h) {
      const dx = b.x - h.x, dy = b.y - HERO_H - h.y;
      const len = Math.max(ROPE_MIN, Math.min(ROPE_MAX, Math.hypot(dx, dy)));
      const ang = Math.atan2(dx, dy);
      b.rope = { hx: h.x, hy: h.y, len, ang, av: (b.vx * Math.cos(ang) - b.vy * Math.sin(ang)) / len, t: 0 };
      b.hooked = true; b.glide = false; b.wall = 0; b.kickT = 0;
    }
  }
  if (b.rope) {
    if (b.dashCd > 0) b.dashCd--;
    swing(b, inp, env, caps);
    b.ground = false; b.coyote = 0;
    return;
  }
  if (b.dashCd > 0) b.dashCd--;
  if (b.dropT > 0) b.dropT--;
  if (b.kickT > 0) b.kickT--;
  const dir = b.kickT > 0 ? b.kickDir : inp.dir;
  if (inp.dir !== 0 && b.dashT <= 0 && b.kickT <= 0) b.face = inp.dir;

  // water
  const surf = env.surface(b.x, b.y);
  b.swim = surf !== null && b.y - HERO_H / 2 > surf;
  b.wade = surf !== null && !b.swim && b.y > surf + 2;
  if (b.swim) { b.climb = b.climb && onLadder(env, b); b.glide = false; b.airDash = true; if (b.dashT > 0) b.dashT = Math.min(b.dashT, 4); }

  // ladders
  let ladderHere = onLadder(env, b);
  if (!b.climb && (inp.up || (inp.down && !b.ground)) && b.dashT <= 0) {
    // ↑ (or ↓ in the air) grabs a ladder here or just beside, on the ground or in mid-jump
    const c = ladderNear(env, b, (cc) => onLadder(env, b, cc));
    if (c !== null) { intoColumn(b, c); b.climb = true; ladderHere = true; }
  }
  if (!b.climb && b.ground && inp.down && b.onOneway) {
    // standing on a ladder top: climb down into it
    const r = Math.round(b.y / T), c = ladderNear(env, b, (cc) => env.ladder(cc, r));
    if (c !== null) { intoColumn(b, c); b.climb = true; b.y += 2; b.ground = false; ladderHere = true; }
  }
  if (b.climb) {
    if (!ladderHere) b.climb = false;
    else {
      b.x += (Math.floor(b.x / T) * T + T / 2 - b.x) * 0.35;
      b.vx = 0; b.vy = (inp.down ? CLIMB_V : 0) - (inp.up ? CLIMB_V : 0);
      b.airJumps = caps.double ? 1 : 0; b.airDash = true; b.glide = false;
      if (inp.jumpP) {
        b.climb = false; b.vy = -JUMP_V * 0.85; b.vx = inp.dir * caps.speed; b.jumped = 'ladder'; b.jumpBuf = 0;
      } else if (inp.dir !== 0 && !inp.up && !inp.down) {
        b.climb = false; b.vx = inp.dir * caps.speed * 0.6;
      }
    }
  }
  if (b.climb) {
    moveY(b, env, true);
    b.ground = false; b.coyote = 0;
    // climbing up to a ladder's top rung steps out onto it, instead of slipping off the
    // ladder a few pixels short of the ledge and falling back through it
    if (inp.up && !inp.down) {
      const c = Math.floor(b.x / T), r = Math.floor((b.y - 0.001) / T);
      if (env.ladder(c, r) && env.oneway(c, r) && b.y - r * T <= 6) {
        b.y = r * T; b.vy = 0; b.climb = false; b.ground = true; b.onOneway = true; b.landed = true;
        return;
      }
    }
    if (support(env, b) === 'solid') { b.climb = false; b.ground = true; }
    if (touchesHazard(env, b)) b.hazard = true;
    return;
  }

  // dash
  if (inp.dashP && caps.dash && b.dashCd <= 0 && b.dashT <= 0 && (b.ground || b.airDash || b.swim)) {
    b.dashT = DASH_T; b.dashCd = DASH_CD; b.dashDir = inp.dir !== 0 ? inp.dir : b.face; b.face = b.dashDir; b.dashed = true;
    if (!b.ground) b.airDash = false;
    b.glide = false;
  }

  // jump timers
  b.jumpBuf = inp.jumpP ? caps.buffer : Math.max(0, b.jumpBuf - 1);
  b.coyote = b.ground ? caps.coyote : Math.max(0, b.coyote - 1);

  // horizontal
  const swimSpeed = SWIM_SPEED * caps.swimMul;
  if (b.dashT > 0) {
    b.dashT--;
    b.vx = b.dashDir * (b.swim ? DASH_V * 0.6 : DASH_V);
    b.vy = b.swim ? b.vy * 0.5 : 0;
  } else {
    const top = b.swim ? swimSpeed : b.wade ? caps.speed * 0.78 : caps.speed;
    const w = b.swim ? 0 : (env.wind?.(b.x, b.y - HERO_H / 2) ?? 0) * (caps.windMul ?? 1);
    b.gust = w;
    const target = dir * top + (b.ground ? (dir !== 0 ? w * WIND_RUN : 0) : w * WIND_AIR);
    const acc = b.swim ? 0.18 : b.ground ? 0.5 : 0.36;
    if (Math.abs(b.vx) > Math.abs(target) && Math.abs(b.vx) > top && Math.sign(b.vx) === Math.sign(target) && !b.ground) b.vx -= Math.sign(b.vx) * 0.08;
    else if (b.vx < target) b.vx = Math.min(target, b.vx + acc);
    else if (b.vx > target) b.vx = Math.max(target, b.vx - acc);
  }

  // jumping
  if (b.jumpBuf > 0 && b.dashT <= 0) {
    if (b.ground && inp.down && b.onOneway) {
      b.dropT = 12; b.ground = false; b.jumpBuf = 0; b.coyote = 0; b.y += 1;
    } else if (b.swim) {
      const nearTop = surf !== null && b.y - HERO_H < surf + 6;
      b.vy = nearTop ? -SWIM_EXIT_V : -SWIM_STROKE; b.jumped = 'swim'; b.jumpBuf = 0;
    } else if (b.coyote > 0) {
      b.vy = -JUMP_V; b.coyote = 0; b.jumpBuf = 0; b.ground = false; b.jumped = 'ground';
    } else if (b.wall !== 0 && caps.wallkick) {
      b.vy = -KICK_VY; b.vx = -b.wall * KICK_VX; b.kickDir = (-b.wall) as 1 | -1; b.kickT = KICK_LOCK; b.face = b.kickDir;
      b.wall = 0; b.jumpBuf = 0; b.jumped = 'wall'; b.airDash = true;
    } else if (b.airJumps > 0) {
      b.vy = -AIR_JUMP_V; b.airJumps--; b.jumpBuf = 0; b.jumped = 'air';
    }
  }
  // a dash can be cut into a jump on the ground
  if (b.dashT > 0 && inp.jumpP && b.ground) {
    b.dashT = 0; b.vy = -JUMP_V; b.ground = false; b.coyote = 0; b.jumpBuf = 0; b.jumped = 'ground'; b.vx = b.dashDir * Math.max(caps.speed, 3.2);
  }
  if (!inp.jumpH && b.vy < -JUMP_CUT && !b.swim && b.jumped !== 'wall' && b.kickT <= 0) b.vy = -JUMP_CUT;

  // gravity
  b.glide = false;
  if (b.dashT > 0 && !b.swim) {
    // dashes fly straight
  } else if (b.swim) {
    b.vy += inp.down ? 0.16 : inp.up ? -0.16 : 0.08;
    b.vy = Math.max(-SWIM_EXIT_V, Math.min(SWIM_SINK + (inp.down ? 0.6 : 0), b.vy));
    if (b.vy < -SWIM_STROKE && !(surf !== null && b.y - HERO_H < surf + 8)) b.vy = Math.max(b.vy, -SWIM_STROKE);
    const deep = env.deep(b.x, b.y);
    if (deep !== null && !caps.deep && b.y - HERO_H / 2 > deep) b.vy = Math.min(b.vy, -1.5);
  } else {
    b.vy += GRAV;
    // a gust lifts the Lantern Glide: once the jump has slowed, the glide rises with it
    if (b.gust !== 0 && caps.glide && inp.jumpH && !b.ground && b.vy > -WIND_LIFT - 0.05 - GRAV) { b.vy = Math.max(-WIND_LIFT, Math.min(b.vy, GLIDE_FALL) - 0.5); b.glide = true; }
    else if (caps.glide && inp.jumpH && b.vy > 0 && !b.ground) { b.vy = Math.min(b.vy, GLIDE_FALL); b.glide = true; }
    else if (b.wall !== 0 && caps.wallkick && inp.dir === b.wall && b.vy > 0) b.vy = Math.min(b.vy, WALL_SLIDE);
    b.vy = Math.min(b.vy, MAX_FALL);
  }

  const wasGround = b.ground;
  moveX(b, env);
  moveY(b, env, false);
  const sup = b.vy >= 0 ? support(env, b) : null;
  b.ground = sup !== null;
  b.onOneway = sup === 'oneway' || sup === 'float';
  if (b.ground) {
    if (!wasGround) b.landed = true;
    b.vy = 0; b.airJumps = caps.double ? 1 : 0; b.airDash = true; b.kickT = 0;
    if (caps.ropeAssist) { b.homeX = b.x; b.homeY = b.y; b.skipX = NaN; b.skipY = NaN; }
  }

  // walls (for sliding and kicking)
  b.wall = 0;
  if (!b.ground && !b.swim && caps.wallkick) {
    if (!boxClear(env, b.x + HERO_W / 2, b.y - HERO_H + 4, b.x + HERO_W / 2 + 2, b.y - 4)) b.wall = 1;
    else if (!boxClear(env, b.x - HERO_W / 2 - 2, b.y - HERO_H + 4, b.x - HERO_W / 2, b.y - 4)) b.wall = -1;
    if (b.wall !== 0) { b.airJumps = caps.double ? 1 : 0; b.airDash = true; }
  }
  if (touchesHazard(env, b)) b.hazard = true;
}

function moveX(b: Body, env: Env) {
  if (b.vx === 0) return;
  const nx = b.x + b.vx;
  const top = b.y - HERO_H, bot = b.y;
  if (b.vx > 0) {
    const edge = nx + HERO_W / 2;
    const [r0, r1] = colsOf(top, bot);
    const c = Math.floor((edge - 0.001) / T);
    for (let r = r0; r <= r1; r++) if (env.solid(c, r)) { b.x = c * T - HERO_W / 2; b.vx = 0; return; }
  } else {
    const edge = nx - HERO_W / 2;
    const [r0, r1] = colsOf(top, bot);
    const c = Math.floor(edge / T);
    for (let r = r0; r <= r1; r++) if (env.solid(c, r)) { b.x = (c + 1) * T + HERO_W / 2; b.vx = 0; return; }
  }
  b.x = nx;
}

function moveY(b: Body, env: Env, climbing: boolean) {
  if (b.vy === 0) return;
  const ny = b.y + b.vy;
  const [c0, c1] = colsOf(b.x - HERO_W / 2, b.x + HERO_W / 2);
  if (b.vy > 0) {
    const r0 = Math.floor(b.y / T), r1 = Math.floor((ny - 0.001) / T);
    for (let r = r0; r <= r1; r++) {
      const top = r * T;
      if (top < b.y - 0.001) continue;
      for (let c = c0; c <= c1; c++) {
        if (env.solid(c, r) || (!climbing && b.dropT <= 0 && env.oneway(c, r) && b.y <= top + 0.001)) { b.y = top; b.vy = 0; return; }
      }
    }
    if (!climbing && b.dropT <= 0) {
      for (const f of env.floats()) {
        if (b.x + HERO_W / 2 > f.x0 && b.x - HERO_W / 2 < f.x1 && b.y <= f.y + 0.001 && ny >= f.y) { b.y = f.y; b.vy = 0; return; }
      }
    }
    b.y = ny;
  } else {
    const head = ny - HERO_H;
    const r = Math.floor(head / T);
    for (let c = c0; c <= c1; c++) if (env.solid(c, r)) { b.y = (r + 1) * T + HERO_H; b.vy = 0; b.bonk = true; return; }
    b.y = ny;
  }
}

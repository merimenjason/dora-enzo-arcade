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
}

export type Caps = {
  speed: number; dash: boolean; double: boolean; wallkick: boolean; glide: boolean; deep: boolean; swimMul: number;
  coyote: number; buffer: number;
};

export type Body = {
  x: number; y: number; vx: number; vy: number;
  ground: boolean; onOneway: boolean; coyote: number; jumpBuf: number; airJumps: number; airDash: boolean;
  dashT: number; dashCd: number; dashDir: 1 | -1; kickT: number; kickDir: 1 | -1; dropT: number;
  climb: boolean; swim: boolean; wade: boolean; glide: boolean; wall: -1 | 0 | 1; face: 1 | -1;
  /** set by `stepBody`: what happened this tick */
  landed: boolean; jumped: '' | 'ground' | 'air' | 'wall' | 'swim' | 'ladder'; hazard: boolean; bonk: boolean; dashed: boolean;
};

export type BodyInput = { dir: -1 | 0 | 1; up: boolean; down: boolean; jumpP: boolean; jumpH: boolean; dashP: boolean };

export function newBody(x: number, y: number): Body {
  return {
    x, y, vx: 0, vy: 0, ground: false, onOneway: false, coyote: 0, jumpBuf: 0, airJumps: 0, airDash: true, dashT: 0, dashCd: 0, dashDir: 1,
    kickT: 0, kickDir: 1, dropT: 0, climb: false, swim: false, wade: false, glide: false, wall: 0, face: 1,
    landed: false, jumped: '', hazard: false, bonk: false, dashed: false,
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

/** Move one tick. Returns nothing; the result flags are on the body. */
export function stepBody(b: Body, inp: BodyInput, env: Env, caps: Caps) {
  b.landed = false; b.jumped = ''; b.hazard = false; b.bonk = false; b.dashed = false;
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
    const target = dir * top;
    const acc = b.swim ? 0.18 : b.ground ? 0.5 : 0.36;
    if (Math.abs(b.vx) > top && Math.sign(b.vx) === Math.sign(target) && !b.ground) b.vx -= Math.sign(b.vx) * 0.08;
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
    if (caps.glide && inp.jumpH && b.vy > 0 && !b.ground) { b.vy = Math.min(b.vy, GLIDE_FALL); b.glide = true; }
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

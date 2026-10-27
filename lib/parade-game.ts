// Kit Parade's rules: a line of baby chinchilla kits pops out of a burrow and marches on, and Dora and Enzo hand out jobs
// so the kits find their way to the home burrow. The world is a fine pixel mask on a fixed step, so the same jobs on the
// same ticks always play out the same way. No DOM here: the scene draws it and the page wires it up.
import { LEVELS, WORLDS, type LevelDef } from './parade-levels.js';
export { LEVELS, WORLDS, type LevelDef };

export const SAVE_KEY = 'kit-parade-v1';
/** Simulation ticks per second. */
export const TPS = 25;
/** Pixels per map character. */
export const TILE = 8;
/** A kit's height in world pixels; walls and ceilings are measured against it. */
export const KIT_H = 10;
/** The highest step a walking kit hops up; anything taller is a wall. */
export const STEP = 5;
/** The deepest step a walking kit hops down without falling. */
export const DROP = 4;
/** Falls longer than this leave a kit dizzy (Mum carries it home). */
export const SAFE_FALL = 56;
export const FALL_SPEED = 3;
/** A glider opens its tail after this much falling and drifts down one pixel a tick. */
export const GLIDE_OPEN = 12;
export const DIG_EVERY = 2;
export const TUNNEL_EVERY = 2;
export const BUILD_EVERY = 8;
export const BALES = 12;
export const CLIMB_EVERY = 2;
export const PUFF_TICKS = 12;
export const HUG_TICKS = 30;
export const HUG_R = 13;
export const DIZZY_TICKS = 40;
export const SPLASH_TICKS = 30;
export const SHRUG_TICKS = 12;
/** How long a kit takes to wave and pop inside the home burrow (drawing only; it counts as home at once). */
export const HOME_TICKS = 12;
export const BELT_EVERY = 1;
/** A bounce: launch speeds (pixels a tick) and the pull back down. */
export const BOUNCE = { up: 5, side: 1.5, gravity: 0.25 };
/** How much a stopper weighs on a seesaw, against one for any other kit. */
export const STOPPER_WEIGHT = 3;

export const JOBS = ['stopper', 'digger', 'tunneller', 'builder', 'climber', 'glider', 'bouncer', 'hugger'] as const;
export type Job = (typeof JOBS)[number];
export const JOB_INFO: Record<Job, { name: string; icon: string; key: string; tip: string }> = {
  stopper: { name: 'Stopper', icon: '✋', key: '1', tip: 'Stands with paws out and turns the others around.' },
  digger: { name: 'Digger', icon: '🕳️', key: '2', tip: 'Digs straight down through soft earth.' },
  tunneller: { name: 'Tunneller', icon: '⛏️', key: '3', tip: 'Digs a tunnel sideways.' },
  builder: { name: 'Builder', icon: '🌾', key: '4', tip: `Lays a stair of ${BALES} hay bales upward.` },
  climber: { name: 'Climber', icon: '🧗', key: '5', tip: 'Climbs straight up walls. Stays a climber.' },
  glider: { name: 'Glider', icon: '🪂', key: '6', tip: 'Floats down any drop on a fluffy tail. Stays a glider.' },
  bouncer: { name: 'Bouncer', icon: '☁️', key: '7', tip: 'Fluffs up a springy dust puff. Wheee!' },
  hugger: { name: 'Hugger', icon: '🤗', key: '8', tip: 'A big group hug that clears a little patch of earth.' },
};

// map materials
export const EMPTY = 0, EARTH = 1, HAY_L = 2, HAY_R = 3, STONE = 4, BELT_L = 5, BELT_R = 6, BALE = 7;
export const diggable = (m: number) => m === EARTH || m === HAY_L || m === HAY_R || m === BALE;

export type KitState = 'fall' | 'walk' | 'stop' | 'dig' | 'tunnel' | 'build' | 'shrug' | 'climb' | 'glide' | 'float' | 'bounce' | 'puff' | 'hug' | 'dizzy' | 'splash' | 'home' | 'carried';
export type Kit = {
  i: number; x: number; y: number; px: number; py: number; dir: 1 | -1; state: KitState;
  /** ticks in the current state */ t: number; fall: number; climber: boolean; glider: boolean; bales: number;
  vx: number; vy: number; top: number; steps: number; dug: boolean;
};
export type Action = { t: number; k: number; job: Job };
export type ParadeEvent = { kind: 'spawn' | 'home' | 'dizzy' | 'carried' | 'splash' | 'assign' | 'bounce' | 'glide' | 'dig' | 'bale' | 'hug' | 'shrug' | 'climbed' | 'land' | 'puff' | 'turn' | 'done'; x: number; y: number; kit: number; job?: Job };
export type Puff = { x: number; y: number };
export type Pad = { x: number; y: number; w: number; min: number; max: number; every: number; dir: 1 | -1 };
export type Seesaw = { cx: number; cy: number; half: number; amp: number; off: number; target: number };
export type Fan = { x: number; y: number; w: number; h: number };

const ACTIVE_DONE = new Set<KitState>(['home', 'carried']);
const GROUNDED = new Set<KitState>(['walk', 'dig', 'tunnel', 'build', 'shrug', 'puff']);

/** Expands one map row: a number before a character repeats it, so `12#` is twelve earth tiles. */
export function expandRow(row: string): string {
  let out = '', n = '';
  for (const ch of row) {
    if (ch >= '0' && ch <= '9') { n += ch; continue; }
    out += n ? ch.repeat(Number(n)) : ch; n = '';
  }
  return out;
}

export function levelIndex(idOrIndex: string | number) {
  return typeof idOrIndex === 'number' ? idOrIndex : LEVELS.findIndex((l) => l.id === idOrIndex);
}

export class ParadeGame {
  readonly level: LevelDef;
  readonly index: number;
  readonly W: number; readonly H: number; readonly tw: number; readonly th: number;
  readonly mask: Uint8Array;
  readonly water: Uint8Array;
  tick = 0;
  kits: Kit[] = [];
  saved = 0; lost = 0; used = 0; lastHome = 0;
  left: Record<Job, number>;
  state: 'play' | 'done' = 'play';
  reason: 'all' | 'time' | 'finish' | '' = '';
  entrance = { x: 0, y: 0 }; exit = { x: 0, y: 0 };
  puffs: Puff[] = []; pads: Pad[] = []; seesaws: Seesaw[] = []; fans: Fan[] = [];
  events: ParadeEvent[] = [];
  log: Action[] = [];
  /** Bumped whenever the terrain changes, so the scene knows to repaint it. */
  terrainVersion = 0;
  private nextSpawn = 25;

  constructor(level: LevelDef | number | string) {
    const i = typeof level === 'object' ? LEVELS.indexOf(level) : levelIndex(level);
    this.level = typeof level === 'object' ? level : LEVELS[i];
    if (!this.level) throw new Error('no such level');
    this.index = i;
    const rows = this.level.map.map(expandRow), L = this.level;
    this.tw = Math.max(...rows.map((r) => r.length)); this.th = rows.length;
    this.W = this.tw * TILE; this.H = this.th * TILE;
    this.mask = new Uint8Array(this.W * this.H); this.water = new Uint8Array(this.tw * this.th);
    rows.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        const fill = (m: number, keep: (px: number, py: number) => boolean = () => true) => {
          for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) if (keep(px, py)) this.mask[(ty * TILE + py) * this.W + tx * TILE + px] = m;
        };
        if (ch === '#') fill(EARTH); else if (ch === '=') fill(STONE); else if (ch === '<') fill(HAY_L); else if (ch === '>') fill(HAY_R);
        else if (ch === '{') fill(BELT_L); else if (ch === '}') fill(BELT_R); else if (ch === 'b') fill(BALE);
        else if (ch === '/') fill(EARTH, (px, py) => py >= TILE - 1 - px);
        else if (ch === '\\') fill(EARTH, (px, py) => py >= px);
        else if (ch === '_') fill(EARTH, (_, py) => py >= TILE / 2);
        else if (ch === '-') fill(STONE, (_, py) => py >= TILE / 2);
        else if (ch === '~') this.water[ty * this.tw + tx] = 1;
        else if (ch === 'E') this.entrance = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE };
        else if (ch === 'X') this.exit = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE };
      }
    });
    for (const p of L.pads ?? []) this.pads.push({ x: p.x * TILE, y: p.y * TILE, w: p.w * TILE, min: p.min * TILE, max: p.max * TILE, every: p.every ?? 3, dir: 1 });
    for (const s of L.seesaws ?? []) { const off = (s.tilt ?? 1) * (s.amp ?? 12); this.seesaws.push({ cx: s.x * TILE, cy: s.y * TILE, half: s.half * TILE, amp: s.amp ?? 12, off, target: off }); }
    for (const f of L.fans ?? []) this.fans.push({ x: f.x * TILE, y: f.y * TILE, w: f.w * TILE, h: f.h * TILE });
    this.left = Object.fromEntries(JOBS.map((j) => [j, L.jobs[j] ?? 0])) as Record<Job, number>;
  }

  // ---- the world
  mat(x: number, y: number) {
    if (x < 0 || x >= this.W) return STONE;
    if (y < 0 || y >= this.H) return EMPTY;
    return this.mask[y * this.W + x];
  }
  solid(x: number, y: number): boolean {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= this.W) return true;
    if (y < 0 || y >= this.H) return false;
    if (this.mask[y * this.W + x]) return true;
    for (const p of this.pads) if (x >= p.x && x < p.x + p.w && y >= p.y && y <= p.y + 2) return true;
    for (const s of this.seesaws) if (x >= s.cx - s.half && x <= s.cx + s.half) { const sy = this.seesawY(s, x); if (y >= sy && y <= sy + 2) return true; }
    return false;
  }
  seesawY(s: Seesaw, x: number) { return s.cy + Math.round((s.off * (x - s.cx)) / s.half); }
  inWater(x: number, y: number) {
    const tx = Math.floor(x / TILE), ty = Math.floor((y - 2) / TILE);
    return tx >= 0 && tx < this.tw && ty >= 0 && ty < this.th && this.water[ty * this.tw + tx] === 1;
  }
  fanAt(x: number, y: number) { return this.fans.find((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) ?? null; }
  puffAt(x: number, y: number) { return this.puffs.find((p) => Math.abs(x - p.x) <= 5 && Math.abs(y - p.y) <= 2) ?? null; }
  private clear(x: number, y: number, oneWayDir = 0) {
    if (x < 0 || x >= this.W || y < 0 || y >= this.H) return false;
    const m = this.mask[y * this.W + x];
    if (!diggable(m)) return false;
    if (oneWayDir && ((m === HAY_L && oneWayDir > 0) || (m === HAY_R && oneWayDir < 0))) return false;
    this.mask[y * this.W + x] = EMPTY; return true;
  }

  // ---- jobs
  /** Whether this kit can take this job right now (and there is one left to give). */
  canTake(k: Kit | undefined, job: Job): boolean {
    if (!k || this.state !== 'play' || this.left[job] <= 0) return false;
    const s = k.state;
    if (ACTIVE_DONE.has(s) || s === 'dizzy' || s === 'splash') return false;
    if (job === 'climber') return !k.climber;
    if (job === 'glider') return !k.glider;
    if (job === 'hugger') return s !== 'hug' && s !== 'fall' && s !== 'glide' && s !== 'float' && s !== 'bounce' && s !== 'climb';
    // a Stopper is set free by any job that keeps it busy on the ground
    if (s === 'stop') return job !== 'stopper';
    if (!GROUNDED.has(s)) return false;
    const now: Partial<Record<Job, KitState>> = { stopper: 'stop', digger: 'dig', tunneller: 'tunnel', builder: 'build', bouncer: 'puff' };
    return now[job] !== s;
  }
  assign(index: number, job: Job): boolean {
    const k = this.kits[index];
    if (!this.canTake(k, job)) return false;
    this.left[job]--; this.used++;
    this.log.push({ t: this.tick, k: index, job });
    if (job === 'climber') k.climber = true;
    else if (job === 'glider') k.glider = true;
    else {
      k.t = 0; k.dug = false;
      k.state = job === 'stopper' ? 'stop' : job === 'digger' ? 'dig' : job === 'tunneller' ? 'tunnel' : job === 'builder' ? 'build' : job === 'bouncer' ? 'puff' : 'hug';
      if (job === 'builder') k.bales = BALES;
    }
    this.emit('assign', k, job);
    return true;
  }
  /** The kit nearest a point (in world pixels) within `r`, preferring kits that can take `job`. */
  kitAt(x: number, y: number, job?: Job, r = 12): number {
    let best = -1, bestD = Infinity;
    for (const k of this.kits) {
      if (ACTIVE_DONE.has(k.state)) continue;
      const d = Math.hypot(k.x - x, k.y - KIT_H / 2 - y) - (job && this.canTake(k, job) ? 6 : 0);
      if (d < bestD && Math.hypot(k.x - x, k.y - KIT_H / 2 - y) <= r) { bestD = d; best = k.i; }
    }
    return best;
  }

  // ---- the clock
  step() {
    if (this.state !== 'play') return;
    this.tick++;
    const L = this.level;
    if (this.kits.length < L.kits && this.tick >= this.nextSpawn) {
      const e = this.entrance;
      this.kits.push({ i: this.kits.length, x: e.x, y: e.y, px: e.x, py: e.y, dir: L.dir ?? 1, state: 'fall', t: 0, fall: 0, climber: false, glider: false, bales: 0, vx: 0, vy: 0, top: e.y, steps: 0, dug: false });
      this.nextSpawn = this.tick + L.rate;
      this.emit('spawn', this.kits[this.kits.length - 1]);
    }
    this.moveThings();
    for (const k of this.kits) {
      k.px = k.x; k.py = k.y;
      if (ACTIVE_DONE.has(k.state)) { k.t++; continue; }
      k.t++;
      this.update(k);
      if (!ACTIVE_DONE.has(k.state) && k.y > this.H + 16) this.carry(k);
    }
    // belts carry anyone strolling on them
    if (this.tick % BELT_EVERY === 0) for (const k of this.kits) if (k.state === 'walk' || k.state === 'shrug') {
      const m = this.mat(k.x, k.y);
      if (m !== BELT_L && m !== BELT_R) continue;
      const way = m === BELT_L ? -1 : 1;
      // a belt spins anyone walking against it round to face its way
      if (k.state === 'walk' && k.dir !== way) { k.dir = way; this.emit('turn', k); }
      this.nudge(k, way);
    }
    this.puffs = this.puffs.filter((p) => this.solid(p.x, p.y));
    const all = this.kits.length >= L.kits && this.kits.every((k) => ACTIVE_DONE.has(k.state) || k.state === 'stop');
    if (all) this.finish('all');
    else if (this.tick >= L.time * TPS) this.finish('time');
  }
  /** Ends the level now: anyone still out is carried home by Mum. */
  finish(reason: 'all' | 'time' | 'finish' = 'finish') {
    if (this.state !== 'play') return;
    this.state = 'done'; this.reason = reason;
    this.events.push({ kind: 'done', x: this.exit.x, y: this.exit.y, kit: -1 });
  }
  run(ticks: number) { for (let i = 0; i < ticks && this.state === 'play'; i++) this.step(); }

  private emit(kind: ParadeEvent['kind'], k: Kit, job?: Job) { this.events.push({ kind, x: k.x, y: k.y, kit: k.i, job }); if (this.events.length > 400) this.events.splice(0, 200); }
  private carry(k: Kit) { k.state = 'carried'; k.t = 0; this.lost++; this.emit('carried', k); }
  private turn(k: Kit) { k.dir = (k.dir === 1 ? -1 : 1); }

  private moveThings() {
    for (const p of this.pads) {
      if (this.tick % p.every) continue;
      if (p.x + p.dir < p.min || p.x + p.dir > p.max) p.dir = (p.dir === 1 ? -1 : 1);
      const riders = this.kits.filter((k) => GROUNDED.has(k.state) || k.state === 'stop' ? k.y === p.y && k.x >= p.x && k.x < p.x + p.w && !this.mask[k.y * this.W + k.x] : false);
      p.x += p.dir;
      for (const k of riders) this.nudge(k, p.dir);
    }
    for (const s of this.seesaws) {
      // it tips toward the heavier side, weighing each kit by how far out it stands
      let wl = 0, wr = 0;
      const riders = this.kits.filter((k) => (GROUNDED.has(k.state) || k.state === 'stop' || k.state === 'hug') && k.x >= s.cx - s.half && k.x <= s.cx + s.half && k.y === this.seesawY(s, k.x) && !this.mask[k.y * this.W + k.x]);
      for (const k of riders) { const w = (k.state === 'stop' ? STOPPER_WEIGHT : 1) * (k.x - s.cx); if (w < 0) wl -= w; else wr += w; }
      if (wl > wr) s.target = -s.amp; else if (wr > wl) s.target = s.amp;
      if (s.off !== s.target) {
        s.off += Math.sign(s.target - s.off);
        for (const k of riders) k.y = this.seesawY(s, k.x);
      }
    }
  }
  /** Slides a kit one pixel sideways (a belt or a lily pad), unless a wall is in the way. */
  private nudge(k: Kit, dir: number) {
    const nx = k.x + dir;
    let h = 0; while (h <= STEP && this.solid(nx, k.y - 1 - h)) h++;
    if (h > STEP) return;
    k.x = nx; k.y -= h;
    if (k.state === 'walk') this.arrive(k);
  }

  private update(k: Kit) {
    switch (k.state) {
      case 'walk': return this.walk(k);
      case 'fall': return this.fall(k);
      case 'glide': return this.fall(k);
      case 'float': return this.float(k);
      case 'bounce': return this.bounce(k);
      case 'stop': if (!this.solid(k.x, k.y)) this.drop(k); return;
      case 'shrug': if (!this.solid(k.x, k.y)) this.drop(k); else if (k.t >= SHRUG_TICKS) k.state = 'walk'; return;
      case 'dig': return this.dig(k);
      case 'tunnel': return this.tunnel(k);
      case 'build': return this.build(k);
      case 'climb': return this.climb(k);
      case 'puff':
        if (!this.solid(k.x, k.y)) return this.drop(k);
        if (k.t >= PUFF_TICKS) { this.puffs.push({ x: k.x, y: k.y }); this.emit('puff', k); k.state = 'walk'; k.t = 0; }
        return;
      case 'hug':
        if (!this.solid(k.x, k.y)) return this.drop(k);
        if (k.t >= HUG_TICKS) {
          for (let dy = -HUG_R; dy <= HUG_R; dy++) for (let dx = -HUG_R; dx <= HUG_R; dx++) if (dx * dx + dy * dy <= HUG_R * HUG_R) this.clear(k.x + dx, k.y - 5 + dy);
          this.terrainVersion++; this.emit('hug', k); k.state = 'walk'; k.t = 0;
        }
        return;
      case 'dizzy': if (k.t >= DIZZY_TICKS) this.carry(k); return;
      case 'splash': if (k.t >= SPLASH_TICKS) this.carry(k); return;
    }
  }
  private drop(k: Kit) { k.state = 'fall'; k.fall = 0; k.t = 0; }

  private walk(k: Kit) {
    const nx = k.x + k.dir;
    for (const s of this.kits) if (s.state === 'stop' && s !== k && (s.x - k.x) * k.dir > 0 && Math.abs(nx - s.x) <= 4 && Math.abs(s.y - k.y) <= 8) { this.turn(k); this.emit('turn', k); return; }
    let h = 0; while (h <= STEP && this.solid(nx, k.y - 1 - h)) h++;
    if (h > STEP) {
      if (k.climber) { k.state = 'climb'; k.t = 0; } else this.turn(k);
      return;
    }
    k.steps++;
    if (h > 0) { k.x = nx; k.y -= h; return this.arrive(k); }
    if (this.solid(nx, k.y)) { k.x = nx; return this.arrive(k); }
    let d = 1; while (d <= DROP && !this.solid(nx, k.y + d)) d++;
    // kits never step off into water: they wait at the edge of the bank (or their lily pad) for a ride
    if (d > DROP && this.inWater(nx, k.y + TILE)) { k.steps--; return; }
    k.x = nx;
    if (d <= DROP) { k.y += d; return this.arrive(k); }
    this.drop(k);
  }
  /** After a kit moves along the ground: home, a puff, or the water. */
  private arrive(k: Kit) {
    if (Math.abs(k.x - this.exit.x) <= 3 && Math.abs(k.y - this.exit.y) <= 4) {
      k.state = 'home'; k.t = 0; this.saved++; this.lastHome = this.tick; this.emit('home', k); return;
    }
    if (this.puffAt(k.x, k.y)) this.launch(k);
  }
  private launch(k: Kit) {
    k.state = 'bounce'; k.t = 0; k.vx = k.dir * BOUNCE.side; k.vy = -BOUNCE.up; k.top = k.y; k.fall = 0;
    this.emit('bounce', k);
  }
  private land(k: Kit, fell: number, soft: boolean) {
    k.x = Math.round(k.x); k.y = Math.round(k.y); k.t = 0;
    if (this.puffAt(k.x, k.y)) return this.launch(k);
    if (fell > SAFE_FALL && !soft) { k.state = 'dizzy'; this.emit('dizzy', k); return; }
    k.state = 'walk'; this.emit('land', k);
    this.arrive(k);
  }
  private fall(k: Kit) {
    if (k.state === 'fall' && k.glider && k.fall >= GLIDE_OPEN) { k.state = 'glide'; this.emit('glide', k); }
    const speed = k.state === 'glide' ? 1 : FALL_SPEED;
    for (let i = 0; i < speed; i++) {
      if (this.fanAt(k.x, k.y - 1)) { k.state = 'float'; k.fall = 0; return; }
      if (this.solid(k.x, k.y)) return this.land(k, k.fall, k.state === 'glide');
      k.y++; k.fall++;
      if (this.inWater(k.x, k.y)) { k.state = 'splash'; k.t = 0; this.emit('splash', k); return; }
    }
  }
  private float(k: Kit) {
    const f = this.fanAt(k.x, k.y - 1);
    if (!f) { this.drop(k); return; }
    if (k.y - KIT_H > f.y + 2 && !this.solid(k.x, k.y - KIT_H - 1)) k.y--;
    const nx = k.x + k.dir;
    for (let j = STEP + 1; j <= KIT_H; j++) if (this.solid(nx, k.y - j)) { this.turn(k); return; }
    let h = 0; while (h <= STEP && this.solid(nx, k.y - 1 - h)) h++;
    if (h > STEP) { this.turn(k); return; }
    k.x = nx;
    if (h > 0 || this.solid(nx, k.y)) { k.y -= h; k.state = 'walk'; k.t = 0; this.arrive(k); }
  }
  private bounce(k: Kit) {
    k.vy += BOUNCE.gravity;
    const nx = k.x + k.vx, rx = Math.round(nx), ry = Math.round(k.y);
    if (this.solid(rx, ry - 3) || this.solid(rx, ry - KIT_H + 2)) { k.vx = -k.vx; this.turn(k); } else k.x = nx;
    const ny = k.y + k.vy, cx = Math.round(k.x);
    if (k.vy < 0) {
      if (this.solid(cx, Math.round(ny) - KIT_H)) k.vy = 0; else k.y = ny;
    } else {
      for (let yy = Math.round(k.y); yy <= Math.round(ny); yy++) {
        if (this.solid(cx, yy)) { k.y = yy; return this.land(k, yy - k.top, false); }
        if (this.inWater(cx, yy)) { k.x = cx; k.y = yy; k.state = 'splash'; k.t = 0; this.emit('splash', k); return; }
      }
      k.y = ny;
    }
    if (k.vy > 0 && this.fanAt(Math.round(k.x), Math.round(k.y) - 1)) { k.x = Math.round(k.x); k.y = Math.round(k.y); k.state = 'float'; k.fall = 0; }
  }
  private climb(k: Kit) {
    if (k.t % CLIMB_EVERY) return;
    if (!this.solid(k.x + k.dir, k.y - 1)) {
      if (this.solid(k.x + k.dir, k.y)) { k.x += k.dir; k.state = 'walk'; k.t = 0; this.emit('climbed', k); this.arrive(k); }
      else { this.drop(k); }
      return;
    }
    if (this.solid(k.x, k.y - KIT_H - 1)) { this.turn(k); this.drop(k); return; }
    k.y--;
  }
  private dig(k: Kit) {
    if (k.t % DIG_EVERY) return;
    let any = false, blocked = false;
    for (let dx = -4; dx <= 4; dx++) {
      const m = this.mat(k.x + dx, k.y);
      if (diggable(m)) any = true; else if (m !== EMPTY) blocked = true;
    }
    if (!any && this.solid(k.x, k.y)) blocked = true;
    if (blocked) { k.state = 'shrug'; k.t = 0; this.emit('shrug', k); return; }
    if (!any) { this.drop(k); return; }
    for (let dx = -4; dx <= 4; dx++) this.clear(k.x + dx, k.y);
    k.y++; this.terrainVersion++;
    if (k.t % 8 === 0) this.emit('dig', k);
  }
  private tunnel(k: Kit) {
    if (!this.solid(k.x, k.y)) return this.drop(k);
    // look ahead: stop at stone, a belt or hay that faces the other way, and finish when the earth runs out
    let soft = false;
    for (let d = 1; d <= 8; d++) for (let j = 1; j <= KIT_H - 1; j++) {
      const m = this.mat(k.x + k.dir * d, k.y - j);
      if (m === EMPTY) continue;
      const against = (m === HAY_L && k.dir > 0) || (m === HAY_R && k.dir < 0);
      if ((!diggable(m) || against) && d <= 4) { k.state = 'shrug'; k.t = 0; this.emit('shrug', k); return; }
      if (diggable(m) && !against) soft = true;
    }
    // until it reaches some earth a tunneller walks on, ready; once it has dug through, it walks on as usual
    if (!soft) { if (k.dug) { k.state = 'walk'; k.t = 0; } else this.walk(k); return; }
    if (k.t % TUNNEL_EVERY) return;
    k.dug = true;
    let any = false;
    for (let d = 1; d <= 4; d++) for (let j = 1; j <= KIT_H; j++) any = this.clear(k.x + k.dir * d, k.y - j, k.dir) || any;
    if (any) this.terrainVersion++;
    if (k.t % 8 === 0) this.emit('dig', k);
    const nx = k.x + k.dir;
    let h = 0; while (h <= STEP && this.solid(nx, k.y - 1 - h)) h++;
    if (h > STEP) return;
    k.x = nx; k.y -= h;
    if (!this.solid(k.x, k.y)) {
      let d = 1; while (d <= DROP && !this.solid(k.x, k.y + d)) d++;
      if (d <= DROP) k.y += d; else this.drop(k);
    }
  }
  private build(k: Kit) {
    if (k.t % BUILD_EVERY) return;
    if (k.bales <= 0) { k.state = 'shrug'; k.t = 0; this.emit('shrug', k); return; }
    for (let d = 1; d <= 4; d++) for (let j = 3; j <= KIT_H; j++) if (this.solid(k.x + k.dir * d, k.y - j)) { this.turn(k); k.state = 'walk'; k.t = 0; return; }
    for (let d = 0; d < 8; d++) for (let j = 1; j <= 2; j++) {
      const x = k.x + k.dir * d, y = k.y - j;
      if (x >= 0 && x < this.W && y >= 0 && y < this.H && !this.mask[y * this.W + x]) this.mask[y * this.W + x] = BALE;
    }
    this.terrainVersion++;
    k.x += k.dir * 4; k.y -= 2; k.bales--;
    this.emit('bale', k);
    this.arrive(k);
  }

  // ---- the end
  result(): Result {
    const L = this.level, cleared = this.saved >= L.need, jobsLeft = JOBS.reduce((a, j) => a + this.left[j], 0);
    const thrifty = this.used <= L.par.jobs, speedy = this.lastHome <= L.par.time * TPS;
    return {
      level: L.id, saved: this.saved, kits: L.kits, need: L.need, used: this.used, jobsLeft, time: this.lastHome, cleared,
      thrifty: cleared && thrifty, speedy: cleared && speedy, stars: cleared ? 1 + (thrifty ? 1 : 0) + (speedy ? 1 : 0) : 0,
    };
  }
}
export type Result = { level: string; saved: number; kits: number; need: number; used: number; jobsLeft: number; time: number; cleared: boolean; thrifty: boolean; speedy: boolean; stars: number };

/** Plays a level with a list of jobs at set ticks, to the end, and returns the game. */
export function replay(level: LevelDef | number | string, actions: readonly Action[], opts: { limit?: number } = {}) {
  const g = new ParadeGame(level), list = [...actions].sort((a, b) => a.t - b.t);
  let i = 0;
  const limit = opts.limit ?? g.level.time * TPS + 10;
  while (g.state === 'play' && g.tick < limit) {
    while (i < list.length && list[i].t <= g.tick) { const a = list[i++]; if (a.t === g.tick) g.assign(a.k, a.job); }
    g.step();
  }
  return g;
}

// ---- saving
export type Best = { stars: number; saved: number; used: number; time: number };
export type Profile = { v: 1; best: Record<string, Best>; level: number; muted: boolean };
export const freshProfile = (): Profile => ({ v: 1, best: {}, level: 0, muted: false });
export function readProfile(raw: string | null): Profile {
  const p = freshProfile();
  if (!raw) return p;
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || j.v !== 1) return p;
    if (j.best && typeof j.best === 'object') for (const L of LEVELS) {
      const b = j.best[L.id];
      if (b && typeof b === 'object' && [b.stars, b.saved, b.used, b.time].every((n) => Number.isFinite(n))) {
        p.best[L.id] = { stars: Math.max(0, Math.min(3, Math.floor(b.stars))), saved: Math.max(0, Math.floor(b.saved)), used: Math.max(0, Math.floor(b.used)), time: Math.max(0, Math.floor(b.time)) };
      }
    }
    if (Number.isInteger(j.level) && j.level >= 0 && j.level < LEVELS.length) p.level = j.level;
    p.muted = j.muted === true;
  } catch { /* a broken save starts fresh */ }
  return p;
}
export const unlocked = (p: Profile, i: number) => i === 0 || (i > 0 && i < LEVELS.length && (p.best[LEVELS[i - 1].id]?.stars ?? 0) > 0);
export const totalStars = (p: Profile) => LEVELS.reduce((a, L) => a + (p.best[L.id]?.stars ?? 0), 0);
/** Keeps the best of each measure, and returns the kind words for anything new. */
export function record(p: Profile, r: Result): string[] {
  const news: string[] = [], old = p.best[r.level];
  if (!r.cleared) return news;
  const i = levelIndex(r.level);
  if (!old || old.stars === 0) { news.push('Level cleared!'); if (i + 1 < LEVELS.length) news.push(`${LEVELS[i + 1].name} is open`); }
  else if (r.stars > old.stars) news.push('More stars!');
  if (old && r.saved > old.saved) news.push('Most kits home yet!');
  p.best[r.level] = old
    ? { stars: Math.max(old.stars, r.stars), saved: Math.max(old.saved, r.saved), used: old.stars ? Math.min(old.used, r.used) : r.used, time: old.stars ? Math.min(old.time, r.time) : r.time }
    : { stars: r.stars, saved: r.saved, used: r.used, time: r.time };
  return news;
}

// Glimmer Cave: the rules of a dive. Deterministic and DOM-free: a dive is a seed plus the moves made, and every
// random draw comes from a seeded generator.
import {
  BASE, BEETLE, BURST, CLASS, CRITTERS, DIG_TIME, ELITE, LAYER_MIX, LAYER_SECONDS, MAX_ALIVE, MITE, POD_DISTANCE, POD_SECONDS,
  UPGRADES, WYRM_AT, critterFluff, targetAlive,
  type Block, type CritterId, type Hazard, type Hero, type JobId, type LayerNo, type OverclockId, type PassiveId, type UpgradeId,
  type WeaponId,
} from './glimmer-cave-data.js';
import { Rand, mix } from './glimmer-cave-rand.js';
import { MAP_H, MAP_W, dig, makeMap, solid, tileAt, type CaveMap } from './glimmer-cave-map.js';
import { newWeapon, runWeapons, type WeaponState } from './glimmer-cave-weapons.js';

export * from './glimmer-cave-data.js';
export { Rand, mix } from './glimmer-cave-rand.js';
export * from './glimmer-cave-map.js';
export { newWeapon, runWeapons, type WeaponState } from './glimmer-cave-weapons.js';

// ── Types ──────────────────────────────────────────────────────────────────

/** The stick: its length is clamped to 1. */
export type Input = { x: number; y: number };

export type CritterState = 'walk' | 'dash' | 'rest' | 'ready' | 'ram';
/** `t` is the critter's state timer (a beetle's ram keeps the tiles left to go in it); `dx`, `dy` is a ram's line. */
export type Critter = {
  id: number; kind: CritterId; elite: boolean; x: number; y: number; fluff: number; max: number;
  slow: number; slowFor: number; stun: number; hit: number; state: CritterState; t: number; dx: number; dy: number;
};

export type Result = 'bonked' | 'missed' | 'complete';
/** What happened in a step, for the scene and the sound. Positions are in tiles. */
export type CaveEvent =
  | { k: 'fire'; w: WeaponId; x: number; y: number; dx: number; dy: number }
  | { k: 'hit'; id: number; x: number; y: number; dmg: number; crit: boolean }
  | { k: 'bonk'; id: number; kind: CritterId; elite: boolean; x: number; y: number }
  | { k: 'dig'; x: number; y: number; block: Block; progress: number }
  | { k: 'gold'; n: number }
  | { k: 'crystal'; n: number }
  | { k: 'hurt'; dmg: number }
  | { k: 'level'; level: number }
  | { k: 'burst'; dx: number; dy: number }
  | { k: 'pod'; x: number; y: number }
  | { k: 'podReached' }
  | { k: 'job'; id: JobId; n: number; done: boolean }
  | { k: 'wyrm'; what: 'surface' | 'dive' | 'rumble' | 'bonked'; x: number; y: number }
  | { k: 'over'; result: Result };

export type Phase = 'play' | 'pick' | 'pod' | 'over';

export type Rarity = 0 | 1 | 2 | 3;
export type Card =
  | { k: 'weapon'; id: WeaponId; rarity: Rarity }
  | { k: 'overclock'; id: OverclockId }
  | { k: 'passive'; id: PassiveId; rarity: Rarity }
  | { k: 'snack' };

export type JobState = { id: JobId; n: number; goal: number; done: boolean; lit?: number[]; standing?: number };
export type Wyrm = {
  x: number; y: number; dir: number; fluff: number; max: number; segs: { x: number; y: number }[];
  under: number; rumble: number; ring: number | null; fast: boolean; bonked: boolean;
};

/** The part of the camp profile a dive reads. Missing upgrades count as level 0. */
export type ProfileLike = { upgrades?: Partial<Record<UpgradeId, number>>; unlocked?: { weapons?: WeaponId[] } };
export type DiveOpts = { seed: number; hero: Hero; hazard: Hazard; profile: ProfileLike; hz?: 60 | 30 | 15 };
export type Stats = { maxFluff: number; speed: number; pickup: number; armour: number; crit: number; dig: number; damage: number; cooldown: number; projectile: number };

// ── Tuning that only the rules use ─────────────────────────────────────────

/** The spawn window: the view, in tiles, centred on the hero. Spawns land 1-3 tiles beyond its edge. */
const VIEW = { w: 18, h: 11 };
const SPAWN_GAP = 0.05;
/** Crystals in pickup range fly at `speed` tiles/s and are taken within `take`. */
const CRYSTAL = { speed: 8, take: 0.3 };
const BUDDY_GAP = 1.2;
/** A beetle lowers its head this long before it rams. */
const READY = 0.4;
/** Rock stops a critter's box at most this big, so an elite still fits a one-tile tunnel. */
const WALL_R = 0.45;
/** The first elite comes this far into a layer, then one every ELITE.every. */
const FIRST_ELITE = 30;
const EPS = 1e-9;

export function critterRadius(c: Critter) { return CRITTERS[c.kind].radius * (c.elite ? ELITE.size : 1); }

// ── Moving boxes against rock ──────────────────────────────────────────────

/** Moves a box of half-size r at (x, y) by dx along x and returns the new x, stopped flush at the first solid tile it
 *  would enter. Moves are under a tile a step, so only the columns crossed are checked. */
function clipX(m: CaveMap, x: number, y: number, r: number, dx: number) {
  const nx = x + dx, y0 = Math.floor(y - r), y1 = Math.floor(y + r - EPS);
  if (dx > 0) {
    const to = Math.floor(nx + r - EPS);
    for (let tx = Math.floor(x + r - EPS) + 1; tx <= to; tx++) for (let ty = y0; ty <= y1; ty++) if (solid(tileAt(m, tx, ty))) return tx - r;
  } else if (dx < 0) {
    const to = Math.floor(nx - r);
    for (let tx = Math.floor(x - r) - 1; tx >= to; tx--) for (let ty = y0; ty <= y1; ty++) if (solid(tileAt(m, tx, ty))) return tx + 1 + r;
  }
  return nx;
}

function clipY(m: CaveMap, x: number, y: number, r: number, dy: number) {
  const ny = y + dy, x0 = Math.floor(x - r), x1 = Math.floor(x + r - EPS);
  if (dy > 0) {
    const to = Math.floor(ny + r - EPS);
    for (let ty = Math.floor(y + r - EPS) + 1; ty <= to; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tileAt(m, tx, ty))) return ty - r;
  } else if (dy < 0) {
    const to = Math.floor(ny - r);
    for (let ty = Math.floor(y - r) - 1; ty >= to; ty--) for (let tx = x0; tx <= x1; tx++) if (solid(tileAt(m, tx, ty))) return ty + 1 + r;
  }
  return ny;
}

// ── The spatial hash ───────────────────────────────────────────────────────

/** Critters bucketed by `cell`-tile squares, rebuilt once a step. Cells and lists are reused, so a rebuild allocates
 *  nothing once warm. */
export class Grid {
  private cols: number; private rows: number; private cells: Critter[][]; private used: number[] = [];
  constructor(public cell = 2) {
    this.cols = Math.ceil(MAP_W / cell); this.rows = Math.ceil(MAP_H / cell);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }
  private cx(x: number) { return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell))); }
  private cy(y: number) { return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell))); }
  clear() { for (const i of this.used) this.cells[i].length = 0; this.used.length = 0; }
  add(c: Critter) {
    const i = this.cy(c.y) * this.cols + this.cx(c.x), cell = this.cells[i];
    if (!cell.length) this.used.push(i);
    cell.push(c);
  }
  /** Fills `out` with the critters whose centres are within r of (x, y), stopping at `max`. */
  near(x: number, y: number, r: number, out: Critter[], max = Infinity): Critter[] {
    out.length = 0;
    const x0 = this.cx(x - r), x1 = this.cx(x + r), y0 = this.cy(y - r), y1 = this.cy(y + r), r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (const c of this.cells[cy * this.cols + cx]) {
        const ex = c.x - x, ey = c.y - y;
        if (ex * ex + ey * ey <= r2) { out.push(c); if (out.length >= max) return out; }
      }
    }
    return out;
  }
}

// ── The dive ───────────────────────────────────────────────────────────────

/**
 * A dive: five layers of one cave. `step` runs one tick of the fixed loop; the phases of a step are methods called in
 * order, so later systems (weapons, cards, jobs, the wyrm) hook in at their phase.
 */
export class Dive {
  seed: number; hero: Hero; hazard: Hazard; profile: ProfileLike; hz: 60 | 30 | 15; dt: number;
  layer: LayerNo = 1; map!: CaveMap; phase: Phase = 'play';
  /** Seconds into the layer, and seconds left on the clock: 300 down to the pod, then the pod's 45
   *  (on layer 5, WYRM_AT down to the wyrm's arrival, then held at 0 until the pod lands). */
  t = 0; timer: number = LAYER_SECONDS;
  hx = 0; hy = 0; face = { x: 1, y: 0 }; moving = false;
  fluff = 0; grace = 0; xp = 0; level = 1; picks = 0; offer: Card[] = [];
  weapons: WeaponState[]; passives: Partial<Record<PassiveId, { n: number; v: number }>> = {}; rerolls = 0;
  gold = { banked: 0, layer: 0 };
  crystals: { x: number; y: number; n: number }[] = [];
  critters: Critter[] = [];
  pod: { x: number; y: number; reached: boolean } | null = null;
  job: JobState | null = null; jobsUsed: JobId[] = []; wyrm: Wyrm | null = null;
  /** Critters bonked this dive. */
  bonked = 0;
  buddy = { x: 0, y: 0 };
  digging: { x: number; y: number; p: number } | null = null;
  result: Result | null = null;
  events: CaveEvent[] = [];
  /** False turns all spawning off (tests). */
  spawning = true;
  rand!: Rand;
  grid = new Grid();

  private ids = 0; private spawnCd = 0; private nextBurst: number = BURST.every; private nextElite = FIRST_ELITE;
  private spot = { x: 0, y: 0 };
  /** Steps from each tile to the hero's, -1 for rock or cut off; rebuilt when the hero changes tile or rock is dug. */
  private flow = new Int16Array(MAP_W * MAP_H); private queue = new Int32Array(MAP_W * MAP_H);
  private flowMap: CaveMap | null = null; private flowAt = -1;
  /** The hero's recent path as x, y pairs, oldest first; the buddy walks it. */
  private trail: number[] = [];
  private scratch: Critter[] = [];

  constructor(o: DiveOpts) {
    this.seed = o.seed >>> 0; this.hero = o.hero; this.hazard = o.hazard; this.profile = o.profile;
    this.hz = o.hz ?? 60; this.dt = 1 / this.hz;
    this.weapons = [newWeapon(CLASS[o.hero].start)];
    this.startLayer(1);
    this.fluff = this.stats().maxFluff;
  }

  private upgrade(id: UpgradeId) { return this.profile.upgrades?.[id] ?? 0; }
  private passive(id: PassiveId) { return this.passives[id]?.v ?? 0; }

  /** The hero's numbers: base, then class, passives and camp upgrades. `damage` and `cooldown` are multipliers. */
  stats(): Stats {
    const c = CLASS[this.hero], up = (id: UpgradeId) => UPGRADES[id].per * this.upgrade(id), pv = (id: PassiveId) => this.passive(id);
    return {
      maxFluff: (BASE.fluff + up('fluffier') + pv('fluff')) * c.fluff,
      speed: BASE.speed * c.speed * (1 + pv('paws') + up('quicker')),
      pickup: BASE.pickup * (1 + pv('magnet') + up('magnetic')),
      armour: BASE.armour + pv('coat'),
      crit: BASE.crit + pv('lucky'),
      dig: c.dig * (1 + pv('arms') + up('diggier')),
      damage: 1 + pv('claws') + up('sharper'),
      cooldown: Math.max(0.4, 1 - pv('busy')),
      projectile: c.projectile,
    };
  }

  /** Builds layer n fresh: its map from mix(seed, n), its Rand from mix(seed, n + 100). Fluff and the build carry over. */
  startLayer(n: LayerNo) {
    this.layer = n; this.job = null; this.wyrm = null;
    this.map = makeMap(mix(this.seed, n), n, null);
    this.rand = new Rand(mix(this.seed, n + 100));
    this.phase = 'play'; this.result = null; this.t = 0; this.timer = n === 5 ? WYRM_AT : LAYER_SECONDS;
    this.critters = []; this.crystals = []; this.pod = null; this.gold.layer = 0; this.grace = 0;
    this.rerolls = 1 + this.upgrade('rerolls');
    this.spawnCd = 0; this.nextBurst = BURST.every; this.nextElite = FIRST_ELITE; this.flowAt = -1;
    this.placeHero(this.map.start.x + 0.5, this.map.start.y + 0.5);
  }

  /** Moves to the next layer from its pod. */
  descend(): boolean {
    if (this.phase !== 'pod' || this.layer >= 5) return false;
    this.startLayer((this.layer + 1) as LayerNo);
    return true;
  }

  /** Puts the hero at (x, y) with the buddy just behind, and stops any digging. */
  placeHero(x: number, y: number) {
    this.hx = x; this.hy = y; this.digging = null;
    this.trail = [x - BUDDY_GAP, y, x, y]; this.buddy.x = x - BUDDY_GAP; this.buddy.y = y;
  }

  spawn(kind: CritterId, x: number, y: number, elite = false): Critter {
    const fluff = critterFluff(CRITTERS[kind].fluff, this.layer, this.hazard) * (elite ? ELITE.fluff : 1);
    const c: Critter = {
      id: ++this.ids, kind, elite, x, y, fluff, max: fluff, slow: 0, slowFor: 0, stun: 0, hit: 0,
      state: kind === 'mite' ? 'dash' : 'walk', t: kind === 'mite' ? MITE.dash : kind === 'beetle' ? BEETLE.every : 0, dx: 0, dy: 0,
    };
    this.critters.push(c);
    return c;
  }

  /** Digs the block at tile (x, y) if it can be dug, paying out its gold and crystals. */
  digBlock(x: number, y: number): boolean {
    const got = dig(this.map, x, y, this.rand, this.layer);
    if (!got) return false;
    this.flowAt = -1;
    this.events.push({ k: 'dig', x, y, block: got.block, progress: 1 });
    if (got.gold) this.addGold(got.gold);
    if (got.crystals) this.crystals.push({ x: x + 0.5, y: y + 0.5, n: got.crystals });
    return true;
  }

  /** Adds gold to the layer's purse, with the Prospector upgrade. */
  addGold(n: number) {
    const g = Math.round(n * (1 + UPGRADES.prospector.per * this.upgrade('prospector')));
    this.gold.layer += g;
    this.events.push({ k: 'gold', n: g });
  }

  /** Lands the pod on the spot whose distance from the hero is closest to the middle of POD_DISTANCE. */
  landPod() {
    const want = (POD_DISTANCE[0] + POD_DISTANCE[1]) / 2;
    let best = this.map.start, bd = Infinity;
    for (const p of this.map.pods) {
      const d = Math.abs(Math.hypot(p.x + 0.5 - this.hx, p.y + 0.5 - this.hy) - want);
      if (d < bd) { bd = d; best = p; }
    }
    this.pod = { x: best.x + 0.5, y: best.y + 0.5, reached: false }; this.timer = POD_SECONDS;
    this.events.push({ k: 'pod', x: this.pod.x, y: this.pod.y });
  }

  /** One tick of 1 / hz seconds. Returns this step's events, or [] unless the dive is in play. */
  step(input: Input): CaveEvent[] {
    this.events = [];
    if (this.phase !== 'play') return this.events;
    const st = this.stats();
    this.timers();
    this.moveHero(input, st);
    this.fire();
    this.moveCritters();
    this.contact(st);
    this.pickup(st);
    this.spawnWaves();
    this.jobs();
    this.podCheck();
    this.overCheck();
    return this.events;
  }

  // 1. Timers.
  timers() {
    this.t += this.dt;
    this.timer = Math.max(0, this.timer - this.dt);
    if (this.grace > 0) this.grace -= this.dt;
  }

  // 2. The hero's move, by axis, against rock. A blocked axis with input on it digs.
  moveHero(input: Input, st: Stats) {
    let ix = input.x, iy = input.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    this.moving = len > 1e-6;
    if (this.moving) { this.face.x = input.x / len; this.face.y = input.y / len; }
    const m = this.map, r = BASE.radius, step = st.speed * this.dt, wantX = this.hx + ix * step, wantY = this.hy + iy * step;
    this.hx = clipX(m, this.hx, this.hy, r, ix * step);
    const blockedX = ix !== 0 && Math.abs(this.hx - wantX) > EPS;
    this.hy = clipY(m, this.hx, this.hy, r, iy * step);
    const blockedY = iy !== 0 && Math.abs(this.hy - wantY) > EPS;
    this.walkTrail();

    let tx = 0, ty = 0, found = false;
    if (blockedX && (!blockedY || Math.abs(ix) >= Math.abs(iy))) {
      tx = ix > 0 ? Math.round(this.hx + r) : Math.round(this.hx - r) - 1;
      for (const y of [Math.floor(this.hy), Math.floor(this.hy - r), Math.floor(this.hy + r - EPS)]) if (solid(tileAt(m, tx, y))) { ty = y; found = true; break; }
    } else if (blockedY) {
      ty = iy > 0 ? Math.round(this.hy + r) : Math.round(this.hy - r) - 1;
      for (const x of [Math.floor(this.hx), Math.floor(this.hx - r), Math.floor(this.hx + r - EPS)]) if (solid(tileAt(m, x, ty))) { tx = x; found = true; break; }
    }
    const block = found ? tileAt(m, tx, ty) : 'floor';
    if (!(block in DIG_TIME)) { this.digging = null; return; }
    if (!this.digging || this.digging.x !== tx || this.digging.y !== ty) this.digging = { x: tx, y: ty, p: 0 };
    this.digging.p += this.dt / DIG_TIME[block as keyof typeof DIG_TIME] * st.dig;
    if (this.digging.p >= 1 - EPS) { this.digging = null; this.digBlock(tx, ty); }
    else this.events.push({ k: 'dig', x: tx, y: ty, block, progress: this.digging.p });
  }

  /** Records the hero's path and puts the buddy BUDDY_GAP tiles back along it. */
  private walkTrail() {
    const tr = this.trail;
    if (Math.hypot(this.hx - tr[tr.length - 2], this.hy - tr[tr.length - 1]) >= 0.15) { tr.push(this.hx, this.hy); if (tr.length > 32) tr.splice(0, 2); }
    let px = this.hx, py = this.hy, left = BUDDY_GAP;
    for (let i = tr.length - 2; i >= 0; i -= 2) {
      const qx = tr[i], qy = tr[i + 1], seg = Math.hypot(qx - px, qy - py);
      if (seg >= left) { const f = left / seg; this.buddy.x = px + (qx - px) * f; this.buddy.y = py + (qy - py) * f; return; }
      left -= seg; px = qx; py = qy;
    }
    this.buddy.x = px; this.buddy.y = py;
  }

  // 3. Weapons. The grid is rebuilt here, once a step, for the weapons, the critters' spacing and the contact check.
  fire() {
    this.grid.clear();
    for (const c of this.critters) this.grid.add(c);
    runWeapons(this, 'hero');
    runWeapons(this, 'buddy');
    this.sweep();
  }

  /** Drops bonked critters from the list, in place. */
  sweep() {
    const cs = this.critters; let k = 0;
    for (let i = 0; i < cs.length; i++) if (cs[i].fluff > 0) cs[k++] = cs[i];
    cs.length = k;
  }

  // 4. Critters move and attack.
  moveCritters() {
    this.updateFlow();
    const m = this.map, dt = this.dt, near = this.scratch, push = Math.min(0.5, 15 * dt);
    for (const c of this.critters) {
      if (c.hit > 0) c.hit -= dt;
      if (c.slowFor > 0) { c.slowFor -= dt; if (c.slowFor <= 0) c.slow = 0; }
      if (c.stun > 0) { c.stun -= dt; continue; }
      const rw = Math.min(WALL_R, critterRadius(c)), slow = 1 - c.slow;
      if (c.kind === 'beetle' && this.beetle(c, rw, slow)) continue;
      let speed = CRITTERS[c.kind].speed * slow;
      if (c.kind === 'mite') {
        c.t -= dt;
        if (c.t <= 0) { if (c.state === 'dash') { c.state = 'rest'; c.t += MITE.rest; } else { c.state = 'dash'; c.t += MITE.dash; } }
        // A mite's table speed is its average, so it dashes faster to make up for its rests.
        speed = c.state === 'rest' ? 0 : speed * (MITE.dash + MITE.rest) / MITE.dash;
      }
      this.steer(c);
      let vx = c.dx * speed * dt, vy = c.dy * speed * dt;
      // A light push apart from up to six neighbours, so a crowd spreads instead of stacking.
      const rc = critterRadius(c);
      for (const o of this.grid.near(c.x, c.y, rc + WALL_R, near, 7)) {
        if (o === c) continue;
        const ex = c.x - o.x, ey = c.y - o.y, d = Math.hypot(ex, ey), over = rc + critterRadius(o) - d;
        if (over > 0 && d > 1e-6) { vx += ex / d * over * push; vy += ey / d * over * push; }
      }
      c.x = clipX(m, c.x, c.y, rw, vx); c.y = clipY(m, c.x, c.y, rw, vy);
    }
  }

  /** Points c.dx, c.dy at the hero: straight when close, otherwise down the flow field (diagonally where both ways
   *  are open). Leaves them 0 when on top of the hero. */
  private steer(c: Critter) {
    const m = this.map, w = m.w, f = this.flow, ex = this.hx - c.x, ey = this.hy - c.y, d2 = ex * ex + ey * ey;
    const tx = Math.floor(c.x), ty = Math.floor(c.y), i = ty * w + tx, here = tx >= 0 && ty >= 0 && tx < w && ty < m.h ? f[i] : -1;
    let gx = this.hx, gy = this.hy;
    if (d2 >= 2.25 && here > 0) {
      const lower = (j: number) => f[j] >= 0 && f[j] < here;
      const sx = tx + 1 < w && lower(i + 1) ? 1 : tx > 0 && lower(i - 1) ? -1 : 0;
      const sy = ty + 1 < m.h && lower(i + w) ? 1 : ty > 0 && lower(i - w) ? -1 : 0;
      let ux = sx, uy = sy;
      if (sx && sy && f[i + sy * w + sx] < 0) { if (Math.abs(ex) >= Math.abs(ey)) uy = 0; else ux = 0; }
      gx = tx + ux + 0.5; gy = ty + uy + 0.5;
    }
    const vx = gx - c.x, vy = gy - c.y, d = Math.hypot(vx, vy);
    if (d < 1e-2) { c.dx = 0; c.dy = 0; } else { c.dx = vx / d; c.dy = vy / d; }
  }

  /** A beetle's habit: within BEETLE.within tiles and off cooldown, it readies for READY s and rams BEETLE.ram tiles.
   *  Returns true when this step was spent readying or ramming. */
  private beetle(c: Critter, rw: number, slow: number): boolean {
    if (c.state === 'ready') {
      c.t -= this.dt;
      if (c.t > 0) return true;
      c.state = 'ram'; c.t = BEETLE.ram;
    }
    if (c.state === 'ram') {
      const go = Math.min(c.t, BEETLE.ramSpeed * slow * this.dt);
      c.t -= go;
      c.x = clipX(this.map, c.x, c.y, rw, c.dx * go); c.y = clipY(this.map, c.x, c.y, rw, c.dy * go);
      if (c.t <= EPS) { c.state = 'walk'; c.t = BEETLE.every - READY - BEETLE.ram / BEETLE.ramSpeed; }
      return true;
    }
    c.t -= this.dt;
    const ex = this.hx - c.x, ey = this.hy - c.y, d = Math.hypot(ex, ey);
    if (c.t > 0 || d > BEETLE.within) return false;
    c.state = 'ready'; c.t = READY;
    if (d > 1e-6) { c.dx = ex / d; c.dy = ey / d; } else { c.dx = 1; c.dy = 0; }
    return true;
  }

  /** A 4-way breadth-first fill from the hero's tile over floor. */
  private updateFlow() {
    const m = this.map, w = m.w, n = w * m.h, at = Math.floor(this.hy) * w + Math.floor(this.hx);
    if (this.flowMap === m && this.flowAt === at) return;
    if (this.flow.length !== n) { this.flow = new Int16Array(n); this.queue = new Int32Array(n); }
    this.flowMap = m; this.flowAt = at;
    const f = this.flow, q = this.queue, tiles = m.tiles;
    f.fill(-1);
    if (tiles[at] !== 'floor') return;
    f[at] = 0; q[0] = at;
    let head = 0, tail = 1;
    while (head < tail) {
      const i = q[head++], x = i % w, d = f[i] + 1;
      if (x + 1 < w && f[i + 1] < 0 && tiles[i + 1] === 'floor') { f[i + 1] = d; q[tail++] = i + 1; }
      if (x > 0 && f[i - 1] < 0 && tiles[i - 1] === 'floor') { f[i - 1] = d; q[tail++] = i - 1; }
      if (i + w < n && f[i + w] < 0 && tiles[i + w] === 'floor') { f[i + w] = d; q[tail++] = i + w; }
      if (i >= w && f[i - w] < 0 && tiles[i - w] === 'floor') { f[i - w] = d; q[tail++] = i - w; }
    }
  }

  // 5. Contact: the strongest touching critter takes its bump from Fluff, then grace.
  contact(st: Stats) {
    if (this.grace > 0) return;
    const r = BASE.radius, hx = this.hx, hy = this.hy;
    // The grid was built before the critters moved, so the search reaches a step's worth of movement further.
    let bump = 0;
    for (const c of this.grid.near(hx, hy, r + ELITE.size * WALL_R + 8 * this.dt, this.scratch)) {
      if (c.fluff <= 0) continue;
      const rr = r + critterRadius(c), ex = c.x - hx, ey = c.y - hy;
      if (ex * ex + ey * ey <= rr * rr) bump = Math.max(bump, CRITTERS[c.kind].contact * (c.elite ? ELITE.contact : 1));
    }
    if (!bump) return;
    this.hurt(Math.max(1, bump - st.armour));
  }

  /** Takes Fluff and starts the grace period. */
  hurt(dmg: number) {
    this.fluff = Math.max(0, this.fluff - dmg); this.grace = BASE.grace;
    this.events.push({ k: 'hurt', dmg });
  }

  // 6. Crystals in pickup range fly to the hero and are collected.
  pickup(st: Stats) {
    const cs = this.crystals, reach = st.pickup, fly = CRYSTAL.speed * this.dt;
    let k = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], ex = this.hx - c.x, ey = this.hy - c.y;
      let d = Math.hypot(ex, ey);
      if (d <= reach && d > 0) { const s = Math.min(d, fly); c.x += ex / d * s; c.y += ey / d * s; d -= s; }
      if (d < CRYSTAL.take) { this.collect(c.n); continue; }
      cs[k++] = c;
    }
    cs.length = k;
  }

  /** Takes n experience from a crystal. Levelling comes with the cards. */
  collect(n: number) {
    this.xp += n;
    this.events.push({ k: 'crystal', n });
  }

  // 7. Spawns: bursts, elites, then a trickle toward the target alive, never past MAX_ALIVE.
  spawnWaves() {
    if (!this.spawning) return;
    if (this.t >= this.nextBurst) { this.nextBurst = (Math.floor(this.t / BURST.every) + 1) * BURST.every; this.burst(); }
    if (this.layer >= ELITE.from && this.t >= this.nextElite) {
      this.nextElite = FIRST_ELITE + (Math.floor((this.t - FIRST_ELITE) / ELITE.every) + 1) * ELITE.every;
      if (this.critters.length < MAX_ALIVE && this.spawnSpot(-1)) this.spawn(this.pickKind(), this.spot.x, this.spot.y, true);
    }
    const target = targetAlive(this.t, this.layer, this.hazard, this.pod !== null && !this.pod.reached);
    this.spawnCd -= this.dt;
    while (this.spawnCd <= 0 && this.critters.length < target) {
      this.spawnCd += SPAWN_GAP;
      if (!this.spawnSpot(-1)) continue;
      const kind = this.pickKind();
      if (kind !== 'mite') { this.spawn(kind, this.spot.x, this.spot.y); continue; }
      const n = MITE.pack[0] + this.rand.int(MITE.pack[1] - MITE.pack[0] + 1);
      for (let i = 0; i < n && this.critters.length < MAX_ALIVE; i++) {
        this.spawn('mite', this.spot.x + (this.rand.next() - 0.5) * 0.6, this.spot.y + (this.rand.next() - 0.5) * 0.6);
      }
    }
    if (this.spawnCd < 0) this.spawnCd = 0;
  }

  /** A swarm burst: BURST.n critters at once from one side, up to the cap. */
  private burst() {
    const side = this.rand.int(4), dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    this.events.push({ k: 'burst', dx: dirs[side][0], dy: dirs[side][1] });
    const n = Math.min(BURST.n, MAX_ALIVE - this.critters.length);
    for (let i = 0; i < n; i++) if (this.spawnSpot(side)) this.spawn(this.pickKind(), this.spot.x, this.spot.y);
  }

  private pickKind(): CritterId {
    const [s, m, b] = LAYER_MIX[this.layer];
    const x = this.rand.next() * (s + m + b);
    return x < s ? 'soot' : x < s + m ? 'mite' : 'beetle';
  }

  /** Finds an open tile 1-3 tiles beyond the view's edge on a side (0 right, 1 left, 2 down, 3 up; -1 any) and puts
   *  its centre in `spot`. Gives up after 8 tries. */
  private spawnSpot(side: number): boolean {
    const hw = VIEW.w / 2, hh = VIEW.h / 2;
    for (let i = 0; i < 8; i++) {
      const s = side < 0 ? this.rand.int(4) : side, out = 1 + this.rand.next() * 2, along = this.rand.next() * 2 - 1;
      const x = s === 0 ? this.hx + hw + out : s === 1 ? this.hx - hw - out : this.hx + along * (hw + 3);
      const y = s === 2 ? this.hy + hh + out : s === 3 ? this.hy - hh - out : this.hy + along * (hh + 3);
      const tx = Math.floor(x), ty = Math.floor(y);
      if (tileAt(this.map, tx, ty) === 'floor') { this.spot.x = tx + 0.5; this.spot.y = ty + 0.5; return true; }
    }
    return false;
  }

  // 8. Jobs and the wyrm (Task 6).
  jobs() {}

  // 9. The pod: it lands when the clock runs out, and is reached within 1 tile. A bonked hero never reaches it.
  podCheck() {
    if (this.fluff <= 0) return;
    if (!this.pod) { if (this.timer <= 0 && this.layer < 5) this.landPod(); return; }
    if (this.pod.reached) return;
    if (Math.hypot(this.hx - this.pod.x, this.hy - this.pod.y) <= 1) {
      this.pod.reached = true; this.gold.banked += this.gold.layer; this.gold.layer = 0;
      this.events.push({ k: 'podReached' });
      if (this.layer === 5) this.result = 'complete'; else this.phase = 'pod';
    } else if (this.timer <= 0) this.result = 'missed';
  }

  // 10. Over: bonked at 0 Fluff or a missed pod keeps half the layer's gold, rounded down.
  overCheck() {
    if (!this.result && this.fluff <= 0) this.result = 'bonked';
    if (!this.result) return;
    this.phase = 'over';
    if (this.result !== 'complete') { this.gold.banked += Math.floor(this.gold.layer / 2); this.gold.layer = 0; }
    this.events.push({ k: 'over', result: this.result });
  }
}

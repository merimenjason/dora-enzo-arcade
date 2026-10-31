// Cubby Valley's rules: walking, jumping, swimming, climbing and flying through the block valley; digging and placing;
// the bag and the Burrow Workbench; the six neighbours and their errands; burrows; saplings, sand and water; the day
// and the night with its dust-bunnies and monsters; hearts, bonks and slingshots; knock-outs; the summer fair; and the
// save. DOM-free and deterministic: every roll comes from the seeded generator, and time only moves when step() is
// given it.
import {
  World, generate, checkBurrow, encodeDiff, decodeDiff, Rng, hash3, BLOCKS, BLOCK_BY_KEY, W, D, H, idx, inside,
  AIR, WATER, SAND, LEAVES, LOG, TURF, SOIL, DOOR, BED, LANTERN, LANTERN_OUT, SAPLING, BENCH_WORK, CRYSTAL, GRASS, PEBBLES,
  type Valley, type Hit, type Spot, type BurrowReport,
} from './cubby-world.js';
import {
  ITEMS, RECIPES, RECIPE, START_RECIPES, NEIGHBOURS, CRITTERS, PALETTE, dropsOf, blockOf, cosyIns, COSY_SWAP,
  type Recipe, type NeighbourId, type CritterKind, type Step,
} from './cubby-content.js';

export const SAVE_KEY = 'cubby-valley-v1';
export const SLOTS = 3;
export const DAY = 600;
export const REACH = 5;
export const MAX_HP = 10;
const G = 26, JUMP = 8.1, WALK = 4.3, FLY = 9;
export const BODY = { r: 0.3, h: 0.85, eye: 0.7 };
export type Mode = 'story' | 'creative';

// ---------------------------------------------------------------- bodies
export interface Body {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; pitch: number;
  r: number; h: number; ground: boolean; water: boolean; ladder: boolean; fly: boolean;
  /** distance walked, for footsteps and the bobbing walk */
  walked: number; hitWall: boolean;
}
export const makeBody = (x: number, y: number, z: number, r = BODY.r, h = BODY.h): Body =>
  ({ x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, r, h, ground: false, water: false, ladder: false, fly: false, walked: 0, hitWall: false });

/** The top of the collision box at a cell (0 = nothing to bump). Doors stop creatures but let chinchillas through. */
export function solidTop(w: World, x: number, y: number, z: number, doors: boolean) {
  if (!inside(x, y, z)) return y < 0 ? 1 : x < 0 || z < 0 || x >= W || z >= D ? 1 : 0;
  const b = w.get(x, y, z), d = BLOCKS[b];
  if (d.solid) return d.height;
  if (doors && b === DOOR) return 1;
  return 0;
}
function boxFree(w: World, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, doors: boolean) {
  for (let Y = Math.floor(y0); Y <= Math.floor(y1 - 1e-6); Y++) for (let Z = Math.floor(z0); Z <= Math.floor(z1 - 1e-6); Z++) for (let X = Math.floor(x0); X <= Math.floor(x1 - 1e-6); X++) {
    const t = solidTop(w, X, Y, Z, doors); if (t && y1 > Y && y0 < Y + t) return false;
  }
  return true;
}
function resolve(w: World, b: Body, axis: 'x' | 'y' | 'z', s: number, doors: boolean) {
  const x0 = b.x - b.r, x1 = b.x + b.r, z0 = b.z - b.r, z1 = b.z + b.r, y0 = b.y, y1 = b.y + b.h;
  let hit = false;
  for (let Y = Math.floor(y0); Y <= Math.floor(y1 - 1e-6); Y++) for (let Z = Math.floor(z0); Z <= Math.floor(z1 - 1e-6); Z++) for (let X = Math.floor(x0); X <= Math.floor(x1 - 1e-6); X++) {
    const t = solidTop(w, X, Y, Z, doors); if (!t) continue;
    const top = Y + t;
    if (y1 <= Y || b.y >= top) continue;
    if (axis === 'y') {
      if (s < 0) { b.y = top; b.ground = true; } else b.y = Y - b.h - 1e-4;
      b.vy = 0; return true;
    }
    // little steps (beds, pots, a partial block) are walked straight up
    if (top - b.y <= 0.56 && (b.ground || b.water) && boxFree(w, b.x - b.r, top, b.z - b.r, b.x + b.r, top + b.h, b.z + b.r, doors)) { b.y = top; continue; }
    if (axis === 'x') { b.x = s > 0 ? X - b.r - 1e-4 : X + 1 + b.r + 1e-4; b.vx = 0; }
    else { b.z = s > 0 ? Z - b.r - 1e-4 : Z + 1 + b.r + 1e-4; b.vz = 0; }
    hit = true; return hit;
  }
  return hit;
}
function sweep(w: World, b: Body, axis: 'x' | 'y' | 'z', d: number, doors: boolean) {
  if (!d) return false;
  const n = Math.ceil(Math.abs(d) / 0.35), s = d / n;
  for (let k = 0; k < n; k++) { b[axis] += s; if (resolve(w, b, axis, s, doors)) return true; }
  return false;
}
export interface MoveOpts { doors?: boolean; auto?: boolean; flyer?: boolean; speed?: number }
/** Moves a body one tick: (wx, wz) is the wished-for ground velocity, up/down are jump (or swim/climb/fly up) and sink. */
export function moveBody(w: World, b: Body, wx: number, wz: number, up: boolean, down: boolean, dt: number, o: MoveOpts = {}) {
  const doors = !!o.doors;
  const fx = Math.floor(b.x), fz = Math.floor(b.z);
  b.water = w.get(fx, Math.floor(b.y + 0.35), fz) === WATER;
  b.ladder = !!BLOCKS[w.get(fx, Math.floor(b.y + 0.1), fz)].climb || !!BLOCKS[w.get(fx, Math.floor(b.y + 0.7), fz)].climb;
  const wish = Math.hypot(wx, wz);
  if (b.fly || o.flyer) {
    const k = Math.min(1, dt * 10); b.vx += (wx - b.vx) * k; b.vz += (wz - b.vz) * k;
    if (!o.flyer) b.vy += ((up ? FLY * 0.7 : down ? -FLY * 0.7 : 0) - b.vy) * k;
  } else {
    const k = Math.min(1, dt * (b.ground ? 16 : b.water ? 5 : 3.5));
    const sp = b.water ? 0.62 : 1;
    b.vx += (wx * sp - b.vx) * k; b.vz += (wz * sp - b.vz) * k;
    if (b.water) { b.vy -= G * 0.22 * dt; if (up) b.vy = Math.max(b.vy, Math.min(b.vy + 22 * dt, 3.4)); if (down) b.vy -= 8 * dt; b.vy = Math.max(b.vy, -2.4); }
    else if (b.ladder) { b.vy = up || (wish > 0.3 && b.hitWall) ? 3.2 : down ? -2.5 : Math.max(b.vy - G * dt, -1.4); }
    else { b.vy = Math.max(b.vy - G * dt, -30); if (up && b.ground) b.vy = JUMP; }
  }
  const wasGround = b.ground;
  b.ground = false;
  const ox = b.x, oz = b.z;
  const hx = sweep(w, b, 'x', b.vx * dt, doors), hz = sweep(w, b, 'z', b.vz * dt, doors);
  sweep(w, b, 'y', b.vy * dt, doors);
  b.hitWall = hx || hz;
  if ((hx || hz) && b.water && wish > 0.3 && (up || o.auto)) {
    // swimming into a bank: scramble up onto it (a ledge up to a block and a half above the water)
    const ax = b.x + Math.sign(wx) * (b.r + 0.2) * (Math.abs(wx) / wish), az = b.z + Math.sign(wz) * (b.r + 0.2) * (Math.abs(wz) / wish);
    for (const yy of [Math.floor(b.y), Math.floor(b.y) + 1]) {
      const t = solidTop(w, Math.floor(ax), yy, Math.floor(az), doors), top = yy + t;
      if (t && top - b.y <= 1.7 && boxFree(w, b.x - b.r, top, b.z - b.r, b.x + b.r, top + b.h, b.z + b.r, doors)) { b.vy = Math.max(b.vy, JUMP * 1.08); break; }
    }
  }
  if (o.auto && (hx || hz) && (wasGround || b.ground) && wish > 0.5 && !b.water) {
    // walking into a one-block step hops up it
    const ax = b.x + Math.sign(wx) * (b.r + 0.2) * (Math.abs(wx) / wish), az = b.z + Math.sign(wz) * (b.r + 0.2) * (Math.abs(wz) / wish);
    const t = solidTop(w, Math.floor(ax), Math.floor(b.y), Math.floor(az), doors);
    const top = Math.floor(b.y) + t;
    if (t && top - b.y <= 1.05 && boxFree(w, b.x - b.r, top, b.z - b.r, b.x + b.r, top + b.h, b.z + b.r, doors) && boxFree(w, ax - b.r * 0.5, top, az - b.r * 0.5, ax + b.r * 0.5, top + b.h, az + b.r * 0.5, doors)) b.vy = JUMP;
  }
  b.walked += Math.hypot(b.x - ox, b.z - oz) * (b.ground ? 1 : 0.3);
  // the valley's edges
  b.x = Math.max(0.4, Math.min(W - 0.4, b.x)); b.z = Math.max(0.4, Math.min(D - 0.4, b.z));
  if (b.y < -4) b.y = H;
  return hx || hz;
}

// ---------------------------------------------------------------- paths
/** A cell a chinchilla can stand in: room for a body, something solid underfoot. */
export function standable(w: World, x: number, y: number, z: number) {
  if (!inside(x, y, z) || y < 1) return false;
  if (solidTop(w, x, y, z, false)) return false;
  const below = w.get(x, y - 1, z), d = BLOCKS[below];
  return (d.solid && d.height >= 0.9) || !!d.climb || below === WATER;
}
/** Shortest walk between two cells (one-block hops up, drops of up to five), or null. */
export function findPath(w: World, from: Spot, to: Spot, maxNodes = 30000, near = 0): Spot[] | null {
  const k = (x: number, y: number, z: number) => idx(x, y, z);
  const s = { x: Math.floor(from.x), y: Math.floor(from.y), z: Math.floor(from.z) };
  const prev = new Map<number, number>(); prev.set(k(s.x, s.y, s.z), -1);
  const q = [s]; let goal = -1;
  for (let h = 0; h < q.length && prev.size < maxNodes; h++) {
    const c = q[h];
    if ((c.x === to.x && c.y === to.y && c.z === to.z) || (near && Math.abs(c.x - to.x) + Math.abs(c.z - to.z) <= near && Math.abs(c.y - to.y) <= 1)) { goal = k(c.x, c.y, c.z); break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, nz = c.z + dz;
      const swim = w.get(c.x, c.y, c.z) === WATER || w.get(c.x, c.y - 1, c.z) === WATER;
      for (const dy of swim ? [0, 1, 2, -1, -2, -3, -4, -5] : [0, 1, -1, -2, -3, -4, -5]) {
        const ny = c.y + dy;
        if (dy >= 1 && solidTop(w, c.x, c.y + 1, c.z, false)) continue;
        if (dy === 2 && solidTop(w, c.x, c.y + 2, c.z, false)) continue;
        if (!standable(w, nx, ny, nz)) { if (dy < 0 && solidTop(w, nx, c.y, nz, false)) break; continue; }
        if (dy < 0) { let ok = true; for (let y = c.y; y > ny; y--) if (solidTop(w, nx, y, nz, false)) ok = false; if (!ok) continue; }
        const kk = k(nx, ny, nz); if (prev.has(kk)) break;
        prev.set(kk, k(c.x, c.y, c.z)); q.push({ x: nx, y: ny, z: nz }); break;
      }
    }
    // ladders lead straight up
    if (BLOCKS[w.get(c.x, c.y, c.z)].climb || BLOCKS[w.get(c.x, c.y + 1, c.z)].climb) {
      const ny = c.y + 1; if (!solidTop(w, c.x, ny, c.z, false) && inside(c.x, ny, c.z)) { const kk = k(c.x, ny, c.z); if (!prev.has(kk)) { prev.set(kk, k(c.x, c.y, c.z)); q.push({ x: c.x, y: ny, z: c.z }); } }
    }
  }
  if (goal < 0) return null;
  const out: Spot[] = [];
  for (let c = goal; c >= 0; c = prev.get(c)!) out.push({ x: c % W, y: Math.floor(c / (W * D)), z: Math.floor(c / W) % D });
  return out.reverse();
}

// ---------------------------------------------------------------- the game
export interface Input { fwd: number; side: number; jump: boolean; down: boolean; yaw: number; pitch: number }
export const NO_INPUT: Input = { fwd: 0, side: 0, jump: false, down: false, yaw: 0, pitch: 0 };
export type EvType =
  | 'dig' | 'chip' | 'place' | 'pickup' | 'learn' | 'weave' | 'quest' | 'arrive' | 'movein' | 'fair' | 'catch' | 'knock' | 'leaf' | 'grow'
  | 'splash' | 'jump' | 'land' | 'step' | 'hurt' | 'ko' | 'hit' | 'defeat' | 'snort' | 'thud' | 'snuff' | 'relight' | 'steal' | 'lunge'
  | 'swoop' | 'poof' | 'spawn' | 'sleep' | 'dusk' | 'dawn' | 'fling' | 'say' | 'swing';
export interface Ev { t: EvType; x?: number; y?: number; z?: number; b?: number; key?: string; n?: number; who?: string; kind?: CritterKind; id?: number; text?: string }
export interface Critter {
  id: number; kind: CritterKind; body: Body; hp: number; st: string; t: number; cd: number; hurt: number;
  home: Spot; tx: number; ty: number; tz: number; dirx: number; dirz: number; loot: Record<string, number> | null; seed: number;
}
export interface Pickup { id: number; x: number; y: number; z: number; vy: number; items: Record<string, number>; t: number }
export interface Shot { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number }
export interface Npc { who: NeighbourId; body: Body; st: 'visit' | 'walk' | 'home' | 'fair'; path: Spot[] | null; pi: number; t: number; home: Spot | null; wait: number }
export interface Moved { who: NeighbourId; bed: Spot; home: Spot; cells: number[] }
export interface Quest { i: number; step: number; count: number }
export interface Stats { dug: number; placed: number; woven: number; defeated: number; kos: number; caught: number }

export function phaseOf(time: number) { return (((time / DAY) % 1) + 1) % 1; }
export const isNightPhase = (p: number) => p >= 0.68 && p < 0.95;
/** How bright the sky is, 0 (deep night) to 1 (noon). */
export function daylight(p: number) {
  if (p < 0.55) return 1;
  if (p < 0.68) return 1 - ((p - 0.55) / 0.13) * 0.85;
  if (p < 0.95) return 0.15;
  return 0.15 + ((p - 0.95) / 0.05) * 0.85;
}

export interface NewOpts { mode?: Mode; cosy?: boolean; name?: string }
export class CubbyGame {
  mode: Mode; cosy: boolean; seed: number; name: string;
  valley: Valley; world: World; rng: Rng;
  time = DAY * 0.1; elapsed = 0;
  players: Body[]; who = 0; hp = MAX_HP; hurtT = 0; calm = 0; respawn: Spot;
  inv: Record<string, number> = {}; hot: (string | null)[] = Array(9).fill(null); sel = 0;
  known = new Set<string>(START_RECIPES);
  quest: Quest = { i: 0, step: 0, count: 0 };
  moved: Moved[] = [];
  leavesTaken: boolean[];
  saplings: { x: number; y: number; z: number; t: number }[] = [];
  pickups: Pickup[] = []; critters: Critter[] = []; shots: Shot[] = []; npcs: Npc[] = [];
  fair: { t: number } | null = null; ended = false;
  events: Ev[] = [];
  digging: { x: number; y: number; z: number; t: number; need: number } | null = null;
  stats: Stats = { dug: 0, placed: 0, woven: 0, defeated: 0, kos: 0, caught: 0 };
  swingCd = 0; spawnT = 0; nextId = 1; arriveT = 0; wasNight = false; tipT = 0;
  safe = new Set<number>();
  crystals: Spot[] = [];

  constructor(seed: number, o: NewOpts = {}, valley?: Valley) {
    this.seed = seed >>> 0; this.mode = o.mode ?? 'story'; this.cosy = this.mode === 'creative' || !!o.cosy; this.name = o.name ?? 'Cubby Valley';
    this.valley = valley ?? generate(this.seed);
    this.world = new World(this.valley);
    this.rng = new Rng(this.seed ^ 0xc0b);
    const s = this.valley.start;
    this.players = [makeBody(s.x + 0.5, s.y, s.z + 0.5), makeBody(s.x - 0.7, s.y, s.z + 1.2)];
    this.players[0].yaw = Math.PI; this.players[1].yaw = Math.PI;
    this.respawn = { ...this.valley.homeBed };
    this.leavesTaken = this.valley.leaves.map(() => false);
    for (let y = 1; y < 20; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (this.valley.blocks[idx(x, y, z)] === CRYSTAL) this.crystals.push({ x, y, z });
    if (this.mode === 'creative') {
      PALETTE.slice(0, 9).forEach((k, i) => (this.hot[i] = k));
      ['planks', 'glass', 'lantern', 'door', 'brick', 'chalk_tile', 'rose_tile', 'sky_tile', 'haybale'].forEach((k, i) => (this.hot[i] = k));
      this.players[0].fly = false;
    } else {
      this.give('bonk', 1); this.give('lantern', 2);
      this.hot = ['bonk', 'lantern', null, null, null, null, null, null, null];
      this.npcs.push(this.visitor(NEIGHBOURS[0].id));
    }
    this.safeFromBurrow(this.valley.homeBed);
  }

  get me() { return this.players[this.who]; }
  get phase() { return phaseOf(this.time); }
  get night() { return isNightPhase(this.phase); }
  get creative() { return this.mode === 'creative'; }
  get neighbour() { return this.mode === 'story' && this.quest.i < NEIGHBOURS.length ? NEIGHBOURS[this.quest.i] : null; }
  get stepNow(): Step | null { const n = this.neighbour; return n ? n.steps[this.quest.step] ?? null : null; }
  /** What a step or recipe needs in this valley (Cosy nights swaps out the monster drops). */
  needs(ins: Record<string, number>) { return cosyIns(ins, this.cosy && this.mode === 'story'); }
  emit(e: Ev) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }

  // ---- the bag
  count(k: string) { return this.creative ? 999 : this.inv[k] ?? 0; }
  give(k: string, n: number) {
    if (!ITEMS[k] || n <= 0) return;
    this.inv[k] = (this.inv[k] ?? 0) + n;
    if (!this.hot.includes(k) && (ITEMS[k].block !== null || ITEMS[k].tool)) { const e = this.hot.indexOf(null); if (e >= 0) this.hot[e] = k; }
  }
  take(k: string, n: number) {
    if (this.creative) return true;
    if ((this.inv[k] ?? 0) < n) return false;
    this.inv[k] -= n; if (this.inv[k] <= 0) delete this.inv[k];
    return true;
  }
  get held() { const k = this.hot[this.sel]; return k && this.count(k) > 0 ? k : null; }

  // ---- looking and digging
  eye(b = this.me) { return { x: b.x, y: b.y + BODY.eye, z: b.z }; }
  lookDir(b = this.me) { const c = Math.cos(b.pitch); return { x: -Math.sin(b.yaw) * c, y: Math.sin(b.pitch), z: -Math.cos(b.yaw) * c }; }
  aim(): Hit | null { const e = this.eye(), d = this.lookDir(); return this.world.raycast(e.x, e.y, e.z, d.x, d.y, d.z, REACH); }
  /** Turns to look at the middle of a block (used by the bot and the tests). */
  lookAt(x: number, y: number, z: number) {
    const e = this.eye(), dx = x - e.x, dy = y - e.y, dz = z - e.z;
    this.me.yaw = Math.atan2(-dx, -dz); this.me.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  digTime(b: number) {
    const d = BLOCKS[b]; if (d.hard < 0) return -1;
    if (this.creative) return 0;
    return this.count('trowel') > 0 ? d.fast : d.hard;
  }
  /** Digs at what the player looks at while `held`; returns 0–1 progress (1 = dug this tick), or -1 if nothing. */
  dig(dt: number, held: boolean) {
    if (!held) { this.digging = null; return -1; }
    const h = this.aim(); if (!h) { this.digging = null; return -1; }
    const need = this.digTime(h.b); if (need < 0) { this.digging = null; return -1; }
    const g = this.digging;
    if (!g || g.x !== h.x || g.y !== h.y || g.z !== h.z) this.digging = { x: h.x, y: h.y, z: h.z, t: 0, need };
    const d = this.digging!;
    const before = Math.floor((d.t / Math.max(0.01, d.need)) * 4);
    d.t += dt;
    if (d.t >= d.need) { this.breakBlock(h.x, h.y, h.z); this.digging = null; return 1; }
    if (Math.floor((d.t / d.need) * 4) > before) this.emit({ t: 'chip', x: h.x, y: h.y, z: h.z, b: h.b });
    return d.t / d.need;
  }
  /** Breaks a block at once if it is in reach and in sight (for the bot); returns whether it went. */
  digAt(x: number, y: number, z: number) {
    this.lookAt(x + 0.5, y + 0.5, z + 0.5);
    const h = this.aim(); if (!h || h.x !== x || h.y !== y || h.z !== z) return false;
    const need = this.digTime(h.b); if (need < 0) return false;
    this.breakBlock(x, y, z); return true;
  }
  breakBlock(x: number, y: number, z: number) {
    const w = this.world, b = w.get(x, y, z), d = BLOCKS[b];
    if (b === AIR || d.hard < 0) return;
    w.set(x, y, z, AIR);
    if (!this.creative) {
      for (const [k, n] of dropsOf(b)) this.give(k, n);
      if (b === LEAVES && hash3(this.seed + 71, x, y, z) < 0.3) this.give('sapling', 1);
      if (b === GRASS && hash3(this.seed + 72, x, y, z) < 0.5) this.give('hay', 1);
    }
    this.stats.dug++;
    this.emit({ t: 'dig', x, y, z, b });
    this.saplings = this.saplings.filter((s) => s.x !== x || s.y !== y || s.z !== z);
    // a plant on top goes with the block under it; sand above falls; water flows in from the side
    const up = w.get(x, y + 1, z);
    if (BLOCKS[up].shape === 'cross' || BLOCKS[up].id === LANTERN || BLOCKS[up].id === LANTERN_OUT) this.breakBlock(x, y + 1, z);
    this.settle(x, y + 1, z);
    if ([w.get(x + 1, y, z), w.get(x - 1, y, z), w.get(x, y, z + 1), w.get(x, y, z - 1), w.get(x, y + 1, z)].includes(WATER)) this.flow(x, y, z);
  }
  /** Sand drops into the space below it, one cell at a time, all the way down. */
  settle(x: number, y: number, z: number) {
    const w = this.world;
    for (let k = 0; k < H && w.get(x, y, z) === SAND; k++) {
      let by = y; while (by > 0 && (w.get(x, by - 1, z) === AIR || w.get(x, by - 1, z) === WATER || BLOCKS[w.get(x, by - 1, z)].shape === 'cross')) by--;
      if (by === y) break;
      w.set(x, y, z, AIR, 0, false); w.set(x, by, z, SAND, 0, false);
      w.relight(x - 15, x + 15, z - 15, z + 15);
      y++;
    }
  }
  /** Water pours into a dug hole from beside or above it, and runs down to the floor. */
  flow(x: number, y: number, z: number) {
    const w = this.world;
    if (w.get(x, y, z) !== AIR || y > 13) return;
    let n = 0;
    w.set(x, y, z, WATER, 0, false);
    while (n++ < 12 && y > 1 && w.get(x, y - 1, z) === AIR) { y--; w.set(x, y, z, WATER, 0, false); }
    w.relight(x - 15, x + 15, z - 15, z + 15);
    this.emit({ t: 'splash', x, y, z });
  }

  // ---- placing
  /** Where the held block would go (the cell in front of the face the player looks at), or null. */
  placeSpot(): (Spot & { face: number }) | null {
    const k = this.held; if (!k) return null;
    const b = blockOf(k); if (b === null) return null;
    const h = this.aim(); if (!h) return null;
    const hd = BLOCKS[h.b];
    let x = h.x + h.nx, y = h.y + h.ny, z = h.z + h.nz;
    if (hd.shape === 'cross' && h.b !== SAPLING) { x = h.x; y = h.y; z = h.z; }
    return this.canPlace(b, x, y, z) ? { x, y, z, face: this.faceFor() } : null;
  }
  faceFor() { const a = ((this.me.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.round(a / (Math.PI / 2)) & 3; }
  canPlace(b: number, x: number, y: number, z: number) {
    const w = this.world;
    if (!inside(x, y, z) || y >= H - 1) return false;
    const cur = w.get(x, y, z);
    if (cur !== AIR && cur !== WATER && BLOCKS[cur].shape !== 'cross') return false;
    const d = BLOCKS[b];
    if (d.shape === 'cross' || d.shape === 'prop') { const below = BLOCKS[w.get(x, y - 1, z)]; if (!below.solid && !d.facing && b !== LANTERN) return false; }
    if (b === SAPLING && ![TURF, SOIL].includes(w.get(x, y - 1, z))) return false;
    if (d.solid) {
      // the friend following along steps out of the way, so only the player, neighbours and creatures block a block
      for (const p of [this.me, ...this.npcs.map((n) => n.body), ...this.critters.map((c) => c.body)]) {
        if (p.x + p.r > x && p.x - p.r < x + 1 && p.z + p.r > z && p.z - p.r < z + 1 && p.y + p.h > y && p.y < y + d.height) return false;
      }
    }
    return true;
  }
  place() {
    const s = this.placeSpot(), k = this.held; if (!s || !k) return false;
    return this.placeAt(k, s.x, s.y, s.z, s.face);
  }
  placeAt(k: string, x: number, y: number, z: number, face = this.faceFor()) {
    const b = blockOf(k); if (b === null || !this.canPlace(b, x, y, z) || this.count(k) < 1) return false;
    this.take(k, 1);
    this.world.set(x, y, z, b, face);
    this.stats.placed++;
    this.emit({ t: 'place', x, y, z, b });
    if (b === SAND) this.settle(x, y, z);
    if (b === SAPLING) { this.saplings.push({ x, y, z, t: this.time + 90 }); this.counted('plant'); }
    if (b === LANTERN && this.openSky(x, y, z)) this.counted('lantern');
    return true;
  }
  openSky(x: number, y: number, z: number) { for (let Y = y + 1; Y < H; Y++) if (BLOCKS[this.world.get(x, Y, z)].dark || this.world.get(x, Y, z) === LEAVES) return false; return true; }

  // ---- the Burrow Workbench
  nearBench(r = 4.5) {
    if (this.creative) return true;
    const b = this.me, x0 = Math.floor(b.x), y0 = Math.floor(b.y), z0 = Math.floor(b.z), R = Math.ceil(r);
    for (let y = y0 - 2; y <= y0 + 2; y++) for (let z = z0 - R; z <= z0 + R; z++) for (let x = x0 - R; x <= x0 + R; x++) if (this.world.get(x, y, z) === BENCH_WORK && Math.hypot(x + 0.5 - b.x, z + 0.5 - b.z) <= r) return true;
    return false;
  }
  ins(r: Recipe) { return this.needs(r.ins); }
  canWeave(id: string, times = 1) {
    const r = RECIPE[id]; if (!r || !this.known.has(id)) return false;
    return Object.entries(this.ins(r)).every(([k, n]) => this.count(k) >= n * times);
  }
  weave(id: string, times = 1) {
    if (!this.nearBench() || !this.canWeave(id, times)) return false;
    const r = RECIPE[id];
    for (const [k, n] of Object.entries(this.ins(r))) this.take(k, n * times);
    this.give(r.out, r.n * times); this.stats.woven += times;
    this.emit({ t: 'weave', key: r.out, n: r.n * times });
    return true;
  }
  /** The recipe a pattern on the loom's threads makes (known or not), or null. */
  matchLoom(threads: { key: string; n: number }[]) {
    const pat: Record<string, number> = {};
    for (const t of threads) if (t.key && t.n > 0) pat[t.key] = (pat[t.key] ?? 0) + t.n;
    const keys = Object.keys(pat).sort();
    for (const r of RECIPES) {
      const ins = this.ins(r), rk = Object.keys(ins).sort();
      if (rk.length !== keys.length || rk.some((k, i) => k !== keys[i])) continue;
      const times = pat[rk[0]] / ins[rk[0]];
      if (!Number.isInteger(times) || times < 1) continue;
      if (rk.every((k) => pat[k] === ins[k] * times)) return { recipe: r, times, known: this.known.has(r.id) };
    }
    return null;
  }
  learn(id: string) {
    if (this.known.has(id) || !RECIPE[id]) return false;
    this.known.add(id); this.emit({ t: 'learn', key: id }); return true;
  }

  // ---- neighbours
  visitor(who: NeighbourId): Npc {
    const s = this.valley.stump, b = makeBody(s.x + 1.5, s.y, s.z + 1.5);
    return { who, body: b, st: 'visit', path: null, pi: 0, t: 0, home: null, wait: 0 };
  }
  get visiting() { return this.npcs.find((n) => n.st === 'visit') ?? null; }
  nearVisitor(r = 3.2) { const v = this.visiting; if (!v) return null; const b = this.me; return Math.hypot(v.body.x - b.x, v.body.z - b.z) <= r && Math.abs(v.body.y - b.y) < 2 ? v : null; }
  counted(what: 'catch' | 'plant' | 'lantern') {
    const s = this.stepNow; if (!s || s.kind !== 'count' || s.what !== what) return;
    this.quest.count = Math.min(s.n, this.quest.count + 1);
    this.emit({ t: 'quest', who: this.neighbour!.id, n: this.quest.count });
  }
  /** Can the current errand be handed in now? */
  ready() {
    const s = this.stepNow; if (!s) return false;
    if (s.kind === 'bring') return Object.entries(this.needs(s.items)).every(([k, n]) => this.count(k) >= n);
    if (s.kind === 'count') return this.quest.count >= s.n;
    return false;
  }
  /** Hands in the current errand (bring or count); teaches its recipes. */
  handIn() {
    const s = this.stepNow, n = this.neighbour; if (!s || !n || !this.ready() || !this.nearVisitor()) return false;
    if (s.kind === 'bring') for (const [k, c] of Object.entries(this.needs(s.items))) this.take(k, c);
    if (s.kind !== 'burrow') for (const r of s.learn) this.learn(r);
    this.quest.step++; this.quest.count = 0;
    this.emit({ t: 'quest', who: n.id, n: this.quest.step });
    return true;
  }
  claimedIn(r: BurrowReport) {
    const beds = [this.valley.homeBed, ...this.moved.map((m) => m.bed)];
    return beds.some((b) => r.cells.includes(idx(b.x, b.y, b.z)));
  }
  /** Checks the burrow the player stands in, against what the waiting neighbour needs. */
  checkHere() {
    const b = this.me, r = checkBurrow(this.world, b.x, b.y + 0.3, b.z);
    const n = this.neighbour, s = this.stepNow;
    const want = n ? n.item : null;
    const taken = r.enclosed && this.claimedIn(r);
    const item = !!want && r.has.includes(want);
    const ok = r.enclosed && r.size >= 4 && r.door && r.light && r.bed && !taken && item && s?.kind === 'burrow';
    let reason = r.reason;
    if (!reason && taken) reason = 'Someone already lives here. Every neighbour needs a burrow of their own.';
    if (!reason && want && !item) reason = `${n!.name} needs a ${ITEMS[want].name.toLowerCase()} inside.`;
    if (!reason && s?.kind !== 'burrow') reason = n ? `A fine burrow! ${n.name} still has an errand for you first.` : 'A fine burrow!';
    return { report: r, taken, item, want, ok, reason };
  }
  moveIn() {
    const c = this.checkHere(); if (!c.ok) return false;
    const n = this.neighbour!, r = c.report;
    const floor = r.cells.map((i) => ({ x: i % W, y: Math.floor(i / (W * D)), z: Math.floor(i / W) % D })).filter((s) => standable(this.world, s.x, s.y, s.z));
    const door = r.doorAt!;
    floor.sort((a, b) => Math.hypot(a.x - door.x, a.z - door.z) - Math.hypot(b.x - door.x, b.z - door.z));
    const home = floor[0] ?? { x: Math.floor(this.me.x), y: Math.floor(this.me.y), z: Math.floor(this.me.z) };
    this.moved.push({ who: n.id, bed: r.bedAt!, home, cells: r.cells });
    for (const i of r.cells) this.safe.add(i);
    const v = this.visiting;
    if (v) {
      v.st = 'walk'; v.home = home;
      v.path = findPath(this.world, { x: Math.floor(v.body.x), y: Math.floor(v.body.y + 0.2), z: Math.floor(v.body.z) }, home, 40000);
      v.pi = 0; v.t = 0;
    }
    this.emit({ t: 'movein', who: n.id });
    this.quest = { i: this.quest.i + 1, step: 0, count: 0 };
    if (this.quest.i >= NEIGHBOURS.length) this.startFair();
    else this.arriveT = 6;
    return true;
  }
  safeFromBurrow(bed: Spot) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
      const r = checkBurrow(this.world, bed.x + dx + 0.5, bed.y + 0.5, bed.z + dz + 0.5);
      if (r.enclosed) { for (const i of r.cells) this.safe.add(i); return r; }
    }
    return null;
  }
  startFair() {
    this.fair = { t: 0 };
    this.time = Math.floor(this.time / DAY) * DAY + DAY * 0.6;
    this.critters = this.critters.filter((c) => c.kind === 'gnasher');
    const s = this.valley.stump, ring = [...this.npcs];
    ring.forEach((n, i) => {
      const a = (i / ring.length) * Math.PI * 2;
      n.st = 'fair'; n.path = null; n.body.x = s.x + 0.5 + Math.cos(a) * 3.2; n.body.z = s.z + 0.5 + Math.sin(a) * 3.2;
      n.body.y = this.groundAt(n.body.x, n.body.z, s.y + 2); n.body.yaw = Math.atan2(n.body.x - s.x - 0.5, n.body.z - s.z - 0.5);
    });
    this.emit({ t: 'fair' });
  }
  groundAt(x: number, z: number, from: number) {
    const X = Math.floor(x), Z = Math.floor(z);
    for (let y = Math.min(H - 2, Math.floor(from) + 3); y > 0; y--) if (solidTop(this.world, X, y - 1, Z, false) && !solidTop(this.world, X, y, Z, false)) return y - 1 + solidTop(this.world, X, y - 1, Z, false);
    return from;
  }

  // ---- using things
  /** The "use" key: talk to a visitor, relight a lantern, sleep in a bed, open the workbench. */
  use(): 'talk' | 'relight' | 'sleep' | 'nosleep' | 'notnight' | 'loom' | null {
    if (this.nearVisitor()) return 'talk';
    const h = this.aim();
    if (h && h.b === LANTERN_OUT) { this.world.set(h.x, h.y, h.z, LANTERN); this.emit({ t: 'relight', x: h.x, y: h.y, z: h.z }); return 'relight'; }
    if (h && h.b === BED) return this.sleep({ x: h.x, y: h.y, z: h.z });
    if (h && h.b === BENCH_WORK) return 'loom';
    if (this.nearBench()) return 'loom';
    return null;
  }
  sleep(bed: Spot) {
    if (this.phase < 0.6) return 'notnight';
    if (this.critters.some((c) => CRITTERS[c.kind].hostile && Math.hypot(c.body.x - this.me.x, c.body.z - this.me.z) < 10)) return 'nosleep';
    this.time = (Math.floor(this.time / DAY) + 1) * DAY + DAY * 0.02;
    this.respawn = { ...bed };
    this.leaveAtDawn();
    this.hp = MAX_HP;
    this.emit({ t: 'sleep' });
    return 'sleep';
  }

  // ---- hearts and bonks
  hurt(n: number, fx: number, fz: number) {
    if (this.creative || this.hurtT > 0 || this.fair) return false;
    const b = this.me, dx = b.x - fx, dz = b.z - fz, l = Math.hypot(dx, dz) || 1;
    this.hp = Math.max(0, this.hp - n); this.hurtT = 0.9; this.calm = 0;
    b.vx = (dx / l) * 7; b.vz = (dz / l) * 7; b.vy = 5;
    this.emit({ t: 'hurt', n, x: b.x, y: b.y, z: b.z });
    if (this.hp <= 0) this.knockOut();
    return true;
  }
  /** Knocked out: half of each stack (not the tools) drops where you fell, and you wake in your bed. */
  knockOut() {
    const b = this.me, items: Record<string, number> = {};
    for (const [k, n] of Object.entries(this.inv)) { if (ITEMS[k]?.tool) continue; const d = Math.floor(n / 2); if (d > 0) { items[k] = d; this.take(k, d); } }
    if (Object.keys(items).length) this.drop(b.x, b.y + 0.5, b.z, items);
    this.stats.kos++;
    this.emit({ t: 'ko', x: b.x, y: b.y, z: b.z });
    const r = this.respawn;
    const spot = this.besideBed(r);
    for (const p of this.players) { p.x = spot.x + 0.5; p.y = spot.y; p.z = spot.z + 0.5; p.vx = p.vy = p.vz = 0; }
    this.hp = MAX_HP; this.hurtT = 2;
    for (const c of this.critters) if (CRITTERS[c.kind].hostile) { c.st = 'roam'; c.cd = 4; }
  }
  besideBed(r: Spot) {
    for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) if (standable(this.world, r.x + dx, r.y, r.z + dz)) return { x: r.x + dx, y: r.y, z: r.z + dz };
    return { x: r.x, y: r.y + 1, z: r.z };
  }
  drop(x: number, y: number, z: number, items: Record<string, number>) {
    this.pickups.push({ id: this.nextId++, x, y, z, vy: 2, items: { ...items }, t: 0 });
  }
  /** A swing of the held tool (or a paw) at the creature in front; the slingshot flings a pebble. Returns whether it did anything. */
  swing() {
    if (this.swingCd > 0) return false;
    const b = this.me, held = this.held;
    if (held === 'slingshot') {
      if (!this.creative && !this.take('pebbles', 1)) return false;
      const e = this.eye(), d = this.lookDir();
      this.shots.push({ x: e.x, y: e.y - 0.1, z: e.z, vx: d.x * 22, vy: d.y * 22 + 1.5, vz: d.z * 22, t: 0 });
      this.swingCd = 0.55; this.emit({ t: 'fling' });
      return true;
    }
    const reach = held === 'bonk' ? 2.7 : 2.0, dmg = held === 'bonk' ? 2 : 1;
    const f = this.lookDir(); const fl = Math.hypot(f.x, f.z) || 1;
    let best: Critter | null = null, bd = 99;
    for (const c of this.critters) {
      const dx = c.body.x - b.x, dz = c.body.z - b.z, dy = c.body.y + c.body.h / 2 - (b.y + BODY.eye), dist = Math.hypot(dx, dz);
      if (dist > reach + c.body.r || Math.abs(dy) > 1.8) continue;
      if (dist > 0.6 && (dx * f.x + dz * f.z) / (dist * fl) < 0.45) continue;
      if (dist < bd) { bd = dist; best = c; }
    }
    this.swingCd = held === 'bonk' ? 0.42 : 0.6;
    this.emit({ t: 'swing', key: held ?? 'paw' });
    if (!best) return false;
    this.hitCritter(best, dmg, b.x, b.z, held === 'bonk' ? 9 : 5);
    return true;
  }
  hitCritter(c: Critter, dmg: number, fx: number, fz: number, push: number) {
    if (c.kind === 'bunny') { this.catchBunny(c); return; }
    if (c.hurt > 0) return;
    const dx = c.body.x - fx, dz = c.body.z - fz, l = Math.hypot(dx, dz) || 1;
    c.hp -= dmg; c.hurt = 0.3;
    c.body.vx = (dx / l) * push; c.body.vz = (dz / l) * push; c.body.vy = c.kind === 'moth' ? 2 : 4.5;
    if (c.st === 'charge' || c.st === 'windup' || c.st === 'lunge') { c.st = 'stun'; c.t = 1.1; }
    this.emit({ t: 'hit', id: c.id, kind: c.kind, x: c.body.x, y: c.body.y, z: c.body.z });
    if (c.hp <= 0) this.defeat(c);
  }
  defeat(c: Critter) {
    const items: Record<string, number> = { ...CRITTERS[c.kind].drops };
    if (c.loot) for (const [k, n] of Object.entries(c.loot)) items[k] = (items[k] ?? 0) + n;
    this.drop(c.body.x, c.body.y + 0.4, c.body.z, items);
    this.critters = this.critters.filter((x) => x !== c);
    this.stats.defeated++;
    this.emit({ t: 'defeat', kind: c.kind, x: c.body.x, y: c.body.y, z: c.body.z });
  }
  catchBunny(c: Critter) {
    this.critters = this.critters.filter((x) => x !== c);
    if (!this.creative) this.give('fluff', 2);
    this.stats.caught++; this.counted('catch');
    this.emit({ t: 'catch', x: c.body.x, y: c.body.y, z: c.body.z });
  }

  // ---- the world ticking
  /** Advances the game by dt seconds with the player's input. */
  step(dt: number, input: Input = NO_INPUT) {
    dt = Math.min(dt, 0.25);
    const n = Math.max(1, Math.ceil(dt / (1 / 30))), h = dt / n;
    for (let i = 0; i < n; i++) this.tick(h, input);
  }
  tick(dt: number, inp: Input) {
    if (!this.fair) this.time += dt;
    else this.fair.t += dt;
    this.elapsed += dt;
    const me = this.me;
    me.yaw = inp.yaw; me.pitch = Math.max(-1.5, Math.min(1.5, inp.pitch));
    const sp = me.fly ? FLY : WALK;
    const s = Math.sin(me.yaw), c = Math.cos(me.yaw);
    let wx = (-s * inp.fwd + c * inp.side) * sp, wz = (-c * inp.fwd - s * inp.side) * sp;
    const wl = Math.hypot(wx, wz); if (wl > sp) { wx *= sp / wl; wz *= sp / wl; }
    if (this.fair) { wx = 0; wz = 0; }
    const wasGround = me.ground, step0 = Math.floor(me.walked / 1.6), vy0 = me.vy;
    if (this.hurtT > 0.6) { wx = me.vx; wz = me.vz; }
    moveBody(this.world, me, wx, wz, inp.jump, inp.down, dt, { auto: true });
    if (inp.jump && wasGround && me.vy > 5) this.emit({ t: 'jump' });
    if (!wasGround && me.ground && vy0 < -7) this.emit({ t: 'land', n: -vy0 });
    if (Math.floor(me.walked / 1.6) > step0 && me.ground) this.emit({ t: 'step', b: this.world.get(Math.floor(me.x), Math.floor(me.y - 0.5), Math.floor(me.z)) });
    this.follow(dt);
    if (this.hurtT > 0) this.hurtT -= dt;
    this.swingCd = Math.max(0, this.swingCd - dt);
    this.calm += dt;
    if (this.hp < MAX_HP && this.calm > 6) { this.hp = Math.min(MAX_HP, this.hp + 1); this.calm = 3; }
    // pick-ups and recipe leaves
    for (const p of this.pickups) {
      p.t += dt; p.vy -= 14 * dt; p.y += p.vy * dt;
      const g = this.groundAt(p.x, p.z, p.y + 0.5); if (p.y < g + 0.25) { p.y = g + 0.25; p.vy = 0; }
      if (p.t > 0.5 && Math.hypot(p.x - me.x, p.z - me.z) < 1.3 && Math.abs(p.y - me.y - 0.4) < 1.6) {
        for (const [k, n] of Object.entries(p.items)) this.give(k, n);
        this.emit({ t: 'pickup', x: p.x, y: p.y, z: p.z, key: Object.keys(p.items)[0], n: Object.values(p.items).reduce((a, b) => a + b, 0) });
        p.t = -1;
      }
    }
    this.pickups = this.pickups.filter((p) => p.t >= 0);
    this.valley.leaves.forEach((l, i) => {
      if (this.leavesTaken[i] || this.creative) return;
      if (Math.hypot(l.x + 0.5 - me.x, l.z + 0.5 - me.z) < 1.1 && Math.abs(l.y + 0.3 - me.y - 0.4) < 1.3) {
        this.leavesTaken[i] = true; this.emit({ t: 'leaf', key: l.recipe, x: l.x, y: l.y, z: l.z }); this.learn(l.recipe);
      }
    });
    // saplings grow into birches
    for (const sp of this.saplings) if (this.time >= sp.t) { sp.t = Infinity; this.grow(sp.x, sp.y, sp.z); }
    this.saplings = this.saplings.filter((s) => s.t !== Infinity);
    // the next visitor
    if (this.arriveT > 0) { this.arriveT -= dt; if (this.arriveT <= 0 && this.neighbour) { this.npcs.push(this.visitor(this.neighbour.id)); this.emit({ t: 'arrive', who: this.neighbour.id }); } }
    this.npcTick(dt);
    // day and night
    const night = this.night;
    if (night && !this.wasNight) this.emit({ t: 'dusk' });
    if (!night && this.wasNight) { this.leaveAtDawn(); this.emit({ t: 'dawn' }); }
    this.wasNight = night;
    this.spawnTick(dt);
    for (const cr of [...this.critters]) this.critterTick(cr, dt);
    this.shotTick(dt);
  }
  follow(dt: number) {
    const lead = this.me, f = this.players[1 - this.who];
    const dx = lead.x - f.x, dz = lead.z - f.z, d = Math.hypot(dx, dz);
    const buried = !boxFree(this.world, f.x - f.r, f.y + 0.05, f.z - f.r, f.x + f.r, f.y + f.h, f.z + f.r, false);
    if (d > 14 || Math.abs(lead.y - f.y) > 6 || (lead.fly && d > 6) || buried) {
      const back = { x: lead.x + Math.sin(lead.yaw) * 1.2, z: lead.z + Math.cos(lead.yaw) * 1.2 };
      f.x = back.x; f.z = back.z; f.y = lead.y + 0.2; f.vx = f.vz = f.vy = 0;
      if (!boxFree(this.world, f.x - f.r, f.y, f.z - f.r, f.x + f.r, f.y + f.h, f.z + f.r, false)) { f.x = lead.x; f.z = lead.z; f.y = lead.y; }
      this.emit({ t: 'poof', x: f.x, y: f.y, z: f.z }); return;
    }
    let wx = 0, wz = 0;
    if (d > 1.9) { const sp = Math.min(WALK * 1.1, (d - 1.5) * 3); wx = (dx / d) * sp; wz = (dz / d) * sp; f.yaw = Math.atan2(-dx, -dz); }
    moveBody(this.world, f, wx, wz, lead.water && f.water, false, dt, { auto: true });
  }
  grow(x: number, y: number, z: number) {
    const w = this.world;
    if (w.get(x, y, z) !== SAPLING) return;
    let hgt = 4; while (hgt > 2 && [1, 2, 3, 4, 5].slice(0, hgt + 1).some((k) => w.get(x, y + k, z) !== AIR)) hgt--;
    for (let k = 0; k < hgt; k++) w.set(x, y + k, z, LOG, 0, false);
    const top = y + hgt;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const r = dy === 1 ? 1 : 2; if (Math.abs(dx) > r || Math.abs(dz) > r || (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2)) continue;
      if (w.get(x + dx, top + dy, z + dz) === AIR) w.set(x + dx, top + dy, z + dz, LEAVES, 0, false);
    }
    w.relight(x - 17, x + 17, z - 17, z + 17);
    this.emit({ t: 'grow', x, y, z });
  }
  npcTick(dt: number) {
    for (const n of this.npcs) {
      const b = n.body;
      if (n.st === 'walk') {
        n.t += dt;
        if (!n.path || n.t > 60) { const h = n.home!; b.x = h.x + 0.5; b.y = h.y; b.z = h.z + 0.5; n.st = 'home'; this.emit({ t: 'poof', x: b.x, y: b.y, z: b.z }); continue; }
        const tgt = n.path[Math.min(n.pi + 1, n.path.length - 1)];
        const dx = tgt.x + 0.5 - b.x, dz = tgt.z + 0.5 - b.z, d = Math.hypot(dx, dz);
        const sp = 2.6 * dt;
        if (d <= sp) { b.x = tgt.x + 0.5; b.z = tgt.z + 0.5; b.y = tgt.y; n.pi++; if (n.pi >= n.path.length - 1) { n.st = 'home'; n.wait = 2; } }
        else { b.x += (dx / d) * sp; b.z += (dz / d) * sp; b.y += (tgt.y - b.y) * Math.min(1, dt * 8); b.yaw = Math.atan2(-dx, -dz); b.walked += sp; }
      } else if (n.st === 'visit') {
        const p = this.me, dx = p.x - b.x, dz = p.z - b.z;
        if (Math.hypot(dx, dz) < 8) b.yaw = Math.atan2(-dx, -dz);
        b.y = this.groundAt(b.x, b.z, b.y + 1);
      } else if (n.st === 'home') {
        n.wait -= dt;
        if (n.wait <= 0) { n.wait = 3 + this.rng.next() * 5; b.yaw += (this.rng.next() - 0.5) * 2.4; }
      }
    }
  }
  leaveAtDawn() {
    for (const c of [...this.critters]) {
      if (c.kind === 'gnasher') continue;
      if (c.loot) this.drop(c.body.x, c.body.y + 0.4, c.body.z, c.loot);
      this.emit({ t: 'poof', x: c.body.x, y: c.body.y, z: c.body.z, kind: c.kind });
    }
    this.critters = this.critters.filter((c) => c.kind === 'gnasher');
  }

  // ---- the night's creatures
  monstersOn() { return this.mode === 'story' && !this.cosy && !this.fair; }
  spawnable(x: number, y: number, z: number) {
    const w = this.world;
    return standable(w, x, y, z) && !this.safe.has(idx(x, y, z)) && w.get(x, y, z) !== WATER && w.get(x, y - 1, z) !== WATER;
  }
  /** Whether a creature of this kind may appear at a cell right now (the light rules). */
  canSpawnAt(kind: CritterKind, x: number, y: number, z: number) {
    const w = this.world;
    if (!this.spawnable(x, y, z)) return false;
    const lamp = w.lamp(x, y, z);
    if (kind === 'gnasher') return w.sky(x, y, z) <= 2 && lamp <= 5;
    return this.night && lamp < 4 && this.openSky(x, y, z);
  }
  spawnTick(dt: number) {
    this.spawnT -= dt; if (this.spawnT > 0 || this.creative) return;
    this.spawnT = 2.5;
    const me = this.me, cs = this.critters;
    // anything far away wanders off
    this.critters = cs.filter((c) => Math.hypot(c.body.x - me.x, c.body.z - me.z) < 44);
    const n = (k: CritterKind) => this.critters.filter((c) => c.kind === k).length;
    const want: CritterKind[] = [];
    if (this.night) {
      if (n('bunny') < 4) want.push('bunny');
      if (this.monstersOn()) { if (n('boar') < 2) want.push('boar'); if (n('moth') < 2) want.push('moth'); if (n('grumble') < 1) want.push('grumble'); }
    }
    if (this.monstersOn() && n('gnasher') < 3) want.push('gnasher');
    if (!want.length) return;
    const kind = want[this.rng.int(want.length)];
    if (kind === 'gnasher') {
      const near = this.crystals.filter((c) => Math.hypot(c.x - me.x, c.z - me.z) < 26 && Math.hypot(c.x - me.x, c.z - me.z) > 6);
      if (!near.length) return;
      const c0 = near[this.rng.int(near.length)];
      for (let k = 0; k < 12; k++) {
        const x = c0.x + this.rng.int(7) - 3, z = c0.z + this.rng.int(7) - 3;
        for (let y = c0.y + 2; y >= c0.y - 3; y--) if (this.canSpawnAt('gnasher', x, y, z) && Math.hypot(x - me.x, z - me.z) > 6) { this.spawn('gnasher', x, y, z); return; }
      }
      return;
    }
    for (let k = 0; k < 10; k++) {
      const a = this.rng.next() * Math.PI * 2, r = 12 + this.rng.next() * 14;
      const x = Math.floor(me.x + Math.cos(a) * r), z = Math.floor(me.z + Math.sin(a) * r);
      if (x < 2 || z < 2 || x > W - 3 || z > D - 3) continue;
      const y = Math.round(this.groundAt(x + 0.5, z + 0.5, H - 3));
      if (this.canSpawnAt(kind, x, y, z)) { this.spawn(kind, x, y, z); return; }
    }
  }
  spawn(kind: CritterKind, x: number, y: number, z: number) {
    const size: Record<CritterKind, [number, number]> = { bunny: [0.24, 0.45], boar: [0.38, 0.72], moth: [0.28, 0.4], gnasher: [0.36, 0.62], grumble: [0.26, 0.5] };
    const [r, h] = size[kind];
    const b = makeBody(x + 0.5, y + (kind === 'moth' ? 2 : 0), z + 0.5, r, h);
    const c: Critter = { id: this.nextId++, kind, body: b, hp: CRITTERS[kind].hp, st: kind === 'gnasher' ? 'lurk' : 'roam', t: 0, cd: 1, hurt: 0, home: { x, y, z }, tx: x, ty: y, tz: z, dirx: 0, dirz: 0, loot: null, seed: this.rng.int(1e9) };
    b.yaw = this.rng.next() * Math.PI * 2;
    this.critters.push(c);
    this.emit({ t: 'spawn', kind, id: c.id, x: b.x, y: b.y, z: b.z });
    return c;
  }
  lit(x: number, y: number, z: number) { return this.world.lamp(Math.floor(x), Math.floor(y + 0.3), Math.floor(z)); }
  critterTick(c: Critter, dt: number) {
    const w = this.world, b = c.body, me = this.me, def = CRITTERS[c.kind];
    c.t += dt; c.cd -= dt; if (c.hurt > 0) c.hurt -= dt;
    const dx = me.x - b.x, dz = me.z - b.z, dist = Math.hypot(dx, dz), dy = me.y - b.y;
    const face = (x: number, z: number) => { if (Math.hypot(x, z) > 1e-3) b.yaw = Math.atan2(-x, -z); };
    const meLit = this.lit(me.x, me.y, me.z), here = this.lit(b.x, b.y, b.z);
    let wx = 0, wz = 0, up = false;
    const toward = (x: number, z: number, sp: number) => { const l = Math.hypot(x, z) || 1; wx = (x / l) * sp; wz = (z / l) * sp; face(x, z); };
    const awayFromLight = (sp: number) => {
      let best = [0, 0], bl = here;
      for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2]]) { const l = this.lit(b.x + ox, b.y, b.z + oz); if (l < bl) { bl = l; best = [ox, oz]; } }
      if (best[0] || best[1]) toward(best[0], best[1], sp);
    };
    const wander = (sp: number) => {
      if (c.t > 3 || Math.hypot(c.tx + 0.5 - b.x, c.tz + 0.5 - b.z) < 0.6) { c.t = 0; c.tx = c.home.x + this.rng.int(9) - 4; c.tz = c.home.z + this.rng.int(9) - 4; }
      toward(c.tx + 0.5 - b.x, c.tz + 0.5 - b.z, sp);
    };
    const contact = (pad: number) => dist < b.r + BODY.r + pad && dy > -b.h - 0.2 && dy < b.h + 0.3;
    const knocked = c.hurt > 0;
    switch (c.kind) {
      case 'bunny': {
        if (contact(0.15)) { this.catchBunny(c); return; }
        if (here >= 7) { awayFromLight(def.speed * 1.3); break; }
        if (c.cd <= 0) {
          c.cd = 3; c.st = 'roam';
          const t = this.findKnockable(b.x, b.y, b.z);
          if (t) { c.st = 'knock'; c.tx = t.x; c.ty = t.y; c.tz = t.z; }
        }
        if (c.st === 'knock') {
          const kx = c.tx + 0.5 - b.x, kz = c.tz + 0.5 - b.z;
          if (Math.hypot(kx, kz) < 0.9 && Math.abs(c.ty - b.y) < 1.5) {
            const kb = w.get(c.tx, c.ty, c.tz);
            if (BLOCKS[kb].knock && w.lamp(c.tx, c.ty, c.tz) < 5) {
              w.set(c.tx, c.ty, c.tz, AIR); this.drop(c.tx + 0.5, c.ty + 0.3, c.tz + 0.5, { [BLOCKS[kb].key]: 1 });
              this.emit({ t: 'knock', x: c.tx, y: c.ty, z: c.tz, b: kb });
            }
            c.st = 'roam'; c.cd = 4;
          } else toward(kx, kz, def.speed);
        } else wander(def.speed * 0.6);
        break;
      }
      case 'boar': {
        if (here >= 8 && c.st !== 'charge') { awayFromLight(def.speed * 1.4); c.st = 'roam'; break; }
        if (c.st === 'roam') {
          if (c.cd <= 0 && dist < 11 && Math.abs(dy) < 2.5 && meLit < 7 && this.clearLine(b, me)) { c.st = 'windup'; c.t = 0; face(dx, dz); this.emit({ t: 'snort', id: c.id, x: b.x, y: b.y, z: b.z }); }
          else if (dist < 16) toward(dx, dz, def.speed * 0.5); else wander(def.speed * 0.5);
        } else if (c.st === 'windup') {
          face(dx, dz);
          if (c.t > 0.9) { c.st = 'charge'; c.t = 0; const l = dist || 1; c.dirx = dx / l; c.dirz = dz / l; }
        } else if (c.st === 'charge') {
          wx = c.dirx * 8.5; wz = c.dirz * 8.5; face(c.dirx, c.dirz);
          if (contact(0.25)) { this.hurt(def.damage, b.x, b.z); c.st = 'rest'; c.t = 0; c.cd = 2.2; }
          else if (b.hitWall && c.t > 0.08) { c.st = 'stun'; c.t = 0; this.emit({ t: 'thud', id: c.id, x: b.x, y: b.y, z: b.z }); }
          else if (c.t > 1.5 || this.lit(b.x + c.dirx, b.y, b.z + c.dirz) >= 8) { c.st = 'rest'; c.t = 0; c.cd = 1.2; }
        } else if (c.st === 'stun') { if (c.t > 1.9) { c.st = 'roam'; c.t = 0; c.cd = 1; } }
        else if (c.st === 'rest') { if (c.t > 1.2) { c.st = 'roam'; c.t = 0; } else face(dx, dz); }
        break;
      }
      case 'moth': {
        // a moth flies: it steers through the air toward its target
        const fly = (tx: number, ty: number, tz: number, sp: number) => {
          const ex = tx - b.x, ey = ty - b.y, ez = tz - b.z, l = Math.hypot(ex, ey, ez) || 1;
          const wob = Math.sin(this.elapsed * 7 + c.seed) * 0.8;
          wx = (ex / l) * sp + Math.cos(this.elapsed * 5 + c.seed) * wob; wz = (ez / l) * sp + Math.sin(this.elapsed * 4 + c.seed) * wob;
          b.vy += ((ey / l) * sp + Math.sin(this.elapsed * 6 + c.seed) * 0.6 - b.vy) * Math.min(1, dt * 4);
          face(ex, ez);
        };
        const ground = this.groundAt(b.x, b.z, b.y);
        if (c.st === 'roam') {
          if (c.cd <= 0) {
            c.cd = 2;
            const l = this.findLantern(b.x, b.y, b.z);
            if (l) { c.st = 'seek'; c.tx = l.x; c.ty = l.y; c.tz = l.z; c.t = 0; }
            else if (dist < 9 && meLit < 9 && this.openSky(Math.floor(me.x), Math.floor(me.y), Math.floor(me.z))) { c.st = 'swoop'; c.t = 0; this.emit({ t: 'swoop', id: c.id, x: b.x, y: b.y, z: b.z }); }
          }
          if (c.st === 'roam') { if (c.t > 3) { c.t = 0; c.tx = c.home.x + this.rng.int(11) - 5; c.tz = c.home.z + this.rng.int(11) - 5; } fly(c.tx + 0.5, ground + 2.6, c.tz + 0.5, def.speed * 0.6); }
        } else if (c.st === 'seek' || c.st === 'snuff') {
          if (w.get(c.tx, c.ty, c.tz) !== LANTERN) { c.st = 'roam'; c.cd = 1; break; }
          const near = Math.hypot(c.tx + 0.5 - b.x, c.tz + 0.5 - b.z) < 0.8 && Math.abs(c.ty + 1.1 - b.y) < 0.9;
          fly(c.tx + 0.5, c.ty + 1.1, c.tz + 0.5, near ? 0.6 : def.speed);
          if (near && c.st === 'seek') { c.st = 'snuff'; c.t = 0; }
          if (c.st === 'snuff' && c.t > 2.4) { w.set(c.tx, c.ty, c.tz, LANTERN_OUT); this.emit({ t: 'snuff', x: c.tx, y: c.ty, z: c.tz }); c.st = 'roam'; c.cd = 3; }
          if (c.t > 14) { c.st = 'roam'; c.cd = 2; }
        } else if (c.st === 'swoop') {
          fly(me.x, me.y + 0.5, me.z, 6.5);
          if (Math.hypot(me.x - b.x, me.y + 0.5 - b.y, me.z - b.z) < 0.75) { this.hurt(def.damage, b.x, b.z); c.st = 'climb'; c.t = 0; }
          else if (c.t > 2.5 || meLit >= 9) { c.st = 'climb'; c.t = 0; }
        } else if (c.st === 'climb') {
          fly(b.x - dx, ground + 4, b.z - dz, def.speed);
          if (c.t > 1.6) { c.st = 'roam'; c.t = 0; c.cd = 2.5; }
        } else if (c.st === 'stun') { b.vy -= 4 * dt; if (c.t > 0.9) { c.st = 'roam'; c.t = 0; } }
        if (knocked) { wx = b.vx; wz = b.vz; }
        moveBody(w, b, wx, wz, false, false, dt, { flyer: true, doors: true });
        return;
      }
      case 'gnasher': {
        if (here >= 10) { this.emit({ t: 'poof', x: b.x, y: b.y, z: b.z, kind: 'gnasher' }); this.critters = this.critters.filter((x) => x !== c); return; }
        if (here >= 8) { c.st = 'back'; awayFromLight(def.speed * 1.2); break; }
        if (c.st === 'lurk') {
          if (c.cd <= 0 && dist < 4.5 && Math.abs(dy) < 2 && meLit < 8) { c.st = 'lunge'; c.t = 0; face(dx, dz); b.vy = 6.2; const l = dist || 1; c.dirx = dx / l; c.dirz = dz / l; this.emit({ t: 'lunge', id: c.id, x: b.x, y: b.y, z: b.z }); }
          else if (dist < 8) face(dx, dz);
        } else if (c.st === 'lunge') {
          wx = c.dirx * 6; wz = c.dirz * 6;
          if (contact(0.3)) { this.hurt(def.damage, b.x, b.z); c.st = 'chase'; c.t = 0; c.cd = 1.2; }
          else if (c.t > 0.25 && b.ground) { c.st = 'chase'; c.t = 0; }
        } else if (c.st === 'chase') {
          toward(dx, dz, def.speed);
          if (contact(0.2) && c.cd <= 0) { this.hurt(def.damage, b.x, b.z); c.cd = 1.3; }
          if (dist > 9 || c.t > 6 || meLit >= 8) { c.st = 'back'; c.t = 0; }
        } else if (c.st === 'back' || c.st === 'stun') {
          if (c.st === 'stun' && c.t < 1.1) break;
          const hx = c.home.x + 0.5 - b.x, hz = c.home.z + 0.5 - b.z;
          if (Math.hypot(hx, hz) < 0.7 || c.t > 8) { c.st = 'lurk'; c.t = 0; c.cd = 1.5; } else toward(hx, hz, def.speed * 0.8);
        }
        break;
      }
      case 'grumble': {
        if (here >= 7 && c.st !== 'run') { awayFromLight(def.speed); break; }
        if (c.st === 'roam') {
          if (dist < 12 && meLit < 7 && c.cd <= 0) c.st = 'chase'; else wander(def.speed * 0.4);
        } else if (c.st === 'chase') {
          toward(dx, dz, def.speed);
          if (contact(0.15)) {
            const keys = Object.keys(this.inv).filter((k) => !ITEMS[k]?.tool && this.inv[k] > 0).sort();
            if (keys.length && !this.creative) {
              const k = keys[this.rng.int(keys.length)], nn = Math.min(3, this.inv[k]);
              this.take(k, nn); c.loot = { ...(c.loot ?? {}), [k]: (c.loot?.[k] ?? 0) + nn };
              this.emit({ t: 'steal', key: k, n: nn, x: b.x, y: b.y, z: b.z });
            }
            this.hurt(def.damage, b.x, b.z);
            c.st = 'run'; c.t = 0;
          }
          if (dist > 18 || meLit >= 7) { c.st = 'roam'; c.cd = 2; }
        } else if (c.st === 'run') {
          toward(-dx, -dz, def.speed * 1.15);
          if (c.t > 12) { if (c.loot) this.drop(b.x, b.y + 0.4, b.z, c.loot); this.emit({ t: 'poof', x: b.x, y: b.y, z: b.z, kind: 'grumble' }); this.critters = this.critters.filter((x) => x !== c); return; }
        } else if (c.st === 'stun') { if (c.t > 1) { c.st = c.loot ? 'run' : 'roam'; c.t = 0; } }
        break;
      }
    }
    if (knocked) { wx = b.vx; wz = b.vz; }
    if (c.st === 'stun' || c.st === 'windup') { if (!knocked) { wx = 0; wz = 0; } }
    if (c.kind === 'gnasher' && c.st === 'lurk' && !knocked) { wx = 0; wz = 0; }
    moveBody(w, b, wx, wz, up, false, dt, { doors: true, auto: c.st !== 'charge' && c.st !== 'lunge' });
  }
  clearLine(a: Body, b: Body) {
    const ex = b.x - a.x, ey = b.y - a.y, ez = b.z - a.z, l = Math.hypot(ex, ey, ez);
    for (let s = 0.5; s < l; s += 0.5) { const t = s / l; if (solidTop(this.world, Math.floor(a.x + ex * t), Math.floor(a.y + 0.4 + ey * t), Math.floor(a.z + ez * t), true)) return false; }
    return true;
  }
  findKnockable(x: number, y: number, z: number) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); let best: Spot | null = null, bd = 99;
    for (let yy = Y - 2; yy <= Y + 2; yy++) for (let zz = Z - 8; zz <= Z + 8; zz++) for (let xx = X - 8; xx <= X + 8; xx++) {
      const b = this.world.get(xx, yy, zz); if (!BLOCKS[b].knock || this.world.lamp(xx, yy, zz) >= 5 || this.safe.has(idx(xx, yy, zz))) continue;
      const d = Math.hypot(xx - X, zz - Z); if (d < bd) { bd = d; best = { x: xx, y: yy, z: zz }; }
    }
    return best;
  }
  findLantern(x: number, y: number, z: number) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); let best: Spot | null = null, bd = 99;
    for (let yy = Y - 6; yy <= Y + 3; yy++) for (let zz = Z - 14; zz <= Z + 14; zz++) for (let xx = X - 14; xx <= X + 14; xx++) {
      if (this.world.get(xx, yy, zz) !== LANTERN || !this.openSky(xx, yy, zz)) continue;
      const d = Math.hypot(xx - X, zz - Z); if (d < bd) { bd = d; best = { x: xx, y: yy, z: zz }; }
    }
    return best;
  }
  shotTick(dt: number) {
    for (const s of this.shots) {
      s.t += dt; s.vy -= 14 * dt;
      const steps = 3;
      for (let k = 0; k < steps && s.t >= 0; k++) {
        s.x += (s.vx * dt) / steps; s.y += (s.vy * dt) / steps; s.z += (s.vz * dt) / steps;
        for (const c of this.critters) {
          if (Math.hypot(c.body.x - s.x, c.body.y + c.body.h / 2 - s.y, c.body.z - s.z) < c.body.r + 0.35) { this.hitCritter(c, 2, s.x - s.vx, s.z - s.vz, 6); s.t = -1; break; }
        }
        if (s.t >= 0 && solidTop(this.world, Math.floor(s.x), Math.floor(s.y), Math.floor(s.z), true)) {
          if (this.rng.next() < 0.5 && !this.creative) this.drop(s.x - s.vx * 0.02, s.y + 0.3, s.z - s.vz * 0.02, { pebbles: 1 });
          s.t = -1;
        }
      }
      if (s.t > 2) s.t = -1;
    }
    this.shots = this.shots.filter((s) => s.t >= 0);
  }

  // ---- the save
  toSlot(): SlotData {
    return {
      v: 1, mode: this.mode, cosy: this.cosy, seed: this.seed, name: this.name, time: Math.round(this.time * 10) / 10,
      diff: encodeDiff(this.world.diff), inv: { ...this.inv }, hot: [...this.hot], sel: this.sel, known: [...this.known],
      quest: { ...this.quest }, moved: this.moved.map((m) => ({ who: m.who, bed: m.bed, home: m.home })),
      leaves: this.leavesTaken.map((t, i) => (t ? i : -1)).filter((i) => i >= 0), saplings: this.saplings.map((s) => ({ ...s })),
      pickups: this.pickups.map((p) => ({ x: p.x, y: p.y, z: p.z, items: { ...p.items } })),
      players: this.players.map((p) => ({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, fly: p.fly })), who: this.who, hp: this.hp, respawn: this.respawn,
      fair: !!this.fair || this.ended, ended: this.ended, stats: { ...this.stats }, rng: this.rng.s,
    };
  }
  static fromSlot(s: SlotData): CubbyGame {
    const g = new CubbyGame(s.seed, { mode: s.mode, cosy: s.cosy, name: s.name });
    const diff = decodeDiff(s.diff) ?? new Map();
    for (const [i, v] of diff) { g.world.blocks[i] = v; g.world.diff.set(i, v); }
    if (diff.size) g.world.relight(0, W - 1, 0, D - 1);
    g.time = s.time; g.wasNight = g.night;
    g.inv = {}; for (const [k, n] of Object.entries(s.inv)) if (ITEMS[k] && n > 0) g.inv[k] = Math.floor(n);
    g.hot = s.hot.map((k) => (k && ITEMS[k] ? k : null)); g.sel = s.sel;
    g.known = new Set([...START_RECIPES, ...s.known.filter((k) => RECIPE[k])]);
    g.quest = { ...s.quest }; g.leavesTaken = g.valley.leaves.map((_, i) => s.leaves.includes(i));
    g.saplings = s.saplings.map((p) => ({ ...p }));
    g.pickups = s.pickups.map((p) => ({ id: g.nextId++, x: p.x, y: p.y, z: p.z, vy: 0, items: { ...p.items }, t: 1 }));
    s.players.forEach((p, i) => { const b = g.players[i]; b.x = p.x; b.y = p.y; b.z = p.z; b.yaw = p.yaw; b.fly = p.fly && g.creative; });
    g.who = s.who; g.hp = s.hp; g.respawn = s.respawn; g.stats = { ...g.stats, ...s.stats }; g.rng.s = s.rng >>> 0;
    g.npcs = [];
    g.moved = [];
    for (const m of s.moved) {
      const r = checkBurrow(g.world, m.home.x + 0.5, m.home.y + 0.5, m.home.z + 0.5);
      const cells = r.enclosed ? r.cells : [];
      g.moved.push({ who: m.who, bed: m.bed, home: m.home, cells }); for (const i of cells) g.safe.add(i);
      const b = makeBody(m.home.x + 0.5, m.home.y, m.home.z + 0.5);
      g.npcs.push({ who: m.who, body: b, st: 'home', path: null, pi: 0, t: 0, home: m.home, wait: 1 });
    }
    if (g.mode === 'story' && g.quest.i < NEIGHBOURS.length) g.npcs.push(g.visitor(NEIGHBOURS[g.quest.i].id));
    g.ended = s.ended;
    return g;
  }
}

export interface SlotData {
  v: 1; mode: Mode; cosy: boolean; seed: number; name: string; time: number; diff: string;
  inv: Record<string, number>; hot: (string | null)[]; sel: number; known: string[]; quest: Quest;
  moved: { who: NeighbourId; bed: Spot; home: Spot }[]; leaves: number[]; saplings: { x: number; y: number; z: number; t: number }[];
  pickups: { x: number; y: number; z: number; items: Record<string, number> }[];
  players: { x: number; y: number; z: number; yaw: number; fly: boolean }[]; who: number; hp: number; respawn: Spot;
  fair: boolean; ended: boolean; stats: Stats; rng: number;
}
export interface Settings { sound: boolean; music: boolean; view: 'first' | 'third'; sens: number; invert: boolean }
export interface Save { v: 1; slots: (SlotData | null)[]; last: number; settings: Settings }
export const freshSettings = (): Settings => ({ sound: true, music: true, view: 'third', sens: 1, invert: false });
export const freshSave = (): Save => ({ v: 1, slots: Array(SLOTS).fill(null), last: 0, settings: freshSettings() });

const num = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d);
const spot = (x: unknown): Spot | null => {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const s = { x: num(o.x, 0, W - 1, NaN), y: num(o.y, 0, H - 1, NaN), z: num(o.z, 0, D - 1, NaN) };
  return [s.x, s.y, s.z].every(Number.isInteger) ? s : null;
};
/** Reads one slot defensively: anything odd is dropped or defaulted; a slot with no usable seed is null. */
export function readSlot(x: unknown): SlotData | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || typeof o.seed !== 'number' || !Number.isInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) return null;
  const mode: Mode = o.mode === 'creative' ? 'creative' : 'story';
  if (typeof o.diff !== 'string' || decodeDiff(o.diff) === null) return null;
  const inv: Record<string, number> = {};
  if (o.inv && typeof o.inv === 'object') for (const [k, n] of Object.entries(o.inv as Record<string, unknown>)) if (ITEMS[k] && typeof n === 'number' && Number.isFinite(n) && n > 0) inv[k] = Math.min(9999, Math.floor(n));
  const hot = Array.isArray(o.hot) ? o.hot.slice(0, 9).map((k) => (typeof k === 'string' && ITEMS[k] ? k : null)) : [];
  while (hot.length < 9) hot.push(null);
  const known = Array.isArray(o.known) ? o.known.filter((k): k is string => typeof k === 'string' && !!RECIPE[k]) : [];
  const q = (o.quest && typeof o.quest === 'object' ? o.quest : {}) as Record<string, unknown>;
  const qi = num(q.i, 0, NEIGHBOURS.length, 0) | 0, qs = num(q.step, 0, 2, 0) | 0, qc = num(q.count, 0, 99, 0) | 0;
  const moved: SlotData['moved'] = [];
  if (Array.isArray(o.moved)) for (const m of o.moved.slice(0, NEIGHBOURS.length)) {
    if (!m || typeof m !== 'object') continue;
    const mm = m as Record<string, unknown>, bed = spot(mm.bed), home = spot(mm.home);
    if (bed && home && NEIGHBOURS.some((n) => n.id === mm.who) && !moved.some((x) => x.who === mm.who)) moved.push({ who: mm.who as NeighbourId, bed, home });
  }
  const players: SlotData['players'] = [];
  if (Array.isArray(o.players)) for (const p of o.players.slice(0, 2)) {
    if (!p || typeof p !== 'object') continue;
    const pp = p as Record<string, unknown>;
    const x = num(pp.x, 0.3, W - 0.3, NaN), y = num(pp.y, 0, H, NaN), z = num(pp.z, 0.3, D - 0.3, NaN);
    if ([x, y, z].some(Number.isNaN)) continue;
    players.push({ x, y, z, yaw: num(pp.yaw, -100, 100, 0), fly: pp.fly === true });
  }
  if (players.length < 2) return null;
  const st = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>;
  const stats: Stats = { dug: 0, placed: 0, woven: 0, defeated: 0, kos: 0, caught: 0 };
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] = num(st[k], 0, 1e9, 0) | 0;
  const nLeaves = 12;
  return {
    v: 1, mode, cosy: mode === 'creative' || o.cosy === true, seed: o.seed >>> 0, name: typeof o.name === 'string' ? o.name.slice(0, 24) : 'Cubby Valley',
    time: num(o.time, 0, 1e8, DAY * 0.1), diff: o.diff, inv, hot, sel: num(o.sel, 0, 8, 0) | 0, known,
    quest: { i: Math.max(qi, moved.length), step: qi > moved.length ? 0 : qs, count: qc }, moved,
    leaves: Array.isArray(o.leaves) ? o.leaves.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < nLeaves) : [],
    saplings: Array.isArray(o.saplings) ? o.saplings.map(spot).filter((s): s is Spot => !!s).map((s, i) => ({ ...s, t: num((o.saplings as Record<string, unknown>[])[i]?.t, 0, 1e9, 0) })) : [],
    pickups: Array.isArray(o.pickups) ? o.pickups.slice(0, 200).flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const pp = p as Record<string, unknown>; const items: Record<string, number> = {};
      if (pp.items && typeof pp.items === 'object') for (const [k, n] of Object.entries(pp.items as Record<string, unknown>)) if (ITEMS[k] && typeof n === 'number' && n > 0) items[k] = Math.floor(n);
      const x = num(pp.x, 0, W, NaN), y = num(pp.y, 0, H, NaN), z = num(pp.z, 0, D, NaN);
      return Object.keys(items).length && ![x, y, z].some(Number.isNaN) ? [{ x, y, z, items }] : [];
    }) : [],
    players, who: o.who === 1 ? 1 : 0, hp: num(o.hp, 1, MAX_HP, MAX_HP) | 0, respawn: spot(o.respawn) ?? { x: 0, y: 0, z: 0 },
    fair: o.fair === true, ended: o.ended === true, stats, rng: num(o.rng, 0, 0xffffffff, 1) >>> 0,
  };
}
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  let j: unknown; try { j = JSON.parse(raw); } catch { return s; }
  if (!j || typeof j !== 'object') return s;
  const o = j as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (Array.isArray(o.slots)) for (let i = 0; i < SLOTS; i++) { try { s.slots[i] = readSlot(o.slots[i]); } catch { s.slots[i] = null; } }
  s.last = num(o.last, 0, SLOTS - 1, 0) | 0;
  const st = (o.settings && typeof o.settings === 'object' ? o.settings : {}) as Record<string, unknown>;
  s.settings = { sound: st.sound !== false, music: st.music !== false, view: st.view === 'first' ? 'first' : 'third', sens: num(st.sens, 0.3, 3, 1), invert: st.invert === true };
  return s;
}
export { COSY_SWAP, BLOCK_BY_KEY };

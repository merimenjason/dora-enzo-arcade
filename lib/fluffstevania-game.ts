// Fluffstevania: Symphony of the Dust — a castle-exploring action RPG. Deterministic: the same inputs always play
// out the same way, so the tests drive this engine directly. Positions are world pixels; heroes and walking
// enemies stand with their feet at (x, y).
import {
  ROOMS, COLS, ROWS, TILE, START, GEAR, FOOD, RELICS, SCRIPTS, ROOM_SCRIPTS, AREAS, SHOP, RENAMED, itemName,
  type Room, type HeroId, type Slot, type Line, type RelicId, type WeaponStyle, type AreaId, type BossId,
} from './fluffstevania-world.js';

export { ROOMS, COLS, ROWS, TILE, GEAR, FOOD, RELICS, AREAS, SCRIPTS, SHOP, itemName };
export type { Room, HeroId, Slot, Line, RelicId, AreaId, BossId, WeaponStyle };
export const VIEW_W = COLS * TILE, VIEW_H = ROWS * TILE;
export const SCREEN_W = VIEW_W, SCREEN_H = VIEW_H;

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; attack: boolean; dash: boolean; tag: boolean };
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, attack: false, dash: false, tag: false };

// ─── The map ──────────────────────────────────────────────────────────────

const CELLS = new Map<string, Room>();
for (const r of ROOMS) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) CELLS.set(`${r.mx + x},${r.my + y}`, r);
export const roomAt = (mx: number, my: number) => CELLS.get(`${mx},${my}`);
export const roomById = (id: string) => ROOMS.find((r) => r.id === id)!;
export const TOTAL_CELLS = CELLS.size;
/** The raw map character at world tile (c, r), before breakable walls and gates are applied. Off the map is wall. */
export function rawTile(c: number, r: number): string {
  const room = roomAt(Math.floor(c / COLS), Math.floor(r / ROWS));
  if (!room) return '#';
  return room.rows[r - room.my * ROWS][c - room.mx * COLS];
}
export const isSolid = (ch: string) => ch === '#' || ch === '%' || ch === 'G' || ch === 'D' || ch === '^';
export const roomRect = (r: Room) => ({ x: r.mx * VIEW_W, y: r.my * VIEW_H, w: r.w * VIEW_W, h: r.h * VIEW_H });

// ─── Heroes ───────────────────────────────────────────────────────────────

const BASE: Record<HeroId, { hp: number; atk: number; def: number; lck: number; speed: number }> = {
  dora: { hp: 50, atk: 6, def: 1, lck: 6, speed: 140 },
  enzo: { hp: 66, atk: 7, def: 3, lck: 3, speed: 124 },
};
const GROW: Record<HeroId, { hp: number; atk: number; def: number; lck: number }> = {
  dora: { hp: 6, atk: 1.6, def: 0.7, lck: 0.5 },
  enzo: { hp: 8, atk: 1.8, def: 1, lck: 0.3 },
};
/** XP needed to go from `level` to the next. */
export const xpToNext = (level: number) => Math.round(10 * level ** 1.7);
export const LEAF_HP = 10;

/**
 * How each kind of weapon swings. `reach` is measured from just in front of the hero's middle. On the ground a
 * swing carries the hero forward at `lunge` px/s through the wind-up and the live frames, stopping when it connects.
 */
export const STYLES: Record<WeaponStyle, { reach: number; h: number; windup: number; active: number; total: number; mult: number; lunge: number }> = {
  rapier: { reach: 40, h: 8, windup: 0.05, active: 0.1, total: 0.28, mult: 1, lunge: 60 },
  claws: { reach: 28, h: 18, windup: 0.03, active: 0.1, total: 0.22, mult: 0.75, lunge: 190 },
  club: { reach: 30, h: 20, windup: 0.12, active: 0.1, total: 0.42, mult: 1.3, lunge: 100 },
};

export const G = 1400, JUMP_V = 470, JUMP_CUT = 150, MAX_FALL = 480;
export const DASH_V = 340, DASH_T = 0.24, DASH_JUMP_V = 290, HOP_V = 420;
export const HERO_W = 12, HERO_H = 20, TAG_T = 0.44, TAG_ARC = 0.2, TAG_CD = 1, FOLLOW = 22;

type Body = {
  x: number; y: number; vx: number; vy: number; face: 1 | -1; ground: boolean; coyote: number; jumpBuf: number;
  dashT: number; dashCd: number; airDash: boolean; dashJump: boolean; attackT: number; attackId: number; attackHero: HeroId;
  hurtT: number; invT: number; dropT: number; run: number; subCd: number; hopped: boolean; lungeStop: boolean;
};
export type Tag = { t: number; hero: HeroId; sx: number; sy: number; hits: Set<number> };
export type Follower = { x: number; y: number; face: 1 | -1; air: boolean; moving: boolean; run: number };

// ─── Enemies ──────────────────────────────────────────────────────────────

export type FoeKind = 'bat' | 'moth' | 'beetle' | 'bone' | 'armadillo' | 'rat' | 'ghost' | 'spider';
export const FOES: Record<FoeKind, { name: string; hp: number; atk: number; def: number; xp: number; w: number; h: number; raisins: number; drop?: [string, number]; fly?: boolean }> = {
  bat: { name: 'Cave Bat', hp: 10, atk: 7, def: 0, xp: 3, w: 14, h: 10, raisins: 2, drop: ['berry', 0.06], fly: true },
  moth: { name: 'Dust Moth', hp: 14, atk: 8, def: 0, xp: 4, w: 16, h: 14, raisins: 2, drop: ['cape', 0.05], fly: true },
  beetle: { name: 'Shell Beetle', hp: 24, atk: 9, def: 3, xp: 6, w: 18, h: 12, raisins: 4, drop: ['shell', 0.05] },
  bone: { name: 'Bone Mouse', hp: 22, atk: 9, def: 1, xp: 8, w: 14, h: 16, raisins: 5, drop: ['cake', 0.1] },
  armadillo: { name: 'Armadillo Guard', hp: 46, atk: 12, def: 4, xp: 15, w: 22, h: 18, raisins: 9, drop: ['bell', 0.08] },
  rat: { name: 'Pantry Rat', hp: 30, atk: 13, def: 2, xp: 14, w: 18, h: 11, raisins: 6, drop: ['cake', 0.08] },
  ghost: { name: 'Jar Ghost', hp: 34, atk: 14, def: 0, xp: 18, w: 16, h: 18, raisins: 7, drop: ['tea', 0.08], fly: true },
  spider: { name: 'Cellar Spider', hp: 26, atk: 12, def: 1, xp: 13, w: 14, h: 12, raisins: 5, drop: ['ring', 0.03], fly: true },
};
const FOE_CHARS: Record<string, FoeKind> = { b: 'bat', m: 'moth', k: 'beetle', x: 'bone', a: 'armadillo', r: 'rat', g: 'ghost', p: 'spider' };
/** A jar ghost is solid for GHOST_ON seconds, then fades out (can't hurt or be hurt) for GHOST_OFF. */
export const GHOST_ON = 2.4, GHOST_OFF = 1.4;
export const ghostFaded = (e: Enemy) => e.kind === 'ghost' && e.t % (GHOST_ON + GHOST_OFF) > GHOST_ON;
export type Enemy = {
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number; hp: number; face: 1 | -1; t: number;
  state: 'idle' | 'awake' | 'wind' | 'lunge' | 'rest' | 'throw'; stateT: number; flash: number; hx: number; hy: number;
  ground: boolean; hitId: number; dead: number;
};

export const BOSSES: Record<BossId, { name: string; hp: number; atk: number; def: number; xp: number; w: number; h: number }> = {
  owl: { name: 'Duke Hootsworth', hp: 260, atk: 12, def: 3, xp: 120, w: 36, h: 30 },
  rat: { name: 'Gnawdrick the Rat King', hp: 560, atk: 18, def: 6, xp: 320, w: 46, h: 34 },
};
export const OWL = BOSSES.owl, RAT = BOSSES.rat;
export type OwlMove = 'enter' | 'hover' | 'feathers' | 'rise' | 'swoop' | 'track' | 'drop' | 'rest' | 'dying';
export type RatMove = 'enter' | 'idle' | 'wind' | 'charge' | 'stunned' | 'crouch' | 'leap' | 'cheese' | 'dying';
/** A boss. (x, y) is the middle of its body. */
export type Boss = {
  kind: BossId; x: number; y: number; vx: number; vy: number; hp: number; max: number; move: OwlMove | RatMove;
  t: number; face: 1 | -1; flash: number; phase2: boolean; summoned: boolean; sx: number; ex: number; side: number; last: string[]; hitId: number;
};

export type Shot = { kind: 'seed' | 'bone' | 'feather' | 'wave' | 'cheese' | 'rock'; x: number; y: number; vx: number; vy: number; grav: number; r: number; dmg: number; hero: boolean; life: number; spin: number };
export type Pickup = { kind: 'raisin' | 'seeds' | 'food' | 'gear' | 'leaf' | 'relic'; id: string; amount: number; x: number; y: number; vy: number; t: number; flag?: string; fixed: boolean };
export type Candle = { x: number; y: number; alive: boolean; c: number; r: number };
export type Pop = { x: number; y: number; text: string; t: number; color: string };
export type Fx = {
  kind: 'dust' | 'spark' | 'poof' | 'clink' | 'flame' | 'rubble' | 'boom' | 'feather' | 'star' | 'ash' | 'slash' | 'hop';
  x: number; y: number; t: number; vx: number; vy: number; color?: string;
};
/** How long each effect lives, in seconds. */
export const FX_LIFE: Record<Fx['kind'], number> = { dust: 0.5, spark: 0.35, poof: 0.5, clink: 0.35, flame: 0.5, rubble: 0.9, boom: 0.6, feather: 0.5, star: 0.5, ash: 0.9, slash: 0.2, hop: 0.35 };
/** The colours an enemy crumbles into when defeated. */
const ASH: Record<FoeKind, string[]> = {
  bat: ['#4e3a60', '#8a70a8'], moth: ['#c8b8a0', '#f0e8d8'], beetle: ['#3a7088', '#1e3a48'], bone: ['#e8e2d0', '#a8a090'],
  armadillo: ['#a88a68', '#6a5040'], rat: ['#8a7a70', '#c8b0a0'], ghost: ['#9ff0c8', '#e8fff4'], spider: ['#4a3a4a', '#a06080'],
};

export type Equip = Record<Slot, string | null>;
export type Save = {
  v: 1; room: string; x: number; y: number; level: number; xp: number; hp: Record<HeroId, number>; leader: HeroId;
  equip: Record<HeroId, Equip>; bag: Record<string, number>; relics: RelicId[]; flags: string[]; visited: string[];
  raisins: number; seeds: number; time: number; leaves: number;
};
export const freshSave = (): Save => ({
  v: 1, room: START.room, x: START.x, y: START.y, level: 1, xp: 0, hp: { dora: BASE.dora.hp, enzo: BASE.enzo.hp }, leader: 'dora',
  equip: { dora: { weapon: 'rapier', armor: null, acc: null }, enzo: { weapon: 'claws', armor: 'scarf', acc: null } },
  bag: {}, relics: [], flags: [], visited: [], raisins: 0, seeds: 10, time: 0, leaves: 0,
});
/** A save read back from storage, or null when it doesn't look like one. */
export function parseSave(raw: string | null): Save | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || v.v !== 1 || typeof v.room !== 'string' || !ROOMS.some((r) => r.id === v.room)) return null;
    const f = freshSave(), num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
    const strs = (a: unknown) => (Array.isArray(a) ? a.filter((s): s is string => typeof s === 'string') : []);
    const renamed = (id: unknown) => (typeof id === 'string' ? RENAMED[id] ?? id : null);
    const eq = (h: HeroId): Equip => {
      const e = v.equip?.[h] ?? {}, ok = (s: Slot) => { const id = renamed(e[s]); return id && GEAR[id]?.slot === s ? id : null; };
      return { weapon: ok('weapon') ?? f.equip[h].weapon, armor: ok('armor'), acc: ok('acc') };
    };
    const bag: Record<string, number> = {};
    for (const [old, n] of Object.entries(v.bag ?? {})) { const k = renamed(old)!; if ((GEAR[k] || FOOD[k]) && typeof n === 'number' && n > 0) bag[k] = (bag[k] ?? 0) + Math.floor(n); }
    return {
      v: 1, room: v.room, x: num(v.x, f.x), y: num(v.y, f.y), level: Math.max(1, Math.floor(num(v.level, 1))), xp: Math.max(0, num(v.xp, 0)),
      hp: { dora: num(v.hp?.dora, f.hp.dora), enzo: num(v.hp?.enzo, f.hp.enzo) }, leader: v.leader === 'enzo' ? 'enzo' : 'dora',
      equip: { dora: eq('dora'), enzo: eq('enzo') }, bag, relics: strs(v.relics).filter((r): r is RelicId => r in RELICS),
      flags: strs(v.flags), visited: strs(v.visited), raisins: num(v.raisins, 0), seeds: num(v.seeds, 10), time: num(v.time, 0), leaves: num(v.leaves, 0),
    };
  } catch { return null; }
}

const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class FluffstevaniaGame {
  level: number; xp: number; hp: Record<HeroId, number>; leader: HeroId; equipped: Record<HeroId, Equip>;
  bag: Record<string, number>; relics: Set<RelicId>; flags: Set<string>; visited: Set<string>;
  raisins: number; seeds: number; time: number; leaves: number;
  body: Body; room: Room; follower: Follower; trail: { x: number; y: number; face: 1 | -1; air: boolean }[] = [];
  tag: Tag | null = null; tagCd = 0;
  enemies: Enemy[] = []; boss: Boss | null = null; fight = false; shots: Shot[] = []; pickups: Pickup[] = []; candles: Candle[] = [];
  pops: Pop[] = []; fx: Fx[] = [];
  state: 'play' | 'dead' | 'chapter' = 'play';
  /** The chapter just finished, while `state` is 'chapter'. */
  chapter = 0;
  /** Pip's shop is open; the world waits. */
  shop = false;
  /** A few frozen frames when a blow lands. */
  hitstop = 0;
  dialog: { lines: Line[]; i: number; next?: string } | null = null;
  toast: { text: string; t: number } | null = null;
  banner: { text: string; t: number } | null = null;
  events: string[] = [];
  /** The last save written at a shrine; the page stores it. */
  saved: Save | null = null;
  cam = { x: 0, y: 0 };
  shake = 0;
  private prev: Input = { ...NO_INPUT };
  private seed = 1;
  private nextId = 1;
  private atShrine = false;
  private sign = -1;
  private stall = false;

  constructor(save: Save = freshSave()) {
    this.level = save.level; this.xp = save.xp; this.hp = { ...save.hp }; this.leader = save.leader;
    this.equipped = { dora: { ...save.equip.dora }, enzo: { ...save.equip.enzo } }; this.bag = { ...save.bag };
    this.relics = new Set(save.relics); this.flags = new Set(save.flags); this.visited = new Set(save.visited);
    this.raisins = save.raisins; this.seeds = save.seeds; this.time = save.time; this.leaves = save.leaves;
    for (const h of ['dora', 'enzo'] as HeroId[]) this.hp[h] = Math.max(0, Math.min(Math.round(this.hp[h]), this.stats(h).maxHp));
    if (this.hp[this.leader] <= 0) this.leader = other(this.leader);
    if (this.hp[this.leader] <= 0) { this.hp.dora = this.stats('dora').maxHp; this.hp.enzo = this.stats('enzo').maxHp; }
    this.body = {
      x: save.x, y: save.y, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jumpBuf: 0, dashT: 0, dashCd: 0, airDash: false, dashJump: false,
      attackT: 0, attackId: 0, attackHero: this.leader, hurtT: 0, invT: 0, dropT: 0, run: 0, subCd: 0, hopped: false, lungeStop: false,
    };
    this.room = roomById(save.room);
    this.follower = { x: save.x - FOLLOW, y: save.y, face: 1, air: false, moving: false, run: 0 };
    this.enter(this.room, true);
    this.resetTrail();
    this.snapCamera();
  }

  // ─── Stats ──────────────────────────────────────────────────────────────
  stats(h: HeroId) {
    const b = BASE[h], g = GROW[h], l = this.level - 1, e = this.equipped[h];
    const gear = [e.weapon, e.armor, e.acc].map((id) => (id ? GEAR[id] : null));
    const sum = (k: 'atk' | 'def' | 'lck') => gear.reduce((s, it) => s + (it?.[k] ?? 0), 0);
    return {
      maxHp: Math.round(b.hp + g.hp * l) + this.leaves * LEAF_HP,
      atk: Math.round(b.atk + g.atk * l) + sum('atk'),
      def: Math.round(b.def + g.def * l) + sum('def'),
      lck: Math.round(b.lck + g.lck * l) + sum('lck'),
      speed: b.speed,
    };
  }
  weaponOf(h: HeroId) {
    const id = this.equipped[h].weapon, gear = id ? GEAR[id] : null;
    const style = gear?.style ?? (h === 'dora' ? 'rapier' : 'claws');
    return { style, ...STYLES[style], reach: STYLES[style].reach + (gear?.reach ?? 0) };
  }
  get partner() { return other(this.leader); }
  has(r: RelicId) { return this.relics.has(r); }
  get completion() { return Math.round((this.visited.size / TOTAL_CELLS) * 100); }

  private rand() {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ─── Tiles ──────────────────────────────────────────────────────────────
  tile(c: number, r: number): string {
    const ch = rawTile(c, r);
    if (ch === '%' && this.flags.has(`wall:${c},${r}`)) return '.';
    if (ch === 'G') return this.fight ? 'G' : '.';
    if (ch === 'D' && this.doorOpen(c, r)) return '.';
    return ch;
  }
  /** Sealed doors open for good once their room's `opens` flag is set. */
  doorOpen(c: number, r: number) {
    const opens = roomAt(Math.floor(c / COLS), Math.floor(r / ROWS))?.opens;
    return !!opens && this.flags.has(opens);
  }
  solidAt(x: number, y: number) { return isSolid(this.tile(Math.floor(x / TILE), Math.floor(y / TILE))); }
  /**
   * Move a box whose feet are at (x, y). Ledges (`=`) only catch things falling onto them from above.
   * Returns which sides hit something.
   */
  private move(o: { x: number; y: number; vx: number; vy: number }, w: number, h: number, dt: number, ledges: boolean) {
    const hit = { x: false, down: false, up: false };
    const hw = w / 2;
    o.x += o.vx * dt;
    const top = Math.floor((o.y - h + 0.01) / TILE), bot = Math.floor((o.y - 0.01) / TILE);
    if (o.vx > 0) {
      const c = Math.floor((o.x + hw) / TILE);
      for (let r = top; r <= bot; r++) if (isSolid(this.tile(c, r))) { o.x = c * TILE - hw - 0.01; hit.x = true; break; }
    } else if (o.vx < 0) {
      const c = Math.floor((o.x - hw) / TILE);
      for (let r = top; r <= bot; r++) if (isSolid(this.tile(c, r))) { o.x = (c + 1) * TILE + hw + 0.01; hit.x = true; break; }
    }
    const before = o.y;
    o.y += o.vy * dt;
    const l = Math.floor((o.x - hw + 0.01) / TILE), rr = Math.floor((o.x + hw - 0.01) / TILE);
    if (o.vy > 0) {
      const r = Math.floor(o.y / TILE);
      for (let c = l; c <= rr; c++) {
        const ch = this.tile(c, r);
        if (isSolid(ch) || (ledges && ch === '=' && before <= r * TILE + 0.01)) { o.y = r * TILE; o.vy = 0; hit.down = true; break; }
      }
    } else if (o.vy < 0) {
      const r = Math.floor((o.y - h) / TILE);
      for (let c = l; c <= rr; c++) if (isSolid(this.tile(c, r))) { o.y = (r + 1) * TILE + h; o.vy = 0; hit.up = true; break; }
    }
    return hit;
  }
  private onLedge() {
    const b = this.body, r = Math.floor(b.y / TILE + 0.01);
    if (Math.abs(b.y - r * TILE) > 0.5) return false;
    let ledge = false;
    for (let c = Math.floor((b.x - HERO_W / 2 + 0.01) / TILE); c <= Math.floor((b.x + HERO_W / 2 - 0.01) / TILE); c++) {
      const ch = this.tile(c, r);
      if (isSolid(ch)) return false;
      if (ch === '=') ledge = true;
    }
    return ledge;
  }
  private supported(x: number, y: number, w: number) {
    const r = Math.floor(y / TILE + 0.01);
    for (let c = Math.floor((x - w / 2 + 0.01) / TILE); c <= Math.floor((x + w / 2 - 0.01) / TILE); c++) {
      const ch = this.tile(c, r);
      if (isSolid(ch) || ch === '=') return true;
    }
    return false;
  }

  // ─── Rooms ──────────────────────────────────────────────────────────────
  private enter(room: Room, first = false) {
    const prevArea = this.room?.area;
    this.room = room;
    this.enemies = []; this.shots = []; this.candles = []; this.boss = null; this.fight = false;
    this.pickups = [];
    let item = 0;
    const rx = room.mx * COLS, ry = room.my * ROWS;
    for (let r = 0; r < room.rows.length; r++) for (let c = 0; c < room.rows[r].length; c++) {
      const ch = room.rows[r][c], wc = rx + c, wr = ry + r, x = (wc + 0.5) * TILE, y = (wr + 1) * TILE;
      const kind = FOE_CHARS[ch];
      if (kind) this.spawn(kind, x, kind === 'bat' ? wr * TILE + FOES.bat.h + 2 : y);
      else if (ch === 'i') this.candles.push({ x, y: wr * TILE + 12, alive: true, c: wc, r: wr });
      else if (ch === 'I') {
        const id = room.items?.[item++], flag = `item:${room.id}:${item - 1}`;
        if (id && !this.flags.has(flag)) this.pickups.push({ kind: GEAR[id] ? 'gear' : 'food', id, amount: 1, x, y: y - 4, vy: 0, t: 0, flag, fixed: true });
      } else if (ch === 'H' && !this.flags.has(`leaf:${room.id}`)) this.pickups.push({ kind: 'leaf', id: 'leaf', amount: 1, x, y: y - 4, vy: 0, t: 0, flag: `leaf:${room.id}`, fixed: true });
      else if (ch === 'R' && room.relic && !this.relics.has(room.relic)) this.pickups.push({ kind: 'relic', id: room.relic, amount: 1, x, y: y - 6, vy: 0, t: 0, flag: `relic:${room.relic}`, fixed: true });
    }
    if (!first && prevArea !== room.area) this.banner = { text: AREAS[room.area].name, t: 2.4 };
    if (first) this.banner = { text: AREAS[room.area].name, t: 2.4 };
    const script = ROOM_SCRIPTS[room.id];
    if (script && !this.flags.has(`script:${script}`)) { this.flags.add(`script:${script}`); this.talk(script); }
    this.atShrine = true; this.sign = -1;
  }
  private spawn(kind: FoeKind, x: number, y: number) {
    const f = FOES[kind];
    const e: Enemy = { id: this.nextId++, kind, x, y, vx: 0, vy: 0, hp: f.hp, face: -1, t: this.rand() * 3, state: 'idle', stateT: 0, flash: 0, hx: x, hy: y, ground: false, hitId: -1, dead: 0 };
    this.enemies.push(e);
    return e;
  }
  private resetTrail() {
    const b = this.body;
    this.trail = [{ x: b.x - b.face * FOLLOW, y: b.y, face: b.face, air: false }, { x: b.x, y: b.y, face: b.face, air: !b.ground }];
    this.follower = { ...this.follower, x: b.x - b.face * FOLLOW, y: b.y, face: b.face };
  }
  private snapCamera() {
    const r = roomRect(this.room);
    this.cam.x = clamp(this.body.x - VIEW_W / 2, r.x, r.x + r.w - VIEW_W);
    this.cam.y = clamp(this.body.y - 12 - VIEW_H / 2, r.y, r.y + r.h - VIEW_H);
  }
  talk(script: string, next?: string) {
    const lines = SCRIPTS[script];
    if (lines) this.dialog = { lines, i: 0, next };
  }
  private say(text: string, t = 2.6) { this.toast = { text, t }; }

  // ─── The step ───────────────────────────────────────────────────────────
  step(dt: number, input: Input = NO_INPUT) {
    const pressed = (k: keyof Input) => input[k] && !this.prev[k];
    if (this.dialog) {
      if (pressed('jump') || pressed('attack') || pressed('up')) {
        this.dialog.i++;
        this.events.push('talk');
        if (this.dialog.i >= this.dialog.lines.length) {
          const next = this.dialog.next;
          this.dialog = null;
          if (next?.startsWith('chapter')) { this.state = 'chapter'; this.chapter = Number(next.slice(7)) || 1; }
        }
      }
      this.prev = { ...input };
      return;
    }
    if (this.state !== 'play' || this.shop) { this.prev = { ...input }; return; }
    // Hitstop freezes the world for a moment. Presses made meanwhile still count afterwards.
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    this.time += dt;
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    this.shake = Math.max(0, this.shake - dt);
    this.tagCd = Math.max(0, this.tagCd - dt);

    this.control(dt, input, pressed);
    this.roomCheck();
    this.followerStep();
    this.hits();
    this.enemyStep(dt);
    this.bossStep(dt);
    this.shotStep(dt);
    this.pickupStep(dt);
    this.touchStep(pressed);
    for (const p of this.pops) { p.t += dt; p.y -= 22 * dt; }
    this.pops = this.pops.filter((p) => p.t < 0.9);
    for (const f of this.fx) {
      f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.kind === 'rubble' || f.kind === 'feather') f.vy += 500 * dt;
      if (f.kind === 'ash') { f.vy -= 60 * dt; f.vx *= 1 - dt * 2; }
    }
    this.fx = this.fx.filter((f) => f.t < FX_LIFE[f.kind]);
    // Mark the map cell the leader stands in, and ease the camera after them.
    const b = this.body;
    this.visited.add(`${Math.floor(b.x / VIEW_W)},${Math.floor((b.y - 10) / VIEW_H)}`);
    const r = roomRect(this.room);
    const tx = clamp(b.x + b.face * 24 - VIEW_W / 2, r.x, r.x + r.w - VIEW_W), ty = clamp(b.y - 12 - VIEW_H / 2, r.y, r.y + r.h - VIEW_H);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    this.prev = { ...input };
  }

  private control(dt: number, input: Input, pressed: (k: keyof Input) => boolean) {
    const b = this.body, me = this.stats(this.leader);
    b.invT = Math.max(0, b.invT - dt); b.dashCd = Math.max(0, b.dashCd - dt); b.subCd = Math.max(0, b.subCd - dt); b.dropT = Math.max(0, b.dropT - dt);
    if (b.attackT > 0) b.attackT = Math.max(0, b.attackT - dt);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (pressed('jump')) b.jumpBuf = 0.1; else b.jumpBuf = Math.max(0, b.jumpBuf - dt);

    if (this.tag) {
      this.tag.t += dt;
      if (this.tag.t >= TAG_ARC) { b.vx = b.face * 260; b.vy = Math.min(b.vy, 0); }
      if (this.tag.t >= TAG_T) { this.tag = null; b.invT = Math.max(b.invT, 0.3); b.vx = 0; }
    } else if (b.hurtT > 0) {
      b.hurtT -= dt;
    } else {
      if (pressed('tag')) this.doTag(false);
      if (b.dashT > 0) {
        b.dashT -= dt; b.vx = b.face * DASH_V; b.vy = 0;
        if (this.time % 0.05 < dt) this.fx.push({ kind: 'dust', x: b.x - b.face * 6, y: b.y - 3, t: 0, vx: -b.face * 30, vy: -10 });
        if (b.dashT <= 0) b.dashCd = 0.12;
      } else if (b.attackT > 0 && b.ground) {
        // A ground swing roots you, except for the lunge that carries you into it.
        const w = this.weaponOf(b.attackHero), into = w.total - b.attackT;
        const lunging = w.lunge > 0 && !b.lungeStop && into < w.windup + w.active && this.supported(b.x + b.face * 8, b.y, 4);
        b.vx = lunging ? b.face * w.lunge : 0;
      } else {
        const speed = b.dashJump && !b.ground ? DASH_JUMP_V : me.speed;
        b.vx = dir * speed;
        if (dir && b.attackT <= 0) b.face = dir as 1 | -1;
      }
      if (pressed('dash') && this.has('dash') && b.dashCd <= 0 && b.dashT <= 0 && (b.ground || !b.airDash)) {
        if (dir) b.face = dir as 1 | -1;
        b.dashT = DASH_T; b.attackT = 0; if (!b.ground) b.airDash = true;
        this.events.push('dash');
        for (let i = 0; i < 4; i++) this.fx.push({ kind: 'dust', x: b.x, y: b.y - 4, t: -i * 0.03, vx: -b.face * (40 + i * 20), vy: -20 + i * 8 });
      }
      if (b.jumpBuf > 0 && input.down && this.onLedge()) { b.jumpBuf = 0; b.dropT = 0.2; b.y += 2; b.ground = false; }
      else if (b.jumpBuf > 0 && (b.ground || b.coyote > 0)) {
        b.dashJump = b.dashT > 0 || b.dashCd > 0.06;
        b.vy = -JUMP_V; b.ground = false; b.coyote = 0; b.jumpBuf = 0; b.dashT = 0;
        this.events.push('jump');
      } else if (b.jumpBuf > 0 && !b.ground && this.has('hop') && !b.hopped) {
        // The Cloud Hop: a second jump off a puff of dust.
        b.vy = -HOP_V; b.hopped = true; b.jumpBuf = 0; b.dashT = 0;
        this.events.push('hop');
        this.fx.push({ kind: 'hop', x: b.x, y: b.y, t: 0, vx: 0, vy: 0 });
        for (let i = 0; i < 5; i++) this.fx.push({ kind: 'dust', x: b.x + (i - 2) * 4, y: b.y, t: 0, vx: (i - 2) * 30, vy: 30 });
      }
      if (!input.jump && b.vy < -JUMP_CUT && b.dashT <= 0) b.vy = -JUMP_CUT;
      if (pressed('attack') && b.attackT <= 0) {
        if (input.up && this.seeds > 0 && b.subCd <= 0) this.throwSeed();
        else {
          const w = this.weaponOf(this.leader);
          b.attackT = w.total; b.attackId++; b.attackHero = this.leader; b.dashT = 0; b.lungeStop = false;
          if (dir) b.face = dir as 1 | -1;
          this.events.push(w.style === 'rapier' ? 'thrust' : w.style === 'club' ? 'club' : 'swipe');
        }
      }
    }
    if (b.dashT <= 0 && !(this.tag && this.tag.t >= TAG_ARC)) b.vy = Math.min(b.vy + G * dt, MAX_FALL);
    const wasGround = b.ground;
    const hit = this.move(b, HERO_W, HERO_H, dt, b.dropT <= 0);
    if (hit.down) {
      if (!wasGround && b.vy === 0) this.fx.push({ kind: 'dust', x: b.x, y: b.y, t: 0.2, vx: 0, vy: -8 });
      b.ground = true; b.airDash = false; b.dashJump = false; b.hopped = false; b.coyote = 0.08;
    } else {
      if (b.ground && b.vy >= 0 && this.supported(b.x, b.y, HERO_W) && b.dropT <= 0) { b.ground = true; }
      else { if (b.ground) b.coyote = 0.08; b.ground = false; b.coyote = Math.max(0, b.coyote - dt); }
    }
    if (hit.x && b.dashT > 0) b.dashT = 0;
    if (b.ground && Math.abs(b.vx) > 1) b.run += Math.abs(b.vx) * dt * 0.12;
    // Spikes bite anything standing on them.
    if (b.ground && this.tile(Math.floor(b.x / TILE), Math.floor(b.y / TILE + 0.01)) === '^') this.hurtHero(12, b.x + b.face, true);
  }

  private throwSeed() {
    const b = this.body;
    this.seeds--; b.subCd = 0.35;
    this.shots.push({ kind: 'seed', x: b.x + b.face * 6, y: b.y - 14, vx: b.face * 200 + b.vx * 0.3, vy: -240, grav: 800, r: 4, dmg: 6 + this.level * 2, hero: true, life: 2, spin: 0 });
    this.events.push('seed');
  }

  /** Swap heroes. The one coming in tumbles from behind to the front, hurting anything on the way. */
  doTag(forced: boolean) {
    const next = this.partner, b = this.body;
    if (!forced && (this.tagCd > 0 || this.tag)) return false;
    if (this.hp[next] <= 0) { if (!forced) this.say(`${next === 'dora' ? 'Dora' : 'Enzo'} needs a dust bath before tagging back in.`); return false; }
    this.tag = { t: 0, hero: next, sx: this.follower.x, sy: this.follower.y, hits: new Set() };
    this.leader = next; this.tagCd = TAG_CD;
    b.attackT = 0; b.dashT = 0; b.hurtT = 0; b.invT = Math.max(b.invT, TAG_T);
    if (!b.ground) b.vy = Math.min(b.vy, -120);
    this.trail = [{ x: b.x, y: b.y, face: b.face, air: !b.ground }];
    this.follower = { ...this.follower, x: b.x, y: b.y };
    this.events.push('tag');
    return true;
  }
  /** Where the hero coming in is drawn during a tag, and where the tag hurts. */
  tagPoint() {
    const t = this.tag, b = this.body;
    if (!t) return null;
    if (t.t >= TAG_ARC) return { x: b.x, y: b.y - 10, rolling: true };
    const u = t.t / TAG_ARC;
    return { x: t.sx + (b.x - t.sx) * u, y: t.sy - 10 + (b.y - t.sy) * u - Math.sin(Math.PI * u) * 28, rolling: false };
  }

  private roomCheck() {
    const b = this.body, mx = Math.floor(b.x / VIEW_W), my = Math.floor((b.y - 10) / VIEW_H);
    const room = roomAt(mx, my);
    if (room && room !== this.room) {
      this.enter(room);
      this.resetTrail();
      this.events.push('door');
    }
    // Falling out of the map entirely (it shouldn't happen): back to the last shrine spot.
    if (!room) { const r = roomRect(this.room); b.x = clamp(b.x, r.x + 20, r.x + r.w - 20); b.y = clamp(b.y, r.y + 40, r.y + r.h - 20); }
  }

  private followerStep() {
    const b = this.body, last = this.trail[this.trail.length - 1];
    if (Math.hypot(b.x - last.x, b.y - last.y) > 0.8) this.trail.push({ x: b.x, y: b.y, face: b.face, air: !b.ground });
    if (this.trail.length > 90) this.trail.splice(0, this.trail.length - 90);
    // Walk back along the leader's path until FOLLOW pixels behind.
    let d = 0, i = this.trail.length - 1;
    while (i > 0 && d < FOLLOW) { d += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y); i--; }
    const p = this.trail[i], f = this.follower, ox = f.x, oy = f.y;
    f.x += (p.x - f.x) * 0.25; f.y += (p.y - f.y) * 0.25;
    const moved = Math.hypot(f.x - ox, f.y - oy);
    f.moving = moved > 0.15; f.air = p.air; f.run += moved * 0.12;
    if (Math.abs(f.x - ox) > 0.1) f.face = f.x > ox ? 1 : -1;
    else if (!f.moving) f.face = b.x >= f.x ? 1 : -1;
  }

  // ─── Combat ─────────────────────────────────────────────────────────────
  /** The leader's weapon hitbox while a swing is live. */
  attackBox(): Box | null {
    const b = this.body;
    if (b.attackT <= 0) return null;
    const w = this.weaponOf(b.attackHero), into = w.total - b.attackT;
    if (into < w.windup || into > w.windup + w.active) return null;
    const x = b.face > 0 ? b.x + 4 : b.x - 4 - w.reach;
    return { x, y: b.y - 15 - w.h / 2 + 2, w: w.reach, h: w.h };
  }
  private hits() {
    const b = this.body, box = this.attackBox(), tp = this.tagPoint();
    const tagBox = tp ? { x: tp.x - 16, y: tp.y - 14, w: 32, h: 28 } : null;
    const me = this.stats(b.attackHero), tagger = this.tag ? this.stats(this.tag.hero) : null;
    const landed = () => {
      // A lunge stops where it connects, with a sliver of safety so it doesn't run into the foe's body.
      b.lungeStop = true; b.invT = Math.max(b.invT, 0.15);
      this.fx.push({ kind: 'slash', x: box!.x + box!.w / 2, y: box!.y + box!.h / 2, t: 0, vx: b.face, vy: 0 });
    };
    for (const e of this.enemies) {
      if (e.dead || ghostFaded(e)) continue;
      const eb = this.foeBox(e);
      if (box && e.hitId !== b.attackId && overlap(box, eb)) { e.hitId = b.attackId; if (this.hitFoe(e, me.atk * this.weaponOf(b.attackHero).mult, b.x, false, me.lck)) landed(); else b.lungeStop = true; }
      if (tagBox && tagger && !this.tag!.hits.has(e.id) && overlap(tagBox, eb)) { this.tag!.hits.add(e.id); this.hitFoe(e, tagger.atk * 1.6 + 4, tp!.x, true, tagger.lck); }
    }
    const boss = this.boss;
    if (boss && boss.move !== 'dying' && boss.move !== 'enter') {
      const bb = this.bossBox(boss);
      if (box && boss.hitId !== b.attackId && overlap(box, bb)) { boss.hitId = b.attackId; this.hitBoss(me.atk * this.weaponOf(b.attackHero).mult, me.lck); landed(); this.hitstop = 0.04; }
      if (tagBox && tagger && !this.tag!.hits.has(-1) && overlap(tagBox, bb)) { this.tag!.hits.add(-1); this.hitBoss(tagger.atk * 1.6 + 4, tagger.lck); }
    }
    for (const c of this.candles) {
      if (!c.alive) continue;
      const cb = { x: c.x - 4, y: c.y - 12, w: 8, h: 14 };
      if ((box && overlap(box, cb)) || (tagBox && overlap(tagBox, cb))) this.snuff(c);
    }
    for (const hb of [box, tagBox]) if (hb) this.breakWalls(hb);
  }
  private breakWalls(hb: Box) {
    for (let c = Math.floor(hb.x / TILE); c <= Math.floor((hb.x + hb.w) / TILE); c++)
      for (let r = Math.floor(hb.y / TILE); r <= Math.floor((hb.y + hb.h) / TILE); r++) {
        if (this.tile(c, r) !== '%') continue;
        // The whole cracked section crumbles at once.
        const stack: [number, number][] = [[c, r]];
        while (stack.length) {
          const [x, y] = stack.pop()!;
          if (this.tile(x, y) !== '%') continue;
          this.flags.add(`wall:${x},${y}`);
          for (let i = 0; i < 3; i++) this.fx.push({ kind: 'rubble', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, t: 0, vx: (this.rand() - 0.5) * 120, vy: -80 - this.rand() * 120 });
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        this.events.push('break'); this.shake = 0.2;
        this.say('A hidden passage!');
      }
  }
  foeBox(e: Enemy): Box { const f = FOES[e.kind]; return { x: e.x - f.w / 2, y: e.y - f.h, w: f.w, h: f.h }; }
  private guarded(e: Enemy, fromX: number) {
    return e.kind === 'armadillo' && e.state !== 'rest' && Math.sign(fromX - e.x) === e.face;
  }
  /** Returns whether the blow did damage (a shield turns it aside). Melee blows (not `pierce`) freeze the frame briefly. */
  private hitFoe(e: Enemy, raw: number, fromX: number, pierce: boolean, lck: number) {
    const f = FOES[e.kind];
    if (!pierce && this.guarded(e, fromX)) {
      this.fx.push({ kind: 'clink', x: e.x + e.face * 10, y: e.y - 10, t: 0, vx: 0, vy: 0 });
      this.pops.push({ x: e.x, y: e.y - f.h - 4, text: 'GUARD', t: 0, color: '#9fb4c8' });
      this.events.push('clink');
      return false;
    }
    const crit = this.rand() * 100 < lck;
    const dmg = Math.max(1, Math.round(raw * (crit ? 1.5 : 1) - f.def));
    e.hp -= dmg; e.flash = 0.15;
    this.pops.push({ x: e.x, y: e.y - f.h - 4, text: String(dmg), t: 0, color: crit ? '#ffd35a' : '#ffffff' });
    this.fx.push({ kind: 'spark', x: e.x, y: e.y - f.h / 2, t: 0, vx: 0, vy: 0 });
    this.events.push(crit ? 'crit' : 'hit');
    if (!pierce) this.hitstop = crit ? 0.08 : 0.05;
    if (!f.fly) { e.vx = Math.sign(e.x - fromX || 1) * 90; e.vy = -90; e.ground = false; }
    else { e.x += Math.sign(e.x - fromX || 1) * 6; }
    if (e.kind === 'spider' && e.state !== 'rest') { e.state = 'rest'; e.stateT = 0; }
    if (e.hp <= 0) this.killFoe(e);
    return true;
  }
  private killFoe(e: Enemy) {
    const f = FOES[e.kind];
    e.dead = 1;
    this.events.push('kill');
    this.fx.push({ kind: 'poof', x: e.x, y: e.y - f.h / 2, t: 0, vx: 0, vy: 0 });
    // The foe crumbles into dust that drifts up.
    for (let i = 0; i < 16; i++) {
      this.fx.push({ kind: 'ash', x: e.x + (this.rand() - 0.5) * f.w, y: e.y - this.rand() * f.h, t: -this.rand() * 0.15, vx: (this.rand() - 0.5) * 50, vy: -10 - this.rand() * 30, color: ASH[e.kind][i % 2] });
    }
    this.gainXp(f.xp);
    for (let i = 0; i < Math.ceil(f.raisins / 3); i++) this.drop('raisin', 'raisin', Math.min(3, f.raisins - i * 3), e.x, e.y - f.h / 2);
    const luck = this.stats(this.leader).lck;
    if (f.drop && this.rand() < f.drop[1] * (1 + luck / 25)) this.drop(GEAR[f.drop[0]] ? 'gear' : 'food', f.drop[0], 1, e.x, e.y - f.h / 2);
  }
  private drop(kind: Pickup['kind'], id: string, amount: number, x: number, y: number) {
    this.pickups.push({ kind, id, amount, x: x + (this.rand() - 0.5) * 10, y, vy: -150 - this.rand() * 60, t: 0, fixed: false });
  }
  private snuff(c: Candle) {
    c.alive = false;
    this.events.push('candle');
    this.fx.push({ kind: 'flame', x: c.x, y: c.y - 10, t: 0, vx: 0, vy: -20 });
    const roll = this.rand();
    if (roll < 0.5) this.drop('seeds', 'seeds', roll < 0.12 ? 5 : 1, c.x, c.y - 8);
    else if (roll < 0.85) this.drop('raisin', 'raisin', roll < 0.6 ? 5 : 1, c.x, c.y - 8);
    else if (roll < 0.93) this.drop('food', 'berry', 1, c.x, c.y - 8);
  }
  gainXp(n: number) {
    this.xp += n;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      const before = { dora: this.stats('dora').maxHp, enzo: this.stats('enzo').maxHp };
      this.level++;
      for (const h of ['dora', 'enzo'] as HeroId[]) if (this.hp[h] > 0) this.hp[h] += this.stats(h).maxHp - before[h];
      this.say(`Level up! Dora and Enzo reach level ${this.level}.`);
      this.events.push('level');
      this.fx.push({ kind: 'star', x: this.body.x, y: this.body.y - 24, t: 0, vx: 0, vy: -30 });
    }
  }

  /** Damage the leader. Knocks them back and gives a moment of safety; at 0 HP the partner takes over. */
  hurtHero(raw: number, fromX: number, hazard = false) {
    const b = this.body;
    if (b.invT > 0 || this.tag || this.state !== 'play') return;
    const dmg = Math.max(1, Math.round(raw - this.stats(this.leader).def));
    this.hp[this.leader] = Math.max(0, this.hp[this.leader] - dmg);
    this.pops.push({ x: b.x, y: b.y - 26, text: String(dmg), t: 0, color: '#ff7a7a' });
    this.events.push('hurt'); this.shake = 0.15;
    const away = b.x < fromX ? -1 : 1;
    b.vx = away * 120; b.vy = hazard ? -380 : -240; b.hurtT = 0.3; b.invT = 1; b.dashT = 0; b.attackT = 0; b.ground = false;
    if (this.hp[this.leader] <= 0) {
      const down = this.leader;
      this.events.push('down');
      if (this.hp[other(down)] > 0) {
        this.doTag(true);
        this.say(`${down === 'dora' ? 'Dora' : 'Enzo'} is worn out! A dust bath will get them back on their paws.`, 3.2);
      } else {
        this.state = 'dead';
        this.events.push('dead');
      }
    }
  }

  private enemyStep(dt: number) {
    const b = this.body, me = { x: b.x - HERO_W / 2, y: b.y - HERO_H, w: HERO_W, h: HERO_H };
    for (const e of this.enemies) {
      if (e.dead) { e.dead += dt; continue; }
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.stateT += dt;
      const dx = b.x - e.x, dy = b.y - 10 - (e.y - FOES[e.kind].h / 2), dist = Math.hypot(dx, dy);
      if (e.kind === 'bat') {
        if (e.state === 'idle') { if (Math.abs(dx) < 120 && Math.abs(dy) < 110) { e.state = 'awake'; this.events.push('flap'); } }
        else {
          e.face = dx > 0 ? 1 : -1;
          e.x += clamp(dx, -1, 1) * 72 * dt;
          const ty = b.y - 8 + Math.sin(e.t * 4) * 20;
          e.y += clamp(ty - e.y, -90 * dt, 90 * dt);
        }
      } else if (e.kind === 'moth') {
        if (dist < 200) { e.x += clamp(dx, -1, 1) * 26 * dt; e.y += clamp(dy + 6, -1, 1) * 20 * dt; e.face = dx > 0 ? 1 : -1; }
        e.y += Math.sin(e.t * 3) * 18 * dt;
      } else if (e.kind === 'ghost') {
        // Drifts after you, fading in and out of sight.
        if (dist < 220) { e.x += clamp(dx / 40, -1, 1) * 40 * dt; e.y += clamp(dy / 40, -1, 1) * 30 * dt; e.face = dx > 0 ? 1 : -1; }
        e.y += Math.sin(e.t * 2.4) * 14 * dt;
      } else if (e.kind === 'spider') {
        // Hangs on a thread, drops when you pass underneath, then climbs back up.
        const reel = (dy2: number, speed: number) => { e.y += clamp(dy2, -speed * dt, speed * dt); };
        if (e.state === 'idle') { if (Math.abs(dx) < 26 && b.y > e.y && b.y - e.y < 170) { e.state = 'lunge'; e.stateT = 0; this.events.push('drop'); } }
        else if (e.state === 'lunge') {
          const floorBelow = isSolid(this.tile(Math.floor(e.x / TILE), Math.floor((e.y + 2) / TILE)));
          if (floorBelow || e.y - e.hy > 160 || e.stateT > 0.9) { e.state = 'awake'; e.stateT = 0; }
          else e.y += 280 * dt;
        } else if (e.state === 'awake') { if (e.stateT > 0.7) { e.state = 'rest'; e.stateT = 0; } }
        else { reel(e.hy - e.y, 70); if (Math.abs(e.y - e.hy) < 1) { e.state = 'idle'; e.stateT = 0; } }
        e.face = dx > 0 ? 1 : -1;
      } else {
        const f = FOES[e.kind];
        let speed = e.kind === 'beetle' ? 38 : e.kind === 'bone' ? 22 : e.kind === 'rat' ? 34 : 20;
        if (e.kind === 'rat') {
          // Scurries about, then spots you, bristles and charges.
          if (e.state === 'wind') { speed = 0; if (e.stateT > 0.35) { e.state = 'lunge'; e.stateT = 0; this.events.push('squeak'); } }
          else if (e.state === 'lunge') { speed = 230; if (e.stateT > 0.55) { e.state = 'rest'; e.stateT = 0; } }
          else if (e.state === 'rest') { speed = 0; if (e.stateT > 0.6) { e.state = 'idle'; e.stateT = 0; } }
          else if (e.stateT > 1 && Math.abs(dx) < 150 && Math.abs(dy) < 40 && e.ground) { e.state = 'wind'; e.stateT = 0; e.face = dx > 0 ? 1 : -1; }
        }
        if (e.kind === 'bone') {
          if (e.state === 'throw') { speed = 0; if (e.stateT > 0.5) { e.state = 'idle'; e.stateT = 0; } }
          else if (e.stateT > 2.2 && Math.abs(dx) < 190 && Math.abs(dy) < 90) {
            e.state = 'throw'; e.stateT = 0; e.face = dx > 0 ? 1 : -1;
            this.shots.push({ kind: 'bone', x: e.x, y: e.y - 14, vx: clamp(dx * 1.1, -170, 170), vy: -300, grav: 700, r: 5, dmg: 9, hero: false, life: 3, spin: 0 });
            this.events.push('throw');
          }
        }
        if (e.kind === 'armadillo') {
          speed = 0;
          if (e.state === 'idle' || e.state === 'awake') {
            if (Math.abs(dx) < 170 && Math.abs(dy) < 60) { e.face = dx > 0 ? 1 : -1; speed = 20; e.state = 'awake'; }
            if (e.state === 'awake' && Math.abs(dx) < 90 && e.stateT > 2.2) { e.state = 'wind'; e.stateT = 0; }
          } else if (e.state === 'wind') { if (e.stateT > 0.4) { e.state = 'lunge'; e.stateT = 0; this.events.push('lunge'); } }
          else if (e.state === 'lunge') { speed = 220; if (e.stateT > 0.35) { e.state = 'rest'; e.stateT = 0; } }
          else if (e.state === 'rest' && e.stateT > 0.8) { e.state = 'awake'; e.stateT = 0; }
        }
        if (e.ground) {
          // Walkers turn at walls and ledges.
          const ahead = e.x + e.face * (f.w / 2 + 2);
          const wall = isSolid(this.tile(Math.floor(ahead / TILE), Math.floor((e.y - 4) / TILE)));
          const floor = this.supported(ahead, e.y, 2);
          if ((wall || !floor) && e.kind !== 'armadillo' && !(e.kind === 'rat' && e.state === 'lunge')) e.face = -e.face as 1 | -1;
          if ((wall || !floor) && (e.kind === 'armadillo' || (e.kind === 'rat' && e.state === 'lunge'))) { speed = 0; if (e.kind === 'rat') { e.state = 'rest'; e.stateT = 0; } }
          e.vx = e.face * speed;
        }
        e.vy = Math.min(e.vy + G * dt, MAX_FALL);
        const hit = this.move(e, f.w, f.h, dt, true);
        e.ground = hit.down || (e.vy === 0 && this.supported(e.x, e.y, f.w));
        const rr = roomRect(this.room);
        if (e.y > rr.y + rr.h + 40) e.dead = 1;
      }
      if (!ghostFaded(e) && overlap(me, this.foeBox(e))) this.hurtHero(FOES[e.kind].atk, e.x);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.dead < 0.4);
  }

  // ─── Bosses ─────────────────────────────────────────────────────────────
  bossBox(o: Boss): Box { const k = BOSSES[o.kind]; return { x: o.x - k.w / 2, y: o.y - k.h / 2, w: k.w, h: k.h }; }
  private bossStep(dt: number) {
    const room = this.room, kind = room.boss;
    if (!kind || this.flags.has(`boss:${kind}`)) return;
    const rr = roomRect(room), b = this.body;
    if (!this.fight) {
      if (b.x > rr.x + 3 * TILE && b.x < rr.x + rr.w - 3 * TILE) {
        this.fight = true;
        this.events.push('gate');
        if (!this.flags.has(`script:${kind}`)) { this.flags.add(`script:${kind}`); this.talk(kind); }
        const k = BOSSES[kind];
        this.boss = { kind, x: rr.x + rr.w / 2, y: rr.y - 30, vx: 0, vy: 0, hp: k.hp, max: k.hp, move: 'enter', t: 0, face: -1, flash: 0, phase2: false, summoned: false, sx: 0, ex: 0, side: 1, last: [], hitId: -1 };
      }
      return;
    }
    const o = this.boss;
    if (!o) return;
    o.t += dt; o.flash = Math.max(0, o.flash - dt);
    if (o.kind === 'owl') this.owlStep(o, dt, rr); else this.ratStep(o, dt, rr);
    if (o.move === 'dying') {
      if (Math.floor(o.t * 10) !== Math.floor((o.t - dt) * 10)) this.fx.push({ kind: 'boom', x: o.x + (this.rand() - 0.5) * 40, y: o.y + (this.rand() - 0.5) * 30, t: 0, vx: 0, vy: 0 });
      if (o.t > 2) this.bossDown();
      return;
    }
    const k = BOSSES[o.kind];
    if (!o.phase2 && o.hp <= o.max / 2) {
      o.phase2 = true;
      if (!o.summoned) {
        o.summoned = true;
        const left = rr.x + 40, right = rr.x + rr.w - 40;
        for (const x of [left, right]) {
          const e = o.kind === 'owl' ? this.spawn('bat', x, rr.y + 60) : this.spawn('rat', x, rr.y + 12 * TILE);
          e.state = o.kind === 'owl' ? 'awake' : 'idle'; e.face = x < o.x ? 1 : -1;
        }
      }
      this.say(o.kind === 'owl' ? 'Duke Hootsworth ruffles up in a fury!' : 'Gnawdrick gnashes his teeth and calls his rats!');
      this.events.push('screech');
    }
    if (o.move !== 'enter') {
      const me = { x: b.x - HERO_W / 2, y: b.y - HERO_H, w: HERO_W, h: HERO_H };
      if (overlap(me, { x: o.x - k.w / 2 + 4, y: o.y - k.h / 2 + 4, w: k.w - 8, h: k.h - 8 })) this.hurtHero(k.atk, o.x);
    }
  }
  private pickMove(o: Boss, options: string[]) {
    let pick = options[Math.floor(this.rand() * options.length)];
    if (o.last.length >= 2 && o.last.every((m) => m === pick)) pick = options.find((m) => m !== pick)!;
    o.last = [...o.last.slice(-1), pick];
    return pick;
  }
  private owlStep(o: Boss, dt: number, rr: Box) {
    const b = this.body;
    const floor = rr.y + 12 * TILE, left = rr.x + 40, right = rr.x + rr.w - 40, top = rr.y + 60;
    const go = (move: OwlMove) => { o.move = move; o.t = 0; };
    const toward = (tx: number, ty: number, k: number) => { o.x += (tx - o.x) * Math.min(1, k * dt); o.y += (ty - o.y) * Math.min(1, k * dt); };
    if (o.move !== 'dying' && o.move !== 'swoop') o.face = b.x > o.x ? 1 : -1;
    const speed = o.phase2 ? 1.3 : 1;
    switch (o.move as OwlMove) {
      case 'enter':
        toward(rr.x + rr.w / 2, top + 10, 3);
        if (o.t > 1.3) { go('hover'); this.events.push('hoot'); }
        break;
      case 'hover': {
        const hx = o.side > 0 ? right - 50 : left + 50;
        toward(hx, top + Math.sin(this.time * 3) * 8, 3);
        if (o.t > 0.8 / speed) {
          const pick = this.pickMove(o, o.phase2 ? ['feathers', 'swoop', 'dive'] : ['feathers', 'swoop']);
          if (pick === 'feathers') go('feathers');
          else if (pick === 'swoop') { o.sx = o.side > 0 ? right : left; o.ex = o.side > 0 ? left : right; go('rise'); }
          else go('track');
        }
        break;
      }
      case 'feathers':
        toward(o.x, top, 2);
        if (o.t > 0.5 / speed && o.t - dt <= 0.5 / speed) {
          const n = o.phase2 ? 5 : 3, aim = Math.atan2(b.y - 12 - o.y, b.x - o.x);
          for (let i = 0; i < n; i++) {
            const a = aim + (i - (n - 1) / 2) * 0.22;
            this.shots.push({ kind: 'feather', x: o.x, y: o.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, grav: 0, r: 5, dmg: 9, hero: false, life: 3, spin: a });
          }
          this.events.push('feathers');
        }
        if (o.t > 1.0 / speed) { o.side = -o.side; go('hover'); }
        break;
      case 'rise':
        toward(o.sx, top, 5);
        if (o.t > 0.6) { go('swoop'); this.events.push('screech'); }
        break;
      case 'swoop': {
        const dur = o.phase2 ? 1.1 : 1.4, u = Math.min(1, o.t / dur);
        o.face = o.ex > o.sx ? 1 : -1;
        o.x = o.sx + (o.ex - o.sx) * u;
        o.y = top + (floor - 10 - OWL.h / 2 - top) * Math.sin(Math.PI * u);
        if (u >= 1) { o.side = o.ex > rr.x + rr.w / 2 ? 1 : -1; go('hover'); }
        break;
      }
      case 'track':
        toward(clamp(b.x, left, right), rr.y + 44, 4);
        if (o.t > 0.7) go('drop');
        break;
      case 'drop':
        o.y += 520 * dt;
        if (o.y >= floor - OWL.h / 2) {
          o.y = floor - OWL.h / 2;
          this.waves(o.x, floor, 14, 11);
          go('rest');
        }
        break;
      case 'rest':
        if (o.t > 0.7) go('hover');
        break;
      case 'dying':
        if (Math.floor(o.t * 6) !== Math.floor((o.t - dt) * 6)) this.fx.push({ kind: 'feather', x: o.x, y: o.y, t: 0, vx: (this.rand() - 0.5) * 160, vy: -120 * this.rand() });
        o.y += 20 * dt;
        break;
    }
  }
  /** Two shockwaves running out along the floor from x. */
  private waves(x: number, floor: number, gap: number, dmg: number) {
    for (const d of [-1, 1]) this.shots.push({ kind: 'wave', x: x + d * gap, y: floor - 6, vx: d * 190, vy: 0, grav: 0, r: 7, dmg, hero: false, life: 2.2, spin: 0 });
    this.shake = 0.35; this.events.push('quake');
  }
  /**
   * Gnawdrick the Rat King fights on the floor: he charges wall to wall and stuns himself (loosening rocks from the
   * ceiling), leaps at you and lands with shockwaves, and bowls wheels of cheese. At half HP he calls two rats.
   */
  private ratStep(o: Boss, dt: number, rr: Box) {
    const b = this.body, k = RAT;
    const floor = rr.y + 12 * TILE, left = rr.x + 2 * TILE + k.w / 2, right = rr.x + rr.w - 2 * TILE - k.w / 2, ground = floor - k.h / 2;
    const go = (move: RatMove) => { o.move = move; o.t = 0; };
    const fast = o.phase2 ? 1.25 : 1;
    const land = () => { o.vy = Math.min(o.vy + G * dt, 700); o.y += o.vy * dt; if (o.y >= ground) { o.y = ground; o.vy = 0; return true; } return false; };
    switch (o.move as RatMove) {
      case 'enter':
        if (o.t < 0.6) o.y = rr.y - 30;
        else if (land()) { this.shake = 0.4; this.events.push('quake'); go('idle'); this.events.push('roar'); }
        break;
      case 'idle':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.75 / fast) {
          const pick = this.pickMove(o, ['charge', 'leap', 'cheese']);
          go(pick === 'charge' ? 'wind' : pick === 'leap' ? 'crouch' : 'cheese');
        }
        break;
      case 'wind':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.6 / fast) { go('charge'); this.events.push('roar'); }
        break;
      case 'charge': {
        o.x += o.face * 300 * fast * dt;
        if (Math.floor(o.t * 20) !== Math.floor((o.t - dt) * 20)) this.fx.push({ kind: 'dust', x: o.x - o.face * 18, y: floor - 2, t: 0, vx: -o.face * 40, vy: -20 });
        const wall = o.face > 0 ? right : left;
        if ((o.x - wall) * o.face >= 0) {
          o.x = wall; go('stunned');
          this.shake = 0.5; this.events.push('quake');
          // The crash shakes rocks loose from the ceiling.
          const n = o.phase2 ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const x = rr.x + 3 * TILE + this.rand() * (rr.w - 6 * TILE);
            this.shots.push({ kind: 'rock', x, y: rr.y + 3 * TILE + 4, vx: 0, vy: 0, grav: 500 + this.rand() * 300, r: 5, dmg: 12, hero: false, life: 3, spin: this.rand() * 6 });
          }
        }
        break;
      }
      case 'stunned':
        if (o.t > 1.3) go('idle');
        break;
      case 'crouch':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.35) {
          const target = clamp(b.x, left, right);
          o.vx = (target - o.x) / 0.72; o.vy = -500; go('leap');
          this.events.push('jump');
        }
        break;
      case 'leap':
        o.x = clamp(o.x + o.vx * dt, left, right);
        if (land() && o.t > 0.1) { this.waves(o.x, floor, 20, 13); go('idle'); }
        break;
      case 'cheese':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.45 && o.t - dt <= 0.45) {
          this.shots.push({ kind: 'cheese', x: o.x + o.face * 26, y: floor - 8, vx: o.face * 150, vy: 0, grav: 0, r: 8, dmg: 12, hero: false, life: 4.5, spin: 0 });
          if (o.phase2) this.shots.push({ kind: 'cheese', x: o.x + o.face * 20, y: o.y - 20, vx: o.face * 110, vy: -380, grav: 900, r: 8, dmg: 12, hero: false, life: 4.5, spin: 0 });
          this.events.push('throw');
        }
        if (o.t > 0.9) go('idle');
        break;
      case 'dying':
        o.y = ground + Math.sin(o.t * 40) * 1;
        break;
    }
  }
  hitBoss(raw: number, lck: number) {
    const o = this.boss!, k = BOSSES[o.kind];
    const crit = this.rand() * 100 < lck;
    // A stunned Rat King takes extra.
    const open = o.kind === 'rat' && o.move === 'stunned' ? 1.25 : 1;
    const dmg = Math.max(1, Math.round(raw * open * (crit ? 1.5 : 1) - k.def));
    o.hp = Math.max(0, o.hp - dmg); o.flash = 0.12;
    this.pops.push({ x: o.x, y: o.y - k.h / 2 - 6, text: String(dmg), t: 0, color: crit ? '#ffd35a' : '#ffffff' });
    this.fx.push({ kind: 'spark', x: o.x, y: o.y, t: 0, vx: 0, vy: 0 });
    this.events.push(crit ? 'crit' : 'hit');
    if (o.hp <= 0) { o.move = 'dying'; o.t = 0; this.shots = this.shots.filter((s) => s.hero); this.events.push('bossdie'); this.enemies.forEach((e) => (e.dead = e.dead || 1)); }
  }
  private bossDown() {
    const o = this.boss!;
    this.flags.add(`boss:${o.kind}`);
    this.fight = false;
    this.boss = null;
    this.gainXp(BOSSES[o.kind].xp);
    this.pickups.push({ kind: 'leaf', id: 'leaf', amount: 1, x: o.x, y: o.y, vy: -120, t: 0, flag: `leaf:${o.kind}`, fixed: false });
    for (let i = 0; i < 24; i++) this.fx.push({ kind: 'ash', x: o.x + (this.rand() - 0.5) * 40, y: o.y + (this.rand() - 0.5) * 30, t: -this.rand() * 0.3, vx: (this.rand() - 0.5) * 60, vy: -20 - this.rand() * 40, color: o.kind === 'owl' ? '#c8b088' : '#d8c070' });
    this.events.push('victory');
    this.talk(`${o.kind}Down`, `chapter${o.kind === 'owl' ? 1 : 2}`);
  }

  private shotStep(dt: number) {
    const b = this.body, me = { x: b.x - HERO_W / 2, y: b.y - HERO_H, w: HERO_W, h: HERO_H };
    for (const s of this.shots) {
      s.life -= dt; s.vy += s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.spin += dt * 12;
      const box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.kind === 'wave') {
        if (isSolid(this.tile(Math.floor((s.x + Math.sign(s.vx) * 6) / TILE), Math.floor((s.y - 2) / TILE)))) s.life = 0;
      } else if (s.kind === 'cheese') {
        // Cheese wheels roll along the floor and bounce back off walls; lobbed ones bounce along.
        if (isSolid(this.tile(Math.floor((s.x + Math.sign(s.vx) * (s.r + 1)) / TILE), Math.floor(s.y / TILE)))) { s.vx = -s.vx; s.x += s.vx * dt * 2; }
        if (s.vy > 0 && this.solidAt(s.x, s.y + s.r)) { s.y = Math.floor((s.y + s.r) / TILE) * TILE - s.r; s.vy = s.grav ? -Math.max(200, s.vy * 0.75) : 0; }
      } else if (this.solidAt(s.x, s.y)) {
        if (s.kind === 'rock') for (let i = 0; i < 3; i++) this.fx.push({ kind: 'rubble', x: s.x, y: s.y - 2, t: 0.3, vx: (this.rand() - 0.5) * 100, vy: -60 - this.rand() * 80 });
        if (s.hero) this.breakWalls(box);
        s.life = 0;
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, t: 0.2, vx: 0, vy: 0 });
      }
      if (s.life <= 0) continue;
      if (s.hero) {
        for (const e of this.enemies) if (!e.dead && !ghostFaded(e) && overlap(box, this.foeBox(e))) { this.hitFoe(e, s.dmg, s.x - s.vx, true, 0); s.life = 0; break; }
        for (const c of this.candles) if (s.life > 0 && c.alive && overlap(box, { x: c.x - 4, y: c.y - 12, w: 8, h: 14 })) { this.snuff(c); s.life = 0; }
        const o = this.boss;
        if (s.life > 0 && o && o.move !== 'dying' && o.move !== 'enter' && overlap(box, this.bossBox(o))) { this.hitBoss(s.dmg, 0); s.life = 0; }
      } else if (overlap(box, me)) { this.hurtHero(s.dmg, s.x - s.vx); if (s.kind !== 'wave' && s.kind !== 'cheese') s.life = 0; }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private pickupStep(dt: number) {
    const b = this.body, me = { x: b.x - 10, y: b.y - HERO_H - 4, w: 20, h: HERO_H + 8 };
    for (const p of this.pickups) {
      p.t += dt;
      if (!p.fixed) {
        const o = { x: p.x, y: p.y, vx: 0, vy: p.vy };
        o.vy = Math.min(o.vy + G * 0.7 * dt, MAX_FALL);
        this.move(o, 6, 6, dt, true);
        p.x = o.x; p.y = o.y; p.vy = o.vy;
      }
      if (p.t > 0.25 && overlap(me, { x: p.x - 6, y: p.y - 12, w: 12, h: 12 })) this.collect(p);
      if (!p.fixed && !p.flag && p.t > 12) p.t = -1e9;
    }
    this.pickups = this.pickups.filter((p) => p.t > -1e8 && p.amount > 0);
  }
  private collect(p: Pickup) {
    if (p.flag) this.flags.add(p.flag);
    const amount = p.amount;
    p.amount = 0;
    const add = (id: string) => { this.bag[id] = (this.bag[id] ?? 0) + 1; };
    switch (p.kind) {
      case 'raisin': this.raisins += amount; this.events.push('raisin'); break;
      case 'seeds': this.seeds = Math.min(99, this.seeds + amount); this.events.push('seedpick'); break;
      case 'food': add(p.id); this.say(`Found a ${FOOD[p.id].name}!`); this.events.push('item'); break;
      case 'gear': add(p.id); this.say(`Found the ${GEAR[p.id].name}! Equip it from the menu.`); this.events.push('item'); break;
      case 'leaf':
        this.leaves++;
        for (const h of ['dora', 'enzo'] as HeroId[]) if (this.hp[h] > 0) this.hp[h] += LEAF_HP;
        this.say(`A Wolfberry Leaf! Max HP +${LEAF_HP} for both.`); this.events.push('leaf');
        break;
      case 'relic':
        this.relics.add(p.id as RelicId);
        this.events.push('relic');
        this.talk(p.id);
        break;
    }
  }
  /** Shrines and signs under the leader's feet. */
  private touchStep(pressed: (k: keyof Input) => boolean) {
    const b = this.body, c = Math.floor(b.x / TILE), r = Math.floor((b.y - 1) / TILE);
    const here = rawTile(c, r);
    if (here === 'S') {
      if (!this.atShrine) {
        this.atShrine = true;
        this.hp.dora = this.stats('dora').maxHp; this.hp.enzo = this.stats('enzo').maxHp;
        this.saved = this.snapshot();
        this.events.push('save');
        this.say('Saved. A warm dust bath restores Dora and Enzo.', 3);
        for (let i = 0; i < 8; i++) this.fx.push({ kind: 'dust', x: b.x + (i - 4) * 4, y: b.y - 2, t: -i * 0.04, vx: (i - 4) * 10, vy: -40 });
      }
    } else if (this.atShrine && rawTile(c - 1, r) !== 'S' && rawTile(c + 1, r) !== 'S') {
      // Stepping well clear of the shrine arms it again.
      this.atShrine = false;
    }
    this.sign = -1; this.stall = false;
    if (here === 'n') {
      const room = this.room, rc = c - room.mx * COLS, rr = r - room.my * ROWS;
      let n = 0;
      for (let y = 0; y < room.rows.length; y++) for (let x = 0; x < room.rows[y].length; x++) if (room.rows[y][x] === 'n') { if (x === rc && y === rr) this.sign = n; n++; }
      if (this.sign >= 0 && pressed('up')) {
        this.dialog = { lines: [{ who: 'sign', text: room.notes?.[this.sign] ?? '' }], i: 0 };
        this.events.push('talk');
      }
    } else if (here === '$' || rawTile(c - 1, r) === '$' || rawTile(c + 1, r) === '$') {
      this.stall = true;
      if (pressed('up')) { this.shop = true; this.events.push('shop'); }
    }
  }
  /** What pressing up would do where the leader stands, so the page can show a prompt. */
  get prompt(): 'READ' | 'SHOP' | null { return this.sign >= 0 ? 'READ' : this.stall ? 'SHOP' : null; }
  get atSign() { return this.sign >= 0; }
  /** Buy from Pip's stall. Returns whether the raisins changed hands. */
  buy(id: string) {
    const item = SHOP.find((s) => s.id === id);
    if (!item || this.raisins < item.price || (id === 'seeds' && this.seeds >= 99)) return false;
    this.raisins -= item.price;
    if (id === 'seeds') this.seeds = Math.min(99, this.seeds + 10);
    else this.bag[id] = (this.bag[id] ?? 0) + 1;
    this.events.push('buy');
    return true;
  }
  closeShop() { this.shop = false; }
  /** Leave the chapter card and keep exploring. */
  resume() { if (this.state === 'chapter') this.state = 'play'; }

  // ─── Menu actions ───────────────────────────────────────────────────────
  /** Owned copies of `id` not currently worn. */
  spare(id: string) { return this.bag[id] ?? 0; }
  canEquip(h: HeroId, id: string) { const g = GEAR[id]; return !!g && (!g.hero || g.hero === h) && this.spare(id) > 0; }
  equip(h: HeroId, slot: Slot, id: string | null) {
    if (id && (!this.canEquip(h, id) || GEAR[id].slot !== slot)) return false;
    if (slot === 'weapon' && !id) return false;
    const old = this.equipped[h][slot];
    if (old) this.bag[old] = (this.bag[old] ?? 0) + 1;
    if (id) { this.bag[id]--; if (!this.bag[id]) delete this.bag[id]; }
    this.equipped[h][slot] = id;
    for (const k of ['dora', 'enzo'] as HeroId[]) this.hp[k] = Math.min(this.hp[k], this.stats(k).maxHp);
    return true;
  }
  eat(id: string, h: HeroId) {
    const food = FOOD[id];
    if (!food || !this.bag[id]) return false;
    const max = this.stats(h).maxHp;
    if (this.hp[h] >= max) return false;
    this.hp[h] = Math.min(max, this.hp[h] + food.heal);
    this.bag[id]--; if (!this.bag[id]) delete this.bag[id];
    this.events.push('eat');
    return true;
  }

  snapshot(): Save {
    const b = this.body;
    return {
      v: 1, room: this.room.id, x: b.x, y: b.y, level: this.level, xp: this.xp, hp: { ...this.hp }, leader: this.leader,
      equip: { dora: { ...this.equipped.dora }, enzo: { ...this.equipped.enzo } }, bag: { ...this.bag }, relics: [...this.relics],
      flags: [...this.flags], visited: [...this.visited],
      raisins: this.raisins, seeds: this.seeds, time: this.time, leaves: this.leaves,
    };
  }
}

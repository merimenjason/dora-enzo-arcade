// Burrow Command's simulation: a deterministic real-time strategy match on a fixed 20 Hz tick. Positions are whole
// numbers of world units (256 to a tile), randomness comes from a seeded generator, and every order a player gives is
// logged with its tick, so a seed and the order log replay a match exactly. No DOM: the scene and page only read it.
import {
  ABILITIES, BUILDINGS, CARRY, DIRT, GATHER_TICKS, GRASS, MAX_SUPPLY, NODE_AMOUNT, NODE_SLOTS, REWIND_RATE, ROCK, SALVAGE, SALVAGE_REACH,
  SHELL_MEND, SHELL_REST, HERO_MEND, HERO_REST, SIDES, SLOW, START_HAY, START_WORKERS, T, TICK_HZ, TIME_LIMIT_MIN, TRAP, TREE, TUNNEL_REACH, TUNNEL_SECONDS, UNITS, UNIT_REQ,
  UPGRADES, WATER, WIND_SECONDS, WOUND_DOWN, hash2,
  type AbilityId, type BuildingDef, type Feature, type MapDef, type Res, type SideId, type UnitDef,
} from './command-data.js';
import { findPath, smooth, spiral, open, type Grid } from './command-path.js';

export * from './command-data.js';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
export const PLAYER_COLORS = ['#4f8fe8', '#e8596b', '#e8b53a', '#5fbf6a'];

export type Order =
  | { k: 'move'; x: number; y: number }
  | { k: 'amove'; x: number; y: number }
  | { k: 'patrol'; x: number; y: number; ax: number; ay: number }
  | { k: 'attack'; t: number }
  | { k: 'gather'; n: number }
  | { k: 'return'; resume: number }
  | { k: 'build'; b: string; tx: number; ty: number; site: number; paid: boolean }
  | { k: 'help'; t: number }
  | { k: 'hold' }
  | { k: 'tunnel'; t: number }
  | { k: 'ability'; ab: AbilityId; x: number; y: number };

export type Unit = {
  id: number; kind: 'unit'; type: string; def: UnitDef; owner: number;
  x: number; y: number; hp: number; maxHp: number; face: 1 | -1;
  order: Order | null; queue: Order[];
  path: number[] | null; pi: number; pathKey: number; pathAt: number;
  /** progress check for getting unstuck */ chkX: number; chkY: number; chkAt: number; stuck: number;
  target: number; cd: number; lostAt: number;
  carry: number; carryRes: Res; work: number; workNode: number;
  wind: number; slow: number; root: number; stun: number; haste: number; hasteAmt: number; firm: number; hurtAt: number; abCd: number;
  under: number; tunnelTo: number; homeX: number; homeY: number; back: boolean;
  /** the slowest step of the group it marches with (0: its own pace) */ pace: number;
  /** for drawing: the tick of the last swing, and whether it moved this tick */ hitAt: number; moving: boolean; springAt: number; nearSpring: boolean;
};
export type Prod = { k: 'unit' | 'up'; id: string; left: number; total: number; started: boolean };
export type Building = {
  id: number; kind: 'building'; type: string; def: BuildingDef; owner: number;
  tx: number; ty: number; size: number; x: number; y: number; hp: number; maxHp: number;
  done: boolean; progress: number; builders: number; queue: Prod[];
  rally: { x: number; y: number; node: number } | null; cd: number; target: number; abCd: number; hitAt: number; hurtAt: number;
};
export type Node = { id: number; kind: 'node'; res: Res; tx: number; ty: number; x: number; y: number; amount: number; max: number; busy: number[] };
export type Trap = { id: number; owner: number; x: number; y: number };
export type Cloud = { x: number; y: number; r: number; left: number; owner: number };
export type Player = {
  id: number; side: SideId; team: number; name: string; color: string; ai: Difficulty | null;
  hay: number; glimmer: number; used: number; cap: number;
  ups: Record<string, boolean>; out: boolean; alertAt: number;
  stats: { hay: number; glimmer: number; trained: number; built: number; poofed: number; lost: number; salvage: number };
};
export type Ev =
  | { k: 'shot'; x: number; y: number; tx: number; ty: number; shot: string; owner: number; air: boolean }
  | { k: 'hit'; x: number; y: number; dmg: number; id: number; owner: number }
  | { k: 'poof'; x: number; y: number; type: string; owner: number; air: boolean }
  | { k: 'tidy'; x: number; y: number; type: string; owner: number; size: number }
  | { k: 'built'; id: number; owner: number; type: string }
  | { k: 'trained'; id: number; owner: number; type: string }
  | { k: 'research'; owner: number; up: string }
  | { k: 'ability'; ab: AbilityId; x: number; y: number; owner: number; r: number }
  | { k: 'trap'; x: number; y: number; owner: number }
  | { k: 'salvage'; x: number; y: number; owner: number; hay: number; glimmer: number }
  | { k: 'drop'; x: number; y: number; owner: number; res: Res; amt: number }
  | { k: 'alert'; owner: number; x: number; y: number }
  | { k: 'msg'; owner: number; text: string }
  | { k: 'tunnel'; x: number; y: number; owner: number; up: boolean }
  | { k: 'out'; owner: number }
  | { k: 'say'; who: string; text: string };

export type Cmd = { p: number } & (
  | { k: 'move' | 'amove' | 'patrol'; ids: number[]; x: number; y: number; q?: boolean }
  | { k: 'attack'; ids: number[]; t: number; q?: boolean }
  | { k: 'gather'; ids: number[]; n: number; q?: boolean }
  | { k: 'help'; ids: number[]; t: number; q?: boolean }
  | { k: 'return'; ids: number[]; q?: boolean }
  | { k: 'stop' | 'hold'; ids: number[] }
  | { k: 'build'; ids: number[]; b: string; tx: number; ty: number; q?: boolean }
  | { k: 'train'; bid: number; u: string }
  | { k: 'research'; bid: number; up: string }
  | { k: 'cancel'; bid: number }
  | { k: 'rally'; bids: number[]; x: number; y: number }
  | { k: 'ability'; ids: number[]; ab: AbilityId; x?: number; y?: number; q?: boolean }
  | { k: 'tunnel'; ids: number[]; t: number; q?: boolean }
);

export type SlotCfg = { side: SideId; team: number; ai?: Difficulty | null; name?: string; color?: string };
export type MatchCfg = {
  map: MapDef; seed: number; slots: SlotCfg[];
  /** Skip the usual HQ and five workers (a mission sets its own pieces). */
  bare?: boolean;
  /** No winner from knocking a side out: the mission decides. */
  scripted?: boolean;
  fog?: boolean;
  /** Ticks before a stalled match is called on score; 0 for none. */
  limit?: number;
};
export interface Brain { think(w: World, p: Player): void }
export interface Script { tick(w: World): void }

/** mulberry32: a seeded generator, so a seed replays a match exactly. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const isqrt = (n: number) => Math.floor(Math.sqrt(n));
export const dist = (ax: number, ay: number, bx: number, by: number) => isqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
const secs = (s: number) => Math.round(s * TICK_HZ);
export const tiles = (n: number) => Math.round(n * T);
const CELL = 2 * T;

/** The ground terrain a feature paints. */
const PAINT: Record<string, number> = { pond: WATER, wood: TREE, rocks: ROCK, clear: GRASS, path: DIRT };
const blocks = (t: number) => t === WATER || t === TREE || t === ROCK;

/** Builds a map's terrain and resource spots (mirrored for a fair 1-on-1 when the map asks). */
export function layout(map: MapDef) {
  const { w: W, h: H } = map, terrain = new Uint8Array(W * H);
  const feats: Feature[] = [...map.features];
  const starts = map.starts.map((s) => [s[0], s[1]] as [number, number]), sites = map.sites.map((s) => [s[0], s[1]] as [number, number]);
  if (map.mirror) {
    for (const f of map.features) feats.push(f.t === 'hay' || f.t === 'glimmer' ? { t: f.t, x: W - 2 - f.x, y: H - 2 - f.y } : { ...f, x: W - f.x, y: H - f.y });
    for (const s of map.starts) starts.push([W - 3 - s[0], H - 3 - s[1]]);
    for (const s of map.sites) sites.push([W - 3 - s[0], H - 3 - s[1]]);
  }
  const noise = (i: number, j: number) => (hash2(i, j, 7) + hash2(W - 1 - i, H - 1 - j, 7)) / 2;
  for (const f of feats) {
    if (f.t === 'hay' || f.t === 'glimmer') continue;
    const { rx, ry } = f as { rx: number; ry: number };
    const wob = f.t === 'clear' || f.t === 'path' ? 0 : 0.55;
    for (let j = Math.floor(f.y - ry - 1); j <= f.y + ry + 1; j++) for (let i = Math.floor(f.x - rx - 1); i <= f.x + rx + 1; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const dx = (i + 0.5 - f.x) / rx, dy = (j + 0.5 - f.y) / ry;
      if (dx * dx + dy * dy <= 1 + (noise(i, j) - 0.5) * wob) terrain[j * W + i] = PAINT[f.t];
    }
  }
  // homes and expansion spots stay clear
  for (const [x, y] of [...starts, ...sites]) for (let j = y - 4; j <= y + 6; j++) for (let i = x - 4; i <= x + 6; i++) {
    if (i < 0 || j < 0 || i >= W || j >= H) continue;
    const dx = i - (x + 1), dy = j - (y + 1);
    if (dx * dx + dy * dy <= 27 && blocks(terrain[j * W + i])) terrain[j * W + i] = GRASS;
  }
  const nodes: { res: Res; x: number; y: number }[] = [];
  for (const f of feats) if (f.t === 'hay' || f.t === 'glimmer') {
    const x = Math.max(0, Math.min(W - 2, f.x)), y = Math.max(0, Math.min(H - 2, f.y));
    for (let j = y; j < y + 2; j++) for (let i = x; i < x + 2; i++) terrain[j * W + i] = GRASS;
    nodes.push({ res: f.t === 'hay' ? 'hay' : 'glimmer', x, y });
  }
  return { terrain, starts, sites, nodes };
}

export class World {
  readonly cfg: MatchCfg;
  readonly map: MapDef;
  readonly W: number; readonly H: number;
  readonly terrain: Uint8Array;
  /** What stands on each tile: a building or node id, or 0. */
  readonly occ: Int32Array;
  readonly grid: Grid;
  readonly starts: [number, number][]; readonly sites: [number, number][];
  tick = 0;
  rand: () => number;
  players: Player[] = [];
  units: Unit[] = [];
  buildings: Building[] = [];
  nodes: Node[] = [];
  traps: Trap[] = [];
  clouds: Cloud[] = [];
  byId = new Map<number, Unit | Building | Node>();
  events: Ev[] = [];
  log: { t: number; c: Cmd }[] = [];
  pending: Cmd[] = [];
  brains: (Brain | null)[] = [];
  script: Script | null = null;
  result: { winner: number; reason: 'rout' | 'time' | 'mission'; text?: string } | null = null;
  /** Each team's sight: 0 never seen, 1 seen before, 2 in view now. */
  vis = new Map<number, Uint8Array>();
  /** Each team's memory of the buildings it has seen. */
  known = new Map<number, Map<number, { type: string; owner: number; tx: number; ty: number; size: number }>>();
  private nextId = 1;
  private hash = new Map<number, Unit[]>();
  private budget = 0;
  private fogOn: boolean;
  /** Missions mark pieces here, e.g. lost kits that join you when found. */
  flags = new Map<number, string>();
  /** Pieces that wait where they are, ignored by everyone, until a mission wakes them (lost kits, a stuck Queen). */
  frozen = new Set<number>();

  constructor(cfg: MatchCfg) {
    this.cfg = cfg; this.map = cfg.map; this.W = cfg.map.w; this.H = cfg.map.h;
    this.rand = rng(cfg.seed);
    this.fogOn = cfg.fog !== false;
    const L = layout(cfg.map);
    this.terrain = L.terrain; this.starts = L.starts; this.sites = L.sites;
    this.occ = new Int32Array(this.W * this.H);
    this.grid = { w: this.W, h: this.H, block: new Uint8Array(this.W * this.H) };
    for (let i = 0; i < this.W * this.H; i++) this.grid.block[i] = blocks(this.terrain[i]) ? 1 : 0;
    for (const n of L.nodes) this.addNode(n.res, n.x, n.y);
    cfg.slots.forEach((s, i) => {
      const p: Player = {
        id: i, side: s.side, team: s.team, name: s.name ?? SIDES[s.side].short, color: s.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length], ai: s.ai ?? null,
        hay: START_HAY, glimmer: 0, used: 0, cap: 0, ups: {}, out: false, alertAt: -999,
        stats: { hay: 0, glimmer: 0, trained: 0, built: 0, poofed: 0, lost: 0, salvage: 0 },
      };
      this.players.push(p); this.brains.push(null);
      if (!this.vis.has(s.team)) { this.vis.set(s.team, new Uint8Array(this.W * this.H)); this.known.set(s.team, new Map()); }
    });
    if (!cfg.bare) this.players.forEach((p, i) => {
      const [sx, sy] = this.starts[i % this.starts.length];
      const hq = this.placeBuilding(p.id, SIDES[p.side].hq, sx, sy, true);
      for (let k = 0; k < START_WORKERS; k++) {
        const spot = this.freeSpotNear(hq.tx + 1 + (k % 3) - 1, hq.ty + 3 + Math.floor(k / 3));
        this.spawnUnit(p.id, SIDES[p.side].worker, spot[0], spot[1]);
      }
    });
    this.refreshFog(true);
  }

  // ---------------------------------------------------------------- pieces
  private addNode(res: Res, tx: number, ty: number) {
    const n: Node = { id: this.nextId++, kind: 'node', res, tx, ty, x: (tx + 1) * T, y: (ty + 1) * T, amount: NODE_AMOUNT[res], max: NODE_AMOUNT[res], busy: [] };
    this.nodes.push(n); this.byId.set(n.id, n); this.stamp(tx, ty, 2, n.id);
    return n;
  }
  private stamp(tx: number, ty: number, size: number, id: number) {
    for (let j = ty; j < ty + size; j++) for (let i = tx; i < tx + size; i++) {
      if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
      const k = j * this.W + i; this.occ[k] = id; this.grid.block[k] = id ? 2 : blocks(this.terrain[k]) ? 1 : 0;
    }
  }
  /** Adds a unit at a world position. */
  spawnUnit(owner: number, type: string, x: number, y: number): Unit {
    const def = UNITS[type], p = this.players[owner];
    const maxHp = Math.floor((def.hp * (100 + this.upSum(p, 'hp'))) / 100);
    const u: Unit = {
      id: this.nextId++, kind: 'unit', type, def, owner, x: Math.round(x), y: Math.round(y), hp: maxHp, maxHp, face: 1,
      order: null, queue: [], path: null, pi: 0, pathKey: -1, pathAt: -999, chkX: 0, chkY: 0, chkAt: 0, stuck: 0,
      target: 0, cd: 0, lostAt: 0, carry: 0, carryRes: 'hay', work: 0, workNode: 0,
      wind: this.windMax(p), slow: 0, root: 0, stun: 0, haste: 0, hasteAmt: 0, firm: 0, hurtAt: -999, abCd: 0,
      under: 0, tunnelTo: 0, homeX: Math.round(x), homeY: Math.round(y), back: false, pace: 0, hitAt: -999, moving: false, springAt: -99, nearSpring: true,
    };
    this.units.push(u); this.byId.set(u.id, u);
    return u;
  }
  /** Puts a building down with its top-left tile at (tx, ty), finished or as a fresh foundation. */
  placeBuilding(owner: number, type: string, tx: number, ty: number, done: boolean): Building {
    const def = BUILDINGS[type], size = def.size;
    const b: Building = {
      id: this.nextId++, kind: 'building', type, def, owner, tx, ty, size, x: (tx * T) + (size * T) / 2, y: (ty * T) + (size * T) / 2,
      hp: done ? def.hp : Math.max(1, Math.floor(def.hp / 10)), maxHp: def.hp, done, progress: done ? secs(def.time) : 0, builders: 0, queue: [],
      rally: null, cd: 0, target: 0, abCd: 0, hitAt: -999, hurtAt: -999,
    };
    this.buildings.push(b); this.byId.set(b.id, b); this.stamp(tx, ty, size, b.id);
    // nudge anyone standing on the footprint out of the way
    for (const u of this.units) if (!u.def.air && !u.under) {
      const ux = Math.floor(u.x / T), uy = Math.floor(u.y / T);
      if (ux >= tx && uy >= ty && ux < tx + size && uy < ty + size) { const [fx, fy] = this.freeSpotNear(ux, uy); u.x = fx; u.y = fy; u.path = null; }
    }
    return b;
  }
  /** The centre of the nearest open tile to (tx, ty), in world units. */
  freeSpotNear(tx: number, ty: number): [number, number] {
    const s = spiral(this.grid, tx, ty, 1, 20)[0] ?? [tx, ty];
    return [s[0] * T + T / 2, s[1] * T + T / 2];
  }
  get(id: number) { return this.byId.get(id); }
  unit(id: number) { const e = this.byId.get(id); return e && e.kind === 'unit' ? e : null; }
  building(id: number) { const e = this.byId.get(id); return e && e.kind === 'building' ? e : null; }
  enemies(a: number, b: number) { return this.players[a].team !== this.players[b].team; }

  // ---------------------------------------------------------------- numbers
  upSum(p: Player, key: 'dmg' | 'armor' | 'speed' | 'wind' | 'regen' | 'hp') {
    let s = 0; for (const id in p.ups) if (p.ups[id]) s += UPGRADES[id].effect[key] ?? 0; return s;
  }
  windMax(p: Player) { return secs(WIND_SECONDS) * (100 + this.upSum(p, 'wind')) / 100; }
  dmgOf(owner: number, base: number) { return Math.floor((base * (100 + this.upSum(this.players[owner], 'dmg'))) / 100); }
  armorOf(u: Unit) { return u.def.armor + this.upSum(this.players[u.owner], 'armor'); }
  /** World units a tick, after upgrades, haste, dust and winding. */
  speedOf(u: Unit) {
    let m = 100 + this.upSum(this.players[u.owner], 'speed');
    if (u.haste > 0) m += u.hasteAmt;
    if (u.slow > 0) m = Math.floor((m * (100 - SLOW.speed)) / 100);
    if (this.woundDown(u)) m = Math.floor((m * WOUND_DOWN) / 100);
    const base = u.pace && !u.target ? Math.min(u.pace, Math.round((u.def.speed * T) / TICK_HZ)) : Math.round((u.def.speed * T) / TICK_HZ);
    return Math.max(1, Math.floor((base * m) / 100));
  }
  cdOf(u: Unit) {
    let c = secs(u.def.cd);
    if (u.slow > 0) c = Math.floor((c * (100 + SLOW.cd)) / 100);
    if (this.woundDown(u)) c = Math.floor((c * 100) / WOUND_DOWN);
    if (u.haste > 0) c = Math.floor((c * 100) / (100 + u.hasteAmt));
    return Math.max(1, c);
  }
  winds(u: Unit) { return u.def.side === 'hive' && !u.def.worker && u.type !== 'queen'; }
  woundDown(u: Unit) { return this.winds(u) && u.wind <= 0; }

  // ---------------------------------------------------------------- orders
  /** Queue a player's order for the next tick, and log it for replays. */
  issue(c: Cmd) { this.pending.push(c); }
  /** Carry out an order at once (the computer players use this; their thinking replays itself). */
  exec(c: Cmd) {
    const p = this.players[c.p]; if (!p || p.out) return false;
    const mine = (ids: number[]) => ids.map((id) => this.unit(id)).filter((u): u is Unit => !!u && u.owner === c.p && !this.frozen.has(u.id));
    switch (c.k) {
      case 'move': case 'amove': case 'patrol': {
        const us = mine(c.ids); if (!us.length) return false;
        const slots = this.formation(us, c.x, c.y);
        // an attack-move marches together, at the pace of its slowest walker
        let pace = 0;
        if (c.k !== 'move' && us.length > 1) pace = Math.min(...us.map((u) => (u.def.air ? 99 : u.def.speed)));
        us.forEach((u, i) => {
          const [x, y] = slots[i];
          const o: Order = c.k === 'patrol' ? { k: 'patrol', x, y, ax: u.x, ay: u.y } : { k: c.k, x, y };
          this.give(u, o, !!c.q);
          if (!c.q && pace < 99) u.pace = Math.round((pace * T) / TICK_HZ);
        });
        return true;
      }
      case 'attack': { const t = this.get(c.t); if (!t || t.kind === 'node') return false; for (const u of mine(c.ids)) if (u.def.dmg > 0 && this.canHit(u, t)) this.give(u, { k: 'attack', t: c.t }, !!c.q); return true; }
      case 'gather': { const n = this.get(c.n); if (!n || n.kind !== 'node') return false; for (const u of mine(c.ids)) if (u.def.worker) this.give(u, { k: 'gather', n: c.n }, !!c.q); return true; }
      case 'help': { const b = this.building(c.t); if (!b || b.owner !== c.p || b.done) return false; for (const u of mine(c.ids)) if (u.def.worker) this.give(u, { k: 'help', t: c.t }, !!c.q); return true; }
      case 'return': { for (const u of mine(c.ids)) if (u.def.worker && u.carry > 0) this.give(u, { k: 'return', resume: 0 }, !!c.q); return true; }
      case 'stop': case 'hold': { for (const u of mine(c.ids)) { this.dropOrders(u); u.target = 0; u.homeX = u.x; u.homeY = u.y; if (c.k === 'hold') u.order = { k: 'hold' }; } return true; }
      case 'build': {
        const us = mine(c.ids).filter((u) => u.def.worker); if (!us.length) return false;
        const def = BUILDINGS[c.b]; if (!def || def.side !== p.side || !this.reqMet(p, def)) return false;
        if (!this.canPlace(c.p, c.b, c.tx, c.ty, true)) return false;
        if (!this.pay(p, def.hay, def.glimmer)) return false;
        // the nearest worker takes the job
        let best = us[0], bd = Infinity; for (const u of us) { const d = dist(u.x, u.y, (c.tx + def.size / 2) * T, (c.ty + def.size / 2) * T); if (d < bd) { bd = d; best = u; } }
        this.give(best, { k: 'build', b: c.b, tx: c.tx, ty: c.ty, site: 0, paid: true }, !!c.q);
        return true;
      }
      case 'train': {
        const b = this.building(c.bid); if (!b || b.owner !== c.p || !b.done || !b.def.trains.includes(c.u) || b.queue.length >= 5) return false;
        const d = UNITS[c.u]; if (UNIT_REQ[c.u] && !this.has(p, UNIT_REQ[c.u])) return false;
        if (d.limit && this.countOf(c.p, c.u) >= d.limit) return false;
        if (!this.pay(p, d.hay, d.glimmer)) return false;
        b.queue.push({ k: 'unit', id: c.u, left: secs(d.time), total: secs(d.time), started: false });
        return true;
      }
      case 'research': {
        const b = this.building(c.bid), up = UPGRADES[c.up];
        if (!b || !up || b.owner !== c.p || !b.done || !b.def.research.includes(c.up) || p.ups[c.up] !== undefined || b.queue.length >= 5) return false;
        if (!this.pay(p, up.hay, up.glimmer)) return false;
        p.ups[c.up] = false;
        b.queue.push({ k: 'up', id: c.up, left: secs(up.time), total: secs(up.time), started: true });
        return true;
      }
      case 'cancel': {
        const b = this.building(c.bid); if (!b || b.owner !== c.p) return false;
        if (!b.done) { this.refund(p, b.def.hay, b.def.glimmer, 75); this.removeBuilding(b, false); return true; }
        const it = b.queue.pop(); if (!it) return false;
        if (it.k === 'unit') this.refund(p, UNITS[it.id].hay, UNITS[it.id].glimmer, 100);
        else { this.refund(p, UPGRADES[it.id].hay, UPGRADES[it.id].glimmer, 100); delete p.ups[it.id]; }
        return true;
      }
      case 'rally': {
        for (const id of c.bids) { const b = this.building(id); if (b && b.owner === c.p) { const n = this.nodeAt(c.x, c.y); b.rally = { x: c.x, y: c.y, node: n ? n.id : 0 }; } }
        return true;
      }
      case 'ability': return this.ability(c.p, c.ids, c.ab, c.x ?? 0, c.y ?? 0, !!c.q);
      case 'tunnel': {
        const t = this.building(c.t); if (!t || t.owner !== c.p || !t.done || !t.def.tunnel) return false;
        let any = false;
        for (const u of mine(c.ids)) if (u.def.side === 'colony' && !u.def.air && u.type !== 'wagon') { this.give(u, { k: 'tunnel', t: c.t }, !!c.q); any = true; }
        return any;
      }
    }
    return false;
  }
  /** The usual right-click: gather from a meadow, help a foundation, bump an enemy, or walk there. */
  smart(p: number, ids: number[], x: number, y: number, q = false): Cmd {
    const at = this.pick(x, y, p);
    const us = ids.map((id) => this.unit(id)).filter((u): u is Unit => !!u);
    if (at) {
      if (at.kind === 'node' && us.some((u) => u.def.worker)) return { p, k: 'gather', ids, n: at.id, q };
      if (at.kind !== 'node' && this.enemies(p, at.owner)) return { p, k: 'attack', ids, t: at.id, q };
      if (at.kind === 'building' && at.owner === p && !at.done && us.some((u) => u.def.worker)) return { p, k: 'help', ids, t: at.id, q };
      if (at.kind === 'building' && at.owner === p && at.def.hq && us.some((u) => u.carry > 0)) return { p, k: 'return', ids, q };
    }
    return { p, k: 'move', ids, x, y, q };
  }
  /** What is under a world point: a unit first, then a building, then a node. Enemies must be in view of `viewer`'s team. */
  pick(x: number, y: number, viewer = -1): Unit | Building | Node | null {
    let best: Unit | null = null, bd = Infinity;
    for (const u of this.units) {
      if (u.under || u.hp <= 0) continue;
      if (viewer >= 0 && this.enemies(viewer, u.owner) && !this.seen(this.players[viewer].team, u.x, u.y)) continue;
      const d = dist(x, y, u.x, u.def.air ? u.y - T / 2 : u.y), r = u.def.r * T + T * 0.25;
      if (d <= r && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return null;
    const e = this.byId.get(this.occ[ty * this.W + tx]);
    if (!e || e.kind === 'unit') return null;
    if (e.kind === 'building' && viewer >= 0 && this.enemies(viewer, e.owner) && !this.seenBuilding(this.players[viewer].team, e)) return null;
    return e;
  }
  nodeAt(x: number, y: number) { const tx = Math.floor(x / T), ty = Math.floor(y / T); const e = this.byId.get(this.occ[ty * this.W + tx] ?? 0); return e && e.kind === 'node' ? e : null; }
  /** Spreads a group's destinations round a point so they do not all fight over one spot. */
  formation(us: Unit[], x: number, y: number): [number, number][] {
    if (us.length === 1) return [[x, y]];
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    const air = us.every((u) => u.def.air);
    const spots = spiral(this.grid, tx, ty, us.length, 14, (i, j) => i >= 0 && j >= 0 && i < this.W && j < this.H && (air || open(this.grid, i, j)));
    const order = us.map((u, i) => ({ i, d: dist(u.x, u.y, x, y) })).sort((a, b) => a.d - b.d || us[a.i].id - us[b.i].id);
    const out: [number, number][] = new Array(us.length);
    order.forEach((o, k) => { const s = spots[k] ?? [tx, ty]; out[o.i] = k === 0 ? [x, y] : [s[0] * T + T / 2, s[1] * T + T / 2]; });
    return out;
  }
  private give(u: Unit, o: Order, queue: boolean) {
    if (u.under) { if (queue) u.queue.push(o); else u.queue = [o]; return; }
    if (queue && (u.order || u.queue.length)) { if (u.queue.length < 16) u.queue.push(o); else this.unpaid(u, o); return; }
    this.dropOrders(u);
    this.setOrder(u, o);
  }
  private setOrder(u: Unit, o: Order | null) {
    this.releaseNode(u);
    u.order = o; u.path = null; u.pathKey = -1; u.target = 0; u.pace = 0; u.stuck = 0; u.chkAt = this.tick; u.chkX = u.x; u.chkY = u.y;
    if (!o) { u.homeX = u.x; u.homeY = u.y; u.back = false; }
  }
  /** Ends the current order and starts the next queued one. */
  private next(u: Unit) { this.setOrder(u, u.queue.shift() ?? null); }
  private dropOrders(u: Unit) {
    if (u.order) this.unpaid(u, u.order);
    for (const o of u.queue) this.unpaid(u, o);
    u.queue = []; this.setOrder(u, null);
  }
  /** A build order that never got its foundation down hands its cost back. */
  private unpaid(u: Unit, o: Order) {
    if (o.k === 'build' && o.paid && !o.site) { const d = BUILDINGS[o.b]; this.refund(this.players[u.owner], d.hay, d.glimmer, 100); o.paid = false; }
  }
  private releaseNode(u: Unit) {
    if (u.workNode) { const n = this.byId.get(u.workNode); if (n && n.kind === 'node') n.busy = n.busy.filter((id) => id !== u.id); u.workNode = 0; }
    u.work = 0;
  }
  pay(p: Player, hay: number, glimmer: number) { if (p.hay < hay || p.glimmer < glimmer) return false; p.hay -= hay; p.glimmer -= glimmer; return true; }
  private refund(p: Player, hay: number, glimmer: number, pct: number) { p.hay += Math.floor((hay * pct) / 100); p.glimmer += Math.floor((glimmer * pct) / 100); }
  has(p: Player, type: string) { return this.buildings.some((b) => b.owner === p.id && b.type === type && b.done); }
  reqMet(p: Player, def: BuildingDef) { return def.req.every((r) => this.has(p, r)); }
  countOf(owner: number, type: string) {
    let n = 0; for (const u of this.units) if (u.owner === owner && u.type === type) n++;
    for (const b of this.buildings) if (b.owner === owner) for (const q of b.queue) if (q.k === 'unit' && q.id === type) n++;
    return n;
  }
  /** Can `type` go down with its top-left at (tx, ty)? Players must have seen the ground; walkers are nudged aside. */
  canPlace(owner: number, type: string, tx: number, ty: number, needSeen: boolean, ignore = 0) {
    const def = BUILDINGS[type]; if (!def) return false;
    const s = def.size, team = this.players[owner].team, v = this.vis.get(team)!;
    for (let j = ty; j < ty + s; j++) for (let i = tx; i < tx + s; i++) {
      if (i < 0 || j < 0 || i >= this.W || j >= this.H) return false;
      const k = j * this.W + i;
      if (blocks(this.terrain[k])) return false;
      if (this.occ[k] && this.occ[k] !== ignore) return false;
      if (needSeen && this.fogOn && !this.players[owner].ai && v[k] === 0) return false;
    }
    if (def.hq) for (const n of this.nodes) {
      const dx = Math.max(n.tx - (tx + s - 1), tx - (n.tx + 1), 0), dy = Math.max(n.ty - (ty + s - 1), ty - (n.ty + 1), 0);
      if (Math.max(dx, dy) < 2) return false;
    }
    // no squeezing in where enemies stand
    for (const u of this.units) if (!u.def.air && this.enemies(owner, u.owner)) {
      const ux = Math.floor(u.x / T), uy = Math.floor(u.y / T);
      if (ux >= tx && uy >= ty && ux < tx + s && uy < ty + s) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- abilities
  private ability(p: number, ids: number[], ab: AbilityId, x: number, y: number, q: boolean) {
    const A = ABILITIES[ab], pl = this.players[p];
    // building abilities
    if (ab === 'overwind' || ab === 'pack') {
      let any = false;
      for (const id of ids) {
        const b = this.building(id); if (!b || b.owner !== p || !b.done || b.def.ability !== ab || b.abCd > 0) continue;
        if (ab === 'overwind') {
          const r = tiles(A.radius);
          for (const u of this.units) if (u.owner === p && u.def.side === 'hive' && dist(u.x, u.y, b.x, b.y) <= r) { u.wind = this.windMax(pl); u.haste = secs(8); u.hasteAmt = 40; }
          b.abCd = secs(A.cd); this.events.push({ k: 'ability', ab, x: b.x, y: b.y, owner: p, r });
        } else {
          if (b.queue.length) continue;
          const hpPct = (b.hp * 100) / b.maxHp;
          const w = this.spawnUnit(p, 'wagon', b.x, b.y);
          w.hp = Math.max(1, Math.floor((w.maxHp * hpPct) / 100));
          this.removeBuilding(b, false);
          this.events.push({ k: 'ability', ab, x: w.x, y: w.y, owner: p, r: T });
        }
        any = true;
      }
      return any;
    }
    let any = false;
    for (const u of ids.map((id) => this.unit(id))) {
      if (!u || u.owner !== p || u.def.ability !== ab || u.under) continue;
      if (ab === 'unpack') { any = this.unpack(u) || any; continue; }
      if (u.abCd > 0 && !q) continue;
      if (A.range === 0) { if (this.cast(u, ab, u.x, u.y)) any = true; continue; }
      this.give(u, { k: 'ability', ab, x, y }, q); any = true;
      // one caster is enough for a targeted ability
      break;
    }
    return any;
  }
  private unpack(u: Unit) {
    const tx = Math.floor(u.x / T) - 1, ty = Math.floor(u.y / T) - 1;
    if (!this.canPlace(u.owner, 'workshop', tx, ty, false)) { this.events.push({ k: 'msg', owner: u.owner, text: 'Not enough room to unpack here.' }); return false; }
    const pct = (u.hp * 100) / u.maxHp;
    this.poofSilently(u);
    const b = this.placeBuilding(u.owner, 'workshop', tx, ty, true);
    b.hp = Math.max(1, Math.floor((b.maxHp * pct) / 100));
    this.events.push({ k: 'ability', ab: 'unpack', x: b.x, y: b.y, owner: u.owner, r: T });
    return true;
  }
  /** Does the ability now, if it is ready. */
  private cast(u: Unit, ab: AbilityId, x: number, y: number) {
    if (u.abCd > 0) return false;
    const A = ABILITIES[ab], p = u.owner, r = tiles(A.radius);
    switch (ab) {
      case 'cloud': this.clouds.push({ x, y, r, left: secs(SLOW.time), owner: p }); break;
      case 'song': for (const f of this.units) if (f.owner === p && dist(f.x, f.y, u.x, u.y) <= r) { f.hp = Math.min(f.maxHp, f.hp + 60); f.haste = secs(6); f.hasteAmt = 30; } break;
      case 'firm': for (const f of this.units) if (f.owner === p && dist(f.x, f.y, u.x, u.y) <= r) f.firm = secs(7); break;
      case 'snare': {
        const mine = this.traps.filter((t) => t.owner === p);
        if (mine.length >= TRAP.max) this.traps.splice(this.traps.indexOf(mine[0]), 1);
        this.traps.push({ id: this.nextId++, owner: p, x, y }); break;
      }
      case 'shiny': for (const f of this.units) if (this.enemies(p, f.owner) && !f.under && dist(f.x, f.y, x, y) <= r) { f.stun = secs(3); f.path = null; } break;
      case 'brood': {
        let made = 0;
        for (let k = 0; k < 2; k++) {
          const pl = this.players[p]; if (pl.used + 1 > pl.cap) break;
          const [fx, fy] = this.freeSpotNear(Math.floor(u.x / T) + (k ? 1 : -1), Math.floor(u.y / T) + 1);
          this.spawnUnit(p, 'clicker', fx, fy); pl.used++; made++;
        }
        if (!made) { this.events.push({ k: 'msg', owner: p, text: 'The Hive needs more room: build a Cog Cell.' }); return false; }
        break;
      }
      default: return false;
    }
    u.abCd = secs(A.cd);
    this.events.push({ k: 'ability', ab, x, y, owner: p, r });
    return true;
  }

  // ---------------------------------------------------------------- the tick
  /** Runs one 1/20 s tick. */
  step() {
    if (this.result) return;
    this.events = [];
    for (const c of this.pending) { this.log.push({ t: this.tick, c }); this.exec(c); }
    this.pending = [];
    this.budget = 28;
    this.tally();
    for (const p of this.players) if (!p.out && this.brains[p.id]) this.brains[p.id]!.think(this, p);
    this.rebuildHash();
    for (const b of this.buildings) this.updBuilding(b);
    for (const u of this.units) if (u.hp > 0) this.updUnit(u);
    this.separate();
    this.updTraps();
    this.updClouds();
    this.cleanup();
    if (this.tick % 4 === 0) this.refreshFog(false);
    this.script?.tick(this);
    this.checkEnd();
    this.tick++;
  }
  /** Supply in use and on offer. */
  private tally() {
    for (const p of this.players) { p.used = 0; p.cap = 0; }
    for (const u of this.units) this.players[u.owner].used += u.def.supply;
    for (const b of this.buildings) {
      const p = this.players[b.owner];
      if (b.done && b.def.supply) p.cap += b.def.supply;
      const f = b.queue[0]; if (f && f.k === 'unit' && f.started) p.used += UNITS[f.id].supply;
    }
    for (const p of this.players) p.cap = Math.min(MAX_SUPPLY, p.cap);
  }
  private rebuildHash() {
    this.hash.clear();
    for (const u of this.units) {
      if (u.under || u.hp <= 0) continue;
      const k = Math.floor(u.y / CELL) * 1024 + Math.floor(u.x / CELL);
      const a = this.hash.get(k); if (a) a.push(u); else this.hash.set(k, [u]);
    }
  }
  /** Units within `r` world units of a point (from the hash, so as of this tick's start). */
  near(x: number, y: number, r: number, out: Unit[] = []) {
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const a = this.hash.get(cy * 1024 + cx); if (a) for (const u of a) if (u.hp > 0) out.push(u); }
    return out;
  }

  // ---- buildings
  private updBuilding(b: Building) {
    const p = this.players[b.owner];
    if (!b.done) {
      const rate = b.def.side === 'hive' ? 1 : b.def.side === 'guild' ? Math.min(4, b.builders) : Math.min(1, b.builders);
      b.builders = 0;
      if (!rate) return;
      const total = secs(b.def.time), before = b.progress;
      b.progress = Math.min(total, b.progress + rate);
      b.hp = Math.min(b.maxHp, b.hp + Math.floor((b.maxHp * 9 * b.progress) / (10 * total)) - Math.floor((b.maxHp * 9 * before) / (10 * total)));
      if (b.progress >= total) { b.done = true; p.stats.built++; this.events.push({ k: 'built', id: b.id, owner: b.owner, type: b.type }); }
      return;
    }
    if (b.abCd > 0) b.abCd--;
    // production
    const f = b.queue[0];
    if (f) {
      if (f.k === 'unit' && !f.started) {
        if (p.used + UNITS[f.id].supply <= p.cap || UNITS[f.id].supply === 0) { f.started = true; p.used += UNITS[f.id].supply; }
        else if (this.tick % 100 === 0) this.events.push({ k: 'msg', owner: b.owner, text: `Out of room: build a ${BUILDINGS[SIDES[p.side].house].name}.` });
      }
      if (f.started && --f.left <= 0) {
        b.queue.shift();
        if (f.k === 'unit') this.emerge(b, f.id);
        else { p.ups[f.id] = true; this.applyUpgrade(p, f.id); this.events.push({ k: 'research', owner: b.owner, up: f.id }); }
      }
    }
    // towers
    if (b.def.tower) {
      if (b.cd > 0) b.cd--;
      const tw = b.def.tower, reach = tiles(tw.range) + (b.size * T) / 2;
      let t = this.unit(b.target);
      if (!t || t.hp <= 0 || t.under || dist(t.x, t.y, b.x, b.y) > reach + t.def.r * T || !this.seen(p.team, t.x, t.y)) {
        t = null; b.target = 0;
        if ((this.tick + b.id) % 5 === 0) {
          let bd = Infinity;
          for (const e of this.near(b.x, b.y, reach + T)) {
            if (!this.enemies(b.owner, e.owner) || e.under || (e.def.air && !tw.hitsAir) || this.frozen.has(e.id)) continue;
            if (!this.seen(p.team, e.x, e.y)) continue;
            const d = dist(e.x, e.y, b.x, b.y) - e.def.r * T; if (d <= reach && d < bd) { bd = d; t = e; }
          }
          if (t) b.target = t.id;
        }
      }
      if (t && b.cd <= 0) {
        b.cd = secs(tw.cd); b.hitAt = this.tick;
        this.events.push({ k: 'shot', x: b.x, y: b.y - T, tx: t.x, ty: t.y, shot: tw.shot ?? 'pebble', owner: b.owner, air: t.def.air ?? false });
        this.damage(t, this.dmgOf(b.owner, tw.dmg), b.owner, b.id);
      }
    }
    // dust baths
    if (b.def.heal && this.tick % TICK_HZ === 0) {
      const r = tiles(b.def.heal.r) + (b.size * T) / 2;
      for (const u of this.near(b.x, b.y, r)) if (u.owner === b.owner && u.hp < u.maxHp && dist(u.x, u.y, b.x, b.y) <= r) u.hp = Math.min(u.maxHp, u.hp + b.def.heal.hp);
    }
  }
  private applyUpgrade(p: Player, id: string) {
    const e = UPGRADES[id].effect;
    if (e.hp) for (const u of this.units) if (u.owner === p.id) { const m = Math.floor((u.def.hp * (100 + this.upSum(p, 'hp'))) / 100); u.hp += m - u.maxHp; u.maxHp = m; }
  }
  /** A finished unit steps out on the side nearest the rally point and heads there. */
  private emerge(b: Building, type: string) {
    const p = this.players[b.owner];
    const rx = b.rally ? Math.floor(b.rally.x / T) : b.tx + b.size, ry = b.rally ? Math.floor(b.rally.y / T) : b.ty + b.size;
    const sx = Math.max(b.tx - 1, Math.min(b.tx + b.size, rx)), sy = Math.max(b.ty - 1, Math.min(b.ty + b.size, ry));
    const def = UNITS[type];
    const [x, y] = def.air ? [sx * T + T / 2, sy * T + T / 2] : this.freeSpotNear(sx, sy);
    const u = this.spawnUnit(b.owner, type, x, y);
    p.stats.trained++;
    this.events.push({ k: 'trained', id: u.id, owner: b.owner, type });
    if (b.rally) {
      const n = b.rally.node ? this.byId.get(b.rally.node) : null;
      if (n && n.kind === 'node' && def.worker) this.setOrder(u, { k: 'gather', n: n.id });
      else if (!def.worker) this.setOrder(u, { k: 'amove', x: b.rally.x, y: b.rally.y });
      else this.setOrder(u, { k: 'move', x: b.rally.x, y: b.rally.y });
    }
  }

  // ---- units
  private updUnit(u: Unit) {
    u.moving = false;
    if (this.frozen.size && this.frozen.has(u.id)) return;
    if (u.under > 0) { if (--u.under === 0) this.surface(u); return; }
    if (u.cd > 0) u.cd--;
    if (u.abCd > 0) u.abCd--;
    if (u.slow > 0) u.slow--;
    if (u.root > 0) u.root--;
    if (u.haste > 0) u.haste--;
    if (u.firm > 0) u.firm--;
    const p = this.players[u.owner];
    if (u.def.side === 'hive') {
      if (this.winds(u)) {
        if (this.tick - u.springAt >= 10) { u.springAt = this.tick; u.nearSpring = this.springNear(u); }
        const max = this.windMax(p);
        u.wind = u.nearSpring ? Math.min(max, u.wind + REWIND_RATE) : Math.max(0, u.wind - 1);
      }
      const rest = this.tick - u.hurtAt;
      const mend = Math.max(1, Math.floor(SHELL_MEND * 100 / (100 + this.upSum(p, 'regen'))));
      if (rest >= SHELL_REST && u.hp < u.maxHp && this.tick % (u.type === 'shellback' ? Math.max(1, mend >> 1) : mend) === 0) u.hp++;
    }
    // heroes catch their breath when nobody has bumped them for a while
    if (u.def.hero && u.hp < u.maxHp && this.tick - u.hurtAt >= HERO_REST && this.tick % HERO_MEND === 0) u.hp++;
    if (u.stun > 0) { u.stun--; return; }
    const o = u.order;
    if (!o) return this.idle(u, false);
    switch (o.k) {
      case 'hold': return this.idle(u, true);
      case 'move':
        if (this.walk(u, o.x, o.y, T / 3)) this.next(u);
        return;
      case 'amove': case 'patrol':
        if (this.fight(u, false)) return;
        if (this.walk(u, o.x, o.y, T / 2)) {
          if (o.k === 'patrol') { this.setOrder(u, { k: 'patrol', x: o.ax, y: o.ay, ax: o.x, ay: o.y }); }
          else this.next(u);
        }
        return;
      case 'attack': {
        const t = this.get(o.t);
        if (!t || t.kind === 'node' || t.hp <= 0 || (t.kind === 'unit' && t.under)) return this.next(u);
        if (!this.visibleTo(u.owner, t)) { if (!u.lostAt) u.lostAt = this.tick; if (this.tick - u.lostAt > 60) return this.next(u); } else u.lostAt = 0;
        u.target = t.id; this.engage(u, t, true);
        return;
      }
      case 'gather': return this.gather(u, o);
      case 'return': return this.goHome(u, o);
      case 'build': return this.build(u, o);
      case 'help': {
        const b = this.building(o.t); if (!b || b.done || b.owner !== u.owner) return this.next(u);
        if (this.reachRect(u, b.tx, b.ty, b.size, b.size, T * 0.7)) { b.builders++; u.face = b.x > u.x ? 1 : -1; } else this.walkRect(u, b.tx, b.ty, b.size, b.size);
        return;
      }
      case 'tunnel': return this.tunnel(u, o);
      case 'ability': {
        const A = ABILITIES[o.ab];
        if (dist(u.x, u.y, o.x, o.y) <= tiles(A.range)) { if (u.abCd > 0) return; this.cast(u, o.ab, o.x, o.y); this.next(u); return; }
        this.walk(u, o.x, o.y, tiles(A.range) - T / 4);
        return;
      }
    }
  }
  /** Standing about: bump anything grumpy in sight (or in reach, when holding), and wander back afterwards. */
  private idle(u: Unit, hold: boolean) {
    if (u.def.worker || u.def.dmg <= 0) return;
    const away = dist(u.x, u.y, u.homeX, u.homeY);
    if (!hold && (u.back || away > tiles(7))) {
      // wandered too far chasing: walk back before bumping anything else
      u.target = 0; u.back = !this.walk(u, u.homeX, u.homeY, T);
      return;
    }
    if (this.fight(u, hold)) return;
    if (!hold && away > T) this.walk(u, u.homeX, u.homeY, T / 2);
  }
  /** Picks and bumps a target; false when there is nothing to bump. */
  private fight(u: Unit, hold: boolean) {
    if (u.def.dmg <= 0) return false;
    const was = u.target ? this.get(u.target) : null;
    let t: Unit | Building | null = was && was.kind !== 'node' ? was : null;
    if (t && (t.hp <= 0 || (t.kind === 'unit' && t.under) || !this.visibleTo(u.owner, t))) t = null;
    if (t && hold && !this.inReach(u, t)) t = null;
    if (!t || (this.tick + u.id) % 10 === 0) {
      const best = this.acquire(u, hold ? 0 : tiles(u.def.sight));
      if (best && (!t || best !== t && this.better(u, best, t))) t = best;
    }
    if (!t) { u.target = 0; return false; }
    u.target = t.id;
    this.engage(u, t, !hold);
    return true;
  }
  private better(u: Unit, a: Unit | Building, b: Unit | Building) {
    const pa = this.priority(u, a), pb = this.priority(u, b);
    if (pa !== pb) return pa < pb;
    return this.gap(u, a) + T < this.gap(u, b);
  }
  private priority(u: Unit, t: Unit | Building) {
    if (t.kind === 'building') return t.def.tower ? 1 : 3;
    return t.def.dmg > 0 && !t.def.worker && this.canHit(t, u) ? 0 : 2;
  }
  /** The best thing to bump within `r` (0 means within reach). */
  private acquire(u: Unit, r: number): Unit | Building | null {
    const team = this.players[u.owner].team, look = r || tiles(u.def.range) + T;
    let best: Unit | Building | null = null, bp = 9, bd = Infinity;
    for (const e of this.near(u.x, u.y, look + T)) {
      if (!this.enemies(u.owner, e.owner) || e.under || !this.canHit(u, e) || !this.seen(team, e.x, e.y) || this.frozen.has(e.id)) continue;
      const d = this.gap(u, e); if (r ? d > r : !this.inReach(u, e)) continue;
      const pr = this.priority(u, e);
      if (pr < bp || (pr === bp && d < bd)) { best = e; bp = pr; bd = d; }
    }
    if (!best || bp > 1) for (const b of this.buildings) {
      if (!this.enemies(u.owner, b.owner) || !this.canHit(u, b)) continue;
      const d = this.gap(u, b); if (r ? d > r : !this.inReach(u, b)) continue;
      if (!this.seenBuilding(team, b)) continue;
      const pr = this.priority(u, b);
      if (pr < bp || (pr === bp && d < bd)) { best = b; bp = pr; bd = d; }
    }
    return best;
  }
  canHit(u: Unit, t: Unit | Building) {
    if (u.def.dmg <= 0) return false;
    if (t.kind === 'building') return u.def.hitsGround;
    return t.def.air ? u.def.hitsAir : u.def.hitsGround;
  }
  /** Edge-to-edge distance in world units. */
  gap(u: Unit, t: Unit | Building) {
    if (t.kind === 'unit') return Math.max(0, dist(u.x, u.y, t.x, t.y) - Math.round((u.def.r + t.def.r) * T));
    const x0 = t.tx * T, y0 = t.ty * T, x1 = x0 + t.size * T, y1 = y0 + t.size * T;
    const dx = u.x < x0 ? x0 - u.x : u.x > x1 ? u.x - x1 : 0, dy = u.y < y0 ? y0 - u.y : u.y > y1 ? u.y - y1 : 0;
    return Math.max(0, isqrt(dx * dx + dy * dy) - Math.round(u.def.r * T));
  }
  inReach(u: Unit, t: Unit | Building) { return this.gap(u, t) <= tiles(u.def.range) + 8; }
  private engage(u: Unit, t: Unit | Building, chase: boolean) {
    if (this.inReach(u, t)) {
      u.path = null; u.face = t.x >= u.x ? 1 : -1;
      if (u.cd <= 0) this.strike(u, t);
      return;
    }
    if (!chase || u.root > 0) return;
    if (t.kind === 'building') this.walkRect(u, t.tx, t.ty, t.size, t.size, Math.max(1, Math.floor(u.def.range)));
    else this.walk(u, t.x, t.y, 0, Math.max(0, Math.floor(u.def.range)));
  }
  private strike(u: Unit, t: Unit | Building) {
    u.cd = this.cdOf(u); u.hitAt = this.tick;
    const ranged = u.def.range > 1;
    if (ranged) this.events.push({ k: 'shot', x: u.x, y: u.y - (u.def.air ? T / 2 : T / 4), tx: t.x, ty: t.y, shot: u.def.shot ?? 'pebble', owner: u.owner, air: t.kind === 'unit' && !!t.def.air });
    let d = this.dmgOf(u.owner, u.def.dmg);
    if (t.kind === 'building' && u.def.siege) d = Math.floor(d * u.def.siege);
    this.damage(t, d, u.owner, u.id);
    if (u.def.splash) {
      const r = tiles(u.def.splash);
      for (const e of this.near(t.x, t.y, r + T)) if (e !== t && this.enemies(u.owner, e.owner) && !e.under && !e.def.air && dist(e.x, e.y, t.x, t.y) <= r) this.damage(e, d >> 1, u.owner, u.id);
    }
  }
  /** Bumps something; at zero it is poofed home (units) or tidied away (buildings). */
  damage(t: Unit | Building, raw: number, by: number, src: number) {
    if (t.hp <= 0 || (this.frozen.size && this.frozen.has(t.id))) return;
    let d = Math.max(1, raw - (t.kind === 'unit' ? this.armorOf(t) : t.def.armor));
    if (t.kind === 'unit' && t.firm > 0) d = Math.max(1, d >> 1);
    t.hp -= d; t.hurtAt = this.tick;
    this.events.push({ k: 'hit', x: t.x, y: t.y, dmg: d, id: t.id, owner: t.owner });
    const p = this.players[t.owner];
    if (this.tick - p.alertAt > 200) { p.alertAt = this.tick; this.events.push({ k: 'alert', owner: t.owner, x: t.x, y: t.y }); }
    // bumped: it and its idle or marching friends nearby bump back
    const s = this.unit(src);
    if (s && s.hp > 0 && (this.tick + t.id) % 3 === 0) {
      for (const f of this.near(t.x, t.y, tiles(5))) {
        if (f.owner !== t.owner || f.target || f.def.worker || f.under || !this.canHit(f, s)) continue;
        const k = f.order?.k;
        if (k && k !== 'amove' && k !== 'patrol' && !(k === 'hold' && this.inReach(f, s))) continue;
        if (!k && dist(f.x, f.y, f.homeX, f.homeY) > tiles(5)) continue;
        f.target = s.id;
      }
    }
    if (t.hp <= 0) { t.hp = 0; this.players[by].stats.poofed++; }
  }
  private springNear(u: Unit) {
    for (const b of this.buildings) if (b.owner === u.owner && b.done && b.def.spring && dist(u.x, u.y, b.x, b.y) <= tiles(b.def.spring)) return true;
    for (const q of this.units) if (q.owner === u.owner && q.type === 'queen' && q.hp > 0 && dist(u.x, u.y, q.x, q.y) <= tiles(6)) return true;
    return false;
  }

  // ---- economy
  private gather(u: Unit, o: Extract<Order, { k: 'gather' }>) {
    let n = this.byId.get(o.n) as Node | undefined;
    if (!n || n.kind !== 'node' || n.amount <= 0) {
      const alt = this.nearestNode(u, n ? n.res : u.carryRes, n ?? u, 12, false);
      if (alt) { o.n = alt.id; this.releaseNode(u); n = alt; }
      else { if (u.carry > 0) this.setOrder(u, { k: 'return', resume: 0 }); else this.next(u); return; }
    }
    if (u.carry > 0 && (u.carryRes !== n.res || u.carry >= CARRY[n.res])) { this.setOrder(u, { k: 'return', resume: n.id }); return; }
    if (!this.reachRect(u, n.tx, n.ty, 2, 2, T * 0.55)) { this.walkRect(u, n.tx, n.ty, 2, 2); return; }
    u.face = n.x >= u.x ? 1 : -1;
    if (!u.work) {
      if (n.busy.length >= NODE_SLOTS[n.res] && !n.busy.includes(u.id)) {
        const alt = this.nearestNode(u, n.res, u, 6, true);
        if (alt && alt !== n) { o.n = alt.id; u.path = null; }
        return;
      }
      if (!n.busy.includes(u.id)) n.busy.push(u.id);
      u.workNode = n.id; u.work = GATHER_TICKS[n.res];
      return;
    }
    if (--u.work > 0) return;
    const take = Math.min(CARRY[n.res], n.amount);
    n.amount -= take; u.carry = take; u.carryRes = n.res;
    this.releaseNode(u);
    if (n.amount <= 0) this.removeNode(n);
    this.setOrder(u, { k: 'return', resume: n.amount > 0 ? n.id : 0 });
    if (!n.amount) (u.order as { resume: number }).resume = -1 - (n.res === 'hay' ? 0 : 1);
  }
  /** The nearest node of a kind with a free slot (or any, when `free` is false) within `r` tiles of `from`. */
  nearestNode(u: Unit, res: Res, from: { x: number; y: number }, r: number, free: boolean) {
    let best: Node | null = null, bd = tiles(r);
    for (const n of this.nodes) {
      if (n.res !== res || n.amount <= 0 || (free && n.busy.length >= NODE_SLOTS[n.res])) continue;
      const d = dist(n.x, n.y, from.x, from.y); if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  private goHome(u: Unit, o: Extract<Order, { k: 'return' }>) {
    let home: Building | null = null, bd = Infinity;
    for (const b of this.buildings) if (b.owner === u.owner && b.done && b.def.hq) { const d = this.gap(u, b); if (d < bd) { bd = d; home = b; } }
    if (!home || u.carry <= 0) { this.next(u); return; }
    if (!this.reachRect(u, home.tx, home.ty, home.size, home.size, T * 0.6)) { this.walkRect(u, home.tx, home.ty, home.size, home.size); return; }
    const p = this.players[u.owner];
    if (u.carryRes === 'hay') { p.hay += u.carry; p.stats.hay += u.carry; } else { p.glimmer += u.carry; p.stats.glimmer += u.carry; }
    this.events.push({ k: 'drop', x: home.x, y: home.y, owner: u.owner, res: u.carryRes, amt: u.carry });
    const res = u.carryRes;
    u.carry = 0;
    if (o.resume > 0 && this.byId.get(o.resume)) { this.setOrder(u, { k: 'gather', n: o.resume }); return; }
    if (o.resume < 0 || o.resume > 0) {
      const alt = this.nearestNode(u, o.resume === -2 ? 'glimmer' : res, u, 14, false);
      if (alt) { this.setOrder(u, { k: 'gather', n: alt.id }); return; }
    }
    this.next(u);
  }
  private build(u: Unit, o: Extract<Order, { k: 'build' }>) {
    const def = BUILDINGS[o.b];
    if (o.site) {
      const b = this.building(o.site);
      if (!b || b.done) { this.afterBuild(u); return; }
      if (this.reachRect(u, b.tx, b.ty, b.size, b.size, T * 0.7)) { b.builders++; u.face = b.x >= u.x ? 1 : -1; } else this.walkRect(u, b.tx, b.ty, b.size, b.size);
      return;
    }
    if (!this.reachRect(u, o.tx, o.ty, def.size, def.size, T * 0.8)) { this.walkRect(u, o.tx, o.ty, def.size, def.size); return; }
    const p = this.players[u.owner];
    if (!this.canPlace(u.owner, o.b, o.tx, o.ty, false)) {
      this.refund(p, def.hay, def.glimmer, 100); o.paid = false;
      this.events.push({ k: 'msg', owner: u.owner, text: `Something is in the way of the ${def.name}.` });
      this.next(u); return;
    }
    const b = this.placeBuilding(u.owner, o.b, o.tx, o.ty, false);
    o.site = b.id;
    if (def.side === 'hive') this.afterBuild(u);
  }
  /** A builder goes back to gathering if it was a gatherer before. */
  private afterBuild(u: Unit) {
    if (u.queue.length) return this.next(u);
    const n = this.nearestNode(u, 'hay', u, 14, true) ?? this.nearestNode(u, 'hay', u, 14, false);
    this.setOrder(u, n && this.players[u.owner].ai ? { k: 'gather', n: n.id } : null);
  }

  // ---- tunnels
  private tunnel(u: Unit, o: Extract<Order, { k: 'tunnel' }>) {
    const dest = this.building(o.t);
    if (!dest || !dest.done || dest.owner !== u.owner) return this.next(u);
    let mouth: Building | null = null, bd = Infinity;
    for (const b of this.buildings) if (b.owner === u.owner && b.done && b.def.tunnel) { const d = this.gap(u, b); if (d < bd) { bd = d; mouth = b; } }
    if (!mouth) return this.next(u);
    if (mouth === dest) { if (this.reachRect(u, dest.tx, dest.ty, dest.size, dest.size, T)) return this.next(u); this.walkRect(u, dest.tx, dest.ty, dest.size, dest.size); return; }
    if (bd > tiles(TUNNEL_REACH) && !this.reachRect(u, mouth.tx, mouth.ty, mouth.size, mouth.size, T)) { this.walkRect(u, mouth.tx, mouth.ty, mouth.size, mouth.size); return; }
    u.under = secs(TUNNEL_SECONDS); u.tunnelTo = dest.id; u.path = null; u.target = 0;
    this.events.push({ k: 'tunnel', x: u.x, y: u.y, owner: u.owner, up: false });
  }
  private surface(u: Unit) {
    const dest = this.building(u.tunnelTo);
    if (dest && dest.owner === u.owner) {
      const [x, y] = this.freeSpotNear(dest.tx + dest.size, dest.ty + dest.size);
      u.x = x; u.y = y;
    }
    u.tunnelTo = 0;
    this.events.push({ k: 'tunnel', x: u.x, y: u.y, owner: u.owner, up: true });
    if (u.order?.k === 'tunnel') this.next(u);
    else if (!u.order && u.queue.length) this.next(u);
    u.homeX = u.x; u.homeY = u.y;
  }

  // ---------------------------------------------------------------- movement
  private reachRect(u: Unit, tx: number, ty: number, w: number, h: number, slack: number) {
    const x0 = tx * T, y0 = ty * T, x1 = x0 + w * T, y1 = y0 + h * T;
    const dx = u.x < x0 ? x0 - u.x : u.x > x1 ? u.x - x1 : 0, dy = u.y < y0 ? y0 - u.y : u.y > y1 ? u.y - y1 : 0;
    return isqrt(dx * dx + dy * dy) <= Math.round(u.def.r * T) + slack;
  }
  /** Walks toward a point; true once within `arrive` world units. `near` lets the path stop that many tiles short. */
  walk(u: Unit, x: number, y: number, arrive: number, near = 0): boolean {
    if (dist(u.x, u.y, x, y) <= arrive) { u.path = null; return true; }
    if (u.root > 0) return false;
    const tx = Math.max(0, Math.min(this.W - 1, Math.floor(x / T))), ty = Math.max(0, Math.min(this.H - 1, Math.floor(y / T)));
    if (!this.follow(u, tx, ty, 1, 1, near, x, y)) return false;
    const d = dist(u.x, u.y, x, y);
    if (d <= arrive || u.stuck > 2 || (d <= T && u.stuck > 1)) { u.path = null; return true; }
    return false;
  }
  private walkRect(u: Unit, tx: number, ty: number, w: number, h: number, near = 1) {
    if (u.root > 0) return;
    this.follow(u, tx, ty, w, h, near, (tx + w / 2) * T, (ty + h / 2) * T);
  }
  /**
   * Follows a path to the tile rectangle (pathing again when the goal moves or the walker gets stuck). Returns true when
   * the path is used up.
   */
  private follow(u: Unit, tx: number, ty: number, w: number, h: number, near: number, gx: number, gy: number): boolean {
    const sp = this.speedOf(u);
    if (u.def.air) { this.stepTo(u, gx, gy, sp); return dist(u.x, u.y, gx, gy) <= sp; }
    const key = ((ty * 4096 + tx) * 8 + w) * 8 + h + near * 1e9;
    // stuck check: every 20 ticks, has it moved a quarter tile?
    if (this.tick - u.chkAt >= 20) {
      if (u.path && dist(u.x, u.y, u.chkX, u.chkY) < T / 4) { u.stuck++; u.path = null; u.pathKey = -1; } else if (u.stuck > 0 && u.path) u.stuck = Math.max(0, u.stuck - 1);
      u.chkAt = this.tick; u.chkX = u.x; u.chkY = u.y;
    }
    const fresh = u.path && u.pathKey !== key && this.tick - u.pathAt < 10;
    if ((u.pathKey !== key || !u.path) && !fresh) {
      if (this.budget <= 0) { if (!u.path) { this.stepTo(u, gx, gy, sp); return false; } }
      else {
        this.budget--;
        const sx = Math.floor(u.x / T), sy = Math.floor(u.y / T);
        const tilesPath = findPath(this.grid, sx, sy, tx, ty, tx + w - 1, ty + h - 1, near);
        u.pathKey = key; u.pathAt = this.tick;
        if (!tilesPath) { u.path = []; u.pi = 0; }
        else { u.path = smooth(this.grid, u.x / T, u.y / T, tilesPath, u.def.r * 0.8); u.pi = 0; }
      }
    }
    const path = u.path!;
    if (!path || u.pi >= path.length) {
      // the path is used up: finish the last stretch straight, if the way is open
      if (w === 1 && h === 1) { const before = u.x + u.y * 7; this.stepTo(u, gx, gy, sp); if (u.x + u.y * 7 === before) u.stuck++; }
      return true;
    }
    const wx = Math.round(path[u.pi] * T), wy = Math.round(path[u.pi + 1] * T);
    if (dist(u.x, u.y, wx, wy) <= sp + 4) { u.x = wx; u.y = wy; u.pi += 2; u.moving = true; return u.pi >= path.length; }
    this.stepTo(u, wx, wy, sp);
    return false;
  }
  /** One step toward a point, sliding along walls. */
  private stepTo(u: Unit, x: number, y: number, sp: number) {
    const dx = x - u.x, dy = y - u.y, d = isqrt(dx * dx + dy * dy);
    if (d === 0) return;
    const mx = d <= sp ? dx : Math.trunc((dx * sp) / d), my = d <= sp ? dy : Math.trunc((dy * sp) / d);
    if (Math.abs(dx) > 8) u.face = dx > 0 ? 1 : -1;
    u.moving = true;
    if (u.def.air) { u.x = Math.max(0, Math.min(this.W * T - 1, u.x + mx)); u.y = Math.max(0, Math.min(this.H * T - 1, u.y + my)); return; }
    const r = Math.round(u.def.r * T * 0.7);
    const nx = u.x + mx, ny = u.y + my;
    if (this.walkable(nx + Math.sign(mx) * r, u.y)) u.x = nx;
    if (this.walkable(u.x, ny + Math.sign(my) * r)) u.y = ny;
  }
  walkable(x: number, y: number) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H && this.grid.block[ty * this.W + tx] === 0;
  }
  /** Pushes overlapping walkers apart (gatherers at work pass through each other), and anyone stuck in a wall out. */
  private separate() {
    this.rebuildHash();
    const tmp: Unit[] = [];
    for (const a of this.units) {
      if (a.under || a.hp <= 0) continue;
      if (!a.def.air && !this.walkable(a.x, a.y)) { const [fx, fy] = this.freeSpotNear(Math.floor(a.x / T), Math.floor(a.y / T)); a.x = fx; a.y = fy; a.path = null; continue; }
      const ra = Math.round(a.def.r * T), ghostA = a.def.worker && (a.order?.k === 'gather' || a.order?.k === 'return');
      for (const b of this.near(a.x, a.y, ra + T, tmp)) {
        if (b.id <= a.id || !!b.def.air !== !!a.def.air || b.under) continue;
        if (ghostA && b.def.worker && b.owner === a.owner) continue;
        // friends on the move slip past each other; only resting friends and enemies jostle
        if (a.owner === b.owner && a.moving && b.moving) continue;
        const rb = Math.round(b.def.r * T), min = Math.round((ra + rb) * 0.85);
        let dx = b.x - a.x, dy = b.y - a.y; const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = isqrt(d2);
        if (d === 0) { dx = ((a.id * 7 + b.id * 13) % 5) - 2 || 1; dy = ((a.id * 11 + b.id * 3) % 5) - 2; d = isqrt(dx * dx + dy * dy); }
        const push = Math.min(T / 6, (min - d) >> 1) + 1;
        const px = Math.trunc((dx * push) / d), py = Math.trunc((dy * push) / d);
        // whoever is busy walking or working holds its ground a little more
        const aw = a.moving || a.work ? 1 : 2, bw = b.moving || b.work ? 1 : 2;
        const ax = Math.trunc((px * aw) / 2), ay = Math.trunc((py * aw) / 2), bx = Math.trunc((px * bw) / 2), by = Math.trunc((py * bw) / 2);
        if (a.def.air || this.walkable(a.x - ax, a.y - ay)) { a.x -= ax; a.y -= ay; }
        if (b.def.air || this.walkable(b.x + bx, b.y + by)) { b.x += bx; b.y += by; }
      }
    }
  }

  // ---------------------------------------------------------------- traps, clouds, poofs
  private updTraps() {
    if (!this.traps.length) return;
    const r = tiles(TRAP.reach);
    this.traps = this.traps.filter((tr) => {
      for (const u of this.near(tr.x, tr.y, r + T)) {
        if (u.def.air || u.under || !this.enemies(tr.owner, u.owner) || dist(u.x, u.y, tr.x, tr.y) > r) continue;
        u.root = secs(TRAP.root); u.path = null;
        this.damage(u, TRAP.dmg, tr.owner, 0);
        this.events.push({ k: 'trap', x: tr.x, y: tr.y, owner: tr.owner });
        return false;
      }
      return true;
    });
  }
  private updClouds() {
    for (const c of this.clouds) {
      c.left--;
      for (const u of this.near(c.x, c.y, c.r + T)) if (this.enemies(c.owner, u.owner) && !u.under && dist(u.x, u.y, c.x, c.y) <= c.r) u.slow = Math.max(u.slow, secs(1));
    }
    this.clouds = this.clouds.filter((c) => c.left > 0);
  }
  private cleanup() {
    if (this.units.some((u) => u.hp <= 0)) {
      for (const u of this.units) if (u.hp <= 0) this.poof(u);
      this.units = this.units.filter((u) => u.hp > 0);
    }
    for (const b of [...this.buildings]) if (b.hp <= 0) this.removeBuilding(b, true);
  }
  private poof(u: Unit) {
    this.releaseNode(u); this.byId.delete(u.id);
    const p = this.players[u.owner]; p.stats.lost++;
    if (u.order) this.unpaid(u, u.order); for (const o of u.queue) this.unpaid(u, o);
    this.events.push({ k: 'poof', x: u.x, y: u.y, type: u.type, owner: u.owner, air: !!u.def.air });
    // the Guild tidies up after everyone
    const reach = tiles(SALVAGE_REACH);
    let best: Player | null = null, bd = Infinity;
    for (const g of this.players) {
      if (g.side !== 'guild' || g.out || g.team === p.team) continue;
      for (const r of this.near(u.x, u.y, reach)) if (r.owner === g.id && r !== u) { const d = dist(r.x, r.y, u.x, u.y); if (d <= reach && d < bd) { bd = d; best = g; } }
    }
    if (best && (u.def.hay || u.def.glimmer)) {
      const hay = Math.floor((u.def.hay * SALVAGE) / 100), glimmer = Math.floor((u.def.glimmer * SALVAGE) / 100);
      best.hay += hay; best.glimmer += glimmer; best.stats.salvage += hay + glimmer;
      this.events.push({ k: 'salvage', x: u.x, y: u.y, owner: best.id, hay, glimmer });
    }
  }
  /** Takes a unit off the map without a poof (packing, unpacking). */
  private poofSilently(u: Unit) { this.releaseNode(u); u.hp = 0; this.byId.delete(u.id); this.units = this.units.filter((x) => x !== u); }
  removeBuilding(b: Building, tidy: boolean) {
    this.stamp(b.tx, b.ty, b.size, 0);
    this.buildings = this.buildings.filter((x) => x !== b); this.byId.delete(b.id);
    if (tidy) {
      // refund what was still in the queue
      const p = this.players[b.owner];
      for (const q of b.queue) if (q.k === 'up') delete p.ups[q.id];
      this.events.push({ k: 'tidy', x: b.x, y: b.y, type: b.type, owner: b.owner, size: b.size });
    }
  }
  private removeNode(n: Node) {
    this.stamp(n.tx, n.ty, 2, 0);
    this.nodes = this.nodes.filter((x) => x !== n); this.byId.delete(n.id);
  }
  private checkEnd() {
    for (const p of this.players) {
      if (p.out) continue;
      if (this.cfg.scripted) continue;
      if (!this.buildings.some((b) => b.owner === p.id) && !this.units.some((u) => u.owner === p.id && u.type === 'wagon')) {
        p.out = true; this.events.push({ k: 'out', owner: p.id });
        for (const u of this.units) if (u.owner === p.id) { u.hp = 0; }
        this.cleanupQuiet();
      }
    }
    if (this.cfg.scripted) return;
    const teams = new Set(this.players.filter((p) => !p.out).map((p) => p.team));
    if (teams.size <= 1) { this.result = { winner: teams.size ? [...teams][0] : -1, reason: 'rout' }; return; }
    const limit = this.cfg.limit ?? secs(TIME_LIMIT_MIN * 60);
    if (limit && this.tick >= limit) {
      const score = new Map<number, number>();
      for (const p of this.players) score.set(p.team, (score.get(p.team) ?? 0) + this.score(p));
      const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      this.result = { winner: ranked[0][0], reason: 'time' };
    }
  }
  private cleanupQuiet() { for (const u of this.units) if (u.hp <= 0) this.poof(u); this.units = this.units.filter((u) => u.hp > 0); }
  /** What a player's side is worth: what it has standing, what it gathered, and what it poofed. */
  score(p: Player) {
    let s = Math.floor((p.stats.hay + p.stats.glimmer * 2) / 4) + p.stats.poofed * 10;
    for (const u of this.units) if (u.owner === p.id) s += u.def.hay + u.def.glimmer * 2;
    for (const b of this.buildings) if (b.owner === p.id && b.done) s += b.def.hay + b.def.glimmer * 2;
    return s;
  }

  // ---------------------------------------------------------------- fog
  private discs = new Map<number, number[]>();
  private disc(r: number) {
    let d = this.discs.get(r); if (d) return d;
    d = []; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) d.push(i, j);
    this.discs.set(r, d); return d;
  }
  refreshFog(force: boolean) {
    const W = this.W, H = this.H;
    for (const [team, v] of this.vis) {
      if (!this.fogOn) { v.fill(2); continue; }
      for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
      const mark = (cx: number, cy: number, r: number) => {
        const d = this.disc(r);
        for (let k = 0; k < d.length; k += 2) { const x = cx + d[k], y = cy + d[k + 1]; if (x >= 0 && y >= 0 && x < W && y < H) v[y * W + x] = 2; }
      };
      for (const u of this.units) if (this.players[u.owner].team === team && !u.under) mark(Math.floor(u.x / T), Math.floor(u.y / T), u.def.sight);
      for (const b of this.buildings) if (this.players[b.owner].team === team) mark(b.tx + (b.size >> 1), b.ty + (b.size >> 1), b.done ? (b.def.tower ? 8 : 6) : 3);
    }
    for (const [team, mem] of this.known) {
      for (const b of this.buildings) if (this.players[b.owner].team !== team && this.seenBuilding(team, b)) mem.set(b.id, { type: b.type, owner: b.owner, tx: b.tx, ty: b.ty, size: b.size });
      for (const [id, k] of mem) if (!this.byId.has(id) && this.seen(team, (k.tx + k.size / 2) * T, (k.ty + k.size / 2) * T)) mem.delete(id);
    }
    void force;
  }
  seen(team: number, x: number, y: number) {
    if (!this.fogOn) return true;
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return false;
    return this.vis.get(team)![ty * this.W + tx] === 2;
  }
  seenBuilding(team: number, b: Building) {
    if (!this.fogOn) return true;
    const v = this.vis.get(team)!;
    for (let j = b.ty; j < b.ty + b.size; j++) for (let i = b.tx; i < b.tx + b.size; i++) if (v[j * this.W + i] === 2) return true;
    return false;
  }
  visibleTo(owner: number, t: Unit | Building) {
    const team = this.players[owner].team;
    if (t.kind === 'building') return this.players[t.owner].team === team || this.seenBuilding(team, t);
    return this.players[t.owner].team === team || this.seen(team, t.x, t.y);
  }

  // ---------------------------------------------------------------- checks
  /** A fingerprint of the whole match, for replay tests. */
  fingerprint() {
    let h = this.tick | 0;
    const mix = (n: number) => { h = Math.imul(h ^ (n | 0), 16777619) >>> 0; };
    for (const u of this.units) { mix(u.id); mix(u.x); mix(u.y); mix(u.hp); mix(u.carry); }
    for (const b of this.buildings) { mix(b.id); mix(b.hp); mix(b.progress); mix(b.queue.length); }
    for (const n of this.nodes) mix(n.amount);
    for (const p of this.players) { mix(p.hay); mix(p.glimmer); mix(p.used); }
    return h >>> 0;
  }
}

/** Plays back a logged match: the same setup, the same orders at the same ticks. */
export function replay(make: () => World, log: { t: number; c: Cmd }[], ticks: number) {
  const w = make();
  let i = 0;
  while (w.tick < ticks && !w.result) {
    while (i < log.length && log[i].t === w.tick) w.issue(log[i++].c);
    w.step();
  }
  return w;
}

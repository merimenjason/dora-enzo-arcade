// Burrow Town: a cozy valley city builder. Deterministic rules with no DOM so
// tests can drive it directly; the Three.js scene in burrow-town-scene.ts only
// draws what this engine says.
export const W = 16;
export const H = 12;
/** Seconds between simulation ticks. */
export const TICK = 2;
/** Seconds in one in-game day; the scene lights lamps for the second half. */
export const DAY = 120;
export const START_HAY = 120;
export const BRIDGE_MULTIPLIER = 3;

export type Terrain = 'grass' | 'terrace' | 'rock' | 'river';
export type BuildingId =
  | 'burrow'
  | 'hayfarm'
  | 'dustbath'
  | 'garden'
  | 'bigburrow'
  | 'plaza'
  | 'quarry'
  | 'market'
  | 'workshop'
  | 'watchtower';
export type Tool = BuildingId | 'road' | 'demolish';
export type Advisor = 'dora' | 'enzo';

export type Building = {
  id: BuildingId;
  title: string;
  cost: number;
  /** Residents the building can hold. */
  houses: number;
  /** Amenity or nuisance radius in tiles (Manhattan distance). */
  radius: number;
  /** Which advisor's approval unlocks it; null is available from the start. */
  advisor: Advisor | null;
  /** Approval needed from that advisor. */
  unlock: number;
  /** Terrain the building may be placed on. */
  on: Terrain[];
  icon: string;
  blurb: string;
};

export const BUILDINGS: Record<BuildingId, Building> = {
  burrow: { id: 'burrow', title: 'Burrow', cost: 20, houses: 4, radius: 0, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '🕳️', blurb: 'Home for four chinchillas. Must touch a road that leads to a plaza.' },
  hayfarm: { id: 'hayfarm', title: 'Hay farm', cost: 25, houses: 0, radius: 0, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '🌾', blurb: 'Grows 3 hay a tick, 4 on a terrace, and 1 more beside the river.' },
  dustbath: { id: 'dustbath', title: 'Dust bath', cost: 30, houses: 0, radius: 3, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '☁️', blurb: 'Comfort for every burrow within 3 tiles.' },
  garden: { id: 'garden', title: 'Garden', cost: 25, houses: 0, radius: 2, advisor: 'dora', unlock: 25, on: ['grass', 'terrace'], icon: '🌸', blurb: 'Comfort for burrows within 2 tiles.' },
  bigburrow: { id: 'bigburrow', title: 'Big burrow', cost: 60, houses: 10, radius: 0, advisor: 'dora', unlock: 50, on: ['grass', 'terrace'], icon: '🏡', blurb: 'Home for ten. Needs a road like any burrow.' },
  plaza: { id: 'plaza', title: 'Plaza', cost: 80, houses: 0, radius: 4, advisor: 'dora', unlock: 75, on: ['grass', 'terrace'], icon: '⛲', blurb: 'A second town centre: roads that reach it count as connected, and burrows within 4 tiles are happier.' },
  quarry: { id: 'quarry', title: 'Quarry', cost: 40, houses: 0, radius: 2, advisor: null, unlock: 0, on: ['rock'], icon: '⛏️', blurb: 'Only on rock. Earns 2 hay a tick and lets workshops work. Noisy for burrows within 2 tiles.' },
  market: { id: 'market', title: 'Market', cost: 50, houses: 0, radius: 4, advisor: 'enzo', unlock: 25, on: ['grass', 'terrace'], icon: '🧺', blurb: 'Earns 1 hay a tick for every 3 residents within 4 tiles, up to 8.' },
  workshop: { id: 'workshop', title: 'Workshop', cost: 45, houses: 0, radius: 2, advisor: 'enzo', unlock: 50, on: ['grass', 'terrace'], icon: '🔧', blurb: 'Earns 4 hay a tick with a connected quarry, 1 without. Noisy for burrows within 2 tiles.' },
  watchtower: { id: 'watchtower', title: 'Watchtower', cost: 35, houses: 0, radius: 5, advisor: 'enzo', unlock: 75, on: ['grass', 'terrace', 'rock'], icon: '🗼', blurb: 'Comfort for burrows within 5 tiles, and a lamp for the night.' },
};
export const BUILDING_ORDER: BuildingId[] = ['burrow', 'hayfarm', 'dustbath', 'garden', 'bigburrow', 'plaza', 'quarry', 'market', 'workshop', 'watchtower'];
export const ROAD_COST = 4;
export const HOUSING: BuildingId[] = ['burrow', 'bigburrow'];
export const AMENITIES: BuildingId[] = ['dustbath', 'garden', 'plaza', 'watchtower'];
export const NUISANCES: BuildingId[] = ['quarry', 'workshop'];
/** Share of capacity that moves in at each comfort level 0..4. */
export const OCCUPANCY = [0.4, 0.6, 0.8, 1, 1];
export const HAY_PER_RESIDENT = 0.2;

export type Tile = {
  x: number;
  y: number;
  t: Terrain;
  b: BuildingId | null;
  road: boolean;
  /** Residents living here (housing only). */
  res: number;
  /** Amenities minus nuisances in range, clamped 0..4 (housing only). */
  comfort: number;
  /** Reachable from a plaza by road. */
  linked: boolean;
  /** Hay this building earned last tick. */
  yield: number;
};

export type Valley = {
  name: string;
  seed: number;
  blurb: string;
  river: boolean;
  rocks: number;
  terraces: number;
  goal: { residents: number; approval: number };
};
export const VALLEYS: Valley[] = [
  { name: 'Meadow Hollow', seed: 11, blurb: 'A gentle green bowl with two rocky knuckles. Learn the roads and the hay.', river: false, rocks: 2, terraces: 1, goal: { residents: 20, approval: 25 } },
  { name: 'Silver Creek', seed: 23, blurb: 'A creek winds through the middle. Bridges cost triple, and farms love the water.', river: true, rocks: 3, terraces: 1, goal: { residents: 40, approval: 40 } },
  { name: 'Terrace Steps', seed: 37, blurb: 'Old stone terraces climb both banks. Rich farmland, tight for housing.', river: true, rocks: 3, terraces: 3, goal: { residents: 60, approval: 50 } },
  { name: 'Condor Shelf', seed: 51, blurb: 'Rock on every side. Quarries and workshops will pay, if the burrows can bear the noise.', river: false, rocks: 6, terraces: 2, goal: { residents: 90, approval: 60 } },
  { name: 'Lake Titicaca Shore', seed: 68, blurb: 'The last valley. Water, stone and terraces, and both advisors expecting their dream town.', river: true, rocks: 5, terraces: 3, goal: { residents: 120, approval: 75 } },
];
export const SANDBOX: Valley = { name: 'Open Valley', seed: 99, blurb: 'No goal, no clock. A river, some rock and room to dream.', river: true, rocks: 4, terraces: 2, goal: { residents: Infinity, approval: Infinity } };

export type Request = {
  key: string;
  advisor: Advisor;
  text: string;
  reward: number;
  /** [progress, target] */
  progress: [number, number];
  done: boolean;
};
type RequestDef = { key: string; advisor: Advisor; text: string; reward: number; check: (g: BurrowTown) => [number, number] };

/** Advisor wishes. Targets grow with the valley number so later valleys ask for more. */
export const REQUESTS: RequestDef[] = [
  { key: 'homes', advisor: 'dora', text: 'Build {n} burrows with a road to the plaza.', reward: 20, check: (g) => [g.count((t) => HOUSING.includes(t.b!) && t.linked), 3 + g.level] },
  { key: 'bath-near', advisor: 'dora', text: 'Give every home a dust bath within 3 tiles ({n} homes at least).', reward: 20, check: (g) => { const homes = g.tiles.filter((t) => HOUSING.includes(t.b!)); const ok = homes.filter((t) => g.near(t, 'dustbath', 3)).length; return [ok, Math.max(3 + g.level, homes.length)]; } },
  { key: 'gardens', advisor: 'dora', text: 'Plant {n} gardens.', reward: 20, check: (g) => [g.count((t) => t.b === 'garden'), 2 + g.level] },
  { key: 'happy', advisor: 'dora', text: 'Reach {n} happiness.', reward: 20, check: (g) => [Math.floor(g.stats.happiness), 50 + g.level * 8] },
  { key: 'residents', advisor: 'dora', text: 'Welcome {n} residents.', reward: 20, check: (g) => [g.stats.residents, 12 + g.level * 12] },
  { key: 'bigburrow', advisor: 'dora', text: 'Build {n} big burrows.', reward: 20, check: (g) => [g.count((t) => t.b === 'bigburrow'), 1 + Math.floor(g.level / 2)] },
  { key: 'quiet', advisor: 'dora', text: 'Keep every home at least 3 tiles from quarries and workshops, with {n} homes.', reward: 20, check: (g) => { const homes = g.tiles.filter((t) => HOUSING.includes(t.b!)); const quiet = homes.filter((t) => !g.near(t, 'quarry', 2) && !g.near(t, 'workshop', 2)).length; return [quiet, Math.max(3 + g.level, homes.length)]; } },
  { key: 'plaza-garden', advisor: 'dora', text: 'Plant a garden within 2 tiles of a plaza.', reward: 15, check: (g) => [g.count((t) => t.b === 'garden' && g.near(t, 'plaza', 2)) ? 1 : 0, 1] },
  { key: 'quarry', advisor: 'enzo', text: 'Open a quarry and connect it by road.', reward: 20, check: (g) => [g.count((t) => t.b === 'quarry' && t.linked) ? 1 : 0, 1] },
  { key: 'farms', advisor: 'enzo', text: 'Run {n} connected hay farms.', reward: 20, check: (g) => [g.count((t) => t.b === 'hayfarm' && t.linked), 3 + g.level] },
  { key: 'hay', advisor: 'enzo', text: 'Store {n} hay.', reward: 20, check: (g) => [Math.floor(g.hay), 200 + g.level * 100] },
  { key: 'income', advisor: 'enzo', text: 'Earn {n} hay a tick.', reward: 20, check: (g) => [Math.floor(g.stats.income), 15 + g.level * 8] },
  { key: 'market', advisor: 'enzo', text: 'Build a market with {n} residents within 4 tiles.', reward: 20, check: (g) => [Math.max(0, ...g.tiles.filter((t) => t.b === 'market').map((t) => g.residentsNear(t, 4))), 12 + g.level * 4] },
  { key: 'workshops', advisor: 'enzo', text: 'Build {n} workshops.', reward: 20, check: (g) => [g.count((t) => t.b === 'workshop'), 1 + Math.floor(g.level / 2)] },
  { key: 'roads', advisor: 'enzo', text: 'Lay {n} tiles of road.', reward: 15, check: (g) => [g.count((t) => t.road), 14 + g.level * 6] },
  { key: 'watchtower', advisor: 'enzo', text: 'Raise a watchtower.', reward: 20, check: (g) => [g.count((t) => t.b === 'watchtower') ? 1 : 0, 1] },
  { key: 'terrace-farm', advisor: 'enzo', text: 'Farm {n} terraces.', reward: 15, check: (g) => [g.count((t) => t.b === 'hayfarm' && t.t === 'terrace'), 2 + Math.floor(g.level / 2)] },
];
export const ACTIVE_REQUESTS = 3;
export const MAX_APPROVAL = 100;

export type Save = {
  v: 1;
  valley: number;
  hay: number;
  time: number;
  approval: Record<Advisor, number>;
  done: string[];
  active: string[];
  tiles: string;
  res: number[];
  won: boolean;
};

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const TERRAIN_CODE: Record<Terrain, string> = { grass: 'g', terrace: 't', rock: 'r', river: 'w' };
const CODE_TERRAIN = Object.fromEntries(Object.entries(TERRAIN_CODE).map(([k, v]) => [v, k])) as Record<string, Terrain>;
const BUILDING_CODE = 'ABCDEFGHIJ';

/** Lay out a valley's terrain from its seed. The plaza square in the middle is always clear grass. */
export function makeTerrain(v: Valley): Terrain[] {
  const rnd = mulberry(v.seed);
  const t: Terrain[] = Array.from({ length: W * H }, () => 'grass' as Terrain);
  const at = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const centre = { x: W >> 1, y: H >> 1 };
  const isCentre = (x: number, y: number) => Math.abs(x - centre.x) <= 2 && Math.abs(y - centre.y) <= 2;
  if (v.river) {
    const vertical = rnd() < 0.5;
    const len = vertical ? H : W;
    const width = vertical ? W : H;
    let pos = Math.floor(width * (0.2 + rnd() * 0.25));
    const phase = rnd() * 6.28;
    for (let i = 0; i < len; i++) {
      pos = Math.max(1, Math.min(width - 2, Math.round(pos + Math.sin(i * 0.7 + phase) * 0.9)));
      const x = vertical ? pos : i;
      const y = vertical ? i : pos;
      if (!isCentre(x, y)) t[at(x, y)] = 'river';
    }
  }
  for (let r = 0; r < v.rocks; r++) {
    const cx = Math.floor(rnd() * W);
    const cy = Math.floor(rnd() * H);
    const size = 1 + Math.floor(rnd() * 2);
    for (let dy = -size; dy <= size; dy++)
      for (let dx = -size; dx <= size; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!inside(x, y) || isCentre(x, y) || t[at(x, y)] !== 'grass') continue;
        if (Math.abs(dx) + Math.abs(dy) <= size && rnd() < 0.85) t[at(x, y)] = 'rock';
      }
  }
  for (let b = 0; b < v.terraces; b++) {
    const horizontal = rnd() < 0.5;
    const line = Math.floor(rnd() * (horizontal ? H : W));
    const start = Math.floor(rnd() * 4);
    const len = 3 + Math.floor(rnd() * 5);
    for (let i = start; i < start + len; i++) {
      const x = horizontal ? i : line;
      const y = horizontal ? line : i;
      if (inside(x, y) && !isCentre(x, y) && t[at(x, y)] === 'grass') t[at(x, y)] = 'terrace';
    }
  }
  // River banks are fertile terraces where the land is free.
  if (v.river)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (t[at(x, y)] === 'grass' && !isCentre(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && t[at(x + dx, y + dy)] === 'river') && rnd() < 0.45) t[at(x, y)] = 'terrace';
  return t;
}

export class BurrowTown {
  tiles: Tile[] = [];
  hay = START_HAY;
  time = 0;
  acc = 0;
  paused = false;
  tool: Tool = 'road';
  approval: Record<Advisor, number> = { dora: 0, enzo: 0 };
  requests: Request[] = [];
  done: string[] = [];
  won = false;
  valley: Valley;
  /** Zero-based valley index, or -1 for the sandbox. */
  index: number;
  stats = { residents: 0, capacity: 0, income: 0, upkeep: 0, happiness: 0, roads: 0, homes: 0 };
  /** One-shot notices for the page: 'place', 'road', 'demolish', 'deny', 'request', 'unlock:<id>', 'won'. */
  events: string[] = [];
  /** Short advisor lines, newest first. */
  log: { who: Advisor | 'town'; text: string; at: number }[] = [];
  private rnd: () => number;

  constructor(index = 0) {
    this.index = index;
    this.valley = index < 0 ? SANDBOX : VALLEYS[Math.min(index, VALLEYS.length - 1)];
    this.rnd = mulberry(this.valley.seed * 7 + 3);
    const terrain = makeTerrain(this.valley);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) this.tiles.push({ x, y, t: terrain[y * W + x], b: null, road: false, res: 0, comfort: 0, linked: false, yield: 0 });
    this.tile(W >> 1, H >> 1)!.b = 'plaza';
    this.say('dora', `Welcome to ${this.valley.name}. Let's make it feel like home.`);
    this.say('enzo', 'Roads first. Nothing works until it touches the plaza.');
    this.recompute();
    this.refill();
  }

  /** Valley number used to scale request targets: 1 for the first valley, sandbox counts as 3. */
  get level() {
    return this.index < 0 ? 3 : this.index + 1;
  }
  get day() {
    return Math.floor(this.time / DAY) + 1;
  }
  /** 0..1 through the day; lamps come on after 0.5. */
  get daylight() {
    return (this.time % DAY) / DAY;
  }
  get goalMet() {
    return this.stats.residents >= this.valley.goal.residents && this.approval.dora >= this.valley.goal.approval && this.approval.enzo >= this.valley.goal.approval;
  }

  tile(x: number, y: number) {
    return x >= 0 && y >= 0 && x < W && y < H ? this.tiles[y * W + x] : null;
  }
  count(fn: (t: Tile) => boolean) {
    return this.tiles.reduce((n, t) => n + (fn(t) ? 1 : 0), 0);
  }
  /** Is a building of this kind within `r` tiles (Manhattan) of the tile? */
  near(t: Tile, id: BuildingId, r: number) {
    return this.tiles.some((o) => o.b === id && Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= r);
  }
  residentsNear(t: Tile, r: number) {
    return this.tiles.reduce((n, o) => n + (Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= r ? o.res : 0), 0);
  }
  unlocked(id: BuildingId) {
    const b = BUILDINGS[id];
    return !b.advisor || this.approval[b.advisor] >= b.unlock;
  }
  cost(tool: Tool, x: number, y: number) {
    if (tool === 'demolish') return 0;
    if (tool === 'road') return this.tile(x, y)?.t === 'river' ? ROAD_COST * BRIDGE_MULTIPLIER : ROAD_COST;
    return BUILDINGS[tool].cost;
  }
  /** Why the current tool cannot go on a tile, or '' when it can. */
  blocked(tool: Tool, x: number, y: number): string {
    const t = this.tile(x, y);
    if (!t) return 'Off the map.';
    if (tool === 'demolish') return t.b || t.road ? (t.b === 'plaza' && this.count((o) => o.b === 'plaza') === 1 ? 'The last plaza stays.' : '') : 'Nothing here to clear.';
    if (t.b) return 'Already built on.';
    if (tool === 'road') {
      if (t.road) return 'Already a road.';
      if (t.t === 'rock') return 'Roads cannot cross rock.';
    } else {
      if (t.road) return 'Clear the road first.';
      if (!this.unlocked(tool)) return `${BUILDINGS[tool].advisor === 'dora' ? 'Dora' : 'Enzo'} hasn't unlocked that yet.`;
      if (!BUILDINGS[tool].on.includes(t.t)) return tool === 'quarry' ? 'Quarries need rock.' : t.t === 'river' ? 'Nothing builds on water.' : 'Rock is too hard to dig.';
    }
    if (this.cost(tool, x, y) > this.hay) return 'Not enough hay.';
    return '';
  }
  /** Apply the current tool to a tile. Returns the reason it failed, or '' on success. */
  apply(x: number, y: number, tool: Tool = this.tool): string {
    const why = this.blocked(tool, x, y);
    if (why) {
      this.events.push('deny');
      return why;
    }
    const t = this.tile(x, y)!;
    if (tool === 'demolish') {
      const refund = t.b ? Math.floor(BUILDINGS[t.b].cost / 2) : Math.floor(ROAD_COST / 2);
      this.hay += refund;
      t.b = null;
      t.road = false;
      t.res = 0;
      this.events.push('demolish');
    } else {
      this.hay -= this.cost(tool, x, y);
      if (tool === 'road') t.road = true;
      else t.b = tool;
      this.events.push(tool === 'road' ? 'road' : 'place');
    }
    this.recompute();
    return '';
  }
  setTool(tool: Tool) {
    this.tool = tool;
  }
  pause() {
    this.paused = !this.paused;
  }

  /** Advance real time; runs a simulation tick every TICK seconds. */
  step(dt: number) {
    if (this.paused || this.won) return;
    this.time += dt;
    this.acc += dt;
    while (this.acc >= TICK) {
      this.acc -= TICK;
      this.tick();
    }
  }

  /** Roads reachable from any plaza, then which buildings touch them. */
  recompute() {
    const linkedRoad = new Set<number>();
    const queue: Tile[] = [];
    const push = (t: Tile | null) => {
      if (t && t.road && !linkedRoad.has(t.y * W + t.x)) {
        linkedRoad.add(t.y * W + t.x);
        queue.push(t);
      }
    };
    const around = (t: Tile) => [this.tile(t.x + 1, t.y), this.tile(t.x - 1, t.y), this.tile(t.x, t.y + 1), this.tile(t.x, t.y - 1)];
    for (const t of this.tiles) if (t.b === 'plaza') around(t).forEach(push);
    while (queue.length) around(queue.shift()!).forEach(push);
    for (const t of this.tiles) {
      t.linked = t.b === 'plaza' || (!!t.b && around(t).some((o) => o && ((o.road && linkedRoad.has(o.y * W + o.x)) || o.b === 'plaza'))) || (t.road && linkedRoad.has(t.y * W + t.x));
      if (t.b && HOUSING.includes(t.b)) {
        let c = 0;
        for (const id of AMENITIES) if (this.near(t, id, BUILDINGS[id].radius)) c++;
        for (const id of NUISANCES) if (this.near(t, id, BUILDINGS[id].radius)) c--;
        t.comfort = Math.max(0, Math.min(4, c));
      } else {
        t.comfort = 0;
        t.res = 0;
      }
    }
    this.measure();
  }

  private measure() {
    const s = this.stats;
    s.residents = 0;
    s.capacity = 0;
    s.homes = 0;
    s.roads = 0;
    let comfortSum = 0;
    let occupied = 0;
    for (const t of this.tiles) {
      if (t.road) s.roads++;
      if (t.b && HOUSING.includes(t.b)) {
        s.homes++;
        s.residents += t.res;
        s.capacity += BUILDINGS[t.b].houses;
        if (t.res > 0) {
          comfortSum += t.comfort;
          occupied++;
        }
      }
    }
    s.happiness = occupied ? Math.min(100, (comfortSum / occupied / 3) * 100) : 0;
    s.income = this.tiles.reduce((n, t) => n + this.yieldOf(t), 0);
    s.upkeep = s.residents * HAY_PER_RESIDENT;
  }

  /** Hay a building would earn this tick. */
  yieldOf(t: Tile) {
    if (!t.b || !t.linked) return 0;
    switch (t.b) {
      case 'hayfarm': {
        const river = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.tile(t.x + dx, t.y + dy)?.t === 'river');
        return (t.t === 'terrace' ? 4 : 3) + (river ? 1 : 0);
      }
      case 'quarry':
        return 2;
      case 'workshop':
        return this.tiles.some((o) => o.b === 'quarry' && o.linked) ? 4 : 1;
      case 'market':
        return Math.min(8, Math.floor(this.residentsNear(t, 4) / 3));
      default:
        return 0;
    }
  }

  tick() {
    const starving = this.hay <= 0 && this.stats.income < this.stats.upkeep;
    for (const t of this.tiles) {
      t.yield = this.yieldOf(t);
      this.hay += t.yield;
      if (t.b && HOUSING.includes(t.b)) {
        const target = t.linked ? Math.round(BUILDINGS[t.b].houses * OCCUPANCY[t.comfort] * (starving ? 0.5 : 1)) : 0;
        t.res += Math.sign(target - t.res) * Math.min(Math.abs(target - t.res), t.res < target ? 1 : 2);
      }
    }
    this.measure();
    this.hay = Math.max(0, this.hay - this.stats.upkeep);
    this.measure();
    for (const r of this.requests) {
      const def = REQUESTS.find((d) => d.key === r.key)!;
      r.progress = def.check(this);
      if (!r.done && r.progress[0] >= r.progress[1]) {
        r.done = true;
        this.done.push(r.key);
        const before = this.approval[r.advisor];
        this.approval[r.advisor] = Math.min(MAX_APPROVAL, before + r.reward);
        this.hay += r.reward;
        this.events.push('request');
        this.say(r.advisor, r.advisor === 'dora' ? PRAISE_DORA[this.done.length % PRAISE_DORA.length] : PRAISE_ENZO[this.done.length % PRAISE_ENZO.length]);
        for (const id of BUILDING_ORDER) {
          const b = BUILDINGS[id];
          if (b.advisor === r.advisor && before < b.unlock && this.approval[r.advisor] >= b.unlock) {
            this.events.push(`unlock:${id}`);
            this.say(r.advisor, `You can build ${b.title.toLowerCase()}s now.`);
          }
        }
      }
    }
    this.requests = this.requests.filter((r) => !r.done);
    this.refill();
    if (!this.won && this.goalMet) {
      this.won = true;
      this.events.push('won');
      this.say('town', `${this.valley.name} is thriving. Dora and Enzo are both proud of it.`);
    }
  }

  /** Keep three wishes open, alternating advisors so neither is ignored. */
  private refill() {
    let guard = 0;
    while (this.requests.length < ACTIVE_REQUESTS && guard++ < 40) {
      const counts = { dora: 0, enzo: 0 };
      for (const r of this.requests) counts[r.advisor]++;
      const prefer: Advisor = counts.dora <= counts.enzo ? 'dora' : 'enzo';
      const pool = REQUESTS.filter((d) => !this.done.includes(d.key) && !this.requests.some((r) => r.key === d.key));
      if (!pool.length) return;
      const mine = pool.filter((d) => d.advisor === prefer);
      const pick = (mine.length ? mine : pool)[Math.floor(this.rnd() * (mine.length ? mine : pool).length)];
      const progress = pick.check(this);
      this.requests.push({ key: pick.key, advisor: pick.advisor, text: pick.text.replace('{n}', String(progress[1])), reward: pick.reward, progress, done: false });
    }
  }

  say(who: Advisor | 'town', text: string) {
    this.log.unshift({ who, text, at: this.time });
    if (this.log.length > 8) this.log.length = 8;
  }

  save(): Save {
    return {
      v: 1,
      valley: this.index,
      hay: this.hay,
      time: this.time,
      approval: { ...this.approval },
      done: [...this.done],
      active: this.requests.map((r) => r.key),
      tiles: this.tiles.map((t) => TERRAIN_CODE[t.t] + (t.road ? '=' : t.b ? BUILDING_CODE[BUILDING_ORDER.indexOf(t.b)] : '.')).join(''),
      res: this.tiles.map((t) => t.res),
      won: this.won,
    };
  }
  static load(s: Save): BurrowTown {
    const g = new BurrowTown(s.valley);
    g.hay = s.hay;
    g.time = s.time;
    g.approval = { ...s.approval };
    g.done = [...s.done];
    g.won = s.won;
    for (let i = 0; i < g.tiles.length; i++) {
      const code = s.tiles.slice(i * 2, i * 2 + 2);
      const t = g.tiles[i];
      t.t = CODE_TERRAIN[code[0]] ?? t.t;
      t.road = code[1] === '=';
      t.b = code[1] !== '.' && code[1] !== '=' ? BUILDING_ORDER[BUILDING_CODE.indexOf(code[1])] ?? null : null;
      t.res = s.res[i] ?? 0;
    }
    g.recompute();
    g.requests = [];
    for (const key of s.active) {
      const def = REQUESTS.find((d) => d.key === key);
      if (def) {
        const progress = def.check(g);
        g.requests.push({ key, advisor: def.advisor, text: def.text.replace('{n}', String(progress[1])), reward: def.reward, progress, done: false });
      }
    }
    g.log = [];
    g.say('town', `Back in ${g.valley.name}. Day ${g.day}.`);
    g.refill();
    return g;
  }
}

const PRAISE_DORA = ['Oh, that is lovely. The little ones will adore it.', 'See? A soft town is a strong town.', 'I could nap right here. Thank you.', 'Everyone looks so fluffy and calm now.'];
const PRAISE_ENZO = ['Now that is a working town. Nice.', 'Hay in the barn and roads that go somewhere. Good.', 'Efficient. I approve, quietly.', 'Keep this up and we can afford anything.'];

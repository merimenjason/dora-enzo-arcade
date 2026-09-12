// Burrow Town: a cozy valley city builder. Deterministic rules with no DOM so
// tests can drive it directly; the Three.js scene in burrow-town-scene.ts only
// draws what this engine says.
export const W = 16;
export const H = 12;
/** Seconds between simulation ticks at normal speed. */
export const TICK = 2;
/** Seconds in one in-game day; the scene lights lamps for the second half. */
export const DAY = 120;
export const START_HAY = 120;
export const BRIDGE_MULTIPLIER = 3;
/** Hay the town can hold before the granary spills, and what one silo adds. */
export const GRANARY = 300;
export const SILO_CAP = 250;
/** How far a workshop will carry stone from a quarry. */
export const WORKSHOP_RANGE = 4;
/** Stone a working workshop burns each tick. */
export const WORKSHOP_STONE = 1;
/** How much an amenity fades over its radius: 0 not at all, 1 to nothing at the edge. */
export const FALLOFF = 0.6;
/** Extra hay each resident of a perfectly comfortable home brings in per tick. */
export const DELIGHT = 0.15;
/** Every third day is dry: farms away from water grow half as much. */
export const DRY_EVERY = 3;
/** Speeds the clock can run at. */
export const SPEEDS = [1, 2, 4] as const;
/** How many actions can be undone. */
export const UNDO_STEPS = 25;

export type Terrain = 'grass' | 'terrace' | 'rock' | 'river';
export type BuildingId =
  | 'burrow'
  | 'hayfarm'
  | 'dustbath'
  | 'garden'
  | 'bigburrow'
  | 'plaza'
  | 'quarry'
  | 'silo'
  | 'market'
  | 'workshop'
  | 'watchtower';
export type Tool = BuildingId | 'road' | 'demolish';
export type Advisor = 'dora' | 'enzo';

export type Building = {
  id: BuildingId;
  title: string;
  cost: number;
  /** Stone the building needs on top of its hay. */
  stone: number;
  /** Residents the building can hold. */
  houses: number;
  /** Amenity or nuisance radius in tiles (Manhattan distance). */
  radius: number;
  /** Desirability at the building itself; negative for a nuisance. Fades with distance. */
  strength: number;
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
  burrow: { id: 'burrow', title: 'Burrow', cost: 20, stone: 0, houses: 4, radius: 0, strength: 0, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '🕳️', blurb: 'Home for four chinchillas. Must touch a road that leads to a plaza.' },
  hayfarm: { id: 'hayfarm', title: 'Hay farm', cost: 25, stone: 0, houses: 0, radius: 0, strength: 0, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '🌾', blurb: 'Grows 3 hay a tick, 4 on a terrace, and 1 more beside the river. Dry days halve it unless it is on the water.' },
  dustbath: { id: 'dustbath', title: 'Dust bath', cost: 30, stone: 0, houses: 0, radius: 3, strength: 1.5, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '☁️', blurb: 'Comfort for burrows within 3 tiles, strongest right beside it.' },
  garden: { id: 'garden', title: 'Garden', cost: 25, stone: 0, houses: 0, radius: 2, strength: 1.5, advisor: 'dora', unlock: 25, on: ['grass', 'terrace'], icon: '🌸', blurb: 'Comfort for burrows within 2 tiles, strongest right beside it.' },
  bigburrow: { id: 'bigburrow', title: 'Big burrow', cost: 60, stone: 20, houses: 10, radius: 0, strength: 0, advisor: 'dora', unlock: 50, on: ['grass', 'terrace'], icon: '🏡', blurb: 'Home for ten, built with stone. Needs a road like any burrow.' },
  plaza: { id: 'plaza', title: 'Plaza', cost: 80, stone: 25, houses: 0, radius: 4, strength: 1.6, advisor: 'dora', unlock: 75, on: ['grass', 'terrace'], icon: '⛲', blurb: 'A second town centre: roads that reach it count as connected, and burrows nearby are happier.' },
  quarry: { id: 'quarry', title: 'Quarry', cost: 40, stone: 0, houses: 0, radius: 2, strength: -1.5, advisor: null, unlock: 0, on: ['rock'], icon: '⛏️', blurb: 'Only on rock. Digs 2 stone a tick. Noisy for burrows within 2 tiles.' },
  silo: { id: 'silo', title: 'Silo', cost: 45, stone: 0, houses: 0, radius: 0, strength: 0, advisor: null, unlock: 0, on: ['grass', 'terrace'], icon: '🛢️', blurb: `Holds ${SILO_CAP} more hay. Without one the granary only takes in ${GRANARY}, and the farms' surplus spills.` },
  market: { id: 'market', title: 'Market', cost: 50, stone: 0, houses: 0, radius: 4, strength: 0, advisor: 'enzo', unlock: 25, on: ['grass', 'terrace'], icon: '🧺', blurb: 'Earns 1 hay a tick for every 3 residents within 4 tiles, up to 8.' },
  workshop: { id: 'workshop', title: 'Workshop', cost: 45, stone: 10, houses: 0, radius: 2, strength: -1.4, advisor: 'enzo', unlock: 50, on: ['grass', 'terrace'], icon: '🔧', blurb: `Turns stone into hay: 4 a tick with a linked quarry within ${WORKSHOP_RANGE} tiles and stone in store, 1 without. Noisy for burrows within 2 tiles.` },
  watchtower: { id: 'watchtower', title: 'Watchtower', cost: 35, stone: 15, houses: 0, radius: 5, strength: 1.4, advisor: 'enzo', unlock: 75, on: ['grass', 'terrace', 'rock'], icon: '🗼', blurb: 'Comfort for burrows within 5 tiles, and a lamp for the night.' },
};
export const BUILDING_ORDER: BuildingId[] = ['burrow', 'hayfarm', 'dustbath', 'garden', 'bigburrow', 'plaza', 'quarry', 'silo', 'market', 'workshop', 'watchtower'];
export const ROAD_COST = 4;
export const HOUSING: BuildingId[] = ['burrow', 'bigburrow'];
export const AMENITIES: BuildingId[] = ['dustbath', 'garden', 'plaza', 'watchtower'];
export const NUISANCES: BuildingId[] = ['quarry', 'workshop'];
/** Share of capacity that moves in at each comfort level 0..4. */
export const OCCUPANCY = [0.4, 0.6, 0.8, 1, 1];
export const HAY_PER_RESIDENT = 0.2;
/** Buildings that can be found derelict in a valley. */
export const RUIN_KINDS: BuildingId[] = ['burrow', 'hayfarm', 'dustbath', 'market'];
/** Residents get names as they move in. */
export const NAMES = ['Pippin', 'Mochi', 'Biscuit', 'Tofu', 'Nutmeg', 'Pebble', 'Juniper', 'Waffle', 'Clover', 'Barley', 'Sesame', 'Poppy', 'Pumpkin', 'Maple', 'Cinnamon', 'Hazel', 'Marzipan', 'Dumpling'];

export type Tile = {
  x: number;
  y: number;
  t: Terrain;
  b: BuildingId | null;
  road: boolean;
  /** A derelict building: it does nothing until it is rebuilt for half price. */
  ruin: boolean;
  /** Residents living here (housing only). */
  res: number;
  /** Desirability from amenities minus nuisances, before rounding. */
  desire: number;
  /** Rounded desirability, clamped 0..4 (housing only). */
  comfort: number;
  /** Reachable from a plaza by road. */
  linked: boolean;
  /** Hay this building earned last tick. */
  yield: number;
  /** Stone this building dug last tick. */
  stoneYield: number;
};

export type Valley = {
  name: string;
  seed: number;
  blurb: string;
  river: boolean;
  /** The river runs bank to bank: half the valley is cut off until you bridge it. */
  split?: boolean;
  rocks: number;
  terraces: number;
  /** Derelict buildings scattered at the start, rebuildable for half price. */
  ruins?: number;
  goal: { residents: number; approval: number };
};
export const VALLEYS: Valley[] = [
  { name: 'Meadow Hollow', seed: 11, blurb: 'A gentle green bowl with two rocky knuckles. Learn the roads and the hay.', river: false, rocks: 2, terraces: 1, goal: { residents: 20, approval: 25 } },
  { name: 'Silver Creek', seed: 23, blurb: 'A creek winds through the middle. Bridges cost triple, and farms love the water.', river: true, rocks: 3, terraces: 1, goal: { residents: 40, approval: 40 } },
  { name: 'Terrace Steps', seed: 37, blurb: 'Old stone terraces climb both banks. Rich farmland, tight for housing.', river: true, rocks: 3, terraces: 3, goal: { residents: 60, approval: 50 } },
  { name: 'Old Orchard', seed: 44, blurb: 'A town stood here once. Six derelict buildings wait to be rebuilt at half price.', river: true, rocks: 3, terraces: 2, ruins: 6, goal: { residents: 70, approval: 55 } },
  { name: 'Condor Shelf', seed: 51, blurb: 'Rock on every side. Quarries and workshops will pay, if the burrows can bear the noise.', river: false, rocks: 6, terraces: 2, goal: { residents: 90, approval: 60 } },
  { name: 'Canyon Split', seed: 59, blurb: 'The river runs bank to bank. Nothing on the far side works until you bridge it.', river: true, split: true, rocks: 4, terraces: 2, ruins: 3, goal: { residents: 100, approval: 65 } },
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
type RequestDef = {
  key: string;
  advisor: Advisor;
  text: string;
  reward: number;
  /** A building the wish cannot be granted without; it is never asked for until that is unlocked. */
  needs?: BuildingId;
  /** Whether this valley could ever satisfy the wish: terraces to farm, rock to quarry. */
  viable?: (g: BurrowTown) => boolean;
  check: (g: BurrowTown) => [number, number];
};

/** Advisor wishes. Targets grow with the valley number so later valleys ask for more. */
export const REQUESTS: RequestDef[] = [
  { key: 'homes', advisor: 'dora', text: 'Build {n} burrows with a road to the plaza.', reward: 20, check: (g) => [g.count((t) => HOUSING.includes(t.b!) && t.linked && !t.ruin), 3 + g.level] },
  { key: 'bath-near', advisor: 'dora', text: 'Give {n} homes a dust bath within 3 tiles.', reward: 20, check: (g) => [g.count((t) => HOUSING.includes(t.b!) && !t.ruin && g.near(t, 'dustbath', 3)), 3 + g.level] },
  { key: 'gardens', advisor: 'dora', text: 'Plant {n} gardens.', reward: 20, needs: 'garden', check: (g) => [g.count((t) => t.b === 'garden' && !t.ruin), 2 + g.level] },
  { key: 'happy', advisor: 'dora', text: 'Reach {n} happiness.', reward: 20, needs: 'garden', check: (g) => [Math.floor(g.stats.happiness), 45 + g.level * 5] },
  { key: 'residents', advisor: 'dora', text: 'Welcome {n} residents.', reward: 20, check: (g) => [g.stats.residents, 12 + g.level * 12] },
  { key: 'bigburrow', advisor: 'dora', text: 'Build {n} big burrows.', reward: 20, needs: 'bigburrow', check: (g) => [g.count((t) => t.b === 'bigburrow' && !t.ruin), 1 + Math.floor(g.level / 2)] },
  { key: 'delight', advisor: 'dora', text: 'Make {n} homes perfectly comfortable, at comfort 4.', reward: 20, needs: 'plaza', check: (g) => [g.count((t) => HOUSING.includes(t.b!) && !t.ruin && t.comfort >= 4), 1 + Math.floor(g.level / 2)] },
  { key: 'quiet', advisor: 'dora', text: 'Keep {n} homes clear of quarry and workshop noise.', reward: 20, check: (g) => [g.count((t) => HOUSING.includes(t.b!) && !t.ruin && !g.near(t, 'quarry', 2) && !g.near(t, 'workshop', 2)), 3 + g.level] },
  { key: 'plaza-garden', advisor: 'dora', text: 'Plant a garden within 2 tiles of a plaza.', reward: 15, needs: 'garden', check: (g) => [g.count((t) => t.b === 'garden' && !t.ruin && g.near(t, 'plaza', 2)) ? 1 : 0, 1] },
  { key: 'quarry', advisor: 'enzo', text: 'Open a quarry and connect it by road.', reward: 20, viable: (g) => g.count((t) => t.t === 'rock') > 0, check: (g) => [g.count((t) => t.b === 'quarry' && t.linked && !t.ruin) ? 1 : 0, 1] },
  { key: 'farms', advisor: 'enzo', text: 'Run {n} connected hay farms.', reward: 20, check: (g) => [g.count((t) => t.b === 'hayfarm' && t.linked && !t.ruin), 3 + g.level] },
  { key: 'hay', advisor: 'enzo', text: 'Store {n} hay at once.', reward: 20, check: (g) => [Math.floor(g.hay), 200 + g.level * 60] },
  { key: 'stone', advisor: 'enzo', text: 'Store {n} stone.', reward: 20, check: (g) => [Math.floor(g.stone), 20 + g.level * 15] },
  { key: 'silos', advisor: 'enzo', text: 'Raise {n} silos so the granary stops spilling.', reward: 20, check: (g) => [g.count((t) => t.b === 'silo' && t.linked && !t.ruin), 1 + Math.floor(g.level / 3)] },
  { key: 'income', advisor: 'enzo', text: 'Earn {n} hay a tick.', reward: 20, check: (g) => [Math.floor(g.stats.income), 15 + g.level * 6] },
  { key: 'market', advisor: 'enzo', text: 'Build a market with {n} residents within 4 tiles.', reward: 20, needs: 'market', check: (g) => [Math.max(0, ...g.tiles.filter((t) => t.b === 'market' && !t.ruin).map((t) => g.residentsNear(t, 4))), 12 + g.level * 4] },
  { key: 'workshops', advisor: 'enzo', text: 'Build {n} workshops.', reward: 20, needs: 'workshop', check: (g) => [g.count((t) => t.b === 'workshop' && !t.ruin), 1 + Math.floor(g.level / 2)] },
  { key: 'roads', advisor: 'enzo', text: 'Lay {n} tiles of road.', reward: 15, check: (g) => [g.count((t) => t.road), 14 + g.level * 6] },
  { key: 'watchtower', advisor: 'enzo', text: 'Raise a watchtower.', reward: 20, needs: 'watchtower', check: (g) => [g.count((t) => t.b === 'watchtower' && !t.ruin) ? 1 : 0, 1] },
  { key: 'terrace-farm', advisor: 'enzo', text: 'Farm {n} terraces.', reward: 15, viable: (g) => g.count((t) => t.t === 'terrace') >= 2 + Math.floor(g.level / 2), check: (g) => [g.count((t) => t.b === 'hayfarm' && !t.ruin && t.t === 'terrace'), 2 + Math.floor(g.level / 2)] },
];
export const ACTIVE_REQUESTS = 3;
export const MAX_APPROVAL = 100;

/** One undoable action: the layout before it, and what it spent. */
type Step = { tiles: string; res: number[]; spentHay: number; spentStone: number };

export type Save = {
  v: 1 | 2;
  valley: number;
  hay: number;
  stone: number;
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
const BUILDING_CODE = 'ABCDEFGHIJK';

/** Lay out a valley's terrain from its seed. The plaza square in the middle is always clear grass. */
export function makeTerrain(v: Valley): Terrain[] {
  const rnd = mulberry(v.seed);
  const t: Terrain[] = Array.from({ length: W * H }, () => 'grass' as Terrain);
  const at = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const centre = { x: W >> 1, y: H >> 1 };
  const isCentre = (x: number, y: number) => Math.abs(x - centre.x) <= 2 && Math.abs(y - centre.y) <= 2;
  if (v.split) {
    // A canyon: the river runs bank to bank well clear of the plaza square, widening on odd rows
    // so some crossings cost two bridges. Nothing on the far side works until one is built.
    const col = Math.floor(W * 0.32);
    for (let y = 0; y < H; y++) {
      if (!isCentre(col, y)) t[at(col, y)] = 'river';
      if (y % 3 === 1 && !isCentre(col + 1, y)) t[at(col + 1, y)] = 'river';
    }
  } else if (v.river) {
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
  // Every valley needs stone: without a quarry there is nothing to build the big things with.
  if (!t.includes('rock')) for (let i = 0; i < 3; i++) t[at(1 + i, 1)] = 'rock';
  return t;
}

export class BurrowTown {
  tiles: Tile[] = [];
  hay = START_HAY;
  stone = 0;
  time = 0;
  acc = 0;
  paused = false;
  /** Clock multiplier; one of SPEEDS. */
  speed = 1;
  tool: Tool = 'road';
  approval: Record<Advisor, number> = { dora: 0, enzo: 0 };
  requests: Request[] = [];
  done: string[] = [];
  won = false;
  valley: Valley;
  /** Zero-based valley index, or -1 for the sandbox. */
  index: number;
  stats = { residents: 0, capacity: 0, income: 0, stoneIncome: 0, upkeep: 0, happiness: 0, roads: 0, homes: 0, ruins: 0 };
  /** One-shot notices for the page: 'place', 'road', 'demolish', 'deny', 'request', 'unlock:<id>', 'undo', 'full', 'dry', 'won'. */
  events: string[] = [];
  /** Short advisor lines, newest first. */
  log: { who: Advisor | 'town'; text: string; at: number }[] = [];
  private rnd: () => number;
  private history: Step[] = [];
  private stroke = false;
  private named = 0;
  private lastDay = 1;
  private spilling = false;

  constructor(index = 0) {
    this.index = index;
    this.valley = index < 0 ? SANDBOX : VALLEYS[Math.min(index, VALLEYS.length - 1)];
    this.rnd = mulberry(this.valley.seed * 7 + 3);
    const terrain = makeTerrain(this.valley);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) this.tiles.push({ x, y, t: terrain[y * W + x], b: null, road: false, ruin: false, res: 0, desire: 0, comfort: 0, linked: false, yield: 0, stoneYield: 0 });
    this.tile(W >> 1, H >> 1)!.b = 'plaza';
    this.scatterRuins();
    this.say('dora', `Welcome to ${this.valley.name}. Let's make it feel like home.`);
    this.say('enzo', 'Roads first. Nothing works until it touches the plaza.');
    this.recompute();
    this.refill();
  }

  /** Drop the valley's derelict buildings on open ground away from the plaza. */
  private scatterRuins() {
    const want = this.valley.ruins ?? 0;
    for (let i = 0, guard = 0; i < want && guard < 400; guard++) {
      const t = this.tiles[Math.floor(this.rnd() * this.tiles.length)];
      const far = Math.abs(t.x - (W >> 1)) + Math.abs(t.y - (H >> 1)) > 3;
      if (!t || t.b || t.road || !far || !['grass', 'terrace'].includes(t.t)) continue;
      t.b = RUIN_KINDS[Math.floor(this.rnd() * RUIN_KINDS.length)];
      t.ruin = true;
      i++;
    }
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
  /** Every third day the rain stays away and farms off the water grow half as much. */
  get dry() {
    return this.day % DRY_EVERY === 0;
  }
  /** Hay the town can hold: the granary plus every linked silo. */
  get granary() {
    return GRANARY + SILO_CAP * this.count((t) => t.b === 'silo' && t.linked && !t.ruin);
  }
  get goalMet() {
    return this.stats.residents >= this.valley.goal.residents && this.approval.dora >= this.valley.goal.approval && this.approval.enzo >= this.valley.goal.approval;
  }
  get canUndo() {
    return this.history.length > 0;
  }

  tile(x: number, y: number) {
    return x >= 0 && y >= 0 && x < W && y < H ? this.tiles[y * W + x] : null;
  }
  count(fn: (t: Tile) => boolean) {
    return this.tiles.reduce((n, t) => n + (fn(t) ? 1 : 0), 0);
  }
  /** Is a working building of this kind within `r` tiles (Manhattan) of the tile? */
  near(t: Tile, id: BuildingId, r: number) {
    return this.tiles.some((o) => o.b === id && !o.ruin && Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= r);
  }
  residentsNear(t: Tile, r: number) {
    return this.tiles.reduce((n, o) => n + (Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= r ? o.res : 0), 0);
  }
  /**
   * Desirability at a tile. Every amenity and nuisance reaches across its radius and fades with
   * distance, so where a burrow sits inside the range matters, not just that it is inside it.
   * Two of the same kind do not stack: only the closest one of each counts.
   */
  desireAt(x: number, y: number) {
    let sum = 0;
    for (const id of [...AMENITIES, ...NUISANCES]) {
      const b = BUILDINGS[id];
      let best = 0;
      for (const o of this.tiles) {
        if (o.b !== id || o.ruin) continue;
        const d = Math.abs(o.x - x) + Math.abs(o.y - y);
        if (d > b.radius) continue;
        best = Math.max(best, Math.abs(b.strength) * (1 - (FALLOFF * d) / (b.radius + 1)));
      }
      sum += b.strength < 0 ? -best : best;
    }
    return sum;
  }
  unlocked(id: BuildingId) {
    const b = BUILDINGS[id];
    return !b.advisor || this.approval[b.advisor] >= b.unlock;
  }
  /** Hay a tool costs on a tile. Rebuilding a ruin is half price. */
  cost(tool: Tool, x: number, y: number) {
    const t = this.tile(x, y);
    if (tool === 'demolish') return 0;
    if (tool === 'road') return t?.t === 'river' ? ROAD_COST * BRIDGE_MULTIPLIER : ROAD_COST;
    return t?.ruin && t.b === tool ? Math.ceil(BUILDINGS[tool].cost / 2) : BUILDINGS[tool].cost;
  }
  /** Stone a tool costs on a tile. */
  stoneCost(tool: Tool, x: number, y: number) {
    const t = this.tile(x, y);
    if (tool === 'demolish' || tool === 'road') return 0;
    return t?.ruin && t.b === tool ? Math.ceil(BUILDINGS[tool].stone / 2) : BUILDINGS[tool].stone;
  }
  /** Why the current tool cannot go on a tile, or '' when it can. */
  blocked(tool: Tool, x: number, y: number): string {
    const t = this.tile(x, y);
    if (!t) return 'Off the map.';
    if (tool === 'demolish') return t.b || t.road ? (t.b === 'plaza' && !t.ruin && this.count((o) => o.b === 'plaza' && !o.ruin) === 1 ? 'The last plaza stays.' : '') : 'Nothing here to clear.';
    if (t.ruin) {
      if (tool !== t.b) return `A ruined ${BUILDINGS[t.b!].title.toLowerCase()}. Pick that tool to rebuild it, or clear it.`;
      if (!this.unlocked(tool)) return `${BUILDINGS[tool].advisor === 'dora' ? 'Dora' : 'Enzo'} hasn't unlocked that yet.`;
    } else {
      if (t.b) return 'Already built on.';
      if (tool === 'road') {
        if (t.road) return 'Already a road.';
        if (t.t === 'rock') return 'Roads cannot cross rock.';
      } else {
        if (t.road) return 'Clear the road first.';
        if (!this.unlocked(tool)) return `${BUILDINGS[tool].advisor === 'dora' ? 'Dora' : 'Enzo'} hasn't unlocked that yet.`;
        if (!BUILDINGS[tool].on.includes(t.t)) return tool === 'quarry' ? 'Quarries need rock.' : t.t === 'river' ? 'Nothing builds on water.' : 'Rock is too hard to dig.';
      }
    }
    if (this.cost(tool, x, y) > this.hay) return 'Not enough hay.';
    if (this.stoneCost(tool, x, y) > this.stone) return `Not enough stone. A quarry on rock digs it.`;
    return '';
  }
  /** Apply the current tool to a tile. Returns the reason it failed, or '' on success. */
  apply(x: number, y: number, tool: Tool = this.tool): string {
    const why = this.blocked(tool, x, y);
    if (why) {
      this.events.push('deny');
      return why;
    }
    if (!this.stroke) this.snapshot();
    const step = this.history[this.history.length - 1];
    const t = this.tile(x, y)!;
    if (tool === 'demolish') {
      // A ruin is worth nothing; anything you paid for gives half back.
      const refund = t.ruin ? 0 : t.b ? Math.floor(BUILDINGS[t.b].cost / 2) : Math.floor(ROAD_COST / 2);
      const stoneBack = t.b && !t.ruin ? Math.floor(BUILDINGS[t.b].stone / 2) : 0;
      this.hay += refund;
      this.stone += stoneBack;
      if (step) {
        step.spentHay -= refund;
        step.spentStone -= stoneBack;
      }
      t.b = null;
      t.road = false;
      t.ruin = false;
      t.res = 0;
      this.events.push('demolish');
    } else {
      const hayCost = this.cost(tool, x, y);
      const stoneCost = this.stoneCost(tool, x, y);
      this.hay -= hayCost;
      this.stone -= stoneCost;
      if (step) {
        step.spentHay += hayCost;
        step.spentStone += stoneCost;
      }
      if (tool === 'road') t.road = true;
      else if (t.ruin) t.ruin = false;
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
  setSpeed(n: number) {
    this.speed = SPEEDS.includes(n as (typeof SPEEDS)[number]) ? n : 1;
  }

  /** Start a painted stroke: everything until endStroke undoes as one action. */
  beginStroke() {
    if (this.stroke) return;
    this.snapshot();
    this.stroke = true;
  }
  endStroke() {
    this.stroke = false;
    // A stroke that built nothing leaves a snapshot that would undo nothing.
    const last = this.history[this.history.length - 1];
    if (last && last.tiles === this.tileCodes() && !last.spentHay && !last.spentStone) this.history.pop();
  }
  private snapshot() {
    this.history.push({ tiles: this.tileCodes(), res: this.tiles.map((t) => t.res), spentHay: 0, spentStone: 0 });
    if (this.history.length > UNDO_STEPS) this.history.shift();
  }
  /**
   * Step back to before the last action. Only the tiles that action changed are put back, and only
   * what it spent is refunded: the clock keeps running, residents who moved in elsewhere stay, and
   * an advisor who was pleased in the meantime stays pleased.
   */
  undo() {
    const step = this.history.pop();
    if (!step) return false;
    for (let i = 0; i < this.tiles.length; i++) {
      const mark = step.tiles[i * 2 + 1] ?? '.';
      const road = mark === '=';
      const ruin = !road && mark !== '.' && mark === mark.toLowerCase();
      const b = !road && mark !== '.' ? BUILDING_ORDER[BUILDING_CODE.indexOf(mark.toUpperCase())] ?? null : null;
      const t = this.tiles[i];
      if (t.b === b && t.road === road && t.ruin === ruin) continue;
      t.b = b;
      t.road = road;
      t.ruin = ruin;
      t.res = step.res[i] ?? 0;
    }
    this.hay += step.spentHay;
    this.stone += step.spentStone;
    this.recompute();
    this.events.push('undo');
    return true;
  }

  /** Advance real time; runs a simulation tick every TICK seconds of town time. */
  step(dt: number) {
    if (this.paused || this.won) return;
    const scaled = dt * this.speed;
    this.time += scaled;
    this.acc += scaled;
    if (this.day !== this.lastDay) {
      this.lastDay = this.day;
      if (this.dry) {
        this.events.push('dry');
        this.say('enzo', 'Dry day. Farms off the water will only grow half as much.');
      }
    }
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
    for (const t of this.tiles) if (t.b === 'plaza' && !t.ruin) around(t).forEach(push);
    while (queue.length) around(queue.shift()!).forEach(push);
    for (const t of this.tiles) {
      t.linked = (t.b === 'plaza' && !t.ruin) || (!!t.b && around(t).some((o) => o && ((o.road && linkedRoad.has(o.y * W + o.x)) || (o.b === 'plaza' && !o.ruin)))) || (t.road && linkedRoad.has(t.y * W + t.x));
      t.desire = t.b || t.road || t.t !== 'river' ? this.desireAt(t.x, t.y) : 0;
      if (t.b && HOUSING.includes(t.b) && !t.ruin) {
        t.comfort = Math.max(0, Math.min(4, Math.round(t.desire)));
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
    s.ruins = 0;
    let comfortSum = 0;
    let occupied = 0;
    for (const t of this.tiles) {
      if (t.road) s.roads++;
      if (t.ruin) s.ruins++;
      if (t.b && HOUSING.includes(t.b) && !t.ruin) {
        s.homes++;
        s.residents += t.res;
        s.capacity += BUILDINGS[t.b].houses;
        if (t.res > 0) {
          comfortSum += t.comfort;
          occupied++;
        }
      }
    }
    // Comfort 4 is the top of the scale, so a town of perfect homes reads 100.
    s.happiness = occupied ? Math.min(100, (comfortSum / occupied / 4) * 100) : 0;
    s.income = this.tiles.reduce((n, t) => n + this.yieldOf(t), 0);
    s.stoneIncome = this.tiles.reduce((n, t) => n + this.stoneOf(t), 0);
    s.upkeep = s.residents * HAY_PER_RESIDENT;
  }

  /** Hay a building would earn this tick. */
  yieldOf(t: Tile) {
    if (!t.b || !t.linked || t.ruin) return 0;
    switch (t.b) {
      case 'hayfarm': {
        const river = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.tile(t.x + dx, t.y + dy)?.t === 'river');
        const base = (t.t === 'terrace' ? 4 : 3) + (river ? 1 : 0);
        return this.dry && !river ? Math.ceil(base / 2) : base;
      }
      case 'workshop':
        return this.workshopFed(t) ? 4 : 1;
      case 'market':
        return Math.min(8, Math.floor(this.residentsNear(t, 4) / 3));
      case 'burrow':
      case 'bigburrow':
        // A perfectly comfortable home keeps a little something aside for the town.
        return t.comfort >= 4 ? t.res * DELIGHT : 0;
      default:
        return 0;
    }
  }
  /** Stone a building would dig this tick. */
  stoneOf(t: Tile) {
    return t.b === 'quarry' && t.linked && !t.ruin ? 2 : 0;
  }
  /** A workshop only runs on stone carried from a quarry it can actually reach. */
  workshopFed(t: Tile) {
    return this.stone >= WORKSHOP_STONE && this.tiles.some((o) => o.b === 'quarry' && o.linked && !o.ruin && Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= WORKSHOP_RANGE);
  }

  tick() {
    const starving = this.hay <= 0 && this.stats.income < this.stats.upkeep;
    for (const t of this.tiles) {
      t.stoneYield = this.stoneOf(t);
      this.stone += t.stoneYield;
    }
    const stored = this.hay;
    let earned = 0;
    for (const t of this.tiles) {
      t.yield = this.yieldOf(t);
      earned += t.yield;
      if (t.b === 'workshop' && !t.ruin && t.linked && this.workshopFed(t)) this.stone = Math.max(0, this.stone - WORKSHOP_STONE);
      if (t.b && HOUSING.includes(t.b) && !t.ruin) {
        const target = t.linked ? Math.round(BUILDINGS[t.b].houses * OCCUPANCY[t.comfort] * (starving ? 0.5 : 1)) : 0;
        const before = t.res;
        // A perfect home fills twice as fast; word gets around.
        const step = t.res < target ? (t.comfort >= 4 ? 2 : 1) : 2;
        t.res += Math.sign(target - t.res) * Math.min(Math.abs(target - t.res), step);
        if (before === 0 && t.res > 0) this.welcome(t);
      }
    }
    // The granary only limits what the farms bring in: rewards and refunds always fit.
    this.hay += earned;
    const spilled = this.hay > this.granary;
    if (spilled) this.hay = Math.max(this.granary, stored);
    this.measure();
    this.hay = Math.max(0, this.hay - this.stats.upkeep);
    if (spilled) {
      if (!this.spilling) {
        this.spilling = true;
        this.events.push('full');
        this.say('enzo', `The granary is full at ${this.granary}. Build a silo or spend it, the rest is spilling.`);
      }
    } else if (this.hay < this.granary * 0.9) this.spilling = false;
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

  /** Name the first chinchilla into a new home and say where they went. */
  private welcome(t: Tile) {
    const name = NAMES[this.named++ % NAMES.length];
    this.say('town', `${name} moved into the ${BUILDINGS[t.b!].title.toLowerCase()} ${this.place(t)}.`);
  }
  /** A short description of where a tile is, for the town log. */
  private place(t: Tile) {
    if (this.near(t, 'plaza', 2)) return 'by the plaza';
    if (this.tiles.some((o) => o.t === 'river' && Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= 2)) return 'by the water';
    if (this.tiles.some((o) => o.t === 'rock' && Math.abs(o.x - t.x) + Math.abs(o.y - t.y) <= 2)) return 'under the rocks';
    if (t.t === 'terrace') return 'up on the terraces';
    return t.y < H / 2 ? 'on the north side' : 'on the south side';
  }

  /** Why a building is not doing what its owner hoped, in one line. */
  advice(t: Tile): string {
    if (!t.b) return '';
    const b = BUILDINGS[t.b];
    if (t.ruin) return `Derelict. Rebuild it for ${this.cost(t.b, t.x, t.y)} hay${b.stone ? ` and ${this.stoneCost(t.b, t.x, t.y)} stone` : ''}, or clear it away.`;
    if (t.b !== 'plaza' && !t.linked) return 'No road back to a plaza, so nobody comes and it earns nothing.';
    if (HOUSING.includes(t.b)) {
      if (t.res === 0 && this.hay <= 0) return 'Nobody will move in while the hay is gone.';
      if (t.comfort >= 4) return 'Perfectly comfortable. It fills fast and the residents chip in a little hay.';
      const noisy = NUISANCES.filter((id) => this.near(t, id, BUILDINGS[id].radius)).map((id) => BUILDINGS[id].title.toLowerCase());
      const missing = AMENITIES.filter((id) => !this.near(t, id, BUILDINGS[id].radius)).map((id) => BUILDINGS[id].title.toLowerCase());
      const full = Math.round(OCCUPANCY[t.comfort] * 100);
      return `Comfort ${t.comfort}/4, so it fills to ${full}%.` + (noisy.length ? ` A ${noisy[0]} nearby is spoiling it.` : '') + (missing.length ? ` No ${missing.slice(0, 2).join(' or ')} in range.` : ' Move an amenity closer for the last point.');
    }
    if (t.b === 'workshop' && !this.workshopFed(t)) return `Idle: it needs stone and a linked quarry within ${WORKSHOP_RANGE} tiles. Earning 1 hay a tick instead of 4.`;
    if (t.b === 'hayfarm' && this.dry) return 'A dry day. Farms off the water grow half as much.';
    if (t.b === 'market' && this.yieldOf(t) === 0) return 'No residents within 4 tiles yet, so there is nobody to sell to.';
    if (t.b === 'silo') return `Holding ${SILO_CAP} extra hay. The granary is at ${this.granary}.`;
    return b.blurb;
  }

  /** Keep three wishes open, alternating advisors so neither is ignored. */
  private refill() {
    let guard = 0;
    while (this.requests.length < ACTIVE_REQUESTS && guard++ < 40) {
      const counts = { dora: 0, enzo: 0 };
      for (const r of this.requests) counts[r.advisor]++;
      const prefer: Advisor = counts.dora <= counts.enzo ? 'dora' : 'enzo';
      // Never ask for something the advisor has not unlocked yet, and never ask for something this
      // valley cannot give. Either wish could never be granted, and it would sit in its slot
      // forever, blocking the approval the valley is finished on.
      const pool = REQUESTS.filter((d) => !this.done.includes(d.key) && !this.requests.some((r) => r.key === d.key) && (!d.needs || this.unlocked(d.needs)) && (!d.viable || d.viable(this)));
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

  /** Two characters per tile: its terrain, then what stands on it (lowercase when derelict). */
  private tileCodes() {
    return this.tiles
      .map((t) => {
        const code = t.road ? '=' : t.b ? BUILDING_CODE[BUILDING_ORDER.indexOf(t.b)] : '.';
        return TERRAIN_CODE[t.t] + (t.ruin && t.b ? code.toLowerCase() : code);
      })
      .join('');
  }
  save(): Save {
    return {
      v: 2,
      valley: this.index,
      hay: this.hay,
      stone: this.stone,
      time: this.time,
      approval: { ...this.approval },
      done: [...this.done],
      active: this.requests.map((r) => r.key),
      tiles: this.tileCodes(),
      res: this.tiles.map((t) => t.res),
      won: this.won,
    };
  }
  /** Put a saved town back into this instance, keeping the clock where it is. */
  restore(s: Save) {
    this.hay = s.hay;
    this.stone = s.stone ?? 0;
    this.approval = { ...s.approval };
    this.done = [...s.done];
    this.won = s.won;
    for (let i = 0; i < this.tiles.length; i++) {
      const code = s.tiles.slice(i * 2, i * 2 + 2);
      const t = this.tiles[i];
      const mark = code[1] ?? '.';
      t.t = CODE_TERRAIN[code[0]] ?? t.t;
      t.road = mark === '=';
      t.ruin = mark !== '.' && mark !== '=' && mark === mark.toLowerCase();
      t.b = mark !== '.' && mark !== '=' ? BUILDING_ORDER[BUILDING_CODE.indexOf(mark.toUpperCase())] ?? null : null;
      t.res = s.res[i] ?? 0;
    }
    this.recompute();
    this.requests = [];
    for (const key of s.active) {
      const def = REQUESTS.find((d) => d.key === key);
      if (def) {
        const progress = def.check(this);
        this.requests.push({ key, advisor: def.advisor, text: def.text.replace('{n}', String(progress[1])), reward: def.reward, progress, done: false });
      }
    }
    this.refill();
  }
  static load(s: Save): BurrowTown {
    const g = new BurrowTown(s.valley);
    g.time = s.time;
    g.lastDay = g.day;
    g.restore(s);
    g.history = [];
    g.log = [];
    g.say('town', `Back in ${g.valley.name}. Day ${g.day}.`);
    return g;
  }
}

const PRAISE_DORA = ['Oh, that is lovely. The little ones will adore it.', 'See? A soft town is a strong town.', 'I could nap right here. Thank you.', 'Everyone looks so fluffy and calm now.'];
const PRAISE_ENZO = ['Now that is a working town. Nice.', 'Hay in the barn and roads that go somewhere. Good.', 'Efficient. I approve, quietly.', 'Keep this up and we can afford anything.'];

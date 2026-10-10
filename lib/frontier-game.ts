// Frostpaw Frontier: a tile-by-tile survival builder in the style of Tiles Survive. Winter is coming to the Andes and
// Dora and Enzo lead a band of chinchillas out of the burrow to light the old Summit Beacon and call the herd home.
// The mountain is hidden under snow cloud: spend stamina to uncover the tiles next to the land you hold, put survivors
// to work in farms, lodges and quarries, power them with glow lanterns, recruit heroes from ruins, clear predator
// dens, and hold the burrow against a raid every night. Deterministic: everything random comes from the seed.

export const W = 13, H = 13, HOME = { x: 6, y: 6 };
/** Seconds of daylight, then of night, in one day. */
export const DAY = 50, NIGHT = 16, CYCLE = DAY + NIGHT;
/** The raid reaches the burrow this many seconds after nightfall. */
export const RAID_AT = 8;
export const STAMINA_MAX = 10, STAMINA_EVERY = 5, START_SURVIVORS = 4;
/** Hay each survivor eats a second, and how long the burrow can go hungry before someone leaves. */
export const EAT = 0.07, STARVE = 20;
/** Hay the burrow must have at dawn for a traveller to settle. */
export const ARRIVAL_HAY = 30;
export const ATTACK_COST = 2, HURT_TIME = 30, HQ_MAX = 4, HERO_MAX = 5;
export const SAVE_VERSION = 1;

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(next, { state: () => a, set: (s: number) => { a = s >>> 0; } });
}
type Rng = ReturnType<typeof rng>;

// ---------- Resources ----------

export type ResId = 'hay' | 'wood' | 'stone';
export type Res = Record<ResId, number>;
export const RES_IDS: ResId[] = ['hay', 'wood', 'stone'];
const res = (hay = 0, wood = 0, stone = 0): Res => ({ hay, wood, stone });

// ---------- The land ----------

export type Terrain = 'meadow' | 'grove' | 'rocks' | 'snow' | 'crag';
export type Feature = 'home' | 'cache' | 'stray' | 'ruin' | 'den' | 'lair' | 'rumour' | 'beacon';
export type DenKind = 'weasel' | 'fox' | 'owl' | 'badger' | 'cougar';
export const DENS: Record<DenKind, { name: string; power: number; loot: Res; raid: number }> = {
  weasel: { name: 'Weasel Hole', power: 12, loot: res(20, 20, 0), raid: 1 },
  fox: { name: 'Fox Den', power: 24, loot: res(30, 30, 15), raid: 2 },
  owl: { name: 'Owl Roost', power: 36, loot: res(30, 40, 30), raid: 2 },
  badger: { name: 'Badger Sett', power: 52, loot: res(40, 50, 45), raid: 3 },
  cougar: { name: 'Cougar Lair', power: 80, loot: res(0, 0, 0), raid: 3 },
};
export type Tile = {
  t: Terrain; f: Feature | null; seen: boolean;
  den?: DenKind; hero?: HeroId; cache?: Res; event?: EventId;
};

// ---------- Buildings ----------

export type BuildingId = 'farm' | 'lodge' | 'quarry' | 'nest' | 'lantern' | 'tower' | 'beacon';
export type BuildingDef = {
  id: BuildingId; name: string; cost: Res; on: Terrain[]; hq: number; workers: number;
  make?: ResId; rate?: number; housing?: number; defence?: number; blurb: string;
};
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  farm: { id: 'farm', name: 'Hay Farm', cost: res(0, 20, 0), on: ['meadow'], hq: 1, workers: 2, make: 'hay', rate: 0.5,
    blurb: 'Two survivors cut and dry hay. Everyone eats it.' },
  lodge: { id: 'lodge', name: 'Twig Lodge', cost: res(10, 10, 0), on: ['grove'], hq: 1, workers: 2, make: 'wood', rate: 0.5,
    blurb: 'Gathers twigs and bark from a grove. Build it on trees.' },
  nest: { id: 'nest', name: 'Snug Nest', cost: res(0, 25, 0), on: ['meadow'], hq: 1, workers: 0, housing: 3,
    blurb: 'Room for three more chinchillas. Lost ones wait in the snow until there is space.' },
  quarry: { id: 'quarry', name: 'Pebble Quarry', cost: res(10, 30, 0), on: ['rocks'], hq: 2, workers: 2, make: 'stone', rate: 0.35,
    blurb: 'Chips stone from a rocky tile. Build it on rocks.' },
  lantern: { id: 'lantern', name: 'Glow Lantern', cost: res(0, 40, 20), on: ['meadow', 'rocks'], hq: 2, workers: 0,
    blurb: 'Burns wood to light every tile within two. Lit farms, lodges and quarries work half as fast again.' },
  tower: { id: 'tower', name: 'Watchtower', cost: res(0, 30, 30), on: ['meadow', 'rocks', 'snow'], hq: 2, workers: 1, defence: 15,
    blurb: 'A lookout keeps the night raids off. Needs one survivor on watch.' },
  beacon: { id: 'beacon', name: 'Summit Beacon', cost: res(100, 200, 150), on: ['meadow', 'rocks', 'snow'], hq: 4, workers: 0,
    blurb: 'Light it on the summit, where the cougar was, and the herd comes home.' },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
/** Wood a lit lantern burns each second. */
export const LANTERN_BURN = 0.08, LANTERN_BOOST = 1.5, LANTERN_REACH = 2;
export type Building = { id: number; kind: BuildingId; x: number; y: number; workers: number; damaged: boolean };

/** Costs to raise the burrow to level 2, 3 and 4. */
export const HQ_COST: Res[] = [res(), res(40, 60, 0), res(60, 140, 60), res(120, 220, 140)];
export const hqHousing = (level: number) => START_SURVIVORS + 2 * (level - 1);
export const hqMaxHp = (level: number) => 60 + 40 * (level - 1);

// ---------- Heroes ----------

export type HeroId = 'dora' | 'enzo' | 'pebble' | 'kiki' | 'luna';
export const HEROES: Record<HeroId, { name: string; power: number; perk: string; blurb: string }> = {
  dora: { name: 'Dora', power: 10, perk: 'Snow costs her 1 stamina to cross, not 2.', blurb: 'Sharp eyes and quick paws. The first to see what is under the cloud.' },
  enzo: { name: 'Enzo', power: 14, perk: 'Adds 8 to the burrow’s defence at night.', blurb: 'Big, grey and brave. Stands in the doorway when the raids come.' },
  pebble: { name: 'Grandpa Pebble', power: 8, perk: 'Adds 12 to the burrow’s defence at night.', blurb: 'Found dozing in an old ruin. Nothing gets past him.' },
  kiki: { name: 'Kiki', power: 6, perk: 'Hay farms make 30% more.', blurb: 'A kit with a green paw. Hay grows wherever she hops.' },
  luna: { name: 'Luna', power: 12, perk: 'Glow lanterns light one tile further.', blurb: 'A violet chinchilla who knows the old lantern songs.' },
};
export const HERO_IDS = Object.keys(HEROES) as HeroId[];
export type Hero = { id: HeroId; level: number; hurt: number };
export const heroPower = (h: Hero) => Math.round(HEROES[h.id].power * (1 + 0.4 * (h.level - 1)));
export const trainCost = (h: Hero): Res => res(10 * h.level, 30 * h.level, 20 * h.level);

// ---------- Rumours ----------

export type EventId = 'kit' | 'sled' | 'storm' | 'owl' | 'herd' | 'spring';
export type Choice = { label: string; cost?: Partial<Res & { stamina: number }> };
export const EVENTS: Record<EventId, { title: string; text: string; choices: [Choice, Choice] }> = {
  kit: { title: 'A cry in the snow', text: 'A lost kit is shivering under a fern, and something with yellow eyes is watching from the dark.',
    choices: [{ label: 'Bring the kit home (+1 chinchilla, tonight’s raid is 6 stronger)' }, { label: 'Leave hay and follow its tracks (−10 hay, uncover 3 tiles)', cost: { hay: 10 } }] },
  sled: { title: 'A buried sled', text: 'An old trader’s sled sticks out of a drift, still loaded with bundles of firewood.',
    choices: [{ label: 'Dig it all out (−3 stamina, +60 wood)', cost: { stamina: 3 } }, { label: 'Take what’s on top (+20 wood)' }] },
  storm: { title: 'Clouds over the peaks', text: 'A storm is rolling down the mountain. Raiders love a storm.',
    choices: [{ label: 'Shore up the burrow (−30 wood, tonight’s raid is 10 weaker)', cost: { wood: 30 } }, { label: 'Keep working (tonight’s raid is 5 stronger)' }] },
  owl: { title: 'An old owl', text: 'A grey owl lands on a stump. “I have stone,” it hoots, “and I am hungry.”',
    choices: [{ label: 'Trade 40 hay for 35 stone', cost: { hay: 40 } }, { label: 'Shoo it away' }] },
  herd: { title: 'Fresh pawprints', text: 'The tracks of a small herd of chinchillas lead off into the cloud.',
    choices: [{ label: 'Follow them (−4 stamina, +2 chinchillas)', cost: { stamina: 4 } }, { label: 'Mark the trail (uncover 3 tiles)' }] },
  spring: { title: 'A warm spring', text: 'Steam rises from a hot spring under the snow.',
    choices: [{ label: 'Rest the heroes (all heroes healed, +3 stamina)' }, { label: 'Fill the flasks (+25 hay)' }] },
};
export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

// ---------- Maps ----------

export type MapDef = {
  name: string; blurb: string; p: { grove: number; rocks: number; snow: number; crag: number };
  dens: DenKind[]; heroes: HeroId[]; raidBase: number; raidGrow: number; par: number;
};
export const MAPS: MapDef[] = [
  { name: 'Clover Valley', blurb: 'Green slopes and gentle weasels. A good place to learn the frontier.',
    p: { grove: 0.2, rocks: 0.13, snow: 0.06, crag: 0.05 }, dens: ['weasel', 'weasel', 'fox', 'fox', 'owl'], heroes: ['pebble', 'kiki', 'luna'],
    raidBase: 5, raidGrow: 3.2, par: 15 },
  { name: 'Salt Flats', blurb: 'Rocky and dry, with few trees. Owls hunt the flats at night.',
    p: { grove: 0.13, rocks: 0.2, snow: 0.05, crag: 0.07 }, dens: ['weasel', 'fox', 'owl', 'owl', 'badger'], heroes: ['kiki', 'pebble', 'luna'],
    raidBase: 7, raidGrow: 3.9, par: 16 },
  { name: 'Frost Summit', blurb: 'Deep snow everywhere and badgers in the hills. The real winter.',
    p: { grove: 0.17, rocks: 0.15, snow: 0.2, crag: 0.07 }, dens: ['fox', 'fox', 'owl', 'badger', 'badger'], heroes: ['luna', 'pebble', 'kiki'],
    raidBase: 9, raidGrow: 4.6, par: 18 },
];

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

/** Lays out one map: terrain, the burrow, the cougar's summit, dens, ruins, caches, strays and rumours. */
export function makeMap(m: number, seed: number): { tiles: Tile[]; summit: { x: number; y: number } } {
  const M = MAPS[m];
  for (let attempt = 0; ; attempt++) {
    const r = rng(seed * 7919 + m * 104729 + attempt * 31);
    const tiles: Tile[] = [];
    for (let i = 0; i < W * H; i++) {
      const v = r();
      let t: Terrain = 'meadow', acc = 0;
      for (const k of ['grove', 'rocks', 'snow', 'crag'] as const) { acc += M.p[k]; if (v < acc) { t = k; break; } }
      tiles.push({ t, f: null, seen: false });
    }
    const at = (x: number, y: number) => tiles[y * W + x];
    // Home: the burrow on a meadow with a grove, a rock and room to build in the first ring.
    const ring: Terrain[] = ['meadow', 'grove', 'meadow', 'meadow', 'rocks', 'meadow', 'grove', 'meadow'];
    for (let i = ring.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ring[i], ring[j]] = [ring[j], ring[i]]; }
    let k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const tile = at(HOME.x + dx, HOME.y + dy);
      tile.seen = true;
      if (dx || dy) tile.t = ring[k++]; else { tile.t = 'meadow'; tile.f = 'home'; }
    }
    // The summit: a corner far from home.
    const corners = [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]];
    const [sx, sy] = corners[Math.floor(r() * 4)];
    const summit = { x: sx, y: sy };
    at(sx, sy).t = 'snow'; at(sx, sy).f = 'lair'; at(sx, sy).den = 'cougar';
    const free = (d0: number, d1: number) => {
      const out: { x: number; y: number }[] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = dist({ x, y }, HOME), tile = at(x, y);
        if (d >= d0 && d <= d1 && !tile.f && tile.t !== 'crag' && dist({ x, y }, summit) > 1) out.push({ x, y });
      }
      return out;
    };
    const place = (d0: number, d1: number, fill: (t: Tile) => void) => {
      const opts = free(d0, d1);
      if (!opts.length) return false;
      const p = opts[Math.floor(r() * opts.length)];
      fill(at(p.x, p.y));
      return true;
    };
    let ok = true;
    // Dens sorted weakest first, the weak ones nearer home.
    const dens = [...M.dens].sort((a, b) => DENS[a].power - DENS[b].power);
    dens.forEach((d, i) => { ok &&= place(2 + Math.floor(i / 2), 3 + i, (t) => { t.f = 'den'; t.den = d; if (t.t === 'crag') t.t = 'meadow'; }); });
    M.heroes.forEach((h, i) => { ok &&= place(2 + i, 3 + i * 1.5, (t) => { t.f = 'ruin'; t.hero = h; t.t = 'meadow'; }); });
    const caches = [res(25, 0, 0), res(0, 30, 0), res(0, 0, 20), res(20, 20, 0), res(0, 25, 15), res(30, 0, 10)];
    for (const c of caches) ok &&= place(2, 6, (t) => { t.f = 'cache'; t.cache = c; });
    for (let i = 0; i < 5; i++) ok &&= place(2, 6, (t) => { t.f = 'stray'; if (t.t === 'snow') t.t = 'meadow'; });
    const deck = [...EVENT_IDS];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    for (const e of deck.slice(0, 5)) ok &&= place(2, 6, (t) => { t.f = 'rumour'; t.event = e; });
    // At least two rocky tiles and two groves within reach of home, or the early game stalls.
    const near = (t: Terrain) => tiles.filter((tile, i) => tile.t === t && !tile.f && dist({ x: i % W, y: Math.floor(i / W) }, HOME) <= 3).length;
    if (near('rocks') < 3 || near('grove') < 3) ok = false;
    // The summit must be reachable round the crags.
    if (ok) {
      const seen = new Set([HOME.y * W + HOME.x]), q = [HOME];
      while (q.length) {
        const p = q.shift()!;
        for (const [dx, dy] of N4) {
          const x = p.x + dx, y = p.y + dy, i = y * W + x;
          if (inside(x, y) && !seen.has(i) && tiles[i].t !== 'crag') { seen.add(i); q.push({ x, y }); }
        }
      }
      if (!seen.has(sy * W + sx)) ok = false;
    }
    if (ok || attempt > 200) return { tiles, summit };
  }
}

// ---------- The game ----------

export type State = 'playing' | 'paused' | 'event' | 'won' | 'lost';
export type GameEvent = {
  type: 'reveal' | 'cache' | 'join' | 'hero' | 'build' | 'upgrade' | 'train' | 'win-fight' | 'lose-fight' | 'night' | 'dawn'
    | 'raid-held' | 'raid-hit' | 'leave' | 'rumour' | 'won' | 'lost' | 'damaged' | 'repair';
  x?: number; y?: number; text?: string; value?: number;
};
export type Raid = { strength: number; defence: number; from: { x: number; y: number; kind: DenKind }[]; done: boolean; held?: boolean; loss?: Res & { hp: number } };
export type Refusal = 'ok' | 'fog' | 'far' | 'stamina' | 'state' | 'terrain' | 'taken' | 'hq' | 'cost' | 'den' | 'squad' | 'weak' | 'max' | 'none';

export class Game {
  map: number;
  seed: number;
  def: MapDef;
  tiles: Tile[];
  summit: { x: number; y: number };
  state: State = 'playing';
  time = 0;
  stock: Res = res(60, 40, 0);
  stamina = 6;
  survivors = START_SURVIVORS;
  hunger = 0;
  hqLevel = 1;
  hqHp = hqMaxHp(1);
  heroes: Hero[] = [{ id: 'dora', level: 1, hurt: 0 }, { id: 'enzo', level: 1, hurt: 0 }];
  buildings: Building[] = [];
  /** Extra strength for tonight's raid from rumours, reset at dawn. */
  tonight = 0;
  raid: Raid | null = null;
  pending: { event: EventId; x: number; y: number } | null = null;
  events: GameEvent[] = [];
  explored = 0;
  denCleared = 0;
  raidsHeld = 0;
  private nextId = 1;
  private staminaClock = 0;
  private random: Rng;
  private resumeTo: State = 'playing';

  constructor(map = 0, seed = 1) {
    this.map = Math.max(0, Math.min(MAPS.length - 1, map));
    this.seed = seed;
    this.def = MAPS[this.map];
    const made = makeMap(this.map, seed);
    this.tiles = made.tiles;
    this.summit = made.summit;
    this.random = rng(seed * 31 + this.map * 7 + 3);
    // The band arrives with a hay farm and a twig lodge already up and staffed by the burrow door.
    for (const kind of ['farm', 'lodge'] as const) {
      const on = BUILDINGS[kind].on[0];
      for (let dy = -1, done = false; dy <= 1 && !done; dy++) for (let dx = -1; dx <= 1 && !done; dx++) {
        const x = HOME.x + dx, y = HOME.y + dy, t = this.tile(x, y)!;
        if (t.t === on && !t.f && !this.buildingAt(x, y)) { this.buildings.push({ id: this.nextId++, kind, x, y, workers: 0, damaged: false }); done = true; }
      }
    }
    this.fill();
  }

  // ---------- Reading the state ----------

  tile(x: number, y: number) { return inside(x, y) ? this.tiles[y * W + x] : null; }
  buildingAt(x: number, y: number) { return this.buildings.find((b) => b.x === x && b.y === y) ?? null; }
  get day() { return Math.floor(this.time / CYCLE) + 1; }
  get night() { return this.time % CYCLE >= DAY; }
  /** Seconds until the next nightfall (in the day) or dawn (at night). */
  get clock() { const t = this.time % CYCLE; return t < DAY ? DAY - t : CYCLE - t; }
  get housing() { return hqHousing(this.hqLevel) + this.buildings.filter((b) => b.kind === 'nest').length * BUILDINGS.nest.housing!; }
  get workers() { return this.buildings.reduce((s, b) => s + b.workers, 0); }
  get idle() { return this.survivors - this.workers; }
  hero(id: HeroId) { return this.heroes.find((h) => h.id === id) ?? null; }
  /** Heroes fit to fight: not hurt. */
  get squad() { return this.heroes.filter((h) => h.hurt <= 0); }
  get squadPower() { return this.squad.reduce((s, h) => s + heroPower(h), 0); }
  /** Snow takes 2 stamina to cross, or 1 while Dora is fit to lead the way. */
  staminaCost(x: number, y: number) { return this.tile(x, y)?.t === 'snow' && !(this.hero('dora')?.hurt ?? 1) ? 1 : this.tile(x, y)?.t === 'snow' ? 2 : 1; }
  reach() { return LANTERN_REACH + (this.hero('luna') ? 1 : 0); }
  /** Whether a lit lantern reaches this tile. */
  lit(x: number, y: number) {
    if (this.stock.wood <= 0) return false;
    return this.buildings.some((b) => b.kind === 'lantern' && !b.damaged && dist(b, { x, y }) <= this.reach());
  }
  /** A tile you hold: seen, and not a crag or an uncleared den. Exploring spreads from these. */
  held(x: number, y: number) { const t = this.tile(x, y); return !!t && t.seen && t.t !== 'crag' && t.f !== 'den' && t.f !== 'lair'; }

  canExplore(x: number, y: number): Refusal {
    const t = this.tile(x, y);
    if (!t) return 'fog';
    if (this.state !== 'playing') return 'state';
    if (t.seen) return 'taken';
    if (!N4.some(([dx, dy]) => this.held(x + dx, y + dy))) return 'far';
    if (this.stamina < this.staminaCost(x, y)) return 'stamina';
    return 'ok';
  }
  canBuild(kind: BuildingId, x: number, y: number): Refusal {
    const t = this.tile(x, y), d = BUILDINGS[kind];
    if (!t || !t.seen) return 'fog';
    if (this.state !== 'playing') return 'state';
    if (this.buildingAt(x, y)) return 'taken';
    // The beacon goes only on the summit, once the cougar is gone; nothing else goes on a tile with something on it.
    if (kind === 'beacon' ? t.f !== 'beacon' : !!t.f) return kind === 'beacon' || t.f === 'beacon' ? 'terrain' : 'taken';
    if (!d.on.includes(t.t)) return 'terrain';
    if (this.hqLevel < d.hq) return 'hq';
    if (!this.afford(d.cost)) return 'cost';
    return 'ok';
  }
  canAttack(x: number, y: number): Refusal {
    const t = this.tile(x, y);
    if (!t || !t.seen) return 'fog';
    if (this.state !== 'playing') return 'state';
    if (!t.den || (t.f !== 'den' && t.f !== 'lair')) return 'none';
    if (this.stamina < ATTACK_COST) return 'stamina';
    if (!this.squad.length) return 'squad';
    return 'ok';
  }
  canUpgrade(): Refusal {
    if (this.state !== 'playing') return 'state';
    if (this.hqLevel >= HQ_MAX) return 'max';
    return this.afford(HQ_COST[this.hqLevel]) ? 'ok' : 'cost';
  }
  canTrain(id: HeroId): Refusal {
    const h = this.hero(id);
    if (!h) return 'none';
    if (this.state !== 'playing') return 'state';
    if (h.level >= HERO_MAX) return 'max';
    if (h.level >= this.hqLevel + 1) return 'hq';
    return this.afford(trainCost(h)) ? 'ok' : 'cost';
  }
  afford(c: Partial<Res>) { return RES_IDS.every((k) => this.stock[k] >= (c[k] ?? 0)); }
  private pay(c: Partial<Res>) { for (const k of RES_IDS) this.stock[k] -= c[k] ?? 0; }
  private gain(c: Partial<Res>) { for (const k of RES_IDS) this.stock[k] += c[k] ?? 0; }

  /** What a building makes each second as things stand. */
  output(b: Building) {
    const d = BUILDINGS[b.kind];
    if (!d.make || b.damaged || !d.workers) return 0;
    let r = d.rate! * (b.workers / d.workers);
    if (this.lit(b.x, b.y)) r *= LANTERN_BOOST;
    if (d.make === 'hay' && this.hero('kiki')) r *= 1.3;
    return r;
  }
  /** Net change a second of each resource: production less eating and lantern fuel. */
  income(): Res {
    const out = res();
    for (const b of this.buildings) { const d = BUILDINGS[b.kind]; if (d.make) out[d.make] += this.output(b); }
    out.hay -= this.survivors * EAT;
    if (this.stock.wood > 0) out.wood -= this.buildings.filter((b) => b.kind === 'lantern' && !b.damaged).length * LANTERN_BURN;
    return out;
  }
  defence() {
    let d = 8 * this.hqLevel;
    for (const b of this.buildings) if (b.kind === 'tower' && !b.damaged && b.workers > 0) d += BUILDINGS.tower.defence!;
    for (const h of this.squad) { d += heroPower(h) * 0.5; if (h.id === 'enzo') d += 8; if (h.id === 'pebble') d += 12; }
    return Math.round(d);
  }
  /** How strong tonight's raid will be. */
  raidStrength(day = this.day) {
    const dens = this.tiles.filter((t) => t.f === 'den' || t.f === 'lair').reduce((s, t) => s + DENS[t.den!].raid, 0);
    return Math.round(this.def.raidBase + this.def.raidGrow * Math.pow(day - 1, 1.3) + dens + this.tonight);
  }

  // ---------- Acting ----------

  explore(x: number, y: number): Refusal {
    const ok = this.canExplore(x, y);
    if (ok !== 'ok') return ok;
    this.stamina -= this.staminaCost(x, y);
    this.uncover(x, y);
    return 'ok';
  }
  private uncover(x: number, y: number) {
    const t = this.tile(x, y)!;
    if (t.seen) return;
    t.seen = true;
    this.explored++;
    this.events.push({ type: 'reveal', x, y });
    if (t.f === 'cache') {
      this.gain(t.cache!);
      this.events.push({ type: 'cache', x, y, text: RES_IDS.filter((k) => t.cache![k]).map((k) => `+${t.cache![k]} ${k}`).join(', ') });
      t.f = null; delete t.cache;
    } else if (t.f === 'ruin') {
      this.heroes.push({ id: t.hero!, level: 1, hurt: 0 });
      this.events.push({ type: 'hero', x, y, text: HEROES[t.hero!].name });
      t.f = null; delete t.hero;
    } else if (t.f === 'rumour') {
      this.pending = { event: t.event!, x, y };
      this.resumeTo = 'playing';
      this.state = 'event';
      this.events.push({ type: 'rumour', x, y });
      t.f = null; delete t.event;
    }
    this.welcome();
  }
  /** Lost chinchillas on tiles you have seen move in while there's room. */
  private welcome() {
    for (let i = 0; i < this.tiles.length && this.survivors < this.housing; i++) {
      const t = this.tiles[i];
      if (t.seen && t.f === 'stray') { t.f = null; this.join(1, i % W, Math.floor(i / W)); }
    }
  }
  private join(n: number, x?: number, y?: number) {
    for (let i = 0; i < n; i++) {
      if (this.survivors < this.housing) { this.survivors++; this.events.push({ type: 'join', x, y }); }
      else {
        // No room: they wait on the nearest open tile you hold.
        const spot = this.tiles.findIndex((t, j) => t.seen && !t.f && t.t !== 'crag' && !this.buildingAt(j % W, Math.floor(j / W)) && this.held(j % W, Math.floor(j / W)) && dist({ x: j % W, y: Math.floor(j / W) }, HOME) > 0);
        if (spot >= 0) this.tiles[spot].f = 'stray';
      }
    }
    this.fill();
  }
  /** Idle survivors take up any short-handed job: farms first while the hay is running down, then oldest building first. */
  private fill() {
    const hungry = this.income().hay < 0;
    const order = [...this.buildings].sort((p, q) => (hungry ? Number(q.kind === 'farm') - Number(p.kind === 'farm') : 0));
    for (const b of order) while (this.idle > 0 && b.workers < BUILDINGS[b.kind].workers) b.workers++;
  }

  build(kind: BuildingId, x: number, y: number): Refusal {
    const ok = this.canBuild(kind, x, y);
    if (ok !== 'ok') return ok;
    this.pay(BUILDINGS[kind].cost);
    if (kind === 'beacon') {
      this.buildings.push({ id: this.nextId++, kind, x, y, workers: 0, damaged: false });
      this.tile(x, y)!.f = null;
      this.state = 'won';
      this.events.push({ type: 'won' });
      return 'ok';
    }
    this.buildings.push({ id: this.nextId++, kind, x, y, workers: 0, damaged: false });
    this.events.push({ type: 'build', x, y, text: BUILDINGS[kind].name });
    this.fill();
    if (kind === 'nest') this.welcome();
    return 'ok';
  }
  /** Moves a survivor into (+1) or out of (−1) a building. */
  assign(id: number, delta: 1 | -1) {
    const b = this.buildings.find((q) => q.id === id);
    if (!b || this.state !== 'playing') return false;
    if (delta > 0 && (this.idle <= 0 || b.workers >= BUILDINGS[b.kind].workers)) return false;
    if (delta < 0 && b.workers <= 0) return false;
    b.workers += delta;
    return true;
  }
  /** A raid-damaged building is mended for half its cost. */
  repairCost(b: Building): Res { const c = BUILDINGS[b.kind].cost; return res(Math.ceil(c.hay / 2), Math.ceil(c.wood / 2), Math.ceil(c.stone / 2)); }
  repair(id: number) {
    const b = this.buildings.find((q) => q.id === id);
    if (!b || !b.damaged || this.state !== 'playing' || !this.afford(this.repairCost(b))) return false;
    this.pay(this.repairCost(b));
    b.damaged = false;
    this.events.push({ type: 'repair', x: b.x, y: b.y });
    return true;
  }
  /** Pulls a building down, giving back half its cost; its workers go idle. */
  demolish(id: number) {
    const b = this.buildings.find((q) => q.id === id);
    if (!b || this.state !== 'playing' || b.kind === 'beacon') return false;
    if (b.kind === 'nest' && this.housing - BUILDINGS.nest.housing! < this.survivors) return false;
    this.gain(this.repairCost(b));
    this.buildings = this.buildings.filter((q) => q !== b);
    this.fill();
    return true;
  }
  upgrade(): Refusal {
    const ok = this.canUpgrade();
    if (ok !== 'ok') return ok;
    this.pay(HQ_COST[this.hqLevel]);
    this.hqLevel++;
    this.hqHp = hqMaxHp(this.hqLevel);
    this.events.push({ type: 'upgrade', value: this.hqLevel });
    this.welcome();
    return 'ok';
  }
  train(id: HeroId): Refusal {
    const ok = this.canTrain(id);
    if (ok !== 'ok') return ok;
    const h = this.hero(id)!;
    this.pay(trainCost(h));
    h.level++;
    this.events.push({ type: 'train', text: HEROES[id].name, value: h.level });
    return 'ok';
  }
  /** The fit heroes attack a den. They win if their power reaches the den's; otherwise they come home hurt. */
  attack(x: number, y: number): Refusal {
    const ok = this.canAttack(x, y);
    if (ok !== 'ok') return ok;
    const t = this.tile(x, y)!, d = DENS[t.den!];
    this.stamina -= ATTACK_COST;
    if (this.squadPower >= d.power) {
      this.gain(d.loot);
      this.denCleared++;
      this.events.push({ type: 'win-fight', x, y, text: d.name });
      t.f = t.f === 'lair' ? 'beacon' : null;
      delete t.den;
      this.welcome();
    } else {
      for (const h of this.squad) h.hurt = HURT_TIME;
      this.events.push({ type: 'lose-fight', x, y, text: d.name });
    }
    return 'ok';
  }
  choose(i: 0 | 1) {
    if (this.state !== 'event' || !this.pending) return false;
    const e = EVENTS[this.pending.event], c = e.choices[i].cost ?? {};
    if (!this.afford(c) || this.stamina < (c.stamina ?? 0)) return false;
    this.pay(c); this.stamina -= c.stamina ?? 0;
    const { x, y } = this.pending, id = this.pending.event;
    this.pending = null;
    this.state = this.resumeTo;
    const trail = (n: number) => {
      // Uncovers the nearest hidden tiles next to land you hold, for free.
      for (let k = 0; k < n; k++) {
        let best = -1, bd = 99;
        for (let j = 0; j < this.tiles.length; j++) {
          const tx = j % W, ty = Math.floor(j / W);
          if (this.tiles[j].seen || !N4.some(([dx, dy]) => this.held(tx + dx, ty + dy))) continue;
          const dd = Math.abs(tx - x) + Math.abs(ty - y);
          if (dd < bd) { bd = dd; best = j; }
        }
        if (best >= 0) this.uncover(best % W, Math.floor(best / W));
      }
    };
    if (id === 'kit') { if (i === 0) { this.join(1, x, y); this.tonight += 6; } else trail(3); }
    else if (id === 'sled') this.gain(res(0, i === 0 ? 60 : 20, 0));
    else if (id === 'storm') this.tonight += i === 0 ? -10 : 5;
    else if (id === 'owl') { if (i === 0) this.gain(res(0, 0, 35)); }
    else if (id === 'herd') { if (i === 0) this.join(2, x, y); else trail(3); }
    else if (id === 'spring') { if (i === 0) { for (const h of this.heroes) h.hurt = 0; this.stamina = Math.min(STAMINA_MAX, this.stamina + 3); } else this.gain(res(25, 0, 0)); }
    return true;
  }
  pause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  update(dt: number) {
    if (this.state !== 'playing') return;
    const wasNight = this.night, day = this.day;
    this.time += dt;
    // Stamina comes back over time.
    if (this.stamina < STAMINA_MAX) {
      this.staminaClock += dt;
      while (this.staminaClock >= STAMINA_EVERY && this.stamina < STAMINA_MAX) { this.staminaClock -= STAMINA_EVERY; this.stamina++; }
    } else this.staminaClock = 0;
    for (const h of this.heroes) h.hurt = Math.max(0, h.hurt - dt);
    // Work, eat and burn.
    const inc = this.income();
    for (const k of RES_IDS) this.stock[k] = Math.max(0, this.stock[k] + inc[k] * dt);
    if (this.stock.hay <= 0 && inc.hay < 0) {
      this.hunger += dt;
      if (this.hunger >= STARVE) { this.hunger = 0; this.leave(); }
    } else this.hunger = 0;
    if (!this.night) this.hqHp = Math.min(hqMaxHp(this.hqLevel), this.hqHp + 0.5 * dt);
    // Nightfall: a raid sets out from the dens and the edge of the cloud.
    if (this.night && !wasNight) {
      this.raid = { strength: this.raidStrength(day), defence: 0, from: this.raiders(), done: false };
      this.events.push({ type: 'night', value: day });
    }
    if (this.raid && !this.raid.done && this.time % CYCLE >= DAY + RAID_AT) this.strike();
    if (!this.night && wasNight) {
      this.raid = null; this.tonight = 0;
      this.events.push({ type: 'dawn', value: this.day });
      // A traveller follows the lantern light in at dawn, if there's room and hay to spare.
      if (this.survivors < this.housing && this.stock.hay >= ARRIVAL_HAY) this.join(1, HOME.x, HOME.y);
    }
    if (this.survivors <= 0 || this.hqHp <= 0) { this.state = 'lost'; this.events.push({ type: 'lost' }); }
  }
  private leave() {
    if (this.survivors <= 0) return;
    if (this.idle <= 0) { const b = [...this.buildings].reverse().find((q) => q.workers > 0); if (b) b.workers--; }
    this.survivors--;
    this.events.push({ type: 'leave' });
  }
  /** Where tonight's raiders come from: the dens first, then hidden tiles at the edge of the cloud. */
  private raiders() {
    const out: Raid['from'] = [], edge: { x: number; y: number }[] = [];
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i], x = i % W, y = Math.floor(i / W);
      if ((t.f === 'den' || t.f === 'lair') && t.seen) out.push({ x, y, kind: t.den! });
      else if (!t.seen && N4.some(([dx, dy]) => this.held(x + dx, y + dy))) edge.push({ x, y });
    }
    const kinds: DenKind[] = this.day < 4 ? ['weasel', 'fox'] : this.day < 8 ? ['fox', 'owl', 'weasel'] : ['fox', 'owl', 'badger'];
    const n = Math.min(8, 2 + Math.floor(this.raidStrength() / 15));
    while (out.length < n && edge.length) {
      const e = edge.splice(Math.floor(this.random() * edge.length), 1)[0];
      out.push({ ...e, kind: kinds[Math.floor(this.random() * kinds.length)] });
    }
    return out.slice(0, n);
  }
  /** The raid reaches the burrow. Held, or it steals and smashes in proportion to how far it outmatched you. */
  private strike() {
    const r = this.raid!;
    r.done = true;
    r.defence = this.defence();
    const gap = r.strength - r.defence;
    if (gap <= 0) { r.held = true; this.raidsHeld++; this.events.push({ type: 'raid-held', value: r.strength }); return; }
    const loss = { hay: Math.min(this.stock.hay, gap * 2), wood: Math.min(this.stock.wood, gap * 2), stone: Math.min(this.stock.stone, gap), hp: gap * 2 };
    this.pay(loss);
    this.hqHp -= loss.hp;
    r.held = false; r.loss = loss;
    this.events.push({ type: 'raid-hit', value: gap });
    if (gap >= 8) {
      const standing = this.buildings.filter((b) => !b.damaged && b.kind !== 'beacon');
      if (standing.length) {
        const b = standing[Math.floor(this.random() * standing.length)];
        b.damaged = true;
        this.events.push({ type: 'damaged', x: b.x, y: b.y, text: BUILDINGS[b.kind].name });
      }
    }
  }

  /** Stars for a won run: three by the map's par day, two within four days of it. */
  stars() { return this.state !== 'won' ? 0 : this.day <= this.def.par ? 3 : this.day <= this.def.par + 4 ? 2 : 1; }

  // ---------- Saving ----------

  snapshot() {
    return {
      v: SAVE_VERSION, map: this.map, seed: this.seed, state: this.state === 'event' ? 'event' : this.state, time: this.time,
      stock: { ...this.stock }, stamina: this.stamina, staminaClock: this.staminaClock, survivors: this.survivors, hunger: this.hunger,
      hqLevel: this.hqLevel, hqHp: this.hqHp, heroes: this.heroes.map((h) => ({ ...h })), buildings: this.buildings.map((b) => ({ ...b })),
      tonight: this.tonight, raid: this.raid ? JSON.parse(JSON.stringify(this.raid)) : null, pending: this.pending ? { ...this.pending } : null,
      tiles: this.tiles.map((t) => ({ ...t, cache: t.cache ? { ...t.cache } : undefined })), summit: { ...this.summit },
      explored: this.explored, denCleared: this.denCleared, raidsHeld: this.raidsHeld, nextId: this.nextId, rng: this.random.state(),
    };
  }
  /** Rebuilds a game from `snapshot()`, or null for a save that is broken, from another version or impossible. */
  static load(s: unknown): Game | null {
    try {
      const o = s as ReturnType<Game['snapshot']>;
      const num = (v: unknown, lo = -Infinity, hi = Infinity) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
      if (!o || o.v !== SAVE_VERSION || !num(o.map, 0, MAPS.length - 1) || !num(o.seed) || !num(o.time, 0)) return null;
      if (!['playing', 'paused', 'event'].includes(o.state)) return null;
      if (!o.stock || !RES_IDS.every((k) => num(o.stock[k], 0))) return null;
      if (!num(o.stamina, 0, STAMINA_MAX) || !num(o.survivors, 1, 999) || !num(o.hqLevel, 1, HQ_MAX) || !num(o.hqHp, 0.0001, hqMaxHp(o.hqLevel))) return null;
      if (!Array.isArray(o.tiles) || o.tiles.length !== W * H) return null;
      const terr: Terrain[] = ['meadow', 'grove', 'rocks', 'snow', 'crag'];
      for (const t of o.tiles) {
        if (!terr.includes(t.t) || typeof t.seen !== 'boolean') return null;
        if ((t.f === 'den' || t.f === 'lair') && !(t.den && t.den in DENS)) return null;
        if (t.f === 'ruin' && !(t.hero && t.hero in HEROES)) return null;
        if (t.f === 'rumour' && !(t.event && t.event in EVENTS)) return null;
        if (t.f === 'cache' && !(t.cache && RES_IDS.every((k) => num(t.cache![k], 0)))) return null;
      }
      if (!Array.isArray(o.heroes) || !o.heroes.length || o.heroes.some((h) => !(h.id in HEROES) || !num(h.level, 1, HERO_MAX) || !num(h.hurt, 0, HURT_TIME))) return null;
      if (new Set(o.heroes.map((h) => h.id)).size !== o.heroes.length) return null;
      if (!Array.isArray(o.buildings)) return null;
      const g = new Game(o.map, o.seed);
      g.tiles = o.tiles.map((t) => { const c: Tile = { t: t.t, f: t.f ?? null, seen: t.seen }; if (t.den) c.den = t.den; if (t.hero) c.hero = t.hero; if (t.cache) c.cache = { ...t.cache }; if (t.event) c.event = t.event; return c; });
      for (const b of o.buildings) {
        const d = BUILDINGS[b.kind], t = g.tile(b.x, b.y);
        if (!d || b.kind === 'beacon' || !t || !t.seen || !d.on.includes(t.t) || t.f || !num(b.workers, 0, d.workers) || typeof b.damaged !== 'boolean' || !num(b.id, 1)) return null;
        if (o.buildings.filter((q) => q.x === b.x && q.y === b.y).length > 1) return null;
      }
      g.buildings = o.buildings.map((b) => ({ ...b }));
      if (g.buildings.reduce((s, b) => s + b.workers, 0) > o.survivors) return null;
      if (o.state === 'event' && !(o.pending && o.pending.event in EVENTS)) return null;
      Object.assign(g, {
        state: o.state, time: o.time, stock: { ...o.stock }, stamina: o.stamina, staminaClock: num(o.staminaClock, 0, STAMINA_EVERY) ? o.staminaClock : 0,
        survivors: o.survivors, hunger: num(o.hunger, 0, STARVE) ? o.hunger : 0, hqLevel: o.hqLevel, hqHp: o.hqHp,
        heroes: o.heroes.map((h) => ({ ...h })), tonight: num(o.tonight) ? o.tonight : 0, raid: o.raid ?? null, pending: o.pending ?? null,
        summit: { ...o.summit }, explored: o.explored | 0, denCleared: o.denCleared | 0, raidsHeld: o.raidsHeld | 0,
        nextId: Math.max(o.nextId | 0, ...g.buildings.map((b) => b.id + 1), 1),
      });
      g.random.set(o.rng);
      if (g.survivors > g.housing) return null;
      return g;
    } catch { return null; }
  }
}

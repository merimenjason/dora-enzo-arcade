// Pawhaven: Dora and Enzo found a chinchilla town on an empty meadow and grow it into a busy one. Rules only, no DOM.
// The map is a square grid of tiles, indexed i = y * size + x, drawn isometrically by the scene. Everything is
// deterministic: a meadow's seed makes the map, and the same actions on the same ticks grow the same town. Helpers, carts,
// buyers, newcomers and traders walk the roads as plain objects (the tile they stand on, the tile they are heading for and
// how far along they are), so the page can draw them moving. The design lives in docs/pawhaven.md.

export const SAVE_KEY = 'pawhaven-v1';
export const TICKS_PER_SECOND = 10;
/** Ticks in a month; twelve months make a year. Acorns are settled, food eaten and the weather rolled each month. */
export const MONTH = 300;
export const YEAR = MONTH * 12;
/** A helper's visit counts for three months. */
export const VISIT = MONTH * 3;
/** A home that loses a need keeps its level this long before it shrinks one level. */
export const GRACE = MONTH;
export const SPEEDS = [0, 1, 2, 4] as const;
/** A staffed service building sends a helper out this often (slower when short of workers). */
export const WALK_EVERY = 100;
export const WALK_RANGE = 30;
export const WELL_RANGE = 12;
export const CART_LOAD = 16;
/** What a producer or workshop holds before it stops; also a workshop's input store. */
export const OWN_STORE = 16;
/** A farm's own store, big enough for one harvest. */
export const FARM_STORE = 32;
export const BUYER_LOAD = 16;
export const NEWCOMER_EVERY = 5;
export const COSY_ARRIVE = 30;
export const COSY_LEAVE = 20;
export const COSY_START = 60;
export const GUARD_RANGE = 6;
export const BURN = 60;
export const TREE_CLEAR = 3;
/** Acorns paid each month per chinchilla at work. */
export const WAGE = 0.2;
export const CARAVAN_EVERY = MONTH * 2;
export const FOX_EVERY = 3;
export const MAX_TOWNS = 3;
export const MAX_EVENTS = 300;
/** Walking speeds in tiles per tick. */
export const PACE = { helper: 0.25, cart: 0.2, buyer: 0.25, newcomer: 0.34, trader: 0.25, fox: 0.2, flee: 0.4 } as const;
/** Tax: what the homes' acorns are multiplied by, and what it does to cosiness. */
export const TAX = [{ name: 'low', mult: 0.8, cosy: 8 }, { name: 'normal', mult: 1, cosy: 0 }, { name: 'high', mult: 1.25, cosy: -12 }] as const;

export const GRASS = 0, FERTILE = 1, WATER = 2, ROCK = 3, TREES = 4, SAND = 5;
export const TERRAINS = ['grass', 'fertile', 'water', 'rock', 'trees', 'sand'] as const;
/** The road layer: nothing, a road, a puddle left by a storm (walkers wait for it to be cleared), or a plaza's paving. */
export const NO_ROAD = 0, ROAD = 1, PUDDLE = 2, PAVED = 3;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

export type Good = 'berries' | 'hay' | 'oats' | 'wood' | 'clay' | 'sand' | 'dust' | 'pottery' | 'toys' | 'bedding';
export const GOODS: Good[] = ['berries', 'hay', 'oats', 'wood', 'clay', 'sand', 'dust', 'pottery', 'toys', 'bedding'];
export const FOODS: Good[] = ['berries', 'hay', 'oats'];
/** The goods homes keep, in the order they come to want them. */
export const WARES: Good[] = ['pottery', 'toys', 'bedding'];
export const GOOD_NAMES: Record<Good, string> = { berries: 'berries', hay: 'hay', oats: 'oats', wood: 'wood', clay: 'clay', sand: 'sand', dust: 'dust', pottery: 'pottery', toys: 'toys', bedding: 'bedding' };

export type Service = 'water' | 'dust' | 'healer' | 'story' | 'music' | 'fire' | 'seller';
/** The visits a home remembers. */
export const VISITS: Service[] = ['water', 'dust', 'healer', 'story', 'music'];

export const HOME_LEVELS = [
  { level: 1, name: 'Hay Nest', holds: 4, acorns: 1, needs: 'road access' },
  { level: 2, name: 'Twig Hut', holds: 6, acorns: 2, needs: 'water' },
  { level: 3, name: 'Snug Burrow', holds: 9, acorns: 3, needs: 'one kind of food' },
  { level: 4, name: 'Dusty Burrow', holds: 12, acorns: 5, needs: 'a dust bath' },
  { level: 5, name: 'Cosy Burrow', holds: 16, acorns: 7, needs: 'two kinds of food, pottery and a healer' },
  { level: 6, name: 'Fine Burrow', holds: 20, acorns: 10, needs: 'toys, stories and a pretty street (2)' },
  { level: 7, name: 'Grand Burrow', holds: 24, acorns: 14, needs: 'three kinds of food, bedding, music and a lovely street (4)' },
] as const;
/** How many kinds of food a home at this level wants handed to it (enough to grow to the next level). */
export const foodKinds = (level: number) => (level >= 6 ? 3 : level >= 4 ? 2 : 1);
/** How many of the WARES a home at this level wants. */
export const wareKinds = (level: number) => (level >= 6 ? 3 : level >= 5 ? 2 : level >= 4 ? 1 : 0);

export type Kind =
  | 'road' | 'home' | 'well' | 'tower' | 'hayFarm' | 'oatFarm' | 'berry' | 'woodcutter' | 'clayPit' | 'sandPit' | 'dustMill'
  | 'potter' | 'toymaker' | 'weaver' | 'granary' | 'storehouse' | 'market' | 'bathhouse' | 'herb' | 'story' | 'music'
  | 'fireWatch' | 'foxWatch' | 'fence' | 'garden' | 'pond' | 'statue' | 'plaza' | 'tradingPost' | 'hall' | 'rubble';

/** Who gets workers first: the town hall, food, water, services, industry, then trade. */
export const PRIORITY = ['hall', 'food', 'water', 'services', 'industry', 'trade'] as const;

export type Spec = {
  kind: Kind; name: string; size: number; jobs: number; cost: number; prio: number;
  /** Fire risk added each tick; it catches fire at 100. */
  risk: number;
  /** Desirability at its own tiles, fading by 1 per tile beyond the next one. */
  desir?: number;
  /** Every tile must be this terrain. */
  on?: number;
  /** Water within this many tiles of the plot. */
  nearWater?: number;
  nearTrees?: boolean;
  /** What it makes, at `rate` units a month at full staff (or by the harvest, for a farm). */
  makes?: Good; rate?: number; crop?: boolean;
  /** A workshop: `perBatch` of `takes` become `gives` of `makes`, `batches` times a month at full staff. */
  takes?: Good; perBatch?: number; gives?: number; batches?: number;
  /** A store: which goods it keeps, and how many in all. */
  stores?: Good[]; cap?: number;
  /** A helper who walks out from it. */
  svc?: Service; range?: number;
  /** A buyer fetches these from stores when it has fewer than `keep`, up to `hold` of each. */
  buys?: Good[]; keep?: number; hold?: number;
};

const S = (kind: Kind, name: string, size: number, jobs: number, cost: number, prio: number, risk: number, more: Partial<Spec> = {}): [Kind, Spec] =>
  [kind, { kind, name, size, jobs, cost, prio, risk, ...more }];
const OTHERS = GOODS.filter((g) => !FOODS.includes(g));

/** Every building: size in tiles, jobs, cost in acorns, worker priority (index into PRIORITY), fire risk per tick. */
export const BUILDINGS: Record<Kind, Spec> = Object.fromEntries([
  S('road', 'Road', 1, 0, 2, 9, 0),
  S('home', 'Home plot', 1, 0, 5, 9, 0.05),
  S('well', 'Well', 1, 0, 15, 2, 0, { svc: 'water', range: WELL_RANGE }),
  S('tower', 'Water tower', 2, 4, 60, 2, 0.04, { svc: 'water', range: WALK_RANGE, nearWater: 3 }),
  S('hayFarm', 'Hay farm', 3, 6, 80, 1, 0.04, { on: FERTILE, makes: 'hay', crop: true, desir: -2 }),
  S('oatFarm', 'Oat farm', 3, 6, 80, 1, 0.04, { on: FERTILE, makes: 'oats', crop: true, desir: -2 }),
  S('berry', 'Berry bush patch', 2, 4, 40, 1, 0.04, { makes: 'berries', rate: 8 }),
  S('woodcutter', 'Woodcutter', 1, 4, 45, 4, 0.06, { nearTrees: true, makes: 'wood', rate: 6, desir: -1 }),
  S('clayPit', 'Clay pit', 2, 4, 50, 4, 0.04, { nearWater: 2, makes: 'clay', rate: 6, desir: -2 }),
  S('sandPit', 'Sand pit', 2, 4, 50, 4, 0.04, { on: SAND, makes: 'sand', rate: 6, desir: -2 }),
  S('dustMill', 'Dust mill', 2, 6, 90, 4, 0.1, { takes: 'sand', perBatch: 2, gives: 2, batches: 3, makes: 'dust', desir: -2, buys: ['sand'], keep: 8, hold: OWN_STORE }),
  S('potter', 'Potter', 2, 6, 100, 4, 0.1, { takes: 'clay', perBatch: 2, gives: 1, batches: 3, makes: 'pottery', desir: -2, buys: ['clay'], keep: 8, hold: OWN_STORE }),
  S('toymaker', 'Toymaker', 2, 6, 130, 4, 0.1, { takes: 'wood', perBatch: 2, gives: 1, batches: 3, makes: 'toys', desir: -1, buys: ['wood'], keep: 8, hold: OWN_STORE }),
  S('weaver', 'Bedding weaver', 2, 6, 150, 4, 0.1, { takes: 'hay', perBatch: 2, gives: 1, batches: 3, makes: 'bedding', desir: -1, buys: ['hay'], keep: 8, hold: OWN_STORE }),
  S('granary', 'Granary', 3, 6, 120, 1, 0.04, { stores: FOODS, cap: 400, desir: -1 }),
  S('storehouse', 'Storehouse', 3, 6, 120, 4, 0.04, { stores: OTHERS, cap: 400, desir: -1 }),
  S('market', 'Market stall', 2, 4, 60, 3, 0.05, { svc: 'seller', range: WALK_RANGE, buys: [...FOODS, ...WARES], keep: 12, hold: 24 }),
  S('bathhouse', 'Dust bath house', 2, 4, 90, 3, 0.05, { svc: 'dust', range: WALK_RANGE, buys: ['dust'], keep: 4, hold: 8 }),
  S('herb', 'Herb hut', 1, 3, 60, 3, 0.05, { svc: 'healer', range: WALK_RANGE }),
  S('story', 'Story circle', 2, 4, 100, 3, 0.05, { svc: 'story', range: WALK_RANGE, desir: 1 }),
  S('music', 'Music stump', 2, 4, 130, 3, 0.05, { svc: 'music', range: WALK_RANGE, desir: 1 }),
  S('fireWatch', 'Fire watch', 1, 2, 35, 3, 0, { svc: 'fire', range: WALK_RANGE }),
  S('foxWatch', 'Fox watch', 1, 3, 45, 3, 0.03),
  S('fence', 'Fence', 1, 0, 2, 9, 0),
  S('garden', 'Garden', 1, 0, 15, 9, 0, { desir: 2 }),
  S('pond', 'Pond', 2, 0, 45, 9, 0, { desir: 3 }),
  S('statue', 'Statue', 3, 0, 250, 9, 0, { desir: 5 }),
  S('plaza', 'Plaza', 2, 0, 60, 9, 0, { desir: 3 }),
  S('tradingPost', 'Trading post', 3, 6, 180, 5, 0.05),
  S('hall', 'Town hall', 3, 8, 150, 0, 0.03, { desir: 1 }),
  S('rubble', 'Rubble', 1, 0, 0, 9, 0),
]) as Record<Kind, Spec>;

/** A farm's harvest every two months by season (spring, summer, autumn, winter). */
export const HARVEST = [32, 32, 24, 16];
/** Ticks of full-staff growth between harvests. */
export const GROW = MONTH * 2;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Route = { id: string; name: string; cost: number; cap: number; buys: Partial<Record<Good, number>>; sells: Partial<Record<Good, number>> };
/** Neighbouring towns: what they buy from us and sell to us, at acorns per unit, up to `cap` of each good a year. */
export const ROUTES: Record<string, Route> = {
  pebble: { id: 'pebble', name: 'Pebble Ford', cost: 150, cap: 80, buys: { pottery: 14, wood: 5 }, sells: { oats: 4, berries: 4 } },
  mossy: { id: 'mossy', name: 'Mossy Hollow', cost: 100, cap: 100, buys: { berries: 3, hay: 3, clay: 4 }, sells: { sand: 5, dust: 8 } },
  thistle: { id: 'thistle', name: 'Thistle Top', cost: 200, cap: 60, buys: { toys: 20, dust: 7 }, sells: { clay: 5, wood: 6, pottery: 18 } },
  bramble: { id: 'bramble', name: 'Bramble Gate', cost: 250, cap: 60, buys: { bedding: 22, pottery: 15 }, sells: { toys: 24, hay: 4 } },
};

export type Goal = { kind: 'pop'; n: number } | { kind: 'level'; level: number; n: number } | { kind: 'cosy'; n: number } | { kind: 'purse'; n: number };
export type Land = { fertile: [number, number]; sand: [number, number]; trees: [number, number]; rock: [number, number]; lakes: [number, number] };
export type Meadow = {
  id: string; n: number; name: string; brief: string; size: number; seed: number; purse: number;
  /** Finish within this many years for a second star. */
  years: number;
  /** The buildings this meadow opens (the earlier meadows' come too). */
  opens: Kind[]; goals: Goal[]; routes: string[];
  fire: boolean; foxes: boolean;
  /** Chance each month of a dry spell and of a storm. */
  dry: number; storm: number;
  /** Map features: [how many patches, tiles in each]. */
  land: Land;
};

export const MEADOWS: Meadow[] = [
  { id: 'clover', n: 1, name: 'Clover Landing', size: 32, seed: 1101, purse: 500, years: 2,
    brief: "Dora: Here we are! Lay a road from the way in and put down some home plots. Enzo: Wells for water, berries for supper, and a market stall to share them out. Let's make it cosy.",
    opens: ['road', 'home', 'hall', 'well', 'berry', 'granary', 'market'], goals: [{ kind: 'pop', n: 60 }, { kind: 'level', level: 3, n: 10 }], routes: [],
    fire: false, foxes: false, dry: 0, storm: 0, land: { fertile: [3, 30], sand: [1, 10], trees: [4, 18], rock: [2, 6], lakes: [2, 20] } },
  { id: 'willow', n: 2, name: 'Willow Bend', size: 36, seed: 2203, purse: 800, years: 4,
    brief: 'Enzo: Look at that dark, soft meadow! Hay and oats will grow there. Dora: A water tower reaches further than a well, and a fire watch keeps every street safe and sound.',
    opens: ['tower', 'hayFarm', 'oatFarm', 'woodcutter', 'storehouse', 'fireWatch', 'garden'], goals: [{ kind: 'pop', n: 150 }, { kind: 'cosy', n: 50 }], routes: [],
    fire: true, foxes: false, dry: 0, storm: 0, land: { fertile: [5, 45], sand: [1, 10], trees: [5, 22], rock: [2, 8], lakes: [3, 30] } },
  { id: 'sandy', n: 3, name: 'Sandy Rise', size: 36, seed: 3307, purse: 1000, years: 5,
    brief: 'Dora: Sand! Proper chinchilla sand! Dig it, mill it into fine dust, and every burrow can have a dust bath. Enzo: And a herb hut, for anyone feeling a bit sniffly.',
    opens: ['sandPit', 'dustMill', 'bathhouse', 'herb', 'pond'], goals: [{ kind: 'pop', n: 250 }, { kind: 'level', level: 4, n: 15 }], routes: [],
    fire: true, foxes: false, dry: 0, storm: 0, land: { fertile: [4, 40], sand: [5, 30], trees: [4, 18], rock: [4, 10], lakes: [2, 22] } },
  { id: 'clayfoot', n: 4, name: 'Clayfoot Brook', size: 40, seed: 4409, purse: 1400, years: 7,
    brief: 'Enzo: The brook banks are full of clay, perfect for pots. Dora: And friendly towns nearby would love to trade. Open a road to them and set what to sell and buy.',
    opens: ['clayPit', 'potter', 'tradingPost', 'plaza'], goals: [{ kind: 'pop', n: 350 }, { kind: 'purse', n: 600 }], routes: ['pebble', 'mossy'],
    fire: true, foxes: false, dry: 0, storm: 0, land: { fertile: [5, 45], sand: [3, 25], trees: [5, 22], rock: [3, 10], lakes: [4, 30] } },
  { id: 'foxglove', n: 5, name: 'Foxglove Edge', size: 40, seed: 5501, purse: 1600, years: 8,
    brief: 'Dora: Curious foxes live round here. Fences and gates keep them out, and a fox watch shoos them home. Enzo: Then toys and stories for the little ones!',
    opens: ['fence', 'foxWatch', 'toymaker', 'story'], goals: [{ kind: 'pop', n: 450 }, { kind: 'level', level: 6, n: 10 }], routes: ['pebble', 'thistle'],
    fire: true, foxes: true, dry: 0, storm: 0, land: { fertile: [5, 45], sand: [3, 25], trees: [7, 26], rock: [3, 10], lakes: [4, 28] } },
  { id: 'stormy', n: 6, name: 'Stormy Downs', size: 44, seed: 6607, purse: 2000, years: 10,
    brief: 'Enzo: The weather is lively up here: storms leave puddles and dry spells slow the farms. Dora: Farms near water keep growing. And music, bedding and statues make a grand town!',
    opens: ['weaver', 'music', 'statue'], goals: [{ kind: 'pop', n: 600 }, { kind: 'level', level: 7, n: 5 }, { kind: 'cosy', n: 70 }], routes: ['thistle', 'bramble'],
    fire: true, foxes: false, dry: 0.2, storm: 0.25, land: { fertile: [6, 50], sand: [3, 25], trees: [5, 22], rock: [4, 12], lakes: [5, 30] } },
  { id: 'pawhaven', n: 7, name: 'Pawhaven', size: 48, seed: 7703, purse: 3000, years: 14,
    brief: 'Dora: This is it, the biggest meadow of all. Enzo: Everything we have learned, all in one place. Let us build Pawhaven, the cosiest town there ever was!',
    opens: [], goals: [{ kind: 'pop', n: 900 }, { kind: 'level', level: 7, n: 15 }], routes: ['pebble', 'mossy', 'thistle', 'bramble'],
    fire: true, foxes: true, dry: 0.12, storm: 0.15, land: { fertile: [7, 55], sand: [4, 28], trees: [7, 26], rock: [5, 12], lakes: [5, 34] } },
  { id: 'free', n: 8, name: 'Free Meadow', size: 48, seed: 8803, purse: 5000, years: 99,
    brief: 'Dora: No goals, no hurry. Enzo: Just us, a big meadow, and whatever town you dream up.',
    opens: [], goals: [], routes: ['pebble', 'mossy', 'thistle', 'bramble'],
    fire: true, foxes: false, dry: 0.08, storm: 0.08, land: { fertile: [7, 55], sand: [4, 28], trees: [7, 26], rock: [5, 12], lakes: [5, 34] } },
];
export const meadowById = (id: string) => MEADOWS.find((m) => m.id === id);
/** Every building open in a meadow: its own and the earlier meadows' (the last two open everything). */
export function meadowKinds(m: Meadow): Kind[] {
  const out: Kind[] = [];
  for (const o of MEADOWS) if (o.n <= m.n) for (const k of o.opens) if (!out.includes(k)) out.push(k);
  return out;
}

/** A small seeded generator (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type MapData = { size: number; terrain: Uint8Array; entry: number; exit: number };

/** Lays out a meadow's terrain from its seed. The way in is on the west edge and the way out on the east, on the middle
 *  row; a five-row band along that row is always grass so the two can be joined. Patches grow outwards from a seeded
 *  start. A map that lacks a spot the meadow's buildings need (a 3×3 of fertile meadow, a 2×2 of sand, water, trees)
 *  is thrown away for the next sub-seed. */
export function makeMap(m: Meadow, seed = m.seed): MapData {
  const N = m.size, ey = N >> 1, kinds = meadowKinds(m);
  let terrain = new Uint8Array(N * N);
  for (let attempt = 0; attempt < 40; attempt++) {
    terrain = growTerrain(m, (seed + attempt * 7919) >>> 0);
    if (mapFits(N, terrain, kinds)) break;
  }
  return { size: N, terrain, entry: ey * N, exit: ey * N + N - 1 };
}

function growTerrain(m: Meadow, seed: number) {
  const N = m.size, ey = N >> 1, t = new Uint8Array(N * N), rand = seeded(seed);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && Math.abs(y - ey) > 2;
  const blob = (type: number, size: number) => {
    let x = 0, y = 0;
    do { x = Math.floor(rand() * N); y = Math.floor(rand() * N); } while (!free(x, y));
    const cells = [y * N + x], seen = new Set(cells);
    for (let k = 0; k < size * 6 && cells.length < size; k++) {
      const c = cells[Math.floor(rand() * cells.length)], d = Math.floor(rand() * 4), nx = (c % N) + DX[d], ny = Math.floor(c / N) + DY[d];
      if (!free(nx, ny) || seen.has(ny * N + nx)) continue;
      seen.add(ny * N + nx); cells.push(ny * N + nx);
    }
    for (const i of cells) if (t[i] === GRASS || type === WATER) t[i] = type;
  };
  const L = m.land;
  for (const [type, [count, size]] of [[FERTILE, L.fertile], [SAND, L.sand], [TREES, L.trees], [ROCK, L.rock], [WATER, L.lakes]] as [number, [number, number]][])
    for (let c = 0; c < count; c++) blob(type, size);
  return t;
}

function mapFits(N: number, t: Uint8Array, kinds: Kind[]) {
  const square = (type: number, s: number) => {
    for (let y = 0; y + s <= N; y++) for (let x = 0; x + s <= N; x++) {
      let ok = true;
      for (let j = 0; j < s && ok; j++) for (let i = 0; i < s && ok; i++) if (t[(y + j) * N + x + i] !== type) ok = false;
      if (ok) return true;
    }
    return false;
  };
  if (kinds.includes('hayFarm') && !square(FERTILE, 3)) return false;
  if (kinds.includes('sandPit') && !square(SAND, 2)) return false;
  if ((kinds.includes('tower') || kinds.includes('clayPit')) && !t.includes(WATER)) return false;
  if (kinds.includes('woodcutter') && !t.includes(TREES)) return false;
  return true;
}

export type Building = {
  id: number; kind: Kind; x: number; y: number; size: number;
  workers: number;
  /** Goods held: a producer's output, a workshop's input and output, a store's stock, a stall's stock, a home's food and wares. */
  store: Partial<Record<Good, number>>;
  /** Units carts are bringing, so two carts don't fill the same room. */
  incoming: number;
  /** Progress towards the next unit, batch or harvest. */
  prog: number;
  risk: number;
  /** Ticks left to burn, 0 when not burning. */
  burning: number;
  /** The tick the next helper may leave. */
  next: number;
  /** A cart or buyer of its own is out. */
  cart: number; buyer: number;
  /** The tick its helpers last chose each road tile at a junction, for taking the way walked least recently. The
   *  engine keeps this in a typed array while running; it is written out here (only the tiles walked) when saved. */
  walked: Record<number, number>;
  /** Homes: level, residents, newcomers on their way, the tick of each kind of helper's last visit, the tick a missing
   *  need will make it shrink (-1 when nothing is missing), and residents away after a fox visit. */
  level: number; pop: number; room: number; seen: Partial<Record<Service, number>>; grace: number; away: number; awayUntil: number;
  /** For rubble: what stood here. */
  was?: Kind;
};

export type WalkerKind = 'helper' | 'cart' | 'buyer' | 'newcomer' | 'trader';
export type Walker = {
  id: number; kind: WalkerKind; job?: Service;
  /** The building it belongs to (its home building, or for a newcomer the home it is moving into). */
  home: number;
  /** Where it is going: a building id, or -1. */
  target: number;
  /** It stands on (x, y), heading for (tx, ty), `p` of the way there (0 to 1). */
  x: number; y: number; tx: number; ty: number; p: number; spd: number;
  prev: number;
  /** Road tiles left on a helper's walk. */
  left: number;
  /** Heading back (helpers, carts, buyers) or out of the meadow (traders). */
  back: boolean;
  load: Partial<Record<Good, number>>;
  /** Units a cart has promised to its target. */
  amt: number;
  gone?: boolean;
};
export type Fox = { id: number; x: number; y: number; tx: number; ty: number; p: number; flee: boolean; gone?: boolean };
export type TradeMode = 'keep' | 'export' | 'import';
export type Trade = { mode: TradeMode; n: number };
export type GameEvent = { kind: string; tick: number; msg?: string; x?: number; y?: number; [k: string]: unknown };
export type Result = { ok: boolean; reason?: string; id?: number };
export type GoalState = { label: string; done: boolean; now: number; need: number };

const blank = (id: number, kind: Kind, x: number, y: number, size: number): Building => ({
  id, kind, x, y, size, workers: 0, store: {}, incoming: 0, prog: 0, risk: 0, burning: 0, next: 0, cart: 0, buyer: 0, walked: {},
  level: kind === 'home' ? 1 : 0, pop: 0, room: 0, seen: {}, grace: -1, away: 0, awayUntil: 0,
});
const sum = (s: Partial<Record<Good, number>>) => { let n = 0; for (const k in s) n += s[k as Good] ?? 0; return n; };
const add = (s: Partial<Record<Good, number>>, g: Good, n: number) => { s[g] = (s[g] ?? 0) + n; if (!s[g]) delete s[g]; };

export class PawhavenGame {
  meadow: Meadow; seed: number; size: number;
  terrain: Uint8Array; road: Uint8Array; fence: Uint8Array;
  /** The building id on each tile, 0 for none. */
  occ: Int32Array;
  entry: number; exit: number;
  buildings = new Map<number, Building>();
  walkers: Walker[] = [];
  foxes: Fox[] = [];
  /** The page drains these each frame for sounds and banners. */
  events: GameEvent[] = [];
  tick = 0; purse: number; cosiness = COSY_START; tax = 1; speed = 1;
  pop = 0; workforce = 0; jobs = 0; employed = 0; unemployed = 0;
  /** Last month's acorns in and out. */
  income = 0; wages = 0;
  trade: Partial<Record<Good, Trade>> = {};
  routes: string[] = [];
  /** Units traded this year, by `route:good`. */
  traded: Record<string, number> = {};
  /** The tick each goal has held since (null while it doesn't hold). */
  goalsMet: (number | null)[];
  won: number | null = null; stars = 0;
  dryUntil = 0;
  open: Set<Kind>;
  private nextId = 1;
  private rs: number;
  private acc = 0;
  private roadVer = 0; private fieldVer = -1; private fields = new Map<string, Int16Array>(); private doorCache = new Map<number, number[]>();
  private bFields = new Map<number, Int16Array>();
  private memo = new Map<number, Int32Array>();
  /** Building lists, rebuilt when buildings come and go: all of them, the homes, and those that make, send or fetch. */
  private listVer = -1; private all: Building[] = []; private homeList: Building[] = []; private busy: Building[] = [];
  private orderKey = ''; private homeOrder: Building[] = [];
  private buildVer = 0; private desirVer = -1; private desir: Int8Array;
  private foxVer = 0; private foxFieldVer = -1; private foxField: Int16Array | null = null;

  constructor(opts: { meadow?: string; seed?: number } = {}) {
    const m = meadowById(opts.meadow ?? MEADOWS[0].id);
    if (!m) throw new Error(`No meadow called ${opts.meadow}`);
    this.meadow = m; this.seed = (opts.seed ?? m.seed) >>> 0;
    const map = makeMap(m, this.seed), N = map.size;
    this.size = N; this.terrain = map.terrain; this.entry = map.entry; this.exit = map.exit;
    this.road = new Uint8Array(N * N); this.fence = new Uint8Array(N * N); this.occ = new Int32Array(N * N); this.desir = new Int8Array(N * N);
    this.road[this.entry] = ROAD; this.road[this.exit] = ROAD;
    this.rs = (Math.imul(this.seed, 2654435761) + 0x9e3779b9) >>> 0;
    this.purse = m.purse; this.open = new Set(meadowKinds(m)); this.goalsMet = m.goals.map(() => null);
  }

  // ---- small helpers ----
  private rand() { this.rs = (this.rs + 0x6d2b79f5) >>> 0; let t = this.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  inside(x: number, y: number) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }
  walkable(i: number) { const r = this.road[i]; return r === ROAD || r === PAVED; }
  get monthIndex() { return Math.floor(this.tick / MONTH); }
  get year() { return Math.floor(this.tick / YEAR) + 1; }
  get month() { return this.monthIndex % 12; }
  get season() { return SEASONS[Math.floor(this.month / 3)]; }
  get dry() { return this.tick < this.dryUntil; }
  buildingAt(x: number, y: number) { return this.inside(x, y) ? this.buildings.get(this.occ[y * this.size + x]) : undefined; }
  share(b: Building) { const jobs = BUILDINGS[b.kind].jobs; return jobs ? b.workers / jobs : 1; }
  holds(h: Building) { return HOME_LEVELS[h.level - 1].holds; }
  private lists() {
    if (this.listVer === this.buildVer) return;
    this.all = [...this.buildings.values()]; this.homeList = this.all.filter((b) => b.kind === 'home');
    this.busy = this.all.filter((b) => { const s = BUILDINGS[b.kind]; return !!(s.makes || s.svc || s.buys || s.risk); });
    this.listVer = this.buildVer;
  }
  homes() { this.lists(); return this.homeList.slice(); }
  /** How many homes are at this level or above. */
  homesAtLeast(level: number) { this.lists(); let n = 0; for (const b of this.homeList) if (b.level >= level && !b.burning) n++; return n; }
  private ev(kind: string, data: Partial<GameEvent> = {}) {
    this.events.push({ kind, tick: this.tick, ...data });
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }
  /** Hands the page the events since it last asked. */
  drain() { const e = this.events; this.events = []; return e; }

  /** Road tiles beside a building's plot, in tile order. A building with none has no road access. */
  doors(b: Building) {
    if (this.fieldVer !== this.roadVer) this.resetFields();
    let d = this.doorCache.get(b.id);
    if (d) return d;
    d = [];
    const N = this.size;
    for (let y = b.y - 1; y <= b.y + b.size; y++) for (let x = b.x - 1; x <= b.x + b.size; x++) {
      const edgeX = x === b.x - 1 || x === b.x + b.size, edgeY = y === b.y - 1 || y === b.y + b.size;
      if (edgeX === edgeY || !this.inside(x, y)) continue; // skip the plot itself and the corners
      if (this.walkable(y * N + x) && this.occ[y * N + x] !== b.id) d.push(y * N + x);
    }
    this.doorCache.set(b.id, d);
    return d;
  }
  hasAccess(b: Building) { return this.doors(b).length > 0; }
  private resetFields() { this.fields.clear(); this.bFields.clear(); this.doorCache.clear(); this.fieldVer = this.roadVer; }
  /** Road steps to the nearest of `src` from every tile (-1 where the roads don't reach), cached until the roads change. */
  field(key: string, src: number[]) {
    if (this.fieldVer !== this.roadVer) this.resetFields();
    let f = this.fields.get(key);
    if (f) return f;
    const N = this.size, q = new Int32Array(N * N);
    f = new Int16Array(N * N).fill(-1);
    let head = 0, tail = 0;
    for (const s of src) if (f[s] < 0 && this.walkable(s)) { f[s] = 0; q[tail++] = s; }
    while (head < tail) {
      const c = q[head++], cx = c % N, cy = (c - cx) / N;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx;
        if (f[n] < 0 && this.walkable(n)) { f[n] = f[c] + 1; q[tail++] = n; }
      }
    }
    if (this.fields.size > 800) this.fields.clear();
    this.fields.set(key, f);
    return f;
  }
  /** Road steps to a building from every tile. */
  private bField(b: Building) {
    if (this.fieldVer !== this.roadVer) this.resetFields();
    let f = this.bFields.get(b.id);
    if (!f) { f = this.field('tmp', this.doors(b)); this.fields.delete('tmp'); if (this.bFields.size > 1500) this.bFields.clear(); this.bFields.set(b.id, f); }
    return f;
  }
  /** A building's walk memory: the tick its helpers last chose each tile (-1 for never). */
  private walkMemo(b: Building) {
    let m = this.memo.get(b.id);
    if (!m) { m = new Int32Array(this.size * this.size).fill(-1); for (const k in b.walked) m[+k] = b.walked[k]; b.walked = {}; this.memo.set(b.id, m); }
    return m;
  }
  /** Road steps from a field's source to a building (-1 when it can't be reached). */
  private distTo(f: Int16Array, b: Building) { let best = -1; for (const d of this.doors(b)) if (f[d] >= 0 && (best < 0 || f[d] < best)) best = f[d]; return best; }

  /** The desirability of every tile, from −4 to +6. */
  desirability() {
    if (this.desirVer === this.buildVer) return this.desir;
    const N = this.size, acc = new Int16Array(N * N);
    for (const b of this.buildings.values()) {
      const v = BUILDINGS[b.kind].desir; if (!v || b.burning) continue;
      const r = Math.abs(v);
      for (let y = Math.max(0, b.y - r); y <= Math.min(N - 1, b.y + b.size - 1 + r); y++) for (let x = Math.max(0, b.x - r); x <= Math.min(N - 1, b.x + b.size - 1 + r); x++) {
        const d = Math.max(b.x - x, x - (b.x + b.size - 1), b.y - y, y - (b.y + b.size - 1), 0);
        const e = d <= 1 ? v : v > 0 ? v - (d - 1) : v + (d - 1);
        if (v > 0 ? e > 0 : e < 0) acc[y * N + x] += e;
      }
    }
    for (let i = 0; i < N * N; i++) this.desir[i] = Math.max(-4, Math.min(6, acc[i]));
    this.desirVer = this.buildVer;
    return this.desir;
  }
  desirAt(x: number, y: number) { return this.desirability()[y * this.size + x]; }

  // ---- actions ----
  /** Whether a building can go here, and if not, why (in a kind word). */
  canBuild(kind: Kind, x: number, y: number): Result {
    const s = BUILDINGS[kind], N = this.size;
    if (!s || kind === 'rubble' || !this.open.has(kind)) return { ok: false, reason: 'That one opens in a later meadow.' };
    if (!this.inside(x, y) || !this.inside(x + s.size - 1, y + s.size - 1)) return { ok: false, reason: 'Pick a spot inside the meadow.' };
    if (this.purse < s.cost) return { ok: false, reason: 'Not enough acorns yet.' };
    const i = y * N + x;
    if (kind === 'fence' && this.road[i] === ROAD && !this.fence[i] && i !== this.entry && i !== this.exit) return { ok: true }; // a gate
    for (let j = 0; j < s.size; j++) for (let k = 0; k < s.size; k++) {
      const t = (y + j) * N + x + k, ter = this.terrain[t];
      if (this.occ[t] || this.road[t] || this.fence[t]) return { ok: false, reason: this.road[t] === PUDDLE ? 'Clear the puddle first.' : 'Something is already here.' };
      if (ter === WATER) return { ok: false, reason: "That's water: try dry ground." };
      if (ter === ROCK) return { ok: false, reason: "That's rock: try beside it." };
      if (ter === TREES) return { ok: false, reason: 'Clear the trees first.' };
      if (s.on !== undefined && ter !== s.on) return { ok: false, reason: s.on === FERTILE ? 'Farms grow only on dark, fertile meadow.' : 'Sand pits go on sand.' };
    }
    if (s.nearWater && !this.near(x, y, s.size, s.nearWater, WATER)) return { ok: false, reason: `It needs water within ${s.nearWater} tiles.` };
    if (s.nearTrees && !this.near(x, y, s.size, 1, TREES)) return { ok: false, reason: 'A woodcutter needs trees right beside it.' };
    if (kind === 'hall') for (const b of this.buildings.values()) if (b.kind === 'hall') return { ok: false, reason: 'One town hall is plenty.' };
    return { ok: true };
  }
  private near(x: number, y: number, size: number, r: number, ter: number) {
    for (let j = y - r; j < y + size + r; j++) for (let i = x - r; i < x + size + r; i++) if (this.inside(i, j) && this.terrain[j * this.size + i] === ter) return true;
    return false;
  }

  /** Builds at (x, y), the top-left tile of the plot (top as drawn: lowest x and y). */
  build(kind: Kind, x: number, y: number): Result {
    const c = this.canBuild(kind, x, y);
    if (!c.ok) return c;
    const s = BUILDINGS[kind], N = this.size, i = y * N + x;
    this.purse -= s.cost;
    if (kind === 'road') { this.road[i] = ROAD; this.roadVer++; return { ok: true }; }
    if (kind === 'fence') { this.fence[i] = 1; this.foxVer++; return { ok: true }; }
    const b = blank(this.nextId++, kind, x, y, s.size);
    b.risk = this.rand() * 30; b.next = this.tick;
    this.buildings.set(b.id, b);
    for (let j = 0; j < s.size; j++) for (let k = 0; k < s.size; k++) {
      this.occ[(y + j) * N + x + k] = b.id;
      if (kind === 'plaza') this.road[(y + j) * N + x + k] = PAVED;
    }
    if (kind === 'plaza') this.roadVer++;
    this.buildVer++; this.foxVer++;
    this.ev('built', { building: kind, x, y, id: b.id });
    return { ok: true, id: b.id };
  }

  /** Clears a tile: a building or rubble, a fence or gate, a puddle (free), a road, or trees (TREE_CLEAR acorns). */
  clear(x: number, y: number): Result {
    if (!this.inside(x, y)) return { ok: false, reason: 'Pick a spot inside the meadow.' };
    const N = this.size, i = y * N + x;
    if (this.fence[i]) { this.fence[i] = 0; this.foxVer++; return { ok: true }; }
    if (i === this.entry || i === this.exit) return { ok: false, reason: 'The way in and out stays open.' };
    const b = this.buildings.get(this.occ[i]);
    if (b) { this.remove(b); return { ok: true }; }
    if (this.road[i] === PUDDLE) { this.road[i] = ROAD; this.roadVer++; return { ok: true }; }
    if (this.road[i] === ROAD) { this.road[i] = NO_ROAD; this.roadVer++; return { ok: true }; }
    if (this.terrain[i] === TREES) {
      if (this.purse < TREE_CLEAR) return { ok: false, reason: 'Not enough acorns yet.' };
      this.purse -= TREE_CLEAR; this.terrain[i] = GRASS; return { ok: true };
    }
    return { ok: false, reason: 'Nothing to clear here.' };
  }

  private remove(b: Building) {
    const N = this.size;
    for (let j = 0; j < b.size; j++) for (let k = 0; k < b.size; k++) {
      const t = (b.y + j) * N + b.x + k;
      this.occ[t] = 0;
      if (this.road[t] === PAVED) { this.road[t] = NO_ROAD; this.roadVer++; }
    }
    this.dropWalkers(b.id);
    this.buildings.delete(b.id); this.memo.delete(b.id);
    this.buildVer++; this.foxVer++;
  }
  private dropWalkers(id: number) { for (const w of this.walkers) if (!w.gone && w.home === id) this.finish(w); }

  /** For each good: keep it, sell what is above n, or buy up to n. */
  setTrade(good: Good, mode: TradeMode, n = 0): Result {
    if (!GOODS.includes(good) || !['keep', 'export', 'import'].includes(mode)) return { ok: false, reason: 'Nothing to trade there.' };
    this.trade[good] = { mode, n: Math.max(0, Math.min(9999, Math.floor(n) || 0)) };
    return { ok: true };
  }
  openRoute(id: string): Result {
    const r = ROUTES[id];
    if (!r || !this.meadow.routes.includes(id)) return { ok: false, reason: 'No road leads there from this meadow.' };
    if (this.routes.includes(id)) return { ok: false, reason: 'That route is already open.' };
    if (this.purse < r.cost) return { ok: false, reason: 'Not enough acorns yet.' };
    this.purse -= r.cost; this.routes.push(id);
    this.ev('route', { route: id, msg: `The road to ${r.name} is open. Hello, neighbours!` });
    return { ok: true };
  }
  setSpeed(s: number) { if ((SPEEDS as readonly number[]).includes(s)) this.speed = s; }
  setTax(t: number) { if (t === 0 || t === 1 || t === 2) this.tax = t; }

  /** Runs the clock for `dt` seconds of real time at the current speed; returns the ticks stepped. */
  update(dt: number) {
    if (!this.speed) return 0;
    this.acc += dt * TICKS_PER_SECOND * this.speed;
    let n = 0;
    while (this.acc >= 1 && n < 40) { this.step(); this.acc -= 1; n++; }
    if (this.acc > 1) this.acc = 0;
    return n;
  }

  // ---- the tick ----
  step() {
    this.tick++;
    if (this.tick % 10 === 1) this.staff();
    this.lists();
    for (const b of this.busy) this.work(b);
    for (const w of this.walkers) if (!w.gone) this.move(w);
    if (this.walkers.some((w) => w.gone)) this.walkers = this.walkers.filter((w) => !w.gone);
    if (this.foxes.length) this.moveFoxes();
    if (this.meadow.fire) this.burn();
    for (const b of this.homeList) if ((this.tick + b.id) % 25 === 0) this.settleHome(b);
    if (this.tick % NEWCOMER_EVERY === 0) this.newcomer();
    if (this.tick % CARAVAN_EVERY === 0) this.caravan();
    if (this.tick % MONTH === 0) this.monthEnd();
    if (this.tick % 50 === 0) this.checkGoals();
  }

  /** Counts the chinchillas and shares the workers out by priority, then build order. */
  private staff() {
    let pop = 0;
    this.lists();
    for (const b of this.homeList) pop += b.pop;
    this.pop = pop; this.workforce = Math.floor((pop * 2) / 3);
    const list: Building[] = [];
    for (const b of this.buildings.values()) { b.workers = 0; if (BUILDINGS[b.kind].jobs && !b.burning) list.push(b); }
    list.sort((a, b) => BUILDINGS[a.kind].prio - BUILDINGS[b.kind].prio || a.id - b.id);
    let left = this.workforce, jobs = 0;
    for (const b of list) {
      const n = BUILDINGS[b.kind].jobs; jobs += n;
      if (!this.hasAccess(b)) continue;
      b.workers = Math.min(n, left); left -= b.workers;
    }
    this.jobs = jobs; this.employed = this.workforce - left; this.unemployed = left;
  }

  /** One building's tick: growing, making, sending helpers, carts and buyers. */
  private work(b: Building) {
    const s = BUILDINGS[b.kind];
    if (b.burning || b.kind === 'rubble' || b.kind === 'home') return;
    if (!s.makes && !s.svc && !s.buys) return;
    if (!this.hasAccess(b)) return;
    const sh = this.share(b);
    if (sh > 0 && s.makes) {
      const have = b.store[s.makes] ?? 0;
      const slow = this.dry && (s.crop || s.rate) && b.kind !== 'woodcutter' && b.kind !== 'clayPit' && b.kind !== 'sandPit' && !this.near(b.x, b.y, b.size, 3, WATER) ? 0.5 : 1;
      if (s.crop) {
        b.prog += (sh * slow) / GROW;
        if (b.prog >= 1 && have < FARM_STORE) { b.prog = 0; add(b.store, s.makes, Math.min(FARM_STORE - have, HARVEST[Math.floor(this.month / 3)])); }
        else if (b.prog > 1) b.prog = 1;
      } else if (s.rate) {
        if (have < OWN_STORE) { b.prog += (sh * slow * s.rate) / MONTH; while (b.prog >= 1) { b.prog -= 1; add(b.store, s.makes, 1); } }
      } else if (s.takes && (b.store[s.takes] ?? 0) >= s.perBatch! && have < OWN_STORE) {
        b.prog += (sh * s.batches!) / MONTH;
        if (b.prog >= 1) { b.prog = 0; add(b.store, s.takes, -s.perBatch!); add(b.store, s.makes, s.gives!); }
      }
      if (!b.cart && (b.store[s.makes] ?? 0) >= CART_LOAD && (this.tick + b.id) % 10 === 0) this.sendCart(b, s.makes);
    }
    if (s.svc && sh > 0 && this.tick >= b.next) {
      const stocked = s.svc === 'dust' ? (b.store.dust ?? 0) > 0 : s.svc === 'seller' ? sum(b.store) > 0 : true;
      if (stocked) { this.spawn(b, 'helper', s.svc, -1); b.next = this.tick + Math.ceil(WALK_EVERY / sh); }
    }
    if (s.buys && sh > 0 && !b.buyer && (this.tick + b.id) % 10 === 5) this.sendBuyer(b);
  }

  /** Room a building has for a good a cart brings. */
  room(b: Building, g: Good) {
    const s = BUILDINGS[b.kind];
    if (b.burning || b.kind === 'rubble') return 0;
    if (s.stores) return s.stores.includes(g) && b.workers > 0 ? s.cap! - sum(b.store) - b.incoming : 0;
    if (s.takes === g) return OWN_STORE - (b.store[g] ?? 0) - b.incoming;
    if (b.kind === 'bathhouse' && g === 'dust') return s.hold! - (b.store.dust ?? 0) - b.incoming;
    return 0;
  }
  private sendCart(b: Building, g: Good) {
    const f = this.bField(b);
    let best: Building | null = null, bd = 0, bp = 9;
    for (const t of this.buildings.values()) {
      if (t === b || this.room(t, g) <= 0) continue;
      const d = this.distTo(f, t); if (d < 0) continue;
      const pr = BUILDINGS[t.kind].stores ? 1 : 0; // workshops and bath houses first, then stores
      if (pr < bp || (pr === bp && d < bd)) { best = t; bd = d; bp = pr; }
    }
    if (!best) return;
    const amt = Math.min(CART_LOAD, b.store[g] ?? 0, this.room(best, g));
    add(b.store, g, -amt); best.incoming += amt; b.cart = 1;
    const w = this.spawn(b, 'cart', undefined, best.id);
    w.load = { [g]: amt }; w.amt = amt;
  }
  private lacking(b: Building) { const s = BUILDINGS[b.kind]; return (s.buys ?? []).filter((g) => (b.store[g] ?? 0) < s.keep!); }
  private sendBuyer(b: Building) {
    const want = this.lacking(b);
    if (!want.length) return;
    const f = this.bField(b);
    let best: Building | null = null, bd = 0;
    for (const t of this.buildings.values()) {
      if (!BUILDINGS[t.kind].stores || t.burning || !want.some((g) => (t.store[g] ?? 0) > 0)) continue;
      const d = this.distTo(f, t);
      if (d >= 0 && (!best || d < bd)) { best = t; bd = d; }
    }
    if (!best) return;
    b.buyer = 1;
    this.spawn(b, 'buyer', undefined, best.id);
  }

  private spawn(b: Building | null, kind: WalkerKind, job: Service | undefined, target: number): Walker {
    const N = this.size, at = b ? this.doors(b)[0] : this.entry;
    const spd = PACE[kind];
    const w: Walker = { id: this.nextId++, kind, job, home: b ? b.id : target, target, x: at % N, y: Math.floor(at / N), tx: at % N, ty: Math.floor(at / N), p: 1, spd, prev: -1,
      left: b && job ? (BUILDINGS[b.kind].range ?? WALK_RANGE) : 0, back: false, load: {}, amt: 0 };
    this.walkers.push(w);
    return w;
  }

  private move(w: Walker) {
    const N = this.size;
    w.p += w.spd;
    let guard = 0;
    while (w.p >= 1 && !w.gone && guard++ < 4) {
      w.p -= 1;
      const from = w.y * N + w.x;
      w.x = w.tx; w.y = w.ty;
      const here = w.y * N + w.x;
      if (here !== from) w.prev = from;
      if (!this.walkable(here)) { this.finish(w); break; }
      this.arrive(w, here);
      if (w.gone) break;
      const n = this.nextTile(w, here);
      if (n < 0) { this.finish(w); break; }
      w.tx = n % N; w.ty = Math.floor(n / N);
      if (n === here) w.p = 0;
    }
  }

  private arrive(w: Walker, here: number) {
    const home = this.buildings.get(w.home), target = w.target > 0 ? this.buildings.get(w.target) : undefined;
    if (w.kind === 'newcomer') {
      if (!home) { w.gone = true; return; }
      if (this.bField(home)[here] === 0) {
        home.room = Math.max(0, home.room - 1);
        if (!home.burning && !home.away && home.pop < this.holds(home)) { home.pop++; this.pop++; this.ev('newcomer', { x: home.x, y: home.y, id: home.id }); }
        w.gone = true;
      }
      return;
    }
    if (w.kind === 'trader') {
      if (!w.back) { if (!target) w.back = true; else if (this.bField(target)[here] === 0) { this.trade1(); w.back = true; } }
      if (w.back && here === this.exit) w.gone = true;
      return;
    }
    if (!home) { w.gone = true; return; }
    if (w.kind === 'helper' && !w.back) { this.serve(w, here, home); if (--w.left <= 0) w.back = true; }
    else if (w.kind === 'cart' && !w.back) {
      if (!target || target.burning || target.kind === 'rubble') w.back = true;
      else if (this.bField(target)[here] === 0) {
        target.incoming = Math.max(0, target.incoming - w.amt);
        for (const g in w.load) add(target.store, g as Good, w.load[g as Good]!);
        w.load = {}; w.amt = 0; w.back = true;
      }
    } else if (w.kind === 'buyer' && !w.back) {
      if (!target || target.burning) w.back = true;
      else if (this.bField(target)[here] === 0) { this.fetch(home, target, w); w.back = true; }
    }
    if (w.back && this.bField(home)[here] === 0) this.finish(w);
  }

  /** Which tile next: a roaming helper takes the way its building walked least recently; everyone else walks downhill
   *  on the road distance to where they are going. */
  private nextTile(w: Walker, here: number) {
    const N = this.size, home = this.buildings.get(w.home);
    if (w.kind === 'helper' && !w.back && home) {
      let best = -1, bt = Infinity, options = 0;
      const x = here % N, y = (here - x) / N, memo = this.walkMemo(home);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (!this.inside(nx, ny)) continue;
        const n = ny * N + nx;
        if (n === w.prev || !this.walkable(n)) continue;
        const t = memo[n]; options++;
        if (t < bt) { bt = t; best = n; }
      }
      if (best < 0 && w.prev >= 0 && this.walkable(w.prev)) best = w.prev;
      if (best < 0) { w.back = true; return here; }
      if (options > 1) memo[best] = this.tick;
      return best;
    }
    let f: Int16Array;
    const t = this.buildings.get(w.target);
    if (w.kind === 'trader') f = !w.back && t ? this.bField(t) : this.field('x', [this.exit]);
    else if (w.kind === 'newcomer') { if (!home) return -1; f = this.bField(home); }
    else if (w.back) { if (!home) return -1; f = this.bField(home); }
    else if (t) f = this.bField(t);
    else { w.back = true; if (!home) return -1; f = this.bField(home); }
    return this.downhill(f, here);
  }
  private downhill(f: Int16Array, here: number) {
    const N = this.size, d0 = f[here];
    if (d0 < 0) return -1;
    if (d0 === 0) return here;
    const x = here % N, y = (here - x) / N;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (this.inside(nx, ny) && f[ny * N + nx] === d0 - 1) return ny * N + nx;
    }
    return -1;
  }

  /** A walker is done (home again, arrived, or lost its way): settle what it carried and promised. */
  private finish(w: Walker) {
    if (w.gone) return;
    w.gone = true;
    const home = this.buildings.get(w.home);
    if (w.kind === 'cart') {
      if (w.amt) { const t = this.buildings.get(w.target); if (t) t.incoming = Math.max(0, t.incoming - w.amt); w.amt = 0; }
      if (home) { home.cart = 0; for (const g in w.load) add(home.store, g as Good, w.load[g as Good]!); }
    } else if (w.kind === 'buyer') {
      if (home) { home.buyer = 0; for (const g in w.load) add(home.store, g as Good, w.load[g as Good]!); }
    } else if (w.kind === 'newcomer' && home) home.room = Math.max(0, home.room - 1);
    w.load = {};
  }

  /** A helper serves every building whose plot touches the road tile it steps on. */
  private serve(w: Walker, here: number, from: Building) {
    const N = this.size, x = here % N, y = (here - x) / N, done: number[] = [];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!this.inside(nx, ny)) continue;
      const id = this.occ[ny * N + nx];
      if (!id || done.includes(id)) continue;
      done.push(id);
      const b = this.buildings.get(id)!;
      if (w.job === 'fire') {
        if (b.burning) { b.burning = 0; b.risk = 0; this.ev('fireOut', { x: b.x, y: b.y, id: b.id, msg: `The fire watch put out the fire at the ${this.nameOf(b)}. Phew!` }); }
        else b.risk = 0;
      } else if (b.kind === 'home' && !b.burning) {
        if (w.job === 'seller') this.handOut(from, b);
        else b.seen[w.job!] = this.tick;
      }
    }
  }
  /** A market seller hands a home up to two months' food of each kind it wants, and the wares it wants. */
  private handOut(stall: Building, h: Building) {
    if (!h.pop) return;
    const want = foodKinds(h.level), need = Math.ceil(Math.ceil(h.pop / 4) / want) * 2;
    const kinds = FOODS.filter((k) => (h.store[k] ?? 0) > 0);
    for (const k of [...FOODS].sort((a, b) => (stall.store[b] ?? 0) - (stall.store[a] ?? 0))) if (kinds.length < want && !kinds.includes(k) && (stall.store[k] ?? 0) > 0) kinds.push(k);
    for (const k of kinds) {
      const give = Math.min(need - (h.store[k] ?? 0), stall.store[k] ?? 0);
      if (give > 0) { add(h.store, k, give); add(stall.store, k, -give); }
    }
    for (const g of WARES.slice(0, wareKinds(h.level))) {
      const give = Math.min(2 - (h.store[g] ?? 0), stall.store[g] ?? 0);
      if (give > 0) { add(h.store, g, give); add(stall.store, g, -give); }
    }
  }
  /** A buyer takes what its building lacks from a store, the emptiest first, up to a load. */
  private fetch(b: Building, from: Building, w: Walker) {
    const s = BUILDINGS[b.kind];
    let left = BUYER_LOAD;
    for (const g of this.lacking(b).sort((a, c) => (b.store[a] ?? 0) - (b.store[c] ?? 0))) {
      const n = Math.min(left, s.hold! - (b.store[g] ?? 0), from.store[g] ?? 0);
      if (n > 0) { add(from.store, g, -n); add(w.load, g, n); left -= n; }
    }
  }

  // ---- homes ----
  /** The level a home's needs support right now. */
  homeTarget(h: Building) {
    if (!this.hasAccess(h)) return 1;
    const seen = (s: Service) => (h.seen[s] ?? -VISIT) > this.tick - VISIT;
    const kinds = FOODS.filter((k) => (h.store[k] ?? 0) > 0).length, has = (g: Good) => (h.store[g] ?? 0) > 0;
    if (!seen('water')) return 1;
    if (kinds < 1) return 2;
    if (!seen('dust')) return 3;
    if (kinds < 2 || !has('pottery') || !seen('healer')) return 4;
    const d = this.desirAt(h.x, h.y);
    if (!has('toys') || !seen('story') || d < 2) return 5;
    if (kinds < 3 || !has('bedding') || !seen('music') || d < 4) return 6;
    return 7;
  }
  /** What a home needs next to grow, in a few words for the page. */
  nextNeed(h: Building) {
    if (!this.hasAccess(h)) return 'a road beside it';
    const seen = (s: Service) => (h.seen[s] ?? -VISIT) > this.tick - VISIT;
    const kinds = FOODS.filter((k) => (h.store[k] ?? 0) > 0).length, has = (g: Good) => (h.store[g] ?? 0) > 0;
    if (!h.pop) return 'residents';
    if (!seen('water')) return 'water';
    if (kinds < 1) return 'food';
    if (!seen('dust')) return 'a dust bath';
    if (kinds < 2) return 'a second kind of food';
    if (!has('pottery')) return 'pottery';
    if (!seen('healer')) return 'a healer';
    const d = this.desirAt(h.x, h.y);
    if (!has('toys')) return 'toys';
    if (!seen('story')) return 'stories';
    if (d < 2) return 'a prettier street';
    if (kinds < 3) return 'a third kind of food';
    if (!has('bedding')) return 'bedding';
    if (!seen('music')) return 'music';
    if (d < 4) return 'an even prettier street';
    return '';
  }
  private settleHome(h: Building) {
    if (h.burning) return;
    if (h.away) {
      if (this.tick < h.awayUntil) return;
      const back = Math.min(h.away, this.holds(h)); h.away = 0; h.pop += back; this.pop += back;
      this.ev('homeAgain', { x: h.x, y: h.y, id: h.id, msg: 'The fox has gone, and everyone is home again.' });
    }
    const want = this.homeTarget(h);
    if (want > h.level && h.pop > 0) {
      h.level++; h.grace = -1;
      this.ev('levelUp', { x: h.x, y: h.y, id: h.id, level: h.level, msg: `A home grew into a ${HOME_LEVELS[h.level - 1].name}!` });
    } else if (want < h.level) {
      if (h.grace < 0) h.grace = this.tick + GRACE;
      else if (this.tick >= h.grace) {
        h.level--; h.grace = -1;
        const over = h.pop - this.holds(h);
        if (over > 0) { h.pop -= over; this.pop -= over; }
        this.ev('levelDown', { x: h.x, y: h.y, id: h.id, level: h.level, msg: `A home is missing ${this.nextNeed(h) || 'something'}, so it is a ${HOME_LEVELS[h.level - 1].name} for now.` });
      }
    } else h.grace = -1;
  }
  private newcomer() {
    if (this.cosiness < COSY_ARRIVE) return;
    this.lists();
    const key = `${this.roadVer}:${this.buildVer}`;
    if (this.orderKey !== key) {
      const f = this.field('e', [this.entry]), d = new Map<number, number>();
      for (const h of this.homeList) { const k = this.distTo(f, h); if (k >= 0) d.set(h.id, k); }
      this.homeOrder = this.homeList.filter((h) => d.has(h.id)).sort((a, b) => d.get(a.id)! - d.get(b.id)! || a.id - b.id);
      this.orderKey = key;
    }
    const best = this.homeOrder.find((h) => !h.burning && !h.away && h.kind === 'home' && h.pop + h.room < this.holds(h));
    if (!best) return;
    best.room++;
    this.spawn(null, 'newcomer', undefined, best.id);
  }

  // ---- threats ----
  private burn() {
    for (const b of this.busy) {
      if (b.burning) {
        if (--b.burning <= 0) this.toRubble(b);
        continue;
      }
      const r = BUILDINGS[b.kind].risk;
      if (!r || b.kind === 'rubble') continue;
      b.risk += r;
      if (b.risk >= 100) {
        b.burning = BURN; b.risk = 0;
        if (b.pop) { this.pop -= b.pop; b.pop = 0; }
        b.room = 0; this.dropWalkers(b.id);
        this.ev('fire', { x: b.x, y: b.y, id: b.id, msg: `The ${this.nameOf(b)} has caught fire! Everyone is safe and off to stay with friends.` });
      }
    }
  }
  private toRubble(b: Building) {
    this.ev('rubble', { x: b.x, y: b.y, id: b.id, msg: `The ${this.nameOf(b)} burned down. Clear the rubble and build again.` });
    b.was = b.kind; b.kind = 'rubble'; b.burning = 0; b.store = {}; b.workers = 0; b.pop = 0; b.level = 0; b.incoming = 0;
    this.buildVer++; this.foxVer++;
  }
  nameOf(b: Building) { return b.kind === 'home' ? HOME_LEVELS[b.level - 1].name : BUILDINGS[b.kind].name; }

  private spawnFox() {
    const N = this.size;
    for (let tries = 0; tries < 40; tries++) {
      const side = Math.floor(this.rand() * 4), k = Math.floor(this.rand() * N);
      const x = side === 0 ? k : side === 1 ? N - 1 : side === 2 ? k : 0, y = side === 0 ? 0 : side === 1 ? k : side === 2 ? N - 1 : k;
      const i = y * N + x;
      if (this.terrain[i] === WATER || this.fence[i]) continue;
      this.foxes.push({ id: this.nextId++, x, y, tx: x, ty: y, p: 1, flee: false });
      this.ev('fox', { x, y, msg: 'A curious fox is sniffing round the meadow edge.' });
      return;
    }
  }
  /** Steps from every tile to the nearest home, for a fox: it can cross anything but water and fences. */
  private foxPaths() {
    if (this.foxField && this.foxFieldVer === this.foxVer) return this.foxField;
    const N = this.size, f = new Int16Array(N * N).fill(-1), q = new Int32Array(N * N);
    let head = 0, tail = 0;
    for (const b of this.buildings.values()) if (b.kind === 'home') { const i = b.y * N + b.x; f[i] = 0; q[tail++] = i; }
    while (head < tail) {
      const c = q[head++], cx = c % N, cy = (c - cx) / N;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx;
        if (f[n] < 0 && this.terrain[n] !== WATER && !this.fence[n]) { f[n] = f[c] + 1; q[tail++] = n; }
      }
    }
    this.foxField = f; this.foxFieldVer = this.foxVer;
    return f;
  }
  private guarded(x: number, y: number) {
    for (const b of this.buildings.values()) if (b.kind === 'foxWatch' && b.workers > 0 && !b.burning && Math.hypot(b.x - x, b.y - y) <= GUARD_RANGE) return true;
    return false;
  }
  private moveFoxes() {
    const N = this.size;
    for (const fx of this.foxes) {
      fx.p += fx.flee ? PACE.flee : PACE.fox;
      while (fx.p >= 1 && !fx.gone) {
        fx.p -= 1; fx.x = fx.tx; fx.y = fx.ty;
        if (fx.flee) {
          const ex = Math.min(fx.x, N - 1 - fx.x, fx.y, N - 1 - fx.y);
          if (ex === 0) { fx.gone = true; break; }
          if (ex === fx.x) fx.tx--; else if (ex === N - 1 - fx.x) fx.tx++; else if (ex === fx.y) fx.ty--; else fx.ty++;
          continue;
        }
        if (this.guarded(fx.x, fx.y)) { fx.flee = true; this.ev('foxChased', { x: fx.x, y: fx.y, msg: 'The fox watch shooed the fox back home.' }); fx.p = 1; continue; }
        const here = fx.y * N + fx.x, h = this.buildings.get(this.occ[here]);
        if (h && h.kind === 'home') {
          if (h.pop) { h.away = h.pop; this.pop -= h.pop; h.pop = 0; h.awayUntil = this.tick + MONTH; }
          this.ev('foxHome', { x: fx.x, y: fx.y, id: h.id, msg: 'A fox peeked into a home! Everyone dashed off for a month with friends.' });
          fx.flee = true; fx.p = 1; continue;
        }
        const f = this.foxPaths(), n = this.downhill(f, here);
        if (n < 0 || n === here) { fx.flee = true; this.ev('foxAway', { x: fx.x, y: fx.y, msg: 'The fences were too tall, so the fox trotted home.' }); fx.p = 1; continue; }
        fx.tx = n % N; fx.ty = Math.floor(n / N);
      }
    }
    this.foxes = this.foxes.filter((f) => !f.gone);
  }

  // ---- trade ----
  /** Units of a good in the town's stores. */
  stock(g: Good) { let n = 0; for (const b of this.buildings.values()) if (BUILDINGS[b.kind].stores?.includes(g)) n += b.store[g] ?? 0; return n; }
  private storeRoom(g: Good) { let n = 0; for (const b of this.buildings.values()) if (BUILDINGS[b.kind].stores?.includes(g) && !b.burning) n += Math.max(0, BUILDINGS[b.kind].cap! - sum(b.store) - b.incoming); return n; }
  private take(g: Good, n: number) { for (const b of this.buildings.values()) { if (n <= 0) break; if (!BUILDINGS[b.kind].stores?.includes(g)) continue; const k = Math.min(n, b.store[g] ?? 0); add(b.store, g, -k); n -= k; } }
  private put(g: Good, n: number) {
    for (const b of this.buildings.values()) {
      if (n <= 0) break;
      const s = BUILDINGS[b.kind]; if (!s.stores?.includes(g) || b.burning) continue;
      const k = Math.min(n, s.cap! - sum(b.store) - b.incoming); if (k > 0) { add(b.store, g, k); n -= k; }
    }
  }
  private caravan() {
    if (!this.routes.length || this.walkers.some((w) => w.kind === 'trader')) return;
    const post = [...this.buildings.values()].find((b) => b.kind === 'tradingPost' && b.workers > 0 && !b.burning && this.hasAccess(b));
    if (!post || this.distTo(this.field('e', [this.entry]), post) < 0) return;
    this.spawn(null, 'trader', undefined, post.id);
  }
  /** A caravan at the trading post sells and buys what is set, route by route. */
  private trade1() {
    const sold: Partial<Record<Good, number>> = {}, bought: Partial<Record<Good, number>> = {};
    let delta = 0;
    for (const id of this.routes) {
      const r = ROUTES[id];
      for (const [g, price] of Object.entries(r.buys) as [Good, number][]) {
        const t = this.trade[g]; if (t?.mode !== 'export') continue;
        const key = `${id}:${g}`, n = Math.min(this.stock(g) - t.n, r.cap - (this.traded[key] ?? 0));
        if (n <= 0) continue;
        this.take(g, n); this.traded[key] = (this.traded[key] ?? 0) + n; add(sold, g, n); this.purse += n * price; delta += n * price;
      }
      for (const [g, price] of Object.entries(r.sells) as [Good, number][]) {
        const t = this.trade[g]; if (t?.mode !== 'import') continue;
        const key = `${id}:${g}`, n = Math.min(t.n - this.stock(g), r.cap - (this.traded[key] ?? 0), this.storeRoom(g), Math.floor(this.purse / price));
        if (n <= 0) continue;
        this.put(g, n); this.traded[key] = (this.traded[key] ?? 0) + n; add(bought, g, n); this.purse -= n * price; delta -= n * price;
      }
    }
    this.ev('caravan', { sold, bought, acorns: delta, msg: delta >= 0 ? `A caravan came by: +${delta} acorns.` : `A caravan came by with goods for ${-delta} acorns.` });
  }

  // ---- the month ----
  private monthEnd() {
    const mi = this.monthIndex;
    // food is eaten, wares wear, dust baths use their dust
    for (const b of this.buildings.values()) {
      if (b.kind === 'home' && b.pop) {
        const held = FOODS.filter((k) => (b.store[k] ?? 0) > 0), each = held.length ? Math.ceil(Math.ceil(b.pop / 4) / held.length) : 0;
        for (const k of held) b.store[k] = Math.max(0, b.store[k]! - each);
        if (mi % 3 === 0) for (const g of WARES) if (b.store[g]) b.store[g]!--;
        for (const k of GOODS) if (!b.store[k]) delete b.store[k];
      } else if (b.kind === 'bathhouse' && b.workers > 0 && b.store.dust) add(b.store, 'dust', -1);
    }
    // acorns: the town hall collects from the homes, wages are paid
    const hall = [...this.buildings.values()].find((b) => b.kind === 'hall' && !b.burning && this.hasAccess(b));
    let income = 0;
    if (hall) {
      for (const b of this.buildings.values()) if (b.kind === 'home' && b.pop) income += (HOME_LEVELS[b.level - 1].acorns * b.pop) / this.holds(b);
      income *= TAX[this.tax].mult * (0.5 + 0.5 * this.share(hall));
    }
    this.income = Math.round(income); this.wages = Math.round(this.employed * WAGE);
    this.purse = Math.max(0, this.purse + this.income - this.wages);
    // cosiness drifts towards what the town offers
    this.cosiness = Math.max(0, Math.min(100, this.cosiness + Math.max(-8, Math.min(8, this.cosyTarget() - this.cosiness))));
    if (this.cosiness < COSY_LEAVE && this.pop > 0) this.leave(Math.max(1, Math.floor(this.pop * 0.04)));
    // weather and foxes
    if (this.meadow.dry && this.rand() < this.meadow.dry) { this.dryUntil = this.tick + MONTH; this.ev('dry', { msg: 'A dry spell: farms away from water grow slowly this month.' }); }
    if (this.meadow.storm && this.rand() < this.meadow.storm) this.storm();
    if (this.meadow.foxes && mi >= 2 && mi % FOX_EVERY === 0) this.spawnFox();
    if (mi % 12 === 0) { this.traded = {}; this.ev('year', { year: this.year, msg: `Happy new year! Year ${this.year} in ${this.meadow.name}.` }); }
    if (mi % 3 === 0) this.ev('season', { season: this.season });
    this.ev('month', { income: this.income, wages: this.wages, month: this.month, year: this.year });
  }
  /** The cosiness the town is heading for: food and visits raise it, idle paws and high tax lower it. */
  cosyTarget() {
    let res = 0, fed = 0, served = 0;
    for (const h of this.buildings.values()) {
      if (h.kind !== 'home' || !h.pop) continue;
      res += h.pop;
      if (FOODS.some((k) => (h.store[k] ?? 0) > 0)) fed += h.pop;
      let n = 0; for (const s of VISITS) if ((h.seen[s] ?? -VISIT) > this.tick - VISIT) n++;
      served += h.pop * Math.min(1, n / 3);
    }
    if (!res) return COSY_START;
    const idle = this.workforce ? this.unemployed / this.workforce : 0;
    return Math.round(30 + (25 * fed) / res + (30 * served) / res + TAX[this.tax].cosy - 40 * Math.max(0, idle - 0.3));
  }
  private leave(n: number) {
    const hs = this.homes().filter((h) => h.pop).sort((a, b) => a.level - b.level || b.id - a.id);
    let left = n;
    for (const h of hs) { if (left <= 0) break; const k = Math.min(left, h.pop); h.pop -= k; this.pop -= k; left -= k; }
    this.ev('leavers', { n, msg: `${n} chinchilla${n > 1 ? 's' : ''} wandered off to find a cosier town. Food and visits help everyone settle.` });
  }
  private storm() {
    const N = this.size, roads: number[] = [];
    for (let i = 0; i < N * N; i++) if (this.road[i] === ROAD && !this.fence[i] && i !== this.entry && i !== this.exit) roads.push(i);
    const k = Math.min(roads.length, 1 + Math.floor(this.rand() * 3)), hit: number[] = [];
    for (let j = 0; j < k; j++) { const i = roads.splice(Math.floor(this.rand() * roads.length), 1)[0]; this.road[i] = PUDDLE; hit.push(i); }
    if (hit.length) this.roadVer++;
    this.ev('storm', { tiles: hit, msg: hit.length ? 'A storm left puddles on the road. Tap them to sweep them away.' : 'A storm rolled over, and everything is fine.' });
  }

  // ---- goals ----
  goalStatus(): GoalState[] {
    return this.meadow.goals.map((g) => {
      if (g.kind === 'pop') return { label: `${g.n} chinchillas`, now: this.pop, need: g.n, done: this.pop >= g.n };
      if (g.kind === 'level') { const now = this.homesAtLeast(g.level); return { label: `${g.n} ${HOME_LEVELS[g.level - 1].name}s`, now, need: g.n, done: now >= g.n }; }
      if (g.kind === 'cosy') return { label: `cosiness ${g.n}`, now: this.cosiness, need: g.n, done: this.cosiness >= g.n };
      return { label: `${g.n} acorns in the purse`, now: this.purse, need: g.n, done: this.purse >= g.n };
    });
  }
  private checkGoals() {
    if (!this.meadow.goals.length) return;
    const st = this.goalStatus();
    st.forEach((g, i) => {
      if (!g.done) { this.goalsMet[i] = null; return; }
      if (this.goalsMet[i] === null) { this.goalsMet[i] = this.tick; this.ev('goal', { goal: i, label: g.label, msg: `Goal reached: ${g.label}!` }); }
    });
    if (this.won === null && st.every((g) => g.done)) {
      this.won = this.tick;
      const quick = this.tick <= this.meadow.years * YEAR;
      this.stars = 1 + (quick ? 1 : 0) + (quick && this.cosiness >= 80 ? 1 : 0);
      this.ev('won', { stars: this.stars, msg: `${this.meadow.name} is a real town now. Well done, everyone!` });
    }
  }

  // ---- saving ----
  toJSON(): SavedTown {
    return {
      v: 1, meadow: this.meadow.id, seed: this.seed, tick: this.tick, rs: this.rs, purse: this.purse, cosiness: this.cosiness, tax: this.tax, speed: this.speed,
      nextId: this.nextId, dryUntil: this.dryUntil, income: this.income, wages: this.wages,
      pop: this.pop, workforce: this.workforce, jobs: this.jobs, employed: this.employed, unemployed: this.unemployed,
      terrain: Array.from(this.terrain).join(''), road: Array.from(this.road).join(''), fence: Array.from(this.fence).join(''),
      buildings: [...this.buildings.values()].map((b) => ({ ...b, store: { ...b.store }, seen: { ...b.seen }, walked: this.walkedOf(b) })),
      walkers: this.walkers.map((w) => ({ ...w, load: { ...w.load } })), foxes: this.foxes.map((f) => ({ ...f })),
      trade: JSON.parse(JSON.stringify(this.trade)), routes: [...this.routes], traded: { ...this.traded }, goalsMet: [...this.goalsMet], won: this.won, stars: this.stars,
    };
  }
  private walkedOf(b: Building) {
    const m = this.memo.get(b.id);
    if (!m) return { ...b.walked };
    const out: Record<number, number> = {};
    for (let i = 0; i < m.length; i++) if (m[i] >= 0) out[i] = m[i];
    return out;
  }
  static fromJSON(o: SavedTown): PawhavenGame {
    if (!o || o.v !== 1 || !meadowById(o.meadow)) throw new Error('Not a Pawhaven town');
    const g = new PawhavenGame({ meadow: o.meadow, seed: o.seed }), N = g.size;
    const grid = (s: string, into: Uint8Array) => { if (typeof s !== 'string' || s.length !== N * N) throw new Error('Not a Pawhaven town'); for (let i = 0; i < N * N; i++) into[i] = s.charCodeAt(i) - 48; };
    grid(o.terrain, g.terrain); grid(o.road, g.road); grid(o.fence, g.fence);
    g.tick = o.tick; g.rs = o.rs >>> 0; g.purse = o.purse; g.cosiness = o.cosiness; g.tax = o.tax; g.speed = o.speed; g.nextId = o.nextId; g.dryUntil = o.dryUntil;
    g.income = o.income ?? 0; g.wages = o.wages ?? 0;
    g.pop = o.pop ?? 0; g.workforce = o.workforce ?? 0; g.jobs = o.jobs ?? 0; g.employed = o.employed ?? 0; g.unemployed = o.unemployed ?? 0;
    for (const b of o.buildings) {
      const s = BUILDINGS[b.kind]; if (!s) continue;
      const nb: Building = { ...blank(b.id, b.kind, b.x, b.y, b.size), ...b, store: { ...b.store }, seen: { ...b.seen }, walked: { ...b.walked } };
      g.buildings.set(nb.id, nb);
      for (let j = 0; j < nb.size; j++) for (let k = 0; k < nb.size; k++) g.occ[(nb.y + j) * N + nb.x + k] = nb.id;
    }
    g.walkers = o.walkers.map((w) => ({ ...w, load: { ...w.load } }));
    g.foxes = o.foxes.map((f) => ({ ...f }));
    g.trade = JSON.parse(JSON.stringify(o.trade ?? {})); g.routes = [...(o.routes ?? [])]; g.traded = { ...o.traded };
    g.goalsMet = g.meadow.goals.map((_, i) => o.goalsMet?.[i] ?? null); g.won = o.won ?? null; g.stars = o.stars ?? 0;
    g.roadVer++; g.buildVer++; g.foxVer++;
    return g;
  }
}

export type SavedTown = {
  v: 1; meadow: string; seed: number; tick: number; rs: number; purse: number; cosiness: number; tax: number; speed: number; nextId: number; dryUntil: number;
  income?: number; wages?: number; pop?: number; workforce?: number; jobs?: number; employed?: number; unemployed?: number;
  terrain: string; road: string; fence: string; buildings: Building[]; walkers: Walker[]; foxes: Fox[];
  trade: Partial<Record<Good, Trade>>; routes: string[]; traded: Record<string, number>; goalsMet: (number | null)[]; won: number | null; stars: number;
};

// ---- campaign progress ----
export type TownSlot = { meadow: string; seed: number; saved: number; state: SavedTown };
export type Profile = {
  /** How many campaign meadows are open (the free meadow is always open). */
  open: number;
  stars: Record<string, number>;
  /** Fewest years to finish each meadow. */
  best: Record<string, number>;
  towns: (TownSlot | null)[];
};

/** Reads saved progress, keeping only what makes sense and dropping the rest. */
export function readProfile(text: string | null): Profile {
  const p: Profile = { open: 1, stars: {}, best: {}, towns: [null, null, null] };
  try {
    const raw = text ? JSON.parse(text) : null;
    if (!raw || typeof raw !== 'object') return p;
    const ids = new Set(MEADOWS.map((m) => m.id)), campaign = MEADOWS.filter((m) => m.goals.length).length;
    if (Number.isInteger(raw.open) && raw.open >= 1) p.open = Math.min(campaign, raw.open);
    for (const [id, v] of Object.entries(raw.stars ?? {})) if (ids.has(id) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3) p.stars[id] = v as number;
    for (const [id, v] of Object.entries(raw.best ?? {})) if (ids.has(id) && typeof v === 'number' && v > 0 && v < 1000) p.best[id] = v;
    if (Array.isArray(raw.towns)) raw.towns.slice(0, MAX_TOWNS).forEach((t: unknown, i: number) => {
      const s = t as TownSlot | null;
      if (s && typeof s === 'object' && ids.has(s.meadow) && Number.isInteger(s.seed) && typeof s.saved === 'number' && s.state && typeof s.state === 'object'
        && s.state.v === 1 && s.state.meadow === s.meadow && typeof s.state.terrain === 'string' && Array.isArray(s.state.buildings)) p.towns[i] = s;
    });
  } catch { /* a broken save starts afresh */ }
  return p;
}
/** Records a finished meadow: its stars and years, and opens the next one. */
export function recordWin(p: Profile, g: PawhavenGame): Profile {
  if (g.won === null) return p;
  const id = g.meadow.id, years = Math.round((g.won / YEAR) * 10) / 10;
  p.stars[id] = Math.max(p.stars[id] ?? 0, g.stars);
  p.best[id] = Math.min(p.best[id] ?? Infinity, years);
  const campaign = MEADOWS.filter((m) => m.goals.length).length;
  if (g.meadow.goals.length) p.open = Math.min(campaign, Math.max(p.open, g.meadow.n + 1));
  return p;
}
/** Puts a town in a save slot (0 to 2). */
export function saveTown(p: Profile, slot: number, g: PawhavenGame, now = 0): Profile {
  if (slot >= 0 && slot < MAX_TOWNS) p.towns[slot] = { meadow: g.meadow.id, seed: g.seed, saved: now, state: g.toJSON() };
  return p;
}

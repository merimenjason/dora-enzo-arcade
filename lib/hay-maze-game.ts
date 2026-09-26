// Hay Maze Defence: an Emberward-style roguelite tower defence. Predators cross the meadow to snuff out the
// Hearthlight, the lantern that keeps Dora and Enzo's burrow warm, and always take the shortest open way there.
// You build the maze from hay-bale blocks drawn as cards (tetromino shapes you rotate and place), then put towers on
// top of the blocks (or on rocks). Towers have elements that react with each other, and a run is six levels on fresh
// maps with a reward to pick after each. Deterministic: every random choice comes from the run's seed.

export const COLS = 20, ROWS = 12;
export const LEVELS = 6, WAVES_PER_LEVEL = 5, START_FLAME = 20, LEVEL_HAY = 70, LEVEL_HAY_STEP = 30, SELL_BACK = 0.7;
export const HAND_MAX = 8, FIRST_DRAW = 7, DRAW_PER_WAVE = 3;
export const INF = 1 << 30;

/** mulberry32: small, fast and the same everywhere. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)];
function shuffle<T>(r: () => number, list: T[]) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// ---------- Cards: hay-bale blocks and a few handy items ----------

export type PieceId = 'mono' | 'duo' | 'tri' | 'vee' | 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';
export const PIECES: Record<PieceId, { name: string; cells: [number, number][] }> = {
  mono: { name: 'Single Bale', cells: [[0, 0]] },
  duo: { name: 'Double Bale', cells: [[0, 0], [1, 0]] },
  tri: { name: 'Bale Row', cells: [[0, 0], [1, 0], [2, 0]] },
  vee: { name: 'Bale Corner', cells: [[0, 0], [1, 0], [0, 1]] },
  I: { name: 'Long Wall', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  O: { name: 'Bale Stack', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { name: 'T-Bales', cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  L: { name: 'L-Bales', cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  J: { name: 'J-Bales', cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  S: { name: 'S-Bales', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { name: 'Z-Bales', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
};
export const PIECE_IDS = Object.keys(PIECES) as PieceId[];
export type ItemId = 'shovel' | 'bundle' | 'cocoa';
export const ITEMS: Record<ItemId, { name: string; blurb: string }> = {
  shovel: { name: 'Shovel', blurb: 'Dig up one bale with no tower on it.' },
  bundle: { name: 'Hay Bundle', blurb: '+25 hay, right now.' },
  cocoa: { name: 'Warm Cocoa', blurb: 'The Hearthlight burns 3 brighter.' },
};
export type CardId = PieceId | ItemId;
export const isPiece = (id: CardId): id is PieceId => id in PIECES;
export const cardName = (id: CardId) => (isPiece(id) ? PIECES[id].name : ITEMS[id].name);
export const START_DECK: CardId[] = ['I', 'O', 'T', 'L', 'J', 'S', 'Z', 'duo', 'vee', 'tri', 'shovel'];

/** A piece's cells after `rot` quarter turns clockwise, shifted so the smallest column and row are 0. */
export function shape(piece: PieceId, rot: number): [number, number][] {
  let cells = PIECES[piece].cells.map(([c, r]) => [c, r] as [number, number]);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cells = cells.map(([c, r]) => [-r, c]);
  const mc = Math.min(...cells.map(([c]) => c)), mr = Math.min(...cells.map(([, r]) => r));
  return cells.map(([c, r]) => [c - mc, r - mr]);
}
/** The tiles a piece covers when centred on tile (c, r). */
export function cellsAt(piece: PieceId, rot: number, c: number, r: number): [number, number][] {
  const cells = shape(piece, rot), w = Math.max(...cells.map(([x]) => x)), h = Math.max(...cells.map(([, y]) => y));
  const oc = c - Math.floor(w / 2), or = r - Math.floor(h / 2);
  return cells.map(([x, y]) => [oc + x, or + y]);
}

// ---------- Towers and elements ----------

export type Element = 'plain' | 'ice' | 'fire' | 'spark' | 'arcane' | 'earth' | 'sleep' | 'air';
export type TowerId = 'flicker' | 'frost' | 'roller' | 'brazier' | 'spark' | 'lantern' | 'bell' | 'glider';
export type Hits = 'ground' | 'air' | 'both';
export type Level = { dmg: number; range: number; rate: number; slow?: number; stun?: number; splash?: number; burn?: number; chains?: number };
export type TowerDef = {
  id: TowerId; name: string; element: Element; cost: number; upgrades: number[]; levels: Level[]; hits: Hits;
  kind: 'shot' | 'aura' | 'lob' | 'flame' | 'chain' | 'ring'; blurb: string;
};
export const TOWERS: Record<TowerId, TowerDef> = {
  flicker: { id: 'flicker', name: 'Pellet Flicker', element: 'plain', cost: 10, upgrades: [12, 22], hits: 'both', kind: 'shot',
    levels: [{ dmg: 9, range: 2.6, rate: 0.5 }, { dmg: 16, range: 2.8, rate: 0.45 }, { dmg: 28, range: 3.1, rate: 0.4 }],
    blurb: 'A kit with a slingshot. Quick, cheap, and hits flyers too.' },
  frost: { id: 'frost', name: 'Dora’s Frost Fan', element: 'ice', cost: 16, upgrades: [16, 28], hits: 'ground', kind: 'aura',
    levels: [{ dmg: 3, range: 1.7, rate: 0.5, slow: 0.35 }, { dmg: 5, range: 1.9, rate: 0.5, slow: 0.45 }, { dmg: 8, range: 2.1, rate: 0.5, slow: 0.55 }],
    blurb: 'Dora fans cold Andes air. Everything nearby is chilled and slows right down.' },
  roller: { id: 'roller', name: 'Enzo’s Boulder Roller', element: 'earth', cost: 22, upgrades: [22, 40], hits: 'ground', kind: 'lob',
    levels: [{ dmg: 28, range: 3, rate: 1.5, splash: 0.9 }, { dmg: 50, range: 3.2, rate: 1.4, splash: 1 }, { dmg: 85, range: 3.5, rate: 1.3, splash: 1.2 }],
    blurb: 'Enzo heaves boulders that crash into crowds on the ground.' },
  brazier: { id: 'brazier', name: 'Ember Brazier', element: 'fire', cost: 18, upgrades: [18, 32], hits: 'ground', kind: 'flame',
    levels: [{ dmg: 4, range: 1.6, rate: 0.6, burn: 6 }, { dmg: 7, range: 1.8, rate: 0.6, burn: 11 }, { dmg: 12, range: 2, rate: 0.6, burn: 18 }],
    blurb: 'Sets everything around it burning for three seconds. Burn ignores armour.' },
  spark: { id: 'spark', name: 'Spark Wheel', element: 'spark', cost: 24, upgrades: [22, 40], hits: 'both', kind: 'chain',
    levels: [{ dmg: 18, range: 2.6, rate: 1.1, chains: 3 }, { dmg: 32, range: 2.8, rate: 1, chains: 4 }, { dmg: 55, range: 3, rate: 0.9, chains: 5 }],
    blurb: 'A kit runs the wheel until the fur crackles, then zaps a chain of foes. Chilled foes shatter for double.' },
  lantern: { id: 'lantern', name: 'Moon Lantern', element: 'arcane', cost: 28, upgrades: [26, 45], hits: 'both', kind: 'shot',
    levels: [{ dmg: 24, range: 4, rate: 1.3 }, { dmg: 42, range: 4.4, rate: 1.2 }, { dmg: 72, range: 4.8, rate: 1.1 }],
    blurb: 'Long-range moonlight bolts that ignore armour. Burning foes flare up and scorch their neighbours.' },
  bell: { id: 'bell', name: 'Snooze Bell', element: 'sleep', cost: 30, upgrades: [25, 40], hits: 'both', kind: 'ring',
    levels: [{ dmg: 4, range: 1.9, rate: 3.2, stun: 0.6 }, { dmg: 8, range: 2.1, rate: 2.8, stun: 0.8 }, { dmg: 14, range: 2.3, rate: 2.4, stun: 1 }],
    blurb: 'Grandpa Pebble rings a lullaby. Everything nearby nods off where it stands.' },
  glider: { id: 'glider', name: 'Glider Nest', element: 'air', cost: 18, upgrades: [18, 32], hits: 'air', kind: 'shot',
    levels: [{ dmg: 32, range: 3.4, rate: 0.8 }, { dmg: 58, range: 3.7, rate: 0.75 }, { dmg: 100, range: 4, rate: 0.7 }],
    blurb: 'Sugar gliders launch at anything with wings. Ignores the ground.' },
};
export const TOWER_IDS = Object.keys(TOWERS) as TowerId[];
export const START_TOWERS: TowerId[] = ['flicker', 'frost', 'roller'];
/** Chilled foes take this much more from sparks; burning foes hit by moonlight splash this share on their neighbours. */
export const SHATTER = 2, FLARE = 0.5;

// ---------- Relics ----------

export type RelicId = 'mittens' | 'tinder' | 'static' | 'loft' | 'raisin' | 'lens' | 'map' | 'watch' | 'wax' | 'moth' | 'hearth' | 'bellows';
export const RELICS: Record<RelicId, { name: string; icon: string; blurb: string }> = {
  mittens: { name: 'Frost Mittens', icon: '🧤', blurb: 'Chill slows 10% more.' },
  tinder: { name: 'Tinderbox', icon: '🧰', blurb: 'Burns last twice as long and burn 50% hotter.' },
  static: { name: 'Static Fur', icon: '⚡', blurb: 'Spark Wheels chain to two more foes.' },
  loft: { name: 'Hay Loft', icon: '🌾', blurb: '+30 hay at the start of every level.' },
  raisin: { name: 'Lucky Raisin', icon: '🍇', blurb: 'Every foe caught pays 1 more hay.' },
  lens: { name: 'Crystal Lens', icon: '🔮', blurb: 'Every tower reaches half a tile further.' },
  map: { name: 'Old Map', icon: '🗺️', blurb: 'Draw one more card after every wave.' },
  watch: { name: 'Pocket Watch', icon: '⏱️', blurb: 'The Snooze Bell naps 0.4 s longer and rings sooner.' },
  wax: { name: 'Slingshot Wax', icon: '🕯️', blurb: 'Pellet Flickers shoot 30% faster.' },
  moth: { name: 'Glow Moth', icon: '🦋', blurb: 'Moon Lantern bolts hit 50% harder.' },
  hearth: { name: 'Hearthstone', icon: '🪨', blurb: 'The Hearthlight grows 6 bigger, and is topped up.' },
  bellows: { name: 'Bellows', icon: '🪗', blurb: 'Fire towers deal 30% more damage.' },
};
export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

// ---------- Predators ----------

export type EnemyId = 'weasel' | 'fox' | 'snake' | 'badger' | 'hawk' | 'lynx';
export type EnemyDef = { id: EnemyId; name: string; hp: number; speed: number; bounty: number; steal: number; armor: number; air: boolean; slowResist: number; stunResist: number; r: number };
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  weasel: { id: 'weasel', name: 'Weasel', hp: 28, speed: 1.7, bounty: 2, steal: 1, armor: 0, air: false, slowResist: 0, stunResist: 0, r: 0.28 },
  fox: { id: 'fox', name: 'Fox', hp: 55, speed: 1.15, bounty: 3, steal: 1, armor: 0, air: false, slowResist: 0, stunResist: 0, r: 0.32 },
  snake: { id: 'snake', name: 'Snake', hp: 85, speed: 0.85, bounty: 4, steal: 1, armor: 0, air: false, slowResist: 0.5, stunResist: 0, r: 0.3 },
  badger: { id: 'badger', name: 'Badger', hp: 120, speed: 0.7, bounty: 6, steal: 2, armor: 4, air: false, slowResist: 0, stunResist: 0, r: 0.36 },
  hawk: { id: 'hawk', name: 'Hawk', hp: 40, speed: 1.35, bounty: 4, steal: 1, armor: 0, air: true, slowResist: 0, stunResist: 0, r: 0.32 },
  lynx: { id: 'lynx', name: 'Lynx', hp: 700, speed: 0.75, bounty: 40, steal: 5, armor: 3, air: false, slowResist: 0.3, stunResist: 0.5, r: 0.42 },
};
/** Predators toughen over the run. Each level starts from scratch on a new map, so they toughen mostly within a
 * level and only a little from one level to the next: `g` is three per level plus the wave. */
export const toughness = (level: number, wave: number) => level * 3 + wave;
export const hpScale = (g: number) => 1 + 0.14 * g + 0.006 * g * g;

// ---------- Levels ----------

export type Region = { id: 'meadow' | 'canyon' | 'summit'; name: string };
export const REGIONS: Region[] = [{ id: 'meadow', name: 'Clover Meadow' }, { id: 'canyon', name: 'Cactus Canyon' }, { id: 'summit', name: 'Moonlit Summit' }];
export const regionOf = (level: number) => REGIONS[Math.min(REGIONS.length - 1, Math.floor(level / 2))];
const POOLS: EnemyId[][] = [['weasel', 'fox'], ['weasel', 'fox', 'hawk', 'snake'], ['fox', 'snake', 'badger', 'hawk'], ['snake', 'badger', 'hawk', 'weasel'], ['badger', 'hawk', 'snake', 'fox'], ['badger', 'hawk', 'snake', 'weasel', 'fox']];
const COST: Record<EnemyId, number> = { weasel: 0.6, fox: 1, snake: 1.4, badger: 2.4, hawk: 1.8, lynx: 12 };
const GAP: Record<EnemyId, number> = { weasel: 0.45, fox: 0.7, snake: 0.8, badger: 1.1, hawk: 0.7, lynx: 3 };
/** Wave strength in fox-sized predators. */
export const budget = (level: number, wave: number) => 5 + level * 2.5 + wave * 4.5;
/** Every second level ends with a lynx: the region's guardian. */
export const bossLevel = (level: number) => level % 2 === 1;

export type WavePlan = [EnemyId, number, number][];
export function planWaves(r: () => number, level: number): WavePlan[] {
  const out: WavePlan[] = [];
  for (let w = 0; w < WAVES_PER_LEVEL; w++) {
    const groups = w === 0 ? 1 : 2, plan: WavePlan = [];
    for (let i = 0; i < groups; i++) {
      // Each level opens with light predators on the ground, a wave to settle in before flyers and armour arrive.
      const kind = pick(r, w === 0 ? POOLS[level].filter((k) => k !== 'hawk' && k !== 'badger') : POOLS[level]);
      plan.push([kind, Math.max(2, Math.round(budget(level, w) / groups / COST[kind])), GAP[kind]]);
    }
    if (bossLevel(level) && w === WAVES_PER_LEVEL - 1) plan.push(['lynx', level === LEVELS - 1 ? 2 : 1, GAP.lynx]);
    out.push(plan);
  }
  return out;
}

export type Layout = { rocks: boolean[]; entrances: [number, number][]; exits: [number, number][] };
/** A fresh meadow: the Hearthlight on the right, one or two ways in, and rocks to build towers on. */
export function makeLayout(r: () => number, level: number): Layout {
  const rocks: boolean[] = Array.from({ length: COLS * ROWS }, () => false);
  const e = 3 + Math.floor(r() * 5), s = 2 + Math.floor(r() * 7);
  const exits: [number, number][] = [[COLS - 1, e], [COLS - 1, e + 1]];
  const entrances: [number, number][] = [[0, s], [0, s + 1]];
  if (level >= 4 || (level >= 2 && r() < 0.5)) { const t = 5 + Math.floor(r() * 8); entrances.push([t, 0], [t + 1, 0]); }
  const near = (c: number, rr: number) => [...entrances, ...exits].some(([x, y]) => Math.abs(x - c) <= 1 && Math.abs(y - rr) <= 1);
  const open = (layout: Layout) => { const d = field(layout, new Set()); return layout.entrances.every(([x, y]) => d[y * COLS + x] < INF); };
  const layout = { rocks, entrances, exits };
  for (let n = 0, tries = 0; n < 7 + level * 2 && tries < 400; tries++) {
    const c = 2 + Math.floor(r() * (COLS - 4)), rr = Math.floor(r() * ROWS), i = rr * COLS + c;
    if (rocks[i] || near(c, rr)) continue;
    rocks[i] = true;
    if (!open(layout)) { rocks[i] = false; continue; }
    n++;
  }
  return layout;
}

const DIRS: [number, number][] = [[1, 0], [0, -1], [0, 1], [-1, 0]];
const inGrid = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
/** Steps to the Hearthlight from every tile, round rocks and `blocked` tiles. */
export function field(layout: Layout, blocked: Set<number>) {
  const d = new Int32Array(COLS * ROWS).fill(INF), q: number[] = [];
  const open = (i: number) => !layout.rocks[i] && !blocked.has(i);
  for (const [c, r] of layout.exits) { const i = r * COLS + c; if (open(i)) { d[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], c = i % COLS, r = (i / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr, n = nr * COLS + nc;
      if (!inGrid(nc, nr) || d[n] !== INF || !open(n)) continue;
      d[n] = d[i] + 1; q.push(n);
    }
  }
  return d;
}

// ---------- The run ----------

export type Reward = { kind: 'relic'; relic: RelicId } | { kind: 'tower'; tower: TowerId } | { kind: 'cards'; cards: CardId[] } | { kind: 'heal'; amount: number };
export type RunState = 'battle' | 'reward' | 'won' | 'lost';

export class Run {
  seed: number;
  random: () => number;
  level = 0;
  flame = START_FLAME;
  maxFlame = START_FLAME;
  deck: CardId[] = [...START_DECK];
  unlocked: TowerId[] = [...START_TOWERS];
  relics: RelicId[] = [];
  state: RunState = 'battle';
  rewards: Reward[] = [];
  battle: Battle;
  kills = 0;
  waves = 0;

  constructor(seed = 1) {
    this.seed = seed;
    this.random = rng(seed);
    this.battle = new Battle(this, 0);
  }

  has(relic: RelicId) { return this.relics.includes(relic); }

  /** Called by the battle when its last wave is beaten. */
  cleared() {
    if (this.level >= LEVELS - 1) { this.state = 'won'; return; }
    this.rewards = this.offer();
    this.state = 'reward';
  }

  private offer(): Reward[] {
    const out: Reward[] = [], r = this.random;
    const locked = TOWER_IDS.filter((t) => !this.unlocked.includes(t));
    const relics = shuffle(r, RELIC_IDS.filter((x) => !this.relics.includes(x)));
    if (locked.length) out.push({ kind: 'tower', tower: pick(r, locked) });
    if (relics.length) out.push({ kind: 'relic', relic: relics.shift()! });
    if (this.flame <= this.maxFlame - 6) out.push({ kind: 'heal', amount: 8 });
    else out.push({ kind: 'cards', cards: [pick(r, PIECE_IDS), pick(r, PIECE_IDS), pick(r, ['bundle', 'cocoa', 'shovel'] as CardId[])] });
    while (out.length < 3 && relics.length) out.push({ kind: 'relic', relic: relics.shift()! });
    while (out.length < 3) out.push({ kind: 'heal', amount: 8 });
    return out;
  }

  choose(i: number) {
    const reward = this.rewards[i];
    if (this.state !== 'reward' || !reward) return false;
    if (reward.kind === 'relic') {
      this.relics.push(reward.relic);
      if (reward.relic === 'hearth') { this.maxFlame += 6; this.flame = this.maxFlame; }
    } else if (reward.kind === 'tower') this.unlocked.push(reward.tower);
    else if (reward.kind === 'cards') this.deck.push(...reward.cards);
    else this.flame = Math.min(this.maxFlame, this.flame + reward.amount);
    this.rewards = [];
    this.level++;
    this.battle = new Battle(this, this.level);
    this.state = 'battle';
    return true;
  }
}

// ---------- A battle: one level of the run ----------

export type Tower = { id: number; kind: TowerId; c: number; r: number; level: number; spent: number; cool: number; target: number | null; aim: number; flash: number };
export type Enemy = {
  id: number; kind: EnemyId; x: number; y: number; hp: number; maxHp: number; slow: number; slowT: number; stun: number;
  burn: number; burnT: number; progress: number; dir: [number, number]; face: 1 | -1; hit: number; entrance: number; bob: number;
};
export type Shot = { id: number; kind: 'pellet' | 'glider' | 'boulder' | 'moon'; x: number; y: number; sx: number; sy: number; tx: number; ty: number; target: number | null; speed: number; dmg: number; splash: number; hits: Hits; t: number; total: number };
export type Effect = { kind: 'chill' | 'ring' | 'boom' | 'hit' | 'leak' | 'coin' | 'flame' | 'zap' | 'flare' | 'place' | 'shatter'; x: number; y: number; r: number; t: number; max: number; value?: number; points?: [number, number][] };
export type GameEvent = { type: 'block' | 'build' | 'upgrade' | 'sell' | 'wave' | 'kill' | 'leak' | 'cleared' | 'lost' | 'card'; kind?: string; value?: number };
export type PlaceResult = 'ok' | 'phase' | 'taken' | 'blocked' | 'bounds' | 'card' | 'hay' | 'locked' | 'foundation' | 'state';
export type Phase = 'build' | 'wave' | 'cleared' | 'lost';

export class Battle {
  run: Run;
  level: number;
  region: Region;
  layout: Layout;
  /** Hay-bale blocks: 0 for none, otherwise the id of the piece they came from (for drawing joined outlines). */
  blocks: Int32Array = new Int32Array(COLS * ROWS);
  blockKind: (PieceId | null)[] = Array.from({ length: COLS * ROWS }, () => null);
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  queue: { kind: EnemyId; at: number; entrance: number }[] = [];
  plan: WavePlan[];
  hay: number;
  wave = 0;
  phase: Phase = 'build';
  paused = false;
  hand: CardId[] = [];
  drawPile: CardId[];
  discard: CardId[] = [];
  dist: Int32Array;
  time = 0;
  kills = 0;
  leaked = 0;
  private nextId = 1;
  private random: () => number;

  constructor(run: Run, level: number) {
    this.run = run;
    this.level = level;
    this.region = regionOf(level);
    this.random = rng(run.seed * 7919 + level * 104729 + 13);
    this.layout = makeLayout(this.random, level);
    this.plan = planWaves(this.random, level);
    this.hay = LEVEL_HAY + LEVEL_HAY_STEP * level + (run.has('loft') ? 30 : 0);
    this.drawPile = shuffle(this.random, [...run.deck]);
    this.draw(FIRST_DRAW);
    this.dist = this.field(null);
  }

  get entrances() { return this.layout.entrances; }
  get exits() { return this.layout.exits; }
  inGrid(c: number, r: number) { return inGrid(c, r); }
  rock(c: number, r: number) { return this.layout.rocks[r * COLS + c]; }
  block(c: number, r: number) { return this.blocks[r * COLS + c] !== 0; }
  towerAt(c: number, r: number) { return this.towers.find((t) => t.c === c && t.r === r) ?? null; }
  isEntrance(c: number, r: number) { return this.entrances.some(([x, y]) => x === c && y === r); }
  isExit(c: number, r: number) { return this.exits.some(([x, y]) => x === c && y === r); }
  /** Where the Hearthlight stands, just past the burrow door. */
  get hearth(): [number, number] { const rows = this.exits.map(([, r]) => r); return [COLS + 1, (Math.min(...rows) + Math.max(...rows)) / 2 + 0.5]; }

  field(extra: Set<number> | null) {
    const blocked = new Set<number>(extra ?? []);
    for (let i = 0; i < this.blocks.length; i++) if (this.blocks[i]) blocked.add(i);
    return field(this.layout, blocked);
  }
  /** The tile a ground predator on (c, r) heads for next, keeping its heading when two are equally good. */
  step(c: number, r: number, dir: [number, number], d = this.dist): [number, number] | null {
    let best: [number, number] | null = null, bestD = d[r * COLS + c];
    for (const [dc, dr] of [dir, ...DIRS]) {
      const nc = c + dc, nr = r + dr;
      if (!inGrid(nc, nr)) continue;
      const nd = d[nr * COLS + nc];
      if (nd < bestD) { best = [dc, dr]; bestD = nd; }
    }
    return best;
  }
  route(e: number, d = this.dist): [number, number][] {
    let [c, r] = this.entrances[e];
    const path: [number, number][] = [[c, r]];
    let dir: [number, number] = r === 0 && c > 0 ? [0, 1] : [1, 0];
    for (let guard = 0; guard < COLS * ROWS; guard++) {
      const s = this.step(c, r, dir, d);
      if (!s) break;
      dir = s; c += s[0]; r += s[1]; path.push([c, r]);
    }
    return path;
  }
  get walk() { return Math.max(...this.entrances.map(([c, r]) => this.dist[r * COLS + c])); }

  // ---------- Cards ----------

  draw(n: number) {
    for (let i = 0; i < n && this.hand.length < HAND_MAX; i++) {
      if (!this.drawPile.length) { if (!this.discard.length) return; this.drawPile = shuffle(this.random, this.discard); this.discard = []; }
      this.hand.push(this.drawPile.pop()!);
    }
  }

  /** Whether hay-bale piece `piece` fits centred on (c, r): open tiles, no predator in the way, and a way through left. */
  canPlace(piece: PieceId, rot: number, c: number, r: number): PlaceResult {
    if (this.phase !== 'build') return 'phase';
    const cells = cellsAt(piece, rot, c, r);
    if (cells.some(([x, y]) => !inGrid(x, y))) return 'bounds';
    if (cells.some(([x, y]) => this.rock(x, y) || this.block(x, y) || this.isEntrance(x, y) || this.isExit(x, y))) return 'taken';
    const d = this.field(new Set(cells.map(([x, y]) => y * COLS + x)));
    if (this.entrances.some(([x, y]) => d[y * COLS + x] >= INF)) return 'blocked';
    return 'ok';
  }
  /** The route field if `piece` were placed, for the preview. */
  preview(piece: PieceId, rot: number, c: number, r: number) { return this.field(new Set(cellsAt(piece, rot, c, r).map(([x, y]) => y * COLS + x))); }

  /** Plays hand card `slot`: a piece goes down centred on (c, r); the shovel digs up (c, r); other items just happen. */
  play(slot: number, c = 0, r = 0, rot = 0): PlaceResult {
    const id = this.hand[slot];
    if (!id) return 'card';
    if (this.phase === 'cleared' || this.phase === 'lost') return 'state';
    if (isPiece(id)) {
      const ok = this.canPlace(id, rot, c, r);
      if (ok !== 'ok') return ok;
      const group = this.nextId++;
      for (const [x, y] of cellsAt(id, rot, c, r)) { this.blocks[y * COLS + x] = group; this.blockKind[y * COLS + x] = id; }
      this.effects.push({ kind: 'place', x: c + 0.5, y: r + 0.5, r: 1.2, t: 0, max: 0.4 });
      this.dist = this.field(null);
      this.events.push({ type: 'block', kind: id });
    } else if (id === 'shovel') {
      if (this.phase !== 'build') return 'phase';
      if (!inGrid(c, r) || !this.block(c, r) || this.towerAt(c, r)) return 'foundation';
      this.blocks[r * COLS + c] = 0; this.blockKind[r * COLS + c] = null;
      this.dist = this.field(null);
    } else if (id === 'bundle') this.hay += 25;
    else this.run.flame = Math.min(this.run.maxFlame, this.run.flame + 3);
    this.hand.splice(slot, 1);
    this.discard.push(id);
    if (!isPiece(id)) this.events.push({ type: 'card', kind: id });
    return 'ok';
  }

  // ---------- Towers ----------

  canBuild(kind: TowerId, c: number, r: number): PlaceResult {
    if (this.phase === 'cleared' || this.phase === 'lost') return 'state';
    if (!this.run.unlocked.includes(kind)) return 'locked';
    if (!inGrid(c, r)) return 'bounds';
    if (!this.block(c, r) && !this.rock(c, r)) return 'foundation';
    if (this.towerAt(c, r)) return 'taken';
    if (this.hay < TOWERS[kind].cost) return 'hay';
    return 'ok';
  }
  build(kind: TowerId, c: number, r: number): PlaceResult {
    const ok = this.canBuild(kind, c, r);
    if (ok !== 'ok') return ok;
    this.hay -= TOWERS[kind].cost;
    this.towers.push({ id: this.nextId++, kind, c, r, level: 0, spent: TOWERS[kind].cost, cool: 0, target: null, aim: 0, flash: 0 });
    this.events.push({ type: 'build', kind });
    return 'ok';
  }
  upgradeCost(t: Tower) { return TOWERS[t.kind].upgrades[t.level] ?? null; }
  upgrade(t: Tower) {
    const cost = this.upgradeCost(t);
    if (cost === null || this.hay < cost || this.phase === 'cleared' || this.phase === 'lost') return false;
    this.hay -= cost; t.spent += cost; t.level++;
    this.effects.push({ kind: 'coin', x: t.c + 0.5, y: t.r + 0.5, r: 0.6, t: 0, max: 0.6 });
    this.events.push({ type: 'upgrade', kind: t.kind });
    return true;
  }
  refund(t: Tower) { return Math.floor(t.spent * SELL_BACK); }
  sell(t: Tower) {
    if (!this.towers.includes(t) || this.phase === 'cleared' || this.phase === 'lost') return false;
    this.hay += this.refund(t);
    this.towers = this.towers.filter((x) => x !== t);
    this.events.push({ type: 'sell', kind: t.kind });
    return true;
  }

  /** A tower's numbers with the run's relics applied. */
  stats(t: Tower | TowerId, level = 0): Level {
    const kind = typeof t === 'string' ? t : t.kind, lv = { ...TOWERS[kind].levels[typeof t === 'string' ? level : t.level] }, run = this.run;
    if (run.has('lens')) lv.range += 0.5;
    if (kind === 'flicker' && run.has('wax')) lv.rate *= 0.7;
    if (kind === 'brazier' && run.has('bellows')) { lv.dmg *= 1.3; lv.burn = (lv.burn ?? 0) * 1.3; }
    if (kind === 'brazier' && run.has('tinder')) lv.burn = (lv.burn ?? 0) * 1.5;
    if (kind === 'frost' && run.has('mittens')) lv.slow = (lv.slow ?? 0) + 0.1;
    if (kind === 'spark' && run.has('static')) lv.chains = (lv.chains ?? 0) + 2;
    if (kind === 'lantern' && run.has('moth')) lv.dmg *= 1.5;
    if (kind === 'bell' && run.has('watch')) { lv.stun = (lv.stun ?? 0) + 0.4; lv.rate *= 0.8; }
    return lv;
  }

  // ---------- Waves ----------

  sendWave() {
    if (this.phase !== 'build' || this.wave >= WAVES_PER_LEVEL) return false;
    this.wave++;
    this.phase = 'wave';
    let at = 0, n = 0;
    for (const [kind, count, gap] of this.plan[this.wave - 1]) {
      for (let i = 0; i < count; i++) { this.queue.push({ kind, at, entrance: n++ % this.spawnPoints() }); at += gap; }
      at += 1.5;
    }
    this.events.push({ type: 'wave', value: this.wave });
    return true;
  }
  /** Entrances come in pairs of tiles; predators alternate between the ways in. */
  private spawnPoints() { return this.entrances.length / 2; }
  pause() { if (this.phase === 'wave' || this.phase === 'build') this.paused = !this.paused; }

  private spawn(kind: EnemyId, way: number) {
    const def = ENEMIES[kind], entrance = way * 2 + (this.nextId % 2), [c, r] = this.entrances[entrance];
    const top = r === 0 && c > 0, hp = Math.round(def.hp * hpScale(toughness(this.level, this.wave - 1)));
    this.enemies.push({
      id: this.nextId++, kind, x: top ? c + 0.5 : c - 0.6, y: top ? r - 0.6 : r + 0.5, hp, maxHp: hp, slow: 0, slowT: 0, stun: 0, burn: 0, burnT: 0,
      progress: 0, dir: top ? [0, 1] : [1, 0], face: 1, hit: 0, entrance, bob: this.nextId * 0.7,
    });
  }

  update(dt: number) {
    if (this.paused || this.phase !== 'wave') { for (const f of this.effects) f.t += this.paused ? 0 : dt; this.effects = this.effects.filter((f) => f.t < f.max); return; }
    this.time += dt;
    for (const q of this.queue) q.at -= dt;
    while (this.queue.length && this.queue[0].at <= 0) { const q = this.queue.shift()!; this.spawn(q.kind, q.entrance); }
    for (const e of this.enemies) this.walk1(e, dt);
    for (const t of this.towers) this.fire(t, dt);
    this.fly(dt);
    for (const f of this.effects) f.t += dt;
    this.effects = this.effects.filter((f) => f.t < f.max);
    this.reap();
    if (this.run.flame <= 0) { this.run.flame = 0; this.phase = 'lost'; this.run.state = 'lost'; this.events.push({ type: 'lost' }); return; }
    if (!this.queue.length && !this.enemies.length) this.endWave();
  }

  private endWave() {
    this.run.waves++;
    this.hay += 6 + this.level;
    if (this.wave >= WAVES_PER_LEVEL) {
      this.phase = 'cleared';
      this.events.push({ type: 'cleared' });
      this.run.cleared();
      return;
    }
    this.phase = 'build';
    this.draw(DRAW_PER_WAVE + (this.run.has('map') ? 1 : 0));
  }

  private walk1(e: Enemy, dt: number) {
    const def = ENEMIES[e.kind];
    e.hit = Math.max(0, e.hit - dt);
    if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burn * dt; if (e.burnT <= 0) e.burn = 0; }
    if (e.stun > 0) { e.stun -= dt; return; }
    e.slowT -= dt;
    if (e.slowT <= 0) e.slow = 0;
    let budget = def.speed * (1 - e.slow * (1 - def.slowResist)) * dt;
    e.bob += budget * 6;
    for (let guard = 0; guard < 4 && budget > 1e-6; guard++) {
      let tx: number, ty: number;
      if (def.air) [tx, ty] = this.hearth;
      else {
        const c = Math.floor(e.x), r = Math.floor(e.y);
        if (!inGrid(c, r)) { if (c >= COLS) { [tx, ty] = this.hearth; } else { const [ec, er] = this.entrances[e.entrance]; tx = ec + 0.5; ty = er + 0.5; } }
        else if (this.isExit(c, r)) [tx, ty] = this.hearth;
        else {
          const s = this.step(c, r, e.dir);
          if (!s) return;
          e.dir = s; tx = c + s[0] + 0.5; ty = r + s[1] + 0.5;
        }
      }
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.02) e.face = dx > 0 ? 1 : -1;
      const move = Math.min(d, budget);
      if (d > 1e-6) { e.x += (dx / d) * move; e.y += (dy / d) * move; }
      e.progress += move; budget -= move;
      if (e.x >= COLS + 0.6) { this.leak(e); return; }
      if (move < 1e-6) break;
    }
  }

  private leak(e: Enemy) {
    const steal = ENEMIES[e.kind].steal;
    this.run.flame -= steal; this.leaked++;
    e.hp = -Infinity;
    this.effects.push({ kind: 'leak', x: COLS, y: this.hearth[1], r: 0.8, t: 0, max: 0.8, value: steal });
    this.events.push({ type: 'leak', kind: e.kind, value: steal });
  }

  canHit(hits: Hits, e: Enemy) { const air = ENEMIES[e.kind].air; return hits === 'both' || (hits === 'air' && air) || (hits === 'ground' && !air); }

  private fire(t: Tower, dt: number) {
    const def = TOWERS[t.kind], lv = this.stats(t), x = t.c + 0.5, y = t.r + 0.5;
    t.flash = Math.max(0, t.flash - dt);
    t.cool -= dt;
    if (t.cool > 0) return;
    const near = this.enemies.filter((e) => e.hp > 0 && e.x > -0.2 && e.y > -0.2 && this.canHit(def.hits, e) && Math.hypot(e.x - x, e.y - y) <= lv.range + ENEMIES[e.kind].r * 0.5);
    if (!near.length) { t.cool = 0; t.target = null; return; }
    t.cool = lv.rate; t.flash = 0.25;
    if (def.kind === 'aura') {
      this.effects.push({ kind: 'chill', x, y, r: lv.range, t: 0, max: 0.6 });
      for (const e of near) { this.hurt(e, lv.dmg); e.slow = Math.max(e.slow, Math.min(0.85, lv.slow ?? 0)); e.slowT = 0.9; }
      return;
    }
    if (def.kind === 'flame') {
      this.effects.push({ kind: 'flame', x, y, r: lv.range, t: 0, max: 0.5 });
      const long = this.run.has('tinder') ? 6 : 3;
      for (const e of near) { this.hurt(e, lv.dmg); e.burn = Math.max(e.burn, lv.burn ?? 0); e.burnT = long; }
      return;
    }
    if (def.kind === 'ring') {
      this.effects.push({ kind: 'ring', x, y, r: lv.range, t: 0, max: 0.7 });
      for (const e of near) { this.hurt(e, lv.dmg); e.stun = Math.max(e.stun, (lv.stun ?? 0) * (1 - ENEMIES[e.kind].stunResist)); }
      return;
    }
    const target = near.reduce((a, b) => (b.progress > a.progress ? b : a));
    t.target = target.id; t.aim = Math.atan2(target.y - y, target.x - x);
    if (def.kind === 'chain') {
      // Zap the lead foe, then jump to the nearest foe not yet hit, a little weaker each time.
      const hit: Enemy[] = [target], points: [number, number][] = [[x, y - 0.3], [target.x, target.y]];
      while (hit.length < (lv.chains ?? 1)) {
        const last = hit.at(-1)!;
        const next = this.enemies.filter((e) => e.hp > 0 && !hit.includes(e) && this.canHit(def.hits, e) && Math.hypot(e.x - last.x, e.y - last.y) <= 1.8)
          .sort((a, b) => Math.hypot(a.x - last.x, a.y - last.y) - Math.hypot(b.x - last.x, b.y - last.y))[0];
        if (!next) break;
        hit.push(next); points.push([next.x, next.y]);
      }
      hit.forEach((e, i) => {
        const chilled = e.slowT > 0 && e.slow > 0, dmg = lv.dmg * 0.8 ** i * (chilled ? SHATTER : 1);
        if (chilled) this.effects.push({ kind: 'shatter', x: e.x, y: e.y, r: 0.5, t: 0, max: 0.4 });
        this.hurt(e, dmg);
      });
      this.effects.push({ kind: 'zap', x, y, r: 0, t: 0, max: 0.25, points });
      return;
    }
    if (def.kind === 'lob') {
      const d = Math.hypot(target.x - x, target.y - y), total = 0.25 + d / 5;
      const lead = ENEMIES[target.kind].speed * (1 - target.slow) * total * (target.stun > 0 ? 0 : 1);
      const tx = target.x + target.dir[0] * lead * 0.7, ty = target.y + target.dir[1] * lead * 0.7;
      this.shots.push({ id: this.nextId++, kind: 'boulder', x, y, sx: x, sy: y, tx, ty, target: null, speed: 0, dmg: lv.dmg, splash: lv.splash ?? 0.8, hits: def.hits, t: 0, total });
      return;
    }
    const kind = t.kind === 'glider' ? 'glider' : t.kind === 'lantern' ? 'moon' : 'pellet';
    this.shots.push({ id: this.nextId++, kind, x, y, sx: x, sy: y, tx: target.x, ty: target.y, target: target.id, speed: kind === 'glider' ? 8 : kind === 'moon' ? 7 : 10, dmg: lv.dmg, splash: 0, hits: def.hits, t: 0, total: 0 });
  }

  private fly(dt: number) {
    for (const s of this.shots) {
      s.t += dt;
      if (s.kind === 'boulder') {
        const p = Math.min(1, s.t / s.total);
        s.x = s.sx + (s.tx - s.sx) * p; s.y = s.sy + (s.ty - s.sy) * p;
        if (p < 1) continue;
        this.effects.push({ kind: 'boom', x: s.tx, y: s.ty, r: s.splash, t: 0, max: 0.45 });
        for (const e of this.enemies) if (e.hp > 0 && this.canHit(s.hits, e) && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash + ENEMIES[e.kind].r) this.hurt(e, s.dmg);
        s.total = -1;
        continue;
      }
      const target = this.enemies.find((e) => e.id === s.target && e.hp > 0);
      if (target) { s.tx = target.x; s.ty = target.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = s.speed * dt;
      if (d > step + 0.05) { s.x += (dx / d) * step; s.y += (dy / d) * step; continue; }
      if (target) {
        if (s.kind === 'moon') {
          // Moonlight ignores armour, and a burning foe flares up and scorches its neighbours.
          this.hurt(target, s.dmg, true);
          if (target.burnT > 0) {
            this.effects.push({ kind: 'flare', x: target.x, y: target.y, r: 1, t: 0, max: 0.5 });
            for (const e of this.enemies) if (e !== target && e.hp > 0 && Math.hypot(e.x - target.x, e.y - target.y) <= 1 + ENEMIES[e.kind].r) this.hurt(e, s.dmg * FLARE, true);
          }
        } else this.hurt(target, s.dmg);
        this.effects.push({ kind: 'hit', x: s.tx, y: s.ty, r: 0.25, t: 0, max: 0.2 });
      }
      s.total = -1;
    }
    this.shots = this.shots.filter((s) => s.total !== -1);
  }

  hurt(e: Enemy, dmg: number, pierce = false) {
    if (e.hp <= 0 || dmg <= 0) return;
    e.hp -= pierce ? dmg : Math.max(1, dmg - ENEMIES[e.kind].armor);
    e.hit = 0.12;
  }

  private reap() {
    const gone = this.enemies.filter((e) => e.hp <= 0);
    if (!gone.length) return;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const e of gone) {
      if (e.hp === -Infinity) continue;
      const bounty = ENEMIES[e.kind].bounty + (this.run.has('raisin') ? 1 : 0);
      this.hay += bounty; this.kills++; this.run.kills++;
      this.effects.push({ kind: 'coin', x: e.x, y: e.y, r: 0.5, t: 0, max: 0.8, value: bounty });
      this.events.push({ type: 'kill', kind: e.kind, value: bounty });
    }
  }
}

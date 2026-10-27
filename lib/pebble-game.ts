// Pebble Pop's rules: a brick-breaker roguelite. Dora or Enzo hold a hay-bale paddle and bounce a pebble into walls of
// blocks along a branching map of fifteen steps through four places, picking upgrades as they go. Deterministic and
// DOM-free: every random choice comes from a seeded generator and the physics runs in fixed 1/120 s steps with swept
// collisions, so a seed and the same inputs replay a run exactly. Drawing lives in pebble-scene.ts.

// ---------------------------------------------------------------- the field
/** The playfield in its own units; the scene scales it to the screen. */
export const W = 360, H = 540;
/** The top of the hay bale. */
export const PADDLE_Y = 500;
export const PADDLE_H = 14;
/** Physics steps per second. */
export const HZ = 120;
export const DT = 1 / HZ;
/** The pebble's radius before any Snowball growth. */
export const R = 5;
/** Block grid: 11 columns of 32 x 16 cells, each block 30 x 14, starting below the top margin. */
export const COLS = 11, CELL_W = 32, CELL_H = 16, BLOCK_W = 30, BLOCK_H = 14, GRID_X = 5, GRID_Y = 56;
/** Pebble speed in units per second: 2% faster each step of the map, and ramping the longer a serve lasts (0.8% a second, at most 50% faster). */
export const SPEED = { base: 320, perStep: 0.02, ramp: 0.008, rampMax: 0.5 };
/** How far off vertical the pebble leaves the bale at its very edge. */
export const MAX_ANGLE = (62 * Math.PI) / 180;
/** How fast the bale moves: following the pointer, and under the keys. */
export const PADDLE_SPEED = { pointer: 2000, keys: 640 };
export const LIVES = { start: 3, cap: 6 };
export const STEPS = 15;
export const BOSS_STEPS = [5, 10, 15];

// ---------------------------------------------------------------- characters
export type Char = 'dora' | 'enzo';
export const CHARS: Record<Char, { name: string; width: number; speed: number; spin: boolean; blurb: string }> = {
  dora: { name: 'Dora', width: 84, speed: 0.92, spin: false, blurb: 'A wide, gentle bale and a slightly calmer pebble. Lovely for learning the angles.' },
  enzo: { name: 'Enzo', width: 64, speed: 1, spin: true, blurb: 'A narrow bale, but hold to charge a spin shot: the pebble curves and hits harder.' },
};
/** Enzo's spin: seconds to charge fully, the least charge that counts, the sideways pull at full charge, and how fast the curve fades. */
export const SPIN = { charge: 0.8, min: 0.25, pull: 560, fade: 0.9 };

// ---------------------------------------------------------------- places and blocks
export type Place = 'meadow' | 'creek' | 'frosty' | 'barn';
export const PLACES: Record<Place, { name: string; steps: [number, number]; sky: string }> = {
  meadow: { name: 'The Meadow', steps: [1, 4], sky: '#bfe6f5' },
  creek: { name: 'Pebble Creek', steps: [5, 8], sky: '#a8dce0' },
  frosty: { name: 'Frosty Ridge', steps: [9, 12], sky: '#d9e8f5' },
  barn: { name: 'Badger Barn', steps: [13, 15], sky: '#f2d3a8' },
};
export const placeOf = (step: number): Place => (step <= 4 ? 'meadow' : step <= 8 ? 'creek' : step <= 12 ? 'frosty' : 'barn');

export type BlockType = 'crate' | 'stout' | 'acorn' | 'ice' | 'dust' | 'moss' | 'chain' | 'slide';
export const BLOCKS: Record<BlockType, { name: string; hp: number; points: number; needed: boolean; soft?: boolean }> = {
  crate: { name: 'Crate', hp: 1, points: 10, needed: true },
  stout: { name: 'Stout crate', hp: 2, points: 20, needed: true },
  acorn: { name: 'Acorn pile', hp: 1, points: 15, needed: true },
  ice: { name: 'Ice block', hp: 2, points: 20, needed: true },
  dust: { name: 'Dust cloud', hp: 1, points: 5, needed: true, soft: true },
  moss: { name: 'Moss', hp: 1, points: 5, needed: false },
  chain: { name: 'Chain block', hp: 1, points: 15, needed: true },
  slide: { name: 'Sliding crate', hp: 1, points: 15, needed: true },
};
/** Acorns that tumble out of an acorn pile, how fast they fall, and how long moss takes to grow back. */
export const ACORN_PILE = 3, ACORN_FALL = 150, MOSS_REGROW = 7;
/** A dust cloud slows the pebble to this share of its speed; it recovers at 35% a second. */
export const DUST_SLOW = 0.7;
/** Chain blocks pop their eight neighbours this long after they go. */
export const CHAIN_DELAY = 0.07;
/** After this many seconds without touching a needed block, the pebble starts drifting towards the last ones. */
export const HELP_AFTER = 15;

export type Block = {
  id: number; type: BlockType; col: number; row: number;
  x: number; y: number; ox: number; w: number; h: number;
  hp: number; max: number; alive: boolean;
  /** Sliding blocks sway this far either side; boss blocks move with the boss. */
  amp: number; phase: number; boss: boolean;
  /** When the block was last hit (wall clock), for the flash, and when moss grows back. */
  hitAt: number; regrowAt: number;
};
export type Ball = {
  id: number; x: number; y: number; vx: number; vy: number; r: number;
  /** Held on the bale: a new serve (heldFor 0) or caught by Sticky Paws (heldFor counts up), at `hold` from its centre. */
  held: boolean; hold: number; heldFor: number;
  snow: number; pierce: number; spin: number; spinAge: number; slow: number;
};
export type Drop = { x: number; y: number; vx: number; n: number };
export type Boss = {
  name: string; who: 'crow' | 'badger'; hp: number; max: number;
  x: number; y: number; w: number; h: number; cx: number; amp: number; speed: number;
  rebuild: number; nextRebuild: number; hitAt: number;
};
export type Wall = {
  step: number; kind: NodeKind; place: Place;
  blocks: Block[]; balls: Ball[]; drops: Drop[]; boss: Boss | null;
  clock: number; serveClock: number; lastNeeded: number;
  combo: number; bestCombo: number; hits: number; shield: number;
  /** Delayed pops from chains, sparks and bursts: [time, block id, damage, cause]. */
  queue: [number, number, number, 'chain' | 'spark' | 'burst'][];
  paddle: { x: number; w: number; vx: number };
  charge: number; cleared: boolean; nextBall: number; whisper: boolean;
};

// ---------------------------------------------------------------- upgrades
export type UpId = 'split' | 'burr' | 'snowball' | 'magnet' | 'shield' | 'wide' | 'sticky' | 'spark' | 'clover' | 'snack' | 'breeze' | 'pinecone' | 'comet';
export type Rarity = 'common' | 'uncommon' | 'rare';
export const UPGRADES: Record<UpId, { name: string; icon: string; rarity: Rarity; max: number; text: string }> = {
  split: { name: 'Split Pebble', icon: '🪨', rarity: 'common', max: 3, text: 'Each serve splits into 2 extra pebbles (+1 more per extra stack).' },
  burr: { name: 'Burr Ball', icon: '🌰', rarity: 'uncommon', max: 3, text: 'Pierces through 2 blocks it pops (+2 per stack), refilled on every bale touch.' },
  snowball: { name: 'Snowball', icon: '☃️', rarity: 'uncommon', max: 2, text: 'The pebble grows with every hit and hits harder once it is big.' },
  magnet: { name: 'Acorn Magnet', icon: '🧲', rarity: 'common', max: 2, text: 'Falling acorns drift to your bale, and acorn piles drop 1 more.' },
  shield: { name: 'Dust Up Shield', icon: '🛡️', rarity: 'common', max: 3, text: 'A puff of dust bounces the pebble off the floor once per wall (+1 per stack).' },
  wide: { name: 'Wide Bale', icon: '🌾', rarity: 'common', max: 3, text: 'The hay bale grows 14 wider.' },
  sticky: { name: 'Sticky Paws', icon: '🍯', rarity: 'uncommon', max: 1, text: 'Catch the pebble on the bale, slide to aim, then launch it (it lets go by itself after 2 s).' },
  spark: { name: 'Spark', icon: '✨', rarity: 'uncommon', max: 3, text: 'Every block you pop sends a spark to the nearest block (+1 spark per stack).' },
  clover: { name: 'Lucky Clover', icon: '🍀', rarity: 'common', max: 2, text: 'Half again as many acorns for clearing walls and for combos.' },
  snack: { name: 'Hay Snack', icon: '🥕', rarity: 'uncommon', max: 2, text: 'One more pebble to lose, and one back right now.' },
  breeze: { name: 'Lazy Breeze', icon: '🍃', rarity: 'common', max: 2, text: 'The pebble rolls 8% slower.' },
  pinecone: { name: 'Pinecone Pop', icon: '🌲', rarity: 'rare', max: 2, text: 'Every 8th block hit bursts the blocks around it (every 6th with two).' },
  comet: { name: 'Comet Tail', icon: '☄️', rarity: 'rare', max: 1, text: 'With a combo of 5 or more, every hit does 1 more.' },
};
export const UP_IDS = Object.keys(UPGRADES) as UpId[];
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, uncommon: 3, rare: 1.4 };
export const PRICE: Record<Rarity, number> = { common: 28, uncommon: 42, rare: 60 };
export const HEAL_PRICE = 20;
/** Pairs that do more together. */
export const SYNERGIES: { id: SynergyId; name: string; needs: UpId[]; char?: Char; text: string }[] = [
  { id: 'flurry', name: 'Snow Flurry', needs: ['snowball', 'split'], text: 'Split pebbles start half grown.' },
  { id: 'thorn', name: 'Thorn Sparks', needs: ['spark', 'burr'], text: 'Sparks hit twice as hard.' },
  { id: 'harvest', name: 'Golden Harvest', needs: ['magnet', 'clover'], text: 'Every acorn you catch counts double.' },
  { id: 'spincatch', name: 'Spin Catch', needs: ['sticky'], char: 'enzo', text: 'Enzo’s caught pebbles leave with a full spin.' },
];
export type SynergyId = 'flurry' | 'thorn' | 'harvest' | 'spincatch';

// ---------------------------------------------------------------- the map
export type NodeKind = 'wall' | 'elite' | 'shop' | 'rest' | 'boss';
export type MapNode = { id: number; step: number; lane: number; kind: NodeKind; next: number[] };
export const BOSSES: Record<number, { name: string; who: 'crow' | 'badger'; hp: number; amp: number; speed: number; rebuild: number; rows: BlockType[] }> = {
  5: { name: 'Captain Caw', who: 'crow', hp: 12, amp: 50, speed: 0.55, rebuild: 9, rows: ['crate', 'crate'] },
  10: { name: 'Frostwhisker', who: 'badger', hp: 18, amp: 60, speed: 0.6, rebuild: 8, rows: ['ice', 'crate', 'ice'] },
  15: { name: 'Big Bramble', who: 'badger', hp: 26, amp: 70, speed: 0.7, rebuild: 7, rows: ['stout', 'chain', 'crate'] },
};
/** Acorns for clearing a wall: a base plus a little per step. */
export const REWARD: Record<'wall' | 'elite' | 'boss', [number, number]> = { wall: [6, 1], elite: [14, 2], boss: [25, 1] };

// ---------------------------------------------------------------- randomness
/** mulberry32 with its state on show, so a run can be saved and picked up again. */
export class Rng {
  constructor(public s: number) { this.s = s >>> 0; }
  next() { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n: number) { return Math.floor(this.next() * n); }
  pick<T>(a: readonly T[]) { return a[this.int(a.length)]; }
  weighted<T>(items: readonly T[], weight: (t: T) => number) {
    const total = items.reduce((s, t) => s + weight(t), 0); let r = this.next() * total;
    for (const t of items) { r -= weight(t); if (r < 0) return t; }
    return items[items.length - 1];
  }
}
export const hash = (...n: number[]) => { let h = 2166136261; for (const x of n) { h ^= x >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13; } return h >>> 0; };

/** The run's map: fifteen steps, three lanes each except the first step and the boss steps, every path connected. */
export function makeMap(seed: number): MapNode[] {
  const r = new Rng(hash(seed, 77)), nodes: MapNode[] = [], rows: MapNode[][] = [];
  for (let step = 1; step <= STEPS; step++) {
    const single = step === 1 || BOSS_STEPS.includes(step), fixed = [4, 6, 9, 11, 14].includes(step), row: MapNode[] = [];
    for (let lane = 0; lane < (single ? 1 : 3); lane++) {
      let kind: NodeKind;
      if (BOSS_STEPS.includes(step)) kind = 'boss';
      else if (step === 1) kind = 'wall';
      // just before each boss: a rest, a shop and an elite, in a shuffled order
      else if (step === 4 || step === 9 || step === 14) kind = (['rest', 'shop', 'elite'] as NodeKind[])[(lane + step) % 3];
      // just after a boss: a shop in the middle
      else if (step === 6 || step === 11) kind = lane === 1 ? 'shop' : 'wall';
      else kind = r.weighted<NodeKind>(step < 3 ? ['wall'] : ['wall', 'elite', 'shop', 'rest'], (k) => ({ wall: 6, elite: 2.2, shop: 1.2, rest: 1, boss: 0 })[k]);
      const n: MapNode = { id: nodes.length, step, lane: single ? 1 : lane, kind, next: [] };
      nodes.push(n); row.push(n);
    }
    // never two shops or two rests side by side on an ordinary step
    if (!single && !fixed) for (const k of ['shop', 'rest'] as NodeKind[]) row.filter((n) => n.kind === k).slice(1).forEach((n) => (n.kind = 'wall'));
    rows.push(row);
  }
  for (let i = 0; i < rows.length - 1; i++) for (const n of rows[i]) for (const m of rows[i + 1]) if (rows[i].length === 1 || rows[i + 1].length === 1 || Math.abs(m.lane - n.lane) <= 1) n.next.push(m.id);
  return nodes;
}

// ---------------------------------------------------------------- walls
export const SHAPES = ['full', 'checker', 'diamond', 'arches', 'stripes', 'pyramid', 'window', 'zigzag'] as const;
/** Which blocks each place likes, as weights. */
const MIX: Record<Place, Partial<Record<BlockType, number>>> = {
  meadow: { crate: 10, acorn: 2, dust: 2, moss: 1.5, chain: 0.6 },
  creek: { crate: 8, acorn: 2, dust: 1.5, moss: 1.5, chain: 1.3, stout: 1 },
  frosty: { crate: 6, ice: 5, acorn: 2, dust: 1, moss: 1, chain: 1.2, stout: 1.2 },
  barn: { crate: 5, stout: 4, ice: 2, acorn: 2, dust: 1, moss: 1.2, chain: 1.6 },
};

function shapeHas(shape: (typeof SHAPES)[number], c: number, r: number, rows: number) {
  const m = Math.abs(c - 5); // distance from the middle column, so every shape is mirrored
  switch (shape) {
    case 'full': return true;
    case 'checker': return (c + r) % 2 === 0 || r === 0;
    case 'diamond': return m + Math.abs(r - (rows - 1) / 2) * 1.2 <= 5.6;
    case 'arches': return r < 2 || m % 4 !== 2;
    case 'stripes': return r % 2 === 0 || m <= 1 || m >= 5;
    case 'pyramid': return m <= rows - r + 1;
    case 'window': return r === 0 || r === rows - 1 || m >= 4 || m === 0 || r === Math.floor(rows / 2);
    case 'zigzag': return (m + r) % 4 !== 3;
  }
}
/** How many rows a wall has: more the further you go, two more on an elite, at most 12. */
export const wallRows = (step: number, elite: boolean) => Math.min(12, 4 + Math.floor(step * 0.45) + (elite ? 2 : 0));

/** Builds the wall for a map node. Its own generator, so the choices you make along the way never change a wall. */
export function makeWall(seed: number, node: MapNode, ups: Partial<Record<UpId, number>>, char: Char): Wall {
  const r = new Rng(hash(seed, node.id, node.step)), place = placeOf(node.step), blocks: Block[] = [];
  const elite = node.kind === 'elite', isBoss = node.kind === 'boss';
  const add = (type: BlockType, col: number, row: number, amp = 0, boss = false) => {
    const hp = BLOCKS[type].hp + (elite && (type === 'crate' || type === 'slide') && r.next() < 0.3 ? 1 : 0);
    const x = GRID_X + col * CELL_W, y = GRID_Y + row * CELL_H;
    blocks.push({ id: blocks.length, type, col, row, x, y, ox: x, w: BLOCK_W, h: BLOCK_H, hp, max: hp, alive: true, amp, phase: r.next() * Math.PI * 2, boss, hitAt: -9, regrowAt: 0 });
  };
  let boss: Boss | null = null;
  if (isBoss) {
    const b = BOSSES[node.step], bw = 120, bh = 50;
    boss = { name: b.name, who: b.who, hp: b.hp, max: b.hp, x: W / 2 - bw / 2, y: 30, w: bw, h: bh, cx: W / 2, amp: b.amp, speed: b.speed, rebuild: b.rebuild, nextRebuild: b.rebuild, hitAt: -9 };
    // the boss carries rows of blocks below it, five columns wide, so it can sway without squeezing a pebble
    b.rows.forEach((type, i) => { for (let c = 3; c <= 7; c++) add(type, c, 2 + i, 0, true); });
    // and a row of ordinary blocks lower down to work through
    for (let c = 0; c < COLS; c += 2) add(r.next() < 0.25 ? 'acorn' : r.next() < 0.3 ? 'moss' : 'crate', c, 7);
  } else {
    const shape = r.pick(SHAPES), rows = wallRows(node.step, elite);
    const mix = { ...MIX[place] }; if (elite) { mix.stout = (mix.stout ?? 0) + 3; mix.chain = (mix.chain ?? 0) + 1; }
    const types = Object.keys(mix) as BlockType[];
    // a sliding row from Pebble Creek on: crates three cells apart that sway a cell either side, on a row of their own
    const slideRow = node.step >= 5 && r.next() < (elite ? 0.8 : 0.5) ? 1 + r.int(rows - 1) : -1;
    for (let row = 0; row < rows; row++) {
      if (row === slideRow) { const start = 1 + r.int(2); for (let c = start; c < COLS - 1; c += 3) add('slide', c, row, CELL_W); continue; }
      const half: (BlockType | null)[] = [];
      for (let c = 0; c <= 5; c++) half.push(shapeHas(shape, c, row, rows) ? r.weighted(types, (t) => mix[t] ?? 0) : null);
      for (let c = 0; c < COLS; c++) { const t = half[c <= 5 ? c : 10 - c]; if (t) add(t, c, row); }
    }
    // never a wall with too little to clear
    if (blocks.filter((b) => BLOCKS[b.type].needed).length < 10) for (let c = 0; c < COLS; c++) add('crate', c, rows);
  }
  const w = CHARS[char].width + 14 * (ups.wide ?? 0);
  return {
    step: node.step, kind: node.kind, place, blocks, balls: [], drops: [], boss,
    clock: 0, serveClock: 0, lastNeeded: 0, combo: 0, bestCombo: 0, hits: 0, shield: ups.shield ?? 0, queue: [],
    paddle: { x: W / 2, w, vx: 0 }, charge: 0, cleared: false, nextBall: 0, whisper: false,
  };
}

// ---------------------------------------------------------------- events for the scene and sounds
export type HitCause = 'pebble' | 'chain' | 'spark' | 'burst';
export type PebbleEvent =
  | { k: 'hit'; x: number; y: number; type: BlockType; combo: number; popped: boolean; cause: HitCause }
  | { k: 'crack'; x: number; y: number }
  | { k: 'chain'; x: number; y: number }
  | { k: 'paddle'; x: number; y: number; off: number; spin: number }
  | { k: 'bounce'; x: number; y: number }
  | { k: 'dust'; x: number; y: number }
  | { k: 'drop'; x: number; y: number; n: number }
  | { k: 'acorn'; x: number; y: number; n: number }
  | { k: 'spark'; x1: number; y1: number; x2: number; y2: number }
  | { k: 'burst'; x: number; y: number }
  | { k: 'shield'; x: number }
  | { k: 'lost'; x: number; lives: number }
  | { k: 'serve' }
  | { k: 'launch'; n: number }
  | { k: 'catch'; x: number }
  | { k: 'combo'; n: number; acorns: number }
  | { k: 'boss'; x: number; y: number; hp: number }
  | { k: 'rebuild'; n: number }
  | { k: 'regrow'; x: number; y: number }
  | { k: 'whisper' }
  | { k: 'clear'; boss: boolean; acorns: number };

export type Phase = 'map' | 'wall' | 'reward' | 'shop' | 'rest' | 'won' | 'lost';
export type ShopItem = { kind: 'up'; id: UpId; price: number; sold: boolean } | { kind: 'heal'; price: number; sold: boolean };
/** The player's controls for one step: a key axis (-1 to 1), or a pointer target x in field units; and Enzo's charge. */
export type Input = { axis: number; target: number | null; charge: boolean };
export const NO_INPUT: Input = { axis: 0, target: null, charge: false };

/** A saved run in progress: enough to rebuild it on the map. */
export type RunSave = { v: 1; seed: number; char: Char; rng: number; at: number; lives: number; maxLives: number; acorns: number; score: number; ups: Partial<Record<UpId, number>>; walls: number; bestCombo: number; blocks: number };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class PebbleGame {
  readonly map: MapNode[];
  readonly rng: Rng;
  phase: Phase = 'map';
  /** The node you are on; -1 before the first step. */
  at = -1;
  lives = LIVES.start;
  maxLives = LIVES.start;
  acorns = 0;
  score = 0;
  ups: Partial<Record<UpId, number>> = {};
  wall: Wall | null = null;
  offer: UpId[] = [];
  shop: ShopItem[] = [];
  rerolls = 0;
  events: PebbleEvent[] = [];
  input: Input = { ...NO_INPUT };
  /** Run totals for the results screen. */
  walls = 0; bestCombo = 0; blocks = 0;
  constructor(readonly seed: number, readonly char: Char, save?: RunSave) {
    this.map = makeMap(seed);
    this.rng = new Rng(hash(seed, 1));
    if (save) {
      this.rng.s = save.rng >>> 0; this.at = save.at; this.lives = save.lives; this.maxLives = save.maxLives; this.acorns = save.acorns;
      this.score = save.score; this.ups = { ...save.ups }; this.walls = save.walls; this.bestCombo = save.bestCombo; this.blocks = save.blocks;
    }
  }
  /** The run so far, for saving between steps (only on the map). */
  snapshot(): RunSave | null {
    if (this.phase !== 'map') return null;
    return { v: 1, seed: this.seed, char: this.char, rng: this.rng.s, at: this.at, lives: this.lives, maxLives: this.maxLives, acorns: this.acorns, score: this.score, ups: { ...this.ups }, walls: this.walls, bestCombo: this.bestCombo, blocks: this.blocks };
  }
  get node() { return this.at >= 0 ? this.map[this.at] : null; }
  /** How far the run has got: the step of the node you are on. */
  get step() { return this.node?.step ?? 0; }
  get place(): Place { return placeOf(Math.max(1, this.step)); }
  has(id: UpId) { return this.ups[id] ?? 0; }
  synergy(id: SynergyId) {
    const s = SYNERGIES.find((x) => x.id === id)!;
    return s.needs.every((u) => this.has(u) > 0) && (!s.char || s.char === this.char);
  }
  get synergies() { return SYNERGIES.filter((s) => this.synergy(s.id)); }
  /** The nodes you can go to next. */
  choices(): MapNode[] {
    if (this.phase !== 'map') return [];
    return this.at < 0 ? this.map.filter((n) => n.step === 1) : this.map[this.at].next.map((i) => this.map[i]);
  }
  go(id: number) {
    const n = this.choices().find((x) => x.id === id); if (!n) return false;
    this.at = id;
    if (n.kind === 'shop') { this.phase = 'shop'; this.rerolls = 0; this.stock(); }
    else if (n.kind === 'rest') this.phase = 'rest';
    else { this.phase = 'wall'; this.wall = makeWall(this.seed, n, this.ups, this.char); this.serve(); }
    return true;
  }

  // ---------------------------------------------------------------- upgrades, shop and rest
  canTake(id: UpId) { return this.has(id) < UPGRADES[id].max; }
  /** Draws `n` different upgrades you can still take; elites and bosses lean towards the rarer ones. */
  private draw(n: number, rareBoost: number) {
    const out: UpId[] = [];
    for (let i = 0; i < n; i++) {
      const pool = UP_IDS.filter((id) => this.canTake(id) && !out.includes(id)); if (!pool.length) break;
      out.push(this.rng.weighted(pool, (id) => RARITY_WEIGHT[UPGRADES[id].rarity] * (UPGRADES[id].rarity === 'common' ? 1 : rareBoost)));
    }
    return out;
  }
  take(id: UpId) {
    if (!this.canTake(id)) return false;
    this.ups[id] = this.has(id) + 1;
    if (id === 'snack') { this.maxLives = Math.min(LIVES.cap, this.maxLives + 1); this.lives = Math.min(this.maxLives, this.lives + 1); }
    return true;
  }
  /** Picks one of the three after a wall. */
  pick(i: number) {
    if (this.phase !== 'reward' || !this.offer[i]) return false;
    this.take(this.offer[i]); this.offer = []; this.afterNode(); return true;
  }
  /** Leaves the upgrades for 5 acorns instead. */
  skip() { if (this.phase !== 'reward') return false; this.acorns += 5; this.offer = []; this.afterNode(); return true; }
  private stock() {
    this.shop = this.draw(3, 1.3).map((id) => ({ kind: 'up' as const, id, price: PRICE[UPGRADES[id].rarity], sold: false }));
    this.shop.push({ kind: 'heal', price: HEAL_PRICE, sold: false });
  }
  get rerollPrice() { return 8 + this.rerolls * 6; }
  buy(i: number) {
    const it = this.shop[i]; if (this.phase !== 'shop' || !it || it.sold || this.acorns < it.price) return false;
    if (it.kind === 'heal') { if (this.lives >= this.maxLives) return false; this.lives++; }
    else if (!this.take(it.id)) return false;
    this.acorns -= it.price; it.sold = true; return true;
  }
  reroll() {
    if (this.phase !== 'shop' || this.acorns < this.rerollPrice) return false;
    this.acorns -= this.rerollPrice; this.rerolls++;
    const heal = this.shop.find((s) => s.kind === 'heal')!; this.stock(); this.shop[this.shop.length - 1] = heal; return true;
  }
  /** A nap fills every pebble back up (or finds 10 acorns if you are already full); a snack adds one more pebble. */
  rest(choice: 'nap' | 'snack') {
    if (this.phase !== 'rest') return false;
    if (choice === 'nap') { if (this.lives >= this.maxLives) this.acorns += 10; this.lives = this.maxLives; }
    else { if (this.maxLives >= LIVES.cap) return false; this.maxLives++; this.lives++; }
    this.afterNode(); return true;
  }
  leave() { if (this.phase !== 'shop') return false; this.afterNode(); return true; }
  private afterNode() {
    this.wall = null;
    this.phase = this.step >= STEPS ? 'won' : 'map';
  }

  // ---------------------------------------------------------------- the wall
  private newBall(held: boolean): Ball {
    const w = this.wall!;
    return { id: w.nextBall++, x: w.paddle.x, y: PADDLE_Y - R - 0.5, vx: 0, vy: 0, r: R, held, hold: 0, heldFor: 0, snow: 0, pierce: 2 * this.has('burr'), spin: 0, spinAge: 9, slow: 1 };
  }
  private serve() {
    const w = this.wall!; w.balls = [this.newBall(true)]; w.combo = 0; w.serveClock = 0; this.events.push({ k: 'serve' });
  }
  /** The speed a pebble wants right now. */
  speed() {
    const w = this.wall; const ramp = w ? Math.min(SPEED.rampMax, w.serveClock * SPEED.ramp) : 0;
    return SPEED.base * (1 + SPEED.perStep * ((w?.step ?? 1) - 1)) * CHARS[this.char].speed * (1 - 0.08 * this.has('breeze')) * (1 + ramp);
  }
  /** Sends every held pebble off the bale; a fresh serve splits if you have Split Pebble. */
  launch() {
    const w = this.wall; if (this.phase !== 'wall' || !w) return false;
    const held = w.balls.filter((b) => b.held); if (!held.length) return false;
    const fresh = w.balls.length === 1 && held[0].heldFor === 0;
    let n = 0;
    for (const b of held) {
      const off = b.hold === 0 && b.heldFor === 0 ? (w.paddle.vx < -1 ? -0.18 : 0.18) : clamp(b.hold / (w.paddle.w / 2), -1, 1);
      this.release(b, off); n++;
      if (fresh && this.has('split')) {
        const extra = 1 + this.has('split'), half = this.synergy('flurry') ? 1.25 * this.has('snowball') : 0;
        for (let k = 0; k < extra; k++) {
          const nb = this.newBall(false), a = off * MAX_ANGLE + (k % 2 ? 1 : -1) * (0.28 + 0.2 * Math.floor(k / 2)), s = this.speed();
          nb.vx = Math.sin(a) * s; nb.vy = -Math.cos(a) * s; nb.snow = half; nb.r = R + half; nb.x = b.x; nb.y = b.y; w.balls.push(nb); n++;
        }
      }
    }
    this.events.push({ k: 'launch', n });
    return true;
  }
  private release(b: Ball, off: number) {
    const w = this.wall!, a = clamp(off, -1, 1) * MAX_ANGLE, s = this.speed(), caught = b.heldFor > 0;
    b.held = false; b.heldFor = 0; b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; b.y = PADDLE_Y - b.r - 0.5;
    if (CHARS[this.char].spin && w.charge >= SPIN.min) { b.spin = w.charge * (w.paddle.vx < -1 ? -1 : w.paddle.vx > 1 ? 1 : -Math.sign(off || 1)); b.spinAge = 0; }
    else if (caught && this.synergy('spincatch')) { b.spin = -Math.sign(off || 1); b.spinAge = 0; }
    w.charge = 0;
  }
  /** How hard a pebble hits: 1, plus Snowball size, a live spin, and Comet Tail on a combo. */
  damageOf(b: Ball | null) {
    const w = this.wall!; let d = 1;
    if (b) { if (b.snow >= 2.5) d += Math.floor(b.snow / 2.5); if (Math.abs(b.spin) * Math.exp(-b.spinAge / SPIN.fade) > 0.3) d++; }
    if (this.has('comet') && w.combo >= 5) d++;
    return d;
  }
  private center(k: Block) { return { x: k.x + k.w / 2, y: k.y + k.h / 2 }; }
  /** Hits a block for `dmg`; returns true if it popped. */
  private hitBlock(k: Block, dmg: number, cause: HitCause, ball: Ball | null) {
    const w = this.wall!; if (!k.alive) return false;
    const c = this.center(k); k.hitAt = w.clock; k.hp -= dmg;
    // on a boss wall only the boss itself counts, so a long rally against its rows still brings help
    if (BLOCKS[k.type].needed && !w.boss) w.lastNeeded = w.clock;
    if (cause === 'pebble') {
      w.combo++; w.hits++; w.bestCombo = Math.max(w.bestCombo, w.combo);
      if (w.combo % 10 === 0) { const n = Math.round(2 * (1 + 0.5 * this.has('clover'))); this.acorns += n; this.events.push({ k: 'combo', n: w.combo, acorns: n }); }
      if (ball && this.has('snowball')) { ball.snow = Math.min(2.5 * this.has('snowball'), ball.snow + 0.5); ball.r = R + ball.snow; }
      const every = this.has('pinecone') ? 10 - 2 * this.has('pinecone') : 0;
      if (every && w.hits % every === 0) {
        this.events.push({ k: 'burst', x: c.x, y: c.y });
        for (const o of w.blocks) if (o !== k && o.alive && Math.hypot(this.center(o).x - c.x, this.center(o).y - c.y) < 40) w.queue.push([w.clock + 0.05, o.id, 1, 'burst']);
      }
    }
    const popped = k.hp <= 0;
    this.score += BLOCKS[k.type].points * (cause === 'pebble' ? 1 + Math.floor(w.combo / 5) : 1);
    this.events.push({ k: 'hit', x: c.x, y: c.y, type: k.type, combo: w.combo, popped, cause });
    if (!popped) { if (k.type === 'ice') this.events.push({ k: 'crack', x: c.x, y: c.y }); return false; }
    k.alive = false; this.blocks++;
    if (k.type === 'moss') k.regrowAt = w.clock + MOSS_REGROW;
    if (k.type === 'acorn') {
      const n = ACORN_PILE + this.has('magnet');
      for (let i = 0; i < n; i++) w.drops.push({ x: c.x + (i - (n - 1) / 2) * 7, y: c.y, vx: (i - (n - 1) / 2) * 10, n: 1 });
      this.events.push({ k: 'drop', x: c.x, y: c.y, n });
    }
    if (k.type === 'chain') {
      this.events.push({ k: 'chain', x: c.x, y: c.y });
      for (const o of w.blocks) if (o.alive && o !== k && o.boss === k.boss && Math.abs(o.col - k.col) <= 1 && Math.abs(o.row - k.row) <= 1) w.queue.push([w.clock + CHAIN_DELAY, o.id, 1, 'chain']);
    }
    if (cause !== 'spark' && this.has('spark')) {
      const taken = new Set<number>(), dmg2 = this.synergy('thorn') ? 2 : 1;
      for (let s = 0; s < this.has('spark'); s++) {
        let best: Block | null = null, bd = Infinity;
        for (const o of w.blocks) { if (!o.alive || taken.has(o.id) || !BLOCKS[o.type].needed) continue; const oc = this.center(o), d = Math.hypot(oc.x - c.x, oc.y - c.y); if (d < bd) { bd = d; best = o; } }
        if (!best) break;
        taken.add(best.id); const bc = this.center(best);
        this.events.push({ k: 'spark', x1: c.x, y1: c.y, x2: bc.x, y2: bc.y }); w.queue.push([w.clock + 0.08, best.id, dmg2, 'spark']);
      }
    }
    return true;
  }
  private hitBoss(b: Ball) {
    const w = this.wall!, B = w.boss!, dmg = this.damageOf(b);
    B.hp = Math.max(0, B.hp - dmg); B.hitAt = w.clock; w.lastNeeded = w.clock;
    w.combo++; w.hits++; w.bestCombo = Math.max(w.bestCombo, w.combo); this.score += 50 * dmg;
    this.events.push({ k: 'boss', x: B.x + B.w / 2, y: B.y + B.h / 2, hp: B.hp });
  }
  /** Blocks (or the boss) still to clear. */
  needed() { const w = this.wall; if (!w) return 0; return w.boss ? (w.boss.hp > 0 ? 1 : 0) : w.blocks.reduce((n, k) => n + (k.alive && BLOCKS[k.type].needed ? 1 : 0), 0); }

  /** One fixed physics step of the wall, using `this.input`. */
  update() {
    const w = this.wall; if (this.phase !== 'wall' || !w || w.cleared) return;
    w.clock += DT; w.serveClock += DT;
    const inp = this.input, P = w.paddle, half = P.w / 2;
    // the bale
    const before = P.x;
    if (inp.target !== null) { const d = clamp(inp.target, half, W - half) - P.x, m = PADDLE_SPEED.pointer * DT; P.x += clamp(d, -m, m); }
    else P.x += clamp(inp.axis, -1, 1) * PADDLE_SPEED.keys * DT;
    P.x = clamp(P.x, half, W - half); P.vx = (P.x - before) / DT;
    // Enzo's charge builds while held and is spent on the next touch; letting go early loses it
    if (CHARS[this.char].spin) w.charge = inp.charge ? Math.min(1, w.charge + DT / SPIN.charge) : 0;
    // the boss sways, and every few seconds fills its lowest gap back in
    if (w.boss && w.boss.hp > 0) {
      const B = w.boss, dx = Math.sin(w.clock * B.speed) * B.amp; B.x = B.cx + dx - B.w / 2;
      for (const k of w.blocks) if (k.boss) k.x = k.ox + dx;
      // (it stops rebuilding while the pebble is stuck, so help can get through)
      if (w.clock >= B.nextRebuild && !this.stuck) {
        B.nextRebuild = w.clock + B.rebuild;
        const gaps = w.blocks.filter((k) => k.boss && !k.alive);
        if (gaps.length) {
          const row = Math.max(...gaps.map((k) => k.row)); let n = 0;
          for (const k of gaps) if (k.row === row && !w.balls.some((b) => this.overlaps(b, k))) { k.alive = true; k.hp = k.max; n++; }
          if (n) this.events.push({ k: 'rebuild', n });
        }
      }
    }
    for (const k of w.blocks) {
      if (k.amp) k.x = k.ox + Math.sin(w.clock * 1.1 + k.phase) * k.amp;
      if (!k.alive && k.type === 'moss' && k.regrowAt && w.clock >= k.regrowAt && !this.stuck) {
        if (w.balls.some((b) => this.overlaps(b, k))) k.regrowAt = w.clock + 0.5;
        else { k.alive = true; k.hp = k.max; k.regrowAt = 0; this.events.push({ k: 'regrow', x: k.x + k.w / 2, y: k.y + k.h / 2 }); }
      }
    }
    // delayed pops from chains, sparks and bursts
    if (w.queue.length) {
      const due = w.queue.filter((q) => q[0] <= w.clock); w.queue = w.queue.filter((q) => q[0] > w.clock);
      for (const [, id, dmg, cause] of due) this.hitBlock(w.blocks[id], dmg, cause, null);
    }
    // the pebbles
    for (const b of w.balls) {
      if (b.held) {
        b.x = clamp(P.x + b.hold, b.r, W - b.r); b.y = PADDLE_Y - b.r - 0.5;
        if (b.heldFor > 0) { b.heldFor += DT; if (b.heldFor > 2) this.release(b, clamp(b.hold / half, -1, 1)); }
        continue;
      }
      this.move(b);
    }
    // pebbles that rolled away
    const lost = w.balls.filter((b) => b.y - b.r > H);
    if (lost.length) {
      w.balls = w.balls.filter((b) => b.y - b.r <= H);
      if (!w.balls.length) {
        this.lives--; this.events.push({ k: 'lost', x: lost[0].x, lives: this.lives });
        if (this.lives <= 0) { this.phase = 'lost'; this.bestCombo = Math.max(this.bestCombo, w.bestCombo); return; }
        this.serve();
      }
    }
    // acorns falling
    for (const d of w.drops) {
      if (this.has('magnet')) d.vx = clamp((P.x - d.x) * 3, -200 * this.has('magnet'), 200 * this.has('magnet'));
      d.x = clamp(d.x + d.vx * DT, 4, W - 4); const py = d.y; d.y += ACORN_FALL * DT;
      if (py < PADDLE_Y && d.y >= PADDLE_Y && Math.abs(d.x - P.x) <= half + 6) d.n = -d.n;
    }
    const caught = w.drops.filter((d) => d.n < 0);
    if (caught.length) { const n = caught.length * (this.synergy('harvest') ? 2 : 1); this.acorns += n; this.events.push({ k: 'acorn', x: P.x, y: PADDLE_Y, n }); }
    w.drops = w.drops.filter((d) => d.n > 0 && d.y < H + 10);
    if (this.needed() === 0) this.clear();
  }
  private overlaps(b: Ball, k: Block) {
    const nx = clamp(b.x, k.x, k.x + k.w), ny = clamp(b.y, k.y, k.y + k.h);
    return (b.x - nx) ** 2 + (b.y - ny) ** 2 < b.r * b.r;
  }
  /** Moves one pebble through a step, stopping at each surface it meets on the way (so it never skips through a block). */
  private move(b: Ball) {
    const w = this.wall!, P = w.paddle;
    // speed: the ramp, dust slowdown, and Enzo's curve
    b.slow = Math.min(1, b.slow + DT * 0.35);
    if (b.spin) { b.spinAge += DT; const s = b.spin * Math.exp(-b.spinAge / SPIN.fade); b.vx += s * SPIN.pull * DT; if (Math.abs(s) < 0.02) b.spin = 0; }
    const sp = this.speed() * b.slow, cur = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / cur) * sp; b.vy = (b.vy / cur) * sp;
    // something moved into the pebble (a sliding crate, the boss's rows, moss growing back): push it out
    for (const k of w.blocks) if (k.alive && !this.soft(k) && this.overlaps(b, k)) this.pushOut(b, k);
    if (w.boss && w.boss.hp > 0) { const B = w.boss; if (b.x > B.x - b.r && b.x < B.x + B.w + b.r && b.y > B.y - b.r && b.y < B.y + B.h + b.r) { b.y = B.y + B.h + b.r; if (b.vy < 0) b.vy = -b.vy; this.hitBoss(b); } }
    let rem = 1;
    for (let iter = 0; iter < 8 && rem > 1e-6; iter++) {
      const dx = b.vx * DT * rem, dy = b.vy * DT * rem;
      let t = Infinity, what: 'left' | 'right' | 'top' | 'floor' | 'paddle' | 'block' | 'boss' | null = null, hit: Block | null = null, axis: 'x' | 'y' = 'x';
      if (dx < 0) { const tt = (b.r - b.x) / dx; if (tt >= 0 && tt < t) { t = tt; what = 'left'; } }
      if (dx > 0) { const tt = (W - b.r - b.x) / dx; if (tt >= 0 && tt < t) { t = tt; what = 'right'; } }
      if (dy < 0) { const tt = (b.r - b.y) / dy; if (tt >= 0 && tt < t) { t = tt; what = 'top'; } }
      if (dy > 0 && w.shield > 0) { const tt = (H - b.r - b.y) / dy; if (tt >= 0 && tt < t) { t = tt; what = 'floor'; } }
      if (dy > 0 && b.y <= PADDLE_Y - b.r + 0.5) {
        const tt = Math.max(0, (PADDLE_Y - b.r - b.y) / dy);
        if (tt < t && Math.abs(b.x + dx * tt - P.x) <= P.w / 2 + b.r * 0.8) { t = tt; what = 'paddle'; }
      }
      for (const k of w.blocks) {
        if (!k.alive || this.soft(k)) continue;
        const s = slab(b.x, b.y, dx, dy, k.x - b.r, k.y - b.r, k.x + k.w + b.r, k.y + k.h + b.r);
        if (s && s[0] < t) { t = s[0]; what = 'block'; hit = k; axis = s[1]; }
      }
      if (w.boss && w.boss.hp > 0) { const B = w.boss, s = slab(b.x, b.y, dx, dy, B.x - b.r, B.y - b.r, B.x + B.w + b.r, B.y + B.h + b.r); if (s && s[0] < t) { t = s[0]; what = 'boss'; axis = s[1]; hit = null; } }
      if (!what || t > 1) { b.x += dx; b.y += dy; this.dust(b); break; }
      b.x += dx * t; b.y += dy * t; rem *= 1 - t; this.dust(b);
      switch (what) {
        case 'left': b.vx = Math.abs(b.vx); this.bounced(b); break;
        case 'right': b.vx = -Math.abs(b.vx); this.bounced(b); break;
        case 'top': b.vy = Math.abs(b.vy); this.bounced(b); break;
        case 'floor': b.vy = -Math.abs(b.vy); w.shield--; this.events.push({ k: 'shield', x: b.x }); break;
        case 'paddle': this.onPaddle(b); if (b.held) rem = 0; break;
        case 'boss': if (axis === 'x') b.vx = -b.vx; else b.vy = -b.vy; this.steep(b); this.hitBoss(b); break;
        case 'block': {
          const popped = this.hitBlock(hit!, this.damageOf(b), 'pebble', b);
          if (popped && b.pierce > 0) { b.pierce--; break; }
          if (axis === 'x') b.vx = -b.vx; else b.vy = -b.vy;
          this.steep(b); break;
        }
      }
    }
  }
  /** Keeps the pebble from flying almost flat (at least 28% of its speed goes up or down). */
  private steep(b: Ball) {
    const s = Math.hypot(b.vx, b.vy), minVy = s * 0.28;
    if (Math.abs(b.vy) < minVy) { const sy = b.vy < 0 || (b.vy === 0 && b.y > H / 2) ? -1 : 1; b.vy = sy * minVy; b.vx = Math.sign(b.vx || 1) * Math.sqrt(s * s - minVy * minVy); }
  }
  private bounced(b: Ball) {
    const w = this.wall!; this.steep(b); this.events.push({ k: 'bounce', x: b.x, y: b.y });
    if (w.clock - w.lastNeeded > HELP_AFTER) this.help(b);
  }
  /** When nothing needed has been touched for a while, turns the pebble a little towards the nearest needed block. */
  private help(b: Ball) {
    const w = this.wall!; let tx = 0, ty = 0, bd = Infinity;
    if (w.boss && w.boss.hp > 0) { tx = w.boss.x + w.boss.w / 2; ty = w.boss.y + w.boss.h / 2; bd = 0; }
    else for (const k of w.blocks) if (k.alive && BLOCKS[k.type].needed) { const c = this.center(k), d = Math.hypot(c.x - b.x, c.y - b.y); if (d < bd) { bd = d; tx = c.x; ty = c.y; } }
    if (bd === Infinity) return;
    if (!w.whisper) { w.whisper = true; this.events.push({ k: 'whisper' }); }
    const s = Math.hypot(b.vx, b.vy), a = Math.atan2(ty - b.y, tx - b.x), cur = Math.atan2(b.vy, b.vx);
    let d = a - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    // a turn that would leave it flying flat is skipped: the next bounce (or the bale) gets another go
    const na = cur + clamp(d, -0.6, 0.6); if (Math.abs(Math.sin(na)) < 0.3) return;
    b.vx = Math.cos(na) * s; b.vy = Math.sin(na) * s;
  }
  private onPaddle(b: Ball) {
    const w = this.wall!, P = w.paddle, off = clamp((b.x - P.x) / (P.w / 2), -1, 1);
    b.pierce = 2 * this.has('burr'); w.combo = 0;
    this.events.push({ k: 'paddle', x: b.x, y: PADDLE_Y, off, spin: CHARS[this.char].spin ? w.charge : 0 });
    if (this.has('sticky')) { b.held = true; b.hold = b.x - P.x; b.heldFor = DT; b.vx = 0; b.vy = 0; b.y = PADDLE_Y - b.r - 0.5; this.events.push({ k: 'catch', x: b.x }); return; }
    this.release(b, off);
    if (w.clock - w.lastNeeded > HELP_AFTER) this.help(b);
  }
  private pushOut(b: Ball, k: Block) {
    const l = b.x + b.r - k.x, r = k.x + k.w - (b.x - b.r), t = b.y + b.r - k.y, d = k.y + k.h - (b.y - b.r), m = Math.min(l, r, t, d);
    if (m === l) { b.x -= l; if (b.vx > 0) b.vx = -b.vx; } else if (m === r) { b.x += r; if (b.vx < 0) b.vx = -b.vx; }
    else if (m === t) { b.y -= t; if (b.vy > 0) b.vy = -b.vy; } else { b.y += d; if (b.vy < 0) b.vy = -b.vy; }
    b.x = clamp(b.x, b.r, W - b.r);
    this.hitBlock(k, this.damageOf(b), 'pebble', b);
  }
  /** True once nothing needed has been touched for HELP_AFTER seconds: the pebble then drifts to the last blocks, and moss lets it through. */
  get stuck() { const w = this.wall; return !!w && w.clock - w.lastNeeded > HELP_AFTER; }
  /** Blocks the pebble rolls through: dust clouds always, and moss while it is stuck. */
  private soft(k: Block) { return !!BLOCKS[k.type].soft || (k.type === 'moss' && this.stuck); }
  /** Dust clouds are soft: the pebble rolls through, slows down and poofs them. */
  private dust(b: Ball) {
    const w = this.wall!;
    for (const k of w.blocks) if (k.alive && this.soft(k) && this.overlaps(b, k)) {
      if (k.type === 'dust') { b.slow = DUST_SLOW; this.events.push({ k: 'dust', x: k.x + k.w / 2, y: k.y + k.h / 2 }); }
      this.hitBlock(k, 1, 'pebble', b);
    }
  }
  private clear() {
    const w = this.wall!; w.cleared = true;
    for (const k of w.blocks) if (k.alive && k.boss) k.alive = false;
    // acorns still falling are caught for you
    const falling = w.drops.length; w.drops = [];
    const [base, per] = REWARD[w.kind === 'elite' ? 'elite' : w.kind === 'boss' ? 'boss' : 'wall'];
    const n = Math.round((base + per * w.step) * (1 + 0.5 * this.has('clover'))) + falling;
    this.acorns += n; this.walls++; this.bestCombo = Math.max(this.bestCombo, w.bestCombo); this.score += 100 * w.step;
    this.events.push({ k: 'clear', boss: !!w.boss, acorns: n });
    if (w.kind === 'boss' && this.lives < this.maxLives) this.lives++;
    if (w.step >= STEPS) { this.phase = 'won'; return; }
    this.phase = 'reward';
    this.offer = this.draw(3, w.kind === 'boss' ? 3 : w.kind === 'elite' ? 2.2 : 1);
    if (!this.offer.length) this.afterNode();
  }
  /** For tests and the browser check: pops every block (the wall clears on the next step). */
  popAll() { const w = this.wall; if (!w) return; for (const k of w.blocks) if (k.alive) { k.alive = false; k.regrowAt = 0; } if (w.boss) w.boss.hp = 0; }
}

/** Ray from (x, y) along (dx, dy) against a box: the entry time in [0, 1] and the face's axis, or null. */
export function slab(x: number, y: number, dx: number, dy: number, x0: number, y0: number, x1: number, y1: number): [number, 'x' | 'y'] | null {
  let tmin = -Infinity, tmax = Infinity, axis: 'x' | 'y' = 'x';
  if (dx === 0) { if (x <= x0 || x >= x1) return null; } else {
    let a = (x0 - x) / dx, b = (x1 - x) / dx; if (a > b) [a, b] = [b, a];
    if (a > tmin) { tmin = a; axis = 'x'; } tmax = Math.min(tmax, b);
  }
  if (dy === 0) { if (y <= y0 || y >= y1) return null; } else {
    let a = (y0 - y) / dy, b = (y1 - y) / dy; if (a > b) [a, b] = [b, a];
    if (a > tmin) { tmin = a; axis = 'y'; } tmax = Math.min(tmax, b);
  }
  if (tmin > tmax || tmin < 0 || tmin > 1) return null;
  return [tmin, axis];
}

/** Where a pebble moving freely would cross the bale's line, folding off the side walls and the top (blocks ignored). */
export function landing(b: { x: number; y: number; vx: number; vy: number; r: number }): { x: number; t: number } {
  let { x, y, vy } = b; const { vx, r } = b; let t = 0;
  if (vy < 0) { const tt = (y - r) / -vy; t += tt; x += vx * tt; y = r; vy = -vy; }
  if (vy <= 0) return { x: b.x, t: 0 };
  const tt = Math.max(0, (PADDLE_Y - r - y) / vy); t += tt; x += vx * tt;
  const span = W - 2 * r; let u = (x - r) % (2 * span); if (u < 0) u += 2 * span;
  return { x: r + (u > span ? 2 * span - u : u), t };
}

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'pebble-pop-v1';
export type Profile = {
  bestFloor: number; bestScore: number; runs: number;
  wins: Record<Char, number>; discovered: UpId[]; char: Char;
  settings: { sound: boolean; shake: boolean };
  run: RunSave | null;
};
export const freshProfile = (): Profile => ({ bestFloor: 0, bestScore: 0, runs: 0, wins: { dora: 0, enzo: 0 }, discovered: [], char: 'dora', settings: { sound: true, shake: true }, run: null });
const isChar = (c: unknown): c is Char => c === 'dora' || c === 'enzo';
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo);
function readRun(o: unknown): RunSave | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Partial<RunSave>;
  if (r.v !== 1 || !isChar(r.char) || typeof r.seed !== 'number' || typeof r.rng !== 'number') return null;
  const map = makeMap(r.seed); if (typeof r.at !== 'number' || !Number.isInteger(r.at) || r.at < 0 || r.at >= map.length || map[r.at].step >= STEPS) return null;
  const ups: Partial<Record<UpId, number>> = {};
  if (r.ups && typeof r.ups === 'object') for (const [k, v] of Object.entries(r.ups)) if (k in UPGRADES) { const n = num(v, 0, UPGRADES[k as UpId].max); if (n) ups[k as UpId] = n; }
  const maxLives = num(r.maxLives, 1, LIVES.cap), lives = num(r.lives, 1, maxLives);
  return { v: 1, seed: r.seed >>> 0, char: r.char, rng: r.rng >>> 0, at: r.at, lives, maxLives, acorns: num(r.acorns, 0, 1e6), score: num(r.score, 0, 1e9), ups, walls: num(r.walls, 0, STEPS), bestCombo: num(r.bestCombo, 0, 1e5), blocks: num(r.blocks, 0, 1e6) };
}
/** Reads a save defensively: anything missing, broken or from another version becomes a fresh profile. */
export function readProfile(raw: string | null): Profile {
  const p = freshProfile(); if (!raw) return p;
  try {
    const o = JSON.parse(raw) as Partial<Profile>; if (!o || typeof o !== 'object' || Array.isArray(o)) return p;
    p.bestFloor = num(o.bestFloor, 0, STEPS); p.bestScore = num(o.bestScore, 0, 1e9); p.runs = num(o.runs, 0, 1e6);
    if (o.wins && typeof o.wins === 'object') { p.wins.dora = num(o.wins.dora, 0, 1e6); p.wins.enzo = num(o.wins.enzo, 0, 1e6); }
    if (Array.isArray(o.discovered)) p.discovered = UP_IDS.filter((id) => (o.discovered as unknown[]).includes(id));
    if (isChar(o.char)) p.char = o.char;
    if (o.settings && typeof o.settings === 'object') { p.settings.sound = o.settings.sound !== false; p.settings.shake = o.settings.shake !== false; }
    p.run = readRun(o.run);
  } catch { return freshProfile(); }
  return p;
}
/** Remembers every upgrade the run has picked up. */
export function discover(p: Profile, g: PebbleGame) {
  p.discovered = UP_IDS.filter((id) => p.discovered.includes(id) || g.has(id) > 0);
}
/** Folds a finished run into the profile; returns the bits of news worth a badge. */
export function record(p: Profile, g: PebbleGame): string[] {
  const news: string[] = [], floor = g.phase === 'won' ? STEPS : g.step;
  p.runs++; p.run = null;
  if (floor > p.bestFloor) { if (p.bestFloor) news.push('FURTHEST YET'); p.bestFloor = floor; }
  if (g.score > p.bestScore) { if (p.bestScore) news.push('BEST SCORE'); p.bestScore = g.score; }
  if (g.phase === 'won') { if (!p.wins[g.char]) news.push(`FIRST WIN WITH ${g.char.toUpperCase()}`); p.wins[g.char]++; }
  discover(p, g);
  return news;
}

// Meadowmend's rules: a cosy hex tile-laying valley builder. Winter is over and the valley below the burrow is bare;
// Dora and Enzo mend it one hexagonal tile at a time. Every tile has six edges, each meadow, woods, burrow-hill or
// stream. Tiles come off a seeded stack (the current tile and a peek at the next); a tile can be turned and set down
// on any empty cell next to the valley. Every edge that matches its neighbour scores, a tile whose six sides all match
// is Perfect and adds tiles to the stack, a stream whose every end is joined becomes a pond, a land patch with no open
// edge left is closed with a flourish, and the valley's neighbours make wishes ("a woods of at least 8 tiles") that
// pay out tiles and points. The run ends when the stack is empty.
// Deterministic with no DOM: all randomness comes from seeded generators kept in the state, so a seed and the same
// placements always give the same valley, which is how the tests and the bots replay one exactly.

// ---------------------------------------------------------------- the board
export type Terrain = 'meadow' | 'woods' | 'hill' | 'stream';
export const TERRAINS: Terrain[] = ['meadow', 'woods', 'hill', 'stream'];
const LETTER: Record<string, Terrain> = { M: 'meadow', W: 'woods', H: 'hill', S: 'stream' };
export const letterOf = (t: Terrain) => (t === 'meadow' ? 'M' : t === 'woods' ? 'W' : t === 'hill' ? 'H' : 'S');
/** Pointy-top hexes in axial coordinates. Edge i faces DIRS[i]: 0 north-east, then clockwise to 5 north-west. */
export const DIRS: [number, number][] = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];
export const opp = (i: number) => (i + 3) % 6;
export const key = (q: number, r: number) => `${q},${r}`;
export const hexDist = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
/** Base edges turned `rot` steps clockwise: base edge j ends up on side (j + rot) % 6. */
export const rotate = (e: Terrain[], rot: number): Terrain[] => e.map((_, i) => e[(i - rot + 600) % 6]);
export const parseEdges = (s: string): Terrain[] => [...s].map((ch) => LETTER[ch] ?? 'meadow');

/** Which edges of a tile belong together: every stream edge meets in the middle, and each unbroken run of one land
 *  terrain round the rim is one patch (a stream through the middle splits the land either side of it). */
export function segments(e: Terrain[]): number[] {
  const seg = [-1, -1, -1, -1, -1, -1];
  let n = 0;
  if (e.includes('stream')) { for (let i = 0; i < 6; i++) if (e[i] === 'stream') seg[i] = n; n++; }
  // start just after a change of terrain, so a run that wraps past edge 5 stays whole
  let start = 0; for (let i = 0; i < 6; i++) if (e[i] !== e[(i + 5) % 6]) { start = i; break; }
  for (let k = 0; k < 6; k++) {
    const i = (start + k) % 6; if (e[i] === 'stream') continue;
    const p = (i + 5) % 6;
    if (k > 0 && e[p] === e[i] && seg[p] >= 0) seg[i] = seg[p]; else seg[i] = n++;
  }
  return seg;
}

export type Cell = {
  q: number; r: number; kind: 'tile' | 'rock' | 'oak';
  /** the edges as laid (already turned); empty for a rock */
  e: Terrain[]; seg: number[];
  /** set once the patch through that edge has no open side left */
  closed: boolean[];
  perfect: boolean; turn: number; tile: number;
};
export type Animal = 'bee' | 'hedgehog' | 'rabbit' | 'duck';
export const ANIMAL_OF: Record<Terrain, Animal> = { meadow: 'bee', woods: 'hedgehog', hill: 'rabbit', stream: 'duck' };
export const ANIMAL_NAME: Record<Animal, string> = { bee: 'A bee', hedgehog: 'A hedgehog', rabbit: 'A rabbit', duck: 'A duck' };
export const TERRAIN_NAME: Record<Terrain, string> = { meadow: 'meadow', woods: 'woods', hill: 'burrow-hill', stream: 'stream' };
/** A wish as it rides on a tile in the stack: on base edge `edge`. */
export type WishSpec = { terrain: Terrain; size: number; kind: 'atleast' | 'exact'; edge: number };
export type Wish = WishSpec & {
  id: number; animal: Animal; q: number; r: number; side: number;
  state: 'open' | 'done' | 'failed'; now: number; counted: number; turn: number;
  /** the turn it was granted or spoiled (-1 while open) */
  ended: number;
};
export type Tile = { id: number; e: string; wish?: WishSpec };

// ---------------------------------------------------------------- numbers
export const SAVE_KEY = 'meadow-v1';
/** Points for each edge that matches its neighbour. */
export const MATCH = 10;
/** A Perfect tile: points, and tiles added to the stack. */
export const PERFECT_PTS = 60, PERFECT_TILES = 1;
/** A closed land patch of at least CLOSE_MIN tiles scores this much per tile. */
export const CLOSE_PTS = 5, CLOSE_MIN = 2;
/** A pond (a stream with every end joined): points per tile, and tiles back. */
export const POND_PTS = 12, POND_TILES = 1;
/** Wishes: points per tile of the wish's size, tiles back, and the points for each tile an "at least" patch grows past. */
export const WISH_PTS = { atleast: 8, exact: 12 }, WISH_TILES = { atleast: 2, exact: 3 }, WISH_GROW = 4;
/** At most this many open wishes at once, and at least this many placements between new ones. */
export const WISH_OPEN = 3, WISH_GAP = 3;

// ---------------------------------------------------------------- randomness
/** mulberry32, with its state kept in plain numbers so a snapshot replays exactly. */
export function nextRand(st: { s: number }) {
  let t = (st.s = (st.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pickW = <T extends string>(st: { s: number }, w: Partial<Record<T, number>>): T => {
  const ks = Object.keys(w) as T[], tot = ks.reduce((a, k) => a + (w[k] ?? 0), 0);
  let x = nextRand(st) * tot; for (const k of ks) { x -= w[k] ?? 0; if (x < 0) return k; } return ks[ks.length - 1];
};

/** The shapes tiles come in: how many edges of each terrain, and where the stream runs. */
export type Shape = 'solid' | 'five' | 'four' | 'half' | 'three' | 'split' | 'river' | 'bend' | 'spring' | 'fork';
export type Mix = { shapes: Partial<Record<Shape, number>>; land: Partial<Record<Exclude<Terrain, 'stream'>, number>> };
/** Makes one tile's edges from a valley's mix. */
export function makeEdges(st: { s: number }, mix: Mix): Terrain[] {
  const shape = pickW(st, mix.shapes);
  const land = () => pickW(st, mix.land) as Terrain;
  const other = (not: Terrain) => { for (let i = 0; i < 8; i++) { const t = land(); if (t !== not) return t; } return not === 'meadow' ? 'woods' : 'meadow'; };
  const a = land(), b = other(a), c = (() => { for (let i = 0; i < 8; i++) { const t = land(); if (t !== a && t !== b) return t; } return b; })();
  let e: Terrain[];
  switch (shape) {
    case 'solid': e = [a, a, a, a, a, a]; break;
    case 'five': e = [a, a, a, a, a, b]; break;
    case 'four': e = [a, a, a, a, b, b]; break;
    case 'half': e = [a, a, a, b, b, b]; break;
    case 'three': e = [a, a, b, b, c, c]; break;
    case 'split': e = [a, a, b, a, a, b]; break;
    case 'river': { const d = nextRand(st) < 0.5 ? a : b; e = ['stream', a, a, 'stream', d, d]; break; }
    case 'bend': e = ['stream', a, 'stream', b, b, b]; break;
    case 'spring': e = ['stream', a, a, a, a, a]; break;
    case 'fork': e = ['stream', a, 'stream', b, 'stream', a]; break;
  }
  return rotate(e, Math.floor(nextRand(st) * 6));
}

// ---------------------------------------------------------------- the valleys
export type StartTile = { q: number; r: number; e: string; kind?: 'oak' };
export type ValleyDef = {
  id: string; name: string; feature: string; blurb: string; seed: number; tiles: number;
  /** cells further than this from the middle are off the map (0: no edge) */
  radius: number;
  start: StartTile[]; rocks: [number, number][]; mix: Mix;
  /** scores for one, two and three acorns (set from the bots) */
  acorns: [number, number, number];
  /** a fixed stack instead of a seeded one (the tutorial) */
  fixed?: Tile[];
  /** the valley's critter tune and painting */
  tone: 'spring' | 'brook' | 'oak' | 'pebble' | 'ponds' | 'downs' | 'fen' | 'endless';
};
const MIX_EVEN: Mix = { shapes: { solid: 1.5, five: 4, four: 4, half: 4, three: 2, split: 1, river: 2, bend: 2, spring: 1.2, fork: 0.4 }, land: { meadow: 5, woods: 3, hill: 2 } };

export const VALLEY_IDS = ['clover', 'willow', 'oak', 'pebble', 'ponds', 'downs', 'fen'] as const;
export type ValleyId = (typeof VALLEY_IDS)[number];
export const VALLEYS: Record<ValleyId, ValleyDef> = {
  clover: {
    id: 'clover', name: 'Clover Hollow', feature: 'An open meadow', tone: 'spring', seed: 1101, tiles: 34, radius: 0,
    blurb: 'A sunny hollow just below the burrow. Room to spread out and learn the edges.',
    start: [{ q: 0, r: 0, e: 'MMMMMM' }], rocks: [], acorns: [850, 1650, 2700],
    mix: { shapes: { solid: 2, five: 5, four: 4, half: 4, three: 1.2, split: 0.6, river: 1.6, bend: 1.4, spring: 1, fork: 0.2 }, land: { meadow: 6, woods: 3, hill: 1.5 } },
  },
  willow: {
    id: 'willow', name: 'Willow Brook', feature: 'A brook runs through', tone: 'brook', seed: 2203, tiles: 34, radius: 0,
    blurb: 'A brook already winds across the valley. Grow the banks and give the ducks a pond.',
    start: [{ q: -2, r: 0, e: 'MSMMSM' }, { q: -1, r: 0, e: 'MSMMSM' }, { q: 0, r: 0, e: 'WSMMSW' }, { q: 1, r: 0, e: 'MSMMSM' }, { q: 2, r: 0, e: 'MSMMSM' }],
    rocks: [], acorns: [900, 1850, 3200],
    mix: { shapes: { solid: 1.5, five: 4, four: 3, half: 3, three: 1.2, split: 0.6, river: 3.4, bend: 3, spring: 2.2, fork: 0.6 }, land: { meadow: 5, woods: 3, hill: 1.5 } },
  },
  oak: {
    id: 'oak', name: 'Old Oak Rise', feature: 'A great old oak', tone: 'oak', seed: 3307, tiles: 36, radius: 0,
    blurb: 'An ancient oak stands on the rise. The hedgehogs want the woods back round it.',
    start: [{ q: 0, r: 0, e: 'WWWWWW', kind: 'oak' }], rocks: [], acorns: [850, 2150, 4500],
    mix: { shapes: { solid: 1.75, five: 4, four: 4, half: 4, three: 1.5, split: 0.8, river: 1.4, bend: 1.2, spring: 0.9, fork: 0.3 }, land: { meadow: 3.5, woods: 5, hill: 1.6 } },
  },
  pebble: {
    id: 'pebble', name: 'Pebble Fields', feature: 'Rocks in the grass', tone: 'pebble', seed: 4409, tiles: 36, radius: 0,
    blurb: 'Big grey boulders sit in the fields. Tuck tiles in beside them: a rock never spoils a Perfect.',
    start: [{ q: 0, r: 0, e: 'MMMHHH' }],
    rocks: [[2, -1], [-1, -1], [1, 2], [-2, 1], [3, 1], [-3, -1], [0, -3], [-1, 3], [3, -3], [-3, 3]], acorns: [1050, 1950, 3050],
    mix: { shapes: { solid: 1.75, five: 4.5, four: 4, half: 4, three: 1.5, split: 0.8, river: 1.4, bend: 1.2, spring: 1, fork: 0.3 }, land: { meadow: 4.5, woods: 2.5, hill: 3 } },
  },
  ponds: {
    id: 'ponds', name: 'Twin Ponds', feature: 'Two springs to join', tone: 'ponds', seed: 5521, tiles: 36, radius: 0,
    blurb: 'Two little springs bubble up far apart. Join them with one long stream for the biggest pond in the valley.',
    start: [{ q: -2, r: 0, e: 'MMMMSM' }, { q: 2, r: 0, e: 'MSMMMM' }, { q: 0, r: 0, e: 'MMMMMM' }, { q: -1, r: 0, e: 'MMMMMM' }, { q: 1, r: 0, e: 'MMMMMM' }],
    rocks: [], acorns: [1300, 3300, 7100],
    mix: { shapes: { solid: 1.5, five: 4, four: 3, half: 3, three: 1.2, split: 0.6, river: 3.6, bend: 3, spring: 1.6, fork: 0.5 }, land: { meadow: 5, woods: 2.5, hill: 2 } },
  },
  downs: {
    id: 'downs', name: 'Burrow Downs', feature: 'A small valley ringed by hills', tone: 'downs', seed: 6637, tiles: 34, radius: 5,
    blurb: 'A snug round valley with hills all the way round. No room to waste: every edge counts.',
    start: [{ q: 0, r: 0, e: 'HHHHHH' }], rocks: [[2, 2], [-2, -2], [4, -2], [-4, 2]], acorns: [1050, 2650, 5600],
    mix: { shapes: { solid: 1.5, five: 4.5, four: 4, half: 4, three: 1.6, split: 0.8, river: 1.2, bend: 1, spring: 0.8, fork: 0.2 }, land: { meadow: 3, woods: 2.5, hill: 4.5 } },
  },
  fen: {
    id: 'fen', name: 'Misty Fen', feature: 'Streams everywhere', tone: 'fen', seed: 7741, tiles: 38, radius: 0,
    blurb: 'A wet, misty fen full of trickles. The ducks are thrilled; the bees less so.',
    start: [{ q: 0, r: 0, e: 'SMSMSM' }], rocks: [[3, -1], [-3, 1], [1, -3], [-1, 3]], acorns: [950, 2150, 4050],
    mix: { shapes: { solid: 1, five: 3, four: 2.5, half: 2.5, three: 1.4, split: 0.6, river: 4.5, bend: 4, spring: 2.6, fork: 1 }, land: { meadow: 4, woods: 3, hill: 2 } },
  },
};
/** The tutorial: a little ring of meadow round a hole, and a stack chosen to teach each idea in turn. */
export const TUTORIAL: ValleyDef = {
  id: 'tutorial', name: 'First Spring', feature: 'A guided first valley', tone: 'spring', seed: 99, tiles: 0, radius: 0,
  blurb: 'Dora and Enzo show you how a valley mends.',
  start: DIRS.map(([q, r]) => ({ q, r, e: 'MMMMMM' })),
  rocks: [], acorns: [0, 0, 0], mix: MIX_EVEN,
  fixed: [
    { id: 0, e: 'MMWWWM' },
    { id: 1, e: 'MMMMMM' },
    { id: 2, e: 'WWWWWW', wish: { terrain: 'woods', size: 3, kind: 'atleast', edge: 0 } },
    { id: 3, e: 'WWWWMM' },
    { id: 4, e: 'SMMMMM' },
    { id: 5, e: 'SMMMMM' },
    { id: 6, e: 'HHHMMM' },
    { id: 7, e: 'MMMMMM' },
  ],
};
/** The Endless Meadow and the Daily Valley: an open valley with a little brook and a long stack. */
export const ENDLESS: ValleyDef = {
  id: 'endless', name: 'Endless Meadow', feature: 'As long as the tiles last', tone: 'endless', seed: 1, tiles: 40, radius: 0,
  blurb: 'An open valley and a long stack. Perfects and wishes keep it going.',
  start: [{ q: 0, r: 0, e: 'MMSMMS' }], rocks: [], acorns: [0, 0, 0], mix: MIX_EVEN,
};
export type Mode = { kind: 'valley'; valley: ValleyId } | { kind: 'tutorial' } | { kind: 'endless'; seed: number; daily: boolean };
export const defOf = (m: Mode): ValleyDef => (m.kind === 'valley' ? VALLEYS[m.valley] : m.kind === 'tutorial' ? TUTORIAL : ENDLESS);

// ---------------------------------------------------------------- what a placement does
export type EdgeMark = 'match' | 'miss' | 'open' | 'wall';
export type Region = { terrain: Terrain; cells: string[]; size: number; open: number; miss: number; wall: number; closed: boolean; pond: boolean; nodes: [string, number][] };
export type WishResult = { id: number; state: Wish['state']; size: number; pts: number; tiles: number; fresh: boolean };
export type Assessment = {
  legal: boolean; edges: EdgeMark[]; matches: number;
  /** cells that become Perfect (this one and any neighbours it completes) */
  perfects: string[];
  closes: { terrain: Terrain; size: number; cells: string[]; pond: boolean; pts: number; tiles: number; nodes: [string, number][] }[];
  wishes: WishResult[];
  pts: number; tiles: number;
};
export type Ev =
  | { k: 'place'; q: number; r: number; matches: number; pts: number }
  | { k: 'match'; q: number; r: number; side: number }
  | { k: 'perfect'; q: number; r: number }
  | { k: 'close'; terrain: Terrain; cells: string[]; pond: boolean; pts: number }
  | { k: 'wish'; id: number; state: 'done' | 'failed' | 'new'; animal: Animal; q: number; r: number; pts: number }
  | { k: 'bonus'; n: number }
  | { k: 'grow'; id: number; n: number }
  | { k: 'undo' } | { k: 'end' };

export type Snapshot = {
  v: 1; mode: Mode; cells: Cell[]; stack: Tile[]; wishes: Wish[]; score: number; turn: number; nextTile: number; nextWish: number;
  rng: number; wrng: number; lastWish: number; stats: Stats; regions: { terrain: Terrain; cells: string[]; pond: boolean }[]; last: [number, number] | null;
};
export type Stats = { matches: number; perfects: number; ponds: number; closes: number; wishesDone: number; wishesFailed: number; bonus: number; placed: number; pMatch: number; pPerfect: number; pClose: number; pWish: number };
const freshStats = (): Stats => ({ matches: 0, perfects: 0, ponds: 0, closes: 0, wishesDone: 0, wishesFailed: 0, bonus: 0, placed: 0, pMatch: 0, pPerfect: 0, pClose: 0, pWish: 0 });

export class MeadowGame {
  mode: Mode; def: ValleyDef;
  cells = new Map<string, Cell>();
  stack: Tile[] = [];
  wishes: Wish[] = [];
  score = 0; turn = 0;
  stats: Stats = freshStats();
  /** closed patches and ponds, for the critters */
  regions: { terrain: Terrain; cells: string[]; pond: boolean }[] = [];
  last: [number, number] | null = null;
  events: Ev[] = [];
  private rng = { s: 1 }; private wrng = { s: 1 };
  private nextTile = 0; private nextWish = 0; private lastWish = -99;
  private undoSnap: Snapshot | null = null;

  constructor(mode: Mode) {
    this.mode = mode; this.def = defOf(mode);
    const seed = mode.kind === 'endless' ? mode.seed >>> 0 : this.def.seed;
    this.rng.s = (seed ^ 0x9e3779b9) >>> 0; this.wrng.s = (Math.imul(seed, 2654435761) ^ 0x51ed27) >>> 0;
    for (const t of this.def.start) this.put(t.q, t.r, t.kind ?? 'tile', parseEdges(t.e), -1);
    for (const [q, r] of this.def.rocks) this.put(q, r, 'rock', [], -1);
    if (this.def.fixed) this.stack = this.def.fixed.map((t) => ({ ...t, wish: t.wish ? { ...t.wish } : undefined }));
    else for (let i = 0; i < this.def.tiles; i++) this.stack.push(this.newTile());
    this.nextTile = Math.max(this.nextTile, this.stack.length);
    this.dealWishes();
  }
  private put(q: number, r: number, kind: Cell['kind'], e: Terrain[], tile: number) {
    this.cells.set(key(q, r), { q, r, kind, e, seg: kind === 'rock' ? [] : segments(e), closed: [false, false, false, false, false, false], perfect: false, turn: this.turn, tile });
  }
  private newTile(): Tile { const e = makeEdges(this.rng, this.def.mix); return { id: this.nextTile++, e: e.map(letterOf).join('') }; }

  get current(): Tile | null { return this.stack[0] ?? null; }
  get peek(): Tile | null { return this.stack[1] ?? null; }
  /** The run ends when the stack is empty (or, in a valley with an edge, when there is nowhere left to go). */
  get done() { return this.stack.length === 0 || this.full; }
  full = false;
  get canUndo() { return !!this.undoSnap; }
  get openWishes() { return this.wishes.filter((w) => w.state === 'open'); }
  /** How many acorns the score earns (always 0 in the endless modes). */
  acorns(score = this.score) { const a = this.def.acorns; return a[0] <= 0 ? 0 : score >= a[2] ? 3 : score >= a[1] ? 2 : score >= a[0] ? 1 : 0; }

  inBounds(q: number, r: number) { return !this.def.radius || hexDist(q, r) <= this.def.radius; }
  /** A cell a tile can go: on the map, empty, and next to at least one tile. */
  legal(q: number, r: number) {
    if (!this.inBounds(q, r) || this.cells.has(key(q, r))) return false;
    for (const [dq, dr] of DIRS) { const n = this.cells.get(key(q + dq, r + dr)); if (n && n.kind !== 'rock') return true; }
    return false;
  }
  /** Every cell a tile can go now. */
  frontier(): [number, number][] {
    const out: [number, number][] = [], seen = new Set<string>();
    for (const c of this.cells.values()) {
      if (c.kind === 'rock') continue;
      for (const [dq, dr] of DIRS) { const q = c.q + dq, r = c.r + dr, k = key(q, r); if (seen.has(k)) continue; seen.add(k); if (this.legal(q, r)) out.push([q, r]); }
    }
    return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }

  /** The patch (or stream) through one edge of a placed cell. */
  region(q: number, r: number, side: number): Region | null {
    const start = this.cells.get(key(q, r)); if (!start || start.kind === 'rock') return null;
    const terrain = start.e[side], cells = new Set<string>(), nodes: [string, number][] = [];
    const seen = new Set<string>(), todo: [Cell, number][] = [[start, start.seg[side]]];
    let open = 0, miss = 0, wall = 0;
    seen.add(`${key(q, r)}#${start.seg[side]}`);
    while (todo.length) {
      const [c, sg] = todo.pop()!, ck = key(c.q, c.r); cells.add(ck);
      for (let i = 0; i < 6; i++) {
        if (c.seg[i] !== sg) continue;
        nodes.push([ck, i]);
        const nq = c.q + DIRS[i][0], nr = c.r + DIRS[i][1];
        if (!this.inBounds(nq, nr)) { wall++; continue; }
        const n = this.cells.get(key(nq, nr));
        if (!n) { open++; continue; }
        if (n.kind === 'rock') { wall++; continue; }
        const o = opp(i);
        if (n.e[o] !== terrain) { miss++; continue; }
        const id = `${key(nq, nr)}#${n.seg[o]}`;
        if (!seen.has(id)) { seen.add(id); todo.push([n, n.seg[o]]); }
      }
    }
    const closed = open === 0;
    return { terrain, cells: [...cells], size: cells.size, open, miss, wall, closed, pond: terrain === 'stream' && closed && miss === 0 && wall === 0, nodes };
  }
  /** A cell is Perfect when all six sides are filled and every one matches (a rock or the valley's edge counts). */
  isPerfect(c: Cell) {
    if (c.kind === 'rock') return false;
    for (let i = 0; i < 6; i++) {
      const nq = c.q + DIRS[i][0], nr = c.r + DIRS[i][1];
      if (!this.inBounds(nq, nr)) continue;
      const n = this.cells.get(key(nq, nr));
      if (!n) return false;
      if (n.kind === 'rock') continue;
      if (n.e[opp(i)] !== c.e[i]) return false;
    }
    return true;
  }
  private wishSize(w: Wish): Region | null { return this.region(w.q, w.r, w.side); }

  /** Everything placing the current tile at (q, r) turned `rot` would do, without doing it. */
  assess(q: number, r: number, rot: number, tile: Tile | null = this.current): Assessment {
    const none: Assessment = { legal: false, edges: ['open', 'open', 'open', 'open', 'open', 'open'], matches: 0, perfects: [], closes: [], wishes: [], pts: 0, tiles: 0 };
    if (!tile || !this.legal(q, r)) return none;
    const e = rotate(parseEdges(tile.e), rot), k = key(q, r);
    this.put(q, r, 'tile', e, tile.id);
    try {
      const out: Assessment = { ...none, legal: true, edges: [] };
      for (let i = 0; i < 6; i++) {
        const nq = q + DIRS[i][0], nr = r + DIRS[i][1];
        if (!this.inBounds(nq, nr)) { out.edges.push('wall'); continue; }
        const n = this.cells.get(key(nq, nr));
        out.edges.push(!n ? 'open' : n.kind === 'rock' ? 'wall' : n.e[opp(i)] === e[i] ? 'match' : 'miss');
      }
      out.matches = out.edges.filter((m) => m === 'match').length;
      out.pts += out.matches * MATCH;
      // Perfects: this cell, and any neighbour whose last open side this fills
      const me = this.cells.get(k)!;
      if (this.isPerfect(me)) out.perfects.push(k);
      for (const [dq, dr] of DIRS) { const n = this.cells.get(key(q + dq, r + dr)); if (n && n.kind !== 'rock' && !n.perfect && this.isPerfect(n)) out.perfects.push(key(n.q, n.r)); }
      out.pts += out.perfects.length * PERFECT_PTS; out.tiles += out.perfects.length * PERFECT_TILES;
      // patches that close: every patch through this cell, and any neighbour patch that this cell walls off
      const seen = new Set<string>();
      const check = (cq: number, cr: number, side: number) => {
        const c = this.cells.get(key(cq, cr)); if (!c || c.kind === 'rock' || c.closed[side]) return;
        const id = `${key(cq, cr)}#${c.seg[side]}`; if (seen.has(id)) return;
        const g = this.region(cq, cr, side); if (!g) return;
        for (const [nk, ni] of g.nodes) { const nc = this.cells.get(nk)!; seen.add(`${nk}#${nc.seg[ni]}`); }
        if (!g.closed) return;
        const pond = g.pond && g.size >= 2;
        out.closes.push({ terrain: g.terrain, size: g.size, cells: g.cells, pond, nodes: g.nodes, tiles: pond ? POND_TILES : 0,
          pts: g.terrain === 'stream' ? (pond ? g.size * POND_PTS : 0) : g.size >= CLOSE_MIN ? g.size * CLOSE_PTS : 0 });
      };
      for (let i = 0; i < 6; i++) check(q, r, i);
      for (let i = 0; i < 6; i++) check(q + DIRS[i][0], r + DIRS[i][1], opp(i));
      for (const c of out.closes) { out.pts += c.pts; out.tiles += c.tiles; }
      // wishes: the open ones, the at-least ones still growing, and the one this tile brings
      const list: Wish[] = this.wishes.filter((w) => w.state === 'open' || (w.state === 'done' && w.kind === 'atleast'));
      if (tile.wish) list.push({ ...tile.wish, id: -1, animal: ANIMAL_OF[tile.wish.terrain], q, r, side: (tile.wish.edge + rot) % 6, state: 'open', now: 0, counted: 0, turn: this.turn, ended: -1 });
      for (const w of list) {
        const g = this.wishSize(w); if (!g) continue;
        if (w.state === 'done') { if (g.size > w.counted) out.wishes.push({ id: w.id, state: 'done', size: g.size, pts: (g.size - w.counted) * WISH_GROW, tiles: 0, fresh: false }); continue; }
        let state: Wish['state'] = 'open';
        if (w.kind === 'atleast') { if (g.size >= w.size) state = 'done'; else if (g.closed) state = 'failed'; }
        else if (g.size > w.size || (g.closed && g.size < w.size)) state = 'failed';
        else if (g.closed && g.size === w.size) state = 'done';
        const pts = state === 'done' ? w.size * WISH_PTS[w.kind] + (w.kind === 'atleast' ? (g.size - w.size) * WISH_GROW : 0) : 0;
        out.wishes.push({ id: w.id, state, size: g.size, pts, tiles: state === 'done' ? WISH_TILES[w.kind] : 0, fresh: true });
      }
      for (const w of out.wishes) { out.pts += w.pts; out.tiles += w.tiles; }
      return out;
    } finally { this.cells.delete(k); }
  }

  /** Places the current tile, turned `rot`, at (q, r). Returns false (and does nothing) if it cannot go there. */
  place(q: number, r: number, rot: number): boolean {
    const tile = this.current; if (!tile) return false;
    const a = this.assess(q, r, rot, tile); if (!a.legal) return false;
    this.undoSnap = this.snapshot();
    const e = rotate(parseEdges(tile.e), rot);
    this.put(q, r, 'tile', e, tile.id);
    this.events.push({ k: 'place', q, r, matches: a.matches, pts: a.pts });
    a.edges.forEach((m, i) => { if (m === 'match') this.events.push({ k: 'match', q, r, side: i }); });
    for (const pk of a.perfects) { const c = this.cells.get(pk)!; c.perfect = true; this.events.push({ k: 'perfect', q: c.q, r: c.r }); }
    for (const c of a.closes) {
      for (const [ck, i] of c.nodes) this.cells.get(ck)!.closed[i] = true;
      if (c.pts > 0 || c.pond) { this.regions.push({ terrain: c.terrain, cells: c.cells, pond: c.pond }); this.events.push({ k: 'close', terrain: c.terrain, cells: c.cells, pond: c.pond, pts: c.pts }); }
      if (c.pond) this.stats.ponds++; else if (c.pts > 0) this.stats.closes++;
      this.stats.pClose += c.pts;
    }
    if (tile.wish) {
      const w: Wish = { ...tile.wish, id: this.nextWish++, animal: ANIMAL_OF[tile.wish.terrain], q, r, side: (tile.wish.edge + rot) % 6, state: 'open', now: 0, counted: 0, turn: this.turn, ended: -1 };
      this.wishes.push(w);
      for (const x of a.wishes) if (x.id === -1) x.id = w.id;
      this.events.push({ k: 'wish', id: w.id, state: 'new', animal: w.animal, q, r, pts: 0 });
    }
    for (const x of a.wishes) {
      const w = this.wishes.find((v) => v.id === x.id); if (!w) continue;
      w.now = x.size;
      if (!x.fresh) { if (x.pts) { this.events.push({ k: 'grow', id: w.id, n: x.size - w.counted }); this.stats.pWish += x.pts; } w.counted = x.size; continue; }
      if (x.state !== 'open') {
        w.state = x.state; w.counted = x.size; w.ended = this.turn;
        if (x.state === 'done') { this.stats.wishesDone++; this.stats.pWish += x.pts; } else this.stats.wishesFailed++;
        this.events.push({ k: 'wish', id: w.id, state: x.state, animal: w.animal, q: w.q, r: w.r, pts: x.pts });
      }
    }
    // the rest of the open wishes' sizes, for the side list
    for (const w of this.wishes) if (w.state === 'open') { const g = this.wishSize(w); if (g) w.now = g.size; }
    this.stats.matches += a.matches; this.stats.perfects += a.perfects.length; this.stats.placed++;
    this.stats.pMatch += a.matches * MATCH; this.stats.pPerfect += a.perfects.length * PERFECT_PTS;
    this.score += a.pts;
    this.stack.shift();
    for (let i = 0; i < a.tiles; i++) this.stack.push(this.newTile());
    if (a.tiles) { this.stats.bonus += a.tiles; this.events.push({ k: 'bonus', n: a.tiles }); }
    this.turn++; this.last = [q, r];
    this.dealWishes();
    this.full = this.frontier().length === 0;
    if (this.done) this.events.push({ k: 'end' });
    return true;
  }
  /** Gives the tiles coming into view a wish now and then, when there is room for another. */
  private dealWishes() {
    if (this.def.fixed) return;
    for (const t of this.stack.slice(0, 2)) {
      if (t.wish || (t as Tile & { looked?: boolean }).looked) continue;
      (t as Tile & { looked?: boolean }).looked = true;
      const pending = this.stack.slice(0, 2).filter((x) => x.wish).length;
      if (this.openWishes.length + pending >= WISH_OPEN || this.turn - this.lastWish < WISH_GAP) continue;
      if (nextRand(this.wrng) > 0.55) continue;
      const e = parseEdges(t.e), ts = [...new Set(e)];
      const terrain = ts[Math.floor(nextRand(this.wrng) * ts.length)];
      const sides = e.map((x, i) => (x === terrain ? i : -1)).filter((i) => i >= 0);
      const edge = sides[Math.floor(nextRand(this.wrng) * sides.length)];
      const exact = terrain !== 'stream' && nextRand(this.wrng) < 0.35;
      const grow = Math.min(6, Math.floor(this.turn / 12));
      const base: Record<Terrain, [number, number]> = { meadow: [6, 10], woods: [5, 9], hill: [4, 7], stream: [4, 7] };
      const [lo, hi] = exact ? [3, 6] : base[terrain];
      const size = lo + Math.floor(nextRand(this.wrng) * (hi - lo + 1)) + (exact ? Math.floor(grow / 2) : grow);
      t.wish = { terrain, size, kind: exact ? 'exact' : 'atleast', edge };
      this.lastWish = this.turn;
    }
  }
  undo(): boolean {
    if (!this.undoSnap) return false;
    const s = this.undoSnap; this.undoSnap = null; this.restore(s);
    this.events.push({ k: 'undo' });
    return true;
  }

  // ---------------------------------------------------------------- snapshots (undo and the saved run)
  snapshot(): Snapshot {
    return JSON.parse(JSON.stringify({
      v: 1, mode: this.mode, cells: [...this.cells.values()], stack: this.stack, wishes: this.wishes, score: this.score, turn: this.turn,
      nextTile: this.nextTile, nextWish: this.nextWish, rng: this.rng.s, wrng: this.wrng.s, lastWish: this.lastWish, stats: this.stats, regions: this.regions, last: this.last,
    }));
  }
  private restore(s: Snapshot) {
    this.cells = new Map(s.cells.map((c) => [key(c.q, c.r), c]));
    this.stack = s.stack; this.wishes = s.wishes; this.score = s.score; this.turn = s.turn; this.nextTile = s.nextTile; this.nextWish = s.nextWish;
    this.rng.s = s.rng; this.wrng.s = s.wrng; this.lastWish = s.lastWish; this.stats = s.stats; this.regions = s.regions; this.last = s.last; this.full = this.frontier().length === 0;
  }
  /** Rebuilds a game from a saved snapshot; null if it does not make sense. */
  static load(raw: unknown): MeadowGame | null {
    try {
      const s = raw as Snapshot;
      if (!s || typeof s !== 'object' || s.v !== 1 || !s.mode || typeof s.mode !== 'object') return null;
      const m = s.mode;
      if (m.kind === 'valley') { if (!(VALLEY_IDS as readonly string[]).includes(m.valley)) return null; }
      else if (m.kind === 'endless') { if (typeof m.seed !== 'number' || !Number.isFinite(m.seed)) return null; }
      else if (m.kind !== 'tutorial') return null;
      const g = new MeadowGame(m.kind === 'endless' ? { kind: 'endless', seed: m.seed >>> 0, daily: m.daily === true } : m);
      const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
      if (!Array.isArray(s.cells) || !Array.isArray(s.stack) || !Array.isArray(s.wishes) || !Array.isArray(s.regions)) return null;
      if (![s.score, s.turn, s.nextTile, s.nextWish, s.rng, s.wrng, s.lastWish].every(num)) return null;
      const ter = (e: unknown) => Array.isArray(e) && e.every((t) => (TERRAINS as string[]).includes(t as string));
      for (const c of s.cells) {
        if (!c || !num(c.q) || !num(c.r) || !['tile', 'rock', 'oak'].includes(c.kind)) return null;
        if (c.kind === 'rock' ? !Array.isArray(c.e) || c.e.length : !ter(c.e) || c.e.length !== 6) return null;
        c.seg = c.kind === 'rock' ? [] : segments(c.e);
        if (!Array.isArray(c.closed) || c.closed.length !== 6) c.closed = [false, false, false, false, false, false];
        c.closed = c.closed.map((x) => x === true); c.perfect = c.perfect === true;
      }
      for (const t of s.stack) { if (!t || !num(t.id) || typeof t.e !== 'string' || !/^[MWHS]{6}$/.test(t.e)) return null; if (t.wish && (!(TERRAINS as string[]).includes(t.wish.terrain) || !num(t.wish.size) || !num(t.wish.edge))) return null; }
      for (const w of s.wishes) if (w && typeof w === 'object' && typeof w.ended !== 'number') w.ended = w.state === 'open' ? -1 : s.turn;
      for (const w of s.wishes) if (!w || !num(w.id) || !num(w.q) || !num(w.r) || !num(w.side) || !num(w.size) || !['open', 'done', 'failed'].includes(w.state) || !(TERRAINS as string[]).includes(w.terrain)) return null;
      if (!s.stats || typeof s.stats !== 'object') return null;
      g.restore({ ...s, stats: { ...freshStats(), ...s.stats }, last: Array.isArray(s.last) && s.last.length === 2 && s.last.every(num) ? s.last : null });
      return g;
    } catch { return null; }
  }
}

// ---------------------------------------------------------------- helpers for the hints and the bots
/** The best a tile can do at a cell: points per rotation (tiles counted as worth `tileValue` points). */
export function rotations(g: MeadowGame, q: number, r: number, tileValue = 30) {
  const out: { rot: number; a: Assessment; value: number }[] = [];
  for (let rot = 0; rot < 6; rot++) { const a = g.assess(q, r, rot); if (a.legal) out.push({ rot, a, value: a.pts + a.tiles * tileValue }); }
  return out;
}
/** For each frontier cell, whether some turn of the current tile there would be Perfect. */
export function perfectSpots(g: MeadowGame): [number, number][] {
  const tile = g.current; if (!tile) return [];
  const out: [number, number][] = [], e = parseEdges(tile.e);
  for (const [q, r] of g.frontier()) {
    // cheap first: only cells with all six sides filled can be Perfect
    let filled = true;
    for (const [dq, dr] of DIRS) { const nq = q + dq, nr = r + dr; if (g.inBounds(nq, nr) && !g.cells.has(key(nq, nr))) { filled = false; break; } }
    if (!filled) continue;
    for (let rot = 0; rot < 6; rot++) {
      const t = rotate(e, rot);
      let ok = true;
      for (let i = 0; i < 6 && ok; i++) { const nq = q + DIRS[i][0], nr = r + DIRS[i][1]; if (!g.inBounds(nq, nr)) continue; const n = g.cells.get(key(nq, nr))!; if (n.kind !== 'rock' && n.e[opp(i)] !== t[i]) ok = false; }
      if (ok) { out.push([q, r]); break; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- saves
export type ValleySave = { best: number; acorns: number; plays: number };
export type Save = {
  v: 1; valleys: Partial<Record<ValleyId, ValleySave>>; tutorial: boolean;
  endless: { best: number; plays: number }; daily: { date: string; best: number };
  totals: { tiles: number; perfects: number; ponds: number; wishes: number };
  run: Snapshot | null; ended: boolean;
  settings: { sound: boolean; music: boolean; hints: boolean };
};
export const freshSave = (): Save => ({ v: 1, valleys: {}, tutorial: false, endless: { best: 0, plays: 0 }, daily: { date: '', best: 0 }, totals: { tiles: 0, perfects: 0, ponds: 0, wishes: 0 }, run: null, ended: false, settings: { sound: true, music: true, hints: true } });
const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Reads a save, keeping what makes sense and dropping the rest; a broken or old save starts fresh. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.valleys)) for (const id of VALLEY_IDS) {
      const d = o.valleys[id]; if (!isObj(d)) continue;
      const best = Math.floor(num(d.best, 0, 1e7));
      s.valleys[id] = { best, acorns: Math.floor(num(d.acorns, 0, 3)), plays: Math.floor(num(d.plays, 0, 1e6)) };
    }
    s.tutorial = o.tutorial === true;
    if (isObj(o.endless)) s.endless = { best: Math.floor(num(o.endless.best, 0, 1e8)), plays: Math.floor(num(o.endless.plays, 0, 1e6)) };
    if (isObj(o.daily) && typeof o.daily.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.daily.date)) s.daily = { date: o.daily.date, best: Math.floor(num(o.daily.best, 0, 1e8)) };
    if (isObj(o.totals)) for (const k of ['tiles', 'perfects', 'ponds', 'wishes'] as const) s.totals[k] = Math.floor(num(o.totals[k], 0, 1e9));
    s.run = o.run && MeadowGame.load(o.run) ? (o.run as Snapshot) : null;
    s.ended = o.ended === true;
    if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; s.settings.hints = o.settings.hints !== false; }
  } catch { return freshSave(); }
  return s;
}
/** Valley i opens once the one before it has an acorn. */
export const valleyOpen = (s: Save, i: number) => i === 0 || (i > 0 && i < VALLEY_IDS.length && (s.valleys[VALLEY_IDS[i - 1]]?.acorns ?? 0) > 0);
/** The Endless Meadow and the Daily Valley open with the first acorn. */
export const endlessOpen = (s: Save) => (s.valleys.clover?.acorns ?? 0) > 0;
export const acornCount = (s: Save) => VALLEY_IDS.reduce((n, id) => n + (s.valleys[id]?.acorns ?? 0), 0);
/** The whole valley is mended once every valley has an acorn. */
export const allMended = (s: Save) => VALLEY_IDS.every((id) => (s.valleys[id]?.acorns ?? 0) > 0);
/** Records a finished run: best scores and acorns only ever go up. Returns what is new. */
export function recordRun(s: Save, g: MeadowGame, date = ''): { best: boolean; acorns: number; newAcorns: number; firstEnding: boolean } {
  const out = { best: false, acorns: 0, newAcorns: 0, firstEnding: false };
  s.totals.tiles += g.stats.placed; s.totals.perfects += g.stats.perfects; s.totals.ponds += g.stats.ponds; s.totals.wishes += g.stats.wishesDone;
  if (g.mode.kind === 'tutorial') { s.tutorial = true; return out; }
  if (g.mode.kind === 'endless') {
    s.endless.plays++;
    if (g.mode.daily && date) { if (s.daily.date !== date) s.daily = { date, best: 0 }; if (g.score > s.daily.best) { s.daily.best = g.score; out.best = true; } }
    if (g.score > s.endless.best) { s.endless.best = g.score; if (!g.mode.daily) out.best = true; }
    return out;
  }
  const id = g.mode.valley, was = s.valleys[id] ?? { best: 0, acorns: 0, plays: 0 }, a = g.acorns();
  const before = allMended(s);
  out.best = g.score > was.best; out.acorns = a; out.newAcorns = Math.max(0, a - was.acorns);
  s.valleys[id] = { best: Math.max(was.best, g.score), acorns: Math.max(was.acorns, a), plays: was.plays + 1 };
  if (!before && allMended(s) && !s.ended) { s.ended = true; out.firstEnding = true; }
  return out;
}
/** A seed for the Daily Valley from a local date like 2026-10-30. */
export function dailySeed(date: string) { let h = 2166136261; for (const ch of 'meadow' + date) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

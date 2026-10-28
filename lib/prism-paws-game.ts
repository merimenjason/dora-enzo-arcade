// Prism Paws' rules: Dora and Enzo steer moonlight from moon windows with mirrors, candy glass and crystals to relight
// the valley's paper lanterns without waking the sleeping kits. Light mixes like real light (a 3-bit colour mask), every
// beam is traced cell by cell, and a solver proves every level and gives hints. No DOM and no randomness here: the scene
// draws it and the page wires it up.

export const SAVE_KEY = 'prism-paws-v1';
export const MAX_W = 9, MAX_H = 7;

// ---- directions: 0 east, 1 south, 2 west, 3 north
export type Dir = 0 | 1 | 2 | 3;
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

// ---- colours: a 3-bit mask that mixes like light
export const ROSE = 1, LEAF = 2, SKY = 4, HONEY = 3, PLUM = 5, MINT = 6, MOONWHITE = 7;
export const COLOURS: Record<number, { name: string; hex: string; rgb: [number, number, number] }> = {
  1: { name: 'Rose', hex: '#ff5a7a', rgb: [255, 70, 110] },
  2: { name: 'Leaf', hex: '#5fe07a', rgb: [70, 235, 110] },
  3: { name: 'Honey', hex: '#ffd24a', rgb: [255, 215, 70] },
  4: { name: 'Sky', hex: '#5aa8ff', rgb: [80, 150, 255] },
  5: { name: 'Plum', hex: '#d06aff', rgb: [215, 100, 255] },
  6: { name: 'Mint', hex: '#5ff0e0', rgb: [90, 240, 225] },
  7: { name: 'Moonwhite', hex: '#f4f1ff', rgb: [245, 242, 255] },
};
export const colourName = (c: number) => COLOURS[c]?.name ?? 'Dark';

// ---- terrain
export const EMPTY = 0, ROCK = 1, FLOWERS = 2, SOURCE = 3, LANTERN = 4, KIT = 5, BURROW = 6, FIREFLY = 7;
export type Terrain = typeof EMPTY | typeof ROCK | typeof FLOWERS | typeof SOURCE | typeof LANTERN | typeof KIT | typeof BURROW | typeof FIREFLY;

// ---- pieces, as small codes: 1 and 2 are mirrors (/ and \), 3 and 4 crystal panes, 5 to 7 candy glass, 8 a prism
export const NONE = 0, MIRROR_A = 1, MIRROR_B = 2, SPLIT_A = 3, SPLIT_B = 4, GLASS_ROSE = 5, GLASS_LEAF = 6, GLASS_SKY = 7, PRISM = 8;
export const TRAY = ['mirror', 'splitter', 'rose', 'leaf', 'sky', 'prism'] as const;
export type TrayKind = (typeof TRAY)[number];
export const TRAY_INFO: Record<TrayKind, { name: string; codes: number[]; tip: string }> = {
  mirror: { name: 'Mirror', codes: [MIRROR_A, MIRROR_B], tip: 'Bounces moonlight around a corner. Tap it to turn it.' },
  splitter: { name: 'Crystal pane', codes: [SPLIT_A, SPLIT_B], tip: 'Lets the light through and bounces a copy too. Tap it to turn it.' },
  rose: { name: 'Rose glass', codes: [GLASS_ROSE], tip: 'Lets only rose light through.' },
  leaf: { name: 'Leaf glass', codes: [GLASS_LEAF], tip: 'Lets only leaf-green light through.' },
  sky: { name: 'Sky glass', codes: [GLASS_SKY], tip: 'Lets only sky-blue light through.' },
  prism: { name: 'Prism', codes: [PRISM], tip: 'Fans light out: rose turns left, leaf goes on, sky turns right.' },
};
export const kindOf = (code: number): TrayKind | null =>
  code === MIRROR_A || code === MIRROR_B ? 'mirror' : code === SPLIT_A || code === SPLIT_B ? 'splitter' : code === GLASS_ROSE ? 'rose' : code === GLASS_LEAF ? 'leaf' : code === GLASS_SKY ? 'sky' : code === PRISM ? 'prism' : null;
export const turns = (code: number) => code >= MIRROR_A && code <= SPLIT_B;
/** The other orientation of a mirror or a crystal pane. */
export const turned = (code: number) => (turns(code) ? (code % 2 === 1 ? code + 1 : code - 1) : code);
/** True for the `\` orientation. */
export const isBack = (code: number) => code === MIRROR_B || code === SPLIT_B;
export const glassColour = (code: number) => (code === GLASS_ROSE ? ROSE : code === GLASS_LEAF ? LEAF : code === GLASS_SKY ? SKY : 0);

/** Where a mirror sends a beam: `/` turns east to north, `\` turns east to south. */
export const reflect = (code: number, d: number) => (isBack(code) ? d ^ 1 : 3 - d);

// ---- levels
export type FixedPiece = { x: number; y: number; code: number; turn?: boolean };
export type LevelDef = {
  id: string; name: string; chapter: number; tip?: string;
  /** Rows of the board; see LEGEND. */
  grid: string[];
  /** Colours of the moon windows in reading order, when not all Moonwhite. */
  sources?: number[];
  tray: Partial<Record<TrayKind, number>>;
  /** The fewest tray pieces that win, found by the solver (the tests check it). */
  par: number;
  /** Fixed pieces other than the mirrors drawn in the grid. */
  fixed?: FixedPiece[];
};
/**
 * The grid legend:
 * `.` open grass, `#` rock, `,` flowers (no pieces), `*` the firefly, `z` a sleeping kit,
 * `>` `v` `<` `^` a moon window shining that way, `r g b y p m w` lanterns (Rose, Leaf, Sky, Honey, Plum, Mint, Moonwhite),
 * `1` `2` burrow pairs, `/` `\` fixed mirrors, `[` `]` fixed mirrors that turn (starting `/` and `\`).
 */
export const LEGEND = '.#,*z>v<^rgbypmw12/\\[]';
const LANTERN_CHARS: Record<string, number> = { r: ROSE, g: LEAF, b: SKY, y: HONEY, p: PLUM, m: MINT, w: MOONWHITE };
const SOURCE_DIRS: Record<string, Dir> = { '>': 0, v: 1, '<': 2, '^': 3 };

export type Board = {
  w: number; h: number;
  terrain: Uint8Array;
  /** Fixed pieces at the start; `turnable` marks the ones the player may turn. */
  fixed: Int8Array; turnable: Uint8Array;
  sources: { x: number; y: number; d: Dir; c: number }[];
  lanterns: { x: number; y: number; c: number }[];
  kits: { x: number; y: number }[];
  firefly: { x: number; y: number };
  /** For each burrow cell, the cell of its partner; -1 elsewhere. */
  partner: Int16Array;
  lanternAt: Int16Array; kitAt: Int16Array;
};

export function parseLevel(L: LevelDef): Board {
  const h = L.grid.length, w = L.grid[0]?.length ?? 0;
  if (h < 1 || h > MAX_H || w < 1 || w > MAX_W) throw new Error(`${L.id}: the board must be 1-${MAX_W} wide and 1-${MAX_H} tall`);
  const n = w * h, terrain = new Uint8Array(n), fixed = new Int8Array(n), turnable = new Uint8Array(n);
  const partner = new Int16Array(n).fill(-1), lanternAt = new Int16Array(n).fill(-1), kitAt = new Int16Array(n).fill(-1);
  const sources: Board['sources'] = [], lanterns: Board['lanterns'] = [], kits: Board['kits'] = [];
  const burrows: Record<string, number[]> = {};
  let firefly: { x: number; y: number } | null = null;
  for (let y = 0; y < h; y++) {
    const row = L.grid[y];
    if (row.length !== w) throw new Error(`${L.id}: row ${y} is ${row.length} wide, not ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x], i = y * w + x;
      if (!LEGEND.includes(ch)) throw new Error(`${L.id}: unknown tile "${ch}" at ${x},${y}`);
      if (ch === '#') terrain[i] = ROCK;
      else if (ch === ',') terrain[i] = FLOWERS;
      else if (ch === '*') { if (firefly) throw new Error(`${L.id}: two fireflies`); terrain[i] = FIREFLY; firefly = { x, y }; }
      else if (ch === 'z') { terrain[i] = KIT; kitAt[i] = kits.length; kits.push({ x, y }); }
      else if (ch in SOURCE_DIRS) { terrain[i] = SOURCE; sources.push({ x, y, d: SOURCE_DIRS[ch], c: MOONWHITE }); }
      else if (ch in LANTERN_CHARS) { terrain[i] = LANTERN; lanternAt[i] = lanterns.length; lanterns.push({ x, y, c: LANTERN_CHARS[ch] }); }
      else if (ch === '1' || ch === '2') { terrain[i] = BURROW; (burrows[ch] ??= []).push(i); }
      else if (ch === '/' || ch === '\\') fixed[i] = ch === '/' ? MIRROR_A : MIRROR_B;
      else if (ch === '[' || ch === ']') { fixed[i] = ch === '[' ? MIRROR_A : MIRROR_B; turnable[i] = 1; }
    }
  }
  for (const [k, cells] of Object.entries(burrows)) {
    if (cells.length !== 2) throw new Error(`${L.id}: burrow ${k} needs exactly two ends`);
    partner[cells[0]] = cells[1]; partner[cells[1]] = cells[0];
  }
  (L.sources ?? []).forEach((c, k) => { if (sources[k]) sources[k].c = c; });
  for (const f of L.fixed ?? []) {
    const i = f.y * w + f.x;
    if (terrain[i] !== EMPTY || fixed[i]) throw new Error(`${L.id}: fixed piece on a busy tile at ${f.x},${f.y}`);
    fixed[i] = f.code; if (f.turn && turns(f.code)) turnable[i] = 1;
  }
  if (!sources.length) throw new Error(`${L.id}: needs a moon window`);
  return { w, h, terrain, fixed, turnable, sources, lanterns, kits, firefly: firefly ?? { x: -1, y: -1 }, partner, lanternAt, kitAt };
}
/** Open grass with nothing on it: the only place a tray piece can go. */
export const placeable = (b: Board, i: number) => b.terrain[i] === EMPTY && !b.fixed[i];

// ---- tracing
/** A beam drawn from one point to another in cell units (cell centres sit on .5), heading `d`, with its colour. */
export type Segment = { x1: number; y1: number; x2: number; y2: number; d: Dir; c: number };
export type Trace = {
  segs: Segment[];
  /** The colours reaching each lantern, OR-ed. */
  recv: number[];
  lit: boolean[];
  woke: boolean[];
  firefly: boolean;
  /** For every cell a beam enters (or stops in), a bit for each colour that reaches it (bit c for colour c); 0 elsewhere. */
  beamed: Uint8Array;
  won: boolean;
};

/** Follows every beam from every moon window until it stops, leaves the board or repeats itself. */
export function trace(b: Board, pieces: ArrayLike<number>, wantSegs = true): Trace {
  const { w, h, terrain, partner } = b;
  const recv = b.lanterns.map(() => 0), woke = b.kits.map(() => false), beamed = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h * 32), segs: Segment[] = [];
  let firefly = false;
  // a stack of beams leaving a cell: cell, direction, colour
  const stack: number[] = [];
  for (const s of b.sources) stack.push(s.y * w + s.x, s.d, s.c);
  while (stack.length) {
    const c = stack.pop()!, d = stack.pop()!, from = stack.pop()!;
    const key = from * 32 + d * 8 + c;
    if (seen[key]) continue;
    seen[key] = 1;
    const sx = from % w, sy = (from - sx) / w;
    let x = sx, y = sy, ex = 0, ey = 0;
    for (;;) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { ex = x + 0.5 + DX[d] * 0.5; ey = y + 0.5 + DY[d] * 0.5; break; }
      const i = ny * w + nx, t = terrain[i];
      beamed[i] |= 1 << c;
      if (t === ROCK || t === SOURCE) { ex = nx + 0.5 - DX[d] * 0.5; ey = ny + 0.5 - DY[d] * 0.5; break; }
      ex = nx + 0.5; ey = ny + 0.5;
      if (t === LANTERN) { recv[b.lanternAt[i]] |= c; break; }
      if (t === KIT) { woke[b.kitAt[i]] = true; break; }
      if (t === BURROW) { stack.push(partner[i], d, c); break; }
      const p = pieces[i];
      if (p) {
        if (p <= MIRROR_B) stack.push(i, reflect(p, d), c);
        else if (p <= SPLIT_B) { stack.push(i, d, c); stack.push(i, reflect(p, d), c); }
        else if (p <= GLASS_SKY) { const k = c & glassColour(p); if (k) stack.push(i, d, k); }
        else {
          if (c & ROSE) stack.push(i, (d + 3) % 4, ROSE);
          if (c & LEAF) stack.push(i, d, LEAF);
          if (c & SKY) stack.push(i, (d + 1) % 4, SKY);
        }
        break;
      }
      if (t === FIREFLY) firefly = true;
      x = nx; y = ny;
    }
    if (wantSegs) segs.push({ x1: sx + 0.5, y1: sy + 0.5, x2: ex, y2: ey, d: d as Dir, c });
  }
  const lit = b.lanterns.map((L, k) => recv[k] === L.c);
  const won = lit.every(Boolean) && !woke.some(Boolean);
  return { segs, recv, lit, woke, firefly, beamed, won };
}

// ---- the solver
export type Placement = { x: number; y: number; code: number };
export type Solution = { place: Placement[]; turn: Placement[] };
export type SolveResult = { solvable: boolean; par: number; solution: Solution | null; nodes: number; complete: boolean };

/** Whether a piece would change any of the beams crossing a cell (bit c of `mask` for colour c). */
export function alters(code: number, mask: number) {
  if (code <= SPLIT_B) return mask !== 0;
  for (let c = 1; c < 8; c++) {
    if (!(mask & (1 << c))) continue;
    if (code === PRISM ? c & (ROSE | SKY) : c & ~glassColour(code)) return true;
  }
  return false;
}
const trayCounts = (tray: Partial<Record<TrayKind, number>>) => TRAY.map((k) => Math.max(0, tray[k] ?? 0));

export type Probe = { beamed: Uint8Array; time: Int32Array; won: boolean; firefly: boolean };
/**
 * The same light as `trace`, followed one tile per step in order of time, so `time[cell * 8 + colour]` is the first step
 * that colour reaches the cell (-1 if never). The solver uses it; `trace` keeps the long segments for drawing.
 */
const scratch = { n: 0, seen: new Uint8Array(0), q: new Int32Array(0), recv: new Uint8Array(16) };
export function probe(b: Board, pieces: ArrayLike<number>, into?: Probe): Probe {
  const { w, h, terrain, partner } = b, n = w * h;
  if (scratch.n !== n) { scratch.n = n; scratch.seen = new Uint8Array(n * 32); scratch.q = new Int32Array(n * 32 * 2); }
  if (scratch.recv.length < b.lanterns.length) scratch.recv = new Uint8Array(b.lanterns.length);
  const seen = scratch.seen, q = scratch.q, recv = scratch.recv;
  seen.fill(0); recv.fill(0);
  const beamed = into?.beamed ?? new Uint8Array(n), time = into?.time ?? new Int32Array(n * 8);
  beamed.fill(0); time.fill(-1);
  let head = 0, tail = 0, firefly = false, woke = false;
  // a queue of beams entering a tile: x, y, direction, colour, step
  const enter = (x: number, y: number, d: number, c: number, t: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 32 + d * 8 + c;
    if (seen[k]) return;
    seen[k] = 1; q[tail++] = k; q[tail++] = t;
  };
  for (const s of b.sources) enter(s.x + DX[s.d], s.y + DY[s.d], s.d, s.c, 1);
  while (head < tail) {
    const k = q[head++], t = q[head++], c = k & 7, d = (k >> 3) & 3, i = k >> 5, x = i % w, y = (i - x) / w;
    beamed[i] |= 1 << c;
    if (time[i * 8 + c] < 0) time[i * 8 + c] = t;
    const tt = terrain[i];
    if (tt === ROCK || tt === SOURCE) continue;
    if (tt === LANTERN) { recv[b.lanternAt[i]] |= c; continue; }
    if (tt === KIT) { woke = true; continue; }
    if (tt === BURROW) { const j = partner[i], px = j % w; enter(px + DX[d], (j - px) / w + DY[d], d, c, t + 1); continue; }
    const p = pieces[i];
    if (!p) { if (tt === FIREFLY) firefly = true; enter(x + DX[d], y + DY[d], d, c, t + 1); continue; }
    if (p <= MIRROR_B) { const e = reflect(p, d); enter(x + DX[e], y + DY[e], e, c, t + 1); }
    else if (p <= SPLIT_B) { const e = reflect(p, d); enter(x + DX[d], y + DY[d], d, c, t + 1); enter(x + DX[e], y + DY[e], e, c, t + 1); }
    else if (p <= GLASS_SKY) { const g = c & glassColour(p); if (g) enter(x + DX[d], y + DY[d], d, g, t + 1); }
    else {
      if (c & ROSE) { const e = (d + 3) % 4; enter(x + DX[e], y + DY[e], e, ROSE, t + 1); }
      if (c & LEAF) enter(x + DX[d], y + DY[d], d, LEAF, t + 1);
      if (c & SKY) { const e = (d + 1) % 4; enter(x + DX[e], y + DY[e], e, SKY, t + 1); }
    }
  }
  let won = !woke;
  for (let k = 0; won && k < b.lanterns.length; k++) if (recv[k] !== b.lanterns[k].c) won = false;
  return { beamed, time, won, firefly };
}
/** The first step a beam that `code` would change reaches cell `i` (-1 if none does). */
function activation(code: number, i: number, time: Int32Array) {
  let best = -1;
  for (let c = 1; c < 8; c++) {
    const t = time[i * 8 + c];
    if (t < 0 || !(code <= SPLIT_B || (code === PRISM ? c & (ROSE | SKY) : c & ~glassColour(code)))) continue;
    if (best < 0 || t < best) best = t;
  }
  return best;
}

/**
 * Light that arrives by step `t` can no longer change once every later piece only changes beams arriving after `t`.
 * So a kit woken by then, or a lantern given a colour it must not have, can never be put right.
 */
function frozenWrong(b: Board, time: Int32Array, t: number) {
  for (const k of b.kits) { const i = (k.y * b.w + k.x) * 8; for (let c = 1; c < 8; c++) { const a = time[i + c]; if (a >= 0 && a <= t) return true; } }
  for (const L of b.lanterns) {
    const i = (L.y * b.w + L.x) * 8;
    for (let c = 1; c < 8; c++) { const a = time[i + c]; if (a >= 0 && a <= t && c & ~L.c) return true; }
  }
  return false;
}

/**
 * The fewest tray pieces that win, by iterative deepening, so the first solution found is a smallest one.
 * Pieces only go where a beam they would change already reaches. In a smallest solution every piece changes some beam
 * (or the board without it would win too), so give each piece the first step a beam it changes reaches it, and add the
 * pieces in that order: each one sits on a beam of the board before it, and adding it changes nothing earlier. So the
 * search only places pieces in order of that step (then of tile), which reaches every smallest solution exactly once,
 * and gives up on a board as soon as light it can no longer change has gone wrong.
 * `start` holds pieces already on the board (fixed and placed); the `turnable` cells may be turned either way first.
 */
export function search(b: Board, start: ArrayLike<number>, tray: number[], turnable: number[], opts: { firefly?: boolean; maxPieces?: number; maxNodes?: number } = {}): SolveResult {
  const n = b.w * b.h, maxPieces = Math.min(opts.maxPieces ?? 99, tray.reduce((a, k) => a + k, 0)), maxNodes = opts.maxNodes ?? 3e6;
  const arr = new Int8Array(n); for (let i = 0; i < n; i++) arr[i] = start[i];
  const left = tray.slice(), path: Placement[] = [];
  const codes = TRAY.map((k) => TRAY_INFO[k].codes);
  let nodes = 0, out = false;
  // one probe buffer per depth, so a deeper call never overwrites the light its caller is still reading
  const bufs: Probe[] = [];
  const dfs = (depth: number, budget: number, lastT: number, lastI: number): boolean => {
    if (++nodes > maxNodes) { out = true; return false; }
    const t = probe(b, arr, bufs[depth] ??= { beamed: new Uint8Array(n), time: new Int32Array(n * 8), won: false, firefly: false });
    if (t.won && (!opts.firefly || t.firefly)) return true;
    if (budget === 0 || (lastT >= 0 && frozenWrong(b, t.time, lastT))) return false;
    for (let i = 0; i < n; i++) {
      if (!t.beamed[i] || arr[i] || !placeable(b, i)) continue;
      for (let k = 0; k < TRAY.length; k++) {
        if (!left[k]) continue;
        for (const code of codes[k]) {
          const a = activation(code, i, t.time);
          if (a < 0 || a < lastT || (a === lastT && i <= lastI)) continue;
          arr[i] = code; left[k]--; path.push({ x: i % b.w, y: Math.floor(i / b.w), code });
          const hit = dfs(depth + 1, budget - 1, a, i);
          left[k]++;
          if (hit) return true;
          path.pop(); arr[i] = 0;
          if (out) return false;
        }
      }
    }
    return false;
  };
  const combos = 1 << turnable.length;
  const base = turnable.map((i) => arr[i]);
  for (let limit = 0; limit <= maxPieces; limit++) {
    for (let m = 0; m < combos; m++) {
      turnable.forEach((i, k) => { arr[i] = m & (1 << k) ? turned(base[k]) : base[k]; });
      path.length = 0;
      if (dfs(0, limit, -1, -1)) {
        const turn = turnable.filter((i) => arr[i] !== start[i]).map((i) => ({ x: i % b.w, y: Math.floor(i / b.w), code: arr[i] }));
        return { solvable: true, par: limit, solution: { place: path.slice(), turn }, nodes, complete: true };
      }
      if (out) return { solvable: false, par: -1, solution: null, nodes, complete: false };
    }
  }
  return { solvable: false, par: -1, solution: null, nodes, complete: true };
}

export type LevelReport = { solvable: boolean; par: number; solution: Solution | null; firefly: boolean; fireflyPar: number; fireflySolution: Solution | null; nodes: number };
/** Solves a level from its starting board, both plainly and while catching the firefly. */
export function solveLevel(level: LevelDef | number): LevelReport {
  const L = typeof level === 'number' ? LEVELS[level] : level, b = parseLevel(L);
  const tray = trayCounts(L.tray), turnable = [...b.turnable.keys()].filter((i) => b.turnable[i]);
  const a = search(b, b.fixed, tray, turnable);
  const f = a.solvable ? search(b, b.fixed, tray, turnable, { firefly: true }) : null;
  return { solvable: a.solvable, par: a.par, solution: a.solution, firefly: !!f?.solvable, fireflyPar: f?.par ?? -1, fireflySolution: f?.solution ?? null, nodes: a.nodes + (f?.nodes ?? 0) };
}

// ---- playing
export type Hint =
  | { kind: 'place'; x: number; y: number; code: number }
  | { kind: 'turn'; x: number; y: number; code: number }
  | { kind: 'won' }
  | { kind: 'stuck'; fresh: Solution | null };
export type PrismEvent = { kind: 'place' | 'turn' | 'lift' | 'lit' | 'dim' | 'wake' | 'calm' | 'firefly' | 'win' | 'undo' | 'reset' | 'nope'; x?: number; y?: number; c?: number };
export type StarReport = { solved: boolean; firefly: boolean; thrifty: boolean; stars: number; used: number; par: number };

type Snapshot = { pieces: Int8Array; placed: Uint8Array; left: number[] };

export class PrismGame {
  readonly index: number;
  readonly level: LevelDef;
  readonly board: Board;
  readonly par: number;
  /** Every piece on the board, fixed or placed. */
  pieces: Int8Array;
  /** 1 where the piece came from the tray. */
  placed: Uint8Array;
  /** Tray pieces still to place, in TRAY order. */
  left: number[];
  traced: Trace;
  events: PrismEvent[] = [];
  /** Set once the level has been won; it stays set for the win card while the board can still be looked at. */
  solvedOnce = false;
  private history: Snapshot[] = [];

  constructor(level: number | LevelDef, par?: number) {
    this.index = typeof level === 'number' ? level : LEVELS.indexOf(level);
    this.level = typeof level === 'number' ? LEVELS[level] : level;
    this.board = parseLevel(this.level);
    this.par = par ?? this.level.par;
    this.pieces = Int8Array.from(this.board.fixed);
    this.placed = new Uint8Array(this.pieces.length);
    this.left = trayCounts(this.level.tray);
    this.traced = trace(this.board, this.pieces);
  }
  get w() { return this.board.w; }
  get h() { return this.board.h; }
  get won() { return this.traced.won; }
  /** How many tray pieces are on the board. */
  get used() { let n = 0; for (const p of this.placed) n += p; return n; }
  get trayTotal() { return trayCounts(this.level.tray).reduce((a, k) => a + k, 0); }
  at(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1; }
  /** Whether the piece at a cell can be turned by the player. */
  canTurn(x: number, y: number) { const i = this.at(x, y); return i >= 0 && turns(this.pieces[i]) && (this.placed[i] === 1 || this.board.turnable[i] === 1); }
  canPlace(x: number, y: number) { const i = this.at(x, y); return i >= 0 && placeable(this.board, i) && !this.pieces[i]; }
  canLift(x: number, y: number) { const i = this.at(x, y); return i >= 0 && this.placed[i] === 1; }

  private snap(): Snapshot { return { pieces: Int8Array.from(this.pieces), placed: Uint8Array.from(this.placed), left: this.left.slice() }; }
  private commit(before: Snapshot) {
    this.history.push(before);
    const old = this.traced;
    this.traced = trace(this.board, this.pieces);
    const t = this.traced;
    this.board.lanterns.forEach((L, k) => {
      if (t.lit[k] && !old.lit[k]) this.events.push({ kind: 'lit', x: L.x, y: L.y, c: L.c });
      else if (!t.lit[k] && old.lit[k]) this.events.push({ kind: 'dim', x: L.x, y: L.y, c: L.c });
    });
    this.board.kits.forEach((K, k) => {
      if (t.woke[k] && !old.woke[k]) this.events.push({ kind: 'wake', x: K.x, y: K.y });
      else if (!t.woke[k] && old.woke[k]) this.events.push({ kind: 'calm', x: K.x, y: K.y });
    });
    if (t.firefly && !old.firefly) this.events.push({ kind: 'firefly', x: this.board.firefly.x, y: this.board.firefly.y });
    if (t.won && !old.won) { this.solvedOnce = true; this.events.push({ kind: 'win' }); }
  }

  /** Puts a tray piece on open grass; `code` picks the orientation (the kind's first code by default). */
  place(x: number, y: number, kind: TrayKind, code = TRAY_INFO[kind].codes[0]): boolean {
    const k = TRAY.indexOf(kind);
    if (k < 0 || !this.left[k] || !this.canPlace(x, y) || !TRAY_INFO[kind].codes.includes(code)) { this.events.push({ kind: 'nope', x, y }); return false; }
    const before = this.snap(), i = this.at(x, y);
    this.pieces[i] = code; this.placed[i] = 1; this.left[k]--;
    this.events.push({ kind: 'place', x, y, c: code });
    this.commit(before);
    return true;
  }
  /** Turns a mirror or crystal pane between `/` and `\`. */
  rotate(x: number, y: number): boolean {
    if (!this.canTurn(x, y)) { this.events.push({ kind: 'nope', x, y }); return false; }
    const before = this.snap(), i = this.at(x, y);
    this.pieces[i] = turned(this.pieces[i]);
    this.events.push({ kind: 'turn', x, y, c: this.pieces[i] });
    this.commit(before);
    return true;
  }
  /** Picks a placed piece back up into the tray. */
  lift(x: number, y: number): boolean {
    if (!this.canLift(x, y)) { this.events.push({ kind: 'nope', x, y }); return false; }
    const before = this.snap(), i = this.at(x, y), k = TRAY.indexOf(kindOf(this.pieces[i])!);
    this.events.push({ kind: 'lift', x, y, c: this.pieces[i] });
    this.pieces[i] = 0; this.placed[i] = 0; this.left[k]++;
    this.commit(before);
    return true;
  }
  /** Slides a placed piece to another open tile, keeping how it is turned; one step to undo. */
  move(x: number, y: number, tx: number, ty: number): boolean {
    if (!this.canLift(x, y) || !this.canPlace(tx, ty)) { this.events.push({ kind: 'nope', x: tx, y: ty }); return false; }
    const before = this.snap(), i = this.at(x, y), j = this.at(tx, ty);
    this.pieces[j] = this.pieces[i]; this.placed[j] = 1; this.pieces[i] = 0; this.placed[i] = 0;
    this.events.push({ kind: 'place', x: tx, y: ty, c: this.pieces[j] });
    this.commit(before);
    return true;
  }
  get canUndo() { return this.history.length > 0; }
  undo(): boolean {
    const s = this.history.pop(); if (!s) return false;
    const before = this.snap();
    this.pieces = s.pieces; this.placed = s.placed; this.left = s.left;
    this.commit(before); this.history.pop();
    this.events.push({ kind: 'undo' });
    return true;
  }
  /** Back to the starting board (the tray refilled, turned pieces as they began). Undo brings the old board back. */
  reset(): boolean {
    const fresh = Int8Array.from(this.board.fixed);
    if (this.pieces.every((p, i) => p === fresh[i])) return false;
    const before = this.snap();
    this.pieces = fresh; this.placed = new Uint8Array(fresh.length); this.left = trayCounts(this.level.tray);
    this.commit(before);
    this.events.push({ kind: 'reset' });
    return true;
  }

  /** Where one more piece goes, from a fewest-pieces solution that keeps what is already placed. */
  hint(maxNodes = 300000): Hint {
    if (this.won) return { kind: 'won' };
    const b = this.board;
    // quickest: everything placed so far belongs to the stored smallest solution, so point at its next step
    const fresh = solveFresh(this.index >= 0 ? this.index : this.level);
    if (fresh) {
      const want = new Map(fresh.place.map((p) => [p.y * this.w + p.x, p.code]));
      let fits = true;
      for (let i = 0; i < this.pieces.length; i++) if (this.placed[i] && want.get(i) !== this.pieces[i]) fits = false;
      if (fits) {
        const turn = fresh.turn.find((t) => this.pieces[t.y * this.w + t.x] !== t.code);
        if (turn) return { kind: 'turn', x: turn.x, y: turn.y, code: turn.code };
        // fixed pieces the player turned away from how they started must go back too
        for (let i = 0; i < this.pieces.length; i++) if (b.turnable[i] && !fresh.turn.some((t) => t.y * this.w + t.x === i) && this.pieces[i] !== b.fixed[i]) return { kind: 'turn', x: i % this.w, y: Math.floor(i / this.w), code: b.fixed[i] };
        const next = fresh.place.find((p) => !this.placed[p.y * this.w + p.x]);
        if (next) return { kind: 'place', x: next.x, y: next.y, code: next.code };
      }
    }
    // the player's own mirrors and panes, and the fixed ones that turn, may each go either way
    const turnable: number[] = [];
    for (let i = 0; i < this.pieces.length; i++) if (turns(this.pieces[i]) && (this.placed[i] || b.turnable[i])) turnable.push(i);
    const r = search(b, this.pieces, this.left.slice(), turnable, { maxNodes });
    if (r.solvable && r.solution) {
      const s = r.solution;
      if (s.turn.length) { const t = s.turn[0]; return { kind: 'turn', x: t.x, y: t.y, code: t.code }; }
      if (s.place.length) { const p = s.place[0]; return { kind: 'place', x: p.x, y: p.y, code: p.code }; }
    }
    return { kind: 'stuck', fresh };
  }

  stars(): StarReport {
    const t = this.traced, used = this.used, par = this.par;
    const solved = t.won, firefly = solved && t.firefly, thrifty = solved && used <= par;
    return { solved, firefly, thrifty, stars: (solved ? 1 : 0) + (firefly ? 1 : 0) + (thrifty ? 1 : 0), used, par };
  }
}

const freshCache = new Map<string, Solution | null>();
/** A fewest-pieces solution from the starting board (cached: the levels never change). */
export function solveFresh(level: number | LevelDef): Solution | null {
  const L = typeof level === 'number' ? LEVELS[level] : level;
  if (!freshCache.has(L.id)) freshCache.set(L.id, solveLevel(L).solution);
  return freshCache.get(L.id)!;
}

// ---- saving
export type Profile = { v: 1; stars: Record<string, number>; solved: Record<string, boolean>; sound: boolean; level: number };
export const freshProfile = (): Profile => ({ v: 1, stars: {}, solved: {}, sound: true, level: 0 });
export function readProfile(raw: string | null): Profile {
  const p = freshProfile();
  if (!raw) return p;
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || j.v !== 1) return p;
    for (const L of LEVELS) {
      const s = j.stars?.[L.id];
      if (Number.isFinite(s)) p.stars[L.id] = Math.max(0, Math.min(3, Math.floor(s)));
      if (j.solved?.[L.id] === true) p.solved[L.id] = true;
      if (p.stars[L.id] > 0) p.solved[L.id] = true;
    }
    if (Number.isInteger(j.level) && j.level >= 0 && j.level < LEVELS.length) p.level = j.level;
    if (typeof j.sound === 'boolean') p.sound = j.sound;
  } catch { /* a broken save starts fresh */ }
  return p;
}
export const unlocked = (p: Profile, i: number) => i === 0 || (i > 0 && i < LEVELS.length && p.solved[LEVELS[i - 1].id] === true);
export const totalStars = (p: Profile) => LEVELS.reduce((a, L) => a + (p.stars[L.id] ?? 0), 0);
export const allSolved = (p: Profile) => LEVELS.every((L) => p.solved[L.id]);
/** The first level not yet solved (or the last one when every level is). */
export const nextUnsolved = (p: Profile) => { const i = LEVELS.findIndex((L) => !p.solved[L.id]); return i < 0 ? LEVELS.length - 1 : i; };
/** Keeps the best stars, and returns the kind words for anything new. */
export function record(p: Profile, index: number, s: StarReport): string[] {
  const L = LEVELS[index], news: string[] = [];
  if (!s.solved) return news;
  if (!p.solved[L.id]) {
    news.push('Lanterns relit!');
    if (index + 1 < LEVELS.length) news.push(LEVELS[index + 1].chapter !== L.chapter ? `${CHAPTERS[LEVELS[index + 1].chapter].name} is open` : `${LEVELS[index + 1].name} is open`);
  } else if (s.stars > (p.stars[L.id] ?? 0)) news.push('More stars!');
  p.solved[L.id] = true;
  p.stars[L.id] = Math.max(p.stars[L.id] ?? 0, s.stars);
  return news;
}

// ---- chapters and levels
export const CHAPTERS = [
  { id: 'meadow', name: 'Meadow Lanterns', color: '#7fd08a', blurb: 'Bounce moonlight off mirrors to the meadow lanterns. Mind the sleeping kits.' },
  { id: 'candy', name: 'Candy Glass', color: '#ff8fb0', blurb: 'Candy glass tints the light. Mix rose, leaf and sky right at the lantern.' },
  { id: 'crystal', name: 'Crystal Grotto', color: '#9a8cff', blurb: 'Crystal panes split a beam in two, and prisms fan moonwhite into three.' },
  { id: 'festival', name: 'Festival Night', color: '#ffc75a', blurb: 'Burrows carry light under the hill. Light the whole festival!' },
] as const;

export const LEVELS: LevelDef[] = [
  // ---- 1 · Meadow Lanterns: mirrors
  { id: 'm1', name: 'First Light', chapter: 0, par: 0, tray: {}, tip: 'Tap the mirror to turn it. Moonlight bounces off it towards the lantern.',
    grid: [',,.....', '.>..[..', '.......', '....*..', '....w..'] },
  { id: 'm2', name: 'Bend in the Path', chapter: 0, par: 0, tray: {}, tip: 'Mirrors with a little gold arrow can be turned. Follow the light from the moon window.',
    grid: [',......', '>..[..,', '.......', '...[.*w', ',,.....'] },
  { id: 'm3', name: 'Pocket Mirror', chapter: 0, par: 1, tray: { mirror: 1 }, tip: 'Drag a mirror from the tray onto the grass (or tap it, then tap a tile). Tap it again to turn it.',
    grid: ['.......', '.>.....', '.....*.', '.....w.', ',,,....'] },
  { id: 'm4', name: 'Stepping Stones', chapter: 0, par: 2, tray: { mirror: 2 }, tip: 'Rocks stop the light, and nothing can stand on the clover.',
    grid: ['..#....', '>....#.', '.,.....', '.#.,*..', '...#..w'] },
  { id: 'm5', name: 'Tiptoe Around', chapter: 0, par: 3, tray: { mirror: 3 }, tip: 'Shh! Light on a sleeping kit wakes it up. Steer the moonlight around.',
    grid: ['.......', '.......', '>..z..w', '.......', '...*...'] },
  { id: 'm6', name: 'Two Moons', chapter: 0, par: 2, tray: { mirror: 2 }, tip: 'Two moon windows, two lanterns. Beams cross each other without bumping.',
    grid: ['.v.....', '.......', '.......', '>......', '.......', '..*.w.w'] },
  { id: 'm7', name: 'Clover Maze', chapter: 0, par: 4, tray: { mirror: 5 },
    grid: ['>..#....', '.,#.....', ',..z....', '.,*.....', '.#......', '......w.'] },
  { id: 'm8', name: 'Meadow Lights', chapter: 0, par: 3, tray: { mirror: 4 }, tip: 'A mirror shines on both sides. One can catch two moonbeams at once.',
    grid: ['z.v.w..,.', '.......#.', '.#.......', '>.......<', '.......#.', ',.[..*..z', '#...w...w'] },

  // ---- 2 · Candy Glass: tinting and mixing
  { id: 'c1', name: 'Rose Window', chapter: 1, par: 1, tray: { rose: 1 }, tip: 'Moonwhite holds every colour, so this rose lantern is too bright. Rose glass lets only rose through.',
    grid: ['.......', '.>..*.r', '.......', ',,...,,', '.......'] },
  { id: 'c2', name: 'Pick a Pane', chapter: 1, par: 3, tray: { rose: 1, leaf: 1, sky: 1 }, tip: 'Each lantern’s little tag shows the colour it wants.',
    grid: ['...v...', '>.....r', '.......', '...*...', '>.....b', '...g...'] },
  { id: 'c3', name: 'Tinted Corner', chapter: 1, par: 3, tray: { mirror: 2, sky: 1, rose: 1 },
    grid: ['.......', '>...z..', '.......', '.#.....', '....*.b', '.......'] },
  { id: 'c4', name: 'Honey Mix', chapter: 1, par: 3, tray: { mirror: 1, rose: 1, leaf: 1 }, tip: 'Light mixes at a lantern: rose and leaf together glow honey.',
    grid: ['.......', '.......', '.......', '>.*.y..', '.......', '......<'] },
  { id: 'c5', name: 'Too Bright', chapter: 1, par: 3, tray: { mirror: 1, rose: 1, sky: 1, leaf: 1 }, tip: 'Three beams, but plum needs only rose and sky. Send the extra moonlight somewhere useful.',
    grid: ['....v...', '........', '........', '>...p..<', '.*......', '.w......'] },
  { id: 'c6', name: 'Candy Shield', chapter: 1, par: 3, tray: { mirror: 1, sky: 1, leaf: 1 }, sources: [MOONWHITE, ROSE, LEAF], tip: 'Some moon windows shine through coloured paper. Glass of another colour stops a beam dead.',
    grid: ['...v....', '...*....', '>.....m.', '........', '........', '...z..^.'] },
  { id: 'c7', name: 'Night Market', chapter: 1, par: 4, tray: { mirror: 3, sky: 1, rose: 1 }, sources: [SKY, ROSE, MOONWHITE],
    grid: ['..v.....', '........', '>.......', '........', '.....p.b', '>*.,..,.'] },
  { id: 'c8', name: 'Candy Market', chapter: 1, par: 5, tray: { mirror: 3, rose: 1, leaf: 1 }, sources: [ROSE, MOONWHITE, MOONWHITE, SKY],
    grid: ['.v,,..,..', '..,..,...', '..,,y,#,,', '>,*..,,.<', '..,,p,..z', '.,,.##,.,', '.,.,...^.'] },

  // ---- 3 · Crystal Grotto: crystal panes and prisms
  { id: 'g1', name: 'Crystal Pane', chapter: 2, par: 1, tray: { splitter: 1 }, tip: 'A crystal pane lets light straight through and bounces a copy off to the side.',
    grid: ['.......', '>.....w', '...*...', '.......', '...w...'] },
  { id: 'g2', name: 'Both Ways', chapter: 2, par: 3, tray: { splitter: 1, mirror: 2 },
    grid: ['..w.....', '..*.....', '......,.', '>...#...', '........', '..z.....', '...,..w.'] },
  { id: 'g3', name: 'Rainbow', chapter: 2, par: 1, tray: { prism: 1 }, tip: 'A prism fans moonwhite out: rose turns left, leaf goes straight on, sky turns right.',
    grid: ['...r...', '.......', '>.....g', '...*...', '...b...'] },
  { id: 'g4', name: 'Prism Corners', chapter: 2, par: 3, tray: { prism: 1, mirror: 2 },
    grid: ['........', '.r......', '........', '>.*.#...', '........', '......g.', '.b......'] },
  { id: 'g5', name: 'Prism Honey', chapter: 2, par: 3, tray: { prism: 1, mirror: 2 }, tip: 'Bring a prism’s rose and leaf back together and they glow honey again.',
    grid: ['...*....', '..,.....', '>......y', '........', '........', '........', '..b.....'] },
  { id: 'g6', name: 'Split and Tint', chapter: 2, par: 4, tray: { splitter: 1, mirror: 1, rose: 1, sky: 1 },
    grid: ['.......', '...r...', '.......', '>.*....', '.....,.', '.....b.'] },
  { id: 'g7', name: 'Crystal Crossing', chapter: 2, par: 3, tray: { splitter: 1, mirror: 2 }, sources: [ROSE, SKY], tip: 'Where two beams meet at a crystal pane, they mix and leave together, both ways.',
    grid: ['...p....', '>*,...,,', '........', '........', '.....,.p', '........', '...^....'] },
  { id: 'g8', name: 'Grotto Glow', chapter: 2, par: 4, tray: { prism: 1, splitter: 1, mirror: 2 }, sources: [MOONWHITE, ROSE],
    grid: ['...ry....', '>..*.....', '..z......', '........y', '.........', '.........', '...b^....'] },

  // ---- 4 · Festival Night: burrows, then everything
  { id: 'f1', name: 'Burrow Run', chapter: 3, par: 1, tray: { mirror: 1 }, tip: 'Light that dives into a burrow pops out of its partner (same colour ring), still going the same way.',
    grid: ['...#...', '>..#...', '...#.1.', '.1.#.*.', '...#.w.'] },
  { id: 'f2', name: 'Under the Hill', chapter: 3, par: 2, tray: { mirror: 2 },
    grid: ['........', '>......,', '.1...1..', '.....*#.', '...#,.w.', '........'] },
  { id: 'f3', name: 'Two Tunnels', chapter: 3, par: 3, tray: { mirror: 3 },
    grid: ['..v......', '..*......', '.1...2...', '.....z.,<', '...2...1.', '.........', 'w.......w'] },
  { id: 'f4', name: 'Kit Nursery', chapter: 3, par: 3, tray: { mirror: 2, splitter: 1 },
    grid: ['........', '>.*.....', '.,.1....', '.....z..', '....1.z.', '...#.w.,', '.w#.....'] },
  { id: 'f5', name: 'Rainbow Tunnel', chapter: 3, par: 3, tray: { prism: 1, mirror: 2 },
    grid: ['.........', '>..*1....', '.........', '..r......', '.....1...', '.........', '......b.g'] },
  { id: 'f6', name: 'Mixing Burrow', chapter: 3, par: 4, tray: { mirror: 2, rose: 1, sky: 1 },
    grid: ['........', '>,,1....', '........', '.....,,p', '.......*', '..1.....', '....^...'] },
  { id: 'f7', name: 'Moon Garden', chapter: 3, par: 4, tray: { splitter: 1, mirror: 2, sky: 1 }, sources: [MOONWHITE, LEAF],
    grid: ['.........', '>,,.1....', '.........', '....m*...', '.........', '...1....b', '......#.<'] },
  { id: 'f8', name: 'The Grand Festival', chapter: 3, par: 3, tray: { splitter: 1, mirror: 3 }, sources: [ROSE, SKY, MOONWHITE, LEAF],
    tip: 'Every colour at once! Turn the crystal panes to mix the coloured moonlight, and the prism by the stalls will do the rest.',
    fixed: [{ x: 7, y: 2, code: PRISM }, { x: 3, y: 5, code: PRISM }, { x: 5, y: 4, code: SPLIT_A, turn: true }, { x: 5, y: 2, code: SPLIT_B, turn: true }],
    grid: ['.y..#w,r.', ',.,.,.,.,', '>.......g', ',*,...,.,', 'm.......<', ',...p.,..', '.,#^.^#b.'] },
];
export const levelIndex = (id: string) => LEVELS.findIndex((L) => L.id === id);

// Poof Panic: a versus falling-pair puzzler in the style of Puyo Puyo. The rules, with no DOM.
// A board is a 6 x 13 well (the top row is hidden). Pairs of fluff balls fall in; four or more of one colour touching
// pop, whatever sat on top falls, and a pop caused by that fall is the next link of a chain. Chains turn into dust
// clumps for the other board. Everything advances in fixed ticks from seeded generators, so a seed and a list of
// inputs replay a round exactly.

export const W = 6, H = 13, VISIBLE = 12, SPAWN_X = 2, SPAWN_Y = 11, TPS = 60;
/** Cell values: 0 is empty, 1 to 5 are the colours, 9 is a dust clump. */
export const DUST = 9;
export const COLOURS = ['', 'rose', 'sky', 'mint', 'honey', 'plum'] as const;
export const POP_TICKS = 28, LOCK_TICKS = 32, LOCK_SOFT = 8, READY_TICKS = 10, SOFT = 0.5, MAX_RESETS = 8, FLIP_TICKS = 24;
/** Points that make one dust clump, the most clumps that land at once, and the clumps a clean sweep is worth. */
export const TARGET = 70, MAX_DROP = 30, SWEEP_BONUS = 30;
/** After this many seconds a clump gets cheaper every 16 seconds, so no round lasts for ever. */
export const MARGIN = 96, MARGIN_STEP = 16, MIN_TARGET = 8;
export const CHAIN_POWER = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
export const COLOUR_BONUS = [0, 0, 3, 6, 12, 24];
export const groupBonus = (n: number) => (n <= 4 ? 0 : n >= 11 ? 10 : n - 3);
const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The pairs both boards are dealt, in order. Both players read the same bag, so nobody gets luckier pieces. */
export class Bag {
  private list: number[] = [];
  private roll: () => number;
  constructor(seed: number, readonly colours: number, private fixed?: number[]) { this.roll = rng(seed); if (fixed) this.list = fixed.slice(); }
  /** The pair at a position, or null once a fixed bag runs out. The first two pairs use three colours at most. */
  at(i: number): [number, number] | null {
    if (this.fixed) return i * 2 + 1 < this.list.length ? [this.list[i * 2], this.list[i * 2 + 1]] : null;
    while (this.list.length <= i * 2 + 1) { const n = this.list.length < 4 ? Math.min(3, this.colours) : this.colours; this.list.push(1 + Math.floor(this.roll() * n)); }
    return [this.list[i * 2], this.list[i * 2 + 1]];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The grid on its own: plain functions the board, the rivals and the lesson solver all share.

export const heightOf = (g: Uint8Array, x: number) => { let y = H; while (y > 0 && !g[(y - 1) * W + x]) y--; return y; };
/** Let everything fall straight down. Records how far each cell fell when given somewhere to write it. */
export function collapse(g: Uint8Array, fell?: Uint8Array) {
  let max = 0;
  fell?.fill(0);
  for (let x = 0; x < W; x++) {
    let w = 0;
    for (let y = 0; y < H; y++) {
      const v = g[y * W + x];
      if (!v) continue;
      if (y !== w) { g[w * W + x] = v; g[y * W + x] = 0; if (fell) fell[w * W + x] = y - w; if (y - w > max) max = y - w; }
      w++;
    }
  }
  return max;
}
export type Pops = { cells: number[]; dust: number[]; groups: number[]; colours: number };
const seen = new Uint8Array(W * H), stack = new Int16Array(W * H);
/** Every group of four or more in the visible rows, and the dust clumps touching them. Null when nothing pops. */
export function findPops(g: Uint8Array): Pops | null {
  seen.fill(0);
  let out: Pops | null = null, mask = 0;
  for (let i = 0; i < W * VISIBLE; i++) {
    const c = g[i];
    if (!c || c === DUST || seen[i]) continue;
    let n = 0, top = 0;
    const start = out ? out.cells.length : 0, group: number[] = [];
    stack[top++] = i; seen[i] = 1;
    while (top) {
      const k = stack[--top], x = k % W, y = (k / W) | 0;
      group.push(k); n++;
      if (x > 0 && !seen[k - 1] && g[k - 1] === c) { seen[k - 1] = 1; stack[top++] = k - 1; }
      if (x < W - 1 && !seen[k + 1] && g[k + 1] === c) { seen[k + 1] = 1; stack[top++] = k + 1; }
      if (y > 0 && !seen[k - W] && g[k - W] === c) { seen[k - W] = 1; stack[top++] = k - W; }
      if (y < VISIBLE - 1 && !seen[k + W] && g[k + W] === c) { seen[k + W] = 1; stack[top++] = k + W; }
    }
    if (n < 4) continue;
    out ??= { cells: [], dust: [], groups: [], colours: 0 };
    out.cells.length = start;
    for (const k of group) out.cells.push(k);
    out.groups.push(n); mask |= 1 << c;
  }
  if (!out) return null;
  for (const k of out.cells) {
    const x = k % W, y = (k / W) | 0;
    for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < VISIBLE - 1 ? k + W : -1]) if (j >= 0 && g[j] === DUST && !out.dust.includes(j)) out.dust.push(j);
  }
  for (let c = 1; c <= 5; c++) if (mask & (1 << c)) out.colours++;
  return out;
}
/** The points for one link of a chain: ten a ball, times the chain, colour and group-size bonuses. */
export function stepScore(chain: number, p: Pops) {
  let bonus = CHAIN_POWER[Math.min(chain, CHAIN_POWER.length - 1)] + COLOUR_BONUS[p.colours];
  for (const n of p.groups) bonus += groupBonus(n);
  return 10 * p.cells.length * Math.max(1, Math.min(999, bonus));
}
/** Pop and fall until nothing more pops. Changes the grid it is given. */
export function resolve(g: Uint8Array) {
  let chain = 0, score = 0, popped = 0;
  for (;;) {
    const p = findPops(g);
    if (!p) break;
    chain++; score += stepScore(chain, p); popped += p.cells.length;
    for (const k of p.cells) g[k] = 0;
    for (const k of p.dust) g[k] = 0;
    collapse(g);
  }
  return { chain, score, popped };
}
/** Drop a pair into a settled grid: the first ball in column x, the second where the turn puts it. */
export function land(g: Uint8Array, x: number, rot: number, a: number, b: number) {
  const cx = x + DX[rot];
  if (cx < 0 || cx >= W) return false;
  const put = (col: number, c: number) => { const h = heightOf(g, col); if (h < H) g[h * W + col] = c; };
  if (rot === 2) { put(x, b); put(x, a); } else { put(x, a); put(cx, b); }
  return true;
}
export const isEmpty = (g: Uint8Array) => g.every((v) => !v);
/** A grid from rows of text, top row first: R B G Y P for the colours, D for dust, anything else empty. */
export function gridFrom(rows: string[]) {
  const g = new Uint8Array(W * H);
  rows.forEach((row, i) => { const y = rows.length - 1 - i; for (let x = 0; x < W && x < row.length; x++) g[y * W + x] = LETTER[row[x]] ?? 0; });
  return g;
}
const LETTER: Record<string, number> = { R: 1, B: 2, G: 3, Y: 4, P: 5, D: DUST };

// ---------------------------------------------------------------------------------------------------------------
// One board.

export type Input = { dx?: -1 | 0 | 1; rot?: -1 | 0 | 1; soft?: boolean; plunge?: boolean };
export type Phase = 'ready' | 'fall' | 'drop' | 'pop' | 'settle' | 'dust' | 'over';
export type Pair = { x: number; y: number; rot: number; sub: number; a: number; b: number };
/** How a part row of dust lands: scattered over random columns, or heaped side by side. */
export type DustStyle = 'sprinkle' | 'pile';
export type Cfg = { gravity: number; colours: number; style: DustStyle; float?: boolean };
export type Ev =
  | { t: 'move' } | { t: 'turn' } | { t: 'lock' } | { t: 'over' } | { t: 'sweep' }
  | { t: 'pop'; chain: number; score: number; cells: { x: number; y: number; c: number }[] }
  | { t: 'chain'; chain: number } | { t: 'send'; n: number } | { t: 'offset'; n: number } | { t: 'dust'; n: number };

export class Board {
  grid = new Uint8Array(W * H);
  /** How many rows each cell fell in the fall that is playing now, for the scene. */
  fell = new Uint8Array(W * H);
  phase: Phase = 'ready';
  timer = READY_TICKS; span = READY_TICKS; speed = 0.5;
  pair: Pair | null = null;
  index = -1;
  lockTimer = 0; resets = 0; armed = -99; plunging = false;
  score = 0; chain = 0; best = 0; popped = 0; placed = 0; sent = 0; sweeps = 0;
  /** Dust waiting above the board, dust the rival's unfinished chain is still adding to, and points left over. */
  pending = 0; incoming = 0; carry = 0;
  bonus = false; fired = false;
  popping: number[] = [];
  tick = 0; lost = false; spent = false;
  events: Ev[] = [];
  rival: Board | null = null;
  private roll: () => number;

  constructor(readonly bag: Bag, readonly cfg: Cfg, seed: number) { this.roll = rng(seed); }

  at(x: number, y: number) { return x < 0 || x >= W || y < 0 ? -1 : y >= H ? 0 : this.grid[y * W + x]; }
  /** The pairs coming after the one in play. */
  peek(n: number) { return this.bag.at(this.index + n); }
  /** Points one dust clump costs right now. */
  target() { const s = this.tick / TPS; return s < MARGIN ? TARGET : Math.max(MIN_TARGET, Math.floor(TARGET * 0.75 ** (Math.floor((s - MARGIN) / MARGIN_STEP) + 1))); }
  fits(x: number, y: number, rot: number) { return this.at(x, y) === 0 && this.at(x + DX[rot], y + DY[rot]) === 0; }
  /** Where the pair in play would come to rest if dropped now. */
  ghost() {
    const p = this.pair;
    if (!p) return [];
    const cx = p.x + DX[p.rot], h = heightOf(this.grid, p.x);
    if (p.rot === 0) return [{ x: p.x, y: h, c: p.a }, { x: p.x, y: h + 1, c: p.b }];
    if (p.rot === 2) return [{ x: p.x, y: h, c: p.b }, { x: p.x, y: h + 1, c: p.a }];
    return [{ x: p.x, y: h, c: p.a }, { x: cx, y: heightOf(this.grid, cx), c: p.b }];
  }

  step(input: Input = {}) {
    if (this.phase === 'over') return;
    this.tick++;
    if (this.phase === 'fall') return this.control(input);
    if (--this.timer > 0) return;
    if (this.phase === 'ready' || this.phase === 'dust') return this.next();
    if (this.phase === 'pop') {
      for (const k of this.popping) this.grid[k] = 0;
      this.popping = [];
      return this.wait('settle', collapse(this.grid, this.fell));
    }
    this.check();
  }
  private wait(phase: Phase, rows: number, speed = 0.5) { this.phase = phase; this.speed = speed; this.timer = this.span = Math.ceil(rows / speed) + 6; }

  private grounded(p: Pair) { return !this.fits(p.x, p.y - 1, p.rot); }
  private touch() { if (this.pair && this.grounded(this.pair) && this.resets < MAX_RESETS) { this.resets++; this.lockTimer = 0; } }
  private shift(dx: number) {
    const p = this.pair!;
    if (!this.fits(p.x + dx, p.y, p.rot)) return;
    p.x += dx; this.touch(); this.events.push({ t: 'move' });
  }
  private turn(dir: number) {
    const p = this.pair!, to = (p.rot + dir + 4) % 4;
    if (this.fits(p.x, p.y, to)) p.rot = to;
    else if (to % 2 === 1 && this.fits(p.x - DX[to], p.y, to)) { p.x -= DX[to]; p.rot = to; }
    else if (to === 2 && this.fits(p.x, p.y + 1, to)) { p.y++; p.sub = 0; p.rot = to; }
    // Walled in on both sides: a second press within a moment swaps the two balls instead.
    else if (to % 2 === 1 && this.tick - this.armed <= FLIP_TICKS) { [p.a, p.b] = [p.b, p.a]; this.armed = -99; }
    else { this.armed = this.tick; return; }
    this.touch(); this.events.push({ t: 'turn' });
  }
  private control(input: Input) {
    const p = this.pair!;
    if (input.rot) this.turn(input.rot);
    if (input.dx) this.shift(input.dx);
    if (input.plunge) this.plunging = true;
    const soft = !!input.soft || this.plunging;
    if (this.grounded(p)) {
      p.sub = 0;
      this.lockTimer += soft ? LOCK_SOFT : 1;
      if (this.lockTimer >= LOCK_TICKS) this.lock();
      return;
    }
    p.sub += soft ? Math.max(SOFT, this.cfg.gravity) : this.cfg.float ? 0 : this.cfg.gravity;
    while (p.sub >= 1) { p.y--; p.sub -= 1; if (soft) this.score++; if (this.grounded(p)) { p.sub = 0; break; } }
  }
  private lock() {
    const p = this.pair!, cx = p.x + DX[p.rot], cy = p.y + DY[p.rot];
    if (p.y < H) this.grid[p.y * W + p.x] = p.a;
    if (cy < H) this.grid[cy * W + cx] = p.b;
    this.pair = null; this.placed++; this.chain = 0; this.fired = false;
    this.events.push({ t: 'lock' });
    this.wait('drop', collapse(this.grid, this.fell));
  }
  private check() {
    const pops = findPops(this.grid);
    if (pops) {
      this.chain++; this.fired = true; this.best = Math.max(this.best, this.chain); this.popped += pops.cells.length;
      const pts = stepScore(this.chain, pops), goal = this.target();
      this.score += pts;
      let n = Math.floor((pts + this.carry) / goal);
      this.carry = (pts + this.carry) % goal;
      if (this.bonus) { n += SWEEP_BONUS; this.bonus = false; }
      this.events.push({ t: 'pop', chain: this.chain, score: pts, cells: pops.cells.map((k) => ({ x: k % W, y: (k / W) | 0, c: this.grid[k] })) });
      this.popping = [...pops.cells, ...pops.dust];
      if (n) this.give(n);
      this.phase = 'pop'; this.timer = this.span = POP_TICKS;
      return;
    }
    if (this.fired) {
      this.events.push({ t: 'chain', chain: this.chain });
      // The chain is over, so what it sent may now fall on the rival.
      if (this.rival) { this.rival.pending += this.rival.incoming; this.rival.incoming = 0; }
      if (isEmpty(this.grid)) { this.bonus = true; this.sweeps++; this.events.push({ t: 'sweep' }); }
    } else if (this.pending > 0) return this.dustFall();
    this.next();
  }
  /** Dust made by a pop first cancels dust aimed at this board; only what is left goes to the rival. */
  private give(n: number) {
    const a = Math.min(n, this.pending), b = Math.min(n - a, this.incoming), left = n - a - b;
    this.pending -= a; this.incoming -= b;
    if (a + b) this.events.push({ t: 'offset', n: a + b });
    if (left && this.rival) { this.rival.incoming += left; this.sent += left; this.events.push({ t: 'send', n: left }); }
  }
  private dustFall() {
    const n = Math.min(this.pending, MAX_DROP), rows = Math.floor(n / W), rem = n % W, count = Array.from({ length: W }, () => rows);
    this.pending -= n;
    if (this.cfg.style === 'pile') { const from = Math.floor(this.roll() * (W - rem + 1)); for (let i = 0; i < rem; i++) count[from + i]++; }
    else { const cols = [0, 1, 2, 3, 4, 5]; for (let i = 0; i < rem; i++) count[cols.splice(Math.floor(this.roll() * cols.length), 1)[0]]++; }
    this.fell.fill(0);
    let max = 0;
    for (let x = 0; x < W; x++) {
      let h = heightOf(this.grid, x);
      for (let k = 0; k < count[x] && h < H; k++, h++) { this.grid[h * W + x] = DUST; const f = H + 1 - h + k; this.fell[h * W + x] = f; if (f > max) max = f; }
    }
    this.events.push({ t: 'dust', n });
    this.wait('dust', max, 0.9);
  }
  private next() {
    if (this.grid[SPAWN_Y * W + SPAWN_X]) { this.phase = 'over'; this.lost = true; this.events.push({ t: 'over' }); return; }
    const p = this.bag.at(this.index + 1);
    if (!p) { this.phase = 'over'; this.spent = true; return; }
    this.index++;
    this.pair = { x: SPAWN_X, y: SPAWN_Y, rot: 0, sub: 0, a: p[0], b: p[1] };
    this.lockTimer = 0; this.resets = 0; this.plunging = false; this.armed = -99;
    this.phase = 'fall';
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Keys and touches turned into one input a tick.

export const DAS = 10, ARR = 2;
/** Held keys with auto-repeat, plus one-off taps. The page feeds it; the loop polls it once a tick. */
export class Pad {
  left = -1; right = -1; down = false;
  private turns: number[] = [];
  private steps: number[] = [];
  private plunge = false;
  hold(key: 'left' | 'right' | 'down', on: boolean) {
    if (key === 'down') this.down = on;
    // A press moves once whatever happens next, so a tap shorter than a tick is not lost; holding on repeats.
    else if (on) { if (this[key] < 0) { this[key] = 0; this.steps.push(key === 'left' ? -1 : 1); } const other = key === 'left' ? 'right' : 'left'; if (this[other] >= 0) this[other] = this[key] + 1; }
    else this[key] = -1;
  }
  tap(what: 'cw' | 'ccw' | 'left' | 'right' | 'plunge') {
    if (what === 'cw') this.turns.push(1); else if (what === 'ccw') this.turns.push(-1);
    else if (what === 'left') this.steps.push(-1); else if (what === 'right') this.steps.push(1); else this.plunge = true;
  }
  clear() { this.left = this.right = -1; this.down = false; this.turns = []; this.steps = []; this.plunge = false; }
  poll(): Input {
    const out: Input = { soft: this.down };
    const rot = this.turns.shift(), step = this.steps.shift();
    if (rot) out.rot = rot as 1 | -1;
    if (this.plunge) { out.plunge = true; this.plunge = false; }
    // The key pressed last wins when both are down; a held key waits, then repeats.
    const key = this.left >= 0 && (this.right < 0 || this.left <= this.right) ? 'left' : this.right >= 0 ? 'right' : null;
    if (step) out.dx = step as 1 | -1;
    else if (key) { const n = this[key]; if (n >= DAS && (n - DAS) % ARR === 0) out.dx = key === 'left' ? -1 : 1; }
    if (this.left >= 0) this.left++;
    if (this.right >= 0) this.right++;
    return out;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The rivals.

export type Rival = {
  id: string; name: string; kind: string; title: string; blurb: string;
  /** Ticks spent looking at a new pair, ticks between each move, and how hard it pushes the pair down (0 to 1). */
  think: number; pace: number; drop: number;
  /** Pairs it plans ahead (1 or 2), the shortest chain it sets off on purpose, and how much it values a chain in waiting. */
  depth: 1 | 2; greed: number; sight: number;
  /** The chance a pair is put down anywhere, and the chance it takes a small pop just to send something. */
  slip: number; poke: number;
  gravity: number; style: DustStyle;
};
export const RIVALS: Rival[] = [
  { id: 'mole', name: 'Mossy', kind: 'mole', title: 'the Mole', blurb: 'Half asleep and short-sighted. Stacks wherever there is room and pops whatever turns up.', think: 50, pace: 16, drop: 0.1, depth: 1, greed: 1, sight: 0, slip: 0.5, poke: 1, gravity: 1 / 44, style: 'sprinkle' },
  { id: 'skunk', name: 'Pongo', kind: 'skunk', title: 'the Skunk', blurb: 'Pops everything the moment it can. Never much dust at once, but it never stops coming.', think: 42, pace: 13, drop: 0.2, depth: 1, greed: 1, sight: 0.15, slip: 0.36, poke: 1, gravity: 1 / 40, style: 'sprinkle' },
  { id: 'weasel', name: 'Whip', kind: 'weasel', title: 'the Weasel', blurb: 'Quick paws. Sets up two-chains and fires them before you have settled in.', think: 28, pace: 10, drop: 0.4, depth: 1, greed: 2, sight: 0.6, slip: 0.16, poke: 0.25, gravity: 1 / 36, style: 'pile' },
  { id: 'badger', name: 'Brock', kind: 'badger', title: 'the Badger', blurb: 'Stubborn and tidy. Builds three-chains and answers your dust with some of its own.', think: 24, pace: 10, drop: 0.45, depth: 1, greed: 3, sight: 1, slip: 0.1, poke: 0.1, gravity: 1 / 32, style: 'sprinkle' },
  { id: 'owl', name: 'Professor Hoot', kind: 'owl', title: 'the Owl', blurb: 'Patient. Waits for a four-chain and does not mind how long it takes. Leave the professor alone and you will regret it.', think: 20, pace: 8, drop: 0.55, depth: 1, greed: 4, sight: 1, slip: 0.06, poke: 0.05, gravity: 1 / 28, style: 'pile' },
  { id: 'cougar', name: 'Sierra', kind: 'cougar', title: 'the Cougar', blurb: 'Queen of the dust bath. Plans two pairs ahead, and is building a four-chain while you read this.', think: 16, pace: 7, drop: 0.65, depth: 2, greed: 4, sight: 1, slip: 0.04, poke: 0.03, gravity: 1 / 24, style: 'sprinkle' },
];
export const RIVAL = Object.fromEntries(RIVALS.map((r) => [r.id, r])) as Record<string, Rival>;
/** The same rival on the hard ladder: quicker, tidier, and greedier for chains. */
export const harder = (r: Rival): Rival => ({ ...r, think: Math.round(r.think * 0.6), pace: Math.max(3, Math.round(r.pace * 0.65)), drop: Math.min(1, r.drop + 0.25), depth: r.greed >= 2 ? 2 : r.depth, greed: r.greed + (r.greed >= 2 ? 1 : 0), sight: Math.min(1, r.sight + 0.4), slip: r.slip * 0.4, gravity: r.gravity * 1.3 });

export type HeroId = 'dora' | 'enzo';
export const HEROES: Record<HeroId, { name: string; style: DustStyle; text: string }> = {
  dora: { name: 'Dora', style: 'sprinkle', text: 'Sprinkle: the odd clumps of her dust scatter across the rival’s columns.' },
  enzo: { name: 'Enzo', style: 'pile', text: 'Heap: the odd clumps of his dust land side by side in one heap.' },
};

const heights = (g: Uint8Array) => { const hs: number[] = []; for (let x = 0; x < W; x++) hs.push(heightOf(g, x)); return hs; };
function links(g: Uint8Array) {
  let n = 0;
  for (let i = 0; i < W * VISIBLE; i++) { const c = g[i]; if (!c || c === DUST) continue; if (i % W < W - 1 && g[i + 1] === c) n++; if (i + W < W * VISIBLE && g[i + W] === c) n++; }
  return n;
}
/** The best chain one more ball could set off: [links, points]. This is what a rival means by a chain in waiting. */
export function potential(g: Uint8Array, hs = heights(g)): [number, number] {
  let chain = 0, score = 0;
  for (let x = 0; x < W; x++) {
    const h = hs[x];
    if (h >= VISIBLE - 1) continue;
    const k = h * W + x, tried: number[] = [];
    for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, h > 0 ? k - W : -1]) {
      const c = j >= 0 ? g[j] : 0;
      if (!c || c === DUST || tried.includes(c)) continue;
      tried.push(c);
      const t = g.slice(); t[k] = c;
      const r = resolve(t);
      if (r.chain > chain || (r.chain === chain && r.score > score)) { chain = r.chain; score = r.score; }
    }
  }
  return [chain, score];
}
export const PLACES: { x: number; rot: number }[] = [];
for (let rot = 0; rot < 4; rot++) for (let x = 0; x < W; x++) if (x + DX[rot] >= 0 && x + DX[rot] < W) PLACES.push({ x, rot });
/** Whether a pair can be walked from the spawn column to a placement without a full column in the way. */
export function reachable(hs: number[], x: number, rot: number) {
  const cx = x + DX[rot], lo = Math.min(SPAWN_X, x, cx), hi = Math.max(SPAWN_X, x, cx);
  for (let c = lo; c <= hi; c++) if (hs[c] > SPAWN_Y) return false;
  return true;
}

/** A rival's head: picks where each pair goes, then walks it there one press at a time like a player would. */
export class Brain {
  plan: { x: number; rot: number } | null = null;
  private seen = -1; private wait = 0; private beat = 0; private push = 0; private stuck = 0;
  private roll: () => number;
  constructor(readonly def: Rival, seed: number) { this.roll = rng(seed); }

  step(me: Board): Input {
    const p = me.pair;
    if (me.phase !== 'fall' || !p) return {};
    if (me.index !== this.seen) { this.seen = me.index; this.wait = this.def.think; this.plan = null; this.beat = 0; this.stuck = 0; }
    if (this.wait > 0) { this.wait--; return {}; }
    this.plan ??= this.choose(me);
    const plan = this.plan, there = p.x === plan.x && p.rot === plan.rot;
    if (there || this.stuck > 8) { this.push += this.def.drop; if (this.push >= 1) { this.push -= 1; return { soft: true }; } return {}; }
    if (++this.beat < this.def.pace) return {};
    this.beat = 0; this.stuck++;
    if (p.rot !== plan.rot) return { rot: (plan.rot - p.rot + 4) % 4 === 3 ? -1 : 1 };
    return { dx: plan.x < p.x ? -1 : 1 };
  }

  private value(g: Uint8Array) {
    if (g[SPAWN_Y * W + SPAWN_X]) return -1e9;
    const hs = heights(g);
    let v = 5 * links(g);
    for (let x = 0; x < W; x++) v -= hs[x] * hs[x] * 0.5;
    v -= 40 * Math.max(0, hs[SPAWN_X] - 7) ** 2 + 8 * Math.max(0, hs[SPAWN_X + 1] - 9) ** 2 + 8 * Math.max(0, hs[SPAWN_X - 1] - 9) ** 2;
    if (this.def.sight) { const [chain, score] = potential(g, hs); v += this.def.sight * (90 * chain + score * 0.02); }
    return v;
  }
  private choose(me: Board) {
    const p = me.pair!, hs = heights(me.grid), d = this.def;
    const open = PLACES.filter((q) => reachable(hs, q.x, q.rot));
    if (!open.length) return { x: p.x, rot: p.rot };
    if (this.roll() < d.slip) return open[Math.floor(this.roll() * open.length)];
    const threat = me.pending + me.incoming;
    let filled = 0;
    for (const h of hs) filled += h;
    const danger = hs[SPAWN_X] >= 9 || Math.max(...hs) >= 11 || filled >= 46 || threat >= 6, poke = this.roll() < d.poke, next = d.depth === 2 ? me.peek(1) : null;
    // A chain worth setting off: long enough, or the board is in trouble, or it would wipe the board clean.
    const fire = (g: Uint8Array, r: { chain: number; score: number }) => (r.chain >= d.greed || danger || poke || isEmpty(g) ? 2000 + r.score + (threat && r.score >= threat * TARGET ? 600 : 0) : -400);
    let best = open[0], top = -Infinity;
    for (const q of open) {
      const g = me.grid.slice();
      land(g, q.x, q.rot, p.a, p.b);
      const r = resolve(g);
      let v = this.value(g);
      if (r.chain) v += fire(g, r);
      else if (next && v > -1e8) {
        let after = -Infinity;
        const h2 = heights(g);
        for (const q2 of PLACES) {
          if (!reachable(h2, q2.x, q2.rot)) continue;
          const g2 = g.slice();
          land(g2, q2.x, q2.rot, next[0], next[1]);
          const r2 = resolve(g2), v2 = this.value(g2) + (r2.chain ? fire(g2, r2) : 0);
          if (v2 > after) after = v2;
        }
        if (after > -Infinity) v = 0.3 * v + 0.7 * after;
      }
      v += this.roll() * 4;
      if (v > top) { top = v; best = q; }
    }
    return best;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The ways to play.

export type MatchOpts = { seed: number; rival: Rival; hero: HeroId; colours?: number; gravity?: number };
/** One round against a rival: two boards dealt the same pairs, trading dust until one of them tops out. */
export class Match {
  a: Board; b: Board; brain: Brain;
  tick = 0;
  /** -1 while playing, 0 when the player wins, 1 when the rival does, 2 when both top out on the same tick. */
  winner: -1 | 0 | 1 | 2 = -1;
  constructor(readonly opts: MatchOpts) {
    const colours = opts.colours ?? 4, bag = new Bag(opts.seed, colours);
    this.a = new Board(bag, { gravity: opts.gravity ?? opts.rival.gravity, colours, style: opts.rival.style }, opts.seed + 101);
    this.b = new Board(bag, { gravity: opts.rival.gravity, colours, style: HEROES[opts.hero].style }, opts.seed + 202);
    this.a.rival = this.b; this.b.rival = this.a;
    this.brain = new Brain(opts.rival, opts.seed + 303);
  }
  step(input: Input = {}) {
    if (this.winner >= 0) return;
    const theirs = this.brain.step(this.b);
    this.a.step(input); this.b.step(theirs); this.tick++;
    if (this.a.lost || this.b.lost) this.winner = this.a.lost && this.b.lost ? 2 : this.a.lost ? 1 : 0;
  }
}

export const ENDLESS_STEP = 12, ENDLESS_DUST_FROM = 4;
export const endlessGravity = (level: number) => Math.min(0.5, (1 / 40) * 1.2 ** (level - 1));
/** Solo play: the pairs fall faster every twelve placed, and from level 4 each new level blows some dust in. */
export class Endless {
  board: Board;
  level = 1;
  constructor(readonly seed: number, colours = 4) { this.board = new Board(new Bag(seed, colours), { gravity: endlessGravity(1), colours, style: 'sprinkle' }, seed + 101); }
  get over() { return this.board.phase === 'over'; }
  step(input: Input = {}) {
    this.board.step(input);
    const level = 1 + Math.floor(this.board.placed / ENDLESS_STEP);
    if (level === this.level) return;
    this.level = level; this.board.cfg.gravity = endlessGravity(level);
    if (level >= ENDLESS_DUST_FROM) this.board.pending += Math.min(12, level - 1);
  }
}

export type Goal = { chain: number } | { sweep: true } | { dust: true };
export type Lesson = { id: string; title: string; idea: string; hint: string; rows: string[]; pairs: string; goal: Goal };
export const goalText = (g: Goal) => ('chain' in g ? `Make a ${g.chain}-chain` : 'sweep' in g ? 'Pop every fluff ball' : 'Clear every dust clump');
export const LESSONS: Lesson[] = [
  { id: 'four', title: 'Four of a kind', idea: 'Four fluff balls of one colour that touch will pop.', hint: 'Put the rose ball next to the three already down.', rows: ['RRR...'], pairs: 'RB', goal: { chain: 1 } },
  { id: 'split', title: 'Split the pair', idea: 'A pair laid flat comes apart: each ball falls on its own.', hint: 'Lay the pair flat: the sky ball on the sky row, the mint ball down the gap.', rows: ['.....G', 'BBB.GG'], pairs: 'BG', goal: { sweep: true } },
  { id: 'two', title: 'One thing leads to another', idea: 'When a pop lets other balls fall into a new group, that is a chain.', hint: 'Pop the rose balls. The sky ball sitting on them falls beside its friends.', rows: ['.B....', '.RB...', '.RB...', '.RB...'], pairs: 'RR', goal: { chain: 2 } },
  { id: 'stairs', title: 'Stairs', idea: 'Three of a colour in a column with the next colour on top, again and again: the classic staircase.', hint: 'Start at the left. Each step drops its cap onto the next step.', rows: ['.BG...', '.RBG..', '.RBG..', '.RBG..'], pairs: 'RY', goal: { chain: 3 } },
  { id: 'sandwich', title: 'Sandwich', idea: 'Two halves of one colour with another colour between them. Pop the filling and the halves meet.', hint: 'Stand the sky pair on the mint balls so it touches the filling.', rows: ['R.....', 'R.....', 'B.....', 'B.....', 'RG....', 'RG....'], pairs: 'BB', goal: { chain: 2 } },
  { id: 'dust', title: 'Dust off', idea: 'Dust clumps never match. They vanish when a pop happens right beside them.', hint: 'The honey group touches every clump. Finish it.', rows: ['DYD...', 'DYD...', 'DYD...'], pairs: 'YR', goal: { dust: true } },
  { id: 'build-two', title: 'Build your own', idea: 'Now set the chain up yourself: finish the second step, then pull the trigger.', hint: 'Cap the rose column with the mint ball, then drop a rose ball at the far left.', rows: ['.RG...', '.RG...', '.RG...'], pairs: 'GB RY', goal: { chain: 2 } },
  { id: 'sweep', title: 'Clean sweep', idea: 'Empty the whole board and your next pop sends thirty extra clumps.', hint: 'Lay the first pair flat so both colours pop at once, then drop the last pair on what is left.', rows: ['Y.....', 'Y.....', 'RRRBBB'], pairs: 'RB YY', goal: { sweep: true } },
  { id: 'three', title: 'Three steps', idea: 'Two steps are built. Add the third and fire.', hint: 'Cap the sky column with mint, stand mint beside it, then start from the left.', rows: ['.B....', '.RB...', '.RB...', '.RBG..'], pairs: 'GG GY RR', goal: { chain: 3 } },
  { id: 'dig', title: 'Dig out', idea: 'A clump in the way goes when something pops beside it, and whatever stood on it falls into the gap.', hint: 'Stand the pair upright on the clumps, honey ball at the bottom.', rows: ['R.Y...', 'RDY...', 'RDY...'], pairs: 'YR', goal: { chain: 2 } },
  { id: 'tail', title: 'Long fuse', idea: 'One flat pair can finish two jobs at once: a cap for one step and the third ball of the next.', hint: 'Lay the honey pair flat across the mint column and the short honey column, then light the fuse on the left.', rows: ['.BG...', '.RBG..', '.RBGY.', '.RBGY.'], pairs: 'YY RP', goal: { chain: 4 } },
  { id: 'five', title: 'Five alarm', idea: 'A full staircase. Finish the missing step and set off all five.', hint: 'One plum ball is missing from the last step. Place it, then go back to the start.', rows: ['.BGYP.', '.RBGY.', '.RBGYP', '.RBGYP'], pairs: 'PG RG', goal: { chain: 5 } },
];
const pairList = (text: string) => text.replace(/\s+/g, '').split('').map((ch) => LETTER[ch]);
/** A lesson in play: a set board, a few set pairs that wait until you drop them, and one thing to do. */
export class Drill {
  board: Board;
  constructor(readonly lesson: Lesson) {
    this.board = new Board(new Bag(1, 5, pairList(lesson.pairs)), { gravity: 0, colours: 5, style: 'sprinkle', float: true }, 1);
    this.board.grid.set(gridFrom(lesson.rows));
  }
  get pairsLeft() { return pairList(this.lesson.pairs).length / 2 - this.board.index - (this.board.pair ? 0 : 1); }
  /** Whether the goal is met, checked once the board has stopped moving. */
  get done() {
    const b = this.board, g = this.lesson.goal;
    if ('chain' in g) return b.best >= g.chain;
    if (b.phase !== 'fall' && b.phase !== 'over') return false;
    return 'sweep' in g ? b.placed > 0 && !b.grid.some((v) => v && v !== DUST) : !b.grid.includes(DUST);
  }
  get failed() { return !this.done && this.board.phase === 'over'; }
  /** Once the goal is met the board plays out what is left of the chain, but takes no more presses. */
  step(input: Input = {}) { this.board.step(this.done ? {} : input); }
}
/** Every way of placing a lesson's pairs that meets its goal, as lists of placements. Used to check the lessons. */
export function solve(lesson: Lesson, limit = 50) {
  const pairs = pairList(lesson.pairs), goal = lesson.goal, out: { x: number; rot: number }[][] = [];
  const walk = (g: Uint8Array, i: number, best: number, path: { x: number; rot: number }[]) => {
    if (out.length >= limit) return;
    if (i * 2 >= pairs.length) return;
    for (const q of PLACES) {
      if (!reachable(heights(g), q.x, q.rot) || (pairs[i * 2] === pairs[i * 2 + 1] && q.rot > 1)) continue;
      const t = g.slice();
      land(t, q.x, q.rot, pairs[i * 2], pairs[i * 2 + 1]);
      const r = resolve(t), top = Math.max(best, r.chain), next = [...path, q];
      const met = 'chain' in goal ? top >= goal.chain : 'sweep' in goal ? !t.some((v) => v && v !== DUST) : !t.includes(DUST);
      if (met) { out.push(next); if (out.length >= limit) return; continue; }
      if (t[SPAWN_Y * W + SPAWN_X]) continue;
      walk(t, i + 1, top, next);
    }
  };
  walk(gridFrom(lesson.rows), 0, 0, []);
  return out;
}

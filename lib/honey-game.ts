// Honeycomb Hollow's rules: a hex comb of nectar drops where you turn a trio of cells that meet at a corner, and lines
// of three or more of one colour along any of the comb's three axes pop into honey. Drops fall down the columns (and
// slip diagonally past wax), new ones are dealt from a seeded generator, and cascades chain. Four in a line makes a
// bee, crossing lines make a blossom, five in a line makes royal jelly; turning two specials together fires a combo.
// Wax caps, trapped bees, sticky cells, acorns, moss, dew drops, wasps and dark comb come in one area at a time.
// Deterministic: a chamber and a seed always play out the same. No DOM, no Math.random, no clock.
import { CHAMBERS, AREAS, type Chamber, type AreaId } from './honey-levels.js';

export { CHAMBERS, AREAS };
export type { Chamber, AreaId };
export const SAVE_KEY = 'honeycomb-hollow-v1';
export const NONE = 0, BEE = 1, BLOSSOM = 2, JELLY = 3;
export type Sp = 0 | 1 | 2 | 3;
export type Kind = 'drop' | 'acorn' | 'wax' | 'wasp' | 'dew';
export interface Piece { id: number; k: Kind; c: number; sp: Sp; ax: number; hp: number; bee: boolean }
export interface Cell { p: Piece | null; honey: boolean; moss: boolean; dark: boolean; sticky: boolean }
export type Snap = Cell[];
export interface Gone { i: number; p: Piece }
export interface Fired { i: number; sp: Sp | 4; ax: number; cells: number[]; combo?: string }
export type Step =
  | { t: 'turn'; trio: number; dir: 1 | -1; board: Snap }
  | { t: 'bounce'; trio: number; dir: 1 | -1 }
  | { t: 'clear'; chain: number; gone: Gone[]; fired: Fired[]; made: { i: number; sp: Sp }[]; freed: number[]; lit: number[]; gain: number; waggle: number; board: Snap }
  | { t: 'fall'; board: Snap }
  | { t: 'acorn'; cells: number[]; board: Snap }
  | { t: 'hop'; who: 'wasp' | 'dew'; moves: [number, number][]; licked: number[]; board: Snap }
  | { t: 'moss'; cell: number; board: Snap }
  | { t: 'shuffle'; board: Snap }
  | { t: 'rush'; left: number }
  | { t: 'end'; won: boolean; stars: number; score: number };
export type GoalKey = 'honey' | 'bees' | 'acorns' | 'moss' | 'dew';
export interface Goal { key: GoalKey; left: number; need: number }

/** A small seeded generator (mulberry32) whose whole state is one number, so games clone exactly. */
export class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next() { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n: number) { return Math.floor(this.next() * n); }
}

// ---------------------------------------------------------------- the comb's shape
/** Flat-topped hexes in axial (q, r): the six neighbours clockwise from straight up. Axis a runs along dirs a and a+3. */
export const DIRS: [number, number][] = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];
export const SQ3 = Math.sqrt(3);
export interface Trio { cells: [number, number, number]; x: number; y: number }

export class Comb {
  n: number; q: number[] = []; r: number[] = []; x: number[] = []; y: number[] = [];
  nb: number[][] = []; above: number[] = []; below: number[] = []; trios: Trio[] = [];
  /** Cells from the bottom of the comb up, the order gravity works in. */
  up: number[] = [];
  w = 0; h = 0; x0 = 0; y0 = 0;
  constructor(cells: { q: number; r: number }[]) {
    this.n = cells.length;
    const at = new Map<string, number>();
    cells.forEach((c, i) => { this.q.push(c.q); this.r.push(c.r); this.x.push(1.5 * c.q); this.y.push(SQ3 * (c.r + c.q / 2)); at.set(c.q + ',' + c.r, i); });
    for (let i = 0; i < this.n; i++) this.nb.push(DIRS.map(([dq, dr]) => at.get((this.q[i] + dq) + ',' + (this.r[i] + dr)) ?? -1));
    for (let i = 0; i < this.n; i++) { this.above.push(this.nb[i][0]); this.below.push(this.nb[i][3]); }
    this.up = [...Array(this.n).keys()].sort((a, b) => this.y[b] - this.y[a] || this.x[a] - this.x[b]);
    const seen = new Set<string>();
    for (let i = 0; i < this.n; i++) for (let d = 0; d < 6; d++) {
      const b = this.nb[i][d], c = this.nb[i][(d + 1) % 6]; if (b < 0 || c < 0) continue;
      const key = [i, b, c].sort((u, v) => u - v).join(','); if (seen.has(key)) continue; seen.add(key);
      const cx = (this.x[i] + this.x[b] + this.x[c]) / 3, cy = (this.y[i] + this.y[b] + this.y[c]) / 3;
      // clockwise on screen (y grows downward) is increasing angle about the corner
      const cs = [i, b, c].sort((u, v) => Math.atan2(this.y[u] - cy, this.x[u] - cx) - Math.atan2(this.y[v] - cy, this.x[v] - cx)) as [number, number, number];
      this.trios.push({ cells: cs, x: cx, y: cy });
    }
    const xs = this.x, ys = this.y;
    this.x0 = Math.min(...xs) - 1; this.y0 = Math.min(...ys) - SQ3 / 2;
    this.w = Math.max(...xs) + 1 - this.x0; this.h = Math.max(...ys) + SQ3 / 2 - this.y0;
  }
  /** Every cell along axis a through cell i, both ways to the edge. */
  line(i: number, a: number) {
    const out = [i];
    for (const d of [a, a + 3]) { let j = this.nb[i][d]; while (j >= 0) { out.push(j); j = this.nb[j][d]; } }
    return out;
  }
  /** Every cell within k steps of cell i. */
  near(i: number, k: number) {
    const seen = new Set([i]); let front = [i];
    for (let s = 0; s < k; s++) { const nx: number[] = []; for (const f of front) for (const j of this.nb[f]) if (j >= 0 && !seen.has(j)) { seen.add(j); nx.push(j); } front = nx; }
    return [...seen];
  }
}

/** Reads a chamber's map: rows of characters, odd columns sitting half a cell lower. */
export function parseMap(map: string[]) {
  const cells: { q: number; r: number; ch: string }[] = [];
  map.forEach((row, y) => { for (let c = 0; c < row.length; c++) { const ch = row[c]; if (ch !== ' ') cells.push({ q: c, r: y - (c - (c & 1)) / 2, ch }); } });
  return cells;
}

const COMBS = new Map<string, { comb: Comb; chars: string[] }>();
export function combFor(ch: Chamber) {
  const key = ch.id + ':' + ch.map.join('|'); let v = COMBS.get(key);
  if (!v) { const cells = parseMap(ch.map); v = { comb: new Comb(cells), chars: cells.map((c) => c.ch) }; COMBS.set(key, v); }
  return v;
}

const copyCell = (c: Cell): Cell => ({ p: c.p ? { ...c.p } : null, honey: c.honey, moss: c.moss, dark: c.dark, sticky: c.sticky });
const LIT = 1;

// ---------------------------------------------------------------- the game
export class HoneyGame {
  ch: Chamber; comb: Comb; cells: Cell[] = []; rng: Rng; seed: number;
  record = true; nextId = 1;
  moves: number; score = 0; turns = 0;
  beesTotal = 0; freed = 0; acornsTotal = 0; acornsIn = 0; acornsToSpawn = 0; sinceAcorn = 0; dewTotal = 0; dewGot = 0; honeyNeed = 0;
  mossCleared = false;
  over: { won: boolean; stars: number; left: number } | null = null;
  steps: Step[] = [];
  /** Specials made, combos fired, longest chain: for the stats and the bots. */
  made = 0; combos = 0; bestChain = 0;

  constructor(ch: Chamber, seed = 1, blank = false) {
    this.ch = ch; this.seed = seed; this.rng = new Rng(seed * 2654435761 + 12345); this.moves = ch.moves;
    const { comb, chars } = combFor(ch); this.comb = comb;
    if (blank) return;
    for (let i = 0; i < comb.n; i++) {
      const k = chars[i], cell: Cell = { p: null, honey: false, moss: k === 'm', dark: k === 'd', sticky: k === 's' };
      if (k === 'w' || k === 'W' || k === 'b') { cell.p = this.piece('wax', -1); cell.p.hp = k === 'w' ? 1 : 2; cell.p.bee = k === 'b'; if (k === 'b') this.beesTotal++; }
      else if (k === 'a') { cell.p = this.piece('acorn', -1); this.acornsTotal++; }
      else if (k === 'x') cell.p = this.piece('wasp', -1);
      else if (k === 'o') { cell.p = this.piece('dew', -1); this.dewTotal++; }
      this.cells.push(cell);
    }
    this.acornsToSpawn = Math.max(0, (ch.goals.acorns ?? 0) - this.acornsTotal); this.acornsTotal = Math.max(this.acornsTotal, ch.goals.acorns ?? 0);
    this.honeyNeed = ch.goals.honey === 'all' ? comb.n : ch.goals.honey ?? 0;
    for (let i = 0; i < comb.n; i++) if (!this.cells[i].p) this.cells[i].p = this.piece('drop', this.safeColour(i));
    if (!this.findMove()) this.shuffle(false);
  }

  private piece(k: Kind, c: number): Piece { return { id: this.nextId++, k, c, sp: NONE, ax: 0, hp: 0, bee: false }; }
  private safeColour(i: number) {
    for (let t = 0; t < 30; t++) { const c = this.rng.int(this.ch.colours); this.cells[i].p = { id: 0, k: 'drop', c, sp: NONE, ax: 0, hp: 0, bee: false }; if (!this.matchAt(i)) { this.cells[i].p = null; return c; } }
    this.cells[i].p = null; return this.rng.int(this.ch.colours);
  }

  clone(reseed?: number) {
    const g = new HoneyGame(this.ch, this.seed, true);
    g.cells = this.cells.map(copyCell); g.rng = new Rng(reseed ?? this.rng.s); g.record = false; g.nextId = this.nextId;
    g.moves = this.moves; g.score = this.score; g.turns = this.turns;
    g.beesTotal = this.beesTotal; g.freed = this.freed; g.acornsTotal = this.acornsTotal; g.acornsIn = this.acornsIn; g.acornsToSpawn = this.acornsToSpawn; g.sinceAcorn = this.sinceAcorn;
    g.dewTotal = this.dewTotal; g.dewGot = this.dewGot; g.honeyNeed = this.honeyNeed; g.over = this.over ? { ...this.over } : null;
    g.made = this.made; g.combos = this.combos; g.bestChain = this.bestChain;
    return g;
  }
  snap(): Snap { return this.cells.map(copyCell); }
  private push(s: Step) { if (this.record) this.steps.push(s); }

  // ---- reading the board
  colourAt(i: number) { const p = this.cells[i].p; return p && p.k === 'drop' && p.sp !== JELLY ? p.c : -1; }
  /** Can this cell be turned? Drops, acorns and dew can; wax, wasps and anything stuck in a sticky cell can't. */
  movable(i: number) { const c = this.cells[i]; return !!c.p && !c.sticky && (c.p.k === 'drop' || c.p.k === 'acorn' || c.p.k === 'dew'); }
  canTurn(t: number) { const tr = this.comb.trios[t]; return !!tr && tr.cells.every((i) => this.movable(i)); }
  matchAt(i: number) {
    const c = this.colourAt(i); if (c < 0) return false;
    for (let a = 0; a < 3; a++) {
      let n = 1;
      for (const d of [a, a + 3]) { let j = this.comb.nb[i][d]; while (j >= 0 && this.colourAt(j) === c) { n++; j = this.comb.nb[j][d]; } }
      if (n >= 3) return true;
    }
    return false;
  }
  goals(): Goal[] {
    const g = this.ch.goals, out: Goal[] = [];
    if (this.honeyNeed) { const have = this.cells.reduce((n, c) => n + (c.honey ? 1 : 0), 0); out.push({ key: 'honey', need: this.honeyNeed, left: Math.max(0, this.honeyNeed - have) }); }
    if (this.beesTotal) out.push({ key: 'bees', need: this.beesTotal, left: this.beesTotal - this.freed });
    if (this.acornsTotal) out.push({ key: 'acorns', need: this.acornsTotal, left: this.acornsTotal - this.acornsIn });
    if (g.moss) { const m = this.cells.reduce((n, c) => n + (c.moss ? 1 : 0), 0); out.push({ key: 'moss', need: 0, left: m }); }
    if (this.dewTotal) out.push({ key: 'dew', need: this.dewTotal, left: this.dewTotal - this.dewGot });
    return out;
  }
  won() { return this.goals().every((g) => g.left <= 0); }

  // ---- turning
  private rotate(cs: [number, number, number], dir: 1 | -1) {
    const [a, b, c] = cs, P = this.cells;
    if (dir === 1) { const t = P[c].p; P[c].p = P[b].p; P[b].p = P[a].p; P[a].p = t; }
    else { const t = P[a].p; P[a].p = P[b].p; P[b].p = P[c].p; P[c].p = t; }
  }
  /** What the trio would fire by itself: two specials, or royal jelly with a coloured drop. */
  private comboIn(cs: number[]) {
    const ps = cs.map((i) => this.cells[i].p!).filter((p) => p.k === 'drop');
    const jel = ps.filter((p) => p.sp === JELLY).length, sp = ps.filter((p) => p.sp === BEE || p.sp === BLOSSOM).length;
    return (jel >= 1 && (jel >= 2 || ps.some((p) => p.sp !== JELLY))) || sp >= 2;
  }
  /** Would this turn do anything? */
  works(t: number, dir: 1 | -1) {
    if (!this.canTurn(t)) return false;
    const cs = this.comb.trios[t].cells;
    if (this.comboIn(cs)) return true;
    this.rotate(cs, dir); const ok = cs.some((i) => this.matchAt(i)); this.rotate(cs, dir === 1 ? -1 : 1);
    return ok;
  }
  findMove(): { t: number; dir: 1 | -1 } | null {
    for (let t = 0; t < this.comb.trios.length; t++) for (const dir of [1, -1] as const) if (this.works(t, dir)) return { t, dir };
    return null;
  }
  allMoves() { const out: { t: number; dir: 1 | -1 }[] = []; for (let t = 0; t < this.comb.trios.length; t++) for (const dir of [1, -1] as const) if (this.works(t, dir)) out.push({ t, dir }); return out; }

  /** Turns trio t; returns the steps to animate, or null if it can't turn. A turn that does nothing springs back free. */
  turn(t: number, dir: 1 | -1): Step[] | null {
    if (this.over || !this.canTurn(t)) return null;
    this.steps = [];
    const cs = this.comb.trios[t].cells, combo = this.comboIn(cs);
    this.rotate(cs, dir);
    if (!combo && !cs.some((i) => this.matchAt(i))) { this.rotate(cs, dir === 1 ? -1 : 1); this.push({ t: 'bounce', trio: t, dir }); return this.steps; }
    this.moves--; this.turns++; this.mossCleared = false;
    this.push({ t: 'turn', trio: t, dir, board: this.snap() });
    let chain = 0;
    if (combo) { chain = 1; this.fireCombo(cs); this.settle(); }
    chain = this.resolve(combo ? null : cs, chain);
    this.afterTurn(chain);
    return this.steps;
  }

  private afterTurn(chain: number) {
    if (!this.won()) {
      if (this.hopAll('wasp') | this.hopAll('dew')) chain = this.resolve(null, chain);
      this.spreadMoss();
    }
    this.bestChain = Math.max(this.bestChain, chain);
    if (this.won()) { this.finish(true); return; }
    if (this.moves <= 0) { this.finish(false); return; }
    if (!this.findMove()) this.shuffle(true);
  }

  private finish(won: boolean) {
    const left = this.moves, [two, three] = this.ch.stars;
    const stars = won ? (left >= three ? 3 : left >= two ? 2 : 1) : 0;
    this.over = { won, stars, left };
    if (won && left > 0) this.rush(left);
    this.push({ t: 'end', won, stars, score: this.score });
  }

  /** The honey rush: every move left over becomes a bee that zips along a line. */
  private rush(left: number) {
    this.push({ t: 'rush', left });
    const n = Math.min(left, 10);
    for (let k = 0; k < n; k++) {
      const ds = this.cells.map((c, i) => (c.p && c.p.k === 'drop' && c.p.sp === NONE ? i : -1)).filter((i) => i >= 0);
      if (!ds.length) break;
      const i = ds[this.rng.int(ds.length)], p = this.cells[i].p!; p.sp = BEE; p.ax = this.rng.int(3);
      this.score += 120;
      this.blast(new Map([[i, 0]]), [], [], k + 1, 0);
      this.settle();
    }
    this.score += Math.max(0, left - n) * 120;
  }

  // ---- matching
  private groups() {
    const runs: { cells: number[]; a: number }[] = [];
    for (let a = 0; a < 3; a++) for (let i = 0; i < this.comb.n; i++) {
      const c = this.colourAt(i); if (c < 0) continue;
      const b = this.comb.nb[i][a + 3]; if (b >= 0 && this.colourAt(b) === c) continue;
      const run = [i]; let j = this.comb.nb[i][a]; while (j >= 0 && this.colourAt(j) === c) { run.push(j); j = this.comb.nb[j][a]; }
      if (run.length >= 3) runs.push({ cells: run, a });
    }
    if (!runs.length) return [];
    const owner = new Map<number, number>(), sets: { cells: Set<number>; runs: typeof runs }[] = [];
    for (const run of runs) {
      const hit = [...new Set(run.cells.map((i) => owner.get(i)).filter((x): x is number => x !== undefined))];
      let g: number;
      if (!hit.length) { g = sets.length; sets.push({ cells: new Set(), runs: [] }); }
      else { g = hit[0]; for (const h of hit.slice(1)) { for (const i of sets[h].cells) { sets[g].cells.add(i); owner.set(i, g); } sets[g].runs.push(...sets[h].runs); sets[h] = { cells: new Set(), runs: [] }; } }
      for (const i of run.cells) { sets[g].cells.add(i); owner.set(i, g); }
      sets[g].runs.push(run);
    }
    return sets.filter((s) => s.cells.size);
  }

  /** Clears matches and their cascades until the comb is still; returns the chain length. */
  private resolve(moved: readonly number[] | null, chain: number) {
    for (let guard = 0; guard < 60; guard++) {
      const gs = this.groups(); if (!gs.length) break;
      chain++;
      const clear = new Map<number, number>(), side = new Set<number>(), makes: { i: number; sp: Sp; ax: number; c: number }[] = [];
      let waggle = 0;
      if (moved) waggle = moved.filter((i) => gs.some((g) => g.cells.has(i))).length;
      for (const g of gs) {
        for (const i of g.cells) { clear.set(i, 0); for (const j of this.comb.nb[i]) if (j >= 0) side.add(j); }
        const longest = g.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a)), axes = new Set(g.runs.map((r) => r.a));
        const sp: Sp = longest.cells.length >= 5 ? JELLY : axes.size >= 2 && g.cells.size >= 5 ? BLOSSOM : longest.cells.length === 4 ? BEE : NONE;
        if (sp === NONE) continue;
        // the special lands where you turned, else where the lines cross, else mid-line
        const inRuns = (i: number) => g.runs.filter((r) => r.cells.includes(i)).length;
        let at = moved?.find((i) => g.cells.has(i) && longest.cells.includes(i)) ?? moved?.find((i) => g.cells.has(i));
        if (at === undefined) at = sp === BLOSSOM ? [...g.cells].sort((a, b) => inRuns(b) - inRuns(a))[0] : longest.cells[longest.cells.length >> 1];
        makes.push({ i: at, sp, ax: longest.a, c: this.colourAt(at) });
      }
      // a triple turn: all three turned drops matched, and a bee joins in
      if (waggle === 3) { const g = gs.find((s) => [...s.cells].some((i) => !makes.some((m) => m.i === i))); const i = g && [...g.cells].find((c) => !makes.some((m) => m.i === c)); if (i !== undefined) makes.push({ i, sp: BEE, ax: this.rng.int(3), c: this.colourAt(i) }); }
      for (const i of clear.keys()) side.delete(i);
      this.score += waggle === 3 ? 150 : waggle === 2 ? 60 : 0;
      this.blast(clear, [...side], makes, chain, waggle >= 2 ? waggle : 0);
      this.settle();
      moved = null;
    }
    return chain;
  }

  /** Fires the specials inside a clear (and the ones those reach), clears it all, then places new specials. */
  private blast(clear: Map<number, number>, side: number[], makes: { i: number; sp: Sp; ax: number; c: number }[], chain: number, waggle: number, fired: Fired[] = []) {
    const done = new Set<number>(fired.map((f) => this.cells[f.i].p?.id ?? -1));
    const queue = [...clear.keys()];
    while (queue.length) {
      const i = queue.shift()!, p = this.cells[i].p;
      if (!p || p.k !== 'drop' || p.sp === NONE || done.has(p.id)) continue;
      done.add(p.id);
      let cells: number[] = [], lit = 0;
      if (p.sp === BEE) cells = this.comb.line(i, p.ax);
      else if (p.sp === BLOSSOM) { cells = this.comb.near(i, 2); lit = LIT; }
      else { const c = this.commonColour(); cells = this.cells.map((x, j) => (x.p && x.p.k === 'drop' && x.p.c === c && x.p.sp !== JELLY ? j : -1)).filter((j) => j >= 0); cells.push(i); }
      fired.push({ i, sp: p.sp, ax: p.ax, cells });
      this.score += 40;
      for (const j of cells) { const had = clear.get(j); if (had === undefined) { clear.set(j, lit); queue.push(j); } else clear.set(j, had | lit); }
    }
    const gone: Gone[] = [], freed: number[] = [], litCells: number[] = [], waxHit = new Set<number>();
    let gain = 0;
    const hitWax = (i: number, p: Piece) => {
      if (waxHit.has(p.id)) return; waxHit.add(p.id); p.hp--;
      if (p.hp <= 0) { this.cells[i].p = null; gone.push({ i, p: { ...p } }); if (p.bee) { this.freed++; freed.push(i); gain += 200; } gain += 20; }
    };
    for (const [i, f] of clear) {
      const cell = this.cells[i], p = cell.p;
      if (cell.dark && f & LIT) { cell.dark = false; litCells.push(i); gain += 30; }
      if (!p) { if (!cell.dark) cell.honey = true; continue; }
      if (p.k === 'drop') {
        cell.p = null; gone.push({ i, p: { ...p } }); gain += 10 * chain;
        if (!cell.dark) cell.honey = true;
        if (cell.moss) { cell.moss = false; this.mossCleared = true; }
        cell.sticky = false;
      } else if (p.k === 'wax') hitWax(i, p);
      else if (p.k === 'wasp') { cell.p = null; gone.push({ i, p: { ...p } }); gain += 50; }
      else if (p.k === 'dew') { cell.p = null; gone.push({ i, p: { ...p } }); this.dewGot++; gain += 50; }
    }
    for (const i of side) {
      const p = this.cells[i].p; if (!p) continue;
      if (p.k === 'wax') hitWax(i, p);
      else if (p.k === 'wasp') { this.cells[i].p = null; gone.push({ i, p: { ...p } }); gain += 50; }
      else if (p.k === 'dew') { this.cells[i].p = null; gone.push({ i, p: { ...p } }); this.dewGot++; gain += 50; }
    }
    const made: { i: number; sp: Sp }[] = [];
    for (const m of makes) {
      if (this.cells[m.i].p || m.c < 0) continue;
      const p = this.piece('drop', m.c); p.sp = m.sp; p.ax = m.ax; this.cells[m.i].p = p; made.push({ i: m.i, sp: m.sp });
      this.made++; gain += m.sp === JELLY ? 100 : m.sp === BLOSSOM ? 50 : 25;
    }
    this.score += gain;
    this.push({ t: 'clear', chain, gone, fired, made, freed, lit: litCells, gain, waggle, board: this.snap() });
  }

  private commonColour() {
    const n = new Array(8).fill(0);
    for (const c of this.cells) if (c.p && c.p.k === 'drop' && c.p.sp !== JELLY) n[c.p.c]++;
    let best = 0; for (let c = 1; c < n.length; c++) if (n[c] > n[best]) best = c;
    return best;
  }

  /** Two specials, or royal jelly, turned together. */
  private fireCombo(cs: readonly number[]) {
    this.combos++;
    const P = (i: number) => this.cells[i].p!;
    const ps = cs.map((i) => ({ i, p: P(i) })).filter((x) => x.p.k === 'drop');
    const jel = ps.filter((x) => x.p.sp === JELLY), blos = ps.filter((x) => x.p.sp === BLOSSOM), bees = ps.filter((x) => x.p.sp === BEE);
    const clear = new Map<number, number>(cs.map((i) => [i, 0]));
    const fired: Fired[] = [];
    const add = (cells: number[], lit = 0) => { for (const j of cells) clear.set(j, (clear.get(j) ?? 0) | lit); };
    const all = (f: (p: Piece) => boolean) => this.cells.map((c, j) => (c.p && c.p.k === 'drop' && f(c.p) ? j : -1)).filter((j) => j >= 0);
    let name: string;
    if (jel.length >= 2) { name = 'feast'; add([...Array(this.comb.n).keys()], LIT); }
    else if (jel.length === 1 && (blos.length || bees.length)) {
      const mate = blos[0] ?? bees[0], sp = mate.p.sp, col = mate.p.c;
      name = sp === BLOSSOM ? 'jelly-blossom' : 'jelly-bee';
      const turned = all((p) => p.c === col && p.sp !== JELLY);
      for (const j of turned) { const p = P(j); p.sp = sp; if (sp === BEE) p.ax = this.rng.int(3); }
      add(turned);
    } else if (jel.length === 1) {
      name = 'jelly';
      const cols = new Set(ps.filter((x) => x.p.sp !== JELLY).map((x) => x.p.c));
      add(all((p) => cols.has(p.c) && p.sp !== JELLY));
    } else if (blos.length >= 2) { name = 'blossom-blossom'; for (const b of blos.slice(0, 2)) add(this.comb.near(b.i, 3), LIT); }
    else { name = blos.length ? 'bee-blossom' : 'bee-bee'; const lit = blos.length ? LIT : 0; for (const x of [...bees, ...blos].slice(0, 2)) for (let a = 0; a < 3; a++) add(this.comb.line(x.i, a), lit); }
    const used = name === 'feast' ? jel.slice(0, 2) : name.startsWith('jelly') ? [jel[0], ...(blos[0] ? [blos[0]] : bees[0] ? [bees[0]] : [])] : [...blos, ...bees].slice(0, 2);
    for (const u of used) fired.push({ i: u.i, sp: 4, ax: u.p.sp, cells: [...clear.keys()], combo: name });
    // jelly-bee and jelly-blossom fire their new specials through the chain; the rest are spent here
    if (name === 'jelly-bee' || name === 'jelly-blossom') fired.splice(0, fired.length, { i: jel[0].i, sp: 4, ax: JELLY, cells: [...clear.keys()], combo: name });
    this.score += 300;
    this.blast(clear, [], [], 1, 0, fired);
  }

  // ---- gravity
  private fall() {
    const C = this.cells, cb = this.comb;
    let changed = true, any = false;
    for (let guard = 0; changed && guard < 400; guard++) {
      changed = false;
      for (const i of cb.up) {
        if (C[i].p) continue;
        const u = cb.above[i];
        if (u < 0) { C[i].p = this.deal(); changed = true; }
        else if (C[u].p && this.falls(u)) { C[i].p = C[u].p; C[u].p = null; changed = true; }
      }
      if (changed) { any = true; continue; }
      // stuck under wax or a wasp: slip in diagonally from the upper left or right
      for (const i of cb.up) {
        if (C[i].p) continue;
        const u = cb.above[i]; if (u >= 0 && (!C[u].p || this.falls(u)) && !(C[u].p === null && this.blockedAbove(u))) continue;
        const sides = (cb.q[i] + this.turns) & 1 ? [5, 1] : [1, 5];
        for (const d of sides) { const s = cb.nb[i][d]; if (s >= 0 && C[s].p && this.falls(s)) { C[i].p = C[s].p; C[s].p = null; changed = true; break; } }
        if (changed) break;
      }
      if (changed) any = true;
    }
    return any;
  }
  private blockedAbove(i: number): boolean { const u = this.comb.above[i]; if (u < 0) return false; const p = this.cells[u].p; if (p) return !this.falls(u); return this.blockedAbove(u); }
  private falls(i: number) { const c = this.cells[i]; return !!c.p && !c.sticky && (c.p.k === 'drop' || c.p.k === 'acorn' || c.p.k === 'dew'); }
  private deal(): Piece {
    if (this.acornsToSpawn > 0) {
      const on = this.cells.reduce((n, c) => n + (c.p?.k === 'acorn' ? 1 : 0), 0);
      this.sinceAcorn++;
      if (on < 2 && (this.sinceAcorn > 14 || this.rng.next() < 0.06)) { this.acornsToSpawn--; this.sinceAcorn = 0; return this.piece('acorn', -1); }
    }
    return this.piece('drop', this.rng.int(this.ch.colours));
  }
  /** Lets everything fall, and acorns that reach the bottom roll out. */
  private settle() {
    for (let guard = 0; guard < 20; guard++) {
      if (this.fall()) this.push({ t: 'fall', board: this.snap() });
      const out = this.comb.up.filter((i) => this.comb.below[i] < 0 && this.cells[i].p?.k === 'acorn');
      if (!out.length) return;
      for (const i of out) { this.cells[i].p = null; this.acornsIn++; this.score += 150; }
      this.push({ t: 'acorn', cells: out, board: this.snap() });
    }
  }

  // ---- after the turn: wasps, dew, moss
  /** Each wasp hops onto a neighbouring drop (honey first) and licks the honey off it; dew drops roll about. */
  private hopAll(who: 'wasp' | 'dew') {
    const C = this.cells, moves: [number, number][] = [], licked: number[] = [], movedIds = new Set<number>();
    for (let i = 0; i < this.comb.n; i++) {
      const p = C[i].p; if (!p || p.k !== who || movedIds.has(p.id)) continue;
      const opts = this.comb.nb[i].filter((j) => j >= 0 && C[j].p?.k === 'drop' && !C[j].sticky);
      if (!opts.length) continue;
      const sweet = who === 'wasp' ? opts.filter((j) => C[j].honey) : [];
      const pool = sweet.length ? sweet : opts, j = pool[this.rng.int(pool.length)];
      // a wasp eats the drop it lands on (and licks the honey off the cell); a dew drop just swaps places
      C[i].p = who === 'wasp' ? null : C[j].p; C[j].p = p; movedIds.add(p.id); moves.push([i, j]);
      if (who === 'wasp' && C[j].honey) { C[j].honey = false; licked.push(j); }
    }
    if (moves.length) { this.push({ t: 'hop', who, moves, licked, board: this.snap() }); if (who === 'wasp') this.settle(); }
    return moves.length ? 1 : 0;
  }
  private spreadMoss() {
    if (!this.ch.goals.moss || this.mossCleared) return;
    const C = this.cells, opts: number[] = [];
    for (let i = 0; i < this.comb.n; i++) if (C[i].moss) for (const j of this.comb.nb[i]) if (j >= 0 && !C[j].moss && !C[j].dark && C[j].p?.k === 'drop' && !opts.includes(j)) opts.push(j);
    if (!opts.length) return;
    const j = opts[this.rng.int(opts.length)]; C[j].moss = true;
    this.push({ t: 'moss', cell: j, board: this.snap() });
  }

  /** No move left (or a fresh comb with none): stir the plain drops until there is one and nothing is matched. */
  private shuffle(show: boolean) {
    const C = this.cells, spots = C.map((c, i) => (c.p && c.p.k === 'drop' && c.p.sp === NONE && !c.sticky ? i : -1)).filter((i) => i >= 0);
    for (let tries = 0; tries < 80; tries++) {
      const cols = spots.map((i) => C[i].p!.c);
      for (let k = cols.length - 1; k > 0; k--) { const j = this.rng.int(k + 1); [cols[k], cols[j]] = [cols[j], cols[k]]; }
      if (tries > 40) for (let k = 0; k < cols.length; k++) cols[k] = this.rng.int(this.ch.colours);
      spots.forEach((i, k) => { C[i].p!.c = cols[k]; });
      if (!spots.some((i) => this.matchAt(i)) && this.findMove()) break;
    }
    if (show) this.push({ t: 'shuffle', board: this.snap() });
  }
}

// ---------------------------------------------------------------- chambers, areas and the save
export const chamberById = (id: string) => CHAMBERS.find((c) => c.id === id);
export const chamberNo = (id: string) => CHAMBERS.findIndex((c) => c.id === id) + 1;
export const areaChambers = (a: AreaId) => CHAMBERS.filter((c) => c.area === a);

export interface Best { stars: number; score: number }
export interface Save { v: 1; best: Record<string, Best>; tips: string[]; story: string[]; ended: boolean; tries: Record<string, number>; settings: { sound: boolean; music: boolean } }
export const freshSave = (): Save => ({ v: 1, best: {}, tips: [], story: [], ended: false, tries: {}, settings: { sound: true, music: true } });
/** Reads a save defensively: anything odd is ignored, never trusted. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  let j: unknown; try { j = JSON.parse(raw); } catch { return s; }
  if (!j || typeof j !== 'object') return s;
  const o = j as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.best && typeof o.best === 'object') for (const [k, v] of Object.entries(o.best as Record<string, unknown>)) {
    if (!chamberById(k) || !v || typeof v !== 'object') continue;
    const b = v as Record<string, unknown>, st = Number(b.stars), sc = Number(b.score);
    if (Number.isInteger(st) && st >= 1 && st <= 3) s.best[k] = { stars: st, score: Number.isFinite(sc) && sc >= 0 ? Math.floor(sc) : 0 };
  }
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string').slice(0, 200) : []);
  s.tips = strs(o.tips); s.story = strs(o.story); s.ended = o.ended === true;
  if (o.tries && typeof o.tries === 'object') for (const [k, v] of Object.entries(o.tries as Record<string, unknown>)) if (chamberById(k) && Number.isInteger(v) && (v as number) >= 0) s.tries[k] = Math.min(v as number, 1e6);
  const st = o.settings as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') { if (typeof st.sound === 'boolean') s.settings.sound = st.sound; if (typeof st.music === 'boolean') s.settings.music = st.music; }
  return s;
}
export function chamberOpen(s: Save, id: string) { const i = CHAMBERS.findIndex((c) => c.id === id); return i === 0 || (i > 0 && !!s.best[CHAMBERS[i - 1].id]); }
export function areaOpen(s: Save, a: AreaId) { const first = areaChambers(a)[0]; return !!first && chamberOpen(s, first.id); }
export const starCount = (s: Save) => Object.values(s.best).reduce((n, b) => n + b.stars, 0);
export function nextChamber(s: Save) { const c = CHAMBERS.find((x) => !s.best[x.id] && chamberOpen(s, x.id)); return c?.id ?? null; }
/** Records a finished chamber; returns whether it beat the old best and whether it was the first clear. */
export function record(s: Save, id: string, stars: number, score: number) {
  const old = s.best[id], first = !old;
  const better = !old || stars > old.stars || (stars === old.stars && score > old.score);
  if (stars > 0 && better) s.best[id] = { stars: Math.max(stars, old?.stars ?? 0), score: Math.max(score, old?.score ?? 0) };
  else if (stars > 0 && old) s.best[id] = { stars: Math.max(stars, old.stars), score: Math.max(score, old.score) };
  return { better: stars > 0 && better, first: first && stars > 0 };
}
/** Each try of a chamber deals a different comb, from the chamber's own seed. */
export const seedFor = (id: string, tries: number) => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) + tries * 7919) >>> 0; };

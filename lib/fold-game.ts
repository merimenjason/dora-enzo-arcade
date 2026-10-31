// Paperfold: the rules. A sheet of paper sits on a square grid; every cell of the sheet is a little square of paper
// with a front face and a back face (each a colour, and maybe a printed mark). Folding along a full grid line lifts
// everything on one side, flips it over and lays it down mirrored on the other side: on top (a valley fold, the
// usual one) or underneath (a mountain fold, only where the sheet carries a mountain crease). So each grid position
// holds a stack of layers, bottom to top, and each layer remembers which face is up. A punched hole shows the layer
// below; tape holds two cells together so no fold may part them; a crease can only fold its own way.
//
// The puzzle is solved when the picture seen from above (the outline, and the colour and mark on top of every
// position) matches the target exactly, wherever on the table the paper ended up. Deterministic, no DOM, no clock;
// the only randomness (for the look of the paper) comes from a seeded generator.
import { PUZZLES, CHAPTERS, type PuzzleSpec, type ChapterId, type Piece } from './fold-levels.js';

export { PUZZLES, CHAPTERS };
export type { PuzzleSpec, ChapterId, Piece };

export const SAVE_KEY = 'paperfold-v1';

export type Face = 'f' | 'b';
export type Colour = 'red' | 'gold' | 'blue' | 'teal' | 'pink' | 'violet' | 'white' | 'navy' | 'orange' | 'leaf' | 'cream' | 'plum';
export type Mark = 'star' | 'window' | 'moon' | 'ribbon' | 'flower' | 'wave' | 'eye' | 'heart' | 'sun' | 'leaf' | 'flame' | 'dot';
export const COLOURS: Colour[] = ['red', 'gold', 'blue', 'teal', 'pink', 'violet', 'white', 'navy', 'orange', 'leaf', 'cream', 'plum'];
export const MARKS: Mark[] = ['star', 'window', 'moon', 'ribbon', 'flower', 'wave', 'eye', 'heart', 'sun', 'leaf', 'flame', 'dot'];
const LETTER: Record<string, Colour> = { r: 'red', g: 'gold', b: 'blue', t: 'teal', p: 'pink', v: 'violet', w: 'white', n: 'navy', o: 'orange', l: 'leaf', c: 'cream', m: 'plum' };

/** One square of the sheet as it was cut: where it started, its two faces, and whether it is punched. */
export type Cell = { id: number; x: number; y: number; f: Colour; b: Colour; fm: Mark | null; bm: Mark | null; hole: boolean };
export type Layer = { c: number; up: Face };
/** The paper on the table: stacks of layers keyed by position, always shifted so the top-left is at 0,0. */
export type Paper = { w: number; h: number; stacks: Map<number, Layer[]> };
export type Crease = { a: number; b: number; kind: 'valley' | 'mountain' };
export type Sheet = { cells: Cell[]; tape: [number, number][]; creases: Crease[] };
/** What shows from above at one position. */
export type Top = { colour: Colour; mark: Mark | null } | 'hole';
export type Picture = { w: number; h: number; tops: Map<number, Top> };
/** A fold: the crease line (x = at for a vertical line, y = at for a horizontal one) and which side lifts: the low
 * side (left or top, moving right or down) or the high side (right or bottom, moving left or up). */
export type Fold = { axis: 'x' | 'y'; at: number; low: boolean };
export type FoldCheck = { ok: true; under: boolean } | { ok: false; why: string };

export const pos = (x: number, y: number) => y * 64 + x;
export const px = (p: number) => p % 64;
export const py = (p: number) => Math.floor(p / 64);

/** A small seeded generator (mulberry32) for the look of the paper; never used by the rules. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- folds as text: "x2>" lifts the part left of x = 2 over to the right, "x2<" the part right of it to the left,
// "y1v" the part above y = 1 down, "y1^" the part below it up.
export const foldText = (f: Fold) => `${f.axis}${f.at}${f.axis === 'x' ? (f.low ? '>' : '<') : (f.low ? 'v' : '^')}`;
export function parseFold(s: string): Fold {
  const m = /^([xy])(\d+)([<>v^])$/.exec(s); if (!m) throw new Error('bad fold ' + s);
  return { axis: m[1] as 'x' | 'y', at: +m[2], low: m[3] === '>' || m[3] === 'v' };
}
export const sameFold = (a: Fold, b: Fold) => a.axis === b.axis && a.at === b.at && a.low === b.low;

// ---- building a sheet from a puzzle's text
export function makeSheet(p: PuzzleSpec): Sheet {
  const cells: Cell[] = [], at = new Map<string, number>();
  p.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return;
    const fc = p.fc?.[y]?.[x], bc = p.bc?.[y]?.[x];
    const id = cells.length; at.set(`${x},${y}`, id);
    cells.push({ id, x, y, f: (fc && LETTER[fc]) || p.front, b: (bc && LETTER[bc]) || p.back, fm: null, bm: null, hole: ch === 'o' });
  }));
  const cell = (x: number, y: number) => { const id = at.get(`${x},${y}`); if (id === undefined) throw new Error(`${p.id}: no paper at ${x},${y}`); return id; };
  for (const m of p.marks ?? []) {
    const [x, y, side, mark] = m.split(' '); const c = cells[cell(+x, +y)];
    if (side === 'f') c.fm = mark as Mark; else c.bm = mark as Mark;
  }
  const pair = (s: string): [number, number] => {
    const [x0, y0, x1, y1] = s.split(' ').map(Number);
    if (Math.abs(x0 - x1) + Math.abs(y0 - y1) !== 1) throw new Error(`${p.id}: ${s} is not two neighbours`);
    return [cell(x0, y0), cell(x1, y1)];
  };
  const tape = (p.tape ?? []).map(pair);
  const creases = (p.creases ?? []).map((s) => { const [a, b] = pair(s.slice(0, s.lastIndexOf(' '))); return { a, b, kind: s.endsWith('m') ? 'mountain' as const : 'valley' as const }; });
  return { cells, tape, creases };
}

export function flatPaper(sheet: Sheet): Paper {
  const stacks = new Map<number, Layer[]>();
  for (const c of sheet.cells) stacks.set(pos(c.x, c.y), [{ c: c.id, up: 'f' }]);
  return normalise(stacks);
}

function normalise(stacks: Map<number, Layer[]>): Paper {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of stacks.keys()) { const x = px(p), y = py(p); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x0 === 0 && y0 === 0) return { w: x1 + 1, h: y1 + 1, stacks };
  const out = new Map<number, Layer[]>();
  for (const [p, s] of stacks) out.set(pos(px(p) - x0, py(p) - y0), s);
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, stacks: out };
}

/** Where each cell of the sheet is now, and which face is up. */
export function whereIs(paper: Paper) {
  const at = new Map<number, { p: number; up: Face; z: number }>();
  for (const [p, s] of paper.stacks) s.forEach((l, z) => at.set(l.c, { p, up: l.up, z }));
  return at;
}

/** Positions on the side of the line that lifts (true) or stays (false); undefined when nothing is there. */
const lifts = (f: Fold, p: number) => { const v = f.axis === 'x' ? px(p) : py(p); return f.low ? v < f.at : v >= f.at; };

/** All the fold lines that cross the paper (both sides have paper), each with its two directions. */
export function foldsOf(paper: Paper): Fold[] {
  const out: Fold[] = [];
  for (let at = 1; at < paper.w; at++) for (const low of [true, false]) out.push({ axis: 'x', at, low });
  for (let at = 1; at < paper.h; at++) for (const low of [true, false]) out.push({ axis: 'y', at, low });
  return out;
}

/** Whether a fold is allowed, and if so whether it goes under (a mountain crease) or over. */
export function checkFold(sheet: Sheet, paper: Paper, f: Fold): FoldCheck {
  const size = f.axis === 'x' ? paper.w : paper.h;
  if (f.at < 1 || f.at >= size) return { ok: false, why: 'That line is off the paper.' };
  const at = whereIs(paper), side = (c: number) => lifts(f, at.get(c)!.p);
  for (const [a, b] of sheet.tape) if (side(a) !== side(b)) return { ok: false, why: 'Tape holds those squares together: that line can’t fold.' };
  let need: 'over' | 'under' | null = null;
  for (const cr of sheet.creases) {
    if (side(cr.a) === side(cr.b)) continue;
    // the crease as seen from above: a valley on the front is a mountain when that paper is face down
    const still = side(cr.a) ? cr.b : cr.a, up = at.get(still)!.up;
    const seen = (cr.kind === 'mountain') === (up === 'f') ? 'under' : 'over';
    if (need && need !== seen) return { ok: false, why: 'Those creases fold opposite ways: that line can’t fold.' };
    need = seen;
  }
  return { ok: true, under: need === 'under' };
}

export function applyFold(sheet: Sheet, paper: Paper, f: Fold): Paper | null {
  const ok = checkFold(sheet, paper, f); if (ok.ok === false) return null;
  const at = new Map<string, [number, number, Layer[]]>(), moving: [number, Layer[]][] = [];
  for (const [p, s] of paper.stacks) { if (lifts(f, p)) moving.push([p, s]); else at.set(`${px(p)},${py(p)}`, [px(p), py(p), s.slice()]); }
  for (const [p, s] of moving) {
    const x = f.axis === 'x' ? 2 * f.at - 1 - px(p) : px(p), y = f.axis === 'y' ? 2 * f.at - 1 - py(p) : py(p);
    const flipped = s.slice().reverse().map((l) => ({ c: l.c, up: (l.up === 'f' ? 'b' : 'f') as Face }));
    const below = at.get(`${x},${y}`)?.[2] ?? [];
    at.set(`${x},${y}`, [x, y, ok.under ? flipped.concat(below) : below.concat(flipped)]);
  }
  let x0 = Infinity, y0 = Infinity;
  for (const [x, y] of at.values()) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); }
  const stacks = new Map<number, Layer[]>();
  for (const [x, y, s] of at.values()) stacks.set(pos(x - x0, y - y0), s);
  return normalise(stacks);
}

/** Where the lifted part's cells land, in the paper's frame before the fold (for drawing the fold). */
export function landing(f: Fold, x: number, y: number): [number, number] {
  return f.axis === 'x' ? [2 * f.at - 1 - x, y] : [x, 2 * f.at - 1 - y];
}
export const isLifted = (f: Fold, x: number, y: number) => lifts(f, pos(x, y));

export function topOf(sheet: Sheet, s: Layer[]): Top {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = sheet.cells[s[i].c]; if (c.hole) continue;
    return s[i].up === 'f' ? { colour: c.f, mark: c.fm } : { colour: c.b, mark: c.bm };
  }
  return 'hole';
}
export function picture(sheet: Sheet, paper: Paper): Picture {
  const tops = new Map<number, Top>();
  for (const [p, s] of paper.stacks) tops.set(p, topOf(sheet, s));
  return { w: paper.w, h: paper.h, tops };
}
export const topKey = (t: Top) => (t === 'hole' ? 'o' : t.colour + (t.mark ? ':' + t.mark : ''));
export function pictureKey(pic: Picture) {
  return `${pic.w}x${pic.h}|` + [...pic.tops.entries()].sort((a, b) => a[0] - b[0]).map(([p, t]) => p + '=' + topKey(t)).join(',');
}
export function paperKey(paper: Paper) {
  return `${paper.w}x${paper.h}|` + [...paper.stacks.entries()].sort((a, b) => a[0] - b[0]).map(([p, s]) => p + '=' + s.map((l) => l.c + l.up).join('.')).join(',');
}

// ---- the solver: breadth first over the paper's states, for hints and for the tests
export type Solved = { min: number; count: number; first: Fold[]; path: Fold[]; states: number } | null;
/** Shortest fold sequences from `paper` to a paper whose picture has key `goal`: the length, how many distinct
 * sequences of that length there are, the folds that start one, and one of them. */
export function solve(sheet: Sheet, paper: Paper, goal: string, maxDepth = 8, maxStates = 400000): Solved {
  const done = (p: Paper) => pictureKey(picture(sheet, p)) === goal;
  if (done(paper)) return { min: 0, count: 1, first: [], path: [], states: 1 };
  type Node = { paper: Paper; ways: number; first: Set<string>; path: Fold[] };
  let layer = new Map<string, Node>([[paperKey(paper), { paper, ways: 1, first: new Set(), path: [] }]]);
  const seen = new Set(layer.keys());
  for (let d = 1; d <= maxDepth; d++) {
    const next = new Map<string, Node>();
    for (const n of layer.values()) for (const f of foldsOf(n.paper)) {
      const q = applyFold(sheet, n.paper, f); if (!q) continue;
      const k = paperKey(q); if (seen.has(k) && !next.has(k)) continue;
      const first = d === 1 ? new Set([foldText(f)]) : n.first;
      const m = next.get(k);
      if (m) { m.ways += n.ways; for (const t of first) m.first.add(t); }
      else next.set(k, { paper: q, ways: n.ways, first: new Set(first), path: [...n.path, f] });
    }
    let count = 0, path: Fold[] | null = null; const firsts = new Set<string>();
    for (const n of next.values()) if (done(n.paper)) { count += n.ways; path ??= n.path; for (const t of n.first) firsts.add(t); }
    for (const k of next.keys()) seen.add(k);
    if (path) return { min: d, count, first: [...firsts].sort().map(parseFold), path, states: seen.size };
    if (seen.size > maxStates || !next.size) return null;
    layer = next;
  }
  return null;
}

// ---- a puzzle in play
export type Seal = 0 | 1 | 2 | 3;
export const SEAL_NAMES = ['', 'paper seal', 'silver seal', 'gold seal'];
/** Gold for finishing in par folds (undone folds count too, so a fresh start with Reset is the way back to gold),
 * silver within two more, a paper seal for any finish. */
export const sealFor = (folds: number, par: number): Seal => (folds <= par ? 3 : folds <= par + 2 ? 2 : 1);

export type Puzzle = PuzzleSpec & { sheet: Sheet; target: Picture; goal: string; par: number; solution: Fold[] };
const built = new Map<string, Puzzle>();
export function puzzle(id: string): Puzzle {
  const hit = built.get(id); if (hit) return hit;
  const spec = PUZZLES.find((p) => p.id === id); if (!spec) throw new Error('no puzzle ' + id);
  const sheet = makeSheet(spec), solution = spec.sol.map(parseFold);
  let paper = flatPaper(sheet);
  for (const f of solution) { const q = applyFold(sheet, paper, f); if (!q) throw new Error(`${id}: fold ${foldText(f)} is not allowed`); paper = q; }
  const target = picture(sheet, paper);
  const p: Puzzle = { ...spec, sheet, target, goal: pictureKey(target), par: solution.length, solution };
  built.set(id, p); return p;
}

export type FoldEvent = { kind: 'fold'; fold: Fold; under: boolean; before: Paper; after: Paper } | { kind: 'blocked'; why: string } | { kind: 'solved'; seal: Seal };

export class FoldGame {
  readonly p: Puzzle;
  paper: Paper;
  history: Paper[] = [];
  /** folds made since the last reset, undone ones included */
  folds = 0;
  solved = false;
  constructor(id: string) { this.p = puzzle(id); this.paper = flatPaper(this.p.sheet); }
  get sheet() { return this.p.sheet; }
  check(f: Fold) { return checkFold(this.p.sheet, this.paper, f); }
  fold(f: Fold): FoldEvent[] {
    if (this.solved) return [];
    const c = this.check(f); if (c.ok === false) return [{ kind: 'blocked', why: c.why }];
    const before = this.paper, after = applyFold(this.p.sheet, before, f)!;
    this.history.push(before); this.paper = after; this.folds++;
    const ev: FoldEvent[] = [{ kind: 'fold', fold: f, under: c.under, before, after }];
    if (this.matches()) { this.solved = true; ev.push({ kind: 'solved', seal: sealFor(this.folds, this.p.par) }); }
    return ev;
  }
  undo() { if (this.solved || !this.history.length) return false; this.paper = this.history.pop()!; return true; }
  reset() { if (this.solved) return false; this.paper = flatPaper(this.p.sheet); this.history = []; this.folds = 0; return true; }
  matches() { return pictureKey(picture(this.p.sheet, this.paper)) === this.p.goal; }
  picture() { return picture(this.p.sheet, this.paper); }
  /** The first fold of a shortest way from here, or null when the target can no longer be reached. */
  hint(): Fold | null {
    if (this.solved) return null;
    const s = solve(this.p.sheet, this.paper, this.p.goal, this.p.par + 2, 60000);
    return s && s.first.length ? s.first[0] : null;
  }
}

// ---- progress
export type Save = { v: 1; done: Record<string, { seal: Seal; best: number }>; tips: string[]; ended: boolean; settings: { sound: boolean; music: boolean } };
export const freshSave = (): Save => ({ v: 1, done: {}, tips: [], ended: false, settings: { sound: true, music: true } });
/** Reads a save defensively: anything odd is dropped rather than trusted. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  let d: unknown; try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object') return s;
  const o = d as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.done && typeof o.done === 'object') for (const [id, r] of Object.entries(o.done as Record<string, unknown>)) {
    if (!PUZZLES.some((p) => p.id === id) || !r || typeof r !== 'object') continue;
    const { seal, best } = r as Record<string, unknown>;
    if ((seal === 1 || seal === 2 || seal === 3) && typeof best === 'number' && Number.isFinite(best) && best >= 1 && best < 1000) s.done[id] = { seal, best: Math.floor(best) };
  }
  if (Array.isArray(o.tips)) s.tips = o.tips.filter((t): t is string => typeof t === 'string').slice(0, 50);
  s.ended = o.ended === true;
  const st = o.settings as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') { if (typeof st.sound === 'boolean') s.settings.sound = st.sound; if (typeof st.music === 'boolean') s.settings.music = st.music; }
  return s;
}
export function record(save: Save, id: string, folds: number): { seal: Seal; better: boolean; first: boolean } {
  const p = puzzle(id), seal = sealFor(folds, p.par), had = save.done[id];
  const better = !had || seal > had.seal || folds < had.best;
  save.done[id] = { seal: Math.max(had?.seal ?? 0, seal) as Seal, best: Math.min(had?.best ?? Infinity, folds) };
  return { seal, better, first: !had };
}
export const chapterPuzzles = (c: ChapterId) => PUZZLES.filter((p) => p.chapter === c);
export const doneIn = (save: Save, c: ChapterId) => chapterPuzzles(c).filter((p) => save.done[p.id]).length;
/** A chapter opens when six of the one before are folded. */
export function chapterOpen(save: Save, c: ChapterId) {
  const i = CHAPTERS.findIndex((x) => x.id === c);
  return i <= 0 || doneIn(save, CHAPTERS[i - 1].id) >= 6;
}
/** Within an open chapter the puzzles open in order, always two ahead of the folded ones. */
export function puzzleOpen(save: Save, id: string) {
  const p = PUZZLES.find((x) => x.id === id); if (!p || !chapterOpen(save, p.chapter)) return false;
  const list = chapterPuzzles(p.chapter), i = list.indexOf(p);
  if (save.done[id]) return true;
  // the showpiece at the end waits for every other page of its chapter
  if (i === list.length - 1) return list.slice(0, -1).every((q) => save.done[q.id]);
  return i < doneIn(save, p.chapter) + 2;
}
/** The next unfolded open puzzle, in book order. */
export const nextPuzzle = (save: Save) => PUZZLES.find((p) => !save.done[p.id] && puzzleOpen(save, p.id))?.id ?? null;
export const sealCount = (save: Save) => Object.values(save.done).filter((d) => d.seal === 3).length;
export const FINALE = () => PUZZLES[PUZZLES.length - 1].id;

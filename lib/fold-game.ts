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

// ---- the solver, for hints and for the tests. Breadth first over whole paper states is far too slow for the big
// sheets (a 6 by 6 sheet reaches millions of stackings), so it splits the problem by axis instead. Where a square
// ends up along x depends only on the vertical folds made (in their order), never on the horizontal ones, and the
// same holds for y; which face is up depends only on how many folds lifted it. Only the stacking order depends on
// how the two kinds of fold are interleaved. Every fold also makes the paper strictly narrower or shorter, so each
// axis has only a few hundred fold chains. The solver lists the chains of each axis that end at the target's size,
// keeps the pairs whose landing places alone could make the picture (the outline, the holes and a square with the
// right face for every position), and only then plays out each interleaving of the pair with the real fold rules,
// tape and creases included. The search is exhaustive, so the minimum and the count of shortest solutions are exact.
export type Solved = { min: number; count: number; first: Fold[]; path: Fold[]; pairs: number } | null;

/** One chain of folds along one axis: the folds, and per square its final coordinate and how often it was lifted. */
type Chain = { folds: Fold[]; at: Int16Array; lifted: Uint8Array };
function chains(sheet: Sheet, start: Int16Array, axis: 'x' | 'y', size: number, want: number, maxLen: number): Chain[][] {
  const out: Chain[][] = Array.from({ length: maxLen + 1 }, () => []);
  const n = start.length;
  const walk = (at: Int16Array, lifted: Uint8Array, w: number, folds: Fold[]) => {
    if (w === want) out[folds.length].push({ folds, at, lifted });
    if (folds.length >= maxLen || w <= want) return;
    for (let k = 1; k < w; k++) for (const low of [true, false]) {
      const nw = Math.max(k, w - k); if (nw < want) continue;
      const up = (v: number) => (low ? v < k : v >= k);
      if (sheet.tape.some(([a, b]) => up(at[a]) !== up(at[b]))) continue;
      const na = new Int16Array(n), nl = lifted.slice(); let lo = Infinity;
      for (let c = 0; c < n; c++) { const u = up(at[c]); na[c] = u ? 2 * k - 1 - at[c] : at[c]; if (u) nl[c]++; lo = Math.min(lo, na[c]); }
      for (let c = 0; c < n; c++) na[c] -= lo;
      walk(na, nl, nw, [...folds, { axis, at: k, low }]);
    }
  };
  walk(start, new Uint8Array(n), size, []);
  return out;
}

/** A lean copy of the paper for the solver's inner loop: stacks on a fixed grid (each layer a square's number times
 * two, plus one when it lies face down), and where each square is and which way up. `fastFold` follows exactly the
 * rules of `checkFold` and `applyFold`; the tests check the solver against a plain search built on those. */
type Fast = { w: number; h: number; st: (Int16Array | null)[]; cx: Int16Array; cy: Int16Array; up: Uint8Array };
function fastFold(sheet: Sheet, s: Fast, f: Fold, SW: number): Fast | null {
  const xa = f.axis === 'x', coord = xa ? s.cx : s.cy, k = f.at, low = f.low;
  const lifts = (v: number) => (low ? v < k : v >= k);
  for (const [a, b] of sheet.tape) if (lifts(coord[a]) !== lifts(coord[b])) return null;
  let need = 0;
  for (const cr of sheet.creases) {
    const la = lifts(coord[cr.a]); if (la === lifts(coord[cr.b])) continue;
    const seen = (cr.kind === 'mountain') === (s.up[la ? cr.b : cr.a] === 0) ? 2 : 1;
    if (need && need !== seen) return null;
    need = seen;
  }
  const n = s.cx.length, cx = s.cx.slice(), cy = s.cy.slice(), up = s.up.slice(), nc = xa ? cx : cy;
  let lo = Infinity, hi = -Infinity;
  for (let c = 0; c < n; c++) { if (lifts(coord[c])) { nc[c] = 2 * k - 1 - coord[c]; up[c] ^= 1; } if (nc[c] < lo) lo = nc[c]; if (nc[c] > hi) hi = nc[c]; }
  for (let c = 0; c < n; c++) nc[c] -= lo;
  const st: (Int16Array | null)[] = new Array(s.st.length).fill(null), moved: [number, Int16Array][] = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const here = s.st[x + y * SW]; if (!here) continue;
    const v = xa ? x : y;
    if (!lifts(v)) { st[(xa ? x - lo : x) + (xa ? y : y - lo) * SW] = here; continue; }
    const m = 2 * k - 1 - v - lo, flipped = new Int16Array(here.length);
    for (let i = 0; i < here.length; i++) flipped[i] = here[here.length - 1 - i] ^ 1;
    moved.push([(xa ? m : x) + (xa ? y : m) * SW, flipped]);
  }
  for (const [i, flipped] of moved) {
    const below = st[i]; if (!below) { st[i] = flipped; continue; }
    const out = new Int16Array(below.length + flipped.length);
    if (need === 2) { out.set(flipped); out.set(below, flipped.length); } else { out.set(below); out.set(flipped, below.length); }
    st[i] = out;
  }
  return { w: xa ? hi - lo + 1 : s.w, h: xa ? s.h : hi - lo + 1, st, cx, cy, up };
}

/** Every shortest fold sequence from `paper` to a paper showing `target`, found exhaustively up to `maxDepth` folds:
 * the length, how many sequences of that length there are, the folds that start one, and one of them. With
 * `all` false it stops at the first shortest sequence (enough for a hint; the count is then 1). */
export function solve(sheet: Sheet, paper: Paper, target: Picture, maxDepth = 99, all = true): Solved {
  const goal = pictureKey(target);
  if (pictureKey(picture(sheet, paper)) === goal) return { min: 0, count: 1, first: [], path: [], pairs: 0 };
  const n = sheet.cells.length, where = whereIs(paper);
  const x0 = new Int16Array(n), y0 = new Int16Array(n), up0 = new Uint8Array(n);
  for (const [c, w] of where) { x0[c] = px(w.p); y0[c] = py(w.p); up0[c] = w.up === 'b' ? 1 : 0; }
  const depth = Math.min(maxDepth, paper.w - target.w + paper.h - target.h);
  if (target.w > paper.w || target.h > paper.h || depth < 0) return null;
  const xs = chains(sheet, x0, 'x', paper.w, target.w, depth), ys = chains(sheet, y0, 'y', paper.h, target.h, depth);
  // the paper and the target in the solver's lean form: each face and each target square as a number
  const SW = paper.w, TW = target.w, ids = new Map<string, number>();
  const id = (k: string) => { let v = ids.get(k); if (v === undefined) ids.set(k, (v = ids.size)); return v; };
  const face = new Int16Array(n * 2);
  for (const c of sheet.cells) { face[c.id * 2] = c.hole ? -1 : id(topKey({ colour: c.f, mark: c.fm })); face[c.id * 2 + 1] = c.hole ? -1 : id(topKey({ colour: c.b, mark: c.bm })); }
  const want = new Int16Array(TW * target.h).fill(-2);
  for (const [p, t] of target.tops) want[px(p) + py(p) * TW] = t === 'hole' ? -1 : id(topKey(t));
  const shown = want.filter((t) => t >= 0).length;
  const st: (Int16Array | null)[] = new Array(SW * paper.h).fill(null);
  for (const [p, layers] of paper.stacks) st[px(p) + py(p) * SW] = Int16Array.from(layers, (l) => l.c * 2 + (l.up === 'b' ? 1 : 0));
  const start: Fast = { w: paper.w, h: paper.h, st, cx: x0, cy: y0, up: up0 };
  const matches = (s: Fast) => {
    if (s.w !== TW || s.h !== target.h) return false;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const here = s.st[x + y * SW], t = want[x + y * TW];
      if (!here) { if (t !== -2) return false; continue; }
      let top = -1; for (let i = here.length - 1; i >= 0 && top < 0; i--) top = face[here[i]];
      if (top !== t) return false;
    }
    return true;
  };
  // A pair of chains fixes where every square lands and which face it shows, whatever the interleaving. It can only
  // make the picture if the outline matches, every hole position holds only punched squares, and every other
  // position gets at least one square showing the wanted face: those squares are the pair's candidates.
  type Pair = { X: Chain; Y: Chain; cand: number[]; at: Int16Array; back: Uint8Array };
  const mark = new Int32Array(TW * target.h); let stamp = 0;
  const pairOf = (X: Chain, Y: Chain): Pair | null => {
    stamp++; let got = 0; const cand: number[] = [], at = new Int16Array(n), back = new Uint8Array(n);
    const filled = new Uint8Array(TW * target.h);
    for (let c = 0; c < n; c++) {
      const xx = X.at[c], yy = Y.at[c]; if (xx >= TW || yy >= target.h) return null;
      const i = xx + yy * TW, t = want[i]; if (t === -2) return null;
      filled[i] = 1; at[c] = i; back[c] = (up0[c] + X.lifted[c] + Y.lifted[c]) & 1;
      const f = face[c * 2 + back[c]];
      if (t === -1) { if (f !== -1) return null; continue; }
      if (f === t) { cand.push(c); if (mark[i] !== stamp) { mark[i] = stamp; got++; } }
    }
    for (let i = 0; i < want.length; i++) if (want[i] !== -2 && !filled[i]) return null;
    return got === shown ? { X, Y, cand, at, back } : null;
  };
  // Two squares in one stack never part again, and their order flips exactly when their stack is lifted. So a
  // candidate can still end on top only if it is the highest unpunched square of its stack now (with an even number
  // of lifts to come, that is, if it shows now the face it must end on) or the lowest (with an odd number).
  const topNow = new Uint8Array(n), bottomNow = new Uint8Array(n);
  const alive = (s: Fast, pr: Pair) => {
    stamp++; let got = 0;
    for (const c of pr.cand) {
      const i = pr.at[c]; if (mark[i] === stamp) continue;
      if (pr.back[c] === s.up[c] ? topNow[c] : bottomNow[c]) { mark[i] = stamp; got++; }
    }
    return got === shown;
  };
  let pairs = 0;
  for (let L = 1; L <= depth; L++) {
    let count = 0, path: Fold[] | null = null; const firsts = new Set<string>();
    const live: Pair[] = [];
    for (let a = 0; a <= L; a++) {
      const b = L - a; if (a >= xs.length || b >= ys.length) continue;
      for (const X of xs[a]) for (const Y of ys[b]) { const pr = pairOf(X, Y); if (pr) live.push(pr); }
    }
    pairs += live.length;
    // play every interleaving of every surviving pair with the real rules; pairs that share the folds made so far
    // share the paper too, so each prefix is folded once
    const walk = (i: number, j: number, p: Fast, seq: Fold[], list: Pair[]) => {
      if (!all && path) return;
      topNow.fill(0); bottomNow.fill(0);
      for (const here of p.st) {
        if (!here) continue;
        let k = here.length - 1; while (k >= 0 && face[here[k]] < 0) k--; if (k >= 0) topNow[here[k] >> 1] = 1;
        k = 0; while (k < here.length && face[here[k]] < 0) k++; if (k < here.length) bottomNow[here[k] >> 1] = 1;
      }
      const next = new Map<string, { f: Fold; x: boolean; list: Pair[] }>();
      for (const pr of list) {
        if (!alive(p, pr)) continue;
        if (pr.X.folds.length === i && pr.Y.folds.length === j) {
          if (matches(p)) { count++; path ??= seq.slice(); firsts.add(foldText(seq[0])); }
          continue;
        }
        for (const [f, x] of [[pr.X.folds[i], true], [pr.Y.folds[j], false]] as const) {
          if (!f) continue;
          const k = foldText(f), g = next.get(k);
          if (g) g.list.push(pr); else next.set(k, { f, x, list: [pr] });
        }
      }
      for (const { f, x, list: sub } of next.values()) {
        const q = fastFold(sheet, p, f, SW); if (!q) continue;
        seq.push(f); walk(x ? i + 1 : i, x ? j : j + 1, q, seq, sub); seq.pop();
      }
    };
    if (live.length) walk(0, 0, start, [], live);
    if (path) return { min: L, count, first: [...firsts].sort().map(parseFold), path, pairs };
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
    const s = solve(this.p.sheet, this.paper, this.p.target, 99, false);
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

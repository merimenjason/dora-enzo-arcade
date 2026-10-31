// Starstitch: the rules. A constellation is a field of stars joined by seams; stitch it with one continuous thread
// that travels along the seams, every seam stitched exactly once (a double seam twice). Starting anywhere, unless a
// crescent moon says where. New rules arrive night by night: bright stars must be touched an exact number of times,
// knot stars only once, one-way seams only in their comet's direction, clouds hide seams until you look closely,
// twin stars jump the needle to their partner, and the full moon is where the thread must finish.
// Deterministic, no DOM: the page feeds it pointer samples in sky units (or star taps and keys), and the tests
// drive the same calls. Randomness (the generated skies) comes from a seeded generator in lib/stars-solver.ts.
import { PUZZLE_DEFS, NIGHT_DEFS, type PuzzleDef } from './stars-puzzles.js';

export type Moon = '' | 'start' | 'end';
export type Star = { x: number; y: number; bright: number; knot: boolean; twin: number; moon: Moon; name: string };
export type Seam = { a: number; b: number; need: number; oneway: boolean; cloud: boolean };
export type Cloud = { x: number; y: number; r: number };
export type Rule = 'bright' | 'knot' | 'double' | 'oneway' | 'cloud' | 'twin' | 'moon';
export type Teach = { title: string; text: string };
export type Puzzle = {
  id: string; name: string; night: number; index: number; figure: string | null; story: [string, string];
  stars: Star[]; seams: Seam[]; clouds: Cloud[]; teach: Teach | null; rules: Rule[];
};
export type Refusal = 'noseam' | 'used' | 'oneway' | 'knot' | 'full' | 'moon' | 'twinfull';
export type Ev =
  | { k: 'start'; at: number }
  | { k: 'stitch'; from: number; to: number; seam: number; n: number }
  | { k: 'jump'; from: number; to: number }
  | { k: 'unpick'; at: number }
  | { k: 'refuse'; at: number; why: Refusal }
  | { k: 'done' }
  | { k: 'stuck'; why: 'nomoves' | 'moon' | 'bright' };
export type Move = { from: number; seam: number; to: number; land: number };

// ---------------------------------------------------------------- reading the authored puzzles
/** Reads one puzzle from its compact authored form (see lib/stars-puzzles.ts for the notation). */
export function parsePuzzle(d: PuzzleDef, night: number, index: number): Puzzle {
  const stars: Star[] = [], names = new Map<string, number>(), twins: [number, string][] = [];
  for (const tok of d.s.split(',').map((t) => t.trim()).filter(Boolean)) {
    const [name, xs, ys, ...mods] = tok.split(/\s+/);
    const st: Star = { x: +xs, y: +ys, bright: 0, knot: false, twin: -1, moon: '', name };
    if (!Number.isFinite(st.x) || !Number.isFinite(st.y) || names.has(name)) throw new Error(`${d.id}: bad star ${tok}`);
    for (const m of mods) {
      if (m.startsWith('*')) st.bright = +m.slice(1);
      else if (m === '#') st.knot = true;
      else if (m === '(') st.moon = 'start';
      else if (m === ')') st.moon = 'end';
      else if (m.startsWith('~')) twins.push([stars.length, m.slice(1)]);
      else throw new Error(`${d.id}: bad mark ${m}`);
    }
    names.set(name, stars.length); stars.push(st);
  }
  for (const [i, other] of twins) { const j = names.get(other); if (j === undefined) throw new Error(`${d.id}: no twin ${other}`); stars[i].twin = j; stars[j].twin = i; }
  const clouds: Cloud[] = (d.c ?? []).map(([x, y, r]) => ({ x, y, r }));
  const seams: Seam[] = [];
  for (const tok of d.e.split(/\s+/).filter(Boolean)) {
    const m = /^([a-z0-9]+)([-=>])([a-z0-9]+)$/i.exec(tok); if (!m) throw new Error(`${d.id}: bad seam ${tok}`);
    const a = names.get(m[1]), b = names.get(m[3]); if (a === undefined || b === undefined || a === b) throw new Error(`${d.id}: bad seam ${tok}`);
    if (seams.some((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a))) throw new Error(`${d.id}: repeated seam ${tok}`);
    const mx = (stars[a].x + stars[b].x) / 2, my = (stars[a].y + stars[b].y) / 2;
    seams.push({ a, b, need: m[2] === '=' ? 2 : 1, oneway: m[2] === '>', cloud: clouds.some((c) => Math.hypot(c.x - mx, c.y - my) < c.r) });
  }
  return finish({ id: d.id, name: d.name, night, index, figure: d.fig ?? null, story: d.story, stars, seams, clouds, teach: d.teach ?? null, rules: [] });
}
/** Works out which rules a puzzle uses. */
export function finish(p: Puzzle): Puzzle {
  const r = new Set<Rule>();
  for (const s of p.stars) { if (s.bright) r.add('bright'); if (s.knot) r.add('knot'); if (s.twin >= 0) r.add('twin'); if (s.moon) r.add('moon'); }
  for (const s of p.seams) { if (s.need > 1) r.add('double'); if (s.oneway) r.add('oneway'); if (s.cloud) r.add('cloud'); }
  p.rules = (['bright', 'knot', 'double', 'oneway', 'cloud', 'twin', 'moon'] as Rule[]).filter((x) => r.has(x));
  return p;
}

export type Night = { n: number; name: string; blurb: string; sky: string };
export const NIGHTS: Night[] = NIGHT_DEFS.map((d, i) => ({ n: i, ...d }));
export const PUZZLES: Puzzle[] = PUZZLE_DEFS.map((d) => parsePuzzle(d, d.night, d.index));
export const PUZZLE: Record<string, Puzzle> = Object.fromEntries(PUZZLES.map((p) => [p.id, p]));
export const PUZZLE_IDS = PUZZLES.map((p) => p.id);
export const STORY = PUZZLES.filter((p) => p.night >= 1);
export const TUTORIAL = PUZZLES.filter((p) => p.night === 0);
export const FINALE = STORY[STORY.length - 1].id;
export const nightPuzzles = (n: number) => PUZZLES.filter((p) => p.night === n);
export const RULE_NAME: Record<Rule, string> = { bright: 'Bright stars', knot: 'Knot stars', double: 'Double seams', oneway: 'One-way seams', cloud: 'Clouds', twin: 'Twin stars', moon: 'Moons' };

// ---------------------------------------------------------------- stitching
/** One constellation being stitched: the thread so far, and the rules for the next stitch. */
export class Stitch {
  readonly p: Puzzle;
  moves: Move[] = [];
  first = -1;
  count: number[]; visits: number[];
  unpicks = 0; restarts = 0; hints = 0;
  events: Ev[] = [];
  /** The pointer: dragging the needle, and how far the pointer has wandered since it pressed. */
  private drag = false; private moved = false; private downAt: [number, number] = [0, 0];
  /** How far the needle has leapt during this drag: after a twin's leap the paw keeps steering the needle from where it
   *  landed, so the pointer is read shifted by this much until it lets go. */
  private shift: [number, number] = [0, 0];
  private won = false;
  constructor(p: Puzzle) { this.p = p; this.count = p.seams.map(() => 0); this.visits = p.stars.map(() => 0); }
  /** Where the needle is, or -1 before the first star. */
  get at() { return this.moves.length ? this.moves[this.moves.length - 1].land : this.first; }
  get started() { return this.first >= 0; }
  get stitched() { return this.count.reduce((a, b) => a + b, 0); }
  get total() { return this.p.seams.reduce((a, s) => a + s.need, 0); }
  get dragging() { return this.drag; }
  /** Where the pointer at (x, y) is steering the needle: the same point, shifted by any twin's leap in this drag. */
  aim(x: number, y: number): [number, number] { return [x + this.shift[0], y + this.shift[1]]; }
  /** Every seam stitched and every rule kept. */
  get done() { return this.won; }
  /** The thread as the stars it touched in order, twin jumps included. */
  path(): number[] { if (this.first < 0) return []; const out = [this.first]; for (const m of this.moves) { out.push(m.to); if (m.land !== m.to) out.push(m.land); } return out; }

  /** Why a star can't be the first, or null if it can. */
  startRefusal(i: number): Refusal | null {
    const p = this.p; if (i < 0 || i >= p.stars.length) return 'noseam';
    const moon = p.stars.findIndex((s) => s.moon === 'start');
    if (moon >= 0 && moon !== i) return 'moon';
    if (!p.seams.some((s) => s.a === i || (s.b === i && !s.oneway))) return 'noseam';
    return null;
  }
  start(i: number): boolean {
    if (this.started) return false;
    const why = this.startRefusal(i);
    if (why) { this.events.push({ k: 'refuse', at: i, why }); return false; }
    this.first = i; this.visits[i]++; this.events.push({ k: 'start', at: i }); this.check(); return true;
  }
  /** The seam a stitch from the needle to star `to` would use, or why it can't. */
  seamTo(to: number): number | Refusal {
    const p = this.p, at = this.at; if (at < 0) return 'noseam';
    let found: Refusal = 'noseam';
    for (let i = 0; i < p.seams.length; i++) {
      const s = p.seams[i];
      if (!((s.a === at && s.b === to) || (s.b === at && s.a === to))) continue;
      if (this.count[i] >= s.need) { found = 'used'; continue; }
      if (s.oneway && s.a !== at) { found = 'oneway'; continue; }
      const st = p.stars[to];
      if (st.knot && this.visits[to] >= 1) return 'knot';
      if (st.bright && this.visits[to] >= st.bright) return 'full';
      if (st.twin >= 0) { const tw = p.stars[st.twin]; if ((tw.knot && this.visits[st.twin] >= 1) || (tw.bright && this.visits[st.twin] >= tw.bright)) return 'twinfull'; }
      return i;
    }
    return found;
  }
  /** Every star the needle could stitch to next. */
  options(): number[] {
    if (!this.started || this.won) return [];
    const out: number[] = [];
    for (let j = 0; j < this.p.stars.length; j++) if (typeof this.seamTo(j) === 'number') out.push(j);
    return out;
  }
  stitch(to: number): boolean {
    if (!this.started || this.won) return false;
    const r = this.seamTo(to);
    if (typeof r !== 'number') { this.events.push({ k: 'refuse', at: to, why: r }); return false; }
    const p = this.p, from = this.at, tw = p.stars[to].twin;
    this.count[r]++; this.visits[to]++;
    const land = tw >= 0 ? tw : to;
    if (land !== to) this.visits[land]++;
    this.moves.push({ from, seam: r, to, land });
    this.events.push({ k: 'stitch', from, to, seam: r, n: this.stitched });
    // the needle leaps to the twin, and a drag carries on from there: the paw now steers the needle from the twin
    if (land !== to) {
      this.events.push({ k: 'jump', from: to, to: land });
      this.shift[0] += p.stars[land].x - p.stars[to].x; this.shift[1] += p.stars[land].y - p.stars[to].y;
    }
    this.check(); return true;
  }
  /** Unpicks the last stitch (or the first star, when that's all there is). */
  undo(): boolean {
    const m = this.moves.pop();
    if (!m) { if (this.first < 0) return false; this.visits[this.first]--; this.events.push({ k: 'unpick', at: this.first }); this.first = -1; this.unpicks++; return true; }
    this.count[m.seam]--; this.visits[m.to]--;
    if (m.land !== m.to) {
      // unpicking a leap takes the leap back off the pointer too, so a drag goes on steering from where the needle is
      this.visits[m.land]--;
      const p = this.p; this.shift[0] -= p.stars[m.land].x - p.stars[m.to].x; this.shift[1] -= p.stars[m.land].y - p.stars[m.to].y;
    }
    this.won = false; this.unpicks++; this.events.push({ k: 'unpick', at: m.from }); return true;
  }
  restart() { if (this.first >= 0 || this.moves.length) this.restarts++; this.moves = []; this.first = -1; this.count.fill(0); this.visits.fill(0); this.won = false; this.drag = false; this.shift = [0, 0]; }
  /** Stitched in one go: never unpicked or started again. */
  get clean() { return this.unpicks === 0 && this.restarts === 0; }
  /** Whether the thread can still go on, and if not, why. */
  stuckWhy(): 'nomoves' | 'moon' | 'bright' | null {
    if (!this.started || this.won || this.options().length) return null;
    if (this.stitched < this.total) return 'nomoves';
    const end = this.p.stars.findIndex((s) => s.moon === 'end');
    if (end >= 0 && this.at !== end) return 'moon';
    return 'bright';
  }
  private check() {
    const p = this.p;
    if (this.stitched < this.total) { const w = this.stuckWhy(); if (w) this.events.push({ k: 'stuck', why: w }); return; }
    const end = p.stars.findIndex((s) => s.moon === 'end');
    const okMoon = end < 0 || this.at === end;
    const okBright = p.stars.every((s, i) => !s.bright || this.visits[i] === s.bright);
    if (okMoon && okBright) { this.won = true; this.drag = false; this.events.push({ k: 'done' }); }
    else this.events.push({ k: 'stuck', why: okMoon ? 'bright' : 'moon' });
  }

  // ---------------------------------------------------------------- the pointer, in sky units; r is the hit radius
  /** The nearest star within r of a point, or -1. */
  starAt(x: number, y: number, r: number): number {
    let best = -1, bd = r;
    this.p.stars.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y); if (d <= bd) { bd = d; best = i; } });
    return best;
  }
  down(x: number, y: number, r: number) {
    if (this.won) return;
    this.downAt = [x, y]; this.moved = false; this.shift = [0, 0];
    const i = this.starAt(x, y, r);
    if (!this.started) { if (i >= 0 && this.start(i)) this.drag = true; return; }
    if (i === this.at) { this.drag = true; return; }
    if (i >= 0) { if (this.stitch(i)) this.drag = !this.won; return; }
    // pressing on empty sky near the thread still picks up the needle, so a near miss isn't a dead click
    const a = this.p.stars[this.at];
    if (Math.hypot(a.x - x, a.y - y) <= r * 1.8) this.drag = true;
  }
  move(x: number, y: number, r: number) {
    if (!this.drag || this.won) return;
    if (!this.moved && Math.hypot(x - this.downAt[0], y - this.downAt[1]) > r * 0.5) this.moved = true;
    if (!this.moved) return;
    for (let n = 0; n < 4 && this.drag && !this.won; n++) { const [ax, ay] = this.aim(x, y); if (!this.snap(ax, ay, r)) break; }
  }
  up() { this.drag = false; this.shift = [0, 0]; }
  /** One step of the drag: stitch to the star the pointer is heading for, or unpick back along the thread. */
  private snap(x: number, y: number, r: number): boolean {
    const at = this.at, A = this.p.stars[at], opts = this.options();
    const last = this.moves[this.moves.length - 1];
    let back = last && !opts.includes(last.from) ? last.from : -1;
    // where each candidate lies for the drag; after a leap, the way back is the way the paw came, back along the
    // stitch into the twin, seen from where the needle landed
    const pos = (j: number, isBack: boolean): { x: number; y: number } => {
      const B = this.p.stars[j]; if (!isBack || last.land === last.to) return B;
      const T = this.p.stars[last.to], L = this.p.stars[last.land]; return { x: B.x + L.x - T.x, y: B.y + L.y - T.y };
    };
    const heading = (B: { x: number; y: number }) => Math.atan2(B.y - A.y, B.x - A.x);
    const apart = (a: number, b: number) => { const d = Math.abs(a - b); return d > Math.PI ? 2 * Math.PI - d : d; };
    // that way back can line up with a star the needle could go on to; going on wins (↶ still unpicks the leap)
    if (back >= 0 && last.land !== last.to) { const g = heading(pos(back, true)); if (opts.some((j) => apart(heading(this.p.stars[j]), g) < 0.5)) back = -1; }
    const cands: [number, boolean][] = opts.map((j) => [j, false]);
    if (back >= 0) cands.push([back, true]);
    if (!cands.length) return false;
    let pick = -1, unpick = false, near = r;
    // right on a star: that one
    for (const [j, isBack] of cands) { const B = pos(j, isBack), d = Math.hypot(B.x - x, B.y - y); if (d <= near) { near = d; pick = j; unpick = isBack; } }
    if (pick < 0) {
      // otherwise the star whose direction the drag is heading in, once it is past 60% of the way along its seam and
      // not far off the line. Unpicking asks for more (further along, closer to the thread), so a drag that only
      // brushes past the last star doesn't undo it.
      const ux = x - A.x, uy = y - A.y; if (Math.hypot(ux, uy) < r * 0.8) return false;
      const ang = Math.atan2(uy, ux);
      let best: [number, boolean] | null = null, bestD = Infinity;
      for (const c of cands) { const d = apart(heading(pos(c[0], c[1])), ang); if (d < bestD) { bestD = d; best = c; } }
      const [j, isBack] = best!, B = pos(j, isBack), vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy, L = Math.sqrt(L2) || 1;
      const t = (ux * vx + uy * vy) / L2, perp = Math.abs(ux * vy - uy * vx) / L;
      const ok = isBack ? t > 0.72 && t < 1.4 && perp < r * 0.8 : t > 0.6 && t < 1.6 && perp < Math.max(r, L * 0.28);
      if (ok) { pick = j; unpick = isBack; }
    }
    if (pick < 0) return false;
    if (unpick) { this.undo(); return true; }
    return this.stitch(pick);
  }
}

// ---------------------------------------------------------------- progress
export const SAVE_KEY = 'starstitch-v1';
export const BANK_MAX = 5;
export type Solved = { one: boolean; hint: boolean };
export type Save = {
  v: 1; solved: Record<string, Solved>; bank: number; seen: string[]; ended: boolean;
  daily: { last: string; streak: number; done: string[] }; shoot: { level: number; best: number };
  settings: { sound: boolean; music: boolean };
};
export const freshSave = (): Save => ({ v: 1, solved: {}, bank: 1, seen: [], ended: false, daily: { last: '', streak: 0, done: [] }, shoot: { level: 1, best: 0 }, settings: { sound: true, music: true } });
const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Reads a save, ignoring anything that doesn't make sense; a broken save starts fresh. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.solved)) for (const id of PUZZLE_IDS) { const v = o.solved[id]; if (isObj(v)) s.solved[id] = { one: v.one === true, hint: v.hint === true }; }
    // a puzzle only counts if the ones before it in its night are solved too
    for (const p of PUZZLES) if (s.solved[p.id] && !puzzleOpen(s, p.id)) delete s.solved[p.id];
    s.bank = Math.floor(num(o.bank, 0, BANK_MAX, 1));
    if (Array.isArray(o.seen)) s.seen = [...new Set(o.seen.filter((x): x is string => typeof x === 'string' && x.length < 40))].slice(0, 80);
    s.ended = o.ended === true && storyDone(s);
    if (isObj(o.daily)) {
      const d = o.daily;
      if (typeof d.last === 'string' && DAY_RE.test(d.last)) s.daily.last = d.last;
      s.daily.streak = Math.floor(num(d.streak, 0, 9999, 0));
      if (Array.isArray(d.done)) s.daily.done = d.done.filter((x): x is string => typeof x === 'string' && DAY_RE.test(x)).slice(-60);
    }
    if (isObj(o.shoot)) { s.shoot.level = Math.floor(num(o.shoot.level, 1, 999, 1)); s.shoot.best = Math.floor(num(o.shoot.best, 0, 999, 0)); }
    if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; }
  } catch { return freshSave(); }
  return s;
}
/** A puzzle opens once the one before it in its night is stitched, and a night once the last night's finale is. */
export function puzzleOpen(s: Save, id: string): boolean {
  const p = PUZZLE[id]; if (!p) return false;
  if (p.night === 0) return p.index === 0 || !!s.solved[TUTORIAL[p.index - 1].id];
  if (!nightOpen(s, p.night)) return false;
  return p.index === 0 || !!s.solved[nightPuzzles(p.night)[p.index - 1].id];
}
export function nightOpen(s: Save, n: number): boolean {
  if (n <= 1) return true;
  const prev = nightPuzzles(n - 1);
  return !!s.solved[prev[prev.length - 1].id];
}
export const nightSolved = (s: Save, n: number) => nightPuzzles(n).filter((p) => s.solved[p.id]).length;
export const storyDone = (s: Save) => STORY.every((p) => s.solved[p.id]);
export const medals = (s: Save) => STORY.filter((p) => s.solved[p.id]?.one).length;
export const solvedCount = (s: Save) => STORY.filter((p) => s.solved[p.id]).length;
/** The next puzzle to play: the first open, unsolved one (the tutorial first). */
export function nextPuzzle(s: Save): Puzzle | null {
  for (const p of [...TUTORIAL, ...STORY]) if (!s.solved[p.id] && puzzleOpen(s, p.id)) return p;
  return null;
}
export type Result = { first: boolean; medal: boolean; newMedal: boolean; earned: boolean; finale: boolean; nightDone: boolean };
/** Records a solved puzzle: the star medal for one go, and a hint banked for solving without one. */
export function record(s: Save, st: Stitch): Result {
  const p = st.p, had = s.solved[p.id];
  const medal = st.clean, used = st.hints > 0;
  const earned = !used && !had && s.bank < BANK_MAX;
  if (earned) s.bank++;
  s.solved[p.id] = { one: (had?.one ?? false) || medal, hint: had ? had.hint && used : used };
  const finale = p.id === FINALE && !s.ended;
  const np = nightPuzzles(p.night);
  return { first: !had, medal, newMedal: medal && !had?.one, earned, finale, nightDone: !had && p.night >= 1 && np.every((q) => s.solved[q.id]) };
}
/** A daily sky solved today. */
export function recordDaily(s: Save, day: string, yesterday: string): boolean {
  if (!DAY_RE.test(day) || s.daily.done.includes(day)) return false;
  s.daily.streak = s.daily.last === yesterday ? s.daily.streak + 1 : 1;
  s.daily.last = day; s.daily.done = [...s.daily.done, day].slice(-60);
  return true;
}
/** The day before a yyyy-mm-dd date, as yyyy-mm-dd (calendar arithmetic, no clock). */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (d > 1) return `${y}-${String(m).padStart(2, '0')}-${String(d - 1).padStart(2, '0')}`;
  const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
  const dim = [31, (py % 4 === 0 && py % 100 !== 0) || py % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][pm - 1];
  return `${py}-${String(pm).padStart(2, '0')}-${String(dim).padStart(2, '0')}`;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashSeed = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

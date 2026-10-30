// Starstitch: the solver, the hints and the generated skies. The solver walks the same rules as the engine's Stitch
// (lib/stars-game.ts) on a lean copy of the puzzle, remembering every dead end so it never explores one twice; it
// finds a solution, counts them, and says where to start, what to stitch next, or how far to unpick. The generator
// builds the Daily Sky and the Shooting Star skies by walking a thread first and turning its path into the seams,
// so every generated sky is solvable by construction (and the solver checks it anyway).
import { Stitch, finish, rng, hashSeed, type Puzzle, type Rule, type Star, type Seam, type Cloud } from './stars-game.js';

type Lean = {
  n: number; total: number; need: number[]; oneway: boolean[]; a: number[]; b: number[];
  adj: { s: number; to: number }[][]; bright: number[]; knot: boolean[]; twin: number[]; startMoon: number; endMoon: number; watch: number[];
};
function lean(p: Puzzle): Lean {
  const n = p.stars.length, adj: { s: number; to: number }[][] = p.stars.map(() => []);
  p.seams.forEach((s, i) => { adj[s.a].push({ s: i, to: s.b }); if (!s.oneway) adj[s.b].push({ s: i, to: s.a }); });
  const watch = p.stars.map((s, i) => (s.bright || s.knot || s.twin >= 0 ? i : -1)).filter((i) => i >= 0);
  // a twin's partner is watched too, since landing there counts
  for (const i of [...watch]) { const t = p.stars[i].twin; if (t >= 0 && !watch.includes(t)) watch.push(t); }
  return {
    n, total: p.seams.reduce((a, s) => a + s.need, 0), need: p.seams.map((s) => s.need), oneway: p.seams.map((s) => s.oneway), a: p.seams.map((s) => s.a), b: p.seams.map((s) => s.b), adj,
    bright: p.stars.map((s) => s.bright), knot: p.stars.map((s) => s.knot), twin: p.stars.map((s) => s.twin),
    startMoon: p.stars.findIndex((s) => s.moon === 'start'), endMoon: p.stars.findIndex((s) => s.moon === 'end'), watch,
  };
}
type St = { at: number; count: number[]; visits: number[]; done: number };
const fresh = (g: Lean, at: number): St => { const v = new Array(g.n).fill(0); v[at] = 1; return { at, count: new Array(g.need.length).fill(0), visits: v, done: 0 }; };
const fromStitch = (g: Lean, st: Stitch): St => ({ at: st.at, count: [...st.count], visits: [...st.visits], done: st.stitched });
const key = (g: Lean, s: St) => s.at + ':' + s.count.join('') + ':' + g.watch.map((i) => s.visits[i]).join('');
const startable = (g: Lean, i: number) => (g.startMoon < 0 || g.startMoon === i) && g.adj[i].length > 0;
/** The moves open from a state, as [seam, to] pairs. */
function moves(g: Lean, s: St): [number, number][] {
  const out: [number, number][] = [];
  for (const { s: k, to } of g.adj[s.at]) {
    if (s.count[k] >= g.need[k]) continue;
    if (g.knot[to] && s.visits[to] >= 1) continue;
    if (g.bright[to] && s.visits[to] >= g.bright[to]) continue;
    const t = g.twin[to];
    if (t >= 0 && ((g.knot[t] && s.visits[t] >= 1) || (g.bright[t] && s.visits[t] >= g.bright[t]))) continue;
    if (out.some(([, x]) => x === to)) continue; // two ways to the same star are the same stitch
    out.push([k, to]);
  }
  return out;
}
function apply(g: Lean, s: St, k: number, to: number) { s.count[k]++; s.visits[to]++; const t = g.twin[to]; if (t >= 0) s.visits[t]++; s.at = t >= 0 ? t : to; s.done++; }
function unapply(g: Lean, s: St, k: number, to: number, from: number) { s.count[k]--; s.visits[to]--; const t = g.twin[to]; if (t >= 0) s.visits[t]--; s.at = from; s.done--; }
const won = (g: Lean, s: St) => s.done === g.total && (g.endMoon < 0 || s.at === g.endMoon) && g.bright.every((b, i) => !b || s.visits[i] === b);

/** Finds a way to finish from a state: the stars to stitch to, in order, or null. */
function search(g: Lean, s: St, dead: Set<string>, budget: { n: number }): number[] | null {
  if (won(g, s)) return [];
  if (s.done === g.total) return null;
  const k0 = key(g, s); if (dead.has(k0)) return null;
  if (--budget.n < 0) return null;
  for (const [k, to] of moves(g, s)) {
    const from = s.at; apply(g, s, k, to);
    const r = search(g, s, dead, budget);
    unapply(g, s, k, to, from);
    if (r) return [to, ...r];
  }
  dead.add(k0); return null;
}
export type Solution = { start: number; path: number[] };
/** A solution from the beginning (or from a given start), or null. */
export function solve(p: Puzzle, start = -1): Solution | null {
  const g = lean(p), dead = new Set<string>(), budget = { n: 2_000_000 };
  for (let i = 0; i < g.n; i++) {
    if (start >= 0 && i !== start) continue;
    if (!startable(g, i)) continue;
    const r = search(g, fresh(g, i), dead, budget);
    if (r) return { start: i, path: r };
  }
  return null;
}
/** Can the stitch still be finished from where it is? */
export function solvable(st: Stitch): boolean {
  const g = lean(st.p);
  if (!st.started) return !!solve(st.p);
  return !!search(g, fromStitch(g, st), new Set(), { n: 2_000_000 });
}
/** Counts the solutions (every start, every order), stopping at cap. */
export function countSolutions(p: Puzzle, cap = 1e6): number {
  const g = lean(p), memo = new Map<string, number>();
  const rec = (s: St): number => {
    if (won(g, s)) return 1;
    if (s.done === g.total) return 0;
    const k0 = key(g, s), m = memo.get(k0); if (m !== undefined) return m;
    let n = 0;
    for (const [k, to] of moves(g, s)) { const from = s.at; apply(g, s, k, to); n += rec(s); unapply(g, s, k, to, from); if (n >= cap) break; }
    n = Math.min(n, cap); memo.set(k0, n); return n;
  };
  let total = 0;
  for (let i = 0; i < g.n && total < cap; i++) if (startable(g, i)) total += rec(fresh(g, i));
  return Math.min(total, cap);
}
/** The stars a solution can start from. */
export function goodStarts(p: Puzzle): number[] {
  const g = lean(p), dead = new Set<string>(), out: number[] = [];
  for (let i = 0; i < g.n; i++) if (startable(g, i) && search(g, fresh(g, i), dead, { n: 400_000 })) out.push(i);
  return out;
}
/** How often a player stitching at random (any legal start, any legal stitch) gets stuck: 0 never, 1 always. */
export function randomFail(p: Puzzle, tries = 400, seed = 7): number {
  const g = lean(p), r = rng(seed), starts = [...Array(g.n).keys()].filter((i) => startable(g, i));
  let fail = 0;
  for (let t = 0; t < tries; t++) {
    const s = fresh(g, starts[Math.floor(r() * starts.length)]);
    for (;;) { const ms = moves(g, s); if (!ms.length) break; const [k, to] = ms[Math.floor(r() * ms.length)]; apply(g, s, k, to); }
    if (!won(g, s)) fail++;
  }
  return fail / tries;
}
/** How often a thoughtful player gets stuck: they start at an odd star (or the moon), never cut the remaining seams
 *  in two when there's a choice (Fleury's rule), and otherwise choose at random. Rules beyond plain seams trip them. */
export function carefulFail(p: Puzzle, tries = 200, seed = 11): number {
  const g = lean(p), r = rng(seed);
  const deg = (i: number) => g.adj[i].reduce((a, e) => a + g.need[e.s], 0) + p.seams.reduce((a, sm, k) => a + (sm.oneway && sm.b === i ? g.need[k] : 0), 0);
  let starts = [...Array(g.n).keys()].filter((i) => startable(g, i));
  const odd = starts.filter((i) => deg(i) % 2 === 1); if (odd.length) starts = odd;
  let fail = 0;
  for (let t = 0; t < tries; t++) {
    const s = fresh(g, starts[Math.floor(r() * starts.length)]);
    for (;;) {
      let ms = moves(g, s); if (!ms.length) break;
      if (ms.length > 1) { const safe = ms.filter(([k, to]) => !cuts(g, s, k, to)); if (safe.length) ms = safe; }
      const [k, to] = ms[Math.floor(r() * ms.length)]; apply(g, s, k, to);
    }
    if (!won(g, s)) fail++;
  }
  return fail / tries;
}
/** Would stitching seam k leave the unstitched seams in two pieces the needle can't both reach? */
function cuts(g: Lean, s: St, k: number, to: number): boolean {
  const left = (k2: number) => g.need[k2] - s.count[k2] - (k2 === k ? 1 : 0);
  let rest = 0; for (let i = 0; i < g.need.length; i++) rest += left(i); if (!rest) return false;
  const land = g.twin[to] >= 0 ? g.twin[to] : to;
  const seen = new Set<number>([land]), stack = [land]; let reach = 0;
  const und: number[][] = Array.from({ length: g.n }, () => []);
  for (let i = 0; i < g.need.length; i++) if (left(i) > 0) { und[g.a[i]].push(i); und[g.b[i]].push(i); }
  const counted = new Set<number>();
  while (stack.length) {
    const v = stack.pop()!;
    for (const i of und[v]) { if (!counted.has(i)) { counted.add(i); reach += left(i); } const o = g.a[i] === v ? g.b[i] : g.a[i]; if (!seen.has(o)) { seen.add(o); stack.push(o); } }
    const t = g.twin[v]; if (t >= 0 && !seen.has(t)) { seen.add(t); stack.push(t); }
  }
  return reach < rest;
}

export type Hint = { k: 'start'; at: number } | { k: 'next'; to: number } | { k: 'back'; steps: number; at: number } | { k: 'none' };
/** A gentle hint: where to start, the next right stitch, or how far to unpick to get back on a good path. */
export function hint(st: Stitch): Hint {
  const p = st.p, g = lean(p);
  if (!st.started) { const s = solve(p); return s ? { k: 'start', at: s.start } : { k: 'none' }; }
  if (st.done) return { k: 'none' };
  const now = search(g, fromStitch(g, st), new Set(), { n: 2_000_000 });
  if (now && now.length) return { k: 'next', to: now[0] };
  // replay the thread from the start and find the last point it could still be finished from
  const path = st.moves.map((m) => m.to), dead = new Set<string>();
  let good = -1;
  const s = fresh(g, st.first);
  const at: number[] = [st.first];
  for (let i = 0; i <= path.length; i++) {
    if (i > 0) { const m = moves(g, s).find(([, to]) => to === path[i - 1]); if (!m) break; apply(g, s, m[0], m[1]); at.push(s.at); }
    if (search(g, { at: s.at, count: [...s.count], visits: [...s.visits], done: s.done }, dead, { n: 400_000 })) good = i;
  }
  if (good < 0) { const sol = solve(p); return sol ? { k: 'back', steps: path.length + 1, at: sol.start } : { k: 'none' }; }
  return { k: 'back', steps: path.length - good, at: at[good] };
}

// ---------------------------------------------------------------- generated skies
export type GenOpts = { stars: number; rules: Rule[]; name: string; id: string; night?: number };
const NAMES_A = ['Little', 'Old', 'Silver', 'Sleepy', 'Wandering', 'Hidden', 'Northern', 'Quiet', 'Lost', 'Dancing', 'Lantern', 'Frosty', 'Far', 'Bright', 'Gentle', 'Velvet'];
const NAMES_B = ['Thimble', 'Kettle', 'Sparrow', 'Bramble', 'Ladder', 'Mitten', 'Pinecone', 'Feather', 'Button', 'Wheelbarrow', 'Teacup', 'Mouse', 'Moth', 'Clover', 'Pebble', 'Comb', 'Bucket', 'Harp', 'Spindle', 'Hedgehog'];
/** A name for a generated constellation. */
export function skyName(seed: number) { const r = rng(seed ^ 0x9e37); return `The ${NAMES_A[Math.floor(r() * NAMES_A.length)]} ${NAMES_B[Math.floor(r() * NAMES_B.length)]}`; }
const segPt = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
  return { d: Math.hypot(ax + vx * t - px, ay + vy * t - py), t };
};
const cross = (a: number[], b: number[], c: number[], d: number[]) => {
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
/** Builds one sky from a seed: solvable by construction. */
export function generate(seed: number, o: GenOpts): Puzzle {
  let best: Puzzle | null = null, bestScore = -Infinity;
  for (let attempt = 0; attempt < 40; attempt++) {
    const p = build(hashSeed(`${seed}:${attempt}`), o);
    if (!p) continue;
    // aim for a sky that a careless thread fails often but not always
    const f = randomFail(p, 120, seed);
    const want = Math.min(0.85, 0.35 + o.stars * 0.03), sc = -Math.abs(f - want) + p.seams.length * 0.002;
    if (sc > bestScore) { best = p; bestScore = sc; }
    if (Math.abs(f - want) < 0.08 && attempt >= 2) break;
  }
  if (!best) best = build(seed, { ...o, stars: 5, rules: [] })!;
  return best;
}
function build(seed: number, o: GenOpts): Puzzle | null {
  const r = rng(seed), N = Math.max(4, Math.min(22, o.stars)), W = 100, H = 80;
  const minD = Math.sqrt((W * H) / N) * 0.62;
  const pts: number[][] = [];
  for (let tries = 0; pts.length < N && tries < 4000; tries++) {
    const x = 6 + r() * (W - 12), y = 6 + r() * (H - 12);
    if (pts.every((q) => Math.hypot(q[0] - x, q[1] - y) >= minD)) pts.push([x, y]);
  }
  if (pts.length < 4) return null;
  // candidate seams: short, never crossing, never brushing past another star
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < minD * 2.3) pairs.push([i, j, d]); }
  pairs.sort((a, b) => a[2] - b[2]);
  const cand: [number, number][] = [];
  for (const [i, j] of pairs) {
    if (cand.some(([a, b]) => a !== i && a !== j && b !== i && b !== j && cross(pts[a], pts[b], pts[i], pts[j]))) continue;
    if (pts.some((q, k) => k !== i && k !== j && segPt(q[0], q[1], pts[i][0], pts[i][1], pts[j][0], pts[j][1]).d < 4.5)) continue;
    cand.push([i, j]);
  }
  const rules = new Set(o.rules), target = Math.round(N * 1.45) + (rules.has('double') ? 1 : 0);
  // walk a thread; its path becomes the seams
  const used = new Map<number, { need: number; dir: [number, number] }>(), visits = new Array(pts.length).fill(0);
  let at = Math.floor(r() * pts.length); const first = at; visits[at] = 1;
  const path = [at];
  for (let step = 0; step < target * 3 && [...used.values()].reduce((a, u) => a + u.need, 0) < target; step++) {
    const open = cand.map((c, i) => [c, i] as const).filter(([c, i]) => (c[0] === at || c[1] === at) && !used.has(i));
    if (!open.length) break;
    // prefer stars not yet visited, so the thread spreads over the field
    const w = open.map(([c, i]) => { const to = c[0] === at ? c[1] : c[0]; const onward = cand.some((d, j) => j !== i && !used.has(j) && (d[0] === to || d[1] === to)); return (visits[to] ? 1 : 3.2) * (onward ? 1 : 0.12); });
    let x = r() * w.reduce((a, b) => a + b, 0), k = 0; while (x > w[k] && k < w.length - 1) { x -= w[k]; k++; }
    const [c, ci] = open[k], to = c[0] === at ? c[1] : c[0];
    const dbl = rules.has('double') && r() < 0.12;
    used.set(ci, { need: dbl ? 2 : 1, dir: [at, to] });
    visits[to]++; path.push(to);
    if (dbl) { visits[at]++; path.push(at); } else at = to;
  }
  const keep = [...new Set(path)];
  if (keep.length < Math.max(4, N * 0.75) || used.size < Math.max(3, keep.length - 1)) return null;
  const idx = new Map(keep.map((k, i) => [k, i]));
  // fit the field to 100 × 80
  const xs = keep.map((k) => pts[k][0]), ys = keep.map((k) => pts[k][1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), sc = Math.min(88 / Math.max(1, x1 - x0), 70 / Math.max(1, y1 - y0));
  const stars: Star[] = keep.map((k, i) => ({ x: +(6 + (pts[k][0] - x0) * sc + (88 - (x1 - x0) * sc) / 2).toFixed(1), y: +(5 + (pts[k][1] - y0) * sc + (70 - (y1 - y0) * sc) / 2).toFixed(1), bright: 0, knot: false, twin: -1, moon: '', name: 's' + i }));
  const seams: Seam[] = [];
  for (const [ci, u] of used) { const c = cand[ci]; seams.push({ a: idx.get(u.dir[0])!, b: idx.get(u.dir[1])!, need: u.need, oneway: false, cloud: false }); void c; }
  // the rules, all true to the walked thread
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  if (rules.has('oneway')) { const singles = seams.filter((s) => s.need === 1); for (let n = Math.max(1, Math.round(singles.length * 0.3)); n > 0 && singles.length; n--) { const s = singles.splice(Math.floor(r() * singles.length), 1)[0]; s.oneway = true; } }
  const v = keep.map((k) => visits[k]);
  if (rules.has('bright')) { const many = v.map((n, i) => (n >= 2 ? i : -1)).filter((i) => i >= 0); for (let n = 0; n < 2 && many.length; n++) { const i = many.splice(Math.floor(r() * many.length), 1)[0]; stars[i].bright = Math.min(3, v[i]); if (v[i] > 3) stars[i].bright = 0; } }
  if (rules.has('knot')) { const once = v.map((n, i) => (n === 1 && !stars[i].bright ? i : -1)).filter((i) => i >= 0); for (let n = 0; n < 2 && once.length; n++) stars[once.splice(Math.floor(r() * once.length), 1)[0]].knot = true; }
  if (rules.has('moon')) { stars[idx.get(first)!].moon = 'start'; const e = idx.get(path[path.length - 1])!; if (e !== idx.get(first)) stars[e].moon = 'end'; }
  const clouds: Cloud[] = [];
  if (rules.has('cloud') && seams.length > 5) {
    const s = pick(seams), mx = (stars[s.a].x + stars[s.b].x) / 2, my = (stars[s.a].y + stars[s.b].y) / 2;
    clouds.push({ x: +mx.toFixed(1), y: +my.toFixed(1), r: 16 });
    for (const sm of seams) { const cx = (stars[sm.a].x + stars[sm.b].x) / 2, cy = (stars[sm.a].y + stars[sm.b].y) / 2; sm.cloud = Math.hypot(cx - mx, cy - my) < 16; }
  }
  const p = finish({ id: o.id, name: o.name, night: o.night ?? -1, index: 0, figure: null, story: ['', ''], stars, seams, clouds, teach: null, rules: [] });
  return solve(p) ? p : null;
}
/** The Daily Sky for a yyyy-mm-dd date: the same sky for everyone that day. */
export function dailySky(day: string): Puzzle {
  const seed = hashSeed('daily:' + day), r = rng(seed);
  const all: Rule[] = ['bright', 'knot', 'double', 'oneway', 'cloud', 'moon'];
  const rules = all.filter(() => r() < 0.45).slice(0, 3);
  return generate(seed, { stars: 9 + Math.floor(r() * 5), rules, name: skyName(seed), id: 'daily:' + day, night: -1 });
}
/** Shooting Star level n: the skies grow and gather rules as you go. */
export function shootSky(level: number): Puzzle {
  const seed = hashSeed('shoot:' + level), r = rng(seed);
  const order: Rule[] = ['bright', 'double', 'oneway', 'knot', 'cloud', 'moon'];
  const unlocked = order.slice(0, Math.min(order.length, Math.floor((level - 1) / 2)));
  const rules = unlocked.filter(() => r() < 0.55).slice(0, 1 + Math.floor(level / 6));
  return generate(seed, { stars: Math.min(18, 5 + Math.floor(level * 0.8)), rules, name: skyName(seed), id: 'shoot:' + level, night: -1 });
}

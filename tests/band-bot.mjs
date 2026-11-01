// Woodland Band bot. For every request:
// - the designed solution solves it with all three stars (solved, changes within par, the flourish);
// - a searching solver, starting from the request's own song and changing only what a player can (cells, pitches,
//   adding and taking off musicians from the request's cast, the tempo dial where it turns), finds a three-star
//   solution within par: simulated annealing on how close the song is, then pruning every change it can undo. The
//   fewest changes it finds is printed beside par, and par may be at most three more than that;
// - the starting song never solves it;
// - random grids (random musicians from the cast, random notes, the request's own tempo and key) never solve an
//   echo or a mood request, out of 3000 tries each (the fix and limit rates are printed too).
// With --quick, fewer restarts and random grids.
import assert from 'node:assert/strict';
import { MUSICIANS, ORDER, judge, changes, cloneSong, addRow, removeRow, check, solvedSong, starBits } from '../.checks/band-game.js';
import { REQUESTS, REQ_IDS } from '../.checks/band-levels.js';

const quick = process.argv.includes('--quick');
const only = process.argv.find((a) => /^\d-\d$/.test(a));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const full = (q, s) => { const j = judge(s, q); return j.solved && j.flourish; };
const maxRows = (q) => q.maxRows ?? 6;

/** A score to climb: every part's closeness, the flourish, and a small cost for each change. */
function value(q, s) {
  const j = judge(s, q), f = check(s, q.flourish.rule);
  return j.parts.reduce((a, p) => a + p.score, 0) / Math.max(1, j.parts.length) * 3 + (j.limitOk ? 0 : -2) + f.score * 0.6 + (j.solved ? 2 : 0) + (j.solved && f.ok ? 2 : 0) - 0.035 * changes(q.start, s);
}
function mutate(q, s, r) {
  const t = cloneSong(s), u = r();
  if (q.tempo && u < 0.08) { t.bpm = Math.max(q.tempo[0], Math.min(q.tempo[1], t.bpm + pick(r, [-12, -8, -4, 4, 8, 12, 20, -20]))); return t; }
  if (u < 0.14) {
    const out = q.cast.filter((m) => !t.rows.some((x) => x.m === m));
    if (out.length && t.rows.length < maxRows(q) && r() < 0.6) addRow(t, pick(r, out), maxRows(q)); else if (t.rows.length) removeRow(t, pick(r, t.rows).m);
    return t;
  }
  if (!t.rows.length) return t;
  const row = pick(r, t.rows), i = Math.floor(r() * t.steps), M = MUSICIANS[row.m], v = r();
  // the way a player listens: try every pitch in this cell (and off), keep the one that sounds closest
  if (u < 0.55) {
    let bv = -1e9, bp = row.n[i];
    for (let p = -1; p < M.span; p++) { row.n[i] = p; const x = value(q, t) + r() * 0.01; if (x > bv) { bv = x; bp = p; } }
    row.n[i] = bp; return t;
  }
  // back to how it started, off, on at a random pitch, or one step up or down
  const st = q.start.rows.find((x) => x.m === row.m)?.n[i] ?? -1;
  row.n[i] = v < 0.25 ? st : v < 0.5 ? -1 : v < 0.8 ? Math.floor(r() * M.span) : Math.max(0, Math.min(M.span - 1, (row.n[i] < 0 ? M.def : row.n[i]) + (r() < 0.5 ? -1 : 1)));
  return t;
}
/** Undoes any single change (a cell back to how it started, a musician back on or off) that leaves three stars. */
function prune(q, s) {
  let cur = cloneSong(s), again = true;
  while (again) {
    again = false;
    for (const m of ORDER) {
      const a = q.start.rows.find((x) => x.m === m), b = cur.rows.find((x) => x.m === m);
      const tries = [];
      if (b && !a) { const t = cloneSong(cur); removeRow(t, m); tries.push(t); }
      if (a && !b && cur.rows.length < maxRows(q)) { const t = cloneSong(cur); t.rows.push({ m, n: a.n.slice() }); t.rows.sort((x, y) => ORDER.indexOf(x.m) - ORDER.indexOf(y.m)); tries.push(t); }
      if (a && b) for (let i = 0; i < cur.steps; i++) if (a.n[i] !== b.n[i]) { const t = cloneSong(cur); t.rows.find((x) => x.m === m).n[i] = a.n[i]; tries.push(t); }
      if (b && a === undefined) for (let i = 0; i < cur.steps; i++) if (b.n[i] >= 0) { const t = cloneSong(cur); t.rows.find((x) => x.m === m).n[i] = -1; tries.push(t); }
      for (const t of tries) if (full(q, t) && changes(q.start, t) < changes(q.start, cur)) { cur = t; again = true; break; }
      if (again) break;
    }
  }
  return cur;
}
/** Every single-cell edit of a song (any musician, any step, any pitch or off). */
function* edits(q, s) {
  for (const row of s.rows) for (let i = 0; i < s.steps; i++) for (let p = -1; p < MUSICIANS[row.m].span; p++) if (row.n[i] !== p) {
    const t = cloneSong(s); t.rows.find((x) => x.m === row.m).n[i] = p; yield t;
  }
}
/** Swaps: undo one change, then mend with one other edit, whenever that leaves three stars with fewer changes. */
function shrink(q, s) {
  let cur = prune(q, s), c = changes(q.start, cur), again = true;
  while (again) {
    again = false;
    for (const row of cur.rows) {
      const a = q.start.rows.find((x) => x.m === row.m); if (!a) continue;
      for (let i = 0; i < cur.steps && !again; i++) if (a.n[i] !== row.n[i]) {
        const t = cloneSong(cur); t.rows.find((x) => x.m === row.m).n[i] = a.n[i];
        for (const u of edits(q, t)) if (full(q, u) && changes(q.start, u) < c) { cur = prune(q, u); c = changes(q.start, cur); again = true; break; }
      }
      if (again) break;
    }
  }
  return cur;
}
/** Every change from the start, as a way to undo it. */
function diffs(q, s) {
  const out = [];
  for (const row of s.rows) { const a = q.start.rows.find((x) => x.m === row.m); if (a) for (let i = 0; i < s.steps; i++) if (a.n[i] !== row.n[i]) out.push([row.m, i, a.n[i]]); }
  return out;
}
/** Undo two changes, then mend with one edit: a deeper pass, once, on the best solution found. */
function shrink2(q, s) {
  let cur = s, c = changes(q.start, cur), again = true;
  while (again) {
    again = false;
    const d = diffs(q, cur);
    outer: for (let x = 0; x < d.length; x++) for (let y = x + 1; y < d.length; y++) {
      const t = cloneSong(cur); for (const [m, i, v] of [d[x], d[y]]) t.rows.find((r) => r.m === m).n[i] = v;
      if (full(q, t)) { cur = shrink(q, t); c = changes(q.start, cur); again = true; break outer; }
      for (const u of edits(q, t)) if (full(q, u) && changes(q.start, u) < c) { cur = shrink(q, u); c = changes(q.start, cur); again = true; break outer; }
    }
  }
  return cur;
}
function solve(q, seed, restarts, iters) {
  let best = null;
  for (let k = 0; k < restarts; k++) {
    const r = rng(seed * 977 + k * 131 + 7);
    let cur = cloneSong(q.start), cv = value(q, cur), mine = null;
    for (let it = 0; it < iters; it++) {
      const temp = 0.25 * (1 - it / iters) + 0.005;
      const nx = mutate(q, cur, r), nv = value(q, nx);
      if (nv >= cv || r() < Math.exp((nv - cv) / temp)) { cur = nx; cv = nv; }
      if (full(q, cur) && (!mine || changes(q.start, cur) < mine.c + 3)) {
        const p = prune(q, cur), c = changes(q.start, p);
        if (!mine || c < mine.c) mine = { s: p, c };
      }
    }
    if (mine) { const s = shrink(q, mine.s); mine = { s, c: changes(q.start, s) }; }
    if (mine && (!best || mine.c < best.c)) best = mine;
    if (best && best.c <= 1) return best;
  }
  if (best) { const t = shrink2(q, best.s); best = { s: t, c: changes(q.start, t) }; }
  return best;
}
function randomSong(q, r) {
  const s = cloneSong(q.start); s.rows = [];
  const n = 1 + Math.floor(r() * Math.min(maxRows(q), q.cast.length));
  const cast = q.cast.slice(); for (let i = cast.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cast[i], cast[j]] = [cast[j], cast[i]]; }
  for (const m of cast.slice(0, n)) { const d = 0.1 + r() * 0.8; s.rows.push({ m, n: Array.from({ length: s.steps }, () => (r() < d ? Math.floor(r() * MUSICIANS[m].span) : -1)) }); }
  s.rows.sort((a, b) => ORDER.indexOf(a.m) - ORDER.indexOf(b.m));
  return s;
}

const ids = only ? [only] : REQ_IDS;
const RANDOM = quick ? 400 : 3000;
let fails = 0;
console.log('req   kind   par  solver  random-solves');
for (const id of ids) {
  const q = REQUESTS[id];
  const sol = solvedSong(q), j = judge(sol, q), ch = changes(q.start, sol);
  assert.ok(j.solved, `${id}: the designed solution solves it`);
  assert.ok(j.flourish, `${id}: the designed solution earns the flourish`);
  assert.ok(ch <= q.par, `${id}: the designed solution is within par (${ch} > ${q.par})`);
  assert.equal(starBits(true, ch, q.par, j.flourish), 7, `${id}: three stars for the designed solution`);
  assert.ok(!judge(q.start, q).solved, `${id}: the starting song does not already solve it`);
  assert.ok(q.start.rows.length <= maxRows(q) + 2 && q.start.rows.every((r) => r.n.length === q.start.steps), `${id}: rows fit the bar`);
  for (const r of sol.rows) assert.ok(q.cast.includes(r.m) && r.n.length === q.start.steps && r.n.every((v) => v < MUSICIANS[r.m].span), `${id}: the solution uses the cast within range`);
  const found = solve(q, Number(id.replace('-', '')), quick ? 8 : 24, quick ? 6000 : 12000);
  if (process.env.SHOW && found) console.log(found.s.rows.map((r) => r.m + ':' + r.n.map((v) => (v < 0 ? '.' : v.toString(36))).join('')).join('  '), found.s.bpm);
  if (!found || found.c > q.par || q.par - found.c > 3) { fails++; console.log(`  ✗ ${id}: solver ${found ? found.c : 'none'} vs par ${q.par}`); }
  const r = rng(4242 + Number(id.replace('-', ''))); let hits = 0;
  for (let k = 0; k < RANDOM; k++) if (judge(randomSong(q, r), q).solved) hits++;
  if ((q.kind === 'echo' || q.kind === 'mood') && hits) { fails++; console.log(`  ✗ ${id}: random grids solved a ${q.kind} request ${hits} times`); }
  console.log(`${id}  ${q.kind.padEnd(5)}  ${String(q.par).padStart(3)}  ${String(found?.c ?? '-').padStart(6)}  ${hits}/${RANDOM}`);
}
assert.equal(fails, 0, `${fails} request(s) failed`);
console.log(`band bot: ${ids.length} requests solved within par; random grids never solve an echo or mood request`);

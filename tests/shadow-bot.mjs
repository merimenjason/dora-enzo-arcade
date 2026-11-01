// Shadowplay bot. A searching puppeteer casts every scene from its starting layout seeing only what a player sees:
// the target silhouette (its raster). It slides each lantern to its best spot, then, puppet by puppet, tries every
// depth, rotation, flip, turn and (where puppets may come down) on or off, over a coarse grid of positions, and
// refines the best few to the eighth of a unit, keeping whatever casts the target best. It counts its moves the way
// the game does (picking up a different puppet or lantern is a move), and must match every scene within the scene's
// move budget (par + MOVE_SLACK); the fewest moves it needs are recorded in tests/shadow-solutions.json with its
// layout, and par (the authored count of puppets and lanterns that must change) must be no more than that and never
// beaten by the search. A random puppeteer throws every movable puppet and lantern anywhere it may go, 300 times a
// scene: where two or more things must be set it never casts one, and where only one puppet or lantern moves it lands
// on the spot at most one time in ten. With --quick the recorded layouts are replayed instead of searching (and no
// random throws); `--write` searches and rewrites the solutions file (with a scene id, only that scene's record).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  SHAPES, SCENES, SCENE_IDS, snapPose, startStage, solutionStage, targetKeys, rasterStates, keysOf, fitStage, shadowPolys, lampHome, lampAt,
  GW, GH, RES, KS, ROT_STEPS, TURN_STEPS, MOVE_SLACK, canDo, gelBit, polyBox, SCREEN_W, SCREEN_H, samePose,
} from '../.checks/shadow-game.js';

const quick = process.argv.includes('--quick'), write = process.argv.includes('--write');
const only = process.argv.find((a) => /^s\d-\d$/.test(a));
const file = new URL('./shadow-solutions.json', import.meta.url);
const stored = (() => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; } })();

const xs = new Float64Array(256);
/** Fills a polygon into a window of a lantern's states (the window starts at cell c0, row j0, w wide). */
function fillRect(buf, w, c0, j0, h, poly, gel) {
  const [, by0, , by1] = polyBox(poly);
  const ja = Math.max(j0, Math.ceil(by0 * RES - 0.5)), jb = Math.min(j0 + h - 1, Math.floor(by1 * RES - 0.5));
  const n = poly.length;
  for (let j = ja; j <= jb; j++) {
    const y = (j + 0.5) / RES; let m = 0;
    for (let i = 0, q = n - 1; i < n; q = i++) {
      const ay = poly[q][1], by = poly[i][1];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs[m++] = poly[q][0] + ((y - ay) * (poly[i][0] - poly[q][0])) / (by - ay);
    }
    if (m < 2) continue;
    const row = xs.subarray(0, m); row.sort();
    for (let a = 0; a + 1 < m; a += 2) {
      const ca = Math.max(c0, Math.ceil(row[a] * RES - 0.5)), cb = Math.min(c0 + w, Math.ceil(row[a + 1] * RES - 0.5));
      const base = (j - j0) * w - c0;
      if (!gel) for (let c = ca; c < cb; c++) buf[base + c] = 1;
      else for (let c = ca; c < cb; c++) { const v = buf[base + c]; if (v !== 1) buf[base + c] = 2 + ((v ? v - 2 : 0) | gel); }
    }
  }
}
/** A fast scorer for one puppet's poses with everything else held still: the overlap, updated only where it falls. */
function scorer(st, i, T) {
  const sh = SHAPES[st.props[i].shape], gel = sh.gel ? gelBit(sh.gel) : 0, home = lampHome(st);
  const lamps = st.lamps.map((L, li) => lampAt(L, st.offs[li] ?? 0));
  const base = rasterStates(st, false, i), bk = keysOf(base);
  let I0 = 0, U0 = 0;
  for (let c = 0; c < bk.length; c++) { const p = bk[c], q = T[c]; if (p || q) { U0++; if (p === q) I0++; } }
  return (pose) => {
    if (!pose.on) return U0 ? I0 / U0 : 1;
    const polys = lamps.map((L) => shadowPolys(sh, pose, home, L));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ps of polys) for (const p of ps) { const b = polyBox(p); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const c0 = Math.max(0, Math.floor(x0 * RES)), c1 = Math.min(GW - 1, Math.ceil(x1 * RES)), j0 = Math.max(0, Math.floor(y0 * RES)), j1 = Math.min(GH - 1, Math.ceil(y1 * RES));
    if (c1 < c0 || j1 < j0) return U0 ? I0 / U0 : 1;
    const w = c1 - c0 + 1, h = j1 - j0 + 1, bufs = base.map((b) => { const o = new Uint8Array(w * h); for (let j = 0; j < h; j++) o.set(b.subarray((j0 + j) * GW + c0, (j0 + j) * GW + c0 + w), j * w); return o; });
    polys.forEach((ps, li) => { for (const p of ps) fillRect(bufs[li], w, c0, j0, h, p, gel); });
    let dI = 0, dU = 0;
    for (let j = 0; j < h; j++) for (let c = 0; c < w; c++) {
      const g = (j0 + j) * GW + c0 + c, t = T[g], o = bk[g];
      let k = 0; for (let li = bufs.length - 1; li >= 0; li--) k = k * 34 + bufs[li][j * w + c];
      if (k === o) continue;
      dU += (k || t ? 1 : 0) - (o || t ? 1 : 0); dI += (k === t && t ? 1 : 0) - (o === t && t ? 1 : 0);
    }
    const U = U0 + dU; return U ? (I0 + dI) / U : 1;
  };
}
/** The best pose for one puppet with the others held still. */
function bestPose(S, st, i, T) {
  const P = S.props[i], sh = SHAPES[P.shape], cur = st.props[i].pose, f = scorer(st, i, T);
  const can = (t) => canDo(S, i, t);
  const ds = can('depth') ? KS.map((_, d) => d) : [cur.d];
  const ts = can('turn') ? Array.from({ length: TURN_STEPS + 1 }, (_, t) => t) : [cur.t];
  // the overlap guides the search; among the best candidates one that casts the scene wins, as a player sees the meter
  // fill (casting also asks that every part of the picture shows, so a hook the wrong way up loses to the right one)
  const cands = [cur];
  const consider = (p) => { cands.push(p); };
  if (can('take')) consider({ ...cur, on: !cur.on });
  if (!cur.on && !can('take')) return { s: 0, pose: cur };
  // the best coarse position for each way of holding the puppet, then the dozen best of those refined
  const coarse = [], patch = new Map();
  for (const d of ds) for (const t of ts) {
    const roundNow = sh.round && t === 0;
    const rs = can('rot') && !roundNow ? Array.from({ length: ROT_STEPS }, (_, r) => r) : [cur.r];
    const fs = can('flip') && !roundNow ? [0, 1] : [cur.f];
    for (const r of rs) for (const fl of fs) {
      if (!can('move')) { consider({ ...cur, d, t, r, f: fl, on: true }); continue; }
      let top = null;
      for (let x = P.rail === 'y' ? cur.x : 0; x <= (P.rail === 'y' ? cur.x : SCREEN_W * 8); x += P.rail === 'y' ? 1 : 4) {
        for (let y = P.rail === 'x' ? cur.y : 0; y <= (P.rail === 'x' ? cur.y : SCREEN_H * 8); y += P.rail === 'x' ? 1 : 4) {
          const p = { x, y, d, r, f: fl, t, on: true }, s = f(p);
          if (!top || s > top[0]) top = [s, p];
          // the best in each two-unit patch of the screen too, so a small spot is not lost behind a bigger one
          const k = `${x >> 4},${y >> 4}`, b = patch.get(k);
          if (!b || s > b[0]) patch.set(k, [s, p]);
        }
      }
      if (top) coarse.push(top);
    }
  }
  coarse.sort((a, b) => b[0] - a[0]);
  const spots = [...patch.values()].sort((a, b) => b[0] - a[0]).slice(0, 8);
  for (const [, p0] of [...coarse.slice(0, 12), ...spots]) {
    let p = p0, s = f(p);
    for (let round = 0; round < 4; round++) {
      let improved = false;
      for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
        if ((P.rail === 'y' && dx) || (P.rail === 'x' && dy)) continue;
        const q = { ...p, x: Math.max(0, Math.min(SCREEN_W * 8, p.x + dx)), y: Math.max(0, Math.min(SCREEN_H * 8, p.y + dy)) }, sq = f(q);
        if (sq > s + 1e-9) { s = sq; p = q; improved = true; }
      }
      if (!improved) break;
    }
    // let go: the game clicks a puppet into its place when it is dropped close by and held the right way
    consider(snapPose(S, i, p) ?? p);
  }
  const meter = (p) => { const fs = fitStage(S, { ...st, props: st.props.map((q, j) => (j === i ? { ...q, pose: p } : q)) }); return (fs.matched ? 10 : 0) + fs.iou; };
  let best = { s: meter(cur), pose: cur };
  for (const p of cands) { const m = meter(p); if (m > best.s + 1e-9) best = { s: m, pose: p }; }
  return best;
}
/** Casts a scene from its start; returns the moves (pick-ups of a different puppet or lantern) and the layout. */
function solve(S, order) {
  const st = startStage(S), T = targetKeys(S), touched = [];
  const touch = (k) => { if (touched[touched.length - 1] !== k) touched.push(k); };
  for (let pass = 0; pass < 4 && !fitStage(S, st).matched; pass++) {
    S.lamps.forEach((L, li) => {
      if (!L.move || !S.tools.includes('lamp')) return;
      let bo = st.offs[li], bs = fitStage(S, st).iou;
      for (let o = L.move[0]; o <= L.move[1]; o++) { const offs = st.offs.slice(); offs[li] = o; const s = fitStage(S, { ...st, offs }).iou; if (s > bs + 1e-9) { bs = s; bo = o; } }
      if (bo !== st.offs[li]) { st.offs = st.offs.slice(); st.offs[li] = bo; touch('l' + li); }
    });
    for (const i of order) {
      if (fitStage(S, st).matched) break;
      const b = bestPose(S, st, i, T);
      if (!samePose(b.pose, st.props[i].pose)) { st.props[i] = { ...st.props[i], pose: b.pose }; touch('p' + i); }
    }
  }
  return { matched: fitStage(S, st).matched, moves: touched.length, st, fit: fitStage(S, st) };
}
/** The number of puppets and lanterns the authored solution changes. */
function authoredChanges(S) {
  const sol = solutionStage(S), start = startStage(S); let n = 0;
  S.props.forEach((P, i) => { if (!P.fixed && !P.extra && !samePose(sol.props[i].pose, start.props[i].pose)) n++; });
  S.lamps.forEach((L) => { if (L.move && (L.sol ?? 0) !== 0) n++; });
  return n;
}
let seed = 0x5eed;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (n) => Math.floor(rnd() * n);

// with one scene named, --write updates only its record and keeps the others
const out = only ? { ...stored } : {}, t0 = Date.now();
let scenes = 0, throws = 0, luckyAll = 0;
const failed = [];
for (const id of SCENE_IDS) {
  if (only && id !== only) continue;
  try {
    const S = SCENES[id], T = targetKeys(S);
    // the authored solution casts the scene exactly, and par counts what it changes
    const sf = fitStage(S, solutionStage(S));
    assert.ok(sf.matched && sf.iou === 1, `${id}: the authored solution casts the target exactly`);
    assert.equal(S.par, authoredChanges(S), `${id}: par is the number of puppets and lanterns the solution changes`);
    // search in several puppet orders and keep the fewest moves
    const movable = S.props.map((P, i) => i).filter((i) => !S.props[i].fixed && !S.props[i].extra);
    const areaOf = (i) => { const st = solutionStage(S); return rasterStates({ ...st, props: [st.props[i].pose.on ? st.props[i] : startStage(S).props[i]] }).reduce((n, a) => n + a.reduce((m, v) => m + (v ? 1 : 0), 0), 0); };
    void T;
    const areas = new Map(movable.map((i) => [i, areaOf(i)]));
    const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, k) => perms([...a.slice(0, k), ...a.slice(k + 1)]).map((r) => [x, ...r])));
    // with three puppets or fewer, every order; otherwise biggest first, smallest first and the authored order
    const orders = movable.length <= 3 ? perms(movable) : [movable.slice().sort((a, b) => areas.get(b) - areas.get(a)), movable.slice().sort((a, b) => areas.get(a) - areas.get(b)), movable];
    let best = null;
    if (quick && stored[id] && !write) {
      // --quick replays the recorded layout instead of searching again: it must still cast the scene in the same moves
      const L = stored[id].layout, st = startStage(S);
      st.props = st.props.map((p, i) => ({ ...p, pose: L.props[i] }));
      st.offs = L.offs.slice();
      let moves = 0;
      S.props.forEach((P, i) => { if (!samePose(st.props[i].pose, startStage(S).props[i].pose)) moves++; });
      S.lamps.forEach((Lp, li) => { if ((st.offs[li] ?? 0) !== 0) moves++; });
      const fit = fitStage(S, st);
      assert.ok(fit.matched, `${id}: the recorded layout still casts the scene`);
      // the search may pick a puppet up twice, so the recorded count can be more than the puppets the layout changes
      assert.ok(moves <= stored[id].moves, `${id}: the recorded layout changes no more than the recorded moves`);
      best = { matched: true, moves: stored[id].moves, st, fit };
    }
    for (const o of best ? [] : orders) { const r = solve(S, o); if (r.matched && (!best || r.moves < best.moves)) best = r; if (best && best.moves <= S.par) break; }
    assert.ok(best, `${id}: the searching puppeteer casts the scene`);
    assert.ok(best.moves <= S.par + MOVE_SLACK, `${id}: within the move budget (${best.moves} moves, par ${S.par})`);
    assert.ok(best.moves >= S.par, `${id}: the search never beats par (${best.moves} < ${S.par}): par is the fewest; it changed ${JSON.stringify(best.st.props.map((p, i) => samePose(p.pose, startStage(S).props[i].pose) ? null : [p.shape, p.pose]).filter(Boolean))} offs ${best.st.offs}`);
    out[id] = { par: S.par, moves: best.moves, iou: Math.round(best.fit.iou * 1000) / 1000, layout: { props: best.st.props.map((p) => p.pose), offs: best.st.offs } };
    if (stored[id] && !write) assert.equal(stored[id].moves, best.moves, `${id}: the bot’s move count matches tests/shadow-solutions.json`);
    // the random puppeteer
    let lucky = 0;
    if (!quick) {
      for (let n = 0; n < 300; n++) {
        const st = startStage(S);
        st.offs = S.lamps.map((L) => (L.move && S.tools.includes('lamp') ? L.move[0] + ri(L.move[1] - L.move[0] + 1) : 0));
        st.props = st.props.map((p, i) => {
          if (!movable.includes(i)) return p;
          const c = (t) => canDo(S, i, t), q = { ...p.pose };
          if (c('move')) { if (S.props[i].rail !== 'y') q.x = ri(SCREEN_W * 8 + 1); if (S.props[i].rail !== 'x') q.y = ri(SCREEN_H * 8 + 1); }
          if (c('depth')) q.d = ri(KS.length); if (c('rot')) q.r = ri(ROT_STEPS); if (c('flip')) q.f = ri(2); if (c('turn')) q.t = ri(TURN_STEPS + 1); if (c('take')) q.on = rnd() < 0.7;
          return { ...p, pose: q };
        });
        if (fitStage(S, st).matched) lucky++;
        throws++;
      }
    }
    // with two or more things to set, a throw never casts the scene; with only one puppet or lantern to set, a throw
    // that lands on the spot can (a lantern has only a few dozen spots), but no more than one throw in ten
    const things = movable.length + S.lamps.filter((L) => L.move && S.tools.includes('lamp')).length;
    if (!quick) assert.ok(things > 1 ? lucky === 0 : lucky <= 30, `${id}: random throws cast it ${lucky} times in 300`);
    luckyAll += lucky;
    scenes++;
    console.log(`  ${id} ${S.name.padEnd(28)} par ${S.par} · bot ${best.moves} moves (overlap ${(best.fit.iou * 100).toFixed(0)}%, worst part ${(best.fit.cover * 100).toFixed(0)}%)`);
  } catch (err) { failed.push(`${id}: ${err.message}`); console.log(`  ${id} FAILED: ${err.message}`); }
}
if (write) writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
assert.deepEqual(failed, [], 'every scene passes');
console.log(`shadow bot: ${scenes} scene${scenes === 1 ? '' : 's'} ${quick ? 'replayed from the recorded layouts' : 'cast by search'} within the move budget${quick ? '' : `, ${throws} random throws cast ${luckyAll}`} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

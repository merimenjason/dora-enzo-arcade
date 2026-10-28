// An autopilot that sails Driftwood Post's whole story through the real engine. It plans on a coarse navigation grid
// (A* over cells clear of every coast, rock and shoal, with reeds made costly), pulls the path tight with line-of-sight
// checks, and sails it with a tacking controller: straight at the next waypoint when the wind allows, otherwise
// close-hauled on one tack until it strays out of a lane around the route (or sees a rock ahead), then across.
// At each jetty it hands over its post, buys upgrades at the boatyard, picks up what fits (story first), and sets off
// for the nearest useful island. It proves the lake is sound: every story letter can be carried to the ending.
// `node tests/driftwood-bot.mjs` plays the full story for three weather seeds; `--quick` plays the first six
// deliveries, which `npm test` runs.
import assert from 'node:assert/strict';
import {
  DriftwoodGame, ISLAND, STORY, VILLAGES, HZ, DAY_TICKS, MIN_PER_TICK, DOCK_REACH, UP_IDS, clearance, inReeds, wrap, idleInput, polar,
} from '../.checks/driftwood-game.js';

// ---------------------------------------------------------------- the navigation grid
export const CELL = 40;
const GW = Math.ceil(4000 / CELL), GH = Math.ceil(3000 / CELL);
/** Clearance needed for a cell to be sailable, and for a straight line between waypoints. */
const SAFE = 30, LINE_SAFE = 24;
let NAV = null;
export function nav() {
  if (NAV) return NAV;
  const clear = new Float32Array(GW * GH), cost = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL, c = clearance(x, y), i = gy * GW + gx;
    clear[i] = c;
    cost[i] = c < SAFE ? Infinity : 1 + (c < 70 ? (70 - c) / 40 : 0) + (inReeds(x, y) ? 4 : 0);
  }
  NAV = { clear, cost };
  return NAV;
}
const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
/** The nearest sailable cell to a point (the boat can sit in a cell that's a little too tight). */
function openCell(x, y) {
  const { cost } = nav(); const [cx, cy] = cellOf(x, y);
  for (let r = 0; r < 6; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const gx = cx + dx, gy = cy + dy; if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || cost[gy * GW + gx] === Infinity) continue;
      const d = Math.hypot((gx + 0.5) * CELL - x, (gy + 0.5) * CELL - y); if (d < bd) { bd = d; best = [gx, gy]; }
    }
    if (best) return best;
  }
  return [cx, cy];
}

/** A* from a point to a point; returns waypoints in lake units (the last one is the exact goal), or null. */
export function plan(x0, y0, x1, y1) {
  const { cost } = nav(), [sx, sy] = openCell(x0, y0), [tx, ty] = openCell(x1, y1);
  const N = GW * GH, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const start = sy * GW + sx, goal = ty * GW + tx;
  const h = (i) => { const dx = Math.abs((i % GW) - tx), dy = Math.abs(Math.floor(i / GW) - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  // a small binary heap of [f, i]
  const heap = []; const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  g[start] = 0; push(h(start), start);
  while (heap.length) {
    const [, i] = pop(); if (closed[i]) continue; closed[i] = 1; if (i === goal) break;
    const ix = i % GW, iy = Math.floor(i / GW);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = ix + dx, ny = iy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx; if (closed[j] || cost[j] === Infinity) continue;
      if (dx && dy && (cost[iy * GW + nx] === Infinity || cost[ny * GW + ix] === Infinity)) continue;
      const step = (dx && dy ? 1.414 : 1) * (cost[i] + cost[j]) / 2, ng = g[i] + step;
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + h(j), j); }
    }
  }
  if (!closed[goal]) return null;
  const cells = []; for (let i = goal; i !== -1; i = from[i]) cells.push(i); cells.reverse();
  const pts = cells.map((i) => [((i % GW) + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL]);
  pts.push([x1, y1]);
  return pts;
}
/** Clearance looked up from a fine 10-unit grid (bilinear), far cheaper than measuring every coast each time. */
const FINE = 10, FW = 4000 / FINE + 1, FH = 3000 / FINE + 1;
let FINE_GRID = null;
export function clearFast(x, y) {
  if (!FINE_GRID) { FINE_GRID = new Float32Array(FW * FH); for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) FINE_GRID[j * FW + i] = clearance(i * FINE, j * FINE); }
  const fx = Math.max(0, Math.min(FW - 1.001, x / FINE)), fy = Math.max(0, Math.min(FH - 1.001, y / FINE)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, G = FINE_GRID;
  return (G[j * FW + i] * (1 - u) + G[j * FW + i + 1] * u) * (1 - v) + (G[(j + 1) * FW + i] * (1 - u) + G[(j + 1) * FW + i + 1] * u) * v;
}
/** Whether the straight line between two points keeps clear of everything. */
export function lineClear(x0, y0, x1, y1, need = LINE_SAFE) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 16));
  for (let k = 0; k <= n; k++) { const t = k / n; if (clearFast(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) < need) return false; }
  return true;
}

// ---------------------------------------------------------------- the helm
/** Steers the boat along a route to a point, tacking when the wind is in the way. One per destination. */
export class Helm {
  constructor(tx, ty, { dock = false } = {}) { this.tx = tx; this.ty = ty; this.dock = dock; this.path = null; this.wp = 0; this.side = 0; this.legStart = null; this.lastSwitch = -999; this.best = Infinity; this.bestAt = 0; this.escape = 0; this.replanAt = 0; }
  /** Fills `inp` for this tick. */
  drive(g, inp) {
    const b = g.boat, t = g.tick;
    if (!this.path || t >= this.replanAt) { this.path = plan(b.x, b.y, this.tx, this.ty) ?? [[this.tx, this.ty]]; this.wp = 0; this.replanAt = t + 6 * HZ; this.legStart = [b.x, b.y]; }
    // the farthest waypoint still in a clear straight line (looked for every third of a second)
    if (t % 10 === 0 || this.wp === 0) {
      let j = this.wp;
      for (let k = Math.min(this.path.length - 1, this.wp + 30); k > this.wp; k--) if (lineClear(b.x, b.y, this.path[k][0], this.path[k][1])) { j = k; break; }
      if (j !== this.wp) { this.wp = j; this.legStart = [b.x, b.y]; }
    }
    const [wx, wy] = this.path[this.wp], dist = Math.hypot(wx - b.x, wy - b.y), goalD = Math.hypot(this.tx - b.x, this.ty - b.y);
    if (dist < 50 && this.wp < this.path.length - 1) { this.wp++; this.legStart = [b.x, b.y]; }
    // stuck? (no progress toward the goal for eight seconds): sail off on a reach for two seconds and replan
    if (goalD < this.best - 25) { this.best = goalD; this.bestAt = t; }
    if (t - this.bestAt > 8 * HZ && this.escape <= 0) { this.escape = 2 * HZ; this.escapes = (this.escapes ?? 0) + 1; this.bestAt = t; this.best = goalD; this.side = -this.side || 1; }
    const from = g.wind.dir + Math.PI, lim = g.noGo + 11 * Math.PI / 180;
    let want = Math.atan2(wy - b.y, wx - b.x);
    if (this.escape > 0) {
      this.escape--;
      want = from + (this.side || 1) * Math.PI / 2;
      if (this.escape === 0) this.replanAt = t;
    } else {
      const rel = wrap(want - from);
      if (Math.abs(rel) < lim) {
        // upwind: hold a tack inside a lane around the line from where this leg began
        if (!this.side) this.side = rel >= 0 ? 1 : -1;
        const [sx, sy] = this.legStart, lx = wx - sx, ly = wy - sy, ll = Math.hypot(lx, ly) || 1;
        const xte = ((b.x - sx) * ly - (b.y - sy) * lx) / ll;
        const head = from + this.side * lim, drift = (Math.cos(head) * ly - Math.sin(head) * lx) / ll;
        const lane = Math.max(50, Math.min(170, ll * 0.3));
        let flip = Math.abs(xte) > lane && Math.sign(drift) === Math.sign(xte);
        if (!flip && this.blocked(b.x, b.y, head)) flip = true;
        // a tack is a commitment: finish turning onto the new heading before thinking about the next one
        if (flip && t - this.lastSwitch > 3 * HZ && Math.abs(wrap(from + this.side * lim - b.h)) < 0.3) { this.side = -this.side; this.lastSwitch = t; }
        want = from + this.side * lim;
      } else {
        this.side = rel >= 0 ? 1 : -1;
        // aim off a little against the drift so the track, not the bow, points at the waypoint
        const sp = Math.max(0.6, b.v), [cx, cy] = [b.vx - Math.cos(b.h) * b.v, b.vy - Math.sin(b.h) * b.v];
        const cross = (-Math.sin(want) * cx + Math.cos(want) * cy) / sp;
        want -= Math.max(-0.5, Math.min(0.5, cross));
        // but never into the no-go zone
        const r2 = wrap(want - from); if (Math.abs(r2) < lim) want = from + Math.sign(r2 || 1) * lim;
      }
    }
    const err = wrap(want - b.h);
    inp.steer = Math.max(-1, Math.min(1, err * 3));
    inp.trim = null; inp.anchor = false;
    inp.dock = this.dock && goalD < DOCK_REACH - 15;
    return goalD;
  }
  blocked(x, y, a) { for (const d of [40, 80, 130]) if (clearFast(x + Math.cos(a) * d, y + Math.sin(a) * d) < 18) return true; return false; }
}

// ---------------------------------------------------------------- the postie
const BUY = ['crates', 'sail', 'keel', 'crates', 'spyglass', 'sail', 'lantern', 'crates', 'hull'];
function shop(g) {
  for (const id of BUY) { if (g.canBuy(id) === 'ok') g.buy(id); else if (g.canBuy(id) !== 'max') break; }
}
const dockOf = (id) => ISLAND[id].dock;
/** Picks the next island: the nearest one with post for it, or with a story letter waiting (if the bag has room). */
function nextStop(g, side) {
  const here = g.boat, opts = new Map();
  const add = (id, w) => { const d = dockOf(id), k = Math.hypot(d.x - here.x, d.y - here.y) * w; if (!opts.has(id) || opts.get(id) > k) opts.set(id, k); };
  for (const it of g.bag) add(it.to, it.express ? 0.5 : it.story ? 0.8 : 1);
  if (g.bag.length < g.capacity) {
    for (const d of STORY) if (!g.done.has(d.n) && !g.bag.some((b) => b.story === d.n) && d.need.every((n) => g.done.has(n))) add(d.from, 0.9);
    if (side) for (const id of VILLAGES) if (g.side[id]) add(id, 1.6);
  }
  if (g.shopOpen && g.at !== 'boatyard' && BUY.some((id) => g.canBuy(id) !== 'max' && g.shells >= g.price(id) + 10)) add('boatyard', 1.3);
  if (g.regatta === 1) return 'lighthouse';
  let best = null, bd = Infinity; for (const [id, k] of opts) if (id !== g.at && k < bd) { bd = k; best = id; }
  return best;
}
/** At a jetty: hand over, shop, pick up (story first, then side post if wanted), and choose where next. */
function atDock(g, side) {
  g.deliverAll();
  if (g.at === 'boatyard') shop(g);
  for (const it of g.waiting(g.at)) if (it.story) g.pickUp(it.id);
  if (side) for (const it of g.waiting(g.at)) if (!it.story && g.bag.length < g.capacity - 1) g.pickUp(it.id);
}

/**
 * Plays the story through the engine. Returns the game and a summary. `until` stops after that many story deliveries;
 * `side` takes side post too; `limit` is the in-game day cap.
 */
export function playStory(seed, { until = STORY.length, side = true, limit = 5, log = false } = {}) {
  const g = new DriftwoodGame({ seed }), inp = idleInput();
  let helm = null, target = null, legs = 0, ticks = 0;
  const maxTicks = limit * DAY_TICKS;
  while (ticks < maxTicks) {
    if (g.phase === 'ending') break;
    if (g.phase === 'dock') {
      atDock(g, side);
      if (g.done.size >= until && until < STORY.length) break;
      target = nextStop(g, side);
      if (!target) { if (log) console.log('nowhere to go', g.at); break; }
      if (log && helm) console.log(`   leg took ${((g.tick - helm.t0) / HZ).toFixed(0)} s, ${helm.escapes ?? 0} escapes, ${Math.round(helm.len)} units`);
      if (log) console.log(`day ${g.day} ${Math.floor(g.clock / 60)}:${String(Math.floor(g.clock % 60)).padStart(2, '0')} at ${g.at} → ${target}; bag ${g.bag.map((i) => i.story || 's').join(',')}; shells ${g.shells}; done ${g.done.size}`);
      g.castOff(); legs++;
      const d = dockOf(target); helm = new Helm(d.x, d.y, { dock: true }); helm.t0 = g.tick; helm.len = Math.hypot(d.x - g.boat.x, d.y - g.boat.y);
      continue;
    }
    if (g.phase === 'sail') helm.drive(g, inp);
    g.step(inp); g.events.length = 0; ticks++;
  }
  return { g, ticks, legs, finished: g.phase === 'ending', minutes: ticks * MIN_PER_TICK };
}

const pad = (v, w) => String(v).padStart(w);
const hm = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
if (import.meta.url === `file://${process.argv[1]}`) {
  const quick = process.argv.includes('--quick');
  if (quick) {
    const t0 = Date.now(), { g, ticks } = playStory(1, { until: 6 });
    assert.ok(g.done.size >= 6, `the bot delivers the first six story letters (${g.done.size})`);
    assert.ok(ticks < 2 * DAY_TICKS, `within two in-game days (${(ticks / DAY_TICKS).toFixed(2)})`);
    console.log(`Passed: the bot delivers the first six story letters in ${hm(ticks * MIN_PER_TICK)} of game time (${(ticks / HZ / 60).toFixed(1)} real minutes), ${g.stats.bumps} bumps, ${g.stats.earned} shells earned (${((Date.now() - t0) / 1000).toFixed(1)} s to simulate).`);
  } else {
    console.log(' seed  story  game time  real min  legs  bumps  scuffs  patches  tacks  express  side  earned  found  ups');
    const runs = [];
    for (const seed of [1, 2, 3]) {
      const t0 = Date.now(), r = playStory(seed, { log: process.argv.includes('--log') }), g = r.g, s = g.stats;
      runs.push(r);
      console.log(`${pad(seed, 5)} ${pad(g.done.size + '/' + STORY.length, 6)} ${pad(hm(r.minutes), 10)} ${pad((r.ticks / HZ / 60).toFixed(1), 9)} ${pad(r.legs, 5)} ${pad(s.bumps, 6)} ${pad(s.scuffs, 7)} ${pad(s.patches, 8)} ${pad(s.tacks, 6)} ${pad(s.expressOnTime + '/' + s.express, 8)} ${pad(s.side, 5)} ${pad(s.earned, 7)} ${pad(g.shellsFound, 6)}  ${UP_IDS.map((u) => u[0] + g.ups[u]).join(' ')}  ${r.finished ? 'regatta!' : 'NOT FINISHED'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    }
    for (const [i, r] of runs.entries()) {
      assert.ok(r.finished, `seed ${i + 1} reaches the Lantern Regatta`);
      assert.ok(r.ticks < 4 * DAY_TICKS, `seed ${i + 1} finishes within four in-game days (${(r.ticks / DAY_TICKS).toFixed(2)})`);
    }
    console.log('Passed: the bot sails the whole story to the Lantern Regatta for three weather seeds.');
  }
}
export { polar };

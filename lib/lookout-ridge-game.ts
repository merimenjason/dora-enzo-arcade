// Lookout Ridge: the rules. Turn-based artillery on woven cloth ground, deterministic and DOM-free.
// Heroes ride their friends (Dora on Tupa the llama, Enzo on Mochi the capybara); predators are a culpeo fox with a
// log cannon and a black-chested buzzard-eagle that flies. The level is "the burrow": three chinchilla kits in a pocket
// in Dora's ledge. Hold out until nightfall (NIGHT rounds); lose if every kit bolts or both heroes are down.
// The Darning Needle (shot 3) stitches cloth back into holes and never fills the kits' chamber. Craters leave pom-pom
// thread ends; a hero shot that lands within TANGLE px of one pulls the row: it unravels, the cloth above drops a row,
// units on it slide and take tumble damage. The cloth over the burrow is knotted and never unravels.
//
// The ground is an alpha mask owned here. Every change to it is also appended to `ops` (cut, darn, shift) so the
// scene (lib/lookout-ridge-scene.ts) can replay it on its painted bitmap. Fringe stamps (frayed threads round crater
// rims) are data here too; `fringeVer` bumps when they change. All randomness comes from the seeded `rnd`.

export const W = 1536, H = 864;
export const G = 0.12;              // gravity, px per frame^2
export const WIND_K = 0.003;        // wind accel per wind point
export const CHARGE = 100 / 120;    // power per frame while Space is held (2 s to full)
export const VMAX = 15.5;           // launch speed at power 100 (the far ridge is about 75 power)
export const RH = 30, ROW0 = 430;   // the cloth is woven in rows RH tall, from ROW0 down; each row is one pullable thread
export const NIGHT = 7;             // hold out this many rounds and night falls: the kits are safe
export const PULL_DMG = 22;         // tumble damage when the row under you unravels
export const KIT_FOCUS = 0.85;      // how often a predator goes for the burrow instead of a hero
export const KIT_REACH = 18;        // a blast this far past its radius still scares a kit (if no cloth is in the way)
export const PRED_ERR = 1.1;        // predators aim a little worse than a careful player
export const CHAMBER: [number, number, number][] = [[-44, 0, 31], [-15, -4, 33], [15, -4, 33], [44, 0, 31]];   // the pocket the kits live in (darning never fills it)
export const ORDER = ['dora', 'fox', 'enzo', 'eagle'] as const;
export const WIN_BANNERS = ['Night falls: the kits are safe!', 'The ridge is safe!'];

export type UnitId = (typeof ORDER)[number];
export interface Shot { name: string; dmg?: number; r?: number; art: string; size: number; count?: number; darn?: number; speed?: number; grav?: number; windK?: number }
interface Def { name: string; side: 'hero' | 'pred'; hp: number; idle: string; fire: string; h: number; walk?: number; climb?: number; armour?: number; flying?: boolean; blurb?: string; shots: Shot[] }
export interface Unit extends Def {
  id: UnitId; x: number; y: number; vy: number; maxHp: number; alive: boolean; face: number; angle: number; shot: number; moved: number;
  firing: number; lastPower: number | null; missStreak: number; hurtT: number; walk: number; climb: number;
  slide?: { dir: number; left: number } | null; fallFrom?: number | null; home?: { x: number; y: number } | null;
}
export interface Kit { i: number; x: number; y: number; home: boolean; t: number }
export interface End { row: number; dir: number; ex: number; ax: number; x1?: number; len?: number }
export interface Pull { e: End; by: Unit; y: number; top: number; dir: number; start: number; front: number; hit: Set<Unit>; t: number; done: boolean }
export interface Stamp { x: number; y: number; ax: number; ay: number; hx: number; hy: number; rot: number; sx: number; sc: number }
export interface Shell { x: number; y: number; vx: number; vy: number; s: Shot; owner: Unit; t: number; rot: number; done?: boolean }
export interface Puff { x: number; y: number; r: number; t: number }
export interface Float { x: number; y: number; txt: string; t: number; big?: boolean }
export type Pt = [number, number, number, number];   // x, y, angle, radius
export type TerrainOp = { k: 'cut'; pts: Pt[] } | { k: 'darn'; pts: Pt[]; cx: number; cy: number; r: number; bx: number; by: number } | { k: 'shift'; x0: number; n: number; top: number };
export interface Input { left?: boolean; right?: boolean; up?: boolean; down?: boolean }
export type State = 'title' | 'aim' | 'flight' | 'settle' | 'over';
type Bot = { kind: string; a?: number; p?: number; shot?: number; tx?: number; ty?: number; t: number; tgt?: Unit | null; kits?: number; onKits?: boolean; done?: boolean };
type Sim = { pts: [number, number][]; x: number; y: number; end: 'gone' | 'snag' | 'unit' | 'ground' | 'air'; thread?: End; unit?: Unit };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function surfaceY(x: number) {
  // left high ledge (Dora), lower step (Enzo), gorge, right ridge (fox)
  const k = [[0, 470], [330, 470], [380, 560], [560, 600], [640, 690], [760, 735], [900, 745],
    [1040, 700], [1150, 600], [1220, 520], [1536, 505]];
  let y = 500;
  for (let i = 0; i < k.length - 1; i++) {
    if (x >= k[i][0] && x <= k[i + 1][0]) {
      const t = (x - k[i][0]) / (k[i + 1][0] - k[i][0]);
      const s = t * t * (3 - 2 * t);
      y = lerp(k[i][1], k[i + 1][1], s);
    }
  }
  return y + Math.sin(x * 0.021) * 5 + Math.sin(x * 0.057 + 1.3) * 3;
}
/** the grass tuft band: strips GRASS_STEP wide laid along the surface, GRASS_H tall, 40% of it above the line */
export const GRASS_STEP = 5, GRASS_H = 36;

// stitches cloth back; flies through animals. It is thrown slower and slips through the wind, so its full
// guide arc never tells you where a pebble or pot would land, and short mends near you are easy.
export const NEEDLE: Shot = { name: 'Darning Needle', darn: 44, art: 'needle', size: 30, speed: 0.8, grav: 1.1, windK: 0.3 };
export const DEFS: Record<UnitId, Def> = {
  dora: { name: 'Dora & Tupa', side: 'hero', hp: 120, idle: 'dora-idle', fire: 'dora-fire', h: 150, walk: 230, climb: 14,
    blurb: 'Tupa is sure-footed: walks far and climbs steep slopes.',
    shots: [{ name: 'Pebble', dmg: 34, r: 30, art: 'pebble', size: 18 },
      { name: 'Pebble Trio', dmg: 16, r: 24, art: 'pebble', size: 14, count: 3 }, NEEDLE] },
  enzo: { name: 'Enzo & Mochi', side: 'hero', hp: 140, idle: 'enzo-idle', fire: 'enzo-fire', h: 132, walk: 140, climb: 6, armour: 0.8,
    blurb: 'Mochi is sturdy: takes a fifth less damage from blasts.',
    shots: [{ name: 'Clay Pot', dmg: 26, r: 54, art: 'pot', size: 24 },
      { name: 'Heavy Pot', dmg: 40, r: 34, art: 'pot', size: 22, grav: 1.35 }, NEEDLE] },
  fox: { name: 'Culpeo Fox', side: 'pred', hp: 150, idle: 'fox-idle', fire: 'fox-fire', h: 120, walk: 120, climb: 6,
    shots: [{ name: 'Log Shot', dmg: 30, r: 40, art: 'logball', size: 20 }] },
  eagle: { name: 'Buzzard-Eagle', side: 'pred', hp: 100, idle: 'eagle-a', fire: 'eagle-b', h: 120, flying: true,
    shots: [{ name: 'Stone Drop', dmg: 28, r: 30, art: 'stone', size: 22 }] },
};

/** fills a polygon in the mask with `v`, sampling pixel centres (the canvas's antialiased edge, thresholded, lands there too) */
function fillPoly(mask: Uint8Array, pts: ArrayLike<number>[], v: number) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(H - 1, Math.ceil(y1));
  const xs: number[] = [];
  for (let y = ya; y <= yb; y++) {
    const sy = y + 0.5; xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > sy) !== (b[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      for (let x = xa; x <= xb; x++) mask[y * W + x] = v;
    }
  }
}

export function createGame(initialSeed = 7) {
  // ---------- seeded rng ----------
  let seed = initialSeed >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.41;

  // ---------- terrain ----------
  const alpha = new Uint8Array(W * H);
  let stamps: Stamp[] = [];
  let ops: TerrainOp[] = [];
  let gen = 0, fringeVer = 0;
  const BURROW = { x: 280, y: 552 };
  let ends: End[] = [], pulls: Pull[] = [], kits: Kit[] = [];
  let floats: Float[] = [], puffs: Puff[] = [], shells: Shell[] = [];
  let units: Unit[] = [];
  const LOG: unknown[][] = [];

  function solid(x: number, y: number) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return alpha[y * W + x] > 110;
  }
  function buildTerrain() {
    alpha.fill(0);
    // the cloth below the line
    const poly: number[][] = [[0, H]];
    for (let x = 0; x <= W; x += 4) poly.push([x, surfaceY(x)]);
    poly.push([W, H]);
    fillPoly(alpha, poly, 255);
    // the grass band along the line (opaque strips, drawn unclipped, so they stand a little proud of it)
    const st = GRASS_STEP, gh = GRASS_H;
    for (let x = -st; x < W + st; x += st) {
      const sy = surfaceY(x), sy2 = surfaceY(x + st);
      const ang = Math.atan2(sy2 - sy, st), len = Math.hypot(st, sy2 - sy), c = Math.cos(ang), s = Math.sin(ang);
      const q = [[0, -gh * 0.4], [len + 1.2, -gh * 0.4], [len + 1.2, gh * 0.6], [0, gh * 0.6]].map(([lx, ly]) => [x + lx * c - ly * s, sy + lx * s + ly * c]);
      fillPoly(alpha, q, 255);
    }
    stamps = []; ends = []; pulls = []; ops = []; gen++; fringeVer++;
    digBurrow();
  }
  function cutShape(pts: Pt[]) { fillPoly(alpha, pts, 0); ops.push({ k: 'cut', pts }); }
  function digBurrow() {
    // a pocket in Dora's ledge with a short tunnel out to the slope; the kits sit on its floor
    BURROW.y = 552;
    for (const [dx, dy, r] of [...CHAMBER, [80, 8, 22], [104, 14, 21]]) cutShape(craterShape(BURROW.x + dx, BURROW.y + dy, r));
    kits = [0, 1, 2].map((i) => ({ i, x: BURROW.x - 38 + i * 38, y: BURROW.y + 30, home: true, t: 0 }));
  }
  const rowMid = (k: number) => ROW0 + k * RH + RH / 2;
  const rowOf = (y: number) => Math.floor((y - ROW0) / RH);
  // the cloth over the kits' pocket is knotted: rows above the burrow floor never unravel there
  const knotted = (x: number, top: number) => Math.abs(x - (BURROW.x + 20)) < 110 && top < BURROW.y + 32;
  function spanEnd(e: End) {   // the row runs from its loose end until the next gap, a knot, or 520px
    let x = e.ax; const y = rowMid(e.row), top = ROW0 + e.row * RH;
    while (x >= 0 && x < W && Math.abs(x - e.ax) < 520 && solid(x, y) && !knotted(x, top)) x += e.dir;
    return x;
  }
  const pomOf = (e: End) => ({ x: e.ex - e.dir * 18, y: rowMid(e.row) + 18 });
  function addEnd(cx: number, cy: number, r: number) {
    // a blast leaves one loose thread end: the cut row with the longest run of cloth beside the hole
    let best: End | null = null;
    for (let k = Math.max(0, rowOf(cy - r)); k <= rowOf(cy + r); k++) {
      const y = rowMid(k);
      if (Math.abs(y - cy) > r * 0.75) continue;
      for (const dir of [-1, 1]) {
        let x = cx; while (Math.abs(x - cx) < r * 1.4 && !solid(x, y)) x += dir;
        if (!solid(x, y)) continue;
        const e: End = { row: k, dir, ex: x, ax: x + dir * 3 };
        const p = pomOf(e);
        if (solid(p.x, p.y) || solid(p.x, p.y - 12)) continue;
        const len = Math.abs(spanEnd(e) - e.ax);
        if (len >= 110 && (!best || len > best.len!)) best = { ...e, len };
      }
    }
    const b = best;
    if (!b || ends.some((e) => e.row === b.row && e.dir === b.dir && Math.abs(e.ex - b.ex) < 30)) return;
    ends.push(b); if (ends.length > 5) ends.shift();
    validateEnds();
  }
  function validateEnds() {
    ends = ends.filter((e) => { const y = rowMid(e.row), p = pomOf(e); return solid(e.ax, y) && !solid(e.ex - e.dir * 2, y) && !solid(p.x, p.y); });
    for (const e of ends) e.x1 = spanEnd(e);
  }
  // aim assist for the player: a hero's shot that lands this close to a pom-pom tangles in it and pulls the thread
  // (predator shots must hit the pom itself, or their misses would unravel the kits' roof)
  let TANGLE = 40;
  const tangle = (x: number, y: number) => ends.find((e) => { const p = pomOf(e); return Math.hypot(x - p.x, y - p.y) < TANGLE; });
  function startPull(e: End, by: Unit) {
    ends = ends.filter((x) => x !== e);
    pulls.push({ e, by, y: rowMid(e.row), top: ROW0 + e.row * RH, dir: e.dir, start: e.ex, front: e.ex, hit: new Set(), t: 0, done: false });
    floats.push({ x: e.ex, y: rowMid(e.row) - 30, txt: 'unravelling!', t: 0, big: true });
    LOG.push(['pull', by.id, e.row]);
  }
  function stepPull(p: Pull) {
    // unravel up to 14 columns a frame; everything woven above the row drops one row
    p.t++;
    if (p.done) return p.t > 30;
    const xa = p.front; let n = 0;
    while (n < 14) {
      const x = p.front + p.dir * n;
      if (x < 0 || x >= W || Math.abs(x - p.start) > 520 || !solid(x, p.y) || knotted(x, p.top)) { p.done = true; p.t = 0; break; }
      n++;
    }
    if (n) {
      const x0 = p.dir > 0 ? xa : xa - n + 1;
      for (let x = x0; x < x0 + n; x++) {
        for (let y = p.top + RH - 1; y >= RH; y--) alpha[y * W + x] = alpha[(y - RH) * W + x];
        for (let y = 0; y < RH; y++) alpha[y * W + x] = 0;
      }
      ops.push({ k: 'shift', x0, n, top: p.top });
      stamps = stamps.filter((st) => !(st.x >= x0 && st.x < x0 + n && st.y >= p.top && st.y < p.top + RH));
      for (const st of stamps) if (st.x >= x0 && st.x < x0 + n && st.y < p.top) { st.y += RH; st.ay += RH; st.hy += RH; }
      for (const u of units) if (u.alive && !u.flying && u.x + 12 >= x0 && u.x - 12 < x0 + n && u.y <= p.top + RH + 2) p.hit.add(u);
      if (BURROW.x >= x0 && BURROW.x < x0 + n && BURROW.y < p.top) { BURROW.y += RH; for (const k of kits) if (k.home) k.y += RH; }
      p.front += p.dir * n;
      fringeVer++;
    }
    if (p.done) {
      for (const u of p.hit) {
        if (!u.alive) continue;
        u.slide = { dir: -p.dir, left: Math.min(Math.abs(u.x - p.start) + 30, 220) };   // the rug is pulled from under them
        const dm = Math.round(PULL_DMG * (u.armour || 1));
        u.hp -= dm; u.hurtT = 30; LOG.push([p.by.id, u.id, dm, 'pull']);
        floats.push({ x: u.x, y: u.y - u.h - 30, txt: 'tumble -' + dm, t: 0, big: true });
        if (u.hp <= 0) kill(u, 'hp');
      }
      validateEnds();
    }
    return false;
  }
  function shielded(x0: number, y0: number, x1: number, y1: number) {
    // how much cloth lies between a blast and a kit: 12px of weave stops the blast
    const d = Math.hypot(x1 - x0, y1 - y0); let c = 0;
    for (let t = 6; t < d; t += 2) if (solid(x0 + (x1 - x0) * t / d, y0 + (y1 - y0) * t / d)) c += 2;
    return c >= 12;
  }
  function darnAt(cx: number, cy: number, r: number) {
    let touch = 0;
    for (let y = cy - r; y <= cy + r; y += 4) for (let x = cx - r; x <= cx + r; x += 4) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r && solid(x, y)) touch++;
    if (touch < 6) { floats.push({ x: cx, y: cy - 30, txt: 'nothing to stitch to', t: 0 }); return; }
    const pts = craterShape(cx, cy, r);
    fillPoly(alpha, pts, 255);
    // the kits' pocket stays open
    for (const [dx, dy, cr] of CHAMBER) {
      const ox = BURROW.x + dx, oy = BURROW.y + dy, rr = cr - 3;
      for (let y = Math.max(0, Math.floor(oy - rr)); y <= Math.min(H - 1, Math.ceil(oy + rr)); y++)
        for (let x = Math.max(0, Math.floor(ox - rr)); x <= Math.min(W - 1, Math.ceil(ox + rr)); x++)
          if ((x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2 < rr * rr) alpha[y * W + x] = 0;
    }
    ops.push({ k: 'darn', pts, cx, cy, r, bx: BURROW.x, by: BURROW.y });
    stamps = stamps.filter((st) => !solid(st.hx, st.hy));
    for (const u of units) if (u.alive && !u.flying) { let k = 0; while (k < 140 && footSolid(u, u.y - 1)) { u.y--; k++; } }
    validateEnds(); fringeVer++;
    puffs.push({ x: cx, y: cy, r: r * 0.5, t: 10 });
  }
  function craterShape(cx: number, cy: number, r: number): Pt[] {
    const pts: Pt[] = [], n = Math.max(28, Math.round(r * 1.1));
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const rr = r * (1 + 0.08 * Math.sin(3 * a + p1) + 0.05 * Math.sin(7 * a + p2) + (rnd() - 0.5) * 0.06);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, a, rr]);
    }
    return pts;
  }
  function carve(cx: number, cy: number, r: number) {
    const pts = craterShape(cx, cy, r);
    cutShape(pts);
    // drop stamps whose cloth is gone, add new ones around this rim
    stamps = stamps.filter((s) => solid(s.ax, s.ay));
    const step = 15;
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      acc += Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (acc < step) continue;
      acc = 0;
      const a = p[2], ox = Math.cos(a), oy = Math.sin(a);
      const ax = p[0] + ox * 4, ay = p[1] + oy * 4;
      if (!solid(ax, ay)) continue;
      const floor = oy > 0.35;             // lower rim: short tufts; upper rim: long hanging threads
      stamps.push({ x: p[0] + ox * 2, y: p[1] + oy * 2, ax, ay, hx: p[0] - ox * 6, hy: p[1] - oy * 6, rot: a + Math.PI / 2,
        sx: rnd() * 0.9, sc: floor ? 0.09 + rnd() * 0.04 : 0.16 + rnd() * 0.08 });
    }
    validateEnds();
    fringeVer++;
  }

  // ---------- units ----------
  function makeUnits() {
    units = [mk('dora', 190, true), mk('fox', 1340, false), mk('enzo', 470, true), mk('eagle', 1180, false)];
    units[3].y = 190;
  }
  function mk(id: UnitId, x: number, faceRight: boolean): Unit {
    const d = DEFS[id];
    return { id, ...d, walk: d.walk ?? 0, climb: d.climb ?? 0, x, y: d.flying ? 200 : surfaceY(x), vy: 0, hp: d.hp, maxHp: d.hp, alive: true,
      face: faceRight ? 1 : -1, angle: 45, shot: 0, moved: 0, firing: 0, lastPower: null, missStreak: 0, hurtT: 0 };
  }
  const centre = (u: Unit) => ({ x: u.x, y: u.flying ? u.y : u.y - u.h * 0.45 });
  const hitR = (u: Unit) => u.flying ? 62 : 38;   // wingspan: the eagle is a big target

  function footSolid(u: { x: number }, y: number) { for (let dx = -12; dx <= 12; dx += 6) if (solid(u.x + dx, y)) return true; return false; }
  function settleUnits() {
    let moving = false;
    for (const u of units) {
      if (!u.alive || u.flying) continue;
      if (u.slide) {
        const nx = u.x + u.slide.dir * 5;
        if (nx < 20 || nx > W - 20 || footSolid({ x: nx }, u.y - 24)) u.slide = null;
        else { u.x = nx; u.slide.left -= 5; if (u.slide.left <= 0) u.slide = null; moving = true; }
      }
      // pop up if buried a little
      let lift = 0; while (lift < 20 && footSolid(u, u.y - 1)) { u.y--; lift++; }
      if (!footSolid(u, u.y + 1)) {
        if (u.fallFrom == null) u.fallFrom = u.y;
        u.vy = Math.min(u.vy + G * 2, 9); u.y += u.vy; moving = true;
        if (u.y > H + 40) kill(u, 'fell');
      } else {
        u.vy = 0;
        if (u.fallFrom != null) {
          const h = u.y - u.fallFrom; u.fallFrom = null;
          if (h > 50) {   // a real fall hurts
            const dm = Math.round((h - 50) * 0.3);
            u.hp -= dm; u.hurtT = 30; LOG.push(['fall', u.id, dm]);
            floats.push({ x: u.x, y: u.y - u.h - 30, txt: 'bump -' + dm, t: 0 });
            if (u.hp <= 0) kill(u, 'hp');
          }
        }
      }
    }
    return moving;
  }
  function tryWalk(u: Unit, dir: number) {
    if (u.moved >= u.walk) return false;
    const nx = clamp(u.x + dir * 1.5, 20, W - 20);
    // find standing y at nx within climb range
    let ny: number | null = null;
    for (let yy = u.y - u.climb; yy <= u.y + 30; yy++) {
      if (footSolid({ x: nx }, yy + 1) && !footSolid({ x: nx }, yy)) { ny = yy; break; }
    }
    if (footSolid({ x: nx }, u.y - u.climb)) return false;   // wall
    u.x = nx; if (ny != null) u.y = ny;
    u.face = dir; u.moved += 1.5;
    return true;
  }

  // ---------- state ----------
  let turnIdx = 0, cur: Unit | null = null, wind = 0, state: State = 'title', power = 0, charging = false;
  let banner: string | null = null, bannerT = 0, bot: Bot | null = null, endT = 0, settleT = 0;
  let aimGuide = true, autoHero = false, smartHeroes = true, round = 0;

  function newGame(s?: number) {
    seed = (s ?? 7 + Math.floor(rnd() * 1e6)) >>> 0;
    LOG.length = 0;
    buildTerrain(); makeUnits(); shells = []; puffs = []; floats = [];
    turnIdx = -1; round = 0; nextTurn();
  }
  const rollWind = () => { wind = clamp(Math.round(gauss() * 3), -6, 6); };
  function nextTurn() {
    if (checkEnd()) return;
    for (let k = 0; k < 4; k++) {
      turnIdx = (turnIdx + 1) % ORDER.length;
      if (turnIdx === 0) round++;
      const u = units.find((v) => v.id === ORDER[turnIdx])!;
      if (u.alive) { cur = u; break; }
    }
    if (round > NIGHT) { state = 'over'; endT = 0; banner = WIN_BANNERS[0]; return; }
    const c = cur!;
    rollWind();
    c.moved = 0; power = 0; charging = false;
    state = 'aim';
    banner = c.side === 'hero' ? c.name + ': your turn' : c.name + ' is hunting';
    bannerT = 90;
    bot = (c.side === 'pred' || autoHero) ? planBot(c) : null;
  }
  function checkEnd() {
    const h = units.some((u) => u.side === 'hero' && u.alive), p = units.some((u) => u.side === 'pred' && u.alive);
    const k = kits.some((v) => v.home);
    if (h && p && k) return false;
    state = 'over'; endT = 0;
    banner = !k ? 'The kits bolted from the burrow' : (!p && h ? WIN_BANNERS[1] : (!h && p ? 'The predators win this one' : 'Everyone is down'));
    return true;
  }

  // ---------- shooting ----------
  function launch(u: Unit, pw: number) {
    const s = u.shots[u.shot];
    const count = s.count || 1;
    u.lastPower = pw; u.firing = 24;
    for (let i = 0; i < count; i++) {
      const p = pw * (1 + (i - (count - 1) / 2) * 0.05);
      if (u.flying) {
        shells.push({ x: u.x, y: u.y + 40, vx: 0, vy: 0, s, owner: u, t: 0, rot: 0 });
        u.home = { x: 1000 + rnd() * 340, y: 150 + rnd() * 80 };
      } else {
        const a = u.angle * Math.PI / 180, v = p / 100 * VMAX * (s.speed || 1);
        const o = muzzle(u);
        shells.push({ x: o.x, y: o.y, vx: Math.cos(a) * v * u.face, vy: -Math.sin(a) * v, s, owner: u, t: 0, rot: 0 });
      }
    }
    state = 'flight';
  }
  const muzzle = (u: Unit) => ({ x: u.x + u.face * 34, y: u.y - u.h * 0.78 });
  function stepShell(sh: Shell): string | null {
    sh.vx += wind * WIND_K * (sh.s.windK ?? 1); sh.vy += G * (sh.s.grav || 1);
    const n = 4;
    for (let i = 0; i < n; i++) {
      sh.x += sh.vx / n; sh.y += sh.vy / n; sh.t += 1 / n;
      if (!sh.s.darn) {
        for (const e of ends) { const p = pomOf(e); if (Math.hypot(sh.x - p.x, sh.y - p.y) < 24) { startPull(e, sh.owner); return 'snag'; } }
        for (const u of units) {
          if (!u.alive || (u === sh.owner && sh.t < 20)) continue;
          const c = centre(u);
          if (Math.hypot(sh.x - c.x, sh.y - c.y) < hitR(u) * (u.flying ? 1 : 0.8)) return blast(sh, true);   // shots burst beside a flier
        }
      }
      if (solid(sh.x, sh.y) && !sh.s.darn && sh.owner.side === 'hero') { const e = tangle(sh.x, sh.y); if (e) { startPull(e, sh.owner); return 'snag'; } }
      if (solid(sh.x, sh.y)) {
        if (sh.s.darn) { darnAt(sh.x, sh.y, sh.s.darn); LOG.push(['darn', sh.owner.id, Math.round(sh.x), Math.round(sh.y)]); return 'hit'; }
        return blast(sh, false);
      }
      if (sh.y > H + 30 || sh.x < -300 || sh.x > W + 300) return 'gone';
    }
    sh.rot += sh.vx * 0.04;
    return null;
  }
  function blast(sh: { x: number; y: number; s: Shot; owner: Unit }, direct: boolean) {
    const dmg = sh.s.dmg ?? 0, r = sh.s.r ?? 0;
    for (const k of kits) if (k.home) {
      const ky = k.y - 16;
      if (Math.hypot(sh.x - k.x, sh.y - ky) < r + KIT_REACH && !shielded(sh.x, sh.y, k.x, ky)) {
        k.home = false; k.t = 0; LOG.push(['kit', sh.owner.id, k.i]);
        floats.push({ x: k.x, y: k.y - 60, txt: 'a kit bolted!', t: 0, big: true });
      }
    }
    carve(sh.x, sh.y, r);
    addEnd(sh.x, sh.y, r);
    puffs.push({ x: sh.x, y: sh.y, r, t: 0 });
    for (const u of units) {
      if (!u.alive) continue;
      const c = centre(u);
      const d = Math.hypot(sh.x - c.x, sh.y - c.y);
      if (d > r + hitR(u)) continue;
      const t = clamp((d - hitR(u) * 0.5) / r, 0, 1);
      const dm = Math.round(dmg * lerp(1, 0.35, t) * (u.armour || 1));
      if (dm <= 0) continue;
      u.hp -= dm; u.hurtT = 30; LOG.push([sh.owner.id, u.id, dm]);
      floats.push({ x: c.x, y: c.y - 60, txt: '-' + dm, t: 0, big: direct && d < hitR(u) });
      if (u.hp <= 0) kill(u, 'hp');
    }
    return 'hit';
  }
  function kill(u: Unit, why: string) {
    if (!u.alive) return;
    u.alive = false; u.hp = 0; LOG.push(['KO', u.id, why]);
    floats.push({ x: u.x, y: (u.flying ? u.y : u.y - u.h) - 20, txt: why === 'fell' ? 'fell off!' : 'out!', t: 0, big: true });
  }

  // simulate a ground shot (for the guide and the bots)
  function simulate(u: Unit, angle: number, pw: number, maxSteps = 900, stopAt: number | null = null): Sim {
    const s = u.shots[u.shot], a = angle * Math.PI / 180, v = pw / 100 * VMAX * (s.speed || 1);
    const o = muzzle(u);
    let x = o.x, y = o.y, vx = Math.cos(a) * v * u.face, vy = -Math.sin(a) * v;
    const pts: [number, number][] = [];
    for (let i = 0; i < maxSteps; i++) {
      vx += wind * WIND_K * (s.windK ?? 1); vy += G * (s.grav || 1);
      x += vx; y += vy; pts.push([x, y]);
      if (stopAt && i >= stopAt) break;
      if (y > H + 30 || x < -300 || x > W + 300) return { pts, x, y, end: 'gone' };
      if (i > 5) {
        if (!s.darn) {
          for (const e of ends) { const p = pomOf(e); if (Math.hypot(x - p.x, y - p.y) < 24) return { pts, x, y, end: 'snag', thread: e }; }
          for (const t of units) if (t.alive && t !== u) { const c = centre(t); if (Math.hypot(x - c.x, y - c.y) < hitR(t) * (t.flying ? 1 : 0.8)) return { pts, x, y, end: 'unit', unit: t }; }
        }
        if (solid(x, y)) { const e = !s.darn && u.side === 'hero' && tangle(x, y); return e ? { pts, x, y, end: 'snag', thread: e } : { pts, x, y, end: 'ground' }; }
      }
    }
    return { pts, x, y, end: 'air' };
  }

  // ---------- bots: aim like a person, with error that shrinks as they adjust ----------
  function roofOver(k: Kit) { let c = 0; for (let y = k.y - 40; y > k.y - 150; y--) if (solid(k.x, y)) c++; return c; }
  function inSpan(e: End, u: Unit) { const lo = Math.min(e.ex, e.x1!), hi = Math.max(e.ex, e.x1!); return u.alive && !u.flying && u.x + 12 >= lo && u.x - 12 <= hi && u.y <= ROW0 + e.row * RH + RH + 2; }
  function search(u: Unit, shot: number, score: (r: Sim) => number) {
    const keep = u.shot; u.shot = shot; let best: { a: number; p: number; e: number; shot: number } | null = null;
    for (let a = 20; a <= 80; a += 2) for (let p = u.shots[shot].darn ? 10 : 30; p <= 100; p += 1) {
      const r = simulate(u, a, p);
      let e = score(r);
      const rad = u.shots[shot].r || 0;
      if (!u.shots[shot].darn && r.end !== 'snag') for (const al of units) if (al.alive && al.side === u.side) { const c = centre(al); if (Math.hypot(r.x - c.x, r.y - c.y) < rad + hitR(al) + 10) e += 400; }
      if (!u.shots[shot].darn && r.end !== 'snag' && u.side === 'hero') for (const k of kits) if (k.home && Math.hypot(r.x - k.x, r.y - k.y) < rad + 30) e += 400;
      e += Math.abs(a - 50) * 0.6;   // like a person, prefer a comfortable lob over a flat full-power shot
      if (!best || e < best.e) best = { a, p, e, shot };
    }
    u.shot = keep; return best!;
  }
  function planBot(u: Unit): Bot {
    const homeKits = kits.filter((k) => k.home);
    const k = (u.missStreak >= 1 ? 0.55 : 1) * (u.side === 'pred' ? PRED_ERR : 1);
    const jitter = (b: { a: number; p: number; shot: number }, kind: string, extra: Partial<Bot>): Bot => ({ kind, a: clamp(b.a + gauss() * 3 * k, 10, 85), p: clamp(b.p + gauss() * 4.5 * k, 20, 100), shot: b.shot, t: 0, ...extra });
    if (u.side === 'pred') {
      // predators mostly go for the kits; otherwise the nearest hero
      const heroes = units.filter((v) => v.side !== u.side && v.alive);
      const goKits = homeKits.length && (rnd() < KIT_FOCUS || !heroes.length);
      const kit = goKits ? homeKits[Math.floor(rnd() * homeKits.length)] : null;
      const tgt = kit ? null : heroes.reduce((a, b) => Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a);
      const tc = kit ? { x: kit.x, y: kit.y - 16 } : centre(tgt!);
      const extra = { tgt, kits: homeKits.length, onKits: !!kit };
      if (u.flying) {
        let bx = tc.x, best = 1e9;
        for (let x = 60; x < W - 60; x += 4) {
          let sx = x, sy = 230, vx = 0, vy = 0;
          while (sy < tc.y) { vx += wind * WIND_K; vy += G; sx += vx; sy += vy; }
          const e = Math.abs(sx - tc.x); if (e < best) { best = e; bx = x; }
        }
        const err = u.missStreak >= 1 ? 40 : 70;
        return { kind: 'fly', tx: clamp(bx + gauss() * err, 60, W - 60), ty: 170 + rnd() * 60, t: 0, ...extra };
      }
      u.face = tc.x < u.x ? -1 : 1;
      const b = search(u, 0, (r) => r.end === 'unit' && tgt && r.unit === tgt ? 0 : Math.hypot(r.x - tc.x, r.y - tc.y));
      return jitter(b, 'shoot', extra);
    }
    // hero bots (self-play): mend an open roof, pull a thread under a predator, else shoot the weaker predator
    const preds = units.filter((v) => v.side === 'pred' && v.alive);
    if (smartHeroes) {
      const open = homeKits.filter((kk) => roofOver(kk) < 20).sort((a, b) => roofOver(a) - roofOver(b))[0];
      if (open) {
        const tc = { x: open.x, y: BURROW.y - 52 };
        u.face = tc.x < u.x ? -1 : 1;
        const b = search(u, 2, (r) => r.end === 'ground' ? Math.hypot(r.x - tc.x, r.y - tc.y) : 900);
        if (b.e < 60) return jitter(b, 'darn', { tgt: null });
      }
      for (const e of ends) {
        const caught = preds.filter((p) => inSpan(e, p)), mine = units.filter((h) => h.side === 'hero' && inSpan(e, h));
        const kitsIn = homeKits.some((kk) => kk.x >= Math.min(e.ex, e.x1!) && kk.x <= Math.max(e.ex, e.x1!) && kk.y < ROW0 + e.row * RH);
        if (!caught.length || mine.length || kitsIn) continue;
        const p = pomOf(e); u.face = p.x < u.x ? -1 : 1;
        const b = search(u, 0, (r) => r.end === 'snag' && r.thread === e ? 0 : Math.hypot(r.x - p.x, r.y - p.y) + 200);
        if (b.e < 60) return jitter(b, 'pull', { tgt: caught[0] });
      }
    }
    const tgt = preds.reduce((a, b) => b.hp < a.hp ? b : a);
    const tc = centre(tgt);
    u.face = tc.x < u.x ? -1 : 1;
    const b = search(u, 0, (r) => r.end === 'unit' && r.unit === tgt ? 0 : Math.hypot(r.x - tc.x, r.y - tc.y));
    return jitter(b, 'shoot', { tgt });
  }
  function runBot(u: Unit) {
    const b = bot!; b.t++;
    if (b.t < 25) return;               // a short beat to "think"
    if (b.kind === 'fly') {
      const dx = b.tx! - u.x, dy = b.ty! - u.y;
      u.face = dx < 0 ? -1 : 1;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { u.x += clamp(dx, -8, 8); u.y += clamp(dy, -5, 5); return; }
      if (b.t > 40) { launch(u, 0); b.done = true; }
      return;
    }
    // sweep the angle, then charge the power
    if (b.shot != null) u.shot = b.shot;
    if (Math.abs(u.angle - b.a!) > 1.5) { u.angle += Math.sign(b.a! - u.angle) * 1.5; return; }
    u.angle = b.a!;
    if (!charging) { charging = true; power = 0; }
    power += CHARGE * 2.5;
    if (power >= b.p!) { charging = false; launch(u, b.p!); b.done = true; }
  }

  // ---------- player actions ----------
  const playerTurn = () => state === 'aim' && !!cur && cur.side === 'hero' && !autoHero;
  function pickShot(i: number) { if (playerTurn() && cur!.shots[i]) cur!.shot = i; }
  function cycleShot() { if (playerTurn()) cur!.shot = (cur!.shot + 1) % cur!.shots.length; }
  function chargeStart() { if (playerTurn() && !charging) { charging = true; power = 0; } }
  function chargeRelease() { if (charging && playerTurn()) { charging = false; launch(cur!, Math.max(power, 5)); } }
  /** after the end banner has shown for a moment, Space, Enter, R or a click starts again */
  const canRestart = () => state === 'title' || (state === 'over' && endT > 40);

  // ---------- update (one 60 Hz frame) ----------
  function update(input: Input = {}) {
    if (bannerT > 0) bannerT--;
    for (const u of units) { if (u.firing > 0) u.firing--; if (u.hurtT > 0) u.hurtT--; }
    if (pulls.length) pulls = pulls.filter((p) => !stepPull(p));
    for (const k of kits) if (!k.home) k.t++;
    if (state === 'aim' && cur) {
      if (cur.side === 'hero' && !autoHero) {
        if (!charging) {
          if (input.left) tryWalk(cur, -1);
          if (input.right) tryWalk(cur, 1);
          if (input.up) cur.angle = clamp(cur.angle + 0.5, 0, 90);
          if (input.down) cur.angle = clamp(cur.angle - 0.5, 0, 90);
        } else power = Math.min(100, power + CHARGE);
      } else runBot(cur);
      settleUnits();
      for (const u of units) if (!u.alive && u === cur) { nextTurn(); break; }
    } else if (state === 'flight') {
      for (const sh of shells) if (!sh.done) { const r = stepShell(sh); if (r) { sh.done = true; if (r === 'gone') floats.push({ x: clamp(sh.x, 40, W - 40), y: clamp(sh.y, 60, H - 60), txt: 'miss', t: 0 }); } }
      if (shells.every((s) => s.done)) { shells = []; state = 'settle'; settleT = 0; }
    } else if (state === 'settle') {
      settleT++;
      const moving = settleUnits();
      if (!moving && settleT > 30 && !pulls.some((p) => !p.done) && !units.some((u) => u.flying && u.alive && u.home)) {
        if (bot && (bot.kind === 'shoot' || bot.kind === 'fly') && cur) {
          const hit = bot.onKits ? kits.filter((k) => k.home).length < bot.kits! : (bot.tgt && bot.tgt.hurtT > 0);
          cur.missStreak = hit ? 0 : cur.missStreak + 1;
        }
        nextTurn();
      }
    } else if (state === 'over') { endT++; settleUnits(); }
    for (const p of puffs) p.t++; puffs = puffs.filter((p) => p.t < 40);
    for (const f of floats) f.t++; floats = floats.filter((f) => f.t < 70);
    for (const u of units) if (u.flying && !u.alive && u.y < H + 100) { u.vy = Math.min((u.vy || 0) + G * 2, 10); u.y += u.vy; }
    for (const u of units) if (u.flying && u.alive && u.home && !(u === cur && state === 'aim')) {
      const dx = u.home.x - u.x, dy = u.home.y - u.y;
      if (Math.abs(dx) + Math.abs(dy) < 4) u.home = null; else { u.x += clamp(dx * 0.05, -6, 6); u.y += clamp(dy * 0.05, -4, 4); u.face = dx < 0 ? -1 : 1; }
    }
    for (const u of units) if (u.flying && u.alive && !u.home && u.face > 0 && !(u === cur && state === 'aim')) u.face = -1;
  }

  // the title shows the ridge before any game starts
  buildTerrain(); makeUnits();

  return {
    // state
    get state() { return state; }, get units() { return units; }, get cur() { return cur; }, get wind() { return wind; },
    get banner() { return banner; }, get bannerT() { return bannerT; }, get endT() { return endT; }, get round() { return round; },
    get turnIdx() { return turnIdx; }, get power() { return power; }, get charging() { return charging; },
    get aimGuide() { return aimGuide; }, set aimGuide(v: boolean) { aimGuide = v; },
    get autoHero() { return autoHero; }, set autoHero(v: boolean) { autoHero = v; if (v && state === 'aim' && cur && cur.side === 'hero' && !bot) bot = planBot(cur); },
    get smartHeroes() { return smartHeroes; }, set smartHeroes(v: boolean) { smartHeroes = v; },
    get tangle() { return TANGLE; }, set tangle(v: number) { TANGLE = v; },
    get ends() { return ends; }, get pulls() { return pulls; }, get kits() { return kits; }, get shells() { return shells; },
    get puffs() { return puffs; }, get floats() { return floats; }, get stamps() { return stamps; },
    get ops() { return ops; }, get gen() { return gen; }, get fringeVer() { return fringeVer; }, get seed() { return seed; },
    BURROW, LOG, alpha,
    // actions
    newGame, update, pickShot, cycleShot, chargeStart, chargeRelease, canRestart,
    toggleGuide: () => { aimGuide = !aimGuide; },
    fast(n: number) { for (let i = 0; i < n && state !== 'over'; i++) update(); },
    // rules, for the scene, the tests and the bots
    solid, simulate, muzzle, centre, pomOf, rowMid, roofOver, surfaceY,
    setSeed: (s: number) => { seed = s >>> 0; },
    carve: (x: number, y: number, r: number) => carve(x, y, r),
    darnAt: (x: number, y: number, r: number) => darnAt(x, y, r),
    addEnd: (x: number, y: number, r: number) => addEnd(x, y, r),
    pull: (i: number, by?: Unit) => startPull(ends[i], by || units[0]),
    blastAt: (x: number, y: number, r: number, id: UnitId = 'fox') => blast({ x, y, s: { name: 'test', art: '', size: 0, dmg: 0, r }, owner: units.find((u) => u.id === id)! }, false),
  };
}
export type LookoutGame = ReturnType<typeof createGame>;
export const isWin = (banner: string | null) => !!banner && WIN_BANNERS.includes(banner);

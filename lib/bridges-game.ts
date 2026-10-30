// Twig & Twine: the rules and the physics. A bridge is a set of members (twig, plank, twine or bamboo) between
// points on a whole-unit grid; anchors on the banks hold still. Testing a bridge runs a fixed-step position-based
// simulation (XPBD with substeps): joints are point masses, members are distance constraints with a stiffness, twine
// only pulls, and a member snaps when the force in it passes its strength. The acorn cart (and on some levels the hay
// wagon) is two wheels on a rigid axle that roll on planks and on the roads, so their weight loads the deck. No DOM,
// no Math.random and no clock: the same bridge always does exactly the same thing.
import { LEVELS, LEVEL_IDS, REGIONS, SANDBOX, type LevelDef, type RegionId } from './bridges-levels.js';

export { LEVELS, LEVEL_IDS, REGIONS, SANDBOX };
export type { LevelDef, RegionId };

// ---------------------------------------------------------------- materials
export type Mat = 'twig' | 'plank' | 'twine' | 'bamboo';
export const MATS: Mat[] = ['twig', 'plank', 'twine', 'bamboo'];
export type MatDef = {
  name: string; key: string; blurb: string;
  /** acorns per unit of length */ cost: number;
  /** mass per unit of length */ mass: number;
  /** the longest member, in grid units */ max: number;
  /** axial stiffness (force per unit strain) */ ea: number;
  /** the pull it takes to snap it */ tens: number;
  /** the push it takes to snap a 2-unit member; longer ones buckle sooner */ comp: number;
  /** wind catches it */ area: number;
  rope: boolean; deck: boolean;
};
export const MAT: Record<Mat, MatDef> = {
  twig: { name: 'Twig', key: '1', blurb: 'Cheap and light. Pushes and pulls; snaps under a heavy load.', cost: 10, mass: 0.18, max: 3, ea: 9000, tens: 105, comp: 95, area: 0.5, rope: false, deck: false },
  plank: { name: 'Plank', key: '2', blurb: 'The road: the only thing the cart rolls on. Heavier, fairly strong.', cost: 18, mass: 0.45, max: 2.5, ea: 30000, tens: 110, comp: 130, area: 1, rope: false, deck: true },
  twine: { name: 'Twine', key: '3', blurb: 'Only pulls (it goes slack when pushed), but strong when pulled. Long and light.', cost: 5, mass: 0.04, max: 8, ea: 7000, tens: 170, comp: 0, area: 0.15, rope: true, deck: false },
  bamboo: { name: 'Bamboo', key: '4', blurb: 'Strong and stiff, long and light. It costs.', cost: 26, mass: 0.3, max: 4, ea: 22000, tens: 300, comp: 260, area: 0.6, rope: false, deck: false },
};
/** The push a member of this length can take before it buckles. */
export const compLimit = (m: Mat, len: number) => MAT[m].comp * Math.min(1, 2 / Math.max(0.5, len));
export const memberCost = (m: Mat, len: number) => Math.round(MAT[m].cost * len);

// ---------------------------------------------------------------- physics constants
export const G = 10;
export const FPS = 60;
export const DT = 1 / FPS;
export const SUB = 16;
/** The bridge settles under its own weight for this long before the cart sets off. */
export const SETTLE = 0.8;
export const TIME_LIMIT = 60;
/** Seconds without progress before a stuck cart gives up. */
export const STUCK = 4;
export const JOINT_MASS = 0.06;

export type VehicleKind = 'cart' | 'wagon';
export type VehicleDef = { mass: number; r: number; base: number; speed: number; grip: number; area: number; gap: number };
export const VEHICLE: Record<VehicleKind, VehicleDef> = {
  cart: { mass: 6, r: 0.42, base: 1.7, speed: 2.6, grip: 7, area: 0.8, gap: 0 },
  wagon: { mass: 11, r: 0.45, base: 2, speed: 2.6, grip: 7, area: 1.2, gap: 2.6 },
};

// ---------------------------------------------------------------- designs
export type Pt = [number, number];
export type Member = { ax: number; ay: number; bx: number; by: number; m: Mat };
/** A design as saved: [ax, ay, bx, by, material index]. */
export type MemberData = [number, number, number, number, number];
export const pkey = (x: number, y: number) => `${x},${y}`;
/** Members are keyed with their ends in a fixed order, so a→b and b→a are the same member. */
export const mkey = (ax: number, ay: number, bx: number, by: number) => (ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`);
export const lenOf = (m: Member) => Math.hypot(m.bx - m.ax, m.by - m.ay);
export const designCost = (ms: readonly Member[]) => ms.reduce((s, m) => s + memberCost(m.m, lenOf(m)), 0);
export const encode = (ms: readonly Member[]): MemberData[] => ms.map((m) => [m.ax, m.ay, m.bx, m.by, MATS.indexOf(m.m)]);
export function decode(d: unknown): Member[] {
  if (!Array.isArray(d)) return [];
  const out: Member[] = [];
  for (const r of d) {
    if (!Array.isArray(r) || r.length !== 5 || !r.every((v) => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 1000)) continue;
    const m = MATS[r[4]]; if (!m) continue;
    out.push({ ax: r[0], ay: r[1], bx: r[2], by: r[3], m });
  }
  return out;
}

// ---------------------------------------------------------------- geometry helpers
function pointInPoly(x: number, y: number, poly: readonly Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function segsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
export type Box = { x0: number; x1: number; y0: number; y1: number };
/** Does the segment touch the box? */
export function segHitsBox(ax: number, ay: number, bx: number, by: number, b: Box) {
  const inB = (x: number, y: number) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  if (inB(ax, ay) || inB(bx, by)) return true;
  const c: Pt[] = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; if (segsCross(ax, ay, bx, by, p[0], p[1], q[0], q[1])) return true; }
  return false;
}
/** Is the point inside (or on the edge of) solid ground? */
export function inGround(L: LevelDef, x: number, y: number) {
  for (const g of L.grounds) {
    if (pointInPoly(x, y, g.poly)) return true;
    for (let i = 0; i < g.poly.length; i++) { const a = g.poly[i], b = g.poly[(i + 1) % g.poly.length]; if (segDist(x, y, a[0], a[1], b[0], b[1]) < 0.05) return true; }
  }
  return false;
}
export const isAnchor = (L: LevelDef, x: number, y: number) => L.anchors.some(([ax, ay]) => ax === x && ay === y);
export const inBuild = (L: LevelDef, x: number, y: number) => x >= L.build.x0 && x <= L.build.x1 && y >= L.build.y0 && y <= L.build.y1;

// ---------------------------------------------------------------- the builder
export type PlaceCheck = { ok: true } | { ok: false; why: string };
export type Target = { x: number; y: number; check: PlaceCheck };

/** The design being built: placing and removing members, mirror building, undo and redo. */
export class Builder {
  readonly level: LevelDef;
  members: Member[];
  mirror = false;
  private past: Member[][] = [];
  private future: Member[][] = [];
  constructor(level: LevelDef, members: readonly Member[] = []) {
    this.level = level;
    this.members = [];
    // only keep members that are valid here (an old or edited save must never break the level)
    for (const m of members) if (this.check(m.ax, m.ay, m.bx, m.by, m.m, true).ok && !this.index(m.ax, m.ay, m.bx, m.by)) this.members.push({ ...m });
  }
  get cost() { return designCost(this.members); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  /** Every point a member can start from: the anchors and the ends of the members. */
  nodes(): Map<string, { x: number; y: number; anchor: boolean; n: number }> {
    const out = new Map<string, { x: number; y: number; anchor: boolean; n: number }>();
    for (const [x, y] of this.level.anchors) out.set(pkey(x, y), { x, y, anchor: true, n: 0 });
    for (const m of this.members) for (const [x, y] of [[m.ax, m.ay], [m.bx, m.by]] as Pt[]) {
      const k = pkey(x, y), n = out.get(k);
      if (n) n.n++; else out.set(k, { x, y, anchor: false, n: 1 });
    }
    return out;
  }
  hasNode(x: number, y: number) { return isAnchor(this.level, x, y) || this.members.some((m) => (m.ax === x && m.ay === y) || (m.bx === x && m.by === y)); }
  index(ax: number, ay: number, bx: number, by: number) { const k = mkey(ax, ay, bx, by); const i = this.members.findIndex((m) => mkey(m.ax, m.ay, m.bx, m.by) === k); return i >= 0 ? i + 1 : 0; }
  /** Can a member of this material go from a to b? (`loose` skips the "starts at a node" rule, for loading.) */
  check(ax: number, ay: number, bx: number, by: number, m: Mat, loose = false): PlaceCheck {
    const L = this.level;
    if (!L.mats.includes(m)) return { ok: false, why: `No ${MAT[m].name.toLowerCase()} here` };
    if (![ax, ay, bx, by].every(Number.isInteger)) return { ok: false, why: 'Off the grid' };
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.5) return { ok: false, why: 'Too short' };
    if (len > MAT[m].max + 1e-6) return { ok: false, why: `${MAT[m].name} is at most ${MAT[m].max} long` };
    if (!loose && !this.hasNode(ax, ay)) return { ok: false, why: 'Start from a joint or an anchor' };
    for (const [x, y] of [[ax, ay], [bx, by]] as Pt[]) {
      if (!inBuild(L, x, y)) return { ok: false, why: 'Out of reach' };
      if (!isAnchor(L, x, y) && inGround(L, x, y)) return { ok: false, why: 'Joints can’t go in the ground' };
    }
    if (L.boat && segHitsBox(ax, ay, bx, by, L.boat)) return { ok: false, why: 'Keep the boat’s way clear' };
    return { ok: true };
  }
  /** Where a drag from a toward the pointer would end: snapped to the grid and kept within the material's reach. */
  target(ax: number, ay: number, px: number, py: number, m: Mat): Target {
    const max = MAT[m].max;
    let dx = px - ax, dy = py - ay; const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    const tx = ax + dx, ty = ay + dy;
    let best: Pt | null = null, bd = Infinity;
    for (let x = Math.floor(tx) - 1; x <= Math.ceil(tx) + 1; x++) for (let y = Math.floor(ty) - 1; y <= Math.ceil(ty) + 1; y++) {
      if (x === ax && y === ay) continue;
      if (Math.hypot(x - ax, y - ay) > max + 1e-6) continue;
      const dd = Math.hypot(x - tx, y - ty);
      if (dd < bd - 1e-9) { bd = dd; best = [x, y]; }
    }
    if (!best) return { x: ax, y: ay, check: { ok: false, why: 'Too short' } };
    const [x, y] = best;
    const dup = this.index(ax, ay, x, y) > 0;
    return { x, y, check: dup ? { ok: false, why: 'Already built' } : this.check(ax, ay, x, y, m) };
  }
  mirrorX(x: number) { return 2 * this.level.mirror - x; }
  private push() { this.past.push(this.members.map((m) => ({ ...m }))); if (this.past.length > 300) this.past.shift(); this.future = []; }
  /** Places a member (and, with mirror on, its twin). Returns how many were placed. */
  place(ax: number, ay: number, bx: number, by: number, m: Mat): number {
    if (this.index(ax, ay, bx, by) || !this.check(ax, ay, bx, by, m).ok) return 0;
    this.push();
    this.members.push({ ax, ay, bx, by, m });
    let n = 1;
    if (this.mirror) {
      const mx = this.mirrorX(ax), nx = this.mirrorX(bx);
      if (mkey(mx, ay, nx, by) !== mkey(ax, ay, bx, by) && !this.index(mx, ay, nx, by) && this.check(mx, ay, nx, by, m, true).ok) { this.members.push({ ax: mx, ay, bx: nx, by, m }); n++; }
    }
    return n;
  }
  /** Removes member i (1-based index from `index`, or a 0-based array index with `at`), and its mirror twin with mirror on. */
  removeAt(i: number): number {
    const m = this.members[i]; if (!m) return 0;
    this.push();
    const keys = new Set([mkey(m.ax, m.ay, m.bx, m.by)]);
    if (this.mirror) keys.add(mkey(this.mirrorX(m.ax), m.ay, this.mirrorX(m.bx), m.by));
    const before = this.members.length;
    this.members = this.members.filter((q) => !keys.has(mkey(q.ax, q.ay, q.bx, q.by)));
    return before - this.members.length;
  }
  /** Removes every member at a joint (and the mirror joint's with mirror on). */
  removeNode(x: number, y: number): number {
    const at = (q: Member, px: number, py: number) => (q.ax === px && q.ay === py) || (q.bx === px && q.by === py);
    if (!this.members.some((q) => at(q, x, y))) return 0;
    this.push();
    const mx = this.mirrorX(x), before = this.members.length;
    this.members = this.members.filter((q) => !at(q, x, y) && !(this.mirror && at(q, mx, y)));
    return before - this.members.length;
  }
  /** The member nearest a point (within `reach`), as a 0-based index, or -1. */
  pick(px: number, py: number, reach = 0.35): number {
    let best = -1, bd = reach;
    this.members.forEach((m, i) => { const d = segDist(px, py, m.ax, m.ay, m.bx, m.by); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  clear() { if (!this.members.length) return false; this.push(); this.members = []; return true; }
  undo() { const p = this.past.pop(); if (!p) return false; this.future.push(this.members); this.members = p; return true; }
  redo() { const f = this.future.pop(); if (!f) return false; this.past.push(this.members); this.members = f; return true; }
  /** Replaces the whole design (an undoable step). */
  load(ms: readonly Member[]) { this.push(); const b = new Builder(this.level, ms); this.members = b.members; }
}

// ---------------------------------------------------------------- the simulation
export type Outcome = 'cross' | 'splash' | 'stuck' | 'boat';
export type Ev =
  | { k: 'break'; x: number; y: number; ang: number; len: number; m: Mat; tension: boolean }
  | { k: 'splash'; x: number; y: number; who: VehicleKind }
  | { k: 'cross' }
  | { k: 'stuck' }
  | { k: 'boat'; x: number; y: number }
  | { k: 'go' }
  | { k: 'deck'; who: VehicleKind };
export type SimMember = { a: number; b: number; m: Mat; L: number; alive: boolean; force: number; ratio: number; slack: boolean; peak: number };
export type Vehicle = {
  kind: VehicleKind; def: VehicleDef;
  /** wheel 0 is the rear wheel, wheel 1 the front */
  x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; px: Float64Array; py: Float64Array;
  touch: Int8Array; nx: Float64Array; ny: Float64Array;
  /** how far each wheel has rolled, for the spin */ roll: Float64Array;
  best: number; bestAt: number; done: boolean; fell: boolean; onDeck: boolean;
};

export class Sim {
  readonly level: LevelDef;
  readonly design: Member[];
  t = 0;
  steps = 0;
  outcome: Outcome | null = null;
  /** when the outcome came (seconds) */
  endT = 0;
  // joints
  n: number;
  x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; px: Float64Array; py: Float64Array;
  w: Float64Array; area: Float64Array;
  fixed: Uint8Array;
  members: SimMember[];
  vehicles: Vehicle[] = [];
  events: Ev[] = [];
  /** the worst member strain this step, 0..1+ */
  strain = 0;
  /** the wind on a unit of area right now */
  wind: Pt = [0, 0];
  boatX = 0;
  private roads: [number, number, number, number][] = [];
  private lam: Float64Array;
  private fsum: Float64Array;

  constructor(level: LevelDef, design: readonly Member[]) {
    this.level = level;
    this.design = design.map((m) => ({ ...m }));
    const idx = new Map<string, number>(), pts: Pt[] = [];
    const node = (x: number, y: number) => { const k = pkey(x, y); let i = idx.get(k); if (i === undefined) { i = pts.length; idx.set(k, i); pts.push([x, y]); } return i; };
    for (const [x, y] of level.anchors) node(x, y);
    const ms: SimMember[] = [];
    for (const m of this.design) ms.push({ a: node(m.ax, m.ay), b: node(m.bx, m.by), m: m.m, L: lenOf(m), alive: true, force: 0, ratio: 0, slack: false, peak: 0 });
    this.n = pts.length;
    const n = this.n;
    this.x = new Float64Array(n); this.y = new Float64Array(n); this.vx = new Float64Array(n); this.vy = new Float64Array(n);
    this.px = new Float64Array(n); this.py = new Float64Array(n); this.w = new Float64Array(n); this.area = new Float64Array(n);
    this.fixed = new Uint8Array(n);
    const mass = new Float64Array(n).fill(JOINT_MASS);
    pts.forEach(([x, y], i) => { this.x[i] = x; this.y[i] = y; this.fixed[i] = isAnchor(level, x, y) ? 1 : 0; });
    for (const m of ms) { const h = (MAT[m.m].mass * m.L) / 2; mass[m.a] += h; mass[m.b] += h; const ar = (MAT[m.m].area * m.L) / 2; this.area[m.a] += ar; this.area[m.b] += ar; }
    for (let i = 0; i < n; i++) this.w[i] = this.fixed[i] ? 0 : 1 / mass[i];
    this.members = ms;
    this.lam = new Float64Array(ms.length);
    this.fsum = new Float64Array(ms.length);
    for (const g of level.grounds) if (g.road) for (let i = 0; i + 1 < g.road.length; i++) this.roads.push([g.road[i][0], g.road[i][1], g.road[i + 1][0], g.road[i + 1][1]]);
    // the cart leads; the wagon waits a little way behind it
    level.vehicles.forEach((kind, k) => this.vehicles.push(this.makeVehicle(kind, k === 0 ? level.start : level.start - VEHICLE[kind].gap - VEHICLE[kind].base)));
    this.boatX = level.boat ? level.boat.x0 - 6 : 0;
  }
  /** A vehicle resting on the start road with its rear wheel at x. */
  private makeVehicle(kind: VehicleKind, rearX: number): Vehicle {
    const d = VEHICLE[kind], v: Vehicle = {
      kind, def: d, x: new Float64Array(2), y: new Float64Array(2), vx: new Float64Array(2), vy: new Float64Array(2), px: new Float64Array(2), py: new Float64Array(2),
      touch: new Int8Array(2), nx: new Float64Array(2), ny: new Float64Array(2), roll: new Float64Array(2), best: rearX, bestAt: 0, done: false, fell: false, onDeck: false,
    };
    for (let i = 0; i < 2; i++) { const wx = rearX + i * d.base; v.x[i] = wx; v.y[i] = this.roadY(wx) + d.r; }
    return v;
  }
  /** The road's height under x (the start road), for placing vehicles. */
  private roadY(x: number) {
    for (const [ax, ay, bx, by] of this.roads) if (x >= ax && x <= bx && bx > ax) return ay + ((x - ax) / (bx - ax)) * (by - ay);
    return 0;
  }
  get over() { return this.outcome !== null; }
  /** The force needed to snap member i in the way it is loaded now. */
  limit(i: number) { const m = this.members[i]; return m.force >= 0 ? MAT[m.m].tens : compLimit(m.m, m.L); }

  /** One fixed step (1/60 s) of SUB substeps. */
  step() {
    const L = this.level, h = DT / SUB, h2 = h * h, ms = this.members, n = this.n;
    const settling = this.t < SETTLE;
    const damp = Math.exp(-(settling ? 14 : 1.2) * h);
    this.fsum.fill(0);
    // the wind: steady gusts with a rising and falling updraft
    if (L.wind) {
      const ph = this.t / 4.6, gust = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2);
      this.wind = [-L.wind * (0.3 + 0.7 * gust), L.wind * 0.55 * Math.sin(this.t * 1.9 + 1)];
    }
    const [wfx, wfy] = this.wind;
    const driving = !settling && !this.outcome;
    for (let s = 0; s < SUB; s++) {
      // predict
      for (let i = 0; i < n; i++) {
        if (this.fixed[i]) continue;
        const wi = this.w[i];
        this.vx[i] += h * (this.area[i] * wfx * wi);
        this.vy[i] += h * (-G + this.area[i] * wfy * wi);
        this.px[i] = this.x[i]; this.py[i] = this.y[i];
        this.x[i] += h * this.vx[i]; this.y[i] += h * this.vy[i];
      }
      for (const v of this.vehicles) {
        const wm = 2 / v.def.mass;
        for (let k = 0; k < 2; k++) {
          v.vx[k] += h * v.def.area * 0.5 * wfx * wm; v.vy[k] -= h * G;
          v.px[k] = v.x[k]; v.py[k] = v.y[k];
          v.x[k] += h * v.vx[k]; v.y[k] += h * v.vy[k];
          v.touch[k] = 0;
        }
      }
      // members
      for (let j = 0; j < ms.length; j++) {
        const m = ms[j]; if (!m.alive) continue;
        const a = m.a, b = m.b, wa = this.w[a], wb = this.w[b];
        const dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a], d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-9) continue;
        const C = d - m.L;
        if (MAT[m.m].rope && C <= 0) { m.slack = true; continue; }
        m.slack = false;
        const at = m.L / MAT[m.m].ea / h2;
        const wsum = wa + wb + at; if (wsum <= 0) continue;
        const dl = -C / wsum;
        this.fsum[j] += -dl / h2;
        const nx = dx / d, ny = dy / d;
        this.x[a] -= wa * dl * nx; this.y[a] -= wa * dl * ny;
        this.x[b] += wb * dl * nx; this.y[b] += wb * dl * ny;
      }
      // vehicles: the axle, then the wheels on planks and roads
      for (const v of this.vehicles) {
        const dx = v.x[1] - v.x[0], dy = v.y[1] - v.y[0], d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1e-9) { const C = (d - v.def.base) / 2, nx = dx / d, ny = dy / d; v.x[0] += C * nx; v.y[0] += C * ny; v.x[1] -= C * nx; v.y[1] -= C * ny; }
        const ww = 2 / v.def.mass;
        for (let k = 0; k < 2; k++) {
          const r = v.def.r;
          for (const [ax, ay, bx, by] of this.roads) this.contact(v, k, r, ww, ax, ay, bx, by, -1, -1);
          for (let j = 0; j < ms.length; j++) {
            const m = ms[j]; if (!m.alive || !MAT[m.m].deck) continue;
            this.contact(v, k, r, ww, this.x[m.a], this.y[m.a], this.x[m.b], this.y[m.b], m.a, m.b);
          }
        }
      }
      // velocities
      for (let i = 0; i < n; i++) {
        if (this.fixed[i]) continue;
        this.vx[i] = ((this.x[i] - this.px[i]) / h) * damp; this.vy[i] = ((this.y[i] - this.py[i]) / h) * damp;
      }
      for (const v of this.vehicles) {
        for (let k = 0; k < 2; k++) {
          v.vx[k] = (v.x[k] - v.px[k]) / h; v.vy[k] = (v.y[k] - v.py[k]) / h;
          if (!v.touch[k]) continue;
          // the wheels grip: drive along the surface toward the cruising speed (or brake once across)
          const tx = v.ny[k], ty = -v.nx[k];
          const vt = v.vx[k] * tx + v.vy[k] * ty;
          const goal = driving ? this.cruise(v) : 0;
          const dv = Math.max(-v.def.grip * h, Math.min(v.def.grip * h, goal - vt));
          v.vx[k] += dv * tx; v.vy[k] += dv * ty;
          // no bounce off the surface
          const vn = v.vx[k] * v.nx[k] + v.vy[k] * v.ny[k];
          if (vn < 0) { v.vx[k] -= vn * v.nx[k]; v.vy[k] -= vn * v.ny[k]; }
          v.roll[k] += vt * h;
        }
        for (let k = 0; k < 2; k++) { const sp = Math.hypot(v.vx[k], v.vy[k]); if (sp > 14) { v.vx[k] *= 14 / sp; v.vy[k] *= 14 / sp; } }
        if (!v.touch[0] && !v.touch[1]) for (let k = 0; k < 2; k++) v.roll[k] += (v.vx[k] * h) * 0.98;
      }
    }
    // forces and breaks: the average over the step
    let worst = 0;
    for (let j = 0; j < ms.length; j++) {
      const m = ms[j]; if (!m.alive) continue;
      m.force = this.fsum[j] / SUB;
      const lim = m.force >= 0 ? MAT[m.m].tens : compLimit(m.m, m.L);
      m.ratio = lim > 0 ? Math.abs(m.force) / lim : 0;
      if (m.slack && m.force === 0) m.ratio = 0;
      if (m.ratio > m.peak) m.peak = m.ratio;
      if (m.ratio > 1 && !settling) {
        m.alive = false;
        const ax = this.x[m.a], ay = this.y[m.a], bx = this.x[m.b], by = this.y[m.b];
        this.events.push({ k: 'break', x: (ax + bx) / 2, y: (ay + by) / 2, ang: Math.atan2(by - ay, bx - ax), len: m.L, m: m.m, tension: m.force > 0 });
      } else if (m.ratio > 1) {
        // while the bridge settles, an overload still snaps it, just without the jolt counting double
        if (m.ratio > 1.15) { m.alive = false; const ax = this.x[m.a], ay = this.y[m.a], bx = this.x[m.b], by = this.y[m.b]; this.events.push({ k: 'break', x: (ax + bx) / 2, y: (ay + by) / 2, ang: Math.atan2(by - ay, bx - ax), len: m.L, m: m.m, tension: m.force > 0 }); }
      }
      if (m.alive && m.ratio > worst) worst = m.ratio;
    }
    this.strain = worst;
    this.t += DT; this.steps++;
    if (this.steps === Math.round(SETTLE * FPS)) this.events.push({ k: 'go' });
    if (L.boat) this.boatX = L.boat.x0 - 6 + Math.max(0, this.t - 1.5) * 2.2;
    this.judge();
  }
  /** The speed a vehicle wants: the cruising speed, held back for the wagon if it gets close to the cart. */
  private cruise(v: Vehicle) {
    if (v.kind !== 'wagon') return v.def.speed;
    const lead = this.vehicles[0];
    const gap = lead.x[0] - v.x[1];
    return Math.max(0, Math.min(v.def.speed, (gap - 0.6) * 2));
  }
  /** Pushes wheel k of v out of a segment it overlaps (from above only), sharing the push with the segment's joints. */
  private contact(v: Vehicle, k: number, r: number, ww: number, ax: number, ay: number, bx: number, by: number, ia: number, ib: number) {
    const sx = bx - ax, sy = by - ay, l2 = sx * sx + sy * sy;
    // nothing steeper than about 58° is a road (and a plank swinging down past a wheel mustn't fling the cart)
    if (l2 < 1e-9 || Math.abs(sy) > 1.6 * Math.abs(sx)) return;
    const cx = v.x[k], cy = v.y[k];
    // one-sided: only from above the line
    const sl = Math.sqrt(l2);
    let unx = -sy / sl, uny = sx / sl; if (uny < 0) { unx = -unx; uny = -uny; }
    const side = (cx - ax) * unx + (cy - ay) * uny;
    if (side <= 0) return;
    const t = Math.max(0, Math.min(1, ((cx - ax) * sx + (cy - ay) * sy) / l2));
    const qx = ax + t * sx, qy = ay + t * sy;
    let dx = cx - qx, dy = cy - qy; const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= r || d < 1e-9) return;
    dx /= d; dy /= d;
    // a wheel only rests on a surface it is above, so the push is never sideways from a cliff edge
    if (dy < 0.2) return;
    const wa = ia >= 0 ? this.w[ia] : 0, wb = ib >= 0 ? this.w[ib] : 0;
    const denom = ww + wa * (1 - t) * (1 - t) + wb * t * t;
    // a wheel sinks only a hair per substep resting or rolling; a bigger overlap is something swinging into it, so
    // it is pushed out gently over several substeps rather than all at once
    const lam = Math.min(r - d, 0.03) / denom;
    v.x[k] += ww * lam * dx; v.y[k] += ww * lam * dy;
    if (ia >= 0) { this.x[ia] -= wa * (1 - t) * lam * dx; this.y[ia] -= wa * (1 - t) * lam * dy; }
    if (ib >= 0) { this.x[ib] -= wb * t * lam * dx; this.y[ib] -= wb * t * lam * dy; }
    v.touch[k] = 1; v.nx[k] = dx; v.ny[k] = dy;
    if (ia >= 0 && !v.onDeck) { v.onDeck = true; this.events.push({ k: 'deck', who: v.kind }); }
  }
  /** Decides whether the run has been won or lost. */
  private judge() {
    const L = this.level;
    if (this.outcome && this.outcome !== 'cross') return;
    let allDone = true;
    for (const v of this.vehicles) {
      const rear = Math.min(v.x[0], v.x[1]);
      if (!v.done && rear >= L.finish) v.done = true;
      if (!v.done) allDone = false;
      if (!v.fell && Math.min(v.y[0], v.y[1]) < L.water - 0.2) {
        v.fell = true;
        if (!this.outcome) { this.finishWith('splash'); this.events.push({ k: 'splash', x: (v.x[0] + v.x[1]) / 2, y: L.water, who: v.kind }); }
      }
      const front = Math.max(v.x[0], v.x[1]);
      if (front > v.best + 0.05) { v.best = front; v.bestAt = this.t; }
    }
    if (this.outcome) return;
    if (allDone) { this.finishWith('cross'); this.events.push({ k: 'cross' }); return; }
    if (L.boat && this.t > SETTLE) {
      for (const m of this.members) {
        if (!m.alive) continue;
        if (segHitsBox(this.x[m.a], this.y[m.a], this.x[m.b], this.y[m.b], L.boat)) { this.finishWith('boat'); this.events.push({ k: 'boat', x: (this.x[m.a] + this.x[m.b]) / 2, y: (this.y[m.a] + this.y[m.b]) / 2 }); return; }
      }
    }
    const lastMove = Math.max(...this.vehicles.filter((v) => !v.done).map((v) => v.bestAt), SETTLE);
    if (this.t - lastMove > STUCK || this.t > TIME_LIMIT) { this.finishWith('stuck'); this.events.push({ k: 'stuck' }); }
  }
  private finishWith(o: Outcome) { this.outcome = o; this.endT = this.t; }
  /** Runs until the outcome is known (or the time limit), then a little longer if asked. */
  run(maxT = TIME_LIMIT + 1) { while (!this.outcome && this.t < maxT) this.step(); return this.outcome ?? 'stuck'; }
  /** A fingerprint of the whole state, for the determinism checks. */
  fingerprint() {
    let h = 0;
    const mix = (v: number) => { h = (h * 31 + Math.round(v * 1e6)) | 0; };
    for (let i = 0; i < this.n; i++) { mix(this.x[i]); mix(this.y[i]); }
    for (const m of this.members) mix(m.alive ? m.force : -1);
    for (const v of this.vehicles) for (let k = 0; k < 2; k++) { mix(v.x[k]); mix(v.y[k]); }
    return `${this.outcome}:${this.steps}:${h}`;
  }
  /** The angle of a vehicle's axle. */
  static angle(v: Vehicle) { return Math.atan2(v.y[1] - v.y[0], v.x[1] - v.x[0]); }
}

/** Tests a design to the end: the outcome, when it came, and the fingerprint. */
export function testDesign(level: LevelDef, design: readonly Member[], maxT = TIME_LIMIT + 1) {
  const s = new Sim(level, design);
  const outcome = s.run(maxT);
  return { outcome, t: s.endT || s.t, steps: s.steps, cost: designCost(design), peak: Math.max(0, ...s.members.map((m) => m.peak)), broke: s.members.filter((m) => !m.alive).length, fp: s.fingerprint() };
}

// ---------------------------------------------------------------- medals and progress
/** Medals for crossing at a cost: 1 within the budget, 2 within the thrifty price, 3 within the master builder's. */
export const medalsFor = (L: LevelDef, cost: number) => (cost <= L.master ? 3 : cost <= L.thrifty ? 2 : cost <= L.budget ? 1 : 0);

export const SAVE_KEY = 'twig-twine-v1';
export type LevelSave = { best: number | null; medals: number; design: MemberData[]; crossed: boolean };
export type Save = {
  v: 1;
  levels: Partial<Record<string, LevelSave>>;
  sandbox: MemberData[];
  sandboxWagon: boolean;
  ended: boolean;
  tutorial: boolean;
  settings: { sound: boolean; music: boolean; stress: boolean; mirror: boolean };
};
export const freshSave = (): Save => ({ v: 1, levels: {}, sandbox: [], sandboxWagon: false, ended: false, tutorial: false, settings: { sound: true, music: true, stress: true, mirror: false } });
const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o);
const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);
/** Reads a save, ignoring anything that doesn't look right. Never throws. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.levels)) for (const id of LEVEL_IDS) {
      const d = o.levels[id]; if (!isObj(d)) continue;
      const L = LEVELS[id];
      const design = encode(new Builder(L, decode(d.design)).members);
      const crossed = d.crossed === true;
      const best = crossed && typeof d.best === 'number' && Number.isFinite(d.best) && d.best >= 0 ? Math.round(d.best) : null;
      const medals = crossed ? Math.floor(num(d.medals, 0, 3, 0)) : 0;
      s.levels[id] = { best, medals: best === null ? 0 : Math.max(medals, medalsFor(L, best)), design, crossed: crossed && best !== null };
    }
    s.sandbox = encode(new Builder(SANDBOX, decode(o.sandbox)).members);
    s.sandboxWagon = o.sandboxWagon === true;
    s.ended = o.ended === true;
    s.tutorial = o.tutorial === true;
    if (isObj(o.settings)) {
      s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false;
      s.settings.stress = o.settings.stress !== false; s.settings.mirror = o.settings.mirror === true;
    }
  } catch { return freshSave(); }
  return s;
}
/** Records a crossing: the best (cheapest) cost and the medals only ever get better. */
export function recordCross(s: Save, id: string, design: readonly Member[]): { best: boolean; medals: number; newMedals: number; first: boolean; finale: boolean } {
  const L = LEVELS[id], cost = designCost(design), got = medalsFor(L, cost);
  const d = s.levels[id] ?? { best: null, medals: 0, design: [], crossed: false };
  const first = !d.crossed && got > 0;
  const out = { best: false, medals: got, newMedals: Math.max(0, got - d.medals), first, finale: false };
  if (got > 0) {
    if (d.best === null || cost < d.best) { out.best = d.best !== null; d.best = cost; }
    d.medals = Math.max(d.medals, got); d.crossed = true;
  }
  d.design = encode(design);
  s.levels[id] = d;
  if (got > 0 && id === LEVEL_IDS[LEVEL_IDS.length - 1] && !s.ended) { s.ended = true; out.finale = true; }
  return out;
}
export const crossed = (s: Save, id: string) => !!s.levels[id]?.crossed;
export const medalCount = (s: Save) => LEVEL_IDS.reduce((n, id) => n + (s.levels[id]?.medals ?? 0), 0);
export const regionLevels = (r: RegionId) => LEVEL_IDS.filter((id) => LEVELS[id].region === r);
export const regionCleared = (s: Save, r: RegionId) => regionLevels(r).filter((id) => crossed(s, id)).length;
/** Level i opens when the one before it is crossed; a region's first level also opens once the region before has 4 crossed. */
export function levelOpen(s: Save, id: string) {
  const i = LEVEL_IDS.indexOf(id); if (i < 0) return false;
  if (i === 0) return true;
  if (crossed(s, LEVEL_IDS[i - 1])) return true;
  const L = LEVELS[id], ri = REGIONS.findIndex((r) => r.id === L.region);
  if (regionLevels(L.region)[0] === id && ri > 0) return regionCleared(s, REGIONS[ri - 1].id) >= 4;
  return false;
}
/** The sandbox opens once every Willow Brook crossing is done. */
export const sandboxOpen = (s: Save) => regionCleared(s, REGIONS[0].id) >= regionLevels(REGIONS[0].id).length;
/** The design to show when a level opens: the saved one, or nothing. */
export const savedDesign = (s: Save, id: string): Member[] => decode(id === SANDBOX.id ? s.sandbox : s.levels[id]?.design ?? []);

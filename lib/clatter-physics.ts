// Clatterbox's physics: a small deterministic 2D rigid-body engine for the cardboard contraptions. Bodies are made of
// convex polygons and circles; contacts, hinges (split pins, with optional stops), strings (a most-length tie between
// two points) and the pulley's cord are solved with soft-step sequential impulses (a fixed step split into substeps,
// a biased solve, a relax pass without bias, then restitution), the way modern Box2D does it, so a row of dominoes
// stands still until it is knocked and a stack never creeps. Contact points carry feature ids so their impulses
// warm-start the next step. No DOM, no Math.random, no clock: the same inputs give the same world, step for step.
// y points up; the floor of the box is y = 0.

export type Vec = { x: number; y: number };
export type PolyShape = { kind: 'poly'; v: Vec[]; n: Vec[] };
export type CircleShape = { kind: 'circle'; c: Vec; r: number };
export type Shape = PolyShape | CircleShape;

export const GRAVITY = 26;
export const DT = 1 / 60;
const SUBSTEPS = 6;
const ITERS = 3;
const RELAX = 1;
const SLOP = 0.005;
const SPECULATIVE = 4 * SLOP;
const PUSH_MAX = 3;
const CONTACT_HZ = 90;
const CONTACT_ZETA = 10;
const JOINT_ZETA = 2;
const BOUNCE_MIN = 1;
const MAX_SPEED = 40;

export type BodyOpts = { density?: number; friction?: number; restitution?: number; linDamp?: number; angDamp?: number; group?: number; isStatic?: boolean; gs?: number; sensor?: boolean };

export class Body {
  id: number;
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  c = 1; s = 0;
  m = 0; im = 0; I = 0; iI = 0;
  friction: number; restitution: number; linDamp: number; angDamp: number;
  group: number; isStatic: boolean;
  /** Gravity scale (a balloon's is below zero: it rises) and whether the body is a sensor that touches nothing. */
  gs: number; sensor: boolean;
  shapes: Shape[];
  // world-space vertices per polygon shape, refreshed by sync()
  wv: Vec[][] = []; wn: Vec[][] = [];
  minX = 0; minY = 0; maxX = 0; maxY = 0;
  dpx = 0; dpy = 0; da = 0;
  fx = 0; fy = 0;
  /** Weight resting on this body, in mass units, and the hardest hit it took, from the last step. */
  load = 0; hit = 0;
  /** What the game hangs on a body (its piece). */
  tag = -1;
  constructor(id: number, shapes: Shape[], o: BodyOpts) {
    this.id = id; this.shapes = shapes;
    this.friction = o.friction ?? 0.6; this.restitution = o.restitution ?? 0; this.linDamp = o.linDamp ?? 0.05; this.angDamp = o.angDamp ?? 0.1;
    this.group = o.group ?? 0; this.isStatic = !!o.isStatic; this.gs = o.gs ?? 1; this.sensor = !!o.sensor;
    if (!this.isStatic) {
      const d = o.density ?? 1; let m = 0, I = 0;
      for (const sh of shapes) { const p = shapeMass(sh, d); m += p.m; I += p.I; }
      this.m = m; this.im = m > 0 ? 1 / m : 0; this.I = I; this.iI = I > 0 ? 1 / I : 0;
    }
    for (const sh of shapes) if (sh.kind === 'poly') { this.wv.push(sh.v.map(() => ({ x: 0, y: 0 }))); this.wn.push(sh.n.map(() => ({ x: 0, y: 0 }))); } else { this.wv.push([]); this.wn.push([]); }
    this.sync();
  }
  sync() {
    const c = Math.cos(this.a), s = Math.sin(this.a); this.c = c; this.s = s;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < this.shapes.length; i++) {
      const sh = this.shapes[i];
      if (sh.kind === 'poly') {
        const wv = this.wv[i], wn = this.wn[i];
        for (let k = 0; k < sh.v.length; k++) {
          const v = sh.v[k], n = sh.n[k], p = wv[k];
          p.x = this.x + c * v.x - s * v.y; p.y = this.y + s * v.x + c * v.y;
          wn[k].x = c * n.x - s * n.y; wn[k].y = s * n.x + c * n.y;
          if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
        }
      } else {
        const px = this.x + c * sh.c.x - s * sh.c.y, py = this.y + s * sh.c.x + c * sh.c.y;
        x0 = Math.min(x0, px - sh.r); x1 = Math.max(x1, px + sh.r); y0 = Math.min(y0, py - sh.r); y1 = Math.max(y1, py + sh.r);
      }
    }
    this.minX = x0; this.minY = y0; this.maxX = x1; this.maxY = y1;
  }
  /** A world point of a body-local point. */
  world(lx: number, ly: number): Vec { return { x: this.x + this.c * lx - this.s * ly, y: this.y + this.s * lx + this.c * ly }; }
  speed() { return Math.hypot(this.vx, this.vy) + Math.abs(this.w) * 0.5; }
  /** How far any point of the body can move per second right now. */
  get reach() { return this.isStatic ? 0 : Math.hypot(this.vx, this.vy) + Math.abs(this.w) * Math.max(this.maxX - this.minX, this.maxY - this.minY) * 0.75; }
}

// ---- shapes

/** A convex polygon from counter-clockwise points. */
export function poly(pts: [number, number][]): PolyShape {
  const v = pts.map(([x, y]) => ({ x, y })), n: Vec[] = [];
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length], ex = b.x - a.x, ey = b.y - a.y, l = Math.hypot(ex, ey); n.push({ x: ey / l, y: -ex / l }); }
  return { kind: 'poly', v, n };
}
/** A box w × h centred on (cx, cy), with its corners cut off by `round` (an octagon) for soft, rounded pieces. */
export function box(w: number, h: number, round = 0, cx = 0, cy = 0): PolyShape {
  const x = w / 2, y = h / 2, r = Math.min(round, x * 0.9, y * 0.9);
  if (r <= 0) return poly([[cx - x, cy - y], [cx + x, cy - y], [cx + x, cy + y], [cx - x, cy + y]]);
  return poly([[cx - x + r, cy - y], [cx + x - r, cy - y], [cx + x, cy - y + r], [cx + x, cy + y - r], [cx + x - r, cy + y], [cx - x + r, cy + y], [cx - x, cy + y - r], [cx - x, cy - y + r]]);
}
export function circle(r: number, cx = 0, cy = 0): CircleShape { return { kind: 'circle', c: { x: cx, y: cy }, r }; }

function shapeMass(sh: Shape, d: number) {
  if (sh.kind === 'circle') { const m = d * Math.PI * sh.r * sh.r; return { m, I: m * (0.5 * sh.r * sh.r + sh.c.x * sh.c.x + sh.c.y * sh.c.y), cx: sh.c.x, cy: sh.c.y }; }
  let area = 0, cx = 0, cy = 0, I = 0; const v = sh.v;
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length], cr = p.x * q.y - q.x * p.y;
    area += cr / 2; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
    I += cr * (p.x * p.x + p.x * q.x + q.x * q.x + p.y * p.y + p.y * q.y + q.y * q.y);
  }
  return { m: d * area, I: (d * I) / 12, cx: cx / (6 * area), cy: cy / (6 * area) };
}
/** Moves shapes so the centre of mass is the body's origin; returns the offset that was taken away. */
export function centre(shapes: Shape[], density = 1): Vec {
  let m = 0, x = 0, y = 0;
  for (const sh of shapes) { const p = shapeMass(sh, density); m += p.m; x += p.cx * p.m; y += p.cy * p.m; }
  x /= m; y /= m;
  for (const sh of shapes) { if (sh.kind === 'circle') { sh.c.x -= x; sh.c.y -= y; } else for (const v of sh.v) { v.x -= x; v.y -= y; } }
  return { x, y };
}

// ---- collision: manifolds with up to two points, normal from A to B

type MPoint = { x: number; y: number; sep: number; id: number };
type Manifold = { nx: number; ny: number; pts: MPoint[] };

function polyPoly(va: Vec[], na: Vec[], vb: Vec[], nb: Vec[], M: number): Manifold | null {
  const sa = maxSep(va, na, vb), sb = maxSep(vb, nb, va);
  if (sa.sep > M || sb.sep > M) return null;
  let flip = false, rv = va, rn = na, iv = vb, inn = nb, edge = sa.edge;
  if (sb.sep > sa.sep + 0.1 * SLOP) { flip = true; rv = vb; rn = nb; iv = va; inn = na; edge = sb.edge; }
  const n = rn[edge];
  // the incident edge: the one facing most against the reference normal
  let ie = 0, best = Infinity;
  for (let i = 0; i < inn.length; i++) { const d = n.x * inn[i].x + n.y * inn[i].y; if (d < best) { best = d; ie = i; } }
  const i1 = ie, i2 = (ie + 1) % iv.length;
  const v1 = rv[edge], v2 = rv[(edge + 1) % rv.length];
  const tx = v2.x - v1.x, ty = v2.y - v1.y, tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl;
  // clip the incident edge to the reference edge's side planes
  let c1 = { x: iv[i1].x, y: iv[i1].y, id: i1 }, c2 = { x: iv[i2].x, y: iv[i2].y, id: i2 };
  const lo = ux * v1.x + uy * v1.y, hi = ux * v2.x + uy * v2.y;
  const clip = (p: typeof c1, q: typeof c1, off: number, sx: number, sy: number) => {
    const dp = sx * p.x + sy * p.y - off, dq = sx * q.x + sy * q.y - off;
    if (dp <= 0 && dq <= 0) return [p, q];
    if (dp > 0 && dq > 0) return null;
    const t = dp / (dp - dq), m = { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y), id: dp > 0 ? p.id + 8 : q.id + 8 };
    return dp > 0 ? [m, q] : [p, m];
  };
  let r = clip(c1, c2, -lo, -ux, -uy); if (!r) return null; [c1, c2] = r;
  r = clip(c1, c2, hi, ux, uy); if (!r) return null; [c1, c2] = r;
  const off = n.x * v1.x + n.y * v1.y, pts: MPoint[] = [];
  for (const c of [c1, c2]) {
    const sep = n.x * c.x + n.y * c.y - off;
    if (sep <= M) pts.push({ x: c.x - 0.5 * sep * n.x, y: c.y - 0.5 * sep * n.y, sep, id: (flip ? 1024 : 0) + edge * 64 + c.id });
  }
  if (!pts.length) return null;
  return flip ? { nx: -n.x, ny: -n.y, pts } : { nx: n.x, ny: n.y, pts };
}
function maxSep(va: Vec[], na: Vec[], vb: Vec[]) {
  let best = -Infinity, edge = 0;
  for (let i = 0; i < va.length; i++) {
    const n = na[i], p = va[i]; let m = Infinity;
    for (const q of vb) { const d = n.x * (q.x - p.x) + n.y * (q.y - p.y); if (d < m) m = d; }
    if (m > best) { best = m; edge = i; }
  }
  return { sep: best, edge };
}
/** A polygon (A) against a circle (B). */
function polyCircle(va: Vec[], na: Vec[], cx: number, cy: number, r: number, M: number): Manifold | null {
  let best = -Infinity, e = 0;
  for (let i = 0; i < va.length; i++) { const s = na[i].x * (cx - va[i].x) + na[i].y * (cy - va[i].y); if (s > best) { best = s; e = i; } }
  if (best > r + M) return null;
  const v1 = va[e], v2 = va[(e + 1) % va.length];
  let nx: number, ny: number, px: number, py: number;
  if (best < 1e-6) { nx = na[e].x; ny = na[e].y; px = cx - nx * best; py = cy - ny * best; }
  else {
    const u1 = (cx - v1.x) * (v2.x - v1.x) + (cy - v1.y) * (v2.y - v1.y), u2 = (cx - v2.x) * (v1.x - v2.x) + (cy - v2.y) * (v1.y - v2.y);
    if (u1 <= 0) { px = v1.x; py = v1.y; }
    else if (u2 <= 0) { px = v2.x; py = v2.y; }
    else { nx = na[e].x; ny = na[e].y; px = cx - nx * best; py = cy - ny * best; }
    if (u1 <= 0 || u2 <= 0) { const dx = cx - px!, dy = cy - py!, d = Math.hypot(dx, dy); if (d > r + M) return null; nx = dx / d; ny = dy / d; }
  }
  const dist = (cx - px!) * nx! + (cy - py!) * ny!, sep = dist - r;
  const sx = cx - nx! * r, sy = cy - ny! * r;
  return { nx: nx!, ny: ny!, pts: [{ x: (px! + sx) / 2, y: (py! + sy) / 2, sep, id: 512 + e }] };
}
function circleCircle(ax: number, ay: number, ar: number, bx: number, by: number, br: number, M: number): Manifold | null {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), sep = d - ar - br;
  if (sep > M) return null;
  const nx = d > 1e-9 ? dx / d : 0, ny = d > 1e-9 ? dy / d : 1;
  const px = ax + nx * ar, py = ay + ny * ar, qx = bx - nx * br, qy = by - ny * br;
  return { nx, ny, pts: [{ x: (px + qx) / 2, y: (py + qy) / 2, sep, id: 777 }] };
}
function collideShapes(A: Body, ia: number, B: Body, ib: number, M: number): Manifold | null {
  const sa = A.shapes[ia], sb = B.shapes[ib];
  if (sa.kind === 'poly' && sb.kind === 'poly') return polyPoly(A.wv[ia], A.wn[ia], B.wv[ib], B.wn[ib], M);
  const cc = (b: Body, sh: CircleShape) => ({ x: b.x + b.c * sh.c.x - b.s * sh.c.y, y: b.y + b.s * sh.c.x + b.c * sh.c.y });
  if (sa.kind === 'poly' && sb.kind === 'circle') { const p = cc(B, sb); return polyCircle(A.wv[ia], A.wn[ia], p.x, p.y, sb.r, M); }
  if (sa.kind === 'circle' && sb.kind === 'poly') {
    const p = cc(A, sa), m = polyCircle(B.wv[ib], B.wn[ib], p.x, p.y, sa.r, M); if (!m) return null;
    return { nx: -m.nx, ny: -m.ny, pts: m.pts };
  }
  const p = cc(A, sa as CircleShape), q = cc(B, sb as CircleShape);
  return circleCircle(p.x, p.y, (sa as CircleShape).r, q.x, q.y, (sb as CircleShape).r, M);
}

// ---- the solver

type CPoint = { id: number; rax: number; ray: number; rbx: number; rby: number; adj: number; nm: number; tm: number; pn: number; pt: number; maxPn: number; rel: number; sep: number };
export type Contact = { key: number; A: Body; B: Body; nx: number; ny: number; f: number; e: number; pts: CPoint[]; soft: Soft; k: number[] | null; fresh: boolean };
const BI = [0, 0], MS = [1, 1], IS = [0, 0];
type Soft = { bias: number; ms: number; is: number };
/**
 * A joint. `hinge`: a split pin holding a point of A on a point of B, with optional stops on how far B may turn against
 * A (`lo` ≤ turn ≤ `hi`, only when lo ≤ hi). `rope`: a string, the two points no further apart than `len`. `pulley`:
 * a cord over two fixed wheels (g1 above A, g2 above B), the two hanging lengths adding up to no more than `len`.
 * Anchors are in each body's own frame.
 */
export type Joint = {
  k: 'hinge' | 'rope' | 'pulley'; A: Body; B: Body;
  ax: number; ay: number; bx: number; by: number; len: number;
  g1x: number; g1y: number; g2x: number; g2y: number;
  lo: number; hi: number; ref: number;
  px: number; py: number; p: number; pl: number; pu: number;
  /** Set when a string is cut or burnt: the joint is gone. */
  off: boolean;
};

function soft(hz: number, zeta: number, h: number): Soft {
  if (hz === 0) return { bias: 0, ms: 1, is: 0 };
  const om = 2 * Math.PI * hz, a1 = 2 * zeta + h * om, a2 = h * om * a1, a3 = 1 / (1 + a2);
  return { bias: om / a1, ms: a2 * a3, is: a3 };
}

/** Two contact points solved together (a small LCP, as in Box2D), so a piece landing flat stays flat. Targets come from BI, MS, IS. */
function block(c: Contact, k: number[]) {
  const { A, B, nx, ny } = c;
  // two points solved together (a small LCP), so a piece landing flat stays flat
  const p1 = c.pts[0], p2 = c.pts[1], a1 = p1.pn, a2 = p2.pn;
  const v1 = (B.vx - B.w * p1.rby - A.vx + A.w * p1.ray) * nx + (B.vy + B.w * p1.rbx - A.vy - A.w * p1.rax) * ny + BI[0];
  const v2 = (B.vx - B.w * p2.rby - A.vx + A.w * p2.ray) * nx + (B.vy + B.w * p2.rbx - A.vy - A.w * p2.rax) * ny + BI[1];
  const b1 = v1 - (k[0] * a1 + k[1] * a2), b2 = v2 - (k[1] * a1 + k[2] * a2);
  let x1 = 0, x2 = 0;
  const d1 = -(k[2] * b1 - k[1] * b2) * k[3], d2 = -(k[0] * b2 - k[1] * b1) * k[3];
  if (d1 >= 0 && d2 >= 0) { x1 = d1; x2 = d2; }
  else if (-b1 / k[0] >= 0 && k[1] * (-b1 / k[0]) + b2 >= 0) { x1 = -b1 / k[0]; }
  else if (-b2 / k[2] >= 0 && k[1] * (-b2 / k[2]) + b1 >= 0) { x2 = -b2 / k[2]; }
  else if (!(b1 >= 0 && b2 >= 0)) { x1 = a1; x2 = a2; }
  const n1 = Math.max(0, a1 + MS[0] * (x1 - a1) - IS[0] * a1), n2 = Math.max(0, a2 + MS[1] * (x2 - a2) - IS[1] * a2);
  const P1 = n1 - a1, P2 = n2 - a2; p1.pn = n1; p2.pn = n2;
  if (P1 > p1.maxPn) p1.maxPn = P1; if (P2 > p2.maxPn) p2.maxPn = P2;
  const Px = (P1 + P2) * nx, Py = (P1 + P2) * ny;
  A.vx -= A.im * Px; A.vy -= A.im * Py; B.vx += B.im * Px; B.vy += B.im * Py;
  A.w -= A.iI * ((p1.rax * ny - p1.ray * nx) * P1 + (p2.rax * ny - p2.ray * nx) * P2);
  B.w += B.iI * ((p1.rbx * ny - p1.rby * nx) * P1 + (p2.rbx * ny - p2.rby * nx) * P2);
}

export class World {
  bodies: Body[] = [];
  joints: Joint[] = [];
  contacts: Contact[] = [];
  gravity = GRAVITY;
  private cache = new Map<number, CPoint[]>();
  private nextId = 1;
  /** Steps taken so far. */
  steps = 0;
  /** Sideways acceleration every dynamic body feels this step (the floor shaking), and a wind force per unit height. */
  shake = 0;
  private readonly hsub = DT / SUBSTEPS;
  private readonly softC = soft(Math.min(CONTACT_HZ, 0.25 * SUBSTEPS / DT), CONTACT_ZETA, DT / SUBSTEPS);
  private readonly softS = soft(2 * Math.min(CONTACT_HZ, 0.25 * SUBSTEPS / DT), CONTACT_ZETA, DT / SUBSTEPS);
  private readonly softJ = soft(2 * Math.min(CONTACT_HZ, 0.25 * SUBSTEPS / DT), JOINT_ZETA, DT / SUBSTEPS);

  add(shapes: Shape[], o: BodyOpts, x = 0, y = 0, a = 0): Body {
    const b = new Body(this.nextId++, shapes, o); b.x = x; b.y = y; b.a = a; b.sync(); this.bodies.push(b); return b;
  }
  remove(b: Body) {
    this.bodies = this.bodies.filter((o) => o !== b);
    for (const j of this.joints) if (j.A === b || j.B === b) j.off = true;
  }
  private joint(k: Joint['k'], A: Body, B: Body, wx: number, wy: number, vx: number, vy: number): Joint {
    const la = local(A, wx, wy), lb = local(B, vx, vy);
    const j: Joint = { k, A, B, ax: la[0], ay: la[1], bx: lb[0], by: lb[1], len: 0, g1x: 0, g1y: 0, g2x: 0, g2y: 0, lo: 1, hi: 0, ref: B.a - A.a, px: 0, py: 0, p: 0, pl: 0, pu: 0, off: false };
    this.joints.push(j); return j;
  }
  /** A split pin at world point (x, y), joining A and B there; B may turn against A between lo and hi (radians from now) when given. */
  hinge(A: Body, B: Body, x: number, y: number, lo?: number, hi?: number): Joint {
    const j = this.joint('hinge', A, B, x, y, x, y); if (lo !== undefined && hi !== undefined) { j.lo = lo; j.hi = hi; } return j;
  }
  /** A string from world point a on A to world point b on B, as long as `len` (default: as far apart as they are). */
  rope(A: Body, ax: number, ay: number, B: Body, bx: number, by: number, len?: number): Joint {
    const j = this.joint('rope', A, B, ax, ay, bx, by); j.len = len ?? Math.hypot(bx - ax, by - ay); return j;
  }
  /** A cord over two fixed wheels: from world point a on A up to wheel 1, across to wheel 2 and down to world point b on B. */
  pulley(A: Body, ax: number, ay: number, g1x: number, g1y: number, B: Body, bx: number, by: number, g2x: number, g2y: number): Joint {
    const j = this.joint('pulley', A, B, ax, ay, bx, by);
    j.g1x = g1x; j.g1y = g1y; j.g2x = g2x; j.g2y = g2y; j.len = Math.hypot(ax - g1x, ay - g1y) + Math.hypot(bx - g2x, by - g2y);
    return j;
  }
  /** World positions of a joint's two anchors. */
  ends(j: Joint): [number, number, number, number] {
    const A = j.A, B = j.B;
    return [A.x + A.c * j.ax - A.s * j.ay, A.y + A.s * j.ax + A.c * j.ay, B.x + B.c * j.bx - B.s * j.by, B.y + B.s * j.bx + B.c * j.by];
  }

  private collide() {
    const bs = this.bodies, out: Contact[] = [], next = new Map<number, CPoint[]>();
    for (let i = 0; i < bs.length; i++) {
      const A = bs[i];
      for (let j = i + 1; j < bs.length; j++) {
        const B = bs[j];
        if (A.isStatic && B.isStatic) continue;
        if ((A.group && A.group === B.group) || A.sensor || B.sensor) continue;
        // speculative margin: far enough to catch anything this pair could close in one step
        const M = SPECULATIVE + DT * (A.reach + B.reach);
        if (A.maxX + M < B.minX || B.maxX + M < A.minX || A.maxY + M < B.minY || B.maxY + M < A.minY) continue;
        for (let sa = 0; sa < A.shapes.length; sa++) for (let sb = 0; sb < B.shapes.length; sb++) {
          const m = collideShapes(A, sa, B, sb, M); if (!m) continue;
          const key = ((A.id * 4096 + B.id) * 8 + sa) * 8 + sb, old = this.cache.get(key);
          const pts: CPoint[] = m.pts.map((p) => {
            const o = old?.find((q) => q.id === p.id);
            return { id: p.id, rax: p.x - A.x, ray: p.y - A.y, rbx: p.x - B.x, rby: p.y - B.y, adj: 0, nm: 0, tm: 0, pn: o ? o.pn : 0, pt: o ? o.pt : 0, maxPn: 0, rel: 0, sep: p.sep };
          });
          next.set(key, pts);
          out.push({ key, A, B, nx: m.nx, ny: m.ny, f: Math.sqrt(A.friction * B.friction), e: Math.max(A.restitution, B.restitution), pts, soft: A.isStatic || B.isStatic ? this.softS : this.softC, k: null, fresh: !old });
        }
      }
    }
    this.cache = next; this.contacts = out;
  }

  private prepare() {
    for (const c of this.contacts) {
      const { A, B, nx, ny } = c, tx = ny, ty = -nx;
      for (const p of c.pts) {
        p.adj = p.sep - ((p.rbx - p.rax) * nx + (p.rby - p.ray) * ny);
        const rna = p.rax * ny - p.ray * nx, rnb = p.rbx * ny - p.rby * nx;
        const kn = A.im + B.im + A.iI * rna * rna + B.iI * rnb * rnb; p.nm = kn > 0 ? 1 / kn : 0;
        const rta = p.rax * ty - p.ray * tx, rtb = p.rbx * ty - p.rby * tx;
        const kt = A.im + B.im + A.iI * rta * rta + B.iI * rtb * rtb; p.tm = kt > 0 ? 1 / kt : 0;
        const dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
        p.rel = dvx * nx + dvy * ny; p.maxPn = 0;
      }
      c.k = null;
      if (c.pts.length === 2) {
        const p = c.pts[0], q = c.pts[1];
        const a1 = p.rax * ny - p.ray * nx, b1 = p.rbx * ny - p.rby * nx, a2 = q.rax * ny - q.ray * nx, b2 = q.rbx * ny - q.rby * nx, m = A.im + B.im;
        const k11 = m + A.iI * a1 * a1 + B.iI * b1 * b1, k22 = m + A.iI * a2 * a2 + B.iI * b2 * b2, k12 = m + A.iI * a1 * a2 + B.iI * b1 * b2, det = k11 * k22 - k12 * k12;
        if (k11 * k11 < 1000 * det) c.k = [k11, k12, k22, 1 / det];
      }
    }
  }

  private warm() {
    for (const c of this.contacts) {
      const { A, B, nx, ny } = c, tx = ny, ty = -nx;
      for (const p of c.pts) {
        const Px = p.pn * nx + p.pt * tx, Py = p.pn * ny + p.pt * ty;
        A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * (p.rax * Py - p.ray * Px);
        B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * (p.rbx * Py - p.rby * Px);
      }
    }
    for (const j of this.joints) if (!j.off) this.warmJoint(j);
  }

  /** The world arms of a joint's anchors from each body's centre. */
  private arms(j: Joint) {
    const A = j.A, B = j.B;
    return [A.c * j.ax - A.s * j.ay, A.s * j.ax + A.c * j.ay, B.c * j.bx - B.s * j.by, B.s * j.bx + B.c * j.by];
  }
  private warmJoint(j: Joint) {
    const A = j.A, B = j.B, [rax, ray, rbx, rby] = this.arms(j);
    if (j.k === 'hinge') {
      A.vx -= A.im * j.px; A.vy -= A.im * j.py; A.w -= A.iI * (rax * j.py - ray * j.px);
      B.vx += B.im * j.px; B.vy += B.im * j.py; B.w += B.iI * (rbx * j.py - rby * j.px);
      const L = j.pl + j.pu; A.w -= A.iI * L; B.w += B.iI * L;
      return;
    }
    const u = this.axes(j, rax, ray, rbx, rby);
    A.vx += A.im * j.p * u[0]; A.vy += A.im * j.p * u[1]; A.w += A.iI * j.p * (rax * u[1] - ray * u[0]);
    B.vx += B.im * j.p * u[2]; B.vy += B.im * j.p * u[3]; B.w += B.iI * j.p * (rbx * u[3] - rby * u[2]);
  }
  /** For a string or cord: the directions in which each end's impulse acts (unit vectors), and how far over length it is. */
  private axes(j: Joint, rax: number, ray: number, rbx: number, rby: number): [number, number, number, number, number] {
    const pax = j.A.x + rax, pay = j.A.y + ray, pbx = j.B.x + rbx, pby = j.B.y + rby;
    if (j.k === 'rope') {
      const dx = pbx - pax, dy = pby - pay, d = Math.hypot(dx, dy) || 1e-9, ux = dx / d, uy = dy / d;
      // a string pulls B back toward A and A toward B: impulse λ ≤ 0 along +u on B and −u on A
      return [-ux, -uy, ux, uy, d - j.len];
    }
    const ax = pax - j.g1x, ay = pay - j.g1y, la = Math.hypot(ax, ay) || 1e-9, bx = pbx - j.g2x, by = pby - j.g2y, lb = Math.hypot(bx, by) || 1e-9;
    return [ax / la, ay / la, bx / lb, by / lb, la + lb - j.len];
  }
  private solveJoint(j: Joint, useBias: boolean, ih: number) {
    const A = j.A, B = j.B, [rax, ray, rbx, rby] = this.arms(j), sj = this.softJ;
    if (j.k === 'hinge') {
      // the stops first, then the pin
      if (j.lo <= j.hi) {
        const turn = B.a - A.a - j.ref, k = A.iI + B.iI, am = k > 0 ? 1 / k : 0;
        for (const lower of [true, false]) {
          const C = lower ? turn - j.lo : j.hi - turn;
          let bias = 0, ms = 1, is = 0;
          if (C > 0) bias = C * ih; else if (useBias) { bias = sj.bias * C; ms = sj.ms; is = sj.is; }
          const cd = lower ? B.w - A.w : A.w - B.w, acc = lower ? j.pl : -j.pu;
          let P = -am * ms * (cd + bias) - is * acc; const n = Math.max(acc + P, 0); P = n - acc;
          if (lower) { j.pl = n; A.w -= A.iI * P; B.w += B.iI * P; } else { j.pu = -n; A.w += A.iI * P; B.w -= B.iI * P; }
        }
      }
      const Cx = B.x + rbx - A.x - rax, Cy = B.y + rby - A.y - ray;
      const dvx = B.vx - B.w * rby - A.vx + A.w * ray, dvy = B.vy + B.w * rbx - A.vy - A.w * rax;
      let bx = 0, by = 0, ms = 1, is = 0;
      if (useBias) { bx = sj.bias * Cx; by = sj.bias * Cy; ms = sj.ms; is = sj.is; }
      const m = A.im + B.im, k11 = m + A.iI * ray * ray + B.iI * rby * rby, k12 = -A.iI * rax * ray - B.iI * rbx * rby, k22 = m + A.iI * rax * rax + B.iI * rbx * rbx;
      const det = k11 * k22 - k12 * k12; if (det <= 0) return;
      const rx = dvx + bx, ry = dvy + by, sx = (k22 * rx - k12 * ry) / det, sy = (k11 * ry - k12 * rx) / det;
      const Px = -ms * sx - is * j.px, Py = -ms * sy - is * j.py;
      j.px += Px; j.py += Py;
      A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * (rax * Py - ray * Px);
      B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * (rbx * Py - rby * Px);
      return;
    }
    const [uax, uay, ubx, uby, C] = this.axes(j, rax, ray, rbx, rby);
    const ca = rax * uay - ray * uax, cb = rbx * uby - rby * ubx;
    const k = A.im + B.im + A.iI * ca * ca + B.iI * cb * cb; if (k <= 0) return;
    // how fast the cord is lengthening
    const cd = (A.vx - A.w * ray) * uax + (A.vy + A.w * rax) * uay + (B.vx - B.w * rby) * ubx + (B.vy + B.w * rbx) * uby;
    let bias = 0, ms = 1, is = 0;
    if (C < 0) bias = C * ih; else if (useBias) { bias = sj.bias * C; ms = sj.ms; is = sj.is; }
    let P = (-ms * (cd + bias)) / k - is * j.p; const n = Math.min(j.p + P, 0); P = n - j.p; j.p = n;
    A.vx += A.im * P * uax; A.vy += A.im * P * uay; A.w += A.iI * P * ca;
    B.vx += B.im * P * ubx; B.vy += B.im * P * uby; B.w += B.iI * P * cb;
  }

  private flip = false;
  private solve(useBias: boolean) {
    this.flip = !this.flip;
    const ih = 1 / this.hsub;
    for (const j of this.joints) if (!j.off) this.solveJoint(j, useBias, ih);
    for (const c of this.contacts) {
      const { A, B, nx, ny } = c, tx = ny, ty = -nx;
      const ca = Math.cos(A.da), sa = Math.sin(A.da), cb = Math.cos(B.da), sb = Math.sin(B.da);
      const np = c.pts.length;
      for (let i = 0; i < np; i++) {
        const p = c.pts[i];
        const pax = ca * p.rax - sa * p.ray, pay = sa * p.rax + ca * p.ray, pbx = cb * p.rbx - sb * p.rby, pby = sb * p.rbx + cb * p.rby;
        const s = (B.dpx - A.dpx + pbx - pax) * nx + (B.dpy - A.dpy + pby - pay) * ny + p.adj;
        let bias = 0, ms = 1, is = 0;
        if (s > 0) bias = s * ih;
        else if (useBias) { bias = Math.max(c.soft.bias * s, -PUSH_MAX); ms = c.soft.ms; is = c.soft.is; }
        BI[i] = bias; MS[i] = ms; IS[i] = is;
      }
      const k = c.k;
      if (np === 2 && k && (c.pts[0].rel < -0.5 || c.pts[1].rel < -0.5)) {
        block(c, k);
      } else for (let j = 0; j < np; j++) {
        // alternate which point goes first, so neither side of a flat landing gets all the push
        const i = this.flip ? np - 1 - j : j, p = c.pts[i];
        const dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
        let P = -p.nm * MS[i] * (dvx * nx + dvy * ny + BI[i]) - IS[i] * p.pn;
        const nn = Math.max(p.pn + P, 0); P = nn - p.pn; p.pn = nn; if (P > p.maxPn) p.maxPn = P;
        const Px = P * nx, Py = P * ny;
        A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * (p.rax * Py - p.ray * Px);
        B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * (p.rbx * Py - p.rby * Px);
      }
      for (const p of c.pts) {
        const dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
        const vt = dvx * tx + dvy * ty, lim = c.f * p.pn;
        let P = -p.tm * vt; const np = Math.max(-lim, Math.min(lim, p.pt + P)); P = np - p.pt; p.pt = np;
        const Px = P * tx, Py = P * ty;
        A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * (p.rax * Py - p.ray * Px);
        B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * (p.rbx * Py - p.rby * Px);
      }
    }
  }

  private restitution() {
    for (const c of this.contacts) {
      if (c.e === 0) continue;
      const { A, B, nx, ny } = c;
      if (c.k && c.pts.every((p) => p.rel <= -BOUNCE_MIN && p.maxPn > 0)) {
        BI[0] = c.e * c.pts[0].rel; BI[1] = c.e * c.pts[1].rel; MS[0] = MS[1] = 1; IS[0] = IS[1] = 0;
        block(c, c.k); continue;
      }
      for (const p of c.pts) {
        if (p.rel > -BOUNCE_MIN || p.maxPn === 0) continue;
        const dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
        const vn = dvx * nx + dvy * ny;
        let P = -p.nm * (vn + c.e * p.rel); const np = Math.max(p.pn + P, 0); P = np - p.pn; p.pn = np;
        const Px = P * nx, Py = P * ny;
        A.vx -= A.im * Px; A.vy -= A.im * Py; A.w -= A.iI * (p.rax * Py - p.ray * Px);
        B.vx += B.im * Px; B.vy += B.im * Py; B.w += B.iI * (p.rbx * Py - p.rby * Px);
      }
    }
  }

  /** One fixed step of 1/60 s. */
  step() {
    const h = this.hsub, bs = this.bodies;
    this.collide(); this.prepare();
    for (const b of bs) { b.dpx = 0; b.dpy = 0; b.da = 0; }
    for (let k = 0; k < SUBSTEPS; k++) {
      for (const b of bs) {
        if (b.isStatic) continue;
        b.vx += h * (this.shake + b.im * b.fx); b.vy += h * (-this.gravity * b.gs + b.im * b.fy); b.w += 0;
        b.vx /= 1 + h * b.linDamp; b.vy /= 1 + h * b.linDamp; b.w /= 1 + h * b.angDamp;
        const sp = Math.hypot(b.vx, b.vy); if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
      }
      this.warm();
      for (let i = 0; i < ITERS; i++) this.solve(true);
      for (const b of bs) {
        if (b.isStatic) continue;
        b.x += h * b.vx; b.y += h * b.vy; b.a += h * b.w; b.dpx += h * b.vx; b.dpy += h * b.vy; b.da += h * b.w;
      }
      for (const b of bs) b.sync();
      for (let i = 0; i < RELAX; i++) this.solve(false);
    }
    this.restitution();
    for (const b of bs) { b.load = 0; b.hit = 0; b.fx = 0; b.fy = 0; }
    const g = this.gravity * DT / SUBSTEPS;
    for (const c of this.contacts) {
      let P = 0, hit = 0; for (const p of c.pts) { P += p.pn; hit = Math.max(hit, -p.rel); }
      const w = P / g;
      if (c.ny > 0.4) c.A.load += w * c.ny; else if (c.ny < -0.4) c.B.load += -w * c.ny;
      if (hit > c.A.hit) c.A.hit = hit; if (hit > c.B.hit) c.B.hit = hit;
    }
    this.steps++;
  }

  /** Kinetic plus potential energy of every moving body. */
  energy() {
    let e = 0;
    for (const b of this.bodies) if (!b.isStatic) e += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy) + 0.5 * b.I * b.w * b.w + b.m * this.gravity * b.gs * b.y;
    return e;
  }
  /** The fastest-moving body's speed, for deciding when things have settled. */
  motion() { let m = 0; for (const b of this.bodies) if (!b.isStatic) m = Math.max(m, b.speed()); return m; }
}

/** A world point in a body's own frame. */
function local(b: Body, x: number, y: number): [number, number] {
  const dx = x - b.x, dy = y - b.y;
  return [b.c * dx + b.s * dy, -b.s * dx + b.c * dy];
}

/** Whether two bodies come within `gap` of each other. */
export function near(A: Body, B: Body, gap: number): boolean {
  if (A.maxX + gap < B.minX || B.maxX + gap < A.minX || A.maxY + gap < B.minY || B.maxY + gap < A.minY) return false;
  for (let sa = 0; sa < A.shapes.length; sa++) for (let sb = 0; sb < B.shapes.length; sb++) {
    const m = collideShapes(A, sa, B, sb, gap); if (m && m.pts.some((p) => p.sep < gap)) return true;
  }
  return false;
}
/** How far two bodies overlap (the deepest contact, as a positive depth), or 0 when they don't touch: for placing parts. */
export function overlap(A: Body, B: Body): number {
  if (A.maxX < B.minX || B.maxX < A.minX || A.maxY < B.minY || B.maxY < A.minY) return 0;
  let worst = 0;
  for (let sa = 0; sa < A.shapes.length; sa++) for (let sb = 0; sb < B.shapes.length; sb++) {
    const m = collideShapes(A, sa, B, sb, 0); if (!m) continue;
    for (const p of m.pts) if (-p.sep > worst) worst = -p.sep;
  }
  return worst;
}

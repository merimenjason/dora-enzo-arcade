// Kiln & Clay's rules: the wheel and the clay, glazing, the kiln, scoring, the week of orders and saving.
// Deterministic with no DOM: the wheel is fed pointer samples (press, move, release, water, speed, trim) on fixed
// 1/60 s steps, so the same samples always throw the same pot; the kiln's flicker comes from a seeded generator.
//
// The clay is a stack of rings from the wheel head up. Each ring has an outer radius R and a clay area A (R² − Ri²,
// over π), and each gap between two rings holds a fixed amount of clay. The heights are worked out from those amounts,
// so clay is never made or lost: squeeze a ring thinner and the clay above it rises; swell it out and the wall thins.
// A finger pressed inside the pot (or down into the middle of the lump) opens it and pushes the wall out; a finger
// outside pushes the wall in; either one sliding upward along the wall thins it and raises it. Walls pulled too thin,
// too tall for their thickness, or flared out too far collapse ("flump"), and the clay slumps back into a lump.
import {
  GLAZES, GLAZE_IDS, ORDERS, ORDER_IDS, DAY_COUNT, FINALE, UPGRADES, UPGRADE_IDS, HANDLE_IDS, CUSTOMERS,
  type Shape, type GlazeId, type GlazeAsk, type Family, type Order, type UpgradeId, type HandleId, type PartId,
} from './pottery-orders.js';
export * from './pottery-orders.js';

export const DT = 1 / 60;
/** The wheel head's radius, in clay units. */
export const WHEEL_R = 12;
/** The thinnest a floor may be opened to. */
export const MIN_FLOOR = 0.5;
/** Wheel speeds: stopped, slow, medium, fast. */
export const SPEEDS = [0, 0.45, 0.72, 1] as const;
const MAX_DY = 0.3, MIN_DY = 0.06, MAX_RINGS = 140;
const SHAPE_RATE = 5.5, OPEN_RATE = 3.2, LIFT_RATE = 0.105, GAP = 0.28, FLAT_RATE = 0.9;
const T_MIN = 0.16, TALL_K = 75, OVER_K = 12;

export type Ring = { R: number; A: number };
export type WheelOpts = { quiet?: boolean; sponge?: boolean; solid?: boolean };
export type Mode = 'centre' | 'inside' | 'outside';
export type Finger = { x: number; y: number; py: number; vy: number; mode: Mode | null };
export type WheelEv = { k: 'centred' | 'opened' | 'flump' | 'wobble' | 'water' | 'trim' | 'relump' | 'dry' };
/** One input to the wheel, stamped with the step it happens on. */
export type Input = { f: number; k: 'down' | 'move' | 'up' | 'water' | 'speed' | 'trim'; x?: number; y?: number; v?: number };
/** A pot's shape, sampled at evenly spaced heights: outer radius r, inner radius ri (0 where solid). */
export type Profile = { h: number; r: number[]; ri: number[]; floor: number };
export const PROFILE_N = 33;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
const innerOf = (g: Ring) => Math.sqrt(Math.max(0, g.R * g.R - g.A));

/** The outer radius of a shape at a height (smoothly between its points); 0 above the top. */
export function shapeR(s: Shape, y: number): number {
  if (y < 0 || y > s.h + 1e-9) return 0;
  const u = y / s.h, p = s.pts;
  if (u <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [u0, r0] = p[i], [u1, r1] = p[i + 1];
    if (u <= u1) return r0 + (r1 - r0) * ease((u - u0) / Math.max(1e-6, u1 - u0));
  }
  return p[p.length - 1][1];
}
export const shapeMaxR = (s: Shape) => Math.max(...s.pts.map((p) => p[1]));
/** How much clay (area × height, over π) a shape needs with even walls of a given thickness. */
export function shapeClay(s: Shape, wall = 0.45, floor = 0.7): number {
  let v = 0; const n = 200;
  for (let i = 0; i < n; i++) {
    const y = ((i + 0.5) / n) * s.h, R = shapeR(s, y);
    v += (s.hollow && y > floor ? R * R - Math.max(0, R - wall) ** 2 : R * R) * (s.h / n);
  }
  return v;
}
/** The clay a customer's part is thrown from: enough for the shape, with a little to spare (trim the rest). */
export const clayFor = (s: Shape) => Math.round(shapeClay(s) * (s.hollow ? 1.22 : 1.12) * 100) / 100;

// ---------------------------------------------------------------- the wheel
export class Wheel {
  rings: Ring[] = []; vol: number[] = []; ys: number[] = [];
  centred = 0; wet = 0.62; speed = 2;
  finger: Finger | null = null;
  strain = 0; over = 0; flumps = 0; slump = -1; touched = 0; t = 0; frame = 0;
  opened = false; lastWobble = false;
  events: WheelEv[] = [];
  /** The pot as it was when it collapsed, so the scene can show the slump. */
  slumped: Profile | null = null;
  readonly sigma: number; readonly quiet: boolean; readonly sponge: boolean;
  /** A solid piece (a lid): pressing down on the middle flattens and spreads it instead of opening it. */
  readonly solid: boolean;
  constructor(readonly clay: number, opts: WheelOpts = {}) {
    this.quiet = !!opts.quiet; this.sponge = !!opts.sponge; this.solid = !!opts.solid; this.sigma = this.quiet ? 0.48 : 0.62;
    this.lump(clay);
  }
  /** A fresh lump of a given amount of clay, slapped onto the middle of the wheel. */
  private lump(v: number) {
    const R0 = Math.cbrt(v / 1.02), H0 = R0 * 1.1, n = 18;
    this.rings = []; this.ys = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), y = u * H0;
      const r = R0 * (u < 0.7 ? 0.93 + 0.07 * Math.min(1, u / 0.15) : Math.sqrt(1 - ((u - 0.7) / 0.3) ** 2 * 0.6));
      this.rings.push({ R: r, A: r * r }); this.ys.push(y);
    }
    this.vol = [];
    for (let i = 0; i < n - 1; i++) this.vol.push(((this.rings[i].A + this.rings[i + 1].A) / 2) * (this.ys[i + 1] - this.ys[i]));
    const k = v / this.vol.reduce((a, b) => a + b, 0);
    this.vol = this.vol.map((x) => x * k);
    this.opened = false; this.heights();
  }
  get top() { return this.ys[this.ys.length - 1]; }
  get clayLeft() { return this.vol.reduce((a, b) => a + b, 0); }
  get maxR() { let m = 0; for (const g of this.rings) m = Math.max(m, g.R); return m; }
  get spinning() { return this.speed > 0; }
  private heights() {
    const r = this.rings, ys = this.ys; ys.length = r.length; ys[0] = 0;
    for (let i = 0; i < r.length - 1; i++) ys[i + 1] = ys[i] + this.vol[i] / Math.max(0.02, (r[i].A + r[i + 1].A) / 2);
  }
  /** The ring index below a height and how far towards the next one, or null above the top. */
  private seg(y: number): [number, number] | null {
    const ys = this.ys; if (y > this.top || y < 0) return null;
    for (let i = 0; i < ys.length - 1; i++) if (y <= ys[i + 1]) return [i, (y - ys[i]) / Math.max(1e-9, ys[i + 1] - ys[i])];
    return [ys.length - 2, 1];
  }
  /** Outer and inner radius at a height (0, 0 above the top). */
  at(y: number): { R: number; Ri: number } {
    const s = this.seg(y); if (!s) return { R: 0, Ri: 0 };
    const [i, f] = s, a = this.rings[i], b = this.rings[i + 1];
    return { R: a.R + (b.R - a.R) * f, Ri: innerOf(a) + (innerOf(b) - innerOf(a)) * f };
  }
  radiusAt(y: number) { return this.at(y).R; }
  /** Where the inside floor is: the height of the lowest hollow ring, or the top if the lump isn't opened. */
  get floor() { for (let i = 0; i < this.rings.length; i++) if (innerOf(this.rings[i]) > 0.2) return this.ys[i]; return this.top; }
  /** Wall thickness of each hollow ring. */
  walls(): number[] { const o: number[] = []; for (const g of this.rings) { const ri = innerOf(g); if (ri > 0.2) o.push(g.R - ri); } return o; }

  // ---- input
  apply(e: Input) {
    if (e.k === 'down') this.press(e.x ?? 0, e.y ?? 0);
    else if (e.k === 'move') this.move(e.x ?? 0, e.y ?? 0);
    else if (e.k === 'up') this.release();
    else if (e.k === 'water') this.water();
    else if (e.k === 'speed') this.setSpeed(e.v ?? 2);
    else if (e.k === 'trim') this.trim(e.y ?? 0);
  }
  /** What a finger pressed here would do. */
  modeAt(x: number, y: number): Mode | null {
    const X = Math.abs(x), top = this.top;
    if (this.slump >= 0) return null;
    if (X > this.maxR + 3.5 || y > top + 3 || y < -1.5) return null;
    if (this.centred < 1) return 'centre';
    if (y >= top) { const ri = innerOf(this.rings[this.rings.length - 1]); return X < Math.max(ri + 0.1, this.opened ? 0 : this.radiusAt(top) * 0.55 + 0.4) ? 'inside' : 'outside'; }
    const { R, Ri } = this.at(Math.max(0, y));
    if (Ri > 0.2) return X < (R + Ri) / 2 ? 'inside' : 'outside';
    return X < R * 0.45 ? 'inside' : 'outside';
  }
  press(x: number, y: number) { this.finger = { x, y, py: y, vy: 0, mode: this.modeAt(x, y) }; }
  move(x: number, y: number) {
    const f = this.finger; if (!f) return;
    f.x = x; f.y = y;
    // a finger that pressed beside the pot and slides onto it starts working from outside
    if (!f.mode && this.slump < 0) { const m = this.modeAt(x, y); if (m && (m === 'centre' || m === 'outside')) f.mode = m; }
  }
  release() { this.finger = null; }
  water() { if (this.slump >= 0) return; this.wet = Math.min(1, this.wet + 0.2); this.events.push({ k: 'water' }); }
  setSpeed(v: number) { this.speed = clamp(Math.round(v), 0, 3); }
  /** Cuts the pot off level at a height (the clay above is lifted away). */
  trim(y: number): boolean {
    if (this.slump >= 0 || (!this.opened && !this.solid) || y < (this.solid ? 0.5 : this.floor + 0.6) || y >= this.top - 0.05) return false;
    const s = this.seg(y); if (!s) return false;
    const [i, f] = s, a = this.rings[i], b = this.rings[i + 1];
    const g: Ring = { R: a.R + (b.R - a.R) * f, A: a.A + (b.A - a.A) * f };
    this.rings.length = i + 1; this.rings.push(g);
    this.vol.length = i; this.vol.push(((a.A + g.A) / 2) * (y - this.ys[i]));
    if (this.vol[i] < 1e-4) { this.rings.splice(i, 1); this.vol.splice(i, 1); if (this.vol.length === 0) { this.lump(Math.max(1, this.clay * 0.2)); } }
    this.heights(); this.events.push({ k: 'trim' });
    return true;
  }

  // ---- the simulation step
  step() {
    this.t += DT; this.frame++;
    if (this.slump >= 0) {
      this.slump += DT;
      if (this.slump >= 1.1) { this.slump = -1; this.lump(this.clayLeft); this.centred = 0.4; this.wet = Math.max(this.wet, 0.55); this.strain = 0; this.over = 0; this.events.push({ k: 'relump' }); }
      return;
    }
    const f = this.finger, sp = SPEEDS[this.speed];
    let touching = false;
    if (f) {
      const inst = (f.y - f.py) / DT; f.vy = f.vy * 0.75 + inst * 0.25; f.py = f.y;
      if (sp > 0 && f.mode) {
        const wetF = this.wet < 0.3 ? 0.45 + (this.wet / 0.3) * 0.55 : this.wet > 0.85 ? 1.15 : 1;
        const spF = 0.25 + 0.75 * sp, k0 = SHAPE_RATE * spF * wetF * DT;
        if (f.mode === 'centre') {
          if (Math.abs(f.x) < this.maxR + 2.5 && f.y < this.top + 2.5) {
            touching = true;
            const was = this.centred; this.centred = Math.min(1, this.centred + 0.8 * (0.3 + 0.7 * sp) * DT);
            if (was < 1 && this.centred >= 1) this.events.push({ k: 'centred' });
          }
        } else if (f.mode === 'inside') touching = this.inside(f, k0, spF);
        else touching = this.outside(f, k0, spF);
      }
    }
    if (touching) this.touched += DT;
    const wasDry = this.wet < 0.3;
    if (sp > 0) this.wet = Math.max(0, this.wet - (0.007 + (touching ? 0.024 : 0)) * (this.sponge ? 0.6 : 1) * DT);
    if (!wasDry && this.wet < 0.3) this.events.push({ k: 'dry' });
    this.heights(); this.refine(); this.heights();
    if (!this.opened && this.floor < this.top - 1) { this.opened = true; this.events.push({ k: 'opened' }); }
    this.strain = this.measure();
    const wob = this.strain > 0.7;
    if (wob && !this.lastWobble) this.events.push({ k: 'wobble' });
    this.lastWobble = wob;
    if (this.strain >= 1) { this.over += DT; if (this.over >= 0.25) this.collapse(); }
    else this.over = Math.max(0, this.over - DT);
  }
  /** How much of a touch reaches a ring: full under the fingertip, falling away quickly beyond it. */
  private g(y: number, fy: number) { const d = (y - fy) / this.sigma, d2 = d * d; return Math.exp(-d2 * d2); }
  /** A finger inside the pot: opens the lump, deepens the floor, pushes the wall out, and lifts it when sliding up. */
  private inside(f: Finger, k0: number, spF: number): boolean {
    const X = Math.abs(f.x), fy = f.y, top = this.top, fl = this.floor;
    let touch = false;
    if (this.solid) return this.flatten(f, spF);
    // opening and deepening: pressing down below the current floor (or into the top of an unopened lump); the clay
    // pushed out of the way goes up into the walls
    const target = Math.max(MIN_FLOOR, fy);
    if (target < fl - 0.02 && fy < top + 2.5) {
      touch = true;
      const k = Math.min(1, OPEN_RATE * spF * DT * (this.wet < 0.3 ? 0.6 : 1));
      for (let i = 0; i < this.rings.length; i++) {
        if (this.ys[i] < target) continue;
        const g = this.rings[i], ri = innerOf(g), want = Math.min(Math.max(X, 0.55), g.R - 0.5);
        if (ri >= want || want < 0.3) continue;
        const nr = ri + (want - ri) * k; g.A = g.R * g.R - nr * nr;
      }
    }
    // pushing the wall out from inside
    for (let i = 0; i < this.rings.length; i++) {
      const g = this.rings[i], ri = innerOf(g); if (ri < 0.2) continue;
      const w = this.g(this.ys[i], fy); if (w < 0.02) continue;
      const want = Math.min(X, WHEEL_R - 0.5);
      if (ri < want) { touch = true; const nr = ri + (want - ri) * Math.min(1, k0 * w); g.R = Math.sqrt(g.A + nr * nr); }
      else if (w > 0.4 && ri < want + 0.3) touch = true;
    }
    // sliding up the inside of the wall raises it too
    if (f.vy > 0.8 && fy < top + 0.3) touch = this.lift(f, spF, false) || touch;
    return touch;
  }
  /** A finger outside the pot: pushes the wall in, and lifts it when sliding up along it. */
  private outside(f: Finger, k0: number, spF: number): boolean {
    const X = Math.max(0.45, Math.abs(f.x)), fy = f.y;
    let touch = false;
    for (let i = 0; i < this.rings.length; i++) {
      const g = this.rings[i], w = this.g(this.ys[i], fy); if (w < 0.02) continue;
      if (g.R > X) {
        touch = true;
        const nR = g.R - (g.R - X) * Math.min(1, k0 * w);
        if (nR * nR > g.A + 0.02) g.R = nR; else { g.R = nR; g.A = nR * nR; }
      } else if (w > 0.4 && g.R > X - 0.25) touch = true;
    }
    if (f.vy > 0.8 && fy <= this.top + 0.2 && X <= this.radiusAt(clamp(fy, 0, this.top)) + 0.9) touch = this.lift(f, spF, true) || touch;
    return touch;
  }
  /** Pressing down on a solid piece squashes it lower and wider. */
  private flatten(f: Finger, spF: number): boolean {
    if (f.y >= this.top - 0.05 || this.top < 0.9) return false;
    const k = FLAT_RATE * spF * DT * Math.min(1, (this.top - f.y) / 0.6);
    for (const g of this.rings) { g.A *= 1 + k; g.R = Math.sqrt(g.A); }
    return true;
  }
  /** Thins the wall where the finger is as it slides up: the clay squeezed out rises. */
  private lift(f: Finger, spF: number, outside: boolean): boolean {
    let did = false;
    for (let i = 1; i < this.rings.length; i++) {
      const g = this.rings[i], w = this.g(this.ys[i], f.y); if (w < 0.05) continue;
      const ri = innerOf(g), solid = ri < 0.2;
      if (solid && (this.opened || !outside)) continue;
      const d = Math.min(0.2, LIFT_RATE * Math.min(f.vy, 9) * DT * w * spF * (this.wet < 0.3 ? 0.5 : 1));
      did = true;
      if (solid) { g.A *= 1 - d; g.R = Math.sqrt(g.A); continue; }
      // the pinch evens the wall towards a thin gap: thick walls thin quickly, thin ones hardly at all
      const t = g.R - ri, nt = t - Math.max(0, t - GAP) * Math.min(1, d * 2.6);
      const R = g.R * (1 - (outside ? 0.15 : 0.04) * d);
      g.R = R; g.A = R * R - Math.max(0, R - Math.min(nt, R)) ** 2;
    }
    return did;
  }
  /** Splits stretched gaps and merges squashed ones, so the rings stay evenly spread. */
  private refine() {
    const r = this.rings, v = this.vol, ys = this.ys;
    for (let i = 0; i < r.length - 1 && r.length < MAX_RINGS; i++) {
      if (ys[i + 1] - ys[i] > MAX_DY) {
        const a = r[i], b = r[i + 1];
        r.splice(i + 1, 0, { R: (a.R + b.R) / 2, A: (a.A + b.A) / 2 });
        const half = v[i] / 2; v.splice(i, 1, half, half);
        ys.splice(i + 1, 0, (ys[i] + ys[i + 1]) / 2);
        i++;
      }
    }
    for (let i = 0; i < r.length - 1 && r.length > 6; i++) {
      if (ys[i + 1] - ys[i] < MIN_DY) {
        if (i + 1 < r.length - 1) { r.splice(i + 1, 1); v[i] += v[i + 1]; v.splice(i + 1, 1); ys.splice(i + 1, 1); }
        else if (i > 0) { r.splice(i, 1); v[i - 1] += v[i]; v.splice(i, 1); ys.splice(i, 1); }
      }
    }
  }
  /** How close the walls are to giving way: 1 and over, held for a moment, and they collapse. */
  measure(): number {
    const r = this.rings, ys = this.ys, n = r.length, top = this.top;
    const wetMul = this.wet > 0.85 ? 1.3 : this.wet < 0.12 ? 1.25 : 1;
    let worst = 0;
    for (let i = 0; i < n; i++) {
      const ri = innerOf(r[i]); if (ri < 0.2) continue;
      const t = Math.max(0.02, r[i].R - ri);
      const thin = T_MIN / t;
      const tall = (top - ys[i]) / (t * TALL_K);
      let M = 0;
      for (let j = i; j < n - 1; j++) { const arm = (r[j].R + r[j + 1].R) / 2 - r[i].R; if (arm > 0) M += this.vol[j] * arm; }
      const flare = M / (OVER_K * t * t * r[i].R + 1e-6);
      worst = Math.max(worst, thin, tall, flare);
    }
    const sp = SPEEDS[this.speed];
    // a fast wheel flings a wide pot outwards
    const spin = 1 + 0.6 * sp * sp * Math.max(0, (this.maxR - 4.5) / 4);
    return worst * wetMul * spin * (1 + 0.5 * (1 - this.centred)) * (this.quiet ? 0.9 : 1);
  }
  private collapse() {
    this.slumped = this.profile(); this.slump = 0; this.flumps++; this.finger = null; this.over = 0;
    this.events.push({ k: 'flump' });
  }
  /** The pot's shape sampled for drawing, scoring and saving. */
  profile(n = PROFILE_N): Profile {
    const h = this.top, r: number[] = [], ri: number[] = [];
    for (let k = 0; k < n; k++) { const s = this.at((k / (n - 1)) * h * 0.99999); r.push(s.R); ri.push(s.Ri > 0.2 ? s.Ri : 0); }
    return { h, r, ri, floor: this.floor };
  }
  /** A short fingerprint of the clay, to check two runs threw the same pot. */
  fingerprint(): string {
    return [this.rings.length, this.top.toFixed(5), ...this.rings.filter((_, i) => i % 3 === 0).map((g) => g.R.toFixed(4) + '/' + g.A.toFixed(4)), this.flumps, this.wet.toFixed(4)].join(',');
  }
}

/** Plays a list of inputs into a fresh wheel and returns it, stepped through to the last input (plus a little). */
export function replay(clay: number, inputs: readonly Input[], opts: WheelOpts = {}, tail = 30): Wheel {
  const w = new Wheel(clay, opts);
  let k = 0; const end = (inputs.length ? inputs[inputs.length - 1].f : 0) + tail;
  for (let f = 0; f <= end; f++) {
    while (k < inputs.length && inputs[k].f <= f) w.apply(inputs[k++]);
    w.step(); w.events.length = 0;
  }
  return w;
}

// ---------------------------------------------------------------- scoring a throw
export type ThrowScore = { stars: number; match: number; err: number; notes: string[] };
/** Compares a thrown pot to the shape asked for: its outline over its height, its height, and sane walls and floor. */
export function scoreProfile(p: Profile, s: Shape, opened: boolean): ThrowScore {
  const H = Math.max(s.h, p.h), n = 48;
  let sum = 0;
  const rAt = (y: number) => { if (y > p.h) return 0; const u = (y / Math.max(1e-6, p.h)) * (p.r.length - 1), i = Math.min(p.r.length - 2, Math.floor(u)), f = u - i; return p.r[i] + (p.r[i + 1] - p.r[i]) * f; };
  for (let k = 0; k <= n; k++) { const y = (k / n) * H * 0.9999; sum += Math.abs(rAt(y) - shapeR(s, y)); }
  const err = sum / (n + 1), tol = 0.5 + 0.1 * shapeMaxR(s), rel = err / tol;
  let stars = rel <= 0.55 ? 3 : rel <= 1 ? 2 : rel <= 1.7 ? 1 : 0;
  const notes: string[] = [];
  if (s.hollow) {
    if (!opened) { stars = 0; notes.push('It isn’t opened: there’s nowhere for anything to go.'); }
    else {
      if (p.floor > 1.7) { stars = Math.max(stars ? 1 : 0, stars - 1); notes.push('The floor is rather thick.'); }
      const walls = p.r.map((r, i) => (p.ri[i] > 0 ? r - p.ri[i] : -1)).filter((t) => t > 0).sort((a, b) => a - b);
      const mid = walls.length ? walls[walls.length >> 1] : 9;
      if (mid > 1.35) { stars = Math.max(stars ? 1 : 0, stars - 1); notes.push('The walls are rather heavy.'); }
    }
  }
  if (Math.abs(p.h - s.h) > s.h * 0.18 + 0.4) notes.push(p.h > s.h ? 'A little taller than asked.' : 'A little shorter than asked.');
  return { stars, match: clamp(1 - rel / 2.4, 0, 1), err, notes };
}
export const scoreThrow = (w: Wheel, s: Shape) => scoreProfile(w.profile(), s, w.opened);

// ---------------------------------------------------------------- glazing
export type Band = { u0: number; u1: number; g: GlazeId };
export type Glaze = { base: GlazeId | null; bands: Band[]; speckle: boolean; drip: GlazeId | null };
export const freshGlaze = (): Glaze => ({ base: null, bands: [], speckle: false, drip: null });
export const MAX_BANDS = 24;
/** Paints a band between two heights (fractions of the pot's height); a tiny drag makes a thin stripe. */
export function paintBand(gl: Glaze, g: GlazeId, ua: number, ub: number): Band | null {
  let u0 = clamp(Math.min(ua, ub), 0, 1), u1 = clamp(Math.max(ua, ub), 0, 1);
  if (u1 - u0 < 0.04) { const c = (u0 + u1) / 2; u0 = clamp(c - 0.025, 0, 0.95); u1 = u0 + 0.05; }
  if (gl.bands.length >= MAX_BANDS) gl.bands.shift();
  const b = { u0, u1, g }; gl.bands.push(b); return b;
}
export function dip(gl: Glaze, g: GlazeId) { gl.base = g; gl.bands = []; }
/** The colour showing at a height: the last band painted over it, or the dipped coat. */
export function glazeAt(gl: Glaze, u: number): GlazeId | null {
  for (let i = gl.bands.length - 1; i >= 0; i--) if (u >= gl.bands[i].u0 && u <= gl.bands[i].u1) return gl.bands[i].g;
  return gl.base;
}
const famOf = (g: GlazeId | null) => (g ? GLAZES[g].fam : null);
/** Separate stripes of a family in the body of the pot (not the rim or the foot), overlapping bands counted once. */
function stripes(gl: Glaze, fam: Family): number {
  let n = 0, inBand = false;
  for (let k = 0; k <= 200; k++) {
    const u = 0.12 + (k / 200) * 0.76, on = famOf(glazeAt(gl, u)) === fam && famOf(gl.base) !== fam;
    if (on && !inBand) n++;
    inBand = on;
  }
  return n;
}
export type Wish = { text: string; got: number };
/** How well a glaze meets a customer's wishes, loosely: each wish counts the same. */
export function scoreGlaze(gl: Glaze, ask: GlazeAsk): { score: number; wishes: Wish[] } {
  const w: Wish[] = [];
  const fname = (f: Family) => ({ honey: 'honey', cream: 'cream', blue: 'blue', green: 'green', pink: 'pink', purple: 'plum', black: 'charcoal' })[f];
  if (ask.all) w.push({ text: `${fname(ask.all)} all over`, got: famOf(gl.base) === ask.all ? 1 : 0 });
  if (ask.stripes) {
    const n = stripes(gl, ask.stripes.fam), want = ask.stripes.n;
    w.push({ text: `${want === 1 ? 'a' : want === 2 ? 'two' : want} ${fname(ask.stripes.fam)} stripe${want > 1 ? 's' : ''}`, got: n === want ? 1 : n > 0 && n <= want + 2 ? 0.5 : 0 });
  }
  if (ask.rim) w.push({ text: `a ${fname(ask.rim)} rim`, got: famOf(glazeAt(gl, 0.97)) === ask.rim && famOf(gl.base) !== ask.rim ? 1 : famOf(glazeAt(gl, 0.97)) === ask.rim ? 0.5 : 0 });
  if (ask.foot) w.push({ text: `a ${fname(ask.foot)} foot`, got: famOf(glazeAt(gl, 0.03)) === ask.foot ? 1 : 0 });
  if (ask.speckle) w.push({ text: 'speckles', got: gl.speckle ? 1 : 0 });
  if (ask.drip) w.push({ text: `${fname(ask.drip)} drips`, got: famOf(gl.drip) === ask.drip ? 1 : gl.drip ? 0.5 : 0 });
  const score = w.length ? w.reduce((a, b) => a + b.got, 0) / w.length : 1;
  return { score, wishes: w };
}

// ---------------------------------------------------------------- the kiln
/** A seeded generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashSeed = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export type Finish = 'shine' | 'good' | 'dull';
export type FireResult = { quality: number; finish: Finish; cracked: boolean };
export const FIRE_TIME = 13, FIRE_WARM = 2.5;
/** The firing: hold the bellows to heat the kiln and let go to cool it; keep the needle in the sweet band. */
export class Firing {
  T = 0.1; t = 0; heat = false; inBand = 0; hot = 0; gust = 0; events: { k: 'flare' | 'done' | 'enter' | 'leave' }[] = [];
  done = false; private r: () => number; private was = false; private gustT = 0;
  readonly lo: number; readonly hi: number;
  constructor(seed: number, big = false) { this.r = rng(seed); this.lo = big ? 0.555 : 0.58; this.hi = big ? 0.765 : 0.74; }
  step() {
    if (this.done) return;
    this.t += DT;
    // the fire breathes: now and then it flares up or dies back a little on its own
    this.gustT -= DT;
    if (this.gustT <= 0) { this.gustT = 0.9 + this.r() * 1.6; const g = (this.r() - 0.42) * 0.34; this.gust = g; if (g > 0.1) this.events.push({ k: 'flare' }); }
    this.gust *= 1 - 0.6 * DT;
    this.T = clamp(this.T + ((this.heat ? 0.3 : -0.19) + this.gust) * DT, 0, 1);
    if (this.t > FIRE_WARM) {
      const inside = this.T >= this.lo && this.T <= this.hi;
      if (inside) this.inBand += DT;
      if (this.T > this.hi + 0.05) this.hot += DT;
      if (inside !== this.was) this.events.push({ k: inside ? 'enter' : 'leave' });
      this.was = inside;
    }
    if (this.t >= FIRE_TIME) { this.done = true; this.events.push({ k: 'done' }); }
  }
  result(): FireResult {
    const quality = clamp(this.inBand / (FIRE_TIME - FIRE_WARM), 0, 1);
    return { quality, finish: quality >= 0.85 ? 'shine' : quality >= 0.55 ? 'good' : 'dull', cracked: this.hot >= 1.2 };
  }
}

// ---------------------------------------------------------------- a finished piece, and what it earns
export type PartThrow = { id: PartId; prof: Profile; stars: number };
export type Piece = { order: string | null; parts: PartThrow[]; handle: HandleId | null; glaze: Glaze; throwStars: number; fire: FireResult | null };
/** Stars for a delivered pot: the throw's stars, a star off for glaze wishes mostly missed, a crack or a dull firing (two at most, never below one). */
export function finalStars(throwStars: number, glazeScore: number, fire: FireResult): number {
  const off = (glazeScore < 0.5 ? 1 : 0) + (fire.cracked ? 1 : 0) + (fire.finish === 'dull' ? 1 : 0);
  return clamp(throwStars - Math.min(2, off), 1, 3);
}
/** Acorns paid for a delivered order: more for more stars, a bonus for a shining glaze; a repeat order pays a thank-you. */
export const payFor = (stars: number, finish: Finish, repeat = false) => (repeat ? 3 : 6 + 4 * stars + (finish === 'shine' ? 3 : 0));
export const partsStars = (parts: { stars: number }[]) => (parts.length ? Math.floor(parts.reduce((a, b) => a + b.stars, 0) / parts.length + 1e-9) : 0);

// ---------------------------------------------------------------- the week and saving
export const SAVE_KEY = 'kiln-clay-v1';
export const GALLERY_MAX = 12;
export type GalleryPot = { name: string; parts: { id: PartId; prof: Profile }[]; handle: HandleId | null; glaze: Glaze; finish: Finish; cracked: boolean; lip: boolean };
export type Save = {
  v: 1; acorns: number; day: number; done: Record<string, number>; upgrades: UpgradeId[]; gallery: GalleryPot[]; rack: Piece[];
  ended: boolean; seen: string[]; tutorial: boolean; tipDay: number; flumps: number; pots: number;
  settings: { sound: boolean; music: boolean; ghost: boolean };
};
export const freshSave = (): Save => ({ v: 1, acorns: 0, day: 1, done: {}, upgrades: [], gallery: [], rack: [], ended: false, seen: [], tutorial: false, tipDay: 1, flumps: 0, pots: 0, settings: { sound: true, music: true, ghost: true } });
const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** A profile rounded for saving. */
export const packProfile = (p: Profile): Profile => ({ h: r2(p.h), r: p.r.map(r2), ri: p.ri.map(r2), floor: r2(p.floor) });
export function readProfile(o: unknown): Profile | null {
  if (!isObj(o) || !Array.isArray(o.r) || !Array.isArray(o.ri) || o.r.length !== PROFILE_N || o.ri.length !== PROFILE_N) return null;
  const h = num(o.h, 0.3, 40, NaN); if (!Number.isFinite(h)) return null;
  const r = o.r.map((v) => num(v, 0, WHEEL_R, NaN)), ri = o.ri.map((v) => num(v, 0, WHEEL_R, NaN));
  if (r.some((v) => !Number.isFinite(v)) || ri.some((v) => !Number.isFinite(v))) return null;
  return { h, r, ri: ri.map((v, i) => Math.min(v, Math.max(0, r[i] - 0.05))), floor: num(o.floor, 0, h, 0) };
}
export function readGlaze(o: unknown): Glaze {
  const g = freshGlaze(); if (!isObj(o)) return g;
  const gid = (v: unknown): GlazeId | null => (typeof v === 'string' && (GLAZE_IDS as string[]).includes(v) ? (v as GlazeId) : null);
  g.base = gid(o.base); g.drip = gid(o.drip); g.speckle = o.speckle === true;
  if (Array.isArray(o.bands)) for (const b of o.bands.slice(-MAX_BANDS)) {
    if (!isObj(b)) continue; const c = gid(b.g), u0 = num(b.u0, 0, 1, NaN), u1 = num(b.u1, 0, 1, NaN);
    if (c && Number.isFinite(u0) && Number.isFinite(u1) && u1 > u0) g.bands.push({ u0, u1, g: c });
  }
  return g;
}
const handleOf = (v: unknown): HandleId | null => (typeof v === 'string' && (HANDLE_IDS as string[]).includes(v) ? (v as HandleId) : null);
const partOf = (v: unknown): PartId | null => (v === 'body' || v === 'lid' || v === 'spout' ? v : null);
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    s.acorns = Math.floor(num(o.acorns, 0, 99999, 0));
    s.day = Math.floor(num(o.day, 1, DAY_COUNT, 1));
    if (isObj(o.done)) for (const id of ORDER_IDS) { const v = o.done[id]; if (typeof v === 'number' && v >= 1 && v <= 3) s.done[id] = Math.floor(v); }
    // the day can't be ahead of the orders delivered
    while (s.day > 1 && !dayDone(s, s.day - 1)) s.day--;
    if (Array.isArray(o.upgrades)) for (const u of o.upgrades) if (typeof u === 'string' && (UPGRADE_IDS as string[]).includes(u) && !s.upgrades.includes(u as UpgradeId)) s.upgrades.push(u as UpgradeId);
    if (Array.isArray(o.gallery)) for (const p of o.gallery.slice(0, GALLERY_MAX)) {
      if (!isObj(p) || !Array.isArray(p.parts)) continue;
      const parts = p.parts.map((q) => (isObj(q) ? { id: partOf(q.id), prof: readProfile(q.prof) } : null)).filter((q): q is { id: PartId; prof: Profile } => !!q && !!q.id && !!q.prof);
      if (!parts.length || parts[0].id !== 'body') continue;
      const finish = p.finish === 'shine' || p.finish === 'good' || p.finish === 'dull' ? p.finish : 'good';
      s.gallery.push({ name: typeof p.name === 'string' ? p.name.slice(0, 40) : 'A pot', parts, handle: handleOf(p.handle), glaze: readGlaze(p.glaze), finish, cracked: p.cracked === true, lip: p.lip === true });
    }
    if (Array.isArray(o.rack)) for (const p of o.rack.slice(0, 2)) {
      if (!isObj(p) || !Array.isArray(p.parts)) continue;
      const order = typeof p.order === 'string' && ORDER_IDS.includes(p.order) ? p.order : null;
      const parts = p.parts.map((q) => (isObj(q) ? { id: partOf(q.id), prof: readProfile(q.prof), stars: Math.floor(num(q.stars, 0, 3, 0)) } : null)).filter((q): q is PartThrow => !!q && !!q.id && !!q.prof);
      if (!parts.length || parts[0].id !== 'body') continue;
      if (order && !orderOpen(s, order)) continue;
      s.rack.push({ order, parts, handle: handleOf(p.handle), glaze: readGlaze(p.glaze), throwStars: Math.floor(num(p.throwStars, 1, 3, 1)), fire: null });
    }
    s.ended = o.ended === true && !!s.done[FINALE];
    if (Array.isArray(o.seen)) for (const x of o.seen) if (typeof x === 'string' && x.length < 40 && !s.seen.includes(x)) s.seen.push(x);
    s.tutorial = o.tutorial === true;
    s.tipDay = Math.floor(num(o.tipDay, 1, DAY_COUNT, s.day));
    s.flumps = Math.floor(num(o.flumps, 0, 1e6, 0)); s.pots = Math.floor(num(o.pots, 0, 1e6, 0));
    if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; s.settings.ghost = o.settings.ghost !== false; }
  } catch { return freshSave(); }
  return s;
}
export const ORDER = Object.fromEntries(ORDERS.map((o) => [o.id, o])) as Record<string, Order>;
export const dayOrders = (d: number) => ORDERS.filter((o) => o.day === d);
export const dayDone = (s: Save, d: number) => dayOrders(d).every((o) => !!s.done[o.id]);
export const orderOpen = (s: Save, id: string) => !!ORDER[id] && ORDER[id].day <= s.day;
export const starCount = (s: Save) => Object.values(s.done).reduce((a, b) => a + b, 0);
export const has = (s: Save, u: UpgradeId) => s.upgrades.includes(u);
export const kilnSize = (s: Save) => (has(s, 'kiln') ? 2 : 1);
export const freeOpen = (s: Save) => !!s.done.o1;
export function glazeOpen(s: Save, g: GlazeId) { const G = GLAZES[g]; return G.shop ? has(s, 'glazes') : G.day <= s.day; }
export const upgradeOpen = (s: Save, u: UpgradeId) => UPGRADES[u].day <= s.day;
export function buy(s: Save, u: UpgradeId): boolean {
  if (has(s, u) || !upgradeOpen(s, u) || s.acorns < UPGRADES[u].cost) return false;
  s.acorns -= UPGRADES[u].cost; s.upgrades.push(u); return true;
}
/** Starts the next day once today's orders are all delivered; the display shelf's tips come in then. */
export function nextDay(s: Save): { ok: boolean; tips: number } {
  if (s.day >= DAY_COUNT || !dayDone(s, s.day)) return { ok: false, tips: 0 };
  s.day++;
  const tips = has(s, 'shelf') && s.tipDay < s.day ? Math.min(5, s.gallery.length) : 0;
  s.acorns += tips; s.tipDay = s.day;
  return { ok: true, tips };
}
/** Records a delivery: the best stars only ever go up; a first delivery pays in full. */
export function deliver(s: Save, p: Piece): { stars: number; pay: number; first: boolean; finale: boolean; glaze: number } {
  const o = p.order ? ORDER[p.order] : null;
  if (!o || !p.fire) return { stars: 0, pay: 0, first: false, finale: false, glaze: 0 };
  const g = scoreGlaze(p.glaze, o.glaze).score, stars = finalStars(p.throwStars, g, p.fire);
  const first = !s.done[o.id], pay = payFor(stars, p.fire.finish, !first);
  s.done[o.id] = Math.max(s.done[o.id] ?? 0, stars); s.acorns += pay; s.pots++;
  const finale = o.id === FINALE && first;
  if (o.id === FINALE) s.ended = true;
  return { stars, pay, first, finale, glaze: g };
}
export function keepInGallery(s: Save, p: Piece, name: string): boolean {
  if (!p.fire) return false;
  const lip = p.order ? !!ORDER[p.order].parts[0].shape.lip : false;
  s.gallery.unshift({ name: name.slice(0, 40), parts: p.parts.map((q) => ({ id: q.id, prof: packProfile(q.prof) })), handle: p.handle, glaze: { ...p.glaze, bands: p.glaze.bands.map((b) => ({ ...b })) }, finish: p.fire.finish, cracked: p.fire.cracked, lip });
  if (s.gallery.length > GALLERY_MAX) s.gallery.length = GALLERY_MAX;
  return true;
}
export const customerOf = (id: string | null) => (id && ORDER[id] ? CUSTOMERS[ORDER[id].who] : null);

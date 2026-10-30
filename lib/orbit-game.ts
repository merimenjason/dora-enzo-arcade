// Moonhop: the rules. A deterministic fixed-step simulation of Dora and Enzo hopping between tiny moons: every moon
// pulls (inverse-square, with a soft cap at its surface and a gentle fade far away), the pair walk round whichever moon
// they stand on, hold to crouch and charge, and release to leap straight off the surface (plus whatever the moon's own
// spin or orbit adds). In flight a single puff of cloud nudges them; landing refills it. Jelly moons bounce them off,
// moss stops them dead, ice lets them skid, spinning moons carry them round, pulsing moons breathe their pull in and
// out, comets and twin moons move on fixed loops, black-bean moons push away, and rabbit holes pop them out of another
// moon. Fireflies are collected by flying (or walking) through them; once every one is gathered the home lantern opens.
// Drifting off into the dark (or flying for too long) gently rewinds them to the moon they left. No DOM, no clock and
// no Math.random: the page and the bots drive the same `Hop` with the same inputs, one 1/120 s step at a time.

export const DT = 1 / 120;
export const G0 = 700;          // surface gravity of a moon of radius 50, px/s² (bigger moons pull harder)
export const SOFT = 2.5;        // the soft cap: the pull goes as 1/(d² + (SOFT·r)²)
export const FALL_IN = 6;     // full pull out to this many radii...
export const FALL_OUT = 10;    // ...fading to nothing by this many
export const WALK = 110;        // walking speed along the surface, px/s
export const CHARGE_T = 1.1;    // seconds of holding for a full leap
export const VMIN = 150, VMAX = 420;
export const PUFF = 95;         // the puff's nudge, px/s
export const MAX_FLY = 8;       // seconds in the air before the lantern string reels them back
export const LOST_T = 0.75;     // how long the rewind takes
export const BODY = 17;         // the pair's middle, above their feet
export const REACH = 24;        // how close a firefly must come to the pair's middle
export const HOLE_W = 11;       // a rabbit hole's half-width along the surface, px

export type Kind = 'plain' | 'moss' | 'ice' | 'jelly' | 'bean';
export type Skin = 'lantern' | 'mushroom' | 'cheese' | 'garden' | 'moss' | 'ice' | 'jelly' | 'bean';
/** A loop a moon or firefly follows: an ellipse round (cx, cy), or a circle round another moon. */
export type Path = { cx?: number; cy?: number; around?: number; ax: number; ay?: number; period: number; phase?: number };
export type MoonDef = {
  x: number; y: number; r: number; kind?: Kind; skin?: Skin;
  spin?: number;                               // rad/s, clockwise on screen when positive
  pulse?: { amp: number; period: number; phase?: number };
  path?: Path; comet?: boolean;
  props?: number;                              // a seed for the little things that grow on it (drawing only)
};
export type FlyDef = { x?: number; y?: number; path?: Path; gold?: boolean };
export type HoleDef = { a: number; aAt: number; b: number; bAt: number };
export type Stage = {
  id: string; name: string; sky: number; index: number;
  moons: MoonDef[]; flies: FlyDef[]; holes?: HoleDef[];
  start: { moon: number; at: number }; home: number;
  par: number; parTime: number; preview: number;
  margin?: number;                             // how far past the moons the dark begins (default 320)
  teach?: { title: string; text: string };
  story?: string;
};
export type Input = { left?: boolean; right?: boolean; up?: boolean; down?: boolean; jump?: boolean; point?: [number, number] | null };
export type Ev =
  | { k: 'leap'; power: number } | { k: 'land'; moon: number; kind: Kind; speed: number } | { k: 'bounce'; moon: number; speed: number }
  | { k: 'fly'; i: number; gold: boolean; left: number } | { k: 'open' } | { k: 'locked'; left: number } | { k: 'puff'; dir: number }
  | { k: 'lost' } | { k: 'back' } | { k: 'hole'; from: number; to: number } | { k: 'home' } | { k: 'step' };
export type Mode = 'stand' | 'fly' | 'lost' | 'done';
export type Result = { home: boolean; gold: boolean; par: boolean; leaps: number; time: number };

const TAU = Math.PI * 2;
export const wrap = (a: number) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };

/** Where a loop puts something at time t, and how fast it is going there. */
function loop(p: Path, t: number, mx: number[], my: number[]): [number, number, number, number] {
  const w = TAU / p.period, a = w * t + (p.phase ?? 0), ay = p.ay ?? p.ax;
  const cx = p.around !== undefined ? mx[p.around] : p.cx ?? 0, cy = p.around !== undefined ? my[p.around] : p.cy ?? 0;
  return [cx + Math.cos(a) * p.ax, cy + Math.sin(a) * ay, -Math.sin(a) * p.ax * w, Math.cos(a) * ay * w];
}

export class Hop {
  readonly s: Stage;
  readonly n: number;
  step = 0;
  mode: Mode = 'stand';
  // where the moons are this step, how fast they move, how hard they pull
  mx: number[]; my: number[]; mvx: number[]; mvy: number[]; mu: number[];
  // standing
  moon = 0; at = 0; ws = 0; charge = 0; facing = 1; latch = 0; holeLock = -1;
  // flying
  x = 0; y = 0; vx = 0; vy = 0; flyT = 0; puffs = 1;
  lastMoon = 0; lastAt = 0; lostT = 0; landT = 9; bounceT = 9;
  got: boolean[]; open = false;
  leaps = 0; lost = 0; puffsUsed = 0; doneStep = -1;
  events: Ev[] = [];
  private prevJump = false; private block = false; private box: [number, number, number, number] | null = null;

  constructor(s: Stage) {
    this.s = s; this.n = s.moons.length;
    this.mx = new Array(this.n).fill(0); this.my = new Array(this.n).fill(0); this.mvx = new Array(this.n).fill(0); this.mvy = new Array(this.n).fill(0); this.mu = new Array(this.n).fill(0);
    this.got = s.flies.map(() => false);
    this.moon = s.start.moon; this.at = s.start.at; this.lastMoon = this.moon; this.lastAt = this.at;
    this.place();
    this.open = this.needed() === 0;
    this.feet();
  }
  clone(): Hop {
    const h = Object.create(Hop.prototype) as Hop;
    Object.assign(h, this);
    h.mx = [...this.mx]; h.my = [...this.my]; h.mvx = [...this.mvx]; h.mvy = [...this.mvy]; h.mu = [...this.mu];
    h.got = [...this.got]; h.events = [];
    return h;
  }
  get t() { return this.step * DT; }
  get done() { return this.mode === 'done'; }
  /** Fireflies still needed to open the lantern (the golden one is never needed). */
  needed() { let n = 0; this.s.flies.forEach((f, i) => { if (!f.gold && !this.got[i]) n++; }); return n; }
  total() { return this.s.flies.filter((f) => !f.gold).length; }
  goldGot() { return this.s.flies.some((f, i) => f.gold && this.got[i]); }
  hasGold() { return this.s.flies.some((f) => f.gold); }
  result(): Result { return { home: this.done, gold: this.done && this.goldGot(), par: this.done && this.leaps <= this.s.par, leaps: this.leaps, time: (this.doneStep >= 0 ? this.doneStep : this.step) * DT }; }

  /** Moves the moons to where they are at this step. */
  private place() {
    const t = this.t;
    this.s.moons.forEach((m, i) => {
      if (m.path) { const [x, y, vx, vy] = loop(m.path, t, this.mx, this.my); this.mx[i] = x; this.my[i] = y; this.mvx[i] = vx; this.mvy[i] = vy; }
      else { this.mx[i] = m.x; this.my[i] = m.y; this.mvx[i] = 0; this.mvy[i] = 0; }
      const base = G0 * Math.sqrt(m.r / 50) * m.r * m.r * (1 + SOFT * SOFT) * (m.comet ? 0.55 : 1) * (m.kind === 'bean' ? -0.85 : 1);
      this.mu[i] = m.pulse ? base * (1 + m.pulse.amp * Math.sin(TAU * t / m.pulse.period + (m.pulse.phase ?? 0))) : base;
    });
  }
  /** Where a firefly is now. */
  flyAt(i: number): [number, number] { const f = this.s.flies[i]; if (f.path) { const [x, y] = loop(f.path, this.t, this.mx, this.my); return [x, y]; } return [f.x ?? 0, f.y ?? 0]; }
  /** The pull of every moon at a point. */
  pull(x: number, y: number): [number, number] {
    let ax = 0, ay = 0;
    for (let i = 0; i < this.n; i++) {
      const r = this.s.moons[i].r, dx = this.mx[i] - x, dy = this.my[i] - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      if (d > r * FALL_OUT) continue;
      const f = d < r * FALL_IN ? 1 : 1 - smooth((d - r * FALL_IN) / (r * (FALL_OUT - FALL_IN)));
      const a = this.mu[i] / (d2 + SOFT * SOFT * r * r) * f / Math.max(d, 1e-6);
      ax += dx * a; ay += dy * a;
    }
    return [ax, ay];
  }
  /** Sets x, y to the pair's feet while they stand. */
  private feet() { const r = this.s.moons[this.moon].r; this.x = this.mx[this.moon] + Math.cos(this.at) * r; this.y = this.my[this.moon] + Math.sin(this.at) * r; }
  /** The bounding box the pair may roam in before the dark takes them. */
  bounds(): [number, number, number, number] {
    if (this.box) return this.box;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    this.s.moons.forEach((m) => {
      const ex = m.path ? m.path.ax : 0, ey = m.path ? m.path.ay ?? m.path.ax : 0;
      const cx = m.path && m.path.around === undefined ? m.path.cx ?? 0 : m.x, cy = m.path && m.path.around === undefined ? m.path.cy ?? 0 : m.y;
      l = Math.min(l, cx - ex - m.r); r = Math.max(r, cx + ex + m.r); t = Math.min(t, cy - ey - m.r); b = Math.max(b, cy + ey + m.r);
    });
    this.s.flies.forEach((f) => { if (f.x !== undefined && f.y !== undefined) { l = Math.min(l, f.x); r = Math.max(r, f.x); t = Math.min(t, f.y); b = Math.max(b, f.y); } });
    const e = this.s.margin ?? 320;
    return (this.box = [l - e, t - e, r + e, b + e]);
  }

  /** One fixed step of the world with this input held. */
  tick(inp: Input) {
    if (this.mode === 'done') { this.step++; this.place(); if (this.mode === 'done') this.feet(); return; }
    const jump = !!inp.jump, pressed = jump && !this.prevJump, released = !jump && this.prevJump;
    this.prevJump = jump;
    this.step++; this.place();
    this.landT += DT; this.bounceT += DT;
    if (this.mode === 'stand') this.stand(inp, jump, released);
    else if (this.mode === 'fly') this.fly(inp, pressed);
    else if (this.mode === 'lost') {
      this.lostT += DT;
      if (this.lostT >= LOST_T) { this.mode = 'stand'; this.moon = this.lastMoon; this.at = this.lastAt; this.ws = 0; this.charge = 0; this.puffs = 1; this.holeLock = -1; this.feet(); this.landT = 0; this.block = this.prevJump; this.events.push({ k: 'back' }); }
    }
  }

  private stand(inp: Input, jump: boolean, released: boolean) {
    const m = this.s.moons[this.moon], kind = m.kind ?? 'plain', r = m.r;
    // which way to walk: towards the pointer, or the arrow keys (latched to the way they started, so walking over
    // the bottom of a moon doesn't suddenly turn round)
    let want = 0, aligned = true;
    if (inp.point) {
      const target = Math.atan2(inp.point[1] - this.my[this.moon], inp.point[0] - this.mx[this.moon]), d = wrap(target - this.at);
      aligned = Math.abs(d) * r < 2.5;
      if (!aligned) want = Math.sign(d) * Math.min(1, Math.abs(d) * r / 14);
      this.latch = 0;
    } else {
      const lr = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (lr === 0) this.latch = 0;
      else {
        if (this.latch === 0 || Math.sign(this.latch) !== lr) this.latch = lr * (Math.sin(this.at) <= 0.05 ? 1 : -1);
        want = Math.sign(this.latch);
      }
    }
    const top = (kind === 'moss' ? 0.75 : kind === 'ice' ? 1.25 : 1) * WALK * (jump && !inp.point ? 0.55 : 1);
    const acc = kind === 'ice' ? (want ? 260 : 90) : 1500;
    const target = want * top;
    if (this.ws < target) this.ws = Math.min(target, this.ws + acc * DT); else if (this.ws > target) this.ws = Math.max(target, this.ws - acc * DT);
    if (want) this.facing = want > 0 ? 1 : -1;
    const carry = (m.spin ?? 0) * (kind === 'ice' ? 0.2 : 1);
    this.at = wrap(this.at + (this.ws / r + carry) * DT);
    this.feet();
    // rabbit holes
    const holes = this.s.holes;
    if (holes) {
      for (let h = 0; h < holes.length; h++) {
        const H = holes[h];
        for (const end of [0, 1] as const) {
          const mi = end === 0 ? H.a : H.b, ha = end === 0 ? H.aAt : H.bAt;
          if (mi !== this.moon) continue;
          const id = h * 2 + end, off = Math.abs(wrap(this.at - ha)) * r;
          if (this.holeLock === id) { if (off > HOLE_W * 1.8) this.holeLock = -1; continue; }
          if (off < HOLE_W) {
            const to = end === 0 ? H.b : H.a, toAt = end === 0 ? H.bAt : H.aAt;
            this.events.push({ k: 'hole', from: this.moon, to });
            this.moon = to; this.at = toAt; this.holeLock = h * 2 + (1 - end); this.ws = 0; this.charge = 0; this.feet(); this.landT = 0;
            this.lastMoon = this.moon; this.lastAt = this.at;
            this.gather();
            return;
          }
        }
      }
    }
    this.gather();
    if (this.mode !== 'stand') return;
    if (!jump) this.block = false;
    if (jump && aligned && !this.block) this.charge = Math.min(1, this.charge + DT / CHARGE_T);
    if (released && this.charge > 0) this.leap();
    else if (released) this.charge = 0;
  }

  private leap() {
    const m = this.s.moons[this.moon], kind = m.kind ?? 'plain', i = this.moon;
    const nx = Math.cos(this.at), ny = Math.sin(this.at), tx = -ny, ty = nx;
    const v = VMIN + (VMAX - VMIN) * this.charge;
    const side = this.ws + (m.spin ?? 0) * m.r * (kind === 'ice' ? 0.2 : 1);
    this.vx = nx * v + tx * side + this.mvx[i]; this.vy = ny * v + ty * side + this.mvy[i];
    this.x = this.mx[i] + nx * (m.r + 1); this.y = this.my[i] + ny * (m.r + 1);
    this.lastMoon = i; this.lastAt = this.at;
    this.events.push({ k: 'leap', power: this.charge });
    this.mode = 'fly'; this.flyT = 0; this.puffs = 1; this.charge = 0; this.ws = 0; this.holeLock = -1; this.leaps++;
  }

  private fly(inp: Input, pressed: boolean) {
    if (pressed && this.puffs > 0) {
      let dx = 0, dy = 0;
      if (inp.point) { dx = inp.point[0] - this.x; dy = inp.point[1] - this.y; }
      else { dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); }
      if (dx === 0 && dy === 0) { dx = this.vx; dy = this.vy; }
      const d = Math.hypot(dx, dy) || 1;
      this.vx += dx / d * PUFF; this.vy += dy / d * PUFF;
      this.puffs--; this.puffsUsed++;
      this.events.push({ k: 'puff', dir: Math.atan2(dy, dx) });
    }
    const [ax, ay] = this.pull(this.x, this.y);
    this.vx += ax * DT; this.vy += ay * DT;
    this.x += this.vx * DT; this.y += this.vy * DT;
    this.flyT += DT;
    if (Math.abs(this.vx) > 0.5) this.facing = this.vx > 0 ? 1 : -1;
    this.gather();
    // touching a moon
    for (let i = 0; i < this.n; i++) {
      const m = this.s.moons[i], dx = this.x - this.mx[i], dy = this.y - this.my[i], d = Math.hypot(dx, dy);
      if (d > m.r) continue;
      const nx = dx / (d || 1), ny = dy / (d || 1), tx = -ny, ty = nx;
      const rvx = this.vx - this.mvx[i], rvy = this.vy - this.mvy[i], vn = rvx * nx + rvy * ny, vt = rvx * tx + rvy * ty;
      const kind = m.kind ?? 'plain';
      this.x = this.mx[i] + nx * (m.r + 0.5); this.y = this.my[i] + ny * (m.r + 0.5);
      if (kind === 'bean' || (kind === 'jelly' && vn < -95)) {
        const e = kind === 'bean' ? 0.9 : 0.86;
        const out = Math.max(-vn * e, kind === 'bean' ? 120 : 0);
        this.vx = this.mvx[i] + nx * out + tx * vt * 0.95; this.vy = this.mvy[i] + ny * out + ty * vt * 0.95;
        this.puffs = 1; this.bounceT = 0;
        this.events.push({ k: 'bounce', moon: i, speed: -vn });
        break;
      }
      this.mode = 'stand'; this.moon = i; this.at = Math.atan2(ny, nx); this.holeLock = -1; this.puffs = 1;
      this.ws = Math.max(-260, Math.min(260, kind === 'moss' ? 0 : kind === 'ice' ? vt * 0.9 : vt * 0.3));
      this.feet(); this.landT = 0; this.block = this.prevJump;
      this.events.push({ k: 'land', moon: i, kind, speed: Math.hypot(rvx, rvy) });
      if (i === this.s.home) {
        if (this.open) { this.mode = 'done'; this.doneStep = this.step; this.events.push({ k: 'home' }); }
        else this.events.push({ k: 'locked', left: this.needed() });
      }
      return;
    }
    const [l, t, r, b] = this.bounds();
    if (this.flyT > MAX_FLY || this.x < l || this.x > r || this.y < t || this.y > b) {
      this.mode = 'lost'; this.lostT = 0; this.lost++; this.events.push({ k: 'lost' });
    }
  }

  /** Fireflies within reach of the pair's middle. */
  private gather() {
    const up = this.mode === 'fly' ? this.flyUp() : [Math.cos(this.at), Math.sin(this.at)];
    const bx = this.x + up[0] * BODY, by = this.y + up[1] * BODY;
    for (let i = 0; i < this.got.length; i++) {
      if (this.got[i]) continue;
      const [fx, fy] = this.flyAt(i);
      if ((fx - bx) ** 2 + (fy - by) ** 2 > REACH * REACH) continue;
      this.got[i] = true;
      const gold = !!this.s.flies[i].gold, left = this.needed();
      this.events.push({ k: 'fly', i, gold, left });
      if (!gold && left === 0 && !this.open) {
        this.open = true; this.events.push({ k: 'open' });
        if (this.mode === 'stand' && this.moon === this.s.home) { this.mode = 'done'; this.doneStep = this.step; this.events.push({ k: 'home' }); }
      }
    }
  }
  /** "Up" for the pair in the air: away from the strongest pull. */
  flyUp(): [number, number] {
    const [ax, ay] = this.pull(this.x, this.y), a = Math.hypot(ax, ay);
    if (a < 1) return [0, -1];
    return [-ax / a, -ay / a];
  }

  /** The dotted path a leap from here, at this charge, would take for the next `sec` seconds (stopping at a moon). */
  preview(sec: number, charge = this.charge): [number, number][] {
    if (this.mode !== 'stand') return [];
    const h = this.clone(); h.charge = Math.max(0.0001, charge); h.leap();
    const out: [number, number][] = [[h.x, h.y]], n = Math.round(sec / DT);
    for (let k = 0; k < n && h.mode === 'fly'; k++) { h.step++; h.place(); h.fly({}, false); if (k % 6 === 5) out.push([h.x, h.y]); }
    if (h.mode !== 'fly') out.push([h.x, h.y]);
    return out;
  }
}

function smooth(x: number) { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); }

// ---------------------------------------------------------------- the bots' (and the tests') way of playing
/** One leap as a player makes it with the pointer: optionally wait, point at a spot on the moon (the pair walk there),
 *  hold until the ring reaches `charge`, let go, and optionally puff once in mid-air. Angles are world angles. */
export type Act = { at: number; charge: number; wait?: number; puff?: { t: number; dir: number; rel?: boolean } };
/** Plays one leap with real inputs and returns when the pair stand again (or reach home, or are rewound). */
export function play(h: Hop, a: Act, maxSteps = 4000, onFly?: (h: Hop) => void): boolean {
  if (md(h) !== 'stand') return false;
  const ptr = (): [number, number] => [h.mx[h.moon] + Math.cos(a.at) * 400, h.my[h.moon] + Math.sin(a.at) * 400];
  let k = 0;
  for (let w = Math.round((a.wait ?? 0) / DT); w > 0 && md(h) === 'stand'; w--) { h.tick({}); k++; }
  if (md(h) !== 'stand') return false;
  const from = h.moon;
  while (md(h) === 'stand' && h.moon === from && h.charge < a.charge && k++ < maxSteps) h.tick({ jump: true, point: ptr() });
  if (md(h) !== 'stand') return false;
  if (h.moon !== from) return false; // fell into a rabbit hole on the way
  h.tick({ jump: false, point: ptr() });
  if (md(h) !== 'fly') return false;
  const puffAt = a.puff ? Math.max(1, Math.round(a.puff.t / DT)) : -1;
  let f = 0;
  while (md(h) === 'fly' && k++ < maxSteps) {
    f++;
    if (f === puffAt) { const d = a.puff!.dir + (a.puff!.rel ? Math.atan2(h.vy, h.vx) : 0), p: [number, number] = [h.x + Math.cos(d) * 100, h.y + Math.sin(d) * 100]; h.tick({ jump: true, point: p }); onFly?.(h); h.tick({ jump: false }); onFly?.(h); f++; continue; }
    h.tick({}); onFly?.(h);
  }
  while (md(h) === 'lost' && k++ < maxSteps) h.tick({});
  return md(h) === 'stand' || md(h) === 'done';
}
/** Walks into a rabbit hole: points at it and walks until the pair pop out somewhere else. */
export function walkTo(h: Hop, at: number, maxSteps = 2400): boolean {
  const from = h.moon;
  for (let k = 0; k < maxSteps && md(h) === 'stand' && h.moon === from; k++) {
    if (Math.abs(wrap(h.at - at)) * h.s.moons[h.moon].r < 1.5) break;
    h.tick({ point: [h.mx[h.moon] + Math.cos(at) * 400, h.my[h.moon] + Math.sin(at) * 400] });
  }
  return md(h) === 'stand';
}
export type Step = Act | { walk: number };
export const isWalk = (s: Step): s is { walk: number } => 'walk' in s;
/** Plays a whole recorded route. */
export function replay(s: Stage, route: Step[]): Hop {
  const h = new Hop(s);
  for (const st of route) { if (h.done) break; if (isWalk(st)) walkTo(h, st.walk); else play(h, st); }
  // a last moment for anything still settling
  for (let k = 0; k < 4 && !h.done; k++) h.tick({});
  return h;
}

const md = (h: Hop): Mode => h.mode;

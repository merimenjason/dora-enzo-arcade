// Snowdrift's hills: seven snowy valleys of the high Andes, each built from its own hand-tuned "hill grammar" by a
// seeded generator, so a day's course is the same every time and the endless Moonlit Hills are the same for a seed.
// Units are world units (the sled is about 2.4 long) with x to the right and y UP. The ground is a chain of cubic
// Hermite pieces through knots with set slopes, so it is smooth (height and slope both continuous) everywhere except
// the designed gaps of the snow bridges. Pure data and maths, no DOM; the rules live in snowdrift-game.ts.

export type ValleyId = 'meadow' | 'lake' | 'caves' | 'ridge' | 'bridges' | 'aurora' | 'summit';
export const VALLEY_IDS: ValleyId[] = ['meadow', 'lake', 'caves', 'ridge', 'bridges', 'aurora', 'summit'];

/** A valley: its course length, how fast the dusk follows, and the daylight to spare for the third medal. */
export type Valley = {
  id: ValleyId; name: string; blurb: string; feature: string; teach: string;
  /** From the start to the lodge flag, in world units. */
  length: number;
  /** The dusk starts this many seconds behind the start, and moves at this many units a second. */
  head: number; dusk: number;
  /** Seconds of daylight to spare at the lodge for the third medal. */
  spare: number;
  /** The fixed seed of the day's course. */
  seed: number;
};
export const VALLEYS: Record<ValleyId, Valley> = {
  meadow: { id: 'meadow', name: 'Pine Meadow', blurb: 'Gentle rolling hills under the pines. Learn the rhythm.', feature: 'Rolling hills', teach: 'Hold on the way down, let go on the way up', length: 1500, head: 8, dusk: 19.8, spare: 30, seed: 1101 },
  lake: { id: 'lake', name: 'Frozen Lake', blurb: 'Long stretches of glassy ice where speed holds.', feature: 'Slippery ice', teach: 'Dive onto the ice fast: it keeps your speed', length: 1800, head: 8, dusk: 24.8, spare: 29, seed: 2203 },
  caves: { id: 'caves', name: 'Ice Caves', blurb: 'Low blue ceilings full of icicles.', feature: 'Low ceilings', teach: 'In the caves, keep holding to stay low', length: 1900, head: 8, dusk: 23.6, spare: 26, seed: 3307 },
  ridge: { id: 'ridge', name: 'Windy Ridge', blurb: 'Big gusts that carry you on and on.', feature: 'Gusts', teach: 'Let the gusts carry you over the long dips', length: 2100, head: 8, dusk: 23.7, spare: 23, seed: 4409 },
  bridges: { id: 'bridges', name: 'Snow Bridges', blurb: 'Gaps across the gorges. Fly them!', feature: 'Gaps to fly', teach: 'Hold down the slope, let go at the lip to fly the gap', length: 2100, head: 8, dusk: 25.8, spare: 23, seed: 5501 },
  aurora: { id: 'aurora', name: 'Aurora Peaks', blurb: 'Night skies, dancing lights and enormous drops.', feature: 'Big drops', teach: 'Big drops: land on the downslope to fly on', length: 2400, head: 8, dusk: 24.6, spare: 21, seed: 6607 },
  summit: { id: 'summit', name: 'The Summit Run', blurb: 'Everything at once, all the way to the grand lodge.', feature: 'Everything', teach: 'Ice, caves, gusts and gaps: the last run', length: 2700, head: 8, dusk: 31.5, spare: 19, seed: 7703 },
};

// ---------------------------------------------------------------- randomness
/** A small seeded generator (mulberry32): the same seed always gives the same numbers. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the course
export type ZoneKind = 'ice' | 'cave' | 'wind' | 'gap';
/** A stretch of course with something special about it. A gap's `respawn` is where a fall puts you back, its `bottom` how far down a fall counts. */
export type Zone = { kind: ZoneKind; x0: number; x1: number; respawn: number; bottom: number };
export type PickupKind = 'flake' | 'cocoa';
/** A snowflake or a cocoa mug; `id` stays the same however the list is sorted. */
export type Pickup = { id: number; x: number; y: number; kind: PickupKind };
/** Which valley's look a stretch of the endless hills has. */
export type Theme = { x0: number; valley: ValleyId };
export type Ground = { y: number; m: number; k: number };

/** The air's pull the generator expects when it lays out arcs of snowflakes. Matches snowdrift-game.ts. */
export const ARC_G = 22 * 0.72;

function herm(x0: number, y0: number, m0: number, x1: number, y1: number, m1: number, x: number, out: Ground) {
  const d = x1 - x0, t = (x - x0) / d, t2 = t * t, t3 = t2 * t;
  out.y = (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * d * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * d * m1;
  out.m = ((6 * t2 - 6 * t) * (y0 - y1)) / d + (3 * t2 - 4 * t + 1) * m0 + (3 * t2 - 2 * t) * m1;
  out.k = (((12 * t - 6) * (y0 - y1)) / d + (6 * t - 4) * m0 + (6 * t - 2) * m1) / d;
  return out;
}

export class Course {
  /** Ground knots: x, height and slope; segment i runs from knot i to knot i + 1. */
  xs: number[] = []; ys: number[] = []; ms: number[] = [];
  /** Per segment: no ground (a bridge gap) and slippery ice. */
  gap: boolean[] = []; ice: boolean[] = [];
  /** Ceiling knots inside caves, with the same layout; `cseg` says where each cave's run starts and stops. */
  cxs: number[] = []; cys: number[] = []; cms: number[] = []; cbreak: boolean[] = [];
  zones: Zone[] = []; pickups: Pickup[] = []; themes: Theme[] = [];
  nextId = 0;
  /** The lodge flag (Infinity on the endless hills). */
  lodge = Infinity;
  start = 0;
  private hint = 0; private chint = 0;
  private tmp: Ground = { y: 0, m: 0, k: 0 }; private ctmp: Ground = { y: 0, m: 0, k: 0 };

  get end() { return this.xs[this.xs.length - 1]; }
  private seg(x: number) {
    const xs = this.xs, n = xs.length;
    if (n < 2 || x < xs[0] || x > xs[n - 1]) return -1;
    let i = Math.min(this.hint, n - 2);
    if (x < xs[i]) { while (i > 0 && x < xs[i]) i--; }
    else { while (i < n - 2 && x > xs[i + 1]) i++; }
    this.hint = i;
    return i;
  }
  /** The ground at x (height, slope dy/dx and dy²/dx²), or null over a gap or off the ends. Reuses one object. */
  ground(x: number, out: Ground = this.tmp): Ground | null {
    const i = this.seg(x);
    if (i < 0 || this.gap[i]) return null;
    return herm(this.xs[i], this.ys[i], this.ms[i], this.xs[i + 1], this.ys[i + 1], this.ms[i + 1], x, out);
  }
  /** The ground height at x, or NaN over a gap. */
  height(x: number) { const g = this.ground(x); return g ? g.y : NaN; }
  isIce(x: number) { const i = this.seg(x); return i >= 0 && this.ice[i]; }
  /** The underside of the cave roof at x, or null outside the caves. */
  ceiling(x: number): number | null {
    const xs = this.cxs, n = xs.length;
    if (n < 2 || x < xs[0] || x > xs[n - 1]) return null;
    let i = Math.min(this.chint, n - 2);
    if (x < xs[i]) { while (i > 0 && x < xs[i]) i--; }
    else { while (i < n - 2 && x > xs[i + 1]) i++; }
    this.chint = i;
    if (this.cbreak[i]) return null;
    return herm(xs[i], this.cys[i], this.cms[i], xs[i + 1], this.cys[i + 1], this.cms[i + 1], x, this.ctmp).y;
  }
  zoneAt(x: number, kind: ZoneKind): Zone | null {
    for (const z of this.zones) if (z.kind === kind && x >= z.x0 && x <= z.x1) return z;
    return null;
  }
  themeAt(x: number): ValleyId {
    let v = this.themes[0]?.valley ?? 'meadow';
    for (const t of this.themes) { if (t.x0 <= x) v = t.valley; else break; }
    return v;
  }
}

// ---------------------------------------------------------------- the builder and its pieces
type ArcPlan = { x: number; v: number; n: number; cocoa: boolean };
type GroundPlan = { x0: number; x1: number; n: number; cocoa: boolean };

/** Appends knots and remembers where snowflakes and cocoa should go once the ground is known. */
class Builder {
  c: Course; r: () => number;
  x = 0; y = 0; m = 0;
  arcs: ArcPlan[] = []; lines: GroundPlan[] = [];
  /** How fast the generator expects you to be going here, for laying out arcs. */
  pace = 18;
  private caveOn = false;
  constructor(c: Course, seed: number) { this.c = c; this.r = rng(seed); }
  /** A number between a and b. */
  u(a: number, b: number) { return a + (b - a) * this.r(); }
  knot(dx: number, dy: number, m: number, o: { gap?: boolean; ice?: boolean; ceil?: number } = {}) {
    const c = this.c;
    if (c.xs.length) { c.gap.push(!!o.gap); c.ice.push(!!o.ice); }
    this.x += dx; this.y += dy; this.m = m;
    c.xs.push(this.x); c.ys.push(this.y); c.ms.push(m);
    if (this.caveOn) {
      const cl = o.ceil ?? 9;
      if (c.cxs.length) c.cbreak.push(false);
      c.cxs.push(this.x); c.cys.push(this.y + cl); c.cms.push(m);
    }
  }
  /** One rolling hill: up to a rounded crest, a steeper face down, and a valley bottom a little lower than the start. */
  roll(w: number, up: number, down: number, o: { ice?: boolean; low?: boolean } = {}) {
    const wu = w * 0.44, wd = w - wu, fall = up + down;
    const face = -1.45 * fall / wd;
    this.knot(wu, up, 0, { ice: o.ice, ceil: o.low ? 3.6 : 9 });
    this.knot(wd * 0.5, -fall * 0.52, face, { ice: o.ice, ceil: o.low ? 6 : 10 });
    this.knot(wd * 0.5, -fall * 0.48, 0, { ice: o.ice, ceil: o.low ? 9 : 11 });
  }
  /** A big drop: a short climb to a crest, then a long steep face to a deep valley. */
  drop(w: number, up: number, down: number) {
    const fall = up + down;
    this.knot(w * 0.3, up, 0);
    this.knot(w * 0.14, -fall * 0.12, -0.9 * fall / (w * 0.7));
    this.knot(w * 0.3, -fall * 0.6, -1.5 * fall / (w * 0.7));
    this.knot(w * 0.26, -fall * 0.28, 0);
  }
  /** A long stretch of glassy ice, nearly level. */
  flat(len: number, ice: boolean) {
    const n = Math.max(1, Math.round(len / 40));
    for (let i = 0; i < n; i++) this.knot(len / n, -len / n * 0.012, -0.012, { ice });
  }
  /** A run down to a lip, a gap with no ground, and a landing face beyond. A fall puts you back at the top of the run. */
  gapJump(run: number, depth: number, width: number) {
    const top = this.x, lipUp = 3.2;
    this.knot(run * 0.25, 1.5, 0);
    const respawn = this.x;
    this.knot(run * 0.4, -depth * 0.6, -1.15 * depth / run);
    this.knot(run * 0.2, -depth * 0.4, 0);
    this.knot(run * 0.15, lipUp, 0.42);
    const lipY = this.y, x0 = this.x;
    this.knot(width, -lipUp - 2, -0.5, { gap: true });
    const x1 = this.x;
    // a long landing face, so a fast flight still comes down on the downslope
    this.knot(22, -8, -0.55);
    this.knot(20, -6, -0.3);
    this.knot(16, -2, 0);
    this.c.zones.push({ kind: 'gap', x0, x1, respawn, bottom: Math.min(lipY, this.y) - 26 });
    this.lines.push({ x0: top + run * 0.3, x1: top + run * 0.8, n: 4, cocoa: false });
    return { x0, x1 };
  }
  /** A tall crest over a wide windy dip: the gust carries you to the far face. */
  windHill(w: number, up: number, down: number) {
    const x0 = this.x;
    this.knot(w * 0.22, up, 0);
    const crest = this.x;
    this.knot(w * 0.2, -up * 0.6, -0.55 * (up + down) / (w * 0.3));
    this.knot(w * 0.22, -up * 0.5 - down * 0.2, 0);
    this.knot(w * 0.18, -down * 0.3, -0.8 * down / (w * 0.2));
    this.knot(w * 0.18, -down * 0.5, 0);
    this.c.zones.push({ kind: 'wind', x0: crest - 4, x1: this.x - w * 0.2, respawn: 0, bottom: 0 });
    void x0;
  }
  caveStart() {
    this.c.zones.push({ kind: 'cave', x0: this.x, x1: this.x, respawn: 0, bottom: 0 });
    // the cave mouth: the roof starts high and comes down over the first hill
    if (this.c.cxs.length) this.c.cbreak.push(true);
    this.caveOn = true;
    this.c.cxs.push(this.x); this.c.cys.push(this.y + 22); this.c.cms.push(0);
  }
  caveEnd() {
    const z = this.c.zones[this.c.zones.length - 1];
    if (z && z.kind === 'cave') z.x1 = this.x;
    // the roof lifts away at the far mouth
    this.knot(26, -0.6, -0.02, { ceil: 18 });
    this.c.cys[this.c.cys.length - 1] = this.y + 24;
    if (z) z.x1 = this.x;
    this.caveOn = false;
  }
  /** Snowflakes in an arc where a good jump off the crest just behind will fly. */
  arc(n: number, cocoa = false) { this.arcs.push({ x: this.x, v: this.pace, n, cocoa }); }
  line(x0: number, x1: number, n: number, cocoa = false) { this.lines.push({ x0, x1, n, cocoa }); }
}

/** A piece of a valley's grammar: draws one stretch and asks for pickups. */
type Piece = (b: Builder, s: number) => void;
type Phrase = { w: number; seq: Piece[] };

// pieces, scaled by s (1 = the valley's normal size)
const P = {
  roll: (w: number, up: number, down: number): Piece => (b, s) => {
    const x0 = b.x;
    b.roll(w * s * b.u(0.93, 1.07), up * s * b.u(0.9, 1.1), down * s * b.u(0.9, 1.1));
    if (b.r() < 0.45) b.line(x0 + w * s * 0.55, x0 + w * s * 0.85, 3);
  },
  rollArc: (w: number, up: number, down: number): Piece => (b, s) => {
    const x0 = b.x;
    b.roll(w * s * b.u(0.95, 1.05), up * s * b.u(0.92, 1.08), down * s * b.u(0.92, 1.08));
    b.arcs.push({ x: x0 + w * s * 0.44, v: b.pace, n: 5, cocoa: false });
  },
  lowRoll: (w: number, up: number, down: number): Piece => (b, s) => {
    const x0 = b.x;
    b.roll(w * s * b.u(0.94, 1.06), up * s * b.u(0.9, 1.1), down * s * b.u(0.9, 1.1), { low: true });
    b.line(x0 + w * s * 0.5, x0 + w * s * 0.9, 4);
  },
  icyRoll: (w: number, up: number, down: number): Piece => (b, s) => { b.roll(w * s * b.u(0.95, 1.05), up * s, down * s, { ice: true }); },
  lake: (len: number): Piece => (b) => {
    const x0 = b.x, L = len * b.u(0.85, 1.15);
    b.flat(L, true);
    b.line(x0 + 10, x0 + L - 10, Math.round(L / 22));
  },
  drop: (w: number, up: number, down: number): Piece => (b, s) => {
    const x0 = b.x;
    b.drop(w * s * b.u(0.95, 1.05), up * s * b.u(0.9, 1.1), down * s * b.u(0.92, 1.08));
    b.arcs.push({ x: x0 + w * s * 0.3, v: b.pace * 1.1, n: 6, cocoa: false });
  },
  gap: (run: number, depth: number, width: number): Piece => (b) => { b.gapJump(run * b.u(0.95, 1.05), depth * b.u(0.95, 1.05), width * b.u(0.9, 1.1)); },
  wind: (w: number, up: number, down: number): Piece => (b, s) => {
    const x0 = b.x;
    b.windHill(w * s * b.u(0.95, 1.05), up * s * b.u(0.92, 1.08), down * s);
    b.arcs.push({ x: x0 + w * s * 0.22, v: b.pace * 1.15, n: 7, cocoa: false });
  },
  cave: (n: number, w: number, up: number, down: number): Piece => (b, s) => {
    b.knot(10, -0.3, 0);
    b.caveStart();
    for (let i = 0; i < n; i++) {
      const x0 = b.x;
      b.roll(w * s * b.u(0.94, 1.06), up * s * b.u(0.9, 1.1), down * s * b.u(0.9, 1.1), { low: true });
      b.line(x0 + w * s * 0.5, x0 + w * s * 0.92, 3);
    }
    b.caveEnd();
  },
};

/** Each valley's grammar: phrases picked by weight, a size scale, and the pace the arcs of flakes expect. */
// Each roll is (wavelength, crest height, net drop). The valleys stay nearly level overall, so the speed comes from
// the rhythm (heavy down the slopes, light over the crests), not from a free ride downhill.
const GRAMMAR: Record<ValleyId, { pace: number; scale: [number, number]; phrases: Phrase[]; cocoa: number }> = {
  meadow: {
    pace: 17, scale: [0.95, 1.05], cocoa: 3, phrases: [
      { w: 4, seq: [P.roll(40, 3.8, 0.6), P.roll(40, 3.8, 0.6)] },
      { w: 3, seq: [P.rollArc(50, 5.2, 0.8)] },
      { w: 2, seq: [P.roll(34, 2.8, 0.5), P.roll(34, 2.8, 0.5), P.roll(34, 2.8, 0.5)] },
    ],
  },
  lake: {
    pace: 20, scale: [0.95, 1.08], cocoa: 4, phrases: [
      { w: 3, seq: [P.rollArc(48, 4.5, 4), P.lake(110), P.roll(40, 3.5, -2.4)] },
      { w: 3, seq: [P.roll(44, 4.2, 0.3), P.roll(44, 4.2, 0.3)] },
      { w: 2, seq: [P.icyRoll(46, 3.8, 0.4), P.icyRoll(46, 3.8, 0.4), P.lake(70)] },
      { w: 1, seq: [P.drop(70, 3, 9), P.lake(150), P.roll(44, 4.5, -3)] },
    ],
  },
  caves: {
    pace: 20, scale: [0.95, 1.08], cocoa: 4, phrases: [
      { w: 3, seq: [P.cave(4, 36, 3.2, 0.3)] },
      { w: 3, seq: [P.rollArc(50, 5.4, 0.4), P.roll(42, 4.2, 0.3)] },
      { w: 2, seq: [P.roll(40, 4, 0.3), P.cave(3, 38, 3.5, 0.3)] },
    ],
  },
  ridge: {
    pace: 22, scale: [0.95, 1.08], cocoa: 4, phrases: [
      { w: 3, seq: [P.roll(40, 4, 0.5), P.wind(120, 7.5, -0.4)] },
      { w: 3, seq: [P.roll(46, 4.6, 0.3), P.rollArc(54, 6.2, 0.4)] },
      { w: 2, seq: [P.roll(40, 4.2, 0.3), P.wind(100, 6.5, -0.4)] },
    ],
  },
  bridges: {
    pace: 22, scale: [0.95, 1.06], cocoa: 4, phrases: [
      { w: 3, seq: [P.gap(80, 12, 15), P.roll(44, 4.4, -1)] },
      { w: 3, seq: [P.roll(44, 4.6, 0.3), P.rollArc(54, 6.2, 0.4)] },
      { w: 2, seq: [P.roll(40, 4.2, -1), P.gap(90, 14, 19), P.roll(46, 4.6, -1)] },
    ],
  },
  aurora: {
    pace: 24, scale: [1, 1.12], cocoa: 5, phrases: [
      { w: 3, seq: [P.drop(110, 4, 18), P.roll(70, 19, -16)] },
      { w: 3, seq: [P.rollArc(58, 6.2, 0.4), P.rollArc(58, 6.2, 0.4)] },
      { w: 2, seq: [P.drop(130, 5, 24), P.roll(76, 21, -18), P.roll(52, 4.4, 0.3)] },
    ],
  },
  summit: {
    pace: 24, scale: [1, 1.1], cocoa: 5, phrases: [
      { w: 2, seq: [P.drop(110, 4, 16), P.lake(90), P.roll(60, 14, -12)] },
      { w: 2, seq: [P.cave(3, 38, 3.4, 0.3)] },
      { w: 2, seq: [P.roll(40, 4, 0.5), P.wind(120, 7.5, -0.4)] },
      { w: 2, seq: [P.gap(84, 13, 17), P.rollArc(52, 5.5, -1.5)] },
      { w: 2, seq: [P.rollArc(58, 7.5, 0.4), P.roll(46, 5.2, 0.3)] },
    ],
  },
};

function pick(b: Builder, phrases: Phrase[]) {
  const total = phrases.reduce((n, p) => n + p.w, 0);
  let r = b.r() * total;
  for (const p of phrases) { r -= p.w; if (r <= 0) return p; }
  return phrases[phrases.length - 1];
}

/** Lays one phrase of a valley's grammar onto the builder. */
function phrase(b: Builder, v: ValleyId) {
  const g = GRAMMAR[v], p = pick(b, g.phrases), s = b.u(g.scale[0], g.scale[1]);
  b.pace = g.pace;
  for (const piece of p.seq) piece(b, s);
}

/** Turns the planned arcs and lines into pickups, now that the ground is known. */
function placePickups(b: Builder, from = 0) {
  const c = b.c, out: Pickup[] = [];
  for (const a of b.arcs) {
    const g0 = c.ground(a.x); if (!g0) continue;
    // a jump off the crest at the expected pace: flakes along the first part of the flight
    let x = a.x, y = g0.y + 1.2, vx = a.v, vy = a.v * 0.08;
    const pts: Pickup[] = [];
    for (let t = 0; t < 4 && pts.length < a.n; t += 1 / 60) {
      vy -= ARC_G / 60; x += vx / 60; y += vy / 60;
      if (Math.round(t * 60) % 9 !== 8) continue;
      const g = c.ground(x), ceil = c.ceiling(x);
      if (g && y < g.y + 1.6) break;
      if (ceil !== null && y > ceil - 1.4) continue;
      pts.push({ id: 0, x, y, kind: 'flake' });
    }
    if (a.cocoa && pts.length) pts[Math.floor(pts.length / 2)].kind = 'cocoa';
    out.push(...pts);
  }
  for (const l of b.lines) {
    for (let i = 0; i < l.n; i++) {
      const x = l.x0 + ((l.x1 - l.x0) * (i + 0.5)) / l.n, g = c.ground(x);
      if (!g) continue;
      out.push({ id: 0, x, y: g.y + 1.25, kind: l.cocoa && i === Math.floor(l.n / 2) ? 'cocoa' : 'flake' });
    }
  }
  b.arcs = []; b.lines = [];
  // no two pickups on top of each other
  out.sort((p, q) => p.x - q.x);
  const kept: Pickup[] = [];
  for (const p of out) { if (kept.some((q) => Math.abs(q.x - p.x) < 1.6 && Math.abs(q.y - p.y) < 1.6)) continue; p.id = c.nextId++; kept.push(p); }
  c.pickups = c.pickups.concat(kept).sort((p, q) => p.x - q.x);
  void from;
}

/** Spaces the valley's cocoa mugs along the course: alternately up in an arc and down on the ground. */
function placeCocoa(b: Builder, n: number, x0: number, x1: number) {
  const c = b.c;
  for (let i = 0; i < n; i++) {
    const want = x0 + ((x1 - x0) * (i + 0.6)) / (n + 0.4);
    // the nearest flake to that spot becomes a mug (an air one on odd mugs if there is one near)
    let best = -1, bestD = Infinity;
    for (let j = 0; j < c.pickups.length; j++) {
      const p = c.pickups[j]; if (p.kind !== 'flake') continue;
      const g = c.ground(p.x), air = g ? p.y - g.y > 2.2 : false;
      const d = Math.abs(p.x - want) + (i % 2 === 1 && !air ? 60 : 0);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0) c.pickups[best].kind = 'cocoa';
  }
}

/** The start: a little level shelf to wait on, then a long first slope to get going. */
function startPad(b: Builder) {
  b.x = -60; b.y = 0; b.m = 0;
  b.knot(0, 0, 0);
  b.knot(60, 0, 0);
  b.knot(22, -5, -0.42);
  b.knot(22, -6, -0.3);
  b.knot(18, -2, 0);
}

/** A day's course: the valley's grammar from the start to the lodge, then a level run-out to stop on. */
export function buildDay(v: ValleyId): Course {
  const V = VALLEYS[v], c = new Course(), b = new Builder(c, V.seed);
  startPad(b);
  c.themes.push({ x0: -Infinity, valley: v });
  while (b.x < V.length - 160) phrase(b, v);
  // the lodge: a gentle last slope and a long level yard
  b.knot(40, 3, 0);
  b.knot(50, -10, -0.22);
  b.knot(40, -5, 0);
  c.lodge = b.x + 30;
  b.knot(120, 0, 0);
  b.knot(200, 0, 0);
  placePickups(b);
  placeCocoa(b, GRAMMAR[v].cocoa, 40, c.lodge - 60);
  return c;
}

/** The endless Moonlit Hills: every valley's grammar in turn, a new valley every 1200 units, built as you go. */
export class Endless {
  c = new Course(); private b: Builder; private next = 0; private order: ValleyId[];
  constructor(seed: number) {
    this.b = new Builder(this.c, seed);
    startPad(this.b);
    // the order of the valleys is shuffled per seed, but the gentle meadow always comes first
    const rest = VALLEY_IDS.slice(1);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(this.b.r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    this.order = ['meadow', ...rest];
    this.c.themes.push({ x0: -Infinity, valley: 'meadow' });
    this.extend(600);
  }
  /** Which valley the hills at this distance come from. */
  valleyFor(x: number): ValleyId { return this.order[Math.floor(Math.max(0, x) / 1200) % this.order.length]; }
  /** Builds on until the ground reaches past x. */
  extend(x: number) {
    const b = this.b, from = b.x;
    if (b.x >= x) return;
    while (b.x < x) {
      const v = this.valleyFor(b.x);
      const last = this.c.themes[this.c.themes.length - 1];
      if (last.valley !== v) this.c.themes.push({ x0: b.x, valley: v });
      phrase(b, v);
    }
    placePickups(b, from);
    // a cocoa mug every 300 units or so
    while (this.next < b.x - 100) {
      this.next += 300;
      if (this.next < 200) continue;
      let best = -1, bestD = 80;
      this.c.pickups.forEach((p, j) => { const d = Math.abs(p.x - this.next); if (p.kind === 'flake' && d < bestD) { bestD = d; best = j; } });
      if (best >= 0) this.c.pickups[best].kind = 'cocoa';
    }
  }
}

/** Checks a course: knots in order, every slope sane, no gaps but the bridges, and room under every cave roof. */
export function validateCourse(c: Course): string[] {
  const bad: string[] = [];
  for (let i = 1; i < c.xs.length; i++) {
    if (!(c.xs[i] > c.xs[i - 1])) bad.push(`knot ${i} out of order at x=${c.xs[i]}`);
    if (Math.abs(c.ms[i]) > 2) bad.push(`knot ${i} too steep (${c.ms[i].toFixed(2)})`);
  }
  let prev = c.ground(c.xs[0])?.y ?? 0, prevOk = true;
  for (let x = c.xs[0]; x <= c.end; x += 0.25) {
    const g = c.ground(x);
    if (!g) {
      if (!c.zoneAt(x, 'gap')) bad.push(`no ground at x=${x.toFixed(1)} outside a gap`);
      prevOk = false; continue;
    }
    if (prevOk && Math.abs(g.y - prev) > 1.2) bad.push(`a step in the ground at x=${x.toFixed(1)}`);
    if (Math.abs(g.m) > 2.2) bad.push(`a cliff at x=${x.toFixed(1)}`);
    const ceil = c.ceiling(x);
    if (ceil !== null && ceil - g.y < 3.2) bad.push(`a cave roof too low at x=${x.toFixed(1)}`);
    prev = g.y; prevOk = true;
    if (bad.length > 20) break;
  }
  return bad;
}

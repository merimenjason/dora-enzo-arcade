// Kumori Pass: the six roads of Mount Kumori, authored as a list of straights and arcs (a turn angle and a radius) and
// built into a smooth centreline sampled every metre. The curvature is eased between pieces (a moving average over
// EASE metres, so every bend has a spiral entry), the heading is integrated from it and the position from the heading,
// so the road is a smooth spline that can't kink. Each sample carries its heading, curvature, height, grade, the
// half-width to each guardrail, and flags for gutters, wide passing places, fog and darkness. No DOM, no randomness.

export type PassId = 'cedar' | 'lake' | 'stairs' | 'fog' | 'tunnel' | 'summit';
type PieceOpts = { g?: number; wide?: boolean; tunnel?: boolean; crest?: boolean; gutter?: boolean };
export type Piece = ({ t: 'S'; len: number } | { t: 'L' | 'R'; deg: number; r: number }) & PieceOpts;

export type PassDef = {
  id: PassId; name: string; blurb: string;
  /** visual mood: fog density 0..1, dark = no lamps and no moon */
  fog: number; dark: boolean; dawn: boolean;
  pieces: Piece[];
  /** where the road starts, its height and heading */
  start: { x: number; y: number; z: number; h: number };
};

export type Track = {
  id: PassId | 'summit-up'; def: PassDef; reversed: boolean;
  n: number; len: number;
  x: Float64Array; y: Float64Array; h: Float64Array; k: Float64Array; z: Float64Array; grade: Float64Array;
  /** half-width from the centreline to the left and right guardrails (metres) */
  wl: Float64Array; wr: Float64Array;
  /** -1 gutter on the right, 1 on the left, 0 none */
  gutter: Int8Array;
  wide: Uint8Array; tunnel: Uint8Array;
};

export const STEP = 1; // metres between samples
export const NARROW = 3.6; // half-width of the narrow road
export const WIDE = 5.8; // half-width in a passing place
export const GUTTER = 0.9; // how far past the edge a gutter lets the inside wheels drop
const EASE = 14;

const S = (len: number, o: PieceOpts = {}): Piece => ({ t: 'S', len, ...o });
const L = (deg: number, r: number, o: PieceOpts = {}): Piece => ({ t: 'L', deg, r, ...o });
const R = (deg: number, r: number, o: PieceOpts = {}): Piece => ({ t: 'R', deg, r, ...o });

// Grades are per piece, as a fraction (−0.06 is a 6 % descent in the driving direction).
export const PASSES: PassDef[] = [
  {
    id: 'cedar', name: 'Cedar Switchbacks', blurb: 'Down through the old cedars: fast sweepers, then four switchbacks above the bakery.',
    fog: 0.12, dark: false, dawn: false, start: { x: 0, y: 0, z: 140, h: 0 },
    pieces: [S(70, { g: -0.03 }), R(40, 140, { g: -0.04 }), S(40, { g: -0.05 }), L(55, 90, { g: -0.05 }), S(60, { g: -0.06, wide: true }),
      R(70, 60, { g: -0.06 }), S(70, { g: -0.06 }), L(180, 17, { g: -0.05 }), S(90, { g: -0.07 }), R(180, 18, { g: -0.05 }), S(80, { g: -0.07 }),
      L(45, 70, { g: -0.06 }), R(45, 70, { g: -0.06 }), S(70, { g: -0.06, wide: true }), L(180, 19, { g: -0.05 }), S(90, { g: -0.07 }), R(180, 18, { g: -0.05 }),
      S(60, { g: -0.05 }), L(60, 45, { g: -0.04 }), S(40, { g: -0.03 }), R(35, 110, { g: -0.03 }), S(80, { g: -0.02 })],
  },
  {
    id: 'lake', name: 'Lakeside Esses', blurb: 'Along the moonlit lake: flowing esses that link one into the next. Find the rhythm.',
    fog: 0.18, dark: false, dawn: false, start: { x: 0, y: 0, z: 40, h: 0.3 },
    pieces: [S(60), L(50, 70), R(70, 55), L(70, 55), R(40, 90), S(70, { wide: true }), R(60, 50), L(90, 38), R(90, 38), L(40, 100),
      S(60, { crest: true, g: 0.02 }), S(40, { g: -0.03 }), L(80, 45), R(80, 45), L(60, 65), S(80, { wide: true }), R(110, 32), L(60, 70), R(30, 120), S(80)],
  },
  {
    id: 'stairs', name: 'Hairpin Stairs', blurb: 'Seven hairpins stacked down the cliff like a staircase. Hook the drain gutters to carry speed.',
    fog: 0.1, dark: false, dawn: false, start: { x: 0, y: 0, z: 160, h: -0.2 },
    pieces: [S(80, { g: -0.04 }), R(40, 90, { g: -0.05 }), S(50, { g: -0.07 }), L(180, 15, { g: -0.06, gutter: true }), S(70, { g: -0.08 }),
      R(180, 15, { g: -0.06, gutter: true }), S(70, { g: -0.08, wide: true }), L(180, 16, { g: -0.06 }), S(70, { g: -0.08 }), R(180, 15, { g: -0.06, gutter: true }),
      S(60, { g: -0.07 }), L(30, 80, { g: -0.06 }), R(30, 80, { g: -0.06 }), S(40, { g: -0.07 }), L(180, 15, { g: -0.06, gutter: true }), S(70, { g: -0.08, wide: true }),
      R(180, 16, { g: -0.06 }), S(70, { g: -0.08 }), L(180, 15, { g: -0.06, gutter: true }), S(70, { g: -0.05 }), R(50, 70, { g: -0.04 }), S(70, { g: -0.02 })],
  },
  {
    id: 'fog', name: 'Fog Ridge', blurb: 'Up onto the ridge into the cloud. You will barely see the road: trust Enzo\'s notes.',
    fog: 0.85, dark: false, dawn: false, start: { x: 0, y: 0, z: 0, h: 1.4 },
    pieces: [S(60, { g: 0.05 }), L(60, 70, { g: 0.06 }), S(50, { g: 0.06 }), R(120, 28, { g: 0.06 }), S(40, { g: 0.05 }), L(70, 45, { g: 0.05 }),
      S(50, { g: 0.04, crest: true }), S(40, { g: -0.01 }), R(45, 80), L(45, 80), S(70, { wide: true, g: 0.02 }), L(150, 22, { g: 0.05 }), S(60, { g: 0.05 }),
      R(80, 40, { g: 0.04 }), S(40, { g: 0.03, crest: true }), S(40, { g: -0.02 }), L(40, 90), R(90, 35, { g: 0.03 }), S(80, { wide: true, g: 0.03 }),
      L(100, 30, { g: 0.04 }), R(30, 120, { g: 0.03 }), S(70, { g: 0.02 })],
  },
  {
    id: 'tunnel', name: 'Ghost Tunnel', blurb: 'An unlit run down the old road, through the long tunnel. Only your headlights and Enzo\'s voice.',
    fog: 0.3, dark: true, dawn: false, start: { x: 0, y: 0, z: 120, h: 2.6 },
    pieces: [S(60, { g: -0.04 }), L(60, 60, { g: -0.05 }), S(40, { g: -0.05 }), R(90, 40, { g: -0.05 }), S(50, { g: -0.05, tunnel: true }),
      L(35, 110, { g: -0.04, tunnel: true }), S(50, { g: -0.04, tunnel: true }), R(50, 75, { g: -0.04, tunnel: true }), S(60, { g: -0.04, tunnel: true }),
      S(60, { g: -0.05, wide: true }), L(180, 18, { g: -0.05, gutter: true }), S(70, { g: -0.06 }), R(120, 30, { g: -0.05 }), L(70, 50, { g: -0.05 }),
      S(50, { g: -0.06, crest: true }), R(180, 17, { g: -0.05 }), S(70, { g: -0.05, wide: true }), L(80, 42, { g: -0.04 }), R(40, 90, { g: -0.03 }), S(70, { g: -0.02 })],
  },
  {
    id: 'summit', name: 'Summit Dawn', blurb: 'The whole mountain, inn to bakery: every kind of corner in one long run.',
    fog: 0.2, dark: false, dawn: true, start: { x: 0, y: 0, z: 260, h: 0.9 },
    pieces: [S(70, { g: -0.03 }), R(45, 110, { g: -0.04 }), L(60, 60, { g: -0.05 }), S(50, { g: -0.06, wide: true }), R(180, 17, { g: -0.05, gutter: true }),
      S(80, { g: -0.07 }), L(180, 17, { g: -0.05 }), S(60, { g: -0.06 }), R(50, 55, { g: -0.05 }), L(80, 40, { g: -0.05 }), R(80, 40, { g: -0.05 }),
      S(60, { g: -0.04, crest: true }), S(40, { g: -0.05 }), L(40, 100, { g: -0.05 }), S(80, { g: -0.06, wide: true }), R(130, 26, { g: -0.05 }),
      S(50, { g: -0.06 }), L(180, 16, { g: -0.05, gutter: true }), S(70, { g: -0.07 }), R(180, 18, { g: -0.05 }), S(60, { g: -0.06 }),
      L(60, 50, { g: -0.04 }), R(60, 50, { g: -0.04 }), S(70, { g: -0.04, wide: true }), L(100, 32, { g: -0.04 }), S(50, { g: -0.04 }),
      R(45, 80, { g: -0.03 }), L(30, 130, { g: -0.03 }), S(80, { g: -0.02 })],
  },
];

export const passDef = (id: PassId) => PASSES.find((p) => p.id === id)!;

/** Build the sampled road for a pass; `reversed` drives it the other way (the uphill leg of the finale). */
export function buildTrack(id: PassId, reversed = false): Track {
  const def = passDef(id);
  // raw per-metre values from the pieces
  const kRaw: number[] = [], gRaw: number[] = [], wideRaw: number[] = [], gutRaw: number[] = [], tunRaw: number[] = [];
  for (const p of def.pieces) {
    const len = p.t === 'S' ? p.len : Math.round((p.deg * Math.PI) / 180 * p.r);
    const k = p.t === 'S' ? 0 : (p.t === 'L' ? 1 : -1) / p.r;
    for (let i = 0; i < len; i++) {
      kRaw.push(k); gRaw.push(p.g ?? 0); wideRaw.push(p.wide ? 1 : 0); tunRaw.push(p.tunnel ? 1 : 0);
      gutRaw.push(p.t !== 'S' && p.gutter ? (p.t === 'L' ? 1 : -1) : 0);
    }
  }
  // a straight run-in and run-out so the start grid and the finish sit on straight road
  for (let i = 0; i < 40; i++) { kRaw.push(0); gRaw.push(gRaw[gRaw.length - 1] ?? 0); wideRaw.push(0); gutRaw.push(0); tunRaw.push(0); }
  const n = kRaw.length + 1;
  const smooth = (a: number[], w: number) => {
    const out = new Float64Array(n); let acc = 0; const half = w >> 1;
    for (let i = -half; i <= half; i++) acc += a[Math.min(a.length - 1, Math.max(0, i))];
    for (let i = 0; i < n; i++) {
      out[i] = acc / (2 * half + 1);
      acc += a[Math.min(a.length - 1, i + half + 1)] - a[Math.min(a.length - 1, Math.max(0, i - half))];
    }
    return out;
  };
  const k = smooth(kRaw, EASE), grade = smooth(gRaw, 30), wideS = smooth(wideRaw, 24), gutS = smooth(gutRaw.map(Math.abs), 10);
  const x = new Float64Array(n), y = new Float64Array(n), h = new Float64Array(n), z = new Float64Array(n);
  x[0] = def.start.x; y[0] = def.start.z; h[0] = def.start.h; z[0] = def.start.y;
  for (let i = 1; i < n; i++) {
    // midpoint integration of the heading keeps the arcs true
    const hm = h[i - 1] + (k[i - 1] * STEP) / 2;
    h[i] = h[i - 1] + k[i - 1] * STEP;
    x[i] = x[i - 1] + Math.cos(hm) * STEP; y[i] = y[i - 1] + Math.sin(hm) * STEP;
    z[i] = z[i - 1] + grade[i - 1] * STEP;
  }
  const wl = new Float64Array(n), wr = new Float64Array(n), gutter = new Int8Array(n), wide = new Uint8Array(n), tunnel = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = Math.min(i, kRaw.length - 1);
    const half = NARROW + (WIDE - NARROW) * wideS[i];
    const side = gutRaw[j] || (gutS[i] > 0.05 ? Math.sign(k[i]) : 0);
    gutter[i] = gutS[i] > 0.05 ? side : 0;
    wl[i] = half + (gutter[i] === 1 ? GUTTER * Math.min(1, gutS[i] * 2) : 0);
    wr[i] = half + (gutter[i] === -1 ? GUTTER * Math.min(1, gutS[i] * 2) : 0);
    wide[i] = wideS[i] > 0.5 ? 1 : 0; tunnel[i] = tunRaw[j];
  }
  const t: Track = { id, def, reversed: false, n, len: (n - 1) * STEP, x, y, h, k, z, grade, wl, wr, gutter, wide, tunnel };
  return reversed ? reverse(t) : t;
}

function reverse(t: Track): Track {
  const n = t.n, r = <A extends Float64Array | Int8Array | Uint8Array>(a: A, f: (v: number) => number = (v) => v): A => {
    const out = new (a.constructor as { new (n: number): A })(n);
    for (let i = 0; i < n; i++) out[i] = f(a[n - 1 - i]);
    return out;
  };
  return {
    ...t, id: 'summit-up', reversed: true,
    x: r(t.x), y: r(t.y), z: r(t.z), h: r(t.h, (v) => v + Math.PI), k: r(t.k, (v) => -v), grade: r(t.grade, (v) => -v),
    wl: r(t.wr), wr: r(t.wl), gutter: r(t.gutter, (v) => -v), wide: r(t.wide), tunnel: r(t.tunnel),
  };
}

export type Where = { i: number; s: number; d: number; px: number; py: number };
/**
 * Where a point is along the road: the progress s and the signed sideways offset d (left positive), searching near a
 * hint index so a switchback below never gets confused with the road you are on.
 */
export function locate(t: Track, x: number, y: number, hint: number, out: Where, span = 8): Where {
  let best = -1, bd = Infinity;
  const lo = Math.max(0, hint - span), hi = Math.min(t.n - 1, hint + span);
  for (let i = lo; i <= hi; i++) {
    const dx = x - t.x[i], dy = y - t.y[i], d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; }
  }
  // refine along the tangent
  const i = best, c = Math.cos(t.h[i]), s = Math.sin(t.h[i]);
  const dx = x - t.x[i], dy = y - t.y[i];
  const along = dx * c + dy * s, side = -dx * s + dy * c;
  out.i = i; out.s = Math.max(0, Math.min(t.len, i * STEP + along)); out.d = side; out.px = t.x[i]; out.py = t.y[i];
  return out;
}

/** Index of the sample at progress s, clamped. */
export const at = (t: Track, s: number) => Math.max(0, Math.min(t.n - 1, Math.round(s / STEP)));

/** The radius of the circle through three road points `gap` metres apart, centred on index i (Infinity on a straight). */
export function radiusAt(t: Track, i: number, gap = 6) {
  const a = Math.max(0, i - gap), b = Math.min(t.n - 1, i + gap);
  const ax = t.x[a], ay = t.y[a], bx = t.x[i], by = t.y[i], cx = t.x[b], cy = t.y[b];
  const ab = Math.hypot(bx - ax, by - ay), bc = Math.hypot(cx - bx, cy - by), ca = Math.hypot(ax - cx, ay - cy);
  const area2 = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

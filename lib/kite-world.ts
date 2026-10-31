// Kite Day's world: the six places of the summer, their ground, trees, treehouses, ponds and buildings, and the wind
// that blows over them. Everything here is pure and deterministic: the wind at a point and a time comes from a seeded
// smooth noise that travels downwind with the breeze, so the same seed always blows the same gusts.
//
// Units are metres and seconds. The wind always blows from left to right (+x), so a kite flies to the right of the
// chinchilla holding it. Heights (y) grow upwards from sea level.

export type PlaceId = 'meadow' | 'orchard' | 'beach' | 'hilltop' | 'fete' | 'cliffs';
export const PLACE_IDS: PlaceId[] = ['meadow', 'orchard', 'beach', 'hilltop', 'fete', 'cliffs'];

/** A tree: a trunk at x with a round canopy. Kites caught in the canopy hang there until reeled in. */
export type Tree = { x: number; h: number; r: number; kind: 'oak' | 'apple' | 'pine' | 'palm' };
/** A building or a tent: a box with a roof. */
export type Building = { x0: number; x1: number; h: number; roof: number; kind: 'cottage' | 'tent' | 'barn' | 'stall' | 'hut' };
/** A warm field that sends up thermals: a rising column centred at x that drifts and breathes. */
export type Thermal = { x: number; w: number; lift: number; period: number; phase: number };
export type WindDef = {
  /** the mean wind speed ten metres up */
  speed: number;
  /** how strong the gusts are, as a fraction of the mean */
  gust: number;
  /** how deep the lulls go (0 none, 1 dead calm) and how often (0..1) */
  lull: number; lullOften: number;
  /** the length of a gust as it travels, in metres */
  gustLen: number;
  /** turbulence everywhere (small gusty swirls), as a fraction of the mean */
  rough: number;
};
export type Place = {
  id: PlaceId; name: string; blurb: string; feature: string;
  /** the ground: control points [x, height] joined smoothly; outside them the ground is flat */
  ground: [number, number][];
  /** water (a pond or the sea): [x0, x1, surface height] */
  water: [number, number, number][];
  trees: Tree[]; buildings: Building[]; thermals: Thermal[];
  /** an updraft where the wind meets a cliff or a ridge: [x, width, lift] */
  ridges: [number, number, number][];
  wind: WindDef;
  /** where the chinchilla starts and how far it may walk */
  start: number; walk: [number, number];
  /** the world's width (for the camera) */
  width: number;
  /** colours for the painted ground in code */
  paint: { grass: string; grassDark: string; soil: string; far: string; flower: string };
};

export const PLACES: Record<PlaceId, Place> = {
  meadow: {
    id: 'meadow', name: 'Clover Meadow', feature: 'a steady breeze', blurb: 'A gentle, steady breeze over the clover: the place to learn to pull, ease and steer.',
    ground: [[-20, 2], [10, 2.2], [30, 2], [48, 1.8], [54, 0.6], [62, 0.6], [68, 2], [110, 3], [160, 2.5]],
    water: [[50, 66, 1.4]],
    trees: [{ x: -4, h: 5, r: 3.4, kind: 'oak' }, { x: 92, h: 6, r: 4, kind: 'oak' }],
    buildings: [], thermals: [], ridges: [],
    wind: { speed: 5.4, gust: 0.18, lull: 0.25, lullOften: 0.15, gustLen: 30, rough: 0.03 },
    start: 20, walk: [10, 50], width: 120,
    paint: { grass: '#8cc063', grassDark: '#4f8a3c', soil: '#a07a4c', far: '#9cc7a0', flower: '#f6d24a' },
  },
  orchard: {
    id: 'orchard', name: 'Apple Orchard', feature: 'treehouses and tumbling air', blurb: 'Rows of apple trees break the wind into tumbling swirls behind them. Treehouses wait for their parcels.',
    ground: [[-20, 2], [20, 2], [45, 2.6], [70, 2.2], [100, 3], [160, 3]],
    water: [],
    trees: [{ x: -10, h: 5, r: 3, kind: 'apple' }, { x: 30, h: 5.5, r: 3.2, kind: 'apple' }, { x: 40, h: 7, r: 3.8, kind: 'oak' }, { x: 53, h: 5.2, r: 3, kind: 'apple' }, { x: 66, h: 8, r: 4.2, kind: 'oak' }, { x: 80, h: 5.4, r: 3.1, kind: 'apple' }, { x: 94, h: 5, r: 3, kind: 'apple' }],
    buildings: [{ x0: 104, x1: 116, h: 6, roof: 4, kind: 'barn' }], thermals: [], ridges: [],
    wind: { speed: 5.8, gust: 0.24, lull: 0.3, lullOften: 0.2, gustLen: 26, rough: 0.05 },
    start: 18, walk: [10, 44], width: 130,
    paint: { grass: '#9cc25e', grassDark: '#5a8a36', soil: '#9a6e42', far: '#b7c98a', flower: '#e8554a' },
  },
  beach: {
    id: 'beach', name: 'Breezy Beach', feature: 'strong gusts off the sea', blurb: 'A strong sea wind with gusts and sudden lulls. Watch the grass and the spray to see them coming.',
    ground: [[-20, 2.4], [16, 2.4], [30, 1.6], [44, 0.9], [52, 0.2], [70, -1], [160, -1]],
    water: [[54, 170, 0.3]],
    trees: [{ x: -6, h: 6, r: 2.6, kind: 'palm' }],
    buildings: [{ x0: 30, x1: 34, h: 3.2, roof: 1.6, kind: 'hut' }], thermals: [], ridges: [],
    wind: { speed: 8.2, gust: 0.34, lull: 0.55, lullOften: 0.35, gustLen: 34, rough: 0.07 },
    start: 18, walk: [8, 46], width: 130,
    paint: { grass: '#e7d39a', grassDark: '#c9a86a', soil: '#d8bd84', far: '#8fc0c8', flower: '#7aa05a' },
  },
  hilltop: {
    id: 'hilltop', name: 'High Downs', feature: 'thermals over warm fields', blurb: 'A light breeze, but the sun-warmed fields send up thermals. Find the rising air to climb high.',
    ground: [[-20, 8], [10, 9], [24, 9.6], [40, 7.5], [60, 4], [80, 2.5], [120, 2], [170, 2.5]],
    water: [],
    trees: [{ x: -8, h: 4.5, r: 2.6, kind: 'pine' }, { x: 98, h: 6, r: 3.2, kind: 'oak' }],
    buildings: [],
    thermals: [{ x: 44, w: 6, lift: 3.6, period: 22, phase: 0 }, { x: 70, w: 7, lift: 4.2, period: 26, phase: 0.45 }, { x: 96, w: 5, lift: 3.2, period: 18, phase: 0.75 }],
    ridges: [],
    wind: { speed: 4.4, gust: 0.16, lull: 0.42, lullOften: 0.3, gustLen: 40, rough: 0.04 },
    start: 22, walk: [12, 52], width: 140,
    paint: { grass: '#b4c86a', grassDark: '#6f8e3c', soil: '#c9b27a', far: '#d8d49a', flower: '#f2e15a' },
  },
  fete: {
    id: 'fete', name: 'Village Fête', feature: 'rooftops and bunting', blurb: 'Cottages and marquees make the wind roll and tumble. Mind the rooftops; the bubbles drift in from the stalls.',
    ground: [[-20, 2], [57, 2], [61, 0.8], [67, 0.8], [71, 2], [160, 2]],
    water: [[58, 70, 1.6]],
    trees: [{ x: -12, h: 7, r: 4, kind: 'oak' }],
    buildings: [{ x0: 28, x1: 34, h: 4, roof: 3.2, kind: 'cottage' }, { x0: 40, x1: 47, h: 3.6, roof: 2.4, kind: 'tent' }, { x0: 52, x1: 55, h: 2.4, roof: 1.6, kind: 'stall' }, { x0: 72, x1: 82, h: 5, roof: 4, kind: 'cottage' }],
    thermals: [], ridges: [],
    wind: { speed: 6, gust: 0.25, lull: 0.3, lullOften: 0.2, gustLen: 28, rough: 0.05 },
    start: 18, walk: [10, 46], width: 130,
    paint: { grass: '#92c46a', grassDark: '#548a3e', soil: '#a88050', far: '#a8c4a0', flower: '#ef7fa8' },
  },
  cliffs: {
    id: 'cliffs', name: 'Festival Cliffs', feature: 'the sea breeze and the cliff updraft', blurb: 'The sea breeze climbs the clifftop meadow and lifts at the edge. The great Kite Festival is here.',
    ground: [[-20, 14], [20, 14.2], [44, 14.6], [50, 13.6], [54, 2], [60, -2], [180, -2]],
    water: [[55, 190, 0]],
    trees: [{ x: -10, h: 5, r: 2.8, kind: 'pine' }],
    buildings: [{ x0: 2, x1: 8, h: 3.4, roof: 2.6, kind: 'tent' }],
    thermals: [], ridges: [[47, 8, 3]],
    wind: { speed: 6.4, gust: 0.22, lull: 0.25, lullOften: 0.15, gustLen: 36, rough: 0.04 },
    start: 24, walk: [16, 44], width: 120,
    paint: { grass: '#8cbf6a', grassDark: '#4e8440', soil: '#b89a6a', far: '#c9b8c8', flower: '#f4a65a' },
  },
};

// ---------------------------------------------------------------- noise (seeded, smooth, no Math.random)
/** A 32-bit integer hash. */
export function hash(n: number): number {
  let h = Math.imul(n | 0, 0x27d4eb2d) ^ 0x165667b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const lattice = (seed: number, i: number) => (hash(seed * 7919 + i * 104729 + 13) / 4294967296) * 2 - 1;
/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lattice(seed, i) * (1 - u) + lattice(seed, i + 1) * u;
}
/** Two octaves, a little rougher. */
export const noise2 = (seed: number, x: number) => noise1(seed, x) * 0.7 + noise1(seed + 31, x * 2.3 + 5.1) * 0.3;
/** A seeded random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bell = (x: number) => Math.exp(-x * x);

// ---------------------------------------------------------------- the ground
/** The ground height at x (smooth through the control points). */
export function groundAt(P: Place, x: number): number {
  const g = P.ground;
  if (x <= g[0][0]) return g[0][1];
  for (let i = 1; i < g.length; i++) {
    if (x <= g[i][0]) { const [x0, y0] = g[i - 1], [x1, y1] = g[i], t = (x - x0) / (x1 - x0), u = t * t * (3 - 2 * t); return y0 + (y1 - y0) * u; }
  }
  return g[g.length - 1][1];
}
/** The water at x, if any: its surface height. */
export function waterAt(P: Place, x: number): number | null {
  for (const [x0, x1, h] of P.water) if (x >= x0 && x <= x1 && groundAt(P, x) < h) return h;
  return null;
}
/** The surface a falling kite lands on: the ground or the water. */
export const surfaceAt = (P: Place, x: number) => Math.max(groundAt(P, x), waterAt(P, x) ?? -1e9);
export const treeCanopy = (P: Place, t: Tree): [number, number, number] => [t.x, groundAt(P, t.x) + t.h, t.r];

// ---------------------------------------------------------------- the wind
export type WindSample = { u: number; w: number; gust: number; lull: number; shelter: number; lift: number };
/** The obstacles that shelter the air behind them: trees and buildings, as [x0, x1, top]. */
function blockers(P: Place): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const t of P.trees) out.push([t.x - t.r * 0.8, t.x + t.r * 0.8, groundAt(P, t.x) + t.h + t.r * 0.7]);
  for (const b of P.buildings) out.push([b.x0, b.x1, groundAt(P, (b.x0 + b.x1) / 2) + b.h + b.roof]);
  return out;
}
const BLOCK = new Map<PlaceId, [number, number, number][]>();
const blocks = (P: Place) => { let b = BLOCK.get(P.id); if (!b) { b = blockers(P); BLOCK.set(P.id, b); } return b; };

/** The gust factor at x and time t: gusts travel downwind at the mean wind speed, and now and then a lull rolls in. */
export function gustAt(P: Place, seed: number, x: number, t: number): { gust: number; lull: number } {
  const W = P.wind, s = (x - W.speed * t) / W.gustLen;
  const gust = W.gust * noise2(seed, s);
  // a lull: a slow noise that, when it dips low enough, calms the wind for a few seconds
  const ln = noise1(seed + 101, (x - W.speed * t) / (W.gustLen * 3.2));
  const lull = W.lull * smooth(1 - W.lullOften * 0.9 - 0.15, 1 - W.lullOften * 0.9 + 0.25, -ln * 0.5 + 0.5);
  return { gust, lull };
}

/** The wind at a point: horizontal speed u and vertical speed w, with what made it (for the scene and the tests). */
export function windAt(P: Place, seed: number, x: number, y: number, t: number): WindSample {
  const W = P.wind, g = groundAt(P, x), above = Math.max(0, y - g);
  // speed grows with height over the ground (a soft log profile), with gusts and lulls riding on it
  const shear = 0.55 + 0.45 * smooth(0, 12, above);
  const { gust, lull } = gustAt(P, seed, x, t);
  let u = W.speed * shear * (1 + gust) * (1 - lull);
  let w = 0, shelter = 0, lift = 0;
  // the air behind a tree or a building is slowed and tumbles in a rotor
  for (const [x0, x1, top] of blocks(P)) {
    const h = top - g; if (h <= 0) continue;
    if (x > x0 - 0.5 && x < x1 + h * 2.6 && y < top + h * 0.3) {
      const behind = x < x1 ? 1 : 1 - smooth(h * 0.8, h * 2.6, x - x1);
      const low = 1 - smooth(top - h * 0.1, top + h * 0.35, y);
      const k = behind * low; if (k <= 0) continue;
      shelter = Math.max(shelter, k);
      const tq = W.speed * 0.55 * k;
      u -= u * 0.5 * k;
      u += tq * noise1(seed + 211 + Math.round(x0), x * 0.45 + t * 1.6) * 0.8;
      w += tq * noise1(seed + 307 + Math.round(x0), x * 0.5 - t * 1.9 + y * 0.3);
    }
  }
  // thermals: columns of rising air over warm fields that breathe on and off and drift with the wind
  for (const th of P.thermals) {
    const on = 0.5 + 0.5 * Math.sin((t / th.period + th.phase) * Math.PI * 2);
    const cx = th.x + Math.sin((t / th.period + th.phase) * Math.PI) * 3;
    const k = bell((x - cx) / th.w) * smooth(0, 4, above) * (0.25 + 0.75 * on);
    const l = th.lift * k; w += l; lift += l;
  }
  // ridge lift where the wind climbs a cliff
  for (const [rx, rw, rl] of P.ridges) { const l = rl * bell((x - rx) / rw) * smooth(0, 3, above) * (1 - smooth(18, 34, above)) * (1 - lull * 0.6); w += l; lift += l; }
  // small swirls everywhere
  if (W.rough > 0) {
    u += W.speed * W.rough * noise1(seed + 401, x * 0.31 - t * 2.1 + y * 0.17);
    w += W.speed * W.rough * noise1(seed + 503, x * 0.27 + t * 1.7 - y * 0.21);
  }
  return { u, w, gust, lull, shelter, lift };
}

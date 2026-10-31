// Powder Paws: the mountain. Whiskerpeak is generated in chunks, each from its own seed, so any part of it can be
// built on its own and a seed always gives the same mountain. A smooth "fall line" winds down the slope (a sum of
// slow sines, never steeper than 45 degrees); every obstacle keeps clear of it, so there is always a way through.
// Jumps clear a landing strip below them, fences leave a gap on the line, and hidden cabins sit in clearings off the
// edge of the piste behind a gap in the trees. Slalom courses and the Big Air park use the same chunks with their
// own recipes. Units are art pixels: ten to a metre.

export const HALF = 170;           // the groomed piste runs from -HALF to HALF
export const EDGE = 64;            // the band of edge forest beyond it
export const CH = 480;             // chunk height
export const PX_PER_M = 10;
/** Where the hidden cabins stand on a freeride mountain, in metres down from the top. */
export const CABIN_M = [260, 620, 1020, 1460, 1940, 2460, 3020, 3620, 4260, 4940];
export const CABINS = [
  { name: 'Thimble Hut', note: 'A tiny hut with one window and a kettle that is always warm.' },
  { name: 'Pinecone Bothy', note: 'Somebody has lined every shelf with pinecones, sorted by size.' },
  { name: 'The Mitten Exchange', note: 'Leave a lost mitten, take a lost mitten. Dora finds a matching pair.' },
  { name: 'Owl’s Lookout', note: 'An old owl keeps the logbook and stamps every visitor’s paw.' },
  { name: 'Marshmallow Cabin', note: 'The cocoa here comes with exactly three marshmallows. Enzo counts.' },
  { name: 'Snowshoe Lodge', note: 'Snowshoes on the wall, tall enough for a moose, small enough for a vole.' },
  { name: 'The Lantern House', note: 'Forty lanterns, one for every winter the house has stood.' },
  { name: 'Hare & Kettle', note: 'The hares run a tea room. Their scones are mostly crumbs.' },
  { name: 'Frostfern Chalet', note: 'Ferns of frost on every pane, and a quilt big enough for two.' },
  { name: 'The Summit Post', note: 'The last postbox before the lodge, painted the brightest red.' },
] as const;

export class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next() { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n: number) { return Math.floor(this.next() * n); }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  pick<T>(xs: readonly T[]): T { return xs[this.int(xs.length)]; }
}
export function hash(...ns: number[]) {
  let h = 0x811c9dc5;
  for (const n of ns) { h ^= n | 0; h = Math.imul(h, 0x01000193); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; }
  return h >>> 0;
}

export type Solid = 'pine' | 'pineS' | 'birch' | 'rock' | 'stump' | 'fence' | 'hut' | 'cabin' | 'pole' | 'sign' | 'bank';
export type Ob = { k: Solid; x: number; y: number; r: number; h: number; w?: number; d?: number; v?: number; i?: number };
export type AreaKind = 'powder' | 'ice' | 'moguls';
export type Area = { k: AreaKind; x: number; y: number; rx: number; ry: number };
export type Ramp = { k: 'kick' | 'big'; x: number; y: number; w: number };
export type Gate = { i: number; x: number; y: number; w: number; red: boolean };
export type Npc = { k: 'skier' | 'rabbit' | 'hedgehog' | 'stoat'; x: number; y: number; vx: number; vy: number; ph: number; id: number };
export type Zone = 'start' | 'groomer' | 'forest' | 'moguls' | 'pond' | 'park' | 'village' | 'powder' | 'slalom' | 'air' | 'finish';
export type Chunk = { i: number; zone: Zone; obs: Ob[]; areas: Area[]; ramps: Ramp[]; gates: Gate[]; npcs: Npc[]; cabin: number };

export type Mode = 'free' | 'slalom' | 'air' | 'daily';
export type Course = { name: string; blurb: string; len: number; seed: number; gap: number; spread: number; trees: number; ice?: boolean };
/** The six slalom courses: length in chunks, gate width, how far the gates swing, how many trees line the course. */
export const SLALOM: Course[] = [
  { name: 'Nursery Gates', blurb: 'Wide gates on a gentle hill.', len: 6, seed: 101, gap: 70, spread: 60, trees: 3 },
  { name: 'Birchwood Bends', blurb: 'The gates wind through silver birches.', len: 7, seed: 202, gap: 62, spread: 80, trees: 6 },
  { name: 'Icicle Run', blurb: 'Fast and glassy: ice between the gates.', len: 7, seed: 303, gap: 60, spread: 85, trees: 4, ice: true },
  { name: 'The Corkscrew', blurb: 'Tight gates that swing wide.', len: 8, seed: 404, gap: 54, spread: 110, trees: 6 },
  { name: 'Hedgehog Hollow', blurb: 'Tea trays and toboggans share the hill.', len: 8, seed: 505, gap: 54, spread: 100, trees: 7 },
  { name: 'Whiskerpeak Cup', blurb: 'The championship course. Narrow, long and quick.', len: 10, seed: 606, gap: 54, spread: 100, trees: 8, ice: true },
];
export const AIR_LEN = 9;
export const AIR_SEED = 777;

/** The winding line that always stays clear: where it crosses height y. Never steeper than 45 degrees. */
export function lineX(seed: number, y: number, amp = 1) {
  const a = (hash(seed, 1) % 6283) / 1000, b = (hash(seed, 2) % 6283) / 1000, c = (hash(seed, 3) % 6283) / 1000;
  const x = 60 * Math.sin(y / 150 + a) + 24 * Math.sin(y / 80 + b) + 10 * Math.sin(y / 45 + c);
  return Math.max(-HALF + 34, Math.min(HALF - 34, x * amp * Math.min(1, 0.35 + Math.max(0, y) / 1600)));
}
/** How steep the mountain is at height y (1 is an ordinary blue run). */
export function pitch(seed: number, y: number) {
  const a = (hash(seed, 9) % 6283) / 1000;
  return 1 + 0.16 * Math.sin(y / 1900 + a) + 0.08 * Math.sin(y / 640 + a * 2) + Math.min(0.12, Math.max(0, y) / 60000);
}

export type WorldSpec = { mode: Mode; seed: number; course: number };
function zoneFor(spec: WorldSpec, i: number): Zone {
  if (spec.mode === 'slalom') return i >= SLALOM[spec.course].len ? 'finish' : i === 0 ? 'start' : 'slalom';
  if (spec.mode === 'air') return i >= AIR_LEN ? 'finish' : i === 0 ? 'start' : 'air';
  if (i <= 1) return 'start';
  if (i === 2) return 'park';
  const r = new Rng(hash(spec.seed, i, 77));
  const d = Math.min(1, i / 50);
  const table: [Zone, number][] = [['groomer', 2.4 - d], ['forest', 1.6 + d], ['moguls', 1], ['pond', 0.8], ['park', 1.2], ['village', 1], ['powder', 1]];
  let t = r.next() * table.reduce((n, [, w]) => n + w, 0);
  for (const [z, w] of table) { t -= w; if (t <= 0) return z; }
  return 'groomer';
}
/** Which cabin (if any) has its clearing in chunk i, and on which side. */
export function cabinAt(spec: WorldSpec, i: number) {
  if (spec.mode === 'slalom' || spec.mode === 'air') return null;
  const k = CABIN_M.findIndex((m) => Math.round((m * PX_PER_M) / CH) === i);
  if (k < 0) return null;
  const side = hash(spec.seed, k, 31) & 1 ? 1 : -1;
  return { k, side, x: side * (HALF + 84), y: i * CH + 250 };
}
/** The ramps of chunk i (decided before anything else, so neighbours can keep their landings clear). */
export function rampsOf(spec: WorldSpec, i: number): Ramp[] {
  const z = zoneFor(spec, i), r = new Rng(hash(spec.seed, i, 5)), out: Ramp[] = [];
  const y0 = i * CH;
  const at = (y: number, k: Ramp['k']) => out.push({ k, x: Math.round(lineX(spec.seed, y, amp(spec))), y, w: k === 'big' ? 46 : 32 });
  if (z === 'park') { at(y0 + 60 + r.int(60), 'kick'); if (i > 4 && r.next() < 0.6) at(y0 + 330 + r.int(40), 'big'); }
  else if (z === 'air') { at(y0 + 40 + r.int(30), i % 2 ? 'big' : 'kick'); if (i % 3 === 1) at(y0 + 300, 'kick'); }
  else if ((z === 'groomer' || z === 'powder') && r.next() < 0.35) at(y0 + 80 + r.int(200), 'kick');
  return out;
}
function amp(spec: WorldSpec) { return spec.mode === 'slalom' ? 0.5 : spec.mode === 'air' ? 0.35 : 1; }
/** The rectangles below every ramp that must stay clear for a landing. */
function landings(spec: WorldSpec, i: number) {
  const out: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const j of [i - 1, i]) for (const p of rampsOf(spec, j)) {
    const len = p.k === 'big' ? 520 : 330;
    out.push({ x0: p.x - 70, x1: p.x + 70, y0: p.y - 30, y1: p.y + len });
  }
  return out;
}

export function makeChunk(spec: WorldSpec, i: number): Chunk {
  const zone = zoneFor(spec, i), r = new Rng(hash(spec.seed, i, 11)), y0 = i * CH, A = amp(spec);
  const obs: Ob[] = [], areas: Area[] = [], gates: Gate[] = [], npcs: Npc[] = [];
  const ramps = rampsOf(spec, i), lands = landings(spec, i), cab = cabinAt(spec, i);
  const d = spec.mode === 'free' || spec.mode === 'daily' ? Math.min(1, i / 45) : 0.4;
  const L = (y: number) => lineX(spec.seed, y, A);
  /** Is (x, y) with radius rad clear of the line, the landings and the ramps? */
  const free = (x: number, y: number, rad: number, band = 24) => {
    if (Math.abs(x - L(y)) < band + rad) return false;
    // the line can bend under a tall obstacle: check a little above and below too
    if (Math.abs(x - L(y - rad)) < band + rad || Math.abs(x - L(y + rad)) < band + rad) return false;
    for (const q of lands) if (x + rad > q.x0 && x - rad < q.x1 && y + rad > q.y0 && y - rad < q.y1) return false;
    for (const o of obs) if (Math.hypot(o.x - x, o.y - y) < o.r + rad + 10) return false;
    return true;
  };
  const put = (k: Solid, n: number, opt: { r: number; h: number; band?: number; x0?: number; x1?: number }) => {
    for (let t = 0, made = 0; t < n * 6 && made < n; t++) {
      const x = r.range(opt.x0 ?? -HALF + 6, opt.x1 ?? HALF - 6), y = y0 + r.range(10, CH - 10);
      if (!free(x, y, opt.r, opt.band)) continue;
      obs.push({ k, x: Math.round(x), y: Math.round(y), r: opt.r, h: opt.h, v: r.int(4) }); made++;
    }
  };
  const tree = (n: number) => { put('pine', Math.round(n * 0.55), { r: 7, h: 40 }); put('pineS', Math.round(n * 0.25), { r: 5, h: 24 }); put('birch', Math.round(n * 0.2), { r: 4, h: 40 }); };
  const area = (k: AreaKind, rx: number, ry: number) => {
    const x = r.range(-HALF + rx * 0.6, HALF - rx * 0.6), y = y0 + r.range(ry, CH - ry);
    areas.push({ k, x: Math.round(x), y: Math.round(y), rx, ry });
  };
  const npc = (k: Npc['k'], vy: number, vx = 0) => {
    const x = r.range(-HALF + 30, HALF - 30), y = y0 + r.range(40, CH - 40);
    npcs.push({ k, x, y, vx, vy, ph: r.range(0, 6.28), id: i * 10 + npcs.length });
  };
  switch (zone) {
    case 'start': tree(8); if (spec.mode === 'free' || spec.mode === 'daily') put('rock', 1, { r: 7, h: 8 }); break;
    case 'groomer': tree(9 + d * 6); put('rock', 3, { r: 7, h: 8 }); put('stump', 1, { r: 5, h: 6 }); put('bank', 1, { r: 14, h: 10 }); if (r.next() < 0.6) npc('skier', 95 + r.int(30)); if (r.next() < 0.3) npc('stoat', 80 + r.int(30)); break;
    case 'forest': tree(18 + d * 14); put('stump', 2, { r: 5, h: 6 }); if (r.next() < 0.4) npc('hedgehog', 55); break;
    case 'moguls': area('moguls', 70 + r.int(40), 110 + r.int(60)); tree(7 + d * 4); put('rock', 2, { r: 7, h: 8 }); if (r.next() < 0.5) npc('skier', 90); break;
    case 'pond': area('ice', 50 + r.int(30), 34 + r.int(20)); if (r.next() < 0.7) area('ice', 36 + r.int(20), 26 + r.int(10)); tree(9 + d * 5); put('rock', 3, { r: 7, h: 8 }); break;
    case 'park': tree(6 + d * 3); put('bank', 2, { r: 14, h: 10 }); if (r.next() < 0.5) npc('rabbit', 75, 40); break;
    case 'village': {
      put('hut', 1 + r.int(2), { r: 20, h: 40 });
      for (const o of obs) if (o.k === 'hut') { o.w = 34; o.d = 26; }
      // a fence across the slope with a gate where the line runs
      const fy = y0 + 120 + r.int(240), fx = L(fy), gap = 40 - d * 6;
      for (let x = -HALF + 4; x < HALF - 4; x += 28) {
        const cx = x + 14; if (Math.abs(cx - fx) < gap / 2 + 14) continue;
        if (lands.some((q) => cx + 14 > q.x0 && cx - 14 < q.x1 && fy > q.y0 && fy < q.y1)) continue;
        obs.push({ k: 'fence', x: cx, y: fy, r: 14, h: 10, w: 28, d: 5 });
      }
      put('stump', 2, { r: 5, h: 6 }); tree(4 + d * 4);
      npc('rabbit', 70, r.next() < 0.5 ? -45 : 45); if (r.next() < 0.6) npc('rabbit', 80, 30);
      break;
    }
    case 'powder': area('powder', 60 + r.int(30), 50 + r.int(30)); if (r.next() < 0.6) area('powder', 40 + r.int(20), 40); put('birch', 9 + d * 6, { r: 4, h: 40 }); put('pineS', 4, { r: 5, h: 24 }); npc('hedgehog', 50); break;
    case 'slalom': {
      const c = SLALOM[spec.course];
      for (let g = 0; g < 3; g++) {
        const gy = y0 + 80 + g * 150, k = (i - 1) * 3 + g, side = k % 2 ? 1 : -1;
        const gx = Math.round(L(gy) + side * c.spread * 0.4 + (r.next() - 0.5) * 20);
        const cx = Math.max(-HALF + c.gap, Math.min(HALF - c.gap, gx));
        gates.push({ i: k, x: cx, y: gy, w: c.gap, red: side > 0 });
        obs.push({ k: 'pole', x: cx - c.gap / 2, y: gy, r: 2, h: 30 }, { k: 'pole', x: cx + c.gap / 2, y: gy, r: 2, h: 30 });
      }
      if (c.ice && i % 2 === 0) areas.push({ k: 'ice', x: Math.round(L(y0 + 240)), y: y0 + 240, rx: 70, ry: 60 });
      for (let t = 0, made = 0; t < 80 && made < c.trees; t++) {
        const x = r.range(-HALF + 6, HALF - 6), y = y0 + r.range(10, CH - 10);
        if (gates.some((g) => Math.abs(y - g.y) < 40 && Math.abs(x - g.x) < g.w / 2 + 50) || !free(x, y, 7, 70)) continue;
        obs.push({ k: r.next() < 0.6 ? 'pine' : 'birch', x: Math.round(x), y: Math.round(y), r: 6, h: 40, v: r.int(4) }); made++;
      }
      if (spec.course === 4) { npc('hedgehog', 50); npc('rabbit', 70, 40); }
      break;
    }
    case 'air': tree(6); put('bank', 1, { r: 14, h: 10 }); if (i % 2 === 0) areas.push({ k: 'moguls', x: Math.round(L(y0 + 420)), y: y0 + 430, rx: 60, ry: 40 }); break;
    case 'finish': tree(2); break;
  }
  // the edge forest: thick pines just off the piste, broken by a cabin's clearing
  for (const side of [-1, 1]) {
    for (let y = y0 + 8 + r.int(10); y < y0 + CH; y += 18 + r.int(14)) {
      if (cab && cab.side === side && y > cab.y - 170 && y < cab.y + 190) continue;
      const x = side * (HALF + 10 + r.int(EDGE - 18));
      obs.push({ k: r.next() < 0.75 ? 'pine' : 'pineS', x, y, r: 7, h: 40, v: r.int(4) });
      if (r.next() < 0.55) obs.push({ k: 'pine', x: side * (HALF + 30 + r.int(EDGE - 6)), y: y + 9, r: 7, h: 40, v: r.int(4) });
    }
  }
  if (cab) {
    obs.push({ k: 'cabin', x: cab.x, y: cab.y, r: 30, h: 50, w: 56, d: 34, i: cab.k });
    obs.push({ k: 'sign', x: cab.side * (HALF - 14), y: cab.y - 250, r: 0, h: 20, v: cab.side });
    // the clearing is closed off beyond the cabin
    for (let y = cab.y - 170; y < cab.y + 190; y += 22) obs.push({ k: 'pine', x: cab.side * (HALF + 168), y, r: 7, h: 40, v: (y >> 3) & 3 });
    obs.push({ k: 'pineS', x: cab.side * (HALF + 40), y: cab.y + 120, r: 5, h: 24, v: 1 });
  }
  if (zone === 'start' && i === 0 && (spec.mode === 'slalom' || spec.mode === 'air')) { /* the start hut sits above the slope */ }
  obs.sort((a, b) => a.y - b.y);
  return { i, zone, obs, areas, ramps, gates, npcs, cabin: cab ? cab.k : -1 };
}

/** The length of a course in pixels (slalom and Big Air end at a finish line). */
export function courseLength(spec: WorldSpec) {
  if (spec.mode === 'slalom') return SLALOM[spec.course].len * CH + 40;
  if (spec.mode === 'air') return AIR_LEN * CH + 40;
  return Infinity;
}
export function gateCount(spec: WorldSpec) { return spec.mode === 'slalom' ? (SLALOM[spec.course].len - 1) * 3 : 0; }

// Pawpark Skate: the rules. Three parks built from simple pieces (ledges and boxes, kickers and banks, quarter-pipes
// with a lip you can launch straight up from and land back in, rails, holes between rooftops), a board that rolls on
// them with gravity, ollies, flip tricks, grabs, spins, grinds and manuals strung into combos, gaps, collectables and
// goals. Deterministic at 60 Hz with no DOM: the scene draws it, the page feeds it input, the bots and tests drive it.

export const DT = 1 / 60;
export const G = 14;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
type V3 = { x: number; y: number; z: number };
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);

// ---------------------------------------------------------------- the parks
export type Axis = 'x' | 'z';
/** A box: a ledge, a planter, a deck, a funbox top. Its top edges are grindable when `grind` is set. */
export type Box = { k: 'box'; x0: number; z0: number; x1: number; z1: number; h: number; grind?: boolean; look?: string; name?: string };
/** A flat slope across the rectangle along `axis`, from h0 at the low-coordinate side to h1 at the high side. */
export type Ramp = { k: 'ramp'; x0: number; z0: number; x1: number; z1: number; axis: Axis; h0: number; h1: number; look?: string };
/** A quarter-pipe: a curve of radius r rising to height h, starting at `at` along `axis` and rising in direction `dir`,
 * spanning c0..c1 across. Its lip (the top edge) is a grindable coping. */
export type Qp = { k: 'qp'; axis: Axis; at: number; dir: 1 | -1; c0: number; c1: number; r: number; h: number };
/** A hole in the ground: fall in and you bail. */
export type Hole = { k: 'hole'; x0: number; z0: number; x1: number; z1: number };
export type Piece = Box | Ramp | Qp | Hole;
export type Rail = { id: number; a: V3; b: V3; name?: string; kind: 'rail' | 'ledge' | 'coping' };
export type Zone = { x0: number; z0: number; x1: number; z1: number };
export type Gap = { id: string; name: string; from: Zone; to: Zone; points: number; both?: boolean; grind?: string };
export type ParkId = 'plaza' | 'hill' | 'roofs';
export type GoalKind = 'score' | 'pro' | 'combo' | 'acorns' | 'gap' | 'trick';
export type Goal = { id: string; kind: GoalKind; text: string; n?: number; gap?: string; trick?: string; who: 'badger' | 'raccoon' | 'otter' | 'enzo' };
export type Park = {
  id: ParkId; name: string; place: string; w: number; d: number; pieces: Piece[]; rails: Rail[]; gaps: Gap[];
  acorns: V3[]; start: { x: number; z: number; yaw: number }; goals: Goal[]; unlock: number; sky: string;
};

function qpLen(q: Qp) { const h = Math.min(q.h, q.r * 0.97); return Math.sqrt(q.r * q.r - (q.r - h) * (q.r - h)); }
/** the rectangle a quarter-pipe covers */
export function qpRect(q: Qp): Zone {
  const L = qpLen(q), a = q.at, b = q.at + q.dir * L, lo = Math.min(a, b), hi = Math.max(a, b);
  return q.axis === 'x' ? { x0: lo, x1: hi, z0: q.c0, z1: q.c1 } : { x0: q.c0, x1: q.c1, z0: lo, z1: hi };
}

/** Rails, ledge edges and copings, built from a park's pieces plus its own rails. */
function buildRails(pieces: Piece[], extra: Omit<Rail, 'id'>[]): Rail[] {
  const out: Rail[] = [];
  const add = (r: Omit<Rail, 'id'>) => out.push({ ...r, id: out.length });
  for (const p of pieces) {
    if (p.k === 'box' && p.grind) {
      const { x0, z0, x1, z1, h } = p;
      add({ a: { x: x0, y: h, z: z0 }, b: { x: x1, y: h, z: z0 }, kind: 'ledge', name: p.name });
      add({ a: { x: x0, y: h, z: z1 }, b: { x: x1, y: h, z: z1 }, kind: 'ledge', name: p.name });
      add({ a: { x: x0, y: h, z: z0 }, b: { x: x0, y: h, z: z1 }, kind: 'ledge', name: p.name });
      add({ a: { x: x1, y: h, z: z0 }, b: { x: x1, y: h, z: z1 }, kind: 'ledge', name: p.name });
    }
    if (p.k === 'qp') {
      const L = qpLen(p), e = p.at + p.dir * L, h = Math.min(p.h, p.r * 0.97);
      if (p.axis === 'x') add({ a: { x: e, y: h, z: p.c0 }, b: { x: e, y: h, z: p.c1 }, kind: 'coping' });
      else add({ a: { x: p.c0, y: h, z: e }, b: { x: p.c1, y: h, z: e }, kind: 'coping' });
    }
  }
  for (const r of extra) add(r);
  return out;
}

const box = (x0: number, z0: number, x1: number, z1: number, h: number, o: Partial<Box> = {}): Box => ({ k: 'box', x0, z0, x1, z1, h, ...o });
const ramp = (x0: number, z0: number, x1: number, z1: number, axis: Axis, h0: number, h1: number, look?: string): Ramp => ({ k: 'ramp', x0, z0, x1, z1, axis, h0, h1, look });
const qp = (axis: Axis, at: number, dir: 1 | -1, c0: number, c1: number, r: number, h: number): Qp => ({ k: 'qp', axis, at, dir, c0, c1, r, h });
/** a quarter-pipe with its deck behind it, out to `to` */
function qpDeck(axis: Axis, at: number, dir: 1 | -1, c0: number, c1: number, r: number, h: number, to: number): Piece[] {
  const q = qp(axis, at, dir, c0, c1, r, h), e = at + dir * qpLen(q), hh = Math.min(h, r * 0.97);
  const lo = Math.min(e, to), hi = Math.max(e, to);
  return [q, axis === 'x' ? box(lo, c0, hi, c1, hh, { look: 'deck' }) : box(c0, lo, c1, hi, hh, { look: 'deck' })];
}
const rail = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, name?: string): Omit<Rail, 'id'> => ({ a: { x: ax, y: ay, z: az }, b: { x: bx, y: by, z: bz }, kind: 'rail', name });
const zone = (x0: number, z0: number, x1: number, z1: number): Zone => ({ x0, z0, x1, z1 });

function makePark(p: Omit<Park, 'rails'> & { extraRails: Omit<Rail, 'id'>[] }): Park {
  const { extraRails, ...rest } = p;
  return { ...rest, rails: buildRails(p.pieces, extraRails) };
}

export const PARKS: Park[] = [
  makePark({
    id: 'plaza', name: 'Pawpark Plaza', place: 'the town square, on market-free Sundays', w: 64, d: 64, unlock: 0, sky: '#8fd3ff',
    start: { x: 0, z: -22, yaw: 0 },
    pieces: [
      // the fountain in the middle, with a kicker on each side to clear it
      box(-2.2, -2.2, 2.2, 2.2, 0.7, { grind: true, look: 'fountain', name: 'Fountain' }),
      ramp(-2, -5.8, 2, -4, 'z', 0, 1.25, 'kicker'), ramp(-2, 4, 2, 5.8, 'z', 1.25, 0, 'kicker'),
      // the town hall steps: a bank down from the terrace with a handrail
      box(-30, 14, -12, 32, 1.4, { look: 'terrace' }), ramp(-24, 9, -14, 14, 'z', 0, 1.4, 'steps'),
      // ledges and benches
      box(10, -13, 24, -12.4, 0.5, { grind: true, look: 'ledge', name: 'Long Ledge' }),
      box(9, 2, 9.7, 16, 0.45, { grind: true, look: 'ledge', name: 'Market Ledge' }),
      box(14, 18, 18, 18.6, 0.45, { grind: true, look: 'bench' }), box(-8, -20, -4, -19.4, 0.45, { grind: true, look: 'bench' }),
      box(-24, -24, -19, -19, 0.8, { grind: true, look: 'planter' }), box(19, -24, 24, -19, 0.8, { grind: true, look: 'planter' }),
      // quarter-pipes along the east and the south
      ...qpDeck('x', 26, 1, -16, 12, 3, 2.6, 32),
      ...qpDeck('z', -26, -1, -14, 14, 3, 2.4, -32),
      // a bank and a funbox by the café
      ramp(16, 22, 24, 26, 'z', 0, 1.2, 'bank'), box(16, 26, 24, 32, 1.2, { look: 'terrace', grind: true, name: 'Café Wall' }),
    ],
    extraRails: [rail(-19, 2.4, 14, -19, 1.0, 9, 'Hall Handrail'), rail(-6, 0.7, 20, 6, 0.7, 20, 'Flat Rail'), rail(-27, 1.1, -6, -27, 1.1, 8, 'Bike Rack Rail')],
    gaps: [
      { id: 'fountain', name: 'Fountain Gap', from: zone(-3, -6, 3, -3), to: zone(-4, 2.3, 4, 14), points: 400, both: true },
      { id: 'steps', name: 'Hall Steps Gap', from: zone(-30, 14, -12, 17), to: zone(-30, -2, -12, 8), points: 300 },
      { id: 'handrail', name: 'Hall Handrail', from: zone(-30, 9, -12, 15), to: zone(-30, -2, -12, 9), points: 350, grind: 'Hall Handrail' },
      { id: 'cafe', name: 'Café Drop', from: zone(16, 28, 24, 32), to: zone(8, 14, 26, 21), points: 250 },
    ],
    acorns: [{ x: 0, y: 3.2, z: 0 }, { x: 28.8, y: 5.0, z: -2 }, { x: -19, y: 3.4, z: 11.5 }, { x: 17, y: 1.6, z: -12.7 }, { x: 0, y: 4.6, z: -28.8 }],
    goals: [
      { id: 'plaza-score', kind: 'score', n: 6000, text: 'Score 6,000 in a session', who: 'badger' },
      { id: 'plaza-pro', kind: 'pro', n: 18000, text: 'Score 18,000 in a session', who: 'badger' },
      { id: 'plaza-combo', kind: 'combo', n: 2500, text: 'Land a 2,500 combo', who: 'raccoon' },
      { id: 'plaza-acorns', kind: 'acorns', text: 'Collect all five golden acorns', who: 'enzo' },
      { id: 'plaza-gap', kind: 'gap', gap: 'handrail', text: 'Grind the Hall Handrail all the way down', who: 'raccoon' },
      { id: 'plaza-trick', kind: 'trick', gap: 'fountain', trick: 'flip', text: 'Flip trick over the Fountain Gap', who: 'badger' },
    ],
  }),
  makePark({
    id: 'hill', name: 'Cloverdrop Hill', place: 'the concrete park above the lighthouse', w: 70, d: 70, unlock: 3, sky: '#ffd9a8',
    start: { x: 0, z: -24, yaw: 0 },
    pieces: [
      // the big halfpipe
      ...qpDeck('x', -7, -1, -30, -8, 3.6, 3.4, -14), ...qpDeck('x', 7, 1, -30, -8, 3.6, 3.4, 14),
      // a pyramid funbox with a rail along the top
      box(-3, 5, 3, 11, 1.1, { grind: true, look: 'funbox', name: 'Pyramid' }),
      ramp(-3, 3, 3, 5, 'z', 0, 1.1, 'funbox'), ramp(-3, 11, 3, 13, 'z', 1.1, 0, 'funbox'),
      ramp(-5, 5, -3, 11, 'x', 0, 1.1, 'funbox'), ramp(3, 5, 5, 11, 'x', 1.1, 0, 'funbox'),
      // the mini ramp in the north
      ...qpDeck('z', 22, 1, -10, 10, 2.2, 1.8, 26), ...qpDeck('z', 14, -1, -10, 10, 2.2, 1.8, 10.5),
      // a hip of banks in the east, a long ledge in the west
      ramp(20, -6, 26, 14, 'x', 0, 1.6, 'bank'), box(26, -6, 35, 14, 1.6, { look: 'deck', grind: true, name: 'Lighthouse Deck' }),
      box(-26, 4, -25.4, 26, 0.55, { grind: true, look: 'ledge', name: 'Clover Ledge' }),
      // the big kicker over the hedge
      ramp(14, 21.6, 18, 24, 'z', 0, 1.4, 'kicker'), box(12, 26, 20, 27, 1.0, { look: 'hedge' }),
    ],
    extraRails: [rail(0, 1.7, 5.5, 0, 1.7, 10.5, 'Pyramid Rail'), rail(-16, 0.9, -2, -16, 0.9, 22, 'Long Rail'), rail(10, 0.8, 30, 30, 2.2, 30, 'Up Rail')],
    gaps: [
      { id: 'hedge', name: 'Hedge Hop', from: zone(14, 21, 18, 25), to: zone(10, 27.5, 24, 34), points: 500 },
      { id: 'pyramid', name: 'Over the Pyramid', from: zone(-3, 2, 3, 5), to: zone(-3, 11, 3, 16), points: 350, both: true },
      { id: 'deck', name: 'Lighthouse Drop', from: zone(26, -6, 35, 14), to: zone(12, -6, 20, 14), points: 300 },
      { id: 'longrail', name: 'Long Rail', from: zone(-18, -4, -14, 2), to: zone(-18, 18, -14, 26), points: 400, both: true, grind: 'Long Rail' },
    ],
    acorns: [{ x: -10.3, y: 5.6, z: -19 }, { x: 10.3, y: 5.6, z: -12 }, { x: 0, y: 2.9, z: 7 }, { x: 16, y: 3.2, z: 26 }, { x: -16, y: 2.1, z: 10 }],
    goals: [
      { id: 'hill-score', kind: 'score', n: 12000, text: 'Score 12,000 in a session', who: 'otter' },
      { id: 'hill-pro', kind: 'pro', n: 30000, text: 'Score 30,000 in a session', who: 'otter' },
      { id: 'hill-combo', kind: 'combo', n: 5000, text: 'Land a 5,000 combo', who: 'raccoon' },
      { id: 'hill-acorns', kind: 'acorns', text: 'Collect all five golden acorns', who: 'enzo' },
      { id: 'hill-gap', kind: 'gap', gap: 'hedge', text: 'Clear the Hedge Hop', who: 'otter' },
      { id: 'hill-trick', kind: 'trick', gap: 'hedge', trick: 'grab', text: 'Grab over the Hedge Hop', who: 'raccoon' },
    ],
  }),
  makePark({
    id: 'roofs', name: 'Lanternfall Rooftops', place: 'the roofs of the old town, after dark', w: 72, d: 72, unlock: 8, sky: '#5b3f86',
    start: { x: -20, z: -26, yaw: 0 },
    pieces: [
      // the street between the roofs: fall in and you bail
      { k: 'hole', x0: -36, z0: -2, x1: 36, z1: 4 },
      // kickers on each side to jump the street, and a plank bridge to grind over it
      ramp(-24, -5, -18, -3, 'z', 0, 1.2, 'kicker'), ramp(18, 5, 24, 7, 'z', 1.2, 0, 'kicker'),
      // the south roof: a halfpipe and chimneys
      ...qpDeck('z', -28, -1, 0, 20, 3.2, 3.0, -36), ...qpDeck('x', 30, 1, -30, -6, 3, 2.6, 36),
      box(-30, -20, -28, -18, 1.6, { look: 'chimney' }), box(-16, -16, -8, -15.4, 0.6, { grind: true, look: 'ledge', name: 'Gutter Ledge' }),
      // the north roof: a water-tower funbox, a big bank, lantern rails
      box(-6, 14, 6, 22, 1.2, { grind: true, look: 'funbox', name: 'Water Tower' }), ramp(-6, 12, 6, 14, 'z', 0, 1.2, 'funbox'), ramp(-6, 22, 6, 24, 'z', 1.2, 0, 'funbox'),
      ...qpDeck('z', 30, 1, -30, 30, 3.4, 3.2, 36),
      box(-30, 10, -18, 11, 0.6, { grind: true, look: 'ledge', name: 'Lantern Ledge' }),
    ],
    extraRails: [rail(4, 0.9, -6, 4, 0.9, 7, 'Plank Bridge'), rail(-28, 1.0, 14, -10, 1.0, 26, 'Lantern Rail'), rail(14, 1.1, 14, 26, 1.1, 14, 'Washing Line Rail')],
    gaps: [
      { id: 'sky', name: 'Sky Gap', from: zone(-26, -8, -16, -2), to: zone(-30, 4, -10, 16), points: 800, both: false },
      { id: 'skyback', name: 'Sky Gap (back)', from: zone(16, 4, 26, 10), to: zone(14, -14, 30, -2), points: 800 },
      { id: 'bridge', name: 'Plank Bridge', from: zone(2, -7, 6, -2), to: zone(2, 4, 6, 9), points: 600, both: true, grind: 'Plank Bridge' },
      { id: 'tower', name: 'Over the Water Tower', from: zone(-6, 11, 6, 14), to: zone(-6, 22, 6, 28), points: 450, both: true },
    ],
    acorns: [{ x: -21, y: 3.2, z: 0 }, { x: 4, y: 2, z: 1 }, { x: 0, y: 2.9, z: 17 }, { x: 10, y: 4.6, z: -31 }, { x: 20, y: 2.3, z: 14 }],
    goals: [
      { id: 'roofs-score', kind: 'score', n: 12000, text: 'Score 12,000 in a session', who: 'badger' },
      { id: 'roofs-pro', kind: 'pro', n: 20000, text: 'Score 20,000 in a session', who: 'badger' },
      { id: 'roofs-combo', kind: 'combo', n: 1800, text: 'Land a 1,800 combo', who: 'raccoon' },
      { id: 'roofs-acorns', kind: 'acorns', text: 'Collect all five golden acorns', who: 'enzo' },
      { id: 'roofs-gap', kind: 'gap', gap: 'bridge', text: 'Grind the Plank Bridge over the street', who: 'otter' },
      { id: 'roofs-trick', kind: 'trick', gap: 'sky', trick: 'flip', text: 'Flip trick over the Sky Gap', who: 'enzo' },
    ],
  }),
];
export const park = (id: ParkId) => PARKS.find((p) => p.id === id)!;
/** the goals needed for the ending: every park's gap and trick goals */
export const FINALE = PARKS.flatMap((p) => p.goals.filter((g) => g.kind === 'trick').map((g) => g.id));

// ---------------------------------------------------------------- the ground
export type Ground = { h: number; nx: number; ny: number; nz: number; piece: Piece | null; hole: boolean };
const inRect = (x: number, z: number, r: Zone) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/** The surface under (x, z): its height and normal. Holes drop to -30. */
export function groundAt(pk: Park, x: number, z: number): Ground {
  let best: Ground = { h: 0, nx: 0, ny: 1, nz: 0, piece: null, hole: false };
  for (const p of pk.pieces) if (p.k === 'hole' && inRect(x, z, p)) best = { h: -30, nx: 0, ny: 1, nz: 0, piece: p, hole: true };
  for (const p of pk.pieces) {
    if (p.k === 'hole') continue;
    let h = -99, nx = 0, nz = 0, ny = 1;
    if (p.k === 'box') { if (inRect(x, z, p)) h = p.h; }
    else if (p.k === 'ramp') {
      if (inRect(x, z, p)) {
        const lo = p.axis === 'x' ? p.x0 : p.z0, hi = p.axis === 'x' ? p.x1 : p.z1, c = p.axis === 'x' ? x : z, k = (c - lo) / (hi - lo);
        h = p.h0 + (p.h1 - p.h0) * k; const s = (p.h1 - p.h0) / (hi - lo), n = Math.hypot(s, 1);
        if (p.axis === 'x') nx = -s / n; else nz = -s / n; ny = 1 / n;
      }
    } else {
      const r = qpRect(p);
      if (inRect(x, z, r)) {
        const u = clamp(((p.axis === 'x' ? x : z) - p.at) * p.dir, 0, p.r * 0.999);
        h = p.r - Math.sqrt(p.r * p.r - u * u);
        const s = u / Math.sqrt(p.r * p.r - u * u), n = Math.hypot(s, 1);
        if (p.axis === 'x') nx = (-s * p.dir) / n; else nz = (-s * p.dir) / n; ny = 1 / n;
      }
    }
    if (h > best.h || (best.hole && h > -99)) best = { h, nx, ny, nz, piece: p, hole: false };
  }
  return best;
}

// ---------------------------------------------------------------- the skaters
export type CharId = 'dora' | 'enzo';
export const CHARS: Record<CharId, { name: string; pop: number; speed: number; spin: number; balance: number; special: string; line: string }> = {
  dora: { name: 'Dora', pop: 1.08, speed: 1.0, spin: 1.12, balance: 0.95, special: 'Comet Kickflip', line: 'Big air and fast spins.' },
  enzo: { name: 'Enzo', pop: 0.97, speed: 1.06, spin: 0.95, balance: 1.15, special: 'Lantern Varial', line: 'Steady on rails and quick on the flat.' },
};

/** Tricks and their base points. Flip tricks take `time` to turn the board; landing before that is a bail. */
export type FlipId = 'kickflip' | 'heelflip' | 'shove' | 'impossible' | 'hardflip' | 'double' | 'special';
export const FLIPS: Record<FlipId, { name: string; pts: number; time: number }> = {
  kickflip: { name: 'Kickflip', pts: 100, time: 0.42 }, heelflip: { name: 'Heelflip', pts: 100, time: 0.42 }, shove: { name: 'Pop Shove-it', pts: 100, time: 0.36 },
  impossible: { name: 'Impossible', pts: 250, time: 0.58 }, hardflip: { name: 'Hardflip', pts: 250, time: 0.55 }, double: { name: 'Double Kickflip', pts: 400, time: 0.72 },
  special: { name: 'special', pts: 1500, time: 0.85 },
};
export type GrabId = 'indy' | 'melon' | 'tail' | 'nose' | 'stalefish';
export const GRABS: Record<GrabId, { name: string; pts: number; perSec: number }> = {
  indy: { name: 'Indy', pts: 120, perSec: 260 }, melon: { name: 'Melon', pts: 120, perSec: 260 }, tail: { name: 'Tailgrab', pts: 120, perSec: 260 },
  nose: { name: 'Nosegrab', pts: 140, perSec: 280 }, stalefish: { name: 'Stalefish', pts: 160, perSec: 300 },
};
export type GrindId = 'fifty' | 'nose' | 'five' | 'board' | 'lip';
export const GRINDS: Record<GrindId, { name: string; pts: number; perSec: number }> = {
  fifty: { name: '50-50', pts: 100, perSec: 120 }, nose: { name: 'Nosegrind', pts: 150, perSec: 150 }, five: { name: '5-0', pts: 150, perSec: 150 },
  board: { name: 'Boardslide', pts: 120, perSec: 130 }, lip: { name: 'Lipslide', pts: 160, perSec: 160 },
};
const MANUAL = { pts: 80, perSec: 100 };
export const SPECIAL_FULL = 100;

export type Input = { x: number; y: number; jump: boolean; flip: boolean; grab: boolean; grind: boolean };
export const idleInput = (): Input => ({ x: 0, y: 0, jump: false, flip: false, grab: false, grind: false });
export type State = 'ground' | 'air' | 'grind' | 'manual' | 'bail';
export type TrickEntry = { name: string; pts: number; kind: 'flip' | 'grab' | 'spin' | 'grind' | 'manual' | 'gap' | 'air' | 'special' };
export type SkateEvent =
  | { k: 'ollie' } | { k: 'land'; clean: boolean; combo: number; tricks: number } | { k: 'bail' } | { k: 'trick'; name: string; kind: TrickEntry['kind'] }
  | { k: 'grind'; on: boolean } | { k: 'manual'; on: boolean } | { k: 'gap'; name: string } | { k: 'acorn'; n: number } | { k: 'goal'; id: string }
  | { k: 'special' } | { k: 'push' } | { k: 'end' };

const PUSH = 8, MAX_PUSH = 10, PUMP = 4.5, MAX_PUMP = 12.5, FRICTION = 0.06, TURN = 2.5, SPIN_RATE = 6.2, OLLIE = 6.4, GRIND_SNAP = 0.75;
const BAIL_TIME = 1.4, COMBO_GRACE = 0.45, SESSION = 120;

export type SessionOpts = { park: ParkId; char: CharId; free?: boolean; seed?: number; done?: string[] };

export class Session {
  pk: Park; char: CharId; opts: SessionOpts; c: (typeof CHARS)[CharId];
  t = 0; left: number; over = false; score = 0; best = 0;
  // the skater
  p: V3; v: V3 = { x: 0, y: 0, z: 0 }; yaw: number; state: State = 'ground'; n: V3 = { x: 0, y: 1, z: 0 };
  /** facing backwards relative to travel (rolling fakie) */ fakie = false;
  /** board rotation in the air so far, radians (spins) */ spin = 0;
  flip: { id: FlipId; t: number } | null = null; grab: { id: GrabId; t: number } | null = null;
  grind: { rail: Rail; s: number; dir: 1 | -1; id: GrindId; t: number; bal: number; bv: number } | null = null;
  manual: { t: number; bal: number; bv: number; nose: boolean } | null = null;
  bailT = 0; air = 0; airFrom: V3 = { x: 0, y: 0, z: 0 }; airFlips: string[] = []; airGrabs: string[] = [];
  combo: TrickEntry[] = []; comboT = 0; special = 0; specialOn = false;
  acorns: boolean[]; got: Set<string> = new Set(); gapsDone = new Set<string>(); bestCombo = 0;
  events: SkateEvent[] = []; safe: V3; private prev = idleInput(); private rnd: () => number; lastRail: Rail | null = null; private lastRailT = -9;
  /** the gap a grind started on, to award grind gaps at the far end */ private grindFrom: V3 | null = null;
  constructor(o: SessionOpts) {
    this.opts = o; this.pk = park(o.park); this.char = o.char; this.c = CHARS[o.char];
    this.left = o.free ? Infinity : SESSION;
    const s = this.pk.start; this.p = { x: s.x, y: groundAt(this.pk, s.x, s.z).h, z: s.z }; this.yaw = s.yaw; this.safe = { ...this.p };
    this.acorns = this.pk.acorns.map(() => false);
    let seed = (o.seed ?? 1) >>> 0 || 1; this.rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const id of o.done ?? []) this.got.add(id);
  }
  get speed() { return Math.hypot(this.v.x, this.v.z, this.v.y); }
  get comboScore() { return Math.round(this.combo.reduce((a, e) => a + e.pts, 0) * Math.max(1, this.combo.length)); }
  /** the direction the board's nose points, flat */
  get facing() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  tick(input: Input) {
    this.events.length = 0;
    if (this.over) return;
    const pressed = { jump: input.jump && !this.prev.jump, flip: input.flip && !this.prev.flip, grab: input.grab && !this.prev.grab, grind: input.grind && !this.prev.grind };
    this.t += DT;
    if (this.left !== Infinity) { this.left -= DT; if (this.left <= 0) { this.left = 0; if (this.state === 'ground' || this.state === 'bail') { this.bank(); this.endSession(); this.prev = { ...input }; return; } } }
    switch (this.state) {
      case 'bail': this.bailT -= DT; if (this.bailT <= 0) this.recover(); break;
      case 'ground': case 'manual': this.rollStep(input, pressed); break;
      case 'air': this.airStep(input, pressed); break;
      case 'grind': this.grindStep(input, pressed); break;
    }
    this.collect();
    this.prev = { ...input };
  }

  // ---------------------------------------------------------------- rolling (and manuals)
  private rollStep(inp: Input, pressed: { jump: boolean; flip: boolean; grab: boolean; grind: boolean }) {
    const pk = this.pk, v = this.v, n = this.n;
    // gravity along the surface
    const gt = { x: -(-G * n.y) * n.x, y: -G - -G * n.y * n.y, z: -(-G * n.y) * n.z };
    // kickers and banks keep most of your speed on the way up (it's what makes them launch)
    const climbK = this.on && this.on.k === 'ramp' && dot(v, gt) < 0 ? 0.3 : 1;
    v.x += gt.x * DT * climbK; v.y += gt.y * DT * climbK; v.z += gt.z * DT * climbK;
    const sp = Math.hypot(v.x, v.y, v.z), flat = n.y > 0.97;
    // push on the flat (not in a manual), brake with back
    if (this.state === 'ground' && flat && inp.y < -0.3 && sp < MAX_PUSH * this.c.speed) {
      const f = this.facing, k = this.fakie ? -1 : 1; v.x += f.x * k * PUSH * this.c.speed * DT; v.z += f.z * k * PUSH * this.c.speed * DT;
      if (this.t % 0.6 < DT) this.events.push({ k: 'push' });
    }
    // pump in the transitions: push down the slopes and up the walls to gain speed
    if (this.state === 'ground' && !flat && inp.y < -0.3 && sp > 0.5 && sp < MAX_PUMP * this.c.speed) { const k = 1 + (PUMP * DT) / sp; v.x *= k; v.y *= k; v.z *= k; }
    if (this.state === 'ground' && inp.y > 0.3 && flat) { const k = Math.max(0, 1 - 3 * DT); v.x *= k; v.z *= k; }
    // steer: turn the travel round the surface normal; on the flat, the board follows
    const turn = -inp.x * TURN * DT * (this.state === 'manual' ? 0.6 : 1);
    if (turn) { rot(v, n, turn); this.yaw = wrap(this.yaw + turn * Math.sign(n.y || 1)); }
    const fr = 1 - FRICTION * DT * (this.state === 'manual' ? 0.5 : 1); v.x *= fr; v.y *= fr; v.z *= fr;
    // the board lines up with the travel, or rolls fakie when the travel reverses (up a ramp and back)
    const hs = Math.hypot(v.x, v.z);
    if (hs > 0.6) {
      const ty = Math.atan2(v.x, v.z), d = Math.abs(wrap(ty - this.yaw));
      if (d > Math.PI / 2) { this.yaw = wrap(ty + Math.PI); this.fakie = true; } else { this.yaw = ty; this.fakie = false; }
    } else if (hs > 0.05 && n.y < 0.97 && Math.abs(v.y) > 0.1) {
      // nearly still on a slope: about to roll back down, fakie
    }
    // move, and follow the ground or leave it
    const nx = this.p.x + v.x * DT, nz = this.p.z + v.z * DT, ny = this.p.y + v.y * DT;
    if (this.blocked(nx, nz, this.p.y)) { this.bounce(nx, nz); return; }
    const g = groundAt(pk, nx, nz);
    // off the top of a steep wall (a quarter-pipe's lip) you fly, straight up
    const lip = this.n.y < 0.6 && g.ny > 0.9 && v.y > 1;
    if (g.hole || lip || ny > g.h + 0.12 && (g.h < this.p.y - 0.05 || v.y > 0.4)) {
      if (lip) { this.p = { x: this.p.x, y: ny, z: this.p.z }; this.takeOff(true); return; }
      this.p = { x: nx, y: ny, z: nz };
      if (this.state === 'manual') this.endManual(false);
      this.takeOff(this.n.y < 0.45);
      return;
    }
    this.p = { x: nx, y: g.h, z: nz }; this.n = { x: g.nx, y: g.ny, z: g.nz }; this.on = g.piece;
    // keep the speed as the surface curves
    const s0 = Math.hypot(v.x, v.y, v.z), dn = dot(v, this.n); v.x -= dn * this.n.x; v.y -= dn * this.n.y; v.z -= dn * this.n.z;
    const s1 = Math.hypot(v.x, v.y, v.z); if (s1 > 1e-4) { const k = s0 / s1; v.x *= k; v.y *= k; v.z *= k; }
    if (this.state === 'ground' && flat) this.safe = { ...this.p };
    // tricks from the ground
    if (pressed.jump) { this.ollie(); return; }
    if (this.state === 'ground' && pressed.grind) { this.startManual(inp.y < -0.5); }
    if (this.state === 'manual') this.manualStep(inp, pressed);
    // the combo ends once you have rolled away clean
    // (the clock only runs on the flat, so rolling down out of a quarter-pipe leaves time to manual)
    if (this.state === 'ground' && this.combo.length && flat) { this.comboT -= DT; if (this.comboT <= 0) this.bank(); }
    if (this.left <= 0 && this.state === 'ground') { this.bank(); this.endSession(); }
  }
  private blocked(x: number, z: number, y: number) { const g = groundAt(this.pk, x, z); return !g.hole && g.h > y + 0.32 || Math.abs(x) > this.pk.w / 2 || Math.abs(z) > this.pk.d / 2; }
  private bounce(nx: number, nz: number) {
    // slide along whichever way is open, losing the speed into the wall
    const v = this.v;
    if (!this.blocked(this.p.x, nz, this.p.y)) { v.x *= -0.25; this.p.z = nz; }
    else if (!this.blocked(nx, this.p.z, this.p.y)) { v.z *= -0.25; this.p.x = nx; }
    else { v.x *= -0.25; v.z *= -0.25; }
    if (Math.hypot(v.x, v.z) > 6 && this.state === 'air') this.bail();
  }
  private ollie() {
    const n = this.n, k = OLLIE * this.c.pop * (this.state === 'manual' ? 0.9 : 1);
    if (this.state === 'manual') this.endManual(false);
    // on the flat a full pop; off a slope (a kicker's lip) a smaller one on top of the launch
    this.v.y += k * (n.y > 0.97 ? 1 : 0.45);
    this.p.y += 0.05; this.events.push({ k: 'ollie' });
    this.takeOff(false, true);
  }
  private takeOff(lip: boolean, ollie = false) {
    this.state = 'air'; this.air = 0; this.spin = 0; this.flip = null; this.grab = null; this.airFlips = []; this.airGrabs = [];
    this.airFrom = { ...this.p };
    // up a quarter-pipe lip: go straight up, and come back down into it
    if (lip && this.n.y < 0.45) {
      const q = this.pieceAt() as Qp | null;
      if (q && q.k === 'qp') { if (q.axis === 'x') this.v.x = -q.dir * 0.4; else this.v.z = -q.dir * 0.4; }
      this.vert = q && q.k === 'qp' ? q : null;
    } else this.vert = null;
    if (ollie) this.addTrick({ name: 'Ollie', pts: 50, kind: 'air' }, true);
  }
  vert: Qp | null = null;
  /** the side held when a flip or grab was picked: it doesn't spin until let go */ xLock = 0;
  /** the piece being ridden */ on: Piece | null = null;
  private pieceAt() {
    // the quarter-pipe just below the skater (the one being left)
    for (const pc of this.pk.pieces) if (pc.k === 'qp') { const r = qpRect(pc); if (inRect(this.p.x, this.p.z, { x0: r.x0 - 0.6, x1: r.x1 + 0.6, z0: r.z0 - 0.6, z1: r.z1 + 0.6 })) return pc; }
    return null;
  }

  // ---------------------------------------------------------------- in the air
  private airStep(inp: Input, pressed: { jump: boolean; flip: boolean; grab: boolean; grind: boolean }) {
    const v = this.v; this.air += DT;
    v.y -= G * DT;
    // spins: left and right turn the board (and you)
    // the direction held to pick a flip or a grab doesn't spin you until it is let go
    if (this.xLock && (Math.abs(inp.x) < 0.3 || Math.sign(inp.x) !== this.xLock)) this.xLock = 0;
    const sx = this.xLock ? 0 : inp.x;
    const ds = -sx * SPIN_RATE * this.c.spin * DT * (this.grab ? 0.85 : 1); this.spin += ds; this.yaw = wrap(this.yaw + ds);
    // flips
    if (this.flip) { this.flip.t += DT; if (this.flip.t >= FLIPS[this.flip.id].time) this.flip = null; }
    if (pressed.flip && !this.flip && !this.grab) {
      let id: FlipId = inp.y < -0.5 ? 'impossible' : inp.y > 0.5 ? 'hardflip' : inp.x < -0.5 ? 'heelflip' : inp.x > 0.5 ? 'shove' : 'kickflip';
      if (inp.grab && this.special >= SPECIAL_FULL) { id = 'special'; this.special = 0; this.specialOn = true; this.events.push({ k: 'special' }); }
      else if (this.airFlips.length && this.airFlips[this.airFlips.length - 1] === 'Kickflip' && id === 'kickflip' && this.air < 0.5) id = 'double';
      this.flip = { id, t: 0 }; if (Math.abs(inp.x) > 0.5) this.xLock = Math.sign(inp.x);
      const nm = id === 'special' ? this.c.special : FLIPS[id].name; this.airFlips.push(nm);
      this.addTrick({ name: nm, pts: FLIPS[id].pts, kind: id === 'special' ? 'special' : 'flip' });
    }
    // grabs: held to score more
    if (inp.grab && !this.grab && !this.flip) {
      const id: GrabId = inp.y < -0.5 ? 'nose' : inp.y > 0.5 ? 'stalefish' : inp.x < -0.5 ? 'melon' : inp.x > 0.5 ? 'tail' : 'indy';
      this.grab = { id, t: 0 }; this.airGrabs.push(GRABS[id].name); if (Math.abs(inp.x) > 0.5) this.xLock = Math.sign(inp.x);
      this.addTrick({ name: GRABS[id].name, pts: GRABS[id].pts, kind: 'grab' });
    }
    if (this.grab) {
      if (!inp.grab) this.grab = null;
      else { this.grab.t += DT; const e = this.combo[this.combo.length - 1]; if (e && e.kind === 'grab') e.pts += GRABS[this.grab.id].perSec * DT; }
    }
    // a grind: press (or hold) grind near a rail
    if ((pressed.grind || inp.grind) && this.air > 0.08 && this.tryGrind(inp)) return;
    // move, with a quarter-pipe's lip bringing you back down into it
    const nx = this.p.x + v.x * DT, nz = this.p.z + v.z * DT, ny = this.p.y + v.y * DT;
    if (this.blocked(nx, nz, Math.max(ny, this.p.y))) { this.bounce(nx, nz); if (this.state !== 'air') return; }
    else { this.p.x = nx; this.p.z = nz; }
    this.p.y = ny;
    const g = groundAt(this.pk, this.p.x, this.p.z);
    if (this.p.y < -4) { this.bail(); return; }
    if (!g.hole && this.p.y <= g.h) this.land(g, inp);
  }
  private land(g: Ground, inp: Input) {
    this.p.y = g.h; this.n = { x: g.nx, y: g.ny, z: g.nz };
    const v = this.v, dn = dot(v, this.n), s0 = len(v);
    // a hard landing on the flat loses its downward speed; on a slope, the speed carries on down it
    v.x -= dn * this.n.x; v.y -= dn * this.n.y; v.z -= dn * this.n.z;
    const keep = this.n.y > 0.97 ? 0.92 : 0.98, s1 = len(v); if (s1 > 1e-4 && this.n.y < 0.97) { const k = (s0 * keep) / s1; v.x *= k; v.y *= k; v.z *= k; }
    // clean? the board has finished its flip, the grab is let go, and it points along (or exactly against) the travel
    const hx = v.x, hz = v.z, hs = Math.hypot(hx, hz);
    let ok = !this.flip && !(this.grab && this.grab.t > 0.05 && inp.grab && this.air - this.grab.t < 0.02) && !(this.grab && inp.grab && this.grab.t > 0.25);
    if (this.vert) {
      // back into a quarter-pipe: the spin has to come round to a half turn; a straight air comes back fakie
      const halves = Math.round(this.spin / Math.PI);
      if (Math.abs(this.spin - halves * Math.PI) > 0.62) ok = false;
      if (halves % 2 === 0) this.fakie = !this.fakie;
    } else if (hs > 1.2) {
      const d = Math.abs(wrap(Math.atan2(hx, hz) - this.yaw));
      if (d > 0.62 && d < Math.PI - 0.62) ok = false;
      this.fakie = d > Math.PI / 2;
    }
    if (!ok) { this.bail(); return; }
    // spins, rounded to the half turn
    const halves = Math.round(Math.abs(this.spin) / Math.PI);
    if (halves > 0) this.addTrick({ name: `${halves * 180}`, pts: 120 * halves * (1 + 0.25 * (halves - 1)), kind: 'spin' });
    // big air from a quarter-pipe is worth something by itself
    if (this.vert && this.air > 0.9 && !this.airFlips.length && !this.airGrabs.length) this.addTrick({ name: 'Air', pts: 150, kind: 'air' });
    this.gapCheck(this.airFrom, this.p, null);
    this.grab = null; this.vert = null;
    const clean = this.combo.length;
    this.state = 'ground'; this.comboT = COMBO_GRACE;
    this.events.push({ k: 'land', clean: true, combo: this.comboScore, tricks: clean });
    // land straight into a manual by holding grind
    if (inp.grind && this.n.y > 0.97 && this.combo.length) this.startManual(inp.y < -0.5);
  }

  // ---------------------------------------------------------------- grinds
  /** the rail nearest the skater that it can lock onto */
  nearestRail(maxD = GRIND_SNAP) {
    let best: { rail: Rail; s: number; d: number } | null = null;
    for (const r of this.pk.rails) {
      const ax = r.b.x - r.a.x, ay = r.b.y - r.a.y, az = r.b.z - r.a.z, L2 = ax * ax + ay * ay + az * az;
      const s = clamp(((this.p.x - r.a.x) * ax + (this.p.z - r.a.z) * az) / (ax * ax + az * az || 1), 0, 1);
      const px = r.a.x + ax * s, py = r.a.y + ay * s, pz = r.a.z + az * s;
      const dh = Math.hypot(this.p.x - px, this.p.z - pz), dy = this.p.y - py;
      if (dh > maxD || dy < -0.35 || dy > 1.1) continue;
      if (s <= 0.01 || s >= 0.99) continue;
      void L2;
      if (!best || dh < best.d) best = { rail: r, s, d: dh };
    }
    return best;
  }
  private tryGrind(inp: Input) {
    const hit = this.nearestRail(); if (!hit) return false;
    const r = hit.rail; if (r === this.lastRail && this.t - this.lastRailT < 0.5) return false;
    const ax = r.b.x - r.a.x, az = r.b.z - r.a.z, al = Math.hypot(ax, az) || 1;
    const along = (this.v.x * ax + this.v.z * az) / al;
    if (Math.abs(along) < 1.2) return false;
    const id: GrindId = r.kind !== 'rail' && Math.abs(along) < 3 ? 'lip' : inp.y < -0.5 ? 'nose' : inp.y > 0.5 ? 'five' : Math.abs(inp.x) > 0.5 ? 'board' : 'fifty';
    if (this.flip || (this.grab && inp.grab)) { this.bail(); return true; }
    this.grab = null;
    // spins and flips done on the way up count
    const halves = Math.round(Math.abs(this.spin) / Math.PI); if (halves > 0) this.addTrick({ name: `${halves * 180}`, pts: 120 * halves, kind: 'spin' });
    this.state = 'grind'; this.vert = null;
    const dir: 1 | -1 = along >= 0 ? 1 : -1, sp = Math.max(3, Math.abs(along));
    this.grind = { rail: r, s: hit.s, dir, id, t: 0, bal: (this.rnd() - 0.5) * 0.2, bv: 0 };
    this.grindFrom = { ...this.p };
    this.v = { x: (ax / al) * sp * dir, y: 0, z: (az / al) * sp * dir };
    this.yaw = id === 'board' || id === 'lip' ? wrap(Math.atan2(ax * dir, az * dir) + Math.PI / 2) : Math.atan2(ax * dir, az * dir);
    this.addTrick({ name: GRINDS[id].name, pts: GRINDS[id].pts, kind: 'grind' });
    this.events.push({ k: 'grind', on: true });
    return true;
  }
  private grindStep(inp: Input, pressed: { jump: boolean; flip: boolean; grab: boolean; grind: boolean }) {
    const gr = this.grind!, r = gr.rail;
    const ax = r.b.x - r.a.x, ay = r.b.y - r.a.y, az = r.b.z - r.a.z, L = Math.hypot(ax, ay, az);
    // speed along the rail: gravity down a sloping rail, a little drag
    let sp = Math.hypot(this.v.x, this.v.y, this.v.z) * 1;
    sp += (-G * (ay / L) * gr.dir) * DT; sp *= 1 - 0.05 * DT; sp = Math.max(1.5, sp);
    gr.t += DT;
    // balance: the wobble grows the longer you hold it; left and right lean back
    const hard = ((0.6 + gr.t * 0.35) * this.linkHard()) / this.c.balance;
    gr.bv += ((this.rnd() - 0.5) * 6 * hard + gr.bal * 2.2 * hard - inp.x * 5.5) * DT; gr.bv *= 1 - 1.5 * DT; gr.bal += gr.bv * DT;
    if (Math.abs(gr.bal) > 1) { this.bail(); return; }
    const e = this.combo[this.combo.length - 1]; if (e && e.kind === 'grind') e.pts += GRINDS[gr.id].perSec * DT;
    gr.s += (sp * DT * gr.dir) / L;
    this.p = { x: r.a.x + ax * gr.s, y: r.a.y + ay * gr.s, z: r.a.z + az * gr.s };
    this.v = { x: (ax / L) * sp * gr.dir, y: (ay / L) * sp * gr.dir, z: (az / L) * sp * gr.dir };
    if (pressed.jump) { this.leaveGrind(true); return; }
    if (gr.s <= 0 || gr.s >= 1) this.leaveGrind(false);
  }
  private leaveGrind(jump: boolean) {
    const r = this.grind!.rail;
    this.lastRail = r; this.lastRailT = this.t; this.grind = null;
    this.events.push({ k: 'grind', on: false });
    if (r.name) this.gapCheck(this.grindFrom ?? this.p, this.p, r.name, true);
    this.state = 'air'; this.air = 0.1; this.spin = 0; this.flip = null; this.grab = null; this.airFlips = []; this.airGrabs = []; this.vert = null;
    this.airFrom = { ...this.p };
    if (jump) { this.v.y = Math.max(this.v.y, 0) + OLLIE * this.c.pop * 0.8; this.events.push({ k: 'ollie' }); }
    else this.v.y = Math.max(this.v.y, 0) + 1.2;
    this.yaw = Math.atan2(this.v.x, this.v.z);
  }

  // ---------------------------------------------------------------- manuals
  private startManual(nose: boolean) {
    if (!this.combo.length && this.speed < 2) return;
    this.state = 'manual'; this.manual = { t: 0, bal: (this.rnd() - 0.5) * 0.2, bv: 0, nose };
    this.addTrick({ name: nose ? 'Nose Manual' : 'Manual', pts: MANUAL.pts, kind: 'manual' });
    this.events.push({ k: 'manual', on: true });
  }
  private manualStep(inp: Input, pressed: { jump: boolean; flip: boolean; grab: boolean; grind: boolean }) {
    const m = this.manual!; m.t += DT;
    const hard = ((0.7 + m.t * 0.4) * this.linkHard()) / this.c.balance;
    m.bv += ((this.rnd() - 0.5) * 6 * hard + m.bal * 2.4 * hard + inp.y * 5) * DT; m.bv *= 1 - 1.5 * DT; m.bal += m.bv * DT;
    const e = this.combo[this.combo.length - 1]; if (e && e.kind === 'manual') e.pts += MANUAL.perSec * DT;
    if (Math.abs(m.bal) > 1) { this.bail(); return; }
    // press grind again to step down (not with the same press that started it)
    if (pressed.grind && m.t > 0.15) this.endManual(true);
  }
  private endManual(stop: boolean) {
    this.manual = null; this.events.push({ k: 'manual', on: false });
    if (this.state === 'manual') this.state = 'ground';
    if (stop) this.comboT = COMBO_GRACE;
  }

  // ---------------------------------------------------------------- scoring
  private addTrick(e: TrickEntry, quiet = false) {
    // the same trick again in one combo is worth less each time
    const same = this.combo.filter((x) => x.name === e.name).length;
    const pts = e.pts * Math.pow(0.5, same);
    this.combo.push({ ...e, pts });
    if (!quiet) this.events.push({ k: 'trick', name: e.name, kind: e.kind });
  }
  private gapCheck(a: V3, b: V3, rail: string | null, viaGrind = false) {
    for (const gp of this.pk.gaps) {
      if (gp.grind && gp.grind !== rail) continue;
      if (!gp.grind && viaGrind) continue;
      const fw = inRect(a.x, a.z, gp.from) && inRect(b.x, b.z, gp.to), bw = gp.both && inRect(a.x, a.z, gp.to) && inRect(b.x, b.z, gp.from);
      if (!fw && !bw) continue;
      this.addTrick({ name: gp.name, pts: gp.points, kind: 'gap' });
      this.events.push({ k: 'gap', name: gp.name });
      this.pendingGap.push({ id: gp.id, flips: this.airFlips.length > 0, grabs: this.airGrabs.length > 0 });
    }
  }
  private pendingGap: { id: string; flips: boolean; grabs: boolean }[] = [];
  /** the combo lands: its score is banked, gaps and goals checked */
  private bank() {
    if (this.combo.length) {
      const s = this.comboScore; this.score += s; this.bestCombo = Math.max(this.bestCombo, s);
      this.special = Math.min(SPECIAL_FULL, this.special + Math.min(40, s / 60));
      this.events.push({ k: 'land', clean: true, combo: s, tricks: this.combo.length });
      for (const g of this.pendingGap) {
        this.gapsDone.add(g.id);
        for (const goal of this.pk.goals) {
          if (goal.kind === 'gap' && goal.gap === g.id) this.goal(goal.id);
          if (goal.kind === 'trick' && goal.gap === g.id && ((goal.trick === 'flip' && g.flips) || (goal.trick === 'grab' && g.grabs))) this.goal(goal.id);
        }
      }
    }
    this.combo = []; this.pendingGap = []; this.specialOn = false;
    for (const goal of this.pk.goals) {
      if (goal.kind === 'score' && this.score >= goal.n!) this.goal(goal.id);
      if (goal.kind === 'pro' && this.score >= goal.n!) this.goal(goal.id);
      if (goal.kind === 'combo' && this.bestCombo >= goal.n!) this.goal(goal.id);
    }
  }
  private goal(id: string) { if (this.got.has(id)) return; this.got.add(id); this.events.push({ k: 'goal', id }); }
  private bail() {
    if (this.state === 'manual') this.manual = null;
    if (this.grind) { this.grind = null; this.events.push({ k: 'grind', on: false }); }
    this.state = 'bail'; this.bailT = BAIL_TIME; this.combo = []; this.pendingGap = []; this.flip = null; this.grab = null; this.vert = null; this.specialOn = false;
    this.v = { x: this.v.x * 0.2, y: 0, z: this.v.z * 0.2 };
    this.events.push({ k: 'bail' });
  }
  private recover() {
    // back on your feet where you fell, or at the last safe spot if that was a hole or the air
    const g = groundAt(this.pk, this.p.x, this.p.z);
    if (g.hole || this.p.y < -1 || g.ny < 0.97) this.p = { ...this.safe };
    else this.p.y = g.h;
    this.v = { x: 0, y: 0, z: 0 }; this.n = { x: 0, y: 1, z: 0 }; this.state = 'ground'; this.fakie = false;
    if (this.left <= 0) this.endSession();
  }
  private endSession() { this.over = true; this.events.push({ k: 'end' }); }
  private collect() {
    this.pk.acorns.forEach((a, i) => {
      if (this.acorns[i]) return;
      if (Math.hypot(a.x - this.p.x, a.y - (this.p.y + 0.6), a.z - this.p.z) < 1.1) {
        this.acorns[i] = true; const n = this.acorns.filter(Boolean).length; this.events.push({ k: 'acorn', n });
        if (n === this.acorns.length) for (const goal of this.pk.goals) if (goal.kind === 'acorns') this.goal(goal.id);
      }
    });
  }
  /** debug and tests: put the skater somewhere, moving */
  place(x: number, z: number, yaw: number, speed: number, y?: number) {
    const g = groundAt(this.pk, x, z); this.p = { x, y: y ?? g.h, z }; this.yaw = yaw; this.n = { x: g.nx, y: g.ny, z: g.nz };
    this.v = { x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }; this.state = y !== undefined && y > g.h + 0.05 ? 'air' : 'ground';
    if (this.state === 'air') { this.air = 0; this.airFrom = { ...this.p }; this.spin = 0; this.airFlips = []; this.airGrabs = []; this.vert = null; }
    this.fakie = false; this.grind = null; this.manual = null; this.flip = null; this.grab = null;
  }
  /** every manual and grind already in this combo makes the next one wobblier */
  private linkHard() { return 1 + 0.5 * Math.max(0, this.combo.filter((e) => e.kind === 'manual' || e.kind === 'grind').length - 1); }
  /** what the scene and HUD need about balance */
  get balance() { return this.grind ? this.grind.bal : this.manual ? this.manual.bal : null; }
}

/** rotate v about the unit axis n by angle a */
function rot(v: V3, n: V3, a: number) {
  const c = Math.cos(a), s = Math.sin(a), d = dot(v, n);
  const cx = n.y * v.z - n.z * v.y, cy = n.z * v.x - n.x * v.z, cz = n.x * v.y - n.y * v.x;
  v.x = v.x * c + cx * s + n.x * d * (1 - c); v.y = v.y * c + cy * s + n.y * d * (1 - c); v.z = v.z * c + cz * s + n.z * d * (1 - c);
}

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'pawpark-skate-v1';
export type Save = {
  v: 1; char: CharId; goals: string[]; best: Record<ParkId, number>; bestCombo: Record<ParkId, number>; intro: boolean; ending: boolean;
  settings: { sound: boolean; music: boolean; camera: 'near' | 'far' };
  stats: { sessions: number; bails: number; gaps: number; acorns: number };
};
export const newSave = (): Save => ({ v: 1, char: 'dora', goals: [], best: { plaza: 0, hill: 0, roofs: 0 }, bestCombo: { plaza: 0, hill: 0, roofs: 0 }, intro: false, ending: false,
  settings: { sound: true, music: true, camera: 'near' }, stats: { sessions: 0, bails: 0, gaps: 0, acorns: 0 } });
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
export const ALL_GOALS = PARKS.flatMap((p) => p.goals.map((g) => g.id));
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  let d: Record<string, unknown>; try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return s;
  if (d.char === 'dora' || d.char === 'enzo') s.char = d.char;
  if (Array.isArray(d.goals)) s.goals = ALL_GOALS.filter((g) => (d.goals as unknown[]).includes(g));
  for (const k of ['best', 'bestCombo'] as const) { const b = (d[k] && typeof d[k] === 'object' ? d[k] : {}) as Record<string, unknown>; for (const p of PARKS) s[k][p.id] = Math.floor(num(b[p.id], 0, 1e9, 0)); }
  s.intro = d.intro === true; s.ending = d.ending === true;
  const st = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  if (typeof st.sound === 'boolean') s.settings.sound = st.sound; if (typeof st.music === 'boolean') s.settings.music = st.music;
  if (st.camera === 'near' || st.camera === 'far') s.settings.camera = st.camera;
  const ss = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as Record<string, unknown>;
  for (const k of Object.keys(s.stats) as (keyof Save['stats'])[]) s.stats[k] = Math.floor(num(ss[k], 0, 1e9, 0));
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
export const goalsIn = (s: Save, p: ParkId) => park(p).goals.filter((g) => s.goals.includes(g.id)).length;
export const unlocked = (s: Save, p: ParkId) => s.goals.length >= park(p).unlock;
/** fold a finished session into the save */
export function record(s: Save, ses: Session) {
  const fresh = [...ses.got].filter((g) => !s.goals.includes(g));
  s.goals = ALL_GOALS.filter((g) => s.goals.includes(g) || ses.got.has(g));
  const id = ses.pk.id; s.best[id] = Math.max(s.best[id], ses.score); s.bestCombo[id] = Math.max(s.bestCombo[id], ses.bestCombo);
  s.stats.sessions++; s.stats.gaps += ses.gapsDone.size; s.stats.acorns += ses.acorns.filter(Boolean).length;
  const ending = !s.ending && FINALE.every((g) => s.goals.includes(g));
  if (ending) s.ending = true;
  return { fresh, ending };
}

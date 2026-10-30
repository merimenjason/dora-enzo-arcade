// Twig & Twine: the four regions, their twenty-four crossings and the sandbox. Coordinates are grid units with y up;
// the road is at y = 0 unless a level says otherwise. Each level's gap runs between its two banks, anchors sit on the
// bank edges, on rocks and on old posts, and the prices for the medals come from the stored designs in
// tests/bridges-solutions.json (see tests/bridges-bot.mjs).
import type { Mat, Pt, Box, VehicleKind } from './bridges-game.js';

export type RegionId = 'brook' | 'ravine' | 'marsh' | 'canyon';
export type Region = { id: RegionId; name: string; blurb: string; tip: { title: string; text: string } };
export const REGIONS: Region[] = [
  { id: 'brook', name: 'Willow Brook', blurb: 'The spring flood took the little bridges. Planks for the road, twigs to hold it up.', tip: { title: 'Triangles are strong', text: 'A plank alone just sags and snaps. Hold it up with twigs, and make triangles: a triangle can’t squash out of shape, so it carries the cart.' } },
  { id: 'ravine', name: 'Mossy Ravine', blurb: 'Deep, damp and green. Twine hangs a road from the old posts; bamboo grows here too.', tip: { title: 'Twine only pulls', text: 'Twine is light, cheap and strong, but only when it’s pulled tight: push it and it goes slack. Hang the road from something high and let the twine take the pull.' } },
  { id: 'marsh', name: 'Reed Marsh', blurb: 'Soft banks and few anchors. Use the rocks, keep the boats’ way clear, and climb the far bank.', tip: { title: 'Rocks are anchors too', text: 'The marsh banks are soft, so there are few anchors on them. Look for the rocks out in the water: a joint on a rock holds still.' } },
  { id: 'canyon', name: 'Sunset Canyon', blurb: 'Long spans, gusty wind and the heavy hay wagon, all the way to the great canyon.', tip: { title: 'Mind the wind', text: 'Gusts push and lift anything light. Brace the road with triangles both ways so it can’t flap, and keep the long twine runs taut.' } },
];

export type Ground = { kind: 'bank' | 'rock' | 'island'; poly: Pt[]; road?: Pt[] };
export type Post = { x: number; y0: number; y1: number };
export type LevelDef = {
  id: string; name: string; region: RegionId; blurb: string;
  /** a short teaching card shown when the level first opens */ tip?: { title: string; text: string };
  grounds: Ground[]; posts: Post[]; anchors: Pt[];
  /** the rear wheel's start, and the line every vehicle must pass */ start: number; finish: number;
  /** the water (or the canyon floor): a vehicle below this has fallen */ water: number;
  floor: 'water' | 'ravine' | 'canyon';
  budget: number; thrifty: number; master: number;
  mats: Mat[]; vehicles: VehicleKind[];
  boat?: Box; wind?: number;
  /** the mirror line for mirror building */ mirror: number;
  /** what the camera frames, and where joints may go */ view: Box; build: Box;
};

const BOTTOM = -40;
/** The left bank: road along the top to the edge, then a face down into the gap (offsets from the edge, +x into the gap). */
function leftBank(edge: number, top: number, face: Pt[] = [[0, -3], [-1, -7]]): Ground {
  const f = face.map(([dx, dy]) => [edge + dx, top + dy] as Pt);
  return { kind: 'bank', road: [[-60, top], [edge, top]], poly: [[-60, top], [edge, top], ...f, [f[f.length - 1][0], BOTTOM], [-60, BOTTOM]] };
}
/** The right bank, mirrored: the face comes up out of the gap to the edge, then the road runs on. */
function rightBank(edge: number, top: number, face: Pt[] = [[0, -3], [1, -7]]): Ground {
  const f = face.map(([dx, dy]) => [edge + dx, top + dy] as Pt);
  return { kind: 'bank', road: [[edge, top], [edge + 60, top]], poly: [[edge, top], [edge + 60, top], [edge + 60, BOTTOM], [f[f.length - 1][0], BOTTOM], ...[...f].reverse()] };
}
/** A rock standing up out of the water with a flat-ish top at (x0..x1, top). */
function rock(x0: number, x1: number, top: number): Ground {
  return { kind: 'rock', poly: [[x0 - 0.3, top - 0.6], [x0, top], [x1, top], [x1 + 0.3, top - 0.6], [x1 + 0.8, BOTTOM], [x0 - 0.8, BOTTOM]] };
}
/** An island with a road over it between two gaps. */
function island(x0: number, x1: number, top: number, depth = 3): Ground {
  return { kind: 'island', road: [[x0, top], [x1, top]], poly: [[x0, top], [x1, top], [x1, top - depth], [x1 - 0.6, BOTTOM], [x0 + 0.6, BOTTOM], [x0, top - depth]] };
}

type Spec = Omit<LevelDef, 'view' | 'build' | 'posts' | 'mirror' | 'start' | 'finish' | 'floor' | 'budget' | 'thrifty' | 'master'> & Partial<Pick<LevelDef, 'budget' | 'thrifty' | 'master'>> & Partial<Pick<LevelDef, 'view' | 'build' | 'posts' | 'mirror' | 'start' | 'finish' | 'floor'>> & { gap: [number, number] };
function level(s: Spec): LevelDef {
  const [g0, g1] = s.gap, w = g1 - g0;
  const ys = s.anchors.map((a) => a[1]).concat((s.posts ?? []).map((p) => p.y1));
  const top = Math.max(2, ...ys) + 1.5, low = Math.min(...ys);
  // the camera shows the whole gap with a little road each side, and down to the water (or a little below the
  // lowest anchor in the deep places)
  const view = s.view ?? { x0: g0 - 5, x1: g1 + 5.5, y0: Math.max(s.water - 1, low - 3.5), y1: top + 0.5 };
  const build = s.build ?? { x0: g0 - 3, x1: g1 + 3, y0: Math.max(s.water + 0.5, low - 3), y1: top + 1 };
  const { gap: _gap, ...rest } = s;
  void _gap; void w;
  return { posts: [], floor: 'water', budget: 0, thrifty: 0, master: 0, mirror: (g0 + g1) / 2, start: g0 - 4.6, finish: g1 + 2.5, ...rest, view, build };
}
const TP: Mat[] = ['twig', 'plank'], TPR: Mat[] = ['twig', 'plank', 'twine'], ALL: Mat[] = ['twig', 'plank', 'twine', 'bamboo'];

const DEFS: LevelDef[] = [
  // ---------------- Willow Brook: planks, twigs and triangles
  level({
    id: 'b1', name: 'First Crossing', region: 'brook', gap: [0, 4], blurb: 'A short hop over the brook. Lay the planks, then prop them up.',
    tip: REGIONS[0].tip, grounds: [leftBank(0, 0), rightBank(4, 0)], anchors: [[0, 0], [4, 0], [0, -2], [4, -2]],
    water: -3, mats: TP, vehicles: ['cart'],
  }),
  level({
    id: 'b2', name: 'Puddle Hop', region: 'brook', gap: [0, 6], blurb: 'A little wider. One prop won’t reach the middle.',
    grounds: [leftBank(0, 0), rightBank(6, 0)], anchors: [[0, 0], [6, 0], [0, -2], [6, -2]],
    water: -3, mats: TP, vehicles: ['cart'],
  }),
  level({
    id: 'b3', name: 'Over the Top', region: 'brook', gap: [0, 8], blurb: 'No low anchors this time. Build the triangles above the road, or hang them below it.',
    grounds: [leftBank(0, 0, [[0, -1], [1, -4]]), rightBank(8, 0, [[0, -1], [-1, -4]])], anchors: [[0, 0], [8, 0]],
    water: -3, mats: TP, vehicles: ['cart'],
  }),
  level({
    id: 'b4', name: 'Stepping Stone', region: 'brook', gap: [0, 10], blurb: 'A big stone sits in the brook. Lean on it.',
    grounds: [leftBank(0, 0), rightBank(10, 0), rock(4, 6, -2)], anchors: [[0, 0], [10, 0], [0, -2], [10, -2], [5, -2]],
    water: -3.5, mats: TP, vehicles: ['cart'],
  }),
  level({
    id: 'b5', name: 'Willow Bend', region: 'brook', gap: [0, 10], blurb: 'Deep anchors low on the banks. An arch springs from them nicely.',
    grounds: [leftBank(0, 0, [[0, -4], [1, -7]]), rightBank(10, 0, [[0, -4], [-1, -7]])], anchors: [[0, 0], [10, 0], [0, -4], [10, -4]],
    water: -5, mats: TP, vehicles: ['cart'],
  }),
  level({
    id: 'b6', name: 'Wide Brook', region: 'brook', gap: [0, 12], blurb: 'The widest brook yet. Make every twig count.',
    grounds: [leftBank(0, 0), rightBank(12, 0)], anchors: [[0, 0], [12, 0], [0, -2], [12, -2]],
    water: -3.5, mats: TP, vehicles: ['cart'],
  }),

  // ---------------- Mossy Ravine: twine, hanging roads, and bamboo
  level({
    id: 'r1', name: 'Hanging Fern', region: 'ravine', gap: [0, 8], blurb: 'Two old posts stand by the edge. Hang the road from them with twine.',
    tip: REGIONS[1].tip, grounds: [leftBank(0, 0, [[0, -2], [1, -9]]), rightBank(8, 0, [[0, -2], [-1, -9]])], posts: [{ x: -1, y0: 0, y1: 4 }, { x: 9, y0: 0, y1: 4 }],
    anchors: [[0, 0], [8, 0], [-1, 4], [9, 4]], water: -9, floor: 'ravine', mats: TPR, vehicles: ['cart'],
  }),
  level({
    id: 'r2', name: 'Rope Walk', region: 'ravine', gap: [0, 10], blurb: 'Tall posts and nothing below. Twine is cheap: hang it all.',
    grounds: [leftBank(0, 0, [[0, -1], [1, -9]]), rightBank(10, 0, [[0, -1], [-1, -9]])], posts: [{ x: -1, y0: 0, y1: 5 }, { x: 11, y0: 0, y1: 5 }],
    anchors: [[0, 0], [10, 0], [-1, 5], [11, 5]], water: -9, floor: 'ravine', mats: TPR, vehicles: ['cart'],
  }),
  level({
    id: 'r3', name: 'Fern Gully', region: 'ravine', gap: [0, 12], blurb: 'Short posts this time. Build a tower to hang from, or brace from below.',
    grounds: [leftBank(0, 0, [[0, -3], [1, -9]]), rightBank(12, 0, [[0, -3], [-1, -9]])], posts: [{ x: -1, y0: 0, y1: 2 }, { x: 13, y0: 0, y1: 2 }],
    anchors: [[0, 0], [12, 0], [-1, 2], [13, 2], [0, -3], [12, -3]], water: -9, floor: 'ravine', mats: TPR, vehicles: ['cart'],
  }),
  level({
    id: 'r4', name: 'Bamboo Grove', region: 'ravine', gap: [0, 14], blurb: 'Bamboo grows here: strong, stiff and long, but dear. A little goes a long way.',
    tip: { title: 'Bamboo', text: 'Bamboo is the strongest thing you have, and the longest stick: up to 4. It costs more than twigs, so put it where the push or the pull is biggest.' },
    grounds: [leftBank(0, 0, [[0, -2], [1, -9]]), rightBank(14, 0, [[0, -2], [-1, -9]])], posts: [{ x: -1, y0: 0, y1: 3 }, { x: 15, y0: 0, y1: 3 }],
    anchors: [[0, 0], [14, 0], [-1, 3], [15, 3], [0, -2], [14, -2]], water: -9, floor: 'ravine', mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'r5', name: 'Mossy Arch', region: 'ravine', gap: [0, 14], blurb: 'Deep ledges on both walls and no posts. An arch, perhaps?',
    grounds: [leftBank(0, 0, [[0, -5], [1, -9]]), rightBank(14, 0, [[0, -5], [-1, -9]])],
    anchors: [[0, 0], [14, 0], [0, -5], [14, -5]], water: -9, floor: 'ravine', mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'r6', name: 'Waterfall Gap', region: 'ravine', gap: [0, 16], blurb: 'The widest gap in the ravine, with posts above and ledges below.',
    grounds: [leftBank(0, 0, [[0, -3], [1, -9]]), rightBank(16, 0, [[0, -3], [-1, -9]])], posts: [{ x: -1, y0: 0, y1: 4 }, { x: 17, y0: 0, y1: 4 }],
    anchors: [[0, 0], [16, 0], [-1, 4], [17, 4], [0, -3], [16, -3]], water: -9, floor: 'ravine', mats: ALL, vehicles: ['cart'],
  }),

  // ---------------- Reed Marsh: few anchors, rocks, the boat and the climb
  level({
    id: 'm1', name: 'Soft Banks', region: 'marsh', gap: [0, 12], blurb: 'Only the road edges hold on soft banks. A rock in the reeds helps.',
    tip: REGIONS[2].tip, grounds: [leftBank(0, 0, [[0, -1], [1, -4]]), rightBank(12, 0, [[0, -1], [-1, -4]]), rock(5, 7, -2)], anchors: [[0, 0], [12, 0], [6, -2]],
    water: -2.5, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'm2', name: 'Reed Islands', region: 'marsh', gap: [0, 16], blurb: 'Two rocks out in the reeds. Three short spans or one long one?',
    grounds: [leftBank(0, 0, [[0, -1], [1, -4]]), rightBank(16, 0, [[0, -1], [-1, -4]]), rock(4, 6, -2), rock(10, 12, -2)], anchors: [[0, 0], [16, 0], [5, -2], [11, -2]],
    water: -2.5, mirror: 8, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'm3', name: 'The Ferry Lane', region: 'marsh', gap: [0, 14], blurb: 'A boat comes down the channel. Nothing may hang in its way.',
    tip: { title: 'Keep the channel clear', text: 'The striped box is the boat’s way. Nothing may go in it, and nothing may sag into it while the boat goes by: build above the road or hang it.' },
    grounds: [leftBank(0, 1, [[0, -1], [1, -4]]), rightBank(14, 1, [[0, -1], [-1, -4]])], anchors: [[0, 1], [14, 1], [0, 0], [14, 0]],
    boat: { x0: 3, x1: 11, y0: -2.5, y1: 0.4 }, water: -2.5, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'm4', name: 'Up the Bank', region: 'marsh', gap: [0, 12], blurb: 'The far bank is higher. The road has to climb, gently.',
    tip: { title: 'A gentle climb', text: 'The cart can climb a slope, but not a steep one. Spread the rise along the whole road.' },
    grounds: [leftBank(0, 0, [[0, -1], [1, -4]]), rightBank(12, 3, [[0, -4], [-1, -7]]), rock(5, 7, -2)], anchors: [[0, 0], [12, 3], [12, 0], [6, -2]],
    water: -2.5, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'm5', name: 'Two Crossings', region: 'marsh', gap: [0, 20], blurb: 'A brook, an island, and another brook. Two bridges, one budget.',
    grounds: [leftBank(0, 0, [[0, -1], [1, -4]]), island(8, 12, 0), rightBank(20, 0, [[0, -1], [-1, -4]])], anchors: [[0, 0], [8, 0], [12, 0], [20, 0], [8, -2], [12, -2]],
    water: -2.5, mirror: 10, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'm6', name: 'Heron’s Pool', region: 'marsh', gap: [0, 18], blurb: 'A long pool, a boat lane in the middle and a rock on each side of it.',
    grounds: [leftBank(0, 1, [[0, -1], [1, -4]]), rightBank(18, 1, [[0, -1], [-1, -4]]), rock(2, 4, -1), rock(14, 16, -1)], anchors: [[0, 1], [18, 1], [3, -1], [15, -1]],
    boat: { x0: 6, x1: 12, y0: -2.5, y1: 0.4 }, water: -2.5, mats: ALL, vehicles: ['cart'],
  }),

  // ---------------- Sunset Canyon: long spans, wind and the hay wagon
  level({
    id: 'c1', name: 'Windy Rim', region: 'canyon', gap: [0, 14], blurb: 'The wind comes up the canyon in gusts. Brace for it.',
    tip: REGIONS[3].tip, grounds: [leftBank(0, 0, [[0, -3], [1, -12]]), rightBank(14, 0, [[0, -3], [-1, -12]])], posts: [{ x: -1, y0: 0, y1: 4 }, { x: 15, y0: 0, y1: 4 }],
    anchors: [[0, 0], [14, 0], [-1, 4], [15, 4], [0, -3], [14, -3]], water: -12, floor: 'canyon', wind: 3, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'c2', name: 'Hay Day', region: 'canyon', gap: [0, 12], blurb: 'The hay wagon follows the cart across. It is heavy.',
    tip: { title: 'The hay wagon', text: 'The hay wagon follows Dora and Enzo across, and it weighs nearly twice the cart. Both have to reach the far side.' },
    grounds: [leftBank(0, 0, [[0, -3], [1, -12]]), rightBank(12, 0, [[0, -3], [-1, -12]])], posts: [{ x: -1, y0: 0, y1: 4 }, { x: 13, y0: 0, y1: 4 }],
    anchors: [[0, 0], [12, 0], [-1, 4], [13, 4], [0, -3], [12, -3]], water: -12, floor: 'canyon', mats: ALL, vehicles: ['cart', 'wagon'],
  }),
  level({
    id: 'c3', name: 'Red Rock Step', region: 'canyon', gap: [0, 14], blurb: 'The far rim is lower. Ease the road down, and don’t let it buckle.',
    grounds: [leftBank(0, 3, [[0, -3], [1, -12]]), rightBank(14, 0, [[0, -3], [-1, -12]])], posts: [{ x: 15, y0: 0, y1: 4 }],
    anchors: [[0, 3], [14, 0], [0, 0], [15, 4], [14, -3]], water: -12, floor: 'canyon', wind: 2.5, mats: ALL, vehicles: ['cart'],
  }),
  level({
    id: 'c4', name: 'The Long Haul', region: 'canyon', gap: [0, 18], blurb: 'A lonely pillar of red rock in the middle of a long span.',
    grounds: [leftBank(0, 0, [[0, -3], [1, -12]]), rightBank(18, 0, [[0, -3], [-1, -12]]), rock(8.5, 9.5, -4)], anchors: [[0, 0], [18, 0], [0, -3], [18, -3], [9, -4]],
    water: -12, floor: 'canyon', mirror: 9, mats: ALL, vehicles: ['cart', 'wagon'],
  }),
  level({
    id: 'c5', name: 'Gusty Gorge', region: 'canyon', gap: [0, 18], blurb: 'Wind and the wagon together, over a deep gorge.',
    grounds: [leftBank(0, 0, [[0, -3], [1, -12]]), rightBank(18, 0, [[0, -3], [-1, -12]])], posts: [{ x: -1, y0: 0, y1: 5 }, { x: 19, y0: 0, y1: 5 }],
    anchors: [[0, 0], [18, 0], [-1, 5], [19, 5], [0, -3], [18, -3]], water: -12, floor: 'canyon', wind: 3, mats: ALL, vehicles: ['cart', 'wagon'],
  }),
  level({
    id: 'c6', name: 'The Great Canyon', region: 'canyon', gap: [0, 24], blurb: 'The last crossing, at sunset: the great canyon, the wind and the wagon.',
    grounds: [leftBank(0, 0, [[0, -4], [1, -12]]), rightBank(24, 0, [[0, -4], [-1, -12]]), rock(11.5, 12.5, -4)], posts: [{ x: -1, y0: 0, y1: 6 }, { x: 25, y0: 0, y1: 6 }],
    anchors: [[0, 0], [24, 0], [-1, 6], [25, 6], [0, -4], [24, -4], [12, -4]], water: -12, floor: 'canyon', wind: 3, mats: ALL, vehicles: ['cart', 'wagon'],
  }),
];

/** The prices for the medals: [budget, thrifty, master]. The master builder's price is a little above the cheapest
 * stored design that crosses, the thrifty price sits above a second, different stored design (and well above the
 * master's), and the budget leaves room for a sturdy first try. tests/bridges-bot.mjs checks all of it. */
const PRICES: Record<string, [number, number, number]> = {
  b1: [190, 130, 105],
  b2: [310, 210, 170],
  b3: [570, 390, 260],
  b4: [430, 290, 235],
  b5: [730, 500, 380],
  b6: [950, 650, 530],
  r1: [370, 250, 200],
  r2: [510, 350, 285],
  r3: [580, 400, 320],
  r4: [690, 470, 385],
  r5: [1120, 770, 510],
  r6: [820, 560, 455],
  m1: [560, 380, 305],
  m2: [690, 470, 380],
  m3: [1250, 860, 700],
  m4: [830, 570, 345],
  m5: [770, 530, 425],
  m6: [1160, 800, 655],
  c1: [720, 490, 400],
  c2: [640, 440, 360],
  c3: [850, 580, 420],
  c4: [1510, 1040, 850],
  c5: [1630, 1120, 675],
  c6: [1980, 1360, 1115],
};
for (const L of DEFS) { const p = PRICES[L.id]; if (p) { L.budget = p[0]; L.thrifty = p[1]; L.master = p[2]; } }

export const LEVEL_IDS = DEFS.map((L) => L.id);
export const LEVELS: Record<string, LevelDef> = Object.fromEntries(DEFS.map((L) => [L.id, L]));

/** The sandbox: a wide brook with anchors all over and no budget. */
export const SANDBOX: LevelDef = level({
  id: 'sandbox', name: 'Sandbox', region: 'brook', gap: [0, 24], blurb: 'Build anything. No budget, every material, and the hay wagon if you like.',
  grounds: [leftBank(0, 0, [[0, -2], [0, -4], [1, -8]]), rightBank(24, 0, [[0, -2], [0, -4], [-1, -8]]), rock(11, 13, -3)], posts: [{ x: -1, y0: 0, y1: 6 }, { x: 25, y0: 0, y1: 6 }],
  anchors: [[0, 0], [24, 0], [0, -2], [24, -2], [0, -4], [24, -4], [-1, 6], [25, 6], [12, -3]], water: -5, budget: 99999, thrifty: 99999, master: 99999, mats: ['twig', 'plank', 'twine', 'bamboo'], vehicles: ['cart'],
});

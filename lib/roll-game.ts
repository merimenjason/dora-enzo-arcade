// Fluff Roll: roll a dust ball round the meadow and everything smaller than it sticks. Rules only, no DOM.
// Units are metres; +x is east and +z is south. Everything is deterministic: a level's seed lays out the same things every
// time, and the same steering on the same steps rolls the same ball.

export const DT = 1 / 60;
export const SAVE_KEY = 'fluff-roll-v1';
/** A thing sticks when its size is at most this share of the ball's radius. Bigger things are in the way. */
export const PICK = 0.6;
/** How much of a stuck thing's volume the ball keeps (the rest is the gaps between things). */
export const GROW = 0.4;
/** The last ten seconds tick. */
export const HURRY = 10;
export const INTRO = 2.2;

export type Vec = { x: number; z: number };
export type Shape = 'ball' | 'egg' | 'box' | 'disc' | 'cone' | 'stick' | 'leaf' | 'puff' | 'cup' | 'house' | 'tree' | 'critter' | 'pole';
export type Kind = {
  id: string; name: string; plural: string;
  /** Footprint radius in metres: what the ball measures itself against, and what it bumps into. */
  r: number;
  /** Height in metres, for drawing and for the stacked look on the ball. */
  h: number;
  shape: Shape; color: number; accent?: number;
  /** Things the friends call out ("A cuddly sock!"), with tags for themed goals later. */
  tags?: string[];
  /** Critters that potter about, in metres per second at their own size, and scurry off from a ball that could roll them up. */
  walk?: number;
};

const K = (id: string, name: string, plural: string, r: number, h: number, shape: Shape, color: number, accent?: number, tags?: string[]): Kind =>
  ({ id, name, plural, r, h, shape, color, accent, tags });

export const KINDS: Record<string, Kind> = Object.fromEntries([
  // the dust-bath corner: crumbs to cushions
  K('ladybird', 'ladybird', 'ladybirds', 0.012, 0.012, 'critter', 0xd9493e, 0x2b2320, ['friend']),
  K('beetle', 'shiny beetle', 'shiny beetles', 0.018, 0.014, 'critter', 0x3f7f8f, 0x2b2320, ['friend']),
  K('golden', 'golden acorn', 'golden acorns', 0.026, 0.055, 'egg', 0xf5c542, 0xc9952a, ['golden', 'acorn']),
  K('mouse', 'field mouse', 'field mice', 0.035, 0.04, 'critter', 0xb09078, 0xf1d9b8, ['friend']),
  K('duckling', 'duckling', 'ducklings', 0.08, 0.11, 'critter', 0xf7dc6f, 0xf2a03a, ['friend']),
  K('seed', 'sunflower seed', 'sunflower seeds', 0.011, 0.008, 'egg', 0x3b3631, 0xe9e2cf, ['food']),
  K('crumb', 'oat crumb', 'oat crumbs', 0.012, 0.008, 'box', 0xe2c38a, undefined, ['food']),
  K('clover', 'clover leaf', 'clover leaves', 0.016, 0.004, 'leaf', 0x5fb04a, undefined, ['green']),
  K('pebble', 'pebble', 'pebbles', 0.016, 0.012, 'egg', 0xa9a39a, undefined, ['round']),
  K('raisin', 'raisin', 'raisins', 0.014, 0.01, 'egg', 0x5b2f3d, undefined, ['food']),
  K('blueberry', 'blueberry', 'blueberries', 0.018, 0.034, 'ball', 0x4a5fa8, undefined, ['food', 'round']),
  K('button', 'button', 'buttons', 0.02, 0.006, 'disc', 0xe86b7c, 0xffffff, ['round']),
  K('acorn', 'acorn', 'acorns', 0.022, 0.05, 'egg', 0xb07a3c, 0x7a4f27, ['food', 'acorn']),
  K('hazelnut', 'hazelnut', 'hazelnuts', 0.024, 0.044, 'ball', 0xa8733e, undefined, ['food', 'round']),
  K('puff', 'dandelion puff', 'dandelion puffs', 0.03, 0.12, 'puff', 0xfdfbf0, 0x6aa04a, ['green']),
  K('daisy', 'daisy', 'daisies', 0.032, 0.09, 'puff', 0xffffff, 0xf2c23a, ['green']),
  K('cube', 'sugar cube', 'sugar cubes', 0.03, 0.035, 'box', 0xfffcf2, undefined, ['food']),
  K('pinecone', 'pine cone', 'pine cones', 0.04, 0.09, 'cone', 0x8b5a33, undefined, []),
  K('reel', 'cotton reel', 'cotton reels', 0.04, 0.06, 'disc', 0xf6a9b8, 0xd9b48a, ['round']),
  K('mushroom', 'little mushroom', 'little mushrooms', 0.045, 0.07, 'puff', 0xe55a4e, 0xfff1dc, ['green']),
  K('block', 'toy block', 'toy blocks', 0.05, 0.1, 'box', 0x9fd0f2, 0xfff1a8, ['toy']),
  K('apple', 'apple', 'apples', 0.06, 0.12, 'ball', 0xd9493e, 0x5f9a3a, ['food', 'round']),
  K('chew', 'chew stick', 'chew sticks', 0.07, 0.03, 'stick', 0xc99a62, undefined, ['toy']),
  K('teacup', 'teacup', 'teacups', 0.07, 0.08, 'cup', 0xf4f0e6, 0x7fb0d9, []),
  K('carrot', 'carrot', 'carrots', 0.08, 0.05, 'cone', 0xf08a2c, 0x5fb04a, ['food']),
  K('hay', 'hay tuft', 'hay tufts', 0.09, 0.1, 'puff', 0xe8c56a, 0xcfa64c, ['green']),
  K('sock', 'cuddly sock', 'cuddly socks', 0.1, 0.05, 'stick', 0xb7a3d9, 0xffffff, ['toy']),
  K('wicker', 'wicker ball', 'wicker balls', 0.11, 0.22, 'ball', 0xd8b26e, undefined, ['toy', 'round']),
  K('pot', 'flower pot', 'flower pots', 0.12, 0.3, 'cup', 0xc4683f, 0x6aa04a, []),
  K('slipper', 'slipper', 'slippers', 0.15, 0.08, 'egg', 0xf6a9b8, 0xffffff, ['toy']),
  K('can', 'watering can', 'watering cans', 0.18, 0.28, 'cup', 0x7fb0d9, undefined, []),
  K('cushion', 'cushion', 'cushions', 0.24, 0.14, 'box', 0xf2d36b, 0xe0708a, ['toy']),
  K('tub', 'dust-bath tub', 'dust-bath tubs', 0.34, 0.24, 'cup', 0x9fd0f2, 0xf4e3c2, []),
  // the clover garden
  K('cabbage', 'cabbage', 'cabbages', 0.16, 0.25, 'ball', 0x9acb6b, undefined, ['food', 'round', 'green']),
  K('bucket', 'bucket', 'buckets', 0.17, 0.3, 'cup', 0x8fa4b5, undefined, []),
  K('sunflower', 'sunflower', 'sunflowers', 0.18, 1.3, 'puff', 0xf7c531, 0x5f9a3a, ['green']),
  K('flag', 'golf flag', 'golf flags', 0.16, 0.9, 'pole', 0xf6a9b8, 0xffffff, ['toy']),
  K('hedgehog', 'sleepy hedgehog', 'sleepy hedgehogs', 0.2, 0.2, 'critter', 0x8b6a4f, 0xf1d9b8, ['friend']),
  K('pumpkin', 'pumpkin', 'pumpkins', 0.26, 0.35, 'ball', 0xf08a2c, 0x5f9a3a, ['food', 'round']),
  K('birdbath', 'bird bath', 'bird baths', 0.34, 0.8, 'cup', 0xd9d4c8, 0x9fd0f2, []),
  K('crate', 'apple crate', 'apple crates', 0.36, 0.45, 'box', 0xc99a62, 0xd9493e, []),
  K('chair', 'garden chair', 'garden chairs', 0.42, 0.9, 'box', 0xffffff, 0x9fd0f2, []),
  K('duck', 'duck', 'ducks', 0.25, 0.35, 'critter', 0xffffff, 0xf2a03a, ['friend']),
  K('bale', 'hay bale', 'hay bales', 0.6, 0.6, 'box', 0xe8c56a, 0xcfa64c, ['green']),
  K('barrow', 'wheelbarrow', 'wheelbarrows', 0.6, 0.6, 'cup', 0xd9493e, 0x5b5b5b, []),
  K('bench', 'bench', 'benches', 0.8, 0.8, 'box', 0xb07a3c, undefined, []),
  K('bush', 'round bush', 'round bushes', 0.7, 1, 'ball', 0x5f9a3a, 0xf6a9b8, ['green', 'round']),
  // the barnyard and the meadow
  K('barrel', 'rain barrel', 'rain barrels', 0.45, 0.9, 'disc', 0x9b6a3e, 0x5b5b5b, ['round']),
  K('bristle', 'Bristleback', 'Bristlebacks', 0.9, 0.9, 'critter', 0x8a6a52, 0xf2e4c8, ['friend', 'beast']),
  K('cart', 'hay cart', 'hay carts', 1.4, 1.6, 'box', 0xc4683f, 0xe8c56a, []),
  K('haystack', 'haystack', 'haystacks', 1.6, 2.4, 'cone', 0xe8c56a, undefined, ['green']),
  K('tree', 'apple tree', 'apple trees', 1.8, 4.5, 'tree', 0x6aa04a, 0x8b5a33, ['green']),
  K('shed', 'garden shed', 'garden sheds', 2.2, 2.8, 'house', 0xd9c3a0, 0xc4683f, ['house']),
  K('windmill', 'windmill', 'windmills', 2.6, 6, 'house', 0xf4e3c2, 0xe8c56a, ['house']),
  K('barn', 'big red barn', 'big red barns', 5, 7, 'house', 0xd9493e, 0xffffff, ['house']),
  K('tractor', 'little tractor', 'little tractors', 1.9, 2.4, 'box', 0xd9493e, 0x3b3631, []),
  K('silo', 'grain silo', 'grain silos', 2.4, 9, 'disc', 0xd9d4c8, 0x9fb7c9, ['round']),
  K('oak', 'old oak', 'old oaks', 3.2, 10, 'tree', 0x4f8f3a, 0x7a4f27, ['green']),
  K('farmhouse', 'farmhouse', 'farmhouses', 4, 6.5, 'house', 0xf4e3c2, 0x9b4a3a, ['house']),
  K('hill', 'grassy hill', 'grassy hills', 9, 6, 'ball', 0x7fb35d, undefined, ['green', 'round']),
].map((k) => [k.id, k]));
for (const [id, walk] of Object.entries({ ladybird: 0.05, beetle: 0.07, mouse: 0.16, duckling: 0.3, duck: 0.4 })) KINDS[id].walk = walk;
/** Seconds added to the clock for every golden thing rolled up. */
export const GOLDEN_TIME = 5;
/** Catches closer together than this keep a streak going. */
export const STREAK_GAP = 1;

export type Spawn = {
  kind: string; n: number;
  /** Distance from the start, in metres: small things near the middle, big ones further out. */
  ring: [number, number];
  /** Laid out in this many little patches instead of one by one. */
  patches?: number;
};
export type LevelSpec = {
  id: string; name: string; blurb: string;
  /** Starting and target radius, in metres. */
  start: number; goal: number;
  time: number;
  /** Half the width of the fenced square, in metres. */
  half: number;
  seed: number;
  spawns: Spawn[];
};

export const LEVELS: LevelSpec[] = [
  {
    id: 'corner', name: 'Dust Bath Corner', blurb: 'Seeds, buttons and acorns by the dust bath. Make a fluffball as big as a cushion!',
    start: 0.04, goal: 0.2, time: 180, half: 7, seed: 41,
    spawns: [
      // a carpet of crumbs right round the start, so the very first push picks things up
      { kind: 'seed', n: 110, ring: [0.13, 1.2] }, { kind: 'crumb', n: 110, ring: [0.13, 1.2] }, { kind: 'clover', n: 80, ring: [0.13, 1.3] },
      { kind: 'seed', n: 260, ring: [0.12, 2.4], patches: 26 }, { kind: 'crumb', n: 220, ring: [0.12, 2.6], patches: 22 },
      { kind: 'clover', n: 220, ring: [0.15, 3.2], patches: 24 }, { kind: 'pebble', n: 110, ring: [0.3, 3.6], patches: 12 },
      { kind: 'raisin', n: 90, ring: [0.5, 3.4], patches: 10 }, { kind: 'blueberry', n: 70, ring: [0.9, 3.8], patches: 9 },
      { kind: 'button', n: 60, ring: [1, 4.2], patches: 8 }, { kind: 'acorn', n: 70, ring: [1.4, 4.6], patches: 9 },
      { kind: 'hazelnut', n: 44, ring: [1.6, 4.8], patches: 7 }, { kind: 'cube', n: 30, ring: [1.8, 4.8], patches: 5 },
      { kind: 'puff', n: 30, ring: [2, 5.2] }, { kind: 'daisy', n: 36, ring: [2, 5.6], patches: 6 },
      { kind: 'pinecone', n: 24, ring: [2.6, 5.6] }, { kind: 'reel', n: 18, ring: [2.6, 5.8] },
      { kind: 'mushroom', n: 26, ring: [3, 6.2], patches: 5 }, { kind: 'block', n: 24, ring: [3, 6.2], patches: 4 },
      { kind: 'apple', n: 18, ring: [3.6, 6.4], patches: 3 }, { kind: 'chew', n: 14, ring: [3.4, 6.4] },
      { kind: 'teacup', n: 10, ring: [3.8, 6.4] }, { kind: 'carrot', n: 12, ring: [4, 6.5], patches: 2 },
      { kind: 'hay', n: 14, ring: [4.2, 6.6] }, { kind: 'sock', n: 8, ring: [4.4, 6.6] },
      { kind: 'wicker', n: 6, ring: [4.6, 6.6] }, { kind: 'pot', n: 6, ring: [5, 6.6] }, { kind: 'slipper', n: 4, ring: [5, 6.6] },
      { kind: 'can', n: 3, ring: [5.2, 6.5] }, { kind: 'cushion', n: 3, ring: [5.4, 6.5] }, { kind: 'tub', n: 1, ring: [1.6, 1.6] },
      { kind: 'ladybird', n: 24, ring: [0.3, 3.2] }, { kind: 'beetle', n: 16, ring: [0.8, 4.2] }, { kind: 'mouse', n: 8, ring: [2.6, 6.2] },
      { kind: 'golden', n: 3, ring: [3.6, 6.6] },
    ],
  },
  {
    id: 'garden', name: 'Clover Garden', blurb: 'Apples, cabbages, flower pots and a sleepy hedgehog. Roll up a fluffball as tall as Dora’s door!',
    start: 0.16, goal: 0.8, time: 240, half: 26, seed: 77,
    spawns: [
      { kind: 'acorn', n: 70, ring: [0.5, 6], patches: 10 }, { kind: 'button', n: 30, ring: [0.5, 6] },
      { kind: 'daisy', n: 70, ring: [1, 9], patches: 12 }, { kind: 'puff', n: 40, ring: [1, 9] },
      { kind: 'pinecone', n: 40, ring: [1, 9], patches: 6 }, { kind: 'mushroom', n: 40, ring: [1, 10], patches: 8 },
      { kind: 'block', n: 30, ring: [1.5, 9], patches: 5 }, { kind: 'apple', n: 50, ring: [2, 11], patches: 8 },
      { kind: 'chew', n: 20, ring: [2, 10] }, { kind: 'teacup', n: 16, ring: [2, 10], patches: 3 },
      { kind: 'carrot', n: 40, ring: [3, 12], patches: 6 }, { kind: 'hay', n: 36, ring: [3, 13] },
      { kind: 'sock', n: 14, ring: [3, 12] }, { kind: 'wicker', n: 14, ring: [4, 14] }, { kind: 'pot', n: 24, ring: [4, 15], patches: 5 },
      { kind: 'slipper', n: 10, ring: [5, 15] }, { kind: 'cabbage', n: 30, ring: [6, 17], patches: 5 },
      { kind: 'can', n: 10, ring: [7, 18] }, { kind: 'bucket', n: 10, ring: [7, 18] }, { kind: 'flag', n: 9, ring: [8, 20] },
      { kind: 'sunflower', n: 26, ring: [8, 20], patches: 4 }, { kind: 'hedgehog', n: 8, ring: [9, 20] },
      { kind: 'cushion', n: 8, ring: [9, 20] }, { kind: 'duck', n: 8, ring: [10, 22], patches: 2 },
      { kind: 'pumpkin', n: 14, ring: [11, 23], patches: 3 }, { kind: 'tub', n: 4, ring: [12, 23] },
      { kind: 'birdbath', n: 4, ring: [13, 23] }, { kind: 'crate', n: 8, ring: [13, 24] }, { kind: 'chair', n: 6, ring: [14, 24] },
      { kind: 'bale', n: 8, ring: [15, 25] }, { kind: 'barrow', n: 3, ring: [16, 25] }, { kind: 'bush', n: 8, ring: [17, 25] },
      { kind: 'bench', n: 3, ring: [18, 25] },
      { kind: 'mouse', n: 12, ring: [1, 10] }, { kind: 'duckling', n: 15, ring: [4, 16], patches: 3 }, { kind: 'golden', n: 3, ring: [9, 24] },
    ],
  },
  {
    id: 'yard', name: 'Hay Barn Yard', blurb: 'Hay bales, wheelbarrows, sheds and a sleepy Bristleback. Roll up a fluffball as tall as a haystack!',
    start: 0.8, goal: 4, time: 330, half: 90, seed: 113,
    spawns: [
      { kind: 'slipper', n: 24, ring: [2, 12], patches: 4 }, { kind: 'wicker', n: 24, ring: [2, 12] }, { kind: 'pot', n: 40, ring: [2, 15], patches: 6 },
      { kind: 'can', n: 20, ring: [2, 15] }, { kind: 'cushion', n: 30, ring: [3, 18] }, { kind: 'tub', n: 20, ring: [4, 20] },
      { kind: 'mouse', n: 20, ring: [2, 20] }, { kind: 'cabbage', n: 60, ring: [3, 20], patches: 8 }, { kind: 'bucket', n: 30, ring: [3, 22] },
      { kind: 'pumpkin', n: 50, ring: [4, 28], patches: 6 }, { kind: 'sunflower', n: 60, ring: [5, 30], patches: 6 }, { kind: 'flag', n: 12, ring: [5, 30] },
      { kind: 'hedgehog', n: 16, ring: [6, 30] }, { kind: 'duckling', n: 30, ring: [5, 30], patches: 4 }, { kind: 'duck', n: 20, ring: [6, 34], patches: 4 },
      { kind: 'crate', n: 30, ring: [8, 36], patches: 5 }, { kind: 'birdbath', n: 10, ring: [8, 36] }, { kind: 'chair', n: 16, ring: [10, 40] },
      { kind: 'bale', n: 60, ring: [10, 50], patches: 8 }, { kind: 'barrow', n: 14, ring: [12, 50] }, { kind: 'bench', n: 14, ring: [12, 50] },
      { kind: 'bush', n: 40, ring: [14, 60], patches: 6 }, { kind: 'barrel', n: 24, ring: [14, 60] }, { kind: 'bristle', n: 10, ring: [18, 60] },
      { kind: 'cart', n: 18, ring: [20, 70] }, { kind: 'haystack', n: 24, ring: [22, 75], patches: 12 }, { kind: 'tree', n: 40, ring: [24, 85], patches: 14 },
      { kind: 'shed', n: 12, ring: [30, 85] }, { kind: 'tractor', n: 8, ring: [30, 85] }, { kind: 'windmill', n: 6, ring: [45, 85] },
      { kind: 'barn', n: 4, ring: [50, 85] }, { kind: 'golden', n: 3, ring: [25, 85] },
    ],
  },
  {
    id: 'meadow', name: 'The Whole Meadow', blurb: 'Haystacks, windmills, barns and grassy hills. Roll up the whole meadow!',
    start: 3, goal: 20, time: 300, half: 330, seed: 211,
    spawns: [
      { kind: 'duck', n: 40, ring: [6, 50], patches: 6 }, { kind: 'barrel', n: 40, ring: [6, 60] }, { kind: 'bench', n: 30, ring: [6, 60] },
      { kind: 'bristle', n: 30, ring: [8, 60] }, { kind: 'bale', n: 120, ring: [10, 80], patches: 12 }, { kind: 'bush', n: 80, ring: [10, 90], patches: 10 },
      { kind: 'cart', n: 60, ring: [15, 110], patches: 8 }, { kind: 'haystack', n: 70, ring: [20, 130], patches: 8 }, { kind: 'tree', n: 120, ring: [20, 160], patches: 12 },
      { kind: 'shed', n: 40, ring: [30, 170] }, { kind: 'tractor', n: 30, ring: [30, 170] }, { kind: 'windmill', n: 30, ring: [45, 170] },
      { kind: 'silo', n: 30, ring: [45, 170] }, { kind: 'barn', n: 40, ring: [60, 185] }, { kind: 'oak', n: 60, ring: [40, 185], patches: 8 },
      { kind: 'farmhouse', n: 30, ring: [80, 195] }, { kind: 'hill', n: 120, ring: [205, 322] }, { kind: 'golden', n: 3, ring: [100, 320] },
    ],
  },
];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);

export type Thing = {
  id: number; kind: string; x: number; z: number; yaw: number;
  /** Footprint radius: the kind's, varied a little per thing. */
  r: number;
  stuck: boolean;
  /** Can't stick again until the clock passes this (things knocked off the ball bounce clear first). */
  calm: number;
};
export type RollEvent =
  | { kind: 'stick'; id: number; dir: [number, number, number]; at: number; streak: number }
  | { kind: 'golden'; id: number; found: number }
  /** Kinds of things the ball has just grown big enough to roll up. */
  | { kind: 'ready'; kinds: string[] }
  | { kind: 'knock'; ids: number[] }
  | { kind: 'bump'; speed: number; id: number }
  | { kind: 'fence'; speed: number }
  | { kind: 'grow'; size: string }
  | { kind: 'goal' }
  | { kind: 'tick'; left: number }
  | { kind: 'end'; reached: boolean };
export type Mode = 'intro' | 'roll' | 'done';

export type Profile = { unlocked: string[]; best: Record<string, number>; stars: Record<string, number>; golden: Record<string, number>; found: string[]; rolled: number };
export function readProfile(text: string | null): Profile {
  const p: Profile = { unlocked: [LEVELS[0].id], best: {}, stars: {}, golden: {}, found: [], rolled: 0 };
  try {
    const raw = text ? JSON.parse(text) : null; if (!raw || typeof raw !== 'object') return p;
    const ids = new Set(LEVELS.map((l) => l.id));
    if (Array.isArray(raw.unlocked)) for (const id of raw.unlocked) if (ids.has(id) && !p.unlocked.includes(id)) p.unlocked.push(id);
    for (const [id, v] of Object.entries(raw.best ?? {})) if (ids.has(id) && typeof v === 'number' && v > 0 && v < 1000) p.best[id] = v;
    for (const [id, v] of Object.entries(raw.golden ?? {})) if (ids.has(id) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 99) p.golden[id] = v as number;
    for (const [id, v] of Object.entries(raw.stars ?? {})) if (ids.has(id) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3) p.stars[id] = v as number;
    if (Array.isArray(raw.found)) for (const k of raw.found) if (typeof k === 'string' && KINDS[k] && !p.found.includes(k)) p.found.push(k);
    if (Number.isInteger(raw.rolled) && raw.rolled >= 0) p.rolled = raw.rolled;
  } catch { /* a broken save starts fresh */ }
  return p;
}

/** A small seeded generator (mulberry32), so a level lays out the same way every time. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Lays out a level's things: patches and singles in their rings, never overlapping and clear of the start. */
export function layout(spec: LevelSpec): Thing[] {
  const rand = seeded(spec.seed), things: Thing[] = [], grid = new Map<string, number[]>(), cell = 0.5;
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const clear = (x: number, z: number, r: number) => {
    if (Math.abs(x) > spec.half - r - 0.05 || Math.abs(z) > spec.half - r - 0.05 || Math.hypot(x, z) < spec.start * 3 + r) return false;
    const reach = Math.ceil((r + 6) / cell), cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    // big things are rare, so a wide look only happens for them; small ones check the cells nearby
    const span = Math.min(reach, r > 1 ? reach : 3);
    for (let i = cx - span; i <= cx + span; i++) for (let j = cz - span; j <= cz + span; j++) for (const id of grid.get(`${i},${j}`) ?? []) { const t = things[id]; if (Math.hypot(t.x - x, t.z - z) < t.r + r + 0.004) return false; }
    for (const t of bigOnes) if (Math.hypot(t.x - x, t.z - z) < t.r + r + 0.004) return false;
    return true;
  };
  const bigOnes: Thing[] = [];
  const add = (kind: string, x: number, z: number) => {
    const k = KINDS[kind], r = k.r * (0.88 + rand() * 0.24);
    if (!clear(x, z, r)) return false;
    const t: Thing = { id: things.length, kind, x, z, yaw: rand() * Math.PI * 2, r, stuck: false, calm: 0 };
    things.push(t); if (r > 1) bigOnes.push(t); else { const g = grid.get(key(x, z)); if (g) g.push(t.id); else grid.set(key(x, z), [t.id]); }
    return true;
  };
  // biggest first, so the large things find room and the small ones fill in round them
  const order = [...spec.spawns].sort((a, b) => KINDS[b.kind].r - KINDS[a.kind].r);
  for (const s of order) {
    const k = KINDS[s.kind], spot = () => { const a = rand() * Math.PI * 2, d = s.ring[0] + Math.sqrt(rand()) * (s.ring[1] - s.ring[0]); return { x: Math.cos(a) * d, z: Math.sin(a) * d }; };
    if (s.patches) {
      let left = s.n;
      for (let p = 0; p < s.patches && left > 0; p++) {
        const c = spot(), want = Math.ceil(left / (s.patches - p)), spread = k.r * 3 + Math.sqrt(want) * k.r * 2.4;
        let placed = 0;
        for (let tries = 0; placed < want && tries < want * 12; tries++) {
          const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
          if (add(s.kind, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d)) placed++;
        }
        left -= placed;
      }
    } else for (let placed = 0, tries = 0; placed < s.n && tries < s.n * 20; tries++) { const p = spot(); if (add(s.kind, p.x, p.z)) placed++; }
  }
  return things;
}

/** A size as people say it: "4 cm", "52 cm", "1.3 m". `r` is the radius; this shows the diameter. */
export function sizeLabel(r: number) {
  const d = r * 2;
  if (d < 1) return `${Math.round(d * 100)} cm`;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} m`;
}
/** Stars for a finished level: reaching the goal is one, a third bigger again is two, two-thirds bigger is three. */
export function starsFor(spec: LevelSpec, r: number) { return r >= spec.goal * 1.65 ? 3 : r >= spec.goal * 1.35 ? 2 : r >= spec.goal ? 1 : 0; }
/** Top speed grows a little slower than the ball, so a big ball feels heavy but still covers more ground. Past a metre
 *  of radius it grows much more slowly, or a barn-sized ball would cross the whole meadow in a few seconds. */
export const topSpeed = (r: number) => (r <= 1 ? 7.5 * Math.pow(r, 0.9) : 7.5 * Math.pow(r, 0.55));
/** The radius a ball needs before a thing of footprint `r` sticks to it. */
export const sticksAt = (r: number) => r / PICK;
/** How fast the ball turns towards where it's steered (per second); a big ball is a little lazier. */
export const grip = (r: number, start: number) => 5.2 / Math.pow(Math.max(1, r / start), 0.18);

export type Ball = { x: number; z: number; vx: number; vz: number; r: number };

export class RollGame {
  readonly spec: LevelSpec;
  readonly things: Thing[];
  readonly profile: Profile;
  mode: Mode = 'intro';
  /** Seconds since the level opened (the intro included). */
  clock = 0;
  timer = INTRO;
  left: number;
  ball: Ball;
  /** Which way "forward" is for the steering, in radians (0 is +x). The camera sits behind it. */
  heading = -Math.PI / 2;
  /** The world-space push the ball is steered towards, length 0..1. */
  input: Vec = { x: 0, z: 0 };
  stuck: number[] = [];
  reached = false;
  /** Catches in a row, each within STREAK_GAP of the last, and the longest this level. */
  streak = 0;
  bestStreak = 0;
  goldens = 0;
  readonly goldenTotal: number;
  stars = 0;
  events: RollEvent[] = [];
  profileChanged = false;
  private volume: number;
  private grid = new Map<string, number[]>();
  private bigOnes: number[] = [];
  private cell: number;
  private milestone: number;
  private lastStick = -Infinity;
  /** The level's kinds, smallest first, and how many of them the ball can already roll up. */
  private kinds: string[];
  private readyCount = 0;
  private walkers: number[] = [];
  private moods = new Map<number, { a: number; turn: number; still: boolean; next: number }>();
  private rand: () => number;

  constructor(opts: { level: string; profile?: Profile }) {
    const spec = levelById(opts.level); if (!spec) throw new Error(`no level ${opts.level}`);
    this.spec = spec; this.profile = opts.profile ?? readProfile(null);
    this.things = layout(spec); this.left = spec.time;
    this.ball = { x: 0, z: 0, vx: 0, vz: 0, r: spec.start }; this.volume = spec.start ** 3;
    this.cell = Math.max(0.25, spec.goal * 1.5);
    for (const t of this.things) this.file(t);
    this.milestone = this.nextMilestone(spec.start);
    this.rand = seeded(spec.seed * 7 + 3);
    this.goldenTotal = this.things.filter((t) => KINDS[t.kind].tags?.includes('golden')).length;
    for (const t of this.things) if (KINDS[t.kind].walk) { this.walkers.push(t.id); this.moods.set(t.id, { a: -t.yaw, turn: 0, still: false, next: 0 }); }
    // golden things stay a surprise: they are never named as the next thing up
    this.kinds = [...new Set(this.things.map((t) => t.kind))].filter((id) => !KINDS[id].tags?.includes('golden')).sort((a, b) => KINDS[a].r - KINDS[b].r);
    while (this.readyCount < this.kinds.length && KINDS[this.kinds[this.readyCount]].r <= spec.start * PICK) this.readyCount++;
  }

  /** Whether the ball could roll this thing up right now (size only). */
  canRoll(t: Thing) { return t.r <= this.ball.r * PICK; }
  /** The next kind of thing the ball will grow big enough for, and the radius it needs. */
  nextUp(): { kind: string; at: number } | null {
    const id = this.kinds[this.readyCount]; return id ? { kind: id, at: sticksAt(KINDS[id].r) } : null;
  }

  private key(x: number, z: number) { return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; }
  private file(t: Thing) {
    if (t.r > this.cell) { this.bigOnes.push(t.id); return; }
    const k = this.key(t.x, t.z), g = this.grid.get(k); if (g) g.push(t.id); else this.grid.set(k, [t.id]);
  }
  private unfile(t: Thing) {
    if (t.r > this.cell) { this.bigOnes = this.bigOnes.filter((id) => id !== t.id); return; }
    const k = this.key(t.x, t.z), g = this.grid.get(k); if (!g) return;
    const i = g.indexOf(t.id); if (i >= 0) g.splice(i, 1);
  }
  /** Free things whose footprint could touch a circle. */
  near(x: number, z: number, reach: number): Thing[] {
    const out: Thing[] = [], c = this.cell, span = reach + c;
    const x0 = Math.floor((x - span) / c), x1 = Math.floor((x + span) / c), z0 = Math.floor((z - span) / c), z1 = Math.floor((z + span) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) for (const id of this.grid.get(`${i},${j}`) ?? []) out.push(this.things[id]);
    for (const id of this.bigOnes) out.push(this.things[id]);
    return out;
  }

  /** Steering from a stick or the keys: `turn` swings the heading (and the camera), `push` rolls forward or back. */
  steer(turn: number, push: number, dt: number) {
    const big = Math.max(1, this.ball.r / this.spec.start);
    this.heading += turn * dt * 2.1 / Math.pow(big, 0.12);
    const fx = Math.cos(this.heading), fz = Math.sin(this.heading), sx = -fz, sz = fx;
    // a sideways stick also edges the ball across, so a small correction doesn't need a full turn
    const side = turn * 0.35 * Math.min(1, Math.abs(push) + 0.4);
    let x = fx * push + sx * side, z = fz * push + sz * side;
    const len = Math.hypot(x, z); if (len > 1) { x /= len; z /= len; }
    this.input = { x, z };
  }
  setInput(x: number, z: number) { const len = Math.hypot(x, z); this.input = len > 1 ? { x: x / len, z: z / len } : { x, z }; }

  skipIntro() { if (this.mode === 'intro') { this.mode = 'roll'; this.timer = 0; } }

  step(dt: number) {
    this.clock += dt;
    if (this.mode === 'intro') { this.timer -= dt; if (this.timer <= 0) { this.mode = 'roll'; this.timer = 0; } this.coast(dt); return; }
    if (this.mode === 'done') { this.coast(dt); return; }
    const before = Math.ceil(this.left);
    this.left = Math.max(0, this.left - dt);
    if (Math.ceil(this.left) !== before && this.left <= HURRY && this.left > 0) this.events.push({ kind: 'tick', left: Math.ceil(this.left) });
    this.move(dt, true);
    this.walk(dt);
    if (this.left <= 0) this.finish();
  }

  /** After the bell (and during the intro) the ball only slows down; nothing sticks. */
  private coast(dt: number) { const b = this.ball, k = Math.exp(-dt * 3); b.vx *= k; b.vz *= k; this.move(dt, false); }

  private move(dt: number, live: boolean) {
    const b = this.ball, top = topSpeed(b.r);
    if (live) {
      const g = 1 - Math.exp(-dt * grip(b.r, this.spec.start));
      b.vx += (this.input.x * top - b.vx) * g; b.vz += (this.input.z * top - b.vz) * g;
    }
    const sp = Math.hypot(b.vx, b.vz); if (sp > top * 1.4) { b.vx *= (top * 1.4) / sp; b.vz *= (top * 1.4) / sp; }
    // small substeps, so a fast little ball can't skip over a seed
    const n = Math.max(1, Math.ceil((sp * dt) / (b.r * 0.5)));
    for (let i = 0; i < n; i++) {
      b.x += (b.vx * dt) / n; b.z += (b.vz * dt) / n;
      this.fence();
      this.touch(live);
    }
  }

  private fence() {
    const b = this.ball, lim = this.spec.half - b.r;
    for (const axis of ['x', 'z'] as const) {
      const v = axis === 'x' ? 'vx' : 'vz';
      if (Math.abs(b[axis]) > lim) {
        b[axis] = Math.sign(b[axis]) * lim;
        if (Math.sign(b[v]) === Math.sign(b[axis])) { const hit = Math.abs(b[v]); b[v] = -b[v] * 0.35; if (hit > topSpeed(b.r) * 0.3) this.events.push({ kind: 'fence', speed: hit }); }
      }
    }
  }

  private touch(live: boolean) {
    const b = this.ball;
    for (const t of this.near(b.x, b.z, b.r + 0.02)) {
      if (t.stuck) continue;
      const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz), gap = b.r + t.r;
      if (d >= gap) continue;
      if (live && t.r <= b.r * PICK && this.clock >= t.calm) { this.stick(t, dx, dz, d); continue; }
      if (t.r <= b.r * PICK) continue; // knocked-off things settling: roll through them for a moment
      // in the way: push the ball out and bounce it
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      b.x = t.x - nx * gap; b.z = t.z - nz * gap;
      const into = b.vx * nx + b.vz * nz;
      if (into > 0) {
        b.vx -= nx * into * 1.45; b.vz -= nz * into * 1.45;
        if (into > topSpeed(b.r) * 0.25) this.events.push({ kind: 'bump', speed: into, id: t.id });
        if (live && into > topSpeed(b.r) * 0.6) this.knock(nx, nz);
      }
    }
  }

  /** Critters potter about, and run from a ball that could roll them up (never faster than it can follow). */
  private walk(dt: number) {
    const b = this.ball, half = this.spec.half;
    for (const id of this.walkers) {
      const t = this.things[id], m = this.moods.get(id)!; if (t.stuck) continue;
      const k = KINDS[t.kind], dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
      if (this.clock >= m.next) { m.next = this.clock + 0.8 + this.rand() * 2.4; m.turn = (this.rand() - 0.5) * 2.4; m.still = this.rand() < 0.3; }
      let speed: number;
      if (this.canRoll(t) && this.clock >= t.calm && d < b.r * 6 + 0.25) {
        // scurry away, zigzagging a little; a ball always rolls faster than a critter runs
        const away = Math.atan2(dz, dx) + m.turn * 0.35, diff = Math.atan2(Math.sin(away - m.a), Math.cos(away - m.a));
        m.a += diff * Math.min(1, dt * 7); speed = Math.min(k.walk! * 2.2 * (t.r / k.r), topSpeed(b.r) * 0.45);
      } else { m.a += m.turn * dt; speed = m.still ? 0 : k.walk! * 0.6 * (t.r / k.r); }
      if (!speed) continue;
      const nx = t.x + Math.cos(m.a) * speed * dt, nz = t.z + Math.sin(m.a) * speed * dt, lim = half - t.r;
      // too big to roll up: it walks round the ball instead of into it
      let blocked = Math.abs(nx) > lim || Math.abs(nz) > lim || (!this.canRoll(t) && Math.hypot(nx - b.x, nz - b.z) < b.r + t.r);
      if (!blocked) for (const o of this.near(nx, nz, t.r)) if (o !== t && !o.stuck && o.r > t.r && Math.hypot(o.x - nx, o.z - nz) < o.r + t.r) { blocked = true; break; }
      if (blocked) { m.a += (this.rand() < 0.5 ? -1 : 1) * (1 + this.rand()); continue; }
      this.unfile(t); t.x = nx; t.z = nz; this.file(t);
      t.yaw = -m.a;
    }
  }

  private stick(t: Thing, dx: number, dz: number, d: number) {
    const b = this.ball;
    t.stuck = true; this.unfile(t); this.stuck.push(t.id);
    this.streak = this.clock - this.lastStick < STREAK_GAP ? this.streak + 1 : 1; this.lastStick = this.clock;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    // where on the ball it landed: the side it came from, a little above the ground line
    const y = Math.min(1, KINDS[t.kind].h / Math.max(b.r, 1e-6)) * 0.5 - 0.6, hx = d > 1e-6 ? dx / d : 1, hz = d > 1e-6 ? dz / d : 0, l = Math.hypot(hx, y, hz);
    this.events.push({ kind: 'stick', id: t.id, dir: [hx / l, y / l, hz / l], at: b.r, streak: this.streak });
    if (KINDS[t.kind].tags?.includes('golden')) { this.goldens++; this.left += GOLDEN_TIME; this.events.push({ kind: 'golden', id: t.id, found: this.goldens }); }
    this.volume += GROW * t.r ** 3; this.resize();
    if (!this.profile.found.includes(t.kind)) { this.profile.found.push(t.kind); this.profileChanged = true; }
  }

  /** A hard bump shakes a few of the newest small things loose. They land around the ball. */
  private knock(nx: number, nz: number) {
    const b = this.ball, ids: number[] = [];
    for (let i = this.stuck.length - 1; i >= 0 && ids.length < 3; i--) {
      const t = this.things[this.stuck[i]]; if (t.r > b.r * 0.35) continue;
      ids.push(t.id); this.stuck.splice(i, 1);
    }
    if (!ids.length) return;
    ids.forEach((id, i) => {
      const t = this.things[id], a = Math.atan2(-nz, -nx) + (i - 1) * 0.7, d = b.r + t.r + 0.02 + b.r * 0.6;
      t.stuck = false; t.x = b.x + Math.cos(a) * d; t.z = b.z + Math.sin(a) * d; t.calm = this.clock + 1.2;
      const lim = this.spec.half - t.r; t.x = Math.max(-lim, Math.min(lim, t.x)); t.z = Math.max(-lim, Math.min(lim, t.z));
      this.file(t); this.volume -= GROW * t.r ** 3;
    });
    this.resize();
    this.events.push({ kind: 'knock', ids });
  }

  private resize() {
    const b = this.ball; b.r = Math.cbrt(Math.max(this.volume, this.spec.start ** 3));
    if (b.r >= this.milestone) { this.events.push({ kind: 'grow', size: sizeLabel(this.milestone) }); this.milestone = this.nextMilestone(b.r); }
    if (!this.reached && b.r >= this.spec.goal) { this.reached = true; this.events.push({ kind: 'goal' }); }
    const ready: string[] = [];
    while (this.readyCount < this.kinds.length && KINDS[this.kinds[this.readyCount]].r <= b.r * PICK) ready.push(this.kinds[this.readyCount++]);
    if (ready.length) this.events.push({ kind: 'ready', kinds: ready });
  }
  /** Size call-outs at round diameters: every 5 cm under 50 cm, every 10 cm under 2 m, then every metre. */
  private nextMilestone(r: number) {
    const d = r * 2, step = d < 0.5 ? 0.05 : d < 2 ? 0.1 : 1;
    return (Math.floor(d / step + 1e-9) + 1) * step / 2;
  }

  private finish() {
    this.mode = 'done'; this.stars = starsFor(this.spec, this.ball.r);
    const p = this.profile, id = this.spec.id;
    p.rolled += this.stuck.length;
    if (!(p.best[id] >= this.ball.r)) p.best[id] = this.ball.r;
    if (this.stars > (p.stars[id] ?? 0)) p.stars[id] = this.stars;
    if (this.goldens > (p.golden[id] ?? 0)) p.golden[id] = this.goldens;
    const next = LEVELS[LEVELS.findIndex((l) => l.id === id) + 1];
    if (this.reached && next && !p.unlocked.includes(next.id)) p.unlocked.push(next.id);
    this.profileChanged = true;
    this.events.push({ kind: 'end', reached: this.reached });
  }

  /** The best free thing to head for: big but stickable, and not too far. Used by the bot and the tests. */
  target(): Thing | null {
    const b = this.ball; let best: Thing | null = null, score = 0;
    // close by first; if nothing up close fits, anywhere in the fence
    for (const reach of [Math.max(1, b.r * 30), this.spec.half * 3]) {
      for (const t of this.near(b.x, b.z, reach)) {
        if (t.stuck || t.r > b.r * PICK || this.clock < t.calm) continue;
        const d = Math.max(b.r, Math.hypot(t.x - b.x, t.z - b.z) - b.r), s = t.r ** 3 / (d + b.r * 2);
        if (s > score) { score = s; best = t; }
      }
      if (best) return best;
    }
    return best;
  }
}

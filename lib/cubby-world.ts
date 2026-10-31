// Cubby Valley's world: the block table, the seeded valley generator, two-channel voxel light (sky and lantern), the
// ray that picks a block, the burrow check and the compact block-diff codec for saves. DOM-free and deterministic: the
// same seed always grows the same valley, and nothing here reads the clock or Math.random.

export const W = 96, D = 96, H = 48, CH = 16, N = W * D * H;
export const WATER_LEVEL = 13;
export const idx = (x: number, y: number, z: number) => (y * D + z) * W + x;
export const inside = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;

export type Shape = 'none' | 'cube' | 'cross' | 'prop' | 'liquid';
export interface BlockDef {
  id: number; key: string; name: string; shape: Shape;
  /** stops bodies; `height` is the top of the collision box (1 = a full block) */
  solid: boolean; height: number;
  /** hides the faces of cubes next to it */
  opaque: boolean;
  /** seconds to dig with a paw (0 = at once, -1 = can't be dug), and with the digging trowel */
  hard: number; fast: number;
  tiles?: [string, string, string];
  /** what digging it gives: [item, count]; a `leafy` block may also give a sapling */
  drops?: [string, number][];
  light?: number; fall?: boolean; climb?: boolean; facing?: boolean;
  /** counts as a wall when checking a burrow */
  wall: boolean;
  /** knocked over by dust-bunnies when it stands in the dark */
  knock?: boolean;
  /** light passing through loses this much extra */
  dim?: number;
  /** blocks light completely */
  dark: boolean;
}

const defs: BlockDef[] = [];
function def(key: string, name: string, shape: Shape, o: Partial<BlockDef> = {}) {
  const solid = o.solid ?? (shape === 'cube' || shape === 'prop');
  const opaque = o.opaque ?? shape === 'cube';
  const b: BlockDef = {
    id: defs.length, key, name, shape, solid, height: o.height ?? (solid ? 1 : 0), opaque, hard: o.hard ?? 0.2, fast: o.fast ?? o.hard ?? 0.2,
    wall: o.wall ?? (shape === 'cube' && solid), dark: o.dark ?? (opaque && !o.dim), ...o,
  } as BlockDef;
  b.solid = solid; b.opaque = opaque; if (o.wall === undefined) b.wall = shape === 'cube' && solid;
  defs.push(b); return b.id;
}
const t3 = (a: string, b = a, c = a): [string, string, string] => [a, b, c];
export const AIR = def('air', 'Air', 'none', { hard: -1 });
export const TURF = def('turf', 'Meadow turf', 'cube', { hard: 0, tiles: t3('grass', 'grass_side', 'soil'), drops: [['soil', 1]] });
export const SOIL = def('soil', 'Soft soil', 'cube', { hard: 0, tiles: t3('soil') });
export const STONE = def('stone', 'Fieldstone', 'cube', { hard: 1.1, fast: 0.32, tiles: t3('stone') });
export const CHALK = def('chalk', 'Chalk', 'cube', { hard: 0.55, fast: 0.18, tiles: t3('chalk') });
export const SAND = def('sand', 'Sand', 'cube', { hard: 0, tiles: t3('sand'), fall: true });
export const WATER = def('water', 'Water', 'liquid', { hard: -1, solid: false, opaque: false, dim: 2, dark: false });
export const LOG = def('log', 'Birch log', 'cube', { hard: 0.6, fast: 0.25, tiles: t3('birch_top', 'birch_side', 'birch_top') });
export const LEAVES = def('leaves', 'Birch leaves', 'cube', { hard: 0, tiles: t3('leaves'), drops: [['twig', 1]], dim: 1, dark: false });
export const PEBBLES = def('pebbles', 'River pebbles', 'cube', { hard: 0.2, tiles: t3('pebbles') });
export const CLAY = def('clay', 'Clay', 'cube', { hard: 0.2, tiles: t3('clay') });
export const IRONSTONE = def('ironstone', 'Ironstone', 'cube', { hard: 1.4, fast: 0.42, tiles: t3('ironstone'), drops: [['iron', 1]] });
export const CRYSTAL = def('crystal', 'Glow crystal', 'prop', { hard: 0.7, fast: 0.25, solid: false, light: 12 });
export const HAYBALE = def('haybale', 'Hay bale', 'cube', { hard: 0.1, tiles: t3('hay_top', 'hay_side', 'hay_top') });
export const PLANKS = def('planks', 'Birch planks', 'cube', { hard: 0.4, fast: 0.2, tiles: t3('planks') });
export const BRICK = def('brick', 'Clay bricks', 'cube', { hard: 0.9, fast: 0.3, tiles: t3('brick') });
export const GLASS = def('glass', 'Glass', 'cube', { hard: 0.2, opaque: false, dark: false, tiles: t3('glass') });
export const LANTERN = def('lantern', 'Lantern', 'prop', { hard: 0, solid: false, light: 14 });
export const DOOR = def('door', 'Round door', 'prop', { hard: 0.2, solid: false, wall: true, facing: true });
export const BED = def('bed', 'Snug bed', 'prop', { hard: 0.2, height: 0.45 });
export const BENCH_WORK = def('workbench', 'Burrow Workbench', 'prop', { hard: 0.3, height: 1, wall: false });
export const OVEN = def('oven', 'Brick oven', 'prop', { hard: 0.5, height: 1, facing: true });
export const CART = def('cart', 'Ore cart', 'prop', { hard: 0.3, height: 0.75, facing: true });
export const SHELF = def('bookshelf', 'Bookshelf', 'cube', { hard: 0.3, tiles: t3('planks', 'bookshelf', 'planks') });
export const DRUM = def('drum', 'Drum', 'prop', { hard: 0.2, height: 0.7 });
export const ANVIL = def('anvil', 'Anvil', 'prop', { hard: 0.6, height: 0.65, facing: true });
export const POT = def('pot', 'Flower pot', 'prop', { hard: 0, height: 0.45, knock: true });
export const FENCE = def('fence', 'Twig fence', 'prop', { hard: 0.2, height: 1 });
export const LADDER = def('ladder', 'Rope ladder', 'prop', { hard: 0.1, solid: false, climb: true, facing: true });
export const BENCH = def('bench', 'Garden bench', 'prop', { hard: 0.2, height: 0.5, knock: true, facing: true });
export const CHALK_TILE = def('chalk_tile', 'Chalk tile', 'cube', { hard: 0.4, fast: 0.15, tiles: t3('chalk_tile') });
export const ROSE_TILE = def('rose_tile', 'Rose tile', 'cube', { hard: 0.4, fast: 0.15, tiles: t3('rose_tile') });
export const SKY_TILE = def('sky_tile', 'Sky tile', 'cube', { hard: 0.4, fast: 0.15, tiles: t3('sky_tile') });
export const SUN_TILE = def('sun_tile', 'Sun tile', 'cube', { hard: 0.4, fast: 0.15, tiles: t3('sun_tile') });
export const PATH = def('path', 'Pebble path', 'cube', { hard: 0.2, tiles: t3('path', 'pebbles', 'pebbles') });
export const BUNTING = def('bunting', 'Bunting', 'prop', { hard: 0, solid: false, knock: true });
export const LAMP = def('lamp', 'Crystal lamp', 'prop', { hard: 0.1, height: 0.6, light: 15 });
export const CHIME = def('chime', 'Wind chime', 'prop', { hard: 0, solid: false, knock: true });
export const GRASS = def('tallgrass', 'Hay tuft', 'cross', { hard: 0, solid: false, drops: [['hay', 1]] });
export const DAISY = def('daisy', 'Daisy', 'cross', { hard: 0, solid: false });
export const BLUEBELL = def('bluebell', 'Bluebell', 'cross', { hard: 0, solid: false });
export const BUSH = def('berrybush', 'Red-berry bush', 'cube', { hard: 0, opaque: false, dark: false, dim: 1, tiles: t3('berrybush'), drops: [['berries', 2]] });
export const COTTON = def('cotton', 'Cotton puff', 'cross', { hard: 0, solid: false, drops: [['fluff', 2]] });
export const MUSHROOM = def('mushroom', 'Mushroom', 'cross', { hard: 0, solid: false });
export const SAPLING = def('sapling', 'Birch sapling', 'cross', { hard: 0, solid: false });
export const DEEP = def('deepstone', 'Deepstone', 'cube', { hard: -1, tiles: t3('deepstone') });
export const STUMP = def('stump', 'Notice stump', 'prop', { hard: -1, height: 1 });
export const CUSHION = def('cushion', 'Cushion', 'prop', { hard: 0, height: 0.3, knock: true });
export const BLOCKS: readonly BlockDef[] = defs;
export const BLOCK_BY_KEY: Record<string, number> = Object.fromEntries(defs.map((b) => [b.key, b.id]));
export const TILES = [
  'grass', 'grass_side', 'soil', 'stone', 'chalk', 'sand', 'water', 'birch_top', 'birch_side', 'leaves', 'pebbles', 'clay', 'ironstone',
  'hay_top', 'hay_side', 'planks', 'brick', 'glass', 'bookshelf', 'chalk_tile', 'rose_tile', 'sky_tile', 'sun_tile', 'path',
  'tallgrass', 'daisy', 'bluebell', 'berrybush', 'cotton', 'mushroom', 'sapling', 'deepstone', 'white',
] as const;
export type Tile = (typeof TILES)[number];
export const TILE_INDEX: Record<string, number> = Object.fromEntries(TILES.map((t, i) => [t, i]));
/** The tile a cross plant draws with. */
export const CROSS_TILE: Record<number, string> = { [GRASS]: 'tallgrass', [DAISY]: 'daisy', [BLUEBELL]: 'bluebell', [COTTON]: 'cotton', [MUSHROOM]: 'mushroom', [SAPLING]: 'sapling' };

// ---------------------------------------------------------------- seeded noise
export function hash3(seed: number, x: number, y: number, z: number) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 1103515245) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function vnoise(seed: number, x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = smooth(x - xi), fz = smooth(z - zi);
  const a = hash3(seed, xi, 0, zi), b = hash3(seed, xi + 1, 0, zi), c = hash3(seed, xi, 0, zi + 1), d = hash3(seed, xi + 1, 0, zi + 1);
  return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
}
export function fbm(seed: number, x: number, z: number, oct = 3) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += vnoise(seed + o * 97, x * f, z * f) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A small seeded generator (mulberry32). */
export class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next() { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n: number) { return Math.floor(this.next() * n); }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
}

// ---------------------------------------------------------------- the valley
export type Region = 'meadow' | 'wood' | 'cliff' | 'shore' | 'river' | 'lake' | 'rim';
export interface Spot { x: number; y: number; z: number }
export interface Valley {
  blocks: Uint8Array; seed: number;
  /** where Dora and Enzo start, the notice stump the visitors wait by, the cubby's bed (already Dora and Enzo's) */
  start: Spot; stump: Spot; homeBed: Spot; cave: Spot;
  /** recipe leaves, each teaching one recipe */
  leaves: (Spot & { recipe: string })[];
  region: Region[]; height: Int16Array;
}
export const LEAF_RECIPES = ['ladder', 'fence', 'bench', 'glass', 'chalk_tile', 'rose_tile', 'sky_tile', 'sun_tile', 'path', 'haybale', 'bunting', 'lamp'];

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export function generate(seed: number): Valley {
  const rng = new Rng(seed ^ 0x5eed);
  const j = (n: number) => Math.round(rng.range(-n, n));
  const start = { x: 58 + j(2), y: 16, z: 64 + j(2) };
  const lake = { x: 22 + j(3), z: 74 + j(3), r: 11 + rng.range(0, 2) };
  const river = [[68 + j(3), 0], [62 + j(3), 20], [50 + j(3), 34], [36 + j(2), 50], [lake.x + 4, lake.z - 6]] as const;
  const caveZ = start.z - 2 + j(4);
  const height = new Int16Array(W * D), region: Region[] = new Array(W * D);
  const bl = new Uint8Array(N);
  const set = (x: number, y: number, z: number, b: number) => { if (inside(x, y, z)) bl[idx(x, y, z)] = b; };
  const get = (x: number, y: number, z: number) => (inside(x, y, z) ? bl[idx(x, y, z)] : DEEP);
  const cliffness = new Float32Array(W * D), riverD = new Float32Array(W * D);

  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = z * W + x;
    let h = 15.5 + fbm(seed, x / 26, z / 26) * 3.2;
    const ds = Math.hypot(x - start.x, z - start.z);
    h = h + (16 - h) * (1 - smoothstep(7, 15, ds));
    const edge = Math.min(x, z, W - 1 - x, D - 1 - z);
    const rim = Math.max(0, 7 - edge) / 7;
    h += rim * rim * 9 + rim * fbm(seed + 5, x / 9, z / 9) * 2;
    const cl = smoothstep(71, 78, x + fbm(seed + 9, x / 14, z / 14) * 4) * (1 - smoothstep(86, 94, z) * 0.6);
    cliffness[c] = cl;
    if (cl > 0.02) h = h + Math.floor(cl * (14 + fbm(seed + 3, x / 18, z / 18) * 3) / 2) * 2;
    let rd = 99;
    for (let i = 0; i + 1 < river.length; i++) rd = Math.min(rd, distToSeg(x, z, river[i][0], river[i][1], river[i + 1][0], river[i + 1][1]));
    rd += fbm(seed + 11, x / 6, z / 6) * 0.8;
    riverD[c] = rd;
    const ld = Math.hypot(x - lake.x, z - lake.z) / (lake.r * (1 + 0.14 * fbm(seed + 13, x / 8, z / 8)));
    let reg: Region = x < 46 && z < 46 ? 'wood' : 'meadow';
    if (rim > 0.15) reg = 'rim';
    if (cl > 0.25) reg = 'cliff';
    if (ld < 1) { h = Math.min(h, 7 + ld * 6.5); reg = 'lake'; }
    else if (ld < 1.35) { h = Math.min(h, 13.5 + (ld - 1) * 6); reg = 'shore'; }
    if (rd < 2.6) { h = Math.min(h, 10.5 + rd * 0.7); reg = 'river'; }
    else if (rd < 4.5 && reg !== 'lake') { h = Math.min(h, 13.6 + (rd - 2.6) * 0.9); if (reg !== 'cliff') reg = 'shore'; }
    if (reg === 'meadow' || reg === 'wood') h = Math.max(h, 14);
    height[c] = Math.max(3, Math.min(H - 8, Math.floor(h))); region[c] = reg;
  }
  // a flat pad for the cubby
  for (let z = start.z - 9; z <= start.z + 6; z++) for (let x = start.x - 7; x <= start.x + 7; x++) { const c = z * W + x; height[c] = 16; region[c] = 'meadow'; }

  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = z * W + x, h = height[c], reg = region[c], cl = cliffness[c];
    for (let y = 0; y <= h; y++) {
      let b = STONE;
      if (y === 0) b = DEEP;
      else if (reg === 'cliff' && y >= 15) b = CHALK;
      else if (y >= h - 3) b = SOIL;
      if (y === h) {
        if (reg === 'lake') b = y < 10 ? CLAY : SAND;
        else if (reg === 'river') b = PEBBLES;
        else if (reg === 'shore') b = h <= WATER_LEVEL + 1 ? SAND : TURF;
        else if (reg === 'cliff') b = cl > 0.6 ? (h > 24 ? TURF : CHALK) : TURF;
        else b = TURF;
      } else if ((reg === 'lake' || reg === 'shore') && y >= h - 2 && y > 3) b = CLAY;
      else if (reg === 'river' && y >= h - 1) b = PEBBLES;
      if (b === STONE && hash3(seed + 21, x, y, z) < (y < 12 ? 0.035 : 0.015)) b = IRONSTONE;
      if (b === CHALK && hash3(seed + 22, x, y, z) < 0.018) b = IRONSTONE;
      set(x, y, z, b);
    }
    for (let y = h + 1; y <= WATER_LEVEL; y++) if (reg === 'lake' || reg === 'river' || reg === 'shore') set(x, y, z, WATER);
  }

  // the glow cave: a winding tunnel into the east cliff, down to a crystal chamber
  let cx = 70, cz = caveZ;
  while (cx < W - 10 && height[cz * W + cx] <= 17) cx++;
  cx = Math.max(70, cx - 2);
  const entryY = height[cz * W + cx] + 1;
  const chamber = { x: Math.min(W - 9, cx + 13), y: 11, z: Math.max(12, Math.min(D - 14, cz - 6 + j(2))) };
  const carve = (px: number, py: number, pz: number, rx: number, ry: number, rz: number) => {
    for (let z = Math.floor(pz - rz); z <= pz + rz; z++) for (let y = Math.floor(py - ry); y <= py + ry; y++) for (let x = Math.floor(px - rx); x <= px + rx; x++) {
      if (!inside(x, y, z) || y < 2 || x < 3 || z < 3 || x > W - 4 || z > D - 4) continue;
      const q = ((x + 0.5 - px) / rx) ** 2 + ((y + 0.5 - py) / ry) ** 2 + ((z + 0.5 - pz) / rz) ** 2;
      if (q <= 1) { const b = get(x, y, z); if (b !== DEEP && b !== WATER) set(x, y, z, AIR); }
    }
  };
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = cx - 2 + (chamber.x - cx + 2) * t, pz = cz + (chamber.z - cz) * t + Math.sin(t * Math.PI * 2) * 2;
    const py = entryY + 0.6 + (chamber.y - 1 - entryY) * smoothstep(0.1, 0.9, t);
    carve(px, py, pz, 1.7, 1.25, 1.7);
  }
  carve(chamber.x, chamber.y, chamber.z, 6, 3.6, 6);
  // crystals and iron round the chamber walls; mushrooms on its floor
  for (let z = chamber.z - 8; z <= chamber.z + 8; z++) for (let y = chamber.y - 5; y <= chamber.y + 5; y++) for (let x = chamber.x - 8; x <= chamber.x + 8; x++) {
    if (!inside(x, y, z)) continue;
    const b = get(x, y, z);
    const nearAir = get(x + 1, y, z) === AIR || get(x - 1, y, z) === AIR || get(x, y + 1, z) === AIR || get(x, y - 1, z) === AIR || get(x, y, z + 1) === AIR || get(x, y, z - 1) === AIR;
    if ((b === STONE || b === CHALK) && nearAir && hash3(seed + 31, x, y, z) < 0.22) set(x, y, z, IRONSTONE);
    if (b === AIR && BLOCKS[get(x, y - 1, z)].shape === 'cube' && hash3(seed + 32, x, y, z) < 0.13) set(x, y, z, hash3(seed + 33, x, y, z) < 0.75 ? CRYSTAL : MUSHROOM);
  }
  // a few crystals along the tunnel light the way down
  for (let i = 4; i < steps; i += 7) {
    const t = i / steps, px = Math.round(cx - 2 + (chamber.x - cx + 2) * t), pz = Math.round(cz + (chamber.z - cz) * t + Math.sin(t * Math.PI * 2) * 2);
    for (let y = H - 2; y > 1; y--) if (get(px, y, pz) === AIR && get(px, y - 1, pz) !== AIR && BLOCKS[get(px, y - 1, pz)].shape === 'cube' && y < entryY + 3) { set(px, y, pz, CRYSTAL); break; }
  }

  // birch trees, thick in the wood and dotted over the meadow
  const tree = (x: number, y: number, z: number, hgt: number) => {
    for (let k = 0; k < hgt; k++) set(x, y + k, z, LOG);
    const top = y + hgt;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy >= 1 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash3(seed + 41, x + dx, top + dy, z + dz) < 0.7) continue;
        if (get(x + dx, top + dy, z + dz) === AIR) set(x + dx, top + dy, z + dz, LEAVES);
      }
    }
    set(x, top + 1, z, LEAVES);
  };
  const clear = (x: number, z: number, r: number) => Math.hypot(x - start.x, z - (start.z - 2)) > r;
  for (let gz = 2; gz < D - 2; gz += 5) for (let gx = 2; gx < W - 2; gx += 5) {
    const x = gx + Math.floor(hash3(seed + 51, gx, 0, gz) * 4), z = gz + Math.floor(hash3(seed + 52, gx, 0, gz) * 4);
    if (x < 3 || z < 3 || x > W - 4 || z > D - 4) continue;
    const c = z * W + x, reg = region[c], p = hash3(seed + 53, gx, 1, gz);
    const want = reg === 'wood' ? 0.85 : reg === 'meadow' ? 0.09 : reg === 'rim' ? 0.35 : 0;
    if (p >= want || !clear(x, z, 12) || riverD[c] < 5) continue;
    const y = height[c] + 1;
    if (get(x, y - 1, z) !== TURF || y > H - 10) continue;
    tree(x, y, z, 4 + Math.floor(hash3(seed + 54, x, 0, z) * 3));
  }

  // ground plants
  for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
    const c = z * W + x, y = height[c] + 1, reg = region[c];
    if (get(x, y - 1, z) !== TURF || get(x, y, z) !== AIR) continue;
    const p = hash3(seed + 61, x, 0, z), q = hash3(seed + 62, x, 1, z);
    const nearLake = Math.hypot(x - lake.x, z - lake.z) < lake.r * 1.35 + 6;
    if (!clear(x, z, 6)) continue;
    if (reg === 'meadow') {
      if (p < 0.13) set(x, y, z, GRASS);
      else if (p < 0.165) set(x, y, z, DAISY);
      else if (p < 0.175) set(x, y, z, BLUEBELL);
      else if (p < 0.186 && q < 0.8) set(x, y, z, BUSH);
      else if (nearLake && p < 0.26) set(x, y, z, COTTON);
    } else if (reg === 'wood') {
      if (p < 0.05) set(x, y, z, GRASS);
      else if (p < 0.1) set(x, y, z, BLUEBELL);
      else if (p < 0.13) set(x, y, z, MUSHROOM);
      else if (p < 0.137) set(x, y, z, BUSH);
    } else if (reg === 'shore') {
      if (p < 0.12) set(x, y, z, COTTON);
      else if (p < 0.2) set(x, y, z, GRASS);
    } else if (reg === 'rim' || reg === 'cliff') {
      if (p < 0.06) set(x, y, z, GRASS);
      else if (p < 0.08) set(x, y, z, DAISY);
    }
  }

  // Dora and Enzo's cubby: a little plank burrow with a round door, a window, a bed, a lantern and the workbench
  const hx = start.x - 2, hz = start.z - 8, hy = 17;
  for (let z = hz; z <= hz + 4; z++) for (let x = hx; x <= hx + 4; x++) for (let y = hy; y <= hy + 3; y++) {
    const edgeX = x === hx || x === hx + 4, edgeZ = z === hz || z === hz + 4;
    set(x, y, z, y === hy + 3 ? PLANKS : edgeX || edgeZ ? (y === hy + 1 && (x === hx + 2 || z === hz + 2) && !(x === hx + 2 && z === hz + 4) ? GLASS : edgeX && edgeZ ? LOG : PLANKS) : AIR);
  }
  for (let z = hz - 1; z <= hz + 5; z++) for (let x = hx - 1; x <= hx + 5; x++) if (x < hx || x > hx + 4 || z < hz || z > hz + 4) set(x, hy + 3, z, PLANKS);
  for (let z = hz + 1; z <= hz + 3; z++) for (let x = hx + 1; x <= hx + 3; x++) set(x, hy + 4, z, PLANKS);
  set(hx + 2, hy + 5, hz + 2, PLANKS);
  set(hx + 2, hy, hz + 4, DOOR); set(hx + 2, hy + 1, hz + 4, PLANKS);
  bl[idx(hx + 2, hy, hz + 4)] = DOOR | (0 << 6);
  set(hx + 1, hy, hz + 1, BED); set(hx + 3, hy, hz + 1, BENCH_WORK); set(hx + 3, hy, hz + 3, LANTERN);
  // the notice stump where visitors wait, and berry bushes near home so the first errand is close
  const stump = { x: start.x + 3, y: 17, z: start.z - 1 };
  set(stump.x, stump.y, stump.z, STUMP);
  for (const [dx, dz] of [[-6, 3], [-5, 5], [6, 4], [7, 2], [-7, -3]]) { const x = start.x + dx, z = start.z + dz; if (get(x, 17, z) === AIR) set(x, 17, z, BUSH); }
  // a short path from the door
  for (let k = 0; k < 3; k++) set(hx + 2, 16, hz + 5 + k, PATH);

  // recipe leaves, one in each corner of the valley
  const leaves: Valley['leaves'] = [];
  const lrng = new Rng(seed ^ 0x1eaf);
  const surface = (x: number, z: number) => { for (let y = H - 2; y > 0; y--) { const b = get(x, y, z); if (b !== AIR && BLOCKS[b].shape === 'cube') return y + 1; if (b === WATER) return -1; } return -1; };
  const free = (x: number, y: number, z: number) => get(x, y, z) === AIR || BLOCKS[get(x, y, z)].shape === 'cross';
  const pick = (test: (x: number, z: number) => boolean, tries = 4000): Spot | null => {
    for (let i = 0; i < tries; i++) {
      const x = 3 + lrng.int(W - 6), z = 3 + lrng.int(D - 6);
      if (!test(x, z)) continue;
      const y = surface(x, z); if (y < 0 || y > H - 3 || !free(x, y, z) || !free(x, y + 1, z)) continue;
      if (leaves.some((l) => Math.hypot(l.x - x, l.z - z) < 10)) continue;
      return { x, y, z };
    }
    return null;
  };
  const where: ((x: number, z: number) => boolean)[] = [
    (x, z) => Math.hypot(x - start.x, z - start.z) < 9 && Math.hypot(x - start.x, z - start.z) > 4,
    (x, z) => region[z * W + x] === 'meadow' && Math.hypot(x - start.x, z - start.z) < 22,
    (x, z) => region[z * W + x] === 'wood',
    (x, z) => region[z * W + x] === 'shore',
    (x, z) => region[z * W + x] === 'wood' && z < 30,
    (x, z) => region[z * W + x] === 'cliff' && height[z * W + x] > 24,
    (x, z) => region[z * W + x] === 'meadow' && z > 70,
    (x, z) => region[z * W + x] === 'rim' && height[z * W + x] > 20,
    (x, z) => region[z * W + x] === 'meadow' && x > 50 && z < 40,
    (x, z) => region[z * W + x] === 'cliff' && height[z * W + x] > 22,
    (x, z) => region[z * W + x] === 'shore' || region[z * W + x] === 'river',
  ];
  for (let i = 0; i < where.length; i++) {
    const s = pick(where[i]) ?? pick((x, z) => region[z * W + x] === 'meadow');
    if (s) leaves.push({ ...s, recipe: LEAF_RECIPES[i] });
  }
  // the last leaf waits in the glow cave
  for (let r = 0; r < 6 && leaves.length < LEAF_RECIPES.length; r++) for (let dz = -r; dz <= r && leaves.length < LEAF_RECIPES.length; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = chamber.x + dx, z = chamber.z + dz;
    let y = chamber.y; while (y > 2 && get(x, y - 1, z) === AIR) y--;
    if (get(x, y, z) === AIR && get(x, y + 1, z) === AIR && BLOCKS[get(x, y - 1, z)].shape === 'cube') { leaves.push({ x, y, z, recipe: LEAF_RECIPES[LEAF_RECIPES.length - 1] }); break; }
  }
  return { blocks: bl, seed, start, stump, homeBed: { x: hx + 1, y: hy, z: hz + 1 }, cave: { x: cx - 2, y: entryY, z: cz }, leaves, region, height };
}

// ---------------------------------------------------------------- the live world
export interface Hit { x: number; y: number; z: number; b: number; nx: number; ny: number; nz: number; dist: number }

export class World {
  blocks: Uint8Array; base: Uint8Array; light: Uint8Array;
  /** chunks whose mesh needs rebuilding */
  dirty = new Set<number>();
  /** cells changed from the generated valley (index → packed block) */
  diff = new Map<number, number>();
  constructor(v: Valley) {
    this.base = v.blocks; this.blocks = v.blocks.slice(); this.light = new Uint8Array(N);
    this.relight(0, W - 1, 0, D - 1);
  }
  get(x: number, y: number, z: number) { return inside(x, y, z) ? this.blocks[idx(x, y, z)] & 63 : y < 0 ? DEEP : AIR; }
  facing(x: number, y: number, z: number) { return inside(x, y, z) ? this.blocks[idx(x, y, z)] >> 6 : 0; }
  def(x: number, y: number, z: number) { return BLOCKS[this.get(x, y, z)]; }
  sky(x: number, y: number, z: number) { return inside(x, y, z) ? this.light[idx(x, y, z)] >> 4 : y >= H ? 15 : 0; }
  lamp(x: number, y: number, z: number) { return inside(x, y, z) ? this.light[idx(x, y, z)] & 15 : 0; }
  static chunkKey(cx: number, cy: number, cz: number) { return (cy * 8 + cz) * 8 + cx; }
  markDirty(x: number, y: number, z: number) {
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, Z = z + dz; if (!inside(X, Y, Z)) continue;
      this.dirty.add(World.chunkKey(X >> 4, Y >> 4, Z >> 4));
    }
  }
  /** Sets a block (with a facing 0–3), keeping the diff, the light and the dirty chunks up to date. */
  set(x: number, y: number, z: number, b: number, face = 0, relight = true) {
    if (!inside(x, y, z)) return false;
    const i = idx(x, y, z), v = (b & 63) | ((face & 3) << 6);
    const old = this.blocks[i]; if (old === v) return false;
    this.blocks[i] = v;
    if (this.base[i] === v) this.diff.delete(i); else this.diff.set(i, v);
    this.markDirty(x, y, z);
    if (relight) this.relight(x - 15, x + 15, z - 15, z + 15);
    return true;
  }
  /** The light of a box (whole height), recomputed from the sky, the lanterns and the light flowing in at its sides. */
  relight(x0: number, x1: number, z0: number, z1: number) {
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(W - 1, x1); z1 = Math.min(D - 1, z1);
    const bw = x1 - x0 + 1, bd = z1 - z0 + 1, n = bw * bd * H, L = this.light, B = this.blocks;
    const old = new Uint8Array(n), sky = new Uint8Array(n), lamp = new Uint8Array(n);
    const bi = (x: number, y: number, z: number) => (y * bd + (z - z0)) * bw + (x - x0);
    for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) old[bi(x, y, z)] = L[idx(x, y, z)];
    const q: number[] = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      let s = 15;
      for (let y = H - 1; y >= 0; y--) {
        const d = BLOCKS[B[idx(x, y, z)] & 63];
        if (d.dark) s = 0; else if (d.dim) s = Math.max(0, s - d.dim);
        const k = bi(x, y, z); sky[k] = s; lamp[k] = d.light ?? 0;
      }
    }
    // light flowing in from just outside the box
    const edge = (x: number, y: number, z: number, ox: number, oz: number) => {
      if (!inside(ox, y, oz)) return;
      const d = BLOCKS[B[idx(x, y, z)] & 63]; if (d.dark) return;
      const o = L[idx(ox, y, oz)], k = bi(x, y, z), loss = 1 + (d.dim ?? 0);
      const s = (o >> 4) - loss, l = (o & 15) - loss;
      if (s > sky[k]) sky[k] = s; if (l > lamp[k]) lamp[k] = l;
    };
    for (let y = 0; y < H; y++) {
      for (let z = z0; z <= z1; z++) { edge(x0, y, z, x0 - 1, z); edge(x1, y, z, x1 + 1, z); }
      for (let x = x0; x <= x1; x++) { edge(x, y, z0, x, z0 - 1); edge(x, y, z1, x, z1 + 1); }
    }
    for (const ch of [sky, lamp]) {
      q.length = 0;
      for (let k = 0; k < n; k++) if (ch[k] > 1) q.push(k);
      for (let h = 0; h < q.length; h++) {
        const k = q[h], lv = ch[k];
        const x = (k % bw) + x0, z = (Math.floor(k / bw) % bd) + z0, y = Math.floor(k / (bw * bd));
        const go = (X: number, Y: number, Z: number) => {
          if (X < x0 || X > x1 || Z < z0 || Z > z1 || Y < 0 || Y >= H) return;
          const d = BLOCKS[B[idx(X, Y, Z)] & 63]; if (d.dark) return;
          const kk = bi(X, Y, Z), v = lv - 1 - (d.dim ?? 0);
          if (v > ch[kk]) { ch[kk] = v; if (v > 1) q.push(kk); }
        };
        go(x + 1, y, z); go(x - 1, y, z); go(x, y + 1, z); go(x, y - 1, z); go(x, y, z + 1); go(x, y, z - 1);
      }
    }
    for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const k = bi(x, y, z), v = (sky[k] << 4) | lamp[k];
      if (v !== old[k]) { L[idx(x, y, z)] = v; this.markDirty(x, y, z); }
    }
  }
  /** The first block the ray from (ox,oy,oz) along (dx,dy,dz) hits within `reach`, ignoring air and water. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, reach: number): Hit | null {
    const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let ty = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tz = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 64 && t <= reach; i++) {
      const b = this.get(x, y, z), d = BLOCKS[b];
      if (b !== AIR && d.shape !== 'liquid' && inside(x, y, z)) return { x, y, z, b, nx, ny, nz, dist: t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
}

// ---------------------------------------------------------------- burrows
export interface BurrowReport {
  /** shut in on every side (the air inside can't reach the open valley) */
  enclosed: boolean; size: number; door: boolean; light: boolean; bed: boolean;
  /** furniture inside, by block key */
  has: string[];
  /** the cells inside (when enclosed) */
  cells: number[];
  bedAt: Spot | null; doorAt: Spot | null;
  reason: string;
}
export const BURROW_MAX = 240, BURROW_MIN = 4;
/** Checks the space around (x,y,z): fills outward through everything that isn't a wall, up to BURROW_MAX cells. */
export function checkBurrow(w: World, x: number, y: number, z: number): BurrowReport {
  const r: BurrowReport = { enclosed: false, size: 0, door: false, light: false, bed: false, has: [], cells: [], bedAt: null, doorAt: null, reason: '' };
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (!inside(x, y, z) || BLOCKS[w.get(x, y, z)].wall) { r.reason = 'Stand inside the burrow to check it.'; return r; }
  const seen = new Set<number>([idx(x, y, z)]), q = [[x, y, z]];
  let open = false;
  for (let h = 0; h < q.length; h++) {
    const [cx, cy, cz] = q[h];
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const X = cx + dx, Y = cy + dy, Z = cz + dz;
      if (!inside(X, Y, Z) || Y >= H - 1) { open = true; continue; }
      const d = BLOCKS[w.get(X, Y, Z)];
      if (d.wall) { if (d.id === DOOR && !r.doorAt) { r.door = true; r.doorAt = { x: X, y: Y, z: Z }; } continue; }
      if (d.shape === 'liquid') { open = true; continue; }
      const i = idx(X, Y, Z); if (seen.has(i)) continue;
      seen.add(i); q.push([X, Y, Z]);
      if (seen.size > BURROW_MAX) { open = true; break; }
    }
    if (open) break;
  }
  if (open) { r.reason = 'It isn’t shut in yet: there is a gap to the outside, or it is too big.'; return r; }
  r.enclosed = true; r.size = seen.size; r.cells = [...seen];
  const has = new Set<string>();
  for (const i of seen) {
    const b = w.blocks[i] & 63, d = BLOCKS[b];
    if (b !== AIR) has.add(d.key);
    if ((d.light ?? 0) > 0) r.light = true;
    if (b === BED && !r.bedAt) { const X = i % W, Z = Math.floor(i / W) % D, Y = Math.floor(i / (W * D)); r.bedAt = { x: X, y: Y, z: Z }; r.bed = true; }
  }
  r.has = [...has].sort();
  if (r.size < BURROW_MIN) r.reason = 'It’s a bit small: a burrow needs at least four spaces inside.';
  else if (!r.door) r.reason = 'It needs a round door in one of its walls.';
  else if (!r.light) r.reason = 'It’s dark inside: hang a lantern.';
  else if (!r.bed) r.reason = 'A neighbour needs a bed to sleep in.';
  return r;
}

// ---------------------------------------------------------------- the save codec
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toB64(b: Uint8Array) {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}
export function fromB64(s: string): Uint8Array | null {
  if (typeof s !== 'string' || s.length % 4) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (s[i + k] === '=' ? 0 : B64.indexOf(s[i + k])));
    if (v.some((x) => x < 0)) return null;
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out.push((n >> 16) & 255); if (s[i + 2] !== '=') out.push((n >> 8) & 255); if (s[i + 3] !== '=') out.push(n & 255);
  }
  return Uint8Array.from(out);
}
/** Packs the changed cells: runs of [gap since the last run (varint), run length (varint), the run's block] — a wall or a floor of one block packs into a few bytes. */
export function encodeDiff(diff: Map<number, number>) {
  const keys = [...diff.keys()].sort((a, b) => a - b), out: number[] = [];
  const vi = (n: number) => { while (n >= 128) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); };
  let last = -1;
  for (let i = 0; i < keys.length; ) {
    let j = i + 1; const v = diff.get(keys[i])!;
    while (j < keys.length && keys[j] === keys[j - 1] + 1 && diff.get(keys[j]) === v) j++;
    vi(keys[i] - last - 1); vi(j - i); out.push(v); last = keys[j - 1]; i = j;
  }
  return toB64(Uint8Array.from(out));
}
export function decodeDiff(s: string): Map<number, number> | null {
  const b = fromB64(s); if (!b) return null;
  const m = new Map<number, number>(); let p = 0, last = -1;
  const vi = () => { let n = 0, mul = 1; for (let k = 0; k < 5; k++) { if (p >= b.length) return -1; const c = b[p++]; n += (c & 127) * mul; if (!(c & 128)) return n; mul *= 128; } return -1; };
  while (p < b.length) {
    const gap = vi(), run = vi(); if (gap < 0 || run < 1 || p >= b.length) return null;
    const v = b[p++]; if ((v & 63) >= BLOCKS.length) return null;
    const start = last + 1 + gap; if (start + run > N) return null;
    for (let k = 0; k < run; k++) m.set(start + k, v);
    last = start + run - 1;
  }
  return m;
}

// Ropeclimb's tower: six sections of a giant barn, each two floors of 750 units, from the cellar floor to the
// weathervane on the roof ridge. Units are world units, x across the tower (0 to 480) and y UP from the cellar floor,
// so a ledge's y is the height of its top. Dora and Enzo are about 16 units tall and 18 wide. Pure data and a builder;
// the rules live in ropeclimb-game.ts.

/** The tower's inside width; its side walls are solid and smooth (nothing to grip). */
export const TOWER_W = 480;
/** Each floor is this tall; a section is two floors. */
export const FLOOR_H = 750;
/** Beams are drawn this thick under their tops. Floors are thicker. */
export const BEAM_T = 10, FLOOR_T = 16;
/** The roof ridge's top, where the weathervane stands; reaching it with both climbers wins. */
export const TOP_Y = 9000;

export type SectionId = 'cellar' | 'stables' | 'hayloft' | 'rafters' | 'belfry' | 'rooftop';
export const SECTION_IDS: SectionId[] = ['cellar', 'stables', 'hayloft', 'rafters', 'belfry', 'rooftop'];
export const SECTIONS: Record<SectionId, { name: string; blurb: string; y0: number; y1: number; hazard: string }> = {
  cellar: { name: 'The Cellar', blurb: 'Cool stone and old jars. Learn to leap, to grip, and to trust the rope.', y0: 0, y1: 1500, hazard: 'Crumbling straw' },
  stables: { name: 'The Stables', blurb: 'Warm straw, tack on the walls, and hay bales sliding along the beams.', y0: 1500, y1: 3000, hazard: 'Sliding hay bales' },
  hayloft: { name: 'The Hayloft', blurb: 'Golden hay piled high, and gusts whistling in through the knotholes.', y0: 3000, y1: 4500, hazard: 'Knothole gusts' },
  rafters: { name: 'The Rafters', blurb: 'Swinging lanterns, criss-cross beams and a sleepy barn owl.', y0: 4500, y1: 6000, hazard: 'Swinging lanterns' },
  belfry: { name: 'The Bell Loft', blurb: 'A great bronze bell and two dozing owls. Tiptoe!', y0: 6000, y1: 7500, hazard: 'Sleepy owls' },
  rooftop: { name: 'The Rooftop', blurb: 'Out on the shingles at sunset, with the weathervane above.', y0: 7500, y1: TOP_Y, hazard: 'Wind and loose shingles' },
};
export const sectionAt = (y: number): SectionId => SECTION_IDS[Math.max(0, Math.min(5, Math.floor(y / (FLOOR_H * 2))))];

// ---------------------------------------------------------------- what a level is made of
export type SolidKind = 'beam' | 'straw' | 'block' | 'hay' | 'floor' | 'net' | 'bell' | 'ridge' | 'chimney';
/** A static rectangle: `y` is its bottom, `y + h` its top. One-way solids are landed on from above and jumped through from below. */
export type Solid = { id: number; kind: SolidKind; x: number; y: number; w: number; h: number; oneWay: boolean; grip: boolean };
/** A grippable vertical post, `x` its middle. Not solid: you pass in front of it, and grip it with your claws. */
export type Post = { id: number; x: number; y0: number; y1: number };
/** A hay bale sliding to and fro along a beam: its left edge eases between x0 and x1 over `period` ticks. */
export type Bale = { id: number; x0: number; x1: number; y: number; w: number; h: number; period: number; phase: number };
/** A knothole gust across the whole tower between y0 and y1: blows for `on` ticks out of every on + off. */
export type Gust = { id: number; y0: number; y1: number; dir: 1 | -1; on: number; off: number; phase: number };
/** A lantern swinging on a chain from (x, y): angle = amp × sin(2π (tick + phase) / period). */
export type Lantern = { id: number; x: number; y: number; len: number; amp: number; period: number; phase: number };
/** A sleepy barn owl on her perch at (x, y). */
export type Owl = { id: number; x: number; y: number };
/** A dust-bath tub on a floor: the checkpoints. Tub 0 is the start. */
export type Tub = { id: number; x: number; y: number };
export type Acorn = { id: number; x: number; y: number };
export type World = { solids: Solid[]; posts: Post[]; bales: Bale[]; gusts: Gust[]; lanterns: Lantern[]; owls: Owl[]; tubs: Tub[]; acorns: Acorn[]; bell: Solid | null };

// ---------------------------------------------------------------- the floors, ledge by ledge
type Def =
  | ['B', number, number, number] // beam x0 x1 top
  | ['S', number, number, number] // crumbling straw x0 x1 top
  | ['K', number, number, number, number] // solid block x0 x1 bottom top (wood or stone: no grip)
  | ['H', number, number, number, number] // hay stack x0 x1 bottom top (grip its sides)
  | ['C', number, number, number, number] // chimney x0 x1 bottom top
  | ['P', number, number, number] // post x bottom top
  | ['BA', number, number, number, number, number] // sliding bale x0 x1 (left edge) bottom width period
  | ['G', number, number, 1 | -1, number, number, number] // gust bottom top dir on off phase
  | ['L', number, number, number, number, number, number] // lantern pivot x y, chain length, swing (radians), period, phase
  | ['O', number, number] // owl
  | ['BELL', number, number, number, number] // the bell: x0 x1 bottom top
  | ['T', number] // a tub on this floor at x
  | ['A', number, number]; // an acorn charm

/** One floor: its hatch above (where you climb through the next floor), and what's in it, in absolute heights. */
type FloorDef = { hatch: [number, number]; defs: Def[] };

const FLOORS: FloorDef[] = [
  // ---- 0 · Cellar, lower: hops, a post to grip, and a big leap
  { hatch: [330, 420], defs: [
    ['T', 70],
    ['B', 170, 280, 80], ['B', 320, 450, 150], ['B', 150, 250, 230], ['P', 300, 250, 340], ['B', 330, 460, 350],
    ['B', 180, 290, 430], ['B', 400, 470, 470], ['A', 440, 486], ['B', 40, 150, 500], ['B', 170, 260, 580], ['B', 20, 90, 650], ['A', 52, 666],
    ['B', 300, 420, 660], ['K', 0, 60, 300, 330],
  ] },
  // ---- 1 · Cellar, upper: crumbling straw
  { hatch: [60, 150], defs: [
    ['T', 140],
    ['S', 200, 300, 830], ['B', 340, 460, 900], ['P', 300, 920, 1010], ['B', 150, 260, 990], ['B', 400, 470, 1000], ['A', 438, 1016],
    ['S', 30, 130, 1060], ['B', 170, 270, 1140], ['H', 330, 480, 1150, 1200], ['A', 452, 1216], ['B', 40, 150, 1230],
    ['S', 190, 290, 1310], ['B', 60, 170, 1400],
  ] },
  // ---- 2 · Stables, lower: sliding bales
  { hatch: [210, 300], defs: [
    ['T', 380],
    ['B', 380, 470, 1590], ['BA', 150, 300, 1540, 70, 260], ['K', 170, 200, 1600, 1700], ['A', 185, 1716],
    ['B', 220, 330, 1680], ['BA', 30, 150, 1740, 70, 230], ['B', 20, 110, 1830], ['A', 60, 1846], ['B', 250, 360, 1850],
    ['P', 400, 1870, 1960], ['B', 380, 470, 1960], ['BA', 130, 300, 2030, 80, 280], ['B', 30, 140, 2120], ['A', 80, 2136],
    ['B', 180, 280, 2170],
  ] },
  // ---- 3 · Stables, upper: a traverse on posts over the gap
  { hatch: [380, 470], defs: [
    ['T', 70],
    ['B', 150, 260, 2330], ['B', 20, 110, 2400], ['P', 200, 2440, 2530], ['P', 320, 2460, 2550], ['H', 440, 480, 2400, 2440], ['A', 460, 2456],
    ['B', 390, 470, 2560], ['BA', 140, 300, 2620, 80, 250], ['B', 20, 120, 2700], ['B', 160, 250, 2790], ['B', 20, 90, 2880], ['A', 50, 2896],
    ['S', 290, 370, 2860], ['P', 378, 2800, 2985], ['B', 390, 470, 2920],
  ] },
  // ---- 4 · Hayloft, lower: knothole gusts and hay stacks
  { hatch: [60, 150], defs: [
    ['T', 230],
    ['H', 0, 90, 3000, 3080], ['B', 130, 230, 3150], ['G', 3170, 3260, -1, 100, 160, 0], ['B', 140, 220, 3240],
    ['H', 250, 320, 3260, 3360], ['A', 285, 3376], ['B', 380, 470, 3400], ['G', 3420, 3520, 1, 90, 170, 60], ['B', 200, 300, 3480],
    ['B', 400, 470, 3560], ['A', 440, 3576], ['S', 40, 140, 3540], ['B', 170, 270, 3620], ['B', 40, 150, 3680], ['A', 20, 3696],
  ] },
  // ---- 5 · Hayloft, upper: more gusts, a post, a hay pile at the wall
  { hatch: [330, 420], defs: [
    ['T', 380],
    ['B', 200, 300, 3830], ['S', 40, 150, 3900], ['P', 220, 3900, 3990], ['G', 3920, 4010, 1, 100, 140, 30], ['H', 260, 330, 3930, 4010],
    ['B', 380, 470, 4060], ['A', 450, 4076], ['P', 330, 4090, 4180], ['B', 140, 250, 4120], ['G', 4150, 4240, -1, 90, 150, 90],
    ['S', 280, 370, 4200], ['H', 0, 80, 4220, 4280], ['A', 40, 4296], ['B', 120, 230, 4290], ['B', 280, 390, 4380], ['B', 350, 440, 4430], ['B', 440, 480, 4360], ['A', 460, 4376],
  ] },
  // ---- 6 · Rafters, lower: swinging lanterns
  { hatch: [380, 470], defs: [
    ['T', 110],
    ['B', 170, 300, 4580], ['L', 360, 4720, 80, 0.8, 160, 0], ['B', 330, 460, 4660], ['B', 60, 170, 4670], ['B', 420, 470, 4760], ['A', 445, 4776],
    ['P', 250, 4690, 4770], ['B', 160, 300, 4770], ['L', 110, 4930, 70, 0.75, 140, 40], ['B', 20, 130, 4860], ['B', 330, 470, 4870], ['A', 452, 4886],
    ['B', 170, 290, 4960], ['L', 380, 5110, 80, 0.7, 170, 80], ['B', 330, 450, 5050], ['B', 150, 260, 5130], ['B', 300, 400, 5180],
  ] },
  // ---- 7 · Rafters, upper: the first owl
  { hatch: [60, 150], defs: [
    ['T', 120],
    ['B', 190, 300, 5330], ['B', 350, 460, 5400], ['L', 250, 5520, 70, 0.8, 150, 20], ['B', 160, 280, 5480], ['B', 360, 470, 5560], ['O', 430, 5560],
    ['P', 320, 5500, 5590], ['B', 40, 150, 5560], ['B', 180, 290, 5640], ['B', 440, 480, 5640], ['A', 462, 5656], ['B', 20, 80, 5700], ['A', 46, 5716],
    ['B', 330, 440, 5720], ['S', 170, 280, 5800], ['L', 110, 5940, 70, 0.7, 140, 60], ['B', 30, 140, 5870], ['A', 36, 5886], ['B', 170, 270, 5930],
  ] },
  // ---- 8 · Bell loft, lower: the bell, and an owl beside it
  { hatch: [200, 290], defs: [
    ['T', 380],
    ['B', 200, 300, 6080], ['B', 40, 150, 6150], ['P', 170, 6170, 6260], ['B', 330, 460, 6170], ['B', 180, 290, 6250], ['B', 350, 470, 6330],
    ['BELL', 190, 290, 6400, 6500], ['A', 240, 6516], ['B', 330, 440, 6420], ['B', 380, 470, 6510], ['B', 20, 130, 6560], ['O', 70, 6560], ['A', 122, 6576],
    ['B', 300, 400, 6600], ['B', 160, 260, 6660],
  ] },
  // ---- 9 · Bell loft, upper: louvre gusts, crumbling straw, the second owl
  { hatch: [330, 420], defs: [
    ['T', 70],
    ['B', 320, 430, 6830], ['S', 170, 270, 6900], ['G', 6920, 7010, 1, 100, 150, 0], ['B', 20, 130, 6960], ['B', 160, 260, 7040], ['P', 300, 7060, 7150],
    ['B', 350, 470, 7120], ['O', 400, 7120], ['A', 456, 7136], ['B', 30, 140, 7120], ['G', 7140, 7230, -1, 90, 160, 70], ['S', 180, 280, 7200],
    ['B', 20, 90, 7300], ['A', 55, 7316], ['B', 320, 420, 7280], ['B', 160, 260, 7360], ['B', 300, 400, 7430],
  ] },
  // ---- 10 · Rooftop, lower: shingles, a chimney and strong wind
  { hatch: [60, 150], defs: [
    ['T', 120],
    ['B', 200, 320, 7580], ['S', 360, 470, 7650], ['A', 455, 7666], ['G', 7660, 7760, -1, 120, 140, 0], ['B', 200, 310, 7720], ['C', 30, 110, 7500, 7820],
    ['P', 150, 7760, 7850], ['A', 70, 7836], ['B', 180, 290, 7900], ['S', 330, 450, 7970], ['A', 440, 7986], ['G', 7990, 8090, 1, 100, 150, 50],
    ['B', 170, 290, 8050], ['B', 30, 130, 8120], ['B', 160, 260, 8170],
  ] },
  // ---- 11 · Rooftop, upper: up to the ridge and the weathervane
  { hatch: [0, 0], defs: [
    ['T', 380],
    ['B', 200, 310, 8330], ['B', 40, 150, 8400], ['A', 60, 8416], ['G', 8420, 8510, 1, 110, 130, 0], ['S', 190, 300, 8470], ['B', 340, 460, 8540], ['A', 450, 8556],
    ['L', 240, 8700, 70, 0.75, 150, 30], ['B', 180, 300, 8620], ['S', 30, 140, 8690], ['A', 50, 8706], ['B', 170, 280, 8770], ['G', 8780, 8870, -1, 120, 120, 60],
    ['B', 190, 300, 8850], ['B', 345, 460, 8930],
  ] },
];

/** Builds the tower. `nets` covers each hatch with a hay net you can climb up through but not fall back down. */
export function buildWorld(nets: boolean): World {
  const w: World = { solids: [], posts: [], bales: [], gusts: [], lanterns: [], owls: [], tubs: [], acorns: [], bell: null };
  const solid = (kind: SolidKind, x0: number, x1: number, y0: number, y1: number, oneWay: boolean, grip: boolean) => {
    const s: Solid = { id: w.solids.length, kind, x: x0, y: y0, w: x1 - x0, h: y1 - y0, oneWay, grip };
    w.solids.push(s); return s;
  };
  // the cellar floor
  solid('floor', 0, TOWER_W, -40, 0, false, false);
  FLOORS.forEach((f, i) => {
    const base = i * FLOOR_H;
    for (const d of f.defs) {
      switch (d[0]) {
        case 'B': solid('beam', d[1], d[2], d[3] - BEAM_T, d[3], true, true); break;
        case 'S': solid('straw', d[1], d[2], d[3] - BEAM_T, d[3], true, true); break;
        case 'K': solid('block', d[1], d[2], d[3], d[4], false, false); break;
        case 'H': solid('hay', d[1], d[2], d[3], d[4], false, true); break;
        case 'C': solid('chimney', d[1], d[2], d[3], d[4], false, false); break;
        case 'P': w.posts.push({ id: w.posts.length, x: d[1], y0: d[2], y1: d[3] }); break;
        case 'BA': w.bales.push({ id: w.bales.length, x0: d[1], x1: d[2], y: d[3], w: d[4], h: 28, period: d[5], phase: 0 }); break;
        case 'G': w.gusts.push({ id: w.gusts.length, y0: d[1], y1: d[2], dir: d[3], on: d[4], off: d[5], phase: d[6] }); break;
        case 'L': w.lanterns.push({ id: w.lanterns.length, x: d[1], y: d[2], len: d[3], amp: d[4], period: d[5], phase: d[6] }); break;
        case 'O': w.owls.push({ id: w.owls.length, x: d[1], y: d[2] }); break;
        case 'BELL': w.bell = solid('bell', d[1], d[2], d[3], d[4], false, false); break;
        case 'T': w.tubs.push({ id: w.tubs.length, x: d[1], y: base }); break;
        case 'A': w.acorns.push({ id: w.acorns.length, x: d[1], y: d[2] }); break;
      }
    }
    // the floor above this one, with its hatch (the last floor is topped by the roof ridge instead)
    const top = base + FLOOR_H;
    if (i < FLOORS.length - 1) {
      const [h0, h1] = f.hatch;
      if (h0 > 0) solid('floor', 0, h0, top - FLOOR_T, top, false, false);
      if (h1 < TOWER_W) solid('floor', h1, TOWER_W, top - FLOOR_T, top, false, false);
      if (nets) solid('net', h0, h1, top - 4, top, true, true);
    }
  });
  solid('ridge', 150, 330, TOP_Y - 20, TOP_Y, false, true);
  return w;
}

/** How many acorn charms are hidden in the tower. */
export const ACORN_COUNT = 30;
/** How many dust-bath tubs (checkpoints): one at the start of every floor. */
export const TUB_COUNT = FLOORS.length;

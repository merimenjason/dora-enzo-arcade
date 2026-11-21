// Jade Street: the twenty-first pass's district, the Southern Islands. Runs last on the finished city (after Mandai), so
// nothing built before moves. Built in the build frame's extra rows below the old frame (lib/jade-layout.ts ISL: the
// arrays grow 30 rows here, and every older pass only ever touched the first OLD_H), its own block, which the layout
// table sets down in the open sea south of Marina Bay, between the Sentosa ferry's lane and Kallang. 44 tiles wide and
// 30 deep.
// The islands south of the city at night: St John's Island in the middle (the ferry jetty from Marina South Pier, the
// marine lab, a colonial bungalow that is the heroes' safe house, the island canteen), Lazarus Island east of it over the
// causeway with its lagoon beach, Kusu Island west over the reef with its temple, its tortoise pond and the hilltop
// keramat up the steps, the Sisters' Islands marine park south-west (Big and Little Sister, the reef between them and its
// rock pools), and far south on its own rock, Pulau Satumu and Raffles Lighthouse with the keeper's cottage. The islands
// are joined by REEF FLATS (walkable ground, a coral head every few tiles: the tide step's rocks, lib/jade-tide.ts).
// Real place names; the people are invented. Pure data: lib/jade-islandsfest.ts holds the things to do, lib/jade-tide.ts
// the tide step and lib/jade-islandsdraw.ts the moving parts.
import { T, OLD_W as W, BUILD_H, G, S, F_BRIDGE, F_PARK, F_STAIRS, ISL_X0, ISL_Y0, ISL_W, ISL_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import { linkOf } from './jade-ubin.js';
import type { Link, LinkStop } from './jade-east.js';

export type Islands = {
  /** the island ferry between Marina South Pier and St John's jetty (a Link like the Sentosa ferry's) */
  ferry: Link;
  /** its path's two ends in the old frame: the pier end moves with Marina Bay, the jetty end with the islands; the
   * water between is laid by islePath once both are where they stand */
  boatA: [number, number][]; boatB: [number, number][];
  /** the coral heads on the reef flats (world): a tide step's markers stand on them; the rock pools on the reef */
  rocks: [number, number][]; pools: [number, number][];
  /** Kusu's tortoises' basking spots round the pond (world); the pond itself, Lazarus's lagoon (float), Raffles
   * Lighthouse's gallery door (look out) and its lamp (the beam sweeps from it) */
  tortoises: [number, number][]; pond: [number, number]; lagoon: [number, number]; gallery: [number, number]; beam: [number, number];
  /** the islands' jetties (world: a boat called there comes to the water beside one) and Madam Sutera's junk's mooring */
  jetties: [number, number][]; junk: [number, number];
  /** Pulau Satumu's tiles (x0, y0, x1, y1): the lighthouse's own rock, closed to visitors, so no townsfolk wander there */
  quiet: [number, number, number, number];
  /** the islands' parked rides (a sampan at St John's jetty, a kayak at the lagoon): appended to the city's parking after
   * every older ride (lib/jade-city.ts), so the older rides keep their ids and seeded paint */
  park: { x: number; y: number; d: 'islands'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** an islands tile (local column and row) in the old (build) frame */
export const islOld = (lx: number, ly: number): [number, number] => [ISL_X0 + lx, ISL_Y0 + ly];
/** the real names; the keeper, the guide, the tortoise lady and the hermit crabs are fictional */
export const ISLAND_NAMES = {
  pier: 'Marina South Pier', jetty: 'St John’s jetty', ferry: 'the Southern Islands ferry', stjohn: 'St John’s Island', lazarus: 'Lazarus Island',
  lagoon: 'the Lazarus lagoon beach', kusu: 'Kusu Island', temple: 'the Kusu temple', keramat: 'the hilltop keramat', pond: 'the tortoise pond',
  sisters: 'the Sisters’ Islands', bigsis: 'Big Sister', littlesis: 'Little Sister', park: 'the Sisters’ Islands Marine Park', satumu: 'Pulau Satumu',
  light: 'Raffles Lighthouse', cottage: 'the keeper’s cottage', lab: 'the St John’s marine lab', causeway: 'the causeway to Lazarus', reef: 'the reef flats',
  camp: 'Kapitan Umang’s camp', crew: 'Kapitan Umang’s deck crew',
};
/** each island's land, row by row: the first and last land column (local) */
const LAND: Record<string, Record<number, [number, number]>> = {
  kusu: { 2: [3, 8], 3: [2, 9], 4: [1, 10], 5: [1, 10], 6: [1, 10], 7: [1, 10], 8: [1, 10], 9: [1, 10], 10: [2, 9], 11: [3, 8] },
  stjohn: { 1: [17, 26], 2: [15, 28], 3: [14, 29], 4: [13, 30], 5: [13, 30], 6: [13, 30], 7: [13, 30], 8: [13, 30], 9: [13, 30], 10: [14, 29], 11: [15, 28], 12: [16, 26] },
  lazarus: { 3: [35, 40], 4: [34, 41], 5: [33, 42], 6: [33, 42], 7: [33, 42], 8: [33, 42], 9: [33, 42], 10: [33, 42], 11: [33, 42], 12: [33, 42], 13: [33, 42], 14: [33, 42], 15: [33, 42], 16: [33, 42], 17: [33, 42], 18: [34, 41], 19: [35, 40] },
  bigsis: { 16: [4, 6], 17: [3, 7], 18: [2, 8], 19: [2, 8], 20: [2, 8], 21: [2, 8], 22: [3, 7], 23: [4, 6] },
  littlesis: { 18: [12, 14], 19: [11, 15], 20: [11, 15], 21: [11, 15], 22: [12, 14] },
  satumu: { 21: [26, 28], 22: [25, 29], 23: [24, 30], 24: [23, 31], 25: [23, 31], 26: [23, 31], 27: [24, 30], 28: [25, 29] },
};
/** the reef flats, as runs between local points (each about two tiles wide): Kusu to St John's, St John's down to Little
 * Sister, the two Sisters, Little Sister out to Pulau Satumu, and St John's south shore straight down to Satumu */
export const REEFS: [number, number][][] = [
  [[10, 6.5], [13, 6.5]],
  [[16, 12], [15.5, 14], [14.5, 16], [13.5, 18]],
  [[8, 20], [11, 20]],
  [[15, 21], [17, 21.5], [19, 22.5], [21, 23.5], [23, 24.5]],
  [[25, 12], [25, 14.5], [25.5, 17], [26, 19.5], [26.5, 21]],
];
/** the coral heads on the reef (local tiles, each on a reef tile): a tide step's route markers stand on these */
export const ROCKS: [number, number][] = [
  [12, 7], [15, 14], [14, 16], [10, 20], [17, 21], [19, 22], [21, 24], [25, 14], [25, 16], [26, 19],
];
/** the rock pools on the reef (local tiles) */
export const POOLS: [number, number][] = [[15, 15], [14, 17], [9, 19], [18, 22], [20, 24], [26, 17]];

/** the island ferry's path: from the pier's end straight out over the water, then in to the jetty's tip. Works in any
 * layout (in the real one the two ends are in line) */
export function islePath(a: [number, number][], b: [number, number][]): [number, number][] {
  const ae = a[a.length - 1], be = b[0];
  return [...a, [ae[0], ae[1] + 1.2 * T], [be[0], be[1] - 1.5 * T], ...b];
}

export function islands(c: City) {
  // the build frame grows by the islands' rows (open sea): every older array index stays as it was
  const N = W * BUILD_H;
  if (c.ground.length < N) {
    const g = new Uint8Array(N).fill(G.SEA), s = new Uint8Array(N).fill(S.WATER), f = new Uint8Array(N);
    g.set(c.ground); s.set(c.solid); f.set(c.flags); c.ground = g; c.solid = s; c.flags = f;
  }
  const at = (x: number, y: number) => y * W + x;
  const inI = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < ISL_W && ly < ISL_H;
  const O = islOld;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { if (!inI(lx, ly)) return; const [x, y] = O(lx, ly); const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const gr = (lx: number, ly: number) => { if (!inI(lx, ly)) return G.SEA; const [x, y] = O(lx, ly); return c.ground[at(x, y)]; };
  const open = (lx: number, ly: number) => { if (!inI(lx, ly)) return false; const [x, y] = O(lx, ly); return c.solid[at(x, y)] === S.OPEN; };
  const bld = (lx: number, ly: number, w: number, h: number, sprite: string) => {
    for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) setT(xx, yy, G.BLD, S.BUILDING);
    const [x, y] = O(lx, ly); c.buildings.push({ x, y, w, h, sprite, front: true });
  };
  const P = (lx: number, ly: number): [number, number] => { const [x, y] = O(Math.floor(lx), Math.floor(ly)); return [x * T + (lx - Math.floor(lx)) * T + T / 2, y * T + (ly - Math.floor(ly)) * T + T / 2]; };
  const prop = (lx: number, ly: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number, rot?: number) => {
    const [x, y] = O(Math.floor(lx), Math.floor(ly)), i = at(x, y);
    if (solid === 'low') c.solid[i] = S.LOW; if (solid === 'tall') c.solid[i] = S.TALL;
    const [wx, wy] = P(lx, ly); c.props.push({ x: wx, y: wy, sprite, r, solid, layer, w, rot });
  };
  const deco = (lx: number, ly: number, sprite: string, w?: number, layer: Prop['layer'] = 'over', rot?: number) => { const [wx, wy] = P(lx, ly); c.props.push({ x: wx, y: wy, sprite, r: 0, solid: 'none', layer, w, rot }); };
  const place = (name: string, lx: number, ly: number, kind: string, label?: string) => { const [x, y] = O(lx, ly); c.places[name] = { x: px(x), y: px(y), d: districtAt(x, y), kind, name: label }; };
  const N2 = ISLAND_NAMES;

  // ── the ground: open sea, then each island (grass inland, coral sand round the shore), the reef flats, the shallows
  rect(0, 0, ISL_W, ISL_H, G.SEA, S.WATER);
  for (const land of Object.values(LAND)) for (const [ly, [a, b]] of Object.entries(land)) for (let lx = a; lx <= b; lx++) setT(lx, +ly, G.GRASS, S.OPEN, F_PARK);
  const isLand = (lx: number, ly: number) => inI(lx, ly) && gr(lx, ly) === G.GRASS;
  for (let ly = 0; ly < ISL_H; ly++) for (let lx = 0; lx < ISL_W; lx++) {
    if (!isLand(lx, ly)) continue;
    let shore = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inI(lx + dx, ly + dy) && gr(lx + dx, ly + dy) === G.SEA) shore = true;
    if (shore) setT(lx, ly, G.CORAL);
  }
  for (const run of REEFS) for (let k = 1; k < run.length; k++) {
    const [ax, ay] = run[k - 1], [bx, by] = run[k], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let s = 0; s <= n; s++) {
      const qx = ax + (bx - ax) * s / n, qy = ay + (by - ay) * s / n;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const lx = Math.floor(qx + dx * 0.6), ly = Math.floor(qy + dy * 0.6);
        if (inI(lx, ly) && gr(lx, ly) === G.SEA) setT(lx, ly, G.REEF);
      }
    }
  }
  for (let ly = 0; ly < ISL_H; ly++) for (let lx = 0; lx < ISL_W; lx++) {
    if (gr(lx, ly) !== G.SEA) continue;
    let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const g = gr(lx + dx, ly + dy); if (g === G.REEF || g === G.CORAL) near = true; }
    if (near) setT(lx, ly, G.SHOAL, S.WATER);
  }
  // Lazarus's lagoon: calm water inside a crescent of sand, open to the sea at the south
  for (let ly = 11; ly <= 19; ly++) for (let lx = 33; lx <= 42; lx++) if (gr(lx, ly) === G.GRASS) setT(lx, ly, G.CORAL);
  rect(35, 13, 6, 4, G.LAGOON, S.WATER); rect(37, 17, 2, 3, G.LAGOON, S.WATER);
  // the causeway from St John's to Lazarus, and the islands' footpaths
  rect(31, 6, 2, 2, G.ISLEPATH);
  const path = (pts: [number, number][]) => { for (let k = 1; k < pts.length; k++) { const [ax, ay] = pts[k - 1], [bx, by] = pts[k], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let s = 0; s <= n; s++) { const lx = Math.round(ax + (bx - ax) * s / n), ly = Math.round(ay + (by - ay) * s / n); if (gr(lx, ly) === G.GRASS || gr(lx, ly) === G.CORAL) setT(lx, ly, G.ISLEPATH); } } };
  path([[21, 2], [21, 10], [16, 11]]); path([[21, 7], [30, 7], [34, 7], [37, 9], [37, 11]]); path([[13, 6], [21, 6]]); path([[25, 10], [25, 12]]);
  path([[9, 6], [5, 10], [2, 10]]); path([[24, 26], [29, 26]]); path([[5, 19], [8, 20]]);
  // the jetties: St John's (the ferry's), Kusu's, Satumu's (planks over the water: boats pass under)
  for (let ly = 0; ly <= 1; ly++) for (const lx of [21, 22]) setT(lx, ly, G.PLANK, S.OPEN, F_BRIDGE);
  setT(0, 6, G.PLANK, S.OPEN, F_BRIDGE); setT(0, 7, G.PLANK, S.OPEN, F_BRIDGE);
  setT(32, 25, G.PLANK, S.OPEN, F_BRIDGE); setT(33, 25, G.PLANK, S.OPEN, F_BRIDGE);

  // ── St John's Island: the marine lab, the jetty shelter, the canteen, the bungalow safe house; Kak Lumba
  bld(14, 3, 6, 3, 'isl-lab'); place('isl-lab', 17, 6, 'spot', N2.lab);
  bld(23, 2, 4, 2, 'isl-shelter');
  place('isl-jetty', 21, 1, 'spot', N2.jetty);
  place('mk-islands', 19, 8, 'market', 'the St John’s canteen');
  bld(26, 8, 4, 3, 'isl-safe'); place('safe-islands', 27, 11, 'safe', 'St John’s bungalow safe house');
  place('lumba', 17, 10, 'contact', 'Kak Lumba'); place('stjohn', 21, 5, 'spot', N2.stjohn);
  place('reef-north', 16, 11, 'spot', N2.reef); place('reef-south', 25, 11, 'spot', N2.reef);
  // ── Kusu Island: the temple (its courtyard faces the path), the tortoise pond, the keramat up the steps on the hill
  bld(2, 6, 5, 3, 'isl-temple'); rect(2, 9, 5, 1, G.TEMPLE); place('kusu-temple', 4, 9, 'spot', N2.temple);
  rect(2, 3, 3, 2, G.LAGOON, S.WATER); prop(3.5, 2.7, 'isl-turtle-statue', 12, 'none', 'over', 60);
  place('pond', 5, 4, 'spot', N2.pond); place('ku', 6, 9, 'contact', 'Auntie Ku');
  bld(6, 2, 3, 3, 'isl-keramat'); rect(7, 5, 1, 1, G.STAIRS, S.OPEN, F_STAIRS); place('keramat', 7, 6, 'spot', N2.keramat);
  c.decals.push({ x: P(7, 5)[0], y: P(7, 5)[1], sprite: 'd-stairs', r: 0, solid: 'none', layer: 'ground', w: 1.6 * T, rot: Math.PI / 2 });
  place('kusu', 8, 8, 'spot', N2.kusu);
  // ── Lazarus Island: the lagoon beach (a coconut bar on the sand), Kapitan Umang's hermit-crab camp on the north shore
  place('lagoon', 37, 12, 'spot', N2.lagoon); place('lazarus', 36, 8, 'spot', N2.lazarus);
  deco(39.5, 5, 'isl-camp', 110); place('crab-camp', 39, 7, 'spot', N2.camp);
  for (const [lx, ly] of [[34, 12], [41, 12], [33, 17]] as const) deco(lx, ly, 'isl-umbrella', 70, 'over');
  // ── the Sisters' Islands: the marine park's sign post on Big Sister; Satumu: Raffles Lighthouse, the keeper's cottage
  place('sisters', 5, 20, 'spot', N2.sisters); place('littlesis', 13, 20, 'spot', N2.littlesis);
  bld(26, 21, 3, 4, 'isl-light'); place('lighthouse', 27, 25, 'spot', N2.light);
  bld(29, 23, 3, 2, 'isl-cottage'); place('camar', 29, 25, 'contact', 'Pak Camar'); place('satumu', 28, 27, 'spot', N2.satumu);
  const beam = P(27.5, 20.6), gallery = P(27, 25.2);
  // ── the reef: coral heads (a tide step's rocks) and rock pools
  for (const [lx, ly] of ROCKS) deco(lx, ly, 'isl-coral', 46, 'ground');
  for (const [lx, ly] of POOLS) deco(lx, ly, 'isl-pool', 52, 'ground');

  // ── dressing: palms and rain trees inland, buoys off the reef, the lens on show by the lab, bollards on the jetties
  for (const [lx, ly] of [[15, 7], [24, 4], [29, 5], [13, 8], [28, 4], [18, 1], [3, 5], [9, 9], [34, 5], [35, 5], [39, 4], [3, 18], [7, 21], [12, 21], [30, 24], [24, 27]] as const)
    if (open(lx, ly) && gr(lx, ly) !== G.ISLEPATH && gr(lx, ly) !== G.STAIRS) prop(lx, ly, (lx + ly) % 3 ? 'isl-palm' : 'tree-round', 22, 'tall', 'over', (lx + ly) % 3 ? 96 : undefined);
  for (const [lx, ly] of [[18, 16], [11, 14], [28, 15], [20, 26], [36, 22]] as const) deco(lx, ly, 'isl-buoy', 34, 'over');
  prop(20, 5, 'isl-lens', 14, 'tall', 'over', 60);
  for (const [lx, ly] of [[20, 1], [23, 1], [0, 5], [34, 25]] as const) if (inI(lx, ly)) deco(lx, ly, 'isl-bollard', 30, 'over');
  for (const [lx, ly] of [[22, 9], [16, 8], [38, 11], [8, 10], [28, 27]] as const) if (open(lx, ly)) prop(lx, ly, 'lamp', 8, 'tall');
  // hiding spots
  for (const [lx, ly] of [[28, 6], [14, 10], [40, 10], [2, 11], [5, 22]] as const) if (open(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground' }); }

  // ── the ferry: from Marina South Pier on the bay's south promenade (in the main block: a stop, no new tiles there) out
  // over the water and in to St John's jetty (lib/jade-cable.ts rides it)
  const PIER: [number, number] = [185, 81];
  c.places['pier-msp'] = { x: px(PIER[0]), y: px(PIER[1]), d: districtAt(PIER[0], PIER[1]), kind: 'spot', name: N2.pier };
  c.props.push({ x: px(PIER[0]) - 40, y: px(PIER[1]) - 18, sprite: 'jetty-sign', r: 0, solid: 'none', layer: 'over', w: 54 });
  const boatA: [number, number][] = [[px(PIER[0]), (PIER[1] + 1.4) * T]];
  const boatB: [number, number][] = [P(21.5, -0.2), P(21.5, 0.4)];
  const stops: [LinkStop, LinkStop] = [{ id: 'pier-msp', name: N2.pier, x: c.places['pier-msp'].x, y: c.places['pier-msp'].y }, { id: 'isl-jetty', name: N2.jetty, x: c.places['isl-jetty'].x, y: c.places['isl-jetty'].y }];
  const ferry = linkOf('launch', N2.ferry, stops, islePath(boatA, boatB));

  // the rides: a sampan at St John's jetty, a kayak on the lagoon, a bike by the lab
  const park: Islands['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'islands', kind, rot }); };
  ride(24, 0, 'boat', 0); ride(35, 13, 'kayak', 0);
  // Kusu's tortoises bask round the pond; Madam Sutera's black junk lies off Satumu
  const tortoises: [number, number][] = [P(1.4, 4.6), P(5.2, 2.8), P(1.6, 2.6), P(5.6, 5.4)];
  c.islands = { ferry, boatA, boatB, rocks: ROCKS.map(([lx, ly]) => P(lx, ly)), pools: POOLS.map(([lx, ly]) => P(lx, ly)), tortoises, pond: P(4.5, 5.2), lagoon: P(37.5, 12.4),
    gallery, beam, jetties: [P(21.5, 1), P(0.5, 6.5), P(32.5, 25)], junk: P(36, 26), park, quiet: [...O(21, 19), ...O(34, 30)] };
}

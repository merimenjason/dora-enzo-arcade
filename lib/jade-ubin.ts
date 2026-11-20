// Jade Street: the seventeenth pass's island, Pulau Ubin. Runs last on the finished city (after the south shore), so
// nothing built before moves. Built in the open sea south of Changi in the old frame (columns UBIN_X0 to UBIN_X1, rows
// UBIN_Y0 to UBIN_Y1); in the world the layout table (lib/jade-layout.ts) puts it off Changi Airport, the north-east
// corner, across a narrow strait. No roads, no MRT, no cars: a bumboat from the Changi Point Ferry Terminal (Pak Ubin's)
// round the coast to Ubin Jetty is the only way over (lib/jade-cable.ts rides it like the island ferry). A 1960s kampong
// island: Ubin Town by the jetty (the shops, the bicycle rental), red laterite tracks through secondary forest (Jalan
// Ubin, Jalan Endut Senin, Jalan Mamam, Jalan Sam Kongsi), zinc-roofed kampong houses, the Wei Tuo Fa Gong temple and its
// wayang stage, a durian orchard, Ketam Quarry and Pekan Quarry with their granite rims, and at the east end Chek Jawa:
// House No. 1, the boardwalk over the mangrove flats and Jejawi Tower. Real place and track names; the Tusker Boys (wild
// boars) and their den are fictional. Pure data: lib/jade-ubinfest.ts holds the things to do, lib/jade-boars.ts the
// gang, lib/jade-ubindraw.ts the extras.
import { T, OLD_W as W, OLD_H as H, G, S, F_BRIDGE, F_PARK, UBIN_X0, UBIN_Y0, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import type { Link, LinkStop } from './jade-east.js';

export type Ubin = {
  /** the bumboat between the Changi Point Ferry Terminal and Ubin Jetty (a Link like the island ferry's) */
  boat: Link;
  /** its path's two ends in the old frame: the Changi end moves with Changi, the Ubin end with the island; the open
   * water between is laid by boatPath once both are where they stand (so the boat never crosses the land) */
  boatA: [number, number][]; boatB: [number, number][];
  /** where the boars root about in free roam (world) */
  digs: [number, number][];
  /** the durian trees (world): shake one (F with the partner, or E) for a durian in season */
  durians: [number, number][];
  /** the dirt tracks as straight runs (world, end to end): the boars charge along them */
  tracks: [[number, number], [number, number]][];
  /** Jejawi Tower's foot, Chek Jawa's flats (a world rect inside the boardwalk), the den's door, the rental's rack */
  tower: [number, number]; flats: [number, number, number, number]; den: [number, number]; rack: [number, number];
  /** the island's parked rides (the rental's bikes and tandem, a boat on Ketam Quarry): appended to the city's parking
   * after every older ride (lib/jade-city.ts), so the older rides keep their ids and seeded paint */
  park: { x: number; y: number; d: 'pulau'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** the real names: the town, the tracks, the temple, the quarries, Chek Jawa; the Tusker Boys are fictional */
export const UBIN_NAMES = {
  town: 'Ubin Town', jetty: 'Ubin Jetty', temple: 'the Wei Tuo Fa Gong Temple', wayang: 'the wayang stage', ketam: 'Ketam Quarry', pekan: 'Pekan Quarry',
  chek: 'Chek Jawa', house1: 'House No. 1', tower: 'Jejawi Tower', boardwalk: 'the Chek Jawa boardwalk', puaka: 'Puaka Hill', orchard: 'the kampong durian orchard',
  ubin: 'Jalan Ubin', endut: 'Jalan Endut Senin', mamam: 'Jalan Mamam', sam: 'Jalan Sam Kongsi', gang: 'the Tusker Boys', den: 'the Tuskers’ den',
  rental: 'the Ubin bicycle rental', boat: 'the Ubin bumboat', ferry: 'Changi Point Ferry Terminal',
};
/** the island's land, row by row (local rows 0 to 29 from UBIN_Y0): the first and last land column (local, from UBIN_X0) */
const COAST: Record<number, [number, number]> = {
  2: [14, 22], 3: [10, 25], 4: [7, 28], 5: [6, 30], 6: [5, 31], 7: [4, 32], 8: [4, 33], 9: [4, 34], 10: [3, 34], 11: [3, 34],
  12: [3, 34], 13: [3, 34], 14: [3, 34], 15: [3, 34], 16: [4, 34], 17: [4, 33], 18: [5, 33], 19: [6, 32], 20: [7, 31],
  21: [8, 30], 22: [8, 29], 23: [9, 28], 24: [10, 26], 25: [12, 24], 26: [15, 21],
};
/** the bumboat's path: the Changi end, round the coast through open water, then the Ubin end. Works in any layout:
 * the boat runs two tiles out from the Changi jetty's end, along that row of open sea, then straight up the island's
 * western sea column to the Ubin jetty's tip */
export function boatPath(a: [number, number][], b: [number, number][]): [number, number][] {
  const ae = a[a.length - 1], be = b[0], sea = ae[1] + 2 * T;
  return [...a, [ae[0] + 3.5 * T, sea], [be[0], sea], ...b];
}
export function linkOf(id: Link['id'], name: string, stops: [LinkStop, LinkStop], path: [number, number][]): Link {
  const len = [0]; for (let i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return { id, name, stops, path, len };
}

export function ubin(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  /** a local tile (from the island's corner) to an old-frame tile */
  const X = (lx: number) => UBIN_X0 + lx, Y = (ly: number) => UBIN_Y0 + ly;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { const x = X(lx), y = Y(ly); if (!inb(x, y)) return; const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const land = (lx: number, ly: number) => { const r = COAST[ly]; return !!r && lx >= r[0] && lx <= r[1]; };
  const gr = (lx: number, ly: number) => c.ground[at(X(lx), Y(ly))];
  const bld = (lx: number, ly: number, w: number, h: number, sprite: string) => {
    for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) setT(xx, yy, G.BLD, S.BUILDING);
    c.buildings.push({ x: X(lx), y: Y(ly), w, h, sprite, front: true });
  };
  const prop = (lx: number, ly: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number) => {
    const i = at(X(Math.floor(lx)), Y(Math.floor(ly)));
    if (solid === 'low') c.solid[i] = S.LOW; if (solid === 'tall') c.solid[i] = S.TALL;
    c.props.push({ x: X(lx) * T + T / 2, y: Y(ly) * T + T / 2, sprite, r, solid, layer, w });
  };
  const deco = (lx: number, ly: number, sprite: string, w?: number, layer: Prop['layer'] = 'over') => c.props.push({ x: X(lx) * T + T / 2, y: Y(ly) * T + T / 2, sprite, r: 0, solid: 'none', layer, w });
  const P = (lx: number, ly: number): [number, number] => [px(X(lx)), px(Y(ly))];
  const place = (name: string, lx: number, ly: number, kind: string, label?: string) => { c.places[name] = { x: px(X(lx)), y: px(Y(ly)), d: districtAt(X(lx), Y(ly)), kind, name: label }; };
  const open = (lx: number, ly: number) => c.solid[at(X(lx), Y(ly))] === S.OPEN;
  const N = UBIN_NAMES;

  // ── the ground: sea all round, then the island's forest floor (the whole island is park: townsfolk wander it), a
  // sandy shore on the south coast
  rect(0, 0, UBIN_W, UBIN_H, G.SEA, S.WATER);
  for (let ly = 0; ly < UBIN_H; ly++) for (let lx = 0; lx < UBIN_W; lx++) if (land(lx, ly)) setT(lx, ly, G.FOREST, S.OPEN, F_PARK);
  for (let ly = 18; ly < UBIN_H; ly++) for (let lx = 0; lx < UBIN_W; lx++) if (land(lx, ly) && !land(lx, ly + 1)) { setT(lx, ly, G.SAND); if (land(lx, ly - 1) && ly > 22) setT(lx, ly - 1, G.SAND); }

  // ── the quarries: still jade-green water in a ring of granite (Ketam in the west, Pekan in the middle north)
  const quarry = (cx: number, cy: number, rx: number, ry: number) => {
    for (let ly = Math.floor(cy - ry - 2); ly <= cy + ry + 2; ly++) for (let lx = Math.floor(cx - rx - 2); lx <= cx + rx + 2; lx++) {
      if (!land(lx, ly)) continue;
      const d = ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2;
      if (d < 1) setT(lx, ly, G.QUARRY, S.WATER); else if (d < 1.75) setT(lx, ly, G.ROCK, S.OPEN, F_PARK);
    }
  };
  quarry(7.5, 8.2, 2.9, 2.3); quarry(18.5, 7, 2.6, 1.8);

  // ── Chek Jawa: the mangrove flats east of column 29 (mud, water to everything but a boat), the boardwalk loop over
  // them (a deck you walk), the spur to Jejawi Tower
  for (let ly = 5; ly <= 20; ly++) for (let lx = 29; lx <= 34; lx++) if (land(lx, ly)) setT(lx, ly, G.MUD, S.WATER);
  const deck = (lx: number, ly: number) => setT(lx, ly, G.DECK, S.OPEN, F_BRIDGE);
  for (let lx = 27; lx <= 33; lx++) { deck(lx, 10); deck(lx, 17); }
  for (let ly = 10; ly <= 17; ly++) deck(33, ly);
  for (let ly = 15; ly <= 16; ly++) deck(31, ly);

  // ── the tracks: red laterite, two tiles wide (Jalan Ubin east from the town, Jalan Endut Senin up to Chek Jawa, Jalan
  // Mamam north past Pekan Quarry to the den, Jalan Sam Kongsi west to Ketam Quarry, the lane from the jetty, the
  // orchard lane)
  const runs: [number, number, number, number][] = [
    [8, 16, 25, 17], [23, 10, 24, 17], [23, 10, 28, 11], [14, 4, 15, 16], [4, 12, 13, 13], [9, 16, 10, 22], [15, 20, 26, 21],
  ];
  const tracks: Ubin['tracks'] = [];
  for (const [x0, y0, x1, y1] of runs) {
    for (let ly = y0; ly <= y1; ly++) for (let lx = x0; lx <= x1; lx++) if (land(lx, ly) && gr(lx, ly) !== G.QUARRY && gr(lx, ly) !== G.MUD && gr(lx, ly) !== G.DECK) setT(lx, ly, G.DIRT);
    const h = x1 - x0 > y1 - y0;
    tracks.push(h ? [[X(x0) * T + T, (Y(y0) + 1) * T], [X(x1) * T, (Y(y0) + 1) * T]] : [[(X(x0) + 1) * T, Y(y0) * T + T], [(X(x0) + 1) * T, Y(y1) * T]]);
  }
  // Ubin Town's square and the kampong yards are packed earth
  rect(8, 18, 8, 4, G.KAMPONG); rect(16, 18, 8, 2, G.KAMPONG);

  // ── the jetty: a timber deck out over the strait on the west coast, Pak Ubin's bumboats tie up at its end
  for (let lx = 2; lx <= 7; lx++) { deck(lx, 22); deck(lx, 23); }
  deco(8.6, 22.4, 'ubin-jetty', 150, 'over');
  place('jetty-ubin', 6, 22, 'ferry', N.jetty);
  deco(2, 24.2, 'sampan', 70, 'ground');

  // ── Ubin Town: the row of shops, the bicycle rental with its rack, the safe house, kampong houses
  bld(10, 18, 3, 2, 'ubin-shops'); bld(13, 18, 3, 2, 'ubin-house-b'); place('ubintown', 13, 20, 'spot', N.town); place('mk-pulau', 11, 20, 'market', 'the Ubin Town provision shop');
  bld(12, 22, 3, 2, 'ubin-bikes'); place('bikes-ubin', 13, 24, 'spot', N.rental); place('ayu', 16, 22, 'contact', 'Kak Ayu');
  prop(17, 23, 'ubin-rack', 14, 'tall', 'over', 84);
  const rack = P(17, 23);
  const park: Ubin['park'] = [];
  for (const [lx, ly] of [[17, 24], [18, 24], [11, 24]] as const) park.push({ x: px(X(lx)), y: px(Y(ly)), d: 'pulau', kind: 'bike', rot: 0 });
  park.push({ x: px(X(19)), y: px(Y(23)), d: 'pulau', kind: 'tandem', rot: 0 });
  bld(5, 17, 2, 2, 'safe-ubin'); place('safe-ubin', 6, 19, 'safe', 'Kampong safe house');
  bld(4, 14, 3, 2, 'ubin-house-a'); bld(17, 13, 3, 2, 'ubin-house-a'); bld(20, 23, 3, 2, 'ubin-house-a'); bld(25, 13, 3, 2, 'ubin-house-a');
  bld(9, 3, 3, 2, 'ubin-house-b'); bld(26, 18, 3, 2, 'ubin-house-b');
  place('kampong', 18, 15, 'spot', 'the kampong houses on Jalan Ubin');
  prop(8, 14, 'coop', 10, 'tall', 'over', 46); prop(23, 15, 'coop', 10, 'tall', 'over', 46);
  prop(7, 16, 'drum', 8, 'tall', 'over', 34); prop(21, 25, 'drum', 8, 'tall', 'over', 34); prop(13, 5, 'hammock', 12, 'tall', 'over', 62);

  // ── the Wei Tuo Fa Gong temple and, facing it across the yard, the wayang stage (Auntie Lan) with its chairs
  bld(16, 18, 3, 2, 'ubin-temple'); place('temple-ubin', 17, 20, 'spot', N.temple);
  prop(19.5, 19.5, 'incense-urn', 8, 'tall', 'over', 36);
  bld(21, 18, 3, 2, 'ubin-wayang'); place('wayang', 22, 20, 'spot', N.wayang); place('lan', 24, 19, 'contact', 'Auntie Lan');
  deco(20, 19, 'wayang-chairs', 70, 'over');

  // ── the durian orchard south of the orchard lane, rambutans by the houses, coconut palms on the shore
  const durians: [number, number][] = [];
  for (const [lx, ly] of [[17, 23], [16, 24], [23, 22], [25, 22], [18, 25]] as const) if (open(lx, ly) && land(lx, ly)) { prop(lx, ly, 'durian-tree', 18, 'tall', 'over', 120); durians.push(P(lx, ly)); }
  for (const [lx, ly] of [[12, 15], [8, 23], [21, 14], [27, 15], [11, 6]] as const) if (open(lx, ly)) prop(lx, ly, 'rambutan-tree', 16, 'tall', 'over', 104);
  place('orchard-ubin', 20, 22, 'spot', N.orchard);
  deco(22, 22, 'durian-pile', 54);

  // ── the quarries' names, Puaka Hill's granite, the den north of Pekan Quarry
  place('ketam', 7, 12, 'spot', N.ketam); place('pekan', 16, 9, 'spot', N.pekan);
  bld(16, 2, 3, 2, 'ubin-den'); place('den', 17, 4, 'spot', N.den);
  const den = P(17, 4);
  for (const [lx, ly] of [[12, 9], [21, 4], [6, 6]] as const) if (open(lx, ly)) prop(lx, ly, 'boulder', 14, 'tall', 'over', 60);
  prop(21, 8, 'granite-blocks', 12, 'tall', 'over', 60); prop(15, 6, 'winch', 10, 'tall', 'over', 50);
  deco(17, 4.4, 'dig-hole', 60, 'ground'); deco(20, 5, 'dig-hole', 60, 'ground');
  // a sampan moored on Ketam Quarry (the chapter's finale crosses it)
  park.push({ x: px(X(7)), y: px(Y(10)), d: 'pulau', kind: 'boat', rot: Math.PI / 2 });

  // ── Chek Jawa: House No. 1 on the headland, Jejawi Tower in the mangroves, the flats' creatures
  bld(24, 7, 3, 2, 'ubin-house1'); place('house1', 25, 9, 'spot', N.house1); place('belangkas', 27, 9, 'contact', 'Uncle Belangkas');
  prop(31.5, 13.5, 'ubin-tower', 26, 'tall', 'over', 92); deck(31, 14); place('jejawi', 31, 15, 'spot', N.tower);
  place('chekjawa', 28, 10, 'spot', N.boardwalk);
  for (const [lx, ly, sp, w] of [[30, 11, 'horseshoe-crab', 40], [32, 16, 'sea-star', 34], [30, 18, 'heron', 50], [32, 8, 'mangrove', 110], [34, 13, 'mangrove', 110], [29, 19, 'mangrove', 100], [30, 7, 'mangrove', 100], [31.5, 12, 'seagrass', 60], [29.5, 14.5, 'seagrass', 60]] as const)
    deco(lx, ly, sp, w, sp === 'seagrass' ? 'ground' : 'over');
  const flats: Ubin['flats'] = [X(29) * T, Y(11) * T, X(33) * T, Y(17) * T];

  // ── the forest: trees over the open forest floor away from the tracks, coconut palms along the shore
  const k0 = 7;
  for (let ly = 2; ly < UBIN_H; ly++) for (let lx = 0; lx < UBIN_W; lx++) {
    if (gr(lx, ly) !== G.FOREST || !open(lx, ly)) continue;
    const h = ((lx * 73 + ly * 151 + k0) % 17);
    if (h !== 0 && h !== 9) continue;
    const near = (g: number) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => gr(lx + dx, ly + dy) === g);
    if (near(G.DIRT) || near(G.KAMPONG) || near(G.BLD) || near(G.DECK)) continue;
    prop(lx, ly, h === 0 ? 'tree-round' : 'wild-banana', 14, 'tall', 'over', h === 0 ? 110 : 70);
  }
  for (const [lx, ly] of [[13, 25], [22, 26], [10, 23], [4, 11], [26, 4], [6, 20]] as const) if (open(lx, ly) && land(lx, ly)) prop(lx, ly, 'coconut', 12, 'tall', 'over', 120);
  for (const [lx, ly] of [[10, 8], [24, 19], [3, 15]] as const) if (open(lx, ly)) deco(lx, ly, 'lalang', 56);
  // the kelong off the north coast, standing in the sea
  deco(27, 1.5, 'kelong', 3.4 * T, 'over');

  // ── where the boars root (free roam), hiding spots, a few hornbills and junglefowl
  const digs: [number, number][] = [P(12, 11), P(21, 12), P(26, 6), P(6, 15), P(19, 22), P(16, 11)];
  for (const [lx, ly] of [[11, 14], [22, 9], [27, 16], [8, 25]] as const) if (open(lx, ly)) { c.hides.push({ x: px(X(lx)), y: px(Y(ly)) }); c.props.push({ x: px(X(lx)), y: Y(ly) * T + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground' }); }
  for (const [lx, ly, sp] of [[13, 10, 'hornbill'], [24, 5, 'hornbill'], [14, 18.6, 'hen-chicks'], [8, 21, 'hen-chicks']] as const) deco(lx, ly, sp, 46);

  // ── the bumboat: from the Changi Point Ferry Terminal (Pak Ubin's, lib/jade-far.ts) down its jetty and out, round the
  // coast to Ubin Jetty (lib/jade-cable.ts rides it)
  const cv = c.places['ferry-cv'];
  const boatA: [number, number][] = [[367 * T, 89.6 * T]];
  const boatB: [number, number][] = [[X(0.8) * T, Y(24.6) * T], [X(2.6) * T, Y(24.6) * T]];
  const stops: [LinkStop, LinkStop] = [{ id: 'ferry-cv', name: N.ferry, x: cv.x, y: cv.y }, { id: 'jetty-ubin', name: N.jetty, x: c.places['jetty-ubin'].x, y: c.places['jetty-ubin'].y }];
  const boat = linkOf('bumboat', N.boat, stops, boatPath(boatA, boatB));

  c.ubin = { boat, boatA, boatB, digs, durians, tracks, tower: P(31, 15), flats, den, rack, park };
}
/** the island block's size in tiles */
export const UBIN_W = 36, UBIN_H = 30;

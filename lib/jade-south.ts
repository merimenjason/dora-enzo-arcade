// Jade Street: the fourteenth pass's three districts. Runs last on the finished city (after everything else, back lanes
// included), so nothing built before moves. Built in a strip south of Kampong Glam (each district's block is then moved
// west of Chinatown, where it is in Singapore: lib/jade-layout.ts): Jurong in the
// west (the Science Centre and its observatory, Snow City, Jem, Jurong East station on its viaduct, and the Chinese
// Garden on Jurong Lake with its seven-storey pagoda, twin pagodas, stone lions, the red bridge over the stream, a tea house and the
// Mid-Autumn lanterns of Lights by the Lake), Tiong Bahru in the middle (the art-deco estate: Tiong Bahru Market, the
// curved flats on Seng Poh Road and Moh Guan Terrace, a bakery, a bookshop, the Monkey God temple, the songbird
// corner) and Clarke Quay in the east (the painted godowns on the Singapore River under their canopy, Read Bridge, the
// Slingshot, the seafood restaurants, the Old Hill Street Police Station with its rainbow shutters, the river's
// bumboats). Real place, road and landmark names (owner, 16-11); the people and Towkay Hoot's schemes are invented.
// Pure data: lib/jade-southdraw.ts paints the extras and lib/jade-southfest.ts holds the things to do.
import { T, OLD_W as W, OLD_H as H, G, S, F_BRIDGE, F_PARK, OLD_ROADS as ROADS, SOUTH_X0, SOUTH_X1, SOUTH_Y0, SOUTH_Y1, TIONG_X0, QUAY_X0, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import type { Station } from './jade-island.js';

export type South = {
  /** Clarke Quay: the canopy umbrellas over the lanes (world), the Slingshot, the busker's stage */
  canopy: [number, number][]; sling: [number, number]; stage: [number, number];
  /** Tiong Bahru: the songbird corner, the chwee kueh cart */
  birds: [number, number]; kueh: [number, number];
  /** Jurong: the lake (centre, radii in world units), where the koi are fed, the telescope, the festival's lanterns
   * (big ones on the shore, lotus lanterns on the water) and where a lantern walk starts and ends */
  lake: [number, number, number, number]; koi: [number, number][]; scope: [number, number];
  lanterns: [number, number][]; lotus: [number, number][]; walk: [[number, number], [number, number]];
};
const px = (t: number) => t * T + T / 2;
/** the fourteenth pass's real names: landmarks, malls, bridges, stations; Towkay Hoot is fictional */
export const SOUTH_NAMES = {
  market: 'Tiong Bahru Market', bakery: 'Tiong Bahru Bakery', temple: 'the Monkey God Temple', birds: 'the Tiong Bahru bird corner', flats: 'the Moh Guan Terrace flats',
  quay: 'Clarke Quay', river: 'the Singapore River', read: 'Read Bridge', coleman: 'Coleman Bridge', police: 'the Old Hill Street Police Station', central: 'Clarke Quay Central',
  sling: 'the Slingshot', seafood: 'the riverside seafood restaurant',
  science: 'Science Centre Singapore', obs: 'the Science Centre Observatory', snow: 'Snow City', mall: 'Jem', garden: 'the Chinese Garden', lake: 'Jurong Lake',
  pagoda: 'the seven-storey pagoda', twin: 'the Twin Pagodas', fest: 'Lights by the Lake',
};
/** the three districts' roads in ROADS (lib/jade-city.ts) */
export const SOUTH_ROADS = [33, 34, 35, 36, 37, 38, 39];
/** the Singapore River through Clarke Quay: rows RIVER_Y to RIVER_Y + 3, from column RIVER_X0 to Clarke Quay's east
 * edge (in the world it runs on from there, past Outram Road, to the harbour: lib/jade-city.ts seams) */
export const RIVER_Y = 103, RIVER_X0 = 291;

export function south(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const setT = (x: number, y: number, g: number, s: number = S.OPEN, f = 0) => { if (!inb(x, y)) return; const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (x0: number, y0: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(x, y, g, s, f); };
  const bld = (x: number, y: number, w: number, h: number, sprite: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = at(xx, yy); c.ground[i] = G.BLD; c.solid[i] = S.BUILDING; c.flags[i] = 0; }
    c.buildings.push({ x, y, w, h, sprite, front: true });
  };
  const prop = (x: number, y: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number, rot?: number) => {
    const i = at(Math.floor(x), Math.floor(y));
    if (solid === 'low') c.solid[i] = S.LOW; if (solid === 'tall') c.solid[i] = S.TALL;
    c.props.push({ x: x * T + T / 2, y: y * T + T / 2, sprite, r, solid, layer, w, rot });
  };
  const deco = (x: number, y: number, sprite: string, w?: number, layer: Prop['layer'] = 'over') => c.props.push({ x: x * T + T / 2, y: y * T + T / 2, sprite, r: 0, solid: 'none', layer, w });
  const place = (name: string, x: number, y: number, kind: string, label?: string) => { c.places[name] = { x: px(x), y: px(y), d: districtAt(x, y), kind, name: label }; };
  const water = (x: number, y: number) => c.solid[at(x, y)] === S.WATER;
  const N = SOUTH_NAMES;
  const X0 = SOUTH_X0, X1 = SOUTH_X1, Y0 = SOUTH_Y0, Y1 = SOUTH_Y1;

  // ── the ground: Jurong's pavers, Tiong Bahru's terrazzo, Clarke Quay's granite setts; the Chinese Garden's pebble
  // paths round Jurong Lake; the Singapore River through Clarke Quay out to the sea
  rect(X0, Y0, TIONG_X0 - X0, Y1 - Y0 + 1, G.JURONG);
  rect(TIONG_X0, Y0, QUAY_X0 - TIONG_X0, Y1 - Y0 + 1, G.TIONG);
  rect(QUAY_X0, Y0, X1 - QUAY_X0 + 1, Y1 - Y0 + 1, G.QUAY);
  rect(RIVER_X0, RIVER_Y, X1 + 1 - RIVER_X0, 4, G.CANAL, S.WATER);
  // the Chinese Garden: everything west of Jurong Town Hall Road and south of the first cross street
  const GX0 = X0, GX1 = 222, GY0 = 107;
  // (lawns, with pebble paths: a walk round the lake's shore, the avenue in from the gate, the south terrace)
  rect(GX0, GY0, GX1 - GX0 + 1, Y1 - GY0 + 1, G.GRASS, S.OPEN, F_PARK);
  const LK: [number, number, number, number] = [209.5, 117, 8.4, 5.2];
  const inLake = (x: number, y: number, pad = 0) => ((x - LK[0]) / (LK[2] + pad)) ** 2 + ((y - LK[1]) / (LK[3] + pad)) ** 2 < 1;
  for (let y = GY0; y <= Y1; y++) for (let x = GX0; x <= GX1; x++) {
    if (inLake(x, y)) setT(x, y, G.CANAL, S.WATER);
    else if (inLake(x, y, 1.7) || y === 111 || y === 112 || y >= 124 || x >= 220) setT(x, y, G.GARDEN, S.OPEN, F_PARK);
  }
  // a stream runs into the lake from the north; the red bridge carries the shore path over it
  for (let y = 108; y <= 112; y++) for (const x of [208, 209]) setT(x, y, G.CANAL, S.WATER);
  for (const y of [111, 112]) for (const x of [208, 209]) setT(x, y, G.DECK, S.OPEN, F_BRIDGE);

  // ── roads: kerbs in the district's own paving, two lanes
  type Seg = { axis: 'h' | 'v'; at: number; a: number; b: number };
  const segs: Seg[] = SOUTH_ROADS.map(i => { const r = ROADS[i]; return { axis: r.axis, at: r.at, a: r.from, b: r.to }; });
  const kerbG = (x: number) => x >= QUAY_X0 ? G.QUAY : x >= TIONG_X0 ? G.TIONG : G.JURONG;
  const cross = (x: number, y: number) => { let h = false, v = false; for (const r of ROADS) { if (r.axis === 'h' && y >= r.at && y <= r.at + 3 && x >= r.from && x <= r.to) h = true; if (r.axis === 'v' && x >= r.at && x <= r.at + 3 && y >= r.from && y <= r.to) v = true; } return h && v; };
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s++) for (let k = 0; k < 4; k++) {
    const x = sg.axis === 'h' ? s : sg.at + k, y = sg.axis === 'h' ? sg.at + k : s;
    if (!inb(x, y) || c.ground[at(x, y)] === G.ROAD) continue;
    if (water(x, y) || (c.flags[at(x, y)] & F_BRIDGE)) { setT(x, y, G.BRIDGE, S.OPEN, F_BRIDGE); continue; }
    setT(x, y, kerbG(x));
  }
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s++) for (let k = 1; k < 3; k++) {
    const x = sg.axis === 'h' ? s : sg.at + k, y = sg.axis === 'h' ? sg.at + k : s;
    if (!inb(x, y)) continue;
    const i = at(x, y); const br = c.ground[i] === G.BRIDGE;
    c.ground[i] = br ? G.BRIDGE : G.ROAD; c.solid[i] = S.OPEN; c.flags[i] = br ? F_BRIDGE : 0;
  }
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s += 2) {
    const x = sg.axis === 'h' ? s : sg.at + 2, y = sg.axis === 'h' ? sg.at + 2 : s;
    if (!inb(x, y) || cross(x, y) || (sg.axis === 'h' ? cross(x, y - 1) : cross(x - 1, y))) continue;
    c.decals.push({ x: sg.axis === 'h' ? x * T + T / 2 : x * T, y: sg.axis === 'h' ? y * T : y * T + T / 2, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: sg.axis === 'h' ? 0 : Math.PI / 2 });
  }
  for (const r of segs) for (const r2 of segs) {
    if (r.axis !== 'h' || r2.axis !== 'v' || r2.at + 3 < r.a || r2.at > r.b || r.at + 3 < r2.a || r.at > r2.b) continue;
    if (r.a <= r2.at - 2) c.decals.push({ x: (r2.at - 0.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r.b >= r2.at + 5) c.decals.push({ x: (r2.at + 4.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r2.a <= r.at - 2) c.decals.push({ x: (r2.at + 2) * T, y: (r.at - 0.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
    if (r2.b >= r.at + 5) c.decals.push({ x: (r2.at + 2) * T, y: (r.at + 4.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
  }
  // Read Bridge and the footbridge by the station: decks for walkers over the river
  for (const bx of [299, 320]) rect(bx, RIVER_Y, 2, 4, G.DECK, S.OPEN, F_BRIDGE);

  // ── Jurong
  // the Science Centre with its dome theatre, the observatory (Dr Suria) and Snow City; Jem across the road
  bld(199, 96, 10, 5, 'jurong-science'); place('science', 204, 102, 'spot', N.science);
  bld(210, 97, 3, 3, 'jurong-obs'); place('observatory', 211, 101, 'spot', N.obs); place('suria', 213, 101, 'contact', 'Dr Suria');
  prop(209, 101, 'telescope', 10, 'tall', 'over', 46); prop(206, 102, 'atom', 12, 'tall', 'over', 70); deco(214, 102, 'rocket', 40);
  bld(215, 96, 8, 5, 'jurong-snow'); place('snowcity', 219, 102, 'spot', N.snow); deco(222, 102, 'snowman', 46);
  bld(229, 96, 10, 5, 'jurong-mall'); place('jem', 234, 102, 'spot', N.mall);
  // Jurong East station on its viaduct, the safe house, the night market by the lake road
  bld(229, 107, 8, 4, 'jurong-stn'); place('stn-jurong', 233, 111, 'station', 'Jurong East station');
  bld(238, 108, 3, 3, 'safe-jurong'); place('safe-jurong', 239, 111, 'safe', 'Jurong Lake safe house');
  for (let k = 0; k < 2; k++) for (const [x, y, sp] of [[229, 119, 'stall-tea'], [233, 119, 'stall-fruit'], [237, 119, 'stall-red']] as const) { c.solid[at(x + k, y)] = S.TALL; if (!k) c.props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: sp, r: 0, solid: 'none', layer: 'over', w: 2.1 * T }); }
  place('mk-jurong', 231, 121, 'market', 'the Jurong Lake night market');
  // Towkay Hoot's lantern warehouse at the south end of the road
  bld(230, 122, 8, 4, 'jurong-factory'); place('warehouse', 237, 121, 'spot', 'Towkay Hoot’s warehouse');
  // the Chinese Garden: the gate on the road, the seven-storey pagoda north of the lake, the Twin Pagodas and the tea
  // house on the west side, stone lions, lanterns, bonsai, willows, koi and terrapins
  bld(218, 108, 4, 2, 'jurong-gate'); place('garden', 220, 111, 'spot', N.garden); place('musang', 217, 111, 'contact', 'Sifu Musang');
  for (const x of [217, 222]) prop(x, 110, 'stone-lion', 12, 'tall', 'over', 44);
  bld(203, 108, 3, 3, 'jurong-pagoda'); place('pagoda', 204, 111, 'spot', N.pagoda);
  bld(200, 122, 6, 3, 'jurong-twin'); place('twin', 203, 121, 'spot', N.twin);
  bld(215, 121, 5, 3, 'jurong-tea'); place('teahouse', 217, 124, 'spot', 'the lakeside tea house');
  place('lawn', 220, 117, 'spot', 'the festival lawn'); place('lake', 214, 112, 'spot', N.lake);
  const lanterns: [number, number][] = [], lotus: [number, number][] = [], koi: [number, number][] = [];
  for (const [x, y, sp] of [[213, 110, 'rabbit-lantern'], [221, 114, 'moon-lantern'], [199, 114, 'rabbit-lantern'], [219, 120, 'rabbit-lantern'], [206, 124, 'moon-lantern']] as const) { prop(x, y, sp, 14, 'tall', 'over', sp === 'moon-lantern' ? 84 : 72); lanterns.push([px(x), px(y)]); }
  for (const [x, y] of [[205, 116], [208, 119], [213, 118], [214, 115], [206, 114], [211, 120]] as const) lotus.push([px(x), px(y)]);
  for (const [x, y] of [[207, 111], [216, 117]] as const) { if (!water(x, y)) koi.push([px(x), px(y)]); }
  for (const [x, y] of [[204, 117], [212, 116]] as const) deco(x, y, 'koi-fish', 60, 'ground');
  for (const [x, y] of [[203, 113], [215, 113]] as const) deco(x, y, 'lotus-patch', 70, 'ground');
  deco(208.5, 111.5, 'red-bridge', 3.4 * T, 'ground');
  for (const [x, y] of [[199, 109], [222, 122], [200, 119], [212, 108]] as const) if (!water(x, y)) prop(x, y, 'willow', 16, 'tall', 'over', 120);
  for (const [x, y] of [[207, 108], [214, 124], [221, 108]] as const) prop(x, y, 'stone-lantern', 8, 'tall', 'over', 34);
  for (const [x, y] of [[201, 112], [218, 113]] as const) prop(x, y, 'bonsai', 10, 'tall', 'over', 44);
  deco(216, 119, 'turtle-rock', 40); prop(211, 123, 'sea-bench', 12, 'tall', 'over', 80);
  const scope: [number, number] = [px(209), px(102)];
  const walk: [[number, number], [number, number]] = [[px(220), px(111)], [px(206), px(111)]];

  // ── Tiong Bahru
  // Tiong Bahru Market (the district's market upstairs and down; Uncle Seng's chwee kueh cart by the door)
  bld(249, 96, 9, 6, 'tiong-market'); place('mk-tiong', 253, 102, 'market', N.market); place('tbmarket', 256, 102, 'spot', N.market);
  prop(260, 100, 'kueh-cart', 16, 'tall', 'over', 72); place('seng', 262, 101, 'contact', 'Uncle Seng'); place('chweekueh', 260, 101, 'spot', 'Uncle Seng’s chwee kueh cart');
  const kueh: [number, number] = [px(260), px(101)];
  // Tiong Bahru station, the fountain square and its cafe tables
  bld(272, 96, 8, 4, 'tiong-stn'); place('stn-tiong', 276, 100, 'station', 'Tiong Bahru station');
  prop(282, 101, 'tb-fountain', 14, 'tall', 'over', 60); deco(271, 102, 'bistro-table', 60); deco(284, 98, 'bistro-table', 60);
  // the bakery and the songbird corner on Seng Poh Road
  bld(249, 107, 6, 4, 'tiong-bakery'); place('bakery', 252, 111, 'spot', N.bakery); deco(256, 112, 'bistro-table', 60); deco(249, 112, 'bistro-table', 60);
  prop(261, 109, 'bird-pole', 12, 'tall', 'over', 96); prop(264, 109, 'bird-pole', 12, 'tall', 'over', 96); place('birdcorner', 262, 111, 'spot', N.birds);
  const birds: [number, number] = [px(262), px(110)];
  prop(258, 108, 'tb-pot', 10, 'tall', 'over', 44);
  // the bookshop, the Monkey God temple, the safe house
  bld(271, 107, 4, 4, 'tiong-books'); place('books', 273, 111, 'spot', 'the Yong Siak Street bookshop'); prop(276, 112, 'book-cart', 12, 'tall', 'over', 60);
  bld(276, 107, 6, 4, 'tiong-temple'); place('monkeygod', 279, 111, 'spot', N.temple);
  bld(283, 108, 3, 3, 'safe-tiong'); place('safe-tiong', 284, 111, 'safe', 'Moh Guan Terrace safe house');
  // the curved flats, the corner kopitiam, courtyards with frangipani and the estate's cats
  bld(249, 118, 8, 4, 'tiong-flats-b'); bld(259, 118, 6, 4, 'tiong-kopi'); place('tbkopi', 262, 122, 'spot', 'the Seng Poh Road kopitiam');
  bld(271, 119, 12, 4, 'tiong-flats-a'); place('flats', 277, 123, 'spot', N.flats);
  for (const [x, y] of [[251, 123], [264, 124], [274, 124], [283, 124], [270, 101]] as const) prop(x, y, 'tb-pot', 10, 'tall', 'over', 44);
  for (const [x, y] of [[254, 124], [280, 118], [265, 100], [258, 113]] as const) deco(x, y, 'tb-cat', 34);

  // ── Clarke Quay
  // the north bank: the painted godowns under the canopy, the busker's stage (Kak Melati), the Slingshot
  bld(291, 96, 12, 4, 'quay-godown-a'); place('godowns', 297, 100, 'spot', `the ${N.quay} godowns`);
  bld(313, 96, 8, 4, 'quay-godown-b'); bld(322, 96, 6, 4, 'quay-bar'); place('quaybar', 325, 100, 'spot', 'the riverside jazz bar');
  const canopy: [number, number][] = [];
  for (const x of [293, 298, 303, 315, 320, 326]) { deco(x, 101, 'q-canopy', 3.4 * T, 'sky'); canopy.push([px(x), px(101)]); }
  prop(296, 101, 'q-stage', 16, 'tall', 'over', 90); place('stage-quay', 296, 102, 'spot', 'the Clarke Quay stage'); place('melati', 298, 101, 'contact', 'Kak Melati');
  const stage: [number, number] = [px(296), px(101)];
  prop(305, 98, 'sling-tower', 22, 'tall', 'over', 150); place('slingshot', 305, 100, 'spot', N.sling);
  const sling: [number, number] = [px(305), px(99)];
  for (const [x, y] of [[301, 101], [318, 101], [324, 101]] as const) prop(x, y, 'barrel-table', 12, 'tall', 'over', 54);
  prop(314, 101, 'satay-grill', 14, 'tall', 'over', 70); prop(328, 101, 'cat-statue', 8, 'tall', 'over', 36);
  place('readbridge', 299, 102, 'spot', N.read);
  // the sixteenth pass: Coach Kerbau on the north bank beside his dragon boat
  place('kerbau', 313, 101, 'contact', 'Coach Kerbau');
  // the south bank: the seafood restaurant, the Old Hill Street Police Station, Clarke Quay station, Clarke Quay Central
  bld(291, 109, 8, 4, 'quay-seafood'); place('seafood-quay', 295, 113, 'spot', N.seafood);
  bld(300, 109, 6, 4, 'quay-police'); place('police', 303, 113, 'spot', N.police);
  bld(313, 109, 8, 4, 'quay-stn'); place('stn-quay', 317, 113, 'station', 'Clarke Quay station');
  bld(322, 109, 6, 4, 'quay-central'); place('central-quay', 325, 113, 'spot', N.central);
  for (const [x, y] of [[293, 107], [305, 107], [316, 107], [326, 107]] as const) prop(x, y, 'barrel-table', 12, 'tall', 'over', 54);
  // south of Eu Tong Sen Street: the safe house, the night market, Towkay Hoot's godown (number nine) and a bar
  bld(291, 119, 3, 3, 'safe-quay'); place('safe-quay', 292, 122, 'safe', 'North Boat Quay safe house');
  for (let k = 0; k < 2; k++) for (const [x, y, sp] of [[296, 120, 'stall-red'], [300, 120, 'stall-tea'], [304, 120, 'stall-fruit']] as const) { c.solid[at(x + k, y)] = S.TALL; if (!k) c.props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: sp, r: 0, solid: 'none', layer: 'over', w: 2.1 * T }); }
  place('mk-quay', 300, 122, 'market', 'the Clarke Quay night market');
  bld(313, 119, 8, 4, 'quay-godown-b'); place('godown9', 317, 123, 'spot', 'Godown No. 9'); bld(322, 120, 6, 4, 'quay-bar');
  // bumboats on the river, one for hire at the steps by Read Bridge
  deco(294, RIVER_Y + 1.5, 'bumboat', 80, 'ground'); deco(325, RIVER_Y + 1.5, 'bumboat', 80, 'ground');
  c.parking.push({ x: px(303), y: px(RIVER_Y), d: 'quay', kind: 'boat', rot: Math.PI / 2 });

  // ── parked rides and street lamps along the new roads, hiding spots
  const bridgeOrRoad = (x: number, y: number) => c.flags[at(x, y)] & F_BRIDGE || c.ground[at(x, y)] === G.ROAD;
  let k = 0;
  for (const sg of segs) for (let s = sg.a + 3; s <= sg.b - 3; s += 11) for (const kk of [0, 3]) {
    const x = sg.axis === 'h' ? s : sg.at + kk, y = sg.axis === 'h' ? sg.at + kk : s;
    if (!inb(x, y) || y < Y0 || c.solid[at(x, y)] !== S.OPEN || bridgeOrRoad(x, y) || cross(x, y)) continue;
    const kind = ++k % 4 === 0 ? 'van' : k % 4 === 2 ? 'tuktuk' : 'scooter';
    c.parking.push({ x: px(x), y: px(y), d: districtAt(x, y), kind, rot: sg.axis === 'h' ? (kk === 0 ? -Math.PI / 2 : Math.PI / 2) : (kk === 0 ? 0 : Math.PI) });
  }
  for (const sg of segs) for (let s = sg.a + 2; s <= sg.b - 2; s += 6) for (const kk of [0, 3]) {
    const x = sg.axis === 'h' ? s : sg.at + kk, y = sg.axis === 'h' ? sg.at + kk : s;
    if (!inb(x, y) || y < Y0 || c.solid[at(x, y)] !== S.OPEN || bridgeOrRoad(x, y) || cross(x, y) || c.parking.some(p => Math.abs(p.x - px(x)) < T && Math.abs(p.y - px(y)) < T)) continue;
    c.props.push({ x: px(x) + (sg.axis === 'v' ? (kk === 0 ? -20 : 20) : 0), y: px(y) + (sg.axis === 'h' ? (kk === 0 ? -20 : 20) : 0), sprite: x >= TIONG_X0 && x < QUAY_X0 ? 'tb-lamp' : 'lamp', r: 8, solid: 'tall', layer: 'over', w: x >= TIONG_X0 && x < QUAY_X0 ? 40 : undefined });
  }
  for (const [x, y] of [[257, 101], [281, 113], [263, 124], [306, 101], [311, 112], [297, 124], [240, 101], [228, 113], [223, 124]] as const) if (c.solid[at(x, y)] === S.OPEN && !bridgeOrRoad(x, y)) { c.hides.push({ x: px(x), y: px(y) }); c.props.push({ x: px(x), y: y * T + 14, sprite: (x + y) % 2 ? 'curtain' : 'basket', r: 0, solid: 'none', layer: 'ground' }); }

  // ── the MRT runs on: Jurong East, Tiong Bahru and Clarke Quay come before Changi Airport on the line (underground,
  // so the trains you see on the viaduct are as they were)
  const isle = c.isle;
  if (isle) {
    const P = (id: string): [number, number] => [c.places[id].x, c.places[id].y];
    const old = isle.line, line: [number, number][] = [P('stn-jurong'), P('stn-tiong'), P('stn-quay'), ...old];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[3];
    const st = (id: string, kk: number): Station => ({ id, name: c.places[id].name!, x: c.places[id].x, y: c.places[id].y, d: c.places[id].d, s: lineLen[kk] });
    isle.stations = [st('stn-jurong', 0), st('stn-tiong', 1), st('stn-quay', 2), ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
    isle.taxiStands.push([px(228), px(103)], [px(268), px(113)], [px(310), px(113)]);
  }
  // ── a gantry at the foot of each bridge; a silver zone by Tiong Bahru Market; bins and pigeons
  if (c.sg) {
    for (const [axis, tx, ty] of [['v', 224, 99], ['v', 244, 99]] as ['h' | 'v', number, number][]) {
      const gx = (tx + 2) * T, gy = px(ty);
      c.sg.gantries.push({ axis, tx, ty, x: gx, y: gy });
      c.props.push({ x: gx, y: gy, sprite: 'gantry', r: 0, solid: 'none', layer: 'sky', w: 4 * T + 36, rot: 0 });
    }
    c.sg.silver.push([248, 100, 265, 103]);
    c.sg.bins.push([px(266), px(102)], [px(307), px(113)], [px(228), px(102)], [px(285), px(113)]);
    c.sg.pigeons.push([px(279), px(101)], [px(309), px(101)]);
  }
  c.south = { canopy, sling, stage, birds, kueh, lake: [LK[0] * T + T / 2, LK[1] * T + T / 2, LK[2] * T, LK[3] * T], koi, scope, lanterns, lotus, walk };
}

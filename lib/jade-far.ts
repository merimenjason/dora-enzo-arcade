// Jade Street: the twelfth pass's three districts. Runs last on the finished city (after Chinatown, the island and the
// ninth pass's districts), so nothing built before moves. Past the Geylang River, east of Little India and Kampong Glam:
// Orchard Road in the north (the malls: ION Orchard, Ngee Ann City with Takashimaya, Paragon, Lucky Plaza, Tangs and
// Orchard Central; Emerald Hill's heritage terraces; the Christmas light-up arching over Orchard Road and a Christmas
// market; in the world its block is moved north-west of Chinatown, past Fort Canning Park: lib/jade-layout.ts), Katong and Joo Chiat in the south (Peranakan terraces, a laksa shop, kueh and songbird cages, Parkway Parade,
// Katong Park station) with East Coast Park along the shore (the red cycling track, the bike hire, the hawker centre,
// the seafood centre, barbecue pits, kites and the beach), and Changi to the east (the airport terminal, the control
// tower, the apron and the runway; Jewel, a glass dome of terraced forest round the Rain Vortex, an indoor waterfall;
// Changi Village with its hawker centre, shophouses and hotel; the ferry terminal for Pulau Ubin and Changi Beach). The
// East Coast Parkway runs along the coast from Katong to Changi. Real place, road, mall and landmark names (owner,
// 16-11); the Atas Bats who roost in East Coast Park are fictional. Pure data: lib/jade-fardraw.ts paints the extras.
import { T, OLD_W as W, OLD_H as H, CT_H, G, S, F_BRIDGE, F_PARK, OLD_ROADS as ROADS, FAR_X0, FAR_SPLIT, CHANGI_X0, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import type { Station } from './jade-island.js';
import { F_XWAY } from './jade-island.js';

export type Far = {
  /** the Christmas light-up: the arches over Orchard Road, the strings of lights along it, the trees you can dress */
  arches: [number, number][]; lights: [number, number][]; trees: [number, number][];
  /** Jewel: the Rain Vortex (world), its pool's radius, and the dome's floor (a tile rect) */
  vortex: [number, number]; pool: number; jewel: [number, number, number, number];
  /** East Coast Park's cycling track (world, west to east), the bike hire racks, where kites fly, the barbecue pits */
  track: [number, number][]; bikes: [number, number][]; kites: [number, number][]; bbq: [number, number][];
  /** where you watch the planes come in, and the planes parked on the apron */
  spots: [number, number][]; planes: [number, number][];
  /** the Atas Bats' roost tree in East Coast Park */
  roost: [number, number];
};
const px = (t: number) => t * T + T / 2;
/** the twelfth pass's real names (owner, 16-11): malls, landmarks, stations; the bats are fictional */
export const FAR_NAMES = {
  ion: 'ION Orchard', ngee: 'Ngee Ann City', taka: 'Takashimaya', lux: 'Paragon', lucky: 'Lucky Plaza', tangs: 'Tangs', central: 'Orchard Central',
  emerald: 'Emerald Hill', laksa: '328 Katong Laksa', mall: 'Parkway Parade', park: 'East Coast Park', hawker: 'East Coast Lagoon Food Village',
  seafood: 'East Coast Seafood Centre', airport: 'Changi Airport', jewel: 'Jewel Changi Airport', vortex: 'the Rain Vortex', village: 'Changi Village',
  ferry: 'Changi Point Ferry Terminal', beach: 'Changi Beach', gang: 'the Atas Bats',
};
/** the three districts' street names run from these road indices in ROADS (lib/jade-city.ts) */
export const FAR_ROADS = [24, 25, 26, 27, 28, 29, 30, 31, 32];

export function far(c: City) {
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
  const water = (x: number, y: number) => { const g = c.ground[at(x, y)]; return g === G.SEA || g === G.BAY || g === G.CANAL || g === G.LAGOON; };
  const N = FAR_NAMES;

  // ── the ground: the Geylang River, then Orchard Road's granite, Katong's tiles, the airport's tarmac and Changi
  // Village's pavers; East Coast Park along the shore (grass, the red cycling track, the beach) and the sea past it
  const X0 = FAR_X0 - 4, PARK = 76, TRACK = 81, SAND = 84, SEA = 89;
  rect(X0, 0, W - X0, CT_H, G.SEA, S.WATER);
  rect(FAR_X0, 0, CHANGI_X0 - FAR_X0, FAR_SPLIT, G.ORCHARD);
  rect(FAR_X0, FAR_SPLIT, CHANGI_X0 - FAR_X0, PARK - FAR_SPLIT, G.KATONG);
  rect(CHANGI_X0, 0, W - CHANGI_X0, 46, G.TARMAC);
  rect(CHANGI_X0, 46, W - CHANGI_X0, PARK - 46, G.CHANGI);
  rect(X0, 0, 4, SEA, G.CANAL, S.WATER);
  rect(FAR_X0, PARK, W - FAR_X0, TRACK - PARK, G.GRASS, S.OPEN, F_PARK);
  rect(FAR_X0, TRACK + 2, W - FAR_X0, SAND - TRACK - 2, G.GRASS, S.OPEN, F_PARK);
  rect(FAR_X0, SAND, W - FAR_X0, SEA - SAND, G.SAND);
  rect(W - 3, 0, 3, PARK, G.GRASS, S.OPEN, F_PARK);
  // the cycling track runs the whole shore, over the river mouth on a little bridge
  for (let x = X0; x < W; x++) for (const y of [TRACK, TRACK + 1]) { const br = x < FAR_X0 && water(x, y); setT(x, y, br ? G.DECK : G.CYCLE, S.OPEN, br ? F_BRIDGE : F_PARK); }

  // ── roads: kerbs in the district's own paving, two lanes, bridges over the river; the parkway's verges are grass
  type Seg = { axis: 'h' | 'v'; at: number; a: number; b: number; xw: boolean };
  const segs: Seg[] = FAR_ROADS.map(i => { const r = ROADS[i]; return { axis: r.axis, at: r.at, a: r.from, b: r.to, xw: i === 32 }; });
  const kerbG = (x: number, y: number) => x >= CHANGI_X0 ? (y < 46 ? G.TARMAC : G.CHANGI) : y < FAR_SPLIT ? G.ORCHARD : G.KATONG;
  const cross = (x: number, y: number) => { let h = false, v = false; for (const r of ROADS) { if (r.axis === 'h' && y >= r.at && y <= r.at + 3 && x >= r.from && x <= r.to) h = true; if (r.axis === 'v' && x >= r.at && x <= r.at + 3 && y >= r.from && y <= r.to) v = true; } return h && v; };
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s++) for (let k = 0; k < 4; k++) {
    const x = sg.axis === 'h' ? s : sg.at + k, y = sg.axis === 'h' ? sg.at + k : s;
    if (!inb(x, y) || c.ground[at(x, y)] === G.ROAD) continue;
    if (water(x, y) || (c.flags[at(x, y)] & F_BRIDGE)) { setT(x, y, G.BRIDGE, S.OPEN, F_BRIDGE); continue; }
    setT(x, y, sg.xw ? G.GRASS : kerbG(x, y));
  }
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s++) for (let k = 1; k < 3; k++) {
    const x = sg.axis === 'h' ? s : sg.at + k, y = sg.axis === 'h' ? sg.at + k : s;
    if (!inb(x, y)) continue;
    const i = at(x, y); const br = c.ground[i] === G.BRIDGE;
    c.ground[i] = br ? G.BRIDGE : G.ROAD; c.solid[i] = S.OPEN; c.flags[i] = (br ? F_BRIDGE : 0) | (sg.xw ? F_XWAY : 0);
  }
  // the parkway's crash barriers (a gap at every junction), lane dashes, zebra crossings (none on the parkway)
  for (const sg of segs) if (sg.xw) for (let s = sg.a + 1; s < sg.b; s++) for (const k of [0, 3]) {
    const x = s, y = sg.at + k, t = at(x, y);
    if (c.ground[t] !== G.GRASS || cross(x, y) || ROADS.some(o => o.axis === 'v' && x >= o.at - 2 && x <= o.at + 5 && sg.at + 3 >= o.from && sg.at <= o.to)) continue;
    c.solid[t] = S.LOW; if (s % 2 === 0) c.props.push({ x: px(x), y: px(y), sprite: 'xw-barrier', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
  }
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s += 2) {
    const x = sg.axis === 'h' ? s : sg.at + 2, y = sg.axis === 'h' ? sg.at + 2 : s;
    if (!inb(x, y) || cross(x, y) || (sg.axis === 'h' ? cross(x, y - 1) : cross(x - 1, y))) continue;
    c.decals.push({ x: sg.axis === 'h' ? x * T + T / 2 : x * T, y: sg.axis === 'h' ? y * T : y * T + T / 2, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: sg.axis === 'h' ? 0 : Math.PI / 2 });
  }
  for (const r of segs) for (const r2 of segs) {
    if (r.axis !== 'h' || r2.axis !== 'v' || r.xw || r2.at + 3 < r.a || r2.at > r.b || r.at + 3 < r2.a || r.at > r2.b) continue;
    if (r.a <= r2.at - 2) c.decals.push({ x: (r2.at - 0.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r.b >= r2.at + 5) c.decals.push({ x: (r2.at + 4.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r2.a <= r.at - 2) c.decals.push({ x: (r2.at + 2) * T, y: (r.at - 0.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
    if (r2.b >= r.at + 5) c.decals.push({ x: (r2.at + 2) * T, y: (r.at + 4.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
  }

  // ── Orchard Road
  // Emerald Hill: the heritage terraces, a terrace turned bar, a shophouse café
  bld(277, 1, 9, 3, 'orchard-emerald'); bld(277, 6, 5, 3, 'orchard-bar'); bld(284, 6, 4, 4, 'orchard-cafe');
  prop(286, 2, 'bougain', 16, 'tall', 'over', 60); place('emerald', 281, 4, 'spot', N.emerald);
  // ION Orchard and its plaza (Ms Tiara runs the light-up from here), Ngee Ann City with Takashimaya
  bld(295, 1, 12, 6, 'orchard-ion'); place('ion', 300, 8, 'spot', N.ion); place('tiara', 303, 9, 'contact', 'Ms Tiara');
  bld(314, 1, 10, 6, 'orchard-ngee'); place('takashimaya', 318, 8, 'spot', `${N.ngee} (${N.taka})`);
  // the hotel, the safe house off Cairnhill, Lucky Plaza and Paragon, Orchard station
  bld(277, 16, 4, 4, 'orchard-hotel'); bld(283, 17, 3, 3, 'safe-orchard'); place('safe-orchard', 284, 20, 'safe', 'Cairnhill safe house');
  bld(295, 16, 6, 4, 'orchard-lucky'); bld(302, 16, 6, 4, 'orchard-lux');
  place('lucky', 297, 21, 'spot', N.lucky); place('paragon', 305, 21, 'spot', N.lux);
  bld(315, 16, 8, 4, 'orchard-stn'); place('stn-orchard', 319, 20, 'station', 'Orchard station');
  // south of Orchard Road: the Christmas market (the district's market), Tangs, Orchard Central, a café and a hotel
  bld(277, 27, 8, 4, 'orchard-xmas'); place('mk-orchard', 281, 32, 'market', 'the Orchard Road Christmas market');
  bld(286, 27, 4, 4, 'orchard-cafe');
  bld(295, 27, 5, 5, 'orchard-tangs'); place('tangs', 297, 33, 'spot', N.tangs);
  bld(302, 27, 6, 4, 'orchard-glass'); place('central', 305, 32, 'spot', N.central);
  bld(315, 27, 4, 4, 'orchard-hotel'); bld(320, 28, 4, 3, 'orchard-bar');
  // the Christmas light-up: arches over Orchard Road, strings of lights along both pavements, trees on the plazas
  const arches: [number, number][] = [], lights: [number, number][] = [], trees: [number, number][] = [];
  for (const x of [281, 300, 318]) { deco(x, 24, 'xmas-arch', 5.5 * T, 'sky'); arches.push([px(x), px(24)]); }
  for (let x = 277; x <= 322; x += 3) for (const y of [21, 26]) if (c.solid[at(x, y)] === S.OPEN && c.ground[at(x, y)] !== G.ROAD) lights.push([px(x), px(y)]);
  for (const [x, y] of [[297, 9], [307, 9], [289, 31], [309, 33], [313, 9]] as const) { prop(x, y, 'xmas-tree', 20, 'tall', 'over', 110); trees.push([px(x), px(y)]); }
  deco(299, 10, 'gifts', 70); deco(311, 9, 'glass-tree', 96); deco(287, 21, 'reindeer', 80); deco(292, 34, 'gift-lights', 70); deco(312, 34, 'reindeer', 80);
  prop(283, 33, 'kamcheng', 14, 'tall', 'over', 40);

  // ── Katong and Joo Chiat
  bld(277, 40, 9, 3, 'katong-terrace-a'); bld(295, 39, 8, 4, 'katong-shops'); bld(304, 39, 4, 4, 'katong-corner');
  bld(315, 39, 6, 4, 'katong-mansion'); place('mansion', 318, 44, 'spot', 'the Peranakan mansion');
  place('joochiat', 300, 44, 'spot', 'Joo Chiat Road shophouses');
  // the laksa shop (Nyonya Rosie's corner), the safe house, a terrace row
  bld(277, 51, 3, 3, 'safe-katong'); place('safe-katong', 278, 54, 'safe', 'Joo Chiat safe house');
  bld(281, 50, 6, 4, 'katong-laksa'); place('laksa', 284, 55, 'spot', N.laksa); place('rosie', 286, 55, 'contact', 'Nyonya Rosie');
  prop(281, 55, 'laksa-cart', 18, 'tall', 'over', 72);
  bld(279, 57, 8, 4, 'katong-terrace-b');
  // Katong Park station, kueh and songbird cages on the square, Parkway Parade
  bld(296, 50, 8, 4, 'katong-stn'); place('stn-katong', 300, 54, 'station', 'Katong Park station');
  prop(305, 52, 'kueh-stall', 18, 'tall', 'over', 76); prop(297, 58, 'bird-cages', 14, 'tall', 'over', 84); prop(306, 58, 'kamcheng', 14, 'tall', 'over', 40);
  place('birds', 297, 59, 'spot', 'the songbird corner');
  bld(314, 50, 10, 5, 'katong-mall'); place('parkway', 318, 56, 'spot', N.mall);
  // the Joo Chiat market (stalls under awnings), a terrace row, Marine Parade's shophouses
  for (let k = 0; k < 2; k++) for (const [x, y, sp] of [[279, 67, 'stall-fruit'], [283, 67, 'stall-tea'], [279, 70, 'kueh-stall']] as const) { c.solid[at(x + k, y)] = S.TALL; if (!k) c.props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: sp, r: 0, solid: 'none', layer: 'over', w: 2.1 * T }); }
  place('mk-katong', 282, 69, 'market', 'Joo Chiat market');
  bld(296, 67, 9, 3, 'katong-terrace-a'); bld(315, 66, 8, 4, 'katong-shops');
  // East Coast Park: the bike hire (Uncle Bala), the hawker centre, the seafood centre, the pavilion, barbecue pits
  bld(279, 76, 5, 3, 'katong-bike'); place('bikehire', 282, 80, 'spot', 'the East Coast Park bike hire'); place('bala', 285, 80, 'contact', 'Uncle Bala');
  prop(287, 77, 'bike-rack', 16, 'tall', 'over', 84);
  bld(294, 76, 10, 4, 'katong-hawker'); place('hawker-ecp', 299, 80, 'spot', N.hawker);
  bld(305, 77, 5, 3, 'katong-pavilion'); bld(312, 76, 8, 4, 'katong-seafood'); place('seafood', 316, 80, 'spot', N.seafood);
  const bbq: [number, number][] = [];
  for (const x of [290, 309, 330]) { prop(x, 83, 'bbq-pit', 16, 'tall', 'over', 60); bbq.push([px(x), px(83)]); }
  place('ecp', 300, 86, 'spot', N.park);
  // the Atas Bats' roost: a huge old tree in the park, hung with bats and stolen shopping bags
  // (back from the promenade and the cycling track, so nobody rides into Datin Ciku)
  prop(322, 77, 'hide-bat', 34, 'tall', 'over', 160); place('roost-bat', 322, 79, 'spot', 'the Atas Bats’ roost'); place('ciku', 325, 78, 'contact', 'Datin Ciku');
  const roost: [number, number] = [px(322), px(77)];

  // ── Changi
  // the airport: Terminal 1, the control tower, the apron with parked airliners and a baggage tug, the cargo hangar
  bld(325, 1, 12, 5, 'changi-terminal'); place('terminal', 330, 7, 'spot', `${N.airport} Terminal 1`);
  bld(339, 1, 4, 4, 'changi-tower'); place('tower', 341, 6, 'spot', 'the control tower');
  const planes: [number, number][] = [];
  for (const x of [348, 357]) { prop(x, 5, 'plane-parked', 70, 'tall', 'over', 4.6 * T); for (const dx of [-1, 1]) for (const dy of [-1, 0, 1]) if (inb(x + dx, 5 + dy)) c.solid[at(x + dx, 5 + dy)] = S.TALL; planes.push([px(x), px(5)]); }
  deco(352, 10, 'baggage-tug', 120); bld(365, 1, 9, 6, 'changi-hangar');
  // Jewel: a glass dome of terraced forest round the Rain Vortex, open on three sides
  const J: [number, number, number, number] = [325, 17, 338, 44];
  rect(J[0], J[1], J[2] - J[0] + 1, J[3] - J[1] + 1, G.JEWEL);
  const vortex: [number, number] = [331.5 * T + T / 2, 30 * T + T / 2], pool = 2.6 * T;
  for (let y = J[1]; y <= J[3]; y++) for (let x = J[0]; x <= J[2]; x++) if (Math.hypot(px(x) - vortex[0], px(y) - vortex[1]) < pool) c.solid[at(x, y)] = S.TALL;
  c.props.push({ x: vortex[0], y: vortex[1] + 20, sprite: 'vortex', r: 0, solid: 'none', layer: 'over', w: 7 * T });
  for (const [x, y] of [[326, 19], [337, 19], [326, 42], [337, 42]] as const) prop(x, y, 'forest-terrace', 30, 'tall', 'over', 150);
  for (const [x, y] of [[328, 24], [335, 24], [328, 37], [335, 37]] as const) prop(x, y, 'forest-planter', 20, 'tall', 'over', 90);
  deco(331, 21, 'canopy-bridge', 6 * T, 'sky');
  // the glass walls round the dome (gaps for the doors: north, east and south)
  const wall = (x: number, y: number, rot: number) => { c.props.push({ x: px(x) + (rot ? 0 : T / 2), y: px(y) + (rot ? T / 2 : 0), sprite: 'glass-wall', r: 0, solid: 'none', layer: 'over', w: 2.2 * T, rot }); c.solid[at(x, y)] = S.TALL; c.solid[at(x + (rot ? 0 : 1), y + (rot ? 1 : 0))] = S.TALL; };
  for (let x = J[0]; x < J[2]; x += 2) for (const y of [J[1], J[3]]) if (x + 1 < 329 || x > 333) wall(x, y, 0);
  for (let y = J[1] + 2; y < J[3] - 1; y += 2) for (const x of [J[0], J[2]]) if (x === J[0] || y + 1 < 28 || y > 33) wall(x, y, Math.PI / 2);
  place('jewel', 331, 36, 'spot', N.jewel); place('vortex', 331, 34, 'spot', N.vortex);
  // Changi Airport station, the baggage hall (Captain Faiz), trolleys and suitcases; the viewing spot by the runway
  bld(346, 16, 8, 4, 'changi-stn'); place('stn-changi', 350, 20, 'station', 'Changi Airport station');
  place('faiz', 353, 22, 'contact', 'Captain Faiz'); place('baggage', 350, 30, 'spot', 'the baggage hall');
  for (const [x, y] of [[346, 26], [355, 27], [348, 34]] as const) prop(x, y, 'trolley', 14, 'tall', 'over', 60);
  for (const [x, y] of [[352, 25], [345, 31], [357, 33]] as const) prop(x, y, 'suitcase', 10, 'tall', 'over', 36);
  deco(351, 40, 'baggage-tug', 120); prop(357, 42, 'sea-bench', 14, 'tall', 'over', 80);
  // the runway: lights in rows, the windsock, an airliner waiting to taxi; the viewing spots
  for (let y = 18; y <= 44; y += 3) for (const x of [366, 373]) prop(x, y, 'runway-light', 6, 'none', 'ground', 30);
  prop(369, 17, 'windsock', 10, 'tall', 'over', 70);
  prop(369, 30, 'plane-parked', 70, 'tall', 'over', 4.6 * T); for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) c.solid[at(369 + dx, 30 + dy)] = S.TALL; planes.push([px(369), px(30)]);
  place('runway', 365, 38, 'spot', 'the runway');
  const spots: [number, number][] = [[px(362), px(38)], [px(362), px(22)], [px(335), px(84)]];
  // Changi Village: the shophouses, the safe house, the hawker centre, the hotel, the market
  bld(325, 50, 8, 4, 'changi-shops'); bld(335, 51, 3, 3, 'safe-changi'); place('safe-changi', 336, 54, 'safe', 'Changi Village safe house');
  bld(346, 50, 10, 5, 'changi-hawker'); place('hawker-cv', 351, 56, 'spot', `the ${N.village} Hawker Centre`);
  prop(357, 57, 'nasi-lemak', 10, 'none', 'over', 40);
  bld(365, 50, 6, 4, 'changi-hotel'); place('cvhotel', 368, 55, 'spot', `the ${N.village} Hotel`);
  for (let k = 0; k < 2; k++) for (const [x, y, sp] of [[326, 67, 'stall-fruit'], [330, 67, 'stall-red'], [334, 67, 'stall-tea']] as const) { c.solid[at(x + k, y)] = S.TALL; if (!k) c.props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: sp, r: 0, solid: 'none', layer: 'over', w: 2.1 * T }); }
  prop(337, 69, 'ciku-basket', 12, 'tall', 'over', 44); place('mk-changi', 330, 69, 'market', `the ${N.village} market`);
  bld(346, 66, 8, 4, 'changi-shops'); bld(365, 66, 6, 4, 'changi-hotel');
  place('village', 351, 61, 'spot', N.village);
  // the ferry terminal for Pulau Ubin (Pak Ubin's bumboats) and its jetty, Changi Beach
  bld(364, 76, 6, 3, 'changi-ferry'); rect(366, TRACK + 2, 2, SEA - TRACK, G.DECK, S.OPEN, F_BRIDGE);
  place('ferry-cv', 367, 80, 'spot', N.ferry); place('ubin', 362, 80, 'contact', 'Pak Ubin');
  place('changi-beach', 350, 86, 'spot', N.beach);
  c.parking.push({ x: px(368), y: px(SEA + 1), d: 'changi', kind: 'boat', rot: Math.PI / 2 });

  // ── the shore: casuarinas and sea almonds, benches, kites over the sand, the bike racks along the track
  const kites: [number, number][] = [], bikes: [number, number][] = [[px(287), px(79)]];
  for (let x = 278; x <= 370; x += 7) if (c.solid[at(x, TRACK + 2)] === S.OPEN && Math.abs(x - 321) > 2 && Math.abs(x - 366) > 2) prop(x, TRACK + 2, x % 2 ? 'casuarina' : 'tree-round', 18, 'tall', 'over', x % 2 ? 110 : undefined);
  for (const x of [296, 340, 356]) prop(x, SAND, 'sea-bench', 12, 'tall', 'over', 80);
  for (const x of [284, 313, 347]) { kites.push([px(x), px(SAND + 2)]); deco(x, SAND - 1, 'kite', 56, 'sky'); }
  for (const x of [302, 346]) { prop(x, TRACK - 1, 'bike-rack', 16, 'tall', 'over', 84); bikes.push([px(x), px(TRACK - 1)]); }
  // a hired bike waits by each rack, pointing along the track
  for (const [bx, by] of bikes) c.parking.push({ x: bx + T * 1.5, y: by + T, d: districtAt(Math.floor(bx / T), Math.floor(by / T)), kind: 'bike', rot: 0 });
  for (let x = 280; x <= 368; x += 12) if (c.solid[at(x, SAND + 3)] === S.OPEN) { prop(x, SAND + 3, 'beach-umbrella', 12, 'tall', 'over', 76); }
  const track: [number, number][] = [[px(X0), px(TRACK) + T / 2], [px(W - 2), px(TRACK) + T / 2]];

  // ── parked rides and street lamps along the new roads, hiding spots, the bins and the pigeons
  const bridgeOrRoad = (x: number, y: number) => c.flags[at(x, y)] & F_BRIDGE || c.ground[at(x, y)] === G.ROAD;
  let k = 0;
  for (const sg of segs) if (!sg.xw) for (let s = sg.a + 3; s <= sg.b - 3; s += 11) for (const kk of [0, 3]) {
    const x = sg.axis === 'h' ? s : sg.at + kk, y = sg.axis === 'h' ? sg.at + kk : s;
    if (!inb(x, y) || c.solid[at(x, y)] !== S.OPEN || bridgeOrRoad(x, y) || cross(x, y)) continue;
    const kind = ++k % 4 === 0 ? 'van' : k % 4 === 2 ? 'tuktuk' : 'scooter';
    c.parking.push({ x: px(x), y: px(y), d: districtAt(x, y), kind, rot: sg.axis === 'h' ? (kk === 0 ? -Math.PI / 2 : Math.PI / 2) : (kk === 0 ? 0 : Math.PI) });
  }
  for (const sg of segs) if (!sg.xw) for (let s = sg.a + 2; s <= sg.b - 2; s += 6) for (const kk of [0, 3]) {
    const x = sg.axis === 'h' ? s : sg.at + kk, y = sg.axis === 'h' ? sg.at + kk : s;
    if (!inb(x, y) || c.solid[at(x, y)] !== S.OPEN || bridgeOrRoad(x, y) || cross(x, y) || c.parking.some(p => Math.abs(p.x - px(x)) < T && Math.abs(p.y - px(y)) < T)) continue;
    c.props.push({ x: px(x) + (sg.axis === 'v' ? (kk === 0 ? -20 : 20) : 0), y: px(y) + (sg.axis === 'h' ? (kk === 0 ? -20 : 20) : 0), sprite: x >= CHANGI_X0 ? 'prom-lamp' : 'lamp', r: 8, solid: 'tall', layer: 'over', w: x >= CHANGI_X0 ? 54 : undefined });
  }
  for (const [x, y] of [[288, 9], [309, 31], [288, 59], [308, 70], [341, 58], [362, 68]] as const) if (c.solid[at(x, y)] === S.OPEN && !bridgeOrRoad(x, y)) { c.hides.push({ x: px(x), y: px(y) }); c.props.push({ x: px(x), y: y * T + 14, sprite: (x + y) % 2 ? 'curtain' : 'basket', r: 0, solid: 'none', layer: 'ground' }); }
  for (const [x, y] of [[287, 44], [308, 61], [323, 70], [338, 61]] as const) prop(x, y, 'bougain', 16, 'tall', 'over', 60);
  for (const [x, y] of [[307, 37], [288, 51]] as const) prop(x, y, 'shop-bags', 0, 'none', 'over', 50);

  // ── the MRT runs on: Changi Airport, Katong Park and Orchard come before Beach station on the line (underground, so
  // the trains you see on the viaduct and the race to Toa Payoh are as they were)
  const isle = c.isle;
  if (isle) {
    const P = (id: string): [number, number] => [c.places[id].x, c.places[id].y];
    const old = isle.line, line: [number, number][] = [P('stn-changi'), P('stn-katong'), P('stn-orchard'), ...old];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[3];
    const st = (id: string, kk: number): Station => ({ id, name: c.places[id].name!, x: c.places[id].x, y: c.places[id].y, d: c.places[id].d, s: lineLen[kk] });
    isle.stations = [st('stn-changi', 0), st('stn-katong', 1), st('stn-orchard', 2), ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
    isle.taxiStands.push([px(308), px(21)], [px(304), px(55)], [px(344), px(21)], [px(343), px(60)]);
    isle.hideouts.bat = roost;
  }

  // ── gantries just past the bridges over the Geylang River and on the parkway; silver zones by the markets; bins, pigeons
  if (c.sg) {
    for (const [axis, tx, ty] of [['h', 279, 12], ['h', 279, 46], ['h', 300, 72], ['h', 350, 72]] as ['h' | 'v', number, number][]) {
      let lo = 1e9, hi = -1;
      for (let kk = -3; kk <= 7; kk++) { const x = axis === 'h' ? tx : tx + kk, y = axis === 'h' ? ty + kk : ty; if (c.ground[at(x, y)] === G.ROAD || c.ground[at(x, y)] === G.BRIDGE) { lo = Math.min(lo, kk); hi = Math.max(hi, kk); } }
      if (hi < 0) { lo = 0; hi = 3; }
      const mid = ((axis === 'h' ? ty : tx) + (lo + hi + 1) / 2) * T, sp = (hi - lo + 1) * T + 36;
      const gx = axis === 'h' ? px(tx) : mid, gy = axis === 'h' ? mid : px(ty);
      c.sg.gantries.push({ axis, tx, ty, x: gx, y: gy });
      c.props.push({ x: gx, y: gy, sprite: 'gantry', r: 0, solid: 'none', layer: 'sky', w: sp, rot: axis === 'h' ? Math.PI / 2 : 0 });
    }
    c.sg.silver.push([277, 64, 289, 71], [324, 64, 339, 71]);
    c.sg.bins.push([px(288), px(33)], [px(306), px(60)], [px(345), px(57)], [px(300), px(83)]);
    c.sg.pigeons.push([px(300), px(10)], [px(352), px(62)]);
  }
  c.far = { arches, lights, trees, vortex, pool, jewel: J, track, bikes, kites, bbq, spots, planes, roost };
}

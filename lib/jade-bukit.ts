// Jade Street: the twenty-second pass's district, Bukit Timah and the Botanic Gardens. Runs last on the finished city
// (after the Southern Islands), so nothing built before moves. Built in the build frame's extra rows east of the islands
// (lib/jade-layout.ts BKT), its own block, which the layout table sets down in the parkland west of Tiong Bahru and south
// of Jurong (in Singapore the hill is north-west of Tiong Bahru; on this squeezed map it is due west, where the old
// railway ran in from the north). 40 tiles wide and 28 deep.
// Along the north edge the green Rail Corridor, where the old railway used to run: the old Bukit Timah railway station
// (Pak Tenggiling, its retired stationmaster), the old Dairy Farm's sheds and the steel truss bridge over the road from
// Jurong. Upper Bukit Timah Road runs across under it, on into Tiong Bahru's road. South of the road and west, the Bukit
// Timah Nature Reserve: the visitor centre and trailhead shop (Puan Lotong, the ranger), Beauty World station, the
// summit trail winding up through the rainforest past two rest shelters to the summit (163 m, the island's highest
// point) and its old survey pillar, Hindhede quarry's still lake, and a black-and-white bungalow (the safe house). East,
// over the road from Jurong, the Singapore Botanic Gardens: the old herbarium and library (Dr Merbah), the bandstand,
// Cluny Road and the Gardens gate, Botanic Gardens station, the orchid garden and Swan Lake. The Bukit Bunch, Big Kow's
// long-tailed macaques, hang about the trail and the corridor and snatch whatever is not zipped shut.
// Real place and road names; the people are invented. Pure data: lib/jade-bukitfest.ts holds the things to do,
// lib/jade-summit.ts the summit trail step and lib/jade-bukitdraw.ts the moving parts.
import type { Station } from './jade-island.js';
import { T, OLD_W as W, G, S, F_PARK, BKT_X0, BKT_Y0, BKT_W, BKT_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';

export type Bukit = {
  /** the summit trail's markers (world), trailhead to summit: a summit step's route */
  trail: [number, number][];
  /** the rest shelters on the trail (world): standing still under one gets your breath back fast */
  shelters: [number, number][];
  /** the summit (world: the survey pillar beside it), Swan Lake's middle and its swans' beats, Hindhede quarry's lake */
  summit: [number, number]; lake: [number, number]; swans: [number, number][]; quarry: [number, number];
  /** where the Bukit Bunch hang about in free roam (world): a macaque sits at each, and scampers off when you come near */
  haunts: [number, number][];
  /** the truss bridge over the road from Jurong (world) and the Rail Corridor's two ends */
  bridge: [number, number]; rail: [[number, number], [number, number]];
  /** the district's parked rides (bikes on the corridor, a scooter at Beauty World): appended to the city's parking
   * after every older ride (lib/jade-city.ts), so the older rides keep their ids and seeded paint */
  park: { x: number; y: number; d: 'bukit'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** a Bukit Timah tile (local column and row) in the old (build) frame */
export const bktOld = (lx: number, ly: number): [number, number] => [BKT_X0 + lx, BKT_Y0 + ly];
/** the real names; the stationmaster, the ranger, the herbarium keeper and the macaques are fictional */
export const BUKIT_NAMES = {
  hill: 'Bukit Timah Hill', reserve: 'the Bukit Timah Nature Reserve', summit: 'the summit of Bukit Timah Hill', trail: 'the summit trail',
  centre: 'the visitor centre', shop: 'the trailhead shop', trig: 'the 1937 survey pillar', quarry: 'Hindhede quarry', dairy: 'the old Dairy Farm',
  corridor: 'the Rail Corridor', station: 'the old Bukit Timah railway station', bridge: 'the Bukit Timah truss bridge', road: 'Upper Bukit Timah Road',
  gardens: 'the Singapore Botanic Gardens', herbarium: 'the herbarium and library', bandstand: 'the bandstand', swan: 'Swan Lake',
  orchid: 'the National Orchid Garden', gate: 'the Gardens gate on Cluny Road', cluny: 'Cluny Road', beauty: 'Beauty World station', botanic: 'Botanic Gardens station',
  bunch: 'the Bukit Bunch',
};
/** the summit trail (local tiles), trailhead to summit: root-laced earth up through the forest */
export const TRAIL22: [number, number][] = [[12, 12], [12, 15], [8, 16], [4, 17], [3, 20], [7, 21], [11, 22], [14, 24], [10, 26], [5, 26], [3, 24]];
/** the rest shelters' benches (local tiles, each beside the trail) */
export const SHELTERS22: [number, number][] = [[7, 16], [13, 24]];

export function bukit(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const inB = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < BKT_W && ly < BKT_H;
  const O = bktOld;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { if (!inB(lx, ly)) return; const [x, y] = O(lx, ly); const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const gr = (lx: number, ly: number) => { if (!inB(lx, ly)) return G.SEA; const [x, y] = O(lx, ly); return c.ground[at(x, y)]; };
  const open = (lx: number, ly: number) => { if (!inB(lx, ly)) return false; const [x, y] = O(lx, ly); return c.solid[at(x, y)] === S.OPEN; };
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
  const N = BUKIT_NAMES;
  const line = (pts: [number, number][], f: (lx: number, ly: number) => void) => {
    for (let k = 1; k < pts.length; k++) { const [ax, ay] = pts[k - 1], [bx, by] = pts[k], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let s = 0; s <= n; s++) f(Math.round(ax + (bx - ax) * s / n), Math.round(ay + (by - ay) * s / n)); }
  };

  // ── the ground: the reserve's forest floor (park grass) everywhere to start with, the Gardens' lawns east of the road
  // from Jurong, the Rail Corridor's gravel along the north edge
  rect(0, 0, BKT_W, BKT_H, G.GRASS, S.OPEN, F_PARK);
  rect(30, 11, BKT_W - 30, BKT_H - 11, G.LAWN, S.OPEN, F_PARK);
  rect(0, 3, BKT_W, 2, G.RAILBED);
  // the summit trail, root-laced earth (two tiles wide where it doubles back, so it reads as a path)
  line(TRAIL22, (lx, ly) => { setT(lx, ly, G.SUMMIT); });
  rect(1, 23, 4, 3, G.SUMMIT);
  // Hindhede quarry's still lake (water), Swan Lake (water)
  rect(18, 13, 6, 4, G.SWAN, S.WATER); rect(19, 17, 4, 1, G.SWAN, S.WATER);
  rect(33, 23, 6, 4, G.SWAN, S.WATER); rect(34, 27, 4, 1, G.SWAN, S.WATER);

  // ── the roads: Upper Bukit Timah Road across the middle (on into Tiong Bahru's road at the east edge), the road from
  // Jurong down the middle under the truss bridge, Cluny Road east past the Gardens gate (on into Tiong Bahru's south
  // road); pavement kerbs, then the lanes over them
  const road = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [0, 3]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; if (gr(x, y) !== G.ROAD) setT(x, y, G.WALK); }
  };
  const lanes = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [1, 2]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; setT(x, y, G.ROAD); }
  };
  const RD: ['h' | 'v', number, number, number][] = [['h', 7, 0, 39], ['v', 26, 0, 21], ['h', 18, 26, 39]];
  for (const r of RD) road(...r);
  for (const r of RD) lanes(...r);
  const isRoad = (lx: number, ly: number) => inB(lx, ly) && gr(lx, ly) === G.ROAD;
  const cross = (lx: number, ly: number) => isRoad(lx, ly) && isRoad(lx - 1, ly) && isRoad(lx + 1, ly) && (isRoad(lx, ly - 1) || isRoad(lx, ly + 1));
  for (const [axis, a, from, to] of RD) for (let s = from; s <= to; s += 2) {
    const [lx, ly] = axis === 'h' ? [s, a + 2] : [a + 2, s];
    if (cross(lx, ly) || (axis === 'h' ? cross(lx, ly - 1) : cross(lx - 1, ly))) continue;
    const [wx, wy] = P(lx, ly);
    c.decals.push({ x: axis === 'h' ? wx : wx - T / 2, y: axis === 'h' ? wy - T / 2 : wy, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: axis === 'h' ? 0 : Math.PI / 2 });
  }
  for (const [lx, ly] of [[3, 7], [15, 7], [22, 10], [33, 7], [26, 14], [29, 3], [33, 21], [38, 18]] as const) if (open(lx, ly) && gr(lx, ly) !== G.ROAD) prop(lx, ly, 'lamp', 8, 'tall');

  // ── the Rail Corridor: the old Bukit Timah railway station (Pak Tenggiling), the old Dairy Farm's sheds, the truss
  // bridge carrying the corridor over the road from Jurong (a deck over the road: cars pass under it)
  bld(14, 0, 6, 3, 'bkt-station'); place('bkt-station', 17, 3, 'spot', N.station); place('tenggiling', 13, 4, 'contact', 'Pak Tenggiling');
  for (const lx of [15.5, 18.5]) deco(lx, 3.6, 'bkt-track', 120, 'ground');
  prop(21, 2, 'bkt-signal', 12, 'tall', 'over', 44);
  bld(1, 0, 6, 2, 'bkt-dairy'); place('dairy', 4, 2, 'spot', N.dairy);
  deco(27.5, 3.5, 'bkt-bridge', 6.2 * T, 'sky');
  const bridge = P(27.5, 3.5);
  place('corridor', 9, 4, 'spot', N.corridor); place('truss', 24, 4, 'spot', N.bridge);
  // ── the reserve: the visitor centre's trailhead (Puan Lotong, the trailhead shop), Beauty World station, the trail up
  // past the shelters to the summit and its survey pillar, Hindhede quarry, the bungalow safe house
  bld(7, 11, 3, 2, 'bkt-shelter'); place('lotong', 11, 13, 'contact', 'Puan Lotong'); place('bkt-centre', 12, 12, 'spot', N.centre);
  place('mk-bukit', 8, 13, 'market', 'the trailhead shop');
  bld(1, 11, 4, 3, 'bkt-stn-beauty'); place('stn-beauty', 3, 14, 'station', N.beauty);
  bld(6, 14, 3, 2, 'bkt-shelter'); bld(14, 22, 3, 2, 'bkt-shelter');
  prop(4.6, 16.4, 'bkt-signpost', 10, 'tall', 'over', 46);
  prop(2, 23, 'bkt-trig', 12, 'tall', 'over', 50); prop(4, 23, 'bkt-summit', 12, 'tall', 'over', 64);
  place('bt-summit', 3, 24, 'spot', N.summit); place('bt-trig', 2, 24, 'spot', N.trig); place('trailhead', 12, 14, 'spot', N.trail);
  place('quarry', 21, 18, 'spot', N.quarry);
  for (const [lx, ly] of [[17, 13], [24, 14], [17, 16], [24, 17]] as const) if (open(lx, ly)) prop(lx, ly, 'bkt-boulder', 14, 'tall', 'over', 56);
  bld(20, 23, 4, 2, 'bkt-safe'); place('safe-bukit', 21, 25, 'safe', 'Bungalow safe house');
  // ── the Botanic Gardens: the herbarium and library (Dr Merbah), the bandstand, the Gardens gate, Botanic Gardens
  // station, the orchid garden, Swan Lake
  bld(33, 11, 6, 3, 'bkt-herbarium'); place('herbarium', 35, 14, 'spot', N.herbarium); place('merbah', 37, 15, 'contact', 'Dr Merbah');
  bld(31, 15, 2, 2, 'bkt-bandstand'); place('bandstand', 32, 17, 'spot', N.bandstand);
  place('bkt-gate', 36, 22, 'spot', N.gate); place('gardens', 34, 16, 'spot', N.gardens);
  bld(30, 22, 3, 2, 'bkt-stn-botanic'); place('stn-botanic', 31, 24, 'station', N.botanic);
  for (const [lx, ly] of [[30, 25.4], [32, 26.4]] as const) deco(lx, ly, 'bkt-orchid-arch', 86, 'over');
  for (const [lx, ly] of [[30, 27], [32, 25]] as const) if (open(lx, ly)) prop(lx, ly, 'bkt-orchid-urn', 12, 'tall', 'over', 46);
  place('orchid', 31, 26, 'spot', N.orchid); place('swanlake', 35, 22, 'spot', N.swan);
  for (const [lx, ly] of [[36, 17], [30, 13], [39, 22], [38, 27]] as const) if (open(lx, ly)) prop(lx, ly, 'bkt-bench', 10, 'low', 'over', 60);
  // the macaque-proof bins by the trailhead and on the corridor
  for (const [lx, ly] of [[10, 13], [8, 5], [23, 5]] as const) if (open(lx, ly)) prop(lx, ly, 'bkt-bin', 10, 'tall', 'over', 40);

  // ── the forest: rain trees thick on the hill off the trail, a few on the Gardens' lawns
  const trailNear = (lx: number, ly: number) => TRAIL22.some(([tx, ty], k) => { if (!k) return false; const [sx, sy] = TRAIL22[k - 1]; const L = Math.hypot(tx - sx, ty - sy) || 1, u = Math.max(0, Math.min(1, ((lx - sx) * (tx - sx) + (ly - sy) * (ty - sy)) / (L * L))); return Math.hypot(sx + (tx - sx) * u - lx, sy + (ty - sy) * u - ly) < 1.5; });
  for (let ly = 12; ly < BKT_H; ly += 2) for (let lx = (ly % 4 === 0 ? 0 : 1); lx < 25; lx += 2) {
    if (!open(lx, ly) || gr(lx, ly) !== G.GRASS || trailNear(lx, ly) || (lx >= 18 && lx <= 24 && ly >= 12 && ly <= 18) || (lx >= 19 && ly >= 22)) continue;
    let ok = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!open(lx + dx, ly + dy) && inB(lx + dx, ly + dy)) ok = false;
    if (ok) prop(lx, ly, (lx * 7 + ly * 3) % 5 ? 'tree-round' : 'tree-frangipani', 22, 'tall');
  }
  for (const [lx, ly] of [[1, 5], [6, 6], [12, 6], [33, 5], [37, 5], [31, 1], [38, 1], [30, 20], [24, 26], [26, 23], [36, 12.6]] as const) if (open(lx, ly) && gr(lx, ly) !== G.RAILBED && gr(lx, ly) !== G.ROAD && gr(lx, ly) !== G.WALK) prop(lx, ly, 'tree-round', 22, 'tall');
  for (const [lx, ly] of [[38, 15], [39, 12]] as const) if (open(lx, ly)) prop(lx, ly, 'tree-frangipani', 22, 'tall');
  // hiding spots
  for (const [lx, ly] of [[10, 5], [24, 12], [16, 19], [30, 17], [39, 26]] as const) if (open(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground' }); }

  // the rides: bikes on the corridor, a scooter at Beauty World
  const park: Bukit['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'bukit', kind, rot }); };
  ride(10.5, 3.5, 'bike'); ride(11.5, 3.5, 'bike'); ride(5, 13.5, 'scooter', 0); ride(35, 21.5, 'scooter', Math.PI);

  // ── the MRT runs on: Beauty World and Botanic Gardens stations come first on the line (underground, so the trains you
  // see on the viaduct are as they were), and a taxi stand at the Gardens gate
  const isle = c.isle;
  if (isle) {
    const ids = ['stn-beauty', 'stn-botanic'];
    const sp = ids.map(id => [c.places[id].x, c.places[id].y] as [number, number]);
    const lineP: [number, number][] = [...sp, ...isle.line];
    const lineLen = [0]; for (let i = 1; i < lineP.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(lineP[i][0] - lineP[i - 1][0], lineP[i][1] - lineP[i - 1][1]));
    const shift = lineLen[2];
    const st: Station[] = ids.map((id, k) => { const pl = c.places[id]; return { id, name: pl.name!, x: pl.x, y: pl.y, d: pl.d, s: lineLen[k] }; });
    isle.stations = [...st, ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = lineP; isle.lineLen = lineLen; isle.visFrom += shift;
    isle.taxiStands.push(P(37, 22));
  }
  const haunts: [number, number][] = [P(9, 17.4), P(13, 20), P(6, 24.6), P(22.4, 5.6), P(3, 5.6), P(11.4, 10.6)];
  c.bukit = { trail: TRAIL22.map(([lx, ly]) => P(lx, ly)), shelters: SHELTERS22.map(([lx, ly]) => P(lx, ly)), summit: P(3, 24),
    lake: P(35.5, 24.6), swans: [P(34, 24), P(37, 25.4), P(35, 26.2)], quarry: P(20.5, 14.5), haunts, bridge, rail: [P(0, 3.5), P(39, 3.5)], park };
}

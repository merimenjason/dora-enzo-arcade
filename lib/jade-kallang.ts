// Jade Street: the eighteenth pass's district, Kallang. Runs last on the finished city (after Pulau Ubin), so nothing
// built before moves. Built in two pieces of the old frame's open sea (lib/jade-city.ts KAL_*): a north strip right under
// Kampong Glam's south coast (part of the main block, so Kampong Glam's two avenues run straight on into it) and the rest
// east of Sentosa's buoys (its own block, which the layout table, lib/jade-layout.ts, puts right under the strip). In the
// world it is one district 46 tiles wide and 44 deep between Kampong Glam and the sea, west of the Geylang River.
// The Singapore Sports Hub on the Kallang Basin: the National Stadium under its silver dome, Kallang Wave Mall, the
// Singapore Indoor Stadium, Stadium station; across Stadium Boulevard the Old Kallang Airport terminal (1937, the
// flying boats' airport) on its apron; Kallang Riverside Park on the basin's north bank with the rowing club and its
// dragon boats, and the Stadium Riverwalk down the east bank. Real place and road names; the people are invented.
// Pure data: lib/jade-kallangfest.ts holds the things to do, lib/jade-crowd.ts the match-night crowd step and
// lib/jade-kallangdraw.ts the moving parts.
import type { Station } from './jade-island.js';
import { T, OLD_W as W, OLD_H as H, G, S, F_BRIDGE, F_PARK, KAL_NX0, KAL_NY0, KAL_X0, KAL_W, KAL_NH, KAL_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';

export type Kallang = {
  /** where match-night fans gather (world): the station's exit, the four gates, the fan zone */
  exit: [number, number]; gates: [number, number][]; fanzone: [number, number];
  /** the Kallang Wave's spot by the fan-zone stage, the old control tower's look-out (world) */
  wave: [number, number]; tower: [number, number];
  /** the basin's water as a world rect (x0, y0, x1, y1): the rowing course's buoys stand in it */
  basin: [number, number, number, number];
  /** the district's parked rides (the rowing club's dragon boats and a sampan, bikes by the riverside, scooters on the
   * kerbs): appended to the city's parking after every older ride (lib/jade-city.ts), so the older rides keep their ids
   * and seeded paint */
  park: { x: number; y: number; d: 'kallang'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** a Kallang tile (local column, local row from the north strip's corner) in the old frame: the north strip's rows sit
 * under Kampong Glam, the rest east of Sentosa; both keep old row = 82 + local row */
export const kalOld = (lx: number, ly: number): [number, number] => [ly < KAL_NH ? KAL_NX0 + lx : KAL_X0 + lx, KAL_NY0 + ly];
/** the real names; Madam Sutera and her crows are fictional */
export const KALLANG_NAMES = {
  stadium: 'the National Stadium', hub: 'the Singapore Sports Hub', mall: 'Kallang Wave Mall', indoor: 'the Singapore Indoor Stadium',
  station: 'Stadium station', airport: 'the Old Kallang Airport terminal', apron: 'the old airport apron', riverside: 'Kallang Riverside Park',
  basin: 'the Kallang Basin', river: 'the mouth of the Kallang River', riverwalk: 'the Stadium Riverwalk', club: 'the Kallang rowing club',
  boulevard: 'Stadium Boulevard', nicoll: 'Nicoll Highway', fanzone: 'the fan zone', gateN: 'the stadium’s north gate', gateS: 'the stadium’s south gate',
  gateW: 'the stadium’s west gate', gateE: 'the stadium’s east gate',
};

export function kallang(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const inK = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < KAL_W && ly < KAL_H;
  const O = kalOld;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { if (!inK(lx, ly)) return; const [x, y] = O(lx, ly); if (!inb(x, y)) return; const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const gr = (lx: number, ly: number) => { const [x, y] = O(lx, ly); return c.ground[at(x, y)]; };
  const open = (lx: number, ly: number) => { const [x, y] = O(lx, ly); return c.solid[at(x, y)] === S.OPEN; };
  /** a building (never across the seam between the strip and the block: ly and ly + h - 1 on one side) */
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
  const N = KALLANG_NAMES;

  // ── the ground: the Sports Hub's paving everywhere to start with, then the park, the apron, the basin
  rect(0, 0, KAL_W, KAL_H, G.HUB);
  // Kallang Riverside Park: lawns (park: townsfolk wander them) with a timber promenade along the water
  rect(0, 0, 12, 20, G.GRASS, S.OPEN, F_PARK);
  rect(0, 8, 12, 2, G.PROM);
  // the old airport's concrete apron (the terminal faces south onto it)
  rect(16, 0, 16, 16, G.APRON);
  // the Kallang Basin: rowing water from the river's mouth south to the sea (water to all but a boat), the promenade
  // round its north and east banks (the Stadium Riverwalk)
  for (let ly = 22; ly < KAL_H; ly++) for (let lx = 0; lx < KAL_W; lx++) {
    const east = 16 - (ly > 34 ? 1 : 0) + (ly % 7 === 3 ? -1 : 0);
    if (lx <= east) setT(lx, ly, G.BASIN, S.WATER);
  }
  rect(0, 20, 20, 2, G.PROM); rect(17, 22, 3, KAL_H - 22, G.PROM);
  for (let ly = 22; ly < KAL_H; ly++) if (gr(16, ly) !== G.BASIN) setT(16, ly, G.PROM);
  // the sea wall along the south edge
  rect(20, KAL_H - 1, KAL_W - 20, 1, G.PROM);

  // ── the roads: Kampong Glam's two avenues run on south (the west one to Kallang Riverside, the east one to the Sports
  // Hub), Stadium Boulevard joins them across the district; kerbs in the Sports Hub's paving, then the lanes over them
  const road = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [0, 3]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; if (gr(x, y) !== G.ROAD) setT(x, y, G.HUB); }
  };
  const lanes = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [1, 2]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; setT(x, y, G.ROAD); }
  };
  const RD: ['h' | 'v', number, number, number][] = [['v', 12, 0, 19], ['v', 32, 0, 19], ['h', 16, 12, 44]];
  for (const r of RD) road(...r);
  for (const r of RD) lanes(...r);
  // the boulevard's end: a turning circle of paving, bollards
  for (const ly of [17, 18]) prop(44.6, ly, 'bollard', 6, 'tall', 'over', 26);
  // lane dashes (none on a crossing), lamps on the kerbs
  const isRoad = (lx: number, ly: number) => inK(lx, ly) && gr(lx, ly) === G.ROAD;
  const cross = (lx: number, ly: number) => isRoad(lx, ly) && ((isRoad(lx - 1, ly) && isRoad(lx + 1, ly) && (isRoad(lx, ly - 1) || isRoad(lx, ly + 1))) || ly >= 16 && ly <= 19 && (lx >= 12 && lx <= 15 || lx >= 32 && lx <= 35));
  for (const [axis, a, from, to] of RD) for (let s = from; s <= to; s += 2) {
    const [lx, ly] = axis === 'h' ? [s, a + 2] : [a + 2, s];
    if (cross(lx, ly) || (axis === 'h' ? cross(lx, ly - 1) : cross(lx - 1, ly))) continue;
    const [wx, wy] = P(lx, ly);
    c.decals.push({ x: axis === 'h' ? wx : wx - T / 2, y: axis === 'h' ? wy - T / 2 : wy, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: axis === 'h' ? 0 : Math.PI / 2 });
  }
  for (const [lx, ly] of [[12, 5], [15, 11], [32, 4], [35, 10], [21, 16], [27, 19], [40, 16], [40, 19]] as const) if (open(lx, ly) && gr(lx, ly) !== G.ROAD) prop(lx, ly, 'lamp', 8, 'tall');

  // ── Kallang Riverside Park: trees on the lawns, benches on the promenade, the rowing club by the water
  for (const [lx, ly] of [[2, 2], [6, 1], [10, 3], [3, 5], [8, 6], [1, 12], [5, 11], [9, 13], [2, 15], [10, 16]] as const) if (open(lx, ly) && gr(lx, ly) === G.GRASS) prop(lx, ly, (lx + ly) % 3 ? 'tree-round' : 'tree-frangipani', 22, 'tall');
  for (const lx of [2, 6, 10]) deco(lx, 8.2, 'bench', 70);
  place('riverside', 6, 10, 'spot', N.riverside);
  bld(3, 16, 5, 3, 'kal-boathouse'); place('club', 5, 19, 'spot', N.club); place('biru', 9, 19, 'contact', 'Coach Biru');
  // the pontoon: a deck out into the basin, the dragon boats tied up either side, a rack of rowing shells
  for (let ly = 22; ly <= 24; ly++) for (const lx of [5, 6]) setT(lx, ly, G.DECK, S.OPEN, F_BRIDGE);
  prop(1.5, 18.5, 'kal-shells', 14, 'tall', 'over', 120);
  deco(9.5, 21, 'kal-drum', 44);
  place('pontoon', 5, 21, 'spot', 'the rowing club’s pontoon');
  place('kriver', 8, 21, 'spot', N.river);
  const park: Kallang['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'kallang', kind, rot }); };
  ride(3.6, 23.5, 'dragon', Math.PI / 2); ride(7.4, 23.5, 'dragon', Math.PI / 2); ride(10, 22.6, 'boat', 0);
  ride(9, 11, 'bike'); ride(10, 11, 'bike');

  // ── the Old Kallang Airport: the terminal (its control tower on the roof) facing its apron, a vintage airliner, the
  // wind sock, the fuel bowser; Uncle Kubung keeps the place
  bld(18, 2, 11, 5, 'kal-airport'); place('airport', 23, 7, 'spot', N.airport); place('kubung', 27, 8, 'contact', 'Uncle Kubung');
  prop(23, 11.5, 'kal-plane', 30, 'tall', 'over', 230);
  prop(30, 9, 'kal-windsock', 8, 'tall', 'over', 56); prop(18, 12, 'kal-bowser', 14, 'tall', 'over', 90);
  place('apron', 25, 14, 'spot', N.apron);
  const tower: [number, number] = P(29.4, 7);

  // ── the Singapore Indoor Stadium (its pagoda roof), the safe house in the old airport's hangar office
  bld(37, 2, 8, 8, 'kal-indoor'); place('indoor', 40, 11, 'spot', N.indoor);
  bld(41, 12, 3, 2, 'safe-kallang'); place('safe-kallang', 42, 15, 'safe', 'Hangar safe house');
  for (const [lx, ly] of [[36, 12], [45, 11], [36, 1]] as const) if (open(lx, ly)) prop(lx, ly, 'palm', 18, 'tall', 'over', 110);

  // ── the Sports Hub: Stadium station, Kallang Wave Mall, the National Stadium in the middle of its concourse, the gates
  bld(21, 20, 8, 4, 'kallang-stn'); place('stn-stadium', 25, 24, 'station', N.station);
  bld(38, 20, 7, 7, 'kal-mall'); place('wavemall', 41, 27, 'spot', N.mall); place('mk-kallang', 43, 28, 'market', 'the Kallang Wave Mall market');
  bld(24, 29, 14, 9, 'kal-stadium'); place('stadium', 30, 41, 'spot', N.stadium); place('sportshub', 33, 25, 'spot', N.hub);
  place('tenuk', 33, 26, 'contact', 'Ms Tenuk');
  const gates: [number, number][] = [P(30, 28), P(23, 33), P(38, 33), P(31, 38)];
  for (const [lx, ly, rot] of [[30, 28, 0], [23, 33, Math.PI / 2], [38, 33, Math.PI / 2], [31, 38, 0]] as const) deco(lx, ly - 0.2, 'kal-turnstile', 96, 'over', rot);
  place('gate-n', 30, 27, 'spot', N.gateN); place('gate-w', 23, 33, 'spot', N.gateW); place('gate-e', 38, 33, 'spot', N.gateE); place('gate-s', 31, 39, 'spot', N.gateS);
  // floodlight masts round the dome, crowd barriers along the west concourse
  for (const [lx, ly] of [[22, 26], [21.5, 42.4], [39, 42], [44.6, 42]] as const) if (open(Math.floor(lx), ly)) prop(lx, ly, 'kal-floodlight', 10, 'tall', 'over', 70);
  for (const [lx, ly] of [[26, 25], [35, 25], [20.4, 27], [20.4, 39]] as const) if (open(Math.floor(lx), ly)) deco(lx, ly, 'kal-barrier', 100);
  // the fan zone: the east concourse between the mall and the stage is the fans' walk (the crowd jobs cross it), so the
  // food trucks and the big screen stand along its east edge and the stage at its south end
  prop(42, 42.2, 'kal-stage', 30, 'tall', 'over', 180); place('fanzone', 42, 40, 'spot', N.fanzone);
  prop(45, 31, 'kal-foodtruck', 20, 'tall', 'over', 120); prop(45, 36, 'kal-foodtruck', 20, 'tall', 'over', 120);
  prop(45, 27.4, 'kal-screen', 16, 'tall', 'over', 110);
  const wave: [number, number] = P(40, 40), fanzone: [number, number] = P(42, 40);
  // the Riverwalk: benches and lamps down the east bank, the basin's name
  for (const ly of [25, 31, 37]) deco(18.4, ly, 'bench', 70, 'over');
  for (const ly of [23, 29, 35, 41]) if (open(19, ly)) prop(19, ly, 'prom-lamp', 8, 'tall', 'over', 54);
  place('riverwalk', 18, 33, 'spot', N.riverwalk); place('basin', 17, 30, 'spot', N.basin);
  ride(22, 16.2, 'scooter', -Math.PI / 2); ride(37, 19.8, 'scooter', Math.PI / 2); ride(43, 19.8, 'van', Math.PI / 2);
  // hiding spots
  for (const [lx, ly] of [[1, 6], [20, 13], [44, 24], [21, 42]] as const) if (open(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground' }); }

  // ── the MRT runs on: Stadium station comes first on the line (underground, so the trains you see on the viaduct are
  // as they were), and a taxi stand on Stadium Boulevard
  const isle = c.isle;
  if (isle) {
    const sp: [number, number] = [c.places['stn-stadium'].x, c.places['stn-stadium'].y];
    const line: [number, number][] = [sp, ...isle.line];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[1], pl = c.places['stn-stadium'];
    const st: Station = { id: 'stn-stadium', name: pl.name!, x: pl.x, y: pl.y, d: pl.d, s: 0 };
    isle.stations = [st, ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
    isle.taxiStands.push(P(29, 15));
  }
  const [b0x, b0y] = P(0, 22), [b1x, b1y] = P(15, KAL_H - 1);
  c.kallang = { exit: P(25, 25), gates, fanzone, wave, tower, basin: [b0x - T / 2, b0y - T / 2, b1x + T / 2, b1y + T / 2], park };
}

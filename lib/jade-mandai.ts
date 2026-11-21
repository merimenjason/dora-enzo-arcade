// Jade Street: the nineteenth pass's district, Mandai. Runs last on the finished city (after Kallang), so nothing built
// before moves. Built in the old frame's open sea west of Sentosa (lib/jade-city.ts MND_*), its own block, which the
// layout table (lib/jade-layout.ts) puts in the world's north-west corner, at the top edge west of Orchard Road: the
// northernmost land on the map, past Bukit Timah's green. 30 tiles wide and 38 deep.
// Singapore's wildlife parks on the Upper Seletar Reservoir, at night: the reservoir along the north edge with the Mandai
// boardwalk and a jetty; Bird Paradise's aviary dome, the Singapore Zoo's entrance and River Wonders' panda pavilion
// between the boardwalk and Mandai Road; south of it the Night Safari: its thatched entrance lodge, the Creatures of the
// Night amphitheatre, the Mandai Lake Road station, and the night forest with its trails, the tram loop, a ranger hut and
// a 1937 survey pillar. Mandai Road runs on east into Orchard Road; Mandai Lake Road runs south into the parkland road.
// Real place and road names; the people are invented. Pure data: lib/jade-mandaifest.ts holds the things to do,
// lib/jade-torch.ts the lights-off trail step and lib/jade-mandaidraw.ts the moving parts.
import type { Station } from './jade-island.js';
import { T, OLD_W as W, OLD_H as H, G, S, F_BRIDGE, F_PARK, MND_X0, MND_Y0, MND_W, MND_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';

export type Mandai = {
  /** the Night Safari tram's loop through the forest (world, closed: the last point runs back to the first) */
  tram: [number, number][];
  /** the tram stop (world): E there for a ride round the loop */
  stops: [number, number][];
  /** Bird Paradise's lory perch, the Creatures of the Night stage, Madam Sutera's seaplane's mooring (world) */
  perch: [number, number]; stage: [number, number]; plane: [number, number];
  /** the night forest's glowing trail studs and amber lanterns (world): the scene lights them */
  studs: [number, number][]; lanterns: [number, number][];
  /** the district's parked rides (a boat at the jetty, bikes, scooters): appended to the city's parking after every older
   * ride (lib/jade-city.ts), so the older rides keep their ids and seeded paint */
  park: { x: number; y: number; d: 'mandai'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** a Mandai tile (local column and row) in the old frame */
export const mndOld = (lx: number, ly: number): [number, number] => [MND_X0 + lx, MND_Y0 + ly];
/** the real names; Madam Sutera, her owls and the keepers are fictional */
export const MANDAI_NAMES = {
  safari: 'the Night Safari', zoo: 'the Singapore Zoo', river: 'River Wonders', aviary: 'Bird Paradise', boardwalk: 'the Mandai boardwalk',
  reservoir: 'the Upper Seletar Reservoir', jetty: 'the reservoir jetty', show: 'the Creatures of the Night show', station: 'Mandai Lake Road station',
  trail: 'the Night Safari’s walking trails', trig: 'the 1937 survey pillar', tramstop: 'the Night Safari tram stop', lake: 'Mandai Lake Road', road: 'Mandai Road',
};
/** the night forest's trail, as local tiles: the studs glow along it (the torch jobs' markers sit on it) */
export const TRAIL: [number, number][] = [[6, 31], [3, 33], [7, 35], [11, 34], [14, 32], [17, 34], [15, 36], [10, 36], [6, 37], [2, 36], [1, 31],
  [1, 26], [1, 20], [1, 14], [1, 9]];

export function mandai(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const inM = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < MND_W && ly < MND_H;
  const O = mndOld;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { if (!inM(lx, ly)) return; const [x, y] = O(lx, ly); if (!inb(x, y)) return; const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const gr = (lx: number, ly: number) => { const [x, y] = O(lx, ly); return c.ground[at(x, y)]; };
  const open = (lx: number, ly: number) => { const [x, y] = O(lx, ly); return c.solid[at(x, y)] === S.OPEN; };
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
  const N = MANDAI_NAMES;

  // ── the ground: the parks' red laterite everywhere to start with, then the reservoir, the boardwalk, the night forest
  rect(0, 0, MND_W, MND_H, G.LATERITE);
  // the Upper Seletar Reservoir along the north edge (water to all but a boat), a wooded bank, the boardwalk along it
  rect(0, 0, MND_W, 6, G.RESV, S.WATER);
  for (let lx = 0; lx < MND_W; lx++) { if (lx % 7 === 2 || lx % 7 === 3) setT(lx, 6, G.RESV, S.WATER); else setT(lx, 6, G.JUNGLE, S.OPEN, F_PARK); }
  rect(0, 7, MND_W, 2, G.BOARD);
  // the jetty: a deck out into the reservoir (the seaplane moors off its end)
  for (let ly = 2; ly <= 6; ly++) for (const lx of [10, 11]) setT(lx, ly, G.BOARD, S.OPEN, F_BRIDGE);
  // the forest: a strip down the west edge (the trail from the Night Safari to the boardwalk) and the whole south
  rect(0, 9, 2, 13, G.JUNGLE, S.OPEN, F_PARK);
  rect(0, 31, 24, 7, G.JUNGLE, S.OPEN, F_PARK);
  rect(28, 9, 2, 3, G.JUNGLE, S.OPEN, F_PARK); rect(28, 16, 2, 6, G.JUNGLE, S.OPEN, F_PARK);
  // the trail through it, laterite (the tram loop runs on its own laterite track)
  for (let k = 1; k < TRAIL.length; k++) {
    const [ax, ay] = TRAIL[k - 1], [bx, by] = TRAIL[k], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s <= n; s++) { const lx = Math.round(ax + (bx - ax) * s / n), ly = Math.round(ay + (by - ay) * s / n); if (gr(lx, ly) === G.JUNGLE) setT(lx, ly, G.LATERITE); }
  }
  // River Wonders' river: a slow channel beside the panda pavilion (water), a river boat on it
  rect(19, 15, 3, 6, G.RESV, S.WATER);

  // ── the roads: Mandai Road east into Orchard Road, Mandai Lake Road south from the boardwalk into the parkland's road,
  // and a spur east into Orchard's north road; kerbs in laterite, then the lanes over them
  const road = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [0, 3]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; if (gr(x, y) !== G.ROAD) setT(x, y, G.LATERITE); }
  };
  const lanes = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [1, 2]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; setT(x, y, G.ROAD); }
  };
  const RD: ['h' | 'v', number, number, number][] = [['h', 22, 0, 29], ['v', 24, 9, 37], ['h', 12, 24, 29]];
  for (const r of RD) road(...r);
  for (const r of RD) lanes(...r);
  const isRoad = (lx: number, ly: number) => inM(lx, ly) && gr(lx, ly) === G.ROAD;
  const cross = (lx: number, ly: number) => isRoad(lx, ly) && isRoad(lx - 1, ly) && isRoad(lx + 1, ly) && (isRoad(lx, ly - 1) || isRoad(lx, ly + 1));
  for (const [axis, a, from, to] of RD) for (let s = from; s <= to; s += 2) {
    const [lx, ly] = axis === 'h' ? [s, a + 2] : [a + 2, s];
    if (cross(lx, ly) || (axis === 'h' ? cross(lx, ly - 1) : cross(lx - 1, ly))) continue;
    const [wx, wy] = P(lx, ly);
    c.decals.push({ x: axis === 'h' ? wx : wx - T / 2, y: axis === 'h' ? wy - T / 2 : wy, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: axis === 'h' ? 0 : Math.PI / 2 });
  }
  for (const [lx, ly] of [[5, 22], [15, 22], [20, 25], [6, 25], [24, 17], [27, 31], [24, 35]] as const) if (open(lx, ly) && gr(lx, ly) !== G.ROAD) prop(lx, ly, 'lamp', 8, 'tall');

  // ── the boardwalk: lanterns and benches along the water, the jetty, Madam Sutera's seaplane's mooring
  const lanterns: [number, number][] = [];
  for (const lx of [3, 8, 14, 19, 26]) { prop(lx, 7, 'mnd-lantern', 8, 'tall', 'over', 40); lanterns.push(P(lx, 6.6)); }
  for (const lx of [5, 16, 22]) deco(lx, 8.3, 'mnd-bench', 70);
  place('boardwalk', 16, 8, 'spot', N.boardwalk); place('mnd-jetty', 10, 5, 'spot', N.jetty); place('reservoir', 20, 7, 'spot', N.reservoir);
  const park: Mandai['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'mandai', kind, rot }); };
  ride(8.5, 4, 'boat', 0);
  const plane = P(14, 3.2);

  // ── Bird Paradise: the aviary dome, the lory perch; Auntie Enggang keeps the birds
  bld(2, 10, 8, 6, 'mnd-aviary'); place('aviary', 6, 16, 'spot', N.aviary); place('enggang', 9, 17, 'contact', 'Auntie Enggang');
  prop(4, 18, 'mnd-perch-bare', 14, 'tall', 'over', 90); const perch = P(4, 19);
  deco(6.4, 19.2, 'mnd-nectar', 40);
  // ── the Singapore Zoo's entrance, the Mandai market beside it
  bld(12, 10, 8, 4, 'mnd-zoo'); place('zoo', 16, 14, 'spot', N.zoo);
  place('mk-mandai', 22, 12, 'market', 'the Mandai market');
  // ── River Wonders: the panda pavilion by its river; Dr Bintu, the parks' vet
  bld(12, 16, 6, 4, 'mnd-panda'); place('riverwonders', 15, 20, 'spot', N.river); place('bintu', 18, 21, 'contact', 'Dr Bintu');
  deco(20, 17.5, 'mnd-boat', 80, 'over', 0);
  for (const [lx, ly] of [[28, 14], [22, 16]] as const) if (open(lx, ly)) prop(lx, ly, 'mnd-bamboo', 16, 'tall', 'over', 70);

  // ── the Night Safari: the entrance lodge, the Creatures of the Night amphitheatre, the station; Encik Kongkang is the
  // ranger on the trails
  bld(2, 26, 8, 4, 'mnd-lodge'); place('safari', 6, 30, 'spot', N.safari); place('kongkang', 8, 31, 'contact', 'Encik Kongkang');
  bld(11, 26, 6, 4, 'mnd-amphi'); place('show', 14, 30, 'spot', N.show); const stage = P(14, 30.2);
  bld(18, 26, 6, 3, 'mandai-stn'); place('stn-mandai', 21, 29, 'station', N.station);
  // the tram stop and the loop through the forest (laterite track; the tram never blocks anyone)
  prop(17.4, 30, 'mnd-tramstop', 14, 'tall', 'over', 110); place('tramstop', 16, 30, 'spot', N.tramstop);
  const loop: [number, number][] = [[18.6, 31.2], [19, 36.6], [12, 37.2], [4.5, 36.6], [4.5, 32.2], [12, 31.4]];
  // the ranger hut (the safe house) in the forest, the 1937 survey pillar deep in it
  bld(20, 32, 3, 2, 'safe-mandai'); place('safe-mandai', 21, 34, 'safe', 'Ranger hut safe house');
  prop(3, 35, 'mnd-trig', 12, 'tall', 'over', 60); place('trig', 2, 35, 'spot', N.trig);
  place('trail', 7, 35, 'spot', N.trail);
  // the forest: rain trees and bamboo off the trail and the tram track, lanterns along the trail, studs on it
  const studs: [number, number][] = [];
  const onTrack = (lx: number, ly: number) => loop.some(([ax, ay], k) => { const [bx, by] = loop[(k + 1) % loop.length]; const L = Math.hypot(bx - ax, by - ay), u = Math.max(0, Math.min(1, ((lx - ax) * (bx - ax) + (ly - ay) * (by - ay)) / (L * L))); return Math.hypot(ax + (bx - ax) * u - lx, ay + (by - ay) * u - ly) < 1.1; });
  const trailNear = (lx: number, ly: number) => TRAIL.some(([tx, ty], k) => { if (!k) return false; const [sx, sy] = TRAIL[k - 1]; const L = Math.hypot(tx - sx, ty - sy) || 1, u = Math.max(0, Math.min(1, ((lx - sx) * (tx - sx) + (ly - sy) * (ty - sy)) / (L * L))); return Math.hypot(sx + (tx - sx) * u - lx, sy + (ty - sy) * u - ly) < 1.6; });
  for (const [lx, ly] of [[9, 32], [13, 36], [18, 31], [16, 37], [22, 36], [5, 33], [9, 37], [0, 33], [23, 34], [0, 17], [0, 11], [29, 10], [29, 18], [28, 20]] as const)
    if (open(lx, ly) && !onTrack(lx, ly) && !trailNear(lx, ly)) prop(lx, ly, (lx + ly) % 3 ? 'tree-round' : 'mnd-bamboo', 22, 'tall', 'over', (lx + ly) % 3 ? undefined : 70);
  TRAIL.forEach(([lx, ly], k) => { if (k % 2 === 0 && ly >= 30) studs.push(P(lx, ly)); });
  for (const [lx, ly] of [[4, 32], [12, 35], [16, 33], [3, 37]] as const) if (open(lx, ly) && !onTrack(lx, ly)) { deco(lx, ly - 0.3, 'mnd-lantern', 34); lanterns.push(P(lx, ly - 0.5)); }
  deco(17.6, 30.6, 'mnd-fence', 70); deco(8.4, 31.6, 'mnd-fence', 70);
  ride(9.5, 21, 'bike'); ride(10.5, 21, 'bike'); ride(23, 31, 'scooter', 0); ride(28.5, 26, 'scooter', Math.PI);
  // hiding spots
  for (const [lx, ly] of [[0, 15], [23, 21], [9, 33], [28, 34]] as const) if (open(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground' }); }

  // ── the MRT runs on: Mandai Lake Road station comes first on the line (underground, so the trains you see on the
  // viaduct are as they were), and a taxi stand on Mandai Lake Road
  const isle = c.isle;
  if (isle) {
    const sp: [number, number] = [c.places['stn-mandai'].x, c.places['stn-mandai'].y];
    const line: [number, number][] = [sp, ...isle.line];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[1], pl = c.places['stn-mandai'];
    const st: Station = { id: 'stn-mandai', name: pl.name!, x: pl.x, y: pl.y, d: pl.d, s: 0 };
    isle.stations = [st, ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
    isle.taxiStands.push(P(23, 18));
  }
  c.mandai = { tram: loop.map(([lx, ly]) => P(lx, ly)), stops: [P(16, 30.3)], perch, stage, plane, studs, lanterns, park };
}

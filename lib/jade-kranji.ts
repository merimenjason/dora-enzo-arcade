// Jade Street: the twenty-fourth pass's district, Kranji and Woodlands, in the far north. Runs last on the finished city
// (after the Southern Islands), so nothing built before moves. Built in the build frame's extra rows (lib/jade-layout.ts
// KRJ: old columns 100 to 135, rows 128 to 183; the arrays grow to BUILD_H here), its own block, which the layout table
// sets down in the north-east corner above Pulau Ubin, at the top edge east of Changi, with the Strait of Johor along
// its north edge. 36 tiles wide and 56 deep. (Woodlands is really in the middle of the north coast; this map's only free
// stretch of the top edge is here.)
// Sungei Buloh Wetland Reserve in the north-west (the mangrove fringe, the mudflats where the crocodiles bask and the
// whimbrels feed at low tide, the boardwalk, the bird hide on stilts, the visitor centre), Kranji Dam and the reservoir
// below it, the Kranji countryside's farms along the road in the south-west (the frog farm and its ponds, Hay Dairies'
// goats, Bollywood Veggies' fields and an old orchid greenhouse), the Kranji War Memorial on its hill in the south (a
// quiet place: one gate, no townsfolk, nothing of a job inside its hedge), Woodlands town in the east (the MRT, a
// kopitiam, the HDB blocks), Woodlands Checkpoint and the Causeway north to Johor (both carriageways jammed solid: the
// queue is drawn, and its lanes are closed to feet and wheels alike), and Woodlands Waterfront's long jetty. Real place
// names; the people are invented. Pure data: lib/jade-kranjifest.ts holds the things to do, lib/jade-mud.ts the
// mudflat step and lib/jade-kranjidraw.ts the moving parts.
import { T, OLD_W as W, BUILD_H, G, S, F_PARK, F_STAIRS, KRJ_X0, KRJ_Y0, KRJ_W, KRJ_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import type { Station } from './jade-island.js';

export type Kranji = {
  /** the mudflats' tiles (x0, y0, x1, y1, old frame until relayout): where the mudskippers hop and the whimbrels feed */
  flats: [number, number, number, number];
  /** where the crocodiles bask on the flats (world), the whimbrel flocks' feeding spots, the mudskippers' burrows */
  crocs: [number, number][]; birds: [number, number][]; skippers: [number, number][];
  /** the water monitor's beat along the boardwalk's edge (world) */
  lizard: [number, number][];
  /** the bird hide's window (watch the shorebirds), the goat pen's gate (feed the goats), the frog ponds, the goats' and
   * frogs' spots (world) */
  hide: [number, number]; pen: [number, number]; ponds: [number, number]; goats: [number, number][]; frogs: [number, number][];
  /** where you stand before the memorial (world): pay your respects, quietly */
  respect: [number, number];
  /** the Causeway's four jammed lanes (world): each lane's centre line x and the queue's two ends (y), north to south */
  queue: { x: number; y0: number; y1: number; dir: 1 | -1 }[];
  /** the Woodlands Waterfront jetty's end (world), where the whimbrels fly out over the strait */
  jetty: [number, number];
  /** the memorial's precinct (tiles x0, y0, x1, y1): no townsfolk, no job, nothing loud inside its hedge */
  quiet: [number, number, number, number];
  /** the district's parked rides: appended to the city's parking after every older ride */
  park: { x: number; y: number; d: 'kranji'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** a Kranji tile (local column and row) in the old (build) frame */
export const krjOld = (lx: number, ly: number): [number, number] => [KRJ_X0 + lx, KRJ_Y0 + ly];
/** the real names; the ringer, the warden, the farmers and the mudskippers are fictional */
export const KRANJI_NAMES = {
  buloh: 'Sungei Buloh Wetland Reserve', visitor: 'the Sungei Buloh visitor centre', flats: 'the Sungei Buloh mudflats', boardwalk: 'the mangrove boardwalk',
  hide: 'the bird hide', post: 'the old ringing post', camp: 'the Mudskipper Boys’ camp', dam: 'Kranji Dam', reservoir: 'Kranji Reservoir',
  frogs: 'the frog farm', goats: 'Hay Dairies goat farm', veggies: 'Bollywood Veggies', greenhouse: 'the old orchid greenhouse', farms: 'the Kranji countryside',
  memorial: 'the Kranji War Memorial', gate: 'the memorial gate', town: 'Woodlands', kopitiam: 'the Woodlands kopitiam', causeway: 'the Causeway',
  checkpoint: 'Woodlands Checkpoint', waterfront: 'Woodlands Waterfront', jetty: 'the Woodlands Waterfront jetty', strait: 'the Strait of Johor',
  kranjiStn: 'Kranji station', woodlandsStn: 'Woodlands station', safe: 'the Woodlands flat',
};
/** the Causeway's lanes (local columns) and its rows: the queue reaches from the map's edge (Johor beyond) down to the
 * checkpoint plaza */
export const CAUSEWAY = { x0: 24, x1: 27, y0: 0, y1: 10 } as const;
/** the mudflats (local) */
export const FLATS = { x0: 1, y0: 6, x1: 15, y1: 15 } as const;
/** firm ground on the flats (local): a mud step's crossings go quicker over these */
export const FIRM: [number, number][] = [[5, 9], [6, 9], [9, 11], [9, 12], [2, 13], [3, 13], [12, 13], [7, 7], [8, 7]];
/** mangrove clumps standing in the flats (local; water) */
export const CLUMPS: [number, number][] = [[3, 11], [4, 11], [10, 8], [11, 8], [7, 14], [13, 11]];
/** the memorial precinct (local, inclusive) and its gate */
export const MEMORIAL = { x0: 21, y0: 30, x1: 30, y1: 44, gate: 25 } as const;

export function kranji(c: City) {
  // the build frame grows to its full depth (open sea): every older array index stays as it was
  const N = W * BUILD_H;
  if (c.ground.length < N) {
    const g = new Uint8Array(N).fill(G.SEA), s = new Uint8Array(N).fill(S.WATER), f = new Uint8Array(N);
    g.set(c.ground); s.set(c.solid); f.set(c.flags); c.ground = g; c.solid = s; c.flags = f;
  }
  const at = (x: number, y: number) => y * W + x;
  const inK = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < KRJ_W && ly < KRJ_H;
  const O = krjOld;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { if (!inK(lx, ly)) return; const [x, y] = O(lx, ly); const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const gr = (lx: number, ly: number) => { if (!inK(lx, ly)) return G.SEA; const [x, y] = O(lx, ly); return c.ground[at(x, y)]; };
  const open = (lx: number, ly: number) => { if (!inK(lx, ly)) return false; const [x, y] = O(lx, ly); return c.solid[at(x, y)] === S.OPEN; };
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
  const N2 = KRANJI_NAMES;
  const M = MEMORIAL as { x0: number; y0: number; x1: number; y1: number; gate: number };
  const inMem = (lx: number, ly: number) => lx >= M.x0 && lx <= M.x1 && ly >= M.y0 && ly <= M.y1;

  // ── the ground: countryside grass, the strait along the top, Woodlands' pavements in the east
  rect(0, 0, KRJ_W, KRJ_H, G.GRASS, S.OPEN, F_PARK);
  rect(0, 0, KRJ_W, 4, G.SEA, S.WATER);
  rect(21, 16, 15, 13, G.WOODS);
  // ── Sungei Buloh: the mangrove fringe along the strait and down the west edge, the mudflats inside it, a belt of
  // mangrove on the east side, clumps standing in the mud, firm patches, and the boardwalk round the flats' south edge
  rect(0, 4, 17, 2, G.MANGROVE, S.WATER); rect(0, 4, 1, 20, G.MANGROVE, S.WATER); rect(16, 4, 1, 16, G.MANGROVE, S.WATER);
  rect(FLATS.x0, FLATS.y0, FLATS.x1 - FLATS.x0 + 1, FLATS.y1 - FLATS.y0 + 1, G.MUDFLAT);
  for (const [lx, ly] of FIRM) setT(lx, ly, G.PATH);
  for (const [lx, ly] of CLUMPS) setT(lx, ly, G.MANGROVE, S.WATER);
  rect(1, 16, 15, 1, G.PLANK); rect(7, 17, 1, 2, G.PLANK); rect(14, 11, 1, 5, G.PLANK);
  bld(13, 9, 3, 2, 'kr-hide');
  bld(1, 19, 5, 3, 'kr-visitor');
  rect(1, 22, 16, 1, G.PATH);
  // ── Kranji Dam (its walkway along the reservoir's north shore) and Kranji Reservoir
  rect(0, 24, 17, 2, G.PATH);
  rect(0, 26, 17, 11, G.SEA, S.WATER);
  // ── the roads: Kranji Way down the middle, Woodlands Road east to the checkpoint, Kranji Road along the south (it runs
  // on west into Changi's road); kerbs in Woodlands paving, then the lanes over them
  const road = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [0, 3]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; if (gr(x, y) !== G.ROAD) setT(x, y, G.WOODS); }
  };
  const lanes = (axis: 'h' | 'v', a: number, from: number, to: number) => {
    for (let s = from; s <= to; s++) for (const k of [1, 2]) { const [x, y] = axis === 'h' ? [s, a + k] : [a + k, s]; setT(x, y, G.ROAD); }
  };
  const RD: ['h' | 'v', number, number, number][] = [['v', 17, 12, 49], ['h', 12, 17, 35], ['h', 46, 0, 35], ['v', 32, 16, 45]];
  for (const r of RD) road(...r);
  for (const r of RD) lanes(...r);
  const isRoad = (lx: number, ly: number) => inK(lx, ly) && gr(lx, ly) === G.ROAD;
  const cross = (lx: number, ly: number) => isRoad(lx, ly) && isRoad(lx - 1, ly) && isRoad(lx + 1, ly) && (isRoad(lx, ly - 1) || isRoad(lx, ly + 1));
  for (const [axis, a, from, to] of RD) for (let s = from; s <= to; s += 2) {
    const [lx, ly] = axis === 'h' ? [s, a + 2] : [a + 2, s];
    if (cross(lx, ly) || (axis === 'h' ? cross(lx, ly - 1) : cross(lx - 1, ly))) continue;
    const [wx, wy] = P(lx, ly);
    c.decals.push({ x: axis === 'h' ? wx : wx - T / 2, y: axis === 'h' ? wy - T / 2 : wy, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: axis === 'h' ? 0 : Math.PI / 2 });
  }
  // ── the Causeway: a footpath either side and four lanes between, from the strait's far shore (off the map, Johor)
  // down over the water to the checkpoint plaza. The lanes are jammed nose to tail all night: closed tiles (the cars are
  // drawn, lib/jade-kranjidraw.ts), so nobody walks or drives through the queue; the plaza joins Woodlands Road
  rect(CAUSEWAY.x0 - 1, 0, 6, 12, G.WOODS);
  rect(CAUSEWAY.x0, CAUSEWAY.y0, 4, CAUSEWAY.y1 - CAUSEWAY.y0 + 1, G.ROAD, S.TALL);
  bld(29, 7, 6, 4, 'kr-checkpoint');
  place('kr-checkpoint', 30, 11, 'spot', N2.checkpoint);
  place('kr-causeway', 23, 11, 'spot', N2.causeway);
  // ── Woodlands Waterfront: the promenade along the strait and the long jetty out over it
  rect(29, 4, 7, 2, G.WOODS); rect(32, 0, 2, 4, G.PLANK);
  place('kr-waterfront', 30, 5, 'spot', N2.waterfront); place('kr-jetty', 32, 1, 'spot', N2.jetty);
  for (const [lx, ly] of [[29, 4], [35, 4]] as const) deco(lx, ly, 'kr-bench', 62);
  // ── Sungei Buloh's buildings and people: the visitor centre, the hide, the boardwalk's spots, the ringing post, the
  // Mudskipper Boys' camp on the flats' north bank
  place('kedidi', 3, 23, 'contact', 'Kak Kedidi'); place('kr-visitor', 4, 22, 'spot', N2.visitor);
  place('biawak', 8, 18, 'contact', 'Pak Biawak'); place('kr-boardwalk', 7, 17, 'spot', N2.boardwalk);
  place('kr-mudflat', 4, 16, 'spot', N2.flats); place('kr-hide', 14, 12, 'spot', N2.hide);
  deco(4, 7.6, 'kr-post', 46); place('kr-ringpost', 4, 8, 'spot', N2.post);
  deco(12, 6.4, 'kr-camp', 104); place('kr-camp', 12, 7, 'spot', N2.camp);
  place('kr-dam', 6, 24, 'spot', N2.dam); deco(14, 23.4, 'kr-sluice', 96);
  place('kr-reservoir', 10, 25, 'spot', N2.reservoir);
  // ── the farms: the frog farm and its ponds, Hay Dairies' barn and goat pen, Bollywood Veggies' fields south of the
  // road and the old orchid greenhouse; Auntie Katak and Uncle Kambing
  bld(1, 38, 4, 3, 'kr-frogfarm'); rect(6, 38, 3, 3, G.CANAL, S.WATER);
  place('katak', 3, 42, 'contact', 'Auntie Katak'); place('kr-frogs', 7, 42, 'spot', N2.frogs);
  bld(10, 38, 4, 3, 'kr-barn');
  for (let lx = 10; lx <= 15; lx++) if (lx !== 12) prop(lx, 43.6, 'kr-fence', 10, 'none', 'over', 66);
  place('kambing', 14, 44, 'contact', 'Uncle Kambing'); place('kr-goats', 12, 44, 'spot', N2.goats);
  rect(1, 50, 10, 5, G.FIELD);
  bld(12, 51, 4, 3, 'kr-greenhouse'); place('kr-greenhouse', 13, 50, 'spot', N2.greenhouse);
  place('kr-farms', 8, 45, 'spot', N2.farms); place('kr-veggies', 5, 50, 'spot', N2.veggies);
  for (const ly of [51, 53]) for (let lx = 1; lx <= 10; lx += 3) deco(lx + 0.8, ly, 'kr-veg', 88, 'ground');
  // ── the Kranji War Memorial on its hill: a hedge all round but the gate in the south side, the memorial's columns
  // and roof at the top of the steps, the rows of headstones down the lawn. A quiet place: nothing of a job comes in
  for (let ly = M.y0; ly <= M.y1; ly++) for (let lx = M.x0; lx <= M.x1; lx++) {
    const edge = lx === M.x0 || lx === M.x1 || ly === M.y0 || ly === M.y1;
    if (edge && !(ly === M.y1 && (lx === M.gate || lx === M.gate + 1))) prop(lx, ly, 'kr-hedge', 20, 'tall', 'over', 70);
  }
  bld(23, 32, 6, 3, 'kr-memorial');
  rect(25, 35, 2, 1, G.STAIRS, S.OPEN, F_STAIRS);
  c.decals.push({ x: P(25.5, 35)[0], y: P(25.5, 35)[1], sprite: 'd-stairs', r: 0, solid: 'none', layer: 'ground', w: 1.6 * T, rot: Math.PI / 2 });
  rect(25, 36, 2, 8, G.PATH); rect(25, 44, 2, 2, G.PATH);
  for (const ly of [38, 40, 42]) for (const lx of [22.6, 28.4]) deco(lx, ly, 'kr-graves', 150, 'ground');
  place('kr-memorial', 25, 36, 'spot', N2.memorial); place('kr-memgate', 25, 45, 'spot', N2.gate);
  // ── Woodlands: HDB blocks, the kopitiam (a market), the flat (the safe house), Woodlands station; Kranji station by
  // the farms
  bld(21, 17, 4, 3, 'kr-hdb'); bld(27, 17, 4, 3, 'kr-hdb'); bld(21, 24, 4, 3, 'kr-hdb');
  bld(26, 22, 4, 3, 'kr-kopitiam'); place('mk-kranji', 27, 25, 'market', N2.kopitiam);
  bld(29, 26, 3, 2, 'kr-flat'); place('safe-kranji', 30, 28, 'safe', N2.safe);
  bld(25, 17, 2, 3, 'kr-stn'); place('stn-woodlands', 25, 20, 'station', N2.woodlandsStn);
  bld(1, 43, 3, 2, 'kr-stn'); place('stn-kranji', 2, 45, 'station', N2.kranjiStn);
  place('kr-town', 28, 21, 'spot', N2.town);

  // ── dressing: mangrove trees in the fringe and the clumps, nipa palms, rain trees along the roads, lamps
  for (let lx = 1; lx <= 15; lx += 2) deco(lx, 4.4 + (lx % 4 ? 0.3 : 0), 'kr-mangrove', 92);
  for (const ly of [8, 12, 16, 20]) deco(0, ly, 'kr-mangrove', 86);
  for (const ly of [6, 10, 14, 18]) deco(16, ly, 'kr-mangrove', 86);
  for (const [lx, ly] of CLUMPS) deco(lx, ly - 0.2, (lx + ly) % 2 ? 'kr-mangrove' : 'kr-roots', 80);
  for (const [lx, ly] of [[5, 37], [15, 37], [9, 45], [22, 45], [31, 45], [16, 51], [0, 52], [19, 6], [21, 9], [34, 23]] as const)
    if (open(lx, ly) && gr(lx, ly) !== G.ROAD && gr(lx, ly) !== G.PATH) prop(lx, ly, (lx + ly) % 3 ? 'tree-round' : 'kr-nipa', 22, 'tall', 'over', (lx + ly) % 3 ? undefined : 80);
  for (const [lx, ly] of [[16, 24], [21, 15], [28, 15], [33, 29], [20, 45], [11, 45], [26, 11]] as const) if (open(lx, ly) && gr(lx, ly) !== G.ROAD && !inMem(lx, ly)) prop(lx, ly, 'lamp', 8, 'tall');
  // hiding spots (none inside the memorial's hedge)
  for (const [lx, ly] of [[9, 21], [15, 41], [22, 21], [34, 27], [9, 55]] as const) if (open(lx, ly) && !inMem(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground' }); }

  // ── the MRT runs on: Kranji and Woodlands stations come first on the line (underground: the trains you see on the
  // viaduct are as they were), and taxi stands at Woodlands and on Kranji Road
  const isle = c.isle;
  if (isle) {
    const pw = c.places['stn-woodlands'], pk = c.places['stn-kranji'];
    const line: [number, number][] = [[pw.x, pw.y], [pk.x, pk.y], ...isle.line];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[2];
    const sw: Station = { id: 'stn-woodlands', name: pw.name!, x: pw.x, y: pw.y, d: pw.d, s: 0 };
    const sk: Station = { id: 'stn-kranji', name: pk.name!, x: pk.x, y: pk.y, d: pk.d, s: lineLen[1] };
    isle.stations = [sw, sk, ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
    isle.taxiStands.push(P(31, 16), P(8, 45));
  }

  // the rides: bikes by the visitor centre and Kranji station, a scooter in Woodlands
  const park: Kranji['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'kranji', kind, rot }); };
  ride(6.5, 23, 'bike'); ride(4.5, 45, 'bike'); ride(23, 15, 'scooter', 0);
  const q = (lx: number, dir: 1 | -1) => ({ x: P(lx, 0)[0], y0: P(0, CAUSEWAY.y0)[1] - T / 2, y1: P(0, CAUSEWAY.y1)[1] + T / 2, dir });
  c.kranji = {
    flats: [...O(FLATS.x0, FLATS.y0), ...O(FLATS.x1, FLATS.y1)],
    crocs: [P(6, 12), P(12, 10), P(2, 7)], birds: [P(9, 10), P(5, 14), P(13, 14.4)], skippers: [P(3, 9), P(8, 8), P(11, 12), P(6, 15), P(14, 7)],
    lizard: [P(2, 16), P(12, 16), P(14, 15), P(14, 12)],
    hide: P(14, 12), pen: P(12, 44), ponds: P(7, 41.4), goats: [P(10.6, 42.2), P(12.8, 42.6), P(14.6, 42)], frogs: [P(6.2, 41.2), P(8.4, 40.6), P(5.6, 39.4)],
    respect: P(25.5, 36.4),
    queue: [q(CAUSEWAY.x0, 1), q(CAUSEWAY.x0 + 1, 1), q(CAUSEWAY.x0 + 2, -1), q(CAUSEWAY.x0 + 3, -1)],
    jetty: P(32.5, 0.4), quiet: [...O(M.x0, M.y0), ...O(M.x1, M.y1)], park,
  };
}

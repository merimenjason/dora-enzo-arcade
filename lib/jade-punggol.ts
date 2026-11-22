// Jade Street: the twenty-fifth pass's district, Punggol and Coney Island, in the north-east. Runs last on the finished
// city (after the Southern Islands), so nothing built before moves. Built in the build frame's extra rows (lib/jade-layout.ts
// PGL: old columns 140 to 175, rows 128 to 157), its own block, which the layout table sets down in the open sea south of
// Pulau Ubin, beyond Changi: Punggol Point's jetty looks north across the water at the island. 36 tiles wide and 30 deep.
// (Punggol is really west of Ubin across Serangoon Harbour; this map's only free corner is here.) No land joins it: the
// MRT runs to Punggol station (underground, the line's first stop), and no roads come in, so no taxis and no traffic.
// Punggol Point in the north-west (the Promenade along the shore, the jetty out over the water, the old tide-gauge house
// on its stilts), Coney Island across the river mouth in the north-east (casuarina woods on needle litter, the wild beach
// along its north shore, the free-roaming Brahman cattle and their pasture gate, an old beach villa's ruin, the bridges at
// its west and east ends), Punggol town and the Waterway in the south-west (HDB blocks either side of the water, the
// boardwalks along both banks, footbridges over it, Punggol station, a waterfront seafood kopitiam, the kayak and bike
// hire), the Lorong Halus wetland in the south-east (reed ponds the Waterway runs into, the red bridge, the wetland hut)
// with the old sea wall's promenade down the east edge; the park connectors' red cycle track along the north bank and
// down the middle. Real place names; the people are invented. Pure data: lib/jade-punggolfest.ts holds the things to do,
// lib/jade-herd.ts the herding step and lib/jade-punggoldraw.ts the moving parts.
import { T, OLD_W as W, BUILD_H, G, S, F_PARK, F_BRIDGE, PGL_X0, PGL_Y0, PGL_W, PGL_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import type { Station } from './jade-island.js';

export type Punggol = {
  /** where the Brahman cattle graze on Coney Island when no herding job runs (world), and the calf's spot */
  cattle: [number, number][]; calf: [number, number];
  /** the otters' run along the Waterway (world: a line they swim up and down) */
  otters: [number, number][];
  /** the casuarinas the oriental pied hornbills sit in (world) */
  hornbills: [number, number][];
  /** the end of Punggol Point Jetty (world): fish off it; the Promenade's lookout across the water at Pulau Ubin */
  jetty: [number, number]; lookout: [number, number];
  /** where Madam Sutera's black junk rides at anchor off Coney while she is about (world: out on the water) */
  junk: [number, number];
  /** the district's parked rides: appended to the city's parking after every older ride */
  park: { x: number; y: number; d: 'punggol'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** a Punggol tile (local column and row) in the old (build) frame */
export const pglOld = (lx: number, ly: number): [number, number] => [PGL_X0 + lx, PGL_Y0 + ly];
/** the real names; the keeper, the ranger, the scientist, the kayak man and the Pucong Boys are fictional */
export const PUNGGOL_NAMES = {
  point: 'Punggol Point', prom: 'Punggol Promenade', jetty: 'Punggol Point Jetty', gauge: 'the old tide-gauge house', coney: 'Coney Island',
  westBridge: 'Coney Island’s west bridge', eastBridge: 'Coney Island’s east bridge', beach: 'Coney Island’s wild beach', pen: 'the cattle gate',
  villa: 'the old beach villa', post: 'the survey post', camp: 'the Pucong Boys’ camp', waterway: 'Punggol Waterway', boardwalk: 'the Waterway boardwalk',
  town: 'Punggol', kopitiam: 'the Punggol Point kopitiam', kiosk: 'the Waterway kayak hire', halus: 'Lorong Halus Wetland', hut: 'the wetland hut',
  redBridge: 'the red bridge', seawall: 'the old sea wall', pcn: 'the park connector', stn: 'Punggol station', safe: 'the Punggol flat',
};
/** the Waterway (local rows) and the town's west-east reach of it */
export const WATERWAY = { x0: 0, x1: 22, y0: 21, y1: 22 } as const;
/** Coney Island (local, inclusive) */
export const CONEY = { x0: 15, y0: 3, x1: 35, y1: 11 } as const;
/** the trail across Coney Island, west bridge to the east end (local tiles): the herding step's cattle walk it */
export const CONEY_TRAIL: [number, number][] = [[15, 7], [19, 7], [23, 8], [27, 8], [31, 7], [34, 7]];

export function punggol(c: City) {
  // (the arrays already reach BUILD_H: the Southern Islands grew them)
  const N = W * BUILD_H;
  if (c.ground.length < N) {
    const g = new Uint8Array(N).fill(G.SEA), s = new Uint8Array(N).fill(S.WATER), f = new Uint8Array(N);
    g.set(c.ground); s.set(c.solid); f.set(c.flags); c.ground = g; c.solid = s; c.flags = f;
  }
  const at = (x: number, y: number) => y * W + x;
  const inP = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < PGL_W && ly < PGL_H;
  const O = pglOld;
  const setT = (lx: number, ly: number, g: number, s: number = S.OPEN, f = 0) => { if (!inP(lx, ly)) return; const [x, y] = O(lx, ly); const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (lx: number, ly: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = ly; y < ly + h; y++) for (let x = lx; x < lx + w; x++) setT(x, y, g, s, f); };
  const gr = (lx: number, ly: number) => { if (!inP(lx, ly)) return G.SEA; const [x, y] = O(lx, ly); return c.ground[at(x, y)]; };
  const open = (lx: number, ly: number) => { if (!inP(lx, ly)) return false; const [x, y] = O(lx, ly); return c.solid[at(x, y)] === S.OPEN; };
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
  const N2 = PUNGGOL_NAMES;

  // ── the ground: park grass, the sea along the top (Pulau Ubin across it) and down the east edge (Serangoon Harbour)
  rect(0, 0, PGL_W, PGL_H, G.GRASS, S.OPEN, F_PARK);
  rect(0, 0, PGL_W, 3, G.SEA, S.WATER);
  rect(35, 12, 1, PGL_H - 12, G.SEA, S.WATER);
  // ── Punggol Point: the Promenade along the shore, the jetty out over the water, the old tide-gauge house on its stilts
  rect(0, 3, 12, 1, G.PGDECK);
  rect(5, 0, 2, 3, G.PLANK, S.OPEN, F_BRIDGE);
  bld(9, 4, 2, 2, 'pg-gauge');
  deco(11.2, 1.6, 'pg-tidestaff', 40);
  place('pg-point', 2, 5, 'spot', N2.point); place('pg-prom', 8, 3, 'spot', N2.prom); place('pg-jetty', 5, 0, 'spot', N2.jetty);
  place('pg-gauge', 10, 6, 'spot', N2.gauge); place('pekaka', 8, 6, 'contact', 'Puan Pekaka');
  for (const lx of [1, 3.6, 8]) deco(lx, 3.7, 'pg-bench', 62);
  // ── the river mouth between the Point and Coney Island, and the channel south of the island; Coney's west bridge
  rect(12, 3, 3, 9, G.SEA, S.WATER);
  rect(12, 12, 23, 2, G.SEA, S.WATER);
  rect(12, 6, 3, 2, G.PLANK, S.OPEN, F_BRIDGE);
  place('pg-westbridge', 13, 6, 'spot', N2.westBridge);
  // ── Coney Island: casuarina woods on needle litter, the wild beach along the north shore, the trail end to end, the
  // cattle's pasture by the west bridge (its gate, a trough), the old villa's ruin, the survey post under a casuarina by
  // it, and the Pucong Boys' camp in the trees at the east end; the east bridge over the channel to Lorong Halus
  rect(CONEY.x0, CONEY.y0, CONEY.x1 - CONEY.x0 + 1, CONEY.y1 - CONEY.y0 + 1, G.NEEDLES, S.OPEN, F_PARK);
  rect(CONEY.x0, 3, CONEY.x1 - CONEY.x0 + 1, 1, G.SAND, S.OPEN, F_PARK);
  for (let k = 1; k < CONEY_TRAIL.length; k++) {
    const [ax, ay] = CONEY_TRAIL[k - 1], [bx, by] = CONEY_TRAIL[k];
    for (let lx = Math.min(ax, bx); lx <= Math.max(ax, bx); lx++) setT(lx, ay + Math.round((by - ay) * (lx - ax) / Math.max(1, bx - ax)), G.PATH, S.OPEN, F_PARK);
  }
  rect(32, 8, 2, 4, G.PATH, S.OPEN, F_PARK);
  rect(32, 12, 2, 2, G.PLANK, S.OPEN, F_BRIDGE);
  place('pg-eastbridge', 32, 13, 'spot', N2.eastBridge);
  bld(25, 5, 3, 2, 'pg-villa'); place('pg-villa', 26, 7, 'spot', N2.villa);
  deco(23.6, 9.2, 'pg-post', 40); place('pg-post', 24, 9, 'spot', N2.post);
  deco(30.6, 4.6, 'pg-camp', 110); place('pg-camp', 30, 6, 'spot', N2.camp);
  place('bubut', 17, 5, 'contact', 'Cik Bubut'); place('pg-coney', 20, 6, 'spot', N2.coney); place('pg-beach', 22, 3, 'spot', N2.beach);
  prop(17, 10, 'pg-gate', 14, 'none', 'over', 70); place('pg-pen', 17, 9, 'spot', N2.pen);
  deco(19.4, 10.2, 'pg-trough', 60);
  // ── the park connectors' red track: along the channel's south bank, from Punggol Point down to it, and down the middle
  // between the town and the wetland (over the Waterway on a little bridge)
  rect(0, 14, 35, 1, G.CYCLE);
  rect(2, 4, 1, 10, G.CYCLE);
  rect(23, 15, 1, 15, G.CYCLE);
  setT(23, 21, G.PLANK, S.OPEN, F_BRIDGE); setT(23, 22, G.PLANK, S.OPEN, F_BRIDGE);
  place('pg-pcn', 12, 14, 'spot', N2.pcn);
  // ── Punggol town: the Waterway through the middle, its boardwalks either bank and footbridges over it; HDB blocks,
  // Punggol station, the waterfront kopitiam (a market), the flat (the safe house) and the kayak hire
  rect(0, 15, 23, 6, G.PGDECK);
  rect(WATERWAY.x0, WATERWAY.y0, WATERWAY.x1 - WATERWAY.x0 + 1, 2, G.CANAL, S.WATER);
  rect(0, 23, 23, 1, G.PGDECK);
  for (const lx of [6, 15]) rect(lx, 21, 2, 2, G.PLANK, S.OPEN, F_BRIDGE);
  bld(0, 15, 4, 3, 'pg-hdb'); bld(6, 15, 3, 2, 'pg-stn'); bld(11, 15, 4, 3, 'pg-kopitiam'); bld(17, 15, 4, 3, 'pg-hdb2');
  place('stn-punggol', 7, 17, 'station', N2.stn); place('mk-punggol', 12, 18, 'market', N2.kopitiam);
  place('pg-waterway', 10, 20, 'spot', N2.waterway); place('pg-town', 4, 19, 'spot', N2.town);
  bld(0, 25, 4, 3, 'pg-hdb2'); bld(6, 25, 3, 2, 'pg-flat'); bld(11, 25, 4, 3, 'pg-hdb'); bld(16, 26, 4, 3, 'pg-hdb2');
  place('safe-punggol', 7, 27, 'safe', N2.safe);
  bld(20, 24, 2, 2, 'pg-kiosk'); place('berang', 22, 24, 'contact', 'Encik Berang'); place('pg-kiosk', 21, 26, 'spot', N2.kiosk);
  rect(0, 28, 23, 2, G.PATH, S.OPEN, F_PARK);
  deco(18.6, 23.5, 'pg-kayaks', 90); deco(9.6, 19.6, 'pg-bikerack', 90);
  place('pg-bikes', 9, 18, 'spot', 'the bicycle rack by Punggol station');
  // ── the Lorong Halus wetland: the reed ponds (the Waterway runs into the first), the red bridge over it, the wetland hut;
  // the old sea wall's promenade down the east edge, and paths across
  rect(24, 20, 5, 4, G.MARSH, S.WATER);
  rect(29, 15, 4, 3, G.MARSH, S.WATER);
  rect(26, 25, 6, 3, G.MARSH, S.WATER);
  rect(26, 20, 2, 4, G.PLANK, S.OPEN, F_BRIDGE);
  deco(26.5, 23.4, 'pg-redbridge', 140, 'ground');
  rect(24, 19, 11, 1, G.PATH, S.OPEN, F_PARK); rect(28, 24, 7, 1, G.PATH, S.OPEN, F_PARK);
  rect(34, 15, 1, 15, G.PGDECK);
  bld(30, 21, 3, 2, 'pg-hut'); place('tempua', 29, 23, 'contact', 'Dr Tempua'); place('pg-hut', 31, 23, 'spot', N2.hut);
  place('pg-halusbikes', 30, 19, 'spot', 'Dr Tempua’s bicycle'); place('pg-halus', 25, 18, 'spot', N2.halus); place('pg-redbridge', 26, 22, 'spot', N2.redBridge); place('pg-seawall', 34, 21, 'spot', N2.seawall);
  for (const [lx, ly] of [[24.2, 19.6], [28.6, 20.2], [24.6, 23.6], [28.8, 15.4], [32.6, 17.6], [25.6, 25.2], [31.6, 27.4], [29, 25]] as const) deco(lx, ly, 'pg-reeds', 70);
  for (const ly of [16, 20, 24, 28]) deco(34.6, ly, 'pg-bench', 56);

  // ── dressing: casuarinas through Coney's woods and along the Point, lamps on the boardwalks
  for (const [lx, ly] of [[16, 4], [21, 5], [22, 10], [24, 4], [28, 10], [29, 4], [33, 5], [35, 9], [26, 10], [31, 10], [0, 8], [5, 9], [10, 9], [24, 26], [33, 27]] as const)
    if (open(lx, ly) && gr(lx, ly) !== G.PATH && gr(lx, ly) !== G.CYCLE) prop(lx, ly, 'pg-casuarina', 20, 'tall', 'over', 92);
  for (const [lx, ly] of [[5, 20], [12, 20], [19, 20], [3, 24], [10, 24], [14, 24], [7, 4], [34, 18], [34, 26], [22, 14]] as const) if (open(lx, ly)) prop(lx, ly, 'lamp', 8, 'tall');
  // hiding spots
  for (const [lx, ly] of [[9, 10], [27, 9], [22, 27], [33, 22], [4, 29]] as const) if (open(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground', w: 36 }); }

  // ── the MRT runs on: Punggol station comes first on the line (underground: the trains you see on the viaduct are as they
  // were). No taxi stand: no road comes in
  const isle = c.isle;
  if (isle) {
    const pp = c.places['stn-punggol'];
    const line: [number, number][] = [[pp.x, pp.y], ...isle.line];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[1];
    const sp: Station = { id: 'stn-punggol', name: pp.name!, x: pp.x, y: pp.y, d: pp.d, s: 0 };
    isle.stations = [sp, ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
  }

  // the rides: bikes by the station and at Coney's west bridge, a kayak on the Waterway by the hire
  const park: Punggol['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'punggol', kind, rot }); };
  ride(9, 18.5, 'bike'); ride(11, 7.5, 'bike'); ride(30, 19.5, 'bike'); ride(19, 22, 'kayak', Math.PI / 2);
  c.punggol = {
    cattle: [P(18, 8), P(20, 8.6), P(21.6, 7.6)], calf: P(19.2, 9.2),
    otters: [P(1, 21.5), P(22, 21.5)],
    hornbills: [P(21, 5), P(29, 4), P(28, 10)],
    jetty: P(5.5, 0.2), lookout: P(3, 3.4), junk: P(30, 0.4), park,
  };
}

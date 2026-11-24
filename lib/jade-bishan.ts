// Jade Street: the twenty-sixth pass's district, Bishan and Ang Mo Kio, the heartland towns north of Toa Payoh. Runs last
// on the finished city (after Punggol), so nothing built before moves. Built in the build frame's extra rows
// (old columns 180 to 235, rows 128 to 159), its own block (lib/jade-layout.ts BSH: the 30 rows inside a blank top and
// bottom margin), which the layout table sets down for now in the open sea east of Kallang's block (two columns of sea
// between them). 56 tiles wide and 30 deep as the world shows it. Its real
// place is directly north of Toa Payoh (Bishan's south edge on Toa Payoh's north edge), which the geography pass gives
// it: the south row is paved walk all along, ready to meet Toa Payoh's. No land joins it for now: the MRT runs to Bishan
// (the North-South and Circle Line interchange) and Ang Mo Kio, and no roads come in, so no taxis and no traffic.
// North to south, as on the real map: Ang Mo Kio town along the top (the elevated MRT station, AMK Hub, the market and
// food centre, the slab blocks, a void deck with its stone chess table, the Kebun Baru bird-singing corner's poles and
// shelter, the town garden's pond); Bishan-Ang Mo Kio Park through the middle, the Kallang River dug out of its old
// concrete canal and let wander again (rocky grassed banks, pebbly shallows, footbridges at either end, a wide bend
// with two lines of stepping stones across it, the old stone bridge's ruin and the survey stone on the south bank, the
// otters' holt, the Koel Boys' hangout under a rain tree); Bishan along the bottom (the MRT interchange, Junction 8, the
// red-roofed blocks, a void deck dressed for a Malay wedding, the park cafe, the flat). Real place names; the people are
// invented, and the survey stone is the story's. Pure data: lib/jade-bishanfest.ts holds the things to do,
// lib/jade-stones.ts the stepping-stones step and lib/jade-bishandraw.ts the moving parts.
import { T, OLD_W as W, BUILD_H, G, S, F_PARK, F_BRIDGE, BSH_X0, BSH_Y0, BSH_W, BSH_H, districtAtOld as districtAt, type City, type Prop } from './jade-city.js';
import type { Station } from './jade-island.js';

export type Bishan = {
  /** the otters' runs along the riverbanks (world: lines the Bishan Ten bound up and down), and their holt */
  otters: [number, number][][]; holt: [number, number];
  /** the two stepping-stone crossings (world: the bank you start from, each stone, the far bank), west then east */
  crossings: [number, number][][];
  /** the river's wide bend (world rect x0, y0, x1, y1): the surge ripples run down it */
  bend: [number, number, number, number];
  /** the void-deck chess table (world: sit at it to play a blitz game with the uncles) */
  chess: [number, number];
  /** the park's grassy bank (world: the top, where you sit on a flattened carton, and the bottom you slide to) */
  bank: [[number, number], [number, number]];
  /** the bird-singing poles (world): the cages hang from them */
  poles: [number, number][];
  /** the void deck's wedding dais (world) */
  dais: [number, number];
  /** the district's parked rides: appended to the city's parking after every older ride */
  park: { x: number; y: number; d: 'bishan'; kind: string; rot: number }[];
};
const px = (t: number) => t * T + T / 2;
/** a Bishan tile (local column and row) in the old (build) frame */
export const bshOld = (lx: number, ly: number): [number, number] => [BSH_X0 + lx, BSH_Y0 + ly];
/** the real names; the uncle, the auntie, the engineer, the wedding dresser and the Koel Boys are fictional */
export const BISHAN_NAMES = {
  amk: 'Ang Mo Kio', amkStn: 'Ang Mo Kio station', hub: 'AMK Hub', market: 'the Ang Mo Kio market and food centre', voiddeck: 'the Ang Mo Kio void deck',
  chess: 'the void-deck chess table', birds: 'the Kebun Baru bird-singing corner', garden: 'Ang Mo Kio Town Garden',
  park: 'Bishan-Ang Mo Kio Park', river: 'the Kallang River', bend: 'the river’s wide bend', stonesW: 'the west stepping stones', stonesE: 'the east stepping stones',
  bridgeW: 'the park’s west footbridge', bridgeE: 'the park’s east footbridge', oldBridge: 'the old stone bridge', survey: 'the survey stone',
  holt: 'the otters’ holt', koel: 'the Koel Boys’ rain tree', bishan: 'Bishan', bishanStn: 'Bishan station', j8: 'Junction 8',
  wedding: 'the Bishan void-deck wedding', cafe: 'the park cafe', safe: 'the Bishan flat',
};
/** the river (local rows): a narrow channel either side of the wide bend between columns BEND.x0 and BEND.x1 */
export const RIVER = { y0: 14, y1: 16 } as const;
export const BEND = { x0: 18, x1: 38, y0: 11, y1: 19 } as const;
/** the stepping-stone crossings (local tiles), north bank to south bank: the west line straight across, the east line
 * zigzagging. Stones on even rows of the bend, water between: you can only cross by hopping */
export const STONES_W: [number, number][] = [[24, 10], [24, 12], [24, 14], [24, 16], [24, 18], [24, 20]];
export const STONES_E: [number, number][] = [[33, 10], [34, 12], [32, 14], [34, 16], [32, 18], [33, 20]];

export function bishan(c: City) {
  // (the arrays already reach BUILD_H: the Southern Islands grew them)
  const N = W * BUILD_H;
  if (c.ground.length < N) {
    const g = new Uint8Array(N).fill(G.SEA), s = new Uint8Array(N).fill(S.WATER), f = new Uint8Array(N);
    g.set(c.ground); s.set(c.solid); f.set(c.flags); c.ground = g; c.solid = s; c.flags = f;
  }
  const at = (x: number, y: number) => y * W + x;
  const inB = (lx: number, ly: number) => lx >= 0 && ly >= 0 && lx < BSH_W && ly < BSH_H;
  const O = bshOld;
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
  const N2 = BISHAN_NAMES;

  // ── the ground: the towns' paving along the top (Ang Mo Kio) and the bottom (Bishan), the park's grass through the
  // middle (its last row a plain walk, for the geography pass to join to Toa Payoh's). Rows 0 and 31 are a blank margin
  // the world does not show (lib/jade-layout.ts BSH): nothing stands on them
  rect(0, 0, BSH_W, 10, G.AMK);
  rect(0, 10, BSH_W, 12, G.GRASS, S.OPEN, F_PARK);
  rect(0, 22, BSH_W, BSH_H - 22, G.AMK);
  rect(0, BSH_H - 2, BSH_W, 1, G.WALK);
  // ── the Kallang River: a narrow channel with rocky banks, and the wide bend in the middle of the park
  rect(0, RIVER.y0 - 1, BSH_W, RIVER.y1 - RIVER.y0 + 3, G.RIVERBANK, S.OPEN, F_PARK);
  rect(0, RIVER.y0, BSH_W, RIVER.y1 - RIVER.y0 + 1, G.SHALLOWS, S.WATER);
  rect(BEND.x0 - 1, BEND.y0 - 1, BEND.x1 - BEND.x0 + 3, BEND.y1 - BEND.y0 + 3, G.RIVERBANK, S.OPEN, F_PARK);
  rect(BEND.x0, BEND.y0, BEND.x1 - BEND.x0 + 1, BEND.y1 - BEND.y0 + 1, G.SHALLOWS, S.WATER);
  // the stepping stones: their tiles are rock you stand on, water between (the step hops you over it)
  for (const [lx, ly] of [...STONES_W, ...STONES_E]) if (ly > BEND.y0 - 1 && ly < BEND.y1 + 1) setT(lx, ly, G.RIVERBANK, S.OPEN, F_PARK);
  STONES_W.slice(1, -1).forEach(([lx, ly], k) => deco(lx, ly, k % 2 ? 'bs-stonelo' : 'bs-stonehi', 62, 'ground'));
  STONES_E.slice(1, -1).forEach(([lx, ly], k) => deco(lx, ly, k % 2 ? 'bs-stonelo' : 'bs-stonehi', 62, 'ground'));
  place('bs-stonesw', STONES_W[0][0], STONES_W[0][1], 'spot', N2.stonesW); place('bs-stonese', STONES_E[0][0], STONES_E[0][1], 'spot', N2.stonesE);
  // footbridges at either end of the park
  for (const lx of [8, 47]) { rect(lx, RIVER.y0, 2, RIVER.y1 - RIVER.y0 + 1, G.PLANK, S.OPEN, F_BRIDGE); deco(lx + 0.5, RIVER.y0 + 1, 'bs-footbridge', 124, 'ground'); }
  place('bs-bridgew', 8, RIVER.y0 - 1, 'spot', N2.bridgeW); place('bs-bridgee', 47, RIVER.y1 + 1, 'spot', N2.bridgeE);
  // the old stone bridge's ruin on the south bank of the bend, and the survey stone in the bank beside it
  deco(28.5, 20.3, 'bs-oldbridge', 120); place('bs-oldbridge', 28, 21, 'spot', N2.oldBridge);
  prop(26, 20, 'bs-survey', 12, 'low', 'over', 34); place('bs-survey', 25, 21, 'spot', N2.survey);
  place('bs-park', 14, 11, 'spot', N2.park); place('bs-bend', 30, 10, 'spot', N2.bend);
  // the otters' holt on the east bank; the Koel Boys' rain tree on the north lawn, west of the bend
  place('bs-holt', 43, 17, 'spot', N2.holt);
  deco(13.5, 11.6, 'bs-koelcamp', 120); place('bs-koel', 12, 12, 'spot', N2.koel);
  for (const [lx, ly] of [[4, 18.4], [41, 12.6], [52, 18.4], [16, 18.6]] as const) deco(lx, ly, 'bs-reeds', 66);

  // ── Ang Mo Kio: the elevated MRT station, AMK Hub, the market and food centre (a market: Auntie Puyuh's hokkien mee),
  // the slab blocks, the void deck and its chess table, the Kebun Baru bird-singing corner, the town garden's pond
  bld(1, 1, 6, 3, 'bs-amkstn'); place('stn-angmokio', 4, 5, 'station', N2.amkStn);
  bld(9, 1, 5, 3, 'bs-amkhub'); place('bs-hub', 11, 5, 'spot', N2.hub);
  bld(16, 1, 5, 3, 'bs-market'); place('mk-bishan', 18, 5, 'market', N2.market); place('puyuh', 21, 5, 'contact', 'Auntie Puyuh');
  bld(23, 1, 5, 3, 'bs-amkhdb'); bld(30, 1, 5, 3, 'bs-amkhdb');
  bld(37, 1, 4, 3, 'bs-voiddeck'); prop(39, 5, 'bs-chess', 16, 'low', 'over', 72); place('bs-chess', 38, 6, 'spot', N2.chess);
  bld(44, 1, 3, 3, 'bs-birdshelter'); place('merbok', 45, 5, 'contact', 'Uncle Merbok'); place('bs-birds', 50, 6, 'spot', N2.birds);
  const poles: [number, number][] = [[48, 2], [51, 2], [54, 2], [48, 5], [54, 5]];
  for (const [lx, ly] of poles) prop(lx, ly, 'bs-birdpole', 10, 'tall', 'over', 60);
  rect(25, 6, 9, 3, G.GRASS, S.OPEN, F_PARK); rect(27, 7, 5, 1, G.SHALLOWS, S.WATER); place('bs-garden', 29, 6, 'spot', N2.garden);
  place('bs-amk', 14, 7, 'spot', N2.amk);

  // ── Bishan: the MRT interchange, Junction 8, the red-roofed blocks, the wedding void deck, the park cafe (Dr Kura's
  // river kiosk beside it), the flat (the safe house)
  bld(2, 23, 5, 3, 'bs-bishanstn'); place('stn-bishan', 4, 27, 'station', N2.bishanStn);
  bld(9, 23, 5, 3, 'bs-j8'); place('bs-j8', 11, 27, 'spot', N2.j8);
  bld(16, 23, 3, 3, 'bs-bshhdb'); bld(21, 23, 3, 3, 'bs-bshhdb'); bld(16, 27, 3, 3, 'bs-bshhdb');
  bld(26, 23, 4, 3, 'bs-voiddeck'); deco(28, 27.3, 'bs-pelamin', 92); place('kijang', 26, 27, 'contact', 'Mak Andam Kijang'); place('bs-wedding', 30, 28, 'spot', N2.wedding);
  bld(36, 22, 4, 2, 'bs-cafe'); place('kura', 35, 24, 'contact', 'Dr Kura'); place('bs-cafe', 38, 25, 'spot', N2.cafe);
  bld(43, 23, 3, 3, 'bs-bshhdb'); bld(49, 23, 5, 3, 'bs-amkhdb');
  bld(46, 27, 4, 3, 'bs-bshhdb'); place('safe-bishan', 47, 30, 'safe', N2.safe);
  place('bs-bishan', 22, 28, 'spot', N2.bishan);

  // ── dressing: rain trees in the park and along the walks, lamps, benches
  for (const [lx, ly] of [[2, 11], [6, 20], [11, 19], [20, 21], [36, 21], [42, 20], [50, 11], [53, 20], [16, 11], [39, 10], [1, 8], [21, 8], [36, 8], [52, 27], [14, 29], [33, 30]] as const)
    if (open(lx, ly)) prop(lx, ly, 'bs-raintree', 20, 'tall', 'over', 104);
  for (const [lx, ly] of [[7, 7], [16, 7], [35, 5], [43, 7], [6, 12], [45, 12], [9, 20], [31, 22], [7, 29], [24, 30], [40, 28]] as const) if (open(lx, ly) && gr(lx, ly) !== G.PLANK) prop(lx, ly, 'lamp', 8, 'tall');
  for (const [lx, ly] of [[18, 10.6], [30, 21.6], [44, 10.6], [4, 21.6]] as const) deco(lx, ly, 'pg-bench', 56);
  // hiding spots
  for (const [lx, ly] of [[3, 9], [20, 20], [41, 9], [13, 30], [52, 29]] as const) if (open(lx, ly)) { const [x, y] = P(lx, ly); c.hides.push({ x, y }); c.props.push({ x, y: y - T / 2 + 14, sprite: 'basket', r: 0, solid: 'none', layer: 'ground', w: 36 }); }

  // ── the MRT runs on: Bishan, then Ang Mo Kio, come first on the line (the trains you see are as they were)
  const isle = c.isle;
  if (isle) {
    const bp = c.places['stn-bishan'], ap = c.places['stn-angmokio'];
    const line: [number, number][] = [[bp.x, bp.y], [ap.x, ap.y], ...isle.line];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const shift = lineLen[2];
    const stn = (p: typeof bp, id: string, s: number): Station => ({ id, name: p.name!, x: p.x, y: p.y, d: p.d, s });
    isle.stations = [stn(bp, 'stn-bishan', 0), stn(ap, 'stn-angmokio', lineLen[1]), ...isle.stations.map(s => ({ ...s, s: s.s + shift }))];
    isle.line = line; isle.lineLen = lineLen; isle.visFrom += shift;
  }

  // the rides: bikes by both stations and at the park cafe
  const park: Bishan['park'] = [];
  const ride = (lx: number, ly: number, kind: string, rot = 0) => { const [x, y] = P(lx, ly); park.push({ x, y, d: 'bishan', kind, rot }); };
  ride(7.5, 27, 'bike'); ride(7.5, 6, 'bike'); ride(40.5, 24.5, 'bike');
  c.bishan = {
    otters: [[P(2, 13), P(17, 13), P(17, 10)], [P(40, 17), P(54, 17)], [P(46, 13), P(54, 13)]], holt: P(43, 17.6),
    crossings: [STONES_W.map(([lx, ly]) => P(lx, ly)), STONES_E.map(([lx, ly]) => P(lx, ly))],
    bend: [...P(BEND.x0 - 0.5, BEND.y0 - 0.5), ...P(BEND.x1 + 0.5, BEND.y1 + 0.5)] as [number, number, number, number],
    chess: P(39, 5), bank: [P(14, 21), P(14, 18.6)], poles: poles.map(([lx, ly]) => P(lx, ly)), dais: P(28, 27.3), park,
  };
}

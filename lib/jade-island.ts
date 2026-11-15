// Jade Street: the island. Runs last on the finished city (after Chinatown's build, remodel, dressing and Singapore
// pass), so nothing in Chinatown moves: it fills the 92 columns east of it. North of the Pan Island Expressway are the
// Toa Payoh heartlands (slab and point blocks with void decks, a neighbourhood centre, a kopitiam, a multi-storey car
// park, playgrounds, a wet market, a hawker centre, the bus interchange and the elevated MRT station); south of it the
// Marina Bay front (glass towers, Raffles Place, the waterfront promenade round the bay, the Triple Sails resort, the
// floating stage, the domed theatre, the observation wheel and the tree grove). The Central Expressway runs down the
// seam, the East Coast Parkway crosses the bay mouth on a bridge, and Chinatown's east-west roads run on into the
// island. The MRT line (the Jade Line) runs underground from Chinatown to Raffles Place and Bayfront, then climbs onto
// a viaduct to Toa Payoh. Real public place and road names; every company-like name is a parody. Pure data.
import { T, W, OW, CT_H, G, S, F_BRIDGE, F_PARK, ROADS, XWAYS, ISLE_X1, districtAt, type City, type District, type Prop } from './jade-city.js';
import { rng } from './jade-rng.js';

export type Station = { id: string; name: string; x: number; y: number; d: District; s: number };
export type Isle = {
  /** the elevated viaduct you can see (world units), and the whole line through every station (abstract, for trains) */
  rail: [number, number][]; line: [number, number][]; lineLen: number[];
  /** how far along the line the track comes up out of the ground (trains past it are seen on the viaduct) */
  visFrom: number;
  stations: Station[];
  /** where taxis wait for a fare */
  taxiStands: [number, number][];
  /** each gang's hideout */
  hideouts: Record<'otter' | 'mac' | 'liz' | 'crow', [number, number]> & { myna?: [number, number] };
  /** the floating stage's walkable deck (tile rect) */
  stage: [number, number, number, number];
};
/** expressway lanes are flagged so they are painted as expressway (the ground stays road for every rule) */
export const F_XWAY = 32;
const px = (t: number) => t * T + T / 2;

/** the parody names on the bay front (no real companies, resorts or attractions) */
export const ISLE_NAMES = {
  resort: 'Triple Sails Resort', stage: 'the Float-About Stage', domes: 'the Durian Domes', wheel: 'the Bay Spinner', grove: 'the Super Grove',
  line: 'the Jade Line', taxiApp: 'Tumpang!', crows: 'Kaypoh Crows Pte Ltd',
};

export function island(c: City) {
  const at = (x: number, y: number) => y * W + x;
  const R = rng(20261116);
  const setT = (x: number, y: number, g: number, s: number = S.OPEN, f = 0) => { if (x < OW || y < 0 || x >= W || y >= CT_H) return; const i = at(x, y); c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const rect = (x0: number, y0: number, w: number, h: number, g: number, s: number = S.OPEN, f = 0) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(x, y, g, s, f); };
  const water = (x: number, y: number) => { const g = c.ground[at(x, y)]; return g === G.SEA || g === G.BAY || g === G.CANAL; };
  const bld = (x: number, y: number, w: number, h: number, sprite: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = at(xx, yy); c.ground[i] = G.BLD; c.solid[i] = S.BUILDING; c.flags[i] = 0; }
    c.buildings.push({ x, y, w, h, sprite, front: true });
  };
  const prop = (x: number, y: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number, rot?: number) => {
    const i = at(Math.floor(x), Math.floor(y));
    if (solid === 'low') c.solid[i] = S.LOW; if (solid === 'tall') c.solid[i] = S.TALL;
    c.props.push({ x: x * T + T / 2, y: y * T + T / 2, sprite, r, solid, layer, w, rot });
  };
  const deco = (x: number, y: number, sprite: string, w?: number, rot?: number) => c.props.push({ x: x * T + T / 2, y: y * T + T / 2, sprite, r: 0, solid: 'none', layer: 'over', w, rot });
  const place = (name: string, x: number, y: number, kind: string, label?: string) => { c.places[name] = { x: px(x), y: px(y), d: districtAt(x, y), kind, name: label }; };

  // ── the ground: heartland concrete above the Pan Island Expressway, the bay front's granite below it
  for (let y = 0; y < CT_H; y++) for (let x = OW; x < W; x++) setT(x, y, y < 38 ? G.HDB : G.GRANITE);
  // the east coast and the harbour run on along the south; the bay opens into it under the East Coast Parkway
  // (lib/jade-east.ts builds Little India and Kampong Glam over the sea east of the Rochor River afterwards)
  rect(ISLE_X1 + 1, 0, W - ISLE_X1 - 1, CT_H, G.SEA, S.WATER);
  rect(OW, 82, W - OW, CT_H - 82, G.SEA, S.WATER);
  rect(146, 68, 48, 14, G.BAY, S.WATER);
  // the grass verges of the Central Expressway, a park strip along the heartlands' north edge
  rect(OW, 0, 2, 82, G.GRASS, S.OPEN, F_PARK); rect(126, 0, 2, 82, G.GRASS, S.OPEN, F_PARK);
  rect(128, 0, 37, 3, G.GRASS, S.OPEN, F_PARK);
  // the boardwalks round the bay's two sides, the floating stage and its walkway
  rect(144, 68, 2, 10, G.DECK); rect(194, 68, 2, 10, G.DECK);
  rect(150, 69, 8, 6, G.DECK); rect(146, 71, 4, 2, G.DECK, S.OPEN, F_BRIDGE);
  // the longkang: a storm drain along the heartlands' south edge (where the Longkang Lizards lounge)
  rect(128, 34, 12, 2, G.CANAL, S.WATER);
  // the otters' breakwater out in the harbour
  rect(197, 84, 7, 3, G.DOCK); rect(204, 82, 2, 3, G.PLANK);

  // ── roads: the kerbs, then the lanes over them so crossings join up; over water they are bridges
  // the island's own roads end at the Rochor River (lib/jade-east.ts lays the rest)
  const isle = (r: typeof ROADS[number]) => r.axis === 'h' ? r.to >= OW && r.at < CT_H : r.at >= OW && r.at <= ISLE_X1;
  const span = (r: typeof ROADS[number]) => r.axis === 'h' ? [Math.max(r.from, OW), Math.min(r.to, ISLE_X1)] : [r.from, r.to];
  const xw = new Set(XWAYS.map(i => ROADS[i]));
  for (const r of ROADS) if (isle(r)) { const [a, b] = span(r); for (let s = a; s <= b; s++) for (let k = 0; k < 4; k++) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (x < OW || c.ground[at(x, y)] === G.ROAD) continue;
    if (water(x, y) || (c.flags[at(x, y)] & F_BRIDGE)) { setT(x, y, G.BRIDGE, S.OPEN, F_BRIDGE); continue; }
    setT(x, y, xw.has(r) ? G.GRASS : (y < 38 ? G.HDB : G.GRANITE));
  } }
  for (const r of ROADS) if (isle(r)) { const [a, b] = span(r); for (let s = a; s <= b; s++) for (let k = 1; k < 3; k++) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (x < OW) continue;
    const i = at(x, y); const br = c.ground[i] === G.BRIDGE;
    c.ground[i] = br ? G.BRIDGE : G.ROAD; c.solid[i] = S.OPEN; c.flags[i] = (br ? F_BRIDGE : 0) | (xw.has(r) ? F_XWAY : 0);
  } }
  // the expressway verges carry crash barriers (hop them on foot; nobody strolls along an expressway)
  for (const i of XWAYS) { const r = ROADS[i]; const [a, b] = span(r);
    for (let s = a + 1; s < b; s += 1) for (const k of [0, 3]) {
      const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s; const t = at(x, y);
      if (c.ground[t] !== G.GRASS || cross(x, y)) continue;
      // keep a gap at every junction approach
      if (ROADS.some((o, j) => j !== i && o.axis !== r.axis && (r.axis === 'h' ? x >= o.at - 2 && x <= o.at + 5 && r.at + 3 >= o.from && r.at <= o.to : y >= o.at - 2 && y <= o.at + 5 && r.at + 3 >= o.from && r.at <= o.to))) continue;
      c.solid[t] = S.LOW;
      if (s % 2 === 0) c.props.push({ x: px(x), y: px(y), sprite: 'xw-barrier', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: r.axis === 'h' ? 0 : Math.PI / 2 });
    } }
  function cross(x: number, y: number) { let h = false, v = false; for (const r of ROADS) { if (r.axis === 'h' && y >= r.at && y <= r.at + 3 && x >= r.from && x <= r.to) h = true; if (r.axis === 'v' && x >= r.at && x <= r.at + 3 && y >= r.from && y <= r.to) v = true; } return h && v; }
  // lane dashes, zebra crossings at the avenue junctions (none on the expressways), the bridge deck over the bay mouth
  for (const r of ROADS) if (isle(r)) { const [a, b] = span(r); for (let s = a; s <= b; s += 2) {
    const x = r.axis === 'h' ? s : r.at + 2, y = r.axis === 'h' ? r.at + 2 : s;
    if (x < OW || cross(x, y) || (r.axis === 'h' ? cross(x, y - 1) : cross(x - 1, y))) continue;
    c.decals.push({ x: r.axis === 'h' ? x * T + T / 2 : x * T, y: r.axis === 'h' ? y * T : y * T + T / 2, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: r.axis === 'h' ? 0 : Math.PI / 2 });
  } }
  for (const r of ROADS) for (const r2 of ROADS) {
    if (r.axis !== 'h' || r2.axis !== 'v' || r2.at < OW || r2.at > ISLE_X1 || xw.has(r) || xw.has(r2) || r2.at + 3 < r.from || r2.at > r.to || r.at + 3 < r2.from || r.at > r2.to) continue;
    if (r.from <= r2.at - 2) c.decals.push({ x: (r2.at - 0.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r.to >= r2.at + 5) c.decals.push({ x: (r2.at + 4.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r2.from <= r.at - 2) c.decals.push({ x: (r2.at + 2) * T, y: (r.at - 0.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
    if (r2.to >= r.at + 5) c.decals.push({ x: (r2.at + 2) * T, y: (r.at + 4.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
  }

  // ── Toa Payoh: the heartlands
  // north park and the Bukit Bunch's rain tree
  for (const [x, y] of [[130, 1], [139, 1], [147, 1], [156, 1], [163, 1]] as const) prop(x, y, 'tree-round', 22, 'tall');
  prop(134, 1, 'hide-mac', 40, 'tall', 'over', 150);
  // block A: a slab block with its void deck, letterboxes and a stone table
  bld(127, 4, 10, 4, 'hdb-slab-a'); prop(129, 9, 'void-table', 22, 'tall', 'over', 84); prop(135, 9, 'letterbox', 18, 'tall', 'over', 84);
  deco(132, 10, 'bicycles', 90); prop(138, 6, 'bougain', 16, 'tall', 'over', 60);
  // block B: point blocks round a dragon playground and an exercise corner
  bld(145, 4, 4, 4, 'hdb-point-a'); bld(151, 3, 10, 4, 'hdb-slab-b'); bld(161, 4, 4, 4, 'hdb-point-b');
  rect(151, 8, 7, 3, G.RUBBER); prop(154, 9, 'playground', 40, 'tall', 'over', 150); prop(159, 9, 'exercise', 20, 'tall', 'over', 90);
  deco(147, 10, 'laundry', 96);
  // block C: the multi-storey car park, two slab blocks, a durian stall and a bus stop
  bld(171, 3, 6, 5, 'hdb-mscp'); bld(179, 3, 10, 4, 'hdb-slab-a'); bld(192, 3, 10, 4, 'hdb-slab-b');
  prop(184, 9, 'durian-stall', 24, 'tall', 'over', 96); prop(176, 10, 'bus-stop', 22, 'tall', 'over', 110); prop(198, 9, 'void-table', 22, 'tall', 'over', 84);
  // block D: the kopitiam at the foot of a point block
  bld(127, 16, 4, 4, 'hdb-kopitiam'); bld(133, 16, 4, 4, 'hdb-point-b'); prop(138, 19, 'bougain', 16, 'tall', 'over', 60);
  // block E: the neighbourhood centre and the wet market
  bld(145, 16, 8, 4, 'hdb-nc'); bld(157, 16, 6, 6, 'hdb-market'); prop(154, 20, 'void-table', 22, 'tall', 'over', 84);
  // block F: a slab block, the community club and a point block; block G: one more point block
  bld(171, 16, 10, 4, 'hdb-slab-b'); bld(183, 16, 5, 5, 'hdb-cc'); bld(190, 16, 4, 4, 'hdb-point-a'); bld(201, 16, 4, 4, 'hdb-point-b');
  deco(175, 21, 'laundry', 96); prop(195, 20, 'letterbox', 18, 'tall', 'over', 84);
  // block H: the hawker centre, the safe house, the drain
  bld(127, 26, 5, 4, 'hdb-hawker'); bld(134, 26, 3, 3, 'lm-safe'); prop(129, 31, 'void-table', 22, 'tall', 'over', 84);
  prop(129, 33, 'hide-liz', 30, 'tall', 'over', 120);
  // block I: the MRT station (elevated), the bus interchange, the provision shop market and a taxi stand
  bld(148, 26, 8, 4, 'hdb-stn'); bld(157, 26, 8, 3, 'hdb-bus');
  for (const [x, y, s] of [[157, 31, 'stall-fruit'], [161, 31, 'stall-tea']] as const) { for (let k = 0; k < 2; k++) c.solid[at(x + k, y)] = S.TALL; c.props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: s, r: 0, solid: 'none', layer: 'over', w: 2.1 * T }); }
  prop(146, 32, 'taxi-stand', 24, 'tall', 'over', 110); prop(153, 31, 'stn-pillar', 10, 'tall', 'over', 40);
  // block J: a slab block and a point block, a second playground; block K: a point block
  bld(171, 27, 10, 4, 'hdb-slab-a'); bld(190, 27, 4, 4, 'hdb-point-b'); bld(201, 27, 4, 4, 'hdb-point-a');
  rect(183, 31, 5, 3, G.RUBBER); prop(185, 32, 'playground', 40, 'tall', 'over', 130); deco(176, 33, 'laundry', 96);
  place('safe-heartland', 135, 29, 'safe', 'Void Deck safe house');
  place('mk-heartland', 159, 33, 'market', 'Toa Payoh provision shop');
  place('kamal', 152, 31, 'contact', 'Mr Kamal'); place('stn-toapayoh', 151, 31, 'station', 'Toa Payoh station');
  place('kopitiam-tp', 129, 21, 'spot', 'Kopitiam'); place('nc', 148, 21, 'spot', 'Neighbourhood centre'); place('wetmarket-tp', 160, 23, 'spot', 'Toa Payoh wet market');
  place('playground', 154, 11, 'spot', 'Dragon playground'); place('mscp', 174, 9, 'spot', 'Multi-storey car park'); place('cc', 185, 21, 'spot', 'Community club');
  place('raintree', 134, 3, 'spot', 'the Bukit Bunch’s rain tree'); place('drain', 130, 32, 'spot', 'the Longkang Lizards’ drain'); place('lepak', 131, 31, 'contact', 'Lord Lepak');
  place('hawker-tp', 129, 31, 'spot', 'Toa Payoh hawker centre');

  // ── Marina Bay: the bay front
  bld(127, 40, 6, 6, 'bay-tower-a'); bld(133, 41, 6, 4, 'bay-hotel');
  bld(145, 40, 5, 5, 'bay-tower-b'); bld(152, 40, 6, 5, 'bay-tower-c'); bld(160, 40, 5, 5, 'bay-tower-d');
  bld(171, 40, 6, 6, 'bay-tower-a'); bld(179, 42, 9, 3, 'bay-mall'); bld(189, 40, 5, 5, 'bay-tower-b'); bld(201, 40, 6, 5, 'bay-tower-c');
  bld(127, 51, 5, 5, 'bay-tower-b'); bld(134, 51, 5, 5, 'bay-tower-d'); bld(128, 57, 3, 3, 'lm-safe');
  // Raffles Place: a granite square with the station's glass canopy and the spinning top
  bld(145, 51, 6, 6, 'bay-tower-a'); bld(159, 51, 6, 5, 'bay-tower-c'); bld(152, 53, 4, 2, 'bay-stn');
  prop(154, 59, 'spin-top', 24, 'tall', 'over', 90); prop(147, 59, 'prom-palm', 14, 'tall', 'over', 70); prop(161, 59, 'prom-palm', 14, 'tall', 'over', 70);
  bld(171, 51, 5, 5, 'bay-tower-d'); bld(178, 51, 6, 6, 'bay-tower-a'); bld(186, 58, 9, 3, 'bay-mall');
  bld(201, 54, 4, 2, 'bay-stn'); prop(206, 59, 'prom-palm', 14, 'tall', 'over', 70);
  prop(136, 59, 'crow-nest', 34, 'tall', 'over', 120);
  place('safe-bay', 129, 60, 'safe', 'Bay Loft safe house');
  place('stn-raffles', 153, 56, 'station', 'Raffles Place station'); place('stn-bayfront', 203, 57, 'station', 'Bayfront station');
  place('raffles', 153, 58, 'spot', 'Raffles Place'); place('crownest', 136, 60, 'spot', 'the Kaypoh Crows’ head office');
  // the waterfront: the promenade, the domes, the wheel, the resort, the grove and the floating stage
  bld(130, 68, 10, 5, 'bay-domes'); bld(136, 73, 5, 5, 'bay-wheel'); bld(196, 67, 12, 6, 'bay-resort'); bld(198, 74, 4, 4, 'bay-grove');
  for (let x = 128; x <= 206; x += 6) if (c.solid[at(x, 66)] === S.OPEN) prop(x, 66, x % 12 === 2 ? 'prom-palm' : 'prom-lamp', 12, 'tall', 'over', x % 12 === 2 ? 70 : 54);
  for (const x of [131, 143, 167, 185]) if (c.solid[at(x, 67)] === S.OPEN) prop(x, 67, 'prom-bench', 0, 'low', 'ground', 72);
  c.decals.push({ x: 154 * T, y: 72 * T, sprite: 'bay-stage', r: 0, solid: 'none', layer: 'ground', w: 8 * T, rot: 0 });
  place('stage', 154, 72, 'spot', 'the Float-About Stage'); place('vanda', 153, 70, 'contact', 'Ms Vanda');
  place('mk-bay', 142, 67, 'market', 'Promenade kiosk'); prop(142, 66, 'stall-red', 0, 'tall', 'over', 2.1 * T);
  place('resort', 201, 75, 'spot', 'Triple Sails Resort'); place('promenade', 170, 67, 'spot', 'the bay promenade');
  place('holt', 200, 85, 'spot', 'the Riverside Romp holt'); prop(200, 85, 'hide-otter', 30, 'tall', 'over', 130);
  prop(185, 70, 'balloons', 0, 'none', 'over', 50);

  // ── parked rides on the island's avenues (none on the expressways), bumboats in the bay and at the holt
  const Rp = rng(5150);
  for (const r of ROADS) if (isle(r) && !xw.has(r)) { const [a, b] = span(r); for (let s = a + 3; s <= b - 3; s += 11) for (const k of [0, 3]) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (x < 128 || c.solid[at(x, y)] !== S.OPEN || (c.flags[at(x, y)] & F_BRIDGE) || cross(x, y)) continue;
    const roll = Rp(); const kind = roll < 0.5 ? 'scooter' : roll < 0.75 ? 'van' : 'tuktuk';
    c.parking.push({ x: px(x), y: px(y), d: districtAt(x, y), kind, rot: r.axis === 'h' ? (k === 0 ? -Math.PI / 2 : Math.PI / 2) : (k === 0 ? 0 : Math.PI) });
  } }
  for (const [x, y] of [[146, 69], [193, 70], [199, 83], [128, 82]] as const) c.parking.push({ x: px(x), y: px(y), d: districtAt(x, y), kind: 'boat', rot: Math.PI / 2 });
  // street lamps along the island's avenues
  for (const r of ROADS) if (isle(r) && !xw.has(r)) { const [a, b] = span(r); for (let s = a + 2; s <= b - 2; s += 6) for (const k of [0, 3]) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (x < 128 || c.solid[at(x, y)] !== S.OPEN || cross(x, y) || (c.flags[at(x, y)] & F_BRIDGE) || c.parking.some(p => Math.abs(p.x - px(x)) < T && Math.abs(p.y - px(y)) < T)) continue;
    c.props.push({ x: px(x) + (r.axis === 'v' ? (k === 0 ? -20 : 20) : 0), y: px(y) + (r.axis === 'h' ? (k === 0 ? -20 : 20) : 0), sprite: y >= 38 ? 'prom-lamp' : 'lamp', r: 8, solid: 'tall', layer: 'over', w: y >= 38 ? 54 : undefined });
  } }
  // hiding spots behind the void-deck pillars and in the bay front's service lanes
  for (const [x, y] of [[137, 9], [150, 21], [181, 21], [139, 45], [168, 61], [193, 61]] as const) if (c.solid[at(x, y)] === S.OPEN) { c.hides.push({ x: px(x), y: px(y) }); c.props.push({ x: px(x), y: y * T + 14, sprite: R() < 0.55 ? 'curtain' : 'basket', r: 0, solid: 'none', layer: 'ground' }); }
  void R;

  // ── Chinatown's own station entrance (the line runs underground there), on the pavement near New Bridge Road
  let cx = 58, cy = 50;
  { let best = 1e9; for (let y = 47; y < 58; y++) for (let x = 52; x < 66; x++) {
    const i = at(x, y); const g = c.ground[i];
    if (c.solid[i] !== S.OPEN || g === G.ROAD || g === G.BRIDGE || c.flags[i] || (c.sg && c.sg.fivefoot[i])) continue;
    if (c.props.some(p => Math.abs(p.x - px(x)) < 1.6 * T && Math.abs(p.y - px(y)) < 1.6 * T) || c.parking.some(p => Math.abs(p.x - px(x)) < 1.6 * T && Math.abs(p.y - px(y)) < 1.6 * T)) continue;
    if (Object.values(c.places).some(p => Math.abs(p.x - px(x)) < 2 * T && Math.abs(p.y - px(y)) < 2 * T)) continue;
    const d = (x - 58) ** 2 + (y - 50) ** 2; if (d < best) { best = d; cx = x; cy = y; }
  } }
  c.props.push({ x: px(cx), y: px(cy) - 20, sprite: 'stn-pillar', r: 0, solid: 'none', layer: 'over', w: 40 });
  place('stn-chinatown', cx, cy, 'station', 'Chinatown station');

  // ── the MRT line: underground from Chinatown to Raffles Place and Bayfront, then up onto the viaduct to Toa Payoh
  const P = (id: string): [number, number] => [c.places[id].x, c.places[id].y];
  const portal: [number, number] = [203.5 * T, 52 * T], bend: [number, number] = [203.5 * T, 27.5 * T], tp: [number, number] = [152 * T, 27.5 * T];
  const line: [number, number][] = [P('stn-chinatown'), P('stn-raffles'), P('stn-bayfront'), portal, bend, tp];
  const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const stationAt = (id: string, k: number): Station => ({ id, name: c.places[id].name!, x: c.places[id].x, y: c.places[id].y, d: c.places[id].d, s: lineLen[k] });
  const stations = [stationAt('stn-chinatown', 0), stationAt('stn-raffles', 1), stationAt('stn-bayfront', 2), { ...stationAt('stn-toapayoh', 5) }];
  // the viaduct's pillars stand where they don't block a road
  for (let y = 30; y <= 50; y += 3) if (c.ground[at(203, y)] !== G.ROAD) c.props.push({ x: 203.5 * T, y: y * T + T / 2, sprite: 'rail-pillar', r: 0, solid: 'none', layer: 'ground', w: 52 });
  for (let x = 160; x <= 200; x += 4) if (c.ground[at(x, 27)] !== G.ROAD && c.ground[at(x, 28)] !== G.ROAD) c.props.push({ x: x * T, y: 27.5 * T + 20, sprite: 'rail-pillar', r: 0, solid: 'none', layer: 'ground', w: 52 });

  // ── the gantries on the expressways and the bay front; silver zones by the void decks and the market
  if (c.sg) {
    for (const [axis, tx, ty] of [['v', 122, 56], ['h', 180, 36], ['h', 130, 78], ['h', 150, 46], ['v', 166, 30], ['v', 122, 18]] as ['h' | 'v', number, number][]) {
      let lo = 1e9, hi = -1;
      for (let k = -3; k <= 7; k++) { const x = axis === 'h' ? tx : tx + k, y = axis === 'h' ? ty + k : ty; if (c.ground[at(x, y)] === G.ROAD || c.ground[at(x, y)] === G.BRIDGE) { lo = Math.min(lo, k); hi = Math.max(hi, k); } }
      if (hi < 0) { lo = 0; hi = 3; }
      const mid = ((axis === 'h' ? ty : tx) + (lo + hi + 1) / 2) * T, sp = (hi - lo + 1) * T + 36;
      const gx = axis === 'h' ? px(tx) : mid, gy = axis === 'h' ? mid : px(ty);
      c.sg.gantries.push({ axis, tx, ty, x: gx, y: gy });
      c.props.push({ x: gx, y: gy, sprite: 'gantry', r: 0, solid: 'none', layer: 'sky', w: sp, rot: axis === 'h' ? Math.PI / 2 : 0 });
    }
    c.sg.silver.push([127, 12, 139, 15], [144, 22, 165, 25]);
    c.sg.bins.push([px(131), px(11)], [px(150), px(22)], [px(142), px(66)]);
    c.sg.pigeons.push([px(154), px(60)]);
    for (const pk of c.parking) if (pk.kind === 'boat' && pk.x >= OW * T) c.sg.jetties.push([pk.x, pk.y]);
  }

  c.isle = { rail: [portal, bend, tp], line, lineLen, visFrom: lineLen[3] - 40, stations, taxiStands: [[px(146), px(33)], [px(150), px(60)], [px(198), px(63)], [px(cx), px(cy)]],
    hideouts: { otter: [px(200), px(85)], mac: [px(134), px(3)], liz: [px(130), px(32)], crow: [px(136), px(60)] }, stage: [150, 69, 157, 74] };
}

// Jade Street: the ninth pass's three districts. Runs last on the finished city (after Chinatown, its remodel and
// dressing, the Singapore pass and the island), so nothing built before moves. East of Toa Payoh and Marina Bay, over
// the Rochor River, are Little India (colourful shophouses along Serangoon Road and Race Course Road, the garland and
// flower stalls, spice shops, sari shops, a temple with a tall gopuram, Mustafa Centre, which never closes, the
// Tekka-style wet market and hawker centre, the Deepavali light-up arch over Serangoon Road) and Kampong Glam (the
// golden-domed mosque, Haji Lane's murals, the textile and perfume shops of Arab Street, a row of Middle-Eastern
// restaurants and Bussorah Street, where the Hari Raya bazaar sets up). South of the docks, over the harbour, is
// Sentosa: reached on foot along the boardwalk beside the Sentosa Gateway bridge, by the cable car from HarbourFront,
// by the MRT to Beach station, or by the ferry from Marina Bay. It has the beach, a theme park, a resort hotel,
// the old fort at Siloso Point and the ferry pier. Real public place and road names; the shops and attractions are
// real (owner, 16-11: real names, not parodies) or invented. Pure data: lib/jade-cable.ts runs the cable car and the ferry, lib/jade-eastdraw.ts paints.
import { T, W, H, CT_H, OW, G, S, F_BRIDGE, F_PARK, F_ALLEY, ROADS, EAST_X0, EAST_X1, EAST_SPLIT, FAR_X0, districtAt, type City, type Prop } from './jade-city.js';
import type { Station } from './jade-island.js';

/** a two-stop link you ride (the cable car, the ferry): its stops and the path between them (world units) */
export type LinkStop = { id: string; name: string; x: number; y: number };
export type Link = { id: 'cable' | 'ferry'; name: string; stops: [LinkStop, LinkStop]; path: [number, number][]; len: number[] };
export type East = {
  cable: Link; ferry: Link;
  /** the cable car's towers (world units) */
  pylons: [number, number][];
  /** the Deepavali light-up arch over Serangoon Road, the oil lamps along it and the kolam patterns at the doorsteps */
  arch: [number, number]; lamps: [number, number][]; kolams: [number, number][];
  /** the Hari Raya bazaar's stalls along Bussorah Street, and where its pelita lamps stand */
  bazaar: [number, number][]; pelita: [number, number][];
  /** the beach: spots to build a sandcastle, and the deck chairs */
  beach: [number, number][]; chairs: [number, number][];
};
const px = (t: number) => t * T + T / 2;
/** the real names of the new districts' attractions (the gangs are fictional) */
export const EAST_NAMES = {
  store: 'Mustafa Centre', park: 'Universal Studios Singapore', hotel: 'Shangri-La Rasa Sentosa', tower: 'SkyHelix Sentosa',
  aquarium: 'S.E.A. Aquarium', gang: 'the Kecoh Mynahs', cable: 'the Sentosa cable car', ferry: 'the island ferry',
};

export function east(c: City) {
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

  // ── the ground. The harbour south of the first island is open sea; the Rochor River runs down the east of the
  // island, and past it Little India (north) and Kampong Glam (south) reach the east coast
  rect(OW, CT_H, W - OW, H - CT_H, G.SEA, S.WATER);
  rect(EAST_X0, 0, EAST_X1 - EAST_X0 + 1, 82, G.INDIA);
  rect(EAST_X0, EAST_SPLIT, EAST_X1 - EAST_X0 + 1, 82 - EAST_SPLIT, G.GLAM);
  rect(EAST_X0 - 4, 0, 4, 82, G.CANAL, S.WATER);
  rect(EAST_X1 - 1, 0, 2, 82, G.GRASS, S.OPEN, F_PARK);
  // Sentosa: an island of resort paving with the fort's laterite on its west point, a promenade, the beach, the lagoon
  const SX0 = 32, SX1 = 121, SY0 = 94, SY1 = 123;
  for (let y = SY0; y <= SY1; y++) for (let x = SX0; x <= SX1; x++) {
    const cut = Math.max(0, 3 - Math.min(x - SX0, SX1 - x, y - SY0, SY1 - y)), corner = Math.min(x - SX0, SX1 - x) + Math.min(y - SY0, SY1 - y);
    if (corner < 3 && cut) continue;
    setT(x, y, x <= 45 ? G.FORT : y >= 119 ? G.SAND : y >= 116 ? G.RESORT : G.RESORT);
  }
  rect(SX0 + 2, 124, SX1 - SX0 - 3, 2, G.LAGOON, S.WATER);
  rect(32, 95, 14, 2, G.GRASS, S.OPEN, F_PARK);

  // ── roads: the ninth pass's own roads, and the stretches of the old roads that run on into the new districts
  type Seg = { axis: 'h' | 'v'; at: number; a: number; b: number; xw?: boolean };
  const segs: Seg[] = [];
  ROADS.forEach((r, i) => {
    if (r.axis === 'h' && r.at < CT_H && r.to > EAST_X0 && r.from < EAST_X0) segs.push({ axis: 'h', at: r.at, a: EAST_X0 - 4, b: r.to });
    if (r.axis === 'v' && r.at >= EAST_X0 && r.at < EAST_X1) segs.push({ axis: 'v', at: r.at, a: r.from, b: r.to });
    if (i === 10) segs.push({ axis: 'v', at: r.at, a: 82, b: r.to });
    if (i >= 21 && i <= 23) segs.push(r.axis === 'h' ? { axis: 'h', at: r.at, a: r.from, b: r.to } : { axis: 'v', at: r.at, a: r.from, b: r.to });
  });
  const kerbG = (x: number, y: number) => y >= CT_H ? (x <= 45 ? G.FORT : G.RESORT) : y < EAST_SPLIT ? G.INDIA : G.GLAM;
  const onSeg = (sg: Seg, x: number, y: number) => sg.axis === 'h' ? y >= sg.at && y < sg.at + 4 && x >= sg.a && x <= sg.b : x >= sg.at && x < sg.at + 4 && y >= sg.a && y <= sg.b;
  const cross = (x: number, y: number) => { let h = false, v = false; for (const r of ROADS) { if (r.axis === 'h' && y >= r.at && y <= r.at + 3 && x >= r.from && x <= r.to) h = true; if (r.axis === 'v' && x >= r.at && x <= r.at + 3 && y >= r.from && y <= r.to) v = true; } return h && v; };
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s++) for (let k = 0; k < 4; k++) {
    const x = sg.axis === 'h' ? s : sg.at + k, y = sg.axis === 'h' ? sg.at + k : s;
    if (!inb(x, y) || c.ground[at(x, y)] === G.ROAD) continue;
    if (water(x, y) || (c.flags[at(x, y)] & F_BRIDGE)) { setT(x, y, G.BRIDGE, S.OPEN, F_BRIDGE); continue; }
    setT(x, y, kerbG(x, y));
  }
  for (const sg of segs) for (let s = sg.a; s <= sg.b; s++) for (let k = 1; k < 3; k++) {
    const x = sg.axis === 'h' ? s : sg.at + k, y = sg.axis === 'h' ? sg.at + k : s;
    if (!inb(x, y)) continue;
    const i = at(x, y); const br = c.ground[i] === G.BRIDGE;
    c.ground[i] = br ? G.BRIDGE : G.ROAD; c.solid[i] = S.OPEN; c.flags[i] = br ? F_BRIDGE : 0;
  }
  // the Sentosa boardwalk runs beside the Gateway bridge over the harbour (walk it; boats pass under)
  rect(94, 82, 2, SY0 - 82, G.DECK, S.OPEN, F_BRIDGE);
  // lane dashes and zebra crossings
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

  // ── Little India
  // Race Course Road: the temple and its forecourt, garland stalls at the gate
  bld(214, 2, 6, 6, 'india-temple'); prop(221, 3, 'garland-stall', 22, 'tall', 'over', 96); prop(221, 7, 'flower-baskets', 18, 'tall', 'over', 80);
  deco(216, 9, 'kolam', 110, 'ground'); place('temple-li', 217, 9, 'spot', 'the Serangoon Road temple');
  // Serangoon Road's north end: Mustafa Centre and the sari shops; the villa and a shophouse row past it
  bld(229, 1, 9, 5, 'india-emporium'); bld(238, 1, 6, 4, 'india-sari');
  prop(232, 8, 'flower-baskets', 18, 'tall', 'over', 80); prop(236, 8, 'spice-sacks', 18, 'tall', 'over', 76);
  place('emporium', 233, 7, 'spot', 'Mustafa Centre');
  bld(249, 2, 5, 4, 'india-villa'); bld(255, 2, 8, 4, 'india-shop-a'); prop(252, 8, 'bougain', 16, 'tall', 'over', 60);
  // Buffalo Road: the safe house and the prata shop, the spice shops and the garland and flower market, a shophouse
  // row and the arcade
  bld(213, 17, 3, 3, 'safe-india'); bld(218, 17, 4, 4, 'india-prata');
  bld(229, 16, 6, 4, 'india-spice'); bld(236, 16, 6, 4, 'india-flower');
  bld(249, 16, 8, 4, 'india-shop-b'); bld(258, 17, 5, 3, 'india-arcade');
  prop(234, 20, 'spice-sacks', 18, 'tall', 'over', 76); prop(242, 20, 'garland-stall', 22, 'tall', 'over', 96);
  place('safe-india', 214, 20, 'safe', 'Buffalo Road safe house');
  place('raju', 231, 20, 'contact', 'Mr Raju'); place('malar', 239, 20, 'contact', 'Auntie Malar');
  place('flowers', 238, 21, 'spot', 'the garland and flower market'); place('spices', 230, 21, 'spot', 'the spice shops');
  // the Tekka-style market and hawker centre on Race Course Road, a shophouse row south of it
  bld(214, 27, 8, 6, 'india-tekka'); bld(213, 37, 8, 4, 'india-shop-a');
  for (let k = 0; k < 2; k++) for (const [x, y, s] of [[214, 34, 'stall-fruit'], [218, 34, 'stall-tea']] as const) { c.solid[at(x + k, y)] = S.TALL; if (!k) c.props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: s, r: 0, solid: 'none', layer: 'over', w: 2.1 * T }); }
  place('mk-india', 217, 35, 'market', 'Tekka market'); place('hawker-li', 220, 33, 'spot', 'the Tekka hawker centre');
  // Little India station (elevated, under the viaduct), a shophouse row, the sari shops on the square
  bld(228, 26, 8, 4, 'india-shop-b'); bld(236, 26, 8, 4, 'hdb-stn');
  bld(229, 35, 6, 4, 'india-sari'); prop(237, 37, 'void-table', 22, 'tall', 'over', 84);
  place('stn-littleindia', 239, 31, 'station', 'Little India station');
  bld(249, 27, 8, 4, 'india-shop-c'); bld(258, 27, 5, 4, 'india-villa');
  prop(252, 36, 'tree-round', 22, 'tall'); prop(259, 38, 'tree-round', 22, 'tall');
  place('serangoon', 241, 36, 'spot', 'Serangoon Road');
  // the Deepavali light-up: an arch over Serangoon Road, oil lamps along the pavements, kolams at the doorsteps
  const arch: [number, number] = [246 * T, 34 * T];
  deco(246, 34, 'deepavali-arch', 5 * T, 'sky');
  const lamps: [number, number][] = [], kolams: [number, number][] = [];
  for (let y = 4; y <= 40; y += 4) for (const x of [243, 248]) if (c.solid[at(x, y)] === S.OPEN && c.ground[at(x, y)] !== G.ROAD) lamps.push([px(x), px(y)]);
  for (const [x, y] of [[233, 7], [240, 21], [225 + 6, 33], [252, 32], [221, 21], [262, 8]] as const) if (c.solid[at(x, y)] === S.OPEN) kolams.push([px(x), px(y)]);

  // ── Kampong Glam
  // the Arab Street market: carpet and textile stalls along the north side of Arab Street
  for (const x of [229, 232, 235, 238, 241]) prop(x, 43, x % 2 ? 'carpet-stall' : 'textile-stall', 20, 'tall', 'over', 92);
  place('mk-glam', 234, 44, 'market', 'Arab Street market');
  // a row of Middle-Eastern restaurants, the safe house
  bld(213, 51, 8, 4, 'glam-cafe'); bld(213, 57, 3, 3, 'safe-glam'); prop(222, 55, 'cafe-tables', 0, 'low', 'ground', 110);
  place('safe-glam', 214, 60, 'safe', 'Kandahar Street safe house'); place('cafes', 217, 56, 'spot', 'the restaurant row');
  // the textile shops and the perfume shop, Haji Lane (a narrow lane of murals), more of its shophouses
  bld(229, 50, 8, 4, 'glam-textile'); bld(238, 50, 4, 4, 'glam-perfume');
  rect(228, 55, 16, 2, G.COBBLE, S.OPEN, F_ALLEY);
  bld(229, 57, 8, 3, 'glam-haji'); bld(238, 57, 4, 4, 'glam-perfume');
  place('kancil', 232, 54, 'contact', 'Abang Kancil'); place('wangi', 239, 54, 'contact', 'Puan Wangi');
  place('hajilane', 235, 56, 'spot', 'Haji Lane');
  // a row of mynahs gossiping on the wires over Haji Lane
  deco(236, 55, 'kecoh-flock', 150, 'sky');
  // the golden-domed mosque, its forecourt and palms
  bld(251, 50, 10, 8, 'glam-mosque');
  for (const x of [249, 262]) for (const y of [52, 56]) prop(x, y, 'prom-palm', 14, 'tall', 'over', 70);
  place('mosque', 255, 59, 'spot', 'the Sultan Mosque');
  // Bugis station and a café row; Bussorah Street, where the Hari Raya bazaar sets up between palms
  bld(231, 67, 4, 2, 'bay-stn'); bld(235, 73, 8, 4, 'glam-cafe');
  place('stn-bugis', 233, 70, 'station', 'Bugis station');
  bld(213, 67, 6, 4, 'glam-bussorah'); bld(213, 75, 8, 4, 'glam-textile');
  bld(248, 67, 6, 4, 'glam-bussorah'); bld(258, 67, 6, 4, 'glam-shop');
  rect(255, 66, 2, 16, G.COBBLE);
  for (let y = 67; y <= 80; y += 3) { prop(254, y, 'prom-palm', 14, 'tall', 'over', 70); prop(257, y, 'prom-palm', 14, 'tall', 'over', 70); }
  const bazaar: [number, number][] = [], pelita: [number, number][] = [];
  for (let y = 72; y <= 80; y += 4) for (const x of [252, 259]) if (c.solid[at(x, y)] === S.OPEN) { bazaar.push([px(x), px(y)]); c.solid[at(x, y)] = S.TALL; }
  for (let y = 68; y <= 80; y += 2) pelita.push([px(255) - 8, px(y)], [px(256) + 8, px(y)]);
  place('bussorah', 256, 74, 'spot', 'Bussorah Street');
  // the Kecoh Mynahs' roost: a big rain tree by the east coast park
  prop(269, 72, 'hide-myna', 34, 'tall', 'over', 150);
  deco(267, 74, 'myna-perch', 44); deco(271, 71, 'myna-perch', 40);
  place('roost', 269, 74, 'spot', 'the Kecoh Mynahs’ roost'); place('bising', 270, 76, 'contact', 'Boss Bising');

  // ── Sentosa
  // HarbourFront: the cable car station on a little quay at the docks' edge
  rect(104, 82, 8, 6, G.DOCK); bld(105, 82, 6, 4, 'resort-cable');
  place('cable-harbour', 107, 86, 'cable', 'HarbourFront cable car');
  // the old fort on Siloso Point
  bld(34, 97, 10, 8, 'resort-fort'); prop(36, 107, 'cannon', 20, 'tall', 'over', 90); prop(42, 107, 'cannon', 20, 'tall', 'over', 90);
  place('fort', 39, 106, 'spot', 'Fort Siloso'); place('helang', 41, 109, 'contact', 'Sergeant Helang');
  // the north side of Siloso Road: the safe house, the cable car station, the sky tower, Beach station, the hotel
  bld(50, 95, 3, 3, 'safe-resort'); place('safe-resort', 51, 98, 'safe', 'Siloso safe house');
  bld(64, 95, 6, 4, 'resort-cable'); place('cable-sentosa', 66, 99, 'cable', 'Sentosa cable car');
  bld(76, 95, 4, 4, 'resort-tower'); place('skytower', 78, 99, 'spot', EAST_NAMES.tower);
  bld(96, 95, 6, 3, 'resort-stn'); place('stn-beach', 98, 98, 'station', 'Beach station');
  bld(104, 94, 12, 5, 'resort-hotel'); place('hotel', 109, 99, 'spot', EAST_NAMES.hotel);
  // between the roads: the villas, the theme park's gate and its roller coaster, the coral dome, the ferry terminal
  bld(47, 105, 6, 4, 'resort-villa'); bld(65, 105, 8, 6, 'resort-gate'); bld(75, 104, 10, 7, 'resort-coaster');
  prop(87, 108, 'carousel', 40, 'tall', 'over', 150); prop(70, 111, 'balloons', 0, 'none', 'over', 50);
  place('park', 69, 111, 'spot', EAST_NAMES.park);
  bld(96, 105, 6, 5, 'resort-aquarium'); place('aquarium', 99, 110, 'spot', EAST_NAMES.aquarium);
  bld(112, 105, 6, 4, 'resort-ferry'); rect(118, 107, 7, 2, G.DECK, S.OPEN, F_BRIDGE);
  place('ferry-sentosa', 122, 107, 'ferry', 'Sentosa ferry pier'); place('duyung', 115, 110, 'contact', 'Kapten Duyung');
  // the promenade and the beach: bars, the kiosk market, umbrellas and deck chairs, a lifeguard tower, palms
  bld(50, 116, 5, 3, 'resort-bar'); bld(100, 116, 5, 3, 'resort-bar');
  prop(82, 117, 'stall-red', 0, 'tall', 'over', 2.1 * T); place('mk-resort', 82, 118, 'market', 'Siloso beach kiosk');
  const chairs: [number, number][] = [], beach: [number, number][] = [];
  for (let x = 48; x <= 116; x += 6) { prop(x, 120, x % 12 === 0 ? 'beach-umbrella' : 'prom-palm', 12, 'tall', 'over', x % 12 === 0 ? 76 : 70); if (x % 12 === 0) { deco(x + 1, 121, 'deck-chair', 54, 'ground'); chairs.push([px(x + 1), px(121)]); } }
  prop(90, 122, 'lifeguard', 18, 'tall', 'over', 84);
  for (const x of [57, 75, 95, 111]) beach.push([px(x), px(122)]);
  deco(66, 122, 'beach-ball', 30, 'ground'); deco(104, 121, 'surfboard', 56, 'ground'); deco(84, 122, 'surfboard', 56, 'ground');
  place('beach', 76, 121, 'spot', 'Siloso Beach');
  for (let x = 48; x <= 118; x += 7) if (c.solid[at(x, 116)] === S.OPEN) prop(x, 116, 'prom-lamp', 12, 'tall', 'over', 54);

  // the cable car: from HarbourFront over the harbour to Sentosa, its towers standing in the water
  const cA: [number, number] = [107.5 * T, 84 * T], cB: [number, number] = [66.5 * T, 97 * T];
  const pylons: [number, number][] = [0.33, 0.66].map(k => [cA[0] + (cB[0] - cA[0]) * k, cA[1] + (cB[1] - cA[1]) * k]);
  for (const [x, y] of pylons) c.props.push({ x, y, sprite: 'cable-pylon', r: 0, solid: 'none', layer: 'ground', w: 70 });
  const link = (id: 'cable' | 'ferry', name: string, a: string, b: string, path: [number, number][]): Link => {
    const len = [0]; for (let i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const S = (k: string): LinkStop => ({ id: k, name: c.places[k].name!, x: c.places[k].x, y: c.places[k].y });
    return { id, name, stops: [S(a), S(b)], path, len };
  };
  const cable = link('cable', EAST_NAMES.cable, 'cable-harbour', 'cable-sentosa', [cA, cB]);
  // the ferry: from the Sentosa pier east round the harbour and in under the East Coast Parkway to the bay's boardwalk
  place('ferry-bay', 195, 74, 'ferry', 'Marina Bay ferry stop');
  const ferry = link('ferry', EAST_NAMES.ferry, 'ferry-sentosa', 'ferry-bay', ([[125, 108], [140, 104], [166, 94], [170, 84], [172, 76], [186, 74], [192.5, 74]] as [number, number][]).map(([x, y]) => [x * T, y * T] as [number, number]));

  // ── parked rides and street lamps along the new roads, hiding spots, a taxi stand each
  const bridgeOrRoad = (x: number, y: number) => c.flags[at(x, y)] & F_BRIDGE || c.ground[at(x, y)] === G.ROAD;
  let k = 0;
  for (const sg of segs) for (let s = sg.a + 3; s <= sg.b - 3; s += 11) for (const kk of [0, 3]) {
    const x = sg.axis === 'h' ? s : sg.at + kk, y = sg.axis === 'h' ? sg.at + kk : s;
    if (!inb(x, y) || c.solid[at(x, y)] !== S.OPEN || bridgeOrRoad(x, y) || cross(x, y) || (sg.axis === 'h' && x < EAST_X0 && y < CT_H)) continue;
    const kind = ++k % 4 === 0 ? 'van' : k % 4 === 2 ? 'tuktuk' : 'scooter';
    c.parking.push({ x: px(x), y: px(y), d: districtAt(x, y), kind, rot: sg.axis === 'h' ? (kk === 0 ? -Math.PI / 2 : Math.PI / 2) : (kk === 0 ? 0 : Math.PI) });
  }
  for (const sg of segs) for (let s = sg.a + 2; s <= sg.b - 2; s += 6) for (const kk of [0, 3]) {
    const x = sg.axis === 'h' ? s : sg.at + kk, y = sg.axis === 'h' ? sg.at + kk : s;
    if (!inb(x, y) || c.solid[at(x, y)] !== S.OPEN || bridgeOrRoad(x, y) || cross(x, y) || c.parking.some(p => Math.abs(p.x - px(x)) < T && Math.abs(p.y - px(y)) < T)) continue;
    c.props.push({ x: px(x) + (sg.axis === 'v' ? (kk === 0 ? -20 : 20) : 0), y: px(y) + (sg.axis === 'h' ? (kk === 0 ? -20 : 20) : 0), sprite: y >= CT_H ? 'prom-lamp' : 'lamp', r: 8, solid: 'tall', layer: 'over', w: y >= CT_H ? 54 : undefined });
  }
  for (const [x, y] of [[226 - 3, 10], [247 + 3, 24], [227, 56], [246 + 4, 64], [58, 98], [93, 110]] as const) if (c.solid[at(x, y)] === S.OPEN && !bridgeOrRoad(x, y)) { c.hides.push({ x: px(x), y: px(y) }); c.props.push({ x: px(x), y: y * T + 14, sprite: (x + y) % 2 ? 'curtain' : 'basket', r: 0, solid: 'none', layer: 'ground' }); }
  for (const [x, y] of [[221, 41], [214, 61], [233, 62], [91, 99], [118, 111]] as const) prop(x, y, 'bougain', 16, 'tall', 'over', 60);
  for (const pk of c.parking) if (pk.kind === 'boat' && pk.y >= CT_H * T) c.sg?.jetties.push([pk.x, pk.y]);
  c.parking.push({ x: px(112), y: px(87), d: 'docks', kind: 'boat', rot: Math.PI / 2 });

  // ── the MRT runs on: from Beach station under the harbour to Chinatown, then (as before) to Raffles Place and
  // Bayfront, on under the Rochor River to Bugis, up a portal to Little India's elevated station, and west along the
  // viaduct to Toa Payoh
  const isle = c.isle;
  if (isle) {
    const P = (id: string): [number, number] => [c.places[id].x, c.places[id].y];
    const portal: [number, number] = [241.5 * T, 44 * T], li: [number, number] = [241.5 * T, 27.5 * T], tp: [number, number] = [152 * T, 27.5 * T];
    const line: [number, number][] = [P('stn-beach'), P('stn-chinatown'), P('stn-raffles'), P('stn-bayfront'), P('stn-bugis'), portal, li, tp];
    const lineLen = [0]; for (let i = 1; i < line.length; i++) lineLen.push(lineLen[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const st = (id: string, kk: number): Station => ({ id, name: c.places[id].name!, x: c.places[id].x, y: c.places[id].y, d: c.places[id].d, s: lineLen[kk] });
    isle.line = line; isle.lineLen = lineLen; isle.rail = [portal, li, tp]; isle.visFrom = lineLen[5] - 40;
    isle.stations = [st('stn-beach', 0), st('stn-chinatown', 1), st('stn-raffles', 2), st('stn-bayfront', 3), st('stn-bugis', 4), st('stn-littleindia', 6), st('stn-toapayoh', 7)];
    // the viaduct's pillars: along Little India's stretch and on over the river (the old climb by Bayfront is gone)
    c.props = c.props.filter(p => !(p.sprite === 'rail-pillar' && Math.abs(p.x - 203.5 * T) < 2));
    for (let y = 31; y <= 42; y += 3) if (c.ground[at(241, y)] !== G.ROAD) c.props.push({ x: 241.5 * T, y: y * T + T / 2, sprite: 'rail-pillar', r: 0, solid: 'none', layer: 'ground', w: 52 });
    for (let x = 204; x <= 232; x += 4) if (c.ground[at(x, 27)] !== G.ROAD && c.ground[at(x, 28)] !== G.ROAD && !water(x, 27)) c.props.push({ x: x * T, y: 27.5 * T + 20, sprite: 'rail-pillar', r: 0, solid: 'none', layer: 'ground', w: 52 });
    isle.taxiStands.push([px(226 + 1), px(33)], [px(246 + 2), px(58)], [px(88), px(99)]);
    isle.hideouts.myna = [px(269), px(72)];
  }

  // ── gantries at the bridges into Little India and Kampong Glam and on the Sentosa Gateway; silver zones by the
  // market, the temple and the mosque; bins and pigeons
  if (c.sg) {
    for (const [axis, tx, ty] of [['h', 214, 12], ['h', 214, 46], ['v', 90, 96]] as ['h' | 'v', number, number][]) {
      let lo = 1e9, hi = -1;
      for (let kk = -3; kk <= 7; kk++) { const x = axis === 'h' ? tx : tx + kk, y = axis === 'h' ? ty + kk : ty; if (c.ground[at(x, y)] === G.ROAD || c.ground[at(x, y)] === G.BRIDGE) { lo = Math.min(lo, kk); hi = Math.max(hi, kk); } }
      if (hi < 0) { lo = 0; hi = 3; }
      const mid = ((axis === 'h' ? ty : tx) + (lo + hi + 1) / 2) * T, sp = (hi - lo + 1) * T + 36;
      const gx = axis === 'h' ? px(tx) : mid, gy = axis === 'h' ? mid : px(ty);
      c.sg.gantries.push({ axis, tx, ty, x: gx, y: gy });
      c.props.push({ x: gx, y: gy, sprite: 'gantry', r: 0, solid: 'none', layer: 'sky', w: sp, rot: axis === 'h' ? Math.PI / 2 : 0 });
    }
    c.sg.silver.push([212, 26, 223, 36], [248, 58, 263, 61]);
    c.sg.bins.push([px(222), px(21)], [px(236), px(45)], [px(86), px(118)]);
    c.sg.pigeons.push([px(256), px(60)]);
  }
  c.east = { cable, ferry, pylons, arch, lamps, kolams, bazaar, pelita, beach, chairs };
}
/** the twelfth pass: the back lanes of Little India and Kampong Glam were bare. Every 5 × 5 block of open pavement with
 * no prop near gets a bench (townsfolk walk over and sit: lib/jade-folk.ts dests) and a bit of everyday clutter, all
 * underfoot or overhead so no job's route is blocked. Deterministic: no random draws, so nothing else moves */
export function backLanes(c: City) {
  const has = new Set(c.props.map(p => Math.floor(p.y / T) * W + Math.floor(p.x / T)));
  const DECO = { india: ['flower-baskets', 'spice-sacks', 'bicycles', 'laundry', 'bougain'], glam: ['cafe-tables', 'bicycles', 'laundry', 'bougain', 'carpet'] } as const;
  const W2: Record<string, number> = { 'flower-baskets': 80, 'spice-sacks': 76, bicycles: 90, laundry: 96, bougain: 60, 'cafe-tables': 110, carpet: 90 };
  let k = 0;
  for (let by = 0; by < CT_H; by += 5) for (let bx = EAST_X0; bx < FAR_X0 - 4; bx += 5) {
    const d = districtAt(bx + 2, by + 2); if (d !== 'india' && d !== 'glam') continue;
    let open = 0, near = 0;
    for (let y = by; y < by + 5; y++) for (let x = bx; x < bx + 5; x++) {
      const i = y * W + x; if (c.solid[i] === S.OPEN && c.ground[i] !== G.ROAD && c.ground[i] !== G.BRIDGE) open++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (has.has(i + dy * W + dx)) near++;
    }
    if (open < 18 || near) continue;
    const ok = (x: number, y: number) => c.solid[y * W + x] === S.OPEN && c.ground[y * W + x] !== G.ROAD && !Object.values(c.places).some(p => Math.abs(p.x / T - 0.5 - x) < 2 && Math.abs(p.y / T - 0.5 - y) < 2);
    const spots = [[bx + 1, by + 1], [bx + 3, by + 3], [bx + 3, by + 1], [bx + 1, by + 3]].filter(([x, y]) => ok(x, y));
    if (spots.length < 2) continue;
    const [[x0, y0], [x1, y1]] = spots, deco = DECO[d][k++ % DECO[d].length];
    c.props.push({ x: x0 * T + T / 2, y: y0 * T + T / 2, sprite: 'plaza-bench', r: 0, solid: 'none', layer: 'ground' });
    c.props.push({ x: x1 * T + T / 2, y: y1 * T + T / 2, sprite: deco, r: 0, solid: 'none', layer: deco === 'laundry' || deco === 'bougain' ? 'over' : 'ground', w: W2[deco] });
  }
}

// Jade Street: the city. A 120×92 tile harbour quarter (64 world units a tile) built once, deterministically, from a
// hand-laid plan: five districts, a grid of two-lane streets (traffic keeps left), back alleys, a canal with bridges,
// the temple park, the docks and piers, flat-roof terraces you can run across, and every named place the story uses.
// Ground (what is painted), solid (what blocks you) and flags (alley, stairs, roof, bridge) are separate layers.
// Pure data and queries: no drawing here (lib/jade-scene.ts paints it).
import { rng } from './jade-rng.js';
import { remodel, type Path, type FestivalSpot } from './jade-remodel.js';

export const T = 64;
export const W = 120, H = 92;
export const WORLD_W = W * T, WORLD_H = H * T;

export const G = { SEA: 0, CANAL: 1, ROAD: 2, WALK: 3, PLAZA: 4, GRASS: 5, DOCK: 6, PLANK: 7, TEMPLE: 8, NEON: 9, PATH: 10, COBBLE: 11, BRIDGE: 12, STAIRS: 13, BLD: 14 } as const;
export type G = (typeof G)[keyof typeof G];
export const GROUND_NAMES = ['sea', 'canal', 'road', 'walk', 'plaza', 'grass', 'dock', 'plank', 'temple', 'neon', 'path', 'cobble', 'bridge', 'stairs', 'bld'] as const;
/** solid: 0 open, 1 building, 2 water, 3 tall prop (stall, container), 4 low prop (hop over on foot) */
export const S = { OPEN: 0, BUILDING: 1, WATER: 2, TALL: 3, LOW: 4 } as const;
export type S = (typeof S)[keyof typeof S];
/** flags */
export const F_ALLEY = 1, F_STAIRS = 2, F_ROOF = 4, F_BRIDGE = 8, F_PARK = 16;

export type District = 'market' | 'temple' | 'canal' | 'docks' | 'arcade';
export const DISTRICTS: District[] = ['market', 'temple', 'canal', 'docks', 'arcade'];
export const DISTRICT_NAME: Record<District, string> = { market: 'Night Market', temple: 'Temple Hill', canal: 'Canal Quarter', docks: 'the Docks', arcade: 'Arcade Strip' };
export function districtAt(tx: number, ty: number): District {
  if (tx < 46) return ty < 30 ? 'temple' : 'market';
  if (ty >= 62) return 'docks';
  return tx < 75 ? 'canal' : 'arcade';
}

export type Building = { x: number; y: number; w: number; h: number; sprite: string; front: boolean; roof?: boolean };
export type Prop = { x: number; y: number; sprite: string; r: number; solid: 'tall' | 'low' | 'none'; layer: 'ground' | 'over' | 'sky'; w?: number; rot?: number };
export type Road = { axis: 'h' | 'v'; at: number; from: number; to: number };
export type Place = { x: number; y: number; d: District; kind: string; name?: string };
export type City = {
  ground: Uint8Array; solid: Uint8Array; flags: Uint8Array;
  buildings: Building[]; props: Prop[]; roads: Road[]; decals: Prop[];
  places: Record<string, Place>; cats: { x: number; y: number }[]; murals: { id: string; x: number; y: number }[];
  ladders: { x: number; y: number; rx: number; ry: number }[]; hides: { x: number; y: number }[]; parking: { x: number; y: number; d: District; kind: string; rot: number }[];
  /** painted footpaths that curve over open ground, the food-court tables, and the festival dressing (lib/jade-remodel.ts) */
  paths: Path[]; tables: Prop[]; festival: FestivalSpot[];
};

// the street plan: horizontal and vertical roads, 4 tiles wide (kerb, lane, lane, kerb)
export const ROADS: Road[] = [
  { axis: 'h', at: 12, from: 0, to: 119 }, { axis: 'h', at: 30, from: 0, to: 119 }, { axis: 'h', at: 46, from: 0, to: 119 }, { axis: 'h', at: 62, from: 0, to: 119 },
  { axis: 'h', at: 22, from: 75, to: 119 },
  { axis: 'v', at: 10, from: 12, to: 81 }, { axis: 'v', at: 26, from: 12, to: 65 }, { axis: 'v', at: 42, from: 0, to: 81 }, { axis: 'v', at: 60, from: 0, to: 81 },
  { axis: 'v', at: 71, from: 0, to: 81 }, { axis: 'v', at: 90, from: 0, to: 81 }, { axis: 'v', at: 106, from: 12, to: 65 },
];
const CANAL_X0 = 66, CANAL_X1 = 68, SEA_Y = 82;

let CACHE: City | null = null;
export function city(): City { if (!CACHE) { CACHE = build(); remodel(CACHE); dressBuildings(CACHE); } return CACHE; }

const SIDEWALK: Record<District, G> = { market: G.WALK, temple: G.TEMPLE, canal: G.COBBLE, docks: G.DOCK, arcade: G.NEON };
const FRONTS: Record<District, string[]> = {
  market: ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6', 'shop-7', 'shop-8', 'shop-9', 'shop-10', 'shop-11', 'shop-12'],
  temple: ['bld-hill', 'bld-pavilion', 'bld-incense', 'bld-callig', 'shop-2', 'shop-5', 'shop-9'],
  canal: ['bld-canal', 'bld-tea', 'bld-boathouse', 'bld-flowers', 'bld-wheel', 'shop-3', 'shop-7'],
  docks: ['bld-office', 'bld-fish', 'bld-rope', 'bld-chandler', 'shop-4'],
  arcade: ['bld-noodle', 'bld-karaoke', 'bld-hotel', 'bld-robot', 'bld-boba', 'shop-10', 'shop-12'],
};
const ROOFS: Record<District, string[]> = {
  market: ['roof-1', 'roof-2', 'roof-3', 'roof-4', 'roof-7', 'roof-8', 'roof-10', 'roof-11'], temple: ['roof-5', 'roof-6', 'roof-1', 'roof-9', 'roof-11'],
  canal: ['roof-2', 'roof-3', 'roof-6', 'roof-7', 'roof-9'], docks: ['roof-4', 'roof-3', 'roof-8', 'roof-10'], arcade: ['roof-4', 'roof-1', 'roof-5', 'roof-12', 'roof-8'],
};

function build(): City {
  const N = W * H;
  const ground = new Uint8Array(N).fill(G.BLD), solid = new Uint8Array(N).fill(S.BUILDING), flags = new Uint8Array(N);
  const reserved = new Uint8Array(N); // cells taken by plans before the block filler runs
  const buildings: Building[] = [], props: Prop[] = [], decals: Prop[] = [];
  const places: Record<string, Place> = {};
  const ladders: City['ladders'] = [], hides: City['hides'] = [], parking: City['parking'] = [];
  const R = rng(20261114);
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x: number, y: number, g: G, s: S = S.OPEN, f = 0) => { if (!inb(x, y)) return; const i = at(x, y); ground[i] = g; solid[i] = s; flags[i] = f; reserved[i] = 1; };
  const rect = (x0: number, y0: number, w: number, h: number, g: G, s: S = S.OPEN, f = 0) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, g, s, f); };
  const prop = (x: number, y: number, sprite: string, r: number, solidKind: Prop['solid'], layer: Prop['layer'] = 'ground', extra: Partial<Prop> = {}) => (solidKind === 'low' && (solid[at(x, y)] = S.LOW), props.push({ x: x * T + T / 2, y: y * T + T / 2, sprite, r, solid: solidKind, layer, ...extra }));
  const bld = (x: number, y: number, w: number, h: number, sprite: string, front = true, roof = false) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = at(xx, yy); ground[i] = G.BLD; solid[i] = S.BUILDING; flags[i] = roof ? F_ROOF : 0; reserved[i] = 1; }
    buildings.push({ x, y, w, h, sprite, front, roof });
  };
  const place = (name: string, x: number, y: number, kind: string, label?: string) => { places[name] = { x: x * T + T / 2, y: y * T + T / 2, d: districtAt(x, y), kind, name: label }; };

  // ── water: the harbour along the south and the canal running down to it
  rect(0, SEA_Y, W, H - SEA_Y, G.SEA, S.WATER);
  rect(CANAL_X0, 0, CANAL_X1 - CANAL_X0 + 1, SEA_Y, G.CANAL, S.WATER);
  rect(64, 0, 2, SEA_Y, G.COBBLE); rect(69, 0, 2, SEA_Y, G.COBBLE); // canal promenades

  // ── roads: kerbs first, then lanes over every kerb so crossings join up; over water they are bridges
  for (const r of ROADS) for (let s = r.from; s <= r.to; s++) for (let k = 0; k < 4; k++) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (ground[at(x, y)] === G.ROAD) continue;
    const water = x >= CANAL_X0 && x <= CANAL_X1 && y < SEA_Y;
    set(x, y, water ? G.BRIDGE : SIDEWALK[districtAt(x, y)], S.OPEN, water ? F_BRIDGE : 0);
  }
  for (const r of ROADS) for (let s = r.from; s <= r.to; s++) for (let k = 1; k < 3; k++) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    const water = x >= CANAL_X0 && x <= CANAL_X1 && y < SEA_Y;
    set(x, y, water ? G.BRIDGE : G.ROAD, S.OPEN, water ? F_BRIDGE : 0);
  }
  // bridge decks are drawn as one painted piece per crossing
  for (const r of ROADS) if (r.axis === 'h' && r.from <= CANAL_X0 && r.to >= CANAL_X1) decals.push({ x: (CANAL_X0 + 1.5) * T, y: (r.at + 2) * T, sprite: 'd-bridge-stone', r: 0, solid: 'none', layer: 'ground', w: 5.2 * T, rot: 0 });
  // two footbridges over the canal
  for (const fy of [40, 56, 74]) { rect(CANAL_X0, fy, 3, 2, G.BRIDGE, S.OPEN, F_BRIDGE | F_ALLEY); decals.push({ x: (CANAL_X0 + 1.5) * T, y: (fy + 1) * T, sprite: 'd-bridge-wood', r: 0, solid: 'none', layer: 'ground', w: 4.2 * T, rot: 0 }); }

  // ── Temple Hill park (north-west): lawns, earth paths, the temple on its steps, the pagoda, a lotus pond
  rect(0, 0, 42, 12, G.GRASS, S.OPEN, F_PARK);
  rect(4, 3, 6, 5, G.CANAL, S.WATER, F_PARK);
  rect(0, 9, 42, 3, G.PATH, S.OPEN, F_PARK);
  rect(10, 2, 2, 7, G.PATH, S.OPEN, F_PARK); rect(25, 2, 2, 7, G.PATH, S.OPEN, F_PARK); rect(36, 6, 2, 3, G.PATH, S.OPEN, F_PARK);
  bld(16, 0, 6, 6, 'lm-temple'); rect(16, 6, 6, 1, G.TEMPLE); rect(17, 7, 4, 2, G.STAIRS, S.OPEN, F_STAIRS);
  decals.push({ x: 19 * T, y: 8 * T, sprite: 'd-stairs', r: 0, solid: 'none', layer: 'ground', w: 4 * T, rot: 0 });
  bld(30, 1, 4, 4, 'lm-pagoda'); rect(29, 5, 6, 1, G.TEMPLE);
  for (const [x, y] of [[2, 1], [13, 3], [14, 7], [23, 2], [28, 7], [38, 2], [40, 7], [3, 9], [35, 1]] as const) prop(x, y, R() < 0.5 ? 'tree-round' : 'tree-frangipani', 22, 'tall', 'over');
  // a low hedge along the park's road edge with gates: wardens on bikes have to go round
  for (let x = 0; x < 42; x++) if (![6, 7, 18, 19, 20, 36, 37].includes(x) && ground[at(x, 11)] !== G.STAIRS) prop(x, 11, 'hedge', 0, 'low');
  place('temple-top', 19, 6, 'spot'); place('temple-steps', 19, 11, 'spot'); place('heron', 19, 9, 'contact', 'Brother Heron'); place('pagoda', 32, 5, 'spot');
  prop(15, 6, 'lion-statue', 18, 'tall', 'over'); prop(22, 6, 'lion-statue', 18, 'tall', 'over'); prop(19, 6, 'urn', 16, 'tall', 'over');

  // ── reserved plans inside blocks (before the filler)
  // Night Market: the market square, the food court, the grocer, safe house, garage, ferry pier
  rect(14, 50, 12, 12, G.PLAZA);
  for (const [x, y, s] of [[15, 52, 'stall-red'], [18, 52, 'stall-fruit'], [21, 52, 'stall-tea'], [15, 56, 'stall-noodle'], [21, 56, 'stall-red'], [18, 59, 'stall-fruit']] as const) stall(x, y, s);
  place('mk-market', 19, 55, 'market', 'Night Market stalls'); place('mo', 34, 70, 'contact', 'Chef Mo');
  rect(30, 66, 12, 9, G.PLAZA);
  for (const [x, y, s] of [[31, 67, 'stall-noodle'], [36, 67, 'stall-red'], [31, 71, 'stall-tea'], [38, 72, 'stall-noodle']] as const) stall(x, y, s);
  place('wok-stall', 33, 69, 'spot');
  bld(14, 40, 3, 3, 'shop-4'); place('kee', 15, 43, 'contact', 'Uncle Kee'); rect(14, 43, 12, 3, G.WALK);
  bld(0, 56, 3, 3, 'lm-safe'); rect(0, 59, 10, 3, G.WALK); place('safe-market', 1, 59, 'safe', 'Lantern Lane safe house');
  bld(30, 37, 3, 3, 'lm-garage'); rect(30, 40, 12, 2, G.WALK); place('garage-market', 31, 40, 'garage', 'Night Market garage');
  rect(10, SEA_Y, 4, 6, G.PLANK); place('ferry', 11, 86, 'spot');
  for (const x of [10, 13]) for (const y of [83, 85, 87]) prop(x, y, 'bollard', 10, 'low');

  // Temple Hill blocks: the temple market plaza and Auntie Pang, Master Ren's practice yard, safe house
  rect(30, 16, 12, 9, G.TEMPLE);
  for (const [x, y, s] of [[31, 17, 'stall-tea'], [35, 17, 'stall-red'], [39, 17, 'stall-fruit'], [33, 21, 'stall-tea']] as const) stall(x, y, s);
  place('mk-temple', 36, 20, 'market', 'Temple Hill market'); place('pang', 37, 20, 'contact', 'Auntie Pang');
  rect(14, 16, 6, 6, G.TEMPLE); place('ren', 16, 18, 'contact', 'Master Ren'); prop(18, 17, 'lucky-circle', 0, 'none');
  bld(0, 24, 3, 3, 'lm-safe'); rect(0, 27, 10, 3, G.TEMPLE); place('safe-temple', 1, 27, 'safe', 'Pine Steps safe house');

  // Canal Quarter: the canal-side market, Kiri's boat jetty, Mr Lim's kiosk, safe house, garage
  rect(46, 34, 14, 6, G.COBBLE);
  for (const [x, y, s] of [[47, 35, 'stall-fruit'], [51, 35, 'stall-tea'], [55, 35, 'stall-red']] as const) stall(x, y, s);
  place('mk-canal', 52, 38, 'market', 'Canal Row market');
  place('kiri', 65, 20, 'contact', 'Kiri'); place('jetty', 65, 24, 'spot');
  place('lim', 50, 18, 'contact', 'Mr Lim'); rect(46, 16, 6, 4, G.COBBLE); prop(48, 16, 'kiosk', 20, 'tall', 'over');
  bld(54, 50, 3, 3, 'lm-safe'); rect(46, 53, 14, 2, G.COBBLE); place('safe-canal', 55, 53, 'safe', 'Willow Water safe house');
  bld(77, 37, 3, 3, 'lm-garage'); rect(75, 40, 15, 2, G.NEON); place('garage-canal', 78, 40, 'garage', 'Strip garage');

  // Arcade Strip: the neon market, Gizmo's arcade, the rooftop terraces, the Magpie Roost (boss), safe house
  rect(110, 34, 10, 8, G.NEON);
  for (const [x, y, s] of [[111, 35, 'stall-red'], [115, 35, 'stall-noodle'], [111, 39, 'stall-tea']] as const) stall(x, y, s);
  place('mk-arcade', 115, 39, 'market', 'Neon Row market');
  bld(94, 16, 6, 6, 'lm-arcade'); place('gizmo', 97, 22, 'contact', 'Gizmo'); // fronts onto the neon boulevard
  bld(110, 50, 6, 6, 'lm-arcade'); place('roost', 112, 56, 'spot', 'the Magpie Roost'); rect(110, 56, 10, 6, G.NEON);
  bld(80, 26, 3, 3, 'lm-safe'); rect(75, 29, 15, 1, G.NEON); place('safe-arcade', 81, 29, 'safe', 'Neon Loft safe house');
  // rooftop terraces: flat roofs with one-tile gaps you hop across on foot, a ladder at each end
  rect(94, 34, 12, 12, G.NEON);
  for (const [x, y] of [[94, 34], [98, 34], [102, 34], [94, 38], [98, 38], [102, 38], [94, 42], [98, 42], [102, 42]] as const) bld(x, y, 3, 3, 'flat-' + (1 + ((x + y) % 6)), false, true);
  ladders.push({ x: 93, y: 44, rx: 94, ry: 44 }, { x: 105, y: 33, rx: 104, ry: 34 });
  // a second terrace run in the Night Market
  rect(0, 66, 10, 16, G.WALK);
  for (const [x, y] of [[0, 66], [4, 66], [0, 70], [4, 70], [0, 74], [4, 74], [0, 78], [4, 78]] as const) bld(x, y, 3, 3, 'flat-' + (1 + ((x * 3 + y) % 6)), false, true);
  ladders.push({ x: 8, y: 81, rx: 6, ry: 80 }, { x: 8, y: 66, rx: 6, ry: 66 });

  // Docks: the apron, warehouses, container stacks, cranes, piers; the warehouse yard for the stealth job
  for (let y = 66; y < SEA_Y; y++) for (let x = 46; x < W; x++) if (!reserved[at(x, y)]) set(x, y, G.DOCK);
  bld(48, 68, 6, 6, 'lm-warehouse'); bld(78, 68, 6, 6, 'lm-warehouse'); bld(48, 76, 3, 3, 'bld-office'); place('bo', 50, 79, 'contact', 'Big Bo');
  bld(54, 76, 3, 3, 'lm-safe'); place('safe-docks', 55, 79, 'safe', 'Tide Shed safe house');
  rect(84, 76, 6, 5, G.DOCK); for (const [x, y, s] of [[84, 77, 'stall-fruit'], [87, 77, 'stall-tea']] as const) stall(x, y, s);
  place('mk-docks', 86, 80, 'market', 'Harbour market');
  for (const px of [48, 80, 100]) { rect(px, SEA_Y, 4, 7, G.PLANK); prop(px + 4, SEA_Y - 1, 'crane', 26, 'tall', 'over'); }
  place('pier-end', 101, 88, 'spot');
  // warehouse yard: a fenced maze of containers with one gate
  const yard: [number, number, number, number][] = [[95, 67, 3, 1], [100, 67, 4, 1], [108, 67, 3, 1], [114, 67, 4, 1], [95, 70, 1, 3], [98, 70, 4, 1], [104, 69, 1, 4], [108, 70, 4, 1], [114, 70, 1, 4],
    [96, 75, 4, 1], [101, 74, 1, 3], [106, 75, 4, 1], [111, 74, 1, 3], [116, 76, 3, 1], [97, 78, 1, 3], [103, 79, 4, 1], [110, 78, 1, 3]];
  for (const [x, y, w, h] of yard) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { set(xx, yy, G.DOCK, S.TALL); }
  for (const [x, y, w, h] of yard) props.push({ x: (x + w / 2) * T, y: (y + h / 2) * T, sprite: w >= h ? 'containers' : 'containers-v', r: 0, solid: 'none', layer: 'ground', w: Math.max(w, h) * T, rot: w >= h ? 0 : Math.PI / 2 });
  bld(116, 68, 3, 3, 'bld-office'); place('yard-office', 117, 71, 'spot', 'the yard office'); place('yard-gate', 94, 72, 'spot');
  place('manifest', 117, 72, 'spot');

  // ── fill every remaining block with shophouses, back lanes and alleys
  const blocks = findBlocks(ground, reserved);
  for (const b of blocks) fillBlock(b);

  // ── kerbside parking on the five-foot ways, in every district (rides you can take)
  for (const r of ROADS) {
    for (let s = r.from + 3; s <= r.to - 3; s += 11) {
      for (const k of [0, 3]) {
        const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
        if (!inb(x, y) || solid[at(x, y)] !== S.OPEN || flags[at(x, y)] & F_BRIDGE) continue;
        if (crossing(x, y)) continue;
        const roll = R();
        const d = districtAt(x, y);
        const kind = roll < 0.42 ? 'scooter' : roll < 0.6 ? 'trishaw' : roll < 0.8 ? 'tuktuk' : 'van';
        const rot = r.axis === 'h' ? (k === 0 ? -Math.PI / 2 : Math.PI / 2) : (k === 0 ? 0 : Math.PI);
        parking.push({ x: x * T + T / 2, y: y * T + T / 2, d, kind, rot });
      }
    }
  }
  // boats at the canal jetties and the ferry
  // (moored against the bank or a pier, so you can step aboard from dry land)
  for (const [x, y, rot] of [[66, 24, 1], [66, 44, 1], [66, 60, 1], [66, 77, 1], [12, 88, 0], [9, 85, 1], [99, 85, 1], [104, 86, 1]] as const) parking.push({ x: x * T + T / 2, y: y * T + T / 2, d: districtAt(x, y), kind: 'boat', rot: rot * Math.PI / 2 });

  // ── street dressing: lamps on the kerbs, lantern strings over the market streets, zebra crossings, manholes
  for (const r of ROADS) for (let s = r.from + 2; s <= r.to - 2; s += 5) for (const k of [0, 3]) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (!inb(x, y) || solid[at(x, y)] !== S.OPEN || crossing(x, y) || (flags[at(x, y)] & F_BRIDGE)) continue;
    if (parking.some(p => Math.abs(p.x - (x * T + T / 2)) < T && Math.abs(p.y - (y * T + T / 2)) < T)) continue;
    // never in the mouth of an alley or a gap between buildings: a post there would plug the way through
    { const o = k === 0 ? -1 : 1, fx = r.axis === 'v' ? x + o : x, fy = r.axis === 'h' ? y + o : y;
      if (inb(fx, fy) && solid[at(fx, fy)] !== S.BUILDING && solid[at(fx, fy)] !== S.TALL) {
        const sa = r.axis === 'h' ? [at(fx - 1, fy), at(fx + 1, fy)] : [at(fx, fy - 1), at(fx, fy + 1)];
        if (sa.some(i => solid[i] === S.BUILDING || solid[i] === S.TALL)) continue;
      } }
    if ((s + k) % 2 === 0) props.push({ x: x * T + T / 2 + (r.axis === 'v' ? (k === 0 ? -20 : 20) : 0), y: y * T + T / 2 + (r.axis === 'h' ? (k === 0 ? -20 : 20) : 0), sprite: 'lamp', r: 8, solid: 'tall', layer: 'over' });
  }
  for (const r of ROADS) {
    if (r.axis !== 'h') continue;
    for (let s = r.from + 4; s <= r.to - 4; s += 9) {
      const d = districtAt(s, r.at);
      if (s >= 63 && s <= 71) continue;
      props.push({ x: s * T + T / 2, y: (r.at + 2) * T, sprite: d === 'arcade' ? 'lanterns-gold' : 'lanterns-red', r: 0, solid: 'none', layer: 'sky', w: 4.4 * T, rot: Math.PI / 2 });
    }
  }
  for (const r of ROADS) for (const r2 of ROADS) {
    if (r.axis !== 'h' || r2.axis !== 'v' || r2.at + 3 < r.from || r2.at > r.to || r.at + 3 < r2.from || r.at > r2.to) continue;
    // zebra crossings on the four approaches
    if (r.from <= r2.at - 2) decals.push({ x: (r2.at - 0.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r.to >= r2.at + 5) decals.push({ x: (r2.at + 4.5) * T, y: (r.at + 2) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: Math.PI / 2 });
    if (r2.from <= r.at - 2) decals.push({ x: (r2.at + 2) * T, y: (r.at - 0.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
    if (r2.to >= r.at + 5) decals.push({ x: (r2.at + 2) * T, y: (r.at + 4.5) * T, sprite: 'd-zebra', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: 0 });
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * H);
    const g = ground[at(x, y)];
    if (solid[at(x, y)] !== S.OPEN) continue;
    if (g === G.ROAD && R() < 0.5) decals.push({ x: x * T + T / 2, y: y * T + T / 2, sprite: R() < 0.5 ? 'd-manhole' : 'd-puddle-' + (R() < 0.5 ? 'red' : 'gold'), r: 0, solid: 'none', layer: 'ground', w: T * 0.8 });
    else if (g === G.WALK || g === G.PLAZA || g === G.COBBLE || g === G.NEON) decals.push({ x: x * T + T / 2, y: y * T + T / 2, sprite: R() < 0.3 ? 'd-petals' : R() < 0.6 ? 'd-grate' : 'd-puddle-gold', r: 0, solid: 'none', layer: 'ground', w: T * 0.7 });
  }
  // lane dashes down the middle of every road
  for (const r of ROADS) for (let s = r.from; s <= r.to; s += 2) {
    const x = r.axis === 'h' ? s : r.at + 2, y = r.axis === 'h' ? r.at + 2 : s;
    if (!inb(x, y) || crossing(x, y) || (r.axis === 'h' ? crossing(x, y - 1) : crossing(x - 1, y))) continue;
    decals.push({ x: r.axis === 'h' ? x * T + T / 2 : x * T, y: r.axis === 'h' ? y * T : y * T + T / 2, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: r.axis === 'h' ? 0 : Math.PI / 2 });
  }

  // ── hiding spots (bead curtains and baskets) in alleys and back lanes; murals on quiet walls; lucky cats
  const murals: City['murals'] = [];
  const cats: City['cats'] = [];
  const quiet: [number, number][] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = at(x, y);
    if (solid[i] !== S.OPEN || ground[i] === G.ROAD || flags[i] & F_BRIDGE) continue;
    if (solid[at(x, y - 1)] === S.BUILDING && !(flags[at(x, y - 1)] & F_ROOF)) quiet.push([x, y]);
  }
  const taken = new Set<number>();
  const far = (x: number, y: number, d: number) => { for (const k of taken) { const kx = k % W, ky = Math.floor(k / W); if (Math.abs(kx - x) < d && Math.abs(ky - y) < d) return false; } return true; };
  const pick = (want: number, d: number, filter: (x: number, y: number) => boolean) => {
    const out: [number, number][] = [];
    const pool = quiet.filter(([x, y]) => filter(x, y));
    for (let tries = 0; tries < 4000 && out.length < want && pool.length; tries++) {
      const [x, y] = pool[Math.floor(R() * pool.length)];
      if (!far(x, y, d) || isPlaceNear(x, y)) continue;
      taken.add(at(x, y)); out.push([x, y]);
    }
    return out;
  };
  const isPlaceNear = (x: number, y: number) => Object.values(places).some(p => Math.abs(p.x / T - 0.5 - x) < 2 && Math.abs(p.y / T - 0.5 - y) < 2) || parking.some(p => Math.abs(p.x / T - 0.5 - x) < 1.5 && Math.abs(p.y / T - 0.5 - y) < 1.5);
  for (const d of DISTRICTS) for (const [x, y] of [...pick(5, 5, (x, y) => districtAt(x, y) === d && (flags[at(x, y)] & F_ALLEY) > 0), ...pick(2, 5, (x, y) => districtAt(x, y) === d && ground[at(x, y)] !== G.ROAD)].slice(0, 7)) {
    hides.push({ x: x * T + T / 2, y: y * T + T / 2 }); props.push({ x: x * T + T / 2, y: y * T + 14, sprite: R() < 0.55 ? 'curtain' : 'basket', r: 0, solid: 'none', layer: 'ground' });
  }
  let m = 0;
  for (const d of DISTRICTS) for (const [x, y] of pick(3, 6, (x, y) => districtAt(x, y) === d && ground[at(x, y)] !== G.ROAD)) {
    murals.push({ id: 'mural-' + (++m), x: x * T + T / 2, y: y * T + 10 });
  }
  for (const d of DISTRICTS) for (const [x, y] of pick(8, 3, (x, y) => districtAt(x, y) === d && solid[at(x, y)] === S.OPEN)) cats.push({ x: x * T + T / 2, y: y * T + T / 2 });
  // the rest of the 50 cats sit in odd corners: rooftops, pier ends, the park
  const odd: [number, number][] = [[95, 35], [103, 43], [99, 39], [1, 67], [5, 79], [2, 2], [40, 1], [12, 5], [102, 88], [49, 88]];
  for (const [x, y] of odd) cats.push({ x: x * T + T / 2, y: y * T + T / 2 });
  for (let d = 2; cats.length < 50 && d > 0; d--) for (const [x, y] of pick(50 - cats.length, d, (x, y) => solid[at(x, y)] === S.OPEN)) cats.push({ x: x * T + T / 2, y: y * T + T / 2 });

  return { ground, solid, flags, buildings, props, roads: ROADS, decals, places, cats: cats.slice(0, 50), murals, ladders, hides, parking, paths: [], tables: [], festival: [] };

  function stall(x: number, y: number, s: string) {
    for (let k = 0; k < 2; k++) { const i = at(x + k, y); solid[i] = S.TALL; reserved[i] = 1; }
    props.push({ x: (x + 1) * T, y: y * T + T / 2, sprite: s, r: 0, solid: 'none', layer: 'over', w: 2.1 * T });
  }
  function crossing(x: number, y: number) {
    let h = false, v = false;
    for (const r of ROADS) {
      if (r.axis === 'h' && y >= r.at && y <= r.at + 3 && x >= r.from && x <= r.to) h = true;
      if (r.axis === 'v' && x >= r.at && x <= r.at + 3 && y >= r.from && y <= r.to) v = true;
    }
    return h && v;
  }
  function fillBlock(b: { x: number; y: number; w: number; h: number }) {
    const d = districtAt(b.x, b.y);
    const yardG = d === 'market' ? G.WALK : d === 'temple' ? G.TEMPLE : d === 'canal' ? G.COBBLE : d === 'docks' ? G.DOCK : G.NEON;
    const free = (x: number, y: number) => inb(x, y) && !reserved[at(x, y)] && ground[at(x, y)] === G.BLD;
    // alleys: a one-tile lane through wide blocks (foot and scooters only), sometimes a cross lane
    if (b.w >= 9) { const ax = b.x + 3 * Math.floor((b.w - 1) / 6); for (let y = b.y; y < b.y + b.h; y++) if (free(ax, y)) set(ax, y, G.COBBLE, S.OPEN, F_ALLEY); }
    if (b.h >= 12 && R() < 0.5) { const ay = b.y + b.h - 7; for (let x = b.x; x < b.x + b.w; x++) if (free(x, ay)) set(x, ay, G.COBBLE, S.OPEN, F_ALLEY); }
    // 3×3 shophouses packed from the south edge so their fronts face the street
    for (let y = b.y + b.h - 3; y >= b.y; y--) for (let x = b.x; x + 2 < b.x + b.w; x++) {
      let ok = true;
      for (let yy = y; yy < y + 3 && ok; yy++) for (let xx = x; xx < x + 3; xx++) if (!free(xx, yy)) { ok = false; break; }
      if (!ok) continue;
      for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) reserved[at(xx, yy)] = 1;
      buildings.push({ x, y, w: 3, h: 3, sprite: '', front: false });
      x += 2;
    }
    // leftovers become back lanes and yards with a few crates and plants (low: hop them on foot)
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (free(x, y)) {
      set(x, y, yardG, S.OPEN, F_ALLEY);
      if (R() < 0.08) prop(x, y, R() < 0.5 ? 'crates' : 'plants', 0, 'low');
    }
    void d;
  }
}

/** after building: choose each plain shophouse's sprite (front if the street is below it) */
function dressBuildings(c: City) {
  const R = rng(77);
  for (const b of c.buildings) {
    if (b.sprite) continue;
    const below = b.y + b.h;
    let open = 0;
    for (let x = b.x; x < b.x + b.w; x++) if (below < H && c.solid[below * W + x] !== S.BUILDING) open++;
    b.front = open >= 2;
    const d = districtAt(b.x, b.y);
    const list = b.front ? FRONTS[d] : ROOFS[d];
    // never the same picture as a building touching this one
    const near = new Set(c.buildings.filter(o => o !== b && o.sprite && o.x <= b.x + b.w && o.x + o.w >= b.x && o.y <= b.y + b.h && o.y + o.h >= b.y).map(o => o.sprite));
    const ok = list.filter(n => !near.has(n));
    const pool = ok.length ? ok : list;
    b.sprite = pool[Math.floor(R() * pool.length)];
  }
}
function findBlocks(ground: Uint8Array, reserved: Uint8Array) {
  const seen = new Uint8Array(W * H); const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (seen[i] || reserved[i] || ground[i] !== G.BLD) continue;
    // flood the connected unreserved region and take its bounding box
    let x0 = x, x1 = x, y0 = y, y1 = y; const st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop()!; const jx = j % W, jy = (j - jx) / W;
      x0 = Math.min(x0, jx); x1 = Math.max(x1, jx); y0 = Math.min(y0, jy); y1 = Math.max(y1, jy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = jx + dx, ny = jy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx; if (seen[k] || reserved[k] || ground[k] !== G.BLD) continue; seen[k] = 1; st.push(k);
      }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

// ── queries
/** `walk` is on foot without hopping (townsfolk, Pip, the lion dance): low props are walls for it */
export type MoveClass = 'foot' | 'walk' | 'small' | 'big' | 'boat' | 'fly';
export const idx = (tx: number, ty: number) => ty * W + tx;
export const tileOf = (v: number) => Math.floor(v / T);
/** can this class stand on tile (tx,ty)? `roof` is the rooftop layer, `air` a hop in progress */
export function passable(c: City, cls: MoveClass, tx: number, ty: number, roof = false, air = false): boolean {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
  if (cls === 'fly') return true;
  const i = ty * W + tx, s = c.solid[i], f = c.flags[i];
  if (roof) return (f & F_ROOF) > 0 || air;
  if (cls === 'boat') return s === S.WATER || (f & F_BRIDGE) > 0;
  if (s === S.BUILDING || s === S.WATER || s === S.TALL) return false;
  if (s === S.LOW) return cls === 'foot' && air;
  if (cls === 'foot' || cls === 'walk') return true;
  if (f & F_STAIRS) return false;
  if (cls === 'big' && (f & F_ALLEY) && !(f & F_BRIDGE)) return false;
  return true;
}

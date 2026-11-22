// Jade Street: the city. Built once, deterministically, in a 376×128 tile frame (64 world units a tile), then moved
// block by block into the 476×128 world you play in, where the districts sit as they do in Singapore (lib/jade-layout.ts).
// The build frame: Chinatown, the home turf, is its 120×92 north-west, built from a hand-laid plan exactly as before
// (lib/jade-island.ts adds the Toa Payoh heartlands, the Marina Bay front, the expressways and the MRT line east of it
// afterwards, lib/jade-east.ts Little India, Kampong Glam past the Rochor River, and Sentosa out in the harbour to the
// south, lib/jade-far.ts Orchard Road, Katong and Changi past the Geylang River, and lib/jade-south.ts Jurong, Tiong
// Bahru and Clarke Quay in a strip south of Kampong Glam). The world you play in: Chinatown with Sentosa south of it,
// Toa Payoh and Marina Bay, Little India and Kampong Glam, Katong and Changi east of it as built; Orchard Road, Clarke
// Quay and Tiong Bahru west of Chinatown (north to south), Jurong at the west edge; filler (seams()) lays the roads and
// the river between them, parkland, and HDB estates where Orchard Road was built. Chinatown's plan: five districts, a grid of two-lane streets (traffic keeps left), back alleys, a canal with bridges,
// the temple park, the docks and piers, flat-roof terraces you can run across, and every named place the story uses.
// Ground (what is painted), solid (what blocks you) and flags (alley, stairs, roof, bridge) are separate layers.
// Pure data and queries: no drawing here (lib/jade-scene.ts paints it).
// Two frames: every pass builds in the old frame (OLD_W×OLD_H, the constants below, OLD_ROADS, districtAtOld), then
// relayout() moves the built city block by block into the new frame (lib/jade-layout.ts) that the game plays in (W×H,
// ROADS, districtAt, streetAt and every City position). Runtime code never compares a position with an old-frame
// constant: it asks districtAt / unmvT, or moves the constant with mvT.
import { rng } from './jade-rng.js';
import { OLD_W, OLD_H, BUILD_H, ISL, BKT, NW, NH, LAYOUT, LAYOUT_MODE, blockNew, mvT, mvP, mvTRect, mvPLine, mvPP } from './jade-layout.js';
import { remodel, type Path, type FestivalSpot } from './jade-remodel.js';
import { sgCity, type SgCity } from './jade-sgcity.js';
import { island, F_XWAY, type Isle } from './jade-island.js';
import { east, backLanes, type East } from './jade-east.js';
import { far, type Far } from './jade-far.js';
import { south, type South } from './jade-south.js';
import { ubin, boatPath, linkOf, type Ubin } from './jade-ubin.js';
import { kallang, type Kallang } from './jade-kallang.js';
import { mandai, type Mandai } from './jade-mandai.js';
import { islands, islePath, type Islands } from './jade-islands.js';
import { bukit, type Bukit } from './jade-bukit.js';
import { newRides } from './jade-rides.js';

export const T = 64;
/** the world you play in, in tiles (the new frame: lib/jade-layout.ts) */
export const W = NW, H = NH;
export { OLD_W, OLD_H };
// ── the old frame: where each pass first laid its districts out (build time only; see the note at the top)
/** Chinatown's width: the original quarter, built first and never moved */
export const OW = 120;
/** the first island's height (Chinatown, Toa Payoh and Marina Bay are rows 0 to 91; Sentosa lies south of it) */
export const CT_H = 92;
/** the Rochor River (columns 208 to 211) and Little India and Kampong Glam east of it, up to the east coast */
export const EAST_X0 = 212, EAST_X1 = 271;
/** the row where Little India ends and Kampong Glam begins */
export const EAST_SPLIT = 42;
/** the twelfth pass: past the Geylang River (columns 272 to 275), Orchard Road (north) and Katong (south) up to column
 * 323, and Changi from column 324 to the east edge; roads run to column 371 */
export const FAR_X0 = 276, FAR_SPLIT = 38, CHANGI_X0 = 324, FAR_X1 = 371;
/** the fourteenth pass (in the build frame): a strip south of Kampong Glam, rows 96 to 125: Jurong (columns 198 to
 * 241), Tiong Bahru (242 to 287) and Clarke Quay (288 to 329). In the world each is its own block west of Chinatown */
export const SOUTH_X0 = 198, SOUTH_X1 = 329, SOUTH_Y0 = 96, SOUTH_Y1 = 125, TIONG_X0 = 242, QUAY_X0 = 288;
/** the seventeenth pass (in the build frame): Pulau Ubin in the open sea south of Changi, columns 332 to 367, rows 96 to
 * 125 (its coast a few tiles in from every edge). In the world it is its own block off Changi Airport, the north-east corner */
export const UBIN_X0 = 332, UBIN_X1 = 367, UBIN_Y0 = 96, UBIN_Y1 = 125;
/** the eighteenth pass (in the build frame): Kallang, in two pieces. Its north strip (columns 212 to 257, rows 82 to 95)
 * is built in the open sea right under Kampong Glam's south coast, so it stays part of the main block and Kampong Glam's
 * avenues run straight on into it; the rest (columns 148 to 193, rows 96 to 125, open sea east of Sentosa's buoys) is
 * its own block, which the layout table puts right under the north strip. Local row 0 is the north strip's first row,
 * local row 14 the south block's first */
export const KAL_NX0 = 212, KAL_NY0 = 82, KAL_X0 = 148, KAL_Y0 = 96, KAL_W = 46, KAL_NH = 14, KAL_H = 44;
/** the nineteenth pass (in the build frame): Mandai, the wildlife parks on the Upper Seletar Reservoir, built in the open
 * sea west of Sentosa (columns 0 to 29, rows 90 to 127). In the world it is its own block in the north-west corner, at
 * the top edge west of Orchard Road (lib/jade-layout.ts) */
export const MND_X0 = 0, MND_Y0 = 90, MND_W = 30, MND_H = 38;
/** the twenty-first pass (in the build frame's extra rows, lib/jade-layout.ts ISL): the Southern Islands, south of Marina
 * Bay, 44 columns by 30 rows. In the world, their own block in the sea between the Sentosa ferry's lane and Kallang */
export const ISL_X0 = ISL.x0, ISL_Y0 = ISL.y0, ISL_W = ISL.x1 - ISL.x0 + 1, ISL_H = ISL.y1 - ISL.y0 + 1;
export { BUILD_H };
/** the twenty-second pass (in the build frame's extra rows, lib/jade-layout.ts BKT): Bukit Timah and the Botanic Gardens,
 * 40 columns by 28 rows. In the world, their own block in the parkland west of Tiong Bahru */
export const BKT_X0 = BKT.x0, BKT_Y0 = BKT.y0, BKT_W = BKT.x1 - BKT.x0 + 1, BKT_H = BKT.y1 - BKT.y0 + 1;
/** the world you play in, in world units (the new frame) */
export const WORLD_W = W * T, WORLD_H = H * T;

export const G = { SEA: 0, CANAL: 1, ROAD: 2, WALK: 3, PLAZA: 4, GRASS: 5, DOCK: 6, PLANK: 7, TEMPLE: 8, NEON: 9, PATH: 10, COBBLE: 11, BRIDGE: 12, STAIRS: 13, BLD: 14,
  /** the island: expressway asphalt, heartland concrete, the playground mat, the bay promenade, the boardwalk and the bay */
  XWAY: 15, HDB: 16, RUBBER: 17, GRANITE: 18, DECK: 19, BAY: 20,
  /** the ninth pass: Little India's painted tiles, Kampong Glam's brick, Sentosa's sand, theme-park paving, the lagoon
   * (shallow water) and the old fort's laterite */
  INDIA: 21, GLAM: 22, SAND: 23, RESORT: 24, LAGOON: 25, FORT: 26,
  /** the twelfth pass: Katong's Peranakan tiles, Orchard Road's granite, the airport's tarmac, East Coast Park's red
   * cycling track, the Jewel's garden floor and Changi Village's pavers */
  KATONG: 27, ORCHARD: 28, TARMAC: 29, CYCLE: 30, JEWEL: 31, CHANGI: 32,
  /** the fourteenth pass: Tiong Bahru's terrazzo, Clarke Quay's granite setts, Jurong's pavers, the Chinese Garden's pebbles */
  TIONG: 33, QUAY: 34, JURONG: 35, GARDEN: 36,
  /** the seventeenth pass: Pulau Ubin's laterite tracks, kampong yards, mangrove mud (water), forest floor, quarry water
   * (water) and granite */
  DIRT: 37, KAMPONG: 38, MUD: 39, FOREST: 40, QUARRY: 41, ROCK: 42,
  /** the eighteenth pass: the Sports Hub's concourse paving, Kallang Riverside's timber promenade, the old airport's
   * concrete apron and the basin's rowing water (water) */
  HUB: 43, PROM: 44, APRON: 45, BASIN: 46,
  /** the nineteenth pass: the Upper Seletar Reservoir's water (water), the Mandai boardwalk's teak, the night forest floor
   * and the parks' red laterite paths */
  RESV: 47, BOARD: 48, JUNGLE: 49, LATERITE: 50,
  /** the twenty-first pass: the Southern Islands' reef flats (walkable: the tide step's ground), the shallows over the reef
   * (water), white coral sand and the islands' grassy footpaths */
  REEF: 51, SHOAL: 52, CORAL: 53, ISLEPATH: 54,
  /** the twenty-second pass: Bukit Timah's root-laced summit trail (the summit step's ground), the Botanic Gardens'
   * lawns, the old rail corridor's gravel and Swan Lake's water (water) */
  SUMMIT: 55, LAWN: 56, RAILBED: 57, SWAN: 58 } as const;
export type G = (typeof G)[keyof typeof G];
export const GROUND_NAMES = ['sea', 'canal', 'road', 'walk', 'plaza', 'grass', 'dock', 'plank', 'temple', 'neon', 'path', 'cobble', 'bridge', 'stairs', 'bld', 'xway', 'hdb', 'rubber', 'granite', 'deck', 'bay', 'india', 'glam', 'sand', 'resort', 'lagoon', 'fort', 'katong', 'orchard', 'tarmac', 'cycle', 'jewel', 'changi', 'tiong', 'quay', 'jurong', 'garden', 'dirt', 'kampong', 'mud', 'forest', 'quarry', 'rock', 'hub', 'prom', 'apron', 'basin', 'resv', 'board', 'jungle', 'laterite', 'reef', 'shoal', 'coral', 'islepath', 'summit', 'lawn', 'railbed', 'swan'] as const;
/** solid: 0 open, 1 building, 2 water, 3 tall prop (stall, container), 4 low prop (hop over on foot) */
export const S = { OPEN: 0, BUILDING: 1, WATER: 2, TALL: 3, LOW: 4 } as const;
export type S = (typeof S)[keyof typeof S];
/** flags */
export const F_ALLEY = 1, F_STAIRS = 2, F_ROOF = 4, F_BRIDGE = 8, F_PARK = 16;

export type District = 'market' | 'temple' | 'canal' | 'docks' | 'arcade' | 'heartland' | 'bay' | 'india' | 'glam' | 'resort' | 'orchard' | 'katong' | 'changi' | 'tiong' | 'quay' | 'jurong' | 'pulau' | 'kallang' | 'mandai' | 'islands' | 'bukit';
/** Chinatown's five districts (the first plan), then the island's two, the ninth pass's three and the twelfth's three */
export const CT_DISTRICTS: District[] = ['market', 'temple', 'canal', 'docks', 'arcade'];
export const DISTRICTS: District[] = [...CT_DISTRICTS, 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong', 'pulau', 'kallang', 'mandai', 'islands', 'bukit'];
export const DISTRICT_NAME: Record<District, string> = { market: 'Smith Street', temple: 'Temple Street', canal: 'Boat Quay', docks: 'the Tanjong Pagar Docks', arcade: 'Club Street', heartland: 'Toa Payoh', bay: 'Marina Bay', india: 'Little India', glam: 'Kampong Glam', resort: 'Sentosa', orchard: 'Orchard Road', katong: 'Katong', changi: 'Changi', tiong: 'Tiong Bahru', quay: 'Clarke Quay', jurong: 'Jurong', pulau: 'Pulau Ubin', kallang: 'Kallang', mandai: 'Mandai', islands: 'the Southern Islands', bukit: 'Bukit Timah' };
/** the row where the heartlands end and the bay front begins (the Pan Island Expressway runs along it) */
export const ISLE_SPLIT = 38;
const MAIN = LAYOUT.blocks[LAYOUT.blocks.length - 1];
/** the district at a new-frame tile, read off a map made once (see districtMap) */
export function districtAt(tx: number, ty: number): District {
  const m = DMAP ?? districtMap();
  return DISTRICTS[m[Math.max(0, Math.min(H - 1, ty)) * W + Math.max(0, Math.min(W - 1, tx))]];
}
let DMAP: Uint8Array | null = null;
/** the blocks that claim none of the filler round them (districtMap, mapDistrictAt) */
const NO_FILL = new Set(['mandai', 'islands', 'bukit']);
/** the blocks the fill runs through as if they were filler (their own tiles set after): see districtMap */
const GHOST = new Set(['bukit']);
/** every new-frame tile's district (an index into DISTRICTS). A block tile has its old tile's; the main block's tiles
 * the moved blocks left behind (the Geylang River beside Orchard's old place, the sea round the south strip's) take
 * the district that is there now (Katong; Sentosa's sea). Filler takes the nearest block tile's district: west of
 * Chinatown the nearest moved block's (so a link road opens with the later of the districts it joins, never early with
 * Chinatown), elsewhere the main block's; Orchard's old place is Katong's (it opens with it) */
function districtMap(): Uint8Array {
  const N = W * H, m = new Uint8Array(N), set = new Uint8Array(N), q: number[] = [];
  const di = (d: District) => DISTRICTS.indexOf(d);
  // (Bukit Timah, the twenty-second pass, took over parkland the fill used to run through to the beach below it: the
  // fill runs as if it were still parkland, and its own tiles are set after, so every filler tile keeps its district)
  const ghost: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = blockNew(x, y); if (!b) continue;
    if (GHOST.has(b.id)) { ghost.push(y * W + x); continue; }
    let d = districtAtOld(x - b.nx + b.x0, y - b.ny + b.y0);
    if (b === MAIN && LAYOUT_MODE === 'real') d = d === 'orchard' ? 'katong' : d === 'jurong' || d === 'tiong' || d === 'quay' ? 'resort' : d;
    // (a moved block is its own district throughout: Tiong Bahru's last two columns were built as Clarke Quay's, which sat
    // next door then; now Clarke Quay is across the expressway)
    else if (LAYOUT_MODE === 'real') d = b.id as District;
    m[y * W + x] = di(d); set[y * W + x] = 1; q.push(y * W + x);
  }
  // breadth first from every block tile; a filler tile west of the main block only from the moved blocks
  const westOf = MAIN.nx - MAIN.x0;
  for (let k = 0; k < q.length; k++) {
    // (Mandai, the nineteenth pass, and the Southern Islands, the twenty-first, claim none of the filler: the parkland and
    // the sea round them keep the district they had before)
    const i = q[k], x = i % W, y = (i - x) / W, bk = blockNew(x, y), fromMain = bk === MAIN;
    if (bk && NO_FILL.has(bk.id) && !GHOST.has(bk.id)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (set[j] || (fromMain && nx < westOf)) continue;
      set[j] = 1; m[j] = m[i]; q.push(j);
    }
  }
  if (LAYOUT_MODE === 'real') for (let y = HOLE[1]; y <= HOLE[3]; y++) for (let x = HOLE[0]; x <= HOLE[2]; x++) m[y * W + x] = di('katong');
  for (const i of ghost) { const x = i % W, y = (i - x) / W, b = blockNew(x, y)!; m[i] = di(districtAtOld(x - b.nx + b.x0, y - b.ny + b.y0)); }
  DMAP = m; return m;
}
/** the district the City map paints a tile as. The same as districtAt everywhere but the filler west of Chinatown,
 * where districtAt's nearest-block fill draws stepped diagonal borders across the parks. There the map splits a narrow
 * gap between two blocks side by side down the middle, and otherwise takes the nearest block (or split gap) straight
 * up or down the tile's column, so the borders run straight along the seam roads. Only the map's tint and borders use
 * it: what is open, and where, still follows districtAt. */
export function mapDistrictAt(tx: number, ty: number): District {
  const x = Math.max(0, Math.min(W - 1, tx)), y = Math.max(0, Math.min(H - 1, ty));
  if (LAYOUT_MODE !== 'real' || x >= MAIN.nx - MAIN.x0 || blockNew(x, y)) return districtAt(x, y);
  const m = MDMAP ?? (MDMAP = new Map()); const k = y * W + x, got = m.get(k); if (got) return got;
  // (Mandai is a block the filler's borders ignore, as districtAt's fill does: the parkland's tint is as it was)
  const blk = (bx: number, by: number) => { if (bx < 0 || by < 0 || bx >= W || by >= H) return null; const b = blockNew(bx, by); return b && NO_FILL.has(b.id) ? null : b; };
  const moved = (bx: number, by: number) => { const b = blk(bx, by); return !!b && b !== MAIN; };
  // the gap split: the nearer of the blocks within 16 tiles either side along the row (the main block never claims it)
  const split = (gx: number, gy: number): District | null => {
    if (gx < 0 || gy < 0 || gx >= W || gy >= H || blk(gx, gy)) return null;
    let L = 0, R = 0; for (let r = 1; r <= 16; r++) { if (!L && blk(gx - r, gy)) L = r; if (!R && blk(gx + r, gy)) R = r; }
    if (!L || !R) return null;
    const lm = moved(gx - L, gy), rm = moved(gx + R, gy);
    return lm && (!rm || L <= R) ? districtAt(gx - L, gy) : rm ? districtAt(gx + R, gy) : null;
  };
  const at = (cx: number, cy: number) => moved(cx, cy) ? districtAt(cx, cy) : split(cx, cy);
  let d = split(x, y);
  for (let r = 1; r < H && !d; r++) d = at(x, y - r) ?? at(x, y + r);
  for (let r = 1; r < W && !d; r++) d = moved(x - r, y) ? districtAt(x - r, y) : moved(x + r, y) ? districtAt(x + r, y) : null;
  const out = d ?? districtAt(x, y); m.set(k, out); return out;
}
let MDMAP: Map<number, District> | null = null;
/** Orchard Road's old place in the world (the real layout): new HDB estates between Little India and Changi */
const HOLE = [376, 0, 423, 37] as const;
/** the district at an old-frame tile (the build passes) */
export function districtAtOld(tx: number, ty: number): District {
  // Sentosa and the harbour round it are the south; Little India and Kampong Glam the far side of the Rochor River
  if (tx >= MND_X0 && tx < MND_X0 + MND_W && ty >= MND_Y0 && ty < MND_Y0 + MND_H) return 'mandai';
  if (ty >= ISL_Y0) return tx >= BKT_X0 && tx < BKT_X0 + BKT_W && ty >= BKT_Y0 ? 'bukit' : 'islands';
  if (tx >= KAL_NX0 && tx < KAL_NX0 + KAL_W && ty >= KAL_NY0 && ty < KAL_NY0 + KAL_NH) return 'kallang';
  if (tx >= KAL_X0 && tx < KAL_X0 + KAL_W && ty >= KAL_Y0 && ty < KAL_Y0 + KAL_H - KAL_NH) return 'kallang';
  if (ty >= CT_H && tx >= UBIN_X0 && tx <= UBIN_X1 && ty >= UBIN_Y0 && ty <= UBIN_Y1) return 'pulau';
  if (ty >= CT_H) return tx >= SOUTH_X0 - 4 && tx <= SOUTH_X1 + 1 ? (tx >= QUAY_X0 ? 'quay' : tx >= TIONG_X0 ? 'tiong' : 'jurong') : 'resort';
  // past the Geylang River: Orchard Road north, Katong south, Changi to the east
  if (tx >= FAR_X0 - 4) return tx >= CHANGI_X0 ? 'changi' : ty < FAR_SPLIT ? 'orchard' : 'katong';
  if (tx >= EAST_X0 - 4) return ty < EAST_SPLIT ? 'india' : 'glam';
  if (tx >= OW) return ty < ISLE_SPLIT ? 'heartland' : 'bay';
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
  /** the Singapore pass (lib/jade-sgcity.ts) */
  sg?: SgCity;
  /** the island (lib/jade-island.ts): expressways, the MRT line and its stations, taxi stands, gang hideouts */
  isle?: Isle;
  /** the ninth pass (lib/jade-east.ts): the cable car and the ferry, the festival spots, the mynahs' roost */
  east?: East;
  /** the twelfth pass (lib/jade-far.ts): the Christmas light-up, the Jewel's waterfall, the cycling track, the bats' roost */
  far?: Far;
  /** the fourteenth pass (lib/jade-south.ts): Clarke Quay's canopy and Slingshot, the bird corner, Jurong Lake's lanterns */
  south?: South;
  /** the seventeenth pass (lib/jade-ubin.ts): Pulau Ubin's bumboat, durian trees, boar trails, quarries and Chek Jawa */
  ubin?: Ubin;
  /** the eighteenth pass (lib/jade-kallang.ts): the Sports Hub's gates and fan zone, the basin, Kallang's parked rides */
  kallang?: Kallang;
  /** the nineteenth pass (lib/jade-mandai.ts): the Night Safari's trails and tram, Bird Paradise's lories, the show */
  mandai?: Mandai;
  /** the twenty-first pass (lib/jade-islands.ts): the Southern Islands' ferry, reef flats, tortoises and lighthouse */
  islands?: Islands;
  /** the twenty-second pass (lib/jade-bukit.ts): Bukit Timah's summit trail, the macaques' haunts and the Gardens */
  bukit?: Bukit;
};

// the street plan: horizontal and vertical roads, 4 tiles wide (kerb, lane, lane, kerb). Chinatown's twelve come first
// (CT_ROADS keeps their first extents: Chinatown is built from those); four of its east-west roads now run on over the
// Central Expressway into the island, and the island adds its expressways and avenues
export const CT_ROADS: Road[] = [
  { axis: 'h', at: 12, from: 0, to: 119 }, { axis: 'h', at: 30, from: 0, to: 119 }, { axis: 'h', at: 46, from: 0, to: 119 }, { axis: 'h', at: 62, from: 0, to: 119 },
  { axis: 'h', at: 22, from: 75, to: 119 },
  { axis: 'v', at: 10, from: 12, to: 81 }, { axis: 'v', at: 26, from: 12, to: 65 }, { axis: 'v', at: 42, from: 0, to: 81 }, { axis: 'v', at: 60, from: 0, to: 81 },
  { axis: 'v', at: 71, from: 0, to: 81 }, { axis: 'v', at: 90, from: 0, to: 81 }, { axis: 'v', at: 106, from: 12, to: 65 },
];
/** the island's east edge for roads (the east coast is beyond) */
export const ISLE_X1 = 207;
/** the road plan in the old frame (the build passes); ROADS below is the same list in the new frame, same indices */
export const OLD_ROADS: Road[] = [
  ...CT_ROADS.map((r, i) => i === 0 || i === 2 || i === 3 || i === 4 ? { ...r, to: EAST_X1 } : i === 1 ? { ...r, to: 125 } : i === 10 ? { ...r, to: 115 } : { ...r }),
  // 12-14: the Central Expressway (north to south), the Pan Island Expressway and the East Coast Parkway (over the bay mouth)
  { axis: 'v', at: 122, from: 0, to: 81 }, { axis: 'h', at: 36, from: 122, to: ISLE_X1 }, { axis: 'h', at: 78, from: 122, to: ISLE_X1 },
  // 15-17: the island's avenues, Toa Payoh above the Pan Island Expressway and the bay front below it
  { axis: 'v', at: 140, from: 12, to: 65 }, { axis: 'v', at: 166, from: 0, to: 65 }, { axis: 'v', at: 196, from: 12, to: 65 },
  // 18-20 (ninth pass): Little India and Kampong Glam's three north-south roads past the Rochor River
  { axis: 'v', at: 224, from: 0, to: 81 }, { axis: 'v', at: 244, from: 0, to: 81 }, { axis: 'v', at: 264, from: 12, to: 65 },
  // 21-23: Sentosa's roads: Siloso Road, the beach walk and Imbiah Road between them
  { axis: 'h', at: 100, from: 46, to: 120 }, { axis: 'h', at: 112, from: 46, to: 120 }, { axis: 'v', at: 60, from: 100, to: 115 },
  // 24-27 (twelfth pass): the east-west roads on over the Geylang River: Orchard Boulevard (then Airport Boulevard),
  // Orchard Road, East Coast Road (then Upper Changi Road) and Marine Parade Road (then Loyang Avenue)
  { axis: 'h', at: 12, from: 272, to: FAR_X1 }, { axis: 'h', at: 22, from: 272, to: CHANGI_X0 - 1 }, { axis: 'h', at: 46, from: 272, to: FAR_X1 }, { axis: 'h', at: 62, from: 272, to: FAR_X1 },
  // 28-31: north-south: Scotts Road / Joo Chiat Road, Emerald Hill Road / Tanjong Katong Road, Netheravon Road and
  // Changi Village Road; 32: the East Coast Parkway along the coast from Katong to Changi
  { axis: 'v', at: 290, from: 0, to: 75 }, { axis: 'v', at: 310, from: 0, to: 75 }, { axis: 'v', at: 340, from: 12, to: 75 }, { axis: 'v', at: 360, from: 12, to: 75 },
  { axis: 'h', at: 72, from: 272, to: FAR_X1 },
  // 33-39 (fourteenth pass): Jurong Town Hall Road's cross street (then Tiong Bahru Road, ending at the Singapore
  // River), Boon Lay Way (then Seng Poh Road and Eu Tong Sen Street); north-south: Jurong Town Hall Road, Kim Tian
  // Road, Eng Hoon Street, Zion Road and Clemenceau Avenue (the strip's own roads: in the world each district is its
  // own block, joined to the others by the seam roads below)
  { axis: 'h', at: 103, from: SOUTH_X0, to: QUAY_X0 + 1 }, { axis: 'h', at: 114, from: 224, to: SOUTH_X1 },
  { axis: 'v', at: 224, from: SOUTH_Y0, to: SOUTH_Y1 }, { axis: 'v', at: 244, from: SOUTH_Y0, to: SOUTH_Y1 }, { axis: 'v', at: 266, from: SOUTH_Y0, to: SOUTH_Y1 }, { axis: 'v', at: 286, from: SOUTH_Y0, to: SOUTH_Y1 }, { axis: 'v', at: 308, from: SOUTH_Y0, to: SOUTH_Y1 },
];
const ALL_ROADS = OLD_ROADS;
/** a road moves with the block it is in; one whose tiles would tear across blocks moving by different amounts can't be
 * a single road any more (the real layout's split roads are written out in SEAM_ROAD below) */
function mvRoad(r: Road, i: number): Road {
  const [fx, fy] = r.axis === 'h' ? [r.from, r.at] : [r.at, r.from];
  const [nfx, nfy] = mvT(fx, fy);
  for (let s = r.from; s <= r.to; s++) for (let k = 0; k < 4; k++) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s, [nx, ny] = mvT(x, y);
    if (nx - x !== nfx - fx || ny - y !== nfy - fy) throw new Error(`jade-layout: road ${i} spans blocks that move apart`);
  }
  return r.axis === 'h' ? { axis: 'h', at: nfy, from: nfx, to: r.to + nfx - fx } : { axis: 'v', at: nfx, from: nfy, to: r.to + nfy - fy };
}
/** the real layout's split roads, in the new frame. A road the relayout cut keeps its index for one piece, which runs
 * on over the filler (as named here) to meet the next road; its other pieces, and the seam's own roads, are added
 * after the old list (SEAM_EXTRA), so every old index (the lights, the expressways, the street names) still holds */
const SEAM_ROAD: Record<number, [Road, string]> = {
  // Orchard's old place: its four roads stay with Little India and Katong and cross the new estates to Changi
  24: [{ axis: 'h', at: 12, from: 372, to: 471 }, 'Sims Avenue'], 25: [{ axis: 'h', at: 22, from: 372, to: 423 }, 'Geylang Road'],
  28: [{ axis: 'v', at: 390, from: 0, to: 75 }, 'Aljunied Road'], 29: [{ axis: 'v', at: 410, from: 0, to: 75 }, 'Paya Lebar Road'],
  // Jurong's two cross streets: the first ends at Clarke Quay's riverside, the second runs on through Clarke Quay (as
  // Eu Tong Sen Street) over the Singapore River and Outram Road into Chinatown's Keong Saik Road
  33: [{ axis: 'h', at: 51, from: 4, to: 51 }, 'Jurong Gateway Road'], 34: [{ axis: 'h', at: 62, from: 30, to: 99 }, 'Havelock Road'],
  // Jurong Town Hall Road from Bukit Timah Road down to the Ayer Rajah Expressway; Tiong Bahru's three up to it; Clemenceau
  // Avenue up from Clarke Quay through Orchard Road (as Emerald Hill Road there) to the top of the map
  35: [{ axis: 'v', at: 30, from: 38, to: 77 }, 'Jurong Town Hall Road'], 36: [{ axis: 'v', at: 46, from: 74, to: 107 }, 'Kim Tian Road'],
  37: [{ axis: 'v', at: 68, from: 74, to: 107 }, 'Eng Hoon Street'], 38: [{ axis: 'v', at: 88, from: 74, to: 107 }, 'Zion Road'],
  39: [{ axis: 'v', at: 70, from: 0, to: 73 }, 'Clemenceau Avenue'],
};
const SEAM_EXTRA: [Road, string][] = [
  // 40-42: Orchard's pieces of Orchard Boulevard and Orchard Road (both on through Fort Canning Park to Outram Road;
  // the boulevard meets Pagoda Street) and Scotts Road (down to Bukit Timah Road); 43-44: Tiong Bahru Road and Seng Poh Road
  [{ axis: 'h', at: 12, from: 36, to: 99 }, 'Orchard Boulevard'], [{ axis: 'h', at: 22, from: 36, to: 99 }, 'Orchard Road'],
  [{ axis: 'v', at: 50, from: 0, to: 41 }, 'Scotts Road'],
  [{ axis: 'h', at: 85, from: 44, to: 91 }, 'Tiong Bahru Road'], [{ axis: 'h', at: 96, from: 44, to: 91 }, 'Seng Poh Road'],
  // 45-47: the seam's own: Bukit Timah Road under Orchard, Outram Road down Chinatown's west side, the Ayer Rajah
  // Expressway from Jurong to Outram Road
  [{ axis: 'h', at: 38, from: 30, to: 99 }, 'Bukit Timah Road'], [{ axis: 'v', at: 96, from: 12, to: 77 }, 'Outram Road'],
  [{ axis: 'h', at: 74, from: 30, to: 99 }, 'Ayer Rajah Expressway'],
];
const REAL_ROADS = LAYOUT_MODE === 'real';
/** the road plan in the new frame (what traffic, the map, the street names and the townsfolk use) */
export const ROADS: Road[] = REAL_ROADS ? [...OLD_ROADS.map((r, i) => SEAM_ROAD[i]?.[0] ?? mvRoad(r, i)), ...SEAM_EXTRA.map(e => e[0])] : OLD_ROADS.map(mvRoad);
/** what a road is called where it runs over filler (the street names read off the old frame cover the rest) */
const SEAM_NAME: (string | null)[] = ROADS.map((_, i) => !REAL_ROADS ? null : i < OLD_ROADS.length ? SEAM_ROAD[i]?.[1] ?? null : SEAM_EXTRA[i - OLD_ROADS.length][1]);
/** the Ayer Rajah Expressway's index in ROADS (the real layout only) */
export const AYE = REAL_ROADS ? ROADS.length - 1 : -1;
/** expressways in OLD_ROADS (the build passes): faster lanes, no townsfolk, no lights, gantries */
export const XWAYS = [12, 13, 14, 32];
/** the same in ROADS (what runs in the world): the build's, and the Ayer Rajah Expressway */
export const XWAY_ROADS = REAL_ROADS ? [...XWAYS, AYE] : XWAYS;
/** real public street names of Singapore's Chinatown and the river, one per road above (no brands) */
export const STREET_NAME = ['Pagoda Street', 'Trengganu Street', 'Smith Street', 'Keong Saik Road', 'River Valley Road',
  'Neil Road', 'Temple Street', 'South Bridge Road', 'New Bridge Road', 'Boat Quay', 'Merchant Road', 'Hill Street',
  'Central Expressway', 'Pan Island Expressway', 'East Coast Parkway', 'Shenton Way', 'Marina Way', 'Bayfront Avenue',
  'Race Course Road', 'Serangoon Road', 'Jalan Besar', 'Siloso Road', 'Siloso Beach Walk', 'Imbiah Road',
  'Orchard Boulevard', 'Orchard Road', 'East Coast Road', 'Marine Parade Road', 'Joo Chiat Road', 'Tanjong Katong Road', 'Netheravon Road', 'Changi Village Road', 'East Coast Parkway',
  'Jurong Gateway Road', 'Boon Lay Way', 'Jurong Town Hall Road', 'Kim Tian Road', 'Eng Hoon Street', 'Zion Road', 'Clemenceau Avenue'];
/** the fourteenth pass's cross streets change name by district (by column): [road, from column, name] */
const SOUTH_STREET: [number, number, string][] = [[33, TIONG_X0, 'Tiong Bahru Road'], [34, QUAY_X0, 'Eu Tong Sen Street'], [34, TIONG_X0, 'Seng Poh Road']];
/** the twelfth pass's roads that change name: in Changi (by column) and north in Orchard (by row) */
const FAR_EAST: Record<number, string> = { 24: 'Airport Boulevard', 26: 'Upper Changi Road', 27: 'Loyang Avenue' };
const FAR_NORTH: Record<number, string> = { 28: 'Scotts Road', 29: 'Emerald Hill Road' };
/** past Chinatown a road takes the island's name for it: [road, from tile x or y, name] (real public road names) */
const ISLE_STREET: [number, number, string][] = [[0, EAST_X0 - 4, 'Syed Alwi Road'], [4, EAST_X0 - 4, 'Buffalo Road'], [2, EAST_X0 - 4, 'Arab Street'], [3, EAST_X0 - 4, 'Victoria Street'],[0, 126, 'Lorong 1 Toa Payoh'], [4, 126, 'Toa Payoh Central'], [2, 126, 'Raffles Quay'], [3, 126, 'Marina Boulevard'],
  [0, 120, 'Central Expressway slip road'], [1, 120, 'Central Expressway slip road'], [2, 120, 'Central Expressway slip road'], [3, 120, 'Central Expressway slip road'], [4, 120, 'Central Expressway slip road']];
const ISLE_NORTH: Record<number, string> = { 15: 'Lorong 4 Toa Payoh', 16: 'Toa Payoh East', 17: 'Lorong 8 Toa Payoh' };
/** Kampong Glam's names for the roads that run on south out of Little India (real public road names) */
const GLAM_SOUTH: Record<number, string> = { 18: 'Beach Road', 19: 'North Bridge Road', 20: 'Kandahar Street' };
/** the street a new-frame tile is on (null off the roads) */
export function streetAt(tx: number, ty: number): string | null {
  const b = blockNew(tx, ty);
  // (west of where Orchard Road was built, the main block's pieces of its two roads take their new names: they lead
  // on to Sims Avenue and Geylang Road now, not into Orchard Road)
  if (b && REAL_ROADS && b.id === 'main' && tx - b.nx + b.x0 < FAR_X0) for (const k of [24, 25]) if (onRoad(ROADS[k], tx, ty)) return SEAM_NAME[k];
  if (b) return streetAtOld(tx - b.nx + b.x0, ty - b.ny + b.y0);
  // filler: the seam's roads (the expressway first, where it crosses another)
  for (let k = ROADS.length - 1; k >= 0; k--) if (SEAM_NAME[k] && onRoad(ROADS[k], tx, ty)) return SEAM_NAME[k];
  return null;
}
const onRoad = (r: Road, tx: number, ty: number) => r.axis === 'h' ? ty >= r.at && ty < r.at + 4 && tx >= r.from && tx <= r.to : tx >= r.at && tx < r.at + 4 && ty >= r.from && ty <= r.to;
function streetAtOld(tx: number, ty: number): string | null {
  for (let i = 0; i < OLD_ROADS.length; i++) {
    const r = OLD_ROADS[i];
    if (r.axis === 'h' ? ty >= r.at && ty < r.at + 4 && tx >= r.from && tx <= r.to : tx >= r.at && tx < r.at + 4 && ty >= r.from && ty <= r.to) {
      if (i < 12 && tx >= OW) { let n = STREET_NAME[i]; for (const [k, from, name] of ISLE_STREET) if (k === i && tx >= from) { n = name; break; } return n; }
      if (ISLE_NORTH[i] && ty < ISLE_SPLIT) return ISLE_NORTH[i];
      if (GLAM_SOUTH[i] && ty >= EAST_SPLIT) return GLAM_SOUTH[i];
      if (i === 10 && ty >= 82) return 'Sentosa Gateway';
      if (FAR_EAST[i] && tx >= CHANGI_X0) return FAR_EAST[i];
      for (const [k, from, name] of SOUTH_STREET) if (k === i && tx >= from) return name;
      if (FAR_NORTH[i] && ty < FAR_SPLIT) return FAR_NORTH[i];
      return STREET_NAME[i];
    }
  }
  return null;
}
/** is new-frame tile (tx,ty) on an expressway (lanes or verge) */
export function xwayAt(tx: number, ty: number): boolean {
  const b = blockNew(tx, ty);
  if (!b) return XWAY_ROADS.some(i => onRoad(ROADS[i], tx, ty));
  tx = tx - b.nx + b.x0; ty = ty - b.ny + b.y0;
  for (const i of XWAYS) { const r = OLD_ROADS[i]; if (r.axis === 'h' ? ty >= r.at && ty < r.at + 4 && tx >= r.from && tx <= r.to : tx >= r.at && tx < r.at + 4 && ty >= r.from && ty <= r.to) return true; }
  return false;
}
const CANAL_X0 = 66, CANAL_X1 = 68, SEA_Y = 82;

let CACHE: City | null = null;
/** the city in the new frame: every pass runs in the old frame, then relayout() moves the result */
export function city(): City { if (!CACHE) { const c = build(); remodel(c); dressBuildings(c); sgCity(c); island(c); east(c); far(c); backLanes(c); south(c); ubin(c); kallang(c); mandai(c); islands(c); bukit(c); CACHE = relayout(c); newRides(CACHE); if (CACHE.ubin) CACHE.parking.push(...CACHE.ubin.park); if (CACHE.kallang) CACHE.parking.push(...CACHE.kallang.park); if (CACHE.mandai) CACHE.parking.push(...CACHE.mandai.park); if (CACHE.islands) CACHE.parking.push(...CACHE.islands.park); if (CACHE.bukit) CACHE.parking.push(...CACHE.bukit.park); } return CACHE; }

const SIDEWALK: Record<District, G> = { market: G.WALK, temple: G.TEMPLE, canal: G.COBBLE, docks: G.DOCK, arcade: G.NEON, heartland: G.HDB, bay: G.GRANITE, india: G.INDIA, glam: G.GLAM, resort: G.RESORT, orchard: G.ORCHARD, katong: G.KATONG, changi: G.CHANGI, tiong: G.TIONG, quay: G.QUAY, jurong: G.JURONG, pulau: G.KAMPONG, kallang: G.HUB, mandai: G.LATERITE, islands: G.ISLEPATH, bukit: G.LAWN };
const FRONTS: Record<District, string[]> = {
  market: ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6', 'shop-7', 'shop-8', 'shop-9', 'shop-10', 'shop-11', 'shop-12'],
  temple: ['bld-hill', 'bld-pavilion', 'bld-incense', 'bld-callig', 'shop-2', 'shop-5', 'shop-9'],
  canal: ['bld-canal', 'bld-tea', 'bld-boathouse', 'bld-flowers', 'bld-wheel', 'shop-3', 'shop-7'],
  docks: ['bld-office', 'bld-fish', 'bld-rope', 'bld-chandler', 'shop-4'],
  arcade: ['bld-noodle', 'bld-karaoke', 'bld-hotel', 'bld-robot', 'bld-boba', 'shop-10', 'shop-12'],
  heartland: ['shop-sg1', 'shop-sg2'], bay: ['shop-sg1', 'shop-sg2'], india: ['shop-sg1'], glam: ['shop-sg2'], resort: ['shop-sg1'], orchard: ['shop-sg1'], katong: ['shop-sg2'], changi: ['shop-sg1'], tiong: ['shop-sg2'], quay: ['shop-sg1'], jurong: ['shop-sg1'], pulau: ['shop-sg1'], kallang: ['shop-sg1'], mandai: ['shop-sg1'], islands: ['shop-sg1'], bukit: ['shop-sg1'],
};
const ROOFS: Record<District, string[]> = {
  market: ['roof-1', 'roof-2', 'roof-3', 'roof-4', 'roof-7', 'roof-8', 'roof-10', 'roof-11'], temple: ['roof-5', 'roof-6', 'roof-1', 'roof-9', 'roof-11'],
  canal: ['roof-2', 'roof-3', 'roof-6', 'roof-7', 'roof-9'], docks: ['roof-4', 'roof-3', 'roof-8', 'roof-10'], arcade: ['roof-4', 'roof-1', 'roof-5', 'roof-12', 'roof-8'],
  heartland: ['roof-4'], bay: ['roof-4'], india: ['roof-4'], glam: ['roof-4'], resort: ['roof-4'], orchard: ['roof-4'], katong: ['roof-4'], changi: ['roof-4'], tiong: ['roof-4'], quay: ['roof-4'], jurong: ['roof-4'], pulau: ['roof-4'], kallang: ['roof-4'], mandai: ['roof-4'], islands: ['roof-4'], bukit: ['roof-4'],
};

function build(): City {
  // Chinatown is built in its own frame (the first 120 columns) with its first road plan and its first random draws, so
  // nothing in it moves; the island east of it is left to lib/jade-island.ts
  const ROADS = CT_ROADS, DISTRICTS = CT_DISTRICTS;
  const N = OLD_W * OLD_H;
  const ground = new Uint8Array(N).fill(G.BLD), solid = new Uint8Array(N).fill(S.BUILDING), flags = new Uint8Array(N);
  const reserved = new Uint8Array(N); // cells taken by plans before the block filler runs
  const buildings: Building[] = [], props: Prop[] = [], decals: Prop[] = [];
  const places: Record<string, Place> = {};
  const ladders: City['ladders'] = [], hides: City['hides'] = [], parking: City['parking'] = [];
  const R = rng(20261114);
  const at = (x: number, y: number) => y * OLD_W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < OW && y < OLD_H;
  for (let y = 0; y < OLD_H; y++) for (let x = OW; x < OLD_W; x++) reserved[at(x, y)] = 1;
  const set = (x: number, y: number, g: G, s: S = S.OPEN, f = 0) => { if (!inb(x, y)) return; const i = at(x, y); ground[i] = g; solid[i] = s; flags[i] = f; reserved[i] = 1; };
  const rect = (x0: number, y0: number, w: number, h: number, g: G, s: S = S.OPEN, f = 0) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, g, s, f); };
  const prop = (x: number, y: number, sprite: string, r: number, solidKind: Prop['solid'], layer: Prop['layer'] = 'ground', extra: Partial<Prop> = {}) => (solidKind === 'low' && (solid[at(x, y)] = S.LOW), props.push({ x: x * T + T / 2, y: y * T + T / 2, sprite, r, solid: solidKind, layer, ...extra }));
  const bld = (x: number, y: number, w: number, h: number, sprite: string, front = true, roof = false) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = at(xx, yy); ground[i] = G.BLD; solid[i] = S.BUILDING; flags[i] = roof ? F_ROOF : 0; reserved[i] = 1; }
    buildings.push({ x, y, w, h, sprite, front, roof });
  };
  const place = (name: string, x: number, y: number, kind: string, label?: string) => { places[name] = { x: x * T + T / 2, y: y * T + T / 2, d: districtAtOld(x, y), kind, name: label }; };

  // ── water: the harbour along the south and the canal running down to it
  rect(0, SEA_Y, OW, OLD_H - SEA_Y, G.SEA, S.WATER);
  rect(CANAL_X0, 0, CANAL_X1 - CANAL_X0 + 1, SEA_Y, G.CANAL, S.WATER);
  rect(64, 0, 2, SEA_Y, G.COBBLE); rect(69, 0, 2, SEA_Y, G.COBBLE); // canal promenades

  // ── roads: kerbs first, then lanes over every kerb so crossings join up; over water they are bridges
  for (const r of ROADS) for (let s = r.from; s <= r.to; s++) for (let k = 0; k < 4; k++) {
    const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s;
    if (ground[at(x, y)] === G.ROAD) continue;
    const water = x >= CANAL_X0 && x <= CANAL_X1 && y < SEA_Y;
    set(x, y, water ? G.BRIDGE : SIDEWALK[districtAtOld(x, y)], S.OPEN, water ? F_BRIDGE : 0);
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

  // ── Temple Street park (north-west): lawns, earth paths, the temple on its steps, the pagoda, a lotus pond
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
  // Smith Street: the market square, the food court, the grocer, safe house, garage, ferry pier
  rect(14, 50, 12, 12, G.PLAZA);
  for (const [x, y, s] of [[15, 52, 'stall-red'], [18, 52, 'stall-fruit'], [21, 52, 'stall-tea'], [15, 56, 'stall-noodle'], [21, 56, 'stall-red'], [18, 59, 'stall-fruit']] as const) stall(x, y, s);
  place('mk-market', 19, 55, 'market', 'Kreta Ayer market stalls'); place('mo', 34, 70, 'contact', 'Chef Mo');
  rect(30, 66, 12, 9, G.PLAZA);
  for (const [x, y, s] of [[31, 67, 'stall-noodle'], [36, 67, 'stall-red'], [31, 71, 'stall-tea'], [38, 72, 'stall-noodle']] as const) stall(x, y, s);
  place('wok-stall', 33, 69, 'spot');
  bld(14, 40, 3, 3, 'shop-4'); place('kee', 15, 43, 'contact', 'Uncle Kee'); rect(14, 43, 12, 3, G.WALK);
  bld(0, 56, 3, 3, 'lm-safe'); rect(0, 59, 10, 3, G.WALK); place('safe-market', 1, 59, 'safe', 'Lantern Lane safe house');
  bld(30, 37, 3, 3, 'lm-garage'); rect(30, 40, 12, 2, G.WALK); place('garage-market', 31, 40, 'garage', 'Smith Street garage');
  rect(10, SEA_Y, 4, 6, G.PLANK); place('ferry', 11, 86, 'spot');
  for (const x of [10, 13]) for (const y of [83, 85, 87]) prop(x, y, 'bollard', 10, 'low');

  // Temple Street blocks: the temple market plaza and Auntie Pang, Master Ren's practice yard, safe house
  rect(30, 16, 12, 9, G.TEMPLE);
  for (const [x, y, s] of [[31, 17, 'stall-tea'], [35, 17, 'stall-red'], [39, 17, 'stall-fruit'], [33, 21, 'stall-tea']] as const) stall(x, y, s);
  place('mk-temple', 36, 20, 'market', 'Temple Street market'); place('pang', 37, 20, 'contact', 'Auntie Pang');
  rect(14, 16, 6, 6, G.TEMPLE); place('ren', 16, 18, 'contact', 'Master Ren'); prop(18, 17, 'lucky-circle', 0, 'none');
  bld(0, 24, 3, 3, 'lm-safe'); rect(0, 27, 10, 3, G.TEMPLE); place('safe-temple', 1, 27, 'safe', 'Pine Steps safe house');

  // Boat Quay: the canal-side market, Kiri's boat jetty, Mr Lim's kiosk, safe house, garage
  rect(46, 34, 14, 6, G.COBBLE);
  for (const [x, y, s] of [[47, 35, 'stall-fruit'], [51, 35, 'stall-tea'], [55, 35, 'stall-red']] as const) stall(x, y, s);
  place('mk-canal', 52, 38, 'market', 'Canal Row market');
  place('kiri', 65, 20, 'contact', 'Kiri'); place('jetty', 65, 24, 'spot');
  place('lim', 50, 18, 'contact', 'Mr Lim'); rect(46, 16, 6, 4, G.COBBLE); prop(48, 16, 'kiosk', 20, 'tall', 'over');
  bld(54, 50, 3, 3, 'lm-safe'); rect(46, 53, 14, 2, G.COBBLE); place('safe-canal', 55, 53, 'safe', 'Willow Water safe house');
  bld(77, 37, 3, 3, 'lm-garage'); rect(75, 40, 15, 2, G.NEON); place('garage-canal', 78, 40, 'garage', 'Strip garage');

  // Clarke Quay: the neon market, Gizmo's arcade, the rooftop terraces, the Crow Roost (boss), safe house
  rect(110, 34, 10, 8, G.NEON);
  for (const [x, y, s] of [[111, 35, 'stall-red'], [115, 35, 'stall-noodle'], [111, 39, 'stall-tea']] as const) stall(x, y, s);
  place('mk-arcade', 115, 39, 'market', 'Neon Row market');
  bld(94, 16, 6, 6, 'lm-arcade'); place('gizmo', 97, 22, 'contact', 'Gizmo'); // fronts onto the neon boulevard
  bld(110, 50, 6, 6, 'lm-arcade'); place('roost', 112, 56, 'spot', 'the Crow Roost'); rect(110, 56, 10, 6, G.NEON);
  bld(80, 26, 3, 3, 'lm-safe'); rect(75, 29, 15, 1, G.NEON); place('safe-arcade', 81, 29, 'safe', 'Neon Loft safe house');
  // rooftop terraces: flat roofs with one-tile gaps you hop across on foot, a ladder at each end
  rect(94, 34, 12, 12, G.NEON);
  for (const [x, y] of [[94, 34], [98, 34], [102, 34], [94, 38], [98, 38], [102, 38], [94, 42], [98, 42], [102, 42]] as const) bld(x, y, 3, 3, 'flat-' + (1 + ((x + y) % 6)), false, true);
  ladders.push({ x: 93, y: 44, rx: 94, ry: 44 }, { x: 105, y: 33, rx: 104, ry: 34 });
  // a second terrace run in Smith Street
  rect(0, 66, 10, 16, G.WALK);
  for (const [x, y] of [[0, 66], [4, 66], [0, 70], [4, 70], [0, 74], [4, 74], [0, 78], [4, 78]] as const) bld(x, y, 3, 3, 'flat-' + (1 + ((x * 3 + y) % 6)), false, true);
  ladders.push({ x: 8, y: 81, rx: 6, ry: 80 }, { x: 8, y: 66, rx: 6, ry: 66 });

  // Docks: the apron, warehouses, container stacks, cranes, piers; the warehouse yard for the stealth job
  for (let y = 66; y < SEA_Y; y++) for (let x = 46; x < OW; x++) if (!reserved[at(x, y)]) set(x, y, G.DOCK);
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
        const d = districtAtOld(x, y);
        const kind = roll < 0.42 ? 'scooter' : roll < 0.6 ? 'trishaw' : roll < 0.8 ? 'tuktuk' : 'van';
        const rot = r.axis === 'h' ? (k === 0 ? -Math.PI / 2 : Math.PI / 2) : (k === 0 ? 0 : Math.PI);
        parking.push({ x: x * T + T / 2, y: y * T + T / 2, d, kind, rot });
      }
    }
  }
  // boats at the canal jetties and the ferry
  // (moored against the bank or a pier, so you can step aboard from dry land; the last one in the water off the east
  // side's pier, which was later laid over its old mooring)
  for (const [x, y, rot] of [[66, 24, 1], [66, 44, 1], [66, 60, 1], [66, 77, 1], [12, 88, 0], [9, 85, 1], [99, 85, 1], [104, 88, 1]] as const) parking.push({ x: x * T + T / 2, y: y * T + T / 2, d: districtAtOld(x, y), kind: 'boat', rot: rot * Math.PI / 2 });

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
      const d = districtAtOld(s, r.at);
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
    const x = Math.floor(R() * OW), y = Math.floor(R() * CT_H);
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
  for (let y = 1; y < CT_H - 1; y++) for (let x = 1; x < OW - 1; x++) {
    const i = at(x, y);
    if (solid[i] !== S.OPEN || ground[i] === G.ROAD || flags[i] & F_BRIDGE) continue;
    if (solid[at(x, y - 1)] === S.BUILDING && !(flags[at(x, y - 1)] & F_ROOF)) quiet.push([x, y]);
  }
  const taken = new Set<number>();
  const far = (x: number, y: number, d: number) => { for (const k of taken) { const kx = k % OLD_W, ky = Math.floor(k / OLD_W); if (Math.abs(kx - x) < d && Math.abs(ky - y) < d) return false; } return true; };
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
  for (const d of DISTRICTS) for (const [x, y] of [...pick(5, 5, (x, y) => districtAtOld(x, y) === d && (flags[at(x, y)] & F_ALLEY) > 0), ...pick(2, 5, (x, y) => districtAtOld(x, y) === d && ground[at(x, y)] !== G.ROAD)].slice(0, 7)) {
    hides.push({ x: x * T + T / 2, y: y * T + T / 2 }); props.push({ x: x * T + T / 2, y: y * T + 14, sprite: R() < 0.55 ? 'curtain' : 'basket', r: 0, solid: 'none', layer: 'ground' });
  }
  let m = 0;
  for (const d of DISTRICTS) for (const [x, y] of pick(3, 6, (x, y) => districtAtOld(x, y) === d && ground[at(x, y)] !== G.ROAD)) {
    murals.push({ id: 'mural-' + (++m), x: x * T + T / 2, y: y * T + 10 });
  }
  for (const d of DISTRICTS) for (const [x, y] of pick(8, 3, (x, y) => districtAtOld(x, y) === d && solid[at(x, y)] === S.OPEN)) cats.push({ x: x * T + T / 2, y: y * T + T / 2 });
  // the rest of the 50 cats sit in odd corners: rooftops, pier ends, the park
  const odd: [number, number][] = [[95, 35], [103, 43], [99, 39], [1, 67], [5, 79], [2, 2], [40, 1], [12, 5], [102, 88], [49, 88]];
  for (const [x, y] of odd) cats.push({ x: x * T + T / 2, y: y * T + T / 2 });
  for (let d = 2; cats.length < 50 && d > 0; d--) for (const [x, y] of pick(50 - cats.length, d, (x, y) => solid[at(x, y)] === S.OPEN)) cats.push({ x: x * T + T / 2, y: y * T + T / 2 });

  return { ground, solid, flags, buildings, props, roads: ALL_ROADS, decals, places, cats: cats.slice(0, 50), murals, ladders, hides, parking, paths: [], tables: [], festival: [] };

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
    const d = districtAtOld(b.x, b.y);
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
    for (let x = b.x; x < b.x + b.w; x++) if (below < OLD_H && c.solid[below * OLD_W + x] !== S.BUILDING) open++;
    b.front = open >= 2;
    const d = districtAtOld(b.x, b.y);
    const list = b.front ? FRONTS[d] : ROOFS[d];
    // never the same picture as a building touching this one
    const near = new Set(c.buildings.filter(o => o !== b && o.sprite && o.x <= b.x + b.w && o.x + o.w >= b.x && o.y <= b.y + b.h && o.y + o.h >= b.y).map(o => o.sprite));
    const ok = list.filter(n => !near.has(n));
    const pool = ok.length ? ok : list;
    b.sprite = pool[Math.floor(R() * pool.length)];
  }
}
function findBlocks(ground: Uint8Array, reserved: Uint8Array) {
  const seen = new Uint8Array(OLD_W * OLD_H); const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    const i = y * OLD_W + x;
    if (seen[i] || reserved[i] || ground[i] !== G.BLD) continue;
    // flood the connected unreserved region and take its bounding box
    let x0 = x, x1 = x, y0 = y, y1 = y; const st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop()!; const jx = j % OLD_W, jy = (j - jx) / OLD_W;
      x0 = Math.min(x0, jx); x1 = Math.max(x1, jx); y0 = Math.min(y0, jy); y1 = Math.max(y1, jy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = jx + dx, ny = jy + dy; if (nx < 0 || ny < 0 || nx >= OLD_W || ny >= OLD_H) continue;
        const k = ny * OLD_W + nx; if (seen[k] || reserved[k] || ground[k] !== G.BLD) continue; seen[k] = 1; st.push(k);
      }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

// ── the relayout: the built city (old frame) into the world you play in (new frame)
/** a world position, a tile position and a tile rect {x, y, w, h} move with the block under them; sizes, radii,
 * lengths and rotations stay */
const mvXY = <O extends { x: number; y: number }>(o: O): O => { const [x, y] = mvP(o.x, o.y); return { ...o, x, y }; };
const mvTXY = <O extends { x: number; y: number }>(o: O): O => { const [x, y] = mvT(o.x, o.y); return { ...o, x, y }; };
/** a per-tile layer, copied tile by tile; filler is `fill` */
function mvLayer(a: Uint8Array, fill: number): Uint8Array {
  const out = new Uint8Array(W * H).fill(fill);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = blockNew(x, y); if (!b) continue;
    out[y * W + x] = a[(y - b.ny + b.y0) * OLD_W + (x - b.nx + b.x0)];
  }
  return out;
}
function relayout(c: City): City {
  const n: City = {
    ground: mvLayer(c.ground, G.SEA), solid: mvLayer(c.solid, S.WATER), flags: mvLayer(c.flags, 0),
    buildings: c.buildings.map(mvTXY), props: c.props.map(mvXY), roads: ROADS, decals: c.decals.map(mvXY),
    places: Object.fromEntries(Object.entries(c.places).map(([k, p]) => [k, mvXY(p)])),
    cats: c.cats.map(mvXY), murals: c.murals.map(mvXY), hides: c.hides.map(mvXY), parking: c.parking.map(mvXY),
    // a ladder's foot (x, y) and the roof tile it reaches (rx, ry) are tiles; they move together, with the foot
    ladders: c.ladders.map(l => { const [x, y] = mvT(l.x, l.y); return { x, y, rx: l.rx + x - l.x, ry: l.ry + y - l.y }; }),
    paths: c.paths.map(p => ({ ...p, pts: mvPLine(p.pts) })), tables: c.tables.map(mvXY), festival: c.festival.map(mvXY),
  };
  if (c.sg) { const g = c.sg, [hx, hy] = mvT(g.hawker.x0, g.hawker.y0);
    n.sg = { ...g, fivefoot: mvLayer(g.fivefoot, 0), hawker: { x0: hx, y0: hy, x1: g.hawker.x1 + hx - g.hawker.x0, y1: g.hawker.y1 + hy - g.hawker.y0 },
      tables: g.tables.map(mvXY), kopi: mvPP(g.kopi),
      // a gantry knows its world position and the road tile it stands over
      gantries: g.gantries.map(q => { const [x, y] = mvP(q.x, q.y), [tx, ty] = mvT(q.tx, q.ty); return { ...q, x, y, tx, ty }; }),
      pigeons: g.pigeons.map(mvPP), bins: g.bins.map(mvPP), gum: g.gum.map(mvPP), round: mvPLine(g.round), junk: g.junk.map(mvPP),
      chess: mvPP(g.chess), mama: mvPP(g.mama), getai: mvPP(g.getai), jetties: g.jetties.map(mvPP), silver: g.silver.map(mvTRect) }; }
  if (c.isle) { const i = c.isle, h = i.hideouts;
    // the MRT line is abstract (trains run along it between stations) but its points are world positions: each point
    // moves with its block, so the distances along it (lineLen, each station's s, visFrom) are measured again, a
    // distance inside a leg keeping its share of that leg
    const line = i.line.map(mvPP), L0 = i.lineLen, L1 = [0];
    for (let k = 1; k < line.length; k++) L1.push(L1[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
    const along = (s: number) => { let k = 1; while (k < L0.length - 1 && L0[k] < s) k++; const f = (s - L0[k - 1]) / Math.max(1e-9, L0[k] - L0[k - 1]); return L1[k - 1] + f * (L1[k] - L1[k - 1]); };
    n.isle = { ...i, rail: mvPLine(i.rail), line, lineLen: L1, visFrom: along(i.visFrom), stations: i.stations.map(st => ({ ...mvXY(st), s: along(st.s) })), taxiStands: i.taxiStands.map(mvPP),
      hideouts: Object.fromEntries(Object.entries(h).map(([k, v]) => [k, mvPP(v)])) as typeof h, stage: mvTRect(i.stage) }; }
  if (c.east) { const e = c.east;
    const link = (l: typeof e.cable): typeof e.cable => ({ ...l, stops: [mvXY(l.stops[0]), mvXY(l.stops[1])], path: mvPLine(l.path) });
    n.east = { ...e, cable: link(e.cable), ferry: link(e.ferry), pylons: e.pylons.map(mvPP), arch: mvPP(e.arch), lamps: e.lamps.map(mvPP),
      kolams: e.kolams.map(mvPP), bazaar: e.bazaar.map(mvPP), pelita: e.pelita.map(mvPP), beach: e.beach.map(mvPP), chairs: e.chairs.map(mvPP) }; }
  if (c.far) { const f = c.far;
    n.far = { ...f, arches: f.arches.map(mvPP), lights: f.lights.map(mvPP), trees: f.trees.map(mvPP), vortex: mvPP(f.vortex), jewel: mvTRect(f.jewel),
      track: mvPLine(f.track), bikes: f.bikes.map(mvPP), kites: f.kites.map(mvPP), bbq: f.bbq.map(mvPP), spots: f.spots.map(mvPP),
      planes: f.planes.map(mvPP), roost: mvPP(f.roost) }; }
  if (c.south) { const o = c.south, [lx, ly] = mvP(o.lake[0], o.lake[1]);
    n.south = { ...o, canopy: o.canopy.map(mvPP), sling: mvPP(o.sling), stage: mvPP(o.stage), birds: mvPP(o.birds), kueh: mvPP(o.kueh),
      lake: [lx, ly, o.lake[2], o.lake[3]], koi: o.koi.map(mvPP), scope: mvPP(o.scope), lanterns: o.lanterns.map(mvPP), lotus: o.lotus.map(mvPP),
      walk: [mvPP(o.walk[0]), mvPP(o.walk[1])] }; }
  if (c.ubin) { const u = c.ubin, boatA = u.boatA.map(mvPP), boatB = u.boatB.map(mvPP), [fx0, fy0] = mvP(u.flats[0], u.flats[1]);
    // the bumboat's two ends move with their own blocks (Changi's, the island's); the open water between is laid again
    n.ubin = { ...u, boatA, boatB, boat: linkOf('bumboat', u.boat.name, [mvXY(u.boat.stops[0]), mvXY(u.boat.stops[1])], boatPath(boatA, boatB)),
      digs: u.digs.map(mvPP), durians: u.durians.map(mvPP), tracks: u.tracks.map(([a, b]) => [mvPP(a), mvPP(b)] as [[number, number], [number, number]]),
      tower: mvPP(u.tower), flats: [fx0, fy0, fx0 + u.flats[2] - u.flats[0], fy0 + u.flats[3] - u.flats[1]], den: mvPP(u.den), rack: mvPP(u.rack), park: u.park.map(mvXY) }; }
  if (c.kallang) { const k = c.kallang, [bx, by] = mvP(k.basin[0], k.basin[1]);
    n.kallang = { ...k, exit: mvPP(k.exit), gates: k.gates.map(mvPP), fanzone: mvPP(k.fanzone), wave: mvPP(k.wave), tower: mvPP(k.tower),
      basin: [bx, by, bx + k.basin[2] - k.basin[0], by + k.basin[3] - k.basin[1]], park: k.park.map(mvXY) }; }
  if (c.mandai) { const d = c.mandai;
    n.mandai = { ...d, tram: mvPLine(d.tram), stops: d.stops.map(mvPP), perch: mvPP(d.perch), stage: mvPP(d.stage), plane: mvPP(d.plane), studs: d.studs.map(mvPP),
      lanterns: d.lanterns.map(mvPP), park: d.park.map(mvXY) }; }
  if (c.islands) { const d = c.islands, boatA = d.boatA.map(mvPP), boatB = d.boatB.map(mvPP);
    // the island ferry's two ends move with their own blocks (Marina Bay's pier, St John's jetty); the water between is
    // laid again
    n.islands = { ...d, boatA, boatB, ferry: linkOf('launch', d.ferry.name, [mvXY(d.ferry.stops[0]), mvXY(d.ferry.stops[1])], islePath(boatA, boatB)),
      rocks: d.rocks.map(mvPP), pools: d.pools.map(mvPP), tortoises: d.tortoises.map(mvPP), lagoon: mvPP(d.lagoon), gallery: mvPP(d.gallery), pond: mvPP(d.pond),
      jetties: d.jetties.map(mvPP), beam: mvPP(d.beam), junk: mvPP(d.junk), park: d.park.map(mvXY), quiet: mvTRect(d.quiet) }; }
  if (c.bukit) { const d = c.bukit;
    n.bukit = { ...d, trail: d.trail.map(mvPP), shelters: d.shelters.map(mvPP), summit: mvPP(d.summit), lake: mvPP(d.lake), swans: d.swans.map(mvPP), quarry: mvPP(d.quarry),
      haunts: d.haunts.map(mvPP), bridge: mvPP(d.bridge), rail: [mvPP(d.rail[0]), mvPP(d.rail[1])], park: d.park.map(mvXY) }; }
  if (LAYOUT_MODE === 'real') seams(n);
  return n;
}

// ── the seams (the real layout only): the filler between the moved blocks, laid in the new frame. Nothing here touches
// a block's tile (tests/jade-layout.mjs checks every block against the build, tile by tile)
/** west of Chinatown: the sea off the west coast and south of the land, the beach above it, the Singapore River's way
 * from Clarke Quay down beside Outram Road to the harbour */
const WEST_X1 = 99, COAST_Y = 110, RIVER_X = 92;
function seams(c: City) {
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !blockNew(x, y);
  const setT = (x: number, y: number, g: G, s: S = S.OPEN, f = 0) => { if (!free(x, y)) return; const i = y * W + x; c.ground[i] = g; c.solid[i] = s; c.flags[i] = f; };
  const water = (x: number, y: number) => c.solid[y * W + x] === S.WATER;
  const px = (t: number) => t * T + T / 2;
  const R = rng(20261119);
  const prop = (x: number, y: number, sprite: string, r: number, solid: Prop['solid'], layer: Prop['layer'] = 'over', w?: number) => { if (solid === 'low') c.solid[y * W + x] = S.LOW; c.props.push({ x: px(x), y: px(y), sprite, r, solid, layer, w }); };
  const bld = (x: number, y: number, w: number, h: number, sprite: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setT(xx, yy, G.BLD, S.BUILDING);
    c.buildings.push({ x, y, w, h, sprite, front: true });
  };

  // ── the ground. West: parkland (Bukit Timah's green north of Jurong, Fort Canning Park between Orchard Road and
  // Chinatown, West Coast Park south of Jurong), the beach and the sea; the river. Orchard's old place: HDB concrete
  for (let y = 0; y < H; y++) for (let x = 0; x <= WEST_X1; x++) {
    if (!free(x, y)) continue;
    const sea = x <= 3 || y >= COAST_Y || (x >= RIVER_X && y >= 78), sand = !sea && (y >= COAST_Y - 4 || (x >= 44 && y >= 108));
    setT(x, y, sea ? G.SEA : sand ? G.SAND : G.GRASS, sea ? S.WATER : S.OPEN, sea || sand ? 0 : F_PARK);
  }
  for (let y = 51; y < 78; y++) for (let x = RIVER_X; x < RIVER_X + 4; x++) setT(x, y, G.CANAL, S.WATER);
  for (let y = HOLE[1]; y <= HOLE[3]; y++) for (let x = HOLE[0]; x <= HOLE[2]; x++) setT(x, y, G.HDB);

  // ── roads over the filler: kerbs in the district's paving (the expressway's are grass verges), then the lanes over
  // them so crossings join up; over water they are bridges
  const xw = new Set(XWAY_ROADS), kerbG = (x: number, y: number) => x >= HOLE[0] ? G.HDB : SIDEWALK[districtAt(x, y)];
  const tiles = (r: Road, ks: number[], f: (x: number, y: number, s: number, k: number) => void) => { for (let s = r.from; s <= r.to; s++) for (const k of ks) { const x = r.axis === 'h' ? s : r.at + k, y = r.axis === 'h' ? r.at + k : s; if (free(x, y)) f(x, y, s, k); } };
  ROADS.forEach((r, i) => tiles(r, [0, 3], (x, y) => {
    if (c.ground[y * W + x] === G.ROAD) return;
    if (water(x, y) || (c.flags[y * W + x] & F_BRIDGE)) setT(x, y, G.BRIDGE, S.OPEN, F_BRIDGE); else setT(x, y, xw.has(i) ? G.GRASS : kerbG(x, y));
  }));
  ROADS.forEach((r, i) => tiles(r, [1, 2], (x, y) => {
    const br = c.ground[y * W + x] === G.BRIDGE || water(x, y);
    setT(x, y, br ? G.BRIDGE : G.ROAD, S.OPEN, (br ? F_BRIDGE : 0) | (xw.has(i) ? F_XWAY : 0));
  }));
  const cross = (x: number, y: number) => { let h = false, v = false; for (const r of ROADS) { if (onRoad(r, x, y)) { if (r.axis === 'h') h = true; else v = true; } } return h && v; };
  // the expressway's crash barriers (a gap at every junction), lane dashes, lamps on the kerbs, kerbside parking
  for (const i of xw) tiles(ROADS[i], [0, 3], (x, y, s) => {
    const r = ROADS[i];
    if (c.ground[y * W + x] !== G.GRASS || cross(x, y) || ROADS.some((o, j) => j !== i && o.axis !== r.axis && (r.axis === 'h' ? x >= o.at - 2 && x <= o.at + 5 && r.at + 3 >= o.from && r.at <= o.to : y >= o.at - 2 && y <= o.at + 5 && r.at + 3 >= o.from && r.at <= o.to))) return;
    c.solid[y * W + x] = S.LOW; if (s % 2 === 0) c.props.push({ x: px(x), y: px(y), sprite: 'xw-barrier', r: 0, solid: 'none', layer: 'ground', w: 2 * T, rot: r.axis === 'h' ? 0 : Math.PI / 2 });
  });
  for (const r of ROADS) for (let s = r.from; s <= r.to; s += 2) {
    const x = r.axis === 'h' ? s : r.at + 2, y = r.axis === 'h' ? r.at + 2 : s;
    if (!free(x, y) || cross(x, y) || (r.axis === 'h' ? cross(x, y - 1) : cross(x - 1, y))) continue;
    c.decals.push({ x: r.axis === 'h' ? x * T + T / 2 : x * T, y: r.axis === 'h' ? y * T : y * T + T / 2, sprite: 'd-dash', r: 0, solid: 'none', layer: 'ground', w: T * 0.8, rot: r.axis === 'h' ? 0 : Math.PI / 2 });
  }
  const kerb = (x: number, y: number) => c.solid[y * W + x] === S.OPEN && c.ground[y * W + x] !== G.ROAD && !(c.flags[y * W + x] & F_BRIDGE) && !cross(x, y);
  let k = 0;
  ROADS.forEach((r, i) => { if (!xw.has(i)) tiles(r, [0, 3], (x, y, s, kk) => {
    if ((s - r.from) % 11 !== 5 || !kerb(x, y)) return;
    const kind = ++k % 4 === 0 ? 'van' : k % 4 === 2 ? 'tuktuk' : 'scooter';
    c.parking.push({ x: px(x), y: px(y), d: districtAt(x, y), kind, rot: r.axis === 'h' ? (kk === 0 ? -Math.PI / 2 : Math.PI / 2) : (kk === 0 ? 0 : Math.PI) });
  }); });
  ROADS.forEach((r, i) => { if (!xw.has(i)) tiles(r, [0, 3], (x, y, s, kk) => {
    if ((s - r.from) % 6 !== 2 || !kerb(x, y) || c.parking.some(p => Math.abs(p.x - px(x)) < T && Math.abs(p.y - px(y)) < T)) return;
    c.props.push({ x: px(x) + (r.axis === 'v' ? (kk === 0 ? -20 : 20) : 0), y: px(y) + (r.axis === 'h' ? (kk === 0 ? -20 : 20) : 0), sprite: 'lamp', r: 8, solid: 'tall', layer: 'over' });
  }); });

  // ── Orchard's old place: HDB blocks round the new crossings, a playground, a multi-storey car park, void-deck tables
  for (const [x, y, w, h, sp] of [[377, 2, 10, 4, 'hdb-slab-a'], [384, 7, 4, 4, 'hdb-point-b'], [396, 2, 10, 4, 'hdb-slab-b'], [416, 2, 4, 4, 'hdb-point-a'], [416, 7, 4, 4, 'hdb-point-b'],
    [378, 17, 10, 4, 'hdb-slab-a'], [396, 16, 6, 5, 'hdb-mscp'], [404, 17, 4, 4, 'hdb-point-a'], [417, 17, 4, 4, 'hdb-point-b'],
    [377, 27, 10, 4, 'hdb-slab-b'], [379, 32, 4, 4, 'hdb-point-a'], [396, 27, 10, 4, 'hdb-slab-a'], [416, 28, 4, 4, 'hdb-point-b'], [416, 33, 4, 4, 'hdb-point-a']] as const) bld(x, y, w, h, sp);
  for (let y = 7; y < 10; y++) for (let x = 397; x < 403; x++) setT(x, y, G.RUBBER);
  prop(400, 8, 'playground', 40, 'tall', 'over', 150);
  for (const [x, y, sp, w] of [[379, 7, 'void-table', 84], [398, 22, 'void-table', 84], [386, 33, 'letterbox', 84], [404, 33, 'void-table', 84]] as const) prop(x, y, sp, 22, 'tall', 'over', w);
  for (const [x, y] of [[388, 1], [407, 9], [421, 11], [377, 36], [386, 36], [399, 34], [407, 35], [421, 36]] as const) if (c.ground[y * W + x] === G.HDB) prop(x, y, 'tree-round', 22, 'tall');

  // ── the parks west of Chinatown: trees on the lawns, clear of the roads and the river
  const lawn = (x: number, y: number) => free(x, y) && c.ground[y * W + x] === G.GRASS && (c.flags[y * W + x] & F_PARK) > 0;
  // (Mandai, the nineteenth pass, took over the north-west corner of this parkland: a tree that would have stood there
  // still draws its dice, so every tree after it stays where it was)
  // (and Bukit Timah, the twenty-second, took over the parkland west of Tiong Bahru, the same way)
  const mnd = (x: number, y: number) => { const id = blockNew(x, y)?.id; return id === 'mandai' || id === 'bukit'; };
  for (let y = 1; y < COAST_Y - 4; y += 3) for (let x = 5; x <= WEST_X1; x += 3) {
    const tx = x + Math.floor(R() * 2), ty = y + Math.floor(R() * 2);
    if (R() < 0.45) continue;
    let ok = true, was = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = lawn(tx + dx, ty + dy); if (!l) ok = false; if (!l && !mnd(tx + dx, ty + dy)) was = false; }
    if (ok || (was && !mnd(tx, ty))) prop(tx, ty, R() < 0.6 ? 'tree-round' : 'tree-frangipani', 22, 'tall');
    else if (was) R();
  }

  // ── the river bridges the relayout made (Havelock Road over the Singapore River, Clemenceau Avenue by Clarke Quay)
  // were bare asphalt over the water: give each the canal's stone bridge, balustrades and all (not the expressways)
  const bridged = (bx: number, by: number) => c.decals.some(d => d.sprite.startsWith('d-bridge') && Math.hypot(d.x - bx, d.y - by) < 3 * T) || c.props.some(p => p.sprite === 'red-bridge' && Math.hypot(p.x - bx, p.y - by) < 3 * T);
  ROADS.forEach((r, i) => {
    if (xw.has(i)) return;
    let run = -1;
    for (let s = r.from; s <= r.to + 1; s++) {
      const x = r.axis === 'h' ? s : r.at + 1, y = r.axis === 'h' ? r.at + 1 : s;
      const on = s <= r.to && x >= 0 && y >= 0 && x < W && y < H && c.ground[y * W + x] === G.BRIDGE && (c.flags[y * W + x] & F_BRIDGE) > 0;
      if (on && run < 0) run = s;
      if (on || run < 0) continue;
      const len = s - run, mid = run + len / 2; run = -1;
      if (len < 2 || len > 8) continue;
      const bx = r.axis === 'h' ? mid * T : (r.at + 2) * T, by = r.axis === 'h' ? (r.at + 2) * T : mid * T;
      if (!bridged(bx, by)) c.decals.push({ x: bx, y: by, sprite: 'd-bridge-stone', r: 0, solid: 'none', layer: 'ground', w: (len + 2.2) * T, rot: r.axis === 'h' ? 0 : Math.PI / 2 });
    }
  });
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

// Jade Street: the layout table. The city is built in its first frame (the "old" frame: 376×128 tiles, the districts
// where each pass first put them) and then moved, block by block, into the world you play in (the "new" frame). A block
// is an old tile rect and the new tile it lands at; a tile no block covers is filler (open sea) in the new world. Every
// absolute world position in the game (the city's own, and the story's, gigs', businesses' and so on) goes through
// mvT / mvP once, so a block can move without a hand edit anywhere else.
// The live table puts the districts where they are in Singapore: the main block (Chinatown, Sentosa below it, Toa
// Payoh and Marina Bay, Little India and Kampong Glam, Katong and Changi) moves 100 columns east, and four districts the
// build laid out east of Chinatown come out of it and go west: Orchard Road to the north-west, Clarke Quay below it,
// Tiong Bahru below that (south-west of Chinatown) and Jurong far to the west. The tiles no block covers are filler,
// laid in the new frame by lib/jade-city.ts (the seams: link roads, the Ayer Rajah Expressway, the Singapore River's
// way out to the sea, parkland, and new HDB estates in Orchard's old place).
// Two debug tables (globalThis.__JADE_LAYOUT__ before the game's modules load): 'zero', the identity (the old frame
// itself, which the tests compare the real world with block by block), and 'shift', which moves every block by the same
// +7 tiles east and +3 south (tests/jade-layout.mjs proves each position goes through the table).
// A leaf module: it imports nothing, so lib/jade-city.ts and every pass can use it.

/** the tile size in world units (also lib/jade-city.ts T) */
const T = 64;
/** the old frame: the world the build passes lay out */
export const OLD_W = 376, OLD_H = 128;

/** an old tile rect (inclusive) and the new tile its top-left corner lands at */
export type Block = { id: string; x0: number; y0: number; x1: number; y1: number; nx: number; ny: number };
export type Layout = { blocks: Block[]; NW: number; NH: number };

/** the identity: the whole old world onto itself */
const ZERO: Layout = { blocks: [{ id: 'main', x0: 0, y0: 0, x1: OLD_W - 1, y1: OLD_H - 1, nx: 0, ny: 0 }], NW: OLD_W, NH: OLD_H };
/** the four blocks that leave the main block (more specific blocks first: a tile belongs to the first block that covers
 * it). The south strip's three are its land rows only (96 to 125), split on the column between Zion Road and the
 * Singapore River, so no road runs along a seam */
const MOVED = [
  { id: 'orchard', x0: 276, y0: 0, x1: 323, y1: 37 }, { id: 'jurong', x0: 194, y0: 96, x1: 241, y1: 125 },
  { id: 'tiong', x0: 242, y0: 96, x1: 289, y1: 125 }, { id: 'quay', x0: 290, y0: 96, x1: 329, y1: 125 },
];
/** the real table (new-frame origins): Orchard Road north-west of Chinatown, Fort Canning Park between them (Orchard
 * Boulevard runs on into Pagoda Street); Clarke Quay under Orchard (Clemenceau Avenue joins them; Eu Tong Sen Street runs
 * on over the Singapore River into Keong Saik Road); Tiong Bahru under that, south-west of Smith Street, past the Ayer
 * Rajah Expressway; Jurong at the west edge; the main block 100 columns east */
const REAL_AT: Record<string, [number, number]> = { orchard: [36, 0], quay: [52, 44], tiong: [44, 78], jurong: [0, 44], main: [100, 0] };
const REAL: Layout = {
  blocks: [...MOVED, { id: 'main', x0: 0, y0: 0, x1: OLD_W - 1, y1: OLD_H - 1 }].map(b => ({ ...b, nx: REAL_AT[b.id][0], ny: REAL_AT[b.id][1] })),
  NW: OLD_W + 100, NH: OLD_H,
};
/** the test table: the same five blocks, every one moved by the same +7, +3 */
const SHIFT_X = 7, SHIFT_Y = 3;
const SHIFT: Layout = {
  blocks: [...MOVED, { id: 'main', x0: 0, y0: 0, x1: OLD_W - 1, y1: OLD_H - 1 }].map(b => ({ ...b, nx: b.x0 + SHIFT_X, ny: b.y0 + SHIFT_Y })),
  NW: OLD_W + SHIFT_X, NH: OLD_H + SHIFT_Y,
};

const mode = (globalThis as { __JADE_LAYOUT__?: string }).__JADE_LAYOUT__;
/** the table in use */
export const LAYOUT_MODE: 'real' | 'zero' | 'shift' = mode === 'shift' ? 'shift' : mode === 'zero' ? 'zero' : 'real';
export const LAYOUT: Layout = LAYOUT_MODE === 'shift' ? SHIFT : LAYOUT_MODE === 'zero' ? ZERO : REAL;
/** the new world's size in tiles */
export const NW = LAYOUT.NW, NH = LAYOUT.NH;
const BLOCKS = LAYOUT.blocks;
const MAIN = BLOCKS[BLOCKS.length - 1];

const inOld = (b: Block, tx: number, ty: number) => tx >= b.x0 && tx <= b.x1 && ty >= b.y0 && ty <= b.y1;
/** the block an old tile belongs to (the first that covers it); a tile off every block (off the old world) takes the
 * nearest block, so a point just past an edge moves with the land next to it */
export function blockOld(tx: number, ty: number): Block {
  for (const b of BLOCKS) if (inOld(b, tx, ty)) return b;
  let best = MAIN, bd = Infinity;
  for (const b of BLOCKS) { const dx = Math.max(b.x0 - tx, 0, tx - b.x1), dy = Math.max(b.y0 - ty, 0, ty - b.y1), d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } }
  return best;
}
/** the block a new tile shows (null: filler) */
export function blockNew(tx: number, ty: number): Block | null {
  for (const b of BLOCKS) {
    const ox = tx - b.nx + b.x0, oy = ty - b.ny + b.y0;
    if (inOld(b, ox, oy) && blockOld(ox, oy) === b) return b;
  }
  return null;
}
/** old tile -> new tile */
export function mvT(tx: number, ty: number): [number, number] {
  const b = blockOld(Math.floor(tx), Math.floor(ty));
  return [tx + b.nx - b.x0, ty + b.ny - b.y0];
}
/** old world position -> new world position (the block is the one under the point) */
export function mvP(px: number, py: number): [number, number] {
  const b = blockOld(Math.floor(px / T), Math.floor(py / T));
  return [px + (b.nx - b.x0) * T, py + (b.ny - b.y0) * T];
}
/** new tile -> old tile (null: filler, no old tile shows there) */
export function unmvT(tx: number, ty: number): [number, number] | null {
  const b = blockNew(Math.floor(tx), Math.floor(ty));
  return b ? [tx - b.nx + b.x0, ty - b.ny + b.y0] : null;
}
/** new world position -> old world position (null: filler) */
export function unmvP(px: number, py: number): [number, number] | null {
  const b = blockNew(Math.floor(px / T), Math.floor(py / T));
  return b ? [px - (b.nx - b.x0) * T, py - (b.ny - b.y0) * T] : null;
}
/** old tile x / y alone, for a point known to be in the main block (a road's row, a column threshold) */
export const mvTX = (tx: number, ty = 0) => mvT(tx, ty)[0];
export const mvTY = (ty: number, tx = 0) => mvT(tx, ty)[1];

/** the same move for the shapes content uses. A tile pair or a world pair: */
export const mvTP = (p: readonly [number, number]): [number, number] => mvT(p[0], p[1]);
export const mvPP = (p: readonly [number, number]): [number, number] => mvP(p[0], p[1]);
/** a list of separate tile spots (each moves with its own block) */
export const mvTs = (a: readonly (readonly [number, number])[]): [number, number][] => a.map(p => mvT(p[0], p[1]));
/** a list of separate world spots */
export const mvPs = (a: readonly (readonly [number, number])[]): [number, number][] => a.map(p => mvP(p[0], p[1]));
/** a tile rect [x0, y0, x1, y1] (inclusive corners) moves by its top-left corner and keeps its size */
export function mvTRect(r: readonly [number, number, number, number]): [number, number, number, number] {
  const [x, y] = mvT(r[0], r[1]); return [x, y, x + r[2] - r[0], y + r[3] - r[1]];
}
/** a polyline in world units moves by its first point, so a line never tears across blocks */
export function mvPLine(pts: readonly (readonly [number, number])[]): [number, number][] {
  if (!pts.length) return [];
  const [x, y] = mvP(pts[0][0], pts[0][1]), dx = x - pts[0][0], dy = y - pts[0][1];
  return pts.map(p => [p[0] + dx, p[1] + dy]);
}
/** the same for a polyline in tiles */
export function mvTLine(pts: readonly (readonly [number, number])[]): [number, number][] {
  if (!pts.length) return [];
  const [x, y] = mvT(pts[0][0], pts[0][1]), dx = x - pts[0][0], dy = y - pts[0][1];
  return pts.map(p => [p[0] + dx, p[1] + dy]);
}
/** does every block move by the same amount (so a road or a line can't tear)? */
export const UNIFORM = BLOCKS.every(b => b.nx - b.x0 === MAIN.nx - MAIN.x0 && b.ny - b.y0 === MAIN.ny - MAIN.y0);

// Where everything is in each painting, in percent of the painting's width and height: the hotspots, the ways out,
// the people and things drawn on top as cut-outs, and the floor Dora and Enzo walk along. Read off the paintings in
// public/art/clocktower/ (1536 × 1024).
import type { ItemId, RoomId, State, Who } from '@/lib/clocktower-game';

export type Rect = [number, number, number, number];
/** a cut-out drawn on the painting: centred on x, feet on y, h tall (all percent); `spot` makes it clickable */
export type Sprite = { id: string; src: string; x: number; y: number; h: number; spot?: string; flip?: boolean; when?: (s: State) => boolean };
export type Exit = { rect: Rect; label: string; dir: 'left' | 'right' | 'up' | 'down' | 'in' };
export type Layout = {
  img: (s: State) => string; spots: Record<string, Rect>; exits: Partial<Record<RoomId, Exit>>; sprites: Sprite[];
  /** the floor line (feet) and how tall Dora and Enzo are, and where they stand when they come in */
  floor: number; size: number; start: Record<Who, number>; lo: number; hi: number;
};
const has = (s: State, f: string) => (s.flags as string[]).includes(f);
const got = (s: State, i: ItemId) => s.got.includes(i);

export const LAYOUT: Record<RoomId, Layout> = {
  square: {
    img: (s) => (s.ch === 1 ? 'square-dusk' : 'square-night'),
    spots: { clockface: [43.5, 18.5, 13, 18], stalls: [28, 42, 16, 21], well: [0, 46, 15, 36], drain: [86, 75, 9, 6], hatdoor: [71, 41, 8, 24], button: [14.5, 80.5, 7, 8] },
    exits: {
      tower: { rect: [45, 44, 10, 16], label: 'The clock tower', dir: 'in' }, bakery: { rect: [21, 40, 8, 24], label: 'Hollis’s bakery', dir: 'in' },
      riverside: { rect: [88, 48, 12, 26], label: 'Down to the river', dir: 'right' }, hatshop: { rect: [71, 41, 8, 24], label: 'The Hatters’ shop', dir: 'in' },
    },
    sprites: [{ id: 'button', src: 'item-button', x: 18, y: 87.5, h: 4, spot: 'button', when: (s) => has(s, 'cornerLit') && !got(s, 'button') }],
    floor: 95, size: 30, start: { dora: 40, enzo: 52 }, lo: 18, hi: 84,
  },
  tower: {
    img: () => 'tower',
    spots: { bench: [17, 40, 32, 33], oilcan: [19, 44.5, 6, 8], chute: [51, 51, 8, 13], rope: [60, 0, 4, 66] },
    exits: { square: { rect: [1, 8, 16, 70], label: 'Out to the square', dir: 'left' }, clockroom: { rect: [75, 8, 23, 62], label: 'Up the stairs', dir: 'up' } },
    sprites: [
      { id: 'tock', src: 'tock', x: 38, y: 93, h: 42, spot: 'tock' },
      { id: 'oilcan', src: 'item-oilcan', x: 22, y: 52, h: 6.5, spot: 'oilcan', when: (s) => !got(s, 'oilcan') },
    ],
    floor: 95, size: 31, start: { dora: 55, enzo: 66 }, lo: 20, hi: 82,
  },
  clockroom: {
    img: () => 'clockroom',
    spots: { works: [33, 20, 37, 56], chart: [71, 26, 19, 26], hatch: [72, 55, 11, 15], bell: [72, 0, 19, 24] },
    exits: { tower: { rect: [80, 54, 18, 27], label: 'Down the ladder', dir: 'down' } },
    sprites: [],
    floor: 96, size: 30, start: { dora: 24, enzo: 36 }, lo: 10, hi: 86,
  },
  bakery: {
    img: () => 'bakery',
    spots: { tub1: [31, 47, 12, 16], tub2: [44, 47, 12, 16], tub3: [56, 47, 13, 16], oven: [72, 26, 25, 30], damper: [77, 5, 13, 9], sack: [0, 60, 19, 17] },
    exits: { square: { rect: [0, 79, 8, 21], label: 'Out to the square', dir: 'left' } },
    sprites: [{ id: 'hollis', src: 'hollis', x: 18, y: 94, h: 40, spot: 'hollis' }],
    floor: 96, size: 31, start: { dora: 46, enzo: 58 }, lo: 12, hi: 90,
  },
  riverside: {
    img: () => 'riverside',
    spots: { wheel: [19, 27, 18, 35], outlet: [44, 45, 8, 12] },
    exits: {
      mill: { rect: [2, 30, 10, 25], label: 'Nell’s mill', dir: 'in' }, boat: { rect: [57, 10, 33, 52], label: 'Captain Rook’s barge', dir: 'in' },
      square: { rect: [86, 26, 14, 34], label: 'Up to the square', dir: 'right' },
    },
    sprites: [],
    floor: 97, size: 28, start: { dora: 40, enzo: 52 }, lo: 8, hi: 92,
  },
  boat: {
    img: (s) => (got(s, 'boathook') ? 'boat-nohook' : 'boat'),
    spots: { rook: [60, 25, 33, 44], nest: [7, 0, 19, 17], musicbox: [40, 44, 10, 13], boathook: [50, 27, 10, 50] },
    exits: { riverside: { rect: [0, 77, 9, 23], label: 'Back to the jetty', dir: 'left' } },
    sprites: [
      { id: 'gubbins', src: 'gubbins', x: 18, y: 16, h: 14, spot: 'gubbins', when: (s) => !has(s, 'gubbinsDown') && !got(s, 'silver') },
      { id: 'gubbins-down', src: 'gubbins', x: 6.5, y: 58, h: 17, spot: 'gubbins', when: (s) => has(s, 'gubbinsDown') && !got(s, 'silver') },
    ],
    floor: 97, size: 30, start: { dora: 22, enzo: 34 }, lo: 12, hi: 88,
  },
  mill: {
    img: () => 'mill',
    spots: { lever: [84, 1, 10, 38], stones: [35, 33, 33, 42] },
    exits: { riverside: { rect: [0, 20, 15, 60], label: 'Out to the river', dir: 'left' } },
    sprites: [{ id: 'nell', src: 'nell', x: 75, y: 93, h: 34, spot: 'nell' }],
    floor: 95, size: 31, start: { dora: 40, enzo: 52 }, lo: 18, hi: 90,
  },
  hatshop: {
    img: () => 'hatshop',
    spots: { float: [71, 22, 27, 23], hats: [37, 20, 34, 26] },
    exits: { square: { rect: [0, 78, 8, 22], label: 'Out to the square', dir: 'left' } },
    sprites: [{ id: 'twins', src: 'twins', x: 56, y: 93, h: 34, spot: 'twins', when: (s) => has(s, 'twinsOpen') }],
    floor: 95, size: 31, start: { dora: 26, enzo: 38 }, lo: 12, hi: 90,
  },
};
/** the works close-up: the four spindles left to right, and how big a wheel each takes (percent of the width) */
export const SPINDLES: { x: number; y: number; d: number }[] = [
  { x: 24.3, y: 46, d: 15 }, { x: 41, y: 46, d: 11.5 }, { x: 59, y: 46, d: 9.5 }, { x: 76.4, y: 46, d: 5.5 },
];
/** a speaker's face for the talk box: a cut-out (and where its head is), or a crop of a painting */
export const FACES: Record<string, { src: string; size: number; x: number; y: number }> = {
  dora: { src: 'dora', size: 190, x: 50, y: 4 }, enzo: { src: 'enzo', size: 190, x: 50, y: 4 }, tock: { src: 'tock', size: 230, x: 52, y: 4 },
  hollis: { src: 'hollis', size: 200, x: 48, y: 9 }, nell: { src: 'nell', size: 230, x: 50, y: 4 }, twins: { src: 'twins', size: 170, x: 50, y: 10 },
  gubbins: { src: 'gubbins', size: 230, x: 22, y: 8 }, rook: { src: 'boat', size: 700, x: 86, y: 40 },
};

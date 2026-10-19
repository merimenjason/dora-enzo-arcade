// Chinchilla Trek's painted art: the twelve files and where each subject sits in its sheet. Generated from
// docs/chinchilla-trek-crops.json (rect = the measured silhouette plus 8 px of padding, [x, y, width, height] in
// source pixels) and the delivered files' SHA-256; tests/chinchilla-trek-art.mjs checks they stay in step.
import type { ChapterNo, EvoId, FoeId, GearSlot, SkillId } from './chinchilla-trek-data.js';

export type TrekRect = readonly [number, number, number, number];
export type TrekSheet = 'foes-1' | 'foes-2' | 'foes-3' | 'landmarks' | 'skills' | 'gear';
export type TrekBackdrop = 'bg-1' | 'bg-2' | 'bg-3' | 'bg-4' | 'bg-5';
export type TrekAsset = TrekSheet | TrekBackdrop | 'title';
export type TrekSprite = { sheet: TrekSheet; rect: TrekRect };
export const TREK_ASSETS: readonly TrekAsset[] = ['foes-1', 'foes-2', 'foes-3', 'landmarks', 'skills', 'gear', 'title', 'bg-1', 'bg-2', 'bg-3', 'bg-4', 'bg-5'];
/** The first 12 hex digits of each file's SHA-256, used as a cache-busting version. All twelve are served as delivered. */
export const TREK_HASHES: Record<TrekAsset, string> = { 'foes-1': '0c7de93fdb6f', 'foes-2': '6ce976e7709a', 'foes-3': '9c28b2355972', 'landmarks': '4aa666ea2be1', 'skills': '0201f6a51f59', 'gear': 'd04d321e8322', 'title': '4f7a73c7b4a2', 'bg-1': '6ed27862530e', 'bg-2': '8b48ae49d9f1', 'bg-3': '5142add9bb5a', 'bg-4': '38ace0245e18', 'bg-5': '831148c8c27a' };

/** The thirty foes, painted facing left, toward the hero. */
export const TREK_FOES: Record<FoeId, TrekSprite> = {
  beetle: { sheet: 'foes-1', rect: [113, 126, 175, 149] },
  mice: { sheet: 'foes-1', rect: [494, 134, 176, 143] },
  toad: { sheet: 'foes-1', rect: [882, 146, 164, 130] },
  wasp: { sheet: 'foes-1', rect: [1240, 131, 168, 149] },
  hedgepig: { sheet: 'foes-1', rect: [116, 439, 189, 152] },
  kingmole: { sheet: 'foes-1', rect: [493, 436, 192, 159] },
  magpie: { sheet: 'foes-1', rect: [863, 437, 190, 158] },
  stoat: { sheet: 'foes-1', rect: [1230, 455, 209, 136] },
  sprite: { sheet: 'foes-1', rect: [131, 728, 177, 163] },
  piglet: { sheet: 'foes-1', rect: [506, 759, 170, 132] },
  raccoon: { sheet: 'foes-1', rect: [852, 735, 208, 156] },
  badger: { sheet: 'foes-1', rect: [1247, 729, 186, 163] },
  crab: { sheet: 'foes-2', rect: [109, 147, 192, 135] },
  heron: { sheet: 'foes-2', rect: [462, 86, 217, 208] },
  pike: { sheet: 'foes-2', rect: [876, 114, 180, 179] },
  vole: { sheet: 'foes-2', rect: [1247, 153, 214, 142] },
  turtle: { sheet: 'foes-2', rect: [85, 449, 249, 185] },
  otter: { sheet: 'foes-2', rect: [471, 432, 247, 203] },
  snowhare: { sheet: 'foes-2', rect: [865, 430, 229, 195] },
  ptarmigan: { sheet: 'foes-2', rect: [1263, 465, 204, 165] },
  goatkid: { sheet: 'foes-2', rect: [80, 760, 232, 177] },
  imp: { sheet: 'foes-2', rect: [500, 766, 201, 171] },
  pika: { sheet: 'foes-2', rect: [871, 749, 191, 188] },
  foxqueen: { sheet: 'foes-2', rect: [1232, 758, 247, 179] },
  bat: { sheet: 'foes-3', rect: [78, 111, 238, 176] },
  moth: { sheet: 'foes-3', rect: [470, 104, 212, 183] },
  wisp: { sheet: 'foes-3', rect: [882, 97, 154, 197] },
  owlet: { sheet: 'foes-3', rect: [1272, 126, 159, 165] },
  shadowcat: { sheet: 'foes-3', rect: [72, 417, 261, 196] },
  hornedowl: { sheet: 'foes-3', rect: [442, 391, 268, 223] },
};
/** The friendly visitors and extras on foes-3, kept apart from the foes. Pip's two poses are one character. */
export const TREK_EXTRAS: Record<'owl' | 'fox' | 'pip' | 'pipBag' | 'pony' | 'dizzy', TrekSprite> = {
  owl: { sheet: 'foes-3', rect: [845, 424, 233, 192] },
  fox: { sheet: 'foes-3', rect: [1238, 402, 246, 211] },
  pip: { sheet: 'foes-3', rect: [99, 731, 213, 196] },
  pipBag: { sheet: 'foes-3', rect: [468, 738, 210, 186] },
  pony: { sheet: 'foes-3', rect: [823, 719, 286, 212] },
  dizzy: { sheet: 'foes-3', rect: [1240, 739, 218, 166] },
};
export type TrekLandmark = 'story' | 'crossroads' | 'chest' | 'chestOpen' | 'wheel' | 'cart' | 'rest' | 'acorn';
export const TREK_LANDMARKS: Record<TrekLandmark, TrekSprite> = {
  story: { sheet: 'landmarks', rect: [114, 120, 196, 295] },
  crossroads: { sheet: 'landmarks', rect: [475, 116, 231, 299] },
  chest: { sheet: 'landmarks', rect: [827, 204, 241, 189] },
  chestOpen: { sheet: 'landmarks', rect: [1188, 163, 251, 245] },
  wheel: { sheet: 'landmarks', rect: [107, 561, 227, 322] },
  cart: { sheet: 'landmarks', rect: [434, 574, 295, 298] },
  rest: { sheet: 'landmarks', rect: [815, 654, 265, 180] },
  acorn: { sheet: 'landmarks', rect: [1239, 624, 177, 226] },
};
/** The wheel's disc in landmarks.png: its centre and the radius inside the rim, the pointer's outline (its tip reaches into the
 * disc, so the turning disc leaves it out, and the cream slice it covers fills that notch), and the clockwise angle (degrees from the top) of the middle of each painted slice the game's eight prizes land on. Measured by sampling the slice colours. */
export const TREK_WHEEL = { cx: 221, cy: 692, r: 84, pointer: [[223, 567], [206, 581], [223, 627], [241, 581]] as const, prize: [18, 202.5, 285, 66, 112.5, 159, 243, 330], under: '#fde2be' } as const;

export type TrekBadge = SkillId | EvoId | 'rest' | 'reroll';
export const TREK_BADGES: Record<TrekBadge, TrekRect> = {
  combo: [86, 90, 121, 121],
  counter: [339, 90, 121, 121],
  sharp: [582, 90, 121, 120],
  keen: [830, 89, 122, 121],
  fluff: [1078, 90, 121, 121],
  shell: [1330, 89, 122, 122],
  dust: [84, 325, 123, 123],
  static: [338, 325, 124, 123],
  snack: [580, 325, 123, 123],
  nap: [828, 325, 124, 123],
  grit: [1077, 324, 124, 124],
  prickle: [1330, 324, 123, 124],
  pounce: [83, 560, 126, 126],
  roll: [335, 559, 128, 128],
  pepper: [579, 560, 126, 126],
  frost: [826, 559, 128, 128],
  lucky: [1075, 558, 129, 129],
  wind: [1327, 559, 128, 128],
  storm: [76, 789, 140, 142],
  fury: [328, 788, 142, 143],
  bramble: [570, 788, 142, 143],
  feast: [818, 788, 145, 145],
  rest: [1077, 795, 128, 129],
  reroll: [1326, 793, 133, 130],
};
/** Rows are slots and columns rarities, Plain to Legend. */
export const TREK_GEAR: Record<GearSlot, readonly [TrekRect, TrekRect, TrekRect, TrekRect, TrekRect]> = {
  hat: [[106, 113, 130, 118], [390, 112, 160, 115], [682, 126, 160, 102], [979, 101, 164, 131], [1280, 93, 155, 139]],
  scarf: [[92, 331, 142, 140], [391, 329, 162, 137], [683, 330, 167, 139], [986, 331, 157, 134], [1277, 330, 173, 136]],
  charm: [[123, 555, 94, 140], [424, 555, 94, 147], [725, 552, 86, 147], [1007, 555, 100, 144], [1299, 552, 117, 150]],
  boots: [[89, 795, 154, 130], [394, 798, 160, 126], [679, 796, 156, 129], [981, 798, 159, 129], [1284, 800, 164, 125]],
};
/** Each backdrop's surveyed path band, in source pixels (±20); the hero's feet at y258 of 320 are y825.6 of 1024. */
export const TREK_PATH: Record<ChapterNo, readonly [number, number]> = { 1: [748, 865], 2: [744, 890], 3: [765, 902], 4: [755, 862], 5: [744, 850] };

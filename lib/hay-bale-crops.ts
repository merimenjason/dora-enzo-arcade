// Hay Bale Brawl's painted art: the seven files and where each subject sits in its sheet. Generated from
// docs/hay-bale-brawl-crops.json (rect = the measured silhouette plus 8 px of padding, [x, y, width, height] in
// source pixels) and the delivered files' SHA-256; tests/hay-bale-art.mjs checks both stay in step.
import type { UnitId, TokenId, SnackId } from './hay-bale-units.js';

export type BrawlRect = readonly [number, number, number, number];
export type BrawlSheet = 'critters-1' | 'critters-2' | 'critters-3' | 'snacks';
export type BrawlBackdrop = 'bg-shop' | 'bg-fight';
export type BrawlAsset = BrawlSheet | BrawlBackdrop | 'title';
export const BRAWL_ASSETS: readonly BrawlAsset[] = ['critters-1', 'critters-2', 'critters-3', 'snacks', 'title', 'bg-shop', 'bg-fight'];
/** The two opaque backdrops ship as quality-85 WebP; the sheets and title keep their PNG alpha. */
export const BRAWL_EXT: Record<BrawlAsset, 'png' | 'webp'> = { 'critters-1': 'png', 'critters-2': 'png', 'critters-3': 'png', 'snacks': 'png', 'title': 'png', 'bg-shop': 'webp', 'bg-fight': 'webp' };
/** The first 12 hex digits of each served file's SHA-256, used as a cache-busting version. */
export const BRAWL_HASHES: Record<BrawlAsset, string> = { 'critters-1': 'b8c69f96357d', 'critters-2': '6e11ea399198', 'critters-3': '2691c9aff18b', 'snacks': '80169aa1dcf5', 'title': 'b4f6f59abdc1', 'bg-shop': '0cf59b966cd5', 'bg-fight': '5b20d425bc03' };

type Sprite = { sheet: BrawlSheet; rect: BrawlRect };
export const BRAWL_UNITS: Record<UnitId | TokenId, Sprite> = {
  wren: { sheet: 'critters-1', rect: [136, 121, 190, 175] },
  mouse: { sheet: 'critters-1', rect: [486, 116, 206, 188] },
  ladybird: { sheet: 'critters-1', rect: [862, 110, 188, 199] },
  toad: { sheet: 'critters-1', rect: [1213, 139, 195, 162] },
  bee: { sheet: 'critters-1', rect: [122, 415, 224, 197] },
  dormouse: { sheet: 'critters-1', rect: [465, 411, 242, 200] },
  hedgehog: { sheet: 'critters-1', rect: [822, 419, 252, 194] },
  squirrel: { sheet: 'critters-1', rect: [1191, 405, 238, 211] },
  robin: { sheet: 'critters-1', rect: [132, 726, 210, 193] },
  mole: { sheet: 'critters-1', rect: [489, 746, 222, 172] },
  frog: { sheet: 'critters-1', rect: [839, 751, 203, 177] },
  pip: { sheet: 'critters-1', rect: [1188, 725, 229, 196] },
  badger: { sheet: 'critters-2', rect: [82, 139, 212, 162] },
  otter: { sheet: 'critters-2', rect: [485, 97, 193, 205] },
  magpie: { sheet: 'critters-2', rect: [847, 147, 226, 159] },
  rabbit: { sheet: 'critters-2', rect: [1269, 99, 181, 203] },
  porcupine: { sheet: 'critters-2', rect: [74, 427, 236, 184] },
  beaver: { sheet: 'critters-2', rect: [456, 431, 249, 178] },
  stoat: { sheet: 'critters-2', rect: [838, 442, 239, 170] },
  tortoise: { sheet: 'critters-2', rect: [1249, 470, 211, 142] },
  crow: { sheet: 'critters-2', rect: [71, 755, 242, 178] },
  skunk: { sheet: 'critters-2', rect: [466, 721, 240, 208] },
  raccoon: { sheet: 'critters-2', rect: [833, 773, 255, 159] },
  hare: { sheet: 'critters-2', rect: [1239, 716, 219, 218] },
  boar: { sheet: 'critters-3', rect: [109, 122, 196, 145] },
  bear: { sheet: 'critters-3', rect: [526, 82, 147, 186] },
  stag: { sheet: 'critters-3', rect: [882, 81, 166, 187] },
  duchess: { sheet: 'critters-3', rect: [1258, 126, 167, 140] },
  hawk: { sheet: 'critters-3', rect: [103, 413, 184, 177] },
  goose: { sheet: 'critters-3', rect: [508, 423, 179, 161] },
  mouselet: { sheet: 'critters-3', rect: [891, 447, 146, 141] },
  log: { sheet: 'critters-3', rect: [1231, 452, 222, 134] },
  fawn: { sheet: 'critters-3', rect: [106, 725, 177, 185] },
};
export const BRAWL_SNACKS: Record<SnackId, Sprite> = {
  apple: { sheet: 'snacks', rect: [94, 152, 228, 254] },
  raisin: { sheet: 'snacks', rect: [462, 193, 241, 201] },
  honey: { sheet: 'snacks', rect: [842, 141, 220, 264] },
  hay: { sheet: 'snacks', rect: [1202, 177, 245, 230] },
  mint: { sheet: 'snacks', rect: [91, 607, 231, 226] },
  chilli: { sheet: 'snacks', rect: [466, 603, 222, 231] },
  seed: { sheet: 'snacks', rect: [862, 615, 174, 222] },
  cake: { sheet: 'snacks', rect: [1214, 606, 225, 238] },
};
/** The coaches and the decorative bale are not units: they never reach a line or the shop. */
export const BRAWL_EXTRAS: Record<'dora' | 'enzo' | 'bale', Sprite> = {
  dora: { sheet: 'critters-3', rect: [505, 753, 184, 156] },
  enzo: { sheet: 'critters-3', rect: [872, 752, 166, 155] },
  bale: { sheet: 'critters-3', rect: [1238, 752, 209, 152] },
};
/** The painted straw top of bg-fight, about y650 of 1024 in the source (y203 on the stage). */
export const BRAWL_FIGHT_STAGE_Y = 203.1;

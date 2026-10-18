// Hay Bale Brawl's painted art: loads the seven images on demand and paints crops of them. Importing this module on
// the server is safe (no Image, no window, no request). A painter returns false while its image is pending or failed,
// and the caller draws the code fallback in that frame; nothing waits for art.
import { BRAWL_ASSETS, BRAWL_EXT, BRAWL_EXTRAS, BRAWL_HASHES, BRAWL_SNACKS, BRAWL_UNITS, type BrawlAsset, type BrawlBackdrop, type BrawlRect, type BrawlSheet } from './hay-bale-crops.js';
import type { UnitId, TokenId, SnackId } from './hay-bale-units.js';

export { BRAWL_ASSETS, BRAWL_EXTRAS, BRAWL_FIGHT_STAGE_Y, BRAWL_SNACKS, BRAWL_UNITS } from './hay-bale-crops.js';
export type { BrawlAsset, BrawlBackdrop, BrawlRect, BrawlSheet } from './hay-bale-crops.js';
export type BrawlBox = { x: number; y: number; w: number; h: number };
type Entry = { state: 'pending' | 'ready' | 'failed'; image: HTMLImageElement };

const SIZE = { w: 1536, h: 1024 };
const entries = new Map<BrawlAsset, Entry>(), listeners = new Set<() => void>();
const valid = new Set<string>(BRAWL_ASSETS);
let version = 0;
const notify = () => { version++; listeners.forEach((fn) => fn()); };

/** Subscribe with useSyncExternalStore, so a static canvas repaints when an image arrives or a retry lands. */
export const subscribeBrawlArt = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const brawlArtVersion = () => version;
export const brawlArtServerVersion = () => 0;
export const brawlArtUrl = (key: BrawlAsset) => `/art/brawl/${key}.${BRAWL_EXT[key]}?v=${BRAWL_HASHES[key]}`;

/** Starts loading these files once each. A failed file is not asked for again until retryBrawlArt. */
export function requestBrawlArt(keys: readonly BrawlAsset[]) {
  if (typeof Image === 'undefined') return;
  for (const key of keys) {
    if (!valid.has(key) || entries.has(key)) continue;
    const image = new Image(), entry: Entry = { state: 'pending', image };
    entries.set(key, entry);
    image.decoding = 'async';
    image.onload = () => {
      if (entries.get(key) !== entry) return;
      entry.state = image.naturalWidth === SIZE.w && image.naturalHeight === SIZE.h ? 'ready' : 'failed';
      notify();
    };
    image.onerror = () => { if (entries.get(key) === entry) { entry.state = 'failed'; notify(); } };
    image.src = brawlArtUrl(key);
    notify();
  }
}

export function brawlArtStatus() {
  const ready: BrawlAsset[] = [], pending: BrawlAsset[] = [], failed: BrawlAsset[] = [];
  for (const [key, entry] of entries) (entry.state === 'ready' ? ready : entry.state === 'pending' ? pending : failed).push(key);
  return { ready, pending, failed };
}

/** Asks again for the failed files only; a late callback from the failed attempt is ignored. */
export function retryBrawlArt() {
  const failed = brawlArtStatus().failed;
  for (const key of failed) entries.delete(key);
  requestBrawlArt(failed);
}

/** The sheets these units and tokens are painted on. */
export const brawlSheetsFor = (ids: readonly (UnitId | TokenId)[]) => [...new Set(ids.map((id) => BRAWL_UNITS[id]?.sheet).filter(Boolean))] as BrawlSheet[];
export const CRITTER_SHEETS: readonly BrawlSheet[] = ['critters-1', 'critters-2', 'critters-3'];

/** Contain-fits a source size into `box`, centred across and either centred or standing on the box's bottom. */
export function fitBrawlBox(box: BrawlBox, sourceWidth: number, sourceHeight: number, bottom = false): BrawlBox | null {
  if (![box.x, box.y, box.w, box.h, sourceWidth, sourceHeight].every(Number.isFinite) || box.w <= 0 || box.h <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const scale = Math.min(box.w / sourceWidth, box.h / sourceHeight), w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) * (bottom ? 1 : 0.5), w, h };
}

function paint(c: CanvasRenderingContext2D, key: BrawlAsset, rect: BrawlRect, box: BrawlBox, bottom: boolean, facing: 1 | -1 = 1): boolean {
  const dest = fitBrawlBox(box, rect[2], rect[3], bottom);
  if (!dest) return false;
  requestBrawlArt([key]);
  const entry = entries.get(key);
  if (entry?.state !== 'ready') return false;
  if (facing === 1) { c.drawImage(entry.image, rect[0], rect[1], rect[2], rect[3], dest.x, dest.y, dest.w, dest.h); return true; }
  // the rival crew: only the picture is mirrored, about its own centre
  c.save();
  c.translate(dest.x + dest.w / 2, 0); c.scale(-1, 1);
  c.drawImage(entry.image, rect[0], rect[1], rect[2], rect[3], -dest.w / 2, dest.y, dest.w, dest.h);
  c.restore();
  return true;
}

/** A unit or summon standing on the bottom of `box`, facing right (1) or mirrored to face left (−1). */
export function paintBrawlUnit(c: CanvasRenderingContext2D, id: UnitId | TokenId, box: BrawlBox, facing: 1 | -1 = 1): boolean {
  const s = BRAWL_UNITS[id];
  return s ? paint(c, s.sheet, s.rect, box, true, facing) : false;
}
export function paintBrawlSnack(c: CanvasRenderingContext2D, id: SnackId, box: BrawlBox): boolean {
  const s = BRAWL_SNACKS[id];
  return s ? paint(c, s.sheet, s.rect, box, false) : false;
}
/** A coach or the decorative bale, standing on the bottom of `box`. */
export function paintBrawlExtra(c: CanvasRenderingContext2D, id: 'dora' | 'enzo' | 'bale', box: BrawlBox, facing: 1 | -1 = 1): boolean {
  const s = BRAWL_EXTRAS[id];
  return s ? paint(c, s.sheet, s.rect, box, true, facing) : false;
}
/** The whole 3:2 frame, so the backdrop's stage line and the title's empty text band stay where they were painted. */
export const paintBrawlBackdrop = (c: CanvasRenderingContext2D, key: BrawlBackdrop, box: BrawlBox) => paint(c, key, [0, 0, SIZE.w, SIZE.h], box, false);
export const paintBrawlTitle = (c: CanvasRenderingContext2D, box: BrawlBox) => paint(c, 'title', [0, 0, SIZE.w, SIZE.h], box, false);

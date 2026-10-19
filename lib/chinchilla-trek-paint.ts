// Chinchilla Trek's painted art: loads the twelve images on demand and paints crops of them. Importing this module on
// the server is safe (no Image, no window, no request). A painter returns false while its image is pending or failed,
// and the caller draws the code fallback in that frame; nothing waits for art.
import { TREK_ASSETS, TREK_BADGES, TREK_EXTRAS, TREK_FOES, TREK_GEAR, TREK_HASHES, TREK_LANDMARKS, TREK_WHEEL, type TrekAsset, type TrekBadge, type TrekLandmark, type TrekRect, type TrekSheet, type TrekSprite } from './chinchilla-trek-crops.js';
import type { ChapterNo, FoeId, GearSlot } from './chinchilla-trek-data.js';

export { TREK_ASSETS, TREK_BADGES, TREK_EXTRAS, TREK_FOES, TREK_GEAR, TREK_HASHES, TREK_LANDMARKS, TREK_PATH, TREK_WHEEL } from './chinchilla-trek-crops.js';
export type { TrekAsset, TrekBackdrop, TrekBadge, TrekLandmark, TrekRect, TrekSheet, TrekSprite } from './chinchilla-trek-crops.js';
export type TrekBox = { x: number; y: number; w: number; h: number };
type Entry = { state: 'pending' | 'ready' | 'failed'; image: HTMLImageElement };

const SIZE = { w: 1536, h: 1024 }, PAD = 8;
const entries = new Map<TrekAsset, Entry>(), listeners = new Set<() => void>();
const valid = new Set<string>(TREK_ASSETS);
let version = 0;
const notify = () => { version++; listeners.forEach((fn) => fn()); };

/** Subscribe with useSyncExternalStore, so a still canvas repaints when an image arrives or a retry lands. */
export const subscribeTrekArt = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const trekArtVersion = () => version;
export const trekArtServerVersion = () => 0;
export const trekArtUrl = (key: TrekAsset) => `/art/trek/${key}.png?v=${TREK_HASHES[key]}`;

/** Starts loading these files once each. A failed file is not asked for again until retryTrekArt. */
export function requestTrekArt(keys: readonly TrekAsset[]) {
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
    image.src = trekArtUrl(key);
    notify();
  }
}

export function trekArtStatus() {
  const ready: TrekAsset[] = [], pending: TrekAsset[] = [], failed: TrekAsset[] = [];
  for (const [key, entry] of entries) (entry.state === 'ready' ? ready : entry.state === 'pending' ? pending : failed).push(key);
  return { ready, pending, failed };
}

/** Asks again for the failed files only; a late callback from the failed attempt is ignored. */
export function retryTrekArt() {
  const failed = trekArtStatus().failed;
  for (const key of failed) entries.delete(key);
  requestTrekArt(failed);
}

/** Whether all these files have loaded, asking for any not yet asked for. */
export function trekArtReady(keys: readonly TrekAsset[]) {
  requestTrekArt(keys);
  return keys.every((key) => entries.get(key)?.state === 'ready');
}

/** The image for `key` once it has loaded, asking for it on first use. */
function ready(key: TrekAsset) {
  requestTrekArt([key]);
  const entry = entries.get(key);
  return entry?.state === 'ready' ? entry.image : null;
}

/** Contain-fits a source size into `box`, centred across and either centred or standing on the box's bottom. */
export function fitTrekBox(box: TrekBox, sourceWidth: number, sourceHeight: number, bottom = false): TrekBox | null {
  if (![box.x, box.y, box.w, box.h, sourceWidth, sourceHeight].every(Number.isFinite) || box.w <= 0 || box.h <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const scale = Math.min(box.w / sourceWidth, box.h / sourceHeight), w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) * (bottom ? 1 : 0.5), w, h };
}

/**
 * Paints `rect` of `sheet` contain-fitted into `box`. With `feet`, the silhouette's bottom (not the padded crop's) sits on
 * the box's bottom edge. `mirror` flips only the picture, about its own centre.
 */
function paint(c: CanvasRenderingContext2D, sheet: TrekSheet | 'title', rect: TrekRect, box: TrekBox, o: { feet?: boolean; mirror?: boolean } = {}): boolean {
  const dest = fitTrekBox(box, rect[2], rect[3], o.feet);
  if (!dest) return false;
  const image = ready(sheet);
  if (!image) return false;
  if (o.feet) dest.y += PAD * (dest.h / rect[3]);
  if (!o.mirror) { c.drawImage(image, rect[0], rect[1], rect[2], rect[3], dest.x, dest.y, dest.w, dest.h); return true; }
  c.save();
  c.translate(dest.x + dest.w / 2, 0); c.scale(-1, 1);
  c.drawImage(image, rect[0], rect[1], rect[2], rect[3], -dest.w / 2, dest.y, dest.w, dest.h);
  c.restore();
  return true;
}
const sprite = (c: CanvasRenderingContext2D, s: TrekSprite, box: TrekBox, o: { feet?: boolean; mirror?: boolean } = {}) => paint(c, s.sheet, s.rect, box, o);

/** A foe standing on the bottom of `box`. The paintings face left (−1); facing right mirrors the picture. */
export const paintTrekFoe = (c: CanvasRenderingContext2D, id: FoeId, box: TrekBox, facing: -1 | 1 = -1) => sprite(c, TREK_FOES[id], box, { feet: true, mirror: facing === 1 });
/** The Owl, the Fox, Pip (standing or in the satchel) or the Pedlar's pony, standing on the bottom of `box`, facing left. */
export const paintTrekExtra = (c: CanvasRenderingContext2D, id: 'owl' | 'fox' | 'pip' | 'pipBag' | 'pony', box: TrekBox) => sprite(c, TREK_EXTRAS[id], box, { feet: true });
/** The dizzy stars, centred in `box`. */
export const paintTrekDizzy = (c: CanvasRenderingContext2D, box: TrekBox) => sprite(c, TREK_EXTRAS.dizzy, box);
/** A sign, chest, cart, pond or acorn standing on the bottom of `box`. */
export const paintTrekLandmark = (c: CanvasRenderingContext2D, id: TrekLandmark, box: TrekBox) => sprite(c, TREK_LANDMARKS[id], box, { feet: true });

/** The lucky wheel on the bottom of `box`; once a prize is drawn, the disc turns so that prize's slice is under the pointer. */
export function paintTrekWheel(c: CanvasRenderingContext2D, box: TrekBox, prize?: number): boolean {
  const s = TREK_LANDMARKS.wheel;
  if (!sprite(c, s, box, { feet: true })) return false;
  const angle = prize === undefined ? undefined : TREK_WHEEL.prize[prize];
  if (angle === undefined) return true;
  const dest = fitTrekBox(box, s.rect[2], s.rect[3], true)!, k = dest.w / s.rect[2];
  dest.y += PAD * k;
  const cx = dest.x + (TREK_WHEEL.cx - s.rect[0]) * k, cy = dest.y + (TREK_WHEEL.cy - s.rect[1]) * k;
  c.save();
  // the disc, less the pointer's outline: the pointer painted underneath stays put
  c.beginPath(); c.arc(cx, cy, TREK_WHEEL.r * k, 0, Math.PI * 2);
  // the pointer's outline about its axis, grown by `grow` source px to take in its dark edge
  const pointer = (grow: number) => TREK_WHEEL.pointer.forEach(([x, y], i) => {
    const gx = x + Math.sign(x - 223) * grow, gy = y + (i === 0 ? -grow : i === 2 ? grow : 0);
    const px = dest.x + (gx - s.rect[0]) * k, py = dest.y + (gy - s.rect[1]) * k;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  });
  pointer(2); c.closePath(); c.clip('evenodd');
  c.translate(cx, cy); c.rotate((-angle * Math.PI) / 180); c.translate(-cx, -cy);
  // and the turned copy leaves out its own pointer, so no second tip rides round the rim
  c.save(); c.beginPath(); pointer(6); c.closePath(); c.fillStyle = TREK_WHEEL.under; c.fill(); c.restore();
  c.beginPath(); c.rect(dest.x, dest.y, dest.w, dest.h); pointer(6); c.closePath(); c.clip('evenodd');
  c.drawImage(ready('landmarks')!, s.rect[0], s.rect[1], s.rect[2], s.rect[3], dest.x, dest.y, dest.w, dest.h);
  c.restore();
  return true;
}

/** A skill, evolution, Rest or Reroll badge, contain-fitted and centred in `box`. */
export const paintTrekBadge = (c: CanvasRenderingContext2D, id: TrekBadge, box: TrekBox) => paint(c, 'skills', TREK_BADGES[id], box);
/** A piece of gear: its slot's row, its rarity's column. */
export const paintTrekPiece = (c: CanvasRenderingContext2D, slot: GearSlot, rarity: number, box: TrekBox) => {
  const rect = TREK_GEAR[slot][rarity];
  return rect ? paint(c, 'gear', rect, box) : false;
};
/** The whole 3:2 title frame, so its empty upper quarter stays empty for the page's own title. */
export const paintTrekTitle = (c: CanvasRenderingContext2D, box: TrekBox) => paint(c, 'title', [0, 0, SIZE.w, SIZE.h], box);

/**
 * The chapter's backdrop scrolled `dist` px along a stage `w` × `h`. The paintings are not seamless when repeated, but
 * each one meets its own mirror image exactly, so every odd world tile is drawn mirrored. A tile's parity comes from its
 * place in the world, never from the scroll, so the joins stay put as the path goes by. Tile edges are snapped to whole
 * device pixels so no hairline opens between them.
 */
export function paintTrekBackdrop(c: CanvasRenderingContext2D, chapter: ChapterNo, dist: number, w: number, h: number): boolean {
  const image = Number.isFinite(dist) ? ready(`bg-${chapter}`) : null;
  if (!image) return false;
  const m = c.getTransform(), ax = Math.abs(m.a) || 1, snap = (x: number) => (Math.round(x * ax + m.e) - m.e) / ax;
  const first = Math.floor(dist / w);
  for (let i = first; i <= first + 1; i++) {
    const left = snap(i * w - dist), right = snap((i + 1) * w - dist), mirrored = ((i % 2) + 2) % 2 === 1;
    c.save();
    c.translate(mirrored ? right : left, 0); c.scale(mirrored ? -1 : 1, 1);
    c.drawImage(image, 0, 0, SIZE.w, SIZE.h, 0, 0, right - left, h);
    c.restore();
  }
  return true;
}

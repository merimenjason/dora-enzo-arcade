// Glimmer Cave's painted art: loads the cleaned sheets on demand and paints frames of them. Importing this module on the
// server is safe (no Image, no document, no request). A painter returns false while its sheet is pending or failed, and
// the caller draws the code fallback in that frame; nothing waits for art. The order is the sheet, then the matching pose
// on sprites-0.png (`CAVE_FALLBACK`), then code.
import { BLOCKS, CAVE_FALLBACK, CAVE_FRAMES, CAVE_HASHES, CAVE_SHEETS, CAVE_SIZES, type CaveBlock, type CaveSheet } from './glimmer-cave-crops.js';

export { BLOCKS, CAVE_FALLBACK, CAVE_FRAMES, CAVE_GRIDS, CAVE_HASHES, CAVE_SHEETS, CAVE_SIZES, CRITTER_ANIMS, CRYSTAL, DORA_WIPE, ENZO_SPIN, FX_ANIMS, HERO_ANIMS, ICONS, WYRM_PARTS } from './glimmer-cave-crops.js';
export type { CaveBlock, CaveFrame, CaveFx, CaveIcon, CaveSheet, CritterAnims, HeroAnims, WyrmPart } from './glimmer-cave-crops.js';
/** The camera: `x`, `y` are the world position, in screen px, of the screen's top-left corner; `w` × `h` is the stage. */
export type CaveView = { x: number; y: number; w: number; h: number; tilePx: number };
type Entry = { state: 'pending' | 'ready' | 'failed'; image: HTMLImageElement };

/** The floor painting repeats every this many world tiles each way. */
export const CAVE_FLOOR_TILES = 6;
/** How strongly paintCaveFloor's tint recolours the floor. */
export const CAVE_FLOOR_TINT = 0.35;
const CACHE = 600;
const entries = new Map<CaveSheet, Entry>(), listeners = new Set<() => void>();
const valid = new Set<string>(CAVE_SHEETS);
const cache = new Map<string, HTMLCanvasElement>();
let version = 0;
const notify = () => { version++; listeners.forEach((fn) => fn()); };

/** Subscribe with useSyncExternalStore, so a still canvas repaints when a sheet arrives or a retry lands. */
export const subscribeCaveArt = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const caveArtVersion = () => version;
export const caveArtServerVersion = () => 0;
export const caveArtUrl = (s: CaveSheet) => `/art/cave/${s}.webp?v=${CAVE_HASHES[s]}`;

/** Starts loading these sheets once each. A failed sheet is not asked for again until retryCaveArt. */
export function requestCaveArt(sheets: readonly CaveSheet[]) {
  if (typeof Image === 'undefined') return;
  for (const s of sheets) {
    if (!valid.has(s) || entries.has(s)) continue;
    const image = new Image(), entry: Entry = { state: 'pending', image };
    entries.set(s, entry);
    image.decoding = 'async';
    image.onload = () => {
      if (entries.get(s) !== entry) return;
      // a file of the wrong size would put every crop in the wrong place: treat it as missing
      entry.state = image.naturalWidth === CAVE_SIZES[s].w && image.naturalHeight === CAVE_SIZES[s].h ? 'ready' : 'failed';
      notify();
    };
    image.onerror = () => { if (entries.get(s) === entry) { entry.state = 'failed'; notify(); } };
    image.src = caveArtUrl(s);
    notify();
  }
}

export function caveArtStatus() {
  const ready: CaveSheet[] = [], pending: CaveSheet[] = [], failed: CaveSheet[] = [];
  for (const [s, entry] of entries) (entry.state === 'ready' ? ready : entry.state === 'pending' ? pending : failed).push(s);
  return { ready, pending, failed };
}

/** Asks again for the failed sheets only; a late callback from the failed attempt is ignored. */
export function retryCaveArt() {
  const failed = caveArtStatus().failed;
  for (const s of failed) entries.delete(s);
  requestCaveArt(failed);
}

/** Whether all these sheets have loaded, asking for any not yet asked for. */
export function caveArtReady(sheets: readonly CaveSheet[]) {
  requestCaveArt(sheets);
  return sheets.every((s) => entries.get(s)?.state === 'ready');
}

/** The image for `s` once it has loaded, asking for it on first use. */
function ready(s: CaveSheet) {
  requestCaveArt([s]);
  const entry = entries.get(s);
  return entry?.state === 'ready' ? entry.image : null;
}

/**
 * Frame `key` drawn once to an off-screen canvas, `px` × scale per source px (so its subject is `px` tall, or wide for
 * blocks, props and effects) at `dpr` device px per px, mirrored if the frame's `flip` says so. Cached by key:px:dpr;
 * null until the frame's own sheet is ready, or for an unknown key or a bad size.
 */
export function frameCanvas(key: string, px: number, dpr: number): HTMLCanvasElement | null {
  const frame = CAVE_FRAMES[key];
  if (!frame || !(px > 0) || !(dpr > 0) || !Number.isFinite(px * dpr) || typeof document === 'undefined') return null;
  const id = `${key}:${px}:${dpr}`, hit = cache.get(id);
  if (hit) return hit;
  const image = ready(frame.sheet);
  if (!image) return null;
  const [x, y, w, h] = frame.rect, k = frame.scale * px * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (frame.flip) { c.translate(canvas.width, 0); c.scale(-1, 1); }
  c.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  if (cache.size >= CACHE) cache.delete(cache.keys().next().value!);
  cache.set(id, canvas);
  return canvas;
}

/** The context's device px per px, as the page's transform sets it. */
const dprOf = (c: CanvasRenderingContext2D) => Math.abs(c.getTransform().a) || 1;

/**
 * Frame `key` with its subject `heightPx` tall (blocks, props and effects: wide), its anchor (the feet's middle; an
 * effect's centre) on (x, footY). `mirror` turns it to face left, about the anchor. Paints the sprites-0 pose instead
 * while the frame's own sheet is missing; false while neither is ready.
 */
export function paintCaveFrame(c: CanvasRenderingContext2D, key: string, x: number, footY: number, heightPx: number, mirror = false): boolean {
  if (![x, footY, heightPx].every(Number.isFinite) || heightPx <= 0) return false;
  const dpr = dprOf(c);
  let use = key, canvas = frameCanvas(key, heightPx, dpr);
  if (!canvas && CAVE_FALLBACK[key]) { use = CAVE_FALLBACK[key]; canvas = frameCanvas(use, heightPx, dpr); }
  if (!canvas) return false;
  const frame = CAVE_FRAMES[use], [rx, ry, rw, rh] = frame.rect, k = frame.scale * heightPx;
  // a flipped frame turns about its own anchor, so the anchor's offset from the crop's left edge mirrors with it
  const across = frame.flip ? rx + rw - frame.mid : frame.mid - rx;
  const left = -across * k, top = footY - (frame.foot - ry) * k;
  if (!mirror) { c.drawImage(canvas, x + left, top, rw * k, rh * k); return true; }
  c.save();
  c.translate(x, 0); c.scale(-1, 1);
  c.drawImage(canvas, left, top, rw * k, rh * k);
  c.restore();
  return true;
}

/**
 * Block `block` at dig stage `stage` (0 = whole; clamped to the last painted stage) on the tile whose top-left is
 * (x, y) and side `tilePx`: as wide as the tile, its front face's foot on the tile's bottom edge, so its top face rises
 * above the tile as the camera sees it.
 */
export function paintCaveBlock(c: CanvasRenderingContext2D, block: CaveBlock, stage: number, x: number, y: number, tilePx: number): boolean {
  const stages = BLOCKS[block];
  if (!stages || !Number.isFinite(stage) || !Number.isFinite(tilePx) || tilePx <= 0) return false;
  const key = stages[Math.min(stages.length - 1, Math.max(0, Math.floor(stage)))];
  return paintCaveFrame(c, key, x + tilePx / 2, y + tilePx, tilePx);
}

/**
 * The floor under `view`, the painting repeated every CAVE_FLOOR_TILES world tiles and fixed to the world, so it scrolls
 * with the camera. Tile edges are snapped to whole device pixels so no hairline opens between them. `tint`, a CSS colour
 * such as the layer's TINT, recolours it while keeping the painting's light and shade.
 */
export function paintCaveFloor(c: CanvasRenderingContext2D, view: CaveView, tint?: string): boolean {
  const { x, y, w, h, tilePx } = view;
  if (![x, y, w, h, tilePx].every(Number.isFinite) || w <= 0 || h <= 0 || tilePx <= 0) return false;
  const image = ready('floor');
  if (!image) return false;
  const m = c.getTransform(), ax = Math.abs(m.a) || 1, ay = Math.abs(m.d) || 1;
  const snapX = (v: number) => (Math.round(v * ax + m.e) - m.e) / ax, snapY = (v: number) => (Math.round(v * ay + m.f) - m.f) / ay;
  const period = CAVE_FLOOR_TILES * tilePx, { w: sw, h: sh } = CAVE_SIZES.floor;
  const i0 = Math.floor(x / period), j0 = Math.floor(y / period), i1 = Math.floor((x + w) / period), j1 = Math.floor((y + h) / period);
  for (let j = j0; j <= j1; j++) {
    const top = snapY(j * period - y), bottom = snapY((j + 1) * period - y);
    for (let i = i0; i <= i1; i++) {
      const left = snapX(i * period - x), right = snapX((i + 1) * period - x);
      c.drawImage(image, 0, 0, sw, sh, left, top, right - left, bottom - top);
    }
  }
  if (tint) {
    c.save();
    c.globalCompositeOperation = 'color'; c.globalAlpha = CAVE_FLOOR_TINT; c.fillStyle = tint;
    c.fillRect(0, 0, w, h);
    c.restore();
  }
  return true;
}

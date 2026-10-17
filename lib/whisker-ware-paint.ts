import { WARE_ASSETS, WARE_CROPS, WARE_HASHES, WARE_PROPS, type WareAsset, type WareBackdrop, type WareHost, type WareRect, type WareSpriteSheet } from './whisker-ware-crops';

export { WARE_ASSETS, WARE_CROPS, WARE_PROPS, WARE_SURFACES } from './whisker-ware-crops';
export type { WareAsset, WareBackdrop, WareHost, WareRect, WareSpriteSheet } from './whisker-ware-crops';
export type WareBox = { x: number; y: number; w: number; h: number };
export type WareMood = 'presenting' | 'cheering' | 'oops';
type Entry = { state: 'pending' | 'ready' | 'failed'; image: HTMLImageElement };
const entries = new Map<WareAsset, Entry>(), listeners = new Set<() => void>();
const valid = new Set<string>(WARE_ASSETS);
const hosts: WareHost[] = ['enzo', 'dora', 'owl', 'fox'];
const games = ['stuff', 'catch', 'sort', 'sniff', 'gnaw', 'raisin', 'dust', 'balance', 'fluff', 'hop', 'comb', 'shelf', 'sneak', 'hide', 'hush', 'find', 'dodge', 'moon', 'pick', 'pop', 'aim', 'stack', 'count', 'ring'];
let version = 0;
const notify = () => { version++; listeners.forEach(fn => fn()); };

/** Subscribe with useSyncExternalStore, or redraw a static canvas on image arrival/retry. */
export const subscribeWareArt = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const wareArtVersion = () => version;
export const wareArtServerVersion = () => 0;
export const wareArtUrl = (key: WareAsset) => `/art/whisker-ware/${key}.png?v=${WARE_HASHES[key]}`;

/** Nonblocking and idempotent; failures wait for an explicit retry instead of retrying each frame. */
export function requestWareArt(keys: readonly WareAsset[]) {
  if (typeof Image === 'undefined') return;
  for (const key of keys) {
    if (!valid.has(key) || entries.has(key)) continue;
    const image = new Image(), entry: Entry = { state: 'pending', image };
    entries.set(key, entry);
    image.decoding = 'async';
    image.onload = () => {
      if (entries.get(key) !== entry) return;
      entry.state = image.naturalWidth === 1536 && image.naturalHeight === 1024 ? 'ready' : 'failed';
      notify();
    };
    image.onerror = () => { if (entries.get(key) === entry) { entry.state = 'failed'; notify(); } };
    image.src = wareArtUrl(key);
    notify();
  }
}

export function wareArtStatus() {
  const ready: WareAsset[] = [], pending: WareAsset[] = [], failed: WareAsset[] = [];
  for (const [key, entry] of entries) (entry.state === 'ready' ? ready : entry.state === 'pending' ? pending : failed).push(key);
  return { ready, pending, failed };
}

export function retryWareArt() {
  const failed = wareArtStatus().failed;
  for (const key of failed) entries.delete(key);
  requestWareArt(failed);
}

export const prefetchWareMenu = () => requestWareArt(['hosts', 'title']);
export const prefetchWareHost = (host: WareHost) => requestWareArt(['hosts', `props-${host}`, `room-${host}`]);
/** Call when the next microgame is selected, during the break, not after its fuse starts. */
export function prefetchWareGame(id: string) {
  const index = games.indexOf(id);
  if (index < 0) return;
  prefetchWareHost(hosts[Math.floor(index / 6)]);
  requestWareArt([`bg-${id}` as WareBackdrop]);
}

/** Destination rectangle for a contain fit. Reuse it for any source-pixel anchors/hit targets. */
export function fitWareBox(box: WareBox, sourceWidth: number, sourceHeight: number, bottom = false): WareBox | null {
  if (![box.x, box.y, box.w, box.h, sourceWidth, sourceHeight].every(Number.isFinite) || box.w <= 0 || box.h <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const scale = Math.min(box.w / sourceWidth, box.h / sourceHeight), w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) * (bottom ? 1 : .5), w, h };
}

function paint(c: CanvasRenderingContext2D, key: WareAsset, rect: WareRect, box: WareBox, bottom = false): boolean {
  const dest = fitWareBox(box, rect[2], rect[3], bottom);
  if (!dest) return false;
  requestWareArt([key]);
  const entry = entries.get(key);
  if (entry?.state !== 'ready') return false;
  c.drawImage(entry.image, ...rect, dest.x, dest.y, dest.w, dest.h);
  return true;
}

/** False means draw the existing code fallback now; no timer or promise blocks play. */
export function paintWareSprite(c: CanvasRenderingContext2D, sheet: WareSpriteSheet, index: number, box: WareBox): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= 12) return false;
  const rect = WARE_CROPS[sheet]?.[index];
  return rect ? paint(c, sheet, rect, box, true) : false;
}

export function paintWareHost(c: CanvasRenderingContext2D, host: WareHost, mood: WareMood, box: WareBox): boolean {
  const col = hosts.indexOf(host), row = ['presenting', 'cheering', 'oops'].indexOf(mood);
  return col >= 0 && row >= 0 ? paintWareSprite(c, 'hosts', row * 4 + col, box) : false;
}

export function paintWareProp<H extends WareHost>(c: CanvasRenderingContext2D, host: H, prop: (typeof WARE_PROPS)[H][number], box: WareBox): boolean {
  const index = (WARE_PROPS[host] as readonly string[] | undefined)?.indexOf(prop) ?? -1;
  return index >= 0 ? paintWareSprite(c, `props-${host}`, index, box) : false;
}

/** Full source frame: keeps the title's empty text band and the environment's 3:2 geometry. */
export const paintWareTitle = (c: CanvasRenderingContext2D, box: WareBox) => paint(c, 'title', [0, 0, 1536, 1024], box);
export const paintWareBackdrop = (c: CanvasRenderingContext2D, key: WareBackdrop, box: WareBox) => paint(c, key, [0, 0, 1536, 1024], box);

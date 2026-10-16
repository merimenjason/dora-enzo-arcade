// Painting is optional: slow or unavailable images leave the playable canvas fallback intact.
import { ACORN_CROPS } from './acorn-hand-crops';
const images = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
const requested = new Set<string>();
const listeners = new Set<() => void>();
let revision = 0;
export const acornPaintVersion = () => revision;
export const subscribeAcornPainting = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const acornArtStatus = () => ({ loaded: [...images.keys()], failed: [...failed], pending: [...requested].filter((key) => !images.has(key) && !failed.has(key)) });
export function retryAcornPainting() { const keys = [...failed]; failed.clear(); keys.forEach((key) => { requested.delete(key); loadAcornPainting(key); }); revision++; listeners.forEach((fn) => fn()); }
export function loadAcornPainting(key: string) {
  if (typeof Image === 'undefined' || requested.has(key)) return;
  requested.add(key);
  const image = new Image();
  image.onload = () => { images.set(key, image); revision++; listeners.forEach((fn) => fn()); };
  image.onerror = () => { failed.add(key); revision++; listeners.forEach((fn) => fn()); };
  image.src = `/art/acorn-hand/${key}.png?v=suits-poses-2`;
}
/** CSS that shows one painted cell as an element's background, stretched to the element, or null until the sheet has loaded. */
export function acornSprite(key: string, cell: number): { backgroundImage: string; backgroundSize: string; backgroundPosition: string; backgroundRepeat: string } | null {
  loadAcornPainting(key);
  const image = images.get(key), crop = ACORN_CROPS[key]?.[cell];
  if (!image || !crop) return null;
  const [sx, sy, sw, sh] = crop, W = image.naturalWidth, H = image.naturalHeight;
  return { backgroundImage: `url("${image.src}")`, backgroundSize: `${(W / sw) * 100}% ${(H / sh) * 100}%`, backgroundPosition: `${(sx / (W - sw)) * 100}% ${(sy / (H - sh)) * 100}%`, backgroundRepeat: 'no-repeat' };
}
/** Contain the complete measured silhouette, never stretching or cutting off ears and props. */
export function paintAcorn(c: CanvasRenderingContext2D, key: string, cell: number, x: number, y: number, w: number, h: number) {
  loadAcornPainting(key);
  const image = images.get(key), crop = ACORN_CROPS[key]?.[cell];
  if (!image || !crop) return false;
  const [sx, sy, sw, sh] = crop, scale = Math.min(w / sw, h / sh);
  c.drawImage(image, sx, sy, sw, sh, x + (w - sw * scale) / 2, y + (h - sh * scale) / 2, sw * scale, sh * scale);
  return true;
}

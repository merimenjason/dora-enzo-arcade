/** Painted atlas assets. The game state remains the sole source of tiles, staffing and light. */
type Sheet = 'terrain' | 'buildings' | 'characters';
const grids: Record<Sheet, [number, number]> = { terrain: [3, 2], buildings: [4, 4], characters: [4, 3] };
const sheets = new Map<Sheet, HTMLImageElement>();
const cells = new Map<string, HTMLCanvasElement>();
let pending: Promise<void> | null = null;
export function loadFrontierArt(): Promise<void> {
  if (pending) return pending;
  pending = Promise.all((Object.keys(grids) as Sheet[]).map(key => new Promise<void>((resolve, reject) => {
    if (sheets.has(key)) { resolve(); return; }
    const image = new Image();
    image.onload = () => { sheets.set(key, image); resolve(); };
    image.onerror = () => reject(new Error(`Could not load ${key} artwork`));
    image.src = `/art/frontier/${key}.png`;
  }))).then(() => undefined).catch(error => { pending = null; throw error; });
  return pending;
}
export function frontierArtReady() { return sheets.size === 3; }
function cell(sheet: Sheet, index: number): HTMLCanvasElement | null {
  const key = `${sheet}:${index}`, existing = cells.get(key);
  if (existing) return existing;
  const image = sheets.get(sheet); if (!image) return null;
  const [cols, rows] = grids[sheet], w = Math.floor(image.naturalWidth / cols);
  // The painted building rows have different heights; cuts follow their transparent gutters.
  const cuts = sheet === 'buildings' ? [0, 268, 544, 786, 1024].map(y => Math.round(y / 1024 * image.naturalHeight)) : Array.from({ length: rows + 1 }, (_, i) => Math.floor(i * image.naturalHeight / rows));
  const row = Math.floor(index / cols), sy = cuts[row], h = cuts[row + 1] - sy;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, index % cols * w, sy, w, h, 0, 0, w, h);
  if (sheet === 'terrain') { cells.set(key, canvas); return canvas; }
  // Trim alpha margins once per sprite, so portraits and tiny tool icons stay legible.
  const data = context.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x0 >= x1 || y0 >= y1) return null;
  const trimmed = document.createElement('canvas'); trimmed.width = x1 - x0 + 1; trimmed.height = y1 - y0 + 1;
  trimmed.getContext('2d')!.drawImage(canvas, x0, y0, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  cells.set(key, trimmed); return trimmed;
}
export function painted(c: CanvasRenderingContext2D, sheet: Sheet, index: number, x: number, y: number, w: number, h: number, stretch = false) {
  const image = cell(sheet, index); if (!image) return false;
  const k = Math.min(w / image.width, h / image.height), dw = stretch ? w : image.width * k, dh = stretch ? h : image.height * k;
  c.drawImage(image, x + (w - dw) / 2, y + h - dh, dw, dh); return true;
}
export const BUILDING_ART = { farm: 0, lodge: 1, nest: 2, quarry: 3, lantern: 4, tower: 5, beacon: 6 };
export const HERO_ART = { dora: 0, enzo: 1, pebble: 2, kiki: 3, luna: 4 };
export const BEAST_ART = { weasel: 7, fox: 8, owl: 9, badger: 10, cougar: 11 };

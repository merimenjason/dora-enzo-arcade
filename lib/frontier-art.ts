/** Painted atlas assets. The game state remains the sole source of tiles, staffing and light. */
type Sheet = 'terrain' | 'buildings' | 'characters' | 'motion' | 'workers';
const grids: Record<Sheet, [number, number]> = { terrain: [3, 2], buildings: [4, 4], characters: [4, 3], motion: [4, 4], workers: [4, 6] };
const sheets = new Map<Sheet, HTMLImageElement>();
const cells = new Map<string, HTMLCanvasElement>();
const motionBounds = new Map<string, [number, number, number, number]>();
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
export function frontierArtReady() { return sheets.size === 5; }
function cell(sheet: Sheet, index: number): HTMLCanvasElement | null {
  const key = `${sheet}:${index}`, existing = cells.get(key);
  if (existing) return existing;
  const image = sheets.get(sheet); if (!image) return null;
  const [cols, rows] = grids[sheet], w = Math.floor(image.naturalWidth / cols);
  // The painted building rows have different heights; cuts follow their transparent gutters.
  const cuts = sheet === 'buildings' ? [0, 268, 544, 786, 1024].map(y => Math.round(y / 1024 * image.naturalHeight)) : sheet === 'motion' ? [0, 274, 537, 800, 1086].map(y => Math.round(y / 1086 * image.naturalHeight)) : sheet === 'workers' ? [0, 295, 519, 752, 981, 1215, 1536].map(y => Math.round(y / 1536 * image.naturalHeight)) : Array.from({ length: rows + 1 }, (_, i) => Math.floor(i * image.naturalHeight / rows));
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
  if (sheet === 'motion' || sheet === 'workers') {
    const rowKey = `${sheet}:${row}`; let bounds = motionBounds.get(rowKey);
    if (!bounds) {
      const strip = document.createElement('canvas'); strip.width = image.naturalWidth; strip.height = h;
      const ctx = strip.getContext('2d')!; ctx.drawImage(image, 0, sy, strip.width, h, 0, 0, strip.width, h);
      const rgba = ctx.getImageData(0, 0, strip.width, h).data; let a = w, b = h, d = 0, e = 0;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < strip.width; xx++) if (rgba[(yy * strip.width + xx) * 4 + 3] > 24) { a = Math.min(a, xx % w); d = Math.max(d, xx % w); b = Math.min(b, yy); e = Math.max(e, yy); }
      bounds = [a,b,d,e]; motionBounds.set(rowKey, bounds);
    }
    [x0,y0,x1,y1] = bounds; // shared crop keeps scale and foot placement stable throughout a walk cycle.
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
const transitions = new Map<string, HTMLCanvasElement>();
/** Prebaked feathered texture strips soften terrain seams without blurring buildings or hit targets. */
export function terrainTransition(c: CanvasRenderingContext2D, index: number, edge: number, x: number, y: number, size: number) {
  const source = cell('terrain', index); if (!source) return;
  const key = `${index}:${edge}`; let image = transitions.get(key);
  if (!image) {
    image = document.createElement('canvas'); image.width = image.height = 128;
    const context = image.getContext('2d')!; context.drawImage(source, 0, 0, 128, 128);
    context.globalCompositeOperation = 'destination-in';
    const starts = [[0, 64, 24, 64], [128, 64, 104, 64], [64, 0, 64, 24], [64, 128, 64, 104]][edge];
    const mask = context.createLinearGradient(...starts as [number, number, number, number]); mask.addColorStop(0, 'rgba(0,0,0,.6)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = mask; context.fillRect(0, 0, 128, 128); transitions.set(key, image);
  }
  c.drawImage(image, x, y, size, size);
}

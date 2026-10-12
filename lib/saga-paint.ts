import { SAGA_CROPS } from './saga-crops';
/** Painted artwork stays independent of the battle and save format. */
const grids: Record<string, [number, number]> = {
  'hero-dora': [1, 1],
  enemies: [3, 2],
  'bosses-0': [2, 2],
};
for (let i = 0; i < 3; i++) {
  grids['heroes-' + i] = [3, 2];
  grids['portraits-' + i] = [3, 2];
}
for (let i = 4; i < 8; i++) grids['boss-' + i] = [1, 1];
for (let i = 0; i < 8; i++) grids['land-' + i] = [1, 1];
const images = new Map<string, HTMLImageElement>(),
  cells = new Map<string, HTMLCanvasElement>();
let pending: Promise<void> | null = null,
  revision = 0;
export const sagaPaintVersion = () => revision;
export const sagaPaintReady = () => images.size === Object.keys(grids).length;
export function loadSagaPainting(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  if (pending) return pending;
  pending = Promise.allSettled(
    Object.keys(grids).map(
      (key) =>
        new Promise<void>((resolve, reject) => {
          if (images.has(key)) {
            resolve();
            return;
          }
          const image = new Image();
          image.onload = () => {
            images.set(key, image);
            revision++;
            resolve();
          };
          image.onerror = () => reject(new Error('Could not load ' + key));
          image.src = '/art/saga/' + key + '.png';
        }),
    ),
  )
    .then((results) => {
      if (results.some((r) => r.status === 'rejected'))
        throw new Error('Some Saga artwork could not load');
      for (const [key, [cols, rows]] of Object.entries(grids))
        if (!key.startsWith('land-'))
          for (let i = 0; i < cols * rows; i++) cell(key, i);
    })
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}
function cell(key: string, index: number) {
  const id = key + ':' + index;
  if (cells.has(id)) return cells.get(id)!;
  const image = images.get(key);
  if (!image) return null;
  const [cols, rows] = grids[key],
    fw = Math.floor(image.width / cols),
    fh = Math.floor(image.height / rows),
    raw = SAGA_CROPS[key]?.[index] ?? [
      (index % cols) * fw,
      Math.floor(index / cols) * fh,
      fw,
      fh,
    ];
  const sx = Math.max(0, raw[0] - 24),
    sy = Math.max(0, raw[1] - 24),
    w = Math.min(image.width, raw[0] + raw[2] + 24) - sx,
    h = Math.min(image.height, raw[1] + raw[3] + 24) - sy;
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const c = scratch.getContext('2d')!;
  c.drawImage(image, sx, sy, w, h, 0, 0, w, h);
  const data = c.getImageData(0, 0, w, h),
    p = data.data,
    seen = new Uint8Array(w * h);
  let biggest: number[] = [];
  // Isolate the complete connected character rather than a neighbouring atlas fragment.
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || p[start * 4 + 3] <= 3) continue;
    const q = [start];
    seen[start] = 1;
    for (let k = 0; k < q.length; k++) {
      const n = q[k],
        x = n % w,
        y = Math.floor(n / w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const m = yy * w + xx;
          if (!seen[m] && p[m * 4 + 3] > 3) {
            seen[m] = 1;
            q.push(m);
          }
        }
    }
    if (q.length > biggest.length) biggest = q;
  }
  const keep = new Uint8Array(w * h);
  for (const n of biggest) keep[n] = 1;
  let x0 = w,
    y0 = h,
    x1 = 0,
    y1 = 0;
  for (let n = 0; n < w * h; n++) {
    if (!keep[n]) p[n * 4 + 3] = 0;
    else if (p[n * 4 + 3] > 8) {
      const x = n % w,
        y = Math.floor(n / w);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  c.putImageData(data, 0, 0);
  if (x0 > x1 || y0 > y1) return null;
  const cut = document.createElement('canvas');
  cut.width = x1 - x0 + 7;
  cut.height = y1 - y0 + 7;
  cut
    .getContext('2d')!
    .drawImage(
      scratch,
      x0,
      y0,
      x1 - x0 + 1,
      y1 - y0 + 1,
      3,
      3,
      x1 - x0 + 1,
      y1 - y0 + 1,
    );
  cells.set(id, cut);
  return cut;
}
export function sagaFigure(
  c: CanvasRenderingContext2D,
  key: string,
  index: number,
  x: number,
  feet: number,
  height: number,
  face: 1 | -1 = 1,
  lean = 0,
  bob = 0,
) {
  const image = cell(key, index);
  if (!image) return false;
  const scale = height / image.height;
  c.save();
  c.translate(x, feet - bob);
  c.scale(face, 1);
  c.rotate(lean);
  c.drawImage(
    image,
    (-image.width * scale) / 2,
    -height,
    image.width * scale,
    height,
  );
  c.restore();
  return true;
}
export function sagaPortrait(
  c: CanvasRenderingContext2D,
  index: number,
  size: number,
) {
  const image = cell('portraits-' + Math.floor(index / 6), index % 6);
  if (!image) return false;
  const scale = Math.min((size - 8) / image.width, (size - 8) / image.height),
    w = image.width * scale,
    h = image.height * scale;
  c.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  return true;
}
/** Reflecting the panoramic tile keeps joins continuous while the road scrolls with the squad. */
export function sagaLandscape(
  c: CanvasRenderingContext2D,
  chapter: number,
  w: number,
  h: number,
  scroll: number,
) {
  const image = images.get('land-' + chapter);
  if (!image) return false;
  const tileW = Math.max(w, (image.width / image.height) * h),
    shift = scroll * 0.3,
    first = Math.floor(shift / tileW);
  for (let i = first; i * tileW - shift < w; i++) {
    c.save();
    c.translate(i * tileW - shift, 0);
    if (Math.abs(i) % 2 === 1) {
      c.translate(tileW, 0);
      c.scale(-1, 1);
    }
    c.drawImage(image, 0, 0, tileW, h);
    c.restore();
  }
  return true;
}
/** Read-only crop diagnostics, invoked by browser QA. */
export function sagaPaintStats() {
  return Object.entries(grids)
    .filter(([key]) => !key.startsWith('land-'))
    .flatMap(([key, [cols, rows]]) =>
      Array.from({ length: cols * rows }, (_, i) => i)
        .filter((i) => key !== 'heroes-0' || i !== 0)
        .map((i) => {
          const image = cell(key, i);
          if (!image) return { name: key + ':' + i, loaded: false };
          const p = image
            .getContext('2d')!
            .getImageData(0, 0, image.width, image.height).data;
          let edge = false,
            pixels = 0;
          for (let y = 0; y < image.height; y++)
            for (let x = 0; x < image.width; x++)
              if (p[(y * image.width + x) * 4 + 3] > 8) {
                pixels++;
                if (
                  x === 0 ||
                  y === 0 ||
                  x === image.width - 1 ||
                  y === image.height - 1
                )
                  edge = true;
              }
          return {
            name: key + ':' + i,
            loaded: true,
            width: image.width,
            height: image.height,
            edge,
            pixels,
          };
        }),
    );
}

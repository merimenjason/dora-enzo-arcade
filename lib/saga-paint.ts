import { SAGA_CROPS } from './saga-crops';
import { SAGA_RIG_CROPS } from './saga-rig-crops';
/** Painted artwork stays independent of the battle and save format. */
const grids: Record<string, [number, number]> = {
  'hero-dora': [1, 1],
  'rig-dora': [4, 2],
  'rig-enzo': [4, 2],
  'rig-beetle': [4, 2],
  effects: [3, 2],
  rewards: [2, 2],
  equipment: [2, 2],
  'equipment-ascendant':[2,2],
  'heroes-3':[2,2],
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
const requests = new Map<string, Promise<void>>(),
  requested = new Set<string>(),
  failed = new Set<string>(),
  listeners = new Set<() => void>();
let revision = 0;
const notify = () => {
  for (const listener of listeners) listener();
};
export const sagaPaintVersion = () => revision;
export const sagaPaintReady = () =>
  requested.size > 0 && [...requested].every((key) => images.has(key));
export const sagaPaintError = () => failed.size > 0;
export const sagaAssetStatus = () => ({
  requested: [...requested],
  loaded: [...images.keys()],
  failed: [...failed],
});
export function subscribeSagaPainting(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function request(key: string): Promise<void> {
  if (images.has(key)) return Promise.resolve();
  const existing = requests.get(key);
  if (existing) return existing;
  requested.add(key);
  failed.delete(key);
  const pending = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      images.set(key, image);
      requests.delete(key);
      revision++;
      notify();
      resolve();
    };
    image.onerror = () => {
      requests.delete(key);
      failed.add(key);
      notify();
      reject(new Error('Could not load ' + key));
    };
    image.src = '/art/saga/' + key + '.png' + (key.startsWith('rig-') ? '?v=stable-rig-1' : key === 'rewards' ? '?v=reward-crops-2' : '');
  });
  requests.set(key, pending);
  notify();
  return pending;
}
function demand(key: string) {
  if (
    typeof Image !== 'undefined' &&
    !images.has(key) &&
    !requests.has(key) &&
    !failed.has(key)
  )
    void request(key).catch(() => undefined);
}
/** Load only the requested group. Other sheets are fetched on demand by the renderer. */
export function loadSagaPainting(
  keys: readonly string[] = Object.keys(grids),
): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.allSettled(
    keys.filter((key) => key in grids).map(request),
  ).then((results) => {
    if (results.some((r) => r.status === 'rejected'))
      throw new Error('Some Saga artwork could not load');
  });
}
export const retrySagaPainting = () => loadSagaPainting([...requested]);
function cell(key: string, index: number) {
  const id = key + ':' + index;
  if (cells.has(id)) return cells.get(id)!;
  const image = images.get(key);
  if (!image) {
    demand(key);
    return null;
  }
  const [cols, rows] = grids[key],
    fw = Math.floor(image.width / cols),
    fh = Math.floor(image.height / rows),
    raw = SAGA_RIG_CROPS[key]?.[index] ?? SAGA_CROPS[key]?.[index] ?? [
      (index % cols) * fw,
      Math.floor(index / cols) * fh,
      fw,
      fh,
    ];
  const pad = key==='heroes-3'?0:key.startsWith('rig-') ? 6 : key === 'effects' || key === 'rewards' || key.startsWith('equipment') ? 0 : 24;
  const sx = Math.max(0, raw[0] - pad),
    sy = Math.max(0, raw[1] - pad),
    w = Math.min(image.width, raw[0] + raw[2] + pad) - sx,
    h = Math.min(image.height, raw[1] + raw[3] + pad) - sy;
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const c = scratch.getContext('2d')!;
  c.drawImage(image, sx, sy, w, h, 0, 0, w, h);
  if (key === 'effects' || key === 'rewards' || key === 'equipment') {
    cells.set(id, scratch);
    return scratch;
  }
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
  breath = 0,
) {
  const image = cell(key, index);
  if (!image) return false;
  const scale = height / image.height;
  c.save();
  c.translate(x, feet - bob);
  // Breathing changes the silhouette subtly around planted feet rather than lifting it.
  c.scale(face * (1 - breath * .002), 1 + breath * .004);
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
  const image = index>=18?cell('heroes-3',index-18+2):cell('portraits-' + Math.floor(index / 6), index % 6);
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
  if (!image) {
    demand('land-' + chapter);
    return false;
  }
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
    .filter(
      ([key]) =>
        !key.startsWith('land-') && !key.startsWith('rig-') && key !== 'effects' && key !== 'rewards' && !key.startsWith('equipment'),
    )
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

/** Decorative textures preserve disconnected sparks, coins and crystal shards. */
export function sagaDecoration(
  c: CanvasRenderingContext2D,
  key: 'effects' | 'rewards' | 'equipment' | 'equipment-ascendant',
  index: number,
  x: number,
  y: number,
  w: number,
  h = w,
) {
  const image = cell(key, index);
  if (!image) return false;
  const scale = Math.min(w / image.width, h / image.height);
  c.drawImage(
    image,
    x - (image.width * scale) / 2,
    y - (image.height * scale) / 2,
    image.width * scale,
    image.height * scale,
  );
  return true;
}
export function sagaDecorationStats() {
  return ['effects', 'rewards', 'equipment', 'equipment-ascendant'].flatMap((key) =>
    Array.from({ length: key === 'effects' ? 6 : 4 }, (_, i) => {
      const image = cell(key, i);
      if (!image) return { name: key + ':' + i, loaded: false };
      const p = image
        .getContext('2d')!
        .getImageData(0, 0, image.width, image.height).data;
      let pixels = 0,
        edge = false;
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
      return { name: key + ':' + i, loaded: true, pixels, edge, width: image.width, height: image.height };
    }),
  );
}

/** Cached painted part, with its joint kept at the requested attachment point. */
export function sagaRigPart(c:CanvasRenderingContext2D,key:string,index:number,x:number,y:number,w:number,h:number,angle=0,px=.5,py=.5){
  const image=cell(key,index);if(!image)return false;
  const scale=Math.min(w/image.width,h/image.height),width=image.width*scale,height=image.height*scale;
  c.save();c.translate(x,y);c.rotate(angle);c.drawImage(image,-width*px,-height*py,width,height);c.restore();return true;
}
export function sagaRigReady(key:string){if(!images.has(key)){demand(key);return false;}return true;}
export function sagaRigStats(){
 return ['rig-dora','rig-enzo','rig-beetle'].flatMap(key=>Array.from({length:8},(_,index)=>{
  const image=cell(key,index);if(!image)return {name:key+':'+index,loaded:false};
  const p=image.getContext('2d')!.getImageData(0,0,image.width,image.height).data;
  let pixels=0,edge=false;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(p[(y*image.width+x)*4+3]>8){pixels++;if(x===0||y===0||x===image.width-1||y===image.height-1)edge=true;}
  return {name:key+':'+index,loaded:true,pixels,edge,width:image.width,height:image.height};
 }));
}

/** A local attachment vector in the same fitted part geometry used for painting. */
export function sagaRigVector(key:string,index:number,w:number,h:number,fromX:number,fromY:number,toX:number,toY:number){
 const image=cell(key,index);if(!image)return {x:0,y:0};
 const scale=Math.min(w/image.width,h/image.height);
 return {x:(toX-fromX)*image.width*scale,y:(toY-fromY)*image.height*scale};
}
/** A fixed hip-to-ankle segment and a rigid horizontal sole, with no elastic strip mesh. */
export function sagaRigLeg(c:CanvasRenderingContext2D,key:string,index:number,x:number,y:number,w:number,h:number,dx:number,dy:number){
 const image=cell(key,index);if(!image)return false;
 const scale=Math.min(w/image.width,h/image.height),width=image.width*scale,height=image.height*scale;
 const cut=.72,upper=height*cut,sy=image.height*cut,left=x-width*.55,top=y-height*.96;
 // One small affine bend connects the fixed hip to the ankle. The paw itself never shears or rotates.
 c.save();c.transform(1,0,dx/upper,(upper+dy)/upper,left,top);
 c.drawImage(image,0,0,image.width,sy,0,0,width,upper);c.restore();
 c.drawImage(image,0,sy,image.width,image.height-sy,left+dx,top+upper+dy,width,height-upper);
 return true;
}

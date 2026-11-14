// Jade Street: finding the way. Breadth-first flow fields over the tile grid for each way of moving (on foot, small
// rides, big rides, boats), line of sight for wardens and lookouts, and simplified paths for the route arrow, the
// chase targets and the bots. Locked districts are walls until their chapter opens.
import { W, H, T, passable, districtAt, S, type City, type MoveClass, type District } from './jade-city.js';

export type Field = { dist: Int32Array; tx: number; ty: number; cls: MoveClass };
const N8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** can a mover of this class step onto (tx,ty) for routing (foot may hop one low prop) */
export function navOk(c: City, cls: MoveClass, tx: number, ty: number, open: Set<District>) {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
  if (!open.has(districtAt(tx, ty))) return false;
  if (cls === 'foot' && c.solid[ty * W + tx] === S.LOW) return true;
  return passable(c, cls, tx, ty);
}

/** distances (in tile steps ×10, diagonals 14) from every tile to the goal tile */
export function field(c: City, cls: MoveClass, tx: number, ty: number, open: Set<District>): Field {
  const dist = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H * 2); let qh = 0, qt = 0;
  // Dijkstra-lite: two-bucket queue is enough for 10/14 costs at this size; a plain heap keeps it exact
  const heap: number[] = [];
  const push = (i: number, d: number) => { heap.push(d * 65536 + i); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p] <= heap[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l] < heap[m]) m = l; if (r < heap.length && heap[r] < heap[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  void q; void qh; void qt;
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return { dist, tx, ty, cls };
  dist[ty * W + tx] = 0; push(ty * W + tx, 0);
  while (heap.length) {
    const v = pop(); const i = v % 65536, d = Math.floor(v / 65536);
    if (d > dist[i]) continue;
    const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!navOk(c, cls, nx, ny, open)) continue;
      if (dx && dy && (!navOk(c, cls, x + dx, y, open) || !navOk(c, cls, x, y + dy, open))) continue;
      const j = ny * W + nx, nd = d + (dx && dy ? 14 : 10) + (cls === 'foot' && c.solid[j] === S.LOW ? 20 : 0);
      if (dist[j] === -1 || nd < dist[j]) { dist[j] = nd; push(j, nd); }
    }
  }
  return { dist, tx, ty, cls };
}

/** the best neighbouring tile centre to head for from world (x,y), or null if unreachable */
export function downhill(c: City, f: Field, x: number, y: number, open: Set<District>): [number, number] | null {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (tx === f.tx && ty === f.ty) return [f.tx * T + T / 2, f.ty * T + T / 2];
  const here = tx >= 0 && ty >= 0 && tx < W && ty < H ? f.dist[ty * W + tx] : -1;
  let best = -1, bx = 0, by = 0;
  for (const [dx, dy] of N8) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const d = f.dist[ny * W + nx];
    if (d < 0) continue;
    if (dx && dy && (!navOk(c, f.cls, tx + dx, ty, open) || !navOk(c, f.cls, tx, ty + dy, open))) continue;
    if (best < 0 || d < best) { best = d; bx = nx; by = ny; }
  }
  if (best < 0 || (here >= 0 && best >= here && here !== -1 && false)) return null;
  return [bx * T + T / 2, by * T + T / 2];
}

/** a path of tile centres from (x,y) to the field's goal, simplified to the corners */
export function pathFrom(c: City, f: Field, x: number, y: number, open: Set<District>, max = 400): [number, number][] {
  let tx = Math.floor(x / T), ty = Math.floor(y / T);
  const out: [number, number][] = [];
  if (tx < 0 || ty < 0 || tx >= W || ty >= H || f.dist[ty * W + tx] < 0) {
    // start is off the field (inside a prop): step to the nearest tile that is on it
    let bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const d = f.dist[ny * W + nx]; if (d >= 0 && d < bd) { bd = d; tx = nx; ty = ny; } }
    if (bd === 1e9) return out;
  }
  for (let k = 0; k < max; k++) {
    out.push([tx * T + T / 2, ty * T + T / 2]);
    if (tx === f.tx && ty === f.ty) break;
    const cur = f.dist[ty * W + tx];
    let best = cur, bx = tx, by = ty;
    for (const [dx, dy] of N8) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const d = f.dist[ny * W + nx];
      if (d < 0 || d >= best) continue;
      if (dx && dy && (!navOk(c, f.cls, tx + dx, ty, open) || !navOk(c, f.cls, tx, ty + dy, open))) continue;
      best = d; bx = nx; by = ny;
    }
    if (bx === tx && by === ty) break;
    tx = bx; ty = by;
  }
  return simplify(out);
}
function simplify(p: [number, number][]) {
  if (p.length < 3) return p;
  const out: [number, number][] = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = out[out.length - 1], [bx, by] = p[i], [cx, cy] = p[i + 1];
    const d1x = Math.sign(bx - ax), d1y = Math.sign(by - ay), d2x = Math.sign(cx - bx), d2y = Math.sign(cy - by);
    if (d1x !== d2x || d1y !== d2y) out.push(p[i]);
  }
  out.push(p[p.length - 1]);
  return out;
}

/** can someone at (ax,ay) see (bx,by)? buildings and tall props block sight; roofs too unless `roof` */
export function los(c: City, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay); const n = Math.ceil(d / (T / 3));
  for (let k = 1; k < n; k++) {
    const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
    const s = c.solid[ty * W + tx];
    if (s === S.BUILDING || s === S.TALL) return false;
  }
  return true;
}

/** nearest tile centre (spiral search) where this class can stand */
export function nearestFree(c: City, cls: MoveClass, x: number, y: number, open: Set<District>, maxR = 12, reject?: (x: number, y: number) => boolean): [number, number] {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  for (let r = 0; r <= maxR; r++) {
    let best: [number, number] | null = null, bd = 1e18;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = tx + dx, ny = ty + dy;
      if (!navOk(c, cls, nx, ny, open) || (cls === 'foot' && c.solid[ny * W + nx] === S.LOW)) continue;
      const cx = nx * T + T / 2, cy = ny * T + T / 2;
      if (reject && reject(cx, cy)) continue;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bd) { bd = d; best = [cx, cy]; }
    }
    if (best) return best;
  }
  return [x, y];
}

// Burrow Command's pathfinding: A* over the tile grid (eight ways, no corner cutting), then the path pulled straight
// wherever there is a clear line. Whole numbers only, so a path is the same on every run.

/** Ground blocking for each tile: 0 is open; anything else blocks walkers. */
export type Grid = { w: number; h: number; block: Uint8Array };

const SQ = 10, DG = 14;
let size = 0;
let gArr = new Int32Array(0), fArr = new Int32Array(0), parent = new Int32Array(0), stamp = new Int32Array(0), shut = new Int32Array(0);
let heap = new Int32Array(0);
let gen = 0;
function ensure(n: number) {
  if (size >= n) return;
  size = n; gArr = new Int32Array(n); fArr = new Int32Array(n); parent = new Int32Array(n); stamp = new Int32Array(n); shut = new Int32Array(n); heap = new Int32Array(n * 8 + 16); gen = 0;
}
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];

export const open = (g: Grid, x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.block[y * g.w + x] === 0;

/** How far a tile is from a rectangle of tiles, in eight-way steps. */
function rectDist(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return [dx, dy];
}
const octile = (dx: number, dy: number) => (dx > dy ? SQ * (dx - dy) + DG * dy : SQ * (dy - dx) + DG * dx);

/**
 * Tiles from (sx, sy) to the nearest open tile within `near` steps of the rectangle x0..x1, y0..y1 (inclusive). When the
 * goal cannot be reached it returns the way to the reachable tile closest to it. Returns tile indices, start excluded,
 * or null if the walker is already there.
 */
export function findPath(g: Grid, sx: number, sy: number, x0: number, y0: number, x1: number, y1: number, near: number, limit = 7000): number[] | null {
  const W = g.w, n = W * g.h; ensure(n);
  gen++; if (gen > 2e9) { gen = 1; stamp.fill(0); shut.fill(0); }
  const start = sy * W + sx;
  const goalAt = (x: number, y: number) => { const [dx, dy] = rectDist(x, y, x0, y0, x1, y1); return Math.max(dx, dy) <= near; };
  if (goalAt(sx, sy)) return null;
  const hOf = (x: number, y: number) => { const [dx, dy] = rectDist(x, y, x0, y0, x1, y1); return octile(dx, dy); };
  let hn = 0;
  const push = (i: number) => {
    let k = hn++; heap[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (less(heap[k], heap[p])) { const t = heap[k]; heap[k] = heap[p]; heap[p] = t; k = p; } else break; }
  };
  const less = (a: number, b: number) => fArr[a] < fArr[b] || (fArr[a] === fArr[b] && (gArr[a] > gArr[b] || (gArr[a] === gArr[b] && a < b)));
  const pop = () => {
    const top = heap[0]; hn--; if (hn > 0) { heap[0] = heap[hn]; let k = 0;
      for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < hn && less(heap[l], heap[m])) m = l; if (r < hn && less(heap[r], heap[m])) m = r; if (m === k) break; const t = heap[k]; heap[k] = heap[m]; heap[m] = t; k = m; } }
    return top;
  };
  stamp[start] = gen; gArr[start] = 0; fArr[start] = hOf(sx, sy); parent[start] = -1; push(start);
  let best = start, bestH = fArr[start], found = -1, count = 0;
  while (hn > 0) {
    const cur = pop();
    if (shut[cur] === gen) continue;
    shut[cur] = gen;
    const cx = cur % W, cy = (cur - cx) / W;
    if (cur !== start && goalAt(cx, cy)) { found = cur; break; }
    const h = fArr[cur] - gArr[cur];
    if (h < bestH || (h === bestH && gArr[cur] < gArr[best])) { best = cur; bestH = h; }
    if (++count > limit) break;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!open(g, nx, ny)) continue;
      if (d >= 4 && (!open(g, cx + DX[d], cy) || !open(g, cx, cy + DY[d]))) continue;
      const ni = ny * W + nx;
      if (shut[ni] === gen) continue;
      const ng = gArr[cur] + (d >= 4 ? DG : SQ);
      if (stamp[ni] !== gen || ng < gArr[ni]) {
        stamp[ni] = gen; gArr[ni] = ng; fArr[ni] = ng + hOf(nx, ny); parent[ni] = cur; push(ni);
      }
    }
  }
  const end = found >= 0 ? found : best;
  if (end === start) return null;
  const out: number[] = [];
  for (let i = end; i !== start && i >= 0; i = parent[i]) out.push(i);
  out.reverse();
  return out;
}

/** True when a walker of radius `r` (tiles) can go straight from one point to another (both in tiles). */
export function clearLine(g: Grid, ax: number, ay: number, bx: number, by: number, r = 0.3) {
  const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return true;
  const steps = Math.ceil(len * 4), px = (-dy / len) * r, py = (dx / len) * r;
  for (let i = 0; i <= steps; i++) {
    const x = ax + (dx * i) / steps, y = ay + (dy * i) / steps;
    if (!open(g, Math.floor(x), Math.floor(y)) || !open(g, Math.floor(x + px), Math.floor(y + py)) || !open(g, Math.floor(x - px), Math.floor(y - py))) return false;
  }
  return true;
}

/** Pulls a tile path straight: keeps only the corners a walker cannot see past. Returns tile-centre points [x, y, x, y...]. */
export function smooth(g: Grid, fromX: number, fromY: number, tiles: number[], r = 0.3): number[] {
  const pts: number[] = [];
  for (const i of tiles) pts.push((i % g.w) + 0.5, Math.floor(i / g.w) + 0.5);
  const out: number[] = [];
  let ax = fromX, ay = fromY, k = 0;
  const n = pts.length / 2;
  while (k < n) {
    let far = k;
    for (let j = n - 1; j > k; j--) if (clearLine(g, ax, ay, pts[j * 2], pts[j * 2 + 1], r)) { far = j; break; }
    out.push(pts[far * 2], pts[far * 2 + 1]);
    ax = pts[far * 2]; ay = pts[far * 2 + 1]; k = far + 1;
  }
  return out;
}

/** The open tiles nearest (tx, ty), in a fixed spiral order. */
export function spiral(g: Grid, tx: number, ty: number, count: number, maxR = 12, ok: (x: number, y: number) => boolean = (x, y) => open(g, x, y)): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r <= maxR && out.length < count; r++) {
    const ring: [number, number, number][] = [];
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
      if (ok(x, y)) ring.push([x, y, (x - tx) * (x - tx) + (y - ty) * (y - ty)]);
    }
    ring.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    for (const [x, y] of ring) { out.push([x, y]); if (out.length >= count) break; }
  }
  return out;
}

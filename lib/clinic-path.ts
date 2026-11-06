// Burrow Clinic: path-finding over the tile grid. Walls sit on the edges between tiles (a room's walls are its
// perimeter edges, with a gap for the door), so a step is allowed when the target tile is walkable and no wall stands
// on the shared edge. A* with a binary heap and a Manhattan heuristic; the goal tile may itself be blocked (a machine
// a patient climbs onto, a bench seat, a plant a cleaner waters from beside it is reached via `near`).

export interface Grid {
  w: number; h: number;
  /** 1 where an entity may stand */
  walk: Uint8Array;
  /** wall on the edge between (x,y) and (x,y+1) */
  wallS: Uint8Array;
  /** wall on the edge between (x,y) and (x+1,y) */
  wallE: Uint8Array;
}
export type Pt = [number, number];

export const newGrid = (w: number, h: number): Grid => ({ w, h, walk: new Uint8Array(w * h), wallS: new Uint8Array(w * h), wallE: new Uint8Array(w * h) });

export const DIRS: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** is there a wall between (x,y) and its neighbour (x+dx, y+dy)? */
export function wallBetween(g: Grid, x: number, y: number, dx: number, dy: number): boolean {
  if (dx === 1) return g.wallE[y * g.w + x] === 1;
  if (dx === -1) return x > 0 && g.wallE[y * g.w + x - 1] === 1;
  if (dy === 1) return g.wallS[y * g.w + x] === 1;
  return y > 0 && g.wallS[(y - 1) * g.w + x] === 1;
}
export const inGrid = (g: Grid, x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h;
export const walkable = (g: Grid, x: number, y: number) => inGrid(g, x, y) && g.walk[y * g.w + x] === 1;

/** may an entity step from (x,y) to the neighbour? `goal` lets the last step land on a blocked tile */
export function canStep(g: Grid, x: number, y: number, dx: number, dy: number, goal = -1): boolean {
  const nx = x + dx, ny = y + dy;
  if (!inGrid(g, nx, ny) || wallBetween(g, x, y, dx, dy)) return false;
  const i = ny * g.w + nx;
  return g.walk[i] === 1 || i === goal;
}

/** A*: the tiles to walk through after the start, ending on the target; [] when already there; null when unreachable */
export function astar(g: Grid, sx: number, sy: number, tx: number, ty: number): Pt[] | null {
  if (sx === tx && sy === ty) return [];
  if (!inGrid(g, sx, sy) || !inGrid(g, tx, ty)) return null;
  const n = g.w * g.h, goal = ty * g.w + tx, start = sy * g.w + sx;
  const gs = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap: number[] = [], fs: number[] = [];
  const push = (i: number, f: number) => {
    heap.push(i); fs.push(f); let c = heap.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (fs[p] <= fs[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [fs[p], fs[c]] = [fs[c], fs[p]]; c = p; }
  };
  const pop = () => {
    const top = heap[0], li = heap.pop()!, lf = fs.pop()!;
    if (heap.length) {
      heap[0] = li; fs[0] = lf; let c = 0;
      for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && fs[l] < fs[m]) m = l; if (r < heap.length && fs[r] < fs[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [fs[m], fs[c]] = [fs[c], fs[m]]; c = m; }
    }
    return top;
  };
  gs[start] = 0; push(start, Math.abs(sx - tx) + Math.abs(sy - ty));
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % g.w, cy = (cur / g.w) | 0;
    // a blocked start (a patient climbing off a machine) may still step out; blocked middles may not
    for (const [dx, dy] of DIRS) {
      if (!canStep(g, cx, cy, dx, dy, goal)) continue;
      const ni = (cy + dy) * g.w + cx + dx;
      if (closed[ni]) continue;
      // a tiny bias against turning keeps paths in straight runs rather than staircases
      const turn = from[cur] >= 0 && (cur - from[cur]) !== (ni - cur) ? 0.001 : 0;
      const ng = gs[cur] + 1 + turn;
      if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; push(ni, ng + Math.abs(cx + dx - tx) + Math.abs(cy + dy - ty)); }
    }
  }
  if (from[goal] < 0) return null;
  const out: Pt[] = [];
  for (let c = goal; c !== start; c = from[c]) out.push([c % g.w, (c / g.w) | 0]);
  return out.reverse();
}

/** breadth-first step distances from a tile over walkable tiles (-1 where unreachable) */
export function bfs(g: Grid, sx: number, sy: number): Int16Array {
  const d = new Int16Array(g.w * g.h).fill(-1);
  if (!inGrid(g, sx, sy)) return d;
  const q = [sy * g.w + sx]; d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % g.w, cy = (c / g.w) | 0;
    for (const [dx, dy] of DIRS) {
      if (!canStep(g, cx, cy, dx, dy)) continue;
      const ni = (cy + dy) * g.w + cx + dx;
      if (d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); }
    }
  }
  return d;
}

/** a path cache keyed by the grid's layout version: cleared whenever rooms, doors or blocking decorations change */
export class PathCache {
  private map = new Map<string, Pt[] | null>();
  version = -1;
  hits = 0; misses = 0;
  get(g: Grid, version: number, sx: number, sy: number, tx: number, ty: number): Pt[] | null {
    if (version !== this.version) { this.map.clear(); this.version = version; }
    const k = `${sx},${sy}>${tx},${ty}`;
    const c = this.map.get(k);
    if (c !== undefined) { this.hits++; return c ? c.slice() : null; }
    this.misses++;
    const p = astar(g, sx, sy, tx, ty);
    if (this.map.size > 4000) this.map.clear();
    this.map.set(k, p);
    return p ? p.slice() : null;
  }
}

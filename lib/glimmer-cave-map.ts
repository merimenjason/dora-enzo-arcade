// Glimmer Cave's maps: a seeded cave carved by cellular automata, and the digging of its blocks. Deterministic and
// DOM-free: a seed and a layer give the same map every time.

import { Rand, mix } from './glimmer-cave-rand.js';
import { goldRange } from './glimmer-cave-data.js';
import type { Block, JobId, LayerNo } from './glimmer-cave-data.js';

export const MAP_W = 64, MAP_H = 48;

export type CaveMap = {
  w: number; h: number; tiles: Block[];
  start: { x: number; y: number };
  pods: { x: number; y: number }[];
  props: { kind: 'crate' | 'lantern'; x: number; y: number }[];
  tint: LayerNo;
};

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function tileAt(m: CaveMap, x: number, y: number): Block {
  return x < 0 || y < 0 || x >= m.w || y >= m.h ? 'bedrock' : m.tiles[y * m.w + x];
}

export function solid(b: Block) { return b !== 'floor'; }

/** Digs a block into floor and returns its drop, or null when it can't be dug. */
export function dig(m: CaveMap, x: number, y: number, r: Rand, layer: LayerNo): { block: Block; gold: number; crystals: number } | null {
  const b = tileAt(m, x, y);
  if (b === 'floor' || b === 'bedrock' || b === 'lantern') return null;
  m.tiles[y * m.w + x] = 'floor';
  let gold = 0;
  if (b === 'gold') { const [lo, hi] = goldRange(layer); gold = lo + r.int(hi - lo + 1); }
  return { block: b, gold, crystals: b === 'crate' ? 15 : 0 };
}

/** A 4-way flood fill over open tiles; 1 marks every tile reached. */
export function reachable(m: CaveMap, from: { x: number; y: number }): Uint8Array {
  const seen = new Uint8Array(m.w * m.h);
  if (tileAt(m, from.x, from.y) !== 'floor') return seen;
  const stack = [from.y * m.w + from.x]; seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!, x = i % m.w, y = (i - x) / m.w;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const j = ny * m.w + nx;
      if (!seen[j] && m.tiles[j] === 'floor') { seen[j] = 1; stack.push(j); }
    }
  }
  return seen;
}

/** Splits open tiles (open[i] = 1) into 4-way connected caverns, each a list of tile indices. */
function caverns(open: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(w * h), out: number[][] = [];
  for (let s = 0; s < w * h; s++) {
    if (!open[s] || seen[s]) continue;
    const cave = [s], stack = [s]; seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!, x = i % w, y = (i - x) / w;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (open[j] && !seen[j]) { seen[j] = 1; stack.push(j); cave.push(j); }
      }
    }
    out.push(cave);
  }
  return out;
}

export function makeMap(seed: number, layer: LayerNo, job: JobId | null): CaveMap {
  const w = MAP_W, h = MAP_H, n = w * h, r = new Rand(mix(seed, layer * 7919 + 1));
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const interior = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2;

  // 2. Carve caverns: 45% open, then five passes of the 4-5 rule (out of the map counts as rock).
  let open = new Uint8Array(n);
  for (let i = 0; i < n; i++) open[i] = r.next() < 0.45 ? 1 : 0;
  for (let pass = 0; pass < 5; pass++) {
    const next = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let rock = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && (!inMap(x + dx, y + dy) || !open[(y + dy) * w + x + dx])) rock++;
      }
      next[y * w + x] = rock >= 5 ? 0 : rock <= 3 ? 1 : open[y * w + x];
    }
    open = next;
  }
  // Keep the border out of it from here on, so tunnels and caverns stay inside.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!interior(x, y)) open[y * w + x] = 0;

  // 3. Keep the largest cavern, tunnel every other of 12 or more into it with a 2-wide passage, fill the rest.
  const all = caverns(open, w, h).sort((a, b) => b.length - a.length);
  if (!all.length) all.push([]);
  const main = new Uint8Array(n);
  for (const i of all[0]) main[i] = 1;
  const mainList = all[0].slice();
  const carve = (x: number, y: number) => {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const cx = Math.min(w - 3, Math.max(2, x + dx)), cy = Math.min(h - 3, Math.max(2, y + dy));
      if (!main[cy * w + cx]) { main[cy * w + cx] = 1; mainList.push(cy * w + cx); }
    }
  };
  for (let c = 1; c < all.length; c++) {
    const cave = all[c];
    if (cave.length < 12) continue;
    let best = Infinity, ax = 0, ay = 0, bx = 0, by = 0;
    for (const a of cave) {
      const x = a % w, y = (a - x) / w;
      for (const b of mainList) {
        const bxx = b % w, byy = (b - bxx) / w, d = Math.abs(bxx - x) + Math.abs(byy - y);
        if (d < best) { best = d; ax = x; ay = y; bx = bxx; by = byy; }
      }
    }
    let x = ax, y = ay;
    while (x !== bx) { carve(x, y); x += Math.sign(bx - x); }
    while (y !== by) { carve(x, y); y += Math.sign(by - y); }
    for (const i of cave) if (!main[i]) { main[i] = 1; mainList.push(i); }
  }

  // 4 and 5. Two tiles of bedrock round the edge; the remaining rock is dirt, gold and bedrock clumps.
  const tiles: Block[] = new Array(n);
  const goldP = 0.08 + 0.02 * layer;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!interior(x, y)) tiles[i] = 'bedrock';
    else if (main[i]) tiles[i] = 'floor';
    else {
      const v = r.next();
      tiles[i] = v < 0.03 ? 'bedrock' : v < 0.03 + goldP ? 'gold' : 'dirt';
      if (tiles[i] === 'bedrock') {
        for (const [dx, dy] of D4) if (r.next() < 0.3 && interior(x + dx, y + dy) && !main[i + dy * w + dx]) tiles[i + dy * w + dx] = 'bedrock';
      }
    }
  }
  const m: CaveMap = { w, h, tiles, start: { x: w >> 1, y: h >> 1 }, pods: [], props: [], tint: layer };

  // 6. The start is the open tile nearest the centre, with a 5 x 5 room cleared round it.
  let bd = Infinity;
  for (let y = 4; y < h - 4; y++) for (let x = 4; x < w - 4; x++) {
    if (tiles[y * w + x] !== 'floor') continue;
    const d = (x - w / 2) ** 2 + (y - h / 2) ** 2;
    if (d < bd) { bd = d; m.start = { x, y }; }
  }
  if (bd === Infinity) m.start = { x: w >> 1, y: h >> 1 };
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) tiles[(m.start.y + dy) * w + m.start.x + dx] = 'floor';
  // Anything open that the start can't reach (the border cut it off, say) goes back to dirt.
  const reach = reachable(m, m.start);
  for (let i = 0; i < n; i++) if (tiles[i] === 'floor' && !reach[i]) tiles[i] = 'dirt';

  // 7. Pod spots: open tiles with all 8 neighbours open, spread out and away from the start.
  const wide = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(m, x + dx, y + dy) !== 'floor') return false;
    return true;
  };
  const spots: { x: number; y: number }[] = [];
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) if (wide(x, y)) spots.push({ x, y });
  const farSpots = spots.filter(p => Math.hypot(p.x - m.start.x, p.y - m.start.y) >= 12);
  const pool = farSpots.length >= 12 ? farSpots : spots;
  const chosen: { x: number; y: number }[] = [m.start];
  while (m.pods.length < 12 && m.pods.length < pool.length) {
    let pick = pool[0], pickD = -1;
    for (let k = 0; k < 30; k++) {
      const p = pool[r.int(pool.length)];
      if (chosen.includes(p)) continue;
      const d = Math.min(...chosen.map(c => Math.hypot(c.x - p.x, c.y - p.y)));
      if (d > pickD) { pickD = d; pick = p; }
    }
    if (chosen.includes(pick)) { pick = pool.find(p => !chosen.includes(p))!; }
    chosen.push(pick); m.pods.push(pick);
  }
  // A cave too cramped for 12 pod spots gets 3 x 3 clearings opened beside open floor.
  for (let tries = 0; m.pods.length < 12 && tries < 500; tries++) {
    const x = 3 + r.int(w - 6), y = 3 + r.int(h - 6);
    if (m.pods.some(p => p.x === x && p.y === y)) continue;
    if (!D4.some(([dx, dy]) => reach[(y + dy * 2) * w + x + dx * 2] && tiles[(y + dy * 2) * w + x + dx * 2] === 'floor')) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles[(y + dy) * w + x + dx] = 'floor';
    for (const [dx, dy] of D4) { tiles[(y + dy) * w + x + dx] = 'floor'; }
    m.pods.push({ x, y });
  }

  // 8. Job props.
  if (job === 'crates') {
    const cands: { x: number; y: number }[] = [];
    const flo = reachable(m, m.start);
    for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
      const b = tiles[y * w + x];
      if (b !== 'dirt' && b !== 'gold') continue;
      let buried = true;
      for (let dy = -1; dy <= 1 && buried; dy++) for (let dx = -1; dx <= 1; dx++) if (tiles[(y + dy) * w + x + dx] === 'floor') { buried = false; break; }
      if (!buried) continue;
      const dug = D4.some(([dx, dy]) => {
        const nb = tiles[(y + dy) * w + x + dx];
        return (nb === 'dirt' || nb === 'gold') && D4.some(([ex, ey]) => flo[(y + dy + ey) * w + x + dx + ex] === 1);
      });
      if (dug) cands.push({ x, y });
    }
    r.shuffle(cands);
    for (const c of cands) {
      if (m.props.length >= 3) break;
      if (m.props.some(p => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 8)) continue;
      tiles[c.y * w + c.x] = 'crate'; m.props.push({ kind: 'crate', x: c.x, y: c.y });
    }
    for (const c of cands) {
      if (m.props.length >= 3) break;
      if (tiles[c.y * w + c.x] !== 'crate') { tiles[c.y * w + c.x] = 'crate'; m.props.push({ kind: 'crate', x: c.x, y: c.y }); }
    }
  } else if (job === 'lanterns') {
    const nearPod = (x: number, y: number) => m.pods.some(p => Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2);
    const far = (x: number, y: number) => Math.hypot(x - m.start.x, y - m.start.y) >= 10;
    const good = spots.filter(p => tiles[p.y * w + p.x] === 'floor' && far(p.x, p.y) && !nearPod(p.x, p.y));
    const any: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) { const x = i % w, y = (i - x) / w; if (tiles[i] === 'floor' && far(x, y) && !nearPod(x, y)) any.push({ x, y }); }
    for (const list of [good, any]) {
      r.shuffle(list);
      for (const c of list) {
        if (m.props.length >= 3) break;
        if (m.props.some(p => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 6) && list === good) continue;
        if (tiles[c.y * w + c.x] !== 'floor') continue;
        tiles[c.y * w + c.x] = 'lantern'; m.props.push({ kind: 'lantern', x: c.x, y: c.y });
      }
    }
  }
  return m;
}

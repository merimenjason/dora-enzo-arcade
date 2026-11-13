// Cloudpop: the eight valley maps. World space is the painting's 1536x1024 pixels. Each map has one or two roads
// (waypoints, smoothed into a dense polyline), lake water (only Reed Boats float; roosts may sit on it), rocks and
// trees that block line of sight (fliers and lobbed shots ignore them), and no-build cliffs.

import { WATER } from './cloudpop-art.js';

export const WORLD_W = 1536, WORLD_H = 1024;
export const ROAD_W = 58;

export type Tier = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export const TIERS: Tier[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export type Pt = [number, number];
/** circle: x, y, r */
export type Circle = [number, number, number];

export interface MapDef {
  id: string;
  name: string;
  tier: Tier;
  blurb: string;
  /** roads as waypoints, entrance first */
  roads: Pt[][];
  /** water bodies (polygons) */
  water: Pt[][];
  /** islands inside water that are land again */
  islands: Circle[];
  /** rocks, trees: block line of sight and building */
  blockers: Circle[];
  /** cliffs and buildings: no building, but see-through */
  noBuild: Circle[];
  /** player level needed (beginner maps are open) */
  level: number;
}

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i) => [Math.round(cx + rx * Math.cos(i / n * Math.PI * 2)), Math.round(cy + ry * Math.sin(i / n * Math.PI * 2))] as Pt);

export const MAPS: MapDef[] = [
  {
    id: 'meadow', name: 'Terrace Meadow', tier: 'beginner', level: 1,
    blurb: 'A long, lazy road down the terraces to the festival. A little pond for the reed boats.',
    roads: [[[-40, 200], [260, 200], [380, 260], [410, 400], [310, 520], [210, 650], [270, 790], [470, 830], [660, 760], [760, 600], [860, 450], [1000, 385], [1140, 445], [1185, 600], [1100, 760], [1170, 900], [1380, 925], [1580, 925]]],
    water: [ellipse(1260, 220, 170, 110)], islands: [], blockers: [], noBuild: [[1440, 960, 120]],
  },
  {
    id: 'loop', name: 'Llama Loop', tier: 'beginner', level: 1,
    blurb: 'The road circles a llama pasture before winding down. Towers in the middle reach it twice.',
    roads: [[[700, -40], [700, 210], [560, 320], [430, 480], [480, 660], [700, 730], [910, 650], [950, 460], [830, 330], [640, 300], [470, 230], [300, 190], [160, 310], [130, 560], [220, 820], [480, 945], [900, 945], [1200, 870], [1340, 700], [1580, 640]]],
    water: [ellipse(1250, 290, 165, 120)], islands: [], blockers: [], noBuild: [],
  },
  {
    id: 'salar', name: 'Salt Flat Crossing', tier: 'intermediate', level: 3,
    blurb: 'Long zigzags across the white salt flats, past pink lagoons. Lots of road, little shelter.',
    roads: [[[-40, 165], [1180, 165], [1340, 245], [1270, 400], [300, 420], [175, 525], [285, 645], [1250, 660], [1385, 765], [1255, 880], [-40, 885]]],
    water: [ellipse(760, 540, 260, 52), ellipse(1460, 520, 70, 170)], islands: [], blockers: [], noBuild: [[90, 990, 100], [260, 1000, 80]],
  },
  {
    id: 'falls', name: 'Twin Falls', tier: 'intermediate', level: 5,
    blurb: 'Two roads, one from each side of the falls, meet at the bridge and run down to the plaza together.',
    roads: [
      [[-40, 260], [300, 260], [430, 400], [600, 465], [700, 512], [800, 560], [748, 650], [735, 730], [808, 810], [865, 910], [855, 1064]],
      [[1160, -40], [1155, 130], [1090, 300], [1005, 400], [900, 478], [800, 560], [748, 650], [735, 730], [808, 810], [865, 910], [855, 1064]],
    ],
    water: [[[660, -10], [880, -10], [840, 180], [760, 300], [610, 320], [560, 250]], ellipse(250, 760, 190, 150)], islands: [], blockers: [[1320, 600, 70]], noBuild: [],
  },
  {
    id: 'canyon', name: 'Condor Canyon', tier: 'advanced', level: 8,
    blurb: 'The road threads between rock spires. Rocks block sight: put fliers and lobbers where slingers can\'t see.',
    roads: [[[1580, 140], [1100, 140], [900, 260], [980, 420], [1200, 500], [1180, 680], [900, 760], [600, 700], [500, 520], [300, 420], [160, 560], [240, 820], [560, 900], [800, 1064]]],
    water: [ellipse(1380, 860, 110, 80)], islands: [],
    blockers: [[700, 300, 75], [430, 710, 62], [1360, 330, 64], [1010, 600, 58], [300, 250, 52], [1100, 860, 50], [640, 520, 44]], noBuild: [],
  },
  {
    id: 'isles', name: 'Reed Isles', tier: 'advanced', level: 10,
    blurb: 'A road of floating reed islands across the lake. Little land, lots of water: a home for boats.',
    roads: [[[-40, 300], [250, 300], [400, 450], [300, 650], [450, 820], [700, 800], [800, 620], [1000, 520], [1150, 650], [1300, 820], [1500, 780], [1580, 700]]],
    water: [[[-10, 380], [200, 380], [260, 480], [200, 760], [380, 920], [760, 900], [900, 700], [1050, 760], [1200, 940], [1546, 960], [1546, 1034], [-10, 1034]], [[500, 0], [1546, 0], [1546, 600], [1300, 620], [1180, 430], [950, 400], [700, 330], [520, 200]]],
    islands: [[1350, 300, 110], [900, 180, 90], [120, 880, 90], [620, 960, 70]], blockers: [], noBuild: [],
  },
  {
    id: 'forest', name: 'Cloud Forest Switchbacks', tier: 'expert', level: 14,
    blurb: 'A short, steep road through dripping cloud forest. Trees block sight everywhere.',
    roads: [[[1580, 200], [1100, 200], [1000, 320], [1100, 440], [1000, 560], [600, 560], [500, 680], [600, 800], [400, 900], [-40, 900]]],
    water: [ellipse(1350, 700, 120, 90)], islands: [],
    blockers: [[800, 380, 70], [1300, 420, 60], [400, 420, 70], [250, 650, 60], [780, 760, 55], [1200, 780, 50], [600, 220, 60], [150, 250, 55], [880, 920, 50]], noBuild: [],
  },
  {
    id: 'summit', name: 'Summit of the Storm', tier: 'expert', level: 18,
    blurb: 'Two short roads cross on the bare summit. Snowy cliffs leave only a few places to build.',
    roads: [
      [[-40, 200], [500, 250], [900, 700], [1580, 800]],
      [[-40, 850], [500, 800], [900, 300], [1580, 220]],
    ],
    water: [ellipse(1250, 520, 110, 70)], islands: [], blockers: [[1010, 500, 50], [420, 520, 45]],
    noBuild: [[200, 520, 130], [1100, 60, 110], [1100, 990, 110], [350, 30, 90], [1480, 1000, 90], [1480, 30, 70]],
  },
];
export const MAP: Record<string, MapDef> = Object.fromEntries(MAPS.map(m => [m.id, m]));

// ── road geometry: Catmull-Rom smoothed, resampled every STEP units
export const STEP = 4;
export interface Road { pts: Float32Array; len: number; n: number }
function catmull(p: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const seg = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 8));
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}
export function buildRoad(way: Pt[], reverse = false): Road {
  const src = catmull(reverse ? [...way].reverse() : way);
  const res: number[] = [src[0][0], src[0][1]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [ax, ay] = src[i - 1], [bx, by] = src[i];
    const L = Math.hypot(bx - ax, by - ay);
    let t = STEP - carry;
    while (t <= L) { res.push(ax + (bx - ax) * t / L, ay + (by - ay) * t / L); t += STEP; }
    carry = L - (t - STEP);
  }
  const pts = new Float32Array(res);
  const n = pts.length / 2;
  return { pts, n, len: (n - 1) * STEP };
}
/** position on a road at distance d (clamped) */
export function roadAt(r: Road, d: number): [number, number] {
  const f = Math.max(0, Math.min(r.n - 1.001, d / STEP)), i = Math.floor(f), k = f - i;
  return [r.pts[i * 2] + (r.pts[i * 2 + 2] - r.pts[i * 2]) * k, r.pts[i * 2 + 1] + (r.pts[i * 2 + 3] - r.pts[i * 2 + 1]) * k];
}
/** shortest distance from a point to any road */
export function distToRoads(roads: Road[], x: number, y: number): number {
  let best = 1e9;
  for (const r of roads) for (let i = 0; i < r.n; i += 2) {
    const dx = r.pts[i * 2] - x, dy = r.pts[i * 2 + 1] - y, d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
export function inPoly(poly: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const WET: Record<string, Uint8Array> = {};
/** the water grid measured from the painting (16 px cells), decoded from run lengths once */
function wetGrid(id: string): Uint8Array | null {
  if (WET[id]) return WET[id];
  const rows = WATER[id]; if (!rows) return null;
  const g = new Uint8Array(96 * 64);
  rows.forEach((row, j) => { let i = 0, v = 0; for (const n of row.split('.').map(Number)) { for (let k = 0; k < n; k++) g[j * 96 + i++] = v; v ^= 1; } });
  return (WET[id] = g);
}
export function isWater(m: MapDef, x: number, y: number): boolean {
  const g = wetGrid(m.id);
  if (g) { const i = Math.floor(x / 16), j = Math.floor(y / 16); return i >= 0 && j >= 0 && i < 96 && j < 64 && g[j * 96 + i] === 1; }
  if (!m.water.some(p => inPoly(p, x, y))) return false;
  return !m.islands.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r);
}
/** does the segment a-b pass through a blocker? */
export function blocked(m: MapDef, ax: number, ay: number, bx: number, by: number): boolean {
  for (const [cx, cy, r] of m.blockers) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / L2));
    const px = ax + dx * t - cx, py = ay + dy * t - cy;
    if (px * px + py * py < r * r * 0.8) return true;
  }
  return false;
}

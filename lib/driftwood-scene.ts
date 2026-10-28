// Driftwood Post's lake, drawn in Canvas 2D: a top-down painted lake seen at a slight angle. Water shaded deep to
// shallow from a precomputed shoreline distance field, ripples and glints that drift with the wind, foam lapping every
// coast, current streaks, the boat's wake and splashes, islands (painted, or drawn stand-ins with their villages),
// jetties with post flags, rocks, reeds, fog, rain, the day's light from dawn pink to blue night with glowing windows,
// lighthouse beams and lanterns, the HUD (compass with the no-go wedge, speed, clock dial, minimap, delivery arrow and
// telltale), and the full-screen parchment chart. Drawing only: the rules live in driftwood-game.ts.
// Every painting in public/art/driftwood/ has a drawn stand-in, shown until (or unless) it loads.
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import {
  ISLANDS, ISLAND, ROCKS, REEDS, CURRENTS, FOGS, SHELLS, BOTTLES, STORY, LAKE_W, LAKE_H, MAX_SPEED, PREVAIL,
  CHART_W, CHART_H, CHART_CELL, HZ, clearance, edgeDist, shoreIn, fogAt, daylight, clockOf, clockText, dayPart, wrap,
  type DriftwoodGame, type Ev, type Island, type IslandId, type ResidentId, type Pt,
} from './driftwood-game';

const FONT = 'ui-rounded, "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
/** A repeatable hash of two integers to 0..1, for scattering trees, ripples and glints without Math.random. */
const hash = (i: number, j: number) => { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const rgb = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mixRgb = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: number[], a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
const ease = (u: number) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const blob = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) => { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); c.fill(); };
/** A closed smooth path through points (midpoint quadratics), for soft painted outlines. */
function smoothPath(c: CanvasRenderingContext2D | Path2D, pts: Pt[], ox = 0, oy = 0) {
  const n = pts.length, m = (i: number): Pt => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2 - ox, (a[1] + b[1]) / 2 - oy]; };
  const s = m(n - 1); c.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], e = m(i); c.quadraticCurveTo(p[0] - ox, p[1] - oy, e[0], e[1]); }
  c.closePath();
}
/** A polygon pushed out (or in, for negative d) along its corners' normals. */
function offsetPoly(pts: Pt[], d: number): Pt[] {
  const n = pts.length, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    let nx = (b[1] - a[1]) + (c[1] - b[1]), ny = -((b[0] - a[0]) + (c[0] - b[0]));
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    out.push([b[0] - nx * d, b[1] - ny * d]);
  }
  // the coast winds clockwise on screen, so the normal above points inward; flip if it went the wrong way
  const area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  return area > 0 ? out : out.map((p, i) => [2 * pts[i][0] - p[0], 2 * pts[i][1] - p[1]] as Pt);
}

// ---------------------------------------------------------------- the light through the day
/** Colour grade keyframes by minute of the day: the multiply tint and how strong it is. */
const GRADE: [number, string, number][] = [
  [0, '#1b2a62', 0.66], [270, '#1b2a62', 0.66], [345, '#8a6ab0', 0.42], [400, '#f2a2b2', 0.28], [470, '#ffe6c8', 0.08], [540, '#ffffff', 0],
  [960, '#ffffff', 0], [1030, '#ffc878', 0.24], [1090, '#ff9a5c', 0.46], [1150, '#e8707a', 0.5], [1195, '#7a5aa8', 0.52], [1240, '#1b2a62', 0.66], [1440, '#1b2a62', 0.66],
];
function gradeAt(minute: number): { col: number[]; a: number } {
  const m = clockOf(minute);
  for (let i = 0; i < GRADE.length - 1; i++) {
    const [m0, c0, a0] = GRADE[i], [m1, c1, a1] = GRADE[i + 1];
    if (m >= m0 && m <= m1) { const t = ease((m - m0) / (m1 - m0)); return { col: mixRgb(rgb(c0), rgb(c1), t), a: a0 + (a1 - a0) * t }; }
  }
  return { col: rgb('#1b2a62'), a: 0.66 };
}
/** How much the night lights glow: 0 by day, 1 at night, rising through dusk. */
const glowAt = (minute: number) => 1 - daylight(minute);

// ---------------------------------------------------------------- island stand-ins
type Feat = { k: string; x: number; y: number; s: number; c?: string; v?: number };
type IslandLook = { feats: Feat[]; windows: Pt[]; lamp: Pt | null; mill: Pt | null; smoke: Pt[]; ground: 'grass' | 'rock' | 'marsh' | 'sand' };
const LOOKS = new Map<IslandId, IslandLook>();
/** Places an island's trees, houses and landmarks, the same every time (hashed from the island's index). */
function lookOf(isl: Island): IslandLook {
  const got = LOOKS.get(isl.id); if (got) return got;
  const idx = ISLANDS.indexOf(isl), feats: Feat[] = [], windows: Pt[] = [], smoke: Pt[] = [];
  let lamp: Pt | null = null, mill: Pt | null = null;
  const r = (k: number) => hash(idx * 97 + 11, k);
  const inner = (rr: number) => offsetPoly(isl.poly.map(([x, y]) => [x - isl.x, y - isl.y] as Pt), -rr);
  const inside = (x: number, y: number, m: number) => { const p = inner(m); let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
  const R = isl.reach;
  /** Scatters `n` of a feature over the island, keeping clear of the coast and of a few spots. */
  const scatter = (n: number, k: string, s0: number, s1: number, margin: number, avoid: Feat[], c?: string, seed = 0) => {
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const a = r(seed + tries * 3) * TAU, d = Math.sqrt(r(seed + tries * 3 + 1)) * R, x = Math.cos(a) * d, y = Math.sin(a) * d, s = s0 + (s1 - s0) * r(seed + tries * 3 + 2);
      if (!inside(x, y, margin + s * 0.5)) continue;
      if (avoid.some((f) => Math.hypot(f.x - x, f.y - y) < (f.s + s) * 0.62)) continue;
      const f = { k, x, y, s, c }; feats.push(f); avoid.push(f); i++;
    }
  };
  const house = (x: number, y: number, s: number, roof: string) => { feats.push({ k: 'house', x, y, s, c: roof }); windows.push([x - s * 0.18, y - s * 0.32], [x + s * 0.2, y - s * 0.32]); smoke.push([x + s * 0.28, y - s * 0.95]); };
  let ground: IslandLook['ground'] = 'grass';
  const keep: Feat[] = [];
  const pin = (k: string, x: number, y: number, s: number, c?: string, v?: number) => { const f = { k, x, y, s, c, v }; feats.push(f); keep.push(f); return f; };
  switch (isl.id) {
    case 'home':
      pin('post', -10, -10, 60, '#d9473e'); windows.push([-28, -30], [8, -30], [-10, -46]); smoke.push([12, -68]);
      house(-90, 40, 38, '#c9693a'); house(70, -80, 36, '#7a8ac0'); house(80, 50, 34, '#b05a8a');
      pin('burrow', -70, -80, 30); pin('boathouse', 95, -10, 34);
      scatter(14, 'tree', 20, 32, 30, keep, undefined, 5); break;
    case 'lighthouse':
      ground = 'rock'; lamp = [10, -100]; pin('lighthouse', 10, -10, 26); house(-45, 30, 32, '#c94a3a');
      scatter(5, 'boulder', 12, 20, 14, keep, undefined, 3); break;
    case 'bakery':
      mill = [-10, -92]; pin('windmill', -10, -20, 34); house(50, 40, 40, '#e0a040'); windows.push([30, 10]);
      pin('wheat', -70, 50, 46); pin('wheat', 10, 80, 40); scatter(7, 'tree', 18, 26, 26, keep, undefined, 7); break;
    case 'boatyard':
      pin('slip', 110, 10, 60); pin('crane', 50, -40, 40); pin('timber', -40, 60, 30); pin('timber', -70, 20, 26); house(-40, -50, 40, '#6a8a5a');
      scatter(8, 'tree', 18, 28, 28, keep, undefined, 9); break;
    case 'reeds':
      ground = 'marsh'; pin('pond', 30, 20, 50); pin('pond', -60, -30, 34);
      pin('stilt', -20, -70, 34, '#7a5a3a'); pin('stilt', 70, -40, 30, '#8a6a4a'); pin('stilt', -70, 50, 30, '#6a5a3a');
      windows.push([-20, -96], [70, -64], [-70, 26]); scatter(16, 'reed', 14, 22, 12, keep, undefined, 4); break;
    case 'orchard':
      pin('hives', 40, 60, 30); house(-30, 40, 38, '#c97a9a');
      scatter(16, 'blossom', 24, 34, 28, keep, undefined, 2); break;
    case 'market':
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; pin('stall', Math.cos(a) * 75, Math.sin(a) * 60, 30, ['#e05a5a', '#4a8ad0', '#f0b030', '#5ab07a', '#b06ad0', '#f07ab0'][i]); }
      pin('well', 0, 0, 22); house(-20, -110, 36, '#d07a3a'); scatter(7, 'tree', 18, 26, 26, keep, undefined, 6); break;
    case 'heron':
      ground = 'rock'; pin('crag', 0, 10, 110); pin('nest', 0, -110, 30); scatter(6, 'pine', 20, 30, 24, keep, undefined, 8); break;
    case 'rabbits':
      pin('hill', -70, -10, 100); pin('hill', 80, 20, 92); pin('bridge', 5, 5, 40);
      for (let i = 0; i < 7; i++) { const a = r(200 + i) * TAU, h = i % 2 ? [80, 20] : [-70, -10]; pin('hole', h[0] + Math.cos(a) * 40, h[1] + Math.sin(a) * 34, 9); }
      windows.push([-70, -30], [80, 0]); scatter(8, 'tree', 18, 24, 26, keep, undefined, 1); break;
    case 'observatory':
      lamp = null; pin('dome', 20, -10, 50); windows.push([20, -34]);
      scatter(22, 'pine', 22, 34, 22, keep, undefined, 3); break;
    case 'palm': ground = 'sand'; pin('palm', 0, -5, 40); pin('boulder', 30, 20, 14); pin('boulder', -28, 22, 10); break;
    case 'gullrest': ground = 'sand'; pin('palm', -6, 0, 40); pin('boulder', 26, 18, 16); pin('boulder', -30, 16, 12); pin('gull', 10, -20, 10); break;
    case 'sandbar': ground = 'sand'; for (let i = 0; i < 9; i++) pin('shellbit', (r(i) - 0.5) * 120, (r(i + 20) - 0.5) * 50, 6, ['#f4c0c8', '#fff0d0', '#f0d0a0'][i % 3]); break;
    case 'pebblebar': ground = 'sand'; for (let i = 0; i < 14; i++) pin('pebble', (r(i) - 0.5) * 100, (r(i + 30) - 0.5) * 60, 6 + r(i + 60) * 6); break;
    case 'birdhouse': ground = 'rock'; pin('birdhouse', 0, -6, 30); scatter(2, 'tree', 14, 18, 16, keep, undefined, 2); break;
  }
  const look = { feats: feats.sort((a, b) => a.y - b.y), windows, lamp, mill, smoke: isl.id === 'home' || isl.id === 'bakery' ? smoke.slice(0, 2) : [], ground };
  LOOKS.set(isl.id, look);
  return look;
}

function tree(c: CanvasRenderingContext2D, x: number, y: number, s: number, cols = ['#3f7d3a', '#5a9c48', '#86c262']) {
  blob(c, x + s * 0.28, y + s * 0.18, s * 0.5, s * 0.32, 'rgba(30, 50, 30, 0.22)');
  c.fillStyle = '#6a4a2a'; c.fillRect(x - s * 0.06, y - s * 0.2, s * 0.12, s * 0.24);
  blob(c, x, y - s * 0.42, s * 0.48, s * 0.42, cols[0]); blob(c, x - s * 0.08, y - s * 0.5, s * 0.36, s * 0.32, cols[1]); blob(c, x - s * 0.16, y - s * 0.6, s * 0.16, s * 0.13, cols[2]);
}
function pine(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  blob(c, x + s * 0.25, y + s * 0.12, s * 0.4, s * 0.22, 'rgba(20, 40, 30, 0.25)');
  for (let k = 0; k < 3; k++) {
    const w = s * (0.42 - k * 0.1), top = y - s * (0.45 + k * 0.32), base = y - s * (0.05 + k * 0.28);
    c.fillStyle = ['#2f5e3e', '#3a7048', '#4a8656'][k]; c.beginPath(); c.moveTo(x, top); c.lineTo(x + w, base); c.lineTo(x - w, base); c.closePath(); c.fill();
  }
  c.fillStyle = 'rgba(255, 255, 255, 0.12)'; c.beginPath(); c.moveTo(x, y - s * 1.09); c.lineTo(x - s * 0.12, y - s * 0.8); c.lineTo(x, y - s * 0.84); c.fill();
}
function houseAt(c: CanvasRenderingContext2D, x: number, y: number, s: number, roof: string, wall = '#fbf0dc') {
  const w = s * 0.62, h = s * 0.42, rh = s * 0.42;
  blob(c, x + s * 0.18, y + s * 0.06, w * 0.75, s * 0.18, 'rgba(30, 40, 30, 0.22)');
  c.fillStyle = wall; c.fillRect(x - w / 2, y - h, w, h);
  c.fillStyle = 'rgba(0, 0, 0, 0.08)'; c.fillRect(x + w * 0.1, y - h, w * 0.4, h);
  c.fillStyle = roof; c.beginPath(); c.moveTo(x - w * 0.62, y - h + 1); c.lineTo(x - w * 0.36, y - h - rh); c.lineTo(x + w * 0.36, y - h - rh); c.lineTo(x + w * 0.62, y - h + 1); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255, 255, 255, 0.18)'; c.beginPath(); c.moveTo(x - w * 0.62, y - h + 1); c.lineTo(x - w * 0.36, y - h - rh); c.lineTo(x - w * 0.1, y - h - rh); c.lineTo(x - w * 0.3, y - h + 1); c.fill();
  c.fillStyle = '#7a4a2a'; c.fillRect(x - w * 0.08, y - h * 0.55, w * 0.16, h * 0.55);
  c.fillStyle = '#9fd0e8'; c.fillRect(x - w * 0.36, y - h * 0.82, w * 0.16, h * 0.26); c.fillRect(x + w * 0.2, y - h * 0.82, w * 0.16, h * 0.26);
  c.fillStyle = '#8a6a5a'; c.fillRect(x + w * 0.22, y - h - rh * 0.9, w * 0.12, rh * 0.5);
}
/** Paints one landmark or tree of an island stand-in, in island-local units. */
function feature(c: CanvasRenderingContext2D, f: Feat) {
  const { x, y, s } = f;
  switch (f.k) {
    case 'tree': tree(c, x, y, s); break;
    case 'blossom': tree(c, x, y, s, ['#d98aa6', '#f2b4c8', '#ffe2ec']); for (let i = 0; i < 5; i++) blob(c, x + (hash(x | 0, i) - 0.5) * s * 0.7, y - s * 0.45 + (hash(y | 0, i) - 0.5) * s * 0.5, s * 0.05, s * 0.05, '#fff6fa'); break;
    case 'pine': pine(c, x, y, s); break;
    case 'house': houseAt(c, x, y, s, f.c ?? '#c9693a'); break;
    case 'post': {
      houseAt(c, x, y, s, '#d9473e', '#fff6e6');
      c.fillStyle = '#f4d24a'; c.fillRect(x - s * 0.1, y - s * 0.48, s * 0.2, s * 0.08);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + s * 0.42, y); c.lineTo(x + s * 0.42, y - s * 0.95); c.stroke();
      c.fillStyle = '#d9473e'; c.beginPath(); c.moveTo(x + s * 0.42, y - s * 0.95); c.lineTo(x + s * 0.68, y - s * 0.86); c.lineTo(x + s * 0.42, y - s * 0.77); c.fill(); break;
    }
    case 'burrow': blob(c, x, y, s * 0.6, s * 0.4, '#8fc46c'); blob(c, x, y - s * 0.05, s * 0.4, s * 0.26, '#a8d880'); blob(c, x, y + s * 0.05, s * 0.18, s * 0.14, '#5a3a22'); c.fillStyle = '#e8b04a'; c.fillRect(x - 2, y - 1, 4, 4); break;
    case 'boathouse': c.fillStyle = '#8a6040'; c.fillRect(x - s * 0.4, y - s * 0.5, s * 0.8, s * 0.5); c.fillStyle = '#5a7aa0'; c.beginPath(); c.moveTo(x - s * 0.5, y - s * 0.5); c.lineTo(x, y - s * 0.85); c.lineTo(x + s * 0.5, y - s * 0.5); c.fill(); c.fillStyle = '#3a2a1a'; c.fillRect(x - s * 0.18, y - s * 0.32, s * 0.36, s * 0.32); break;
    case 'lighthouse': {
      blob(c, x + 24, y + 6, 30, 10, 'rgba(20, 30, 40, 0.25)');
      const h = 92, w0 = 15, w1 = 10;
      for (let k = 0; k < 5; k++) {
        const t0 = k / 5, t1 = (k + 1) / 5, ya = y - h * t0, yb = y - h * t1, wa = w0 + (w1 - w0) * t0, wb = w0 + (w1 - w0) * t1;
        c.fillStyle = k % 2 ? '#d8423a' : '#fbf6ee'; c.beginPath(); c.moveTo(x - wa, ya); c.lineTo(x - wb, yb); c.lineTo(x + wb, yb); c.lineTo(x + wa, ya); c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(0, 0, 0, 0.12)'; c.beginPath(); c.moveTo(x + 3, y); c.lineTo(x + 3, y - h); c.lineTo(x + w1, y - h); c.lineTo(x + w0, y); c.fill();
      c.fillStyle = '#3a3a48'; c.fillRect(x - 14, y - h - 3, 28, 5);
      c.fillStyle = '#fff3b0'; c.fillRect(x - 8, y - h - 15, 16, 12);
      c.fillStyle = '#d8423a'; c.beginPath(); c.moveTo(x - 11, y - h - 15); c.lineTo(x, y - h - 26); c.lineTo(x + 11, y - h - 15); c.fill(); break;
    }
    case 'windmill': {
      blob(c, x + 20, y + 4, 26, 9, 'rgba(30, 40, 30, 0.22)');
      c.fillStyle = '#f3e6cc'; c.beginPath(); c.moveTo(x - 17, y); c.lineTo(x - 10, y - 66); c.lineTo(x + 10, y - 66); c.lineTo(x + 17, y); c.fill();
      c.fillStyle = 'rgba(0, 0, 0, 0.08)'; c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + 2, y - 66); c.lineTo(x + 10, y - 66); c.lineTo(x + 17, y); c.fill();
      c.fillStyle = '#9a5a3a'; c.beginPath(); c.ellipse(x, y - 68, 13, 9, 0, Math.PI, 0); c.fill(); c.fillStyle = '#7a4a2a'; c.fillRect(x - 4, y - 18, 8, 18); break;
    }
    case 'wheat': for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#e8c060' : '#f2d27a'; c.fillRect(x - s * 0.5, y - s * 0.3 + i * s * 0.1, s, s * 0.08); } break;
    case 'slip': { c.fillStyle = '#a07a50'; c.save(); c.translate(x, y); c.rotate(0.12); c.fillRect(-s * 0.5, -10, s, 20); c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.5; for (let i = -s * 0.5; i < s * 0.5; i += 7) { c.beginPath(); c.moveTo(i, -10); c.lineTo(i, 10); c.stroke(); }
      c.fillStyle = '#c9a070'; c.beginPath(); c.moveTo(-s * 0.35, -6); c.quadraticCurveTo(-s * 0.05, -14, s * 0.15, 0); c.quadraticCurveTo(-s * 0.05, 14, -s * 0.35, 6); c.fill(); c.restore(); break; }
    case 'crane': c.strokeStyle = '#6a4a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x, y - 52); c.lineTo(x + 12, y); c.moveTo(x, y - 52); c.lineTo(x + 40, y - 40); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 40, y - 40); c.lineTo(x + 40, y - 20); c.stroke(); c.fillStyle = '#5a5a6a'; c.fillRect(x + 35, y - 20, 10, 8); break;
    case 'timber': for (let i = 0; i < 3; i++) { c.fillStyle = ['#b08050', '#c49464', '#a07040'][i]; c.fillRect(x - s * 0.5, y - i * 6 - 6, s, 6); c.fillStyle = '#e0c090'; blob(c, x - s * 0.5, y - i * 6 - 3, 2.5, 3, '#e0c090'); } break;
    case 'pond': blob(c, x, y, s * 0.6, s * 0.36, '#5aa8b8'); blob(c, x - s * 0.1, y - s * 0.05, s * 0.4, s * 0.2, '#7cc4cc'); for (let i = 0; i < 3; i++) blob(c, x + (i - 1) * s * 0.3, y + s * 0.05 * i, 5, 3.5, '#5a9a4a'); break;
    case 'stilt': c.strokeStyle = '#5a4030'; c.lineWidth = 3; for (const dx of [-10, 10]) { c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx, y - 14); c.stroke(); } houseAt(c, x, y - 14, s, '#8aa060', f.c); break;
    case 'reed': c.strokeStyle = '#5a7a3a'; c.lineWidth = 1.6; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 2, y); c.quadraticCurveTo(x + i * 3, y - s * 0.6, x + i * 4.5, y - s); c.stroke(); } blob(c, x + 4, y - s * 0.9, 1.8, 4, '#7a4a2a'); break;
    case 'hives': for (let i = 0; i < 3; i++) { const hx = x + (i - 1) * 16; c.fillStyle = '#f4d070'; c.fillRect(hx - 6, y - 14, 12, 14); c.fillStyle = '#d8a840'; c.fillRect(hx - 6, y - 9, 12, 2); c.fillStyle = '#8a5a3a'; c.fillRect(hx - 7, y - 16, 14, 3); } break;
    case 'stall': { c.fillStyle = '#a07a50'; c.fillRect(x - 12, y - 12, 24, 12); for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#ffffff' : (f.c ?? '#e05a5a'); c.fillRect(x - 14 + i * 7, y - 22, 7, 10); } c.fillStyle = '#f0a040'; blob(c, x - 4, y - 8, 3, 2, '#f0a040'); blob(c, x + 4, y - 8, 3, 2, '#7ac050'); break; }
    case 'well': blob(c, x, y, 12, 8, '#9a9488'); blob(c, x, y - 1, 8, 5, '#3a6a8a'); break;
    case 'crag': {
      blob(c, x + 26, y + 18, s * 0.7, s * 0.3, 'rgba(20, 30, 40, 0.25)');
      const layers = [['#8d8a86', 1, 0], ['#a29f99', 0.78, -28], ['#b6b2ab', 0.56, -56], ['#c8c4bc', 0.34, -84]] as const;
      for (const [col, k, dy] of layers) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y + dy, s * 0.62 * k, s * 0.42 * k, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(0, 0, 0, 0.08)'; c.beginPath(); c.ellipse(x + s * 0.12 * k, y + dy + 4, s * 0.5 * k, s * 0.3 * k, 0, 0, Math.PI); c.fill(); }
      break;
    }
    case 'nest': blob(c, x, y, s * 0.6, s * 0.36, '#8a6038'); blob(c, x, y - 2, s * 0.42, s * 0.22, '#5a3a20'); blob(c, x - 4, y - 3, 4, 3, '#eef4f8'); blob(c, x + 4, y - 2, 4, 3, '#eef4f8'); break;
    case 'hill': { const g = c.createRadialGradient(x - s * 0.2, y - s * 0.25, 4, x, y, s * 0.6); g.addColorStop(0, '#b8e28a'); g.addColorStop(1, '#78b05a'); blob(c, x, y, s * 0.6, s * 0.46, g); break; }
    case 'hole': blob(c, x, y, s * 0.9, s * 0.6, '#5a3e26'); blob(c, x, y + 1, s * 0.6, s * 0.36, '#2e1e12'); break;
    case 'bridge': c.save(); c.translate(x, y); c.rotate(0.15); c.fillStyle = '#a07a50'; c.fillRect(-s * 0.6, -6, s * 1.2, 12); c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; c.strokeRect(-s * 0.6, -6, s * 1.2, 12); c.restore(); break;
    case 'dome': {
      c.fillStyle = '#8a7a6a'; c.fillRect(x - 22, y - 26, 44, 26);
      const g = c.createLinearGradient(x - 24, 0, x + 24, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b8c4d8');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y - 26, 24, 22, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#3a4a6a'; c.fillRect(x - 3, y - 47, 6, 18);
      c.strokeStyle = '#6a5a4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y - 40); c.lineTo(x + 18, y - 58); c.stroke(); break;
    }
    case 'palm': {
      blob(c, x + 18, y + 4, 22, 8, 'rgba(30, 40, 30, 0.22)');
      c.strokeStyle = '#8a6a40'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 22, x + 4, y - 40); c.stroke();
      c.strokeStyle = '#4a9a48'; c.lineWidth = 5; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(x + 4, y - 40); c.quadraticCurveTo(x + 4 + Math.cos(a) * 14, y - 46 + Math.sin(a) * 8, x + 4 + Math.cos(a) * 24, y - 36 + Math.sin(a) * 12); c.stroke(); }
      c.lineCap = 'butt'; break;
    }
    case 'boulder': blob(c, x + 3, y + 3, s, s * 0.7, 'rgba(20, 30, 40, 0.2)'); blob(c, x, y, s, s * 0.75, '#9a958c'); blob(c, x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.3, '#bdb8ae'); break;
    case 'pebble': blob(c, x, y, s * 0.6, s * 0.45, ['#b8b0a4', '#a49a8c', '#c8c0b0'][(s | 0) % 3]); break;
    case 'shellbit': blob(c, x, y, s * 0.6, s * 0.5, f.c ?? '#f4c0c8'); break;
    case 'gull': c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 6, y); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 6, y); c.stroke(); break;
    case 'birdhouse': c.fillStyle = '#6a4a2a'; c.fillRect(x - 2, y - 30, 4, 30); c.fillStyle = '#e0a050'; c.fillRect(x - 9, y - 44, 18, 14); c.fillStyle = '#c0503a'; c.beginPath(); c.moveTo(x - 12, y - 44); c.lineTo(x, y - 54); c.lineTo(x + 12, y - 44); c.fill(); blob(c, x, y - 38, 3, 3, '#3a2a1a'); break;
  }
}

/** Paints an island stand-in into an offscreen canvas at `k` pixels a unit; returns it with the island middle's offset. */
function paintIslandStandIn(isl: Island, k: number) {
  const pad = 70, size = (isl.reach + pad) * 2, cv = mk(size * k, size * k), c = ctx2(cv), local = isl.poly.map(([x, y]) => [x - isl.x, y - isl.y] as Pt), look = lookOf(isl);
  c.scale(k, k); c.translate(size / 2, size / 2);
  // wet sand, dry sand, then the island's ground
  c.beginPath(); smoothPath(c, offsetPoly(local, 4)); c.fillStyle = '#d8c28c'; c.fill();
  c.beginPath(); smoothPath(c, local); const sand = c.createRadialGradient(-isl.reach * 0.3, -isl.reach * 0.3, 10, 0, 0, isl.reach); sand.addColorStop(0, '#fbecc0'); sand.addColorStop(1, '#ecd59c'); c.fillStyle = sand; c.fill();
  const groundCols: Record<IslandLook['ground'], [string, string, string]> = { grass: ['#a8da7c', '#6eae56', '#5a9a48'], rock: ['#c4beb4', '#948e84', '#7a756d'], marsh: ['#9ec67a', '#6a9a58', '#557f46'], sand: ['#fbecc0', '#ecd59c', '#d8c28c'] };
  const [g0, g1, g2] = groundCols[look.ground];
  if (look.ground !== 'sand') {
    const inset = offsetPoly(local, -Math.min(26, isl.reach * 0.2)).map(([x, y], i) => { const w = 1 + (hash(i, 77) - 0.5) * 0.06; return [x * w, y * w] as Pt; });
    c.beginPath(); smoothPath(c, inset); const gr = c.createRadialGradient(-isl.reach * 0.35, -isl.reach * 0.4, 6, 0, 0, isl.reach); gr.addColorStop(0, g0); gr.addColorStop(1, g1);
    c.fillStyle = gr; c.fill(); c.strokeStyle = g2; c.lineWidth = 3; c.stroke();
    // tufts and texture
    c.save(); c.clip();
    for (let i = 0; i < Math.round(isl.reach * 0.5); i++) {
      const a = hash(i, 3) * TAU, d = Math.sqrt(hash(i, 4)) * isl.reach, x = Math.cos(a) * d, y = Math.sin(a) * d;
      if (look.ground === 'rock') { c.strokeStyle = 'rgba(60, 50, 40, 0.25)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 7, y + 3); c.lineTo(x + 10, y + 1); c.stroke(); }
      else { c.strokeStyle = hash(i, 5) < 0.5 ? 'rgba(60, 110, 50, 0.4)' : 'rgba(200, 240, 160, 0.35)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 2, y - 5); c.stroke(); }
    }
    c.restore();
  }
  for (const f of look.feats) feature(c, f);
  return { cv, half: size / 2 };
}

// ---------------------------------------------------------------- portraits and paintings
type Who = ResidentId | 'dora' | 'enzo';
const TUFT: Coat = coatLike('enzo', { fur: '#b4b0b8', back: '#9a96a0', face: '#c8c4cc', shade: '#a09ca6', belly: '#f2eef0', tail: '#b0acb6', tailOuter: '#9a96a0', bands: false });
/** A resident's chest-up portrait stand-in: a soft circle background and the critter, with their signature props. */
export function paintPortrait(cv: HTMLCanvasElement, who: Who, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const s = Math.min(W, H) / 100; c.save(); c.scale(s, s);
  const bgc: Record<string, [string, string]> = { pip: ['#d8ecf6', '#9ac4dc'], grisel: ['#e6ecf2', '#aab8c8'], clover: ['#fbe6ee', '#e8b4c4'], bramble: ['#fdf0e0', '#f2c8a4'], bun: ['#fbf0dc', '#ecd2a4'], tamsin: ['#f2e6d6', '#d4b494'], quill: ['#e4e2f6', '#a8a4d8'], dabble: ['#fdf4d4', '#f2d88a'], mossy: ['#e2f4dc', '#a8d494'] };
  const [b0, b1] = bgc[who] ?? ['#fdf4e6', '#f0d8b8'];
  const bg = c.createRadialGradient(50, 40, 6, 50, 50, 62); bg.addColorStop(0, b0); bg.addColorStop(1, b1); c.fillStyle = bg; c.fillRect(0, 0, 100, 100);
  const eye = (x: number, y: number, r = 2.6) => { blob(c, x, y, r, r * 1.1, '#1a1418'); blob(c, x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.35, '#ffffff'); };
  const body = (col: string, shade: string) => { blob(c, 50, 104, 34, 30, col); blob(c, 58, 108, 26, 24, shade); };
  const ln = (col: string, w: number) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; };
  switch (who) {
    case 'duo': case 'dora': case 'enzo': case 'tuft': {
      if (who === 'duo') {
        // side by side, nose to nose
        drawChinchilla(c, 'enzo', 70, 90, { face: -1, h: 38, time: t + 1 }); drawChinchilla(c, 'dora', 30, 92, { face: 1, h: 36, time: t });
      } else if (who === 'tuft') {
        drawChinchilla(c, TUFT, 50, 98, { face: 1, h: 64, time: t, decorate: (q) => { q.strokeStyle = '#6a4a2a'; q.lineWidth = 0.7; q.beginPath(); q.arc(5.2, -15.5, 1.7, 0, TAU); q.moveTo(7, -15.5); q.arc(8.8, -15.5, 1.7, Math.PI, Math.PI * 3); q.stroke(); } });
        c.fillStyle = '#b05a8a'; c.beginPath(); c.ellipse(50, 90, 22, 7, 0, 0, TAU); c.fill();
      } else drawChinchilla(c, who, 50, 98, { face: who === 'dora' ? 1 : -1, h: 64, time: t });
      break;
    }
    case 'pip': { // the otter: sleek brown, small round ears, white whiskers, knitted cap
      body('#8a5a3a', '#7a4a2e'); blob(c, 50, 92, 16, 12, '#e8d4b4');
      blob(c, 50, 56, 26, 24, '#8a5a3a'); blob(c, 50, 66, 16, 11, '#e8d4b4'); blob(c, 28, 50, 5, 5, '#6a4028'); blob(c, 72, 50, 5, 5, '#6a4028');
      eye(41, 56); eye(59, 56); blob(c, 50, 64, 5, 3.5, '#3a2418');
      ln('#f4ece0', 0.8); for (const d of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(50 + d * 6, 66 + k); c.lineTo(50 + d * 22, 63 + k * 3); c.stroke(); }
      c.fillStyle = '#c84a3a'; c.beginPath(); c.ellipse(50, 38, 25, 13, 0, Math.PI, 0); c.fill(); c.fillStyle = '#f0e0c8'; c.fillRect(25, 36, 50, 5); blob(c, 50, 24, 5, 5, '#f0e0c8'); break;
    }
    case 'grisel': { // the heron: grey, long beak, spectacles, a crest
      body('#a8b0bc', '#949cab'); blob(c, 50, 90, 10, 16, '#e4e8ee');
      ln('#a8b0bc', 14); c.beginPath(); c.moveTo(50, 92); c.quadraticCurveTo(40, 70, 46, 50); c.stroke();
      blob(c, 48, 44, 15, 13, '#c4cad4'); c.fillStyle = '#e8b040'; c.beginPath(); c.moveTo(58, 42); c.lineTo(94, 48); c.lineTo(58, 50); c.closePath(); c.fill();
      ln('#2a2a34', 3); c.beginPath(); c.moveTo(40, 34); c.quadraticCurveTo(30, 26, 22, 30); c.stroke();
      eye(50, 42, 2.2); ln('#3a3a48', 1.4); c.beginPath(); c.arc(50, 42, 5, 0, TAU); c.moveTo(55, 42); c.lineTo(60, 41); c.stroke();
      ln('#3a3a48', 1.6); c.beginPath(); c.moveTo(44, 37); c.lineTo(55, 38.5); c.stroke(); break;
    }
    case 'clover': case 'bramble': { // the rabbits: long ears; Clover's scarf, Bramble's flower
      const fur = who === 'clover' ? '#c8b8a8' : '#e8dcd0', dark = who === 'clover' ? '#a89888' : '#c8bcb0';
      body(fur, dark);
      for (const d of [-1, 1]) { c.save(); c.translate(50 + d * 10, 36); c.rotate(d * 0.18); blob(c, 0, -18, 7, 20, fur); blob(c, 0, -17, 3.5, 15, '#f4b8c4'); c.restore(); }
      blob(c, 50, 58, 22, 20, fur); blob(c, 50, 66, 11, 8, '#f8f0ea'); eye(42, 56, 2.8); eye(58, 56, 2.8); blob(c, 50, 63, 2.6, 2, '#e88a9a');
      blob(c, 38, 64, 4, 2.5, 'rgba(240, 140, 160, 0.4)'); blob(c, 62, 64, 4, 2.5, 'rgba(240, 140, 160, 0.4)');
      if (who === 'clover') { c.fillStyle = '#4a8ad0'; c.beginPath(); c.ellipse(50, 80, 22, 7, 0, 0, TAU); c.fill(); c.fillRect(58, 80, 8, 18); c.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) c.fillRect(34 + i * 9, 79, 3, 3); }
      else { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; blob(c, 66 + Math.cos(a) * 4.5, 40 + Math.sin(a) * 4.5, 3.6, 3.6, '#f472a0'); } blob(c, 66, 40, 2.6, 2.6, '#ffd84a'); }
      break;
    }
    case 'bun': { // the baker mole: velvet dark, pink nose, flour, apron
      body('#4a4250', '#3e3644'); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(34, 80); c.lineTo(66, 80); c.lineTo(70, 100); c.lineTo(30, 100); c.fill();
      blob(c, 50, 58, 24, 22, '#4a4250'); blob(c, 50, 70, 8, 6, '#f2a0b0'); blob(c, 50, 69, 4, 2.5, '#e07a90');
      blob(c, 42, 56, 1.8, 1.2, '#1a1418'); blob(c, 58, 56, 1.8, 1.2, '#1a1418');
      blob(c, 46, 70, 4, 2, 'rgba(255, 255, 255, 0.85)'); blob(c, 40, 44, 5, 3, 'rgba(255, 255, 255, 0.7)');
      blob(c, 28, 90, 7, 5, '#f2a0b0'); blob(c, 72, 90, 7, 5, '#f2a0b0'); break;
    }
    case 'tamsin': { // the beaver: brown, buck teeth, tool belt
      body('#9a6a40', '#8a5a34'); c.fillStyle = '#6a4a2a'; c.fillRect(22, 92, 56, 8); c.fillStyle = '#c8c8d0'; c.fillRect(30, 88, 4, 12); c.fillStyle = '#d8a040'; c.fillRect(62, 86, 6, 14);
      blob(c, 50, 58, 26, 23, '#9a6a40'); blob(c, 30, 40, 5, 5, '#7a4a2a'); blob(c, 70, 40, 5, 5, '#7a4a2a'); blob(c, 50, 68, 13, 9, '#c8a07a');
      eye(41, 54); eye(59, 54); blob(c, 50, 63, 5, 3.5, '#2a1a12');
      c.fillStyle = '#fffaf0'; c.fillRect(46, 70, 3.8, 6); c.fillRect(50.2, 70, 3.8, 6); c.strokeStyle = '#c8b8a0'; c.lineWidth = 0.6; c.strokeRect(46, 70, 8, 6);
      c.fillStyle = '#e8c040'; c.beginPath(); c.ellipse(50, 36, 22, 9, 0, Math.PI, 0); c.fill(); break;
    }
    case 'quill': { // the hedgehog: spines, tiny round glasses
      c.fillStyle = '#6a5040';
      for (let i = 0; i < 18; i++) { const a = Math.PI * (1.05 + (i / 17) * 0.9), r0 = 24, r1 = 38 + (i % 2) * 5; c.beginPath(); c.moveTo(50 + Math.cos(a - 0.12) * r0, 60 + Math.sin(a - 0.12) * r0); c.lineTo(50 + Math.cos(a) * r1, 60 + Math.sin(a) * r1); c.lineTo(50 + Math.cos(a + 0.12) * r0, 60 + Math.sin(a + 0.12) * r0); c.fill(); }
      body('#8a7060', '#7a6050'); blob(c, 50, 60, 26, 24, '#6a5040'); blob(c, 50, 64, 19, 17, '#e8d4bc'); blob(c, 50, 70, 4, 3, '#2a1a14');
      eye(43, 60, 2.2); eye(57, 60, 2.2); ln('#c8a040', 1.3); c.beginPath(); c.arc(43, 60, 4.5, 0, TAU); c.moveTo(61.5, 60); c.arc(57, 60, 4.5, 0, TAU); c.moveTo(47.5, 60); c.lineTo(52.5, 60); c.stroke();
      c.fillStyle = '#3a3a7a'; c.fillRect(30, 88, 40, 12); for (let i = 0; i < 5; i++) blob(c, 36 + i * 7, 93, 1.2, 1.2, '#ffe880'); break;
    }
    case 'dabble': { // the market duck: white, yellow bill, straw hat
      body('#f8f8f2', '#e4e4dc'); blob(c, 50, 58, 22, 21, '#f8f8f2');
      c.fillStyle = '#f0a030'; c.beginPath(); c.ellipse(50, 68, 13, 6, 0, 0, TAU); c.fill(); c.fillStyle = '#d88a20'; c.fillRect(38, 68, 24, 1.4);
      eye(42, 56, 2.4); eye(58, 56, 2.4);
      c.fillStyle = '#e8c070'; c.beginPath(); c.ellipse(50, 40, 32, 8, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(50, 34, 17, 12, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#d8423a'; c.fillRect(33, 33, 34, 4); break;
    }
    case 'mossy': { // the frog: green, wide smile, conductor's bow tie
      body('#6aae58', '#5a9a4a'); blob(c, 50, 62, 28, 20, '#78bc64'); blob(c, 50, 70, 18, 9, '#d8f0b8');
      for (const d of [-1, 1]) { blob(c, 50 + d * 14, 44, 9, 9, '#78bc64'); blob(c, 50 + d * 14, 44, 6, 6, '#ffffff'); eye(50 + d * 14, 45, 3); }
      ln('#2a4a22', 1.6); c.beginPath(); c.moveTo(34, 64); c.quadraticCurveTo(50, 74, 66, 64); c.stroke();
      c.fillStyle = '#c03a4a'; c.beginPath(); c.moveTo(50, 84); c.lineTo(38, 78); c.lineTo(38, 90); c.closePath(); c.moveTo(50, 84); c.lineTo(62, 78); c.lineTo(62, 90); c.closePath(); c.fill(); blob(c, 50, 84, 3, 3, '#a02a3a'); break;
    }
  }
  c.restore();
}
/** An island card's painting stand-in: the island on its little patch of lake. */
export function paintIsland(cv: HTMLCanvasElement, id: IslandId, t = 0) {
  const c = ctx2(cv), W = cv.width, H = cv.height, isl = ISLAND[id];
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, '#7ad8cc'); g.addColorStop(0.45, '#3faac2'); g.addColorStop(1, '#24709e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = hash(i, 1) * W, y = hash(i, 2) * H, w = 6 + hash(i, 3) * 14; c.strokeStyle = 'rgba(255, 255, 255, 0.28)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - 3 - Math.sin(t + i) * 1.5, x + w, y); c.stroke(); }
  const { cv: art, half } = paintIslandStandIn(isl, 1), k = Math.min(W, H) / (half * 2) * 1.08;
  c.drawImage(art, W / 2 - half * k, H / 2 - half * k * 0.98, half * 2 * k, half * 2 * k);
}

/** The title painting's stand-in: the little post boat on a sparkling lake, islands and a lighthouse behind. */
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height; c.setTransform(1, 0, 0, 1, 0, 0);
  const sky = c.createLinearGradient(0, 0, 0, H * 0.5); sky.addColorStop(0, '#8fd0f0'); sky.addColorStop(1, '#f8e8d0'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
  blob(c, W * 0.78, H * 0.16, W * 0.05, W * 0.05, '#fff6d0'); blob(c, W * 0.78, H * 0.16, W * 0.09, W * 0.09, 'rgba(255, 246, 208, 0.3)');
  for (let i = 0; i < 4; i++) { const x = W * (0.12 + i * 0.24), y = H * (0.12 + (i % 2) * 0.06); for (let k = 0; k < 4; k++) blob(c, x + k * W * 0.025, y - (k % 2) * H * 0.012, W * 0.035, H * 0.03, 'rgba(255, 255, 255, 0.85)'); }
  const water = c.createLinearGradient(0, H * 0.46, 0, H); water.addColorStop(0, '#5cc4d0'); water.addColorStop(1, '#2a7aae'); c.fillStyle = water; c.fillRect(0, H * 0.46, W, H * 0.54);
  // far islands and the lighthouse
  const isle = (x: number, w: number, h: number, col: string) => { blob(c, x, H * 0.47, w, h, col); };
  isle(W * 0.14, W * 0.13, H * 0.06, '#7ab868'); isle(W * 0.46, W * 0.1, H * 0.045, '#86c070'); isle(W * 0.86, W * 0.16, H * 0.07, '#6aa85c');
  c.fillStyle = '#c8c4bc'; blob(c, W * 0.62, H * 0.47, W * 0.06, H * 0.035, '#a8a49c');
  for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#d8423a' : '#fbf6ee'; c.fillRect(W * 0.61, H * (0.44 - k * 0.03), W * 0.02, H * 0.03); }
  c.fillStyle = '#fff3b0'; c.fillRect(W * 0.608, H * 0.305, W * 0.024, H * 0.022); c.fillStyle = '#d8423a'; c.beginPath(); c.moveTo(W * 0.604, H * 0.305); c.lineTo(W * 0.62, H * 0.28); c.lineTo(W * 0.636, H * 0.305); c.fill();
  for (let i = 0; i < 3; i++) { const hx = W * (0.08 + i * 0.05), hy = H * 0.44; c.fillStyle = '#fbf0dc'; c.fillRect(hx, hy - H * 0.025, W * 0.025, H * 0.025); c.fillStyle = ['#d9473e', '#7a8ac0', '#c9693a'][i]; c.beginPath(); c.moveTo(hx - W * 0.005, hy - H * 0.025); c.lineTo(hx + W * 0.0125, hy - H * 0.045); c.lineTo(hx + W * 0.03, hy - H * 0.025); c.fill(); }
  // sparkles
  for (let i = 0; i < 90; i++) { const x = hash(i, 9) * W, y = H * 0.5 + hash(i, 10) * H * 0.5, w = 4 + hash(i, 11) * 10; c.strokeStyle = `rgba(255, 255, 255, ${0.25 + hash(i, 12) * 0.4})`; c.lineWidth = Math.max(1, W / 600); c.beginPath(); c.moveTo(x - w, y); c.lineTo(x + w, y); c.stroke(); }
  // gulls
  c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.5, W / 400);
  for (const [gx, gy, gs] of [[0.3, 0.22, 1], [0.36, 0.18, 0.7], [0.68, 0.24, 0.8]]) { const x = W * gx, y = H * gy, s = W * 0.018 * gs; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y); c.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y); c.stroke(); }
  paintSideBoat(c, W * 0.5, H * 0.72, W / 1200, t, true);
}
/** The boat seen side-on, for the title and ending: hull, patched sail, Dora at the tiller and Enzo at the mast. */
function paintSideBoat(c: CanvasRenderingContext2D, x: number, y: number, k: number, t: number, wave: boolean, lantern = false) {
  c.save(); c.translate(x, y); c.scale(k, k); c.rotate(Math.sin(t * 2) * 0.02);
  blob(c, 0, 26, 230, 18, 'rgba(10, 40, 70, 0.25)');
  // sail
  c.fillStyle = '#fbf2dc'; c.beginPath(); c.moveTo(-10, -250); c.quadraticCurveTo(110, -150, 150, -20); c.lineTo(-10, -20); c.closePath(); c.fill();
  c.strokeStyle = '#c8b48a'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#f2c8a0'; c.fillRect(30, -130, 34, 30); c.fillStyle = '#c8dcec'; c.fillRect(60, -70, 30, 26);
  c.strokeStyle = '#a08060'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.strokeRect(30, -130, 34, 30); c.strokeRect(60, -70, 30, 26); c.setLineDash([]);
  c.fillStyle = '#7a5a3a'; c.fillRect(-16, -262, 9, 250); c.fillRect(-16, -26, 175, 8);
  c.fillStyle = '#d8423a'; c.beginPath(); c.moveTo(-8, -262); c.lineTo(-50, -252); c.lineTo(-8, -244); c.fill();
  // hull: weathered planks
  const hull = c.createLinearGradient(0, -10, 0, 40); hull.addColorStop(0, '#b89a78'); hull.addColorStop(1, '#7a5e44');
  c.fillStyle = hull; c.beginPath(); c.moveTo(-200, -12); c.lineTo(210, -18); c.quadraticCurveTo(190, 30, 120, 36); c.lineTo(-150, 36); c.quadraticCurveTo(-200, 24, -200, -12); c.closePath(); c.fill();
  c.strokeStyle = '#5a4430'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(70, 50, 30, 0.45)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-195, -2 + i * 12); c.lineTo(200, -8 + i * 12); c.stroke(); }
  c.fillStyle = '#e8d8b8'; c.fillRect(-206, -18, 420, 7);
  c.fillStyle = '#c84a3a'; c.fillRect(30, -48, 60, 34); c.fillStyle = '#fff6e0'; c.fillRect(38, -42, 22, 14); c.fillRect(64, -40, 20, 12);
  drawChinchilla(c, 'dora', -140, -14, { face: 1, h: 92, time: t, decorate: wave ? (q, bob) => { q.fillStyle = '#ffffff'; q.strokeStyle = '#c8b8a0'; q.lineWidth = 0.4; q.save(); q.translate(10, -19 + bob + Math.sin(t * 6) * 0.6); q.rotate(-0.3); q.fillRect(-3, -2, 6, 4); q.strokeRect(-3, -2, 6, 4); q.beginPath(); q.moveTo(-3, -2); q.lineTo(0, 0.4); q.lineTo(3, -2); q.stroke(); q.restore(); } : undefined });
  drawChinchilla(c, 'enzo', -40, -14, { face: 1, h: 96, time: t + 0.7 });
  if (lantern) { blob(c, 170, -60, 40, 40, 'rgba(255, 200, 100, 0.35)'); c.fillStyle = '#ffd36a'; c.fillRect(162, -72, 16, 22); c.strokeStyle = '#5a4430'; c.lineWidth = 3; c.beginPath(); c.moveTo(170, -72); c.lineTo(170, -110); c.stroke(); }
  c.restore();
}
/** The ending's stand-in: the Lantern Regatta at night, every island glowing and the lake full of lanterns. */
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height, HZN = H * 0.5; c.setTransform(1, 0, 0, 1, 0, 0);
  const sky = c.createLinearGradient(0, 0, 0, HZN); sky.addColorStop(0, '#0a1034'); sky.addColorStop(0.7, '#2a2c6a'); sky.addColorStop(1, '#6a4a7a'); c.fillStyle = sky; c.fillRect(0, 0, W, HZN + 2);
  for (let i = 0; i < 150; i++) { const r = (0.6 + hash(i, 3) * 1.4) * W / 1200; blob(c, hash(i, 1) * W, hash(i, 2) * HZN * 0.9, r, r, `rgba(255, 255, 240, ${0.3 + hash(i, 4) * 0.7})`); }
  // fireworks: a soft glow, then sparks that droop as they fall
  for (const [fx, fy, col, rr] of [[0.2, 0.15, '255, 190, 120', 0.07], [0.5, 0.1, '255, 150, 200', 0.055], [0.78, 0.2, '170, 210, 255', 0.065], [0.36, 0.3, '255, 230, 140', 0.035]] as const) {
    const cx = W * fx, cy = H * fy, r = W * rr, glow = c.createRadialGradient(cx, cy, 0, cx, cy, r * 1.3);
    glow.addColorStop(0, `rgba(${col}, 0.35)`); glow.addColorStop(1, `rgba(${col}, 0)`); c.fillStyle = glow; c.fillRect(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU + hash(k, fx * 100) * 0.1, L = r * (0.75 + hash(k, 3) * 0.3), ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L + L * 0.18;
      c.strokeStyle = `rgba(${col}, 0.55)`; c.lineWidth = W / 700; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx + Math.cos(a) * L * 0.35, cy + Math.sin(a) * L * 0.35); c.quadraticCurveTo(cx + Math.cos(a) * L * 0.8, cy + Math.sin(a) * L * 0.8, ex, ey); c.stroke();
      blob(c, ex, ey, W / 500, W / 500, `rgba(${col}, 0.95)`);
    }
  }
  const water = c.createLinearGradient(0, HZN, 0, H); water.addColorStop(0, '#2a2a5e'); water.addColorStop(0.3, '#18225a'); water.addColorStop(1, '#0a1030'); c.fillStyle = water; c.fillRect(0, HZN, W, H - HZN);
  // the lighthouse beam swings across the sky
  const lx = W * 0.6, ly = H * 0.3;
  const beam = c.createLinearGradient(lx, ly, W * 0.05, ly); beam.addColorStop(0, 'rgba(255, 244, 190, 0.55)'); beam.addColorStop(1, 'rgba(255, 244, 190, 0)');
  c.fillStyle = beam; c.beginPath(); c.moveTo(lx, ly); c.lineTo(W * 0.02, H * 0.18); c.lineTo(W * 0.02, H * 0.33); c.closePath(); c.fill();
  // islands along the horizon, strung with lanterns, windows lit
  for (const [ix, iw, ih] of [[0.1, 0.14, 0.06], [0.36, 0.09, 0.04], [0.6, 0.07, 0.05], [0.9, 0.16, 0.07]]) {
    c.fillStyle = '#16283a'; c.beginPath(); c.ellipse(W * ix, HZN + 2, W * iw, H * ih, 0, Math.PI, TAU); c.fill();
    c.strokeStyle = 'rgba(255, 220, 140, 0.5)'; c.lineWidth = W / 1000; c.beginPath();
    for (let k = 0; k <= 8; k++) { const x = W * (ix - iw * 0.7 + (k / 8) * iw * 1.4), y = HZN - H * ih * 0.55 + Math.sin(k * 0.9) * H * 0.006 + Math.abs(k - 4) * H * ih * 0.08; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
    for (let k = 0; k <= 8; k++) { const x = W * (ix - iw * 0.7 + (k / 8) * iw * 1.4), y = HZN - H * ih * 0.55 + Math.sin(k * 0.9) * H * 0.006 + Math.abs(k - 4) * H * ih * 0.08; blob(c, x, y + H * 0.004, W * 0.004, W * 0.004, ['#ffd27a', '#ff9a7a', '#a8e0ff'][k % 3]); }
    for (let k = 0; k < 3; k++) c.fillStyle = '#ffd890', c.fillRect(W * (ix - iw * 0.4 + k * iw * 0.35), HZN - H * ih * 0.25, W * 0.006, H * 0.01);
  }
  // the lighthouse on its rock, lamp blazing with the great lens
  c.fillStyle = '#20263a'; c.beginPath(); c.ellipse(lx, HZN + 2, W * 0.06, H * 0.035, 0, Math.PI, TAU); c.fill();
  const tw = W * 0.018;
  for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#e8e0e0' : '#c84a4a'; c.fillRect(lx - tw / 2 - k * 0.3, ly + H * 0.02 + k * (HZN - ly - H * 0.03) / 4, tw + k * 0.6, (HZN - ly - H * 0.03) / 4 + 1); }
  c.fillStyle = '#3a2a2a'; c.fillRect(lx - tw * 0.7, ly + H * 0.012, tw * 1.4, H * 0.01);
  const halo = c.createRadialGradient(lx, ly, 0, lx, ly, W * 0.06); halo.addColorStop(0, 'rgba(255, 250, 210, 1)'); halo.addColorStop(0.25, 'rgba(255, 240, 170, 0.7)'); halo.addColorStop(1, 'rgba(255, 240, 170, 0)');
  c.fillStyle = halo; c.fillRect(lx - W * 0.06, ly - W * 0.06, W * 0.12, W * 0.12);
  c.fillStyle = '#3a2a2a'; c.beginPath(); c.moveTo(lx - tw * 0.6, ly - H * 0.012); c.lineTo(lx, ly - H * 0.03); c.lineTo(lx + tw * 0.6, ly - H * 0.012); c.fill();
  // lantern boats: little sails catching the lantern light, each with its reflection
  const boats: [number, number, number][] = [];
  for (let i = 0; i < 34; i++) boats.push([hash(i, 7), 0.53 + hash(i, 8) ** 1.5 * 0.42, i]);
  boats.sort((a, b) => a[1] - b[1]);
  for (const [bx0, by0, i] of boats) {
    const x = bx0 * W, y = by0 * H, s = (0.35 + (by0 - 0.5) * 2.2) * W / 1200, col = ['255, 210, 120', '255, 160, 140', '180, 220, 255'][i % 3];
    if (Math.abs(x - W * 0.82) < 170 * s * 4 && by0 > 0.6) continue; // leave room for Dora and Enzo
    c.fillStyle = `rgba(${col}, 0.18)`; c.fillRect(x - 2 * s, y + 4 * s, 4 * s, 34 * s);
    c.fillStyle = '#1a1420'; c.beginPath(); c.moveTo(x - 22 * s, y); c.lineTo(x + 22 * s, y); c.lineTo(x + 15 * s, y + 7 * s); c.lineTo(x - 15 * s, y + 7 * s); c.fill();
    c.fillStyle = 'rgba(240, 220, 190, 0.85)'; c.beginPath(); c.moveTo(x, y - 2 * s); c.lineTo(x, y - 34 * s); c.lineTo(x + 17 * s, y - 4 * s); c.fill();
    const g2 = c.createRadialGradient(x - 9 * s, y - 10 * s, 0, x - 9 * s, y - 10 * s, 18 * s); g2.addColorStop(0, `rgba(${col}, 0.9)`); g2.addColorStop(0.3, `rgba(${col}, 0.4)`); g2.addColorStop(1, `rgba(${col}, 0)`);
    c.fillStyle = g2; c.fillRect(x - 27 * s, y - 28 * s, 36 * s, 36 * s); blob(c, x - 9 * s, y - 10 * s, 3 * s, 3.6 * s, '#fff2c0');
  }
  // Dora and Enzo's own boat, close by on the right, lantern lit
  paintSideBoat(c, W * 0.82, H * 0.74, W / 1700, t, false, true);
}

// ---------------------------------------------------------------- the chart's map
let MAP: HTMLCanvasElement | null = null;
/** The lake drawn as an inked chart at 1 pixel to 10 units: water, coasts, islands, currents. Built once. */
function chartMap() {
  if (MAP) return MAP;
  const k = 0.1, cv = mk(LAKE_W * k, LAKE_H * k), c = ctx2(cv);
  c.fillStyle = '#c8e2dc'; c.fillRect(0, 0, cv.width, cv.height);
  c.scale(k, k);
  const edge = lakeEdge(60);
  c.fillStyle = '#e4d6a8'; c.beginPath(); c.rect(-100, -100, LAKE_W + 200, LAKE_H + 200); smoothPath(c, edge); c.fill('evenodd');
  c.strokeStyle = '#6a5a3a'; c.lineWidth = 14; c.beginPath(); smoothPath(c, edge); c.stroke();
  for (let i = 0; i < 4; i++) { c.strokeStyle = `rgba(80, 120, 140, ${0.22 - i * 0.05})`; c.lineWidth = 10; c.beginPath(); smoothPath(c, offsetPoly(edge, -40 - i * 40)); c.stroke(); }
  for (const isl of ISLANDS) {
    for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(80, 120, 140, ${0.25 - i * 0.07})`; c.lineWidth = 9; c.beginPath(); smoothPath(c, offsetPoly(isl.poly, 30 + i * 32)); c.stroke(); }
    c.beginPath(); smoothPath(c, isl.poly); c.fillStyle = isl.dock ? '#e8d49a' : '#efe0b4'; c.fill(); c.strokeStyle = '#5a4a30'; c.lineWidth = 9; c.stroke();
    c.save(); c.clip(); c.strokeStyle = 'rgba(110, 90, 50, 0.3)'; c.lineWidth = 6; for (let x = isl.x - isl.reach; x < isl.x + isl.reach; x += 30) { c.beginPath(); c.moveTo(x, isl.y - isl.reach); c.lineTo(x + isl.reach, isl.y + isl.reach); c.stroke(); } c.restore();
  }
  for (const r of ROCKS) { c.fillStyle = r.shoal ? 'rgba(200, 180, 120, 0.6)' : '#7a6a50'; c.beginPath(); c.arc(r.x, r.y, r.r, 0, TAU); c.fill(); if (r.shoal) { c.strokeStyle = '#8a7a50'; c.setLineDash([12, 10]); c.lineWidth = 6; c.stroke(); c.setLineDash([]); } }
  for (const rd of REEDS) { c.save(); c.translate(rd.x, rd.y); c.rotate(rd.rot); c.strokeStyle = '#5a7a3a'; c.lineWidth = 6; for (let i = -rd.rx; i < rd.rx; i += 26) { const h = rd.ry * Math.sqrt(Math.max(0, 1 - (i / rd.rx) ** 2)); c.beginPath(); c.moveTo(i, h * 0.6); c.lineTo(i + 6, -h * 0.6); c.stroke(); } c.restore(); }
  for (const cur of CURRENTS) {
    c.strokeStyle = 'rgba(40, 90, 140, 0.55)'; c.lineWidth = 8; c.setLineDash([40, 30]); c.beginPath(); cur.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < cur.pts.length - 1; i++) { const [ax, ay] = cur.pts[i], [bx, by] = cur.pts[i + 1], a = Math.atan2(by - ay, bx - ax), mx = (ax + bx) / 2, my = (ay + by) / 2; c.fillStyle = 'rgba(40, 90, 140, 0.7)'; c.beginPath(); c.moveTo(mx + Math.cos(a) * 34, my + Math.sin(a) * 34); c.lineTo(mx + Math.cos(a + 2.5) * 30, my + Math.sin(a + 2.5) * 30); c.lineTo(mx + Math.cos(a - 2.5) * 30, my + Math.sin(a - 2.5) * 30); c.fill(); }
  }
  MAP = cv; return cv;
}
/** The lake's edge as a polygon, sampled every `step` units along the wobbly shore. */
function lakeEdge(step: number): Pt[] {
  const pts: Pt[] = [];
  for (let x = 0; x < LAKE_W; x += step) pts.push([x, shoreIn(x, 2)]);
  for (let y = 0; y < LAKE_H; y += step) pts.push([LAKE_W - shoreIn(y, 1), y]);
  for (let x = LAKE_W; x > 0; x -= step) pts.push([x, LAKE_H - shoreIn(x, 3)]);
  for (let y = LAKE_H; y > 0; y -= step) pts.push([shoreIn(y, 0), y]);
  // keep the corners inside both edges
  return pts.map(([x, y]) => [Math.min(Math.max(x, shoreIn(y, 0)), LAKE_W - shoreIn(y, 1)), Math.min(Math.max(y, shoreIn(x, 2)), LAKE_H - shoreIn(x, 3))] as Pt);
}
/** A mask of what's been charted, soft-edged: white where revealed. */
function chartMask(g: DriftwoodGame, k: number) {
  const cv = mk(LAKE_W * k, LAKE_H * k), c = ctx2(cv), s = CHART_CELL * k;
  c.fillStyle = '#fff';
  for (let j = 0; j < CHART_H; j++) for (let i = 0; i < CHART_W; i++) if (g.chart[j * CHART_W + i]) { c.beginPath(); c.arc((i + 0.5) * s, (j + 0.5) * s, s * 0.95, 0, TAU); c.fill(); }
  return cv;
}
let PARCH: HTMLCanvasElement | null = null;
function parchment(w: number, h: number) {
  if (PARCH && PARCH.width === Math.ceil(w) && PARCH.height === Math.ceil(h)) return PARCH;
  const cv = mk(w, h), c = ctx2(cv);
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, '#f8ecd0'); g.addColorStop(1, '#d8bf8e');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) blob(c, hash(i, 1) * w, hash(i, 2) * h, 20 + hash(i, 3) * 80, 14 + hash(i, 4) * 50, `rgba(170, 130, 70, ${0.03 + hash(i, 5) * 0.05})`);
  PARCH = cv; return cv;
}
function compassRose(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save(); c.translate(x, y); c.strokeStyle = 'rgba(90, 70, 40, 0.6)'; c.fillStyle = 'rgba(90, 70, 40, 0.5)'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.82, 0, TAU); c.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, l = i % 2 ? r * 0.55 : r; c.beginPath(); c.moveTo(Math.cos(a) * l, Math.sin(a) * l); c.lineTo(Math.cos(a + 0.5) * r * 0.14, Math.sin(a + 0.5) * r * 0.14); c.lineTo(Math.cos(a - 0.5) * r * 0.14, Math.sin(a - 0.5) * r * 0.14); c.fill(); }
  c.font = `900 ${r * 0.34}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#6a4a2a'; c.fillText('N', 0, -r * 1.22);
  c.restore();
}
/** The charted part of the lake, inked and soft-edged, kept until more is charted. */
let CHARTED: { g: DriftwoodGame; v: number; cv: HTMLCanvasElement } | null = null;
/**
 * The full-screen chart: parchment, the charted parts of the lake, island names, pins for the post, shells and
 * bottles found, and a little boat for "you are here". `art` is the parchment painting, if it has loaded.
 */
export function drawChart(cv: HTMLCanvasElement, g: DriftwoodGame, art: HTMLImageElement | null, t: number) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(1, r.width), H = Math.max(1, r.height);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = ctx2(cv); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (art) c.drawImage(art, 0, 0, W, H); else c.drawImage(parchment(W, H), 0, 0, W, H);
  const pad = Math.min(W, H) * 0.06, s = Math.min((W - pad * 2) / LAKE_W, (H - pad * 2) / LAKE_H), ox = (W - LAKE_W * s) / 2, oy = (H - LAKE_H * s) / 2;
  // the charted lake: the inked map masked by what's been seen
  // (rebuilt only when more of the lake is charted: the blur is too dear to run every frame)
  if (!CHARTED || CHARTED.g !== g || CHARTED.v !== g.chartVersion) {
    const map = chartMap(), mask = chartMask(g, 0.1), lay = CHARTED?.cv ?? mk(map.width, map.height), lc = ctx2(lay);
    lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, lay.width, lay.height);
    lc.drawImage(map, 0, 0); lc.globalCompositeOperation = 'destination-in'; lc.filter = 'blur(2px)'; lc.drawImage(mask, 0, 0); lc.filter = 'none'; lc.globalCompositeOperation = 'source-over';
    CHARTED = { g, v: g.chartVersion, cv: lay };
  }
  const lay = CHARTED.cv;
  c.save(); c.globalAlpha = 0.95; c.drawImage(lay, ox, oy, LAKE_W * s, LAKE_H * s); c.restore();
  c.strokeStyle = 'rgba(90, 70, 40, 0.5)'; c.lineWidth = 2; c.strokeRect(ox - 4, oy - 4, LAKE_W * s + 8, LAKE_H * s + 8);
  if (!art) compassRose(c, ox + LAKE_W * s - 46, oy + LAKE_H * s - 46, 30);
  const P = (x: number, y: number): Pt => [ox + x * s, oy + y * s];
  const fs = Math.max(11, Math.min(16, W / 70));
  // shells and bottles found
  SHELLS.forEach(([x, y], i) => { if (!g.found[i]) return; const [px, py] = P(x, y); shellIcon(c, px, py, fs * 0.42); });
  BOTTLES.forEach((b, i) => { if (!g.bottles[i]) return; const [px, py] = P(b.x, b.y); c.fillStyle = '#5ab07a'; c.fillRect(px - 2, py - 5, 4, 9); c.fillRect(px - 1, py - 8, 2, 3); });
  // islands: names once seen or known
  for (const isl of ISLANDS) {
    if (!g.seen.has(isl.id) && !g.known.has(isl.id)) continue;
    const [px, py] = P(isl.x, isl.y + isl.reach + 40);
    c.font = `800 ${isl.dock ? fs : fs * 0.8}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
    c.lineWidth = 4; c.strokeStyle = 'rgba(248, 236, 208, 0.9)'; c.strokeText(isl.name, px, py); c.fillStyle = isl.dock ? '#4a3418' : '#7a6a50'; c.fillText(isl.name, px, py);
    if (!g.seen.has(isl.id)) { const [qx, qy] = P(isl.x, isl.y); c.font = `900 ${fs * 1.4}px ${FONT}`; c.textBaseline = 'middle'; c.fillStyle = 'rgba(90, 70, 40, 0.6)'; c.fillText('?', qx, qy); }
  }
  // pins: red for post to deliver, a letter for post waiting
  const goal = g.goal();
  const waits = new Set<IslandId>(); for (const d of STORY) if (!g.done.has(d.n) && !g.bag.some((b) => b.story === d.n) && d.need.every((n) => g.done.has(n)) && g.known.has(d.from)) waits.add(d.from);
  for (const id of Object.keys(g.side) as IslandId[]) if (g.side[id]) waits.add(id);
  for (const id of waits) { const d = ISLAND[id].dock!, [px, py] = P(d.x, d.y); envelopeIcon(c, px + 10, py - 12, fs * 0.9, '#fff8e8'); }
  const dests = new Set(g.bag.map((i) => i.to)); if (g.regatta === 1) dests.add('lighthouse');
  for (const id of dests) {
    const d = ISLAND[id].dock!, [px, py] = P(d.x, d.y), bob = Math.sin(t * 4) * 2, big = goal?.id === id;
    c.strokeStyle = '#5a3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 16 + bob); c.stroke();
    blob(c, px, py - 18 + bob, big ? 7 : 5.5, big ? 7 : 5.5, big ? '#e03a3a' : '#e07a4a'); blob(c, px - 1.5, py - 20 + bob, 2, 2, 'rgba(255, 255, 255, 0.7)');
  }
  // you are here
  const [bx, by] = P(g.boat.x, g.boat.y);
  c.save(); c.translate(bx, by); c.strokeStyle = 'rgba(224, 58, 58, 0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 12 + Math.sin(t * 3) * 3, 0, TAU); c.stroke();
  c.rotate(g.boat.h); c.fillStyle = '#7a5a3a'; c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -4.5); c.lineTo(-6, 4.5); c.closePath(); c.fill(); c.fillStyle = '#fbf2dc'; c.beginPath(); c.moveTo(2, 0); c.lineTo(-4, -7); c.lineTo(-4, 0); c.fill(); c.restore();
  c.font = `800 ${fs * 0.85}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#a02a2a'; c.textBaseline = 'top'; c.fillText('you are here', bx, by + 15);
}
function shellIcon(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.fillStyle = '#f8c8d0'; c.strokeStyle = '#b06a7a'; c.lineWidth = Math.max(0.8, s * 0.12);
  c.beginPath(); c.moveTo(0, s * 0.8); for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.1 + (i / 6) * 0.8); c.lineTo(Math.cos(a) * s, Math.sin(a) * s * 0.9); } c.closePath(); c.fill(); c.stroke();
  for (let i = 1; i < 6; i++) { const a = Math.PI * (1.1 + (i / 6) * 0.8); c.beginPath(); c.moveTo(0, s * 0.7); c.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.8); c.stroke(); }
  c.restore();
}
function envelopeIcon(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  c.save(); c.translate(x, y); c.fillStyle = fill; c.strokeStyle = '#8a5a3a'; c.lineWidth = Math.max(1, s * 0.09);
  c.fillRect(-s / 2, -s * 0.33, s, s * 0.66); c.strokeRect(-s / 2, -s * 0.33, s, s * 0.66); c.beginPath(); c.moveTo(-s / 2, -s * 0.33); c.lineTo(0, s * 0.06); c.lineTo(s / 2, -s * 0.33); c.stroke();
  blob(c, 0, s * 0.02, s * 0.1, s * 0.1, '#d8423a'); c.restore();
}

// ---------------------------------------------------------------- the scene
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; k: 0 | 1 | 2 | 3; s: number };
type WakePt = { x: number; y: number; h: number; v: number; t: number };
/** `alpha` blends the boat between the last two ticks (`prev` is where it was), so 30 Hz rules draw smoothly at 60 Hz or more. */
export type DrawOpts = { dt: number; paused: boolean; manual: boolean; touch: boolean; alpha?: number; prev?: { x: number; y: number; h: number } | null };

export class DriftwoodScene {
  private canvas: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  private cam = { x: ISLAND.home.dock!.x, y: ISLAND.home.dock!.y, z: 1 };
  private time = 0; private shake = 0;
  private base: HTMLCanvasElement | null = null; private baseK = 0.1;
  private edgePath: Path2D; private edgeLine: Path2D; private edgePts: Pt[];
  private islandArt = new Map<IslandId, { cv: HTMLCanvasElement; half: number }>();
  private coastPaths = new Map<IslandId, { coast: Path2D; foam: Path2D; foam2: Path2D }>();
  private reedArt: HTMLCanvasElement[] = [];
  private art = new Map<string, HTMLImageElement>();
  private fogSprite: HTMLCanvasElement; private glowSprite: HTMLCanvasElement;
  private parts: Particle[] = []; private wake: WakePt[] = [];
  private mini: HTMLCanvasElement | null = null; private miniVer = -1;
  private lastBoat: { x: number; y: number } | null = null;
  private dockPulse = 0;
  /** Where the boat is drawn this frame (between ticks). */
  private at = { x: 0, y: 0, h: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.c = ctx2(canvas);
    this.edgePts = lakeEdge(40);
    const p = new Path2D(); p.rect(-2000, -2000, LAKE_W + 4000, LAKE_H + 4000); smoothPath(p, this.edgePts); this.edgePath = p;
    this.edgeLine = new Path2D(); smoothPath(this.edgeLine, this.edgePts);
    for (const isl of ISLANDS) {
      const coast = new Path2D(), foam = new Path2D(), foam2 = new Path2D();
      smoothPath(coast, isl.poly); smoothPath(foam, offsetPoly(isl.poly, 7)); smoothPath(foam2, offsetPoly(isl.poly, 17));
      this.coastPaths.set(isl.id, { coast, foam, foam2 });
    }
    this.fogSprite = mk(128, 128); { const c = ctx2(this.fogSprite), g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); g.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)'); g.addColorStop(1, 'rgba(255, 255, 255, 0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
    this.glowSprite = mk(64, 64); { const c = ctx2(this.glowSprite), g = c.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255, 236, 170, 1)'); g.addColorStop(0.25, 'rgba(255, 196, 110, 0.55)'); g.addColorStop(1, 'rgba(255, 170, 80, 0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
    for (const name of ['boat', 'chart', ...new Set(ISLANDS.map((i) => i.art))]) this.load(name);
    this.resize();
  }
  private load(name: string) { const img = new Image(); img.decoding = 'async'; img.src = `/art/driftwood/${name}.webp`; this.art.set(name, img); }
  /** A painting, once it has loaded; null until then (or if it never does). */
  img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }

  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  /** Lake units to a pixel, from the screen's size: the lake looks about the same on a phone as on a desktop. */
  private baseZoom() { return Math.max(0.6, Math.min(1.25, Math.min(this.W, this.H * 1.5) / 720)); }

  /** The water's base colours, from deep to the shallows by each coast, at 1 pixel to 10 units. Built once. */
  private baseMap() {
    if (this.base) return this.base;
    const k = this.baseK, w = Math.ceil(LAKE_W * k), h = Math.ceil(LAKE_H * k), cv = mk(w, h), c = ctx2(cv), im = c.createImageData(w, h), d = im.data;
    const shallow = rgb('#86e0d2'), mid = rgb('#3db0c6'), deep = rgb('#2a82b6'), deepest = rgb('#22679f'), sand = rgb('#d8d0a0'), land = rgb('#7ab45c');
    const shoals = ROCKS.filter((r) => r.shoal);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i + 0.5) / k, y = (j + 0.5) / k, dist = clearance(x, y);
      let col: number[];
      // under a rock is shallow water (the rock is drawn on top); only the islands and the far shore are land
      if (dist < 0) col = shoals.some((r) => Math.hypot(x - r.x, y - r.y) < r.r) ? sand : ROCKS.some((r) => Math.hypot(x - r.x, y - r.y) < r.r + 4) ? shallow : land;
      else if (dist < 70) col = mixRgb(shallow, mid, ease(dist / 70));
      else if (dist < 260) col = mixRgb(mid, deep, ease((dist - 70) / 190));
      else col = mixRgb(deep, deepest, ease((dist - 260) / 300));
      for (const r of shoals) { const q = Math.hypot(x - r.x, y - r.y) - r.r; if (q >= 0 && q < 50) col = mixRgb(sand, col, ease(q / 50)); }
      const n = (hash(i, j) - 0.5) * 6, o = (j * w + i) * 4;
      d[o] = col[0] + n; d[o + 1] = col[1] + n; d[o + 2] = col[2] + n; d[o + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    this.base = cv; return cv;
  }
  private islandSprite(isl: Island) {
    let s = this.islandArt.get(isl.id); if (!s) { s = paintIslandStandIn(isl, 1); this.islandArt.set(isl.id, s); } return s;
  }
  private reedSprite(i: number) {
    if (this.reedArt[i]) return this.reedArt[i];
    const rd = REEDS[i], size = Math.max(rd.rx, rd.ry) * 2 + 40, cv = mk(size, size), c = ctx2(cv);
    c.translate(size / 2, size / 2); c.rotate(rd.rot);
    blob(c, 0, 0, rd.rx, rd.ry, 'rgba(90, 130, 60, 0.35)');
    for (let k = 0; k < (rd.rx * rd.ry) / 90; k++) {
      const a = hash(i * 31 + k, 1) * TAU, rr = Math.sqrt(hash(i * 31 + k, 2)), x = Math.cos(a) * rr * rd.rx, y = Math.sin(a) * rr * rd.ry;
      c.save(); c.translate(x, y); c.rotate(-rd.rot);
      c.strokeStyle = hash(k, i) < 0.5 ? '#5f8a3e' : '#7aa44c'; c.lineWidth = 1.6;
      for (let s = -1; s <= 1; s++) { c.beginPath(); c.moveTo(s * 2, 2); c.quadraticCurveTo(s * 3, -8, s * 4 + 1, -16 - hash(k, s + 5) * 6); c.stroke(); }
      if (hash(k, 9) < 0.3) blob(c, 4, -15, 1.6, 4, '#7a4a2a');
      c.restore();
    }
    this.reedArt[i] = cv; return cv;
  }

  /** Reacts to what the game did: splashes, sparkles and a little shake. */
  feed(events: Ev[], g: DriftwoodGame) {
    for (const e of events) {
      if (e.k === 'bump') {
        const n = e.hard ? 16 : 6; this.shake = Math.max(this.shake, e.hard ? 0.35 : 0.1);
        for (let i = 0; i < n; i++) { const a = hash(g.tick, i) * TAU, sp = 0.5 + hash(i, g.tick) * (e.hard ? 2.6 : 1.2); this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5 + hash(i, 3) * 0.4, k: 0, s: 2 + hash(i, 4) * 3 }); }
      } else if (e.k === 'shell' || e.k === 'bottle') {
        const [x, y] = e.k === 'shell' ? SHELLS[e.i] : [BOTTLES[e.i].x, BOTTLES[e.i].y];
        for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; this.parts.push({ x, y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, life: 0, max: 0.8, k: 1, s: 3 }); }
      } else if (e.k === 'dock' || e.k === 'castoff') this.dockPulse = 1;
      else if (e.k === 'tack') { const b = g.boat; for (let i = 0; i < 8; i++) { const a = b.h + Math.PI + (i - 3.5) * 0.25; this.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.8, life: 0, max: 0.6, k: 0, s: 2 }); } }
      else if (e.k === 'patch') { const b = g.boat; for (let i = 0; i < 10; i++) this.parts.push({ x: b.x, y: b.y, vx: (hash(i, 1) - 0.5) * 1.5, vy: -1 - hash(i, 2), life: 0, max: 1, k: 2, s: 3 }); }
    }
  }

  // ---------------------------------------------------------------- drawing
  draw(g: DriftwoodGame | null, o: DrawOpts) {
    const dt = Math.min(0.1, Math.max(0, o.dt)); if (!o.paused) this.time += dt;
    const c = this.c, W = this.W, H = this.H, t = this.time;
    // a stand-in voyage for the menu: drifting around home at nine in the morning
    const minute = g ? g.minute : 9 * 60 + Math.sin(t * 0.05) * 30, windDir = g ? g.wind.dir : PREVAIL, windStr = g ? g.windStr : 0.8;
    const a = o.alpha ?? 1, pv = o.prev && g && Math.hypot(o.prev.x - g.boat.x, o.prev.y - g.boat.y) < 60 ? o.prev : null;
    const bx = g ? (pv ? pv.x + (g.boat.x - pv.x) * a : g.boat.x) : ISLAND.home.dock!.x + 260 + Math.sin(t * 0.07) * 200;
    const by = g ? (pv ? pv.y + (g.boat.y - pv.y) * a : g.boat.y) : ISLAND.home.dock!.y - 160 + Math.cos(t * 0.05) * 120;
    this.at = { x: bx, y: by, h: g ? (pv ? pv.h + wrap(g.boat.h - pv.h) * a : g.boat.h) : 0 };
    // the camera: eases after the boat, looking ahead where it's going, pulling back a touch at speed
    const vx = g ? g.boat.vx : 0, vy = g ? g.boat.vy : 0, speed = Math.hypot(vx, vy);
    const z = this.baseZoom() * (1 - 0.1 * Math.min(1, speed / MAX_SPEED));
    const tx = bx + vx * 42, ty = by + vy * 42, k = 1 - Math.exp(-dt * 2.6);
    if (g && this.lastBoat && Math.hypot(this.lastBoat.x - bx, this.lastBoat.y - by) > 400) { this.cam.x = tx; this.cam.y = ty; this.wake.length = 0; }
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k; this.cam.z += (z - this.cam.z) * k;
    this.lastBoat = { x: bx, y: by };
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake > 0 ? this.shake * 10 : 0, shx = sh ? Math.sin(t * 90) * sh : 0, shy = sh ? Math.cos(t * 77) * sh : 0;
    const Z = this.cam.z, cx = this.cam.x, cy = this.cam.y, dpr = this.dpr;
    const view = { x0: cx - W / 2 / Z - 120, x1: cx + W / 2 / Z + 120, y0: cy - H / 2 / Z - 160, y1: cy + H / 2 / Z + 120 };
    const inView = (x: number, y: number, r: number) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#5a9a4a'; c.fillRect(0, 0, W, H);
    c.setTransform(dpr * Z, 0, 0, dpr * Z, dpr * (W / 2 - cx * Z + shx), dpr * (H / 2 - cy * Z + shy));
    c.imageSmoothingEnabled = true;

    // water, its depth shading, and the land around the lake
    c.drawImage(this.baseMap(), 0, 0, LAKE_W, LAKE_H);
    this.drawSurface(c, view, t, windDir, windStr, minute);
    this.drawCurrents(c, view, t);
    for (let i = 0; i < REEDS.length; i++) { const rd = REEDS[i]; if (!inView(rd.x, rd.y, rd.rx + 40)) continue; const sp = this.reedSprite(i); c.drawImage(sp, rd.x - sp.width / 2, rd.y - sp.height / 2); }
    if (g) this.drawWake(c, g, dt);
    this.drawFoam(c, view, t);
    c.fillStyle = '#76b25a'; c.fill(this.edgePath, 'evenodd');
    this.drawShoreland(c, view);
    // rocks and islands
    for (const r of ROCKS) if (inView(r.x, r.y, r.r + 20) && !r.shoal) this.drawRock(c, r.x, r.y, r.r, t);
    for (const isl of ISLANDS) {
      if (!inView(isl.x, isl.y, isl.reach + 80)) continue;
      const art = this.img(isl.art);
      if (art) { const s = isl.reach * 2.24; c.drawImage(art, isl.x - s / 2, isl.y - s / 2, s, s); }
      else { const sp = this.islandSprite(isl); c.drawImage(sp.cv, isl.x - sp.half, isl.y - sp.half, sp.half * 2, sp.half * 2); }
      if (isl.dock) this.drawJetty(c, isl, g, t);
      this.drawIslandLife(c, isl, !!art, t, windDir, minute);
    }
    // treasures in the water: shells glint, bottles bob
    if (g) this.drawFinds(c, g, t);
    // fog banks lie over the islands, but never over your own boat: you can always see her
    this.drawFog(c, view, g ? g.tick : t * HZ);
    // the boat (or none on the menu)
    if (g) this.drawBoat(c, g, t);
    else this.drawBoatAt(c, bx, by, Math.atan2(Math.cos(t * 0.07) * 14, -Math.sin(t * 0.05) * 6) || 0.4, 1.4, windDir, 1, 0.45, 0, t, 0, null);
    this.drawParticles(c, dt, o.paused);
    // weather and light
    const rain = g ? g.rain : false;
    if (rain) this.drawRain(c, view, t, windDir);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grade = gradeAt(minute);
    if (grade.a > 0.005) { c.globalCompositeOperation = 'multiply'; c.fillStyle = css(mixRgb([255, 255, 255], grade.col, grade.a)); c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
    if (rain) { c.fillStyle = 'rgba(40, 56, 84, 0.3)'; c.fillRect(0, 0, W, H); }
    const glow = glowAt(minute);
    c.setTransform(dpr * Z, 0, 0, dpr * Z, dpr * (W / 2 - cx * Z + shx), dpr * (H / 2 - cy * Z + shy));
    if (glow > 0.02) this.drawNight(c, g, view, t, glow, minute);
    if (rain) this.drawRainStreaks(c, view, t, windDir);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // how far you can see: darkness gathers beyond the sight radius at night and in fog
    if (g) {
      const dark = Math.max(glow * 0.75, g.fog * 0.55), [sx, sy] = [W / 2 + (bx - cx) * Z, H / 2 + (by - cy) * Z], r = g.sight * Z;
      if (dark > 0.03) {
        const v = c.createRadialGradient(sx, sy, r * 0.55, sx, sy, r * 1.25); const col = g.fog > glow ? '232, 238, 242' : '8, 14, 40';
        v.addColorStop(0, `rgba(${col}, 0)`); v.addColorStop(1, `rgba(${col}, ${dark * 0.85})`); c.fillStyle = v; c.fillRect(0, 0, W, H);
      }
      this.drawHud(c, g, o, t);
    } else {
      const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(20, 40, 60, 0.35)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    }
  }

  private drawSurface(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }, t: number, windDir: number, windStr: number, minute: number) {
    // ripple crescents across the wind, drifting downwind, twinkling in and out; glints by day, moonlight by night.
    // Strokes are gathered into a few paths by brightness, so the whole surface costs a handful of draw calls.
    const S = 100, wx = Math.cos(windDir), wy = Math.sin(windDir), drift = t * (16 + windStr * 26), day = daylight(minute);
    const i0 = Math.floor(v.x0 / S) - 1, i1 = Math.ceil(v.x1 / S), j0 = Math.floor(v.y0 / S) - 1, j1 = Math.ceil(v.y1 / S);
    const B = 4, paths = Array.from({ length: B }, () => new Path2D()), peak = (0.16 + 0.22 * windStr) * (0.6 + 0.4 * day);
    const glints: [number, number, number][] = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      for (let n = 0; n < 2; n++) {
        const h1 = hash(i * 7 + n, j * 13), h2 = hash(i * 3 + n, j * 5 + 1), h3 = hash(i + n * 17, j * 11 + 3);
        const ph = (drift / S + h1) % 1, x = (i + h2) * S + wx * ph * S, y = (j + h3) * S + wy * ph * S;
        if (x < 0 || y < 0 || x > LAKE_W || y > LAKE_H) continue;
        const b = Math.min(B - 1, Math.floor(Math.sin(ph * Math.PI) * B)), len = 4 + h1 * 6 + windStr * 3, p = paths[b];
        // a short smile-shaped crescent, bowed downwind
        p.moveTo(x - wy * len, y + wx * len); p.quadraticCurveTo(x + wx * len * 0.9, y + wy * len * 0.9, x + wy * len, y - wx * len);
        if (n === 0 && h2 > 0.72) { const tw = Math.max(0, Math.sin(t * (2 + h3 * 3) + h1 * 20)) ** 6; if (tw > 0.1) glints.push([x, y, tw]); }
      }
    }
    c.lineCap = 'round'; c.lineWidth = 1.4 + windStr * 0.6;
    for (let b = 0; b < B; b++) { c.strokeStyle = `rgba(255, 255, 255, ${(peak * (b + 0.5)) / B})`; c.stroke(paths[b]); }
    c.lineCap = 'butt';
    c.fillStyle = day > 0.3 ? 'rgb(255, 255, 240)' : 'rgb(220, 230, 255)';
    for (const [x, y, tw] of glints) {
      const s = 1.5 + tw * 3; c.globalAlpha = tw * (day > 0.3 ? 0.9 : 0.7);
      c.beginPath(); c.moveTo(x, y - s * 2); c.lineTo(x + s * 0.5, y); c.lineTo(x, y + s * 2); c.lineTo(x - s * 0.5, y); c.closePath(); c.fill(); c.fillRect(x - s * 1.6, y - 0.6, s * 3.2, 1.2);
    }
    c.globalAlpha = 1;
  }
  private drawCurrents(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }, t: number) {
    const B = 4, paths = Array.from({ length: B }, () => new Path2D());
    for (const cur of CURRENTS) {
      let along = 0; const total = cur.pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - cur.pts[i - 1][0], p[1] - cur.pts[i - 1][1]) : 0), 0);
      for (let i = 0; i < cur.pts.length - 1; i++) {
        const [ax, ay] = cur.pts[i], [bx, by] = cur.pts[i + 1], L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
        if (Math.max(ax, bx) < v.x0 - 200 || Math.min(ax, bx) > v.x1 + 200 || Math.max(ay, by) < v.y0 - 200 || Math.min(ay, by) > v.y1 + 200) { along += L; continue; }
        const step = 60, flow = (t * cur.speed * HZ) % step;
        for (let s = step - flow; s < L; s += step) {
          for (let lane = -2; lane <= 2; lane++) {
            const h = hash(Math.round((along + s + flow) / step) * 5 + lane, i), off = lane * cur.w * 0.32 + (h - 0.5) * 20;
            const x = ax + ux * (s + h * 30) - uy * off, y = ay + uy * (s + h * 30) + ux * off;
            const ends = Math.min(1, (along + s) / 300, (total - along - s) / 300);
            const a = (1 - Math.abs(lane) * 0.25) * Math.max(0, ends) * (0.5 + 0.5 * Math.sin((s + along) * 0.05 + t * 3 + lane));
            if (a < 0.08) continue;
            const p = paths[Math.min(B - 1, Math.floor(a * B))]; p.moveTo(x, y); p.lineTo(x + ux * 22, y + uy * 22);
          }
        }
        along += L;
      }
    }
    c.lineCap = 'round'; c.lineWidth = 2.2;
    for (let b = 0; b < B; b++) { c.strokeStyle = `rgba(230, 250, 255, ${(0.3 * (b + 0.5)) / B})`; c.stroke(paths[b]); }
    c.lineCap = 'butt';
  }
  private drawFoam(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }, t: number) {
    // two rings of foam breathing in and out on every coast, the outer one fainter and out of step
    for (const isl of ISLANDS) {
      if (isl.x + isl.reach + 60 < v.x0 || isl.x - isl.reach - 60 > v.x1 || isl.y + isl.reach + 60 < v.y0 || isl.y - isl.reach - 60 > v.y1) continue;
      const p = this.coastPaths.get(isl.id)!, ph = Math.sin(t * 1.3 + isl.x * 0.01), ph2 = Math.sin(t * 1.3 + isl.x * 0.01 - 1.6);
      c.strokeStyle = `rgba(255, 255, 255, ${0.16 + 0.1 * ph2})`; c.lineWidth = 4 + ph2 * 2; c.stroke(p.foam2);
      c.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.15 * ph})`; c.lineWidth = 7 + ph * 2.5; c.stroke(p.foam);
    }
    for (const r of ROCKS) {
      if (r.x < v.x0 - 60 || r.x > v.x1 + 60 || r.y < v.y0 - 60 || r.y > v.y1 + 60) continue;
      const ph = Math.sin(t * 1.6 + r.x * 0.03);
      c.strokeStyle = `rgba(255, 255, 255, ${r.shoal ? 0.25 : 0.45 + 0.15 * ph})`; c.lineWidth = r.shoal ? 3 : 4 + ph * 1.5;
      if (r.shoal) c.setLineDash([10, 9]);
      c.beginPath(); c.arc(r.x, r.y, r.r + (r.shoal ? 2 : 6 + ph * 2), 0, TAU); c.stroke(); c.setLineDash([]);
    }
    const ph = Math.sin(t * 1.2);
    c.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.12 * ph})`; c.lineWidth = 8 + ph * 3; c.stroke(this.edgeLine);
  }
  private drawShoreland(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }) {
    // a sandy lip and a few trees on the lake's own shores
    c.strokeStyle = '#e8d49c'; c.lineWidth = 16; c.stroke(this.edgeLine);
    const S = 90;
    for (let j = Math.floor(v.y0 / S); j <= Math.ceil(v.y1 / S); j++) for (let i = Math.floor(v.x0 / S); i <= Math.ceil(v.x1 / S); i++) {
      const x = (i + hash(i, j)) * S, y = (j + hash(j, i)) * S, e = edgeDist(x, y).d;
      if (e > -40 || hash(i * 3, j * 7) < 0.35) continue;
      if (hash(i, j * 3) < 0.25) pine(c, x, y, 30 + hash(j, i * 5) * 16); else tree(c, x, y, 30 + hash(j, i * 5) * 18);
    }
  }
  private drawRock(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
    blob(c, x + r * 0.25, y + r * 0.3, r * 1.05, r * 0.8, 'rgba(10, 40, 60, 0.25)');
    const g = c.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r * 1.1); g.addColorStop(0, '#c8c2b8'); g.addColorStop(0.6, '#958f86'); g.addColorStop(1, '#6e6a64');
    c.fillStyle = g; c.beginPath();
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rr = r * (0.86 + hash(x | 0, i) * 0.24); i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92); }
    c.closePath(); c.fill();
    blob(c, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.18, 'rgba(255, 255, 255, 0.35)');
    if (hash(y | 0, 3) < 0.4) blob(c, x + r * 0.3, y - r * 0.1, r * 0.25, r * 0.15, '#6a8a4a');
    void t;
  }
  private drawJetty(c: CanvasRenderingContext2D, isl: Island, g: DriftwoodGame | null, t: number) {
    const d = isl.dock!, p = isl.pier!, ux = Math.cos(d.a), uy = Math.sin(d.a), px = -uy, py = ux;
    const ex = d.x - ux * 18, ey = d.y - uy * 18, w = 9;
    c.fillStyle = 'rgba(10, 40, 60, 0.22)'; c.beginPath(); c.moveTo(p[0] + px * w + 4, p[1] + py * w + 5); c.lineTo(ex + px * w + 4, ey + py * w + 5); c.lineTo(ex - px * w + 4, ey - py * w + 5); c.lineTo(p[0] - px * w + 4, p[1] - py * w + 5); c.fill();
    c.fillStyle = '#b08a5e'; c.beginPath(); c.moveTo(p[0] + px * w, p[1] + py * w); c.lineTo(ex + px * w, ey + py * w); c.lineTo(ex - px * w, ey - py * w); c.lineTo(p[0] - px * w, p[1] - py * w); c.closePath(); c.fill();
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.2; const L = Math.hypot(ex - p[0], ey - p[1]);
    for (let s = 4; s < L; s += 6) { const x = p[0] + ux * s, y = p[1] + uy * s; c.beginPath(); c.moveTo(x + px * w, y + py * w); c.lineTo(x - px * w, y - py * w); c.stroke(); }
    for (const sgn of [-1, 1]) for (const s of [L * 0.4, L]) blob(c, p[0] + ux * s + px * w * sgn, p[1] + uy * s + py * w * sgn, 2.6, 2.6, '#5a4028');
    // the post box at the end, its flag up when there's post waiting
    const bxp = ex + px * (w + 6), byp = ey + py * (w + 6), waiting = g ? g.waiting(isl.id).length > 0 : false;
    c.fillStyle = '#5a4028'; c.fillRect(bxp - 1, byp - 14, 2, 14);
    c.fillStyle = '#d8423a'; c.beginPath(); c.moveTo(bxp - 6, byp - 14); c.lineTo(bxp + 6, byp - 14); c.lineTo(bxp + 6, byp - 22); c.quadraticCurveTo(bxp, byp - 27, bxp - 6, byp - 22); c.closePath(); c.fill();
    c.strokeStyle = '#fbe08a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(bxp + 6, byp - 16); c.lineTo(bxp + 9, byp - 16); c.lineTo(bxp + 9, waiting ? byp - 30 : byp - 18); c.stroke();
    if (waiting) { const f = Math.sin(t * 6) * 2; c.fillStyle = '#fbe08a'; c.beginPath(); c.moveTo(bxp + 9, byp - 30); c.lineTo(bxp + 17, byp - 28 + f); c.lineTo(bxp + 9, byp - 25); c.fill(); }
  }
  private drawIslandLife(c: CanvasRenderingContext2D, isl: Island, painted: boolean, t: number, windDir: number, minute: number) {
    const look = lookOf(isl);
    // the bakery's windmill turns with the wind; chimneys smoke
    if (look.mill && !painted) {
      const [mx, my] = look.mill, a = t * 0.9;
      c.save(); c.translate(isl.x + mx, isl.y + my); c.rotate(a);
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillStyle = '#7a5a3a'; c.fillRect(-1.5, 0, 3, 40); c.fillStyle = 'rgba(250, 244, 230, 0.92)'; c.fillRect(2, 8, 11, 30); c.strokeStyle = '#a08060'; c.lineWidth = 0.8; c.strokeRect(2, 8, 11, 30); }
      c.restore(); blob(c, isl.x + mx, isl.y + my, 3.5, 3.5, '#5a4028');
    }
    if (!painted && daylight(minute) > 0.1) for (const [sx, sy] of look.smoke) {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.35 + i / 5) % 1, x = isl.x + sx + Math.cos(windDir) * ph * 40 + Math.sin(t + i) * 2, y = isl.y + sy - ph * 34 + Math.sin(windDir) * ph * 20;
        blob(c, x, y, 3 + ph * 7, 3 + ph * 7, `rgba(240, 240, 245, ${0.45 * (1 - ph)})`);
      }
    }
  }
  private drawFinds(c: CanvasRenderingContext2D, g: DriftwoodGame, t: number) {
    const b = g.boat, near = Math.max(260, g.sight * 0.55);
    SHELLS.forEach(([x, y], i) => {
      if (g.found[i] || Math.hypot(x - b.x, y - b.y) > near) return;
      const bob = Math.sin(t * 2 + i) * 1.2, tw = Math.max(0, Math.sin(t * 3 + i * 1.7)) ** 8;
      blob(c, x, y + 3, 9, 4, 'rgba(10, 40, 60, 0.2)'); shellIcon(c, x, y + bob, 8);
      if (tw > 0.05) { c.fillStyle = `rgba(255, 255, 255, ${tw})`; c.fillRect(x - 9, y - 6 + bob, 18, 1.4); c.fillRect(x - 0.7, y - 15 + bob, 1.4, 18); }
    });
    BOTTLES.forEach((o, i) => {
      if (g.bottles[i] || Math.hypot(o.x - b.x, o.y - b.y) > near) return;
      c.save(); c.translate(o.x, o.y + Math.sin(t * 1.6 + i) * 1.5); c.rotate(0.6 + Math.sin(t * 1.1 + i) * 0.25);
      blob(c, 0, 4, 14, 5, 'rgba(10, 40, 60, 0.2)'); c.fillStyle = 'rgba(120, 200, 150, 0.85)'; c.fillRect(-11, -4, 18, 8); c.fillRect(7, -2, 5, 4); c.fillStyle = '#a07a50'; c.fillRect(12, -2, 2.5, 4);
      c.fillStyle = '#fff6e0'; c.fillRect(-7, -2, 9, 4); c.restore();
    });
  }
  private drawWake(c: CanvasRenderingContext2D, g: DriftwoodGame, dt: number) {
    const b = g.boat, sp = g.speed;
    const last = this.wake[this.wake.length - 1];
    const P = this.at; if (!last || Math.hypot(last.x - (P.x - Math.cos(P.h) * 20), last.y - (P.y - Math.sin(P.h) * 20)) > 6) this.wake.push({ x: P.x - Math.cos(P.h) * 20, y: P.y - Math.sin(P.h) * 20, h: P.h, v: sp, t: this.time });
    while (this.wake.length && (this.time - this.wake[0].t > 3.2 || this.wake.length > 140)) this.wake.shift();
    void dt;
    c.lineCap = 'round';
    for (let i = 1; i < this.wake.length; i++) {
      const p = this.wake[i], q = this.wake[i - 1], age = this.time - p.t, a = Math.max(0, 1 - age / 3.2) * Math.min(1, p.v / 1.2);
      if (a < 0.02) continue;
      const spread = 6 + age * 26, nx = -Math.sin(p.h), ny = Math.cos(p.h), mx = -Math.sin(q.h), my = Math.cos(q.h);
      c.strokeStyle = `rgba(255, 255, 255, ${a * 0.5})`; c.lineWidth = 2.5 + age * 1.5;
      for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(q.x + mx * (spread - 1.3) * sgn, q.y + my * (spread - 1.3) * sgn); c.lineTo(p.x + nx * spread * sgn, p.y + ny * spread * sgn); c.stroke(); }
      c.strokeStyle = `rgba(230, 250, 250, ${a * 0.35})`; c.lineWidth = 7 - age; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke();
    }
    c.lineCap = 'butt';
    // bow spray at speed
    if (sp > 1.6 && hash(Math.floor(this.time * 30), 1) < (sp - 1.6) * 0.5) {
      const s = hash(Math.floor(this.time * 30), 2) < 0.5 ? -1 : 1, a = b.h + s * 1.9;
      this.parts.push({ x: b.x + Math.cos(b.h) * 20, y: b.y + Math.sin(b.h) * 20, vx: Math.cos(a) * 0.8 + b.vx * 0.3, vy: Math.sin(a) * 0.8 + b.vy * 0.3, life: 0, max: 0.45, k: 0, s: 1.8 });
    }
  }
  private drawBoat(c: CanvasRenderingContext2D, g: DriftwoodGame, t: number) {
    const b = g.boat, twa = Math.abs(g.twaSigned);
    // the boom swings out to leeward as the sheet eases; it flaps about when the sail luffs
    this.drawBoatAt(c, this.at.x, this.at.y, this.at.h, g.speed, g.wind.dir, b.side, b.sheet, b.luff, t, twa, g);
  }
  private drawBoatAt(c: CanvasRenderingContext2D, x: number, y: number, h: number, speed: number, windDir: number, side: number, sheet: number, luff: number, t: number, twa: number, g: DriftwoodGame | null) {
    const roll = Math.sin(t * 1.7) * 0.04 + (g ? -side * Math.min(0.08, speed * 0.03) * Math.sin(twa) : 0);
    blob(c, x + 6, y + 8, 28, 16, 'rgba(10, 40, 60, 0.22)');
    const art = this.img('boat');
    c.save(); c.translate(x, y); c.rotate(h); c.scale(1, 1 + roll);
    // the painting has its bow up, so it turns a quarter more to face along the heading
    if (art) { c.rotate(Math.PI / 2); c.drawImage(art, -32, -32, 64, 64); c.rotate(-Math.PI / 2); }
    else {
      // driftwood hull from above: pointed bow (+x), rounded stern
      const hull = c.createLinearGradient(0, -10, 0, 10); hull.addColorStop(0, '#c8a880'); hull.addColorStop(0.5, '#a88a64'); hull.addColorStop(1, '#8a6e4e');
      c.fillStyle = hull; c.beginPath(); c.moveTo(25, 0); c.quadraticCurveTo(14, -10, -6, -10); c.quadraticCurveTo(-22, -10, -22, 0); c.quadraticCurveTo(-22, 10, -6, 10); c.quadraticCurveTo(14, 10, 25, 0); c.closePath(); c.fill();
      c.strokeStyle = '#5a4430'; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = '#6e5640'; c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(11, -7, -6, -7); c.quadraticCurveTo(-18, -7, -18, 0); c.quadraticCurveTo(-18, 7, -6, 7); c.quadraticCurveTo(11, 7, 20, 0); c.fill();
      c.strokeStyle = 'rgba(200, 170, 130, 0.5)'; c.lineWidth = 1; for (const yy of [-3.5, 0, 3.5]) { c.beginPath(); c.moveTo(-16, yy); c.lineTo(16 - Math.abs(yy) * 1.5, yy); c.stroke(); }
      c.fillStyle = '#8a6e4e'; c.fillRect(-4, -7, 3, 14); c.fillRect(-15, -6, 3, 12);
      // the mail crate, filling with post
      c.fillStyle = '#c84a3a'; c.fillRect(-12, -5, 8, 10); c.strokeStyle = '#7a2a20'; c.lineWidth = 0.8; c.strokeRect(-12, -5, 8, 10);
      const n = g ? g.bag.length : 1; for (let i = 0; i < Math.min(4, n); i++) { c.fillStyle = i % 2 ? '#fff6e0' : '#f2e2c0'; c.fillRect(-11.5 + i * 1.6, -4 + i * 0.6, 6, 3.6); }
      // the tiller
      c.strokeStyle = '#5a4430'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-14, (g ? -g.boat.turn * 120 : 0)); c.stroke();
    }
    // mast, boom and sail
    const mastX = 9, boomLen = 26, boomA = Math.PI + side * (0.1 + sheet * 1.35) + luff * Math.sin(t * 22) * 0.12;
    const bxe = mastX + Math.cos(boomA) * boomLen, bye = Math.sin(boomA) * boomLen;
    const fill = luff > 0.5 ? 0 : (1 - luff) * (g ? Math.min(1, 0.4 + speed * 0.4) : 0.8);
    const belly = -side * (2 + fill * 7) + (luff > 0.2 ? Math.sin(t * 30) * 3.5 * luff : 0);
    const mx = (mastX + bxe) / 2 + Math.cos(boomA + Math.PI / 2) * belly, my = bye / 2 + Math.sin(boomA + Math.PI / 2) * belly;
    c.fillStyle = 'rgba(10, 30, 50, 0.18)'; c.beginPath(); c.moveTo(mastX + 3, 4); c.quadraticCurveTo(mx + 3, my + 4, bxe + 3, bye + 4); c.lineTo(mastX + 3, 4); c.fill();
    // the boom, seen from above
    c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(mastX, 0); c.lineTo(bxe, bye); c.stroke();
    blob(c, mastX, 0, 2.6, 2.6, '#5a4028');
    c.restore();
    // The sail stands up off the deck like the chinchillas do, so it reads at a glance: a patched triangle from the
    // masthead down to the boom's end, bellied out by the wind. It's sorted with Dora and Enzo, nearest drawn last.
    const ch = Math.cos(h), sh = Math.sin(h), MAST = 46;
    const foot = [x + ch * mastX, y + sh * mastX], end = [x + ch * bxe - sh * bye, y + sh * bxe + ch * bye];
    const face: 1 | -1 = ch >= 0 ? 1 : -1, bob = Math.sin(t * 2.2) * 0.4;
    const drawSail = () => {
      const fx = foot[0], fy = foot[1], top = fy - MAST, ex = end[0], ey = end[1] - 2, sway = luff * Math.sin(t * 24) * 3;
      // the belly: the sail's middle pushed out to leeward (in screen terms, away from the line mast→boom end)
      const nx = -(ey - top), ny = ex - fx, nl = Math.hypot(nx, ny) || 1, bulge = (3 + fill * 9) * -side * face + sway;
      const cx2 = (fx + ex) / 2 + (nx / nl) * bulge, cy2 = (top + ey) / 2 + (ny / nl) * bulge;
      c.strokeStyle = '#5a4028'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(fx, fy - 2); c.lineTo(fx, top - 3); c.stroke();
      const sg = c.createLinearGradient(fx, top, ex, ey); sg.addColorStop(0, '#fffdf6'); sg.addColorStop(1, luff > 0.5 ? '#e4d8c0' : '#f0e2c2');
      c.fillStyle = sg; c.beginPath(); c.moveTo(fx + 1, top); c.quadraticCurveTo(cx2, cy2, ex, ey); c.lineTo(fx + 1, fy - 3); c.closePath(); c.fill();
      c.strokeStyle = '#b89c74'; c.lineWidth = 1.1; c.stroke();
      // seams and a patch
      c.strokeStyle = 'rgba(184, 156, 116, 0.55)'; c.lineWidth = 0.8;
      for (const k of [0.35, 0.65]) { c.beginPath(); c.moveTo(fx + 1, top + (fy - 5 - top) * k); c.lineTo(fx + (cx2 - fx) * k * 0.9 + (ex - fx) * k * 0.3, top + (cy2 - top) * k + (ey - top) * k * 0.3); c.stroke(); }
      const px = fx + (cx2 - fx) * 0.45 + (ex - fx) * 0.12, py = top + (cy2 - top) * 0.6 + (ey - top) * 0.2;
      c.fillStyle = '#f2b8a0'; c.fillRect(px - 3, py - 3, 6, 6); c.strokeStyle = '#c88a70'; c.lineWidth = 0.7; c.setLineDash([1.2, 1.2]); c.strokeRect(px - 3, py - 3, 6, 6); c.setLineDash([]);
      // the pennant at the masthead streams downwind
      c.save(); c.translate(fx, top - 3); c.rotate(windDir + Math.sin(t * 9) * 0.12);
      c.fillStyle = '#d8423a'; c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(7, -1 + Math.sin(t * 14) * 1.5, 13, Math.sin(t * 12) * 1.2); c.quadraticCurveTo(7, 1.5 + Math.sin(t * 14) * 1.5, 0, 2); c.closePath(); c.fill();
      c.restore(); c.lineCap = 'butt';
    };
    // Dora at the tiller and Enzo up in the bow, sitting up so you can see them, facing the way the boat goes
    const stern = [x - ch * 15, y - sh * 15], bow = [x + ch * 17, y + sh * 17];
    const order: [number, () => void][] = [
      [stern[1], () => drawChinchilla(c, 'dora', stern[0], stern[1] + 3 + bob, { face, h: 13, time: t })],
      [bow[1], () => drawChinchilla(c, 'enzo', bow[0], bow[1] + 3 + bob, { face, h: 12, time: t + 0.8 })],
      [foot[1] + 0.5, drawSail],
    ];
    order.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of order) draw();
  }
  private drawParticles(c: CanvasRenderingContext2D, dt: number, paused: boolean) {
    const keep: Particle[] = [];
    for (const p of this.parts) {
      if (!paused) { p.life += dt; p.x += p.vx * dt * HZ; p.y += p.vy * dt * HZ; p.vx *= 0.94; p.vy *= 0.94; }
      if (p.life >= p.max) continue; keep.push(p);
      const a = 1 - p.life / p.max;
      if (p.k === 0) blob(c, p.x, p.y, p.s * (1 + p.life), p.s * (1 + p.life), `rgba(255, 255, 255, ${a * 0.85})`);
      else if (p.k === 1) { c.fillStyle = `rgba(255, 240, 180, ${a})`; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
      else { c.fillStyle = `rgba(255, 220, 120, ${a})`; c.beginPath(); c.arc(p.x, p.y, p.s * a, 0, TAU); c.fill(); }
    }
    this.parts = keep.slice(-300);
  }
  private drawFog(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }, tick: number) {
    for (let i = 0; i < FOGS.length; i++) {
      const f = fogAt(i, tick); if (f.x + f.r < v.x0 || f.x - f.r > v.x1 || f.y + f.r < v.y0 || f.y - f.r > v.y1) continue;
      for (let k = 0; k < 9; k++) {
        const a = hash(i, k) * TAU + tick * 0.0004 * (k % 2 ? 1 : -1), d = Math.sqrt(hash(k, i)) * f.r * 0.62, r = f.r * (0.5 + hash(i * 3, k) * 0.35);
        const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * 0.8;
        c.globalAlpha = 0.5; c.drawImage(this.fogSprite, x - r, y - r * 0.8, r * 2, r * 1.6);
      }
      c.globalAlpha = 1;
    }
  }
  private drawRain(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }, t: number, windDir: number) {
    // rings where the drops land
    void windDir;
    c.strokeStyle = 'rgba(230, 245, 255, 0.4)'; c.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const ph = (t * 1.6 + hash(i, 5)) % 1, cyc = Math.floor(t * 1.6 + hash(i, 5)), x = v.x0 + hash(i, cyc) * (v.x1 - v.x0), y = v.y0 + hash(cyc, i) * (v.y1 - v.y0);
      c.globalAlpha = 1 - ph; c.beginPath(); c.ellipse(x, y, 2 + ph * 9, 1 + ph * 5, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
  }
  private drawRainStreaks(c: CanvasRenderingContext2D, v: { x0: number; x1: number; y0: number; y1: number }, t: number, windDir: number) {
    const sx = Math.cos(windDir) * 10, sy = 26;
    c.strokeStyle = 'rgba(210, 225, 245, 0.45)'; c.lineWidth = 1.3; c.beginPath();
    for (let i = 0; i < 160; i++) {
      const w = v.x1 - v.x0, h = v.y1 - v.y0, x = v.x0 + ((hash(i, 1) * w + t * sx * 30) % w + w) % w, y = v.y0 + ((hash(i, 2) * h + t * sy * 30) % h);
      c.moveTo(x, y); c.lineTo(x + sx, y + sy);
    }
    c.stroke();
  }
  private drawNight(c: CanvasRenderingContext2D, g: DriftwoodGame | null, v: { x0: number; x1: number; y0: number; y1: number }, t: number, glow: number, minute: number) {
    c.globalCompositeOperation = 'lighter';
    const spr = this.glowSprite, light = (x: number, y: number, r: number, a: number) => { c.globalAlpha = Math.min(1, a); c.drawImage(spr, x - r, y - r, r * 2, r * 2); };
    const flick = (i: number) => 0.85 + 0.15 * Math.sin(t * 7 + i * 3.1);
    for (const isl of ISLANDS) {
      if (isl.x + isl.reach + 300 < v.x0 || isl.x - isl.reach - 300 > v.x1 || isl.y + isl.reach + 300 < v.y0 || isl.y - isl.reach - 300 > v.y1) continue;
      const look = lookOf(isl), painted = !!this.img(isl.art);
      if (painted) light(isl.x, isl.y, isl.reach * 0.7, glow * 0.35);
      else look.windows.forEach(([wx, wy], i) => light(isl.x + wx, isl.y + wy, 14, glow * 0.9 * flick(i)));
      if (isl.dock) { const d = isl.dock; light(d.x - Math.cos(d.a) * 14, d.y - Math.sin(d.a) * 14, 22, glow * 0.7 * flick(9)); }
    }
    // the lighthouse: dim with an old wick, steady once Tamsin's wick arrives, sweeping far once Quill's lens is in
    const lh = ISLAND.lighthouse, look = lookOf(lh), painted = !!this.img(lh.art), lamp: Pt = painted ? [lh.x, lh.y - lh.reach * 0.55] : [lh.x + look.lamp![0], lh.y + look.lamp![1]];
    const lit = !g ? 1 : g.done.has(19) ? 1 : g.done.has(5) ? 0.55 : 0.25, reach = 260 + 900 * lit * lit;
    light(lamp[0], lamp[1], 40 + 30 * lit, glow * (0.6 + 0.4 * lit));
    c.globalAlpha = 1;
    for (const off of [0, Math.PI]) {
      const a = t * 0.7 + off, spread = 0.13, gr = c.createRadialGradient(lamp[0], lamp[1], 4, lamp[0], lamp[1], reach);
      gr.addColorStop(0, `rgba(255, 240, 180, ${0.45 * glow * lit})`); gr.addColorStop(1, 'rgba(255, 240, 180, 0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(lamp[0], lamp[1]); c.arc(lamp[0], lamp[1], reach, a - spread, a + spread); c.closePath(); c.fill();
    }
    // the regatta: lantern boats gather round the lighthouse
    if (g && g.regatta >= 1) {
      const n = g.regatta === 2 ? 40 : 18;
      for (let i = 0; i < n; i++) {
        const home = ISLANDS[i % ISLANDS.length], k = g.regatta === 2 ? 1 : Math.min(1, ((t * 0.02 + hash(i, 1)) % 1) * 1.2);
        const ang = hash(i, 2) * TAU + t * 0.05, r = 180 + hash(i, 3) * 260, tx = lh.x + Math.cos(ang) * r, ty = lh.y + Math.sin(ang) * r;
        const x = home.x + (tx - home.x) * k, y = home.y + (ty - home.y) * k;
        if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
        light(x, y, 24, glow * flick(i)); c.globalAlpha = 0.6 * glow; c.drawImage(spr, x - 4, y + 4, 8, 22);
      }
    }
    // the boat's own light: a little lamp at the stern, a proper lantern once bought
    if (g) { const b = g.boat, lx = b.x - Math.cos(b.h) * 18, ly = b.y - Math.sin(b.h) * 18; light(lx, ly, g.ups.lantern ? 120 : 34, glow * (g.ups.lantern ? 0.8 : 0.6) * flick(3)); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    void minute;
  }

  // ---------------------------------------------------------------- the HUD
  private drawHud(c: CanvasRenderingContext2D, g: DriftwoodGame, o: DrawOpts, t: number) {
    const W = this.W, H = this.H, small = Math.min(W, H) < 500, R = small ? 34 : 44, x0 = 12 + R, y0 = 12 + R;
    const Z = this.cam.z, bxs = W / 2 + (this.at.x - this.cam.x) * Z, bys = H / 2 + (this.at.y - this.cam.y) * Z;
    // the delivery arrow, circling the boat (or pinned to the screen's edge when the boat is off-centre)
    const goal = g.goal();
    if (goal && g.phase !== 'dock' && g.arrowShown()) {
      const d = ISLAND[goal.id].dock!, a = Math.atan2(d.y - g.boat.y, d.x - g.boat.x), dist = Math.hypot(d.x - g.boat.x, d.y - g.boat.y);
      if (dist > 160) {
        const rr = (small ? 50 : 64) + Math.sin(t * 3) * 3, ax = bxs + Math.cos(a) * rr, ay = bys + Math.sin(a) * rr;
        c.save(); c.translate(ax, ay); c.rotate(a);
        c.fillStyle = goal.why === 'regatta' ? '#ffd36a' : goal.why === 'deliver' ? '#ff8a5a' : '#fff4e0'; c.strokeStyle = 'rgba(60, 30, 20, 0.7)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(13, 0); c.lineTo(-7, -9); c.lineTo(-3, 0); c.lineTo(-7, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
        const label = `${goal.why === 'pickup' ? '✉ ' : ''}${ISLAND[goal.id].name}`, lx = bxs + Math.cos(a) * (rr + 28), ly = bys + Math.sin(a) * (rr + 22);
        c.font = `800 ${small ? 11 : 12.5}px ${FONT}`; const tw = c.measureText(label).width + 14;
        const px = Math.max(4, Math.min(W - tw - 4, lx - tw / 2)), py = Math.max(4, Math.min(H - 24, ly - 10));
        c.fillStyle = 'rgba(255, 250, 240, 0.85)'; roundRect(c, px, py, tw, 20, 10); c.fill();
        c.fillStyle = '#4a2a1a'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(label, px + 7, py + 10.5);
      }
    }
    // the jetty prompt when close enough to tie up
    const near = g.phase === 'sail' ? g.nearDock() : null;
    if (near) {
      const d = ISLAND[near].dock!, sx = W / 2 + (d.x - this.cam.x) * Z, sy = H / 2 + (d.y - this.cam.y) * Z - 34 - Math.sin(t * 4) * 3, slow = g.boat.v <= 1.0;
      const label = o.touch ? (slow ? 'Tap ⚓ Dock' : 'Slow down…') : slow ? 'E / Space: tie up' : 'Hold E to slow and tie up';
      c.font = `900 ${small ? 11 : 13}px ${FONT}`; const tw = c.measureText(label).width + 16;
      c.fillStyle = slow ? 'rgba(80, 170, 110, 0.92)' : 'rgba(230, 140, 60, 0.92)'; roundRect(c, sx - tw / 2, sy - 12, tw, 24, 12); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, sx, sy + 0.5);
    }
    // the compass: the boat's heading, the wind's arrow and strength, the no-go wedge, the coming shift
    c.save(); c.translate(x0, y0);
    c.fillStyle = 'rgba(255, 250, 240, 0.88)'; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.strokeStyle = 'rgba(90, 60, 40, 0.5)'; c.lineWidth = 2; c.stroke();
    const from = g.wind.dir + Math.PI, ng = g.noGo;
    c.fillStyle = 'rgba(230, 80, 80, 0.22)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R - 3, from - ng, from + ng); c.closePath(); c.fill();
    c.font = `900 ${small ? 9 : 10}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(90, 60, 40, 0.7)';
    c.fillText('N', 0, -R + 8); c.fillText('S', 0, R - 8); c.fillText('E', R - 8, 0); c.fillText('W', -R + 8, 0);
    // forecast: a dashed tick where the wind will swing to, with a countdown once it's near
    const nd = g.wind.nextDir + Math.PI, secs = Math.max(0, (g.wind.nextShift - g.tick) / HZ);
    if (Math.abs(wrap(nd - from)) > 0.08) {
      c.strokeStyle = `rgba(60, 120, 200, ${secs < 12 ? 0.9 : 0.45})`; c.setLineDash([3, 3]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(Math.cos(nd) * (R - 2), Math.sin(nd) * (R - 2)); c.lineTo(Math.cos(nd) * R * 0.45, Math.sin(nd) * R * 0.45); c.stroke(); c.setLineDash([]);
    }
    // wind arrow from the rim inward, fatter for stronger wind
    const ws = g.windStr, len = R * (0.5 + 0.35 * Math.min(1.3, ws));
    c.save(); c.rotate(g.wind.dir);
    c.strokeStyle = '#2f6fb8'; c.fillStyle = '#2f6fb8'; c.lineWidth = 2 + ws * 2.4;
    c.beginPath(); c.moveTo(-R + 4, 0); c.lineTo(-R + 4 + len, 0); c.stroke();
    c.beginPath(); c.moveTo(-R + 10 + len, 0); c.lineTo(-R + len - 2, -6 - ws * 2); c.lineTo(-R + len - 2, 6 + ws * 2); c.closePath(); c.fill();
    for (let i = 0; i < Math.round(ws * 3); i++) { c.lineWidth = 1.6; c.beginPath(); c.moveTo(-R + 6 + i * 5, 0); c.lineTo(-R + 2 + i * 5, -6); c.stroke(); }
    c.restore();
    // the boat's heading
    c.save(); c.rotate(g.boat.h); c.fillStyle = '#7a4a2a'; c.beginPath(); c.moveTo(R * 0.42, 0); c.lineTo(-R * 0.2, -R * 0.13); c.lineTo(-R * 0.12, 0); c.lineTo(-R * 0.2, R * 0.13); c.closePath(); c.fill(); c.restore();
    blob(c, 0, 0, 3, 3, '#4a2a1a');
    c.restore();
    // speed and wind, under the compass
    let y = y0 + R + 8;
    const label = (txt: string, sub: string, col = '#4a2a1a') => {
      c.font = `900 ${small ? 12 : 14}px ${FONT}`; const w1 = c.measureText(txt).width; c.font = `700 ${small ? 9.5 : 11}px ${FONT}`; const w2 = c.measureText(sub).width; const w = Math.max(w1, w2) + 14;
      c.fillStyle = 'rgba(255, 250, 240, 0.85)'; roundRect(c, x0 - w / 2, y, w, small ? 30 : 34, 10); c.fill();
      c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = col; c.font = `900 ${small ? 12 : 14}px ${FONT}`; c.fillText(txt, x0, y + 3); c.fillStyle = '#7a5a3a'; c.font = `700 ${small ? 9.5 : 11}px ${FONT}`; c.fillText(sub, x0, y + (small ? 17 : 19));
      y += (small ? 30 : 34) + 5;
    };
    const twaD = Math.round((Math.abs(g.twaSigned) * 180) / Math.PI), sail = twaD < (ng * 180) / Math.PI ? 'in irons!' : twaD < 70 ? 'close-hauled' : twaD < 110 ? 'beam reach' : twaD < 160 ? 'broad reach' : 'running';
    if (g.phase === 'dock' || g.phase === 'ending') label('0.0 kn', 'tied up', '#4a2a1a');
    else label(`${g.knots.toFixed(1)} kn`, sail, twaD < (ng * 180) / Math.PI ? '#c0402a' : '#4a2a1a');
    label(`wind ${(g.windStr * 10).toFixed(0)} kn`, secs < 12 ? `wind shift in ${Math.ceil(secs)} s` : (g.weather === 'squall' ? 'rain squall' : g.weather === 'gusty' ? 'gusty' : g.weather === 'calm' ? 'calm' : 'breezy'));
    if (o.manual && !small) this.telltale(c, g, x0, y + 4, t);
    else if (o.manual) this.telltale(c, g, x0 + R + 54, y0 - R + 12, t);
    // the clock dial and the minimap, top right
    const mw = small ? 120 : 168, mh = mw * 0.75, mx = W - mw - 12, my = 12;
    this.drawMinimap(c, g, mx, my, mw, mh, t);
    const dr = small ? 17 : 21, dx = mx - dr - 10, dy = my + dr;
    c.save(); c.translate(dx, dy);
    const dayA = (clockOf(g.minute) / 1440) * TAU + Math.PI / 2;
    c.fillStyle = 'rgba(255, 250, 240, 0.88)'; c.beginPath(); c.arc(0, 0, dr, 0, TAU); c.fill();
    const sky = c.createLinearGradient(0, -dr, 0, dr); sky.addColorStop(0, '#8fd0f0'); sky.addColorStop(0.5, '#f8c890'); sky.addColorStop(1, '#2a3a78');
    c.fillStyle = sky; c.beginPath(); c.arc(0, 0, dr - 3, 0, TAU); c.fill();
    c.fillStyle = 'rgba(20, 30, 70, 0.55)'; c.beginPath(); c.arc(0, 0, dr - 3, 0, Math.PI); c.fill();
    const sx = Math.cos(dayA) * (dr - 8), sy = Math.sin(dayA) * (dr - 8), part = dayPart(g.minute);
    if (part === 'night') { blob(c, sx, sy, 5, 5, '#f4f0d8'); blob(c, sx + 2, sy - 1, 4, 4, 'rgba(40, 50, 90, 0.9)'); } else blob(c, sx, sy, 5, 5, part === 'golden' ? '#ffb040' : '#ffe060');
    c.restore();
    c.font = `900 ${small ? 10 : 11.5}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
    const ct = `Day ${g.day} · ${clockText(g.minute)}`, cw = c.measureText(ct).width + 10;
    c.fillStyle = 'rgba(255, 250, 240, 0.85)'; roundRect(c, dx - cw / 2, dy + dr + 4, cw, 17, 8); c.fill(); c.fillStyle = '#4a2a1a'; c.fillText(ct, dx, dy + dr + 6.5);
    // scuffs
    if (g.scuffs > 0 && g.phase === 'sail') {
      c.font = `900 ${small ? 11 : 12.5}px ${FONT}`; const s = `hull scuffs ${g.scuffs}/3`, sw = c.measureText(s).width + 14;
      c.fillStyle = 'rgba(255, 230, 220, 0.9)'; roundRect(c, dx - sw / 2, dy + dr + 26, sw, 20, 10); c.fill(); c.fillStyle = '#a03a2a'; c.textBaseline = 'middle'; c.fillText(s, dx, dy + dr + 36.5);
    }
    if (this.dockPulse > 0) this.dockPulse = Math.max(0, this.dockPulse - 0.03);
  }
  /** The telltale ribbon for manual trim: flat and green in the sweet spot, fluttering when the sheet is off. */
  private telltale(c: CanvasRenderingContext2D, g: DriftwoodGame, x: number, y: number, t: number) {
    const w = 96, err = g.boat.trimErr, ok = Math.abs(err) < 0.07, col = ok ? '#3aa860' : Math.abs(err) < 0.2 ? '#e0a030' : '#d04a3a';
    c.fillStyle = 'rgba(255, 250, 240, 0.85)'; roundRect(c, x - w / 2 - 6, y, w + 12, 40, 10); c.fill();
    c.fillStyle = 'rgba(90, 60, 40, 0.25)'; c.fillRect(x - w / 2, y + 22, w, 4);
    const ideal = Math.max(0, Math.min(1, g.boat.sheet - err)); c.fillStyle = '#3aa860'; c.fillRect(x - w / 2 + ideal * w - 2, y + 18, 4, 12);
    blob(c, x - w / 2 + g.boat.sheet * w, y + 24, 5, 5, '#4a2a1a');
    c.save(); c.translate(x - 22, y + 10); c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0);
    for (let i = 1; i <= 6; i++) c.lineTo(i * 4, ok ? Math.sin(t * 6 + i) * 0.6 : Math.sin(t * 18 + i * 1.3) * (2 + Math.abs(err) * 14) * (i / 6) + (err < 0 ? i * 1.2 : 0));
    c.stroke(); c.restore();
    c.font = `800 10px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = col;
    c.fillText(ok ? 'trimmed!' : err > 0 ? 'haul in (W)' : 'ease out (S)', x + 6, y + 10);
  }
  private drawMinimap(c: CanvasRenderingContext2D, g: DriftwoodGame, x: number, y: number, w: number, h: number, t: number) {
    if (!this.mini || this.miniVer !== g.chartVersion) {
      const cv = this.mini ?? mk(200, 150), m = ctx2(cv); this.mini = cv; this.miniVer = g.chartVersion;
      m.clearRect(0, 0, 200, 150); m.drawImage(chartMap(), 0, 0, 200, 150);
      m.globalCompositeOperation = 'destination-in'; m.drawImage(chartMask(g, 0.05), 0, 0, 200, 150); m.globalCompositeOperation = 'destination-over';
      m.fillStyle = '#b8a888'; m.fillRect(0, 0, 200, 150); m.globalCompositeOperation = 'source-over';
    }
    c.save(); roundRect(c, x, y, w, h, 10); c.fillStyle = '#b8a888'; c.fill(); c.clip(); c.drawImage(this.mini, x, y, w, h);
    const s = w / LAKE_W, goal = g.goal();
    if (goal) { const d = ISLAND[goal.id].dock!; blob(c, x + d.x * s, y + d.y * s, 3.5 + Math.sin(t * 5), 3.5 + Math.sin(t * 5), '#e03a3a'); }
    c.translate(x + g.boat.x * s, y + g.boat.y * s); c.rotate(g.boat.h); c.fillStyle = '#4a2a1a'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-3.5, -3); c.lineTo(-3.5, 3); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(90, 60, 40, 0.6)'; c.lineWidth = 2; roundRect(c, x, y, w, h, 10); c.stroke();
  }
}
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

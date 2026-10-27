// Snapshot Safari in Canvas 2D: the sky and its sun, painted far hills, the trail's grass, rocks, trees, water and flowers,
// the creatures, Dora or Enzo with their camera, and the viewfinder. Also re-draws saved photos from their descriptions.
// Drawing only: the rules live in safari-game.ts. Painted art loads from /art/safari/ and the drawn versions stand in.
import { drawChinchilla, type ChinId } from './chinchilla-art';
import {
  SPECIES_BY_ID, FRAME_H, ASPECT, behaviourOf, sizeOf, frameOf,
  type SafariGame, type SafariEvent, type Photo, type Subject, type TrailId, type TimeId, type Pose, type Species, type Feature, type Facing, type Animal,
} from './safari-game';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** Chinchillas are drawn a little larger than life so they read on the trail. */
const CHIN_H = 0.78;

// ---- painted art, shared by the trail view and the photo prints
const ART = new Map<string, HTMLImageElement>();
const loaded = new Set<() => void>();
/** A painting by name, or null until it has loaded (or if it never does). */
export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = ART.get(name);
  if (!img) {
    img = new Image(); img.decoding = 'async'; img.src = `/art/safari/${name}.webp`; ART.set(name, img);
    img.onload = () => { for (const f of loaded) f(); };
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
/** Calls back whenever another painting arrives, so prints can redraw. Returns an unsubscribe. */
export function onArt(f: () => void) { loaded.add(f); return () => { loaded.delete(f); }; }

// ---- palettes
type Look = { sky: [string, string, string]; sun: [number, number, string]; grade: string; far: [string, string]; mid: string; ground: string; path: string; tuft: [string, string] };
const SKIES: Record<TimeId, { sky: [string, string, string]; sun: [number, number, string]; grade: string }> = {
  morning: { sky: ['#7fa8dc', '#c9d9ee', '#fbd9c2'], sun: [0.18, 0.62, '#fff1c9'], grade: 'rgba(255, 196, 170, 0.10)' },
  noon: { sky: ['#3f8ee0', '#86c0ef', '#d6ecf8'], sun: [0.64, 0.14, '#ffffff'], grade: 'rgba(255, 255, 255, 0.04)' },
  dusk: { sky: ['#3a3474', '#c86f78', '#ffb36b'], sun: [0.8, 0.66, '#ffd28a'], grade: 'rgba(255, 128, 60, 0.16)' },
};
const LAND: Record<TrailId, { far: [string, string]; mid: string; ground: string; path: string; tuft: [string, string] }> = {
  puna: { far: ['#8a8fb0', '#f4f2f8'], mid: '#b39a5c', ground: '#cfae62', path: '#b38f5e', tuft: ['#e2c06c', '#a9883e'] },
  forest: { far: ['#5f8a78', '#d6e6dc'], mid: '#3f6b4c', ground: '#557f45', path: '#7a5b3e', tuft: ['#6fa04f', '#3c6a33'] },
  salar: { far: ['#a7766a', '#f6eee8'], mid: '#d8cfc0', ground: '#ece7dc', path: '#d6cdbd', tuft: ['#9aa06a', '#6f7648'] },
  cliffs: { far: ['#7c6f80', '#e9e2ea'], mid: '#8a7462', ground: '#a08669', path: '#8a735c', tuft: ['#a7a874', '#77784e'] },
};
const lookOf = (tr: TrailId, tm: TimeId): Look => ({ ...SKIES[tm], ...LAND[tr] });
/** Each creature's colours: main coat, belly or pale parts, an accent (bill, face, crest) and the dark details. */
const PAL: Record<string, [string, string, string, string]> = {
  vicuna: ['#c98d4e', '#f6efe4', '#8a5a32', '#2d2018'], llama: ['#efe3cf', '#fffaf0', '#8e6a4a', '#2d2018'], alpaca: ['#f4ead8', '#fffaf0', '#c9a27c', '#2d2018'],
  flamingo: ['#f6a6b6', '#fbd3dc', '#1f1a1c', '#e35d7a'], condor: ['#2e2a2c', '#f4f1ec', '#d9a090', '#151214'], hummingbird: ['#5bb38a', '#d8e9c7', '#2a2a2a', '#3b7f63'],
  fox: ['#c4733c', '#f3e7d8', '#2d2018', '#8a4a24'], bear: ['#2b2522', '#e8d4a8', '#4a3d36', '#151110'], cavy: ['#8a6a4c', '#c9ae8a', '#3a2a1e', '#5a4330'],
  torrent: ['#e7e2da', '#ffffff', '#e0463c', '#2b2b2b'], coot: ['#2c2b30', '#4a4950', '#e0463c', '#f2c94c'], cat: ['#b9aa94', '#ece2d0', '#6a5a48', '#3d3329'],
  tinamou: ['#9c8458', '#d8c49a', '#5a4a30', '#3a2e1e'], caracara: ['#2b2726', '#f2ece2', '#f08a3c', '#151212'], goose: ['#f3f1ec', '#ffffff', '#e88a5a', '#4a4446'],
  rhea: ['#a89880', '#d9cfbe', '#5d5244', '#3a332a'], lapwing: ['#9aa29a', '#f1efe8', '#e88aa0', '#2b2b2b'], taruca: ['#9e8564', '#e2d4bc', '#5a4632', '#2d2018'],
  viscacha: ['#b7aa98', '#e9e1d2', '#6d6255', '#2d2620'], chinchilla: ['#8f8b93', '#e8e4e6', '#c9a0a8', '#26242b'], rooster: ['#ff6a2a', '#ffb070', '#1f1a1c', '#c94a14'],
  ibis: ['#4a3d4a', '#6e5a6e', '#8a7a6e', '#1f1a1f'], toucan: ['#4c6e8e', '#c8d8e4', '#f2c94c', '#1f2a36'], tapir: ['#3a3438', '#f2ece6', '#5a5054', '#1a1618'],
};

// ---- small drawing helpers
const ell = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, Math.abs(rx)), Math.max(0.1, Math.abs(ry)), rot, 0, Math.PI * 2); };
const fillEll = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0, stroke?: string, lw = 1) => {
  ell(c, x, y, rx, ry, rot); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
};
const stick = (c: CanvasRenderingContext2D, pts: number[], color: string, w: number) => {
  c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
};
/** A cheap, repeatable wobble for the hills and scattered details. */
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wave = (x: number, seed: number) => Math.sin(x * 0.9 + seed) * 0.5 + Math.sin(x * 2.3 + seed * 2.1) * 0.28 + Math.sin(x * 5.1 + seed * 0.7) * 0.12;

/** How the world maps to the canvas: pixels per metre, the world x at the centre and the screen y of the ground. */
type Cam = { w: number; h: number; ppm: number; cx: number; gy: number };
const sx = (k: Cam, x: number) => k.w / 2 + (x - k.cx) * k.ppm;
const sy = (k: Cam, y: number) => k.gy - y * k.ppm;

// ---- the backdrop: sky, sun, far hills, middle hills and the ground
function sky(c: CanvasRenderingContext2D, k: Cam, L: Look, t: number) {
  const g = c.createLinearGradient(0, 0, 0, Math.max(k.gy, 1));
  g.addColorStop(0, L.sky[0]); g.addColorStop(0.6, L.sky[1]); g.addColorStop(1, L.sky[2]);
  c.fillStyle = g; c.fillRect(0, 0, k.w, k.h);
  const [fx, fy, col] = L.sun, x = k.w * fx - k.cx * k.ppm * 0.01, y = Math.min(k.gy, k.h) * fy, r = Math.max(14, Math.min(k.w, k.h) * 0.06);
  const glow = c.createRadialGradient(x, y, r * 0.4, x, y, r * 5);
  glow.addColorStop(0, col + 'cc'); glow.addColorStop(1, col + '00');
  c.fillStyle = glow; c.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  fillEll(c, x, y, r, r, col);
  // soft clouds drift past
  c.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < 6; i++) {
    const span = k.w + 400, cx = ((hash(i) * span + t * (6 + i * 2) - k.cx * k.ppm * 0.05) % span + span) % span - 200, cy = Math.min(k.gy, k.h) * (0.12 + hash(i + 9) * 0.35), s = 30 + hash(i + 3) * 50;
    ell(c, cx, cy, s, s * 0.32); c.fill(); ell(c, cx + s * 0.5, cy - s * 0.15, s * 0.6, s * 0.3); c.fill(); ell(c, cx - s * 0.5, cy + 2, s * 0.5, s * 0.22); c.fill();
  }
}
function far(c: CanvasRenderingContext2D, k: Cam, tr: TrailId, L: Look) {
  const img = art(`far-${tr}`), top = k.gy - k.ppm * 6.5;
  if (img) {
    const ih = Math.max(k.ppm * 7, k.h * 0.4), iw = (img.naturalWidth / img.naturalHeight) * ih, off = ((k.cx * k.ppm * 0.12) % iw + iw) % iw;
    for (let x = -off; x < k.w; x += iw) c.drawImage(img, x, k.gy - ih * 0.94, iw, ih);
    return;
  }
  // drawn ranges: snowy volcanoes, misty ridges, red salt-flat mountains or tall cliffs
  const base = k.gy - k.ppm * 0.6, px = (x: number) => (x + k.cx * k.ppm * 0.12) / 160;
  for (const [layer, alpha] of [[0, 0.75], [1, 1]] as const) {
    c.beginPath(); c.moveTo(0, base);
    for (let x = 0; x <= k.w + 8; x += 8) {
      const v = px(x) * (layer ? 1.3 : 0.8) + layer * 7;
      const peak = tr === 'puna' ? Math.pow(Math.max(0, Math.sin(v * 0.9)), 3) * 1.4 + wave(v, 3 + layer) * 0.25 : tr === 'cliffs' ? Math.abs(wave(v * 1.4, 2 + layer)) * 1.3 : wave(v, 5 + layer) * 0.5 + 0.6;
      c.lineTo(x, base - (k.gy - top) * (0.25 + 0.45 * peak) * (layer ? 0.8 : 1));
    }
    c.lineTo(k.w, base); c.closePath();
    c.globalAlpha = alpha; c.fillStyle = layer ? L.far[0] : mix(L.far[0], L.sky[2], 0.45); c.fill(); c.globalAlpha = 1;
    if (tr === 'puna' && layer === 0) {
      // snow caps on the volcanoes
      c.save(); c.clip(); c.fillStyle = L.far[1]; c.fillRect(0, top - k.ppm, k.w, (k.gy - top) * 0.42); c.restore();
    }
  }
  if (tr === 'forest') { c.fillStyle = 'rgba(235, 245, 240, 0.35)'; c.fillRect(0, top, k.w, k.gy - top); }
}
function mid(c: CanvasRenderingContext2D, k: Cam, tr: TrailId, L: Look, t: number) {
  const base = k.gy, px = (x: number) => (x + k.cx * k.ppm * 0.45) / 90;
  c.beginPath(); c.moveTo(0, base);
  for (let x = 0; x <= k.w + 6; x += 6) c.lineTo(x, base - k.ppm * (tr === 'salar' ? 0.25 + wave(px(x), 1) * 0.12 : 0.9 + wave(px(x), 1) * 0.6));
  c.lineTo(k.w, base); c.closePath(); c.fillStyle = L.mid; c.fill();
  if (tr === 'forest') {
    // a misty tree line behind the trail
    c.fillStyle = 'rgba(52, 92, 66, 0.8)';
    const step = k.ppm * 1.4, off = ((k.cx * k.ppm * 0.45) % step + step) % step;
    for (let x = -off - step; x < k.w + step; x += step) {
      const n = Math.round((x + k.cx * k.ppm * 0.45) / step), hh = k.ppm * (2.4 + hash(n) * 1.6);
      ell(c, x, base - hh, step * 0.62, hh * 0.45); c.fill(); c.fillRect(x - 3, base - hh, 6, hh);
    }
    c.fillStyle = 'rgba(230, 242, 236, 0.28)'; c.fillRect(0, base - k.ppm * 4, k.w, k.ppm * 4);
  }
  if (tr === 'salar') {
    // the shimmer of the salt flat towards the horizon
    const g = c.createLinearGradient(0, base - k.ppm * 0.4, 0, base);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)'); g.addColorStop(1, `rgba(255, 255, 255, ${0.35 + Math.sin(t) * 0.05})`);
    c.fillStyle = g; c.fillRect(0, base - k.ppm * 0.4, k.w, k.ppm * 0.4);
  }
}
function ground(c: CanvasRenderingContext2D, k: Cam, tr: TrailId, L: Look) {
  if (k.gy >= k.h) return;
  const g = c.createLinearGradient(0, k.gy, 0, k.h);
  g.addColorStop(0, L.ground); g.addColorStop(1, mix(L.ground, '#3a2a1e', 0.35));
  c.fillStyle = g; c.fillRect(0, k.gy, k.w, k.h - k.gy);
  // the trail itself
  c.fillStyle = L.path; c.fillRect(0, k.gy + k.ppm * 0.18, k.w, k.ppm * 0.32);
  // little stones and tufts that scroll with the ground
  const step = k.ppm * 0.7, off = ((k.cx * k.ppm) % step + step) % step;
  for (let x = -off; x < k.w + step; x += step) {
    const n = Math.round((x + k.cx * k.ppm) / step), y = k.gy + k.ppm * (0.06 + hash(n) * 0.9);
    if (tr === 'salar') { c.strokeStyle = 'rgba(190, 180, 165, 0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + step * 0.5, y + k.ppm * 0.08); c.lineTo(x + step * 0.9, y - k.ppm * 0.02); c.stroke(); }
    else if (hash(n + 4) < 0.5) { c.fillStyle = L.tuft[hash(n + 1) < 0.5 ? 0 : 1]; for (let b = -2; b <= 2; b++) { c.beginPath(); c.moveTo(x + b * 2, y); c.lineTo(x + b * 4, y - k.ppm * 0.18); c.lineTo(x + b * 2 + 2, y); c.fill(); } }
    else { fillEll(c, x, y, k.ppm * 0.06, k.ppm * 0.035, 'rgba(90, 70, 50, 0.35)'); }
  }
}
/** Mixes two #rrggbb colours. */
function mix(a: string, b: string, t: number) {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
}

// ---- the trail's features
function feature(c: CanvasRenderingContext2D, k: Cam, f: Feature, tr: TrailId, L: Look, t: number, front: boolean) {
  const x = sx(k, f.x), base = k.gy, p = k.ppm;
  if (x < -p * f.w * 2 - 40 || x > k.w + p * f.w * 2 + 40) return;
  switch (f.kind) {
    case 'grass': {
      const n = Math.round(f.w * 7), h = f.h * p;
      for (let i = 0; i < n; i++) {
        if ((i % 2 === 0) !== front) continue;
        const bx = x + (i / (n - 1) - 0.5) * f.w * p, s = Math.sin(t * 1.6 + i * 0.7 + f.x) * p * 0.06, hh = h * (0.7 + hash(i + f.x) * 0.45);
        if (tr === 'forest') {
          // fern fronds
          c.strokeStyle = i % 3 ? '#4f8a3c' : '#3b6e2e'; c.lineWidth = Math.max(1.5, p * 0.05); c.beginPath(); c.moveTo(bx, base); c.quadraticCurveTo(bx + s, base - hh * 0.6, bx + s * 3 + (i % 2 ? 1 : -1) * p * 0.3, base - hh); c.stroke();
          for (let j = 1; j < 6; j++) { const yy = base - (hh * j) / 6, xx = bx + s * (j / 3); fillEll(c, xx + p * 0.08, yy, p * 0.11, p * 0.035, '#5c9a45', -0.5); fillEll(c, xx - p * 0.08, yy, p * 0.11, p * 0.035, '#5c9a45', 0.5); }
        } else if (tr === 'salar') {
          // round tola bushes
          if (i % 4 === 0) { fillEll(c, bx, base - hh * 0.42, p * 0.45, hh * 0.45, front ? L.tuft[0] : L.tuft[1]); fillEll(c, bx - p * 0.12, base - hh * 0.6, p * 0.18, hh * 0.15, 'rgba(255,255,255,0.18)'); }
        } else {
          c.fillStyle = (i * 7) % 3 === 0 ? L.tuft[1] : L.tuft[0];
          c.beginPath(); c.moveTo(bx - p * 0.06, base); c.quadraticCurveTo(bx + s, base - hh * 0.5, bx + s * 4, base - hh); c.quadraticCurveTo(bx + s + p * 0.02, base - hh * 0.45, bx + p * 0.07, base); c.fill();
        }
      }
      break;
    }
    case 'rock': {
      if (front) return;
      const w = f.w * p, h = f.h * p, col = tr === 'cliffs' ? '#8d7a6a' : tr === 'salar' ? '#9a8a7a' : '#8e8476';
      c.fillStyle = col; c.strokeStyle = 'rgba(60, 45, 35, 0.6)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x - w * 0.55, base); c.quadraticCurveTo(x - w * 0.6, base - h * 0.8, x - w * 0.2, base - h); c.quadraticCurveTo(x + w * 0.25, base - h * 1.06, x + w * 0.5, base - h * 0.7); c.quadraticCurveTo(x + w * 0.62, base - h * 0.3, x + w * 0.55, base); c.closePath(); c.fill(); c.stroke();
      fillEll(c, x - w * 0.15, base - h * 0.82, w * 0.25, h * 0.08, 'rgba(255, 255, 255, 0.18)');
      c.strokeStyle = 'rgba(60, 45, 35, 0.35)'; c.beginPath(); c.moveTo(x + w * 0.1, base - h * 0.9); c.lineTo(x + w * 0.02, base - h * 0.55); c.lineTo(x + w * 0.2, base - h * 0.3); c.stroke();
      if (tr === 'cliffs') { fillEll(c, x + w * 0.25, base - h * 0.4, w * 0.12, h * 0.05, '#c9b98a'); }
      break;
    }
    case 'tree': {
      if (front) return;
      const h = f.h * p, trunk = tr === 'forest' ? '#5a4632' : '#a0563a';
      stick(c, [x, base, x - p * 0.1, base - h * 0.45, x + p * 0.08, base - h * 0.75], trunk, Math.max(4, p * 0.22));
      stick(c, [x - p * 0.05, base - h * 0.5, x - p * 0.6, base - h * 0.7], trunk, Math.max(2, p * 0.1));
      stick(c, [x + p * 0.05, base - h * 0.62, x + p * 0.7, base - h * 0.74], trunk, Math.max(2, p * 0.09));
      const leaf = tr === 'forest' ? ['#3f7a44', '#5a9a52', '#2f5f36'] : tr === 'cliffs' ? ['#6f7f4a', '#8a9a5c', '#56653a'] : ['#7a8a4a', '#98a85c', '#5c6a36'];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, r = p * (0.6 + hash(i + f.x) * 0.35) * (f.w / 2.4);
        fillEll(c, x + Math.cos(a) * r * 0.9, base - h * 0.84 + Math.sin(a) * r * 0.5 + Math.sin(t + i) * 1, r * 0.75, r * 0.55, leaf[i % 3]);
      }
      if (tr === 'forest') {
        // moss and a bromeliad on the trunk
        fillEll(c, x - p * 0.04, base - h * 0.35, p * 0.14, p * 0.3, '#7fb05a');
        for (let i = -2; i <= 2; i++) fillEll(c, x + p * 0.12 + i * p * 0.06, base - h * 0.55, p * 0.05, p * 0.2, i ? '#c94a6a' : '#e86a3a', i * 0.35);
      }
      break;
    }
    case 'water': {
      if (front) return;
      const x0 = sx(k, f.x - f.w / 2), x1 = sx(k, f.x + f.w / 2), depth = p * 0.45;
      const col = tr === 'salar' ? ['#9fd8d8', '#e7b8c8'] : ['#5aa0c8', '#9fd2e8'];
      const g = c.createLinearGradient(0, base - p * 0.05, 0, base + depth); g.addColorStop(0, col[1]); g.addColorStop(1, col[0]);
      c.fillStyle = g; c.beginPath(); c.moveTo(x0, base + p * 0.02); c.quadraticCurveTo((x0 + x1) / 2, base - p * 0.06, x1, base + p * 0.02); c.quadraticCurveTo(x1 - p * 0.2, base + depth, (x0 + x1) / 2, base + depth); c.quadraticCurveTo(x0 + p * 0.2, base + depth, x0, base + p * 0.02); c.fill();
      c.strokeStyle = tr === 'forest' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.55)'; c.lineWidth = Math.max(1, p * 0.03);
      for (let i = 0; i < f.w * 1.5; i++) {
        const wx = x0 + ((i / (f.w * 1.5)) * (x1 - x0) + (tr === 'forest' ? t * p * 1.2 : t * p * 0.15)) % (x1 - x0), wy = base + depth * (0.2 + hash(i) * 0.6);
        c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + p * (tr === 'forest' ? 0.4 : 0.25), wy); c.stroke();
      }
      break;
    }
    case 'flower': {
      if (front) return;
      const h = f.h * p;
      for (let i = -1; i <= 1; i++) {
        const fx = x + i * p * 0.18, top = base - h * (0.85 + (i === 0 ? 0.15 : 0)), sway = Math.sin(t * 1.3 + i + f.x) * p * 0.03;
        stick(c, [fx, base, fx + sway, top], '#4f7a3c', Math.max(1.5, p * 0.035));
        const col = tr === 'forest' ? (i ? '#d6457a' : '#ff8a3c') : '#e86ab0';
        for (let j = 0; j < 4; j++) fillEll(c, fx + sway + Math.cos(j * 1.57) * p * 0.06, top + Math.sin(j * 1.57) * p * 0.06, p * 0.06, p * 0.09, col, j * 1.57);
        fillEll(c, fx + sway, top, p * 0.035, p * 0.035, '#ffe08a');
      }
      break;
    }
  }
}

// ---- the creatures, drawn while their paintings load
/** Draws a creature with its feet at (0, 0) facing right, `H` pixels tall and `W` wide. `t` animates, `face` turns its head. */
function beast(c: CanvasRenderingContext2D, sp: Species, pose: Pose, W: number, H: number, t: number, face: Facing, extra: { cria?: boolean } = {}) {
  const [main, pale, acc, dark] = PAL[sp.id] ?? ['#999', '#ddd', '#555', '#222'];
  const line = 'rgba(40, 28, 22, 0.75)', lw = Math.max(0.8, H * 0.025);
  const eye = (x: number, y: number, r: number) => {
    if (face === 'away') return;
    if (face === 'toward') { fillEll(c, x - r * 1.1, y, r, r, '#1a1414'); fillEll(c, x + r * 1.1, y, r, r, '#1a1414'); fillEll(c, x - r * 0.8, y - r * 0.4, r * 0.35, r * 0.35, '#fff'); fillEll(c, x + r * 1.4, y - r * 0.4, r * 0.35, r * 0.35, '#fff'); }
    else { fillEll(c, x, y, r, r, '#1a1414'); fillEll(c, x + r * 0.3, y - r * 0.35, r * 0.35, r * 0.35, '#fff'); }
  };
  const swing = Math.sin(t * 9), kind = sp.kind;
  c.lineJoin = 'round';
  if (kind === 'camelid' || kind === 'deer' || kind === 'canid' || kind === 'cat' || kind === 'bear' || kind === 'tapir' || kind === 'rodent') {
    // ---- four legs (or a round rodent body)
    const low = pose === 'lie' || pose === 'roll', jumpY = pose === 'jump' ? -H * 0.22 * Math.abs(Math.sin(t * 4)) : 0;
    const P = {
      camelid: { leg: 0.44, neck: 0.42, bodyRx: 0.36, bodyRy: 0.16, head: 0.1 }, deer: { leg: 0.46, neck: 0.22, bodyRx: 0.38, bodyRy: 0.17, head: 0.11 },
      canid: { leg: 0.42, neck: 0.12, bodyRx: 0.36, bodyRy: 0.2, head: 0.17 }, cat: { leg: 0.36, neck: 0.08, bodyRx: 0.36, bodyRy: 0.22, head: 0.2 },
      bear: { leg: 0.32, neck: 0.05, bodyRx: 0.4, bodyRy: 0.3, head: 0.24 }, tapir: { leg: 0.3, neck: 0.04, bodyRx: 0.42, bodyRy: 0.28, head: 0.2 },
      rodent: { leg: 0.12, neck: 0, bodyRx: 0.36, bodyRy: 0.36, head: 0.3 },
    }[kind];
    c.save(); c.translate(0, jumpY);
    if (pose === 'roll') { c.translate(0, -H * 0.3); c.rotate(Math.sin(t * 3) * 0.5 + (kind === 'rodent' ? 0.4 : 0.9)); c.translate(0, H * 0.3); }
    if (pose === 'shake') c.rotate(Math.sin(t * 28) * 0.06);
    const upright = kind === 'rodent' && (pose === 'up' || pose === 'sit');
    const by = low ? -H * 0.32 : upright ? -H * 0.45 : -H * (P.leg + P.bodyRy * 0.6), bx = -W * 0.05;
    // tail
    if (kind === 'canid' || kind === 'cat') {
      const tw = H * (kind === 'cat' ? 0.13 : 0.15);
      c.lineCap = 'round'; c.strokeStyle = line; c.lineWidth = tw + lw * 2; c.beginPath(); c.moveTo(bx - W * 0.3, by); c.quadraticCurveTo(bx - W * 0.5, by + H * 0.1 + swing * 2, bx - W * 0.52, by + H * 0.3); c.stroke();
      c.strokeStyle = kind === 'cat' ? main : main; c.lineWidth = tw; c.stroke();
      if (kind === 'cat') { c.strokeStyle = dark; c.lineWidth = tw * 0.9; c.setLineDash([tw * 0.5, tw * 0.6]); c.stroke(); c.setLineDash([]); }
      else fillEll(c, bx - W * 0.52, by + H * 0.3, tw * 0.5, tw * 0.6, pale);
    } else if (kind === 'rodent' && sp.id !== 'cavy') {
      const curl = sp.id === 'viscacha';
      c.strokeStyle = dark; c.lineWidth = H * (curl ? 0.08 : 0.14); c.lineCap = 'round'; c.beginPath(); c.moveTo(bx - W * 0.3, by + H * 0.25);
      c.quadraticCurveTo(bx - W * 0.6, by + H * 0.1, bx - W * 0.55, by - H * (curl ? 0.25 : 0.05)); c.stroke();
    } else if (kind === 'camelid' || kind === 'deer') fillEll(c, bx - W * 0.36, by - H * 0.03, W * 0.04, H * 0.06, kind === 'deer' ? pale : main, 0.4, line, lw);
    // legs
    if (!low && !upright) {
      const legC = kind === 'bear' || kind === 'tapir' ? dark : kind === 'camelid' && sp.id === 'vicuna' ? pale : main, lwid = H * (kind === 'bear' || kind === 'tapir' ? 0.12 : kind === 'rodent' ? 0.08 : 0.06);
      const walking = pose === 'walk' || pose === 'dance';
      for (const [i, lx] of [[0, -0.26], [1, -0.18], [2, 0.14], [3, 0.22]] as const) {
        const ph = walking ? Math.sin(t * 7 + i * 1.6) * H * 0.08 : pose === 'jump' ? (i < 2 ? -H * 0.06 : H * 0.06) : 0;
        const x0 = bx + lx * W * 1.1, y0 = by + H * P.bodyRy * 0.4;
        const near = i % 2 === 1;
        stick(c, [x0, y0, x0 + ph * 0.6, (pose === 'jump' ? -H * 0.1 : 0) - jumpY * 0], near ? line : 'rgba(40,28,22,0.5)', lwid + lw * 1.4);
        stick(c, [x0, y0, x0 + ph * 0.6, (pose === 'jump' ? -H * 0.1 : 0)], near ? legC : mix(legC.length === 7 ? legC : '#888888', '#000000', 0.2), lwid);
      }
    }
    // body
    const fluffy = sp.id === 'alpaca' || sp.id === 'llama' || sp.id === 'chinchilla';
    const brx = W * P.bodyRx * (upright ? 0.62 : 1), bry = H * P.bodyRy * (upright ? 1.25 : 1) * (low ? 0.9 : 1);
    if (fluffy) for (let i = 0; i < 7; i++) fillEll(c, bx + Math.cos(i) * brx * 0.75, by + Math.sin(i * 1.3) * bry * 0.6, brx * 0.42, bry * 0.55, main, 0, line, lw);
    fillEll(c, bx, by, brx, bry, main, upright ? -0.1 : 0, fluffy ? undefined : line, lw);
    if (kind === 'camelid' || kind === 'deer' || kind === 'canid' || kind === 'cat') fillEll(c, bx + brx * 0.1, by + bry * 0.55, brx * 0.7, bry * 0.4, pale);
    if (kind === 'tapir') fillEll(c, bx + brx * 0.1, by + bry * 0.5, brx * 0.8, bry * 0.35, mix(main, '#000000', 0.2));
    if (kind === 'cat') for (let i = 0; i < 4; i++) stick(c, [bx - brx * 0.6 + i * brx * 0.35, by - bry * 0.8, bx - brx * 0.55 + i * brx * 0.35, by - bry * 0.2], mix(main, '#3d3329', 0.5), lw * 1.6);
    if (sp.id === 'cavy' || sp.id === 'viscacha') fillEll(c, bx + brx * 0.25, by + bry * 0.45, brx * 0.55, bry * 0.4, pale);
    // neck and head
    let hx: number, hy: number;
    const hs = H * P.head;
    if (kind === 'rodent') { hx = bx + brx * (upright ? 0.4 : 0.85); hy = by - bry * (upright ? 0.95 : 0.35) + (pose === 'eat' ? H * 0.12 : 0); }
    else {
      const nx = bx + brx * 0.75, ny = by - bry * 0.3;
      const reach = pose === 'eat' ? [0.42, 0.08] : pose === 'up' ? [0.32, -(P.neck + 0.12)] : low ? [0.38, -P.neck * 0.7] : [0.36, -P.neck];
      hx = nx + W * (reach[0] - 0.26); hy = pose === 'eat' ? -hs * 0.6 : by + H * reach[1];
      if (kind === 'camelid' || kind === 'deer') { stick(c, [nx, ny, hx - hs * 0.2, hy + hs * 0.3], line, H * 0.13 + lw * 2); stick(c, [nx, ny, hx - hs * 0.2, hy + hs * 0.3], main, H * 0.13); if (fluffy) fillEll(c, (nx + hx) / 2, (ny + hy) / 2, H * 0.08, H * 0.12, main); }
    }
    // ears
    const earC = kind === 'rodent' && sp.id === 'chinchilla' ? acc : main;
    if (kind === 'rodent') { const er = sp.id === 'viscacha' ? [0.07, 0.2] : sp.id === 'chinchilla' ? [0.13, 0.15] : [0.06, 0.07]; fillEll(c, hx - hs * 0.2, hy - hs * 0.75, H * er[0], H * er[1], earC, -0.25, line, lw); }
    else if (kind === 'bear') { fillEll(c, hx - hs * 0.45, hy - hs * 0.7, hs * 0.28, hs * 0.28, dark, 0, line, lw); }
    else { const tall = kind === 'deer' ? [0.12, 0.3] : kind === 'canid' ? [0.2, 0.42] : kind === 'cat' ? [0.22, 0.28] : kind === 'tapir' ? [0.15, 0.2] : [0.1, 0.38]; fillEll(c, hx - hs * 0.2, hy - hs * 0.8, hs * tall[0] * 2, hs * tall[1] * 2, main, kind === 'deer' ? -0.9 : -0.2, line, lw); }
    // the head
    fillEll(c, hx, hy, hs * (kind === 'rodent' ? 0.8 : 0.62), hs * (kind === 'rodent' ? 0.7 : 0.5), main, 0, line, lw);
    if (face !== 'away' && kind !== 'rodent' && face !== 'toward') {
      // muzzle or trunk
      const mx = hx + hs * (kind === 'tapir' ? 0.8 : 0.6), my = hy + hs * 0.15;
      if (kind === 'tapir') { stick(c, [hx + hs * 0.4, hy, mx + hs * 0.2, my + hs * 0.35], line, hs * 0.35 + lw * 2); stick(c, [hx + hs * 0.4, hy, mx + hs * 0.2, my + hs * 0.35], main, hs * 0.35); fillEll(c, hx + hs * 0.45, hy + hs * 0.35, hs * 0.2, hs * 0.08, pale); }
      else fillEll(c, mx, my, hs * (kind === 'canid' ? 0.5 : 0.36), hs * (kind === 'canid' ? 0.2 : 0.3), kind === 'canid' || kind === 'cat' ? pale : kind === 'bear' ? acc : main, 0, line, lw);
      fillEll(c, mx + hs * (kind === 'canid' ? 0.45 : 0.3), my - hs * 0.05, hs * 0.08, hs * 0.07, '#1a1414');
    }
    if (face === 'toward' && kind !== 'rodent') fillEll(c, hx + hs * 0.05, hy + hs * 0.3, hs * 0.3, hs * 0.22, kind === 'bear' ? acc : pale);
    if (kind === 'bear' && face !== 'away') { c.strokeStyle = pale; c.lineWidth = hs * 0.12; ell(c, hx + hs * 0.18, hy - hs * 0.05, hs * 0.22, hs * 0.18); c.stroke(); if (face === 'toward') { ell(c, hx - hs * 0.22, hy - hs * 0.05, hs * 0.2, hs * 0.18); c.stroke(); } }
    if (kind === 'rodent' && face !== 'away') { fillEll(c, hx + hs * 0.7, hy + hs * 0.1, hs * 0.12, hs * 0.1, acc === '#3a2a1e' ? '#c98a8a' : '#d9a0a8'); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.8; for (const d of [-0.2, 0, 0.2]) { c.beginPath(); c.moveTo(hx + hs * 0.7, hy + hs * 0.12); c.lineTo(hx + hs * 1.5, hy + hs * (0.12 + d)); c.stroke(); } }
    eye(hx + hs * (face === 'toward' ? 0 : kind === 'rodent' ? 0.3 : 0.2), hy - hs * 0.12, Math.max(1.2, hs * (kind === 'rodent' ? 0.14 : 0.1)));
    if (pose === 'eat' && sp.likes) fillEll(c, hx + hs * 0.7, hy + hs * 0.45, hs * 0.12, hs * 0.12, '#8a2a5a');
    c.restore();
    // a tiny cria at the llama's side
    if (extra.cria) { c.save(); c.translate(W * 0.55, 0); beast(c, sp, 'stand', W * 0.45, H * 0.45, t + 1, face); c.restore(); }
    return;
  }
  // ---- birds
  const P = {
    wader: { leg: 0.5, neck: 0.32, body: [0.32, 0.17], head: 0.08 }, duck: { leg: 0.14, neck: 0.12, body: [0.42, 0.28], head: 0.16 },
    raptor: { leg: 0.16, neck: 0.1, body: [0.24, 0.36], head: 0.15 }, runner: { leg: sp.id === 'rhea' ? 0.42 : 0.16, neck: sp.id === 'rhea' ? 0.3 : 0.06, body: [0.38, sp.id === 'rhea' ? 0.18 : 0.32], head: sp.id === 'rhea' ? 0.07 : 0.16 },
    bird: { leg: 0.08, neck: 0.04, body: [0.3, 0.3], head: 0.2 },
  }[kind as 'wader' | 'duck' | 'raptor' | 'runner' | 'bird'];
  const flying = pose === 'fly' || pose === 'dive', swim = pose === 'swim' || (kind === 'duck' && pose !== 'stand' && pose !== 'up' && pose !== 'eat' && pose !== 'jump');
  const hop = pose === 'jump' ? -H * 0.25 * Math.abs(Math.sin(t * 5)) : pose === 'dance' ? -H * 0.04 * Math.abs(Math.sin(t * 6)) : 0;
  c.save(); c.translate(0, hop);
  if (pose === 'dive') c.rotate(0.7);
  const bw = W * P.body[0] * (flying ? 0.6 : 1), bh = H * P.body[1] * (flying && kind === 'raptor' ? 0.6 : 1);
  const by = flying ? -H * 0.5 : swim ? -bh * 0.5 : -H * (P.leg + P.body[1] * 0.7), bx = 0;
  const upright = kind === 'raptor' && !flying;
  // legs
  if (!flying && !swim) {
    const legC = kind === 'wader' ? (sp.id === 'flamingo' ? '#f08aa0' : sp.id === 'lapwing' ? '#e88aa0' : '#5a4a4a') : kind === 'raptor' ? '#d9c070' : '#c9a070';
    const oneLeg = pose === 'sit' && kind === 'wader';
    const walk = pose === 'walk' ? Math.sin(t * 8) * H * 0.07 : 0;
    stick(c, [bx - bw * 0.1, by + bh * 0.5, bx - bw * 0.1 + walk, 0], legC, Math.max(1.4, H * 0.03));
    if (!oneLeg) stick(c, [bx + bw * 0.1, by + bh * 0.5, bx + bw * 0.1 - walk, 0], legC, Math.max(1.4, H * 0.03));
    else stick(c, [bx, by + bh * 0.5, bx + bw * 0.3, by + bh * 1.2, bx - bw * 0.05, by + bh * 1.4], legC, Math.max(1.4, H * 0.03));
  }
  // tail
  if (kind === 'bird' && sp.id === 'hummingbird') fillEll(c, bx - bw * 1.1, by + bh * 0.4, bw * 0.5, bh * 0.15, dark, 0.5);
  else if (kind === 'bird' || kind === 'raptor') fillEll(c, bx - bw * 0.9, by + bh * (upright ? 0.8 : 0.2), bw * 0.55, bh * 0.2, dark, upright ? 1.1 : 0.3, line, lw);
  // the far wing when flying
  const flap = flying ? Math.sin(t * (sp.id === 'hummingbird' ? 40 : kind === 'raptor' ? 1.4 : 6)) : 0;
  const wingSpan = kind === 'raptor' ? W * 0.5 : W * 0.45;
  if (flying || pose === 'spread' || pose === 'dance') {
    const lift = flying ? flap * H * 0.3 : pose === 'dance' ? -H * 0.15 : -H * 0.25;
    c.fillStyle = mix(kind === 'raptor' ? dark : main, '#000000', 0.25); c.beginPath(); c.moveTo(bx, by - bh * 0.2); c.quadraticCurveTo(bx - wingSpan * 0.4, by + lift - H * 0.1, bx - wingSpan, by + lift * 1.2); c.quadraticCurveTo(bx - wingSpan * 0.5, by + bh * 0.3, bx, by + bh * 0.2); c.fill();
  }
  // body
  const bodyC = kind === 'duck' && sp.id === 'goose' ? main : main;
  fillEll(c, bx, by, bw, bh, bodyC, upright ? -1.2 : pose === 'eat' ? 0.25 : 0, line, lw);
  if (sp.id === 'tinamou') for (let i = 0; i < 8; i++) fillEll(c, bx - bw * 0.6 + hash(i) * bw * 1.2, by - bh * 0.5 + hash(i + 3) * bh, bw * 0.06, bh * 0.05, dark);
  if (kind === 'duck' && sp.id === 'goose') fillEll(c, bx - bw * 0.2, by - bh * 0.1, bw * 0.6, bh * 0.45, '#4a4446', 0.1);
  if (sp.id === 'rooster' || sp.id === 'caracara' || sp.id === 'condor') fillEll(c, bx - bw * 0.2, by + bh * 0.1, bw * 0.7, bh * 0.55, sp.id === 'rooster' ? '#1f1a1c' : dark, upright ? -1.2 : 0.1);
  if (sp.id === 'condor') fillEll(c, bx - bw * 0.15, by + bh * 0.2, bw * 0.55, bh * 0.25, '#f4f1ec', upright ? -1.2 : 0.1);
  if (sp.id === 'lapwing' || sp.id === 'toucan') fillEll(c, bx + bw * 0.25, by + bh * 0.3, bw * 0.55, bh * 0.45, pale);
  // the near wing
  if (flying || pose === 'spread' || pose === 'dance') {
    const lift = flying ? -flap * H * 0.3 : pose === 'dance' ? -H * 0.12 : -H * 0.3;
    c.fillStyle = kind === 'raptor' ? dark : sp.id === 'flamingo' ? '#e35d7a' : sp.id === 'lapwing' ? '#f1efe8' : mix(main, '#000000', 0.12);
    c.beginPath(); c.moveTo(bx + bw * 0.2, by - bh * 0.3); c.quadraticCurveTo(bx + wingSpan * 0.2, by + lift - H * 0.15, bx + wingSpan * 0.55, by + lift * 1.3); c.quadraticCurveTo(bx + wingSpan * 0.15, by + bh * 0.2, bx - bw * 0.2, by + bh * 0.2); c.fill();
    c.strokeStyle = line; c.lineWidth = lw; c.stroke();
    if (sp.id === 'flamingo' || sp.id === 'lapwing' || sp.id === 'condor') { c.fillStyle = sp.id === 'condor' ? '#f4f1ec' : '#1f1a1c'; c.beginPath(); c.moveTo(bx + wingSpan * 0.55, by + lift * 1.3); c.lineTo(bx + wingSpan * 0.32, by + lift * 0.9); c.lineTo(bx + wingSpan * 0.42, by + lift * 0.7 + bh * 0.3); c.fill(); }
  } else if (kind !== 'duck' || !swim) fillEll(c, bx - bw * 0.15, by - bh * 0.05, bw * 0.6, bh * 0.45, mix(main, '#000000', 0.15), upright ? -1.2 : 0.15);
  // neck and head
  let hx: number, hy: number;
  const hs = H * P.head;
  if (upright) { hx = bx + bw * 0.25; hy = by - bh * 0.95; }
  else if (flying) { hx = bx + bw * 1.3; hy = by - bh * 0.2; stick(c, [bx + bw * 0.6, by, hx, hy], main, Math.max(2, H * 0.05)); }
  else {
    const nb = [bx + bw * 0.75, by - bh * 0.3];
    const reach = pose === 'eat' ? [bw * 1.3, (swim ? 0 : -by) - hs * 0.4] : pose === 'up' ? [bw * 0.9, -H * (P.neck + 0.12)] : pose === 'sit' && kind === 'wader' ? [bw * 0.9, -H * P.neck * 0.7] : [bw * 1.05, -H * P.neck];
    hx = bx + reach[0]; hy = pose === 'eat' ? (swim ? by + bh * 0.4 : -hs * 0.6) : by + reach[1];
    if (P.neck > 0.08) {
      c.strokeStyle = line; c.lineWidth = H * 0.06 + lw * 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(nb[0], nb[1]); c.quadraticCurveTo(nb[0] + bw * (pose === 'eat' ? 0.8 : 0.1), (nb[1] + hy) / 2 - (pose === 'eat' ? H * 0.2 : 0), hx, hy); c.stroke();
      c.strokeStyle = sp.id === 'goose' ? '#ffffff' : main; c.lineWidth = H * 0.06; c.stroke();
    }
  }
  fillEll(c, hx, hy, hs * (sp.id === 'condor' ? 0.75 : 1), hs * (sp.id === 'condor' ? 0.65 : 0.85), sp.id === 'condor' ? acc : sp.id === 'torrent' ? '#ffffff' : sp.id === 'caracara' ? acc : main, 0, line, lw);
  if (sp.id === 'condor') fillEll(c, hx - hs * 0.6, hy + hs * 0.9, hs * 0.9, hs * 0.45, '#f4f1ec');
  if (sp.id === 'torrent') stick(c, [hx - hs * 0.8, hy - hs * 0.2, hx + hs * 0.5, hy - hs * 0.2], '#2b2b2b', hs * 0.2);
  if (sp.id === 'rooster') { fillEll(c, hx + hs * 0.1, hy - hs * 0.4, hs * 0.85, hs * 0.9, '#ff7a3a', 0, line, lw); }
  // bills
  if (face !== 'away') {
    const dir = face === 'toward' ? 0.3 : 1, billC = sp.id === 'flamingo' ? '#f2d6a0' : sp.id === 'toucan' ? acc : sp.id === 'coot' ? '#f2c94c' : sp.id === 'torrent' ? '#e0463c' : sp.id === 'goose' ? '#3a3436' : kind === 'raptor' ? '#d9c070' : '#3a3030';
    const len = sp.id === 'hummingbird' ? hs * 2.2 : sp.id === 'ibis' ? hs * 2 : sp.id === 'toucan' ? hs * 1.6 : sp.id === 'flamingo' ? hs * 1.4 : hs * 0.8;
    const bend = sp.id === 'ibis' ? hs * 0.8 : sp.id === 'flamingo' ? hs * 0.9 : kind === 'raptor' ? hs * 0.3 : 0;
    c.fillStyle = billC; c.strokeStyle = line; c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(hx + hs * 0.6 * dir, hy - hs * 0.25);
    c.quadraticCurveTo(hx + (hs * 0.6 + len * 0.6) * dir, hy - hs * 0.2, hx + (hs * 0.6 + len) * dir, hy + bend);
    c.quadraticCurveTo(hx + (hs * 0.6 + len * 0.5) * dir, hy + hs * (sp.id === 'toucan' ? 0.5 : 0.25), hx + hs * 0.6 * dir, hy + hs * 0.25); c.closePath(); c.fill(); c.stroke();
    if (sp.id === 'flamingo') fillEll(c, hx + (hs * 0.6 + len * 0.9) * dir, hy + bend * 0.9, hs * 0.3, hs * 0.3, '#1f1a1c');
    if (sp.id === 'coot') fillEll(c, hx + hs * 0.4, hy - hs * 0.5, hs * 0.25, hs * 0.3, '#e0463c');
  }
  eye(hx + hs * (face === 'toward' ? 0 : 0.25), hy - hs * 0.15, Math.max(1, hs * 0.16));
  if (sp.id === 'hummingbird' && flying) { c.fillStyle = 'rgba(255,255,255,0.45)'; ell(c, bx, by - bh * 0.6, bw * 0.8, bh * 1.2, -0.4); c.fill(); }
  c.restore();
  if (swim) { c.fillStyle = 'rgba(160, 210, 230, 0.55)'; c.fillRect(-W * 0.6, -bh * 0.1, W * 1.2, bh * 0.4); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-W * 0.5, -bh * 0.1); c.lineTo(W * 0.5, -bh * 0.1); c.stroke(); }
}

/** Draws one creature at (x, feet) in pixels: its painted sheet if loaded, otherwise the drawn version. */
function creature(c: CanvasRenderingContext2D, sp: Species, bi: number, x: number, feet: number, ppm: number, dir: 1 | -1, face: Facing, t: number, o: { cub?: boolean; flee?: boolean; alpha?: number } = {}) {
  const b = sp.b[bi] ?? sp.b[0], { w, h } = sizeOf(sp, b.pose, o.cub), W = w * ppm, H = h * ppm;
  c.save(); c.translate(x, feet); if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  // a soft shadow on the ground
  const sheet = art(`creature-${sp.id}`);
  c.scale(dir, 1);
  if (o.flee) c.rotate(-0.08);
  if (sheet) {
    const frames = sp.b.length, fw = sheet.naturalWidth / frames, fh = sheet.naturalHeight, s = Math.max(W, H) * (256 / 240);
    const bob = b.pose === 'walk' || b.pose === 'dance' ? Math.abs(Math.sin(t * 7)) * H * 0.04 : b.pose === 'jump' ? Math.abs(Math.sin(t * 4)) * H * 0.22 : 0;
    const squash = b.pose === 'fly' ? 1 + Math.sin(t * (sp.id === 'hummingbird' ? 40 : 5)) * 0.06 : 1;
    if (b.pose === 'shake') c.rotate(Math.sin(t * 28) * 0.05);
    if (b.pose === 'roll') { c.translate(0, -H * 0.3); c.rotate(Math.sin(t * 3) * 0.25); c.translate(0, H * 0.3); }
    c.drawImage(sheet, bi * fw, 0, fw, fh, -s / 2, -s * squash - bob + s * (8 / 256), s, s * squash);
    if (b.id === 'hum') { const cs = s * 0.45; c.drawImage(sheet, 0, 0, fw, fh, s * 0.25, -cs + cs * (8 / 256), cs, cs); }
  } else beast(c, sp, b.pose, W, H, t, face, { cria: b.id === 'hum' });
  c.restore();
}

// ---- Dora or Enzo with the camera
const camera = (c: CanvasRenderingContext2D, bob: number) => {
  c.fillStyle = '#3a3a44'; c.strokeStyle = '#1c1c22'; c.lineWidth = 0.6;
  c.beginPath(); c.roundRect(10.2, -15.4 + bob, 5.4, 4, 0.8); c.fill(); c.stroke();
  c.fillStyle = '#5a5a66'; c.fillRect(11, -16.4 + bob, 2, 1.1);
  fillEll(c, 16.2, -13.4 + bob, 1.5, 1.7, '#22222a', 0, '#1c1c22', 0.5); fillEll(c, 16.5, -13.6 + bob, 0.7, 0.8, '#7fb7e8');
  c.strokeStyle = '#c0504d'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(10.6, -12 + bob); c.quadraticCurveTo(8, -6 + bob, 5, -9 + bob); c.stroke();
};
function walker(c: CanvasRenderingContext2D, who: ChinId, x: number, base: number, ppm: number, g: { dir: 1 | -1; moving: number; pace: string; crouch: boolean; hidden: boolean }, t: number) {
  const h = CHIN_H * ppm * (g.crouch ? 0.82 : 1), sheet = art(`walker-${who}`);
  if (sheet) {
    const frame = g.crouch ? 3 : !g.moving ? 4 : g.pace === 'tiptoe' ? 2 : Math.floor(t * (g.pace === 'run' ? 10 : 6)) % 2;
    const fw = sheet.naturalWidth / 5, s = h * (256 / 220);
    c.save(); c.translate(x, base); c.scale(g.dir, 1); c.drawImage(sheet, frame * fw, 0, fw, sheet.naturalHeight, -s / 2, -s + s * (8 / 256), s, s); c.restore();
    return;
  }
  const run = g.moving ? t * (g.pace === 'run' ? 26 : g.pace === 'walk' ? 15 : 7) : undefined;
  c.save();
  if (g.crouch) { c.translate(x, base); c.scale(1, 0.86); c.translate(-x, -base); }
  drawChinchilla(c, who, x, base, { face: g.dir, h, time: t, run, moving: !!g.moving, decorate: camera });
  c.restore();
}

// ---- the viewfinder
function viewfinder(c: CanvasRenderingContext2D, k: Cam, g: SafariGame, t: number, label: string, sharp: number | null) {
  const F = frameOf(g.view), shake = (1 - g.steady) * (2 + g.view.zoom * 1.6);
  const jx = Math.sin(t * 23) * shake + Math.sin(t * 37) * shake * 0.5, jy = Math.cos(t * 19) * shake * 0.8;
  const x0 = sx(k, F.x0) + jx, x1 = sx(k, F.x1) + jx, y0 = sy(k, F.y1) + jy, y1 = sy(k, F.y0) + jy, w = x1 - x0, h = y1 - y0;
  // dim everything outside the frame a little
  c.fillStyle = 'rgba(20, 16, 30, 0.22)';
  c.beginPath(); c.rect(0, 0, k.w, k.h); c.rect(x1, y0, -w, h); c.fill('evenodd');
  c.strokeStyle = 'rgba(255, 255, 255, 0.28)'; c.lineWidth = 1; c.beginPath();
  for (const f of [1 / 3, 2 / 3]) { c.moveTo(x0 + w * f, y0); c.lineTo(x0 + w * f, y1); c.moveTo(x0, y0 + h * f); c.lineTo(x1, y0 + h * f); }
  c.stroke();
  const L = Math.min(w, h) * 0.16;
  c.lineWidth = 3; c.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  const corners = () => { c.beginPath(); for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { c.moveTo(cx, cy + dy * L); c.lineTo(cx, cy); c.lineTo(cx + dx * L, cy); } c.stroke(); };
  c.translate(1, 1); corners(); c.translate(-1, -1);
  c.strokeStyle = '#fffaf0'; c.lineWidth = 2.5; corners();
  // the focus dot: green when sharp, amber when soft, rose when wobbly
  const fx = x0 + w / 2, fy = y0 + h / 2;
  const col = sharp === null ? 'rgba(255,255,255,0.7)' : sharp >= 0.7 ? '#7fe0a0' : sharp >= 0.4 ? '#ffd86b' : '#ff8fa0';
  c.strokeStyle = col; c.lineWidth = 2; ell(c, fx, fy, 7, 7); c.stroke();
  c.beginPath(); c.arc(fx, fy, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.steady); c.stroke();
  if (label) {
    c.font = `800 ${Math.max(11, Math.min(14, w * 0.06))}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
    const tw = c.measureText(label).width + 16, ly = Math.min(y1 + 6, k.h - 26);
    c.fillStyle = 'rgba(30, 24, 40, 0.72)'; c.beginPath(); c.roundRect(fx - tw / 2, ly, tw, 20, 10); c.fill();
    c.fillStyle = '#fffaf0'; c.fillText(label, fx, ly + 4);
  }
  c.font = `800 11px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillStyle = 'rgba(255,250,240,0.85)';
  c.fillText(`${g.view.zoom.toFixed(1)}×`, x1 - 6, y1 - 5);
}

type Fly = { canvas: HTMLCanvasElement; born: number };
type Puff = { x: number; y: number; vx: number; vy: number; life: number; kind: 'dust' | 'note' | 'heart' | 'spark' };

export class SafariScene {
  private c: CanvasRenderingContext2D;
  w = 0; h = 0; private dpr = 1;
  /** Space kept clear at the bottom for the on-screen controls. */
  inset = 0;
  private cam: Cam = { w: 0, h: 0, ppm: 60, cx: 0, gy: 0 };
  private camX = 0; private flash = 0; private fly: Fly[] = []; private puffs: Puff[] = []; private wall = 0;
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    for (const n of ['far-puna', 'far-forest', 'far-salar', 'far-cliffs', 'walker-dora', 'walker-enzo']) art(n);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(320, r.width); this.h = Math.max(320, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
  }
  private layout(cx: number): Cam {
    const ppm = Math.min(this.h / 9, this.w / 9), gy = Math.min(this.h * 0.8, this.h - this.inset - ppm * 0.7);
    return { w: this.w, h: this.h, ppm, cx, gy };
  }
  /** Screen pixels to a world point on the trail. */
  toWorld(px: number, py: number) { const k = this.cam; return { x: k.cx + (px - k.w / 2) / k.ppm, y: (k.gy - py) / k.ppm }; }
  /** How many metres of trail fit across the screen. */
  span() { return this.w / this.cam.ppm; }
  feed(ev: SafariEvent[], g: SafariGame) {
    for (const e of ev) {
      if (e.kind === 'snap') {
        this.flash = 1;
        const cv = document.createElement('canvas'); cv.width = 150; cv.height = 100;
        if (e.photo) paintPhoto(cv, e.photo); else { const c = cv.getContext('2d'); if (c) { c.fillStyle = '#c9d9ee'; c.fillRect(0, 0, 150, 100); } }
        this.fly.push({ canvas: cv, born: this.wall });
      }
      if (e.kind === 'flee') for (let i = 0; i < 6; i++) this.puffs.push({ x: g.x + (Math.random() - 0.5) * 2 + 8 * g.dir, y: 0.2, vx: (Math.random() - 0.5) * 2, vy: 0.5 + Math.random(), life: 0.8, kind: 'dust' });
      if (e.kind === 'whistle') for (let i = 0; i < 3; i++) this.puffs.push({ x: g.x + 0.3 * g.dir, y: CHIN_H * 0.8, vx: g.dir * (0.6 + i * 0.2), vy: 0.6 + i * 0.15, life: 1.4, kind: 'note' });
      if (e.kind === 'trapBack') for (let i = 0; i < 8; i++) this.puffs.push({ x: g.x, y: 0.6, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random(), life: 1, kind: 'spark' });
    }
  }
  /** Draws the trail. With `menu` set, the camera drifts along the trail on its own and nobody walks it. */
  draw(g: SafariGame, o: { dt: number; menu?: boolean; label?: string; sharp?: number | null; aim?: boolean }) {
    const c = this.c; this.wall += o.dt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const lead = o.menu ? 0 : g.dir * Math.min(4, this.span() * 0.18);
    const want = o.menu ? 18 + ((this.wall * 1.2) % (g.trail.len - 40)) : g.x + lead;
    this.camX = this.camX === 0 || o.menu ? want : this.camX + (want - this.camX) * Math.min(1, o.dt * 3);
    const k = (this.cam = this.layout(this.camX)), L = lookOf(g.trail.id, g.time), t = this.wall;
    sky(c, k, L, t); far(c, k, g.trail.id, L); mid(c, k, g.trail.id, L, t); ground(c, k, g.trail.id, L);
    for (const f of g.trail.features) if (f.kind === 'water') feature(c, k, f, g.trail.id, L, t, false);
    for (const f of g.trail.features) if (f.kind !== 'water') feature(c, k, f, g.trail.id, L, t, false);
    // berries and the camera trap
    if (g.berry) { const bx = sx(k, g.berry.x); for (let i = 0; i < 7; i++) fillEll(c, bx + (hash(i) - 0.5) * k.ppm * 0.4, k.gy - k.ppm * (0.03 + hash(i + 5) * 0.06), k.ppm * 0.04, k.ppm * 0.04, i % 2 ? '#8a2a5a' : '#c0304a'); }
    if (g.trap && !g.trap.back) {
      const tx = sx(k, g.trap.x), ty = k.gy, p = k.ppm;
      stick(c, [tx - p * 0.12, ty, tx, ty - p * 0.3, tx + p * 0.12, ty], '#5a4632', Math.max(1.5, p * 0.03));
      c.fillStyle = '#4a5a3a'; c.beginPath(); c.roundRect(tx - p * 0.14, ty - p * 0.5, p * 0.28, p * 0.22, 3); c.fill();
      fillEll(c, tx + p * 0.06, ty - p * 0.39, p * 0.06, p * 0.06, '#22222a');
      if (Math.floor(t * 2) % 2) fillEll(c, tx - p * 0.08, ty - p * 0.46, p * 0.02, p * 0.02, '#ff4a4a');
      if (g.trap.shots.length) { c.font = `900 ${Math.max(10, p * 0.18)}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#fffaf0'; c.fillText(`📷 ${g.trap.shots.length}`, tx, ty - p * 0.62); }
    }
    // the creatures
    for (const a of g.animals) {
      if (a.state === 'gone') continue;
      const x = sx(k, a.x); if (x < -k.ppm * 4 || x > k.w + k.ppm * 4) continue;
      const feet = sy(k, a.y), b = behaviourOf(a);
      if (a.y < 0.05 && b.pose !== 'swim') fillEll(c, x, k.gy + 1, a.sp.w * k.ppm * 0.4, k.ppm * 0.06, 'rgba(30, 20, 15, 0.18)');
      creature(c, a.sp, a.beh, x, feet, k.ppm, a.dir, a.face, t + a.n * 1.3, { cub: a.cub, flee: a.state === 'flee', alpha: a.state === 'flee' ? Math.max(0, a.fleeFor / 2.5) : undefined });
      if (!o.menu) this.mood(a, x, feet, k, t);
    }
    if (!o.menu) walker(c, g.who, sx(k, g.x), k.gy, k.ppm, g, t);
    for (const f of g.trail.features) if (f.kind === 'grass') feature(c, k, f, g.trail.id, L, t, true);
    // little puffs: dust from fleeing feet, whistle notes, hearts, sparkles
    for (const p of this.puffs) {
      p.life -= o.dt; p.x += p.vx * o.dt; p.y += p.vy * o.dt;
      const x = sx(k, p.x), y = sy(k, p.y), a = Math.max(0, Math.min(1, p.life * 1.5));
      c.globalAlpha = a;
      if (p.kind === 'dust') fillEll(c, x, y, k.ppm * 0.18, k.ppm * 0.12, '#e8dcc8');
      else { c.font = `900 ${Math.round(k.ppm * 0.3)}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = p.kind === 'note' ? '#fffaf0' : p.kind === 'heart' ? '#ff8fb1' : '#ffd86b'; c.fillText(p.kind === 'note' ? '♪' : p.kind === 'heart' ? '♥' : '✦', x, y); }
      c.globalAlpha = 1;
    }
    this.puffs = this.puffs.filter((p) => p.life > 0);
    if (!o.menu && g.moving && g.pace === 'run' && Math.floor(t * 12) !== Math.floor((t - o.dt) * 12)) this.puffs.push({ x: g.x - g.dir * 0.3, y: 0.05, vx: -g.dir * 0.6, vy: 0.3, life: 0.5, kind: 'dust' });
    // the light of the time of day, and a soft vignette
    c.fillStyle = L.grade; c.fillRect(0, 0, k.w, k.h);
    const v = c.createRadialGradient(k.w / 2, k.h / 2, Math.min(k.w, k.h) * 0.45, k.w / 2, k.h / 2, Math.max(k.w, k.h) * 0.75);
    v.addColorStop(0, 'rgba(20, 10, 30, 0)'); v.addColorStop(1, 'rgba(20, 10, 30, 0.28)'); c.fillStyle = v; c.fillRect(0, 0, k.w, k.h);
    if (!o.menu && o.aim !== false && g.state === 'out') viewfinder(c, k, g, t, o.label ?? '', o.sharp ?? null);
    // the shutter flash and the print flying off to the roll
    if (this.flash > 0) { c.fillStyle = `rgba(255, 255, 255, ${this.flash * 0.7})`; c.fillRect(0, 0, k.w, k.h); this.flash = Math.max(0, this.flash - o.dt * 4); }
    for (const f of this.fly) {
      const age = this.wall - f.born, p = Math.min(1, age / 1.1), e = 1 - Math.pow(1 - p, 3);
      const x = k.w / 2 + (k.w - 80 - k.w / 2) * e, y = k.h * 0.45 + (40 - k.h * 0.45) * e, s = 1 - 0.65 * e;
      c.save(); c.globalAlpha = 1 - Math.max(0, (p - 0.8) * 5); c.translate(x, y); c.rotate(-0.06 + e * 0.12); c.scale(s, s);
      c.fillStyle = '#fffaf0'; c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 12; c.fillRect(-81, -56, 162, 124); c.shadowBlur = 0;
      c.drawImage(f.canvas, -75, -50, 150, 100); c.restore();
    }
    this.fly = this.fly.filter((f) => this.wall - f.born < 1.2);
  }
  /** Little signs of how an animal feels: a "!" when it is uneasy, hearts when it is calm, a twinkle during something rare. */
  private mood(a: Animal, x: number, feet: number, k: Cam, t: number) {
    const c = this.c, h = sizeOf(a.sp, behaviourOf(a).pose, a.cub).h * k.ppm, top = feet - h - k.ppm * 0.25;
    if (a.state === 'live' && a.alarm > 0.45) {
      c.font = `900 ${Math.round(k.ppm * 0.38)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillStyle = a.alarm > 0.75 ? '#ff7a8a' : '#ffd86b'; c.strokeStyle = 'rgba(40, 20, 30, 0.6)'; c.lineWidth = 3; c.strokeText('!', x, top + Math.sin(t * 10) * 2); c.fillText('!', x, top + Math.sin(t * 10) * 2);
    } else if (a.state === 'live' && a.calm >= 0.6 && hash(a.n + Math.floor(t * 0.7)) < 0.02) this.puffs.push({ x: a.x, y: a.y + h / k.ppm + 0.1, vx: 0, vy: 0.4, life: 1.2, kind: 'heart' });
    if (a.state === 'live' && behaviourOf(a).rare) { c.font = `900 ${Math.round(k.ppm * 0.22)}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = `rgba(255, 230, 140, ${0.5 + Math.sin(t * 6 + a.n) * 0.4})`; c.fillText('✦', x + Math.sin(t * 2 + a.n) * h * 0.5, top + Math.cos(t * 2.6) * h * 0.25); }
  }
}

/** Re-draws a saved photo from its description: the light and land of the trail, the subject where it sat in the frame, friends, and any blur. */
export function paintPhoto(canvas: HTMLCanvasElement, p: Photo) {
  const c = canvas.getContext('2d'); if (!c) return;
  const W = canvas.width, H = canvas.height, fh = FRAME_H / p.z, ppm = H / fh;
  const k: Cam = { w: W, h: H, ppm, cx: p.ax, gy: H / 2 + p.ay * ppm };
  const L = lookOf(p.tr, p.tm), t = (hashStr(p.id) % 1000) / 37;
  const work = document.createElement('canvas'); work.width = W; work.height = H;
  const w = work.getContext('2d'); if (!w) return;
  sky(w, k, L, t); far(w, { ...k, ppm: ppm * 0.6 }, p.tr, L); mid(w, k, p.tr, L, t); ground(w, k, p.tr, L);
  const subjects: Subject[] = [...p.ex, p];
  // the set: whatever each subject was standing on
  for (const s of subjects) {
    const sp = SPECIES_BY_ID[s.sp], b = sp?.b.find((x) => x.id === s.bh); if (!sp || !b) continue;
    const { h } = sizeOf(sp, b.pose, s.cub), cxW = p.ax + s.nx * fh * ASPECT, feetW = p.ay - s.ny * fh - h / 2;
    if (sp.spot === 'water' && b.pose !== 'fly') feature(w, k, { kind: 'water', x: cxW, w: 6, h: 0 }, p.tr, L, t, false);
    if (sp.spot === 'rock' && feetW > 0.1 && b.pose !== 'fly') feature(w, k, { kind: 'rock', x: cxW, w: Math.max(1.2, sp.w * 2), h: feetW }, p.tr, L, t, false);
    if (sp.spot === 'flower') feature(w, k, { kind: 'flower', x: cxW + 0.35, w: 0.5, h: Math.max(0.6, feetW + 0.1) }, p.tr, L, t, false);
    if (sp.spot === 'tree' && feetW > 0.3) { stick(w, [sx(k, cxW - 1.5), sy(k, feetW - 0.02), sx(k, cxW + 1.2), sy(k, feetW + 0.05)], '#5a4632', Math.max(3, ppm * 0.08)); for (let i = 0; i < 5; i++) fillEll(w, sx(k, cxW - 1.6 + i * 0.7), sy(k, feetW + 0.35 + hash(i) * 0.3), ppm * 0.35, ppm * 0.22, i % 2 ? '#3f7a44' : '#5a9a52'); }
  }
  for (const s of subjects) {
    const sp = SPECIES_BY_ID[s.sp], bi = sp?.b.findIndex((x) => x.id === s.bh) ?? -1; if (!sp || bi < 0) continue;
    const { h } = sizeOf(sp, sp.b[bi].pose, s.cub), x = W / 2 + s.nx * W, feet = H / 2 - s.ny * H + (h * ppm) / 2;
    if (feet > k.gy - 2 && sp.b[bi].pose !== 'swim') fillEll(w, x, feet + 1, sp.w * ppm * 0.4, ppm * 0.05, 'rgba(30, 20, 15, 0.2)');
    creature(w, sp, bi, x, feet, ppm, s.dir, s.face, t, { cub: s.cub });
  }
  w.fillStyle = L.grade; w.fillRect(0, 0, W, H);
  if (p.light >= 0.7) { const gl = w.createLinearGradient(0, 0, W, H); gl.addColorStop(0, 'rgba(255, 200, 120, 0.22)'); gl.addColorStop(1, 'rgba(255, 200, 120, 0)'); w.fillStyle = gl; w.fillRect(0, 0, W, H); }
  const v = w.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.72);
  v.addColorStop(0, 'rgba(30, 15, 10, 0)'); v.addColorStop(1, 'rgba(30, 15, 10, 0.3)'); w.fillStyle = v; w.fillRect(0, 0, W, H);
  // a shaky or rushed photo comes out soft
  const blur = Math.max(0, 0.8 - p.sharp) * (W / 60);
  c.clearRect(0, 0, W, H);
  if (blur > 0.3 && 'filter' in c) { c.filter = `blur(${blur.toFixed(1)}px)`; c.drawImage(work, 0, 0); c.filter = 'none'; }
  else c.drawImage(work, 0, 0);
  if (p.trap) { c.font = `800 ${Math.round(H * 0.07)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = 'rgba(255, 250, 240, 0.85)'; c.fillText('● TRAP', W * 0.03, H * 0.04); }
}
const hashStr = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

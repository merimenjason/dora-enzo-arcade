// Chinchilla Scribble's things in Canvas 2D, in the arcade's clean-line style: a thin dark outline, a soft gradient
// from a lit top to a shaded bottom, a highlight and a few texture marks. Every drawing sits in a w × h box with its
// bottom centre at (0, 0) and faces right; the scene flips it for things facing left.

import { coatLike, drawChinchilla } from './chinchilla-art.js';

export const INK = '#2a2233', LW = 2.2;
const KIT = coatLike('dora', { fur: '#ead2ad', back: '#dcc096', face: '#f3dfbe', shade: '#d2b58a', texture: '#d8bd92', tail: '#efd9b6', tailInner: '#d2b58a' });
type C = CanvasRenderingContext2D;
export type Look = { w: number; h: number; col: string; t: number; moving: boolean; mood: string; id: number };

// ---------- Colour and shape helpers ----------

const rgb = (c: string): [number, number, number] => {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)}, ${Math.round(x[1] + (y[1] - x[1]) * t)}, ${Math.round(x[2] + (y[2] - x[2]) * t)})`;
};
const hexOf = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return '#' + [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0')).join('');
};
export const light = (c: string, k = 0.3) => hexOf(c, '#ffffff', k);
export const dark = (c: string, k = 0.25) => hexOf(c, '#000000', k);

/** Lit from the top: a light stop, the colour, a darker base. */
function grad(c: C, col: string, y0: number, y1: number, x0 = 0, x1 = 0) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, light(col, 0.3)); g.addColorStop(0.5, col); g.addColorStop(1, dark(col, 0.18));
  return g;
}
/** Fills the current path with a top-lit gradient and outlines it. */
function paint(c: C, col: string, y0: number, y1: number, lw = LW) {
  c.fillStyle = grad(c, col, y0, y1); c.fill();
  if (lw > 0) { c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
}
function flat(c: C, col: string, lw = LW) { c.fillStyle = col; c.fill(); if (lw > 0) { c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); } }
function rr(c: C, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function ell(c: C, x: number, y: number, rx: number, ry: number, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2); }
function circ(c: C, x: number, y: number, r: number) { ell(c, x, y, r, r); }
function poly(c: C, pts: number[], close = true) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close) c.closePath(); }
function stroke(c: C, col = INK, lw = LW) { c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function line(c: C, pts: number[], col = INK, lw = LW) { poly(c, pts, false); stroke(c, col, lw); }
function shine(c: C, x: number, y: number, rx: number, ry: number, a = 0.55) { c.save(); c.globalAlpha *= a; ell(c, x, y, rx, ry); c.fillStyle = '#ffffff'; c.fill(); c.restore(); }
function shadeBottom(c: C, draw: () => void, y0: number, y1: number, a = 0.22) {
  c.save(); draw(); c.clip();
  c.fillStyle = `rgba(20, 10, 30, ${a})`; c.fillRect(-2000, y0, 4000, y1 - y0);
  c.restore();
}
function eye(c: C, x: number, y: number, r: number, sleepy = false) {
  if (sleepy) { line(c, [x - r, y, x + r, y], INK, Math.max(1.2, r * 0.6)); return; }
  circ(c, x, y, r); c.fillStyle = INK; c.fill();
  circ(c, x - r * 0.3, y - r * 0.35, r * 0.35); c.fillStyle = '#ffffff'; c.fill();
}
function wheel(c: C, x: number, y: number, r: number, spin: number) {
  circ(c, x, y, r); flat(c, '#34303a');
  circ(c, x, y, r * 0.55); flat(c, '#c9ccd4', 1.4);
  c.save(); c.translate(x, y); c.rotate(spin);
  for (let i = 0; i < 3; i++) { c.rotate((Math.PI * 2) / 3); line(c, [0, 0, r * 0.5, 0], '#7a7c86', 1.4); }
  c.restore();
}
function flames(c: C, x: number, y: number, w: number, h: number, t: number) {
  const f = (s: number, col: string, k: number) => {
    c.beginPath();
    const n = 3;
    c.moveTo(x - w / 2 * s, y);
    for (let i = 0; i < n; i++) {
      const cx = x - (w / 2) * s + ((i + 0.5) / n) * w * s;
      const hh = h * s * (0.75 + 0.25 * Math.sin(t * 9 + i * 2 + k));
      c.quadraticCurveTo(cx - (w / n) * s * 0.5, y - hh * 0.5, cx + Math.sin(t * 7 + i) * 3, y - hh);
      c.quadraticCurveTo(cx + (w / n) * s * 0.5, y - hh * 0.5, cx + (w / n) * s * 0.5, y);
    }
    c.closePath();
    c.fillStyle = col; c.fill();
  };
  f(1, '#ff7a2a', 0); c.lineWidth = 1.8; c.strokeStyle = '#b8430e'; c.stroke();
  f(0.68, '#ffc23a', 1); f(0.38, '#fff2a8', 2);
}
function grain(c: C, x0: number, x1: number, y0: number, y1: number, rows: number, col: string) {
  for (let i = 1; i <= rows; i++) {
    const y = y0 + ((y1 - y0) * i) / (rows + 1);
    const a = x0 + ((x1 - x0) * ((i * 37) % 10)) / 14;
    line(c, [a, y, a + (x1 - x0) * 0.3, y + 1], col, 1.3);
  }
}
function face(c: C, x: number, y: number, s: number, mood: string) {
  const sleepy = mood === 'sleepy';
  eye(c, x - 5 * s, y, 1.8 * s, sleepy); eye(c, x + 5 * s, y, 1.8 * s, sleepy);
  c.beginPath();
  if (mood === 'angry') { c.moveTo(x - 4 * s, y + 6 * s); c.quadraticCurveTo(x, y + 3 * s, x + 4 * s, y + 6 * s); line(c, [x - 7 * s, y - 4 * s, x - 3 * s, y - 2.5 * s], INK, 1.6 * s); line(c, [x + 7 * s, y - 4 * s, x + 3 * s, y - 2.5 * s], INK, 1.6 * s); }
  else { c.moveTo(x - 4 * s, y + 4 * s); c.quadraticCurveTo(x, y + 7 * s, x + 4 * s, y + 4 * s); }
  stroke(c, INK, 1.5 * s);
}

// ---------- Animals, from two shared bodies ----------

type Beast = {
  body: string; belly?: string; ear?: 'point' | 'round' | 'flop' | 'long' | 'none'; tail?: 'bushy' | 'thin' | 'curl' | 'tuft' | 'stub' | 'fluff';
  snout?: string; legs?: number; neck?: number; mane?: string; horns?: 'goat' | 'cow' | 'antler' | 'unicorn'; spots?: string; stripes?: string;
  hump?: boolean; trunk?: boolean; wool?: boolean; head?: number; nose?: string; long?: boolean;
};
/** Four-legged animals: a body, a head on a neck, legs that walk, and the parts that tell them apart. */
function beast(c: C, L: Look, b: Beast) {
  const { w, h, t, moving, mood } = L;
  const legH = h * (b.legs ?? 0.32), bodyH = h - legH - (b.neck ?? 0) * h;
  const bw = w * 0.72, bx = -w * 0.08, by = -legH - bodyH * 0.55;
  const headR = Math.min(w, h) * (b.head ?? 0.2);
  const hx = bw / 2 + bx + headR * 0.4, hy = by - bodyH * 0.35 - (b.neck ?? 0) * h;
  const step = moving ? Math.sin(t * 12) : 0;
  const col = b.body;
  // Tail
  const tx = bx - bw / 2, ty = by - bodyH * 0.2;
  if (b.tail === 'bushy' || b.tail === 'fluff') { ell(c, tx - headR * 0.5, ty - headR * 0.2, headR * 0.9, headR * 0.45, -0.6); paint(c, col, ty - headR, ty + headR); if (b.tail === 'bushy') { ell(c, tx - headR * 1.1, ty - headR * 0.6, headR * 0.3, headR * 0.22, -0.6); flat(c, '#ffffff', 0); } }
  else if (b.tail === 'thin') line(c, [tx + 2, ty, tx - headR * 0.9, ty + headR * 0.3, tx - headR * 1.2, ty + headR * 0.9], INK, Math.max(2.6, w * 0.03));
  else if (b.tail === 'curl') { c.beginPath(); c.arc(tx - 4, ty, 5, 0, Math.PI * 1.6); stroke(c, INK, 2.4); }
  else if (b.tail === 'tuft') { line(c, [tx + 2, ty, tx - headR * 0.8, ty + headR * 0.9], INK, 2.4); ell(c, tx - headR * 0.85, ty + headR, headR * 0.22, headR * 0.3); flat(c, dark(col, 0.35), 1.4); }
  else if (b.tail === 'stub') { circ(c, tx, ty, headR * 0.25); paint(c, col, ty - 6, ty + 6); }
  // Legs: far pair darker, near pair on top
  const legW = Math.max(6, bw * 0.12);
  const leg = (x: number, swing: number, far: boolean) => {
    rr(c, x - legW / 2 + swing, -legH - 4, legW, legH + 4, legW * 0.4);
    paint(c, far ? dark(col, 0.18) : col, -legH, 0);
    rr(c, x - legW / 2 - 1 + swing, -legH * 0.18, legW + 2, legH * 0.18, 3); flat(c, dark(col, 0.45), 1.4);
  };
  leg(bx - bw * 0.28, -step * 5, true); leg(bx + bw * 0.3, step * 5, true);
  // Neck
  if (b.neck) { poly(c, [bx + bw * 0.28, by - bodyH * 0.2, hx - headR * 0.6, hy, hx + headR * 0.2, hy + headR * 0.6, bx + bw * 0.45, by + bodyH * 0.1]); paint(c, col, hy, by); }
  // Body
  if (b.wool) {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; circ(c, bx + Math.cos(a) * bw * 0.4, by + Math.sin(a) * bodyH * 0.38, bodyH * 0.3); paint(c, col, by - bodyH, by + bodyH); }
    ell(c, bx, by, bw * 0.45, bodyH * 0.45); flat(c, col, 0);
  } else { ell(c, bx, by, bw / 2, bodyH / 2); paint(c, col, by - bodyH / 2, by + bodyH / 2); }
  if (b.hump) { ell(c, bx - bw * 0.05, by - bodyH * 0.45, bw * 0.22, bodyH * 0.4); paint(c, col, by - bodyH, by); ell(c, bx, by, bw / 2 - 1.5, bodyH / 2 - 1.5); flat(c, col, 0); }
  if (b.belly) { ell(c, bx + bw * 0.05, by + bodyH * 0.22, bw * 0.3, bodyH * 0.2); flat(c, b.belly, 0); }
  if (b.spots) for (let i = 0; i < 5; i++) { ell(c, bx - bw * 0.3 + i * bw * 0.15, by - bodyH * 0.15 + ((i * 7) % 3) * 5, bw * 0.06, bodyH * 0.12); flat(c, b.spots, 0); }
  if (b.stripes) for (let i = 0; i < 5; i++) line(c, [bx - bw * 0.3 + i * bw * 0.14, by - bodyH * 0.45, bx - bw * 0.26 + i * bw * 0.14, by - bodyH * 0.05], b.stripes, 3);
  shine(c, bx - bw * 0.15, by - bodyH * 0.25, bw * 0.18, bodyH * 0.1, 0.4);
  leg(bx - bw * 0.18, step * 5, false); leg(bx + bw * 0.4, -step * 5, false);
  // Mane
  if (b.mane) { ell(c, hx - headR * 0.2, hy, headR * 1.45, headR * 1.35); paint(c, b.mane, hy - headR * 1.4, hy + headR * 1.4); }
  // Ears behind the head
  const ear = (dx: number) => {
    if (b.ear === 'point') { poly(c, [hx + dx - headR * 0.35, hy - headR * 0.6, hx + dx, hy - headR * 1.55, hx + dx + headR * 0.35, hy - headR * 0.6]); paint(c, col, hy - headR * 1.6, hy); }
    else if (b.ear === 'round') { circ(c, hx + dx, hy - headR * 0.85, headR * 0.42); paint(c, col, hy - headR * 1.3, hy - headR * 0.5); circ(c, hx + dx, hy - headR * 0.85, headR * 0.22); flat(c, '#f4b2b8', 0); }
    else if (b.ear === 'long') { ell(c, hx + dx, hy - headR * 1.4, headR * 0.26, headR * 0.9, dx * 0.02); paint(c, col, hy - headR * 2.3, hy); ell(c, hx + dx, hy - headR * 1.4, headR * 0.12, headR * 0.65, dx * 0.02); flat(c, '#f4b2b8', 0); }
    else if (b.ear === 'flop') { ell(c, hx + dx - headR * 0.3, hy - headR * 0.1, headR * 0.3, headR * 0.7, 0.4); paint(c, dark(col, 0.2), hy - headR, hy + headR); }
  };
  ear(-headR * 0.35); ear(headR * 0.3);
  if (b.horns === 'goat' || b.horns === 'cow') { c.beginPath(); c.moveTo(hx - headR * 0.2, hy - headR * 0.8); c.quadraticCurveTo(hx - headR * 0.8, hy - headR * 1.8, hx - headR * 1.2, hy - headR * 1.2); stroke(c, INK, 5); stroke(c, '#efe6d2', 3); }
  if (b.horns === 'antler') for (const s of [-1, 1]) { line(c, [hx + s * 4, hy - headR * 0.8, hx + s * 8, hy - headR * 1.9, hx + s * 16, hy - headR * 2.3], INK, 4); line(c, [hx + s * 8, hy - headR * 1.9, hx + s * 2, hy - headR * 2.4], INK, 4); line(c, [hx + s * 4, hy - headR * 0.8, hx + s * 8, hy - headR * 1.9, hx + s * 16, hy - headR * 2.3], '#b98a5a', 2); }
  // Head: round, or long and nose-down for horses and camels.
  if (b.long) {
    c.beginPath(); c.ellipse(hx + headR * 0.55, hy + headR * 0.35, headR * 1.45, headR * 0.72, 0.6, 0, Math.PI * 2); paint(c, col, hy - headR, hy + headR * 1.6);
    c.beginPath(); c.ellipse(hx + headR * 1.2, hy + headR * 0.95, headR * 0.62, headR * 0.5, 0.6, 0, Math.PI * 2); paint(c, b.snout ?? light(col, 0.15), hy + headR * 0.4, hy + headR * 1.5);
    ell(c, hx + headR * 1.45, hy + headR * 1.0, headR * 0.12, headR * 0.09); flat(c, INK, 0);
    eye(c, hx + headR * 0.25, hy - headR * 0.05, Math.max(1.8, headR * 0.15), mood === 'sleepy');
    if (b.horns === 'unicorn') { poly(c, [hx - headR * 0.1, hy - headR * 0.6, hx + headR * 0.5, hy - headR * 2.1, hx + headR * 0.4, hy - headR * 0.4]); paint(c, '#ffd84a', hy - headR * 2, hy); }
    return;
  }
  ell(c, hx, hy, headR, headR * 0.9); paint(c, col, hy - headR, hy + headR);
  if (b.snout) { ell(c, hx + headR * 0.75, hy + headR * 0.3, headR * 0.55, headR * 0.42); paint(c, b.snout, hy, hy + headR * 0.8); ell(c, hx + headR * 1.15, hy + headR * 0.18, headR * 0.14, headR * 0.1); flat(c, b.nose ?? INK, 0); }
  if (b.trunk) { c.beginPath(); c.moveTo(hx + headR * 0.7, hy + headR * 0.1); c.quadraticCurveTo(hx + headR * 1.6, hy + headR * 0.6, hx + headR * 1.3, hy + headR * 1.8); stroke(c, INK, headR * 0.5 + 2); stroke(c, col, headR * 0.5 - 1); }
  if (b.horns === 'unicorn') { poly(c, [hx + headR * 0.2, hy - headR * 0.7, hx + headR * 0.9, hy - headR * 2, hx + headR * 0.55, hy - headR * 0.6]); paint(c, '#ffd84a', hy - headR * 2, hy); }
  eye(c, hx + headR * 0.35, hy - headR * 0.15, Math.max(1.8, headR * 0.13), mood === 'sleepy');
  if (mood === 'angry') line(c, [hx + headR * 0.1, hy - headR * 0.45, hx + headR * 0.6, hy - headR * 0.3], INK, 2);
  circ(c, hx + headR * 0.55, hy + headR * 0.3, headR * 0.12); c.fillStyle = 'rgba(240, 120, 140, 0.35)'; c.fill();
}

type Bird = { body: string; wing: string; belly?: string; beak?: string; crest?: string; tall?: boolean; flight?: boolean; flat?: boolean };
function birdie(c: C, L: Look, b: Bird) {
  const { w, h, t, mood } = L;
  const flap = b.flight ? Math.sin(t * 14) : 0;
  const by = b.flight ? -h * 0.5 : -h * 0.45, bw = w * (b.flight ? 0.45 : 0.4), bh = h * (b.tall ? 0.46 : 0.38);
  if (!b.flight) { line(c, [-bw * 0.2, -h * 0.12, -bw * 0.25, 0], '#e8962a', 2.4); line(c, [bw * 0.15, -h * 0.12, bw * 0.12, 0], '#e8962a', 2.4); }
  // Far wing when flying
  if (b.flight) { poly(c, [-bw * 0.2, by - bh * 0.2, bw * 0.3, by - bh * 0.3, -w * 0.1, by - bh * 0.3 - h * 0.45 * flap]); paint(c, dark(b.wing, 0.15), by - h, by); }
  ell(c, 0, by, bw, bh); paint(c, b.body, by - bh, by + bh);
  if (b.belly) { ell(c, bw * 0.2, by + bh * 0.25, bw * 0.55, bh * 0.55); flat(c, b.belly, 0); }
  // Tail
  poly(c, [-bw * 0.85, by - bh * 0.1, -bw * 1.45, by - bh * 0.6, -bw * 1.35, by + bh * 0.3]); paint(c, b.wing, by - bh, by + bh);
  const hr = Math.min(w, h) * (b.tall ? 0.2 : 0.24);
  const hx = bw * 0.75, hy = by - bh * (b.tall ? 0.9 : 0.75);
  circ(c, hx, hy, hr); paint(c, b.body, hy - hr, hy + hr);
  if (b.crest) { poly(c, [hx - hr * 0.3, hy - hr * 0.8, hx - hr * 0.1, hy - hr * 1.7, hx + hr * 0.3, hy - hr * 0.9]); paint(c, b.crest, hy - hr * 2, hy); }
  poly(c, [hx + hr * 0.8, hy - hr * 0.25, hx + hr * (b.flat ? 1.9 : 1.6), hy + hr * 0.05, hx + hr * 0.8, hy + hr * 0.35]); paint(c, b.beak ?? '#f2a23a', hy - hr, hy + hr, 1.6);
  eye(c, hx + hr * 0.3, hy - hr * 0.15, Math.max(1.6, hr * 0.17), mood === 'sleepy');
  // Near wing
  c.save(); c.translate(-bw * 0.1, by - bh * 0.1); c.rotate(b.flight ? -flap * 0.8 : 0);
  ell(c, 0, 0, bw * 0.62, bh * 0.5, -0.15); paint(c, b.wing, -bh, bh);
  line(c, [-bw * 0.3, bh * 0.05, bw * 0.2, -bh * 0.1], dark(b.wing, 0.25), 1.3);
  c.restore();
}

// ---------- Every thing ----------

type Draw = (c: C, L: Look) => void;

export const ART: Record<string, Draw> = {
  ladder: (c, { w, h, col }) => {
    const wood = col || '#c7874a';
    const n = Math.max(3, Math.round(h / 30));
    for (let i = 1; i < n; i++) { const y = -h + (h * i) / n; rr(c, -w / 2 + 6, y - 4, w - 12, 8, 3); paint(c, light(wood, 0.1), y - 4, y + 4, 1.8); }
    for (const x of [-w / 2 + 6, w / 2 - 6]) { rr(c, x - 6, -h, 12, h, 4); paint(c, wood, -h, 0); line(c, [x - 2, -h + 6, x - 2, -6], light(wood, 0.45), 1.6); grain(c, x - 4, x + 4, -h, 0, 5, dark(wood, 0.25)); }
    for (let i = 1; i < n; i++) for (const x of [-w / 2 + 6, w / 2 - 6]) { circ(c, x, -h + (h * i) / n, 1.8); flat(c, '#6d6a74', 1); }
  },
  stairs: (c, { w, h, col }) => {
    const wood = col || '#c7874a';
    for (let k = 0; k < 4; k++) { const sx = -w / 2 + (w * k) / 4, sh = (h * (k + 1)) / 4; rr(c, sx, -sh, w / 4 + (k < 3 ? 1 : 0), sh, 3); paint(c, k % 2 ? wood : dark(wood, 0.06), -sh, 0); line(c, [sx + 4, -sh + 3, sx + w / 4 - 4, -sh + 3], light(wood, 0.45), 1.6); grain(c, sx, sx + w / 4, -sh, 0, 2, dark(wood, 0.25)); }
  },
  plank: (c, { w, h, col }) => { const wood = col || '#c98b4e'; rr(c, -w / 2, -h, w, h, 3); paint(c, wood, -h, 0); grain(c, -w / 2, w / 2, -h, 0, 1, dark(wood, 0.25)); line(c, [-w / 2 + 4, -h + 3, w / 2 - 4, -h + 3], light(wood, 0.45), 1.4); for (const x of [-w / 2 + 8, w / 2 - 8]) { circ(c, x, -h / 2, 1.8); flat(c, '#6d6a74', 1); } },
  bridge: (c, { w, h, col }) => {
    const wood = col || '#c98b4e';
    line(c, [-w / 2, -h - 22, 0, -h - 8, w / 2, -h - 22], '#8a5a2c', 3);
    const n = Math.round(w / 26);
    for (let i = 0; i < n; i++) { const x = -w / 2 + (w * i) / n; rr(c, x + 1, -h, w / n - 2, h, 3); paint(c, i % 2 ? wood : dark(wood, 0.07), -h, 0, 1.8); line(c, [x + (w / n) / 2, -h, x + (w / n) / 2, -h - 22 + Math.abs(x + w / n / 2) / (w / 2) * 14], '#8a5a2c', 1.6); }
  },
  log: (c, { w, h, col }) => { const bark = col || '#9b6a43'; rr(c, -w / 2, -h, w, h, h / 2); paint(c, bark, -h, 0); for (let i = 0; i < 4; i++) line(c, [-w / 2 + 14 + i * w / 5, -h + 6, -w / 2 + 30 + i * w / 5, -h + 8], dark(bark, 0.3), 1.6); ell(c, w / 2 - h * 0.25, -h / 2, h * 0.28, h / 2 - 1); paint(c, '#e8c28e', -h, 0); ell(c, w / 2 - h * 0.25, -h / 2, h * 0.14, h * 0.26); stroke(c, '#b98a5a', 1.4); },
  rope: (c, { h }) => { line(c, [0, -h, 0, 0], INK, 7); line(c, [0, -h, 0, 0], '#d9b27a', 4.5); for (let y = -h + 8; y < 0; y += 10) line(c, [-2.2, y, 2.2, y + 5], '#a8804a', 1.2); circ(c, 0, -h, 6); flat(c, '#a8804a'); },
  vine: (c, { h, t }) => { c.beginPath(); c.moveTo(0, -h); for (let y = -h; y <= 0; y += 20) c.quadraticCurveTo(Math.sin(y / 30) * 8, y + 10, 0, y + 20); stroke(c, INK, 6); stroke(c, '#4f9a3e', 3.4); for (let y = -h + 14; y < 0; y += 26) { const s = (y / 26) % 2 ? 1 : -1; ell(c, s * 9, y, 8, 4.5, s * 0.5 + Math.sin(t + y) * 0.05); paint(c, '#6fc257', y - 5, y + 5, 1.5); } },
  beanstalk: (c, { w, h }) => { c.beginPath(); c.moveTo(0, 0); for (let y = 0; y > -h; y -= 30) c.quadraticCurveTo(Math.sin(y / 40) * w * 0.4, y - 15, 0, y - 30); stroke(c, INK, w * 0.4 + 2.4); stroke(c, '#5cb04a', w * 0.4 - 1); for (let y = -30; y > -h; y -= 34) { const s = (Math.round(y / 34) % 2) ? 1 : -1; ell(c, s * w * 0.42, y, w * 0.35, w * 0.16, s * 0.4); paint(c, '#76cf5f', y - 8, y + 8, 1.6); } ell(c, 0, -h, w * 0.3, w * 0.2); paint(c, '#86d467', -h - 10, -h + 10); },
  crate: (c, { w, h, col }) => { const wood = col || '#c98b4e'; rr(c, -w / 2, -h, w, h, 4); paint(c, wood, -h, 0); rr(c, -w / 2 + 6, -h + 6, w - 12, h - 12, 2); stroke(c, dark(wood, 0.3), 1.6); line(c, [-w / 2 + 8, -8, w / 2 - 8, -h + 8], INK, 5.5); line(c, [-w / 2 + 8, -8, w / 2 - 8, -h + 8], light(wood, 0.12), 3.2); for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circ(c, x * (w / 2 - 5), -h / 2 + y * (h / 2 - 5), 1.6); flat(c, '#6d6a74', 0.8); } shine(c, -w * 0.2, -h + 8, w * 0.2, 2.5, 0.35); },
  box: (c, { w, h, col }) => { const k = col || '#d9a866'; rr(c, -w / 2, -h, w, h, 3); paint(c, k, -h, 0); line(c, [0, -h, 0, -h * 0.55], '#e8d6b0', 6); line(c, [-w / 2 + 6, -h + 12, -w / 2 + 16, -h + 12], dark(k, 0.3), 1.4); poly(c, [-w / 2, -h, -w / 2 - 6, -h - 8, -w / 4, -h - 6, -w / 6, -h]); paint(c, light(k, 0.1), -h - 8, -h); },
  block: (c, { w, h, col }) => { const k = col || '#ef6a5a'; rr(c, -w / 2, -h, w, h, 6); paint(c, k, -h, 0); rr(c, -w / 2 + 7, -h + 7, w - 14, h - 14, 4); stroke(c, light(k, 0.35), 2); c.fillStyle = '#ffffff'; c.font = `900 ${Math.round(h * 0.45)}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', 0, -h / 2 + 1); c.lineWidth = 1.4; c.strokeStyle = INK; c.strokeText('A', 0, -h / 2 + 1); },
  brick: (c, { w, h, col }) => { const k = col || '#c65a3a'; rr(c, -w / 2, -h, w, h, 3); paint(c, k, -h, 0); for (let i = 0; i < 3; i++) { circ(c, -w / 3 + (i * w) / 3, -h / 2, 2.6); flat(c, dark(k, 0.3), 0); } },
  barrel: (c, { w, h, col }) => { const k = col || '#b9794a'; c.beginPath(); c.moveTo(-w / 2 + 4, -h); c.quadraticCurveTo(-w / 2 - 4, -h / 2, -w / 2 + 4, 0); c.lineTo(w / 2 - 4, 0); c.quadraticCurveTo(w / 2 + 4, -h / 2, w / 2 - 4, -h); c.closePath(); c.fillStyle = grad(c, k, 0, 0, -w / 2, w / 2); c.fill(); stroke(c); for (const y of [-h * 0.2, -h * 0.8]) { rr(c, -w / 2 - 1, y - 4, w + 2, 8, 3); paint(c, '#7a7c86', y - 4, y + 4, 1.6); } for (let i = -1; i <= 1; i++) line(c, [i * w * 0.2, -h + 6, i * w * 0.22, -6], dark(k, 0.25), 1.3); },
  table: (c, { w, h, col }) => { const k = col || '#c98b4e'; for (const x of [-w / 2 + 10, w / 2 - 10]) { rr(c, x - 5, -h + 12, 10, h - 12, 3); paint(c, dark(k, 0.1), -h, 0); } rr(c, -w / 2, -h, w, 14, 4); paint(c, k, -h, -h + 14); line(c, [-w / 2 + 6, -h + 4, w / 2 - 6, -h + 4], light(k, 0.45), 1.6); },
  chair: (c, { w, h, col }) => { const k = col || '#c98b4e'; rr(c, -w / 2, -h, 9, h, 3); paint(c, k, -h, 0); rr(c, w / 2 - 9, -h * 0.5, 9, h * 0.5, 3); paint(c, k, -h, 0); rr(c, -w / 2, -h * 0.55, w, 10, 3); paint(c, light(k, 0.08), -h * 0.55, -h * 0.45); for (let i = 1; i < 3; i++) line(c, [-w / 2 + 4, -h + i * 14, -w / 2 + 5, -h + i * 14], INK, 0); rr(c, -w / 2 + 2, -h + 6, 5, h * 0.3, 2); flat(c, light(k, 0.3), 0); },
  bed: (c, { w, h, col }) => { const k = col || '#8ab4f0'; rr(c, -w / 2, -h, 12, h, 4); paint(c, '#b98050', -h, 0); rr(c, -w / 2 + 6, -h * 0.62, w - 10, h * 0.42, 6); paint(c, k, -h * 0.62, -h * 0.2); rr(c, -w / 2 + 10, -h * 0.8, w * 0.24, h * 0.22, 8); paint(c, '#ffffff', -h * 0.8, -h * 0.58); rr(c, -w / 2 + 4, -h * 0.24, w - 6, h * 0.12, 3); paint(c, '#b98050', -h * 0.24, -h * 0.12); for (const x of [-w / 2 + 8, w / 2 - 8]) { rr(c, x - 4, -h * 0.14, 8, h * 0.14, 2); paint(c, '#8a5a2c', -h * 0.14, 0); } for (let i = 0; i < 4; i++) line(c, [-w / 2 + w * 0.35 + i * w * 0.14, -h * 0.58, -w / 2 + w * 0.38 + i * w * 0.14, -h * 0.28], light(k, 0.35), 1.4); },
  sofa: (c, { w, h, col }) => { const k = col || '#d86a6a'; rr(c, -w / 2 + 8, -h, w - 16, h * 0.55, 10); paint(c, dark(k, 0.08), -h, -h * 0.45); rr(c, -w / 2 + 10, -h * 0.55, w - 20, h * 0.35, 6); paint(c, k, -h * 0.55, -h * 0.2); for (const x of [-w / 2, w / 2 - 18]) { rr(c, x, -h * 0.7, 18, h * 0.55, 8); paint(c, k, -h * 0.7, -h * 0.15); } rr(c, -w / 2 + 2, -h * 0.2, w - 4, h * 0.12, 3); paint(c, dark(k, 0.2), -h * 0.2, -h * 0.08); line(c, [0, -h * 0.55, 0, -h * 0.22], dark(k, 0.3), 1.6); for (const x of [-w / 2 + 12, w / 2 - 12]) { rr(c, x - 3, -h * 0.08, 6, h * 0.08, 2); flat(c, '#6a4a2a', 1.2); } },
  bench: (c, { w, h, col }) => { const k = col || '#b98050'; for (const x of [-w / 2 + 14, w / 2 - 14]) { rr(c, x - 4, -h, 8, h, 2); paint(c, '#4a4a54', -h, 0); } for (let i = 0; i < 2; i++) { rr(c, -w / 2, -h + i * 10, w, 8, 3); paint(c, k, -h + i * 10, -h + i * 10 + 8, 1.8); } },
  trampoline: (c, { w, h, t }) => { const sag = Math.sin(t * 4) * 1.5; for (const x of [-w / 2 + 10, -w / 6, w / 6, w / 2 - 10]) line(c, [x, -h + 10, x + (x < 0 ? -4 : 4), 0], INK, 4); for (const x of [-w / 2 + 10, -w / 6, w / 6, w / 2 - 10]) line(c, [x, -h + 10, x + (x < 0 ? -4 : 4), 0], '#5a5a66', 2.2); ell(c, 0, -h + 8, w / 2, 9); paint(c, '#3a8ae8', -h, -h + 16); ell(c, 0, -h + 8 + sag, w / 2 - 8, 5); flat(c, '#2a2f44', 0); shine(c, -w * 0.2, -h + 4, w * 0.15, 2, 0.5); },
  spring: (c, { w, h }) => { for (let i = 0; i < 5; i++) { const y = -h * 0.15 - (i * h * 0.6) / 5; ell(c, 0, y, w / 2 - 4, 5); stroke(c, INK, 4); ell(c, 0, y, w / 2 - 4, 5); stroke(c, '#c9ccd4', 2.2); } rr(c, -w / 2, -h, w, 8, 3); paint(c, '#e84a3a', -h, -h + 8); rr(c, -w / 2, -8, w, 8, 3); paint(c, '#7a7c86', -8, 0); },
  pillow: (c, { w, h, col }) => { const k = col || '#9fc6f4'; c.beginPath(); c.moveTo(-w / 2, -h * 0.9); c.quadraticCurveTo(0, -h * 1.15, w / 2, -h * 0.9); c.quadraticCurveTo(w / 2 + 4, -h / 2, w / 2, -2); c.quadraticCurveTo(0, 3, -w / 2, -2); c.quadraticCurveTo(-w / 2 - 4, -h / 2, -w / 2, -h * 0.9); paint(c, k, -h, 0); line(c, [-w / 3, -h / 2, -w / 5, -h / 2 - 3], light(k, 0.5), 1.6); },
  blanket: (c, { w, h, col }) => { const k = col || '#e8726a'; rr(c, -w / 2, -h, w, h, 6); paint(c, k, -h, 0); for (let i = 1; i < 4; i++) line(c, [-w / 2 + (w * i) / 4, -h + 2, -w / 2 + (w * i) / 4, -2], light(k, 0.35), 2); line(c, [-w / 2 + 4, -h / 2, w / 2 - 4, -h / 2], light(k, 0.35), 2); for (let x = -w / 2 + 4; x < w / 2; x += 8) line(c, [x, 0, x, 4], k, 2); },
  scarf: (c, { w, h, col }) => { const k = col || '#e25a6a'; c.beginPath(); c.moveTo(-w / 2, -h * 0.7); c.quadraticCurveTo(0, -h * 1.1, w / 2, -h * 0.7); c.lineTo(w / 2 - 6, -h * 0.35); c.quadraticCurveTo(0, -h * 0.7, -w / 2 + 6, -h * 0.35); c.closePath(); paint(c, k, -h, -h * 0.3); rr(c, w / 4 - 7, -h * 0.55, 14, h * 0.55, 3); paint(c, k, -h * 0.55, 0); for (let i = 0; i < 3; i++) line(c, [w / 4 - 7, -h * 0.4 + i * 7, w / 4 + 7, -h * 0.4 + i * 7], light(k, 0.4), 1.6); for (let x = w / 4 - 6; x <= w / 4 + 6; x += 4) line(c, [x, 0, x, 4], k, 1.8); },
  tent: (c, { w, h, col }) => { const k = col || '#f28a3a'; poly(c, [-w / 2, 0, 0, -h, w / 2, 0]); paint(c, k, -h, 0); poly(c, [0, -h, -w * 0.14, 0, w * 0.14, 0]); flat(c, '#3a2a30'); line(c, [0, -h, 0, -h - 12], INK, 2.6); poly(c, [0, -h - 12, 12, -h - 8, 0, -h - 4]); flat(c, '#ffd84a', 1.4); line(c, [-w / 4, -h / 2, -w * 0.4, -h * 0.08], light(k, 0.4), 1.6); },
  gift: (c, { w, h, col }) => { const k = col || '#6a8ce8'; rr(c, -w / 2, -h * 0.8, w, h * 0.8, 4); paint(c, k, -h * 0.8, 0); rr(c, -w / 2 - 3, -h * 0.86, w + 6, h * 0.18, 3); paint(c, light(k, 0.1), -h, -h * 0.7); rr(c, -5, -h * 0.86, 10, h * 0.86, 1); paint(c, '#ffd84a', -h, 0, 1.4); for (const s of [-1, 1]) { ell(c, s * 8, -h * 0.94, 9, 5, s * 0.5); paint(c, '#ffd84a', -h - 5, -h, 1.6); } },
  chest: (c, { w, h, col }) => { const k = col || '#a86a3a'; rr(c, -w / 2, -h * 0.55, w, h * 0.55, 4); paint(c, k, -h * 0.55, 0); c.beginPath(); c.moveTo(-w / 2, -h * 0.55); c.quadraticCurveTo(-w / 2, -h, 0, -h); c.quadraticCurveTo(w / 2, -h, w / 2, -h * 0.55); c.closePath(); paint(c, light(k, 0.08), -h, -h * 0.55); for (const x of [-w * 0.3, w * 0.3]) { rr(c, x - 4, -h, 8, h, 1); paint(c, '#e8b83a', -h, 0, 1.4); } rr(c, -7, -h * 0.64, 14, 14, 3); paint(c, '#ffd84a', -h * 0.64, -h * 0.5, 1.6); },
  book: (c, { w, h, col }) => { const k = col || '#4a8ad8'; rr(c, -w / 2, -h, w, h, 3); paint(c, k, -h, 0); rr(c, w / 2 - 8, -h + 3, 6, h - 6, 1); flat(c, '#fbf6e6', 1.2); line(c, [-w / 2 + 6, -h + 8, w / 4, -h + 8], light(k, 0.45), 1.8); },
  anvil: (c, { w, h }) => { poly(c, [-w / 2, -h, w * 0.32, -h, w / 2, -h + 8, w * 0.32, -h + 16, w * 0.12, -h + 18, w * 0.18, -h * 0.28, w * 0.34, 0, -w * 0.34, 0, -w * 0.18, -h * 0.28, -w * 0.2, -h + 18, -w / 2 + 6, -h + 14]); paint(c, '#5a5d68', -h, 0); line(c, [-w / 2 + 6, -h + 3, w * 0.3, -h + 3], '#a4a8b4', 2); },
  piano: (c, { w, h }) => { rr(c, -w / 2, -h, w, h * 0.72, 6); paint(c, '#2e2a36', -h, -h * 0.28); rr(c, -w / 2 + 6, -h * 0.5, w - 12, h * 0.16, 2); flat(c, '#ffffff', 1.4); for (let i = 1; i < 12; i++) { const x = -w / 2 + 6 + ((w - 12) * i) / 12; line(c, [x, -h * 0.5, x, -h * 0.34], '#9a96a4', 1); if (i % 7 !== 3 && i % 7 !== 0) { rr(c, x - 2.5, -h * 0.5, 5, h * 0.09, 1); c.fillStyle = INK; c.fill(); } } for (const x of [-w / 2 + 12, w / 2 - 12]) { rr(c, x - 5, -h * 0.3, 10, h * 0.3, 3); paint(c, '#2e2a36', -h * 0.3, 0); } shine(c, -w * 0.2, -h + 8, w * 0.25, 3, 0.25); rr(c, -w / 2 + 16, -h * 0.9, w * 0.3, h * 0.2, 3); flat(c, '#fbf6e6', 1.4); },
  safe: (c, { w, h }) => { rr(c, -w / 2, -h, w, h, 6); paint(c, '#6a6e7a', -h, 0); rr(c, -w / 2 + 6, -h + 6, w - 12, h - 16, 3); stroke(c, '#4a4d58', 2); circ(c, 0, -h / 2, w * 0.16); paint(c, '#c9ccd4', -h / 2 - 10, -h / 2 + 10); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(c, [Math.cos(a) * w * 0.1, -h / 2 + Math.sin(a) * w * 0.1, Math.cos(a) * w * 0.14, -h / 2 + Math.sin(a) * w * 0.14], INK, 1.2); } rr(c, w * 0.26, -h * 0.6, 5, h * 0.2, 2); flat(c, '#c9ccd4', 1.2); },
  weight: (c, { w, h }) => { rr(c, -w / 2 + 12, -h * 0.6, w - 24, h * 0.2, 3); paint(c, '#a4a8b4', -h * 0.6, -h * 0.4); for (const x of [-w / 2, w / 2 - 16]) { rr(c, x, -h, 16, h, 5); paint(c, '#3a3d48', -h, 0); } c.fillStyle = '#ffffff'; c.font = `800 ${Math.round(h * 0.22)}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.fillText('10t', 0, -h * 0.68); },
  rock: (c, { w, h, col }) => { const k = col || '#9d948c'; poly(c, [-w / 2, 0, -w / 2 + 4, -h * 0.6, -w * 0.15, -h, w * 0.25, -h * 0.9, w / 2, -h * 0.4, w / 2 - 2, 0]); paint(c, k, -h, 0); line(c, [-w * 0.1, -h * 0.7, w * 0.05, -h * 0.4], dark(k, 0.25), 1.4); shine(c, -w * 0.15, -h * 0.75, w * 0.12, h * 0.08, 0.45); },
  boulder: (c, { w, h, col }) => { const k = col || '#948a82'; c.beginPath(); c.moveTo(-w / 2, 0); c.bezierCurveTo(-w / 2 - 6, -h * 0.7, -w * 0.2, -h - 4, w * 0.1, -h); c.bezierCurveTo(w * 0.45, -h, w / 2 + 6, -h * 0.4, w / 2, 0); c.closePath(); paint(c, k, -h, 0); shadeBottom(c, () => { c.beginPath(); c.moveTo(-w / 2, 0); c.bezierCurveTo(-w / 2 - 6, -h * 0.7, -w * 0.2, -h - 4, w * 0.1, -h); c.bezierCurveTo(w * 0.45, -h, w / 2 + 6, -h * 0.4, w / 2, 0); c.closePath(); }, -h * 0.35, 0); line(c, [-w * 0.2, -h * 0.6, -w * 0.05, -h * 0.4, w * 0.12, -h * 0.45], dark(k, 0.3), 1.6); line(c, [w * 0.2, -h * 0.25, w * 0.3, -h * 0.12], dark(k, 0.3), 1.4); for (const [x, y] of [[-0.3, -0.3], [0.25, -0.65]]) { ell(c, x * w, y * h, 4, 3); flat(c, light(k, 0.3), 1); } shine(c, -w * 0.12, -h * 0.8, w * 0.14, h * 0.07, 0.45); },
  fridge: (c, { w, h }) => { rr(c, -w / 2, -h, w, h, 8); paint(c, '#eef2f6', -h, 0); line(c, [-w / 2, -h * 0.62, w / 2, -h * 0.62], INK, 2); for (const y of [-h * 0.85, -h * 0.4]) { rr(c, w / 2 - 12, y, 5, h * 0.14, 2); flat(c, '#a4a8b4', 1.2); } rr(c, -w / 2 + 8, -h + 10, 12, 12, 3); flat(c, '#ef6a5a', 1.2); circ(c, -w / 4, -h * 0.45, 5); flat(c, '#6aa6e8', 1.2); },
  stove: (c, { w, h }) => { rr(c, -w / 2, -h, w, h, 5); paint(c, '#e8ecf0', -h, 0); rr(c, -w / 2 + 8, -h * 0.62, w - 16, h * 0.5, 4); paint(c, '#3a3642', -h * 0.62, -h * 0.12); rr(c, -w / 2 + 14, -h * 0.55, w - 28, h * 0.36, 3); c.fillStyle = 'rgba(255, 140, 60, 0.55)'; c.fill(); for (const x of [-w / 4, w / 4]) { ell(c, x, -h, w * 0.16, 4); flat(c, '#3a3642', 1.4); } for (let i = 0; i < 3; i++) { circ(c, -w / 4 + (i * w) / 4, -h * 0.8, 3.2); flat(c, '#7a7c86', 1.2); } },
  bucket: (c, { w, h, col }) => { const k = col || '#6aa6e8'; c.beginPath(); c.moveTo(-w / 2, -h * 0.8); c.lineTo(-w * 0.38, 0); c.lineTo(w * 0.38, 0); c.lineTo(w / 2, -h * 0.8); c.closePath(); paint(c, k, -h, 0); ell(c, 0, -h * 0.8, w / 2, h * 0.12); paint(c, '#4a9ef0', -h, -h * 0.7); shine(c, -w * 0.1, -h * 0.82, w * 0.2, h * 0.04, 0.6); c.beginPath(); c.arc(0, -h * 0.8, w * 0.45, Math.PI * 1.05, Math.PI * 1.95); stroke(c, INK, 2.4); line(c, [-w * 0.34, -h * 0.5, -w * 0.3, -h * 0.15], light(k, 0.4), 2); },
  water: (c, { w, h, t }) => { c.beginPath(); c.moveTo(-w / 2, 0); c.quadraticCurveTo(-w / 2, -h * 0.6, -w * 0.1, -h * 0.75); c.quadraticCurveTo(0, -h * 1.1 - Math.sin(t * 6) * 2, w * 0.1, -h * 0.75); c.quadraticCurveTo(w / 2, -h * 0.6, w / 2, 0); c.closePath(); c.fillStyle = 'rgba(90, 170, 240, 0.85)'; c.fill(); stroke(c, '#2a6ab0', 2); shine(c, -w * 0.15, -h * 0.45, w * 0.1, h * 0.12, 0.7); },
  'fire extinguisher': (c, { w, h }) => { rr(c, -w / 2, -h * 0.82, w, h * 0.82, w / 2); paint(c, '#e8403a', -h, 0); rr(c, -w / 4, -h, w / 2, h * 0.2, 3); paint(c, '#3a3642', -h, -h * 0.8); line(c, [w / 4, -h * 0.94, w * 0.7, -h * 0.98, w * 0.8, -h * 0.7], INK, 3); rr(c, -w / 2 + 4, -h * 0.55, w - 8, h * 0.18, 2); flat(c, '#ffffff', 1.2); shine(c, -w * 0.2, -h * 0.65, 3, h * 0.2, 0.4); },
  hose: (c, { w, h }) => { c.beginPath(); c.ellipse(-w * 0.1, -h / 2, w * 0.35, h * 0.42, 0, 0, Math.PI * 2); stroke(c, INK, 9); stroke(c, '#4ab85a', 6); c.beginPath(); c.ellipse(-w * 0.1, -h / 2, w * 0.2, h * 0.24, 0, 0, Math.PI * 2); stroke(c, INK, 9); stroke(c, '#4ab85a', 6); rr(c, w * 0.3, -h * 0.35, w * 0.2, h * 0.3, 3); paint(c, '#f2c230', -h * 0.4, -h * 0.05, 1.8); },
  'watering can': (c, { w, h }) => { rr(c, -w / 2, -h * 0.75, w * 0.6, h * 0.75, 6); paint(c, '#4ab85a', -h, 0); poly(c, [w * 0.08, -h * 0.35, w / 2, -h * 0.85, w / 2 + 4, -h * 0.75, w * 0.1, -h * 0.18]); paint(c, '#4ab85a', -h, 0, 1.8); c.beginPath(); c.arc(-w * 0.2, -h * 0.75, w * 0.22, Math.PI, 0); stroke(c, INK, 3.6); stroke(c, '#4ab85a', 1.8); },
  'rain cloud': (c, { w, h, t }) => {
    for (let i = 0; i < 9; i++) { const x = -w / 2 + 14 + ((i * 53) % (w - 28)), y = ((t * 260 + i * 37) % 140); line(c, [x, y, x - 3, y + 12], '#5aa6f0', 2.2); }
    const body = () => { c.beginPath(); c.moveTo(-w / 2 + 10, -h * 0.1); c.bezierCurveTo(-w / 2 - 6, -h * 0.5, -w * 0.25, -h * 0.85, -w * 0.1, -h * 0.7); c.bezierCurveTo(-w * 0.02, -h * 1.05, w * 0.3, -h * 1.05, w * 0.25, -h * 0.65); c.bezierCurveTo(w / 2 + 6, -h * 0.7, w / 2 + 4, -h * 0.1, w / 2 - 10, -h * 0.1); c.closePath(); };
    body(); paint(c, '#8f98b4', -h, 0); shadeBottom(c, body, -h * 0.35, 0, 0.25);
  },
  snowball: (c, { w, h }) => { circ(c, 0, -h / 2, w / 2); paint(c, '#f4f8ff', -h, 0); shine(c, -w * 0.15, -h * 0.65, w * 0.14, h * 0.1, 0.8); for (const [x, y] of [[0.15, -0.3], [-0.2, -0.25]]) { circ(c, x * w, y * h, 1.6); c.fillStyle = '#c9d8f0'; c.fill(); } },
  snowman: (c, { w, h, mood }) => { const r1 = w / 2, r2 = w * 0.38, r3 = w * 0.28; circ(c, 0, -r1, r1); paint(c, '#f4f8ff', -2 * r1, 0); circ(c, 0, -2 * r1 - r2 + 6, r2); paint(c, '#f4f8ff', -2 * r1 - 2 * r2, -2 * r1); circ(c, 0, -h + r3, r3); paint(c, '#f4f8ff', -h, -h + 2 * r3); poly(c, [2, -h + r3, r3 + 12, -h + r3 + 3, 2, -h + r3 + 6]); paint(c, '#f28a3a', -h, 0, 1.4); eye(c, -r3 * 0.2, -h + r3 * 0.8, 2, mood === 'sleepy'); eye(c, r3 * 0.4, -h + r3 * 0.8, 2, mood === 'sleepy'); rr(c, -r3 - 2, -h + r3 * 2 - 5, r3 * 2 + 4, 8, 3); paint(c, '#e8403a', -h, 0, 1.6); for (let i = 0; i < 3; i++) { circ(c, 0, -2 * r1 - r2 * 1.4 + i * r2 * 0.6, 2.4); c.fillStyle = INK; c.fill(); } line(c, [-r2, -2 * r1 - r2, -r2 - 18, -2 * r1 - r2 - 14], '#8a5a2c', 2.4); },
  ice: (c, { w, h }) => { rr(c, -w / 2, -h, w, h, 8); c.fillStyle = grad(c, '#bfe6ff', -h, 0); c.globalAlpha *= 0.9; c.fill(); c.globalAlpha /= 0.9; stroke(c, '#4a8ac8', LW); line(c, [-w / 2 + 8, -h + 10, -w / 2 + 20, -h + 22], '#ffffff', 3); line(c, [-w / 4, -h / 3, 0, -h / 2, w / 5, -h / 4], '#8ac4ec', 1.4); },
  fire: (c, { w, h, t }) => flames(c, 0, 0, w, h, t),
  campfire: (c, { w, h, t, mood }) => {
    if (mood !== 'out') flames(c, 0, -h * 0.2, w * 0.65, h * 1.2, t);
    else for (let i = 0; i < 3; i++) { const y = -h - ((t * 30 + i * 18) % 50); c.save(); c.globalAlpha = 0.5 - ((t * 30 + i * 18) % 50) / 110; circ(c, Math.sin(t + i) * 6, y, 7 + i * 2); c.fillStyle = '#c9ccd4'; c.fill(); c.restore(); }
    for (const [a, b] of [[-1, 0.3], [1, -0.3]]) { c.save(); c.translate(0, -h * 0.15); c.rotate(b); rr(c, -w / 2, -6, w, 12, 6); paint(c, '#8a5a3a', -6, 6); c.restore(); void a; }
    for (let i = 0; i < 7; i++) { const x = -w / 2 + 4 + (i * (w - 8)) / 6; ell(c, x, -3, 7, 5); paint(c, '#9d948c', -8, 2, 1.5); }
  },
  torch: (c, { w, h, t }) => { rr(c, -4, -h * 0.72, 8, h * 0.72, 3); paint(c, '#8a5a2c', -h, 0); rr(c, -7, -h * 0.76, 14, 8, 2); paint(c, '#6d6a74', -h, -h * 0.6, 1.6); flames(c, 0, -h * 0.74, w, h * 0.34, t); },
  candle: (c, { w, h, t }) => { rr(c, -w / 2 + 3, -h * 0.66, w - 6, h * 0.66, 3); paint(c, '#fbf2dc', -h, 0); ell(c, 0, 0, w / 2 + 2, 3); paint(c, '#e8b83a', -3, 3, 1.4); line(c, [0, -h * 0.66, 0, -h * 0.72], INK, 1.6); flames(c, 0, -h * 0.7, w * 0.6, h * 0.34, t); },
  heater: (c, { w, h, t }) => { rr(c, -w / 2, -h, w, h * 0.9, 6); paint(c, '#e8ecf0', -h, -h * 0.1); for (let i = 0; i < 5; i++) { const x = -w / 2 + 10 + (i * (w - 20)) / 4; rr(c, x - 3, -h * 0.85, 6, h * 0.6, 3); c.fillStyle = mix('#ff8a3a', '#ffd23a', (Math.sin(t * 3 + i) + 1) / 2); c.fill(); stroke(c, INK, 1.2); } for (const x of [-w / 2 + 8, w / 2 - 8]) { rr(c, x - 4, -h * 0.12, 8, h * 0.12, 2); flat(c, '#7a7c86', 1.2); } for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-w / 4 + i * w / 4, -h - 4); c.quadraticCurveTo(-w / 4 + i * w / 4 + 5, -h - 12, -w / 4 + i * w / 4, -h - 20 - Math.sin(t * 3 + i) * 3); stroke(c, 'rgba(255, 140, 60, 0.6)', 2); } },
  sun: (c, { w, h, t, mood }) => { const r = w * 0.32; c.save(); c.translate(0, -h / 2); c.rotate(t * 0.4); for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); poly(c, [r * 1.05, -5, r * 1.5, 0, r * 1.05, 5]); paint(c, '#ffc23a', -5, 5, 1.6); } c.restore(); circ(c, 0, -h / 2, r); paint(c, '#ffd84a', -h / 2 - r, -h / 2 + r); face(c, 0, -h / 2, r / 14, mood); },
  lamp: (c, { w, h }) => { rr(c, -w * 0.3, -6, w * 0.6, 6, 2); paint(c, '#4a4a54', -6, 0); line(c, [0, -6, 0, -h * 0.7], INK, 4.4); line(c, [0, -6, 0, -h * 0.7], '#7a7c86', 2.4); poly(c, [-w * 0.32, -h * 0.68, w * 0.32, -h * 0.68, w / 2, -h * 0.4, -w / 2, -h * 0.4]); paint(c, '#ffe08a', -h * 0.7, -h * 0.4); c.beginPath(); c.moveTo(-w / 2, -h * 0.4); c.lineTo(w / 2, -h * 0.4); stroke(c); poly(c, [-w / 2 + 3, -h * 0.4, w / 2 - 3, -h * 0.4, w, 0, -w, 0]); c.fillStyle = 'rgba(255, 230, 150, 0.18)'; c.fill(); },
  lantern: (c, { w, h }) => { c.beginPath(); c.arc(0, -h * 0.86, w * 0.22, Math.PI, 0); stroke(c, INK, 2.4); rr(c, -w / 2, -h * 0.8, w, h * 0.12, 3); paint(c, '#3a3642', -h * 0.8, -h * 0.68); rr(c, -w / 2 + 4, -h * 0.68, w - 8, h * 0.56, 4); paint(c, '#ffd86a', -h * 0.68, -h * 0.12); circ(c, 0, -h * 0.4, w * 0.16); c.fillStyle = '#fff6c8'; c.fill(); rr(c, -w / 2, -h * 0.12, w, h * 0.12, 3); paint(c, '#3a3642', -h * 0.12, 0); },
  flashlight: (c, { w, h }) => { rr(c, -w / 2, -h * 0.8, w * 0.7, h * 0.6, 4); paint(c, '#3a3642', -h, 0); poly(c, [w * 0.2, -h * 0.85, w / 2, -h, w / 2, 0, w * 0.2, -h * 0.15]); paint(c, '#c9ccd4', -h, 0); rr(c, -w * 0.2, -h * 0.66, 8, 5, 2); flat(c, '#e84a3a', 1); poly(c, [w / 2, -h, w * 2.2, -h * 3, w * 2.2, h * 2, w / 2, 0]); c.fillStyle = 'rgba(255, 240, 180, 0.25)'; c.fill(); },
  'light bulb': (c, { w, h }) => { circ(c, 0, -h * 0.62, w / 2); paint(c, '#fff2a8', -h, -h * 0.3); rr(c, -w * 0.25, -h * 0.28, w * 0.5, h * 0.28, 2); paint(c, '#a4a8b4', -h * 0.28, 0, 1.8); for (let i = 1; i < 3; i++) line(c, [-w * 0.25, -h * 0.28 + i * 6, w * 0.25, -h * 0.28 + i * 6], INK, 1.2); line(c, [-3, -h * 0.4, -2, -h * 0.62, 2, -h * 0.62, 3, -h * 0.4], '#e8a83a', 1.4); },
  star: (c, { w, h, t, mood }) => { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? w * 0.22 : w / 2, a = (i / 10) * Math.PI * 2 - Math.PI / 2 + Math.sin(t) * 0.05; c.lineTo(Math.cos(a) * r, -h / 2 + Math.sin(a) * r); } c.closePath(); paint(c, '#ffd84a', -h, 0); face(c, 0, -h / 2 + 2, w / 60, mood); },
  moon: (c, { w, h, mood }) => { c.beginPath(); c.arc(0, -h / 2, w / 2, Math.PI * 0.35, Math.PI * 1.65); c.arc(-w * 0.28, -h / 2, w * 0.42, Math.PI * 1.45, Math.PI * 0.55, true); c.closePath(); paint(c, '#fff2b8', -h, 0); eye(c, w * 0.12, -h * 0.55, 2.2, mood !== 'angry'); },
  firefly: (c, { w, h, t }) => { c.save(); c.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5); circ(c, -w * 0.2, -h * 0.4, w * 0.5); c.fillStyle = 'rgba(220, 255, 120, 0.5)'; c.fill(); c.restore(); ell(c, 0, -h / 2, w * 0.3, h * 0.25); paint(c, '#4a4054', -h, 0, 1.4); circ(c, -w * 0.25, -h * 0.4, w * 0.18); flat(c, '#e8ff7a', 1.2); ell(c, 2, -h * 0.8, w * 0.22, h * 0.18, Math.sin(t * 30) * 0.4); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill(); },
  bomb: (c, { w, h, t }) => { circ(c, 0, -h * 0.42, w * 0.44); paint(c, '#34303a', -h, 0); rr(c, -6, -h * 0.9, 12, 8, 2); paint(c, '#7a7c86', -h, -h * 0.8, 1.6); c.beginPath(); c.moveTo(0, -h * 0.9); c.quadraticCurveTo(6, -h - 6, 12, -h + 2); stroke(c, '#8a5a2c', 2); circ(c, 12, -h + 2, 3 + Math.sin(t * 20) * 1.5); c.fillStyle = '#ffd23a'; c.fill(); shine(c, -w * 0.15, -h * 0.58, w * 0.12, w * 0.08, 0.5); },
  dynamite: (c, { w, h, t }) => { for (let i = 0; i < 3; i++) { rr(c, -w / 2 + (i * w) / 3 + 1, -h * 0.85, w / 3 - 2, h * 0.85, 4); paint(c, '#e84a3a', -h, 0, 1.8); } rr(c, -w / 2, -h * 0.5, w, 8, 2); paint(c, '#3a3642', -h * 0.5, -h * 0.5 + 8, 1.4); c.beginPath(); c.moveTo(0, -h * 0.85); c.quadraticCurveTo(6, -h - 6, 10, -h); stroke(c, '#8a5a2c', 2); circ(c, 10, -h, 2.5 + Math.sin(t * 20)); c.fillStyle = '#ffd23a'; c.fill(); },
  pickaxe: (c, { w, h }) => { line(c, [-w * 0.3, 0, w * 0.2, -h * 0.85], INK, 7); line(c, [-w * 0.3, 0, w * 0.2, -h * 0.85], '#b98050', 4.4); c.beginPath(); c.moveTo(-w / 2, -h * 0.55); c.quadraticCurveTo(w * 0.15, -h * 1.15, w / 2, -h * 0.4); c.quadraticCurveTo(w * 0.15, -h * 0.9, -w / 2, -h * 0.55); paint(c, '#9aa0ac', -h, -h * 0.4); },
  hammer: (c, { w, h }) => { line(c, [-w * 0.2, 0, w * 0.08, -h * 0.7], INK, 7); line(c, [-w * 0.2, 0, w * 0.08, -h * 0.7], '#b98050', 4.4); c.save(); c.translate(w * 0.1, -h * 0.75); c.rotate(0.35); rr(c, -w * 0.35, -h * 0.18, w * 0.7, h * 0.36, 4); paint(c, '#6a6e7a', -h * 0.18, h * 0.18); c.restore(); },
  drill: (c, { w, h }) => { rr(c, -w / 2, -h, w * 0.6, h * 0.5, 8); paint(c, '#f2c230', -h, -h * 0.5); rr(c, -w * 0.4, -h * 0.55, w * 0.22, h * 0.55, 5); paint(c, '#3a3642', -h * 0.55, 0); poly(c, [w * 0.1, -h * 0.85, w / 2, -h * 0.75, w * 0.1, -h * 0.65]); paint(c, '#c9ccd4', -h, -h * 0.6); },
  shovel: (c, { w, h }) => { line(c, [0, -h, 0, -h * 0.35], INK, 7); line(c, [0, -h, 0, -h * 0.35], '#b98050', 4.4); rr(c, -w * 0.35, -h - 4, w * 0.7, 8, 4); paint(c, '#b98050', -h - 4, -h + 4, 1.8); c.beginPath(); c.moveTo(-w / 2, -h * 0.38); c.lineTo(w / 2, -h * 0.38); c.lineTo(w * 0.4, -h * 0.08); c.quadraticCurveTo(0, 6, -w * 0.4, -h * 0.08); c.closePath(); paint(c, '#9aa0ac', -h * 0.4, 0); },
  axe: (c, { w, h }) => { line(c, [-w * 0.1, 0, w * 0.05, -h], INK, 7); line(c, [-w * 0.1, 0, w * 0.05, -h], '#b98050', 4.4); c.beginPath(); c.moveTo(w * 0.02, -h * 0.92); c.quadraticCurveTo(w * 0.6, -h * 1.05, w / 2, -h * 0.55); c.quadraticCurveTo(w * 0.3, -h * 0.65, w * 0.02, -h * 0.66); c.closePath(); paint(c, '#9aa0ac', -h, -h * 0.5); },
  saw: (c, { w, h }) => { c.beginPath(); c.moveTo(-w * 0.2, -h); c.lineTo(w / 2, -h * 0.55); for (let x = w / 2; x > -w * 0.2; x -= 6) { c.lineTo(x - 3, -h * 0.1); c.lineTo(x - 6, -h * 0.2); } c.closePath(); paint(c, '#c9ccd4', -h, 0); rr(c, -w / 2, -h, w * 0.32, h * 0.8, 6); paint(c, '#e84a3a', -h, 0); rr(c, -w / 2 + 6, -h + 6, w * 0.16, h * 0.4, 4); c.fillStyle = INK; c.fill(); },
  cage: (c, { w, h }) => { rr(c, -w / 2, -h, w, 8, 3); paint(c, '#6a6e7a', -h, -h + 8); rr(c, -w / 2, -8, w, 8, 3); paint(c, '#6a6e7a', -8, 0); for (let i = 0; i < 7; i++) { const x = -w / 2 + 5 + (i * (w - 10)) / 6; line(c, [x, -h + 8, x, -8], INK, 4.4); line(c, [x, -h + 8, x, -8], '#a4a8b4', 2.4); } c.beginPath(); c.arc(0, -h, 10, Math.PI, 0); stroke(c, INK, 3.4); },
  net: (c, { w, h }) => { line(c, [-w / 2, -h, -w / 2 - 8, -h - 30], '#8a5a2c', 4); c.beginPath(); c.moveTo(-w / 2, -h); c.quadraticCurveTo(0, -h - 10, w / 2, -h); c.quadraticCurveTo(w / 2, 0, 0, 0); c.quadraticCurveTo(-w / 2, 0, -w / 2, -h); c.fillStyle = 'rgba(230, 220, 200, 0.35)'; c.fill(); stroke(c); for (let i = 1; i < 5; i++) { line(c, [-w / 2 + (w * i) / 5, -h, -w / 2 + (w * i) / 5 * 0.8 + w * 0.1, 0], '#9a8a74', 1.2); line(c, [-w / 2 + 4, -h + (h * i) / 5, w / 2 - 4, -h + (h * i) / 5], '#9a8a74', 1.2); } },
  balloon: (c, { w, h, col, t }) => { const k = col || '#ef5a6a', r = w / 2, s = Math.sin(t * 2) * 3; c.beginPath(); c.moveTo(0, -h + 2 * r + 4); c.quadraticCurveTo(-6 + s, -h * 0.4, 0, 0); stroke(c, INK, 1.4); ell(c, 0, -h + r * 1.1, r, r * 1.1); paint(c, k, -h, -h + 2.2 * r); poly(c, [-3, -h + 2.2 * r, 3, -h + 2.2 * r, 0, -h + 2.2 * r + 5]); flat(c, k, 1.4); shine(c, -r * 0.35, -h + r * 0.7, r * 0.2, r * 0.3, 0.6); },
  'hot air balloon': (c, { w, h, t }) => {
    const r = w / 2, bh = h * 0.62, cols = ['#e8403a', '#ffd84a', '#3a8ae8', '#4ab85a'];
    for (const s of [-1, 1]) line(c, [s * r * 0.5, -h + bh * 0.95, s * w * 0.18, -h * 0.2], INK, 1.6);
    for (let i = 0; i < 4; i++) { c.beginPath(); const a = -r + (i * w) / 4, b = a + w / 4; c.moveTo(0, -h); c.bezierCurveTo(a * 1.3, -h, a * 1.2, -h + bh * 0.8, a * 0.5, -h + bh); c.lineTo(b * 0.5, -h + bh); c.bezierCurveTo(b * 1.2, -h + bh * 0.8, b * 1.3, -h, 0, -h); c.fillStyle = grad(c, cols[i], -h, -h + bh); c.fill(); stroke(c, INK, 1.8); }
    rr(c, -w * 0.2, -h * 0.2, w * 0.4, h * 0.2, 4); paint(c, '#b98050', -h * 0.2, 0); for (let i = 0; i < 3; i++) line(c, [-w * 0.2, -h * 0.15 + i * 8, w * 0.2, -h * 0.15 + i * 8], '#8a5a2c', 1.2);
    flames(c, 0, -h * 0.22, 14, 12 + Math.sin(t * 10) * 3, t); void t;
  },
  kite: (c, { w, h, col, t }) => { const k = col || '#f2a23a'; c.beginPath(); c.moveTo(0, -h * 0.4); for (let i = 0; i < 6; i++) c.lineTo(Math.sin(t * 3 + i) * 6 - i * 3, -h * 0.4 + i * (h * 0.4) / 6); stroke(c, INK, 1.2); for (let i = 1; i < 4; i++) { ell(c, Math.sin(t * 3 + i * 1.5) * 6 - i * 4.5, -h * 0.4 + i * (h * 0.4) / 4, 4, 2.4, 0.5); flat(c, '#e8403a', 1); } poly(c, [0, -h, w / 2, -h * 0.72, 0, -h * 0.4, -w / 2, -h * 0.72]); paint(c, k, -h, -h * 0.4); line(c, [0, -h, 0, -h * 0.4], dark(k, 0.3), 1.4); line(c, [-w / 2, -h * 0.72, w / 2, -h * 0.72], dark(k, 0.3), 1.4); },
  plane: (c, { w, h, col, t }) => {
    const k = col || '#f2f4f8';
    poly(c, [-w * 0.42, -h * 0.55, -w / 2, -h, -w * 0.3, -h * 0.55]); paint(c, '#e8403a', -h, -h * 0.5);
    rr(c, -w / 2 + 6, -h * 0.62, w - 16, h * 0.34, h * 0.17); paint(c, k, -h * 0.62, -h * 0.28);
    for (let i = 0; i < 4; i++) { circ(c, -w * 0.15 + i * w * 0.1, -h * 0.5, 3.6); flat(c, '#8ac4ec', 1.2); }
    poly(c, [-w * 0.1, -h * 0.42, w * 0.12, -h * 0.42, -w * 0.02, -h * 0.05, -w * 0.2, -h * 0.05]); paint(c, dark(k, 0.08), -h * 0.42, 0);
    c.save(); c.translate(w / 2 - 8, -h * 0.45); c.scale(1, Math.abs(Math.sin(t * 40))); rr(c, -2, -h * 0.3, 4, h * 0.6, 2); c.fillStyle = '#6d6a74'; c.fill(); c.restore();
    line(c, [w * 0.2, -h * 0.58, w * 0.35, -h * 0.58], '#e8403a', 3);
  },
  helicopter: (c, { w, h, t }) => {
    rr(c, -w / 2, -h * 0.58, w * 0.5, h * 0.12, 4); paint(c, '#e8403a', -h * 0.58, -h * 0.46);
    ell(c, w * 0.12, -h * 0.42, w * 0.32, h * 0.3); paint(c, '#e8403a', -h * 0.72, -h * 0.12);
    ell(c, w * 0.25, -h * 0.46, w * 0.14, h * 0.16); paint(c, '#bfe6ff', -h * 0.62, -h * 0.3, 1.6);
    line(c, [-w * 0.1, -h * 0.05, w * 0.35, -h * 0.05], INK, 3.6); line(c, [0, -h * 0.13, 0, -h * 0.05], INK, 2.4); line(c, [w * 0.25, -h * 0.13, w * 0.25, -h * 0.05], INK, 2.4);
    line(c, [w * 0.12, -h * 0.72, w * 0.12, -h * 0.85], INK, 3);
    const s = Math.cos(t * 30); line(c, [w * 0.12 - w * 0.5 * s, -h * 0.87, w * 0.12 + w * 0.5 * s, -h * 0.87], INK, 4);
    c.save(); c.translate(-w / 2 + 2, -h * 0.52); c.rotate(t * 30); line(c, [-9, 0, 9, 0], INK, 3); c.restore();
  },
  ufo: (c, { w, h, t }) => { ell(c, 0, -h * 0.6, w * 0.22, h * 0.38); c.fillStyle = 'rgba(190, 230, 255, 0.85)'; c.fill(); stroke(c); ell(c, 0, -h * 0.4, w / 2, h * 0.22); paint(c, '#a4a8b4', -h * 0.62, -h * 0.18); for (let i = 0; i < 5; i++) { circ(c, -w * 0.32 + i * w * 0.16, -h * 0.38, 3.4); c.fillStyle = (Math.floor(t * 4) + i) % 2 ? '#ffd84a' : '#7fe0a0'; c.fill(); stroke(c, INK, 1); } poly(c, [-w * 0.2, -h * 0.2, w * 0.2, -h * 0.2, w * 0.35, h * 0.6, -w * 0.35, h * 0.6]); c.fillStyle = 'rgba(200, 255, 200, 0.18)'; c.fill(); },
  rocket: (c, { w, h, t }) => { flames(c, 0, 0, w * 0.5, h * 0.25 + Math.sin(t * 20) * 3, t); c.save(); c.translate(0, -h * 0.2); for (const s of [-1, 1]) { poly(c, [s * w * 0.28, -h * 0.25, s * w / 2, 0, s * w * 0.28, -h * 0.05]); paint(c, '#e8403a', -h * 0.3, 0); } c.beginPath(); c.moveTo(0, -h * 0.8); c.bezierCurveTo(w * 0.4, -h * 0.6, w * 0.3, -h * 0.1, w * 0.25, 0); c.lineTo(-w * 0.25, 0); c.bezierCurveTo(-w * 0.3, -h * 0.1, -w * 0.4, -h * 0.6, 0, -h * 0.8); paint(c, '#f2f4f8', -h * 0.8, 0); circ(c, 0, -h * 0.45, w * 0.13); paint(c, '#8ac4ec', -h * 0.55, -h * 0.35, 1.8); c.restore(); },
  'magic carpet': (c, { w, h, t }) => { c.beginPath(); c.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 8; i++) c.lineTo(-w / 2 + (w * i) / 8, -h + Math.sin(t * 5 + i) * 3); c.lineTo(w / 2, -2 + Math.sin(t * 5 + 8) * 3); for (let i = 8; i >= 0; i--) c.lineTo(-w / 2 + (w * i) / 8, Math.sin(t * 5 + i) * 3); c.closePath(); paint(c, '#9a3ad8', -h, 0); for (let i = 1; i < 8; i += 2) { circ(c, -w / 2 + (w * i) / 8, -h / 2 + Math.sin(t * 5 + i) * 3, 3); flat(c, '#ffd84a', 1); } for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(c, [s * w / 2, -h + i * 5 + Math.sin(t * 5) * 3, s * (w / 2 + 6), -h + i * 5 + 2], '#ffd84a', 1.6); },
  carpet: (c, { w, h, col }) => { const k = col || '#c84a4a'; rr(c, -w / 2, -h, w, h, 2); paint(c, k, -h, 0); line(c, [-w / 2 + 6, -h / 2, w / 2 - 6, -h / 2], '#ffd84a', 2); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(c, [s * w / 2, -h + i * 4, s * (w / 2 + 5), -h + i * 4], '#ffd84a', 1.4); },
  broom: (c, { w, h }) => { line(c, [-w / 2, -h / 2, w * 0.25, -h / 2], INK, 6); line(c, [-w / 2, -h / 2, w * 0.25, -h / 2], '#b98050', 3.6); poly(c, [w * 0.2, -h / 2 - 4, w / 2, -h, w / 2 + 4, 0, w * 0.2, -h / 2 + 4]); paint(c, '#e8c46a', -h, 0); line(c, [w * 0.22, -h / 2 - 5, w * 0.22, -h / 2 + 5], '#8a5a2c', 3); },
  cloud: (c, { w, h }) => { const body = () => { c.beginPath(); c.moveTo(-w / 2 + 10, 0); c.bezierCurveTo(-w / 2 - 8, -h * 0.4, -w * 0.3, -h * 0.85, -w * 0.12, -h * 0.65); c.bezierCurveTo(-w * 0.05, -h * 1.05, w * 0.3, -h * 1.05, w * 0.28, -h * 0.6); c.bezierCurveTo(w / 2 + 8, -h * 0.7, w / 2 + 6, 0, w / 2 - 10, 0); c.closePath(); }; body(); paint(c, '#ffffff', -h, 0); shadeBottom(c, body, -h * 0.3, 0, 0.12); },
  rainbow: (c, { w, h }) => { const cols = ['#e8403a', '#f5921e', '#f5d23a', '#4ab85a', '#3a8ae8', '#9a5ae0']; const band = Math.min(12, h / 8); for (let i = 0; i < cols.length; i++) { c.beginPath(); c.ellipse(0, 0, w / 2 - i * band, h - i * band, 0, Math.PI, 0); stroke(c, cols[i], band + 0.5); } c.beginPath(); c.ellipse(0, 0, w / 2 + band / 2, h + band / 2, 0, Math.PI, 0); stroke(c, INK, 1.6); for (const s of [-1, 1]) for (const [dx, dy, r] of [[-1, 0, 1.6], [1, 0, 1.6], [0, -1, 2]]) { circ(c, s * (w / 2 - band * 2.5) + dx * band * 1.6, -band + dy * band * 1.2, band * r); paint(c, '#ffffff', -band * 4, 0, 1.6); } },
  car: (c, { w, h, col, t, moving }) => { const k = col || '#e84a3a'; c.beginPath(); c.moveTo(-w / 2 + 6, -h * 0.25); c.lineTo(-w / 2 + 4, -h * 0.55); c.lineTo(-w * 0.2, -h * 0.6); c.lineTo(-w * 0.1, -h); c.lineTo(w * 0.22, -h); c.lineTo(w * 0.35, -h * 0.6); c.lineTo(w / 2 - 2, -h * 0.5); c.lineTo(w / 2 - 4, -h * 0.25); c.closePath(); paint(c, k, -h, -h * 0.2); poly(c, [-w * 0.06, -h * 0.62, -w * 0.02, -h * 0.9, w * 0.08, -h * 0.9, w * 0.08, -h * 0.62]); flat(c, '#bfe6ff', 1.6); poly(c, [w * 0.13, -h * 0.62, w * 0.13, -h * 0.9, w * 0.2, -h * 0.9, w * 0.29, -h * 0.62]); flat(c, '#bfe6ff', 1.6); ell(c, w / 2 - 8, -h * 0.45, 5, 4); flat(c, '#fff6b0', 1.4); line(c, [-w * 0.3, -h * 0.5, w * 0.3, -h * 0.5], light(k, 0.4), 2); const sp = moving ? t * 12 : 0; wheel(c, -w * 0.3, -h * 0.18, h * 0.18, sp); wheel(c, w * 0.3, -h * 0.18, h * 0.18, sp); },
  truck: (c, { w, h, col, t, moving }) => { const k = col || '#3a8ae8'; rr(c, -w / 2, -h, w * 0.62, h * 0.78, 5); paint(c, '#f2f4f8', -h, -h * 0.22); rr(c, w * 0.14, -h * 0.72, w * 0.34, h * 0.5, 6); paint(c, k, -h * 0.72, -h * 0.22); rr(c, w * 0.26, -h * 0.66, w * 0.16, h * 0.2, 3); flat(c, '#bfe6ff', 1.6); rr(c, -w / 2, -h * 0.28, w, h * 0.1, 3); paint(c, '#5a5d68', -h * 0.28, -h * 0.18); const sp = moving ? t * 10 : 0; for (const x of [-w * 0.35, -w * 0.15, w * 0.32]) wheel(c, x, -h * 0.13, h * 0.13, sp); },
  bus: (c, { w, h, col, t, moving }) => { const k = col || '#f2c230'; rr(c, -w / 2, -h, w, h * 0.82, 10); paint(c, k, -h, -h * 0.18); for (let i = 0; i < 5; i++) { rr(c, -w / 2 + 12 + i * (w - 30) / 5, -h * 0.9, (w - 30) / 5 - 8, h * 0.28, 4); flat(c, '#bfe6ff', 1.6); } rr(c, -w / 2, -h * 0.5, w, 6, 2); flat(c, INK, 0); c.fillStyle = INK; c.font = `800 ${Math.round(h * 0.12)}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.fillText('SCHOOL BUS', 0, -h * 0.3); const sp = moving ? t * 10 : 0; wheel(c, -w * 0.32, -h * 0.13, h * 0.13, sp); wheel(c, w * 0.32, -h * 0.13, h * 0.13, sp); },
  tractor: (c, { w, h, col, t, moving }) => { const k = col || '#4ab85a'; rr(c, -w * 0.1, -h, w * 0.38, h * 0.55, 4); paint(c, k, -h, -h * 0.45); rr(c, -w * 0.05, -h * 0.94, w * 0.26, h * 0.3, 3); flat(c, '#bfe6ff', 1.6); rr(c, -w / 2 + 10, -h * 0.55, w * 0.9, h * 0.25, 5); paint(c, k, -h * 0.55, -h * 0.3); line(c, [w * 0.35, -h * 0.55, w * 0.35, -h * 0.85], INK, 5); const sp = moving ? t * 8 : 0; wheel(c, -w * 0.28, -h * 0.28, h * 0.28, sp); wheel(c, w * 0.32, -h * 0.16, h * 0.16, sp); },
  bicycle: (c, { w, h, col, t, moving }) => { const k = col || '#3aa0e8', r = h * 0.3, sp = moving ? t * 12 : 0; wheel(c, -w * 0.3, -r, r, sp); wheel(c, w * 0.3, -r, r, sp); line(c, [-w * 0.3, -r, -w * 0.02, -r, w * 0.12, -h * 0.72, -w * 0.12, -h * 0.72, -w * 0.02, -r], INK, 5); line(c, [-w * 0.3, -r, -w * 0.02, -r, w * 0.12, -h * 0.72, -w * 0.12, -h * 0.72, -w * 0.02, -r], k, 3); line(c, [w * 0.12, -h * 0.72, w * 0.3, -r], INK, 5); line(c, [w * 0.12, -h * 0.72, w * 0.3, -r], k, 3); line(c, [w * 0.08, -h * 0.8, w * 0.2, -h * 0.84], INK, 3); rr(c, -w * 0.2, -h * 0.8, w * 0.14, 6, 3); flat(c, '#3a3642', 1.2); },
  skateboard: (c, { w, h, t, moving }) => { rr(c, -w / 2, -h, w, h * 0.45, h * 0.22); paint(c, '#9a5ae0', -h, -h * 0.55); const sp = moving ? t * 14 : 0; wheel(c, -w * 0.3, -h * 0.28, h * 0.28, sp); wheel(c, w * 0.3, -h * 0.28, h * 0.28, sp); },
  wagon: (c, { w, h, col, t, moving }) => { const k = col || '#e8403a'; poly(c, [-w / 2, -h, w / 2, -h, w * 0.44, -h * 0.35, -w * 0.44, -h * 0.35]); paint(c, k, -h, -h * 0.35); line(c, [-w / 2 + 4, -h + 4, w / 2 - 4, -h + 4], light(k, 0.45), 2); line(c, [w * 0.44, -h * 0.5, w / 2 + 16, -h * 0.9], INK, 3); const sp = moving ? t * 10 : 0; wheel(c, -w * 0.28, -h * 0.2, h * 0.2, sp); wheel(c, w * 0.28, -h * 0.2, h * 0.2, sp); },
  boat: (c, { w, h, col }) => { const k = col || '#c9794a'; c.beginPath(); c.moveTo(-w / 2, -h * 0.75); c.lineTo(w / 2, -h * 0.75); c.quadraticCurveTo(w * 0.42, 0, w * 0.2, 0); c.lineTo(-w * 0.25, 0); c.quadraticCurveTo(-w * 0.45, -h * 0.2, -w / 2, -h * 0.75); c.closePath(); paint(c, k, -h, 0); line(c, [-w / 2 + 6, -h * 0.62, w / 2 - 6, -h * 0.62], light(k, 0.4), 2); line(c, [-w * 0.38, -h * 0.35, w * 0.38, -h * 0.35], dark(k, 0.25), 1.6); rr(c, -w / 2 - 2, -h * 0.8, w + 4, h * 0.1, 3); paint(c, '#f2f4f8', -h * 0.8, -h * 0.7, 1.6); },
  raft: (c, { w, h }) => { for (let i = 0; i < 6; i++) { const x = -w / 2 + (w * i) / 6; rr(c, x + 1, -h, w / 6 - 2, h, h / 2); paint(c, i % 2 ? '#b98050' : '#a86a3a', -h, 0, 1.8); } line(c, [-w / 2 + 6, -h / 2, w / 2 - 6, -h / 2], '#d9b27a', 2.6); },
  // Animals
  dog: (c, L) => beast(c, L, { body: L.col || '#c98a4e', belly: '#f2dcc0', ear: 'flop', tail: 'thin', snout: light(L.col || '#c98a4e', 0.3), legs: 0.34, head: 0.28 }),
  cat: (c, L) => beast(c, L, { body: L.col || '#f2a24a', belly: '#ffe8c8', ear: 'point', tail: 'thin', stripes: dark(L.col || '#f2a24a', 0.2), legs: 0.3, head: 0.3 }),
  mouse: (c, L) => beast(c, L, { body: L.col || '#a8a4b0', ear: 'round', tail: 'thin', legs: 0.18, head: 0.36, snout: '#f4b2b8', nose: '#e27a8a' }),
  rabbit: (c, L) => beast(c, L, { body: L.col || '#e8dcd0', ear: 'long', tail: 'stub', legs: 0.2, head: 0.3, nose: '#e27a8a' }),
  horse: (c, L) => beast(c, L, { body: L.col || '#a86a3a', ear: 'point', tail: 'tuft', mane: L.col === '#fdfbff' ? '#f7a1c4' : dark(L.col || '#a86a3a', 0.35), snout: light(L.col || '#a86a3a', 0.15), legs: 0.4, neck: 0.16, head: 0.15, long: true, horns: L.col === '#fdfbff' ? 'unicorn' : undefined }),
  llama: (c, L) => beast(c, L, { body: L.col || '#f3e6cf', ear: 'long', tail: 'fluff', wool: true, legs: 0.36, neck: 0.3, head: 0.24, snout: light(L.col || '#f3e6cf', 0.2) }),
  camel: (c, L) => beast(c, L, { body: L.col || '#d9a866', ear: 'round', tail: 'tuft', hump: true, legs: 0.42, neck: 0.18, head: 0.13, long: true, snout: light(L.col || '#d9a866', 0.2) }),
  cow: (c, L) => beast(c, L, { body: L.col || '#ffffff', spots: '#3a3642', ear: 'flop', tail: 'tuft', horns: 'cow', snout: '#f4b2b8', legs: 0.32, head: 0.24 }),
  pig: (c, L) => beast(c, L, { body: L.col || '#f4b2b8', ear: 'point', tail: 'curl', snout: '#f7c6ca', nose: '#c9707a', legs: 0.22, head: 0.34 }),
  sheep: (c, L) => beast(c, L, { body: L.col || '#f7f4ee', ear: 'flop', tail: 'stub', wool: true, legs: 0.3, head: 0.24, snout: '#3a3642' }),
  goat: (c, L) => beast(c, L, { body: L.col || '#e8e2d6', ear: 'flop', tail: 'stub', horns: 'goat', legs: 0.36, head: 0.24, snout: light(L.col || '#e8e2d6', 0.2) }),
  fox: (c, L) => beast(c, L, { body: L.col || '#e8743a', belly: '#ffffff', ear: 'point', tail: 'bushy', snout: '#ffffff', legs: 0.3, head: 0.34 }),
  wolf: (c, L) => beast(c, L, { body: L.col || '#8d8a96', belly: '#d9d6de', ear: 'point', tail: 'bushy', snout: light(L.col || '#8d8a96', 0.3), legs: 0.34, head: 0.3 }),
  bear: (c, L) => beast(c, L, { body: L.col || '#8a5a3a', ear: 'round', tail: 'stub', snout: light(L.col || '#8a5a3a', 0.35), legs: 0.26, head: 0.3 }),
  lion: (c, L) => beast(c, L, { body: L.col || '#e0a44a', ear: 'round', tail: 'tuft', mane: '#b86a2a', snout: '#f7dca0', legs: 0.32, head: 0.26 }),
  tiger: (c, L) => beast(c, L, { body: L.col || '#f08a2a', belly: '#ffffff', ear: 'round', tail: 'thin', stripes: '#2a2233', snout: '#ffffff', legs: 0.3, head: 0.3 }),
  puma: (c, L) => beast(c, L, { body: L.col || '#d2a06a', belly: '#f2e2c8', ear: 'round', tail: 'thin', snout: '#f7e8d2', legs: 0.32, head: 0.32 }),
  elephant: (c, L) => beast(c, L, { body: L.col || '#a4a6b4', ear: 'flop', tail: 'thin', trunk: true, legs: 0.34, head: 0.28 }),
  giraffe: (c, L) => beast(c, L, { body: L.col || '#f2c460', spots: '#b8742a', ear: 'point', tail: 'tuft', horns: 'goat', legs: 0.3, neck: 0.42, head: 0.24, snout: light(L.col || '#f2c460', 0.2) }),
  deer: (c, L) => beast(c, L, { body: L.col || '#b87c4a', belly: '#f2dcc0', ear: 'point', tail: 'stub', horns: 'antler', legs: 0.4, neck: 0.1, head: 0.2, snout: light(L.col || '#b87c4a', 0.25) }),
  turtle: (c, { w, h, col, t, moving, mood }) => { const k = col || '#6aa84e'; const st = moving ? Math.sin(t * 6) * 2 : 0; for (const x of [-w * 0.3, w * 0.25]) { ell(c, x + st, -h * 0.12, 6, 7); paint(c, '#9fd07a', -h * 0.3, 0, 1.6); } circ(c, w * 0.4, -h * 0.4, h * 0.26); paint(c, '#9fd07a', -h * 0.66, -h * 0.14); eye(c, w * 0.45, -h * 0.45, 1.8, mood === 'sleepy'); c.beginPath(); c.ellipse(0, -h * 0.25, w * 0.4, h * 0.65, 0, Math.PI, 0); c.closePath(); paint(c, k, -h, -h * 0.25); for (const x of [-w * 0.18, 0, w * 0.18]) { poly(c, [x - 6, -h * 0.35, x, -h * 0.65, x + 6, -h * 0.35]); stroke(c, dark(k, 0.3), 1.4); } },
  frog: (c, { w, h, col, mood }) => { const k = col || '#6ac24e'; ell(c, -w * 0.25, -h * 0.2, w * 0.25, h * 0.2); paint(c, k, -h * 0.4, 0); ell(c, 0, -h * 0.4, w * 0.4, h * 0.36); paint(c, k, -h * 0.8, 0); ell(c, 0, -h * 0.3, w * 0.25, h * 0.16); flat(c, '#d8f2b0', 0); for (const x of [-w * 0.18, w * 0.18]) { circ(c, x, -h * 0.78, h * 0.2); paint(c, k, -h, -h * 0.6); eye(c, x, -h * 0.8, 2.4, mood === 'sleepy'); } c.beginPath(); c.arc(0, -h * 0.5, w * 0.16, 0.2, Math.PI - 0.2); stroke(c, INK, 1.6); },
  snake: (c, { w, h, col, t }) => { const k = col || '#6ab84e'; c.beginPath(); c.moveTo(-w / 2, -h * 0.3); for (let i = 0; i <= 10; i++) c.lineTo(-w / 2 + (w * 0.8 * i) / 10, -h * 0.35 - Math.sin(i * 1.2 + t * 4) * h * 0.25); stroke(c, INK, h * 0.55 + 2); stroke(c, k, h * 0.55 - 1.5); ell(c, w * 0.36, -h * 0.5, h * 0.42, h * 0.34); paint(c, k, -h, 0); eye(c, w * 0.4, -h * 0.6, 1.8); line(c, [w * 0.5, -h * 0.45, w * 0.58, -h * 0.4, w * 0.62, -h * 0.46], '#e8403a', 1.4); },
  bee: (c, { w, h, t }) => { for (const s of [-1, 1]) { ell(c, s * 3, -h * 0.85, w * 0.22, h * 0.3, s * 0.3 + Math.sin(t * 40) * 0.3); c.fillStyle = 'rgba(235, 245, 255, 0.85)'; c.fill(); stroke(c, INK, 1.3); } ell(c, 0, -h * 0.45, w * 0.42, h * 0.36); paint(c, '#ffd23a', -h * 0.8, -h * 0.1, 1.8); for (const x of [-w * 0.12, w * 0.12]) line(c, [x, -h * 0.75, x, -h * 0.15], INK, 3); circ(c, w * 0.34, -h * 0.5, 1.5); c.fillStyle = INK; c.fill(); line(c, [-w * 0.42, -h * 0.45, -w / 2 - 2, -h * 0.45], INK, 1.8); },
  butterfly: (c, { w, h, col, t }) => { const k = col || '#ffa24a', f = 0.6 + Math.abs(Math.sin(t * 10)) * 0.4; c.save(); c.translate(0, -h / 2); c.scale(f, 1); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(s * w * 0.2, -h * 0.6, s * w * 0.6, -h * 0.6, s * w * 0.5, -h * 0.1); c.closePath(); paint(c, k, -h / 2, 0, 1.5); ell(c, s * w * 0.3, h * 0.15, w * 0.16, h * 0.18); paint(c, light(k, 0.3), 0, h / 2, 1.4); } c.restore(); line(c, [0, -h * 0.8, 0, -h * 0.2], INK, 2.6); },
  bird: (c, L) => birdie(c, L, { body: L.col || '#6aa6e8', wing: dark(L.col || '#6aa6e8', 0.15), belly: '#f2f6ff', flight: true }),
  owl: (c, L) => { birdie(c, L, { body: L.col || '#a8845a', wing: dark(L.col || '#a8845a', 0.2), belly: '#f2e2c8', tall: true, flight: false }); },
  bigbird: (c, L) => birdie(c, L, { body: L.col || '#7a5a3a', wing: dark(L.col || '#7a5a3a', 0.15), belly: L.col === '#2e2a30' ? '#ffffff' : '#f2e2c8', beak: '#f2c230', flight: true }),
  parrot: (c, L) => birdie(c, L, { body: L.col || '#e8403a', wing: '#3a8ae8', beak: '#f2f4f8', crest: '#ffd23a', tall: true }),
  duck: (c, L) => birdie(c, L, { body: L.col || '#f2d23a', wing: dark(L.col || '#f2d23a', 0.1), beak: '#f28a3a', flat: true }),
  chicken: (c, L) => birdie(c, L, { body: L.col || '#ffffff', wing: '#e8e2d6', beak: '#f2a23a', crest: '#e8403a', tall: true }),
  penguin: (c, { w, h, mood }) => { ell(c, 0, -h * 0.45, w * 0.42, h * 0.45); paint(c, '#2e2a36', -h, 0); ell(c, w * 0.08, -h * 0.4, w * 0.28, h * 0.36); flat(c, '#ffffff', 0); circ(c, w * 0.05, -h * 0.8, w * 0.3); paint(c, '#2e2a36', -h, -h * 0.5); eye(c, w * 0.15, -h * 0.82, 2, mood === 'sleepy'); poly(c, [w * 0.3, -h * 0.8, w * 0.52, -h * 0.76, w * 0.3, -h * 0.72]); paint(c, '#f2a23a', -h, 0, 1.4); for (const x of [-w * 0.15, w * 0.15]) { ell(c, x, 0, 7, 3); flat(c, '#f2a23a', 1.4); } },
  fish: (c, { w, h, col }) => { const k = col || '#6aa6d8'; poly(c, [-w * 0.3, -h / 2, -w / 2, -h, -w / 2, 0]); paint(c, k, -h, 0); ell(c, w * 0.05, -h / 2, w * 0.4, h * 0.48); paint(c, k, -h, 0); line(c, [0, -h * 0.9, 0, -h * 0.1], dark(k, 0.2), 1.4); eye(c, w * 0.25, -h * 0.58, 2); shine(c, w * 0.05, -h * 0.72, w * 0.15, 2.4, 0.6); },
  shark: (c, { w, h, col }) => { const k = col || '#7a8aa4'; poly(c, [-w * 0.35, -h / 2, -w / 2, -h, -w * 0.45, -h / 2, -w / 2, 0]); paint(c, k, -h, 0); ell(c, 0, -h / 2, w * 0.42, h * 0.36); paint(c, k, -h, 0); poly(c, [-w * 0.05, -h * 0.8, w * 0.05, -h * 1.1, w * 0.12, -h * 0.8]); paint(c, k, -h * 1.1, -h * 0.8); ell(c, w * 0.1, -h * 0.35, w * 0.3, h * 0.12); flat(c, '#f2f4f8', 0); eye(c, w * 0.25, -h * 0.58, 2.2); for (let i = 0; i < 3; i++) line(c, [w * 0.05 + i * 6, -h * 0.55, w * 0.05 + i * 6, -h * 0.4], dark(k, 0.3), 1.4); },
  dragon: (c, L) => { const { w, h, t } = L; const f = Math.sin(t * 6); c.save(); c.translate(-w * 0.1, -h * 0.6); c.rotate(-0.4 - f * 0.4); poly(c, [0, 0, -w * 0.15, -h * 0.55, w * 0.25, -h * 0.35]); paint(c, dark(L.col || '#4ab86a', 0.2), -h * 0.6, 0); c.restore(); beast(c, { ...L, h: h * 0.8 }, { body: L.col || '#4ab86a', belly: '#f7e08a', ear: 'point', tail: 'thin', horns: 'goat', snout: light(L.col || '#4ab86a', 0.15), legs: 0.26, neck: 0.12, head: 0.26 }); if (Math.sin(t * 1.3) > 0.6) flames(c, w * 0.62, -h * 0.55, 30, 24, t); },
  dinosaur: (c, { w, h, col, t, moving, mood }) => { const k = col || '#6ab86a'; const st = moving ? Math.sin(t * 8) * 6 : 0; poly(c, [-w * 0.1, -h * 0.5, -w / 2, -h * 0.35, -w * 0.1, -h * 0.3]); paint(c, k, -h * 0.5, -h * 0.3); for (const s of [-1, 1]) { rr(c, -w * 0.05 + s * st - 8, -h * 0.35, 18, h * 0.35, 6); paint(c, dark(k, s > 0 ? 0 : 0.15), -h * 0.35, 0); } ell(c, 0, -h * 0.48, w * 0.25, h * 0.22); paint(c, k, -h * 0.7, -h * 0.26); poly(c, [w * 0.08, -h * 0.64, w * 0.14, -h * 0.84, w * 0.28, -h * 0.8, w * 0.22, -h * 0.5]); paint(c, k, -h * 0.84, -h * 0.5); ell(c, w * 0.22, -h * 0.82, w * 0.2, h * 0.14); paint(c, k, -h, -h * 0.68); for (let i = 0; i < 4; i++) { poly(c, [w * 0.3 + i * 6, -h * 0.72, w * 0.33 + i * 6, -h * 0.66, w * 0.36 + i * 6, -h * 0.72]); flat(c, '#ffffff', 0.8); } eye(c, w * 0.2, -h * 0.88, 2.6, mood === 'sleepy'); line(c, [w * 0.18, -h * 0.55, w * 0.26, -h * 0.5], INK, 3); for (let i = 0; i < 5; i++) { poly(c, [-w * 0.2 + i * 18, -h * 0.66 + i * 2, -w * 0.15 + i * 18, -h * 0.76, -w * 0.1 + i * 18, -h * 0.66]); paint(c, '#e8743a', -h * 0.76, -h * 0.6, 1.4); } },
  ghost: (c, { w, h, t, mood }) => { c.save(); c.globalAlpha *= 0.85; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h * 0.55); c.bezierCurveTo(-w / 2, -h * 1.05, w / 2, -h * 1.05, w / 2, -h * 0.55); c.lineTo(w / 2, 0); for (let i = 3; i >= 0; i--) c.quadraticCurveTo(-w / 2 + (w * (i + 0.5)) / 4, -10 - Math.sin(t * 5 + i) * 4, -w / 2 + (w * i) / 4, 0); c.closePath(); paint(c, '#f2f4ff', -h, 0); c.restore(); face(c, 0, -h * 0.6, w / 40, mood === 'friendly' ? 'happy' : mood); ell(c, 0, -h * 0.42, 5, 7); c.fillStyle = INK; c.fill(); },
  robot: (c, { w, h, t, mood }) => { rr(c, -w * 0.3, -h * 0.55, w * 0.6, h * 0.45, 6); paint(c, '#a4a8b4', -h * 0.55, -h * 0.1); for (const x of [-w * 0.15, w * 0.15]) { rr(c, x - 6, -h * 0.12, 12, h * 0.12, 3); paint(c, '#6a6e7a', -h * 0.12, 0); } rr(c, -w * 0.28, -h * 0.92, w * 0.56, h * 0.34, 8); paint(c, '#c9ccd4', -h * 0.92, -h * 0.58); line(c, [0, -h * 0.92, 0, -h], INK, 2.4); circ(c, 0, -h, 4); c.fillStyle = Math.sin(t * 6) > 0 ? '#e84a3a' : '#ffd23a'; c.fill(); stroke(c, INK, 1.4); for (const x of [-w * 0.12, w * 0.12]) { circ(c, x, -h * 0.78, 5); flat(c, mood === 'angry' ? '#e84a3a' : '#7fe0f0', 1.6); } rr(c, -w * 0.12, -h * 0.68, w * 0.24, 5, 2); flat(c, '#3a3642', 1.2); rr(c, -w * 0.18, -h * 0.45, w * 0.36, h * 0.16, 3); flat(c, '#6a6e7a', 1.4); for (let i = 0; i < 3; i++) { circ(c, -w * 0.1 + i * w * 0.1, -h * 0.37, 2.4); c.fillStyle = ['#e84a3a', '#ffd23a', '#4ab85a'][i]; c.fill(); } for (const s of [-1, 1]) line(c, [s * w * 0.3, -h * 0.48, s * w * 0.45, -h * 0.3], INK, 5); },
  zombie: (c, { w, h, t, moving, mood }) => {
    const st = moving ? Math.sin(t * 5) * 4 : 0;
    for (const s of [-1, 1]) { rr(c, s * w * 0.14 - 5 + s * st, -h * 0.34, 10, h * 0.34, 3); paint(c, '#3a3248', -h * 0.34, 0); }
    rr(c, -w * 0.3, -h * 0.72, w * 0.6, h * 0.42, 6); paint(c, '#4a4160', -h * 0.72, -h * 0.3);
    poly(c, [-4, -h * 0.72, 0, -h * 0.4, 4, -h * 0.72]); flat(c, '#a8302a', 1.2);
    line(c, [w * 0.1, -h * 0.62, w * 0.62, -h * 0.64 + Math.sin(t * 3) * 3], INK, 9); line(c, [w * 0.1, -h * 0.62, w * 0.62, -h * 0.64 + Math.sin(t * 3) * 3], '#86b07c', 6);
    circ(c, 0, -h * 0.84, w * 0.3); paint(c, '#86b07c', -h, -h * 0.68);
    if (mood === 'sleepy') { line(c, [w * 0.02, -h * 0.87, w * 0.12, -h * 0.87], INK, 2); line(c, [w * 0.16, -h * 0.87, w * 0.24, -h * 0.87], INK, 2); }
    else { circ(c, w * 0.08, -h * 0.87, 3.4); flat(c, '#f4ff9a', 1.2); circ(c, w * 0.2, -h * 0.87, 2.8); flat(c, '#f4ff9a', 1.2); }
    line(c, [w * 0.04, -h * 0.76, w * 0.22, -h * 0.77], INK, 1.8);
  },
  monster: (c, { w, h, col, t, mood }) => { const k = col || '#8a5ad8'; for (const x of [-w * 0.2, w * 0.2]) { rr(c, x - 10, -h * 0.25, 20, h * 0.25, 8); paint(c, dark(k, 0.15), -h * 0.25, 0); } c.beginPath(); c.moveTo(-w / 2, -h * 0.2); c.bezierCurveTo(-w / 2, -h * 1.1, w / 2, -h * 1.1, w / 2, -h * 0.2); c.quadraticCurveTo(0, -h * 0.05, -w / 2, -h * 0.2); paint(c, k, -h, 0); for (const s of [-1, 1]) { poly(c, [s * w * 0.2, -h * 0.85, s * w * 0.32, -h * 1.05, s * w * 0.36, -h * 0.8]); paint(c, '#f2f4f8', -h, -h * 0.8, 1.6); } circ(c, 0, -h * 0.62, w * 0.16); flat(c, '#ffffff'); circ(c, w * 0.04 + Math.sin(t) * 3, -h * 0.62, w * 0.07); c.fillStyle = INK; c.fill(); c.beginPath(); c.moveTo(-w * 0.22, -h * 0.35); c.quadraticCurveTo(0, mood === 'angry' ? -h * 0.4 : -h * 0.2, w * 0.22, -h * 0.35); stroke(c, INK, 2.6); for (let i = 0; i < 3; i++) { poly(c, [-w * 0.12 + i * w * 0.1, -h * 0.33, -w * 0.08 + i * w * 0.1, -h * 0.26, -w * 0.04 + i * w * 0.1, -h * 0.33]); flat(c, '#ffffff', 1); } },
  scarecrow: (c, { w, h, t }) => { line(c, [0, 0, 0, -h * 0.9], INK, 6); line(c, [0, 0, 0, -h * 0.9], '#8a5a2c', 3.6); line(c, [-w / 2, -h * 0.6, w / 2, -h * 0.6], INK, 5); line(c, [-w / 2, -h * 0.6, w / 2, -h * 0.6], '#8a5a2c', 3); poly(c, [-w * 0.3, -h * 0.68, w * 0.3, -h * 0.68, w * 0.24, -h * 0.28, -w * 0.24, -h * 0.28]); paint(c, '#5a8ad8', -h * 0.7, -h * 0.28); for (let i = 0; i < 4; i++) line(c, [-w * 0.2 + i * w * 0.13, -h * 0.28, -w * 0.22 + i * w * 0.13 + Math.sin(t * 3 + i) * 2, -h * 0.2], '#e8c46a', 2.2); circ(c, 0, -h * 0.78, w * 0.2); paint(c, '#f2dca0', -h * 0.95, -h * 0.6); poly(c, [-w * 0.32, -h * 0.88, w * 0.32, -h * 0.88, w * 0.12, -h, -w * 0.12, -h]); paint(c, '#8a5a2c', -h, -h * 0.86); for (const x of [-5, 5]) { line(c, [x - 3, -h * 0.8, x + 3, -h * 0.76], INK, 1.8); line(c, [x - 3, -h * 0.76, x + 3, -h * 0.8], INK, 1.8); } },
  'teddy bear': (c, { w, h, mood }) => { const k = '#c98a4e'; for (const s of [-1, 1]) { circ(c, s * w * 0.25, -h * 0.12, w * 0.18); paint(c, k, -h * 0.3, 0); circ(c, s * w * 0.3, -h * 0.9, w * 0.13); paint(c, k, -h, -h * 0.8); } ell(c, 0, -h * 0.35, w * 0.36, h * 0.3); paint(c, k, -h * 0.65, -h * 0.05); ell(c, 0, -h * 0.32, w * 0.2, h * 0.17); flat(c, '#f2dcc0', 0); circ(c, 0, -h * 0.72, w * 0.3); paint(c, k, -h, -h * 0.45); ell(c, 0, -h * 0.64, w * 0.13, h * 0.08); flat(c, '#f2dcc0', 1.2); eye(c, -w * 0.1, -h * 0.76, 2, mood === 'sleepy'); eye(c, w * 0.1, -h * 0.76, 2, mood === 'sleepy'); circ(c, 0, -h * 0.66, 2.2); c.fillStyle = INK; c.fill(); line(c, [-w * 0.3, -h * 0.5, w * 0.3, -h * 0.5], '#e8403a', 3); },
  // Food and plants
  apple: (c, { w, h, col }) => { const k = col || '#e8403a'; c.beginPath(); c.moveTo(0, -h * 0.8); c.bezierCurveTo(w * 0.7, -h * 1.1, w * 0.6, h * 0.1, 0, -h * 0.05); c.bezierCurveTo(-w * 0.6, h * 0.1, -w * 0.7, -h * 1.1, 0, -h * 0.8); paint(c, k, -h, 0); line(c, [0, -h * 0.8, 2, -h], '#6a4a2a', 2.4); ell(c, 6, -h * 0.94, 6, 3, -0.4); paint(c, '#6fc257', -h, -h * 0.85, 1.4); shine(c, -w * 0.2, -h * 0.55, w * 0.1, h * 0.16, 0.55); },
  banana: (c, { w, h }) => { c.beginPath(); c.moveTo(-w / 2, -h * 0.8); c.quadraticCurveTo(0, h * 0.3, w / 2, -h * 0.8); c.quadraticCurveTo(0, -h * 0.1, -w / 2, -h * 0.8); paint(c, '#f5d23a', -h, 0); line(c, [-w / 2, -h * 0.8, -w / 2 - 3, -h], '#6a4a2a', 3); },
  carrot: (c, { w, h }) => { poly(c, [-w / 2, -h / 2, w * 0.35, -h * 0.95, w * 0.35, -h * 0.05]); paint(c, '#f28a3a', -h, 0); for (let i = 1; i < 4; i++) line(c, [-w / 2 + i * w * 0.2, -h * 0.5 - i * 2, -w / 2 + i * w * 0.2 + 4, -h * 0.5 - i * 2 + 1], dark('#f28a3a', 0.25), 1.2); for (const a of [-0.5, 0, 0.5]) { c.save(); c.translate(w * 0.38, -h / 2); c.rotate(a); ell(c, 8, 0, 9, 3); paint(c, '#6fc257', -3, 3, 1.4); c.restore(); } },
  lettuce: (c, { w, h }) => { for (let i = 0; i < 5; i++) { ell(c, -w * 0.3 + i * w * 0.15, -h * 0.45, w * 0.24, h * 0.42, (i - 2) * 0.3); paint(c, i % 2 ? '#8ad46a' : '#6fc257', -h, 0, 1.6); } circ(c, 0, -h * 0.4, w * 0.2); paint(c, '#c8f09a', -h * 0.6, -h * 0.2, 1.4); },
  grass: (c, { w, h }) => { for (let i = 0; i < 7; i++) { const x = -w / 2 + (w * i) / 6; poly(c, [x - 4, 0, x + Math.sin(i) * 6, -h * (0.6 + (i % 3) * 0.2), x + 4, 0]); paint(c, i % 2 ? '#6fc257' : '#86d467', -h, 0, 1.5); } },
  'hay bale': (c, { w, h, col }) => {
    const k = col || '#f0c65a';
    rr(c, -w / 2, -h, w, h, Math.min(14, h * 0.2)); paint(c, k, -h, 0);
    c.save(); rr(c, -w / 2, -h, w, h, Math.min(14, h * 0.2)); c.clip();
    for (let i = 0; i < 18; i++) { const x = -w / 2 + ((i * 37) % 100) / 100 * w, y = -h + ((i * 53) % 100) / 100 * h; line(c, [x, y, x + w * 0.1, y - 1], i % 3 ? dark(k, 0.2) : light(k, 0.5), 1.6); }
    c.fillStyle = 'rgba(120, 70, 10, 0.18)'; c.fillRect(-w / 2, -h * 0.25, w, h * 0.25);
    c.restore();
    for (const x of [-w * 0.24, w * 0.18]) { rr(c, x, -h, w * 0.07, h, 1); paint(c, '#8a5a2c', -h, 0, 1.6); }
    shine(c, -w * 0.2, -h * 0.85, w * 0.25, 3, 0.5);
  },
  raisin: (c, { w, h }) => { ell(c, 0, -h / 2, w / 2, h / 2); paint(c, '#6a3a4a', -h, 0, 1.6); line(c, [-w * 0.2, -h * 0.6, w * 0.15, -h * 0.4], '#9a5a6a', 1.2); },
  strawberry: (c, { w, h }) => { c.beginPath(); c.moveTo(-w / 2, -h * 0.75); c.quadraticCurveTo(0, -h * 0.95, w / 2, -h * 0.75); c.quadraticCurveTo(w * 0.3, 0, 0, 0); c.quadraticCurveTo(-w * 0.3, 0, -w / 2, -h * 0.75); paint(c, '#e8403a', -h, 0); for (let i = 0; i < 6; i++) { ell(c, -w * 0.25 + ((i * 7) % 4) * w * 0.15, -h * 0.6 + Math.floor(i / 3) * h * 0.25, 1.2, 1.8); c.fillStyle = '#ffe08a'; c.fill(); } poly(c, [-w * 0.4, -h * 0.8, 0, -h, w * 0.4, -h * 0.8, 0, -h * 0.7]); paint(c, '#6fc257', -h, -h * 0.7, 1.4); },
  grapes: (c, { w, h }) => { line(c, [0, -h, 0, -h * 0.8], '#6a4a2a', 2.4); for (let r = 0; r < 4; r++) for (let i = 0; i <= 3 - r; i++) { circ(c, -w * 0.3 + i * w * 0.2 + r * w * 0.1, -h * 0.7 + r * h * 0.18, w * 0.16); paint(c, '#8a4ac8', -h, 0, 1.4); } },
  corn: (c, { w, h }) => { ell(c, 0, -h * 0.5, w * 0.35, h * 0.46); paint(c, '#f5d23a', -h, 0); for (let i = 1; i < 6; i++) line(c, [-w * 0.3, -h * 0.9 + i * h * 0.14, w * 0.3, -h * 0.9 + i * h * 0.14], dark('#f5d23a', 0.2), 1); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * w * 0.8, -h * 0.4, s * w * 0.3, -h * 0.8); c.quadraticCurveTo(s * w * 0.2, -h * 0.3, 0, 0); paint(c, '#6fc257', -h, 0, 1.6); } },
  watermelon: (c, { w, h }) => { ell(c, 0, -h / 2, w / 2, h / 2); paint(c, '#4ab85a', -h, 0); for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, -h / 2, Math.abs(i) * w * 0.12 + 2, h / 2 - 2, 0, -Math.PI / 2, Math.PI / 2, i < 0); stroke(c, '#2e7a3a', 2); } shine(c, -w * 0.2, -h * 0.72, w * 0.12, h * 0.1, 0.4); },
  pumpkin: (c, { w, h }) => { for (const s of [-1, 1, 0]) { ell(c, s * w * 0.2, -h * 0.45, w * 0.32, h * 0.45); paint(c, '#f28a2a', -h, 0); } rr(c, -4, -h - 6, 8, 12, 3); paint(c, '#6a8a3a', -h - 6, -h + 6, 1.6); },
  mushroom: (c, { w, h }) => { rr(c, -w * 0.16, -h * 0.55, w * 0.32, h * 0.55, 6); paint(c, '#fbf2dc', -h * 0.55, 0); c.beginPath(); c.ellipse(0, -h * 0.5, w / 2, h / 2, 0, Math.PI, 0); c.closePath(); paint(c, '#e8403a', -h, -h * 0.5); for (const [x, y, r] of [[-0.25, -0.7, 4], [0.15, -0.82, 3.4], [0.3, -0.6, 3]]) { circ(c, x * w, y * h, r); flat(c, '#ffffff', 1.2); } },
  flower: (c, { w, h, col }) => { const k = col || '#f7a1c4'; line(c, [0, 0, 0, -h * 0.7], '#3f8f3e', 2.6); ell(c, 5, -h * 0.35, 6, 3, -0.5); paint(c, '#6fc257', -h * 0.4, -h * 0.3, 1.2); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ell(c, Math.cos(a) * w * 0.25, -h * 0.78 + Math.sin(a) * w * 0.25, w * 0.2, w * 0.13, a); paint(c, k, -h, -h * 0.6, 1.3); } circ(c, 0, -h * 0.78, w * 0.14); flat(c, '#ffb21f', 1.2); },
  sunflower: (c, { w, h }) => { line(c, [0, 0, 0, -h * 0.75], INK, 5); line(c, [0, 0, 0, -h * 0.75], '#4f9a3e', 3); for (const s of [-1, 1]) { ell(c, s * 10, -h * 0.4, 11, 5, s * 0.4); paint(c, '#6fc257', -h * 0.45, -h * 0.35, 1.3); } for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ell(c, Math.cos(a) * w * 0.38, -h * 0.84 + Math.sin(a) * w * 0.38, w * 0.2, w * 0.09, a); paint(c, '#ffd23a', -h, -h * 0.7, 1.2); } circ(c, 0, -h * 0.84, w * 0.28); paint(c, '#6a3a1c', -h, -h * 0.7, 1.6); },
  tree: (c, { w, h }) => {
    const tw = w * 0.14;
    c.beginPath(); c.moveTo(-tw * 0.9, 0); c.bezierCurveTo(-tw * 0.4, -h * 0.2, -tw * 0.5, -h * 0.4, -tw * 0.4, -h * 0.55); c.lineTo(tw * 0.4, -h * 0.55); c.bezierCurveTo(tw * 0.5, -h * 0.4, tw * 0.4, -h * 0.2, tw * 0.9, 0); c.closePath();
    c.fillStyle = grad(c, '#9b6a43', 0, 0, -tw, tw); c.fill(); stroke(c);
    for (let i = 0; i < 4; i++) line(c, [-tw * 0.2 + i * 3, -h * (0.08 + i * 0.1), -tw * 0.25 + i * 3, -h * (0.14 + i * 0.1)], '#5c3b24', 1.5);
    const blobs = [[-0.22, 0.62, 0.26], [0.22, 0.64, 0.27], [0, 0.8, 0.28], [-0.3, 0.8, 0.18], [0.32, 0.82, 0.18]];
    for (const [x, y, r] of blobs) { circ(c, x * w, -y * h, r * w); const g = c.createRadialGradient(x * w - r * w * 0.3, -y * h - r * w * 0.35, 2, x * w, -y * h, r * w); g.addColorStop(0, '#8fe07a'); g.addColorStop(0.6, '#5cbd55'); g.addColorStop(1, '#3d9444'); c.fillStyle = g; c.fill(); stroke(c); }
    for (let i = 0; i < 10; i++) { const x = -w * 0.35 + ((i * 37) % 70) / 100 * w, y = -h * (0.58 + ((i * 53) % 30) / 100); line(c, [x, y, x + 5, y - 5, x + 9, y - 2], '#2f7a36', 1.5); }
  },
  pine: (c, { w, h }) => { rr(c, -w * 0.07, -h * 0.25, w * 0.14, h * 0.25, 3); paint(c, '#8a5a3a', -h * 0.25, 0); for (let i = 0; i < 4; i++) { const y = -h * 0.2 - i * h * 0.2, hw = (w / 2) * (1 - i * 0.2); poly(c, [-hw, y, 0, y - h * 0.32, hw, y]); paint(c, i % 2 ? '#3f8f4e' : '#4aa05a', y - h * 0.32, y); } poly(c, [0, -h - 10, 5, -h - 2, 0, -h + 4, -5, -h - 2]); flat(c, '#ffd84a', 1.2); },
  bush: (c, { w, h }) => { for (const [x, y, r] of [[-0.25, 0.4, 0.28], [0.25, 0.42, 0.3], [0, 0.6, 0.34]]) { circ(c, x * w, -y * h, r * w); paint(c, '#5cbd55', -h, 0); } for (let i = 0; i < 4; i++) { circ(c, -w * 0.3 + i * w * 0.2, -h * 0.5 + (i % 2) * 8, 3); flat(c, '#e8403a', 1.2); } },
  cactus: (c, { w, h }) => { for (const [x, y, hh] of [[-w * 0.35, -h * 0.45, h * 0.3], [w * 0.35, -h * 0.6, h * 0.3]]) { rr(c, x - w * 0.12, y - hh, w * 0.24, hh, w * 0.12); paint(c, '#5cb04a', y - hh, y); line(c, [x, y - 4, 0, y - 4], INK, w * 0.24 + 2); line(c, [x, y - 4, 0, y - 4], '#5cb04a', w * 0.24 - 2); } rr(c, -w * 0.2, -h, w * 0.4, h, w * 0.2); paint(c, '#5cb04a', -h, 0); for (let i = 0; i < 6; i++) line(c, [-w * 0.08 + (i % 2) * w * 0.16, -h * 0.85 + i * h * 0.13, -w * 0.12 + (i % 2) * w * 0.24, -h * 0.87 + i * h * 0.13], '#ffffff', 1.2); circ(c, 0, -h, 5); flat(c, '#f7a1c4', 1.2); },
  cheese: (c, { w, h }) => { poly(c, [-w / 2, 0, -w / 2, -h * 0.55, w / 2, -h, w / 2, 0]); paint(c, '#ffd23a', -h, 0); for (const [x, y, r] of [[-0.25, -0.3, 4], [0.1, -0.45, 5], [0.3, -0.2, 3]]) { circ(c, x * w, y * h, r); flat(c, '#e8a82a', 0); } },
  bread: (c, { w, h }) => { c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h * 0.6); c.quadraticCurveTo(-w / 2, -h, 0, -h); c.quadraticCurveTo(w / 2, -h, w / 2, -h * 0.6); c.lineTo(w / 2, 0); c.closePath(); paint(c, '#d9964a', -h, 0); for (let i = 0; i < 3; i++) line(c, [-w * 0.25 + i * w * 0.2, -h * 0.85, -w * 0.15 + i * w * 0.2, -h * 0.6], '#f2c88a', 2); },
  cake: (c, { w, h, t }) => { rr(c, -w / 2, -h * 0.65, w, h * 0.65, 6); paint(c, '#f7c6d4', -h * 0.65, 0); rr(c, -w / 2, -h * 0.7, w, h * 0.16, 6); paint(c, '#ffffff', -h * 0.7, -h * 0.54); for (let i = 0; i < 5; i++) { circ(c, -w / 2 + 6 + (i * (w - 12)) / 4, -h * 0.54, 4); flat(c, '#ffffff', 0); } line(c, [-w / 2, -h * 0.3, w / 2, -h * 0.3], '#e8403a', 3); rr(c, -3, -h, 6, h * 0.3, 2); paint(c, '#7fb7ff', -h, -h * 0.7, 1.4); flames(c, 0, -h, 8, 12, t); circ(c, w * 0.25, -h * 0.72, 5); flat(c, '#e8403a', 1.2); },
  cookie: (c, { w, h }) => { circ(c, 0, -h / 2, w / 2); paint(c, '#d9a066', -h, 0); for (const [x, y] of [[-0.2, -0.6], [0.15, -0.4], [0.05, -0.75], [-0.1, -0.3]]) { circ(c, x * w, y * h, 2.4); c.fillStyle = '#5a3a2a'; c.fill(); } },
  pizza: (c, { w, h }) => { poly(c, [-w / 2, -h * 0.3, w / 2, -h, w / 2 - 4, 0]); paint(c, '#ffd86a', -h, 0); rr(c, w / 2 - 8, -h - 2, 10, h + 2, 4); paint(c, '#d9964a', -h, 0, 1.6); for (const [x, y] of [[-0.1, -0.4], [0.2, -0.55], [0.3, -0.25]]) { circ(c, x * w, y * h, 3.4); flat(c, '#e8403a', 1); } },
  'ice cream': (c, { w, h }) => { poly(c, [-w / 2, -h * 0.55, w / 2, -h * 0.55, 0, 0]); paint(c, '#e8b86a', -h * 0.55, 0); line(c, [-w * 0.3, -h * 0.45, w * 0.1, -h * 0.15], '#c9964a', 1.2); line(c, [w * 0.3, -h * 0.45, -w * 0.1, -h * 0.15], '#c9964a', 1.2); circ(c, 0, -h * 0.72, w * 0.52); paint(c, '#f7c6d4', -h, -h * 0.5); circ(c, 0, -h * 0.98, 3.4); flat(c, '#e8403a', 1.2); },
  lollipop: (c, { w, h }) => { line(c, [0, 0, 0, -h * 0.55], INK, 4); line(c, [0, 0, 0, -h * 0.55], '#ffffff', 2.2); circ(c, 0, -h * 0.75, w / 2); paint(c, '#f59ac0', -h, -h * 0.5); c.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.3) c.lineTo(Math.cos(a) * a * w * 0.025, -h * 0.75 + Math.sin(a) * a * w * 0.025); stroke(c, '#ffffff', 2); },
  pie: (c, { w, h }) => { poly(c, [-w / 2, -h * 0.6, w / 2, -h * 0.6, w * 0.4, 0, -w * 0.4, 0]); paint(c, '#c9964a', -h * 0.6, 0); c.beginPath(); c.ellipse(0, -h * 0.6, w / 2, h * 0.35, 0, Math.PI, 0); c.closePath(); paint(c, '#e8b86a', -h, -h * 0.6); for (let i = -1; i <= 1; i++) line(c, [i * 8, -h * 0.85, i * 8 + 4, -h * 0.7], '#a86a3a', 1.6); },
  sandwich: (c, { w, h }) => { rr(c, -w / 2, -h * 0.3, w, h * 0.3, 5); paint(c, '#e8b86a', -h * 0.3, 0); c.beginPath(); c.moveTo(-w / 2 - 2, -h * 0.35); for (let i = 0; i <= 8; i++) c.lineTo(-w / 2 + (w * i) / 8, -h * 0.35 - (i % 2) * 4); stroke(c, '#6fc257', 4); rr(c, -w / 2 + 2, -h * 0.5, w - 4, h * 0.14, 2); paint(c, '#f28aa0', -h * 0.5, -h * 0.36, 1.4); rr(c, -w / 2, -h, w, h * 0.46, 8); paint(c, '#e8b86a', -h, -h * 0.54); },
  egg: (c, { w, h }) => { c.beginPath(); c.moveTo(0, -h); c.bezierCurveTo(w * 0.6, -h, w * 0.6, 0, 0, 0); c.bezierCurveTo(-w * 0.6, 0, -w * 0.6, -h, 0, -h); paint(c, '#fbf2e2', -h, 0); shine(c, -w * 0.15, -h * 0.65, w * 0.1, h * 0.14, 0.6); },
  honey: (c, { w, h }) => { rr(c, -w / 2, -h * 0.8, w, h * 0.8, 10); paint(c, '#e8a82a', -h * 0.8, 0); rr(c, -w * 0.4, -h, w * 0.8, h * 0.22, 4); paint(c, '#c98a4e', -h, -h * 0.78, 1.8); c.fillStyle = INK; c.font = `800 ${Math.round(h * 0.2)}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.fillText('HONEY', 0, -h * 0.35); c.beginPath(); c.moveTo(-w * 0.2, -h * 0.78); c.quadraticCurveTo(-w * 0.22, -h * 0.6, -w * 0.18, -h * 0.55); stroke(c, '#f5c23a', 3); },
  mug: (c, { w, h, t }) => { rr(c, -w / 2, -h * 0.75, w * 0.8, h * 0.75, 6); paint(c, '#e8726a', -h * 0.75, 0); c.beginPath(); c.arc(w * 0.3, -h * 0.4, h * 0.18, -Math.PI / 2, Math.PI / 2); stroke(c, INK, 4.6); stroke(c, '#e8726a', 2.4); ell(c, -w * 0.1, -h * 0.75, w * 0.38, 3); flat(c, '#8a4a2a', 1.4); for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(-w * 0.2 + i * 10, -h * 0.8); c.quadraticCurveTo(-w * 0.1 + i * 10 + Math.sin(t * 3 + i) * 3, -h, -w * 0.2 + i * 10, -h * 1.2); stroke(c, 'rgba(200, 200, 210, 0.7)', 2); } },
  steak: (c, { w, h }) => { c.beginPath(); c.moveTo(-w / 2, -h * 0.5); c.bezierCurveTo(-w / 2, -h * 1.1, w * 0.4, -h * 1.1, w / 2, -h * 0.4); c.bezierCurveTo(w / 2, 0, -w / 2, 0, -w / 2, -h * 0.5); paint(c, '#c84a3a', -h, 0); c.beginPath(); c.moveTo(-w * 0.3, -h * 0.55); c.bezierCurveTo(-w * 0.2, -h * 0.85, w * 0.25, -h * 0.8, w * 0.3, -h * 0.45); stroke(c, '#f7dcd0', 2.4); for (let i = 0; i < 3; i++) line(c, [-w * 0.2 + i * w * 0.18, -h * 0.35, -w * 0.1 + i * w * 0.18, -h * 0.25], dark('#c84a3a', 0.3), 2); },
  sausage: (c, { w, h }) => { rr(c, -w / 2, -h * 0.9, w, h * 0.7, h * 0.35); paint(c, '#c8643a', -h, -h * 0.2); for (let i = 0; i < 3; i++) line(c, [-w * 0.2 + i * w * 0.18, -h * 0.75, -w * 0.12 + i * w * 0.18, -h * 0.65], light('#c8643a', 0.4), 1.6); },
  drumstick: (c, { w, h }) => { line(c, [-w * 0.1, -h * 0.4, w * 0.35, -h * 0.05], INK, 8); line(c, [-w * 0.1, -h * 0.4, w * 0.35, -h * 0.05], '#fbf2e2', 5.4); for (const s of [-1, 1]) { circ(c, w * 0.4 + s * 3, -h * 0.05 + s * 3, 4); flat(c, '#fbf2e2', 1.4); } ell(c, -w * 0.15, -h * 0.55, w * 0.33, h * 0.4, -0.6); paint(c, '#d9964a', -h, -h * 0.1); },
  bone: (c, { w, h }) => { rr(c, -w * 0.35, -h * 0.65, w * 0.7, h * 0.35, 4); paint(c, '#fbf2e2', -h, 0); for (const s of [-1, 1]) for (const k of [-1, 1]) { circ(c, s * w * 0.38, -h * 0.48 + k * h * 0.22, h * 0.24); paint(c, '#fbf2e2', -h, 0); } rr(c, -w * 0.35, -h * 0.63, w * 0.7, h * 0.31, 4); flat(c, '#fbf2e2', 0); },
  brain: (c, { w, h }) => { c.beginPath(); c.moveTo(-w / 2, -h * 0.3); c.bezierCurveTo(-w * 0.6, -h * 1.05, w * 0.6, -h * 1.05, w / 2, -h * 0.3); c.quadraticCurveTo(0, 0, -w / 2, -h * 0.3); paint(c, '#f5a8c0', -h, 0); for (const pts of [[-0.3, -0.6, -0.15, -0.8, 0, -0.6], [0.05, -0.75, 0.2, -0.55, 0.35, -0.7], [-0.25, -0.35, -0.05, -0.45, 0.15, -0.3]]) line(c, pts.map((v, i) => (i % 2 ? v * h : v * w)), '#c9707a', 1.8); line(c, [0, -h * 0.95, 0, -h * 0.25], '#c9707a', 1.6); },
  ball: (c, { w, h, t }) => { circ(c, 0, -h / 2, w / 2); paint(c, '#ffffff', -h, 0); c.save(); c.translate(0, -h / 2); c.rotate(t); c.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; c.lineTo(Math.cos(a) * w * 0.18, Math.sin(a) * w * 0.18); } c.closePath(); c.fillStyle = INK; c.fill(); c.restore(); },
  'beach ball': (c, { w, h }) => { const cols = ['#e8403a', '#ffffff', '#3a8ae8', '#ffffff', '#f5d23a', '#ffffff']; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, -h / 2); c.arc(0, -h / 2, w / 2, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2); c.closePath(); c.fillStyle = cols[i]; c.fill(); } circ(c, 0, -h / 2, w / 2); stroke(c); shine(c, -w * 0.18, -h * 0.72, w * 0.12, h * 0.08, 0.6); },
  umbrella: (c, { w, h, col }) => { const k = col || '#e8403a'; line(c, [0, -h * 0.75, 0, -h * 0.05], INK, 3.4); c.beginPath(); c.arc(-6, -h * 0.05, 6, 0, Math.PI); stroke(c, INK, 3.4); c.beginPath(); c.moveTo(-w / 2, -h * 0.55); c.quadraticCurveTo(0, -h * 1.15, w / 2, -h * 0.55); for (let i = 3; i >= 0; i--) c.quadraticCurveTo(-w / 2 + (w * (i + 0.5)) / 4, -h * 0.65, -w / 2 + (w * i) / 4, -h * 0.55); c.closePath(); paint(c, k, -h, -h * 0.55); },
  lighthouse: (c, { w, h, t }) => { poly(c, [-w * 0.38, 0, -w * 0.22, -h * 0.78, w * 0.22, -h * 0.78, w * 0.38, 0]); paint(c, '#f2f4f8', -h, 0); for (let i = 0; i < 3; i++) { const y0 = -h * 0.2 - i * h * 0.22; poly(c, [-w * 0.35 + i * 0.05 * w, y0, -w * 0.3 + i * 0.05 * w, y0 - h * 0.1, w * 0.3 - i * 0.05 * w, y0 - h * 0.1, w * 0.35 - i * 0.05 * w, y0]); flat(c, '#e8403a', 1.4); } rr(c, -w * 0.25, -h * 0.9, w * 0.5, h * 0.12, 3); paint(c, '#fff2a8', -h * 0.9, -h * 0.78); poly(c, [-w * 0.3, -h * 0.9, 0, -h, w * 0.3, -h * 0.9]); paint(c, '#e8403a', -h, -h * 0.9); c.save(); c.globalAlpha = 0.25; poly(c, [0, -h * 0.84, Math.cos(t) * w * 3, -h * 0.84 - 30, Math.cos(t) * w * 3, -h * 0.84 + 30]); c.fillStyle = '#fff6b0'; c.fill(); c.restore(); },
  chinchilla: (c, { h, t, moving, mood }) => drawChinchilla(c, KIT, 0, 0, { face: 1, h: h * 1.35, time: t, moving, dizzy: mood === 'angry', run: t * 10 }),
  pebble: () => { /* drawn by the scene with the arcade model */ },
  rockwall: (c, { w, h }) => { const rows = Math.max(3, Math.round(h / 40)); for (let r = 0; r < rows; r++) { const n = 2 + (r % 2); for (let i = 0; i < n; i++) { const rw = w / n, x = -w / 2 + i * rw, y = -h + (h * r) / rows; rr(c, x + 1, y + 1, rw - 2, h / rows - 2, 10); paint(c, ['#9d948c', '#8d847c', '#a8a098'][(r + i) % 3], y, y + h / rows); shine(c, x + rw * 0.35, y + 8, rw * 0.15, 3, 0.35); } } },
  gate: (c, { w, h }) => { rr(c, -w / 2, -h, w, h, 3); paint(c, '#6a5a4a', -h, 0); for (let i = 1; i < 4; i++) line(c, [-w / 2 + 4, -h + (h * i) / 4, w / 2 - 4, -h + (h * i) / 4], '#4a3e32', 3); for (let i = 0; i < 4; i++) { circ(c, 0, -h + (h * (i + 0.5)) / 4, 3); flat(c, '#a4a8b4', 1.2); } },
  plate: (c, { w, h }) => { rr(c, -w / 2, -h, w, h + 2, 3); paint(c, '#b8b0a4', -h, 0); rr(c, -w / 2 + 8, -h + 2, w - 16, 3, 1); flat(c, '#d8d0c4', 0); },
};

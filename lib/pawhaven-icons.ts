// Pawhaven's little painted icons for the page: goods, the HUD and event glyphs. Drawn on
// a canvas in the town's own style (soft fills, brown ink edges) and handed back as cached image URLs.
import { drawChinchilla } from './chinchilla-art';
import type { Good } from './pawhaven-game';

export type Glyph =
  | Good | 'acorn' | 'heart' | 'chin' | 'spring' | 'summer' | 'autumn' | 'winter' | 'star' | 'starOff' | 'flame' | 'fox' | 'storm'
  | 'drop' | 'sparkle' | 'look' | 'broom' | 'coins' | 'leave' | 'cart' | 'trophy' | 'calendar' | 'dry';

const INK = '#4a3628';
const cache = new Map<string, string>();

type C = CanvasRenderingContext2D;
const ink = (c: C, w = 2.2) => { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; };
function ell(c: C, x: number, y: number, rx: number, ry: number, fill: string, rot = 0, stroke = true) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { ink(c); c.stroke(); }
}
function shape(c: C, pts: number[], fill: string, close = true) {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close) c.closePath();
  c.fillStyle = fill; c.fill(); ink(c); c.stroke();
}
const shine = (c: C, x: number, y: number, r = 3) => ell(c, x, y, r, r * 0.7, 'rgba(255,255,255,0.75)', -0.5, false);
function star(c: C, cx: number, cy: number, r: number, fill: string) {
  const p: number[] = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; p.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  shape(c, p, fill);
}
function heartPath(c: C, cx: number, cy: number, s: number) {
  c.beginPath(); c.moveTo(cx, cy + s * 0.9);
  c.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.8, cy - s * 1.2, cx, cy - s * 0.45);
  c.bezierCurveTo(cx + s * 0.8, cy - s * 1.2, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9); c.closePath();
}

/** Each icon is drawn in a 64 by 64 box. */
const PAINT: Record<Glyph, (c: C) => void> = {
  berries: (c) => { shape(c, [32, 14, 44, 8, 40, 20], '#5f9a3f'); for (const [x, y] of [[24, 34], [40, 34], [32, 46], [20, 48], [44, 48]]) { ell(c, x, y, 9, 9, '#c8435a'); shine(c, x - 3, y - 3, 2.4); } },
  hay: (c) => { shape(c, [12, 50, 18, 16, 46, 16, 52, 50], '#e7c45e'); ink(c, 1.4); c.strokeStyle = '#c9a33f'; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(20 + k * 6, 18); c.lineTo(17 + k * 7.5, 48); c.stroke(); } c.fillStyle = '#b4553f'; c.fillRect(13, 30, 38, 6); ink(c); c.strokeRect(13, 30, 38, 6); },
  oats: (c) => { ink(c, 2.4); c.strokeStyle = '#a98a4a'; for (const dx of [-8, 0, 8]) { c.beginPath(); c.moveTo(32 + dx * 0.3, 56); c.quadraticCurveTo(32 + dx, 34, 32 + dx * 1.6, 14); c.stroke(); } for (const dx of [-8, 0, 8]) for (let k = 0; k < 4; k++) ell(c, 32 + dx * (1.6 - k * 0.15) + (k % 2 ? 3 : -3), 16 + k * 7, 3.2, 5, '#efe2b0', k % 2 ? 0.5 : -0.5); },
  wood: (c) => { for (const [x, y] of [[22, 42], [42, 42], [32, 24]]) { ell(c, x, y, 11, 11, '#c9935a'); ell(c, x, y, 6, 6, '#e0b27a', 0, false); ink(c, 1.2); c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.stroke(); } },
  clay: (c) => { shape(c, [10, 30, 32, 20, 54, 30, 32, 40], '#d99068'); shape(c, [10, 30, 32, 40, 32, 52, 10, 42], '#c47a4f'); shape(c, [32, 40, 54, 30, 54, 42, 32, 52], '#a8623d'); },
  sand: (c) => { c.beginPath(); c.moveTo(8, 50); c.quadraticCurveTo(32, 6, 56, 50); c.closePath(); c.fillStyle = '#ead39a'; c.fill(); ink(c); c.stroke(); c.fillStyle = '#c9ab6a'; for (const [x, y] of [[26, 36], [36, 30], [40, 42], [30, 44], [22, 46]]) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); } },
  dust: (c) => { for (const [x, y, r] of [[22, 38, 12], [40, 36, 13], [31, 26, 12], [32, 44, 11]]) ell(c, x, y, r, r * 0.85, '#d9cfe6'); for (const [x, y] of [[14, 18], [50, 20], [52, 48]]) star(c, x, y, 4.5, '#fff4c9'); },
  pottery: (c) => { c.beginPath(); c.moveTo(22, 14); c.lineTo(42, 14); c.quadraticCurveTo(38, 20, 46, 30); c.quadraticCurveTo(52, 50, 32, 54); c.quadraticCurveTo(12, 50, 18, 30); c.quadraticCurveTo(26, 20, 22, 14); c.closePath(); c.fillStyle = '#d0784a'; c.fill(); ink(c); c.stroke(); ink(c, 2); c.strokeStyle = '#f2dcc0'; c.beginPath(); c.moveTo(20, 36); c.quadraticCurveTo(32, 40, 44, 36); c.stroke(); shine(c, 25, 30, 3); },
  toys: (c) => { ell(c, 32, 34, 18, 18, '#6fa6dc'); c.save(); c.beginPath(); c.arc(32, 34, 18, 0, Math.PI * 2); c.clip(); c.fillStyle = '#f2c94c'; c.fillRect(14, 28, 36, 12); c.fillStyle = '#d4574e'; c.fillRect(29, 14, 6, 40); c.restore(); ink(c); c.beginPath(); c.arc(32, 34, 18, 0, Math.PI * 2); c.stroke(); shine(c, 25, 26, 3.5); },
  bedding: (c) => { c.beginPath(); c.moveTo(10, 24); c.quadraticCurveTo(32, 16, 54, 24); c.quadraticCurveTo(58, 36, 54, 46); c.quadraticCurveTo(32, 54, 10, 46); c.quadraticCurveTo(6, 36, 10, 24); c.closePath(); c.fillStyle = '#f0b3c4'; c.fill(); ink(c); c.stroke(); c.fillStyle = '#fff'; for (const [x, y] of [[22, 32], [34, 38], [44, 30], [28, 42]]) { c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill(); } },
  acorn: (c) => { ell(c, 32, 38, 15, 17, '#c47a3a'); c.beginPath(); c.moveTo(14, 30); c.quadraticCurveTo(32, 8, 50, 30); c.quadraticCurveTo(32, 36, 14, 30); c.closePath(); c.fillStyle = '#8a5a34'; c.fill(); ink(c); c.stroke(); ink(c, 3); c.beginPath(); c.moveTo(32, 16); c.quadraticCurveTo(34, 10, 39, 9); c.stroke(); shine(c, 25, 41, 3.4); },
  heart: (c) => { heartPath(c, 32, 34, 18); c.fillStyle = '#e66a7e'; c.fill(); ink(c); c.stroke(); shine(c, 23, 26, 4); },
  chin: (c) => { drawChinchilla(c, 'dora', 32, 58, { face: 1, h: 50, time: 0 }); },
  spring: (c) => { for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; ell(c, 32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12, 9, 7, '#f6b8c8', a); } ell(c, 32, 32, 7, 7, '#f2c94c'); },
  summer: (c) => { ink(c, 3); c.strokeStyle = '#e6a83a'; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.beginPath(); c.moveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); c.lineTo(32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27); c.stroke(); } ell(c, 32, 32, 14, 14, '#f7cf4f'); shine(c, 27, 27, 3); },
  autumn: (c) => { c.beginPath(); c.moveTo(32, 8); c.quadraticCurveTo(54, 20, 50, 40); c.quadraticCurveTo(40, 52, 32, 54); c.quadraticCurveTo(24, 52, 14, 40); c.quadraticCurveTo(10, 20, 32, 8); c.closePath(); c.fillStyle = '#e08a3c'; c.fill(); ink(c); c.stroke(); ink(c, 1.8); c.beginPath(); c.moveTo(32, 14); c.lineTo(32, 60); for (const y of [26, 36, 46]) { c.moveTo(32, y); c.lineTo(22, y - 6); c.moveTo(32, y); c.lineTo(42, y - 6); } c.stroke(); },
  winter: (c) => { ink(c, 3.2); c.strokeStyle = '#7ab4dc'; for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; c.beginPath(); c.moveTo(32 - Math.cos(a) * 22, 32 - Math.sin(a) * 22); c.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); c.stroke(); } ell(c, 32, 32, 5, 5, '#e9f5fc'); },
  star: (c) => star(c, 32, 33, 24, '#f6c445'),
  starOff: (c) => star(c, 32, 33, 24, '#e7dcc6'),
  flame: (c) => { c.beginPath(); c.moveTo(32, 6); c.quadraticCurveTo(56, 30, 46, 48); c.quadraticCurveTo(32, 62, 18, 48); c.quadraticCurveTo(10, 32, 24, 22); c.quadraticCurveTo(24, 32, 30, 32); c.quadraticCurveTo(26, 18, 32, 6); c.closePath(); c.fillStyle = '#f08a3c'; c.fill(); ink(c); c.stroke(); ell(c, 32, 46, 7, 9, '#fbd36a', 0, false); },
  fox: (c) => { shape(c, [14, 12, 24, 26, 18, 30], '#d27a3c'); shape(c, [50, 12, 40, 26, 46, 30], '#d27a3c'); c.beginPath(); c.moveTo(14, 26); c.quadraticCurveTo(32, 16, 50, 26); c.quadraticCurveTo(48, 44, 32, 54); c.quadraticCurveTo(16, 44, 14, 26); c.closePath(); c.fillStyle = '#e08a4a'; c.fill(); ink(c); c.stroke(); c.beginPath(); c.moveTo(22, 40); c.quadraticCurveTo(32, 36, 42, 40); c.quadraticCurveTo(38, 50, 32, 54); c.quadraticCurveTo(26, 50, 22, 40); c.fillStyle = '#fbefe0'; c.fill(); ell(c, 25, 33, 2.4, 3, INK, 0, false); ell(c, 39, 33, 2.4, 3, INK, 0, false); ell(c, 32, 50, 3, 2.2, INK, 0, false); },
  storm: (c) => { for (const [x, y, r] of [[22, 26, 11], [36, 22, 13], [46, 30, 9]]) ell(c, x, y, r, r * 0.85, '#b8c4d4'); ell(c, 32, 32, 18, 7, '#b8c4d4'); ink(c, 2.4); c.strokeStyle = '#5aa7d8'; for (const x of [20, 32, 44]) { c.beginPath(); c.moveTo(x, 44); c.lineTo(x - 3, 54); c.stroke(); } },
  drop: (c) => { c.beginPath(); c.moveTo(32, 8); c.quadraticCurveTo(50, 32, 48, 42); c.quadraticCurveTo(44, 56, 32, 56); c.quadraticCurveTo(20, 56, 16, 42); c.quadraticCurveTo(14, 32, 32, 8); c.closePath(); c.fillStyle = '#5aa7d8'; c.fill(); ink(c); c.stroke(); shine(c, 25, 40, 3.5); },
  sparkle: (c) => { star(c, 30, 34, 20, '#fff1a8'); star(c, 50, 14, 7, '#fff1a8'); star(c, 12, 14, 5, '#fff1a8'); },
  look: (c) => { ell(c, 28, 28, 16, 16, '#d9f0fb'); ink(c, 6); c.beginPath(); c.moveTo(40, 40); c.lineTo(54, 54); c.stroke(); c.strokeStyle = '#c9935a'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(40, 40); c.lineTo(54, 54); c.stroke(); ink(c, 2.6); c.beginPath(); c.arc(28, 28, 16, 0, Math.PI * 2); c.stroke(); shine(c, 22, 22, 4); },
  broom: (c) => { ink(c, 4); c.strokeStyle = '#9a6a3c'; c.beginPath(); c.moveTo(48, 8); c.lineTo(30, 36); c.stroke(); shape(c, [24, 32, 38, 40, 30, 58, 10, 52], '#e7c45e'); ink(c, 1.4); c.strokeStyle = '#c9a33f'; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(26 + k * 3, 38); c.lineTo(14 + k * 5, 52); c.stroke(); } },
  coins: (c) => { for (const [x, y] of [[24, 40], [40, 40], [32, 26]]) { ell(c, x, y, 12, 12, '#c47a3a'); c.beginPath(); c.moveTo(x - 10, y - 2); c.quadraticCurveTo(x, y - 18, x + 10, y - 2); c.closePath(); c.fillStyle = '#8a5a34'; c.fill(); ink(c); c.stroke(); } },
  leave: (c) => { ink(c, 3); c.strokeStyle = '#9a8670'; c.beginPath(); c.moveTo(10, 50); c.quadraticCurveTo(30, 40, 54, 44); c.stroke(); c.fillStyle = '#c4b49c'; for (const [x, y] of [[20, 44], [32, 41], [44, 42]]) { c.beginPath(); c.ellipse(x, y, 3, 2, 0.3, 0, Math.PI * 2); c.fill(); } drawChinchilla(c, 'enzo', 46, 38, { face: 1, h: 30, time: 0.4, moving: true, run: 0.4 }); },
  cart: (c) => { shape(c, [10, 22, 52, 22, 48, 42, 14, 42], '#c9935a'); for (const [x, y, col] of [[22, 20, '#e7c45e'], [34, 18, '#c8435a'], [44, 20, '#efe2b0']] as const) ell(c, x, y, 7, 6, col); ell(c, 20, 46, 6, 6, '#7a5a3a'); ell(c, 44, 46, 6, 6, '#7a5a3a'); },
  trophy: (c) => { shape(c, [18, 10, 46, 10, 44, 30, 32, 38, 20, 30], '#f6c445'); ink(c, 3); c.beginPath(); c.arc(16, 20, 6, Math.PI * 0.5, Math.PI * 1.5); c.arc(48, 20, 6, -Math.PI * 0.5, Math.PI * 0.5); c.stroke(); shape(c, [28, 38, 36, 38, 38, 48, 26, 48], '#e0a83a'); shape(c, [18, 48, 46, 48, 46, 56, 18, 56], '#9a6a3c'); shine(c, 25, 18, 3.5); },
  calendar: (c) => { shape(c, [10, 14, 54, 14, 54, 54, 10, 54], '#fff8e8'); shape(c, [10, 14, 54, 14, 54, 24, 10, 24], '#d4574e'); c.fillStyle = INK; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) c.fillRect(16 + k * 10, 30 + r * 8, 5, 4); },
  dry: (c) => { PAINT.summer(c); ink(c, 2); c.strokeStyle = '#b48d62'; c.beginPath(); c.moveTo(8, 58); c.lineTo(20, 50); c.lineTo(30, 58); c.lineTo(42, 50); c.lineTo(56, 58); c.stroke(); },
};

/** An icon as an image URL, drawn once at twice the size for sharp edges. */
export function glyph(g: Glyph, px = 64) {
  const key = `${g}:${px}`; const hit = cache.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
  const c = cv.getContext('2d')!; c.scale((px * 2) / 64, (px * 2) / 64); PAINT[g](c);
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}

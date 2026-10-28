// Seedstorm's sky, drawn in Canvas 2D: the stage's painting (or a drawn stand-in) scrolling down, two drifting cloud
// layers, the critters and bosses, Dora and Enzo on their dandelion-seed gliders, glowing bullets, seeds, the Bloom,
// puffs of fluff, petals and score popups, and the HUD. Drawing only: the rules live in seedstorm-game.ts.
// Every painting has a drawn stand-in, shown until (or unless) it loads. The hot path only blits cached sprites: every
// bullet, shot, seed and particle look is painted once per screen scale and reused.
import { drawChinchilla } from './chinchilla-art';
import {
  W, H, HITBOX, BLOOM, BOSSES, CRITTERS, LOOK_R, PILOTS, STAGES, HZ,
  type SeedstormGame, type Ev, type Pilot, type CritterKind, type BossId, type Boss,
} from './seedstorm-game';

const FONT = 'ui-rounded, "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;
/** Bullet colours by HUE index: bright core, glow and the dark rim that keeps them readable on any sky. */
const HUES: [string, string, string][] = [
  ['#fff2f8', '#ff6fae', '#7e1242'], ['#fffbe2', '#ffc02a', '#6e3c00'], ['#f0fcff', '#3fbfff', '#0b3a6a'], ['#f0fff6', '#36e094', '#0a5634'],
  ['#faf2ff', '#b47aff', '#3a1276'], ['#fff0ea', '#ff5636', '#641004'], ['#ffffff', '#c6d8ff', '#28355a'], ['#fff6ea', '#ff982a', '#642e00'],
];
/** Each stage's look: sky top and bottom for the drawn stand-in, cloud colour, cloud alpha, colour grade, and letterbox tint. */
const SKY: { top: string; bottom: string; cloud: string; cloudA: number; grade: string; night: boolean }[] = [
  { top: '#9fd6ef', bottom: '#cdeec0', cloud: '#ffffff', cloudA: 0.55, grade: 'rgba(255, 214, 150, 0.10)', night: false },
  { top: '#f7d0d8', bottom: '#cfe7b4', cloud: '#fff6f8', cloudA: 0.5, grade: 'rgba(255, 190, 200, 0.10)', night: false },
  { top: '#7d7a9c', bottom: '#b9b4cf', cloud: '#e6e2f2', cloudA: 0.45, grade: 'rgba(90, 70, 140, 0.14)', night: false },
  { top: '#18234a', bottom: '#38507a', cloud: '#c8d4f0', cloudA: 0.28, grade: 'rgba(30, 40, 110, 0.16)', night: true },
  { top: '#2c1748', bottom: '#5a3b7c', cloud: '#c9a8f0', cloudA: 0.32, grade: 'rgba(80, 30, 120, 0.16)', night: true },
];

/** How each painted sky is quietened under play: how far to desaturate it, and a wash of the stage's deep colour. */
const GRADE: { desat: number; wash: string }[] = [
  { desat: 0.5, wash: 'rgba(28, 52, 64, 0.42)' },
  { desat: 0.5, wash: 'rgba(58, 34, 52, 0.42)' },
  { desat: 0.35, wash: 'rgba(36, 30, 64, 0.32)' },
  { desat: 0.25, wash: 'rgba(10, 14, 40, 0.26)' },
  { desat: 0.25, wash: 'rgba(30, 10, 50, 0.26)' },
];

let seedR = 1;
const rand = () => { seedR = (seedR + 0x6d2b79f5) >>> 0; let t = seedR; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
const ell = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); };
const circ = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); };
const star = (c: CanvasRenderingContext2D, x: number, y: number, n: number, r0: number, r1: number, rot = -Math.PI / 2) => {
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r1 : r0, a = rot + (i * Math.PI) / n; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath();
};
const heartPath = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.8, y - s * 1.2, x, y - s * 0.45);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); c.closePath();
};

// ---------------------------------------------------------------- drawn stand-ins (shared with the page for portraits)
/** A grumpy face: brows, eyes and a frown (or a smile once calm). */
function face(c: CanvasRenderingContext2D, x: number, y: number, s: number, o: { eye?: string; calm?: boolean; glow?: string; sleepy?: boolean } = {}) {
  const eye = o.eye ?? '#2a1a14';
  if (o.glow) { c.fillStyle = o.glow; circ(c, x - s * 0.42, y, s * 0.32); c.fill(); circ(c, x + s * 0.42, y, s * 0.32); c.fill(); }
  c.fillStyle = eye;
  if (o.sleepy) { c.strokeStyle = eye; c.lineWidth = s * 0.1; c.lineCap = 'round'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * s * 0.42, y - s * 0.05, s * 0.17, 0.2, Math.PI - 0.2); c.stroke(); } }
  else for (const sx of [-1, 1]) { ell(c, x + sx * s * 0.42, y, s * 0.13, s * 0.17); c.fill(); c.fillStyle = '#ffffff'; circ(c, x + sx * s * 0.42 + s * 0.04, y - s * 0.06, s * 0.05); c.fill(); c.fillStyle = eye; }
  c.strokeStyle = eye; c.lineWidth = s * 0.09; c.lineCap = 'round';
  if (!o.calm) for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(x + sx * s * 0.62, y - s * 0.34); c.lineTo(x + sx * s * 0.22, y - s * 0.22); c.stroke(); }
  c.beginPath();
  if (o.calm) c.arc(x, y + s * 0.18, s * 0.22, 0.25, Math.PI - 0.25);
  else c.arc(x, y + s * 0.5, s * 0.2, Math.PI + 0.5, TAU - 0.5);
  c.stroke();
  if (o.calm) { c.fillStyle = 'rgba(255, 130, 150, 0.45)'; circ(c, x - s * 0.7, y + s * 0.2, s * 0.14); c.fill(); circ(c, x + s * 0.7, y + s * 0.2, s * 0.14); c.fill(); }
}

/** A critter in a box `s` units across, centred on (0, 0). */
export function paintCritter(c: CanvasRenderingContext2D, kind: CritterKind, s: number, calm = false) {
  const u = s / 30; c.save(); c.scale(u, u); c.lineJoin = 'round';
  const ink = '#4a2e22';
  switch (kind) {
    case 'bumble': {
      c.fillStyle = 'rgba(235, 248, 255, 0.85)'; c.strokeStyle = '#8fb6d0'; c.lineWidth = 0.8;
      for (const sx of [-1, 1]) { ell(c, sx * 7, -9, 6, 4, sx * -0.5); c.fill(); c.stroke(); }
      const g = c.createRadialGradient(-3, -4, 1, 0, 0, 12); g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#f5b800');
      c.fillStyle = g; c.strokeStyle = ink; c.lineWidth = 1.4; circ(c, 0, 1, 11); c.fill(); c.stroke();
      c.save(); circ(c, 0, 1, 10.4); c.clip(); c.fillStyle = '#5a3a22'; c.fillRect(-12, 3, 24, 3.2); c.fillRect(-12, 8.5, 24, 3); c.restore();
      c.fillStyle = 'rgba(255,255,255,0.6)'; ell(c, -4, -4, 3, 2, -0.5); c.fill();
      face(c, 0, -1, 7, { calm });
      c.strokeStyle = ink; c.lineWidth = 0.9; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 3, -9); c.quadraticCurveTo(sx * 5, -14, sx * 7, -14); c.stroke(); c.fillStyle = ink; circ(c, sx * 7, -14, 1.1); c.fill(); }
      break;
    }
    case 'kite': {
      c.strokeStyle = '#7a4a3a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-5, 16, 5, 19, 0, 24); c.stroke();
      for (const [bx, by, col] of [[-1.5, 16, '#ff7eb3'], [1.5, 20, '#7fd0ff']] as [number, number, string][]) { c.fillStyle = col; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 3, by - 2); c.lineTo(bx - 3, by + 2); c.closePath(); c.fill(); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 3, by - 2); c.lineTo(bx + 3, by + 2); c.closePath(); c.fill(); }
      const q: [number, number, number, number, string][] = [[0, -13, -10, 0, '#ff6b5a'], [0, -13, 10, 0, '#ffd34d'], [-10, 0, 0, 12, '#ffd34d'], [10, 0, 0, 12, '#ff6b5a']];
      for (const [x1, y1, x2, y2, col] of q) { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.closePath(); c.fill(); }
      c.strokeStyle = ink; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -13); c.lineTo(10, 0); c.lineTo(0, 12); c.lineTo(-10, 0); c.closePath(); c.stroke();
      c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -13); c.lineTo(0, 12); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke();
      face(c, 0, -1, 6, { calm });
      break;
    }
    case 'beetle': {
      c.strokeStyle = '#6a6a6a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(3, -12, 1, -15); c.stroke();
      c.fillStyle = '#ff5a6e'; c.strokeStyle = '#8a1a2a'; c.lineWidth = 0.9; ell(c, 1, -19, 4.2, 5); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.6)'; ell(c, -0.5, -21, 1.2, 1.8); c.fill();
      c.strokeStyle = ink; c.lineWidth = 1; for (const sy of [-1, 3, 7]) for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 8, sy); c.lineTo(sx * 13, sy + 2); c.stroke(); }
      const g = c.createRadialGradient(-3, -2, 1, 0, 3, 13); g.addColorStop(0, '#9af07a'); g.addColorStop(0.6, '#2fa64a'); g.addColorStop(1, '#156a30');
      c.fillStyle = g; c.lineWidth = 1.4; ell(c, 0, 3, 10, 12); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0, -3); c.lineTo(0, 15); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.55)'; ell(c, -4.5, 0, 2, 4, 0.3); c.fill(); ell(c, 4, 0, 1.4, 3, -0.3); c.fill();
      c.fillStyle = '#1d4a28'; ell(c, 0, -5, 6.5, 4.5); c.fill(); c.stroke();
      face(c, 0, -5, 4.4, { calm, eye: '#ffffff' });
      break;
    }
    case 'sprout': {
      c.fillStyle = '#4fb3ff'; c.strokeStyle = '#1a5a8a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(4, 9); c.quadraticCurveTo(8, 15, 4, 17); c.quadraticCurveTo(0, 15, 4, 9); c.fill(); c.stroke();
      const g = c.createLinearGradient(0, -12, 0, 10); g.addColorStop(0, '#e8e6f2'); g.addColorStop(1, '#8c88a6');
      c.fillStyle = g; c.strokeStyle = '#4a4660'; c.lineWidth = 1.4;
      const puffs: [number, number, number][] = [[-7, 2, 6.5], [0, -3, 8.5], [7, 1, 7], [-2, 5, 6], [4, 5, 6]];
      for (const [x, y, r] of puffs) { circ(c, x, y, r); c.stroke(); } for (const [x, y, r] of puffs) { circ(c, x, y, r); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.5)'; ell(c, -3, -6, 4, 2.4, -0.3); c.fill();
      face(c, 0, 1, 5.5, { calm });
      break;
    }
    case 'moth': {
      const wing = (sx: number, top: boolean) => { const g = c.createRadialGradient(sx * 7, top ? -4 : 6, 1, sx * 7, top ? -4 : 6, 11); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b9c2dc'); c.fillStyle = g; c.strokeStyle = '#5d6488'; c.lineWidth = 1.1; ell(c, sx * 8, top ? -3 : 7, top ? 9 : 6, top ? 7 : 5, sx * (top ? -0.5 : 0.4)); c.fill(); c.stroke(); c.fillStyle = 'rgba(160, 140, 220, 0.6)'; circ(c, sx * 9, top ? -3 : 7, top ? 2.4 : 1.6); c.fill(); };
      for (const sx of [-1, 1]) { wing(sx, false); wing(sx, true); }
      c.fillStyle = '#efe8ff'; c.strokeStyle = '#5d6488'; c.lineWidth = 1.3; ell(c, 0, 2, 4.5, 9); c.fill(); c.stroke();
      c.strokeStyle = '#d9d2f0'; c.lineWidth = 1.6; c.lineCap = 'round'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 1.5, -6); c.quadraticCurveTo(sx * 5, -14, sx * 9, -13); c.stroke(); }
      face(c, 0, -2, 4, { calm, sleepy: !calm });
      break;
    }
    case 'wisp': {
      const g = c.createRadialGradient(0, 2, 1, 0, 0, 14); g.addColorStop(0, '#f2d8ff'); g.addColorStop(0.5, '#a65cff'); g.addColorStop(1, '#4b1aa0');
      c.fillStyle = g; c.strokeStyle = '#2e0f66'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-12, 10, -12, -4, -3, -8); c.bezierCurveTo(-6, -12, -2, -15, 2, -16); c.bezierCurveTo(0, -11, 6, -10, 9, -4); c.bezierCurveTo(13, 4, 8, 11, 0, 12); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.arc(1, 2, 5, 0.5, 4); c.stroke();
      face(c, 0, 1, 5, { calm, eye: '#2a0a4a', glow: 'rgba(255, 240, 160, 0.9)' });
      break;
    }
  }
  c.restore();
}

/** A boss in a box `s` units across, centred on (0, 0). */
export function paintBoss(c: CanvasRenderingContext2D, id: BossId, s: number, calm = false) {
  const def = BOSSES[id];
  if (def.mid) { c.save(); paintCritter(c, def.art as CritterKind, s * 0.95, calm); c.scale(s / 60, s / 60); c.fillStyle = '#ffd34d'; c.strokeStyle = '#8a5a00'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-9, -21); c.lineTo(-9, -29); c.lineTo(-4.5, -24); c.lineTo(0, -31); c.lineTo(4.5, -24); c.lineTo(9, -29); c.lineTo(9, -21); c.closePath(); c.fill(); c.stroke(); c.restore(); return; }
  const u = s / 100; c.save(); c.scale(u, u); c.lineJoin = 'round'; c.lineCap = 'round';
  const ink = '#24161a';
  switch (id) {
    case 'magpie': {
      c.fillStyle = '#16141c'; c.strokeStyle = ink; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-6, 22); c.lineTo(-10, 46); c.lineTo(0, 42); c.lineTo(10, 46); c.lineTo(6, 22); c.closePath(); c.fill();
      for (const sx of [-1, 1]) {
        const g = c.createLinearGradient(0, 0, sx * 48, 0); g.addColorStop(0, '#1a1824'); g.addColorStop(0.6, '#1f3a5a'); g.addColorStop(1, '#2c6a7a');
        c.fillStyle = g; c.beginPath(); c.moveTo(sx * 8, -6); c.quadraticCurveTo(sx * 30, -26, sx * 48, -14); c.lineTo(sx * 44, -6); c.lineTo(sx * 48, 0); c.lineTo(sx * 42, 4); c.lineTo(sx * 44, 10); c.quadraticCurveTo(sx * 24, 10, sx * 8, 14); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#ffffff'; ell(c, sx * 22, -4, 9, 4, sx * -0.2); c.fill();
      }
      c.fillStyle = '#16141c'; ell(c, 0, 6, 15, 20); c.fill(); c.stroke();
      c.fillStyle = '#ffffff'; ell(c, 0, 12, 10, 12); c.fill();
      c.strokeStyle = '#c9302c'; c.lineWidth = 4; c.beginPath(); c.moveTo(-12, -2); c.lineTo(12, 22); c.stroke();
      for (let i = 0; i < 4; i++) { const t = 0.15 + i * 0.22, x = -12 + 24 * t, y = -2 + 24 * t; c.fillStyle = ['#ffd34d', '#e8eef8', '#ffb0c8', '#9fe0ff'][i]; c.strokeStyle = '#6a4a10'; c.lineWidth = 0.8; circ(c, x, y, 2.6); c.fill(); c.stroke(); c.fillStyle = 'rgba(0,0,0,0.35)'; circ(c, x - 0.6, y, 0.4); c.fill(); circ(c, x + 0.6, y, 0.4); c.fill(); }
      c.fillStyle = '#16141c'; c.strokeStyle = ink; c.lineWidth = 2; circ(c, 0, -18, 12); c.fill(); c.stroke();
      c.fillStyle = '#3a3a44'; c.beginPath(); c.moveTo(-4, -12); c.lineTo(0, -2); c.lineTo(4, -12); c.closePath(); c.fill(); c.stroke();
      face(c, 0, -20, 9, { calm, eye: '#ffffff' });
      break;
    }
    case 'crow': {
      c.strokeStyle = ink; c.lineWidth = 2;
      for (const sx of [-1, 1]) { c.fillStyle = '#26222e'; c.beginPath(); c.moveTo(sx * 10, -4); c.quadraticCurveTo(sx * 36, -18, sx * 44, 2); c.lineTo(sx * 36, 4); c.lineTo(sx * 40, 12); c.lineTo(sx * 30, 12); c.quadraticCurveTo(sx * 20, 16, sx * 10, 14); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = '#2c2834'; ell(c, 0, 8, 17, 22); c.fill(); c.stroke();
      c.strokeStyle = '#4a4458'; c.lineWidth = 1.2; for (const [x, y] of [[-8, 8], [6, 14], [-3, 20], [9, 2]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + 4); c.stroke(); }
      // the sack of crabapples
      c.fillStyle = '#b98a52'; c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(10, 14); c.quadraticCurveTo(30, 12, 28, 32); c.quadraticCurveTo(18, 38, 10, 30); c.closePath(); c.fill(); c.stroke();
      for (const [x, y] of [[15, 12], [21, 13], [18, 9]]) { c.fillStyle = '#e8402a'; c.strokeStyle = '#6a1206'; c.lineWidth = 1; circ(c, x, y, 3.2); c.fill(); c.stroke(); }
      c.fillStyle = '#2c2834'; c.strokeStyle = ink; c.lineWidth = 2; circ(c, 0, -16, 12); c.fill(); c.stroke();
      c.fillStyle = '#e0a83a'; c.beginPath(); c.moveTo(-4, -11); c.lineTo(0, 0); c.lineTo(4, -11); c.closePath(); c.fill(); c.stroke();
      face(c, 0, -17, 8, { calm, eye: '#ffffff' });
      // the straw hat
      c.fillStyle = '#f2cf6a'; c.strokeStyle = '#8a6420'; c.lineWidth = 1.8; ell(c, 0, -26, 20, 5); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-10, -26); c.quadraticCurveTo(-9, -40, 0, -40); c.quadraticCurveTo(9, -40, 10, -26); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#c9302c'; c.fillRect(-10, -30, 20, 3.4);
      c.strokeStyle = 'rgba(138, 100, 32, 0.55)'; c.lineWidth = 0.8; for (let i = -16; i <= 16; i += 4) { c.beginPath(); c.moveTo(i, -28); c.lineTo(i * 1.15, -23); c.stroke(); }
      break;
    }
    case 'cloud': {
      const g = c.createLinearGradient(0, -36, 0, 30); g.addColorStop(0, '#e4e2ee'); g.addColorStop(1, '#7c7896');
      c.fillStyle = g; c.strokeStyle = '#3e3a56'; c.lineWidth = 2.4;
      const puffs: [number, number, number][] = [[-28, 6, 18], [-12, -10, 22], [10, -14, 24], [28, 2, 19], [-2, 12, 20], [16, 14, 16], [-20, 18, 14]];
      for (const [x, y, r] of puffs) { circ(c, x, y, r); c.stroke(); } for (const [x, y, r] of puffs) { circ(c, x, y, r); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.45)'; ell(c, -10, -20, 12, 6, -0.3); c.fill(); ell(c, 14, -24, 8, 4, 0.2); c.fill();
      c.fillStyle = calm ? 'rgba(255, 150, 170, 0.5)' : 'rgba(255, 140, 160, 0.75)'; circ(c, -18, 6, calm ? 5 : 8); c.fill(); circ(c, 18, 6, calm ? 5 : 8); c.fill();
      face(c, 0, 0, 14, { calm });
      break;
    }
    case 'owl': {
      c.strokeStyle = ink; c.lineWidth = 2;
      for (const sx of [-1, 1]) { const g = c.createLinearGradient(0, 0, sx * 46, 0); g.addColorStop(0, '#8a8698'); g.addColorStop(1, '#bdb8c8'); c.fillStyle = g; c.beginPath(); c.moveTo(sx * 12, -8); c.quadraticCurveTo(sx * 42, -20, sx * 46, 6); c.lineTo(sx * 40, 8); c.lineTo(sx * 42, 16); c.lineTo(sx * 32, 16); c.quadraticCurveTo(sx * 22, 22, sx * 12, 18); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(70, 64, 86, 0.5)'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(sx * (18 + i * 6), 2); c.lineTo(sx * (20 + i * 6), 12); c.stroke(); } c.strokeStyle = ink; c.lineWidth = 2; }
      c.fillStyle = '#a7a2b4'; ell(c, 0, 8, 18, 22); c.fill(); c.stroke();
      c.fillStyle = '#e6e0ea'; ell(c, 0, 12, 11, 14); c.fill();
      c.strokeStyle = 'rgba(120, 110, 130, 0.6)'; c.lineWidth = 1; for (let r = 0; r < 3; r++) for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * 5, 6 + r * 6, 2, 0.3, Math.PI - 0.3); c.stroke(); }
      // the starry shawl
      c.fillStyle = '#26305e'; c.strokeStyle = '#121838'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-20, -6); c.quadraticCurveTo(0, 10, 20, -6); c.lineTo(16, 6); c.quadraticCurveTo(0, 20, -16, 6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffe48a'; for (const [x, y] of [[-12, 2], [-4, 9], [6, 8], [13, 1], [0, 3]]) { star(c, x, y, 5, 2.2, 0.9); c.fill(); }
      c.fillStyle = '#9a96aa'; c.strokeStyle = ink; c.lineWidth = 2; ell(c, 0, -18, 17, 14); c.fill(); c.stroke();
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 8, -29); c.lineTo(sx * 15, -40); c.lineTo(sx * 16, -26); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = '#e8e2ee'; for (const sx of [-1, 1]) { circ(c, sx * 7, -18, 7); c.fill(); }
      const eye = c.createRadialGradient(0, 0, 0.5, 0, 0, 5);
      for (const sx of [-1, 1]) {
        c.save(); c.translate(sx * 7, -18);
        if (calm) { c.strokeStyle = '#2a1a10'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 3, 0.2, Math.PI - 0.2); c.stroke(); }
        else { eye.addColorStop(0, '#fff6c0'); eye.addColorStop(0.6, '#ffc21a'); eye.addColorStop(1, '#a86a00'); c.fillStyle = eye; circ(c, 0, 0, 4.6); c.fill(); c.fillStyle = '#1a1010'; circ(c, 0, 0, 2); c.fill(); c.fillStyle = '#fff'; circ(c, 0.8, -1, 0.8); c.fill(); }
        c.restore();
      }
      c.fillStyle = '#e8b04a'; c.strokeStyle = '#6a4a10'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2.5, -14); c.lineTo(0, -9); c.lineTo(2.5, -14); c.closePath(); c.fill(); c.stroke();
      if (!calm) { c.strokeStyle = '#3a3448'; c.lineWidth = 2; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 13, -27); c.lineTo(sx * 3, -24); c.stroke(); } }
      break;
    }
    case 'storm': {
      if (calm) {
        c.fillStyle = '#ffffff'; c.strokeStyle = '#8aa0c8'; c.lineWidth = 2;
        const puffs: [number, number, number][] = [[-14, 4, 12], [0, -6, 15], [14, 3, 12], [0, 8, 12]];
        for (const [x, y, r] of puffs) { circ(c, x, y, r); c.stroke(); } for (const [x, y, r] of puffs) { circ(c, x, y, r); c.fill(); }
        face(c, 0, 1, 9, { calm: true });
        break;
      }
      const g = c.createRadialGradient(0, -4, 4, 0, 0, 52); g.addColorStop(0, '#b78aff'); g.addColorStop(0.55, '#5a3a9a'); g.addColorStop(1, '#2a1650');
      c.fillStyle = g; c.strokeStyle = '#180a30'; c.lineWidth = 2.6;
      const puffs: [number, number, number][] = [[-34, 4, 20], [-18, -16, 24], [6, -22, 26], [30, -8, 22], [36, 12, 17], [-4, 14, 26], [-26, 22, 16], [20, 22, 18]];
      for (const [x, y, r] of puffs) { circ(c, x, y, r); c.stroke(); } for (const [x, y, r] of puffs) { circ(c, x, y, r); c.fill(); }
      c.strokeStyle = 'rgba(220, 190, 255, 0.45)'; c.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 2, 14 + i * 10, i * 1.7, i * 1.7 + 2.6); c.stroke(); }
      c.fillStyle = 'rgba(255, 220, 120, 0.9)'; c.strokeStyle = '#7a4a00'; c.lineWidth = 1;
      for (const [x, y, sx] of [[-40, 26, 1], [38, 28, -1]] as [number, number, number][]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * 6, y + 8); c.lineTo(x + sx * 2, y + 9); c.lineTo(x + sx * 7, y + 18); c.lineTo(x - sx * 1, y + 8); c.lineTo(x + sx * 3, y + 7); c.closePath(); c.fill(); c.stroke(); }
      face(c, 0, 0, 17, { eye: '#1a0a2a', glow: 'rgba(255, 230, 140, 0.85)' });
      break;
    }
    default: break;
  }
  c.restore();
}

/** A dandelion seed's fluff: a dome of fine filaments with tufts, lit softly from above. `wave` makes it shimmer. */
function pappus(c: CanvasRenderingContext2D, x: number, y: number, r: number, wave: number) {
  const g = c.createRadialGradient(x, y - r * 0.2, 1, x, y, r * 1.3); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; ell(c, x, y - r * 0.25, r * 1.3, r * 0.95); c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.92)'; c.lineWidth = 0.45; c.beginPath();
  const n = 19;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + 0.12 + ((Math.PI - 0.24) * i) / (n - 1), w = Math.sin(wave + i * 1.7) * 0.05;
    c.moveTo(x, y + r * 0.35); c.lineTo(x + Math.cos(a + w) * r, y + Math.sin(a + w) * r * 0.75);
  }
  c.stroke();
  c.fillStyle = 'rgba(255, 255, 255, 0.95)';
  for (let i = 0; i < n; i++) { const a = Math.PI + 0.12 + ((Math.PI - 0.24) * i) / (n - 1), w = Math.sin(wave + i * 1.7) * 0.05; circ(c, x + Math.cos(a + w) * r, y + Math.sin(a + w) * r * 0.75, r * 0.09); c.fill(); }
  c.strokeStyle = 'rgba(160, 170, 190, 0.6)'; c.lineWidth = 0.4; c.beginPath(); c.arc(x, y + r * 0.35, r * 0.18, 0, TAU); c.stroke();
}
/** Dora or Enzo on a dandelion seed, chest at (0, 0), flying up. */
export function paintGlider(c: CanvasRenderingContext2D, pilot: Pilot, time: number, wave: number, faceDir: 1 | -1 = 1, blink = false) {
  c.save(); c.scale(faceDir, 1);
  pappus(c, 3, -24, 17, wave);
  c.strokeStyle = '#a89a7a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(3, -15.5); c.quadraticCurveTo(5, -6, 7, 1); c.stroke();
  c.fillStyle = '#8a6a44'; ell(c, 7.3, 3, 1.3, 2.6, -0.2); c.fill();
  drawChinchilla(c, pilot, -3, 8.5, { face: 1, h: 20, time, air: true, blink });
  c.restore();
}
/** The title painting's stand-in: golden clouds, both gliders soaring up, and the Grumble Storm far above. */
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), w = cv.width, h = cv.height;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a3f8a'); g.addColorStop(0.35, '#c98ab8'); g.addColorStop(0.7, '#ffd39a'); g.addColorStop(1, '#ffeec8');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  seedR = 99;
  for (let i = 0; i < 26; i++) { const x = rand() * w, y = h * (0.35 + rand() * 0.7), r = (30 + rand() * 90) * (w / 1200); const cg = c.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(255, 246, 225, 0.85)'); cg.addColorStop(1, 'rgba(255, 236, 200, 0)'); c.fillStyle = cg; circ(c, x, y, r); c.fill(); }
  c.save(); c.translate(w * 0.7, h * 0.3); paintBoss(c, 'storm', w * 0.15); c.restore();
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255, 255, 240, ${0.4 + rand() * 0.5})`; const x = w * (0.42 + i * 0.006 + rand() * 0.04), y = h * (0.78 - i * 0.008 - rand() * 0.06); star(c, x, y, 4, 3 + rand() * 4, 1); c.fill(); }
  for (const [p, x, y, s] of [['dora', 0.47, 0.37, 3], ['enzo', 0.6, 0.5, 2.8]] as [Pilot, number, number, number][]) { c.save(); c.translate(w * x, h * y); c.scale(s * w / 1200, s * w / 1200); c.rotate(-0.15); paintGlider(c, p, t, t * 3); c.restore(); }
}
/** The ending's stand-in: a rainbow, the calmed storm and the gliders. */
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), w = cv.width, h = cv.height;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fd6ff'); g.addColorStop(0.7, '#d8f3ff'); g.addColorStop(0.7, '#9fd27a'); g.addColorStop(1, '#6fae55');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.lineWidth = w * 0.022; ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = 0.7; c.beginPath(); c.arc(w / 2, h * 0.92, w * (0.46 - i * 0.022), Math.PI, TAU); c.stroke(); });
  c.globalAlpha = 1;
  c.save(); c.translate(w * 0.5, h * 0.3); paintBoss(c, 'storm', w * 0.12, true); c.restore();
  for (const [p, x, s] of [['dora', 0.36, 2.8], ['enzo', 0.64, 2.8]] as [Pilot, number, number][]) { c.save(); c.translate(w * x, h * 0.36); c.scale(s * w / 1200, s * w / 1200); paintGlider(c, p, t, t * 3, x > 0.5 ? -1 : 1); c.restore(); }
  (['magpie', 'crow', 'cloud', 'owl'] as BossId[]).forEach((id, i) => { c.save(); c.translate(w * [0.1, 0.24, 0.76, 0.9][i], h * (0.8 + (i % 2) * 0.06)); paintBoss(c, id, w * 0.09, true); c.restore(); });
}
/** A chat portrait's stand-in. */
export function paintPortrait(cv: HTMLCanvasElement, who: Pilot | BossId, t = 0.4) {
  const c = ctx2(cv), w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  c.save(); c.translate(w / 2, h * 0.55);
  if (who === 'dora' || who === 'enzo') { c.scale(w / 34, w / 34); drawChinchilla(c, who, -2, 12, { face: 1, h: 26, time: t }); }
  else paintBoss(c, who, w * 0.92);
  c.restore();
}

// ---------------------------------------------------------------- the scene
type Words = { x: number; y: number; text: string; color: string; t: number; size: number };
export type DrawOpts = { dt: number; shake: boolean; paused: boolean; hi: number };
const PCAP = 900;
/** Particle kinds: soft fluff, a tumbling petal, an additive spark, an expanding ring. */
const PK = { fluff: 0, petal: 1, spark: 2, ring: 3 } as const;

export class SeedstormScene {
  private c: CanvasRenderingContext2D;
  private dpr = 1; private w = 0; private h = 0;
  /** The field's scale (CSS px per unit) and its top-left corner in CSS px. */
  s = 1; ox = 0; oy = 0;
  /** Device pixels per field unit. */
  private k = 1;
  private art = new Map<string, HTMLImageElement>();
  private cache = new Map<string, HTMLCanvasElement>();
  private graded: { n: number; img: HTMLImageElement; cv: HTMLCanvasElement } | null = null;
  private skyStage = 0; private skyCanvas: HTMLCanvasElement | null = null; private clouds: HTMLCanvasElement[] = []; private tiny = mk(24, 43); private tinyAt = -1;
  private vignette: HTMLCanvasElement | null = null;
  private scroll = 0; private time = 0;
  // particles in flat arrays: nothing is allocated per frame
  private px = new Float32Array(PCAP); private py = new Float32Array(PCAP); private pvx = new Float32Array(PCAP); private pvy = new Float32Array(PCAP);
  private plife = new Float32Array(PCAP); private pmax = new Float32Array(PCAP); private psize = new Float32Array(PCAP); private prot = new Float32Array(PCAP); private pvr = new Float32Array(PCAP);
  private pkind = new Uint8Array(PCAP); private pcol = new Uint8Array(PCAP); private pnext = 0;
  private words: Words[] = [];
  private shakeAmp = 0; private flash = 0; private flashColor = '255,255,255'; private hurt = 0; private gaspT = 0;
  private breakT = -9; private breakX = 0; private breakY = 0;
  private bloomFlower = -9;
  private trailT = 0;
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    for (const n of ['dora-glider', 'enzo-glider', 'bumble', 'kite', 'beetle', 'sprout', 'moth', 'wisp', 'boss-magpie', 'boss-crow', 'boss-cloud', 'boss-owl', 'boss-storm', 'boss-storm-calm']) this.load(n);
  }
  private load(name: string) {
    if (this.art.has(name)) return;
    const img = new Image(); img.decoding = 'async'; img.src = `/art/seedstorm/${name}.webp`; this.art.set(name, img);
  }
  private img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  /** Starts loading a stage's sky painting; the drawn sky stands in until it arrives. */
  stage(n: number) { this.load('sky-' + n); }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(120, r.width); this.h = Math.max(160, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.s = Math.min(this.w / W, this.h / H); this.ox = (this.w - W * this.s) / 2; this.oy = (this.h - H * this.s) / 2;
    const k = this.s * this.dpr; if (Math.abs(k - this.k) > 1e-3) { this.k = k; this.cache.clear(); this.vignette = null; this.skyCanvas = null; this.clouds = []; }
  }
  /** A point on the page (CSS px from the canvas's top-left) in field units. */
  toField(x: number, y: number) { return { x: (x - this.ox) / this.s, y: (y - this.oy) / this.s }; }
  /** The free space beside or below the field, so the page can put touch buttons there. */
  gutters() { return { side: this.ox, bottom: this.h - (this.oy + H * this.s) }; }

  // ---------------------------------------------------------------- cached sprites
  /** A sprite `size` field units square, painted once at this screen scale. */
  private sprite(key: string, size: number, paint: (c: CanvasRenderingContext2D) => void) {
    let cv = this.cache.get(key);
    if (!cv) { const px = Math.ceil(size * this.k) + 2; cv = mk(px, px); const c = ctx2(cv); c.translate(px / 2, px / 2); c.scale(this.k, this.k); paint(c); this.cache.set(key, cv); }
    return cv;
  }
  /** A white silhouette of a sprite, for hit flashes. */
  private whiteOf(key: string, src: CanvasImageSource, w: number, h: number) {
    let cv = this.cache.get(key);
    if (!cv) { cv = mk(w, h); const c = ctx2(cv); c.drawImage(src, 0, 0, w, h); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); this.cache.set(key, cv); }
    return cv;
  }
  private bulletCore(look: number, hue: number) {
    const r = LOOK_R[look], [core, mid, rim] = HUES[hue];
    return this.sprite(`b${look}-${hue}`, r * 4 + 3, (c) => {
      c.lineJoin = 'round';
      switch (look) {
        case 0: { // petal, pointing along +x
          const g = c.createRadialGradient(-r * 0.3, 0, 0.2, 0, 0, r * 1.6); g.addColorStop(0, core); g.addColorStop(0.55, core); g.addColorStop(1, mid);
          c.fillStyle = g; c.strokeStyle = rim; c.lineWidth = 0.9;
          c.beginPath(); c.moveTo(r * 1.65, 0); c.bezierCurveTo(r * 0.8, -r * 1.1, -r * 1.3, -r * 0.95, -r * 1.45, 0); c.bezierCurveTo(-r * 1.3, r * 0.95, r * 0.8, r * 1.1, r * 1.65, 0); c.closePath(); c.fill(); c.stroke();
          c.strokeStyle = mid; c.globalAlpha = 0.7; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r * 1.1, 0); c.stroke(); break;
        }
        case 1: { // seed, button or hail
          const g = c.createRadialGradient(-r * 0.35, -r * 0.35, 0.2, 0, 0, r * 1.1); g.addColorStop(0, core); g.addColorStop(0.5, core); g.addColorStop(1, mid);
          c.fillStyle = g; c.strokeStyle = rim; c.lineWidth = 0.9; circ(c, 0, 0, r); c.fill(); c.stroke();
          c.fillStyle = '#ffffff'; circ(c, -r * 0.35, -r * 0.38, r * 0.28); c.fill(); break;
        }
        case 2: { // raindrop: round head at +x, tail behind
          const g = c.createLinearGradient(-r * 2, 0, r, 0); g.addColorStop(0, mid); g.addColorStop(1, core);
          c.fillStyle = g; c.strokeStyle = rim; c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(-r * 2.3, 0); c.quadraticCurveTo(-r * 0.4, -r * 1.05, r * 0.2, -r * 0.95); c.arc(r * 0.2, 0, r * 0.95, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(-r * 0.4, r * 1.05, -r * 2.3, 0); c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#ffffff'; ell(c, r * 0.3, -r * 0.35, r * 0.35, r * 0.2); c.fill(); break;
        }
        case 3: { // spark
          c.fillStyle = mid; c.strokeStyle = rim; c.lineWidth = 0.7; star(c, 0, 0, 4, r * 1.6, r * 0.55, 0); c.fill(); c.stroke();
          c.fillStyle = core; circ(c, 0, 0, r * 0.6); c.fill(); break;
        }
        case 4: { // crabapple
          const g = c.createRadialGradient(-r * 0.35, -r * 0.3, 0.3, 0, 0, r * 1.1); g.addColorStop(0, '#ffd2c0'); g.addColorStop(0.35, mid); g.addColorStop(1, rim);
          c.fillStyle = g; c.strokeStyle = '#3a0800'; c.lineWidth = 1; circ(c, 0, 0, r); c.fill(); c.stroke();
          c.strokeStyle = '#5a3a1a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(r * 0.2, -r * 1.4); c.stroke();
          c.fillStyle = '#4caf50'; ell(c, r * 0.55, -r * 1.15, r * 0.45, r * 0.22, -0.5); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.75)'; ell(c, -r * 0.38, -r * 0.4, r * 0.28, r * 0.18, -0.6); c.fill(); break;
        }
        default: { // star
          const g = c.createRadialGradient(0, 0, 0.2, 0, 0, r * 1.5); g.addColorStop(0, core); g.addColorStop(0.5, core); g.addColorStop(1, mid);
          c.fillStyle = g; c.strokeStyle = rim; c.lineWidth = 0.8; star(c, 0, 0, 5, r * 1.45, r * 0.65); c.fill(); c.stroke(); break;
        }
      }
    });
  }
  private bulletGlow(look: number, hue: number) {
    const r = LOOK_R[look], mid = HUES[hue][1];
    return this.sprite(`g${look}-${hue}`, r * 7, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 3.4); g.addColorStop(0, mid + 'aa'); g.addColorStop(0.4, mid + '44'); g.addColorStop(1, mid + '00');
      c.fillStyle = g; circ(c, 0, 0, r * 3.4); c.fill();
    });
  }
  private shotSprite(kind: number) {
    return this.sprite('shot' + kind, 26, (c) => {
      if (kind === 0) { // Dora's petal streak, pointing up
        const g = c.createLinearGradient(0, 10, 0, -6); g.addColorStop(0, 'rgba(255,170,210,0)'); g.addColorStop(1, 'rgba(255,190,225,0.9)');
        c.fillStyle = g; ell(c, 0, 3, 1.8, 8); c.fill();
        c.fillStyle = '#ffe6f2'; c.strokeStyle = '#ff7eb3'; c.lineWidth = 0.6; ell(c, 0, -4, 2.2, 3.6); c.fill(); c.stroke();
      } else if (kind === 1) { // Enzo's pebble with a streak
        const g = c.createLinearGradient(0, 12, 0, -4); g.addColorStop(0, 'rgba(150,200,255,0)'); g.addColorStop(1, 'rgba(170,215,255,0.85)');
        c.fillStyle = g; ell(c, 0, 4, 2, 9); c.fill();
        const p = c.createRadialGradient(-0.8, -5, 0.2, 0, -4, 3.2); p.addColorStop(0, '#f2f6fb'); p.addColorStop(1, '#7c8aa0');
        c.fillStyle = p; c.strokeStyle = '#2c3446'; c.lineWidth = 0.6; ell(c, 0, -4, 2.8, 3.3); c.fill(); c.stroke();
      } else { // the wingmate's homing seed
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 0.4; c.beginPath(); for (let i = 0; i < 7; i++) { const a = Math.PI + 0.3 + i * 0.42; c.moveTo(0, 2); c.lineTo(Math.cos(a) * 5, 2 + Math.sin(a) * 4.5); } c.stroke();
        c.fillStyle = '#ffe9a8'; c.strokeStyle = '#8a5a10'; c.lineWidth = 0.5; ell(c, 0, 4, 1.3, 2.4); c.fill(); c.stroke();
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 7); g.addColorStop(0, 'rgba(255,240,170,0.5)'); g.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = g; circ(c, 0, 0, 7); c.fill();
      }
    });
  }
  private seedSprite(big: boolean) {
    return this.sprite(big ? 'seedB' : 'seedS', big ? 22 : 14, (c) => {
      const s = big ? 1.6 : 1;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 6 * s); g.addColorStop(0, 'rgba(255, 236, 140, 0.6)'); g.addColorStop(1, 'rgba(255, 236, 140, 0)'); c.fillStyle = g; circ(c, 0, 0, 6 * s); c.fill();
      const b = c.createLinearGradient(-2 * s, -3 * s, 2 * s, 3 * s); b.addColorStop(0, '#fff2b0'); b.addColorStop(1, '#d99a2a');
      c.fillStyle = b; c.strokeStyle = '#6a4206'; c.lineWidth = 0.6; ell(c, 0, 0, 2.2 * s, 3.4 * s, 0.4); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(106, 66, 6, 0.6)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-0.6 * s, -2.4 * s); c.lineTo(0.6 * s, 2.4 * s); c.stroke();
      c.fillStyle = '#ffffff'; circ(c, -0.7 * s, -1.4 * s, 0.6 * s); c.fill();
    });
  }
  private particleSprite(kind: number, col: number) {
    return this.sprite(`p${kind}-${col}`, 16, (c) => {
      const [core, mid] = col < HUES.length ? HUES[col] : ['#ffffff', '#ffffff'];
      if (kind === PK.fluff) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 7); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,252,246,0.6)'); g.addColorStop(1, 'rgba(255,250,240,0)'); c.fillStyle = g; circ(c, 0, 0, 7); c.fill(); }
      else if (kind === PK.petal) { c.fillStyle = core; c.strokeStyle = mid; c.lineWidth = 0.7; ell(c, 0, 0, 4.6, 2.3); c.fill(); c.stroke(); }
      else { const g = c.createRadialGradient(0, 0, 0, 0, 0, 7); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, mid); g.addColorStop(1, mid + '00'); c.fillStyle = g; star(c, 0, 0, 4, 7, 1.6, 0); c.fill(); }
    });
  }
  private critterSprite(kind: CritterKind) { const r = CRITTERS[kind].r; return this.sprite('c-' + kind, r * 3.2, (c) => paintCritter(c, kind, r * 2.9)); }
  private bossSprite(id: BossId, calm: boolean) { const r = BOSSES[id].r; return this.sprite(`boss-${id}${calm ? '-calm' : ''}`, r * 3.4, (c) => paintBoss(c, id, r * 3.1, calm)); }

  // ---------------------------------------------------------------- the sky
  private paintSky(n: number) {
    const L = SKY[n - 1], q = Math.min(2, this.k), cv = mk(W * q, 800 * q), c = ctx2(cv);
    c.scale(q, q); seedR = 1000 + n;
    const g = c.createLinearGradient(0, 0, 0, 800); g.addColorStop(0, L.bottom); g.addColorStop(0.5, L.top); g.addColorStop(1, L.bottom);
    c.fillStyle = g; c.fillRect(0, 0, W, 800);
    // draw something at y and, near the seam, again a tile up or down, so the tile wraps without a seam
    const wrap = (y: number, r: number, paint: (yy: number) => void) => { paint(y); if (y - r < 0) paint(y + 800); if (y + r > 800) paint(y - 800); };
    const blob = (x: number, y: number, r: number, col: string) => wrap(y, r, (yy) => { const rg = c.createRadialGradient(x, yy, 0, x, yy, r); rg.addColorStop(0, col); rg.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); c.fillStyle = rg; circ(c, x, yy, r); c.fill(); });
    if (n === 1) {
      for (let i = 0; i < 40; i++) blob(rand() * W, rand() * 800, 30 + rand() * 70, rand() < 0.5 ? 'rgba(120, 190, 90, 0.35)' : 'rgba(200, 235, 150, 0.35)');
      c.strokeStyle = '#8fd0ee'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); for (let y = -10; y <= 810; y += 10) c.lineTo(180 + 95 * Math.sin((y / 800) * TAU * 2) + 20 * Math.sin((y / 800) * TAU * 5), y); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 3; c.stroke();
      c.globalAlpha = 0.55; // scenery stays soft so bullets read over it
      for (let i = 0; i < 26; i++) { const x = rand() * W, y = rand() * 800; wrap(y, 14, (yy) => { c.fillStyle = 'rgba(40, 90, 40, 0.3)'; circ(c, x + 3, yy + 4, 11); c.fill(); c.fillStyle = '#4f9a48'; circ(c, x, yy, 11); c.fill(); c.fillStyle = 'rgba(160, 220, 120, 0.6)'; circ(c, x - 3, yy - 3, 5); c.fill(); }); }
      c.globalAlpha = 1;
      for (let i = 0; i < 260; i++) { const x = rand() * W, y = rand() * 800; c.fillStyle = rand() < 0.6 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 220, 80, 0.85)'; wrap(y, 2, (yy) => { circ(c, x, yy, 1 + rand() * 1.2); c.fill(); }); }
    } else if (n === 2) {
      for (let i = 0; i < 30; i++) blob(rand() * W, rand() * 800, 40 + rand() * 60, 'rgba(170, 210, 120, 0.35)');
      c.strokeStyle = 'rgba(210, 180, 130, 0.7)'; c.lineWidth = 10; for (const x of [60, 300]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 800); c.stroke(); }
      c.globalAlpha = 0.42; // the orchard stays soft so bullets read over it
      for (let row = 0; row < 16; row++) for (let col = 0; col < 5; col++) {
        const x = 30 + col * 75 + (row % 2) * 37, y = row * 50 + 20;
        if (row === 5 && (col === 2 || col === 3)) continue;
        wrap(y, 20, (yy) => { c.fillStyle = 'rgba(50, 80, 40, 0.3)'; circ(c, x + 4, yy + 5, 15); c.fill(); c.fillStyle = '#5ea24e'; circ(c, x, yy, 15); c.fill(); for (let k = 0; k < 7; k++) { c.fillStyle = k % 2 ? '#ffd0e0' : '#ffffff'; circ(c, x + Math.cos(k * 2.4) * 9, yy + Math.sin(k * 2.4) * 8, 2.4); c.fill(); } });
      }
      // a gingham picnic blanket with a pie in the gap between the trees
      c.save(); c.translate(195, 290); c.rotate(-0.12); c.fillStyle = 'rgba(60, 40, 30, 0.18)'; c.fillRect(-40, -22, 84, 50);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#f6f0ea' : '#e46a6a'; c.fillRect(-42 + i * 14, -26 + j * 12, 14, 12); }
      c.fillStyle = 'rgba(255, 255, 255, 0.35)'; for (let i = 0; i < 6; i += 2) c.fillRect(-42 + i * 14, -26, 14, 48);
      c.fillStyle = '#c98a4a'; circ(c, 6, -2, 11); c.fill(); c.fillStyle = '#e8b878'; circ(c, 6, -3, 9); c.fill(); c.strokeStyle = '#b06a34'; c.lineWidth = 1.2; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(6 + k * 4, -10); c.lineTo(6 + k * 4, 4); c.stroke(); }
      c.restore(); c.globalAlpha = 1;
      for (let i = 0; i < 120; i++) { const x = rand() * W, y = rand() * 800; c.fillStyle = 'rgba(255, 200, 220, 0.8)'; wrap(y, 3, (yy) => { ell(c, x, yy, 2.2, 1.2, rand() * 3); c.fill(); }); }
    } else if (n === 3) {
      for (let i = 0; i < 34; i++) blob(rand() * W, rand() * 800, 50 + rand() * 90, rand() < 0.5 ? 'rgba(230, 226, 245, 0.45)' : 'rgba(90, 84, 120, 0.4)');
      for (let i = 0; i < 6; i++) blob(rand() * W, rand() * 800, 40 + rand() * 30, 'rgba(255, 240, 180, 0.35)');
    } else if (n === 4) {
      for (let i = 0; i < 220; i++) { const x = rand() * W, y = rand() * 800; c.fillStyle = `rgba(255, 255, 255, ${0.3 + rand() * 0.6})`; wrap(y, 2, (yy) => { circ(c, x, yy, 0.5 + rand()); c.fill(); }); }
      blob(250, 220, 120, 'rgba(255, 250, 220, 0.4)'); wrap(220, 30, (yy) => { c.fillStyle = '#f8f4e0'; circ(c, 250, yy, 26); c.fill(); c.fillStyle = 'rgba(200, 200, 180, 0.4)'; circ(c, 242, yy - 6, 5); c.fill(); circ(c, 258, yy + 8, 4); c.fill(); });
      for (let i = 0; i < 90; i++) { const x = rand() * W, y = rand() * 800, s = 10 + rand() * 12; wrap(y, s * 2, (yy) => { c.fillStyle = '#1a3a3a'; c.beginPath(); c.moveTo(x, yy - s * 1.6); c.lineTo(x + s * 0.8, yy + s * 0.6); c.lineTo(x - s * 0.8, yy + s * 0.6); c.closePath(); c.fill(); c.fillStyle = 'rgba(120, 180, 190, 0.25)'; c.beginPath(); c.moveTo(x, yy - s * 1.6); c.lineTo(x - s * 0.8, yy + s * 0.6); c.lineTo(x - s * 0.2, yy + s * 0.6); c.closePath(); c.fill(); }); }
      for (let i = 0; i < 16; i++) blob(rand() * W, rand() * 800, 60 + rand() * 60, 'rgba(200, 215, 240, 0.25)');
    } else {
      blob(180, 400, 230, 'rgba(255, 210, 120, 0.35)');
      c.lineCap = 'round';
      for (let i = 0; i < 28; i++) { const r = 30 + rand() * 330, a = rand() * TAU, y = 400; c.strokeStyle = rand() < 0.5 ? 'rgba(170, 130, 230, 0.35)' : 'rgba(40, 20, 80, 0.4)'; c.lineWidth = 8 + rand() * 18; wrap(y, r + 20, (yy) => { c.beginPath(); c.arc(180, yy, r, a, a + 1 + rand() * 1.5); c.stroke(); }); }
      for (let i = 0; i < 20; i++) blob(rand() * W, rand() * 800, 40 + rand() * 70, 'rgba(120, 80, 180, 0.35)');
    }
    // keep it muted, so bullets always stand out
    c.fillStyle = L.night ? 'rgba(10, 12, 30, 0.18)' : 'rgba(255, 255, 255, 0.12)'; c.fillRect(0, 0, W, 800);
    return cv;
  }
  private paintClouds(n: number, layer: number) {
    const L = SKY[n - 1], q = Math.min(1, this.k), cv = mk(W * q, 800 * q), c = ctx2(cv); c.scale(q, q);
    seedR = 77 + layer * 13 + n;
    const count = layer ? 7 : 11;
    for (let i = 0; i < count; i++) {
      const x = rand() * W, y = rand() * 800, s = (layer ? 1.4 : 0.9) * (30 + rand() * 40);
      // the same puffs at y and a tile up and down, so the layer wraps without a seam
      const puffs: [number, number, number][] = []; for (let k = 0; k < 6; k++) puffs.push([x + (rand() - 0.5) * s * 1.6, y + (rand() - 0.5) * s * 0.6, s * (0.4 + rand() * 0.5)]);
      for (const dy of [0, -800, 800]) for (const [bx, py, br] of puffs) {
        const by = py + dy;
        const g = c.createRadialGradient(bx, by, 0, bx, by, br); g.addColorStop(0, L.cloud); g.addColorStop(0.6, L.cloud + 'aa'); g.addColorStop(1, L.cloud + '00');
        c.fillStyle = g; circ(c, bx, by, br); c.fill();
      }
    }
    return cv;
  }
  /**
   * The painted skies are bright and busy, so under play they are baked once into a quieter copy: partly
   * desaturated, then washed toward a deep stage colour (strongest on the busy daytime stages 1 and 2), so every
   * bullet, with its pale core and dark rim, reads instantly over them.
   */
  private gradeSky(n: number, img: HTMLImageElement) {
    if (this.graded && this.graded.n === n && this.graded.img === img) return this.graded.cv;
    const G = GRADE[n - 1], w = Math.min(img.naturalWidth, 720), h = Math.round((w * img.naturalHeight) / img.naturalWidth);
    const cv = mk(w, h), q = ctx2(cv);
    q.drawImage(img, 0, 0, w, h);
    q.globalCompositeOperation = 'saturation'; q.fillStyle = `rgba(128, 128, 128, ${G.desat})`; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'source-over'; q.fillStyle = G.wash; q.fillRect(0, 0, w, h);
    this.graded = { n, img, cv }; return cv;
  }
  private drawSky(g: SeedstormGame | null, n: number) {
    const c = this.c, s = this.s, L = SKY[n - 1];
    if (this.skyStage !== n || !this.skyCanvas) { this.skyStage = n; this.skyCanvas = this.paintSky(n); this.clouds = [this.paintClouds(n, 0), this.paintClouds(n, 1)]; this.tinyAt = -1; }
    const img = this.img('sky-' + n), src: CanvasImageSource = img ? this.gradeSky(n, img) : this.skyCanvas, tileH = 800;
    const off = this.scroll % tileH;
    // sample a row inside each edge, so smoothing never pulls in the transparent border and leaves a hairline
    const sw = (src as HTMLCanvasElement).width, sh = (src as HTMLCanvasElement).height;
    for (let y = off - tileH; y < H; y += tileH) c.drawImage(src, 0, 1, sw, sh - 2, 0, y - 0.5, W, tileH + 1);
    c.fillStyle = L.grade; c.fillRect(0, 0, W, H);
    // the far clouds, slow, then the near ones a little faster, both soft
    for (let i = 0; i < 2; i++) {
      const cv = this.clouds[i], o2 = (this.scroll * (i ? 2.2 : 1.4)) % tileH; c.globalAlpha = L.cloudA * (i ? 0.7 : 1) * (img ? 0.4 : 1); // the paintings have their own clouds
      for (let y = o2 - tileH; y < H; y += tileH) c.drawImage(cv, 0, Math.round(y * this.k) / this.k, W, tileH); // translucent: no overlap, or the seam doubles up
    }
    c.globalAlpha = 1;
    // a tiny copy for the blurred letterbox
    if (this.tinyAt < 0 || this.time - this.tinyAt > 0.25) { this.tinyAt = this.time; const t = ctx2(this.tiny); t.drawImage(src, 0, (off / tileH) * 43 - 43, 24, 43); t.drawImage(src, 0, (off / tileH) * 43, 24, 43); }
    void g; void s;
  }

  // ---------------------------------------------------------------- effects
  private spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    const i = this.pnext; this.pnext = (this.pnext + 1) % PCAP;
    this.pkind[i] = kind; this.px[i] = x; this.py[i] = y; this.pvx[i] = vx; this.pvy[i] = vy; this.plife[i] = life; this.pmax[i] = life; this.psize[i] = size; this.pcol[i] = col;
    this.prot[i] = Math.random() * TAU; this.pvr[i] = (Math.random() - 0.5) * 6;
  }
  private burst(kind: number, x: number, y: number, n: number, speed: number, life: number, size: number, col: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.6); this.spawn(kind, x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), col); }
  }
  private word(x: number, y: number, text: string, color: string, size: number) { this.words.push({ x, y, text, color, size, t: 0 }); if (this.words.length > 24) this.words.shift(); }
  private shake(n: number) { this.shakeAmp = Math.max(this.shakeAmp, n); }
  /** Feeds the game's events in as they happen; returns seconds of slow motion wanted (a boss phase breaking). */
  feed(events: Ev[], g: SeedstormGame): number {
    let slow = 0;
    for (const e of events) {
      switch (e.k) {
        case 'graze': this.spawn(PK.spark, e.x, e.y, 0, 0, 0.25, 0.8, 6); break;
        case 'puff':
          this.burst(PK.fluff, e.x, e.y, 9, 70, 0.7, 1.4, 6); this.burst(PK.spark, e.x, e.y, 4, 90, 0.4, 0.8, 1);
          if (e.points) this.word(e.x, e.y - 6, String(e.points), '#fff7d0', 11);
          break;
        case 'collect': if (Math.random() < 0.35 || e.big) this.spawn(PK.spark, e.x, e.y, 0, -20, 0.3, e.big ? 1.4 : 0.7, 1); if (e.big) this.word(e.x, e.y - 8, '+' + e.n, '#ffe680', 10); break;
        case 'gasp': this.gaspT = 0.3; break;
        case 'hit':
          this.hurt = 1; this.shake(9); this.flash = 0.35; this.flashColor = '255,120,150';
          this.burst(PK.fluff, e.x, e.y, 18, 120, 0.9, 1.6, 6); this.burst(PK.petal, e.x, e.y, 10, 110, 1.1, 1, 0);
          this.word(e.x, e.y - 24, e.hearts > 0 ? 'Oof!' : 'Oh no!', '#ffd0dc', 15); break;
        case 'saved': this.word(e.x, e.y - 30, 'Phew! Saved by a Bloom!', '#ffffff', 13); break;
        case 'bloom': this.bloomFlower = this.time; this.flash = 0.5; this.flashColor = '255,236,248'; this.shake(5); break;
        case 'bloomUp': this.word(g.player.x, g.player.y - 34, '+1 Bloom 🌸', '#ffd6ec', 13); break;
        case 'bossHit': if (Math.random() < 0.3) this.spawn(PK.spark, e.x, e.y, (Math.random() - 0.5) * 60, -40, 0.25, 0.8, 1); break;
        case 'break':
          this.breakT = this.time; this.breakX = e.x; this.breakY = e.y; this.flash = 0.6; this.flashColor = '255,255,255'; this.shake(e.mid ? 6 : 11);
          for (let i = 0; i < 8; i++) this.burst(PK.petal, e.x, e.y, 6, 200, 1.6, 1.4, [0, 1, 3, 4, 6, 7, 2, 0][i]);
          this.burst(PK.fluff, e.x, e.y, 24, 160, 1.4, 2.2, 6); this.spawn(PK.ring, e.x, e.y, 0, 0, 0.8, 1, 6);
          if (e.clearSky) this.word(W / 2, 250, `Clear Sky! +${e.clearSky.toLocaleString()}`, '#bff3ff', 18);
          else if (e.timedOut) this.word(W / 2, 250, 'Time’s up! The attack blew over', '#e8e0ff', 14);
          slow = e.last || e.mid ? 0.9 : 0.6; break;
        case 'calm': for (let i = 0; i < 6; i++) this.spawn(PK.petal, e.x + (Math.random() - 0.5) * 60, e.y, (Math.random() - 0.5) * 30, -30, 2, 1.2, 0); this.word(e.x, e.y - 50, '♥', '#ff9ec4', 26); break;
        case 'midGone': break;
        case 'fade': this.flash = 0.25; this.flashColor = '255,255,255'; break;
        case 'stage': this.stage(e.stage); break;
        case 'clear': for (let i = 0; i < 40; i++) this.spawn(PK.petal, Math.random() * W, -10, (Math.random() - 0.5) * 40, 60 + Math.random() * 80, 4, 1.3, [0, 1, 3, 4, 6][i % 5]); break;
        case 'continue': this.flash = 0.6; this.flashColor = '255,255,255'; this.word(W / 2, H / 2, 'Back in the sky!', '#ffffff', 20); break;
        default: break;
      }
    }
    return slow;
  }

  // ---------------------------------------------------------------- one frame
  draw(g: SeedstormGame | null, stageNo: number, o: DrawOpts) {
    const c = this.c, dt = o.paused ? 0 : o.dt, k = this.k, dpr = this.dpr;
    this.time += dt; if (g && g.phase !== 'over') this.scroll += dt * (g.boss && g.boss.state === 'calm' ? 20 : 38);
    if (!g) this.scroll += o.dt * 30;
    // letterbox: the blurred, darkened sky
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    if (this.ox > 0.5 || this.oy > 0.5) { c.drawImage(this.tiny, -this.canvas.width * 0.05, -this.canvas.height * 0.05, this.canvas.width * 1.1, this.canvas.height * 1.1); c.fillStyle = 'rgba(14, 10, 30, 0.55)'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); }
    // the field, shaken a little
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 30);
    const sh = o.shake && this.shakeAmp > 0 ? this.shakeAmp : 0, sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
    const base = (x = 0, y = 0) => c.setTransform(k, 0, 0, k, (this.ox + x * this.s) * dpr, (this.oy + y * this.s) * dpr);
    base(); c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    base(sx, sy); c.save(); c.translate(0, 0);
    this.drawSky(g, stageNo);
    if (g) this.drawWorld(g, dt);
    this.drawParticles(dt);
    c.restore();
    // vignette and flashes over the field
    if (!this.vignette) { const v = mk(W * 0.5, H * 0.5), q = ctx2(v), r = q.createRadialGradient(W / 4, H / 4, H * 0.18, W / 4, H / 4, H * 0.42); r.addColorStop(0, 'rgba(10,6,24,0)'); r.addColorStop(1, 'rgba(10,6,24,0.38)'); q.fillStyle = r; q.fillRect(0, 0, W, H); this.vignette = v; }
    base(); c.drawImage(this.vignette, 0, 0, W, H);
    if (this.hurt > 0) { this.hurt = Math.max(0, this.hurt - dt * 1.6); c.fillStyle = `rgba(255, 90, 130, ${this.hurt * 0.25})`; c.fillRect(0, 0, W, H); }
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 1.8); c.fillStyle = `rgba(${this.flashColor}, ${this.flash * 0.6})`; c.fillRect(0, 0, W, H); }
    if (g) this.drawHud(g, o);
    c.restore();
    // a thin frame around the field
    if (this.ox > 0.5 || this.oy > 0.5) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.strokeStyle = 'rgba(255, 240, 255, 0.35)'; c.lineWidth = 1.5; c.strokeRect(this.ox - 0.75, this.oy - 0.75, W * this.s + 1.5, H * this.s + 1.5); }
  }

  private drawWorld(g: SeedstormGame, dt: number) {
    const c = this.c, t = this.time;
    // seeds lie under everything that flies
    for (const e of g.seeds) {
      if (!e.on) continue;
      const sp = this.seedSprite(e.big), d = sp.width / this.k;
      c.save(); c.translate(e.x, e.y); c.rotate(Math.sin(t * 3 + e.i) * 0.4); c.drawImage(sp, -d / 2, -d / 2, d, d); c.restore();
    }
    // critters
    for (const cr of g.critters) {
      if (!cr.on) continue;
      const art = this.img(cr.kind), r = cr.r, bob = Math.sin(t * 4 + cr.id) * 1.6, size = r * 3.6;
      c.save(); c.translate(cr.x, cr.y + bob); c.rotate(Math.max(-0.35, Math.min(0.35, cr.vx * 0.12)));
      const flap = cr.kind === 'bumble' || cr.kind === 'moth' ? 1 + Math.sin(t * 30 + cr.id) * 0.04 : 1; c.scale(flap, 2 - flap);
      if (art) { c.drawImage(art, -size / 2, -size / 2, size, size); if (cr.flash > 0) { c.globalAlpha = 0.7; c.drawImage(this.whiteOf('w-' + cr.kind, art, 128, 128), -size / 2, -size / 2, size, size); } }
      else { const sp = this.critterSprite(cr.kind), d = sp.width / this.k; c.drawImage(sp, -d / 2, -d / 2, d, d); if (cr.flash > 0) { c.globalAlpha = 0.7; c.drawImage(this.whiteOf('wc-' + cr.kind, sp, sp.width, sp.height), -d / 2, -d / 2, d, d); } }
      c.restore();
    }
    if (g.boss) this.drawBoss(g.boss, g);
    // shots
    for (const s of g.shots) {
      if (!s.on) continue;
      const sp = this.shotSprite(s.kind), d = sp.width / this.k;
      c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2); c.drawImage(sp, -d / 2, -d / 2, d, d); c.restore();
    }
    // the gliders, with a trail of fluff
    const p = g.player, blinkOut = (p.invuln > 0 && Math.floor(t * 18) % 2 === 0) || g.phase === 'over';
    this.trailT += dt; if (this.trailT > 0.03 && g.phase === 'play') { this.trailT = 0; this.spawn(PK.fluff, p.x + 2 + (Math.random() - 0.5) * 8, p.y + 10, (Math.random() - 0.5) * 10, 50, 0.6, 0.5, 6); this.spawn(PK.fluff, g.wing.x + (Math.random() - 0.5) * 6, g.wing.y + 8, 0, 45, 0.45, 0.35, 6); }
    this.drawGlider(g.wingmate, g.wing.x, g.wing.y, 0.72, p.bank * 0.6, false);
    if (!blinkOut) this.drawGlider(g.pilot, p.x, p.y, 1, p.bank, true);
    // the Bloom: a flower opening at the pilot, and a ring of petals sweeping out
    if (g.bloomT > 0 || this.time - this.bloomFlower < 0.9) this.drawBloom(g);
    // bullets: a soft glow pass, then the cores
    c.globalCompositeOperation = 'lighter';
    for (const b of g.bullets) { if (!b.on) continue; const sp = this.bulletGlow(b.look, b.hue), d = sp.width / this.k; c.drawImage(sp, b.x - d / 2, b.y - d / 2, d, d); }
    c.globalCompositeOperation = 'source-over';
    const k = this.k, dpr = this.dpr, ox = this.ox * dpr, oy = this.oy * dpr, m = c.getTransform();
    for (const b of g.bullets) {
      if (!b.on) continue;
      const sp = this.bulletCore(b.look, b.hue), half = sp.width / 2;
      const a = b.look === 1 ? 0 : b.look === 5 ? b.t * 0.05 : b.look === 4 ? Math.sin(b.t * 0.15) * 0.3 : Math.atan2(b.vy, b.vx);
      const cs = Math.cos(a), sn = Math.sin(a), X = m.e + b.x * k, Y = m.f + b.y * k;
      c.setTransform(cs, sn, -sn, cs, X, Y); c.drawImage(sp, -half, -half);
    }
    c.setTransform(m); void ox; void oy;
    // focus shows the hitbox
    if (p.focus && g.phase === 'play') {
      const pulse = 1 + Math.sin(t * 10) * 0.12;
      c.strokeStyle = 'rgba(255, 255, 255, 0.85)'; c.lineWidth = 0.9; circ(c, p.x, p.y, 9 * pulse); c.stroke();
      c.strokeStyle = 'rgba(255, 120, 180, 0.6)'; c.lineWidth = 0.7; c.beginPath(); c.arc(p.x, p.y, 13, t * 2, t * 2 + 1.2); c.stroke(); c.beginPath(); c.arc(p.x, p.y, 13, t * 2 + Math.PI, t * 2 + Math.PI + 1.2); c.stroke();
      c.fillStyle = '#ff4f8f'; circ(c, p.x, p.y, HITBOX + 0.8); c.fill(); c.fillStyle = '#ffffff'; circ(c, p.x, p.y, HITBOX - 0.6); c.fill();
    }
    if (this.gaspT > 0) { this.gaspT -= dt; c.strokeStyle = `rgba(255, 255, 255, ${this.gaspT * 3})`; c.lineWidth = 2; circ(c, p.x, p.y, 8 + (0.3 - this.gaspT) * 90); c.stroke(); }
  }
  private drawGlider(pilot: Pilot, x: number, y: number, scale: number, bank: number, main: boolean) {
    const c = this.c, art = this.img(pilot + '-glider');
    c.save(); c.translate(x, y); c.rotate(bank * 0.3); c.scale(scale, scale);
    if (art) c.drawImage(art, -30, -40, 60, 60);
    else paintGlider(c, pilot, this.time, this.time * 6 + (main ? 0 : 2), bank < -0.25 ? -1 : 1, Math.floor(this.time * 0.6) % 6 === 0 && this.time % 1.67 < 0.12);
    c.restore();
  }
  private drawBoss(b: Boss, g: SeedstormGame) {
    const c = this.c, t = this.time, id = b.def.id, calm = b.state === 'calm';
    const breathe = 1 + Math.sin(t * 2.2) * 0.025, tilt = Math.max(-0.25, Math.min(0.25, b.vx * 0.05)), r = b.def.r, size = r * 3.4;
    // a soft shadow-glow behind, so the boss reads over any sky
    const halo = this.sprite('halo', 100, (q) => { const rg = q.createRadialGradient(0, 0, 0, 0, 0, 50); rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = rg; circ(q, 0, 0, 50); q.fill(); });
    c.save(); c.translate(b.x, b.y); c.globalAlpha = 0.3; c.drawImage(halo, -size * 0.6, -size * 0.6, size * 1.2, size * 1.2); c.globalAlpha = 1;
    c.rotate(tilt); c.scale(1 / breathe, breathe);
    const artName = id === 'storm' && calm ? 'boss-storm-calm' : b.def.mid ? b.def.art : 'boss-' + (id === 'cloud' ? 'cloud' : id);
    const art = this.img(artName), drawSize = b.def.mid ? r * 3.8 : r * 4.2; // the paintings carry a soft margin
    if (art) { c.drawImage(art, -drawSize / 2, -drawSize / 2, drawSize, drawSize); if (b.flash > 0) { c.globalAlpha = 0.22 * Math.min(1, b.flash / 4); c.drawImage(this.whiteOf('wa-' + artName, art, 256, 256), -drawSize / 2, -drawSize / 2, drawSize, drawSize); } }
    else { const sp = this.bossSprite(id, calm), d = sp.width / this.k; c.drawImage(sp, -d / 2, -d / 2, d, d); if (b.flash > 0) { c.globalAlpha = 0.55; c.drawImage(this.whiteOf(`wb-${id}${calm ? '-calm' : ''}`, sp, sp.width, sp.height), -d / 2, -d / 2, d, d); } }
    c.globalAlpha = 1; c.restore();
    // little sparks around Rumble and the storm, hearts once calm
    if (!calm && (id === 'cloud' || id === 'storm') && Math.random() < 0.25) this.spawn(PK.spark, b.x + (Math.random() - 0.5) * r * 2.4, b.y + (Math.random() - 0.5) * r * 1.6, 0, 0, 0.25, 1, 1);
    if (calm && Math.random() < 0.06) this.word(b.x + (Math.random() - 0.5) * 40, b.y - r, '♥', '#ff9ec4', 14);
    // the phase timer ring under the boss
    if (b.state === 'fight') { c.strokeStyle = 'rgba(255, 255, 255, 0.35)'; c.lineWidth = 1.2; c.beginPath(); c.arc(b.x, b.y, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (b.timer / b.time)); c.stroke(); }
    void g;
  }
  private drawBloom(g: SeedstormGame) {
    const c = this.c, t = this.time - this.bloomFlower, R = (BLOOM.sweep - g.bloomT) * BLOOM.speed;
    if (g.bloomT > 0) {
      const ring = c.createRadialGradient(g.bloomX, g.bloomY, Math.max(0, R - 30), g.bloomX, g.bloomY, R + 6);
      ring.addColorStop(0, 'rgba(255, 210, 235, 0)'); ring.addColorStop(0.75, 'rgba(255, 190, 225, 0.35)'); ring.addColorStop(1, 'rgba(255, 255, 255, 0)');
      c.fillStyle = ring; circ(c, g.bloomX, g.bloomY, R + 6); c.fill();
      const n = 40, petal = this.particleSprite(PK.petal, 0);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R * 0.004, x = g.bloomX + Math.cos(a) * R, y = g.bloomY + Math.sin(a) * R; c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2 + Math.sin(i + t * 8)); c.drawImage(petal, -6, -6, 12, 12); c.restore(); }
    }
    if (t < 0.9) {
      const open = Math.min(1, t * 4), fade = 1 - Math.max(0, (t - 0.5) / 0.4);
      c.save(); c.translate(g.bloomX, g.bloomY); c.globalAlpha = fade; c.rotate(t * 2);
      for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.fillStyle = i % 2 ? '#ffd6ec' : '#ffffff'; c.strokeStyle = '#ff7eb3'; c.lineWidth = 1; ell(c, 0, -16 * open, 7 * open, 16 * open); c.fill(); c.stroke(); }
      c.fillStyle = '#ffd34d'; circ(c, 0, 0, 7 * open); c.fill(); c.restore();
    }
  }
  private drawParticles(dt: number) {
    const c = this.c;
    for (let i = 0; i < PCAP; i++) {
      if (this.plife[i] <= 0) continue;
      this.plife[i] -= dt; if (this.plife[i] <= 0) continue;
      const kind = this.pkind[i], f = this.plife[i] / this.pmax[i];
      this.px[i] += this.pvx[i] * dt; this.py[i] += this.pvy[i] * dt; this.prot[i] += this.pvr[i] * dt;
      const drag = kind === PK.petal ? 0.985 : 0.95; this.pvx[i] *= drag; this.pvy[i] = this.pvy[i] * drag + (kind === PK.petal ? 30 : 0) * dt;
      if (kind === PK.ring) { c.strokeStyle = `rgba(255, 255, 255, ${f * 0.8})`; c.lineWidth = 3 * f; circ(c, this.px[i], this.py[i], (1 - f) * 140); c.stroke(); continue; }
      const sp = this.particleSprite(kind, this.pcol[i]), d = 16 * this.psize[i] * (kind === PK.fluff ? 0.6 + (1 - f) * 0.8 : 1);
      if (kind === PK.spark) c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(1, f * 1.6);
      if (kind === PK.petal) { c.save(); c.translate(this.px[i], this.py[i]); c.rotate(this.prot[i]); c.scale(1, Math.abs(Math.sin(this.prot[i] * 1.3)) * 0.7 + 0.3); c.drawImage(sp, -d / 2, -d / 2, d, d); c.restore(); }
      else c.drawImage(sp, this.px[i] - d / 2, this.py[i] - d / 2, d, d);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    // floating words
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i]; w.t += dt; if (w.t > 1.2) { this.words.splice(i, 1); continue; }
      const a = w.t < 0.9 ? 1 : (1.2 - w.t) / 0.3, rise = w.t * 18, pop = w.t < 0.12 ? 0.6 + w.t * 3.3 : 1;
      c.font = `900 ${w.size * pop}px ${FONT}`; c.lineWidth = 3; c.strokeStyle = `rgba(40, 20, 50, ${0.55 * a})`; c.strokeText(w.text, w.x, w.y - rise);
      c.globalAlpha = a; c.fillStyle = w.color; c.fillText(w.text, w.x, w.y - rise); c.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- the HUD
  private hudText(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = 900) {
    const c = this.c; c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.lineWidth = Math.max(2, size * 0.22); c.lineJoin = 'round'; c.strokeStyle = 'rgba(30, 16, 44, 0.7)'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
  }
  private drawHud(g: SeedstormGame, o: DrawOpts) {
    const c = this.c, t = this.time;
    // score and hi-score, Breeze
    this.hudText(g.score.toLocaleString(), 10, 24, 18, '#ffffff');
    this.hudText(`HI ${Math.max(o.hi, g.score).toLocaleString()}`, 10, 38, 9.5, '#ffe9a8', 'left', 800);
    const bz = g.breeze, hot = Math.min(1, (bz - 1) / 3);
    this.hudText(`🌬 ×${bz.toFixed(1)}`, 10, 52, 10 + hot * 2, `rgb(${200 + hot * 55}, ${240 - hot * 60}, ${255 - hot * 120})`, 'left', 900);
    // hearts and Blooms
    for (let i = 0; i < Math.max(g.hearts, 0); i++) {
      const x = W - 14 - i * 15, y = 17;
      c.fillStyle = 'rgba(30,16,44,0.6)'; heartPath(c, x, y + 1, 6.4); c.fill();
      c.fillStyle = '#ff6f9f'; heartPath(c, x, y, 5.6); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; circ(c, x - 2.2, y - 2, 1.4); c.fill();
    }
    for (let i = 0; i < g.bloomCap; i++) {
      const x = W - 14 - i * 15, y = 37, on = i < g.blooms;
      c.save(); c.translate(x, y); c.rotate(on ? t * 0.8 : 0); c.globalAlpha = on ? 1 : 0.35;
      for (let p = 0; p < 5; p++) { c.rotate(TAU / 5); c.fillStyle = on ? '#ffd6ec' : '#d8d0e0'; c.strokeStyle = 'rgba(120, 40, 80, 0.8)'; c.lineWidth = 0.6; ell(c, 0, -3.4, 2.4, 3.4); c.fill(); c.stroke(); }
      c.fillStyle = on ? '#ffcf3a' : '#b8b0c0'; circ(c, 0, 0, 2); c.fill(); c.restore();
    }
    // the Bloom meter
    const mw = 60, mx = W - 10 - mw, my = 48, full = g.blooms >= g.bloomCap;
    c.fillStyle = 'rgba(30, 16, 44, 0.55)'; c.beginPath(); c.roundRect(mx - 1, my - 1, mw + 2, 6, 3); c.fill();
    const mg = c.createLinearGradient(mx, 0, mx + mw, 0); mg.addColorStop(0, '#ff9ec8'); mg.addColorStop(1, '#ffe08a');
    c.fillStyle = mg; c.beginPath(); c.roundRect(mx, my, Math.max(0.5, mw * Math.min(1, g.meter / BLOOM.meter)), 4, 2); c.fill();
    if (full) { c.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(t * 6) * 0.2})`; c.beginPath(); c.roundRect(mx, my, mw, 4, 2); c.fill(); }
    // the boss bar
    const b = g.boss;
    if (b && (b.state === 'fight' || b.state === 'break')) {
      const y = 64, x0 = 10, w = W - 20, n = b.def.phases.length;
      c.fillStyle = 'rgba(30, 16, 44, 0.6)'; c.beginPath(); c.roundRect(x0, y, w, 26, 8); c.fill();
      this.hudText(b.def.name, x0 + 8, y + 11, 9.5, '#ffffff', 'left', 900);
      for (let i = 0; i < n; i++) { const done = i < b.phase || (i === b.phase && b.state === 'break'); c.fillStyle = done ? 'rgba(255,255,255,0.3)' : i === b.phase ? '#ffd34d' : '#ffffff'; star(c, x0 + w - 40 - (n - 1 - i) * 10, y + 8, 5, 4, 1.8); c.fill(); }
      const secs = Math.ceil(b.timer / HZ);
      this.hudText(String(secs), x0 + w - 8, y + 12, 11, secs <= 5 ? '#ff9ec4' : '#bfe8ff', 'right');
      const f = b.state === 'break' ? 0 : b.hp / b.max;
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.roundRect(x0 + 8, y + 16, w - 16, 5, 2.5); c.fill();
      const bg = c.createLinearGradient(x0, 0, x0 + w, 0); bg.addColorStop(0, '#ff6fa8'); bg.addColorStop(0.5, '#ffb35c'); bg.addColorStop(1, '#ffe66b');
      c.fillStyle = bg; c.beginPath(); c.roundRect(x0 + 8, y + 16, Math.max(0.5, (w - 16) * f), 5, 2.5); c.fill();
    }
    // the banner: a stage title in the middle, or an attack's name sliding in
    const bn = g.banner;
    if (bn) {
      const tt = bn.t / HZ, inA = Math.min(1, tt / 0.35), outA = Math.max(0, Math.min(1, (200 / HZ - tt) / 0.4)), a = Math.min(inA, outA);
      if (bn.kind === 'stage') {
        c.globalAlpha = a; this.hudText(bn.text.toUpperCase(), W / 2, 270, 13, '#ffe9a8', 'center', 900); this.hudText(bn.sub, W / 2, 300, 26 + (1 - inA) * 8, '#ffffff', 'center', 900); c.globalAlpha = 1;
      } else {
        const ease = 1 - (1 - inA) ** 3, x = W + 10 - ease * (W * 0.5 + 20) - (1 - outA) * 40, y = bn.kind === 'mid' ? 112 : 108;
        c.globalAlpha = a;
        const bw = 200; c.fillStyle = 'rgba(40, 20, 60, 0.7)'; c.beginPath(); c.roundRect(x - bw / 2 - 10, y - 18, bw + 20, 34, 10); c.fill();
        c.fillStyle = bn.kind === 'mid' ? '#9fe0ff' : '#ffb3d6'; c.fillRect(x - bw / 2 - 10, y - 18, 4, 34);
        this.hudText(bn.sub.toUpperCase(), x - bw / 2 + 2, y - 5, 8, '#ffe9a8', 'left', 800);
        this.hudText(`“${bn.text}”`, x - bw / 2 + 2, y + 11, 14, '#ffffff', 'left', 900);
        c.globalAlpha = 1;
      }
    }
    void PILOTS; void STAGES;
  }
}

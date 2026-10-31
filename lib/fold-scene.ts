// Paperfold's drawing, in Canvas 2D and in cut-paper style: a wooden folding table with the sheet on it (each
// square a piece of grainy coloured paper, stacks showing their layered edges, punched holes, tape and creases),
// the fold itself as a flap of paper turning over in perspective with its shadow, the target card, the hover
// preview of a fold, paper confetti, and Dora and Enzo as cut-out paintings beside the table (with a cut-paper
// stand-in drawn here until the paintings load). Also the festival scene that fills with the finished pieces, the
// title and the ending. Drawing only: the rules live in fold-game.ts.
import {
  type Sheet, type Paper, type Fold, type Layer, type Colour, type Mark, type Picture, type Top, type Piece,
  px, py, pos, isLifted, landing, rng, PUZZLES, puzzle,
} from './fold-game';

export const INK: Record<Colour, [string, string]> = {
  // [paper, darker edge]
  red: ['#d9483b', '#a3302a'], gold: ['#f0bf3e', '#c08e1e'], blue: ['#3f7fd0', '#2b5a99'], teal: ['#2fa59a', '#1f746c'],
  pink: ['#f19bb5', '#c76c88'], violet: ['#8a62c9', '#5f4192'], white: ['#f7f1e3', '#cfc4ab'], navy: ['#2c3c78', '#1b2550'],
  orange: ['#f08a35', '#bf6220'], leaf: ['#6fb04e', '#4b7f33'], cream: ['#f3e2bd', '#c9b386'], plum: ['#7d3b6b', '#56264a'],
};
const light = (c: Colour) => ['gold', 'white', 'cream', 'pink'].includes(c);
const TAU = Math.PI * 2;

export type Mood = 'curious' | 'thinking' | 'delighted';
export type Preview = { fold: Fold; ok: boolean } | null;
type Anim = { fold: Fold; under: boolean; before: Paper; after: Paper; t: number; dur: number };
type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; c: string; life: number };

// ---- images, loaded once and shared
const IMG = new Map<string, HTMLImageElement>();
export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = IMG.get(name);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = `/art/fold/${name}.webp`; IMG.set(name, im); }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
export const POSES: Mood[] = ['curious', 'thinking', 'delighted'];
export function preload() { for (const who of ['dora', 'enzo']) for (const p of POSES) art(`${who}-${p}`); art('backdrop'); }

// ---- paper grain: one small tile of fibres, multiplied over every piece of paper
let grainTile: HTMLCanvasElement | null = null;
function grain(c: CanvasRenderingContext2D): CanvasPattern | null {
  if (!grainTile) {
    grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 128;
    const g = grainTile.getContext('2d')!, r = rng(62);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = 200 + Math.floor(r() * 55); g.fillStyle = `rgb(${v},${v},${v - 6})`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1); }
    g.strokeStyle = 'rgba(150,140,120,0.22)'; g.lineWidth = 0.6;
    for (let i = 0; i < 46; i++) { const x = r() * 128, y = r() * 128, a = r() * TAU, l = 4 + r() * 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  return c.createPattern(grainTile, 'repeat');
}

// ---- marks, drawn as little cut-paper shapes in a unit box centred on 0,0 (size 1)
export function drawMark(c: CanvasRenderingContext2D, m: Mark, on: Colour) {
  const ink = light(on) ? '#5a3a2a' : '#fff6e2', accent = light(on) ? '#c8402f' : '#ffd25a';
  c.save(); c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = 0.07; c.lineJoin = 'round'; c.lineCap = 'round';
  c.shadowColor = 'rgba(40,20,10,0.28)'; c.shadowOffsetX = 0.03; c.shadowOffsetY = 0.04; c.shadowBlur = 0;
  const path = () => { c.beginPath(); };
  switch (m) {
    case 'star': path(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.14 : 0.33; c.lineTo(Math.cos(a) * r, Math.sin(a) * r + 0.02); } c.closePath(); c.fillStyle = accent; c.fill(); break;
    case 'window': path(); c.moveTo(-0.2, 0.28); c.lineTo(-0.2, -0.08); c.arc(0, -0.08, 0.2, Math.PI, 0); c.lineTo(0.2, 0.28); c.closePath(); c.fillStyle = '#ffd86a'; c.fill();
      c.shadowColor = 'transparent'; c.strokeStyle = '#5a3a2a'; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0, -0.28); c.lineTo(0, 0.28); c.moveTo(-0.2, 0.04); c.lineTo(0.2, 0.04); c.stroke(); break;
    case 'moon': path(); c.arc(0, 0, 0.3, 0, TAU); c.arc(0.13, -0.08, 0.25, 0, TAU, true); c.fill('evenodd'); break;
    case 'ribbon': c.fillStyle = '#e8364f'; path(); c.moveTo(0, 0); c.bezierCurveTo(-0.2, -0.3, -0.42, -0.08, -0.34, 0.12); c.closePath(); c.fill();
      path(); c.moveTo(0, 0); c.bezierCurveTo(0.2, -0.3, 0.42, -0.08, 0.34, 0.12); c.closePath(); c.fill();
      path(); c.moveTo(-0.04, 0.02); c.lineTo(-0.2, 0.34); c.lineTo(-0.1, 0.3); c.lineTo(0, 0.04); c.moveTo(0.04, 0.02); c.lineTo(0.2, 0.34); c.lineTo(0.1, 0.3); c.lineTo(0, 0.04); c.fill();
      c.fillStyle = '#ffd25a'; path(); c.arc(0, 0.01, 0.07, 0, TAU); c.fill(); break;
    case 'flower': c.fillStyle = accent; for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; path(); c.arc(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.12, 0, TAU); c.fill(); } c.fillStyle = ink; path(); c.arc(0, 0, 0.09, 0, TAU); c.fill(); break;
    case 'wave': c.lineWidth = 0.08; c.fillStyle = 'transparent'; for (const dy of [-0.11, 0.11]) { path(); c.moveTo(-0.3, dy); c.bezierCurveTo(-0.15, dy - 0.14, -0.05, dy + 0.14, 0.08, dy); c.bezierCurveTo(0.18, dy - 0.12, 0.25, dy - 0.04, 0.3, dy); c.stroke(); } break;
    case 'eye': path(); c.arc(0, 0, 0.2, 0, TAU); c.fill(); c.fillStyle = light(on) ? '#fff' : '#2a2030'; c.shadowColor = 'transparent'; path(); c.arc(0.05, -0.05, 0.07, 0, TAU); c.fill(); break;
    case 'heart': c.fillStyle = accent; path(); c.moveTo(0, 0.28); c.bezierCurveTo(-0.42, 0.02, -0.2, -0.36, 0, -0.1); c.bezierCurveTo(0.2, -0.36, 0.42, 0.02, 0, 0.28); c.fill(); break;
    case 'sun': c.fillStyle = accent; path(); c.arc(0, 0, 0.16, 0, TAU); c.fill(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; path(); c.moveTo(Math.cos(a) * 0.22, Math.sin(a) * 0.22); c.lineTo(Math.cos(a) * 0.33, Math.sin(a) * 0.33); c.strokeStyle = accent; c.stroke(); } break;
    case 'leaf': c.fillStyle = '#4b8a33'; path(); c.moveTo(-0.26, 0.22); c.quadraticCurveTo(-0.24, -0.26, 0.28, -0.24); c.quadraticCurveTo(0.24, 0.22, -0.26, 0.22); c.fill(); break;
    case 'flame': c.fillStyle = '#ff9d2e'; path(); c.moveTo(0, -0.32); c.bezierCurveTo(0.26, -0.04, 0.24, 0.3, 0, 0.3); c.bezierCurveTo(-0.24, 0.3, -0.26, -0.04, 0, -0.32); c.fill();
      c.fillStyle = '#ffe27a'; path(); c.moveTo(0, -0.08); c.bezierCurveTo(0.12, 0.06, 0.1, 0.24, 0, 0.24); c.bezierCurveTo(-0.1, 0.24, -0.12, 0.06, 0, -0.08); c.fill(); break;
    case 'dot': path(); c.arc(0, 0, 0.13, 0, TAU); c.fill(); break;
  }
  c.restore();
}

/** One square of paper face in a box (x, y, size s), with grain, a soft edge and maybe a mark. */
function face(c: CanvasRenderingContext2D, x: number, y: number, s: number, colour: Colour, mark: Mark | null, shade = 0) {
  const [paper] = INK[colour];
  c.fillStyle = paper; c.fillRect(x - 0.5, y - 0.5, s + 1, s + 1);
  const g = grain(c);
  if (g) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55; c.translate(x, y); c.fillStyle = g; c.fillRect(-0.5, -0.5, s + 1, s + 1); c.restore(); }
  if (shade) { c.fillStyle = shade > 0 ? `rgba(30,15,10,${shade})` : `rgba(255,250,235,${-shade})`; c.fillRect(x - 0.5, y - 0.5, s + 1, s + 1); }
  if (mark) { c.save(); c.translate(x + s / 2, y + s / 2); c.scale(s, s); drawMark(c, mark, colour); c.restore(); }
}

/** Draws a whole paper (stacks at positions) at origin ox, oy with cell size s. `skip` hides lifted positions. */
export function drawPaper(c: CanvasRenderingContext2D, sheet: Sheet, paper: Paper, ox: number, oy: number, s: number, skip?: (x: number, y: number) => boolean, opts: { creases?: boolean; lift?: number } = {}) {
  const lift = opts.lift ?? 0;
  // shadow of the whole paper on the table
  c.save(); c.fillStyle = 'rgba(60,35,20,0.22)';
  for (const p of paper.stacks.keys()) { const x = px(p), y = py(p); if (skip?.(x, y)) continue; c.fillRect(ox + x * s + s * 0.05 + lift, oy + y * s + s * 0.07 + lift, s, s); }
  c.restore();
  // layered edges: thicker stacks show more paper under them
  for (const [p, st] of paper.stacks) {
    const x = px(p), y = py(p); if (skip?.(x, y)) continue;
    for (let i = 0; i < st.length - 1 && i < 5; i++) {
      const l = st[i], cell = sheet.cells[l.c], col = l.up === 'f' ? cell.f : cell.b, d = (st.length - 1 - i) * Math.max(1.2, s * 0.022);
      c.fillStyle = INK[col][1]; c.fillRect(ox + x * s + d * 0.6, oy + y * s + d, s, s);
    }
  }
  for (const [p, st] of paper.stacks) {
    const x = px(p), y = py(p); if (skip?.(x, y)) continue;
    drawStack(c, sheet, st, ox + x * s, oy + y * s, s);
  }
  if (opts.creases !== false) drawSeams(c, sheet, paper, ox, oy, s, skip);
}

/** The top of one stack: the highest unpunched face, with any punched layers above it drawn as frames. */
export function drawStack(c: CanvasRenderingContext2D, sheet: Sheet, st: Layer[], x: number, y: number, s: number, shade = 0) {
  let i = st.length - 1;
  while (i >= 0 && sheet.cells[st[i].c].hole) i--;
  if (i >= 0) { const cell = sheet.cells[st[i].c], f = st[i].up === 'f'; face(c, x, y, s, f ? cell.f : cell.b, f ? cell.fm : cell.bm, shade); }
  for (let j = Math.max(0, i + 1); j < st.length; j++) {
    const cell = sheet.cells[st[j].c], f = st[j].up === 'f';
    c.save(); c.beginPath(); c.rect(x - 0.5, y - 0.5, s + 1, s + 1); c.arc(x + s / 2, y + s / 2, s * 0.3, 0, TAU, true); c.clip('evenodd');
    face(c, x, y, s, f ? cell.f : cell.b, null, shade);
    c.restore();
    c.save(); c.strokeStyle = 'rgba(60,30,20,0.4)'; c.lineWidth = Math.max(1, s * 0.025); c.beginPath(); c.arc(x + s / 2, y + s / 2, s * 0.3, 0, TAU); c.stroke(); c.restore();
  }
  if (i < 0 && st.length && !sheet.cells[st[0].c].hole) return;
}

/** Faint score lines between neighbouring squares, and the tape and creases where they show. */
function drawSeams(c: CanvasRenderingContext2D, sheet: Sheet, paper: Paper, ox: number, oy: number, s: number, skip?: (x: number, y: number) => boolean) {
  const has = (x: number, y: number) => paper.stacks.has(pos(x, y)) && x >= 0 && y >= 0 && !skip?.(x, y);
  c.save(); c.strokeStyle = 'rgba(70,40,25,0.22)'; c.lineWidth = Math.max(1, s * 0.012); c.setLineDash([s * 0.06, s * 0.05]);
  c.beginPath();
  for (const p of paper.stacks.keys()) {
    const x = px(p), y = py(p); if (skip?.(x, y)) continue;
    if (has(x + 1, y)) { c.moveTo(ox + (x + 1) * s, oy + y * s + 2); c.lineTo(ox + (x + 1) * s, oy + (y + 1) * s - 2); }
    if (has(x, y + 1)) { c.moveTo(ox + x * s + 2, oy + (y + 1) * s); c.lineTo(ox + (x + 1) * s - 2, oy + (y + 1) * s); }
  }
  c.stroke(); c.restore();
  // where is each cell, and is it on top of its stack?
  const at = new Map<number, { x: number; y: number; up: 'f' | 'b'; top: boolean }>();
  for (const [p, st] of paper.stacks) st.forEach((l, z) => at.set(l.c, { x: px(p), y: py(p), up: l.up, top: z === st.length - 1 }));
  const edge = (a: number, b: number) => {
    const A = at.get(a)!, B = at.get(b)!; if (A.x === B.x && A.y === B.y) return null;
    if (skip?.(A.x, A.y) || skip?.(B.x, B.y)) return null;
    if (A.x !== B.x) { const xx = Math.max(A.x, B.x); return { x0: ox + xx * s, y0: oy + A.y * s, x1: ox + xx * s, y1: oy + (A.y + 1) * s, top: A.top && B.top, up: A.up }; }
    const yy = Math.max(A.y, B.y); return { x0: ox + A.x * s, y0: oy + yy * s, x1: ox + (A.x + 1) * s, y1: oy + yy * s, top: A.top && B.top, up: A.up };
  };
  for (const cr of sheet.creases) {
    const e = edge(cr.a, cr.b); if (!e || !e.top) continue;
    const mountain = (cr.kind === 'mountain') === (e.up === 'f');
    c.save(); c.lineWidth = Math.max(2, s * 0.045); c.strokeStyle = mountain ? '#c0392b' : '#2f6fb3';
    c.setLineDash(mountain ? [s * 0.12, s * 0.05, s * 0.02, s * 0.05] : [s * 0.1, s * 0.07]);
    c.beginPath(); c.moveTo(e.x0, e.y0); c.lineTo(e.x1, e.y1); c.stroke(); c.restore();
  }
  for (const [a, b] of sheet.tape) {
    const e = edge(a, b); if (!e) continue;
    const mx = (e.x0 + e.x1) / 2, my = (e.y0 + e.y1) / 2, vert = e.x0 === e.x1;
    c.save(); c.translate(mx, my); c.rotate(vert ? 0.06 : Math.PI / 2 + 0.06);
    c.fillStyle = e.top ? 'rgba(250,236,190,0.82)' : 'rgba(250,236,190,0.35)'; c.strokeStyle = 'rgba(160,130,70,0.5)'; c.lineWidth = 1;
    const w = s * 0.42, h = s * 0.62; c.beginPath();
    c.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 6; i++) c.lineTo(-w / 2 + (w * i) / 6, -h / 2 + (i % 2 ? 2 : 0));
    c.lineTo(w / 2, h / 2); for (let i = 6; i >= 0; i--) c.lineTo(-w / 2 + (w * i) / 6, h / 2 - (i % 2 ? 2 : 0));
    c.closePath(); c.fill(); c.stroke(); c.restore();
  }
}

/** A picture (the target) drawn as flat paper squares; holes show the card through a ring. */
export function drawPicture(c: CanvasRenderingContext2D, pic: Picture, ox: number, oy: number, s: number) {
  c.save(); c.fillStyle = 'rgba(60,35,20,0.2)';
  for (const p of pic.tops.keys()) c.fillRect(ox + px(p) * s + s * 0.06, oy + py(p) * s + s * 0.08, s, s);
  c.restore();
  for (const [p, t] of pic.tops) {
    const x = ox + px(p) * s, y = oy + py(p) * s;
    if (t === 'hole') { c.save(); c.strokeStyle = '#8a6a4a'; c.setLineDash([3, 3]); c.lineWidth = 1.5; c.strokeRect(x + 1, y + 1, s - 2, s - 2); c.beginPath(); c.arc(x + s / 2, y + s / 2, s * 0.3, 0, TAU); c.stroke(); c.restore(); continue; }
    face(c, x, y, s, t.colour, t.mark);
  }
}
export const topColour = (t: Top) => (t === 'hole' ? null : t.colour);

// ---- the pieces for the festival: a lantern, a boat, a crane, a star, a moon or a fish, in two paper colours
export function drawPiece(c: CanvasRenderingContext2D, piece: Piece, a: Colour, b: Colour, x: number, y: number, s: number, glow = 0, t = 0) {
  const A = INK[a][0], Ad = INK[a][1], B = INK[b][0];
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round';
  if (glow > 0) { const g = c.createRadialGradient(0, 0, 0.05, 0, 0, 1.1); g.addColorStop(0, `rgba(255,214,120,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1.1, 0, TAU); c.fill(); }
  c.shadowColor = 'rgba(30,15,10,0.35)'; c.shadowOffsetX = 0.04; c.shadowOffsetY = 0.06;
  const poly = (pts: number[], col: string) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); };
  switch (piece) {
    case 'lantern': {
      c.strokeStyle = '#4a3020'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0, -0.75); c.lineTo(0, -0.5); c.stroke();
      poly([-0.18, -0.52, 0.18, -0.52, 0.2, -0.42, -0.2, -0.42], '#3b2a20');
      c.fillStyle = A; c.beginPath(); c.ellipse(0, 0, 0.42, 0.44, 0, 0, TAU); c.fill(); c.shadowColor = 'transparent';
      c.fillStyle = B; c.beginPath(); c.ellipse(0, 0, 0.16, 0.44, 0, 0, TAU); c.fill();
      if (glow > 0) { c.fillStyle = `rgba(255,236,160,${0.5 * glow})`; c.beginPath(); c.ellipse(0, 0, 0.3, 0.34, 0, 0, TAU); c.fill(); }
      c.strokeStyle = Ad; c.lineWidth = 0.025; for (const dy of [-0.2, 0, 0.2]) { c.beginPath(); c.ellipse(0, dy, 0.4, 0.05, 0, 0, Math.PI); c.stroke(); }
      poly([-0.16, 0.42, 0.16, 0.42, 0.18, 0.52, -0.18, 0.52], '#3b2a20');
      c.strokeStyle = '#e8364f'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0, 0.52); c.lineTo(Math.sin(t * 2) * 0.03, 0.75); c.stroke();
      break;
    }
    case 'boat':
      poly([-0.6, 0.05, 0.6, 0.05, 0.35, 0.34, -0.35, 0.34], A);
      c.shadowColor = 'transparent'; poly([-0.6, 0.05, -0.2, 0.05, -0.35, 0.34], Ad); poly([0.6, 0.05, 0.2, 0.05, 0.35, 0.34], Ad);
      poly([0, -0.62, 0.02, 0.05, -0.42, 0.0], B); poly([0.06, -0.48, 0.06, 0.05, 0.38, 0.0], A);
      if (glow > 0) { c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(0.3, -0.08, 0.06 + 0.02 * Math.sin(t * 9), 0, TAU); c.fill(); }
      break;
    case 'crane':
      poly([-0.1, 0, 0.3, -0.05, 0.55, -0.45, 0.62, -0.42, 0.42, 0.05, 0.1, 0.18], A);
      c.shadowColor = 'transparent';
      poly([-0.05, 0.02, -0.55, -0.55 + Math.sin(t * 3) * 0.08, -0.25, 0.06], B);
      poly([0.05, 0.02, 0.3, -0.62 - Math.sin(t * 3) * 0.08, 0.2, 0.06], Ad);
      poly([-0.1, 0, -0.62, 0.12, -0.08, 0.16], A);
      c.fillStyle = '#e8364f'; c.beginPath(); c.arc(0.56, -0.47, 0.04, 0, TAU); c.fill();
      break;
    case 'star': {
      c.fillStyle = A; c.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.24 : 0.58; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); } c.closePath(); c.fill();
      c.shadowColor = 'transparent'; c.fillStyle = B; c.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.1 : 0.26; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); } c.closePath(); c.fill();
      break;
    }
    case 'moon':
      c.fillStyle = A === INK.navy[0] || A === INK.plum[0] ? B : A; c.beginPath(); c.arc(0, 0, 0.55, 0, TAU); c.arc(0.24, -0.12, 0.46, 0, TAU, true); c.fill('evenodd');
      break;
    case 'fish':
      poly([0.6, 0, 0.2, -0.3, -0.35, -0.22, -0.55, 0, -0.35, 0.22, 0.2, 0.3], A);
      c.shadowColor = 'transparent'; poly([-0.45, 0, -0.78, -0.3 + Math.sin(t * 4) * 0.06, -0.72, 0, -0.78, 0.3 + Math.sin(t * 4) * 0.06], B);
      c.fillStyle = B; for (const dx of [-0.1, 0.12]) { c.beginPath(); c.arc(dx, 0.02, 0.1, -Math.PI / 2, Math.PI / 2); c.fill(); }
      c.fillStyle = '#2a2030'; c.beginPath(); c.arc(0.38, -0.06, 0.05, 0, TAU); c.fill();
      break;
  }
  c.restore();
}

// ---- Dora and Enzo: the cut-out paintings, or a cut-paper stand-in drawn here
export function drawChin(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', mood: Mood, x: number, y: number, h: number, t: number, hop = 0) {
  const face = who === 'dora' ? 1 : -1;
  const bob = Math.sin(t * 2.2 + (who === 'dora' ? 0 : 1.7)) * h * 0.008, jump = -Math.abs(Math.sin(hop * Math.PI)) * h * 0.12;
  const tilt = mood === 'thinking' ? Math.sin(t * 1.3) * 0.03 + 0.04 * face : mood === 'curious' ? 0.03 * face : Math.sin(t * 7) * 0.025;
  c.save(); c.translate(x, y + bob + jump);
  // contact shadow
  c.fillStyle = 'rgba(40,20,10,0.25)'; c.beginPath(); c.ellipse(0, 0, h * 0.3 * (1 + jump / h), h * 0.045, 0, 0, TAU); c.fill();
  c.rotate(tilt);
  const im = art(`${who}-${mood}`) ?? art(`${who}-curious`);
  if (im) { c.drawImage(im, -h / 2, -h, h, h); c.restore(); return; }
  drawPaperChin(c, who, mood, h, t);
  c.restore();
}

/** A small cut-paper chinchilla for when the paintings are missing: layered paper shapes with offset shadows. */
export function drawPaperChin(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', mood: Mood, h: number, t: number) {
  const fur = who === 'dora' ? '#f6eedb' : '#8c9db3', dark = who === 'dora' ? '#e2d4b6' : '#6c7d94', chest = who === 'dora' ? '#fffaf0' : '#c9d2de';
  const eye = who === 'dora' ? '#b3122e' : '#141414', dir = who === 'dora' ? 1 : -1, u = h / 100;
  const blob = (x: number, y: number, rx: number, ry: number, col: string, rot = 0) => {
    c.save(); c.fillStyle = 'rgba(60,35,25,0.25)'; c.beginPath(); c.ellipse((x + 1.2) * u, (y + 1.6) * u, rx * u, ry * u, rot, 0, TAU); c.fill(); c.restore();
    c.fillStyle = col; c.beginPath();
    // a slightly torn edge
    for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU, j = 1 + 0.025 * Math.sin(i * 7.3 + x); c.lineTo(x * u + Math.cos(a) * rx * u * j * Math.cos(rot) - Math.sin(a) * ry * u * j * Math.sin(rot), y * u + Math.cos(a) * rx * u * j * Math.sin(rot) + Math.sin(a) * ry * u * j * Math.cos(rot)); }
    c.fill();
  };
  c.save(); c.scale(dir, 1);
  blob(-26, -30, 14, 22, dark, -0.5); // tail
  blob(0, -30, 24, 28, fur); // body
  blob(4, -26, 13, 18, chest);
  const arm = mood === 'delighted' ? -14 + Math.sin(t * 8) * 2 : mood === 'thinking' ? -50 : -24;
  blob(16, arm, 6, 9, fur, 0.4);
  blob(2, -64, 22, 19, fur); // head: broad, smooth, slightly flat crown
  blob(-10, -82, 8, 10, dark, -0.3); blob(-10, -81, 5, 7, '#f2a7b5', -0.3); // ears
  blob(10, -84, 8, 10, dark, 0.3); blob(10, -83, 5, 7, '#f2a7b5', 0.3);
  c.fillStyle = eye;
  if (mood === 'delighted') { c.strokeStyle = eye; c.lineWidth = 2 * u; c.beginPath(); c.arc(10 * u, -64 * u, 3.5 * u, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  else { c.beginPath(); c.ellipse(10 * u, (mood === 'thinking' ? -66 : -64) * u, 3.4 * u, 4 * u, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(11 * u, -66 * u, 1.1 * u, 0, TAU); c.fill(); }
  c.fillStyle = '#e88a9a'; c.beginPath(); c.arc(21 * u, -59 * u, 2 * u, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(60,50,50,0.5)'; c.lineWidth = 0.6 * u; c.beginPath();
  for (const dy of [-2, 1]) { c.moveTo(20 * u, -58 * u); c.lineTo(34 * u, (-58 + dy * 2) * u); }
  c.stroke();
  c.restore();
}

// ---- the folding table
export type Layout = { W: number; H: number; tall: boolean; table: { x: number; y: number; w: number; h: number }; card: { x: number; y: number; w: number; h: number };
  dora: { x: number; y: number; h: number }; enzo: { x: number; y: number; h: number } };

export class FoldScene {
  readonly cv: HTMLCanvasElement; readonly c: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  sheet: Sheet | null = null; paper: Paper | null = null; target: Picture | null = null; puzzleId = '';
  anim: Anim | null = null;
  preview: Preview = null;
  hint: Fold | null = null;
  mood: { dora: Mood; enzo: Mood } = { dora: 'curious', enzo: 'curious' };
  hop = 0; snap = 0; lift = 0; t = 0; blocked = 0; blockedFold: Fold | null = null;
  /** the paper's offset from the table centre in cells, eased after a fold moves the paper */
  off = { x: 0, y: 0 };
  cell = 60; bits: Bit[] = []; seed = rng(7);
  /** grid size used for the cell size: the sheet's own, so the squares don't change size as it shrinks */
  dims = { w: 2, h: 2 };
  layout!: Layout;
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.c = cv.getContext('2d')!; preload(); this.resize(); }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(200, r.width); this.H = Math.max(200, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.layout = this.makeLayout();
    this.fitCell();
  }
  /** Room for the HUD bar at the top and the buttons at the bottom is left by the page's insets. */
  insets = { top: 10, bottom: 80 };
  makeLayout(): Layout {
    const W = this.W, H = this.H, tall = H > W * 1.05, top = this.insets.top, bot = this.insets.bottom;
    if (!tall) {
      const ch = Math.min(H * 0.48, W * 0.24);
      const tw = Math.min(W * 0.5, (H - top - bot) * 1.15), th = H - top - bot - 8;
      const tx = (W - tw) / 2, ty = top + 4;
      const cw = Math.min(W * 0.19, 230), cardH = cw * 0.92;
      return { W, H, tall, table: { x: tx, y: ty, w: tw, h: th },
        card: { x: Math.min(W - cw - 14, tx + tw + 14), y: top + 6, w: cw, h: cardH },
        dora: { x: tx * 0.52, y: H - bot * 0.35, h: Math.min(ch, tx * 1.05) }, enzo: { x: W - tx * 0.52, y: H - bot * 0.35, h: Math.min(ch, tx * 1.05) } };
    }
    const chH = Math.min(W * 0.36, H * 0.2), cw = Math.min(W * 0.36, 170), cardH = cw * 0.9;
    const ty = top + cardH + 12, th = H - ty - bot - chH * 0.72, tw = W - 20;
    return { W, H, tall, table: { x: 10, y: ty, w: tw, h: th }, card: { x: W - cw - 10, y: top + 4, w: cw, h: cardH },
      dora: { x: W * 0.17, y: H - bot - 4, h: chH }, enzo: { x: W * 0.83, y: H - bot - 4, h: chH } };
  }
  fitCell() {
    const T = this.layout.table, n = Math.max(this.dims.w, this.dims.h) + 0.7;
    this.cell = Math.max(18, Math.min((T.w - 20) / (this.dims.w + 0.7), (T.h - 20) / (this.dims.h + 0.7), 150, (Math.min(T.w, T.h) - 20) / n * 1.4));
  }
  setPuzzle(id: string, sheet: Sheet, paper: Paper, target: Picture) {
    this.puzzleId = id; this.sheet = sheet; this.paper = paper; this.target = target; this.anim = null; this.preview = null; this.hint = null;
    this.dims = { w: paper.w, h: paper.h }; this.off = { x: 0, y: 0 }; this.snap = 0; this.lift = 0; this.bits = [];
    this.fitCell();
  }
  setPaper(paper: Paper) { this.paper = paper; this.anim = null; this.off = { x: 0, y: 0 }; }
  /** Starts the turn-over animation of a fold; the paper becomes `after` when it lands. */
  playFold(fold: Fold, under: boolean, before: Paper, after: Paper) {
    this.anim = { fold, under, before, after, t: 0, dur: 0.46 };
    this.paper = before; this.preview = null; this.hint = null;
  }
  get busy() { return !!this.anim; }
  shake(fold: Fold) { this.blocked = 1; this.blockedFold = fold; }
  celebrate() {
    this.snap = 1; this.hop = 0.001;
    const o = this.origin(), p = this.paper!;
    const r = this.seed, cols = ['#d9483b', '#f0bf3e', '#3f7fd0', '#2fa59a', '#f19bb5', '#8a62c9', '#f08a35'];
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, v = 120 + r() * 320;
      this.bits.push({ x: o.x + (p.w * this.cell) / 2, y: o.y + (p.h * this.cell) / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220, r: r() * TAU, vr: (r() - 0.5) * 12, s: 5 + r() * 8, c: cols[i % cols.length], life: 1.4 + r() * 0.8 });
    }
  }

  /** Top-left of the paper on the canvas (in CSS pixels). */
  origin(paper = this.paper) {
    const T = this.layout.table, p = paper ?? { w: 1, h: 1 };
    return { x: T.x + T.w / 2 - (p.w * this.cell) / 2 + this.off.x * this.cell, y: T.y + T.h / 2 - (p.h * this.cell) / 2 + this.off.y * this.cell };
  }
  /** Canvas point of a grid point of the current paper (for tests and the page). */
  point(gx: number, gy: number) { const o = this.origin(); return { x: o.x + gx * this.cell, y: o.y + gy * this.cell }; }
  /** The fold a pointer at (x, y) would make: the nearest grid line crossing the paper, lifting the side the pointer is on. */
  foldAt(x: number, y: number): Fold | null {
    const p = this.paper; if (!p || this.anim) return null;
    const o = this.origin(), gx = (x - o.x) / this.cell, gy = (y - o.y) / this.cell;
    const pad = 0.6; if (gx < -pad || gy < -pad || gx > p.w + pad || gy > p.h + pad) return null;
    let best: Fold | null = null, bd = Infinity;
    for (let at = 1; at < p.w; at++) { const d = Math.abs(gx - at); if (d < bd) { bd = d; best = { axis: 'x', at, low: gx < at }; } }
    for (let at = 1; at < p.h; at++) { const d = Math.abs(gy - at); if (d < bd) { bd = d; best = { axis: 'y', at, low: gy < at }; } }
    return best;
  }
  /** The fold a drag from a to b makes: the crease halfway between them on the axis moved most, lifting a's side. */
  foldFromDrag(ax: number, ay: number, bx: number, by: number): Fold | null {
    const p = this.paper; if (!p || this.anim) return null;
    const o = this.origin(), g = (v: number, o0: number) => (v - o0) / this.cell;
    const dx = g(bx, o.x) - g(ax, o.x), dy = g(by, o.y) - g(ay, o.y);
    if (Math.hypot(dx, dy) < 0.45) return null;
    const vert = Math.abs(dx) >= Math.abs(dy), a0 = vert ? g(ax, o.x) : g(ay, o.y), d = vert ? dx : dy, n = vert ? p.w : p.h;
    const at = Math.max(1, Math.min(n - 1, Math.round(a0 + d / 2)));
    if (n < 2) return null;
    return { axis: vert ? 'x' : 'y', at, low: d > 0 };
  }

  frame(dt: number) {
    this.t += dt;
    if (this.anim) {
      this.anim.t += dt / this.anim.dur;
      if (this.anim.t >= 1) {
        const a = this.anim; this.anim = null;
        // keep the paper where it landed, then ease it back to the middle of the table
        const sx = this.shiftOf(a), oldO = this.origin(a.before);
        this.paper = a.after;
        const newO = this.origin(a.after);
        this.off.x += (oldO.x + sx.x * this.cell - newO.x) / this.cell; this.off.y += (oldO.y + sx.y * this.cell - newO.y) / this.cell;
      }
    }
    if (!this.anim) { const k = Math.min(1, dt * 7); this.off.x -= this.off.x * k; this.off.y -= this.off.y * k; }
    if (this.blocked > 0) this.blocked = Math.max(0, this.blocked - dt * 2.2);
    if (this.snap > 0) this.snap = Math.max(0, this.snap - dt * 1.2);
    if (this.hop > 0) { this.hop += dt * 2.4; if (this.hop >= 2) this.hop = 0; }
    for (const b of this.bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 600 * dt; b.vx *= 1 - dt * 1.5; b.r += b.vr * dt; b.life -= dt; }
    this.bits = this.bits.filter((b) => b.life > 0);
    this.draw();
  }
  /** Where the after-paper's 0,0 sits in the before-paper's grid. */
  shiftOf(a: Anim) {
    let x0 = Infinity, y0 = Infinity;
    for (const p of a.before.stacks.keys()) {
      let x = px(p), y = py(p);
      if (isLifted(a.fold, x, y)) [x, y] = landing(a.fold, x, y);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    }
    return { x: x0, y: y0 };
  }

  /** When set, the canvas shows the festival instead of the table. */
  festival: { done: string[]; fresh?: string; freshT: number; lit: number } | null = null;
  draw() {
    const c = this.c, L = this.layout;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    if (this.festival) {
      const f = this.festival; f.freshT = Math.min(1, f.freshT + 1 / 120);
      drawFestival(c, this.W, this.H, f.done, this.t, f.lit, f.fresh, f.freshT);
      return;
    }
    this.drawTable();
    if (this.sheet && this.paper) {
      if (this.anim) this.drawFolding(this.anim);
      else {
        const o = this.origin(), lift = this.snap > 0 ? -Math.sin(this.snap * Math.PI) * 6 : 0;
        c.save();
        if (this.snap > 0) { const k = 1 + Math.sin(this.snap * Math.PI) * 0.05, cx = o.x + (this.paper.w * this.cell) / 2, cy = o.y + (this.paper.h * this.cell) / 2; c.translate(cx, cy + lift); c.scale(k, k); c.translate(-cx, -cy); }
        drawPaper(c, this.sheet, this.paper, o.x, o.y, this.cell);
        if (this.snap > 0) { c.fillStyle = `rgba(255,248,220,${this.snap * 0.45})`; c.fillRect(o.x - 4, o.y - 4, this.paper.w * this.cell + 8, this.paper.h * this.cell + 8); }
        c.restore();
        if (this.preview) this.drawPreview(this.preview.fold, this.preview.ok ? 'preview' : 'bad');
        if (this.hint) this.drawPreview(this.hint, 'hint');
        if (this.blocked > 0 && this.blockedFold) this.drawPreview(this.blockedFold, 'bad', this.blocked);
      }
    }
    this.drawCard();
    const tt = this.t;
    drawChin(c, 'dora', this.mood.dora, L.dora.x, L.dora.y, L.dora.h, tt, this.hop > 0 ? Math.min(1, this.hop) : 0);
    drawChin(c, 'enzo', this.mood.enzo, L.enzo.x, L.enzo.y, L.enzo.h, tt, this.hop > 0.3 ? Math.min(1, this.hop - 0.3) : 0);
    for (const b of this.bits) { c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.globalAlpha = Math.min(1, b.life * 2); c.fillStyle = b.c; c.fillRect(-b.s / 2, -b.s * 0.35, b.s, b.s * 0.7); c.restore(); }
  }

  drawTable() {
    const c = this.c, { table: T, W, H } = this.layout;
    // the room: a warm paper-collage wall with torn strips
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f4dcb8'); g.addColorStop(1, '#e7c597'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = rng(11);
    for (let i = 0; i < 7; i++) {
      const y = H * (0.08 + i * 0.14) + r() * 20, col = ['#efd1a6', '#f7e4c4', '#e9c99c'][i % 3];
      c.fillStyle = col; c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= W + 30; x += 30) c.lineTo(x, y + Math.sin(x * 0.05 + i) * 3 + r() * 4);
      c.lineTo(W, y + 40 + r() * 20); for (let x = W; x >= -30; x -= 30) c.lineTo(x, y + 44 + Math.sin(x * 0.04 + i) * 4 + r() * 4);
      c.closePath(); c.fill();
    }
    const gr = grain(c); if (gr) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.35; c.fillStyle = gr; c.fillRect(0, 0, W, H); c.restore(); }
    // the table: a wooden board with a cutting mat
    c.save(); c.fillStyle = 'rgba(70,40,20,0.25)'; this.round(T.x + 6, T.y + 10, T.w, T.h, 18); c.fill(); c.restore();
    c.fillStyle = '#b77a45'; this.round(T.x, T.y, T.w, T.h, 18); c.fill();
    c.save(); this.round(T.x, T.y, T.w, T.h, 18); c.clip();
    c.strokeStyle = 'rgba(90,50,20,0.25)'; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const y = T.y + (T.h * (i + 0.5)) / 12; c.beginPath(); c.moveTo(T.x, y); for (let x = T.x; x <= T.x + T.w; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + i * 1.7) * 3); c.stroke(); }
    c.restore();
    const m = 14; c.fillStyle = '#4f8f7c'; this.round(T.x + m, T.y + m, T.w - 2 * m, T.h - 2 * m, 12); c.fill();
    c.save(); this.round(T.x + m, T.y + m, T.w - 2 * m, T.h - 2 * m, 12); c.clip();
    if (gr) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.3; c.fillStyle = gr; c.fillRect(T.x, T.y, T.w, T.h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    c.strokeStyle = 'rgba(220,240,230,0.16)'; c.lineWidth = 1; const step = Math.max(14, this.cell / 2);
    c.beginPath(); for (let x = T.x + m; x < T.x + T.w - m; x += step) { c.moveTo(x, T.y); c.lineTo(x, T.y + T.h); } for (let y = T.y + m; y < T.y + T.h - m; y += step) { c.moveTo(T.x, y); c.lineTo(T.x + T.w, y); } c.stroke();
    c.restore();
  }
  round(x: number, y: number, w: number, h: number, r: number) { const c = this.c; c.beginPath(); c.roundRect(x, y, w, h, r); }

  /** The fold in motion: the lifted part turns over the crease in perspective, with its shadow. */
  drawFolding(a: Anim) {
    const c = this.c, sheet = this.sheet!, s = this.cell, o = this.origin(a.before), f = a.fold;
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2, th = e * Math.PI;
    const lifted = (x: number, y: number) => isLifted(f, x, y);
    const line = f.at * s, T = this.layout.table, vx = T.x + T.w / 2, vy = T.y + T.h * 0.35, cam = Math.max(T.w, T.h) * 1.6;
    const proj = (gx: number, gy: number) => {
      // grid point -> rotated 3D point -> perspective
      let X = gx * s, Y = gy * s, Z = 0;
      if (f.axis === 'x') { const d = X - line; X = line + d * Math.cos(th); Z = Math.abs(d) * Math.sin(th) * (a.under ? -1 : 1); }
      else { const d = Y - line; Y = line + d * Math.cos(th); Z = Math.abs(d) * Math.sin(th) * (a.under ? -1 : 1); }
      const k = cam / (cam - Z * 0.9), sx = o.x + X, sy = o.y + Y;
      return { x: vx + (sx - vx) * k, y: vy + (sy - vy) * k - Z * 0.12, z: Z };
    };
    const drawFlap = () => {
      const showTop = th < Math.PI / 2, light = Math.abs(Math.cos(th));
      // shadow on the table under the flap
      c.save(); c.fillStyle = `rgba(40,20,10,${0.18 * Math.sin(th)})`;
      for (const p of a.before.stacks.keys()) {
        const x = px(p), y = py(p); if (!lifted(x, y)) continue;
        const q = [proj(x, y), proj(x + 1, y), proj(x + 1, y + 1), proj(x, y + 1)];
        const sh = Math.sin(th) * s * 0.35;
        c.beginPath(); q.forEach((p0) => c.lineTo(p0.x + sh * 0.5, p0.y + sh)); c.closePath(); c.fill();
      }
      c.restore();
      for (const [p, st] of a.before.stacks) {
        const x = px(p), y = py(p); if (!lifted(x, y)) continue;
        const q = [proj(x, y), proj(x + 1, y), proj(x + 1, y + 1), proj(x, y + 1)];
        // the face we see: the top until it stands on edge, then the underside (the bottom layer, other face)
        const layers = showTop ? st : st.slice().reverse().map((l) => ({ c: l.c, up: (l.up === 'f' ? 'b' : 'f') as 'f' | 'b' }));
        c.save();
        // map the unit cell onto the quad with an affine transform from three corners (good enough for small turns)
        const [p0, p1, , p3] = q;
        c.beginPath(); q.forEach((pp) => c.lineTo(pp.x, pp.y)); c.closePath(); c.clip();
        c.transform((p1.x - p0.x) / s, (p1.y - p0.y) / s, (p3.x - p0.x) / s, (p3.y - p0.y) / s, p0.x, p0.y);
        drawStack(c, sheet, layers, 0, 0, s, (1 - light) * 0.35 - (showTop ? 0 : 0.04));
        c.restore();
      }
    };
    if (a.under) drawFlap();
    drawPaper(c, sheet, a.before, o.x, o.y, s, lifted);
    // the crease line
    c.save(); c.strokeStyle = 'rgba(255,250,235,0.7)'; c.lineWidth = 2;
    c.beginPath(); if (f.axis === 'x') { c.moveTo(o.x + line, o.y - 6); c.lineTo(o.x + line, o.y + a.before.h * s + 6); } else { c.moveTo(o.x - 6, o.y + line); c.lineTo(o.x + a.before.w * s + 6, o.y + line); } c.stroke(); c.restore();
    if (!a.under) drawFlap();
  }

  /** The fold line under the pointer (or the hint): the lifting side lightly tinted, the line and an arrow. */
  drawPreview(f: Fold, kind: 'preview' | 'hint' | 'bad', fade = 1) {
    const c = this.c, p = this.paper!, s = this.cell, o = this.origin();
    const col = kind === 'bad' ? '#e0453a' : kind === 'hint' ? '#ffd23f' : '#fffaf0';
    const pulse = kind === 'hint' ? 0.5 + 0.5 * Math.sin(this.t * 6) : 1;
    c.save(); c.globalAlpha = fade;
    // tint the part that lifts, and ghost where it lands
    for (const q of p.stacks.keys()) {
      const x = px(q), y = py(q); if (!isLifted(f, x, y)) continue;
      c.fillStyle = kind === 'bad' ? 'rgba(224,69,58,0.18)' : `rgba(255,250,230,${0.22 * pulse})`; c.fillRect(o.x + x * s, o.y + y * s, s, s);
      const [lx, ly] = landing(f, x, y);
      c.strokeStyle = kind === 'bad' ? 'rgba(224,69,58,0.5)' : `rgba(255,250,235,${0.65 * pulse})`; c.setLineDash([6, 5]); c.lineWidth = 2;
      c.strokeRect(o.x + lx * s + 3, o.y + ly * s + 3, s - 6, s - 6); c.setLineDash([]);
    }
    const line = f.at * s;
    c.strokeStyle = col; c.lineWidth = kind === 'hint' ? 5 : 4; c.shadowColor = 'rgba(40,20,10,0.4)'; c.shadowBlur = 6;
    c.beginPath(); if (f.axis === 'x') { c.moveTo(o.x + line, o.y - 14); c.lineTo(o.x + line, o.y + p.h * s + 14); } else { c.moveTo(o.x - 14, o.y + line); c.lineTo(o.x + p.w * s + 14, o.y + line); } c.stroke();
    // an arc arrow across the line showing the way the paper turns
    const mid = f.axis === 'x' ? { x: o.x + line, y: o.y - 22 } : { x: o.x - 22, y: o.y + line }, R = Math.min(s * 0.7, 46), dir = f.low ? 1 : -1;
    c.lineWidth = 3.5; c.beginPath();
    if (f.axis === 'x') { c.moveTo(mid.x - dir * R, mid.y + 8); c.quadraticCurveTo(mid.x, mid.y - R * 0.8, mid.x + dir * R, mid.y + 8); }
    else { c.moveTo(mid.x + 8, mid.y - dir * R); c.quadraticCurveTo(mid.x - R * 0.8, mid.y, mid.x + 8, mid.y + dir * R); }
    c.stroke();
    const tip = f.axis === 'x' ? { x: mid.x + dir * R, y: mid.y + 8, a: dir > 0 ? 0.9 : Math.PI - 0.9 } : { x: mid.x + 8, y: mid.y + dir * R, a: dir > 0 ? Math.PI / 2 + 0.6 : -Math.PI / 2 - 0.6 };
    c.fillStyle = col; c.beginPath(); c.moveTo(tip.x + Math.cos(tip.a) * 10, tip.y + Math.sin(tip.a) * 10); c.lineTo(tip.x + Math.cos(tip.a + 2.4) * 10, tip.y + Math.sin(tip.a + 2.4) * 10); c.lineTo(tip.x + Math.cos(tip.a - 2.4) * 10, tip.y + Math.sin(tip.a - 2.4) * 10); c.fill();
    c.restore();
  }

  /** The target, pinned to a little card. */
  drawCard() {
    const t = this.target; if (!t) return;
    const c = this.c, K = this.layout.card;
    c.save(); c.translate(K.x + K.w / 2, K.y + K.h / 2); c.rotate(0.025); c.translate(-K.w / 2, -K.h / 2);
    c.fillStyle = 'rgba(60,35,20,0.25)'; c.fillRect(5, 7, K.w, K.h);
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, K.w, K.h);
    const g = grain(c); if (g) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.4; c.fillStyle = g; c.fillRect(0, 0, K.w, K.h); c.restore(); }
    c.fillStyle = '#d9483b'; c.beginPath(); c.arc(K.w / 2, 8, 6, 0, TAU); c.fill();
    c.fillStyle = '#6a4a35'; c.font = `700 ${Math.round(Math.max(11, K.w * 0.075))}px "Trebuchet MS", system-ui, sans-serif`; c.textAlign = 'center';
    c.fillText('MAKE THIS', K.w / 2, K.h * 0.16 + 6);
    const pad = K.w * 0.12, avail = { w: K.w - pad * 2, h: K.h * 0.72 - pad };
    const s = Math.min(avail.w / t.w, avail.h / t.h, K.w * 0.32);
    drawPicture(c, t, (K.w - t.w * s) / 2, K.h * 0.24 + (avail.h - t.h * s) / 2, s);
    c.restore();
  }
}

// ---- the festival: the backdrop with every finished piece in its place
/** A fixed place in the festival for every page: lanterns hang from the strings, boats float on the pond, cranes
 * fly in the middle sky, stars sit high, and the night's pieces join wherever they belong. */
export function festivalSpot(id: string, W: number, H: number) {
  const i = PUZZLES.findIndex((p) => p.id === id), p = PUZZLES[i], r = rng(100 + i);
  const k = i % 8;
  switch (p.piece) {
    case 'lantern': { const row = k % 3, x = 0.08 + ((k * 0.37 + row * 0.11 + (p.chapter === 'night' ? 0.17 : 0)) % 0.86); return { x: W * x, y: H * (0.16 + row * 0.08) + Math.sin(x * 9) * H * 0.02, s: H * 0.07 }; }
    case 'boat': return { x: W * (0.1 + ((k * 0.29 + (p.chapter === 'night' ? 0.13 : 0)) % 0.8)), y: H * (0.8 + (k % 3) * 0.05), s: H * 0.07 };
    case 'crane': return { x: W * (0.1 + ((k * 0.31 + 0.05 + (p.chapter === 'night' ? 0.2 : 0)) % 0.82)), y: H * (0.42 + (k % 3) * 0.07 + r() * 0.03), s: H * 0.065 };
    case 'star': return { x: W * (0.06 + ((k * 0.33 + 0.02 + (p.chapter === 'night' ? 0.15 : 0)) % 0.88)), y: H * (0.04 + (k % 3) * 0.045), s: H * 0.045 };
    case 'moon': return p.id === 'n8' ? { x: W * 0.84, y: H * 0.12, s: H * 0.1 } : { x: W * 0.62, y: H * 0.08, s: H * 0.06 };
    case 'fish': return { x: W * (0.3 + k * 0.06), y: H * 0.9, s: H * 0.06 };
  }
}

export function drawFestival(c: CanvasRenderingContext2D, W: number, H: number, done: string[], t: number, lit: number, fresh?: string, freshT = 1) {
  const bg = art('backdrop');
  if (bg) { const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight); c.drawImage(bg, (W - bg.naturalWidth * k) / 2, (H - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k); }
  else paintBackdrop(c, W, H);
  if (lit > 0) { c.fillStyle = `rgba(10,10,40,${0.35 * lit})`; c.fillRect(0, 0, W, H); }
  for (const id of done) {
    const p = puzzle(id), sp = festivalSpot(id, W, H);
    let { x, y } = sp; const s = sp.s;
    const sway = p.piece === 'boat' || p.piece === 'fish' ? Math.sin(t * 1.4 + x) * 3 : Math.sin(t * 1.1 + x * 0.01) * 4;
    if (id === fresh && freshT < 1) { const e = 1 - Math.pow(1 - freshT, 3); x = W / 2 + (x - W / 2) * e; y = H * 0.6 + (y - H * 0.6) * e; }
    drawPiece(c, p.piece, p.front, p.back, x, y + sway, s, lit, t);
  }
}

/** The festival meadow in cut paper, for when the painting is missing. */
export function paintBackdrop(c: CanvasRenderingContext2D, W: number, H: number) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b2d6e'); g.addColorStop(0.55, '#7a5aa6'); g.addColorStop(1, '#e8a77a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(5);
  c.fillStyle = 'rgba(255,245,220,0.8)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * W, r() * H * 0.4, 1 + r() * 1.5, 0, TAU); c.fill(); }
  const hill = (y: number, col: string, amp: number, ph: number) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W + 20; x += 20) c.lineTo(x, H * y + Math.sin(x / W * 5 + ph) * amp * H + Math.sin(x * 0.3) * 1.5); c.lineTo(W, H); c.fill(); };
  hill(0.56, '#4b5e8a', 0.03, 1); hill(0.62, '#3e6b5c', 0.025, 2.4);
  c.fillStyle = '#3a6fa0'; c.fillRect(0, H * 0.72, W, H * 0.28);
  c.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 12; i++) c.fillRect(r() * W, H * (0.75 + r() * 0.22), 20 + r() * 60, 2);
  c.strokeStyle = '#3b2a20'; c.lineWidth = Math.max(2, W * 0.003);
  for (const [x0, x1, y] of [[0.02, 0.98, 0.14], [0.02, 0.98, 0.22], [0.02, 0.98, 0.3]]) { c.beginPath(); c.moveTo(W * x0, H * y); c.quadraticCurveTo(W / 2, H * (y + 0.06), W * x1, H * y); c.stroke(); }
  c.fillStyle = '#5a3d28'; c.fillRect(W * 0.015, H * 0.1, W * 0.012, H * 0.62); c.fillRect(W * 0.973, H * 0.1, W * 0.012, H * 0.62);
}

/** The title stand-in: the festival backdrop with a lantern, a boat and the two of them in cut paper. */
export function paintTitle(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return; const W = cv.width, H = cv.height;
  paintBackdrop(c, W, H);
  drawPiece(c, 'lantern', 'red', 'gold', W * 0.3, H * 0.3, H * 0.12, 0.6);
  drawPiece(c, 'boat', 'blue', 'white', W * 0.6, H * 0.84, H * 0.1);
  drawPiece(c, 'crane', 'white', 'pink', W * 0.75, H * 0.4, H * 0.1);
  c.save(); c.translate(W * 0.18, H * 0.95); drawPaperChin(c, 'dora', 'delighted', H * 0.36, 0); c.restore();
  c.save(); c.translate(W * 0.4, H * 0.95); drawPaperChin(c, 'enzo', 'curious', H * 0.4, 0); c.restore();
}
export function paintEnding(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return; const W = cv.width, H = cv.height;
  paintBackdrop(c, W, H); c.fillStyle = 'rgba(10,10,40,0.35)'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) drawPiece(c, 'lantern', (['red', 'gold', 'pink', 'orange'] as Colour[])[i % 4], 'gold', W * (0.08 + i * 0.105), H * (0.18 + (i % 2) * 0.06), H * 0.06, 1);
  for (let i = 0; i < 4; i++) drawPiece(c, 'boat', 'white', 'blue', W * (0.15 + i * 0.22), H * (0.84 + (i % 2) * 0.05), H * 0.06, 1);
  c.save(); c.translate(W * 0.44, H * 0.78); drawPaperChin(c, 'dora', 'delighted', H * 0.24, 0); c.restore();
  c.save(); c.translate(W * 0.56, H * 0.78); drawPaperChin(c, 'enzo', 'delighted', H * 0.27, 0); c.restore();
}

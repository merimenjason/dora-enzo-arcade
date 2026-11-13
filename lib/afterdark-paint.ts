// The Arcade After Dark: painting each world in world units (the caller sets the transform). Paintings and sprites come
// from public/art/after-dark; code draws only effects (rings, arcs, wind, glints, light pools, the dark water, the
// Static's shimmer). Ported from the prototype's render.js, scenes.js, scenes2.js and boss.js. Reads the engine, never
// changes it (a snapshot hides the heroes for a moment and puts them back).
import { PX } from './afterdark-art.js';
import { FR, FRraw, fsize, TUNNEL, DOOR, type Static, type World, type WorldId, type Pearl } from './afterdark-worlds.js';
import { type Game, type Hero, lead, partner, clamp, lerp, TAU, entryOf } from './afterdark-core.js';
import { cabScreen, portalOpen, hopTarget, hubSuggestion, goal } from './afterdark-flow.js';
import { webActive } from './afterdark-move.js';
import { bossNeed, bossCore } from './afterdark-boss.js';
import { heroFrame } from './afterdark-game.js';

type C = CanvasRenderingContext2D;
export interface V { cx: number; cy: number; Vw: number; Vh: number }
/** what the painters draw with: the game, the atlases and the paintings (set by the scene before each frame) */
export const P = { g: null as unknown as Game, atl: {} as Record<string, HTMLImageElement>, img: {} as Record<string, HTMLImageElement>, snaps: new WeakMap<object, HTMLCanvasElement>() };
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export { ease };
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ───────────── frames
/** a frame with its anchor at x, y in the current transform */
export function drawFrame(c: C, n: string, x: number, y: number, face = 1, sx = 1, sy = 1, alpha = 1) {
  const f = FR(n); if (!f) return;
  const im = P.atl[f[0]]; if (!im) return;
  const k = 1 / PX;
  c.save(); c.translate(x, y); c.scale(face * sx, sy);
  if (alpha < 1) c.globalAlpha *= alpha;
  c.drawImage(im, f[1], f[2], f[3], f[4], -f[5] * k, -f[6] * k, f[3] * k, f[4] * k);
  c.restore();
}
/** a frame stretched into a rect (statics and UI) */
export function drawFrameRect(c: C, n: string, x: number, y: number, w: number, h: number, alpha = 1) {
  const f = FR(n); if (!f) return; const im = P.atl[f[0]]; if (!im) return;
  if (alpha < 1) { c.save(); c.globalAlpha *= alpha; }
  c.drawImage(im, f[1], f[2], f[3], f[4], x, y, w, h);
  if (alpha < 1) c.restore();
}
function drawFrameSlice(c: C, n: string, sy0: number, sy1: number, x: number, y: number, w: number, h: number) {
  const f = FR(n); if (!f) return; const im = P.atl[f[0]]; if (!im) return;
  const fy = f[2] + f[4] * sy0, fh = Math.max(1, f[4] * (sy1 - sy0));
  c.drawImage(im, f[1], fy, f[3], fh, x, y, w, h);
}
export function roundRect(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** a four-point glint */
export function glint(c: C, x: number, y: number, s: number, a: number, col = '#fff6d8') {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.fillStyle = col;
  c.beginPath();
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s * 0.28, y); c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s * 0.28, y); c.quadraticCurveTo(x, y, x, y - s);
  c.moveTo(x - s * 0.7, y); c.quadraticCurveTo(x, y, x, y - s * 0.2); c.quadraticCurveTo(x, y, x + s * 0.7, y);
  c.quadraticCurveTo(x, y, x, y + s * 0.2); c.quadraticCurveTo(x, y, x - s * 0.7, y);
  c.fill();
  const gr = c.createRadialGradient(x, y, 0, x, y, s * 0.8); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,240,200,0)');
  c.globalAlpha = a * 0.5; c.fillStyle = gr; c.beginPath(); c.arc(x, y, s * 0.8, 0, TAU); c.fill();
  c.restore();
}
export function lightPool(c: C, x: number, y: number, r: number, col: string, a: number) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
  const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
export function blink(t: number, ph: number, per = 2.6) { const q = ((t + ph) % per) / per; return q < 0.25 ? Math.sin(q / 0.25 * Math.PI) : 0; }

// a painting tiled left to right, every other copy mirrored so the seams match
function mirrorTiles(c: C, im: HTMLImageElement | undefined, x0: number, y: number, h: number, from: number, to: number) {
  if (!im) return;
  const tw = im.width * h / im.height;
  let i = Math.floor((from - x0) / tw);
  for (let x = x0 + i * tw; x < to; x += tw, i++) {
    if (i % 2 === 0) c.drawImage(im, x, y, tw + 1, h);
    else { c.save(); c.translate(x + tw, y); c.scale(-1, 1); c.drawImage(im, 0, 0, tw + 1, h); c.restore(); }
  }
}
function tiles(c: C, im: HTMLImageElement | undefined, y: number, tw: number, from: number, to: number) {
  if (!im) return;
  const th = im.height * tw / im.width;
  for (let x = Math.floor(from / tw) * tw; x < to; x += tw) c.drawImage(im, x, y, tw + 1, th);
}
const prop = (c: C, p: { n: string; x: number; y: number; s?: number }) => { const s = p.s || 1; drawFrame(c, p.n, p.x, p.y, 1, s, s); };
const wallProp = (c: C, p: { n: string; x: number; y: number }) => { const [, h] = fsize(p.n); drawFrame(c, p.n, p.x, p.y + h, 1); };

// ───────────── the Static: painted texture frames, shimmered in slices by code
export function drawStatic(c: C, st0: Static, t: number) {
  const a = st0.alive ? 1 : 1 - st0.dis;
  if (a <= 0) return;
  const creep = st0.kind === 'wall' && st0.alive ? 10 + 10 * Math.sin(t * 0.8 + st0.seed) : 0;
  const w = st0.x1 - st0.x0 + creep, h = st0.y1 - st0.y0;
  const st = { ...st0, x0: st0.x0 - creep };
  const tick = Math.floor(t * 12);
  const base = st.kind === 'wall' ? (st.seed % 2 ? 'stwall1' : 'stwall2') : st.kind === 'drift' ? (st.seed % 2 ? 'stdrift1' : 'stdrift2') : ['st1', 'st2', 'st3', 'st4'][(st.seed + Math.floor(t * 5)) % 4];
  const spread = st.alive ? 1 : 1 + st.dis * 40;
  c.save(); c.globalAlpha = a * (st.kind === 'wall' && P.g.world === 'hub' ? 0.86 : 1);
  const rows = st.kind === 'drift' ? 3 : 9;
  for (let i = 0; i < rows; i++) {
    const j = (hash(i + st.seed, tick) - 0.5) * 7 * spread;
    drawFrameSlice(c, base, i / rows, (i + 1) / rows, st.x0 - 12 + j, st.y0 + h * i / rows, w + 24, h / rows + 1.5);
  }
  if (st.kind === 'wall') {   // living clumps crawl along the top edge
    const cl = ['st1', 'st2', 'st3', 'st4'][(st.seed + Math.floor(t * 5)) % 4];
    drawFrameRect(c, cl, st.x0 - 30 + Math.sin(t * 2 + st.seed) * 6, st.y0 - 60, w + 60, 120, 0.9);
  }
  // glitter and a rolling scanline
  c.globalCompositeOperation = 'lighter';
  const n = Math.min(40, Math.ceil(w * h / 2500));
  for (let i = 0; i < n; i++) {
    const q = hash(i + st.seed * 3, tick);
    if (q < 0.55) continue;
    c.fillStyle = q > 0.85 ? 'rgba(255,255,255,.9)' : 'rgba(200,180,255,.7)';
    const s = 2 + (q - 0.55) * 9;
    c.fillRect(st.x0 + hash(i, tick + 7) * w, st.y0 + hash(i, tick + 9) * h, s, s);
  }
  const sl = st.y0 + ((t * 160 + st.seed) % h);
  c.fillStyle = 'rgba(220,210,255,.18)'; c.fillRect(st.x0, sl, w, 3);
  c.restore();
}

// a cabinet-screen portal inside a world: a glowing frame with scanlines
function drawPortal(c: C, x: number, y: number, t: number, a = 1) {
  const w = 120, h = 165;
  c.save(); c.globalAlpha = a;
  const gr = c.createLinearGradient(x, y - h / 2, x, y + h / 2);
  gr.addColorStop(0, 'rgba(120,230,255,.55)'); gr.addColorStop(1, 'rgba(60,40,150,.55)');
  roundRect(c, x - w / 2, y - h / 2, w, h, 18); c.fillStyle = gr; c.fill();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(200,240,255,${0.06 + 0.05 * Math.sin(t * 6 + i)})`; c.fillRect(x - w / 2 + 6, y - h / 2 + ((i * 14 + t * 40) % h), w - 12, 2); }
  c.lineWidth = 6 + Math.sin(t * 4) * 2; c.strokeStyle = 'rgba(255,236,170,.85)'; roundRect(c, x - w / 2, y - h / 2, w, h, 18); c.stroke();
  c.lineWidth = 16; c.strokeStyle = 'rgba(255,220,140,.18)'; c.stroke();
  c.restore();
  glint(c, x + w / 2 - 6, y - h / 2 + 8, 16, 0.5 + 0.5 * Math.sin(t * 3));
}

// ───────────── heroes
function drawHero(c: C, h: Hero, w: World, t: number) {
  if (h.hidden) return;
  const swim = w.kind === 'swim';
  if (!swim && h.sc > 0.9 && h.ground) {   // soft contact shadow
    c.save(); c.globalAlpha = 0.28; c.fillStyle = '#100820';
    c.beginPath(); c.ellipse(h.x, h.y + 2, 52, 11, 0, 0, TAU); c.fill(); c.restore();
  }
  let sx = h.sc, sy = h.sc;
  if (h.landT > 0) { sx *= 1.07; sy *= 0.93; }
  else if (!swim && h.ground && Math.abs(h.vx) < 10 && h.abilT <= 0) sy *= 1 + 0.014 * Math.sin(t * 2.6 + (h.name === 'dora' ? 0 : 1.3));
  let a = h.alpha;
  if (h.invT > 0 && h.hurtT <= 0 && Math.floor(t * 18) % 2) a *= 0.45;
  const bob = swim ? Math.sin(t * 2.2 + (h.name === 'dora' ? 0 : 1.7)) * 4 : 0;
  drawFrame(c, heroFrame(P.g, h, w), h.x, h.y + bob, h.face, sx, sy, a);
}
function drawHeroes(c: C, w: World, t: number) { drawHero(c, partner(P.g), w, t); drawHero(c, lead(P.g), w, t); }

// ───────────── effects
function drawRings(c: C, wid: string) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const r of P.g.rings) {
    if (r.w !== wid || r.d > 0) continue;
    const p = r.r / r.max, a = 1 - p;
    c.strokeStyle = `rgba(110,240,230,${0.75 * a})`; c.lineWidth = 9 * (1 - p) + 2;
    c.beginPath(); c.arc(r.x, r.y, r.r, 0, TAU); c.stroke();
    c.strokeStyle = `rgba(200,255,250,${0.5 * a})`; c.lineWidth = 2;
    c.beginPath(); c.arc(r.x, r.y, Math.max(0, r.r - 14), 0, TAU); c.stroke();
    c.strokeStyle = `rgba(80,220,230,${0.18 * a})`; c.lineWidth = 26 * (1 - p);
    c.beginPath(); c.arc(r.x, r.y, r.r, 0, TAU); c.stroke();
  }
  c.restore();
}
function drawArcs(c: C, wid: string) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const a of P.g.arcs) {
    if (a.w !== wid) continue;
    const p = a.t / 0.55, R = 70 + 200 * easeOut(p), al = 1 - p;
    const s = a.face > 0 ? -1.15 : Math.PI - 1.15, e = a.face > 0 ? 1.15 : Math.PI + 1.15;
    for (const [lw, col] of [[34, `rgba(255,190,80,${0.25 * al})`], [16, `rgba(255,220,130,${0.7 * al})`], [5, `rgba(255,255,230,${al})`]] as const) {
      c.strokeStyle = col; c.lineWidth = lw * (1 - p * 0.5); c.beginPath(); c.arc(a.x - a.face * 40, a.y, R, s, e); c.stroke();
    }
  }
  c.restore();
}
// the gust: curling white wind lines that rush forward
function drawGusts(c: C, wid: string) {
  c.save(); c.lineCap = 'round';
  for (const q of P.g.gusts) {
    if (q.w !== wid) continue;
    const p = q.t / 0.7, a = 1 - p;
    for (let i = 0; i < 6; i++) {
      const y = q.y + (i - 2.5) * 46 + Math.sin(i * 2.3) * 12, x0 = q.x + q.face * (p * 380 + i * 14), len = 120 + 60 * Math.sin(i);
      c.strokeStyle = `rgba(255,255,255,${0.75 * a})`; c.lineWidth = 7 * (1 - p * 0.6);
      c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(x0 + q.face * len * 0.5, y - 24, x0 + q.face * len, y);
      c.arc(x0 + q.face * len - q.face * 14, y - 14, 14, Math.PI / 2, q.face > 0 ? -Math.PI : Math.PI * 2, q.face < 0); c.stroke();
      c.strokeStyle = `rgba(190,230,255,${0.25 * a})`; c.lineWidth = 18; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(x0 + q.face * len * 0.5, y - 24, x0 + q.face * len, y); c.stroke();
    }
  }
  c.restore();
}
function drawParts(c: C, wid: string) {
  c.save();
  for (const p of P.g.parts) {
    if (p.w !== wid) continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'bubble') {
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.55 * a;
      c.strokeStyle = '#dff8ff'; c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.stroke();
      c.globalAlpha = 0.5 * a; c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, TAU); c.fill();
    } else if (p.kind === 'streak' || p.kind === 'lift') {   // wind: thin moving lines
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.45 * Math.sin(Math.PI * a);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath();
      if (p.kind === 'streak') { c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x - Math.sign(p.vx) * p.size * 2, p.y - 6, p.x - Math.sign(p.vx) * p.size * 4, p.y); }
      else { c.moveTo(p.x, p.y); c.lineTo(p.x, p.y + p.size * 2.5); }
      c.stroke();
    } else if (p.kind === 'pix') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
      c.fillStyle = p.life / p.max > 0.5 ? p.col : '#ffd98a'; c.fillRect(p.x, p.y, p.size, p.size);
    } else {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); c.fill();
    }
  }
  c.restore();
}
// dark water: a dim veil with soft holes around the heroes and anything lit (drawn over the painted world)
let DARK: HTMLCanvasElement | null = null;
function drawDark(c: C, w: World, Vv: V) {
  const d = w.dark; if (!d) return;
  if (!DARK) { DARK = document.createElement('canvas'); DARK.width = 320; DARK.height = 180; }
  const left = Vv.cx - Vv.Vw / 2, top = Vv.cy - Vv.Vh / 2;
  const fade = (x: number) => clamp(Math.min(x - d.x0, d.x1 - x) / 260, 0, 1);
  if (fade(left) <= 0 && fade(left + Vv.Vw) <= 0 && (left > d.x1 || left + Vv.Vw < d.x0)) return;
  const q = DARK.getContext('2d')!, sx = DARK.width / Vv.Vw, sy = DARK.height / Vv.Vh;
  q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, DARK.width, DARK.height); q.globalCompositeOperation = 'source-over';
  const grd = q.createLinearGradient(0, 0, DARK.width, 0);
  for (let i = 0; i <= 8; i++) grd.addColorStop(i / 8, `rgba(3,10,30,${0.86 * fade(left + Vv.Vw * i / 8)})`);
  q.fillStyle = grd; q.fillRect(0, 0, DARK.width, DARK.height);
  q.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, s = 1) => { const X = (x - left) * sx, Y = (y - top) * sy, R = Math.max(1, r * sx); const rg = q.createRadialGradient(X, Y, 0, X, Y, R); rg.addColorStop(0, `rgba(0,0,0,${s})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = rg; q.beginPath(); q.arc(X, Y, R, 0, TAU); q.fill(); };
  const L0 = lead(P.g), P0 = partner(P.g);
  if (!L0.hidden) hole(L0.x, L0.y, 210); if (!P0.hidden) hole(P0.x, P0.y, 130, 0.7);
  for (const cr of w.crystals) if (cr.lit) hole(cr.x, cr.y - 60, 280 * clamp(cr.lit * 2, 0, 1));
  for (const j of w.jellies) hole(j.x, j.y, 80, 0.55);
  for (const r of P.g.rings) if (r.w === w.id && r.d <= 0) hole(r.x, r.y, r.r + 40, 0.5 * (1 - r.r / r.max));
  for (const p of w.pearls) if (p.revealed && !p.got) hole(p.x, p.y, 70, 0.6);
  if (w.anchor && w.anchor.found) hole(w.anchor.x - 40, w.anchor.y, 260, 0.7);
  for (const pt of w.portals) if (pt.open && (pt.id !== 'out' || pt.t === undefined || pt.t > 0)) hole(pt.x, pt.y, 150, 0.8);
  if (w.mound) hole(w.mound.x, w.mound.y - 60, 110, 0.45);
  c.drawImage(DARK, left, top, Vv.Vw, Vv.Vh);
}

// ───────────── each world
export function renderWorld(c: C, wid: WorldId, Vv: V) {
  const w = P.g.W[wid], t = P.g.time;
  const left = Vv.cx - Vv.Vw / 2, right = Vv.cx + Vv.Vw / 2;
  c.fillStyle = ({ hub: '#1a1030', sea: '#0e3a5c', deep: '#06182c', castle: '#3a2a3c', room: '#2a1c2a', cloud: '#9cc8ee' } as const)[wid];
  c.fillRect(left - 10, -400, Vv.Vw + 20, 1600);
  if (wid === 'hub') drawHub(c, w, t);
  else if (wid === 'sea' || wid === 'deep') drawSea(c, w, t, Vv, left, right);
  else if (wid === 'castle') drawCastle(c, w, t, left, right);
  else if (wid === 'cloud') drawCloud(c, w, t, Vv, left, right);
  else drawRoom(c, w, t);
  drawRings(c, wid); drawArcs(c, wid); drawGusts(c, wid); drawParts(c, wid);
  if (wid === 'sea' || wid === 'deep') {   // underwater light: soft moving rays over everything, then the dark water
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = left + ((i * 397 + t * 14) % (Vv.Vw + 400)) - 200, a = (0.05 + 0.03 * Math.sin(t * 0.7 + i)) * (wid === 'deep' ? 0.3 : 1);
      const gr = c.createLinearGradient(x, 0, x + 200, 700); gr.addColorStop(0, `rgba(200,250,255,${a})`); gr.addColorStop(1, 'rgba(200,250,255,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 90, 0); c.lineTo(x + 330, 720); c.lineTo(x + 170, 720); c.fill();
    }
    c.restore();
    drawDark(c, w, Vv);
    if (wid === 'deep') drawNeedBubble(c, w, t);
  }
}

// a platform: its painting stretched to the platform's width
const SURF: Record<string, number> = { 'terrace-long': 0.16, 'terrace-mid': 0.16, disc: 0.12, puff: 0.2, 'ledge-long': 0.06, 'ledge-short': 0.06 };
function drawPlat(c: C, n: string, x0: number, x1: number, y: number) {
  const [fw, fh] = fsize(n), s = (x1 - x0) / fw;
  drawFrame(c, n, (x0 + x1) / 2, y - (SURF[n] || 0.1) * fh * s + fh * s, 1, s, s);
}
function drawPearl(c: C, p: Pearl, t: number) {
  if (p.got) return;
  if (p.revealed) { lightPool(c, p.x, p.y, 70, 'rgba(220,255,255,.6)', 0.55 + 0.3 * Math.sin(t * 4)); const [, ph] = fsize('pearl'); drawFrame(c, 'pearl', p.x, p.y + ph / 2 + Math.sin(t * 2.4 + p.x) * 4, 1, 1, 1, clamp(p.t * 2 + 0.01, 0, 1)); glint(c, p.x + 12, p.y - 14, 10, blink(t, p.x * 0.01, 2)); }
  else glint(c, p.x, p.y, 8, blink(t, p.x * 0.01, 4.5) * 0.35, '#d8fffa');
}
function drawPortalsOf(c: C, w: World, t: number) {
  for (const pt of w.portals) {
    if (pt.door || !portalOpen(P.g, w, pt)) continue;
    drawPortal(c, pt.x, pt.y, t, pt.t !== undefined ? clamp(pt.t * 2, 0, 1) : 1);
    const hop = pt.id !== 'in' ? hopTarget(P.g, w, pt) : null;   // a hop portal shows the next cabinet's world on its screen
    if (hop) { const cb = P.g.W.hub.cabs!.find((k) => k.id === hop)!; drawFrame(c, cb.n, pt.x, pt.y + 120, 1, 0.3, 0.3, 0.95); glint(c, pt.x + 40, pt.y - 70, 16, blink(t, 0, 1.4)); }
  }
}

// ───────────── hub: the arcade floor at night
function drawHub(c: C, w: World, t: number) {
  const g = P.g;
  if (P.img['hub-bg']) c.drawImage(P.img['hub-bg'], 0, 720 - 853, 1280, 853);
  const heal = g.healT >= 0 ? clamp(g.healT / 2.5, 0, 1) : 0;
  c.fillStyle = `rgba(18,8,48,${0.22 * (1 - heal)})`; c.fillRect(-50, -200, 1400, 1000);
  if (heal < 1 && w.statics.some((s) => s.alive && s.kind === 'wall')) {   // where the Static has eaten the floor, the colour drains away
    const edge = Math.min(...w.statics.filter((s) => s.kind === 'wall').map((s) => (s.alive ? s.x0 : 1400)));
    const gr = c.createLinearGradient(edge - 160, 0, edge + 60, 0);
    gr.addColorStop(0, 'rgba(60,50,90,0)'); gr.addColorStop(1, `rgba(60,50,90,${0.45 * (1 - heal)})`);
    c.fillStyle = gr; c.fillRect(edge - 160, -200, 1600, 1000);
  }
  if (g.boss) { c.fillStyle = 'rgba(40,20,80,.25)'; c.fillRect(-50, -200, 1400, 1000); }
  const sug = g.boss ? null : hubSuggestion(g);
  for (const cb of w.cabs!) {
    const [cw, ch] = fsize(cb.n), s = cabScreen(cb);
    if (cb.live || heal > 0) {   // the screen's light spills onto the carpet like an open doorway
      const a = (cb.live && cb.target ? (cb === sug ? 0.7 : 0.3) : 0.35 * heal) * (0.85 + 0.15 * Math.sin(t * 2.2 + cb.x));
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
      const col = cb.id === 'sea' ? '90,200,255' : cb.id === 'cloud' ? '200,220,255' : '255,190,90';
      const gr = c.createLinearGradient(0, cb.y - 20, 0, 720);
      gr.addColorStop(0, `rgba(${col},.55)`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.beginPath(); c.moveTo(cb.x - cw * 0.32, cb.y - 10); c.lineTo(cb.x + cw * 0.32, cb.y - 10); c.lineTo(cb.x + cw * 0.62, 720); c.lineTo(cb.x - cw * 0.62, 720); c.fill();
      c.restore();
      lightPool(c, s.x + s.w / 2, s.y + s.h / 2, s.w * 1.1, `rgba(${col},.5)`, a * 0.8);
    }
    c.save();
    if (cb.wob > 0) { c.translate(cb.x, cb.y); c.rotate(Math.sin(cb.wob * 40) * cb.wob * 0.05); c.translate(-cb.x, -cb.y); }
    drawFrame(c, cb.n, cb.x, cb.y);
    if (!cb.live) { c.fillStyle = `rgba(14,10,30,${0.62 * (1 - heal)})`; c.fillRect(s.x, s.y, s.w, s.h); }
    else {
      const strong = cb === sug ? 1 : 0.35;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,240,210,${(0.06 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3.2))) * strong})`; c.fillRect(s.x, s.y, s.w, s.h);
      c.globalCompositeOperation = 'source-over';
      if (cb === sug) {
        c.lineWidth = 5 + 3 * Math.sin(t * 3.2); c.strokeStyle = `rgba(255,226,150,${0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3.2))})`;
        roundRect(c, s.x - 5, s.y - 5, s.w + 10, s.h + 10, 10); c.stroke();
        glint(c, s.x + s.w - 10, s.y + 12, 20, blink(t, 0, 1.6));
      }
    }
    const T = g.trans;   // the dive: the destination world shows through the screen
    if (T && (T.kind === 'dive' || T.kind === 'exit') && T.cab === cb) {
      const snap = P.snaps.get(T);
      if (snap) {
        const a = T.kind === 'dive' ? clamp((T.t - 0.25) / 0.7, 0, 1) : 1 - clamp((T.t - 0.45) / 0.6, 0, 1);
        c.globalAlpha = a; c.drawImage(snap, s.x, s.y, s.w, s.h); c.globalAlpha = 1;
        c.fillStyle = 'rgba(0,0,0,.12)'; for (let y = s.y; y < s.y + s.h; y += 4) c.fillRect(s.x, y, s.w, 1.5);
      }
    }
    c.restore();
    // the next cabinet always calls: a beam of its light from the ceiling and a bobbing glint over it
    if (cb === sug && g.mode === 'play' && !g.trans) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const gr = c.createLinearGradient(0, -100, 0, cb.y - ch); gr.addColorStop(0, 'rgba(255,230,160,0)'); gr.addColorStop(1, `rgba(255,230,160,${0.22 + 0.08 * Math.sin(t * 3)})`);
      c.fillStyle = gr; c.beginPath(); c.moveTo(cb.x - 40, -100); c.lineTo(cb.x + 40, -100); c.lineTo(cb.x + cw * 0.45, cb.y - ch + 20); c.lineTo(cb.x - cw * 0.45, cb.y - ch + 20); c.fill(); c.restore();
      glint(c, cb.x, cb.y - ch - 40 + Math.sin(t * 3) * 10, 30, 0.65 + 0.35 * Math.sin(t * 4), '#fff1c0');
    }
    const by = cb.y - ch + 60 + Math.sin(t * 2) * 5;
    if (cb.id === 'castle' && goal(g) === 'castle' && g.abil.ping && !g.flags.door && g.mode === 'play') thought(c, cb.x + 80, by, 1.15, 'ping', 1, t);
    if (cb.id === 'castle' && g.flags.castleBlocked && !g.abil.ping) thought(c, cb.x + 80, by, cb.bubble > 0 ? 1.4 : 1.15, 'conch', 1, t);
    if (cb.id === 'sea' && goal(g) === 'sea' && g.abil.gust && g.mode === 'play') thought(c, cb.x + 80, by, 1.15, 'gust', 1, t);
    if (cb.id === 'harbour' && cb.bubble > 0) thought(c, cb.x + 80, by, 1.1, 'zz', clamp(cb.bubble * 2, 0, 1), t);
  }
  for (const st of w.statics) if (st.kind === 'drift') drawStatic(c, st, t);
  drawBoss(c, t);
  drawHeroes(c, w, t);
  for (const st of w.statics) if (st.kind !== 'drift') drawStatic(c, st, t);
  if (heal > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = heal * (0.5 + 0.1 * Math.sin(t * 2)); lightPool(c, 640, 380, 900, 'rgba(255,190,120,.22)', 1); c.restore(); }
}

// ───────────── the sea and the Deep
function drawSea(c: C, w: World, t: number, Vv: V, left: number, right: number) {
  const g = P.g, im = P.img['sea-bg'];
  if (im) mirrorTiles(c, im, left * 0.6 - 100, -30, 790, left - 50, right + 50);
  if (w.id === 'deep') { c.fillStyle = 'rgba(4,14,40,.55)'; c.fillRect(left - 10, -100, Vv.Vw + 20, 900); }
  for (const p of w.props) if (p.l === 'back') prop(c, p);
  if (w.conch) {   // the conch shrine glows until it has given its gift
    const cn = w.conch;
    lightPool(c, cn.x, cn.y - 80, 190, 'rgba(255,230,170,.5)', cn.used ? 0.25 : 0.55 + 0.25 * Math.sin(t * 2.5));
    drawFrame(c, 'conch', cn.x, cn.y);
    if (!cn.used) glint(c, cn.x + 30, cn.y - 120, 20, blink(t, 0.3, 2.2));
  }
  if (w.pillar) {
    const p = w.pillar, [, ph] = fsize('pillar');
    if (!p.open) drawFrame(c, 'pillar', p.x, p.bottom);
    else {
      const q = clamp(p.t / 1.1, 0, 1);
      drawFrame(c, 'pillar', p.x, p.bottom, 1, 1, 1, 1 - q);
      drawFrame(c, 'pillar-open', p.x, p.bottom, 1, 1, 1, q);
      const ty = p.bottom - ph * (1 - TUNNEL.cy), tr = ph * TUNNEL.r;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(110,245,235,${0.35 + 0.3 * Math.sin(t * 3)})`; c.lineWidth = 6;
      c.beginPath(); c.ellipse(p.x, ty, tr * 0.9, tr * 1.05, 0, 0, TAU); c.stroke(); c.restore();
    }
    if (g.abil.ping && !p.open) glint(c, p.x - 10, p.bottom - ph * 0.45, 22, blink(t, 1.1, 2.4), '#b8fff6');
  }
  for (const cr of w.crystals) {
    const lit = cr.lit > 0;
    if (lit) lightPool(c, cr.x, cr.y - 60, 220, 'rgba(120,255,240,.7)', clamp(cr.lit * 2, 0, 1) * (0.7 + 0.2 * Math.sin(t * 3 + cr.x)));
    drawFrame(c, lit ? 'crystal-lit' : 'crystal', cr.x, cr.y + 20, 1, 0.9, 0.9);
    if (!lit) glint(c, cr.x, cr.y - 50, 12, blink(t, cr.x * 0.01, 3) * 0.6, '#b8fff6');
  }
  if (w.mound) {   // the sand mound over the sunken arch; the gust blows it away
    const m = w.mound;
    if (m.open) { drawFrame(c, 'arch-sunk', m.x, m.y + 30, 1, 0.8, 0.8, clamp(m.t, 0, 1)); lightPool(c, m.x, m.y - 100, 160, 'rgba(160,140,255,.6)', 0.5 + 0.2 * Math.sin(t * 3)); }
    drawFrame(c, 'mound', m.x + (m.open ? 220 * clamp(m.t * 1.5, 0, 1) : 0), m.y + 18, 1, 1, 1, m.open ? 1 - clamp(m.t * 1.5, 0, 1) : 1);
    if (!m.open && m.bubble > 0) thought(c, m.x - 140, m.y - 230 + Math.sin(t * 2) * 5, 1.2, g.abil.gust ? 'gust' : 'cloud', clamp(m.bubble * 3, 0, 1), t);
  }
  for (const pr of w.pearls) drawPearl(c, pr, t);
  for (const j of w.jellies) {
    const pink = j.n === 'jellyp', dim = j.stun > 0;
    const n = dim ? 'jelly-dim' : (Math.floor(t * 2 + j.ph) % 2 ? (pink ? 'jellyp2' : 'jelly2') : (pink ? 'jellyp1' : 'jelly1'));
    lightPool(c, j.x, j.y, 90, pink ? 'rgba(255,150,220,.5)' : 'rgba(120,240,255,.5)', dim ? 0.12 : 0.4);
    drawFrame(c, n, j.x, j.y + 50, j.face || 1);
    if (dim) for (let i = 0; i < 3; i++) glint(c, j.x + Math.cos(t * 5 + i * 2.1) * 34, j.y - 50 + Math.sin(t * 5 + i * 2.1) * 10, 8, 0.8, '#fff6c0');
  }
  if (w.anchor) drawAnchor(c, w, t);
  for (const pt of w.portals) if (pt.crystals) {   // the way out waits for every crystal: one little crystal per light
    const n = w.crystals.length, open = portalOpen(g, w, pt);
    if (!open) { c.save(); c.globalAlpha = 0.35; drawPortal(c, pt.x, pt.y, t, 0.5); c.restore(); }
    w.crystals.forEach((cr, i) => drawFrame(c, cr.lit ? 'crystal-lit' : 'crystal', pt.x + (i - (n - 1) / 2) * 44, pt.y - 100, 1, 0.32, 0.32));
  }
  drawPortalsOf(c, w, t);
  if (w.id === 'deep') { const b = w.portals[0]; drawPortal(c, b.x, b.y, t, 0.6); }
  for (const st of w.statics) drawStatic(c, st, t);
  drawHeroes(c, w, t);
  const fl = P.img['sea-floor'];
  if (fl) tiles(c, fl, 720 - fl.height * 1000 / fl.width * 0.78, 1000, left - 10, right + 10);
  for (const pp of w.props) if (pp.l === 'front') prop(c, pp);
}
function drawAnchor(c: C, w: World, t: number) {
  const a = w.anchor!;
  if (a.found && !a.gone) { lightPool(c, a.x - 40, a.y, 220, 'rgba(110,240,230,.8)', 0.6 + 0.3 * Math.sin(t * 5)); drawFrame(c, 'g-core', a.x - 40, a.y + 60 + Math.sin(t * 3) * 6, 1, 0.28, 0.28, 0.9); }
  for (const q of w.guards!) {
    if (!q.alive && (q.x < -200 || q.x > 1500)) continue;
    drawFrame(c, 'g-minion', q.x, q.y + 50, q.x < a.x ? 1 : -1, 0.3, 0.3, q.alive ? 1 : 0.6);
  }
  if (a.armT > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(200,180,255,${a.armT * 1.6})`; c.lineWidth = 8; c.beginPath(); c.arc(a.x, a.y, 230, 0, TAU); c.stroke(); c.restore(); }
}
// the wordless "who is needed" bubble over the anchor (the same tell the giant uses)
function drawNeedBubble(c: C, w: World, t: number) {
  const a = w.anchor, g = P.g; if (!a || a.gone || g.cut || g.mode !== 'play') return;
  const need = !a.found ? 'ping' : !a.bare ? 'gust' : 'sweep';
  if (!g.abil[need]) return;
  needBubble(c, a.x - 60, 330 + Math.sin(t * 2) * 6, need);
}
function needBubble(c: C, x: number, by: number, need: string) {
  const k = 1.3, t = P.g.time;
  drawFrame(c, 'bubble', x, by, 1, k, k, 0.96);
  const cx = x + 8 * k, cy = by - 92 * k + 36 * k, q = 1 + 0.05 * Math.sin(t * 5);
  const face = need === 'ping' ? 'face-enzo' : need === 'sweep' ? 'face-dora' : null;
  if (face) { drawFrame(c, face, cx - 26, cy, 1, 0.42 * q, 0.42 * q); drawFrame(c, 'ico-' + need, cx + 30, cy + 12, 1, 0.34, 0.34); }
  else drawFrame(c, 'ico-gust', cx, cy, 1, 0.6 * q, 0.6 * q);
}

// ───────────── the castle hall
function drawCastle(c: C, w: World, t: number, left: number, right: number) {
  const g = P.g;
  mirrorTiles(c, P.img['castle-bg'], 0, -140, 690, left - 10, right + 10);
  const fl = P.img['castle-floor'];
  if (fl) tiles(c, fl, 640 - fl.height * 1000 / fl.width * 0.55, 1000, left - 10, right + 10);
  for (const p of w.props) { if (p.l === 'wall') wallProp(c, p); else prop(c, p); }
  for (const p of w.props) if (p.n === 'candelabra' || p.n === 'sconce') lightPool(c, p.x, p.l === 'wall' ? p.y + 20 : p.y - 200, 200, 'rgba(255,200,120,.45)', 0.45 + 0.08 * Math.sin(t * 7 + p.x));
  if (w.pit) {   // the Static has eaten a stretch of floor: a violet glow rises from it
    const gr = c.createLinearGradient(0, 480, 0, 660); gr.addColorStop(0, 'rgba(150,120,255,0)'); gr.addColorStop(1, 'rgba(150,120,255,.35)');
    c.fillStyle = gr; c.fillRect(w.pit.x0, 480, w.pit.x1 - w.pit.x0, 180);
  }
  for (const b of w.blocks!) {
    const [, bh] = fsize('block');
    drawFrame(c, 'block', b.x, w.floor + 6);
    if (b.stack) drawFrame(c, 'block', b.x, w.floor + 10 - bh);
  }
  for (const p of w.plats) drawPlat(c, p.n!, p.x0, p.x1, p.y);
  for (const m of w.swings) {   // chandeliers on long chains, swinging over the pit
    const [cw, ch] = fsize('chandelier'), s = (m.half * 2.2) / cw;
    c.save(); c.translate(m.px, m.py); c.rotate(-m.ang);
    const f = FR('chandelier')!, im = P.atl[f[0]];   // its own painted chain, repeated up to the ceiling
    if (im) { const sw = f[3] * 0.07, sh = f[4] * 0.1, dw = sw / PX * s, dh = sh / PX * s; for (let y = -60; y < m.len - ch * s * 0.2; y += dh - 1) c.drawImage(im, f[1] + f[3] * 0.465, f[2] + 2, sw, sh, -dw / 2, y, dw, dh); }
    c.translate(0, m.len);
    drawFrame(c, 'chandelier', 0, ch * s * 0.78, 1, s, s); c.restore();
    lightPool(c, m.x, m.y - 30, 160, 'rgba(255,210,130,.5)', 0.5);
  }
  for (const a of w.armours!) {
    const [, ah] = fsize('arm-walk1'), s = a.h / ah;
    const n = a.daze > 0 ? 'arm-dazed' : a.turn > 0 ? 'arm-turn' : Math.floor(a.walkT * 4) % 2 ? 'arm-walk2' : 'arm-walk1';
    const bob = a.daze > 0 || a.turn > 0 ? 0 : Math.abs(Math.sin(a.walkT * 8)) * 5;
    drawFrame(c, n, a.x, w.floor + 4 - bob, a.dir, s, s);
    if (a.daze > 0) for (let i = 0; i < 3; i++) glint(c, a.x + Math.cos(t * 5 + i * 2.1) * 40, w.floor - a.h - 10 + Math.sin(t * 5 + i * 2.1) * 10, 10, 0.9, '#fff6c0');
  }
  const ch = w.chest!; drawFrame(c, ch.open ? 'kchest-open' : 'kchest', ch.x, ch.y + 2, 1, 0.7, 0.7);
  if (!ch.open) glint(c, ch.x + 20, ch.y - 50, 14, blink(t, 1.3, 2.5));
  const wb = w.web!;
  if (webActive(w) || (wb.burnt && wb.t < 1)) {
    const a = wb.burnt ? 1 - wb.t : 1, [, wh] = fsize('web-big'), s = (wb.y1 - wb.y0 + 20) / wh;
    drawFrame(c, 'web-big', wb.x, wb.y1 + 4 + (wb.burnt ? wb.t * 60 : 0), 1, s, s, a);
  }
  for (const p of w.pearls) drawPearl(c, p, t);
  drawWall(c, w, t);
  for (const pt of w.portals) if (pt.open) {
    drawPortal(c, pt.x, pt.y, t, pt.t !== undefined ? clamp(pt.t * 2, 0, 1) : 1);
    if (pt.id === 'quick') { const cb = g.W.hub.cabs!.find((k) => k.id === 'sea')!; drawFrame(c, cb.n, pt.x, pt.y + 120, 1, 0.3, 0.3, 0.95); }
  }
  for (const st of w.statics) drawStatic(c, st, t);
  drawHeroes(c, w, t);
}
// the blank wall runs floor to ceiling
function drawWall(c: C, w: World, t: number) {
  const wl = w.wall!, g = P.g;
  const [ww, wh] = fsize('wall-tall'), wx = wl.x + ww / 2, wy = w.floor + 16;
  const kx = wl.knock > 0 ? Math.sin(wl.knock * 60) * 3 : 0;
  const q = wl.open ? clamp(wl.t / 1.2, 0, 1) : 0;
  const s = (w.floor + 200) / wh;
  drawFrame(c, 'wall-tall', wx + kx, wy, 1, s, s, 1 - q);
  if (q > 0) drawFrame(c, 'wall-tall-door', wx, wy, 1, s, s, q);
  if (wl.open) {   // the rune line around the revealed arch
    const [dw, dh] = fsize('wall-tall-door'), s2 = (w.floor + 200) / dh, W2 = dw * s2, H2 = dh * s2;
    const D = { x0: 0.3, x1: 0.7, y0: 0.55, y1: 0.985 };
    const x0 = wx - W2 / 2 + W2 * D.x0, x1 = wx - W2 / 2 + W2 * D.x1, y1 = wy - H2 * (1 - D.y1), y0 = wy - H2 * (1 - D.y0);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [lw, al] of [[18, 0.15], [6, 0.6]]) {
      c.strokeStyle = `rgba(110,245,235,${al * (0.7 + 0.3 * Math.sin(t * 3)) * q})`; c.lineWidth = lw;
      const r = (x1 - x0) / 2;
      c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0, y0 + r); c.arc(x0 + r, y0 + r, r, Math.PI, 0); c.lineTo(x1, y1); c.stroke();
    }
    c.restore();
  }
  if (!wl.open) glint(c, wl.x + 60, w.floor - 250, 22, blink(t, 0.7, g.abil.ping ? 1.8 : 3), g.abil.ping ? '#b8fff6' : '#fff6d8');
  if (!wl.open && wl.bubble > 0) thought(c, wl.x - 120, w.floor - 250 + Math.sin(t * 2) * 6, 1.45, g.abil.ping ? 'ping' : 'conch', clamp(wl.bubble * 3, 0, 1), t);
  void DOOR;
}

// ───────────── the secret room
function drawRoom(c: C, w: World, t: number) {
  const g = P.g;
  if (P.img['secret-room']) c.drawImage(P.img['secret-room'], 0, 720 - 853, 1280, 853);
  const pd = w.pedestal!;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = pd.taken ? 0.25 : 0.5;   // moonlight falls on the crest
  const gr = c.createLinearGradient(0, 0, 0, pd.y); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(1, 'rgba(230,235,255,.35)');
  c.fillStyle = gr; c.beginPath(); c.moveTo(pd.x - 60, 0); c.lineTo(pd.x + 60, 0); c.lineTo(pd.x + 150, pd.y); c.lineTo(pd.x - 150, pd.y); c.fill(); c.restore();
  if (!pd.taken) { lightPool(c, pd.x, pd.y - 150, 160, 'rgba(255,210,110,.6)', 0.6 + 0.2 * Math.sin(t * 3)); drawFrame(c, 'pedestal-crest', pd.x, pd.y + Math.sin(t * 2) * 2); glint(c, pd.x + 24, pd.y - 170, 20, blink(t, 0.2, 2)); }
  else drawFrame(c, 'pedestal', pd.x, pd.y);
  for (const b of w.braziers!) {   // cold braziers; the sweep relights them
    if (b.lit) lightPool(c, b.x, w.floor - 170, 210, 'rgba(255,190,90,.7)', clamp(b.t * 2, 0, 1) * (0.6 + 0.1 * Math.sin(t * 9 + b.x)));
    drawFrame(c, b.lit ? 'brazier-lit' : 'brazier', b.x, w.floor + 4, 1, 1.35, 1.35);
    if (!b.lit && pd.taken) glint(c, b.x, w.floor - 170, 16, blink(t, b.x * 0.01, 2.2), '#ffe6a8');
  }
  const back = w.portals[0];
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(110,245,235,${0.35 + 0.2 * Math.sin(t * 3)})`; c.lineWidth = 6;
  c.beginPath(); c.moveTo(back.x - 50, w.floor); c.lineTo(back.x - 50, w.floor - 170); c.arc(back.x, w.floor - 170, 50, Math.PI, 0); c.lineTo(back.x + 50, w.floor); c.stroke(); c.restore();
  const out = w.portals[1];
  if (g.flags.roomClear) drawPortal(c, out.x, out.y, t, clamp((t - g.roomClearT) * 2, 0, 1));
  const up = g.flags.roomClear ? clamp((t - g.roomClearT) / 1.2, 0, 1) : 0;
  drawFrame(c, 'portcullis', out.x, w.floor + 10 - up * 330, 1, 0.9, 0.9, 1 - up * 0.6);
  for (const st of w.statics) drawStatic(c, st, t);
  drawHeroes(c, w, t);
}

// ───────────── the cloud fortress
function drawCloud(c: C, w: World, t: number, Vv: V, left: number, right: number) {
  mirrorTiles(c, P.img['cloud-bg'], left * 0.55 - 120, -120, 900, left - 50, right + 50);
  for (const p of w.props) if (FRraw(p.n)) drawFrame(c, p.n, p.x, p.y + 4, 1, 0.9, 0.9);
  for (const v of w.vents!) {   // updrafts: a column of rising air
    c.save(); c.globalCompositeOperation = 'lighter';
    const H = v.y - v.top + 80; c.translate(v.x, v.y); c.scale(1, H / 70);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 70); gr.addColorStop(0, `rgba(225,242,255,${0.34 + 0.08 * Math.sin(t * 4)})`); gr.addColorStop(1, 'rgba(225,242,255,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 70, Math.PI, TAU); c.fill(); c.restore();
    drawFrame(c, 'cvent', v.x, v.y + 14, 1, 0.7, 0.7);
  }
  for (const p of w.plats) drawPlat(c, p.n!, p.x0, p.x1, p.y);
  const b = w.bridge!;
  if (b.out > 0) { const x1 = lerp(b.x0, b.x1, easeOut(b.out)); c.save(); c.beginPath(); c.rect(b.x0, -100, x1 - b.x0, 900); c.clip(); drawPlat(c, 'terrace-long', b.x0, b.x1, b.y); c.restore(); }
  for (const m of w.movers) drawPlat(c, m.n, m.x - m.half, m.x + m.half, m.y);
  const wh = w.wheel!, [, hh] = fsize('wheel');
  drawFrame(c, 'wheel', wh.x, wh.y + 4, 1, 0.9, 0.9);
  if (wh.spun) for (let i = 0; i < 2; i++) glint(c, wh.x + (Math.random() - 0.5) * 100, wh.y - hh * 0.9 * 0.7 + (Math.random() - 0.5) * 80, 10, 0.7, '#ffffff');
  else glint(c, wh.x + 30, wh.y - hh * 0.9 * 0.8, 16, blink(t, 0, 2.2), '#dff4ff');
  const s = w.shrine!;
  if (!s.taken) {
    lightPool(c, s.x, s.y - 170, 170, 'rgba(190,230,255,.7)', 0.6 + 0.2 * Math.sin(t * 3));
    drawFrame(c, 'ped-gust', s.x, s.y + 4);
    glint(c, s.x + 26, s.y - 230, 20, blink(t, 0.2, 2));
  } else drawFrame(c, 'ped-empty', s.x, s.y + 4);
  for (const k of w.banks!) {   // a heavy storm cloud; the gust blows it away
    if (!k.alive && k.t > 1) continue;
    const a = k.alive ? 1 : 1 - k.t, dx = k.alive ? 0 : (k.dir || 1) * k.t * 600;
    const [, sh] = fsize('storm'), sc = (k.y1 - k.y0 + 60) / sh; drawFrame(c, 'storm', (k.x0 + k.x1) / 2 + dx, k.y1 + 20, 1, sc, sc, a);
  }
  for (const p of w.pearls) drawPearl(c, p, t);
  drawPortalsOf(c, w, t);
  for (const st of w.statics) drawStatic(c, st, t);
  drawHeroes(c, w, t);
  // a thin veil of cloud below the terraces
  const gr = c.createLinearGradient(0, 640, 0, 820); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,250,245,.85)');
  c.fillStyle = gr; c.fillRect(left - 10, 640, Vv.Vw + 20, 400);
}

// a still of a world, for the cabinet screen during the dive and the way out
export function snapshot(wid: WorldId, atSpawn: boolean, camX: number): HTMLCanvasElement {
  const g = P.g, cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
  const c = cv.getContext('2d')!, w = g.W[wid];
  const sp = atSpawn ? entryOf(g, wid).x : camX;
  const Vv = { Vw: 1280, Vh: 720, cy: 360, cx: clamp(atSpawn ? sp + 300 : sp, 640, Math.max(640, w.W - 640)) };
  c.setTransform(0.5, 0, 0, 0.5, 320 - Vv.cx * 0.5, 0);
  const L0 = lead(g), P0 = partner(g), hid = [L0.hidden, P0.hidden], save = g.world;
  L0.hidden = P0.hidden = true; g.world = wid;
  try { renderWorld(c, wid, Vv); } finally { g.world = save; L0.hidden = hid[0]; P0.hidden = hid[1]; }
  return cv;
}

// a wordless thought bubble: the conch (with its song), the ping or gust you now carry, the cloud cabinet, or zz
function thought(c: C, x: number, y: number, k: number, what: string, a: number, t: number) {
  drawFrame(c, 'bubble', x, y, 1, k, k, a * 0.96);
  const cx = x + 8 * k, cy = y - 92 * k;
  if (what === 'ping' || what === 'gust') { const q = 0.6 * k * (1 + 0.05 * Math.sin(t * 5)); drawFrame(c, 'ico-' + what, cx, cy + 40 * k, 1, q, q, a); return; }
  if (what === 'cloud') { drawFrame(c, 'cab-cloud', cx, cy + 62 * k, 1, 0.2 * k, 0.2 * k, a); return; }
  if (what === 'zz') { for (let i = 0; i < 3; i++) glint(c, cx - 20 * k + i * 20 * k, cy + 10 * k - i * 14 * k, 8 * k * (1 + i * 0.3), a * (0.5 + 0.5 * Math.sin(t * 3 + i)), '#dfe6ff'); return; }
  drawFrame(c, 'conch', cx, cy + 36 * k, 1, 0.44 * k, 0.44 * k, a);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
  for (let i = 0; i < 2; i++) {
    const r0 = 18 + ((t * 30 + i * 22) % 44), r = r0 * k;
    c.strokeStyle = 'rgba(90,225,220,' + (0.9 * (1 - (r0 - 18) / 44)).toFixed(3) + ')'; c.lineWidth = 3 * k;
    c.beginPath(); c.arc(cx, cy - 4 * k, r, -2.4, -0.7); c.stroke();
  }
  c.restore();
}

// ───────────── the giant (world space)
function drawBoss(c: C, t: number) {
  const g = P.g, B = g.boss; if (!B) return;
  const into = B.phase === 'intro' ? clamp(B.pt / 1.2, 0, 1) : 1;
  // the slam's ground ring: a ring on the carpet that fills as the fist comes down
  if (B.atk && B.atk.kind === 'slam' && !B.atk.hit) {
    const A = B.atk, q = clamp(A.t / A.tell, 0, 1);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,140,110,${0.55 + 0.35 * Math.sin(t * 14)})`; c.lineWidth = 5;
    c.beginPath(); c.ellipse(A.x!, 646, 120, 24, 0, 0, TAU); c.stroke();
    c.fillStyle = `rgba(255,120,90,${0.18 + 0.3 * q})`; c.beginPath(); c.ellipse(A.x!, 646, 120 * q, 24 * q, 0, 0, TAU); c.fill();
    c.restore();
  }
  if (B.atk && B.atk.kind === 'roar' && !B.atk.hit) {   // the roar's tell: ripples running out along the floor
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const q = ((B.atk.t * 1.5 + i / 3) % 1); c.strokeStyle = `rgba(200,180,255,${0.6 * (1 - q)})`; c.lineWidth = 4; c.beginPath(); c.ellipse(B.x - 120, 646, 80 + q * 700, 18 + q * 30, 0, Math.PI * 0.5, Math.PI * 1.5); c.stroke(); }
    c.restore();
  }
  if (B.phase === 'core' || B.phase === 'scatter' || B.phase === 'stagger') { const k = bossCore(B); lightPool(c, k.x, k.y, 230, 'rgba(110,240,230,.7)', 0.5 + 0.25 * Math.sin(t * 5)); }
  lightPool(c, B.x - 40, 420, 420, 'rgba(150,120,255,.35)', 0.5 * into);
  const bob = B.phase === 'scatter' ? Math.sin(t * 2) * 10 : 0;
  drawFrame(c, B.fr, B.x, 650 + bob, 1, 1, 1, into * (B.phase === 'dead' ? 1 - clamp((B.pt - 1.2) / 1.2, 0, 1) : 1));
  if (B.phase === 'scatter') { const k = bossCore(B); glint(c, k.x + 30, k.y - 40, 22, blink(t, 0, 1.2), '#dffffb'); }
  for (const v of B.waves) drawFrame(c, 'g-minion', v.x, 652, -v.dir, 0.32, 0.32);   // rolling Static
  // the hero icon: who (and which ability) is needed now
  const need = bossNeed(g);
  if (need && g.mode === 'play' && !g.cut) needBubble(c, B.x - 150, 300 + Math.sin(t * 2) * 6, need);
}

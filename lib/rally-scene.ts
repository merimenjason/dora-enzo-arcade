// Wind-Up Rally's court, drawn on a 2D canvas in a vintage lithographed-tinplate style: the toyshop shelf at night
// (a painting, or a drawn stand-in until it loads), the tin court board with its printed lines, slightly offset litho
// colour and glossy sheen (four skins: toyshop, biscuit tin, music box, toy train), the fine wire net, the crowd of
// tin toys bobbing at the back of the shelf, Dora, Enzo and the opponents as painted cut-outs (mirrored for the right
// side, crossfading between poses, tipping over when they lose), the shuttlecock cork-first with its trail and shadow,
// and sparks, feather puffs, dust, chalk line calls and the key's winding clicks. Drawing only: the page owns the
// state and the timing. It does not use the shared drawChinchilla.
import { HALF, SHORT, NET_H, type CourtId, type Match, type Side, type Who } from './rally-game';
import { ART } from './rally-art';

export type Art = ImageBitmap | HTMLCanvasElement;
export interface Sprites { [name: string]: Art | undefined }
export type Pose = 'ready' | 'run' | 'smash' | 'lunge' | 'wind' | 'cheer' | 'topple';
export type Fx = { kind: 'spark' | 'feather' | 'dust' | 'ring' | 'mark' | 'confetti' | 'click' | 'word'; x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; r: number; rot: number; txt?: string };
export type ToySnap = { who: Who; side: Side; x: number; y: number; pose: Pose; spring: number; winding: boolean; swingT: number; key: number; human: boolean };
export type Snap = { sx: number; sy: number; sa: number; held: boolean; down: boolean; toys: ToySnap[] };
export type ToyLook = { pose: Pose; prev: Pose; mix: number; topple: number; bob: number };
export type View = {
  t: number; shake: number; fx: Fx[]; trail: { x: number; y: number; a: number }[]; court: CourtId;
  crowd: Who[]; cheer: Who | null; cheerT: number; looks: ToyLook[]; net: number; replay: boolean; smashGlow: number;
  portrait: boolean;
};
export type Layout = { w: number; h: number; dpr: number; u: number; ox: number; floor: number; top: number; depth: number; k: number; bottom: number; toys: { x: number; y: number; w: number; h: number }[]; faces: { x: number; y: number; w: number; h: number }[] };

const CREAM = '#f6ead0', BRASS = '#d9a441', INK = '#2a1d17', RED = '#c23a2b', TEAL = '#1f6f6a';
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Each sprite's height in court units (feet to the top of the art). */
const TALL: Record<string, number> = {
  ready: 1.18, run: 1.02, smash: 1.5, lunge: 0.86, wind: 1.14, cheer: 1.36, topple: 0.78, swing: 1.32,
  robot: 1.42, frog: 1.05, duck: 1.2, top: 1.5, penguin: 1.22, knight: 1.34, bear: 1.42,
};
export const isChin = (w: Who) => w === 'dora' || w === 'enzo';
export function spriteName(who: Who, pose: Pose): string {
  if (isChin(who)) return `${who}-${pose}`;
  return pose === 'smash' || pose === 'lunge' ? `${who}-swing` : `${who}-ready`;
}
function tallOf(who: Who, pose: Pose) {
  if (isChin(who)) return TALL[pose] ?? 1.18;
  const base = TALL[who] ?? 1.2;
  return pose === 'smash' || pose === 'lunge' ? base * 1.06 : base;
}

/** Where everything goes on a w×h canvas. insetTop and insetBottom keep the HUD and touch pads off the play. */
export function layoutFor(w: number, h: number, insetTop: number, insetBottom: number, portrait: boolean, dpr = 1): Layout {
  const viewW = portrait ? 9.6 : 10.5; // court units across
  const short = !portrait && h < 520; // a sideways phone: keep less sky so the toys stay big (high shots show an arrow)
  const viewH = short ? 3.3 : 4.15; // above the board
  const below = short ? 0.36 : 0.62; // the board's front and a little shelf
  const k = portrait ? 1.7 : 1.24; // the toys are drawn a little larger than life, bigger still on an upright phone
  const u = Math.max(8, Math.min(w / viewW, (h - insetTop - insetBottom) / (viewH + below)));
  const ox = w / 2;
  const floor = Math.min(h - insetBottom - below * u, insetTop + (viewH + 0.15) * u + Math.max(0, (h - insetTop - insetBottom - (viewH + below) * u) * (portrait ? 0.8 : 0.55)));
  return { w, h, dpr, u, ox, floor, top: floor - viewH * u, depth: 0.5 * u, k, bottom: insetBottom, toys: [], faces: [] };
}
export const toScreen = (L: Layout, x: number, y: number) => ({ x: L.ox + x * L.u, y: L.floor - y * L.u });

// ---- textures, made once (and again if the browser drops an offscreen canvas's memory)
const lost = (c: HTMLCanvasElement) => !!(c.getContext('2d') as (CanvasRenderingContext2D & { isContextLost?: () => boolean }) | null)?.isContextLost?.();
const cache = new Map<string, HTMLCanvasElement>();
function made(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  let c = cache.get(key);
  if (c && !lost(c)) return c;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  cache.set(key, c);
  return c;
}
/** A tin-print grain: tiny dots of offset colour and scuffs. */
function tinGrain() {
  return made('grain', 256, 256, (g) => {
    const img = g.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = hash(i * 1.7) * 0.5 + hash(Math.floor(i / 256) * 0.21 + (i % 256) * 0.07) * 0.5;
      const dot = hash(i * 3.1) > 0.985;
      img.data[i * 4] = dot ? 255 : 240; img.data[i * 4 + 1] = dot ? 230 : 230; img.data[i * 4 + 2] = dot ? 200 : 220;
      img.data[i * 4 + 3] = dot ? 60 : Math.round(v * 22);
    }
    g.putImageData(img, 0, 0);
  });
}

// ---- the shelf backdrop
function drawBackdrop(g: CanvasRenderingContext2D, L: Layout, img: Art | undefined, v: View) {
  const { w, h } = L;
  const back = L.floor - L.depth * 0.6; // the board's back edge sits on the painted plank
  if (img && img.width) {
    const iw = img.width, ih = img.height, plank = 0.705;
    const s = Math.max(w / iw, h / ih, back / (plank * ih), (h - back) / ((1 - plank) * ih));
    const dw = iw * s, dh = ih * s, dy = back - plank * dh;
    g.drawImage(img, (w - dw) / 2, dy, dw, dh);
  } else {
    // a drawn stand-in: warm shop dark, shelves and glowing tin boxes
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2a1a24'); sky.addColorStop(0.6, '#4a2a1e'); sky.addColorStop(1, '#6b3a1f');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) {
      const y = back - (row + 1) * L.u * 1.35;
      g.fillStyle = '#3a2216'; g.fillRect(0, y, w, L.u * 0.12);
      for (let i = 0; i < 14; i++) {
        const bx = (i / 14) * w + hash(i + row * 9) * 30, bw = L.u * (0.5 + hash(i * 3 + row) * 0.6), bh = L.u * (0.5 + hash(i * 7 + row) * 0.5);
        g.fillStyle = ['#8a3a2a', '#2f5d6b', '#b08a3a', '#5b3a6b'][(i + row) % 4]; g.globalAlpha = 0.55;
        g.fillRect(bx, y - bh, bw, bh); g.globalAlpha = 1;
      }
    }
    g.fillStyle = '#7a4524'; g.fillRect(0, back, w, h - back);
  }
  // the warm window glow and a vignette
  const glow = g.createRadialGradient(w * 0.5, L.floor - L.u * 1.5, L.u, w * 0.5, L.floor - L.u, Math.max(w, h) * 0.75);
  glow.addColorStop(0, 'rgba(255,196,120,0.10)'); glow.addColorStop(1, 'rgba(20,8,16,0.45)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
}

// ---- the court board
type Skin = { top: string; top2: string; line: string; edge: string; front: string; trim: string; motif: (g: CanvasRenderingContext2D, x: number, y: number, s: number, i: number) => void };
const SKINS: Record<CourtId, Skin> = {
  shop: { top: '#2f7f73', top2: '#25665d', line: '#fbf1d6', edge: '#c23a2b', front: '#a93125', trim: BRASS,
    motif: (g, x, y, s, i) => { star(g, x, y, s * 0.2, i % 2 ? '#f2c14e' : '#fbf1d6'); } },
  biscuit: { top: '#b8433a', top2: '#9b3530', line: '#fff4dc', edge: '#1f4e3d', front: '#173d30', trim: '#e8c36a',
    motif: (g, x, y, s, i) => { g.fillStyle = i % 2 ? '#e8b96a' : '#d99a4a'; g.beginPath(); g.ellipse(x, y, s * 0.26, s * 0.18, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(90,50,20,0.5)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x - s * 0.1 + k * s * 0.1, y, s * 0.025, 0, Math.PI * 2); g.fill(); } } },
  musicbox: { top: '#4b2350', top2: '#3a1b3f', line: '#f1d48a', edge: '#d8b45a', front: '#2b1430', trim: '#f1d48a',
    motif: (g, x, y, s, i) => { g.strokeStyle = '#f1d48a'; g.lineWidth = Math.max(1, s * 0.03); g.beginPath(); g.arc(x, y, s * 0.16, 0, Math.PI * 2); g.stroke(); if (i % 2) { g.fillStyle = '#f1d48a'; g.beginPath(); g.arc(x, y, s * 0.05, 0, Math.PI * 2); g.fill(); } } },
  train: { top: '#24426b', top2: '#1c3456', line: '#ffe9a8', edge: '#e2b33b', front: '#c23a2b', trim: '#f6ead0',
    motif: (g, x, y, s, i) => { g.fillStyle = i % 2 ? '#c23a2b' : '#e2b33b'; g.fillRect(x - s * 0.22, y - s * 0.1, s * 0.44, s * 0.2); g.fillStyle = INK; g.beginPath(); g.arc(x - s * 0.12, y + s * 0.12, s * 0.06, 0, Math.PI * 2); g.arc(x + s * 0.12, y + s * 0.12, s * 0.06, 0, Math.PI * 2); g.fill(); } },
};
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  g.fillStyle = c; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function rivet(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.5, BRASS); gr.addColorStop(1, '#6b4a1a');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function drawCourt(g: CanvasRenderingContext2D, L: Layout, v: View) {
  const S = SKINS[v.court] ?? SKINS.shop, u = L.u;
  const half = L.depth / 2, xL = L.ox - (HALF + 0.55) * u, xR = L.ox + (HALF + 0.55) * u;
  const backY = L.floor - half, frontY = L.floor + half, thick = 0.2 * u, lean = 0.22 * u;
  // the board's top face: a slightly foreshortened tin plate
  g.save();
  g.beginPath(); g.moveTo(xL + lean, backY); g.lineTo(xR - lean, backY); g.lineTo(xR, frontY); g.lineTo(xL, frontY); g.closePath();
  const top = g.createLinearGradient(0, backY, 0, frontY); top.addColorStop(0, S.top2); top.addColorStop(1, S.top);
  g.fillStyle = top; g.fill();
  g.clip();
  // printed motifs in rows, like a lithographed tin tray
  const step = u * 0.62;
  for (let r = 0; r < 2; r++) for (let i = 0, x = xL + step * 0.5; x < xR; i++, x += step) {
    if (Math.abs(x - L.ox) < step * 0.4) continue;
    S.motif(g, x + (r ? step / 2 : 0), backY + (r + 0.5) * (L.depth / 2), u * 0.42 * (0.85 + r * 0.15), i + r);
  }
  g.globalAlpha = 0.85; g.fillStyle = S.top; g.globalAlpha = 1;
  // a soft specular sheen sweeping across the tin
  const sheen = g.createLinearGradient(xL, backY, xR, frontY);
  sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.42, 'rgba(255,240,210,0.0)'); sheen.addColorStop(0.5, 'rgba(255,240,210,0.22)'); sheen.addColorStop(0.58, 'rgba(255,240,210,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
  g.fillStyle = sheen; g.fillRect(xL, backY, xR - xL, L.depth);
  g.globalAlpha = 0.6; g.drawImage(tinGrain(), xL, backY, xR - xL, L.depth); g.globalAlpha = 1;
  g.restore();
  // the printed lines, with the litho's slightly offset colour plate underneath
  const lineAt = (x: number, ox = 0, oy = 0) => { const sx = L.ox + x * u; const f = (sx - L.ox) / (xR - L.ox); g.moveTo(sx + f * lean * 0 + ox, backY + oy); g.lineTo(sx + f * lean + ox, frontY + oy); };
  for (const [col, ox, oy] of [['rgba(214,60,120,0.45)', 1.5, 1], [S.line, 0, 0]] as [string, number, number][]) {
    g.strokeStyle = col; g.lineWidth = Math.max(1.5, u * 0.035);
    g.beginPath();
    for (const x of [-HALF, -SHORT, SHORT, HALF]) lineAt(x, ox, oy);
    g.moveTo(xL + lean * 0.5 + u * 0.3 + ox, L.floor - half * 0.6 + oy); g.lineTo(xR - lean * 0.5 - u * 0.3 + ox, L.floor - half * 0.6 + oy);
    g.moveTo(xL + u * 0.3 + ox, L.floor + half * 0.7 + oy); g.lineTo(xR - u * 0.3 + ox, L.floor + half * 0.7 + oy);
    g.stroke();
  }
  // the front edge: a folded tin rim with rivets and a printed border
  const fr = g.createLinearGradient(0, frontY, 0, frontY + thick);
  fr.addColorStop(0, S.edge); fr.addColorStop(0.35, S.front); fr.addColorStop(1, '#2a120c');
  g.fillStyle = fr; g.fillRect(xL, frontY, xR - xL, thick);
  g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(xL, frontY, xR - xL, Math.max(1, thick * 0.08));
  g.strokeStyle = S.trim; g.lineWidth = Math.max(1, u * 0.02); g.setLineDash([u * 0.12, u * 0.08]);
  g.beginPath(); g.moveTo(xL + 4, frontY + thick * 0.55); g.lineTo(xR - 4, frontY + thick * 0.55); g.stroke(); g.setLineDash([]);
  for (let x = xL + u * 0.25; x < xR; x += u * 0.9) rivet(g, x, frontY + thick * 0.28, Math.max(1.5, u * 0.03));
  // the back rim
  g.strokeStyle = S.edge; g.lineWidth = Math.max(2, u * 0.05);
  g.beginPath(); g.moveTo(xL + lean, backY); g.lineTo(xR - lean, backY); g.stroke();
  // chipped paint at the corners
  g.fillStyle = 'rgba(200,190,170,0.55)';
  for (let i = 0; i < 9; i++) { const cx = i % 2 ? xR - hash(i) * u * 0.5 : xL + hash(i) * u * 0.5; g.beginPath(); g.ellipse(cx, frontY + thick * hash(i * 5), u * 0.03 * (1 + hash(i * 2)), u * 0.015, 0, 0, Math.PI * 2); g.fill(); }
  // shadow on the shelf
  g.fillStyle = 'rgba(20,8,4,0.35)'; g.fillRect(xL + 6, frontY + thick, xR - xL - 12, Math.max(2, u * 0.06));
}

function drawNet(g: CanvasRenderingContext2D, L: Layout, v: View, front: boolean) {
  const u = L.u, half = L.depth / 2, x = L.ox, top = L.floor - NET_H * u;
  const wob = v.net, skew = 0.26 * u; // the back post sits a little to the right: we see the net's mesh at an angle
  const bx = x + skew, by = -half * 0.75, fy = half * 0.75;
  if (!front) {
    post(g, bx, L.floor + by, top + by, u);
    const mesh = (t: number) => Math.sin(t * 9 + v.t * 30) * wob * u * 0.05;
    // the mesh: a fine dark wire grid over a faint smoky sheet
    g.save();
    g.beginPath(); g.moveTo(bx, top + by); g.lineTo(x, top + fy); g.lineTo(x, L.floor + fy - u * 0.06); g.lineTo(bx, L.floor + by - u * 0.06); g.closePath();
    g.fillStyle = 'rgba(30,22,20,0.22)'; g.fill();
    g.clip();
    g.strokeStyle = 'rgba(25,18,16,0.7)'; g.lineWidth = Math.max(0.7, u * 0.009);
    const n = 9;
    for (let i = 0; i <= n; i++) { const f = i / n, xx = bx + (x - bx) * f, yy = by + (fy - by) * f; g.beginPath(); g.moveTo(xx + mesh(f), top + yy); g.lineTo(xx + mesh(f + 1), L.floor + yy); g.stroke(); }
    for (let j = 0; j <= 16; j++) { const yy = top + (j / 16) * NET_H * u; g.beginPath(); g.moveTo(bx + mesh(j), yy + by); g.lineTo(x + mesh(j + 3), yy + fy); g.stroke(); }
    g.restore();
    // the tape, with its offset litho shadow
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(214,60,120,0.45)'; g.lineWidth = Math.max(3, u * 0.06);
    g.beginPath(); g.moveTo(bx + 1.5, top + by + 2); g.quadraticCurveTo((bx + x) / 2 + 1.5, top + (by + fy) / 2 + wob * u * 0.06 + 2, x + 1.5, top + fy + 2); g.stroke();
    g.strokeStyle = '#fbf3df'; g.lineWidth = Math.max(3, u * 0.06);
    g.beginPath(); g.moveTo(bx, top + by); g.quadraticCurveTo((bx + x) / 2, top + (by + fy) / 2 + wob * u * 0.06, x, top + fy); g.stroke();
  } else {
    post(g, x, L.floor + fy, top + fy, u);
  }
}
function post(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, u: number) {
  const w = Math.max(3, u * 0.06);
  const gr = g.createLinearGradient(x - w, 0, x + w, 0);
  gr.addColorStop(0, '#6b4a1a'); gr.addColorStop(0.4, '#ffe7a3'); gr.addColorStop(1, '#8a5f22');
  g.fillStyle = gr; g.fillRect(x - w / 2, y1, w, y0 - y1);
  g.fillStyle = BRASS; g.beginPath(); g.arc(x, y1, w * 0.9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a2f12'; g.beginPath(); g.ellipse(x, y0, w * 1.6, w * 0.6, 0, 0, Math.PI * 2); g.fill();
}

// ---- toys
function drawToy(g: CanvasRenderingContext2D, L: Layout, t: ToySnap, look: ToyLook, sprites: Sprites, v: View, i: number) {
  const u = L.u * L.k;
  const p = toScreen(L, t.x, t.y);
  const flip = isChin(t.who) ? t.side === 1 : t.side === 0; // Dora and Enzo are painted facing right, the toys facing left
  // a shadow on the board, smaller as the toy hops
  g.fillStyle = `rgba(20,10,6,${0.32 - Math.min(0.2, t.y * 0.25)})`;
  g.beginPath(); g.ellipse(p.x, L.floor + L.depth * 0.05, u * (0.42 - Math.min(0.2, t.y * 0.2)), u * 0.08, 0, 0, Math.PI * 2); g.fill();
  const bob = look.bob;
  const one = (pose: Pose, alpha: number) => {
    if (alpha <= 0.01) return;
    const name = spriteName(t.who, pose), img = sprites[name], info = ART[name];
    const H = tallOf(t.who, pose) * u, W = info ? (H * info.w) / info.h : H * 0.9, ax = info ? info.ax : 0.5;
    g.save();
    g.globalAlpha = alpha;
    g.translate(p.x, p.y + bob);
    // tipping over: a tin toy topples onto its back and slowly rights itself
    const tip = look.topple;
    if (tip > 0 && !(isChin(t.who) && pose === 'topple')) { const dir = t.side === 0 ? -1 : 1; g.translate(dir * -W * 0.1 * tip, 0); g.rotate(dir * tip * Math.PI * 0.48); }
    // a lean into the swing, and a squash on landing
    const lean = t.swingT >= 0 ? Math.sin(Math.min(1, t.swingT / 0.3) * Math.PI) * 0.12 : pose === 'run' ? 0.05 : 0;
    g.rotate((flip ? -1 : 1) * lean);
    if (flip) g.scale(-1, 1);
    if (img && img.width) g.drawImage(img, -ax * W, -H, W, H);
    else tinStandIn(g, t.who, W, H, ax);
    g.restore();
    if (alpha > 0.5) {
      L.toys[i] = { x: p.x - (flip ? (1 - ax) : ax) * W, y: p.y - H, w: W, h: H };
      L.faces[i] = { x: p.x + (flip ? -1 : 1) * W * 0.05 - W * 0.25, y: p.y - H, w: W * 0.6, h: H * 0.45 };
    }
  };
  one(look.prev, 1 - look.mix);
  one(look.pose, look.mix);
  // the racket's swoosh: a bright crescent sweeping over from behind the head to the front
  if (t.swingT >= 0 && t.swingT < 0.24) {
    const f = Math.min(1, t.swingT / 0.16), fade = t.swingT < 0.16 ? 1 : 1 - (t.swingT - 0.16) / 0.08, dir = t.side === 0 ? 1 : -1;
    const low = t.pose === 'lunge';
    const cx = p.x, cy = p.y - u * (low ? 0.35 : 0.62), R = u * (low ? 0.62 : 0.78);
    const A = (deg: number) => (dir > 0 ? deg : 180 - deg) * Math.PI / 180;
    const from = low ? -40 : -150, to = low ? 55 : -5, cur = from + (to - from) * f, tail = Math.max(from, cur - 70);
    g.save(); g.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a0 = tail + (cur - tail) * (k / 5), a1 = tail + (cur - tail) * ((k + 1) / 5);
      g.strokeStyle = `rgba(255,246,220,${(0.12 + 0.16 * k) * fade})`; g.lineWidth = Math.max(2, u * (0.03 + 0.012 * k));
      g.beginPath(); g.arc(cx, cy, R, Math.min(A(a0), A(a1)), Math.max(A(a0), A(a1))); g.stroke();
    }
    g.restore();
  }
  // the key: clicking round as the toy winds, sparkles when it's full
  if (t.winding) {
    const back = p.x + (t.side === 0 ? -1 : 1) * u * 0.42, ky = p.y - u * 0.62;
    g.save(); g.strokeStyle = 'rgba(255,226,140,0.9)'; g.lineWidth = Math.max(1.5, u * 0.025); g.lineCap = 'round';
    for (let k = 0; k < 2; k++) { const a = -v.t * 9 + k * Math.PI; g.beginPath(); g.arc(back, ky, u * (0.2 + k * 0.06), a, a + 1.2); g.stroke(); }
    g.restore();
  }
}

/** A tin toy drawn in code, shown until its painting loads (or if it never does). */
function tinStandIn(g: CanvasRenderingContext2D, who: Who, W: number, H: number, ax: number) {
  const chin = isChin(who);
  const col = who === 'dora' ? '#efe4cf' : who === 'enzo' ? '#8d9cab' : who === 'robot' ? '#c8432f' : who === 'frog' ? '#4c9a3c' : who === 'duck' ? '#e2b33b' : who === 'top' ? '#d0533f' : who === 'penguin' ? '#2d4f6c' : who === 'knight' ? '#aab3bd' : '#9a6a3a';
  const cx = (0.5 - ax) * W, s = Math.min(W, H);
  const body = g.createRadialGradient(cx - s * 0.12, -H * 0.45, s * 0.05, cx, -H * 0.38, s * 0.5);
  body.addColorStop(0, '#fffaf0'); body.addColorStop(0.25, col); body.addColorStop(1, 'rgba(40,24,16,0.9)');
  g.fillStyle = body;
  g.beginPath(); g.ellipse(cx, -H * 0.32, s * 0.3, H * 0.3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + s * 0.06, -H * 0.72, s * 0.24, H * 0.2, 0, 0, Math.PI * 2); g.fill();
  if (chin) {
    g.fillStyle = '#f1a7b5';
    g.beginPath(); g.arc(cx - s * 0.1, -H * 0.9, s * 0.13, 0, Math.PI * 2); g.arc(cx + s * 0.18, -H * 0.88, s * 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(cx - s * 0.36, -H * 0.3, s * 0.18, H * 0.24, -0.4, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = who === 'dora' ? '#b0182a' : INK; g.beginPath(); g.arc(cx + s * 0.2, -H * 0.74, s * 0.04, 0, Math.PI * 2); g.fill();
  g.fillStyle = BRASS; g.fillRect(cx - s * 0.42, -H * 0.5, s * 0.14, s * 0.05);
}

// ---- the shuttlecock
function drawShuttle(g: CanvasRenderingContext2D, L: Layout, s: Snap, v: View) {
  const u = L.u, size = Math.max(11, u * 0.17);
  // the trail
  if (v.trail.length > 1) {
    g.save(); g.lineCap = 'round';
    for (let i = 1; i < v.trail.length; i++) {
      const a = v.trail[i - 1], b = v.trail[i], f = i / v.trail.length;
      const pa = toScreen(L, a.x, a.y), pb = toScreen(L, b.x, b.y);
      g.strokeStyle = v.smashGlow > 0 ? `rgba(255,${200 - 80 * v.smashGlow},120,${f * 0.6})` : `rgba(255,250,235,${f * 0.38})`;
      g.lineWidth = size * (0.15 + f * 0.45) * (v.smashGlow > 0 ? 1.4 : 1);
      g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
    }
    g.restore();
  }
  const p = toScreen(L, s.sx, s.sy);
  // its shadow on the board
  if (!s.held) { g.fillStyle = `rgba(20,10,6,${clamp(0.35 - s.sy * 0.06, 0.06, 0.35)})`; g.beginPath(); g.ellipse(p.x, L.floor, size * 0.5, size * 0.14, 0, 0, Math.PI * 2); g.fill(); }
  if (p.y < L.top - size) {
    // off the top: a little tin arrow shows where it will come down
    const y = Math.max(L.top - L.u * 0.35, 6) + size;
    g.fillStyle = 'rgba(255,240,200,0.92)'; g.strokeStyle = INK; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(p.x, y - size * 0.9); g.lineTo(p.x - size * 0.55, y); g.lineTo(p.x + size * 0.55, y); g.closePath(); g.fill(); g.stroke();
    return;
  }
  g.save(); g.translate(p.x, p.y); g.rotate(-s.sa); // cork leads along the flight
  // the feather skirt
  const sk = g.createLinearGradient(-size, 0, 0, 0); sk.addColorStop(0, '#ffffff'); sk.addColorStop(1, '#e9e1cf');
  g.fillStyle = sk; g.strokeStyle = 'rgba(80,60,40,0.6)'; g.lineWidth = Math.max(0.8, size * 0.05);
  g.beginPath(); g.moveTo(-size * 0.05, -size * 0.17); g.lineTo(-size, -size * 0.42); g.lineTo(-size, size * 0.42); g.lineTo(-size * 0.05, size * 0.17); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(120,100,80,0.45)';
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-size * 0.08, k * size * 0.06); g.lineTo(-size * 0.98, k * size * 0.17); g.stroke(); }
  g.fillStyle = RED; g.fillRect(-size * 0.42, -size * 0.3, size * 0.06, size * 0.6);
  // the cork
  const ck = g.createRadialGradient(size * 0.05, -size * 0.06, 1, 0, 0, size * 0.22);
  ck.addColorStop(0, '#fff6e0'); ck.addColorStop(1, '#c9a46a');
  g.fillStyle = ck; g.beginPath(); g.arc(0, 0, size * 0.2, -Math.PI / 2, Math.PI / 2); g.lineTo(-size * 0.06, size * 0.2); g.lineTo(-size * 0.06, -size * 0.2); g.closePath(); g.fill();
  g.restore();
}

// ---- the crowd of tin toys at the back of the shelf, shaded a little darker as they stand further back
const shade = new Map<string, HTMLCanvasElement>();
function shaded(name: string, img: Art | undefined): Art | undefined {
  if (!img || !img.width) return img;
  let c = shade.get(name);
  if (c && !lost(c)) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(46,22,12,0.36)'; g.fillRect(0, 0, c.width, c.height);
  shade.set(name, c);
  return c;
}
function drawCrowd(g: CanvasRenderingContext2D, L: Layout, v: View, sprites: Sprites) {
  const n = v.crowd.length; if (!n) return;
  const u = L.u * 0.46 * (v.portrait ? 1.15 : 1);
  const y0 = L.floor - L.depth * 0.6 - L.u * 0.08;
  g.save();
  v.crowd.forEach((who, i) => {
    const spots = v.cheer ? [-2.0, 1.9, -3.4, 3.3, 4.6] : [-2.0, 1.9, -3.4, 3.3, 4.6, -4.6];
    if (i >= spots.length) return;
    const sx = spots[i], left = sx < 0;
    const x = L.ox + sx * L.u;
    const bob = Math.abs(Math.sin(v.t * (3 + (i % 3)) + i * 1.7)) * u * 0.12 * (1 + v.cheerT);
    const name = isChin(who) ? `${who}-cheer` : `${who}-ready`, img = shaded(name, sprites[name]), info = ART[name];
    const H = (isChin(who) ? 1.3 : (TALL[who] ?? 1.2)) * u, W = info ? (H * info.w) / info.h : H * 0.8;
    g.save(); g.translate(x, y0 - bob);
    const faceRight = left; // they watch the middle of the court
    if (isChin(who) ? !faceRight : faceRight) g.scale(-1, 1);
    if (img && img.width) g.drawImage(img, -(info?.ax ?? 0.5) * W, -H, W, H);
    else tinStandIn(g, who, W, H, 0.5);
    g.restore();
  });
  g.restore();
}

// ---- the friend cheering from the edge of the shelf
function drawCheer(g: CanvasRenderingContext2D, L: Layout, v: View, sprites: Sprites) {
  if (!v.cheer) return;
  const u = L.u * 0.7 * L.k;
  // on an upright phone the cheering chinchilla stands at the back of the shelf, just behind the net
  const x = v.portrait ? L.ox - L.u * 1.0 : L.ox - L.u * (HALF + 0.2), y = L.floor - L.depth * (v.portrait ? 0.9 : 0.62);
  const hop = Math.max(0, Math.sin(v.t * 9)) * u * 0.18 * v.cheerT;
  const pose = v.cheerT > 0.05 ? 'cheer' : 'ready';
  const name = `${v.cheer}-${pose}`, img = sprites[name], info = ART[name];
  const H = TALL[pose] * u, W = info ? (H * info.w) / info.h : H * 0.8;
  g.save(); g.translate(x, y - hop);
  if (img && img.width) g.drawImage(img, -(info?.ax ?? 0.5) * W, -H, W, H);
  else tinStandIn(g, v.cheer, W, H, 0.5);
  g.restore();
}

// ---- effects
export function stepFx(fx: Fx[], dt: number) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.t >= f.life) { fx.splice(i, 1); continue; }
    if (f.kind === 'feather') { f.vx *= 1 - dt * 2.5; f.vy = f.vy * (1 - dt * 2.5) - 0.9 * dt; f.rot += dt * 4; }
    else if (f.kind === 'confetti') { f.vy -= 3 * dt; f.vx *= 1 - dt; f.rot += dt * 6; }
    else if (f.kind === 'spark' || f.kind === 'dust' || f.kind === 'click') { f.vy -= (f.kind === 'dust' ? 0.5 : 6) * dt; }
    f.x += f.vx * dt; f.y += f.vy * dt;
  }
}
function drawFx(g: CanvasRenderingContext2D, L: Layout, v: View) {
  const u = L.u;
  for (const f of v.fx) {
    const p = toScreen(L, f.x, f.y), a = 1 - f.t / f.life;
    g.save(); g.globalAlpha = Math.max(0, a);
    switch (f.kind) {
      case 'spark': { g.strokeStyle = f.c; g.lineWidth = Math.max(1.5, u * 0.03); const d = Math.hypot(f.vx, f.vy) || 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (f.vx / d) * u * 0.18 * a, p.y + (f.vy / d) * u * 0.18 * a); g.stroke(); break; }
      case 'ring': { g.strokeStyle = f.c; g.lineWidth = Math.max(2, u * 0.06 * a); g.beginPath(); g.arc(p.x, p.y, u * (0.06 + f.t * 1.3) * f.r, 0, Math.PI * 2); g.stroke(); break; }
      case 'feather': { g.translate(p.x, p.y); g.rotate(f.rot); g.fillStyle = '#fffaf0'; g.strokeStyle = 'rgba(90,70,50,0.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, u * 0.09 * f.r, u * 0.03 * f.r, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break; }
      case 'dust': { g.fillStyle = f.c; g.beginPath(); g.arc(p.x, p.y, u * f.r * (0.4 + f.t * 1.4), 0, Math.PI * 2); g.fill(); break; }
      case 'confetti': { g.translate(p.x, p.y); g.rotate(f.rot); g.fillStyle = f.c; g.fillRect(-u * 0.05, -u * 0.025, u * 0.1, u * 0.05); break; }
      case 'click': { g.fillStyle = f.c; g.font = `700 ${Math.max(10, u * 0.16)}px "Rye", Georgia, serif`; g.textAlign = 'center'; g.fillText(f.txt ?? 'tik', p.x, p.y); break; }
      case 'mark': {
        // a chalk line call on the board
        g.globalAlpha = Math.min(1, a * 2);
        g.strokeStyle = f.c; g.lineWidth = Math.max(2, u * 0.035);
        g.beginPath(); g.ellipse(p.x, L.floor, u * 0.26, L.depth * 0.32, 0, 0, Math.PI * 2); g.stroke();
        g.font = `700 ${Math.max(11, u * 0.2)}px "Rye", Georgia, serif`; g.textAlign = 'center'; g.fillStyle = f.c;
        g.strokeStyle = 'rgba(30,15,10,0.85)'; g.lineWidth = Math.max(2, u * 0.04);
        const ty = L.floor + L.depth * 0.5 + L.u * 0.42;
        g.strokeText(f.txt ?? '', p.x, ty); g.fillText(f.txt ?? '', p.x, ty);
        break;
      }
      case 'word': {
        const s = 1 + Math.max(0, 0.25 - f.t) * 2;
        g.translate(p.x, p.y); g.scale(s, s); g.rotate(-0.06);
        g.font = `400 ${Math.max(14, u * 0.3)}px "Rye", Georgia, serif`; g.textAlign = 'center';
        g.lineWidth = Math.max(3, u * 0.06); g.strokeStyle = INK; g.strokeText(f.txt ?? '', 0, 0); g.fillStyle = f.c; g.fillText(f.txt ?? '', 0, 0);
        break;
      }
    }
    g.restore();
  }
}

/** A snapshot of the match for drawing (the replay draws recorded frames the same way). */
export function snapOf(m: Match): Snap {
  return {
    sx: m.shuttle.x, sy: m.shuttle.y, sa: m.shuttle.ang, held: m.shuttle.held >= 0, down: m.shuttle.down,
    toys: m.players.map((p) => ({ who: p.who, side: p.side, x: p.x, y: p.y, pose: p.pose, spring: p.spring, winding: p.winding, swingT: p.swingT, key: p.key, human: p.human })),
  };
}

let layer: { c: HTMLCanvasElement; key: string } | null = null;
function staticLayer(L: Layout, v: View, img: Art | undefined) {
  const ready = !!(img && img.width);
  const key = [L.w, L.h, L.dpr, L.u.toFixed(3), L.floor.toFixed(1), v.court, ready].join(':');
  if (layer && layer.key === key && !lost(layer.c)) return layer.c;
  const c = layer && !lost(layer.c) ? layer.c : document.createElement('canvas');
  c.width = Math.max(1, Math.round(L.w * L.dpr)); c.height = Math.max(1, Math.round(L.h * L.dpr));
  const g = c.getContext('2d')!;
  g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  g.clearRect(0, 0, L.w, L.h);
  drawBackdrop(g, L, img, v);
  drawCourt(g, L, v);
  layer = { c, key };
  return c;
}

export function drawScene(g: CanvasRenderingContext2D, L: Layout, s: Snap, v: View, sprites: Sprites) {
  L.toys = []; L.faces = [];
  g.fillStyle = '#1b0f0b'; g.fillRect(0, 0, L.w, L.h);
  g.save();
  if (v.shake > 0) g.translate((hash(v.t * 60) - 0.5) * v.shake * L.u * 0.12, (hash(v.t * 60 + 9) - 0.5) * v.shake * L.u * 0.12);
  // the shelf and the court board are drawn once into a layer and reused while nothing about them changes
  g.drawImage(staticLayer(L, v, sprites.backdrop), 0, 0, L.w, L.h);
  if (v.replay) { g.fillStyle = 'rgba(40,20,10,0.25)'; g.fillRect(0, 0, L.w, L.h); }
  drawCrowd(g, L, v, sprites);
  drawCheer(g, L, v, sprites);
  drawNet(g, L, v, false);
  // toys further back first (the right-hand toys stand a hair behind)
  const order = s.toys.map((t, i) => i).sort((a, b) => s.toys[a].side - s.toys[b].side);
  for (const i of order) drawToy(g, L, s.toys[i], v.looks[i] ?? { pose: s.toys[i].pose, prev: s.toys[i].pose, mix: 1, topple: 0, bob: 0 }, sprites, v, i);
  drawNet(g, L, v, true);
  if (!s.down || s.sy > 0.001 || true) drawShuttle(g, L, s, v);
  drawFx(g, L, v);
  g.restore();
}

/** Eases each toy's look toward its pose: crossfades between poses, topples losers and rights them again. */
export function stepLooks(v: View, s: Snap, dt: number, over: boolean, winner: Side | null) {
  s.toys.forEach((t, i) => {
    const l = v.looks[i] ?? (v.looks[i] = { pose: t.pose, prev: t.pose, mix: 1, topple: 0, bob: 0 });
    if (t.pose !== l.pose) { l.prev = l.mix > 0.5 ? l.pose : l.prev; l.pose = t.pose; l.mix = 0; }
    l.mix = Math.min(1, l.mix + dt / 0.07);
    const lost = over && winner !== null && t.side !== winner;
    const want = lost ? (v.t % 7 < 4.2 ? 1 : 0) : 0; // topple, lie there a while, then slowly right itself
    l.topple += clamp(want - l.topple, -dt / 1.8, dt / 0.35);
    l.bob = over && winner === t.side ? -Math.abs(Math.sin(v.t * 8 + i)) * L_BOB : 0;
  });
}
const L_BOB = 8;

/** Fills the effects for the things that happen in a match. */
export function burst(v: View, kind: 'sweet' | 'hit' | 'smash' | 'land' | 'net' | 'cord' | 'win' | 'wound', x: number, y: number, extra?: { inside?: boolean; side?: number }) {
  const R = (k: number) => hash(v.t * 13.1 + k * 7.7);
  const add = (f: Partial<Fx> & Pick<Fx, 'kind'>) => v.fx.push({ x, y, vx: 0, vy: 0, t: 0, life: 0.6, c: '#ffe7a3', r: 1, rot: 0, ...f });
  if (kind === 'sweet') {
    add({ kind: 'ring', c: '#fff3c4', life: 0.35, r: 1 });
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + R(k); add({ kind: 'spark', vx: Math.cos(a) * (3 + R(k + 3) * 3), vy: Math.sin(a) * (3 + R(k + 5) * 3), life: 0.35 + R(k) * 0.2, c: k % 2 ? '#fff3c4' : BRASS }); }
  } else if (kind === 'hit') {
    add({ kind: 'ring', c: 'rgba(255,240,210,0.7)', life: 0.22, r: 0.6 });
  } else if (kind === 'smash') {
    add({ kind: 'ring', c: '#ffb36b', life: 0.4, r: 1.6 });
    for (let k = 0; k < 12; k++) add({ kind: 'feather', vx: (R(k) - 0.5) * 4, vy: (R(k + 2) - 0.2) * 3, life: 1.1 + R(k) * 0.6, r: 0.7 + R(k + 1) * 0.6, rot: R(k) * 6 });
    v.shake = Math.max(v.shake, 1); v.smashGlow = 1;
  } else if (kind === 'land') {
    for (let k = 0; k < 7; k++) add({ kind: 'dust', vx: (R(k) - 0.5) * 1.6, vy: R(k + 1) * 0.6, life: 0.7, c: 'rgba(240,220,190,0.35)', r: 0.08 + R(k) * 0.06 });
    add({ kind: 'mark', life: 1.6, c: extra?.inside ? '#fff4d6' : '#ff8a6b', txt: extra?.inside ? 'IN' : 'OUT' });
  } else if (kind === 'net') {
    v.net = 1;
    add({ kind: 'word', y: NET_H + 0.5, life: 0.9, c: '#ffd36b', txt: 'Net!' });
  } else if (kind === 'cord') {
    v.net = 0.7;
    add({ kind: 'word', y: NET_H + 0.55, life: 1.0, c: '#ffd36b', txt: 'Let-cord!' });
  } else if (kind === 'win') {
    for (let k = 0; k < 60; k++) add({ kind: 'confetti', x: x + (R(k) - 0.5) * 6, y: y + 3 + R(k + 1) * 2, vx: (R(k + 2) - 0.5) * 2, vy: -R(k + 3) * 1.5, life: 2.4 + R(k) * 1.2, c: [RED, BRASS, TEAL, CREAM, '#e2b33b'][k % 5], rot: R(k) * 6 });
  } else if (kind === 'wound') {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add({ kind: 'spark', vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5 + 1, life: 0.45, c: BRASS }); }
  }
}

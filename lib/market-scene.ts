// Night Market's night scene, drawn on a 2D canvas in a Japanese woodblock-print style: the riverside backdrop
// (a painting, or a drawn bokashi stand-in until it loads), the stall with its indigo noren, hanging paper lanterns
// and grained counter, the wares, Dora and Enzo behind the counter as painted cut-outs, the customer in front with
// their tells drawn over them as ink marks (ears, a tail flick, the lean, a long look at the ware, the purse), the
// speech scroll, coins and glows. Drawing only: the page owns the state and the timing.
import type { Customer, ItemId, Species, Tells } from './market-game';

export type Pose = 'greet' | 'think' | 'joy' | 'count';
export interface Sprites { [name: string]: HTMLImageElement | undefined }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Layout { w: number; h: number; u: number; ground: number; stall: Rect; counterTop: number; dora: Rect; enzo: Rect; doraDraw: Rect; enzoDraw: Rect; customer: Rect; face: Rect; slots: { x: number; y: number }[]; crates: Rect }
export interface Fly { x: number; y: number; vx: number; vy: number; t: number; life: number; kind: 'coin' | 'verse' | 'spark' | 'ink' }
export interface SceneState {
  t: number; // seconds since the page started, for gentle motion
  night: number; event: string | null; lanterns: number; festival: boolean;
  front: ItemId[]; back: { item: ItemId; n: number }[];
  dora: Pose; enzo: Pose;
  customer: (Pick<Customer, 'species' | 'want' | 'name'> & { tells: Tells }) | null;
  visitor: Species | null;
  walk: number; // 0 just arriving from the right, 1 standing at the stall
  leaving: boolean; carry: ItemId | null; // walking off, with or without a ware
  looking: number; // 0..1 how far through their long look at the ware
  showTells: boolean; bubble: string | null; bubbleT: number;
  flies: Fly[]; shake: number;
}

const INK = '#1d1a24', CREAM = '#f3e6c8', VERMILION = '#c8402a', INDIGO = '#22335c', OCHRE = '#d7a24a';
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function layout(w: number, h: number): Layout {
  // narrow screens bring the customer in close to the counter so everyone stays a clear size
  const span = w / h < 1.15 ? 830 : 1000;
  const u = Math.max(0.2, Math.min(h / 690, w / span));
  const ground = h - Math.max(10, h * 0.05);
  const gx = (w - span * u) / 2;
  const stall: Rect = { x: gx + 20 * u, y: ground - 600 * u, w: 600 * u, h: 600 * u };
  const counterTop = ground - 220 * u;
  // Dora and Enzo behind the counter: the drawn squares, and the parts that show above the counter
  const doraDraw: Rect = { x: stall.x + 40 * u, y: counterTop + 60 * u - 270 * u, w: 270 * u, h: 270 * u };
  const enzoDraw: Rect = { x: stall.x + 272 * u, y: counterTop + 62 * u - 300 * u, w: 300 * u, h: 300 * u };
  const vis = (r: Rect): Rect => ({ x: r.x + r.w * 0.12, y: r.y + r.h * 0.05, w: r.w * 0.76, h: counterTop - r.y - r.h * 0.05 });
  const dora = vis(doraDraw), enzo = vis(enzoDraw);
  const C = 370 * u;
  const customer: Rect = { x: Math.min(w - C - 4, gx + (span - 180) * u - C / 2), y: ground - C, w: C, h: C };
  const face: Rect = { x: customer.x + C * 0.15, y: customer.y, w: C * 0.7, h: C * 0.42 };
  const slots = [0.2, 0.5, 0.8].map((f) => ({ x: stall.x + stall.w * f, y: counterTop }));
  const crates: Rect = { x: stall.x + 40 * u, y: counterTop + 110 * u, w: stall.w - 80 * u, h: 80 * u };
  return { w, h, u, ground, stall, counterTop, dora, enzo, doraDraw, enzoDraw, customer, face, slots, crates };
}

// ---- paper and wood textures, made once
let paper: HTMLCanvasElement | null = null;
function paperTexture() {
  if (paper) return paper;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!, img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256, y = Math.floor(i / 256);
    const fibre = hash(i) * 0.6 + hash(Math.floor(x / 3) * 7 + y * 0.31) * 0.25 + (hash(x * 0.13 + Math.floor(y / 9) * 91) > 0.97 ? 0.4 : 0);
    const v = 200 + fibre * 55;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.96; img.data[i * 4 + 2] = v * 0.86; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0); paper = c; return c;
}
function grain(g: CanvasRenderingContext2D, r: Rect, base: string, line: string, seed: number, vertical = false) {
  g.save(); g.fillStyle = base; g.fillRect(r.x, r.y, r.w, r.h);
  g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
  g.strokeStyle = line; g.lineWidth = Math.max(1, r.h / 90);
  const n = vertical ? Math.ceil(r.w / 7) : Math.ceil(r.h / 7);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.18 + hash(seed + i) * 0.3;
    g.beginPath();
    if (vertical) { const x = r.x + (i + hash(seed * 3 + i)) * 7; for (let y = 0; y <= r.h; y += 12) { const xx = x + Math.sin((y + seed * 13) / 40 + i) * 2.2; if (y === 0) g.moveTo(xx, r.y + y); else g.lineTo(xx, r.y + y); } }
    else { const y = r.y + (i + hash(seed * 3 + i)) * 7; for (let x = 0; x <= r.w; x += 12) { const yy = y + Math.sin((x + seed * 13) / 50 + i * 1.7) * 2.4 + (hash(seed + i * 5) > 0.85 ? Math.sin(x / 15) * 3 : 0); if (x === 0) g.moveTo(r.x + x, yy); else g.lineTo(r.x + x, yy); } }
    g.stroke();
  }
  g.restore();
}
const inkRect = (g: CanvasRenderingContext2D, r: Rect, lw: number) => { g.lineWidth = lw; g.strokeStyle = INK; g.strokeRect(r.x, r.y, r.w, r.h); };

// ---- the backdrop: the painting, or a bokashi stand-in
function drawBackdrop(g: CanvasRenderingContext2D, L: Layout, img: HTMLImageElement | undefined, s: SceneState) {
  const { w, h } = L;
  if (img && img.complete && img.naturalWidth) {
    // cover, keeping the horizon (about 47% down the painting) just above the counter top
    const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight, (L.ground - L.counterTop + 250 * L.u) / (img.naturalHeight * 0.5));
    const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
    let dy = (L.counterTop - 90 * L.u) - dh * 0.47; dy = Math.min(0, Math.max(h - dh, dy));
    g.drawImage(img, (w - dw) / 2, dy, dw, dh);
  } else {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#0d1532'); sky.addColorStop(0.6, '#253a6b'); sky.addColorStop(1, '#5b5f86');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6e7b8'; g.beginPath(); g.arc(w * 0.78, h * 0.14, Math.min(w, h) * 0.06, 0, Math.PI * 2); g.fill();
    const hy = L.counterTop - 60 * L.u;
    g.fillStyle = '#172344'; g.fillRect(0, hy - 40 * L.u, w, 40 * L.u);
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#e2553a' : '#f0a640'; g.beginPath(); g.arc((i + 0.5) * w / 40, hy - 52 * L.u + Math.sin(i) * 4, 4 * L.u + 2, 0, Math.PI * 2); g.fill(); }
    const river = g.createLinearGradient(0, hy, 0, hy + 70 * L.u);
    river.addColorStop(0, '#1f3366'); river.addColorStop(1, '#0f1a38');
    g.fillStyle = river; g.fillRect(0, hy, w, 70 * L.u);
    grain(g, { x: 0, y: hy + 70 * L.u, w, h: h - hy - 70 * L.u }, '#6b4a2e', '#2a1a10', 7);
  }
  // rain or festival lanterns drifting on the river
  if (s.event === 'rain') {
    g.save(); g.strokeStyle = 'rgba(200,215,255,.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) { const x = (hash(i) * w + s.t * 40) % w, y = (hash(i + 99) * h + s.t * 520 * (0.7 + hash(i + 7) * 0.5)) % h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y + 16); g.stroke(); }
    g.restore();
  }
  if (s.festival) {
    const hy = L.counterTop - 50 * L.u;
    for (let i = 0; i < 18; i++) {
      const x = ((hash(i) * w * 1.2 + s.t * (8 + hash(i + 3) * 10)) % (w * 1.2)) - w * 0.1, y = hy - 30 * L.u + hash(i + 50) * 40 * L.u;
      glow(g, x, y, 22 * L.u, 'rgba(255,170,80,.45)');
      g.fillStyle = '#ffcf7a'; g.fillRect(x - 4 * L.u, y - 5 * L.u, 8 * L.u, 8 * L.u);
    }
  }
}
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

// ---- the stall
function lanternShape(g: CanvasRenderingContext2D, x: number, y: number, r: number, lit: boolean, t: number, k: number) {
  const sway = Math.sin(t * 1.3 + k) * 0.05;
  g.save(); g.translate(x, y); g.rotate(sway);
  g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath(); g.moveTo(0, -r * 1.6); g.lineTo(0, -r * 1.05); g.stroke();
  g.fillStyle = INK; g.fillRect(-r * 0.45, -r * 1.15, r * 0.9, r * 0.2); g.fillRect(-r * 0.45, r * 0.95, r * 0.9, r * 0.2);
  const body = g.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 1.05);
  if (lit) { body.addColorStop(0, '#ffe2a0'); body.addColorStop(0.55, '#f07a3c'); body.addColorStop(1, '#b8321f'); }
  else { body.addColorStop(0, '#d9c9a8'); body.addColorStop(1, '#8f7f68'); }
  g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, r * 0.8, r, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.globalAlpha = 0.55; g.lineWidth = Math.max(0.8, r * 0.035);
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(0, i * r * 0.36, r * 0.8 * Math.sqrt(1 - (i * 0.36) ** 2), r * 0.06, 0, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  g.restore();
}
function drawStall(g: CanvasRenderingContext2D, L: Layout, s: SceneState, sprites: Sprites, behind: () => void) {
  const { u, stall, counterTop, ground } = L;
  const post = 26 * u, roofY = stall.y + 40 * u;
  // back wall: a dark shadowed alcove so the chinchillas read against it
  const back = g.createLinearGradient(0, roofY, 0, counterTop);
  back.addColorStop(0, 'rgba(25,18,30,.88)'); back.addColorStop(1, 'rgba(60,34,24,.8)');
  g.fillStyle = back; g.fillRect(stall.x + post, roofY + 40 * u, stall.w - post * 2, counterTop - roofY - 40 * u);
  // lantern light warming the alcove
  const lit = Math.min(5, 2 + s.lanterns);
  for (let i = 0; i < lit; i++) glow(g, stall.x + stall.w * (0.12 + i * 0.19), roofY + 120 * u, 170 * u * (0.9 + Math.sin(s.t * 3 + i) * 0.05), 'rgba(255,170,90,.28)');
  // posts
  grain(g, { x: stall.x, y: roofY, w: post, h: ground - roofY }, '#5a3a24', '#1d120b', 3, true);
  grain(g, { x: stall.x + stall.w - post, y: roofY, w: post, h: ground - roofY }, '#5a3a24', '#1d120b', 4, true);
  inkRect(g, { x: stall.x, y: roofY, w: post, h: ground - roofY }, 2 * u + 1);
  inkRect(g, { x: stall.x + stall.w - post, y: roofY, w: post, h: ground - roofY }, 2 * u + 1);
  behind();
  // the roof: a dark tiled beam with an upturned edge
  g.fillStyle = '#2b2430'; g.beginPath();
  g.moveTo(stall.x - 40 * u, roofY + 10 * u); g.quadraticCurveTo(stall.x + stall.w / 2, roofY - 12 * u, stall.x + stall.w + 40 * u, roofY + 10 * u);
  g.lineTo(stall.x + stall.w + 52 * u, roofY - 22 * u); g.quadraticCurveTo(stall.x + stall.w / 2, stall.y - 34 * u, stall.x - 52 * u, roofY - 22 * u); g.closePath(); g.fill();
  g.lineWidth = 2.5 * u + 1; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = 'rgba(160,150,190,.35)'; g.lineWidth = 2 * u;
  for (let i = 1; i < 14; i++) { const x = stall.x - 30 * u + i * (stall.w + 60 * u) / 14; g.beginPath(); g.moveTo(x, roofY + 4 * u); g.lineTo(x + 6 * u, roofY - 24 * u); g.stroke(); }
  // the noren: an indigo curtain with white waves, split into panels
  const nTop = roofY + 6 * u, nH = 44 * u, panels = 5, pw = (stall.w - 10 * u) / panels;
  for (let i = 0; i < panels; i++) {
    const x = stall.x + 5 * u + i * pw, sw = Math.sin(s.t * 1.1 + i * 0.9) * 2 * u;
    g.save(); g.beginPath(); g.moveTo(x + 2 * u, nTop); g.lineTo(x + pw - 2 * u, nTop); g.lineTo(x + pw - 2 * u + sw, nTop + nH); g.lineTo(x + 2 * u + sw, nTop + nH); g.closePath();
    g.fillStyle = INDIGO; g.fill(); g.clip();
    g.strokeStyle = 'rgba(240,232,214,.75)'; g.lineWidth = 1.6 * u + 0.4;
    for (let row = 0; row < 3; row++) for (let k = -1; k < 4; k++) { const cx = x + k * pw / 3 + (row % 2) * pw / 6, cy = nTop + 14 * u + row * 14 * u; for (let r = 3; r <= 12; r += 4.5) { g.beginPath(); g.arc(cx, cy, r * u, Math.PI, 0); g.stroke(); } }
    g.restore();
    g.lineWidth = 1.6 * u + 0.6; g.strokeStyle = INK; g.strokeRect(x + 2 * u, nTop, pw - 4 * u, nH);
  }
  // a red seal crest on the middle panel
  const mx = stall.x + stall.w / 2, my = nTop + nH * 0.52;
  g.fillStyle = CREAM; g.beginPath(); g.arc(mx, my, 19 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = VERMILION; g.beginPath(); g.arc(mx, my, 15 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = CREAM; g.font = `700 ${Math.round(17 * u)}px 'Zen Antique', serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('市', mx, my + 1 * u);
  // hanging lanterns along the eave: two always, plus the ones lit for the night
  const spots = [0.06, 0.94, 0.22, 0.78, 0.5];
  for (let i = 0; i < 5; i++) {
    const on = i < 2 || i - 2 < s.lanterns;
    const x = stall.x + stall.w * spots[i], y = nTop + nH + 22 * u;
    if (on) glow(g, x, y, 90 * u * (1 + Math.sin(s.t * 4 + i * 2) * 0.04), 'rgba(255,150,70,.42)');
    lanternShape(g, x, y, (i < 2 ? 24 : 18) * u, on, s.t, i);
  }
  void sprites;
}
function drawCounter(g: CanvasRenderingContext2D, L: Layout, s: SceneState) {
  const { u, stall, counterTop, ground } = L;
  // the counter top board and the front panel
  grain(g, { x: stall.x - 14 * u, y: counterTop - 4 * u, w: stall.w + 28 * u, h: 22 * u }, '#8a5a34', '#2a170c', 11);
  inkRect(g, { x: stall.x - 14 * u, y: counterTop - 4 * u, w: stall.w + 28 * u, h: 22 * u }, 2.4 * u + 1);
  const front: Rect = { x: stall.x + 6 * u, y: counterTop + 18 * u, w: stall.w - 12 * u, h: ground - counterTop - 18 * u };
  grain(g, front, '#6a4127', '#22130a', 17);
  inkRect(g, front, 2.4 * u + 1);
  // vertical battens
  for (let i = 1; i < 6; i++) { const x = front.x + front.w * i / 6; g.strokeStyle = 'rgba(29,26,36,.7)'; g.lineWidth = 1.6 * u + 0.5; g.beginPath(); g.moveTo(x, front.y); g.lineTo(x, front.y + front.h); g.stroke(); }
  // lantern light falling on the counter
  const lg = g.createLinearGradient(0, counterTop, 0, ground);
  lg.addColorStop(0, `rgba(255,170,90,${0.18 + s.lanterns * 0.05})`); lg.addColorStop(1, 'rgba(20,10,20,.35)');
  g.fillStyle = lg; g.fillRect(front.x, front.y, front.w, front.h);
  // crates of back stock
  const cr = L.crates, n = Math.max(1, s.back.length), cw = Math.min(110 * u, cr.w / Math.max(4, n));
  s.back.forEach((b, i) => {
    const x = cr.x + i * cw + (cr.w - cw * n) / 2;
    const box: Rect = { x: x + 4 * u, y: cr.y + 14 * u, w: cw - 8 * u, h: cr.h - 14 * u };
    grain(g, box, '#a77846', '#3a2412', 31 + i);
    inkRect(g, box, 1.6 * u + 0.6);
    drawWare(g, b.item, x + cw / 2, cr.y + 26 * u, Math.min(36 * u, cw * 0.42), s.t);
    if (b.n > 1) seal(g, x + cw - 14 * u, cr.y + cr.h - 14 * u, 11 * u, String(b.n));
  });
}
export function seal(g: CanvasRenderingContext2D, x: number, y: number, r: number, text: string) {
  g.save(); g.fillStyle = VERMILION; g.strokeStyle = '#7a1c12'; g.lineWidth = Math.max(1, r * 0.12);
  g.beginPath(); g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.25); g.fill(); g.stroke();
  g.fillStyle = CREAM; g.font = `700 ${Math.round(r * 1.25)}px 'Zen Antique', serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y + r * 0.06);
  g.restore();
}

// ---- the wares, cut like woodblock stamps: flat colour and an ink keyline. (x, y) is the bottom centre.
export function drawWare(g: CanvasRenderingContext2D, id: ItemId, x: number, y: number, s: number, t = 0) {
  g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = INK; g.lineWidth = Math.max(1.2, s * 0.06);
  const P = (f: () => void, fill: string) => { g.beginPath(); f(); g.fillStyle = fill; g.fill(); g.stroke(); };
  switch (id) {
    case 'cup':
      P(() => { g.moveTo(-s * 0.42, -s * 0.62); g.lineTo(s * 0.42, -s * 0.62); g.quadraticCurveTo(s * 0.4, -s * 0.05, s * 0.18, 0); g.lineTo(-s * 0.18, 0); g.quadraticCurveTo(-s * 0.4, -s * 0.05, -s * 0.42, -s * 0.62); }, '#e9e2d0');
      g.strokeStyle = '#2f4f8a'; g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(-s * 0.38, -s * 0.48); g.lineTo(s * 0.38, -s * 0.48); g.stroke();
      g.fillStyle = '#2f4f8a'; g.beginPath(); g.arc(0, -s * 0.28, s * 0.09, 0, Math.PI * 2); g.fill();
      break;
    case 'teapot':
      P(() => { g.moveTo(s * 0.32, -s * 0.38); g.quadraticCurveTo(s * 0.62, -s * 0.5, s * 0.66, -s * 0.72); g.lineTo(s * 0.56, -s * 0.74); g.quadraticCurveTo(s * 0.5, -s * 0.52, s * 0.3, -s * 0.5); }, '#3b6a5a');
      P(() => { g.ellipse(0, -s * 0.36, s * 0.42, s * 0.36, 0, 0, Math.PI * 2); }, '#3b6a5a');
      P(() => { g.ellipse(0, -s * 0.7, s * 0.2, s * 0.06, 0, 0, Math.PI * 2); }, '#2a4c40');
      P(() => { g.arc(0, -s * 0.8, s * 0.06, 0, Math.PI * 2); }, OCHRE);
      g.strokeStyle = '#7a4a26'; g.lineWidth = s * 0.07; g.beginPath(); g.arc(0, -s * 0.72, s * 0.32, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.strokeStyle = 'rgba(240,230,200,.6)'; g.lineWidth = s * 0.04; g.beginPath(); g.arc(-s * 0.12, -s * 0.42, s * 0.16, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      break;
    case 'scarf':
      P(() => { g.roundRect(-s * 0.5, -s * 0.44, s, s * 0.44, s * 0.06); }, '#9b3a5a');
      g.strokeStyle = OCHRE; g.lineWidth = s * 0.06; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-s * 0.5, -s * 0.22 + i * s * 0.12); g.lineTo(s * 0.5, -s * 0.22 + i * s * 0.12); g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = Math.max(1.2, s * 0.05); g.strokeRect(-s * 0.5, -s * 0.44, s, s * 0.44);
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(s * 0.5, -s * 0.4 + i * s * 0.09); g.lineTo(s * 0.6, -s * 0.38 + i * s * 0.09); g.stroke(); }
      break;
    case 'cloth':
      P(() => { g.moveTo(-s * 0.45, 0); g.quadraticCurveTo(-s * 0.5, -s * 0.5, 0, -s * 0.52); g.quadraticCurveTo(s * 0.5, -s * 0.5, s * 0.45, 0); g.closePath(); }, '#3f7a6c');
      g.fillStyle = 'rgba(240,232,214,.8)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-s * 0.25 + (i % 3) * s * 0.25, -s * 0.12 - Math.floor(i / 3) * s * 0.18, s * 0.04, 0, Math.PI * 2); g.fill(); }
      P(() => { g.ellipse(-s * 0.13, -s * 0.6, s * 0.12, s * 0.08, -0.5, 0, Math.PI * 2); g.ellipse(s * 0.13, -s * 0.6, s * 0.12, s * 0.08, 0.5, 0, Math.PI * 2); }, '#3f7a6c');
      break;
    case 'tea': case 'moontea': {
      const c = id === 'tea' ? '#5c8a3a' : INDIGO;
      P(() => { g.roundRect(-s * 0.26, -s * 0.78, s * 0.52, s * 0.78, s * 0.05); }, c);
      P(() => { g.roundRect(-s * 0.28, -s * 0.86, s * 0.56, s * 0.12, s * 0.03); }, '#b9a77a');
      P(() => { g.rect(-s * 0.26, -s * 0.52, s * 0.52, s * 0.26); }, CREAM);
      if (id === 'moontea') { g.fillStyle = OCHRE; g.beginPath(); g.arc(0, -s * 0.39, s * 0.09, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = '#5c8a3a'; g.beginPath(); g.ellipse(0, -s * 0.39, s * 0.11, s * 0.05, 0.6, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'top':
      g.rotate(Math.sin(t * 6) * 0.05);
      P(() => { g.moveTo(0, 0); g.lineTo(-s * 0.36, -s * 0.36); g.quadraticCurveTo(0, -s * 0.62, s * 0.36, -s * 0.36); g.closePath(); }, VERMILION);
      g.strokeStyle = OCHRE; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(-s * 0.28, -s * 0.33); g.quadraticCurveTo(0, -s * 0.48, s * 0.28, -s * 0.33); g.stroke();
      g.strokeStyle = INK; g.lineWidth = Math.max(1.2, s * 0.07); g.beginPath(); g.moveTo(0, -s * 0.5); g.lineTo(0, -s * 0.72); g.stroke();
      break;
    case 'lantern': g.restore(); lanternShape(g, x, y - s * 0.45, s * 0.36, true, t, x); return;
    case 'fish':
      P(() => { g.moveTo(-s * 0.48, -s * 0.2); g.quadraticCurveTo(-s * 0.1, -s * 0.48, s * 0.3, -s * 0.22); g.lineTo(s * 0.5, -s * 0.36); g.lineTo(s * 0.46, -s * 0.06); g.lineTo(s * 0.3, -s * 0.18); g.quadraticCurveTo(-s * 0.1, s * 0.02, -s * 0.48, -s * 0.2); }, '#b9925a');
      g.fillStyle = INK; g.beginPath(); g.arc(-s * 0.32, -s * 0.24, s * 0.035, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(29,26,36,.6)'; g.lineWidth = s * 0.03; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-s * 0.05 + i * s * 0.1, -s * 0.2, s * 0.08, -0.8, 0.8); g.stroke(); }
      break;
    case 'pearl':
      P(() => { g.moveTo(-s * 0.46, -s * 0.06); g.quadraticCurveTo(0, s * 0.08, s * 0.46, -s * 0.06); g.quadraticCurveTo(s * 0.3, -s * 0.42, 0, -s * 0.12); g.quadraticCurveTo(-s * 0.3, -s * 0.42, -s * 0.46, -s * 0.06); }, '#7d6a8a');
      { const pg = g.createRadialGradient(-s * 0.06, -s * 0.34, s * 0.02, 0, -s * 0.28, s * 0.2); pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#d9cfe4'); P(() => { g.arc(0, -s * 0.28, s * 0.18, 0, Math.PI * 2); }, pg as unknown as string); }
      g.globalAlpha = 0.5 + Math.sin(t * 2) * 0.3; g.fillStyle = '#fff'; g.beginPath(); g.arc(-s * 0.07, -s * 0.36, s * 0.04, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      break;
  }
  g.restore();
}

// ---- characters
function sprite(g: CanvasRenderingContext2D, img: HTMLImageElement | undefined, r: Rect, flip: boolean, lean: number, fallback: () => void) {
  g.save();
  g.translate(r.x + r.w / 2, r.y + r.h); g.rotate(lean);
  if (flip) g.scale(-1, 1);
  if (img && img.complete && img.naturalWidth) g.drawImage(img, -r.w / 2, -r.h, r.w, r.h);
  else { g.translate(-r.w / 2, -r.h); fallback(); }
  g.restore();
}
function blobFallback(g: CanvasRenderingContext2D, r: Rect, fur: string, ear: string, eye: string) {
  const cx = r.w * 0.5, s = r.w;
  g.fillStyle = fur; g.strokeStyle = INK; g.lineWidth = Math.max(1.5, s * 0.012);
  g.beginPath(); g.ellipse(cx, r.h * 0.72, s * 0.3, s * 0.27, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(cx - s * 0.17, r.h * 0.26, s * 0.1, s * 0.11, 0, 0, Math.PI * 2); g.fillStyle = ear; g.fill(); g.stroke();
  g.beginPath(); g.ellipse(cx + s * 0.17, r.h * 0.26, s * 0.1, s * 0.11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = fur; g.beginPath(); g.ellipse(cx, r.h * 0.42, s * 0.24, s * 0.2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = eye; g.beginPath(); g.arc(cx + s * 0.09, r.h * 0.4, s * 0.03, 0, Math.PI * 2); g.fill();
}
const FALLBACK: Record<string, [string, string, string]> = {
  dora: ['#f4ead8', '#f2a9b4', '#a3122a'], enzo: ['#8e9aab', '#f2a9b4', '#111'],
  badger: ['#6d6560', '#e9e2d6', '#111'], tanuki: ['#8a6a48', '#3a2a20', '#111'], crane: ['#f2efe6', VERMILION, '#111'], rabbit: ['#f4f1ea', '#f2b9c4', '#111'],
  otter: ['#7a5638', '#5a3a24', '#111'], heron: ['#7d8ba0', '#2a2f3a', '#111'], fox: ['#d47a34', '#f3e6c8', '#111'],
};

function drawCustomer(g: CanvasRenderingContext2D, L: Layout, s: SceneState, sprites: Sprites) {
  const sp = s.visitor ?? s.customer?.species;
  if (!sp) return;
  const r = { ...L.customer };
  const off = (1 - s.walk) * (L.w - r.x + 40 * L.u);
  r.x += s.leaving ? off : off;
  const hop = Math.abs(Math.sin(s.t * 9)) * 6 * L.u * (s.walk < 1 || s.leaving ? 1 : 0);
  r.y -= hop;
  const t = s.customer?.tells;
  const showT = s.showTells && t && !s.leaving && s.walk >= 1 && !s.visitor;
  const lean = showT ? (t.posture === 'lean-in' ? -0.07 : t.posture === 'lean-back' ? 0.06 : 0) + Math.sin(s.t * 2) * 0.008 : 0;
  // shadow on the boardwalk
  g.fillStyle = 'rgba(10,6,16,.35)'; g.beginPath(); g.ellipse(r.x + r.w / 2, L.ground - 4 * L.u, r.w * 0.3, 12 * L.u, 0, 0, Math.PI * 2); g.fill();
  // the tail flick sits behind the customer (on their right: they face left)
  if (showT && t.tail === 'flick') {
    g.save(); g.strokeStyle = INK; g.lineWidth = 3 * L.u + 1; g.lineCap = 'round';
    const tx = r.x + r.w * 0.82, ty = r.y + r.h * 0.72, a = Math.sin(s.t * 14) * 0.5;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(tx, ty, (26 + i * 12) * L.u, -0.9 + a * 0.2, -0.2 + a * 0.2); g.stroke(); }
    g.restore();
  }
  const fb = FALLBACK[sp] ?? FALLBACK.badger;
  sprite(g, sprites[sp], r, s.leaving, lean, () => blobFallback(g, r, fb[0], fb[1], fb[2]));
  if (s.leaving && s.carry) drawWare(g, s.carry, r.x + r.w * 0.6, r.y + r.h * 0.72, 46 * L.u, s.t);
  if (!showT || !t) return;
  // ears: two ink strokes standing up (pricked) or drooping (flat), above the head
  const hx = r.x + r.w * 0.42, hy = r.y + 4 * L.u;
  g.save(); g.strokeStyle = INK; g.lineWidth = 3.2 * L.u + 1; g.lineCap = 'round';
  if (t.ears === 'pricked') {
    for (const dx of [-16, 0, 16]) { g.beginPath(); g.moveTo(hx + dx * L.u, hy - 6 * L.u); g.lineTo(hx + dx * 1.4 * L.u, hy - 26 * L.u); g.stroke(); }
    g.fillStyle = OCHRE; g.beginPath(); g.arc(hx + 30 * L.u, hy - 24 * L.u, 4 * L.u, 0, Math.PI * 2); g.fill();
  } else if (t.ears === 'flat') {
    for (const dx of [-14, 14]) { g.beginPath(); g.moveTo(hx + dx * L.u, hy - 4 * L.u); g.quadraticCurveTo(hx + dx * 2 * L.u, hy - 16 * L.u, hx + dx * 2.6 * L.u, hy); g.stroke(); }
    g.fillStyle = '#7fb3d9'; g.beginPath(); g.moveTo(hx + 36 * L.u, hy + 4 * L.u); g.quadraticCurveTo(hx + 30 * L.u, hy + 16 * L.u, hx + 36 * L.u, hy + 18 * L.u); g.quadraticCurveTo(hx + 42 * L.u, hy + 16 * L.u, hx + 36 * L.u, hy + 4 * L.u); g.fill(); g.stroke();
  }
  g.restore();
  // the purse, hung at the hip on their front (left) side
  const px = r.x + r.w * 0.24, py = r.y + r.h * 0.66, heavy = t.purse === 'heavy';
  g.save(); g.strokeStyle = INK; g.lineWidth = 2.4 * L.u + 0.6;
  g.beginPath(); g.moveTo(px, py - 30 * L.u); g.lineTo(px, py - 14 * L.u); g.stroke();
  g.fillStyle = heavy ? '#b83a28' : '#8a7a68';
  g.beginPath();
  if (heavy) g.ellipse(px, py + 6 * L.u, 24 * L.u, 22 * L.u, 0, 0, Math.PI * 2); else g.ellipse(px, py + 2 * L.u, 12 * L.u, 17 * L.u, 0, 0, Math.PI * 2);
  g.fill(); g.stroke();
  g.fillStyle = INK; g.fillRect(px - 9 * L.u, py - 15 * L.u, 18 * L.u, 5 * L.u);
  if (heavy) { for (let i = 0; i < 3; i++) { g.fillStyle = OCHRE; g.beginPath(); g.arc(px - 14 * L.u + i * 14 * L.u, py - 15 * L.u - (i % 2) * 4 * L.u, 6 * L.u, 0, Math.PI * 2); g.fill(); g.stroke(); } }
  g.restore();
  // returning: a little red seal
  if (t.returning) seal(g, r.x + r.w * 0.86, r.y + r.h * 0.18, 15 * L.u, '再');
}
/** The long look: a dotted ink eye-line from the customer to the ware, with a bead for each beat of looking. */
function drawGaze(g: CanvasRenderingContext2D, L: Layout, s: SceneState) {
  const c = s.customer; if (!c || !s.showTells || s.leaving || s.walk < 1 || s.visitor) return;
  const i = s.front.indexOf(c.want);
  const to = i >= 0 ? { x: L.slots[i].x, y: L.counterTop - 50 * L.u } : { x: L.crates.x + L.crates.w / 2, y: L.crates.y + 20 * L.u };
  const from = { x: L.customer.x + L.customer.w * 0.3, y: L.customer.y + L.customer.h * 0.24 };
  const k = Math.min(1, s.looking * 1.6);
  g.save(); g.strokeStyle = 'rgba(243,230,200,.75)'; g.setLineDash([3 * L.u + 2, 7 * L.u + 3]); g.lineWidth = 2.2 * L.u + 0.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k); g.stroke(); g.setLineDash([]);
  const beats = c.tells.gaze;
  for (let b = 0; b < 4; b++) {
    const f = 0.35 + b * 0.12, x = from.x + (to.x - from.x) * f, y = from.y + (to.y - from.y) * f - 16 * L.u;
    g.fillStyle = b < beats && s.looking >= (b + 1) / 4 ? OCHRE : 'rgba(243,230,200,.25)';
    g.beginPath(); g.arc(x, y, 5 * L.u + 1, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
function drawBubble(g: CanvasRenderingContext2D, L: Layout, s: SceneState) {
  if (!s.bubble || (!s.customer && !s.visitor)) return;
  const u = L.u, fs = Math.max(13, Math.round(21 * u));
  g.save(); g.font = `600 ${fs}px 'Shippori Mincho', serif`;
  const maxW = Math.min(L.w * 0.5, 420 * u + 60);
  const words = s.bubble.split(' '), lines: string[] = []; let cur = '';
  for (const wd of words) { const tr = cur ? cur + ' ' + wd : wd; if (g.measureText(tr).width > maxW - 28 && cur) { lines.push(cur); cur = wd; } else cur = tr; }
  if (cur) lines.push(cur);
  const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 30, bh = lines.length * fs * 1.25 + 18;
  const pop = Math.min(1, s.bubbleT * 6);
  // above the customer's head, nudged left toward the stall, kept on screen and clear of the face
  let bx = L.customer.x + L.customer.w * 0.45 - bw * 0.65, by = L.customer.y - bh - 18 * u;
  bx = Math.max(6, Math.min(L.w - bw - 6, bx)); by = Math.max(6, by);
  if (by + bh > L.face.y) by = Math.max(6, L.face.y - bh - 4);
  g.translate(bx + bw / 2, by + bh); g.scale(pop, pop); g.translate(-bw / 2, -bh);
  g.fillStyle = CREAM; g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.roundRect(0, 0, bw, bh, 6); g.fill(); g.stroke();
  g.drawImage(paperTexture(), 0, 0, 256, 256 * bh / bw, 1, 1, bw - 2, bh - 2); g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(243,230,200,.82)'; g.fillRect(1, 1, bw - 2, bh - 2);
  g.fillStyle = VERMILION; g.fillRect(0, 0, 5, bh);
  g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 16, 10 + i * fs * 1.25));
  g.restore();
}

/** Draws the whole night scene. Returns the layout so the page can place things and the tests can check framing. */
export function drawScene(g: CanvasRenderingContext2D, w: number, h: number, s: SceneState, sprites: Sprites): Layout {
  const L = layout(w, h);
  g.save();
  if (s.shake > 0) g.translate(Math.sin(s.t * 70) * s.shake * 4, 0);
  drawBackdrop(g, L, sprites.backdrop, s);
  // a dusky wash so the stall and lanterns stand out
  const wash = g.createLinearGradient(0, 0, 0, h); wash.addColorStop(0, 'rgba(10,14,40,.25)'); wash.addColorStop(1, 'rgba(14,8,20,.45)');
  g.fillStyle = wash; g.fillRect(0, 0, w, h);
  const doraImg = sprites['dora-' + s.dora] ?? sprites['dora-greet'], enzoImg = sprites['enzo-' + s.enzo] ?? sprites['enzo-greet'];
  drawStall(g, L, s, sprites, () => {
    const bob = (k: number) => Math.sin(s.t * 2.2 + k) * 2 * L.u;
    const joy = (p: Pose) => (p === 'joy' ? Math.abs(Math.sin(s.t * 8)) * 10 * L.u : 0);
    const dr = { ...L.doraDraw, y: L.doraDraw.y + bob(0) - joy(s.dora) };
    const er = { ...L.enzoDraw, y: L.enzoDraw.y + bob(1.4) - joy(s.enzo) };
    sprite(g, enzoImg, er, false, 0, () => blobFallback(g, er, ...FALLBACK.enzo));
    sprite(g, doraImg, dr, false, 0, () => blobFallback(g, dr, ...FALLBACK.dora));
  });
  drawCounter(g, L, s);
  // the front wares, standing on the counter
  s.front.forEach((id, i) => {
    const sl = L.slots[i]; const want = s.customer?.want === id && s.showTells && !s.leaving;
    if (want) glow(g, sl.x, sl.y - 30 * L.u, 70 * L.u, 'rgba(255,215,120,.5)');
    drawWare(g, id, sl.x, sl.y, 78 * L.u, s.t);
  });
  drawCustomer(g, L, s, sprites);
  drawGaze(g, L, s);
  // flying coins, verses and sparks
  for (const f of s.flies) {
    const a = Math.max(0, 1 - f.t / f.life);
    g.globalAlpha = a;
    if (f.kind === 'coin') { g.fillStyle = OCHRE; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(f.x, f.y, 8 * L.u + 2, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = INK; g.fillRect(f.x - 2.5 * L.u, f.y - 2.5 * L.u, 5 * L.u, 5 * L.u); }
    else if (f.kind === 'verse') { g.fillStyle = CREAM; g.strokeStyle = INK; g.lineWidth = 1.2; g.fillRect(f.x - 7 * L.u, f.y - 16 * L.u, 14 * L.u, 32 * L.u); g.strokeRect(f.x - 7 * L.u, f.y - 16 * L.u, 14 * L.u, 32 * L.u); }
    else if (f.kind === 'ink') { g.fillStyle = INK; g.beginPath(); g.arc(f.x, f.y, 5 * L.u + 1, 0, Math.PI * 2); g.fill(); }
    else { glow(g, f.x, f.y, 14 * L.u, 'rgba(255,220,140,.9)'); }
    g.globalAlpha = 1;
  }
  drawBubble(g, L, s);
  // paper fibre over everything, for the printed look
  g.globalAlpha = 0.07; g.globalCompositeOperation = 'multiply';
  const pt = g.createPattern(paperTexture(), 'repeat'); if (pt) { g.fillStyle = pt; g.fillRect(0, 0, w, h); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // a soft vignette
  const v = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,6,18,.45)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.restore();
  return L;
}
/** Moves the flying bits along. */
export function stepFlies(flies: Fly[], dt: number) {
  for (const f of flies) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.kind === 'coin' ? 900 : f.kind === 'ink' ? 600 : -30) * dt; }
  for (let i = flies.length - 1; i >= 0; i--) if (flies[i].t >= flies[i].life) flies.splice(i, 1);
}

// Powder Paws pixel art: every sprite is drawn here, pixel by pixel, into a small grid of colours, then given a clean
// one-pixel outline and cached as a canvas. Dora (cream-white, ruby eyes) and Enzo (blue-grey, black eyes) have a
// front, three-quarter, side and back view, each in riding, tuck, snowplough, air, grab, cheer and sitting poses,
// with skis drawn at any angle under them; plus the snowball tumble, the animals, trees, rocks, huts and the rest.
// Everything faces right; the scene mirrors a sprite to face left.

export type Who = 'dora' | 'enzo';
export type View = 'front' | 'q' | 'side' | 'back';
export type Pose = 'ride' | 'tuck' | 'brake' | 'air' | 'grab' | 'cheer' | 'sit';
export type Look = { scarf: string; hat: string; skis: string };

export const INK = '#1d1b2e';
const PAL = {
  dora: { fur: '#f7f2e8', shade: '#dcd1c0', belly: '#ffffff', eye: '#c3173a', ear: '#f6a3b6', earOut: '#ece2d2' },
  enzo: { fur: '#94a3b5', shade: '#73829a', belly: '#d3dce6', eye: '#121218', ear: '#f2a0b4', earOut: '#8494a8' },
};
const NOSE = '#f07a9a', CHEEK = '#ffb6c8', POLE = '#4a4f66', BOOT = '#3b3550', WHITE = '#ffffff';

export class Grid {
  px: (string | 0)[];
  constructor(public w: number, public h: number) { this.px = new Array(w * h).fill(0); }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[y * this.w + x]; }
  p(x: number, y: number, c: string) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
  r(x: number, y: number, w: number, h: number, c: string) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); }
  e(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.p(x, y, c);
    }
  }
  l(x0: number, y0: number, x1: number, y1: number, c: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 200; n++) { this.p(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  /** Rings every filled shape with a one-pixel outline (4-neighbour). */
  outline(c = INK) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) add.push(y * this.w + x);
    for (const i of add) this.px[i] = c;
    return this;
  }
}

// ---------------------------------------------------------------- the chinchillas
export type ChinOpts = { who: Who; view: View; pose: Pose; ski: number; look: Look; frame: number; blink?: boolean; happy?: boolean; hatless?: boolean };
/** A chinchilla on skis, facing right (or toward the camera), feet at (14, 25) of a 28×31 grid. ski: the skis' screen angle (0 = straight down, +π/2 = right). */
export function chinchilla(o: ChinOpts): Grid {
  const g = new Grid(28, 31), P = PAL[o.who], v = o.view, f = o.frame & 1;
  const dy = o.pose === 'tuck' ? 2 : o.pose === 'grab' ? 2 : o.pose === 'sit' ? 3 : o.pose === 'air' ? -1 : 0;
  // skis first (they sit under everything)
  const skiC = o.look.skis, tipC = lighten(skiC);
  if (o.pose === 'brake') {
    g.l(8, 21, 12, 28, skiC); g.l(20, 21, 16, 28, skiC); g.p(12, 28, tipC); g.p(16, 28, tipC);
  } else if (o.pose === 'sit') {
    g.l(2, 27, 12, 29, skiC); g.l(16, 29, 26, 26, skiC); g.p(26, 26, tipC);
  } else {
    const ux = Math.sin(o.ski), uy = Math.cos(o.ski) * 0.6, nx = -uy, ny = ux, gap = 2.6;
    for (const s of [-1, 1]) {
      const cx = 14 + nx * gap * s, cy = 25 + dy * 0.3 + ny * gap * s * 0.7;
      const ax = cx - ux * 6.5, ay = cy - uy * 6.5, bx = cx + ux * 7.5, by = cy + uy * 7.5;
      g.l(ax, ay, bx, by, skiC); g.p(bx + ux, by + uy - 1, tipC);
    }
  }
  const fur = P.fur, shade = P.shade;
  // tail behind (three-quarter and side), and poles behind the body
  if (v === 'q') g.e(7, 21 + dy * 0.5, 3.6, 3, shade);
  if (v === 'side') { g.e(5, 19 + dy * 0.5, 3.8, 4.2, shade); g.e(4.5, 18.5 + dy * 0.5, 2.4, 2.8, fur); }
  // body
  const by = 19 + dy;
  if (v === 'side') { g.e(13, by, 6, 4.6, fur); g.e(15, by + 1, 3.2, 2.8, P.belly); }
  else { g.e(14, by, 5.6, 5, fur); if (v !== 'back') g.e(v === 'q' ? 15.5 : 14, by + 1, 3.2, 3.2, P.belly); }
  if (v === 'back') g.e(14, by + 4, 3.4, 2.6, shade);
  // feet
  if (o.pose !== 'sit') { g.r(10, 23 + Math.min(dy, 1), 3, 2, BOOT); g.r(15, 23 + Math.min(dy, 1), 3, 2, BOOT); }
  else { g.r(9, 25, 3, 2, BOOT); g.r(16, 25, 3, 2, BOOT); }
  // scarf round the neck
  const sy = 14 + dy, sc = o.look.scarf, sc2 = lighten(sc);
  g.r(8, sy, 12, 2, sc); g.p(10, sy, sc2); g.p(13, sy, sc2); g.p(16, sy, sc2);
  if (v === 'back') { g.r(13, sy + 2, 2, 3, sc); g.p(13, sy + 4, sc2); }
  else if (o.pose !== 'sit') {
    // the loose end streams uphill behind (up the screen), fluttering
    const tx = v === 'side' || v === 'q' ? 6 : 19, d = v === 'side' || v === 'q' ? -1 : 1;
    g.r(tx, sy - 1 - f, 2, 2, sc); g.r(tx + d * 2, sy - 2 + f, 2, 2, sc2); g.p(tx + d * 4, sy - 2 - f, sc);
  }
  // paws (and poles)
  const paw = (x: number, y: number) => g.r(x, y, 2, 2, fur);
  if (o.pose === 'cheer') { paw(5, 8 + dy); paw(21, 8 + dy); g.l(4, 9, 2, 3, POLE); g.l(23, 9, 25, 3, POLE); }
  else if (o.pose === 'air') { paw(5, 15 + dy); paw(21, 15 + dy); g.l(5, 17, 1, 22, POLE); g.l(22, 17, 26, 22, POLE); }
  else if (o.pose === 'grab') { paw(8, 23); paw(19, 17 + dy); g.e(8, 22, 3, 2.4, shade); }
  else if (o.pose === 'tuck') { paw(10, 17 + dy); paw(16, 17 + dy); g.l(10, 19, 5, 15, POLE); g.l(18, 19, 23, 15, POLE); }
  else if (o.pose === 'sit') { paw(7, 21); paw(19, 21); }
  else if (v === 'side') { paw(18, 18 + dy); g.l(19, 20, 23, 26, POLE); }
  else { paw(7, 18 + dy); paw(19, 18 + dy); g.l(7, 20, 5, 26, POLE); g.l(20, 20, 22, 26, POLE); }
  // head: broad, slightly flat, smooth rounded crown; ears out to the sides
  const hy = 10 + dy;
  const ear = (x: number, y: number, inner: boolean) => { g.e(x, y, 3.1, 3.2, P.earOut); if (inner) g.e(x, y + 0.2, 1.7, 1.9, P.ear); };
  if (v === 'front') { ear(6.4, hy - 3, true); ear(21.6, hy - 3, true); }
  else if (v === 'q') { ear(8, hy - 3.2, false); ear(20.6, hy - 3.6, true); }
  else if (v === 'side') ear(11, hy - 3, true);
  else { ear(6.4, hy - 3, false); ear(21.6, hy - 3, false); }
  const hx = v === 'q' ? 15 : v === 'side' ? 16 : 14;
  g.e(hx, hy, v === 'side' ? 6.6 : 7.2, 5.4, fur);
  g.r(hx - 4, hy - 5, 8, 1, fur); // the flat of the crown
  if (o.hatless !== true) hat(g, o.look.hat, hx, hy, v);
  if (v !== 'back') {
    const mx = v === 'front' ? 14 : v === 'q' ? 17.5 : 20.5;
    g.e(mx, hy + 2.2, v === 'side' ? 2.6 : 3.1, 2, P.belly);
  }
  g.outline();
  if (v === 'back') return g;
  // the face (drawn after the outline so it stays crisp)
  const eye = (x: number, y: number, w: number) => {
    if (o.happy || o.pose === 'cheer') { g.p(x, y + 1, INK); g.p(x + w - 1, y + 1, INK); if (w > 1) g.p(x + (w > 1 ? 0.5 : 0), y, INK); return; }
    if (o.blink) { g.r(x, y + 1, w, 1, INK); return; }
    g.r(x, y, w, 2, P.eye); g.p(x, y, WHITE);
    if (o.who === 'dora') g.p(x + w - 1, y + 1, '#7a0c22');
  };
  if (v === 'front') { eye(10, hy - 1, 2); eye(16, hy - 1, 2); g.r(13, hy + 1, 2, 1, NOSE); g.p(9, hy + 2, CHEEK); g.p(18, hy + 2, CHEEK); }
  else if (v === 'q') { eye(12.5, hy - 1, 1); eye(18, hy - 1, 2); g.r(19, hy + 1, 2, 1, NOSE); g.p(21, hy + 2, CHEEK); }
  else { eye(18, hy - 1, 2); g.p(22, hy + 1, NOSE); g.p(23, hy + 1, NOSE); g.p(19, hy + 2, CHEEK); }
  if (o.happy || o.pose === 'cheer') { const mx = v === 'front' ? 13 : v === 'q' ? 18 : 21; g.r(mx, hy + 3, 2, 1, '#c84a6a'); }
  // whiskers
  const wc = o.who === 'dora' ? '#b9b2a8' : '#e4ebf2';
  if (v === 'front') { g.p(4, hy + 2, wc); g.p(5, hy + 1, wc); g.p(23, hy + 2, wc); g.p(22, hy + 1, wc); }
  else { g.p(25, hy + 1, wc); g.p(25, hy + 3, wc); g.p(24, hy + 2, wc); }
  return g;
}
function hat(g: Grid, id: string, hx: number, hy: number, v: View) {
  if (id === 'hat-beanie') { g.e(hx, hy - 3.2, 6.4, 3, '#e8344a'); g.r(hx - 6, hy - 2, 13, 2, '#ffd6dc'); }
  else if (id === 'hat-helmet') { g.e(hx, hy - 2.6, 7.4, 3.6, '#3a7cf0'); g.r(hx - 2, hy - 6, 4, 1, '#9cc4ff'); }
  else if (id === 'hat-goggles') {
    g.r(hx - 7, hy - 3, 15, 2, '#2b2b3a');
    if (v === 'front') { g.r(hx - 5, hy - 4, 4, 3, '#ffb21e'); g.r(hx + 1, hy - 4, 4, 3, '#ffb21e'); g.p(hx - 4, hy - 4, '#fff1b0'); g.p(hx + 2, hy - 4, '#fff1b0'); }
    else if (v !== 'back') { g.r(hx + 1, hy - 4, 4, 3, '#ffb21e'); g.p(hx + 2, hy - 4, '#fff1b0'); }
  }
}
export function lighten(hex: string, k = 0.45) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * k).toString(16).padStart(2, '0');
  return '#' + m(r) + m(g) + m(b);
}
export function darken(hex: string, k = 0.35) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c * (1 - k)).toString(16).padStart(2, '0');
  return '#' + m(r) + m(g) + m(b);
}

/** The tumble: a rolling snowball with bits of chinchilla poking out (frame 0-3). */
export function snowball(who: Who, look: Look, frame: number): Grid {
  const g = new Grid(26, 24), P = PAL[who], a = (frame % 4) * (Math.PI / 2);
  const at = (ang: number, r: number) => [13 + Math.cos(a + ang) * r, 12 + Math.sin(a + ang) * r * 0.9] as const;
  let [x, y] = at(0.3, 9); g.l(x - 4, y - 2, x + 4, y + 2, look.skis);
  [x, y] = at(2.2, 9); g.e(x, y, 2.6, 2.6, P.earOut); g.e(x, y, 1.3, 1.3, P.ear);
  [x, y] = at(3.6, 9); g.e(x, y, 2.6, 2.2, P.shade);
  [x, y] = at(4.8, 9); g.r(x - 1, y - 1, 3, 2, P.fur);
  g.e(13, 12, 9, 8.4, '#f6faff'); g.e(15, 14, 5, 4, '#dbe7f6'); g.e(10, 9, 3, 2.5, WHITE);
  [x, y] = at(1.2, 5); g.r(x - 1, y, 3, 2, look.scarf);
  g.outline();
  [x, y] = at(-0.6, 5); g.p(x, y, P.eye); g.p(x + 2, y, P.eye);
  return g;
}

// ---------------------------------------------------------------- the animals
export function animal(k: 'skier' | 'stoat' | 'rabbit' | 'hedgehog', frame: number): Grid {
  const f = frame & 1;
  if (k === 'rabbit') {
    const g = new Grid(30, 22);
    g.l(3, 18, 24, 18, '#7a3a20'); g.r(4, 14, 20, 4, '#d8333f'); g.r(24, 12, 2, 5, '#d8333f'); g.p(26, 11, '#d8333f'); g.r(5, 15, 18, 1, '#ff6b74');
    g.e(13, 11, 5, 4, '#f4f0ea'); g.e(18, 7, 3.6, 3.2, '#f4f0ea');
    g.e(13 - f, 3, 1.4, 3.4, '#f4f0ea'); g.e(10 - f, 4, 1.4, 3.2, '#f4f0ea'); g.e(9, 12, 2, 2, '#ffffff');
    g.r(14, 11, 6, 2, '#5aa0e8');
    g.outline();
    g.p(19, 6, INK); g.p(21, 8, NOSE); g.p(13 - f, 2, '#f6a3b6'); g.p(13 - f, 3, '#f6a3b6');
    return g;
  }
  if (k === 'hedgehog') {
    const g = new Grid(26, 20);
    g.e(13, 13, 11, 5, '#c7ccd8'); g.e(13, 12.5, 9, 3.6, '#e8ecf4'); g.p(5 + f * 14, 13, WHITE); g.p(6 + f * 14, 12, WHITE);
    g.e(13, 9, 6, 5, '#6b4a2e');
    for (let i = 0; i < 7; i++) g.p(8 + i * 1.6, 4 + (i % 2), '#4a321e');
    g.e(13, 11, 3.6, 2.6, '#e6c79a');
    g.outline();
    g.p(11, 10, INK); g.p(15, 10, INK); g.p(13, 12, INK);
    return g;
  }
  const g = new Grid(26, 28), body = k === 'skier' ? '#9a6a3e' : '#f6f4ee', belly = k === 'skier' ? '#e4c79a' : '#ffffff';
  g.l(4, 25, 22, 22, '#3a7cf0'); g.l(5, 27, 23, 24, '#3a7cf0');
  if (k === 'stoat') { g.e(5, 18, 4, 1.6, body); g.r(1, 17, 2, 2, '#22222a'); }
  g.e(13, 18, 5, 5.5, body); g.e(14, 19, 3, 3.5, belly);
  g.r(10, 22, 3, 2, BOOT); g.r(15, 22, 3, 2, BOOT);
  g.e(15, 9, 5, 4.4, body); g.e(18, 10.5, 2.6, 2, belly);
  g.e(12, 5.5, 1.8, 1.8, body); g.e(17, 5, 1.8, 1.8, body);
  if (k === 'skier') { g.e(15, 6, 5.2, 2.6, '#2f9e6a'); g.e(15, 3, 1.8, 1.8, '#ffffff'); g.r(10, 7, 11, 1, '#ffffff'); }
  else g.r(9, 13, 11, 2, '#ffb21e');
  g.r(19, 16 + f, 2, 2, body); g.l(20, 18, 23, 24, POLE);
  g.outline();
  g.p(17, 9, INK); g.p(20, 10, INK);
  return g;
}

// ---------------------------------------------------------------- the mountain
export const SNOW = '#f2f6fd', SNOW2 = '#e2ebf8', SNOW3 = '#c9d8ee', SHADOW = '#b9c8e4';
export function pine(size: 0 | 1, v: number): Grid {
  const h = size ? 36 : 26, w = size ? 26 : 20, g = new Grid(w, h), cx = w / 2;
  g.r(cx - 1.5, h - 6, 3, 5, '#7a4a2a');
  const tiers = size ? 4 : 3, dark = ['#1b5e48', '#22684a', '#1e6450', '#1b5a44'][v & 3];
  for (let t = 0; t < tiers; t++) {
    const top = 1 + t * (size ? 7 : 6), bot = top + (size ? 12 : 10), half = (size ? 5 : 4) + t * (size ? 2.6 : 2.4);
    for (let y = top; y <= bot; y++) { const k = (y - top) / (bot - top), ww = Math.max(1, half * k); g.r(cx - ww, y, ww * 2, 1, dark); if (k > 0.3) g.r(cx - ww + 1, y, Math.max(1, ww * 0.8), 1, '#2f8f5f'); }
    // snow along the top of each tier
    for (let y = top; y <= top + 3; y++) { const k = (y - top) / (bot - top), ww = Math.max(1, half * k * 0.9); g.r(cx - ww, y, ww * 1.4, 1, y === top + 3 ? '#cfe0f2' : SNOW); }
    g.r(cx - half + 1, bot - 1, 3, 1, SNOW); g.r(cx + half - 4, bot, 3, 1, SNOW);
  }
  return g.outline('#123528');
}
export function birch(v: number): Grid {
  const g = new Grid(18, 34);
  g.l(9, 14, 3, 6 + (v & 1), '#7a5a44'); g.l(9, 10, 15, 3, '#7a5a44'); g.l(9, 18, 14, 13, '#7a5a44'); g.l(9, 7, 6, 1, '#7a5a44');
  g.r(8, 3, 3, 30, '#efe9de'); g.r(10, 3, 1, 30, '#cfc6b6');
  for (let y = 6; y < 32; y += 4 + ((y + v) % 3)) g.r(8 + ((y + v) & 1), y, 2, 1, '#2a2a30');
  g.p(3, 5 + (v & 1), SNOW); g.p(15, 2, SNOW); g.p(14, 12, '#ffd36a'); g.p(4, 6, '#ffd36a');
  return g.outline('#3a3240');
}
export function rock(v: number): Grid {
  const g = new Grid(20, 14);
  g.e(10, 8, 8.5, 5.5, '#7c8597'); g.e(8, 7, 5, 3.5, '#a3acbd'); g.e(14, 10, 4, 2.6, '#5f6779');
  g.e(9, 4.5 + (v & 1) * 0.5, 6, 2.2, SNOW); g.p(13, 5, SNOW);
  return g.outline('#2c3040');
}
export function stump(): Grid {
  const g = new Grid(16, 13);
  g.r(3, 5, 10, 6, '#8a5530'); g.r(4, 5, 2, 6, '#a86a3a'); g.e(8, 5, 5, 2.4, '#d9a46a'); g.e(8, 5, 2.6, 1.2, '#b8803e'); g.e(7, 4, 4, 1.4, SNOW);
  return g.outline('#3a2414');
}
export function bank(): Grid {
  const g = new Grid(32, 14);
  g.e(16, 9, 15, 5, SNOW3); g.e(15, 7.5, 13, 5, SNOW); g.e(11, 6, 5, 2.5, WHITE); g.p(20, 6, '#cfe8ff'); g.p(8, 9, '#cfe8ff');
  return g.outline('#8fa6c8');
}
export function fence(): Grid {
  const g = new Grid(30, 14);
  g.r(2, 2, 3, 11, '#8a5530'); g.r(25, 2, 3, 11, '#8a5530'); g.r(0, 4, 30, 2, '#b8743a'); g.r(0, 8, 30, 2, '#b8743a');
  g.r(0, 3, 30, 1, SNOW); g.r(2, 1, 3, 1, SNOW); g.r(25, 1, 3, 1, SNOW);
  return g.outline('#3a2414');
}
export function hut(v: number): Grid {
  const g = new Grid(38, 40), roof = ['#c8384a', '#3a6cc8', '#2f8f5f', '#d88a2a'][v & 3];
  g.r(5, 18, 28, 18, '#b8743a'); for (let y = 20; y < 36; y += 4) g.r(5, y, 28, 1, '#8a5530');
  g.r(15, 25, 8, 11, '#6a3c20'); g.p(21, 30, '#ffd23a');
  g.r(7, 22, 6, 5, '#ffe28a'); g.r(25, 22, 6, 5, '#ffe28a'); g.r(9, 22, 1, 5, '#8a5530'); g.r(27, 22, 1, 5, '#8a5530');
  for (let y = 4; y < 19; y++) { const w = 4 + (y - 4) * 1.35; g.r(19 - w, y, w * 2, 1, roof); }
  for (let y = 4; y < 12; y++) { const w = 3 + (y - 4) * 1.35; g.r(19 - w, y, w * 2, 1, SNOW); }
  g.r(0, 18, 38, 2, SNOW);
  return g.outline('#2a1a10');
}
export function cabin(visited: boolean): Grid {
  const g = new Grid(64, 60);
  g.r(26, 6, 6, 12, '#7c8597'); g.r(26, 5, 6, 2, SNOW);
  g.r(6, 26, 52, 26, '#a5652f'); for (let y = 28; y < 52; y += 4) g.r(6, y, 52, 1, '#7a4a22');
  for (let y = 8; y < 28; y++) { const w = 6 + (y - 8) * 1.45; g.r(32 - w, y, w * 2, 1, '#8a2f3a'); }
  for (let y = 8; y < 19; y++) { const w = 5 + (y - 8) * 1.45; g.r(32 - w, y, w * 2, 1, SNOW); }
  g.r(2, 26, 60, 2, SNOW);
  g.r(10, 32, 9, 8, '#ffd25a'); g.r(45, 32, 9, 8, '#ffd25a'); g.r(14, 32, 1, 8, '#7a4a22'); g.r(10, 35, 9, 1, '#7a4a22'); g.r(49, 32, 1, 8, '#7a4a22'); g.r(45, 35, 9, 1, '#7a4a22');
  g.r(27, 36, 10, 16, '#5a3018'); g.p(35, 44, '#ffd23a');
  // the porch, the lantern and the red postbox
  g.r(4, 52, 56, 4, '#c88a4a'); g.r(4, 52, 56, 1, '#e0a868');
  g.r(42, 44, 5, 8, visited ? '#9a4040' : '#e8344a'); g.r(41, 43, 7, 2, visited ? '#7a3030' : '#ff5a6a'); g.r(43, 46, 3, 1, INK);
  g.r(21, 38, 3, 4, '#ffcf4a');
  return g.outline('#2a1a10');
}
export function sign(): Grid {
  const g = new Grid(20, 22);
  g.r(9, 8, 2, 14, '#7a4a2a'); g.r(2, 3, 14, 7, '#c88a4a'); g.r(16, 4, 2, 5, '#c88a4a'); g.p(18, 6, '#c88a4a');
  g.r(5, 5, 6, 3, '#ffffff'); g.l(5, 5, 8, 7, '#e8344a'); g.l(10, 5, 8, 7, '#e8344a'); g.r(2, 2, 14, 1, SNOW);
  return g.outline('#2a1a10');
}
export function flag(red: boolean): Grid {
  const g = new Grid(10, 22), c = red ? '#e8344a' : '#2f6fe0';
  g.r(3, 2, 2, 19, '#f0f0f0'); g.r(3, 6, 2, 2, c); g.r(3, 12, 2, 2, c);
  g.r(5, 2, 4, 5, c); g.r(5, 2, 4, 1, lighten(c));
  return g.outline('#20202e');
}
export function ramp(big: boolean): Grid {
  const w = big ? 50 : 36, h = big ? 26 : 18, g = new Grid(w, h);
  for (let y = 2; y < h - 2; y++) g.r(2, y, w - 4, 1, y < h * 0.4 ? SNOW : y < h * 0.75 ? SNOW2 : SNOW3);
  g.r(2, h - 4, w - 4, 2, big ? '#e8344a' : '#2f6fe0');
  for (let x = 4; x < w - 4; x += 6) g.r(x, h - 4, 3, 2, '#ffffff');
  g.r(1, 1, 2, h - 2, '#ff8a2a'); g.r(w - 3, 1, 2, h - 2, '#ff8a2a');
  if (big) { g.r(4, 4, w - 8, 1, '#ffffff'); g.r(6, 8, w - 12, 1, '#ffffff'); }
  return g.outline('#5a6a8e');
}
export function mogul(): Grid {
  const g = new Grid(14, 8);
  g.e(7, 5, 6, 2.6, SNOW3); g.e(7, 3.6, 5.4, 2.6, SNOW); g.p(5, 3, WHITE); g.p(6, 2, WHITE);
  return g;
}
export function lantern(): Grid { const g = new Grid(6, 8); g.r(1, 2, 4, 5, '#ffcf4a'); g.r(2, 0, 2, 2, INK); return g.outline(); }

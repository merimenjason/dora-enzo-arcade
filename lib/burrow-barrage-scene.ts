// Burrow Barrage, drawing only. The Stage plays the engine's events back in order (shots, blasts, falls) and keeps its
// own copy of the ground, so a crater appears when its shot lands on screen and not the moment the engine works it out.
import { W, H, UNIT_UP, MAX_WIND, PATH_RATE, type Match, type Event, type RideId } from './burrow-barrage-game';
import { coatLike, drawChinchilla, type Coat } from './chinchilla-art';
import { fitDraw } from './art-fit';

export const CELL = 2, VIEW_W = W * CELL, VIEW_H = H * CELL;
type C2D = CanvasRenderingContext2D;
type RGB = [number, number, number];

const fur = (base: 'dora' | 'enzo', f: string, back: string, face: string, shade: string, over: Partial<Coat> = {}): Coat =>
  coatLike(base, { fur: f, back, face, shade, texture: shade, tail: f, tailOuter: back, tailInner: face, ...over });
const dark = { eye: '#0e0c12', pupil: '#000000', eyeR: 1.7 };
/** Dora and Enzo, then the six rival pairs of the ladder. */
const COAT: Record<string, Coat | 'dora' | 'enzo'> = {
  dora: 'dora', enzo: 'enzo',
  pip: fur('dora', '#eeeaf0', '#dad3df', '#f6f3f8', '#ccc4d2', dark),
  mora: fur('enzo', '#a9a7b0', '#8a8891', '#c4c2ca', '#96949d', { bands: false }),
  tumble: fur('dora', '#ecd6b3', '#d8bc90', '#f4e4cb', '#caa97e', dark),
  sprout: fur('enzo', '#8f9a6c', '#6c7650', '#a9b388', '#78825a', { bands: false }),
  ash: fur('enzo', '#5b5a63', '#3c3b43', '#75747d', '#48474f'),
  cinder: fur('dora', '#e9b08c', '#d18f68', '#f3c8ab', '#c98562', dark),
  gust: fur('dora', '#cfe2ee', '#abc6d8', '#e4f0f7', '#9fbccf', dark),
  breeze: fur('enzo', '#7f93a8', '#5d7187', '#9cafc2', '#687c92', { bands: false }),
  flint: fur('enzo', '#9a6a48', '#74492e', '#b58560', '#80553a', { belly: '#f1dfc8', line: '#2e1c14', bands: false }),
  slate: fur('enzo', '#62707a', '#44515a', '#7e8c96', '#4f5c66'),
  onyx: fur('enzo', '#34323a', '#1f1e24', '#4b4952', '#29282e', { belly: '#c9c5cc' }),
  opal: fur('dora', '#f1e6f4', '#dccbe3', '#f9f2fb', '#cdb9d6', { eye: '#3a5fa8', pupil: '#101c3a', eyeR: 1.7 }),
};
const TEAM = ['#ffcf5a', '#ff7a66'];
const RIDE_COLOR: Record<RideId, [string, string]> = { catapult: ['#c98a3c', '#7a4c1c'], spitter: ['#6fbf73', '#2f6b3c'], digger: ['#9aa3b5', '#4d5568'], cannon: ['#d9c7a8', '#8a7352'] };

type Theme = { sky: [string, string]; far: string; grass: string; under: string; soil: string; deep: string; mote: string };
/** One look per map, in the order of MAPS. */
const THEMES: Theme[] = [
  { sky: ['#7cc6f2', '#e8f6df'], far: '#a9d7a0', grass: '#86d15f', under: '#4f9a3d', soil: '#9a6b42', deep: '#7d5433', mote: '#ffffff' },
  { sky: ['#8fd0cb', '#eef5d6'], far: '#8fbf9a', grass: '#64b56f', under: '#3b8050', soil: '#6d5a44', deep: '#57463a', mote: '#f2ffe6' },
  { sky: ['#f3a877', '#fdebc9'], far: '#e0b47c', grass: '#d2bb5c', under: '#a08b3c', soil: '#a56c3f', deep: '#86532f', mote: '#fff3d6' },
  { sky: ['#7fb0ec', '#e2edf8'], far: '#b9c7da', grass: '#d8ad72', under: '#a97b45', soil: '#8b8f98', deep: '#6f737c', mote: '#ffffff' },
  { sky: ['#5f97e4', '#dcedff'], far: '#c6dcf5', grass: '#93dc8c', under: '#5cae62', soil: '#b08c6a', deep: '#8f6f52', mote: '#ffffff' },
  { sky: ['#565aa4', '#ebb9a6'], far: '#8d83b4', grass: '#e6e9f2', under: '#a9afc0', soil: '#5d6072', deep: '#4a4c5c', mote: '#ffe9df' },
];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** `a` moved `k` of the way towards `b`. */
const blend = (a: string, b: string, k: number) => { const p = rgb(a), q = rgb(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',')})`; };
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };

/** The far view behind a map: sky, sun or moon, a range of peaks and two lines of hills, each paler the further off it is. */
function paintBackdrop(c: C2D, th: Theme, map: number) {
  const night = map % THEMES.length === 5, sky = c.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, blend(th.sky[0], '#1c2a6a', 0.22)); sky.addColorStop(0.35, th.sky[0]); sky.addColorStop(0.78, th.sky[1]); sky.addColorStop(1, th.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (night) for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255, 255, 255, ${0.25 + noise(i) * 0.6})`; c.beginPath(); c.arc(noise(i + 9) * VIEW_W, noise(i + 40) * 190, 0.5 + noise(i + 70) * 0.9, 0, 7); c.fill(); }
  const sx = VIEW_W * 0.82, sy = 62;
  for (const [r, a] of [[170, 0.2], [80, 0.3], [42, 0.4]]) { const g = c.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(255, 246, 210, ${a})`); g.addColorStop(1, 'rgba(255, 246, 210, 0)'); c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2); }
  c.fillStyle = night ? '#f4f0ff' : '#fffbe6'; c.beginPath(); c.arc(sx, sy, 24, 0, 7); c.fill();
  if (night) { c.fillStyle = 'rgba(160, 160, 200, 0.4)'; for (const [dx, dy, r] of [[-8, -5, 5], [7, 6, 3.4], [4, -10, 2.4]]) { c.beginPath(); c.arc(sx + dx, sy + dy, r, 0, 7); c.fill(); } }
  // Peaks, lit from the sun's side, with snow on the tall ones.
  const haze = th.sky[1], peak = blend(th.far, haze, 0.55), base = 300;
  for (let i = 0; i < 9; i++) {
    const x = -40 + i * 108 + noise(i + map * 3) * 50, h = 90 + noise(i * 2 + map) * 90, w = 90 + noise(i * 5 + map) * 70;
    c.fillStyle = peak; c.beginPath(); c.moveTo(x - w, base); c.lineTo(x - w * 0.3, base - h * 0.62); c.lineTo(x, base - h); c.lineTo(x + w * 0.4, base - h * 0.5); c.lineTo(x + w, base); c.fill();
    c.fillStyle = blend(peak, '#ffffff', 0.3); c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + w * 0.4, base - h * 0.5); c.lineTo(x + w, base); c.lineTo(x + w * 0.2, base); c.fill();
    if (h > 120) { c.fillStyle = 'rgba(255, 255, 255, 0.8)'; c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + w * 0.16, base - h * 0.8); c.lineTo(x + w * 0.06, base - h * 0.74); c.lineTo(x - w * 0.02, base - h * 0.82); c.lineTo(x - w * 0.1, base - h * 0.76); c.lineTo(x - w * 0.14, base - h * 0.82); c.fill(); }
  }
  const mist = c.createLinearGradient(0, 200, 0, 310); mist.addColorStop(0, 'rgba(255, 255, 255, 0)'); mist.addColorStop(1, blend(haze, '#ffffff', 0.4)); c.fillStyle = mist; c.globalAlpha = 0.75; c.fillRect(0, 200, VIEW_W, 110); c.globalAlpha = 1;
  // Two lines of hills in front of them, the nearer one darker and dotted with trees.
  const ridge = (y0: number, amp: number, col: string, phase: number) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, VIEW_H); for (let x = 0; x <= VIEW_W; x += 8) c.lineTo(x, y0 + amp * Math.sin(x / 97 + phase) + amp * 0.58 * Math.sin(x / 41 + phase * 2)); c.lineTo(VIEW_W, VIEW_H); c.fill(); };
  const lineAt = (x: number, y0: number, amp: number, phase: number) => y0 + amp * Math.sin(x / 97 + phase) + amp * 0.58 * Math.sin(x / 41 + phase * 2);
  ridge(228, 30, blend(th.far, haze, 0.38), map + 2.4);
  ridge(250, 38, blend(th.far, haze, 0.1), map);
  const tree = blend(th.far, '#1f3a2c', 0.4);
  for (let i = 0; i < 70; i++) { const x = noise(i * 3 + map) * VIEW_W, y = lineAt(x, 250, 38, map) + 2 + noise(i) * 26, k = 0.6 + noise(i + 5) * 0.7; c.fillStyle = tree; c.globalAlpha = 0.55; c.beginPath(); c.moveTo(x - 4 * k, y); c.lineTo(x, y - 11 * k); c.lineTo(x + 4 * k, y); c.fill(); }
  c.globalAlpha = 1;
  const low = c.createLinearGradient(0, 260, 0, VIEW_H); low.addColorStop(0, 'rgba(255, 255, 255, 0)'); low.addColorStop(1, blend(haze, '#ffffff', 0.2)); c.fillStyle = low; c.globalAlpha = 0.5; c.fillRect(0, 260, VIEW_W, VIEW_H - 260); c.globalAlpha = 1;
}

type Sprite = { id: number; x: number; y: number; hp: number; alive: boolean; fade: number; flash: number; fx: number; fy: number; tx: number; ty: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Float = { x: number; y: number; text: string; life: number; color: string };
/** What the page adds on top: the aiming guide for the unit whose turn it is, and how full the power bar is while charging. */
export type Overlay = { guide: number[] | null; charging: number };

function rideBody(c: C2D, ride: RideId, x: number, feet: number, team: number) {
  const [body, edge] = RIDE_COLOR[ride];
  c.fillStyle = 'rgba(20, 16, 40, 0.25)'; c.beginPath(); c.ellipse(x, feet + 0.4, 14, 2.4, 0, 0, 7); c.fill();
  // The cart: lit along the top, planked, with the team's stripe and a brass corner on each end.
  const wood = c.createLinearGradient(0, feet - 10.5, 0, feet - 3); wood.addColorStop(0, blend(body, '#ffffff', 0.4)); wood.addColorStop(0.45, body); wood.addColorStop(1, blend(body, edge, 0.6));
  c.lineWidth = 1.5; c.strokeStyle = edge; c.fillStyle = wood;
  c.beginPath(); c.roundRect(x - 12.5, feet - 10.5, 25, 7.5, 3); c.fill(); c.stroke();
  c.strokeStyle = blend(body, edge, 0.5); c.lineWidth = 0.6; c.beginPath(); for (const dx of [-6, 0, 6]) { c.moveTo(x + dx, feet - 7.4); c.lineTo(x + dx, feet - 3.6); } c.stroke();
  c.fillStyle = TEAM[team]; c.fillRect(x - 10.5, feet - 9.4, 21, 2.2); c.fillStyle = 'rgba(255, 255, 255, 0.45)'; c.fillRect(x - 10.5, feet - 9.4, 21, 0.7);
  for (const dx of [-7, 7]) {
    c.fillStyle = '#2c2420'; c.beginPath(); c.arc(x + dx, feet - 3, 3.5, 0, 7); c.fill();
    c.strokeStyle = '#8a7a66'; c.lineWidth = 0.7; c.beginPath(); for (let a = 0; a < 3; a++) { const r = a * 1.047 + x * 0.25; c.moveTo(x + dx - Math.cos(r) * 2.6, feet - 3 - Math.sin(r) * 2.6); c.lineTo(x + dx + Math.cos(r) * 2.6, feet - 3 + Math.sin(r) * 2.6); } c.stroke();
    c.fillStyle = '#e2d2b6'; c.beginPath(); c.arc(x + dx, feet - 3, 1.2, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.35)'; c.lineWidth = 0.7; c.beginPath(); c.arc(x + dx, feet - 3, 3, 3.6, 5.2); c.stroke();
  }
}
/** The weapon, swung to the aiming angle. */
function rideArm(c: C2D, ride: RideId, x: number, y: number, angle: number) {
  const [body, edge] = RIDE_COLOR[ride];
  c.save(); c.translate(x, y); c.rotate((-angle * Math.PI) / 180);
  const metal = c.createLinearGradient(0, -5, 0, 5); metal.addColorStop(0, blend(body, '#ffffff', 0.45)); metal.addColorStop(0.5, body); metal.addColorStop(1, blend(body, edge, 0.55));
  c.strokeStyle = edge; c.fillStyle = metal; c.lineWidth = 1.5; c.lineCap = 'round';
  if (ride === 'catapult') { c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(13, 0); c.stroke(); c.strokeStyle = blend(body, '#ffffff', 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(1, -0.8); c.lineTo(12, -0.8); c.stroke(); c.strokeStyle = edge; c.lineWidth = 1.2; c.fillStyle = '#f0d46a'; c.fillRect(11, -3.5, 6, 7); c.strokeRect(11, -3.5, 6, 7); c.fillStyle = '#fff1b0'; c.fillRect(11.6, -2.9, 4.8, 1.6); c.beginPath(); c.moveTo(11, 0.4); c.lineTo(17, 0.4); c.stroke(); }
  else if (ride === 'spitter') { c.beginPath(); c.roundRect(0, -2.5, 16, 5, 2); c.fill(); c.stroke(); c.fillStyle = edge; c.fillRect(13, -3.5, 3, 7); }
  else if (ride === 'digger') { c.beginPath(); c.moveTo(0, -4); c.lineTo(9, -4); c.lineTo(18, 0); c.lineTo(9, 4); c.lineTo(0, 4); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(9, -4); c.lineTo(9, 4); c.stroke(); }
  else { c.beginPath(); c.moveTo(0, -3); c.lineTo(11, -3); c.lineTo(17, -6.5); c.lineTo(17, 6.5); c.lineTo(11, 3); c.lineTo(0, 3); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function drawUnit(c: C2D, coat: string, ride: RideId, team: number, x: number, feet: number, angle: number, time: number, o: { dizzy?: boolean; moving?: boolean } = {}) {
  const face = angle <= 90 ? 1 : -1;
  drawChinchilla(c, COAT[coat] ?? 'dora', x - face * 2, feet - 8, { face, h: 21, time, blink: time % 4 < 0.14, dizzy: o.dizzy });
  rideBody(c, ride, x, feet, team);
  rideArm(c, ride, x + face * 3, feet - 13, angle);
}
/** A chinchilla on its ride, for the menu. */
export function drawRideIcon(c: C2D, coat: string, ride: RideId, team: number, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  fitDraw(c, `ride-${coat}-${ride}-${team}`, 1, 1, w - 2, h - 2, (q) => drawUnit(q, coat, ride, team, 0, 0, team === 0 ? 40 : 140, 0.4));
}
function drawBall(c: C2D, ride: RideId, shot: number, marker: boolean, x: number, y: number, spin: number) {
  c.save(); c.translate(x, y);
  if (marker) { c.fillStyle = '#ff8fc0'; c.strokeStyle = '#8a2a58'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 3.5, 0, 7); c.fill(); c.stroke(); c.restore(); return; }
  const big = shot === 1 || (ride === 'digger' && shot === 2) ? 1.25 : 1;
  c.scale(big, big); c.lineWidth = 1.2;
  if (ride === 'catapult') { c.rotate(spin * 6); c.fillStyle = '#f0d46a'; c.strokeStyle = '#9a7420'; c.fillRect(-4, -4, 8, 8); c.fillStyle = '#fff1b0'; c.fillRect(-4, -4, 8, 2.4); c.fillStyle = 'rgba(120, 80, 10, 0.3)'; c.fillRect(-4, 2, 8, 2); c.strokeRect(-4, -4, 8, 8); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.moveTo(-1.5, -4); c.lineTo(-1.5, 4); c.moveTo(1.5, -4); c.lineTo(1.5, 4); c.stroke(); }
  else if (ride === 'spitter') { c.rotate(spin * 9); c.fillStyle = '#7a4c22'; c.beginPath(); c.ellipse(0, 0, 3.4, 2, 0, 0, 7); c.fill(); c.fillStyle = '#c99a5c'; c.beginPath(); c.ellipse(-0.6, -0.5, 1.4, 0.7, 0, 0, 7); c.fill(); }
  else if (ride === 'digger') { c.rotate(spin * 14); c.fillStyle = '#8b93a6'; c.strokeStyle = '#3c4354'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -3.5); c.lineTo(-3, 3.5); c.closePath(); c.fill(); c.stroke(); }
  else { c.fillStyle = 'rgba(240, 228, 205, 0.9)'; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.arc(3, -2, 3, 0, 7); c.arc(-3, 1.5, 3, 0, 7); c.fill(); }
  c.restore();
}

/** How many cells under the surface the soil goes on getting darker. */
const DEEP = 14;

export class Stage {
  ground: Uint8Array;
  sprites: Sprite[];
  wind = 0; activeId = 0; turn = 1;
  busy = false; speed = 1;
  /** 1 shows the whole map. Above 1 the camera closes in and follows whoever's turn it is, then the shot. */
  zoom = 1;
  /** How much larger to draw the wind gauge and the banner, for a board shown small. */
  hud = 1;
  private camX = VIEW_W / 2; private camY = VIEW_H / 2; private panX = 0; private panY = 0; private snap = true;
  sfx: (name: string) => void = () => {};
  private theme: Theme; private tones: RGB[];
  private land: HTMLCanvasElement; private img: ImageData; private back: HTMLCanvasElement | null = null; private backKey = '';
  private queue: Event[] = []; private cur: Event | null = null; private t = 0; private dur = 0;
  private sparks: Spark[] = []; private floats: Float[] = [];
  /** Smoke that hangs over a crater and drifts with the wind after the flash has gone. */
  private smoke: { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number }[] = [];
  private shake = 0; private banner = ''; private bannerLife = 0; private dusk = 0;

  constructor(m: Match) {
    this.theme = THEMES[m.map % THEMES.length];
    this.tones = [rgb(this.theme.grass), rgb(this.theme.under), rgb(this.theme.soil), rgb(this.theme.deep)];
    this.ground = m.terrain.slice();
    this.land = document.createElement('canvas'); this.land.width = W; this.land.height = H;
    this.img = new ImageData(W, H);
    this.paint(0, 0, W - 1, H - 1);
    this.sprites = m.units.map((u) => ({ id: u.id, x: u.x, y: u.y, hp: u.hp, alive: u.alive, fade: u.alive ? 0 : 1, flash: 0, fx: u.x, fy: u.y, tx: u.x, ty: u.y }));
    this.sync(m);
  }

  /** Repaints the ground picture inside a box of cells. */
  private paint(x0: number, y0: number, x1: number, y1: number) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    if (x1 < x0 || y1 < y0) return;
    const d = this.img.data, g = this.ground, [grass, under, soil, deep] = this.tones;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (!g[y * W + x]) { d[i + 3] = 0; continue; }
      // How far under open air this cell is, which decides turf, the darker root layer, or soil.
      let depth = 1; while (depth <= DEEP && y - depth >= 0 && g[(y - depth) * W + x]) depth++;
      const n = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 97, wall = (x > 0 && !g[y * W + x - 1]) || (x < W - 1 && !g[y * W + x + 1]) || (y < H - 1 && !g[(y + 1) * W + x]);
      let r: number, gr: number, b: number, k = 1;
      if (depth === 1) { [r, gr, b] = grass; k = x % 3 === 0 ? 1.12 : 1.02; }
      else if (depth <= 3 + (x % 5 === 0 ? 2 : x % 2)) { [r, gr, b] = under; k = depth === 2 ? 1.06 : 0.94; }
      else {
        // Soil darkens with depth below the surface and down the map, in wavering bands, with stones and darker clods.
        const t = Math.min(1, (depth - 3) / (DEEP - 3)) * 0.55 + (y / H) * 0.45;
        r = soil[0] + (deep[0] - soil[0]) * t; gr = soil[1] + (deep[1] - soil[1]) * t; b = soil[2] + (deep[2] - soil[2]) * t;
        k = 1 + 0.05 * Math.sin(y * 0.55 + Math.sin(x * 0.045) * 3) - (y / H) * 0.14;
        if (n < 9) k *= 0.84; else if (n > 93) k *= 1.22; else if (depth <= 6) k *= 0.9;
      }
      if (wall && depth > 1) k *= 0.8;
      d[i] = Math.min(255, r * k); d[i + 1] = Math.min(255, gr * k); d[i + 2] = Math.min(255, b * k); d[i + 3] = 255;
    }
    this.land.getContext('2d')!.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }
  private dig(circles: number[]) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let n = 0; n < circles.length; n += 3) {
      const cx = circles[n], cy = circles[n + 1], r = circles[n + 2];
      const ax = Math.max(0, Math.floor(cx - r)), bx = Math.min(W - 1, Math.ceil(cx + r)), ay = Math.max(0, Math.floor(cy - r)), by = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.ground[y * W + x] = 0;
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    }
    // The turf and the soil's shading depend on how far under open air a cell is, so repaint that far below the hole as well.
    this.paint(x0 - 1, y0, x1 + 1, y1 + DEEP + 1);
  }
  private burst(x: number, y: number, n: number, colors: string[], power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * power, life = 0.35 + Math.random() * 0.45;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.5, life, max: life, color: colors[i % colors.length], size: 1.5 + Math.random() * 2.5 });
    }
  }

  feed(events: Event[]) { this.queue.push(...events); if (this.queue.length) { this.busy = true; this.panX = this.panY = 0; } }
  /** Slides a zoomed-in view by a drag, in view pixels; the view goes back to the action on the next turn or shot. */
  pan(dx: number, dy: number) { this.panX += dx; this.panY += dy; }
  /** A point on the canvas (in view pixels) as a point on the map, allowing for the camera. */
  toWorld(px: number, py: number): [number, number] { return [(px - VIEW_W / 2) / this.zoom + this.camX, (py - VIEW_H / 2) / this.zoom + this.camY]; }
  /** Moves the camera towards what matters now: the shot in the air, the blast, whoever is being knocked about, or whoever's turn it is. */
  private follow(dt: number) {
    const e = this.cur, s = e && 'id' in e && e.type !== 'turn' ? this.sprites[e.id] : this.sprites[this.activeId];
    let [tx, ty] = [(s.x + 0.5) * CELL + this.panX, (s.y - UNIT_UP) * CELL + this.panY];
    if (e?.type === 'shot' && e.path.length) [tx, ty] = this.ball(e);
    else if (e?.type === 'boom') [tx, ty] = [e.x * CELL, e.y * CELL];
    // Keep the view inside the map; at zoom 1 that pins it to the middle.
    const hw = VIEW_W / 2 / this.zoom, hh = VIEW_H / 2 / this.zoom;
    tx = Math.max(hw, Math.min(VIEW_W - hw, tx)); ty = Math.max(hh, Math.min(VIEW_H - hh, ty));
    // A pan cannot push the view past the edge and then have to be dragged all the way back.
    if (!e) { this.panX = tx - (s.x + 0.5) * CELL; this.panY = ty - (s.y - UNIT_UP) * CELL; }
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 7);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k; this.snap = false;
  }
  /** Copies where everything stands from the engine. Only safe when nothing is playing. */
  sync(m: Match) {
    for (const s of this.sprites) { const u = m.units[s.id]; s.x = s.fx = s.tx = u.x; s.y = s.fy = s.ty = u.y; s.hp = u.hp; s.alive = u.alive; if (!u.alive) s.fade = 1; }
    this.wind = m.wind; this.activeId = m.activeId; this.turn = m.turn;
  }
  /** Skips to the end of whatever is playing. */
  flush(m: Match) {
    this.queue.length = 0; this.cur = null; this.busy = false;
    this.ground = m.terrain.slice(); this.paint(0, 0, W - 1, H - 1);
    this.sync(m);
    this.panX = this.panY = 0; this.snap = true;
    // The banner may still name whoever's turn was skipped past.
    if (m.state === 'aim') { this.banner = `${m.active.name}’s turn`; this.bannerLife = 1.3; } else this.bannerLife = 0;
  }

  private begin(e: Event, m: Match) {
    this.cur = e; this.t = 0; this.dur = 0;
    const s = 'id' in e ? this.sprites[e.id] : null;
    if (e.type === 'turn') {
      this.activeId = e.id; this.wind = e.wind; this.turn = e.turn; this.panX = this.panY = 0;
      this.banner = `${m.units[e.id].name}’s turn`; this.bannerLife = 1.3; this.dur = 0.45; this.sfx('turn');
    } else if (e.type === 'shot') {
      this.dur = e.path.length / 2 / PATH_RATE; this.sfx(e.marker ? 'hop' : `launch-${e.ride}`);
    } else if (e.type === 'boom') {
      this.dig(e.circles);
      const x = e.x * CELL, y = e.y * CELL;
      this.burst(x, y, 10 + e.crater * 2, [this.theme.soil, this.theme.deep, this.theme.grass, '#fff2c4'], 60 + e.crater * 6);
      for (let i = 0; i < 6 + Math.floor(e.crater / 3); i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * e.crater * CELL * 0.7, life = 0.9 + Math.random() * 0.9; this.smoke.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6, vx: (Math.random() - 0.5) * 14, vy: -14 - Math.random() * 18, r: (0.35 + Math.random() * 0.4) * e.crater * CELL, life, max: life }); }
      this.shake = Math.min(9, 2 + e.crater * 0.35); this.dur = 0.26; this.sfx(e.crater >= 14 ? 'boom-big' : 'boom');
    } else if (e.type === 'hurt' && s) {
      s.hp = e.hp; s.flash = 0.3; this.dur = 0.04;
      this.floats.push({ x: s.x * CELL, y: (s.y - 20) * CELL, text: `−${e.amount}`, life: 1.1, color: '#ff8a76' }); this.sfx('hurt');
    } else if (e.type === 'shift' && s) {
      s.fx = s.x; s.fy = s.y; s.tx = e.x; s.ty = e.y;
      this.dur = Math.max(0.12, Math.min(0.6, Math.hypot(e.x - s.x, e.y - s.y) / 150));
      if (e.y - s.y > 12) this.sfx('fall');
    } else if (e.type === 'out' && s) {
      s.alive = false; this.dur = 0.5; this.sfx(e.why === 'fell' ? 'fell' : 'out');
      if (e.why === 'ko') this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 14, ['#ffffff', '#ffe9a8', '#d8d2c8'], 70);
      this.banner = e.why === 'fell' ? `${m.units[e.id].name} fell!` : `${m.units[e.id].name} is out!`; this.bannerLife = 1.3;
    } else if (e.type === 'heal' && s) {
      s.hp = e.hp; this.dur = 0.45; this.sfx('heal');
      this.floats.push({ x: s.x * CELL, y: (s.y - 20) * CELL, text: `+${e.amount}`, life: 1.1, color: '#8fe08a' });
      this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 10, ['#ffe46b', '#8fe08a'], 40);
    } else if (e.type === 'hop' && s) {
      this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 12, ['#ff8fc0', '#ffffff'], 60);
      s.x = s.fx = s.tx = e.x; s.y = s.fy = s.ty = e.y;
      this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 12, ['#ff8fc0', '#ffffff'], 60); this.dur = 0.35; this.sfx('hop');
    } else if (e.type === 'dusk') {
      this.dusk = 1; this.banner = 'Dusk: everyone tires'; this.bannerLife = 1.2; this.dur = 0.3;
    }
  }
  private end(e: Event) {
    if (e.type === 'shift') { const s = this.sprites[e.id]; s.x = e.x; s.y = e.y; }
  }
  update(dt: number, m: Match) {
    dt = Math.min(dt, 0.1);
    for (const p of this.sparks) { p.life -= dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    for (const m of this.smoke) { m.life -= dt; m.x += m.vx * dt; m.y += m.vy * dt; m.vy *= 1 - dt * 0.8; m.r += dt * 6; }
    this.smoke = this.smoke.filter((m) => m.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= 22 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 22); this.bannerLife = Math.max(0, this.bannerLife - dt);
    for (const s of this.sprites) { s.flash = Math.max(0, s.flash - dt); if (!s.alive) s.fade = Math.min(1, s.fade + dt * 2.2); }
    let left = dt * this.speed;
    // Several quick events (a row of hurts, say) can finish inside one frame.
    for (let guard = 0; guard < 40 && left > 0; guard++) {
      if (!this.cur) { const e = this.queue.shift(); if (!e) break; this.begin(e, m); }
      const e = this.cur!, room = this.dur - this.t, used = Math.min(room, left);
      this.t += used; left -= used;
      if (e.type === 'shift') { const s = this.sprites[e.id], k = this.dur ? this.t / this.dur : 1; s.x = s.fx + (s.tx - s.fx) * k; s.y = s.fy + (s.ty - s.fy) * k * k; }
      if (e.type === 'shot' && e.path.length) {
        const [x, y] = this.ball(e), boring = e.boreAt >= 0 && this.t * PATH_RATE >= e.boreAt;
        // A fading trail in the air, and thrown-up soil while a shot tunnels.
        if (boring) { if (Math.random() < 0.6) this.burst(x, y, 1, [this.theme.soil, this.theme.deep], 40); }
        else this.sparks.push({ x, y, vx: 0, vy: -40, life: 0.35, max: 0.35, color: e.marker ? '#ff8fc0' : '#ffffff', size: 2 });
      }
      if (this.t >= this.dur) { this.end(e); this.cur = null; } else break;
    }
    this.busy = !!this.cur || this.queue.length > 0;
    if (!this.busy) this.sync(m);
    this.follow(dt);
  }
  /** Where the projectile of a shot event is right now, in view pixels. */
  private ball(e: Extract<Event, { type: 'shot' }>): [number, number] {
    const n = e.path.length / 2, f = Math.min(n - 1, this.t * PATH_RATE), i = Math.floor(f), k = f - i, j = Math.min(n - 1, i + 1);
    return [(e.path[i * 2] + (e.path[j * 2] - e.path[i * 2]) * k) * CELL, (e.path[i * 2 + 1] + (e.path[j * 2 + 1] - e.path[i * 2 + 1]) * k) * CELL];
  }

  draw(c: C2D, m: Match, time: number, o: Overlay) {
    const th = this.theme;
    c.save();
    const k = Math.abs(c.getTransform().a) || 1, key = `${m.map}|${k}`;
    if (!this.back || this.backKey !== key) {
      const cv = this.back ?? document.createElement('canvas');
      cv.width = Math.ceil(VIEW_W * k); cv.height = Math.ceil(VIEW_H * k);
      const g = cv.getContext('2d')!; g.setTransform(k, 0, 0, k, 0, 0);
      paintBackdrop(g, th, m.map);
      this.back = cv; this.backKey = key;
    }
    c.drawImage(this.back, 0, 0, VIEW_W, VIEW_H);
    // Clouds drift with the wind, so the sky itself says which way a shot will bend.
    for (let i = 0; i < 5; i++) {
      const x = (((i * 233 + time * this.wind * 5 * (0.7 + (i % 3) * 0.2)) % (VIEW_W + 200)) + VIEW_W + 200) % (VIEW_W + 200) - 100, y = 36 + i * 27, s = 0.8 + (i % 3) * 0.25;
      for (const [fill, dy] of [['rgba(120, 140, 190, 0.28)', 3], ['rgba(255, 255, 255, 0.88)', 0]] as const) {
        c.fillStyle = fill; c.beginPath();
        for (const [dx, r] of [[-26, 9], [-10, 14], [8, 17], [26, 11], [40, 7]]) c.arc(x + dx * s, y + dy - r * s * 0.45, r * s, 0, 7);
        c.rect(x - 34 * s, y + dy - 5 * s, 80 * s, 5 * s); c.fill();
      }
    }
    // The drop under the map.
    const pit = c.createLinearGradient(0, VIEW_H - 46, 0, VIEW_H);
    pit.addColorStop(0, 'rgba(20, 24, 44, 0)'); pit.addColorStop(1, 'rgba(20, 24, 44, 0.55)');
    c.fillStyle = pit; c.fillRect(0, VIEW_H - 46, VIEW_W, 46);

    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    c.translate(VIEW_W / 2, VIEW_H / 2); c.scale(this.zoom, this.zoom); c.translate(-this.camX, -this.camY);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.land, 0, 0, VIEW_W, VIEW_H);
    c.imageSmoothingEnabled = true;

    for (const s of this.sprites) {
      if (s.fade >= 1) continue;
      const u = m.units[s.id], x = (s.x + 0.5) * CELL, feet = (s.y + 1) * CELL, active = s.id === this.activeId && !this.busy && m.state === 'aim';
      c.save();
      c.globalAlpha = 1 - s.fade;
      if (s.flash > 0) c.translate((Math.random() - 0.5) * 3, 0);
      drawUnit(c, u.coat, u.ride, u.team, x, feet + s.fade * 10, u.angle, time + s.id, { dizzy: !s.alive });
      c.restore();
      if (!s.alive) continue;
      const bw = 30, by = feet - 42, k = Math.max(0, s.hp / u.maxHp);
      c.fillStyle = 'rgba(18, 14, 26, 0.75)'; c.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 6);
      c.fillStyle = k > 0.5 ? '#7be07a' : k > 0.25 ? '#ffcf5a' : '#ff7a66'; c.fillRect(x - bw / 2, by, bw * k, 4);
      c.font = '700 10px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(18, 14, 26, 0.8)'; c.strokeText(u.name, x, by - 4);
      c.fillStyle = TEAM[u.team]; c.fillText(u.name, x, by - 4);
      if (active) { const b = Math.sin(time * 6) * 3; c.fillStyle = TEAM[u.team]; c.beginPath(); c.moveTo(x, by - 16 + b); c.lineTo(x - 6, by - 26 + b); c.lineTo(x + 6, by - 26 + b); c.closePath(); c.fill(); }
    }

    if (o.guide && !this.busy) {
      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (let i = 2; i < o.guide.length; i += 4) { c.globalAlpha = 1 - i / o.guide.length; c.beginPath(); c.arc(o.guide[i] * CELL, o.guide[i + 1] * CELL, 2, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    const e = this.cur;
    if (e?.type === 'shot' && e.path.length) { const [x, y] = this.ball(e); drawBall(c, e.ride, e.shot, e.marker, x, y, this.t); }
    for (const m of this.smoke) {
      const k = m.life / m.max;
      c.globalAlpha = 0.34 * Math.min(1, k * 2.2); c.fillStyle = '#4a4450'; c.beginPath(); c.arc(m.x, m.y + m.r * 0.2, m.r, 0, 7); c.fill();
      c.globalAlpha = 0.4 * Math.min(1, k * 2.2); c.fillStyle = '#d9d2c6'; c.beginPath(); c.arc(m.x - m.r * 0.15, m.y - m.r * 0.15, m.r * 0.8, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    if (e?.type === 'boom') {
      // The blast itself: a white flash, a fireball that cools as it swells, and a shock ring out to where it hurts.
      const k = this.dur ? this.t / this.dur : 1, x = e.x * CELL, y = e.y * CELL, out = 1 - (1 - k) * (1 - k), rr = (e.crater + (e.blast - e.crater) * out * 0.6) * CELL;
      if (k < 0.3) { c.globalAlpha = 1 - k / 0.3; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, e.crater * CELL * (0.8 + k), 0, 7); c.fill(); }
      const ball = c.createRadialGradient(x, y, 0, x, y, Math.max(1, rr));
      ball.addColorStop(0, `rgba(255, 252, 226, ${0.95 * (1 - k)})`); ball.addColorStop(0.5, `rgba(255, 196, 96, ${0.75 * (1 - k)})`); ball.addColorStop(1, 'rgba(232, 104, 48, 0)');
      c.globalAlpha = 1; c.fillStyle = ball; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
      c.globalAlpha = 1 - k; c.strokeStyle = '#ffffff'; c.lineWidth = 3.5 * (1 - k) + 0.8; c.beginPath(); c.arc(x, y, (e.crater + e.blast * out) * CELL, 0, 7); c.stroke();
      c.globalAlpha = 0.5 * (1 - k); c.strokeStyle = '#ffd98a'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, (e.crater + e.blast * out * 0.7) * CELL, 0, 7); c.stroke();
      c.globalAlpha = 1;
    }
    for (const p of this.sparks) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    c.globalAlpha = 1;
    c.font = '900 15px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
    for (const f of this.floats) { c.globalAlpha = Math.min(1, f.life * 2); c.lineWidth = 3; c.strokeStyle = 'rgba(18, 14, 26, 0.85)'; c.strokeText(f.text, f.x, f.y); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); }
    c.globalAlpha = 1;
    if (o.charging >= 0) {
      const u = m.active, x = (u.x + 0.5) * CELL, y = (u.y - 28) * CELL;
      c.fillStyle = 'rgba(18, 14, 26, 0.8)'; c.fillRect(x - 26, y, 52, 7);
      c.fillStyle = '#ffcf5a'; c.fillRect(x - 25, y + 1, 50 * (o.charging / 100), 5);
    }
    c.restore();

    if (this.dusk) { c.fillStyle = 'rgba(40, 24, 70, 0.22)'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    // Wind gauge: the arrow's length is the wind's strength.
    c.save(); c.translate(VIEW_W / 2, 0); c.scale(this.hud, this.hud); c.translate(-VIEW_W / 2, 0);
    const gx = VIEW_W / 2, gy = 26, len = 10 + (Math.abs(this.wind) / MAX_WIND) * 70, dir = Math.sign(this.wind);
    c.fillStyle = 'rgba(18, 14, 26, 0.72)'; c.beginPath(); c.roundRect(gx - 60, gy - 18, 120, 38, 10); c.fill();
    c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = '900 13px ui-sans-serif, system-ui, sans-serif';
    c.fillText(this.wind === 0 ? 'WIND calm' : `WIND ${Math.abs(this.wind)}`, gx, gy - 3);
    if (dir) {
      c.strokeStyle = '#7fd4ff'; c.fillStyle = '#7fd4ff'; c.lineWidth = 3; c.lineCap = 'round';
      const x0 = gx - (dir * len) / 2, x1 = gx + (dir * len) / 2;
      c.beginPath(); c.moveTo(x0, gy + 9); c.lineTo(x1 - dir * 4, gy + 9); c.stroke();
      c.beginPath(); c.moveTo(x1 + dir * 3, gy + 9); c.lineTo(x1 - dir * 4, gy + 4); c.lineTo(x1 - dir * 4, gy + 14); c.closePath(); c.fill();
    }
    if (this.bannerLife > 0) {
      c.globalAlpha = Math.min(1, this.bannerLife * 2.5);
      c.font = '900 22px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
      c.lineWidth = 5; c.strokeStyle = 'rgba(18, 14, 26, 0.85)'; c.strokeText(this.banner, VIEW_W / 2, 78);
      c.fillStyle = '#fff6d8'; c.fillText(this.banner, VIEW_W / 2, 78); c.globalAlpha = 1;
    }
    c.restore();
  }
}

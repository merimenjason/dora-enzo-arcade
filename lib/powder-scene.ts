// Powder Paws drawing: the mountain is drawn into a small low-resolution buffer at true pixel size and then blown up
// by a whole number onto the page canvas with smoothing off, so every pixel stays square and crisp. The scale is
// picked from the screen so the slope ahead is always about 250 pixels deep (a second or so of skiing) and the
// skiers stay big. The camera keeps the skier a third of the way down, leading into turns; the storm rolls in from
// the top as a dithered white-out. The partner skis behind on the same line and cheers tricks.
import type { PowderGame, Ev, LiveNpc } from './powder-game';
import { HALF, EDGE, hash, type Ob } from './powder-world';
import {
  Grid, chinchilla, snowball, animal, pine, birch, rock, stump, bank, fence, hut, cabin, sign, flag, ramp, mogul, lantern,
  SNOW, SNOW2, SNOW3, SHADOW, INK, type Who, type View, type Pose, type Look,
} from './powder-art';

export type { Who, Look };
const cache = new Map<string, HTMLCanvasElement>();
function toCanvas(g: Grid, flip = false) {
  const c = document.createElement('canvas'); c.width = g.w; c.height = g.h;
  const x = c.getContext('2d')!; const im = x.createImageData(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let i = 0; i < g.w; i++) {
    const col = g.px[y * g.w + (flip ? g.w - 1 - i : i)]; if (!col) continue;
    const n = parseInt(col.slice(1), 16), o = (y * g.w + i) * 4;
    im.data[o] = (n >> 16) & 255; im.data[o + 1] = (n >> 8) & 255; im.data[o + 2] = n & 255; im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c;
}
function sprite(key: string, make: () => Grid, flip = false) {
  const k = key + (flip ? ':L' : '');
  let c = cache.get(k); if (!c) { c = toCanvas(make(), flip); cache.set(k, c); } return c;
}
/** The 8 carving angles plus straight down, as views and ski angles. */
function poseFor(a: number): { view: View; ski: number; left: boolean } {
  const q = Math.round((Math.abs(a) / (Math.PI / 2)) * 4) / 4, left = a < 0;
  const view: View = q <= 0.25 ? 'front' : q <= 0.5 ? 'q' : 'side';
  return { view, ski: q * (Math.PI / 2), left };
}
export function chinKey(who: Who, look: Look, view: View, pose: Pose, ski: number, frame: number, extra = '') {
  return `c:${who}:${look.scarf}:${look.hat}:${look.skis}:${view}:${pose}:${ski.toFixed(2)}:${frame & 1}:${extra}`;
}
function chinSprite(who: Who, look: Look, view: View, pose: Pose, ski: number, frame: number, left: boolean, extra: { blink?: boolean; happy?: boolean } = {}) {
  return sprite(chinKey(who, look, view, pose, ski, frame, (extra.blink ? 'b' : '') + (extra.happy ? 'h' : '')),
    () => chinchilla({ who, look, view, pose, ski, frame, ...extra }), left);
}

type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; c: string; size: number; kind?: 'heart' | 'star' };
type Rec = { x: number; y: number; a: number; z: number; state: string; spin: number; flip: number; grab: boolean; tuck: boolean; brake: boolean };

export class PowderScene {
  private cv: HTMLCanvasElement; private ctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement; private b: CanvasRenderingContext2D;
  /** The buffer size in art pixels and the scale to device pixels. */
  W = 320; H = 240; k = 3; dpr = 1;
  g: PowderGame | null = null;
  who: Who = 'dora'; partner: Who = 'enzo';
  look: Record<Who, Look> = { dora: { scarf: '#e8344a', hat: 'hat-none', skis: '#e8344a' }, enzo: { scarf: '#3a7cf0', hat: 'hat-none', skis: '#e8344a' } };
  camX = 0; camY = 0; t = 0;
  private parts: Particle[] = [];
  private tracks: { x: number; y: number; a: number; on: boolean }[] = [];
  private hist: Rec[] = [];
  private cheer = 0; private shake = 0; private flash = 0; private blink = 0;
  /** Extra room the page needs kept clear (css px), e.g. touch buttons along the bottom. */
  reserve = { bottom: 0, right: 0 };
  /** Where the skier is drawn on the page (css px), for pointer steering. */
  skierAt = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.cv = canvas;
    const c = canvas.getContext('2d'); if (!c) throw new Error('no canvas');
    this.ctx = c;
    this.buf = document.createElement('canvas');
    this.b = this.buf.getContext('2d')!;
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    const dw = Math.max(1, Math.round(r.width * dpr)), dh = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
    if (this.cv.width !== dw || this.cv.height !== dh) { this.cv.width = dw; this.cv.height = dh; }
    this.k = Math.max(1, Math.min(Math.round(dh / 250), Math.round(dw / 150)));
    this.W = Math.ceil(dw / this.k); this.H = Math.ceil(dh / this.k);
    if (this.buf.width !== this.W || this.buf.height !== this.H) { this.buf.width = this.W; this.buf.height = this.H; }
  }
  setGame(g: PowderGame | null, who: Who) {
    this.g = g; this.who = who; this.partner = who === 'dora' ? 'enzo' : 'dora';
    this.parts = []; this.tracks = []; this.hist = []; this.cheer = 0; this.shake = 0;
    if (g) { this.camX = g.sk.x; this.camY = g.sk.y - this.H * 0.32; }
  }
  /** The skier's anchor on screen, from the world. */
  private sx(x: number) { return Math.round(x - this.camX + this.W / 2); }
  private sy(y: number) { return Math.round(y - this.camY); }

  /** Reacts to the engine's events with particles and poses. */
  events(evs: Ev[]) {
    const g = this.g; if (!g) return;
    const k = g.sk;
    for (const e of evs) {
      if (e.t === 'crash' || e.t === 'wipeout') { this.puff(k.x, k.y, 26, 1); this.shake = 0.35; }
      if (e.t === 'puff') this.puff(k.x, k.y, 14, 0.6);
      if (e.t === 'land') { this.puff(k.x, k.y, e.clean ? 8 : 14, 0.5); if (e.trick && e.clean) { this.cheer = 1.6; this.sparkle(k.x, k.y - 12, 14); } }
      if (e.t === 'postcard') { this.sparkle(k.x, k.y - 14, 24); this.flash = 0.3; }
      if (e.t === 'gate' && e.ok) this.sparkle(k.x, k.y - 10, 5);
      if (e.t === 'jump') this.puff(k.x, k.y, 6, 0.4);
    }
  }
  private puff(x: number, y: number, n: number, power: number) {
    const r = (i: number) => (hash(i, this.parts.length, Math.floor(this.t * 60)) % 1000) / 1000;
    for (let i = 0; i < n; i++) {
      const a = r(i) * Math.PI * 2, s = (20 + r(i + 99) * 60) * power;
      this.parts.push({ x, y, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 20 + r(i + 7) * 60 * power, life: 0.7 + r(i + 3) * 0.5, max: 1.2, c: i % 3 ? '#ffffff' : SNOW2, size: 1 + (i % 3) });
    }
  }
  private sparkle(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.parts.push({ x, y, z: 6, vx: Math.cos(a) * 40, vy: Math.sin(a) * 26, vz: 30, life: 0.9, max: 0.9, c: ['#ffd23a', '#ff5fa8', '#7ee0ff', '#ffffff'][i % 4], size: 1, kind: 'star' });
    }
  }

  frame(dt: number) {
    this.t += dt;
    const g = this.g, b = this.b, W = this.W, H = this.H;
    this.cheer = Math.max(0, this.cheer - dt); this.shake = Math.max(0, this.shake - dt); this.flash = Math.max(0, this.flash - dt);
    this.blink = (this.t % 3.7) < 0.12 ? 1 : 0;
    if (g) {
      const k = g.sk;
      // the camera leads the skier: a third of the way down the screen, a little further ahead at speed
      const ty = k.y - H * (0.3 - Math.min(0.06, k.s / 4000)), lead = Math.sin(k.th) * Math.min(60, k.s * 0.25);
      this.camY += (ty - this.camY) * Math.min(1, dt * 8);
      const span = HALF + EDGE + 40, tx = Math.max(-span + W / 2, Math.min(span - W / 2, k.x + lead));
      this.camX += ((W / 2 > span ? 0 : tx) - this.camX) * Math.min(1, dt * 4);
      // history for the partner and tracks
      this.hist.push({ x: k.x, y: k.y, a: k.a, z: k.z, state: k.state, spin: k.spin, flip: k.flip, grab: k.grab, tuck: k.tuck, brake: k.brake });
      if (this.hist.length > 90) this.hist.shift();
      const last = this.tracks[this.tracks.length - 1];
      const on = k.state === 'ride' && k.z <= 0;
      if (!last || Math.hypot(last.x - k.x, last.y - k.y) > 2 || last.on !== on) this.tracks.push({ x: k.x, y: k.y, a: k.th, on });
      if (this.tracks.length > 700) this.tracks.splice(0, this.tracks.length - 700);
      // spray when carving hard or braking
      if (on && k.s > 60 && (k.brake || Math.abs(k.a - k.th) > 0.12) && Math.floor(this.t * 60) % 2 === 0) {
        const side = Math.sign(k.a - k.th) || 1;
        this.parts.push({ x: k.x - Math.cos(k.th) * side * 3, y: k.y + 2, z: 1, vx: -Math.cos(k.th) * side * 50, vy: -20, vz: 30, life: 0.45, max: 0.45, c: '#ffffff', size: 1 + (Math.floor(this.t * 60) % 2) });
      }
    }
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt); p.vz -= 160 * dt; p.vx *= 0.96; p.vy *= 0.96; }
    this.parts = this.parts.filter((p) => p.life > 0);

    b.imageSmoothingEnabled = false;
    b.setTransform(1, 0, 0, 1, 0, 0);
    const shx = this.shake > 0 ? Math.round(Math.sin(this.t * 80) * 2 * this.shake / 0.35) : 0;
    b.save(); b.translate(shx, 0);
    this.drawGround();
    if (g) this.drawWorld(g);
    b.restore();
    if (g && g.storm.on) this.drawStorm(g);
    this.drawSnowfall(g);
    if (this.flash > 0) { b.fillStyle = `rgba(255,255,255,${this.flash})`; b.fillRect(0, 0, W, H); }
    // blow it up onto the page
    const c = this.ctx; c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.buf, 0, 0, W * this.k, H * this.k);
    if (g) { const px = this.k / this.dpr; this.skierAt = { x: this.sx(g.sk.x) * px, y: this.sy(g.sk.y) * px }; }
  }

  // ---------------------------------------------------------------- the ground
  private drawGround() {
    const b = this.b, W = this.W, H = this.H;
    b.fillStyle = SNOW; b.fillRect(0, 0, W, H);
    // speckles and sparkles anchored to the world so the snow scrolls
    const x0 = Math.floor((this.camX - W / 2) / 16), y0 = Math.floor(this.camY / 16);
    for (let j = y0 - 1; j <= y0 + H / 16 + 1; j++) for (let i = x0 - 1; i <= x0 + W / 16 + 1; i++) {
      const h = hash(i, j, 5);
      const x = this.sx(i * 16 + (h % 16)), y = this.sy(j * 16 + ((h >> 4) % 16));
      if ((h >> 8) % 3 === 0) { b.fillStyle = SNOW2; b.fillRect(x, y, 2, 1); }
      else if ((h >> 8) % 11 === 1) { b.fillStyle = SNOW3; b.fillRect(x, y, 3, 1); b.fillRect(x + 1, y - 1, 1, 1); }
      if ((h >> 12) % 40 === 0 && Math.floor(this.t * 3 + (h % 7)) % 4 === 0) { b.fillStyle = '#ffffff'; b.fillRect(x, y - 1, 1, 3); b.fillRect(x - 1, y, 3, 1); }
    }
    // the piste edges: slightly bluer snow under the forest
    for (const s of [-1, 1]) {
      const ex = this.sx(s * (HALF + 2)), w = W;
      b.fillStyle = '#e4ecf8';
      if (s < 0) b.fillRect(ex - w, 0, w, H); else b.fillRect(ex, 0, w, H);
      b.fillStyle = SNOW3; b.fillRect(ex, 0, 1, H);
    }
  }

  private drawWorld(g: PowderGame) {
    const b = this.b, H = this.H, top = this.camY - 50, bot = this.camY + H + 50;
    const { obs, areas, ramps, gates } = g.near(top, bot);
    // areas: ice, powder, moguls
    for (const a of areas) {
      const cx = this.sx(a.x), cy = this.sy(a.y);
      if (a.k === 'ice') {
        pixEllipse(b, cx, cy + 1, a.rx, a.ry, '#7fb6d8'); pixEllipse(b, cx, cy, a.rx, a.ry, '#aee3f6'); pixEllipse(b, cx - a.rx * 0.2, cy - a.ry * 0.2, a.rx * 0.6, a.ry * 0.5, '#c8effa');
        b.fillStyle = '#ffffff'; for (let i = -2; i <= 2; i++) b.fillRect(cx + i * a.rx * 0.3 - 6, cy + i * 3 - 2, 8, 1);
      } else if (a.k === 'powder') {
        for (let i = 0; i < 14; i++) { const h = hash(a.x, a.y, i), ang = (h % 628) / 100, r = ((h >> 10) % 100) / 100; pixEllipse(b, cx + Math.cos(ang) * a.rx * 0.7 * r, cy + Math.sin(ang) * a.ry * 0.7 * r, 10 + (h % 8), 5 + (h % 3), i % 2 ? '#ffffff' : '#f6fbff'); }
        b.fillStyle = '#cfe8ff'; for (let i = 0; i < 18; i++) { const h = hash(a.y, a.x, i); b.fillRect(cx + ((h % 200) / 100 - 1) * a.rx * 0.8, cy + (((h >> 8) % 200) / 100 - 1) * a.ry * 0.8, 1, 1); }
      } else {
        const m = sprite('mogul', mogul);
        for (let y = Math.ceil((a.y - a.ry) / 34) * 34; y < a.y + a.ry; y += 34) for (let x = a.x - a.rx; x < a.x + a.rx; x += 24) {
          const dx = (x - a.x) / a.rx, dy = (y - a.y) / a.ry; if (dx * dx + dy * dy > 1) continue;
          b.drawImage(m, this.sx(x + ((y / 34) & 1) * 12) - 7, this.sy(y) - 6);
        }
      }
    }
    this.drawTracks();
    // finish line or start banner
    if (g.end < Infinity && g.end < bot) { const y = this.sy(g.end); for (let x = -HALF; x < HALF; x += 8) { b.fillStyle = (x / 8) % 2 ? INK : '#ffffff'; b.fillRect(this.sx(x), y, 8, 3); b.fillStyle = (x / 8) % 2 ? '#ffffff' : INK; b.fillRect(this.sx(x), y + 3, 8, 3); } }
    if (top < 60) { const y = this.sy(20); b.fillStyle = '#e8344a'; b.fillRect(this.sx(-40), y, 80, 2); b.fillStyle = '#ffffff'; for (let x = -40; x < 40; x += 6) b.fillRect(this.sx(x), y, 3, 2); }
    // ramps sit flat on the snow
    for (const r of ramps) { const s = sprite('ramp' + r.k, () => ramp(r.k === 'big')); b.drawImage(s, this.sx(r.x) - s.width / 2, this.sy(r.y) - s.height + 12); }
    // shadows then everything that stands up, in depth order
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const o of obs) list.push({ y: o.y, draw: () => this.drawOb(o, g) });
    for (const gt of gates) for (const s of [-1, 1]) { const x = gt.x + (s * gt.w) / 2, red = gt.red, passed = gt.i < g.nextGate; list.push({ y: gt.y, draw: () => { const f = sprite('flag' + red, () => flag(red)); b.globalAlpha = passed ? 0.55 : 1; b.drawImage(f, this.sx(x) - 4, this.sy(gt.y) - 20); b.globalAlpha = 1; } }); }
    for (const n of g.npcs) if (n.y > top && n.y < bot) list.push({ y: n.y, draw: () => this.drawNpc(n, g) });
    const k = g.sk;
    const p = this.partnerRec();
    if (p) list.push({ y: p.y, draw: () => this.drawSkier(this.partner, p, true) });
    list.push({ y: k.y + 0.5, draw: () => this.drawSkier(this.who, { x: k.x, y: k.y, a: k.a, z: k.z, state: k.state, spin: k.spin, flip: k.flip, grab: k.grab, tuck: k.tuck, brake: k.brake }, false) });
    list.sort((a, c) => a.y - c.y);
    for (const d of list) d.draw();
    // particles
    for (const q of this.parts) {
      const x = this.sx(q.x), y = this.sy(q.y) - Math.round(q.z);
      b.fillStyle = q.c;
      if (q.kind === 'star') { b.fillRect(x, y - 1, 1, 3); b.fillRect(x - 1, y, 3, 1); }
      else b.fillRect(x, y, q.size, q.size);
    }
    // the edge forest beyond the trees that count
    this.drawForest(g);
  }
  private drawTracks() {
    const b = this.b; b.fillStyle = '#cdd9ec';
    const tr = this.tracks;
    for (let i = 1; i < tr.length; i++) {
      const p = tr[i - 1], q = tr[i]; if (!p.on || !q.on) continue;
      const ox = Math.cos(q.a) * 2, oy = -Math.sin(q.a) * 2;
      for (const s of [-1, 1]) {
        const x0 = this.sx(p.x + ox * s), y0 = this.sy(p.y + oy * s), x1 = this.sx(q.x + ox * s), y1 = this.sy(q.y + oy * s);
        if (y1 < -4 || y0 > this.H + 4) continue;
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let t = 0; t <= n; t++) b.fillRect(Math.round(x0 + ((x1 - x0) * t) / n), Math.round(y0 + ((y1 - y0) * t) / n), 1, 1);
      }
    }
  }
  private drawForest(g: PowderGame) {
    const b = this.b, H = this.H;
    const y0 = Math.floor((this.camY - 40) / 18), y1 = Math.ceil((this.camY + H + 40) / 18);
    for (const s of [-1, 1]) for (let j = y0; j <= y1; j++) for (let c = 0; c < 9; c++) {
      const h = hash(j, c, s + 9), wy = j * 18 + (h % 10);
      const wx = s * (HALF + EDGE + 4 + c * 16 + ((h >> 6) % 8));
      if (g.outside(wx, wy) === false) continue; // a cabin clearing
      const t = sprite('pine1' + ((h >> 3) & 3), () => pine(1, (h >> 3) & 3));
      const x = this.sx(wx) - t.width / 2, y = this.sy(wy) - t.height + 4;
      if (x > this.W + 20 || x < -40) continue;
      b.drawImage(t, x, y);
    }
  }
  private drawOb(o: Ob, g: PowderGame) {
    const b = this.b, x = this.sx(o.x), y = this.sy(o.y), v = o.v ?? 0;
    const shadow = (w: number) => pixEllipse(b, x + 3, y + 1, w, w * 0.35, SHADOW);
    let s: HTMLCanvasElement;
    switch (o.k) {
      case 'pine': shadow(10); s = sprite('pine1' + (v & 3), () => pine(1, v & 3)); b.drawImage(s, x - s.width / 2, y - s.height + 4); break;
      case 'pineS': shadow(7); s = sprite('pine0' + (v & 3), () => pine(0, v & 3)); b.drawImage(s, x - s.width / 2, y - s.height + 3); break;
      case 'birch': shadow(5); s = sprite('birch' + (v & 1), () => birch(v & 1)); b.drawImage(s, x - s.width / 2, y - s.height + 3); break;
      case 'rock': shadow(9); s = sprite('rock' + (v & 1), () => rock(v & 1)); b.drawImage(s, x - s.width / 2, y - s.height + 5); break;
      case 'stump': shadow(6); s = sprite('stump', stump); b.drawImage(s, x - s.width / 2, y - s.height + 4); break;
      case 'bank': s = sprite('bank', bank); b.drawImage(s, x - s.width / 2, y - s.height + 6); break;
      case 'fence': s = sprite('fence', fence); b.drawImage(s, x - s.width / 2, y - s.height + 4); break;
      case 'hut': shadow(20); s = sprite('hut' + (v & 3), () => hut(v & 3)); b.drawImage(s, x - s.width / 2, y - s.height + 14); break;
      case 'cabin': {
        const done = g.cards.includes(o.i ?? -1);
        shadow(32); s = sprite('cabin' + done, () => cabin(done)); b.drawImage(s, x - s.width / 2, y - s.height + 22);
        // chimney smoke
        for (let i = 0; i < 4; i++) { const t = (this.t * 0.6 + i / 4) % 1; pixEllipse(b, x - 3 + Math.sin(t * 6 + i) * 3, y - 58 - t * 30, 2 + t * 4, 2 + t * 3, i % 2 ? '#dfe6f2' : '#ffffff'); }
        if (!done && Math.floor(this.t * 2) % 2) { b.fillStyle = '#ffd23a'; b.fillRect(x + 10, y - 40, 1, 3); b.fillRect(x + 9, y - 39, 3, 1); }
        break;
      }
      case 'sign': { s = sprite('sign', sign, (v ?? 1) < 0); b.drawImage(s, x - s.width / 2, y - s.height + 2); break; }
      default: break;
    }
  }
  private drawNpc(n: LiveNpc, g: PowderGame) {
    const b = this.b, vel = g.npcVel(n), x = this.sx(n.x), y = this.sy(n.y), f = Math.floor(this.t * 6 + n.id) & 1;
    pixEllipse(b, x + 2, y + 1, 9, 3, SHADOW);
    const left = vel.vx < -2;
    const s = sprite('npc' + n.k + f, () => animal(n.k, f), left);
    if (n.daze > 0) { b.fillStyle = '#ffd23a'; const a = this.t * 8; b.fillRect(x + Math.cos(a) * 7, y - 26 + Math.sin(a) * 2, 2, 2); b.fillRect(x - Math.cos(a) * 7, y - 26 - Math.sin(a) * 2, 2, 2); }
    b.drawImage(s, x - s.width / 2, y - s.height + 4);
  }
  /** Where the partner is: a short way back along the leader's line (beside them while they pick themselves up). */
  private partnerRec(): Rec | null {
    const h = this.hist; if (h.length < 30) return null;
    const r = { ...h[h.length - 30] };
    const now = h[h.length - 1];
    if (now.state === 'tumble' || now.state === 'up') { r.state = 'ride'; r.brake = true; r.x = now.x + (now.x > 0 ? -16 : 16); r.y = Math.min(r.y, now.y - 10); r.z = 0; }
    if (r.state === 'tumble' || r.state === 'up') { r.state = 'ride'; r.brake = true; }
    return r;
  }
  private drawSkier(who: Who, r: Rec, partner: boolean) {
    const b = this.b, look = this.look[who], x = this.sx(r.x), y = this.sy(r.y), z = Math.round(r.z * 0.45), f = Math.floor(this.t * 8) & 1;
    // shadow on the snow (smaller the higher you fly)
    pixEllipse(b, x + 1, y + 1, Math.max(4, 9 - z * 0.2), Math.max(2, 3 - z * 0.05), SHADOW);
    let c: HTMLCanvasElement;
    if (r.state === 'tumble' && !partner) {
      c = sprite(`ball:${who}:${look.scarf}:${look.skis}:${Math.floor(this.t * 12) % 4}`, () => snowball(who, look, Math.floor(this.t * 12) % 4));
      b.drawImage(c, x - 13, y - 21); return;
    }
    if (r.state === 'up' && !partner) {
      c = chinSprite(who, look, 'front', 'sit', 0, f, false, { blink: true });
      b.drawImage(c, x - 14, y - 26);
      b.fillStyle = '#ffd23a'; const a = this.t * 7; b.fillRect(x + Math.cos(a) * 8, y - 27 + Math.sin(a) * 2, 2, 2); b.fillRect(x - Math.cos(a) * 8, y - 27 - Math.sin(a) * 2, 2, 2);
      return;
    }
    let pose: Pose = r.state === 'air' ? (r.grab ? 'grab' : 'air') : r.brake ? 'brake' : r.tuck ? 'tuck' : 'ride';
    let { view, ski, left } = poseFor(r.a);
    if (partner && this.cheer > 0 && r.state !== 'air') { pose = 'cheer'; view = 'front'; left = false; }
    if (r.state === 'air') {
      // spinning round the vertical: the views turn and so do the skis
      const sp = ((((r.spin + (r.a * 180) / Math.PI) % 360) + 360) % 360);
      const seg = Math.round(sp / 45) % 8;
      const views: [View, boolean][] = [['front', false], ['q', false], ['side', false], ['back', false], ['back', false], ['back', true], ['side', true], ['q', true]];
      [view, left] = views[seg];
      ski = (Math.round(sp / 22.5) * 22.5 * Math.PI) / 180;
      if (left) ski = -ski;
      ski = Math.atan2(Math.sin(ski), Math.cos(ski));
      if (left) ski = Math.abs(ski);
    }
    if (pose === 'brake' && view === 'side') view = 'q';
    c = chinSprite(who, look, view, pose, Math.abs(ski), f, left, { blink: this.blink > 0 && !partner, happy: partner ? this.cheer > 0 : false });
    // a flip squashes the sprite top to bottom and turns it over
    const fl = Math.cos((r.flip * Math.PI) / 180), sh = Math.max(2, Math.round(Math.abs(fl) * c.height));
    if (r.state === 'air' && Math.abs(r.flip) > 1) {
      b.save(); b.translate(x, y - z - 13); b.scale(1, fl < 0 ? -1 : 1);
      b.drawImage(c, -14, -sh / 2 - 1, c.width, sh); b.restore();
    } else b.drawImage(c, x - 14, y - 26 - z);
    if (partner && this.cheer > 0) { b.fillStyle = '#ff5fa8'; const yy = y - 34 - Math.round((1.6 - this.cheer) * 10); heart(b, x - 2, yy); }
  }

  // ---------------------------------------------------------------- the storm
  private drawStorm(g: PowderGame) {
    const b = this.b, W = this.W, H = this.H, edge = this.sy(g.storm.y);
    const gap = g.sk.y - g.storm.y;
    if (edge > -30) {
      b.fillStyle = '#eef3fb'; b.fillRect(0, 0, W, Math.max(0, edge - 20));
      // a dithered front that boils along its edge
      for (let y = Math.max(0, edge - 20); y < Math.min(H, edge + 14); y++) for (let x = 0; x < W; x += 1) {
        const wob = Math.sin(x * 0.07 + this.t * 2) * 5 + Math.sin(x * 0.19 - this.t * 3) * 3;
        const d = (y - (edge + wob)) / 14;
        const th = ((x * 7 + y * 13 + Math.floor(this.t * 10)) % 16) / 16;
        if (d < th - 0.5) { b.fillStyle = (x + y) % 5 ? '#eef3fb' : '#d8e2f2'; b.fillRect(x, y, 1, 1); }
      }
      b.fillStyle = '#c8d4ea';
      for (let i = 0; i < 18; i++) { const h = hash(i, 3), y = edge - 10 - (h % 60), x = ((h >> 6) % W + this.t * (160 + (h % 80))) % (W + 40) - 20; b.fillRect(Math.round(x), y, 10 + (h % 14), 1); }
    }
    // a white-out creeps in from the edges when it's close
    if (gap < 260) {
      const k = 1 - gap / 260;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const e = Math.min(x, W - x, y * 1.5) / (W * 0.35);
        if (e < k * ((hash(x, y, Math.floor(this.t * 8)) % 100) / 100)) { b.fillStyle = '#f4f7fd'; b.fillRect(x, y, 2, 2); }
      }
    }
  }
  private drawSnowfall(g: PowderGame | null) {
    const b = this.b, W = this.W, H = this.H, wind = g && g.storm.on ? 1 + Math.max(0, 1 - (g.sk.y - g.storm.y) / 600) * 2 : 0.6;
    for (let i = 0; i < 60; i++) {
      const h = hash(i, 77), sp = 18 + (h % 30);
      const x = ((((h >> 4) % 1000) / 1000) * W + this.t * sp * wind * 1.5 - (g ? this.camX * 0.3 : 0)) % W;
      const y = ((((h >> 14) % 1000) / 1000) * H + this.t * sp - (g ? -this.camY * 0.0 : 0)) % H;
      b.fillStyle = i % 4 ? '#ffffff' : '#dce8f8';
      b.fillRect(Math.round((x + W) % W), Math.round((y + H) % H), i % 7 ? 1 : 2, 1);
    }
  }
}

function pixEllipse(b: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string) {
  b.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); if (w > 0) b.fillRect(cx - w, cy + y, w * 2, 1); }
}
function heart(b: CanvasRenderingContext2D, x: number, y: number) { b.fillRect(x, y, 2, 1); b.fillRect(x + 3, y, 2, 1); b.fillRect(x - 1, y + 1, 7, 2); b.fillRect(x, y + 3, 5, 1); b.fillRect(x + 1, y + 4, 3, 1); b.fillRect(x + 2, y + 5, 1, 1); }

// ---------------------------------------------------------------- stand-alone pictures for the menus
/** A chinchilla preview at a whole-number scale (the wardrobe and the menu). */
export function paintSkier(canvas: HTMLCanvasElement, who: Who, look: Look, pose: Pose = 'ride', view: View = 'front', ski = 0) {
  const x = canvas.getContext('2d'); if (!x) return;
  const s = chinSprite(who, look, view, pose, ski, 0, false, { happy: pose === 'cheer' });
  const k = Math.max(1, Math.floor(Math.min(canvas.width / s.width, canvas.height / s.height)));
  x.imageSmoothingEnabled = false; x.clearRect(0, 0, canvas.width, canvas.height);
  x.drawImage(s, Math.round((canvas.width - s.width * k) / 2), Math.round((canvas.height - s.height * k) / 2), s.width * k, s.height * k);
}
/** A small pixel scene drawn at low resolution and blown up: used for postcards, and as stand-ins for missing paintings. */
function lowRes(canvas: HTMLCanvasElement, w: number, h: number, draw: (b: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const b = c.getContext('2d')!; b.imageSmoothingEnabled = false;
  draw(b);
  const x = canvas.getContext('2d'); if (!x) return; x.imageSmoothingEnabled = false;
  const k = Math.max(canvas.width / w, canvas.height / h);
  x.drawImage(c, (canvas.width - w * k) / 2, (canvas.height - h * k) / 2, w * k, h * k);
}
const DORA: Look = { scarf: '#e8344a', hat: 'hat-none', skis: '#e8344a' }, ENZO: Look = { scarf: '#3a7cf0', hat: 'hat-none', skis: '#3a7cf0' };
function mountains(b: CanvasRenderingContext2D, w: number, h: number, sky: [string, string]) {
  b.fillStyle = sky[0]; b.fillRect(0, 0, w, h); b.fillStyle = sky[1]; b.fillRect(0, h * 0.3, w, h * 0.3);
  const ridge = (base: number, amp: number, c: string, cap: string, seed: number) => {
    for (let x = 0; x < w; x++) {
      const y = Math.round(base - amp * Math.abs(Math.sin(x / (w / 3) + seed)) - amp * 0.3 * Math.sin(x / 7 + seed));
      b.fillStyle = c; b.fillRect(x, y, 1, h - y); b.fillStyle = cap; b.fillRect(x, y, 1, Math.max(1, Math.round(amp * 0.25)));
    }
  };
  ridge(h * 0.55, h * 0.25, '#8fa6d6', '#ffffff', 1); ridge(h * 0.7, h * 0.18, '#c4d4f0', '#ffffff', 3);
  b.fillStyle = SNOW; b.fillRect(0, h * 0.72, w, h);
}
export function paintTitle(canvas: HTMLCanvasElement) {
  lowRes(canvas, 240, 160, (b) => {
    mountains(b, 240, 160, ['#7cc4ff', '#a8dcff']);
    b.fillStyle = '#eef3fb'; for (let i = 0; i < 8; i++) pixEllipse(b, 150 + i * 12, 20 + (i % 3) * 4, 16, 9, i % 2 ? '#ffffff' : '#e4ecf8');
    for (let i = 0; i < 6; i++) { const p = toCanvas(pine(1, i & 3)); b.drawImage(p, i < 3 ? i * 18 - 6 : 240 - (i - 2) * 18, 100 + (i % 3) * 14); }
    b.drawImage(toCanvas(chinchilla({ who: 'dora', look: DORA, view: 'q', pose: 'ride', ski: 0.6, frame: 0, happy: true })), 92, 112);
    b.drawImage(toCanvas(chinchilla({ who: 'enzo', look: ENZO, view: 'q', pose: 'ride', ski: 0.6, frame: 1, happy: true }), true), 124, 108);
  });
}
export function paintCocoa(canvas: HTMLCanvasElement) {
  lowRes(canvas, 240, 160, (b) => {
    b.fillStyle = '#6b3d22'; b.fillRect(0, 0, 240, 160); for (let y = 6; y < 120; y += 10) { b.fillStyle = '#5a321c'; b.fillRect(0, y, 240, 2); }
    b.fillStyle = '#c88a4a'; b.fillRect(0, 118, 240, 42);
    b.fillStyle = '#2a1a10'; b.fillRect(150, 22, 64, 48); b.fillStyle = '#eef3fb'; b.fillRect(154, 26, 56, 40); b.fillStyle = '#2a1a10'; b.fillRect(181, 26, 2, 40); b.fillRect(154, 45, 56, 2);
    b.fillStyle = '#ffffff'; for (let i = 0; i < 20; i++) b.fillRect(156 + ((i * 37) % 52), 28 + ((i * 17) % 36), 2, 1);
    b.fillStyle = '#7c8597'; b.fillRect(14, 50, 60, 70); b.fillStyle = '#2a1a10'; b.fillRect(24, 76, 40, 44); b.fillStyle = '#ff8a2a'; pixEllipse(b, 44, 108, 14, 9, '#ff8a2a'); pixEllipse(b, 44, 110, 8, 6, '#ffd23a');
    b.fillStyle = '#d8333f'; b.fillRect(80, 118, 120, 14);
    b.drawImage(toCanvas(chinchilla({ who: 'dora', look: DORA, view: 'front', pose: 'sit', ski: 0, frame: 0, happy: true })), 96, 92);
    b.drawImage(toCanvas(chinchilla({ who: 'enzo', look: ENZO, view: 'front', pose: 'sit', ski: 0, frame: 0, happy: true })), 124, 92);
    b.fillStyle = '#ffffff'; b.fillRect(110, 108, 5, 5); b.fillRect(138, 108, 5, 5); b.fillStyle = '#7a4a2a'; b.fillRect(111, 108, 3, 2); b.fillRect(139, 108, 3, 2);
  });
}
export function paintEnding(canvas: HTMLCanvasElement) {
  lowRes(canvas, 240, 160, (b) => {
    mountains(b, 240, 160, ['#2a2f6a', '#4a4f9a']);
    b.fillStyle = '#ffffff'; for (let i = 0; i < 30; i++) b.fillRect((i * 53) % 240, (i * 29) % 50, 1, 1);
    b.drawImage(toCanvas(cabin(false)), 88, 52);
    for (let i = 0; i < 9; i++) { b.fillStyle = ['#e8344a', '#ffd23a', '#3a7cf0', '#3cc8a0'][i % 4]; b.fillRect(20 + i * 24, 40 + Math.abs(4 - i) * 2, 6, 5); }
    for (let i = 0; i < 6; i++) b.drawImage(toCanvas(lantern()), 30 + i * 36, 96);
    b.drawImage(toCanvas(chinchilla({ who: 'dora', look: DORA, view: 'front', pose: 'cheer', ski: 0, frame: 0 })), 92, 116);
    b.drawImage(toCanvas(chinchilla({ who: 'enzo', look: ENZO, view: 'front', pose: 'cheer', ski: 0, frame: 1 })), 122, 116);
    b.drawImage(toCanvas(animal('rabbit', 0)), 40, 130); b.drawImage(toCanvas(animal('hedgehog', 0)), 170, 134); b.drawImage(toCanvas(animal('skier', 0), true), 200, 120);
  });
}
/** A postcard from cabin k: its cabin in the snow under a sky of its own. */
export function paintPostcard(canvas: HTMLCanvasElement, k: number, found: boolean) {
  const skies: [string, string][] = [['#7cc4ff', '#a8dcff'], ['#ff9a7a', '#ffd0a0'], ['#5a6ac8', '#8a9ae8'], ['#2a2f6a', '#4a4f9a'], ['#ffb0c8', '#ffe0ea'], ['#6ad0c8', '#a8f0e8'], ['#1e2450', '#3a3f80'], ['#ffc86a', '#ffe8b0'], ['#a8b8d8', '#d8e4f4'], ['#e85a4a', '#ffa86a']];
  lowRes(canvas, 96, 64, (b) => {
    if (!found) { b.fillStyle = '#c9d4e6'; b.fillRect(0, 0, 96, 64); b.fillStyle = '#aab8d0'; for (let i = 0; i < 96; i += 4) b.fillRect(i, (i * 7) % 64, 2, 2); return; }
    mountains(b, 96, 64, skies[k % skies.length]);
    const c = toCanvas(cabin(false)); b.drawImage(c, 16, 2, 64, 60);
    b.drawImage(toCanvas(pine(1, k & 3)), 2 + (k % 3) * 2, 30); b.drawImage(toCanvas(pine(0, (k + 1) & 3)), 76, 36);
  });
}

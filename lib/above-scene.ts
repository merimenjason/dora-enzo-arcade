// Above & Below: drawing only. The painted room, sprites from the Codex atlases, the soil layer, the water, the hawk,
// particles, the hints (glints, speech bubbles, the ghost demo, key prompts), the in-play HUD (portraits, chapter
// progress, Old Grubber's bar), the room card and the touch controls. Layout: on a phone held upright the HUD strip
// sits on top, the view under it and the controls under that; on its side the controls sit in the side gutters.
// Rules live in lib/above-game.ts; the per-room drawing in lib/above-scene-rooms.ts.
import { PX, ATLASES, FRAMES, ROOM_ART } from './above-art';
import { WW, WH, CELL, GW, GH } from './above-world';
import { ROOMS } from './above-rooms';
import type { AboveGame, Hero, Ev, HeroId, Prompt } from './above-game';
import { drawRoomBack, drawRoomMid, drawRoomFront } from './above-scene-rooms';

export interface Labels { mode: 'keys' | 'pad' | 'touch'; moveKeys: 'arrows' | 'wasd' }
export interface Btn { x: number; y: number; r: number }
export interface Layout {
  w: number; h: number; dpr: number; touch: boolean; mode: 'wide' | 'portrait' | 'land';
  vx: number; vy: number; vw: number; vh: number; pad: { stick?: Btn; jump?: Btn; act?: Btn; swap?: Btn };
}
interface Part { k: string; x: number; y: number; vx: number; vy: number; g: number; life: number; t: number; s: number; rot: number; vr: number; c?: string; a0?: number }
export const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
const ROOM_ICON = ['sluice0', 'rootlog', 'bush', 'g_face'];
const rand = Math.random;

export class AboveScene {
  cx: CanvasRenderingContext2D;
  img: Record<string, HTMLImageElement> = {};
  sil: Record<string, HTMLCanvasElement> = {};
  L: Layout = { w: 1, h: 1, dpr: 1, touch: false, mode: 'wide', vx: 0, vy: 0, vw: 1, vh: 1, pad: {} };
  cam = { s: 1, cx: WW / 2, cy: WH / 2, ox: 0, oy: 0, snap: true };
  parts: Part[] = [];
  soilCan: HTMLCanvasElement | null = null; soilVer = -1;
  darkCan: HTMLCanvasElement | null = null;
  knob = { on: false, dx: 0, dy: 0 };
  held: Record<string, boolean> = {};
  t = 0;
  constructor(public cv: HTMLCanvasElement) { this.cx = cv.getContext('2d')!; }

  load(base: string) {
    const list: [string, string][] = ATLASES.map((f, i) => ['s' + i, base + f]);
    for (const k of ROOM_ART) list.push([k, `${base}${k}.webp`]);
    return Promise.all(list.map(([k, src]) => new Promise<void>((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = src; this.img[k] = im; })));
  }
  layout(w: number, h: number, dpr: number, touch: boolean) {
    const L = this.L; L.dpr = Math.min(2, dpr || 1); L.w = w; L.h = h; L.touch = touch;
    this.cv.width = Math.round(w * L.dpr); this.cv.height = Math.round(h * L.dpr);
    if (touch && h > w) {
      // HUD strip on top, the world view under it, controls in the space below
      L.mode = 'portrait'; L.vx = 0; L.vy = 64; L.vw = w; L.vh = Math.max(240, Math.min(h - L.vy - 270, w * 1.35));
      const top = L.vy + L.vh, cy = top + (h - top) * 0.5, r = Math.min(70, (h - top) * 0.3, w * 0.18);
      L.pad = { stick: { x: w * 0.27, y: cy, r }, jump: { x: w * 0.8, y: cy + r * 0.55, r: r * 0.62 }, act: { x: w * 0.61, y: cy + r * 0.9, r: r * 0.55 }, swap: { x: w * 0.8, y: cy - r * 0.95, r: r * 0.45 } };
    } else if (touch) {
      // phone on its side: the world view in the middle, controls in the side gutters
      L.mode = 'land'; const side = Math.max(120, w * 0.15);
      L.vx = side; L.vy = 0; L.vw = w - side * 2; L.vh = h;
      const r = Math.min(54, side * 0.42);
      L.pad = { stick: { x: side / 2, y: h * 0.66, r }, jump: { x: w - side / 2, y: h * 0.74, r: r * 0.66 }, act: { x: w - side / 2, y: h * 0.46, r: r * 0.56 }, swap: { x: w - side / 2, y: h * 0.22, r: r * 0.44 } };
    } else { L.mode = 'wide'; L.vx = 0; L.vy = 0; L.vw = w; L.vh = h; L.pad = {}; }
    this.cam.snap = true;
  }
  /** which touch button (or the stick zone) is at a screen point */
  hitPad(x: number, y: number): 'jump' | 'act' | 'swap' | 'stick' | null {
    const L = this.L;
    for (const k of ['jump', 'act', 'swap'] as const) { const b = L.pad[k]; if (b && Math.hypot(x - b.x, y - b.y) < b.r * 1.35) return k; }
    if (L.pad.stick) {
      if (L.mode === 'land' && x < L.vx) return 'stick';
      if (L.mode === 'portrait' && y > L.vy + L.vh && x < L.w * 0.5) return 'stick';
    }
    return null;
  }
  /** the follow camera: heroes about mock-up size, sliding sideways through the room; it zooms out only as far as it
   *  must to keep both heroes (and so both layers) on screen */
  private camera(g: AboveGame, dt: number, close: boolean) {
    const L = this.L, C = this.cam, D = g.heroes.dora, E = g.heroes.enzo;
    const pref = L.mode === 'portrait' ? { h: 600, w: 540 } : { h: 620, w: 760 };
    const sMin = Math.min(L.vw / WW, L.vh / WH);
    let s = sMin, cx = WW / 2, cy = WH / 2;
    if (close) {
      let x0 = Math.min(D.x, E.x) - 150, x1 = Math.max(D.x, E.x) + 150, y0 = Math.min(D.y, E.y) - 215, y1 = Math.max(D.y, E.y) + 70;
      for (const [px, py] of g.focusPts()) { x0 = Math.min(x0, px - 60); x1 = Math.max(x1, px + 60); y0 = Math.min(y0, py - 40); y1 = Math.max(y1, py + 40); }
      s = Math.max(sMin, Math.min(L.vh / pref.h, L.vw / pref.w, L.vw / (x1 - x0), L.vh / (y1 - y0)));
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
    }
    const k = C.snap ? 1 : Math.min(1, dt * 3);
    C.s = C.snap ? s : C.s + (s - C.s) * k;
    const vwW = L.vw / C.s, vhW = L.vh / C.s;
    cx = vwW >= WW ? WW / 2 : Math.max(vwW / 2, Math.min(WW - vwW / 2, cx));
    cy = vhW >= WH ? WH / 2 : Math.max(vhW / 2, Math.min(WH - vhW / 2, cy));
    C.cx = C.snap ? cx : C.cx + (cx - C.cx) * k; C.cy = C.snap ? cy : C.cy + (cy - C.cy) * k;
    C.snap = false;
    C.ox = L.vx + L.vw / 2 - C.cx * C.s; C.oy = L.vy + L.vh / 2 - C.cy * C.s;
  }

  // ───────────────────────────── sprites and shapes
  /** draw a painted frame with its feet at (x, y); face -1 mirrors it */
  spr(g: CanvasRenderingContext2D, name: string, x: number, y: number, face = 1, o: { s?: number; sx?: number; sy?: number; rot?: number; a?: number; mid?: boolean; sil?: boolean } = {}) {
    const f = FRAMES[name]; if (!f) return;
    const [si, sx, sy, w, h, ax] = f, k = (o.s || 1) / PX;
    const im = o.sil ? this.silhouette(name) : this.img['s' + si]; if (!im) return;
    g.save(); g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    g.scale(face * k * (o.sx || 1), k * (o.sy || 1));
    if (o.a != null) g.globalAlpha *= o.a;
    g.drawImage(im, o.sil ? 0 : sx, o.sil ? 0 : sy, w, h, -ax, -(o.mid ? h / 2 : h), w, h);
    g.restore();
  }
  silhouette(name: string, col = '#fff') {
    const key = name + col; if (this.sil[key]) return this.sil[key];
    const [si, sx, sy, w, h] = FRAMES[name], c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d')!; x.drawImage(this.img['s' + si], sx, sy, w, h, 0, 0, w, h);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, w, h); this.sil[key] = c; return c;
  }
  star(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.32 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
    if (r <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  txt(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col = '#fff4dc', align: CanvasTextAlign = 'center', stroke: string | null = '#3a2312') {
    g.font = `700 ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = col; g.fillText(s, x, y);
  }
  rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke?: string, lw = 3) {
    g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }

  // ───────────────────────────── particles
  add(o: Partial<Part> & { k: string; x: number; y: number }) {
    if (this.parts.length < 700) this.parts.push({ life: 1, t: 0, g: 900, vx: 0, vy: 0, s: 4, rot: 0, vr: 0, ...o });
  }
  spawn(f: string, x: number, y: number, n: number) {
    const R = rand;
    if (f === 'crumb') for (let i = 0; i < n; i++) this.add({ k: 'crumb', x, y, vx: (R() - 0.5) * 160, vy: -R() * 180, life: 0.7 + R() * 0.5, s: 2 + R() * 4, c: ['#6b3d1e', '#8a552b', '#4a2a14', '#a8703c'][i % 4] });
    else if (f === 'sift') for (let i = 0; i < n; i++) this.add({ k: 'crumb', x: x + R() * 44, y, vy: 40, life: 1.2, s: 2 + R() * 2, c: '#a8703c' });
    else if (f === 'dust') for (let i = 0; i < n; i++) this.add({ k: 'dust', x: x + (R() - 0.5) * 24, y: y - 4, vx: (R() - 0.5) * 90, vy: -20 - R() * 40, g: 0, life: 0.5 + R() * 0.3, s: 6 + R() * 8 });
    else if (f === 'splash') for (let i = 0; i < n; i++) this.add({ k: 'drop', x: x + (R() - 0.5) * 10, y, vx: (R() - 0.5) * 220, vy: -120 - R() * 260, life: 0.6, s: 2 + R() * 2.5 });
    else if (f === 'drop') this.add({ k: 'drop', x, y, vx: 60 + R() * 40, vy: 20, life: 0.5, s: 2.5 });
    else if (f === 'leaves') for (let i = 0; i < n; i++) this.add({ k: 'leaf', x: x + (R() - 0.5) * 50, y: y + (R() - 0.5) * 60, vx: (R() - 0.5) * 140, vy: -80 - R() * 120, g: 260, life: 1.4, s: 5 + R() * 3, vr: (R() - 0.5) * 8 });
    else if (f === 'stars') for (let i = 0; i < 5; i++) this.add({ k: 'star', x, y, a0: i / 5 * 6.28, g: 0, life: 0.8, s: 5 });
    else if (f === 'confetti') for (let i = 0; i < n; i++) this.add({ k: 'conf', x, y, vx: (R() - 0.5) * 520, vy: -250 - R() * 450, g: 520, life: 2.6, s: 4 + R() * 4, vr: (R() - 0.5) * 12, c: ['#ffd447', '#ff8fb1', '#9be15d', '#7fd3ff', '#fff4dc', '#ffae57'][i % 6] });
    else if (f === 'mote') this.add({ k: 'mote', x, y, vx: (R() - 0.5) * 12, vy: 8 + R() * 14, g: 0, life: 2.5, s: 1.5 + R() * 1.5 });
  }
  /** take the game's events: particles and room changes */
  take(evs: Ev[]) {
    for (const e of evs) {
      if (e.k === 'fx') this.spawn(e.f, e.x, e.y, e.n);
      else if (e.k === 'room') { this.parts = []; this.cam.snap = true; this.soilVer = -1; }
    }
  }
  private updateParts(g: AboveGame, dt: number) {
    const W = g.world;
    for (const p of this.parts) {
      p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.k === 'crumb' && W.cellAt(p.x, p.y) && p.vy > 0) { p.vy = 0; p.vx *= 0.5; p.g = 0; }
      if (p.k === 'drop' && W.water.inWater(p.x, p.y)) p.life = Math.min(p.life, p.t + 0.02);
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
  }
  private drawParts(g: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const k = 1 - p.t / p.life; g.globalAlpha = Math.min(1, k * 1.6);
      if (p.k === 'crumb') { g.fillStyle = p.c!; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      else if (p.k === 'dust') { g.fillStyle = 'rgba(214,186,140,.5)'; g.beginPath(); g.arc(p.x, p.y, p.s * (1.6 - k * 0.6), 0, 7); g.fill(); }
      else if (p.k === 'drop') { g.fillStyle = '#bff1ff'; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); }
      else if (p.k === 'leaf' || p.k === 'conf') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.k === 'leaf' ? '#7cc443' : p.c!;
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, 7); g.fill(); g.restore();
      }
      else if (p.k === 'star') { const a = p.a0! + p.t * 7; this.star(g, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22 * 0.4, 6, '#ffe36e'); }
      else if (p.k === 'mote') { g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
  }

  // ───────────────────────────── the frame
  draw(G: AboveGame, dt: number, lab: Labels) {
    this.t = G.t;
    this.updateParts(G, dt);
    const L = this.L, C = this.cam, g = this.cx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20140c'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    this.camera(G, dt, G.mode !== 'title' || L.mode === 'portrait');
    g.save(); g.beginPath(); g.rect(L.vx, L.vy, L.vw, L.vh); g.clip();
    const sh = G.shake ? (rand() - 0.5) * G.shake : 0;
    g.translate(C.ox + sh, C.oy + sh * 0.6); g.scale(C.s, C.s);
    g.beginPath(); g.rect(0, 0, WW, WH); g.clip();
    const t = G.t;
    const bg = this.img[G.room.bg]; if (bg) g.drawImage(bg, 0, 0, WW, WH);
    drawRoomBack(this, g, G, t);
    this.drawSoil(g, G);
    drawRoomMid(this, g, G, t);
    this.drawGhost(g, G);
    this.drawHero(g, G, G.heroes.enzo); this.drawHero(g, G, G.heroes.dora);
    this.drawWater(g, G, t);
    drawRoomFront(this, g, G, t);
    this.drawHawk(g, G, t);
    this.drawParts(g);
    this.drawGlints(g, G, t);
    this.drawBubbles(g, G);
    const padHint = this.drawPrompt(g, G, lab);
    if (G.flash) { g.fillStyle = `rgba(255,250,220,${G.flash * 0.6})`; g.fillRect(0, 0, WW, WH); }
    g.restore();
    const fa = Math.max(G.leaving ? Math.min(1, G.leaving / 0.6) : 0, G.fadeIn);
    if (fa > 0) { g.fillStyle = `rgba(24,14,8,${fa})`; g.fillRect(L.vx, L.vy, L.vw, L.vh); }
    if (G.mode !== 'title') this.drawHUD(g, G);
    this.drawCard(g, G);
    if (L.touch && G.mode === 'play') this.drawTouch(g, G, padHint);
  }
  private drawSoil(g: CanvasRenderingContext2D, G: AboveGame) {
    const W = G.world;
    if (!this.soilCan) { this.soilCan = document.createElement('canvas'); this.soilCan.width = WW / 2; this.soilCan.height = WH / 2; }
    if (this.soilVer !== W.version) {
      const c = this.soilCan.getContext('2d')!; c.setTransform(0.5, 0, 0, 0.5, 0, 0); c.clearRect(0, 0, WW, WH);
      c.fillStyle = '#000';
      for (let b = 0; b < GH; b++) for (let a = 0; a < GW; a++) if (W.grid[b * GW + a] === 2) {
        const j = ((a * 73856093) ^ (b * 19349663)) % 7;
        c.beginPath(); c.arc(a * CELL + 4 + (j % 3) - 1, b * CELL + 4 + (j % 2), 7 + j * 0.5, 0, 7); c.fill();
      }
      c.globalCompositeOperation = 'source-in';
      const tex = this.img.soil; if (tex && tex.complete && tex.naturalWidth) { c.fillStyle = c.createPattern(tex, 'repeat')!; c.fillRect(0, 0, WW, WH); }
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,214,150,.10)'; c.fillRect(0, 0, WW, WH);
      c.globalCompositeOperation = 'source-over';
      this.soilVer = W.version;
    }
    g.save(); g.shadowColor = 'rgba(30,12,4,.75)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
    g.drawImage(this.soilCan, 0, 0, WW, WH); g.restore();
  }
  private drawWater(g: CanvasRenderingContext2D, G: AboveGame, t: number) {
    const Wt = G.world.water, r = Wt.rect; if (!r) return;
    const lv = Wt.level, x0 = r[0], x1 = r[2], bot = r[3];
    if (lv >= bot) return;
    g.save(); g.beginPath(); g.roundRect(x0, r[1], x1 - x0, bot - r[1] + 28, 34); g.clip();
    const wave = (x: number) => lv + Math.sin(x * 0.05 + t * 3) * 2.5 + Math.sin(x * 0.13 - t * 2) * 1.2;
    const gr = g.createLinearGradient(0, lv, 0, bot + 30);
    gr.addColorStop(0, 'rgba(80,220,225,.50)'); gr.addColorStop(0.25, 'rgba(50,180,200,.58)'); gr.addColorStop(1, 'rgba(18,100,130,.74)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, bot + 40);
    for (let x = x0; x <= x1; x += 12) g.lineTo(x, wave(x));
    g.lineTo(x1, bot + 40); g.fill();
    g.strokeStyle = 'rgba(230,255,255,.85)'; g.lineWidth = 2.5; g.beginPath();
    for (let x = x0; x <= x1; x += 12) g.lineTo(x, wave(x));
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = x0 + 40 + ((i * 83 + t * 14) % Math.max(60, x1 - x0 - 80)), y = lv + 30 + (i % 3) * 46 + Math.sin(t + i) * 6;
      this.glow(g, x, y, 34, 'rgba(120,255,240,.10)');
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  private drawHawk(g: CanvasRenderingContext2D, G: AboveGame, t: number) {
    const k = G.o.hawk, cfg = G.room.hawk, D = G.heroes.dora; if (!cfg || !k.on) return;
    if (k.phase === 'warn') {   // a speck circling high above, a screech: the tell
      const a = k.t * 4, cxh = Math.max(cfg.x0 + 200, Math.min(cfg.x1 - 200, D.x + 120));
      this.spr(g, 'hawk2', cxh + Math.cos(a) * 60, 90 + Math.sin(a) * 18, Math.sin(a) > 0 ? -1 : 1, { s: 0.35 + k.t * 0.1 });
    }
    if (D.state === 'carried') { this.spr(g, ['hawk1', 'hawk2', 'hawk1', 'hawk4'][Math.floor(t * 8) % 4], D.x - 6, D.y - 120, 1, { mid: true }); return; }
    if (k.phase !== 'pass') return;
    const sx = G.shadowX(), gy = G.world.groundY(sx);
    g.save(); g.globalAlpha = 0.42; if ('filter' in g) g.filter = 'blur(3px)';
    const f = FRAMES.hawk1, sil = this.silhouette('hawk1', '#1a1006'), kk = 1 / PX;
    g.translate(sx, gy - 6); g.scale(kk * 0.9, kk * 0.28); g.drawImage(sil, -f[5], -f[4] / 2);
    g.restore();
    const hy = 150 + Math.sin(k.t / 2.3 * Math.PI) * 70;
    this.spr(g, ['hawk1', 'hawk2', 'hawk1', 'hawk4'][Math.floor(t * 6) % 4], k.x, hy, 1, { mid: true });
  }
  private drawHero(g: CanvasRenderingContext2D, G: AboveGame, h: Hero) {
    const f = G.heroFrame(h);
    const breathe = f.endsWith('idle') ? 1 + Math.sin(h.t * 2.4) * 0.012 : 1;
    const fl = h.state === 'hurt' && Math.floor(h.t * 20) % 2 ? 0.55 : 1;
    const steered = !!G.heroInput(h);
    const shake = h.state === 'brace' && !steered && h.brace!.grace < 1.2 ? Math.sin(h.t * 60) * 1.5 : 0;   // trembling: about to let go
    if (h.ground && h.state !== 'ride' && h.state !== 'carried') { g.fillStyle = 'rgba(30,15,5,.25)'; g.beginPath(); g.ellipse(h.x, h.y - 1, 22, 5, 0, 0, 7); g.fill(); }
    let y = h.y + 2;
    if (h.state === 'clamber') y = h.clY + (h.y - h.clY) * (h.clT / 0.32);
    const x = (h.state === 'clamber' ? h.clX + (h.x - h.clX) * (h.clT / 0.32) : h.x) + shake;
    const clip = G.room.clipHero ? G.room.clipHero(G, h) : null;
    if (clip != null) { g.save(); g.beginPath(); g.rect(0, 0, WW, clip); g.clip(); this.spr(g, f, x, y, h.face, { sy: breathe, a: fl }); g.restore(); return; }
    this.spr(g, f, x, y, h.face, { sy: breathe, a: fl });
    if (h.state === 'brace' && !steered && !G.twoP) {   // the grace ring: how long they can hold on alone
      const k = Math.max(0, h.brace!.grace / G.graceFor()); g.strokeStyle = k < 0.35 ? '#ff8a5c' : '#ffd447'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y - 150, 14, -Math.PI / 2, -Math.PI / 2 + k * 6.283); g.stroke(); g.lineCap = 'butt';
    }
    if (!G.twoP && G.active === h.id && G.mode === 'play') { g.globalAlpha = 0.5 + Math.sin(G.t * 5) * 0.3; this.star(g, x, y - 136, 7, '#fff7c2'); g.globalAlpha = 1; }
  }
  private drawGhost(g: CanvasRenderingContext2D, G: AboveGame) {
    const gh = G.ghost(); if (!gh) return;
    const f = FRAMES[gh.frame] ? gh.frame : gh.who[0] + '_idle';
    g.save(); g.globalAlpha = gh.alpha; this.spr(g, f, gh.x, gh.y + 2, gh.face, { sil: true }); g.restore();
  }
  private drawGlints(g: CanvasRenderingContext2D, G: AboveGame, t: number) {
    const idle = Math.min(1, (t - G.lastInput) / 4);
    for (const [x, y] of G.glints()) for (let i = 0; i < 3; i++) {
      const a = t * 2.2 + i * 2.1, r = 18 + i * 6;
      g.globalAlpha = (0.45 + 0.4 * idle) * (0.5 + 0.5 * Math.sin(t * 5 + i * 2));
      this.star(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 5 + 3 * idle, '#fffbe0');
    }
    g.globalAlpha = 1;
  }
  private drawBubbles(g: CanvasRenderingContext2D, G: AboveGame) {
    for (const b of G.bubbles) {
      const h = G.heroes[b.who], a = Math.min(1, b.t * 5, (1.8 - b.t) * 3), x = h.x + h.face * 30, y = h.y - 150 - Math.min(1, b.t * 4) * 8;
      g.globalAlpha = Math.max(0, a); g.fillStyle = '#fff8ea'; g.strokeStyle = '#5b3a20'; g.lineWidth = 3;
      g.beginPath(); g.roundRect(x - 30, y - 30, 60, 52, 18); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x - 10, y + 21); g.lineTo(x - 18 * h.face, y + 36); g.lineTo(x + 6, y + 21); g.fill();
      const f = FRAMES[b.icon]; if (f) { const sc = Math.min(40 / (f[3] / PX), 36 / (f[4] / PX)); this.spr(g, b.icon, x, y + 16, 1, { s: sc }); }
      if (b.calling) { g.fillStyle = '#e8573c'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText('!', x + 26, y - 18); }
      g.globalAlpha = 1;
    }
  }
  /** the key to press, in the player's own keys; on touch, the button to press glows instead (returned) */
  private drawPrompt(g: CanvasRenderingContext2D, G: AboveGame, lab: Labels): Prompt['what'] | null {
    if (!G.showKeys || G.mode !== 'play') return null;
    const p = G.prompt(); if (!p) return null;
    if (this.L.touch && lab.mode === 'touch') return p.what;
    const h = G.heroes[p.who], x = h.x, y = h.y - 170 + Math.sin(G.t * 4) * 4;
    const label = keyLabel(p, G.twoP, lab);
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, (G.t - G.keysOn) * 3));
    this.keycap(g, label, x, y, 38);
    if (p.hold) { g.strokeStyle = '#ffd447'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + ((G.t * 0.8) % 1) * 6.283); g.stroke(); }
    g.restore();
    return null;
  }
  keycap(g: CanvasRenderingContext2D, label: string, x: number, y: number, sz: number) {
    const w = Math.max(sz, label.length * sz * 0.42 + sz * 0.5);
    this.rr(g, x - w / 2, y - sz / 2 + 3, w, sz, sz * 0.22, '#8a6a4a'); this.rr(g, x - w / 2, y - sz / 2, w, sz, sz * 0.22, '#fff8ea', '#5b3a20', 2);
    this.txt(g, label, x, y + 1, sz * 0.5, '#4a2e18', 'center', null);
  }

  // ───────────────────────────── HUD, card, touch
  private uScale() { const L = this.L; return L.mode === 'portrait' ? Math.min(1, L.w / 420) : Math.max(0.62, Math.min(1.3, Math.min(L.vw / 1280, L.vh / 800))); }
  private hudRect() {
    const L = this.L;
    if (L.mode === 'portrait') return { x: 8, y: 4, w: L.w - 16, h: L.vy - 8, u: this.uScale() };
    return { x: L.vx + 10, y: L.vy + 8, w: L.vw - 20, h: 70, u: this.uScale() };
  }
  private portrait(g: CanvasRenderingContext2D, G: AboveGame, id: HeroId, x: number, y: number, r: number, active: boolean, need: boolean) {
    y -= need ? Math.abs(Math.sin(G.t * 6)) * r * 0.18 : 0;
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = id === 'dora' ? '#cfeaa8' : '#c9b79a'; g.fill(); g.clip();
    const f = FRAMES[id[0] + '_face'], s = r * 2.15 / (f[4] / PX);
    this.spr(g, id[0] + '_face', x, y + r * 1.08, 1, { s }); g.restore();
    g.beginPath(); g.arc(x, y, r, 0, 7); g.lineWidth = active ? r * 0.16 : r * 0.09; g.strokeStyle = active ? '#ffd447' : '#7a5230'; g.stroke();
    if (active) { g.globalAlpha = 0.5 + Math.sin(G.t * 4) * 0.3; g.lineWidth = 2; g.strokeStyle = '#fff5c0'; g.beginPath(); g.arc(x, y, r * 1.18, 0, 7); g.stroke(); g.globalAlpha = 1; }
  }
  private drawHUD(g: CanvasRenderingContext2D, G: AboveGame) {
    const H = this.hudRect(), u = H.u, r = 26 * u;
    const need = G.mode === 'play' && !G.twoP ? G.need : null;
    this.portrait(g, G, 'dora', H.x + r + 4, H.y + r + 4, r, G.twoP || G.active === 'dora', need === 'dora' && G.active !== 'dora');
    this.portrait(g, G, 'enzo', H.x + r * 3.4 + 4, H.y + r + 4, r, G.twoP || G.active === 'enzo', need === 'enzo' && G.active !== 'enzo');
    if (!G.twoP) this.star(g, G.active === 'dora' ? H.x + r + 4 : H.x + r * 3.4 + 4, H.y + r * 2.4 + 6, 6 * u, '#ffd447');
    // chapter progress: one painted icon per room, the current one lit
    for (let i = 0; i < ROOMS.length; i++) {
      const x = H.x + r * 5 + 18 * u + i * 34 * u, y = H.y + r + 4, f = FRAMES[ROOM_ICON[i]], sc = Math.min(28 / (f[3] / PX), 26 / (f[4] / PX)) * u;
      g.globalAlpha = i < G.idx ? 1 : i === G.idx ? 0.65 + Math.sin(G.t * 3) * 0.3 : 0.25;
      this.spr(g, ROOM_ICON[i], x, y + 12 * u, 1, { s: sc });
    }
    g.globalAlpha = 1;
    if (G.room.id === 'den' && G.o.gb) this.drawBossBar(g, G, H, u);
  }
  private drawBossBar(g: CanvasRenderingContext2D, G: AboveGame, H: { y: number }, u: number) {   // OLD GRUBBER with a grumpiness bar that empties as he tires
    const b = G.o.gb!, a = G.o.bar ?? 0, L = this.L; if (a <= 0) return;
    const pm = L.mode === 'portrait', w = Math.min(pm ? L.w - 40 : 380 * u, L.vw - 40), x = pm ? L.w / 2 - w / 2 : L.vx + L.vw / 2 - w / 2;
    const y = pm ? L.vy + 18 : H.y + 50 * u;
    g.globalAlpha = a;
    this.rr(g, x, y, w, 26 * u, 13 * u, 'rgba(40,22,10,.75)', '#f3d6a0', 2);
    const kk = b.st === 'yawn' || b.st === 'sleep' ? 0 : Math.max(0, b.hp) / 3;
    if (kk > 0) this.rr(g, x + 4, y + 4, (w - 8) * kk, 18 * u, 9 * u, '#d9603b');
    for (let i = 1; i < 3; i++) { g.fillStyle = 'rgba(40,22,10,.8)'; g.fillRect(x + 4 + (w - 8) * i / 3 - 1, y + 4, 2, 18 * u); }
    g.save(); g.beginPath(); g.arc(x - 6, y + 13 * u, 22 * u, 0, 7); g.fillStyle = '#c9a77c'; g.fill(); g.clip();
    this.spr(g, 'g_face', x - 6, y + 13 * u + 22 * u, 1, { s: 44 * u / 63 }); g.restore();
    this.txt(g, 'OLD GRUBBER', x + w / 2, y - 10 * u, 16 * u, '#fff4dc', 'center', '#3a2312');
    g.globalAlpha = 1;
  }
  private drawCard(g: CanvasRenderingContext2D, G: AboveGame) {   // the room name slides in at the start of each room
    if (!G.card || G.mode !== 'play') return;
    const t = G.card.t, a = Math.min(1, t * 3, (2.6 - t) * 2.5); if (a <= 0) return;
    const L = this.L, u = L.mode === 'portrait' ? 0.62 : this.uScale(), X = L.vx + L.vw / 2, y = L.vy + L.vh * 0.2 - (1 - Math.min(1, t * 3)) * 20;
    g.globalAlpha = a;
    const w = Math.min(L.vw - 30, 420 * u);
    this.rr(g, X - w / 2, y - 34 * u, w, 68 * u, 34 * u, 'rgba(255,248,234,.92)', '#5b3a20', 3);
    this.txt(g, G.card.name, X, y + 2, 34 * u, '#5b3a20', 'center', null);
    g.globalAlpha = 1;
  }
  private drawTouch(g: CanvasRenderingContext2D, G: AboveGame, hint: Prompt['what'] | null) {
    const P = this.L.pad, pulse = 0.5 + 0.5 * Math.sin(G.t * 6), S = P.stick; if (!S) return;
    g.globalAlpha = 0.9;
    g.fillStyle = 'rgba(255,248,234,.18)'; g.strokeStyle = 'rgba(255,248,234,.6)'; g.lineWidth = 3;
    g.beginPath(); g.arc(S.x, S.y, S.r, 0, 7); g.fill(); g.stroke();
    const kx = this.knob.on ? S.x + this.knob.dx * S.r * 0.6 : S.x, ky = this.knob.on ? S.y + this.knob.dy * S.r * 0.6 : S.y;
    g.fillStyle = 'rgba(255,248,234,.85)'; g.beginPath(); g.arc(kx, ky, S.r * 0.42, 0, 7); g.fill();
    if (hint === 'move' || hint === 'up' || hint === 'down') { g.strokeStyle = `rgba(255,212,71,${pulse})`; g.lineWidth = 5; g.beginPath(); g.arc(S.x, S.y, S.r + 6, 0, 7); g.stroke(); }
    for (const k of ['jump', 'act', 'swap'] as const) {
      const b = P[k]; if (!b || (G.twoP && k === 'swap')) continue;
      g.fillStyle = this.held[k] ? 'rgba(255,231,168,.95)' : 'rgba(255,248,234,.8)'; g.strokeStyle = '#5b3a20'; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); g.stroke();
      if (hint === k) { g.strokeStyle = `rgba(255,212,71,${pulse})`; g.lineWidth = 6; g.beginPath(); g.arc(b.x, b.y, b.r + 7, 0, 7); g.stroke(); }
      g.strokeStyle = '#5b3a20'; g.lineWidth = b.r * 0.14; g.lineCap = 'round';
      const r = b.r * 0.42;
      if (k === 'jump') { g.beginPath(); g.moveTo(b.x - r, b.y + r * 0.4); g.lineTo(b.x, b.y - r * 0.6); g.lineTo(b.x + r, b.y + r * 0.4); g.stroke(); }
      if (k === 'act') { this.star(g, b.x, b.y, r * 1.05, '#e8a53c'); this.star(g, b.x, b.y, r * 0.45, '#fff4dc'); }
      if (k === 'swap') {   // the face of the hero you would swap to
        const other = G.active === 'dora' ? 'e' : 'd', rr = b.r * 0.8, f = FRAMES[other + '_face'];
        g.save(); g.beginPath(); g.arc(b.x, b.y, rr, 0, 7); g.clip(); this.spr(g, other + '_face', b.x, b.y + rr * 1.1, 1, { s: rr * 2.2 / (f[4] / PX) }); g.restore();
      }
    }
    g.globalAlpha = 1; g.lineCap = 'butt';
  }
}

/** the label on the key prompt, in the keys the player is using */
export function keyLabel(p: Prompt, twoP: boolean, lab: Labels): string {
  const pad = lab.mode === 'pad', en = twoP && p.who === 'enzo', wasd = !en && (twoP || lab.moveKeys === 'wasd');
  if (p.what === 'move') {
    if (pad) return p.dir < 0 ? '◀' : '▶';
    if (twoP) return p.who === 'dora' ? (p.dir < 0 ? 'A' : 'D') : (p.dir < 0 ? '←' : '→');
    return lab.moveKeys === 'wasd' ? (p.dir < 0 ? 'A' : 'D') : (p.dir < 0 ? '←' : '→');
  }
  return { act: pad ? 'X' : en ? '.' : 'E', jump: pad ? 'A' : en ? '/' : 'Space', swap: pad ? 'Y' : 'Shift', up: pad ? '▲' : wasd ? 'W' : '↑', down: pad ? '▼' : wasd ? 'S' : '↓' }[p.what];
}

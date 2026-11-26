// Lookout Ridge: the drawing. Canvas 2D at a fixed 1536 x 864, scaled by CSS. The painted woven ground lives on its
// own bitmap, which replays the engine's terrain ops (cut, darn, shift) so it always matches the engine's alpha mask;
// frayed-thread fringes go on a second bitmap, redrawn when the engine's stamps change. Art is the painted webps in
// public/art/lookout-ridge/. Rules are in lib/lookout-ridge-game.ts.
import { W, H, RH, NIGHT, ORDER, CHAMBER, surfaceY, GRASS_STEP, GRASS_H, type LookoutGame, type Unit, type TerrainOp } from './lookout-ridge-game';

export const ART_BASE = '/art/lookout-ridge/';
export const ART_LIST = ['sky', 'ground', 'fringe', 'puff', 'tab', 'pebble', 'pot', 'stone', 'logball',
  'dora-idle', 'dora-fire', 'enzo-idle', 'enzo-fire', 'fox-idle', 'fox-fire', 'eagle-a', 'eagle-b',
  'needle', 'darn', 'pom', 'burrow', 'kit-0', 'kit-1', 'kit-2'] as const;
const PORTRAIT: Record<string, [number, number, number]> = { dora: [0.30, 0.20, 0.42], enzo: [0.30, 0.20, 0.42], fox: [0.62, 0.24, 0.45], eagle: [0.17, 0.42, 0.42] };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';

export class LookoutScene {
  readonly cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art: Record<string, HTMLImageElement | null> = {};
  private terr: HTMLCanvasElement; private tctx: CanvasRenderingContext2D;
  private fringeCv: HTMLCanvasElement; private fctx: CanvasRenderingContext2D;
  private darnPat: CanvasPattern | null = null;
  private gen = -1; private applied = 0; private fringeVer = -1;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; cv.width = W; cv.height = H;
    this.ctx = cv.getContext('2d')!;
    this.terr = document.createElement('canvas'); this.terr.width = W; this.terr.height = H;
    this.tctx = this.terr.getContext('2d', { willReadFrequently: true })!;
    this.fringeCv = document.createElement('canvas'); this.fringeCv.width = W; this.fringeCv.height = H;
    this.fctx = this.fringeCv.getContext('2d')!;
  }

  load(base = ART_BASE) {
    return Promise.all(ART_LIST.map((n) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => { this.art[n] = im; res(); };
      im.onerror = () => { this.art[n] = null; res(); };
      im.src = base + n + '.webp';
    }))).then(() => {
      const d = this.art.darn;
      if (d) { const c = document.createElement('canvas'); c.width = c.height = 150; c.getContext('2d')!.drawImage(d, 0, 0, 150, 150); this.darnPat = this.tctx.createPattern(c, 'repeat'); }
    });
  }

  /** brings the ground bitmap up to date with the engine's terrain ops */
  sync(g: LookoutGame) {
    if (g.gen !== this.gen) { this.paintGround(); this.gen = g.gen; this.applied = 0; this.fringeVer = -1; }
    const ops = g.ops;
    while (this.applied < ops.length) this.apply(ops[this.applied++]);
    if (g.fringeVer !== this.fringeVer) { this.fringeVer = g.fringeVer; this.drawFringes(g); }
  }
  private paintGround() {
    const t = this.tctx, g = this.art.ground;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, W, H);
    t.beginPath(); t.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) t.lineTo(x, surfaceY(x));
    t.lineTo(W, H); t.closePath();
    t.save(); t.clip();
    if (g) {
      // cloth bands stay level (like a real weave); only the grass tuft band follows the surface
      const tw = g.width, th = g.height, k = W / tw;
      const grassH = th * 0.065, top = 430;
      t.drawImage(g, 0, grassH, tw, th - grassH, 0, top, W, (th - grassH) * k);
      t.restore();
      t.save();
      const gh = GRASS_H, step = GRASS_STEP;
      for (let x = -step; x < W + step; x += step) {
        const sy = surfaceY(x), sy2 = surfaceY(x + step);
        const ang = Math.atan2(sy2 - sy, step), len = Math.hypot(step, sy2 - sy);
        t.save(); t.translate(x, sy); t.rotate(ang);
        t.drawImage(g, ((x + W) % W / W) * tw, 0, len / k, grassH, 0, -gh * 0.4, len + 1.2, gh);
        t.restore();
      }
    } else { t.fillStyle = '#7a2a55'; t.fillRect(0, 0, W, H); }
    t.restore();
  }
  private path(pts: ArrayLike<number>[]) { const t = this.tctx; t.beginPath(); for (let i = 0; i < pts.length; i++) i ? t.lineTo(pts[i][0], pts[i][1]) : t.moveTo(pts[i][0], pts[i][1]); t.closePath(); }
  private apply(op: TerrainOp) {
    const t = this.tctx;
    if (op.k === 'cut') {
      t.save();
      t.globalCompositeOperation = 'destination-out';
      this.path(op.pts); t.fill();
      // darken the cut edge so the cloth reads as having thickness
      t.globalCompositeOperation = 'source-atop';
      t.strokeStyle = 'rgba(40,10,35,0.55)'; t.lineWidth = 7; t.stroke();
      t.restore();
    } else if (op.k === 'darn') {
      const { cx, cy, r } = op;
      t.save();
      this.path(op.pts); t.clip();
      t.globalCompositeOperation = 'destination-over';   // fills only the gaps; old cloth stays as it was
      t.fillStyle = this.darnPat || '#e9d39a'; t.fillRect(cx - r - 10, cy - r - 10, r * 2 + 20, r * 2 + 20);
      t.globalCompositeOperation = 'source-atop';
      this.path(op.pts); t.setLineDash([10, 7]); t.lineWidth = 4; t.strokeStyle = '#d9822b'; t.stroke();
      t.restore();
      // the kits' pocket stays open
      t.save(); t.globalCompositeOperation = 'destination-out'; t.beginPath();
      for (const [dx, dy, cr] of CHAMBER) { t.moveTo(op.bx + dx + cr - 3, op.by + dy); t.arc(op.bx + dx, op.by + dy, cr - 3, 0, Math.PI * 2); }
      t.fill(); t.restore();
    } else {
      // the row unravels: everything woven above it drops one row
      const img = t.getImageData(op.x0, 0, op.n, op.top);
      t.clearRect(op.x0, 0, op.n, op.top + RH);
      t.putImageData(img, op.x0, RH);
    }
  }
  private drawFringes(g: LookoutGame) {
    const f = this.fctx, im = this.art.fringe;
    f.clearRect(0, 0, W, H);
    if (!im) return;
    const fw = im.width, fh = im.height, sw = fw * 0.06;
    for (const s of g.stamps) {
      if (!g.solid(s.ax, s.ay)) continue;
      f.save();
      f.translate(s.x, s.y); f.rotate(s.rot);
      const dw = sw * s.sc * 1.6, dh = fh * s.sc * 1.6;
      f.drawImage(im, Math.min(s.sx * fw, fw - sw), 0, sw, fh, -dw / 2, -dh * 0.06, dw, dh);
      f.restore();
    }
  }
  /** the ground bitmap's alpha at a point (for the browser tests) */
  groundAlpha(x: number, y: number) { return this.tctx.getImageData(x | 0, y | 0, 1, 1).data[3]; }

  // ---------------------------------------------------------------- drawing
  private sprite(name: string, x: number, y: number, h: number, face: number, anchorBottom = true) {
    const im = this.art[name]; if (!im) return;
    const c = this.ctx, w = im.width / im.height * h;
    c.save(); c.translate(x, y);
    if (face < 0) c.scale(-1, 1);
    c.drawImage(im, -w / 2, anchorBottom ? -h : -h / 2, w, h);
    c.restore();
  }
  private text(t: string, x: number, y: number, size: number, color = '#3a1238', align: CanvasTextAlign = 'center') {
    const c = this.ctx;
    c.font = `700 ${size}px ${FONT}`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(t, x, y);
  }
  private tab(x: number, y: number, w: number, h: number) {
    const c = this.ctx, im = this.art.tab;
    if (im) {
      const cw = im.height * 0.9, dc = h * 0.9;
      c.drawImage(im, 0, 0, cw, im.height, x, y, dc, h);
      c.drawImage(im, cw, 0, im.width - 2 * cw, im.height, x + dc, y, w - 2 * dc, h);
      c.drawImage(im, im.width - cw, 0, cw, im.height, x + w - dc, y, dc, h);
      return dc * 0.95;
    }
    c.fillStyle = '#f4e3c8'; c.fillRect(x, y, w, h); return 12;
  }

  draw(g: LookoutGame) {
    this.sync(g);
    const c = this.ctx, st = g.state;
    c.clearRect(0, 0, W, H);
    if (this.art.sky) c.drawImage(this.art.sky, 0, 0, W, H); else { c.fillStyle = '#b9a6dc'; c.fillRect(0, 0, W, H); }
    const dusk = st === 'title' ? 0 : clamp((g.round - 1) / (NIGHT - 1), 0, 1);
    if (dusk) { c.fillStyle = `rgba(28,18,70,${0.55 * dusk})`; c.fillRect(0, 0, W, H); }
    if (this.art.burrow) c.drawImage(this.art.burrow, g.BURROW.x - 84, g.BURROW.y - 44, 230, 92);   // the pocket's lining shows where cloth is cut
    c.drawImage(this.terr, 0, 0); c.drawImage(this.fringeCv, 0, 0);
    if (dusk) { c.fillStyle = `rgba(20,10,50,${0.22 * dusk})`; c.fillRect(0, 0, W, H); }
    if (st === 'title') { this.drawTitle(); return; }
    this.drawThreads(g);
    this.drawKits(g);
    for (const u of g.units) this.drawUnit(g, u);
    if (st === 'aim' && g.cur) this.drawGuide(g, g.cur);
    for (const sh of g.shells) if (!sh.done) {
      const im = this.art[sh.s.art], s = sh.s.size * 2;
      if (im && sh.s.darn) { const w = s * 2.2, h = w * im.height / im.width; c.save(); c.translate(sh.x, sh.y); c.rotate(Math.atan2(sh.vy, sh.vx)); c.drawImage(im, -w * 0.8, -h / 2, w, h); c.restore(); }
      else if (im) { c.save(); c.translate(sh.x, sh.y); c.rotate(sh.rot); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore(); }
    }
    for (const p of g.puffs) {
      const k = p.t / 40, s = p.r * (2 + k * 1.4);
      if (this.art.puff) { c.save(); c.globalAlpha = 1 - k; c.drawImage(this.art.puff, p.x - s / 2, p.y - s / 2, s, s); c.restore(); }
    }
    for (const f of g.floats) {
      c.save(); c.globalAlpha = 1 - f.t / 70; c.lineWidth = 6; c.strokeStyle = '#2a0f2a';
      c.font = `800 ${f.big ? 40 : 30}px ${FONT}`; c.textAlign = 'center';
      c.strokeText(f.txt, f.x, f.y - f.t * 0.7); c.fillStyle = f.big ? '#ffd24a' : '#fff4e0'; c.fillText(f.txt, f.x, f.y - f.t * 0.7);
      c.restore();
    }
    this.drawHud(g);
    if ((g.bannerT > 0 || st === 'over') && g.banner) {
      const a = st === 'over' ? 1 : Math.min(1, g.bannerT / 20);
      c.save(); c.globalAlpha = a; this.tab(W / 2 - 400, 150, 800, 90); this.text(g.banner, W / 2, 195, 34); c.restore();
      if (st === 'over' && g.endT > 40) { c.save(); this.tab(W / 2 - 300, 260, 600, 64); this.text('Space or click to play again', W / 2, 292, 24); c.restore(); }
    }
  }
  private drawUnit(g: LookoutGame, u: Unit) {
    const c = this.ctx;
    let name = u.firing > 0 ? u.fire : (u.flying ? (Math.floor(Date.now() / 260) % 2 ? 'eagle-a' : 'eagle-b') : u.idle);
    if (!this.art[name]) name = u.idle;
    c.save();
    if (!u.alive) { c.filter = 'grayscale(1) brightness(0.8)'; c.globalAlpha = 0.55; }
    else if (u.hurtT > 0 && u.hurtT % 6 < 3) c.filter = 'brightness(1.6)';
    // sprites are painted facing right (heroes) / left (predators)
    const painted = u.side === 'hero' ? 1 : -1;
    if (u.alive || !u.flying || u.y < H + 80) this.sprite(name, u.x, u.flying ? u.y : u.y + 4, u.h, u.face * painted, !u.flying);
    c.restore();
    if (!u.alive) return;
    // health bar
    const bw = 64, by = (u.flying ? u.y - u.h / 2 : u.y - u.h) - 14;
    c.fillStyle = 'rgba(30,10,30,0.75)'; c.fillRect(u.x - bw / 2 - 2, by - 2, bw + 4, 10);
    c.fillStyle = u.side === 'hero' ? '#8fd14f' : '#f0784a';
    c.fillRect(u.x - bw / 2, by, bw * u.hp / u.maxHp, 6);
    if (u === g.cur && g.state === 'aim') {
      c.fillStyle = '#ffe9a8'; c.beginPath();
      c.moveTo(u.x - 8, by - 18); c.lineTo(u.x + 8, by - 18); c.lineTo(u.x, by - 8); c.fill();
    }
  }
  private drawGuide(g: LookoutGame, u: Unit) {
    if (!g.aimGuide || u.side !== 'hero' || u.flying) return;
    const c = this.ctx;
    const pw = g.charging ? Math.max(g.power, 8) : (u.lastPower ?? 60);
    const r = g.simulate(u, u.angle, pw, 900);
    const darn = u.shots[u.shot].darn;
    const n = darn ? r.pts.length : Math.floor(r.pts.length * 0.4);   // the needle shows where its patch will go
    c.save(); c.strokeStyle = 'rgba(255,240,210,0.9)'; c.lineWidth = 3; c.setLineDash([9, 7]); c.lineCap = 'round';
    const o = g.muzzle(u);
    c.beginPath(); c.moveTo(o.x, o.y);
    for (let i = 0; i < n; i++) c.lineTo(r.pts[i][0], r.pts[i][1]);
    c.stroke();
    if (darn && r.end === 'ground') { c.setLineDash([6, 6]); c.strokeStyle = '#ffcf6a'; c.beginPath(); c.arc(r.x, r.y, darn, 0, Math.PI * 2); c.stroke(); }
    c.restore();
    // angle needle
    const a = u.angle * Math.PI / 180;
    c.strokeStyle = '#ffd36b'; c.lineWidth = 4; c.beginPath(); c.moveTo(o.x, o.y);
    c.lineTo(o.x + Math.cos(a) * 46 * u.face, o.y - Math.sin(a) * 46); c.stroke();
  }
  private portrait(u: Unit, x: number, y: number, r: number, ring: boolean) {
    const c = this.ctx;
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = u.alive ? '#f9eedb' : '#9a8f8a'; c.fill();
    c.lineWidth = ring ? 5 : 3; c.strokeStyle = ring ? '#e0a020' : (u.side === 'hero' ? '#5a8a3a' : '#b8452e'); c.stroke(); c.clip();
    if (!u.alive) c.filter = 'grayscale(1)';
    const im = this.art[u.idle], [fx, fy, fs] = PORTRAIT[u.id];
    if (im) { const s = fs * im.height; c.drawImage(im, fx * im.width - s / 2, fy * im.height - s / 2, s, s, x - r, y - r, r * 2, r * 2); }
    c.restore();
  }
  private drawHud(g: LookoutGame) {
    const c = this.ctx;
    // turn strip: whose turn now, then who is next
    const x0 = 20 + this.tab(20, 16, 480, 74);
    for (let j = 0; j < 4; j++) {
      const u = g.units.find((v) => v.id === ORDER[(g.turnIdx + j) % 4]);
      if (u) this.portrait(u, x0 + 34 + j * 86, 53, 29, j === 0);
    }
    // wind
    const wx = W / 2 - 170, ci = this.tab(wx, 16, 340, 74);
    this.text('WIND', wx + ci + 44, 53, 28);
    const dir = Math.sign(g.wind);
    c.save(); c.translate(wx + ci + 128, 53); c.strokeStyle = '#3a1238'; c.fillStyle = '#3a1238'; c.lineWidth = 5;
    if (dir) { c.scale(dir, 1); c.beginPath(); c.moveTo(-22, 0); c.lineTo(14, 0); c.stroke(); c.beginPath(); c.moveTo(24, 0); c.lineTo(9, -11); c.lineTo(9, 11); c.fill(); }
    else { c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fill(); }
    c.restore();
    this.text(String(Math.abs(g.wind)), wx + ci + 186, 53, 30);
    // kits still home, and rounds until nightfall
    const kx = W - 400, ki = this.tab(kx, 16, 380, 74);
    for (const k of g.kits) {
      const im = this.art['kit-' + k.i]; if (!im) continue;
      c.save(); if (!k.home) { c.filter = 'grayscale(1)'; c.globalAlpha = 0.35; }
      c.drawImage(im, kx + ki + k.i * 48, 26, 50, 50 * im.height / im.width); c.restore();
    }
    const left = Math.max(0, NIGHT - g.round + 1);
    this.text(left <= 1 ? 'Last round!' : 'Night in ' + left, kx + 380 - ki - 76, 53, 24);
    // bottom bar
    const u = g.cur; if (!u) return;
    const bx = 150, bw = W - 300, by = H - 96;
    const bi = this.tab(bx, by, bw, 80);
    const lx = bx + bi + 6;
    this.text(u.name, lx, by + 27, 22, '#3a1238', 'left');
    const sub = u.side === 'hero' ? (g.autoHero ? 'Auto' : (u.shot + 1) + '  ' + u.shots[u.shot].name + '  ·  1 2 3 or Tab') : 'Predator turn';
    this.text(sub, lx, by + 55, 17, '#6a2a50', 'left');
    // power bar
    const px = lx + 300, pw = bw - bi * 2 - 300 - 230, py = by + 22;
    c.fillStyle = '#2a0f2a'; c.fillRect(px - 3, py - 3, pw + 6, 34);
    const gr = c.createLinearGradient(px, 0, px + pw, 0);
    gr.addColorStop(0, '#5fb83a'); gr.addColorStop(0.55, '#f2c230'); gr.addColorStop(1, '#d8362c');
    c.fillStyle = gr; c.fillRect(px, py, pw * g.power / 100, 28);
    if (u.lastPower != null) { c.fillStyle = '#fff'; c.fillRect(px + pw * u.lastPower / 100 - 2, py - 6, 4, 40); }
    if (!u.flying && u.side === 'hero') {
      c.fillStyle = '#2a0f2a'; c.fillRect(px, py + 34, pw, 7);
      c.fillStyle = '#7fb6e0'; c.fillRect(px, py + 34, pw * (1 - u.moved / u.walk), 7);
    }
    this.text(u.flying ? 'Swooping' : 'ANGLE ' + Math.round(u.angle) + '°', bx + bw - bi - 110, by + 40, 28);
  }
  private drawThreads(g: LookoutGame) {
    const c = this.ctx, tt = performance.now() / 1000;
    for (const p of g.pulls) {
      // the pulled yarn whips out along the row
      c.save(); c.globalAlpha = p.done ? Math.max(0, 1 - p.t / 30) : 1; c.strokeStyle = '#f2b33a'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath();
      for (let x = p.start; (p.dir > 0 ? x <= p.front : x >= p.front); x += p.dir * 6) c.lineTo(x, p.y + Math.sin(x * 0.15 + tt * 20) * 6 - (p.done ? p.t * 2 : 0));
      c.stroke(); c.restore();
    }
    const pom = this.art.pom;
    for (const e of g.ends) {
      const y = g.rowMid(e.row), p = g.pomOf(e);
      // the row this thread holds: a stitched line along it
      c.save(); c.lineCap = 'round';
      c.strokeStyle = 'rgba(40,10,35,0.6)'; c.lineWidth = 7; c.setLineDash([8, 8]);
      c.beginPath(); c.moveTo(e.ex, y); c.lineTo(e.x1 ?? e.ex, y); c.stroke();
      c.strokeStyle = '#ffd36b'; c.lineWidth = 3.5; c.stroke(); c.restore();
      const sway = Math.sin(tt * 2 + e.ex) * 3;
      c.save(); c.strokeStyle = '#f2b33a'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(e.ex, y); c.quadraticCurveTo(e.ex - e.dir * 4, y + 8, p.x + sway, p.y - 8); c.stroke(); c.restore();
      const s = 40 + Math.sin(tt * 4) * 3;
      if (pom) {   // a dark outline so the pom reads apart from the frayed rim
        c.save(); c.filter = 'drop-shadow(0 0 2px #2a0f2a) drop-shadow(0 0 1px #2a0f2a) brightness(1.1)';
        c.drawImage(pom, p.x + sway - s / 2, p.y - s / 2, s, s * pom.height / pom.width); c.restore();
      }
    }
  }
  private drawKits(g: LookoutGame) {
    const c = this.ctx, tt = performance.now() / 1000;
    for (const k of g.kits) {
      const im = this.art['kit-' + k.i]; if (!im) continue;
      const h = 46, w = h * im.width / im.height;
      if (k.home) {
        const bob = Math.abs(Math.sin(tt * 3 + k.i * 1.7)) * 2;
        c.drawImage(im, k.x - w / 2, k.y - h - bob + 2, w, h);
      } else if (k.t < 70) {
        // bolts out of the tunnel and away down the slope
        c.save(); c.globalAlpha = 1 - k.t / 70;
        c.drawImage(im, k.x + k.t * 4 - w / 2, k.y - h - Math.abs(Math.sin(k.t * 0.4)) * 14 + k.t * 0.6, w, h); c.restore();
      }
    }
  }
  private drawTitle() {
    this.sprite('dora-idle', 115, surfaceY(115) + 6, 180, 1); this.sprite('enzo-idle', 268, surfaceY(268) + 6, 128, 1);
    this.sprite('fox-idle', 1395, 520, 170, 1); this.sprite('eagle-a', 1400, 225, 150, 1, false);
    this.tab(W / 2 - 480, 140, 960, 190);
    this.text('Lookout Ridge', W / 2, 205, 64);
    this.text('The burrow', W / 2, 258, 24, '#6a2a50');
    this.tab(W / 2 - 430, 350, 860, 66);
    this.text('Keep the three kits safe in their burrow until nightfall', W / 2, 383, 22);
    this.tab(W / 2 - 430, 428, 860, 120);
    this.text('← →  walk    ↑ ↓  angle    1 2 3 / Tab  shot    G  aim guide', W / 2, 471, 21);
    this.text('Hold Space to charge, let go to fire', W / 2, 505, 21);
    this.tab(W / 2 - 430, 560, 860, 66);
    this.text('3 Darning Needle stitches cloth back  ·  hit a pom-pom to unravel its row', W / 2, 593, 20);
    this.tab(W / 2 - 260, 640, 520, 60);
    this.text('Press Space or click to start', W / 2, 670, 22, '#6a2a50');
  }
}

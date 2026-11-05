// Combo Ball: the drawing. The Codex-painted village pitch at 384 by 216 with its lines drawn on top, the goals,
// then everyone sorted by how far down the pitch they stand (Dora, Enzo and Pip in red, the Grumbles in green, the
// keepers), the ball with its shadow, and the chain: a gold line through every touch of the current move that gets
// brighter and thicker as the mult grows, with sparkles where each pass landed. A Grumble winding up a tackle flashes
// and shows a red mark; the player the person controls has a gold ring and arrow. Goals shake the screen and burst
// with coins. The page scales the canvas up with nearest-neighbour; words (the chain's pop-ups, the count-up) are
// drawn by the page over the top, so they stay sharp.
import * as G from './combo-game';
import type { Ev, Player, Run } from './combo-game';

const SPRITES = [
  'dora-stand', 'dora-run1', 'dora-run2', 'dora-kick', 'enzo-stand', 'enzo-run1', 'enzo-run2', 'enzo-kick', 'pip-stand', 'pip-run',
  'grumble-stand', 'grumble-run1', 'grumble-run2', 'grumble-slide', 'keeper-stand', 'keeper-dive', 'gkeeper-stand', 'gkeeper-dive', 'goal', 'ball', 'flag',
];
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number; g: number };
export type ComboView = { run: Run; time: number; dt: number; reduced: boolean };
const LINE = 'rgba(255,255,240,0.78)';

export class ComboScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  /** each sprite again in solid white, for the tackle wind-up flash */
  private white: Record<string, HTMLCanvasElement> = {};
  private bits: Bit[] = [];
  private shake = 0; private flash = 0; private last = 0; private glow = 0;
  /** the chain line keeps its last shape for a moment after it's wiped, fading out in grey */
  private ghost: { pts: { x: number; y: number }[]; t: number } | null = null;
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = G.W; canvas.height = G.H;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
  }
  load() {
    const all = [...SPRITES.map((n) => [n, `/art/kickabout/${n}.png`]), ['pitch', '/art/combo/pitch.png']];
    return Promise.all(all.map(([n, src]) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d')!; x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
        this.white[n] = c; res();
      };
      im.onerror = () => res();
      im.src = src; this.img[n] = im;
    })));
  }

  events(run: Run, evs: Ev[], reduced: boolean) {
    for (const e of evs) {
      if (e.k === 'gain') this.burst(e.x, e.y - 4, 5 + Math.min(10, e.mult), ['#ffe27a', '#ffd23f', '#fff6c8'], 50);
      else if (e.k === 'wipe') { this.ghost = { pts: [...run.chain.touches, { x: e.x, y: e.y }], t: 0.7 }; this.burst(e.x, e.y, 8, ['#9a9aa8', '#c8c8d0'], 40); }
      else if (e.k === 'goal') {
        if (!reduced) this.shake = 0.5;
        this.flash = 0.35;
        this.burst(G.PITCH.x1 - 4, G.CY, 46, ['#ffe27a', '#ffd23f', '#fff6c8', '#ff9f43', '#ffffff'], 150, 140);
      } else if (e.k === 'concede') { if (!reduced) this.shake = 0.3; this.burst(G.PITCH.x0 + 4, G.CY, 18, ['#7ac850', '#4e9a3a'], 90); }
      else if (e.k === 'post') { if (!reduced) this.shake = Math.max(this.shake, 0.15); this.burst(e.x, e.y, 6, ['#ffffff'], 60); }
      else if (e.k === 'save') this.burst(e.x, e.y, 8, ['#ffffff', '#ffe27a'], 60);
      else if (e.k === 'tackle' || e.k === 'steal') this.burst(e.x, e.y + 2, 7, ['#cdb38a', '#8a7454'], 45);
      else if (e.k === 'shot') this.burst(e.x, e.y, 6, ['#ffffff', '#cdb38a'], 50);
    }
  }
  private burst(x: number, y: number, n: number, cols: string[], speed: number, g = 60) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, t: 0, life: 0.5 + Math.random() * 0.5, c: cols[k % cols.length], s: Math.random() < 0.3 ? 2 : 1, g });
    }
  }

  render(v: ComboView) {
    const { run: r, dt } = v, c = this.ctx, P = G.PITCH;
    this.last = v.time;
    c.save();
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const k = this.shake * 6; c.translate(Math.round((Math.random() - 0.5) * k), Math.round((Math.random() - 0.5) * k)); }
    const bg = this.img.pitch;
    if (bg?.complete && bg.naturalWidth) c.drawImage(bg, 0, 0); else { c.fillStyle = '#4a9e22'; c.fillRect(0, 0, G.W, G.H); }
    this.lines();
    // the left goal sits behind everyone; the right one too (it's at the far end of the pitch from the camera)
    this.goal(P.x0, true); this.goal(P.x1, false);
    // the chain
    this.chain(r, dt);
    // everyone, top of the pitch first
    const order = r.players.slice().sort((a, b) => a.y - b.y);
    const b = r.ball;
    // the ball's shadow goes down before the players so feet cover it
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(Math.round(b.x), Math.round(b.y + 2), 3 - Math.min(1.5, b.z / 12), 1.4, 0, 0, Math.PI * 2); c.fill();
    let ballDrawn = false;
    for (const p of order) {
      if (!ballDrawn && b.y + 2 < p.y) { this.ball(r); ballDrawn = true; }
      this.player(r, p, v.time);
    }
    if (!ballDrawn) this.ball(r);
    // the bits
    for (const p of this.bits) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.98; }
    this.bits = this.bits.filter((p) => p.t < p.life);
    for (const p of this.bits) { c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    c.globalAlpha = 1;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt); c.fillStyle = `rgba(255,240,180,${this.flash * 0.9})`; c.fillRect(0, 0, G.W, G.H); }
    c.restore();
  }

  private lines() {
    const c = this.ctx, P = G.PITCH, B = G.BOX;
    c.strokeStyle = LINE; c.lineWidth = 1;
    const rect = (x: number, y: number, w: number, h: number) => c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    rect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
    c.beginPath(); c.moveTo(Math.round(G.CX) + 0.5, P.y0); c.lineTo(Math.round(G.CX) + 0.5, P.y1); c.stroke();
    c.beginPath(); c.arc(Math.round(G.CX) + 0.5, Math.round(G.CY) + 0.5, 22, 0, Math.PI * 2); c.stroke();
    c.fillStyle = LINE; c.fillRect(Math.round(G.CX) - 1, Math.round(G.CY) - 1, 2, 2);
    for (const left of [true, false]) {
      const gx = left ? P.x0 : P.x1, s = left ? 1 : -1;
      rect(left ? gx : gx - B.d, G.CY - B.h, B.d, B.h * 2);
      rect(left ? gx : gx - 16, G.CY - 30, 16, 60);
      c.fillRect(Math.round(gx + s * 38) - 1, Math.round(G.CY) - 1, 2, 2);
      // the arc on the edge of the box
      c.beginPath(); c.arc(gx + s * 38 + 0.5, G.CY + 0.5, 20, left ? -0.93 : Math.PI - 0.93 + 0, left ? 0.93 : Math.PI + 0.93); c.stroke();
    }
    // the corner flags
    const f = this.img.flag;
    if (f?.complete && f.naturalWidth) for (const [x, y] of [[P.x0, P.y0], [P.x1, P.y0], [P.x0, P.y1], [P.x1, P.y1]]) c.drawImage(f, x - 1, y - f.naturalHeight + 1);
  }
  private goal(gx: number, left: boolean) {
    const c = this.ctx, g = this.img.goal;
    if (!g?.complete || !g.naturalWidth) { c.fillStyle = '#fff'; c.fillRect(gx - 1, G.CY - G.GOAL, 2, G.GOAL * 2); return; }
    const w = g.naturalWidth, h = g.naturalHeight;
    // the sprite's open side faces left: the right goal as drawn, the left one flipped; its mouth spans the goal's posts
    const y = Math.round(G.CY - h / 2 - 3);
    if (left) { c.save(); c.translate(gx + 4, y); c.scale(-1, 1); c.drawImage(g, 0, 0); c.restore(); }
    else c.drawImage(g, gx - 4, y);
    void w;
  }
  private chain(r: Run, dt: number) {
    const c = this.ctx;
    if (this.ghost) {
      this.ghost.t -= dt;
      if (this.ghost.t <= 0) this.ghost = null;
      else this.poly(this.ghost.pts, `rgba(200,200,210,${this.ghost.t})`, 1);
    }
    const ch = r.chain;
    if (!ch.touches.length || r.poss !== 0) return;
    const pts = [...ch.touches.slice(-12), { x: r.ball.x, y: r.ball.y }];
    this.glow += dt;
    const w = ch.mult >= 6 ? 3 : ch.mult >= 3 ? 2 : 1;
    this.poly(pts, 'rgba(120,70,0,0.45)', w + 2);
    this.poly(pts, ch.mult >= 4 ? '#fff2a8' : '#ffd23f', w);
    // a sparkle on every touch
    for (const [k, p] of ch.touches.slice(-12).entries()) {
      const tw = (Math.sin(this.glow * 9 + k) + 1) / 2;
      c.fillStyle = tw > 0.5 ? '#fff6c8' : '#ffd23f';
      c.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); c.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
    }
  }
  private poly(pts: { x: number; y: number }[], col: string, w: number) {
    if (pts.length < 2) return;
    const c = this.ctx;
    c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y + 2);
    for (const p of pts.slice(1)) c.lineTo(p.x, p.y + 2);
    c.stroke();
  }
  private ball(r: Run) {
    const c = this.ctx, b = r.ball, im = this.img.ball;
    const x = Math.round(b.x - 3), y = Math.round(b.y - 3 - b.z);
    if (im?.complete && im.naturalWidth) c.drawImage(im, x, y); else { c.fillStyle = '#fff'; c.fillRect(x, y, 5, 5); }
  }
  private player(r: Run, p: Player, time: number) {
    const c = this.ctx;
    const moving = Math.hypot(p.vx, p.vy) > 8;
    const step = Math.floor(time * 8 + p.i * 0.37) % 2;
    let n: string;
    if (p.who === 'keeper' || p.who === 'gkeeper') n = `${p.who}-${p.dive > 0 ? 'dive' : 'stand'}`;
    else if (p.who === 'grumble') n = p.lunge > 0 || p.slide > 0 ? 'grumble-slide' : moving ? `grumble-run${step + 1}` : 'grumble-stand';
    else if (p.kick < 0.16 && (p.who === 'dora' || p.who === 'enzo')) n = `${p.who}-kick`;
    else if (p.who === 'pip') n = moving || p.kick < 0.16 ? 'pip-run' : 'pip-stand';
    else n = moving ? `${p.who}-run${step + 1}` : `${p.who}-stand`;
    const im = this.img[n];
    const x = Math.round(p.x), y = Math.round(p.y + 4);
    // a shadow and, for the person's player, a gold ring
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y, 6, 2, 0, 0, Math.PI * 2); c.fill();
    const me = p.i === r.ctl;
    if (me) { c.strokeStyle = '#ffd23f'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2); c.stroke(); }
    if (r.pass && r.pass.to === p.i && r.pass.team === 0 && !me) { c.strokeStyle = 'rgba(255,210,63,0.7)'; c.beginPath(); c.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2); c.stroke(); }
    if (!im?.complete || !im.naturalWidth) { c.fillStyle = p.team ? '#3a8a3a' : '#d83a2a'; c.fillRect(x - 4, y - 14, 8, 14); return; }
    const w = im.naturalWidth, h = im.naturalHeight;
    const flash = p.wind > 0 && r.pause <= 0 && Math.floor(time * 20) % 2 === 0;
    const src: CanvasImageSource = flash ? this.white[n] ?? im : im;
    if (p.face < 0) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(src, -Math.round(w / 2), y - h); c.restore(); }
    else c.drawImage(src, x - Math.round(w / 2), y - h);
    // the wind-up of a tackle: a red mark over the Grumble's head
    if (p.wind > 0 && r.pause <= 0) { c.fillStyle = '#ff3b30'; c.fillRect(x - 1, y - h - 7, 2, 4); c.fillRect(x - 1, y - h - 2, 2, 1); }
    if (me) { c.fillStyle = '#ffd23f'; const ty = y - h - 5; c.fillRect(x - 2, ty, 5, 1); c.fillRect(x - 1, ty + 1, 3, 1); c.fillRect(x, ty + 2, 1, 1); }
  }
}

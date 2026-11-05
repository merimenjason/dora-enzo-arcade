// Into Space: the drawing. One of four Codex-painted pitches at 384 by 216 with the lines and boards drawn on top, the
// top-down goals, then everyone sorted by how far down the pitch they stand. The ball is drawn at its height above its
// shadow, so a lofted pass climbs away from the shadow and comes back down to meet it. The landing spot is a gold ring
// that shrinks to nothing at the moment the ball lands, with the arrival circle inside it: get there as the ring closes.
// The reticle shows where a pass would go and which runner would take it. Perfect arrivals slow everything down inside
// a white frame. The page scales the canvas up with nearest-neighbour.
import * as G from './space-game';
import type { Ev, Player, Run } from './space-game';

const KIT = ['dora-stand', 'dora-run1', 'dora-run2', 'dora-kick', 'enzo-stand', 'enzo-run1', 'enzo-run2', 'enzo-kick', 'pip-stand', 'pip-run', 'bram-stand', 'bram-run',
  'grumble-stand', 'grumble-run1', 'grumble-run2', 'grumble-slide', 'keeper-stand', 'keeper-dive', 'gkeeper-stand', 'gkeeper-dive', 'ball'];
const OWN = ['dry', 'wet', 'sand', 'hard', 'goal'];
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; c: string; s: number };
type Pop = { x: number; y: number; t: number; text: string; c: string; big: boolean };
type Ring = { x: number; y: number; t: number; c: string };
export type SpaceView = { run: Run; time: number; dt: number; reduced: boolean };
const DUST: Record<G.PitchId, string[]> = { dry: ['#5a9a3a', '#8ac25a'], wet: ['#cfe6f4', '#8ab4d0'], sand: ['#e8cf96', '#c8a868'], hard: ['#b89a5a', '#8a7040'] };
const RATE: Record<G.Rating, { text: string; c: string }> = { perfect: { text: 'PERFECT', c: '#ffe066' }, early: { text: 'EARLY', c: '#cfd8e8' }, late: { text: 'LATE', c: '#f0a070' } };

export class SpaceScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  private bits: Bit[] = [];
  private pops: Pop[] = [];
  private rings: Ring[] = [];
  private rain: { x: number; y: number }[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  private shake = 0; private flash = 0; private last = 0; private switchT = 0; private walk: Record<number, number> = {};
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = G.W; canvas.height = G.H;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 70; i++) this.rain.push({ x: Math.random() * G.W, y: Math.random() * G.H });
  }
  load() {
    const one = (n: string, src: string) => new Promise<void>((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = src; this.img[n] = im; });
    return Promise.all([...KIT.map((n) => one(n, `/art/kickabout/${n}.png`)), ...OWN.map((n) => one(n, `/art/space/${n}.png`))]);
  }
  private ok(n: string) { const im = this.img[n]; return im && im.complete && im.naturalWidth > 0 ? im : null; }
  /** a sprite with its bottom middle at (x, y), mirrored if asked */
  private put(c: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, flip = false, alpha = 1) {
    const w = im.naturalWidth, h = im.naturalHeight, dx = Math.round(x - w / 2), dy = Math.round(y - h);
    c.globalAlpha = alpha;
    if (!flip) c.drawImage(im, dx, dy);
    else { c.save(); c.translate(dx + w, dy); c.scale(-1, 1); c.drawImage(im, 0, 0); c.restore(); }
    c.globalAlpha = 1;
  }

  events(run: Run, evs: Ev[], reduced: boolean) {
    for (const e of evs) {
      switch (e.k) {
        case 'switch': {
          const p = run.players[e.i]; this.switchT = 0.45;
          this.rings.push({ x: p.x, y: p.y, t: 0, c: '#ffe066' });
          break;
        }
        case 'rate': {
          const r = RATE[e.r];
          this.pops.push({ x: e.x, y: e.y - 32, t: 0, text: e.r === 'perfect' && e.streak > 1 ? `PERFECT ×${e.streak}` : r.text, c: r.c, big: e.r === 'perfect' });
          if (e.r === 'perfect') { this.burst(e.x, e.y, 18, '#ffe066', 70, 0.6, 60); this.rings.push({ x: e.x, y: e.y, t: 0, c: '#ffffff' }); if (!reduced) this.flash = Math.max(this.flash, 0.35); }
          break;
        }
        case 'land': this.burst(e.x, e.y, e.hard ? 10 : 4, DUST[run.pitch][0], e.hard ? 40 : 20, 0.45, 40, DUST[run.pitch][1]); break;
        case 'bounce': this.burst(e.x, e.y, 4, DUST[run.pitch][0], 22, 0.35, 30); break;
        case 'kick': this.burst(e.x, e.y, 4, '#ffffff', 25, 0.25, 20); this.trail = []; break;
        case 'shot': this.trail = []; if (!reduced) this.shake = Math.max(this.shake, e.first ? 2.5 : 1.2); break;
        case 'save': this.burst(e.x, e.y, 8, '#ffffff', 50, 0.35, 40); if (!reduced) this.shake = Math.max(this.shake, 1.5); break;
        case 'post': this.burst(e.x, e.y, 8, '#ffffff', 60, 0.3, 40); if (!reduced) this.shake = Math.max(this.shake, 2.5); break;
        case 'tackle': this.burst(e.x, e.y, e.won ? 8 : 4, DUST[run.pitch][0], 40, 0.4, 40); break;
        case 'intercept': this.pops.push({ x: e.x, y: e.y - 24, t: 0, text: 'CUT OUT', c: '#9ae07a', big: false }); break;
        case 'wall': this.pops.push({ x: e.x, y: e.y - 24, t: 0, text: 'ONE-TWO', c: '#ffe066', big: false }); break;
        case 'goal': {
          const ours = e.side === 0;
          this.flash = reduced ? 0.3 : 1; if (!reduced) this.shake = 6;
          for (let i = 0; i < (reduced ? 12 : 60); i++) this.burst(e.x, e.y, 1, ['#ffe066', '#e8484a', '#ffffff', '#6ad0ff'][i % 4], 120, 1.2, 140);
          break;
        }
      }
    }
  }
  private burst(x: number, y: number, n: number, c: string, sp: number, life: number, up = 40, c2?: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7);
      this.bits.push({ x, y, z: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: up * (0.5 + Math.random()), t: 0, life: life * (0.7 + Math.random() * 0.6), c: c2 && i % 2 ? c2 : c, s: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  private sprite(r: Run, p: Player, time: number) {
    const moving = Math.hypot(p.vx, p.vy) > 12;
    const step = (this.walk[p.i] ?? 0) % 2 < 1;
    if (p.gk) {
      const base = p.side === 0 ? 'keeper' : 'gkeeper';
      return p.dive > 0 ? `${base}-dive` : `${base}-stand`;
    }
    if (p.side === 1) return p.kick > 0 && p.tackleCd > 0.2 ? 'grumble-slide' : moving ? (step ? 'grumble-run1' : 'grumble-run2') : 'grumble-stand';
    if (p.kick > 0 && (p.who === 'dora' || p.who === 'enzo')) return `${p.who}-kick`;
    if (p.who === 'pip' || p.who === 'bram') return moving ? (step ? `${p.who}-run` : `${p.who}-stand`) : `${p.who}-stand`;
    void r; void time;
    return moving ? (step ? `${p.who}-run1` : `${p.who}-run2`) : `${p.who}-stand`;
  }

  render(v: SpaceView) {
    const r = v.run, c = this.ctx, b = r.ball;
    const rdt = Math.max(0, Math.min(0.1, v.time - this.last)); this.last = v.time;
    const gdt = v.dt * (r.slow > 0 ? G.SLOW : 1);
    this.shake = Math.max(0, this.shake - rdt * 16); this.flash = Math.max(0, this.flash - rdt * 2.4); this.switchT = Math.max(0, this.switchT - rdt);
    c.save();
    if (this.shake > 0) c.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    const bg = this.ok(r.pitch);
    if (bg) c.drawImage(bg, 0, 0); else { c.fillStyle = '#3a8a3a'; c.fillRect(0, 0, G.W, G.H); }
    this.lines(c);

    // the landing spot: a gold ring closing on the arrival circle as the ball comes down
    const ps = r.pass, f = r.flight;
    if (ps && r.players[ps.passer].side === 0 && (f || b.owner < 0)) {
      const left = ps.land - r.gt, T = f ? f.T : 1;
      const w = r.P.window * (r.perks.wide ? 1.5 : 1) + (r.perks.carousel ? Math.min(5, r.streak) * 0.05 : 0);
      const open = left <= G.EARLY * w && left >= -G.LATE * w;
      const rad = G.ARRIVE + Math.max(0, left / T) * 22;
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1;
      this.ellipse(c, ps.x, ps.y + 1, G.ARRIVE, G.ARRIVE * 0.6);
      c.strokeStyle = open ? '#ffffff' : 'rgba(255,240,200,0.75)';
      this.ellipse(c, ps.x, ps.y, G.ARRIVE, G.ARRIVE * 0.6);
      if (left > -G.LATE * w) {
        c.strokeStyle = open ? '#fff6a0' : '#f2c14e'; c.lineWidth = open ? 2 : 1;
        this.ellipse(c, ps.x, ps.y, rad, rad * 0.6);
        c.lineWidth = 1;
      }
      // a line from the runner to the spot
      const rr = r.players[ps.receiver];
      if (rr && f) { c.strokeStyle = 'rgba(255,230,120,0.35)'; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(rr.x + 0.5, rr.y + 0.5); c.lineTo(ps.x + 0.5, ps.y + 0.5); c.stroke(); c.setLineDash([]); }
    }
    // the reticle: where a pass would go
    const ret = r.reticle;
    if (ret && r.state === 'play') {
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.setLineDash([1, 3]); c.beginPath();
      if (ret.loft) {
        for (let i = 0; i <= 16; i++) { const t = i / 16, x = b.x + (ret.x - b.x) * t, y = b.y + (ret.y - b.y) * t - Math.min(50, 10 + Math.hypot(ret.x - b.x, ret.y - b.y) * 0.21) * 4 * t * (1 - t); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      } else { c.moveTo(b.x, b.y); c.lineTo(ret.x, ret.y); }
      c.stroke(); c.setLineDash([]);
      c.strokeStyle = ret.loft ? '#9ad8ff' : '#ffffff'; c.lineWidth = 1;
      const x = Math.round(ret.x) + 0.5, y = Math.round(ret.y) + 0.5;
      c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 1.5, y); c.moveTo(x + 1.5, y); c.lineTo(x + 4, y); c.moveTo(x, y - 3); c.lineTo(x, y - 1); c.moveTo(x, y + 1); c.lineTo(x, y + 3); c.stroke();
      const q = r.players[ret.receiver];
      if (q) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 25, 3, 2); }
    }

    // everyone, nearest the top first
    const list = r.players.slice().sort((a, b2) => a.y - b2.y);
    for (const p of list) {
      this.walk[p.i] = (this.walk[p.i] ?? 0) + Math.hypot(p.vx, p.vy) * gdt / 7;
      // shadow
      c.fillStyle = 'rgba(0,0,0,0.28)'; this.blob(c, p.x, p.y, 6, 2);
      if (p.i === r.ctrl) {
        c.strokeStyle = this.switchT > 0 ? '#ffffff' : '#ffe066'; c.lineWidth = 1; this.ellipse(c, p.x, p.y, 8, 3);
      }
      const n = this.sprite(r, p, v.time), im = this.ok(n);
      const flip = p.gk ? p.side === 1 : p.dx < -0.1;
      const dip = p.settle > 0 ? 1 : 0;
      if (im) this.put(c, im, p.x, p.y + 1 + dip, flip, p.stun > 0 && Math.floor(v.time * 12) % 2 ? 0.55 : 1);
      // the controlled player's marker, bouncing just above the head
      if (p.i === r.ctrl) {
        const y = Math.round(p.y - 26 - (this.switchT > 0 ? this.switchT * 10 : Math.abs(Math.sin(v.time * 5)) * 1.5));
        c.fillStyle = '#1a1208'; c.fillRect(Math.round(p.x) - 3, y - 1, 7, 4);
        c.fillStyle = this.switchT > 0 ? '#ffffff' : '#ffe066';
        c.fillRect(Math.round(p.x) - 2, y, 5, 1); c.fillRect(Math.round(p.x) - 1, y + 1, 3, 1); c.fillRect(Math.round(p.x), y + 2, 1, 1);
      }
      // the ball, if it's down at this player's feet
      if (b.owner === p.i) this.ball(c, r);
    }
    if (b.owner < 0) this.ball(c, r);

    // landing dust, sparks and confetti
    for (const p of this.bits) {
      p.t += rdt; p.x += p.vx * rdt; p.y += p.vy * rdt; p.vz -= 260 * rdt; p.z = Math.max(0, p.z + p.vz * rdt); if (p.z === 0) { p.vx *= 0.9; p.vy *= 0.9; }
      c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.s, p.s);
    }
    c.globalAlpha = 1; this.bits = this.bits.filter((p) => p.t < p.life);
    for (const g of this.rings) {
      g.t += rdt; const k = g.t / 0.45; c.globalAlpha = Math.max(0, 1 - k); c.strokeStyle = g.c; this.ellipse(c, g.x, g.y, 6 + k * 18, (6 + k * 18) * 0.6);
    }
    c.globalAlpha = 1; this.rings = this.rings.filter((g) => g.t < 0.45);
    // rain over everything on the wet pitch
    if (r.pitch === 'wet' && !v.reduced) {
      c.strokeStyle = 'rgba(200,225,255,0.45)'; c.beginPath();
      for (const d of this.rain) { d.y += rdt * 220; d.x -= rdt * 40; if (d.y > G.H) { d.y -= G.H; d.x = Math.random() * G.W; } if (d.x < 0) d.x += G.W; c.moveTo(Math.round(d.x) + 0.5, Math.round(d.y)); c.lineTo(Math.round(d.x) - 0.5, Math.round(d.y) + 4); }
      c.stroke();
    }
    // the words that pop up
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of this.pops) {
      p.t += rdt; const life = p.big ? 1.3 : 0.9, k = p.t / life;
      const y = Math.round(p.y - Math.min(1, p.t * 4) * 8);
      c.globalAlpha = k > 0.75 ? Math.max(0, (1 - k) * 4) : 1;
      c.font = `${p.big ? 14 : 9}px "Pixelify Sans", monospace`;
      const x = Math.round(Math.max(30, Math.min(G.W - 30, p.x)));
      c.fillStyle = '#1a1208'; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) c.fillText(p.text, x + ox, y + oy);
      c.fillStyle = p.c; c.fillText(p.text, x, y);
    }
    c.globalAlpha = 1; this.pops = this.pops.filter((p) => p.t < (p.big ? 1.3 : 0.9));
    c.restore();
    // slow motion: a white frame
    if (r.slow > 0) {
      const a = Math.min(1, r.slow / 0.2) * 0.85;
      c.fillStyle = `rgba(255,255,240,${a * 0.5})`; c.fillRect(0, 0, G.W, 3); c.fillRect(0, G.H - 3, G.W, 3); c.fillRect(0, 0, 3, G.H); c.fillRect(G.W - 3, 0, 3, G.H);
      c.fillStyle = `rgba(255,255,240,${a * 0.08})`; c.fillRect(0, 0, G.W, G.H);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`; c.fillRect(0, 0, G.W, G.H); }
  }

  private ball(c: CanvasRenderingContext2D, r: Run) {
    const b = r.ball, im = this.ok('ball');
    // the shadow stays on the grass; it gets smaller and fainter the higher the ball is
    const k = Math.max(0.35, 1 - b.z / 60);
    c.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * k})`; this.blob(c, b.x, b.y + 1, 3.5 * k + 0.5, 1.5 * k + 0.5);
    // a little streak behind a fast or high ball
    const sp = Math.hypot(b.vx, b.vy);
    this.trail.push({ x: b.x, y: b.y - b.z, t: 0 }); if (this.trail.length > 6) this.trail.shift();
    if (sp > 140 || b.z > 6) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < this.trail.length - 1; i++) { const t = this.trail[i]; c.fillRect(Math.round(t.x), Math.round(t.y), 1, 1); }
    }
    const big = b.z > 26 ? 1 : 0;
    if (im) { const s = 6 + big; c.drawImage(im, Math.round(b.x - s / 2), Math.round(b.y - b.z - s + 1), s, s); }
    else { c.fillStyle = '#fff'; c.fillRect(Math.round(b.x) - 2, Math.round(b.y - b.z) - 4, 4, 4); }
  }

  private lines(c: CanvasRenderingContext2D) {
    const { x0, y0, x1, y1 } = G.PITCH, cx = Math.round(G.CX), cy = Math.round(G.CY);
    // the boards round the pitch
    c.fillStyle = 'rgba(20,14,8,0.35)'; c.fillRect(x0 - 3, y0 - 3, x1 - x0 + 6, 2); c.fillRect(x0 - 3, y1 + 1, x1 - x0 + 6, 2);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
    c.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    c.beginPath(); c.moveTo(cx + 0.5, y0); c.lineTo(cx + 0.5, y1); c.stroke();
    this.ellipse(c, cx, cy, 22, 22);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(cx - 1, cy - 1, 2, 2);
    for (const side of [0, 1]) {
      const ex = side ? x1 : x0, dir = side ? -1 : 1;
      c.strokeRect(Math.min(ex, ex + dir * G.BOX.depth) + 0.5, cy - G.BOX.half + 0.5, G.BOX.depth, G.BOX.half * 2);
      c.strokeRect(Math.min(ex, ex + dir * 16) + 0.5, cy - 26 + 0.5, 16, 52);
      c.fillRect(ex + dir * 38 - 1, cy - 1, 2, 2);
    }
    const goal = this.ok('goal');
    if (goal) {
      const gy = Math.round(cy - goal.naturalHeight / 2);
      c.drawImage(goal, x1 - 1, gy);
      c.save(); c.translate(x0 + 1, gy); c.scale(-1, 1); c.drawImage(goal, 0, 0); c.restore();
    }
  }
  private ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    c.beginPath(); c.ellipse(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.stroke();
  }
  private blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
}

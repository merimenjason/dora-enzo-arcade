// Out of Frame: the drawing. The whole world is drawn into an offscreen buffer at 480 by 256, then the screen shows it
// in faded sepia everywhere except inside Enzo's viewfinder, which is drawn again on top in full colour with camera
// corner marks and a blinking record light. Everything is Codex-painted pixel art (public/art/frame/), drawn with
// nearest-neighbour; the page scales the canvas up in whole pixels.
import * as G from './frame-game';
import type { Ev, Run } from './frame-game';

const NAMES = ['dora-walk1', 'dora-walk2', 'dora-stand', 'dora-hurt', 'grumble', 'boulder', 'trap', 'rock', 'arrow', 'lift', 'raft', 'acorn', 'film', 'heart',
  'water-top', 'water', ...G.BIOMES.flatMap((b) => [`${b.id}-top`, `${b.id}-fill`, `${b.id}-crumble`, `${b.id}-spikes`, `bg-${b.id}`])];
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number; g: number };
export type FrameView = { run: Run; time: number; dt: number; reduced: boolean };

export class FrameScene {
  private ctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement; private b: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  private bits: Bit[] = [];
  private shake = 0; private flash = 0; private hurtT = 0; private last = 0;
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = G.W; canvas.height = G.H;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
    this.buf = document.createElement('canvas'); this.buf.width = G.W; this.buf.height = G.H;
    this.b = this.buf.getContext('2d')!; this.b.imageSmoothingEnabled = false;
  }
  load() {
    return Promise.all(NAMES.map((n) => new Promise<void>((res) => {
      const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `/art/frame/${n}.png`; this.img[n] = im;
    })));
  }
  private ok(n: string) { const im = this.img[n]; return im && im.complete && im.naturalWidth > 0 ? im : null; }
  /** a sprite with its bottom middle at (x, y), mirrored if asked */
  private put(c: CanvasRenderingContext2D, n: string, x: number, y: number, flip = false) {
    const im = this.ok(n); if (!im) return;
    const w = im.naturalWidth, h = im.naturalHeight, dx = Math.round(x - w / 2), dy = Math.round(y - h);
    if (!flip) { c.drawImage(im, dx, dy); return; }
    c.save(); c.translate(dx + w, dy); c.scale(-1, 1); c.drawImage(im, 0, 0); c.restore();
  }

  events(run: Run, evs: Ev[], reduced: boolean) {
    const tint = run.biome.id === 'cave' ? '#7a86b8' : run.biome.id === 'temple' ? '#d8a840' : '#c8a070';
    for (const e of evs) {
      switch (e.k) {
        case 'jump': case 'hop': this.burst(e.x, e.y, 3, '#e8dcc0', 30, 0.25); break;
        case 'land': this.burst(e.x, e.y, 5, '#e8dcc0', 40, 0.3); break;
        case 'stomp': this.burst(e.x, e.y + 6, 10, '#8a7a6a', 70, 0.45); break;
        case 'break': this.burst(e.x, e.y, 9, '#9a948a', 90, 0.5, 300); if (!reduced) this.shake = Math.max(this.shake, 2); break;
        case 'crumble': this.burst(e.x, e.y, 8, tint, 60, 0.6, 400); break;
        case 'stick': case 'tink': this.burst(e.x, e.y, 4, '#fff0a0', 60, 0.2); break;
        case 'acorn': this.burst(e.x, e.y, 8, '#f2c14e', 60, 0.4, -40); break;
        case 'film': this.burst(e.x, e.y, 8, '#ff7060', 60, 0.4, -40); break;
        case 'heart': this.burst(e.x, e.y, 10, '#ff5a6a', 60, 0.5, -40); break;
        case 'hurt': this.hurtT = 0.35; if (!reduced) this.shake = Math.max(this.shake, 4); this.burst(e.x, e.y - 8, 6, '#ffffff', 70, 0.3); break;
        case 'fall': this.burst(e.x, Math.min(e.y, G.H - 4), 12, '#9adcf0', 90, 0.5, 300); if (!reduced) this.shake = Math.max(this.shake, 3); break;
        case 'clear': this.flash = 1; break;
      }
    }
  }
  private burst(x: number, y: number, n: number, c: string, sp: number, life: number, g = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.6);
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.4, t: 0, life: life * (0.7 + Math.random() * 0.6), c, s: Math.random() < 0.3 ? 2 : 1, g });
    }
  }

  render(v: FrameView) {
    const r = v.run, c = this.b;
    this.world(c, r, v);
    // particles live in the world, so they freeze outside the frame along with everything else
    for (const p of this.bits) {
      if (r.inFrame(p.x, p.y)) { p.t += v.dt; p.vy += p.g * v.dt; p.x += p.vx * v.dt; p.y += p.vy * v.dt; }
      c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    c.globalAlpha = 1;
    this.bits = this.bits.filter((p) => p.t < p.life && p.y < G.H + 10);

    // the screen: the world in sepia, then the frame in colour
    const x = this.ctx, f = r.frame;
    // the flash and the shake fade in real time, even while the game waits on a lens pick
    const rdt = Math.max(0, Math.min(0.1, v.time - this.last)); this.last = v.time;
    this.shake = Math.max(0, this.shake - rdt * 20);
    const sx = this.shake ? Math.round((Math.random() - 0.5) * this.shake) : 0, sy = this.shake ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    x.save(); x.fillStyle = '#1a120c'; x.fillRect(0, 0, G.W, G.H); x.translate(sx, sy);
    x.drawImage(this.buf, 0, 0);
    x.globalCompositeOperation = 'color'; x.fillStyle = '#9a7650'; x.fillRect(0, 0, G.W, G.H);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = '#a89480'; x.fillRect(0, 0, G.W, G.H);
    x.globalCompositeOperation = 'source-over';
    const fx = Math.round(f.x), fy = Math.round(f.y), fw = Math.round(f.w), fh = Math.round(f.h);
    x.drawImage(this.buf, fx, fy, fw, fh, fx, fy, fw, fh);
    this.viewfinder(x, fx, fy, fw, fh, v.time, r);
    x.restore();
    if (this.flash > 0) { x.fillStyle = `rgba(255,250,235,${this.flash * 0.8})`; x.fillRect(0, 0, G.W, G.H); this.flash = Math.max(0, this.flash - rdt * 2.5); }
    // film running low: the edges pulse red
    if (r.phase === 'play' && r.film < 10 && !v.reduced) { const k = 0.25 + 0.2 * Math.sin(v.time * 8); x.strokeStyle = `rgba(232,72,74,${k})`; x.lineWidth = 4; x.strokeRect(2, 2, G.W - 4, G.H - 4); }
  }

  private viewfinder(x: CanvasRenderingContext2D, fx: number, fy: number, fw: number, fh: number, time: number, r: Run) {
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillRect(fx, fy, fw, 1); x.fillRect(fx, fy + fh - 1, fw, 1); x.fillRect(fx, fy, 1, fh); x.fillRect(fx + fw - 1, fy, 1, fh);
    // corner marks
    x.fillStyle = '#fffaf0'; const L = 9;
    for (const [cx, cy, dx, dy] of [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]]) {
      x.fillRect(dx > 0 ? cx : cx - L, dy > 0 ? cy : cy - 2, L, 2); x.fillRect(dx > 0 ? cx : cx - 2, dy > 0 ? cy : cy - L, 2, L);
    }
    // the middle mark, and the record light
    x.fillRect(fx + fw / 2 - 3, fy + fh / 2, 7, 1); x.fillRect(fx + fw / 2, fy + fh / 2 - 3, 1, 7);
    if (Math.floor(time * 2) % 2 === 0 && r.phase === 'play') { x.fillStyle = '#ff4040'; x.fillRect(fx + fw - 9, fy + 5, 4, 4); }
  }

  private world(c: CanvasRenderingContext2D, r: Run, v: FrameView) {
    const biome = r.biome.id;
    const bg = this.ok(`bg-${biome}`);
    if (bg) c.drawImage(bg, 0, 0); else { c.fillStyle = '#3a3040'; c.fillRect(0, 0, G.W, G.H); }
    // the backdrop sits back behind the ground Dora walks on
    c.fillStyle = 'rgba(20,12,8,0.32)'; c.fillRect(0, 0, G.W, G.H);
    // tiles
    const top = this.ok(`${biome}-top`), fill = this.ok(`${biome}-fill`), crum = this.ok(`${biome}-crumble`), spk = this.ok(`${biome}-spikes`);
    const wt = this.ok('water-top'), wf = this.ok('water');
    for (let row = 0; row < G.ROWS; row++) for (let col = 0; col < G.COLS; col++) {
      const t = r.tile(col, row), x = col * 16, y = row * 16;
      if (t === '#') { const above = r.tile(col, row - 1); const im = above === '#' || above === 'A' || above === 'a' ? fill : top; if (im) c.drawImage(im, x, y); }
      else if (t === 'A' || t === 'a') { if (fill) c.drawImage(fill, x, y); }
      else if (t === '=') {
        const i = row * G.COLS + col, left = r.crumble[i];
        const jig = left !== undefined && r.inFrame(x + 8, y + 8) ? Math.round(Math.sin(v.time * 60 + col) * (1 - left / 0.4) * 1.5) : 0;
        if (crum) c.drawImage(crum, x + jig, y);
      }
      else if (t === '^') { if (spk) c.drawImage(spk, x, y); }
      else if (t === '~') {
        const im = r.tile(col, row - 1) === '~' ? wf : wt;
        if (im) { c.globalAlpha = 0.92; c.drawImage(im, x, y); c.globalAlpha = 1; }
      }
    }
    // things
    for (const e of r.ents) {
      const bob = r.inFrame(e.x + e.w / 2, e.y + e.h / 2) ? Math.round(Math.sin(v.time * 4 + e.id) * 1.5) : 0;
      switch (e.k) {
        case 'trap': this.put(c, 'trap', e.x + 8, e.y + 16, e.dir < 0); break;
        case 'chute': {
          // a hole in the rock that boulders drop from
          if (fill) c.drawImage(fill, e.x, e.y);
          c.fillStyle = '#120c08'; c.fillRect(e.x + 3, e.y + 9, 10, 7); c.fillRect(e.x + 4, e.y + 8, 8, 1);
          break;
        }
        case 'grumble': this.put(c, 'grumble', e.x + e.w / 2, e.y + e.h, e.dir > 0); break;
        case 'boulder': {
          const im = this.ok('boulder'); if (!im) break;
          c.save(); c.translate(Math.round(e.x + 7), Math.round(e.y + 7)); c.rotate(e.s === 'rest' ? 0 : (e.x / 7) % (Math.PI * 2)); c.drawImage(im, -7, -8); c.restore();
          break;
        }
        case 'arrow': this.put(c, 'arrow', e.x + 7, e.y + 4, e.dir < 0); break;
        case 'rock': {
          const sh = e.s === 'shake' && e.live ? Math.round(Math.sin(v.time * 70)) : 0;
          if (e.s === 'hang') { c.fillStyle = '#4a3e36'; c.fillRect(e.x + 3, e.y - 2, 6, 2); }
          this.put(c, 'rock', e.x + 6 + sh, e.y + 16);
          break;
        }
        case 'plat': this.put(c, 'raft', e.x + 16, e.y + 8); break;
        case 'lift': {
          const im = this.ok('lift'); if (!im) break;
          const ly = Math.round(e.y + 6 - im.naturalHeight + 1);
          // the ropes go on up out of the top of the screen
          for (let y = ly - 8; y > -8; y -= 8) c.drawImage(im, 0, 0, im.naturalWidth, 8, Math.round(e.x), y, im.naturalWidth, 8);
          c.drawImage(im, Math.round(e.x), ly);
          break;
        }
        case 'acorn': this.put(c, 'acorn', e.x + 5, e.y + 11 + bob); break;
        case 'film': this.put(c, 'film', e.x + 5, e.y + 10 + bob); break;
        case 'heart': this.put(c, 'heart', e.x + 5, e.y + 10 + bob); break;
      }
    }
    // Dora
    const d = r.dora;
    this.hurtT = Math.max(0, this.hurtT - v.dt);
    const blink = d.live && d.inv > 0 && Math.floor(v.time * 12) % 2 === 0;
    if (!blink) {
      const pose = this.hurtT > 0 || d.hurt > 0 ? 'dora-hurt' : !d.ground ? 'dora-walk2' : d.vx === 0 && d.live ? 'dora-stand' : Math.floor(d.walk / 9) % 2 ? 'dora-walk2' : 'dora-walk1';
      this.put(c, pose, d.x, d.y + 1);
    }
    // frozen out of the picture: a dashed outline so she's easy to find
    if (!d.live && r.phase === 'play') {
      c.fillStyle = Math.floor(v.time * 3) % 2 ? '#fffaf0' : '#f2c14e';
      const x0 = Math.round(d.x - 9), y0 = Math.round(d.y - 24);
      for (let i = 0; i < 18; i += 4) { c.fillRect(x0 + i, y0, 2, 1); c.fillRect(x0 + i, y0 + 25, 2, 1); }
      for (let i = 0; i < 25; i += 4) { c.fillRect(x0, y0 + i, 1, 2); c.fillRect(x0 + 18, y0 + i, 1, 2); }
    }
  }
}

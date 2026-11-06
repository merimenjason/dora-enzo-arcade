// Pixel Smith: the drawing. One of three Codex-painted rooms at 384 by 216, then everything sorted by how far down
// the floor it stands: loose pixels of paint, critters (flashing white when hit, blue when chilled, flickering when
// burning), the Smudge's rub marked on the floor before it lands, ice, and Dora with the weapon exactly as Enzo drew
// it, two game pixels to a weapon pixel, swinging round her paw. Dora's fur is her health, so as she loses it pixels go
// missing from her sprite. The page scales the canvas up with nearest-neighbour.
import * as G from './smith-game';
import type { Cells, Ev, Paint, Run } from './smith-game';

const SPRITES = ['dora-stand', 'dora-run1', 'dora-run2', 'dora-hurt', 'pebble', 'glint', 'frost', 'ember', 'moss', 'smudge', 'ice', 'mine', 'cellar', 'forge'];
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number; g: number };
type Pop = { x: number; y: number; t: number; text: string; c: string };
export type SmithView = { run: Run; time: number; dt: number; reduced: boolean };
const HEX: Record<Paint | 'wood', string> = { ...Object.fromEntries(G.PAINTS.map((p) => [p, G.PAINT[p].hex])) as Record<Paint, string>, wood: '#9a6a3a' };
const DARK: Record<Paint | 'wood', string> = { grey: '#4a4e5a', gold: '#a8742a', blue: '#2a6aa8', red: '#8a2420', green: '#2a7a34', wood: '#5a3a1e' };

/** the weapon as a little picture at two pixels a cell (26 by 26): a one-pixel dark outline round the whole shape,
 *  then each painted cell and the handle with a darker corner, so the pixels read as pixels */
export const PIC = 2;
export function weaponPicture(cells: Cells) {
  const k = PIC, c = document.createElement('canvas'); c.width = c.height = G.GRID * k + 2;
  const x = c.getContext('2d')!;
  const at = (i: number) => ({ cx: (i % G.GRID) * k + 1, cy: Math.floor(i / G.GRID) * k + 1 });
  x.fillStyle = '#1a120c';
  for (let i = 0; i < G.GRID * G.GRID; i++) if (i === G.GRIP || cells[i]) { const { cx, cy } = at(i); x.fillRect(cx - 1, cy - 1, k + 2, k + 2); }
  for (let i = 0; i < G.GRID * G.GRID; i++) {
    const p = i === G.GRIP ? 'wood' : cells[i]; if (!p) continue;
    const { cx, cy } = at(i);
    x.fillStyle = HEX[p]; x.fillRect(cx, cy, k, k);
    x.fillStyle = DARK[p]; x.fillRect(cx + k - 1, cy + k - 1, 1, 1);
  }
  return c;
}
/** draws the weapon with its handle at (hx, hy), its diagonal pointing at angle a */
export function drawWeapon(c: CanvasRenderingContext2D, pic: HTMLCanvasElement, hx: number, hy: number, a: number) {
  c.save(); c.translate(hx, hy); c.rotate(a + Math.PI / 4); c.scale(G.CELL / PIC, G.CELL / PIC);
  c.drawImage(pic, -1, -G.GRID * PIC - 1); c.restore();
}

export class SmithScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  /** each sprite again in solid white and solid ice blue, for hit flashes and chills */
  private tint: Record<string, HTMLCanvasElement> = {};
  /** Dora's sprites, and the order her pixels go missing in */
  private holes: Record<string, number[]> = {};
  private tmp: HTMLCanvasElement; private t: CanvasRenderingContext2D;
  private bits: Bit[] = [];
  private pops: Pop[] = [];
  private weapon: HTMLCanvasElement | null = null; private weaponKey = '';
  private trail: { a: number; t: number }[] = [];
  private shake = 0; private flash = 0; private hurtT = 0; private last = 0;
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = G.W; canvas.height = G.H;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
    this.tmp = document.createElement('canvas'); this.tmp.width = 48; this.tmp.height = 48;
    this.t = this.tmp.getContext('2d', { willReadFrequently: true })!;
  }
  load() {
    return Promise.all(SPRITES.map((n) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => { this.prep(n, im); res(); }; im.onerror = () => res();
      im.src = `/art/smith/${n}.png`; this.img[n] = im;
    })));
  }
  private prep(n: string, im: HTMLImageElement) {
    for (const [k, col] of [['white', '#ffffff'], ['ice', '#9adcff']] as const) {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d')!; x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      this.tint[`${n}:${k}`] = c;
    }
    if (n.startsWith('dora')) {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, list: number[] = [];
      for (let i = 0; i < c.width * c.height; i++) if (d[i * 4 + 3] > 0) list.push(i);
      // the same order every time, so the same pixels go first
      let s = 12345; for (let i = list.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
      this.holes[n] = list;
    }
  }
  private ok(n: string) { const im = this.img[n]; return im && im.complete && im.naturalWidth > 0 ? im : null; }
  /** a sprite with its bottom middle at (x, y), mirrored if asked */
  private put(c: CanvasRenderingContext2D, im: CanvasImageSource & { width: number; height: number }, x: number, y: number, flip = false, alpha = 1) {
    const w = im.width, h = im.height, dx = Math.round(x - w / 2), dy = Math.round(y - h);
    c.globalAlpha = alpha;
    if (!flip) c.drawImage(im, dx, dy);
    else { c.save(); c.translate(dx + w, dy); c.scale(-1, 1); c.drawImage(im, 0, 0); c.restore(); }
    c.globalAlpha = 1;
  }

  events(run: Run, evs: Ev[], reduced: boolean) {
    for (const e of evs) {
      switch (e.k) {
        case 'hit': {
          this.burst(e.x, e.y, Math.min(10, 3 + e.n), HEX[e.c], 70, 0.3, 120);
          if (!reduced) this.shake = Math.max(this.shake, Math.min(2.5, 0.6 + e.n * 0.15));
          break;
        }
        case 'kill': this.burst(e.x, e.y - 6, e.foe === 'smudge' ? 50 : 12, HEX[G.FOES[e.foe].drop], e.foe === 'smudge' ? 140 : 90, 0.5, 160); if (e.foe === 'smudge') { this.flash = 1; if (!reduced) this.shake = 6; } break;
        case 'hurt': {
          this.hurtT = 0.3; if (!reduced) this.shake = Math.max(this.shake, 3);
          // tufts of Dora's fur
          this.burst(e.x, e.y - 12, 7, '#f4e6cc', 70, 0.5, 200);
          break;
        }
        case 'chip': this.burst(e.x, e.y, 4, HEX[e.c], 50, 0.3, 200); break;
        case 'block': this.burst(e.x, e.y, 6, '#d8f4ff', 60, 0.3, 100); break;
        case 'roll': this.burst(e.x, e.y, 5, '#c8b49a', 30, 0.35, 0); break;
        case 'spawn': this.burst(e.x, e.y, 10, '#6a5a4a', 40, 0.6, -20); break;
        case 'rub': this.burst(e.x, e.y, 16, '#f49ac0', 90, 0.5, 120); if (!reduced) this.shake = Math.max(this.shake, 4); break;
        case 'heal': this.pops.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 26, t: 0, text: '+', c: '#7ae07a' }); break;
        case 'freeze': this.burst(e.x, e.y - 6, 6, '#d8f4ff', 40, 0.5, -10); break;
        case 'burnt': this.burst(e.x, e.y - 8, 4, '#ffb050', 30, 0.4, -60); break;
        case 'swing': this.trail = []; break;
        case 'clear': this.flash = Math.max(this.flash, 0.6); break;
      }
    }
    void run;
  }
  private burst(x: number, y: number, n: number, c: string, sp: number, life: number, g = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7);
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, t: 0, life: life * (0.7 + Math.random() * 0.6), c, s: Math.random() < 0.4 ? 2 : 1, g });
    }
  }

  render(v: SmithView) {
    const r = v.run, c = this.ctx;
    const rdt = Math.max(0, Math.min(0.1, v.time - this.last)); this.last = v.time;
    this.shake = Math.max(0, this.shake - rdt * 18); this.flash = Math.max(0, this.flash - rdt * 2.5); this.hurtT = Math.max(0, this.hurtT - rdt);
    c.save();
    if (this.shake > 0) c.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    const bg = this.ok(r.floor.id);
    if (bg) c.drawImage(bg, 0, 0); else { c.fillStyle = '#2a2420'; c.fillRect(0, 0, G.W, G.H); }

    // the Smudge's rub, marked on the floor before it lands
    for (const f of r.foes) if (f.k === 'smudge' && (f.mode === 'wind' || f.mode === 'rub')) {
      const cx = f.x + f.dx * 26, cy = f.y + f.dy * 26 - 6, p = f.mode === 'wind' ? 1 - f.t / 0.7 : 1;
      c.fillStyle = `rgba(244,120,170,${f.mode === 'rub' ? 0.45 : 0.12 + p * 0.2})`; this.blob(c, cx, cy + 6, 24, 14);
      c.strokeStyle = '#f478aa'; c.lineWidth = 1; c.setLineDash([3, 2]); c.beginPath(); c.ellipse(Math.round(cx) + 0.5, Math.round(cy + 6) + 0.5, 24, 14, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    // loose pixels of paint, bobbing
    for (const p of r.loose) {
      const bob = Math.round(Math.sin(v.time * 6 + p.x) * 1), x = Math.round(p.x), y = Math.round(p.y) + bob;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x - 1, Math.round(p.y) + 2, 3, 1);
      c.fillStyle = DARK[p.c]; c.fillRect(x - 1, y - 1, 3, 3); c.fillStyle = HEX[p.c]; c.fillRect(x - 1, y - 1, 2, 2);
    }
    // everything that stands on the floor, back to front
    const things: { y: number; draw: () => void }[] = [];
    for (const f of r.foes) things.push({ y: f.y, draw: () => this.foe(c, f, v) });
    things.push({ y: r.dora.y, draw: () => this.dora(c, r, v) });
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();
    for (const s of r.shots) { const im = this.ok('ice'); if (im) c.drawImage(im, Math.round(s.x - im.width / 2), Math.round(s.y - im.height / 2)); else { c.fillStyle = '#9adcff'; c.fillRect(s.x - 2, s.y - 2, 4, 4); } }

    // sparks and pixels flying
    for (const p of this.bits) {
      p.t += rdt; p.vy += p.g * rdt; p.x += p.vx * rdt; p.y += p.vy * rdt;
      c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    c.globalAlpha = 1;
    this.bits = this.bits.filter((p) => p.t < p.life);
    c.font = '8px "Pixelify Sans", monospace'; c.textAlign = 'center';
    for (const p of this.pops) {
      p.t += rdt; const y = Math.round(p.y - p.t * 18);
      c.globalAlpha = Math.max(0, 1 - p.t / 0.8); c.fillStyle = '#120c08'; c.fillText(p.text, Math.round(p.x) + 1, y + 1); c.fillStyle = p.c; c.fillText(p.text, Math.round(p.x), y);
    }
    c.globalAlpha = 1;
    this.pops = this.pops.filter((p) => p.t < 0.8);
    c.restore();
    if (this.hurtT > 0) { c.fillStyle = `rgba(232,72,74,${this.hurtT * 0.6})`; c.fillRect(0, 0, G.W, 3); c.fillRect(0, G.H - 3, G.W, 3); c.fillRect(0, 0, 3, G.H); c.fillRect(G.W - 3, 0, 3, G.H); }
    if (this.flash > 0) { c.fillStyle = `rgba(255,248,230,${this.flash * 0.5})`; c.fillRect(0, 0, G.W, G.H); }
  }
  private blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) { c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); c.fill(); }

  private foe(c: CanvasRenderingContext2D, f: G.Foe, v: SmithView) {
    const im = this.ok(f.k); const big = f.k === 'smudge';
    c.fillStyle = 'rgba(0,0,0,0.28)'; this.blob(c, f.x, f.y, f.r * (big ? 1.2 : 0.9), big ? 5 : 2.5);
    if (!im) { c.fillStyle = HEX[G.FOES[f.k].drop]; this.blob(c, f.x, f.y - f.r, f.r, f.r); return; }
    const flip = v.run.dora.x < f.x;
    let y = f.y + 1, alpha = 1;
    if (f.mode === 'spawn') { alpha = Math.max(0.15, 1 - f.t / 0.9); y += Math.round(f.t * 8); }
    if (f.mode === 'wind' && f.k === 'glint') y -= Math.round(Math.abs(Math.sin(v.time * 40)) * 2);
    if (f.mode === 'walk' || f.mode === 'dash') y -= Math.round(Math.abs(Math.sin(v.time * 10 + f.id)) * 1.5);
    this.put(c, im, f.x, y, flip, alpha);
    if (f.chill >= G.FROZEN && !big) this.put(c, this.tint[`${f.k}:ice`], f.x, y, flip, 0.65);
    else if (f.chill > 0) this.put(c, this.tint[`${f.k}:ice`], f.x, y, flip, 0.3);
    if (f.flash > 0) this.put(c, this.tint[`${f.k}:white`], f.x, y, flip, 0.85);
    if (f.burn > 0 && Math.random() < 0.5) this.bits.push({ x: f.x + (Math.random() - 0.5) * f.r * 1.6, y: f.y - Math.random() * f.r * 1.6, vx: 0, vy: -20, t: 0, life: 0.35, c: Math.random() < 0.5 ? '#ffb050' : '#e8503a', s: 1, g: -40 });
    if (f.mode === 'wind' && f.k === 'glint' && Math.random() < 0.5) this.bits.push({ x: f.x + (Math.random() - 0.5) * 12, y: f.y - 8 - Math.random() * 10, vx: 0, vy: 0, t: 0, life: 0.2, c: '#fff8c0', s: 1, g: 0 });
    // a little health bar once it's been hit (the Smudge's is in the page)
    if (!big && f.hp < f.max && f.mode !== 'spawn') {
      const w = 12, x = Math.round(f.x - w / 2), yy = Math.round(f.y - f.r * 2 - 6);
      c.fillStyle = '#120c08'; c.fillRect(x - 1, yy - 1, w + 2, 4); c.fillStyle = '#5a2020'; c.fillRect(x, yy, w, 2);
      c.fillStyle = '#7ae07a'; c.fillRect(x, yy, Math.max(1, Math.round(w * f.hp / f.max)), 2);
    }
  }

  private dora(c: CanvasRenderingContext2D, r: Run, v: SmithView) {
    const d = r.dora, moving = Math.hypot(d.vx, d.vy) > 5;
    const pose = d.inv > 0.55 && r.phase === 'fight' ? 'dora-hurt' : moving ? (Math.floor(v.time * 8) % 2 ? 'dora-run1' : 'dora-run2') : 'dora-stand';
    const im = this.ok(pose);
    const aimLeft = Math.cos(r.aim) < 0, flip = aimLeft;
    c.fillStyle = 'rgba(0,0,0,0.3)'; this.blob(c, d.x, d.y, 7, 2.5);
    // the weapon is behind her when it points up, in front of her otherwise
    const w = r.cellsNow(), behind = Math.sin(w.angle) < -0.3;
    if (behind) this.drawWeapon(c, r, w);
    if (im) {
      // Dora's fur is her health: pixels go missing as she loses it, up to about half of her
      const holes = this.holes[pose] ?? [], gone = Math.floor(holes.length * 0.55 * (1 - d.fur / r.furMax));
      const t = this.t, iw = im.naturalWidth;
      t.clearRect(0, 0, 48, 48); t.drawImage(im, 0, 0);
      for (let i = 0; i < gone; i++) { const p = holes[i]; t.clearRect(p % iw, Math.floor(p / iw), 1, 1); }
      const blink = d.inv > 0 && r.phase === 'fight' && Math.floor(v.time * 20) % 2 === 0;
      const rolling = d.roll > 0;
      const y = d.y + 1;
      if (rolling) {
        c.save(); c.translate(Math.round(d.x), Math.round(y - 9)); c.rotate((0.26 - d.roll) / 0.26 * Math.PI * 2 * (d.rx < 0 ? -1 : 1));
        c.drawImage(this.tmp, 0, 0, iw, im.naturalHeight, -Math.round(iw / 2), -Math.round(im.naturalHeight / 2), iw, im.naturalHeight); c.restore();
      } else {
        c.globalAlpha = blink ? 0.45 : 1;
        if (flip) { c.save(); c.translate(Math.round(d.x + iw / 2), Math.round(y - im.naturalHeight)); c.scale(-1, 1); c.drawImage(this.tmp, 0, 0, iw, im.naturalHeight, 0, 0, iw, im.naturalHeight); c.restore(); }
        else c.drawImage(this.tmp, 0, 0, iw, im.naturalHeight, Math.round(d.x - iw / 2), Math.round(y - im.naturalHeight), iw, im.naturalHeight);
        c.globalAlpha = 1;
      }
    }
    if (!behind) this.drawWeapon(c, r, w);
  }

  private drawWeapon(c: CanvasRenderingContext2D, r: Run, w: ReturnType<Run['cellsNow']>) {
    const key = G.cellsCode(r.cells);
    if (key !== this.weaponKey || !this.weapon) { this.weapon = weaponPicture(r.cells); this.weaponKey = key; }
    const pic = this.weapon, draw = (a: number, alpha: number) => {
      const hx = r.dora.x + Math.cos(a) * 4, hy = r.dora.y - 6 + Math.sin(a) * 4;
      c.globalAlpha = alpha; drawWeapon(c, pic, hx, hy, a); c.globalAlpha = 1;
    };
    // a smear of the last few angles while swinging
    if (r.swinging) {
      this.trail.push({ a: w.angle, t: 0 });
      if (this.trail.length > 4) this.trail.shift();
      this.trail.forEach((p, i) => { if (i < this.trail.length - 1) draw(p.a, 0.12 + i * 0.08); });
    } else this.trail = [];
    draw(w.angle, 1);
  }
}

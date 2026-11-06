// Coin of the Realm: the drawing. A 384 by 216 painted market town with eleven townsfolk standing in front of their
// cottages and stalls, joined by dirt streets. The coin floats over the paw that holds it, showing Dora's face or
// Enzo's. Whoever it can be spent on next glows gold; a red ring warns that a thief would snatch it there. Moods Enzo
// has overheard sit in little bubbles above heads (never over faces), and a seller's goods badge sits by their feet.
// Each hand-over plays out: the coin arcs over the roofs, the town's thieves creep along the streets, and planks pop up.
// Codex-painted pixel art from public/art/coin/, drawn with nearest-neighbour.
import * as G from './coin-game';
import type { Ev, Face, Mood, Town } from './coin-game';

export const SW = 384, SH = 216;
const KINDS = Object.keys(G.FOLK) as G.Kind[];
const NAMES = ['town1', 'town2', 'town3', 'town4', 'grumble', 'gull', 'magpie', 'coin-dora', 'coin-enzo', 'cottage', 'stall', 'sock', 'planks', ...KINDS, ...G.GOODS];
export type Snap = { holder: number; face: Face; thieves: number[]; known: boolean[]; moods: Mood[]; paid: number[] };
export type View = { targets: number[]; danger: number[]; hover: number; path: number[]; reduced: boolean };
type Pop = { x: number; y: number; text: string; c: string; t: number };
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string };
type Step = { ev: Ev; t: number; len: number };

export class CoinScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  private town: Town | null = null;
  private shown: Snap | null = null;
  private queue: Step[] = []; private end: Snap | null = null; private done: (() => void) | null = null;
  private onEv: ((e: Ev) => void) | null = null;
  private pops: Pop[] = []; private bits: Bit[] = []; private dusk = 0; private shake = 0;
  speed = 1;
  constructor(canvas: HTMLCanvasElement) {
    canvas.width = SW; canvas.height = SH;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
  }
  load() {
    return Promise.all(NAMES.map((n) => new Promise<void>((res) => {
      const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `/art/coin/${n}.png`; this.img[n] = im;
    })));
  }
  private ok(n: string) { const im = this.img[n]; return im && im.complete && im.naturalWidth > 0 ? im : null; }
  /** draw a sprite with its feet at (x, y) */
  private put(n: string, x: number, y: number, alpha = 1, scale = 1) {
    const im = this.ok(n); if (!im) return;
    const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
    this.ctx.globalAlpha = alpha; this.ctx.drawImage(im, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h)); this.ctx.globalAlpha = 1;
  }
  setTown(t: Town, s: Snap) { this.town = t; this.shown = structuredClone(s); this.queue = []; this.pops = []; this.end = null; this.done = null; }
  sync(s: Snap) { if (!this.queue.length) this.shown = structuredClone(s); }
  get playing() { return this.queue.length > 0; }
  /** play what a hand-over did, then settle on the run as it now is */
  play(evs: Ev[], end: Snap, done: () => void, onEv?: (e: Ev) => void) {
    const len: Partial<Record<Ev['k'], number>> = { pass: 0.5, wait: 0.35, thief: 0.28, snatch: 0.8, dusk: 0.9, dawn: 0.5, order: 0.35, grumpy: 0.3, miser: 0.5, bridge: 0.9, flip: 0.3 };
    this.queue = evs.map((ev) => ({ ev, t: 0, len: len[ev.k] ?? 0 }));
    this.end = structuredClone(end); this.done = done; this.onEv = onEv ?? null;
    if (this.queue.length) this.begin(this.queue[0]); else this.finish();
  }
  skip() { while (this.queue.length) this.advance(); }
  /** the townsfolk nearest a point on the canvas, if it's close enough to be meant */
  folkAt(x: number, y: number): number {
    if (!this.town) return -1;
    let best = -1, bd = 34 * 34;
    for (const f of this.town.folk) { const d = (f.x - x) ** 2 + (f.y - 8 - y) ** 2; if (d < bd) { bd = d; best = f.id; } }
    return best;
  }
  where(id: number) { const f = this.town?.folk[id]; return f ? { x: f.x, y: f.y } : { x: 0, y: 0 }; }
  celebrate() { for (let i = 0; i < 40; i++) this.burst(SW / 2, SH - 20, ['#f2c14e', '#ff7a8a', '#8ad0ff', '#fff'][i % 4], 140, 1.3); }

  private burst(x: number, y: number, c: string, sp: number, life: number, n = 1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7); this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.4, t: 0, life: life * (0.6 + Math.random() * 0.6), c }); }
  }
  private pop(at: number, text: string, c: string) { const f = this.town!.folk[at]; this.pops.push({ x: f.x, y: f.y - 40, text, c, t: 0 }); }
  /** an event starts showing */
  private begin(s: Step) {
    const e = s.ev, sh = this.shown!;
    this.onEv?.(e);
    switch (e.k) {
      case 'order': this.pop(e.at, `+${e.planks} plank${e.planks > 1 ? 's' : ''}`, '#ffe27a'); this.burst(this.where(e.at).x, this.where(e.at).y - 20, '#f2c14e', 70, 0.6, 14); sh.known[e.at] = true; break;
      case 'grumpy': this.pop(e.at, 'Not today!', '#ff9a8a'); sh.known[e.at] = true; break;
      case 'mayor': this.pop(e.at, 'New order!', '#bfe8ff'); break;
      case 'miser': this.pop(e.at, '+1 plank', '#ffe27a'); break;
      case 'gossip': sh.known = sh.known.map(() => true); this.pop(e.at, 'Psst!', '#ffffff'); break;
      case 'hear': for (const i of e.ids) sh.known[i] = true; break;
      case 'pedlar': this.pop(e.at, 'Anywhere!', '#ffcf8a'); break;
      case 'juggler': this.pop(e.at, 'Both ways up!', '#ffcf8a'); break;
      case 'snatch': this.shake = 0.4; this.pop(e.at, 'Snatched!', '#ff7a7a'); break;
      case 'dusk': this.dusk = 1; break;
      case 'bridge': this.celebrate(); break;
      case 'flip': sh.face = e.face; break;
    }
  }
  /** an event finishes */
  private settle(e: Ev) {
    const sh = this.shown!;
    if (e.k === 'pass') { sh.holder = e.to; sh.face = e.face; sh.paid[e.to]++; }
    if (e.k === 'wait') sh.face = e.face;
    if (e.k === 'thief') sh.thieves[e.i] = e.to;
    if (e.k === 'dawn' && this.end) { this.shown = structuredClone(this.end); }
  }
  private advance() {
    const s = this.queue.shift(); if (!s) return;
    if (s.t === 0 && s.len === 0) { /* already begun */ }
    this.settle(s.ev);
    if (this.queue.length) this.begin(this.queue[0]); else this.finish();
  }
  private finish() {
    if (this.end) this.shown = structuredClone(this.end);
    this.end = null; const d = this.done; this.done = null; d?.();
  }

  render(v: View, time: number, dt: number) {
    const c = this.ctx, t = this.town, sh = this.shown;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a2018'; c.fillRect(0, 0, SW, SH);
    if (!t || !sh) return;
    // the hand-over in progress
    const cur = this.queue[0];
    if (cur) { cur.t += (dt * this.speed) / Math.max(0.001, cur.len); if (cur.t >= 1) this.advance(); }
    if (this.shake > 0) { this.shake -= dt; c.setTransform(1, 0, 0, 1, Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 3)); }
    const bg = this.ok(`town${t.ix + 1}`);
    if (bg) c.drawImage(bg, 0, 0, SW, SH);
    // streets
    const path = new Set<string>();
    for (let i = 0; i + 1 < v.path.length; i++) path.add([v.path[i], v.path[i + 1]].sort((a, b) => a - b).join('-'));
    for (const [a, b] of t.streets) {
      const A = t.folk[a], B = t.folk[b];
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(60,38,20,0.75)'; c.lineWidth = 7; c.beginPath(); c.moveTo(A.x, A.y + 4); c.lineTo(B.x, B.y + 4); c.stroke();
      c.strokeStyle = '#d8b884'; c.lineWidth = 5; c.beginPath(); c.moveTo(A.x, A.y + 4); c.lineTo(B.x, B.y + 4); c.stroke();
      if (path.has([a, b].sort((x, y) => x - y).join('-'))) {
        c.strokeStyle = '#ffe27a'; c.lineWidth = 2; c.setLineDash([3, 3]); c.lineDashOffset = -time * 20;
        c.beginPath(); c.moveTo(A.x, A.y + 4); c.lineTo(B.x, B.y + 4); c.stroke(); c.setLineDash([]);
      }
    }
    // plots, rings for where the coin can go
    const playing = this.queue.length > 0;
    for (const f of t.folk) {
      c.fillStyle = 'rgba(40,26,14,0.45)'; c.beginPath(); c.ellipse(f.x, f.y + 10, 15, 5, 0, 0, Math.PI * 2); c.fill();
      if (playing) continue;
      const target = v.targets.includes(f.id), danger = v.danger.includes(f.id);
      if (target) {
        const p = v.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(time * 5);
        c.strokeStyle = danger ? `rgba(255,90,80,${0.6 + p * 0.4})` : `rgba(255,226,122,${0.55 + p * 0.45})`; c.lineWidth = f.id === v.hover ? 3 : 2;
        c.beginPath(); c.ellipse(f.x, f.y + 10, 17, 6.5, 0, 0, Math.PI * 2); c.stroke();
      }
    }
    // houses then folk, back row first
    const order = [...t.folk].sort((a, b) => a.y - b.y);
    for (const f of order) this.put(G.isTrade(f.kind) ? 'stall' : 'cottage', f.x + (f.slot % 2 ? 9 : -9), f.y - 6);
    for (const f of order) {
      const bob = !v.reduced && f.id === v.hover && !playing ? Math.round(Math.sin(time * 10)) : 0;
      this.put(f.kind, f.x, f.y + 12 + bob);
      // goods badge by the feet, a tally of today's visits on the other side
      if (G.isTrade(f.kind)) {
        const g = G.SELLS[f.kind];
        c.fillStyle = 'rgba(255,248,230,0.92)'; c.fillRect(f.x + 8, f.y + 2, 12, 12); c.strokeStyle = '#5a3a1a'; c.lineWidth = 1; c.strokeRect(f.x + 8.5, f.y + 2.5, 11, 11);
        this.put(g, f.x + 14, f.y + 13);
      }
      const n = Math.min(4, sh.paid[f.id]);
      for (let i = 0; i < n; i++) { c.fillStyle = '#5a3a1a'; c.fillRect(f.x - 19, f.y + 11 - i * 4, 4, 3); c.fillStyle = '#f2c14e'; c.fillRect(f.x - 18, f.y + 11 - i * 4, 2, 2); }
      // the mood bubble, above the head
      if (G.isTrade(f.kind)) this.bubble(f.x, f.y - 26, sh.known[f.id] ? sh.moods[f.id] : null);
    }
    // the town's thieves: gulls, magpies or Grumbles
    for (let i = 0; i < sh.thieves.length; i++) {
      let at = this.where(sh.thieves[i]);
      if (cur && cur.ev.k === 'thief' && cur.ev.i === i) { const a = this.where(cur.ev.from), b = this.where(cur.ev.to), k = Math.min(1, cur.t); at = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 4 }; }
      this.put(t.thief, at.x + 14, at.y + 14 + (v.reduced ? 0 : Math.round(Math.sin(time * 6 + i) * 1)));
    }
    // the coin
    let cx = this.where(sh.holder).x, cy = this.where(sh.holder).y - 34, face = sh.face, spin = 1;
    if (cur && cur.ev.k === 'pass') {
      const a = this.where(cur.ev.from), b = this.where(cur.ev.to), k = Math.min(1, cur.t), e = k * k * (3 - 2 * k);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      cx = a.x + (b.x - a.x) * e; cy = a.y - 34 + (b.y - a.y) * e - Math.sin(e * Math.PI) * (16 + d * 0.15);
      spin = Math.cos(k * Math.PI * 4); face = (spin < 0) !== (cur.ev.face === 'dora') ? 'dora' : 'enzo';
      if (cur.ev.face === 'both') face = k > 0.5 ? 'dora' : 'enzo';
    } else if (cur && (cur.ev.k === 'wait' || cur.ev.k === 'flip')) { spin = Math.cos(Math.min(1, cur.t) * Math.PI * 2); }
    const snatched = cur && cur.ev.k === 'snatch';
    if (!snatched) {
      const bob = v.reduced ? 0 : Math.sin(time * 3) * 1.5;
      const im = this.ok(face === 'enzo' ? 'coin-enzo' : 'coin-dora');
      if (face === 'both' && !cur && !v.reduced) spin = Math.cos(time * 6);
      if (im) {
        const w = 18 * Math.max(0.12, Math.abs(spin)), sx = face === 'both' && spin < 0 ? 'coin-enzo' : null;
        c.drawImage(sx ? this.ok(sx)! : im, Math.round(cx - w / 2), Math.round(cy - 9 + bob), Math.max(2, Math.round(w)), 18);
      } else { c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(cx, cy + bob, 8, 0, Math.PI * 2); c.fill(); }
      if (!cur && !v.reduced && Math.random() < dt * 6) this.bits.push({ x: cx + (Math.random() - 0.5) * 16, y: cy + (Math.random() - 0.5) * 16, vx: 0, vy: -8, t: 0, life: 0.5, c: '#fff6c0' });
    } else this.put('sock', cx, cy + 12);
    // particles and pop-up words
    for (const b of this.bits) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 160 * dt; c.globalAlpha = Math.max(0, 1 - b.t / b.life); c.fillStyle = b.c; c.fillRect(Math.round(b.x), Math.round(b.y), 2, 2); }
    c.globalAlpha = 1; this.bits = this.bits.filter((b) => b.t < b.life);
    c.font = '700 8px "Pixelify Sans", monospace'; c.textAlign = 'center';
    for (const p of this.pops) {
      p.t += dt; const y = Math.round(p.y - Math.min(1, p.t) * 12);
      c.globalAlpha = Math.max(0, Math.min(1, 2.2 - p.t * 1.4));
      c.fillStyle = '#2a1a0a'; c.fillText(p.text, p.x + 1, y + 1); c.fillStyle = p.c; c.fillText(p.text, p.x, y);
    }
    c.globalAlpha = 1; this.pops = this.pops.filter((p) => p.t < 1.6);
    // dusk falls
    if (this.dusk > 0) { const k = Math.sin(Math.min(1, this.dusk) * Math.PI); c.fillStyle = `rgba(30,20,60,${k * 0.6})`; c.fillRect(0, 0, SW, SH); this.dusk -= dt * 0.9 * this.speed; }
  }
  /** a mood bubble: a sun for cheery, a rain cloud for grumpy, a plain smile for fair, a question mark if unheard */
  private bubble(x: number, y: number, m: Mood | null) {
    const c = this.ctx;
    c.fillStyle = m === null ? 'rgba(255,255,255,0.6)' : m === 'cheery' ? '#fff4c0' : m === 'grumpy' ? '#d8dcef' : '#fffaf0'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(x - 7.5, y - 7.5, 15, 13, 3); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 1.5, y + 5.5); c.lineTo(x, y + 8); c.lineTo(x + 1.5, y + 5.5); c.fill();
    // each icon as rows of pixels: a letter picks the colour
    const icon = m === null ? ['.qq.', 'q..q', '...q', '..q.', '..q.', '....', '..q.']
      : m === 'cheery' ? ['y..y..y', '.yyyyy.', '.yoooy.', 'yyoooyy', '.yoooy.', '.yyyyy.', 'y..y..y']
      : m === 'grumpy' ? ['..ggg..', '.gggggg', 'ggggggg', '.......', '.b.b.b.', 'b.b.b..', '.......']
      : ['.......', '.k...k.', '.......', 'k.....k', '.kkkkk.', '.......', '.......'];
    const col: Record<string, string> = { q: '#8a7a6a', y: '#f2a020', o: '#ffd040', g: '#5a5a7a', b: '#3a8ae0', k: '#5a4a3a' };
    const w = icon[0].length, ox = x - Math.floor(w / 2), oy = y - 5;
    icon.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') { c.fillStyle = col[row[i]]; c.fillRect(ox + i, oy + j, 1, 1); } });
  }
}

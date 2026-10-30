// Lucky Pips · the battle stage, drawn with Canvas 2D: the painted fair behind, Dora and Enzo as painted cut-outs on
// the left, the fog-sprites on the right bobbing on the spot with their plans in a bubble above them, and every
// number that pops. Drawing only: the page hands it a view of the battle and the events to show.
import { drawChinchilla } from './chinchilla-art';
import type { Intent } from './pips-tools';

export type FoeView = {
  def: string; art: string; name: string; hp: number; max: number; block: number; poison: number; burn: number; stun: number;
  intent: Intent; hit: number; elite: boolean; boss: boolean; minion: boolean; down: boolean;
};
export type YouView = { hp: number; max: number; block: number; poison: number; burn: number; frost: number; thorns: number };
export type StageView = { area: number; lead: 'dora' | 'enzo' | 'both'; foes: FoeView[]; target: number; you: YouView; won: boolean; lost: boolean };
type Pop = { x: number; y: number; text: string; color: string; t: number; big: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; t: number; color: string };

const AREA_SKY = [['#f7d9a0', '#e9b67a', '#9fc27a'], ['#5d4a8e', '#c27aa0', '#3d3360'], ['#3a1f2e', '#8a2f35', '#c99a5e']];
const loaded = new Map<string, HTMLImageElement>();
/** Paintings load once per page and are shared by every scene. */
export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = loaded.get(name);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = `/art/pips/${name}.webp`; loaded.set(name, im); }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export class PipsScene {
  private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  private view: StageView | null = null;
  private time = 0; private stop = 0; private shake = 0;
  private pops: Pop[] = []; private sparks: Spark[] = [];
  private wince = new Map<number, number>(); private lunge = new Map<number, number>();
  private pose: { p: 'ready' | 'attack' | 'hurt' | 'win'; t: number } = { p: 'ready', t: 0 };
  private flash = 0;
  constructor(private cv: HTMLCanvasElement) { this.c = cv.getContext('2d')!; }
  resize(w: number, h: number, dpr: number) {
    this.W = Math.max(1, w); this.H = Math.max(1, h); this.dpr = Math.min(2, dpr);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
  }
  setView(v: StageView) { this.view = v; }

  // ---------- layout ----------
  /** Where the pair stand and how tall they are drawn. */
  pairBox() {
    const { W, H } = this, portrait = W < H * 1.25;
    const h = Math.min(H * (portrait ? 0.56 : 0.62), W * (portrait ? 0.3 : 0.24));
    const base = H * 0.88;
    return { h, base, x1: W * (portrait ? 0.15 : 0.13), x2: W * (portrait ? 0.33 : 0.27) };
  }
  /** Where each foe stands (feet in the middle bottom) and its size. */
  foeBox(i: number) {
    const v = this.view; const { W, H } = this, portrait = W < H * 1.25;
    const foes = v?.foes ?? [], n = Math.max(1, foes.length);
    const f = foes[i];
    const left = W * (portrait ? 0.5 : 0.52), right = W * 0.97;
    const slot = (right - left) / n;
    const scale = f?.boss ? 1 : f?.minion ? 0.55 : f?.elite ? 0.86 : 0.74;
    const h = Math.min(H * 0.66 * scale, slot * 1.25 * (f?.boss ? 1 : 0.95), W * (portrait ? 0.42 : 0.3) * scale);
    return { x: left + slot * (i + 0.5), base: H * 0.86 - (n > 1 && i % 2 ? H * 0.03 : 0), h, w: h * 0.95 };
  }
  /** The foe under a point on the canvas (css px), for picking a target. */
  foeAt(x: number, y: number): number {
    const v = this.view; if (!v) return -1;
    for (let i = 0; i < v.foes.length; i++) {
      const b = this.foeBox(i);
      if (!v.foes[i].down && Math.abs(x - b.x) < b.w * 0.55 && y > b.base - b.h - 50 && y < b.base + 40) return i;
    }
    return -1;
  }
  metrics() {
    const p = this.pairBox();
    return { W: this.W, H: this.H, pairH: p.h, pairX: [p.x1, p.x2], foes: (this.view?.foes ?? []).map((_, i) => this.foeBox(i)) };
  }

  // ---------- events ----------
  popFoe(i: number, text: string, color: string, big = false) { const b = this.foeBox(i); this.pops.push({ x: b.x, y: b.base - b.h * 0.6, text, color, t: 0, big }); }
  popYou(text: string, color: string, big = false) { const p = this.pairBox(); this.pops.push({ x: (p.x1 + p.x2) / 2, y: p.base - p.h * 0.7, text, color, t: 0, big }); }
  hitFoe(i: number, n: number) {
    this.wince.set(i, 0); this.popFoe(i, String(n), '#fff4e0', n >= 15);
    if (n >= 15) { this.stop = 0.09; this.shake = Math.min(14, 4 + n / 3); this.burst(i); }
    else this.shake = Math.max(this.shake, 2 + n / 6);
  }
  hitYou(n: number) {
    this.pose = { p: 'hurt', t: 0.55 }; this.flash = 0.25;
    this.popYou(n > 0 ? `−${n}` : 'blocked', n > 0 ? '#ff8a7a' : '#a8d8ff', n >= 12);
    if (n >= 12) { this.stop = 0.07; this.shake = 10; } else if (n > 0) this.shake = Math.max(this.shake, 4);
  }
  attack() { this.pose = { p: 'attack', t: 0.45 }; }
  cheer() { this.pose = { p: 'win', t: 99 }; }
  ready() { this.pose = { p: 'ready', t: 0 }; }
  act(i: number) { this.lunge.set(i, 0); }
  private burst(i: number) {
    const b = this.foeBox(i), cols = ['#ffd27a', '#ff9f6b', '#fff4e0', '#f6a6c8'];
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + (k % 3) * 0.2; const s = 120 + (k * 37) % 140; this.sparks.push({ x: b.x, y: b.base - b.h * 0.55, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, t: 0, color: cols[k % 4] }); }
  }

  // ---------- drawing ----------
  frame(dt: number) {
    if (this.stop > 0) { this.stop -= dt; dt = 0; }
    this.time += dt;
    const { c, W, H, dpr } = this, v = this.view;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = this.shake > 0.2 ? Math.sin(this.time * 90) * this.shake : 0, sy = this.shake > 0.2 ? Math.cos(this.time * 71) * this.shake * 0.6 : 0;
    this.shake *= Math.pow(0.0015, dt);
    c.save(); c.translate(sx, sy);
    this.backdrop(v?.area ?? 0);
    if (v) {
      this.drawPair(v, dt);
      v.foes.forEach((f, i) => this.drawFoe(f, i, v, dt));
      v.foes.forEach((f, i) => { if (!f.down) this.drawFoeHud(f, i, v); });
      this.drawYouHud(v.you);
    }
    for (const s of this.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 420 * dt; c.globalAlpha = Math.max(0, 1 - s.t / 0.8); c.fillStyle = s.color; c.beginPath(); c.arc(s.x, s.y, 4, 0, 7); c.fill(); }
    c.globalAlpha = 1; this.sparks = this.sparks.filter(s => s.t < 0.8);
    for (const p of this.pops) {
      p.t += dt;
      const k = p.t / 1.1, y = p.y - ease(k) * 46, sc = p.big ? 1.6 : 1;
      const pop = p.t < 0.12 ? 0.6 + (p.t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (p.t - 0.12) * 2);
      c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
      c.font = `900 ${Math.round(Math.max(18, Math.min(34, H * 0.07)) * sc * pop)}px ui-rounded, system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.lineWidth = 6; c.strokeStyle = '#2b1a1aee'; c.strokeText(p.text, p.x, y); c.fillStyle = p.color; c.fillText(p.text, p.x, y);
    }
    c.globalAlpha = 1; this.pops = this.pops.filter(p => p.t < 1.1);
    c.restore();
    if (this.flash > 0) { this.flash -= dt; c.fillStyle = `rgba(255,90,70,${Math.max(0, this.flash) * 0.6})`; c.fillRect(0, 0, W, H); }
    if (this.pose.p !== 'win' && this.pose.t > 0) { this.pose.t -= dt; if (this.pose.t <= 0) this.pose.p = 'ready'; }
  }
  private backdrop(area: number) {
    const { c, W, H } = this, im = art(['bg-meadow', 'bg-midway', 'bg-bigtop'][area] ?? 'bg-meadow');
    if (im) {
      const s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s;
      c.drawImage(im, (W - w) / 2, (H - h) * 0.55, w, h);
    } else paintBackdrop(c, W, H, area);
    // a soft floor shadow under the fighters so they sit in the scene
    const g = c.createLinearGradient(0, H * 0.7, 0, H);
    g.addColorStop(0, 'rgba(30,18,30,0)'); g.addColorStop(1, 'rgba(30,18,30,0.42)');
    c.fillStyle = g; c.fillRect(0, H * 0.7, W, H * 0.3);
  }
  private drawPair(v: StageView, dt: number) {
    void dt;
    const { c } = this, p = this.pairBox(), pose = v.won ? 'win' : this.pose.p;
    const lunge = pose === 'attack' ? Math.sin(Math.min(1, (0.45 - this.pose.t) / 0.45) * Math.PI) * p.h * 0.12 : 0;
    const hurt = pose === 'hurt' ? -Math.sin(Math.min(1, (0.55 - this.pose.t) / 0.55) * Math.PI) * p.h * 0.08 : 0;
    // the lead stands in front; Enzo is the bigger of the two
    const order: ('dora' | 'enzo')[] = v.lead === 'enzo' ? ['dora', 'enzo'] : ['enzo', 'dora'];
    for (const who of order) {
      const front = who === order[1];
      const x = (front ? p.x2 : p.x1) + (front ? lunge : lunge * 0.5) + hurt;
      const h = p.h * (who === 'dora' ? 0.86 : 1);
      const bob = pose === 'win' ? Math.abs(Math.sin(this.time * 6 + (who === 'dora' ? 0 : 1.3))) * h * 0.06 : Math.sin(this.time * 2.2 + (who === 'dora' ? 0 : 1)) * h * 0.008;
      c.save();
      c.fillStyle = 'rgba(20,10,20,0.28)'; c.beginPath(); c.ellipse(x, p.base, h * 0.32, h * 0.05, 0, 0, 7); c.fill();
      const im = art(`${who}-${pose}`) ?? art(`${who}-ready`);
      if (im) c.drawImage(im, x - h / 2, p.base - h - bob, h, h);
      else drawChinchilla(c, who, x, p.base - bob, { face: 1, h: h * 0.7, time: this.time, air: pose === 'win', dizzy: pose === 'hurt' });
      c.restore();
    }
  }
  private drawFoe(f: FoeView, i: number, v: StageView, dt: number) {
    const { c } = this, b = this.foeBox(i);
    let w = this.wince.get(i); if (w != null) { w += dt; if (w > 0.4) this.wince.delete(i); else this.wince.set(i, w); }
    let l = this.lunge.get(i); if (l != null) { l += dt; if (l > 0.5) this.lunge.delete(i); else this.lunge.set(i, l); }
    if (f.down) return;
    const bob = Math.sin(this.time * 2 + i * 1.7) * b.h * 0.025;
    const wk = w != null ? Math.sin((w / 0.4) * Math.PI) : 0;
    const lk = l != null ? Math.sin((l / 0.5) * Math.PI) : 0;
    const x = b.x - lk * b.h * 0.18 + wk * b.h * 0.06, base = b.base;
    c.save();
    c.fillStyle = 'rgba(20,10,20,0.3)'; c.beginPath(); c.ellipse(b.x, base, b.w * 0.34, b.h * 0.05, 0, 0, 7); c.fill();
    if (v.target === i && v.foes.filter(x2 => !x2.down).length > 1) {
      c.strokeStyle = '#ffd27a'; c.lineWidth = 3; c.setLineDash([8, 6]); c.lineDashOffset = -this.time * 20;
      c.beginPath(); c.ellipse(b.x, base, b.w * 0.42, b.h * 0.08, 0, 0, 7); c.stroke(); c.setLineDash([]);
    }
    c.translate(x, base - bob);
    c.scale(1 + wk * 0.08, 1 - wk * 0.1);
    const im = art(f.art);
    if (im) c.drawImage(im, -b.w / 2, -b.h, b.w, b.h);
    else paintFoe(c, f.def, b.h, this.time);
    if (wk > 0.05) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(255,255,255,${wk * 0.5})`; c.fillRect(-b.w / 2, -b.h, b.w, b.h); c.globalCompositeOperation = 'source-over'; }
    if (f.stun) { for (let k = 0; k < 3; k++) { const a = this.time * 3 + (k * Math.PI * 2) / 3; star(c, Math.cos(a) * b.w * 0.22, -b.h * 0.95 + Math.sin(a) * 6, 7, '#ffe58a'); } }
    if (f.elite) { c.fillStyle = '#ffd27a'; crown(c, 0, -b.h * 1.0, b.h * 0.11); }
    c.restore();
  }
  private drawFoeHud(f: FoeView, i: number, v: StageView) {
    const { c } = this, b = this.foeBox(i);
    const bw = Math.max(80, Math.min(160, b.w * 0.8)), bx = b.x - bw / 2, by = b.base + 8;
    bar(c, bx, by, bw, 14, f.hp / f.max, '#e2574c', `${f.hp}/${f.max}`);
    let sx = bx;
    if (f.block) { badge(c, sx - 12, by + 7, 'shield', String(f.block)); sx += 4; }
    const chips: [string, number][] = [['poison', f.poison], ['burn', f.burn]];
    let cx = bx + bw + 14;
    for (const [k, n] of chips) if (n) { badge(c, cx, by + 7, k, String(n)); cx += 30; }
    // the plan for next turn, in a bubble above
    const parts = intentParts(f.intent, f.hit);
    if (f.stun) parts.splice(0, parts.length, ['stun', 'zzz']);
    if (!parts.length) return;
    c.font = '900 17px ui-rounded, system-ui, sans-serif';
    const widths = parts.map(([, t]) => 25 + (t ? c.measureText(t).width + 3 : 0));
    const tw = widths.reduce((a, x) => a + x, 0) + 14, th = 32;
    const ty = Math.max(th / 2 + 4, b.base - b.h - 22 - (f.elite ? b.h * 0.1 : 0)), tx = Math.min(this.W - tw / 2 - 4, Math.max(tw / 2 + 4, b.x));
    c.fillStyle = '#fff8ecf2'; c.strokeStyle = parts.some(p => p[0] === 'atk') ? '#d2473c' : '#6a5a8e'; c.lineWidth = 2.5;
    round(c, tx - tw / 2, ty - th / 2, tw, th, 14); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(tx - 6, ty + th / 2 - 1); c.lineTo(tx, ty + th / 2 + 7); c.lineTo(tx + 6, ty + th / 2 - 1); c.fill();
    let x = tx - tw / 2 + 8;
    parts.forEach(([k, t], j) => {
      icon(c, k, x + 10, ty, 10.5);
      if (t) { c.fillStyle = '#3a2430'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, x + 23, ty + 1); }
      x += widths[j];
    });
    void v;
  }
  private drawYouHud(y: YouView) {
    const { c } = this, p = this.pairBox();
    const bw = Math.max(110, Math.min(220, (p.x2 - p.x1) + p.h * 0.6)), bx = (p.x1 + p.x2) / 2 - bw / 2, by = p.base + 8;
    bar(c, bx, by, bw, 16, y.hp / y.max, '#e2574c', `${y.hp}/${y.max}`, true);
    if (y.block) badge(c, bx - 12, by + 8, 'shield', String(y.block));
    let cx = bx + bw + 14;
    for (const [k, n] of [['poison', y.poison], ['burn', y.burn], ['frost', y.frost], ['thorns', y.thorns]] as [string, number][]) if (n) { badge(c, cx, by + 8, k, String(n)); cx += 30; }
  }
}

/** The parts of a foe's plan: [icon, number]. */
export function intentParts(it: Intent, hit: number): [string, string][] {
  const out: [string, string][] = [];
  if (it.atk) out.push(['atk', it.hits && it.hits > 1 ? `${hit}×${it.hits}` : String(hit)]);
  if (it.block) out.push(['shield', String(it.block)]);
  if (it.heal) out.push(['heal', String(it.heal)]);
  if (it.buff) out.push(['buff', `+${it.buff}`]);
  if (it.poison) out.push(['poison', String(it.poison)]);
  if (it.burn) out.push(['burn', String(it.burn)]);
  if (it.frost) out.push(['frost', String(it.frost)]);
  if (it.curse) out.push(['curse', String(it.curse)]);
  if (it.lock) out.push(['lock', '']);
  if (it.summon) out.push(['summon', '']);
  return out;
}

// ---------- small drawing helpers ----------
function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, col: string, label: string, heart = false) {
  c.fillStyle = '#2b1a24d0'; round(c, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); c.fill();
  c.fillStyle = '#5a3a46'; round(c, x, y, w, h, h / 2); c.fill();
  if (f > 0) { c.fillStyle = col; round(c, x, y, Math.max(h, w * Math.min(1, f)), h, h / 2); c.fill(); c.fillStyle = '#ffffff40'; round(c, x + 3, y + 2, Math.max(0, w * Math.min(1, f) - 6), h * 0.35, h * 0.2); c.fill(); }
  c.font = `900 ${h - 2}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 3; c.strokeStyle = '#2b1a24'; c.strokeText(label, x + w / 2, y + h / 2 + 1); c.fillStyle = '#fff'; c.fillText(label, x + w / 2, y + h / 2 + 1);
  if (heart) icon(c, 'heart', x - 2, y + h / 2, 9);
}
function badge(c: CanvasRenderingContext2D, x: number, y: number, k: string, t: string) {
  c.fillStyle = '#fff8ec'; c.strokeStyle = '#2b1a24'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); c.stroke();
  icon(c, k, x, y - 3, 6.5);
  c.font = '900 11px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2b1a24'; c.fillText(t, x, y + 6.5);
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  c.fillStyle = col; c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function crown(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath(); c.moveTo(x - s, y + s * 0.5); c.lineTo(x - s, y - s * 0.3); c.lineTo(x - s * 0.5, y + s * 0.1); c.lineTo(x, y - s * 0.6); c.lineTo(x + s * 0.5, y + s * 0.1); c.lineTo(x + s, y - s * 0.3); c.lineTo(x + s, y + s * 0.5); c.closePath();
  c.fill(); c.strokeStyle = '#8a5a1a'; c.lineWidth = 2; c.stroke();
}
/** The little icons for intents and statuses, drawn from shapes. */
export function icon(c: CanvasRenderingContext2D, k: string, x: number, y: number, r: number) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  switch (k) {
    case 'atk': c.fillStyle = '#d2473c'; c.beginPath(); c.moveTo(-r, r); c.lineTo(r * 0.6, -r * 0.6); c.lineTo(r, -r); c.lineTo(r * 0.75, -r * 0.4); c.lineTo(-r * 0.75, r * 1.05); c.closePath(); c.fill(); c.fillStyle = '#8a5a1a'; c.fillRect(-r, r * 0.4, r * 0.7, r * 0.3); break;
    case 'shield': c.fillStyle = '#5a8ed8'; c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.9, -r * 0.6); c.quadraticCurveTo(r * 0.8, r * 0.6, 0, r); c.quadraticCurveTo(-r * 0.8, r * 0.6, -r * 0.9, -r * 0.6); c.closePath(); c.fill(); break;
    case 'heal': case 'heart': c.fillStyle = k === 'heart' ? '#e2574c' : '#4caa5c'; c.beginPath(); c.moveTo(0, r * 0.9); c.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.2, 0, -r * 0.4); c.bezierCurveTo(r * 0.6, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9); c.fill(); break;
    case 'poison': c.fillStyle = '#8a4fc8'; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r, r * 0.2, 0, r); c.quadraticCurveTo(-r, r * 0.2, 0, -r); c.fill(); break;
    case 'burn': c.fillStyle = '#f08a2c'; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * 1.1, 0, r * 0.4, r); c.lineTo(-r * 0.4, r); c.quadraticCurveTo(-r * 1.1, 0, 0, -r); c.fill(); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(0, r * 0.45, r * 0.4, 0, 7); c.fill(); break;
    case 'frost': c.strokeStyle = '#5ab4e8'; c.lineWidth = r * 0.3; for (let a = 0; a < 3; a++) { c.beginPath(); c.moveTo(Math.cos(a * 1.05) * r, Math.sin(a * 1.05) * r); c.lineTo(-Math.cos(a * 1.05) * r, -Math.sin(a * 1.05) * r); c.stroke(); } break;
    case 'curse': c.fillStyle = '#b07a3a'; round(c, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.35); c.fill(); c.fillStyle = '#ffe2b0'; c.beginPath(); c.arc(0, 0, r * 0.25, 0, 7); c.fill(); c.fillStyle = '#7a4a1a'; c.beginPath(); c.ellipse(0, -r * 0.7, r * 0.7, r * 0.3, 0, 0, 7); c.fill(); break;
    case 'lock': c.strokeStyle = '#c23a4a'; c.lineWidth = r * 0.35; c.beginPath(); c.arc(0, 0, r * 0.8, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.35, 0, 7); c.stroke(); break;
    case 'summon': c.fillStyle = '#a89ac8'; c.beginPath(); c.arc(-r * 0.35, r * 0.1, r * 0.6, 0, 7); c.arc(r * 0.4, -r * 0.1, r * 0.7, 0, 7); c.fill(); c.fillStyle = '#4caa5c'; c.fillRect(r * 0.3, -r, r * 0.25, r * 0.7); c.fillRect(r * 0.1, -r * 0.78, r * 0.65, r * 0.25); break;
    case 'buff': c.fillStyle = '#d2473c'; c.beginPath(); c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(r * 0.4, 0); c.lineTo(r * 0.4, r); c.lineTo(-r * 0.4, r); c.lineTo(-r * 0.4, 0); c.lineTo(-r, 0); c.closePath(); c.fill(); break;
    case 'stun': star(c, 0, 0, r, '#e8b83a'); break;
    case 'thorns': c.fillStyle = '#6a8a3a'; for (let a = 0; a < 5; a++) { const t = (a / 5) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(t) * r, Math.sin(t) * r); c.lineTo(Math.cos(t + 0.5) * r * 0.35, Math.sin(t + 0.5) * r * 0.35); c.lineTo(Math.cos(t - 0.5) * r * 0.35, Math.sin(t - 0.5) * r * 0.35); c.fill(); } break;
    default: c.fillStyle = '#888'; c.beginPath(); c.arc(0, 0, r * 0.6, 0, 7); c.fill();
  }
  c.restore();
}

// ---------- stand-ins until (or unless) the paintings load ----------
export function paintBackdrop(c: CanvasRenderingContext2D, W: number, H: number, area: number) {
  const [a, b, g] = AREA_SKY[area] ?? AREA_SKY[0];
  const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, a); sky.addColorStop(0.65, b); sky.addColorStop(1, g);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  // striped stalls on the horizon and strings of lanterns
  for (let i = 0; i < 7; i++) {
    const x = (i + 0.3) * W / 6.5, w = W * 0.08, h = H * 0.16, y = H * 0.62 - h;
    for (let s = 0; s < 5; s++) { c.fillStyle = s % 2 ? '#fff3e0' : ['#d2473c', '#4a7ac8', '#e8a43a'][i % 3]; c.fillRect(x + (s * w) / 5, y, w / 5 + 0.5, h * 0.4); }
    c.fillStyle = '#7a5032'; c.fillRect(x, y + h * 0.4, w, h * 0.6);
  }
  c.fillStyle = g; c.fillRect(0, H * 0.62, W, H * 0.38);
  for (let i = 0; i < 14; i++) { const x = (i + 0.5) * W / 14, y = H * 0.12 + Math.sin(i * 0.9) * H * 0.03; c.fillStyle = '#ffcf6a'; c.beginPath(); c.ellipse(x, y, 7, 9, 0, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(220,200,240,0.25)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(W * (0.1 + i * 0.22), H * 0.66, W * 0.16, H * 0.05, 0, 0, 7); c.fill(); }
}
const FOG_TINT: Record<string, string> = { hoopla: '#c9b8e0', candyfloss: '#f6b8d6', toffee: '#d89a4a', ringtoss: '#b8a8d0', carousel: '#e6e0f4', seedling: '#f0943a', pumpkin: '#f0943a', moth: '#d8c8f0', ringmaster: '#b8a8d8' };
export function paintFoe(c: CanvasRenderingContext2D, def: string, h: number, t: number) {
  const col = FOG_TINT[def] ?? '#c9b8e0', r = h * 0.38;
  c.fillStyle = col;
  c.beginPath(); c.ellipse(0, -r, r, r * 1.02, 0, 0, 7); c.fill();
  for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-r * 0.8 + k * r * 0.4, -r * 0.1 + Math.sin(t * 2 + k) * 3, r * 0.3, 0, 7); c.fill(); }
  c.fillStyle = '#3a2430';
  c.beginPath(); c.ellipse(-r * 0.35, -r * 1.15, r * 0.09, r * 0.12, 0, 0, 7); c.ellipse(r * 0.15, -r * 1.15, r * 0.09, r * 0.12, 0, 0, 7); c.fill();
  c.lineWidth = r * 0.06; c.strokeStyle = '#3a2430'; c.beginPath(); c.moveTo(-r * 0.5, -r * 1.35); c.lineTo(-r * 0.2, -r * 1.27); c.moveTo(r * 0.3, -r * 1.35); c.lineTo(0, -r * 1.27); c.stroke();
  c.beginPath(); c.arc(-r * 0.1, -r * 0.75, r * 0.16, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
}
/** The title and ending stand-ins. */
export function paintTitle(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return;
  paintBackdrop(c, cv.width, cv.height, 0);
  drawChinchilla(c, 'dora', cv.width * 0.4, cv.height * 0.8, { face: 1, h: cv.height * 0.3, time: 0 });
  drawChinchilla(c, 'enzo', cv.width * 0.6, cv.height * 0.8, { face: -1, h: cv.height * 0.34, time: 0 });
}
export function paintEnding(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return;
  paintBackdrop(c, cv.width, cv.height, 0);
  drawChinchilla(c, 'dora', cv.width * 0.42, cv.height * 0.8, { face: 1, h: cv.height * 0.3, time: 0, air: true });
  drawChinchilla(c, 'enzo', cv.width * 0.58, cv.height * 0.8, { face: -1, h: cv.height * 0.34, time: 0, air: true });
}

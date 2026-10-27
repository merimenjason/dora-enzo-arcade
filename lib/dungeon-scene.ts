// Dust Bunny Dungeon's cellars in Canvas 2D: floors and walls for each area, fog over rooms not yet seen, every enemy
// with its plan for next turn drawn on the floor (coral marks where it will bop, arrows where it will go), Dora or
// Enzo, crates, traps, tools, poofs and a minimap. Drawing only: the rules live in dungeon-game.ts. Painted art from
// public/art/dungeon/ is used once it loads; until then (or if it never does) everything is drawn here.
import { drawChinchilla } from './chinchilla-art';
import {
  W, H, DX, DY, WALL, FLOOR, PIT, SPIKE, LOWERED, SWITCH, BELLOWS, DOOR, LOCKED, STAIRS, CHEST, KINDS, HARMFUL, TOOLS,
  type DungeonGame, type Enemy, type Ev, type Kind, type Item,
} from './dungeon-game';

const FONT = 'ui-rounded, "Trebuchet MS", system-ui, sans-serif';
/** Each area's colours: floor, floor light, floor dark, wall top, wall face, wall line, fog, accent. */
const LOOK = [
  { floor: '#7a5639', light: '#94693f', dark: '#5e412b', top: '#4a3020', face: '#33200f', line: '#24160b', fog: '#140c08', accent: '#a7c66b' },
  { floor: '#a87947', light: '#c18f58', dark: '#86592f', top: '#5d3f26', face: '#3f2915', line: '#2a1b0d', fog: '#160e08', accent: '#ffd27a' },
  { floor: '#596171', light: '#6d7586', dark: '#444b59', top: '#343946', face: '#22252e', line: '#15171d', fog: '#0a0b10', accent: '#ffc56b' },
];
/** Fallback colours for each enemy kind: body, shade, and a trim. */
const BODY: Record<Kind, [string, string, string]> = {
  fluff: ['#cfc6bb', '#a1968a', '#f3ece4'], hopper: ['#e3dbcf', '#b2a796', '#ffb8c6'], roller: ['#b59266', '#8a6b45', '#e0c79e'],
  puffer: ['#e7c3cf', '#bf95a4', '#fff0f4'], sneezer: ['#d8d0a6', '#aea47a', '#ff9aa8'], mimic: ['#e6bf5c', '#b88d33', '#fff0b8'],
  burrower: ['#a88b70', '#7d6550', '#d9c3a8'], bigbun: ['#dcd3c8', '#ada194', '#ff9fb6'], foreman: ['#6f5a4c', '#4e3e33', '#ffcc33'],
  king: ['#bdb0d6', '#8f80ad', '#ffd24a'],
};
const DANGER = '#ff7a5c';
const ART = ['title', 'floor-0', 'floor-1', 'floor-2', 'player-dora', 'player-enzo', 'crate', 'bale', 'chest', 'stairs', 'key', 'heart', 'switch', 'bellows', 'prickles',
  ...(['fluff', 'hopper', 'roller', 'puffer', 'sneezer', 'mimic', 'burrower', 'bigbun', 'foreman', 'king'] as Kind[]).map((k) => `enemy-${k}`), ...TOOLS.map((t) => `tool-${t}`)];

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dust' | 'star' | 'heart' };
type Pop = { x: number; y: number; text: string; color: string; born: number };
type Pos = { x: number; y: number; fx: number; fy: number; t: number; hop: number };
type Beam = { x: number; y: number; tx: number; ty: number; born: number; kind: string; d: number };
export type Overlay = { dt: number; hover: number; aim: { tiles: number[]; ok: boolean } | null; warn: number; grid: boolean; padBottom: number; char: 'dora' | 'enzo' };

const rnd = (i: number, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export class DungeonScene {
  private c: CanvasRenderingContext2D;
  w = 0; h = 0; private dpr = 1;
  private art = new Map<string, HTMLImageElement>();
  private pos = new Map<number, Pos>();
  private sparks: Spark[] = [];
  private pops: Pop[] = [];
  private beams: Beam[] = [];
  private clock = 0;
  private cam = { x: 15, y: 15, ready: false };
  private shake = 0;
  private flash = 0;
  private swing = { t: -9, d: 2 };
  private floorShown = -1;
  T = 40;
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    for (const name of ART) { const img = new Image(); img.decoding = 'async'; img.src = `/art/dungeon/${name}.webp`; this.art.set(name, img); }
  }
  private img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(300, r.width); this.h = Math.max(300, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.T = Math.round(Math.max(26, Math.min(64, Math.min(this.w / 13, this.h / 11))));
  }
  /** Screen position of a tile's top-left corner. */
  private sx(x: number) { return (x - this.cam.x) * this.T + this.w / 2; }
  private sy(y: number) { return (y - this.cam.y) * this.T + this.camMid; }
  private camMid = 0;
  /** Which tile is under a point on the canvas (CSS pixels). */
  tileAt(px: number, py: number) {
    const x = Math.floor((px - this.w / 2) / this.T + this.cam.x), y = Math.floor((py - this.camMid) / this.T + this.cam.y);
    return x >= 0 && y >= 0 && x < W && y < H ? { x, y } : null;
  }

  /** Feed the game's events in as they happen: tweens, poofs, bops and sparkles. */
  feed(g: DungeonGame, events: Ev[]) {
    const now = this.clock, T = this.T;
    for (const e of events) {
      const cx = e.x + 0.5, cy = e.y + 0.5;
      switch (e.k) {
        case 'move': case 'pushed': this.slide(-1, e.tx ?? e.x, e.ty ?? e.y, e.x, e.y, e.k === 'move' ? 0.12 : 0); break;
        case 'dash': this.burst(cx, cy, '#fff6d8', 10, 'dust'); break;
        case 'step': case 'slide': case 'tunnel': this.slide(e.id!, e.tx ?? e.x, e.ty ?? e.y, e.x, e.y, 0); break;
        case 'jump': this.slide(e.id!, e.tx ?? e.x, e.ty ?? e.y, e.x, e.y, 0.9); this.burst(cx, cy + 0.3, '#e9dccb', 6, 'dust'); break;
        case 'roll': this.slide(e.id!, e.tx ?? e.x, e.ty ?? e.y, e.x, e.y, 0); this.burst(cx, cy + 0.3, '#d9c09a', 8, 'dust'); break;
        case 'emerge': this.snap(e.id!, e.x, e.y); this.burst(cx, cy + 0.2, '#9a7b5c', 14, 'dust'); this.pop(cx, cy, 'POP!', '#ffd27a'); break;
        case 'swing': this.swing = { t: now, d: e.d ?? 2 }; break;
        case 'hit': this.burst(cx, cy, '#fff2c4', 6, 'star'); this.pop(cx, cy - 0.2, e.text === 'wall' || e.text === 'bump' || e.text === 'crate' ? 'BONK!' : 'BOP!', '#fff2c4'); this.shake = Math.max(this.shake, 0.12); break;
        case 'poof': this.burst(cx, cy, '#f4efe8', 22, 'dust'); this.burst(cx, cy, '#ffe9a8', 6, 'star'); this.pop(cx, cy - 0.3, e.text === 'pit' ? 'whoops!' : e.text === 'prickles' ? 'prick!' : 'poof!', '#ffffff'); this.pos.delete(e.id!); break;
        case 'hurt': this.burst(cx, cy, '#ff9a8a', 10, 'star'); this.pop(cx, cy - 0.4, '−1 ♥', '#ff8f8f'); this.shake = 0.35; this.flash = 1; break;
        case 'heal': this.burst(cx, cy, '#ff9fb6', 8, 'heart'); this.pop(cx, cy - 0.4, '+♥', '#ffb3c6'); break;
        case 'wind': this.burst(cx, cy, '#bfe8ff', 18, 'star'); this.pop(cx, cy - 0.5, 'Second Wind!', '#bfe8ff'); break;
        case 'pick': this.burst(cx, cy, '#ffe48a', 10, 'star'); break;
        case 'chest': this.burst(cx, cy, '#ffd24a', 18, 'star'); this.pop(cx, cy - 0.4, 'treasure!', '#ffd24a'); break;
        case 'unlock': this.burst(cx, cy, '#ffd24a', 10, 'star'); break;
        case 'crumble': this.burst(cx, cy, '#b48a5a', 12, 'dust'); break;
        case 'fill': this.burst(cx, cy, '#b48a5a', 10, 'dust'); break;
        case 'gust': for (let d = 0; d < 4; d++) this.beams.push({ x: cx, y: cy, tx: cx + DX[d] * 1.4, ty: cy + DY[d] * 1.4, born: now, kind: 'gust', d }); this.burst(cx, cy, '#ffffff', 8, 'dust'); break;
        case 'spikes': this.shake = Math.max(this.shake, 0.15); break;
        case 'shot': this.beams.push({ x: cx, y: cy, tx: (e.tx ?? e.x) + 0.5, ty: (e.ty ?? e.y) + 0.5, born: now, kind: 'shot', d: e.d ?? 0 }); break;
        case 'soap': this.beams.push({ x: cx, y: cy, tx: cx + DX[e.d ?? 0] * (e.n ?? 1), ty: cy + DY[e.d ?? 0] * (e.n ?? 1), born: now, kind: 'soap', d: e.d ?? 0 }); break;
        case 'duster': this.swing = { t: now, d: e.d ?? 2 }; this.burst(cx + DX[e.d ?? 0], cy + DY[e.d ?? 0], '#ffd6e8', 14, 'dust'); break;
        case 'puff': this.beams.push({ x: cx, y: cy, tx: (e.tx ?? e.x) + 0.5, ty: (e.ty ?? e.y) + 0.5, born: now, kind: 'puff', d: 0 }); this.burst((e.tx ?? e.x) + 0.5, (e.ty ?? e.y) + 0.5, '#d9d2c8', 14, 'dust'); break;
        case 'sneeze': this.beams.push({ x: cx, y: cy, tx: cx + DX[e.d ?? 0] * (e.n ?? 1), ty: cy + DY[e.d ?? 0] * (e.n ?? 1), born: now, kind: 'sneeze', d: e.d ?? 0 }); this.pop(cx, cy - 0.5, 'ACHOO!', '#ffe0a8'); break;
        case 'bop': case 'sweep': this.burst(cx, cy, '#ffd0b0', 4, 'dust'); break;
        case 'surprise': this.pop(cx, cy - 0.5, 'Surprise!', '#ffd27a'); this.burst(cx, cy, '#f0c860', 12, 'dust'); break;
        case 'wake': this.pop(cx, cy - 0.6, '!', '#ffd27a'); break;
        case 'dusty': case 'split': case 'summon': this.snap(e.id!, e.x, e.y); this.burst(cx, cy, '#e8e0d4', 14, 'dust'); break;
        case 'dig': this.burst(cx, cy + 0.2, '#9a7b5c', 10, 'dust'); break;
        case 'stairsopen': this.burst(cx, cy, '#ffe48a', 26, 'star'); break;
        case 'win': for (let k = 0; k < 4; k++) this.burst(cx, cy, ['#ffd24a', '#ff9fb6', '#9ff0c4', '#a8d4ff'][k], 20, 'star'); break;
        case 'floor': this.pos.clear(); this.cam.ready = false; break;
        default: break;
      }
    }
    void g; void T;
  }
  private slide(id: number, fx: number, fy: number, x: number, y: number, hop: number) {
    const p = this.pos.get(id);
    const from = p ? this.at(p) : { x: fx, y: fy };
    this.pos.set(id, { x, y, fx: from.x, fy: from.y, t: this.clock, hop });
  }
  private snap(id: number, x: number, y: number) { this.pos.set(id, { x, y, fx: x, fy: y, t: this.clock - 1, hop: 0 }); }
  /** Where something is drawn right now, easing from where it was. */
  private at(p: Pos) {
    const k = Math.min(1, (this.clock - p.t) / 0.13), e = 1 - (1 - k) * (1 - k);
    return { x: p.fx + (p.x - p.fx) * e, y: p.fy + (p.y - p.fy) * e - Math.sin(k * Math.PI) * p.hop };
  }
  private place(id: number, x: number, y: number) {
    let p = this.pos.get(id);
    if (!p || (p.x !== x || p.y !== y) && this.clock - p.t > 0.13) { p = { x, y, fx: x, fy: y, t: this.clock - 1, hop: 0 }; this.pos.set(id, p); }
    return this.at(p);
  }
  private burst(x: number, y: number, color: string, n: number, kind: Spark['kind']) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(i, x + y) * 0.8, sp = 0.8 + rnd(i, 3) * 2.2;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'heart' ? 1 : 0), life: 0, max: 0.35 + rnd(i, 7) * 0.35, color, size: kind === 'dust' ? 0.12 + rnd(i, 9) * 0.12 : 0.08, kind });
    }
    if (this.sparks.length > 500) this.sparks.splice(0, this.sparks.length - 500);
  }
  private pop(x: number, y: number, text: string, color: string) { this.pops.push({ x, y, text, color, born: this.clock }); if (this.pops.length > 12) this.pops.shift(); }

  // ---------------------------------------------------------------- the frame
  draw(g: DungeonGame | null, o: Overlay) {
    const c = this.c, dt = o.dt; this.clock += dt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const L = LOOK[g ? g.area : 0];
    c.fillStyle = L.fog; c.fillRect(0, 0, this.w, this.h);
    if (!g) return;
    if (this.floorShown !== g.floor) { this.floorShown = g.floor; this.pos.clear(); this.cam.ready = false; }
    const T = this.T, me = this.place(-1, g.px, g.py);
    // the camera follows, a little above centre when the pad covers the bottom of a phone
    this.camMid = (this.h - o.padBottom) / 2;
    const tx = me.x + 0.5, ty = me.y + 0.5;
    if (!this.cam.ready) { this.cam.x = tx; this.cam.y = ty; this.cam.ready = true; }
    const k = 1 - Math.pow(0.0005, dt);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.shake = Math.max(0, this.shake - dt); this.flash = Math.max(0, this.flash - dt * 2.5);
    c.save();
    if (this.shake > 0) c.translate((rnd(this.clock * 60) - 0.5) * this.shake * 14, (rnd(this.clock * 60, 2) - 0.5) * this.shake * 14);
    const x0 = Math.max(0, Math.floor(this.cam.x - this.w / 2 / T) - 1), x1 = Math.min(W - 1, Math.ceil(this.cam.x + this.w / 2 / T) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y - this.camMid / T) - 1), y1 = Math.min(H - 1, Math.ceil(this.cam.y + (this.h - this.camMid) / T) + 1);
    // floors and the things set into them
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (!g.seen[i]) continue;
      const t = g.tiles[i]; if (t === WALL) continue;
      this.floorTile(g, x, y, L);
      if (o.grid) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.strokeRect(this.sx(x) + 0.5, this.sy(y) + 0.5, T - 1, T - 1); }
      this.feature(g, t, x, y, L);
    }
    // marks: where enemies will bop next turn, and old dust clouds
    const danger = g.danger();
    const pulse = 0.55 + Math.sin(this.clock * 5) * 0.2;
    for (const i of danger) {
      const x = i % W, y = Math.floor(i / W); if (!g.seen[i] || x < x0 || x > x1 || y < y0 || y > y1) continue;
      this.mark(x, y, pulse, i === g.pi);
    }
    for (const [i] of g.clouds) this.cloud(i % W, Math.floor(i / W));
    // aim preview and the hovered tile
    if (o.aim) for (const i of o.aim.tiles) { const x = i % W, y = Math.floor(i / W); c.fillStyle = o.aim.ok ? 'rgba(140,220,255,.28)' : 'rgba(255,255,255,.12)'; c.fillRect(this.sx(x) + 2, this.sy(y) + 2, T - 4, T - 4); c.strokeStyle = 'rgba(160,230,255,.85)'; c.lineWidth = 2; c.strokeRect(this.sx(x) + 3, this.sy(y) + 3, T - 6, T - 6); }
    if (o.hover >= 0 && g.seen[o.hover]) { const x = o.hover % W, y = Math.floor(o.hover / W); c.strokeStyle = 'rgba(255,248,220,.7)'; c.lineWidth = 2; c.strokeRect(this.sx(x) + 2, this.sy(y) + 2, T - 4, T - 4); }
    if (o.warn >= 0) { const x = o.warn % W, y = Math.floor(o.warn / W); c.strokeStyle = '#ffe06b'; c.lineWidth = 3; c.setLineDash([5, 4]); c.strokeRect(this.sx(x) + 3, this.sy(y) + 3, T - 6, T - 6); c.setLineDash([]); }
    // items, crates and walls in rows, so things lower down sit in front
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x; if (!g.seen[i]) continue;
        if (g.tiles[i] === WALL) this.wall(g, x, y, L);
        const it = g.items.get(i); if (it) this.item(it, x, y);
        if (g.crates[i]) this.crate(x, y);
      }
    }
    // plans, then the creatures themselves
    for (const e of g.enemies) if (this.visible(g, e)) this.intent(g, e);
    const bodies: { y: number; draw: () => void }[] = [];
    for (const e of g.enemies) {
      if (!this.visible(g, e)) continue;
      const p = this.place(e.id, e.x, e.y);
      bodies.push({ y: p.y, draw: () => this.enemy(e, p.x, p.y) });
    }
    bodies.push({ y: me.y, draw: () => this.hero(g, me.x, me.y, o.char) });
    bodies.sort((a, b) => a.y - b.y).forEach((b) => b.draw());
    // fog edges: a soft shadow where seen meets unseen
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (g.seen[i]) continue;
      c.fillStyle = L.fog; c.fillRect(this.sx(x) - 0.5, this.sy(y) - 0.5, T + 1, T + 1);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !g.seen[ny * W + nx]) continue;
        const gx = this.sx(x) + T / 2, gy = this.sy(y) + T / 2;
        const gr = c.createLinearGradient(gx, gy, gx + DX[d] * T * 0.9, gy + DY[d] * T * 0.9);
        gr.addColorStop(0, L.fog); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.fillRect(this.sx(nx), this.sy(ny), T, T);
      }
    }
    this.effects(dt);
    c.restore();
    // a warm vignette, a red flash when bopped
    const vg = c.createRadialGradient(this.w / 2, this.camMid, Math.min(this.w, this.h) * 0.3, this.w / 2, this.camMid, Math.max(this.w, this.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,5,0,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, this.w, this.h);
    if (this.flash > 0) { c.fillStyle = `rgba(255,90,80,${this.flash * 0.22})`; c.fillRect(0, 0, this.w, this.h); }
    this.minimap(g, L);
  }
  private visible(g: DungeonGame, e: Enemy) { return g.seen[e.y * W + e.x] > 0 || e.awake; }

  // ---------------------------------------------------------------- tiles
  private floorTile(g: DungeonGame, x: number, y: number, L: (typeof LOOK)[number]) {
    const c = this.c, T = this.T, X = this.sx(x), Y = this.sy(y), i = y * W + x;
    const tex = this.img(`floor-${g.area}`);
    if (tex) { const s = tex.naturalWidth / 4; c.drawImage(tex, (x % 4) * s, (y % 4) * s, s, s, X, Y, T + 0.5, T + 0.5); return; }
    const v = rnd(i);
    c.fillStyle = v < 0.33 ? L.floor : v < 0.66 ? L.light : L.floor; c.fillRect(X, Y, T + 0.5, T + 0.5);
    c.fillStyle = L.dark;
    if (g.area === 1) { // planks
      c.fillRect(X, Y + T * 0.48, T, Math.max(1, T * 0.04)); c.fillRect(X + (rnd(i, 2) < 0.5 ? T * 0.3 : T * 0.7), Y, Math.max(1, T * 0.04), T * 0.48);
    } else if (g.area === 2) { // flagstones
      c.globalAlpha = 0.5; c.strokeStyle = L.dark; c.lineWidth = Math.max(1, T * 0.04); c.strokeRect(X + T * 0.06, Y + T * 0.06, T * 0.88, T * 0.88); c.globalAlpha = 1;
    }
    for (let k = 0; k < 3; k++) { const r = rnd(i, k + 4); if (r < 0.5) continue; c.globalAlpha = 0.35; c.beginPath(); c.arc(X + rnd(i, k + 10) * T, Y + rnd(i, k + 20) * T, T * 0.035 + r * T * 0.03, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  }
  private feature(g: DungeonGame, t: number, x: number, y: number, L: (typeof LOOK)[number]) {
    const c = this.c, T = this.T, X = this.sx(x), Y = this.sy(y), cx = X + T / 2, cy = Y + T / 2;
    if (t === PIT) {
      const gr = c.createRadialGradient(cx, cy + T * 0.08, T * 0.05, cx, cy, T * 0.55);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#120a06'); gr.addColorStop(1, L.dark);
      c.fillStyle = gr; c.beginPath(); c.ellipse(cx, cy, T * 0.47, T * 0.44, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = L.light; c.lineWidth = Math.max(1, T * 0.05); c.beginPath(); c.ellipse(cx, cy, T * 0.47, T * 0.44, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    } else if (t === SPIKE || t === LOWERED) {
      const art = this.img('prickles');
      if (t === SPIKE && art) { c.drawImage(art, X, Y - T * 0.1, T, T * 1.1); return; }
      for (let k = 0; k < 4; k++) {
        const px = X + T * (0.27 + (k % 2) * 0.46), py = Y + T * (0.3 + Math.floor(k / 2) * 0.42);
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(px, py + T * 0.06, T * 0.1, T * 0.05, 0, 0, Math.PI * 2); c.fill();
        if (t === SPIKE) {
          c.fillStyle = '#7fa35a'; c.beginPath(); c.moveTo(px - T * 0.1, py + T * 0.06); c.lineTo(px, py - T * 0.22); c.lineTo(px + T * 0.1, py + T * 0.06); c.closePath(); c.fill();
          c.fillStyle = '#c8e48e'; c.beginPath(); c.moveTo(px - T * 0.02, py); c.lineTo(px, py - T * 0.2); c.lineTo(px + T * 0.03, py); c.fill();
          c.fillStyle = '#d98ad0'; c.beginPath(); c.arc(px, py - T * 0.21, T * 0.035, 0, Math.PI * 2); c.fill();
        }
      }
      if (t === LOWERED) { c.strokeStyle = 'rgba(127,163,90,.55)'; c.lineWidth = 1; c.strokeRect(X + T * 0.12, Y + T * 0.12, T * 0.76, T * 0.76); }
    } else if (t === SWITCH) {
      const art = this.img('switch'), up = this.spikesUp(g);
      c.fillStyle = '#5c4630'; c.fillRect(X + T * 0.2, Y + T * 0.6, T * 0.6, T * 0.2);
      if (art) { c.save(); c.translate(cx, cy); if (!up) c.scale(-1, 1); c.drawImage(art, -T / 2, -T / 2, T, T); c.restore(); return; }
      c.strokeStyle = '#3a2a1a'; c.lineWidth = T * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, Y + T * 0.68); c.lineTo(cx + (up ? 1 : -1) * T * 0.22, Y + T * 0.24); c.stroke();
      c.fillStyle = up ? '#ff8f7a' : '#9ff0c4'; c.beginPath(); c.arc(cx + (up ? 1 : -1) * T * 0.22, Y + T * 0.24, T * 0.1, 0, Math.PI * 2); c.fill();
    } else if (t === BELLOWS) {
      const art = this.img('bellows'); if (art) { c.drawImage(art, X, Y, T, T); return; }
      c.fillStyle = '#6b4a2b'; c.beginPath(); c.arc(cx, cy, T * 0.36, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c99a5a'; c.beginPath(); c.arc(cx, cy, T * 0.27, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#6b4a2b'; c.lineWidth = Math.max(1, T * 0.04);
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(cx + DX[k] * T * 0.1, cy + DY[k] * T * 0.1); c.lineTo(cx + DX[k] * T * 0.25, cy + DY[k] * T * 0.25); c.stroke(); }
    } else if (t === DOOR) {
      const vertical = g.tile(x - 1, y) === WALL;
      c.fillStyle = L.face;
      if (vertical) { c.fillRect(X, Y, T * 0.12, T); c.fillRect(X + T * 0.88, Y, T * 0.12, T); } else { c.fillRect(X, Y, T, T * 0.12); c.fillRect(X, Y + T * 0.88, T, T * 0.12); }
    } else if (t === LOCKED) {
      c.fillStyle = '#7a4e2a'; c.fillRect(X + T * 0.06, Y + T * 0.06, T * 0.88, T * 0.88);
      c.strokeStyle = '#4a2e18'; c.lineWidth = Math.max(1, T * 0.05); for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(X + T * 0.06 + k * T * 0.22, Y + T * 0.08); c.lineTo(X + T * 0.06 + k * T * 0.22, Y + T * 0.92); c.stroke(); }
      c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(cx, cy, T * 0.13, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a2e18'; c.beginPath(); c.arc(cx, cy - T * 0.02, T * 0.04, 0, Math.PI * 2); c.fill(); c.fillRect(cx - T * 0.015, cy, T * 0.03, T * 0.07);
    } else if (t === STAIRS) {
      const art = this.img('stairs'); if (art) { c.drawImage(art, X, Y, T, T); } else {
        c.fillStyle = '#1a100a'; c.fillRect(X + T * 0.1, Y + T * 0.1, T * 0.8, T * 0.8);
        for (let k = 0; k < 4; k++) { c.fillStyle = ['#c79a63', '#a77d4c', '#86613a', '#664829'][k]; c.fillRect(X + T * (0.12 + k * 0.04), Y + T * (0.14 + k * 0.19), T * (0.76 - k * 0.08), T * 0.13); }
      }
      const glow = 0.5 + Math.sin(this.clock * 3) * 0.25;
      c.strokeStyle = `rgba(255,228,138,${glow})`; c.lineWidth = 2; c.strokeRect(X + 2, Y + 2, T - 4, T - 4);
    } else if (t === CHEST) {
      const art = this.img('chest'); if (art) { c.drawImage(art, X, Y - T * 0.1, T, T * 1.05); return; }
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx, Y + T * 0.85, T * 0.36, T * 0.08, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9a5f2c'; c.fillRect(X + T * 0.16, Y + T * 0.38, T * 0.68, T * 0.44);
      c.fillStyle = '#b8743a'; c.beginPath(); c.moveTo(X + T * 0.16, Y + T * 0.4); c.quadraticCurveTo(cx, Y + T * 0.1, X + T * 0.84, Y + T * 0.4); c.fill();
      c.fillStyle = '#ffd24a'; c.fillRect(X + T * 0.16, Y + T * 0.38, T * 0.68, T * 0.06); c.fillRect(cx - T * 0.06, Y + T * 0.42, T * 0.12, T * 0.14);
    }
  }
  private spikesUp(g: DungeonGame) { for (let i = 0; i < W * H; i++) if (g.tiles[i] === SPIKE) return true; return false; }
  private wall(g: DungeonGame, x: number, y: number, L: (typeof LOOK)[number]) {
    const c = this.c, T = this.T, X = this.sx(x), Y = this.sy(y), i = y * W + x;
    const below = g.tile(x, y + 1) !== WALL && y + 1 < H;
    const top = T * (below ? 0.62 : 1);
    c.fillStyle = L.top; c.fillRect(X, Y - T * 0.2, T + 0.5, top + T * 0.2 + 0.5);
    // bricks or roots on the top
    c.fillStyle = 'rgba(255,255,255,.06)';
    if (rnd(i, 1) < 0.5) c.fillRect(X + T * 0.1, Y - T * 0.12, T * 0.4, T * 0.18);
    if (rnd(i, 2) < 0.4) c.fillRect(X + T * 0.5, Y + T * 0.2, T * 0.38, T * 0.16);
    if (below) {
      const gr = c.createLinearGradient(0, Y + top, 0, Y + T);
      gr.addColorStop(0, L.face); gr.addColorStop(1, L.line);
      c.fillStyle = gr; c.fillRect(X, Y + top, T + 0.5, T - top + 0.5);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(X, Y + T, T, T * 0.14);
      if (g.area === 0 && rnd(i, 3) < 0.35) { c.strokeStyle = L.accent; c.globalAlpha = 0.55; c.lineWidth = Math.max(1, T * 0.04); c.beginPath(); c.moveTo(X + T * rnd(i, 4), Y + top); c.quadraticCurveTo(X + T * 0.5, Y + T * 0.8, X + T * rnd(i, 5), Y + T); c.stroke(); c.globalAlpha = 1; }
      if (g.area === 1 && rnd(i, 3) < 0.3) { c.fillStyle = ['#e07a5f', '#f2cc8f', '#81b29a'][Math.floor(rnd(i, 6) * 3)]; c.globalAlpha = 0.8; c.fillRect(X + T * 0.3, Y + top + T * 0.04, T * 0.4, T * 0.28); c.globalAlpha = 1; }
      if (g.area === 2 && rnd(i, 3) < 0.15) { const lx = X + T / 2, ly = Y + top + T * 0.15; const gl = c.createRadialGradient(lx, ly, 1, lx, ly, T * 0.9); gl.addColorStop(0, 'rgba(255,197,107,.45)'); gl.addColorStop(1, 'rgba(255,197,107,0)'); c.fillStyle = gl; c.fillRect(lx - T, ly - T, T * 2, T * 2); c.fillStyle = '#ffc56b'; c.fillRect(lx - T * 0.06, ly - T * 0.08, T * 0.12, T * 0.16); }
    }
    c.strokeStyle = L.line; c.lineWidth = 1; c.strokeRect(X + 0.5, Y - T * 0.2 + 0.5, T, top + T * 0.2);
  }
  private mark(x: number, y: number, pulse: number, mine: boolean) {
    const c = this.c, T = this.T, X = this.sx(x), Y = this.sy(y);
    c.fillStyle = `rgba(255,122,92,${0.2 + pulse * 0.2})`; c.fillRect(X + 1, Y + 1, T - 2, T - 2);
    c.strokeStyle = DANGER; c.lineWidth = mine ? 3 : 2; c.setLineDash([6, 4]); c.lineDashOffset = -this.clock * 12;
    c.strokeRect(X + 3, Y + 3, T - 6, T - 6); c.setLineDash([]);
    // a little starburst: something will bop here
    const cx = X + T / 2, cy = Y + T / 2, r = T * 0.16;
    c.fillStyle = 'rgba(255,240,220,.85)'; c.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, rr = k % 2 ? r * 0.45 : r; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  private cloud(x: number, y: number) {
    const c = this.c, T = this.T, cx = this.sx(x) + T / 2, cy = this.sy(y) + T / 2;
    c.fillStyle = 'rgba(225,218,205,.6)';
    for (let k = 0; k < 6; k++) { const a = this.clock * 0.6 + k; c.beginPath(); c.arc(cx + Math.cos(a) * T * 0.2, cy + Math.sin(a * 1.3) * T * 0.15, T * (0.2 + (k % 3) * 0.05), 0, Math.PI * 2); c.fill(); }
  }
  private item(it: Item, x: number, y: number) {
    const c = this.c, T = this.T, cx = this.sx(x) + T / 2, cy = this.sy(y) + T / 2 + Math.sin(this.clock * 3 + x) * T * 0.04;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(cx, this.sy(y) + T * 0.82, T * 0.2, T * 0.06, 0, 0, Math.PI * 2); c.fill();
    const glow = c.createRadialGradient(cx, cy, 1, cx, cy, T * 0.5); glow.addColorStop(0, 'rgba(255,240,170,.35)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = glow; c.fillRect(cx - T / 2, cy - T / 2, T, T);
    this.icon(it, cx, cy, T * 0.62);
  }
  /** A tool, key or heart charm: painted if it has loaded, else drawn. Public so the page can reuse it nowhere else. */
  icon(it: Item, cx: number, cy: number, s: number, c = this.c) {
    const art = this.img(it === 'key' ? 'key' : it === 'heart' ? 'heart' : `tool-${it}`);
    if (art) { c.drawImage(art, cx - s / 2, cy - s / 2, s, s); return; }
    c.save(); c.translate(cx, cy); c.scale(s / 24, s / 24); c.lineCap = 'round'; c.lineJoin = 'round';
    if (it === 'key') { c.strokeStyle = '#e8b32c'; c.lineWidth = 3; c.beginPath(); c.arc(-5, 0, 4.5, 0, Math.PI * 2); c.moveTo(-0.5, 0); c.lineTo(9, 0); c.moveTo(6, 0); c.lineTo(6, 4); c.moveTo(9, 0); c.lineTo(9, 3); c.stroke(); }
    else if (it === 'heart') { c.fillStyle = '#ff7f9c'; c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-12, -1, -6, -10, 0, -4); c.bezierCurveTo(6, -10, 12, -1, 0, 8); c.fill(); c.fillStyle = '#ffd0dc'; c.beginPath(); c.arc(-4, -3, 2, 0, Math.PI * 2); c.fill(); }
    else if (it === 'acorn') { c.fillStyle = '#c47b3a'; c.beginPath(); c.ellipse(0, 3, 6, 7, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#7a4b26'; c.beginPath(); c.ellipse(0, -3, 8, 4.5, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5a3418'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -7); c.lineTo(1.5, -10); c.stroke(); }
    else if (it === 'duster') { c.strokeStyle = '#8a5a2b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-8, 9); c.lineTo(1, 0); c.stroke(); c.fillStyle = '#ff9ac0'; for (let k = 0; k < 5; k++) { c.save(); c.translate(3, -2); c.rotate(-0.9 + k * 0.4); c.beginPath(); c.ellipse(0, -6, 2.6, 7, 0, 0, Math.PI * 2); c.fill(); c.restore(); } }
    else if (it === 'sling') { c.strokeStyle = '#8a5a2b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 10); c.lineTo(0, 1); c.lineTo(-6, -8); c.moveTo(0, 1); c.lineTo(6, -8); c.stroke(); c.strokeStyle = '#d9c3a0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(0, -2, 6, -8); c.stroke(); c.fillStyle = '#9aa2ad'; c.beginPath(); c.arc(0, -4, 2.6, 0, Math.PI * 2); c.fill(); }
    else if (it === 'soap') { c.fillStyle = '#b8e6ff'; c.beginPath(); c.arc(-3, 2, 7, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(6, -5, 4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-5, -1, 2, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7cc6ff'; c.lineWidth = 1; c.beginPath(); c.arc(-3, 2, 7, 0, Math.PI * 2); c.stroke(); }
    else if (it === 'lantern') { c.fillStyle = '#6b4a2b'; c.fillRect(-6, -9, 12, 3); c.fillRect(-6, 7, 12, 3); c.fillStyle = '#ffd27a'; c.fillRect(-5, -6, 10, 13); c.fillStyle = '#fff5cf'; c.beginPath(); c.ellipse(0, 1, 2.5, 4, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -11, 3, Math.PI, 0); c.stroke(); }
    c.restore();
  }
  private crate(x: number, y: number) {
    const c = this.c, T = this.T, X = this.sx(x), Y = this.sy(y);
    const art = this.img('crate'); if (art) { c.drawImage(art, X, Y - T * 0.15, T, T * 1.1); return; }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(X + T * 0.1, Y + T * 0.78, T * 0.84, T * 0.14);
    c.fillStyle = '#a8763f'; c.fillRect(X + T * 0.1, Y + T * 0.1, T * 0.8, T * 0.72);
    c.fillStyle = '#c99a5a'; c.fillRect(X + T * 0.1, Y + T * 0.1, T * 0.8, T * 0.14);
    c.strokeStyle = '#6b4520'; c.lineWidth = Math.max(1.5, T * 0.06); c.strokeRect(X + T * 0.13, Y + T * 0.13, T * 0.74, T * 0.66);
    c.beginPath(); c.moveTo(X + T * 0.15, Y + T * 0.77); c.lineTo(X + T * 0.85, Y + T * 0.16); c.stroke();
  }

  // ---------------------------------------------------------------- creatures and their plans
  private intent(g: DungeonGame, e: Enemy) {
    const c = this.c, T = this.T, it = e.intent, p = this.place(e.id, e.x, e.y), ex = this.sx(p.x) + T / 2, ey = this.sy(p.y) + T / 2;
    if (e.hidden) return;
    const arrow = (ax: number, ay: number, bx: number, by: number, color: string, dash = false) => {
      const a = Math.atan2(by - ay, bx - ax);
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = Math.max(2, T * 0.07); c.lineCap = 'round';
      if (dash) c.setLineDash([T * 0.12, T * 0.1]);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx - Math.cos(a) * T * 0.12, by - Math.sin(a) * T * 0.12); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - Math.cos(a - 0.5) * T * 0.22, by - Math.sin(a - 0.5) * T * 0.22); c.lineTo(bx - Math.cos(a + 0.5) * T * 0.22, by - Math.sin(a + 0.5) * T * 0.22); c.closePath(); c.fill();
    };
    const tx = (i: number) => this.sx(i % W) + T / 2, ty = (i: number) => this.sy(Math.floor(i / W)) + T / 2;
    c.save(); c.globalAlpha = 0.9;
    switch (it.kind) {
      case 'move': arrow(ex + (tx(it.to) - ex) * 0.25, ey + (ty(it.to) - ey) * 0.25, ex + (tx(it.to) - ex) * 0.8, ey + (ty(it.to) - ey) * 0.8, 'rgba(255,250,235,.75)'); break;
      case 'tunnel': arrow(ex, ey + T * 0.2, tx(it.to), ty(it.to) + T * 0.2, 'rgba(170,130,90,.85)', true); break;
      case 'hit': case 'sweep': if (it.tiles.length) { const t0 = it.tiles[0]; arrow(ex + (tx(t0) - ex) * 0.2, ey + (ty(t0) - ey) * 0.2, ex + (tx(t0) - ex) * 0.62, ey + (ty(t0) - ey) * 0.62, DANGER); } break;
      case 'jump': {
        c.strokeStyle = DANGER; c.lineWidth = Math.max(2, T * 0.06); c.setLineDash([T * 0.1, T * 0.1]);
        c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo((ex + tx(it.to)) / 2, Math.min(ey, ty(it.to)) - T * 1.1, tx(it.to), ty(it.to)); c.stroke(); c.setLineDash([]);
        break;
      }
      case 'roll': if (it.tiles.length) arrow(ex, ey, tx(it.tiles[it.tiles.length - 1]), ty(it.tiles[it.tiles.length - 1]), DANGER); break;
      case 'puff': arrow(ex, ey, tx(it.to), ty(it.to), 'rgba(230,220,205,.9)', true); break;
      case 'sneeze': for (const t of it.tiles) { const bx = tx(t), by = ty(t); arrow(bx - DX[it.dir] * T * 0.25, by - DY[it.dir] * T * 0.25, bx + DX[it.dir] * T * 0.3, by + DY[it.dir] * T * 0.3, 'rgba(255,230,180,.95)'); } break;
      case 'emerge': { const bx = tx(it.to), by = ty(it.to); c.strokeStyle = '#5a3a1a'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { const a = k * 1.3; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * T * 0.35, by + Math.sin(a) * T * 0.3); c.stroke(); } break; }
      case 'summon': for (const t of it.tiles) { const bx = tx(t), by = ty(t); c.strokeStyle = '#ffe48a'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(bx, by, T * 0.3 + Math.sin(this.clock * 4) * 2, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); } break;
      case 'dig': c.fillStyle = '#ffe9c4'; c.font = `900 ${T * 0.32}px ${FONT}`; c.textAlign = 'center'; c.fillText('⤓', ex, ey - T * 0.62); break;
      case 'rest': this.bubble(ex, ey - T * 0.75, 'z z', '#cfe6ff'); break;
      default: break;
    }
    c.restore();
    void g; void HARMFUL;
  }
  private bubble(x: number, y: number, text: string, color: string) {
    const c = this.c, T = this.T;
    c.font = `900 ${Math.max(10, T * 0.28)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(20,12,8,.55)'; const w = c.measureText(text).width + T * 0.2; c.beginPath(); c.roundRect(x - w / 2, y - T * 0.18, w, T * 0.36, T * 0.18); c.fill();
    c.fillStyle = color; c.fillText(text, x, y + 1);
  }
  private enemy(e: Enemy, x: number, y: number) {
    const c = this.c, T = this.T, cx = this.sx(x) + T / 2, base = this.sy(y) + T * 0.86;
    const boss = KINDS[e.kind].boss, s = T * (boss ? 1.35 : 0.9);
    if (e.under) {
      c.fillStyle = '#6b4a2b'; c.beginPath(); c.ellipse(cx, base - T * 0.12, T * 0.34, T * 0.18, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#8a6440'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(cx - T * 0.18 + k * T * 0.18, base - T * 0.18 - (k % 2) * T * 0.06, T * 0.06, 0, Math.PI * 2); c.fill(); }
      return;
    }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(cx, base, s * 0.36, s * 0.1, 0, 0, Math.PI * 2); c.fill();
    const bob = e.intent.kind === 'rest' || e.hidden ? 0 : Math.abs(Math.sin(this.clock * 4 + e.id)) * T * 0.05;
    if (e.hidden) {
      const bale = this.img('bale');
      if (bale) c.drawImage(bale, cx - T * 0.5, base - T * 0.95, T, T);
      else this.drawBale(cx, base, T, false);
      if (e.known) { c.fillStyle = '#2b1d26'; for (const dx of [-0.12, 0.12]) { c.beginPath(); c.arc(cx + dx * T, base - T * 0.45, T * 0.04, 0, Math.PI * 2); c.fill(); } }
      return;
    }
    const art = this.img(`enemy-${e.kind}`);
    c.save();
    if (art) c.drawImage(art, cx - s / 2, base - s * 0.94 - bob, s, s);
    else this.drawFluff(e.kind, cx, base - bob, s);
    c.restore();
    if (e.dizzy || e.intent.kind === 'none' && e.awake && !e.fresh) {
      if (e.dizzy) for (let k = 0; k < 3; k++) { const a = this.clock * 4 + k * 2.1; c.fillStyle = '#ffe48a'; c.font = `${T * 0.22}px ${FONT}`; c.textAlign = 'center'; c.fillText('★', cx + Math.cos(a) * s * 0.3, base - s * 0.95 + Math.sin(a) * s * 0.08); }
    }
    // hearts left
    if (e.max > 1) {
      const n = e.max, r = Math.max(2.5, T * 0.06), w = n * r * 2.6;
      for (let k = 0; k < n; k++) { c.fillStyle = k < e.hp ? '#ff8f9f' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(cx - w / 2 + r * 1.3 + k * r * 2.6, base - s * 1.02, r, 0, Math.PI * 2); c.fill(); }
    }
  }
  private drawBale(cx: number, base: number, T: number, eyes: boolean) {
    const c = this.c;
    c.fillStyle = '#d9a83f'; c.beginPath(); c.roundRect(cx - T * 0.4, base - T * 0.78, T * 0.8, T * 0.74, T * 0.12); c.fill();
    c.fillStyle = '#f0c860'; c.beginPath(); c.roundRect(cx - T * 0.4, base - T * 0.78, T * 0.8, T * 0.2, T * 0.1); c.fill();
    c.strokeStyle = '#a87a2a'; c.lineWidth = Math.max(1, T * 0.03);
    for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(cx - T * 0.34 + k * T * 0.13, base - T * 0.55); c.lineTo(cx - T * 0.3 + k * T * 0.13, base - T * 0.1); c.stroke(); }
    c.strokeStyle = '#7a4b26'; c.lineWidth = Math.max(1.5, T * 0.05); c.beginPath(); c.moveTo(cx - T * 0.4, base - T * 0.4); c.lineTo(cx + T * 0.4, base - T * 0.4); c.stroke();
    if (eyes) {
      for (const dx of [-0.14, 0.14]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + dx * T, base - T * 0.55, T * 0.09, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2b1d26'; c.beginPath(); c.arc(cx + dx * T, base - T * 0.54, T * 0.05, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = '#5a3418'; c.lineWidth = 2; c.beginPath(); c.arc(cx, base - T * 0.36, T * 0.12, 0.2, Math.PI - 0.2); c.stroke();
    }
  }
  /** The drawn stand-in for each kind: a fluffy dust bunny with its own trimmings. */
  private drawFluff(kind: Kind, cx: number, base: number, s: number) {
    const c = this.c, [body, shade, trim] = BODY[kind];
    if (kind === 'mimic') { this.drawBale(cx, base, s, true); return; }
    const r = s * 0.36, cy = base - r * 1.05;
    // ears
    if (kind === 'hopper' || kind === 'bigbun' || kind === 'fluff' || kind === 'king') {
      const tall = kind === 'hopper' ? 1.5 : 0.8;
      for (const dx of [-0.45, 0.45]) { c.fillStyle = body; c.beginPath(); c.ellipse(cx + dx * r, cy - r * (0.75 + tall * 0.4), r * 0.2, r * 0.5 * tall, dx * 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = trim; c.beginPath(); c.ellipse(cx + dx * r, cy - r * (0.75 + tall * 0.4), r * 0.09, r * 0.34 * tall, dx * 0.3, 0, Math.PI * 2); c.fill(); }
    }
    // fluff around the edge
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.fillStyle = shade; c.beginPath(); c.arc(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.74, r * 0.32, 0, Math.PI * 2); c.fill(); }
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, body); g.addColorStop(1, shade);
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, r * 0.9, r * 0.82, 0, 0, Math.PI * 2); c.fill();
    if (kind === 'roller') { c.strokeStyle = shade; c.lineWidth = r * 0.08; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(cx, cy, r * (0.3 + k * 0.2), this.clock * 3 + k, this.clock * 3 + k + 2.5); c.stroke(); } }
    // face
    const eyeY = cy - r * 0.06;
    c.fillStyle = '#2b1d26'; for (const dx of [-0.3, 0.3]) { c.beginPath(); c.ellipse(cx + dx * r, eyeY, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fff'; for (const dx of [-0.26, 0.34]) { c.beginPath(); c.arc(cx + dx * r, eyeY - r * 0.06, r * 0.045, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,120,150,.4)'; for (const dx of [-0.5, 0.5]) { c.beginPath(); c.ellipse(cx + dx * r, cy + r * 0.2, r * 0.13, r * 0.07, 0, 0, Math.PI * 2); c.fill(); }
    // a grumpy little brow
    c.strokeStyle = '#2b1d26'; c.lineWidth = Math.max(1, r * 0.06); c.beginPath(); c.moveTo(cx - r * 0.42, eyeY - r * 0.25); c.lineTo(cx - r * 0.18, eyeY - r * 0.18); c.moveTo(cx + r * 0.42, eyeY - r * 0.25); c.lineTo(cx + r * 0.18, eyeY - r * 0.18); c.stroke();
    if (kind === 'puffer') { c.fillStyle = trim; for (const dx of [-0.62, 0.62]) { c.beginPath(); c.arc(cx + dx * r, cy + r * 0.12, r * 0.24, 0, Math.PI * 2); c.fill(); } }
    if (kind === 'sneezer') { c.fillStyle = trim; c.beginPath(); c.ellipse(cx, cy + r * 0.2, r * 0.18, r * 0.13, 0, 0, Math.PI * 2); c.fill(); }
    if (kind === 'burrower') { c.fillStyle = '#ffcc33'; c.beginPath(); c.ellipse(cx, cy - r * 0.62, r * 0.6, r * 0.32, 0, Math.PI, 0); c.fill(); c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(cx, cy - r * 0.78, r * 0.1, 0, Math.PI * 2); c.fill(); }
    if (kind === 'foreman') { c.fillStyle = '#ffcc33'; c.beginPath(); c.ellipse(cx, cy - r * 0.6, r * 0.75, r * 0.4, 0, Math.PI, 0); c.fill(); c.fillRect(cx - r * 0.9, cy - r * 0.62, r * 1.8, r * 0.1); c.fillStyle = '#ff9fb6'; c.beginPath(); c.ellipse(cx, cy + r * 0.24, r * 0.16, r * 0.11, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7a5a3a'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(cx + r * 0.9, cy + r * 0.6); c.lineTo(cx + r * 1.2, cy - r * 0.6); c.stroke(); c.fillStyle = '#9aa2ad'; c.beginPath(); c.ellipse(cx + r * 1.22, cy - r * 0.72, r * 0.18, r * 0.25, 0.3, 0, Math.PI * 2); c.fill(); }
    if (kind === 'bigbun') { c.fillStyle = trim; c.beginPath(); c.moveTo(cx + r * 0.35, cy - r * 0.7); c.lineTo(cx + r * 0.75, cy - r * 0.95); c.lineTo(cx + r * 0.75, cy - r * 0.5); c.closePath(); c.moveTo(cx + r * 0.35, cy - r * 0.7); c.lineTo(cx - r * 0.05, cy - r * 0.95); c.lineTo(cx - r * 0.05, cy - r * 0.5); c.closePath(); c.fill(); }
    if (kind === 'king') {
      c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(cx - r * 0.5, cy - r * 0.7); c.lineTo(cx - r * 0.5, cy - r * 1.15); c.lineTo(cx - r * 0.25, cy - r * 0.9); c.lineTo(cx, cy - r * 1.25); c.lineTo(cx + r * 0.25, cy - r * 0.9); c.lineTo(cx + r * 0.5, cy - r * 1.15); c.lineTo(cx + r * 0.5, cy - r * 0.7); c.closePath(); c.fill();
      c.fillStyle = '#ff6b8a'; c.beginPath(); c.arc(cx, cy - r * 0.9, r * 0.08, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8a3a6a'; c.beginPath(); c.moveTo(cx - r * 0.9, cy + r * 0.2); c.quadraticCurveTo(cx, cy + r * 1.1, cx + r * 0.9, cy + r * 0.2); c.lineTo(cx + r * 0.8, cy + r * 0.75); c.lineTo(cx - r * 0.8, cy + r * 0.75); c.closePath(); c.fill();
    }
    // little feet
    c.fillStyle = shade; for (const dx of [-0.35, 0.35]) { c.beginPath(); c.ellipse(cx + dx * r, base - r * 0.12, r * 0.22, r * 0.12, 0, 0, Math.PI * 2); c.fill(); }
  }
  private hero(g: DungeonGame, x: number, y: number, char: 'dora' | 'enzo') {
    const c = this.c, T = this.T, cx = this.sx(x) + T / 2, base = this.sy(y) + T * 0.88;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx, base, T * 0.34, T * 0.1, 0, 0, Math.PI * 2); c.fill();
    const sw = this.clock - this.swing.t, swinging = sw < 0.2;
    const lean = swinging ? Math.sin((sw / 0.2) * Math.PI) * T * 0.15 : 0;
    const art = this.img(`player-${char}`);
    const ox = DX[this.swing.d] * lean, oy = DY[this.swing.d] * lean;
    if (art) {
      const s = T * 1.15; c.save(); c.translate(cx + ox, base + oy); if (g.side < 0) c.scale(-1, 1); c.drawImage(art, -s / 2, -s * 0.95, s, s); c.restore();
    } else drawChinchilla(c, char, cx + ox - g.side * T * 0.05, base + oy, { face: g.side, h: T * 0.72, time: this.clock, moving: this.clock - (this.pos.get(-1)?.t ?? -9) < 0.15, blink: this.clock % 3.7 < 0.12 });
    if (swinging) {
      // the broom's swish
      const a0 = Math.atan2(DY[this.swing.d], DX[this.swing.d]);
      c.strokeStyle = `rgba(255,248,220,${1 - sw / 0.2})`; c.lineWidth = T * 0.08; c.lineCap = 'round';
      c.beginPath(); c.arc(cx, base - T * 0.35, T * 0.62, a0 - 0.7, a0 + 0.7); c.stroke();
    }
  }
  private effects(dt: number) {
    const c = this.c, T = this.T;
    for (const s of this.sparks) {
      s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.92; s.vy = s.vy * 0.92 + (s.kind === 'dust' ? -0.3 : 1.2) * dt;
      const k = 1 - s.life / s.max; if (k <= 0) continue;
      const X = this.sx(s.x), Y = this.sy(s.y);
      c.globalAlpha = k;
      if (s.kind === 'dust') { c.fillStyle = s.color; c.beginPath(); c.arc(X, Y, s.size * T * (1.4 - k * 0.6), 0, Math.PI * 2); c.fill(); }
      else if (s.kind === 'heart') { c.fillStyle = s.color; c.font = `${T * 0.3}px ${FONT}`; c.textAlign = 'center'; c.fillText('♥', X, Y); }
      else { c.fillStyle = s.color; c.beginPath(); const r = s.size * T; for (let q = 0; q < 8; q++) { const a = (q / 8) * Math.PI * 2, rr = q % 2 ? r * 0.4 : r; c.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
    }
    c.globalAlpha = 1;
    this.sparks = this.sparks.filter((s) => s.life < s.max);
    for (const b of this.beams) {
      const k = (this.clock - b.born) / 0.35; if (k > 1) continue;
      const X0 = this.sx(b.x), Y0 = this.sy(b.y), X1 = this.sx(b.tx), Y1 = this.sy(b.ty);
      c.globalAlpha = 1 - k;
      if (b.kind === 'shot') { const px = X0 + (X1 - X0) * Math.min(1, k * 2), py = Y0 + (Y1 - Y0) * Math.min(1, k * 2); c.fillStyle = '#9aa2ad'; c.beginPath(); c.arc(px, py, T * 0.08, 0, Math.PI * 2); c.fill(); }
      else if (b.kind === 'soap') { for (let q = 0; q < 6; q++) { const f = (q / 6 + k) % 1; c.strokeStyle = '#b8e6ff'; c.lineWidth = 2; c.beginPath(); c.arc(X0 + (X1 - X0) * f, Y0 + (Y1 - Y0) * f + Math.sin(q * 2 + k * 6) * T * 0.15, T * (0.08 + (q % 3) * 0.04), 0, Math.PI * 2); c.stroke(); } }
      else if (b.kind === 'sneeze' || b.kind === 'gust') { c.strokeStyle = b.kind === 'gust' ? '#ffffff' : '#ffe9c4'; c.lineWidth = 2; for (let q = -1; q <= 1; q++) { const ox = -DY[b.d] * q * T * 0.18, oy = DX[b.d] * q * T * 0.18; c.beginPath(); c.moveTo(X0 + ox, Y0 + oy); c.lineTo(X0 + (X1 - X0) * k + ox, Y0 + (Y1 - Y0) * k + oy); c.stroke(); } }
      else if (b.kind === 'puff') { c.fillStyle = '#e6dfd4'; const px = X0 + (X1 - X0) * Math.min(1, k * 1.6), py = Y0 + (Y1 - Y0) * Math.min(1, k * 1.6); c.beginPath(); c.arc(px, py, T * 0.15, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    this.beams = this.beams.filter((b) => this.clock - b.born < 0.35);
    for (const p of this.pops) {
      const k = (this.clock - p.born) / 0.9; if (k > 1) continue;
      c.globalAlpha = Math.min(1, (1 - k) * 2);
      c.font = `900 ${Math.max(12, T * 0.34)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const X = this.sx(p.x), Y = this.sy(p.y) - k * T * 0.6;
      c.lineWidth = 4; c.strokeStyle = 'rgba(40,20,10,.8)'; c.strokeText(p.text, X, Y); c.fillStyle = p.color; c.fillText(p.text, X, Y);
    }
    c.globalAlpha = 1;
    this.pops = this.pops.filter((p) => this.clock - p.born < 0.9);
  }
  private minimap(g: DungeonGame, L: (typeof LOOK)[number]) {
    const c = this.c, s = this.w < 600 ? 2.4 : 3.2, mw = W * s, X = this.w - mw - 12, Y = 12;
    c.fillStyle = 'rgba(20,12,8,.72)'; c.beginPath(); c.roundRect(X - 6, Y - 6, mw + 12, mw + 12, 10); c.fill();
    for (let i = 0; i < W * H; i++) {
      if (!g.seen[i]) continue;
      const t = g.tiles[i], x = i % W, y = Math.floor(i / W);
      c.fillStyle = t === WALL ? L.top : t === PIT ? '#000' : t === SPIKE ? '#7fa35a' : t === STAIRS ? '#ffe48a' : t === LOCKED || t === CHEST ? '#ffd24a' : 'rgba(240,220,190,.55)';
      c.fillRect(X + x * s, Y + y * s, s + 0.2, s + 0.2);
    }
    for (const e of g.enemies) if (g.seen[e.y * W + e.x] && !e.hidden && !e.under) { c.fillStyle = KINDS[e.kind].boss ? '#ff6b8a' : '#ff9a7a'; c.fillRect(X + e.x * s - 0.5, Y + e.y * s - 0.5, s + 1, s + 1); }
    if (g.stairs >= 0 && g.seen[g.stairs]) { c.strokeStyle = '#ffe48a'; c.lineWidth = 1.5; c.strokeRect(X + (g.stairs % W) * s - 2, Y + Math.floor(g.stairs / W) * s - 2, s + 4, s + 4); }
    c.fillStyle = '#7fe0ff'; c.beginPath(); c.arc(X + g.px * s + s / 2, Y + g.py * s + s / 2, s * 1.1, 0, Math.PI * 2); c.fill();
  }
  /** The minimap's box, so the page can keep its buttons clear of it. */
  minimapBox() { const s = this.w < 600 ? 2.4 : 3.2; return { w: W * s + 12, y: 12 }; }
}

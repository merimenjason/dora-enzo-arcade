// Burrow Command's battlefield in Canvas 2D: a painted meadow seen from above at a slight angle, units and buildings standing
// up out of it, fog, flying pebbles and lids, poofs, the selection and the minimap. Drawing only: the rules live in
// command-game.ts. Every painting comes from public/art/command/ and a drawn stand-in shows until (or unless) it loads.
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import { T, GRASS, WATER, TREE, ROCK, DIRT, BUILDINGS, UNITS, hash2, type World, type Unit, type Building, type Node, type Ev, type SideId } from './command-game';

const ART = '/art/command/';
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** Pixels a tile spans at zoom 1. */
export const TILE = 40;
/** Coats for the colony's units when their paintings have not loaded. */
const COATS: Record<string, Coat> = {
  gatherer: coatLike('dora', { fur: '#ead8b8', back: '#d8c09a', face: '#f3e6cf', tail: '#ecdcc0' }),
  slinger: coatLike('enzo', { fur: '#c8c2bb', back: '#a9a29a', face: '#dad5cf' }),
  fluffguard: coatLike('enzo', { fur: '#6f6a64', back: '#57524d', face: '#8c867f' }),
  puffer: coatLike('enzo', { fur: '#c6bfd0', back: '#a99fb6', face: '#dcd5e3' }),
  glider: coatLike('enzo', { fur: '#d2ccc4', back: '#b3aca4' }),
  digger: coatLike('enzo', { fur: '#8a7a6a', back: '#6f6052', face: '#a39383' }),
};
const SHOT_COLOR: Record<string, string> = { pebble: '#9a9184', dust: '#f1dca0', lid: '#d8dde3', oil: '#8a4fa8', acorn: '#8a5a2b', apple: '#d8543a', spark: '#7fd6ff', seed: '#ffd86b' };

type Shot = { x: number; y: number; tx: number; ty: number; shot: string; t: number; dur: number; air: boolean };
type Puff = { x: number; y: number; t: number; big: number; color: string; kind: 'poof' | 'tidy' | 'hit' | 'tunnel' | 'trap' | 'ring' | 'text'; text?: string; r?: number };
export type Overlay = {
  me: number; sel: Set<number>; hover: number;
  box: [number, number, number, number] | null;
  ghost: { type: string; tx: number; ty: number; ok: boolean } | null;
  marks: { x: number; y: number; t: number; color: string }[];
  /** A targeted ability or order waiting for a click: draws its reach round the cursor. */
  aim: { x: number; y: number; r: number } | null;
};

export class CommandScene {
  private c: CanvasRenderingContext2D;
  w = 0; h = 0; private dpr = 1;
  /** Camera: top-left in world-pixels at the current zoom, and the zoom. */
  cam = { x: 0, y: 0, z: 1 };
  /** Pixels hidden under the HUD at the top and bottom, so the camera can still reach the map's edges. */
  padTop = 0; padBottom = 0;
  private imgs = new Map<string, HTMLImageElement>();
  private cache = new Map<string, HTMLCanvasElement>();
  private ground: HTMLCanvasElement | null = null; private groundFor: World | null = null; private groundArt = 0;
  private fog: HTMLCanvasElement | null = null; private fogData: ImageData | null = null; private fogAt = -1;
  private shots: Shot[] = []; private puffs: Puff[] = [];
  private time = 0;
  /** Seconds since each piece was last bumped, for the flash. */
  private hurt = new Map<number, number>();
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
  }
  /** Loads a painting by name; returns it once it has arrived. */
  img(name: string) {
    let i = this.imgs.get(name);
    if (!i) { i = new Image(); i.decoding = 'async'; i.src = `${ART}${name}.webp`; this.imgs.set(name, i); }
    return i.complete && i.naturalWidth > 0 ? i : null;
  }
  /** Starts loading everything a match needs. */
  preload(w: World) {
    for (const n of ['tex-grass', 'tex-dirt', 'tex-water', 'deco-tree', 'deco-bush', 'deco-boulder', 'res-hay', 'res-glimmer', 'fx-trap']) this.img(n);
    const sides = new Set(w.players.map((p) => p.side));
    for (const d of Object.values(UNITS)) if (sides.has(d.side) && d.id !== 'wagon') this.img(`unit-${d.side}-${d.id}`);
    for (const d of Object.values(BUILDINGS)) if (sides.has(d.side)) this.img(`bld-${d.side}-${d.id}`);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(200, r.width); this.h = Math.max(200, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
  }
  get tp() { return TILE * this.cam.z; }
  /** World units to screen pixels. */
  sx(wx: number) { return (wx / T) * this.tp - this.cam.x; }
  sy(wy: number) { return (wy / T) * this.tp - this.cam.y; }
  /** Screen pixels to world units. */
  wx(px: number) { return Math.round(((px + this.cam.x) / this.tp) * T); }
  wy(py: number) { return Math.round(((py + this.cam.y) / this.tp) * T); }
  /** Centres the camera on a world point. */
  look(w: World, x: number, y: number) { this.cam.x = (x / T) * this.tp - this.w / 2; this.cam.y = (y / T) * this.tp - (this.padTop + this.h - this.padBottom) / 2; this.clamp(w); }
  pan(w: World, dx: number, dy: number) { this.cam.x += dx; this.cam.y += dy; this.clamp(w); }
  zoom(w: World, f: number, px = this.w / 2, py = this.h / 2) {
    const z = Math.max(0.55, Math.min(1.8, this.cam.z * f)), wx = (px + this.cam.x) / this.tp, wy = (py + this.cam.y) / this.tp;
    this.cam.z = z; this.cam.x = wx * this.tp - px; this.cam.y = wy * this.tp - py; this.clamp(w);
  }
  clamp(w: World) {
    const mw = w.W * this.tp, mh = w.H * this.tp, pad = 60;
    this.cam.x = mw + pad * 2 < this.w ? (mw - this.w) / 2 : Math.max(-pad, Math.min(mw - this.w + pad, this.cam.x));
    const top = pad + this.padTop, bottom = pad + this.padBottom, view = this.h - this.padTop - this.padBottom;
    this.cam.y = mh + pad * 2 < view ? (mh - this.h + this.padBottom - this.padTop) / 2 : Math.max(-top, Math.min(mh - this.h + bottom, this.cam.y));
  }

  /** Feed the match's events in as they happen. */
  feed(w: World, evs: Ev[], me: number) {
    const team = w.players[me].team;
    const vis = (x: number, y: number) => w.seen(team, x, y);
    for (const e of evs) {
      switch (e.k) {
        case 'shot': if (vis(e.x, e.y) || vis(e.tx, e.ty)) { const d = Math.hypot(e.tx - e.x, e.ty - e.y) / T; this.shots.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, shot: e.shot, t: 0, dur: Math.min(0.45, 0.08 + d * 0.06), air: e.air }); } break;
        case 'hit': this.hurt.set(e.id, this.time); break;
        case 'poof': if (vis(e.x, e.y)) this.puffs.push({ x: e.x, y: e.y - (e.air ? T / 2 : 0), t: 0, big: 1, color: '#f4ead8', kind: 'poof' }); break;
        case 'tidy': if (vis(e.x, e.y)) this.puffs.push({ x: e.x, y: e.y, t: 0, big: e.size, color: '#d9c7a6', kind: 'tidy' }); break;
        case 'tunnel': if (vis(e.x, e.y)) this.puffs.push({ x: e.x, y: e.y, t: 0, big: 0.6, color: '#a07a50', kind: 'tunnel' }); break;
        case 'trap': if (vis(e.x, e.y)) this.puffs.push({ x: e.x, y: e.y, t: 0, big: 0.7, color: '#f2b84b', kind: 'trap' }); break;
        case 'ability': if (vis(e.x, e.y)) this.puffs.push({ x: e.x, y: e.y, t: 0, big: 1, color: e.ab === 'overwind' ? '#7fe0d0' : e.ab === 'song' ? '#ffd86b' : e.ab === 'firm' ? '#9fc8ff' : e.ab === 'shiny' ? '#fff4b0' : '#f1dca0', kind: 'ring', r: e.r }); break;
        case 'drop': if (e.owner === me) this.puffs.push({ x: e.x, y: e.y - T, t: 0, big: 1, color: e.res === 'hay' ? '#ffe08a' : '#9ff0e6', kind: 'text', text: `+${e.amt}` }); break;
        case 'salvage': if (e.owner === me) this.puffs.push({ x: e.x, y: e.y - T / 2, t: 0, big: 1, color: '#d6b8ff', kind: 'text', text: `+${e.hay + e.glimmer}` }); break;
      }
    }
    if (this.shots.length > 300) this.shots.splice(0, this.shots.length - 300);
    if (this.puffs.length > 200) this.puffs.splice(0, this.puffs.length - 200);
  }

  // ---------------------------------------------------------------- the ground, baked once per match
  private bake(w: World) {
    const px = 24, cv = document.createElement('canvas'); cv.width = w.W * px; cv.height = w.H * px;
    const c = cv.getContext('2d')!;
    const grass = this.img('tex-grass'), dirt = this.img('tex-dirt'), water = this.img('tex-water');
    this.groundArt = (grass ? 1 : 0) + (dirt ? 2 : 0) + (water ? 4 : 0) + (this.img('deco-tree') ? 8 : 0) + (this.img('deco-boulder') ? 16 : 0) + (this.img('deco-bush') ? 32 : 0);
    const pattern = (im: HTMLImageElement | null, fallback: string, scale: number) => {
      if (!im) return fallback;
      const p = c.createPattern(im, 'repeat')!; p.setTransform(new DOMMatrix().scale(scale)); return p;
    };
    c.fillStyle = pattern(grass, '#7fb35a', (px * 10) / 512); c.fillRect(0, 0, cv.width, cv.height);
    if (!grass) for (let j = 0; j < w.H; j++) for (let i = 0; i < w.W; i++) {
      const n = hash2(i, j, 3); c.fillStyle = n < 0.33 ? '#86ba60' : n < 0.66 ? '#79ad55' : '#82b45c'; c.fillRect(i * px, j * px, px, px);
      if (n > 0.86) { c.fillStyle = n > 0.95 ? '#f7f1d8' : '#f4c9d8'; c.beginPath(); c.arc(i * px + px * hash2(i, j, 4), j * px + px * hash2(i, j, 5), 1.6, 0, 6.3); c.fill(); }
    }
    const fillTiles = (code: number, style: string | CanvasPattern, round: number) => {
      c.fillStyle = style;
      for (let j = 0; j < w.H; j++) for (let i = 0; i < w.W; i++) if (w.terrain[j * w.W + i] === code) {
        c.beginPath(); c.arc(i * px + px / 2, j * px + px / 2, px * round, 0, Math.PI * 2); c.fill(); c.fillRect(i * px + px * 0.1, j * px + px * 0.1, px * 0.8, px * 0.8);
      }
    };
    fillTiles(DIRT, pattern(dirt, '#c8a878', (px * 6) / 512), 0.72);
    // ponds: a sandy rim, then water
    fillTiles(WATER, '#d9c58f', 0.86);
    fillTiles(WATER, pattern(water, '#5fa8c8', (px * 8) / 512), 0.66);
    if (!water) for (let j = 0; j < w.H; j++) for (let i = 0; i < w.W; i++) if (w.terrain[j * w.W + i] === WATER && hash2(i, j, 9) > 0.7) {
      c.strokeStyle = '#bfe6f2aa'; c.lineWidth = 1.2; c.beginPath(); c.arc(i * px + px / 2, j * px + px / 2, px * 0.25, 0.3, 2.4); c.stroke();
    }
    // trees and rocks stand up out of the ground: drawn back to front
    const tree = this.img('deco-tree'), rock = this.img('deco-boulder'), bush = this.img('deco-bush');
    for (let j = 0; j < w.H; j++) for (let i = 0; i < w.W; i++) {
      const t = w.terrain[j * w.W + i], n = hash2(i, j, 11), x = i * px + px / 2 + (n - 0.5) * px * 0.3, y = j * px + px / 2;
      if (t === TREE) {
        if (n < 0.18 && bush) { c.drawImage(bush, x - px * 0.8, y - px * 0.9, px * 1.6, px * 1.6); continue; }
        const s = px * (1.7 + n * 0.5);
        if (tree) c.drawImage(tree, x - s / 2, y - s * 0.78, s, s);
        else {
          c.fillStyle = '#5b3a22'; c.fillRect(x - px * 0.08, y - px * 0.1, px * 0.16, px * 0.4);
          c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(x, y + px * 0.25, s * 0.38, s * 0.14, 0, 0, 7); c.fill();
          const g = c.createRadialGradient(x - s * 0.12, y - s * 0.38, s * 0.05, x, y - s * 0.25, s * 0.42);
          g.addColorStop(0, n > 0.5 ? '#8fcb5c' : '#7fbf58'); g.addColorStop(1, n > 0.5 ? '#3f7a3a' : '#3a6f42');
          c.fillStyle = g; c.strokeStyle = '#2b4a26'; c.lineWidth = 1.2;
          for (const [dx, dy, r] of [[-0.18, -0.2, 0.26], [0.16, -0.24, 0.24], [0, -0.42, 0.26], [0.02, -0.18, 0.28]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.stroke(); }
          for (const [dx, dy, r] of [[-0.18, -0.2, 0.26], [0.16, -0.24, 0.24], [0, -0.42, 0.26], [0.02, -0.18, 0.28]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); }
        }
      } else if (t === ROCK) {
        const s = px * (1.25 + n * 0.4);
        if (rock) c.drawImage(rock, x - s / 2, y - s * 0.62, s, s);
        else {
          c.fillStyle = '#8c8a86'; c.strokeStyle = '#4e4a45'; c.lineWidth = 1.2;
          c.beginPath(); c.ellipse(x, y - s * 0.12, s * 0.42, s * 0.32, 0, 0, 7); c.fill(); c.stroke();
          c.fillStyle = '#a8a59f'; c.beginPath(); c.ellipse(x - s * 0.1, y - s * 0.22, s * 0.2, s * 0.12, 0, 0, 7); c.fill();
          c.fillStyle = '#7fa25a'; c.beginPath(); c.ellipse(x + s * 0.12, y - s * 0.34, s * 0.12, s * 0.05, 0, 0, 7); c.fill();
        }
      }
    }
    this.ground = cv; this.groundFor = w;
  }
  private fogLayer(w: World, me: number) {
    if (!this.fog || this.fog.width !== w.W) {
      this.fog = document.createElement('canvas'); this.fog.width = w.W; this.fog.height = w.H;
      this.fogData = this.fog.getContext('2d')!.createImageData(w.W, w.H);
    }
    if (this.fogAt === w.tick) return this.fog;
    this.fogAt = w.tick;
    const v = w.vis.get(w.players[me].team)!, d = this.fogData!.data;
    for (let i = 0; i < v.length; i++) { d[i * 4] = 18; d[i * 4 + 1] = 22; d[i * 4 + 2] = 34; d[i * 4 + 3] = v[i] === 2 ? 0 : v[i] === 1 ? 120 : 236; }
    this.fog.getContext('2d')!.putImageData(this.fogData!, 0, 0);
    return this.fog;
  }

  // ---------------------------------------------------------------- the frame
  draw(w: World, me: number, o: Overlay, dt: number) {
    const { c, dpr } = this, tp = this.tp;
    this.time += dt;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#2b3a24'; c.fillRect(0, 0, this.w, this.h);
    // ground (rebaked once when its paintings arrive)
    const art = (this.img('tex-grass') ? 1 : 0) + (this.img('tex-dirt') ? 2 : 0) + (this.img('tex-water') ? 4 : 0) + (this.img('deco-tree') ? 8 : 0) + (this.img('deco-boulder') ? 16 : 0) + (this.img('deco-bush') ? 32 : 0);
    if (!this.ground || this.groundFor !== w || art !== this.groundArt) this.bake(w);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.ground!, -this.cam.x, -this.cam.y, w.W * tp, w.H * tp);
    const team = w.players[me].team, x0 = this.cam.x / tp - 3, x1 = (this.cam.x + this.w) / tp + 3, y0 = this.cam.y / tp - 3, y1 = (this.cam.y + this.h) / tp + 4;
    const onScreen = (wx: number, wy: number) => { const tx = wx / T, ty = wy / T; return tx > x0 && tx < x1 && ty > y0 && ty < y1; };
    // dust clouds on the ground
    for (const cl of w.clouds) if (onScreen(cl.x, cl.y) && w.seen(team, cl.x, cl.y)) {
      const r = (cl.r / T) * tp, x = this.sx(cl.x), y = this.sy(cl.y), g = c.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, '#f6e7b8aa'); g.addColorStop(0.7, '#e8d39a66'); g.addColorStop(1, '#e8d39a00');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      for (let k = 0; k < 6; k++) { const a = this.time * 0.6 + k; c.fillStyle = '#fff6d6aa'; c.beginPath(); c.arc(x + Math.cos(a * 1.3) * r * 0.6, y + Math.sin(a) * r * 0.5, 2, 0, 7); c.fill(); }
    }
    // snares (only your own team's can be seen)
    for (const tr of w.traps) if (w.players[tr.owner].team === team && onScreen(tr.x, tr.y)) this.trap(this.sx(tr.x), this.sy(tr.y), tp);
    // ---- everything that stands up, back to front
    type D = { y: number; f: () => void };
    const list: D[] = [];
    for (const n of w.nodes) if (onScreen(n.x, n.y) && w.vis.get(team)![n.ty * w.W + n.tx] > 0) list.push({ y: n.y + T, f: () => this.node(n, tp) });
    const mem = w.known.get(team)!;
    for (const b of w.buildings) {
      if (!onScreen(b.x, b.y)) continue;
      const mine = w.players[b.owner].team === team;
      if (!mine && !w.seenBuilding(team, b)) continue;
      list.push({ y: (b.ty + b.size) * T, f: () => this.building(w, b, o, tp) });
    }
    // remembered buildings in the fog
    for (const [id, k] of mem) {
      const b = w.building(id); if (b && w.seenBuilding(team, b)) continue;
      const cx = (k.tx + k.size / 2) * T, cy = (k.ty + k.size / 2) * T; if (!onScreen(cx, cy)) continue;
      list.push({ y: (k.ty + k.size) * T, f: () => { c.globalAlpha = 0.55; this.buildingArt(BUILDINGS[k.type], this.sx(k.tx * T), this.sy(k.ty * T), k.size * tp, w.players[k.owner].color, true, 1); c.globalAlpha = 1; } });
    }
    const air: Unit[] = [];
    for (const u of w.units) {
      if (u.under || !onScreen(u.x, u.y)) continue;
      if (w.players[u.owner].team !== team && !w.seen(team, u.x, u.y)) continue;
      if (u.def.air) { air.push(u); list.push({ y: u.y, f: () => this.shadow(u, tp) }); continue; }
      list.push({ y: u.y, f: () => this.unit(w, u, o, tp) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();
    for (const u of air.sort((a, b) => a.y - b.y)) this.unit(w, u, o, tp);
    // ---- flying things and puffs
    this.drawShots(dt, tp);
    this.drawPuffs(dt, tp);
    // ---- fog
    const fog = this.fogLayer(w, me);
    c.imageSmoothingEnabled = true;
    c.drawImage(fog, -this.cam.x, -this.cam.y, w.W * tp, w.H * tp);
    // map edge
    c.strokeStyle = '#00000055'; c.lineWidth = 4; c.strokeRect(-this.cam.x, -this.cam.y, w.W * tp, w.H * tp);
    // ---- the player's marks: rally lines, move pings, the box, a building ghost, an aim ring
    for (const b of w.buildings) if (o.sel.has(b.id) && b.rally && b.owner === me) {
      c.strokeStyle = '#ffffffaa'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(this.sx(b.x), this.sy(b.y)); c.lineTo(this.sx(b.rally.x), this.sy(b.rally.y)); c.stroke(); c.setLineDash([]);
      this.flag(this.sx(b.rally.x), this.sy(b.rally.y), w.players[me].color);
    }
    for (const m of o.marks) {
      const a = 1 - m.t / 0.7; if (a <= 0) continue;
      c.strokeStyle = m.color; c.globalAlpha = a; c.lineWidth = 2.5;
      const x = this.sx(m.x), y = this.sy(m.y), r = 6 + m.t * 22;
      c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
    }
    if (o.ghost) {
      const d = BUILDINGS[o.ghost.type], gx = this.sx(o.ghost.tx * T), gy = this.sy(o.ghost.ty * T), s = d.size * tp;
      c.fillStyle = o.ghost.ok ? '#7fe08a55' : '#ff707055'; c.fillRect(gx, gy, s, s);
      c.strokeStyle = o.ghost.ok ? '#bff5c4' : '#ffb0b0'; c.lineWidth = 2; c.strokeRect(gx + 1, gy + 1, s - 2, s - 2);
      c.globalAlpha = 0.6; this.buildingArt(d, gx, gy, s, w.players[me].color, true, 1); c.globalAlpha = 1;
    }
    if (o.aim) {
      const x = this.sx(o.aim.x), y = this.sy(o.aim.y), r = (o.aim.r / T) * tp;
      c.strokeStyle = '#ffe9a8'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, 7); c.stroke(); c.setLineDash([]);
    }
    if (o.box) {
      const [ax, ay, bx, by] = o.box;
      c.fillStyle = '#9fe6a522'; c.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      c.strokeStyle = '#bff5c4'; c.lineWidth = 1.5; c.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }
  }

  // ---------------------------------------------------------------- pieces
  private node(n: Node, tp: number) {
    const { c } = this, x = this.sx(n.x), y = this.sy(n.y), s = tp * 2.3, k = 0.55 + 0.45 * (n.amount / n.max);
    const im = this.img(n.res === 'hay' ? 'res-hay' : 'res-glimmer');
    if (im) { c.drawImage(im, x - (s * k) / 2, y - s * k * 0.62, s * k, s * k); return; }
    if (n.res === 'hay') {
      c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(x, y + tp * 0.35, tp * k, tp * 0.4 * k, 0, 0, 7); c.fill();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = tp * 0.55 * k, bx = x + Math.cos(a) * r * 0.9, by = y + Math.sin(a) * r * 0.45;
        c.strokeStyle = i % 2 ? '#c99a3a' : '#e3bc5a'; c.lineWidth = 2;
        for (let s2 = -2; s2 <= 2; s2++) { c.beginPath(); c.moveTo(bx + s2 * 2, by + 6); c.quadraticCurveTo(bx + s2 * 3, by - 8, bx + s2 * 4 + 2, by - 14 * k); c.stroke(); }
      }
      c.fillStyle = '#efc85c'; c.strokeStyle = '#8a6420'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(x, y - tp * 0.1, tp * 0.42 * k, tp * 0.3 * k, 0, 0, 7); c.fill(); c.stroke();
      c.strokeStyle = '#b3842a'; c.beginPath(); c.moveTo(x - tp * 0.3 * k, y - tp * 0.1); c.lineTo(x + tp * 0.3 * k, y - tp * 0.1); c.stroke();
    } else {
      c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(x, y + tp * 0.4, tp * 0.95, tp * 0.35, 0, 0, 7); c.fill();
      c.fillStyle = '#8f8b86'; c.strokeStyle = '#4e4a45'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(x - tp * 0.3, y + tp * 0.1, tp * 0.5, tp * 0.36, 0, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(x + tp * 0.35, y + tp * 0.2, tp * 0.42, tp * 0.3, 0, 0, 7); c.fill(); c.stroke();
      const glow = 0.6 + Math.sin(this.time * 2 + n.id) * 0.25;
      for (const [dx, dy, h2, col] of [[-0.3, -0.1, 0.9, '#8ff0e0'], [0.05, -0.05, 1.2, '#c9a8ff'], [0.35, 0.05, 0.8, '#8ff0e0'], [-0.05, 0.15, 0.6, '#ffb0d8']] as [number, number, number, string][]) {
        const hx = x + dx * tp, hy = y + dy * tp, hh = h2 * tp * 0.6 * k;
        c.fillStyle = col; c.globalAlpha = glow; c.beginPath(); c.moveTo(hx - tp * 0.1, hy); c.lineTo(hx, hy - hh); c.lineTo(hx + tp * 0.1, hy); c.closePath(); c.fill();
        c.globalAlpha = 1; c.strokeStyle = '#3d6f7a'; c.lineWidth = 1; c.stroke();
      }
    }
  }
  private trap(x: number, y: number, tp: number) {
    const { c } = this, im = this.img('fx-trap'), s = tp * 1.1;
    if (im) { c.globalAlpha = 0.85; c.drawImage(im, x - s / 2, y - s / 2, s, s); c.globalAlpha = 1; return; }
    c.strokeStyle = '#b07a3a'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, tp * 0.35, tp * 0.2, 0, 0, 7); c.stroke();
    c.fillStyle = '#f2b84b'; c.beginPath(); c.arc(x, y, tp * 0.12, 0, 7); c.fill();
  }
  private flag(x: number, y: number, color: string) {
    const { c } = this;
    c.strokeStyle = '#5b3a22'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 22); c.stroke();
    c.fillStyle = color; c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x + 13, y - 17); c.lineTo(x, y - 12); c.closePath(); c.fill();
  }
  private bar(x: number, y: number, wdt: number, frac: number, color: string) {
    const { c } = this;
    c.fillStyle = '#1b1410cc'; c.fillRect(x - wdt / 2 - 1, y - 1, wdt + 2, 6);
    c.fillStyle = color; c.fillRect(x - wdt / 2, y, wdt * Math.max(0, Math.min(1, frac)), 4);
  }
  private building(w: World, b: Building, o: Overlay, tp: number) {
    const { c } = this, x = this.sx(b.tx * T), y = this.sy(b.ty * T), s = b.size * tp, color = w.players[b.owner].color;
    const sel = o.sel.has(b.id), hover = o.hover === b.id;
    if (sel || hover) {
      c.strokeStyle = sel ? '#bff5c4' : '#ffffff99'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(x + s / 2, y + s * 0.78, s * 0.62, s * 0.3, 0, 0, 7); c.stroke();
    }
    // a ground shadow and the team's pennant
    c.fillStyle = '#00000030'; c.beginPath(); c.ellipse(x + s / 2, y + s * 0.84, s * 0.55, s * 0.2, 0, 0, 7); c.fill();
    const flash = this.time - (this.hurt.get(b.id) ?? -9) < 0.12;
    const build = b.done ? 1 : Math.max(0.25, b.progress / Math.round(b.def.time * 20));
    this.buildingArt(b.def, x, y, s, color, b.done, build);
    if (flash) { c.globalAlpha = 0.25; c.fillStyle = '#fff'; c.fillRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8); c.globalAlpha = 1; }
    this.flag(x + s * 0.88, y + s * 0.42, color);
    // springs glow when wound
    if (b.def.spring && b.done && sel) { c.strokeStyle = '#7fe0d066'; c.setLineDash([4, 6]); c.beginPath(); c.ellipse(b.x / T * tp - this.cam.x, b.y / T * tp - this.cam.y, b.def.spring * tp, b.def.spring * tp * 0.8, 0, 0, 7); c.stroke(); c.setLineDash([]); }
    if (b.def.heal && b.done && sel) { c.strokeStyle = '#ffe9a866'; c.setLineDash([4, 6]); c.beginPath(); c.ellipse(this.sx(b.x), this.sy(b.y), (b.def.heal.r + b.size / 2) * tp, (b.def.heal.r + b.size / 2) * tp * 0.8, 0, 0, 7); c.stroke(); c.setLineDash([]); }
    if (b.def.tower && b.done && b.hitAt > w.tick - 3) { c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(x + s / 2, y + s * 0.15, 4, 0, 7); c.fill(); }
    if (!b.done || b.hp < b.maxHp || sel) this.bar(x + s / 2, y - 4, s * 0.7, b.hp / b.maxHp, w.players[b.owner].team === w.players[o.me].team ? '#7fe08a' : '#ff8a7a');
    if (!b.done) this.bar(x + s / 2, y + 4, s * 0.7, b.progress / Math.round(b.def.time * 20), '#ffd86b');
    else if (b.queue.length && b.owner === o.me) { const q = b.queue[0]; this.bar(x + s / 2, y + 4, s * 0.7, 1 - q.left / q.total, '#9fd2ff'); }
  }
  /** A building's painting, or a drawn stand-in in its side's style; `build` (0..1) shows scaffolding while it goes up. */
  buildingArt(def: (typeof BUILDINGS)[string], x: number, y: number, s: number, color: string, done: boolean, build: number) {
    const { c } = this, im = this.img(`bld-${def.side}-${def.id}`);
    if (!done) {
      // scaffolding and a heap of materials
      c.strokeStyle = '#8a6a44'; c.lineWidth = 2;
      for (let i = 0; i <= 3; i++) { const px2 = x + s * (0.15 + i * 0.233); c.beginPath(); c.moveTo(px2, y + s * 0.9); c.lineTo(px2, y + s * (0.9 - 0.7 * build)); c.stroke(); }
      c.beginPath(); c.moveTo(x + s * 0.15, y + s * (0.9 - 0.35 * build)); c.lineTo(x + s * 0.85, y + s * (0.9 - 0.35 * build)); c.stroke();
    }
    c.save();
    if (!done) { c.beginPath(); c.rect(x - s, y + s * (1 - build), s * 3, s * 2); c.clip(); c.globalAlpha *= 0.85; }
    if (im) { const k = s * 1.12; c.drawImage(im, x + s / 2 - k / 2, y + s - k * 0.95, k, k); }
    else this.drawnBuilding(def, x, y, s, color);
    c.restore();
  }
  private drawnBuilding(def: (typeof BUILDINGS)[string], x: number, y: number, s: number, color: string) {
    const { c } = this, side = def.side as SideId, cx = x + s / 2, base = y + s * 0.9;
    const ink = '#4a3322';
    c.lineWidth = Math.max(1.2, s * 0.02); c.strokeStyle = ink; c.lineJoin = 'round';
    if (side === 'colony') {
      // a grassy mound with a round door
      const h = def.tower ? s * 0.95 : def.hq ? s * 0.62 : s * 0.5;
      if (def.tower) {
        c.fillStyle = '#8a6440'; c.beginPath(); c.moveTo(cx - s * 0.28, base); c.lineTo(cx - s * 0.22, base - h); c.lineTo(cx + s * 0.22, base - h); c.lineTo(cx + s * 0.28, base); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#c69c6d'; c.beginPath(); c.ellipse(cx, base - h, s * 0.24, s * 0.08, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#9a948a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(cx - s * 0.1 + i * s * 0.07, base - h - s * 0.05, s * 0.04, 0, 7); c.fill(); }
        return;
      }
      const g = c.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, '#9ccf68'); g.addColorStop(1, '#5f9440');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, base, s * 0.46, h, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffffff22'; c.beginPath(); c.ellipse(cx - s * 0.12, base - h * 0.7, s * 0.16, h * 0.15, -0.3, 0, 7); c.fill();
      if (def.id === 'bath') { c.fillStyle = '#e9dcae'; c.beginPath(); c.ellipse(cx, base - h * 0.55, s * 0.3, h * 0.25, 0, 0, 7); c.fill(); c.stroke(); return; }
      c.fillStyle = '#6a4326'; c.beginPath(); c.arc(cx, base, s * (def.hq ? 0.14 : 0.11), Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffd98a'; c.beginPath(); c.arc(cx + s * 0.22, base - h * 0.45, s * 0.05, 0, 7); c.fill(); c.stroke();
      if (def.id === 'hut' || def.hq) { c.fillStyle = '#e7c35a'; c.beginPath(); c.ellipse(cx, base - h * 0.95, s * 0.3, h * 0.25, 0, Math.PI, 0); c.fill(); c.stroke(); }
      if (def.id === 'perch') { c.strokeStyle = '#6a4326'; c.beginPath(); c.moveTo(cx + s * 0.2, base - h); c.lineTo(cx + s * 0.45, base - h * 1.4); c.stroke(); c.fillStyle = '#e8a33a'; c.beginPath(); c.ellipse(cx + s * 0.45, base - h * 1.45, s * 0.14, s * 0.05, -0.4, 0, 7); c.fill(); }
      if (def.id === 'library') { c.fillStyle = '#f2c94c'; c.beginPath(); c.arc(cx - s * 0.32, base - h * 0.6, s * 0.08, 0, 7); c.fill(); c.stroke(); }
      if (def.tunnel && !def.hq) { c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(cx, base, s * 0.16, Math.PI, 0); c.closePath(); c.fill(); }
    } else if (side === 'guild') {
      // crates, tins and a patched awning
      const h = def.tower ? s * 1.0 : def.hq ? s * 0.68 : s * 0.5, wdt = def.tower ? s * 0.3 : s * 0.8;
      c.fillStyle = def.hq ? '#9aa4ad' : '#a07a4e';
      c.beginPath(); c.roundRect(cx - wdt / 2, base - h, wdt, h, s * 0.04); c.fill(); c.stroke();
      if (def.hq) { c.fillStyle = '#7d8790'; for (let i = 1; i < 4; i++) c.fillRect(cx - wdt / 2, base - h + (h * i) / 4, wdt, 2); c.fillStyle = '#c6cdd3'; c.beginPath(); c.ellipse(cx, base - h, wdt / 2, s * 0.08, 0, 0, 7); c.fill(); c.stroke(); }
      else { c.strokeStyle = '#6e5232'; c.beginPath(); c.moveTo(cx - wdt / 2, base - h); c.lineTo(cx + wdt / 2, base); c.moveTo(cx + wdt / 2, base - h); c.lineTo(cx - wdt / 2, base); c.stroke(); c.strokeStyle = ink; }
      if (def.tower) { c.fillStyle = '#ffe28a'; c.beginPath(); c.arc(cx, base - h - s * 0.08, s * 0.1, 0, 7); c.fill(); c.stroke(); return; }
      c.fillStyle = '#b48ad8'; c.beginPath(); c.moveTo(cx - wdt / 2 - s * 0.05, base - h); c.lineTo(cx, base - h - s * 0.16); c.lineTo(cx + wdt / 2 + s * 0.05, base - h); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#3a2a1c'; c.beginPath(); c.roundRect(cx - s * 0.09, base - s * 0.22, s * 0.18, s * 0.22, [s * 0.08, s * 0.08, 0, 0]); c.fill();
      if (def.id === 'workshop') for (const dx of [-0.3, 0.3]) { c.fillStyle = '#6a4a2a'; c.beginPath(); c.arc(cx + dx * s, base, s * 0.1, 0, 7); c.fill(); c.stroke(); }
      if (def.id === 'loft') { c.fillStyle = '#ff9a6a'; c.beginPath(); c.moveTo(cx + s * 0.3, base - h - s * 0.3); c.lineTo(cx + s * 0.42, base - h - s * 0.18); c.lineTo(cx + s * 0.3, base - h - s * 0.06); c.lineTo(cx + s * 0.18, base - h - s * 0.18); c.closePath(); c.fill(); c.stroke(); }
    } else {
      // brass domes and hexagons
      const h = def.tower ? s * 1.0 : def.hq ? s * 0.66 : s * 0.5;
      if (def.tower || def.spring) {
        c.fillStyle = '#c9963e'; c.beginPath(); c.moveTo(cx - s * 0.16, base); c.lineTo(cx - s * 0.09, base - h); c.lineTo(cx + s * 0.09, base - h); c.lineTo(cx + s * 0.16, base); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#7a5520'; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(cx - s * 0.14, base - (h * i) / 6); c.lineTo(cx + s * 0.14, base - (h * i) / 6 - s * 0.04); c.stroke(); }
        c.strokeStyle = ink; c.fillStyle = def.spring ? '#7fe0d0' : '#9fd8ff';
        c.beginPath(); c.arc(cx, base - h - s * 0.06, s * 0.09 + Math.sin(this.time * 4) * s * 0.01, 0, 7); c.fill(); c.stroke();
        return;
      }
      const g = c.createLinearGradient(cx - s * 0.4, 0, cx + s * 0.4, 0); g.addColorStop(0, '#e2b55c'); g.addColorStop(1, '#a8742c');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, base, s * 0.42, h, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffd36b';
      for (let i = 0; i < 3; i++) { const hx = cx - s * 0.18 + i * s * 0.18, hy = base - h * 0.45; c.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.lineTo(hx + Math.cos(a) * s * 0.06, hy + Math.sin(a) * s * 0.06); } c.closePath(); c.fill(); c.stroke(); }
      if (def.hq) { c.save(); c.translate(cx, base - h - s * 0.06); c.rotate(this.time); c.fillStyle = '#d8a84a'; c.fillRect(-s * 0.12, -s * 0.03, s * 0.24, s * 0.06); c.fillRect(-s * 0.03, -s * 0.12, s * 0.06, s * 0.24); c.restore(); }
    }
    void color;
  }
  private shadow(u: Unit, tp: number) {
    const { c } = this; c.fillStyle = '#00000030'; c.beginPath(); c.ellipse(this.sx(u.x), this.sy(u.y), tp * 0.35, tp * 0.14, 0, 0, 7); c.fill();
  }
  private unit(w: World, u: Unit, o: Overlay, tp: number) {
    const { c } = this, p = w.players[u.owner], x = this.sx(u.x), lift = u.def.air ? tp * 0.9 + Math.sin(this.time * 3 + u.id) * tp * 0.06 : 0, y = this.sy(u.y) - lift;
    const size = Math.max(26, tp * Math.max(1.05, u.def.r * 3.1)) * (u.def.hero ? 1.12 : 1) * (w.flags.get(u.id) === 'kit' ? 0.75 : 1);
    const sel = o.sel.has(u.id), mine = p.team === w.players[o.me].team;
    // team ring and selection
    c.lineWidth = sel ? 2.5 : 2;
    c.strokeStyle = sel ? '#bff5c4' : p.color; c.globalAlpha = sel ? 1 : 0.85;
    c.beginPath(); c.ellipse(x, y + 2, size * 0.36, size * 0.16, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
    if (o.hover === u.id && !sel) { c.strokeStyle = '#ffffffaa'; c.beginPath(); c.ellipse(x, y + 2, size * 0.42, size * 0.19, 0, 0, 7); c.stroke(); }
    if (!u.def.air) { c.fillStyle = '#00000026'; c.beginPath(); c.ellipse(x, y + 1, size * 0.3, size * 0.11, 0, 0, 7); c.fill(); }
    // a little hop when walking, a lunge when swinging, wobble when held or dazzled
    const walk = u.moving ? Math.abs(Math.sin(this.time * 11 + u.id)) * size * 0.06 : 0;
    const swing = w.tick - u.hitAt < 4 ? size * 0.07 : 0;
    const wob = u.stun > 0 || u.root > 0 ? Math.sin(this.time * 20) * 0.08 : 0;
    const flash = this.time - (this.hurt.get(u.id) ?? -9) < 0.1;
    const wound = w.woundDown(u);
    c.save();
    c.translate(x + swing * u.face, y - walk);
    if (wob) c.rotate(wob);
    if (wound) c.globalAlpha = 0.85;
    const im = u.type === 'wagon' ? this.img('bld-guild-workshop') : this.img(`unit-${u.def.side}-${u.type}`);
    if (im) {
      const k = u.type === 'wagon' ? size * 1.5 : u.type === 'queen' ? size * 1.5 : size * 1.25;
      c.scale(u.face, 1); c.drawImage(im, -k / 2, -k * 0.86, k, k);
    } else this.drawnUnit(u, size);
    if (flash) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#ffffff66'; c.fillRect(-size, -size * 1.4, size * 2, size * 1.6); }
    c.restore();
    // carried hay or glimmer
    if (u.carry > 0) { c.fillStyle = u.carryRes === 'hay' ? '#f0c85a' : '#8ff0e0'; c.strokeStyle = '#5b4220'; c.lineWidth = 1; c.beginPath(); c.ellipse(x - u.face * size * 0.22, y - size * 0.62 - walk, size * 0.14, size * 0.1, 0, 0, 7); c.fill(); c.stroke(); }
    // status: wound-down key, held, dazzled, quick
    if (u.def.side === 'hive' && w.winds(u) && (sel || wound)) {
      const max = w.windMax(p), f = u.wind / max;
      c.strokeStyle = wound ? '#ff9a7a' : '#7fe0d0'; c.lineWidth = 2; c.beginPath(); c.arc(x + size * 0.3, y - size * 0.95, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke();
    }
    if (u.stun > 0) for (let k = 0; k < 3; k++) { const a = this.time * 5 + k * 2.1; c.fillStyle = '#ffe98a'; c.beginPath(); c.arc(x + Math.cos(a) * size * 0.25, y - size * 1.0 + Math.sin(a) * 3, 2.2, 0, 7); c.fill(); }
    if (u.root > 0) { c.fillStyle = '#f2b84b88'; c.beginPath(); c.ellipse(x, y + 2, size * 0.32, size * 0.13, 0, 0, 7); c.fill(); }
    if (u.haste > 0) { c.strokeStyle = '#ffe9a8aa'; c.lineWidth = 1.5; for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(x - u.face * size * (0.35 + k * 0.1), y - size * (0.3 + k * 0.15)); c.lineTo(x - u.face * size * (0.6 + k * 0.1), y - size * (0.3 + k * 0.15)); c.stroke(); } }
    if (u.firm > 0) { c.strokeStyle = '#9fc8ffaa'; c.lineWidth = 2; c.beginPath(); c.arc(x, y - size * 0.45, size * 0.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    if (u.hp < u.maxHp || sel) this.bar(x, y - size * 1.08, Math.max(18, size * 0.6), u.hp / u.maxHp, mine ? (u.hp * 3 < u.maxHp ? '#ffcf5a' : '#7fe08a') : '#ff8a7a');
  }
  /** A drawn stand-in for a unit, facing its way, feet at (0, 0). */
  private drawnUnit(u: Unit, size: number) {
    const key = `${u.type}:${Math.round(size)}:${u.face}:${u.moving ? Math.floor(this.time * 8) % 2 : 0}`;
    let cv = this.cache.get(key);
    if (!cv) {
      cv = document.createElement('canvas'); const px = Math.ceil(size * 2.2 * this.dpr); cv.width = px; cv.height = px;
      const c = cv.getContext('2d')!; c.scale(this.dpr, this.dpr); c.translate(size * 1.1, size * 1.55);
      this.paintUnit(c, u.type, u.def.side, size, u.face, u.moving ? Math.floor(this.time * 8) % 2 : 0);
      if (this.cache.size > 400) this.cache.clear();
      this.cache.set(key, cv);
    }
    this.c.drawImage(cv, -size * 1.1, -size * 1.55, size * 2.2, size * 2.2);
  }
  /** Draws a unit stand-in into a context whose origin is the feet. */
  paintUnit(c: CanvasRenderingContext2D, type: string, side: string, size: number, face: 1 | -1, frame: number) {
    const ink = '#3b2a20';
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (side === 'colony' || type === 'dora' || type === 'enzo') {
      const id = type === 'dora' ? 'dora' : type === 'enzo' ? 'enzo' : COATS[type] ?? COATS.slinger;
      const h = size * (type === 'fluffguard' ? 1.0 : 0.9);
      if (type === 'glider') {
        c.fillStyle = '#e8a33a'; c.strokeStyle = '#7a4a1a'; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(0, -h * 0.95, size * 0.62, size * 0.16, face * -0.12, 0, 7); c.fill(); c.stroke();
        c.strokeStyle = '#a0662a'; c.beginPath(); c.moveTo(-size * 0.55, -h * 0.95); c.lineTo(size * 0.55, -h * 0.95); c.stroke();
      }
      drawChinchilla(c, id, 0, 0, { face, h, time: frame * 0.3, moving: frame === 1, run: frame * 3, air: type === 'glider' });
      const s = h / 24;
      c.strokeStyle = ink; c.lineWidth = 1.2;
      if (type === 'gatherer') { c.fillStyle = '#e7c35a'; c.beginPath(); c.ellipse(-face * 6 * s, -16 * s, 5 * s, 4 * s, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#d9a640'; c.beginPath(); c.ellipse(face * 3 * s, -23 * s, 6 * s, 1.6 * s, 0, 0, 7); c.fill(); c.stroke(); }
      if (type === 'slinger') { c.strokeStyle = '#7a5530'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(face * 6 * s, -14 * s); c.quadraticCurveTo(face * 12 * s, -26 * s, face * 9 * s, -28 * s); c.stroke(); c.fillStyle = '#9a9184'; c.beginPath(); c.arc(face * 9 * s, -28 * s, 1.8 * s, 0, 7); c.fill(); c.fillStyle = '#6fbf5a'; c.fillRect(-4 * s, -21 * s, 9 * s, 1.6 * s); }
      if (type === 'fluffguard') { c.fillStyle = '#c69c5d'; c.beginPath(); c.ellipse(face * 7 * s, -10 * s, 4 * s, 6 * s, 0, 0, 7); c.fill(); c.stroke(); }
      if (type === 'puffer') { c.fillStyle = '#9a6a3a'; c.beginPath(); c.moveTo(face * 5 * s, -9 * s); c.lineTo(face * 12 * s, -12 * s); c.lineTo(face * 12 * s, -6 * s); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f6e7b8cc'; c.beginPath(); c.arc(face * 15 * s, -9 * s, 2.5 * s, 0, 7); c.fill(); }
      if (type === 'digger') { c.fillStyle = '#c99a5a'; c.beginPath(); c.ellipse(0, -21 * s, 6 * s, 3 * s, 0, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = '#ffe28a'; c.beginPath(); c.arc(face * 3 * s, -22 * s, 1.4 * s, 0, 7); c.fill(); c.fillStyle = '#8a5a2b'; c.fillRect(face > 0 ? 6 * s : -16 * s, -6 * s, 10 * s, 4 * s); c.fillStyle = '#5b3a22'; c.beginPath(); c.arc(face * 11 * s, -1 * s, 2.4 * s, 0, 7); c.fill(); }
      if (type === 'dora') { c.fillStyle = '#ff9fb8'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc((-3 + k * 2) * s, -22.5 * s, 1.3 * s, 0, 7); c.fill(); } c.strokeStyle = '#6a4326'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(face * 7 * s, -2 * s); c.lineTo(face * 9 * s, -18 * s); c.stroke(); c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(face * 9 * s, -19 * s, 2 * s, 0, 7); c.fill(); }
      if (type === 'enzo') { c.fillStyle = '#4f86c6'; c.beginPath(); c.moveTo(-2 * s, -13 * s); c.lineTo(4 * s * face, -12 * s); c.lineTo(0, -10 * s); c.closePath(); c.fill(); c.fillStyle = '#a07a50'; c.beginPath(); c.ellipse(0, -21 * s, 5 * s, 2.6 * s, 0, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = '#c9a36a'; c.beginPath(); c.arc(face * 8 * s, -10 * s, 4.5 * s, 0, 7); c.fill(); c.stroke(); }
      return;
    }
    if (side === 'guild' || type === 'marlo') {
      if (type === 'wagon') {
        c.fillStyle = '#a07a4e'; c.strokeStyle = ink; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(-size * 0.55, -size * 0.75, size * 1.1, size * 0.55, 4); c.fill(); c.stroke();
        c.fillStyle = '#b48ad8'; c.beginPath(); c.moveTo(-size * 0.6, -size * 0.75); c.lineTo(0, -size * 1.0); c.lineTo(size * 0.6, -size * 0.75); c.closePath(); c.fill(); c.stroke();
        for (const dx of [-0.35, 0.35]) { c.fillStyle = '#6a4a2a'; c.beginPath(); c.arc(dx * size, -size * 0.15, size * 0.16, 0, 7); c.fill(); c.stroke(); }
        return;
      }
      const big = type === 'marlo' ? 1.15 : 1, h = size * 0.85 * big, f = face;
      if (type === 'kite') { c.fillStyle = '#ff9a6a'; c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -h * 1.5); c.lineTo(size * 0.45, -h * 1.05); c.lineTo(0, -h * 0.6); c.lineTo(-size * 0.45, -h * 1.05); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#fff3'; c.beginPath(); c.moveTo(0, -h * 1.5); c.lineTo(0, -h * 0.6); c.stroke(); }
      // ringed tail
      c.lineWidth = 1.4; c.strokeStyle = ink;
      for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#3d3833' : '#9a948c'; c.beginPath(); c.ellipse(-f * (h * 0.42 + k * h * 0.07), -h * (0.3 + k * 0.07), h * 0.1, h * 0.08, f * 0.6, 0, 7); c.fill(); c.stroke(); }
      // body and head
      c.fillStyle = '#8f8a84'; c.beginPath(); c.ellipse(0, -h * 0.32, h * 0.32, h * 0.3, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#d8d2c8'; c.beginPath(); c.ellipse(f * h * 0.08, -h * 0.28, h * 0.17, h * 0.2, 0, 0, 7); c.fill();
      c.fillStyle = '#8f8a84'; c.beginPath(); c.ellipse(f * h * 0.1, -h * 0.72, h * 0.27, h * 0.22, 0, 0, 7); c.fill(); c.stroke();
      for (const dx of [-0.08, 0.24]) { c.fillStyle = '#6d6862'; c.beginPath(); c.moveTo(f * h * (dx - 0.07), -h * 0.86); c.lineTo(f * h * dx, -h * 1.02); c.lineTo(f * h * (dx + 0.08), -h * 0.86); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = '#2b2622'; c.beginPath(); c.ellipse(f * h * 0.17, -h * 0.74, h * 0.17, h * 0.07, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(f * h * 0.13, -h * 0.75, h * 0.035, 0, 7); c.arc(f * h * 0.25, -h * 0.75, h * 0.035, 0, 7); c.fill();
      c.fillStyle = '#e8e2d8'; c.beginPath(); c.ellipse(f * h * 0.3, -h * 0.66, h * 0.08, h * 0.06, 0, 0, 7); c.fill(); c.fillStyle = '#2b2622'; c.beginPath(); c.arc(f * h * 0.37, -h * 0.67, h * 0.03, 0, 7); c.fill();
      c.lineWidth = 1.2;
      if (type === 'scrapper') { c.fillStyle = '#b8c0c8'; c.beginPath(); c.ellipse(f * h * 0.08, -h * 0.92, h * 0.2, h * 0.07, 0, Math.PI, 0); c.fill(); c.stroke(); c.strokeStyle = '#8a5a2b'; c.lineWidth = 2; c.beginPath(); c.moveTo(f * h * 0.3, -h * 0.3); c.lineTo(f * h * 0.5, -h * 0.65); c.stroke(); }
      if (type === 'tosser' || type === 'marlo') { c.fillStyle = '#d8dde3'; c.beginPath(); c.ellipse(f * h * 0.42, -h * 0.4, h * 0.15, h * 0.06, f * 0.3, 0, 7); c.fill(); c.stroke(); }
      if (type === 'tinkerer') { c.fillStyle = '#c9a36a'; c.beginPath(); c.ellipse(-f * h * 0.3, -h * 0.45, h * 0.14, h * 0.18, 0, 0, 7); c.fill(); c.stroke(); }
      if (type === 'trapper') { c.strokeStyle = '#b07a3a'; c.lineWidth = 2; c.beginPath(); c.arc(-f * h * 0.15, -h * 0.4, h * 0.14, 0, 7); c.stroke(); c.fillStyle = '#f2b84b'; c.beginPath(); c.arc(f * h * 0.4, -h * 0.3, h * 0.08, 0, 7); c.fill(); }
      if (type === 'cart') { c.fillStyle = '#a07a4e'; c.fillRect(f > 0 ? h * 0.25 : -h * 1.15, -h * 0.45, h * 0.9, h * 0.32); c.strokeRect(f > 0 ? h * 0.25 : -h * 1.15, -h * 0.45, h * 0.9, h * 0.32); c.fillStyle = '#5b3a22'; c.beginPath(); c.arc(f * h * 0.45, -h * 0.1, h * 0.12, 0, 7); c.arc(f * h * 0.95, -h * 0.1, h * 0.12, 0, 7); c.fill(); c.fillStyle = '#d8543a'; c.beginPath(); c.arc(f * h * 0.8, -h * 0.55, h * 0.1, 0, 7); c.fill(); }
      if (type === 'marlo') { c.fillStyle = '#7a5aa8'; c.beginPath(); c.ellipse(0, -h * 0.32, h * 0.3, h * 0.22, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#b8c0c8'; c.fillRect(f * h * 0.0 - h * 0.08, -h * 1.12, h * 0.2, h * 0.2); c.strokeRect(f * h * 0.0 - h * 0.08, -h * 1.12, h * 0.2, h * 0.2); }
      return;
    }
    // ---- the hive: round wind-up beetles with a key
    const shells: Record<string, string> = { sorter: '#c87a4a', clicker: '#3fae9e', squirt: '#8a4fa8', shellback: '#4f9a5a', buzzer: '#e0a03a', rammer: '#6a6fa8', queen: '#8a5ac8' };
    const big = type === 'queen' ? 1.35 : type === 'shellback' || type === 'rammer' ? 1.15 : 1, r = size * 0.36 * big, f = face, col = shells[type] ?? '#3fae9e';
    c.strokeStyle = ink; c.lineWidth = 1.4;
    // legs
    c.strokeStyle = '#a07a3a'; c.lineWidth = 1.6;
    for (let k = -1; k <= 1; k++) { const dx = k * r * 0.55 + (frame ? 2 : 0) * k; c.beginPath(); c.moveTo(dx, -r * 0.5); c.lineTo(dx + f * r * 0.1, 0); c.stroke(); }
    c.strokeStyle = ink; c.lineWidth = 1.4;
    if (type === 'buzzer') { c.fillStyle = '#e8f6ffaa'; for (const s2 of [-1, 1]) { c.beginPath(); c.ellipse(-f * r * 0.2, -r * 1.5, r * 0.8, r * 0.3, s2 * 0.5 + Math.sin(frame * 3) * 0.2, 0, 7); c.fill(); c.stroke(); } }
    const g = c.createRadialGradient(-f * r * 0.2, -r * 1.05, r * 0.1, 0, -r * 0.7, r * 1.1);
    g.addColorStop(0, '#ffffffaa'); g.addColorStop(0.25, col); g.addColorStop(1, '#00000055');
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -r * 0.75, r * 1.0, r * 0.72, 0, 0, 7); c.fill();
    c.fillStyle = g; c.fill(); c.stroke();
    c.strokeStyle = '#d8b060'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-r * 0.1, -r * 1.45); c.lineTo(-r * 0.1, -r * 0.05); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 1.4;
    // head and glass eyes
    c.fillStyle = '#3a3030'; c.beginPath(); c.ellipse(f * r * 0.95, -r * 0.6, r * 0.32, r * 0.28, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#dff6ff'; c.beginPath(); c.arc(f * r * 1.08, -r * 0.68, r * 0.1, 0, 7); c.fill();
    if (type === 'clicker') { c.fillStyle = '#d8b060'; c.beginPath(); c.moveTo(f * r * 1.15, -r * 0.85); c.lineTo(f * r * 1.45, -r * 1.05); c.lineTo(f * r * 1.2, -r * 0.7); c.closePath(); c.fill(); c.stroke(); }
    if (type === 'rammer') { c.fillStyle = '#e2c070'; c.beginPath(); c.moveTo(f * r * 1.1, -r * 0.8); c.lineTo(f * r * 1.9, -r * 0.65); c.lineTo(f * r * 1.1, -r * 0.4); c.closePath(); c.fill(); c.stroke(); }
    if (type === 'squirt') { c.fillStyle = '#d8b060'; c.fillRect(f > 0 ? r * 1.1 : -r * 1.5, -r * 0.82, r * 0.4, r * 0.14); }
    if (type === 'queen') { c.fillStyle = '#ffd86b'; c.beginPath(); c.moveTo(f * r * 0.75, -r * 0.88); c.lineTo(f * r * 0.85, -r * 1.12); c.lineTo(f * r * 0.95, -r * 0.95); c.lineTo(f * r * 1.05, -r * 1.14); c.lineTo(f * r * 1.15, -r * 0.88); c.closePath(); c.fill(); c.stroke(); }
    if (type === 'sorter') { c.fillStyle = '#d9a640'; c.beginPath(); c.ellipse(f * r * 0.4, -r * 1.35, r * 0.35, r * 0.18, 0, 0, 7); c.fill(); c.stroke(); }
    // the brass key
    c.save(); c.translate(-f * r * 0.85, -r * 1.05); c.rotate(frame * 0.6);
    c.strokeStyle = '#a07a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(-f * r * 0.3, -r * 0.25); c.stroke();
    c.fillStyle = '#e2c070'; c.strokeStyle = ink; c.lineWidth = 1;
    c.beginPath(); c.ellipse(-f * r * 0.42, -r * 0.35, r * 0.16, r * 0.1, 0.6, 0, 7); c.fill(); c.stroke(); c.restore();
  }

  // ---------------------------------------------------------------- effects
  private drawShots(dt: number, tp: number) {
    const { c } = this;
    for (const s of this.shots) {
      s.t += dt; const k = Math.min(1, s.t / s.dur);
      const x = this.sx(s.x + (s.tx - s.x) * k), y0 = this.sy(s.y + (s.ty - s.y) * k) - (s.air ? tp * 0.9 * k : 0), arc = Math.sin(k * Math.PI) * tp * (s.shot === 'apple' || s.shot === 'acorn' ? 1.2 : 0.35);
      const y = y0 - arc, col = SHOT_COLOR[s.shot] ?? '#ddd';
      if (s.shot === 'lid') { c.save(); c.translate(x, y); c.rotate(this.time * 20); c.fillStyle = col; c.strokeStyle = '#6a7078'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 5, 2.5, 0, 0, 7); c.fill(); c.stroke(); c.restore(); }
      else if (s.shot === 'spark') { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 2 : 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); }
      else if (s.shot === 'dust') { c.fillStyle = col + 'cc'; c.beginPath(); c.arc(x, y, 4 + k * 3, 0, 7); c.fill(); }
      else { c.fillStyle = col; c.strokeStyle = '#3b2a20'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, s.shot === 'apple' || s.shot === 'acorn' ? 4.5 : 2.8, 0, 7); c.fill(); c.stroke(); }
      if (k >= 1) this.puffs.push({ x: s.tx, y: s.ty - (s.air ? T * 0.9 : T * 0.3), t: 0, big: s.shot === 'apple' || s.shot === 'acorn' ? 0.8 : 0.35, color: col, kind: 'hit' });
    }
    this.shots = this.shots.filter((s) => s.t < s.dur);
  }
  private drawPuffs(dt: number, tp: number) {
    const { c } = this;
    for (const p of this.puffs) {
      p.t += dt;
      const x = this.sx(p.x), y = this.sy(p.y);
      if (p.kind === 'text') {
        const a = 1 - p.t / 1.1; if (a <= 0) continue;
        c.globalAlpha = a; c.font = `900 ${Math.round(12 + tp * 0.12)}px ${FONT}`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#2a1d14'; c.strokeText(p.text!, x, y - p.t * 26); c.fillStyle = p.color; c.fillText(p.text!, x, y - p.t * 26); c.globalAlpha = 1;
        continue;
      }
      if (p.kind === 'ring') {
        const a = 1 - p.t / 0.8; if (a <= 0) continue;
        const r = ((p.r ?? T) / T) * tp * (0.4 + 0.6 * (p.t / 0.8));
        c.globalAlpha = a; c.strokeStyle = p.color; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
        continue;
      }
      const life = p.kind === 'tidy' ? 1.2 : p.kind === 'poof' ? 0.9 : 0.35, a = 1 - p.t / life; if (a <= 0) continue;
      const r = tp * p.big * (0.3 + p.t * (p.kind === 'hit' ? 1.4 : 0.9));
      c.globalAlpha = a * 0.9;
      for (let k = 0; k < (p.kind === 'hit' ? 3 : 7); k++) {
        const ang = k * 2.4 + p.x * 0.001, d = r * 0.55;
        c.fillStyle = p.color; c.beginPath(); c.arc(x + Math.cos(ang) * d, y - tp * 0.3 * p.big + Math.sin(ang) * d * 0.6 - p.t * tp * 0.4, r * 0.45, 0, 7); c.fill();
      }
      if (p.kind === 'poof') {
        for (let k = 0; k < 3; k++) { const ang = this.time * 4 + k * 2.1; c.fillStyle = '#ffe98a'; c.beginPath(); c.arc(x + Math.cos(ang) * r * 0.7, y - tp * 0.6 - p.t * tp * 0.8, 2.5, 0, 7); c.fill(); }
        c.font = `900 ${Math.round(11 + tp * 0.12)}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#fff6e0'; c.strokeStyle = '#5a4030'; c.lineWidth = 3;
        c.strokeText('poof!', x, y - tp * 0.9 - p.t * tp * 0.6); c.fillText('poof!', x, y - tp * 0.9 - p.t * tp * 0.6);
      }
      if (p.kind === 'tidy') for (let k = 0; k < 5; k++) { const ang = k * 1.3; c.fillStyle = '#8a6440'; c.fillRect(x + Math.cos(ang) * r, y - tp * 0.2 + p.t * p.t * tp * 1.5 - Math.sin(ang) * r * 0.5, 6, 3); }
      c.globalAlpha = 1;
    }
    this.puffs = this.puffs.filter((p) => p.t < (p.kind === 'text' ? 1.1 : p.kind === 'tidy' ? 1.2 : p.kind === 'poof' ? 0.9 : p.kind === 'ring' ? 0.8 : 0.35));
  }

  // ---------------------------------------------------------------- the minimap
  private mini: HTMLCanvasElement | null = null; private miniFor: World | null = null;
  /** Draws the minimap into its own canvas: terrain, everything you can see, the fog and the camera. */
  minimap(cv: HTMLCanvasElement, w: World, me: number) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const c = cv.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0);
    const k = Math.min(cv.width / w.W, cv.height / w.H), ox = (cv.width - w.W * k) / 2, oy = (cv.height - w.H * k) / 2;
    if (!this.mini || this.miniFor !== w) {
      const m = document.createElement('canvas'); m.width = w.W; m.height = w.H; const mc = m.getContext('2d')!, id = mc.createImageData(w.W, w.H);
      const col: Record<number, [number, number, number]> = { [GRASS]: [118, 168, 82], [WATER]: [86, 158, 196], [TREE]: [52, 98, 54], [ROCK]: [128, 124, 118], [DIRT]: [196, 168, 120] };
      for (let i = 0; i < w.terrain.length; i++) { const [rr, gg, bb] = col[w.terrain[i]] ?? col[GRASS]; id.data[i * 4] = rr; id.data[i * 4 + 1] = gg; id.data[i * 4 + 2] = bb; id.data[i * 4 + 3] = 255; }
      mc.putImageData(id, 0, 0); this.mini = m; this.miniFor = w;
    }
    c.fillStyle = '#1b2418'; c.fillRect(0, 0, cv.width, cv.height);
    c.imageSmoothingEnabled = false; c.drawImage(this.mini, ox, oy, w.W * k, w.H * k);
    const team = w.players[me].team, v = w.vis.get(team)!;
    for (const n of w.nodes) if (v[n.ty * w.W + n.tx] > 0) { c.fillStyle = n.res === 'hay' ? '#f0c85a' : '#9ff0e6'; c.fillRect(ox + n.tx * k, oy + n.ty * k, 2 * k, 2 * k); }
    for (const b of w.buildings) if (w.players[b.owner].team === team || w.seenBuilding(team, b)) { c.fillStyle = w.players[b.owner].color; c.fillRect(ox + b.tx * k, oy + b.ty * k, b.size * k, b.size * k); }
    for (const [, kb] of w.known.get(team)!) { c.strokeStyle = w.players[kb.owner].color; c.lineWidth = 1; c.strokeRect(ox + kb.tx * k, oy + kb.ty * k, kb.size * k, kb.size * k); }
    const dot = Math.max(2, k * 0.9);
    for (const u of w.units) if (!u.under && (w.players[u.owner].team === team || w.seen(team, u.x, u.y))) { c.fillStyle = w.players[u.owner].color; c.fillRect(ox + (u.x / T) * k - dot / 2, oy + (u.y / T) * k - dot / 2, dot, dot); }
    c.drawImage(this.fogLayer(w, me), ox, oy, w.W * k, w.H * k);
    c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, dpr);
    const tp = this.tp; c.strokeRect(ox + (this.cam.x / tp) * k, oy + (this.cam.y / tp) * k, (this.w / tp) * k, (this.h / tp) * k);
  }
  /** Where a click on the minimap points, in world units. */
  miniToWorld(cv: HTMLCanvasElement, w: World, px: number, py: number) {
    const r = cv.getBoundingClientRect(), k = Math.min(r.width / w.W, r.height / w.H), ox = (r.width - w.W * k) / 2, oy = (r.height - w.H * k) / 2;
    return [Math.round(((px - ox) / k) * T), Math.round(((py - oy) / k) * T)] as [number, number];
  }
}

/** Draws a unit's stand-in (or painting) into a little canvas, for the HUD's cards and buttons. */
export function unitIcon(scene: CommandScene, type: string, side: string, px: number): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = px * 2; cv.height = px * 2; const c = cv.getContext('2d')!;
  c.scale(2, 2);
  const im = scene.img(`unit-${side}-${type}`);
  if (im) c.drawImage(im, 0, 0, px, px);
  else { c.translate(px / 2, px * 0.86); scene.paintUnit(c, type, side, px * 0.62, 1, 0); }
  return cv;
}

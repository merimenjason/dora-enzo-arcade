// Jade Street: drawing the city (Canvas 2D). The ground, decals, building blocks and ground-level props are baked into
// 8×8-tile chunk canvases on demand (an LRU keeps ~40), so a frame draws a dozen chunk images plus only the moving
// and tall things on screen, y-sorted: stalls, lamps, trees, rides, traffic, townsfolk, wardens, magpies and the hero.
// Code draws only light and effects: lamp glows, the route line, torch beams, the blimp's spotlight, fog over locked
// districts, dust and sparkles. Every picture is a Codex painting from the atlases in public/art/jade-street/.
import { FRAMES, ATLASES, ATLAS_SIZE, TEXTURES } from './jade-art.js';
import { T, W, H, G, GROUND_NAMES, F_ROOF, districtAt, type City, type District } from './jade-city.js';
import { VEHICLES } from './jade-move.js';
import type { World, Ride } from './jade-game.js';
import type { Actor } from './jade-mission.js';
import { OUTFITS, PAINTS } from './jade-save.js';
import { lanterns } from './jade-heat.js';
import { Life } from './jade-life.js';

export const ART = '/art/jade-street/';
const CH = 8; // tiles per chunk
const images: Record<string, HTMLImageElement | HTMLCanvasElement> = {};
let loaded = false;

/** load and decode every atlas and ground texture; `progress` gets (done, total); rejects with the files that failed */
export function loadArt(base = ART, progress?: (done: number, total: number) => void): Promise<void> {
  const names = [...ATLASES.map(a => a as string), ...TEXTURES.map(t => 'tex-' + t)];
  let done = 0; const failed: string[] = [];
  progress?.(0, names.length);
  return Promise.all(names.map(n => new Promise<void>(res => {
    const ok = () => { done++; progress?.(done, names.length); res(); };
    const old = images[n] as HTMLImageElement | undefined;
    if (old && old.complete && old.naturalWidth) return ok();
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => undefined).then(ok); };
    im.onerror = () => { delete images[n]; failed.push(n); done++; progress?.(done, names.length); res(); };
    im.src = `${base}${n}.webp${old ? '?r=' + Date.now() : ''}`; images[n] = im;
  }))).then(() => { if (failed.length) throw new Error('Could not load: ' + failed.join(', ')); loaded = true; });
}
export const artLoaded = () => loaded;

// ── sprite drawing
type Frame = [number, number, number, number, number];
const recolored = new Map<string, HTMLCanvasElement>();
function hueShift(src: HTMLImageElement | HTMLCanvasElement, f: Frame, test: (h: number, s: number, v: number) => boolean, deg: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = f[3]; c.height = f[4];
  const x = c.getContext('2d')!; x.drawImage(src, f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
  if (!deg) return c;
  const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 10) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    if (dl < 1e-3) continue;
    let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h *= 60; if (h < 0) h += 360;
    const s = dl / mx, v = mx;
    if (!test(h, s, v)) continue;
    h = (h + deg) % 360;
    const C = v * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - C;
    let rr = 0, gg = 0, bb = 0;
    if (h < 60) [rr, gg, bb] = [C, X, 0]; else if (h < 120) [rr, gg, bb] = [X, C, 0]; else if (h < 180) [rr, gg, bb] = [0, C, X]; else if (h < 240) [rr, gg, bb] = [0, X, C]; else if (h < 300) [rr, gg, bb] = [X, 0, C]; else [rr, gg, bb] = [C, 0, X];
    p[i] = (rr + m) * 255; p[i + 1] = (gg + m) * 255; p[i + 2] = (bb + m) * 255;
  }
  x.putImageData(d, 0, 0); return c;
}
const OUTFIT_HUE: Record<string, number> = { classic: 0, midnight: 1, temple: 2, canal: 3, harbour: 4, neon: 5 };
const DORA_TO = [0, 75, -100, 30, 140, 170], ENZO_TO = [0, 220, 40, 175, 270, 305];
/** the image and source rect for a frame, recoloured for outfits (hero jackets) and paint (rides) */
function src(name: string, variant = ''): [HTMLImageElement | HTMLCanvasElement, number, number, number, number] | null {
  const f = FRAMES[name] as Frame | undefined; if (!f) return null;
  const im = images[ATLASES[f[0]]] as HTMLImageElement | undefined; if (!im || !im.complete || !im.naturalWidth) return null;
  if (!variant) return [im, f[1], f[2], f[3], f[4]];
  const key = name + '|' + variant;
  let c = recolored.get(key);
  if (!c) {
    const [kind, v] = variant.split(':');
    if (kind === 'dora') c = hueShift(im, f, (h, s, val) => h > 95 && h < 185 && s > 0.25 && val > 0.12, (DORA_TO[+v] + 360) % 360);
    else if (kind === 'enzo') c = hueShift(im, f, (h, s, val) => (h < 18 || h > 345) && s > 0.55 && val > 0.3, (ENZO_TO[+v] + 360) % 360);
    else c = hueShift(im, f, (h, s) => s > 0.35 && !(h > 30 && h < 60 && s < 0.5), +v);
    recolored.set(key, c);
  }
  return [c, 0, 0, f[3], f[4]];
}
/** draw a sprite: (x, y) is the anchor (feet for 'bottom', middle for 'center'); `w` world width (default natural size) */
export function spr(x: CanvasRenderingContext2D, name: string, px: number, py: number, o: { w?: number; h?: number; anchor?: 'bottom' | 'center'; rot?: number; flip?: boolean; alpha?: number; variant?: string; sx?: number } = {}) {
  const s = src(name, o.variant); if (!s) return false;
  const [im, sx, sy, sw, sh] = s;
  let w = sw / 2, h = sh / 2;
  if (o.w && o.h) { w = o.w; h = o.h; } else if (o.w) { h = h * o.w / w; w = o.w; } else if (o.h) { w = w * o.h / h; h = o.h; }
  w *= o.sx ?? 1;
  const a = o.anchor ?? 'bottom';
  const rot = o.rot ?? 0;
  if (o.alpha !== undefined) x.globalAlpha = o.alpha;
  if (rot || o.flip) {
    x.save(); x.translate(px, py); if (rot) x.rotate(rot); if (o.flip) x.scale(-1, 1);
    x.drawImage(im, sx, sy, sw, sh, -w / 2, a === 'bottom' ? -h : -h / 2, w, h); x.restore();
  } else x.drawImage(im, sx, sy, sw, sh, px - w / 2, a === 'bottom' ? py - h : py - h / 2, w, h);
  if (o.alpha !== undefined) x.globalAlpha = 1;
  return true;
}
export const frameSize = (name: string) => { const f = FRAMES[name]; return f ? [f[3] / 2, f[4] / 2] : [0, 0]; };

// ── the hero's frame for an animation
export function heroFrame(h: string, anim: string, face: 'down' | 'up' | 'side', t: number): string {
  const cyc = (n: number, fps: number) => Math.floor(t * fps) % n;
  switch (anim) {
    case 'walk': return `${h}-walk-${face}-${cyc(4, 7)}`;
    case 'run': return `${h}-run-${face}-${cyc(4, 11)}`;
    case 'sneak': return face === 'side' ? `${h}-sneak` : `${h}-walk-${face}-${cyc(4, 4)}`;
    case 'dash': return `${h}-dash-${face}`;
    case 'hop': return `${h}-hop-${face}`;
    case 'bump': return `${h}-bump`;
    case 'pickup': return `${h}-pickup`;
    case 'hide': return `${h}-hide`;
    case 'carry': case 'carry-idle': return face === 'side' ? `${h}-carry-side` : `${h}-carry-down`;
    case 'climb-on': return `${h}-climb-on`;
    case 'climb-off': return `${h}-climb-off`;
    case 'celebrate': return `${h}-cheer-${cyc(2, 4)}`;
    case 'caught': return t < 0.6 ? `${h}-caught-0` : `${h}-caught-1`;
    case 'swap': return `${h}-swap`;
    case 'sleep': return `${h}-sleep`;
    case 'paint': return `${h}-paint-${cyc(2, 4)}`;
    case 'lockpick': return `${h}-pick-${cyc(2, 3)}`;
    case 'enter-door': return `${h}-door`;
    case 'climb': return `${h}-hop-up`;
    case 'talk': return `${h}-talk`;
    case 'wave': return `${h}-wave`;
    case 'barge': return face === 'side' ? `${h}-barge-side` : `${h}-barge-down`;
    case 'push': return face === 'up' ? `${h}-push-up-${cyc(2, 4)}` : `${h}-push-side-${cyc(2, 4)}`;
    case 'umbrella': return face === 'down' ? `${h}-umbrella` : `${h}-walk-${face}-${cyc(4, 7)}`;
    case 'phone': return `${h}-phone`;
    case 'eat': return `${h}-eat`;
    case 'dance': return t % 0.8 < 0.4 ? `${h}-dance` : `${h}-cheer-${cyc(2, 4)}`;
    case 'kneel': return `${h}-kneel`;
    case 'clap': return t % 0.5 < 0.25 ? `${h}-clap` : `${h}-wave`;
    case 'lantern': return `${h}-lantern`;
    case 'look-up': return `${h}-lookup`;
    default: return `${h}-idle-${face}`;
  }
}

export type Cam = { x: number; y: number; k: number; w: number; h: number };
type Chunk = { c: HTMLCanvasElement; s: number; used: number };

export class Scene {
  x: CanvasRenderingContext2D; w = 0; h = 0; dpr = 1;
  cam: Cam = { x: 0, y: 0, k: 1, w: 0, h: 0 };
  chunks = new Map<number, Chunk>(); frame = 0; t = 0;
  overBuckets: Map<number, number[]> = new Map();
  map: HTMLCanvasElement | null = null; mapK = 8;
  dust: { x: number; y: number; t: number; vx: number; vy: number; c: string; s: number }[] = [];
  shake = 0; lookX = 0; lookY = 0; zoomRide = 1;
  minimap = { x: 0, y: 0, r: 0, on: true };
  life = new Life(spr, (x, px, py, r, col) => this.glow(x, px, py, r, col));
  constructor(public cv: HTMLCanvasElement, public c: City) {
    this.x = cv.getContext('2d', { alpha: false })!;
    c.props.forEach((p, i) => { if (p.layer === 'ground') return; const k = Math.floor(p.x / T / CH) + Math.floor(p.y / T / CH) * 1000; const b = this.overBuckets.get(k) ?? []; b.push(i); this.overBuckets.set(k, b); });
  }
  resize(w: number, h: number, dpr: number) {
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
  }
  /** how many world units fit: phones see about 6.5 tiles across their short side so the hero reads; desktops more */
  baseZoom() {
    const short = Math.min(this.w, this.h), long = Math.max(this.w, this.h);
    if (short < 520) return Math.max(0.62, Math.min(1.1, Math.max(short / (6.2 * T), long / (13 * T))));
    return Math.max(0.6, Math.min(1.35, Math.sqrt(this.w * this.h) / (14.5 * T)));
  }

  // ── chunks: ground textures, kerbs, decals, building shadows, buildings and ground props
  private patterns: Record<string, CanvasPattern | null> = {};
  pattern(x: CanvasRenderingContext2D, n: string) {
    if (this.patterns[n] !== undefined) return this.patterns[n];
    const im = images['tex-' + n] as HTMLImageElement | undefined;
    if (!im || !im.complete || !im.naturalWidth) return null; // not loaded yet: don't cache the miss
    this.patterns[n] = x.createPattern(im, 'repeat'); return this.patterns[n];
  }
  chunk(cx: number, cy: number, s: number): HTMLCanvasElement {
    const key = cx + cy * 1000; const old = this.chunks.get(key);
    if (old && Math.abs(old.s - s) < 0.2) { old.used = this.frame; return old.c; }
    const c = old?.c ?? document.createElement('canvas');
    const size = Math.ceil(CH * T * s); c.width = size; c.height = size;
    const x = c.getContext('2d')!;
    x.setTransform(s, 0, 0, s, -cx * CH * T * s, -cy * CH * T * s);
    this.paintGround(x, cx * CH, cy * CH, CH, CH);
    this.chunks.set(key, { c, s, used: this.frame });
    if (this.chunks.size > 44) { let lo = Infinity, lk = -1; for (const [k, v] of this.chunks) if (v.used < lo) { lo = v.used; lk = k; } this.chunks.delete(lk); }
    return c;
  }
  /** paint tiles (tx0..tx0+n) of the city's ground layer into x (already transformed to world units) */
  paintGround(x: CanvasRenderingContext2D, tx0: number, ty0: number, nw: number, nh: number, simple = false) {
    const c = this.c;
    const texOf = (g: number) => g === G.BRIDGE ? 'canal' : g === G.STAIRS ? 'temple' : g === G.BLD ? 'plaza' : GROUND_NAMES[g];
    const byTex = new Map<string, number[]>();
    for (let ty = ty0; ty < ty0 + nh; ty++) for (let tx = tx0; tx < tx0 + nw; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const n = texOf(c.ground[ty * W + tx]); const a = byTex.get(n) ?? []; a.push(tx, ty); byTex.set(n, a);
    }
    for (const [n, a] of byTex) {
      const p = this.pattern(x, n);
      if (p) { p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0])); x.fillStyle = p; } else x.fillStyle = '#2a2440';
      x.beginPath(); for (let i = 0; i < a.length; i += 2) x.rect(a[i] * T - 0.5, a[i + 1] * T - 0.5, T + 1, T + 1); x.fill();
      // night: the painted ground sits a little darker so lamps, signs and people read on top of it
      const dim = n === 'canal' || n === 'sea' ? 0.12 : n === 'walk' || n === 'plaza' || n === 'temple' ? 0.34 : 0.24;
      x.fillStyle = `rgba(14,8,32,${dim})`; x.fill();
    }
    // kerbs: a lit edge and a soft shadow where the pavement meets the road; water edges get a stone lip
    x.lineWidth = 3;
    for (let ty = ty0; ty < ty0 + nh; ty++) for (let tx = tx0; tx < tx0 + nw; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const g = c.ground[ty * W + tx];
      const nb = (dx: number, dy: number) => { const X = tx + dx, Y = ty + dy; return X < 0 || Y < 0 || X >= W || Y >= H ? g : c.ground[Y * W + X]; };
      const water = (v: number) => v === G.CANAL || v === G.SEA;
      if (g === G.ROAD) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const o = nb(dx, dy); if (o === G.ROAD || o === G.BRIDGE || o === G.BLD) continue;
          x.strokeStyle = 'rgba(0,0,0,.35)'; x.beginPath();
          const x0 = tx * T + (dx === 1 ? T : 0), y0 = ty * T + (dy === 1 ? T : 0);
          if (dx) { x.moveTo(x0 - dx * 2, y0); x.lineTo(x0 - dx * 2, y0 + T); } else { x.moveTo(x0, y0 - dy * 2); x.lineTo(x0 + T, y0 - dy * 2); }
          x.stroke(); x.strokeStyle = 'rgba(255,230,190,.28)'; x.beginPath();
          if (dx) { x.moveTo(x0 + dx, y0); x.lineTo(x0 + dx, y0 + T); } else { x.moveTo(x0, y0 + dy); x.lineTo(x0 + T, y0 + dy); }
          x.stroke();
        }
      }
      if (!water(g) && g !== G.BRIDGE && g !== G.BLD) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (!water(nb(dx, dy))) continue;
        x.fillStyle = 'rgba(190,180,170,.85)';
        x.fillRect(tx * T + (dx === 1 ? T - 5 : 0), ty * T + (dy === 1 ? T - 5 : 0), dx ? 5 : T, dy ? 5 : T);
      }
    }
    for (const pa of c.paths) {
      const xs = pa.pts.map(q => q[0]), ys = pa.pts.map(q => q[1]);
      if (Math.max(...xs) < tx0 * T - 100 || Math.min(...xs) > (tx0 + nw) * T + 100 || Math.max(...ys) < ty0 * T - 100 || Math.min(...ys) > (ty0 + nh) * T + 100) continue;
      const pt = this.pattern(x, pa.tex); if (!pt) continue;
      pt.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(pa.pts[0][0], pa.pts[0][1]);
      for (let i = 1; i < pa.pts.length - 1; i++) { const mx = (pa.pts[i][0] + pa.pts[i + 1][0]) / 2, my = (pa.pts[i][1] + pa.pts[i + 1][1]) / 2; x.quadraticCurveTo(pa.pts[i][0], pa.pts[i][1], mx, my); }
      const lp = pa.pts[pa.pts.length - 1]; x.lineTo(lp[0], lp[1]);
      x.strokeStyle = 'rgba(10,6,24,.35)'; x.lineWidth = pa.w + 8; x.stroke();
      x.strokeStyle = pt; x.lineWidth = pa.w; x.stroke();
      x.strokeStyle = 'rgba(14,8,32,.22)'; x.stroke(); x.restore();
    }
    const inR = (px: number, py: number, m: number) => px > tx0 * T - m && px < (tx0 + nw) * T + m && py > ty0 * T - m && py < (ty0 + nh) * T + m;
    for (const d of c.decals) {
      if (!inR(d.x, d.y, 200)) continue;
      if (d.sprite.startsWith('d-bridge')) {
        const fs = frameSize(d.sprite); const hh = d.sprite === 'd-bridge-stone' ? 4.5 * T : 2.7 * T;
        void fs;
        const s2 = src(d.sprite); if (s2) { x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], d.x - (d.w ?? 0) / 2, d.y - hh / 2, d.w ?? 0, hh); }
        continue;
      }
      if (!simple) spr(x, d.sprite, d.x, d.y, { w: d.w, anchor: 'center', rot: d.rot, alpha: d.sprite === 'd-dash' || d.sprite === 'd-zebra' ? 0.75 : 0.9 });
    }
    for (const p of c.props) if (p.layer === 'ground' && inR(p.x, p.y, 200)) {
      if (p.sprite.startsWith('containers')) { const s2 = src('containers'); if (s2) { const l = p.w ?? 128; x.save(); x.translate(p.x, p.y); x.rotate(p.rot ?? 0); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-l / 2 + 6, -T / 2 + 8, l, T); x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], -l / 2, -T / 2 - 14, l, T + 14); x.restore(); } continue; }
      if (p.sprite === 'hedge') { spr(x, 'plants', p.x, p.y + 24, { w: 62 }); continue; }
      spr(x, p.sprite, p.x, p.y + (p.solid === 'low' ? 26 : 30), { w: (p.sprite === 'lucky-circle' ? 120 : undefined), anchor: p.sprite === 'lucky-circle' ? 'center' : 'bottom' });
    }
    // buildings with a soft drop shadow
    // buildings, each casting a soft shadow down and to the right (baked once into the chunk)
    const k = x.getTransform().a;
    if (!simple) { x.shadowColor = 'rgba(6,4,18,.6)'; x.shadowBlur = 16 * k; x.shadowOffsetX = 9 * k; x.shadowOffsetY = 13 * k; }
    for (const b of c.buildings) {
      if (b.x + b.w < tx0 - 1 || b.x > tx0 + nw + 1 || b.y + b.h < ty0 - 1 || b.y > ty0 + nh + 1) continue;
      const s2 = src(b.sprite);
      if (s2) x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], b.x * T - 2, b.y * T - 4, b.w * T + 4, b.h * T + 6);
      else { x.fillStyle = '#5a3040'; x.fillRect(b.x * T, b.y * T, b.w * T, b.h * T); }
    }
    x.shadowColor = 'rgba(0,0,0,0)'; x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
  }

  // ── the whole-city map (minimap and the full map screen use it)
  buildMap(): HTMLCanvasElement {
    if (this.map) return this.map;
    const k = this.mapK; const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    const x = c.getContext('2d')!; x.setTransform(k / T, 0, 0, k / T, 0, 0);
    this.paintGround(x, 0, 0, W, H, true);
    this.map = c; return c;
  }

  // ── a frame
  draw(w: World, dt: number) {
    const x = this.x; this.frame++; this.t += dt;
    const p = w.p; const ride = p.ride;
    // camera: lead in the direction of travel, pull out a little when riding fast
    const sp = ride ? ride.b.speed : p.b.speed, hd = ride ? ride.b.h : p.b.h;
    const phone = Math.min(this.w, this.h) < 520;
    const lead = ride ? Math.min(phone ? 210 : 160, sp * (phone ? 0.6 : 0.45)) : Math.min(50, sp * 0.2);
    this.lookX += (Math.cos(hd) * lead - this.lookX) * Math.min(1, dt * 2.5);
    this.lookY += (Math.sin(hd) * lead - this.lookY) * Math.min(1, dt * 2.5);
    const zr = ride ? (phone ? 0.86 - Math.min(0.14, sp / 2600) : 0.9 - Math.min(0.1, sp / 3400)) : 1;
    this.zoomRide += (zr - this.zoomRide) * Math.min(1, dt * 1.5);
    const k = this.baseZoom() * this.zoomRide;
    this.shake = Math.max(0, this.shake - dt * 3);
    const shx = this.shake > 0 ? (Math.sin(this.t * 70) * 6 * this.shake) : 0, shy = this.shake > 0 ? Math.cos(this.t * 63) * 5 * this.shake : 0;
    const cam = this.cam; cam.k = k; cam.w = this.w / k; cam.h = this.h / k;
    cam.x = Math.max(cam.w / 2, Math.min(W * T - cam.w / 2, p.x + this.lookX)) + shx;
    cam.y = Math.max(cam.h / 2, Math.min(H * T - cam.h / 2, p.y + this.lookY)) + shy;
    const ox = cam.x - cam.w / 2, oy = cam.y - cam.h / 2;
    const s = this.dpr * k;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#100c20'; x.fillRect(0, 0, this.cv.width, this.cv.height);
    x.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    x.imageSmoothingEnabled = true;
    // chunks (at most a couple of new ones a frame; the rest wait a frame)
    const cs = Math.min(1.6, Math.max(0.5, Math.round(s * 4) / 4));
    let made = 0;
    const cx0 = Math.floor(ox / (CH * T)), cy0 = Math.floor(oy / (CH * T)), cx1 = Math.floor((ox + cam.w) / (CH * T)), cy1 = Math.floor((oy + cam.h) / (CH * T));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CH >= W || cy * CH >= H) continue;
      const key = cx + cy * 1000, have = this.chunks.get(key);
      if (!have || Math.abs(have.s - cs) >= 0.2) { if (made >= 3 && have) { x.drawImage(have.c, cx * CH * T, cy * CH * T, CH * T, CH * T); have.used = this.frame; continue; } made++; }
      const c = this.chunk(cx, cy, cs);
      x.drawImage(c, cx * CH * T, cy * CH * T, CH * T, CH * T);
    }
    this.water(x, ox, oy, cam.w, cam.h);
    this.routeLine(x, w);
    this.markers(x, w, 'ground');
    // y-sorted things
    const list: [number, () => void][] = [];
    const vis = (px: number, py: number, m = 160) => px > ox - m && px < ox + cam.w + m && py > oy - m && py < oy + cam.h + m * 1.5;
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      const b = this.overBuckets.get(cx + cy * 1000); if (!b) continue;
      for (const i of b) { const pr = this.c.props[i]; if (pr.layer !== 'over' || !vis(pr.x, pr.y)) continue; list.push([pr.y + (pr.sprite.startsWith('stall') ? 20 : 0), () => this.prop(x, pr)]); }
    }
    for (const r of w.rides) if (r !== ride && vis(r.b.x, r.b.y)) list.push([r.b.y, () => this.ride(x, w, r, false)]);
    for (const c of w.cars) if (vis(c.x, c.y)) list.push([c.y, () => { x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, c.x + 5, c.y + 7, c.len * 0.5, c.rad); spr(x, c.sprite, c.x, c.y, { anchor: 'center', rot: c.h + Math.PI / 2 + (c.wob > 0 ? Math.sin(this.t * 40) * 0.06 : 0) }); }]);
    for (const pd of w.peds) if (vis(pd.x, pd.y)) list.push([pd.y, () => this.ped(x, w, pd)]);
    for (const wd of w.wardens) if (vis(wd.b.x, wd.b.y)) list.push([wd.b.y, () => this.warden(x, wd)]);
    for (const b of w.blocks) if (vis(b.x, b.y)) list.push([b.y, () => spr(x, b.sprite, b.x, b.y, { anchor: 'center', rot: b.h, w: 100, alpha: b.knocked > 0 ? Math.max(0, 1 - b.knocked) : 1 })]);
    if (w.run) for (const a of w.run.actors) if (vis(a.b.x, a.b.y) && a.kind !== 'swoop') list.push([a.b.y, () => this.actor(x, w, a)]);
    this.c.cats.forEach((ct, i) => { if (w.s.cats.includes(i) || !vis(ct.x, ct.y) || !w.open.has(districtAt(Math.floor(ct.x / T), Math.floor(ct.y / T)))) return; list.push([ct.y, () => this.cat(x, ct.x, ct.y, i)]); });
    for (const m of this.c.murals) if (vis(m.x, m.y)) list.push([m.y - 40, () => spr(x, w.s.murals.includes(m.id) ? 'mural-fresh' : 'mural-faded', m.x, m.y + 6, { w: 84 })]);
    for (const l of this.c.ladders) if (vis(l.x * T, l.y * T)) list.push([l.y * T + 10, () => spr(x, 'fire-ladder', l.x * T + T / 2, l.y * T + T - 4, { h: 96 })]);
    this.life.sorted(x, w, list, vis, this.t);
    if (!p.roof) list.push([p.y + 1, () => this.hero(x, w)]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, f] of list) f();
    if (p.roof) { this.roofDim(x, ox, oy, cam.w, cam.h); this.markers(x, w, 'roof'); this.hero(x, w); }
    this.markers(x, w, 'over');
    // flying and overhead things
    for (const pr of this.c.props) if (pr.layer === 'sky' && vis(pr.x, pr.y, 200)) {
      if (pr.sprite.startsWith('lanterns')) { this.lanternString(x, pr.x, pr.y, pr.w ?? 4 * T, pr.rot ?? 0, pr.sprite.endsWith('gold')); continue; }
      const fs = frameSize(pr.sprite); const lw = pr.w ?? fs[0];
      spr(x, pr.sprite, pr.x, pr.y, { w: lw, anchor: 'center', rot: pr.rot, alpha: 0.95 });
    }
    for (const m of w.snatchers) this.flyer(x, m.x, m.y, m.h, m.wing);
    if (w.run) for (const a of w.run.actors) if (a.kind === 'swoop') this.flyer(x, a.b.x, a.b.y, a.b.h + (a.stun > 0 ? this.t * 12 : 0), a.t * 9);
    this.life.over(x, w, vis, dt, cam);
    this.life.rainWorld(x, w, dt, cam);
    this.lights(x, w, ox, oy, cam.w, cam.h);
    if (w.blimp.on) this.blimp(x, w);
    this.fog(x, w, ox, oy, cam.w, cam.h);
    this.particles(x, dt);
    // night tint by the clock and a soft vignette (screen space)
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cl = w.s.clock;
    if (cl < 90) { x.fillStyle = `rgba(120,60,140,${0.16 * (1 - cl / 90)})`; x.fillRect(0, 0, this.w, this.h); }
    if (cl > 630) { x.fillStyle = `rgba(255,140,120,${0.14 * (cl - 630) / 90})`; x.fillRect(0, 0, this.w, this.h); }
    const g = x.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    g.addColorStop(0, 'rgba(10,6,30,0)'); g.addColorStop(1, 'rgba(10,6,30,.45)'); x.fillStyle = g; x.fillRect(0, 0, this.w, this.h);
    if (lanterns(w) >= 1) { const a = 0.08 + 0.05 * Math.sin(this.t * 6); x.fillStyle = `rgba(255,40,60,${a * lanterns(w) / 5})`; x.fillRect(0, 0, this.w, 6); x.fillRect(0, this.h - 6, this.w, 6); }
    this.life.rainScreen(x, w, this.w, this.h, this.t);
    if (this.minimap.on) this.drawMinimap(x, w);
  }
  /** a string of paper lanterns across the street: a sagging cable with upright painted lanterns hung along it */
  lanternString(x: CanvasRenderingContext2D, cx: number, cy: number, len: number, rot: number, gold: boolean) {
    const dx = Math.cos(rot) * len / 2, dy = Math.sin(rot) * len / 2;
    const ax = cx - dx, ay = cy - dy, bx = cx + dx, by = cy + dy, sag = 26;
    x.strokeStyle = 'rgba(40,20,20,.85)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ax, ay); x.quadraticCurveTo(cx + sag * 0.3, cy + sag, bx, by); x.stroke();
    const n = Math.max(3, Math.round(len / 70));
    for (let i = 1; i < n; i++) {
      const t = i / n, u = 1 - t;
      const px = u * u * ax + 2 * u * t * (cx + sag * 0.3) + t * t * bx, py = u * u * ay + 2 * u * t * (cy + sag) + t * t * by;
      const sw = Math.sin(this.t * 1.6 + i + cx * 0.01) * 0.08;
      spr(x, 'ui-lantern-on', px, py + 30, { h: 40, rot: sw, variant: gold ? 'paint:40' : '' });
    }
  }
  shadow(x: CanvasRenderingContext2D, px: number, py: number, rx: number, ry: number) { x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); x.fill(); }

  prop(x: CanvasRenderingContext2D, p: City['props'][number]) {
    if (p.sprite.startsWith('tree') || p.sprite === 'palm') { x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, p.x + 10, p.y + 14, 44, 30); spr(x, p.sprite, p.x, p.y, { anchor: 'center', rot: Math.sin(this.t * 0.8 + p.x) * 0.03 }); return; }
    if (p.sprite.startsWith('stall')) { spr(x, p.sprite, p.x, p.y + 34, { w: p.w }); return; }
    if (p.sprite === 'crane') { spr(x, 'crane', p.x, p.y + 30, {}); return; }
    spr(x, p.sprite, p.x, p.y + 12, {});
  }
  ride(x: CanvasRenderingContext2D, w: World, r: Ride, player: boolean) {
    const name = r.broken ? 'van-broken' : 'v-' + r.kind; const paint = player ? PAINTS.find(q => q.id === w.s.paint)?.filter ?? 0 : [0, 140, 40, 210, 280][r.tint % 5];
    x.fillStyle = 'rgba(0,0,0,.32)'; this.shadow(x, r.b.x + 5, r.b.y + 7, VEHICLES[r.kind].len * 0.45, VEHICLES[r.kind].r * 0.9);
    const bob = r.kind === 'boat' ? Math.sin(this.t * 2 + r.id) * 0.03 : 0;
    spr(x, name, r.b.x, r.b.y, { anchor: 'center', rot: r.b.h + Math.PI / 2 + bob, variant: paint ? 'paint:' + paint : '' });
    if (r.locked && !player) { const b = Math.sin(this.t * 4) * 3; spr(x, 'i-key', r.b.x, r.b.y - 30 + b, { w: 26, anchor: 'center' }); }
  }
  hero(x: CanvasRenderingContext2D, w: World) {
    const p = w.p, h = w.s.hero; const of = OUTFITS.findIndex(o => o.id === w.s.outfit[h]);
    const variant = of > 0 ? `${h}:${of}` : '';
    if (p.ride) {
      const r = p.ride; this.ride(x, w, r, true);
      const k = r.kind; const fwd = k === 'trishaw' ? -0.3 : k === 'boat' ? -0.32 : 0.02;
      const rx = r.b.x + Math.cos(r.b.h) * VEHICLES[k].len * fwd, ry = r.b.y + Math.sin(r.b.h) * VEHICLES[k].len * fwd;
      let f = '';
      if (p.anim === 'ride-bump') f = `${h}-ride-bump`;
      else if (k === 'scooter') f = w.run && w.banner?.text === 'Job done!' ? `${h}-ride-cheer` : `${h}-ride-scooter-${Math.sin(this.t * 3) > 0 ? 0 : 1}`;
      else if (k === 'trishaw') f = `${h}-ride-pedal-${Math.floor(this.t * (2 + r.b.speed / 50)) % 2}`;
      else if (k === 'boat') f = `${h}-ride-pole-${Math.floor(this.t * 1.5) % 2}`;
      if (f) spr(x, f, rx, ry, { anchor: 'center', rot: r.b.h + Math.PI / 2, variant });
      else { // tuk-tuk and van: the hero's ears peek over the seat
        spr(x, `${h}-ride-scooter-0`, rx + Math.cos(r.b.h) * 6, ry + Math.sin(r.b.h) * 6, { anchor: 'center', rot: r.b.h + Math.PI / 2, w: 26, alpha: 0.0 });
      }
      if (p.carry) spr(x, itemSprite(p.carry), r.b.x, r.b.y, { w: 26, anchor: 'center', rot: r.b.h + Math.PI / 2 });
      return;
    }
    const hop = p.anim === 'umbrella' ? Math.abs(Math.sin(p.animT * 7)) * 2 : p.anim === 'hop' ? Math.sin(Math.min(1, 1 - p.hopT / 0.42) * Math.PI) * 26 : p.anim === 'climb' ? Math.sin(p.act ? p.act.t * 12 : 0) * 6 + 10 : 0;
    x.fillStyle = 'rgba(0,0,0,.35)'; this.shadow(x, p.b.x, p.b.y + 2, 16 - hop * 0.2, 7 - hop * 0.08);
    if (p.anim === 'dash') this.puff(p.b.x - Math.cos(p.b.h) * 14, p.b.y + 4, '#d8d0e8');
    const f = heroFrame(h, p.anim, p.face, p.act ? p.act.t : p.animT);
    const flip = p.face === 'side' && p.flip;
    spr(x, f, p.b.x, p.b.y + 4 - hop, { flip, variant, alpha: p.hide ? 0.55 : 1 }) || spr(x, `${h}-idle-down`, p.b.x, p.b.y + 4, { variant });
    if (p.carry && !p.anim.startsWith('carry')) spr(x, itemSprite(p.carry), p.b.x, p.b.y - 54 - hop, { w: 28 });
    if (p.anim === 'umbrella' && p.face !== 'down') spr(x, 'umb-red', p.b.x, p.b.y - 46, { w: 46, anchor: 'center' });
  }
  ped(x: CanvasRenderingContext2D, w: World, pd: World['peds'][number]) {
    const cx = Math.cos(pd.h), sy = Math.sin(pd.h);
    let f = `folk-${pd.sp}-`, flip = false;
    const sit = this.life.pedOver(x, w, pd, this.t);
    if (sit) { x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, pd.x, pd.y + 2, 14, 5); spr(x, sit, pd.x, pd.y + 6, { flip: cx < 0 }); return; }
    if (pd.hop > 0) f += 'hop';
    else if (Math.abs(cx) > Math.abs(sy)) { f += 'side-' + (Math.floor(pd.walk * 5) % 2); flip = cx < 0; }
    else f += sy > 0 ? 'down' : 'up';
    const hop = pd.hop > 0 ? Math.sin((1 - pd.hop / 0.42) * Math.PI) * 18 : Math.abs(Math.sin(pd.walk * 9)) * (pd.wait > 0 ? 0 : 2);
    x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, pd.x, pd.y + 2, 12, 5);
    spr(x, f, pd.x, pd.y + 4 - hop, { flip });
    this.life.umbrella(x, w, pd, hop);
  }
  warden(x: CanvasRenderingContext2D, wd: World['wardens'][number]) {
    x.fillStyle = 'rgba(0,0,0,.3)'; this.shadow(x, wd.b.x + 4, wd.b.y + 6, 26, 12);
    const rot = wd.b.h + Math.PI / 2 + (wd.stun > 0 ? Math.sin(this.t * 30) * 0.4 : 0);
    spr(x, Math.floor(wd.pedal * (2 + wd.b.speed / 60)) % 2 ? 'warden-bike-a' : 'warden-bike-b', wd.b.x, wd.b.y, { anchor: 'center', rot });
    if (wd.stun > 0) this.stars(x, wd.b.x, wd.b.y - 20);
    // the bike's flashing lamp
    const on = Math.floor(this.t * 6 + wd.id) % 2 === 0;
    x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(wd.b.x, wd.b.y, 2, wd.b.x, wd.b.y, 46); g.addColorStop(0, on ? 'rgba(255,60,60,.55)' : 'rgba(80,140,255,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(wd.b.x - 46, wd.b.y - 46, 92, 92); x.restore();
  }
  actor(x: CanvasRenderingContext2D, w: World, a: Actor) {
    const b = a.b; const fl = Math.floor(a.t * 6) % 2;
    x.fillStyle = 'rgba(0,0,0,.3)';
    switch (a.kind) {
      case 'cart': this.shadow(x, b.x + 4, b.y + 6, 36, 18); spr(x, `mag-cart-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 + (a.stun > 0 ? Math.sin(this.t * 30) * 0.3 : 0) }); if (a.stun > 0) this.stars(x, b.x, b.y - 30); break;
      case 'boss': this.shadow(x, b.x + 4, b.y + 6, 30, 14); spr(x, `boss-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 + (a.stun > 0 ? Math.sin(this.t * 30) * 0.3 : 0) }); if (a.stun > 0) this.stars(x, b.x, b.y - 30); this.glow(x, b.x, b.y, 70, 'rgba(190,80,255,.35)'); break;
      case 'boat': spr(x, `mag-boat-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 + Math.sin(this.t * 3) * 0.04 }); if (a.stun > 0) this.stars(x, b.x, b.y - 30); this.glow(x, b.x, b.y, 60, 'rgba(255,250,220,.3)'); break;
      case 'rival-scooter': this.shadow(x, b.x + 4, b.y + 6, 30, 14); spr(x, `boss-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2, w: 32, variant: 'paint:120' }); break;
      case 'rival-boat': spr(x, `mag-boat-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 }); break;
      case 'runner': case 'rival-runner': case 'pip': case 'lookout': {
        this.shadow(x, b.x, b.y + 2, 14, 6);
        const cx = Math.cos(b.h), sy = Math.sin(b.h); let f: string, flip = false;
        if (a.stun > 0) f = 'mag-dizzy';
        else if (a.look > 0) f = `mag-look-${Math.floor(a.look * 2) % 2}`;
        else if (b.speed < 5) f = a.kind === 'pip' && a.t < 1 ? 'mag-taunt' : 'mag-walk-down-0';
        else if (Math.abs(cx) > Math.abs(sy)) { f = `mag-run-${Math.floor(a.t * (a.kind === 'pip' || a.kind === 'lookout' ? 5 : 9)) % 2}`; flip = cx < 0; }
        else f = `mag-walk-${sy > 0 ? 'down' : 'up'}-${fl}`;
        if (a.kind === 'lookout') this.beam(x, b.x, b.y - 20, a.b.h, w.assist ? 170 : 215, w.assist ? 0.45 : 0.55);
        if (a.kind === 'pip' && a.look > 0) this.beam(x, b.x, b.y - 20, a.face, w.assist ? 165 : 210, 1.2);
        spr(x, f, b.x, b.y + 4, { flip });
        if (a.kind === 'runner' && a.stun <= 0) spr(x, 'coins', b.x, b.y - 52, { w: 20 });
        break;
      }
      case 'lion': this.shadow(x, b.x, b.y + 4, 44, 14); spr(x, `lion-${Math.floor(a.t * 3) % 2}`, b.x, b.y + 8, { flip: Math.cos(b.h) < 0 }); break;
    }
  }
  flyer(x: CanvasRenderingContext2D, px: number, py: number, h: number, wing: number) {
    x.fillStyle = 'rgba(0,0,0,.22)'; this.shadow(x, px + 30, py + 50, 22, 10);
    spr(x, Math.floor(wing) % 2 ? 'mag-fly-0' : 'mag-fly-1', px, py, { anchor: 'center', rot: h + Math.PI / 2 });
  }
  cat(x: CanvasRenderingContext2D, px: number, py: number, i: number) {
    const b = Math.sin(this.t * 3 + i) * 3;
    this.glow(x, px, py - 10, 34, 'rgba(255,215,90,.35)');
    spr(x, 'lucky-cat', px, py + 6 + b, { w: 30 });
    if (Math.floor(this.t * 2 + i) % 3 === 0) this.sparkle(x, px + 10, py - 26 + b);
  }
  beam(x: CanvasRenderingContext2D, px: number, py: number, h: number, r: number, half: number) {
    x.save(); const g = x.createRadialGradient(px, py, 10, px, py, r); g.addColorStop(0, 'rgba(255,240,150,.38)'); g.addColorStop(1, 'rgba(255,240,150,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(px, py); x.arc(px, py, r, h - half, h + half); x.closePath(); x.fill(); x.restore();
  }
  glow(x: CanvasRenderingContext2D, px: number, py: number, r: number, col: string) {
    x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); x.restore();
  }
  sparkle(x: CanvasRenderingContext2D, px: number, py: number) { x.save(); x.fillStyle = 'rgba(255,250,210,.9)'; x.translate(px, py); x.rotate(this.t * 2); x.fillRect(-1, -6, 2, 12); x.fillRect(-6, -1, 12, 2); x.restore(); }
  stars(x: CanvasRenderingContext2D, px: number, py: number) { for (let i = 0; i < 3; i++) { const a = this.t * 5 + i * 2.1; this.sparkle(x, px + Math.cos(a) * 16, py + Math.sin(a) * 6); } }
  puff(px: number, py: number, c: string) { if (this.dust.length < 160) this.dust.push({ x: px, y: py, t: 0, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, c, s: 6 + Math.random() * 5 }); }
  burst(px: number, py: number, c: string, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120; this.dust.push({ x: px, y: py, t: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, s: 4 + Math.random() * 4 }); } }
  particles(x: CanvasRenderingContext2D, dt: number) {
    for (const d of this.dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.94; d.vy *= 0.94; }
    this.dust = this.dust.filter(d => d.t < 0.7);
    for (const d of this.dust) { x.globalAlpha = Math.max(0, 0.7 - d.t); x.fillStyle = d.c; x.beginPath(); x.arc(d.x, d.y, d.s * (1 + d.t), 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
  }
  water(x: CanvasRenderingContext2D, ox: number, oy: number, cw: number, ch: number) {
    // a slow shimmer of lantern light on the canal and the harbour
    const tx0 = Math.max(0, Math.floor(ox / T)), tx1 = Math.min(W - 1, Math.floor((ox + cw) / T)), ty0 = Math.max(0, Math.floor(oy / T)), ty1 = Math.min(H - 1, Math.floor((oy + ch) / T));
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const g = this.c.ground[ty * W + tx]; if (g !== G.CANAL && g !== G.SEA) continue;
      const a = 0.05 + 0.05 * Math.sin(this.t * 1.7 + tx * 0.9 + ty * 1.3);
      x.fillStyle = `rgba(120,200,255,${a})`; x.fillRect(tx * T + 8 + Math.sin(this.t + ty) * 8, ty * T + 20, 30, 3);
      x.fillStyle = `rgba(255,160,120,${a * 0.8})`; x.fillRect(tx * T + 30 + Math.cos(this.t * 1.3 + tx) * 8, ty * T + 44, 22, 2);
    }
    x.restore();
  }
  roofDim(x: CanvasRenderingContext2D, ox: number, oy: number, cw: number, ch: number) {
    // up on the roofs: the street below falls into shadow, the terraces stay lit
    x.fillStyle = 'rgba(8,5,22,.45)'; x.fillRect(ox, oy, cw, ch);
    for (const b of this.c.buildings) if (b.roof) { const s2 = src(b.sprite); if (s2) x.drawImage(s2[0], s2[1], s2[2], s2[3], s2[4], b.x * T - 2, b.y * T - 4, b.w * T + 4, b.h * T + 6); }
    void F_ROOF;
  }
  routeLine(x: CanvasRenderingContext2D, w: World) {
    if (!(w.assist || (!w.run && w.waypoint)) || w.route.length < 2) return;
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(w.p.x, w.p.y); for (let i = 1; i < w.route.length; i++) x.lineTo(w.route[i][0], w.route[i][1]);
    x.strokeStyle = 'rgba(255,214,90,.25)'; x.lineWidth = 18; x.stroke();
    x.setLineDash([14, 18]); x.lineDashOffset = -this.t * 40; x.strokeStyle = 'rgba(255,230,140,.85)'; x.lineWidth = 6; x.stroke();
    x.restore();
  }
  markers(x: CanvasRenderingContext2D, w: World, layer: 'ground' | 'over' | 'roof') {
    const run = w.run; const b = Math.sin(this.t * 4) * 5;
    if (layer === 'ground') {
      // pins: contacts with a job for you, markets, safe houses, garages, gigs
      if (!run) {
        for (const n of nearList(w)) {
          if (n.kind === 'mission') { this.glow(x, n.x, n.y, 70, 'rgba(255,210,80,.35)'); }
        }
      }
      if (run) {
        for (const it of run.items) if (!it.got) { this.glow(x, it.x, it.y, 46, 'rgba(255,200,80,.4)'); spr(x, itemSprite(it.sprite), it.x, it.y + 10, { w: it.sprite === 'lookout' ? 60 : 30 }); }
        if (run.loot) { this.glow(x, run.loot.x, run.loot.y, 54, 'rgba(120,255,200,.45)'); spr(x, run.loot.sprite, run.loot.x, run.loot.y + 8 + b * 0.4, { w: 40 }); }
        if (run.cur.t === 'pickup' && run.cur.at !== 'loot') { const [px, py] = run.spot(run.cur.at); spr(x, itemSprite(run.cur.item), px, py + 10, { w: 34 }); }
        if (run.fare) { const f = run.fare; if (!f.to) spr(x, `folk-${f.sp}-hop`, f.x, f.y + 4, {}); }
      }
      return;
    }
    if (layer === 'roof' || layer === 'over') {
      if (run) {
        const marks = run.marks; const st = run.cur;
        if (st && st.t === 'race' && !!st.roof === (layer === 'roof')) for (let i = run.mark; i < Math.min(marks.length, run.mark + 2); i++) spr(x, 'gate', marks[i][0], marks[i][1] + 16, { w: i === run.mark ? 76 : 50, alpha: i === run.mark ? 1 : 0.5 });
        const o = w.objective();
        if (o && layer === 'over' && !(st && st.t === 'race')) { this.glow(x, o[0], o[1], 50, 'rgba(255,220,90,.4)'); spr(x, 'ui-arrow', o[0], o[1] - 50 + b, { w: 34, rot: Math.PI, anchor: 'center' }); }
      }
      if (layer === 'over' && !run) for (const n of nearList(w)) {
        if (n.kind !== 'mission') continue;
        const m = MISSION_FACE(n.id!);
        spr(x, 'ui-ring', n.x, n.y - 40 + b, { w: 64, anchor: 'center' });
        spr(x, m, n.x, n.y - 40 + b, { w: 46, anchor: 'center' });
        spr(x, 'ui-pin', n.x, n.y - 2 + b * 0.3, { w: 22 });
      }
      if (layer === 'over') for (const [, pl] of Object.entries(this.c.places)) {
        if (!w.open.has(pl.d)) continue;
        const icon = pl.kind === 'market' ? 'ui-coin' : pl.kind === 'safe' ? 'i-safe' : pl.kind === 'garage' ? 'i-garage' : pl.kind === 'contact' ? '' : '';
        if (icon) spr(x, icon, pl.x, pl.y - 34 + Math.sin(this.t * 2 + pl.x) * 3, { w: 30, anchor: 'center', alpha: 0.95 });
        if (pl.kind === 'contact') { spr(x, 'ui-ring', pl.x, pl.y - 26, { w: 46, anchor: 'center', alpha: 0.9 }); spr(x, 'face-' + contactFace(pl.name ?? ''), pl.x, pl.y - 26, { w: 32, anchor: 'center' }); }
      }
      if (layer === 'over' && !run) for (const g of w.gigs()) spr(x, 'flag', g.x, g.y + 6 + b * 0.2, { w: 26 });
    }
  }
  lights(x: CanvasRenderingContext2D, w: World, ox: number, oy: number, cw: number, ch: number) {
    x.save(); x.globalCompositeOperation = 'lighter';
    const tx0 = Math.floor(ox / (CH * T)) - 1, tx1 = Math.floor((ox + cw) / (CH * T)) + 1, ty0 = Math.floor(oy / (CH * T)) - 1, ty1 = Math.floor((oy + ch) / (CH * T)) + 1;
    for (let cy = ty0; cy <= ty1; cy++) for (let cx = tx0; cx <= tx1; cx++) {
      const bk = this.overBuckets.get(cx + cy * 1000); if (!bk) continue;
      for (const i of bk) {
        const p = this.c.props[i];
        if (p.sprite === 'lamp') this.life.reflect(x, w, p.x, p.y - 10, 'rgba(255,190,110,1)');
        else if (p.sprite.startsWith('stall')) this.life.reflect(x, w, p.x, p.y + 20, 'rgba(255,150,90,1)');
        if (p.sprite === 'lamp') { const g = x.createRadialGradient(p.x, p.y - 40, 0, p.x, p.y - 20, 120); g.addColorStop(0, 'rgba(255,190,110,.32)'); g.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = g; x.fillRect(p.x - 120, p.y - 140, 240, 240); }
        else if (p.sprite.startsWith('lanterns')) { for (const k of [-1, 0, 1]) { const ly = p.y + k * 80; const g = x.createRadialGradient(p.x, ly, 0, p.x, ly, 70); g.addColorStop(0, p.sprite.endsWith('gold') ? 'rgba(255,210,90,.22)' : 'rgba(255,80,60,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(p.x - 70, ly - 70, 140, 140); } }
        else if (p.sprite.startsWith('stall')) { const g = x.createRadialGradient(p.x, p.y + 10, 0, p.x, p.y + 10, 110); g.addColorStop(0, 'rgba(255,170,90,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(p.x - 110, p.y - 100, 220, 220); }
      }
    }
    // the hero's ride has a headlight
    const r = w.p.ride;
    if (r && r.kind !== 'boat') { const hx = r.b.x + Math.cos(r.b.h) * 40, hy = r.b.y + Math.sin(r.b.h) * 40; const g = x.createRadialGradient(hx, hy, 0, hx + Math.cos(r.b.h) * 60, hy + Math.sin(r.b.h) * 60, 120); g.addColorStop(0, 'rgba(255,240,200,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(hx, hy); x.arc(hx, hy, 170, r.b.h - 0.4, r.b.h + 0.4); x.fill(); }
    x.restore();
  }
  blimp(x: CanvasRenderingContext2D, w: World) {
    const b = w.blimp;
    const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, 120); g.addColorStop(0, 'rgba(255,255,220,.45)'); g.addColorStop(0.7, 'rgba(255,255,200,.18)'); g.addColorStop(1, 'rgba(255,255,200,0)');
    x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.arc(b.x, b.y, 120, 0, Math.PI * 2); x.fill(); x.restore();
    x.fillStyle = 'rgba(0,0,0,.2)'; this.shadow(x, b.x + 80, b.y + 120, 70, 26);
    spr(x, 'blimp', b.x - 40, b.y - 150 + Math.sin(this.t) * 6, { anchor: 'center' });
  }
  fog(x: CanvasRenderingContext2D, w: World, ox: number, oy: number, cw: number, ch: number) {
    const rects: [District, number, number, number, number][] = [['temple', 0, 0, 46, 30], ['canal', 46, 0, 29, 62], ['arcade', 75, 0, 45, 62], ['docks', 46, 62, 74, 30]];
    for (const [d, rx, ry, rw, rh] of rects) {
      if (w.open.has(d)) continue;
      const X = rx * T, Y = ry * T, Wd = rw * T, Hd = rh * T;
      if (X > ox + cw || Y > oy + ch || X + Wd < ox || Y + Hd < oy) continue;
      x.fillStyle = 'rgba(40,32,70,.78)'; x.fillRect(X, Y, Wd, Hd);
      x.save(); x.beginPath(); x.rect(X - 40, Y - 40, Wd + 80, Hd + 80); x.clip();
      for (let i = 0; i < 14; i++) {
        const fx = X + ((i * 397 + this.t * 18) % (Wd + 400)) - 200, fy = Y + ((i * 211) % Hd);
        const g = x.createRadialGradient(fx, fy, 0, fx, fy, 260); g.addColorStop(0, 'rgba(190,180,230,.35)'); g.addColorStop(1, 'rgba(190,180,230,0)');
        x.fillStyle = g; x.fillRect(fx - 260, fy - 260, 520, 520);
      }
      x.restore();
    }
  }

  // ── the minimap: the painted city map, clipped to a circle, with pins
  drawMinimap(x: CanvasRenderingContext2D, w: World) {
    const m = this.minimap; if (!m.r) return;
    const map = this.buildMap(); const k = this.mapK / T;
    const zoom = 0.9; // map px per minimap px
    x.save(); x.beginPath(); x.arc(m.x, m.y, m.r, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#0d1530'; x.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    const px = w.p.x * k, py = w.p.y * k;
    const sc = 1.6 / zoom;
    x.drawImage(map, px - m.r / sc, py - m.r / sc, m.r * 2 / sc, m.r * 2 / sc, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    const toM = (wx: number, wy: number): [number, number] => [m.x + (wx * k - px) * sc, m.y + (wy * k - py) * sc];
    // fog
    for (const [d, rx, ry, rw, rh] of [['temple', 0, 0, 46, 30], ['canal', 46, 0, 29, 62], ['arcade', 75, 0, 45, 62], ['docks', 46, 62, 74, 30]] as [District, number, number, number, number][]) {
      if (w.open.has(d)) continue; const [a, b] = toM(rx * T, ry * T); x.fillStyle = 'rgba(40,30,70,.82)'; x.fillRect(a, b, rw * T * k * sc, rh * T * k * sc);
    }
    if (w.route.length > 1 && (w.assist || (!w.run && w.waypoint))) { x.strokeStyle = 'rgba(255,220,100,.95)'; x.lineWidth = 3; x.beginPath(); const [a0, b0] = toM(w.p.x, w.p.y); x.moveTo(a0, b0); for (const [rx, ry] of w.route.slice(1)) { const [a, b] = toM(rx, ry); x.lineTo(a, b); } x.stroke(); }
    const dot = (wx: number, wy: number, col: string, r = 4) => { let [a, b] = toM(wx, wy); const d = Math.hypot(a - m.x, b - m.y); if (d > m.r - 6) { a = m.x + (a - m.x) / d * (m.r - 6); b = m.y + (b - m.y) / d * (m.r - 6); } x.fillStyle = col; x.beginPath(); x.arc(a, b, r, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1.5; x.stroke(); };
    for (const [, pl] of Object.entries(this.c.places)) if (w.open.has(pl.d)) { if (pl.kind === 'market') dot(pl.x, pl.y, '#ffd25a', 3); else if (pl.kind === 'safe') dot(pl.x, pl.y, '#3ed6a4', 3); }
    if (!w.run) for (const n of nearList(w)) if (n.kind === 'mission') dot(n.x, n.y, '#ffb020', 5);
    for (const wd of w.wardens) dot(wd.b.x, wd.b.y, Math.floor(this.t * 4) % 2 ? '#ff4a4a' : '#5a8cff', 3);
    const o = w.objective(); if (o) dot(o[0], o[1], '#fff27a', 5);
    x.restore();
    // the player arrow
    x.save(); x.translate(m.x, m.y); x.rotate((w.p.ride ? w.p.ride.b.h : w.p.b.h) + Math.PI / 2);
    x.fillStyle = '#fff'; x.strokeStyle = '#c0392b'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 6); x.lineTo(0, 3); x.lineTo(-6, 6); x.closePath(); x.fill(); x.stroke(); x.restore();
    spr(x, 'ui-ring-hollow', m.x, m.y, { w: m.r * 2.46, anchor: 'center' });
  }
  /** effects for world events */
  consume(w: World, fx: ReturnType<World['drain']>) {
    for (const f of fx) {
      if (f.t === 'bump' && f.x !== undefined) { this.burst(f.x, f.y!, '#e8e0f0', 8); this.shake = Math.max(this.shake, (f.k ?? 0.4) * 0.6); }
      else if (f.t === 'hit' && f.x !== undefined) { this.burst(f.x, f.y!, '#ffd060', 16); this.shake = 0.7; }
      else if (f.t === 'spill' && f.x !== undefined) this.burst(f.x, f.y!, '#ff9a2a', 18);
      else if ((f.t === 'cat' || f.t === 'pickup' || f.t === 'gate' || f.t === 'mural') && f.x !== undefined) this.burst(f.x, f.y!, '#ffe68a', 14);
      else if (f.t === 'hop' && f.x !== undefined) this.puff(f.x, f.y! + 4, '#cfc8e0');
      else if (f.t === 'caught') this.shake = 0.8;
      else if (f.t === 'sky-lantern' && f.x !== undefined) this.life.lantern(f.x, f.y!);
      else if (f.t === 'good-deed') this.burst(w.p.x, w.p.y - 30, '#ffe68a', 18);
      else if (f.t === 'push' && f.x !== undefined) this.puff(f.x, f.y! + 10, '#cfc8e0');
      else if (f.t === 'smoke' && f.x !== undefined) this.burst(f.x, f.y!, '#a8a0b8', 12);
      else if (f.t === 'dance') for (let i = 0; i < 3; i++) this.life.firework(w.p.x + (i - 1) * 160, w.p.y - 260 - i * 30);
    }
    void w;
  }
}

export function itemSprite(item: string) {
  return ({ crate: 'crates', cake: 'cake', pots: 'pots', parcel: 'rice', coins: 'coins', manifest: 'i-map', lookout: 'crates', token: 'claw' } as Record<string, string>)[item] ?? item;
}
function contactFace(name: string) {
  return ({ 'Uncle Kee': 'kee', 'Chef Mo': 'mo', 'Auntie Pang': 'pang', 'Brother Heron': 'heron', 'Master Ren': 'ren', Kiri: 'kiri', 'Mr Lim': 'lim', 'Big Bo': 'bo', Gizmo: 'gizmo' } as Record<string, string>)[name] ?? 'kee';
}
import { available } from './jade-save.js';
import { MISSION, PEOPLE } from './jade-story.js';
function nearList(w: World) {
  return available(w.s).map(m => { const pl = w.c.places[m.at]; return { kind: 'mission', x: pl?.x ?? 0, y: pl?.y ?? 0, id: m.id }; });
}
function MISSION_FACE(id: string) { const m = MISSION[id]; return PEOPLE[m.giver]?.face ?? 'face-kee'; }

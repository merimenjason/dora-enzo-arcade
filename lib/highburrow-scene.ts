// Highburrow: the map renderer. Draws painted hex tiles, camps, villages and animated units from the atlases;
// code draws only effects (trails, selection, paths, frost, sparkles) and the fog of war.
import { FRAMES, ATLASES } from './highburrow-art.js';
import {
  W, H, MAP, RIVER_PATHS, NEIGHBOURS, NEIGHBOUR_IDS, idx, neighbours, season, findPath,
  type State, type Unit, type NeighbourId,
} from './highburrow-game.js';

export const S = 48;                       // hex "size" (centre to corner) in world px
export const HW = Math.sqrt(3) * S;        // hex width
export function hexCenter(q: number, r: number) { return { x: HW * (q + 0.5 * (r & 1)) + HW / 2, y: S * 1.5 * r + S }; }
export const WORLD_W = HW * (W + 0.5), WORLD_H = S * 1.5 * (H - 1) + 2 * S;
export function pixelToHex(x: number, y: number): [number, number] {
  x -= HW / 2; y -= S;
  const qf = (Math.sqrt(3) / 3 * x - y / 3) / S, rf = (2 / 3 * y) / S;
  let cx = qf, cz = rf, cy = -cx - cz;
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return [rx + (rz - (rz & 1)) / 2, rz];
}

export const images: Record<string, HTMLImageElement> = {};
export function loadArt(base = 'art/'): Promise<void> {
  const names = [...ATLASES];
  return Promise.all(names.map(n => new Promise<void>(res => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `${base}${n}.webp`; images[n] = im; }))).then(() => {});
}
export function drawFrame(c: CanvasRenderingContext2D, name: string, x: number, y: number, h: number, flip = false, anchor: 'bottom' | 'center' = 'bottom') {
  const f = FRAMES[name]; if (!f) return;
  const im = images[ATLASES[f[0]]]; if (!im?.complete) return;
  const w = f[3] * h / f[4];
  const top = anchor === 'bottom' ? y - h : y - h / 2;
  if (flip) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(im, f[1], f[2], f[3], f[4], -w / 2, top, w, h); c.restore(); }
  else c.drawImage(im, f[1], f[2], f[3], f[4], x - w / 2, top, w, h);
}

const hash = (q: number, r: number) => ((q * 73856093) ^ (r * 19349663)) >>> 0;
export function tileArt(q: number, r: number): string {
  const t = MAP[idx(q, r)], h = hash(q, r), v = h % 2, v3 = h % 3;
  switch (t) {
    case 'forest': return ['t-forest', 't-forest2', 't-forest3'][v3];
    case 'terrace': return v ? 't-terrace2' : 't-terrace';
    case 'tpotato': return v ? 't-tpotato2' : 't-tpotato';
    case 'meadow': return ['t-meadow1', 't-meadow2', 't-meadow3'][v3];
    case 'grass': return ['t-grass', 't-grass2', 't-grass3'][v3];
    case 'scree': return ['t-scree', 't-scree2', 't-scree3'][v3];
    case 'snow': return h % 5 === 0 ? 't-snow2' : h % 5 === 1 ? 't-snow3' : 't-snow';
    case 'salt': return v ? 't-salt2' : 't-salt';
    case 'reeds': return v ? 't-reeds2' : 't-reeds';
    case 'lake': return v ? 't-lake2' : 't-lake';
    default: return 't-' + t;
  }
}
/** painted river pieces: one straight segment per link between river tiles (or into the lake), rotated to that edge */
const RIVER_LINKS: { a: [number, number]; b: [number, number]; art: string }[] = [];
const RIVER_ENDS: { at: [number, number]; art: string }[] = [];
for (const path of RIVER_PATHS) {
  path.forEach((p, i) => { if (i) RIVER_LINKS.push({ a: path[i - 1], b: p, art: `r-seg${1 + hash(p[0], p[1]) % 4}` }); });
  for (const end of [path[0], path[path.length - 1]]) {
    const lake = neighbours(end[0], end[1]).find(([a, b]) => MAP[idx(a, b)] === 'lake');
    if (lake) RIVER_LINKS.push({ a: end, b: lake, art: 'r-seg1' });
    else RIVER_ENDS.push({ at: end, art: end === path[0] ? 'r-pool1' : 'r-mouth1' });
  }
}
export function drawRivers(c: CanvasRenderingContext2D) {
  for (const L of RIVER_LINKS) {
    const pa = hexCenter(L.a[0], L.a[1]), pb = hexCenter(L.b[0], L.b[1]);
    const f = FRAMES[L.art]; const im = images[ATLASES[f[0]]]; if (!im?.complete) continue;
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.3, h = len * f[4] / f[3] * 1.15;
    c.save(); c.translate((pa.x + pb.x) / 2, (pa.y + pb.y) / 2); c.rotate(Math.atan2(pb.y - pa.y, pb.x - pa.x));
    c.drawImage(im, f[1], f[2], f[3], f[4], -len / 2, -h / 2, len, h); c.restore();
  }
  for (const E of RIVER_ENDS) { const p = hexCenter(E.at[0], E.at[1]); drawFrame(c, E.art, p.x, p.y, 34, false, 'center'); }
}
export const UNIT_H: Record<Unit['kind'], number> = { dora: 64, enzo: 64, settler: 52, caravan: 62 };

export interface Anim { unit: number; steps: [number, number][]; t: number; from: [number, number] }
export interface View { x: number; y: number; z: number }

export class MapScene {
  c: CanvasRenderingContext2D; cv: HTMLCanvasElement;
  view: View = { x: 0, y: 0, z: 1 };
  sel: number | null = null; selTile: [number, number] | null = null;
  routeCache: Record<string, [number, number][]> = {};
  hover: [number, number] | null = null; pathPreview: [number, number][] = [];
  hint: [number, number] | null = null;                  // tutorial / advisor ring
  anims: Anim[] = []; acts: Record<number, { name: string; t: number }> = {};
  flipped: Record<number, boolean> = {};
  fx: { x: number; y: number; t: number; kind: 'heart' | 'spark' | 'coin' }[] = [];
  snow = Array.from({ length: 140 }, (_, i) => ({ x: (i * 97.13) % 1, y: (i * 61.7) % 1, s: 0.5 + ((i * 13) % 10) / 10 }));
  time = 0; private fogCache: HTMLCanvasElement | null = null; private fogKey = '';
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.c = cv.getContext('2d')!; }

  centerOn(q: number, r: number, z = this.view.z) {
    const p = hexCenter(q, r); const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.view = { z, x: p.x - w / 2 / z, y: p.y - h / 2 / z }; this.clamp();
  }
  clamp() {
    const w = this.cv.clientWidth / this.view.z, h = this.cv.clientHeight / this.view.z;
    this.view.x = Math.max(-w * 0.35, Math.min(WORLD_W - w * 0.65, this.view.x));
    this.view.y = Math.max(-h * 0.35, Math.min(WORLD_H - h * 0.65, this.view.y));
  }
  zoomAt(sx: number, sy: number, f: number) {
    const z = Math.max(0.35, Math.min(2.4, this.view.z * f));
    const wx = this.view.x + sx / this.view.z, wy = this.view.y + sy / this.view.z;
    this.view = { z, x: wx - sx / z, y: wy - sy / z }; this.clamp();
  }
  toWorld(sx: number, sy: number) { return { x: this.view.x + sx / this.view.z, y: this.view.y + sy / this.view.z }; }
  toScreen(x: number, y: number) { return { x: (x - this.view.x) * this.view.z, y: (y - this.view.y) * this.view.z }; }
  hexAt(sx: number, sy: number) { const p = this.toWorld(sx, sy); return pixelToHex(p.x, p.y); }

  /** where a unit is drawn right now (mid-walk units glide between tiles) */
  unitPos(u: Unit) {
    const a = this.anims.find(x => x.unit === u.id);
    if (!a) return hexCenter(u.q, u.r);
    const k = Math.min(a.steps.length - 1e-6, a.t / 0.2); const i = Math.floor(k), f = k - i;
    const A = i === 0 ? a.from : a.steps[i - 1], B = a.steps[i];
    const pa = hexCenter(A[0], A[1]), pb = hexCenter(B[0], B[1]);
    return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
  }
  animate(unit: number, from: [number, number], steps: [number, number][]) {
    if (!steps.length) return;
    this.anims = this.anims.filter(a => a.unit !== unit);
    this.anims.push({ unit, steps, t: 0, from });
    const end = steps[steps.length - 1]; this.flipped[unit] = hexCenter(end[0], end[1]).x < hexCenter(from[0], from[1]).x;
  }
  act(unit: number, name: string, dur = 1.6) { this.acts[unit] = { name, t: dur }; }
  busy() { return this.anims.length > 0; }

  draw(s: State, dt: number, frostShow: boolean) {
    this.time += dt;
    for (const a of this.anims) a.t += dt;
    this.anims = this.anims.filter(a => a.t < a.steps.length * 0.2);
    for (const k in this.acts) { this.acts[k].t -= dt; if (this.acts[k].t <= 0) delete this.acts[k]; }
    const c = this.c, cv = this.cv, dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#e9eef2'; c.fillRect(0, 0, w, h);
    c.setTransform(dpr * this.view.z, 0, 0, dpr * this.view.z, -this.view.x * this.view.z * dpr, -this.view.y * this.view.z * dpr);
    const x0 = this.view.x, y0 = this.view.y, x1 = x0 + w / this.view.z, y1 = y0 + h / this.view.z;
    // tiles
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const p = hexCenter(q, r);
      if (p.x < x0 - HW || p.x > x1 + HW || p.y < y0 - 2 * S || p.y > y1 + 2 * S) continue;
      drawFrame(c, tileArt(q, r), p.x, p.y, 2 * S * 1.035, false, 'center');
    }
    drawRivers(c);
    // standing caravan routes: a dashed red-and-cream line with arrows from A to B
    for (const u of s.units) if (u.route) {
      const A = s.villages.find(v => v.id === u.route!.a), B = s.villages.find(v => v.id === u.route!.b); if (!A || !B) continue;
      const key = `${A.id}-${B.id}-${s.trail.join('').length}`;
      const path = (this.routeCache[key] ??= [[A.q, A.r] as [number, number], ...(findPath(s, [A.q, A.r], [B.q, B.r]) ?? [])]);
      const pts = path.map(([q, r]) => hexCenter(q, r));
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(70,30,20,.55)'; c.lineWidth = 9; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y - 4) : c.moveTo(p.x, p.y - 4)); c.stroke();
      c.strokeStyle = this.sel === u.id ? '#ffd76a' : '#e9553a'; c.lineWidth = 4.5; c.setLineDash([12, 8]); c.lineDashOffset = -this.time * 24;
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y - 4) : c.moveTo(p.x, p.y - 4)); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
      for (let i = 1; i < pts.length; i += 2) {
        const p0 = pts[i - 1], p1 = pts[i], ang = Math.atan2(p1.y - p0.y, p1.x - p0.x), mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2 - 4;
        c.save(); c.translate(mx, my); c.rotate(ang); c.fillStyle = '#fff4d8'; c.strokeStyle = 'rgba(70,30,20,.8)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
    }
    // trails: a soft dirt path between neighbouring trail tiles
    c.lineCap = 'round';
    for (let i = 0; i < W * H; i++) if (s.trail[i]) {
      const q = i % W, r = Math.floor(i / W), p = hexCenter(q, r);
      const links = neighbours(q, r).filter(([a, b]) => s.trail[idx(a, b)] || s.villages.some(v => v.q === a && v.r === b));
      c.strokeStyle = 'rgba(150,110,70,.85)'; c.lineWidth = 7;
      if (!links.length) { c.beginPath(); c.arc(p.x, p.y, 6, 0, 7); c.fillStyle = c.strokeStyle; c.fill(); }
      for (const [a, b] of links) { const o = hexCenter(a, b); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo((p.x + o.x) / 2, (p.y + o.y) / 2); c.stroke(); }
      c.strokeStyle = 'rgba(225,195,140,.8)'; c.lineWidth = 3; c.setLineDash([5, 6]);
      for (const [a, b] of links) { const o = hexCenter(a, b); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo((p.x + o.x) / 2, (p.y + o.y) / 2); c.stroke(); }
      c.setLineDash([]);
    }
    // faint hex grid
    c.strokeStyle = 'rgba(255,250,235,.16)'; c.lineWidth = 1;
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) { if (s.seen[idx(q, r)]) this.hexPath(q, r, 1), c.stroke(); }
    // village claim rings
    for (const v of s.villages) {
      for (const [q, r] of neighbours(v.q, v.r)) { this.hexPath(q, r, 0.94); c.strokeStyle = 'rgba(255,215,120,.35)'; c.lineWidth = 2; c.stroke(); }
    }
    // hover, selection, path, hint
    if (this.hover) { this.hexPath(this.hover[0], this.hover[1], 0.95); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill(); }
    if (this.pathPreview.length) {
      c.fillStyle = 'rgba(255,240,200,.9)';
      for (const [q, r] of this.pathPreview) { const p = hexCenter(q, r); c.beginPath(); c.arc(p.x, p.y + 6, 5, 0, 7); c.fill(); }
      const [eq, er] = this.pathPreview[this.pathPreview.length - 1];
      this.hexPath(eq, er, 0.9); c.strokeStyle = 'rgba(255,240,200,.95)'; c.lineWidth = 3; c.stroke();
    }
    if (this.hint) {
      const p = hexCenter(this.hint[0], this.hint[1]); const k = 1 + Math.sin(this.time * 5) * 0.08;
      c.beginPath(); c.ellipse(p.x, p.y + 8, 36 * k, 20 * k, 0, 0, 7); c.strokeStyle = 'rgba(255,214,90,.95)'; c.lineWidth = 4; c.stroke();
    }
    // things standing on the map, back to front
    type D = { y: number; f: () => void };
    const ds: D[] = [];
    for (const n of NEIGHBOUR_IDS) {
      const d = NEIGHBOURS[n]; if (!s.seen[idx(d.q, d.r)]) continue;
      const p = hexCenter(d.q, d.r);
      ds.push({ y: p.y, f: () => { drawFrame(c, `camp-${n}`, p.x, p.y + S * 0.55, n === 'condors' ? 112 : 70); this.campBadge(s, n, p.x, p.y + S * 0.62); } });
    }
    for (const n of NEIGHBOUR_IDS) {   // quest finds glint once seen
      const qd = NEIGHBOURS[n].quest; if (qd.kind !== 'visit' || s.nb[n].found || !s.seen[idx(qd.q, qd.r)]) continue;
      const p = hexCenter(qd.q, qd.r);
      ds.push({ y: p.y, f: () => this.sparkle(p.x, p.y - 6, s.nb[n].met ? 1 : 0.45) });
    }
    for (const v of s.villages) {
      const p = hexCenter(v.q, v.r); const n = v.settlers.length;
      const art = n >= 7 ? 'village-3' : n >= 4 ? 'village-2' : 'village-1';
      ds.push({ y: p.y, f: () => drawFrame(c, art, p.x, p.y + S * 0.62, n >= 7 ? 112 : n >= 4 ? 96 : 78) });
    }
    const byTile = new Map<number, number>();
    for (const u of s.units) {
      const p = this.unitPos(u);
      const k = idx(u.q, u.r); const slot = byTile.get(k) ?? 0; byTile.set(k, slot + 1);
      const off = this.anims.some(a => a.unit === u.id) ? 0 : [0, -18, 18, -30][slot % 4];
      const onVillage = s.villages.some(v => v.q === u.q && v.r === u.r);
      ds.push({ y: p.y + 1 + (onVillage ? 30 : 0), f: () => this.drawUnit(u, p.x + off * (onVillage ? 1.4 : 1) + (onVillage ? 34 : 0), p.y + S * 0.45 + (onVillage ? 14 : 0)) });
    }
    ds.sort((a, b) => a.y - b.y).forEach(d => d.f());
    // effects
    for (const e of this.fx) e.t += dt;
    this.fx = this.fx.filter(e => e.t < 1.4);
    for (const e of this.fx) {
      const a = 1 - e.t / 1.4; c.globalAlpha = a;
      c.fillStyle = e.kind === 'heart' ? '#e0413a' : e.kind === 'coin' ? '#f2c14e' : '#fff6c8';
      for (let i = 0; i < 5; i++) { const ang = i * 1.256 + e.t; const rr = 10 + e.t * 30; c.beginPath(); c.arc(e.x + Math.cos(ang) * rr, e.y - e.t * 40 + Math.sin(ang) * rr * 0.5, 4, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    // fog of war
    this.drawFog(s);
    // name banners above villages (UI text, drawn last so fog never hides it)
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const v of s.villages) {
      const p = hexCenter(v.q, v.r); const n = v.settlers.length;
      const label = `${v.name} · ${n}`;
      c.font = '700 13px Fraunces, Georgia, serif';
      const tw = c.measureText(label).width + 22, y = p.y - (n >= 7 ? 70 : n >= 4 ? 60 : 48);
      c.fillStyle = 'rgba(255,248,232,.95)'; roundRect(c, p.x - tw / 2, y - 11, tw, 22, 6); c.fill();
      c.strokeStyle = '#b8402a'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#3a2416'; c.fillText(label, p.x, y + 1);
      if (v.warmth < 30) { c.fillStyle = '#2f7fc1'; c.beginPath(); c.arc(p.x + tw / 2 + 2, y - 8, 7, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '700 10px sans-serif'; c.fillText('❄', p.x + tw / 2 + 2, y - 7); }
    }
    // screen-space: frost night
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (frostShow) {
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(120,170,230,0.10)'); g.addColorStop(1, 'rgba(40,70,140,0.42)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of this.snow) {
        const fy = ((f.y + this.time * 0.05 * f.s) % 1) * h, fx = ((f.x + Math.sin(this.time * 0.6 + f.y * 9) * 0.01) % 1) * w;
        c.beginPath(); c.arc(fx, fy, 1.2 + f.s * 1.4, 0, 7); c.fill();
      }
    }
    if (season(s.turn) === 'dry' && !frostShow) { c.fillStyle = 'rgba(255,200,120,0.06)'; c.fillRect(0, 0, w, h); }
  }
  private drawUnit(u: Unit, x: number, y: number) {
    const c = this.c; const walking = this.anims.some(a => a.unit === u.id);
    if (this.sel === u.id) {
      c.beginPath(); c.ellipse(x, y - 2, 26, 11, 0, 0, 7);
      c.strokeStyle = `rgba(255,214,90,${0.75 + Math.sin(this.time * 6) * 0.25})`; c.lineWidth = 3; c.stroke();
    } else { c.beginPath(); c.ellipse(x, y - 2, 18, 7, 0, 0, 7); c.fillStyle = 'rgba(40,30,20,.22)'; c.fill(); }
    const t = this.time; const act = this.acts[u.id]?.name ?? (u.rest ? 'rest' : '');
    const flip = !!this.flipped[u.id];
    let f = '';
    const walk4 = (p: string) => `${p}-walk${1 + Math.floor(t * 8) % 4}`;
    if (u.kind === 'dora') f = walking ? walk4('dora') : act === 'befriend' ? (this.acts[u.id].t > 0.8 ? 'dora-befriend' : 'dora-wave') : act === 'explore' ? 'dora-explore' : act === 'rest' ? 'dora-rest' : act === 'cheer' ? 'dora-cheer' : Math.floor(t * 1.2) % 2 ? 'dora-idle2' : 'dora-idle';
    if (u.kind === 'enzo') f = walking ? walk4('enzo') : act === 'found' ? (this.acts[u.id].t > 0.8 ? 'enzo-found1' : 'enzo-found2') : act === 'build' ? (Math.floor(t * 4) % 2 ? 'enzo-build2' : 'enzo-build1') : act === 'advise' ? 'enzo-advise' : Math.floor(t * 1.1) % 2 ? 'enzo-idle2' : 'enzo-idle';
    if (u.kind === 'settler') { const p = `s${u.fur ?? 0}`; f = walking ? `${p}-walk${1 + Math.floor(t * 6) % 2}` : act === 'cold' ? 's1-cold' : u.rest ? 's-group' : `${p}-idle`; }
    if (u.kind === 'caravan') f = walking ? walk4('car') : act === 'trade' ? (this.acts[u.id].t > 0.8 ? 'car-trade1' : 'car-trade2') : u.rest ? 'car-rest' : 'car-idle';
    const bob = walking ? Math.abs(Math.sin(t * 16)) * 2 : 0;
    drawFrame(c, f, x, y - bob, UNIT_H[u.kind] * (f === 'dora-rest' ? 0.8 : f === 's-group' ? 0.9 : 1), flip);
    if (u.kind === 'caravan' && u.cargo && Object.values(u.cargo).some(n => n > 0)) {
      c.fillStyle = '#b8402a'; c.beginPath(); c.arc(x + 20, y - 52, 6, 0, 7); c.fill();
    }
  }
  private campBadge(s: State, n: NeighbourId, x: number, y: number) {
    const c = this.c; const fr = s.nb[n].fr; if (!s.nb[n].met) return;
    const hts = Math.min(5, Math.floor(fr / 20));
    c.font = '11px sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(255,248,232,.92)'; roundRect(c, x - 33, y, 66, 14, 7); c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = i < hts ? '#d8352c' : '#d8c8b4'; heart(c, x - 24 + i * 12, y + 7, 4.2); }
  }
  private sparkle(x: number, y: number, a: number) {
    const c = this.c; const k = 0.7 + Math.sin(this.time * 4) * 0.3; c.globalAlpha = a;
    c.fillStyle = '#fff6c0'; c.beginPath();
    for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rr = i % 2 ? 4 : 13 * k; c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
    c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  hexPath(q: number, r: number, k = 1) {
    const p = hexCenter(q, r), c = this.c; c.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); c.lineTo(p.x + S * k * Math.cos(a), p.y + S * k * Math.sin(a)); }
    c.closePath();
  }
  /** soft painted-looking mist: layered blobs over every unseen hex, cached until the seen map changes */
  private drawFog(s: State) {
    const key = s.seen.join('');
    if (key !== this.fogKey || !this.fogCache) {
      this.fogKey = key;
      const k = 0.5, cv = this.fogCache ?? document.createElement('canvas');
      cv.width = Math.ceil(WORLD_W * k) + 40; cv.height = Math.ceil(WORLD_H * k) + 40;
      const c = cv.getContext('2d')!; c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(k, 0, 0, k, 20, 20);
      for (let r = -1; r <= H; r++) for (let q = -1; q <= W; q++) {
        const inside = q >= 0 && r >= 0 && q < W && r < H;
        if (inside && s.seen[idx(q, r)]) continue;
        const p = hexCenter(q, r);
        const edge = inside && neighbours(q, r).some(([a, b]) => s.seen[idx(a, b)]);
        for (let i = 0; i < 4; i++) {
          const hh = hash(q * 7 + i, r * 3 + i);
          const ox = ((hh % 41) - 20) * 0.9, oy = (((hh >> 8) % 31) - 15) * 0.9, rad = S * (edge ? 0.95 : 1.25) + (hh % 17);
          const g = c.createRadialGradient(p.x + ox, p.y + oy, rad * 0.2, p.x + ox, p.y + oy, rad);
          const shade = 236 + (hh % 14);
          g.addColorStop(0, `rgba(${shade},${shade + 2 > 255 ? 255 : shade + 2},${250},${edge ? 0.85 : 0.97})`);
          g.addColorStop(1, `rgba(${shade},${shade},${248},0)`);
          c.fillStyle = g; c.beginPath(); c.arc(p.x + ox, p.y + oy, rad, 0, 7); c.fill();
        }
        if (!edge) { this.c.save(); c.globalAlpha = 0.9; c.fillStyle = 'rgba(238,241,246,1)'; c.beginPath(); for (let j = 0; j < 6; j++) { const a = Math.PI / 180 * (60 * j - 30); c.lineTo(p.x + S * Math.cos(a), p.y + S * Math.sin(a)); } c.fill(); c.globalAlpha = 1; this.c.restore(); }
      }
      this.fogCache = cv;
    }
    const drift = Math.sin(this.time * 0.3) * 3;
    this.c.drawImage(this.fogCache, -40 + drift, -40, this.fogCache.width / 0.5, this.fogCache.height / 0.5);
  }
  /** a small overview map for the corner */
  drawMini(m: HTMLCanvasElement, s: State) {
    const c = m.getContext('2d')!; const kx = m.width / WORLD_W, ky = m.height / WORLD_H;
    const col: Record<string, string> = { forest: '#4f7a3a', meadow: '#7aa850', terrace: '#9aa548', tpotato: '#8a9a4a', grass: '#c9a64a', salt: '#eeeae2', spring: '#6cc6c0', scree: '#9b948a', silver: '#8a8f99', snow: '#f4f6fa', peak: '#c8ccd6', lake: '#2f68b0', reeds: '#c8a64a', pass: '#b0b4be' };
    c.fillStyle = '#e8ecf0'; c.fillRect(0, 0, m.width, m.height);
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const p = hexCenter(q, r);
      c.fillStyle = s.seen[idx(q, r)] ? col[MAP[idx(q, r)]] : '#e8ecf0';
      c.fillRect((p.x - HW / 2) * kx, (p.y - S * 0.75) * ky, HW * kx + 1, S * 1.5 * ky + 1);
    }
    for (const v of s.villages) { const p = hexCenter(v.q, v.r); c.fillStyle = '#b8402a'; c.beginPath(); c.arc(p.x * kx, p.y * ky, 4, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
    for (const u of s.units) { const p = hexCenter(u.q, u.r); c.fillStyle = u.kind === 'dora' ? '#f2c14e' : u.kind === 'enzo' ? '#2a7f8f' : '#6b4a2e'; c.fillRect(p.x * kx - 2, p.y * ky - 2, 4, 4); }
    const w = this.cv.clientWidth / this.view.z, h = this.cv.clientHeight / this.view.z;
    c.strokeStyle = '#3a2416'; c.lineWidth = 1.5; c.strokeRect(this.view.x * kx, this.view.y * ky, w * kx, h * ky);
  }
}
export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function heart(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath(); c.moveTo(x, y + r); c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
  c.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r); c.fill();
}

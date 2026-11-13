// Cloudpop: drawing only. The painted map, then towers, the hero and condors from the atlases (each tower's look
// follows its upgrades: tier 3 and tier 5 of each path are painted), puffs with their night/fog/rope overlays and
// status effects, projectiles and painted pop bursts. Code draws only effects: range rings, beams, sound rings,
// trails, health bars and floating numbers. On a phone held upright the whole map is turned a quarter turn so it
// fills the screen; sprites stay upright.
import { FRAMES, ATLASES } from './cloudpop-art.js';
import { PUFFS, type PuffKind } from './cloudpop-puffs.js';
import { TOWER } from './cloudpop-towerdata.js';
import { WORLD_W, WORLD_H, ROAD_W, isWater } from './cloudpop-maps.js';
import type { Game, Tower, Puff } from './cloudpop-game.js';
import type { TowerId } from './cloudpop-towers.js';

export const images: Record<string, HTMLImageElement> = {};
export function loadArt(base: string, maps: string[]): Promise<void> {
  const names = [...ATLASES, ...maps];
  return Promise.all(names.map(n => new Promise<void>(res => {
    if (images[n]?.complete) return res();
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `${base}${n}.webp`; images[n] = im;
  }))).then(() => {});
}

export interface View { x: number; y: number; k: number; rot: boolean; w: number; h: number }
/** fit the world into a rectangle (CSS px); upright phones get the map turned */
export function fitView(x: number, y: number, w: number, h: number, allowRot = true): View {
  const rot = allowRot && h > w * 1.15;
  const ww = rot ? WORLD_H : WORLD_W, wh = rot ? WORLD_W : WORLD_H;
  const k = Math.min(w / ww, h / wh);
  return { x: x + (w - ww * k) / 2, y: y + (h - wh * k) / 2, k, rot, w: ww * k, h: wh * k };
}
export function toScreen(v: View, wx: number, wy: number): [number, number] {
  return v.rot ? [v.x + (WORLD_H - wy) * v.k, v.y + wx * v.k] : [v.x + wx * v.k, v.y + wy * v.k];
}
export function toWorld(v: View, sx: number, sy: number): [number, number] {
  return v.rot ? [(sy - v.y) / v.k, WORLD_H - (sx - v.x) / v.k] : [(sx - v.x) / v.k, (sy - v.y) / v.k];
}

/** draw a frame with its bottom centre (or centre) at screen x,y, h screen px tall */
export function spr(c: CanvasRenderingContext2D, name: string, x: number, y: number, h: number, flip = false, anchor: 'bottom' | 'center' = 'bottom', alpha = 1) {
  const f = FRAMES[name]; if (!f) return;
  const im = images[ATLASES[f[0]]]; if (!im?.complete || !im.naturalWidth) return;
  const w = f[3] * h / f[4], top = anchor === 'bottom' ? y - h : y - h / 2;
  if (alpha !== 1) c.globalAlpha = alpha;
  if (flip) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(im, f[1], f[2], f[3], f[4], -w / 2, top, w, h); c.restore(); }
  else c.drawImage(im, f[1], f[2], f[3], f[4], x - w / 2, top, w, h);
  if (alpha !== 1) c.globalAlpha = 1;
}

/** which painted look a tower shows: the path with the highest tier, at tier 3 or tier 5 */
export function lookOf(tiers: readonly number[]): string {
  let p = 0; for (let i = 1; i < 3; i++) if (tiers[i] > tiers[p]) p = i;
  const t = tiers[p];
  return t >= 5 ? 'abc'[p] + '5' : t >= 3 ? 'abc'[p] + '3' : 'base';
}
const TOWER_H: Record<string, number> = { pebble: 92, busker: 92, ember: 92, ice: 100, llama: 100, hay: 96, condor: 80, boat: 92, windmill: 112, lantern: 100, quinoa: 96, hero: 104 };
const PUFF_H = (k: PuffKind) => PUFFS[k].r * (PUFFS[k].boss ? 2.6 : 2.7);

export interface Part { x: number; y: number; vx: number; vy: number; t: number; T: number; col: string; s: number; kind: string; text?: string; name?: string }

export class Scene {
  c: CanvasRenderingContext2D; v: View = fitView(0, 0, 100, 100);
  parts: Part[] = []; rings: { x: number; y: number; r: number; t: number; T: number; col: string; w: number }[] = [];
  beams: { x: number; y: number; tx: number; ty: number; t: number; T: number; col: string; w: number }[] = [];
  heroAnim = { name: '', until: 0 }; t = 0; mapName = ''; shake = 0;
  constructor(public cv: HTMLCanvasElement) { this.c = cv.getContext('2d')!; }

  resize(cssW: number, cssH: number, dpr: number) {
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }
  heroDo(name: string, secs: number) { this.heroAnim = { name, until: this.t + secs }; }

  /** turn engine events into effects */
  consume(g: Game) {
    for (const f of g.fx) {
      const [x, y] = toScreen(this.v, f.t === 'atk' ? f.x : 'x' in f ? f.x : 0, f.t === 'atk' ? f.y : 'y' in f ? f.y : 0);
      if (f.t === 'pop') {
        const col = PUFFS[f.kind].col, n = f.big ? 10 : 5;
        this.parts.push({ x, y, vx: 0, vy: 0, t: 0, T: f.big ? 0.45 : 0.3, col, s: PUFF_H(f.kind) * this.v.k * (f.big ? 1.3 : 0.9), kind: 'sprite', name: f.big ? 'pop-1' : 'pop-2' });
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = (60 + Math.random() * 120) * this.v.k * 2; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, t: 0, T: 0.35 + Math.random() * 0.2, col, s: (3 + Math.random() * 3) * this.v.k * 2, kind: 'drop' }); }
        if (PUFFS[f.kind].boss) { this.parts.push({ x, y, vx: 0, vy: 0, t: 0, T: 0.8, col, s: 320 * this.v.k, kind: 'sprite', name: 'b-break' }); this.shake = 0.35; }
      } else if (f.t === 'clink') {
        this.parts.push({ x, y: y - 10, vx: 0, vy: -40, t: 0, T: 0.4, col: '#e8f4ff', s: 12, kind: 'text', text: '✕' });
      } else if (f.t === 'leak') {
        this.parts.push({ x, y, vx: 0, vy: -50, t: 0, T: 1, col: '#ff6b5b', s: 16, kind: 'text', text: `−${f.n}` });
        this.parts.push({ x, y, vx: 0, vy: 0, t: 0, T: 0.6, col: '#fff', s: 70 * this.v.k, kind: 'sprite', name: 'splash' });
      } else if (f.t === 'cash') {
        this.parts.push({ x, y, vx: 0, vy: -36, t: 0, T: 1.4, col: '#ffd34d', s: 18, kind: 'text', text: `+$${Math.round(f.n)}` });
        this.parts.push({ x, y, vx: 0, vy: 0, t: 0, T: 0.7, col: '#fff', s: 90 * this.v.k, kind: 'sprite', name: 'fx-coins' });
      } else if (f.t === 'level') {
        this.heroDo('cheer', 1.6);
        const h = g.hero(); if (h) { const [hx, hy] = toScreen(this.v, h.x, h.y); this.parts.push({ x: hx, y: hy - 60 * this.v.k, vx: 0, vy: 0, t: 0, T: 1, col: '#fff', s: 150 * this.v.k, kind: 'sprite', name: 'fx-level' }); }
      } else if (f.t === 'ability') {
        const big: Record<string, string> = { rockslide: 'fx-rocks', bigchill: 'fx-snow', hush: 'fx-moon', blowback: 'fx-wind', flood: 'fx-goo', stampede: 'llama-proj2', sunburst: 'fx-sun', moonrise: 'fx-moon', goldrain: 'fx-coins', bigcatch: 'fx-coins', feast: 'fx-confetti', blessing: 'fx-petals', clearsky: 'fx-sun', whirl: 'fx-petals', sundance: 'fx-sun', blaze: 'fx-sun', vane: 'fx-wind', rod: 'b-bolt', clear: 'fx-sun', chorus: 'fx-flash', erupt: 'fx-burn', secondwind: 'fx-confetti', lift: 'fx-wind', 'rod-hit': 'b-bolt', 'megabale-hit': 'hay-proj', 'skystrike-hit': 'b-bolt', 'swell-hit': 'splash' };
        const name = big[f.id] ?? 'fx-flash';
        const sz = f.id === 'lift' ? 60 : f.id.endsWith('-hit') ? 200 : 260;
        this.parts.push({ x, y, vx: 0, vy: 0, t: 0, T: f.id === 'lift' ? 0.5 : 1.1, col: '#fff', s: sz * this.v.k, kind: 'sprite', name });
        if (f.id !== 'lift' && !f.id.endsWith('-hit')) this.rings.push({ x, y, r: 0, t: 0, T: 0.8, col: 'rgba(255,240,180,.9)', w: 6 });
        if (['whirl', 'sundance', 'blaze', 'vane', 'rod', 'clear'].includes(f.id)) {
          const idx = { whirl: 'ab1', sundance: 'ab2', blaze: 'ab3', vane: 'ab1', rod: 'ab2', clear: 'ab3' }[f.id]!;
          this.heroDo(idx, 1.4);
        }
        if (f.id === 'rockslide' || f.id === 'stampede' || f.id === 'blowback' || f.id === 'bigchill') this.shake = 0.3;
      } else if (f.t === 'atk') {
        const t = g.towers.find(q => q.id === f.tower);
        const [tx, ty] = toScreen(this.v, f.tx, f.ty);
        if (f.kind === 'pulse' && t) {
          const a = t.s.atks.find(q => q.id === f.atk);
          const col = a?.dtype === 'cold' ? 'rgba(190,240,255,.9)' : a?.dtype === 'magic' ? 'rgba(220,210,255,.9)' : 'rgba(255,220,120,.9)';
          this.rings.push({ x, y, r: (a?.range ?? 100) * this.v.k * t.buff.range, t: 0, T: 0.35, col, w: 4 });
          if (a?.dtype === 'cold') for (let i = 0; i < 6; i++) { const an = i / 6 * 6.283; this.parts.push({ x, y, vx: Math.cos(an) * 160 * this.v.k * 2, vy: Math.sin(an) * 160 * this.v.k * 2, t: 0, T: 0.4, col: '#fff', s: 26 * this.v.k * 2, kind: 'sprite', name: 'fx-snow' }); }
        } else if (f.kind === 'beam') {
          const a = t?.s.atks.find(q => q.id === f.atk);
          const col = a?.dtype === 'fire' ? 'rgba(255,140,40,.85)' : a?.dtype === 'wind' ? 'rgba(235,250,255,.8)' : 'rgba(210,225,255,.95)';
          this.beams.push({ x, y, tx, ty, t: 0, T: a?.dtype === 'wind' ? 0.4 : 0.18, col, w: (a?.dtype === 'wind' ? 26 : 10) * this.v.k * 2 });
          if (a?.dtype === 'wind') this.parts.push({ x: (x + tx) / 2, y: (y + ty) / 2, vx: (tx - x) * 0.8, vy: (ty - y) * 0.8, t: 0, T: 0.4, col: '#fff', s: 80 * this.v.k, kind: 'sprite', name: 'fx-wind' });
        } else if (f.kind === 'land') {
          this.parts.push({ x, y, vx: 0, vy: 0, t: 0, T: 0.3, col: '#fff', s: 70 * this.v.k, kind: 'sprite', name: t?.def === 'ember' ? 'fx-burn' : 'fx-dust' });
        } else if (f.kind === 'strike') {
          this.parts.push({ x: tx, y: ty, vx: 0, vy: 0, t: 0, T: 0.35, col: '#fff', s: 90 * this.v.k, kind: 'sprite', name: t?.def === 'condor' ? 'fx-spark' : 'fx-dust' });
        }
        if (t?.def === 'hero') this.heroDo('throw', 0.25);
      }
    }
    g.fx.length = 0;
  }

  draw(g: Game, ui: { sel: number | null; place: TowerId | 'hero' | null; px: number; py: number; ok: boolean; hover?: number | null }, dt: number) {
    const skin = g.cfg.skin;
    const c = this.c, v = this.v, k = v.k;
    this.t += dt;
    const dpr = this.cv.width / Math.max(1, this.cv.clientWidth);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.cv.clientWidth, this.cv.clientHeight);
    if (this.shake > 0) { this.shake -= dt; const s = this.shake * 10; c.translate((Math.random() - .5) * s, (Math.random() - .5) * s); }
    // map
    const mapIm = images['map-' + g.map.id];
    if (mapIm?.complete && mapIm.naturalWidth) {
      if (v.rot) { c.save(); c.translate(v.x + v.w, v.y); c.rotate(Math.PI / 2); c.drawImage(mapIm, 0, 0, WORLD_W * k, WORLD_H * k); c.restore(); }
      else c.drawImage(mapIm, v.x, v.y, WORLD_W * k, WORLD_H * k);
    } else { c.fillStyle = '#7aa64f'; c.fillRect(v.x, v.y, v.w, v.h); }
    // entrance arrows (tiny) so players know where puffs come from
    for (const r of g.roads) {
      const [x, y] = toScreen(v, r.pts[8], r.pts[9]);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x, y, 5, 0, 6.283); c.fill();
    }
    // range rings under everything
    const sel = ui.sel != null ? g.towers.find(t => t.id === ui.sel) : null;
    if (sel) this.rangeRing(g, sel.def, sel.x, sel.y, true, sel);
    if (ui.place) {
      this.rangeRing(g, ui.place, ui.px, ui.py, ui.ok);
      const fp = ui.place === 'hero' ? 26 : TOWER[ui.place].r;
      const [sx, sy] = toScreen(v, ui.px, ui.py);
      c.strokeStyle = ui.ok ? 'rgba(255,255,255,.9)' : 'rgba(255,80,60,.95)'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, fp * k, 0, 6.283); c.stroke();
    }
    // towers and puffs sorted by screen y so things overlap well
    type D = { y: number; f: () => void };
    const ds: D[] = [];
    for (const t of g.towers) { const [x, y] = toScreen(v, t.x, t.y); ds.push({ y, f: () => this.tower(g, t, x, y, skin) }); }
    for (const p of g.puffs) { const [x, y] = toScreen(v, p.x, p.y); ds.push({ y: y + PUFFS[p.kind].r * k, f: () => this.puff(g, p, x, y) }); }
    if (ui.place) {
      const [x, y] = toScreen(v, ui.px, ui.py);
      ds.push({ y, f: () => this.ghost(ui.place!, x, y, ui.ok, skin, g.cfg.hero ?? 'dora') });
    }
    ds.sort((a, b) => a.y - b.y);
    for (const d of ds) d.f();
    // fliers above everything
    for (const t of g.towers) if (t.s.patrol > 0) this.flier(g, t);
    this.projectiles(g);
    this.effects(dt);
  }

  rangeRing(g: Game, def: TowerId | 'hero', x: number, y: number, ok: boolean, t?: Tower) {
    const c = this.c, k = this.v.k;
    let r = 0;
    if (t) { r = Math.max(t.s.aura, t.s.chill?.[1] ?? 0, ...t.s.atks.map(a => a.range * t.buff.range)); if (t.s.patrol) r = Math.max(r, t.s.patrol + (t.s.atks[0]?.range ?? 0)); }
    else if (def === 'hero') r = 175;
    else { const s = TOWER[def].base(); r = Math.max(s.aura, ...s.atks.map(a => a.range), s.patrol ? s.patrol + (s.atks[0]?.range ?? 0) : 0, 60); }
    const [sx, sy] = toScreen(this.v, x, y);
    c.fillStyle = ok ? 'rgba(255,255,255,.16)' : 'rgba(255,70,50,.18)';
    c.strokeStyle = ok ? 'rgba(255,255,255,.75)' : 'rgba(255,90,70,.85)'; c.lineWidth = 2;
    c.beginPath(); c.arc(sx, sy, r * k, 0, 6.283); c.fill(); c.stroke();
    if (t?.s.aura && t.s.aura !== r) { c.setLineDash([6, 6]); c.beginPath(); c.arc(sx, sy, t.s.aura * k, 0, 6.283); c.stroke(); c.setLineDash([]); }
  }

  ghost(def: TowerId | 'hero', x: number, y: number, ok: boolean, skin: string | undefined, hero: string) {
    const name = def === 'hero' ? heroFrame(skin, 'idle', hero) : def === 'condor' ? 'condor-roost' : `${def}-base-0`;
    spr(this.c, name, x, y + 14 * this.v.k, (TOWER_H[def] ?? 96) * this.v.k, false, 'bottom', ok ? 0.75 : 0.4);
  }

  tower(g: Game, t: Tower, x: number, y: number, skin?: string) {
    const c = this.c, k = this.v.k;
    const since = g.t - t.lastAtk;
    const flip = this.toScreenDx(t.aimX - t.x, t.aimY - t.y) < -4;
    const h = (TOWER_H[t.def] ?? 96) * k;
    const breathe = 1 + Math.sin(this.t * 2.2 + t.id) * 0.012;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + 8 * k, 30 * k, 11 * k, 0, 0, 6.283); c.fill();
    if (t.def === 'hero') {
      let f = 'idle';
      const ha = this.heroAnim;
      if (g.over === 'won') f = 'win';
      else if (ha.until > this.t) f = ha.name === 'ab1' || ha.name === 'ab2' || ha.name === 'ab3' ? ha.name + (Math.floor(this.t * 6) % 2 ? 'b' : 'a') : ha.name;
      else if (since < 0.12) f = 'wind';
      else if (since < 0.3) f = 'throw';
      else if (Math.floor(this.t / 1.4) % 3 === 2) f = 'idle2';
      spr(c, heroFrame(skin, f, g.cfg.hero ?? 'dora'), x, y + 14 * k, h * breathe, flip);
      return;
    }
    if (t.def === 'condor') { spr(c, 'condor-roost', x, y + 14 * k, h * 0.9 * breathe); return; }
    const look = lookOf(t.tiers);
    const attacking = since < (t.def === 'windmill' ? 0.5 : 0.22) || (t.def === 'quinoa' && !g.active && g.t % 6 < 0.6);
    spr(c, `${t.def}-${look}-${attacking ? 1 : 0}`, x, y + 14 * k, h * breathe, flip);
  }
  private toScreenDx(dx: number, dy: number) { return this.v.rot ? -dy : dx; }

  flier(g: Game, t: Tower) {
    const look = lookOf(t.tiers);
    const n = t.s.fliers || 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      const wx = t.fx + (i ? Math.cos(a + g.t) * 46 : 0), wy = t.fy + (i ? Math.sin(a + g.t) * 30 : 0);
      const [x, y] = toScreen(this.v, wx, wy);
      const flap = Math.floor((this.t * 5 + i) % 2);
      const diving = g.t - t.lastAtk < 0.3 && t.lastAtkId === 'dive';
      this.c.fillStyle = 'rgba(0,0,0,.15)'; this.c.beginPath(); this.c.ellipse(x, y + 60 * this.v.k, 26 * this.v.k, 8 * this.v.k, 0, 0, 6.283); this.c.fill();
      const vx = Math.cos(t.fa + 1.57);
      spr(this.c, `condor-${look}-${diving ? 1 : flap}`, x, y, 90 * this.v.k, this.toScreenDx(vx, Math.sin(t.fa + 1.57)) < 0, 'center');
    }
  }

  puff(g: Game, p: Puff, x: number, y: number) {
    const c = this.c, k = this.v.k, d = PUFFS[p.kind];
    const h = PUFF_H(p.kind) * k;
    const bob = Math.sin(this.t * 3 + p.id) * 2 * k;
    const alpha = p.night ? 0.62 : 1;
    if (d.boss) {
      const hurt = p.hp < (d.hp * 0.5);
      spr(c, `b-${p.kind}${hurt ? '-hurt' : ''}`, x, y + bob, h, false, 'center', alpha);
      // health bar
      const full = d.hp * (p.fort ? 2 : 1), fr = Math.max(0, Math.min(1, p.hp / full));
      const bw = h * 0.8; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - bw / 2, y - h * 0.55, bw, 6);
      c.fillStyle = fr > 0.5 ? '#7ee081' : fr > 0.25 ? '#ffd34d' : '#ff6b5b'; c.fillRect(x - bw / 2, y - h * 0.55, bw * fr, 6);
      if (Math.floor(this.t * 1.3 + p.id) % 5 === 0 && (this.t * 1.3) % 1 < 0.15) spr(c, 'b-bolt', x + h * 0.15, y + h * 0.35, h * 0.4, false, 'center');
    } else {
      let name = `p-${p.kind}-${Math.floor(this.t * 3 + p.id) % 2}`;
      if (p.kind === 'sleet' && p.hp <= 3) name = 'p-sleet-crack2'; else if (p.kind === 'sleet' && p.hp <= 6) name = 'p-sleet-crack1';
      spr(c, name, x, y + bob, h, false, 'center', alpha);
    }
    if (p.fort) spr(c, 'ov-fort', x, y + bob, h * 0.95, false, 'center', 0.9);
    if (p.fog) spr(c, 'ov-fog', x, y + bob, h * 1.25, false, 'center', 0.85);
    if (p.night) spr(c, 'ov-night', x, y + bob, h * 1.1, false, 'center', 0.75);
    if (p.frozenT > 0) spr(c, 'fx-ice', x, y + bob, h * 1.05, false, 'center', 0.8);
    if (p.burnT > 0) spr(c, 'fx-burn', x, y + bob + h * 0.15, h * 0.8, false, 'center', 0.9);
    if (p.stunT > 0 && p.frozenT <= 0) spr(c, 'fx-stun', x, y - h * 0.4, h * 0.6, false, 'center');
    if (p.slowT > 0 && p.slowMul < 1) spr(c, 'fx-goo', x, y + bob + h * 0.25, h * 0.7, false, 'center', 0.75);
  }

  projectiles(g: Game) {
    const c = this.c, k = this.v.k;
    const byId = new Map(g.towers.map(t => [t.id, t]));
    for (const pr of g.projs) {
      const t = byId.get(pr.tower); if (!t) continue;
      const a = t.s.atks[pr.atk];
      const [x, y] = toScreen(this.v, pr.x, pr.y);
      if (pr.kind === 'shard') { c.fillStyle = a?.dtype === 'fire' ? '#ffb347' : '#f6e7b0'; c.beginPath(); c.arc(x, y, 3.5 * k * 2, 0, 6.283); c.fill(); continue; }
      let name = t.def === 'hero' ? heroFrame(g.cfg.skin, 'proj', g.cfg.hero ?? 'dora') : `${t.def}-proj`;
      if (t.def === 'pebble' && t.tiers[0] >= 4) name = 'pebble-proj2';
      if (t.def === 'ice' && a?.id === 'icicle' && a.kind === 'lob') name = 'ice-proj2';
      if (t.def === 'boat' && a?.id === 'pot') name = 'boat-proj2';
      if (t.def === 'hay' && pr.kind === 'shot') name = 'hay-proj2';
      if (t.def === 'windmill') name = 'windmill-proj';
      if (t.def === 'condor') name = 'condor-proj';
      let lift = 0;
      if (pr.kind === 'lob') { const q = Math.min(1, pr.t / pr.T); lift = Math.sin(q * Math.PI) * Math.min(90, pr.T * 160) * k; c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x, y, 9 * k, 4 * k, 0, 0, 6.283); c.fill(); }
      const sz = (name.endsWith('proj2') ? 40 : 30) * k * (t.def === 'hay' || t.def === 'windmill' ? 1.3 : 1);
      // a short trail
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x, y - lift);
      const [bx, by] = toScreen(this.v, pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03); if (pr.kind === 'shot') { c.lineTo(bx, by); c.stroke(); }
      spr(c, name, x, y - lift, sz, false, 'center');
    }
  }

  effects(dt: number) {
    const c = this.c;
    for (const r of this.rings) {
      r.t += dt; const q = r.t / r.T;
      c.strokeStyle = r.col; c.globalAlpha = Math.max(0, 1 - q); c.lineWidth = r.w;
      c.beginPath(); c.arc(r.x, r.y, Math.max(1, r.r ? r.r * (0.3 + q * 0.7) : q * 300 * this.v.k), 0, 6.283); c.stroke();
    }
    c.globalAlpha = 1;
    this.rings = this.rings.filter(r => r.t < r.T);
    for (const b of this.beams) {
      b.t += dt; const q = b.t / b.T;
      c.strokeStyle = b.col; c.globalAlpha = Math.max(0, 1 - q); c.lineWidth = b.w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.tx, b.ty); c.stroke();
    }
    c.globalAlpha = 1;
    this.beams = this.beams.filter(b => b.t < b.T);
    for (const p of this.parts) {
      p.t += dt; const q = p.t / p.T;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'drop' ? 400 : 0) * dt;
      c.globalAlpha = Math.max(0, 1 - q * q);
      if (p.kind === 'sprite') spr(c, p.name!, p.x, p.y, p.s * (0.7 + q * 0.5), false, 'center');
      else if (p.kind === 'drop') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.s * (1 - q * 0.5), 0, 6.283); c.fill(); }
      else if (p.kind === 'text') { c.font = `800 ${p.s}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(40,20,10,.8)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.col; c.fillText(p.text!, p.x, p.y); }
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter(p => p.t < p.T);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }
}

export function heroFrame(skin: string | undefined, f: string, hero = 'dora'): string {
  return `${hero}${skin ? '-' + skin : ''}-${f}`;
}
/** pass-through so the page can test water under the pointer without importing the maps module twice */
export { isWater, ROAD_W };

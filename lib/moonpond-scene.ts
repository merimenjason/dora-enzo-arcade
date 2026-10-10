// Moonpond's picture: sky, moon, far bank, water, dock, the two chinchillas, the line and whatever is on the end of
// it. Drawing only. Creatures and props come from lib/moonpond-art.ts by name.
import { drawChinchilla } from './chinchilla-art';
import { creature, prop } from './moonpond-art';
import { Game, rng, byId, BANDS, ZONE_NAMES, FLIGHT, FULL_MOON, MOON_RADIUS, type Event, type Time } from './moonpond-game';

import { pondLayer, pondHero, pondExtra, pondWater, pondReleasePoint } from './moonpond-paint';

type C = CanvasRenderingContext2D;
type Fx = { t: 'ring' | 'spark' | 'drop' | 'bubble'; x: number; y: number; born: number; life: number; size: number; color?: string; vx?: number; vy?: number };

const SKY: Record<Time, [string, string, string, string]> = {
  // top, middle, horizon, water tint
  dusk: ['#241d4a', '#6c4274', '#f0a070', '#3a2f5e'],
  moonrise: ['#0d1436', '#243068', '#5b5c9c', '#1a2450'],
  midnight: ['#050818', '#0c1430', '#1b2852', '#0b1230'],
  firstlight: ['#14244a', '#3d5c84', '#f1b79e', '#274766'],
};
/** The sky once the night is over. */
const DAWN: [string, string, string, string] = ['#3a5a8e', '#e9a98c', '#ffdfa6', '#4b7896'];
const RARITY_TINT = ['', 'rgba(150,175,205,.55)', 'rgba(120,215,150,.6)', 'rgba(185,140,255,.65)', 'rgba(255,215,110,.75)'];
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const blend = (a: number[], b: string, k: number) => { const t = hex(b); for (let i = 0; i < 3; i++) a[i] += (t[i] - a[i]) * k; };
const css = (a: number[], alpha = 1) => `rgba(${a.map((v) => Math.round(v)).join(',')},${alpha})`;

export class Pond {
  /** Off for players who ask for reduced motion: the water, stars and weather hold still. */
  motion = true;
  clock = 0;
  private fx: Fx[] = [];
  private sky = (['#241d4a', '#6c4274', '#f0a070', '#3a2f5e'] as string[]).map(hex);
  private stars = (() => { const r = rng(4711); return Array.from({ length: 110 }, () => ({ x: r(), y: r() ** 1.4, s: 0.5 + r() * 1.3, p: r() * 6.28 })); })();
  private pads = (() => { const r = rng(808); return Array.from({ length: 15 }, (_, i) => ({ aim: -1.05 + (2.1 * (i + r() * 0.8)) / 15, d: 0.215 + r() * 0.19, size: 0.8 + r() * 0.5, flower: r() < 0.3, turn: r() * 6.28 })); })();
  private reeds = (() => { const r = rng(99); return Array.from({ length: 13 }, (_, i) => { const side = i % 2 ? 1 : -1; return { aim: side * (0.45 + r() * 0.75), d: 0.01 + r() * 0.17, size: 0.8 + r() * 0.6 }; }).sort((a, b) => b.d - a.d); })();
  private flies = (() => { const r = rng(31); return Array.from({ length: 46 }, () => ({ x: r(), y: r(), a: r() * 6.28, b: r() * 6.28, s: 0.4 + r() * 0.8 })); })();
  private w = 1; private h = 1;
  /** How far the bobber is drawn below its float line, eased. */
  private dip = 0;
  // What the picture remembers between frames, for the animations that follow the game's changes of state.
  private last = 'ready'; private stateAt = 0; private joltAt = -9; private cheerAt = -9; private startleAt = -9; private wakeAt = 0;
  private hookPos = { x: 0, y: 0, s: 1 };
  /** The catch being lifted out and held up, and the one just let go. */
  private show: { id: string; at: number; from: { x: number; y: number }; first: boolean; burst: boolean } | null = null;
  private gone: { id: string; at: number; splashed: boolean } | null = null;

  /** Where a point on the water is on screen, and how large things there are drawn. */
  project(aim: number, d: number) {
    const near = this.h * 0.70, far = this.h * 0.375, k = (1 - d) ** 1.45;
    return { x: this.w / 2 + aim * this.w * 0.37 * (0.72 + 0.28 * k), y: far + (near - far) * k, s: 0.42 + 0.58 * k };
  }
  private since(t: number) { return this.clock - t; }

  /** Feeds the engine's events to the picture. */
  take(events: Event[], g: Game) {
    for (const e of events) {
      const at = g.bob ? this.project(g.bob.aim, g.bob.d) : { x: this.w / 2, y: this.h * 0.7, s: 1 };
      if (e.t === 'splash') { this.ring(at.x, at.y, 26 * at.s, 0.9); this.ring(at.x, at.y, 40 * at.s, 1.3); this.drops(at.x, at.y, 8, at.s); }
      else if (e.t === 'nibble') this.ring(at.x, at.y, 14 * at.s, 0.6);
      else if (e.t === 'bite') { this.ring(at.x, at.y, 30 * at.s, 0.7); this.ring(at.x, at.y, 46 * at.s, 1); this.drops(at.x, at.y, 6, at.s); this.startleAt = this.clock; if (this.motion) for (let i = 0; i < 6; i++) this.fx.push({ t: 'bubble', x: at.x + (i - 2.5) * 5 * at.s, y: at.y + 4, born: this.clock + i * 0.05, life: 0.8, size: 1.5 + (i % 3), color: 'rgba(215,236,255,.7)', vx: (i % 2 ? 6 : -6), vy: -26 - i * 4 }); }
      else if (e.t === 'jump') { const p = this.hooked(g); if (p) { this.ring(p.x, p.y, 34 * p.s, 0.9); this.drops(p.x, p.y, 12, p.s); } }
      // A landed catch is announced by `watch`, which lifts it out of the water.
      else if (e.t === 'snapped' || e.t === 'slipped') { const p = this.project(g.bob?.aim ?? 0, (g.bob?.d ?? 0.4) * 0.6); this.ring(p.x, p.y, 30 * p.s, 0.8); this.drops(p.x, p.y, 10, p.s); }
    }
  }
  private ring(x: number, y: number, size: number, life: number) { if (this.motion) this.fx.push({ t: 'ring', x, y, born: this.clock, life, size }); }
  private drops(x: number, y: number, n: number, s: number) { if (this.motion) for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + (0.7 * i) / n); this.fx.push({ t: 'drop', x, y, born: this.clock, life: 0.55, size: 1.6 * s + 0.6, vx: Math.cos(a) * 60 * s, vy: Math.sin(a) * 120 * s }); } }
  private burst(x: number, y: number, first: boolean) {
    if (!this.motion) return;
    for (let i = 0; i < (first ? 36 : 16); i++) { const a = (i / 16) * Math.PI * 2 + i, v = 40 + (i % 5) * 26; this.fx.push({ t: 'spark', x, y, born: this.clock, life: 0.9 + (i % 4) * 0.2, size: 2 + (i % 3), color: first ? '#ffe9a0' : '#cfe4ff', vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50 }); }
  }
  /** Notices the game changing state and starts whatever should move because of it. */
  private watch(g: Game) {
    if (g.state === 'hooked' && g.fight) {
      const p = this.hooked(g); if (p) this.hookPos = p;
      // A hard pull leaves a wake.
      if (p && g.fight.pull > 0.5 && !g.fight.jump && this.since(this.wakeAt) > 0.2) { this.wakeAt = this.clock; this.ring(p.x, p.y, 15 * p.s, 0.6); }
    }
    if (g.state === this.last) return;
    if (g.state === 'landed' && g.caught) {
      this.show = { id: g.caught.id, at: this.clock, from: { x: this.hookPos.x, y: this.hookPos.y }, first: g.caught.first, burst: false }; this.cheerAt = this.clock;
      this.ring(this.hookPos.x, this.hookPos.y, 36, 0.9); this.drops(this.hookPos.x, this.hookPos.y, 14, 1);
    }
    if (this.last === 'landed' && this.show) { this.gone = this.motion ? { id: this.show.id, at: this.clock, splashed: false } : null; this.show = null; }
    if (g.state === 'lost' && g.loss === 'snapped') this.joltAt = this.clock;
    this.last = g.state; this.stateAt = this.clock;
  }
  /** How high a chinchilla is off the dock: both cheer a catch, and the one with the lantern starts at a bite. */
  private hop(unit: number, angler: boolean) {
    if (!this.motion) return 0;
    const cheer = this.since(this.cheerAt), start = this.since(this.startleAt);
    if (cheer >= 0 && cheer < 0.9) return Math.abs(Math.sin((cheer / 0.45) * Math.PI + (angler ? 0 : 0.5))) * unit * (2.6 - cheer * 1.6);
    return !angler && start >= 0 && start < 0.32 ? Math.sin((start / 0.32) * Math.PI) * unit * 1.5 : 0;
  }
  /** Where the hooked creature is on screen. */
  private hooked(g: Game) {
    if (!g.fight || !g.bob) return null;
    const d = g.bob.d * (1 - g.fight.p) + 0.04 * g.fight.p, sway = Math.sin(g.fight.tau * 3.1) * 0.12 * g.fight.pull * (1 - g.fight.p * 0.6);
    return this.project(g.bob.aim * (1 - g.fight.p * 0.8) + sway, d);
  }
  /** What the tests read to check the picture follows the game. */
  inspect(g: Game) { return { dip: this.dip, fx: this.fx.length, holding: this.show?.id ?? null, releasing: this.gone?.id ?? null, releaseTarget: this.gone ? pondReleasePoint(this.w,this.h) : null, hop: this.hop(1, true), bob: g.bob ? this.project(g.bob.aim, g.bob.d) : null, hooked: this.hooked(g) }; }

  draw(c: C, w: number, h: number, dpr: number, g: Game, dt: number) {
    this.w = w; this.h = h; if (this.motion) this.clock += dt;
    const t = this.clock, live = this.motion, horizon = h * 0.36, unit = Math.min(w, h * 1.25) / 100;
    this.watch(g);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    // A snapped line jolts the whole picture.
    const jolt = live ? Math.max(0, 1 - this.since(this.joltAt) / 0.35) : 0; if (jolt > 0) c.translate(Math.sin(t * 90) * unit * 0.6 * jolt, Math.cos(t * 70) * unit * 0.4 * jolt);
    const tones = g.state === 'dawn' ? DAWN : SKY[g.hour]; for (let i = 0; i < 4; i++) blend(this.sky[i], tones[i], live ? Math.min(1, dt * 1.2) : 1);
    const dim = g.weather === 'rain' ? 0.72 : g.weather === 'mist' ? 0.88 : 1;

    const landscape = pondLayer(c, 'environment', w, h);
    // Sky.
    const sky = c.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, css(this.sky[0].map((v) => v * dim))); sky.addColorStop(0.6, css(this.sky[1].map((v) => v * dim))); sky.addColorStop(1, css(this.sky[2].map((v) => v * dim)));
    c.globalAlpha = landscape ? .26 : 1; c.fillStyle = sky; c.fillRect(0, 0, w, horizon + 2); c.globalAlpha = 1;
    const starry = (g.hour === 'dusk' || g.hour === 'firstlight' ? 0.35 : 1) * (g.weather === 'clear' || g.weather === 'fireflies' ? 1 : 0.25);
    for (const s of this.stars) { c.fillStyle = `rgba(255,250,235,${starry * (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.p)))})`; c.fillRect(s.x * w, s.y * horizon * 0.92, s.s, s.s); }
    // Moon: it climbs and sets across the night, lit by its phase.
    const night = Math.min(1, (g.cast + (g.state === 'ready' || g.state === 'charging' || g.state === 'dawn' ? 0 : 0.5)) / g.casts), mr = unit * 4.6, moonSpot = g.moon, mx = moonSpot ? this.project(moonSpot.aim,moonSpot.d).x : w * (0.16 + 0.68 * night), my = Math.max(mr + unit * 1.8, horizon * (0.46 - 0.3 * Math.sin(night * Math.PI)));
    if (g.weather !== 'rain' && g.state !== 'dawn') {
      const halo = c.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4.2); halo.addColorStop(0, `rgba(210,225,255,${g.phase === 0 ? 0.05 : 0.2 * dim})`); halo.addColorStop(1, 'rgba(210,225,255,0)'); c.fillStyle = halo; c.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
      c.save(); c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fillStyle = g.phase === 0 ? 'rgba(14,24,44,.08)' : 'rgba(14,24,44,.65)'; c.fill(); c.clip();
      const lit = g.phase <= FULL_MOON ? g.phase / 4 : (8 - g.phase) / 4, side = g.phase <= FULL_MOON ? 1 : -1;
      if (lit > 0) { c.fillStyle = '#f4f1e2'; c.beginPath(); c.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, side < 0); c.ellipse(mx, my, Math.abs(1 - lit * 2) * mr, mr, 0, Math.PI / 2, -Math.PI / 2, lit > 0.5 ? side < 0 : side > 0); c.fill(); c.save(); c.clip(); pondExtra(c, 'moon', mx, my, mr * 2); c.restore(); c.fillStyle = 'rgba(190,196,214,.3)'; for (const [x, y, r] of [[-0.3, -0.2, 0.2], [0.25, 0.3, 0.15], [0.1, -0.4, 0.1]]) { c.beginPath(); c.arc(mx + x * mr, my + y * mr, r * mr, 0, 7); c.fill(); } }
      c.restore();
    }
    if (g.weather === 'rain' || g.weather === 'mist') for (let i=0;i<5;i++) {
      const x=((i*.27+t*.006*(i%2?1:.6))%1.3-.15)*w,y=horizon*(.18+(i%3)*.2),r=w*.28;
      c.save();c.translate(x,y);c.scale(1,horizon*.13/r);const cloud=c.createRadialGradient(0,0,1,0,0,r);cloud.addColorStop(0,g.weather==='rain'?'rgba(32,42,67,.52)':'rgba(190,205,228,.18)');cloud.addColorStop(1,'rgba(150,175,205,0)');c.fillStyle=cloud;c.fillRect(-r,-r,r*2,r*2);c.restore();
    }

    // A shooting star now and then on a clear night.
    if (live && g.state !== 'dawn' && (g.weather === 'clear' || g.weather === 'fireflies')) {
      const turn = Math.floor(t / 11), r = rng(turn * 7 + 3), age = t - turn * 11 - r() * 8;
      if (age > 0 && age < 0.6) { const k = age / 0.6, x = w * (0.1 + r() * 0.65) + unit * 26 * k, y = horizon * (0.08 + r() * 0.3) + unit * 9 * k, tail = c.createLinearGradient(x, y, x - unit * 9, y - unit * 3.1); tail.addColorStop(0, `rgba(255,252,235,${Math.sin(k * Math.PI)})`); tail.addColorStop(1, 'rgba(255,252,235,0)'); c.strokeStyle = tail; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - unit * 9, y - unit * 3.1); c.stroke(); }
    }
    // Dawn: the sun comes up behind the far bank and the birds are about.
    if (g.state === 'dawn') {
      const k = live ? Math.min(1, this.since(this.stateAt) / 3) : 1, sx = w * 0.64, sun = c.createRadialGradient(sx, horizon, 1, sx, horizon, unit * (18 + 34 * k)); sun.addColorStop(0, `rgba(255,232,170,${0.85 * k})`); sun.addColorStop(0.3, `rgba(255,196,130,${0.4 * k})`); sun.addColorStop(1, 'rgba(255,196,130,0)');
      c.fillStyle = sun; c.fillRect(0, 0, w, horizon + 2);
      c.strokeStyle = `rgba(30,26,48,${0.75 * k})`; c.lineWidth = 1.5; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const x = ((t * 0.035 + i * 0.09) % 1.3 - 0.15) * w, y = horizon * (0.28 + (i % 3) * 0.09) + Math.sin(t * 1.3 + i) * unit, flap = Math.sin(t * 9 + i * 2) * unit * 0.9, span = unit * (1.3 + (i % 2) * 0.5); c.beginPath(); c.moveTo(x - span, y - flap); c.quadraticCurveTo(x - span * 0.4, y - unit * 0.3, x, y); c.quadraticCurveTo(x + span * 0.4, y - unit * 0.3, x + span, y - flap); c.stroke(); }
    }

    // Far bank.
    if (!landscape) { c.fillStyle = css(this.sky[0].map((v) => v * 0.45 + 6)); c.beginPath(); c.moveTo(0, horizon + 2);
    for (let i = 0; i <= 60; i++) { const x = (i / 60) * w, tree = Math.abs(Math.sin(i * 1.9) * Math.sin(i * 0.7 + 2)) * unit * 7 + Math.sin(i * 0.23) * unit * 2.5 + unit * 4; c.lineTo(x, horizon - tree); }
    c.lineTo(w, horizon + 2); c.fill();
    }
    for (const [x, on] of [[0.18, 0.9], [0.71, 0.7], [0.86, 1]]) { const fl = 0.6 + 0.4 * Math.sin(t * 3 + x * 20) * on; c.fillStyle = `rgba(255,205,120,${0.5 * fl})`; c.beginPath(); c.arc(x * w, horizon - unit * 2.2, unit * 0.7, 0, 7); c.fill(); c.fillStyle = `rgba(255,205,120,${0.12 * fl})`; c.fillRect(x * w - unit * 0.5, horizon, unit, unit * 9); }

    // Water.
    const water = c.createLinearGradient(0, horizon, 0, h); water.addColorStop(0, css(this.sky[2].map((v, i) => (v * 0.5 + this.sky[3][i] * 0.5) * dim))); water.addColorStop(0.18, css(this.sky[3].map((v) => v * dim))); water.addColorStop(1, css(this.sky[3].map((v) => v * 0.38)));
    c.globalAlpha = landscape ? .28 : 1; c.fillStyle = water; c.fillRect(0, horizon, w, h - horizon); c.globalAlpha = 1;
    pondWater(c,w,h,t,live);
    // The deep channel is a darker ribbon across the far water.
    const deepTop = this.project(0, 1).y, deepBottom = this.project(0, BANDS[3][1]).y, channel = c.createLinearGradient(0, deepTop, 0, deepBottom + unit * 3); channel.addColorStop(0, 'rgba(2,5,20,0)'); channel.addColorStop(0.35, 'rgba(2,5,20,.42)'); channel.addColorStop(0.8, 'rgba(2,5,20,.3)'); channel.addColorStop(1, 'rgba(2,5,20,0)');
    c.fillStyle = channel; c.fillRect(0, deepTop, w, deepBottom + unit * 3 - deepTop);
    c.strokeStyle = 'rgba(210,225,255,.07)'; c.lineWidth = 1; for (let i = 0; i < 26; i++) { const k = (i / 26) ** 1.7, y = horizon + 4 + k * (h - horizon), len = w * (0.05 + 0.12 * k), x = ((i * 0.37 + Math.sin(t * 0.25 + i) * 0.04 + 1) % 1) * w; c.beginPath(); c.moveTo(x - len, y); c.lineTo(x + len, y); c.stroke(); }
    // The moon on the water.
    const moon = g.moon;
    if (moon) {
      const p = this.project(moon.aim, moon.d), rx = this.w * 0.37 * MOON_RADIUS * 1.15, bright = (g.up.rod >= 2 ? 1 : 0.5) * (0.45 + 0.55 * (g.phase <= FULL_MOON ? g.phase / 4 : (8 - g.phase) / 4));
      c.save();c.translate(p.x,p.y);c.scale(1,.32);const glow=c.createRadialGradient(0,0,1,0,0,rx*1.9);glow.addColorStop(0,`rgba(235,240,255,${.19*bright})`);glow.addColorStop(1,'rgba(235,240,255,0)');c.fillStyle=glow;c.fillRect(-rx*1.9,-rx*1.9,rx*3.8,rx*3.8);c.restore();
      for (let j = 0; j < 20; j++) { const k=j/20, y=p.y+(h*.70-p.y)*k, len=rx*(.42+.3*k), wob=Math.sin(t*1.4+j*1.8)*rx*.14; c.fillStyle=`rgba(230,239,255,${bright*.20*(1-k)})`;c.fillRect(p.x-len+wob,y,len*2,Math.max(1,unit*.16)); }
      for (let i = -4; i <= 4; i++) { const wob = Math.sin(t * 2.2 + i * 1.3) * rx * 0.18, len = rx * (1 - Math.abs(i) / 5.5); c.fillStyle = `rgba(250,250,255,${(0.5 - Math.abs(i) * 0.07) * bright})`; c.fillRect(p.x - len + wob, p.y + i * rx * 0.09, len * 2, Math.max(1, rx * 0.035)); }
    }


    // Reeds on the far side of the lilies, lilies, then everything that floats.
    for (const r of this.reeds) { const p = this.project(r.aim, r.d); prop(c, 'reed', p.x, p.y - unit * 4.4 * r.size * p.s, unit * 9 * r.size * p.s, t); }
    for (const pad of this.pads) { const p = this.project(pad.aim, pad.d), bob = Math.sin(t * 1.1 + pad.turn) * 0.8; prop(c, pad.flower ? 'lily-flower' : 'lily', p.x, p.y + bob, unit * 7.5 * pad.size * p.s); }

    // Rings and droplets on the water.
    this.fx = this.fx.filter((f) => this.since(f.born) < f.life);
    for (const f of this.fx) if (f.t === 'ring') { const k = this.since(f.born) / f.life; c.strokeStyle = `rgba(225,235,255,${0.55 * (1 - k)})`; c.lineWidth = 1.4; c.beginPath(); c.ellipse(f.x, f.y, f.size * (0.2 + k), f.size * (0.2 + k) * 0.34, 0, 0, 7); c.stroke(); }
    if (g.weather === 'rain' && live) for (let i = 0; i < 9; i++) { const seed = Math.floor(t * 3 + i * 7.3), r = rng(seed * 13 + i), k = (t * 3 + i * 7.3) % 1, d = r(), p = this.project(r() * 2.2 - 1.1, d); c.strokeStyle = `rgba(215,228,255,${0.4 * (1 - k)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(p.x, p.y, unit * 3 * p.s * (0.2 + k), unit * p.s * (0.2 + k), 0, 0, 7); c.stroke(); }

    // Out on the water something small jumps now and then.
    if (live && g.state !== 'hooked' && g.state !== 'dawn') {
      const turn = Math.floor(t / 7), r = rng(turn * 13 + 1), age = t - turn * 7 - r() * 5, p = this.project(r() * 1.8 - 0.9, 0.3 + r() * 0.6), side = r() < 0.5 ? 1 : -1;
      if (age > 0 && age < 1.6) {
        for (const [from, x] of [[0, p.x], [0.55, p.x + side * unit * 4 * p.s]]) { const k = (age - from) / 1; if (k > 0 && k < 1) { c.strokeStyle = `rgba(225,235,255,${0.45 * (1 - k)})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, p.y, unit * 3.2 * p.s * (0.2 + k), unit * 1.1 * p.s * (0.2 + k), 0, 0, 7); c.stroke(); } }
        if (age < 0.6) { const k = age / 0.6; creature(c, 'pad-minnow', p.x + side * unit * 4 * p.s * k, p.y - Math.sin(k * Math.PI) * unit * 4.5 * p.s, unit * 3 * p.s, t, { face: side as 1 | -1, rot: (k - 0.5) * 2, silhouette: 'rgba(8,12,30,.85)' }); }
      }
    }

    if (g.weather === 'rain') pondExtra(c, 'umbrella', w / 2, h * .74 - unit * 14, unit * 68, unit * 50);
    this.cast(c, g, unit, t);
    this.dock(c, g, unit, t);
    this.lift(c, unit, t);

    // Droplets and sparks sit above the dock.
    for (const f of this.fx) if (f.t !== 'ring') { const age = this.since(f.born), k = age / f.life, x = f.x + (f.vx ?? 0) * age, y = f.y + (f.vy ?? 0) * age + (f.t === 'drop' ? 260 : f.t === 'bubble' ? -30 : 60) * age * age; if (age < 0) continue; c.fillStyle = f.t === 'drop' ? `rgba(220,235,255,${0.8 * (1 - k)})` : f.color!; c.globalAlpha = f.t === 'spark' ? 1 - k : 1; c.beginPath(); c.arc(x, y, f.size * (f.t === 'spark' ? 1 - k * 0.5 : 1), 0, 7); c.fill(); c.globalAlpha = 1; }

    // Weather in front of everything.
    if (g.weather === 'rain') { c.strokeStyle = 'rgba(200,215,245,.32)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 90; i++) { const x = ((i * 0.618 + t * 0.35) % 1) * (w + 60) - 30, y = ((i * 0.377 + t * (1.5 + (i % 5) * 0.12)) % 1) * h; if (y > h * .58 && Math.abs(x - w / 2) < unit * 28) continue; c.moveTo(x, y); c.lineTo(x - unit * 0.8, y + unit * 3.4); } c.stroke(); }
    if (g.weather === 'mist') for (let i = 0; i < 5; i++) { const y = horizon + (h - horizon) * (0.02 + i * 0.16), x = ((i * 0.31 + t * 0.012 * (i % 2 ? 1 : -1) + 2) % 1.4 - 0.2) * w, m = c.createRadialGradient(x, y, 1, x, y, w * 0.5); m.addColorStop(0, 'rgba(215,224,240,.2)'); m.addColorStop(1, 'rgba(215,224,240,0)'); c.fillStyle = m; c.beginPath(); c.ellipse(x, y, w * 0.5, unit * 9, 0, 0, 7); c.fill(); }
    const flies = g.weather === 'fireflies' ? this.flies.length : 7;
    for (let i = 0; i < flies; i++) { const f = this.flies[i], x = (f.x + Math.sin(t * 0.21 * f.s + f.a) * 0.06) * w, y = horizon * 0.7 + (f.y * 0.75 + Math.sin(t * 0.33 * f.s + f.b) * 0.04) * (h - horizon * 0.7), on = Math.max(0, Math.sin(t * 1.6 * f.s + f.a * 3)); if (on < 0.05) continue; const r = unit * (1.2 + f.s); const gl = c.createRadialGradient(x, y, 0, x, y, r * 2.4); gl.addColorStop(0, `rgba(255,240,150,${0.85 * on})`); gl.addColorStop(0.25, `rgba(230,255,140,${0.35 * on})`); gl.addColorStop(1, 'rgba(230,255,140,0)'); c.fillStyle = gl; c.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8); }
    // The line close to breaking reddens the edges.
    if (g.fight && g.fight.strain > 0) { const k = Math.min(1, g.fight.strain / g.snapAfter), red = c.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75); red.addColorStop(0, 'rgba(200,40,40,0)'); red.addColorStop(1, `rgba(200,40,40,${0.5 * k * (live ? 0.75 + 0.25 * Math.sin(t * 16) : 1)})`); c.fillStyle = red; c.fillRect(0, 0, w, h); }
    // Edge shade.
    const shade = c.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.8); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(2,3,12,.5)'); c.fillStyle = shade; c.fillRect(0, 0, w, h);
    // Label only the current cast target or bobber, never every area at once.
    const target = g.state === 'charging' ? { aim: g.aim, d: g.charge * g.reach }
      : (g.state === 'waiting' || g.state === 'hooked') ? g.bob : null;
    if (target) {
      c.save(); c.font = `600 ${Math.max(13, unit * 1.6)}px Georgia`; c.textAlign = 'center'; c.textBaseline = 'middle';
      {
        const name = ZONE_NAMES[g.zoneFor(target.aim, target.d)], p = this.project(target.aim, target.d), width = c.measureText(name).width + 24, height = Math.max(29, unit * 3.4);
        const x = Math.max(width / 2 + 10, Math.min(w - width / 2 - 10, p.x)), y = Math.max(height / 2 + 10, p.y - unit * 3.5 - height / 2);
        c.fillStyle = '#10243b'; c.strokeStyle = '#a78c58'; c.lineWidth = 1;
        c.beginPath(); c.roundRect(x - width / 2, y - height / 2, width, height, 7); c.fill(); c.stroke();
        c.fillStyle = '#fff4d8'; c.fillText(name, x, y);
      }
      c.restore();
    }

  }

  /** Where the rod's tip is, bent towards the load on it. */
  private rod(g: Game, unit: number) {
    const cx = this.w / 2, hand = { x: cx - unit * 4, y: this.h * 0.74 - unit * 6.4 }, aim = g.bob?.aim ?? g.aim;
    const load = g.fight ? g.fight.tension : g.state === 'charging' ? -g.charge * 0.7 : 0, back = g.state === 'charging' ? g.charge : 0;
    // The throw whips the rod forward and it springs back.
    const whip = g.state === 'flying' ? Math.sin(Math.min(1, g.clock / 0.42) * Math.PI) : 0;
    const tip = { x: hand.x + unit * (7 + aim * 5 - back * 9 + whip * 5) + load * unit * 2.5, y: hand.y - unit * (23 - back * 4 - whip * 9) + Math.max(0, load) * unit * 7 };
    return { hand, tip, bend: { x: hand.x + (tip.x - hand.x) * 0.45 - Math.max(0, load) * unit * 2.4, y: hand.y + (tip.y - hand.y) * 0.62 - Math.max(0, load) * unit * 2 } };
  }

  /** The cast marker, the bobber, whatever is under it and the line back to the rod. */
  private cast(c: C, g: Game, unit: number, t: number) {
    const { tip } = this.rod(g, unit);
    c.lineCap = 'round';
    if (g.state === 'ready' || g.state === 'charging') {
      // How far the rod reaches, and where this cast would land.
      c.setLineDash([unit * 0.9, unit * 1.3]); c.strokeStyle = 'rgba(235,240,255,.2)'; c.lineWidth = 1.2; c.beginPath();
      for (let a = -1; a <= 1.001; a += 0.1) { const p = this.project(a, g.reach); if (a === -1) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); } c.stroke(); c.setLineDash([]);
      const d = g.state === 'charging' ? g.charge * g.reach : 0.02, p = this.project(g.aim, d);
      if (g.state === 'charging') {
        c.strokeStyle = 'rgba(255,236,170,.9)'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, unit * 3.2 * p.s, unit * 1.15 * p.s, 0, 0, 7); c.stroke();
        c.fillStyle = 'rgba(255,236,170,.25)'; c.fill();
        // The arc the lure will fly, and a ring breathing where it will land.
        c.setLineDash([2, unit * 1.1]); c.lineDashOffset = -t * unit * 6; c.strokeStyle = 'rgba(255,236,170,.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(tip.x, tip.y); c.quadraticCurveTo((tip.x + p.x) / 2, Math.min(tip.y, p.y) - this.h * 0.2, p.x, p.y); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
        const breath = (t * 1.6) % 1; c.strokeStyle = `rgba(255,236,170,${0.6 * (1 - breath)})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p.x, p.y, unit * (3.2 + 3 * breath) * p.s, unit * (1.15 + 1.1 * breath) * p.s, 0, 0, 7); c.stroke();
      } else { const a = this.project(g.aim, 0.05), b = this.project(g.aim, g.reach); c.strokeStyle = 'rgba(255,236,170,.28)'; c.lineWidth = 2; c.setLineDash([2, unit * 1.4]); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]); }
      return;
    }
    if (!g.bob || g.state === 'dawn') return;
    const at = this.project(g.bob.aim, g.bob.d);
    if (g.state === 'flying') {
      const k = Math.min(1, g.clock / FLIGHT), x = tip.x + (at.x - tip.x) * k, y = tip.y + (at.y - tip.y) * k - Math.sin(k * Math.PI) * this.h * 0.2;
      this.line(c, tip, { x, y }, 0.5, unit); prop(c, 'bobber', x, y, unit * 3.4 * (1 - 0.5 * k * (1 - at.s)));
      return;
    }
    if (g.state === 'waiting' && g.bite) {
      const b = g.bite, sp = byId.get(b.id)!, clock = g.clock, close = Math.min(1, Math.max(0, (clock - 0.4) / Math.max(0.6, b.at - 0.4)));
      // The shadow circles in under the bobber.
      if (clock > 0.4) { const orbit = unit * (9 - 6.5 * close) * at.s, a = clock * 1.6 + b.o1 * 6, sx = at.x + Math.cos(a) * orbit, sy = at.y + unit * 1.2 * at.s + Math.sin(a) * orbit * 0.32, size = unit * (4 + Math.min(6, (sp.size?.[1] ?? 10) / 16)) * at.s;
        c.globalAlpha = 0.25 + 0.45 * close; creature(c, b.id, sx, sy, size, t, { face: Math.sin(a) > 0 ? -1 : 1, silhouette: g.up.spyglass ? RARITY_TINT[sp.rarity] : 'rgba(4,8,22,.75)' }); c.globalAlpha = 1; }
      const target = g.biting ? unit * 1.5 * at.s : g.nibbling ? unit * 0.55 * at.s : 0; this.dip += (target - this.dip) * 0.35;
      const y = at.y + this.dip + Math.sin(t * 2.4) * 0.8 + (this.motion ? Math.sin(g.clock * 13) * Math.exp(-g.clock * 3.5) * unit * 1.2 * at.s : 0);
      this.line(c, tip, { x: at.x, y: y - unit * 1.2 * at.s }, 0.25, unit);
      c.save(); c.beginPath(); c.rect(at.x - unit * 4, at.y - unit * 8, unit * 8, unit * 8 + unit * 0.3 * at.s); c.clip(); prop(c, 'bobber', at.x, y - unit * 0.5 * at.s, unit * 3.4 * at.s); c.restore();
      if (g.biting) { const pulse = 1 + 0.15 * Math.sin(t * 22); c.font = `700 ${unit * 5 * pulse}px Georgia, serif`; c.textAlign = 'center'; c.fillStyle = 'rgba(10,10,28,.7)'; c.fillText('!', at.x + 1.5, at.y - unit * 4.4 + 1.5); c.fillStyle = '#ffe58a'; c.fillText('!', at.x, at.y - unit * 4.4); }
      return;
    }
    const p = this.hooked(g);
    if (g.state === 'hooked' && p && g.fight && g.bite) {
      const f = g.fight, sp = byId.get(g.bite.id)!, size = unit * (5 + Math.min(7, (sp.size?.[1] ?? 10) / 14)) * p.s, face = Math.cos(f.tau * 3.1) > 0 ? 1 : -1;
      if (f.jump) {
        // Out of the water, turning over as it goes.
        const lift = this.h * 0.11 * p.s;
        const period = this.period(g), into = Math.min(1, Math.max(0, 1 - (period - (f.tau % period)) / 0.6)), y = p.y - Math.sin(into * Math.PI) * lift;
        this.line(c, tip, { x: p.x, y }, 0.9, unit); creature(c, g.bite.id, p.x, y, size * 1.15, t, { face, rot: (into - 0.5) * 1.4 });
      } else {
        this.line(c, tip, p, f.tension, unit);
        c.globalAlpha = 0.6; creature(c, g.bite.id, p.x, p.y + unit * 0.8 * p.s, size, t, { face, silhouette: 'rgba(4,8,22,.8)' }); c.globalAlpha = 1;
        c.strokeStyle = `rgba(230,240,255,${0.25 + 0.5 * Math.min(1, f.pull)})`; c.lineWidth = 1.5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x + s * unit * 2.5 * p.s, p.y - unit * 0.6, p.x + s * unit * (4 + 3 * f.pull) * p.s, p.y + unit * 0.5 * p.s); c.stroke(); }
        if (f.tell) { const pulse = (f.tau * 6) % 1; c.strokeStyle = `rgba(255,229,138,${1 - pulse})`; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, unit * (2 + 5 * pulse) * p.s, unit * (0.7 + 1.7 * pulse) * p.s, 0, 0, 7); c.stroke(); }
      }
      this.gauge(c, g, unit);
    }
  }
  private period(g: Game) { return 2.8 + g.bite!.o1 * 0.8; }

  private line(c: C, a: { x: number; y: number }, b: { x: number; y: number }, tension: number, unit: number) {
    const sag = (1 - Math.min(1, Math.max(0, tension))) * unit * 7, buzz = this.motion && tension > 0.62 ? Math.sin(this.clock * 55) * (tension - 0.62) * unit * 2.6 : 0;
    c.strokeStyle = tension > 0.8 ? 'rgba(255,200,190,.9)' : 'rgba(235,238,250,.7)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2 + buzz, (a.y + b.y) / 2 + sag, b.x, b.y); c.stroke();
  }

  /** The tension gauge beside the dock: stay in the pale band. */
  private gauge(c:C,g:Game,unit:number){
    if (!g.fight?.tell && !g.fight?.jump) return;
    c.font=`bold ${Math.max(15,unit*2.5)}px Georgia`;c.textAlign='center';c.fillStyle='#0b1a2cee';c.fillRect(this.w*.3,this.h*.43,this.w*.4,unit*5);c.fillStyle='#ffe3b5';c.fillText('Let go for the leap!',this.w/2,this.h*.43+unit*3.5);
  }

  /** The catch lifted out of the water and held up over the lantern, and its dive back when it is let go. */
  private lift(c: C, unit: number, t: number) {
    const hold = { x: this.w / 2 + unit * 0.6, y: this.h * 0.74 - unit * 6 }, sizeOf = (id: string) => unit * (12 + Math.min(6, (byId.get(id)!.size?.[1] ?? 12) / 18));
    if (this.show) {
      const { id, from, first } = this.show, k = this.motion ? Math.min(1, this.since(this.show.at) / 0.75) : 1, size = sizeOf(id);
      if (k >= 1 && !this.show.burst) { this.show.burst = true; this.burst(hold.x, hold.y, first); }
      if (k < 1) {
        const e = 1 - (1 - k) ** 2, x = from.x + (hold.x - from.x) * e, y = from.y + (hold.y - from.y) * e - Math.sin(k * Math.PI) * this.h * 0.16;
        creature(c, id, x, y, size * (0.45 + 0.55 * e), t, { rot: (1 - e) * 7 });
        if (Math.floor(this.since(this.show.at) * 30) % 3 === 0) this.fx.push({ t: 'drop', x, y, born: this.clock, life: 0.4, size: 1.6, vx: 0, vy: 20 });
      } else {
        const held = this.since(this.show.at) - 0.75, halo = c.createRadialGradient(hold.x, hold.y, 1, hold.x, hold.y, size * 0.95); halo.addColorStop(0, `rgba(255,240,190,${first ? 0.5 : 0.3})`); halo.addColorStop(1, 'rgba(255,240,190,0)');
        c.fillStyle = halo; c.beginPath(); c.arc(hold.x, hold.y, size * 0.95, 0, 7); c.fill();
        // A first sketch gets turning rays behind it.
        if (first && this.motion) { c.save(); c.translate(hold.x, hold.y); c.rotate(t * 0.5); c.fillStyle = 'rgba(255,236,170,.16)'; for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(size * 0.95, -size * 0.13); c.lineTo(size * 0.95, size * 0.13); c.fill(); } c.restore(); }
        const settle = this.motion ? 1 + 0.25 * Math.exp(-held * 7) * Math.cos(held * 18) : 1;
        creature(c, id, hold.x, hold.y + (this.motion ? Math.sin(t * 2.2) * unit * 0.5 : 0), size * settle, t, { rot: this.motion ? Math.sin(t * 1.4) * 0.08 : 0 });
      }
    }
    if (this.gone) {
      const { id } = this.gone, age = this.since(this.gone.at), k = age / 0.55, to = pondReleasePoint(this.w,this.h), size = sizeOf(id);
      if (k < 1) creature(c, id, hold.x + (to.x - hold.x) * k, hold.y + (to.y - hold.y) * k * k - Math.sin(k * Math.PI) * unit * 7, size * (1 - 0.35 * k), t, { face: -1, rot: -k * 1.6 });
      else {
        if (!this.gone.splashed) { this.gone.splashed = true; this.ring(to.x, to.y, 30, 0.9); this.ring(to.x, to.y, 46, 1.2); this.drops(to.x, to.y, 12, 1); }
        // Its shadow slips away under the water.
        const away = (age - 0.55) / 1.4; if (away < 1) { c.globalAlpha = 0.5 * (1 - away); creature(c, id, to.x - away * unit * 16, to.y - away * unit * 5, size * (0.65 - 0.25 * away), t, { face: -1, silhouette: 'rgba(4,8,22,.8)' }); c.globalAlpha = 1; } else this.gone = null;
      }
    }
  }

  /** The dock, the lantern and the two friends. */
  private dock(c: C, g: Game, unit: number, t: number) {
    const cx = this.w / 2, h = this.h, top = h * 0.74, half = unit * 19, wide = unit * 26;
    if (!pondLayer(c, 'dock', this.w, h)) {
    c.fillStyle = 'rgba(3,5,16,.4)'; c.beginPath(); c.ellipse(cx, top + unit * 3, half * 1.25, unit * 3, 0, 0, 7); c.fill();
    for (const s of [-1, 1]) { c.fillStyle = '#2c1d16'; c.fillRect(cx + s * half * 0.82 - unit * 0.9, top - unit * 1.5, unit * 1.8, unit * 9); }
    const wood = c.createLinearGradient(0, top, 0, h); wood.addColorStop(0, '#7a5638'); wood.addColorStop(1, '#3d2a1c');
    c.fillStyle = wood; c.beginPath(); c.moveTo(cx - half, top); c.lineTo(cx + half, top); c.lineTo(cx + wide, h + 2); c.lineTo(cx - wide, h + 2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,18,12,.55)'; c.lineWidth = 1.2; for (let i = 1; i < 6; i++) { const y = top + ((h - top) * i) / 6, k = (y - top) / (h - top), x = half + (wide - half) * k; c.beginPath(); c.moveTo(cx - x, y); c.lineTo(cx + x, y); c.stroke(); }
    }
    c.fillStyle = 'rgba(255,214,140,.12)'; c.beginPath(); c.ellipse(cx + unit * 1.5, top + unit * 3.4, unit * 11, unit * 3, 0, 0, 7); c.fill();
    const size = unit * 24, base = top + unit * 10, other = g.angler === 'dora' ? 'enzo' : 'dora', busy = g.state === 'hooked' || g.state === 'charging';
    const glow = c.createRadialGradient(cx + unit * 3, base - unit * 4, 1, cx + unit * 3, base - unit * 4, unit * 19); glow.addColorStop(0, `rgba(255, 191, 88, ${.25 + Math.sin(t * 7) * .015})`); glow.addColorStop(1, 'rgba(255, 183, 66, 0)'); c.fillStyle = glow; c.fillRect(cx - unit * 20, top - unit * 15, unit * 48, unit * 35);
    if (!pondHero(c, other, false, cx + unit * 12, base - this.hop(unit, false), size, t)) drawChinchilla(c, other, cx + unit * 12, base - this.hop(unit, false), { face: -1, h: size, time: t, blink: Math.sin(t * 0.7) > 0.985, air: this.hop(unit, false) > unit * 0.4 });
    // The rod, then the angler holding it.
    const { hand, tip, bend } = this.rod(g, unit);
    c.strokeStyle = '#2a1a10'; c.lineWidth = Math.max(2.4, unit * 0.62); c.lineCap = 'round'; c.beginPath(); c.moveTo(hand.x, hand.y + unit * 3.2); c.quadraticCurveTo(bend.x, bend.y, tip.x, tip.y); c.stroke();
    c.strokeStyle = '#c59a5a'; c.lineWidth = Math.max(1.2, unit * 0.3); c.stroke();
    if (!pondHero(c, g.angler, true, cx - unit * 12, base - this.hop(unit, true), size, t, busy)) drawChinchilla(c, g.angler, cx - unit * 12, base - this.hop(unit, true), { face: 1, h: size, time: t, moving: busy, run: busy ? t * 6 : 0, air: this.hop(unit, true) > unit * 0.4 });
    prop(c, 'lantern', cx + unit * 7, base - unit * 8.5, unit * 10, this.motion ? t : 0);
    // Moths keep the lantern company.
    if (this.motion) for (let i = 0; i < 3; i++) { const a = t * (1.7 + i * 0.5) + i * 2.1, mx = cx + unit * 0.6 + Math.cos(a) * unit * (3 + i), my = base - unit * 3.2 + Math.sin(a * 1.6) * unit * (1.6 + i * 0.5), flutter = 0.5 + 0.5 * Math.sin(t * 30 + i); c.fillStyle = `rgba(250,240,215,${0.35 + 0.35 * flutter})`; c.beginPath(); c.ellipse(mx, my, unit * 0.45, unit * 0.2 * (0.4 + flutter), a, 0, 7); c.fill(); }
  }
}

/** A journal thumbnail: the creature if it has been sketched, its outline if not. */
export function portrait(c: C, id: string, w: number, h: number, known: boolean, t = 0) {
  c.clearRect(0, 0, w, h);
  creature(c, id, w / 2, h / 2, Math.min(w, h) * 0.86, t, known ? {} : { silhouette: 'rgba(60,52,44,.38)' });
}

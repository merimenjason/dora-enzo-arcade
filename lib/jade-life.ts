// Jade Street: drawing the living city on top of lib/jade-scene.ts — traffic lights at the main crossings, street
// events (the magpie with a mango, the lost duckling and its mother, the broken-down van, the busker and their hat),
// the Lantern Festival dressing once the story is won (arches, giant lanterns, the stage, sky lanterns rising and
// fireworks), passing rain (streaks, ripples on the ground and wet reflections under the lamps) and umbrellas.
// Code draws only light, rain and ripples; every picture is a painted atlas frame.
import { T, ROADS } from './jade-city.js';
import { LIGHTS, lightOf } from './jade-traffic.js';
import type { World } from './jade-game.js';
import type { Ped } from './jade-folk.js';

type Spr = (x: CanvasRenderingContext2D, name: string, px: number, py: number, o?: { w?: number; h?: number; anchor?: 'bottom' | 'center'; rot?: number; flip?: boolean; alpha?: number; variant?: string }) => boolean;
type Glow = (x: CanvasRenderingContext2D, px: number, py: number, r: number, col: string) => void;
type Sorted = [number, () => void][];

const LIGHT_COL = { green: 'rgba(80,255,150,.5)', amber: 'rgba(255,190,60,.5)', red: 'rgba(255,60,60,.5)' };

export class Life {
  sky: { x: number; y: number; t: number; vx: number }[] = [];
  bursts: { x: number; y: number; t: number; s: string; k: number }[] = [];
  drops: { x: number; y: number; t: number }[] = [];
  fwT = 0;
  constructor(public spr: Spr, public glow: Glow) {}

  /** things that sort with the townsfolk by their feet */
  sorted(x: CanvasRenderingContext2D, w: World, list: Sorted, vis: (px: number, py: number, m?: number) => boolean, t: number) {
    const spr = this.spr;
    // traffic lights: a pole at each corner, two showing the horizontal road's light and two the avenue's
    for (const L of LIGHTS) {
      const x0 = ROADS[L.v].at * T, y0 = ROADS[L.h].at * T;
      if (!vis(x0 + 2 * T, y0 + 2 * T, 300)) continue;
      const li = LIGHTS.indexOf(L);
      const poles: [number, number, 'h' | 'v'][] = [[x0 - 8, y0 - 8, 'h'], [x0 + 4 * T + 8, y0 + 4 * T + 8, 'h'], [x0 + 4 * T + 8, y0 - 8, 'v'], [x0 - 8, y0 + 4 * T + 8, 'v']];
      for (const [px, py, ax] of poles) list.push([py, () => {
        const col = lightOf(w, li, ax);
        spr(x, 'light-' + col, px, py + 6, { h: 74 });
        this.glow(x, px, py - 50, 34, LIGHT_COL[col]);
      }]);
    }
    // the street event
    const e = w.street;
    if (e && e.phase !== 'gone') {
      if (e.kind === 'magpie' && e.b && e.phase === 'on') list.push([e.b.y, () => spr(x, `mag-mango-${Math.floor(t * 6) % 2}`, e.b!.x, e.b!.y + 6, { h: 56, flip: Math.cos(e.b!.h) < 0 })]);
      if (e.kind === 'duckling' && e.b) {
        const b = e.b, moving = b.speed > 5;
        list.push([b.y, () => spr(x, e.phase === 'on' ? 'duck-lost' : moving ? (Math.abs(Math.cos(b.h)) > 0.7 ? 'duck-side' : `duck-down-${Math.floor(t * 6) % 2}`) : 'duck-down-0', b.x, b.y + 4, { h: 24, flip: Math.cos(b.h) < 0 })]);
        if (e.home && vis(e.home[0], e.home[1])) list.push([e.home[1], () => { this.glow(x, e.home![0], e.home![1] - 10, 50, 'rgba(255,230,140,.3)'); spr(x, 'folk-duck-down', e.home![0], e.home![1] + 4, {}); }]);
      }
      if (e.kind === 'busker') list.push([e.y, () => {
        spr(x, `busker-${Math.floor(t * 3) % 2}`, e.x, e.y + 4, { h: 64 });
        spr(x, 'busk-hat', e.x, e.y + 36, { h: 28 * 0.6 });
        this.glow(x, e.x, e.y - 20, 80, 'rgba(255,200,120,.22)');
      }]);
      if (e.kind === 'van' && e.ride && e.phase === 'on') list.push([e.ride.b.y + 1, () => {
        const b = e.ride!.b, a = Math.floor(t * 2) % 2;
        spr(x, 'smoke', b.x + Math.cos(b.h) * 40, b.y + Math.sin(b.h) * 40 - 30 - a * 6, { h: 50, alpha: 0.8 });
        const pct = Math.min(1, e.push ?? 0);
        if (pct > 0) { x.fillStyle = 'rgba(10,6,30,.7)'; x.fillRect(b.x - 30, b.y - 64, 60, 8); x.fillStyle = '#7dffb0'; x.fillRect(b.x - 29, b.y - 63, 58 * pct, 6); }
      }]);
    }
    // the festival, once the story is won
    if (w.festival) for (const f of w.c.festival) if (f.kind !== 'arch' && vis(f.x, f.y, 200)) list.push([f.y, () => {
      if (f.kind === 'lantern') { spr(x, f.sprite, f.x, f.y + 8, { h: 120 }); this.glow(x, f.x, f.y - 80, 70, 'rgba(255,200,90,.3)'); }
      else if (f.kind === 'stage') spr(x, f.sprite, f.x, f.y + 40, { w: f.w });
      else { spr(x, f.sprite, f.x, f.y + 20, {}); this.glow(x, f.x, f.y - 40, 110, 'rgba(255,140,80,.25)'); }
    }]);
  }

  /** the overhead layer: festival arches, sky lanterns and fireworks */
  over(x: CanvasRenderingContext2D, w: World, vis: (px: number, py: number, m?: number) => boolean, dt: number, cam: { x: number; y: number; w: number; h: number }) {
    if (w.festival) {
      for (const f of w.c.festival) if (f.kind === 'arch' && vis(f.x, f.y, 300)) { this.spr(x, f.sprite, f.x, f.y, { w: f.w, anchor: 'center', alpha: 0.96 }); this.glow(x, f.x, f.y, 140, 'rgba(255,90,60,.18)'); }
      // a sky lantern drifts up now and then, and fireworks burst over the harbour side of the screen
      if (Math.random() < dt * 0.6 && this.sky.length < 30) this.sky.push({ x: cam.x + (Math.random() - 0.5) * cam.w, y: cam.y + cam.h * 0.6, t: 0, vx: (Math.random() - 0.5) * 10 });
      this.fwT -= dt;
      if (this.fwT <= 0) { this.fwT = 1.4 + Math.random() * 2.4; this.firework(cam.x + (Math.random() - 0.5) * cam.w * 0.8, cam.y - cam.h * (0.1 + Math.random() * 0.3)); }
    }
    for (const s of this.sky) { s.t += dt; s.y -= 34 * dt; s.x += s.vx * dt; }
    this.sky = this.sky.filter(s => s.t < 14);
    for (const s of this.sky) { const a = Math.min(1, s.t, (14 - s.t) / 3); this.glow(x, s.x, s.y, 40, `rgba(255,190,90,${0.35 * a})`); this.spr(x, 'sky-lantern', s.x, s.y, { h: 30, anchor: 'center', alpha: a }); }
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter(b => b.t < 1.6);
    for (const b of this.bursts) {
      const a = b.t < 0.2 ? b.t / 0.2 : Math.max(0, 1 - (b.t - 0.2) / 1.4), s = 0.4 + Math.min(1, b.t * 2.2) * 0.7;
      this.glow(x, b.x, b.y, 200 * s * b.k, `rgba(255,220,160,${0.3 * a})`);
      this.spr(x, b.s, b.x, b.y + b.t * 20, { w: 220 * s * b.k, anchor: 'center', alpha: a });
    }
  }
  firework(px: number, py: number) { const s = ['fw-gold', 'fw-red', 'fw-violet', 'fw-blue', 'fw-orange', 'fw-star'][Math.floor(Math.random() * 6)]; this.bursts.push({ x: px, y: py, t: 0, s, k: 0.8 + Math.random() * 0.6 }); }
  lantern(px: number, py: number) { this.sky.push({ x: px, y: py - 30, t: 0, vx: (Math.random() - 0.5) * 8 }); }

  /** rain: ripples on the ground (world space) under the lights, then streaks over the screen */
  rainWorld(x: CanvasRenderingContext2D, w: World, dt: number, cam: { x: number; y: number; w: number; h: number }) {
    const r = w.rain; if (r < 0.02) { this.drops.length = 0; return; }
    const n = Math.floor(r * 90 * dt * 10);
    for (let i = 0; i < n && this.drops.length < 260; i++) this.drops.push({ x: cam.x + (Math.random() - 0.5) * cam.w, y: cam.y + (Math.random() - 0.5) * cam.h, t: 0 });
    for (const d of this.drops) d.t += dt;
    this.drops = this.drops.filter(d => d.t < 0.6);
    x.save(); x.lineWidth = 1.5;
    for (const d of this.drops) { const a = (1 - d.t / 0.6) * 0.5 * r; x.strokeStyle = `rgba(200,220,255,${a})`; x.beginPath(); x.ellipse(d.x, d.y, 3 + d.t * 22, 1.5 + d.t * 9, 0, 0, Math.PI * 2); x.stroke(); }
    // a wet sheen: the ground goes darker and bluer
    x.fillStyle = `rgba(30,50,110,${0.14 * r})`; x.fillRect(cam.x - cam.w / 2, cam.y - cam.h / 2, cam.w, cam.h);
    x.restore();
  }
  /** wet reflections: each lamp and stall glow smears down the street */
  reflect(x: CanvasRenderingContext2D, w: World, px: number, py: number, col: string) {
    if (w.rain < 0.1) return;
    const g = x.createLinearGradient(px, py, px, py + 120); g.addColorStop(0, col.replace(/[\d.]+\)$/, `${0.3 * w.rain})`)); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - 14, py, 28, 120);
  }
  rainScreen(x: CanvasRenderingContext2D, w: World, sw: number, sh: number, t: number) {
    const r = w.rain; if (r < 0.02) return;
    x.save(); x.strokeStyle = `rgba(200,215,255,${0.35 * r})`; x.lineWidth = 1.2; x.beginPath();
    const n = Math.floor(160 * r);
    for (let i = 0; i < n; i++) {
      const sx = ((i * 137.5 + t * 90) % (sw + 80)) - 40, sy = ((i * 89.3 + t * (700 + (i % 5) * 60)) % (sh + 60)) - 30;
      x.moveTo(sx, sy); x.lineTo(sx - 6, sy + 22);
    }
    x.stroke(); x.fillStyle = `rgba(20,30,70,${0.12 * r})`; x.fillRect(0, 0, sw, sh); x.restore();
  }
  /** a townsperson's frame, sitting and with an umbrella in the rain */
  pedOver(x: CanvasRenderingContext2D, w: World, pd: Ped, t: number): string | null {
    if (pd.sit > 0) return `folk-${pd.sp}-sit-${Math.floor(t * 1.5 + pd.id) % 2}`;
    void x; void w; return null;
  }
  umbrella(x: CanvasRenderingContext2D, w: World, pd: Ped, hop: number) {
    if (w.rain < 0.3 || pd.sit > 0) return;
    this.spr(x, pd.id % 2 ? 'umb-red' : 'umb-jade', pd.x, pd.y - 34 - hop, { w: 40, anchor: 'center', alpha: 0.95 });
  }
}

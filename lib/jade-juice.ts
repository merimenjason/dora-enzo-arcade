// Jade Street: game feel. Hit-stop and camera shake scaled to how hard something hit; painted debris (fruit, crates,
// feathers, sparks, paper, coins) that flies, tumbles and settles with a shadow; slow motion with a zoom punch when
// loot is knocked loose and when an heirloom is won; speed lines and a boost trail on fast rides; squash and stretch
// on hops and landings; dust on skids and sharp turns; pickup pops and coin tallies; a red flash and vignette when the
// heat rises. Every number is in JUICE so it can be tuned in one place. The page passes the player's settings: Screen
// shake off removes the shake, Reduce shake (and the system's prefers-reduced-motion) keeps a gentle shake, drops the
// flashes and shortens slow motion. Hit-stop and slow motion work by scaling the time the page feeds the fixed-step
// world, so the engine itself stays deterministic. Drawing only; no game rules here.
import type { Fx } from './jade-game.js';

export const JUICE = {
  hitstop: { per: 0.07, max: 0.11 },
  shake: { per: 0.55, max: 1, decay: 2.4, px: 9, calm: 0.3 },
  slow: { scale: 0.3, loot: 0.55, heirloom: 0.95, calm: 0.35 },
  punch: { loot: 0.1, heirloom: 0.16, back: 3.2 },
  debris: { max: 150, life: 1.25, gravity: 900, spin: 9 },
  speed: { from: 250, lines: 22 },
  trail: { every: 0.03, life: 0.3 },
  flash: { heat: 0.5, hit: 0.18, decay: 2.2 },
  squash: { take: 0.14, land: 0.22, landT: 0.18 },
  pop: { life: 1.1, rise: 46 },
};
export type JuiceOpts = { shake: boolean; calm: boolean; reduced: boolean };
type Deb = { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; vr: number; t: number; life: number; s: string; w: number };
type Pop = { x: number; y: number; t: number; text: string; col: string; big: boolean };
export type Spr = (x: CanvasRenderingContext2D, name: string, px: number, py: number, o?: { w?: number; h?: number; anchor?: 'bottom' | 'center'; rot?: number; flip?: boolean; alpha?: number; variant?: string }) => unknown;
type Ghost = { x: number; y: number; h: number; t: number; s: string };

const KIND_SPRITES: Record<string, string[]> = {
  fruit: ['db-orange', 'db-mango', 'db-melon', 'db-leaf', 'db-plank'],
  crate: ['db-plank', 'db-straw', 'db-plank'],
  feather: ['db-feather-b', 'db-feather-w', 'db-feather-b', 'db-paper'],
  spark: ['db-spark', 'db-spark-b', 'db-shard'],
  neon: ['db-shard', 'db-spark-b', 'db-spark', 'db-shard'],
  drum: ['db-plank', 'db-paper', 'db-straw'],
  paper: ['db-paper', 'db-lantern', 'db-paper'],
  coins: ['db-coin', 'db-gold', 'db-coin'],
  dust: ['db-dust'],
  heirloom: ['db-gold', 'db-spark', 'db-coin', 'db-gold'],
};
// a cheap seeded wobble so the effects never touch Math.random's state the engine might share in tests
let seed = 1234567;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

export class Juice {
  /** the heat's red vignette, painted once per screen size */
  heatVig: HTMLCanvasElement | null = null;
  opt: JuiceOpts = { shake: true, calm: false, reduced: false };
  trauma = 0; stop = 0; slow = 0; punch = 0; flash = 0; flashCol = '255,60,60'; landT = 0; heatPulse = 0;
  debris: Deb[] = []; pops: Pop[] = []; ghosts: Ghost[] = []; ghostT = 0; t = 0;
  /** coins shown in the tally, counting up towards the real total */
  shownCash = -1;
  get gentle() { return this.opt.calm || this.opt.reduced; }
  /** how much world time passes for `dt` of real time (0 during hit-stop, slower in slow motion) */
  rate() { return this.stop > 0 ? 0 : this.slow > 0 ? JUICE.slow.scale : 1; }
  /** a hit: freeze for a moment and shake, both scaled by k (0..1) */
  impact(k: number) {
    this.stop = Math.min(JUICE.hitstop.max, Math.max(this.stop, JUICE.hitstop.per * k * (this.gentle ? 0.6 : 1)));
    this.trauma = Math.min(JUICE.shake.max, this.trauma + JUICE.shake.per * k);
  }
  slowmo(big: boolean) {
    const len = big ? JUICE.slow.heirloom : JUICE.slow.loot;
    this.slow = Math.max(this.slow, this.gentle ? len * JUICE.slow.calm : len);
    if (!this.opt.reduced) this.punch = Math.max(this.punch, big ? JUICE.punch.heirloom : JUICE.punch.loot);
  }
  flashOf(a: number, col = '255,60,60') { if (this.gentle) return; this.flash = Math.max(this.flash, a); this.flashCol = col; }
  /** the camera offset this frame */
  shakeXY(): [number, number] {
    if (!this.opt.shake || this.trauma <= 0) return [0, 0];
    const a = this.trauma * this.trauma * JUICE.shake.px * (this.gentle ? JUICE.shake.calm : 1);
    return [Math.sin(this.t * 71) * a, Math.cos(this.t * 59 + 1) * a * 0.8];
  }
  /** the extra zoom of a slow-motion punch (1 = none) */
  zoom() { return 1 + this.punch; }
  tick(dt: number) {
    this.t += dt;
    this.stop = Math.max(0, this.stop - dt); this.slow = Math.max(0, this.slow - dt);
    this.trauma = Math.max(0, this.trauma - dt * JUICE.shake.decay);
    this.punch = this.slow > 0 ? this.punch : Math.max(0, this.punch - dt * this.punch * JUICE.punch.back - dt * 0.02);
    this.flash = Math.max(0, this.flash - dt * JUICE.flash.decay); this.landT = Math.max(0, this.landT - dt);
    this.heatPulse = Math.max(0, this.heatPulse - dt);
    const g = JUICE.debris.gravity;
    for (const d of this.debris) {
      d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= g * dt; d.r += d.vr * dt;
      if (d.z <= 0) { d.z = 0; d.vz = Math.abs(d.vz) > 120 ? -d.vz * 0.35 : 0; d.vx *= 0.6; d.vy *= 0.6; d.vr *= 0.5; }
    }
    this.debris = this.debris.filter(d => d.t < d.life);
    for (const p of this.pops) p.t += dt; this.pops = this.pops.filter(p => p.t < JUICE.pop.life);
    for (const q of this.ghosts) q.t += dt; this.ghosts = this.ghosts.filter(q => q.t < JUICE.trail.life);
  }
  /** throw painted debris of a kind from a point; `up` is how hard it flies */
  spray(kind: string, x: number, y: number, n: number, up = 1) {
    const list = KIND_SPRITES[kind] ?? KIND_SPRITES.dust;
    if (this.opt.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n && this.debris.length < JUICE.debris.max; i++) {
      const a = rnd() * Math.PI * 2, v = (70 + rnd() * 170) * up;
      const dust = kind === 'dust';
      this.debris.push({ x, y, z: dust ? 2 : 8 + rnd() * 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: dust ? 40 + rnd() * 30 : (180 + rnd() * 240) * up, r: rnd() * 6, vr: (rnd() - 0.5) * JUICE.debris.spin * 2, t: 0, life: dust ? 0.55 : JUICE.debris.life * (0.7 + rnd() * 0.5), s: list[i % list.length], w: dust ? 26 + rnd() * 14 : 16 + rnd() * 10 });
    }
  }
  pop(x: number, y: number, text: string, col = '#ffe68a', big = false) { this.pops.push({ x, y, t: 0, text, col, big }); if (this.pops.length > 12) this.pops.shift(); }
  /** a ghost of the ride behind it while boosting */
  trail(dt: number, on: boolean, x: number, y: number, h: number, s: string) {
    if (!on || this.opt.reduced) return; this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = JUICE.trail.every; this.ghosts.push({ x, y, h, t: 0, s }); }
  }
  /** squash and stretch for the hero on foot: [sx, sy] about the feet */
  squash(anim: string, hopK: number): [number, number] {
    if (this.opt.reduced) return [1, 1];
    const q = JUICE.squash;
    if (this.landT > 0) { const k = this.landT / q.landT; return [1 + q.land * k, 1 - q.land * 0.8 * k]; }
    if (anim === 'hop' || anim === 'leap') { const k = hopK < 0.25 ? 1 - hopK / 0.25 : 0; return [1 - q.take * 0.7 * k, 1 + q.take * k]; }
    return [1, 1];
  }
  /** debris, ride ghosts and pops, in world space (the caller has set the camera transform) */
  drawWorld(x: CanvasRenderingContext2D, spr: Spr) {
    for (const q of this.ghosts) spr(x, q.s, q.x, q.y, { anchor: 'center', rot: q.h + Math.PI / 2, alpha: 0.35 * (1 - q.t / JUICE.trail.life) });
    for (const d of this.debris) {
      const fade = Math.min(1, (d.life - d.t) * 4);
      if (d.z > 1 && d.s !== 'db-dust') { x.fillStyle = `rgba(0,0,0,${0.25 * fade})`; x.beginPath(); x.ellipse(d.x, d.y + 4, d.w * 0.35, d.w * 0.15, 0, 0, Math.PI * 2); x.fill(); }
      spr(x, d.s, d.x, d.y - d.z, { w: d.s === 'db-dust' ? d.w * (1 + d.t * 1.5) : d.w, anchor: 'center', rot: d.r, alpha: d.s === 'db-dust' ? 0.7 * fade * (1 - d.t / d.life) : fade });
    }
    x.textAlign = 'center'; x.lineJoin = 'round';
    for (const p of this.pops) {
      const k = p.t / JUICE.pop.life, sc = p.t < 0.12 ? 0.6 + p.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (p.t - 0.12) * 0.6);
      x.globalAlpha = Math.min(1, (1 - k) * 2.5);
      x.font = `800 ${Math.round((p.big ? 30 : 22) * sc)}px system-ui, sans-serif`;
      const py = p.y - k * JUICE.pop.rise;
      x.strokeStyle = 'rgba(20,10,30,.9)'; x.lineWidth = 6; x.strokeText(p.text, p.x, py); x.fillStyle = p.col; x.fillText(p.text, p.x, py);
    }
    x.globalAlpha = 1;
  }
  /** speed lines, the boost streaks, the flash and the heat vignette, in screen space */
  drawScreen(x: CanvasRenderingContext2D, W: number, H: number, speed: number, heading: number, boost: boolean, heat: number) {
    const sp = JUICE.speed;
    if (!this.opt.reduced && (speed > sp.from || boost)) {
      const k = Math.min(1, (speed - sp.from) / 200 + (boost ? 0.6 : 0));
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
      x.save(); x.lineCap = 'round';
      for (let i = 0; i < sp.lines; i++) {
        const a = heading + Math.PI + (((i * 7919) % 100) / 100 - 0.5) * 2.6, ph = (this.t * (2.2 + (i % 5) * 0.4) + i * 0.37) % 1;
        const r0 = R * (0.55 + ph * 0.5), r1 = r0 + R * (0.1 + 0.15 * k);
        x.strokeStyle = boost ? `rgba(255,${200 - (i % 3) * 40},120,${0.32 * k * (1 - ph)})` : `rgba(235,235,255,${0.22 * k * (1 - ph)})`;
        x.lineWidth = boost ? 3 : 2;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke();
      }
      x.restore();
    }
    if (this.flash > 0) { x.fillStyle = `rgba(${this.flashCol},${Math.min(0.6, this.flash)})`; x.fillRect(0, 0, W, H); }
    // heat: a red vignette that pulses when it rises and stays faintly while you're wanted
    const hv = Math.min(1, heat / 5) * 0.35 + this.heatPulse * (this.gentle ? 0.1 : 0.3);
    if (hv > 0.02) {
      // painted once per screen size at full strength and stamped at the heat's alpha (a full-screen gradient a frame)
      const vw = Math.max(1, Math.round(W / 2)), vh = Math.max(1, Math.round(H / 2));
      if (!this.heatVig || this.heatVig.width !== vw || this.heatVig.height !== vh) {
        const c = document.createElement('canvas'); c.width = vw; c.height = vh; const g = c.getContext('2d'); // (null past WebKit's canvas cap: no vignette)
        if (g) { const gr = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
          gr.addColorStop(0, 'rgba(255,20,40,0)'); gr.addColorStop(1, 'rgba(255,20,40,1)'); g.fillStyle = gr; g.fillRect(0, 0, vw, vh); }
        this.heatVig = c;
      }
      const a0 = x.globalAlpha; x.globalAlpha = a0 * Math.min(1, hv); x.drawImage(this.heatVig, 0, 0, W, H); x.globalAlpha = a0;
    }
  }
  /** turn the world's events into feel */
  consume(fx: Fx[], heroX: number, heroY: number) {
    for (const f of fx) {
      const x = f.x ?? heroX, y = f.y ?? heroY;
      switch (f.t) {
        case 'impact': this.impact(f.k ?? 0.6); this.spray(f.kind ?? 'spark', x, y, Math.round(6 + (f.k ?? 0.6) * 8)); this.flashOf(JUICE.flash.hit, '255,240,220'); break;
        case 'smash': this.impact((f.k ?? 1) * 0.7); this.spray(f.kind ?? 'crate', x, y, 16, 1.2); break;
        case 'bump': this.impact(Math.min(1, (f.k ?? 0.4) * 0.8)); this.spray('dust', x, y, 3); break;
        case 'hit': this.impact(0.75); this.spray(f.kind ?? 'feather', x, y, 9); this.pop(x, y - 40, 'Bump!', '#ffd060'); break;
        case 'loot': this.slowmo(f.kind === 'heirloom'); this.spray(f.kind === 'heirloom' ? 'heirloom' : 'coins', x, y, 12, 1.1); break;
        case 'pickup': if (f.kind === 'heirloom') { this.slowmo(true); this.spray('heirloom', x, y, 16, 1.3); this.flashOf(0.35, '255,230,140'); this.pop(x, y - 60, 'Heirloom!', '#ffe68a', true); } else { this.spray('coins', x, y, 5, 0.7); this.pop(x, y - 40, 'Got it!', '#bff5ff'); } break;
        case 'cat': case 'mural': case 'gate': this.spray('heirloom', x, y, 6, 0.7); break;
        case 'land': this.landT = JUICE.squash.landT * Math.min(1, (f.k ?? 0.5) + 0.4); if ((f.k ?? 0) >= 0.5) { this.impact(f.k! * 0.5); this.spray('dust', x, y, 5); } else this.spray('dust', x, y, 2); break;
        case 'skid': this.spray('dust', x, y, Math.round(2 + (f.k ?? 0.5) * 3)); break;
        case 'boost': this.spray('spark', x, y, 4, 0.6); break;
        case 'shoo': this.pop(x, y - 40, 'Shoo!', '#ffd060'); break;
        // the job steps: the camera flash, the safe swinging open, nets, the crowd's double take, a found clue
        // the sixteenth pass: a parcel lands with a family at a toss mark; a guard takes an ice cream from the motorbike
        case 'toss': this.spray('paper', x, y - 20, 8, 0.8); this.pop(x, y - 60, 'Caught it!', '#fff2b0'); break;
        case 'treat': this.pop(x, y - 80, 'Ice cream!', '#ffd6f0'); break;
        case 'job-photo': this.flashOf(0.28, '255,255,240'); this.spray('spark', x, y - 30, 4, 0.5); this.pop(x, y - 64, 'Snap!', '#e8fbff'); break;
        case 'job-safe': this.slowmo(false); this.spray('coins', x, y, 12, 1.1); this.pop(x, y - 60, 'Cracked it!', '#ffe68a', true); break;
        case 'job-diversion': this.impact(0.5); this.spray('paper', x, y, 16, 1.4); this.pop(x, y - 70, 'Confetti!', '#ffb0e0', true); break;
        case 'job-alarm': this.flashOf(0.3); this.impact(0.3); this.pop(x, y - 60, 'Alarm!', '#ff8a7a', true); break;
        case 'job-spring': this.spray('dust', x, y, 6, 0.9); break;
        case 'job-caught': this.impact(0.5); this.spray('feather', x, y, 6, 0.8); this.pop(x, y - 50, 'Netted!', '#bff5c0'); break;
        case 'job-escape': this.spray('dust', x, y, 4, 0.6); this.pop(x, y - 50, 'Got away!', '#ffb08a'); break;
        case 'job-swap': this.spray('spark', x, y, 3, 0.4); this.pop(x, y - 50, 'Swapped', '#e8fbff'); break;
        case 'job-grab': this.spray('paper', x, y, 5, 0.8); this.pop(x, y - 50, 'Grabbed!', '#ff9a7a'); break;
        case 'job-found': this.slowmo(false); this.spray('heirloom', x, y, 12, 1.1); this.pop(x, y - 60, 'Found it!', '#ffe68a', true); break;
        case 'job-nothing': this.spray('paper', x, y, 4, 0.6); break;
        case 'job-trap-set': this.spray('dust', x, y, 3, 0.5); break;
        case 'job-disguise': if (f.kind === 'on') { this.spray('spark', x, y - 20, 6, 0.7); this.pop(x, y - 64, 'Incognito', '#e8d8ff'); } break;
        case 'job-mend': this.spray('spark', x, y, 4, 0.5); break;
        case 'poof': this.spray(f.kind ?? 'feather', x, y, 10, 0.9); this.spray('paper', x, y, 3, 0.7); break;
        case 'snatch': this.spray('coins', x, y, 5, 0.8); break;
        case 'boss-down': this.impact(1); this.slowmo(true); this.spray('paper', x, y, 14, 1.4); this.spray('feather', x, y, 10, 1.2); break;
        case 'heat-up': this.flashOf(JUICE.flash.heat); this.heatPulse = 1.2; this.impact(0.25); break;
        case 'caught': this.impact(0.9); this.flashOf(0.4); break;
        case 'coins': this.spray('coins', x, y, 12, 1.1); this.pop(x, y - 50, `+${f.k ?? 0}`, '#ffd25a', true); break;
        case 'mission-done': if (f.k) this.pop(heroX, heroY - 70, `+${f.k}`, '#ffd25a', true); break;
        case 'biz-buy': case 'biz-up': this.spray('paper', heroX, heroY - 20, 8, 1); this.spray('coins', heroX, heroY - 20, 6, 0.9); break;
      }
    }
  }
}

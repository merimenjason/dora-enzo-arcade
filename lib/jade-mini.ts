// Jade Street: the touch mini-games, as pure state machines the page draws and feeds (mouse, touch and keys all map
// to the same few actions). Lock picking (raise each pin and let go while it glows), jump-starting (match the wire
// colours, then turn the key), the wok (slide to catch what the order needs, toss before it scorches) and dumpling
// folding (drop the filling in the middle, then pinch three pleats on the beat). Seeded, deterministic, tested.
import { rng } from './jade-rng.js';
import { needle } from './jade-trade.js';

export type MiniEv = { t: string; i?: number };
export type MiniOpts = { level: number; assist: boolean; seed: number };

// ── lock picking
export class LockGame {
  pins: { h: number; set: boolean; lo: number; hi: number }[] = []; sel = 0; holding = false; time: number; ev: MiniEv[] = []; done = false; failed = false; wiggle = 0;
  constructor(public o: MiniOpts) {
    const R = rng(o.seed); const n = o.level > 1 ? 4 : 3; const w = o.assist ? 0.24 : 0.16;
    for (let i = 0; i < n; i++) { const c = 0.45 + R() * 0.35; this.pins.push({ h: 0, set: false, lo: c - w / 2, hi: c + w / 2 }); }
    this.time = (o.assist ? 75 : 50) + (n - 3) * 10;
  }
  get rate() { return this.o.assist ? 0.5 : 0.62; }
  glowing(i = this.sel) { const p = this.pins[i]; return !p.set && p.h >= p.lo && p.h <= p.hi; }
  select(i: number) { if (this.done || this.holding) return; this.sel = Math.max(0, Math.min(this.pins.length - 1, i)); this.ev.push({ t: 'tick' }); }
  move(d: number) { this.select(this.sel + d); }
  hold(on: boolean) {
    if (this.done) return;
    const p = this.pins[this.sel];
    if (on) { if (!p.set) { this.holding = true; } return; }
    if (!this.holding) return;
    this.holding = false;
    if (p.h >= p.lo && p.h <= p.hi) { p.set = true; p.h = (p.lo + p.hi) / 2; this.ev.push({ t: 'set', i: this.sel }); const nx = this.pins.findIndex(q => !q.set); if (nx < 0) { this.done = true; this.ev.push({ t: 'open' }); } else this.sel = nx; }
    else { this.ev.push({ t: 'drop', i: this.sel }); }
  }
  step(dt: number) {
    if (this.done || this.failed) return;
    this.time -= dt; if (this.time <= 0) { this.failed = true; this.ev.push({ t: 'fail' }); return; }
    this.wiggle += dt;
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i]; if (p.set) continue;
      if (i === this.sel && this.holding) {
        p.h += this.rate * dt;
        if (p.h > 1) { p.h = 0; this.holding = false; this.ev.push({ t: 'spring', i }); if (this.o.level > 1 && !this.o.assist) { const k = this.pins.findIndex(q => q.set); if (k >= 0) { this.pins[k].set = false; this.pins[k].h = 0; this.ev.push({ t: 'drop', i: k }); } } }
      } else p.h = Math.max(0, p.h - dt * 1.6);
    }
  }
}

// ── wires
export const WIRE_COLS = ['red', 'blue', 'yellow', 'green'] as const;
export class WireGame {
  right: number[]; links: (number | null)[] = [null, null, null, null]; picked: number | null = null; started = false; time: number; ev: MiniEv[] = []; done = false; failed = false; buzz = 0;
  constructor(public o: MiniOpts) {
    const R = rng(o.seed); const a = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
    this.right = a; this.time = o.assist ? 60 : 40;
  }
  get wired() { return this.links.every(l => l !== null); }
  pick(left: number) { if (this.done || this.links[left] !== null) return; this.picked = left; this.ev.push({ t: 'tick' }); }
  connect(rightSlot: number) {
    if (this.done || this.picked === null) return;
    const l = this.picked;
    if (this.links.includes(rightSlot)) return;
    if (this.right[rightSlot] === l) { this.links[l] = rightSlot; this.picked = null; this.ev.push({ t: 'spark', i: l }); if (this.wired) this.ev.push({ t: 'ready' }); }
    else { this.picked = null; this.buzz = 0.5; this.time = Math.max(1, this.time - 3); this.ev.push({ t: 'buzz' }); }
  }
  turnKey() { if (!this.wired || this.done) { if (!this.wired) this.ev.push({ t: 'buzz' }); return; } this.started = true; this.done = true; this.ev.push({ t: 'vroom' }); }
  step(dt: number) { if (this.done || this.failed) return; this.buzz = Math.max(0, this.buzz - dt); this.time -= dt; if (this.time <= 0) { this.failed = true; this.ev.push({ t: 'fail' }); } }
}

// ── the wok
export const FOODS = ['noodles', 'prawn', 'bokchoy', 'egg', 'chilli'] as const;
export type Food = typeof FOODS[number];
export class WokGame {
  x = 0.5; items: { id: number; f: Food; x: number; y: number; vy: number; vx: number }[] = []; need: Partial<Record<Food, number>> = {}; got: Partial<Record<Food, number>> = {};
  burn = 0; strikes = 0; tossT = 0; spawnT = 0.6; ev: MiniEv[] = []; done = false; failed = false; inWok = 0; nid = 1; R: () => number; time = 0;
  constructor(public o: MiniOpts) {
    this.R = rng(o.seed);
    const n = o.level > 1 ? 7 : 5;
    const pool: Food[] = ['noodles', 'prawn', 'bokchoy', 'egg'];
    for (let i = 0; i < n; i++) { const f = pool[Math.floor(this.R() * pool.length)]; this.need[f] = (this.need[f] ?? 0) + 1; }
  }
  get left() { let k = 0; for (const f of FOODS) k += Math.max(0, (this.need[f] ?? 0) - (this.got[f] ?? 0)); return k; }
  moveTo(x: number) { this.x = Math.max(0.08, Math.min(0.92, x)); }
  nudge(d: number, dt: number) { this.moveTo(this.x + d * dt * 1.1); }
  toss() { if (this.tossT > 0 || this.done) return; this.tossT = 0.45; this.burn = Math.max(0, this.burn - 0.6); this.ev.push({ t: 'toss' }); }
  step(dt: number) {
    if (this.done || this.failed) return;
    this.time += dt; this.tossT = Math.max(0, this.tossT - dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = (this.o.assist ? 1.15 : 0.9) - Math.min(0.3, this.time * 0.004);
      // mostly what the order needs, sometimes a chilli or an extra
      const needed = FOODS.filter(f => (this.need[f] ?? 0) > (this.got[f] ?? 0));
      const f: Food = this.R() < 0.68 && needed.length ? needed[Math.floor(this.R() * needed.length)] : this.R() < 0.6 ? 'chilli' : FOODS[Math.floor(this.R() * 4)];
      const side = this.R() < 0.5;
      this.items.push({ id: this.nid++, f, x: side ? 0.05 : 0.95, y: 0.15, vx: (side ? 1 : -1) * (0.12 + this.R() * 0.3), vy: -0.35 - this.R() * 0.2 });
    }
    const g = this.o.assist ? 0.62 : 0.8;
    for (const it of this.items) {
      it.vy += g * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.x < 0.03 || it.x > 0.97) it.vx *= -1;
      if (it.y >= 0.78 && it.y < 0.86 && it.vy > 0 && Math.abs(it.x - this.x) < (this.o.assist ? 0.13 : 0.1)) {
        it.y = 2;
        const want = (this.need[it.f] ?? 0) > (this.got[it.f] ?? 0);
        if (want) { this.got[it.f] = (this.got[it.f] ?? 0) + 1; this.inWok++; this.ev.push({ t: 'catch' }); if (this.left === 0) { this.done = true; this.ev.push({ t: 'served' }); } }
        else { this.strikes++; this.ev.push({ t: 'oops' }); if (this.strikes >= 3) { this.failed = true; this.ev.push({ t: 'fail' }); } }
      }
    }
    this.items = this.items.filter(i => i.y < 1.1);
    if (this.inWok > 0) {
      this.burn += dt * (this.o.assist ? 0.11 : 0.16);
      if (this.burn >= 1) { this.burn = 0; this.strikes++; this.ev.push({ t: 'scorch' }); if (this.strikes >= 3) { this.failed = true; this.ev.push({ t: 'fail' }); } }
    }
  }
}

// ── dumplings
export class DumplingGame {
  n: number; i = 0; phase: 'fill' | 'pleat' | 'next' = 'fill'; t = 0; pleats = 0; bad = 0; results: ('perfect' | 'good' | 'messy')[] = []; ev: MiniEv[] = []; done = false; failed = false; ring = 0; target = 0; wait = 0;
  constructor(public o: MiniOpts) { this.n = o.level > 1 ? 4 : 3; this.target = rng(o.seed)() * Math.PI * 2; }
  get zone() { return this.o.assist ? 0.14 : 0.09; }
  get arc() { return this.o.assist ? 0.75 : 0.5; }
  spoon() { return needle(this.t, this.o.assist ? 0.65 : 0.85); }
  press() {
    if (this.done || this.failed) return;
    if (this.phase === 'fill') {
      const good = Math.abs(this.spoon() - 0.5) <= this.zone; if (!good) this.bad++;
      this.ev.push({ t: good ? 'plop' : 'splat' }); this.phase = 'pleat'; this.t = 0; this.pleats = 0; this.ring = 0; this.target = (this.target + 2.1) % (Math.PI * 2);
    } else if (this.phase === 'pleat') {
      let d = Math.abs(((this.ring - this.target) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const good = d <= this.arc / 2; if (!good) this.bad++;
      this.pleats++; this.ev.push({ t: good ? 'pinch' : 'squish' }); this.target = (this.target + 2.3) % (Math.PI * 2);
      void d;
      if (this.pleats >= 3) {
        const r = this.bad === 0 ? 'perfect' : this.bad <= 1 ? 'good' : 'messy';
        this.results.push(r); this.ev.push({ t: r }); this.bad = 0; this.i++; this.phase = 'next'; this.wait = 0.7;
      }
    }
  }
  step(dt: number) {
    if (this.done || this.failed) return;
    this.t += dt; this.ring = (this.ring + dt * (this.o.assist ? 2.6 : 3.4)) % (Math.PI * 2);
    if (this.phase === 'next') { this.wait -= dt; if (this.wait <= 0) {
      if (this.i >= this.n) {
        const messy = this.results.filter(r => r === 'messy').length;
        if (messy <= (this.o.assist ? this.n - 1 : 1)) { this.done = true; this.ev.push({ t: 'steamed' }); } else { this.failed = true; this.ev.push({ t: 'fail' }); }
      } else { this.phase = 'fill'; this.t = 0; }
    } }
  }
}
export type AnyMini = LockGame | WireGame | WokGame | DumplingGame;
export function makeMini(kind: string, o: MiniOpts): AnyMini {
  if (kind === 'lock') return new LockGame(o);
  if (kind === 'wires') return new WireGame(o);
  if (kind === 'wok') return new WokGame(o);
  return new DumplingGame(o);
}

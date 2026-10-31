// Powder Paws: the rules. A skier carves down Whiskerpeak on a fixed 60 Hz step. The skis point one way (the heading)
// and the skier travels another (the line); on snow the line follows the skis almost at once, on ice it lags and you
// slide, and every bit of turning bleeds speed, so straight down is fastest and carving across slows you. Gravity
// pulls harder on the steep pitches, deep powder drags, moguls bounce you, a snowplough brakes, a tuck goes faster.
// Ramps launch you: hold left or right to spin, up to flip, down to grab your tail, and land straight (skis within
// 50 degrees of the way you took off, no grab) or wipe out in a puff of snow. In Freeride and the Daily Mountain a
// snowstorm follows you down and the run ends when it catches you; clean tricks blow it back. Slalom courses are
// timed through gates; Big Air scores the tricks. Deterministic: a seed and a list of inputs replay exactly.
import {
  HALF, EDGE, CH, PX_PER_M, CABINS, SLALOM, hash, makeChunk, courseLength, gateCount, pitch,
  type Chunk, type Npc, type Ob, type Ramp, type Area, type Gate, type Mode, type WorldSpec,
} from './powder-world.js';
export * from './powder-world.js';

export const DT = 1 / 60;
export const G = 165;            // pull down the fall line, px/s²
export const GZ = 330;           // gravity in the air
export const SPIN_RATE = 560;    // degrees per second while a direction is held in the air
export const FLIP_RATE = 430;
export const SKIER_R = 3;
export const SAVE_KEY = 'powder-paws-v1';
export const CARD_COUNT = CABINS.length;

export type Input = { turn: -1 | 0 | 1; target: number | null; up: boolean; down: boolean };
export const NO_INPUT: Input = { turn: 0, target: null, up: false, down: false };
export type State = 'ride' | 'air' | 'tumble' | 'up';
export type Trick = { name: string; pts: number; clean: boolean };
export type Ev =
  | { t: 'jump'; big: boolean } | { t: 'land'; clean: boolean; trick: Trick | null } | { t: 'crash'; what: string }
  | { t: 'wipeout' } | { t: 'up' } | { t: 'mogul' } | { t: 'puff' } | { t: 'clack' } | { t: 'gate'; ok: boolean; i: number }
  | { t: 'postcard'; k: number } | { t: 'caught' } | { t: 'finish' } | { t: 'bump'; who: Npc['k'] } | { t: 'stormnear' };
export type Over = { reason: 'storm' | 'finish'; dist: number; tricks: number; time: number; missed: number; score: number; cards: number[]; crashes: number; best: string };
export type Skier = {
  x: number; y: number; s: number; a: number; th: number; z: number; vz: number; state: State; t: number; inv: number;
  tuck: boolean; brake: boolean; big: boolean; hop: boolean; spin: number; flip: number; grab: boolean; grabT: number; launchA: number;
};
export type LiveNpc = Npc & { x0: number; daze: number; t: number };

export class PowderGame {
  readonly spec: WorldSpec;
  readonly mode: Mode;
  sk: Skier = { x: 0, y: 0, s: 0, a: 0, th: 0, z: 0, vz: 0, state: 'ride', t: 0, inv: 0, tuck: false, brake: false, big: false, hop: false, spin: 0, flip: 0, grab: false, grabT: 0, launchA: 0 };
  time = 0;
  steps = 0;
  tricks = 0;
  bestTrick: Trick | null = null;
  crashes = 0;
  gatesOk = 0;
  missed = 0;
  nextGate = 0;
  cards: number[] = [];
  storm: { y: number; v: number; on: boolean };
  over: Over | null = null;
  events: Ev[] = [];
  npcs: LiveNpc[] = [];
  chunks = new Map<number, Chunk>();
  readonly end: number;
  private bankT = 0;
  private lastPole = -1;
  private mogulRow = 0;

  constructor(mode: Mode, seed: number, course = 0) {
    this.mode = mode;
    this.spec = { mode, seed: mode === 'slalom' ? SLALOM[course].seed : mode === 'air' ? 777 : seed >>> 0, course };
    this.end = courseLength(this.spec);
    this.storm = { y: -420, v: 0, on: mode === 'free' || mode === 'daily' };
    this.sk.y = 40;
    this.ensure();
  }

  // ---------------------------------------------------------------- the world around the skier
  chunk(i: number) {
    let c = this.chunks.get(i);
    if (!c) {
      c = makeChunk(this.spec, i); this.chunks.set(i, c);
      for (const n of c.npcs) this.npcs.push({ ...n, x0: n.x, daze: 0, t: 0 });
    }
    return c;
  }
  private ensure() {
    const ci = Math.floor(this.sk.y / CH);
    for (let i = Math.max(0, ci - 1); i <= ci + 3; i++) this.chunk(i);
    for (const k of this.chunks.keys()) if (k < ci - 2) this.chunks.delete(k);
    this.npcs = this.npcs.filter((n) => n.y > this.sk.y - 700);
  }
  /** Everything with its y between y0 and y1. */
  near(y0: number, y1: number) {
    const obs: Ob[] = [], areas: Area[] = [], ramps: Ramp[] = [], gates: Gate[] = [];
    for (let i = Math.max(0, Math.floor((y0 - 200) / CH)); i <= Math.floor((y1 + 200) / CH); i++) {
      const c = this.chunks.get(i); if (!c) continue;
      for (const o of c.obs) if (o.y >= y0 - 40 && o.y <= y1 + 40) obs.push(o);
      for (const a of c.areas) if (a.y + a.ry >= y0 && a.y - a.ry <= y1) areas.push(a);
      for (const r of c.ramps) if (r.y >= y0 - 20 && r.y <= y1 + 20) ramps.push(r);
      for (const g of c.gates) if (g.y >= y0 - 20 && g.y <= y1 + 20) gates.push(g);
    }
    return { obs, areas, ramps, gates };
  }
  surface(x: number, y: number): 'snow' | 'ice' | 'powder' | 'moguls' {
    const c = this.chunks.get(Math.floor(y / CH)); if (!c) return 'snow';
    for (const a of c.areas) { const dx = (x - a.x) / a.rx, dy = (y - a.y) / a.ry; if (dx * dx + dy * dy < 1) return a.k; }
    return 'snow';
  }
  dist() { return Math.max(0, this.sk.y - 40) / PX_PER_M; }
  score() { return this.mode === 'air' ? this.tricks : Math.floor(this.dist()) + this.tricks; }
  gateTotal() { return gateCount(this.spec); }
  /** Where the next gate is (slalom), for the bot and the arrow. */
  gateAhead(): Gate | null {
    for (let i = Math.floor(this.sk.y / CH); i < Math.floor(this.sk.y / CH) + 3; i++) for (const g of this.chunks.get(i)?.gates ?? []) if (g.i >= this.nextGate) return g;
    return null;
  }
  /** Is (x, y) beyond the edge of the woods (outside any cabin clearing)? */
  outside(x: number, y: number) {
    const c = this.chunks.get(Math.floor(y / CH));
    const cab = c?.obs.find((o) => o.k === 'cabin');
    if (cab && Math.sign(cab.x) === Math.sign(x) && Math.abs(y - cab.y) < 170) return Math.abs(x) > HALF + 160;
    return Math.abs(x) > HALF + EDGE;
  }

  // ---------------------------------------------------------------- one step
  step(inp: Input) {
    if (this.over) return;
    const k = this.sk, dt = DT;
    this.steps++; this.time += dt;
    k.inv = Math.max(0, k.inv - dt); this.bankT = Math.max(0, this.bankT - dt);
    const py = k.y;
    if (k.state === 'ride') this.ride(inp);
    else if (k.state === 'air') this.fly(inp);
    else if (k.state === 'tumble') {
      k.t -= dt; k.s *= Math.exp(-3.2 * dt);
      k.x += k.s * Math.sin(k.th) * dt; k.y += k.s * Math.cos(k.th) * dt;
      if (k.t <= 0) { k.state = 'up'; k.t = 0.55; k.s = 0; }
    } else if (k.state === 'up') {
      k.t -= dt;
      if (k.t <= 0) {
        k.state = 'ride'; k.a = 0; k.th = 0; k.s = 0; k.inv = 1.1; this.events.push({ t: 'up' });
        if (Math.abs(k.x) > HALF + 6 && !this.inClearing(k.x, k.y)) k.x = Math.sign(k.x) * (HALF - 12);
        this.unstick();
      }
    }
    if (k.state === 'ride' || k.state === 'air') this.hits(py);
    this.crossings(py);
    this.moveNpcs();
    this.ensure();
    // the storm
    const st = this.storm;
    if (st.on) {
      st.v = this.time < 1.5 ? 0 : Math.min(178, 100 + this.dist() * 0.03);
      st.y += st.v * dt;
      st.y = Math.max(st.y, k.y - 900);
      if (st.y >= k.y - 6) { this.events.push({ t: 'caught' }); this.finish('storm'); }
    }
    if (k.y >= this.end && !this.over) { this.events.push({ t: 'finish' }); this.finish('finish'); }
  }
  /** Steps the skier out of anything they ended up inside after a tumble. */
  private unstick() {
    const k = this.sk;
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const o of this.near(k.y - 40, k.y + 40).obs) {
        if (o.k === 'sign' || o.k === 'bank' || o.k === 'pole') continue;
        const dx = k.x - o.x, dy = k.y - o.y, side = dx === 0 ? (o.x > 0 ? -1 : 1) : Math.sign(dx);
        if (o.w && o.d) { if (Math.abs(dx) < o.w / 2 + 6 && Math.abs(dy) < o.d / 2 + 6) { k.x = o.x + side * (o.w / 2 + 8); moved = true; } }
        else if (dx * dx + dy * dy < (o.r + 6) ** 2) { k.x = o.x + side * (o.r + 8); moved = true; }
      }
      if (!moved) break;
    }
  }
  private inClearing(x: number, y: number) {
    const cab = this.chunks.get(Math.floor(y / CH))?.obs.find((o) => o.k === 'cabin');
    return !!cab && Math.sign(cab.x) === Math.sign(x) && Math.abs(y - cab.y) < 170;
  }
  private ride(inp: Input) {
    const k = this.sk, dt = DT, surf = this.surface(k.x, k.y);
    k.brake = inp.down; k.tuck = inp.up && !inp.down;
    const rate = k.s < 50 ? 5 : k.brake ? 4.2 : k.tuck ? 2.1 : 3.4;
    if (inp.target !== null) { const d = inp.target - k.a; k.a += Math.max(-rate * dt, Math.min(rate * dt, d)); }
    else k.a += inp.turn * rate * dt;
    k.a = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, k.a));
    // the line follows the skis: quickly on snow, slowly on ice; turning costs speed
    const grip = surf === 'ice' ? 1.7 : surf === 'powder' ? 11 : k.brake ? 12 : 8.5;
    const dth = (k.a - k.th) * (1 - Math.exp(-grip * dt));
    k.th += dth;
    k.s -= Math.abs(dth) * k.s * (surf === 'ice' ? 0.06 : 0.2);
    const p = pitch(this.spec.seed, k.y);
    k.s += G * p * Math.cos(k.th) * dt;
    const mu = surf === 'ice' ? 6 : surf === 'powder' ? 115 : 22;
    const brake = k.brake ? (surf === 'ice' ? 120 : 380) : 0;
    const drag = k.tuck ? 0.003 : 0.0045;
    k.s = Math.max(0, k.s - (mu + brake + drag * k.s * k.s) * dt);
    // nearly stopped across the slope: shuffle the way you face
    if (k.s < 12 && Math.abs(k.a) > 1.3 && inp.turn !== 0 && Math.sign(inp.turn) === Math.sign(k.a)) k.x += Math.sign(k.a) * 14 * dt;
    k.x += k.s * Math.sin(k.th) * dt; k.y += k.s * Math.cos(k.th) * dt;
    if (surf === 'moguls' && !k.brake) {
      const row = Math.floor(k.y / 34);
      if (row !== this.mogulRow && k.s > 40) { this.mogulRow = row; this.launch(30 + k.s * 0.12, false, true); k.s *= 0.97; this.events.push({ t: 'mogul' }); }
    } else this.mogulRow = Math.floor(k.y / 34);
  }
  private launch(vz: number, big: boolean, hop: boolean) {
    const k = this.sk;
    k.state = 'air'; k.z = 0.01; k.vz = vz; k.big = big; k.hop = hop; k.spin = 0; k.flip = 0; k.grab = false; k.grabT = 0; k.launchA = k.a; k.tuck = false; k.brake = false;
  }
  private fly(inp: Input) {
    const k = this.sk, dt = DT;
    k.s = Math.max(0, k.s - (0.0015 * k.s * k.s) * dt);
    k.x += k.s * Math.sin(k.th) * dt; k.y += k.s * Math.cos(k.th) * dt;
    k.z += k.vz * dt; k.vz -= GZ * dt;
    if (!k.hop) {
      const turn = inp.target !== null ? 0 : inp.turn;
      k.spin += turn * SPIN_RATE * dt;
      if (inp.up && !inp.down) k.flip += FLIP_RATE * dt;
      k.grab = inp.down;
      if (k.grab) k.grabT += dt;
    } else if (inp.target !== null) { const d = inp.target - k.a; k.a += Math.max(-2 * dt, Math.min(2 * dt, d)); }
    if (k.z <= 0) this.land();
  }
  private land() {
    const k = this.sk;
    k.z = 0; k.vz = 0; k.state = 'ride';
    if (k.hop) { k.hop = false; return; }
    const off = (deg: number) => { const m = ((Math.abs(deg) % 360) + 360) % 360; return Math.min(m, 360 - m); };
    const so = off(k.spin), fo = off(k.flip);
    if (k.grab || so > 80 || fo > 85) {
      this.events.push({ t: 'wipeout' });
      this.tumble(k.grab ? 'still holding the grab' : so > 80 ? 'landed sideways' : 'landed on your back');
      k.spin = 0; k.flip = 0;
      return;
    }
    const clean = so <= 50 && fo <= 55;
    const trick = this.trickOf(clean);
    if (trick) {
      this.tricks += trick.pts;
      if (!this.bestTrick || trick.pts > this.bestTrick.pts) this.bestTrick = trick;
      if (clean && this.storm.on) this.storm.y -= 30 + trick.pts * 0.12;
    }
    if (!clean) k.s *= 0.6; else if (trick) k.s *= 1.04;
    k.a = k.launchA; k.th = k.a; k.spin = 0; k.flip = 0; k.grab = false;
    this.events.push({ t: 'land', clean, trick });
  }
  /** What the tricks of this jump add up to. */
  trickOf(clean: boolean): Trick | null {
    const k = this.sk, parts: string[] = [];
    let pts = 0, kinds = 0;
    const turns = Math.round(Math.abs(k.spin) / (clean ? 180 : 360)) * (clean ? 180 : 360);
    const flips = Math.round(Math.abs(k.flip) / 360);
    if (k.grabT >= 0.25) { kinds++; pts += 150 + Math.round(250 * k.grabT); parts.push(k.grabT >= 1 ? 'Long Tail Grab' : k.grabT >= 0.6 ? 'Tail Grab' : 'Tail Tap'); }
    if (turns >= 180) { kinds++; pts += [0, 100, 250, 400, 600, 850, 1100, 1400][Math.min(7, turns / 180)]; parts.push(`Twirl ${turns}`); }
    if (flips >= 1) { kinds++; pts += 500 * flips + 300 * (flips - 1); parts.push(flips === 1 ? 'Snowball Flip' : flips === 2 ? 'Double Snowball' : 'Triple Snowball'); }
    if (!kinds) return null;
    pts = Math.round(pts * (1 + 0.25 * (kinds - 1)) * (k.big ? 1.2 : 1) * (clean ? 1 : 0.5) / 10) * 10;
    return { name: parts.join(' + '), pts, clean };
  }
  private tumble(what: string) {
    const k = this.sk;
    k.state = 'tumble'; k.t = 1.25; k.z = 0; k.vz = 0; k.spin = 0; k.flip = 0; k.grab = false; k.tuck = false; k.brake = false;
    this.crashes++;
    this.events.push({ t: 'crash', what });
  }
  private hits(py: number) {
    const k = this.sk;
    if (k.inv > 0) return;
    const { obs } = this.near(k.y - 40, k.y + 40);
    for (const o of obs) {
      if (o.k === 'sign') continue;
      const dx = k.x - o.x, dy = k.y - o.y;
      if (o.w && o.d) {
        if (Math.abs(dx) < o.w / 2 + SKIER_R && Math.abs(dy) < o.d / 2 + SKIER_R && k.z < o.h) { this.tumble(o.k === 'fence' ? 'a fence' : 'a hut'); return; }
        continue;
      }
      if (dx * dx + dy * dy > (o.r + SKIER_R) ** 2 || k.z >= o.h) continue;
      if (o.k === 'bank') { if (this.bankT <= 0 && k.state === 'ride') { k.s *= 0.5; this.bankT = 0.5; this.events.push({ t: 'puff' }); } continue; }
      if (o.k === 'pole') { const id = o.x * 7 + o.y; if (id !== this.lastPole) { this.lastPole = id; k.s *= 0.85; this.events.push({ t: 'clack' }); } continue; }
      this.tumble(o.k === 'rock' ? 'a rock' : o.k === 'stump' ? 'a stump' : o.k === 'snowman' ? 'a snowman' : 'a tree'); return;
    }
    for (const n of this.npcs) {
      if (Math.abs(n.y - k.y) > 10 || k.z > 10) continue;
      if (Math.hypot(n.x - k.x, n.y - k.y) < 8) { n.daze = 1.6; this.events.push({ t: 'bump', who: n.k }); this.tumble('a ' + (n.k === 'skier' ? 'marmot' : n.k)); return; }
    }
    if (this.outside(k.x, k.y)) { this.tumble('the deep woods'); return; }
    void py;
  }
  private crossings(py: number) {
    const k = this.sk;
    const { obs, ramps, gates } = this.near(py - 20, k.y + 20);
    if (k.state === 'ride') for (const r of ramps) {
      const lip = r.y + 10;
      if (py < lip && k.y >= lip && Math.abs(k.x - r.x) < r.w / 2 + 2 && Math.abs(k.a) < 1.25) {
        this.launch(r.k === 'big' ? Math.min(300, 90 + k.s * 0.8) : Math.min(180, 45 + k.s * 0.5), r.k === 'big', false);
        this.events.push({ t: 'jump', big: r.k === 'big' });
      }
    }
    for (const g of gates) if (py < g.y && k.y >= g.y && g.i >= this.nextGate) {
      const ok = Math.abs(k.x - g.x) < g.w / 2;
      this.nextGate = g.i + 1; if (ok) this.gatesOk++; else this.missed++;
      this.events.push({ t: 'gate', ok, i: g.i });
    }
    for (const o of obs) if (o.k === 'cabin' && o.i !== undefined && !this.cards.includes(o.i)) {
      // the porch is on the uphill side of the cabin
      if (Math.hypot(k.x - o.x, k.y - (o.y - (o.d ?? 30) / 2 - 12)) < 30) { this.cards.push(o.i); this.events.push({ t: 'postcard', k: o.i }); }
    }
  }
  private moveNpcs() {
    for (const n of this.npcs) {
      n.t += DT;
      if (n.daze > 0) { n.daze -= DT; n.y += 12 * DT; continue; }
      if (n.k === 'skier' || n.k === 'stoat') n.x = n.x0 + 46 * Math.sin(n.t * 1.25 + n.ph);
      else if (n.k === 'hedgehog') n.x = n.x0 + 18 * Math.sin(n.t * 0.7 + n.ph);
      else { n.x += n.vx * DT; if (Math.abs(n.x) > HALF - 16) { n.vx = -n.vx; n.x = Math.sign(n.x) * (HALF - 16); } }
      n.y += n.vy * DT;
    }
  }
  /** How an NPC is moving right now (for facing). */
  npcVel(n: LiveNpc) {
    if (n.daze > 0) return { vx: 0, vy: 12 };
    if (n.k === 'skier' || n.k === 'stoat') return { vx: 46 * 1.25 * Math.cos(n.t * 1.25 + n.ph), vy: n.vy };
    if (n.k === 'hedgehog') return { vx: 18 * 0.7 * Math.cos(n.t * 0.7 + n.ph), vy: n.vy };
    return { vx: n.vx, vy: n.vy };
  }
  private finish(reason: Over['reason']) {
    const time = this.time + (this.mode === 'slalom' ? this.missed * 5 : 0);
    this.over = {
      reason, dist: Math.floor(this.dist()), tricks: this.tricks, time: Math.round(time * 100) / 100, missed: this.missed,
      score: this.score(), cards: [...this.cards], crashes: this.crashes, best: this.bestTrick?.name ?? '',
    };
  }
  drain() { const e = this.events; this.events = []; return e; }
  /** Stop the run where it is (the page uses this when leaving). */
  quit() { if (!this.over) this.finish(this.mode === 'free' || this.mode === 'daily' ? 'storm' : 'finish'); }
}

// ---------------------------------------------------------------- medals, unlocks and the save
/** Slalom medal times (seconds, gold/silver/bronze), set from the human-like bot's runs in tests/powder-bot.mjs. */
export const SLALOM_MEDALS: [number, number, number][] = [[22, 31, 40], [33, 44, 56], [30, 41, 52], [39, 46, 59], [38, 55, 70], [46, 69, 88]];
/** Big Air medal scores (gold/silver/bronze). */
export const AIR_MEDALS: [number, number, number] = [3000, 1400, 800];
export type Medal = 0 | 1 | 2 | 3; // none, bronze, silver, gold
export function slalomMedal(course: number, time: number, missed: number): Medal {
  if (missed > 2) return 0;
  const [g, s, b] = SLALOM_MEDALS[course];
  return time <= g ? 3 : time <= s ? 2 : time <= b ? 1 : 0;
}
export function airMedal(score: number): Medal { const [g, s, b] = AIR_MEDALS; return score >= g ? 3 : score >= s ? 2 : score >= b ? 1 : 0; }

export type GearKind = 'scarf' | 'hat' | 'skis';
export type Gear = { id: string; kind: GearKind; name: string; colour: string; how: string };
export const GEAR: Gear[] = [
  { id: 'scarf-red', kind: 'scarf', name: 'Cherry scarf', colour: '#e8344a', how: 'From the start' },
  { id: 'scarf-blue', kind: 'scarf', name: 'Blueberry scarf', colour: '#3a7cf0', how: 'From the start' },
  { id: 'scarf-mint', kind: 'scarf', name: 'Mint stripes', colour: '#3cc8a0', how: 'Find 2 postcards' },
  { id: 'scarf-sun', kind: 'scarf', name: 'Sunrise scarf', colour: '#ffb21e', how: 'Ski 1,000 m in one run' },
  { id: 'scarf-rainbow', kind: 'scarf', name: 'Rainbow scarf', colour: '#ff5fa8', how: 'Find all 10 postcards' },
  { id: 'hat-none', kind: 'hat', name: 'Bare head', colour: '', how: 'From the start' },
  { id: 'hat-beanie', kind: 'hat', name: 'Knitted beanie', colour: '#e8344a', how: 'Land a clean trick' },
  { id: 'hat-goggles', kind: 'hat', name: 'Snow goggles', colour: '#ffb21e', how: 'Win a slalom medal' },
  { id: 'hat-helmet', kind: 'hat', name: 'Racing helmet', colour: '#3a7cf0', how: 'Win three slalom golds' },
  { id: 'skis-red', kind: 'skis', name: 'Red skis', colour: '#e8344a', how: 'From the start' },
  { id: 'skis-wood', kind: 'skis', name: 'Wooden skis', colour: '#b8743a', how: 'Find 5 postcards' },
  { id: 'skis-ice', kind: 'skis', name: 'Icicle skis', colour: '#7ee0ff', how: 'Score 3,000 in Big Air' },
  { id: 'skis-gold', kind: 'skis', name: 'Golden skis', colour: '#ffd23a', how: 'Gold in every slalom' },
];
export type Who = 'dora' | 'enzo';
export type Save = {
  v: 1; who: Who; best: { free: number; tricks: number; air: number; daily: Record<string, number> };
  slalom: { time: number; medal: Medal }[]; airMedal: Medal; cards: number[]; gear: Record<Who, Record<GearKind, string>>;
  cleanTrick: boolean; runs: number; ended: boolean; tips: string[]; settings: { sound: boolean; music: boolean };
};
export function freshSave(): Save {
  return {
    v: 1, who: 'dora', best: { free: 0, tricks: 0, air: 0, daily: {} }, slalom: SLALOM.map(() => ({ time: 0, medal: 0 as Medal })), airMedal: 0, cards: [],
    gear: { dora: { scarf: 'scarf-red', hat: 'hat-none', skis: 'skis-red' }, enzo: { scarf: 'scarf-blue', hat: 'hat-none', skis: 'skis-red' } },
    cleanTrick: false, runs: 0, ended: false, tips: [], settings: { sound: true, music: true },
  };
}
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
/** Reads a save, ignoring anything it doesn't recognise (never throws). */
export function readSave(raw: string | null): Save {
  const s = freshSave();
  if (!raw) return s;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object' || o.v !== 1) return s;
  if (o.who === 'dora' || o.who === 'enzo') s.who = o.who;
  const b = o.best as Record<string, unknown> | undefined;
  if (b && typeof b === 'object') {
    s.best.free = num(b.free); s.best.tricks = num(b.tricks); s.best.air = num(b.air);
    if (b.daily && typeof b.daily === 'object') for (const [k, v] of Object.entries(b.daily as object)) if (/^\d{8}$/.test(k) && num(v) > 0) s.best.daily[k] = num(v);
  }
  if (Array.isArray(o.slalom)) o.slalom.slice(0, SLALOM.length).forEach((x, i) => {
    if (x && typeof x === 'object') { const r = x as Record<string, unknown>; s.slalom[i] = { time: num(r.time), medal: (Math.min(3, Math.floor(num(r.medal))) as Medal) }; }
  });
  s.airMedal = Math.min(3, Math.floor(num(o.airMedal))) as Medal;
  if (Array.isArray(o.cards)) s.cards = [...new Set(o.cards.filter((c): c is number => Number.isInteger(c) && c >= 0 && c < CARD_COUNT))];
  const gr = o.gear as Record<string, Record<string, unknown>> | undefined;
  if (gr && typeof gr === 'object') for (const who of ['dora', 'enzo'] as const) for (const kind of ['scarf', 'hat', 'skis'] as const) {
    const id = gr[who]?.[kind];
    if (typeof id === 'string' && GEAR.some((g) => g.id === id && g.kind === kind)) s.gear[who][kind] = id;
  }
  s.cleanTrick = o.cleanTrick === true; s.ended = o.ended === true; s.runs = Math.floor(num(o.runs));
  if (Array.isArray(o.tips)) s.tips = o.tips.filter((t): t is string => typeof t === 'string').slice(0, 40);
  const st = o.settings as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') { s.settings.sound = st.sound !== false; s.settings.music = st.music !== false; }
  return s;
}
export function unlocked(s: Save, id: string) {
  const golds = s.slalom.filter((x) => x.medal === 3).length, medals = s.slalom.filter((x) => x.medal > 0).length;
  switch (id) {
    case 'scarf-mint': return s.cards.length >= 2;
    case 'scarf-sun': return s.best.free >= 1000;
    case 'scarf-rainbow': return s.cards.length >= CARD_COUNT;
    case 'hat-beanie': return s.cleanTrick;
    case 'hat-goggles': return medals >= 1;
    case 'hat-helmet': return golds >= 3;
    case 'skis-wood': return s.cards.length >= 5;
    case 'skis-ice': return s.best.air >= 3000;
    case 'skis-gold': return golds >= SLALOM.length;
    default: return true;
  }
}
/** Records a finished run; returns what's new. */
export function recordRun(s: Save, g: PowderGame, day?: string) {
  const o = g.over; if (!o) return { best: false, newCards: [] as number[], medal: 0 as Medal, unlocks: [] as string[] };
  const before = GEAR.filter((x) => unlocked(s, x.id)).map((x) => x.id);
  let best = false, medal: Medal = 0;
  s.runs++;
  if (g.bestTrick?.clean) s.cleanTrick = true;
  const newCards = o.cards.filter((c) => !s.cards.includes(c));
  s.cards.push(...newCards);
  if (g.mode === 'free') { if (o.dist > s.best.free) { s.best.free = o.dist; best = true; } s.best.tricks = Math.max(s.best.tricks, o.tricks); }
  if (g.mode === 'daily' && day) { if (o.score > (s.best.daily[day] ?? 0)) { s.best.daily[day] = o.score; best = true; } const ks = Object.keys(s.best.daily).sort(); while (ks.length > 30) delete s.best.daily[ks.shift()!]; }
  if (g.mode === 'slalom' && o.reason === 'finish') {
    const c = g.spec.course, r = s.slalom[c]; medal = slalomMedal(c, o.time, o.missed);
    if (o.missed <= 2 && (!r.time || o.time < r.time)) { r.time = o.time; best = true; }
    r.medal = Math.max(r.medal, medal) as Medal;
  }
  if (g.mode === 'air' && o.reason === 'finish') { medal = airMedal(o.tricks); if (o.tricks > s.best.air) { s.best.air = o.tricks; best = true; } s.airMedal = Math.max(s.airMedal, medal) as Medal; }
  const unlocks = GEAR.filter((x) => unlocked(s, x.id) && !before.includes(x.id)).map((x) => x.id);
  return { best, newCards, medal, unlocks };
}
/** The seed for a day's mountain (yyyymmdd). */
export function daySeed(day: string) { return hash(Number(day) || 1, 66); }
/** A fresh freeride seed from a counter (no clock). */
export function runSeed(runs: number) { return hash(runs + 1, 4242); }

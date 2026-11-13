// Above & Below, Chapter One: the engine. Two heroes in one cross-section, Dora on the meadow and Enzo in the burrows,
// four rooms in order (lib/above-rooms.ts), direct controls with no momentum, braces (hold a root up, pull a rope, keep
// a lever down) and the solo hand-off (swap away while holding and the hero keeps bracing a few seconds alone), the
// shared hawk and leaf ride, the wordless hints (glints, pointing, calling, key prompts, a ghost demo) and the light
// auto-help for the hero nobody steers. Deterministic: randomness comes from a seeded generator. No DOM.
import { World, WW, type FxKind, type Host } from './above-world.js';
import { ROOMS, type Room, type Beat, type Route, type O, type Leaf } from './above-rooms.js';

export { WW, WH, CELL } from './above-world.js';
export { ROOMS } from './above-rooms.js';
export const DT = 1 / 60;
export const GRAV = 1900, JUMPV = 640, CLAMBER = 92;
export const SAVE_KEY = 'above-and-below-v1';

export type HeroId = 'dora' | 'enzo';
export type Mode = 'title' | 'play' | 'win';
/** the buttons of one player slot this step; the P flags are fresh presses */
export interface Pad { l: boolean; r: boolean; u: boolean; d: boolean; jump: boolean; act: boolean; swap: boolean; jumpP: boolean; actP: boolean; swapP: boolean }
export const NO_PAD: Pad = { l: false, r: false, u: false, d: false, jump: false, act: false, swap: false, jumpP: false, actP: false, swapP: false };
export interface Dirs { l: boolean; r: boolean; u: boolean; d: boolean }
export type HState = 'free' | 'act' | 'brace' | 'hurt' | 'win' | 'carried' | 'ride' | 'climb' | 'clamber';
export interface Act { name: string; t: number; dur: number; fired: boolean; px?: number; py?: number; side?: boolean; cap?: number; boop?: boolean }
export interface Brace { name: 'hold' | 'pull' | 'lever'; t: number; grace: number }
export interface Hero {
  id: HeroId; x: number; y: number; vx: number; vy: number; face: number; ground: boolean; state: HState; act: Act | null; brace: Brace | null;
  t: number; walkT: number; landT: number; idleT: number; cue: string | null; cueT: number; hurtT: number; pushT: number; digHold: number;
  w: number; h: number; speed: number; auto: number | null; autoDuck: boolean; autoJump: boolean; hidden: boolean; inBush: boolean;
  ducking: boolean; moving: boolean; actLatch: boolean; blocked: number; jumped: boolean; dropping: boolean; quickT: number;
  clT: number; clX: number; clY: number; carryT: number; dropX: number;
}
export type Ev = { k: 'sfx'; id: string; a?: number } | { k: 'fx'; f: FxKind; x: number; y: number; n: number } | { k: 'room'; i: number } | { k: 'win' };
export interface Bubble { who: HeroId; icon: string; t: number; calling: boolean }
export interface Stats {
  beats: [string, number][]; rooms: [string, number][]; swaps: number; inactiveIdle: number; waitOnOther: number; autoDist: number; keyPrompts: number;
  ghosts: number; digs: number; stamps: number; reveals: number; noseStamps: number; bumps: Record<HeroId, number>; hawkCatches: number; activeTime: Record<HeroId, number>; startRoom: number;
}
export interface Prompt { who: HeroId; what: 'swap' | 'act' | 'up' | 'down' | 'move'; dir: number; hold: boolean }

export interface SaveData { v: 1; ck: number; assist: boolean; sound: boolean; best: number | null }
export function freshSave(): SaveData { return { v: 1, ck: 0, assist: true, sound: true, best: null }; }
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || typeof s.ck !== 'number') return null;
    return { v: 1, ck: Math.max(0, Math.min(ROOMS.length - 1, Math.floor(s.ck))), assist: s.assist !== false, sound: s.sound !== false, best: typeof s.best === 'number' ? s.best : null };
  } catch { return null; }
}

/** keyboard → pad buttons. Solo: arrows or WASD, Space jump, E or Enter act, Shift or Q swap. Two players on one
 *  keyboard: Dora on WASD + Space + E, Enzo on the arrows + / + . */
export type Btn = 'l' | 'r' | 'u' | 'd' | 'jump' | 'act' | 'swap';
export const KEYS: Record<'solo' | 'p1' | 'p2', Record<string, Btn>> = {
  solo: { KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', Space: 'jump', KeyE: 'act', Enter: 'act', ShiftLeft: 'swap', ShiftRight: 'swap', KeyQ: 'swap' },
  p1: { KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd', Space: 'jump', KeyE: 'act' },
  p2: { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', Slash: 'jump', Period: 'act' },
};
export function keyMap(code: string, twoP: boolean): ['p1' | 'p2', Btn] | null {
  if (!twoP) return KEYS.solo[code] ? ['p1', KEYS.solo[code]] : null;
  if (KEYS.p1[code]) return ['p1', KEYS.p1[code]];
  if (KEYS.p2[code]) return ['p2', KEYS.p2[code]];
  return null;
}
/** held keys → two pads, releasing a button only when no other held key maps to it (shared by the page and the bots) */
export class Keys {
  held = new Set<string>(); pads = { p1: { ...NO_PAD }, p2: { ...NO_PAD } }; twoP = false;
  down(code: string) {
    const m = keyMap(code, this.twoP); if (!m) return false;
    this.held.add(code); const p = this.pads[m[0]], b = m[1];
    if (!p[b] && (b === 'jump' || b === 'act' || b === 'swap')) p[`${b}P`] = true;
    p[b] = true; return true;
  }
  up(code: string) {
    const m = keyMap(code, this.twoP); this.held.delete(code); if (!m) return false;
    for (const c of this.held) { const n = keyMap(c, this.twoP); if (n && n[0] === m[0] && n[1] === m[1]) return true; }
    this.pads[m[0]][m[1]] = false; return true;
  }
  clear() { this.held.clear(); this.pads = { p1: { ...NO_PAD }, p2: { ...NO_PAD } }; }
  /** the pads for this step; fresh presses are consumed */
  take(): [Pad, Pad] { const a = { ...this.pads.p1 }, b = { ...this.pads.p2 }; for (const p of [this.pads.p1, this.pads.p2]) p.jumpP = p.actP = p.swapP = false; return [a, b]; }
}

export function rngOf(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function mkHero(id: HeroId, x: number, y: number): Hero {
  return { id, x, y, vx: 0, vy: 0, face: 1, ground: true, state: 'free', act: null, brace: null, t: 0, walkT: 0, landT: 0, idleT: 0, cue: null, cueT: 0,
    hurtT: 0, pushT: 0, digHold: 0, w: id === 'dora' ? 34 : 38, h: 84, speed: id === 'dora' ? 200 : 185, auto: null, autoDuck: false, autoJump: false,
    hidden: false, inBush: false, ducking: false, moving: false, actLatch: false, blocked: 0, jumped: false, dropping: false, quickT: -9, clT: 0, clX: 0, clY: 0, carryT: 0, dropX: 0 };
}
function freshStats(room: number): Stats {
  return { beats: [], rooms: [], swaps: 0, inactiveIdle: 0, waitOnOther: 0, autoDist: 0, keyPrompts: 0, ghosts: 0, digs: 0, stamps: 0, reveals: 0, noseStamps: 0,
    bumps: { dora: 0, enzo: 0 }, hawkCatches: 0, activeTime: { dora: 0, enzo: 0 }, startRoom: room };
}

export class AboveGame implements Host {
  rnd: () => number;
  t = 0; mode: Mode = 'title'; twoP = false; assist = true; active: HeroId = 'dora';
  idx = 0; room: Room = ROOMS[0]; beats: Beat[] = []; beat = 0; beatT = 0; hintT = 0; ghostT = 0; roomT = 0; leaving = 0; fade = 0; fadeIn = 0;
  shake = 0; flash = 0; bubbles: Bubble[] = []; showKeys = false; keysOn = 0; keysCounted = false; need: HeroId = 'dora'; lastInput = 0;
  winT = 0; clearT = 0; startT = 0; card: { name: string; t: number } | null = null; plugClear = false;
  world: World; o!: O; heroes!: Record<HeroId, Hero>; stats: Stats = freshStats(0);
  events: Ev[] = [];
  pads: { p1: Pad; p2: Pad } = { p1: NO_PAD, p2: NO_PAD };
  private prevDirs = { p1: 0, p2: 0 };

  constructor(opts: { seed?: number; assist?: boolean; room?: number } = {}) {
    this.rnd = rngOf(opts.seed ?? 1);
    this.assist = opts.assist ?? true;
    this.world = new World(this);
    this.reset(opts.room ?? 0);
  }
  get water() { return this.world.water; }
  sfx(id: string, a?: number) { this.events.push({ k: 'sfx', id, a }); }
  fx(f: FxKind, x: number, y: number, n = 1) { this.events.push({ k: 'fx', f, x, y, n }); }
  bubble(h: Hero, icon: string, calling = false) { this.bubbles.push({ who: h.id, icon, t: 0, calling }); }

  // ───────────────────────────── chapter flow
  reset(room = 0) {
    this.mode = 'title'; this.winT = 0; this.startT = 0; this.active = 'dora'; this.card = null; this.fadeIn = 0;
    this.stats = freshStats(room);
    this.load(room);
  }
  start(two: boolean, room = 0) {
    this.reset(room); this.setTwoP(two); this.mode = 'play'; this.startT = this.t; this.lastInput = this.t; this.sfx('click');
    this.card = { name: this.room.name, t: 0 }; this.events.push({ k: 'room', i: room });
  }
  setTwoP(on: boolean) { this.twoP = on; }
  swap() {
    if (this.twoP || this.mode !== 'play') return;
    this.active = this.active === 'dora' ? 'enzo' : 'dora'; this.stats.swaps++; this.sfx('swap');
    const h = this.heroes[this.active]; this.fx('stars', h.x, h.y - 60); h.cue = null; h.idleT = 0;
    // the act key still held from the hand-off belongs to the hero left bracing: it doesn't start a hold-dig for this one
    h.actLatch = true;
  }
  win() {
    this.mode = 'win'; this.winT = 0; this.clearT = this.t - this.startT;
    for (const h of [this.heroes.dora, this.heroes.enzo]) { if (h.state === 'brace') this.endBrace(h, false); h.state = 'win'; }
    this.sfx('win'); this.events.push({ k: 'win' });
  }
  load(i: number) {
    this.idx = i; const R = this.room = ROOMS[i];
    this.beats = R.beats.map((b) => ({ ...b }));
    this.world.build(R.geo); this.world.water.set(null); this.bubbles = [];
    this.o = { hawk: { on: false, t: 0, x: -400, phase: 'wait', next: 2, pass: 0, dir: 1 } };
    this.heroes = { dora: mkHero('dora', R.spawn.dora[0], R.spawn.dora[1]), enzo: mkHero('enzo', R.spawn.enzo[0], R.spawn.enzo[1]) };
    this.beat = 0; this.beatT = 0; this.hintT = 0; this.ghostT = 0; this.roomT = 0; this.leaving = 0;
    R.init(this, this.o);
    if (this.mode === 'play') { this.card = { name: R.name, t: 0 }; this.events.push({ k: 'room', i }); }
  }
  cur(): Beat | undefined { return this.beats[this.beat]; }
  advance(id: string) {
    const i = this.beats.findIndex((b) => b.id === id); if (i < this.beat) return;
    this.stats.beats.push([this.room.id + ':' + id, +this.t.toFixed(1)]);
    this.beat = i + 1; this.beatT = 0; this.hintT = 0; this.ghostT = 0; this.sfx('click');
  }
  near(h: Hero, x: number, r: number) { return Math.abs(h.x - x) < r; }
  route(h: Hero, b: Beat): Route { return (this.room.route && this.room.route(this, h, b)) || { tx: b.tx, ty: b.ty, act: b.act, id: b.id }; }
  needFor(b: Beat): HeroId { if (b.who !== 'both') return b.who; return this.room.needFor ? this.room.needFor(this, b) : 'dora'; }
  leave() { this.leaving = 0.001; this.sfx('door'); this.stats.rooms.push([this.room.id, +(this.t - this.startT).toFixed(1)]); }
  next() { this.leaving = 0; if (this.idx + 1 < ROOMS.length) { this.load(this.idx + 1); this.fadeIn = 1; } }

  // ───────────────────────────── the step
  step(p1: Pad = NO_PAD, p2: Pad = NO_PAD, dt = DT) {
    this.pads = { p1, p2 };
    for (const k of ['p1', 'p2'] as const) {
      const p = this.pads[k], d = (p.l ? 1 : 0) | (p.r ? 2 : 0) | (p.u ? 4 : 0) | (p.d ? 8 : 0);
      if (p.jumpP || p.actP || p.swapP || (d & ~this.prevDirs[k])) this.lastInput = this.t;
      this.prevDirs[k] = d;
    }
    this.t += dt;
    this.fade = this.leaving ? 1 : 0;
    const D = this.heroes.dora, E = this.heroes.enzo;
    if (this.mode === 'play') {
      if (p1.swapP) this.swap();
      this.autoHelp();
      this.updateHero(D, dt); this.updateHero(E, dt);
      this.updateRoom(dt); this.hints(dt);
      if (!this.twoP && this.mode === 'play') {
        this.stats.activeTime[this.active] += dt;
        const ina = this.active === 'dora' ? E : D;
        if (!ina.moving && ina.state !== 'act' && ina.state !== 'climb' && ina.state !== 'brace') this.stats.inactiveIdle += dt;
        const b = this.cur(); if (b && this.needFor(b) !== this.active) this.stats.waitOnOther += dt;
      }
    } else if (this.mode === 'win') {
      this.winT += dt;
      for (const h of [D, E]) { h.t += dt; this.physics(h, dt); }
      if (this.winT < 2.5 && this.rnd() < 0.5) { this.fx('confetti', D.x, D.y - 60, 2); this.fx('confetti', E.x, E.y - 60, 2); }
      if (this.o.gb) this.o.gb.t += dt;
    } else {
      for (const h of [D, E]) { h.t += dt; h.idleT += dt * 0.3; }
    }
    if (this.card) { this.card.t += dt; if (this.card.t > 2.6) this.card = null; }
    this.bubbles = this.bubbles.filter((b) => (b.t += dt) < 1.8);
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt * 30); this.flash = Math.max(0, this.flash - dt);
  }

  // ───────────────────────────── heroes
  heroInput(h: Hero): Pad | null {
    if (this.mode !== 'play' || this.fade > 0) return null;
    if (this.twoP) return h.id === 'dora' ? this.pads.p1 : this.pads.p2;
    return this.active === h.id ? this.pads.p1 : null;
  }
  startAct(h: Hero, name: string, dur: number) { h.act = { name, t: 0, dur, fired: false }; h.state = 'act'; h.vx = 0; }
  /** how long a hero keeps bracing alone after you swap away (the quick hand-off) */
  graceFor() { return this.assist ? 3.6 : 2.4; }
  startBrace(h: Hero, name: Brace['name'], x?: number) { h.state = 'brace'; h.brace = { name, t: 0, grace: this.graceFor() }; h.vx = 0; if (x != null) h.x = x; }
  endBrace(h: Hero, tired: boolean) {
    const b = h.brace; h.brace = null; h.state = 'free';
    if (tired && b && b.t > 1) this.startAct(h, 'tired', 0.7);
  }
  bump(h: Hero, dir: number, sound = true) {
    if (h.state === 'hurt' || h.state === 'win' || h.state === 'carried') return;
    if (h.state === 'brace') this.endBrace(h, false);
    h.state = 'hurt'; h.hurtT = 0.55; h.vx = dir * 260; h.vy = -380; h.ground = false; h.act = null;
    if (sound) this.sfx('hurt'); this.fx('stars', h.x, h.y - 80);
    this.stats.bumps[h.id]++; this.shake = 6;
  }
  updateHero(h: Hero, dt: number) {
    h.t += dt; h.cueT -= dt; if (h.cueT <= 0) h.cue = null;
    const pad = this.heroInput(h);
    let d: Dirs = pad ? { l: pad.l, r: pad.r, u: pad.u, d: pad.d } : { l: false, r: false, u: false, d: false };
    let jumpP = pad ? pad.jumpP : false;
    if (h.actLatch && (!pad || !pad.act)) h.actLatch = false;
    const actP = pad ? pad.actP : false, actH = pad ? pad.act : false, digH = actH && !h.actLatch;
    // light auto-help for the hero nobody is steering
    if (!pad && h.auto != null && this.mode === 'play' && h.state === 'free') {
      const dx = h.auto - h.x;
      if (Math.abs(dx) > 14) { d = { l: dx < 0, r: dx > 0, u: false, d: false }; this.stats.autoDist += h.speed * dt; }
    }
    if (!pad && h.autoDuck) d = { l: false, r: false, u: false, d: true };
    if (!pad && h.autoJump && h.ground && h.state === 'free') jumpP = true;
    const anyIn = pad && (d.l || d.r || d.u || d.d || jumpP || actP || actH);
    h.idleT = anyIn ? 0 : h.idleT + dt;

    if (h.state === 'win') { h.vx = 0; this.physics(h, dt); return; }
    if (h.state === 'carried') return;   // the hawk has her
    if (h.state === 'hurt') {
      h.hurtT -= dt; this.physics(h, dt);
      if (h.hurtT <= 0 && h.ground) { h.state = 'free'; h.vx = 0; }
      return;
    }
    if (h.state === 'act') {
      const a = h.act!; a.t += dt;
      this.actTick(h, a);
      if (a.t >= a.dur) { h.act = null; h.state = 'free'; }
      this.physics(h, dt); return;
    }
    if (h.state === 'brace') {
      const b = h.brace!; b.t += dt;
      if (pad) { b.grace = this.graceFor(); if (!actH || d.l || d.r || jumpP) { if (b.t < 0.45) h.quickT = this.t; this.endBrace(h, false); this.physics(h, dt); return; } }
      else { b.grace -= dt; if (b.grace <= 0) { this.endBrace(h, true); this.physics(h, dt); return; } }
      if (this.room.braceTick) this.room.braceTick(this, h, b, dt);
      if (h.state === 'brace') { h.vx = 0; this.physics(h, dt); }
      return;
    }
    if (h.state === 'ride') { this.ride(h, d, dt); return; }
    if (h.state === 'climb') { this.climb(h, d, jumpP, dt); return; }
    if (h.state === 'clamber') {
      h.clT -= dt; if (h.clT <= 0) { h.state = 'free'; h.y = h.clY; h.x = h.clX; h.vy = 0; h.ground = true; }
      return;
    }
    // duck (both heroes): Enzo ducks under swipes, Dora ducks into holes and bushes
    h.ducking = h.ground && d.d && !d.l && !d.r;
    const mv = (d.r ? 1 : 0) - (d.l ? 1 : 0);
    h.vx = h.ducking ? 0 : mv * h.speed;
    if (mv) h.face = mv;
    if (actP && this.tryAct(h, d)) { this.physics(h, dt); return; }
    if (digH && h.id === 'enzo' && h.digHold > 0.22) { h.digHold = 0; this.dig(h, d); }
    h.digHold = digH ? h.digHold + dt : 0;
    if ((jumpP || d.u) && this.tryClimb(h)) return;
    if (jumpP && h.ground) {
      // jump; if a low ledge is right ahead, clamber onto it instead (it reads better than a jump)
      if (!this.tryClamber(h, h.face)) { h.vy = -JUMPV; h.ground = false; h.jumped = true; this.sfx('jump'); this.fx('dust', h.x, h.y, 4); }
    }
    // assist: pressing into soft soil digs it
    if (h.id === 'enzo' && mv && h.ground && this.assist) {
      const c = this.world;
      if (c.cellAt(h.x + mv * (h.w / 2 + 6), h.y - 30) === 2 || c.cellAt(h.x + mv * (h.w / 2 + 6), h.y - 8) === 2) {
        h.pushT += dt; if (h.pushT > 0.28) { h.pushT = 0; this.dig(h, d); }
      } else h.pushT = 0;
    }
    if (h.ducking && this.room.duck) this.room.duck(this, h);
    this.physics(h, dt);
    // assist: pushing into a low ledge climbs it
    if (this.assist && mv && h.ground && h.blocked > 0.22 && h.state === 'free') { h.blocked = 0; this.tryClamber(h, mv); }
  }
  tryClamber(h: Hero, dir: number) {
    const W = this.world, fx = h.x + dir * (h.w / 2 + 10);
    if (!W.boxHits(fx, h.y, 6, 20)) return false;
    for (let up = 16; up <= CLAMBER; up += 4) {
      const nx = h.x + dir * (h.w / 2 + 12);
      if (!W.boxHits(nx, h.y - up, h.w, h.h) && W.boxHits(nx, h.y - up + 6, h.w, 6) && !W.boxHits(h.x, h.y - up, h.w, h.h)) {
        h.state = 'clamber'; h.clT = 0.32; h.clY = h.y - up; h.clX = nx; h.vx = 0; h.vy = 0;
        this.sfx('jump'); this.fx('dust', h.x + dir * 20, h.y - up, 5); return true;
      }
    }
    return false;
  }
  /** climbable things (room 1's sapling) are described by the room */
  tryClimb(h: Hero) {
    const c = this.room.climb; if (!c || h.id !== 'dora' || h.state !== 'free' || !c.ready(this)) return false;
    if (Math.abs(h.x - c.x) < 34 && h.y > c.top + 20 && h.y <= c.bottom + 2) { h.state = 'climb'; h.y -= 4; h.vx = 0; h.vy = 0; return true; }
    return false;
  }
  climb(h: Hero, d: Dirs, jumpP: boolean, dt: number) {
    const c = this.room.climb!; h.x += (c.x - h.x) * Math.min(1, dt * 12);
    const v = (d.u ? -1 : 0) + (d.d ? 1 : 0);
    h.y += v * 150 * dt; h.vy = 0; if (v) h.walkT += dt;
    h.moving = !!v;
    if (h.y <= c.top + 6) { h.state = 'clamber'; h.clT = 0.28; h.clY = c.exitY; h.clX = c.exitX; h.face = 1; this.sfx('jump'); }
    else if (h.y >= c.bottom && v > 0) { h.y = c.bottom; h.state = 'free'; }
    else if ((d.l || d.r || jumpP) && h.y > c.bottom - 30) h.state = 'free';
  }
  physics(h: Hero, dt: number) {
    const W = this.world;
    if (h.vx) {
      const nx = h.x + h.vx * dt;
      if (!W.boxHits(nx, h.y, h.w, h.h)) { h.x = nx; h.blocked = 0; }
      else {
        let up = 0; if (h.ground) for (let k = 4; k <= 20; k += 4) if (!W.boxHits(nx, h.y - k, h.w, h.h)) { up = k; break; }
        if (up) { h.x = nx; h.y -= up; } else { h.vx = 0; h.blocked += dt; }
      }
      h.walkT += dt * Math.abs(h.vx) / h.speed;
    }
    h.x = Math.max(20, Math.min(WW - 20, h.x));
    h.vy = Math.min(h.vy + GRAV * dt, 1400);
    const ny = h.y + h.vy * dt, wasGround = h.ground;
    if (h.vy >= 0) {
      if (W.boxHits(h.x, ny + 1, h.w - 6, 4) || this.platform(h, ny)) {
        let yy = h.y; while (!W.boxHits(h.x, yy + 1, h.w - 6, 4) && !this.platform(h, yy + 1) && yy < ny) yy += 1;
        h.y = yy;
        if (!wasGround && h.vy > 300) { h.landT = 0.14; this.sfx('land'); this.fx('dust', h.x, h.y, 5); if (h.jumped && this.room.landed) this.room.landed(this, h); }
        h.vy = 0; h.ground = true; h.jumped = false;
      } else {
        let snapped = false;
        if (wasGround && h.vy < 400) for (let k = 1; k <= 14; k++) if (W.boxHits(h.x, h.y + k + 1, h.w - 6, 4) || this.platform(h, h.y + k + 1)) { h.y += k; h.vy = 0; snapped = true; break; }
        if (!snapped) { h.y = ny; h.ground = false; }
      }
    } else {
      if (W.boxHits(h.x, ny, h.w - 8, h.h)) h.vy = 0; else h.y = ny;
      h.ground = false;
    }
    h.moving = Math.abs(h.vx) > 1;
    h.landT -= dt;
  }

  // ───────────────────────────── actions
  tryAct(h: Hero, d: Dirs) {
    if (this.room.tryAct && this.room.tryAct(this, h, d)) return true;
    if (h.id === 'dora') { if (h.ground) { this.startAct(h, 'stamp', 0.45); return true; } return false; }
    this.dig(h, d); return true;
  }
  dig(h: Hero, d: Dirs | null) {
    if (h.state !== 'free' && h.state !== 'act') return;
    // facing away from the only diggable soil nearby? turn round first (forgiving for small hands)
    const soft = (dir: number) => [h.y - 70, h.y - 40, h.y - 12].some((y) => this.world.cellAt(h.x + dir * (h.w / 2 + 14), y) === 2);
    if (!(d && (d.u || d.d)) && !soft(h.face) && soft(-h.face)) h.face = -h.face;
    let px = h.x + h.face * (h.w / 2 + 14), py = h.y - 40;
    if (d && d.u) { px = h.x + h.face * 8; py = h.y - h.h - 12; }
    else if (d && d.d) { px = h.x + h.face * 6; py = h.y + 10; }
    this.startAct(h, 'dig', 0.3); const a = h.act!; a.px = px; a.py = py; a.side = !(d && (d.u || d.d));
  }
  actTick(h: Hero, a: Act) {
    if (a.name === 'stamp' && !a.fired && a.t > a.dur * 0.55) {
      a.fired = true; this.sfx('stamp'); this.shake = 4; this.fx('dust', h.x + h.face * 10, h.y, 8); this.stats.stamps++;
      if (this.room.stamped) this.room.stamped(this, h);
      return;
    }
    if (a.name === 'dig' && !a.fired && a.t > 0.12) {
      a.fired = true; const W = this.world, px = a.px!, py = a.py!;
      let n = W.dig(px, py, 20);
      if (a.side) n += W.dig(px, py + 26, 18) + W.dig(px, py - 26, 18) + W.dig(px, py - 50, 16);
      if (n) { this.sfx('dig'); this.stats.digs++; } else { this.fx('dust', px, py + 10, 2); if (this.room.dugNothing) this.room.dugNothing(this, h, a); }
      return;
    }
    if (this.room.actTick) this.room.actTick(this, h, a);
  }

  // ───────────────────────────── the leaf: rests on the basin floor, floats on the water, Enzo paddles it
  ride(h: Hero, d: Dirs, dt: number) {
    const l = this.o.leaf!; h.state = 'ride';
    const mv = (d.r ? 1 : 0) - (d.l ? 1 : 0);
    l.x += mv * 90 * dt; if (mv) h.face = mv;
    if (this.assist && !mv) l.x += Math.sign(l.driftX - l.x) * Math.min(Math.abs(l.driftX - l.x), 40 * dt);
    l.x = Math.max(l.minX, Math.min(l.maxX, l.x));
    h.x = l.x + 4; h.y = l.y - 6; h.moving = !!mv; if (mv) h.walkT += dt;
    const high = l.y <= l.exitY + 10, idleOff = this.assist && !this.heroInput(h) && h.auto != null && h.auto > l.maxX;
    if (high && h.x > l.maxX - 58 && (mv > 0 || idleOff)) {
      h.state = 'clamber'; h.clT = 0.3; h.clX = l.exitX; h.clY = l.exitY; this.sfx('jump'); if (this.room.rodeOff) this.room.rodeOff(this, h, 1);
    } else if (high && l.exitLX != null && h.x < l.minX + 58 && mv < 0) {
      h.state = 'clamber'; h.clT = 0.3; h.clX = l.exitLX; h.clY = l.exitY; this.sfx('jump'); if (this.room.rodeOff) this.room.rodeOff(this, h, -1);
    }
  }
  platform(h: Hero, ny: number) {
    if (this.room.platform && this.room.platform(this, h, ny)) return true;
    const l = this.o.leaf; if (!l || h.id !== 'enzo') return false;
    return Math.abs(h.x - l.x) < 56 && ny >= l.y - 6 && h.y <= l.y - 4 && h.vy >= 0;
  }
  private leafUpdate(dt: number) {
    const l: Leaf | undefined = this.o.leaf; if (!l) return;
    const E = this.heroes.enzo, Wt = this.world.water, r = Wt.rect!;
    l.bob += dt; const wet = Wt.level < l.floorY - 4;
    l.y = Math.min(l.floorY, Wt.level - 2) + (wet ? Math.sin(l.bob * 2.2) * 1.5 : 0);
    const inBasin = E.x > r[0] + 6 && E.x < r[2] - 6;
    if (wet && inBasin && E.state !== 'ride' && E.state !== 'clamber' && E.state !== 'hurt' && E.y > Wt.level + 10) {
      l.x = Math.max(l.minX, Math.min(l.maxX, E.x)); E.state = 'ride'; this.fx('splash', E.x, Wt.level, 6); this.sfx('splash');
    }
    if (wet && inBasin && E.state === 'free' && Math.abs(E.x - l.x) < 56 && Math.abs(E.y - (l.y - 6)) < 10) E.state = 'ride';
    if (!wet && E.state === 'ride') { E.state = 'free'; E.vy = 0; }   // drained: step off the grounded leaf
  }

  // ───────────────────────────── the hawk: a real (still gentle) threat. Its shadow sweeps the open meadow; if it
  // finds Dora in the open it carries her back to the start of the stretch. Bushes and bolt-holes hide her (hold down).
  private hawk(dt: number, D: Hero) {
    const k = this.o.hawk, cfg = this.room.hawk; if (!cfg) return;
    if (!k.on) { if (cfg.active(this)) { k.on = true; k.next = 1.4; } else return; }
    if (!cfg.active(this) && k.phase === 'wait') return;
    k.t += dt;
    const hid = cfg.cover(this, D); D.hidden = D.hidden || hid;
    const ctl = this.heroInput(D);
    // assist: the hero nobody steers ducks into cover by herself when the hawk calls
    D.autoDuck = !ctl && this.assist && (k.phase === 'warn' || k.phase === 'pass') && cfg.canHide(this, D);
    if (k.phase === 'wait') {
      k.next -= dt;
      if (k.next <= 0) {
        k.phase = 'warn'; k.t = 0; this.sfx('hawk'); k.dir = 1;
        // wordless: the other hero points at cover
        const E = this.heroes.enzo; if (cfg.coverIcon && !D.hidden && D.x > cfg.x0 - 40 && E.state === 'free') { E.cue = 'point'; E.cueT = 1.4; this.bubble(E, cfg.coverIcon); }
      }
    } else if (k.phase === 'warn') { if (k.t > (this.assist ? 1.5 : 1.1)) { k.phase = 'pass'; k.t = 0; k.pass++; } }
    else if (k.phase === 'pass') {
      const dur = 2.3; k.x = cfg.x0 - 200 + (k.t / dur) * (cfg.x1 - cfg.x0 + 500);
      const sx = k.x + 20;
      if (D.state !== 'carried' && D.state !== 'hurt' && !D.hidden && D.x > cfg.x0 && D.x < cfg.x1 && Math.abs(D.x - sx) < 60 && D.y < cfg.groundMax) {
        if (D.state === 'brace') this.endBrace(D, false);
        D.state = 'carried'; D.act = null; D.carryT = 0; D.dropX = Math.max(cfg.homeX, D.x - 260); D.vx = D.vy = 0; this.stats.hawkCatches++;
        this.sfx('hurt'); this.sfx('hawk'); this.shake = 6;
      }
      if (k.t > dur) { k.phase = 'wait'; k.next = (this.assist ? 5.5 : 4.2) + (cfg.gap ? cfg.gap(this) : 0); k.x = -400; }
    }
    if (D.state === 'carried') {   // swept up, flown back, set down gently at the start of the stretch
      D.carryT += dt; const T = D.carryT;
      if (T < 0.5) { D.y -= 260 * dt; D.x += 160 * dt; }
      else if (T < 1.6) { D.y = Math.max(cfg.homeY - 220, D.y - 200 * dt); D.x += (D.dropX - D.x) * Math.min(1, dt * 3); }
      else { D.state = 'hurt'; D.hurtT = 0.4; D.vx = 0; D.vy = 60; D.x = D.dropX; this.fx('leaves', D.x, D.y - 40, 6); }
    }
  }
  shadowX() { const k = this.o.hawk; return k && k.phase === 'pass' ? k.x + 20 : -999; }
  private updateRoom(dt: number) {
    this.roomT += dt;
    this.world.update(dt); this.leafUpdate(dt);
    const D = this.heroes.dora; D.hidden = false; D.inBush = false;
    this.room.update(this, dt);
    if (this.mode !== 'play') return;
    this.hawk(dt, D);
    const b = this.cur();
    if (b && b.id === 'exit' && !this.leaving) {
      const ok = (h: Hero) => h.x > 1440 && h.state !== 'carried';
      if (ok(D) && ok(this.heroes.enzo)) this.leave();
    }
    if (this.leaving) { this.leaving += dt; if (this.leaving > 0.7) this.next(); }
  }

  // ───────────────────────────── hints
  private hints(dt: number) {
    const b = this.cur(); if (!b || this.mode !== 'play' || this.leaving) return;
    this.beatT += dt; this.hintT += dt;
    const D = this.heroes.dora, E = this.heroes.enzo;
    const need = this.heroes[this.needFor(b)], other = need === D ? E : D;
    this.need = need.id;
    const icon = (this.room.icon && this.room.icon(this, b)) || b.icon;
    if (this.hintT > 4 && other.state === 'free' && !other.moving && !this.heroInput(other)) {
      this.hintT = 0; other.cue = 'point'; other.cueT = 1.6; this.sfx('call', other.id === 'dora' ? 1 : 0); this.bubble(other, icon);
    }
    if (!this.twoP && this.active !== need.id && this.hintT > 2.5 && (need.state === 'free' || need.state === 'brace') && !need.cue) {
      this.hintT = 0; need.cue = 'call'; need.cueT = 1.4; this.sfx('call', need.id === 'dora' ? 1 : 0); this.bubble(need, icon, true);
    }
    const idle = this.t - this.lastInput;
    this.showKeys = idle > 7 || this.braceHint(b, need, other);
    if (this.assist && !b.noGhost && (this.beatT > 24 || (idle > 12 && this.beatT > 12))) { if (this.ghostT === 0) this.stats.ghosts++; this.ghostT += dt; } else this.ghostT = 0;
    if (this.showKeys && !this.keysCounted) { this.keysCounted = true; this.stats.keyPrompts++; this.keysOn = this.t; }
    if (!this.showKeys) this.keysCounted = false;
  }
  /** contextual prompts for the hand-off verb (hold, swap while holding, hold again): shown at once, not after idling */
  private braceHint(b: Beat, need: Hero, other: Hero) {
    const r = this.route(need, b);
    if (!this.twoP && other.state === 'brace' && this.active === other.id && other.brace!.t > 0.6) return true;
    if (r.act === 'hold' && Math.abs(need.x - r.tx) < 46 && need.state !== 'brace' && (other.state === 'brace' || this.t - need.quickT < 4)) return true;
    return false;
  }
  private autoHelp() {
    const st = this.room.stations ? this.room.stations(this) : { dora: null, enzo: null };
    for (const id of ['dora', 'enzo'] as const) {
      const h = this.heroes[id];
      h.auto = (!this.twoP && this.assist && this.active !== id && st[id] != null) ? st[id] : null;
      h.autoJump = false;
    }
    if (this.room.helpers) this.room.helpers(this);
  }
  /** which key the player should press now (the scene shows it after 7 s of idling) */
  prompt(): Prompt | null {
    const b = this.cur(); if (!b) return null;
    const N = this.heroes[this.need]; if (!N) return null;
    if (!this.twoP && this.active !== N.id) return { who: this.active, what: 'swap', dir: 0, hold: false };
    const r = this.route(N, b), dx = r.tx - N.x;
    if ((r.act === 'act' || r.act === 'hold') && Math.abs(dx) < 36) return { who: N.id, what: 'act', dir: 0, hold: r.act === 'hold' };
    if (r.act === 'up' && Math.abs(dx) < 30) return { who: N.id, what: 'up', dir: 0, hold: false };
    if (r.act === 'down' && Math.abs(dx) < 24) return { who: N.id, what: 'down', dir: 0, hold: false };
    if (Math.abs(dx) > 20) return { who: N.id, what: 'move', dir: Math.sign(dx), hold: false };
    return null;
  }
  /** the glinting spots for the current beat (plus a bush when the hawk calls) */
  glints(): [number, number][] {
    const b = this.cur(); if (!b || this.mode !== 'play') return [];
    const spots = this.room.glints ? this.room.glints(this, b).slice() : [];
    const k = this.o.hawk, cfg = this.room.hawk;
    if (cfg && cfg.coverAt && k.on && k.phase === 'warn') spots.push(cfg.coverAt(this, this.heroes.dora));
    return spots;
  }
  focusPts(): [number, number][] { return this.room.focusPts ? this.room.focusPts(this) : []; }

  // ───────────────────────────── which painted frame to show
  heroFrame(h: Hero): string {
    const p = h.id[0] + '_';
    if (h.state === 'win') return p + (Math.floor(h.t * 3) % 2 ? 'win1' : 'win2');
    if (h.state === 'hurt' || h.state === 'carried') return p + 'hurt';
    if (h.state === 'clamber') return p + (h.id === 'dora' ? 'climb1' : 'climb');
    if (h.state === 'climb') return p + (h.id === 'dora' ? (Math.floor(h.walkT * 5) % 2 ? 'climb1' : 'climb2') : 'climb');
    if (h.state === 'ride') return h.moving ? 'e_ride' : (Math.floor(h.t * 1.2) % 3 === 0 ? 'e_idle' : 'e_ride');
    if (h.state === 'brace' && h.brace) {
      const b = h.brace, strain = Math.floor(h.t * 4) % 2;
      if (b.name === 'hold') return h.id === 'enzo' ? 'e_hold' : 'd_lever';
      if (b.name === 'lever') return 'd_lever';
      if (b.name === 'pull') return p + (strain ? 'rope2' : 'rope1');
    }
    if (h.state === 'act' && h.act) {
      const a = h.act, k = a.t / a.dur;
      if (a.name === 'pull') return k < 0.45 ? 'd_pull1' : 'd_pull2';
      if (a.name === 'stamp') return k < 0.55 ? 'd_stamp1' : 'd_stamp2';
      if (a.name === 'dig') return k < 0.5 ? 'e_dig1' : 'e_dig2';
      if (a.name === 'heave') return k < 0.45 ? 'e_heave1' : 'e_heave2';
      if (a.name === 'water') return k < 0.15 ? 'e_idle' : 'e_water';
      if (a.name === 'tired') return p + 'tired';
      if (a.name === 'dust') return 'e_dust';
    }
    if (!h.ground) {
      if (this.room.dodgy && Math.abs(h.vx) > 1) return p + 'dodge';
      return p + (h.vy < 0 ? 'jump' : 'land');
    }
    if (h.landT > 0) return p + 'land';
    if (h.ducking) return h.id === 'dora' && h.inBush ? 'd_hide' : p + 'duck';
    if (h.moving) return p + ['walk1', 'walk3', 'walk2', 'walk4'][Math.floor(h.walkT * 7.5) % 4];
    if (h.cue === 'call') return p + (Math.floor(h.t * 3) % 2 ? 'call' : 'wave');
    if (h.cue) return p + h.cue;
    if (h.idleT > 14) return p + (Math.floor(h.idleT / 3) % 3 === 2 ? 'wait2' : 'wait1');
    if (h.idleT > 7) return p + 'wait1';
    if (h.id === 'dora' && (h.t % 4.3) < 0.14) return 'd_blink';
    return p + 'idle';
  }
  /** the ghost demo: where the hero who should act walks to, and the pose it strikes there (null when no ghost) */
  ghost(): { who: HeroId; x: number; y: number; frame: string; face: number; alpha: number } | null {
    if (!this.ghostT || this.mode !== 'play') return null;
    const b0 = this.cur(); if (!b0) return null;
    const h = this.heroes[this.need], b = this.route(h, b0);
    const T = this.ghostT % 3.2, walk = Math.min(1, T / 1.7), p = h.id[0] + '_';
    let f = T < 1.7 ? p + ['walk1', 'walk3', 'walk2', 'walk4'][Math.floor(T * 7.5) % 4] : p + 'idle';
    if (T >= 1.7) f = ({ climb: 'd_climb1', dig: 'e_dig1', ride: 'e_ride', bridge: 'e_hold', ropes: p + 'rope1', lever: 'd_lever', clay: 'd_stamp2' } as Record<string, string>)[b.id] || (b0.ghost && b0.ghost[0] === p[0] ? b0.ghost : f);
    if (Math.abs(b.tx - h.x) < 4 && T < 1.7) f = p + 'idle';
    return { who: h.id, x: h.x + (b.tx - h.x) * walk, y: h.y + (b.ty - h.y) * walk, frame: f, face: b.tx >= h.x ? 1 : -1, alpha: 0.5 * Math.min(1, this.ghostT) };
  }

  /** a plain snapshot for bots and the browser tests */
  snapshot() {
    const hs = (x: Hero) => ({ x: Math.round(x.x), y: Math.round(x.y), state: x.state, frame: this.heroFrame(x), ground: x.ground, face: x.face, hidden: x.hidden,
      idleT: +x.idleT.toFixed(1), brace: x.brace ? x.brace.name : null, grace: x.brace ? +x.brace.grace.toFixed(1) : null });
    const b = this.cur(), o = this.o, R = this.room;
    const need = b ? this.needFor(b) : null, rt = b && need ? this.route(this.heroes[need], b) : null;
    const p = this.showKeys ? this.prompt() : null, gb = o.gb;
    return {
      mode: this.mode, t: +this.t.toFixed(2), twoP: this.twoP, assist: this.assist, active: this.active, room: R.id, roomI: this.idx, beat: this.beat, beatId: b ? b.id : 'done', need,
      target: rt && need ? { who: need, x: Math.round(rt.tx), y: Math.round(rt.ty), act: rt.act, id: rt.id } : null,
      routes: b ? { dora: this.route(this.heroes.dora, b), enzo: this.route(this.heroes.enzo, b) } : null,
      dora: hs(this.heroes.dora), enzo: hs(this.heroes.enzo), water: Math.round(this.world.water.level),
      leaf: o.leaf ? { x: Math.round(o.leaf.x), y: Math.round(o.leaf.y) } : null,
      sluice: o.sluice ? !!o.sluice.open : null, sapling: o.sapling ? o.sapling.stage : null, flag: o.flag ? o.flag.cracks : null, bug: o.bug ? o.bug.state : null,
      caps: o.caps ? o.caps.map((c) => c.gone) : null, lift: o.lift != null ? +o.lift.toFixed(2) : null, rope: o.rope != null ? +o.rope.toFixed(2) : null, gatesUp: o.gatesUp ?? null,
      clayFace: R.faceX ? R.faceX(this) : null, loose: R.loose ? R.loose(this) : null,
      boss: gb ? { st: gb.st, hp: gb.hp, x: Math.round(gb.x), nx: Math.round(gb.nx), t: +gb.t.toFixed(2), tell: gb.tell, wave: o.wave ? Math.round(o.wave.x) : null, clods: (o.clods ?? []).filter((c) => !c.done).map((c) => Math.round(c.x)) } : null,
      hawk: { on: o.hawk.on, phase: o.hawk.phase, shadowX: Math.round(this.shadowX()) },
      glints: this.glints().map((a) => a.map(Math.round)), calls: this.bubbles.map((x) => ({ who: x.who, calling: x.calling, icon: x.icon })),
      prompt: p, showKeys: this.showKeys, ghost: this.ghostT > 0,
      ghostAt: this.ghostT > 0 && rt && need ? { who: need, x: Math.round(rt.tx), y: Math.round(rt.ty) } : null,
      leaving: this.leaving > 0, card: this.card ? this.card.name : null, clearT: +this.clearT.toFixed(1), stats: this.stats,
    };
  }
}
export type Snapshot = ReturnType<AboveGame['snapshot']>;

// Snowdrift's rules: a one-button momentum sledding game. Dora and Enzo share one sled and race the sunset across
// seven snowy valleys. Holding the button on the ground makes them heavy (they tuck and press down), which pulls hard
// down a slope and a little against a climb; letting go makes them light, so a crest throws them into the air.
// Landing along a downslope is a Smooth landing (a boost, and three in a row start a Snow Flurry); holding in the air
// turns a slow backflip, and a full flip landed upright is a big boost, but landing at a bad angle is a tumble.
// The dusk creeps up from behind; cocoa pushes it back, and reaching the lodge flag ends the day in triumph.
// Deterministic at a fixed 60 ticks a second (two physics steps a tick) with no DOM and no randomness: the same
// inputs always give the same run, which is how the tests replay one exactly.
import { VALLEYS, VALLEY_IDS, buildDay, Endless, type Course, type ValleyId, type Valley, type Ground } from './snowdrift-terrain.js';

export { VALLEYS, VALLEY_IDS, buildDay, Endless, validateCourse, rng, ARC_G, type Course, type ValleyId, type Valley, type Zone, type Pickup } from './snowdrift-terrain.js';

// ---------------------------------------------------------------- numbers
export const TPS = 60, DT = 1 / TPS, SUB = 2, H = DT / SUB;
export const SAVE_KEY = 'snowdrift-v1';
/** The pull of the snow-covered world, in units a second squared. */
export const G = 22;
/** Holding on the ground: how much heavier the pair are going down a slope, going up one, and pressing into it. */
export const TUCK_DOWN = 1.7, TUCK_UP = 0.5, TUCK_PRESS = 1.25;
/** In the air the pair are a little lighter (the lighter runners lighten them more). */
export const AIR_G = 0.72;
/** Snow friction (times the press into the ground), ice friction, and air drag. */
export const MU = 0.055, MU_ICE = 0.006, DRAG = 0.0011;
/** They always paddle along at least this fast, and the sled tops out here. */
export const MIN_SPEED = 5, MAX_SPEED = 44;
/** Backflips: how fast the spin builds while you hold in the air, its top speed, and how fast it settles once you let go. */
export const SPIN_ACC = 18, SPIN_MAX = 8, SPIN_DAMP = 26;
/** A short hop never spins: holding only turns a flip once they have been in the air this long. */
export const SPIN_AFTER = 0.12;
/** Landing: more than this far off the slope is a tumble; a Smooth landing needs the flight to meet a downslope within this. */
export const TUMBLE_ANGLE = 0.95, SMOOTH_ANGLE = 0.34, SMOOTH_SLOPE = -0.07;
export const SMOOTH_BOOST = 2.4, FLIP_BOOST = 6.5;
/** A tumble keeps this much of the speed and lasts this long. */
export const TUMBLE_KEEP = 0.4, TUMBLE_TIME = 1.1;
/** Three smooth landings in a row start a Snow Flurry: extra push, a higher top speed. */
export const FLURRY_CHAIN = 3, FLURRY_ACC = 6, FLURRY_TOP = 6;
/** Wind in the gusts: lift in the air (a share of the pull), and a push along. */
export const WIND_LIFT = 0.42, WIND_PUSH = 4.5;
/** Hitting a cave roof keeps this much speed. */
export const BONK_KEEP = 0.86;
/** A fall into a gap: how long until you are back at the top of the run, and the speed you start with. */
export const FALL_TIME = 1.2, RESPAWN_SPEED = 7;
/** The sled's runner-to-head height (for cave roofs) and how close a pickup must pass. */
export const TOP = 2.3, REACH = 1.7;
/** The endless hills: the dusk's head start and pace, which quickens a little the further you go. */
export const ENDLESS_HEAD = 6, ENDLESS_DUSK = 17, ENDLESS_DUSK_MAX = 34, ENDLESS_RAMP = 300;

// ---------------------------------------------------------------- the lodge shop
export type UpgradeId = 'wax' | 'scarf' | 'thermos' | 'runners';
export const UPGRADE_IDS: UpgradeId[] = ['wax', 'scarf', 'thermos', 'runners'];
export const MAX_LEVEL = 3;
export const UPGRADES: Record<UpgradeId, { name: string; icon: string; blurb: string; cost: number[]; values: number[]; unit: string }> = {
  wax: { name: 'Sled wax', icon: '🕯', blurb: 'Less friction on the snow.', cost: [30, 70, 130], values: [1, 0.9, 0.82, 0.75], unit: '× friction' },
  scarf: { name: 'Woolly scarf', icon: '🧣', blurb: 'A longer Snow Flurry.', cost: [30, 70, 130], values: [4, 5, 6, 7], unit: 's flurry' },
  thermos: { name: 'Bigger thermos', icon: '☕', blurb: 'Each cocoa pushes the sunset back further.', cost: [30, 70, 130], values: [3, 4, 5, 6], unit: 's per cocoa' },
  runners: { name: 'Lighter runners', icon: '🛷', blurb: 'Lighter in the air, for longer flights.', cost: [30, 70, 130], values: [1, 0.96, 0.93, 0.9], unit: '× air pull' },
};
export type Levels = Record<UpgradeId, number>;
export const noUpgrades = (): Levels => ({ wax: 0, scarf: 0, thermos: 0, runners: 0 });
export const upgradeValue = (id: UpgradeId, lv: Levels) => UPGRADES[id].values[Math.max(0, Math.min(MAX_LEVEL, lv[id] | 0))];

// ---------------------------------------------------------------- events
export type Ev =
  | { k: 'go' }
  | { k: 'takeoff'; v: number }
  | { k: 'land'; v: number; impact: number; smooth: boolean; flips: number; chain: number; air: number }
  | { k: 'tumble'; v: number }
  | { k: 'flurry'; on: boolean }
  | { k: 'bonk' }
  | { k: 'fall' }
  | { k: 'respawn' }
  | { k: 'flake'; x: number; y: number }
  | { k: 'cocoa'; x: number; y: number; push: number }
  | { k: 'gust'; on: boolean }
  | { k: 'finish'; spare: number; ticks: number }
  | { k: 'caught' };

export type Phase = 'ready' | 'ride' | 'fall' | 'finish' | 'caught';
export type Mode = { kind: 'day'; valley: ValleyId } | { kind: 'endless'; seed: number; daily: boolean };
const wrap = (a: number) => { a %= Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };
const approach = (v: number, to: number, d: number) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));

export class SnowGame {
  mode: Mode; course: Course; valley: Valley | null; levels: Levels;
  private endless: Endless | null = null;
  phase: Phase = 'ready';
  /** Ticks since the push-off. */
  t = 0;
  x = 0; y = 0; vx = 0; vy = 0;
  /** Speed along the slope while on the ground. */
  s = 0;
  /** The sled's angle (radians, nose up is positive) and its spin. */
  ang = 0; spin = 0; omega = 0;
  air = false; airT = 0;
  /** Held this tick, and whether the hold began before this flight (a hold carried off the ground never spins). */
  held = false;
  tumbleT = 0; flurryT = 0; chain = 0; fallT = 0;
  /** The edge of the dusk, and its pace. */
  duskX = 0; duskV = 0;
  flakes = 0; cocoa = 0; cocoaTotal = 0;
  got: Uint8Array;
  smooths = 0; flips = 0; tumbles = 0; falls = 0; bestAir = 0; maxSpeed = 0;
  finishT = 0; spare = 0;
  /** The pace of the last gust zone and of the flurry, for the scene. */
  inWind = false; onIce = false; underRoof = false;
  events: Ev[] = [];
  private pick0 = 0;
  private respawnAt = 0;
  private g: Ground = { y: 0, m: 0, k: 0 };

  constructor(mode: Mode, levels: Levels = noUpgrades()) {
    this.mode = mode; this.levels = { ...levels };
    if (mode.kind === 'day') {
      this.valley = VALLEYS[mode.valley];
      this.course = buildDay(mode.valley);
      this.duskX = -this.valley.head * this.valley.dusk; this.duskV = this.valley.dusk;
    } else {
      this.valley = null;
      this.endless = new Endless(mode.seed);
      this.course = this.endless.c;
      this.duskX = -ENDLESS_HEAD * ENDLESS_DUSK; this.duskV = ENDLESS_DUSK;
    }
    this.got = new Uint8Array(Math.max(64, this.course.pickups.length * 2));
    this.cocoaTotal = this.course.pickups.filter((p) => p.kind === 'cocoa').length;
    this.x = this.course.start; this.y = this.course.height(this.x); this.s = 0;
  }
  get lodge() { return this.course.lodge; }
  /** How far along the day is (0 at the start, 1 at the lodge). */
  get progress() { return Number.isFinite(this.lodge) ? Math.max(0, Math.min(1, this.x / this.lodge)) : 0; }
  get speed() { return this.air ? Math.hypot(this.vx, this.vy) : this.s; }
  /** Seconds until the dusk reaches the sled at its current pace. */
  get daylight() { return Math.max(0, (this.x - this.duskX) / this.duskV); }
  /** The time of day the sky shows: 0 at dawn, 1 at nightfall, from how far the dusk has come. */
  get dayTime() {
    if (!Number.isFinite(this.lodge)) return 0.92;
    const back = this.valley ? this.valley.head * this.valley.dusk : 0;
    return Math.max(0, Math.min(1, (this.duskX + back) / (this.lodge + back)));
  }
  get distance() { return Math.max(0, Math.floor(this.x - this.course.start)); }
  get done() { return this.phase === 'finish' || this.phase === 'caught'; }
  get tumbling() { return this.tumbleT > 0; }
  get flurry() { return this.flurryT > 0; }
  /** Got pickup i? */
  has(i: number) { return this.got[i] === 1; }
  /** The three medals for this day: the lodge, every cocoa, and daylight to spare. */
  medals(): [boolean, boolean, boolean] {
    const v = this.valley; if (!v) return [false, false, false];
    const fin = this.phase === 'finish';
    return [fin, fin && this.cocoa >= this.cocoaTotal, fin && this.spare >= v.spare];
  }

  step(hold: boolean) {
    const ev = this.events;
    if (this.phase === 'ready') {
      if (hold) { this.phase = 'ride'; this.s = 6; ev.push({ k: 'go' }); }
      this.held = hold;
      return;
    }
    if (this.phase === 'finish') { this.coast(); return; }
    if (this.phase === 'caught') return;
    this.t++;
    // the dusk creeps on (on the endless hills it quickens a little with distance)
    if (this.endless) {
      this.duskV = Math.min(ENDLESS_DUSK_MAX, ENDLESS_DUSK + Math.max(0, this.x) / ENDLESS_RAMP);
      this.endless.extend(this.x + 400);
      if (this.got.length < this.course.pickups.length) { const g = new Uint8Array(this.course.pickups.length * 2); g.set(this.got); this.got = g; }
    }
    this.duskX += this.duskV * DT;
    if (this.phase === 'fall') {
      this.fallT -= DT;
      if (this.fallT <= 0) this.respawn();
      this.held = hold;
      return;
    }
    if (this.tumbleT > 0) this.tumbleT = Math.max(0, this.tumbleT - DT);
    if (this.flurryT > 0) { this.flurryT = Math.max(0, this.flurryT - DT); if (this.flurryT === 0) ev.push({ k: 'flurry', on: false }); }
    const press = hold && this.tumbleT <= 0;
    const fresh = hold && !this.held;
    this.held = hold;
    void fresh;
    for (let i = 0; i < SUB && (this.phase === 'ride'); i++) { if (this.air) this.flyStep(press); else this.groundStep(press); }
    this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    this.pickups();
    if (this.phase === 'ride' && this.x >= this.lodge) {
      this.phase = 'finish'; this.finishT = this.t;
      this.spare = Math.max(0, (this.lodge - this.duskX) / this.duskV);
      if (this.flurryT > 0) { this.flurryT = 0; ev.push({ k: 'flurry', on: false }); }
      ev.push({ k: 'finish', spare: this.spare, ticks: this.t });
      return;
    }
    if (this.phase === 'ride' && this.duskX >= this.x - 0.5) {
      this.phase = 'caught';
      if (this.flurryT > 0) { this.flurryT = 0; ev.push({ k: 'flurry', on: false }); }
      ev.push({ k: 'caught' });
    }
  }

  /** After the lodge flag: slow to a stop on the level yard. */
  private coast() {
    const g = this.course.ground(this.x, this.g);
    if (this.air) { this.flyStep(false); this.flyStep(false); return; }
    this.s = Math.max(0, this.s - (8 + this.s * 0.6) * DT);
    if (g) { const c = 1 / Math.hypot(1, g.m); this.x += this.s * c * DT; const g2 = this.course.ground(this.x, this.g); if (g2) { this.y = g2.y; this.ang = Math.atan(g2.m); } }
  }

  private groundStep(press: boolean) {
    const c = this.course, h = H;
    const g = c.ground(this.x, this.g);
    if (!g) { this.takeoff(this.s, this.ang); return; }
    const cos = 1 / Math.hypot(1, g.m), sin = g.m * cos;
    const ice = c.isIce(this.x); this.onIce = ice;
    const wind = !!c.zoneAt(this.x, 'wind');
    // heavy when held: a strong pull down a slope, a little extra drag up one, and a firmer press into the snow
    const pull = press ? (sin < 0 ? 1 + TUCK_DOWN : 1 + TUCK_UP) : 1;
    const pressN = press ? TUCK_PRESS : 1;
    const curve = g.k * cos * cos * cos;
    const N = G * pressN * cos + this.s * this.s * curve;
    if (N < 0 && this.s > 4) { this.takeoff(this.s, Math.atan(g.m)); return; }
    let a = -G * pull * sin;
    const mu = (ice ? MU_ICE : MU) * upgradeValue('wax', this.levels);
    // friction comes from the weight on the runners (not the swoop through a dip), so a fast run keeps its speed
    a -= mu * G * pressN * cos + DRAG * this.s * this.s;
    if (this.flurryT > 0) a += FLURRY_ACC;
    if (wind) a += WIND_PUSH * 0.5;
    if (this.tumbleT > 0) a -= 9;
    const top = MAX_SPEED + (this.flurryT > 0 ? FLURRY_TOP : 0);
    this.s = Math.max(this.tumbleT > 0 ? 2 : MIN_SPEED, Math.min(top, this.s + a * h));
    this.x += this.s * cos * h;
    const g2 = c.ground(this.x, this.g);
    if (!g2) { this.takeoff(this.s, Math.atan(g.m)); return; }
    this.y = g2.y; this.ang = Math.atan(g2.m);
  }

  private takeoff(s: number, ang: number) {
    this.air = true; this.airT = 0; this.spin = 0; this.omega = 0;
    this.vx = s * Math.cos(ang); this.vy = s * Math.sin(ang);
    this.y += 0.02;
    this.events.push({ k: 'takeoff', v: s });
  }

  private flyStep(press: boolean) {
    const c = this.course, h = H;
    this.airT += h;
    const wind = !!c.zoneAt(this.x, 'wind');
    if (wind !== this.inWind) { this.inWind = wind; this.events.push({ k: 'gust', on: wind }); }
    const pull = G * AIR_G * upgradeValue('runners', this.levels) * (wind ? 1 - WIND_LIFT : 1);
    this.vy -= pull * h;
    if (wind) this.vx += WIND_PUSH * h;
    if (this.flurryT > 0) this.vx += FLURRY_ACC * 0.4 * h;
    const sp = Math.hypot(this.vx, this.vy);
    this.vx -= DRAG * 0.6 * sp * this.vx * h; this.vy -= DRAG * 0.6 * sp * this.vy * h;
    this.x += this.vx * h; this.y += this.vy * h;
    // spin: holding (after the first instant of a flight) turns a backflip; letting go settles it
    if (press && this.phase === 'ride' && this.airT > SPIN_AFTER) this.omega = Math.min(SPIN_MAX, this.omega + SPIN_ACC * h);
    else this.omega = approach(this.omega, 0, SPIN_DAMP * h);
    this.ang += this.omega * h; this.spin += this.omega * h;
    if (!press || this.phase !== 'ride') {
      // light in the air, a roughly upright sled noses along its flight, and leans to meet the snow as it comes close
      const below = c.ground(this.x + this.vx * 0.15, this.g), flight = Math.atan2(this.vy, this.vx);
      let want = flight;
      if (below) { const k = Math.max(0, Math.min(1, 1 - (this.y - below.y - 1) / 5)); want = flight + wrap(Math.atan(below.m) - flight) * k; }
      // (a sled that never tried a flip always straightens up in time; one left upside down mid-flip does not)
      const d = wrap(want - this.ang);
      if ((Math.abs(this.spin) < 0.8 || Math.abs(d) < 1.2) && Math.abs(this.omega) < 1) this.ang += Math.max(-3.5 * h, Math.min(3.5 * h, d * 6 * h));
    }
    // the cave roof
    const ceil = c.ceiling(this.x);
    this.underRoof = ceil !== null;
    if (ceil !== null && this.y + TOP > ceil) {
      this.y = ceil - TOP;
      if (this.vy > -1) { this.vy = -1.5; this.vx *= BONK_KEEP; this.chain = 0; this.events.push({ k: 'bonk' }); }
    }
    const g = c.ground(this.x, this.g);
    if (g && this.y <= g.y) { this.land(g); return; }
    if (!g) {
      const z = c.zoneAt(this.x, 'gap');
      if (z && this.y < z.bottom) this.fall(z.respawn);
    }
  }

  private land(g: Ground) {
    const ev = this.events, slope = Math.atan(g.m), cos = Math.cos(slope), sin = Math.sin(slope);
    const along = this.vx * cos + this.vy * sin, impact = Math.max(0, -(this.vy * cos - this.vx * sin));
    const off = wrap(this.ang - slope), flightAng = Math.atan2(this.vy, this.vx);
    const flips = Math.floor((this.spin + 0.9) / (Math.PI * 2));
    const air = this.airT;
    this.air = false; this.y = g.y; this.ang = slope; this.omega = 0; this.spin = 0;
    this.bestAir = Math.max(this.bestAir, air);
    if (Math.abs(off) > TUMBLE_ANGLE) {
      this.s = Math.max(2, along * TUMBLE_KEEP); this.tumbleT = TUMBLE_TIME; this.chain = 0; this.tumbles++;
      ev.push({ k: 'tumble', v: this.s });
      return;
    }
    let s = Math.max(MIN_SPEED, along);
    const smooth = air > 0.3 && slope < SMOOTH_SLOPE && Math.abs(wrap(flightAng - slope)) < SMOOTH_ANGLE && Math.abs(off) < 0.6;
    if (flips > 0) { s += FLIP_BOOST * flips; this.flips += flips; }
    if (smooth) {
      s += SMOOTH_BOOST; this.smooths++; this.chain++;
      if (this.flurryT > 0) this.flurryT = Math.min(upgradeValue('scarf', this.levels) + 2, this.flurryT + 1);
      else if (this.chain >= FLURRY_CHAIN) { this.flurryT = upgradeValue('scarf', this.levels); ev.push({ k: 'flurry', on: true }); }
    } else if (air > 0.3) this.chain = 0;
    this.s = Math.min(MAX_SPEED + (this.flurryT > 0 ? FLURRY_TOP : 0) + FLIP_BOOST, s);
    ev.push({ k: 'land', v: this.s, impact, smooth, flips, chain: this.chain, air });
  }

  private fall(respawn: number) {
    this.phase = 'fall'; this.fallT = FALL_TIME; this.falls++; this.chain = 0;
    this.respawnAt = respawn;
    if (this.flurryT > 0) { this.flurryT = 0; this.events.push({ k: 'flurry', on: false }); }
    this.events.push({ k: 'fall' });
  }
  private respawn() {
    const g = this.course.ground(this.respawnAt, this.g);
    this.phase = 'ride'; this.air = false; this.x = this.respawnAt; this.y = g ? g.y : this.y; this.ang = g ? Math.atan(g.m) : 0;
    this.s = RESPAWN_SPEED; this.vx = 0; this.vy = 0; this.spin = 0; this.omega = 0; this.tumbleT = 0;
    this.events.push({ k: 'respawn' });
    if (this.duskX >= this.x - 0.5) { this.phase = 'caught'; this.events.push({ k: 'caught' }); }
  }

  private pickups() {
    const ps = this.course.pickups, cx = this.x - Math.sin(this.ang) * 1.1, cy = this.y + Math.cos(this.ang) * 1.1;
    // pickups are sorted by x: skip the ones far behind, then look at the few around the sled
    while (this.pick0 < ps.length && ps[this.pick0].x < this.x - 8) this.pick0++;
    if (this.pick0 > 0 && this.pick0 < ps.length && ps[this.pick0 - 1].x > this.x - 8) this.pick0 = 0;
    for (let i = this.pick0; i < ps.length; i++) {
      const p = ps[i]; if (p.x > this.x + 4) break;
      if (this.got[p.id] || Math.abs(p.x - cx) > REACH + 0.6 || Math.abs(p.y - cy) > REACH + 0.8) continue;
      if (Math.hypot(p.x - cx, (p.y - cy) * 0.8) > REACH) continue;
      this.got[p.id] = 1;
      if (p.kind === 'flake') { this.flakes++; this.events.push({ k: 'flake', x: p.x, y: p.y }); }
      else {
        this.cocoa++;
        const push = upgradeValue('thermos', this.levels) * this.duskV;
        this.duskX -= push;
        this.events.push({ k: 'cocoa', x: p.x, y: p.y, push: upgradeValue('thermos', this.levels) });
      }
    }
  }

  // ---------------------------------------------------------------- for the bot and tests
  /** Everything that changes during a run, to put back later (the course is shared and never changes in a day). */
  snapshot() {
    const { course: _c, endless: _e, valley: _v, events: _ev, got, levels, mode, g: _g, ...rest } = this as unknown as Record<string, unknown> & { got: Uint8Array; levels: Levels; mode: Mode };
    void _c; void _e; void _v; void _ev; void _g;
    return { ...rest, got: got.slice(), levels: { ...levels }, mode };
  }
  restore(s: ReturnType<SnowGame['snapshot']>) { Object.assign(this, s, { got: (s.got as Uint8Array).slice(), events: [] }); }
}

/** Plays a whole run with one function deciding the button each tick; for the bots and tests. */
export function playRun(g: SnowGame, policy: (g: SnowGame) => boolean, maxTicks = TPS * 600) {
  g.step(true);
  for (let i = 0; i < maxTicks && !g.done; i++) { g.step(policy(g)); g.events.length = 0; }
  return g;
}

// ---------------------------------------------------------------- saving
export type DaySave = { done: boolean; cocoa: boolean; dusk: boolean; best: number; spare: number };
export type Save = {
  v: 1; days: Partial<Record<ValleyId, DaySave>>; flakes: number; levels: Levels;
  endless: { best: number; daily: { date: string; best: number } };
  last: number; ended: boolean; settings: { sound: boolean; music: boolean; shake: boolean };
};
export const freshSave = (): Save => ({ v: 1, days: {}, flakes: 0, levels: noUpgrades(), endless: { best: 0, daily: { date: '', best: 0 } }, last: 0, ended: false, settings: { sound: true, music: true, shake: true } });
const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
/** Reads a save, keeping what makes sense and dropping the rest; a broken or old save starts fresh. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return s;
    if (o.days && typeof o.days === 'object' && !Array.isArray(o.days)) {
      for (const id of VALLEY_IDS) {
        const d = (o.days as Record<string, unknown>)[id];
        if (!d || typeof d !== 'object' || Array.isArray(d)) continue;
        const q = d as Record<string, unknown>;
        if (q.done !== true) continue;
        s.days[id] = { done: true, cocoa: q.cocoa === true, dusk: q.dusk === true, best: Math.floor(num(q.best, 0, TPS * 3600)), spare: num(q.spare, 0, 9999) };
      }
    }
    s.flakes = Math.floor(num(o.flakes, 0, 1e7));
    if (o.levels && typeof o.levels === 'object' && !Array.isArray(o.levels)) for (const u of UPGRADE_IDS) s.levels[u] = Math.floor(num((o.levels as Record<string, unknown>)[u], 0, MAX_LEVEL));
    if (o.endless && typeof o.endless === 'object' && !Array.isArray(o.endless)) {
      const e = o.endless as Record<string, unknown>;
      s.endless.best = Math.floor(num(e.best, 0, 1e8));
      const d = e.daily as Record<string, unknown> | undefined;
      if (d && typeof d === 'object' && typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) s.endless.daily = { date: d.date, best: Math.floor(num(d.best, 0, 1e8)) };
    }
    s.last = typeof o.last === 'number' && Number.isInteger(o.last) && o.last >= 0 && o.last < VALLEY_IDS.length ? o.last : 0;
    if (!dayOpen(s, s.last)) s.last = 0;
    s.ended = o.ended === true && !!s.days.summit?.done;
    if (o.settings && typeof o.settings === 'object') { const st = o.settings as Record<string, unknown>; s.settings.sound = st.sound !== false; s.settings.music = st.music !== false; s.settings.shake = st.shake !== false; }
  } catch { return freshSave(); }
  return s;
}
/** Day i is open once the day before it has reached its lodge. */
export const dayOpen = (s: Save, i: number) => i === 0 || (i > 0 && i < VALLEY_IDS.length && !!s.days[VALLEY_IDS[i - 1]]?.done);
export const dayDone = (s: Save, i: number) => !!s.days[VALLEY_IDS[i]]?.done;
/** The Moonlit Hills open once day 3 has reached its lodge. */
export const endlessOpen = (s: Save) => !!s.days.caves?.done;
export const medalCount = (s: Save) => VALLEY_IDS.reduce((n, id) => { const d = s.days[id]; return n + (d ? (d.done ? 1 : 0) + (d.cocoa ? 1 : 0) + (d.dusk ? 1 : 0) : 0); }, 0);
/** Banks a run's snowflakes, and for a day keeps the best of it: medals only ever add up. Returns which medals are new. */
export function recordRun(s: Save, g: SnowGame): { first: boolean; cocoa: boolean; dusk: boolean; best: boolean } {
  s.flakes = Math.min(1e7, s.flakes + g.flakes);
  const out = { first: false, cocoa: false, dusk: false, best: false };
  if (g.mode.kind === 'endless') {
    const d = g.distance;
    if (d > s.endless.best) { s.endless.best = d; out.best = true; }
    return out;
  }
  if (g.phase !== 'finish') return out;
  const id = g.mode.valley, [, cocoa, dusk] = g.medals(), was = s.days[id];
  const r: DaySave = was ? { ...was } : { done: false, cocoa: false, dusk: false, best: 0, spare: 0 };
  out.first = !r.done; out.cocoa = cocoa && !r.cocoa; out.dusk = dusk && !r.dusk; out.best = !r.best || g.finishT < r.best;
  r.done = true; r.cocoa ||= cocoa; r.dusk ||= dusk; r.best = r.best ? Math.min(r.best, g.finishT) : g.finishT; r.spare = Math.max(r.spare, Math.round(g.spare * 10) / 10);
  s.days[id] = r;
  return out;
}
/** The Daily Hill's best for a date, kept for that date only. */
export function recordDaily(s: Save, date: string, distance: number) {
  if (s.endless.daily.date !== date) s.endless.daily = { date, best: 0 };
  const fresh = distance > s.endless.daily.best;
  if (fresh) s.endless.daily.best = distance;
  return fresh;
}
/** Buys the next level of an upgrade if there are enough snowflakes. */
export function buy(s: Save, id: UpgradeId): boolean {
  const lv = s.levels[id]; if (lv >= MAX_LEVEL) return false;
  const cost = UPGRADES[id].cost[lv]; if (s.flakes < cost) return false;
  s.flakes -= cost; s.levels[id] = lv + 1; return true;
}
/** A seed for the Daily Hill from a local date like 2026-10-30. */
export function dailySeed(date: string) { let h = 2166136261; for (const ch of date) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const fmtTime = (ticks: number) => { const s = ticks / TPS, m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };

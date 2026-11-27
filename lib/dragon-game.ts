// Dragon Playground engine: one dragon (driven by player 1, ridden by player 2 or the helper bot) races three Bishan
// otters across a course of playground chunks. Direct controls: speed answers the keys at once, boosts are timed speed
// tiers. Deterministic: randomness comes from a seeded generator, so a seed replays a race exactly. No DOM.
import { RACES, buildCourse, BENCH_H, SEESAW_H, type Course, type Grab, type Power, type Race } from './dragon-levels.js';

export { RACES };
export type { Race, Course, Power };
export const SAVE_KEY = 'dragon-playground-v1';
export const DT = 1 / 60;
export const RUN = 360;          // the dragon's run speed, px/s
export const BACK = 0.5;         // walking back, as a share of the run
export const GRAV = 2600;
export const JUMP = 980;         // take-off speed; holding Jump lightens gravity for a moment
export const HOLD_T = 0.24, HOLD_G = 0.42;
export const STEP = 32;          // a runner steps up anything this low without jumping
export const DRAGON_H = 135, BELLY_H = 70, DRAGON_HW = 70;
export const OTTER_H = 58, OTTER_HW = 55;
export const SAND = 0.6;
export const WATER_Y = -70;      // where a swimming otter floats; a dragon below -150 has splashed
export const METER_MAX = 5;      // kaya toasts for a roar
export const COUNTDOWN = 3;

export type HeroId = 'dora' | 'enzo';
export const TIERS = { slide: { m: 1.35, t: 1.2 }, fling: { m: 1.5, t: 1.0 }, bars: { m: 1.3, t: 0.7 }, mgr: { m: 1.4, t: 0.8 }, roar: { m: 1.6, t: 2.5 }, twin: { m: 1.4, t: 3.0 } } as const;
export type TierKind = keyof typeof TIERS;
export const POWER_NAME: Record<Power, string> = { flutter: 'Flutter', gulp: 'Gulp', seed: 'Seed spit', twin: 'Twin' };
export const POWER_HELP: Record<Power, string> = {
  flutter: 'in the air, the rider flaps for a second jump',
  gulp: 'scoops up every crow and kaya toast near the dragon',
  seed: 'knocks down the nearest otter ahead',
  twin: 'the mini dragon runs beside you: a long speed boost',
};
export const POWER_CD: Record<Power, number> = { flutter: 0, gulp: 8, seed: 6, twin: 12 };
export const POWER_FROM: Record<Power, string> = { flutter: 'r1', gulp: 'r2', seed: 'r3', twin: 'r4' };

export interface DriveIn { mx: number; down: boolean; jmp: boolean; jmpH: boolean; roar: boolean }
export interface RideIn { swat: boolean; grab: boolean; power: boolean }
export const NO_DRIVE: DriveIn = { mx: 0, down: false, jmp: false, jmpH: false, roar: false };
export const NO_RIDE: RideIn = { swat: false, grab: false, power: false };

export type DragonSt = 'idle' | 'run' | 'back' | 'jump' | 'fall' | 'land' | 'slide' | 'belly' | 'stumble' | 'hang' | 'fling' | 'spring' | 'splash' | 'cheer' | 'sad';
export interface Dragon {
  x: number; y: number; vy: number; vx: number; ground: boolean; st: DragonSt; stT: number;
  holdT: number; tier: TierKind | null; tierT: number; stumbleT: number; splashT: number;
  hang: Grab | null; flutterUsed: boolean; meter: number; padUsed: Set<number>; onSlide: boolean; slid: boolean;
  bonkT: number; finished: number | null; face: number;
}
export type RiderAct = 'sit' | 'lean' | 'swat' | 'grab' | 'hang' | 'cheer' | 'flap' | 'wobble' | 'sad';
export interface Rider { act: RiderAct; actT: number; swatCd: number; grabT: number; powerCd: number; manualT: number }
export type OtterSt = 'run' | 'jump' | 'swim' | 'dive' | 'hidden' | 'pop' | 'stumble' | 'barge' | 'belly' | 'cheer';
export interface Otter {
  i: number; x: number; y: number; vy: number; ground: boolean; st: OtterSt; stT: number; skill: number;
  stumbleT: number; hideT: number; hide0: number; diveX: number; popX: number; bumpCd: number; finished: number | null; lastObs: number; runT: number;
}
export interface Crow { id: number; x: number; y: number; vx: number; vy: number; st: 'fly' | 'swoop' | 'steal' | 'knocked'; t: number; gone: boolean }
export type Fx =
  | { k: 'jump' | 'land' | 'slide' | 'spring' | 'grab' | 'fling' | 'splash' | 'toast' | 'roar' | 'stumble' | 'swat' | 'steal' | 'bonk' | 'finish' | 'count' | 'go' | 'flutter' | 'gulp' | 'seed' | 'twin' | 'otterdive' | 'otterpop' | 'boost' | 'win' | 'lose'; x: number; y: number; n?: number };
export interface Stats { time: number; toasts: number; crows: number; boosts: number; falls: number; steals: number }
export interface SaveData { v: 1; won: Record<string, { time: number; stars: number }>; assist: boolean; sound: boolean; music: boolean; power: Power | null }

export function rngOf(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;

export function freshSave(): SaveData { return { v: 1, won: {}, assist: true, sound: true, music: true, power: null }; }
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try { const s = JSON.parse(raw); if (!s || s.v !== 1 || typeof s.won !== 'object') return null; return { ...freshSave(), ...s }; } catch { return null; }
}
export function raceOpen(save: SaveData, i: number) { return i === 0 || !!save.won[RACES[i - 1].id]; }
/** powers you can ride with: one per playground woken so far */
export function powersOwned(save: SaveData): Power[] { return (Object.keys(POWER_FROM) as Power[]).filter((p) => save.won[POWER_FROM[p]]); }
export function parTime(c: Course) { return Math.round(c.finish / (RUN * 1.08)); }
export function starsFor(place: number, time: number, toasts: number, c: Course): number {
  if (place !== 1) return 0;
  let s = 1; if (time <= parTime(c)) s++; if (toasts >= Math.ceil(c.toasts.length * 0.6)) s++;
  return s;
}

const OTTER_SKILL = [1.0, 0.95, 0.91];          // the leader and two pups

export interface GameOpts { race: number; seed: number; assist?: boolean; power?: Power | null; driver?: HeroId }
export class DragonGame {
  race: Race; course: Course; seed: number; assist: boolean; power: Power | null;
  rng: () => number; t = 0; mode: 'count' | 'race' | 'done' = 'count'; countT = COUNTDOWN; endT = 0;
  driver: HeroId; dragon: Dragon; rider: Rider; otters: Otter[]; crows: Crow[] = []; crowId = 0;
  toasts: { x: number; y: number; taken: boolean }[];
  stats: Stats = { time: 0, toasts: 0, crows: 0, boosts: 0, falls: 0, steals: 0 };
  fx: Fx[] = []; place = 0; stars = 0; nextCrow = 0; finishedCount = 0; leaderDoneT: number | null = null;
  riderBot = true;
  private botQ: { crows: { id: number; x: number; y: number }[]; grab: Grab | null; overGap: boolean; falling: boolean; otterAhead: number }[] = [];
  private botMiss = new Map<string, boolean>();

  constructor(o: GameOpts) {
    this.race = RACES[o.race]; this.course = buildCourse(this.race); this.seed = o.seed; this.assist = o.assist ?? true;
    this.power = o.power ?? null; this.driver = o.driver ?? 'dora'; this.rng = rngOf(o.seed * 7919 + o.race * 31 + 1);
    this.dragon = { x: 120, y: 0, vy: 0, vx: 0, ground: true, st: 'idle', stT: 0, holdT: 0, tier: null, tierT: 0, stumbleT: 0, splashT: 0,
      hang: null, flutterUsed: false, meter: 0, padUsed: new Set(), onSlide: false, slid: false, bonkT: 0, finished: null, face: 1 };
    this.rider = { act: 'sit', actT: 0, swatCd: 0, grabT: 0, powerCd: 0, manualT: 0 };
    this.otters = OTTER_SKILL.map((skill, i) => ({ i, x: 120 - 40 - i * 70, y: 0, vy: 0, ground: true, st: 'run' as OtterSt, stT: 0, skill,
      stumbleT: 0, hideT: 0, hide0: 1, diveX: 0, popX: 0, bumpCd: 0, finished: null, lastObs: -1, runT: 0 }));
    this.otters.forEach((ot, i) => { ot.x = 120 + 60 - i * 110; });
    this.toasts = this.course.toasts.map((t) => ({ ...t, taken: false }));
    this.nextCrow = 900 + this.rng() * 600;
  }

  get riderId(): HeroId { return this.driver === 'dora' ? 'enzo' : 'dora'; }
  swap() { this.driver = this.riderId; }
  speedMul(): number { const d = this.dragon; return d.tier ? TIERS[d.tier].m : 1; }

  // ───────────────────────────────────────────── the course, as the runners feel it
  /** the support tops under x, highest first: floor (0) where there is ground, and every solid top */
  supports(x: number, hw = 0): number[] {
    const c = this.course, out: number[] = [];
    for (const g of c.ground) if (x + hw * 0.3 >= g.x0 && x - hw * 0.3 <= g.x1) { out.push(0); break; }
    for (const s of c.tops) {
      const e = s.kind === 'stone' ? hw * 0.3 : 0;   // a stone holds the dragon until its feet are past the edge, like the ground
      if (x + e >= s.x0 && x - e <= s.x1) out.push(s.y0 + (s.y1 - s.y0) * clamp((x - s.x0) / Math.max(1, s.x1 - s.x0), 0, 1));
    }
    for (const s of c.seesaws) if (x >= s.x0 && x <= s.x1) out.push(this.seesawY(s, x));
    return out.sort((a, b) => b - a);
  }
  seesawY(s: { x0: number; x1: number }, x: number) { const m = (s.x0 + s.x1) / 2; return SEESAW_H - ((x - m) / (s.x1 - s.x0)) * 2 * 22; }
  groundKind(x: number) { for (const g of this.course.ground) if (x >= g.x0 && x <= g.x1) return g.g; return null; }
  inGap(x: number) { for (const g of this.course.gaps) if (x > g.x0 && x < g.x1) return g; return null; }
  ceilAt(x: number) { for (const c of this.course.ceils) if (x + DRAGON_HW > c.x0 && x - DRAGON_HW < c.x1) return c; return null; }
  onSlideAt(x: number) { for (const s of this.course.slides) if (x >= s.x0 && x <= s.x1) return s; return null; }

  /** move a runner from (x, y) to x + dx with feet support; returns the new x, y and whether it stands */
  private walk(x: number, y: number, dx: number, hw: number, wasGround: boolean, stickDown: number) {
    let nx = x + dx;
    if (dx > 0) for (const w of this.course.walls) if (x + hw <= w.x + 0.5 && nx + hw > w.x && y < w.h - STEP) nx = w.x - hw;
    if (!wasGround) return { x: nx, y, ground: false };
    for (const s of this.supports(nx, hw)) if (s <= y + STEP && s >= y - stickDown) return { x: nx, y: s, ground: true };
    return { x: nx, y, ground: false };
  }
  private land(x: number, yPrev: number, yNew: number, hw: number): number | null {
    for (const s of this.supports(x, hw)) if (yPrev >= s - 1 && yNew <= s) return s;
    return null;
  }

  // ───────────────────────────────────────────── one tick
  /** one tick. `ride` is player 2 on the rider's keys; null hands the rider to the helper bot, and `solo` is player 1
   *  pressing the rider's keys themselves (J, L, O), on top of what the bot does */
  step(drive: DriveIn, ride: RideIn | null, solo: RideIn = NO_RIDE) {
    this.fx = [];
    this.t += DT;
    if (this.mode === 'count') {
      const before = Math.ceil(this.countT); this.countT -= DT; const after = Math.ceil(this.countT);
      if (after !== before && after > 0) this.fx.push({ k: 'count', x: 0, y: 0, n: after });
      if (this.countT <= 0) { this.mode = 'race'; this.fx.push({ k: 'go', x: 0, y: 0 }); }
      return;
    }
    if (this.mode === 'race') this.stats.time += DT;
    this.riderBot = ride === null;
    const b = ride ?? this.botRide();
    const r: RideIn = { swat: b.swat || solo.swat, grab: b.grab || solo.grab, power: b.power || solo.power };
    this.stepDragon(this.mode === 'race' && this.dragon.finished === null ? drive : NO_DRIVE, this.dragon.finished === null ? r : NO_RIDE);
    for (const o of this.otters) this.stepOtter(o);
    this.stepCrows();
    if (this.mode === 'race') this.checkEnd();
    else { this.endT += DT; this.dragon.stT += DT; }
  }

  private setTier(k: TierKind) {
    const d = this.dragon; const cur = d.tier ? TIERS[d.tier].m : 0;
    if (TIERS[k].m >= cur || d.tierT <= 0.1) { d.tier = k; d.tierT = TIERS[k].t; }
    else d.tierT = Math.max(d.tierT, TIERS[k].t * 0.6);
    this.stats.boosts++; this.fx.push({ k: 'boost', x: d.x, y: d.y, n: Math.round(TIERS[k].m * 100) });
  }
  private stumble(t: number) { const d = this.dragon; if (d.tier === 'roar' || d.tier === 'twin') return; d.stumbleT = Math.max(d.stumbleT, t); this.fx.push({ k: 'stumble', x: d.x, y: d.y }); }

  private stepDragon(inp: DriveIn, ride: RideIn) {
    const d = this.dragon, R = this.rider, c = this.course;
    d.stT += DT; R.actT += DT;
    if (d.tierT > 0) { d.tierT -= DT; if (d.tierT <= 0) d.tier = null; }
    d.stumbleT = Math.max(0, d.stumbleT - DT); d.bonkT = Math.max(0, d.bonkT - DT);
    R.swatCd = Math.max(0, R.swatCd - DT); R.powerCd = Math.max(0, R.powerCd - DT); R.grabT = Math.max(0, R.grabT - DT);
    const setSt = (s: DragonSt) => { if (d.st !== s) { d.st = s; d.stT = 0; } };
    const act = (a: RiderAct) => { if (R.act !== a) { R.act = a; R.actT = 0; } };

    if (d.st === 'splash') {
      d.splashT -= DT;
      if (d.splashT <= 0) {
        let cp = 0; for (const p of c.checkpoints) if (p < d.x - 60 && this.supports(p, 0).length) cp = p;   // a stepping stone counts
        d.x = cp; d.y = this.supports(cp, 0)[0] ?? 0; d.vy = 0; d.ground = true; d.tier = null; d.tierT = 0; d.hang = null; setSt('idle'); act('sit');
      }
      return;
    }

    // ── the rider: swat, grab, power
    if (ride.swat && R.swatCd <= 0) {
      R.swatCd = 0.32; act('swat'); this.fx.push({ k: 'swat', x: d.x, y: d.y + DRAGON_H + 60 });
      const rx = d.x - 10, ry = d.y + this.bodyH() + 70;
      for (const cr of this.crows) if (!cr.gone && cr.st !== 'knocked' && Math.abs(cr.x - rx) < 175 && Math.abs(cr.y - ry) < 150 && cr.x > rx - 60) {
        cr.st = 'knocked'; cr.t = 0; cr.vx = 380; cr.vy = 260; this.stats.crows++;
      }
      for (const o of this.otters) if (o.st !== 'hidden' && Math.abs(o.x - (d.x + 60)) < 130 && Math.abs(o.y - d.y) < 80 && o.stumbleT <= 0) { o.stumbleT = 0.8; o.st = 'stumble'; }
    }
    if (ride.grab) { R.grabT = 0.3; if (R.act !== 'swat') act('grab'); }
    if (ride.power && this.power && R.powerCd <= 0) this.usePower();

    if (d.hang) {
      // swinging along the monkey bars under the rider's hands
      const g = d.hang; act('hang');
      d.x += RUN * 1.1 * DT; d.y = g.y - DRAGON_H - 95; d.vy = 0; d.ground = false; setSt('hang');
      this.pickToasts();
      if (d.x >= g.x1 - 10) { d.hang = null; d.y = Math.max(d.y, 2); d.vy = 520; setSt('fling'); this.setTier('bars'); this.fx.push({ k: 'fling', x: d.x, y: d.y }); }
      return;
    }
    // a grab in the window catches whatever is in reach
    if (R.grabT > 0) {
      const reachTop = d.y + this.bodyH() + 150;
      for (const g of c.grabs) {
        const inX = g.kind === 'bars' ? d.x > g.x && d.x < g.x1 - 80 : Math.abs(d.x - g.x) < 75;
        // the bars catch a dragon coming down onto them from a jump, or dropping into the drain under them, right up
        // until the splash
        if (!inX || (g.kind === 'bars' ? d.y > g.y + (d.vy < 0 ? 150 : 0) || d.y < WATER_Y * 2 : reachTop < g.y - 20 || d.y + this.bodyH() > g.y + 30)) continue;
        R.grabT = 0; this.fx.push({ k: 'grab', x: d.x, y: g.y });
        if (g.kind === 'bars') { d.hang = g; d.tier = null; setSt('hang'); act('hang'); return; }
        d.vy = g.kind === 'pole' ? 820 : 760; d.ground = false; d.y = Math.max(d.y, 4); setSt('fling'); act('hang'); this.setTier('fling');
        this.fx.push({ k: 'fling', x: d.x, y: d.y }); break;
      }
    }

    // ── roar
    if (inp.roar && d.meter >= METER_MAX) {
      d.meter = 0; this.setTier('roar'); this.fx.push({ k: 'roar', x: d.x, y: d.y });
      for (const o of this.otters) if (o.st !== 'hidden' && o.x > d.x - 60 && o.x < d.x + 520) { o.stumbleT = 1.0; o.st = 'stumble'; }
    }

    // ── horizontal: direct, no inertia
    const slide = d.ground ? this.onSlideAt(d.x) : null;
    const sand = d.ground && this.groundKind(d.x) === 'sand' && d.y <= 1 && !this.inGap(d.x);
    let vx = 0;
    if (slide && d.y > 1 && (inp.down || d.onSlide)) { d.onSlide = true; vx = RUN * (this.race.rain ? 1.5 : 1.35); }
    else if (inp.mx > 0) vx = RUN * this.speedMul();
    else if (inp.mx < 0) vx = -RUN * BACK;
    if (d.tier === 'roar' || d.tier === 'twin') vx = Math.max(vx, RUN * this.speedMul() * 0.9);   // a roar carries you
    if (sand && !d.onSlide) vx *= SAND;
    if (d.stumbleT > 0) vx = Math.min(vx, RUN * 0.35);
    if (d.finished !== null) vx = 0;
    if (d.onSlide && !(slide && d.y > 1)) { d.onSlide = false; if (d.ground) { this.setTier('slide'); this.fx.push({ k: 'slide', x: d.x, y: d.y }); } }
    d.vx = vx; if (vx !== 0) d.face = vx > 0 ? 1 : -1;
    const wasGround = d.ground;
    const m = this.walk(d.x, d.y, vx * DT, DRAGON_HW * 0.6, d.ground, slide ? 60 : 20);
    d.x = Math.max(0, m.x);
    if (wasGround && !m.ground) { d.ground = false; d.vy = 0; }
    else { d.y = m.y; d.ground = m.ground; }

    // ── the low ceilings: void decks cap a jump, stall awnings bonk an upright dragon
    const ceil = this.ceilAt(d.x);
    if (ceil && ceil.kind === 'stall' && d.ground && !this.isBelly(inp) && d.bonkT <= 0 && d.y < ceil.y) {
      d.bonkT = 0.8; this.stumble(0.45); this.fx.push({ k: 'bonk', x: d.x, y: ceil.y });
    }

    // ── jump
    if (inp.jmp && d.ground && d.stumbleT <= 0.2) {
      d.vy = JUMP; d.ground = false; d.holdT = HOLD_T; d.onSlide = false; setSt('jump'); this.fx.push({ k: 'jump', x: d.x, y: d.y });
    }
    if (!d.ground) {
      const g = d.holdT > 0 && inp.jmpH && d.vy > 0 ? GRAV * HOLD_G : GRAV;
      d.holdT = Math.max(0, d.holdT - DT);
      const yPrev = d.y; d.vy -= g * DT; d.y += d.vy * DT;
      if (ceil && ceil.kind === 'voiddeck' && d.y + DRAGON_H > ceil.y) { d.y = ceil.y - DRAGON_H; d.vy = Math.min(d.vy, 0); }
      if (d.vy <= 0) {
        const s = this.land(d.x, yPrev, d.y, DRAGON_HW * 0.6);
        if (s !== null) {
          const ss = this.course.seesaws.find((q) => d.x >= q.x0 && d.x <= q.x1);
          d.y = s; d.ground = true; d.flutterUsed = false;
          if (ss && d.vy < -380) { d.vy = 1340; d.ground = false; setSt('spring'); this.fx.push({ k: 'spring', x: d.x, y: d.y }); }
          else { d.vy = 0; setSt('land'); this.fx.push({ k: 'land', x: d.x, y: d.y }); }
        }
      }
      if (d.y < -150) {
        d.st = 'splash'; d.stT = 0; d.splashT = 1.1; d.tier = null; d.tierT = 0; this.stats.falls++; act('wobble');
        this.fx.push({ k: 'splash', x: d.x, y: WATER_Y }); return;
      }
    }

    // ── boost pads (merry-go-round)
    c.pads.forEach((p, i) => { if (d.ground && d.x > p.x0 && d.x < p.x1 && vx > 0 && !d.padUsed.has(i)) { d.padUsed.add(i); this.setTier('mgr'); } });

    // ── state for drawing
    if (d.finished !== null) setSt(this.place === 1 ? 'cheer' : 'sad');
    else if (d.stumbleT > 0) setSt('stumble');
    else if (!d.ground) { if (d.st !== 'spring' && d.st !== 'fling' && d.st !== 'jump') setSt(d.vy > 0 ? 'jump' : 'fall'); else if (d.vy < -200 && d.st !== 'fling') setSt('fall'); }
    else if (d.onSlide) setSt('slide');
    else if (this.isBelly(inp) && vx > 0) setSt('belly');
    else if (d.st === 'land' && d.stT < 0.12) { /* hold the landing pose */ }
    else setSt(vx > 0 ? 'run' : vx < 0 ? 'back' : 'idle');

    if (R.actT > 0.3 || R.act === 'hang' || R.act === 'wobble') {
      if (d.finished !== null) act(this.place === 1 ? 'cheer' : 'sad');
      else if (R.act === 'hang' && d.st === 'fling' && d.stT < 0.35) { /* still letting go */ }
      else if (d.stumbleT > 0) act('wobble');
      else if (R.act === 'flap' && R.actT < 0.45) { /* still flapping */ }
      else if (d.tier || d.onSlide) act('lean');
      else if (R.act !== 'swat' && R.act !== 'grab' || R.actT > 0.3) act('sit');
    }
    this.pickToasts();
    if (d.finished === null && d.x >= c.finish) {
      d.finished = this.stats.time; this.finishedCount++; this.place = this.finishedCount;
      this.fx.push({ k: 'finish', x: d.x, y: d.y, n: this.place });
    }
  }
  bodyH() { return this.dragon.st === 'belly' || this.dragon.st === 'slide' ? BELLY_H : DRAGON_H; }
  private isBelly(inp: DriveIn) { return inp.down && this.dragon.ground && !this.onSlideAt(this.dragon.x); }

  private pickToasts() {
    const d = this.dragon, top = d.y + this.bodyH() + 130;
    for (const t of this.toasts) if (!t.taken && Math.abs(t.x - d.x) < 95 && t.y > d.y - 30 && t.y < top) {
      t.taken = true; this.stats.toasts++; d.meter = Math.min(METER_MAX, d.meter + 1); this.fx.push({ k: 'toast', x: t.x, y: t.y });
    }
  }

  private usePower() {
    const d = this.dragon, R = this.rider, p = this.power!;
    if (p === 'flutter') {
      if (d.ground || d.flutterUsed || d.hang) return;
      d.flutterUsed = true; d.vy = Math.max(d.vy, 820); d.holdT = 0; R.act = 'flap'; R.actT = 0; this.fx.push({ k: 'flutter', x: d.x, y: d.y }); return;
    }
    R.powerCd = POWER_CD[p];
    if (p === 'gulp') {
      for (const cr of this.crows) if (!cr.gone && cr.st !== 'knocked' && Math.abs(cr.x - d.x) < 560) { cr.gone = true; this.stats.crows++; }
      for (const t of this.toasts) if (!t.taken && Math.abs(t.x - d.x) < 380 && t.y < d.y + 420) { t.taken = true; this.stats.toasts++; d.meter = Math.min(METER_MAX, d.meter + 1); }
      this.fx.push({ k: 'gulp', x: d.x, y: d.y });
    } else if (p === 'seed') {
      let best: Otter | null = null;
      for (const o of this.otters) if (o.st !== 'hidden' && o.finished === null && o.x > d.x && o.x < d.x + 1000 && (!best || o.x < best.x)) best = o;
      if (best) { best.stumbleT = 1.2; best.st = 'stumble'; }
      this.fx.push({ k: 'seed', x: d.x, y: d.y, n: best ? best.i : -1 });
    } else if (p === 'twin') { this.setTier('twin'); this.fx.push({ k: 'twin', x: d.x, y: d.y }); }
    R.act = 'cheer'; R.actT = 0;
  }

  // ───────────────────────────────────────────── the helper bot on the dragon's back
  /** plays the rider like a person: sees the race about a quarter of a second late, misses some */
  private botRide(): RideIn {
    const d = this.dragon, c = this.course, R = this.rider;
    const reachTop = d.y + this.bodyH() + 150;
    const grab = c.grabs.find((g) => (g.kind === 'bars' ? d.x > g.x + 10 && d.x < g.x1 - 100 && d.y <= g.y + (d.vy < 0 ? 150 : 0) && d.y >= WATER_Y * 2 : Math.abs(d.x - g.x) < 50 && reachTop >= g.y - 20 && d.y + this.bodyH() <= g.y + 30)) ?? null;
    let otterAhead = 9999; for (const o of this.otters) if (o.st !== 'hidden' && o.x > d.x && o.x - d.x < otterAhead) otterAhead = o.x - d.x;
    const overGap = !!this.inGap(d.x + 60) || !!this.inGap(d.x);
    this.botQ.push({ crows: this.crows.filter((cr) => !cr.gone && cr.st !== 'knocked').map((cr) => ({ id: cr.id, x: cr.x, y: cr.y })), grab, overGap, falling: !d.ground && d.vy < 0, otterAhead });
    const lag = 14 + Math.floor((this.seed * 13) % 5);
    if (this.botQ.length > lag) this.botQ.shift();
    const v = this.botQ[0];
    const out: RideIn = { swat: false, grab: false, power: false };
    const rx = d.x - 10, ry = d.y + this.bodyH() + 70;
    const missRate = this.assist ? 0.12 : 0.25;
    for (const cr of v.crows) {
      if (Math.abs(cr.x - rx) < 200 && Math.abs(cr.y - ry) < 170) {
        const key = 'c' + cr.id; if (!this.botMiss.has(key)) this.botMiss.set(key, this.rng() < missRate);
        if (!this.botMiss.get(key)) out.swat = true;
      }
    }
    if (v.grab && grab && (grab === v.grab || grab.kind === 'bars')) {
      const key = 'g' + c.grabs.indexOf(grab) + ':' + this.stats.falls;
      if (!this.botMiss.has(key)) this.botMiss.set(key, grab.kind === 'bars' ? false : this.rng() < 0.25);
      if (!this.botMiss.get(key)) out.grab = true;
    }
    if (this.power && R.powerCd <= 0) {
      if (this.power === 'flutter' && v.overGap && v.falling) out.power = true;
      if (this.power === 'gulp' && v.crows.filter((cr) => Math.abs(cr.x - d.x) < 500).length >= 2) out.power = true;
      if (this.power === 'seed' && v.otterAhead < 600) out.power = true;
      if (this.power === 'twin' && d.ground && d.vx > 0 && !d.tier) out.power = true;
    }
    return out;
  }

  // ───────────────────────────────────────────── otters
  private stepOtter(o: Otter) {
    const d = this.dragon, c = this.course;
    o.stT += DT; o.bumpCd = Math.max(0, o.bumpCd - DT);
    const setSt = (s: OtterSt) => { if (o.st !== s) { o.st = s; o.stT = 0; } };
    if (o.finished !== null) { setSt('cheer'); return; }
    if (this.mode !== 'race') return;
    if (o.st === 'hidden') {
      o.hideT -= DT;
      if (o.hideT <= 0) { o.x = o.popX; o.y = 0; o.vy = 0; o.ground = true; setSt('pop'); this.fx.push({ k: 'otterpop', x: o.x, y: 0, n: o.i }); }
      return;
    }
    if (o.st === 'dive') { if (o.stT > 0.35) { setSt('hidden'); } return; }
    if (o.stumbleT > 0) { o.stumbleT -= DT; setSt('stumble'); if (o.stumbleT > 0) { this.otterFall(o); return; } setSt('run'); }
    if (o.st === 'pop' && o.stT < 0.35) return;

    // pace: the race's otter speed, the otter's own skill, a little wobble, and the rubber band
    let v = RUN * this.race.otter * o.skill * (0.97 + 0.06 * Math.sin(this.t * 0.7 + o.i * 2.1));
    const lead = o.x - d.x;
    if (d.finished === null) {
      if (this.assist) { if (lead > 450) v *= 0.8; else if (lead > 200) v *= 0.92; }
      else if (lead > 900) v *= 0.92;
      // otters left far behind put on a spurt so the race stays a race, but not on the run-in: a late lead holds
      if (lead < -400 && d.x < this.course.finish * 0.92) v *= 1 + Math.min(0.75, (-lead - 400) / 900);
    }
    if (this.assist) v *= 0.96;
    const swim = !o.ground && o.y <= WATER_Y + 2;
    if (swim) v *= 0.82;
    else if (o.ground && this.groundKind(o.x) === 'sand' && o.y <= 1) v *= 0.8;

    // drain shortcuts
    for (const g of c.grates) if (o.ground && o.y <= 1 && Math.abs(o.x - g.a) < v * DT + 1 && o.lastObs !== g.a) {
      o.lastObs = g.a;
      if (this.rng() < 0.65) {
        let b = g.b; while (this.inGap(b) || !this.supports(b, 0).length) b += 40;
        o.popX = b; o.diveX = o.x; o.hideT = o.hide0 = (b - g.a) / (v * 1.25); setSt('dive'); this.fx.push({ k: 'otterdive', x: o.x, y: 0, n: o.i }); return;
      }
    }
    // see an obstacle ahead and hop it (sometimes clumsily)
    if (o.ground) {
      const ahead = o.x + OTTER_HW + 50;
      for (const w of c.walls) if (w.x > o.x && w.x < ahead && w.h > o.y + STEP) {
        if (o.lastObs !== w.x) { o.lastObs = w.x; if (this.rng() < 0.07) { o.stumbleT = 0.6; setSt('stumble'); return; } }
        o.vy = Math.sqrt(2 * GRAV * (w.h - o.y + 46)); o.ground = false; setSt('jump');
      }
    }
    const m = this.walk(o.x, o.y, v * DT, OTTER_HW * 0.5, o.ground, this.onSlideAt(o.x) ? 60 : 20);
    o.x = m.x;
    if (o.ground && !m.ground) { o.ground = false; o.vy = 0; } else if (o.ground) o.y = m.y;
    if (swim) {
      // swimming across a longkang: hop out at the far bank
      const gap = this.inGap(o.x + OTTER_HW);
      if (!gap) { o.vy = 760; o.y = WATER_Y + 1; setSt('jump'); }
    }
    if (!o.ground) this.otterFall(o);
    if (o.ground) setSt(this.onSlideAt(o.x) && o.y > 1 ? 'belly' : 'run');
    o.runT += DT * (v / RUN);
    // a barge when they share the spot
    if (o.bumpCd <= 0 && d.ground && o.ground && Math.abs(o.x - d.x) < 80 && Math.abs(o.y - d.y) < 40 && d.finished === null) {
      o.bumpCd = 1.6; setSt('barge'); this.stumble(0.25); this.fx.push({ k: 'bonk', x: (o.x + d.x) / 2, y: 40 });
    }
    if (o.x >= c.finish) {
      o.finished = this.stats.time; this.finishedCount++; setSt('cheer');
      if (o.i === 0 || this.leaderDoneT === null) this.leaderDoneT = this.leaderDoneT ?? this.stats.time;
      this.fx.push({ k: 'finish', x: o.x, y: 0, n: -1 - o.i });
    }
  }
  private otterFall(o: Otter) {
    if (o.ground) return;
    const yPrev = o.y; o.vy -= GRAV * DT; o.y += o.vy * DT;
    if (o.vy <= 0) { const s = this.land(o.x, yPrev, o.y, OTTER_HW * 0.5); if (s !== null) { o.y = s; o.vy = 0; o.ground = true; return; } }
    if (o.y < WATER_Y) { o.y = WATER_Y; o.vy = 0; o.st = 'swim'; }
  }

  // ───────────────────────────────────────────── crows
  private stepCrows() {
    const d = this.dragon;
    if (this.mode === 'race' && d.finished === null && d.x > this.nextCrow - 900 && d.x < this.course.finish - 900) {
      this.crows.push({ id: ++this.crowId, x: d.x + 1000 + this.rng() * 200, y: 330 + this.rng() * 160, vx: -200 - this.rng() * 60, vy: 0, st: 'fly', t: 0, gone: false });
      this.nextCrow += (1000 / Math.max(0.05, this.race.crows)) * (0.6 + this.rng() * 0.8);
    }
    for (const cr of this.crows) {
      if (cr.gone) continue;
      cr.t += DT;
      const rx = d.x - 10, ry = d.y + this.bodyH() + 70;
      if (cr.st === 'fly') {
        cr.x += cr.vx * DT; cr.y += Math.sin(cr.t * 5) * 30 * DT;
        if (cr.x - rx < 380) { cr.st = 'swoop'; cr.t = 0; }
      } else if (cr.st === 'swoop') {
        const dx = rx - cr.x, dy = ry - cr.y, dist = Math.hypot(dx, dy) || 1, sp = 420 + d.vx * 0.5;
        cr.x += (dx / dist) * sp * DT; cr.y += (dy / dist) * sp * DT;
        if (dist < 60) {
          cr.st = 'steal'; cr.t = 0; this.stats.steals++;
          if (d.meter > 0) d.meter--;
          this.stumble(0.5); this.fx.push({ k: 'steal', x: cr.x, y: cr.y });
        }
        if (cr.t > 3) { cr.st = 'steal'; cr.t = 0; }
      } else if (cr.st === 'steal') { cr.x -= 300 * DT; cr.y += 260 * DT; if (cr.t > 2) cr.gone = true; }
      else if (cr.st === 'knocked') { cr.x += cr.vx * DT; cr.vy -= 900 * DT; cr.y += cr.vy * DT; if (cr.t > 1.5) cr.gone = true; }
    }
    if (this.crows.length > 30) this.crows = this.crows.filter((c) => !c.gone);
  }

  private checkEnd() {
    const d = this.dragon;
    if (d.finished !== null) {
      this.mode = 'done'; this.endT = 0;
      this.stars = starsFor(this.place, d.finished, this.stats.toasts, this.course);
      this.fx.push({ k: this.place === 1 ? 'win' : 'lose', x: d.x, y: d.y });
    } else if (this.leaderDoneT !== null && this.stats.time - this.leaderDoneT > 15) {
      this.mode = 'done'; this.endT = 0; this.place = this.finishedCount + 1; this.stars = 0; this.fx.push({ k: 'lose', x: d.x, y: d.y });
      d.st = 'sad'; this.rider.act = 'sad';
    }
  }

  /** where everyone is, 0..1 of the course, for the HUD's race strip */
  /** where an otter is, even underground in a drain (somewhere between where it dived and where it will pop out) */
  otterX(o: Otter) { return o.st === 'hidden' ? o.diveX + (o.popX - o.diveX) * (1 - o.hideT / o.hide0) : o.x; }
  progress() { const f = this.course.finish; return { dragon: clamp(this.dragon.x / f, 0, 1), otters: this.otters.map((o) => clamp(this.otterX(o) / f, 0, 1)) }; }
  /** the dragon's place right now (1 = leading) */
  standing() { if (this.dragon.finished !== null) return this.place; let p = 1; for (const o of this.otters) if (o.finished !== null || this.otterX(o) > this.dragon.x) p++; return p; }
}

export { BENCH_H };

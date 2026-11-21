// Jade Street: the job runner. Walks a story mission or side gig through its steps (talk, go, ride, pick up, deliver,
// mini-game, chase, tail, escort, race, stealth, collect, heat, trade, fares, the island's train ride and the race
// against the train), spawning the actors each step needs
// (the crow cart, Pip on foot, the lion dance, lookouts, rivals, fares), and keeping a checkpoint so a failure
// restarts from the last one: you never lose more than a step or two. Assist widens timers, slows targets, eases
// lookouts and lets bumps land from a little further away. Every job has a readable way to fail with its own meter or
// timer and a warning before it bites: the getaway meter in chases, the troupe meter in escorts, suspicion and alert
// when tailing and sneaking, wobble for fragile cargo, timers on deliveries, trades, races and hurried trips. Chase set
// pieces live in lib/jade-setpiece.ts, Madame Glint's phases and float in lib/jade-boss.ts, raids in lib/jade-biz.ts.
import { T, W, OLD_W, S, OW, F_ROOF, districtAt, type District } from './jade-city.js';
import { unmvT } from './jade-layout.js';
import { VEHICLES, drive, onWater, type Body, type VehicleKind } from './jade-move.js';
import { los, downhill, nearestFree, type Field } from './jade-nav.js';
import { dist, angDiff, clamp } from './jade-rng.js';
import { PEOPLE, type Mission, type Step, type Spot, type Skin } from './jade-story.js';
import type { World, Ride, Near, Input } from './jade-game.js';
import type { Car } from './jade-traffic.js';
import { addHeat } from './jade-heat.js';
import { redAhead } from './jade-traffic.js';
import { makeSets, stepSets, type SetState } from './jade-setpiece.js';
import { bossEnter, bossStep, floatEnter, floatStep, floatNear, tryLeap, inWindow, leapSpot, LADDER, type Sign, type Float } from './jade-boss.js';
import { raidEnter, raidStep } from './jade-biz.js';
import { rideEnter, rideStep, rideTag, rideTarget } from './jade-ridejobs.js';
import { trackEnter, trackStep, trackNear, trackAct, trackTarget } from './jade-track.js';
import { teamEnter, teamStep, teamTag, guardGoal, guardHits, onGadget, onBurst, watchStep, blind, postMate, releaseMate, holding, dropBag } from './jade-team.js';
import { matePounceHit, pounce, pounceWindow, nameOf, GRAB_REACH, type TagOpt } from './jade-tag.js';
import { seat, newAI, type MateMode } from './jade-duo.js';
import type { GadgetId } from './jade-gear.js';
import type { Hero } from './jade-save.js';
import type { Player } from './jade-game.js';
import { linkById } from './jade-cable.js';
import { lineAt, stationNear } from './jade-mrt.js';
import { jobEnter, jobStep, jobNear, jobAct, jobMini, jobTag, jobGuardGoal, jobTarget, jobAim, jobGadget, walkOnly, heistPick, branchPick, askPick, askClose, type JobState, type BranchPick } from './jade-jobs.js';
import type { Intel } from './jade-story.js';
import { hear, type Mind, newMind, tune } from './jade-aware.js';
import { crewWatch, crewLabel, swapNoun } from './jade-jobs.js';

export type Gig = { key: string; reward: number; d: District };
export type Actor = { id: number; kind: string; b: Body; route: [number, number][]; wp: number; speed: number; t: number; stun: number; look: number; lookCd: number; face: number; gone: boolean; hits: number; extra?: number;
  /** painted blind (seconds), staring at a distraction (seconds, and at what), tangled in a net, the last single pounce */
  extra2?: number; stare?: number; stareX?: number; stareY?: number; stareAt?: string; netT?: number; pz?: { by: 'you' | 'mate'; t: number };
  /** a rival gang's look for a chase (an otter's sampan, a macaque) */
  skin?: Skin;
  /** what it has noticed (lib/jade-aware.ts): guards, lookouts, Pip, lured gang members, a blend's watchers */
  mind?: Mind;
  /** a sneaky raider (defend): slow, quiet, comes round the far side; a dash bowls it over */
  sneaky?: boolean };
export type Meter = { name: string; v: number; bad?: boolean };
type Snap = { i: number; x: number; y: number; h?: number; roof: boolean; ride: VehicleKind | null; carry: string | null; phase?: number; intel?: Intel[];
  /** who you were playing and where the partner was (and what they had been told to do) */
  who: Hero; mate: { x: number; y: number; roof: boolean; seat: boolean; mode: MateMode; at: [number, number] | null; story: boolean } };

export class Run {
  i = -1; cur!: Step; timer: number | null = null; meter: Meter | null = null; meter2: Meter | null = null; progress = '';
  /** the warning on screen (a hazard coming, a meter running high) and how long it stays */
  warning: { text: string; t: number } | null = null;
  sets: SetState[] = []; signs: Sign[] = []; float: Float | null = null; private warned = 0;
  /** seconds after a checkpoint restore when lookouts and Pip don't notice you yet */
  grace = 0;
  actors: Actor[] = []; marks: [number, number][] = []; mark = 0; items: { x: number; y: number; got: boolean; sprite: string; marks?: string[] }[] = [];
  loot: { x: number; y: number; sprite: string } | null = null; snap!: Snap; phase = 0; count = 0; lost = 0; base = 0; hits = 0;
  spawned = 0; spawnT = 0; envelopes = 5; fare: { x: number; y: number; to: [number, number] | null; sp: string } | null = null;
  /** for the medals: active seconds, the most heat, and retries from a checkpoint */
  time = 0; maxHeat = 0; retries = 0;
  /** a little give after each retry (4% a time, at most 12%): rivals ease off and lookouts take longer to be sure */
  mercy() { return 1 - Math.min(0.12, 0.04 * this.retries); }
  ride: Ride | null = null; private fieldKey = ''; private f: Field | null = null;
  /** the objective line; {mate} and {hero} read as the partner's and your hero's names */
  private lab = '';
  get label() { return this.lab.replace(/\{mate\}/g, nameOf(this.w.mate.who)).replace(/\{hero\}/g, nameOf(this.w.p.who)); }
  set label(v: string) { this.lab = v; }
  /** the hero a switch step waits for, where you stood when the step began, the hero who started a relay */
  want = ''; here: [number, number] = [0, 0]; starter = '';
  /** the seventh pass's job steps (lib/jade-jobs.ts): what casing found out (kept from step to step), the step's own
   * state, the clue notebook, the Assist hint ring, and whether its meter's warning has been given */
  intel: Intel[] = []; js: JobState | null = null; notes: string[] = []; hint: { x: number; y: number; r: number } | null = null; jsWarned = false;
  /** a crew watcher is alert this frame (lib/jade-jobs.ts crewWatch) */
  jsAlert = false;
  constructor(public w: World, public m: Mission, public gig?: Gig) {}

  get assist() { return this.w.assist; }
  get easy() { return this.w.easy; }
  spot(s: Spot): [number, number] {
    if (s === 'loot') return this.loot ? [this.loot.x, this.loot.y] : [this.w.p.x, this.w.p.y];
    if (typeof s === 'string') { const p = this.w.c.places[s]; return p ? [p.x, p.y] : [this.w.p.x, this.w.p.y]; }
    return [s[0] * T + T / 2, s[1] * T + T / 2];
  }
  begin() {
    if (this.m.tip) this.addTip();
    // a contract's modifiers (lib/jade-proc.ts): a storm, the graveyard shift, the partner busy at the giver's
    const mods = this.m.mods ?? [], w = this.w;
    if (mods.includes('rain')) w.rainForce = 0.9;
    if (mods.includes('night')) w.dark = true;
    if (mods.includes('solo') && !w.two) { const pl = w.c.places[this.m.at]; postMate(this, 'stay', pl ? [pl.x + 40, pl.y + 30] : [w.mate.x, w.mate.y]); }
    this.snap = this.snapshot(0);
    this.enter(0);
  }
  addTip() { const t = this.m.tip!; const s = this.w.s; if (!s.tips.some(x => x.night === s.night && x.market === t.market && x.good === t.good)) s.tips.push({ night: s.night, market: t.market, good: t.good, mult: t.mult, from: PEOPLE[this.m.giver].name, text: this.m.blurb }); }
  snapshot(i: number): Snap {
    const p = this.w.p, m = this.w.mate;
    return { i, x: p.x, y: p.y, h: p.ride ? p.ride.b.h : p.b.h, roof: p.roof, ride: p.ride?.kind ?? null, carry: p.carry, who: p.who, intel: this.intel.slice(),
      mate: { x: m.x, y: m.y, roof: m.roof, seat: !!m.seat && m.seat === p.ride, mode: m.ai.mode === 'pounce' || m.ai.mode === 'distract' ? 'follow' : m.ai.mode, at: m.ai.at, story: m.ai.story } };
  }
  restore() {
    const w = this.w, s = this.snap; this.cleanup(false);
    // the checkpoint puts you back in the paws of the hero you were playing then
    if (w.p.who !== s.who && !w.two) { const a = w.p; w.p = w.mate; w.mate = a; w.s.hero = w.p.who; }
    const m = w.mate; m.act = null; m.hide = false; if (m.seat) m.seat = null; if (m.ride) { m.ride.parked = true; m.ride.b.speed = 0; m.ride = null; }
    const p = w.p;
    // the ride you were on comes back with you when the checkpoint had one of that kind
    const keep = p.ride && p.ride.kind === s.ride ? p.ride : null;
    if (p.ride) { p.ride.parked = true; p.ride.b.speed = 0; if (onWater(p.ride.kind) && !keep) p.ride.b.x = p.ride.b.y = -9999; p.ride = null; }
    // (a boat you were steering when it went wrong is towed away: a fresh one waits at the mooring, where you can step aboard)
    p.hide = false; p.act = null; p.dashT = 0; p.hopT = 0; p.carry = s.carry;
    if (s.ride) {
      if (keep) keep.b.x = keep.b.y = -9999;
      const [x, y] = w.rideSpot(s.ride, s.x, s.y);
      const r = keep ?? w.addRide(s.ride, x, y, -Math.PI / 2, false, 0, true);
      r.b.x = x; r.b.y = y; r.b.h = s.h ?? r.b.h; r.b.speed = 0;
      p.ride = r; r.parked = false; p.b.x = x; p.b.y = y; p.roof = false;
    } else { p.roof = s.roof; if (s.roof) { p.b.x = s.x; p.b.y = s.y; p.lastRoof = [s.x, s.y]; } else w.placePlayer(s.x, s.y); }
    // the partner too: back in the passenger seat, or where they stood, doing what they had been told
    m.ai = { ...newAI(), mode: s.mate.mode, at: s.mate.at, story: s.mate.story };
    if (s.mate.seat && p.ride) seat(w, m, p.ride);
    else { m.roof = s.mate.roof; if (m.roof) { m.b.x = s.mate.x; m.b.y = s.mate.y; m.lastRoof = [s.mate.x, s.mate.y]; } else { const [x, y] = nearestFree(w.c, 'walk', s.mate.x, s.mate.y, w.open, 4); m.b.x = x; m.b.y = y; } m.b.speed = 0; }
    w.fx.push({ t: 'checkpoint' }); w.p.disguise = false;
    if (s.intel) this.intel = s.intel.slice();
    this.enter(s.i);
    // a checkpoint taken part-way through a step (the shipping list in hand) picks up from there
    if (s.phase) { this.phase = s.phase; p.carry = s.carry; }
    this.grace = Math.max(this.grace, 2.5);
  }
  cleanup(all = true) {
    this.actors = []; this.items = []; this.marks = []; this.loot = null; this.fare = null; this.timer = null; this.meter = null; this.meter2 = null; this.progress = '';
    this.js = null; this.notes = []; this.hint = null; this.w.p.disguise = false;
    this.sets = []; this.signs = []; this.float = null; this.warning = null;
    if (all) { if (this.m.mods?.length) { if (this.m.mods.includes('rain')) this.w.rainForce = null; this.w.dark = false; } releaseMate(this); this.w.p.carry = null; if (this.m.tip) this.w.s.tips = this.w.s.tips.filter(t => !(t.market === this.m.tip!.market && t.good === this.m.tip!.good)); }
  }
  next() { this.enter(this.i + 1); }
  enter(i: number) {
    const w = this.w;
    this.actors = []; this.items = []; this.marks = []; this.timer = null; this.meter = null; this.meter2 = null; this.progress = ''; this.phase = 0;
    this.js = null; this.notes = []; this.hint = null; this.warning = null;
    this.sets = []; this.signs = []; this.warned = 0; if (!(this.m.steps[i]?.t === 'pickup')) this.float = null; this.count = 0; this.lost = 0; this.hits = 0; this.spawned = 0; this.spawnT = 0;
    if (i >= this.m.steps.length) { this.cleanup(); w.finishMission(this.m, this.gig); return; }
    this.i = i; this.cur = this.m.steps[i]; const st = this.cur; this.here = [w.p.x, w.p.y];
    if (st.cp && i > 0) { this.snap = this.snapshot(i); w.fx.push({ t: 'checkpoint' }); }
    this.label = 'label' in st ? st.label : '';
    const k = (this.assist ? 1.4 : 1) * this.w.diff.timer;
    if (teamEnter(this, st)) return;
    if (rideEnter(this, st) || trackEnter(this, st)) return;
    if (jobEnter(this, st)) return;
    switch (st.t) {
      case 'talk': {
        const hero = w.p.who, mate = w.mate.who;
        w.talk = { lines: st.lines.map(([who, text, mood]) => [who === 'hero' ? hero : who === 'mate' ? mate : who, text.replace(/\{mate\}/g, nameOf(mate)).replace(/\{hero\}/g, nameOf(hero)), mood ?? 'calm'] as [string, string, string]), i: 0, done: () => this.next() };
        w.fx.push({ t: 'talk' });
        break;
      }
      case 'ride': {
        const [x, y] = this.spot(st.near ?? [Math.floor(w.p.x / T), Math.floor(w.p.y / T)]);
        if (w.p.ride?.kind === st.kind && !st.locked) { this.next(); return; }
        let r = w.rides.find(r => r.parked && r.kind === st.kind && dist(r.b.x, r.b.y, x, y) < 260 && (!st.locked || r.locked) && w.boardable(r.b.x, r.b.y));
        if (!r) { const [rx, ry] = w.rideSpot(st.kind, x, y); r = w.addRide(st.kind, rx, ry, -Math.PI / 2, !!st.locked, 0, true); }
        this.ride = r;
        break;
      }
      case 'goto': if (st.time) this.timer = st.time * k; break;
      case 'float': floatEnter(this); break;
      case 'raid': raidEnter(this, st); break;
      case 'deliver': this.timer = st.time * k; this.hits = 0; if (st.fragile) this.meter = { name: 'Wobble', v: 0 }; if (!w.p.carry) w.p.carry = st.item; break;
      case 'mini': w.ui = { kind: 'mini', mini: st.kind, level: st.level, from: 'mission' }; w.fx.push({ t: 'mini' }); break;
      case 'chase': {
        const [x, y] = this.spot(st.from);
        const cls = st.who === 'boat' ? 'boat' : st.who === 'runner' ? 'foot' : 'small';
        const [sx, sy] = nearestFree(w.c, cls, x, y, w.open, 6);
        this.actors.push(this.actor(st.who, sx, sy, cls, this.path(st.route, cls), st.speed)); if (st.skin) this.actors[this.actors.length - 1].skin = st.skin;
        this.progress = chaseProgress(st, 0); this.meter = { name: 'Getaway', v: 0 }; this.grace = 4;
        this.sets = makeSets(this, st.sets);
        if (st.who === 'boss' && st.phase) bossEnter(this, st);
        w.fx.push({ t: 'chase' });
        break;
      }
      case 'tail': {
        const [x, y] = this.spot(st.from);
        const [sx, sy] = nearestFree(w.c, 'foot', x, y, w.open, 6);
        this.actors.push(this.actor('pip', sx, sy, 'foot', this.path(st.route, 'foot'), 72)); if (st.skin) this.actors[0].skin = st.skin;
        this.meter = { name: 'Suspicion', v: 0 }; this.starter = w.p.who;
        if (st.relay) postMate(this, 'post', this.spot(st.relay.spot));
        break;
      }
      case 'escort': {
        const [x, y] = this.spot(st.from);
        const [sx, sy] = nearestFree(w.c, 'foot', x, y, w.open, 6);
        this.actors.push(this.actor('lion', sx, sy, 'foot', this.path(st.route, 'foot'), 52)); if (st.skin) this.actors[0].skin = st.skin;
        this.envelopes = 5; const pups = st.skin === 'otter'; this.meter = { name: pups ? 'Pups’ snacks' : 'Red envelopes', v: 1 }; this.meter2 = { name: pups ? 'Pups waiting' : 'Troupe waiting', v: 0 }; this.spawnT = 3;
        if (st.flanks) postMate(this, 'guard', [sx, sy]);
        break;
      }
      case 'race': {
        this.marks = st.marks.map(s => this.spot(s)); this.mark = 0;
        if (st.time) this.timer = st.time * k;
        if (st.rival) {
          const cls = st.rival === 'boat' ? 'boat' : st.rival === 'runner' ? 'foot' : 'small';
          const [x, y] = nearestFree(w.c, cls, w.p.x + 30, w.p.y + 30, w.open, cls === 'boat' && !(w.p.ride && onWater(w.p.ride.kind)) ? 12 : 4);
          const sp = st.rival === 'runner' ? 204 : st.rival === 'scooter' ? 292 : 220;
          this.actors.push(this.actor('rival-' + st.rival, x, y, cls, this.marks, sp * (st.pace ?? 1) * (this.assist ? 0.86 : 1) * this.w.diff.rival * this.mercy()));
        }
        this.progress = `Gates 0/${this.marks.length}`; this.starter = w.p.who;
        break;
      }
      case 'stealth': {
        st.lookouts.forEach(route => { const pts = route.map(s => this.spot(s)); this.actors.push(this.actor('lookout', pts[0][0], pts[0][1], 'fly', pts, 46)); });
        this.meter = { name: 'Alert', v: 0 }; this.phase = 0;
        break;
      }
      case 'collect': this.items = st.items.map(s => { const [x, y] = this.spot(s); return { x, y, got: false, sprite: st.item }; }); this.timer = st.time * k; this.progress = `0/${st.items.length}`;
        if (st.watch) { const [x, y] = this.spot(st.watch); const a = this.actor('window', x, y, 'fly', [], 0); a.b.h = Math.PI / 2; this.actors.push(a); this.meter2 = { name: 'Window lookout', v: 0 }; }
        break;
      case 'heat': {
        w.clearHeat(); addHeat(w, st.level + 0.2, 'story'); w.lastSeen = [w.p.x, w.p.y];
        // a getaway scooter waits right beside you, so a chase starts as a fair race, not a grab on the spot
        if (!w.p.ride && !w.rides.some(r => r.parked && !r.locked && r.kind === 'scooter' && dist(r.b.x, r.b.y, w.p.x, w.p.y) < 200)) { const [rx, ry] = w.rideSpot('scooter', w.p.x + 60, w.p.y); w.addRide('scooter', rx, ry, 0, false, 0, true); }
        break;
      }
      case 'trade': this.base = w.s.stats.profit; this.meter = { name: 'Profit', v: 0 }; if (st.time) this.timer = st.time * k; if (this.m.tip) this.addTip(); break;
      case 'fares': this.count = 0; this.newFare(); break;
      case 'train': w.lastMrt = ''; break;
      case 'cable': w.lastLink = ''; break;
      case 'beat': {
        // the train leaves `from` now and runs the line to `to`; its time is the road trip at a fair scooter pace,
        // longer on Assist, plus the doors closing
        const isle = w.c.isle!, a0 = isle.stations.find(x => x.id === st.from)!, a1 = isle.stations.find(x => x.id === st.to)!;
        const [gx, gy] = this.spot(st.to); const f = w.fieldTo('small', gx, gy);
        const tiles = Math.max(10, f.dist[Math.floor(w.p.y / T) * W + Math.floor(w.p.x / T)] ?? 60);
        const time = (tiles * T / (this.assist ? 205 : 245) + 6) / (this.w.diff.chase || 1) / this.mercy();
        const a = this.actor('train', a0.x, a0.y, 'fly', [], Math.abs(a1.s - a0.s) / time); a.extra = a0.s; a.extra2 = a1.s; a.stun = 4;
        this.actors.push(a); this.meter = { name: 'Train', v: 0 }; w.fx.push({ t: 'train-go' });
        break;
      }
    }
  }
  /** a route's points, each moved to the nearest tile the mover can stand on */
  path(route: Spot[], cls: Body['cls']): [number, number][] {
    return route.map(s => { const [x, y] = this.spot(s); return cls === 'fly' ? [x, y] : nearestFree(this.w.c, cls === 'foot' ? 'walk' : cls, x, y, this.w.open, 6); });
  }
  actor(kind: string, x: number, y: number, cls: Body['cls'], route: [number, number][], speed: number): Actor {
    const v = cls === 'boat' ? VEHICLES.boat : null;
    return { id: this.w.nextId++, kind, b: { x, y, h: 0, speed: 0, r: v ? v.r : cls === 'small' ? 17 : 12, len: v ? v.len : cls === 'small' ? 50 : 0, cls }, route, wp: 0, speed, t: 0, stun: 0, look: 0, lookCd: 5, face: 0, gone: false, hits: 0 };
  }
  /** follow the actor's route with the right flow field; returns true at the last point */
  private stall = new WeakMap<Actor, { wp: number; d: number; t: number }>();
  walk(a: Actor, dt: number, speed: number, loop: boolean): boolean {
    const w = this.w; if (!a.route.length) return true;
    const [gx, gy] = a.route[a.wp];
    // pinned against a prop short of a waypoint (a generated contract's route, lib/jade-proc.ts) for over a second
    // and a half: count the waypoint as reached rather than stand there for ever
    const gd = dist(a.b.x, a.b.y, gx, gy), sk = this.stall.get(a);
    if (!sk || sk.wp !== a.wp || gd < sk.d - 6) this.stall.set(a, { wp: a.wp, d: gd, t: 0 }); else sk.t += dt;
    const st = this.stall.get(a)?.t ?? 0, pinned = !loop && ((gd < T * 3 && st > 1.5) || st > 3);
    if (gd < (a.b.cls === 'foot' ? 22 : 48) || pinned) {
      if (a.wp === a.route.length - 1) { if (!loop) { a.b.speed = 0; return true; } a.wp = 0; } else a.wp++;
    }
    const [tx, ty] = a.route[a.wp];
    let nx = tx, ny = ty;
    if (a.b.cls !== 'fly') {
      const key = `${a.b.cls}:${Math.floor(tx / T)}:${Math.floor(ty / T)}`;
      const f = w.fieldTo(a.b.cls === 'foot' ? 'walk' : a.b.cls as 'small', tx, ty); void key;
      const n = downhill(w.c, f, a.b.x, a.b.y, w.open); if (n) { nx = n[0]; ny = n[1]; }
      if (dist(a.b.x, a.b.y, tx, ty) < T * 1.2) { nx = tx; ny = ty; }
    }
    const dx = nx - a.b.x, dy = ny - a.b.y, l = Math.hypot(dx, dy) || 1;
    if (a.b.cls === 'fly') { a.b.h = Math.atan2(dy, dx); a.b.x += dx / l * Math.min(l, speed * dt); a.b.y += dy / l * Math.min(l, speed * dt); a.b.speed = speed; return false; }
    drive(w.ctx(false, false, false), a.b, dx / l, dy / l, speed, 900, 10, dt, a.b.cls === 'foot');
    return false;
  }

  step(dt: number, inp: Input) {
    const w = this.w, st = this.cur, p = w.p; if (!st || w.talk || w.ui) return;
    void inp;
    if (this.warning) { this.warning.t -= dt; if (this.warning.t <= 0) this.warning = null; }
    if (this.timer !== null) {
      const was = this.timer; this.timer -= dt;
      if (was > 10 && this.timer <= 10) this.warn('Ten seconds left!');
      if (this.timer <= 0) { this.timer = 0; return this.fail(timeUp(st)); }
    }
    const px = p.x, py = p.y, pb = p.ride ? p.ride.b : p.b;
    watchStep(this, dt);
    if (teamStep(this, st, dt)) return;
    if (rideStep(this, st, dt) || trackStep(this, st)) return;
    if (jobStep(this, st, dt)) return;
    switch (st.t) {
      case 'goto': {
        const [x, y] = this.spot(st.at);
        const okRide = !st.ride || (st.ride === 'foot' ? !p.ride : p.ride?.kind === st.ride);
        if (dist(px, py, x, y) < (st.r ?? 72) && !p.roof) { if (okRide) this.next(); else this.label = st.ride === 'foot' ? 'Get off and go on foot' : `You need a ${VEHICLES[st.ride as VehicleKind].name.toLowerCase()}`; }
        break;
      }
      case 'ride': if (p.ride?.kind === st.kind && (!this.ride || p.ride === this.ride || !st.locked)) this.next(); break;
      case 'pickup': {
        const [x, y] = this.spot(st.at);
        if (dist(px, py, x, y) < 56 && !p.act) {
          if (!p.ride) { p.act = { n: 'pickup', t: 0, dur: 0.45, then: () => { p.carry = st.item; this.loot = null; w.fx.push({ t: 'pickup', x, y, kind: st.item.startsWith('h-') ? 'heirloom' : 'item' }); this.next(); } }; }
          else { p.carry = st.item; this.loot = null; w.fx.push({ t: 'pickup', x, y, kind: st.item.startsWith('h-') ? 'heirloom' : 'item' }); this.next(); }
        }
        break;
      }
      case 'deliver': {
        const [x, y] = this.spot(st.to);
        if (st.stink) stinkStep(this, dt);
        if (dist(px, py, x, y) < 90) { p.carry = null; w.fx.push({ t: 'deliver', x, y }); this.next(); }
        break;
      }
      case 'chase': this.chase(st, dt, pb); break;
      case 'float': {
        // the rope: on Assist, a partner who wasn't sent runs for it once you are up on the roof
        if (st.rope && w.assist && p.roof && w.mate.ai.mode !== 'hold') { postMate(this, 'hold', this.spot(st.rope)); w.say(`${nameOf(w.mate.who)} runs for the bunting rope!`, 'good'); }
        floatStep(this, dt);
        if (st.rope && this.float && !this.float.done && p.roof && !holding(this)) this.label = w.mate.ai.mode === 'hold' ? `${nameOf(w.mate.who)} is running for the rope…` : `The float is too far out: send ${nameOf(w.mate.who)} to haul the bunting rope (F)`;
        break;
      }
      case 'raid': raidStep(this, st, dt); break;
      case 'tail': this.tail(dt); break;
      case 'escort': this.escort(st, dt, pb); guardHits(this); break;
      case 'race': {
        const [mx, my] = this.marks[this.mark];
        const okRide = !st.ride || (st.ride === 'foot' ? !p.ride : p.ride?.kind === st.ride);
        if (!okRide) this.label = st.ride === 'foot' ? 'On foot only: get off' : `Race on the ${VEHICLES[st.ride as VehicleKind].name.toLowerCase()}`;
        else this.label = st.label;
        // a relay: the partner waits at the hand-off mark and runs the rest; the starter's marks stop counting there
        const relayed = st.relay !== undefined && this.mark >= st.relay;
        if (relayed && p.who === this.starter) {
          this.label = `Hand off to ${nameOf(w.mate.who)} at the relay mark!`;
          if (dist(px, py, w.mate.x, w.mate.y) < 110 && p.roof === w.mate.roof && !w.two) { w.fx.push({ t: 'handoff', x: px, y: py }); releaseMate(this); w.switchHero(); }
          else if (w.two && dist(px, py, w.mate.x, w.mate.y) < 110) { w.fx.push({ t: 'handoff', x: px, y: py }); const a = w.p; w.p = w.mate; w.mate = a; w.s.hero = w.p.who; }
          break;
        }
        if (okRide && dist(px, py, mx, my) < (st.roof ? 60 : 90) && p.roof === !!st.roof) {
          this.mark++; w.fx.push({ t: 'gate', x: mx, y: my }); this.progress = `Gates ${this.mark}/${this.marks.length}`;
          if (this.mark >= this.marks.length) { w.fx.push({ t: 'win' }); this.next(); return; }
        }
        for (const a of this.actors) {
          if (a.gone) continue;
          const rubber = dist(a.b.x, a.b.y, px, py) > 500 && a.wp > this.mark ? 0.7 : 1;
          // the racer keeps the same rules you do: on Normal and Hard it waits at a red light
          if (w.diff.redLight > 0 && !st.roof && a.kind !== 'rival-boat' && redAhead(w, a.b.x, a.b.y, a.b.h, 60)) { a.b.speed = Math.max(0, a.b.speed - 900 * dt); continue; }
          const end = this.walk(a, dt, a.speed * rubber, false);
          if (end && a.wp === a.route.length - 1) { a.gone = true; return this.fail('The rival got there first! Cut the corners and save your dash for the straights.'); }
          // the rival's progress is a meter beside yours, red when they are ahead, with a warning near the finish
          const ahead = a.wp > this.mark;
          this.meter = { name: 'Rival', v: clamp(a.wp / a.route.length, 0, 1), bad: ahead };
          if (ahead && a.wp >= a.route.length - 2 && this.warned < 1) { this.warned = 1; this.warn('The rival is nearly home! Go all out!'); }
        }
        break;
      }
      case 'stealth': this.stealth(st, dt); break;
      case 'collect': {
        for (const it of this.items) if (!st.high && !it.got && dist(px, py, it.x, it.y) < (p.ride ? 64 : 48)) {
          it.got = true; this.count++; w.fx.push({ t: it.sprite === 'lookout' ? 'spill' : 'pickup', x: it.x, y: it.y });
          if (it.sprite === 'lookout') addHeat(w, 0.4, 'story');
        }
        this.progress = `${this.count}/${this.items.length}`;
        if (this.items.every(i => i.got)) this.next();
        break;
      }
      case 'heat': if (w.heat < 1) this.next(); break;
      case 'trade': { const made = w.s.stats.profit - this.base; this.meter = { name: `Profit ${Math.floor(made)}/${st.profit}`, v: clamp(made / st.profit, 0, 1) }; if (made >= st.profit) this.next(); break; }
      case 'fares': this.fares(st, dt); break;
      case 'train': if (w.lastMrt === st.to) this.next(); break;
      case 'cable': if (w.lastLink === st.to && !w.ferry) this.next(); break;
      case 'beat': {
        const a = this.actors[0]; if (!a) break;
        if (a.stun > 0) { a.stun -= dt; if (a.stun <= 0) this.warn('Doors closing! The train is off!'); }
        else { const dir = Math.sign(a.extra2! - a.extra!); a.extra = dir > 0 ? Math.min(a.extra2!, a.extra! + a.speed * dt) : Math.max(a.extra2!, a.extra! - a.speed * dt); }
        const [x, y, h] = lineAt(w.c.isle!, a.extra!); a.b.x = x; a.b.y = y; a.b.h = h; a.t += dt; a.b.speed = a.stun > 0 ? 0 : a.speed;
        const [gx, gy] = this.spot(st.to);
        this.meter = { name: 'Train', v: clamp(1 - Math.abs(a.extra2! - a.extra!) / Math.max(1, Math.abs(a.extra2! - (w.c.isle!.stations.find(z => z.id === st.from)?.s ?? 0))), 0, 1), bad: true };
        if (dist(px, py, gx, gy) < 120 && !p.roof) { w.fx.push({ t: 'win' }); a.gone = true; if (!p.ride) p.act = { n: 'panting', t: 0, dur: 1.2 }; else w.mate.act = { n: 'panting', t: 0, dur: 1.2 }; this.next(); return; }
        if (a.extra === a.extra2) return this.fail('The train got there first! Cut through the junctions and keep your boost for the straights.');
        if (this.meter.v > 0.75 && this.warned < 1) { this.warned = 1; this.warn('The train is nearly at Toa Payoh!'); }
        break;
      }
    }
  }
  fail(why: string) { this.w.fail(why); }
  /** a warning on screen for three seconds (and a sound); the same text isn't repeated while it shows */
  warn(text: string) { if (this.warning?.text === text) { this.warning.t = 3; return; } this.warning = { text, t: 3 }; this.w.fx.push({ t: 'warn', msg: text }); }

  chase(st: Extract<Step, { t: 'chase' }>, dt: number, pb: Body) {
    const w = this.w, a = this.actors[0]; if (!a) return;
    const d = dist(a.b.x, a.b.y, pb.x, pb.y);
    a.t += dt;
    if (a.stun > 0) { a.stun -= dt; a.b.speed *= 0.94; }
    else {
      let sp = st.speed * (this.assist ? 0.84 : 1) * this.w.diff.chase;
      // the thief eases off when far ahead so a chase stays a chase (less so on Normal, hardly on Hard)
      if (d > 620) sp *= this.assist ? 0.72 : w.s.settings.diff === 'hard' ? 0.94 : 0.86; else if (d < 160) sp *= 1.04;
      // on Normal and Hard everyone keeps to the lights: the thief waits at a red too
      if (w.diff.redLight > 0 && a.kind !== 'boat' && redAhead(w, a.b.x, a.b.y, a.b.h, 60)) a.b.speed = Math.max(0, a.b.speed - 900 * dt);
      else this.walk(a, dt, sp, true);
    }
    // a bump: ride into it, or dash into it on foot
    const reach = a.b.r + pb.r + (this.assist ? 16 : 6);
    const hitting = w.p.ride ? pb.speed > 90 : (w.p.dashT > 0 || w.p.hopT > 0);
    if (a.stun <= 0 && d < reach && hitting) { if (this.chaseHit(a, w.p.ride ? 'bump' : 'you')) return; }
    if (matePounceHit(w) && w.mate.ai.tgt === a.id) { if (this.chaseHit(a, 'mate')) return; }
    if (a.netT) a.netT = Math.max(0, a.netT - dt);
    stepSets(this, dt);
    if (st.who === 'boss' && st.phase) bossStep(this, st, dt);
    // the getaway meter: it fills while the thief is well ahead (faster when far ahead) and drains when you are close
    const far = this.assist ? 1150 : 900, m = this.meter!;
    const fill = 1 / ((this.assist ? 9 : 6) * this.w.diff.lost);
    if (this.grace > 0) this.grace -= dt;
    else if (d > far) m.v += dt * fill * (d > far * 1.5 ? 1.6 : 1); else if (d < 460) m.v -= dt * 0.1;
    m.v = clamp(m.v, 0, 1); m.bad = m.v > 0.6;
    if (m.v > 0.6 && this.warned < 1) { this.warned = 1; this.warn(st.who === 'boat' ? 'The crow boat is pulling away! Close the gap!' : 'They’re getting away! Close the gap!'); }
    if (m.v < 0.3) this.warned = 0;
    if (m.v >= 1) this.fail(st.who === 'boss' ? 'Madame Glint got away! Keep her in sight and dodge what she throws at you.' : 'They got away! Keep the getaway meter low by staying close.');
  }
  /** a hit on the chase target: a bump, your pounce, the partner's pounce, the passenger's grab or a net. A job can
   * ask for its last bump to be a double pounce, a grab or a net; anything else then only trips the thief */
  chaseHit(a: Actor, how: 'bump' | 'you' | 'mate' | 'grab' | 'net'): boolean {
    const w = this.w, st = this.cur as Extract<Step, { t: 'chase' }>, n = nameOf(w.mate.who);
    if (st.t !== 'chase' || a !== this.actors[0]) { a.stun = Math.max(a.stun, 0.6); return false; }
    const trip = (msg: string) => { a.stun = Math.max(a.stun, 0.4); a.b.speed *= 0.5; w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: 0 }); this.warn(msg); return false; };
    if (st.finish === 'pounce') {
      if (how === 'bump' || how === 'grab' || how === 'net') return trip(st.name ? `${st.name[0].toUpperCase() + st.name.slice(1)} wriggles free! Pounce together.` : 'Pip wriggles free! Pounce on him together.');
      const other = how === 'you' ? 'mate' : 'you';
      if (!(a.pz && a.pz.by === other && w.time - a.pz.t < pounceWindow(w))) {
        a.pz = { by: how, t: w.time };
        // on Assist your partner dives in with you when you pounce
        if (how === 'you' && this.assist && w.mate.ai.mode !== 'pounce' && !w.mate.seat && !w.two && dist(w.mate.x, w.mate.y, a.b.x, a.b.y) < 360) pounce(w, a.id);
        return trip(how === 'you' ? `Too slippery for one! Pounce together: F sends ${n} in too.` : `${n} pounced! Dash in now!`);
      }
      a.pz = undefined; w.fx.push({ t: 'double-pounce', x: a.b.x, y: a.b.y });
    }
    const last = a.hits >= st.bumps - 1;
    // a runner on foot with a net finish: no net (or no ammo)? Pouncing on it together works too
    if (last && st.finish === 'net' && st.who === 'runner' && (how === 'you' || how === 'mate')) {
      const other = how === 'you' ? 'mate' : 'you';
      if (!(a.pz && a.pz.by === other && w.time - a.pz.t < pounceWindow(w))) {
        a.pz = { by: how, t: w.time };
        if (how === 'you' && this.assist && w.mate.ai.mode !== 'pounce' && !w.mate.seat && !w.two && dist(w.mate.x, w.mate.y, a.b.x, a.b.y) < 360) pounce(w, a.id);
        return trip(`Net it (click), or pounce together: F sends ${n} in too.`);
      }
      a.pz = undefined; w.fx.push({ t: 'double-pounce', x: a.b.x, y: a.b.y }); how = 'net';
    }
    if (last && st.finish === 'snatch' && how !== 'grab') return trip(`Get alongside and press F: ${n} grabs it off the cart!`);
    if (last && st.finish === 'net' && how !== 'net' && how !== 'grab') return trip(`Tangle the cart in the net, or get alongside so ${n} can grab it (F)!`);
    a.hits++; a.stun = 0.9; this.hits = a.hits; a.b.speed *= 0.4;
    w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: a.hits, kind: how });
    this.progress = chaseProgress(st, a.hits);
    if (a.hits >= st.bumps) {
      // the loot lands where you can reach it the way you're travelling: in the water after a boat chase; a grab
      // or a net puts it straight in your paws
      if (st.loot) {
        if (how === 'grab') { this.loot = null; w.fx.push({ t: 'loot', x: a.b.x, y: a.b.y, kind: st.loot.startsWith('h-') ? 'heirloom' : 'loot' }); this.next(); if (this.cur?.t === 'pickup' && this.cur.at === 'loot') this.grabPickup(); return true; }
        const [lx, ly] = nearestFree(w.c, w.p.ride && onWater(w.p.ride.kind) ? 'boat' : 'foot', a.b.x, a.b.y, w.open, 3); this.loot = { x: lx, y: ly, sprite: st.loot }; w.fx.push({ t: 'loot', x: lx, y: ly, kind: st.loot.startsWith('h-') ? 'heirloom' : 'loot' });
      }
      this.next(); return true;
    }
    return false;
  }
  /** a pick-up step done by the passenger's grab: the item is in your paws without stopping */
  grabPickup() {
    const st = this.cur; if (!st || st.t !== 'pickup') return;
    this.w.p.carry = st.item; this.loot = null; this.w.fx.push({ t: 'pickup', x: this.w.p.x, y: this.w.p.y, kind: st.item.startsWith('h-') ? 'heirloom' : 'item' }); this.next();
  }
  /** the passenger's grab (F on a ride): a thief, a raider, a decoy, a swooping bag-crow, the loot, a high item */
  onGrab(a: Actor | null) {
    const w = this.w, st = this.cur; if (!st) return;
    if (a) {
      if (a.kind === 'raider') return this.raiderCaught(a);
      if (a.kind === 'decoy') { a.gone = true; w.fx.push({ t: 'poof', x: a.b.x, y: a.b.y, kind: 'feather' }); return; }
      if (a.kind === 'bagbird') return dropBag(this, a);
      this.chaseHit(a, 'grab'); return;
    }
    if (st.t === 'pickup' && this.loot && dist(this.loot.x, this.loot.y, w.p.x, w.p.y) < GRAB_REACH * 1.5) return this.grabPickup();
    if (st.t === 'collect') { const it = this.items.filter(i => !i.got).sort((a, b) => dist(a.x, a.y, w.p.x, w.p.y) - dist(b.x, b.y, w.p.x, w.p.y))[0]; if (it && dist(it.x, it.y, w.p.x, w.p.y) < GRAB_REACH * 1.3) this.collectItem(it); }
  }
  collectItem(it: { x: number; y: number; got: boolean; sprite: string }) {
    const w = this.w, st = this.cur as Extract<Step, { t: 'collect' }>;
    it.got = true; this.count++; w.fx.push({ t: it.sprite === 'lookout' ? 'spill' : 'pickup', x: it.x, y: it.y });
    if (it.sprite === 'lookout') addHeat(w, 0.4, 'story');
    this.progress = `${this.count}/${this.items.length}`;
    if (this.items.every(i => i.got)) { void st; this.next(); }
  }
  /** a shot passing close to a high item knocks it down (true: the shot is used up) */
  shotAt(x: number, y: number): boolean {
    const st = this.cur; if (!st || st.t !== 'collect' || !st.high) return false;
    const it = this.items.find(i => !i.got && dist(i.x, i.y, x, y) < 40); if (!it) return false;
    this.collectItem(it); return true;
  }
  raiderCaught(a: Actor) {
    const w = this.w; if (a.stun > 0 || a.gone) return;
    a.stun = 0.8; a.hits = 1; this.count++; w.fx.push({ t: 'shoo', x: a.b.x, y: a.b.y }); w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: 1, kind: 'feather' });
  }
  tail(dt: number) {
    const w = this.w, a = this.actors[0], p = w.p; if (!a) return;
    a.t += dt;
    // Pip hears you (a dash, a hop, running footsteps): he stops and looks straight at the noise (lib/jade-aware.ts)
    const mind = a.mind ?? (a.mind = newMind());
    const heard = a.look <= 0 && this.grace <= 0 ? hear(w, a.b.x, a.b.y) : null;
    if (heard && heard.by !== 'world') { a.look = 1.5; a.lookCd = Math.max(a.lookCd, 3); a.face = Math.atan2(heard.y - a.b.y, heard.x - a.b.x); w.fx.push({ t: 'look', x: a.b.x, y: a.b.y }); w.fx.push({ t: 'aware', kind: 'sus', x: a.b.x, y: a.b.y }); }
    if (a.look > 0) { a.look -= dt; a.b.speed = 0; } else {
      a.lookCd -= dt;
      if (a.lookCd <= 0) { a.look = 1.8; a.lookCd = 5 + (a.id % 4); a.face = a.b.h + Math.PI; w.fx.push({ t: 'look', x: a.b.x, y: a.b.y }); }
      const done = this.walk(a, dt, 74, false);
      if (done && dist(a.b.x, a.b.y, p.x, p.y) < 700) { this.next(); return; }
    }
    const d = dist(a.b.x, a.b.y, p.x, p.y);
    const range = (this.assist ? 165 : 210) * this.w.diff.look;
    // a relay: once Pip is past the corner, he knows the face of the hero who started; the partner waits there
    const st = this.cur as Extract<Step, { t: 'tail' }>;
    // who you tail, as the messages name them: Pip by default, the crow or the courier or a gang's runner otherwise
    const it = !!(st.name || a.skin), Who = st.name ? st.name[0].toUpperCase() + st.name.slice(1) : a.skin ? 'The runner' : 'Pip';
    const he = it ? 'it' : 'he', him = it ? 'it' : 'him';
    const known = !!st.relay && a.wp >= st.relay.at && p.who === this.starter;
    if (known) this.label = `${Who} knows your face now: switch to ${nameOf(w.mate.who)} (Tab), waiting at the corner`;
    else if (st.relay && p.who !== this.starter) { this.label = st.label; if (w.mate.ai.story) releaseMate(this); }
    const facing = a.look > 0 ? a.face : a.b.h;
    const inCone = Math.abs(angDiff(facing, Math.atan2(p.y - a.b.y, p.x - a.b.x))) < (a.look > 0 ? 1.2 : 0.55);
    const sees = !p.hide && d < range && (inCone || d < 60) && los(w.c, a.b.x, a.b.y, p.x, p.y);
    const m = this.meter!;
    if (sees) m.v = Math.min(1, m.v + dt * (p.sneak && !p.ride ? 0.45 : 1.1) * (d < 90 ? 1.8 : 1) * (this.assist ? 0.7 : 1) * this.w.diff.look * (st.calm ?? 1) * (known ? 3 : 1));
    else m.v = Math.max(0, m.v - dt * 0.25);
    m.bad = m.v > 0.6;
    // what the bubble and his cone show: looking round, suspicious, sure
    mind.st = m.v > 0.85 ? 'alert' : m.v > 0.45 ? 'look' : a.look > 0 ? 'sus' : 'patrol'; mind.seen = sees;
    if (m.v > 0.6 && this.warned < 1) { this.warned = 1; this.warn(`${Who} is getting suspicious! Drop back, sneak or hide!`); }
    if (m.v < 0.25 && this.warned === 1) this.warned = 0;
    if (m.v >= 1) return this.fail(`${Who} spotted you! Keep further back, sneak, or hide when ${he} looks round.`);
    // the other way to fail is falling too far behind: a second meter shows how close he is to slipping away
    const dm = st.relay ? Math.min(d, dist(a.b.x, a.b.y, w.mate.x, w.mate.y)) : d;
    this.lost = dm > (this.assist ? 680 : 540) ? this.lost + dt : Math.max(0, this.lost - dt * 2);
    this.meter2 = this.lost > 0 ? { name: `Losing ${him}`, v: Math.min(1, this.lost / 6), bad: this.lost > 3 } : null;
    if (this.lost > 3 && this.warned !== 2) { this.warned = 2; this.warn(`${Who} is slipping away! Keep ${him} in sight!`); }
    if (this.lost > 6) this.fail(`You lost ${it ? Who[0].toLowerCase() + Who.slice(1) : 'him'}. Keep ${him} in sight.`);
  }
  escort(st: Extract<Step, { t: 'escort' }>, dt: number, pb: Body) {
    const w = this.w, lion = this.actors[0]; if (!lion) return;
    lion.t += dt;
    const far = dist(lion.b.x, lion.b.y, pb.x, pb.y) > 420;
    if (!far) { if (this.walk(lion, dt, 52, false) && this.spawned >= st.crows && this.actors.length === 1) { releaseMate(this); this.next(); return; } } else lion.b.speed = 0;
    // the troupe waits for you, but not for ever
    const tm = this.meter2!; const gone = dist(lion.b.x, lion.b.y, pb.x, pb.y) > 520;
    tm.v = clamp(tm.v + (gone ? dt / (this.assist ? 14 : 6.5) : -dt * 0.2), 0, 1); tm.bad = tm.v > 0.5;
    if (tm.v > 0.5 && this.warned < 1) { this.warned = 1; this.warn(this.actors[0]?.skin === 'otter' ? 'The otter pups are waiting for you! Get back to them!' : 'The lion-dance troupe is waiting for you! Get back to them!'); }
    if (tm.v < 0.2) this.warned = 0;
    if (tm.v >= 1) return this.fail(this.actors[0]?.skin === 'otter' ? 'You left the otter pups behind! Stay close to them.' : 'You left the lion-dance troupe behind! Stay close to the lion.');
    if (lion.wp === lion.route.length - 1 && dist(lion.b.x, lion.b.y, lion.route[lion.wp][0], lion.route[lion.wp][1]) < 30 && this.actors.filter(a => a.kind === 'swoop' && !a.gone).length === 0) { releaseMate(this); this.next(); return; }
    this.spawnT -= dt;
    if (this.spawned < st.crows && this.spawnT <= 0) {
      // on two flanks they come in pairs from opposite sides: one for you, one for your partner
      const pair = st.flanks && this.spawned + 1 < st.crows ? 2 : 1;
      this.spawnT = (this.assist ? 6.5 : 5) * (pair === 2 ? 1.5 : 1);
      for (let k = 0; k < pair; k++) {
        const ang = ((this.spawned - k) * 2.4) % (Math.PI * 2) + k * Math.PI;
        const m = this.actor('swoop', lion.b.x + Math.cos(ang) * 560, lion.b.y + Math.sin(ang) * 420, 'fly', [], this.assist ? 105 : 130);
        this.actors.push(m); this.spawned++;
      }
      w.fx.push({ t: 'caw' });
    }
    for (const m of this.actors) {
      if (m.kind !== 'swoop' || m.gone) continue;
      m.t += dt;
      if (m.stun > 0) { m.stun -= dt; m.b.x += Math.cos(m.b.h) * 320 * dt; m.b.y += Math.sin(m.b.h) * 320 * dt; if (m.stun <= 0) m.gone = true; continue; }
      const dx = lion.b.x - m.b.x, dy = lion.b.y - m.b.y, l = Math.hypot(dx, dy) || 1;
      m.b.h = Math.atan2(dy, dx); m.b.x += dx / l * m.speed * dt; m.b.y += dy / l * m.speed * dt;
      const reach = 30 + pb.r + (this.assist ? 18 : 6);
      const hitting = w.p.ride ? pb.speed > 60 : (w.p.dashT > 0 || w.p.hopT > 0 || w.p.b.speed > 150);
      if (dist(m.b.x, m.b.y, pb.x, pb.y) < reach && hitting) { m.stun = 1.2; m.b.h += Math.PI; w.fx.push({ t: 'shoo', x: m.b.x, y: m.b.y }); continue; }
      if (l < 34) { this.envelopes--; m.stun = 1.2; m.b.h += Math.PI; w.fx.push({ t: 'snatch', x: m.b.x, y: m.b.y }); const pups = this.actors[0]?.skin === 'otter'; this.meter = { name: pups ? 'Pups’ snacks' : 'Red envelopes', v: this.envelopes / 5, bad: this.envelopes <= 2 }; if (this.envelopes <= 0) return this.fail(pups ? 'The crows scared off the pups and took every snack!' : 'The crows took every red envelope!'); }
    }
    this.actors = this.actors.filter(a => !a.gone);
    this.progress = `Crows ${this.spawned}/${st.crows}`;
  }
  stealth(st: Extract<Step, { t: 'stealth' }>, dt: number) {
    const w = this.w, p = w.p;
    const range = (this.assist ? 170 : 215) * this.w.diff.look, cone = this.assist ? 0.45 : 0.55;
    // the lookouts walk their beats (pausing at the ends to sweep their torches, Container Maze), hear, look round,
    // chase and call each other (lib/jade-jobs.ts crewWatch); a painted or distracted one sees nothing
    const walk = (a: Actor, dt: number) => {
      a.t += dt;
      if (st.pause && (a.extra ?? 0) > 0) { a.extra = (a.extra ?? 0) - dt; a.b.speed = 0; a.b.h += Math.sin(a.t * 2.2) * dt * 0.9; }
      else if (!((a.stare ?? 0) > 0)) { const wp = a.wp; this.walk(a, dt, 46, true); if (st.pause && a.wp !== wp) a.extra = st.pause; }
      else a.b.speed = 0;
    };
    if (crewWatch(this, dt, { kind: 'lookout', look: false, range, half: cone, walk, calm: st.calm ?? 1, rate: () => p.sneak ? 0.4 : 1,
      warn: 'A lookout is turning your way! Get out of the beam or hide!', spotted: 'A lookout spotted you! Watch their torch beams and sneak.', caught: 'A lookout caught you! When one shouts, run and hide until they give up.' })) return;
    const busy = crewLabel(this);
    if (this.phase === 0) {
      const [gx, gy] = this.spot(st.goal);
      const shut = !!st.shutter && !holding(this);
      this.label = busy ?? (shut ? (w.mate.ai.mode === 'hold' ? `${nameOf(w.mate.who)} is sneaking round to the shutter lever…` : `The office shutter is down: send ${nameOf(w.mate.who)} to hold its lever (F)`) : stealthGoal(st.label));
      if (dist(p.x, p.y, gx, gy) < 60 && !p.act && !shut) { p.act = { n: 'pickup', t: 0, dur: 0.45, then: () => { p.carry = 'manifest'; w.fx.push({ t: 'pickup' }); this.phase = 1; releaseMate(this); this.snap = { ...this.snapshot(this.i), phase: 1 }; w.fx.push({ t: 'checkpoint' }); } }; }
    } else {
      const [ex, ey] = this.spot(st.exit); this.label = busy ?? 'Got it! Now sneak out along the gold line, unseen';
      if (dist(p.x, p.y, ex, ey) < 70) { p.carry = null; this.next(); }
    }
  }
  newFare() {
    const w = this.w; const R = w.R;
    for (let k = 0; k < 200; k++) {
      const a = R() * Math.PI * 2, d = (8 + R() * 8) * T;
      const tx = Math.floor((w.p.x + Math.cos(a) * d) / T), ty = Math.floor((w.p.y + Math.sin(a) * d) / T);
      if (!this.fareOk(tx, ty)) continue;
      this.fare = { x: tx * T + T / 2, y: ty * T + T / 2, to: null, sp: ((unmvT(tx, ty)?.[0] ?? OW) >= OW ? ['tapir', 'mousedeer', 'civet', 'tapir'] : ['rabbit', 'dog', 'cat', 'duck'])[Math.floor(R() * 4)] };
      this.label = `Pick up the fare (${this.count + 1}/${(this.cur as { n: number }).n})`; this.timer = null;
      return;
    }
    const pl = this.w.c.places['bo']; this.fare = { x: pl.x, y: pl.y + T, to: null, sp: 'dog' };
  }
  fareOk(tx: number, ty: number) {
    const w = this.w, o = unmvT(tx, ty); if (!o || o[0] < 1 || o[1] < 1 || o[0] > OLD_W - 3 || o[1] > 90) return false;
    const i = ty * W + tx;
    if (w.c.solid[i] !== S.OPEN || !w.open.has(districtAt(tx, ty)) || w.c.ground[i] === 2) return false;
    // next to a road a big ride can reach
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.c.ground[(ty + dy) * W + tx + dx] === 2) return true;
    return false;
  }
  fares(st: Extract<Step, { t: 'fares' }>, dt: number) {
    const w = this.w, p = w.p, f = this.fare; if (!f) return;
    void dt;
    const seated = p.ride && VEHICLES[p.ride.kind].seats >= 2;
    if (!f.to) {
      if (!seated) this.label = 'You need a ride with a passenger seat (trishaw, tuk-tuk or van)';
      if (seated && dist(p.x, p.y, f.x, f.y) < 130 && p.ride!.b.speed < 110) {
        w.fx.push({ t: 'fare-in', x: f.x, y: f.y });
        for (let k = 0; k < 300; k++) {
          const a = w.R() * Math.PI * 2, d = (12 + w.R() * 10) * T;
          const tx = Math.floor((p.x + Math.cos(a) * d) / T), ty = Math.floor((p.y + Math.sin(a) * d) / T);
          if (this.fareOk(tx, ty)) { f.to = [tx * T + T / 2, ty * T + T / 2]; break; }
        }
        if (!f.to) { const pl = w.c.places['bo']; f.to = [pl.x, pl.y]; }
        this.timer = (dist(p.x, p.y, f.to[0], f.to[1]) / 160 + 12) * (this.assist ? 1.5 : this.w.diff.timer * 1.75);
        this.label = `Drive the fare home (${this.count + 1}/${st.n})`;
      }
    } else if (dist(p.x, p.y, f.to[0], f.to[1]) < 100) {
      this.count++; w.s.cash += 15; w.fx.push({ t: 'fare-out', x: f.to[0], y: f.to[1] }); w.say('Fare paid +15 coins', 'good');
      if (this.count >= st.n) { this.fare = null; this.next(); return; }
      this.newFare();
    }
  }

  // ── hooks from the world
  bumpT = -9;
  onBump(k: number, what: string) {
    const st = this.cur; if (!st || st.t !== 'deliver' || !st.fragile) return;
    if (k < 150 && what === 'wall') return;
    // one knock counts once: scraping along the same wall (or a second jolt from the same crash) within a moment is free
    if (this.w.time - this.bumpT < 0.8) return;
    this.bumpT = this.w.time;
    this.hits++; this.meter = { name: 'Wobble', v: this.hits / st.fragile, bad: this.hits >= st.fragile - 2 };
    this.w.fx.push({ t: 'wobble', x: this.w.p.x, y: this.w.p.y });
    if (this.hits === st.fragile - 2) this.warn(st.item === 'cake' ? 'The cake is wobbling! Two more bumps and it topples!' : 'Careful! Two more bumps and it’s ruined!');
    if (this.hits >= st.fragile) this.fail(st.item === 'cake' ? 'Splat! The cake toppled. Smoother driving!' : st.item === 'crate' ? 'The mangoes are bruised to pulp! Steer round the bumps.' : 'Crash! The pots broke. Gently round the corners!');
  }
  onCarTouch(_c: Car) { }
  onEnter(_r: Ride) { }
  onHeatClear() { }
  onMini(ok: boolean) {
    if (jobMini(this, ok)) return;
    const st = this.cur; if (!st || st.t !== 'mini') return;
    if (ok) this.next();
    else { this.w.say('Not quite! Have another go.', 'bad'); this.w.ui = { kind: 'mini', mini: st.kind, level: st.level, from: 'mission' }; }
  }
  // ── the duo and the gadgets (lib/jade-team.ts)
  tagOption(): TagOpt | null { return rideTag(this) ?? jobTag(this) ?? teamTag(this); }
  guardGoal(m: Player) { return jobGuardGoal(this, m) ?? guardGoal(this, m); }
  postRoof(goal: [number, number]) { return (this.w.c.flags[Math.floor(goal[1] / T) * W + Math.floor(goal[0] / T)] & F_ROOF) > 0; }
  holdAnim() { const st = this.cur; return st?.t === 'float' ? 'haul' : 'hold'; }
  noSwitch(): string | null { return null; }
  onSwitch() { }
  onGadget(a: Actor, g: GadgetId, pw: number, x: number, y: number) { return jobGadget(this, a, g, pw, x, y) || onGadget(this, a, g, pw, x, y); }
  onBurst(g: GadgetId, x: number, y: number, r: number) { onBurst(this, g, x, y, r); }
  nearAction(x: number, y: number): Near | null { return this.cur?.t === 'float' ? floatNear(this, x, y) : this.cur?.t === 'track' ? trackNear(this, x, y) : jobNear(this, x, y); }
  /** E on one of the job steps' things (a photo, a witness, a crate) */
  jobAct(id: string) { if (!trackAct(this, id)) jobAct(this, id); }
  walkOnly() { return walkOnly(this); }
  heistPick(mode: 'quiet' | 'loud') { heistPick(this, mode); }
  branchPick(pick: BranchPick) { branchPick(this, pick); }
  askPick(q: number) { askPick(this, q); }
  askClose() { askClose(this); }
  /** a hop off the roof edge near a flag, or the Action button on a flag, during the float phase */
  leap(fromHop = false) { return this.cur?.t === 'float' && tryLeap(this, fromHop); }
  wantsRide() { return false; }
  /** what the route arrow points at */
  target(): [number, number] | null {
    const st = this.cur; if (!st) return null; const w = this.w;
    const jt = jobTarget(this); if (jt !== undefined) return jt;
    const rt = this.cur?.t === 'track' ? trackTarget(this) : rideTarget(this); if (rt !== undefined) return rt;
    switch (st.t) {
      case 'goto': return this.spot(st.at);
      case 'ride': return this.ride && this.ride.parked ? [this.ride.b.x, this.ride.b.y] : null;
      case 'pickup': return this.spot(st.at);
      case 'deliver': return this.spot(st.to);
      case 'chase': case 'tail': return this.actors[0] ? [this.actors[0].b.x, this.actors[0].b.y] : null;
      case 'escort': return this.actors[0] ? [this.actors[0].b.x, this.actors[0].b.y] : null;
      case 'race': return this.marks[this.mark] ?? null;
      case 'stealth': return this.phase === 0 ? this.spot(st.goal) : this.spot(st.exit);
      case 'collect': { const it = this.items.filter(i => !i.got).sort((a, b) => dist(a.x, a.y, w.p.x, w.p.y) - dist(b.x, b.y, w.p.x, w.p.y))[0]; return it ? [it.x, it.y] : null; }
      case 'heat': return null;
      case 'trade': return null;
      case 'float': { if (!w.p.roof) return [LADDER[0] * T + T / 2, LADDER[1] * T + T / 2]; const f = this.float; if (!f) return null; const i = inWindow(this); if (i >= 0) return leapSpot(i); const spots = [0, 1, 2].map(leapSpot).filter(s => s[0] < f.x - 40); return spots[0] ?? leapSpot(2); }
      case 'raid': { const a = this.actors.filter(x => !x.gone && x.stun <= 0).sort((a, b) => dist(a.b.x, a.b.y, w.p.x, w.p.y) - dist(b.b.x, b.b.y, w.p.x, w.p.y))[0]; return a ? [a.b.x, a.b.y] : null; }
      case 'fares': return this.fare ? (this.fare.to ?? [this.fare.x, this.fare.y]) : null;
      case 'train': { const isle = w.c.isle; if (!isle) return null; const here = stationNear(w); if (here && here.id !== st.to) return null; const s = isle.stations.filter(x => x.id !== st.to && w.open.has(x.d)).sort((a, b) => dist(a.x, a.y, w.p.x, w.p.y) - dist(b.x, b.y, w.p.x, w.p.y))[0]; return s ? [s.x, s.y] : null; }
      case 'beat': return this.spot(st.to);
      case 'cable': { const l = linkById(w, st.to); if (!l) return null; const from = l.link.stops.find(q => q.id !== st.to)!; return w.ferry ? null : [from.x, from.y]; }
      default: return null;
    }
  }
  aimAt(): [number, number] | null {
    const st = this.cur; if (!st) return null;
    if (st.t === 'chase' && this.actors[0]) return [this.actors[0].b.x, this.actors[0].b.y];
    if (st.t === 'raid') return this.target();
    if (st.t === 'defend') return jobAim(this);
    if (st.t === 'escort') { const m = this.actors.filter(a => a.kind === 'swoop' && a.stun <= 0).sort((a, b) => dist(a.b.x, a.b.y, this.w.p.x, this.w.p.y) - dist(b.b.x, b.b.y, this.w.p.x, this.w.p.y))[0]; return m ? [m.b.x, m.b.y] : null; }
    return null;
  }
}


/** a stealth step's way in, from its label ("Send {mate} to the gate lever (F), reach the fort unseen, then get out"
 * reads "Reach the fort unseen" once the gate is open) */
export function stealthGoal(label: string) {
  const s = label.replace(/^Send \{mate\} to [^,]*, /, '').replace(/, then get out$/, '');
  return s[0].toUpperCase() + s.slice(1);
}
/** what the failure card says when a step's timer runs out */
function timeUp(st: Step): string {
  if (st.t === 'deliver') return st.item === 'cake' ? 'The cake melted!' : st.item === 'crate' ? 'Chef Mo’s queue gave up waiting for the mangoes!' : 'Out of time! The parcel was too late.';
  if (st.t === 'trade') return 'Out of time! The buyers went elsewhere. Buy low, ride quickly, sell high.';
  if (st.t === 'goto') return st.label.includes('crows') ? 'Too slow! The crows cleared out the till.' : 'The jump-start faded before you got there!';
  if (st.t === 'collect') return 'Out of time! Grab them in the order the gold line suggests.';
  if (st.t === 'race') return 'Out of time! Cut the corners and use your boost.';
  if (st.t === 'fares') return 'The fare got fed up and walked! Drive them home quicker.';
  if (st.t === 'detective') return 'Out of time! Ask the right question, then search only the spot that fits every clue.';
  if (st.t === 'swap') return `Out of time! The ${st.thing ?? 'crate'}s are being moved. Swap each one the moment it says Go!, and send your partner (F) at a ${swapNoun(st.skin)} in your way.`;
  if (st.t === 'heist') return 'Out of time! The crows got back on their feet. Head straight for the safe.';
  if (st.t === 'track') return 'The rain washed the prints away! Read each set (E), then head the way it says.';
  return 'Out of time!';
}

/** the chase counter: the plain bumps, then the finishing move on its own (a job that says "bump twice, then net
 * it" shows "Bumps 0/2 · then net it", never "Bumps 0/3") */
export function chaseProgress(st: { bumps: number; finish?: 'pounce' | 'snatch' | 'net' }, hits: number): string {
  if (!st.finish) return `Bumps ${hits}/${st.bumps}`;
  const n = st.bumps - 1, fin = { pounce: 'pounce together', snatch: 'grab it (F)', net: 'net it' }[st.finish];
  return hits >= st.bumps ? `Bumps ${n}/${n} · done` : hits >= n ? `Now ${fin}!` : `Bumps ${hits}/${n} · then ${fin}`;
}

/** a stinky cargo (the durians): a smell cloud left every so often, and any warden who comes near it grows curious.
 * The heat it adds stops short of a lantern, so it never starts a chase on its own; the wardens' sight does the rest */
function stinkStep(r: Run, dt: number) {
  const w = r.w, p = w.p;
  r.base += dt;
  if (r.base > 1.4) { r.base = 0; w.splats.push({ x: p.x + (w.R() - 0.5) * 20, y: p.y + 10, sprite: 'stink-cloud', t: 0, life: 7, rot: 0 }); w.fx.push({ t: 'stink', x: p.x, y: p.y }); }
  const near = w.wardens.some(wd => !wd.leave && wd.stun <= 0 && w.splats.some(sp => sp.sprite === 'stink-cloud' && Math.hypot(sp.x - wd.b.x, sp.y - wd.b.y) < 120));
  if (near && w.heat < 0.85) { w.heat = Math.min(0.85, w.heat + dt * (w.assist ? 0.05 : 0.09)); if (!r.warning) r.warning = { text: 'A warden sniffs the air… keep moving!', t: 2 }; }
}

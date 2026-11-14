// Jade Street: the world. One deterministic step (fixed 1/60 s) moves Dora or Enzo on foot or on any ride, the
// traffic and townsfolk, the wardens and the heat, the story job or side gig in progress, the night clock and the
// magpies who swoop for your cargo. Everything the page and the scene need is read from here; the page sends input
// and commands (interact, trade, garage, safe house). No DOM. Mission logic: lib/jade-mission.ts; traffic:
// lib/jade-traffic.ts; heat and wardens: lib/jade-heat.ts.
import { city as getCityOnce, T, W, H, S, F_ROOF, F_ALLEY, districtAt, DISTRICT_NAME, type City, type District } from './jade-city.js';
import { VEHICLES, FOOT, drive, step as moveStep, obstacleGrid, shove, overlapping, type Body, type Ctx, type VehicleKind, type Obstacle } from './jade-move.js';
import { nearestFree, field, pathFrom, type Field } from './jade-nav.js';
import { rng, clamp, angDiff, dist } from './jade-rng.js';
import { cargoCount, cargoValue, capacity, GOODS, GOOD, midPrice, prices, buy as tBuy, sell as tSell, moveGoods, type Good } from './jade-trade.js';
import { type Save, type Hero, openDistricts, available, addRep, checkTrophies, safeOpen, SAFE_HOUSES, DAILY_NEED, dailyEvent } from './jade-save.js';
import { MISSION, PEOPLE, type Mission } from './jade-story.js';
import { Run, type Gig } from './jade-mission.js';
import { trafficStep, pedStep, type Car, type Ped } from './jade-traffic.js';
import { heatStep, addHeat, caught, type Warden, type Roadblock } from './jade-heat.js';

export const DT = 1 / 60;
export type Input = { mx: number; my: number; sneak: boolean; dash: boolean; hop: boolean; act: boolean };
export const NO_INPUT: Input = { mx: 0, my: 0, sneak: false, dash: false, hop: false, act: false };
export type Ride = { id: number; kind: VehicleKind; b: Body; parked: boolean; locked: boolean; tint: number; mission?: boolean; seen?: number };
export type Fx = { t: string; x?: number; y?: number; k?: number; msg?: string; kind?: string; name?: string };
export type Near = { kind: 'mission' | 'market' | 'safe' | 'garage' | 'ladder-up' | 'ladder-down' | 'hide' | 'unhide' | 'mural' | 'ride' | 'exit' | 'gig' | 'buy-safe'; label: string; x: number; y: number; id?: string; ride?: Ride };
export type Snatcher = { x: number; y: number; h: number; t: number; out: boolean; took: number; wing: number };
export type Act = { n: string; t: number; dur: number; then?: () => void };
export type UiPanel = null | { kind: 'market'; d: District } | { kind: 'safe'; id: string } | { kind: 'garage'; id: string } | { kind: 'mini'; mini: string; level: number; from: 'mission' | 'gig' | 'ride' } | { kind: 'map' };

export class Player {
  b: Body = { x: 0, y: 0, h: Math.PI / 2, speed: 0, r: FOOT.r, len: 0, cls: 'foot' };
  ride: Ride | null = null; roof = false; lastRoof: [number, number] = [0, 0];
  dashT = 0; dashCd = 0; hopT = 0; hopCd = 0; boostT = 0; boostCd = 0;
  hide = false; sneak = false; act: Act | null = null; carry: string | null = null;
  anim = 'idle'; animT = 0; face: 'down' | 'up' | 'side' = 'down'; flip = false; bumpT = 0;
  get x() { return this.ride ? this.ride.b.x : this.b.x; }
  get y() { return this.ride ? this.ride.b.y : this.b.y; }
  get air() { return this.hopT > 0; }
}

export class World {
  c: City; obs: Obstacle[][]; s: Save; R: () => number;
  p = new Player(); rides: Ride[] = []; cars: Car[] = []; peds: Ped[] = []; wardens: Warden[] = []; blocks: Roadblock[] = []; snatchers: Snatcher[] = [];
  heat = 0; seenT = 0; lastSeen: [number, number] = [0, 0]; blimp: { x: number; y: number; on: boolean } = { x: 0, y: 0, on: false };
  run: Run | null = null; talk: { lines: [string, string][]; i: number; done?: () => void } | null = null;
  ui: UiPanel = null; near: Near | null = null; fx: Fx[] = [];
  time = 0; tick = 0; nextId = 1; open: Set<District>; route: [number, number][] = []; routeT = 0;
  failed: { reason: string } | null = null; banner: { text: string; sub: string; t: number } | null = null;
  snatchT = 20; spawnT = 0; daySales: Record<string, number> = {}; profitBase = 0; tripCost: Record<Good, number>;
  private fieldCache = new Map<string, Field>();
  quiet = false;

  constructor(save: Save, seed = save.seed) {
    this.c = getCityOnce(); this.obs = obstacleGrid(this.c); this.s = save; this.R = rng(seed * 7919 + save.night);
    this.open = new Set(openDistricts(save));
    this.tripCost = { jade: 0, mooncake: 0, tea: 0, bowl: 0, fan: 0, mango: 0 };
    for (const g of GOODS) this.tripCost[g] = save.cargo[g] * GOOD[g].base;
    // parked rides: every kerb spot in an open district, some scooters need a jump-start
    const R = rng(seed + 11);
    for (const pk of this.c.parking) this.addRide(pk.kind as VehicleKind, pk.x, pk.y, pk.rot, R() < 0.18 && pk.kind === 'scooter', Math.floor(R() * 5));
    const home = this.c.places[save.safe] ?? this.c.places['safe-market'];
    this.placePlayer(home.x, home.y + T * 0.6);
  }
  get assist() { return this.s.settings.assist; }
  get easy() { return this.s.settings.diff === 'easy'; }
  addRide(kind: VehicleKind, x: number, y: number, h: number, locked = false, tint = 0, mission = false): Ride {
    const v = VEHICLES[kind];
    const r: Ride = { id: this.nextId++, kind, b: { x, y, h, speed: 0, r: v.r, len: v.len, cls: v.cls }, parked: true, locked, tint, mission };
    this.rides.push(r); return r;
  }
  say(msg: string, kind = '') { this.fx.push({ t: 'toast', msg, kind }); }
  ctx(roof = false, air = false): Ctx { return { c: this.c, roof, air, obstacles: this.obs, blocked: (tx, ty) => !this.open.has(districtAt(tx, ty)) }; }
  fieldTo(cls: 'foot' | 'walk' | 'small' | 'big' | 'boat', x: number, y: number): Field {
    const tx = Math.floor(x / T), ty = Math.floor(y / T); const key = `${cls}:${tx}:${ty}:${[...this.open].join()}`;
    let f = this.fieldCache.get(key);
    if (!f) { f = field(this.c, cls, tx, ty, this.open); this.fieldCache.set(key, f); if (this.fieldCache.size > 40) this.fieldCache.delete(this.fieldCache.keys().next().value!); }
    return f;
  }
  /** a free tile for a new ride near (x,y), clear of every other ride */
  rideSpot(kind: VehicleKind, x: number, y: number): [number, number] {
    return nearestFree(this.c, VEHICLES[kind].cls, x, y, this.open, 10, (cx, cy) => this.rides.some(r => dist(r.b.x, r.b.y, cx, cy) < 90));
  }
  placePlayer(x: number, y: number) {
    const [fx, fy] = nearestFree(this.c, 'foot', x, y, this.open);
    this.p.b.x = fx; this.p.b.y = fy; this.p.b.speed = 0; this.p.roof = false; this.p.hide = false;
  }
  /** the player's current move class and capacity */
  get mode() { return this.p.ride ? this.p.ride.kind : 'foot'; }
  cap() { const v = this.p.ride ? VEHICLES[this.p.ride.kind].cargo : FOOT.cargo; return capacity(v, this.s.upgrades.cargo, !this.p.ride); }
  overloaded() { return cargoCount(this.s.cargo) > this.cap(); }

  // ── the step
  step(inp: Input, dt = DT) {
    if (this.talk || this.ui || this.failed) return;
    this.time += dt; this.tick++;
    this.s.stats.playTime += dt;
    this.clock(dt);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.playerStep(inp, dt);
    this.collectStep();
    trafficStep(this, dt); pedStep(this, dt);
    heatStep(this, dt);
    if (this.run) this.run.step(dt, inp);
    this.snatchStep(dt);
    this.findNear();
    if (inp.act) this.interact();
    this.routeT -= dt; if (this.routeT <= 0) { this.routeT = 0.5; this.updateRoute(); }
    for (const n of checkTrophies(this.s)) this.fx.push({ t: 'trophy', name: n });
    if (this.fx.length > 300) this.fx.splice(0, this.fx.length - 300);
  }
  /** events since the last drain (the scene and sound read these) */
  drain(): Fx[] { const out = this.fx; this.fx = []; return out; }

  clock(dt: number) {
    this.s.clock += dt * (this.assist ? 0.85 : 1); // one game minute a second; 12 h nights
    if (this.s.clock >= 720) this.newNight();
  }
  newNight() {
    this.s.clock = 0; this.s.night++;
    this.s.tips = this.s.tips.filter(t => t.night >= this.s.night - 1);
    this.banner = { text: `Night ${this.s.night}`, sub: 'The markets set new prices', t: 3 };
    this.fx.push({ t: 'night' });
  }

  // ── the player
  playerStep(inp: Input, dt: number) {
    const p = this.p;
    p.animT += dt;
    if (p.act) {
      p.act.t += dt; p.anim = p.act.n;
      if (p.act.t >= p.act.dur) { const f = p.act.then; p.act = null; f?.(); }
      return;
    }
    p.dashCd = Math.max(0, p.dashCd - dt); p.hopCd = Math.max(0, p.hopCd - dt); p.boostCd = Math.max(0, p.boostCd - dt); p.bumpT = Math.max(0, p.bumpT - dt);
    if (p.hide) { p.anim = 'hide'; if (Math.hypot(inp.mx, inp.my) > 0.5) this.unhide(); return; }
    let mx = inp.mx, my = inp.my;
    if (p.ride) return this.rideStep(inp, dt);
    // on foot
    p.sneak = inp.sneak;
    if (inp.dash && p.dashCd <= 0 && !p.air) { p.dashT = FOOT.dashT; p.dashCd = FOOT.dashCd; this.fx.push({ t: 'dash', x: p.b.x, y: p.b.y }); if (Math.hypot(mx, my) < 0.2) { mx = Math.cos(p.b.h); my = Math.sin(p.b.h); } }
    if (inp.hop && p.hopCd <= 0 && !p.air) { p.hopT = FOOT.hopT; p.hopCd = FOOT.hopCd + FOOT.hopT; this.fx.push({ t: 'hop', x: p.b.x, y: p.b.y }); }
    const over = this.overloaded();
    let top = p.sneak ? FOOT.walk : FOOT.run;
    if (over) top = FOOT.walk * 0.75;
    if (p.dashT > 0) { p.dashT -= dt; top = FOOT.dash; if (Math.hypot(mx, my) < 0.2) { mx = Math.cos(p.b.h); my = Math.sin(p.b.h); } }
    if (p.air) { p.hopT -= dt; if (Math.hypot(mx, my) < 0.2 && p.b.speed > 40) { mx = Math.cos(p.b.h); my = Math.sin(p.b.h); } top = Math.max(top, 230); }
    const wasAir = p.air;
    const ctx = this.ctx(p.roof, p.air || wasAir);
    const ox = p.b.x, oy = p.b.y;
    const res = drive(ctx, p.b, mx, my, top, 2400, 30, dt, true);
    if (res.bump > 160 && !p.air) { p.bumpT = 0.3; this.fx.push({ t: 'bump', x: p.b.x, y: p.b.y, k: 0.5 }); }
    const moved = Math.hypot(p.b.x - ox, p.b.y - oy); this.s.stats.walked += moved;
    // landing from a hop: on a roof you must land on a roof; in the street you can't land in a low prop
    if (wasAir && !p.air) this.land();
    if (p.roof && !p.air) { const tx = Math.floor(p.b.x / T), ty = Math.floor(p.b.y / T); if (this.c.flags[ty * W + tx] & F_ROOF) p.lastRoof = [p.b.x, p.b.y]; }
    // facing and animation
    if (p.b.speed > 8) this.faceFrom(p.b.h);
    p.anim = p.air ? 'hop' : p.dashT > 0 ? 'dash' : p.bumpT > 0 ? 'bump' : p.b.speed > 8 ? (p.carry ? 'carry' : p.sneak ? 'sneak' : p.b.speed > FOOT.walk + 10 ? 'run' : 'walk') : (p.carry ? 'carry-idle' : 'idle');
  }
  land() {
    const p = this.p; const tx = Math.floor(p.b.x / T), ty = Math.floor(p.b.y / T);
    const i = ty * W + tx;
    if (p.roof && !(this.c.flags[i] & F_ROOF)) {
      p.b.x = p.lastRoof[0]; p.b.y = p.lastRoof[1]; p.b.speed = 0; this.fx.push({ t: 'wobble', x: p.b.x, y: p.b.y }); this.say('Whoa! Back onto the roof.');
      return;
    }
    if (!p.roof && this.c.solid[i] === S.LOW) {
      // landed on a crate or hedge: hop on through in the direction of travel
      p.hopT = 0.12;
    }
    if (overlapping(this.ctx(p.roof, false), p.b)) { const [x, y] = nearestFree(this.c, 'foot', p.b.x, p.b.y, this.open, 3); if (!p.roof) { p.b.x = x; p.b.y = y; } }
  }
  faceFrom(h: number) {
    const p = this.p; const cx = Math.cos(h), sy = Math.sin(h);
    if (Math.abs(cx) > Math.abs(sy) * 0.9) { p.face = 'side'; p.flip = cx < 0; } else { p.face = sy > 0 ? 'down' : 'up'; }
  }
  rideStep(inp: Input, dt: number) {
    const p = this.p, r = p.ride!; const v = VEHICLES[r.kind];
    const up = this.s.upgrades;
    let top = v.speed * (1 + up.speed * 0.07) * (this.overloaded() ? 0.75 : 1);
    const turn = v.turn * (1 + up.grip * 0.1);
    if (inp.dash && p.boostCd <= 0) { p.boostT = 0.7; p.boostCd = 2.4; this.fx.push({ t: 'boost', x: r.b.x, y: r.b.y }); }
    if (inp.hop) this.honk();
    if (p.boostT > 0) { p.boostT -= dt; top *= 1.35; }
    let mx = inp.mx, my = inp.my;
    if (p.boostT > 0 && Math.hypot(mx, my) < 0.2) { mx = Math.cos(r.b.h); my = Math.sin(r.b.h); }
    // aim help: when chasing, lean the stick toward a close target that is roughly ahead
    if (this.assist && this.run) { const a = this.run.aimAt(); if (a) { const d = dist(a[0], a[1], r.b.x, r.b.y); const ang = Math.atan2(a[1] - r.b.y, a[0] - r.b.x); const want = Math.atan2(my, mx); if (d < 170 && Math.hypot(mx, my) > 0.3 && Math.abs(angDiff(want, ang)) < 0.6) { mx = mx * 0.6 + Math.cos(ang) * 0.4; my = my * 0.6 + Math.sin(ang) * 0.4; } } }
    const ox = r.b.x, oy = r.b.y;
    const res = drive(this.ctx(), r.b, mx, my, top, v.accel * (1 + up.speed * 0.05), turn, dt, false);
    const moved = Math.hypot(r.b.x - ox, r.b.y - oy);
    if (r.kind === 'boat') this.s.stats.boated += moved; else this.s.stats.driven += moved;
    if (res.bump > 110) this.bumped(res.bump, r.b.x - res.nx * r.b.r, r.b.y - res.ny * r.b.r, 'wall');
    this.faceFrom(r.b.h);
    p.anim = p.bumpT > 0 ? 'ride-bump' : 'ride';
    p.b.x = r.b.x; p.b.y = r.b.y;
  }
  bumped(k: number, x: number, y: number, what: string) {
    const p = this.p;
    if (p.bumpT > 0) return;
    p.bumpT = 0.35; this.s.stats.bumps++;
    this.fx.push({ t: 'bump', x, y, k: Math.min(1, k / 300), kind: what });
    this.run?.onBump(k, what);
    // smashing a stall at speed brings the wardens
    if (what === 'wall') {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (ty + dy) * W + tx + dx; if (this.c.solid[i] === S.TALL && k > 170) { addHeat(this, 0.45, 'stall'); this.fx.push({ t: 'spill', x, y }); return; } }
    }
  }
  honk() { if (this.p.boostCd > 2.1) return; this.fx.push({ t: 'honk', x: this.p.x, y: this.p.y }); for (const pd of this.peds) if (dist(pd.x, pd.y, this.p.x, this.p.y) < 220) pd.scare = 1; }

  // ── getting on and off
  enter(r: Ride) {
    const p = this.p;
    if (r.locked) { this.ui = { kind: 'mini', mini: 'wires', level: 1, from: 'ride' }; this.pendingRide = r; this.fx.push({ t: 'mini' }); return; }
    p.act = { n: 'climb-on', t: 0, dur: 0.32, then: () => { p.ride = r; r.parked = false; p.b.x = r.b.x; p.b.y = r.b.y; p.hide = false; this.fx.push({ t: 'enter', kind: r.kind }); this.run?.onEnter(r); } };
    p.face = 'side'; p.flip = r.b.x < p.b.x;
    // walk the hero onto the seat during the climb
    p.b.x = r.b.x; p.b.y = r.b.y;
  }
  pendingRide: Ride | null = null;
  miniDone(ok: boolean) {
    const ui = this.ui; this.ui = null;
    this.s.stats.minis++;
    if (!ui || ui.kind !== 'mini') return;
    if (ui.from === 'ride') { const r = this.pendingRide; this.pendingRide = null; if (ok && r) { r.locked = false; this.enter(r); this.fx.push({ t: 'start-engine' }); } else this.say('The wires fizzled. Try again, or find another ride.'); return; }
    this.run?.onMini(ok);
  }
  exit(): boolean {
    const p = this.p, r = p.ride; if (!r) return false;
    // find a free spot beside the ride (side first, then anywhere close)
    const side = r.b.h + Math.PI / 2;
    const tries: [number, number][] = [[r.b.x + Math.cos(side) * (r.b.r + 18), r.b.y + Math.sin(side) * (r.b.r + 18)], [r.b.x - Math.cos(side) * (r.b.r + 18), r.b.y - Math.sin(side) * (r.b.r + 18)]];
    let spot: [number, number] | null = null;
    for (const [x, y] of tries) { const b = { ...p.b, x, y }; if (!overlapping(this.ctx(), b)) { spot = [x, y]; break; } }
    if (!spot) { const [x, y] = nearestFree(this.c, 'foot', r.b.x, r.b.y, this.open, r.kind === 'boat' ? 2 : 4); if (Math.hypot(x - r.b.x, y - r.b.y) > T * 2.6 || this.c.solid[Math.floor(y / T) * W + Math.floor(x / T)] !== S.OPEN) { this.say(r.kind === 'boat' ? 'Steer to the bank or a jetty to step off.' : 'No room to get off here.', 'bad'); return false; } spot = [x, y]; }
    r.parked = true; r.b.speed = 0; p.ride = null;
    p.b.x = spot[0]; p.b.y = spot[1]; p.b.speed = 0; p.b.h = side;
    p.act = { n: 'climb-off', t: 0, dur: 0.3 };
    this.fx.push({ t: 'exit', kind: r.kind });
    return true;
  }

  // ── things you walk into
  collectStep() {
    const p = this.p; const x = p.x, y = p.y;
    this.c.cats.forEach((c, i) => {
      if (this.s.cats.includes(i) || Math.abs(c.x - x) > 40 || Math.abs(c.y - y) > 40) return;
      const onRoof = (this.c.flags[Math.floor(c.y / T) * W + Math.floor(c.x / T)] & F_ROOF) > 0;
      if (onRoof !== p.roof) return;
      if (!this.open.has(districtAt(Math.floor(c.x / T), Math.floor(c.y / T)))) return;
      this.s.cats.push(i); this.s.cash += 25; this.s.stats.cats++;
      this.fx.push({ t: 'cat', x: c.x, y: c.y }); this.say(`Lucky cat ${this.s.cats.length} of 50! +25 coins`, 'good');
    });
  }

  // ── interaction: what's in reach, and pressing the action button
  findNear() {
    const p = this.p, x = p.x, y = p.y; let best: Near | null = null, bd = 1e9;
    const cand = (n: Near, r: number) => { const d = dist(n.x, n.y, x, y); if (d < r && d < bd) { bd = d; best = n; } };
    if (p.hide) { this.near = { kind: 'unhide', label: 'Come out', x, y }; return; }
    if (p.ride) {
      if (this.run?.wantsRide()) { this.near = null; }
      for (const id of ['garage-market', 'garage-canal']) { const g = this.c.places[id]; if (this.open.has(g.d)) cand({ kind: 'garage', label: 'Garage: upgrades and paint', x: g.x, y: g.y, id }, 110); }
      // markets are drive-up: trade from the saddle
      if (p.ride.kind !== 'boat') for (const pl of Object.values(this.c.places)) if (pl.kind === 'market' && this.open.has(pl.d)) cand({ kind: 'market', label: `Trade at ${pl.name}`, x: pl.x, y: pl.y, id: pl.d }, 120);
      if (!best) best = { kind: 'exit', label: p.ride.kind === 'boat' ? 'Step off the boat' : 'Get off', x, y };
      this.near = best; return;
    }
    if (p.roof) { for (const l of this.c.ladders) cand({ kind: 'ladder-down', label: 'Climb down', x: l.rx * T + T / 2, y: l.ry * T + T / 2 }, 70); this.near = best; return; }
    if (!this.run) for (const m of available(this.s)) { const pl = this.c.places[m.at]; if (pl) cand({ kind: 'mission', label: `${PEOPLE[m.giver].name}: “${m.title}”`, x: pl.x, y: pl.y, id: m.id }, 80); }
    const rm = this.run?.nearAction(x, y); if (rm) cand(rm, 90);
    for (const [id, pl] of Object.entries(this.c.places)) {
      if (!this.open.has(pl.d)) continue;
      if (pl.kind === 'market') cand({ kind: 'market', label: `Trade at ${pl.name}`, x: pl.x, y: pl.y, id: pl.d }, 90);
      if (pl.kind === 'safe') cand(safeOpen(this.s, id) ? { kind: 'safe', label: `${pl.name}`, x: pl.x, y: pl.y, id } : { kind: 'buy-safe', label: `${pl.name} (for sale)`, x: pl.x, y: pl.y, id }, 80);
      if (pl.kind === 'garage') cand({ kind: 'garage', label: 'Garage: upgrades and paint', x: pl.x, y: pl.y, id }, 80);
    }
    if (!this.run) for (const g of this.gigs()) cand(g, 70);
    for (const l of this.c.ladders) cand({ kind: 'ladder-up', label: 'Climb the ladder', x: l.x * T + T / 2, y: l.y * T + T / 2 }, 60);
    for (const h of this.c.hides) cand({ kind: 'hide', label: 'Hide here', x: h.x, y: h.y }, 52);
    for (const m of this.c.murals) if (!this.s.murals.includes(m.id) && this.open.has(districtAt(Math.floor(m.x / T), Math.floor(m.y / T)))) cand({ kind: 'mural', label: 'Restore the faded mural', x: m.x, y: m.y + 30, id: m.id }, 60);
    for (const r of this.rides) if (r.parked && this.open.has(districtAt(Math.floor(r.b.x / T), Math.floor(r.b.y / T)))) cand({ kind: 'ride', label: `${r.locked ? 'Jump-start' : 'Ride'} the ${VEHICLES[r.kind].name.toLowerCase()}`, x: r.b.x, y: r.b.y, ride: r }, r.kind === 'boat' ? 96 : 70);
    this.near = best;
  }
  gigs(): Near[] { return this.run ? [] : gigBoards(this); }
  interact() {
    const n = this.near, p = this.p; if (!n || p.act) return;
    switch (n.kind) {
      case 'mission': this.startMission(MISSION[n.id!]); break;
      case 'market': this.ui = { kind: 'market', d: n.id as District }; this.fx.push({ t: 'open' }); break;
      case 'safe': this.ui = { kind: 'safe', id: n.id! }; this.s.safe = n.id!; this.fx.push({ t: 'open' }); break;
      case 'buy-safe': this.ui = { kind: 'safe', id: n.id! }; this.fx.push({ t: 'open' }); break;
      case 'garage': this.ui = { kind: 'garage', id: n.id! }; this.fx.push({ t: 'open' }); break;
      case 'ride': this.enter(n.ride!); break;
      case 'exit': this.exit(); break;
      case 'ladder-up': { const l = this.c.ladders.find(l => dist(l.x * T + T / 2, l.y * T + T / 2, n.x, n.y) < 2)!; p.act = { n: 'climb', t: 0, dur: 0.45, then: () => { p.roof = true; p.b.x = l.rx * T + T / 2; p.b.y = l.ry * T + T / 2; p.lastRoof = [p.b.x, p.b.y]; this.fx.push({ t: 'climb' }); } }; break; }
      case 'ladder-down': { const l = this.c.ladders.find(l => dist(l.rx * T + T / 2, l.ry * T + T / 2, n.x, n.y) < 2)!; p.act = { n: 'climb', t: 0, dur: 0.45, then: () => { p.roof = false; p.b.x = l.x * T + T / 2; p.b.y = l.y * T + T / 2; this.fx.push({ t: 'climb' }); } }; break; }
      case 'hide': p.act = { n: 'enter-door', t: 0, dur: 0.3, then: () => { p.hide = true; p.b.x = n.x; p.b.y = n.y; p.b.speed = 0; this.fx.push({ t: 'hide' }); } }; break;
      case 'unhide': this.unhide(); break;
      case 'mural': p.act = { n: 'paint', t: 0, dur: 1.4, then: () => { this.s.murals.push(n.id!); this.s.cash += 30; this.s.stats.murals++; const d = districtAt(Math.floor(n.x / T), Math.floor(n.y / T)); addRep(this.s, d, 3); this.fx.push({ t: 'mural', x: n.x, y: n.y }); this.say(`Mural restored (${this.s.murals.length} of ${this.c.murals.length}) · +30 coins, +3 rep`, 'good'); } }; p.face = 'up'; break;
      case 'gig': startGig(this, n.id!); break;
    }
  }
  unhide() { this.p.hide = false; this.p.act = { n: 'climb-off', t: 0, dur: 0.25 }; this.fx.push({ t: 'unhide' }); }

  // ── story
  startMission(m: Mission, gig?: Gig) {
    if (this.run) return;
    this.run = new Run(this, m, gig);
    this.fx.push({ t: 'mission-start', name: m.title });
    this.banner = { text: m.title, sub: gig ? 'Side gig' : `Chapter ${m.ch} · ${PEOPLE[m.giver].name}`, t: 2.6 };
    this.run.begin();
  }
  finishMission(m: Mission, gig?: Gig) {
    this.run = null; this.route = [];
    if (gig) { this.s.cash += gig.reward; this.s.stats.gigs++; addRep(this.s, gig.d, 2); this.s.best[gig.key] = Math.max(this.s.best[gig.key] ?? 0, 1); this.fx.push({ t: 'mission-done', name: m.title, k: gig.reward }); this.banner = { text: 'Gig done!', sub: `+${gig.reward} coins`, t: 2.4 }; return; }
    if (!this.s.done.includes(m.id)) { this.s.done.push(m.id); this.s.cash += m.reward; this.s.stats.missions++; addRep(this.s, this.c.places[m.at]?.d ?? 'market', m.rep); }
    if (m.tip) this.s.tips = this.s.tips.filter(t => !(t.market === m.tip!.market && t.good === m.tip!.good));
    const before = this.open.size; this.open = new Set(openDistricts(this.s)); this.fieldCache.clear();
    this.fx.push({ t: 'mission-done', name: m.title, k: m.reward });
    this.banner = { text: 'Job done!', sub: `${m.title} · +${m.reward} coins`, t: 3 };
    this.p.act = { n: 'celebrate', t: 0, dur: 1.1 };
    if (this.p.ride) this.p.act = null;
    if (this.open.size > before) { const d = [...this.open][this.open.size - 1]; this.fx.push({ t: 'district', name: DISTRICT_NAME[d] }); this.banner = { text: `${DISTRICT_NAME[d][0].toUpperCase()}${DISTRICT_NAME[d].slice(1)} opens!`, sub: 'The fog lifts', t: 4 }; }
    if (m.id === 'm25') this.fx.push({ t: 'finale' });
  }
  fail(reason: string) { if (!this.run) return; this.failed = { reason }; this.fx.push({ t: 'fail', msg: reason }); }
  retry() { this.failed = null; this.heat = 0; this.clearHeat(); this.run?.restore(); }
  quitJob() { this.failed = null; this.run?.cleanup(); this.run = null; this.route = []; this.p.carry = null; }
  clearHeat() { this.heat = 0; this.wardens = []; this.blocks = []; this.blimp.on = false; }
  advanceTalk() {
    const t = this.talk; if (!t) return;
    t.i++;
    if (t.i >= t.lines.length) { this.talk = null; t.done?.(); }
  }
  heroName() { return this.s.hero === 'dora' ? 'Dora' : 'Enzo'; }
  setHero(h: Hero) { this.s.hero = h; }

  // ── the route arrow: a path to the current objective
  objective(): [number, number] | null { return this.run ? this.run.target() : null; }
  updateRoute() {
    const o = this.objective(); if (!o) { this.route = []; return; }
    const cls = this.p.ride ? VEHICLES[this.p.ride.kind].cls : 'foot';
    if (cls === 'fly' || this.p.roof) { this.route = [[this.p.x, this.p.y], o]; return; }
    const f = this.fieldTo(cls as 'foot', o[0], o[1]);
    this.route = pathFrom(this.c, f, this.p.x, this.p.y, this.open);
    if (!this.route.length) { const g = this.fieldTo('foot', o[0], o[1]); this.route = pathFrom(this.c, g, this.p.x, this.p.y, this.open); }
  }

  // ── magpies swooping for cargo
  snatchStep(dt: number) {
    const n = cargoCount(this.s.cargo);
    if (n > 0 && !this.run && !this.p.hide && !this.p.roof) {
      this.snatchT -= dt;
      if (this.snatchT <= 0) {
        this.snatchT = 25 + this.R() * 20;
        const chance = Math.min(0.5, cargoValue(this.s.cargo) / 1500) * (this.assist ? 0.6 : 1);
        if (this.R() < chance && this.snatchers.length === 0) {
          const a = this.R() * Math.PI * 2;
          this.snatchers.push({ x: this.p.x + Math.cos(a) * 700, y: this.p.y + Math.sin(a) * 500, h: a + Math.PI, t: 0, out: false, took: 0, wing: 0 });
          this.fx.push({ t: 'caw' }); this.say('Caw! A magpie is after your cargo. Outrun it, or dash and boost to dodge!', 'bad');
        }
      }
    }
    for (const m of this.snatchers) {
      m.t += dt; m.wing += dt * 9;
      const sp = m.out ? 380 : (this.assist ? 230 : 260);
      const tx = m.out ? m.x + Math.cos(m.h) * 100 : this.p.x, ty = m.out ? m.y + Math.sin(m.h) * 100 : this.p.y;
      const ang = Math.atan2(ty - m.y, tx - m.x);
      if (!m.out) m.h += clamp(angDiff(m.h, ang), -3 * dt, 3 * dt);
      m.x += Math.cos(m.h) * sp * dt; m.y += Math.sin(m.h) * sp * dt;
      if (!m.out) {
        const d = dist(m.x, m.y, this.p.x, this.p.y);
        const dodging = this.p.dashT > 0 || this.p.boostT > 0 || this.p.hopT > 0 || this.p.hide;
        if (d < 30 && !dodging) {
          const have = GOODS.filter(g => this.s.cargo[g] > 0).sort((a, b) => GOOD[b].base - GOOD[a].base);
          if (have.length) { const g = have[0]; const k = Math.min(2, this.s.cargo[g]); this.s.cargo[g] -= k; m.took = k; this.say(`The magpie snatched ${k} ${GOOD[g].name.toLowerCase()}!`, 'bad'); this.fx.push({ t: 'snatch', x: m.x, y: m.y }); }
          m.out = true;
        } else if (d < 60 && dodging) { m.out = true; this.say('Dodged! The magpie flaps off empty-clawed.', 'good'); this.fx.push({ t: 'dodge', x: m.x, y: m.y }); }
        if (m.t > 14) { m.out = true; }
      }
    }
    this.snatchers = this.snatchers.filter(m => !(m.out && dist(m.x, m.y, this.p.x, this.p.y) > 1100));
  }

  // ── trading, stash and the safe house
  event: ReturnType<typeof dailyEvent> | null = null;
  price(d: District, g: Good, haggle = 1) { return prices(midPrice(this.s.seed, this.s.night, d, g, this.s.tips, this.event), this.s.rep[d], haggle); }
  buy(d: District, g: Good, n: number, haggle = 1): string | null {
    const unit = this.price(d, g, haggle).buy;
    const r = tBuy(this.s.cash, this.s.cargo, this.cap(), g, n, unit);
    if (!r.ok) return r.why!;
    this.s.cash = r.cash; this.s.cargo = r.cargo; this.tripCost[g] += r.total; this.s.stats.trades++;
    this.fx.push({ t: 'buy', k: r.total }); return null;
  }
  sell(d: District, g: Good, n: number, haggle = 1): string | null {
    const unit = this.price(d, g, haggle).sell, have = this.s.cargo[g];
    const r = tSell(this.s.cash, this.s.cargo, g, n, unit);
    if (!r.ok) return r.why!;
    const avg = have > 0 ? this.tripCost[g] / have : GOOD[g].base;
    const profit = (unit - avg) * r.n;
    this.tripCost[g] = Math.max(0, this.tripCost[g] - avg * r.n);
    this.s.cash = r.cash; this.s.cargo = r.cargo; this.s.stats.trades++;
    if (profit > 0) this.s.stats.profit += profit;
    addRep(this.s, d, Math.min(2, r.total / 200));
    this.fx.push({ t: 'sell', k: r.total });
    const ev = this.event;
    if (ev && ev.good === g && (!ev.market || ev.market === d) && !this.s.dailyDone.includes('day:' + ev.day)) {
      this.daySales[ev.day] = (this.daySales[ev.day] ?? 0) + r.n;
      if (this.daySales[ev.day] >= DAILY_NEED[g]) { this.s.dailyDone.push('day:' + ev.day); this.s.cash += 200; this.fx.push({ t: 'daily' }); this.banner = { text: 'Daily event done!', sub: `${ev.name} · +200 coins`, t: 3 }; }
    }
    return null;
  }
  stash(g: Good, n: number, toStash: boolean): string | null {
    const stashCap = 60 + this.s.upgrades.cargo * 20;
    if (toStash) {
      const have = this.s.cargo[g]; const r = moveGoods(this.s.cargo, this.s.stash, g, n, stashCap); if (!r.n) return 'The stash is full';
      const avg = have > 0 ? this.tripCost[g] / have : GOOD[g].base; this.tripCost[g] = Math.max(0, this.tripCost[g] - avg * r.n);
      this.s.cargo = r.from; this.s.stash = r.to;
    } else {
      const r = moveGoods(this.s.stash, this.s.cargo, g, n, this.cap()); if (!r.n) return this.s.stash[g] ? 'No room to carry more' : 'None in the stash';
      this.tripCost[g] += GOOD[g].base * LEAN_AVG * r.n;
      this.s.stash = r.from; this.s.cargo = r.to;
    }
    this.fx.push({ t: 'stash' }); return null;
  }
  swapJacket() { const had = this.heat >= 1; this.clearHeat(); this.p.act = { n: 'swap', t: 0, dur: 0.9 }; if (had) { this.s.stats.escapes++; this.run?.onHeatClear(); } this.fx.push({ t: 'swap' }); }
  sleep() { this.newNight(); this.clearHeat(); this.p.act = { n: 'sleep', t: 0, dur: 1.2 }; this.fx.push({ t: 'sleep' }); }

  // ── save helpers
  respawnAtSafe() {
    let best = this.c.places['safe-market'], bd = 1e18;
    for (const h of SAFE_HOUSES) { const pl = this.c.places[h.id]; if (!safeOpen(this.s, h.id)) continue; const d = dist(pl.x, pl.y, this.p.x, this.p.y); if (d < bd) { bd = d; best = pl; } }
    if (this.p.ride) { this.p.ride.parked = true; this.p.ride.b.speed = 0; this.p.ride = null; }
    this.placePlayer(best.x, best.y + T * 0.6);
  }
  caughtNow() { caught(this); }
}

const LEAN_AVG = 0.85;
// late imports to keep the module graph acyclic at runtime
import { gigBoards, startGig } from './jade-gigs.js';
void cargoValue; void H; void F_ALLEY; void moveStep; void shove;

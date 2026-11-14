// Jade Street: the job runner. Walks a story mission or side gig through its steps (talk, go, ride, pick up, deliver,
// mini-game, chase, tail, escort, race, stealth, collect, heat, trade, fares), spawning the actors each step needs
// (the magpie cart, Pip on foot, the lion dance, lookouts, rivals, fares), and keeping a checkpoint so a failure
// restarts from the last one: you never lose more than a step or two. Assist widens timers, slows targets, eases
// lookouts and lets bumps land from a little further away.
import { T, W, S, F_ROOF, districtAt, type District } from './jade-city.js';
import { VEHICLES, drive, type Body, type VehicleKind } from './jade-move.js';
import { los, downhill, nearestFree, type Field } from './jade-nav.js';
import { dist, angDiff, clamp } from './jade-rng.js';
import { PEOPLE, type Mission, type Step, type Spot } from './jade-story.js';
import type { World, Ride, Near, Input } from './jade-game.js';
import type { Car } from './jade-traffic.js';
import { addHeat } from './jade-heat.js';

export type Gig = { key: string; reward: number; d: District };
export type Actor = { id: number; kind: string; b: Body; route: [number, number][]; wp: number; speed: number; t: number; stun: number; look: number; lookCd: number; face: number; gone: boolean; hits: number; extra?: number };
type Snap = { i: number; x: number; y: number; h?: number; roof: boolean; ride: VehicleKind | null; carry: string | null };

export class Run {
  i = -1; cur!: Step; label = ''; timer: number | null = null; meter: { name: string; v: number; bad?: boolean } | null = null; progress = '';
  actors: Actor[] = []; marks: [number, number][] = []; mark = 0; items: { x: number; y: number; got: boolean; sprite: string }[] = [];
  loot: { x: number; y: number; sprite: string } | null = null; snap!: Snap; phase = 0; count = 0; lost = 0; base = 0; hits = 0;
  spawned = 0; spawnT = 0; envelopes = 5; fare: { x: number; y: number; to: [number, number] | null; sp: string } | null = null;
  ride: Ride | null = null; private fieldKey = ''; private f: Field | null = null;
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
    this.snap = this.snapshot(0);
    this.enter(0);
  }
  addTip() { const t = this.m.tip!; const s = this.w.s; if (!s.tips.some(x => x.night === s.night && x.market === t.market && x.good === t.good)) s.tips.push({ night: s.night, market: t.market, good: t.good, mult: t.mult, from: PEOPLE[this.m.giver].name, text: this.m.blurb }); }
  snapshot(i: number): Snap { const p = this.w.p; return { i, x: p.x, y: p.y, h: p.ride ? p.ride.b.h : p.b.h, roof: p.roof, ride: p.ride?.kind ?? null, carry: p.carry }; }
  restore() {
    const w = this.w, s = this.snap; this.cleanup(false);
    const p = w.p;
    // the ride you were on comes back with you when the checkpoint had one of that kind
    const keep = p.ride && p.ride.kind === s.ride ? p.ride : null;
    if (p.ride) { p.ride.parked = true; p.ride.b.speed = 0; p.ride = null; }
    p.hide = false; p.act = null; p.dashT = 0; p.hopT = 0; p.carry = s.carry;
    if (s.ride) {
      if (keep) keep.b.x = keep.b.y = -9999;
      const [x, y] = w.rideSpot(s.ride, s.x, s.y);
      const r = keep ?? w.addRide(s.ride, x, y, -Math.PI / 2, false, 0, true);
      r.b.x = x; r.b.y = y; r.b.h = s.h ?? r.b.h; r.b.speed = 0;
      p.ride = r; r.parked = false; p.b.x = x; p.b.y = y; p.roof = false;
    } else { p.roof = s.roof; if (s.roof) { p.b.x = s.x; p.b.y = s.y; p.lastRoof = [s.x, s.y]; } else w.placePlayer(s.x, s.y); }
    w.fx.push({ t: 'checkpoint' });
    this.enter(s.i);
  }
  cleanup(all = true) {
    this.actors = []; this.items = []; this.marks = []; this.loot = null; this.fare = null; this.timer = null; this.meter = null; this.progress = '';
    if (all) { this.w.p.carry = null; if (this.m.tip) this.w.s.tips = this.w.s.tips.filter(t => !(t.market === this.m.tip!.market && t.good === this.m.tip!.good)); }
  }
  next() { this.enter(this.i + 1); }
  enter(i: number) {
    const w = this.w;
    this.actors = []; this.items = []; this.marks = []; this.timer = null; this.meter = null; this.progress = ''; this.phase = 0; this.count = 0; this.lost = 0; this.hits = 0; this.spawned = 0; this.spawnT = 0;
    if (i >= this.m.steps.length) { this.cleanup(); w.finishMission(this.m, this.gig); return; }
    this.i = i; this.cur = this.m.steps[i]; const st = this.cur;
    if (st.cp && i > 0) { this.snap = this.snapshot(i); w.fx.push({ t: 'checkpoint' }); }
    this.label = 'label' in st ? st.label : '';
    const k = (this.assist ? 1.4 : 1) * (this.easy ? 1 : 0.9);
    switch (st.t) {
      case 'talk': {
        const hero = w.s.hero;
        w.talk = { lines: st.lines.map(([who, text]) => [who === 'hero' ? hero : who, text] as [string, string]), i: 0, done: () => this.next() };
        w.fx.push({ t: 'talk' });
        break;
      }
      case 'ride': {
        const [x, y] = this.spot(st.near ?? [Math.floor(w.p.x / T), Math.floor(w.p.y / T)]);
        if (w.p.ride?.kind === st.kind && !st.locked) { this.next(); return; }
        let r = w.rides.find(r => r.parked && r.kind === st.kind && dist(r.b.x, r.b.y, x, y) < 260 && (!st.locked || r.locked));
        if (!r) { const [rx, ry] = w.rideSpot(st.kind, x, y); r = w.addRide(st.kind, rx, ry, -Math.PI / 2, !!st.locked, 0, true); }
        this.ride = r;
        break;
      }
      case 'deliver': this.timer = st.time * k; this.hits = 0; if (st.fragile) this.meter = { name: 'Wobble', v: 0 }; if (!w.p.carry) w.p.carry = st.item; break;
      case 'mini': w.ui = { kind: 'mini', mini: st.kind, level: st.level, from: 'mission' }; w.fx.push({ t: 'mini' }); break;
      case 'chase': {
        const [x, y] = this.spot(st.from);
        const cls = st.who === 'boat' ? 'boat' : st.who === 'runner' ? 'foot' : 'small';
        const [sx, sy] = nearestFree(w.c, cls, x, y, w.open, 6);
        this.actors.push(this.actor(st.who, sx, sy, cls, this.path(st.route, cls), st.speed));
        this.progress = `Bumps 0/${st.bumps}`;
        w.fx.push({ t: 'chase' });
        break;
      }
      case 'tail': {
        const [x, y] = this.spot(st.from);
        const [sx, sy] = nearestFree(w.c, 'foot', x, y, w.open, 6);
        this.actors.push(this.actor('pip', sx, sy, 'foot', this.path(st.route, 'foot'), 72));
        this.meter = { name: 'Suspicion', v: 0 };
        break;
      }
      case 'escort': {
        const [x, y] = this.spot(st.from);
        const [sx, sy] = nearestFree(w.c, 'foot', x, y, w.open, 6);
        this.actors.push(this.actor('lion', sx, sy, 'foot', this.path(st.route, 'foot'), 52));
        this.envelopes = 5; this.meter = { name: 'Red envelopes', v: 1 }; this.spawnT = 3;
        break;
      }
      case 'race': {
        this.marks = st.marks.map(s => this.spot(s)); this.mark = 0;
        if (st.time) this.timer = st.time * k;
        if (st.rival) {
          const cls = st.rival === 'boat' ? 'boat' : st.rival === 'runner' ? 'foot' : 'small';
          const [x, y] = nearestFree(w.c, cls, w.p.x + 30, w.p.y + 30, w.open, 4);
          const sp = st.rival === 'runner' ? 214 : st.rival === 'scooter' ? 292 : 220;
          this.actors.push(this.actor('rival-' + st.rival, x, y, cls, this.marks, sp * (this.assist ? 0.86 : 1) * (this.easy ? 1 : 1.04)));
        }
        this.progress = `Gates 0/${this.marks.length}`;
        break;
      }
      case 'stealth': {
        st.lookouts.forEach(route => { const pts = route.map(s => this.spot(s)); this.actors.push(this.actor('lookout', pts[0][0], pts[0][1], 'fly', pts, 46)); });
        this.meter = { name: 'Alert', v: 0 }; this.phase = 0;
        break;
      }
      case 'collect': this.items = st.items.map(s => { const [x, y] = this.spot(s); return { x, y, got: false, sprite: st.item }; }); this.timer = st.time * k; this.progress = `0/${st.items.length}`; break;
      case 'heat': w.clearHeat(); addHeat(w, st.level + 0.2, 'story'); w.lastSeen = [w.p.x, w.p.y]; break;
      case 'trade': this.base = w.s.stats.profit; this.meter = { name: 'Profit', v: 0 }; if (this.m.tip) this.addTip(); break;
      case 'fares': this.count = 0; this.newFare(); break;
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
  walk(a: Actor, dt: number, speed: number, loop: boolean): boolean {
    const w = this.w; if (!a.route.length) return true;
    const [gx, gy] = a.route[a.wp];
    if (dist(a.b.x, a.b.y, gx, gy) < (a.b.cls === 'foot' ? 22 : 48)) {
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
    drive(w.ctx(), a.b, dx / l, dy / l, speed, 900, 10, dt, a.b.cls === 'foot');
    return false;
  }

  step(dt: number, inp: Input) {
    const w = this.w, st = this.cur, p = w.p; if (!st || w.talk || w.ui) return;
    void inp;
    if (this.timer !== null) { this.timer -= dt; if (this.timer <= 0) { this.timer = 0; return this.fail(st.t === 'deliver' && st.item === 'cake' ? 'The cake melted!' : 'Out of time!'); } }
    const px = p.x, py = p.y, pb = p.ride ? p.ride.b : p.b;
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
          if (!p.ride) { p.act = { n: 'pickup', t: 0, dur: 0.45, then: () => { p.carry = st.item; this.loot = null; w.fx.push({ t: 'pickup', x, y }); this.next(); } }; }
          else { p.carry = st.item; this.loot = null; w.fx.push({ t: 'pickup', x, y }); this.next(); }
        }
        break;
      }
      case 'deliver': {
        const [x, y] = this.spot(st.to);
        if (dist(px, py, x, y) < 90) { p.carry = null; w.fx.push({ t: 'deliver', x, y }); this.next(); }
        break;
      }
      case 'chase': this.chase(st, dt, pb); break;
      case 'tail': this.tail(dt); break;
      case 'escort': this.escort(st, dt, pb); break;
      case 'race': {
        const [mx, my] = this.marks[this.mark];
        const okRide = !st.ride || (st.ride === 'foot' ? !p.ride : p.ride?.kind === st.ride);
        if (!okRide) this.label = st.ride === 'foot' ? 'On foot only: get off' : `Race on the ${VEHICLES[st.ride as VehicleKind].name.toLowerCase()}`;
        else this.label = st.label;
        if (okRide && dist(px, py, mx, my) < (st.roof ? 60 : 90) && p.roof === !!st.roof) {
          this.mark++; w.fx.push({ t: 'gate', x: mx, y: my }); this.progress = `Gates ${this.mark}/${this.marks.length}`;
          if (this.mark >= this.marks.length) { w.fx.push({ t: 'win' }); this.next(); return; }
        }
        for (const a of this.actors) {
          if (a.gone) continue;
          const rubber = dist(a.b.x, a.b.y, px, py) > 500 && a.wp > this.mark ? 0.7 : 1;
          const end = this.walk(a, dt, a.speed * rubber, false);
          if (end && a.wp === a.route.length - 1) { a.gone = true; return this.fail('The rival got there first!'); }
        }
        break;
      }
      case 'stealth': this.stealth(st, dt); break;
      case 'collect': {
        for (const it of this.items) if (!it.got && dist(px, py, it.x, it.y) < (p.ride ? 64 : 48)) {
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
    }
  }
  fail(why: string) { this.w.fail(why); }

  chase(st: Extract<Step, { t: 'chase' }>, dt: number, pb: Body) {
    const w = this.w, a = this.actors[0]; if (!a) return;
    const d = dist(a.b.x, a.b.y, pb.x, pb.y);
    a.t += dt;
    if (a.stun > 0) { a.stun -= dt; a.b.speed *= 0.94; }
    else {
      let sp = st.speed * (this.assist ? 0.84 : 1) * (this.easy ? 1 : 1.05);
      if (d > 620) sp *= 0.72; else if (d < 160) sp *= 1.04;
      this.walk(a, dt, sp, true);
    }
    // a bump: ride into it, or dash into it on foot
    const reach = a.b.r + pb.r + (this.assist ? 16 : 6);
    const hitting = w.p.ride ? pb.speed > 90 : (w.p.dashT > 0 || w.p.hopT > 0);
    if (a.stun <= 0 && d < reach && hitting) {
      a.hits++; a.stun = 0.9; this.hits = a.hits; a.b.speed *= 0.4;
      w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: a.hits });
      this.progress = `Bumps ${a.hits}/${st.bumps}`;
      if (a.hits >= st.bumps) {
        if (st.loot) { const [lx, ly] = nearestFree(w.c, 'foot', a.b.x, a.b.y, w.open, 3); this.loot = { x: lx, y: ly, sprite: st.loot }; w.fx.push({ t: 'loot', x: lx, y: ly }); }
        this.next(); return;
      }
    }
    const far = this.assist ? 1500 : 1150;
    this.lost = d > far ? this.lost + dt : 0;
    if (this.lost > (this.assist ? 9 : 6)) this.fail('They got away! Stay closer next time.');
  }
  tail(dt: number) {
    const w = this.w, a = this.actors[0], p = w.p; if (!a) return;
    a.t += dt;
    if (a.look > 0) { a.look -= dt; a.b.speed = 0; } else {
      a.lookCd -= dt;
      if (a.lookCd <= 0) { a.look = 1.8; a.lookCd = 5 + (a.id % 4); a.face = a.b.h + Math.PI; w.fx.push({ t: 'look', x: a.b.x, y: a.b.y }); }
      const done = this.walk(a, dt, 74, false);
      if (done && dist(a.b.x, a.b.y, p.x, p.y) < 700) { this.next(); return; }
    }
    const d = dist(a.b.x, a.b.y, p.x, p.y);
    const range = this.assist ? 165 : 210;
    const facing = a.look > 0 ? a.face : a.b.h;
    const inCone = Math.abs(angDiff(facing, Math.atan2(p.y - a.b.y, p.x - a.b.x))) < (a.look > 0 ? 1.2 : 0.55);
    const sees = !p.hide && d < range && (inCone || d < 60) && los(w.c, a.b.x, a.b.y, p.x, p.y);
    const m = this.meter!;
    if (sees) m.v = Math.min(1, m.v + dt * (p.sneak && !p.ride ? 0.45 : 1.1) * (d < 90 ? 1.8 : 1) * (this.assist ? 0.7 : 1));
    else m.v = Math.max(0, m.v - dt * 0.25);
    m.bad = m.v > 0.6;
    if (m.v >= 1) return this.fail('Pip spotted you! Keep further back, sneak, or hide when he looks round.');
    this.lost = d > (this.assist ? 680 : 540) ? this.lost + dt : 0;
    if (this.lost > 6) this.fail('You lost him. Keep him in sight.');
  }
  escort(st: Extract<Step, { t: 'escort' }>, dt: number, pb: Body) {
    const w = this.w, lion = this.actors[0]; if (!lion) return;
    lion.t += dt;
    const far = dist(lion.b.x, lion.b.y, pb.x, pb.y) > 420;
    if (!far) { if (this.walk(lion, dt, 52, false) && this.spawned >= st.magpies && this.actors.length === 1) { this.next(); return; } } else lion.b.speed = 0;
    if (lion.wp === lion.route.length - 1 && dist(lion.b.x, lion.b.y, lion.route[lion.wp][0], lion.route[lion.wp][1]) < 30 && this.actors.filter(a => a.kind === 'swoop' && !a.gone).length === 0) { this.next(); return; }
    this.spawnT -= dt;
    if (this.spawned < st.magpies && this.spawnT <= 0) {
      this.spawnT = this.assist ? 6.5 : 5;
      const ang = (this.spawned * 2.4) % (Math.PI * 2);
      const m = this.actor('swoop', lion.b.x + Math.cos(ang) * 560, lion.b.y + Math.sin(ang) * 420, 'fly', [], this.assist ? 105 : 130);
      this.actors.push(m); this.spawned++; w.fx.push({ t: 'caw' });
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
      if (l < 34) { this.envelopes--; m.stun = 1.2; m.b.h += Math.PI; w.fx.push({ t: 'snatch', x: m.b.x, y: m.b.y }); this.meter = { name: 'Red envelopes', v: this.envelopes / 5, bad: this.envelopes <= 2 }; if (this.envelopes <= 0) return this.fail('The magpies took every red envelope!'); }
    }
    this.actors = this.actors.filter(a => !a.gone);
    this.progress = `Magpies ${this.spawned}/${st.magpies}`;
  }
  stealth(st: Extract<Step, { t: 'stealth' }>, dt: number) {
    const w = this.w, p = w.p;
    const range = this.assist ? 170 : 215, cone = this.assist ? 0.45 : 0.55;
    let seen = false;
    for (const a of this.actors) {
      a.t += dt; this.walk(a, dt, 46, true);
      const d = dist(a.b.x, a.b.y, p.x, p.y);
      if (!p.hide && d < range && Math.abs(angDiff(a.b.h, Math.atan2(p.y - a.b.y, p.x - a.b.x))) < cone && los(w.c, a.b.x, a.b.y, p.x, p.y)) seen = true;
      if (d < 34 && !p.hide) seen = true;
    }
    const m = this.meter!;
    m.v = seen ? Math.min(1, m.v + dt * (p.sneak ? 0.7 : 1.4)) : Math.max(0, m.v - dt * 0.3); m.bad = m.v > 0.5;
    if (m.v >= 1) return this.fail('A lookout spotted you! Watch their torch beams and sneak.');
    if (this.phase === 0) {
      const [gx, gy] = this.spot(st.goal); this.label = 'Reach the yard office unseen';
      if (dist(p.x, p.y, gx, gy) < 60 && !p.act) { p.act = { n: 'pickup', t: 0, dur: 0.45, then: () => { p.carry = 'manifest'; w.fx.push({ t: 'pickup' }); this.phase = 1; } }; }
    } else {
      const [ex, ey] = this.spot(st.exit); this.label = 'Sneak back out through the gate';
      if (dist(p.x, p.y, ex, ey) < 70) { p.carry = null; this.next(); }
    }
  }
  newFare() {
    const w = this.w; const R = w.R;
    for (let k = 0; k < 200; k++) {
      const a = R() * Math.PI * 2, d = (8 + R() * 8) * T;
      const tx = Math.floor((w.p.x + Math.cos(a) * d) / T), ty = Math.floor((w.p.y + Math.sin(a) * d) / T);
      if (!this.fareOk(tx, ty)) continue;
      this.fare = { x: tx * T + T / 2, y: ty * T + T / 2, to: null, sp: ['rabbit', 'dog', 'cat', 'duck'][Math.floor(R() * 4)] };
      this.label = `Pick up the fare (${this.count + 1}/${(this.cur as { n: number }).n})`; this.timer = null;
      return;
    }
    const pl = this.w.c.places['bo']; this.fare = { x: pl.x, y: pl.y + T, to: null, sp: 'dog' };
  }
  fareOk(tx: number, ty: number) {
    const w = this.w; if (tx < 1 || ty < 1 || tx > 118 || ty > 90) return false;
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
        this.timer = (dist(p.x, p.y, f.to[0], f.to[1]) / 160 + 12) * (this.assist ? 1.5 : 1.1);
        this.label = `Drive the fare home (${this.count + 1}/${st.n})`;
      }
    } else if (dist(p.x, p.y, f.to[0], f.to[1]) < 100) {
      this.count++; w.s.cash += 15; w.fx.push({ t: 'fare-out', x: f.to[0], y: f.to[1] }); w.say('Fare paid +15 coins', 'good');
      if (this.count >= st.n) { this.fare = null; this.next(); return; }
      this.newFare();
    }
  }

  // ── hooks from the world
  onBump(k: number, what: string) {
    const st = this.cur; if (!st || st.t !== 'deliver' || !st.fragile) return;
    if (k < 150 && what === 'wall') return;
    this.hits++; this.meter = { name: 'Wobble', v: this.hits / st.fragile, bad: this.hits >= st.fragile - 2 };
    this.w.fx.push({ t: 'wobble', x: this.w.p.x, y: this.w.p.y });
    if (this.hits >= st.fragile) this.fail(st.item === 'cake' ? 'Splat! The cake toppled. Smoother driving!' : 'Crash! The pots broke. Gently round the corners!');
  }
  onCarTouch(_c: Car) { }
  onEnter(_r: Ride) { }
  onHeatClear() { }
  onMini(ok: boolean) {
    const st = this.cur; if (!st || st.t !== 'mini') return;
    if (ok) this.next();
    else { this.w.say('Not quite! Have another go.', 'bad'); this.w.ui = { kind: 'mini', mini: st.kind, level: st.level, from: 'mission' }; }
  }
  nearAction(_x: number, _y: number): Near | null { return null; }
  wantsRide() { return false; }
  /** what the route arrow points at */
  target(): [number, number] | null {
    const st = this.cur; if (!st) return null; const w = this.w;
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
      case 'fares': return this.fare ? (this.fare.to ?? [this.fare.x, this.fare.y]) : null;
      default: return null;
    }
  }
  aimAt(): [number, number] | null {
    const st = this.cur; if (!st) return null;
    if (st.t === 'chase' && this.actors[0]) return [this.actors[0].b.x, this.actors[0].b.y];
    if (st.t === 'escort') { const m = this.actors.filter(a => a.kind === 'swoop' && a.stun <= 0).sort((a, b) => dist(a.b.x, a.b.y, this.w.p.x, this.w.p.y) - dist(b.b.x, b.b.y, this.w.p.x, this.w.p.y))[0]; return m ? [m.b.x, m.b.y] : null; }
    return null;
  }
}
void F_ROOF;

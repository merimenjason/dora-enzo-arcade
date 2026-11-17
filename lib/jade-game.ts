// Jade Street: the world. One deterministic step (fixed 1/60 s) moves Dora or Enzo on foot or on any ride, the
// traffic and townsfolk, the wardens and the heat, the story job or side gig in progress, the night clock and the
// crows who swoop for your cargo. Everything the page and the scene need is read from here; the page sends input
// and commands (interact, trade, garage, safe house). No DOM. Mission logic: lib/jade-mission.ts; traffic:
// lib/jade-traffic.ts; heat and wardens: lib/jade-heat.ts. Both heroes are always out: `p` is the one you control,
// `mate` the partner (lib/jade-duo.ts: AI, switching, the second player); tag-team moves: lib/jade-tag.ts; the
// cartoon gadgets: lib/jade-gear.ts.
import { city as getCityOnce, T, W, H, S, G, F_ROOF, F_ALLEY, districtAt, DISTRICT_NAME, type City, type District } from './jade-city.js';
import { VEHICLES, FOOT, drive, step as moveStep, obstacleGrid, shove, overlapping, type Body, type Ctx, type VehicleKind, type Obstacle } from './jade-move.js';
import { nearestFree, field, pathFrom, type Field } from './jade-nav.js';
import { castOf, castKey, CHAT, type CastMember } from './jade-cast.js';
import { rng, clamp, angDiff, dist } from './jade-rng.js';
import { cargoCount, cargoValue, capacity, GOODS, GOOD, midPrice, prices, buy as tBuy, sell as tSell, moveGoods, MARKET_NAME, type Good } from './jade-trade.js';
import { type Save, type Hero, openDistricts, offered, addRep, checkTrophies, safeOpen, SAFE_HOUSES, DAILY_NEED, dailyEvent } from './jade-save.js';
import { MISSION, PEOPLE, type Mission } from './jade-story.js';
import { Run, type Gig } from './jade-mission.js';
import { trafficStep, redRun, type Car } from './jade-traffic.js';
import { pedStep, type Ped } from './jade-folk.js';
import { DIFF } from './jade-diff.js';
import { heatStep, addHeat, caught, type Warden, type Roadblock } from './jade-heat.js';
import { sgStep, sgNear, sgAct, sgGates, newSg, cheer, type SgState, type Bark } from './jade-sg.js';
import { finesStep, payTicket, offence, FINE, type Patrol, type Ticket } from './jade-fines.js';
import { gangsStep, gangNear, gangAct, newGangs, type GangState } from './jade-gangs.js';
import { stationNear, mrtTo, cantRide, routeToStation, stationById, MRT_TEXT, travelPlan, type Travel } from './jade-mrt.js';
import { hail, taxiStep, skipRide, type Taxi } from './jade-taxi.js';
import { eastStep, eastNear, eastAct, newEast, type EastState } from './jade-eastfest.js';
import { farStep, farNear, farAct, newFar, type FarState } from './jade-farfest.js';
import { linkNear, linkGo, ferryStep, ferryLand, FARES, EAST_TEXT, RESORT_TEXT, FAR_TEXT, CHANGI_TEXT, type FerryRide } from './jade-cable.js';

export const DT = 1 / 60;
export type Input = { mx: number; my: number; sneak: boolean; dash: boolean; hop: boolean; act: boolean;
  /** switch hero (Tab), tag-team move (F), fire at (ax, ay) (no aim: Assist or straight ahead), gadget slot (0/1, or
   * -1 for the other one), reload */
  swap?: boolean; tag?: boolean; fire?: boolean; ax?: number; ay?: number; slot?: number; reload?: boolean;
  /** hail a taxi (G) */
  hail?: boolean };
export const NO_INPUT: Input = { mx: 0, my: 0, sneak: false, dash: false, hop: false, act: false };
export type Ride = { id: number; kind: VehicleKind; b: Body; parked: boolean; locked: boolean; tint: number; mission?: boolean; seen?: number; broken?: boolean };
/** `over`: a toast that replaces any showing or waiting toast containing this text (pass 13: "Your taxi is here" sat
 * beside "a taxi is on its way") */
export type Fx = { t: string; x?: number; y?: number; k?: number; msg?: string; kind?: string; name?: string; over?: string };
export type Near = { kind: 'mission' | 'giver' | 'market' | 'safe' | 'garage' | 'ladder-up' | 'ladder-down' | 'hide' | 'unhide' | 'mural' | 'ride' | 'exit' | 'gig' | 'buy-safe' | 'event' | 'festival' | 'eat' | 'leap' | 'biz' | 'gear' | 'sg' | 'fine' | 'gang' | 'station' | 'taxi' | 'isle' | 'job' | 'cable' | 'ferry' | 'east' | 'empire' | 'contract' | 'far'; label: string; x: number; y: number; id?: string; ride?: Ride };
export type Snatcher = { x: number; y: number; h: number; t: number; out: boolean; took: number; wing: number; good?: string; dizzy?: number };
export type Act = { n: string; t: number; dur: number; then?: () => void };
export type UiPanel = null | { kind: 'market'; d: District } | { kind: 'safe'; id: string } | { kind: 'garage'; id: string } | { kind: 'mini'; mini: string; level: number; from: 'mission' | 'gig' | 'ride' | 'sg' } | { kind: 'map' } | { kind: 'biz'; id: BizId } | { kind: 'gear' } | { kind: 'mama' } | { kind: 'glossary' }
  /** the island: a station's ticket gates, the train ride view, the taxi's drop-off list */
  | { kind: 'mrt'; from: string } | { kind: 'ride-view'; from: string; to: string; via?: 'cable' } | { kind: 'taxi' }
  /** the job steps: a heist's quiet-or-loud choice, a witness's three questions (and what they said back) */
  | { kind: 'heist' } | { kind: 'branch' } | { kind: 'ask'; i: number; said?: string; ok?: boolean };

export class Player {
  constructor(public who: Hero = 'dora') { }
  /** the passenger seat of a ride someone else drives; the partner's brain (lib/jade-duo.ts) */
  seat: Ride | null = null; ai: MateAI = newAI();
  /** gadgets: fire cooldown, the firing pose (time, gadget, aim angle), a reload; a passenger's grab; a cheer */
  fireCd = 0; fireT = 0; fireG = ''; aimH = 0; reloadT = 0; reloadG = ''; grabT = 0; cheerT = 0;
  b: Body = { x: 0, y: 0, h: Math.PI / 2, speed: 0, r: FOOT.r, len: 0, cls: 'foot' };
  ride: Ride | null = null; roof = false; lastRoof: [number, number] = [0, 0];
  dashT = 0; dashCd = 0; hopT = 0; hopCd = 0; boostT = 0; boostCd = 0;
  hide = false; sneak = false; act: Act | null = null; carry: string | null = null;
  /** in the spy disguise (a blend step): drawn in the trench coat and walks with its own frames */
  disguise = false;
  anim = 'idle'; animT = 0; face: 'down' | 'up' | 'side' = 'down'; flip = false; bumpT = 0;
  /** knocked by a set-piece hazard: no control for a moment; a skid on a sharp turn at speed */
  stunT = 0; skidT = 0; skidCd = 0; stunKind = '';
  /** under a five-foot way's shade (lib/jade-sg.ts) */
  shade = false;
  get x() { return this.ride ? this.ride.b.x : this.b.x; }
  get y() { return this.ride ? this.ride.b.y : this.b.y; }
  get air() { return this.hopT > 0; }
}

export class World {
  c: City; obs: Obstacle[][]; s: Save; R: () => number;
  p = new Player(); rides: Ride[] = []; cars: Car[] = []; peds: Ped[] = []; wardens: Warden[] = []; blocks: Roadblock[] = []; snatchers: Snatcher[] = [];
  heat = 0; seenT = 0; lastSeen: [number, number] = [0, 0]; blimp: { x: number; y: number; on: boolean } = { x: 0, y: 0, on: false };
  run: Run | null = null; talk: { lines: [string, string, string?][]; i: number; done?: () => void } | null = null;
  ui: UiPanel = null; near: Near | null = null; fx: Fx[] = [];
  time = 0; tick = 0; nextId = 1; open: Set<District>; route: [number, number][] = []; routeT = 0;
  failed: { reason: string } | null = null; banner: { text: string; sub: string; t: number } | null = null;
  snatchT = 20; spawnT = 0; daySales: Record<string, number> = {}; profitBase = 0; tripCost: Record<Good, number>;
  fieldCache = new Map<string, Field>();
  /** noises made this frame or the last (lib/jade-aware.ts): what guards, wardens and gangs hear */
  noises: Noise[] = [];
  quiet = false;
  /** a street event in progress (lib/jade-events.ts), the wait till the next, and a busker's crowd */
  street: StreetEvent | null = null; streetT = 30; crowd: { x: number; y: number } | null = null; pushing = false;
  inputMag = 0; inputAng = 0;
  tutor: TutorState = newTutor(); offered = new Set<string>(); phoneT = 0;
  /** rain from 0 to 1 (lib/jade-weather.ts) */
  rain = 0; rainForce: number | null = null;
  /** a contract's graveyard shift (lib/jade-proc.ts): the streets darker, guards see less far */
  dark = false;
  /** a replayed job pays a quarter and records a medal */
  replaying = false;
  /** tiles a set piece has closed (the lowered drawbridge, the shut yard gate) and a crow raid waiting to start */
  gates = new Set<number>(); raidWait: { id: BizId; t: number } | null = null;
  /** the partner; a second player driving them; the leash pulling the two of you together (seconds of tug shown) */
  mate: Player; two = false; leashT = 0;
  /** gadget shots in flight, splats on the ground, supply crates, splattered stalls (prop index -> seconds) */
  shots: Shot[] = []; splats: Splat[] = []; crates: Crate[] = []; stallSplat = new Map<number, number>();
  /** a pounce in progress (for the double pounce) */
  pounceAt: { id: number; t: number; mate: boolean; you: boolean } | null = null;
  /** Singapore: the streets' state (lib/jade-sg.ts), speech bubbles, the ticket wardens and a ticket in hand
   * (lib/jade-fines.ts), the rival gangs' street events (lib/jade-gangs.ts) */
  sg: SgState = newSg(); barks: Bark[] = []; patrols: Patrol[] = []; ticket: Ticket | null = null;
  fineCd = new Map<string, number>(); warned = new Set<string>(); lastTile = -1; lastTileRide = 0; gangs: GangState = newGangs();
  /** the island: a hailed taxi (lib/jade-taxi.ts), the station the last train ride arrived at (lib/jade-mrt.ts) */
  taxi: Taxi | null = null; lastMrt = '';
  /** the ninth pass: the ferry crossing you are on, and the last cable car or ferry stop you stepped off at */
  ferry: FerryRide | null = null; lastLink = ''; east: EastState = newEast(); far: FarState = newFar();
  /** today's date from the device ('yyyy-mm-dd', set by the page) for the festivals; null in the Node tests */
  today: string | null = null;
  /** the partner thinking for themselves (lib/jade-pal.ts) */
  pal: PalState = newPal();
  /** the tenth pass: the empire's raid under way, the partner's errand, the jaga in a stand (lib/jade-empire.ts) */
  emp: EmpState = newEmp();
  /** the page has something important on screen: passers-by hold their remarks (lib/jade-notice.ts) */
  hush = false;
  /** the job givers standing in the world (lib/jade-cast.ts), solid like lamp posts; castK says when to refresh */
  cast: CastMember[] = []; castK = '';
  refreshCast() {
    const k = castKey(this); if (k === this.castK) return; this.castK = k;
    const drop = (o: Obstacle) => { const tx = Math.floor(o.x / T), ty = Math.floor(o.y / T); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const b = this.obs[(ty + dy) * W + tx + dx]; if (!b) continue; const i = b.indexOf(o); if (i >= 0) b.splice(i, 1); } };
    const add = (o: Obstacle) => { const tx = Math.floor(o.x / T), ty = Math.floor(o.y / T); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.obs[(ty + dy) * W + tx + dx]?.push(o); };
    for (const c of this.cast) drop(c.ob);
    this.cast = castOf(this);
    for (const c of this.cast) add(c.ob);
  }

  constructor(save: Save, seed = save.seed) {
    this.c = getCityOnce(); this.obs = obstacleGrid(this.c); this.s = save; this.R = rng(seed * 7919 + save.night);
    settleLessons(save);
    this.open = new Set(openDistricts(save));
    this.tripCost = { jade: 0, mooncake: 0, tea: 0, bowl: 0, fan: 0, mango: 0 };
    for (const g of GOODS) this.tripCost[g] = save.cargo[g] * GOOD[g].base;
    // parked rides: every kerb spot in an open district, some scooters need a jump-start
    const R = rng(seed + 11);
    // the business stalls stand on the pavement like any stall
    for (const b of BIZ) { const [bx, by] = bizPos(b); const tx = b.at[0], ty = b.at[1]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.obs[(ty + dy) * W + tx + dx].push({ x: bx, y: by + 6, r: 30 }); }
    for (const pk of this.c.parking) this.addRide(pk.kind as VehicleKind, pk.x, pk.y, pk.rot, R() < 0.18 && pk.kind === 'scooter', Math.floor(R() * 5));
    this.p = new Player(save.hero); this.mate = new Player(save.hero === 'dora' ? 'enzo' : 'dora');
    this.crates = makeCrates(this);
    const home = this.c.places[save.safe] ?? this.c.places['safe-market'];
    // (pass 13: a step clear of the safe house's door, so the first E is not the safe house by accident)
    this.placePlayer(home.x, home.y + T * 1.5);
    // the game was closed mid-job: say so, and lead back to its giver to start it again
    const lost = save.jobOpen ? MISSION[save.jobOpen] : null;
    if (lost) { save.jobOpen = undefined; const pl = this.c.places[lost.at]; if (pl && this.open.has(pl.d)) this.waypoint = [pl.x, pl.y]; this.say(`“${lost.title}” stopped when you left. Talk to ${PEOPLE[lost.giver]?.name ?? 'them'} to start it again (the gold line leads there).`, 'gold'); }
  }
  mateOf(p: Player) { return p === this.p ? this.mate : this.p; }
  /** where a pounce's target is now: a job actor by id, or (-1) the street crow */
  pounceTarget(id: number): [number, number] | null {
    if (id === -1) { const e = this.street; return e && e.kind === 'crow' && e.phase === 'on' && e.b ? [e.b.x, e.b.y] : null; }
    const a = this.run?.actors.find(a => a.id === id && !a.gone); return a ? [a.b.x, a.b.y] : null;
  }
  switchHero() { return switchHero(this); }
  get assist() { return this.s.settings.assist; }
  get easy() { return this.s.settings.diff === 'easy'; }
  get diff() { return DIFF[this.s.settings.diff]; }
  addRide(kind: VehicleKind, x: number, y: number, h: number, locked = false, tint = 0, mission = false): Ride {
    const v = VEHICLES[kind];
    const r: Ride = { id: this.nextId++, kind, b: { x, y, h, speed: 0, r: v.r, len: v.len, cls: v.cls }, parked: true, locked, tint, mission };
    this.rides.push(r); return r;
  }
  say(msg: string, kind = '', over?: string) { this.fx.push({ t: 'toast', msg, kind, over }); }
  ctx(roof = false, air = false, gates = true): Ctx { return { c: this.c, roof, air, obstacles: this.obs, blocked: gates && this.gates.size ? (tx, ty) => !this.open.has(districtAt(tx, ty)) || this.gates.has(ty * W + tx) : (tx, ty) => !this.open.has(districtAt(tx, ty)) }; }
  fieldTo(cls: 'foot' | 'walk' | 'small' | 'big' | 'boat', x: number, y: number): Field {
    const tx = Math.floor(x / T), ty = Math.floor(y / T); const key = `${cls}:${tx}:${ty}:${[...this.open].join()}`;
    let f = this.fieldCache.get(key);
    if (!f) { f = field(this.c, cls, tx, ty, this.open); this.fieldCache.set(key, f); if (this.fieldCache.size > 40) this.fieldCache.delete(this.fieldCache.keys().next().value!); }
    return f;
  }
  /** a flow field that only reaches `tiles` tiles from (x,y): for followers and chasers that are always near their goal,
   *  whose goal moves every tile (a whole-island search each time cost a millisecond or more) */
  fieldNear(cls: 'walk' | 'small', x: number, y: number, tiles = 48): Field {
    const tx = Math.floor(x / T), ty = Math.floor(y / T); const key = `near:${tiles}:${cls}:${tx}:${ty}:${[...this.open].join()}`;
    let f = this.fieldCache.get(key);
    if (!f) { f = field(this.c, cls, tx, ty, this.open, tiles * 10); this.fieldCache.set(key, f); if (this.fieldCache.size > 40) this.fieldCache.delete(this.fieldCache.keys().next().value!); }
    return f;
  }
  /** a free tile for a new ride near (x,y), clear of every other ride */
  rideSpot(kind: VehicleKind, x: number, y: number): [number, number] {
    return nearestFree(this.c, VEHICLES[kind].cls, x, y, this.open, 10, (cx, cy) => this.rides.some(r => dist(r.b.x, r.b.y, cx, cy) < 90));
  }
  placePlayer(x: number, y: number) {
    const [fx, fy] = nearestFree(this.c, 'foot', x, y, this.open);
    this.p.b.x = fx; this.p.b.y = fy; this.p.b.speed = 0; this.p.roof = false; this.p.hide = false;
    this.regroup();
  }
  /** the partner back at your side (a new place, a respawn, a replay) */
  regroup() {
    const m = this.mate; m.seat = null; m.act = null; m.hide = false; m.roof = this.p.roof; m.carry = null;
    if (m.ride) { m.ride.parked = true; m.ride.b.speed = 0; m.ride = null; }
    m.ai = newAI();
    if (this.p.ride) { seat(this, m, this.p.ride); return; }
    const [x, y] = nearestFree(this.c, 'walk', this.p.b.x - 44, this.p.b.y + 10, this.open, 3); m.b.x = x; m.b.y = y; m.b.speed = 0; m.face = 'down';
  }
  /** the player's current move class and capacity */
  get mode() { return this.p.ride ? this.p.ride.kind : 'foot'; }
  cap() { const v = this.p.ride ? VEHICLES[this.p.ride.kind].cargo : FOOT.cargo; return capacity(v, this.s.upgrades.cargo, !this.p.ride); }
  overloaded() { return cargoCount(this.s.cargo) > this.cap(); }

  // ── the step
  step(inp: Input, dt = DT, inp2?: Input) {
    if (this.talk || this.ui || this.failed) return;
    if (inp.swap) this.switchHero();
    this.time += dt; this.tick++; noiseStep(this);
    if (this.tick % 6 === 1 || !this.castK) this.refreshCast();
    this.s.stats.playTime += dt;
    this.clock(dt);
    this.rain = this.rainForce ?? rainAt(this.s.seed, this.s.night, this.s.clock);
    this.inputMag = Math.min(1, Math.hypot(inp.mx, inp.my)); if (this.inputMag > 0.1) this.inputAng = Math.atan2(inp.my, inp.mx);
    const f0 = this.fx.length;
    if (this.run) { this.run.time += dt; this.run.maxHeat = Math.max(this.run.maxHeat, this.heat); }
    this.phoneT = Math.max(0, this.phoneT - dt);
    this.raidStart();
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.gates.clear(); if (this.run) { closedTiles(this.run.sets, this.gates); teamGates(this.run, this.gates); }
    sgGates(this, this.gates);
    const cab = this.taxi?.st === 'ride' || !!this.ferry;
    if (this.ferry) ferryStep(this, dt);
    if (!cab) this.playerStep(inp, dt);
    this.p.grabT = Math.max(0, this.p.grabT - dt); this.p.cheerT = Math.max(0, this.p.cheerT - dt);
    if (cab) { /* in the back of a taxi: both heroes ride along */ } else if (this.two) this.p2Step(inp2 ?? NO_INPUT, dt); else { mateStep(this, dt); palStep(this, dt); }
    if (inp.hail && !cab) hail(this);
    taxiStep(this, dt);
    leash(this); this.leashT = Math.max(0, this.leashT - dt);
    distractStep(this);
    // the partner's pounce on the street crow (a job's pounces are checked by the job)
    if (this.mate.ai.mode === 'pounce' && this.mate.ai.tgt === -1) matePounceHit(this);
    if (inp.tag) tag(this);
    this.gearInput(this.p, inp);
    gearStep(this, dt);
    this.collectStep();
    trafficStep(this, dt); pedStep(this, dt);
    heatStep(this, dt);
    finesStep(this, dt); sgStep(this, dt); gangsStep(this, dt); eastStep(this); farStep(this); empireStep(this, dt);
    if (this.run) this.run.step(dt, inp);
    this.snatchStep(dt);
    eventsStep(this, dt);
    phoneStep(this);
    this.findNear();
    if (inp.act) this.interact();
    this.routeT -= dt; if (this.routeT <= 0) { this.routeT = 0.5; this.updateRoute(); }
    for (const n of checkTrophies(this.s)) this.fx.push({ t: 'trophy', name: n });
    const fxs = this.fx.slice(f0).map(f => f.t);
    if (fxs.includes('text')) this.phoneT = 1.6;
    tutorStep(this, dt, fxs);
    // the MRT hint: while it shows, the gold route line leads to Chinatown station (unless you set your own pin)
    if (this.tutor.cur === 'mrt' && !this.waypoint && !this.mrtGuide) this.mrtGuide = routeToStation(this, 'stn-chinatown');
    if (this.tutor.cur !== 'mrt' && this.mrtGuide) {
      this.mrtGuide = false; const s = stationById(this, 'stn-chinatown');
      if (s && this.waypoint && this.waypoint[0] === s.x && this.waypoint[1] === s.y) { this.waypoint = null; this.route = []; this.updateRoute(); }
    }
    if (this.fx.length > 300) this.fx.splice(0, this.fx.length - 300);
  }
  /** gadget keys for one player: fire, switch, reload (on a ride the passenger fires for the driver) */
  gearInput(p: Player, inp: Input) {
    const sh = shooterFor(this, p); if (!sh) { if (inp.fire && p.ride) this.say('Only the passenger can fire from a ride.', 'bad'); return; }
    if (inp.slot !== undefined) switchSlot(this, sh, inp.slot < 0 ? undefined : inp.slot);
    if (inp.reload) startReload(this, sh);
    if (inp.fire) { const r = fire(this, sh, inp.ax ?? NaN, inp.ay ?? NaN); if (r && r !== 'busy' && r !== 'reloading') this.say(r, 'bad'); }
  }
  /** the second player drives the partner: the same moves, through the same helpers (the world is briefly theirs) */
  p2Step(inp: Input, dt: number) {
    const m = this.mate;
    if (m.seat) { mateStep(this, dt); if (inp.act) leaveSeat(this, m); this.gearInput(m, inp); return; }
    const a = this.p, near = this.near;
    this.p = m; this.mate = a;
    try {
      this.playerStep(inp, dt);
      // the second player can board the first player's ride as the passenger, or use what is in reach
      if (inp.act && !m.ride && !m.act && a.ride && dist(a.ride.b.x, a.ride.b.y, m.b.x, m.b.y) < 100) board(this, m, a.ride);
      else if (inp.act) { this.findNear(); const n = this.near; if (n && P2_KINDS.includes(n.kind)) this.interact(); }
      if (inp.tag) tag(this);
      this.gearInput(m, inp);
    } finally { this.p = a; this.mate = m; this.near = near; }
  }
  /** events since the last drain (the scene and sound read these) */
  drain(): Fx[] { const out = this.fx; this.fx = []; return out; }

  clock(dt: number) {
    const before = this.s.clock;
    // one game minute a second (12 h nights), half that during a job; dawn waits until the job is done
    this.s.clock += dt * (this.assist ? 0.85 : 1) * (this.run ? 0.5 : 1);
    if (this.run && this.s.clock >= 719.5) this.s.clock = 719.5;
    accrue(this, Math.min(720, this.s.clock) - before);
    empireClock(this, before, this.s.clock);
    if (this.s.clock >= 720) this.newNight();
  }
  /** a raid starts as soon as you are free to answer it (not in a job, a menu, a talk or the middle of an action) */
  raidStart() {
    const rw = this.raidWait; if (!rw || this.run || this.ui || this.talk || this.failed || this.p.act || this.p.hide) return;
    this.raidWait = null;
    const b = BIZ_OF[rw.id]; this.startMission(raidMission(this, rw.id), { key: 'raid:' + rw.id, reward: 40, d: b.d });
  }
  /** a set-piece hazard hits you: a bump scaled by `k`, `stun` seconds without control, speed cut to `keep` */
  knock(x: number, y: number, k: number, kind: string, stun: number, keep: number) {
    const p = this.p, b = p.ride ? p.ride.b : p.b;
    b.speed *= keep; p.stunT = Math.max(p.stunT, stun); p.stunKind = kind; p.bumpT = Math.max(p.bumpT, 0.35); this.s.stats.bumps++;
    this.fx.push({ t: 'impact', x, y, k, kind });
  }
  newNight() {
    closeNight(this.s);
    this.s.clock = 0; this.s.night++;
    this.s.tips = this.s.tips.filter(t => t.night >= this.s.night - 1);
    this.banner = { text: `Night ${this.s.night}`, sub: 'The markets set new prices', t: 3 };
    this.fx.push({ t: 'night' });
    nightTip(this); empireNight(this); contractNight(this);
  }

  // ── the player
  playerStep(inp: Input, dt: number) {
    const p = this.p;
    p.animT += dt;
    if (p.seat) { const r = p.seat; p.b.x = r.b.x; p.b.y = r.b.y; p.anim = p.fireT > 0 ? 'pass-aim' : 'pass'; if (inp.act) leaveSeat(this, p); if (!this.rides.includes(r) || (this.mate.ride !== r)) leaveSeat(this, p); return; }
    if (p.act) {
      p.act.t += dt; p.anim = p.act.n;
      if (p.act.t >= p.act.dur) { const f = p.act.then; p.act = null; f?.(); }
      return;
    }
    p.dashCd = Math.max(0, p.dashCd - dt); p.hopCd = Math.max(0, p.hopCd - dt); p.boostCd = Math.max(0, p.boostCd - dt); p.bumpT = Math.max(0, p.bumpT - dt);
    if (p.hide) { p.anim = 'hide'; if (Math.hypot(inp.mx, inp.my) > 0.5) this.unhide(); return; }
    p.stunT = Math.max(0, p.stunT - dt); p.skidT = Math.max(0, p.skidT - dt); p.skidCd = Math.max(0, p.skidCd - dt);
    if (p.stunT > 0) inp = { ...inp, mx: 0, my: 0, dash: false, hop: false };
    let mx = inp.mx, my = inp.my;
    if (p.ride) return this.rideStep(inp, dt);
    // on foot
    p.sneak = inp.sneak;
    if (inp.dash && p.dashCd <= 0 && !p.air) { p.dashT = FOOT.dashT; p.dashCd = FOOT.dashCd; this.fx.push({ t: 'dash', x: p.b.x, y: p.b.y }); noise(this, p.b.x, p.b.y, 'dash'); if (Math.hypot(mx, my) < 0.2) { mx = Math.cos(p.b.h); my = Math.sin(p.b.h); } }
    // on foot, a sharp about-turn at a run skids
    if (Math.hypot(mx, my) > 0.5 && p.b.speed > 180 && p.skidCd <= 0 && Math.abs(angDiff(p.b.h, Math.atan2(my, mx))) > 2.3) { p.skidT = 0.22; p.skidCd = 0.6; this.fx.push({ t: 'skid', x: p.b.x, y: p.b.y + 8, k: 0.6 }); }
    if (inp.hop && p.hopCd <= 0 && !p.air) { p.hopT = FOOT.hopT; p.hopCd = FOOT.hopCd + FOOT.hopT; this.fx.push({ t: 'hop', x: p.b.x, y: p.b.y }); }
    const over = this.overloaded();
    let top = p.sneak || (p === this.p && this.run?.walkOnly()) ? FOOT.walk : FOOT.run;
    if (over) top = FOOT.walk * 0.75;
    if (p.dashT > 0) { p.dashT -= dt; top = FOOT.dash; if (Math.hypot(mx, my) < 0.2) { mx = Math.cos(p.b.h); my = Math.sin(p.b.h); } }
    const wasAir = p.air;
    if (p.air) { p.hopT -= dt; if (Math.hypot(mx, my) < 0.2 && p.b.speed > 40) { mx = Math.cos(p.b.h); my = Math.sin(p.b.h); } top = Math.max(top, 230); }
    const ctx = this.ctx(p.roof, p.air || wasAir);
    const ox = p.b.x, oy = p.b.y;
    const res = drive(ctx, p.b, mx, my, top, 2400, 30, dt, true);
    if (res.bump > 160 && !p.air) { p.bumpT = 0.3; this.fx.push({ t: 'bump', x: p.b.x, y: p.b.y, k: 0.5 }); noise(this, p.b.x, p.b.y, 'crash', 'you', 180); }
    // running footsteps carry a little way (a walk or a sneak is silent); a hop lands with a thump
    if (!p.sneak && p.b.speed > FOOT.walk + 15 && !p.air && Math.floor(p.animT * 3) !== Math.floor((p.animT - dt) * 3)) noise(this, p.b.x, p.b.y, 'step');
    const moved = Math.hypot(p.b.x - ox, p.b.y - oy); this.s.stats.walked += moved;
    // landing from a hop: on a roof you must land on a roof; in the street you can't land in a low prop
    if (wasAir && !p.air) { this.land(); this.fx.push({ t: 'land', x: p.b.x, y: p.b.y, k: 0.4 }); if (!p.sneak) noise(this, p.b.x, p.b.y, 'hop'); }
    if (p.roof && !p.air) { const tx = Math.floor(p.b.x / T), ty = Math.floor(p.b.y / T); if (this.c.flags[ty * W + tx] & F_ROOF) p.lastRoof = [p.b.x, p.b.y]; }
    // facing and animation
    if (p.b.speed > 8) this.faceFrom(p.b.h);
    p.anim = p.stunT > 0 ? (p.stunKind === 'neon' || p.stunKind === 'drum' ? 'duck' : 'tumble') : p.air ? 'hop' : p.skidT > 0 ? 'skid' : p.dashT > 0 ? 'dash' : p.bumpT > 0 ? 'bump' : this.pushing ? 'push' : p.b.speed > 8 ? (p.carry ? 'carry' : p.sneak ? 'sneak' : p.b.speed > FOOT.walk + 10 ? 'run' : this.rain > 0.3 && !p.shade ? 'umbrella' : 'walk') : (p.carry ? 'carry-idle' : this.phoneT > 0 ? 'phone' : 'idle');
    if (this.pushing) this.faceFrom(this.inputAng);
  }
  land() {
    const p = this.p; if (p.roof && this.mate.roof && this.two && p === this.mate) return; const tx = Math.floor(p.b.x / T), ty = Math.floor(p.b.y / T);
    const i = ty * W + tx;
    if (p.roof && !(this.c.flags[i] & F_ROOF)) {
      if (this.run?.leap(true)) return;
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
    // a hired bike flies along East Coast Park's cycling track
    if (r.kind === 'bike' && this.c.ground[Math.floor(r.b.y / T) * W + Math.floor(r.b.x / T)] === G.CYCLE) top *= 1.18;
    const turn = v.turn * (1 + up.grip * 0.1);
    if (inp.dash && p.boostCd <= 0) { p.boostT = 0.7; p.boostCd = 2.4; this.fx.push({ t: 'boost', x: r.b.x, y: r.b.y }); }
    if (inp.hop) this.honk();
    if (p.boostT > 0) { p.boostT -= dt; top *= 1.35; }
    let mx = inp.mx, my = inp.my;
    // a hard turn at speed skids and throws up dust
    if (Math.hypot(mx, my) > 0.5 && r.b.speed > 200 && p.skidCd <= 0 && r.kind !== 'boat' && Math.abs(angDiff(r.b.h, Math.atan2(my, mx))) > 1.2) { p.skidCd = 0.35; this.fx.push({ t: 'skid', x: r.b.x - Math.cos(r.b.h) * 20, y: r.b.y - Math.sin(r.b.h) * 20, k: Math.min(1, r.b.speed / 340) }); }
    if (p.boostT > 0 && Math.hypot(mx, my) < 0.2) { mx = Math.cos(r.b.h); my = Math.sin(r.b.h); }
    // aim help: when chasing, lean the stick toward a close target that is roughly ahead
    if (this.assist && this.run) { const a = this.run.aimAt(); if (a) { const d = dist(a[0], a[1], r.b.x, r.b.y); const ang = Math.atan2(a[1] - r.b.y, a[0] - r.b.x); const want = Math.atan2(my, mx); if (d < 170 && Math.hypot(mx, my) > 0.3 && Math.abs(angDiff(want, ang)) < 0.6) { mx = mx * 0.6 + Math.cos(ang) * 0.4; my = my * 0.6 + Math.sin(ang) * 0.4; } } }
    const ox = r.b.x, oy = r.b.y;
    const res = drive(this.ctx(), r.b, mx, my, top, v.accel * (1 + up.speed * 0.05), turn, dt, false);
    const moved = Math.hypot(r.b.x - ox, r.b.y - oy);
    // on Normal and Hard, a warden notices a ride that runs a red light
    if (r.kind !== 'boat' && r.b.speed > 90 && redRun(this, ox, oy, r.b.x, r.b.y, r.b.h) >= 0) {
      if (this.diff.redLight > 0) { addHeat(this, this.diff.redLight, 'red-light'); this.say('You ran a red light! A warden saw you.', 'bad'); }
      offence(this, 'red', r.b.x, r.b.y, true);
    }
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
    noise(this, x, y, 'crash', 'you', 160 + Math.min(260, k * 0.6));
    this.run?.onBump(k, what);
    // smashing a stall at speed brings the wardens
    if (what === 'wall') {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (ty + dy) * W + tx + dx; if (this.c.solid[i] === S.TALL && k > 170) { addHeat(this, 0.45, 'stall'); this.fx.push({ t: 'spill', x, y }); noise(this, x, y, 'prop'); return; } }
    }
  }
  honk() { if (this.p.boostCd > 2.1) return; this.fx.push({ t: 'honk', x: this.p.x, y: this.p.y }); noise(this, this.p.x, this.p.y, 'horn'); for (const pd of this.peds) if (dist(pd.x, pd.y, this.p.x, this.p.y) < 220) pd.scare = 1; }

  // ── getting on and off
  enter(r: Ride) {
    const p = this.p;
    if (r.broken) { this.say('It won’t start. Give it a push: lean into it on foot.', 'bad'); return; }
    // a no-rides contract (lib/jade-proc.ts): on foot all the way
    if (this.run?.m.mods?.includes('foot')) { this.say('No rides on this contract: on foot all the way!', 'bad'); return; }
    if (r.locked) { this.ui = { kind: 'mini', mini: 'wires', level: 1, from: 'ride' }; this.pendingRide = r; this.fx.push({ t: 'mini' }); return; }
    if (p.carry === 'durian' && (r.kind === 'tuktuk' || r.kind === 'trishaw' || r.kind === 'boat')) offence(this, 'durian', r.b.x, r.b.y, true);
    p.act = { n: 'climb-on', t: 0, dur: 0.32, then: () => { p.ride = r; r.parked = false; p.b.x = r.b.x; p.b.y = r.b.y; p.hide = false; this.enteredAt = this.time; this.fx.push({ t: 'enter', kind: r.kind }); if (r.kind === 'bike') this.s.stats.bikes++; this.run?.onEnter(r); } };
    p.face = 'side'; p.flip = r.b.x < p.b.x;
    // walk the hero onto the seat during the climb
    p.b.x = r.b.x; p.b.y = r.b.y;
  }
  pendingRide: Ride | null = null;
  /** when you last got on a ride: a double-tapped action key doesn't throw you straight back off */
  enteredAt = -9;
  miniDone(ok: boolean) {
    const ui = this.ui; this.ui = null;
    this.s.stats.minis++;
    if (!ui || ui.kind !== 'mini') return;
    if (ui.from === 'sg') { if (ok) { this.s.cash += 12; this.s.stats.kopi = (this.s.stats.kopi ?? 0) + 1; addRep(this.s, 'market', 1); this.banner = { text: 'Shiok!', sub: 'Uncle Teo pays you 12 coins', t: 2.2 }; cheer(this); } else this.say('Uncle Teo shakes his head. Again, slowly this time.'); return; }
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
    if (!spot) { const [x, y] = nearestFree(this.c, 'foot', r.b.x, r.b.y, this.open, r.kind === 'boat' ? 3 : 4); if (Math.hypot(x - r.b.x, y - r.b.y) > T * (r.kind === 'boat' ? 3.2 : 2.6) || this.c.solid[Math.floor(y / T) * W + Math.floor(x / T)] !== S.OPEN) { this.say(r.kind === 'boat' ? 'Steer to the bank or a jetty to step off.' : 'No room to get off here.', 'bad'); return false; } spot = [x, y]; }
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
    // (`bias`: a prompt that should win over others at the same spot, such as the contract you routed to)
    const cand = (n: Near, r: number, bias = 0) => { const d = dist(n.x, n.y, x, y); if (d < r && d - bias < bd) { bd = d - bias; best = n; } };
    if (this.taxi?.st === 'ride') { this.near = { kind: 'taxi', label: 'Skip to the drop-off', x, y }; return; }
    if (this.ferry) { this.near = { kind: 'ferry', label: 'Skip to the pier', x, y }; return; }
    if (p.hide) { this.near = { kind: 'unhide', label: 'Come out', x, y }; return; }
    if (this.ticket) { this.near = { kind: 'fine', label: `Pay the ticket: ${FINE[this.ticket.kind].name.toLowerCase()}, ${this.ticket.amt} coins`, x, y }; return; }
    if (p.seat) { this.near = null; return; }
    if (p.ride) {
      if (this.run?.wantsRide()) { this.near = null; }
      // a job's giver is close: E gets off and talks to them (before "Get off")
      if (!this.run && p.ride.kind !== 'boat') for (const m of offered(this.s)) { const pl = this.c.places[m.at]; if (pl) cand({ kind: 'mission', label: `Talk to ${PEOPLE[m.giver].name}: “${m.title}”`, x: pl.x, y: pl.y, id: m.id }, 130); }
      for (const id of ['garage-market', 'garage-canal']) { const g = this.c.places[id]; if (this.open.has(g.d)) cand({ kind: 'garage', label: 'Garage: upgrades and paint', x: g.x, y: g.y, id }, 110); }
      // markets are drive-up: trade from the saddle
      if (p.ride.kind !== 'boat') for (const pl of Object.values(this.c.places)) if (pl.kind === 'market' && this.open.has(pl.d)) cand({ kind: 'market', label: `Trade at ${MARKET_NAME[pl.d]}`, x: pl.x, y: pl.y, id: pl.d }, 120);
      if (!best) best = { kind: 'exit', label: p.ride.kind === 'boat' ? 'Step off the boat' : 'Get off', x, y };
      this.near = best; return;
    }
    if (p.roof) { const lp = this.run?.nearAction(x, y); if (lp) { this.near = lp; return; } for (const l of this.c.ladders) cand({ kind: 'ladder-down', label: 'Climb down', x: l.rx * T + T / 2, y: l.ry * T + T / 2 }, 70); this.near = best; return; }
    // a giver with no job for you now: walk up and have a word
    if (!this.run) for (const cm of this.cast) if (!cm.job && CHAT[cm.id]) cand({ kind: 'giver', label: `Talk to ${PEOPLE[cm.id].name}`, x: cm.x, y: cm.y, id: cm.id }, 64);
    // an empire person waiting outside your property: E takes their job
    if (!this.run) for (const cm of this.cast) if (cm.job?.startsWith('emp:')) { const [, jid, bid] = cm.job.split(':'); cand({ kind: 'empire', label: `${PEOPLE[cm.id].name}: ${EMPIRE_JOB[jid]?.title ?? 'a job'} at the ${BIZ_OF[bid]?.name ?? 'shop'}`, x: cm.x, y: cm.y, id: `job:${jid}:${bid}` }, 72); }
    // a job offered at a station's gates is taken from its giver standing there, so E at the gates still rides the train
    if (!this.run) for (const m of offered(this.s)) { const pl = this.c.places[m.at]; if (!pl) continue; const g = m.at.startsWith('stn-') ? this.cast.find(c => c.id === m.giver) : null; cand({ kind: 'mission', label: `${PEOPLE[m.giver].name}: “${m.title}”`, x: g ? g.x : pl.x, y: g ? g.y : pl.y, id: m.id }, g ? 60 : 80); }
    const rm = this.run?.nearAction(x, y); if (rm) cand(rm, 90);
    for (const [id, pl] of Object.entries(this.c.places)) {
      if (!this.open.has(pl.d)) continue;
      if (pl.kind === 'market') cand({ kind: 'market', label: `Trade at ${MARKET_NAME[pl.d]}`, x: pl.x, y: pl.y, id: pl.d }, 90);
      if (pl.kind === 'safe') cand(safeOpen(this.s, id) ? { kind: 'safe', label: `${pl.name}`, x: pl.x, y: pl.y, id } : { kind: 'buy-safe', label: `${pl.name} (for sale)`, x: pl.x, y: pl.y, id }, 80);
      if (pl.kind === 'garage') cand({ kind: 'garage', label: 'Garage: upgrades and paint', x: pl.x, y: pl.y, id }, 80);
    }
    if (!this.run) for (const g of this.gigs()) cand(g, 70);
    if (stallOpen(this.s)) { const [gx, gy] = stallPos(this); cand({ kind: 'gear', label: 'Tock’s toy stall: gadgets, ammo and upgrades', x: gx, y: gy + 40 }, 80); }
    if (!this.run) for (const b of BIZ) if (this.open.has(b.d)) { const [bx, by] = bizPos(b); cand({ kind: 'biz', label: bizLabel(this, b), x: bx, y: by + 40, id: b.id }, 80); }
    if (!this.run) empireNear(this, cand);
    if (!this.run) contractNear(this, cand);
    const en = eventNear(this); if (en) cand(en, 80);
    if (!this.run) { sgNear(this, cand); gangNear(this, cand); eastNear(this, cand); farNear(this, cand); }
    if (this.festival) for (const f of this.c.festival) if (f.kind !== 'arch') cand({ kind: 'festival', label: f.kind === 'stage' ? 'Dance on the festival stage' : 'Let a sky lantern go', x: f.x, y: f.y, id: f.kind }, 80);
    for (const pr of this.tables()) cand({ kind: 'eat', label: 'Grab a bowl of noodles (3 coins)', x: pr.x, y: pr.y + 20 }, 56);
    for (const l of this.c.ladders) cand({ kind: 'ladder-up', label: 'Climb the ladder', x: l.x * T + T / 2, y: l.y * T + T / 2 }, 60);
    for (const h of this.c.hides) cand({ kind: 'hide', label: 'Hide here', x: h.x, y: h.y }, 52);
    // the island: a station's gates (a job's train step names its stop), a taxi waiting at the kerb
    const stn = stationNear(this);
    if (stn && (!this.run || this.run.cur?.t === 'train')) cand({ kind: 'station', label: this.run?.cur?.t === 'train' ? `${stn.name}: take the train to ${this.c.places[this.run.cur.to]?.name ?? 'the next stop'}` : `Ride the MRT (${stn.name}, 2 coins)`, x: stn.x, y: stn.y, id: stn.id }, 110);
    if (this.taxi?.st === 'wait') cand({ kind: 'taxi', label: 'Get in the taxi', x: this.taxi.b.x, y: this.taxi.b.y }, 110);
    // the cable car station and the ferry pier (a job's cable step names its stop)
    const lk = linkNear(this);
    if (lk && (!this.run || this.run.cur?.t === 'cable')) {
      const fare = FARES[lk.link.id], what = lk.link.id === 'cable' ? 'the cable car' : 'the ferry';
      cand({ kind: lk.link.id, label: `Ride ${what} to ${lk.to.name} (${fare} coins)`, x: lk.from.x, y: lk.from.y, id: lk.from.id }, 110);
    }
    // the island's playgrounds have a slide; after Island Night the Float @ Marina Bay is a dance floor
    if (!this.run && this.c.isle) {
      for (const pr of this.c.props) if (pr.sprite === 'playground' && this.open.has(districtAt(Math.floor(pr.x / T), Math.floor(pr.y / T)))) cand({ kind: 'isle', label: 'Go down the slide', x: pr.x, y: pr.y + 40, id: 'slide' }, 90);
      const [sx0, sy0, sx1, sy1] = this.c.isle.stage;
      if (this.s.story.isle && this.open.has('bay')) cand({ kind: 'isle', label: 'Dance on the Float @ Marina Bay', x: (sx0 + sx1) / 2 * T, y: (sy0 + sy1) / 2 * T, id: 'dance' }, 150);
    }
    for (const m of this.c.murals) if (!this.s.murals.includes(m.id) && this.open.has(districtAt(Math.floor(m.x / T), Math.floor(m.y / T)))) cand({ kind: 'mural', label: 'Restore the faded mural', x: m.x, y: m.y + 30, id: m.id }, 60);
    for (const r of this.rides) if (r.parked && this.open.has(districtAt(Math.floor(r.b.x / T), Math.floor(r.b.y / T)))) cand({ kind: 'ride', label: `${r.locked ? 'Jump-start' : 'Ride'} the ${VEHICLES[r.kind].name.toLowerCase()}`, x: r.b.x, y: r.b.y, ride: r }, r.kind === 'boat' ? 96 : 70);
    // the taxi you called wins once it is in reach
    if (this.taxi?.st === 'wait' && dist(this.taxi.b.x, this.taxi.b.y, x, y) < 110) best = { kind: 'taxi', label: 'Get in the taxi', x: this.taxi.b.x, y: this.taxi.b.y };
    // a job's train step: the station gates win over a scooter parked by the entrance
    if (lk && this.run?.cur?.t === 'cable' && (best as Near | null)?.kind === 'ride') best = { kind: lk.link.id, label: `Ride to ${lk.to.name}`, x: lk.from.x, y: lk.from.y, id: lk.from.id };
    // a job's ride step: its ride wins over a festival stage or a stall beside it
    const jr = this.run?.cur?.t === 'ride' ? this.run.ride : null;
    if (jr && jr.parked && dist(jr.b.x, jr.b.y, x, y) < 80) best = { kind: 'ride', label: `${jr.locked ? 'Jump-start' : 'Ride'} the ${VEHICLES[jr.kind].name.toLowerCase()}`, x: jr.b.x, y: jr.b.y, ride: jr };
    if (stn && this.run?.cur?.t === 'train' && (best as Near | null)?.kind === 'ride') best = { kind: 'station', label: `${stn.name}: take the train`, x: stn.x, y: stn.y, id: stn.id };
    this.near = best;
  }
  gigs(): Near[] { return this.run ? [] : gigBoards(this); }
  interact() {
    const n = this.near, p = this.p; if (!n) return;
    // a wave or point is only a flourish: E still works through it (getting in a taxi as it pulls up)
    if (p.act && ['point', 'hail', 'wave'].includes(p.act.n)) p.act = null;
    if (p.act) return;
    switch (n.kind) {
      case 'mission': if (this.p.ride) this.exit(); this.startMission(MISSION[n.id!]); break;
      case 'giver': this.talk = { lines: [[n.id!, CHAT[n.id!], 'happy']], i: 0 }; this.fx.push({ t: 'open' }); break;
      case 'market': this.ui = { kind: 'market', d: n.id as District }; this.fx.push({ t: 'open' }); break;
      case 'safe': this.ui = { kind: 'safe', id: n.id! }; this.s.safe = n.id!; this.fx.push({ t: 'open' }); break;
      case 'buy-safe': this.ui = { kind: 'safe', id: n.id! }; this.fx.push({ t: 'open' }); break;
      case 'garage': this.ui = { kind: 'garage', id: n.id! }; this.fx.push({ t: 'open' }); break;
      case 'ride': this.enter(n.ride!); break;
      case 'exit': if (this.time - this.enteredAt > 0.45) this.exit(); break;
      case 'ladder-up': { const l = this.c.ladders.find(l => dist(l.x * T + T / 2, l.y * T + T / 2, n.x, n.y) < 2)!; p.act = { n: 'climb', t: 0, dur: 0.45, then: () => { p.roof = true; p.b.x = l.rx * T + T / 2; p.b.y = l.ry * T + T / 2; p.lastRoof = [p.b.x, p.b.y]; this.fx.push({ t: 'climb' }); } }; break; }
      case 'ladder-down': { const l = this.c.ladders.find(l => dist(l.rx * T + T / 2, l.ry * T + T / 2, n.x, n.y) < 2)!; p.act = { n: 'climb', t: 0, dur: 0.45, then: () => { p.roof = false; p.b.x = l.x * T + T / 2; p.b.y = l.y * T + T / 2; this.fx.push({ t: 'climb' }); } }; break; }
      case 'hide': p.act = { n: 'enter-door', t: 0, dur: 0.3, then: () => { p.hide = true; p.b.x = n.x; p.b.y = n.y; p.b.speed = 0; this.fx.push({ t: 'hide' }); } }; break;
      case 'unhide': this.unhide(); break;
      case 'mural': p.act = { n: 'paint', t: 0, dur: 1.4, then: () => { this.s.murals.push(n.id!); this.s.cash += 30; this.s.stats.murals++; const d = districtAt(Math.floor(n.x / T), Math.floor(n.y / T)); addRep(this.s, d, 3); this.fx.push({ t: 'mural', x: n.x, y: n.y }); this.say(`Mural restored (${this.s.murals.length} of ${this.c.murals.length}) · +30 coins, +3 rep`, 'good'); } }; p.face = 'up'; break;
      case 'gig': startGig(this, n.id!); break;
      case 'leap': this.run?.leap(); break;
      case 'biz': this.ui = { kind: 'biz', id: n.id as BizId }; this.fx.push({ t: 'open' }); break;
      case 'gear': this.ui = { kind: 'gear' }; this.fx.push({ t: 'open' }); break;
      case 'event': eventAct(this); break;
      case 'sg': sgAct(this, n.id!); break;
      case 'gang': gangAct(this, n.id!); break;
      case 'east': eastAct(this, n.id!); break;
      case 'far': farAct(this, n.id!); break;
      case 'empire': empireAct(this, n.id!); break;
      case 'contract': contractAct(this, n.id!); break;
      case 'fine': payTicket(this); break;
      case 'station': {
        const st = this.run?.cur; if (st?.t === 'train') { if (n.id === st.to) { this.say('You are already here.', 'bad'); break; } mrtTo(this, st.to); break; }
        const why = cantRide(this); if (why) { this.say(why, 'bad'); break; }
        this.ui = { kind: 'mrt', from: n.id! }; this.fx.push({ t: 'open' }); p.act = { n: 'tap-card', t: 0, dur: 0.5 }; p.face = 'up'; break;
      }
      case 'job': this.run?.jobAct(n.id!); break;
      case 'cable': case 'ferry': if (this.ferry) ferryLand(this); else { p.face = 'up'; linkGo(this); } break;
      case 'taxi': if (this.taxi?.st === 'ride') skipRide(this); else { this.ui = { kind: 'taxi' }; this.fx.push({ t: 'open' }); } break;
      case 'isle':
        if (n.id === 'slide') { p.act = { n: 'slide', t: 0, dur: 1.3, then: () => { p.b.y += 40; this.fx.push({ t: 'good-deed' }); } }; p.face = 'down'; this.fx.push({ t: 'hop' }); }
        else { p.act = { n: 'isle-dance', t: 0, dur: 2.6 }; this.mate.act = { n: 'isle-dance', t: 0, dur: 2.6 }; this.fx.push({ t: 'dance' }); }
        break;
      case 'festival': if (n.id === 'stage') { p.act = { n: 'dance', t: 0, dur: 2.4 }; this.fx.push({ t: 'dance' }); } else { p.act = { n: 'lantern', t: 0, dur: 1.2, then: () => { this.fx.push({ t: 'sky-lantern', x: p.b.x, y: p.b.y }); p.act = { n: 'look-up', t: 0, dur: 1.6 }; } }; } p.face = 'down'; break;
      case 'eat': if (this.s.cash < 3) { this.say('You need 3 coins for noodles.', 'bad'); break; } this.s.cash -= 3; p.act = { n: 'eat', t: 0, dur: 2.6, then: () => this.say('Delicious! Chef Mo’s noodles hit the spot.', 'good') }; p.face = 'down'; this.fx.push({ t: 'eat' }); break;
    }
  }
  unhide() { this.p.hide = false; this.p.act = { n: 'climb-off', t: 0, dur: 0.25 }; this.fx.push({ t: 'unhide' }); }

  /** food-court tables you can sit at */
  tables() { return this.c.tables.filter(p => this.open.has(districtAt(Math.floor(p.x / T), Math.floor(p.y / T))) && Math.abs(p.x - this.p.x) < 120 && Math.abs(p.y - this.p.y) < 120); }
  get festival() { return this.s.done.includes('m25'); }
  // ── story
  /** play a finished job again from the jobs book: you walk out of the menu next to its contact */
  replay(id: string): string | null {
    const m = MISSION[id]; if (!m) return 'No such job';
    if (!this.s.done.includes(id)) return 'Finish this job in the story first';
    if (this.run) return 'Finish or quit the job you are on first';
    if (this.p.ride) { this.p.ride.parked = true; this.p.ride.b.speed = 0; this.p.ride = null; }
    const pl = this.c.places[m.at]; this.clearHeat(); this.street = null; this.crowd = null;
    this.placePlayer(pl.x, pl.y + T * 0.8); this.p.roof = false; this.p.hide = false; this.p.carry = null;
    this.replaying = true; this.startMission(m); return null;
  }
  startMission(m: Mission, gig?: Gig) {
    if (this.run) return;
    if (!gig) { this.street = null; this.crowd = null; this.pushing = false; }
    this.run = new Run(this, m, gig);
    if (!gig) this.s.jobOpen = m.id;
    this.fx.push({ t: 'mission-start', name: m.title });
    this.banner = { text: m.title, sub: gig?.key.startsWith('con:') ? `${gig.key.startsWith('con:day') ? 'Contract of the day' : gig.key.startsWith('con:push') ? 'Retake' : 'Contract'} · ${PEOPLE[m.giver]?.name ?? ''}` : gig ? 'Side gig' : m.side ? `Hawker Tales · ${PEOPLE[m.giver].name}` : `Chapter ${m.ch} · ${PEOPLE[m.giver].name}`, t: 2.6 };
    this.run.begin();
  }
  finishMission(m: Mission, gig?: Gig) {
    this.lastRun = this.run; this.run = null; this.route = []; this.s.jobOpen = undefined;
    if (gig && gig.key.startsWith('emp:')) { empireJobDone(this, gig.key); this.s.cash += gig.reward; addRep(this.s, gig.d, 2); this.fx.push({ t: 'mission-done', name: m.title, k: gig.reward }); this.banner = { text: 'Empire job done!', sub: `${m.title} · +${gig.reward} coins · the shop takes more for a few nights`, t: 2.8 }; this.p.act = this.p.ride ? null : { n: 'celebrate', t: 0, dur: 1.1 }; return; }
    if (gig && gig.key.startsWith('con:')) { const sub = contractDone(this, gig.key, this.lastRun?.time ?? 0); this.s.cash += gig.reward; addRep(this.s, gig.d, m.rep); this.fx.push({ t: 'mission-done', name: m.title, k: gig.reward }); this.banner = { text: 'Contract done!', sub: `${m.title} · +${gig.reward} coins${sub}`, t: 3 }; this.p.act = this.p.ride ? null : { n: 'celebrate', t: 0, dur: 1.1 }; this.cheer(); return; }
    if (gig && gig.key.startsWith('raid:')) { const id = gig.key.slice(5) as BizId; raidJobWon(this, id); this.s.cash += gig.reward; addRep(this.s, gig.d, 2); this.fx.push({ t: 'mission-done', name: m.title, k: gig.reward }); this.banner = { text: 'Raid repelled!', sub: `The till is safe · +${gig.reward} coins`, t: 2.6 }; this.p.act = this.p.ride ? null : { n: 'celebrate', t: 0, dur: 1.1 }; return; }
    if (gig) { this.s.cash += gig.reward; this.s.stats.gigs++; addRep(this.s, gig.d, 2); this.s.best[gig.key] = Math.max(this.s.best[gig.key] ?? 0, 1); this.fx.push({ t: 'mission-done', name: m.title, k: gig.reward }); this.banner = { text: 'Gig done!', sub: `+${gig.reward} coins`, t: 2.4 }; return; }
    const run = this.lastRun; const res = { time: run?.time ?? 0, maxHeat: run?.maxHeat ?? 0, retries: run?.retries ?? 0 };
    const medal = medalOf(m, res), was = this.s.medals[m.id];
    this.s.medals[m.id] = { m: Math.max(was?.m ?? 0, medal), t: was?.t ? Math.min(was.t, res.time) : res.time, plays: (was?.plays ?? 0) + 1 };
    this.lastMedal = { id: m.id, medal, ...res, best: !was || medal > was.m };
    if (!this.s.done.includes(m.id)) { this.s.done.push(m.id); this.s.cash += m.reward; this.s.stats.missions++; addRep(this.s, this.c.places[m.at]?.d ?? 'market', m.rep); }
    else if (this.replaying) this.s.cash += Math.round(m.reward / 4);
    this.replaying = false;
    if (m.tip) this.s.tips = this.s.tips.filter(t => !(t.market === m.tip!.market && t.good === m.tip!.good));
    const before = this.open.size, hadIsle = this.open.has('heartland'), hadEast = this.open.has('india'), hadResort = this.open.has('resort'), hadFar = this.open.has('katong'), hadChangi = this.open.has('changi'); this.open = new Set(openDistricts(this.s));
    if (!hadIsle && this.open.has('heartland')) text(this, 'kamal', MRT_TEXT);
    if (!hadEast && this.open.has('india')) text(this, 'kamal', EAST_TEXT);
    if (!hadResort && this.open.has('resort')) text(this, 'helang', RESORT_TEXT);
    if (!hadFar && this.open.has('katong')) text(this, 'kamal', FAR_TEXT);
    if (!hadChangi && this.open.has('changi')) text(this, 'tiara', CHANGI_TEXT);
    this.fieldCache.clear();
    this.fx.push({ t: 'mission-done', name: m.title, k: m.reward });
    this.banner = { text: 'Job done!', sub: `${m.title} · ${MEDAL_NAME[medal]}${medal ? ' medal' : ''}`, t: 3 };
    this.p.act = { n: 'celebrate', t: 0, dur: 1.1 };
    if (this.p.ride) this.p.act = null;
    this.cheer();
    for (const g of GEAR_GIFT[m.id] ?? []) if (giveGadget(this.s, g)) { this.fx.push({ t: 'gadget-gift', kind: g }); this.say(`New gadget: the ${GADGETS[g].name.toLowerCase()}! ${GADGETS[g].blurb}`, 'good'); }
    if (this.open.size > before) { const d = [...this.open][this.open.size - 1]; this.fx.push({ t: 'district', name: DISTRICT_NAME[d] }); this.banner = this.open.size - before > 1 ? (this.open.has('katong') && !hadFar ? { text: 'Over the Geylang River!', sub: 'Katong and Orchard Road: take the MRT to Katong Park or Orchard', t: 4.5 } : this.open.has('india') && !hadEast ? { text: 'Over the Rochor River!', sub: 'Little India and Kampong Glam: take the MRT to Bugis or Little India', t: 4.5 } : { text: 'The island opens!', sub: 'Toa Payoh and Marina Bay: take the MRT from Chinatown station', t: 4.5 }) : { text: `${DISTRICT_NAME[d][0].toUpperCase()}${DISTRICT_NAME[d].slice(1)} opens!`, sub: 'The fog lifts', t: 4 }; }
    // the ending and credits play once, the first time Glint is beaten; a replay of the last job just ends
    if (m.id === 'm25' && !this.s.story.ending) this.fx.push({ t: 'finale' });
    // the island's ending plays once, the first time Director Kaw is stopped
    if (m.id === 'm35' && !this.s.story.isle) this.fx.push({ t: 'finale', kind: 'isle' });
    // and chapter seven's, the first time Crow Number Nine is stopped
    if (m.id === 'm45' && !this.s.story.lights) this.fx.push({ t: 'finale', kind: 'lights' });
    // and chapter eight's, the first time Datin Ciku is stopped at the Rain Vortex
    if (m.id === 'm55' && !this.s.story.coast) this.fx.push({ t: 'finale', kind: 'coast' });
  }
  /** the partner cheers (a job done, a catch) */
  cheer() { const m = this.mate; if (m.seat) m.cheerT = 1.2; else if (!m.act && !m.ride && !m.hide) m.act = { n: 'celebrate', t: 0, dur: 1.1 }; }
  lastRun: Run | null = null; lastMedal: { id: string; medal: number; time: number; maxHeat: number; retries: number; best: boolean } | null = null;
  fail(reason: string) {
    if (!this.run) return; this.failed = { reason }; this.fx.push({ t: 'fail', msg: reason });
    // a contract's giver has something to say about it (their own voice, lib/jade-proc.ts VOICE)
    const f = this.run.m.fails; if (f?.length) this.say(`${PEOPLE[this.run.m.giver]?.name ?? ''}: “${f[(this.run.retries + this.tick) % f.length]}”`, 'bad');
  }
  retry() { this.failed = null; this.heat = 0; this.clearHeat(); if (this.run) this.run.retries++; this.run?.restore(); }
  quitJob() { this.s.jobOpen = undefined; const rid = this.run ? raidId(this.run.m.id) : null; if (rid) this.say(missRaid(this, rid), 'bad');
    this.failed = null; if (this.run && this.banner?.text === this.run.m.title) this.banner = null; this.run?.cleanup(); this.run = null; this.route = []; this.p.carry = null; this.replaying = false; }
  clearHeat() { this.heat = 0; this.wardens = []; this.blocks = []; this.blimp.on = false; }
  advanceTalk() {
    const t = this.talk; if (!t) return;
    t.i++;
    if (t.i >= t.lines.length) { this.talk = null; t.done?.(); }
  }
  heroName() { return this.p.who === 'dora' ? 'Dora' : 'Enzo'; }
  /** choose who you control (the title screen); the other becomes the partner */
  setHero(h: Hero) { if (this.p.who !== h) { const a = this.p; this.p = this.mate; this.mate = a; const [x, y] = [a.b.x, a.b.y]; a.b.x = this.p.b.x; a.b.y = this.p.b.y; this.p.b.x = x; this.p.b.y = y; } this.s.hero = h; }

  // ── the route arrow: a path to the current objective
  /** a pin the player dropped on the full map (used when no job is running) */
  waypoint: [number, number] | null = null;
  /** the first-ride hint set the route to Chinatown station (and clears it when the hint goes) */
  mrtGuide = false;
  /** the ride on the way (pass 13): set while the gold line leads to a station or pier first, null when walking */
  travel: Travel | null = null;
  /** where the gold line leads: the goal, or (free roam, far away) the station or pier to ride there from */
  objective(): [number, number] | null {
    if (this.run) { this.travel = null; return this.run.target(); }
    const o = this.goal(); this.travel = o && !this.p.roof ? travelPlan(this, o[0], o[1]) : null;
    return this.travel ? [this.travel.from.x, this.travel.from.y] : o;
  }
  /** the free-roam goal itself: your pin, an empire alert, the next giver, a street event, a contract */
  goal(): [number, number] | null {
    if (this.waypoint && dist(this.waypoint[0], this.waypoint[1], this.p.x, this.p.y) < 110) { this.waypoint = null; this.fx.push({ t: 'arrive' }); }
    if (this.waypoint) return this.waypoint;
    const er = empireTarget(this); if (er) return er;
    // with Assist on, point at the next job's giver in story order (even when they are close: the line ends at them),
    // and only then at a street event
    if (this.assist && !this.p.roof) { const g = this.nextGiver(); if (g) return g; }
    const ev = eventTarget(this); if (ev && this.assist) return ev;
    // the story's jobs all done for now: a contract's giver (the pinned one, else the nearest; lib/jade-contracts.ts)
    if (this.assist && !this.p.roof && !offered(this.s).length) { const c = contractTarget(this); if (c) return c; }
    return null;
  }
  /** the job to do next: the story's next offered job, else the first Hawker Tale on offer */
  nextJob(): Mission | null { return offered(this.s).find(m => !!this.c.places[m.at]) ?? null; }
  /** where its giver stands (beside the gates when the job is at a station) */
  nextGiver(): [number, number] | null {
    const m = this.nextJob(); if (!m) return null;
    const pl = this.c.places[m.at], g = m.at.startsWith('stn-') ? this.cast.find(c => c.id === m.giver) : null;
    return g ? [g.x, g.y] : [pl.x, pl.y];
  }
  updateRoute() {
    const o = this.objective(); if (!o) { this.route = []; return; }
    const cls = this.p.ride ? VEHICLES[this.p.ride.kind].cls : 'foot';
    if (cls === 'fly' || this.p.roof) { this.route = [[this.p.x, this.p.y], o]; return; }
    const f = this.fieldTo(cls as 'foot', o[0], o[1]);
    this.route = pathFrom(this.c, f, this.p.x, this.p.y, this.open);
    if (!this.route.length) { const g = this.fieldTo('foot', o[0], o[1]); this.route = pathFrom(this.c, g, this.p.x, this.p.y, this.open); }
  }

  // ── crows swooping for cargo
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
          this.fx.push({ t: 'caw' }); this.say('Caw! A crow is after your cargo. Outrun it, or dash and boost to dodge!', 'bad');
        }
      }
    }
    for (const m of this.snatchers) {
      m.t += dt; m.wing += dt * 9; if (m.dizzy) m.dizzy = Math.max(0, m.dizzy - dt);
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
          if (have.length) { const g = have[0]; const k = Math.min(2, this.s.cargo[g]); this.s.cargo[g] -= k; m.took = k; m.good = g; this.say(`The crow snatched ${k} ${GOOD[g].name.toLowerCase()}!`, 'bad'); this.fx.push({ t: 'snatch', x: m.x, y: m.y }); }
          m.out = true;
        } else if (d < 60 && dodging) { m.out = true; this.say('Dodged! The crow flaps off empty-clawed.', 'good'); this.fx.push({ t: 'dodge', x: m.x, y: m.y }); }
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
  /** businesses: buy a stake, upgrade, and empty the tills (one stall, or all of them at a safe house) */
  buyBiz(id: BizId): string | null { const r = buyBiz(this.s, id, [...this.open]); if (!r) { if (!this.p.ride) this.p.act = { n: 'deal', t: 0, dur: 0.9 }; this.fx.push({ t: 'biz-buy', name: BIZ_OF[id].name }); } return r; }
  upgradeBiz(id: BizId): string | null { const r = upgradeBiz(this.s, id); if (!r) { if (!this.p.ride) this.p.act = { n: 'mend', t: 0, dur: 1 }; this.fx.push({ t: 'biz-up', name: BIZ_OF[id].name, k: this.s.biz[id].lvl }); } return r; }
  collectBiz(id?: BizId): number { const n = collect(this.s, id); if (n > 0) { if (!this.p.ride) this.p.act = n >= 200 ? { n: 'count', t: 0, dur: 1.4 } : { n: 'collect', t: 0, dur: 0.9 }; this.fx.push({ t: 'coins', x: this.p.x, y: this.p.y, k: n }); } return n; }
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
import { eventsStep, eventNear, eventAct, eventTarget, type StreetEvent } from './jade-events.js';
import { phoneStep, nightTip } from './jade-phone.js';
import { tutorStep, newTutor, settleLessons, type TutorState } from './jade-tutor.js';
import { rainAt } from './jade-weather.js';
import { medalOf, MEDAL_NAME } from './jade-medals.js';
import { closedTiles } from './jade-setpiece.js';
import { noise, noiseStep, type Noise } from './jade-aware.js';
import { palStep, newPal, type PalState } from './jade-pal.js';
import { mateStep, switchHero, leash, seat, board, leaveSeat, newAI, type MateAI } from './jade-duo.js';
import { tag, distractStep, matePounceHit } from './jade-tag.js';
import { teamGates } from './jade-team.js';
import { stallPos, stallOpen, gearStep, fire, startReload, switchSlot, shooterFor, makeCrates, giveGadget, GEAR_GIFT, GADGETS, type Shot, type Splat, type Crate } from './jade-gear.js';
const P2_KINDS: Near['kind'][] = ['ride', 'exit', 'ladder-up', 'ladder-down', 'hide', 'unhide', 'leap', 'event'];
import { BIZ, BIZ_OF, bizPos, accrue, closeNight, raidId, raidMission, buyBiz, upgradeBiz, collect, type BizId } from './jade-biz.js';
import { EMPIRE_JOB } from './jade-empjobs.js';
import { empireStep, empireClock, empireNight, empireNear, empireAct, empireTarget, empireJobDone, raidJobWon, missRaid, bizLabel, newEmp, type EmpState } from './jade-empire.js';
import { text } from './jade-phone.js';
import { contractNear, contractAct, contractDone, contractNight, contractTarget } from './jade-contracts.js';
void cargoValue; void H; void F_ALLEY; void moveStep; void shove;

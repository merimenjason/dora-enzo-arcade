// Combo Ball: the rules. Dora, Enzo and Pip play three-a-side (plus keepers) against the Grumbles on a village pitch
// with boards all round, and a goal isn't worth one: it's worth chips × mult from the passing move that made it. Every
// completed pass adds chips, one-touch passes add mult, and the shot cashes the chain in. A Grumble touching the ball
// wipes it, and the longer the chain runs the harder they press. Each match has a points target and a 90-second clock;
// between matches the transfer shop sells traits that bend the scoring rules.
// Deterministic at 60 ticks a second from a seed, with no DOM: the page draws it, the tests and bots drive it directly.

export const DT = 1 / 60;
export const W = 384, H = 216;
/** the grass inside the boards; we attack right */
export const PITCH = { x0: 22, y0: 30, x1: 362, y1: 200 };
export const CX = (PITCH.x0 + PITCH.x1) / 2, CY = (PITCH.y0 + PITCH.y1) / 2;
/** half the goal mouth, and the crossbar's height */
export const GOAL = 22, BAR = 12;
/** the penalty box: how deep and half how tall */
export const BOX = { d: 54, h: 48 };
export const MATCH_SECS = 90;
export const MATCHES = 9;
export const SLOTS = 5;
export const R = 5;
const REACH = 7, GRAV = 320;
/** the points targets, match by match */
export const TARGETS = [100, 160, 240, 340, 470, 630, 830, 1080, 1400];
export const LEAGUES = [
  { name: 'Pebble League', text: 'The village green. The Grumbles are slow and only one of them presses.' },
  { name: 'Meadow League', text: 'Two Grumbles press now, and they pass to each other.' },
  { name: 'Summit League', text: 'The best Grumbles on the mountain: quick, sharp, and a keeper who dives early.' },
];
export const TEAMS = ['Dustbunny Rovers', 'Fluffington Town', 'Lint Athletic', 'Burr Wanderers', 'Thistle United', 'Static FC', 'Tumbleweed City', 'Hairball Harriers', 'Grand Grumble XI'];

export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;

// ---------------------------------------------------------------- traits
export const TRAITS = [
  { id: 'metronome', name: 'Metronome', text: 'Every 5th pass in a chain doubles the chips so far.' },
  { id: 'routeone', name: 'Route One', text: 'Long passes give +2 mult instead of +10 chips.' },
  { id: 'ricochet', name: 'Ricochet', text: 'The ball bouncing off a Grumble counts as a pass (+10 chips) and doesn’t wipe the chain.' },
  { id: 'backpass', name: 'Backpass Bandit', text: 'Passes backwards give +1 mult.' },
  { id: 'crossfield', name: 'Crossfield', text: 'Switches of play (a pass right across the pitch) give +1 mult.' },
  { id: 'volley', name: 'Volley', text: 'A first-time shot from a lofted pass scores double.' },
  { id: 'hotstreak', name: 'Hot Streak', text: 'Each goal this match adds +1 mult to every goal after it.' },
  { id: 'coolhead', name: 'Cool Head', text: 'The Grumbles’ pressing builds up half as fast.' },
  { id: 'longrange', name: 'Long Range', text: 'Goals from outside the box get +3 mult.' },
  { id: 'tiki', name: 'Tiki-Taka', text: 'One-touch passes give +2 mult, but other passes add no chips.' },
  { id: 'nutmeg', name: 'Nutmeg', text: 'Dribbling right past a Grumble adds +5 chips.' },
  { id: 'piggy', name: 'Piggy Bank', text: 'After a goal, half the chips carry into the next chain.' },
  { id: 'lateshow', name: 'Late Show', text: 'Goals in the last 20 seconds score double.' },
  { id: 'backheel', name: 'Backheel', text: 'Enzo’s one-touch passes backwards give +2 mult.' },
] as const;
export type TraitId = (typeof TRAITS)[number]['id'];
export const trait = (id: TraitId) => TRAITS.find((t) => t.id === id)!;

// ---------------------------------------------------------------- players and the ball
export type Who = 'dora' | 'enzo' | 'pip' | 'keeper' | 'grumble' | 'gkeeper';
export type Player = {
  i: number; team: 0 | 1; who: Who; keeper: boolean;
  x: number; y: number; vx: number; vy: number; face: 1 | -1;
  /** seconds on the ball, and seconds before this player can touch it again */ hold: number; noTouch: number;
  /** animation: seconds since the last kick */ kick: number;
  slide: number; sdx: number; sdy: number; stun: number;
  /** a Grumble's tackle: winding up, then lunging, then a cool-down */ wind: number; lunge: number; ldx: number; ldy: number; cd: number;
  dive: number; react: number; hx: number; hy: number;
};
export type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number; owner: number; last: number; kick: number };
export type Pass = { from: number; to: number; team: 0 | 1; x: number; y: number; hold: number; lofted: boolean; keeper: boolean; kick: number };
export type Shot = { by: number; x: number; oneTouch: boolean; volley: boolean; power: number };
export type Gain = { text: string; chips?: number; mult?: number; times?: number };
export type Chain = { chips: number; mult: number; passes: number; lastFrom: number; lastTo: number; lofted: boolean; touches: { x: number; y: number }[]; nutmegged: number[] };
export type Input = { ax: number; ay: number; pass: boolean; shoot: boolean; swap?: boolean; click?: { x: number; y: number } | null };
export type Phase = 'play' | 'shop' | 'won' | 'lost';
export type Ev =
  | { k: 'kick' | 'whistle' | 'post' | 'steal' | 'wind' | 'slide' | 'tackle' | 'concede' | 'target' | 'full' | 'bounce' | 'deflect'; x: number; y: number }
  | { k: 'shot'; x: number; y: number; power: number }
  | { k: 'save'; x: number; y: number; team: 0 | 1 }
  | { k: 'gain'; x: number; y: number; gains: Gain[]; chips: number; mult: number }
  | { k: 'wipe'; x: number; y: number; chips: number }
  | { k: 'goal'; x: number; y: number; pts: number; chips: number; mult: number; notes: string[] };

const newChain = (): Chain => ({ chips: 0, mult: 1, passes: 0, lastFrom: -1, lastTo: -1, lofted: false, touches: [], nutmegged: [] });
const blank = (i: number, team: 0 | 1, who: Who, x: number, y: number): Player => ({
  i, team, who, keeper: who === 'keeper' || who === 'gkeeper', x, y, vx: 0, vy: 0, face: team ? -1 : 1, hold: 0, noTouch: 0, kick: 9,
  slide: 0, sdx: 0, sdy: 0, stun: 0, wind: 0, lunge: 0, ldx: 0, ldy: 0, cd: 0, dive: 0, react: 0, hx: x, hy: y,
});

/** how far a ground pass rolls before it stops, from a starting speed (the same friction as the ball) */
export function rollDist(v0: number) {
  let v = v0, d = 0;
  while (v > 0) { d += v * DT; v -= (55 + 0.55 * v) * DT; }
  return d;
}
/** the starting speed that rolls a ground pass d pixels and a bit more, so it arrives with some pace */
export function passSpeed(d: number) {
  let lo = 40, hi = 300;
  for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (rollDist(m) < d + 50) lo = m; else hi = m; }
  return clamp(hi, 160, 270);
}
/** the Grumbles of one match: speed, how many press, how long a tackle winds up, how keen they are to pass and shoot */
export function team(m: number) {
  return {
    name: TEAMS[m] ?? TEAMS[TEAMS.length - 1], speed: 46 + 2 * m, press: m < 3 ? 1 : 2, wind: Math.max(0.17, 0.34 - 0.017 * m),
    pass: 0.25 + 0.06 * m, range: 92 + 4 * m, keeper: 84 + 7 * m, shot: 200 + 9 * m,
  };
}

export class Run {
  seed: number; rs: number;
  phase: Phase = 'play';
  match = 0;
  clock = MATCH_SECS;
  points = 0;
  target = TARGETS[0];
  goals = 0; conceded = 0;
  traits: TraitId[] = [];
  offer: TraitId[] = [];
  chain = newChain();
  pass: Pass | null = null;
  shot: Shot | null = null;
  players: Player[] = [];
  ball: Ball = { x: CX, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1, kick: 0 };
  /** whose ball it is: 0 us, 1 the Grumbles, -1 nobody's yet */
  poss: -1 | 0 | 1 = -1;
  /** the player the person controls */
  ctl = 0;
  /** the match stops for a moment at kick-off and after goals; then whoever kicks off next */
  pause = 0; next: 0 | 1 | null = null;
  /** how many more ticks the page should play at half speed (after a goal) */
  slow = 0;
  lastGoal: { pts: number; chips: number; mult: number; notes: string[] } | null = null;
  /** the match has finished (won or lost) and is waiting to move on */
  over: '' | 'won' | 'lost' = '';
  t = 0;
  events: Ev[] = [];
  prev = { pass: false, shoot: false, swap: false };
  held = { pass: 0, shoot: 0 };
  /** a pass or shot pressed just before the ball arrives, played first time when it does */
  queue: { k: 'pass' | 'shot'; ax: number; ay: number; lofted: boolean; power: number; ttl: number } | null = null;
  stats = { goals: 0, passes: 0, best: 0, longest: 0, conceded: 0, won: 0, points: 0, time: 0 };
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1; this.rs = this.seed;
    this.startMatch();
  }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  has(id: TraitId) { return this.traits.includes(id); }
  get league() { return LEAGUES[Math.min(2, Math.floor(this.match / 3))]; }
  get foe() { return team(this.match); }
  /** how hard the Grumbles press right now, from 1 up */
  get pressure() { return 1 + Math.min(0.32, (this.has('coolhead') ? 0.025 : 0.05) * this.chain.passes); }
  get carrier() { return this.ball.owner >= 0 ? this.players[this.ball.owner] : null; }

  startMatch() {
    this.phase = 'play'; this.over = ''; this.clock = MATCH_SECS; this.points = 0; this.goals = 0; this.conceded = 0;
    this.target = TARGETS[this.match]; this.chain = newChain(); this.lastGoal = null;
    this.players = [
      blank(0, 0, 'dora', CX - 8, CY), blank(1, 0, 'enzo', CX - 60, CY - 42), blank(2, 0, 'pip', CX - 60, CY + 42), blank(3, 0, 'keeper', PITCH.x0 + 7, CY),
      blank(4, 1, 'grumble', CX + 46, CY - 34), blank(5, 1, 'grumble', CX + 46, CY + 34), blank(6, 1, 'grumble', CX + 80, CY), blank(7, 1, 'gkeeper', PITCH.x1 - 7, CY),
    ];
    this.kickoff(0);
  }
  /** everyone back to their places; the side kicking off has the ball in the centre circle */
  kickoff(side: 0 | 1) {
    const spots: [number, number][] = side === 0
      ? [[CX - 7, CY], [CX - 58, CY - 44], [CX - 58, CY + 44], [PITCH.x0 + 7, CY], [CX + 40, CY - 36], [CX + 40, CY + 36], [CX + 78, CY], [PITCH.x1 - 7, CY]]
      : [[CX - 40, CY - 8], [CX - 66, CY - 46], [CX - 66, CY + 46], [PITCH.x0 + 7, CY], [CX + 7, CY], [CX + 50, CY - 44], [CX + 52, CY + 44], [PITCH.x1 - 7, CY]];
    this.players.forEach((p, k) => Object.assign(p, { x: spots[k][0], y: spots[k][1], vx: 0, vy: 0, hold: 0, noTouch: 0, slide: 0, stun: 0, wind: 0, lunge: 0, cd: 0.6, dive: 0, face: p.team ? -1 : 1 }));
    const taker = side === 0 ? 0 : 4;
    Object.assign(this.ball, { x: this.players[taker].x + (side ? -5 : 5), y: CY + 1, z: 0, vx: 0, vy: 0, vz: 0, owner: taker, last: taker });
    this.poss = side; this.pass = null; this.shot = null; this.ctl = 0;
    if (side === 0) this.ctl = 0;
    this.pause = 0.8; this.next = null;
    this.events.push({ k: 'whistle', x: CX, y: CY });
  }

  // ---------------------------------------------------------------- the tick
  tick(inp: Input) {
    this.events = [];
    if (this.phase !== 'play' || this.over) { this.prev = { pass: inp.pass, shoot: inp.shoot, swap: !!inp.swap }; return; }
    if (this.slow > 0) this.slow--;
    if (this.pause > 0) {
      this.pause -= DT;
      if (this.pause <= 0) {
        if (this.points >= this.target) return this.endMatch(true);
        if (this.next !== null) this.kickoff(this.next);
      }
      this.prev = { pass: inp.pass, shoot: inp.shoot, swap: !!inp.swap };
      // the pass and shoot buttons start fresh after a stop
      this.held = { pass: 0, shoot: 0 };
      return;
    }
    this.t += DT; this.stats.time += DT;
    this.clock -= DT;
    if (this.clock <= 0) { this.clock = 0; this.events.push({ k: 'full', x: CX, y: CY }); return this.endMatch(this.points >= this.target); }
    for (const p of this.players) { p.noTouch = Math.max(0, p.noTouch - DT); p.kick += DT; p.stun = Math.max(0, p.stun - DT); p.cd = Math.max(0, p.cd - DT); if (this.ball.owner === p.i) p.hold += DT; }
    this.control(inp);
    this.human(inp);
    for (const p of this.players) if (p.i !== this.ctl || p.team) this.ai(p);
    this.move();
    this.ballStep();
    this.prev = { pass: inp.pass, shoot: inp.shoot, swap: !!inp.swap };
  }

  /** who the person is playing: the carrier when we have it, the pass's target while it travels, else whoever's nearest the ball */
  control(inp: Input) {
    const b = this.ball, c = this.carrier;
    if (c && c.team === 0 && !c.keeper) { this.ctl = c.i; return; }
    if (this.pass && this.pass.team === 0 && b.owner < 0) { this.ctl = this.pass.to; return; }
    const outs = this.players.filter((p) => p.team === 0 && !p.keeper);
    const d = (p: Player) => hyp(p.x - b.x, p.y - b.y);
    const cur = this.players[this.ctl];
    if (cur.slide > 0) return;
    const near = outs.slice().sort((p, q) => d(p) - d(q));
    if (inp.swap && !this.prev.swap) { this.ctl = near[0].i === this.ctl ? near[1].i : near[0].i; return; }
    if (cur.keeper || cur.team || d(near[0]) < d(cur) - 14) this.ctl = near[0].i;
  }

  /** the person's player: running, passing (tap: along the ground; hold: lofted), shooting, sliding in */
  human(inp: Input) {
    const p = this.players[this.ctl], b = this.ball;
    const mine = b.owner === p.i;
    if (inp.pass) this.held.pass += DT;
    if (inp.shoot) this.held.shoot += DT;
    let ax = inp.ax, ay = inp.ay; const l = hyp(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    // with nothing pressed, a pass's target runs onto the ball by itself
    if (l < 0.2 && this.pass && this.pass.to === p.i && b.owner < 0) {
      const lead = Math.min(0.6, hyp(p.x - b.x, p.y - b.y) / 140);
      const tx = b.x + b.vx * lead - p.x, ty = b.y + b.vy * lead - p.y, tl = hyp(tx, ty);
      if (tl > 3) { ax = tx / tl; ay = ty / tl; }
    }
    if (p.slide > 0) { p.slide -= DT; if (p.slide <= 0) p.stun = 0.3; }
    else if (p.stun <= 0) {
      const sp = mine ? 58 : 64;
      p.vx = ax * sp; p.vy = ay * sp;
    } else { p.vx *= 0.8; p.vy *= 0.8; }
    const aim = l > 0.3 ? [inp.ax, inp.ay] : [p.face, 0];
    const passed = !inp.pass && this.prev.pass && this.held.pass > 0, shot = !inp.shoot && this.prev.shoot && this.held.shoot > 0;
    if (this.queue) { this.queue.ttl -= DT; if (this.queue.ttl <= 0) this.queue = null; }
    if (mine) {
      const q = this.queue; this.queue = null;
      if (inp.click) { this.kickPass(p, inp.click.x - p.x, inp.click.y - p.y, false); }
      else if (passed) this.kickPass(p, aim[0], aim[1], this.held.pass >= 0.2);
      else if (shot) this.kickShot(p, Math.min(1, this.held.shoot / 0.6), inp.ay);
      else if (q?.k === 'pass') this.kickPass(p, q.ax, q.ay, q.lofted);
      else if (q?.k === 'shot') this.kickShot(p, q.power, q.ay);
    } else if (this.pass && this.pass.to === p.i && b.owner < 0 && (passed || shot || inp.click)) {
      // pressed while the ball's on its way: it goes first time the moment it arrives
      if (inp.click) this.queue = { k: 'pass', ax: inp.click.x - p.x, ay: inp.click.y - p.y, lofted: false, power: 0, ttl: 0.6 };
      else this.queue = passed ? { k: 'pass', ax: aim[0], ay: aim[1], lofted: this.held.pass >= 0.2, power: 0, ttl: 0.6 } : { k: 'shot', ax: 0, ay: inp.ay, lofted: false, power: Math.min(1, this.held.shoot / 0.6), ttl: 0.6 };
    } else if (inp.shoot && !this.prev.shoot && p.slide <= 0 && p.stun <= 0 && this.poss !== 0) {
      // a slide tackle, the way the stick points (or at the ball)
      let dx = ax, dy = ay; if (hyp(dx, dy) < 0.3) { dx = b.x - p.x; dy = b.y - p.y; }
      const dl = hyp(dx, dy) || 1; p.sdx = dx / dl; p.sdy = dy / dl; p.slide = 0.3; p.vx = p.sdx * 150; p.vy = p.sdy * 150;
      this.events.push({ k: 'slide', x: p.x, y: p.y });
    }
    // a slide that reaches a Grumble's ball knocks it loose
    if (p.slide > 0 && b.owner >= 0 && this.players[b.owner].team === 1 && !this.players[b.owner].keeper && hyp(p.x - b.x, p.y - b.y) < 9) {
      const g = this.players[b.owner]; g.stun = 0.6; g.wind = 0; g.lunge = 0;
      b.owner = -1; b.vx = p.sdx * 95; b.vy = p.sdy * 95; b.last = p.i; p.noTouch = 0.12; this.poss = -1;
      this.events.push({ k: 'tackle', x: b.x, y: b.y });
    }
    if (!inp.pass) this.held.pass = 0;
    if (!inp.shoot) this.held.shoot = 0;
  }

  /** a pass from p towards (ax, ay): to the team-mate best lined up with it, led into his run */
  kickPass(p: Player, ax: number, ay: number, lofted: boolean, keeper = false) {
    const al = hyp(ax, ay) || 1; ax /= al; ay /= al;
    const mates = this.players.filter((q) => q.team === p.team && q.i !== p.i && !q.keeper);
    let best = mates[0], bs = -1e9;
    for (const q of mates) {
      const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1;
      const s = (dx * ax + dy * ay) / d - d / 500;
      if (s > bs) { bs = s; best = q; }
    }
    this.kickTo(p, best, lofted, keeper);
  }
  kickTo(p: Player, q: Player, lofted: boolean, keeper = false) {
    const b = this.ball;
    let d = hyp(q.x - b.x, q.y - b.y);
    const v0 = lofted ? 130 + d * 0.35 : passSpeed(d);
    const lead = (d / v0) * 0.8;
    let tx = clamp(q.x + q.vx * lead, PITCH.x0 + 6, PITCH.x1 - 6), ty = clamp(q.y + q.vy * lead, PITCH.y0 + 6, PITCH.y1 - 6);
    d = hyp(tx - b.x, ty - b.y) || 1;
    const v = lofted ? 130 + d * 0.35 : passSpeed(d);
    b.vx = ((tx - b.x) / d) * v; b.vy = ((ty - b.y) / d) * v;
    b.vz = lofted ? GRAV * (d / v) / 2 : 0; b.z = lofted ? 1 : 0;
    b.owner = -1; b.kick++;
    this.pass = { from: p.i, to: q.i, team: p.team, x: p.x, y: p.y, hold: p.hold, lofted, keeper, kick: b.kick };
    p.noTouch = 0.25; p.kick = 0; p.hold = 0; p.face = b.vx >= 0 ? 1 : -1;
    if (p.team === 0 && !keeper) this.chain.touches.push({ x: p.x, y: p.y });
    this.events.push({ k: 'kick', x: p.x, y: p.y });
  }
  /** a shot at the far goal: up or down on the stick picks a corner, otherwise the corner away from the keeper */
  kickShot(p: Player, power: number, ay: number) {
    // aimed a few pixels behind the line, where a goal is counted, so a shot at a corner stays inside the post
    const b = this.ball, right = p.team === 0, gx = right ? PITCH.x1 + 6 : PITCH.x0 - 6;
    const keep = this.players[right ? 7 : 3];
    let gy = ay < -0.3 ? CY - GOAL + 5 : ay > 0.3 ? CY + GOAL - 5 : keep.y < CY ? CY + GOAL - 5 : CY - GOAL + 5;
    const d = hyp(gx - b.x, gy - b.y);
    const oneTouch = p.hold < 0.5;
    gy += (this.rnd() * 2 - 1) * (1.5 + d * 0.025 + power * 3) * (oneTouch ? 0.6 : 1);
    const v = (right ? 240 : this.foe.shot) + power * 140;
    const dl = hyp(gx - b.x, gy - b.y) || 1;
    b.vx = ((gx - b.x) / dl) * v; b.vy = ((gy - b.y) / dl) * v; b.vz = 22 + power * 50 + d * 0.07; b.z = 1;
    b.owner = -1; b.kick++;
    this.pass = null;
    if (p.team === 0) this.shot = { by: p.i, x: p.x, oneTouch, volley: oneTouch && this.chain.lofted, power };
    else this.shot = null;
    p.noTouch = 0.3; p.kick = 0; p.hold = 0;
    this.events.push({ k: 'shot', x: p.x, y: p.y, power });
  }

  // ---------------------------------------------------------------- the computer players
  ai(p: Player) {
    const b = this.ball, f = this.foe;
    if (p.stun > 0 || p.slide > 0) { if (p.slide > 0) { p.slide -= DT; if (p.slide <= 0) p.stun = 0.3; } p.vx *= 0.85; p.vy *= 0.85; return; }
    if (p.keeper) return this.keeper(p);
    const speed = p.team ? f.speed * (this.poss === 0 ? this.pressure : 1) : 62;
    let tx = p.x, ty = p.y, run = 1;
    const ours = this.players.filter((q) => q.team === p.team && !q.keeper && q.i !== p.i);
    const theirs = this.players.filter((q) => q.team !== p.team && !q.keeper);
    // whoever has the ball, or whoever a pass is on its way to
    const holder = b.owner >= 0 ? this.players[b.owner] : this.pass ? this.players[this.pass.to] : null;
    const nearestTo = (x: number, y: number, list: Player[]) => list.slice().sort((a, c) => hyp(a.x - x, a.y - y) - hyp(c.x - x, c.y - y))[0];
    if (b.owner === p.i) {
      // a Grumble on the ball: run at goal, pass when pressed, shoot in range
      const gx = PITCH.x0, opp = nearestTo(p.x, p.y, theirs), od = opp ? hyp(opp.x - p.x, opp.y - p.y) : 999;
      tx = gx; ty = CY + (p.y - CY) * 0.5;
      if (opp && od < 30) { ty += (p.y > opp.y ? 1 : -1) * 30; }
      if (p.x - gx < f.range && p.hold > 0.25) return this.kickShot(p, 0.4 + this.rnd() * 0.5, 0);
      if ((od < 18 && p.hold > 0.3) || p.hold > 2.6) {
        if (this.rnd() < f.pass * DT * 30 || p.hold > 2.6) {
          const open = ours.slice().sort((a, c) => this.openness(c) - this.openness(a))[0];
          if (open) return this.kickTo(p, open, false);
        }
      }
      run = 0.9;
    } else if (this.poss === (p.team === 0 ? 1 : 0) && holder && holder.team !== p.team) {
      // they have it (or it's on its way between them): press, or mark
      const car = holder;
      const chasers = this.players.filter((q) => q.team === p.team && !q.keeper && (p.team === 1 || q.i !== this.ctl)).sort((a, c) => hyp(a.x - car.x, a.y - car.y) - hyp(c.x - car.x, c.y - car.y));
      const rank = chasers.indexOf(p);
      const press = p.team === 1 ? f.press : 0;
      if (rank < press && !car.keeper) {
        if (rank === 0) {
          if (b.owner === car.i) return this.tackle(p, car, speed);
          const lead = Math.min(0.5, hyp(p.x - b.x, p.y - b.y) / 160); tx = b.x + b.vx * lead; ty = b.y + b.vy * lead;
          return this.steer(p, tx, ty, speed);
        }
        // the second presser cuts the nearest passing lane
        const mate = nearestTo(car.x, car.y, this.players.filter((q) => q.team === car.team && !q.keeper && q.i !== car.i));
        if (mate) { tx = car.x + (mate.x - car.x) * 0.45; ty = car.y + (mate.y - car.y) * 0.45; }
      } else {
        // mark the nearest free attacker, standing goal-side and towards the ball
        const marks = this.players.filter((q) => q.team !== p.team && !q.keeper && q.i !== car.i);
        const m = nearestTo(p.x, p.y, marks.length ? marks : [car]);
        const goalX = p.team === 1 ? PITCH.x1 : PITCH.x0;
        // a step off him, between him and their own goal, leaning towards the ball
        let ux = (goalX - m.x) * 0.6 + (car.x - m.x) * 0.4, uy = (CY - m.y) * 0.6 + (car.y - m.y) * 0.4; const ul = hyp(ux, uy) || 1;
        const gap = p.team === 1 ? 15 : 12;
        tx = m.x + (ux / ul) * gap; ty = m.y + (uy / ul) * gap;
        if (p.team === 0) {
          run = 0.85;
          // our markers poke the ball away from a Grumble who dribbles right into them
          if (hyp(car.x - p.x, car.y - p.y) < 8 && this.rnd() < 1.2 * DT) {
            car.stun = 0.5; b.owner = -1; b.vx = (car.x - p.x) * -6; b.vy = (this.rnd() - 0.5) * 80; b.last = p.i; this.poss = -1;
            this.events.push({ k: 'tackle', x: b.x, y: b.y });
          }
        }
      }
    } else if (holder && holder.team === p.team && !(this.pass && this.pass.to === p.i)) {
      // our side has it: give the carrier (or whoever the pass is going to) options
      const car = holder;
      const dir = p.team === 0 ? 1 : -1;
      // a triangle that moves with the ball: one runs ahead on the far side (the switch), one comes alongside
      // nearer the ball (the safe one); each takes whichever slot is nearer
      const away = car.y < CY ? 1 : -1;
      const slots: [number, number][] = [
        [clamp(car.x + dir * 70, PITCH.x0 + 40, PITCH.x1 - 34), CY + away * 40],
        [clamp(car.x + dir * 18, PITCH.x0 + 30, PITCH.x1 - 50), clamp(car.y + away * 44, PITCH.y0 + 14, PITCH.y1 - 14)],
      ];
      const other = ours.find((q) => q.i !== car.i);
      const cost = (q: Player, k: number) => hyp(q.x - slots[k][0], q.y - slots[k][1]);
      const mine = !other || cost(p, 0) + cost(other, 1) <= cost(p, 1) + cost(other, 0) ? 0 : 1;
      [tx, ty] = slots[mine];
      if (car.keeper) { tx = (p.team === 0 ? PITCH.x0 + 70 : PITCH.x1 - 70); ty = CY + (p.i % 2 ? -45 : 45); }
      // drift away from the nearest marker to open a lane
      const opp = nearestTo(p.x, p.y, theirs);
      if (opp) { const dx = p.x - opp.x, dy = p.y - opp.y, d = hyp(dx, dy); if (d < 34) { tx += (dx / (d || 1)) * 22; ty += (dy / (d || 1)) * 22; } }
      run = 0.85;
    } else {
      // a loose ball: the nearest of each side goes for it, the rest hold their shape
      const pass = this.pass;
      if (pass && pass.to === p.i) { const lead = Math.min(0.6, hyp(p.x - b.x, p.y - b.y) / 140); tx = b.x + b.vx * lead; ty = b.y + b.vy * lead; }
      else {
        const side = this.players.filter((q) => q.team === p.team && !q.keeper && (p.team === 1 || q.i !== this.ctl));
        const first = nearestTo(b.x, b.y, side);
        const intercept = p.team === 1 && pass && pass.team === 0 && b.z < 6 && this.laneDist(p) < 14;
        if (first === p || intercept) { const lead = Math.min(0.5, hyp(p.x - b.x, p.y - b.y) / 160); tx = b.x + b.vx * lead; ty = b.y + b.vy * lead; }
        else { tx = p.hx; ty = p.hy; run = 0.7; }
      }
    }
    this.steer(p, tx, ty, speed * run);
  }
  /** how far a player stands from the current pass's line (for Grumbles stepping into it) */
  laneDist(p: Player) {
    const b = this.ball, sp = hyp(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    const dx = p.x - b.x, dy = p.y - b.y, along = dx * ux + dy * uy;
    if (along < 0) return 999;
    return Math.abs(dx * uy - dy * ux);
  }
  /** how much room a player has: the distance to the nearest opponent */
  openness(p: Player) {
    let d = 999;
    for (const q of this.players) if (q.team !== p.team && !q.keeper) d = Math.min(d, hyp(q.x - p.x, q.y - p.y));
    return d;
  }
  steer(p: Player, tx: number, ty: number, speed: number) {
    const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
    const k = d < 3 ? 0 : Math.min(1, d / 10);
    const vx = d ? (dx / d) * speed * k : 0, vy = d ? (dy / d) * speed * k : 0;
    p.vx += (vx - p.vx) * 0.25; p.vy += (vy - p.vy) * 0.25;
  }
  /** a Grumble closing down the carrier: near enough, he winds up (and flashes), then lunges for the ball */
  tackle(p: Player, car: Player, speed: number) {
    const b = this.ball;
    if (p.lunge > 0) {
      p.lunge -= DT; p.vx = p.ldx * 150; p.vy = p.ldy * 150;
      if (hyp(p.x - b.x, p.y - b.y) < REACH && b.owner === car.i) {
        b.owner = p.i; b.last = p.i; p.hold = 0; this.changePoss(p);
        car.stun = 0.35; this.events.push({ k: 'steal', x: p.x, y: p.y });
      }
      if (p.lunge <= 0) { p.cd = 0.9; p.stun = 0.25; }
      return;
    }
    if (p.wind > 0) {
      p.wind -= DT; p.vx *= 0.7; p.vy *= 0.7;
      if (p.wind <= 0) { const dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy) || 1; p.ldx = dx / d; p.ldy = dy / d; p.lunge = 0.2; }
      return;
    }
    const d = hyp(car.x - p.x, car.y - p.y);
    if (d < 16 && p.cd <= 0) { p.wind = this.foe.wind; this.events.push({ k: 'wind', x: p.x, y: p.y }); return; }
    this.steer(p, b.x, b.y, speed);
  }
  keeper(p: Player) {
    const b = this.ball, left = p.team === 0, gx = left ? PITCH.x0 : PITCH.x1;
    // a long passing move leaves the Grumble keeper chasing shadows: slower to react and slower across the goal
    const dizzy = left || this.poss !== 0 ? 0 : Math.min(this.chain.passes, 6);
    const reachSpeed = left ? 105 : this.foe.keeper * (1 - 0.07 * dizzy);
    if (b.owner === p.i) {
      p.vx = 0; p.vy = 0;
      if (p.hold > 0.7) {
        const mates = this.players.filter((q) => q.team === p.team && !q.keeper).sort((a, c) => this.openness(c) - this.openness(a));
        this.kickTo(p, mates[0], false, true);
      }
      return;
    }
    // stand on the line from the goal to the ball; dive at a shot coming in
    let ty = CY + clamp((b.y - CY) * 0.35, -GOAL + 5, GOAL - 5);
    const tx = gx + (left ? 7 : -7);
    const toward = left ? b.vx < -60 : b.vx > 60;
    p.react = toward && b.owner < 0 ? p.react + DT : 0;
    if (toward && b.owner < 0 && p.react > (left ? 0.1 : Math.max(0.05, 0.1 - 0.005 * this.match) + 0.035 * dizzy)) {
      const t = (gx - b.x) / b.vx;
      if (t > 0 && t < 1.1) { const py = b.y + b.vy * t; if (Math.abs(py - CY) < GOAL + 8) { ty = clamp(py, CY - GOAL - 2, CY + GOAL + 2); if (Math.abs(py - p.y) > 6) p.dive = 0.3; } }
    }
    p.dive = Math.max(0, p.dive - DT);
    const dy = ty - p.y, dx = tx - p.x;
    p.vy = clamp(dy * 8, -reachSpeed, reachSpeed); p.vx = clamp(dx * 6, -40, 40);
  }

  move() {
    const ps = this.players;
    for (const p of ps) {
      p.x += p.vx * DT; p.y += p.vy * DT;
      if (Math.abs(p.vx) > 4) p.face = p.vx > 0 ? 1 : -1;
      if (p.keeper) { const gx = p.team === 0 ? PITCH.x0 : PITCH.x1; p.x = clamp(p.x, Math.min(gx, gx + (p.team ? -20 : 20)), Math.max(gx, gx + (p.team ? -20 : 20))); p.y = clamp(p.y, CY - GOAL - 10, CY + GOAL + 10); }
      else { p.x = clamp(p.x, PITCH.x0 + R, PITCH.x1 - R); p.y = clamp(p.y, PITCH.y0 + R, PITCH.y1 - R); }
    }
    // nobody stands inside anybody else
    for (let a = 0; a < ps.length; a++) for (let c = a + 1; c < ps.length; c++) {
      const p = ps[a], q = ps[c], dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy);
      if (d > 0 && d < R * 1.8) { const push = (R * 1.8 - d) / 2, ux = dx / d, uy = dy / d; p.x -= ux * push; p.y -= uy * push; q.x += ux * push; q.y += uy * push; }
    }
    // nutmegs: going right past a Grumble with the ball
    const c = this.carrier;
    if (c && c.team === 0 && this.has('nutmeg')) for (const g of ps) {
      if (g.team !== 1 || g.keeper || this.chain.nutmegged.includes(g.i)) continue;
      if (Math.abs(g.y - c.y) < 8 && g.x < c.x - 3 && g.x > c.x - 9 && c.vx > 20) {
        this.chain.nutmegged.push(g.i); this.chain.chips += 5;
        this.events.push({ k: 'gain', x: c.x, y: c.y, gains: [{ text: 'Nutmeg', chips: 5 }], chips: this.chain.chips, mult: this.chain.mult });
      }
    }
  }

  // ---------------------------------------------------------------- the ball
  ballStep() {
    const b = this.ball;
    if (b.owner >= 0) {
      const p = this.players[b.owner], sp = hyp(p.vx, p.vy);
      const ux = sp > 5 ? p.vx / sp : p.face, uy = sp > 5 ? p.vy / sp : 0;
      b.x = p.x + ux * 5; b.y = p.y + uy * 4 + 2; b.z = 0; b.vx = p.vx; b.vy = p.vy; b.vz = 0;
      return;
    }
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.z > 0 || b.vz > 0) {
      b.z += b.vz * DT; b.vz -= GRAV * DT;
      if (b.z <= 0) { b.z = 0; if (b.vz < -45) { b.vz = -b.vz * 0.45; this.events.push({ k: 'bounce', x: b.x, y: b.y }); } else b.vz = 0; b.vx *= 0.85; b.vy *= 0.85; }
    } else {
      const sp = hyp(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - (55 + 0.55 * sp) * DT); b.vx *= ns / sp; b.vy *= ns / sp; }
    }
    // the boards along the sides
    if (b.y < PITCH.y0 + 2) { b.y = PITCH.y0 + 2; b.vy = Math.abs(b.vy) * 0.6; }
    if (b.y > PITCH.y1 - 1) { b.y = PITCH.y1 - 1; b.vy = -Math.abs(b.vy) * 0.6; }
    // the ends: a goal, a post, or the boards
    for (const side of [0, 1] as const) {
      const gx = side ? PITCH.x1 : PITCH.x0, past = side ? b.x > gx : b.x < gx;
      if (!past) continue;
      const off = Math.abs(b.y - CY);
      if (off < GOAL - 1 && b.z < BAR) {
        if (side ? b.x > gx + 3 : b.x < gx - 3) return this.goal(side === 1 ? 0 : 1);
        continue;
      }
      if (off < GOAL + 2 && b.z < BAR + 2) this.events.push({ k: 'post', x: gx, y: b.y });
      b.x = gx + (side ? -1 : 1); b.vx = -b.vx * 0.55;
      if (this.shot) this.shot = null;
    }
    this.touch();
  }
  /** someone gets to a loose ball: they take it, or (going too fast) it bounces off them */
  touch() {
    const b = this.ball;
    if (b.z > 7) return;
    const sp = hyp(b.vx, b.vy);
    let best: Player | null = null, bd = 1e9;
    for (const p of this.players) {
      if (p.noTouch > 0 || p.stun > 0.2 && p.slide <= 0) continue;
      const reach = p.keeper ? 6 : p.slide > 0 ? 9 : REACH;
      const d = hyp(p.x - b.x, p.y - b.y);
      if (d < reach && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    // the player a pass is meant for wins a close race for it
    const meant = this.pass && b.kick === this.pass.kick ? this.players[this.pass.to] : null;
    if (meant && meant !== best && meant.noTouch <= 0 && hyp(meant.x - b.x, meant.y - b.y) < REACH + 4) best = meant;
    const p = best;
    // our slide knocks the ball away from a Grumble
    if (p.slide > 0 && p.team === 0) {
      b.vx = p.sdx * 95; b.vy = p.sdy * 95; b.last = p.i; p.noTouch = 0.15;
      this.events.push({ k: 'tackle', x: b.x, y: b.y });
      if (this.poss === 1) { this.poss = -1; }
      return;
    }
    if (p.keeper) {
      const theirs = this.shot && p.team === 1 || (p.team === 0 && b.last >= 0 && this.players[b.last].team === 1);
      if (sp > 240) {
        b.vx = -b.vx * 0.35 + (this.rnd() - 0.5) * 60; b.vy = b.vy * 0.4 + (b.y < p.y ? -70 : 70); b.vz = 30; b.z = Math.max(b.z, 1);
        p.noTouch = 0.35; b.last = p.i; b.kick++;
        this.events.push({ k: 'save', x: p.x, y: p.y, team: p.team });
        this.shot = null; if (p.team === 1) this.wipe(); this.pass = null;
        return;
      }
      if (theirs) this.events.push({ k: 'save', x: p.x, y: p.y, team: p.team });
    } else if (p.team === 1) {
      // a Grumble in the way of a moving ball: a slow one he takes; a firm pass usually beats him, or he only gets a
      // toe to it and it flies off
      if (sp > 110) {
        const touch = Math.max(0.1, 0.45 - (sp - 110) / 300);
        if (this.rnd() > touch) { p.noTouch = 0.3; return; }
      }
      if (sp > 110 && this.rnd() < 0.5) {
        b.vx = -b.vx * 0.35 + (this.rnd() - 0.5) * 70; b.vy = -b.vy * 0.35 + (this.rnd() - 0.5) * 70; b.last = p.i; p.noTouch = 0.3; b.kick++;
        this.events.push({ k: 'deflect', x: b.x, y: b.y });
        if (this.has('ricochet') && this.poss === 0) { this.chain.chips += 10; this.events.push({ k: 'gain', x: b.x, y: b.y, gains: [{ text: 'Ricochet', chips: 10 }], chips: this.chain.chips, mult: this.chain.mult }); }
        else this.wipe();
        return;
      }
    }
    // a clean touch: it's his ball now
    b.owner = p.i; b.last = p.i; p.hold = 0; b.z = 0; b.vz = 0;
    this.received(p);
    this.shot = null;
  }
  changePoss(p: Player) {
    if (p.team === 1 && this.poss !== 1) this.wipe();
    this.poss = p.team; this.pass = null;
  }
  received(p: Player) {
    const pass = this.pass;
    if (p.team === 1) { this.changePoss(p); return; }
    if (this.poss !== 0) { this.poss = 0; this.chain = { ...newChain(), chips: this.chain.chips, mult: 1 }; if (!this.has('piggy')) this.chain.chips = 0; }
    if (p.keeper) { this.chain = newChain(); this.pass = null; return; }
    if (pass && pass.team === 0 && pass.from !== p.i && !pass.keeper) this.completed(pass, p);
    if (pass && pass.keeper) this.chain = newChain();
    this.pass = null;
    this.chain.touches.push({ x: p.x, y: p.y });
  }
  /** a pass that got there: its chips and mult */
  completed(pass: Pass, p: Player) {
    const c = this.chain, gains: Gain[] = [];
    const d = hyp(p.x - pass.x, p.y - pass.y), back = p.x < pass.x - 10;
    const oneTouch = pass.hold < 0.5, ping = c.lastFrom === p.i && c.lastTo === pass.from;
    if (ping) gains.push({ text: 'Straight back: no chips' });
    else {
      if (!this.has('tiki') || oneTouch) gains.push({ text: 'Pass', chips: 10 });
      if (d > 100) gains.push(this.has('routeone') ? { text: 'Long ball', mult: 2 } : { text: 'Long ball', chips: 10 });
      if (pass.lofted) gains.push({ text: 'Lofted', chips: 5 });
      if (Math.abs(p.y - pass.y) > 70) { gains.push({ text: 'Switch', chips: 10 }); if (this.has('crossfield')) gains.push({ text: 'Crossfield', mult: 1 }); }
      if (oneTouch) gains.push({ text: 'One-touch', mult: this.has('tiki') ? 2 : 1 });
      if (back && this.has('backpass')) gains.push({ text: 'Backpass Bandit', mult: 1 });
      if (back && oneTouch && this.has('backheel') && this.players[pass.from].who === 'enzo') gains.push({ text: 'Backheel', mult: 2 });
    }
    for (const g of gains) { c.chips += g.chips ?? 0; c.mult += g.mult ?? 0; }
    c.passes++; c.lastFrom = pass.from; c.lastTo = p.i; c.lofted = pass.lofted;
    if (!ping && this.has('metronome') && c.passes % 5 === 0) { gains.push({ text: 'Metronome', times: 2 }); c.chips *= 2; }
    this.stats.passes++; this.stats.longest = Math.max(this.stats.longest, c.passes);
    this.events.push({ k: 'gain', x: p.x, y: p.y, gains, chips: c.chips, mult: c.mult });
  }
  wipe() {
    if (this.chain.passes || this.chain.chips) this.events.push({ k: 'wipe', x: this.ball.x, y: this.ball.y, chips: this.chain.chips });
    this.chain = newChain();
  }
  /** what a goal is worth: (10 + chips) × mult, and anything the traits add */
  worth() {
    const c = this.chain, s = this.shot, notes: string[] = [];
    let mult = c.mult;
    if (s?.oneTouch && c.passes) { mult += 1; notes.push('First-time +1×'); }
    if (s && this.has('longrange') && s.x < PITCH.x1 - BOX.d) { mult += 3; notes.push('Long Range +3×'); }
    if (this.has('hotstreak') && this.goals) { mult += this.goals; notes.push(`Hot Streak +${this.goals}×`); }
    let pts = (10 + c.chips) * mult;
    if (s?.volley && this.has('volley')) { pts *= 2; notes.push('Volley ×2'); }
    if (this.has('lateshow') && this.clock <= 20) { pts *= 2; notes.push('Late Show ×2'); }
    return { pts: Math.round(pts), chips: 10 + c.chips, mult, notes };
  }
  goal(side: 0 | 1) {
    const b = this.ball;
    if (side === 0) {
      const w = this.worth();
      this.points += w.pts; this.goals++; this.stats.goals++; this.stats.points += w.pts; this.stats.best = Math.max(this.stats.best, w.pts);
      this.lastGoal = { pts: w.pts, chips: w.chips, mult: w.mult, notes: w.notes };
      this.events.push({ k: 'goal', x: b.x, y: b.y, ...w });
      const keep = this.has('piggy') ? Math.floor(this.chain.chips / 2) : 0;
      this.chain = { ...newChain(), chips: keep };
      if (this.points >= this.target) this.events.push({ k: 'target', x: CX, y: CY });
      this.next = 1;
    } else {
      this.conceded++; this.stats.conceded++;
      this.target += Math.round(TARGETS[this.match] * 0.15);
      this.events.push({ k: 'concede', x: b.x, y: b.y });
      this.chain = newChain(); this.next = 0;
    }
    b.owner = -1; b.vx *= 0.2; b.vy *= 0.2; b.vz = 0; this.shot = null; this.pass = null; this.poss = -1;
    this.pause = 1.7; this.slow = 24;
  }
  endMatch(won: boolean) {
    this.ball.owner = -1;
    if (!won) { this.over = 'lost'; this.phase = 'lost'; return; }
    this.stats.won++;
    if (this.match >= MATCHES - 1) { this.over = 'won'; this.phase = 'won'; return; }
    this.over = 'won'; this.phase = 'shop'; this.makeOffer();
  }
  makeOffer() {
    const pool = TRAITS.map((t) => t.id).filter((id) => !this.traits.includes(id));
    this.offer = [];
    while (this.offer.length < 3 && pool.length) this.offer.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
  }
  /** takes a trait from the shop (dropping one when all five slots are full), or none; then the next match */
  pick(id?: TraitId, drop?: TraitId) {
    if (this.phase !== 'shop') return false;
    if (id) {
      if (!this.offer.includes(id)) return false;
      if (this.traits.length >= SLOTS) { if (!drop || !this.traits.includes(drop)) return false; this.traits = this.traits.filter((t) => t !== drop); }
      this.traits.push(id);
    }
    this.offer = []; this.match++;
    this.startMatch();
    return true;
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'combo-ball-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { matches: number; goal: number; chain: number };
  stats: { runs: number; wins: number; goals: number; passes: number };
  settings: { sound: boolean; music: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { matches: 0, goal: 0, chain: 0 }, stats: { runs: 0, wins: 0, goals: 0, passes: 0 }, settings: { sound: true, music: true } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    s.intro = o.intro === true;
    for (const k of ['matches', 'goal', 'chain'] as const) s.best[k] = num(o.best?.[k]);
    for (const k of ['runs', 'wins', 'goals', 'passes'] as const) s.stats[k] = num(o.stats?.[k]);
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** adds a finished run to the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.goals += r.stats.goals; s.stats.passes += r.stats.passes;
  if (r.phase === 'won') s.stats.wins++;
  s.best.matches = Math.max(s.best.matches, r.stats.won);
  s.best.goal = Math.max(s.best.goal, r.stats.best);
  s.best.chain = Math.max(s.best.chain, r.stats.longest);
}

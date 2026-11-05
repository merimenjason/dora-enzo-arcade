// Into Space: the rules. A pixel-art football roguelite about passing into space. Every pass goes to a spot on the
// grass, not to a player: the moment it leaves the boot, control jumps to the teammate best placed to reach the spot,
// and the skill is arriving on it. Get there just as it lands and time slows for a first-time pass or shot; too early
// and the Grumbles close in while you wait; too late and it's a scramble. Dora, Enzo, Pip and Bram play four-a-side
// plus keepers against the Grumbles in a seven-round knockout cup, on pitches that change how the ball behaves.
// Deterministic at 60 ticks a second from a seed, with no DOM: the page draws it, the tests and bots drive it directly.

export const DT = 1 / 60;
export const W = 384, H = 216;
/** the boards round the pitch: the ball bounces off them (it's a walled five-a-side pitch) */
export const PITCH = { x0: 22, y0: 40, x1: 362, y1: 204 };
export const CX = (PITCH.x0 + PITCH.x1) / 2, CY = (PITCH.y0 + PITCH.y1) / 2;
/** the goal mouth, at the left (ours) and right (theirs) ends */
export const GOAL = { y0: CY - 20, y1: CY + 20, depth: 9, bar: 14 };
/** the penalty boxes, in from each end */
export const BOX = { depth: 52, half: 42 };
export const ROUNDS = 7;
export const MATCH = 120, GOLDEN = 30;
export const GRAV = 420;
/** a player can take a ball this close, if it's lower than KNEE */
export const REACH = 7, KNEE = 9;
/** within this of the spot counts as having arrived */
export const ARRIVE = 9;
/** the perfect window, before and after the landing, in seconds (times the pitch's and perks' windows) */
export const EARLY = 0.22, LATE = 0.13;
export const SLOW = 0.5, SLOW_FOR = 0.6, FIRST_FOR = 0.55;
/** seconds an early arrival spends stopping the ball before he can pass or shoot */
export const SETTLE = 0.5;
export const MAX_PASS = 190, MIN_PASS = 16;

export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
/** how far a point is from a segment */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return { d: dist(px, py, ax + dx * t, ay + dy * t), t };
}

// ---------------------------------------------------------------- pitches
export type PitchId = 'dry' | 'wet' | 'sand' | 'hard';
export const PITCHES: Record<PitchId, { name: string; text: string; dec: number; bounce: number; keep: number; run: number; window: number; vend: number }> = {
  dry: { name: 'Summer grass', text: 'A true pitch: the ball rolls and bounces the way you’d expect.', dec: 160, bounce: 0.42, keep: 0.6, run: 1, window: 1, vend: 90 },
  wet: { name: 'Rain', text: 'The ball skids on after it lands, and the perfect window is shorter.', dec: 95, bounce: 0.28, keep: 0.88, run: 0.97, window: 0.8, vend: 100 },
  sand: { name: 'The beach', text: 'The ball dies where it lands and everyone runs slower. A little more time to arrive.', dec: 230, bounce: 0, keep: 0.2, run: 0.9, window: 1.15, vend: 55 },
  hard: { name: 'Heatwave', text: 'Baked hard: lofted balls bounce high and run on.', dec: 140, bounce: 0.66, keep: 0.82, run: 1, window: 0.92, vend: 95 },
};
export type ShapeId = 'high' | 'low' | 'man';
export const SHAPES: Record<ShapeId, { name: string; text: string }> = {
  high: { name: 'High line', text: 'Their defenders push right up. There’s acres of space behind them.' },
  low: { name: 'Low block', text: 'They sit deep and crowd their box. Go wide, and arrive late into the gaps.' },
  man: { name: 'Man-markers', text: 'Each Grumble shadows one of ours. Runs drag them out of the way.' },
};
export const TEAMS = ['Bramble Rovers', 'Puddle Athletic', 'Dune United', 'Dustbowl Town', 'Thistle Wanderers', 'Grumble City', 'The Grumble Grand XI'];
export const ROUND_NAMES = ['Round one', 'Round two', 'Round three', 'Round four', 'Quarter-final', 'Semi-final', 'The Final'];

// ---------------------------------------------------------------- perks
export type PerkId = 'backspin' | 'heavy' | 'wide' | 'carousel' | 'wall' | 'bender' | 'switch' | 'decoy' | 'poacher' | 'sprinter' | 'sweeper' | 'knuckle';
export const PERKS: { id: PerkId; name: string; kind: string; text: string }[] = [
  { id: 'backspin', name: 'Backspin boots', kind: 'Boots', text: 'Lofted passes stop dead where they land.' },
  { id: 'heavy', name: 'Heavy touch', kind: 'Bram', text: 'Bram’s first touch knocks the ball on ahead of him as he runs: lethal behind a high line.' },
  { id: 'wide', name: 'Wide window', kind: 'Tactic', text: 'The perfect window is half as long again.' },
  { id: 'carousel', name: 'Carousel', kind: 'Tactic', text: 'Every perfect arrival in a row makes the next window a little longer.' },
  { id: 'wall', name: 'Wall pass', kind: 'Tactic', text: 'After a perfect arrival, a quick tap of pass lays it straight back into the passer’s run: an instant one-two.' },
  { id: 'bender', name: 'Bender', kind: 'Boots', text: 'Passes curl round the first Grumble in their way.' },
  { id: 'switch', name: 'Switch boots', kind: 'Boots', text: 'Long passes (over 150) fly a third faster.' },
  { id: 'decoy', name: 'Decoy runs', kind: 'Tactic', text: 'While a pass is in the air, a teammate sprints away and drags his marker with him.' },
  { id: 'poacher', name: 'Poacher', kind: 'Pip', text: 'When Pip arrives perfectly in the box, he shoots for the far corner by himself.' },
  { id: 'sprinter', name: 'Sprinter', kind: 'Training', text: 'Twice the sprint.' },
  { id: 'sweeper', name: 'Sweeper keeper', kind: 'Keeper', text: 'Our keeper rushes out to loose balls behind the defence.' },
  { id: 'knuckle', name: 'Knuckleball', kind: 'Boots', text: 'First-time shots wobble in the air, and keepers dive late.' },
];
export type Perks = Partial<Record<PerkId, boolean>>;

// ---------------------------------------------------------------- players
export type Who = 'dora' | 'enzo' | 'pip' | 'bram' | 'keeper' | 'grumble' | 'gkeeper';
export const NAMES: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo', pip: 'Pip', bram: 'Bram', keeper: 'Tuft', grumble: 'Grumble', gkeeper: 'Grumble keeper' };
export const SPEED: Record<Who, number> = { dora: 64, enzo: 62, pip: 69, bram: 56, keeper: 58, grumble: 52, gkeeper: 56 };
export type Player = {
  i: number; side: 0 | 1; who: Who; gk: boolean;
  x: number; y: number; vx: number; vy: number;
  /** facing: the way it last moved */
  dx: number; dy: number;
  stun: number; stamina: number; noTouch: number; kick: number; tackleCd: number;
  /** an early arrival has to stop the ball and settle it before he can play it */
  settle: number;
  /** a keeper's dive: seconds left, and where to */
  dive: number; diveY: number; react: number; hold: number;
  hx: number; hy: number;
};
export type Flight = {
  fx: number; fy: number; tx: number; ty: number; T: number; t: number; loft: boolean; h: number; curve: number;
  /** a ground pass's speed out of the boot and its slowing */
  v0: number; dec: number; d: number;
};
export type Pass = { passer: number; receiver: number; x: number; y: number; land: number; loft: boolean; arr: Record<number, number>; rolled: Set<number> };
export type Rating = 'perfect' | 'early' | 'late';

export type Input = {
  mx: number; my: number;
  /** pass held: the keyboard's charge (the reticle moves out the longer it's held), passing on release */
  pass: boolean;
  loft: boolean;
  /** an exact spot to pass to (the mouse, or a slingshot drag), or null for the keyboard's reticle */
  spot: { x: number; y: number } | null;
  /** pass to the spot right now (a click, or letting go of the slingshot) */
  passNow: boolean;
  /** shoot held: power builds, shooting on release; on defence a press is a tackle */
  shoot: boolean;
  /** where to aim a shot, up and down the goal mouth (the mouse); otherwise up/down on the stick picks a corner */
  aimY?: number | null;
  sprint: boolean;
  /** switch to the next runner while a pass is in the air */
  cycle: boolean;
};
export const noInput = (): Input => ({ mx: 0, my: 0, pass: false, loft: false, spot: null, passNow: false, shoot: false, aimY: null, sprint: false, cycle: false });

export type Ev =
  | { k: 'kick'; x: number; y: number; loft: boolean; who: Who }
  | { k: 'switch'; i: number; who: Who }
  | { k: 'rate'; r: Rating; x: number; y: number; who: Who; streak: number }
  | { k: 'land'; x: number; y: number; hard: number }
  | { k: 'bounce'; x: number; y: number }
  | { k: 'shot'; x: number; y: number; side: 0 | 1; first: boolean }
  | { k: 'save'; x: number; y: number; side: 0 | 1; held: boolean }
  | { k: 'post'; x: number; y: number }
  | { k: 'goal'; side: 0 | 1; x: number; y: number; who: Who }
  | { k: 'tackle'; x: number; y: number; won: boolean; side: 0 | 1 }
  | { k: 'intercept'; x: number; y: number }
  | { k: 'whistle'; what: 'kickoff' | 'full' | 'golden' }
  | { k: 'touch'; x: number; y: number }
  | { k: 'wall'; x: number; y: number }
  | { k: 'end'; won: boolean };

export type Phase = 'match' | 'pick' | 'won' | 'lost';
export type State = 'kickoff' | 'play' | 'goal' | 'full';

export class Run {
  seed: number;
  phase: Phase = 'match';
  round = 0;
  pitch: PitchId = 'dry';
  shape: ShapeId = 'low';
  perks: Perks = {};
  offer: PerkId[] = [];
  players: Player[] = [];
  ball = { x: CX, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1, fresh: false, wob: 0, ft: false };
  flight: Flight | null = null;
  pass: Pass | null = null;
  /** the player we control */
  ctrl = 0;
  state: State = 'kickoff';
  stateT = 0;
  score: [number, number] = [0, 0];
  clock = MATCH;
  golden = false;
  kickoffSide: 0 | 1 = 0;
  /** game time, which runs slow during a perfect arrival */
  gt = 0;
  tick_ = 0;
  /** real seconds of slow motion left */
  slow = 0;
  /** a player who can play first time, until game time */
  first: { i: number; until: number } | null = null;
  /** perfect arrivals in a row */
  streak = 0;
  /** the keyboard's pass charge and shot charge, in real seconds */
  charge = -1; shotCharge = -1;
  /** where a pass would go right now, for the reticle */
  reticle: { x: number; y: number; loft: boolean; receiver: number; land: number } | null = null;
  lastRating: { r: Rating; at: number; dd: number; by: boolean } | null = null;
  poach = -1;
  events: Ev[] = [];
  match = { perfects: 0, intercepts: 0, shots: 0, onTarget: 0 };
  stats = { rounds: 0, goals: 0, against: 0, perfects: 0, early: 0, late: 0, passes: 0, shots: 0, best: 0, time: 0 };
  private prev = noInput();
  private rng: number;
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1; this.rng = this.seed;
    this.setupRound();
  }
  rnd() { const [v, s] = rngNext(this.rng); this.rng = s; return v; }
  get P() { return PITCHES[this.pitch]; }
  get carrier() { return this.ball.owner >= 0 ? this.players[this.ball.owner] : null; }
  get team() { return TEAMS[this.round]; }
  ev(e: Ev) { this.events.push(e); }

  // ---------------------------------------------------------------- set-up
  /** the next round's pitch and opposition, rolled as soon as a match is won so the changing room can show them */
  upcoming: { pitch: PitchId; shape: ShapeId } | null = null;
  private roll() {
    const n = this.round + 1, ids: PitchId[] = ['dry', 'wet', 'sand', 'hard'], sh: ShapeId[] = ['high', 'low', 'man'];
    // every round is a different pitch from the last, and the final is on summer grass
    let pitch = ids[Math.floor(this.rnd() * 4)];
    if (pitch === this.pitch) pitch = ids[(ids.indexOf(pitch) + 1 + Math.floor(this.rnd() * 3)) % 4];
    if (n === ROUNDS - 1) pitch = 'dry';
    this.upcoming = { pitch, shape: sh[Math.floor(this.rnd() * 3)] };
  }
  setupRound() {
    if (this.round > 0) {
      if (!this.upcoming) this.roll();
      this.pitch = this.upcoming!.pitch; this.shape = this.upcoming!.shape; this.upcoming = null;
    } else { this.pitch = 'dry'; this.shape = 'high'; }
    const mk = (side: 0 | 1, who: Who, hx: number, hy: number): Player => ({
      i: this.players.length, side, who, gk: who === 'keeper' || who === 'gkeeper', x: hx, y: hy, vx: 0, vy: 0, dx: side ? -1 : 1, dy: 0,
      stun: 0, settle: 0, stamina: this.staminaMax, noTouch: 0, kick: 0, tackleCd: 0, dive: 0, diveY: hy, react: -1, hold: 0, hx, hy,
    });
    this.players = [];
    const { x0, x1 } = PITCH;
    this.players.push(mk(0, 'keeper', x0 + 7, CY));
    this.players.push(mk(0, 'dora', CX - 10, CY));
    this.players.push(mk(0, 'enzo', CX - 48, CY + 44));
    this.players.push(mk(0, 'pip', CX - 44, CY - 46));
    this.players.push(mk(0, 'bram', x0 + 74, CY + 6));
    this.players.push(mk(1, 'gkeeper', x1 - 7, CY));
    for (const [hx, hy] of [[CX + 30, CY - 30], [CX + 30, CY + 30], [CX + 78, CY - 50], [CX + 78, CY + 50]]) this.players.push(mk(1, 'grumble', hx, hy));
    this.score = [0, 0]; this.clock = MATCH; this.golden = false; this.streak = 0; this.first = null; this.slow = 0;
    this.match = { perfects: 0, intercepts: 0, shots: 0, onTarget: 0 };
    this.kickoff(0);
  }
  get staminaMax() { return this.perks.sprinter ? 2.4 : 1.2; }
  /** players back to their places, the ball on the spot for whoever kicks off */
  kickoff(side: 0 | 1) {
    this.kickoffSide = side; this.state = 'kickoff'; this.stateT = 0;
    this.flight = null; this.pass = null; this.first = null; this.charge = -1; this.shotCharge = -1; this.poach = -1;
    for (const p of this.players) {
      Object.assign(p, { x: p.hx, y: p.hy, vx: 0, vy: 0, stun: 0, dive: 0, react: -1, hold: 0, kick: 0, noTouch: 0, dx: p.side ? -1 : 1, dy: 0 });
      // the kicking-off side keeps its half; the others stand back from the centre spot
      if (p.side !== side && !p.gk && Math.abs(p.x - CX) < 26) p.x = CX + (p.side ? 26 : -26);
    }
    const taker = this.players.find((p) => p.side === side && (side ? p.who === 'grumble' : p.who === 'dora'))!;
    taker.x = CX + (side ? 6 : -6); taker.y = CY;
    Object.assign(this.ball, { x: CX, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: taker.i, last: taker.i, fresh: false, wob: 0, ft: false });
    this.ctrl = side === 0 ? taker.i : this.nearestOurs(CX, CY).i;
  }
  nearestOurs(x: number, y: number, skipKeeper = true) {
    let best = this.players[1], bd = 1e9;
    for (const p of this.players) if (p.side === 0 && !(skipKeeper && p.gk)) { const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  speedOf(p: Player) {
    let s = SPEED[p.who] * this.P.run;
    if (p.side === 1) s += this.round * 1.8;
    return s;
  }

  // ---------------------------------------------------------------- passes
  /** the flight a pass from (fx, fy) to the spot would take */
  plan(fx: number, fy: number, tx: number, ty: number, loft: boolean, firstTime: boolean): Flight {
    let d = dist(fx, fy, tx, ty);
    if (d > MAX_PASS) { const k = MAX_PASS / d; tx = fx + (tx - fx) * k; ty = fy + (ty - fy) * k; d = MAX_PASS; }
    if (d < MIN_PASS) { loft = false; }
    tx = clamp(tx, PITCH.x0 + 3, PITCH.x1 - 3); ty = clamp(ty, PITCH.y0 + 3, PITCH.y1 - 3); d = Math.max(1, dist(fx, fy, tx, ty));
    const quick = (firstTime ? 1.15 : 1) * (this.perks.switch && d > 150 ? 1.33 : 1);
    if (loft) {
      const T = (0.34 + d / 330) / quick;
      return { fx, fy, tx, ty, T, t: 0, loft, h: Math.min(50, 10 + d * 0.21), curve: 0, v0: d / T, dec: 0, d };
    }
    const dec = this.P.dec, vend = this.P.vend * quick;
    const v0 = Math.sqrt(vend * vend + 2 * dec * d) * (quick > 1 ? 1.05 : 1);
    const T = (v0 - Math.sqrt(Math.max(0, v0 * v0 - 2 * dec * d))) / dec;
    return { fx, fy, tx, ty, T, t: 0, loft, h: 0, curve: 0, v0, dec, d };
  }
  /** the ball's place on its way: a ground pass slows as it goes, a lofted one flies straight in an arc */
  flightAt(f: Flight, t: number) {
    const s = f.loft ? t / f.T : (f.v0 * t - (f.dec * t * t) / 2) / f.d;
    const nx = -(f.ty - f.fy) / f.d, ny = (f.tx - f.fx) / f.d, bend = f.curve * Math.sin(Math.PI * clamp(s, 0, 1));
    const x = f.fx + (f.tx - f.fx) * s + nx * bend, y = f.fy + (f.ty - f.fy) * s + ny * bend;
    const u = t / f.T, z = f.loft ? 4 * f.h * u * (1 - u) : 0;
    return { x, y, z, s };
  }
  /** who runs onto a pass: the teammate who can get to the spot soonest (he has to time his run so he arrives as it
   *  lands, not before), or if nobody can make it in time, the one who'd be least late. `after` cycles to the next. */
  bestRunner(x: number, y: number, T: number, not: number, after = -1) {
    const list = this.players.filter((p) => p.side === 0 && !p.gk && p.i !== not)
      .map((p) => { const eta = dist(p.x, p.y, x, y) / this.speedOf(p); return { p, e: eta <= T + 0.1 ? eta : 10 + eta - T }; })
      .sort((a, b) => a.e - b.e);
    if (after < 0) return list[0].p;
    const k = list.findIndex((q) => q.p.i === after);
    return list[(k + 1) % list.length].p;
  }
  /** passes the ball to a spot, and hands control to the runner */
  kickPass(p: Player, tx: number, ty: number, loft: boolean, wall = false) {
    const ft = !!this.first && this.first.i === p.i && this.gt <= this.first.until;
    const f = this.plan(this.ball.x, this.ball.y, tx, ty, loft, ft);
    if (this.perks.bender) {
      // curl round the first Grumble in the way, on the side away from him
      for (const g of this.players) if (g.side === 1 && !g.gk) {
        const sd = segDist(g.x, g.y, f.fx, f.fy, f.tx, f.ty);
        if (sd.d < 12 && sd.t > 0.15 && sd.t < 0.85) {
          const nx = -(f.ty - f.fy) / f.d, ny = (f.tx - f.fx) / f.d, side = (g.x - f.fx) * nx + (g.y - f.fy) * ny;
          f.curve = side > 0 ? -18 : 18; break;
        }
      }
    }
    this.flight = f;
    const b = this.ball; b.owner = -1; b.last = p.i; b.fresh = loft; b.z = 0; b.vx = b.vy = b.vz = 0; b.wob = 0; b.ft = false;
    p.noTouch = 0.3; p.kick = 0.25;
    const r = p.side === 0 ? (wall ? this.players.find((q) => q.i === this.pass?.passer) ?? this.bestRunner(f.tx, f.ty, f.T, p.i) : this.bestRunner(f.tx, f.ty, f.T, p.i)) : null;
    this.pass = { passer: p.i, receiver: r ? r.i : -1, x: f.tx, y: f.ty, land: this.gt + f.T, loft: f.loft, arr: {}, rolled: new Set() };
    if (p.side === 0) { this.stats.passes++; if (r && r.i !== this.ctrl) { this.ctrl = r.i; this.ev({ k: 'switch', i: r.i, who: r.who }); } }
    this.first = null; this.charge = -1; this.poach = -1;
    this.ev({ k: 'kick', x: b.x, y: b.y, loft: f.loft, who: p.who });
  }
  /** a shot at the goal the player is attacking */
  kickShot(p: Player, power: number, aimY: number) {
    const ft = !!this.first && this.first.i === p.i && this.gt <= this.first.until;
    const gx = p.side === 0 ? PITCH.x1 + 4 : PITCH.x0 - 4;
    const d = dist(this.ball.x, this.ball.y, gx, aimY);
    let spread = 3 + d * 0.07 + (power > 0.92 ? 5 : 0);
    if (ft) { spread *= 0.45; power = Math.max(power, 0.85); }
    const ty = aimY + (this.rnd() * 2 - 1) * spread;
    const sp = (150 + 150 * power) * (ft ? 1.2 : 1);
    const b = this.ball, dx = gx - b.x, dy = ty - b.y, l = Math.hypot(dx, dy) || 1;
    b.owner = -1; b.last = p.i; b.fresh = false; b.vx = (dx / l) * sp; b.vy = (dy / l) * sp; b.vz = 30 + 50 * power + (this.rnd() * 20); b.z = Math.max(b.z, 1);
    b.wob = ft && this.perks.knuckle ? 1 : 0; b.ft = ft;
    this.flight = null; this.pass = null; this.first = null; this.shotCharge = -1; this.poach = -1;
    p.noTouch = 0.3; p.kick = 0.25;
    const keeper = this.players.find((q) => q.gk && q.side !== p.side)!; keeper.react = -1;
    if (p.side === 0) { this.stats.shots++; this.match.shots++; }
    this.ev({ k: 'shot', x: b.x, y: b.y, side: p.side, first: ft });
  }
  /** a ground pass straight to a teammate's feet (keepers and Grumbles pass like this), led a little */
  kickToFeet(p: Player, q: Player) {
    const lead = 0.35;
    this.kickPass(p, q.x + q.vx * lead, q.y + q.vy * lead, false);
  }

  // ---------------------------------------------------------------- the tick
  tick(inp: Input) {
    this.events = [];
    this.tick_++;
    const real = DT;
    if (this.slow > 0) this.slow = Math.max(0, this.slow - real);
    const dt = DT * (this.slow > 0 ? SLOW : 1);
    if (this.phase !== 'match') { this.prev = inp; return; }
    this.stateT += real;
    if (this.state === 'kickoff') {
      if (this.stateT > 1.1) { this.state = 'play'; this.stateT = 0; this.ev({ k: 'whistle', what: 'kickoff' }); }
      this.prev = inp; return;
    }
    if (this.state === 'goal') {
      // the ball sits in the net while everyone celebrates
      for (const p of this.players) { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx * dt; p.y += p.vy * dt; }
      if (this.stateT > 1.7) {
        if (this.golden) this.endMatch();
        else this.kickoff(this.lastGoalBy === 0 ? 1 : 0);
      }
      this.prev = inp; return;
    }
    if (this.state === 'full') {
      if (this.stateT > 1.6) this.finishMatch();
      this.prev = inp; return;
    }
    this.gt += dt; this.stats.time += dt;
    this.clock -= dt;
    if (this.clock <= 0) {
      this.clock = 0;
      if (this.score[0] !== this.score[1]) { this.endMatch(); this.prev = inp; return; }
      if (!this.golden) { this.golden = true; this.clock = GOLDEN; this.ev({ k: 'whistle', what: 'golden' }); }
      else { this.endMatch(); this.prev = inp; return; }
    }
    for (const p of this.players) {
      p.stun = Math.max(0, p.stun - dt); p.settle = Math.max(0, p.settle - dt); p.noTouch = Math.max(0, p.noTouch - dt); p.kick = Math.max(0, p.kick - dt); p.tackleCd = Math.max(0, p.tackleCd - dt);
    }
    this.control(inp, dt, real);
    this.ai(dt);
    this.keepers(dt);
    this.move(dt);
    this.moveBall(dt);
    this.prev = inp;
  }
  private lastGoalBy: 0 | 1 = 0;

  /** the player we control: running, the pass reticle, passing, shooting and tackling */
  private control(inp: Input, dt: number, real: number) {
    const b = this.ball;
    // who we control: the ball carrier; the runner while a pass is in the air; otherwise whoever is nearest the ball
    const car = this.carrier;
    if (car && car.side === 0 && !car.gk) this.ctrl = car.i;
    else if (this.pass && this.pass.receiver >= 0 && this.flight) {
      if (inp.cycle && !this.prev.cycle && this.flight) {
        const f = this.flight, n = this.bestRunner(f.tx, f.ty, this.pass.land - this.gt, this.pass.passer, this.ctrl);
        if (n.i !== this.ctrl) { this.ctrl = n.i; this.pass.receiver = n.i; this.ev({ k: 'switch', i: n.i, who: n.who }); }
      }
    } else {
      const cur = this.players[this.ctrl], near = this.nearestOurs(b.x, b.y);
      if (cur.gk || (near.i !== cur.i && dist(near.x, near.y, b.x, b.y) + 14 < dist(cur.x, cur.y, b.x, b.y))) { this.ctrl = near.i; }
    }
    const p = this.players[this.ctrl];
    // running
    let mx = inp.mx, my = inp.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    let sp = this.speedOf(p);
    if (inp.sprint && p.stamina > 0 && ml > 0.1) { sp *= 1.38; p.stamina = Math.max(0, p.stamina - real); }
    else p.stamina = Math.min(this.staminaMax, p.stamina + real * 0.3);
    if (b.owner === p.i) sp *= p.settle > 0 ? 0.55 : 0.9;
    if (p.stun > 0) { mx = 0; my = 0; }
    this.steer(p, mx * sp, my * sp, dt);
    if (ml > 0.1) { p.dx = mx / ml; p.dy = my / ml; }
    if (Math.abs(mx) + Math.abs(my) > 0.1) this.poach = -1;

    const has = b.owner === p.i && p.settle <= 0;
    const ft = !!this.first && this.first.i === p.i && this.gt <= this.first.until;
    // the pass reticle
    if (has) {
      if (inp.pass) { this.charge = this.charge < 0 ? 0 : this.charge + real * (ft ? 2 : 1); }
      let tx: number, ty: number;
      if (inp.spot) { tx = inp.spot.x; ty = inp.spot.y; }
      else {
        const reach = 44 + 140 * clamp(this.charge < 0 ? 0 : this.charge / 0.75, 0, 1);
        tx = b.x + p.dx * reach; ty = b.y + p.dy * reach;
      }
      const f = this.plan(b.x, b.y, tx, ty, inp.loft, ft);
      const r = this.bestRunner(f.tx, f.ty, f.T, p.i);
      this.reticle = { x: f.tx, y: f.ty, loft: f.loft, receiver: r.i, land: f.T };
      const released = this.prev.pass && !inp.pass && this.charge >= 0;
      if (inp.passNow || released) {
        // a quick tap after a perfect arrival is a wall pass, with the perk
        if (released && this.perks.wall && ft && this.charge < 0.14 && this.pass === null && this.lastPasser >= 0) {
          const q = this.players[this.lastPasser];
          if (q && q.side === 0 && q.i !== p.i) {
            const tx2 = clamp(q.x + 46, PITCH.x0, PITCH.x1 - 10), ty2 = q.y + q.vy * 0.4;
            this.pass = { passer: this.lastPasser, receiver: q.i, x: tx2, y: ty2, land: 0, loft: false, arr: {}, rolled: new Set() };
            this.ev({ k: 'wall', x: b.x, y: b.y });
            this.kickPass(p, tx2, ty2, false, true);
            this.prev = inp; return;
          }
        }
        this.kickPass(p, this.reticle.x, this.reticle.y, this.reticle.loft);
        this.reticle = null;
      }
      // shooting
      if (b.owner === p.i) {
        const aimY = clamp(inp.aimY ?? CY + my * 15, GOAL.y0 + 3, GOAL.y1 - 3);
        if (inp.shoot && ft && !this.prev.shoot) this.kickShot(p, 0.9, aimY);
        else if (inp.shoot) this.shotCharge = this.shotCharge < 0 ? 0 : this.shotCharge + real;
        else if (this.shotCharge >= 0) this.kickShot(p, 0.45 + 0.55 * clamp(this.shotCharge / 0.6, 0, 1), aimY);
      }
      // the poacher shoots by himself
      if (b.owner === p.i && this.poach >= 0 && this.gt >= this.poach) {
        const far = p.y < CY ? GOAL.y1 - 4 : GOAL.y0 + 4; this.poach = -1; this.kickShot(p, 0.92, far);
      }
    } else {
      this.reticle = null; this.charge = -1; this.shotCharge = -1;
      // a tackle: the shoot button, on defence
      const c = this.carrier;
      if (inp.shoot && !this.prev.shoot && c && c.side === 1 && p.tackleCd <= 0 && p.stun <= 0) this.tackle(p, c, p.who === 'bram' ? 0.72 : 0.56);
    }
  }
  private lastPasser = -1;
  private tackle(p: Player, c: Player, chance: number) {
    p.tackleCd = 0.45; p.kick = 0.2;
    const d = dist(p.x, p.y, c.x, c.y);
    if (d > 11) { p.stun = 0.15; return; }
    const won = this.rnd() < chance + (c.settle > 0 ? 0.3 : 0);
    if (won) {
      const b = this.ball, a = this.rnd() * Math.PI * 2;
      b.owner = -1; b.last = p.i; b.vx = Math.cos(a) * 30 + (p.side ? -30 : 30); b.vy = Math.sin(a) * 40; b.vz = 0; b.z = 0;
      c.stun = 0.5; c.noTouch = 0.4; this.flight = null; this.pass = null;
    } else p.stun = 0.35;
    this.ev({ k: 'tackle', x: c.x, y: c.y, won, side: p.side });
  }
  private steer(p: Player, tvx: number, tvy: number, dt: number) {
    const k = Math.min(1, dt * 12);
    p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
  }
  private runTo(p: Player, x: number, y: number, dt: number, fast = 1, slack = 2) {
    const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
    const sp = this.speedOf(p) * fast * (this.ball.owner === p.i ? 0.9 : 1);
    if (l < slack || p.stun > 0) { this.steer(p, 0, 0, dt); return; }
    const v = Math.min(sp, l * 6);
    this.steer(p, (dx / l) * v, (dy / l) * v, dt);
    p.dx = dx / l; p.dy = dy / l;
  }

  // ---------------------------------------------------------------- everyone else
  private ai(dt: number) {
    const b = this.ball, car = this.carrier, f = this.flight;
    const passBy = this.pass ? this.players[this.pass.passer].side : -1;
    const ourBall = (!!car && car.side === 0) || (!car && !!f && passBy === 0);
    const theirBall = (!!car && car.side === 1) || (!car && !!f && passBy === 1);
    const loose = !car && !f;
    const reds = this.players.filter((p) => p.side === 0 && !p.gk), greens = this.players.filter((p) => p.side === 1 && !p.gk);
    // ---- our team
    const helpers = reds.filter((q) => q.i !== this.ctrl && !(this.pass && f && q.i === this.pass.receiver));
    const press = this.nearest(helpers, b.x, b.y);
    for (const p of reds) {
      if (p.i === this.ctrl) continue;
      if (this.pass && f && this.pass.receiver === p.i) { this.runTo(p, f.tx, f.ty, dt); continue; }
      const k = helpers.indexOf(p);
      if (ourBall) {
        // runners: ahead of the ball and spread across the pitch, away from the nearest Grumble; Bram hangs back
        const lanes = [CY - 52, CY + 52, CY];
        let tx = p.who === 'bram' ? Math.max(PITCH.x0 + 60, b.x - 50) : clamp(b.x + 54 + k * 14, PITCH.x0 + 60, PITCH.x1 - 30);
        let ty = lanes[k % 3] + (b.y - CY) * 0.25;
        const g = this.nearest(greens, p.x, p.y);
        if (g && dist(g.x, g.y, p.x, p.y) < 18) { ty += p.y > g.y ? 14 : -14; tx += 6; }
        // a decoy run while a pass is in the air
        if (this.perks.decoy && f && k === 0) { this.runTo(p, p.x + 50, p.y < CY ? PITCH.y0 + 8 : PITCH.y1 - 8, dt, 1.3); continue; }
        this.runTo(p, tx, clamp(ty, PITCH.y0 + 8, PITCH.y1 - 8), dt, 1, 4);
        continue;
      }
      if (loose && p === press) { this.runTo(p, b.x, b.y, dt); continue; }
      if (car && car.side === 1 && !car.gk && p === press) {
        this.runTo(p, car.x - 4, car.y, dt);
        if (dist(p.x, p.y, car.x, car.y) < 8 && p.tackleCd <= 0 && this.rnd() < 0.05) this.tackle(p, car, p.who === 'bram' ? 0.62 : 0.46);
        continue;
      }
      // the rest pick up a Grumble each, goal-side
      const free = greens.filter((g) => g !== car).sort((a, c) => a.x - c.x);
      const g = free[Math.max(0, k) % Math.max(1, free.length)];
      if (g) this.runTo(p, Math.max(PITCH.x0 + 16, g.x - 10), g.y + (CY - g.y) * 0.15, dt, 1, 3);
    }
    // ---- the Grumbles
    const sk = this.round;
    const chaser = f && passBy === 0 ? this.nearest(greens, f.tx, f.ty) : null;
    const presser = car && car.side === 0 ? this.nearest(greens, car.x, car.y) : null;
    const nearBall = greens.slice().sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y));
    for (const g of greens) {
      if (g.stun > 0) { this.steer(g, 0, 0, dt); continue; }
      if (car === g) { this.grumbleCarry(g, dt); continue; }
      if (theirBall) {
        // attacking: spread out ahead of the ball
        const others = greens.filter((q) => q !== car);
        const k = others.indexOf(g), lanes = [CY - 50, CY + 50, CY];
        this.runTo(g, clamp(b.x - 46 - k * 10, PITCH.x0 + 30, PITCH.x1 - 30), lanes[k % 3], dt, 0.95, 4);
        continue;
      }
      if (loose) {
        if (nearBall.indexOf(g) < 2) this.runTo(g, b.x, b.y, dt, 1.02);
        else this.runTo(g, Math.max(CX, g.hx), g.hy, dt, 0.8, 6);
        continue;
      }
      // defending: the one nearest a pass's spot goes for it, the nearest to the ball presses, the rest hold the shape
      if (g === chaser && f) { this.runTo(g, f.tx, f.ty, dt, 1.05); continue; }
      if (g === presser && car) {
        this.runTo(g, car.x + 4, car.y, dt, 1.02);
        if (dist(g.x, g.y, car.x, car.y) < 8 && g.tackleCd <= 0 && this.rnd() < (0.026 + 0.006 * sk) * (car.settle > 0 ? 3 : 1)) this.tackle(g, car, 0.5);
        continue;
      }
      const others = greens.filter((q) => q !== presser && q !== chaser);
      const k = others.indexOf(g), n = Math.max(1, others.length);
      if (this.shape === 'man') {
        const marks = reds.filter((q) => q !== car).sort((a, c) => a.y - c.y);
        const mine = marks[k % marks.length];
        if (mine) { this.runTo(g, mine.x + 7, mine.y, dt, 1.02, 2); continue; }
      }
      const line = this.shape === 'high' ? clamp(b.x + 42, 196, 292) : clamp(PITCH.x1 - 52, 300, 320);
      const span = this.shape === 'high' ? 104 : 64;
      const ty = CY - span / 2 + (span * (k + 0.5)) / n + (b.y - CY) * 0.3;
      this.runTo(g, line, clamp(ty, PITCH.y0 + 8, PITCH.y1 - 8), dt, 1, 3);
    }
  }
  private nearest(list: Player[], x: number, y: number) {
    let best: Player | null = null, bd = 1e9;
    for (const p of list) { const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  /** a Grumble with the ball: dribbles at our goal, passes forward when pressed, shoots when close */
  private grumbleCarry(g: Player, dt: number) {
    const reds = this.players.filter((p) => p.side === 0 && !p.gk);
    const near = this.nearest(reds, g.x, g.y)!, nd = dist(near.x, near.y, g.x, g.y);
    let tx = PITCH.x0 + 20, ty = CY;
    if (nd < 22) ty = g.y + (g.y > near.y ? 30 : -30);
    this.runTo(g, tx, clamp(ty, PITCH.y0 + 6, PITCH.y1 - 6), dt, 0.95);
    if (g.noTouch > 0) return;
    const range = g.x - PITCH.x0, close = 46 + this.round * 4;
    if ((range < close || (range < close + 40 && this.rnd() < 0.012)) && this.rnd() < 0.15) {
      this.kickShot(g, 0.55 + this.rnd() * 0.35, CY + (this.rnd() * 2 - 1) * 16);
      return;
    }
    if (nd < 13 && this.rnd() < 0.03 + this.round * 0.006) {
      // the most forward Grumble with a clear lane
      const mates = this.players.filter((q) => q.side === 1 && !q.gk && q !== g)
        .filter((q) => !reds.some((r) => segDist(r.x, r.y, g.x, g.y, q.x, q.y).d < 9))
        .sort((a, c) => a.x - c.x);
      if (mates[0]) this.kickToFeet(g, mates[0]);
    }
  }

  /** keepers stay on the line between the ball and the middle of the goal, dive at shots, and roll the ball out */
  private keepers(dt: number) {
    const b = this.ball;
    for (const k of this.players) {
      if (!k.gk) continue;
      const lineX = k.side === 0 ? PITCH.x0 + 7 : PITCH.x1 - 7;
      if (b.owner === k.i) {
        k.hold += dt; this.steer(k, 0, 0, dt);
        const mates = this.players.filter((q) => q.side === k.side && !q.gk);
        const foes = this.players.filter((q) => q.side !== k.side && !q.gk);
        const room = (q: Player) => Math.min(...foes.map((f) => dist(f.x, f.y, q.x, q.y)));
        const open = mates.sort((a, c) => room(c) - room(a))[0];
        if (k.hold > 0.9 && (room(open) > 24 || k.hold > 2.2)) {
          k.hold = 0; this.kickToFeet(k, open);
          if (k.side === 0) { this.pass = null; if (this.ctrl !== open.i) { this.ctrl = open.i; this.ev({ k: 'switch', i: open.i, who: open.who }); } }
        }
        continue;
      }
      // a shot coming: work out where it crosses the line, and dive after a moment
      const toward = k.side === 0 ? b.vx < -80 : b.vx > 80;
      if (b.owner < 0 && !this.flight && toward) {
        const tt = (lineX - b.x) / b.vx, cy = b.y + b.vy * tt;
        if (tt > 0 && tt < 1.2 && cy > GOAL.y0 - 10 && cy < GOAL.y1 + 10) {
          if (k.react < 0) k.react = (k.side === 1 ? 0.2 - this.round * 0.012 : 0.13) + (b.wob ? 0.16 : 0) + (b.ft ? 0.1 : 0);
          k.react -= dt;
          if (k.react <= 0 && k.dive <= 0) { k.dive = 0.42; k.diveY = clamp(cy, GOAL.y0 - 6, GOAL.y1 + 6); }
        }
      } else if (k.dive <= 0) k.react = -1;
      if (k.dive > 0) {
        k.dive -= dt;
        const dy = k.diveY - k.y; k.vy = clamp(dy * 10, -150, 150); k.vx = 0; k.y += k.vy * dt;
        k.x = lineX;
        // the save
        if (b.owner < 0 && dist(k.x, k.y, b.x, b.y) < 9 && b.z < GOAL.bar + 2 && k.noTouch <= 0) {
          const sp = Math.hypot(b.vx, b.vy);
          const chance = clamp(1.6 - sp / 300, 0.25, 0.92) - (b.wob ? 0.15 : 0) - (b.ft ? 0.2 : 0) + (k.side === 1 ? this.round * 0.01 : 0);
          k.noTouch = 0.4;
          if (this.rnd() < chance) {
            if (sp < 175) { b.owner = k.i; b.vx = b.vy = b.vz = 0; b.z = 0; k.hold = 0; this.ev({ k: 'save', x: b.x, y: b.y, side: k.side, held: true }); }
            else { b.vx = -b.vx * 0.35; b.vy = (this.rnd() * 2 - 1) * 70; b.vz = 40; b.last = k.i; b.wob = 0; this.ev({ k: 'save', x: b.x, y: b.y, side: k.side, held: false }); }
            if (k.side === 1) this.match.onTarget++;
          }
        }
        continue;
      }
      // a dribbler in the box: come off the line and smother it
      const car = this.carrier;
      if (car && car.side !== k.side && !car.gk && this.inBox(car.x, car.y, k.side === 0 ? 0 : 1) && Math.abs(car.x - lineX) < 34) {
        this.runTo(k, car.x, car.y, dt, 1.1, 0);
        if (dist(k.x, k.y, car.x, car.y) < 9 && k.tackleCd <= 0) {
          k.tackleCd = 0.5;
          if (this.rnd() < (k.side === 0 ? 0.55 : 0.45)) { b.owner = k.i; b.vx = b.vy = 0; k.hold = 0; car.stun = 0.4; this.ev({ k: 'save', x: b.x, y: b.y, side: k.side, held: true }); }
        }
        continue;
      }
      // sweeping up loose balls behind our defence
      const loose = b.owner < 0 && !this.flight && b.z < 10;
      const near = Math.abs(b.x - lineX) < (k.side === 0 && this.perks.sweeper ? 80 : 30) && Math.abs(b.y - CY) < (k.side === 0 && this.perks.sweeper ? 70 : 32);
      if (loose && near && Math.hypot(b.vx, b.vy) < 150) { this.runTo(k, b.x, b.y, dt, 1.1, 0); continue; }
      const ty = clamp(CY + (b.y - CY) * 0.45, GOAL.y0 + 4, GOAL.y1 - 4);
      const tx = lineX + (k.side === 0 ? 1 : -1) * clamp(14 - Math.abs(b.x - lineX) * 0.05, 0, 10);
      this.runTo(k, tx, ty, dt, 0.9, 1);
    }
  }

  private move(dt: number) {
    const ps = this.players;
    for (const p of ps) {
      if (p.gk && p.dive > 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const pad = 4;
      p.x = clamp(p.x, PITCH.x0 + pad, PITCH.x1 - pad); p.y = clamp(p.y, PITCH.y0 + pad, PITCH.y1 - pad);
    }
    // nobody stands inside anybody else
    for (let a = 0; a < ps.length; a++) for (let c = a + 1; c < ps.length; c++) {
      const p = ps[a], q = ps[c], d = dist(p.x, p.y, q.x, q.y);
      if (d > 0.01 && d < 8) { const push = (8 - d) / 2, ux = (q.x - p.x) / d, uy = (q.y - p.y) / d; p.x -= ux * push; p.y -= uy * push; q.x += ux * push; q.y += uy * push; }
    }
  }

  // ---------------------------------------------------------------- the ball
  private moveBall(dt: number) {
    const b = this.ball, P = this.P;
    if (b.owner >= 0) {
      const p = this.players[b.owner];
      const dx = p.gk ? (p.side === 0 ? 1 : -1) : p.dx;
      b.x = p.x + dx * 5; b.y = p.y + p.dy * 3 + 1; b.z = 0; b.vx = p.vx; b.vy = p.vy; b.vz = 0;
      this.trackArrivals(); return;
    }
    if (this.flight) {
      const f = this.flight; f.t += dt;
      const at = this.flightAt(f, Math.min(f.t, f.T));
      const px = b.x, py = b.y;
      b.x = at.x; b.y = at.y; b.z = at.z;
      b.vx = (b.x - px) / dt; b.vy = (b.y - py) / dt;
      if (f.t >= f.T) {
        // it lands: from here on it's an ordinary ball
        this.flight = null;
        const d = Math.hypot(b.vx, b.vy) || 1;
        if (f.loft) {
          const keep = this.perks.backspin ? 0 : P.keep, hs = f.v0 * keep;
          b.vx = ((f.tx - f.fx) / f.d) * hs; b.vy = ((f.ty - f.fy) / f.d) * hs;
          b.vz = this.perks.backspin ? 0 : f.h * 3.2 * P.bounce; b.z = 0;
          this.ev({ k: 'land', x: b.x, y: b.y, hard: 1 });
        } else {
          const v = P.vend; b.vx = (b.vx / d) * v; b.vy = (b.vy / d) * v;
          this.ev({ k: 'land', x: b.x, y: b.y, hard: 0 });
        }
        b.fresh = false;
      }
    } else {
      b.vz -= GRAV * dt; b.z += b.vz * dt;
      if (b.wob) { b.vy += Math.sin(this.gt * 31) * 260 * dt; }
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -40) { b.vz = -b.vz * (P.bounce || 0.15); b.vx *= 0.88; b.vy *= 0.88; this.ev({ k: 'bounce', x: b.x, y: b.y }); }
        else b.vz = 0;
      }
      if (b.z === 0 && b.vz === 0) {
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) { const ns = Math.max(0, sp - P.dec * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    this.walls();
    if (this.state !== 'play') return;
    this.trackArrivals();
    this.pickUp();
  }
  /** the boards, the posts and the nets */
  private walls() {
    const b = this.ball, { x0, x1, y0, y1 } = PITCH;
    const inMouth = b.y > GOAL.y0 && b.y < GOAL.y1 && b.z < GOAL.bar;
    for (const [px, py] of [[x0, GOAL.y0], [x0, GOAL.y1], [x1, GOAL.y0], [x1, GOAL.y1]]) {
      const d = dist(b.x, b.y, px, py);
      if (d < 3 && b.z < GOAL.bar + 2) {
        const ux = (b.x - px) / (d || 1), uy = (b.y - py) / (d || 1), dot = b.vx * ux + b.vy * uy;
        if (dot < 0) { b.vx -= 1.6 * dot * ux; b.vy -= 1.6 * dot * uy; b.x = px + ux * 3; b.y = py + uy * 3; this.ev({ k: 'post', x: b.x, y: b.y }); this.endFlight(); }
      }
    }
    if (b.x > x1 && inMouth && this.state === 'play') { this.goal(0); return; }
    if (b.x < x0 && inMouth && this.state === 'play') { this.goal(1); return; }
    if (b.x < x0 && !inMouth) { b.x = x0; b.vx = Math.abs(b.vx) * 0.55; this.endFlight(); }
    if (b.x > x1 && !inMouth) { b.x = x1; b.vx = -Math.abs(b.vx) * 0.55; this.endFlight(); }
    if (b.y < y0) { b.y = y0; b.vy = Math.abs(b.vy) * 0.55; this.endFlight(); }
    if (b.y > y1) { b.y = y1; b.vy = -Math.abs(b.vy) * 0.55; this.endFlight(); }
    if (this.state === 'goal') { b.x = clamp(b.x, x0 - GOAL.depth, x1 + GOAL.depth); }
  }
  /** a pass that hits the boards or a post is just a loose ball now */
  private endFlight() {
    if (!this.flight) return;
    this.flight = null;
  }
  /** our players who reach the spot before the ball is taken */
  private trackArrivals() {
    const ps = this.pass; if (!ps || this.players[ps.passer].side !== 0) return;
    for (const p of this.players) if (p.side === 0 && !p.gk && ps.arr[p.i] === undefined && dist(p.x, p.y, ps.x, ps.y) < ARRIVE) ps.arr[p.i] = this.gt;
  }
  /** whoever can reach the ball takes it */
  private pickUp() {
    const b = this.ball;
    if (b.owner >= 0) return;
    const sp = Math.hypot(b.vx, b.vy);
    let best: Player | null = null, bd = 1e9;
    // a lofted pass is over everyone's heads until it comes down
    if (this.flight && this.flight.loft && this.flight.t < this.flight.T * 0.55) return;
    for (const p of this.players) {
      if (p.noTouch > 0 || p.stun > 0) continue;
      const reach = p.gk ? REACH + 2 : REACH;
      const d = dist(p.x, p.y, b.x, b.y);
      if (d > reach || b.z > KNEE + (p.gk ? 6 : 0)) continue;
      // keepers only handle in their own box
      if (p.gk && (Math.abs(b.x - (p.side === 0 ? PITCH.x0 : PITCH.x1)) > BOX.depth || Math.abs(b.y - CY) > BOX.half)) continue;
      // a Grumble in the path of one of our passes gets one go at cutting it out
      if (this.pass && this.flight && p.side !== this.players[this.pass.passer].side) {
        if (this.pass.rolled.has(p.i)) continue;
        this.pass.rolled.add(p.i);
        if (this.rnd() > (sp > 150 ? 0.45 : 0.7)) continue;
      }
      // a fast shot can't just be stopped by walking into it
      if (!p.gk && sp > 230 && !this.flight && this.rnd() < 0.6) continue;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) this.take(best);
  }
  private take(p: Player) {
    const b = this.ball, ps = this.pass;
    // a keeper gathering a shot is a save too
    if (p.gk && Math.hypot(b.vx, b.vy) > 110 && !this.flight) { this.ev({ k: 'save', x: b.x, y: b.y, side: p.side, held: true }); if (p.side === 1) this.match.onTarget++; }
    p.dive = 0; p.react = -1;
    b.owner = p.i; b.last = p.i; b.wob = 0; b.ft = false;
    this.flight = null;
    p.hold = 0;
    if (ps && this.players[ps.passer].side === 0) {
      if (p.side === 0 && !p.gk) {
        const arrive = ps.arr[p.i] ?? this.gt;
        const w = this.P.window * (this.perks.wide ? 1.5 : 1) + (this.perks.carousel ? Math.min(5, this.streak) * 0.05 : 0);
        const dd = arrive - ps.land;
        const r: Rating = dd < -EARLY * w ? 'early' : dd > LATE * w ? 'late' : 'perfect';
        this.lastRating = { r, at: this.gt, dd, by: ps.arr[p.i] !== undefined };
        if (r === 'perfect') {
          this.streak++; this.stats.perfects++; this.match.perfects++; this.stats.best = Math.max(this.stats.best, this.streak);
          this.slow = SLOW_FOR; this.first = { i: p.i, until: this.gt + FIRST_FOR };
          this.lastPasser = ps.passer;
          if (this.perks.poacher && p.who === 'pip' && this.inBox(p.x, p.y, 1)) this.poach = this.gt + 0.22;
        } else { this.streak = 0; if (r === 'early') { this.stats.early++; p.settle = SETTLE; } else this.stats.late++; }
        this.ev({ k: 'rate', r, x: p.x, y: p.y, who: p.who, streak: this.streak });
        if (p.i !== this.ctrl) { this.ctrl = p.i; this.ev({ k: 'switch', i: p.i, who: p.who }); }
        // Bram's heavy touch knocks it on ahead of him
        if (this.perks.heavy && p.who === 'bram' && Math.hypot(p.vx, p.vy) > 25) {
          const l = Math.hypot(p.vx, p.vy); b.owner = -1; b.vx = (p.vx / l) * 82; b.vy = (p.vy / l) * 82; p.noTouch = 0.12; this.ev({ k: 'touch', x: b.x, y: b.y });
        }
      } else if (p.side === 1) { this.streak = 0; this.match.intercepts++; this.ev({ k: 'intercept', x: b.x, y: b.y }); }
    }
    this.pass = null;
    if (p.side === 0 && !p.gk && p.i !== this.ctrl) { this.ctrl = p.i; this.ev({ k: 'switch', i: p.i, who: p.who }); }
  }
  inBox(x: number, y: number, side: 0 | 1) {
    const ex = side === 1 ? PITCH.x1 : PITCH.x0;
    return Math.abs(x - ex) < BOX.depth && Math.abs(y - CY) < BOX.half;
  }

  // ---------------------------------------------------------------- goals and the end of a match
  private goal(side: 0 | 1) {
    const b = this.ball, by = this.players[b.last];
    this.score[side]++; this.lastGoalBy = side;
    if (side === 0) { this.stats.goals++; this.match.onTarget++; } else this.stats.against++;
    this.state = 'goal'; this.stateT = 0; this.flight = null; this.pass = null; this.first = null;
    b.vx *= 0.2; b.vy *= 0.2; b.owner = -1;
    this.ev({ k: 'goal', side, x: b.x, y: b.y, who: by?.who ?? 'dora' });
  }
  private endMatch() {
    this.state = 'full'; this.stateT = 0;
    this.ev({ k: 'whistle', what: 'full' });
  }
  /** who goes through: the most goals; level after golden goal, more perfect arrivals than the Grumbles had interceptions */
  get through() {
    if (this.score[0] !== this.score[1]) return this.score[0] > this.score[1];
    return this.match.perfects > this.match.intercepts;
  }
  private finishMatch() {
    const won = this.through;
    this.ev({ k: 'end', won });
    if (!won) { this.phase = 'lost'; return; }
    this.stats.rounds++;
    if (this.round === ROUNDS - 1) { this.phase = 'won'; return; }
    this.roll();
    this.makeOffer();
    this.phase = this.offer.length ? 'pick' : 'match';
    if (this.phase === 'match') { this.round++; this.setupRound(); }
  }
  makeOffer() {
    const can = PERKS.map((p) => p.id).filter((id) => !this.perks[id]);
    this.offer = [];
    while (this.offer.length < 3 && can.length) this.offer.push(can.splice(Math.floor(this.rnd() * can.length), 1)[0]);
  }
  /** takes a perk from the offer (or nothing) and goes on to the next round */
  pick(id?: PerkId) {
    if (this.phase !== 'pick') return false;
    if (id && !this.offer.includes(id)) return false;
    if (id) this.perks[id] = true;
    this.offer = []; this.round++; this.phase = 'match'; this.setupRound();
    return true;
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'into-space-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { round: number; flow: number; goals: number };
  stats: { runs: number; cups: number; goals: number; perfects: number };
  settings: { sound: boolean; music: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { round: 0, flow: 0, goals: 0 }, stats: { runs: 0, cups: 0, goals: 0, perfects: 0 }, settings: { sound: true, music: true } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    s.intro = o.intro === true;
    for (const k of ['round', 'flow', 'goals'] as const) s.best[k] = num(o.best?.[k], 0);
    for (const k of ['runs', 'cups', 'goals', 'perfects'] as const) s.stats[k] = num(o.stats?.[k], 0);
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** adds a finished run to the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.goals += r.stats.goals; s.stats.perfects += r.stats.perfects;
  if (r.phase === 'won') s.stats.cups++;
  s.best.round = Math.max(s.best.round, r.stats.rounds);
  s.best.flow = Math.max(s.best.flow, r.stats.best);
  s.best.goals = Math.max(s.best.goals, r.stats.goals);
}

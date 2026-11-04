// Fluffball Smash! engine: arcade tennis with over-the-top special moves, singles and doubles, Dora and Enzo against six
// original rivals. Deterministic at a fixed 120 Hz: every random choice comes from a seeded generator, so a seed and the
// same inputs replay a match exactly. No DOM; the page draws it (lib/smash-scene.ts) and the tests drive it directly.
//
// Coordinates are metres on a real-size court: x across (the near player's right is +x), y along the court (the near
// baseline is y = -11.885, the net is y = 0), z up. Side 0 is the near team (the player's), side 1 the far team.

export const DT = 1 / 120;
export const G = 9.81;
export const COURT = { half: 11.885, single: 4.115, double: 5.485, service: 6.4, net: 0.95 };
const LINE = 0.04;

// ---------------------------------------------------------------- random
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const sgn = (v: number) => (v < 0 ? -1 : 1);

// ---------------------------------------------------------------- characters
export type CharId = 'dora' | 'enzo' | 'bramble' | 'sable' | 'sorrel' | 'gale' | 'marlow' | 'fern' | 'ember' | 'isolde';
export type SpecialId = 'meteor' | 'phantom' | 'twin' | 'drop' | 'mirror' | 'squall' | 'fortress' | 'phoenix' | 'zero';
export type CharDef = {
  id: CharId; name: string; animal: string;
  /** top running speed, m/s */ speed: number;
  /** shot speed multiplier */ power: number;
  /** 0..1: how close to the lines they can aim and how little their shots scatter */ control: number;
  /** how far they reach for the ball, m */ reach: number;
  special: SpecialId; blurb: string;
};
export const CHARS: Record<CharId, CharDef> = {
  dora: { id: 'dora', name: 'Dora', animal: 'chinchilla', speed: 4.9, power: 1.08, control: 0.6, reach: 1.5, special: 'meteor', blurb: 'All power. Hits hard and leaps high.' },
  enzo: { id: 'enzo', name: 'Enzo', animal: 'chinchilla', speed: 4.6, power: 0.96, control: 0.82, reach: 1.55, special: 'phantom', blurb: 'All brains. Puts the ball on the line.' },
  bramble: { id: 'bramble', name: 'Bramble', animal: 'hare', speed: 5.4, power: 0.9, control: 0.55, reach: 1.5, special: 'drop', blurb: 'Quick feet and sneaky drop shots.' },
  sable: { id: 'sable', name: 'Sable', animal: 'ferret', speed: 5.0, power: 0.95, control: 0.65, reach: 1.45, special: 'mirror', blurb: 'The right-handed twin. Smiles a lot.' },
  sorrel: { id: 'sorrel', name: 'Sorrel', animal: 'ferret', speed: 5.0, power: 0.95, control: 0.65, reach: 1.45, special: 'mirror', blurb: 'The left-handed twin. Smirks a lot.' },
  gale: { id: 'gale', name: 'Captain Gale', animal: 'puffin', speed: 4.4, power: 1.05, control: 0.65, reach: 1.5, special: 'squall', blurb: 'An old sea captain with a serve like a storm.' },
  marlow: { id: 'marlow', name: 'Marlow', animal: 'tortoise', speed: 4.0, power: 0.88, control: 0.85, reach: 1.6, special: 'fortress', blurb: 'Slow, wise and very hard to get past.' },
  fern: { id: 'fern', name: 'Fern', animal: 'tortoise', speed: 4.0, power: 0.88, control: 0.85, reach: 1.6, special: 'fortress', blurb: 'Marlow\'s partner of sixty summers.' },
  ember: { id: 'ember', name: 'Ember', animal: 'red panda', speed: 5.0, power: 1.14, control: 0.6, reach: 1.5, special: 'phoenix', blurb: 'Hot-headed. Hits everything as hard as she can.' },
  isolde: { id: 'isolde', name: 'Isolde', animal: 'snow leopard', speed: 5.1, power: 1.1, control: 0.86, reach: 1.6, special: 'zero', blurb: 'The champion. Cool, precise and never in a hurry.' },
};
export type SpecialDef = { id: SpecialId; name: string; who: string; line: string;
  /** a heavy ball knocks back anyone who meets it without a charged swing or a counter */ heavy: boolean };
export const SPECIALS: Record<SpecialId, SpecialDef> = {
  meteor: { id: 'meteor', name: 'Moonleap Meteor', who: 'dora', heavy: true, line: 'Dora leaps sky-high and smashes a burning comet that kicks sideways off the bounce.' },
  phantom: { id: 'phantom', name: 'Phantom Page', who: 'enzo', heavy: false, line: 'Enzo\'s ball splits into three. Only one is real, and it lands on the line.' },
  twin: { id: 'twin', name: 'Twin Comet', who: 'dora+enzo', heavy: true, line: 'Dora and Enzo hit together: two comets spiral round each other across the net.' },
  drop: { id: 'drop', name: 'Hundred-Step Drop', who: 'bramble', heavy: false, line: 'A drop shot with so much backspin it hops back towards the net.' },
  mirror: { id: 'mirror', name: 'Mirror Volley', who: 'sable+sorrel', heavy: true, line: 'The twins bat the ball between them, then send it zigzagging through.' },
  squall: { id: 'squall', name: 'Squall Serve', who: 'gale', heavy: false, line: 'The ball rides the storm in a great S-bend.' },
  fortress: { id: 'fortress', name: 'Shell Fortress', who: 'marlow+fern', heavy: false, line: 'A shield of light: for the rest of the point the tortoises reach everything.' },
  phoenix: { id: 'phoenix', name: 'Phoenix Blaze', who: 'ember', heavy: true, line: 'A fireball shaped like a bird, faster still after it bounces.' },
  zero: { id: 'zero', name: 'Absolute Zero', who: 'isolde', heavy: true, line: 'The ball skids flat off a frozen court, and the frost slows your feet.' },
};
export const SPECIAL_COST = 100, COUNTER_COST = 50;

// ---------------------------------------------------------------- AI
export type Ai = {
  /** seconds before they start to move after the other side hits */ react: number;
  /** spread of their shots, m */ error: number;
  /** 0..1: how near the lines they aim */ aim: number;
  /** how early they ready a swing, s (earlier is a harder hit) */ charge: number;
  /** 0..1: how often they come in to the net */ net: number;
  lob: number; drop: number; slice: number;
  /** 0..1: chance to see through a Phantom Page */ read: number;
  /** chance to use a special when the meter is full */ special: number;
  /** chance to counter a special */ counter: number;
  /** running speed multiplier */ speed: number;
};
/** A competent player: what the tests call the bot, and what drives your partner and the demo. */
export const BOT: Ai = { react: 0.16, error: 0.55, aim: 0.8, charge: 0.6, net: 0.2, lob: 0.06, drop: 0.04, slice: 0.2, read: 0.5, special: 0.6, counter: 0.6, speed: 1 };

// ---------------------------------------------------------------- venues
export type VenueId = 'meadow' | 'river' | 'seaside' | 'temple' | 'night' | 'sky';
export type Surface = 'grass' | 'clay' | 'hard';
export type VenueDef = { id: VenueId; name: string; surface: Surface; wind: number; blurb: string };
export const VENUES: Record<VenueId, VenueDef> = {
  meadow: { id: 'meadow', name: 'Meadow Court', surface: 'grass', wind: 0, blurb: 'Grass in the morning sun. Low, fast bounces.' },
  river: { id: 'river', name: 'Riverside Clay', surface: 'clay', wind: 0, blurb: 'Red clay by the river. Slow, high bounces.' },
  seaside: { id: 'seaside', name: 'Harbour Court', surface: 'hard', wind: 0.9, blurb: 'A hard court on the harbour wall. Mind the wind.' },
  temple: { id: 'temple', name: 'Lantern Garden', surface: 'clay', wind: 0, blurb: 'A clay court in a temple garden at dusk.' },
  night: { id: 'night', name: 'Ember Arena', surface: 'hard', wind: 0, blurb: 'Floodlights and red lanterns. A fast hard court.' },
  sky: { id: 'sky', name: 'Cloudtop Court', surface: 'hard', wind: 0, blurb: 'A court above the clouds, where the final is played.' },
};
/** bounce: how high it comes up; skid: how much pace it keeps */
const SURFACE: Record<Surface, { bounce: number; skid: number }> = { grass: { bounce: 0.86, skid: 0.95 }, clay: { bounce: 1.08, skid: 0.8 }, hard: { bounce: 1, skid: 0.88 } };

// ---------------------------------------------------------------- input
export type Input = { x: number; y: number; top: boolean; slice: boolean; lob: boolean; special: boolean };
export const idleInput = (): Input => ({ x: 0, y: 0, top: false, slice: false, lob: false, special: false });
export type ShotKind = 'top' | 'slice' | 'lob' | 'drop' | 'smash';

// ---------------------------------------------------------------- the ball
export type Ball = {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number;
  /** side that hit it last, -1 before the serve */ by: number; slot: number;
  bounces: number; lastBounceSide: number; serve: boolean; net: boolean;
  special: SpecialId | null; age: number; flight: number;
  /** a sideways weave that is zero at both ends of the flight, so the ball still lands on its target */
  curveA: number; curveN: number;
  /** Phantom Page: offsets of the two fake balls at the landing */
  decoys: number[];
  /** after the bounce: Moonleap's sideways kick, Hundred-Step's hop back, Absolute Zero's skid, Phoenix's speed */
  kick: number;
};
const newBall = (): Ball => ({ x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, spin: 0, by: -1, slot: 0, bounces: 0, lastBounceSide: -1, serve: false, net: false, special: null, age: 0, flight: 1, curveA: 0, curveN: 2, decoys: [], kick: 0 });
const curveOff = (b: Ball, age: number) => (b.curveA && age < b.flight ? b.curveA * Math.sin((Math.PI * b.curveN * age) / b.flight) : 0);
const sideOf = (y: number) => (y < 0 ? 0 : 1);

export type BallStep = { bounced: boolean; netHit: boolean };
/** One physics step: gravity (stronger with topspin, weaker with slice), the weave, wind, the net and the bounce. */
export function stepBall(b: Ball, surf: Surface, wind: number, t: number): BallStep {
  const out: BallStep = { bounced: false, netHit: false };
  const g = G * (1 + 0.38 * b.spin), y0 = b.y, x0 = b.x;
  const off0 = curveOff(b, b.age);
  b.age += DT;
  b.x += b.vx * DT + curveOff(b, b.age) - off0;
  if (wind) b.vx += wind * Math.sin(t * 0.7) * DT;
  b.y += b.vy * DT;
  b.z += b.vz * DT - 0.5 * g * DT * DT; b.vz -= g * DT;
  // the net: a ball crossing below the tape stops dead and drops; one that clips the tape pops over, slower
  if (sgn(y0) !== sgn(b.y) && Math.abs(b.x) < COURT.double + 0.9) {
    const k = Math.abs(y0) / (Math.abs(y0) + Math.abs(b.y)), zc = b.z, xc = x0 + (b.x - x0) * k;
    if (zc < COURT.net - 0.07 && Math.abs(xc) < COURT.double + 0.9) {
      b.y = y0 > 0 ? 0.06 : -0.06; b.vy = -b.vy * 0.12; b.vx *= 0.3; b.vz = Math.min(b.vz, 0) * 0.3; b.curveA = 0; b.net = true; out.netHit = true;
    } else if (zc < COURT.net + 0.03) { b.vy *= 0.4; b.vx *= 0.6; b.vz = Math.abs(b.vz) * 0.4 + 1.2; b.curveA = 0; b.net = true; out.netHit = true; }
  }
  if (b.z <= 0 && b.vz < 0) {
    const s = SURFACE[surf], spin = b.spin;
    b.z = 0; b.vz = -b.vz * clamp(0.74 + 0.06 * spin, 0.4, 0.85) * s.bounce;
    const h = s.skid * (spin >= 0 ? 0.9 + 0.06 * spin : 0.86 + 0.12 * spin);
    b.vx *= h; b.vy *= h; b.spin *= 0.4;
    // the weave ends at the bounce
    b.curveA = 0;
    if (b.bounces === 0 && b.special) {
      if (b.special === 'meteor' || b.special === 'twin') b.vx += b.kick;
      else if (b.special === 'drop') { b.vy = -sgn(b.vy) * 2.6; b.vz *= 0.7; }
      else if (b.special === 'zero') { b.vz *= 0.28; b.vx *= 1.1; b.vy *= 1.1; }
      else if (b.special === 'phoenix') { b.vx *= 1.18; b.vy *= 1.18; b.vz *= 0.85; }
    }
    if (Math.abs(b.vz) < 0.4) b.vz = 0;
    out.bounced = true;
  }
  return out;
}

// ---------------------------------------------------------------- players
export type Player = {
  char: CharDef; side: 0 | 1; slot: 0 | 1; human: boolean; ai: Ai;
  x: number; y: number; vx: number; vy: number;
  /** a readied swing: what kind, when it was pressed, and whether it is a special */
  ready: { kind: ShotKind; t: number; special: boolean } | null;
  /** seconds since the last swing started, for the animation; big while idle */
  swing: number; swingKind: ShotKind;
  /** knocked back by a heavy special */ stun: number;
  /** a leap, for the animation */ jump: number;
  /** slowed by Absolute Zero's frost */ frost: number;
  /** wants to counter the incoming special */ counter: boolean;
  /** where and when they mean to meet the ball; ok is false when they can't get there in time */
  plan: { x: number; y: number; t: number; z: number; decoy: boolean; ok: boolean } | null;
  lastDist: number;
};
const makePlayer = (id: CharId, side: 0 | 1, slot: 0 | 1, human: boolean, ai: Ai): Player => ({
  char: CHARS[id], side, slot, human, ai, x: 0, y: 0, vx: 0, vy: 0, ready: null, swing: 9, swingKind: 'top', stun: 0, jump: 0, frost: 0, counter: false, plan: null, lastDist: 99,
});

// ---------------------------------------------------------------- events
export type PointWhy = 'ace' | 'winner' | 'out' | 'net' | 'double' | 'blown';
export type MatchEvent =
  | { k: 'toss'; side: number }
  | { k: 'hit'; side: number; slot: number; kind: ShotKind; power: number; serve: boolean }
  | { k: 'bounce'; x: number; y: number; z: number; in: boolean; special: SpecialId | null }
  | { k: 'net' }
  | { k: 'fault'; double: boolean }
  | { k: 'let' }
  | { k: 'special'; side: number; slot: number; id: SpecialId }
  | { k: 'counter'; side: number; slot: number; against: SpecialId }
  | { k: 'held'; side: number; slot: number }
  | { k: 'blown'; side: number; slot: number }
  | { k: 'ready'; side: number }
  | { k: 'point'; winner: number; why: PointWhy }
  | { k: 'game'; winner: number }
  | { k: 'match'; winner: number };

// ---------------------------------------------------------------- the match
export type MatchOpts = {
  /** the near team: home[0] is the one you control */ home: CharId[];
  away: CharId[]; venue: VenueId;
  /** games to win (win by two, or the game after N-all) */ games: number;
  /** the rival's AI */ ai: Ai;
  seed?: number;
  /** drive your player with this AI (tests, the demo) */ autopilot?: Ai | null;
  /** footwork assist: run to the ball by yourself unless you steer */ assist?: boolean;
  /** 0 easy, 1 normal, 2 hard: scales the rival */ difficulty?: number;
};
export type Phase = 'serve' | 'toss' | 'rally' | 'point' | 'over';
const POINT_PAUSE = 1.7, SERVE_WAIT = 0.9, READY_LIFE = 1.4, CHARGE_FULL = 0.9;
/** how fast you can move while charging a swing, as a fraction of your top speed */
export const CHARGE_MOVE = 0.45;
/** a rally speeds up a little with every shot, up to this much */
const RALLY_SPEEDUP = 0.02, RALLY_MAX = 0.3;
/** spirit: per shot, per lost and won point, for holding a heavy special */
export const SPIRIT = { hit: 2, hitQ: 3, lost: 10, won: 4, held: 8, serve: 2 };
const gauss = (r: () => number) => r() + r() + r() - 1.5;
export const POINT_NAMES = ['0', '15', '30', '40'];

export class Match {
  opts: MatchOpts; rand: () => number;
  t = 0; step = 0; phase: Phase = 'serve'; phaseT = 0;
  teams: Player[][] = [[], []];
  players: Player[] = [];
  ball: Ball = newBall();
  /** what the scene and the AI expect the ball to do: positions every 2 ticks for 3 s, at match times */
  path: { x: number; y: number; z: number; t: number; bounce: number }[] = [];
  points: [number, number] = [0, 0]; games: [number, number] = [0, 0];
  server = 0; serverSlot: [number, number] = [0, 0]; secondServe = false;
  meter: [number, number] = [0, 0];
  /** a cut-in freezes play for this long */ freeze = 0;
  /** Shell Fortress is up for this side for its next few returns */ fortress = -1; fortressLeft = 0;
  winner = -1; events: MatchEvent[] = [];
  /** per-match numbers for the result screen */
  stats = { rally: 0, longest: 0, specials: [0, 0], aces: [0, 0], winners: [0, 0], counters: [0, 0] };
  lastWhy: PointWhy | null = null;
  private prev: Input = idleInput();
  private lastHitT = 0;
  constructor(opts: MatchOpts) {
    this.opts = opts; this.rand = rng(opts.seed ?? 1);
    const d = opts.difficulty ?? 1, k = [0.72, 1, 1.18][d] ?? 1;
    const rival: Ai = { ...opts.ai, error: opts.ai.error / k, react: opts.ai.react / k, speed: opts.ai.speed * (0.94 + 0.06 * k), special: Math.min(1, opts.ai.special * k) };
    opts.home.forEach((id, i) => { const p = makePlayer(id, 0, i as 0 | 1, i === 0 && !opts.autopilot, i === 0 && opts.autopilot ? opts.autopilot : BOT); this.teams[0].push(p); });
    opts.away.forEach((id, i) => this.teams[1].push(makePlayer(id, 1, i as 0 | 1, false, rival)));
    this.players = [...this.teams[0], ...this.teams[1]];
    this.server = this.rand() < 0.5 ? 0 : 1;
    this.setupPoint();
  }
  get doubles() { return this.teams[0].length > 1 || this.teams[1].length > 1; }
  get venue() { return VENUES[this.opts.venue]; }
  get halfW() { return this.doubles ? COURT.double : COURT.single; }
  get you() { return this.teams[0][0]; }
  get over() { return this.phase === 'over'; }
  /** hand your player to an AI (the demo and the browser tests), or take it back with null */
  setAutopilot(ai: Ai | null) { const p = this.you; this.opts.autopilot = ai; p.human = !ai; p.ai = ai ?? BOT; p.ready = null; p.plan = null; }
  /** the special the side would use, from the player who hits it */
  specialFor(p: Player): SpecialId {
    const team = this.teams[p.side].map((q) => q.char.id);
    if (team.includes('dora') && team.includes('enzo')) return 'twin';
    return p.char.special;
  }
  serverPlayer() { const tm = this.teams[this.server]; return tm[this.serverSlot[this.server] % tm.length]; }
  /** +1 when serving from the deuce (right-hand) court */
  get court() { const n = this.points[0] + this.points[1]; return n % 2 === 0 ? 1 : -1; }
  scoreText(): [string, string] {
    const [a, b] = this.points;
    if (a >= 3 && b >= 3 && a === b) return ['Deuce', 'Deuce'];
    return [POINT_NAMES[Math.min(a, 3)], POINT_NAMES[Math.min(b, 3)]];
  }
  /** at deuce the next point takes the game (no advantage), which keeps matches short */
  get decidingPoint() { return this.points[0] >= 3 && this.points[1] >= 3 && this.points[0] === this.points[1]; }

  // ---------------------------------------------------------------- set-up
  private setupPoint() {
    const b = this.ball = newBall();
    this.phase = 'serve'; this.phaseT = 0; this.fortress = -1; this.fortressLeft = 0; this.path = [];
    this.stats.rally = 0;
    const s = this.server, sp = this.serverPlayer(), dir = s === 0 ? 1 : -1, c = this.court;
    for (const p of this.players) {
      const pd = p.side === 0 ? 1 : -1, base = -pd * (COURT.half + 0.6);
      p.ready = null; p.stun = 0; p.counter = false; p.plan = null; p.vx = p.vy = 0; p.frost = 0; p.jump = 0; p.lastDist = 99;
      if (p === sp) { p.x = dir * c * 1.0; p.y = -dir * (COURT.half + 0.4); continue; }
      if (p.side === s) { // the server's partner waits at the net on the other half
        p.x = -dir * c * 2.6; p.y = -dir * 4.2; continue;
      }
      // receivers: one in the court being served to, the partner at the net
      const recv = this.receiver();
      if (p === recv) { p.x = pd * c * 2.4; p.y = base; } else { p.x = -pd * c * 2.6; p.y = -pd * 4.2; }
    }
    b.x = sp.x + dir * 0.35; b.y = sp.y; b.z = 1.0; b.by = -1;
  }
  /** who receives: in doubles slot 0 takes the deuce court and slot 1 the advantage court */
  receiver() { const tm = this.teams[1 - this.server]; return tm.length > 1 ? tm[this.court > 0 ? 0 : 1] : tm[0]; }

  // ---------------------------------------------------------------- the tick
  tick(input: Input) {
    this.events.length = 0;
    if (this.phase === 'over') return;
    const pressed = { top: input.top && !this.prev.top, slice: input.slice && !this.prev.slice, lob: input.lob && !this.prev.lob, special: input.special && !this.prev.special };
    this.prev = { ...input };
    const you = this.you;
    // a counter can be called during a cut-in
    if (you.human && pressed.special && this.counterable(you)) you.counter = true;
    if (this.freeze > 0) { this.freeze -= DT; return; }
    this.t += DT; this.step++; this.phaseT += DT;
    for (const p of this.players) { p.swing += DT; p.stun = Math.max(0, p.stun - DT); p.jump = Math.max(0, p.jump - DT); p.frost = Math.max(0, p.frost - DT); }

    if (this.phase === 'serve' || this.phase === 'toss') this.serving(input, pressed);
    else if (this.phase === 'rally') this.rally(input, pressed);
    else if (this.phase === 'point') {
      this.stepBallOnly();
      this.movePlayers(input, true);
      if (this.phaseT > POINT_PAUSE) this.nextPoint();
    }
  }

  private stepBallOnly() { if (this.ball.by >= 0) stepBall(this.ball, this.venue.surface, this.venue.wind, this.t); }

  // ---------------------------------------------------------------- serving
  private serving(input: Input, pressed: { top: boolean; slice: boolean; lob: boolean; special: boolean }) {
    const sp = this.serverPlayer(), b = this.ball, dir = sp.side === 0 ? 1 : -1;
    // receivers and partners settle; the server stays put
    this.movePlayers(input, true);
    if (this.phase === 'serve') {
      b.x = sp.x + dir * 0.35; b.y = sp.y; b.z = 1.0;
      const go = sp.human ? pressed.top || pressed.slice || pressed.lob || pressed.special : this.phaseT > SERVE_WAIT;
      if (go) { this.phase = 'toss'; this.phaseT = 0; b.vz = 6.2; b.vx = b.vy = 0; this.events.push({ k: 'toss', side: sp.side }); }
      return;
    }
    // the toss: up to about 2.95 m, then down; hit it near the top
    b.z += b.vz * DT - 0.5 * G * DT * DT; b.vz -= G * DT;
    const apex = 1.0 + (6.2 * 6.2) / (2 * G);
    let hit: { kind: ShotKind; special: boolean } | null = null;
    if (sp.human) {
      if (b.z > 1.5 && (pressed.top || pressed.slice || pressed.lob || pressed.special)) hit = { kind: pressed.slice ? 'slice' : 'top', special: false };
    } else {
      // the AI swings near the top of the toss, a little early or late by its error
      if (!sp.ready) { const late = (this.rand() - 0.5) * sp.ai.error * 0.5; sp.ready = { kind: this.rand() < sp.ai.slice ? 'slice' : 'top', t: 0.62 + late, special: false }; }
      if (this.phaseT >= sp.ready.t) {
        const sq = sp.char.special === 'squall' && this.meter[sp.side] >= SPECIAL_COST && this.rand() < sp.ai.special;
        hit = { kind: sp.ready.kind, special: sq }; sp.ready = null;
      }
    }
    if (hit) { this.serve(sp, hit.kind, 1 - Math.min(1, Math.abs(b.z - apex) / 1.2), hit.special, sp.human ? input.x : (this.rand() - 0.5) * 2 * sp.ai.aim); return; }
    if (b.z < 0.9 && b.vz < 0) { this.phase = 'serve'; this.phaseT = 0; } // a dropped toss: try again
  }

  private serve(sp: Player, kind: ShotKind, q: number, special: boolean, aimX: number) {
    const b = this.ball, dir = sp.side === 0 ? 1 : -1, c = this.court;
    // the box across the court: deuce box is the receiver's right, i.e. -dir * c * x on their side
    const boxSign = -dir * c, ctl = sp.char.control;
    const along = clamp(0.5 + aimX * 0.5 * dir * boxSign, 0, 1); // 0 = by the centre line, 1 = out wide
    let tx = boxSign * (0.35 + along * (COURT.single - 0.7) * (0.75 + 0.25 * ctl));
    let ty = dir * (COURT.service - 0.9);
    const err = (1 - q) * 1.1 + (1 - ctl) * 0.5 + (sp.human ? 0.15 : sp.ai.error * 0.45);
    tx += (this.rand() - 0.5) * err; ty += (this.rand() - 0.5) * err * 1.2;
    const speed = (kind === 'slice' ? 19 : 22) * sp.char.power * (0.8 + 0.25 * q) * (this.secondServe ? 0.82 : 1);
    this.launch(sp, tx, ty, speed, kind === 'slice' ? -0.6 : 0.5, 0.18, true);
    sp.swing = 0; sp.swingKind = kind;
    this.events.push({ k: 'hit', side: sp.side, slot: sp.slot, kind, power: q, serve: true });
    if (special) this.fireSpecial(sp, 'squall', b);
    this.phase = 'rally'; this.phaseT = 0; this.stats.rally = 0;
    this.gain(sp.side, SPIRIT.serve);
  }

  /** Set the ball flying from where it is to land at (tx, ty), at this speed along the ground, clearing the net. */
  private launch(p: Player, tx: number, ty: number, speed: number, spin: number, clear: number, serve: boolean, flight = 0) {
    const b = this.ball;
    const dx = tx - b.x, dy = ty - b.y, D = Math.hypot(dx, dy);
    const g = G * (1 + 0.38 * spin);
    let T = flight || Math.max(0.35, D / speed);
    for (let i = 0; i < 60; i++) {
      const vz = (0.5 * g * T * T - b.z) / T, tn = Math.abs(b.y) / Math.max(0.1, Math.abs(dy / T));
      const zn = b.z + vz * tn - 0.5 * g * tn * tn;
      if (zn >= COURT.net + clear) break;
      T *= 1.04;
    }
    b.vx = dx / T; b.vy = dy / T; b.vz = (0.5 * g * T * T - b.z) / T; b.spin = spin;
    b.by = p.side; b.slot = p.slot; b.bounces = 0; b.lastBounceSide = -1; b.serve = serve; b.net = false;
    b.special = null; b.age = 0; b.flight = T; b.curveA = 0; b.decoys = []; b.kick = 0;
    this.lastHitT = this.t;
    for (const q of this.players) { q.plan = null; q.lastDist = 99; if (q.side !== p.side) q.counter = false; }
    this.predict();
  }

  // ---------------------------------------------------------------- the rally
  private rally(input: Input, pressed: { top: boolean; slice: boolean; lob: boolean; special: boolean }) {
    const b = this.ball, you = this.you;
    // your swing: press early for a harder hit
    if (you.human && !you.ready && you.stun <= 0) {
      const lob = pressed.lob, sl = pressed.slice, tp = pressed.top, sp = pressed.special;
      if (sp && this.counterable(you)) you.counter = true;
      else if (sp && this.meter[0] >= SPECIAL_COST) you.ready = { kind: 'top', t: this.t, special: true };
      else if (tp || sl || lob) you.ready = { kind: lob ? 'lob' : sl ? (input.y < -0.5 ? 'drop' : 'slice') : 'top', t: this.t, special: false };
    }
    for (const p of this.players) if (!p.human) this.think(p); else if (this.opts.assist) this.think(p, true);
    this.movePlayers(input, false);
    const st = stepBall(b, this.venue.surface, this.venue.wind, this.t);
    if (st.netHit) this.events.push({ k: 'net' });
    if (st.bounced) { this.bounce(); if (this.phase !== 'rally') return; }
    // a ball long gone without bouncing (it can't, but just in case) ends the point
    if (Math.abs(b.y) > COURT.half + 30 || Math.abs(b.x) > 40) { this.pointTo(1 - b.by, 'out'); return; }
    // contacts
    for (const p of this.players) {
      if (p.ready && this.t - p.ready.t > READY_LIFE && !p.human) p.ready = null;
      if (p.ready && p.human && this.t - p.ready.t > READY_LIFE) { p.ready = null; p.swing = 0; p.swingKind = 'top'; }
      if (this.canHit(p)) this.tryHit(p, input);
      if (this.phase !== 'rally') return;
    }
  }

  /** the ball is coming to this side and may be played: after one bounce on this side, or before it bounces (a volley) */
  private playable(side: number) {
    const b = this.ball;
    if (b.by < 0 || b.by === side) return false;
    if (b.bounces === 1) return b.lastBounceSide === side;
    return b.bounces === 0 && !b.serve && sideOf(b.y) === side;
  }
  private canHit(p: Player) { return this.playable(p.side) && p.stun <= 0; }
  counterable(p: Player) { return this.ball.special !== null && this.ball.by !== p.side && this.ball.by >= 0 && this.meter[p.side] >= COUNTER_COST && SPECIALS[this.ball.special].heavy; }

  private reachOf(p: Player) { return p.char.reach * (this.fortress === p.side ? 2.3 : 1); }

  private tryHit(p: Player, input: Input) {
    const b = this.ball, reach = this.reachOf(p);
    const dist = Math.hypot(b.x - p.x, b.y - p.y), high = p.jump > 0 ? 3.6 : 2.7;
    const inZone = dist <= reach && b.z >= 0.12 && b.z <= high;
    const auto = this.fortress === p.side; // the shell fortress returns everything
    if (!inZone) { p.lastDist = dist; return; }
    // meet it at the closest point, or once it is well inside the reach
    if (!(dist < reach * 0.5 || dist > p.lastDist)) { p.lastDist = dist; return; }
    p.lastDist = dist;
    if (!p.ready && !auto && !p.counter) return;
    const ready = p.ready ?? { kind: 'top' as ShotKind, t: this.t - 0.5, special: false };
    if (auto && !p.ready && --this.fortressLeft <= 0) this.fortress = -1;
    const charge = Math.min(1, (this.t - ready.t) / CHARGE_FULL);
    let q = 0.25 + 0.75 * Math.pow(charge, 0.7);
    // a heavy special: hold it with a charged swing or a counter, or be blown away
    if (b.special && SPECIALS[b.special].heavy) {
      if (p.counter && this.meter[p.side] >= COUNTER_COST) {
        this.meter[p.side] -= COUNTER_COST; this.stats.counters[p.side]++;
        this.events.push({ k: 'counter', side: p.side, slot: p.slot, against: b.special }); this.freeze = 0.9; q = 0.85;
      } else if (charge >= 0.55 || auto) { q = Math.min(q, 0.45); this.events.push({ k: 'held', side: p.side, slot: p.slot }); this.gain(p.side, SPIRIT.held); }
      else {
        p.stun = 1.3; p.ready = null; p.swing = 0;
        b.vx += (this.rand() - 0.5) * 6; b.vz = Math.abs(b.vz) * 0.5 + 2; b.vy *= 0.75;
        this.events.push({ k: 'blown', side: p.side, slot: p.slot }); this.lastWhy = 'blown';
        return;
      }
    }
    p.counter = false;
    let kind = ready.kind;
    if (b.z > 2.25 && (kind === 'top' || kind === 'slice')) kind = 'smash';
    const special = ready.special && this.meter[p.side] >= SPECIAL_COST;
    this.shoot(p, kind, q, special, p.human ? input : this.aiAim(p, kind));
    p.ready = null;
  }

  /** Hit the ball: pick a target from the aim, scatter it by the timing and the player's control, and send it. */
  private shoot(p: Player, kind: ShotKind, q: number, special: boolean, aim: { x: number; y: number }) {
    const b = this.ball, dir = p.side === 0 ? 1 : -1, ctl = p.char.control, W = this.halfW;
    // hitting on the run, or at full stretch, costs pace and accuracy
    const run = Math.min(1, Math.hypot(p.vx, p.vy) / p.char.speed), reach = Math.min(1, Math.hypot(b.x - p.x, b.y - p.y) / this.reachOf(p));
    q *= 1 - 0.3 * run;
    const margin = 0.3 + (1 - ctl) * 0.3;
    let tx = clamp(aim.x) * (W - margin) * dir;
    if (Math.abs(aim.x) < 0.15) tx = clamp(-p.x * 0.35, -W + 1, W - 1);
    let depth = kind === 'lob' ? 9.6 : kind === 'drop' ? 2.6 : kind === 'smash' ? 7.6 : kind === 'slice' ? 8.4 : 9.0;
    if (kind !== 'drop') depth += clamp(aim.y) > 0.5 ? 1.2 : clamp(aim.y) < -0.5 ? -3.2 : 0;
    let ty = dir * Math.min(COURT.half - 0.35, depth);
    const err = ((1.05 - q) * (1.25 - ctl) * 1.2 + (p.human ? 0.2 : p.ai.error)) * (1 + 0.9 * run + 0.6 * reach) * (kind === 'drop' ? 0.6 : 1);
    tx += gauss(this.rand) * err; ty += gauss(this.rand) * err;
    const pow = p.char.power * (1 + Math.min(RALLY_MAX, this.stats.rally * RALLY_SPEEDUP));
    const speed = kind === 'smash' ? 29 * pow : kind === 'top' ? (16 + 12 * q) * pow : kind === 'slice' ? (13 + 7 * q) * pow : kind === 'drop' ? 9 : 14;
    const spin = kind === 'top' ? 0.9 : kind === 'slice' ? -0.7 : kind === 'drop' ? -1 : kind === 'lob' ? 0.3 : 0.1;
    const clear = kind === 'smash' ? 0.05 : kind === 'top' ? 0.45 : kind === 'drop' ? 0.12 : 0.25;
    if (special) { this.special(p, aim); return; }
    this.launch(p, tx, ty, speed, spin, clear, false, kind === 'lob' ? 1.75 - 0.2 * q : 0);
    p.swing = 0; p.swingKind = kind; if (kind === 'smash') p.jump = 0.5;
    this.stats.rally++; this.stats.longest = Math.max(this.stats.longest, this.stats.rally);
    this.events.push({ k: 'hit', side: p.side, slot: p.slot, kind, power: q, serve: false });
    this.gain(p.side, SPIRIT.hit + SPIRIT.hitQ * q);
  }

  /** The special moves. Each sends the ball somewhere nasty, and the cut-in freezes play while it shows. */
  private special(p: Player, aim: { x: number; y: number }) {
    const b = this.ball, dir = p.side === 0 ? 1 : -1, W = this.halfW, id = this.specialFor(p);
    const opp = this.teams[1 - p.side];
    // aim for the open court: away from the nearest opponent
    const far = opp.reduce((a, o) => a + o.x, 0) / opp.length;
    const sideX = Math.abs(aim.x) > 0.15 ? sgn(aim.x) * dir : -sgn(far || 1);
    const deep = dir * (COURT.half - 1.4);
    this.meter[p.side] -= SPECIAL_COST; this.stats.specials[p.side]++;
    switch (id) {
      case 'meteor': this.launch(p, sideX * (W - 1.6), dir * 7.5, 30 * p.char.power, 0, 0.05, false); b.kick = sideX * 6.5; p.jump = 1.2; break;
      case 'twin': this.launch(p, sideX * (W - 1.8), deep, 27, 0.2, 0.3, false); b.curveA = 2.4; b.curveN = 2; b.kick = sideX * 5; break;
      case 'phantom': {
        this.launch(p, sideX * (W - 0.3), dir * (COURT.half - 0.45), 21, 0.6, 0.35, false);
        b.decoys = [-sideX * 3.2, -sideX * 6.0]; break;
      }
      case 'drop': this.launch(p, sideX * (W - 1.5), dir * 1.9, 9, -1, 0.12, false); break;
      case 'mirror': this.launch(p, sideX * (W - 1.6), deep, 26, 0.2, 0.3, false); b.curveA = 1.8; b.curveN = 3; break;
      case 'squall': this.launch(p, sideX * (W - 1.4), deep, 24, 0.2, 0.3, false); b.curveA = 3; b.curveN = 2; break;
      case 'fortress': this.launch(p, 0, deep, 14, 0.3, 0.4, false, 1.5); this.fortress = p.side; this.fortressLeft = 2; break;
      case 'phoenix': this.launch(p, sideX * (W - 1.5), deep, 31 * p.char.power, 0.3, 0.12, false); break;
      case 'zero': this.launch(p, sideX * (W - 1.3), dir * (COURT.half - 2.4), 25, 0, 0.2, false); for (const o of opp) o.frost = 4; break;
    }
    if (b.special === null) b.special = id;
    this.predict();
    p.swing = 0; p.swingKind = id === 'meteor' ? 'smash' : 'top';
    this.stats.rally++;
    this.freeze = 1.25;
    this.events.push({ k: 'special', side: p.side, slot: p.slot, id });
    this.events.push({ k: 'hit', side: p.side, slot: p.slot, kind: 'top', power: 1, serve: false });
  }
  private fireSpecial(sp: Player, id: SpecialId, b: Ball) {
    this.meter[sp.side] -= SPECIAL_COST; this.stats.specials[sp.side]++;
    b.special = id; b.curveA = 3; b.curveN = 2;
    this.predict(); this.freeze = 1.25;
    this.events.push({ k: 'special', side: sp.side, slot: sp.slot, id });
  }

  private gain(side: number, n: number) {
    const was = this.meter[side];
    this.meter[side] = Math.min(SPECIAL_COST, this.meter[side] + n);
    if (was < SPECIAL_COST && this.meter[side] >= SPECIAL_COST) this.events.push({ k: 'ready', side });
  }

  // ---------------------------------------------------------------- bounces and points
  private bounce() {
    const b = this.ball, side = sideOf(b.y);
    b.bounces++;
    const first = b.bounces === 1;
    if (first) {
      b.lastBounceSide = side;
      const W = this.halfW;
      let inside = side !== b.by && Math.abs(b.x) <= W + LINE && Math.abs(b.y) <= COURT.half + LINE;
      if (b.serve) {
        const dir = b.by === 0 ? 1 : -1, boxSign = -dir * this.court;
        inside = side !== b.by && Math.abs(b.y) <= COURT.service + LINE && b.x * boxSign >= -LINE && Math.abs(b.x) <= COURT.single + LINE;
      }
      this.events.push({ k: 'bounce', x: b.x, y: b.y, z: 0, in: inside, special: b.special });
      if (b.serve && b.net && inside) { this.events.push({ k: 'let' }); this.phase = 'point'; this.phaseT = POINT_PAUSE - 0.8; this.letPending = true; return; }
      if (!inside) {
        if (b.serve) { this.fault(); return; }
        this.pointTo(1 - b.by, side === b.by ? 'net' : 'out'); return;
      }
      this.predict();
      return;
    }
    this.events.push({ k: 'bounce', x: b.x, y: b.y, z: 0, in: true, special: null });
    if (b.bounces === 2) {
      const ace = b.serve;
      this.pointTo(b.by, this.lastWhy === 'blown' ? 'blown' : ace ? 'ace' : 'winner');
    }
  }
  private letPending = false;
  private fault() {
    this.events.push({ k: 'fault', double: this.secondServe });
    if (this.secondServe) { this.pointTo(1 - this.server, 'double'); return; }
    this.secondServe = true; this.phase = 'point'; this.phaseT = POINT_PAUSE - 0.9; this.faultPending = true;
  }
  private faultPending = false;

  private pointTo(w: number, why: PointWhy) {
    this.lastWhy = null;
    this.events.push({ k: 'point', winner: w, why });
    if (why === 'ace') this.stats.aces[w]++;
    if (why === 'winner' || why === 'ace' || why === 'blown') this.stats.winners[w]++;
    this.points[w]++;
    this.gain(1 - w, SPIRIT.lost); this.gain(w, SPIRIT.won);
    this.phase = 'point'; this.phaseT = 0; this.pendingPoint = true;
    const [a, bb] = this.points;
    // no advantage: at 3-3 (deuce) the next point wins; otherwise four points and two clear
    const won = (a >= 4 || bb >= 4) && (Math.abs(a - bb) >= 2 || a + bb >= 7);
    if (won) {
      this.games[w]++; this.points = [0, 0];
      this.events.push({ k: 'game', winner: w });
      const N = this.opts.games, g0 = this.games[w], g1 = this.games[1 - w];
      if ((g0 >= N && g0 - g1 >= 2) || g0 >= N + 1) { this.winner = w; this.events.push({ k: 'match', winner: w }); this.matchPending = true; }
      else { this.serverSlot[this.server]++; this.server = 1 - this.server; }
    }
  }
  private pendingPoint = false; private matchPending = false;
  private nextPoint() {
    if (this.matchPending) { this.phase = 'over'; return; }
    if (this.letPending || this.faultPending) { this.letPending = false; this.faultPending = false; this.setupPoint(); return; }
    this.pendingPoint = false; this.secondServe = false;
    this.setupPoint();
  }

  // ---------------------------------------------------------------- prediction
  /** Run the ball forward without the rules, so the AI (and the scene's landing marker) knows where it is going. */
  predict() {
    const b: Ball = { ...this.ball, decoys: [] }, out: Match['path'] = [];
    let t = this.t, bounces = b.bounces;
    for (let i = 0; i < 360; i++) {
      const st = stepBall(b, this.venue.surface, this.venue.wind, t); t += DT;
      if (st.bounced) bounces++;
      if (i % 2 === 1) out.push({ x: b.x, y: b.y, z: b.z, t, bounce: bounces });
      if (bounces >= 2) break;
    }
    this.path = out;
  }

  // ---------------------------------------------------------------- the AI
  private think(p: Player, planOnly = false) {
    const b = this.ball;
    if (this.phase !== 'rally') return;
    const coming = this.playable(p.side) || (b.by >= 0 && b.by !== p.side && b.bounces === 0);
    if (!coming) { p.plan = null; return; }
    if (this.t - this.lastHitT < p.ai.react) return;
    if (!p.plan) {
      p.plan = this.intercept(p);
      // doubles: only the teammate who gets there first goes for it
      const mate = this.teams[p.side].find((q) => q !== p);
      if (p.plan && mate && !mate.human) {
        const m = mate.plan ?? this.intercept(mate);
        const mateFirst = m && (m.ok && !p.plan.ok || (m.ok === p.plan.ok && (m.t < p.plan.t || (m.t === p.plan.t && mate.slot < p.slot))));
        if (mateFirst) { p.plan = null; mate.plan = m; } else mate.plan = null;
      }
    }
    // ready the swing a little before the ball arrives: earlier for a harder hit
    if (planOnly) return;
    if (p.plan && !p.ready && p.stun <= 0) {
      const due = p.plan.t;
      const lead = clamp(p.ai.charge + (this.rand() - 0.5) * 0.25, 0.08, 1.2);
      const there = Math.hypot(p.plan.x - p.x, p.plan.y - p.y) < 1.3;
      if (this.t >= due - lead && (there || this.t >= due - 0.12)) {
        if (this.counterable(p) && this.rand() < p.ai.counter) p.counter = true;
        const kind = this.aiKind(p);
        const sp = this.meter[p.side] >= SPECIAL_COST && this.rand() < p.ai.special * 0.5;
        p.ready = { kind, t: this.t, special: sp };
      }
    }
  }
  /** The earliest point on the ball's path this player can get to in time, at a comfortable height. */
  private intercept(p: Player): Player['plan'] {
    const b = this.ball, sp = p.char.speed * p.ai.speed * (p.frost > 0 ? 0.55 : 1);
    const reach = this.reachOf(p) * 0.6;
    // a Phantom Page fools the AI that doesn't read it into chasing a fake for the first part of the flight
    const fooled = b.decoys.length > 0 && b.by !== p.side && this.rand() > p.ai.read;
    const fake = fooled ? b.decoys[this.rand() < 0.5 ? 0 : 1] : 0;
    const volley = Math.abs(p.y) < 6.5;
    let best: Player['plan'] = null;
    for (const s of this.path) {
      if (s.t < this.t - 0.02) continue;
      const own = sideOf(s.y) === p.side;
      if (!own) continue;
      const okBounce = s.bounce === 1 || (s.bounce === 0 && volley && !b.serve);
      if (!okBounce || s.z < 0.35 || s.z > 2.4) continue;
      const tx = s.x + fake * Math.min(1, s.t / Math.max(0.3, b.flight)) * 0.9, ty = s.y;
      const run = Math.max(0, Math.hypot(tx - p.x, ty - p.y) - reach) / sp;
      if (run <= s.t - this.t + 0.05) { best = { x: tx, y: ty, t: s.t, z: s.z, decoy: !!fake, ok: true }; break; }
    }
    if (!best) {
      // can't make it in time: run for the bounce anyway
      const s = this.path.find((q) => q.bounce >= 1 && sideOf(q.y) === p.side) ?? this.path[this.path.length - 1];
      if (s) best = { x: s.x, y: s.y, t: s.t, z: s.z, decoy: false, ok: false };
    }
    return best;
  }
  private aiKind(p: Player): ShotKind {
    const opp = this.teams[1 - p.side], r = this.rand();
    const oppAtNet = opp.some((o) => Math.abs(o.y) < 5), oppDeep = opp.every((o) => Math.abs(o.y) > COURT.half - 1);
    if (oppAtNet && r < p.ai.lob * 3) return 'lob';
    if (oppDeep && r < p.ai.drop) return 'drop';
    if (r < p.ai.lob) return 'lob';
    if (this.rand() < p.ai.slice) return 'slice';
    return 'top';
  }
  /** aim for the side away from the opponents, as near the line as this AI dares */
  private aiAim(p: Player, kind: ShotKind): { x: number; y: number } {
    const opp = this.teams[1 - p.side], dir = p.side === 0 ? 1 : -1;
    const ox = opp.reduce((a, o) => a + o.x, 0) / opp.length;
    const away = -sgn(ox * dir + (this.rand() - 0.5) * 1.5);
    const x = away * clamp(p.ai.aim * (0.7 + this.rand() * 0.5), 0, 1);
    return { x, y: kind === 'top' && this.rand() < 0.12 ? -1 : this.rand() < p.ai.aim * 0.5 ? 1 : 0 };
  }

  // ---------------------------------------------------------------- running
  private movePlayers(input: Input, setup: boolean) {
    for (const p of this.players) {
      let gx = p.x, gy = p.y, manual = false;
      const dir = p.side === 0 ? 1 : -1, sp = p.char.speed * (p.human ? 1 : p.ai.speed) * (p.frost > 0 ? 0.55 : 1);
      if (p.human && (Math.abs(input.x) > 0.15 || Math.abs(input.y) > 0.15)) manual = true;
      if (setup) {
        if (this.phase === 'serve' || this.phase === 'toss') { if (p === this.serverPlayer()) { p.vx = p.vy = 0; continue; } }
        else { [gx, gy] = this.home(p); }
        if (p.human && !manual && this.phase !== 'point') { p.vx = p.vy = 0; continue; }
      } else if (p.plan && !(p.human && manual)) {
        // stand beside the ball, not under it
        gx = p.plan.x - dir * 0.55; gy = p.plan.y - dir * 0.25;
        if (p.human && !this.opts.assist && !this.opts.autopilot) { gx = p.x; gy = p.y; }
      } else if (!manual && (!p.human || this.opts.assist || this.opts.autopilot)) [gx, gy] = this.home(p);
      else if (!manual) { gx = p.x; gy = p.y; }
      let ax: number, ay: number;
      if (manual) { ax = input.x * sp * dir; ay = input.y * sp * dir; }
      else { const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy), v = Math.min(sp, d * 6); ax = d > 0.02 ? (dx / d) * v : 0; ay = d > 0.02 ? (dy / d) * v : 0; }
      if (p.stun > 0) { ax = 0; ay = 0; }
      // a readied swing is a planted stance: you can only shuffle while you charge
      if (p.ready && !setup) { const v = Math.hypot(ax, ay), cap = sp * CHARGE_MOVE; if (v > cap) { ax *= cap / v; ay *= cap / v; } }
      const acc = (p.frost > 0 ? 7 : 22) * DT;
      p.vx += clamp(ax - p.vx, -acc, acc); p.vy += clamp(ay - p.vy, -acc, acc);
      p.x += p.vx * DT; p.y += p.vy * DT;
      // your own half, and not too far outside the court
      const W = this.halfW + 3;
      p.x = clamp(p.x, -W, W);
      p.y = p.side === 0 ? clamp(p.y, -COURT.half - 5, -0.6) : clamp(p.y, 0.6, COURT.half + 5);
    }
  }
  /** where a player waits between shots */
  home(p: Player): [number, number] {
    const dir = p.side === 0 ? 1 : -1, b = this.ball, mates = this.teams[p.side];
    const atNet = p.ai.net > 0.5 || (mates.length > 1 && p.slot === 1);
    const y = -dir * (atNet ? 4.6 : COURT.half + 0.5);
    let x = clamp(b.x * 0.35, -2, 2);
    if (mates.length > 1) x = (p.slot === 0 ? -1 : 1) * dir * 2.4 + clamp(b.x * 0.2, -1, 1);
    return [x, y];
  }
}

// ---------------------------------------------------------------- opponents and the story
export type OppId = 'bramble' | 'twins' | 'gale' | 'tortoises' | 'ember' | 'isolde' | 'final';
export type OppDef = { id: OppId; name: string; chars: CharId[]; venue: VenueId; games: number; ai: Ai; art: string; taunt: string; blurb: string };
export const OPPS: OppDef[] = [
  { id: 'bramble', name: 'Bramble', chars: ['bramble'], venue: 'meadow', games: 2, art: 'bramble', taunt: 'Catch me if you can, fluffballs!', blurb: 'A cheeky hare who never stops running.',
    ai: { react: 0.3, error: 0.6, aim: 0.65, charge: 0.35, net: 0.3, lob: 0.05, drop: 0.2, slice: 0.3, read: 0.2, special: 0.5, counter: 0.2, speed: 0.9 } },
  { id: 'twins', name: 'Sable & Sorrel', chars: ['sable', 'sorrel'], venue: 'river', games: 3, art: 'twins', taunt: 'Two of us. Two of you. But we think alike.', blurb: 'Twin ferrets who play like one mirror image.',
    ai: { react: 0.24, error: 1.25, aim: 0.7, charge: 0.4, net: 0.5, lob: 0.06, drop: 0.08, slice: 0.25, read: 0.35, special: 0.6, counter: 0.3, speed: 0.92 } },
  { id: 'gale', name: 'Captain Gale', chars: ['gale'], venue: 'seaside', games: 3, art: 'gale', taunt: 'Forty years at sea. A little breeze won\'t trouble me.', blurb: 'An old puffin captain who serves like a storm.',
    ai: { react: 0.22, error: 0.85, aim: 0.75, charge: 0.5, net: 0.15, lob: 0.04, drop: 0.05, slice: 0.2, read: 0.4, special: 0.7, counter: 0.4, speed: 0.95 } },
  { id: 'tortoises', name: 'Marlow & Fern', chars: ['marlow', 'fern'], venue: 'temple', games: 3, art: 'tortoises', taunt: 'Patience, little ones. Every ball comes back.', blurb: 'An elderly tortoise pair who return everything.',
    ai: { react: 0.12, error: 1.1, aim: 0.7, charge: 0.45, net: 0.4, lob: 0.12, drop: 0.08, slice: 0.4, read: 0.6, special: 0.7, counter: 0.5, speed: 1 } },
  { id: 'ember', name: 'Ember', chars: ['ember'], venue: 'night', games: 3, art: 'ember', taunt: 'Hope you brought oven gloves!', blurb: 'A fiery red panda who hits everything flat out.',
    ai: { react: 0.17, error: 0.7, aim: 0.85, charge: 0.7, net: 0.25, lob: 0.03, drop: 0.03, slice: 0.12, read: 0.5, special: 0.8, counter: 0.6, speed: 1 } },
  { id: 'isolde', name: 'Isolde', chars: ['isolde'], venue: 'sky', games: 3, art: 'isolde', taunt: 'You have heart. Let us see if you have a backhand.', blurb: 'The snow leopard champion of the Cloudtop Cup.',
    ai: { react: 0.13, error: 0.7, aim: 0.9, charge: 0.7, net: 0.25, lob: 0.06, drop: 0.06, slice: 0.2, read: 0.75, special: 0.85, counter: 0.75, speed: 1.02 } },
  { id: 'final', name: 'Ember & Isolde', chars: ['ember', 'isolde'], venue: 'sky', games: 3, art: 'final', taunt: 'Fire and ice. Together, for once.', blurb: 'The final: the champion and the challenger, side by side.',
    ai: { react: 0.15, error: 0.3, aim: 0.75, charge: 0.85, net: 0.4, lob: 0.06, drop: 0.05, slice: 0.18, read: 0.7, special: 0.8, counter: 0.7, speed: 1 } },
];
export const opp = (id: OppId) => OPPS.find((o) => o.id === id)!;

export type Who = 'dora' | 'enzo' | 'narrator' | CharId;
export type Line = [Who, string];
export type StoryStep = { opp: OppId;
  /** the player's team: one name, or both for doubles; `choose` lets the player pick who plays a singles match */
  team: CharId[]; choose?: boolean; before: Line[]; after: Line[] };
export const STORY: StoryStep[] = [
  { opp: 'bramble', team: ['dora'], before: [
    ['narrator', 'The Cloudtop Cup: the one tennis tournament played on top of the world. Two chinchillas have entered.'],
    ['dora', 'Enzo! A real tournament! With a trophy as big as you!'],
    ['enzo', 'I\'ve made notes on every player. First up is a hare called Bramble. You play this one, I\'ll watch.'],
    ['bramble', 'Fluffballs, eh? Catch me if you can!'],
    ['enzo', 'Press early and hold your nerve: the earlier you get ready, the harder you hit.'],
  ], after: [
    ['bramble', 'Phew! You hit like a falling acorn. Good luck up the mountain.'],
    ['dora', 'Did you see that? I felt something burning in my paws on that last point!'],
    ['enzo', 'That\'s your spirit meter. When it\'s full, press Special. I have a feeling you\'ll leap.'],
  ] },
  { opp: 'twins', team: ['dora', 'enzo'], before: [
    ['narrator', 'Round two is doubles, on the red clay by the river.'],
    ['sable', 'Oh, how sweet. A white one and a grey one.'],
    ['sorrel', 'We\'ll see which one cries first.'],
    ['enzo', 'Doubles, Dora. If we both fill up, we can hit together.'],
    ['dora', 'Twin Comet! I\'ve always wanted to say that!'],
  ], after: [
    ['sorrel', 'Two comets... that wasn\'t in any book.'],
    ['sable', 'Next time we\'ll bring a third twin.'],
    ['enzo', 'There is no third twin. I checked.'],
  ] },
  { opp: 'gale', team: ['enzo'], before: [
    ['narrator', 'The harbour court. The wind comes in off the sea in gusts.'],
    ['gale', 'Ahoy, young grey one. Forty years at sea. A little breeze won\'t trouble me.'],
    ['dora', 'Enzo, you\'re up. Show him the notebook!'],
    ['enzo', 'The wind pushes the ball sideways, slowly. Aim a little inside the lines.'],
  ], after: [
    ['gale', 'Ha! You read the sea like an old sailor, lad.'],
    ['enzo', 'I read the wind on your feathers before every serve.'],
    ['dora', 'He did! He wrote it down! Twice!'],
  ] },
  { opp: 'tortoises', team: ['dora', 'enzo'], before: [
    ['narrator', 'A clay court in a temple garden. Lanterns are being lit along the walls.'],
    ['marlow', 'Ah. Young legs. We had those once, Fern.'],
    ['fern', 'We did, dear. Now we have patience instead. Every ball comes back.'],
    ['dora', 'Every ball? We\'ll see about that!'],
  ], after: [
    ['fern', 'Well played, little ones. You made us run. We have not run since 1974.'],
    ['marlow', 'The next two are fire and ice. Mind your whiskers.'],
  ] },
  { opp: 'ember', team: ['dora'], choose: true, before: [
    ['narrator', 'The semi-final, under the floodlights of Ember Arena.'],
    ['ember', 'Hope you brought oven gloves! I\'ve never lost on my own court.'],
    ['enzo', 'Her specials are heavy. Get ready early and you can hold them, or spend half your meter to counter.'],
    ['dora', 'Who plays this one, Enzo? Me or you?'],
  ], after: [
    ['ember', 'Hmph. Fine. You\'re hot stuff too. Isolde won\'t be so easy.'],
    ['dora', 'She said we\'re hot stuff!'],
  ] },
  { opp: 'isolde', team: ['dora'], choose: true, before: [
    ['narrator', 'Cloudtop Court. Above the clouds the air is thin and cold, and the champion is waiting.'],
    ['isolde', 'You have heart. Let us see if you have a backhand.'],
    ['enzo', 'Her Absolute Zero freezes the court. Your feet will slide. Stay calm.'],
    ['dora', 'I\'m always calm! ...Mostly calm.'],
  ], after: [
    ['isolde', 'Remarkable. No one has beaten me here in eleven years.'],
    ['ember', 'Then you\'d better team up with me for the final, Isolde. Fire and ice.'],
    ['isolde', '...Agreed. One more match, little ones. Both of you.'],
  ] },
  { opp: 'final', team: ['dora', 'enzo'], before: [
    ['narrator', 'The final of the Cloudtop Cup. The sun is coming up over the clouds.'],
    ['ember', 'Fire and ice. Together, for once.'],
    ['dora', 'Fluff and... more fluff!'],
    ['enzo', 'Together, then. Like always.'],
  ], after: [
    ['isolde', 'The cup is yours. You played as one.'],
    ['ember', 'Rematch next year. And I\'m bringing a bigger fireball.'],
    ['dora', 'Enzo... we WON! The trophy really is as big as you!'],
    ['enzo', 'I\'ll write that down.'],
  ] },
];

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'fluffball-smash-v1';
export type Footwork = 'assist' | 'manual';
export type Save = {
  v: 1;
  /** the next story match (STORY.length when the cup is won) */ story: number;
  beaten: OppId[];
  settings: { sound: boolean; music: boolean; footwork: Footwork; difficulty: number };
  stats: { wins: number; losses: number; specials: number; counters: number; aces: number; longest: number };
};
export const newSave = (): Save => ({ v: 1, story: 0, beaten: [], settings: { sound: true, music: true, footwork: 'assist', difficulty: 1 }, stats: { wins: 0, losses: 0, specials: 0, counters: 0, aces: 0, longest: 0 } });
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
export function parseSave(raw: string | null): Save {
  const s = newSave();
  if (!raw) return s;
  let d: Record<string, unknown>;
  try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || d.v !== 1) return s;
  s.story = Math.floor(num(d.story, 0, STORY.length, 0));
  if (Array.isArray(d.beaten)) s.beaten = OPPS.map((o) => o.id).filter((id) => (d.beaten as unknown[]).includes(id));
  const st = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  if (typeof st.sound === 'boolean') s.settings.sound = st.sound;
  if (typeof st.music === 'boolean') s.settings.music = st.music;
  if (st.footwork === 'manual' || st.footwork === 'assist') s.settings.footwork = st.footwork;
  s.settings.difficulty = Math.floor(num(st.difficulty, 0, 2, 1));
  const ss = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as Record<string, unknown>;
  for (const k of Object.keys(s.stats) as (keyof Save['stats'])[]) s.stats[k] = Math.floor(num(ss[k], 0, 1e7, 0));
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** Exhibition opponents: anyone beaten in the story, plus Bramble from the start. */
export const oppUnlocked = (s: Save, id: OppId) => id === 'bramble' || s.beaten.includes(id) || OPPS.findIndex((o) => o.id === id) < s.story;
export function recordMatch(s: Save, m: Match, story: number | null) {
  const win = m.winner === 0;
  if (win) s.stats.wins++; else s.stats.losses++;
  s.stats.specials += m.stats.specials[0]; s.stats.counters += m.stats.counters[0]; s.stats.aces += m.stats.aces[0];
  s.stats.longest = Math.max(s.stats.longest, m.stats.longest);
  if (win && story !== null) { const o = STORY[story].opp; if (!s.beaten.includes(o)) s.beaten.push(o); s.story = Math.max(s.story, story + 1); }
}

// Wind-Up Rally's rules: a side-on badminton duel between wind-up tin toys. Deterministic and clock-free: the game
// steps in fixed 1/120 s ticks and every random choice comes from a seeded mulberry32 generator kept in the state, so
// a seed and the same inputs replay a match exactly. No DOM.
//
// The court is seen side-on. x runs along the court with the net at 0: the left half is x < 0, the right half x > 0.
// y is height above the tin board. Distances are in court units (the net is 1 high, each half 4.4 long).

export const SAVE_KEY = 'windup-rally-v1';
const DEG = Math.PI / 180;
export const DT = 1 / 120;

// ---- the court
export const HALF = 4.4; // net to back line
export const SHORT = 1.3; // net to the short service line
export const NET_H = 1.0;
export const NET_TAPE = 0.08; // a clip in the top band of the net is a let-cord
export const BACK_ROOM = 0.6; // how far behind the back line a toy may run
export const NET_GAP = 0.28; // how close to the net a toy's feet may go

// ---- the shuttlecock: strong quadratic drag, so it flies fast off the racket and then drops steeply
export const GRAV = 7.2;
export const DRAG = 0.24; // a = -DRAG |v| v
export const TERMINAL = Math.sqrt(GRAV / DRAG); // about 5.5 units a second, straight down

// ---- the toys
export const RUN = 3.3; // top running speed on a full key
export const ACCEL = 28;
export const SMASH = 21;
export const HOP_V = 3.9;
export const HOP_TOP = (HOP_V * HOP_V) / (2 * 14) - 0.02; // how high the feet get on a hop
export const P_GRAV = 14;
export const SWING_T = 0.3; // a whole swing
export const STRIKE = 0.1; // the racket's strike moment after the press
export const WINDOW = 0.075; // the racket can meet the shuttle this long either side of the strike
export const SWEET = 0.024; // within this of the strike moment it is a sweet-spot hit
export const REACH = { back: -0.38, front: 0.88, low: 0.04, high: 1.5 };
export const OVERHEAD = 1.0; // contact above this (from the feet) is an overhead shot
export const LOW = 0.45; // contact below this is a low shot

// ---- the wind-up spring (0 to 1)
export const SPRING = {
  run: 0.015, // per unit run
  hop: 0.04,
  wind: 0.36, // per second while winding
  sluggish: 0.3, // below this the toy slows down
  shots: { smash: 0.12, clear: 0.04, drop: 0.03, drive: 0.03, net: 0.02, tumble: 0.025, lift: 0.04, serve: 0.01 } as Record<ShotType, number>,
  whiff: 0.015,
};

export type Side = 0 | 1; // 0 plays the left half, 1 the right
export type ShotType = 'smash' | 'clear' | 'drop' | 'drive' | 'net' | 'tumble' | 'lift' | 'serve';
export type Aim = -1 | 0 | 1; // -1 short (toward the net), 1 long
export type Who = 'dora' | 'enzo' | ToyId;
export type ToyId = 'robot' | 'frog' | 'duck' | 'top' | 'penguin' | 'knight' | 'bear';
export type Mode = 'ladder' | 'doubles' | 'versus';
export type Phase = 'serve' | 'rally' | 'point' | 'game' | 'over';

export type Input = { move: -1 | 0 | 1; hop: boolean; swing: boolean; wind: boolean; aim?: Aim };
export const IDLE: Input = { move: 0, hop: false, swing: false, wind: false };

export type Style = {
  speed: number; // running speed multiplier
  react: number; // seconds before it reads a new shot
  perc: number; // how far off its read of the shuttle's flight is
  err: number; // shot error multiplier
  timing: number; // spread of its swing timing, seconds
  hop: number; // how keen it is to hop and smash a high shuttle
  net: number; // how keen on net shots and drops
  deep: number; // how keen on deep clears and lifts
  smart: number; // how well it aims away from you
  home: number; // where it waits, as distance from the net
  windAt: number; // winds its key when below this and it has a moment
  only?: ShotType; // a quirk: always plays this shot
  power?: number; // smash speed multiplier
};

export type Toy = {
  id: ToyId; name: string; title: string; line: string; brag: string; lose: string;
  style: Style; best: number; // games to win the match
  tint: string; // a printed-tin colour for the UI and stand-ins
};

export const TOYS: Toy[] = [
  { id: 'robot', name: 'Sprocket', title: 'the tin robot', tint: '#c8432f', best: 1,
    line: 'BEEP. I. HIT. FLAT. AND. STRAIGHT. PLEASE. KEEP. UP.', brag: 'DRIVE. COMPLETE.', lose: 'ERROR. ERROR. GOOD. GAME.',
    style: { speed: 0.74, react: 0.36, perc: 0.14, err: 1.55, timing: 0.036, hop: 0, net: 0, deep: 0, smart: 0.1, home: 2.5, windAt: 0.2, only: 'drive' } },
  { id: 'frog', name: 'Ribbit', title: 'the wind-up frog', tint: '#4c9a3c', best: 1,
    line: 'Anything up high is mine. I was BORN to hop!', brag: 'Ribbit-SMASH!', lose: 'Croak. You out-hopped me.',
    style: { speed: 0.86, react: 0.31, perc: 0.11, err: 1.42, timing: 0.032, hop: 0.95, net: 0.1, deep: 0.2, smart: 0.25, home: 2.6, windAt: 0.25 } },
  { id: 'duck', name: 'Dabble', title: 'the tin duck', tint: '#e2b33b', best: 1,
    line: 'Quack! I live at the net, sailor. Everything drops short with me.', brag: 'Dabbled it!', lose: 'Well, that’s me sunk.',
    style: { speed: 0.88, react: 0.3, perc: 0.1, err: 1.45, timing: 0.03, hop: 0.2, net: 0.9, deep: 0.1, smart: 0.4, home: 1.9, windAt: 0.3 } },
  { id: 'top', name: 'Topsy', title: 'the spinning-top acrobat', tint: '#d0533f', best: 1,
    line: 'Round and round and — hup! — never the same shot twice.', brag: 'Wheee!', lose: 'I’m all of a spin…',
    style: { speed: 1.04, react: 0.25, perc: 0.08, err: 1.2, timing: 0.027, hop: 0.45, net: 0.45, deep: 0.45, smart: 0.6, home: 2.4, windAt: 0.3 } },
  { id: 'knight', name: 'Sir Clank', title: 'the tin knight', tint: '#8c96a3', best: 1,
    line: 'Have at thee! My racket is my lance, and my smash is my charge.', brag: 'For the shelf!', lose: 'I yield, noble chinchilla.',
    style: { speed: 0.88, react: 0.19, perc: 0.05, err: 0.92, timing: 0.02, hop: 0.8, net: 0.25, deep: 0.4, smart: 0.65, home: 2.6, windAt: 0.35, power: 1.12 } },
  { id: 'penguin', name: 'Waddle', title: 'the tin penguin', tint: '#2d4f6c', best: 1,
    line: 'I don’t smash. I don’t miss. I just send it back. And back. And back.', brag: 'Back it goes.', lose: 'Oh, I ran out of back.',
    style: { speed: 1.1, react: 0.19, perc: 0.05, err: 0.76, timing: 0.021, hop: 0.12, net: 0.2, deep: 0.85, smart: 0.5, home: 2.8, windAt: 0.45 } },
  { id: 'bear', name: 'Old Humbert', title: 'the music-box bear', tint: '#9a6a3a', best: 2,
    line: 'Every rally is a little tune, my dears. Let’s see if you can keep the beat.', brag: 'And… a rest.', lose: 'What a lovely song you played.',
    style: { speed: 1.0, react: 0.17, perc: 0.04, err: 0.78, timing: 0.019, hop: 0.55, net: 0.45, deep: 0.5, smart: 0.85, home: 2.5, windAt: 0.4 } },
];
export const TOY_IDS = TOYS.map((t) => t.id);
export const toyById = (id: ToyId) => TOYS.find((t) => t.id === id)!;

/** Doubles pairs: the shelf's toys team up. */
export const PAIRS: { id: string; toys: [ToyId, ToyId]; name: string }[] = [
  { id: 'robot-duck', toys: ['robot', 'duck'], name: 'Sprocket & Dabble' },
  { id: 'frog-top', toys: ['frog', 'top'], name: 'Ribbit & Topsy' },
  { id: 'knight-bear', toys: ['knight', 'bear'], name: 'Sir Clank & Old Humbert' },
];

/** A friend's style when the computer plays Dora or Enzo (doubles partner, or the bots). */
export const PARTNER: Style = { speed: 1.0, react: 0.19, perc: 0.05, err: 0.95, timing: 0.021, hop: 0.5, net: 0.4, deep: 0.5, smart: 0.65, home: 2.4, windAt: 0.4 };

export const POINTS = 11; // rally-point to 11
export const CAP = 15; // win by two, up to 15

// ---- the generator
export function rand(s: { rng: number }) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(s: { rng: number }) {
  const u = Math.max(1e-9, rand(s)), v = rand(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- state
export type Shuttle = {
  x: number; y: number; vx: number; vy: number; ang: number;
  held: number; // index of the player holding it to serve, or -1
  last: Side; // who hit it last
  netted: boolean; cord: boolean; down: boolean;
  shot: ShotType; sweet: boolean; hits: number; age: number; // seconds since the last hit
};
export type AiPlan = { swung: number; at: number; x: number; y: number; t: number; hop: boolean; press: number; aim: Aim; replan: number; seen: number; bias: number; serveAt: number; target: number };
export type Player = {
  side: Side; slot: number; who: Who; human: boolean; style: Style;
  x: number; y: number; vx: number; vy: number;
  spring: number; key: number; // the key's turned angle, for the drawing
  swingT: number; contact: boolean; swingAim: Aim;
  winding: boolean; hopT: number; ranOut: boolean;
  pose: 'ready' | 'run' | 'smash' | 'lunge' | 'wind' | 'cheer' | 'topple';
  poseT: number; lastShot: ShotType | null; ai: AiPlan;
};
export type RallyEvent =
  | { e: 'hit'; side: Side; who: number; shot: ShotType; sweet: boolean; x: number; y: number; speed: number; tau: number }
  | { e: 'serve'; side: Side; who: number }
  | { e: 'whiff'; who: number }
  | { e: 'hop'; who: number }
  | { e: 'net'; x: number; y: number }
  | { e: 'cord'; x: number; y: number; over: boolean }
  | { e: 'land'; x: number; inside: boolean }
  | { e: 'point'; side: Side; why: 'winner' | 'out' | 'net' | 'fault' | 'down'; score: [number, number] }
  | { e: 'game'; side: Side; games: [number, number] }
  | { e: 'match'; side: Side }
  | { e: 'runout'; who: number }
  | { e: 'wound'; who: number };
export type Frame = { sx: number; sy: number; sa: number; p: [number, number, string][] };

export type MatchSetup = {
  mode: Mode; seed: number; who: 'dora' | 'enzo'; foe?: ToyId; pair?: string; best?: number; tutorial?: boolean;
};
export type Match = {
  setup: MatchSetup; rng: number; t: number; phase: Phase; phaseT: number;
  players: Player[]; shuttle: Shuttle;
  score: [number, number]; games: [number, number]; best: number; server: Side; winner: Side | null;
  gameLog: [number, number][]; // each finished game's score
  events: RallyEvent[]; rallyHits: number; rallies: number[]; frames: Frame[]; matchPoint: boolean;
  stats: { smashes: [number, number]; sweet: [number, number]; longest: number };
  idleServe: number;
};

const sgn = (side: Side) => (side === 0 ? -1 : 1); // the half's sign along x
const face = (side: Side) => (side === 0 ? 1 : -1); // which way a toy faces (toward the net)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function newPlayer(side: Side, slot: number, who: Who, human: boolean, style: Style): Player {
  return {
    side, slot, who, human, style, x: sgn(side) * 2, y: 0, vx: 0, vy: 0, spring: 1, key: 0,
    swingT: -1, contact: false, swingAim: 0, winding: false, hopT: -1, ranOut: false, pose: 'ready', poseT: 0, lastShot: null,
    ai: { swung: -1, at: -1, x: 0, y: 0, t: 0, hop: false, press: -1, aim: 0, replan: 0, seen: -1, bias: 0, serveAt: 0, target: 2.4 },
  };
}

export function newMatch(setup: MatchSetup): Match {
  const players: Player[] = [];
  const other: 'dora' | 'enzo' = setup.who === 'dora' ? 'enzo' : 'dora';
  if (setup.mode === 'versus') {
    players.push(newPlayer(0, 0, setup.who, true, PARTNER), newPlayer(1, 0, other, true, PARTNER));
  } else if (setup.mode === 'doubles') {
    const pair = PAIRS.find((p) => p.id === setup.pair) ?? PAIRS[0];
    players.push(newPlayer(0, 0, setup.who, true, PARTNER), newPlayer(0, 1, other, false, PARTNER));
    players.push(newPlayer(1, 0, pair.toys[0], false, toyById(pair.toys[0]).style), newPlayer(1, 1, pair.toys[1], false, toyById(pair.toys[1]).style));
  } else {
    const foe = toyById(setup.foe ?? 'robot');
    const st = setup.tutorial ? { ...foe.style, err: foe.style.err * 1.15, speed: foe.style.speed * 0.9, react: foe.style.react + 0.05 } : foe.style;
    players.push(newPlayer(0, 0, setup.who, true, PARTNER), newPlayer(1, 0, foe.id, false, st));
  }
  const best = setup.best ?? (setup.mode === 'ladder' ? toyById(setup.foe ?? 'robot').best : 1);
  const m: Match = {
    setup, rng: (setup.seed >>> 0) || 1, t: 0, phase: 'serve', phaseT: 0, players,
    shuttle: { x: 0, y: 0, vx: 0, vy: 0, ang: Math.PI / 2, held: 0, last: 0, netted: false, cord: false, down: false, shot: 'serve', sweet: false, hits: 0, age: 0 },
    score: [0, 0], games: [0, 0], best, server: 0, winner: null, gameLog: [], events: [], rallyHits: 0, rallies: [], frames: [], matchPoint: false,
    stats: { smashes: [0, 0], sweet: [0, 0], longest: 0 }, idleServe: 0,
  };
  rand(m); // stir the seed
  startServe(m);
  return m;
}

/** The player who serves for the side: the human if there is one, else the front toy. */
export function serverIndex(m: Match) {
  const ps = m.players.map((p, i) => ({ p, i })).filter((o) => o.p.side === m.server);
  return (ps.find((o) => o.p.human) ?? ps[0]).i;
}
function spot(m: Match, p: Player, i: number) {
  const doubles = m.players.filter((q) => q.side === p.side).length > 1;
  if (!doubles) return sgn(p.side) * (p.side === m.server ? 1.9 : 2.1);
  const serving = serverIndex(m) === i, sameServer = p.side === m.server;
  return sgn(p.side) * (serving ? 1.8 : sameServer ? 3.3 : p.slot === 0 ? 1.9 : 3.3);
}
function startServe(m: Match) {
  m.phase = 'serve'; m.phaseT = 0; m.rallyHits = 0; m.frames = []; m.idleServe = 0;
  m.players.forEach((p, i) => { p.x = spot(m, p, i); p.vx = 0; p.y = 0; p.vy = 0; p.swingT = -1; p.contact = false; p.pose = 'ready'; p.ai.at = -1; p.ai.press = -1; p.ai.seen = -1; p.ai.swung = -1; });
  const s = m.shuttle, si = serverIndex(m), sp = m.players[si];
  Object.assign(s, { held: si, last: sp.side, netted: false, cord: false, down: false, shot: 'serve', sweet: false, hits: 0, age: 0, vx: 0, vy: 0, ang: -Math.PI / 2 });
  holdShuttle(m);
  for (const p of m.players) if (!p.human) p.ai.serveAt = 0.75 + rand(m) * 0.7;
  const [a, b] = m.score, need = (k: number) => k >= POINTS - 1 && (k > (k === a ? b : a));
  m.matchPoint = (need(a) && m.games[0] === m.best - 1) || (need(b) && m.games[1] === m.best - 1);
}
function holdShuttle(m: Match) {
  const s = m.shuttle, p = m.players[s.held];
  s.x = p.x + face(p.side) * 0.32; s.y = p.y + 0.62; s.vx = 0; s.vy = 0;
}

// ---- shuttle flight
/** One tick of shuttle flight with drag and gravity (semi-implicit Euler). */
export function flyStep(b: { x: number; y: number; vx: number; vy: number }, dt = DT) {
  const sp = Math.hypot(b.vx, b.vy);
  b.vx += -DRAG * sp * b.vx * dt;
  b.vy += (-DRAG * sp * b.vy - GRAV) * dt;
  b.x += b.vx * dt; b.y += b.vy * dt;
}
/** Where a shot from (x, y) at (vx, vy) comes down, ignoring the toys: the landing x, or the net. */
export function flight(x: number, y: number, vx: number, vy: number, margin = 0.03) {
  const b = { x, y, vx, vy };
  let apex = y, t = 0;
  for (let i = 0; i < 1200; i++) {
    const px = b.x, py = b.y;
    flyStep(b); t += DT; apex = Math.max(apex, b.y);
    if ((px < 0) !== (b.x < 0) && px !== 0) {
      const f = px / (px - b.x), yc = py + (b.y - py) * f;
      if (yc < NET_H + margin) return { x: 0, net: true, t, apex };
    }
    if (b.y <= 0) {
      const f = py / (py - b.y);
      return { x: px + (b.x - px) * f, net: false, t, apex };
    }
  }
  return { x: b.x, net: false, t, apex };
}
/** How far into the far half (from the net) a shot lands; −1 into the net or its own half. */
function depth(side: Side, x: number, y: number, vx: number, vy: number) {
  const f = flight(x, y, vx, vy);
  if (f.net) return -1;
  const d = f.x * -sgn(side);
  return d < 0 ? -1 : d;
}

/** The launch speed (at a fixed angle) that lands the shot `target` deep in the far half, up to `max`. */
export function solveSpeed(side: Side, x: number, y: number, ang: number, target: number, max: number) {
  const dir = face(side), c = Math.cos(ang), s = Math.sin(ang);
  const d = (v: number) => depth(side, x, y, dir * c * v, s * v);
  if (d(max) < target) return max;
  let lo = 0.5, hi = max;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (d(mid) < target) lo = mid; else hi = mid; }
  return hi;
}
/** Like solveSpeed, but tips the racket up a few degrees at a time until the shot clears the net. */
export function launch(side: Side, x: number, y: number, ang: number, target: number, max: number) {
  let a = ang, v = 0;
  for (let k = 0; k < 14; k++) {
    v = solveSpeed(side, x, y, a, target, max);
    const d = depth(side, x, y, face(side) * Math.cos(a) * v, Math.sin(a) * v);
    // done when it lands near the target, or as deep as a full swing can send it
    if (d >= 0 && (Math.abs(d - target) < 0.2 || (v >= max && d < target))) break;
    a += 4 * DEG;
  }
  return { ang: a, speed: v };
}
/** The launch angle (at a fixed speed) that lands the shot `target` deep, between `lo` and `hi` radians. */
export function solveAngle(side: Side, x: number, y: number, speed: number, target: number, lo: number, hi: number) {
  const dir = face(side);
  const d = (a: number) => depth(side, x, y, dir * Math.cos(a) * speed, Math.sin(a) * speed);
  if (d(hi) < target) return hi;
  if (d(lo) >= target) return lo;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (d(mid) < target) lo = mid; else hi = mid; }
  return hi;
}

// ---- shot selection
/** Which shot a contact makes: from the contact height above the feet, the swing timing, the hop and the aim. */
export function shotFor(h: number, tau: number, airborne: boolean, nearNet: boolean, aim: Aim): ShotType {
  if (h > OVERHEAD) {
    if (airborne && tau <= 0.012) return 'smash';
    return aim < 0 ? 'drop' : 'clear';
  }
  if (h < LOW) {
    if (nearNet) return aim > 0 ? 'lift' : Math.abs(tau) <= SWEET ? 'tumble' : 'net';
    return aim < 0 ? 'net' : 'lift';
  }
  return 'drive';
}
/** Power left in the spring: a run-down toy hits shorter and softer. */
export const power = (spring: number) => 0.8 + 0.2 * clamp(spring / 0.25, 0, 1);

function strike(m: Match, i: number, tau: number, aim: Aim, serve: boolean) {
  const p = m.players[i], s = m.shuttle, h = s.y - p.y, airborne = p.y > 0.04;
  const nearNet = Math.abs(s.x) < 1.35;
  let type: ShotType = serve ? 'serve' : shotFor(h, tau, airborne, nearNet, aim);
  if (!serve && p.style.only && !p.human) type = p.style.only; // a toy with a quirk
  const sweet = Math.abs(tau) <= SWEET;
  const pw = power(p.spring), frame = Math.abs(tau) > WINDOW * 0.85;
  const errK = (p.human ? 1 : p.style.err) * (1 + Math.max(0, Math.abs(tau) - SWEET * 0.5) / 0.03) * (p.spring < 0.1 ? 1.4 : 1);
  let target = 3.0, ang = 0, speed = 0;
  const x = s.x, y = s.y;
  const pick = (short: number, mid: number, long: number) => (aim < 0 ? short : aim > 0 ? long : mid);
  switch (type) {
    case 'smash': {
      target = pick(1.5, 2.6, 3.6);
      // a smash is fiercest from mid-court and loses bite from the back
      speed = SMASH * pw * (sweet ? 1.12 : 1) * (p.style.power ?? 1) * clamp(1.08 - 0.07 * Math.abs(x), 0.8, 1);
      ang = solveAngle(p.side, x, y, speed, target, -60 * DEG, 8 * DEG);
      break;
    }
    case 'clear': target = pick(3.3, 3.75, 4.0); ({ ang, speed } = launch(p.side, x, y, (sweet ? 50 : 46) * DEG, target, 24 * pw)); break;
    case 'drop': target = sweet ? 1.0 : 1.25; ({ ang, speed } = launch(p.side, x, y, 4 * DEG, target, 14 * pw)); break;
    case 'drive': target = pick(2.0, 2.9, 3.5); ({ ang, speed } = launch(p.side, x, y, (y < NET_H + 0.1 ? 13 : 4) * DEG, target, 20 * pw)); break;
    case 'net': target = 0.75; ({ ang, speed } = launch(p.side, x, y, 62 * DEG, target, 10 * pw)); break;
    case 'tumble': target = 0.42; ({ ang, speed } = launch(p.side, x, y, 70 * DEG, target, 10 * pw)); break;
    case 'lift': target = pick(3.0, 3.6, 3.9); ({ ang, speed } = launch(p.side, x, y, (sweet ? 55 : 51) * DEG, target, 22 * pw)); break;
    case 'serve': target = aim > 0 ? 3.95 : 1.75; ({ ang, speed } = launch(p.side, x, y, (aim > 0 ? 54 : 24) * DEG, target, 20)); break;
  }
  // the error: a little off on every shot, more when the timing was off or the toy is run down
  const spread = type === 'serve' ? 0.4 : type === 'smash' ? 0.8 : 1;
  speed *= 1 + gauss(m) * 0.026 * errK * spread;
  ang += gauss(m) * 1.0 * DEG * errK * spread;
  if (frame && !serve) { speed *= 0.72; ang += gauss(m) * 7 * DEG; }
  s.vx = face(p.side) * Math.cos(ang) * speed; s.vy = Math.sin(ang) * speed;
  s.last = p.side; s.shot = type; s.sweet = sweet && !frame; s.hits++; s.age = 0; s.held = -1;
  p.contact = true; p.lastShot = type; p.swingAim = aim;
  spend(m, i, SPRING.shots[type]);
  p.pose = type === 'smash' ? 'smash' : type === 'net' || type === 'tumble' || (type === 'lift' && h < LOW) ? 'lunge' : 'ready';
  p.poseT = 0.35;
  m.rallyHits++;
  if (type === 'smash') m.stats.smashes[p.side]++;
  if (s.sweet) m.stats.sweet[p.side]++;
  if (serve) m.events.push({ e: 'serve', side: p.side, who: i });
  m.events.push({ e: 'hit', side: p.side, who: i, shot: type, sweet: s.sweet, x, y, speed, tau });
}

function spend(m: Match, i: number, cost: number) {
  const p = m.players[i];
  const was = p.spring;
  p.spring = Math.max(0, p.spring - cost);
  if (p.spring <= 0 && was > 0) { p.ranOut = true; m.events.push({ e: 'runout', who: i }); }
}

// ---- the racket's reach
/** Is the shuttle within the racket's reach of this toy? */
export function inReach(p: Player, sx: number, sy: number) {
  const dx = (sx - p.x) * face(p.side), dy = sy - p.y;
  return dx >= REACH.back && dx <= REACH.front && dy >= REACH.low && dy <= REACH.high;
}
function canHit(m: Match, p: Player) {
  const s = m.shuttle;
  if (s.held >= 0 || s.down || s.netted || m.phase !== 'rally') return false;
  if (s.last === p.side) return false;
  return s.x * sgn(p.side) >= -0.06;
}

// ---- the step
export function step(m: Match, inputs: (Input | null)[] = []) {
  m.t += DT; m.phaseT += DT;
  const s = m.shuttle;
  // the toys think, then move
  m.players.forEach((p, i) => {
    const inp = p.human ? (inputs[i] ?? IDLE) : aiInput(m, i);
    movePlayer(m, i, inp);
  });
  // the shuttle
  if (s.held >= 0) holdShuttle(m);
  else if (!s.down) flyShuttle(m);
  // the phases
  if (m.phase === 'point' && m.phaseT > 1.5) afterPoint(m);
  else if (m.phase === 'game' && m.phaseT > 2.6) { m.score = [0, 0]; startServe(m); }
  else if (m.phase === 'serve') {
    m.idleServe += DT;
    const si = serverIndex(m);
    if (m.players[si].human && m.idleServe > 8 && m.players[si].swingT < 0) { m.players[si].swingT = 0; m.players[si].contact = false; m.players[si].swingAim = 0; }
  }
  if (m.phase === 'rally' || m.phase === 'serve') {
    if (m.frames.length < 3000 && Math.round(m.t / DT) % 2 === 0) m.frames.push({ sx: s.x, sy: s.y, sa: s.ang, p: m.players.map((q) => [q.x, q.y, q.pose] as [number, number, string]) });
  }
}

function movePlayer(m: Match, i: number, inp: Input) {
  const p = m.players[i], st = p.style;
  const grounded = p.y <= 0;
  const locked = m.phase === 'serve' && serverIndex(m) === i; // the server may pick a spot but keeps both feet down
  const between = m.phase === 'point' || m.phase === 'game' || m.phase === 'over';
  // winding: standing still on the ground and holding the button
  const wantWind = inp.wind && grounded && p.swingT < 0 && m.phase !== 'over';
  p.winding = wantWind && Math.abs(p.vx) < 0.6;
  let target = 0;
  if (between && !p.winding) {
    const home = spot(m, p, i); const d = home - p.x;
    target = Math.abs(d) > 0.08 ? Math.sign(d) * RUN * 0.55 : 0; // stroll back to place, no spring used
  } else if (!wantWind) {
    target = inp.move * RUN * st.speed * speedFactor(p.spring);
  }
  const acc = (grounded ? ACCEL : ACCEL * 0.35) * DT;
  p.vx += clamp(target - p.vx, -acc, acc);
  const before = p.x;
  p.x += p.vx * DT;
  const lim = sgn(p.side);
  const near = NET_GAP * lim, far = (HALF + BACK_ROOM) * lim;
  p.x = lim < 0 ? clamp(p.x, far, near) : clamp(p.x, near, far);
  if (p.x === near || p.x === far) p.vx = 0;
  if (!between) spend(m, i, Math.abs(p.x - before) * SPRING.run);
  if (p.winding) {
    const was = p.spring;
    p.spring = Math.min(1, p.spring + SPRING.wind * DT);
    p.key -= DT * 9;
    if (was < 1 && p.spring >= 1) m.events.push({ e: 'wound', who: i });
  } else if (p.spring > 0) p.key += DT * (0.6 + 4 * p.spring) * (Math.abs(p.vx) > 0.2 || p.swingT >= 0 ? 1.6 : 0.5);
  // the hop
  if (inp.hop && grounded && !locked && !p.winding && !between) {
    p.vy = HOP_V * (p.spring < 0.08 ? 0.75 : 1); p.y = 0.0001; spend(m, i, SPRING.hop); m.events.push({ e: 'hop', who: i });
  }
  if (p.y > 0) { p.y += p.vy * DT; p.vy -= P_GRAV * DT; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
  // the swing
  if (inp.swing && p.swingT < 0 && !between && !p.winding && (m.phase === 'rally' || serverIndex(m) === i)) {
    p.swingT = 0; p.contact = false; p.swingAim = inp.aim ?? (inp.move === 0 ? 0 : (inp.move * face(p.side) > 0 ? -1 : 1) as Aim);
  }
  if (p.swingT >= 0) {
    p.swingT += DT;
    const aim = inp.aim ?? (inp.move === 0 ? p.swingAim : (inp.move * face(p.side) > 0 ? -1 : 1) as Aim);
    if (!p.contact) {
      const tau = p.swingT - STRIKE;
      if (m.phase === 'serve' && serverIndex(m) === i) {
        if (tau >= 0) { m.phase = 'rally'; m.phaseT = 0; strike(m, i, 0, aim, true); }
      } else if (canHit(m, p) && Math.abs(tau) <= WINDOW && inReach(p, m.shuttle.x, m.shuttle.y)) {
        // before the strike moment, wait for it unless the shuttle will be gone by then
        let go = tau >= 0;
        if (!go) {
          const b = { x: m.shuttle.x, y: m.shuttle.y, vx: m.shuttle.vx, vy: m.shuttle.vy };
          const n = Math.round(-tau / DT);
          for (let k = 0; k < n; k++) flyStep(b);
          const px = p.x + p.vx * -tau, py = Math.max(0, p.y + p.vy * -tau);
          go = !inReach({ ...p, x: px, y: py }, b.x, b.y) || b.y <= 0.05;
        }
        if (go) strike(m, i, tau, aim, false);
      }
    }
    if (p.swingT >= SWING_T) {
      if (!p.contact && m.phase === 'rally') { spend(m, i, SPRING.whiff); m.events.push({ e: 'whiff', who: i }); }
      p.swingT = -1;
    }
  }
  // the pose
  p.poseT = Math.max(0, p.poseT - DT);
  if (m.phase === 'over') p.pose = m.winner === p.side ? 'cheer' : 'topple';
  else if (p.poseT <= 0) {
    if (p.winding) p.pose = 'wind';
    else if (p.y > 0.05 || (p.swingT >= 0 && m.shuttle.y - p.y > OVERHEAD)) p.pose = 'smash';
    else if (p.swingT >= 0 && m.shuttle.y - p.y < LOW) p.pose = 'lunge';
    else if (Math.abs(p.vx) > 0.5) p.pose = 'run';
    else p.pose = 'ready';
  }
}

/** How fast a toy can run on what is left in its spring. */
export const speedFactor = (spring: number) => (spring >= SPRING.sluggish ? 1 : 0.45 + 0.55 * (spring / SPRING.sluggish));

function flyShuttle(m: Match) {
  const s = m.shuttle;
  const px = s.x, py = s.y;
  flyStep(s);
  s.age += DT;
  // the shuttle always turns cork-first: its angle swings round to its direction of flight
  const want = Math.atan2(s.vy, s.vx);
  let d = want - s.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  s.ang += d * Math.min(1, (6 + 2.2 * Math.hypot(s.vx, s.vy)) * DT);
  // the net
  if (!s.netted && px !== 0 && (px < 0) !== (s.x < 0)) {
    const f = px / (px - s.x), yc = py + (s.y - py) * f;
    if (yc < NET_H && yc > 0) {
      if (yc > NET_H - NET_TAPE && !s.cord) {
        // a let-cord: it clips the tape, loses its pace and pops up, trickling over or back
        s.cord = true;
        const over = rand(m) < 0.35 + 0.08 * Math.min(4, Math.abs(s.vx));
        s.x = (over ? Math.sign(s.x - px) : Math.sign(px - s.x)) * 0.05 + 0;
        s.y = NET_H + 0.02; s.vx = Math.sign(s.x) * 0.5; s.vy = 1.0 + 0.2 * rand(m);
        m.events.push({ e: 'cord', x: 0, y: NET_H, over });
      } else {
        s.netted = true; s.x = Math.sign(px) * 0.06; s.vx = -s.vx * 0.08; s.vy = Math.min(0, s.vy) * 0.3;
        m.events.push({ e: 'net', x: 0, y: yc });
      }
    }
  }
  if (s.y <= 0) {
    s.y = 0; s.down = true; s.vx = 0; s.vy = 0;
    if (m.phase === 'rally') resolve(m);
  }
}

function resolve(m: Match) {
  const s = m.shuttle, last = s.last, other: Side = last === 0 ? 1 : 0;
  const landSide: Side = s.x < 0 ? 0 : 1;
  const d = Math.abs(s.x);
  const serve = s.shot === 'serve' && s.hits === 1;
  const inside = landSide !== last && d <= HALF + 0.02 && (!serve || d >= SHORT - 0.02);
  m.events.push({ e: 'land', x: s.x, inside });
  let win: Side, why: 'winner' | 'out' | 'net' | 'fault' | 'down';
  if (s.netted || (s.cord && landSide === last)) { win = other; why = 'net'; }
  else if (inside) { win = last; why = 'winner'; }
  else if (landSide === last) { win = other; why = 'down'; }
  else { win = other; why = serve ? 'fault' : 'out'; }
  award(m, win, why);
}

export function award(m: Match, win: Side, why: 'winner' | 'out' | 'net' | 'fault' | 'down') {
  m.score[win]++;
  m.rallies.push(m.rallyHits);
  m.stats.longest = Math.max(m.stats.longest, m.rallyHits);
  m.server = win;
  m.events.push({ e: 'point', side: win, why, score: [m.score[0], m.score[1]] });
  const a = m.score[win], b = m.score[win === 0 ? 1 : 0];
  if ((a >= POINTS && a - b >= 2) || a >= CAP) {
    m.games[win]++;
    m.gameLog.push([m.score[0], m.score[1]]);
    m.events.push({ e: 'game', side: win, games: [m.games[0], m.games[1]] });
    if (m.games[win] >= m.best) { m.phase = 'over'; m.phaseT = 0; m.winner = win; m.events.push({ e: 'match', side: win }); return; }
    m.phase = 'game'; m.phaseT = 0; return;
  }
  m.phase = 'point'; m.phaseT = 0;
}
function afterPoint(m: Match) { startServe(m); }

/** The score text for a side, and whether the next point could win the game or match. */
export function gamePoint(m: Match): Side | null {
  for (const side of [0, 1] as Side[]) {
    const a = m.score[side], b = m.score[side === 0 ? 1 : 0];
    if ((a + 1 >= POINTS && a + 1 - b >= 2) || a + 1 >= CAP) return side;
  }
  return null;
}

// ---- the toys' minds
/** The computer's input for player i: read the shuttle after a reaction delay, run to meet it, hop and swing. */
export function aiInput(m: Match, i: number): Input {
  const p = m.players[i], st = p.style, s = m.shuttle, ai = p.ai;
  const inp: Input = { move: 0, hop: false, swing: false, wind: false };
  const dir = sgn(p.side);
  const mates = m.players.filter((q, j) => q.side === p.side && j !== i);
  // zone in doubles: cover the half of the court your partner is not in
  let zoneLo = NET_GAP, zoneHi = HALF + BACK_ROOM;
  if (mates.length) {
    const mate = mates[0], md = Math.abs(mate.x);
    const front = mate.human ? md > 2.3 : p.slot === 0;
    if (front) zoneHi = 2.6; else zoneLo = 2.0;
  }
  const homeD = mates.length ? (zoneHi < 3 ? 1.7 : 3.2) : st.home;
  if (m.phase === 'over') return inp;
  if (m.phase === 'point' || m.phase === 'game') { inp.wind = p.spring < 0.98; return inp; }
  if (m.phase === 'serve') {
    if (serverIndex(m) === i) {
      if (p.spring < 0.9 && m.phaseT < 2.5) { inp.wind = true; return inp; }
      if (m.phaseT > ai.serveAt + (p.spring < 0.9 ? 0 : 0)) { inp.swing = true; inp.aim = rand(m) < 0.3 + st.deep * 0.4 ? 1 : -1; }
      return inp;
    }
    if (p.spring < 0.95) inp.wind = true;
    else inp.move = seek(p, dir * homeD);
    return inp;
  }
  // the rally
  const coming = s.held < 0 && !s.down && !s.netted && s.last !== p.side;
  if (!coming) {
    ai.at = -1; ai.press = -1;
    // recover to the home spot, and wind if there is a moment
    const opp = m.shuttle;
    const tToUs = s.down || s.netted ? 9 : estimateArrival(s, p.side);
    if (p.spring < st.windAt && tToUs > 0.9 && Math.abs(p.x - dir * homeD) < 0.9) { inp.wind = true; return inp; }
    void opp;
    inp.move = seek(p, dir * homeD);
    return inp;
  }
  // a fresh shot: wait out the reaction time, then read it (with an error that shrinks as it comes closer)
  if (ai.seen !== s.hits) {
    if (s.age < st.react) { inp.move = seek(p, dir * homeD); return inp; }
    ai.seen = s.hits; ai.bias = gauss(m) * st.perc; ai.replan = 0; ai.at = -1;
  }
  ai.replan -= DT;
  if (ai.replan <= 0 && ai.press < 0 && p.y <= 0 && (ai.at < 0 || ai.t - (m.t - ai.at) > 0.36)) {
    plan(m, i, zoneLo, zoneHi);
    ai.replan = 0.12;
  }
  if (ai.at < 0) { inp.move = seek(p, dir * homeD); return inp; }
  const tLeft = ai.t - (m.t - ai.at);
  inp.move = seek(p, ai.x);
  // a hop for an overhead smash: leave the ground so the feet are near the top at contact
  if (ai.hop && p.y <= 0 && tLeft <= HOP_V / P_GRAV + 0.01 && tLeft > 0.12) inp.hop = true;
  // the swing, timed so the strike moment meets the shuttle, with a little spread
  if (ai.press < 0) ai.press = ai.at + ai.t - STRIKE + gauss(m) * st.timing + (ai.aim > 0 && ai.y - (ai.hop ? 0.45 : 0) > OVERHEAD && !ai.hop ? 0.02 : 0);
  if (m.t >= ai.press && p.swingT < 0 && ai.swung !== s.hits) { inp.swing = true; ai.swung = s.hits; }
  if (p.swingT >= 0 || m.t >= ai.press) {
    inp.aim = ai.aim;
    // stay put while swinging so the aim does not walk the toy away
    if (Math.abs(p.x - ai.x) < 0.25) inp.move = 0;
  }
  return inp;
}

function seek(p: Player, x: number): -1 | 0 | 1 {
  const d = x - p.x;
  if (Math.abs(d) < 0.06) return 0;
  // ease in so it doesn't overshoot
  if (Math.abs(d) < Math.abs(p.vx) * Math.abs(p.vx) / (2 * ACCEL) + 0.02 && Math.sign(p.vx) === Math.sign(d)) return 0;
  return d > 0 ? 1 : -1;
}

function estimateArrival(s: Shuttle, side: Side) {
  const b = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
  for (let k = 0; k < 400; k++) { flyStep(b); if (b.y <= 0) return 9; if (b.x * sgn(side) > 0.1) return k * DT; }
  return 9;
}

/** Choose where to meet the shuttle: run its flight forward (as the toy reads it) and pick the best reachable point. */
function plan(m: Match, i: number, zoneLo: number, zoneHi: number) {
  const p = m.players[i], st = p.style, s = m.shuttle, ai = p.ai, dir = sgn(p.side), fc = face(p.side);
  const closeness = Math.min(1, Math.hypot(s.x - p.x, s.y) / 6);
  const k = 1 + ai.bias * closeness;
  const b = { x: s.x, y: s.y, vx: s.vx * k, vy: s.vy * (1 + ai.bias * 0.5 * closeness) };
  const vmax = RUN * st.speed * speedFactor(p.spring) * 0.94;
  let best = -1e9, pick: { x: number; y: number; t: number; hop: boolean; h: number } | null = null;
  const canHop = p.spring > 0.12;
  const opp = m.players.filter((q) => q.side !== p.side);
  const oppD = opp.length ? Math.min(...opp.map((q) => Math.abs(q.x))) : 2.5;
  let fallback: { x: number; y: number; t: number; hop: boolean; h: number } | null = null;
  for (let n = 1; n < 360; n++) {
    flyStep(b);
    if (b.y <= 0.02) break;
    if (n % 2) continue;
    const t = n * DT;
    if (b.x * dir < 0.05) continue; // still over there
    const want = b.x - fc * 0.3; // meet it a little in front
    const d = want * dir;
    if (d < zoneLo - 0.05 || d > zoneHi + 0.05) continue;
    const reachT = Math.max(0, Math.abs(want - p.x) - 0.15) / vmax + 0.06;
    const slack = t - reachT;
    if (slack < 0) continue;
    // contact height above the feet: standing, or mid-hop (feet about HOP_TOP up) for a smash
    const standOk = b.y <= REACH.high - 0.04;
    const hopOk = canHop && st.hop > 0 && !st.only && b.y - HOP_TOP > OVERHEAD + 0.08 && b.y - HOP_TOP < REACH.high - 0.05 && t > 0.34;
    if (!standOk && !hopOk) continue;
    const hStand = b.y;
    if (!fallback || t > fallback.t) fallback = { x: want, y: b.y, t, hop: !standOk, h: hStand };
    for (const hop of [false, true]) {
      if (hop ? !hopOk : !standOk) continue;
      let score = -t * 0.35; // take it early when you can
      if (hStand < 0.25) score -= 1.2; // don't scrape it off the floor
      if (!hop && hStand > OVERHEAD) score += 0.4 + st.deep * 0.5;
      if (hop) score += 0.3 + st.hop * 1.4 + (Math.abs(b.x) < 2.6 ? 0.4 : 0);
      if (st.only === 'drive') score += hStand >= LOW && hStand <= OVERHEAD ? 1.5 : 0;
      if (Math.abs(b.x) < 1.35 && hStand < OVERHEAD) score += st.net * 0.9;
      if (slack < 0.08) score -= 0.4; // tight: a lunge
      if (score > best) { best = score; pick = { x: want, y: b.y, t, hop, h: hStand }; }
    }
  }
  pick = pick ?? fallback;
  if (!pick) { ai.at = -1; return; }
  const hop = pick.hop;
  ai.at = m.t; ai.x = pick.x; ai.y = pick.y; ai.t = pick.t; ai.hop = hop;
  // the aim: away from the opponent when it is smart, otherwise by taste
  let aim: Aim = 0;
  const r = rand(m);
  if (r < st.smart) aim = oppD < 2.3 ? 1 : oppD > 3.0 ? -1 : (rand(m) < 0.5 ? -1 : 1);
  else { const q = rand(m); aim = q < st.net * 0.6 ? -1 : q < st.net * 0.6 + st.deep * 0.6 ? 1 : 0; }
  ai.aim = aim;
  ai.press = -1;
}

// ---- results, medals and the save
export type Medals = { win: boolean; key: boolean; margin: boolean };
export type Save = {
  v: 1;
  ladder: Partial<Record<ToyId, Medals>>;
  doubles: Record<string, boolean>;
  who: 'dora' | 'enzo';
  court: CourtId;
  tutorial: boolean; ending: boolean;
  settings: { sound: boolean; music: boolean };
  played: number; wins: number;
};
export type CourtId = 'shop' | 'biscuit' | 'musicbox' | 'train';
export const COURTS: { id: CourtId; name: string; need: number; note: string }[] = [
  { id: 'shop', name: 'Toyshop tin court', need: 0, note: 'The classic lithographed board.' },
  { id: 'biscuit', name: 'Biscuit-tin court', need: 2, note: 'Beat two toys on the ladder.' },
  { id: 'musicbox', name: 'Music-box court', need: 5, note: 'Beat five toys on the ladder.' },
  { id: 'train', name: 'Toy-train court', need: 7, note: 'Win the Clockwork Cup.' },
];
export const DOUBLES_AT = 4; // ladder wins to unlock doubles

export function blankSave(): Save {
  return { v: 1, ladder: {}, doubles: {}, who: 'dora', court: 'shop', tutorial: false, ending: false, settings: { sound: true, music: true }, played: 0, wins: 0 };
}
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(Math.min(v, 1e7)) : 0);
/** Reads a stored save defensively: anything wrong is ignored, never misread. */
export function readSave(raw: string | null | undefined): Save {
  const s = blankSave();
  if (!raw) return s;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object' || (o as { v?: unknown }).v !== 1) return s;
  const r = o as Record<string, unknown>;
  if (r.ladder && typeof r.ladder === 'object') {
    for (const id of TOY_IDS) {
      const m = (r.ladder as Record<string, unknown>)[id];
      if (m && typeof m === 'object') {
        const q = m as Record<string, unknown>;
        if (q.win === true) s.ladder[id] = { win: true, key: q.key === true, margin: q.margin === true };
      }
    }
  }
  if (r.doubles && typeof r.doubles === 'object') for (const p of PAIRS) if ((r.doubles as Record<string, unknown>)[p.id] === true) s.doubles[p.id] = true;
  if (r.who === 'dora' || r.who === 'enzo') s.who = r.who;
  if (typeof r.court === 'string' && COURTS.some((c) => c.id === r.court)) s.court = r.court as CourtId;
  if (!courtOpen(s, s.court)) s.court = 'shop';
  s.tutorial = bool(r.tutorial, false); s.ending = bool(r.ending, false);
  if (r.settings && typeof r.settings === 'object') {
    const st = r.settings as Record<string, unknown>;
    s.settings = { sound: bool(st.sound, true), music: bool(st.music, true) };
  }
  s.played = count(r.played); s.wins = count(r.wins);
  return s;
}
export const ladderWins = (s: Save) => TOY_IDS.filter((id) => s.ladder[id]?.win).length;
/** The next toy to beat: the ladder opens one rung at a time. */
export const unlockedRung = (s: Save) => Math.min(TOYS.length - 1, ladderWins(s));
export const toyOpen = (s: Save, id: ToyId) => TOY_IDS.indexOf(id) <= unlockedRung(s) || !!s.ladder[id]?.win;
export const courtOpen = (s: Save, c: CourtId) => ladderWins(s) >= (COURTS.find((k) => k.id === c)?.need ?? 99);
export const doublesOpen = (s: Save) => ladderWins(s) >= DOUBLES_AT;
export const medalCount = (s: Save) => TOY_IDS.reduce((n, id) => n + (s.ladder[id] ? +s.ladder[id]!.win + +s.ladder[id]!.key + +s.ladder[id]!.margin : 0), 0);

/** The medals a finished match earns for the left side (the player). */
export function medalsFor(m: Match): Medals {
  const win = m.winner === 0;
  const me = m.players.filter((p) => p.side === 0 && p.human);
  const key = win && me.every((p) => !p.ranOut);
  const pts = m.gameLog.reduce((a, g) => [a[0] + g[0], a[1] + g[1]], [0, 0]);
  return { win, key, margin: win && pts[0] - pts[1] >= 5 };
}
/** Records a finished match in the save; returns what it newly earned. */
export function recordMatch(save: Save, m: Match) {
  const out = { medals: { win: false, key: false, margin: false } as Medals, court: null as CourtId | null, doubles: false, ending: false };
  if (m.phase !== 'over') return out;
  save.played++;
  if (m.winner === 0) save.wins++;
  if (m.setup.mode === 'ladder' && m.setup.foe) {
    const before = ladderWins(save), had = save.ladder[m.setup.foe] ?? { win: false, key: false, margin: false };
    const got = medalsFor(m);
    if (got.win) {
      const now = { win: true, key: had.key || got.key, margin: had.margin || got.margin };
      out.medals = { win: !had.win, key: now.key && !had.key, margin: now.margin && !had.margin };
      save.ladder[m.setup.foe] = now;
      const after = ladderWins(save);
      const c = COURTS.find((k) => k.need > before && k.need <= after);
      if (c) out.court = c.id;
      if (before < DOUBLES_AT && after >= DOUBLES_AT) out.doubles = true;
      if (m.setup.foe === 'bear' && !save.ending) { save.ending = true; out.ending = true; }
    }
  }
  if (m.setup.mode === 'doubles' && m.setup.pair && m.winner === 0) save.doubles[m.setup.pair] = true;
  return out;
}

/** Plays a match to the end with the given input function (for the bots and tests). */
export function playMatch(m: Match, input: (m: Match, i: number) => Input | null, maxSteps = 120 * 60 * 30) {
  const ins: (Input | null)[] = m.players.map(() => null);
  for (let k = 0; k < maxSteps && m.phase !== 'over'; k++) {
    for (let i = 0; i < m.players.length; i++) ins[i] = m.players[i].human ? input(m, i) : null;
    step(m, ins);
    m.events.length = 0;
  }
  return m;
}

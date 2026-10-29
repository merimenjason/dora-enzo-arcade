// Seedstorm's rules: a cosy vertical shoot-'em-up. Dora and Enzo ride dandelion-seed gliders up through five skies,
// dodging pretty patterns of petals, seeds and raindrops, puffing storm critters into fluff and calming five bosses.
// Deterministic and DOM-free: the game runs in fixed 1/60 s ticks, every random choice comes from a seeded generator,
// and bullets live in fixed-size pools, so a seed and the same inputs replay a run exactly. Drawing lives in
// seedstorm-scene.ts.

// ---------------------------------------------------------------- the field
/** The playfield in its own units, portrait; the scene scales it to the screen. */
export const W = 360, H = 640;
/** Ticks per second. */
export const HZ = 60;
export const DT = 1 / HZ;
const TAU = Math.PI * 2;
/** The pilot's hitbox radius (a dot at the chest) and how close a bullet must pass to count as a graze. */
export const HITBOX = 2.5, GRAZE = 16;
/** Where the pilot may fly: a small margin at the sides, a little more at the top. */
export const BOUNDS = { x0: 10, x1: W - 10, y0: 30, y1: H - 14 };
export const START = { x: W / 2, y: 560 };
/** Focus multiplies the pilot's speed by this. */
export const FOCUS_SLOW = 0.45;
/** Fixed pool sizes: nothing is allocated for these while a stage runs. */
export const CAPS = { bullets: 700, shots: 160, seeds: 320, critters: 48 };
/** Invulnerable ticks after losing a heart, after a Bloom, and when a stage starts or a run continues. */
export const INVULN = { hit: 120, bloom: 180, start: 90 };
/** Ticks after a hit in which a Bloom cancels it. */
export const LAST_GASP = 12;
/** On Breezy and Gusty, critters fire less often in the first two stages while pilots find their wings. */
export const EARLY = [0.75, 0.85, 1, 1, 1];
/** Bullets within this distance of the pilot vanish when a heart is lost. */
export const HIT_CLEAR = 110;
/**
 * Bloom, the bomb: held at the start, the cap before Bloom Pouches, the meter size, what fills it, damage to critters
 * and bosses, and how long the petal ring takes to sweep the screen (it turns every bullet it passes into a seed).
 */
export const BLOOM = { start: 2, cap: 3, meter: 100, graze: 1.6, seed: 0.35, kill: 1, damage: 40, bossDamage: 50, sweep: 45, speed: 16 };
/** The Breeze multiplier: kills within `window` ticks of each other add `step`, up to `max`; it decays by `decay` a tick otherwise. */
export const BREEZE = { window: 90, step: 0.1, max: 5, decay: 0.01 };
/** Seeds: score and purse value (small and big), magnet radius and how much each Magnet Paws adds, pickup radius, fall speed. */
export const SEED = { score: 10, bigScore: 50, purse: 1, bigPurse: 5, pull: 44, pullPer: 26, collect: 15, fall: 1.1, top: H * 0.25, fly: 9 };
/** Points: graze, Clear Sky (base, per stage, per second left), a boss phase, a no-hit stage (per stage) and each Bloom held at a stage's end. */
export const SCORE = { graze: 5, clearSky: 2000, clearSkyStage: 1000, clearSkySecond: 50, phase: 1000, noHit: 5000, bloomLeft: 1000 };
/** Auto-fire: a volley every this many ticks. */
export const FIRE_EVERY = 5;
export const HEART_CAP = 8;

// ---------------------------------------------------------------- pilots
export type Pilot = 'dora' | 'enzo';
export const PILOTS: Record<Pilot, { name: string; speed: number; shot: string; blurb: string; wing: Pilot }> = {
  dora: { name: 'Dora', speed: 3.7, shot: 'Petal Spread', wing: 'enzo', blurb: 'Quick on the breeze. Petal Spread fans out wide to catch critters all over the sky.' },
  enzo: { name: 'Enzo', speed: 3.1, shot: 'Pebble Lance', wing: 'dora', blurb: 'Steady as a rock. Pebble Lance is a narrow, strong stream that pierces small critters.' },
};
/** Shot numbers: Dora's petal damage and speed; Enzo's pebble damage and speed; the wingmate's homing seed. */
export const SHOT = { petal: 1, petalSpeed: 10, pebble: 1.45, pebbleSpeed: 12, wing: 2.2, wingSpeed: 7, wingTurn: 0.15 };
/** The wingmate fires a homing seed every this many volleys (25, 20, 15 and 10 ticks), by Wingmate Wings level 0 to 3. */
export const WING_EVERY = [5, 4, 3, 2];

// ---------------------------------------------------------------- difficulty
export type Diff = 'breezy' | 'gusty' | 'stormy';
export const DIFF_IDS: Diff[] = ['breezy', 'gusty', 'stormy'];
/** speed: bullet speed; density: bullets per ring, fan and curtain; rate: how often things fire; bossHp: boss health. */
export const DIFFS: Record<Diff, { name: string; blurb: string; speed: number; density: number; rate: number; critters: number; bossHp: number; hearts: number; continues: boolean }> = {
  breezy: { name: 'Breezy', blurb: 'Gentle and slow, with five hearts. Lovely for little pilots.', speed: 0.62, density: 0.45, rate: 0.55, critters: 0.85, bossHp: 0.7, hearts: 5, continues: true },
  gusty: { name: 'Gusty', blurb: 'The proper storm: three hearts, continues if you need them.', speed: 1, density: 1, rate: 1, critters: 1, bossHp: 1, hearts: 3, continues: true },
  stormy: { name: 'Stormy', blurb: 'For expert pilots: faster, thicker patterns, tougher bosses and no continues.', speed: 1.25, density: 1.5, rate: 1.45, critters: 1, bossHp: 1.3, hearts: 3, continues: false },
};

// ---------------------------------------------------------------- shop
export type UpId = 'power' | 'wings' | 'heart' | 'pouch' | 'magnet';
export const UP_IDS: UpId[] = ['power', 'wings', 'heart', 'pouch', 'magnet'];
/** `max` is the highest level (Shot Power starts at 1, the rest at 0); price = base × growth^(bought so far), to the nearest 10. */
export const UPGRADES: Record<UpId, { name: string; icon: string; text: string; max: number; base: number; growth: number }> = {
  power: { name: 'Shot Power', icon: '🌼', text: 'More petals or pebbles in every volley.', max: 4, base: 250, growth: 1.8 },
  wings: { name: 'Wingmate Wings', icon: '🪶', text: 'Your wingmate fires homing seeds faster.', max: 3, base: 180, growth: 1.7 },
  heart: { name: 'Extra Heart', icon: '💗', text: 'One more heart. Once per shop.', max: HEART_CAP, base: 300, growth: 1.5 },
  pouch: { name: 'Bloom Pouch', icon: '👝', text: 'Carry one more Bloom.', max: 4, base: 200, growth: 1.6 },
  magnet: { name: 'Magnet Paws', icon: '🧲', text: 'Seeds drift to you from further away.', max: 2, base: 120, growth: 1.8 },
};
export type Ups = { power: number; wings: number; pouch: number; magnet: number };
export const freshUps = (): Ups => ({ power: 1, wings: 0, pouch: 0, magnet: 0 });

// ---------------------------------------------------------------- randomness
/** mulberry32 with its state on show. */
export class Rng {
  constructor(public s: number) { this.s = s >>> 0; }
  next() { this.s = (this.s + 0x6d2b79f5) >>> 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(n: number) { return Math.floor(this.next() * n); }
}

// ---------------------------------------------------------------- bullets
/** How a bullet looks (and its hit radius): petal, seed (also buttons and hail), raindrop, spark, crabapple, star. */
export const LOOK = { petal: 0, seed: 1, drop: 2, spark: 3, apple: 4, star: 5 } as const;
export const LOOK_R = [3.4, 3.2, 3, 2.6, 5.5, 3.8];
/** Bullet colours, picked per pattern: pink, gold, sky, mint, violet, apple red, white, orange. */
export const HUE = { pink: 0, gold: 1, sky: 2, mint: 3, violet: 4, red: 5, white: 6, orange: 7 } as const;
/** What a bullet does at tick `at`: nothing, turn to the pilot at `thenSpd`, or stop and fall under gravity `thenSpd`. */
export const THEN = { none: 0, aim: 1, fall: 2 } as const;

export type Bullet = {
  on: boolean; i: number; x: number; y: number; vx: number; vy: number; r: number; look: number; hue: number; t: number;
  /** speed change a tick, clamped between minS and maxS */
  acc: number; minS: number; maxS: number;
  /** turn a tick, as a cosine and sine (sine 0 means no turning) */
  tc: number; ts: number;
  grav: number; bounce: number;
  at: number; then: number; thenSpd: number;
  /** steer toward the pilot until tick homeTil, at most homeRate radians a tick */
  homeTil: number; homeRate: number;
  /** a sideways wiggle across the direction of travel */
  wav: number; wavF: number;
  grazed: boolean;
};
const newBullet = (i: number): Bullet => ({ on: false, i, x: 0, y: 0, vx: 0, vy: 0, r: 3, look: 0, hue: 0, t: 0, acc: 0, minS: 0, maxS: 99, tc: 1, ts: 0, grav: 0, bounce: 0, at: 0, then: 0, thenSpd: 0, homeTil: 0, homeRate: 0, wav: 0, wavF: 0, grazed: false });

/**
 * Moves one bullet a tick. Exported so the test bot can look ahead: everything here depends only on the bullet and on
 * where the pilot is.
 */
export function moveBullet(b: Bullet, px: number, py: number) {
  b.t++;
  if (b.at && b.t === b.at) {
    if (b.then === THEN.aim) { const a = Math.atan2(py - b.y, px - b.x); b.vx = Math.cos(a) * b.thenSpd; b.vy = Math.sin(a) * b.thenSpd; b.acc = 0; b.maxS = 99; }
    else if (b.then === THEN.fall) { b.vx *= 0.15; b.vy = 0.2; b.acc = 0; b.grav = b.thenSpd; b.maxS = 5; }
  }
  if (b.homeTil && b.t < b.homeTil) {
    const want = Math.atan2(py - b.y, px - b.x), cur = Math.atan2(b.vy, b.vx), s = Math.hypot(b.vx, b.vy);
    let d = want - cur; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    const a = cur + Math.max(-b.homeRate, Math.min(b.homeRate, d));
    b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
  }
  if (b.ts !== 0) { const vx = b.vx * b.tc - b.vy * b.ts; b.vy = b.vx * b.ts + b.vy * b.tc; b.vx = vx; }
  if (b.acc !== 0) {
    const s = Math.hypot(b.vx, b.vy), n = Math.max(b.minS, Math.min(b.maxS, s + b.acc));
    if (s > 1e-6) { b.vx *= n / s; b.vy *= n / s; } else if (n > 0) b.vy = n;
  }
  if (b.grav !== 0) { b.vy += b.grav; if (b.vy > b.maxS) b.vy = b.maxS; }
  b.x += b.vx; b.y += b.vy;
  if (b.wav !== 0) {
    const s = Math.hypot(b.vx, b.vy);
    if (s > 1e-6) { const k = b.wav * b.wavF * Math.cos(b.t * b.wavF) / s; b.x -= b.vy * k; b.y += b.vx * k; }
  }
  if (b.bounce > 0 && ((b.x < b.r && b.vx < 0) || (b.x > W - b.r && b.vx > 0))) { b.vx = -b.vx; b.bounce--; }
}
/** True when a bullet has left the field for good. */
export const bulletGone = (b: Bullet) => b.x < -30 || b.x > W + 30 || b.y > H + 30 || (b.y < -30 && (b.t > 90 || b.vy < 0) && b.grav <= 0);

// ---------------------------------------------------------------- critters
export type CritterKind = 'bumble' | 'kite' | 'beetle' | 'sprout' | 'moth' | 'wisp';
export const CRITTER_IDS: CritterKind[] = ['bumble', 'kite', 'beetle', 'sprout', 'moth', 'wisp'];
/** Base health (times 1 + 0.3 a stage after the first), body radius, points and seeds dropped. */
export const CRITTERS: Record<CritterKind, { name: string; hp: number; r: number; points: number; seeds: number }> = {
  bumble: { name: 'Bumble', hp: 8, r: 12, points: 150, seeds: 3 },
  kite: { name: 'Kite', hp: 5, r: 11, points: 120, seeds: 2 },
  beetle: { name: 'Beetle', hp: 22, r: 14, points: 300, seeds: 5 },
  sprout: { name: 'Sprout', hp: 12, r: 13, points: 200, seeds: 3 },
  moth: { name: 'Moth', hp: 9, r: 12, points: 180, seeds: 3 },
  wisp: { name: 'Wisp', hp: 6, r: 10, points: 160, seeds: 2 },
};
/** Critters with at most this much base health count as small: Enzo's pebbles pierce them. */
export const SMALL_HP = 12;
export const critterHp = (kind: CritterKind, stage: number) => Math.round(CRITTERS[kind].hp * (1 + 0.3 * (stage - 1)));

export type Exit = 'up' | 'down' | 'left' | 'right';
/** How a critter flies, as a pure function of its age, so a wave is the same every time. */
export type Path =
  | { k: 'stop'; sx: number; tx: number; ty: number; enter: number; stay: number; exit: Exit }
  | { k: 'arc'; dir: 1 | -1; y: number; speed: number; dip: number }
  | { k: 'drift'; x: number; vx: number; vy: number; amp: number; f: number }
  | { k: 'swoop'; tx: number; ty: number; dir: 1 | -1 };
export function pathAt(p: Path, t: number, out: { x: number; y: number }) {
  switch (p.k) {
    case 'stop': {
      const e = Math.min(1, t / p.enter), k = 1 - (1 - e) ** 3;
      out.x = p.sx + (p.tx - p.sx) * k; out.y = -24 + (p.ty + 24) * k;
      const u = t - p.enter - p.stay;
      if (u > 0) { const d = 0.5 * u + 0.03 * u * u; if (p.exit === 'up') out.y -= d; else if (p.exit === 'down') out.y += d; else if (p.exit === 'left') out.x -= d; else out.x += d; }
      return;
    }
    case 'arc': {
      const x0 = p.dir > 0 ? -20 : W + 20; out.x = x0 + p.dir * p.speed * t;
      const prog = Math.max(0, Math.min(1, ((out.x - x0) * p.dir) / (W + 40))); out.y = p.y + p.dip * Math.sin(Math.PI * prog);
      return;
    }
    case 'drift': out.x = p.x + p.vx * t + p.amp * Math.sin(t * p.f); out.y = -20 + p.vy * t; return;
    case 'swoop': {
      if (t < 60) { const e = t / 60, k = 1 - (1 - e) ** 3; out.x = p.tx - p.dir * 60 + p.dir * 60 * k; out.y = -24 + (p.ty + 24) * k; return; }
      const u = t - 60; out.x = p.tx + p.dir * (u * 1.6 + 0.004 * u * u); out.y = p.ty + 1.2 * u - 0.02 * u * u; return;
    }
  }
}

export type GunKind = 'aim' | 'fan' | 'ring' | 'spiral' | 'drop' | 'burst';
/** A critter's gun: the pattern, ticks between shots and before the first, bullets, spread (fans), speed, look and colour. */
export type Gun = { p: GunKind; every: number; first: number; n: number; spread: number; spd: number; look: number; hue: number; max: number };
export type Critter = {
  on: boolean; i: number; id: number; kind: CritterKind; x: number; y: number; vx: number; vy: number; hp: number; max: number; r: number; t: number;
  path: Path; gun: Gun | null; shots: number; spin: number; flash: number; seen: boolean;
};
const newCritter = (i: number): Critter => ({ on: false, i, id: 0, kind: 'bumble', x: 0, y: 0, vx: 0, vy: 0, hp: 1, max: 1, r: 10, t: 0, path: { k: 'drift', x: 0, vx: 0, vy: 1, amp: 0, f: 0 }, gun: null, shots: 0, spin: 0, flash: 0, seen: false });

// ---------------------------------------------------------------- shots and seeds
/** 0 Dora's petal, 1 Enzo's pebble, 2 the wingmate's homing seed. */
export type Shot = { on: boolean; i: number; x: number; y: number; vx: number; vy: number; dmg: number; kind: number; pierce: boolean; hits: number[]; t: number };
const newShot = (i: number): Shot => ({ on: false, i, x: 0, y: 0, vx: 0, vy: 0, dmg: 1, kind: 0, pierce: false, hits: [], t: 0 });
export type Seed = { on: boolean; i: number; x: number; y: number; vx: number; vy: number; t: number; big: boolean; home: number; pulled: boolean };
const newSeed = (i: number): Seed => ({ on: false, i, x: 0, y: 0, vx: 0, vy: 0, t: 0, big: false, home: 0, pulled: false });

// ---------------------------------------------------------------- bosses
export type BossId = 'magpie' | 'crow' | 'cloud' | 'owl' | 'storm' | 'bumbleQueen' | 'kiteCaptain' | 'sproutChief' | 'mothMatron' | 'wispWarden';
export type Move = 'hover' | 'sway' | 'swoop' | 'track' | 'still' | 'circle';
export type PhaseDef = { name: string; hp: number; time: number; move: Move; fire: (g: SeedstormGame, b: Boss, t: number) => void };
export type Speaker = 'pilot' | 'wing' | 'boss';
export type Line = { who: Speaker; text: string };
export type BossDef = { id: BossId; name: string; art: string; r: number; y: number; mid: boolean; chat: Line[]; friends: Line[]; phases: PhaseDef[] };
export type BossState = 'enter' | 'fight' | 'break' | 'calm' | 'leave';
export type Boss = {
  def: BossDef; x: number; y: number; vx: number; vy: number; hp: number; max: number; phase: number; state: BossState; t: number;
  timer: number; time: number; hit: boolean; flash: number; aim: number; clearSky: number;
};

const P = LOOK, C = HUE;
/** A ring, a spiral or a fan fired from the boss's chest. */
const chest = (b: Boss) => b.y + b.def.r * 0.35;

const MAGPIE: BossDef = {
  id: 'magpie', name: 'Gale the Magpie', art: 'boss-magpie', r: 32, y: 152, mid: false,
  chat: [
    { who: 'boss', text: 'Halt, fluffballs! Not one more gust gets past me. Every button up here is MINE. Finders keepers!' },
    { who: 'pilot', text: 'Gale, those buttons came off everybody’s washing!' },
    { who: 'wing', text: 'Did the storm blow your own collection away?' },
    { who: 'boss', text: '…Every last shiny one. Now flap off!' },
  ],
  friends: [
    { who: 'boss', text: 'You’ll help me find my real buttons? Oh. Oh, that’s rather nice of you.' },
    { who: 'pilot', text: 'Of course! And the washing goes back on the line.' },
  ],
  phases: [
    { name: 'Button Barrage', hp: 400, time: 40, move: 'sway', fire: (g, b, t) => {
      if (g.every(t, 40, 20)) g.fan(b.x, chest(b), 7, 0.7, 2.4, g.aimFrom(b.x, chest(b)), P.seed, C.gold);
      if (g.every(t, 80, 50)) g.ring(b.x, b.y, 22, 1.7, t * 0.013, P.petal, C.pink);
    } },
    { name: 'Feather Flurry', hp: 600, time: 45, move: 'hover', fire: (g, b, t) => {
      if (g.every(t, 5)) for (const s of [-1, 1]) g.spiral(b.x + s * 30, b.y + 4, 3, 2.1, Math.PI / 2 + s * t * 0.045, P.petal, s < 0 ? C.sky : C.white);
      if (g.every(t, 120, 60)) g.fan(b.x, chest(b), 3, 0.3, 2.8, g.aimFrom(b.x, chest(b)), P.seed, C.gold);
    } },
    { name: 'Shiny Swoop', hp: 520, time: 50, move: 'swoop', fire: (g, b, t) => {
      if (g.every(t, 18)) for (const s of [-1, 1]) { const x = g.shoot(b.x, chest(b), Math.PI / 2 + s * (0.45 + 0.35 * Math.sin(t * 0.05)), 2.4, P.petal, C.pink); if (x) x.bounce = 1; }
      if (g.every(t, 80, 40)) g.ring(b.x, chest(b), 18, 3, t * 0.02, P.seed, C.gold, (x) => { x.acc = -0.06 * g.diff.speed; x.at = 56; x.then = THEN.aim; x.thenSpd = 3 * g.diff.speed; });
    } },
  ],
};
const CROW: BossDef = {
  id: 'crow', name: 'Crabapple Crow', art: 'boss-crow', r: 32, y: 148, mid: false,
  chat: [
    { who: 'boss', text: 'Caw! The wind keeps whipping my hat off, and every crabapple in the orchard lands on my head!' },
    { who: 'pilot', text: 'So now you’re throwing them at everybody else?' },
    { who: 'boss', text: 'Fair’s fair! Heads up!' },
  ],
  friends: [
    { who: 'boss', text: 'A chin strap made of daisy chain? Why… it fits like a dream.' },
    { who: 'wing', text: 'And the apples can stay in the bag. Pie later?' },
  ],
  phases: [
    { name: 'Crabapple Cascade', hp: 600, time: 42, move: 'sway', fire: (g, b, t) => {
      if (g.every(t, 44)) for (let i = 0; i < g.dn(7); i++) { const vx = (i - (g.dn(7) - 1) / 2) * 0.55 + g.rng.range(-0.2, 0.2), vy = -3; const x = g.shoot(b.x, b.y, Math.atan2(vy, vx), Math.hypot(vx, vy), P.apple, C.red); if (x) { x.grav = 0.05 * g.diff.speed; x.maxS = 3.6 * g.diff.speed; } }
      if (g.every(t, 30, 15)) g.fan(b.x, chest(b), 3, 0.3, 3, g.aimFrom(b.x, chest(b)), P.seed, C.gold);
    } },
    { name: 'Wobbly Windfall', hp: 840, time: 46, move: 'hover', fire: (g, b, t) => {
      if (g.every(t, 60)) g.fan(b.x, chest(b), 3, 1, 1.7, g.aimFrom(b.x, chest(b)), P.apple, C.red, (x, i) => { x.homeTil = 100; x.homeRate = 0.022; x.wav = 10; x.wavF = 0.12 + i * 0.01; });
      if (g.every(t, 40, 20)) g.ring(b.x, b.y, 24, 1.9, t * 0.01, P.seed, C.sky);
    } },
    { name: 'Scarecrow Shuffle', hp: 920, time: 50, move: 'track', fire: (g, b, t) => {
      if (g.every(t, 24)) g.curtain(20, W / 2 + 110 * Math.sin(t * 0.012), 68, 2, P.petal, C.mint);
      if (g.every(t, 75, 40)) g.fan(b.x, chest(b), 3, 0.32, 3, g.aimFrom(b.x, chest(b)), P.apple, C.orange);
    } },
  ],
};
const CLOUD: BossDef = {
  id: 'cloud', name: 'Rumble', art: 'boss-cloud', r: 40, y: 150, mid: false,
  chat: [
    { who: 'boss', text: 'BOOM! …Oh, sorry. I only meant to sing, but it always comes out as thunder.' },
    { who: 'wing', text: 'Is that why everyone hides indoors?' },
    { who: 'boss', text: 'Every single time! Fine. If nobody listens, I’ll RUMBLE!' },
    { who: 'pilot', text: 'We’re listening! Sort of. Hold that note!' },
  ],
  friends: [
    { who: 'boss', text: 'You stayed for the whole song? …Encore?' },
    { who: 'pilot', text: 'Maybe a quieter one. At bedtime.' },
  ],
  phases: [
    { name: 'Static Spiral', hp: 1000, time: 45, move: 'hover', fire: (g, b, t) => {
      const dir = Math.floor(t / 240) % 2 ? -1 : 1;
      if (g.every(t, 4)) g.spiral(b.x, b.y, 5, 2.3, dir * t * 0.024, P.spark, C.gold);
      if (g.every(t, 80, 40)) g.ring(b.x, b.y, 14, 1.4, t * 0.05, P.drop, C.sky);
    } },
    { name: 'Slow Drizzle, Fast Pour', hp: 860, time: 48, move: 'sway', fire: (g, b, t) => {
      const tri = Math.abs(((t * 0.0032) % 2) - 1);
      if (g.every(t, 26)) g.curtain(20, 50 + tri * (W - 100), 76, 0.5, P.drop, C.sky, (x) => { x.acc = 0.035 * g.diff.speed; x.maxS = 3.4 * g.diff.speed; });
      if (g.every(t, 64, 32)) g.fan(b.x, chest(b), 3, 0.4, 2.4, g.aimFrom(b.x, chest(b)), P.spark, C.gold);
    } },
    { name: 'Thunder Drum', hp: 1180, time: 52, move: 'still', fire: (g, b, t) => {
      const m = t % 64;
      if (m === 0) g.ring(b.x, b.y, 28, 2.6, t * 0.011, P.spark, C.gold);
      if (m === 8) g.ring(b.x, b.y, 28, 1.9, t * 0.011 + Math.PI / 28, P.spark, C.orange);
      if (g.every(t, 128, 32)) g.ring(b.x, chest(b), 14, 3, t * 0.03, P.seed, C.violet, (x) => { x.acc = -0.07 * g.diff.speed; x.at = 50; x.then = THEN.aim; x.thenSpd = 3.2 * g.diff.speed; });
    } },
  ],
};
const OWL: BossDef = {
  id: 'owl', name: 'Madame Hoot', art: 'boss-owl', r: 34, y: 150, mid: false,
  chat: [
    { who: 'boss', text: 'Hoo. Such a racket. I have not slept a wink, and the moon is already up.' },
    { who: 'pilot', text: 'The storm kept you awake too?' },
    { who: 'boss', text: 'Then you shall dance until you are as tired as I am. One, two, three…' },
  ],
  friends: [
    { who: 'boss', text: 'Hoo… a lullaby on dandelion fluff. How very soothing. Goodnight, my dears.' },
    { who: 'wing', text: 'Sweet dreams, Madame Hoot!' },
  ],
  phases: [
    { name: 'Moonmoth Waltz', hp: 1200, time: 45, move: 'circle', fire: (g, b, t) => {
      const m = t % 72, dir = Math.floor(t / 72) % 2 ? 1 : -1;
      if (m === 0) g.ring(b.x, b.y, 28, 2.3, t * 0.01, P.petal, C.violet, (x) => g.turn(x, dir * 0.006));
      if (m === 24 || m === 48) g.ring(b.x, b.y, 18, 1.6, t * 0.02, P.petal, C.white, (x) => g.turn(x, -dir * 0.008));
    } },
    { name: 'Starry Shawl', hp: 1300, time: 48, move: 'hover', fire: (g, b, t) => {
      if (g.every(t, 28)) for (let k = 0; k < 4; k++) { const a = t * 0.015 + (k * TAU) / 4; g.ring(b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 50, 8, 1.6, t * 0.05 + k, P.star, C.gold); }
      if (g.every(t, 100, 50)) for (const a of [-0.9, -0.4, 0.4, 0.9]) { const x = g.shoot(b.x, chest(b), Math.PI / 2 + a, 2.2, P.star, C.white); if (x) x.bounce = 1; }
    } },
    { name: 'Hoot Hoot Hush', hp: 1050, time: 52, move: 'sway', fire: (g, b, t) => {
      const m = t % 160;
      if (m === 0 || m === 22) g.ring(b.x, b.y, 36, 1.5, (m ? Math.PI / 36 : 0) + t * 0.003, P.star, C.white);
      if (m === 70) b.aim = g.aimFrom(b.x, chest(b));
      if (m >= 70 && m <= 110 && m % 6 === 4) for (const o of [-0.22, 0, 0.22]) g.shoot(b.x, chest(b), b.aim + o, 4, P.seed, C.violet);
      if (m === 120) g.fan(b.x, chest(b), 7, 1.2, 2.2, g.aimFrom(b.x, chest(b)), P.petal, C.pink);
    } },
  ],
};
const STORM: BossDef = {
  id: 'storm', name: 'The Grumble Storm', art: 'boss-storm', r: 46, y: 156, mid: false,
  chat: [
    { who: 'boss', text: 'GRRRUMBLE! Every time I come out to play, everybody runs inside!' },
    { who: 'pilot', text: 'Because you blow the washing away and soak all the hay!' },
    { who: 'boss', text: 'Then I’ll blow and BLOW until somebody plays with me!' },
    { who: 'wing', text: 'Okay, let’s play! But we’re going to win.' },
  ],
  friends: [
    { who: 'boss', text: '…You played with me. All the way up here. Can I be a small cloud now? A friendly one?' },
    { who: 'pilot', text: 'Only if you rain on the garden. Gently!' },
  ],
  phases: [
    { name: 'Grumble Gust', hp: 1250, time: 45, move: 'sway', fire: (g, b, t) => {
      const side = Math.floor(t / 240) % 2 ? -1 : 1;
      if (g.every(t, 6)) { const y = 30 + g.rng.next() * 300, x = g.shoot(side > 0 ? -8 : W + 8, y, side > 0 ? 0.35 : Math.PI - 0.35, 2.2, P.petal, C.mint); if (x) { x.wav = 12; x.wavF = 0.1; } }
      if (g.every(t, 50, 25)) g.fan(b.x, chest(b), 7, 0.8, 2.4, g.aimFrom(b.x, chest(b)), P.seed, C.violet);
    } },
    { name: 'Hailstone Hullabaloo', hp: 1600, time: 48, move: 'hover', fire: (g, b, t) => {
      if (g.every(t, 56)) g.ring(b.x, b.y, 22, 2.6, t * 0.02, P.seed, C.white, (x) => { x.acc = -0.07 * g.diff.speed; x.at = 40; x.then = THEN.fall; x.thenSpd = 0.045 * g.diff.speed; });
      if (g.every(t, 38, 15)) for (const s of [-1, 1]) { const x = g.shoot(b.x, chest(b), Math.PI / 2 + s * (0.5 + g.rng.next() * 0.5), 2.5, P.seed, C.sky); if (x) x.bounce = 1; }
    } },
    { name: 'Lightning Lullaby', hp: 1700, time: 50, move: 'circle', fire: (g, b, t) => {
      if (g.every(t, 6)) { g.spiral(b.x, b.y, 3, 2, t * 0.03, P.spark, C.gold); g.spiral(b.x, b.y, 3, 2, -t * 0.03 + Math.PI / 2, P.spark, C.violet); }
      if (g.every(t, 100, 50)) { const a = g.aimFrom(b.x, chest(b)); for (let k = 0; k < 6; k++) g.shoot(b.x, chest(b), a, 2.8 + k * 0.32, P.spark, C.white); }
    } },
    { name: 'Grumble Typhoon', hp: 1900, time: 60, move: 'still', fire: (g, b, t) => {
      if (g.every(t, 4)) g.spiral(b.x, b.y, 6, 2, 2.2 * Math.sin(t * 0.009) + t * 0.012, P.petal, Math.floor(t / 8) % 2 ? C.violet : C.pink);
      if (g.every(t, 100, 50)) g.ring(b.x, b.y, 30, 1.5, t * 0.007, P.seed, C.white);
    } },
  ],
};
/** Mid-bosses: one per stage, a single named attack, and they fly off home afterwards. */
const mid = (id: BossId, name: string, art: string, r: number, ph: PhaseDef): BossDef => ({ id, name, art, r, y: 156, mid: true, chat: [], friends: [], phases: [ph] });
const MIDS: BossDef[] = [
  mid('bumbleQueen', 'Big Bumble', 'bumble', 24, { name: 'Buzzing Bloom', hp: 200, time: 20, move: 'sway', fire: (g, b, t) => {
    if (g.every(t, 44)) g.ring(b.x, b.y, 14, 1.8, Math.floor(t / 44) % 2 ? Math.PI / 14 : 0, P.seed, C.gold);
    if (g.every(t, 66, 33)) g.fan(b.x, b.y, 3, 0.4, 2.6, g.aimFrom(b.x, b.y), P.petal, C.pink);
  } }),
  mid('kiteCaptain', 'Kite Captain', 'kite', 24, { name: 'Ribbon Loop', hp: 320, time: 20, move: 'circle', fire: (g, b, t) => {
    if (g.every(t, 13)) for (const s of [-1, 1]) { const x = g.shoot(b.x + s * 14, b.y, Math.PI / 2 + s * 0.25, 2, P.petal, s < 0 ? C.pink : C.sky); if (x) { x.wav = 12; x.wavF = 0.07; } }
    if (g.every(t, 80, 40)) g.fan(b.x, b.y, 5, 0.6, 2.6, g.aimFrom(b.x, b.y), P.seed, C.gold);
  } }),
  mid('sproutChief', 'Sprout Chief', 'sprout', 26, { name: 'Pitter Patter', hp: 440, time: 20, move: 'sway', fire: (g, b, t) => {
    if (g.every(t, 7)) { const x = g.shoot(b.x + g.rng.range(-60, 60), b.y + 10, Math.PI / 2, 0.6, P.drop, C.sky); if (x) { x.acc = 0.05 * g.diff.speed; x.maxS = 4 * g.diff.speed; } }
    if (g.every(t, 90, 45)) g.ring(b.x, b.y, 18, 1.7, t * 0.02, P.seed, C.white);
  } }),
  mid('mothMatron', 'Moth Matron', 'moth', 26, { name: 'Lantern Flutter', hp: 560, time: 20, move: 'circle', fire: (g, b, t) => {
    if (g.every(t, 9)) g.spiral(b.x, b.y, 3, 1.9, t * 0.04, P.petal, C.violet);
    if (g.every(t, 70, 35)) g.ring(b.x, b.y, 8, 2, t * 0.03, P.star, C.gold, (x) => { x.wav = 14; x.wavF = 0.09; });
  } }),
  mid('wispWarden', 'Wisp Warden', 'wisp', 24, { name: 'Will-o’-Whirl', hp: 580, time: 20, move: 'sway', fire: (g, b, t) => {
    if (g.every(t, 60)) g.ring(b.x, b.y, 14, 3, t * 0.02, P.spark, C.violet, (x) => { x.acc = -0.08 * g.diff.speed; x.at = 40; x.then = THEN.aim; x.thenSpd = 3 * g.diff.speed; });
    if (g.every(t, 30, 15)) g.ring(b.x, b.y, 10, 2, t * 0.04, P.seed, C.mint);
  } }),
];
export const BOSSES: Record<BossId, BossDef> = { magpie: MAGPIE, crow: CROW, cloud: CLOUD, owl: OWL, storm: STORM, bumbleQueen: MIDS[0], kiteCaptain: MIDS[1], sproutChief: MIDS[2], mothMatron: MIDS[3], wispWarden: MIDS[4] };

// ---------------------------------------------------------------- stages
export type Spawn = { at: number; k: 'spawn'; kind: CritterKind; path: Path; gun: Gun | null } | { at: number; k: 'mid'; boss: BossId } | { at: number; k: 'boss'; boss: BossId };
const S = HZ;
const gun = (p: GunKind, every: number, o: Partial<Gun> = {}): Gun => ({ p, every, first: 40, n: 1, spread: 0.5, spd: 2.2, look: P.seed, hue: C.gold, max: 99, ...o });
const stop = (tx: number, ty: number, stay = 150, exit: Exit = 'up', enter = 50, sx = tx): Path => ({ k: 'stop', sx, tx, ty, enter, stay, exit });
const arc = (dir: 1 | -1, y: number, speed = 2, dip = 60): Path => ({ k: 'arc', dir, y, speed, dip });
const drift = (x: number, vy: number, vx = 0, amp = 0, f = 0.04): Path => ({ k: 'drift', x, vx, vy, amp, f });
const swoop = (tx: number, ty: number, dir: 1 | -1): Path => ({ k: 'swoop', tx, ty, dir });
/** `n` critters, `gap` ticks apart, starting at `at` seconds; `path` and `gn` are given each one's index. */
function wave(at: number, kind: CritterKind, n: number, gap: number, path: (i: number) => Path, gn: ((i: number) => Gun | null) | Gun | null = null): Spawn[] {
  const out: Spawn[] = [];
  for (let i = 0; i < n; i++) out.push({ at: Math.round(at * S) + i * gap, k: 'spawn', kind, path: path(i), gun: typeof gn === 'function' ? gn(i) : gn });
  return out;
}
const across = (n: number, i: number, margin = 50) => (n === 1 ? W / 2 : margin + ((W - 2 * margin) * i) / (n - 1));

export type StageDef = { n: number; name: string; sky: string; critters: CritterKind[]; mid: BossId; boss: BossId; timeline: Spawn[] };
function stage(n: number, name: string, critters: CritterKind[], midId: BossId, midAt: number, bossId: BossId, bossAt: number, waves: Spawn[][]): StageDef {
  const timeline = [...waves.flat(), { at: Math.round(midAt * S), k: 'mid' as const, boss: midId }, { at: Math.round(bossAt * S), k: 'boss' as const, boss: bossId }];
  // stable: waves keep their order, and the boss is always last
  timeline.sort((a, b) => a.at - b.at || (a.k === 'boss' ? 1 : b.k === 'boss' ? -1 : 0));
  return { n, name, sky: 'sky-' + n, critters, mid: midId, boss: bossId, timeline };
}

export const STAGES: StageDef[] = [
  stage(1, 'Meadow Morning', ['bumble', 'kite'], 'bumbleQueen', 35, 'magpie', 70, [
    wave(1.5, 'bumble', 5, 22, (i) => stop(60 + i * 60, 100 + (i % 2) * 34, 140), gun('aim', 80, { spd: 2.1 })),
    wave(5.5, 'kite', 6, 14, () => arc(1, 110, 2.1, 70), gun('fan', 90, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, max: 1, first: 50 })),
    wave(9, 'kite', 6, 14, () => arc(-1, 150, 2.1, 70), gun('fan', 90, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, max: 1, first: 50 })),
    wave(12.5, 'bumble', 4, 0, (i) => stop(across(4, i, 60), 130, 170, 'down'), gun('ring', 100, { n: 8, spd: 1.6, first: 60 })),
    wave(16.5, 'bumble', 8, 18, (i) => drift(40 + ((i * 97) % 280), 1.3, 0, 26, 0.04), gun('aim', 70, { spd: 2.2, first: 50 })),
    wave(22, 'kite', 5, 16, () => swoop(110, 200, 1), gun('aim', 999, { first: 50, spd: 2.4, look: P.petal, hue: C.pink })),
    wave(22.5, 'kite', 5, 16, () => swoop(250, 200, -1), gun('aim', 999, { first: 50, spd: 2.4, look: P.petal, hue: C.pink })),
    wave(27.5, 'bumble', 3, 30, (i) => stop([180, 90, 270][i], 120 + i * 20, 160), gun('fan', 60, { n: 5, spread: 0.7, spd: 1.9, look: P.petal, hue: C.pink, first: 50 })),
    wave(31, 'kite', 8, 10, (i) => arc(i % 2 ? -1 : 1, 90 + (i % 4) * 25, 2.3, 50), null),
    wave(38.5, 'bumble', 6, 20, (i) => stop(50 + ((i * 53) % 260), 90 + (i % 3) * 40, 120), gun('aim', 60, { n: 2, spd: 2.3 })),
    wave(44, 'kite', 8, 12, (i) => drift(i % 2 ? 320 : 40, 2, i % 2 ? -1.2 : 1.2), gun('fan', 70, { n: 3, spread: 0.5, look: P.petal, hue: C.pink, max: 1, first: 30 })),
    wave(49.5, 'bumble', 5, 0, (i) => stop(across(5, i, 40), 110 + Math.abs(i - 2) * 22, 200, 'up'), gun('ring', 110, { n: 10, spd: 1.6, first: 50 })),
    wave(55.5, 'kite', 6, 14, () => arc(1, 130, 2.4, 90), gun('aim', 999, { spd: 2.5, look: P.petal, hue: C.pink })),
    wave(56.5, 'kite', 6, 14, () => arc(-1, 170, 2.4, 90), gun('aim', 999, { spd: 2.5, look: P.petal, hue: C.pink })),
    wave(61.5, 'bumble', 7, 16, (i) => drift(60 + ((i * 41) % 240), 1.5, 0, 34, 0.05), gun('fan', 80, { n: 3, spread: 0.45, spd: 2.2 })),
  ]),
  stage(2, 'Orchard Breeze', ['kite', 'beetle'], 'kiteCaptain', 35, 'crow', 72, [
    wave(1.5, 'kite', 8, 12, (i) => arc(i % 2 ? -1 : 1, 100 + (i % 4) * 20, 2.3, 60), gun('aim', 999, { spd: 2.5, look: P.petal, hue: C.pink, first: 40 })),
    wave(5.5, 'beetle', 2, 40, (i) => stop(i ? 260 : 100, 120, 240, 'up', 70), gun('ring', 70, { n: 12, spd: 1.7, look: P.seed, hue: C.mint })),
    wave(10.5, 'kite', 6, 14, () => swoop(90, 230, 1), gun('fan', 999, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, first: 45 })),
    wave(11, 'kite', 6, 14, () => swoop(270, 230, -1), gun('fan', 999, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, first: 45 })),
    wave(16, 'beetle', 3, 30, (i) => drift(across(3, i, 70), 0.7, 0, 18, 0.03), gun('fan', 70, { n: 5, spread: 0.6, spd: 2, look: P.apple, hue: C.red })),
    wave(22, 'kite', 10, 10, (i) => drift(30 + ((i * 73) % 300), 2.2, 0, 30, 0.06), gun('aim', 999, { first: 30, spd: 2.6, look: P.petal, hue: C.pink })),
    wave(27.5, 'beetle', 4, 0, (i) => stop(across(4, i, 60), 90 + (i % 2) * 40, 200, i < 2 ? 'left' : 'right'), gun('ring', 90, { n: 10, spd: 1.6, hue: C.mint })),
    wave(38.5, 'kite', 8, 12, () => arc(1, 120, 2.5, 100), gun('fan', 999, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, first: 45 })),
    wave(40.5, 'kite', 8, 12, () => arc(-1, 120, 2.5, 100), gun('fan', 999, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, first: 45 })),
    wave(46, 'beetle', 3, 50, (i) => stop([180, 80, 280][i], 140, 220), gun('spiral', 8, { n: 3, spd: 1.8, look: P.seed, hue: C.mint, first: 60, max: 22 })),
    wave(53.5, 'kite', 12, 8, (i) => drift(i % 2 ? 330 : 30, 1.8, i % 2 ? -1.4 : 1.4, 0), gun('aim', 999, { spd: 2.6, look: P.petal, hue: C.pink, first: 25 })),
    wave(60, 'beetle', 4, 24, (i) => drift(across(4, i, 60), 0.8, 0, 20, 0.04), gun('fan', 80, { n: 5, spread: 0.7, spd: 2.1, look: P.apple, hue: C.red })),
    wave(65, 'kite', 6, 14, (i) => swoop(across(6, i, 60), 180, i % 2 ? -1 : 1), gun('aim', 999, { first: 45, spd: 2.6, look: P.petal, hue: C.pink })),
  ]),
  stage(3, 'Thunderhead', ['sprout', 'beetle'], 'sproutChief', 37, 'cloud', 74, [
    wave(1.5, 'sprout', 5, 20, (i) => stop(50 + i * 65, 90 + (i % 2) * 30, 170), gun('drop', 14, { spd: 0.7, look: P.drop, hue: C.sky, first: 30, max: 9 })),
    wave(7, 'beetle', 3, 30, (i) => stop([90, 270, 180][i], 110 + i * 20, 200), gun('ring', 80, { n: 14, spd: 1.8, hue: C.gold })),
    wave(12.5, 'sprout', 8, 14, (i) => arc(i % 2 ? -1 : 1, 80 + (i % 4) * 22, 1.8, 40), gun('drop', 22, { spd: 0.8, look: P.drop, hue: C.sky, first: 20, max: 6 })),
    wave(18.5, 'beetle', 4, 20, (i) => drift(across(4, i, 70), 0.75, 0, 22, 0.035), gun('burst', 110, { n: 8, spd: 2.6, look: P.spark, hue: C.violet, first: 50 })),
    wave(24.5, 'sprout', 6, 0, (i) => stop(across(6, i, 35), 80 + (i % 2) * 40, 180, 'up'), gun('drop', 18, { spd: 0.7, look: P.drop, hue: C.sky, first: 40, max: 8 })),
    wave(30, 'beetle', 2, 0, (i) => stop(i ? 250 : 110, 150, 220), gun('spiral', 7, { n: 4, spd: 2, look: P.spark, hue: C.gold, first: 70, max: 26 })),
    wave(40.5, 'sprout', 10, 10, (i) => drift(30 + ((i * 67) % 300), 1.5, 0, 16, 0.05), gun('aim', 999, { first: 35, spd: 2.6, look: P.drop, hue: C.sky })),
    wave(46.5, 'beetle', 4, 30, (i) => stop(across(4, i, 60), 110 + (i % 2) * 30, 200, i % 2 ? 'left' : 'right'), gun('fan', 70, { n: 5, spread: 0.7, spd: 2.2, look: P.spark, hue: C.gold })),
    wave(53, 'sprout', 8, 12, () => arc(1, 140, 2.2, 80), gun('drop', 20, { spd: 0.8, look: P.drop, hue: C.sky, max: 5 })),
    wave(53.5, 'sprout', 8, 12, () => arc(-1, 100, 2.2, 80), gun('drop', 20, { spd: 0.8, look: P.drop, hue: C.sky, max: 5 })),
    wave(60.5, 'beetle', 3, 40, (i) => stop([180, 70, 290][i], 120, 200), gun('burst', 90, { n: 10, spd: 2.6, look: P.spark, hue: C.violet })),
    wave(67, 'sprout', 6, 16, (i) => swoop(across(6, i, 70), 200, i % 2 ? 1 : -1), gun('aim', 999, { first: 45, spd: 2.7, look: P.drop, hue: C.sky })),
  ]),
  stage(4, 'Moonlit Mist', ['moth', 'wisp'], 'mothMatron', 37, 'owl', 74, [
    wave(1.5, 'moth', 6, 18, (i) => drift(40 + ((i * 59) % 280), 1.1, 0, 40, 0.03), gun('ring', 90, { n: 8, spd: 1.5, look: P.petal, hue: C.violet, first: 40 })),
    wave(7, 'wisp', 8, 10, (i) => arc(i % 2 ? -1 : 1, 90 + (i % 4) * 20, 2.6, 50), gun('aim', 999, { first: 35, spd: 2.8, look: P.spark, hue: C.violet })),
    wave(12.5, 'moth', 4, 0, (i) => stop(across(4, i, 60), 110 + (i % 2) * 30, 190), gun('spiral', 9, { n: 2, spd: 1.7, look: P.petal, hue: C.white, first: 50, max: 20 })),
    wave(18.5, 'wisp', 6, 16, (i) => swoop(across(6, i, 60), 220, i % 2 ? -1 : 1), gun('burst', 999, { n: 6, spd: 2.6, look: P.spark, hue: C.violet, first: 40 })),
    wave(24.5, 'moth', 8, 14, (i) => drift(i % 2 ? 300 : 60, 1.2, i % 2 ? -0.5 : 0.5, 30, 0.04), gun('fan', 90, { n: 3, spread: 0.5, spd: 2, look: P.star, hue: C.gold })),
    wave(31, 'wisp', 10, 8, (i) => arc(1, 80 + (i % 5) * 18, 2.8, 70), null),
    wave(40.5, 'moth', 5, 20, (i) => stop(50 + i * 65, 100 + (i % 2) * 40, 170), gun('ring', 70, { n: 10, spd: 1.6, look: P.petal, hue: C.violet })),
    wave(46.5, 'wisp', 8, 12, (i) => drift(30 + ((i * 83) % 300), 2.2, 0, 24, 0.07), gun('aim', 999, { first: 30, spd: 2.8, look: P.spark, hue: C.violet })),
    wave(53, 'moth', 4, 30, (i) => stop([90, 270, 140, 220][i], 120 + i * 15, 200), gun('spiral', 8, { n: 3, spd: 1.8, look: P.petal, hue: C.white, first: 60, max: 24 })),
    wave(60, 'wisp', 6, 14, () => arc(-1, 130, 2.6, 90), gun('burst', 999, { n: 6, spd: 2.5, look: P.spark, hue: C.violet, first: 50 })),
    wave(60.5, 'wisp', 6, 14, () => arc(1, 130, 2.6, 90), gun('burst', 999, { n: 6, spd: 2.5, look: P.spark, hue: C.violet, first: 50 })),
    wave(67, 'moth', 6, 16, (i) => drift(across(6, i, 50), 1, 0, 30, 0.035), gun('fan', 80, { n: 3, spread: 0.5, spd: 2.1, look: P.star, hue: C.gold })),
  ]),
  stage(5, 'Eye of the Storm', ['bumble', 'kite', 'beetle', 'sprout', 'moth', 'wisp'], 'wispWarden', 37, 'storm', 76, [
    wave(1.5, 'bumble', 6, 16, (i) => stop(40 + i * 56, 90 + (i % 2) * 30, 150), gun('aim', 60, { n: 2, spd: 2.4 })),
    wave(6, 'kite', 10, 10, (i) => arc(i % 2 ? -1 : 1, 90 + (i % 5) * 18, 2.5, 60), gun('aim', 999, { first: 35, spd: 2.7, look: P.petal, hue: C.pink })),
    wave(11.5, 'beetle', 3, 30, (i) => stop([90, 270, 180][i], 110 + i * 15, 200), gun('ring', 70, { n: 14, spd: 1.8, look: P.apple, hue: C.red })),
    wave(16.5, 'sprout', 6, 0, (i) => stop(across(6, i, 35), 80, 160), gun('drop', 18, { spd: 0.7, look: P.drop, hue: C.sky, first: 40, max: 7 })),
    wave(22, 'moth', 6, 16, (i) => drift(50 + ((i * 61) % 260), 1.1, 0, 36, 0.03), gun('spiral', 10, { n: 2, spd: 1.7, look: P.petal, hue: C.violet, first: 40, max: 16 })),
    wave(27.5, 'wisp', 10, 9, (i) => swoop(across(10, i, 40), 200, i % 2 ? -1 : 1), gun('burst', 999, { n: 6, spd: 2.6, look: P.spark, hue: C.violet, first: 40 })),
    wave(32.5, 'beetle', 2, 0, (i) => stop(i ? 260 : 100, 130, 200), gun('spiral', 7, { n: 4, spd: 2, look: P.seed, hue: C.mint, first: 60, max: 24 })),
    wave(40.5, 'kite', 8, 12, () => arc(1, 110, 2.6, 90), gun('fan', 999, { n: 3, spread: 0.4, look: P.petal, hue: C.pink, first: 45 })),
    wave(41.5, 'bumble', 6, 16, () => arc(-1, 150, 2, 60), gun('aim', 70, { spd: 2.4 })),
    wave(47.5, 'sprout', 8, 12, (i) => drift(30 + ((i * 71) % 300), 1.3, 0, 20, 0.05), gun('drop', 20, { spd: 0.8, look: P.drop, hue: C.sky, max: 5 })),
    wave(53, 'moth', 4, 20, (i) => stop(across(4, i, 60), 120, 190), gun('ring', 60, { n: 10, spd: 1.6, look: P.star, hue: C.gold })),
    wave(58, 'wisp', 12, 7, (i) => arc(i % 2 ? -1 : 1, 80 + (i % 6) * 16, 2.9, 70), gun('aim', 999, { first: 30, spd: 2.8, look: P.spark, hue: C.violet })),
    wave(64, 'beetle', 4, 24, (i) => drift(across(4, i, 70), 0.8, 0, 20, 0.04), gun('fan', 70, { n: 5, spread: 0.7, spd: 2.2, look: P.apple, hue: C.red })),
    wave(69.5, 'bumble', 8, 12, (i) => drift(40 + ((i * 47) % 280), 1.6, 0, 28, 0.05), gun('fan', 80, { n: 3, spread: 0.45, spd: 2.3 })),
  ]),
];
export const STAGE_COUNT = STAGES.length;

// ---------------------------------------------------------------- events
export type Ev =
  | { k: 'shot'; pilot: Pilot }
  | { k: 'graze'; x: number; y: number }
  | { k: 'puff'; x: number; y: number; kind: CritterKind; points: number }
  | { k: 'collect'; x: number; y: number; n: number; big: boolean }
  | { k: 'gasp'; x: number; y: number }
  | { k: 'hit'; x: number; y: number; hearts: number }
  | { k: 'saved'; x: number; y: number }
  | { k: 'bloom'; x: number; y: number; saved: boolean }
  | { k: 'bloomUp'; blooms: number }
  | { k: 'bossHit'; x: number; y: number }
  | { k: 'bossIn'; boss: BossId; mid: boolean }
  | { k: 'phase'; name: string; index: number; boss: BossId }
  | { k: 'break'; x: number; y: number; clearSky: number; timedOut: boolean; last: boolean; mid: boolean }
  | { k: 'calm'; boss: BossId; x: number; y: number }
  | { k: 'midGone'; boss: BossId }
  | { k: 'fade' }
  | { k: 'stage'; stage: number }
  | { k: 'clear'; stage: number }
  | { k: 'over' }
  | { k: 'won' }
  | { k: 'continue' };

export type Phase = 'play' | 'chat' | 'shop' | 'over' | 'won';
export type Input = { dx: number; dy: number; focus: boolean; bloom: boolean; tx: number | null; ty: number | null };
export const idleInput = (): Input => ({ dx: 0, dy: 0, focus: false, bloom: false, tx: null, ty: null });
export type Chat = { boss: BossId; lines: Line[]; i: number; after: boolean };
export type Results = { stage: number; stageScore: number; grazes: number; clearSky: number; phases: number; seeds: number; kills: number; noHit: boolean; noHitBonus: number; bloomBonus: number; hits: number };
export type Banner = { text: string; sub: string; t: number; kind: 'stage' | 'attack' | 'mid' };
export type Options = { seed: number; pilot: Pilot; diff: Diff; stage?: number; practice?: boolean };

// ---------------------------------------------------------------- the game
export class SeedstormGame {
  readonly seed: number; readonly pilot: Pilot; readonly diff: (typeof DIFFS)[Diff]; readonly diffId: Diff; readonly practice: boolean;
  rng: Rng;
  phase: Phase = 'play';
  tick = 0;
  stage = 1;
  /** The stage clock, in ticks; it stops while a mid-boss is out. */
  clock = 0;
  next = 0;
  player = { x: START.x, y: START.y, vx: 0, vy: 0, bank: 0, focus: false, invuln: INVULN.start, gasp: 0 };
  wing = { x: START.x - 28, y: START.y + 16, fire: 0 };
  hearts: number; maxHearts = HEART_CAP;
  blooms = BLOOM.start; meter = 0;
  /** Ticks left of the Bloom's sweeping ring, and where it started. */
  bloomT = 0; bloomX = 0; bloomY = 0;
  score = 0; purse = 0; breeze = 1; lastKill = -999; grazes = 0; continues = 0;
  ups: Ups = freshUps(); bought: Record<UpId, number> = { power: 0, wings: 0, heart: 0, pouch: 0, magnet: 0 }; shopHeart = false;
  bullets: Bullet[] = []; shots: Shot[] = []; seeds: Seed[] = []; critters: Critter[] = [];
  bulletCount = 0; peakBullets = 0; seedCount = 0; critterCount = 0; shotCount = 0;
  private bFree: Int16Array; private bFreeN = 0; private sFree: Int16Array; private sFreeN = 0; private eFree: Int16Array; private eFreeN = 0; private cFree: Int16Array; private cFreeN = 0;
  boss: Boss | null = null;
  bossWait = -1;
  chat: Chat | null = null;
  banner: Banner | null = null;
  results: Results | null = null;
  /** This stage's numbers, for the results screen. */
  ss = { score0: 0, grazes: 0, clearSky: 0, phases: 0, seeds: 0, kills: 0, hits: 0 };
  /** What happened since the reader last drained this (with `events.splice(0)`): sounds and effects follow it. */
  events: Ev[] = [];
  private prevBloom = false;
  private nextId = 1;
  /** a Clear Sky bonus held back while a hit waits out its last-gasp window at a phase break */
  private pendingClear = 0;
  private tmp = { x: 0, y: 0 };

  constructor(o: Options) {
    this.seed = o.seed >>> 0; this.pilot = o.pilot; this.diffId = o.diff; this.diff = DIFFS[o.diff]; this.practice = !!o.practice;
    this.rng = new Rng(this.seed ^ 0x5eed);
    this.hearts = this.diff.hearts;
    for (let i = 0; i < CAPS.bullets; i++) this.bullets.push(newBullet(i));
    for (let i = 0; i < CAPS.shots; i++) this.shots.push(newShot(i));
    for (let i = 0; i < CAPS.seeds; i++) this.seeds.push(newSeed(i));
    for (let i = 0; i < CAPS.critters; i++) this.critters.push(newCritter(i));
    this.bFree = new Int16Array(CAPS.bullets); this.sFree = new Int16Array(CAPS.shots); this.eFree = new Int16Array(CAPS.seeds); this.cFree = new Int16Array(CAPS.critters);
    for (let i = CAPS.bullets - 1; i >= 0; i--) this.bFree[this.bFreeN++] = i;
    for (let i = CAPS.shots - 1; i >= 0; i--) this.sFree[this.sFreeN++] = i;
    for (let i = CAPS.seeds - 1; i >= 0; i--) this.eFree[this.eFreeN++] = i;
    for (let i = CAPS.critters - 1; i >= 0; i--) this.cFree[this.cFreeN++] = i;
    this.startStage(Math.max(1, Math.min(STAGE_COUNT, o.stage ?? 1)));
  }

  get def() { return STAGES[this.stage - 1]; }
  get bloomCap() { return BLOOM.cap + this.ups.pouch; }
  get speed() { return PILOTS[this.pilot].speed; }
  get wingmate(): Pilot { return PILOTS[this.pilot].wing; }

  // ---------------------------------------------------------------- pools
  /** One bullet at (x, y) heading `ang` at `spd` (scaled by the difficulty). Returns null when the pool is full. */
  shoot(x: number, y: number, ang: number, spd: number, look: number, hue: number): Bullet | null {
    if (this.bFreeN === 0) return null;
    const b = this.bullets[this.bFree[--this.bFreeN]], s = spd * this.diff.speed;
    b.on = true; b.x = x; b.y = y; b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s; b.r = LOOK_R[look]; b.look = look; b.hue = hue; b.t = 0;
    b.acc = 0; b.minS = 0; b.maxS = 99; b.tc = 1; b.ts = 0; b.grav = 0; b.bounce = 0; b.at = 0; b.then = 0; b.thenSpd = 0; b.homeTil = 0; b.homeRate = 0; b.wav = 0; b.wavF = 0; b.grazed = false;
    if (++this.bulletCount > this.peakBullets) this.peakBullets = this.bulletCount;
    return b;
  }
  private killBullet(b: Bullet) { if (!b.on) return; b.on = false; this.bFree[this.bFreeN++] = b.i; this.bulletCount--; }
  private addShot(x: number, y: number, vx: number, vy: number, dmg: number, kind: number, pierce: boolean) {
    if (this.sFreeN === 0) return;
    const s = this.shots[this.sFree[--this.sFreeN]];
    s.on = true; s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.dmg = dmg; s.kind = kind; s.pierce = pierce; s.hits.length = 0; s.t = 0; this.shotCount++;
  }
  private killShot(s: Shot) { if (!s.on) return; s.on = false; this.sFree[this.sFreeN++] = s.i; this.shotCount--; }
  /** Drops a seed; when the pool is full the seed is collected on the spot instead, so nothing is lost. */
  private addSeed(x: number, y: number, vx: number, vy: number, big: boolean, home: number) {
    if (this.eFreeN === 0) { this.collect(x, y, big); return; }
    const e = this.seeds[this.eFree[--this.eFreeN]];
    e.on = true; e.x = x; e.y = y; e.vx = vx; e.vy = vy; e.t = 0; e.big = big; e.home = home; e.pulled = false; this.seedCount++;
  }
  private killSeed(e: Seed) { if (!e.on) return; e.on = false; this.eFree[this.eFreeN++] = e.i; this.seedCount--; }
  private addCritter(kind: CritterKind, path: Path, gn: Gun | null) {
    if (this.cFreeN === 0) return;
    const c = this.critters[this.cFree[--this.cFreeN]], hp = critterHp(kind, this.stage);
    c.on = true; c.id = this.nextId++; c.kind = kind; c.hp = hp; c.max = hp; c.r = CRITTERS[kind].r; c.t = 0; c.path = path; c.gun = gn; c.shots = 0; c.spin = 0; c.flash = 0; c.seen = false;
    pathAt(path, 0, this.tmp); c.x = this.tmp.x; c.y = this.tmp.y; c.vx = 0; c.vy = 0; this.critterCount++;
  }
  private killCritter(c: Critter) { if (!c.on) return; c.on = false; this.cFree[this.cFreeN++] = c.i; this.critterCount--; }

  // ---------------------------------------------------------------- pattern library (used by stage and boss scripts)
  /** A count scaled by the difficulty's density. */
  dn(n: number) { return Math.max(1, Math.round(n * this.diff.density)); }
  /** True every `period` ticks (scaled by the difficulty's fire rate) from `offset`. */
  every(t: number, period: number, offset = 0) { const p = Math.max(2, Math.round(period / this.diff.rate)); return t >= offset && (t - offset) % p === 0; }
  aimFrom(x: number, y: number) { return Math.atan2(this.player.y - y, this.player.x - x); }
  turn(b: Bullet, rate: number) { b.tc = Math.cos(rate); b.ts = Math.sin(rate); }
  /** `n` bullets evenly round a circle (scaled by density). */
  ring(x: number, y: number, n: number, spd: number, a0: number, look: number, hue: number, mod?: (b: Bullet, i: number) => void) {
    const m = this.dn(n);
    for (let i = 0; i < m; i++) { const b = this.shoot(x, y, a0 + (i * TAU) / m, spd, look, hue); if (b && mod) mod(b, i); }
  }
  /** A spiral's arms: `arms` bullets evenly round a circle, never scaled (the caller rotates `a0` and the rate thins it). */
  spiral(x: number, y: number, arms: number, spd: number, a0: number, look: number, hue: number) {
    for (let i = 0; i < arms; i++) this.shoot(x, y, a0 + (i * TAU) / arms, spd, look, hue);
  }
  /** A fan of `n` bullets (scaled by density, kept odd or even as given) spread over `spread` radians around `ang`. */
  fan(x: number, y: number, n: number, spread: number, spd: number, ang: number, look: number, hue: number, mod?: (b: Bullet, i: number) => void) {
    let m = this.dn(n); if (m % 2 !== n % 2) m = m > n ? m - 1 : m + 1; m = Math.max(1, m);
    for (let i = 0; i < m; i++) { const b = this.shoot(x, y, m === 1 ? ang : ang - spread / 2 + (spread * i) / (m - 1), spd, look, hue); if (b && mod) mod(b, i); }
  }
  /** A curtain falling from the top with a gap `gapW` wide centred on `gapX`; columns are `spacing` apart (wider when gentler). */
  curtain(spacing: number, gapX: number, gapW: number, spd: number, look: number, hue: number, mod?: (b: Bullet, i: number) => void) {
    const sp = spacing / Math.sqrt(this.diff.density); let i = 0;
    for (let x = sp / 2; x < W; x += sp) { if (Math.abs(x - gapX) < gapW / 2) continue; const b = this.shoot(x, -8, Math.PI / 2, spd, look, hue); if (b && mod) mod(b, i); i++; }
  }

  // ---------------------------------------------------------------- stages
  private clearField(seeds: boolean) {
    for (const b of this.bullets) this.killBullet(b);
    for (const s of this.shots) this.killShot(s);
    for (const c of this.critters) this.killCritter(c);
    if (seeds) for (const e of this.seeds) this.killSeed(e);
  }
  private startStage(n: number) {
    this.stage = n; this.clock = 0; this.next = 0; this.boss = null; this.bossWait = -1; this.chat = null; this.results = null; this.bloomT = 0; this.shopHeart = false;
    this.clearField(true);
    this.player.x = START.x; this.player.y = START.y; this.player.invuln = INVULN.start; this.player.gasp = 0;
    this.wing.x = START.x - 28; this.wing.y = START.y + 16;
    this.ss = { score0: this.score, grazes: 0, clearSky: 0, phases: 0, seeds: 0, kills: 0, hits: 0 };
    this.phase = 'play';
    this.banner = { text: `Stage ${n}`, sub: this.def.name, t: 0, kind: 'stage' };
    this.events.push({ k: 'stage', stage: n });
  }
  /** Test and practice helper: jumps straight to a stage, at its start or at its boss. */
  warp(n: number, toBoss = true) {
    this.startStage(Math.max(1, Math.min(STAGE_COUNT, n)));
    if (toBoss) { const tl = this.def.timeline; this.next = tl.length - 1; this.clock = tl[tl.length - 1].at; }
  }
  private runTimeline() {
    const tl = this.def.timeline;
    if (this.bossWait >= 0 || (this.boss && this.boss.def.mid)) { if (this.bossWait >= 0) this.bossWait++; return; }
    while (this.next < tl.length && tl[this.next].at <= this.clock) {
      const e = tl[this.next++];
      if (e.k === 'spawn') this.addCritter(e.kind, e.path, e.gun);
      else if (e.k === 'mid') { this.spawnBoss(BOSSES[e.boss]); return; }
      else { this.bossWait = 0; return; }
    }
    this.clock++;
  }
  private spawnBoss(def: BossDef) {
    this.boss = { def, x: W / 2, y: -70, vx: 0, vy: 0, hp: 1, max: 1, phase: 0, state: 'enter', t: 0, timer: 0, time: 0, hit: false, flash: 0, aim: 0, clearSky: 0 };
    this.events.push({ k: 'bossIn', boss: def.id, mid: def.mid });
  }
  private setPhase(k: number) {
    const b = this.boss!, ph = b.def.phases[k];
    b.phase = k; b.max = b.hp = Math.round(ph.hp * this.diff.bossHp); b.t = 0; b.time = b.timer = ph.time * HZ; b.hit = false; b.state = 'fight'; b.clearSky = 0; this.pendingClear = 0;
    this.banner = { text: ph.name, sub: b.def.name, t: 0, kind: b.def.mid ? 'mid' : 'attack' };
    this.events.push({ k: 'phase', name: ph.name, index: k, boss: b.def.id });
  }
  private breakPhase(beaten: boolean) {
    const b = this.boss!, last = b.phase >= b.def.phases.length - 1;
    let bonus = 0;
    if (beaten) {
      this.score += SCORE.phase * this.stage; this.ss.phases++;
      if (!b.hit) {
        bonus = SCORE.clearSky + SCORE.clearSkyStage * this.stage + SCORE.clearSkySecond * Math.floor(b.timer / HZ);
        // a hit still in its last-gasp window decides it: a Bloom save pays it, the heart landing loses it
        if (this.player.gasp > 0) { this.pendingClear = bonus; bonus = 0; } else { this.score += bonus; this.ss.clearSky++; }
      }
    }
    b.clearSky = bonus;
    for (const x of this.bullets) if (x.on) { this.addSeed(x.x, x.y, 0, 0, false, 20); this.killBullet(x); }
    for (let i = 0; i < 6; i++) this.addSeed(b.x + this.rng.range(-30, 30), b.y + this.rng.range(-20, 20), this.rng.range(-1.5, 1.5), this.rng.range(-2, 0.5), true, 30);
    b.state = 'break'; b.t = 0;
    this.events.push({ k: 'break', x: b.x, y: b.y, clearSky: bonus, timedOut: !beaten, last, mid: b.def.mid });
  }
  private bossTarget(b: Boss, out: { x: number; y: number }) {
    const ph = b.def.phases[b.phase], t = b.t, home = b.def.y;
    switch (b.state === 'fight' || b.state === 'break' ? ph.move : 'still') {
      case 'hover': out.x = W / 2 + Math.sin(t * 0.012) * 50; out.y = home + Math.sin(t * 0.021) * 12; return;
      case 'sway': out.x = W / 2 + Math.sin(t * 0.016) * 110; out.y = home + Math.sin(t * 0.032) * 18; return;
      case 'swoop': out.x = W / 2 + Math.sin(t * 0.014) * 120; out.y = home + 40 + Math.sin(t * 0.028) * 50; return;
      case 'circle': out.x = W / 2 + Math.cos(t * 0.015) * 80; out.y = home + 10 + Math.sin(t * 0.015) * 30; return;
      case 'track': out.x = Math.max(70, Math.min(W - 70, b.x + Math.max(-0.9, Math.min(0.9, (this.player.x - b.x) * 0.02)))); out.y = home; return;
      default: out.x = W / 2; out.y = home + Math.sin(t * 0.02) * 6; return;
    }
  }
  private runBoss() {
    const b = this.boss!; b.t++; if (b.flash > 0) b.flash--;
    const px = b.x, py = b.y;
    if (b.state === 'enter') {
      const k = Math.min(1, b.t / 90), e = 1 - (1 - k) ** 3; b.x = W / 2; b.y = -70 + (b.def.y + 70) * e;
      if (b.t >= 90) { if (b.def.mid) this.setPhase(0); else { this.phase = 'chat'; this.chat = { boss: b.def.id, lines: b.def.chat, i: 0, after: false }; } }
    } else if (b.state === 'fight' || b.state === 'break') {
      this.bossTarget(b, this.tmp);
      b.x += (this.tmp.x - b.x) * 0.05; b.y += (this.tmp.y - b.y) * 0.05;
      if (b.state === 'fight') {
        b.def.phases[b.phase].fire(this, b, b.t);
        if (--b.timer <= 0) this.breakPhase(false);
      } else if (b.t >= 80) {
        if (b.phase < b.def.phases.length - 1) this.setPhase(b.phase + 1);
        else if (b.def.mid) { b.state = 'leave'; b.t = 0; }
        else { b.state = 'calm'; b.t = 0; this.events.push({ k: 'calm', boss: b.def.id, x: b.x, y: b.y }); }
      }
    } else if (b.state === 'leave') {
      b.y -= 0.5 + b.t * 0.08;
      if (b.y < -90) { this.events.push({ k: 'midGone', boss: b.def.id }); this.boss = null; }
    } else if (b.state === 'calm') {
      b.x += (W / 2 - b.x) * 0.03; b.y += (b.def.y + 30 - b.y) * 0.03;
      if (b.t >= 110) { this.phase = 'chat'; this.chat = { boss: b.def.id, lines: b.def.friends, i: 0, after: true }; }
    }
    if (this.boss) { b.vx = b.x - px; b.vy = b.y - py; }
  }
  /** Moves the chat on a line; the last line starts the fight (or finishes the stage). */
  advanceChat() {
    const c = this.chat; if (!c || this.phase !== 'chat') return;
    if (++c.i >= c.lines.length) this.endChat();
  }
  skipChat() { if (this.chat && this.phase === 'chat') this.endChat(); }
  private endChat() {
    const c = this.chat!; this.chat = null; this.phase = 'play';
    if (c.after) this.stageClear();
    else this.setPhase(0);
  }
  private stageClear() {
    // seeds still in the air fly home with the pilot
    for (const e of this.seeds) if (e.on) { this.collect(e.x, e.y, e.big); this.killSeed(e); }
    const noHit = this.ss.hits === 0, noHitBonus = noHit ? SCORE.noHit * this.stage : 0, bloomBonus = this.blooms * SCORE.bloomLeft;
    this.score += noHitBonus + bloomBonus;
    this.results = { stage: this.stage, stageScore: this.score - this.ss.score0, grazes: this.ss.grazes, clearSky: this.ss.clearSky, phases: this.ss.phases, seeds: this.ss.seeds, kills: this.ss.kills, noHit, noHitBonus, bloomBonus, hits: this.ss.hits };
    this.boss = null; this.clearField(true);
    this.events.push({ k: 'clear', stage: this.stage });
    if (this.stage >= STAGE_COUNT || this.practice) { this.phase = 'won'; this.events.push({ k: 'won' }); }
    else { this.phase = 'shop'; this.shopHeart = false; }
  }

  // ---------------------------------------------------------------- the shop
  price(id: UpId) { const u = UPGRADES[id]; return Math.round((u.base * Math.pow(u.growth, this.bought[id])) / 10) * 10; }
  level(id: UpId) { return id === 'heart' ? this.hearts : this.ups[id]; }
  /** Why an upgrade can't be bought right now, or 'ok'. */
  canBuy(id: UpId): 'ok' | 'max' | 'poor' | 'once' | 'closed' {
    if (this.phase !== 'shop') return 'closed';
    if (id === 'heart') { if (this.shopHeart) return 'once'; if (this.hearts >= HEART_CAP) return 'max'; }
    else if (this.ups[id] >= UPGRADES[id].max) return 'max';
    return this.purse < this.price(id) ? 'poor' : 'ok';
  }
  buy(id: UpId) {
    if (this.canBuy(id) !== 'ok') return false;
    this.purse -= this.price(id); this.bought[id]++;
    if (id === 'heart') { this.hearts++; this.shopHeart = true; } else this.ups[id]++;
    return true;
  }
  leaveShop() { if (this.phase === 'shop') this.startStage(this.stage + 1); }

  // ---------------------------------------------------------------- continue
  get canContinue() { return this.phase === 'over' && this.diff.continues; }
  continueRun() {
    if (!this.canContinue) return false;
    this.continues++; this.score = 0; this.ss.score0 = 0; this.hearts = this.diff.hearts; this.blooms = Math.max(this.blooms, BLOOM.start); this.meter = 0; this.breeze = 1;
    for (const b of this.bullets) this.killBullet(b);
    this.player.invuln = INVULN.bloom; this.player.gasp = 0; this.phase = 'play';
    this.events.push({ k: 'continue' });
    return true;
  }

  // ---------------------------------------------------------------- scoring helpers
  private collect(x: number, y: number, big: boolean) {
    const n = Math.round((big ? SEED.bigScore : SEED.score) * this.breeze);
    this.score += n; this.purse += big ? SEED.bigPurse : SEED.purse; this.ss.seeds++;
    this.addMeter(BLOOM.seed * (big ? 3 : 1));
    this.events.push({ k: 'collect', x, y, n, big });
  }
  private addMeter(n: number) {
    this.meter += n;
    while (this.meter >= BLOOM.meter && this.blooms < this.bloomCap) { this.meter -= BLOOM.meter; this.blooms++; this.events.push({ k: 'bloomUp', blooms: this.blooms }); }
    if (this.blooms >= this.bloomCap && this.meter > BLOOM.meter) this.meter = BLOOM.meter;
  }
  private puff(c: Critter) {
    const d = CRITTERS[c.kind];
    this.score += d.points; this.ss.kills++;
    if (this.tick - this.lastKill <= BREEZE.window) this.breeze = Math.min(BREEZE.max, Math.round((this.breeze + BREEZE.step) * 100) / 100);
    this.lastKill = this.tick;
    this.addMeter(BLOOM.kill);
    for (let i = 0; i < d.seeds; i++) this.addSeed(c.x, c.y, this.rng.range(-1.6, 1.6), this.rng.range(-2.6, -0.6), false, 0);
    this.events.push({ k: 'puff', x: c.x, y: c.y, kind: c.kind, points: d.points });
    this.killCritter(c);
  }
  private damageBoss(n: number) {
    const b = this.boss; if (!b || b.state !== 'fight') return;
    b.hp -= n; b.flash = 4;
    if (b.hp <= 0) { b.hp = 0; this.breakPhase(true); }
  }

  // ---------------------------------------------------------------- one tick
  step(inp: Input = idleInput()) {
    // whoever plays the game drains the events; a reader that never does (a test, a bot) can't make them pile up
    if (this.events.length > 512) this.events.splice(0, this.events.length - 256);
    if (this.phase !== 'play') { this.prevBloom = inp.bloom; return; }
    this.tick++;
    const p = this.player;
    // the Bloom button, on its press
    const press = inp.bloom && !this.prevBloom; this.prevBloom = inp.bloom;
    if (press && this.blooms > 0 && this.bloomT === 0) this.bloom();
    // a hit lands once the last-gasp window runs out
    if (p.gasp > 0 && --p.gasp === 0) { this.loseHeart(); if (this.phase !== 'play') return; }
    this.movePlayer(inp);
    if (this.tick % FIRE_EVERY === 0) this.fire();
    this.runTimeline();
    if (this.bossWait >= 0 && !this.boss) this.bossArrives();
    this.moveCritters();
    if (this.boss) this.runBoss();
    if (this.bloomT > 0) this.sweepBloom();
    this.moveBullets();
    this.moveShots();
    this.moveSeeds();
    if (this.tick - this.lastKill > BREEZE.window && this.breeze > 1) this.breeze = Math.max(1, Math.round((this.breeze - BREEZE.decay) * 1000) / 1000);
    if (p.invuln > 0) p.invuln--;
    if (this.banner && ++this.banner.t > 200) this.banner = null;
  }
  /** The boss waits for the last critters (at most four seconds), then the field is cleared and it flies in. */
  private bossArrives() {
    if (this.critterCount > 0 && this.bossWait < 240) return;
    for (const c of this.critters) if (c.on) { this.events.push({ k: 'puff', x: c.x, y: c.y, kind: c.kind, points: 0 }); this.killCritter(c); }
    for (const b of this.bullets) this.killBullet(b);
    this.events.push({ k: 'fade' });
    this.bossWait = -1;
    this.spawnBoss(BOSSES[this.def.boss]);
  }
  private movePlayer(inp: Input) {
    const p = this.player, v = this.speed * (inp.focus ? FOCUS_SLOW : 1);
    let dx = 0, dy = 0;
    if (inp.tx !== null && inp.ty !== null && Number.isFinite(inp.tx) && Number.isFinite(inp.ty)) {
      const tx = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, inp.tx)), ty = Math.max(BOUNDS.y0, Math.min(BOUNDS.y1, inp.ty));
      const ex = tx - p.x, ey = ty - p.y, d = Math.hypot(ex, ey);
      if (d > 1e-6) { const m = Math.min(v, d); dx = (ex / d) * m; dy = (ey / d) * m; }
    } else {
      let ix = Number.isFinite(inp.dx) ? inp.dx : 0, iy = Number.isFinite(inp.dy) ? inp.dy : 0; const l = Math.hypot(ix, iy);
      if (l > 1) { ix /= l; iy /= l; }
      dx = ix * v; dy = iy * v;
    }
    const ox = p.x, oy = p.y;
    p.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, p.x + dx)); p.y = Math.max(BOUNDS.y0, Math.min(BOUNDS.y1, p.y + dy));
    p.vx = p.x - ox; p.vy = p.y - oy; p.focus = inp.focus;
    p.bank += (Math.max(-1, Math.min(1, p.vx / 3)) - p.bank) * 0.18;
    // the wingmate trails behind and to the side, or slides in front while focusing
    const side = this.pilot === 'dora' ? -1 : 1, tx = p.focus ? p.x : p.x + side * 28, ty = p.focus ? p.y - 30 : p.y + 16;
    this.wing.x += (tx - this.wing.x) * 0.2; this.wing.y += (ty - this.wing.y) * 0.2;
  }
  private fire() {
    const p = this.player, lv = this.ups.power, f = p.focus;
    if (this.pilot === 'dora') {
      const n = 1 + 2 * lv, spread = f ? 0.08 + 0.03 * lv : 0.26 + 0.12 * lv;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)); this.addShot(p.x, p.y - 10, Math.cos(a) * SHOT.petalSpeed, Math.sin(a) * SHOT.petalSpeed, SHOT.petal, 0, false); }
    } else {
      const n = lv + 1, gap = f ? 5 : 8;
      for (let i = 0; i < n; i++) { const o = i - (n - 1) / 2, a = -Math.PI / 2 + (f ? 0 : o * 0.035); this.addShot(p.x + o * gap, p.y - 12, Math.cos(a) * SHOT.pebbleSpeed, Math.sin(a) * SHOT.pebbleSpeed, SHOT.pebble, 1, true); }
    }
    this.events.push({ k: 'shot', pilot: this.pilot });
    if (++this.wing.fire >= WING_EVERY[this.ups.wings]) { this.wing.fire = 0; this.addShot(this.wing.x, this.wing.y - 8, 0, -SHOT.wingSpeed, SHOT.wing, 2, false); }
  }
  private bloom() {
    const p = this.player, saved = p.gasp > 0;
    this.blooms--; this.bloomT = BLOOM.sweep; this.bloomX = p.x; this.bloomY = p.y;
    p.invuln = Math.max(p.invuln, INVULN.bloom);
    if (saved) { p.gasp = 0; this.events.push({ k: 'saved', x: p.x, y: p.y }); if (this.pendingClear) { this.score += this.pendingClear; this.ss.clearSky++; if (this.boss) this.boss.clearSky = this.pendingClear; this.pendingClear = 0; } }
    for (const c of this.critters) if (c.on) { c.hp -= BLOOM.damage; c.flash = 6; if (c.hp <= 0) this.puff(c); }
    this.damageBoss(BLOOM.bossDamage);
    if (this.blooms < this.bloomCap) this.addMeter(0);
    this.events.push({ k: 'bloom', x: p.x, y: p.y, saved });
  }
  /** The Bloom's ring sweeps out from where it started, turning bullets into seeds; the last tick clears the rest. */
  private sweepBloom() {
    const r = (BLOOM.sweep - this.bloomT + 1) * BLOOM.speed, r2 = r * r, last = this.bloomT === 1;
    for (const b of this.bullets) {
      if (!b.on) continue;
      const dx = b.x - this.bloomX, dy = b.y - this.bloomY;
      if (last || dx * dx + dy * dy < r2) { if (b.y > -10 && b.y < H + 10 && b.x > -10 && b.x < W + 10) this.addSeed(b.x, b.y, 0, 0, false, 24); this.killBullet(b); }
    }
    this.bloomT--;
  }
  private loseHeart() {
    const p = this.player;
    this.hearts--; this.ss.hits++; this.breeze = 1; this.pendingClear = 0;
    if (this.boss && this.boss.state === 'fight') this.boss.hit = true;
    for (const b of this.bullets) if (b.on) { const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < HIT_CLEAR * HIT_CLEAR) this.killBullet(b); }
    p.invuln = INVULN.hit;
    this.events.push({ k: 'hit', x: p.x, y: p.y, hearts: this.hearts });
    if (this.hearts <= 0) { this.hearts = 0; this.phase = 'over'; this.events.push({ k: 'over' }); }
  }
  /** Something touched the pilot: the last-gasp window opens, and the heart is lost when it closes. */
  private touched() {
    const p = this.player; if (p.invuln > 0 || p.gasp > 0) return;
    p.gasp = LAST_GASP; this.events.push({ k: 'gasp', x: p.x, y: p.y });
  }
  private moveCritters() {
    const p = this.player, top = H * 0.62;
    for (const c of this.critters) {
      if (!c.on) continue;
      const ox = c.x, oy = c.y; c.t++; if (c.flash > 0) c.flash--;
      pathAt(c.path, c.t, this.tmp); c.x = this.tmp.x; c.y = this.tmp.y; c.vx = c.x - ox; c.vy = c.y - oy;
      const inside = c.x > -c.r && c.x < W + c.r && c.y > -c.r && c.y < H + c.r;
      if (inside) c.seen = true;
      else if (c.t > 30 && (c.seen || c.t > 600)) { this.killCritter(c); continue; }
      // bumping into a critter counts as a hit
      const dx = c.x - p.x, dy = c.y - p.y, rr = c.r * 0.55 + HITBOX;
      if (dx * dx + dy * dy < rr * rr) this.touched();
      const g = c.gun;
      if (g && c.t >= g.first && (c.t - g.first) % Math.max(2, Math.round(g.every / (this.diff.rate * this.diff.critters * (this.diffId === 'stormy' ? 1 : EARLY[this.stage - 1])))) === 0 && c.shots < g.max && c.y > 12 && c.y < top && c.x > 8 && c.x < W - 8 && dx * dx + dy * dy > 96 * 96) {
        c.shots++; this.critterFire(c, g);
      }
    }
  }
  private critterFire(c: Critter, g: Gun) {
    const a = this.aimFrom(c.x, c.y);
    switch (g.p) {
      case 'aim': for (let i = 0; i < g.n; i++) this.shoot(c.x, c.y, a, g.spd * (1 - i * 0.12), g.look, g.hue); break;
      case 'fan': this.fan(c.x, c.y, g.n, g.spread, g.spd, a, g.look, g.hue); break;
      case 'ring': this.ring(c.x, c.y, g.n, g.spd, c.shots * 0.37, g.look, g.hue); break;
      case 'spiral': this.spiral(c.x, c.y, g.n, g.spd, c.t * 0.07, g.look, g.hue); break;
      case 'drop': { const b = this.shoot(c.x, c.y + 6, Math.PI / 2, g.spd, g.look, g.hue); if (b) { b.acc = 0.05 * this.diff.speed; b.maxS = 3.8 * this.diff.speed; } break; }
      case 'burst': this.ring(c.x, c.y, g.n, g.spd, c.t * 0.1, g.look, g.hue, (b) => { b.acc = -0.07 * this.diff.speed; b.at = 44; b.then = THEN.aim; b.thenSpd = 2.8 * this.diff.speed; }); break;
    }
  }
  private moveBullets() {
    const p = this.player, b0 = this.boss; let safe = p.invuln > 0 || p.gasp > 0;
    for (const b of this.bullets) {
      if (!b.on) continue;
      moveBullet(b, p.x, p.y);
      if (bulletGone(b)) { this.killBullet(b); continue; }
      const dx = b.x - p.x; if (dx > GRAZE + 6 || dx < -GRAZE - 6) continue;
      const dy = b.y - p.y; if (dy > GRAZE + 6 || dy < -GRAZE - 6) continue;
      const d2 = dx * dx + dy * dy, rr = b.r + HITBOX;
      if (d2 < rr * rr) { if (!safe) { this.touched(); safe = true; } }
      else if (!b.grazed && !safe && d2 < GRAZE * GRAZE) {
        b.grazed = true; this.grazes++; this.ss.grazes++; this.score += SCORE.graze; this.addMeter(BLOOM.graze);
        this.events.push({ k: 'graze', x: b.x, y: b.y });
      }
    }
    // the boss's body counts as a hit too
    if (b0 && !safe && (b0.state === 'fight' || b0.state === 'break')) { const dx = b0.x - p.x, dy = b0.y - p.y, rr = b0.def.r * 0.5 + HITBOX; if (dx * dx + dy * dy < rr * rr) this.touched(); }
  }
  /** The closest thing to aim a homing seed at. */
  private nearest(x: number, y: number, out: { x: number; y: number }) {
    let best = Infinity, found = false;
    for (const c of this.critters) { if (!c.on || c.y < 0) continue; const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < best) { best = d; out.x = c.x; out.y = c.y; found = true; } }
    const b = this.boss; if (b && b.state === 'fight') { const d = (b.x - x) ** 2 + (b.y - y) ** 2; if (d < best) { out.x = b.x; out.y = b.y; found = true; } }
    return found;
  }
  private moveShots() {
    const b = this.boss, bossOpen = !!b && b.y > 0 && (b.state === 'fight' || b.state === 'enter' || b.state === 'break');
    for (const s of this.shots) {
      if (!s.on) continue;
      s.t++;
      if (s.kind === 2 && this.nearest(s.x, s.y, this.tmp)) {
        const want = Math.atan2(this.tmp.y - s.y, this.tmp.x - s.x), cur = Math.atan2(s.vy, s.vx); let d = want - cur;
        if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
        const a = cur + Math.max(-SHOT.wingTurn, Math.min(SHOT.wingTurn, d)); s.vx = Math.cos(a) * SHOT.wingSpeed; s.vy = Math.sin(a) * SHOT.wingSpeed;
      }
      s.x += s.vx; s.y += s.vy;
      if (s.y < -20 || s.y > H + 20 || s.x < -20 || s.x > W + 20) { this.killShot(s); continue; }
      let gone = false;
      for (const c of this.critters) {
        if (!c.on || c.y < -c.r || s.hits.includes(c.id)) continue;
        const dx = c.x - s.x, dy = c.y - s.y, rr = c.r + 4;
        if (dx * dx + dy * dy >= rr * rr) continue;
        c.hp -= s.dmg; c.flash = 3;
        const small = CRITTERS[c.kind].hp <= SMALL_HP;
        if (c.hp <= 0) this.puff(c);
        if (s.pierce && small) { s.hits.push(c.id); continue; }
        gone = true; break;
      }
      if (!gone && bossOpen && b) {
        const dx = b.x - s.x, dy = b.y - s.y, rr = b.def.r + 4;
        if (dx * dx + dy * dy < rr * rr) { gone = true; if (b.state === 'fight') { this.damageBoss(s.dmg); this.events.push({ k: 'bossHit', x: s.x, y: s.y }); } }
      }
      if (gone) this.killShot(s);
    }
  }
  private moveSeeds() {
    const p = this.player, pull = SEED.pull + SEED.pullPer * this.ups.magnet, top = p.y < SEED.top;
    for (const e of this.seeds) {
      if (!e.on) continue;
      e.t++;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if (d < SEED.collect) { this.collect(e.x, e.y, e.big); this.killSeed(e); continue; }
      if ((e.home && e.t >= e.home) || top || d < pull) e.pulled = true;
      if (e.pulled) { const v = Math.min(d, SEED.fly + e.t * 0.02); e.vx = (dx / d) * v; e.vy = (dy / d) * v; }
      else { e.vx *= 0.96; e.vy = Math.min(SEED.fall, e.vy + 0.06); e.vx += Math.sin((e.t + e.i * 7) * 0.08) * 0.03; }
      e.x += e.vx; e.y += e.vy;
      if (e.y > H + 20) this.killSeed(e);
    }
  }

  /** A fingerprint of the whole state, for replay checks. */
  hash() {
    let h = 2166136261;
    const mix = (v: number) => { h ^= Math.round(v * 1000) | 0; h = Math.imul(h, 16777619) >>> 0; };
    mix(this.tick); mix(this.score); mix(this.purse); mix(this.hearts); mix(this.blooms); mix(this.meter); mix(this.breeze); mix(this.player.x); mix(this.player.y); mix(this.rng.s); mix(this.clock); mix(this.stage);
    for (const b of this.bullets) if (b.on) { mix(b.x); mix(b.y); }
    for (const c of this.critters) if (c.on) { mix(c.x); mix(c.y); mix(c.hp); }
    for (const e of this.seeds) if (e.on) { mix(e.x); mix(e.y); }
    if (this.boss) { mix(this.boss.hp); mix(this.boss.x); mix(this.boss.phase); }
    return h >>> 0;
  }
}

/** Chat lines with their speakers' names filled in for the chosen pilot. */
export function speakerName(g: { pilot: Pilot; wingmate: Pilot }, who: Speaker, boss: BossId) {
  return who === 'boss' ? BOSSES[boss].name : PILOTS[who === 'pilot' ? g.pilot : g.wingmate].name;
}

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'seedstorm-v1';
export type ScoreEntry = { score: number; pilot: Pilot; stage: number; cleared: boolean; continues: number; date: number };
export type Save = {
  v: 1; pilot: Pilot; diff: Diff;
  scores: Record<Diff, ScoreEntry[]>; reached: Record<Diff, number>; cleared: Record<Diff, boolean>;
  settings: { sound: boolean; music: boolean; shake: boolean };
};
export const TOP = 5;
export const freshSave = (): Save => ({
  v: 1, pilot: 'dora', diff: 'gusty',
  scores: { breezy: [], gusty: [], stormy: [] }, reached: { breezy: 0, gusty: 0, stormy: 0 }, cleared: { breezy: false, gusty: false, stormy: false },
  settings: { sound: true, music: true, shake: true },
});
const isPilot = (p: unknown): p is Pilot => p === 'dora' || p === 'enzo';
const isDiff = (d: unknown): d is Diff => d === 'breezy' || d === 'gusty' || d === 'stormy';
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo);
/** Reads a save defensively: anything missing, broken or from another version is replaced by the default. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Save> | null; if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return s;
    if (isPilot(o.pilot)) s.pilot = o.pilot;
    if (isDiff(o.diff)) s.diff = o.diff;
    for (const d of DIFF_IDS) {
      const list = o.scores && typeof o.scores === 'object' ? (o.scores as Record<string, unknown>)[d] : null;
      if (Array.isArray(list)) s.scores[d] = list.filter((e): e is ScoreEntry => !!e && typeof e === 'object' && isPilot((e as ScoreEntry).pilot) && typeof (e as ScoreEntry).score === 'number' && Number.isFinite((e as ScoreEntry).score))
        .map((e) => ({ score: num(e.score, 0, 1e9), pilot: e.pilot, stage: num(e.stage, 1, STAGE_COUNT), cleared: e.cleared === true, continues: num(e.continues, 0, 999), date: num(e.date, 0, 1e14) }))
        .sort((a, b) => b.score - a.score).slice(0, TOP);
      if (o.reached && typeof o.reached === 'object') s.reached[d] = num((o.reached as Record<string, unknown>)[d], 0, STAGE_COUNT);
      if (o.cleared && typeof o.cleared === 'object') s.cleared[d] = (o.cleared as Record<string, unknown>)[d] === true;
    }
    if (o.settings && typeof o.settings === 'object') { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; s.settings.shake = o.settings.shake !== false; }
  } catch { return freshSave(); }
  return s;
}
/** The highest stage reached on any difficulty: every stage up to it can be practised. */
export const practiceUpTo = (s: Save) => Math.max(...DIFF_IDS.map((d) => s.reached[d]));
/** Notes that a stage has been reached (practice runs don't count). */
export function noteReached(s: Save, g: SeedstormGame) {
  if (g.practice) return;
  s.reached[g.diffId] = Math.max(s.reached[g.diffId], g.stage);
  if (g.phase === 'won') s.cleared[g.diffId] = true;
}
/** Adds a finished run's score to its difficulty's table; returns its place (0 is the top) or -1 if it didn't make it. */
export function recordScore(s: Save, g: SeedstormGame, date: number): number {
  noteReached(s, g);
  if (g.practice || g.score <= 0) return -1;
  const e: ScoreEntry = { score: g.score, pilot: g.pilot, stage: g.stage, cleared: g.phase === 'won', continues: g.continues, date };
  const list = [...s.scores[g.diffId], e].sort((a, b) => b.score - a.score || a.date - b.date).slice(0, TOP);
  s.scores[g.diffId] = list;
  return list.indexOf(e);
}

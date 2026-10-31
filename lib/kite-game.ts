// Kite Day's rules: a tethered kite flying on real lift and drag in a seeded wind, the chinchilla on the ground
// holding the line, tricks read from the kite's path, and the summer's challenges, medals and saves. Deterministic:
// a fixed step, seeded wind and seeded rivals; no DOM, no Math.random and no clock.
//
// The kite is a wing in the side-on plane. The air it meets is the wind minus its own velocity; its nose sets the
// angle of attack, which sets the lift (across the airflow) and the drag (along it), and stalls when it is too steep.
// The line is a rope of a given length from the paws: when it is tight it holds the kite back against the wind, and
// that is where the kite's power comes from, so it flies fastest crosswind in the middle of the wind window and runs
// out of power at its edge, overhead. Pulling reels the line in (the kite climbs and speeds up), easing lets it pay
// out against the reel's drag (the kite drifts back and glides). Let the line go slack in a lull and the kite stalls
// and tumbles; it lands softly in the grass, a tree or a pond and is reeled back in.
import { PLACES, PLACE_IDS, windAt, groundAt, surfaceAt, waterAt, treeCanopy, rng, gustAt, type Place, type PlaceId, type WindSample } from './kite-world.js';
import { CHALLENGES, CHALLENGE, challengesIn, type Challenge, type Shape, type Target, type Cue, type Rival } from './kite-levels.js';
export { PLACES, PLACE_IDS, CHALLENGES, CHALLENGE, challengesIn, windAt, groundAt, surfaceAt, waterAt, gustAt, rng, treeCanopy };
export type { Place, PlaceId, Challenge, Shape, Target, Cue, Rival, WindSample };

export const FPS = 60;
export const DT = 1 / FPS;
const SUB = 4;
/** how far inside the line's length the kite can be and still feel some pull (the line sags and stretches) */
const SAG = 3.5;
export const G = 9.8;
const RHO = 1.2;
/** how fast pulling reels the line in, and the line's shortest length */
export const PULL = 3.4;
export const LMIN = 4;
/** easing lets the line run out: a little on its own, faster the harder the kite pulls, up to EASE_MAX m/s */
const EASE_MAX = 4.5;
/** with neither, the reel holds, unless the kite pulls harder than this (then it slips) */
const SLIP = 40;
/** how high the paws are above the ground, and how fast the chinchilla walks */
export const HAND = 1.1;
export const WALK = 2.4;
/** the kite's radius for touching things */
export const KITE_R = 0.6;

// ---------------------------------------------------------------- kite shapes
export type ShapeDef = {
  name: string; blurb: string;
  /** sail area (m²) and mass (kg) */
  area: number; mass: number;
  /** the most lift, the angle of attack where it stalls, the drag at zero angle and the drag that grows with angle */
  cl: number; stall: number; cd0: number; cdk: number;
  /** how fast the nose turns (rad/s at full airspeed) and how strongly the tail and bridle steady it */
  turn: number; stab: number;
  /** the trim angle the bridle settles the kite at, and how long the line is */
  trim: number; lmax: number;
  /** tail length (m) */
  tail: number;
};
export const SHAPES: Record<Shape, ShapeDef> = {
  diamond: { name: 'Diamond', blurb: 'The classic: steady, easy to steer, happy in most winds.', area: 0.62, mass: 0.17, cl: 1.15, stall: 0.46, cd0: 0.14, cdk: 1.25, turn: 3.6, stab: 3.2, trim: 0.45, lmax: 28, tail: 2.6 },
  sled: { name: 'Sled', blurb: 'No spars across, very light and very floaty: it flies in the lightest breeze, but turns lazily.', area: 0.72, mass: 0.1, cl: 1.3, stall: 0.55, cd0: 0.16, cdk: 1.35, turn: 2.8, stab: 3.8, trim: 0.42, lmax: 32, tail: 1.2 },
  delta: { name: 'Delta', blurb: 'A sleek swept wing with little drag: the fastest kite crosswind, for rings and races.', area: 0.6, mass: 0.16, cl: 1.2, stall: 0.36, cd0: 0.07, cdk: 1.1, turn: 4.2, stab: 2.2, trim: 0.4, lmax: 30, tail: 1.6 },
  box: { name: 'Box', blurb: 'Heavy and rock-steady with lots of drag: it shrugs off gusts and loves a strong wind.', area: 0.78, mass: 0.32, cl: 1.0, stall: 0.62, cd0: 0.24, cdk: 1.45, turn: 2.7, stab: 6, trim: 0.5, lmax: 26, tail: 0.8 },
  bird: { name: 'Swallow', blurb: 'A bird-shaped stunt kite that turns on a feather: tight loops, nervy in gusts.', area: 0.5, mass: 0.12, cl: 1.15, stall: 0.4, cd0: 0.09, cdk: 1.2, turn: 6.2, stab: 1.4, trim: 0.42, lmax: 28, tail: 1.4 },
  dragon: { name: 'Dragon', blurb: 'A long ribbon tail makes it very steady and gives duels a streamer to aim for.', area: 0.66, mass: 0.22, cl: 1.12, stall: 0.5, cd0: 0.18, cdk: 1.3, turn: 3.2, stab: 5, trim: 0.48, lmax: 28, tail: 5.2 },
};
export const SHAPE_IDS: Shape[] = ['diamond', 'sled', 'delta', 'box', 'bird', 'dragon'];

/** Lift coefficient at angle of attack a (radians, signed): it rises to the peak at the stall angle, then drops. */
export function liftCoef(S: ShapeDef, a: number): number {
  const s = Math.sign(a); let x = Math.abs(a), back = 1;
  if (x > Math.PI / 2) { x = Math.PI - x; back = 0.5; }
  const pre = x <= S.stall ? S.cl * Math.sin((Math.PI / 2) * (x / S.stall)) : S.cl * Math.exp(-(((x - S.stall) / 0.2) ** 2));
  const plate = 0.62 * Math.sin(2 * x);
  return s * back * (x <= S.stall ? pre : Math.max(pre, plate));
}
export const dragCoef = (S: ShapeDef, a: number) => S.cd0 + S.cdk * Math.sin(a) ** 2;

// ---------------------------------------------------------------- painting a kite
export type Stencil = 'plain' | 'stripes' | 'dots' | 'sun' | 'leaf' | 'waves' | 'feather' | 'star' | 'heart';
export const STENCILS: Stencil[] = ['plain', 'stripes', 'dots', 'sun', 'leaf', 'waves', 'feather', 'star', 'heart'];
/** gouache colours for sails, stencils and tails */
export const COLOURS = ['#e8574a', '#f39a3d', '#f6cd3f', '#7cbf5a', '#2f9a8c', '#3a78c8', '#6a5bbf', '#d3609c', '#fbf3df', '#3a3550'];
export const COLOUR_NAMES = ['poppy', 'apricot', 'buttercup', 'sap green', 'sea green', 'cobalt', 'violet', 'rose', 'cream', 'ink'];
export type Paint = { sail: number; stencil: Stencil; ink: number; tail: number };
export type Design = { shape: Shape; paint: Paint };
export const DEFAULT_PAINT: Record<Shape, Paint> = {
  diamond: { sail: 0, stencil: 'stripes', ink: 2, tail: 5 },
  sled: { sail: 2, stencil: 'dots', ink: 0, tail: 7 },
  delta: { sail: 5, stencil: 'sun', ink: 2, tail: 0 },
  box: { sail: 4, stencil: 'stripes', ink: 8, tail: 2 },
  bird: { sail: 6, stencil: 'feather', ink: 8, tail: 1 },
  dragon: { sail: 3, stencil: 'leaf', ink: 0, tail: 2 },
};
/** The stencils each place gives the first time a challenge there is finished. */
export const STENCIL_FROM: Partial<Record<Stencil, PlaceId>> = { sun: 'meadow', leaf: 'orchard', waves: 'beach', feather: 'hilltop', star: 'fete', heart: 'cliffs' };

// ---------------------------------------------------------------- input
/** One step's controls. `aim` (a point in the world) steers the nose toward it; otherwise `steer` turns it
 * (+1 anticlockwise, -1 clockwise). `walk` moves the chinchilla (-1 left, +1 right). */
export type Input = { pull: boolean; ease?: boolean; steer: number; aim: [number, number] | null; walk: number };
export const NO_INPUT: Input = { pull: false, ease: false, steer: 0, aim: null, walk: 0 };

const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- the kite
export type Down = 'grass' | 'tree' | 'water' | 'roof' | 'sand';
export type KiteState = 'fly' | 'down' | 'reel';
export class Kite {
  x = 0; y = 0; vx = 0; vy = 0; psi = Math.PI * 0.6; L = 9;
  /** the paws: where the line starts */
  hx = 0; hy = 0; hvx = 0;
  taut = false; tension = 0; slackT = 0; q = 0; aoa = 0; stalled = false;
  tumbling = false; tumbleDir = 1; tumbleT = 0; recoverT = 0;
  state: KiteState = 'fly'; down: Down = 'grass'; downT = 0;
  parcels = 0; pulling = false; easing = false; steer = 0; walking = 0; chi = Math.PI / 2; steering = false;
  /** the tail streamer, a chain of points behind the kite: [x0, y0, x1, y1, …] */
  tail: number[] = [];
  /** the trick reader */
  turnAcc = 0; turnRev = 0; speedAvg = 0; idleT = 0; box: [number, number, number, number] = [0, 0, 0, 0];
  lastHighT = -99; swoopArmed = false;
  /** a smoothed wind sample at the kite, for the scene */
  wind: WindSample = { u: 0, w: 0, gust: 0, lull: 0, shelter: 0, lift: 0 };
  constructor(public design: Design, public who: string) {}
  get S() { return SHAPES[this.design.shape]; }
  get mass() { return this.S.mass + this.parcels * 0.035; }
  get lmax() { return this.S.lmax; }
  get speed() { return Math.hypot(this.vx, this.vy); }
}

export type Ev =
  | { k: 'ring'; i: number; x: number; y: number; last: boolean }
  | { k: 'pop'; i: number; x: number; y: number; kind: string }
  | { k: 'deliver'; i: number; x: number; y: number; left: number }
  | { k: 'trick'; name: 'loop' | 'eight' | 'swoop'; points: number; chain: number; x: number; y: number; who: number }
  | { k: 'land'; where: Down; x: number; y: number; who: number }
  | { k: 'launch'; who: number }
  | { k: 'tumble'; who: number } | { k: 'recover'; who: number }
  | { k: 'touch'; by: number; x: number; y: number; score: [number, number] }
  | { k: 'tangle' } | { k: 'untangle' }
  | { k: 'cue'; i: number; good: boolean; perfect: boolean; points: number; x: number; y: number }
  | { k: 'dragonfly'; i: number }
  | { k: 'done'; won: boolean; value: number; medal: number }
  | { k: 'gust' } | { k: 'lull' };

export const TRICK_POINTS = { loop: 100, eight: 250, swoop: 150 } as const;

/** The nose heading that takes the kite toward a point. On a tight line the kite can only slide round the arc of
 * its line (the line's length does the rest: ease to let it out, pull to bring it in), so the heading leans along
 * the arc toward the point; on a slack line it simply points at it. Null when the kite is already there. */
export function aimHeading(k: Kite, tx: number, ty: number): number | null {
  const dx = tx - k.x, dy = ty - k.y;
  if (Math.hypot(dx, dy) < 1.2) return null;
  // judge from where the kite will be in a moment, so it eases into the point instead of overshooting it
  const px = k.x + k.vx * 0.4, py = k.y + k.vy * 0.4;
  const ex = px - k.hx, ey = py - k.hy, d = Math.hypot(ex, ey) || 1, rx = ex / d, ry = ey / d;
  const tight = clamp((d - (k.L - SAG)) / SAG, 0, 1);
  // seen from the paws: how far round the arc the point is, and how much farther out (or in)
  const tvx = tx - k.hx, tvy = ty - k.hy;
  const along = tight > 0.5 ? wrap(Math.atan2(tvy, tvx) - Math.atan2(ey, ex)) * d : dx * -ry + dy * rx;
  const out = tight > 0.5 ? clamp(Math.hypot(tvx, tvy) - d, -3, 3) : dx * rx + dy * ry;
  if (tight > 0.5 && Math.abs(along) < 1.0 && Math.abs(out) < 4) return null;
  // far round the arc, fly along it (that is where the power is); close, lean out or in for the line to follow
  const w = (1 - 0.65 * tight) * (tight > 0.5 ? clamp(1 - Math.abs(along) / 4, 0.1, 1) : 1);
  return Math.atan2(along * rx + out * w * ry, along * -ry + out * w * rx);
}

/** Puts a kite in the air near the paws, nose up, on a short line. */
export function launch(k: Kite, P: Place, L = 8, angle = 0.95) {
  k.L = clamp(L, LMIN, k.lmax);
  k.x = k.hx + Math.cos(angle) * k.L * 0.98; k.y = k.hy + Math.sin(angle) * k.L * 0.98;
  k.vx = 0; k.vy = 1.5; k.psi = Math.PI * 0.82; k.state = 'fly'; k.tumbling = false; k.tumbleT = 0; k.taut = false; k.slackT = 0;
  k.turnAcc = 0; k.turnRev = 0; k.swoopArmed = false;
  k.tail = []; for (let i = 0; i <= 8; i++) k.tail.push(k.x - i * 0.1, k.y - i * (k.S.tail / 8));
  void P;
}

/** Places the chinchilla's paws at ground x. */
export function setHand(k: Kite, P: Place, x: number) { k.hx = x; k.hy = groundAt(P, x) + HAND; }

/** Where a kite is down: in a tree, on a roof, in the water, or on the ground. */
function hitSomething(P: Place, x: number, y: number): Down | null {
  for (const t of P.trees) { const [cx, cy, r] = treeCanopy(P, t); if ((x - cx) ** 2 + ((y - cy) * 1.15) ** 2 < (r * 0.86) ** 2) return 'tree'; }
  for (const b of P.buildings) {
    if (x < b.x0 || x > b.x1) continue;
    const g = groundAt(P, (b.x0 + b.x1) / 2), mid = (b.x0 + b.x1) / 2, half = (b.x1 - b.x0) / 2;
    if (y < g + b.h + b.roof * (1 - Math.abs(x - mid) / half)) return 'roof';
  }
  const s = surfaceAt(P, x);
  if (y < s + 0.35) { if (waterAt(P, x) !== null) return 'water'; return P.id === 'beach' && x > 26 ? 'sand' : 'grass'; }
  return null;
}

/** One fixed step of a kite's flight. Returns the events it made. */
export function stepKite(k: Kite, P: Place, seed: number, t: number, inp: Input, who: number, out: Ev[]) {
  const S = k.S;
  // the chinchilla walks (only while flying; you can't walk off while reeling in)
  const walk = k.state === 'fly' ? clamp(inp.walk, -1, 1) : 0;
  k.walking = walk;
  const nx = clamp(k.hx + walk * WALK * DT, P.walk[0], P.walk[1]);
  k.hvx = (nx - k.hx) / DT; setHand(k, P, nx);
  k.pulling = inp.pull; k.easing = !inp.pull && !!inp.ease;

  if (k.state !== 'fly') { stepDown(k, P, seed, t, inp, who, out); updateTail(k, DT); return; }

  // steering: the keys turn the nose; the pointer turns it toward a point; no hands, and the bridle and tail settle it
  let turn = 0, aimAt: number | null = null;
  if (!k.tumbling) {
    if (inp.aim) aimAt = aimHeading(k, inp.aim[0], inp.aim[1]);
    else turn = clamp(inp.steer, -1, 1);
  }
  k.steering = aimAt !== null || Math.abs(turn) > 0.05;
  k.steer = aimAt !== null ? clamp(wrap(aimAt - k.psi) * 2, -1, 1) : turn;
  const h = DT / SUB;
  let impulse = 0, sumQ = 0;
  for (let s = 0; s < SUB; s++) {
    const tt = t + s * h;
    const wnd = windAt(P, seed, k.x, k.y, tt);
    if (s === 0) k.wind = wnd;
    const ax = wnd.u - k.vx, ay = wnd.w - k.vy, q = Math.hypot(ax, ay);
    sumQ += q;
    const dx = k.x - k.hx, dy = k.y - k.hy, dl = Math.hypot(dx, dy) || 1, rx = dx / dl, ry = dy / dl;
    let fx = 0, fy = -k.mass * G;
    const ux = Math.cos(k.psi), uy = Math.sin(k.psi);
    // the wind's share along the line is the kite's power (pulling adds to it): with the line tight, the sail turns
    // it into a drive along the nose. It is strongest in the middle of the wind window and gone at its edge.
    const wr = Math.max(0, wnd.u * rx + wnd.w * ry + (k.pulling ? PULL : 0) - k.hvx * rx);
    // a real line stretches and sags a little, so a nearly tight line still carries some of the pull
    const tight = clamp((dl - (k.L - SAG)) / SAG, 0, 1);
    const power = !k.tumbling ? 0.5 * RHO * S.area * S.cl * wr * wr * tight : 0;
    // and a glide: a moving kite's sail still makes a little lift across its path even on a slack line
    fx += power * ux; fy += power * uy;
    if (q > 1e-4) {
      const hx = ax / q, hy = ay / q, inflow = Math.atan2(-hy, -hx);
      const a = wrap(k.psi - inflow);
      k.aoa = a;
      const Q = 0.5 * RHO * q * q * S.area;
      // the sail is a plate: air sliding along it (nose-first) drags a little, air pushing across it pushes hard,
      // along the sail's normal. That push is both drag and lift, and it makes the kite carve where its nose points.
      const nx = -uy, ny = ux, an = ax * nx + ay * ny, aux = ax * ux + ay * uy;
      const cn = k.tumbling ? 0.25 : S.cdk, ca = (k.tumbling ? 0.6 : S.cd0) + k.parcels * 0.06 + 0.012 * S.tail;
      const half = 0.5 * RHO * S.area;
      fx += half * (ca * q * aux * ux + cn * Math.abs(an) * an * nx);
      fy += half * (ca * q * aux * uy + cn * Math.abs(an) * an * ny);
      k.stalled = !k.taut && q < 3;
    }
    if (!k.tumbling) {
      const auth = clamp(0.5 + q / 8, 0.5, 1.3);
      if (k.steering) {
        const r = S.turn * auth;
        k.psi = wrap(k.psi + (aimAt !== null ? clamp(wrap(aimAt - k.psi) * 6, -r, r) : turn * r) * h);
      } else {
        // the bridle holds the nose along the line's arc, toward the top of the window; slack, the tail points it up into the air
        const park = k.taut ? Math.atan2(ry, rx) + Math.PI / 2 - (k.vx < 0 ? 0 : 0) : Math.atan2(-ay, -ax) * 0.4 + (Math.PI / 2) * 0.6;
        const r = S.stab * auth * 0.6;
        k.psi = wrap(k.psi + clamp(wrap(park - k.psi) * 3, -r, r) * h);
      }
      // rough air knocks the nose about; a steady kite shrugs it off
      const rough = (P.wind.rough + wnd.shelter * 0.3) * P.wind.speed;
      if (rough > 0) k.psi = wrap(k.psi + (rough / S.stab) * 0.9 * h * Math.sin(tt * 9.1 + k.x * 1.7 + Math.sin(tt * 3.3) * 2));
    }
    if (k.tumbling) k.psi = wrap(k.psi + k.tumbleDir * 7.5 * h);
    k.vx += (fx / k.mass) * h; k.vy += (fy / k.mass) * h;
    // a little air damping so nothing runs away
    k.vx *= 1 - 0.02 * h; k.vy *= 1 - 0.02 * h;
    k.x += k.vx * h; k.y += k.vy * h;
    // the line: pulling reels in; easing pays out against the reel's drag once the pull is strong enough
    const rate = inp.pull ? -PULL : k.easing ? clamp(1.4 + k.tension * 0.35, 0, EASE_MAX) : k.tension > SLIP ? 1 : 0;
    k.L = clamp(k.L + rate * h, LMIN, k.lmax);
    const ex = k.x - k.hx, ey = k.y - k.hy, d = Math.hypot(ex, ey);
    if (d >= k.L) {
      const lx = ex / d, ly = ey / d;
      k.x = k.hx + lx * k.L; k.y = k.hy + ly * k.L;
      const vr = (k.vx - k.hvx) * lx + k.vy * ly, allowed = k.L <= LMIN + 1e-6 || k.L >= k.lmax - 1e-6 ? 0 : rate;
      if (vr > allowed) { const j = vr - allowed; k.vx -= j * lx; k.vy -= j * ly; impulse += k.mass * j; }
      k.taut = true;
    } else k.taut = d > k.L - 0.05;
  }
  k.q = sumQ / SUB;
  const T = impulse / DT;
  k.tension += (T - k.tension) * 0.3;
  k.speedAvg += (k.speed - k.speedAvg) * 0.05;

  // stalls and tumbles: a slack line and too little air, and the kite loses its grip on the sky
  if (!k.tumbling) {
    if (!k.taut && k.q < 2.6) k.slackT += DT; else k.slackT = Math.max(0, k.slackT - DT * 2);
    if (k.slackT > 0.7) { k.tumbling = true; k.tumbleT = 0; k.recoverT = 0; k.tumbleDir = k.psi > 0 ? 1 : -1; k.turnAcc = 0; out.push({ k: 'tumble', who }); }
  } else {
    k.tumbleT += DT;
    if (k.taut && k.tension > k.mass * G * 1.5) k.recoverT += DT; else k.recoverT = Math.max(0, k.recoverT - DT);
    if (k.recoverT > 0.3) { k.tumbling = false; k.slackT = 0; k.psi = Math.atan2(k.y - k.hy, k.x - k.hx) + Math.PI / 2; out.push({ k: 'recover', who }); }
  }

  // the world: keep it inside, and land it when it touches the ground, a tree, a roof or the water
  if (k.y > 60) { k.y = 60; k.vy = Math.min(0, k.vy); }
  const hit = hitSomething(P, k.x, k.y);
  if (hit) {
    k.state = 'down'; k.down = hit; k.downT = 0; k.tumbling = false; k.vx = 0; k.vy = 0; k.turnAcc = 0; k.swoopArmed = false;
    if (hit !== 'tree' && hit !== 'roof') k.y = surfaceAt(P, k.x) + 0.3;
    out.push({ k: 'land', where: hit, x: k.x, y: k.y, who });
  }
  updateTail(k, DT);
}

/** A kite that is down: it rests a moment, then the line reels it back (faster while you pull) and it relaunches. */
function stepDown(k: Kite, P: Place, seed: number, t: number, inp: Input, who: number, out: Ev[]) {
  k.downT += DT; k.taut = false; k.tension = 0; k.q = 0;
  if (k.down === 'water') k.y = (waterAt(P, k.x) ?? k.y) + 0.15 + Math.sin(t * 3) * 0.06;
  if (k.downT < 0.9) return;
  k.state = 'reel';
  const sp = (inp.pull ? 9 : 4.5) * DT;
  const dx = k.hx + 1.4 - k.x, dy = k.hy + 0.4 - k.y, d = Math.hypot(dx, dy);
  if (d > sp) {
    k.x += (dx / d) * sp;
    // dragged over the ground, it hugs it; out of a tree it drops first
    k.y = Math.max(surfaceAt(P, k.x) + 0.3, k.y + (dy / d) * sp - (k.down === 'tree' || k.down === 'roof' ? 0.04 : 0));
    k.L = Math.max(LMIN, Math.hypot(k.x - k.hx, k.y - k.hy));
    k.psi = wrap(k.psi + 0.05 * Math.sin(t * 5));
    return;
  }
  // back in the paws: up it goes again, if there is any wind at all
  const w = windAt(P, seed, k.hx + 3, k.hy + 4, t);
  if (w.u < 1.2) return;
  launch(k, P, 7, 1.0);
  out.push({ k: 'launch', who });
}

/** The tail streamer trails behind the kite in the airflow. */
function updateTail(k: Kite, dt: number) {
  const n = 8, seg = k.S.tail / n;
  if (k.tail.length !== (n + 1) * 2) { k.tail = []; for (let i = 0; i <= n; i++) k.tail.push(k.x, k.y - i * seg); }
  const ux = Math.cos(k.psi), uy = Math.sin(k.psi);
  k.tail[0] = k.x - ux * 0.45; k.tail[1] = k.y - uy * 0.45;
  const wx = k.wind.u * 0.06, wy = -0.5;
  for (let i = 1; i <= n; i++) {
    let x = k.tail[i * 2] + wx * dt * 6, y = k.tail[i * 2 + 1] + wy * dt * 6 + Math.sin(i * 1.3 + k.x * 0.8) * 0.004;
    const px = k.tail[i * 2 - 2], py = k.tail[i * 2 - 1], dx = x - px, dy = y - py, d = Math.hypot(dx, dy) || 1;
    x = px + (dx / d) * seg; y = py + (dy / d) * seg;
    k.tail[i * 2] = x; k.tail[i * 2 + 1] = y;
  }
}

// ---------------------------------------------------------------- tricks
/** Reads loops, figure-eights and swoops from a kite's nose and path. Returns the trick, if one just finished. */
export type TrickState = { last: { dir: number; t: number } | null; chainT: number; chain: number; score: number; loops: number; eights: number; swoops: number; best: number };
export const freshTricks = (): TrickState => ({ last: null, chainT: -99, chain: 0, score: 0, loops: 0, eights: 0, swoops: 0, best: 0 });
export function readTricks(k: Kite, P: Place, st: TrickState, t: number, prevPsi: number, who: number, out: Ev[]) {
  if (k.state !== 'fly' || k.tumbling) { k.turnAcc = 0; k.turnRev = 0; k.swoopArmed = false; return; }
  // a loop is the kite's nose (and so its path, as it carves) turning right round, over a path at least a couple
  // of metres across: a kite spinning on the spot is not looping
  const d = wrap(k.psi - prevPsi);
  if (k.turnAcc !== 0 && Math.sign(d) !== Math.sign(k.turnAcc) && d !== 0) {
    k.turnRev += Math.abs(d);
    if (k.turnRev > 0.9) { k.turnAcc = 0; k.turnRev = 0; k.box = [k.x, k.y, k.x, k.y]; }
  } else k.turnRev = Math.max(0, k.turnRev - Math.abs(d) * 0.5);
  // only flown turns count: let go of the steering for a moment and the count starts again
  k.idleT = k.steering ? 0 : k.idleT + DT;
  if (k.idleT > 0.8) k.turnAcc = 0;
  if (k.turnAcc === 0) k.box = [k.x, k.y, k.x, k.y];
  k.box = [Math.min(k.box[0], k.x), Math.min(k.box[1], k.y), Math.max(k.box[2], k.x), Math.max(k.box[3], k.y)];
  k.turnAcc += d;
  const award = (name: 'loop' | 'eight' | 'swoop') => {
    st.chain = t - st.chainT <= 3 ? st.chain + 1 : 0; st.chainT = t;
    const mult = Math.min(3, 1 + st.chain * 0.5), points = Math.round(TRICK_POINTS[name] * mult);
    st.score += points; st.best = Math.max(st.best, st.chain + 1);
    out.push({ k: 'trick', name, points, chain: st.chain + 1, x: k.x, y: k.y, who });
  };
  if (Math.abs(k.turnAcc) >= Math.PI * 2 - 0.15) {
    const dir = Math.sign(k.turnAcc);
    k.turnAcc -= dir * Math.PI * 2;
    const across = Math.max(k.box[2] - k.box[0], k.box[3] - k.box[1]);
    k.box = [k.x, k.y, k.x, k.y];
    if (k.speedAvg >= 2.2 && across >= 1.6) {
      st.loops++; award('loop');
      if (st.last && st.last.dir === -dir && t - st.last.t <= 4) { st.eights++; award('eight'); st.last = null; }
      else st.last = { dir, t };
    }
  }
  const above = k.y - groundAt(P, k.x);
  if (above > 9) k.lastHighT = t;
  if (!k.swoopArmed && above < 2.4 && k.speed > 7 && t - k.lastHighT < 3.5) k.swoopArmed = true;
  if (k.swoopArmed && above > 5) { k.swoopArmed = false; st.swoops++; award('swoop'); }
}

// ---------------------------------------------------------------- a flight: one challenge (or free flying)
export type Who = 'dora' | 'enzo';
export type FlightSpec = { place: PlaceId; challenge: string | null; design: Design; flyer: Who; seed?: number };
export const targetAt = (g: Target, t: number): [number, number] => {
  if (!g.period) return [g.x, g.y];
  const a = (t / g.period + (g.phase ?? 0)) * Math.PI * 2;
  return [g.x + (g.mx ?? 0) * Math.sin(a), g.y + (g.my ?? 0) * Math.cos(a * 1.3)];
};
/** Do two line segments cross? */
export function segCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(d) < 1e-9) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98;
}
/** The dragonfly's position along its gates after flying for t seconds at its speed. */
export function dragonflyAt(gates: Target[], start: [number, number], speed: number, t: number): { x: number; y: number; gate: number; done: boolean } {
  let left = Math.max(0, t) * speed, px = start[0], py = start[1];
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i], d = Math.hypot(g.x - px, g.y - py);
    if (left <= d) { const f = left / d; return { x: px + (g.x - px) * f, y: py + (g.y - py) * f, gate: i, done: false }; }
    left -= d; px = g.x; py = g.y;
  }
  return { x: px, y: py, gate: gates.length, done: true };
}
export const dragonflyTime = (gates: Target[], start: [number, number], speed: number) => {
  let d = 0, px = start[0], py = start[1]; for (const g of gates) { d += Math.hypot(g.x - px, g.y - py); px = g.x; py = g.y; } return d / speed;
};

/** A partner or a rival flown by the computer: it aims where its target was a moment ago, with a wobble. */
class Pilot {
  hist: [number, number][] = []; r: () => number; wob = [0, 0]; wobT = 0;
  constructor(seed: number, public react: number, public noise: number) { this.r = rng(seed); }
  aim(tx: number, ty: number): [number, number] {
    this.hist.push([tx, ty]);
    const lag = Math.round(this.react * FPS);
    while (this.hist.length > lag + 1) this.hist.shift();
    const [x, y] = this.hist[0];
    if (--this.wobT <= 0) { this.wobT = 30 + Math.floor(this.r() * 40); this.wob = [(this.r() * 2 - 1) * this.noise, (this.r() * 2 - 1) * this.noise]; }
    return [x + this.wob[0], y + this.wob[1]];
  }
}
/** A simple line keeper for the computer's fliers (and the tests): pull when the line is too long for the point or
 * the kite is about to touch down, ease when the point is farther than the line, otherwise hold. */
export function keeper(k: Kite, P: Place, tx: number, ty: number): { pull: boolean; ease: boolean } {
  if (k.state !== 'fly' || k.tumbling) return { pull: true, ease: false };
  const want = Math.hypot(tx - k.hx, ty - k.hy), above = k.y - groundAt(P, k.x);
  if (k.L > want + 1.5) return { pull: true, ease: false };
  if (above < 2.5 && k.vy < 0) return { pull: true, ease: false };
  if (k.L < want - 0.8) return { pull: false, ease: true };
  return { pull: k.q < 2.8, ease: false };
}

export class Flight {
  P: Place; ch: Challenge | null; seed: number; t = 0; steps = 0;
  kites: Kite[] = [];
  events: Ev[] = [];
  tricks: TrickState[] = [freshTricks(), freshTricks()];
  /** progress: the next ring, popped targets, delivered baskets, time in the zone, cues hit */
  next = 0; popped: boolean[] = []; delivered: boolean[] = []; inZone = 0; cueHit: number[] = []; cueScore = 0; cueNext = 0;
  touches: [number, number] = [0, 0]; touchCool = 0; tangle = 0; tangled = 0;
  done = false; won = false; value = 0; medal = 0;
  dfStart: [number, number] = [0, 0]; dfTime = 0;
  pilot: Pilot | null = null;
  rivalMode: 'hunt' | 'evade' | 'swoop' | 'clear' = 'swoop';
  partnerPath: [number, number][] = [];
  flyer: Who; design: Design;
  private prevPsi: number[] = [];
  private evFrom = 0;
  private lastGust = 0;
  constructor(spec: FlightSpec) {
    this.P = PLACES[spec.place];
    this.ch = spec.challenge ? CHALLENGE[spec.challenge] ?? null : null;
    this.seed = spec.seed ?? this.ch?.seed ?? 7;
    this.flyer = spec.flyer; this.design = spec.design;
    const me = new Kite(spec.design, spec.flyer);
    setHand(me, this.P, this.P.start); launch(me, this.P, this.ch?.line ?? 9, 0.95);
    this.kites.push(me);
    const goal = this.ch?.goal;
    if (goal?.kind === 'deliver') { me.parcels = goal.baskets.length; this.delivered = goal.baskets.map(() => false); }
    if (goal?.kind === 'pop') this.popped = goal.targets.map(() => false);
    if (goal?.kind === 'race') { this.dfStart = [me.x, me.y]; this.dfTime = dragonflyTime(goal.gates, this.dfStart, goal.dragonfly); }
    if (goal?.kind === 'duel') {
      const R = goal.rival, rv = new Kite({ shape: R.shape, paint: { sail: R.sail, stencil: 'stripes', ink: 8, tail: R.tail } }, R.name);
      setHand(rv, this.P, this.P.start + R.offset); launch(rv, this.P, 12, 0.55);
      this.kites.push(rv); this.pilot = new Pilot(this.seed * 31 + 5, R.react, R.noise);
    }
    if (goal?.kind === 'routine') {
      const other: Who = spec.flyer === 'dora' ? 'enzo' : 'dora';
      const pd = new Kite({ shape: spec.design.shape, paint: { ...spec.design.paint, sail: (spec.design.paint.sail + 5) % COLOURS.length } }, other);
      setHand(pd, this.P, this.P.start - 3); launch(pd, this.P, 9, 1.05);
      this.kites.push(pd); this.pilot = new Pilot(this.seed * 17 + 3, 0.25, 0.6);
      this.cueHit = goal.cues.map(() => 0);
    }
    this.prevPsi = this.kites.map((k) => k.psi);
  }
  get me() { return this.kites[0]; }
  get other(): Kite | null { return this.kites[1] ?? null; }
  get limit() { return this.ch?.goal.limit ?? Infinity; }
  get timeLeft() { return Math.max(0, this.limit - this.t); }

  /** What the computer flier wants this step. */
  private otherInput(): Input {
    const o = this.other!, me = this.me, goal = this.ch!.goal;
    if (goal.kind === 'duel') {
      const R = goal.rival, tail = me.tail, n = tail.length / 2 - 1, r = this.pilot!.r;
      const [ex, ey] = [tail[n * 2], tail[n * 2 + 1]];
      const reach = Math.hypot(ex - o.hx, ey - o.hy) < o.lmax - 3 && ex > o.hx + 2 && ey > o.hy + 3;
      const ot = o.tail.length / 2 - 1, threat = Math.hypot(me.x - o.tail[ot], me.y - o.tail[ot + 1]) < 4.5;
      let tx: number, ty: number;
      if (this.tangle > 0.15 || me.state !== 'fly') { tx = o.hx + 7; ty = o.hy + 16; this.rivalMode = 'clear'; }
      else {
        // now and then it changes its mind: hunt your streamer, slip away from your kite, or swoop about
        if (this.steps % 45 === 0) this.rivalMode = threat && r() < R.skill ? 'evade' : reach && r() < 0.35 + R.skill * 0.5 ? 'hunt' : 'swoop';
        if (this.rivalMode === 'hunt') { tx = ex; ty = ey + (1 - R.skill) * 2.5; }
        else if (this.rivalMode === 'evade') { tx = o.x + (o.x - me.x) * 1.5; ty = o.y + 4; }
        else { const a = 0.75 + 0.42 * Math.sin(this.t * (0.45 + R.skill * 0.35) + this.seed); tx = o.hx + Math.cos(a) * 14; ty = o.hy + Math.sin(a) * 14; }
      }
      const [ax, ay] = this.pilot!.aim(tx, ty);
      return { ...keeper(o, this.P, ax, ay), steer: 0, aim: [ax, ay], walk: 0 };
    }
    // the partner flies in formation: where you were a moment ago, a little behind and below
    const [px, py] = this.partnerPath.length ? this.partnerPath[0] : [me.x, me.y];
    const [ax, ay] = this.pilot!.aim(px - 2.2, py - 2.4);
    return { ...keeper(o, this.P, ax, ay), steer: 0, aim: [ax, ay], walk: 0 };
  }

  /** One fixed step. */
  step(inp: Input) {
    if (this.done) return;
    const goal = this.ch?.goal;
    const out = this.events;
    const me = this.me;
    this.evFrom = out.length;
    this.prevPsi = this.kites.map((k) => k.psi);
    stepKite(me, this.P, this.seed, this.t, inp, 0, out);
    if (this.other) { stepKite(this.other, this.P, this.seed, this.t, this.otherInput(), 1, out); }
    if (goal?.kind === 'routine') { this.partnerPath.push([me.x, me.y]); while (this.partnerPath.length > 36) this.partnerPath.shift(); }
    for (let i = 0; i < this.kites.length; i++) readTricks(this.kites[i], this.P, this.tricks[i], this.t, this.prevPsi[i], i, out);
    // the wind's moods, for the scene and the sound
    const gl = gustAt(this.P, this.seed, me.hx - 6, this.t);
    const mood = gl.lull > 0.25 ? -1 : gl.gust > this.P.wind.gust * 0.55 ? 1 : 0;
    if (mood !== this.lastGust) { if (mood === 1) out.push({ k: 'gust' }); if (mood === -1) out.push({ k: 'lull' }); this.lastGust = mood; }
    this.t += DT; this.steps++;
    if (goal) this.goalStep(goal, out);
  }

  private finish(won: boolean, value: number) {
    const ch = this.ch!;
    this.done = true; this.won = won; this.value = value;
    this.medal = won ? medalFor(ch, value, this) : 0;
    this.events.push({ k: 'done', won, value, medal: this.medal });
  }

  private goalStep(goal: Challenge['goal'], out: Ev[]) {
    const me = this.me, flying = me.state === 'fly';
    const near = (x: number, y: number, r: number) => flying && Math.hypot(me.x - x, me.y - y) <= r + KITE_R;
    switch (goal.kind) {
      case 'rings': {
        const g = goal.rings[this.next];
        if (g && near(g.x, g.y, g.r)) { this.next++; out.push({ k: 'ring', i: this.next - 1, x: g.x, y: g.y, last: this.next === goal.rings.length }); }
        if (this.next >= goal.rings.length) this.finish(true, this.t);
        else if (this.t >= goal.limit) this.finish(false, this.t);
        break;
      }
      case 'race': {
        const g = goal.gates[this.next];
        if (g && near(g.x, g.y, g.r)) { this.next++; out.push({ k: 'ring', i: this.next - 1, x: g.x, y: g.y, last: this.next === goal.gates.length }); }
        const df = dragonflyAt(goal.gates, this.dfStart, goal.dragonfly, this.t), was = dragonflyAt(goal.gates, this.dfStart, goal.dragonfly, this.t - DT);
        if (df.gate > was.gate) out.push({ k: 'dragonfly', i: was.gate });
        if (this.next >= goal.gates.length) this.finish(this.t <= this.dfTime, this.t);
        else if (this.t >= goal.limit) this.finish(false, this.t);
        break;
      }
      case 'pop': {
        goal.targets.forEach((g, i) => {
          if (this.popped[i]) return;
          const [x, y] = targetAt(g, this.t);
          if (near(x, y, g.r)) { this.popped[i] = true; out.push({ k: 'pop', i, x, y, kind: g.kind }); }
        });
        const n = this.popped.filter(Boolean).length;
        if (n >= goal.need) this.finish(true, this.t);
        else if (this.t >= goal.limit) this.finish(false, this.t);
        break;
      }
      case 'deliver': {
        goal.baskets.forEach(([x, y], i) => {
          if (this.delivered[i]) return;
          if (near(x, y, 1.0)) { this.delivered[i] = true; me.parcels = Math.max(0, me.parcels - 1); out.push({ k: 'deliver', i, x, y, left: me.parcels }); }
        });
        if (this.delivered.every(Boolean)) this.finish(true, this.t);
        else if (this.t >= goal.limit) this.finish(false, this.t);
        break;
      }
      case 'tricks': {
        if (this.t >= goal.limit) this.finish(this.tricks[0].score >= this.ch!.marks[0], this.tricks[0].score);
        break;
      }
      case 'hold': {
        if (flying && Math.hypot(me.x - goal.zone.x, me.y - goal.zone.y) <= goal.zone.r) this.inZone += DT;
        if (this.t >= goal.limit) this.finish(this.inZone >= this.ch!.marks[0], Math.round(this.inZone * 10) / 10);
        break;
      }
      case 'duel': {
        const o = this.other!;
        this.touchCool = Math.max(0, this.touchCool - DT);
        // the lines: crossing for long tangles them, and a tangle brings both kites down and costs you a point
        const crossing = me.state === 'fly' && o.state === 'fly' && segCross(me.hx, me.hy, me.x, me.y, o.hx, o.hy, o.x, o.y);
        this.tangle = clamp(this.tangle + (crossing ? DT / 1.6 : -DT / 1.2), 0, 1);
        if (this.tangle >= 1) {
          this.tangle = 0; out.push({ k: 'tangle' });
          for (const k of [me, o]) { k.state = 'down'; k.down = 'grass'; k.downT = -0.6; k.tumbling = false; k.vx = k.vy = 0; k.y = Math.max(k.y - 0.5, surfaceAt(this.P, k.x) + 0.3); }
          this.touches[1]++; this.touchCool = 2;
          out.push({ k: 'touch', by: 1, x: me.x, y: me.y, score: [...this.touches] as [number, number] });
        }
        if (this.touchCool <= 0 && me.state === 'fly' && o.state === 'fly') {
          const hits = (a: Kite, b: Kite) => { for (let i = 2; i < b.tail.length / 2; i++) if (Math.hypot(a.x - b.tail[i * 2], a.y - b.tail[i * 2 + 1]) < 0.85) return true; return false; };
          if (hits(me, o)) { this.touches[0]++; this.touchCool = 1.6; out.push({ k: 'touch', by: 0, x: me.x, y: me.y, score: [...this.touches] as [number, number] }); }
          else if (hits(o, me)) { this.touches[1]++; this.touchCool = 1.6; out.push({ k: 'touch', by: 1, x: o.x, y: o.y, score: [...this.touches] as [number, number] }); }
        }
        if (this.touches[0] >= goal.to) this.finish(true, this.touches[1]);
        else if (this.touches[1] >= goal.to || this.t >= goal.limit) this.finish(false, this.touches[1]);
        break;
      }
      case 'routine': {
        // a cue is open 1.2 s either side of its beat; a loop cue wants a loop finished inside its window
        for (let i = this.cueNext; i < goal.cues.length; i++) {
          const c = goal.cues[i];
          if (this.t < c.t - 1.4) break;
          if (this.cueHit[i]) continue;
          const open = this.t >= c.t - 1.4 && this.t <= c.t + 1.4;
          if (open && near(c.x, c.y, c.r)) {
            const perfect = Math.abs(this.t - c.t) <= 0.45, partner = this.other && Math.hypot(this.other.x - c.x + 2.2, this.other.y - c.y + 2.4) < 4.5;
            let pts = perfect ? 150 : 100; if (partner) pts += 30;
            if (c.loop) pts += 0; // the loop is scored when it comes
            this.cueHit[i] = 1; this.cueScore += pts;
            out.push({ k: 'cue', i, good: true, perfect, points: pts, x: c.x, y: c.y });
          } else if (this.t > c.t + 1.4) { this.cueHit[i] = -1; out.push({ k: 'cue', i, good: false, perfect: false, points: 0, x: c.x, y: c.y }); }
        }
        while (this.cueNext < goal.cues.length && this.cueHit[this.cueNext] !== 0) this.cueNext++;
        // loops near a loop cue's beat earn a bonus
        for (let j = this.evFrom; j < out.length; j++) { const e = out[j]; if (e.k !== 'trick' || e.who !== 0) continue;
          const c = goal.cues.find((c) => c.loop && Math.abs(this.t - c.t) < 2.4);
          this.cueScore += c && e.name === 'loop' ? 200 : Math.round(e.points * 0.5);
        }
        if (this.t >= goal.limit) this.finish(this.cueScore >= this.ch!.marks[0], this.cueScore);
        break;
      }
    }
  }
  /** Time-scored challenges: the ring or gate to aim at next, for arrows and bots. */
  objective(): [number, number] | null {
    const goal = this.ch?.goal; if (!goal) return null;
    const me = this.me;
    switch (goal.kind) {
      case 'rings': { const g = goal.rings[this.next]; return g ? [g.x, g.y] : null; }
      case 'race': { const g = goal.gates[this.next]; return g ? [g.x, g.y] : null; }
      case 'hold': return [goal.zone.x, goal.zone.y];
      case 'pop': {
        let best: [number, number] | null = null, bd = Infinity;
        goal.targets.forEach((g, i) => { if (this.popped[i]) return; const [x, y] = targetAt(g, this.t), d = Math.hypot(x - me.x, y - me.y); if (d < bd) { bd = d; best = [x, y]; } });
        return best;
      }
      case 'deliver': {
        let best: [number, number] | null = null, bd = Infinity;
        goal.baskets.forEach(([x, y], i) => { if (this.delivered[i]) return; const d = Math.hypot(x - me.x, y - me.y); if (d < bd) { bd = d; best = [x, y]; } });
        return best;
      }
      case 'duel': { const o = this.other!, n = o.tail.length / 2 - 1; return [o.tail[n * 2 - 2], o.tail[n * 2 - 1]]; }
      case 'routine': { const c = goal.cues[this.cueNext]; return c ? [c.x, c.y] : null; }
      default: return null;
    }
  }
}

// ---------------------------------------------------------------- medals
export const MEDAL_NAMES = ['', 'bronze', 'silver', 'gold'] as const;
/** The medal for a result: 0 none, 1 bronze, 2 silver, 3 gold. A race's bronze is beating the dragonfly. */
export function medalFor(ch: Challenge, value: number, f?: Flight): number {
  const [b, s, g] = ch.marks;
  if (ch.goal.kind === 'race') {
    const df = f ? f.dfTime : 0;
    if (f && value > df) return 0;
    return value <= g ? 3 : value <= s ? 2 : 1;
  }
  if (ch.better === 'low') return value <= g ? 3 : value <= s ? 2 : value <= b ? 1 : 0;
  return value >= g ? 3 : value >= s ? 2 : value >= b ? 1 : 0;
}

// ---------------------------------------------------------------- the summer: unlocking places and challenges
export type Progress = Record<string, { best: number; medal: number }>;
export const placeDone = (pr: Progress, p: PlaceId) => challengesIn(p).filter((c) => (pr[c.id]?.medal ?? 0) > 0).length;
/** A place opens when the one before it has all but one of its challenges done (the cliffs need every place). */
export function placeOpen(pr: Progress, p: PlaceId): boolean {
  const i = PLACE_IDS.indexOf(p);
  if (i <= 0) return true;
  if (p === 'cliffs') return PLACE_IDS.slice(0, 5).every((q) => placeDone(pr, q) >= challengesIn(q).length - 1);
  const prev = PLACE_IDS[i - 1];
  return placeDone(pr, prev) >= challengesIn(prev).length - 1;
}
/** A challenge opens when its place is open and the challenge before it in the place is done (the finale needs all three duels and rings). */
export function challengeOpen(pr: Progress, id: string): boolean {
  const ch = CHALLENGE[id]; if (!ch || !placeOpen(pr, ch.place)) return false;
  const list = challengesIn(ch.place), i = list.indexOf(ch);
  if (i === 0) return true;
  if (ch.id === 'c4') return list.slice(0, 3).every((c) => (pr[c.id]?.medal ?? 0) > 0);
  return (pr[list[i - 1].id]?.medal ?? 0) > 0;
}
export const medalCount = (pr: Progress) => CHALLENGES.reduce((n, c) => n + (pr[c.id]?.medal ?? 0), 0);
export const shapesOwned = (pr: Progress): Shape[] => ['diamond', ...CHALLENGES.filter((c) => c.award && (pr[c.id]?.medal ?? 0) > 0).map((c) => c.award!)] as Shape[];
export const stencilsOwned = (pr: Progress): Stencil[] => STENCILS.filter((s) => { const p = STENCIL_FROM[s]; return !p || placeDone(pr, p) > 0; });

// ---------------------------------------------------------------- saves
export const SAVE_KEY = 'kite-day-v1';
export type Save = {
  v: 1; progress: Progress; designs: Record<Shape, Paint>; shape: Shape; flyer: Who; ended: boolean; tutorial: boolean;
  settings: { sound: boolean; music: boolean; steer: 'aim' | 'keys' };
};
export const freshSave = (): Save => ({
  v: 1, progress: {}, designs: JSON.parse(JSON.stringify(DEFAULT_PAINT)), shape: 'diamond', flyer: 'dora', ended: false, tutorial: false,
  settings: { sound: true, music: true, steer: 'aim' },
});
const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o);
const intIn = (v: unknown, a: number, b: number, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b ? v : d);
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.progress)) for (const c of CHALLENGES) {
      const d = o.progress[c.id]; if (!isObj(d)) continue;
      const best = typeof d.best === 'number' && Number.isFinite(d.best) && d.best >= 0 && d.best < 1e6 ? d.best : null;
      if (best === null) continue;
      const medal = intIn(d.medal, 0, 3, 0);
      if (medal === 0) continue;
      s.progress[c.id] = { best, medal };
    }
    if (isObj(o.designs)) for (const sh of SHAPE_IDS) {
      const d = o.designs[sh]; if (!isObj(d)) continue;
      const def = DEFAULT_PAINT[sh];
      s.designs[sh] = {
        sail: intIn(d.sail, 0, COLOURS.length - 1, def.sail), ink: intIn(d.ink, 0, COLOURS.length - 1, def.ink), tail: intIn(d.tail, 0, COLOURS.length - 1, def.tail),
        stencil: STENCILS.includes(d.stencil as Stencil) ? (d.stencil as Stencil) : def.stencil,
      };
    }
    if (SHAPE_IDS.includes(o.shape as Shape) && shapesOwned(s.progress).includes(o.shape as Shape)) s.shape = o.shape as Shape;
    if (o.flyer === 'enzo') s.flyer = 'enzo';
    s.ended = o.ended === true && (s.progress.c4?.medal ?? 0) > 0;
    s.tutorial = o.tutorial === true;
    if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; s.settings.steer = o.settings.steer === 'keys' ? 'keys' : 'aim'; }
  } catch { return freshSave(); }
  return s;
}
/** Records a finished challenge: the best value and medal only ever get better. Says what was newly earned. */
export function recordResult(s: Save, f: Flight): { best: boolean; medal: number; newShape: Shape | null; newStencils: Stencil[]; firstEnding: boolean; opened: PlaceId[] } {
  const ch = f.ch!; const before = s.progress[ch.id];
  const shapesBefore = shapesOwned(s.progress), stencilsBefore = stencilsOwned(s.progress), openBefore = PLACE_IDS.filter((p) => placeOpen(s.progress, p));
  let best = false;
  if (f.won && f.medal > 0) {
    const better = !before || (ch.better === 'low' ? f.value < before.best : f.value > before.best);
    if (better) best = true;
    s.progress[ch.id] = { best: !before ? f.value : ch.better === 'low' ? Math.min(before.best, f.value) : Math.max(before.best, f.value), medal: Math.max(before?.medal ?? 0, f.medal) };
  }
  const newShape = shapesOwned(s.progress).find((x) => !shapesBefore.includes(x)) ?? null;
  const newStencils = stencilsOwned(s.progress).filter((x) => !stencilsBefore.includes(x));
  const opened = PLACE_IDS.filter((p) => placeOpen(s.progress, p) && !openBefore.includes(p));
  const firstEnding = ch.id === 'c4' && f.won && !s.ended;
  if (firstEnding) s.ended = true;
  return { best, medal: s.progress[ch.id]?.medal ?? 0, newShape, newStencils, firstEnding, opened };
}

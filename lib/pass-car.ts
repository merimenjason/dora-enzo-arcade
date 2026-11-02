// Kumori Pass: the car. A deterministic single-track ("bicycle") model stepped at a fixed 120 Hz: two axles with
// tyre slip-angle grip curves (they peak and then fall away, so a slide stays a slide until you catch it), a friction
// circle at the driven rear axle (throttle eats sideways grip: power oversteer), weight transfer front to rear under
// braking and throttle, a handbrake that locks the rear, steering that softens with speed, counter-steer assist that
// turns the front wheels toward where the car is actually going, and an engine with a torque curve and five gears.
// Below walking pace it blends to a kinematic model so parking-speed manoeuvres don't jitter. No DOM, no randomness.

export const DT = 1 / 120;
export const G = 9.81;
/** How much of the speed a held, throttle-on slide keeps that plain tyre physics would scrub away (0..1). */
export const SUSTAIN = 0.5;
/** How much sideways grip full throttle takes from an already-sliding rear axle. */
export const POWER_SLIDE = 0.32;
/** Strength of the assist's slide damper. */
export const DAMP = 5;

export type CarSpec = {
  mass: number; inertia: number; a: number; b: number; cgh: number; // a/b: CG to front/rear axle (m), cgh: CG height
  mu: number; // peak tyre friction
  bf: number; br: number; cf: number; cr: number; // Pacejka-lite B (stiffness) and C (shape) front/rear
  slideF: number; slideR: number; // how much grip is left far past the peak (0..1)
  torque: number; // peak engine torque (N·m)
  redline: number; idle: number;
  ratios: number[]; final: number; wheelR: number;
  drag: number; roll: number;
  lock: number; // max road-wheel steering angle (rad)
  steerRate: number; // rad/s
  brake: number; // max braking decel as a fraction of g
  flywheel: number; // rpm response, 1 = stock; higher revs up faster
  lsd: number; // 0 open diff .. 1 locked: how much drive the rear keeps while the inside wheel unloads in a slide
  bunDamp: number; // 1 stock tray; lower = less bun wobble
};

export const BASE: CarSpec = {
  mass: 1050, inertia: 1550, a: 1.12, b: 1.28, cgh: 0.5,
  mu: 1.12, bf: 8, br: 12, cf: 1.6, cr: 1.3, slideF: 0.85, slideR: 0.78,
  torque: 235, redline: 7600, idle: 950,
  ratios: [3.3, 2.05, 1.45, 1.1, 0.88], final: 4.1, wheelR: 0.3,
  drag: 0.42, roll: 0.012,
  lock: 0.6, steerRate: 2.6, brake: 1.0, flywheel: 1, lsd: 0.35, bunDamp: 1,
};

export type Input = { steer: number; throttle: number; brake: number; hand: boolean; up: boolean; down: boolean };
export const idleInput = (): Input => ({ steer: 0, throttle: 0, brake: 0, hand: false, up: false, down: false });

/** Inputs are quantised before the car sees them, so a replay recorded as small integers drives exactly the same. */
export function quantise(i: Input, out: Input = i): Input {
  out.steer = Math.round(Math.max(-1, Math.min(1, i.steer)) * 16) / 16 || 0;
  out.throttle = Math.round(Math.max(0, Math.min(1, i.throttle)) * 4) / 4;
  out.brake = Math.round(Math.max(0, Math.min(1, i.brake)) * 4) / 4;
  out.hand = !!i.hand; out.up = !!i.up; out.down = !!i.down;
  return out;
}

export type Car = {
  spec: CarSpec;
  x: number; y: number; h: number; // world position and heading (rad, CCW, forward = (cos h, sin h))
  u: number; v: number; r: number; // forward speed, leftward speed (m/s), yaw rate (rad/s)
  delta: number; // road-wheel steering angle
  gear: number; rpm: number; auto: boolean; shiftCool: number;
  ax: number; ay: number; // smoothed body accelerations (for weight transfer, roll and buns)
  slipF: number; slipR: number; // current slip angles
  wheelSpin: number; // 0..1 how hard the rear is spinning or sliding (smoke)
  assist: number; // counter-steer assist 0..1
  boost: number; // seconds of drift boost left
  hooked: number; // >0 while the inside wheels run in a gutter
  grip: number; // grip multiplier from the road (gutter, crest)
  lastIn: Input;
  betaPrev: number;
  wheelRot: number;
};

export function makeCar(spec: CarSpec, x: number, y: number, h: number, auto = true, assist = 0.6): Car {
  return { spec, x, y, h, u: 0, v: 0, r: 0, delta: 0, gear: 1, rpm: spec.idle, auto, shiftCool: 0, ax: 0, ay: 0, slipF: 0, slipR: 0,
    wheelSpin: 0, assist, boost: 0, hooked: 0, grip: 1, lastIn: idleInput(), wheelRot: 0, betaPrev: 0 };
}

/** Normalised tyre force for a slip angle: rises, peaks near ~0.12 rad, then falls away to `slide` of the peak. */
export function tyre(alpha: number, B: number, C: number, slide: number) {
  const a = Math.abs(alpha), peakA = Math.tan(Math.PI / (2 * C)) / B;
  const f = a <= peakA ? Math.sin(C * Math.atan(B * a)) : 1 - (1 - slide) * Math.min(1, (a - peakA) / 0.6);
  return Math.sign(alpha) * f;
}

/** Engine torque at an rpm: a broad hump that peaks around 5,200 and falls off toward the redline. */
export function torqueAt(spec: CarSpec, rpm: number) {
  const x = rpm / spec.redline;
  return spec.torque * Math.max(0.25, Math.min(1, 0.55 + 1.5 * x - 1.45 * x * x));
}

export const gearSpeed = (spec: CarSpec, gear: number, rpm = spec.redline) => (rpm / 60) * 2 * Math.PI * spec.wheelR / (spec.ratios[gear - 1] * spec.final);

export type StepEnv = { grade: number; gripMul: number; boostMul: number };

/**
 * One fixed step. `grade` is the road's slope along the car's heading (positive uphill), gripMul scales the tyres
 * (gutter hook, a light crest). Returns the shift that happened (+1/−1/0).
 */
export function stepCar(c: Car, inp: Input, env: StepEnv): number {
  const s = c.spec, L = s.a + s.b, dt = DT;
  let shifted = 0;
  // ---- gears
  c.shiftCool = Math.max(0, c.shiftCool - dt);
  if (c.shiftCool === 0) {
    if (c.auto) {
      if (c.rpm > s.redline * 0.94 && c.gear < s.ratios.length && inp.throttle > 0) { c.gear++; shifted = 1; }
      else if (c.gear > 1 && c.rpm < s.redline * 0.5) { c.gear--; shifted = -1; }
    } else {
      if (inp.up && !c.lastIn.up && c.gear < s.ratios.length) { c.gear++; shifted = 1; }
      if (inp.down && !c.lastIn.down && c.gear > 1) { c.gear--; shifted = -1; }
    }
    if (shifted) c.shiftCool = c.auto ? 0.22 : 0.12;
  }
  // ---- steering: the lock softens with speed; assist turns the wheels toward the direction of travel
  const speed = Math.hypot(c.u, c.v);
  const beta = speed > 2 ? Math.atan2(c.v, Math.abs(c.u)) : 0; // body slip: + = sliding to the left
  const lock = s.lock / (1 + Math.max(0, c.u) / 14);
  let target = inp.steer * lock;
  if (c.assist > 0 && speed > 6) {
    // counter-steer: aim the front wheels along the velocity, more as the slide grows
    const cs = Math.max(-0.7, Math.min(0.7, beta)) * c.assist;
    target = Math.max(-s.lock - 0.25, Math.min(s.lock + 0.25, target + cs));
  }
  const maxD = s.steerRate * dt * (inp.steer === 0 && c.assist === 0 ? 1.4 : 1);
  c.delta += Math.max(-maxD, Math.min(maxD, target - c.delta));

  // ---- loads (weight transfer from last step's longitudinal acceleration)
  const W = s.mass * G;
  const fzF = Math.max(0.15 * W, (W * s.b) / L - (s.mass * c.ax * s.cgh) / L);
  const fzR = Math.max(0.15 * W, (W * s.a) / L + (s.mass * c.ax * s.cgh) / L);
  const mu = s.mu * env.gripMul;

  // ---- engine and drive
  const ratio = s.ratios[c.gear - 1] * s.final;
  const wheelRpm = (Math.abs(c.u) / s.wheelR) * 60 / (2 * Math.PI);
  const targetRpm = Math.max(s.idle, wheelRpm * ratio + (inp.throttle > 0 && c.u < 3 ? 2800 * inp.throttle : 0));
  // the engine follows the wheels; a lighter flywheel follows faster
  c.rpm += (targetRpm - c.rpm) * Math.min(1, dt * 14 * s.flywheel);
  if (c.rpm > s.redline) c.rpm = s.redline;
  // the rev limiter cuts the drive at the redline, so each gear has a real top speed
  const limiter = wheelRpm * ratio >= s.redline ? 0 : c.rpm >= s.redline * 0.995 ? 0.3 : 1;
  let drive = c.shiftCool > 0.05 ? 0 : (torqueAt(s, c.rpm) * ratio * 0.88 / s.wheelR) * inp.throttle * limiter * (s.flywheel > 1 ? 1.03 : 1);
  if (c.boost > 0) { drive *= env.boostMul; c.boost = Math.max(0, c.boost - dt); }
  if (c.u < -0.5) drive = Math.min(drive, 0) + inp.throttle * 2500; // pushing out of a spin backwards
  // ---- brakes and handbrake (forces along the car, opposing the motion)
  const dir = c.u >= 0 ? 1 : -1;
  let fxF = 0, fxR = drive;
  if (inp.brake > 0) {
    if (c.u > 0.3 || c.u < -0.3) {
      const bf = inp.brake * s.brake * W;
      fxF -= dir * Math.min(bf * 0.66, mu * fzF);
      fxR -= dir * bf * 0.34;
    } else if (inp.throttle === 0) {
      fxR -= inp.brake * 3200; // gentle reverse
    }
  }
  if (inp.hand) fxR = fxR * 0.3 - dir * Math.min(Math.abs(c.u) * 3000, mu * fzR * 0.6);

  // ---- slip angles and lateral forces
  const uu = Math.max(Math.abs(c.u), 0.5);
  c.slipF = Math.atan2(c.v + s.a * c.r, uu) - c.delta * dir;
  c.slipR = Math.atan2(c.v - s.b * c.r, uu);
  let fyF = -mu * fzF * tyre(c.slipF, s.bf, s.cf, s.slideF);
  // rear friction circle: what the drive or brake uses is not there for cornering
  const capR = mu * fzR * 1.12; // the rear has a little more grip than the front, so the car is stable until you ask it not to be
  fxR = Math.max(-capR, Math.min(capR, fxR));
  const sideR = Math.sqrt(Math.max(0, capR * capR - fxR * fxR * (1 - s.lsd * 0.45)));
  // once the tail is out, throttle spins the rear wheels and holds it out (power oversteer); a locked diff does it harder
  const sliding = Math.min(1, Math.max(0, (Math.abs(c.slipR) - 0.1) / 0.15));
  const spinLoss = sliding * inp.throttle * POWER_SLIDE * (0.75 + s.lsd * 0.4);
  let fyR = -sideR * tyre(c.slipR, s.br, s.cr, s.slideR) * (inp.hand ? 0.42 : 1) * (1 - spinLoss);
  // a spinning rear (lots of throttle at low speed or in a slide) shows as smoke
  const spinAmt = Math.min(1, Math.abs(fxR) / capR) * (Math.abs(c.slipR) > 0.12 || (c.u < 12 && inp.throttle > 0.7) ? 1 : 0.2);
  c.wheelSpin += (Math.max(spinAmt, Math.min(1, Math.abs(c.slipR) * 3 - 0.3), inp.hand && speed > 4 ? 0.9 : 0) - c.wheelSpin) * Math.min(1, dt * 10);
  if (Math.abs(c.u) < 1.5) { fyF *= Math.abs(c.u) / 1.5; fyR *= Math.abs(c.u) / 1.5; }

  // ---- body forces
  const cd = Math.cos(c.delta), sd = Math.sin(c.delta);
  const dragF = s.drag * c.u * Math.abs(c.u) + s.roll * W * Math.sign(c.u) * Math.min(1, Math.abs(c.u));
  const gradeF = -W * env.grade;
  const Fx = fxR + fxF * cd - fyF * sd - dragF + gradeF;
  const Fy = fyR + fyF * cd + fxF * sd;
  let Mz = s.a * (fyF * cd + fxF * sd) - s.b * fyR;
  // slide damper (part of the assist): resists the slip angle changing quickly, so a slide holds at the angle you set
  // instead of snapping back or spinning on, the way a calm driver would feather the wheel
  const bRate = (beta - c.betaPrev) / dt; c.betaPrev = beta;
  if (c.assist > 0 && speed > 6 && Math.abs(beta) > 0.06) Mz += c.assist * DAMP * s.inertia * Math.max(-3, Math.min(3, bRate));
  const du = Fx / s.mass + c.v * c.r;
  const dv = Fy / s.mass - c.u * c.r;
  const sp0 = speed;
  c.u += du * dt; c.v += dv * dt; c.r += (Mz / s.inertia) * dt;
  // drift momentum: a held slide on the throttle scrubs less speed than physics alone would (this is what makes a
  // drift feel like flowing rather than skidding); the more throttle, the more it carries
  const absB = Math.abs(beta);
  if (absB > 0.1 && absB < 1.1 && inp.throttle > 0.2 && inp.brake === 0 && sp0 > 6) {
    const sp1 = Math.hypot(c.u, c.v);
    if (sp1 < sp0 && sp1 > 0.1) { const keep = SUSTAIN * inp.throttle * (1 + s.lsd * 0.3); const k = (sp0 - (sp0 - sp1) * (1 - keep)) / sp1; c.u *= k; c.v *= k; }
  }
  // low speed: blend toward rolling without sliding, so the car can creep and turn from a standstill
  const slow = Math.max(0, 1 - Math.abs(c.u) / 4);
  if (slow > 0) {
    const rk = (c.u * Math.tan(c.delta)) / L;
    c.r += (rk - c.r) * slow * Math.min(1, dt * 20);
    c.v *= 1 - slow * Math.min(1, dt * 12);
  }
  if (Math.abs(c.u) < 0.05 && inp.throttle === 0 && Math.abs(c.v) < 0.05) { c.u = 0; c.v = 0; c.r *= 0.5; }
  // smoothed accelerations for weight transfer and the bun tray
  c.ax += (Fx / s.mass - c.ax) * Math.min(1, dt * 8);
  c.ay += (Fy / s.mass - c.ay) * Math.min(1, dt * 8);
  // ---- move
  const ch = Math.cos(c.h), sh = Math.sin(c.h);
  c.x += (c.u * ch - c.v * sh) * dt; c.y += (c.u * sh + c.v * ch) * dt; c.h += c.r * dt;
  c.wheelRot += (c.u / s.wheelR) * dt;
  c.lastIn.steer = inp.steer; c.lastIn.throttle = inp.throttle; c.lastIn.brake = inp.brake; c.lastIn.hand = inp.hand; c.lastIn.up = inp.up; c.lastIn.down = inp.down;
  return shifted;
}

/** World-space velocity of the car's centre. */
export const worldVel = (c: Car) => {
  const ch = Math.cos(c.h), sh = Math.sin(c.h);
  return { vx: c.u * ch - c.v * sh, vy: c.u * sh + c.v * ch };
};
/** Set the body velocities from a world-space velocity. */
export function setWorldVel(c: Car, vx: number, vy: number) {
  const ch = Math.cos(c.h), sh = Math.sin(c.h);
  c.u = vx * ch + vy * sh; c.v = -vx * sh + vy * ch;
}
/** Body slip angle: how sideways the car is travelling (rad, + = sliding left). */
export const slipAngle = (c: Car) => (Math.hypot(c.u, c.v) > 2 ? Math.atan2(c.v, Math.abs(c.u)) : 0);

export type UpgradeId = 'flywheel' | 'rear' | 'tyres' | 'lsd' | 'intake' | 'rack' | 'tray';
export type Upgrade = { id: UpgradeId; name: string; cost: number; effect: string; stats: Partial<Record<Stat, number>> };
export type Stat = 'power' | 'grip' | 'rotation' | 'stability' | 'buns';
export const UPGRADES: Upgrade[] = [
  { id: 'tyres', name: 'Sticky Tyres', cost: 60, effect: 'More grip everywhere: later braking, faster corners.', stats: { grip: 2, stability: 1 } },
  { id: 'flywheel', name: 'Lighter Flywheel', cost: 70, effect: 'The engine revs up quicker: snappier out of every hairpin.', stats: { power: 1, rotation: 1 } },
  { id: 'rear', name: 'Stiffer Rear', cost: 80, effect: 'The tail steps out sooner: easier to start a drift, keener to spin.', stats: { rotation: 2, stability: -1 } },
  { id: 'lsd', name: 'Limited-Slip Diff', cost: 110, effect: 'Both rear wheels keep pushing in a slide: longer, steadier drifts.', stats: { rotation: 1, stability: 1, power: 1 } },
  { id: 'rack', name: 'Quick Steering Rack', cost: 90, effect: 'More lock and faster hands: catches slides earlier.', stats: { rotation: 1, stability: 1 } },
  { id: 'tray', name: 'Sprung Bun Tray', cost: 50, effect: 'Enzo\'s padded tray: the buns barely wobble.', stats: { buns: 3 } },
  { id: 'intake', name: 'Big Intake & Turbo', cost: 150, effect: 'More power up top, a turbo whistle and backfire pops.', stats: { power: 3, stability: -1 } },
];

/** The car with upgrades fitted. */
export function withUpgrades(base: CarSpec, owned: readonly string[]): CarSpec {
  const s: CarSpec = { ...base, ratios: base.ratios.slice() };
  const has = (id: UpgradeId) => owned.includes(id);
  if (has('tyres')) { s.mu *= 1.08; s.slideR = Math.min(0.85, s.slideR + 0.03); }
  if (has('flywheel')) { s.flywheel = 1.45; }
  if (has('rear')) { s.br *= 0.86; s.slideR -= 0.06; s.inertia *= 0.94; }
  if (has('lsd')) { s.lsd = 0.95; }
  if (has('rack')) { s.lock *= 1.14; s.steerRate *= 1.3; }
  if (has('tray')) { s.bunDamp = 0.6; }
  if (has('intake')) { s.torque *= 1.16; }
  return s;
}

/** Bars for the garage stat card (0..10). */
export function statCard(owned: readonly string[]): Record<Stat, number> {
  const out: Record<Stat, number> = { power: 4, grip: 4, rotation: 4, stability: 5, buns: 4 };
  for (const u of UPGRADES) if (owned.includes(u.id)) for (const [k, v] of Object.entries(u.stats)) out[k as Stat] += v as number;
  for (const k of Object.keys(out) as Stat[]) out[k] = Math.max(0, Math.min(10, out[k]));
  return out;
}

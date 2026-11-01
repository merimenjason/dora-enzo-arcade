// Clatterbox's rules: the parts, how a puzzle's world is built from its fixed parts and the player's placements, what
// each part does while the contraption runs (springs bounce, fans blow, bellows puff, wind-up cars drive, balloons
// rise and pop, candles and scissors cut strings, bells ring), the goals and the bonus button, a run from Go to its
// payoff, where parts may go, stars, unlocking and the save. Deterministic: no DOM, no Math.random, no clock, so a
// placement always replays the same way, step for step.
import { World, Body, Joint, box, circle, poly, overlap, near, DT, type Shape } from './clatter-physics.js';
import { PUZZLES, PUZZLE_IDS, ROOMS, FREE, type Puzzle, type Item, type Place, type PartId } from './clatter-levels.js';

export { PUZZLES, PUZZLE_IDS, ROOMS, FREE };
export type { Puzzle, Item, Place, PartId };
export { DT };

export const SAVE_KEY = 'clatterbox-v1';
/** Rotation steps: 15° each, 24 to a turn. */
export const ROT = 24;
export const STEP_A = Math.PI / 12;
/** Placement snaps to quarter units. */
export const SNAP = 0.25;
export const SPRING_V = 13;
export const FAN_REACH = 6;
export const FAN_FORCE = 5.2;
export const PUFF_REACH = 4.4;
export const CUT_R = 0.28;
export const BURN_R = 0.42;
export const BURN_TIME = 0.45;
export const CAR_SPEED = 3.4;
export const CAR_TIME = 7;
export const PAYOFF = 2.6;
export const SANDBOX_MAX = 18;
/** A balloon's lift: enough to carry an acorn (but not a marble) up on its string. */
export const LIFT = 7.6;

type Info = { name: string; blurb: string; rot: boolean; flip: boolean; tray: boolean };
/** Every part: its name, a line for the tray, and whether it turns or flips when placed. */
export const PARTS: Record<PartId, Info> = {
  marble: { name: 'Marble', blurb: 'A heavy glass marble. Rolls fast and hits hard.', rot: false, flip: false, tray: true },
  acorn: { name: 'Acorn', blurb: 'Light and round. Rolls, and a fan or bellows can push it.', rot: false, flip: false, tray: true },
  domino: { name: 'Domino', blurb: 'Stands on its end and topples into the next one: clack!', rot: false, flip: false, tray: true },
  ramp: { name: 'Ramp', blurb: 'A short cardboard ramp. Turn it in 15° steps.', rot: true, flip: false, tray: true },
  plank: { name: 'Plank', blurb: 'A long ruler plank. Turn it in 15° steps.', rot: true, flip: false, tray: true },
  block: { name: 'Matchbox', blurb: 'A little box that slides and tumbles.', rot: false, flip: false, tray: true },
  seesaw: { name: 'Seesaw', blurb: 'A plank on a split pin: drop something on the high end and the low end flings up. Flip it to swap ends.', rot: false, flip: true, tray: true },
  spring: { name: 'Spring', blurb: 'Anything landing on the pad bounces off it hard. Turn it to aim.', rot: true, flip: false, tray: true },
  fan: { name: 'Fan', blurb: 'A battery fan. It blows light things along: acorns, balloons, matchboxes.', rot: true, flip: true, tray: true },
  bellows: { name: 'Bellows', blurb: 'Drop something on top and it puffs: a gust that shoves light things.', rot: false, flip: true, tray: true },
  car: { name: 'Wind-up car', blurb: 'Bump it and it drives off the way it faces.', rot: false, flip: true, tray: true },
  balloon: { name: 'Balloon', blurb: 'It rises. Pins and flames pop it.', rot: false, flip: false, tray: true },
  pin: { name: 'Pin', blurb: 'A thumbtack. Balloons pop on it.', rot: true, flip: false, tray: true },
  candle: { name: 'Candle', blurb: 'Its flame burns through string and pops balloons.', rot: false, flip: false, tray: true },
  scissors: { name: 'Scissors', blurb: 'A swinging scissor pendulum. Knock it and it snips any string it swings through.', rot: false, flip: false, tray: true },
  funnel: { name: 'Funnel', blurb: 'Gathers anything falling into it and drops it through the middle.', rot: false, flip: false, tray: true },
  bell: { name: 'Bell', blurb: 'Ring it!', rot: false, flip: false, tray: true },
  trapdoor: { name: 'Trapdoor', blurb: 'A hinged flap. It swings open when nothing holds it up.', rot: false, flip: true, tray: false },
  pulley: { name: 'Pulley', blurb: 'A bucket and a weight on one cord: fill the bucket and the weight rises.', rot: false, flip: true, tray: false },
  string: { name: 'String', blurb: 'Holds things up, until it is cut or burnt.', rot: false, flip: false, tray: false },
  shelf: { name: 'Shelf', blurb: 'Taped down: it will not move.', rot: true, flip: false, tray: false },
  hedgehog: { name: 'Hedgehog', blurb: 'Fast asleep. Wake him gently.', rot: false, flip: true, tray: false },
  bowl: { name: 'Bird bowl', blurb: 'Breakfast goes in here.', rot: false, flip: false, tray: false },
  lantern: { name: 'Lantern', blurb: 'Press its switch to light it.', rot: false, flip: true, tray: false },
  train: { name: 'Night train', blurb: 'Pull its whistle cord.', rot: false, flip: true, tray: false },
};
export const GOAL_PARTS: PartId[] = ['bell', 'hedgehog', 'bowl', 'lantern', 'train'];

// ---------------------------------------------------------------- the parts as bodies
export type Role = 'fixed' | 'placed';
/** A part in a world: its bodies (the first is the main one), and whatever it does while running. */
export type Part = {
  p: PartId; role: Role; idx: number; f: 0 | 1; r: number; x: number; y: number;
  body: Body; extra: Body[]; joints: Joint[];
  /** Running state: a spring's squash, a fan's or bellows' puff, a car's drive time, a bell's ring, a goal met, a popped balloon. */
  t: number; on: boolean; gone: boolean; hitAt: number; w: number; h: number;
};
const FRICTION = 0.6;
const opts = (o: Partial<{ density: number; friction: number; restitution: number; linDamp: number; angDamp: number; group: number; gs: number; sensor: boolean }> = {}) => ({ friction: FRICTION, ...o });
const S = (o: Partial<{ friction: number; restitution: number; group: number; sensor: boolean }> = {}) => ({ isStatic: true, friction: FRICTION, ...o });
let groupSeq = 100;

/** Rotates (dx, dy) by r steps and mirrors it first when flipped. */
export function turn(dx: number, dy: number, r: number, f: 0 | 1 = 0): [number, number] {
  const a = r * STEP_A, c = Math.cos(a), s = Math.sin(a), x = f ? -dx : dx;
  return [c * x - s * dy, s * x + c * dy];
}

/** Builds one part into the world. (x, y) is the part's centre, or its pin for hinged parts. */
export function build(w: World, ground: Body, it: Item | Place, role: Role, idx: number): Part {
  const p = it.p, x = it.x, y = it.y, r = it.r ?? 0, f = (it.f ?? 0) as 0 | 1, a = r * STEP_A, sg = f ? -1 : 1;
  const W = (it as Item).w, H = (it as Item).h;
  const part = (body: Body, extra: Body[] = [], joints: Joint[] = [], ww = 0, hh = 0): Part => ({ p, role, idx, f, r, x, y, body, extra, joints, t: 0, on: false, gone: false, hitAt: -1, w: ww, h: hh });
  switch (p) {
    case 'marble': return part(w.add([circle(0.22)], opts({ density: 4, friction: 0.35, restitution: 0.3, angDamp: 0.06, linDamp: 0.01 }), x, y));
    case 'acorn': return part(w.add([circle(0.26)], opts({ density: 1.1, friction: 0.7, restitution: 0.15, angDamp: 0.3, linDamp: 0.04 }), x, y));
    case 'domino': return part(w.add([box(0.24, 1.2)], opts({ density: 1.4, friction: 0.55 }), x, y, a), [], [], 0.24, 1.2);
    case 'block': return part(w.add([box(0.72, 0.5)], opts({ density: 0.8, friction: 0.5 }), x, y, a), [], [], 0.72, 0.5);
    case 'ramp': return part(w.add([box(2.4, 0.2)], S({ friction: 0.5 }), x, y, a), [], [], 2.4, 0.2);
    case 'plank': return part(w.add([box(3.6, 0.22)], S({ friction: 0.5 }), x, y, a), [], [], 3.6, 0.22);
    case 'shelf': { const ww = W ?? 3, hh = H ?? 0.3; return part(w.add([box(ww, hh)], S({ friction: 0.5 }), x, y, a), [], [], ww, hh); }
    case 'seesaw': {
      // a plank on a cardboard fulcrum, resting tipped 24° (its low end on the right, or the left when flipped), with a
      // lip at each end so whatever sits on it stays put; it can swing over to 25° the other way
      const g = ++groupSeq, tilt = f ? 0.42 : -0.42;
      const base = w.add([poly([[-0.42, -0.62], [0.42, -0.62], [0, 0.02]])], S({ group: g }), x, y);
      const plank = w.add([box(3.2, 0.16), box(0.1, 0.22, 0, -1.55, 0.18), box(0.1, 0.22, 0, 1.55, 0.18)], opts({ density: 0.7, friction: 0.7, group: g }), x, y, tilt);
      const j = f ? w.hinge(ground, plank, x, y, -0.86, 0.02) : w.hinge(ground, plank, x, y, -0.02, 0.86);
      return part(plank, [base], [j], 3.2, 0.18);
    }
    case 'spring': return part(w.add([box(1, 0.3)], S({ friction: 0.4 }), x, y, a), [], [], 1, 0.3);
    case 'fan': return part(w.add([box(0.8, 0.9)], S(), x, y, a), [], [], 0.8, 0.9);
    case 'bellows': return part(w.add([box(1.1, 0.55)], S({ friction: 0.5 }), x, y), [], [], 1.1, 0.55);
    case 'car': {
      const body = w.add([box(1, 0.34, 0.06, 0, 0.02), circle(0.15, -0.32, -0.2), circle(0.15, 0.32, -0.2)], opts({ density: 1.2, friction: 0.02, angDamp: 0.4 }), x, y);
      return part(body, [], [], 1, 0.7);
    }
    case 'balloon': return part(w.add([circle(0.42)], opts({ density: 0.06, friction: 0.05, restitution: 0.3, gs: 0, linDamp: 2.4, angDamp: 2 }), x, y));
    case 'pin': return part(w.add([poly([[-0.1, -0.22], [0.1, -0.22], [0.02, 0.24], [-0.02, 0.24]])], S(), x, y, a), [], [], 0.2, 0.46);
    case 'candle': return part(w.add([box(0.3, 0.8)], S(), x, y), [], [], 0.3, 0.8);
    case 'funnel': {
      const l = w.add([box(1.3, 0.14)], S({ friction: 0.2 }), x - 0.72, y + 0.42, -0.9);
      const rt = w.add([box(1.3, 0.14)], S({ friction: 0.2 }), x + 0.72, y + 0.42, 0.9);
      return part(l, [rt], [], 2.2, 1.1);
    }
    case 'bell': {
      // a brass bell swinging on a pin at its top
      const b = w.add([poly([[-0.42, -0.72], [0.42, -0.72], [0.26, -0.12], [0, 0.02], [-0.26, -0.12]])], opts({ density: 2, friction: 0.4, restitution: 0.2, angDamp: 0.3 }), x, y);
      const j = w.hinge(ground, b, x, y);
      return part(b, [], [j], 0.84, 0.74);
    }
    case 'scissors': {
      // a long arm on a pin, the blades at its foot
      const b = w.add([box(0.14, 1.7, 0, 0, -0.85), box(0.5, 0.16, 0, 0, -1.72)], opts({ density: 0.6, friction: 0.3, angDamp: 0.05 }), x, y);
      const j = w.hinge(ground, b, x, y);
      return part(b, [], [j], 0.5, 1.8);
    }
    case 'trapdoor': {
      // hinged at (x, y); the flap reaches 2 units out (right, or left when flipped) and may swing down 85°
      const len = W ?? 2;
      const b = w.add([box(len, 0.16)], opts({ density: 1, friction: 0.6 }), x + sg * len / 2, y);
      const j = f ? w.hinge(ground, b, x, y, 0, 1.48) : w.hinge(ground, b, x, y, -1.48, 0);
      return part(b, [], [j], len, 0.16);
    }
    case 'pulley': {
      // wheels at (x ± 0.7, y); the bucket hangs on the left (right when flipped), the weight on the other side
      const d1 = (it as Item).d1 ?? 2.4, d2 = (it as Item).d2 ?? 2.4;
      const bx = x - 0.7 * sg, kx = x + 0.7 * sg;
      const bucket = w.add([box(1.1, 0.12, 0, 0, -0.3), box(0.12, 0.6, 0, -0.55, 0), box(0.12, 0.6, 0, 0.55, 0)], opts({ density: 0.8, friction: 0.6 }), bx, y - d1);
      const weight = w.add([box(0.66, 0.6)], opts({ density: 1.6, friction: 0.6 }), kx, y - d2);
      const j = w.pulley(bucket, bx, y - d1 + 0.3, bx, y, weight, kx, y - d2 + 0.3, kx, y);
      return part(bucket, [weight], [j], 1.2, 0.7);
    }
    case 'hedgehog': return part(w.add([poly([[-0.62, 0], [0.62, 0], [0.5, 0.36], [0.2, 0.58], [-0.2, 0.58], [-0.5, 0.36]])], S({ friction: 0.8 }), x, y), [], [], 1.24, 0.6);
    case 'bowl': {
      const g = w.add([box(1.5, 0.14, 0, 0, 0.07), box(0.14, 0.62, 0, -0.75, 0.31), box(0.14, 0.62, 0, 0.75, 0.31)], S({ friction: 0.8 }), x, y);
      return part(g, [], [], 1.64, 0.62);
    }
    case 'lantern': {
      // the lantern on its post, with a round switch out to its side
      const g = w.add([box(0.7, 1.0, 0, 0, 0.5), circle(0.2, sg * 0.55, 0.45)], S(), x, y);
      return part(g, [], [], 1.1, 1);
    }
    case 'train': {
      // the little engine on its rails, the whistle cord's handle hanging off its back
      const g = w.add([box(1.8, 0.8, 0.1, 0, 0.4), box(0.36, 0.14, 0, -sg * 1.08, 0.75)], S(), x, y);
      return part(g, [], [], 2, 1);
    }
    case 'string': return stub(ground, it as Item, idx);
  }
}

// ---------------------------------------------------------------- building a puzzle's world
export type Ev = { k: 'clack' | 'tink' | 'thud' | 'boing' | 'puff' | 'vroom' | 'pop' | 'snip' | 'burn' | 'ring' | 'goal' | 'token' | 'creak'; x: number; y: number; s: number };

export type Built = { world: World; ground: Body; parts: Part[]; token: Body | null; strings: { j: Joint; burn: number; item: number }[]; walls: Body[] };

/** A world from a puzzle's fixed parts and the player's placements. */
export function buildWorld(P: Puzzle, places: Place[]): Built {
  const world = new World(), ground = world.add([], { isStatic: true });
  const walls = [
    world.add([box(P.W + 4, 1)], S({ friction: 0.7 }), P.W / 2, -0.5),
    world.add([box(1, P.H + 6)], S(), -0.5, P.H / 2 + 2),
    world.add([box(1, P.H + 6)], S(), P.W + 0.5, P.H / 2 + 2),
    // the box's lid, so balloons stop at the top
    world.add([box(P.W + 4, 1)], S({ friction: 0.3 }), P.W / 2, P.H + 0.5),
  ];
  const parts: Part[] = [];
  const strings: Built['strings'] = [];
  P.items.forEach((it, i) => {
    if (it.p === 'string') { parts.push(stub(ground, it, i)); return; }
    const q = build(world, ground, it, 'fixed', i); parts.push(q);
    if (it.v) { q.body.vx = it.v[0]; q.body.vy = it.v[1]; }
  });
  places.forEach((pl, i) => parts.push(build(world, ground, pl, 'placed', i)));
  // strings last, once the parts they tie exist
  P.items.forEach((it, i) => {
    if (it.p !== 'string') return;
    const to = partOf(parts, it.to ?? -1), from = it.from !== undefined ? partOf(parts, it.from) : null;
    if (!to) return;
    const [ox, oy] = it.at ?? [0, 0], tb = to.body, tx = tb.x + tb.c * ox - tb.s * oy, ty = tb.y + tb.s * ox + tb.c * oy;
    const A = from ? from.body : ground;
    const j = world.rope(A, it.x, it.y, tb, tx, ty, it.len);
    strings.push({ j, burn: 0, item: i });
    parts[i].joints = [j];
  });
  const token = P.token ? world.add([circle(0.3)], { isStatic: true, sensor: true }, P.token[0], P.token[1]) : null;
  return { world, ground, parts, token, strings, walls };
}
function stub(ground: Body, it: Item, i: number): Part {
  return { p: 'string', role: 'fixed', idx: i, f: 0, r: 0, x: it.x, y: it.y, body: ground, extra: [], joints: [], t: 0, on: false, gone: false, hitAt: -1, w: 0, h: 0 };
}
const partOf = (parts: Part[], i: number) => parts.find((q) => q.role === 'fixed' && q.idx === i) ?? null;

// ---------------------------------------------------------------- where parts may go
/** The bounding box of a placement's bodies, built alone. */
export function placeBox(pl: Place): [number, number, number, number] {
  const w = new World(), g = w.add([], { isStatic: true }), pt = build(w, g, pl, 'placed', 0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of [pt.body, ...pt.extra]) { x0 = Math.min(x0, b.minX); y0 = Math.min(y0, b.minY); x1 = Math.max(x1, b.maxX); y1 = Math.max(y1, b.maxY); }
  return [x0, y0, x1, y1];
}
/** Why a placement can't go where it is ('zone': outside the build areas, 'bump': overlapping a part), or null if it can. */
export function placeProblem(P: Puzzle, places: Place[], pl: Place, skip = -1): 'zone' | 'bump' | null {
  const [x0, y0, x1, y1] = placeBox(pl), e = 0.02;
  if (!P.zones.some(([a, b, c, d]) => x0 >= a - e && y0 >= b - e && x1 <= c + e && y1 <= d + e)) return 'zone';
  const others = places.filter((_, i) => i !== skip);
  const B = buildWorld(P, others), g = B.ground, mine = build(B.world, g, pl, 'placed', 99);
  const mineBodies = [mine.body, ...mine.extra];
  const goals = new Set(B.parts.filter((q) => GOAL_PARTS.includes(q.p) || q.p === 'pulley' || q.p === 'trapdoor').flatMap((q) => [q.body, ...q.extra]));
  for (const b of B.world.bodies) {
    if (b === g || (b.sensor && b !== B.token) || mineBodies.includes(b)) continue;
    // nothing may be put on or against a goal, a pulley or a trapdoor: it has to be reached by the chain
    for (const m of mineBodies) if (overlap(m, b) > 0.02 || (goals.has(b) && near(m, b, 0.12))) return 'bump';
  }
  return null;
}
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;
/** Snaps a point to the quarter grid of the build area it is in (or nearest): the grid the bot searches. */
export function snapTo(P: Puzzle, x: number, y: number): [number, number] {
  let z = P.zones[0], best = Infinity;
  for (const q of P.zones) { const d = Math.hypot(Math.max(q[0] - x, 0, x - q[2]), Math.max(q[1] - y, 0, y - q[3])); if (d < best) { best = d; z = q; } }
  if (!z) return [snap(x), snap(y)];
  const ox = z[0] + 0.25, oy = z[3] - 0.25;
  return [+(ox + Math.round((x - ox) / SNAP) * SNAP).toFixed(3), +(oy + Math.round((y - oy) / SNAP) * SNAP).toFixed(3)];
}
/** Parts that stand on whatever is below them: placed, they settle down onto it. */
export const SETTLES: PartId[] = ['domino', 'block', 'car', 'marble', 'acorn', 'bellows', 'candle'];
/** Lowers a standing part onto the surface below it (inside its build area), or returns null if it can't stand there. */
export function settle(P: Puzzle, places: Place[], pl: Place, skip = -1): Place | null {
  if (!SETTLES.includes(pl.p)) return placeProblem(P, places, pl, skip) ? null : pl;
  const B = buildWorld(P, places.filter((_, i) => i !== skip)), mine = build(B.world, B.ground, pl, 'placed', 99).body;
  const others = B.world.bodies.filter((b) => b !== mine && b !== B.ground && (!b.sensor || b === B.token));
  const goals = new Set(B.parts.filter((q) => GOAL_PARTS.includes(q.p) || q.p === 'pulley' || q.p === 'trapdoor').flatMap((q) => [q.body, ...q.extra]));
  const zone = P.zones.find(([a, b, c, d]) => pl.x >= a && pl.x <= c && pl.y >= b - 0.5 && pl.y <= d + 0.5);
  if (!zone) return null;
  const free = (y: number) => {
    mine.y = y; mine.sync();
    if (mine.minX < zone[0] - 0.02 || mine.maxX > zone[2] + 0.02 || mine.minY < zone[1] - 0.02 || mine.maxY > zone[3] + 0.02) return false;
    for (const b of others) if (overlap(mine, b) > 0.004) return false;
    return true;
  };
  let y = Math.min(pl.y, zone[3] - (mine.maxY - mine.y));
  if (!free(y)) {
    // pointed inside something: stand on top of it if there is room, else look below
    let up = y; while (!free(up) && up < y + 1.3) up += 0.05;
    if (free(up)) y = up; else { while (!free(y) && y > zone[1]) y -= 0.05; }
  }
  if (!free(y)) return null;
  while (free(y - 0.05)) y -= 0.05;
  while (free(y - 0.01)) y -= 0.01;
  mine.y = y; mine.sync();
  for (const b of goals) if (near(mine, b, 0.12)) return null;
  return { ...pl, y: Math.round((y + 0.004) * 1000) / 1000 };
}

// ---------------------------------------------------------------- a run
export type Outcome = 'win' | 'stuck' | 'time' | null;

/** One run of a contraption from Go: step it, read what happened. */
export class Run {
  readonly P: Puzzle; readonly places: Place[];
  B: Built; steps = 0;
  goals: Part[]; goalHit: boolean[];
  token = false; tokenAt = -1;
  outcome: Outcome = null; winAt = -1;
  /** Events since the page last took them. */
  events: Ev[] = [];
  /** Each moving body's path, sampled every few steps, for the ghost trail. */
  trails: number[][] = [];
  /** Where the action is: the place the camera follows on a big board. */
  hot: [number, number];
  private still = 0;
  /** Contacts pressing last step, so a new one (an impact) can be told apart. */
  private live = new Set<number>();
  private cool = new Map<Body, number>();
  private dyn: Body[];
  private bowlIn = new Map<Part, number>();
  constructor(P: Puzzle, places: Place[]) {
    this.P = P; this.places = places.map((p) => ({ ...p }));
    this.B = buildWorld(P, this.places);
    this.goals = this.B.parts.filter((q) => GOAL_PARTS.includes(q.p) && q.role === 'fixed');
    this.goalHit = this.goals.map(() => false);
    this.dyn = this.B.world.bodies.filter((b) => !b.isStatic);
    this.trails = this.dyn.map((b) => [b.x, b.y]);
    const first = this.dyn[0]; this.hot = first ? [first.x, first.y] : [P.W / 2, P.H / 2];
  }
  get t() { return this.steps * DT; }
  get won() { return this.goalHit.length > 0 && this.goalHit.every(Boolean); }
  private ev(k: Ev['k'], x: number, y: number, s = 1) { if (this.events.length < 60) this.events.push({ k, x, y, s }); }
  take(): Ev[] { const e = this.events; this.events = []; return e; }
  partFor(b: Body): Part | null {
    for (const q of this.B.parts) if (q.body === b || q.extra.includes(b)) return q;
    return null;
  }

  step() {
    const B = this.B, w = B.world, t = this.t;
    // fans blow before the step: a push that fades with distance, the same for every body, so light things fly
    for (const q of B.parts) {
      if (q.p !== 'fan' || q.gone) continue;
      const [dx, dy] = turn(1, 0, q.r, q.f);
      for (const b of this.dyn) {
        const rx = b.x - q.x, ry = b.y - q.y, along = rx * dx + ry * dy, side = Math.abs(-rx * dy + ry * dx);
        if (along < 0.3 || along > FAN_REACH || side > 0.75) continue;
        const k = FAN_FORCE * (1 - along / FAN_REACH) * (b.m < 0.4 ? 1 : 0.35);
        b.fx += k * dx; b.fy += k * dy;
      }
      q.t += DT;
    }
    // balloons pull up
    for (const q of B.parts) if (q.p === 'balloon' && !q.gone) q.body.fy += LIFT;
    // wind-up cars drive
    for (const q of B.parts) {
      if (q.p !== 'car' || !q.on || q.t > CAR_TIME) continue;
      q.t += DT;
      const b = q.body, dir = q.f ? -1 : 1, want = CAR_SPEED * dir;
      b.fx += Math.max(-14, Math.min(14, (want - b.vx) * 6)) * b.m;
    }
    w.step(); this.steps++;
    // what touched what: a contact is pressing when it pushed this step (speculative ones push before they touch)
    const live = new Set<number>();
    for (const c of w.contacts) {
      let hit = 0; for (const p of c.pts) hit = Math.max(hit, -p.rel);
      const touching = c.pts.some((p) => p.sep < 0.01 || p.pn > 0);
      if (!touching) continue;
      live.add(c.key);
      const fresh = !this.live.has(c.key);
      const qa = this.partFor(c.A), qb = this.partFor(c.B);
      const px = c.A.x + c.pts[0].rax, py = c.A.y + c.pts[0].ray;
      if (fresh && hit > 0.9) {
        const doms = qa?.p === 'domino' || qb?.p === 'domino', mar = qa?.p === 'marble' || qb?.p === 'marble';
        this.ev(doms ? 'clack' : mar ? 'tink' : 'thud', px, py, Math.min(1, hit / 6));
      }
      for (const [q, o, oq, sgn] of [[qa, c.B, qb, 1], [qb, c.A, qa, -1]] as [Part | null, Body, Part | null, number][]) {
        if (!q || o.isStatic) continue;
        this.touch(q, o, oq, c.nx * sgn, c.ny * sgn, hit, fresh, px, py);
      }
    }
    this.live = live;
    // strings: scissors and flames
    for (const s of B.strings) {
      if (s.j.off) continue;
      const [ax, ay, bx, by] = w.ends(s.j);
      for (const q of B.parts) {
        if (q.gone) continue;
        if (q.p === 'scissors') {
          // anywhere along the blades
          const sb = q.body; if (Math.abs(sb.w) < 0.4) continue;
          for (const bx0 of [-0.25, 0, 0.25]) {
            const tx = sb.x + sb.c * bx0 + sb.s * 1.72, ty = sb.y + sb.s * bx0 - sb.c * 1.72;
            if (segDist(tx, ty, ax, ay, bx, by) < CUT_R) { s.j.off = true; this.ev('snip', tx, ty); break; }
          }
        } else if (q.p === 'candle') {
          const fx = q.body.x, fy = q.body.y + 0.62;
          if (segDist(fx, fy, ax, ay, bx, by) < BURN_R) { s.burn += DT; if (s.burn >= BURN_TIME) { s.j.off = true; this.ev('burn', fx, fy); } }
        }
      }
    }
    // balloons by a flame
    for (const q of B.parts) {
      if (q.p !== 'balloon' || q.gone) continue;
      for (const c of B.parts) if (c.p === 'candle' && Math.hypot(q.body.x - c.body.x, q.body.y - c.body.y - 0.62) < 0.42 + 0.14) this.pop(q);
    }
    // a bell set swinging rings
    for (const q of this.goals) if (q.p === 'bell' && Math.abs(q.body.w) > 0.7 && !this.goalHit[this.goals.indexOf(q)]) { this.ev('ring', q.x, q.y - 0.4, 0.6); this.hitGoal(q); }
    // bowls: something resting inside
    for (const q of this.goals) {
      if (q.p !== 'bowl' || this.goalHit[this.goals.indexOf(q)]) continue;
      let inside = false;
      for (const b of this.dyn) if (Math.abs(b.x - q.x) < 0.68 && b.y > q.y && b.y < q.y + 0.75 && this.partFor(b)?.p === 'acorn') inside = true;
      const n = inside ? (this.bowlIn.get(q) ?? 0) + 1 : 0; this.bowlIn.set(q, n);
      if (n >= 18) this.hitGoal(q);
    }
    // the bonus button
    if (B.token && !this.token) for (const b of this.dyn) if (!b.sensor && overlap(B.token, b) > 0) { this.token = true; this.tokenAt = this.steps; this.ev('token', B.token.x, B.token.y); break; }
    // anything that leaves the box is gone
    for (const b of this.dyn) if (b.y < -3 || b.x < -3 || b.x > this.P.W + 3 || b.y > this.P.H + 6) { const q = this.partFor(b); if (q && q.body === b && !q.gone && q.p === 'balloon') { q.gone = true; } }
    for (const q of B.parts) if (q.t > 0 && (q.p === 'spring' || q.p === 'bellows')) q.t = Math.max(0, q.t - DT);
    // the trail and the hot spot
    let best = 0.4, hx = this.hot[0], hy = this.hot[1];
    for (let i = 0; i < this.dyn.length; i++) {
      const b = this.dyn[i]; if (!w.bodies.includes(b)) continue;
      const sp = Math.hypot(b.vx, b.vy) * (b.m < 0.1 ? 0.3 : 1);
      if (sp > best) { best = sp; hx = b.x; hy = b.y; }
      if (this.steps % 4 === 0) { const tr = this.trails[i]; const lx = tr[tr.length - 2], ly = tr[tr.length - 1]; if (Math.abs(lx - b.x) + Math.abs(ly - b.y) > 0.03 && tr.length < 1600) tr.push(b.x, b.y); }
    }
    this.hot = [hx, hy];
    // is it over?
    if (this.won && this.winAt < 0) { this.winAt = this.steps; this.outcome = 'win'; }
    if (this.outcome) return;
    const moving = w.motion() > 0.08 || B.parts.some((q) => q.p === 'car' && q.on && q.t < CAR_TIME && Math.abs(q.body.vx) > 0.2) || B.strings.some((s) => !s.j.off && s.burn > 0 && s.burn < BURN_TIME);
    this.still = moving ? 0 : this.still + 1;
    if (t > 1.2 && this.still > 70) this.outcome = 'stuck';
    else if (t >= (this.P.time ?? 16)) this.outcome = 'time';
  }
  /** Part q (fixed or placed) was touched by body o, of part oq, with normal (nx, ny) pointing from q into o. */
  private touch(q: Part, o: Body, oq: Part | null, nx: number, ny: number, hit: number, fresh: boolean, px: number, py: number) {
    const w = this.B.world;
    switch (q.p) {
      case 'spring': {
        const [ux, uy] = turn(0, 1, q.r);
        if (nx * ux + ny * uy < 0.6 || (this.cool.get(o) ?? -1) > this.steps) return;
        const vn = o.vx * ux + o.vy * uy;
        o.vx += (SPRING_V - vn) * ux; o.vy += (SPRING_V - vn) * uy;
        this.cool.set(o, this.steps + 24); q.t = 0.35; this.ev('boing', px, py);
        return;
      }
      case 'bellows': {
        if (!fresh || hit < 1.2 || ny < 0.5 || q.t > 0) return;
        q.t = 0.6; q.on = true;
        const dir = q.f ? -1 : 1, ox = q.x + dir * 0.6, oy = q.y;
        for (const b of this.dyn) {
          if (b === o || !w.bodies.includes(b)) continue;
          const along = (b.x - ox) * dir, side = Math.abs(b.y - oy - 0.1);
          if (along < -0.1 || along > PUFF_REACH || side > 0.9) continue;
          const J = 2.3 * (1 - along / PUFF_REACH);
          const dv = J / Math.max(b.m, 0.25); b.vx += dv * dir; b.vy += dv * 0.15;
        }
        this.ev('puff', ox, oy);
        return;
      }
      case 'car': if (!q.on && hit > 0.4 && oq?.p !== 'car') { q.on = true; q.t = 0; this.ev('vroom', q.body.x, q.body.y); } return;
      case 'pin': if (oq?.p === 'balloon') this.pop(oq); return;
      case 'balloon': if (oq?.p === 'pin') this.pop(q); return;
      case 'bell': case 'hedgehog': case 'lantern': case 'train': {
        if (oq && (oq.p === 'balloon' && q.p !== 'bell')) return;
        if (q.p === 'bell' && hit > 0.4 && (this.cool.get(q.body) ?? -1) < this.steps) { this.cool.set(q.body, this.steps + 12); this.ev('ring', q.x, q.y - 0.4, Math.min(1, hit / 4)); }
        if (q.role === 'fixed' && !this.goalHit[this.goals.indexOf(q)] && (q.p !== 'bell' || hit > 0.4)) this.hitGoal(q);
        return;
      }
      default: return;
    }
  }
  private hitGoal(q: Part) {
    const i = this.goals.indexOf(q); if (i < 0 || this.goalHit[i]) return;
    this.goalHit[i] = true; q.hitAt = this.steps; q.on = true;
    this.ev('goal', q.x, q.y + 0.5);
  }
  private pop(q: Part) {
    if (q.gone) return;
    q.gone = true; this.B.world.remove(q.body); this.ev('pop', q.body.x, q.body.y);
  }
  /** Runs until it is over (and, if it won, through the payoff), or for at most `max` seconds. */
  finish(max = 60) { const end = Math.round(max / DT); while (!this.outcome && this.steps < end) this.step(); return this.outcome; }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Runs a contraption to its end: did it win, did it touch the button, and how long it took. */
export function simulate(P: Puzzle, places: Place[], max?: number) {
  const r = new Run(P, places); r.finish(max ?? (P.time ?? 16) + 1);
  return { win: r.outcome === 'win', token: r.token, steps: r.steps, goals: r.goalHit.slice(), outcome: r.outcome };
}

// ---------------------------------------------------------------- stars, unlocking and the save
export type Record1 = { done: boolean; stars: number; best: number | null; lay: Place[] };
export type Save = { v: 1; puzzles: Record<string, Record1>; tutorial: boolean; ended: boolean; free: Place[]; settings: { sound: boolean; music: boolean } };
export const freshSave = (): Save => ({ v: 1, puzzles: {}, tutorial: false, ended: false, free: [], settings: { sound: true, music: true } });
const PART_IDS = Object.keys(PARTS) as PartId[];
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/** A placement read back from a save, or null if it is not a real one. */
export function readPlace(v: unknown): Place | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.p !== 'string' || !PART_IDS.includes(o.p as PartId) || !PARTS[o.p as PartId].tray) return null;
  if (!num(o.x, -2, 40) || !num(o.y, -2, 20)) return null;
  const r = num(o.r, -ROT, ROT) && Number.isInteger(o.r) ? (o.r as number) : 0, f = o.f === 1 ? 1 : 0;
  return { p: o.p as PartId, x: o.x as number, y: o.y as number, r, f };
}
/** The save, read defensively: anything odd is dropped, never trusted. */
export function readSave(raw: string | null): Save {
  const s = freshSave();
  if (!raw) return s;
  let o: unknown; try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object' || (o as { v?: unknown }).v !== 1) return s;
  const d = o as Record<string, unknown>;
  if (d.puzzles && typeof d.puzzles === 'object') {
    for (const [id, v] of Object.entries(d.puzzles as Record<string, unknown>)) {
      if (!PUZZLES[id] || !v || typeof v !== 'object') continue;
      const r = v as Record<string, unknown>;
      const lay = Array.isArray(r.lay) ? (r.lay.map(readPlace).filter(Boolean) as Place[]).slice(0, 12) : [];
      s.puzzles[id] = { done: r.done === true, stars: num(r.stars, 0, 7) && Number.isInteger(r.stars) ? (r.stars as number) : 0, best: num(r.best, 0, 99) ? (r.best as number) : null, lay };
      if (!s.puzzles[id].done) { s.puzzles[id].stars = 0; s.puzzles[id].best = null; }
    }
  }
  s.tutorial = d.tutorial === true; s.ended = d.ended === true;
  if (Array.isArray(d.free)) s.free = (d.free.map(readPlace).filter(Boolean) as Place[]).slice(0, SANDBOX_MAX);
  const st = d.settings as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') { s.settings.sound = st.sound !== false; s.settings.music = st.music !== false; }
  return s;
}
export const starBits = (solved: boolean, parts: number, par: number, token: boolean) => (solved ? 1 : 0) | (solved && parts <= par ? 2 : 0) | (solved && token ? 4 : 0);
export const starCount = (bits: number) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
export const totalStars = (s: Save) => PUZZLE_IDS.reduce((n, id) => n + starCount(s.puzzles[id]?.stars ?? 0), 0);
export const done = (s: Save, id: string) => !!s.puzzles[id]?.done;
export function roomOpen(s: Save, r: number) { if (r <= 0) return true; const prev = ROOMS[r - 1].puzzles; return done(s, prev[prev.length - 1]); }
export function puzzleOpen(s: Save, id: string) {
  const P = PUZZLES[id]; if (!P || !roomOpen(s, P.room)) return false;
  const list = ROOMS[P.room].puzzles, i = list.indexOf(id);
  return i === 0 || done(s, list[i - 1]) || (i >= 2 && done(s, list[i - 2]) && i < list.length - 1);
}
export const roomCount = (s: Save, r: number) => ROOMS[r].puzzles.filter((id) => done(s, id)).length;
export const freeOpen = (s: Save) => done(s, ROOMS[0].puzzles[ROOMS[0].puzzles.length - 1]);
/** The parts the free build offers: everything met in the rooms opened so far. */
export function freeParts(s: Save): PartId[] {
  const seen = new Set<PartId>(['marble', 'acorn', 'domino', 'ramp', 'plank', 'block', 'bell']);
  for (let r = 0; r < ROOMS.length; r++) if (roomOpen(s, r)) for (const id of ROOMS[r].puzzles) for (const k of Object.keys(PUZZLES[id].tray) as PartId[]) seen.add(k);
  return PART_IDS.filter((k) => PARTS[k].tray && seen.has(k));
}
export function nextPuzzle(s: Save): string | null { return PUZZLE_IDS.find((id) => !done(s, id) && puzzleOpen(s, id)) ?? null; }
/** Records a finished run; returns the new stars and whether this solved the puzzle for the first time or finished the game. */
export function recordRun(s: Save, id: string, bits: number, parts: number, lay: Place[]) {
  const old = s.puzzles[id] ?? { done: false, stars: 0, best: null, lay: [] };
  const first = !old.done, stars = old.stars | bits;
  s.puzzles[id] = { done: true, stars, best: old.best === null ? parts : Math.min(old.best, parts), lay: lay.map((p) => ({ ...p })) };
  const finale = id === PUZZLE_IDS[PUZZLE_IDS.length - 1] && !s.ended;
  if (finale) s.ended = true;
  return { newStars: starCount(stars) - starCount(old.stars), first, finale };
}
/** How many of each part are still in the tray. */
export function trayLeft(P: Puzzle, places: Place[]): Partial<Record<PartId, number>> {
  const left: Partial<Record<PartId, number>> = { ...P.tray };
  for (const pl of places) left[pl.p] = (left[pl.p] ?? 0) - 1;
  return left;
}
export type { Shape };
/** The free build's puzzle with its tray: up to SANDBOX_MAX parts, any mix of those met so far. */
export function freePuzzle(s: Save): Puzzle {
  const tray: Partial<Record<PartId, number>> = {};
  for (const k of freeParts(s)) tray[k] = k === 'domino' ? 10 : k === 'marble' || k === 'acorn' || k === 'ramp' ? 4 : 2;
  return { ...FREE, tray };
}

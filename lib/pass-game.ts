// Kumori Pass: the rules. One Race is one run down (or up) a pass, stepped at a fixed 120 Hz: the cars and the road,
// guardrail hits, gutter hooks, light crests, car-to-car bumps, the drift meter and its boost, the bun tray, Enzo's pace
// notes, spin-outs and resets, the time gap between duelling cars and a ghost replayed from recorded inputs. A Duel
// strings Races into the touge rounds (lead, chase, sudden death). The AI drives the same car physics along a racing
// line with a personality. Saves are parsed defensively. Deterministic: a seeded generator, no Math.random, no clock.

import { ASSIST, BASE, BASE_STATS, DT, G, idleInput, makeCar, quantise, slipAngle, steerLock, stepCar, withUpgrades, worldVel, setWorldVel,
  type Car, type CarSpec, type Input, type Stat, type SteerMode } from './pass-car.js';
import { at, buildTrack, locate, radiusAt, GUTTER, PASSES, STEP, type PassId, type Track, type Where } from './pass-tracks.js';

export { DT } from './pass-car.js';

// ---------------------------------------------------------------- random
export function rng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- tracks, cached
const trackCache = new Map<string, Track>();
export function getTrack(id: PassId, reversed = false): Track {
  const key = id + (reversed ? '-up' : '');
  let t = trackCache.get(key);
  if (!t) { t = buildTrack(id, reversed); trackCache.set(key, t); }
  return t;
}
/** Progress where the finish line sits (the last 35 m are run-out). */
export const finishS = (t: Track) => t.len - 35;
export const START_S = 14;

// ---------------------------------------------------------------- rivals
export type RivalId = 'stoat' | 'otter' | 'badger' | 'pika' | 'bat' | 'goat' | 'fox' | 'owl';
export type Rival = {
  id: RivalId; name: string; animal: string; car: string; carBlurb: string; pass: PassId; reversed?: boolean;
  body: number; trim: number; shape: CarShape;
  /** target-speed factor on the racing line, braking as a fraction of the grip, how hard they block, fog and dark nerves */
  pace: number; brake: number; block: number; fog: number; dark: number;
  /** chance per corner of a small error (running a little wide and lifting) */
  slip: number;
  /** engine strength against the stock Biscuit's */
  power: number;
  taunt: string; style: string; win: string; lose: string;
};
export type CarShape = 'hatch' | 'wedge' | 'roadster' | 'saloon' | 'kei' | 'fastback' | 'coupe' | 'brake';

export const RIVALS: Rival[] = [
  { id: 'stoat', name: 'Skitter', animal: 'stoat', car: 'Kestrel', carBlurb: 'a red wedge coupe with pop-up lights', pass: 'cedar', body: 0xd8352f, trim: 0x1d1d22, shape: 'wedge',
    pace: 0.915, brake: 0.86, block: 0.85, fog: 0.04, dark: 0.04, slip: 0.08, power: 1,
    taunt: 'A bun car? I\'ll be at the summit before your dough rises.', style: 'Blocks the middle of the road. Pass him in the wide places.',
    win: 'Ha! Back to the oven, bun car.', lose: 'No way… a delivery hatch?!' },
  { id: 'otter', name: 'Ripple', animal: 'otter', car: 'Lagoon', carBlurb: 'a teal roadster with pop-up lights', pass: 'lake', body: 0x1f9e9a, trim: 0xf0e6cf, shape: 'roadster',
    pace: 0.9456, brake: 0.88, block: 0.3, fog: 0.03, dark: 0.04, slip: 0.06, power: 1,
    taunt: 'The esses flow like water. Can you keep up with the current?', style: 'Smooth and quick through linked corners, gentle on the brakes.',
    win: 'Go with the flow next time.', lose: 'You found the rhythm. Nice.' },
  { id: 'badger', name: 'Bodger', animal: 'badger', car: 'Coalscuttle', carBlurb: 'a boxy black and white saloon with a light pod', pass: 'stairs', body: 0x23252b, trim: 0xf4f1e8, shape: 'saloon',
    pace: 0.8517, brake: 0.97, block: 0.5, fog: 0.04, dark: 0.04, slip: 0.07, power: 1,
    taunt: 'I brake later than you think, little bun.', style: 'Brakes very late into hairpins. Get him on the exits.',
    win: 'Late on the anchors, that\'s the trick.', lose: 'You hooked the gutters. Old trick. Good trick.' },
  { id: 'pika', name: 'Pippa', animal: 'pika', car: 'Mochi', carBlurb: 'a tiny pastel-pink kei coupe', pass: 'fog', body: 0xf2a7b8, trim: 0xfdf3e1, shape: 'kei',
    pace: 0.9923, brake: 0.9, block: 0.2, fog: 0.06, dark: 0.08, slip: 0.05, power: 1,
    taunt: 'I-it\'s very foggy… p-please don\'t follow too close!', style: 'Quick in the clear, but she brakes early in the fog.',
    win: 'Oh! I won? I won!', lose: 'Your notes are so good… can Enzo teach me?' },
  { id: 'bat', name: 'Vesper', animal: 'bat', car: 'Nightjar', carBlurb: 'a matte-black fastback with violet lights', pass: 'tunnel', body: 0x2a2633, trim: 0x9b6cff, shape: 'fastback',
    pace: 0.9192, brake: 0.92, block: 0.45, fog: 0.0, dark: -0.02, slip: 0.04, power: 1,
    taunt: 'Lights are for those who can\'t hear the road.', style: 'Drives by ear and doesn\'t care how dark it is.',
    win: 'The dark is my road.', lose: 'You listened. I heard it.' },
  { id: 'goat', name: 'Old Crag', animal: 'mountain goat', car: 'Ironhorn', carBlurb: 'a long silver and bronze coupe', pass: 'summit', body: 0xb9bcc2, trim: 0xa86a32, shape: 'coupe',
    pace: 0.9097, brake: 0.93, block: 0.7, fog: 0.03, dark: 0.03, slip: 0.035, power: 1,
    taunt: 'Forty winters I\'ve run this mountain. Show me.', style: 'The old king of the pass: a perfect line, and he closes the door.',
    win: 'Come back next winter.', lose: 'The mountain has a new runner.' },
  { id: 'fox', name: 'Aurora', animal: 'silver fox', car: 'Daybreak', carBlurb: 'a white fastback with gold pinstripes', pass: 'summit', reversed: true, body: 0xf3f1ea, trim: 0xd4a640, shape: 'fastback',
    pace: 0.912, brake: 0.95, block: 0.6, fog: 0.02, dark: 0.02, slip: 0.025, power: 1,
    taunt: 'I only race when the sun comes up. Don\'t keep me waiting.', style: 'The dawn champion. Fast everywhere, mistakes almost never.',
    win: 'Again tomorrow, at first light.', lose: 'So this is what warm buns taste like at dawn.' },
  // after the story: the stranger at the bakery, who only shows up once Aurora is beaten
  { id: 'owl', name: 'Hush', animal: 'snowy owl', car: 'Moonmoth', carBlurb: 'a pearl-grey shooting brake that runs with its lights off', pass: 'fog', body: 0xc9ccd6, trim: 0x8a6f9e, shape: 'brake',
    pace: 0.945, brake: 0.96, block: 0.65, fog: 0.0, dark: -0.02, slip: 0.02, power: 1.03,
    taunt: 'I don\'t need lights. I don\'t need notes. Do you?', style: 'Sees through the fog like it isn\'t there. Nobody has ever passed her.',
    win: 'Come back when you can hear the fog.', lose: '…The bakery car. I\'ll remember.' },
];
export const rival = (id: RivalId) => RIVALS.find((r) => r.id === id)!;

/** Rival cars: the same physics, tuned a touch per car. */
export function rivalSpec(id: RivalId): CarSpec {
  const r = RIVALS.findIndex((x) => x.id === id);
  // the later rivals have better cars, roughly matching what the player can buy by then
  const s = withUpgrades(BASE, (['tyres', 'flywheel', 'lsd', 'rack', 'intake'] as const).slice(0, r));
  s.torque *= RIVALS[r].power;
  return s;
}

// ---------------------------------------------------------------- the player's cars
export type CarId = 'biscuit' | 'shortbread' | 'meringue' | 'pumpernickel' | 'crumpet' | 'brioche' | 'stollen' | 'pavlova';
export type PlayerCar = { id: CarId; name: string; blurb: string; shape: CarShape; body: number; trim: number;
  /** beating this rival unlocks it (the Biscuit is always yours) */
  rival: RivalId | null; stats: Record<Stat, number>; tune: Partial<Omit<CarSpec, 'ratios'>> };
/**
 * Each car is the Biscuit with a few numbers changed, and every part fits every car. Tuned with the competent bot
 * against the stock Biscuit (docs/pass.md has the table): the early unlocks trade a strength for a weakness and come
 * out about level, the last two are 1 to 1.5% quicker overall as the reward for beating the hardest rivals.
 */
export const CARS: PlayerCar[] = [
  { id: 'biscuit', name: 'Biscuit', blurb: 'The bakery hatch. Honest, forgiving, and it smells of warm bread.', shape: 'hatch', body: 0xf3e7c9, trim: 0x6fb3dc,
    rival: null, stats: BASE_STATS, tune: {} },
  { id: 'shortbread', name: 'Shortbread', blurb: 'A golden wedge with a loose tail: it wants to drift every corner.', shape: 'wedge', body: 0xd9a35a, trim: 0x5a3a22,
    rival: 'stoat', stats: { power: 5, grip: 4, rotation: 6, stability: 3, buns: 4 }, tune: { mass: 1080, inertia: 1500, torque: 255, slideR: 0.72, br: 10.5, lsd: 0.55 } },
  { id: 'meringue', name: 'Meringue', blurb: 'Light, low and sharp: lovely in the esses, short of puff on the long straights.', shape: 'roadster', body: 0xf7eef2, trim: 0xe78fb3,
    rival: 'otter', stats: { power: 3, grip: 6, rotation: 6, stability: 5, buns: 3 }, tune: { mass: 930, inertia: 1250, cgh: 0.42, torque: 195, mu: 1.15, a: 1.05, b: 1.2, bunDamp: 1.1 } },
  { id: 'pumpernickel', name: 'Pumpernickel', blurb: 'A heavy brown saloon that rides like a sofa. The buns love it.', shape: 'saloon', body: 0xb8743f, trim: 0xf0e2c4,
    rival: 'badger', stats: { power: 6, grip: 3, rotation: 2, stability: 7, buns: 7 }, tune: { mass: 1260, inertia: 2050, cgh: 0.56, torque: 295, mu: 1.1, slideR: 0.82, bunDamp: 0.75, a: 1.25, b: 1.4 } },
  { id: 'crumpet', name: 'Crumpet', blurb: 'Tiny and nimble: king of the hairpins, but it rattles and the straights feel long.', shape: 'kei', body: 0xffb52e, trim: 0x7a4a24,
    rival: 'pika', stats: { power: 2, grip: 5, rotation: 7, stability: 4, buns: 3 }, tune: { mass: 740, inertia: 1000, a: 0.98, b: 1.08, torque: 190, lock: 0.7, drag: 0.38, bunDamp: 1.15 } },
  { id: 'brioche', name: 'Brioche', blurb: 'A big-engined fastback. Fast everywhere, if you can keep the tail behind you.', shape: 'fastback', body: 0xe0892f, trim: 0x2b2230,
    rival: 'bat', stats: { power: 7, grip: 4, rotation: 5, stability: 3, buns: 4 }, tune: { mass: 1170, inertia: 1750, torque: 310, slideR: 0.72, br: 10.8, lsd: 0.6 } },
  { id: 'stollen', name: 'Stollen', blurb: 'A long cream coupe for the whole mountain: calm, quick, and built for sweepers.', shape: 'coupe', body: 0xf2e8d2, trim: 0x8a2b3a,
    rival: 'goat', stats: { power: 6, grip: 5, rotation: 3, stability: 7, buns: 5 }, tune: { mass: 1180, inertia: 1850, a: 1.22, b: 1.4, torque: 285, mu: 1.14, bunDamp: 0.9 } },
  { id: 'pavlova', name: 'Pavlova', blurb: 'A pearl shooting brake from after the story: light, grippy and strong, with room in the back for a cake.', shape: 'brake', body: 0xeeeae6, trim: 0xa58bbd,
    rival: 'owl', stats: { power: 6, grip: 6, rotation: 5, stability: 6, buns: 6 }, tune: { mass: 1100, inertia: 1650, a: 1.18, b: 1.36, torque: 285, mu: 1.14, lsd: 0.5, bunDamp: 0.85 } },
];
export const CAR_IDS = CARS.map((c) => c.id);
export const carDef = (id: CarId | string | undefined) => CARS.find((c) => c.id === id) ?? CARS[0];
/** A car with parts fitted. */
export const carSpec = (id: CarId | undefined, upgrades: readonly string[] = []): CarSpec =>
  withUpgrades({ ...BASE, ratios: BASE.ratios.slice(), ...carDef(id).tune }, upgrades);

// ---------------------------------------------------------------- pace notes
export type Corner = { dir: 1 | -1; start: number; end: number; apex: number; radius: number; sev: number; tightens: boolean; opens: boolean; gutter: boolean; into: boolean };
export type Hazard = { s: number; kind: 'crest' | 'wide' | 'tunnel' | 'narrow' };
export type Note = { s: number; text: string[]; sev: number; dir: 1 | -1 | 0; kind: 'corner' | 'crest' | 'wide' | 'tunnel' | 'narrow' };

/** Rally-style severity from the corner's tightest radius: 0 is a hairpin, 1 the slowest numbered bend, 6 near flat. */
export const SEVERITY = [18, 30, 45, 65, 95, 140, 250];
export const severity = (r: number) => { for (let i = 0; i < SEVERITY.length; i++) if (r < SEVERITY[i]) return i; return 7; };

/** Corners and hazards read off the road's curvature and height. */
export function readRoad(t: Track): { corners: Corner[]; hazards: Hazard[] } {
  const corners: Corner[] = [];
  const TH = 1 / 260;
  let i = 0;
  const end = Math.floor(finishS(t));
  while (i < end) {
    if (Math.abs(t.k[i]) < TH) { i++; continue; }
    const dir = t.k[i] > 0 ? 1 : -1;
    let j = i;
    while (j < end && Math.sign(t.k[j]) === dir && Math.abs(t.k[j]) >= TH) j++;
    // merge with a following bend the same way after a tiny gap
    let tail = j;
    while (tail < end && tail - j < 12 && !(Math.sign(t.k[tail]) === dir && Math.abs(t.k[tail]) >= TH)) tail++;
    if (tail < end && tail - j < 12 && tail > j) { j = tail; while (j < end && Math.sign(t.k[j]) === dir && Math.abs(t.k[j]) >= TH) j++; }
    let minR = Infinity, apex = i;
    for (let q = i; q < j; q++) { const r = 1 / Math.abs(t.k[q]); if (r < minR) { minR = r; apex = q; } }
    const turned = Math.abs(t.h[j] - t.h[i]);
    if (turned > 0.17 && j - i > 6) {
      const mid = (i + j) >> 1;
      let r1 = Infinity, r2 = Infinity;
      for (let q = i; q < mid; q++) r1 = Math.min(r1, 1 / Math.abs(t.k[q]));
      for (let q = mid; q < j; q++) r2 = Math.min(r2, 1 / Math.abs(t.k[q]));
      let gut = false; for (let q = i; q < j; q++) if (t.gutter[q]) gut = true;
      corners.push({ dir: dir as 1 | -1, start: i * STEP, end: j * STEP, apex: apex * STEP, radius: Math.round(minR), sev: severity(minR),
        tightens: r2 < r1 * 0.72, opens: r1 < r2 * 0.72, gutter: gut, into: false });
    }
    i = j;
  }
  for (let c = 0; c + 1 < corners.length; c++) if (corners[c + 1].start - corners[c].end < 30) corners[c].into = true;
  const hazards: Hazard[] = [];
  for (let q = 20; q < end - 2; q++) {
    const kv = (t.grade[q + 1] - t.grade[q - 1]) / 2;
    if (kv < -0.0011 && !hazards.some((h) => h.kind === 'crest' && q * STEP - h.s < 60)) hazards.push({ s: q * STEP, kind: 'crest' });
    if (t.wide[q] && !t.wide[q - 1]) hazards.push({ s: q * STEP, kind: 'wide' });
    if (t.tunnel[q] && !t.tunnel[q - 1]) hazards.push({ s: q * STEP, kind: 'tunnel' });
  }
  return { corners, hazards };
}

const DIR = (d: number) => (d > 0 ? 'left' : 'right');
const Cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** How many seconds ahead Enzo calls a corner, and how long his shortest call distance is, per notebook level. */
export const NOTE_LEAD = [{ t: 0.7, min: 14 }, { t: 1.7, min: 30 }, { t: 2.5, min: 45 }, { t: 3.2, min: 60 }];
export const NOTE_LEVEL_RUNS = [0, 1, 2, 4]; // finished runs on a pass to reach each level
export const noteLevel = (runs: number) => (runs >= 4 ? 3 : runs >= 2 ? 2 : runs >= 1 ? 1 : 0);

/** Enzo's notes for a road at a notebook level. Level 0 is late and vague, 3 is early with numbers and hazards. */
export function paceNotes(t: Track, level: number): Note[] {
  const { corners, hazards } = readRoad(t);
  const notes: Note[] = [];
  const word = (c: Corner) => (c.sev === 0 ? `hairpin ${DIR(c.dir)}` : `${DIR(c.dir)} ${c.sev}`);
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i], next = corners[i + 1];
    let text: string[];
    if (level <= 0) {
      text = [c.sev <= 2 ? `Uh… a ${DIR(c.dir)}? Big one!` : `A little ${DIR(c.dir)}, I think!`];
    } else if (level === 1) {
      text = [c.sev === 0 ? `Hairpin ${DIR(c.dir)}!` : `${Cap(DIR(c.dir))}, ${c.sev <= 2 ? 'tight' : c.sev <= 4 ? 'medium' : 'fast'}!`];
    } else {
      const parts = [Cap(word(c))];
      if (c.tightens) parts.push('tightens!'); else if (c.opens) parts.push('opens');
      if (level >= 3 && c.gutter) parts.push('gutter!');
      if (c.into && next) parts.push(`into ${word(next)}`);
      text = [parts.join(c.into ? '… ' : ', ').replace(/, (into)/, '… $1')];
      if (level >= 3 && c.sev <= 2 && !c.into && c.end - c.start > 70) text.push('long');
    }
    notes.push({ s: c.start, text, sev: c.sev, dir: c.dir, kind: 'corner' });
    // a linked corner is already called with this one
    if (level >= 2 && c.into && next) { i++; if (level >= 3 && next.gutter) notes[notes.length - 1].text[0] += ', gutter!'; }
  }
  if (level >= 3) for (const h of hazards) {
    const text = h.kind === 'crest' ? 'Over crest, keep in!' : h.kind === 'wide' ? 'Road opens: pass here!' : h.kind === 'tunnel' ? 'Tunnel! Eyes up!' : 'Narrows!';
    notes.push({ s: h.s, text: [text], sev: 9, dir: 0, kind: h.kind });
  }
  notes.sort((a, b) => a.s - b.s);
  return notes;
}

// ---------------------------------------------------------------- the racing line the AI follows
export type Line = { off: Float64Array; v: Float64Array };
const lineCache = new Map<string, Line>();
/** Outside-inside-outside offsets and the speed the line can be driven at with a given grip and braking. */
export function racingLine(t: Track, mu: number, brakeG: number): Line {
  const key = `${t.id}${t.reversed}|${mu.toFixed(3)}|${brakeG.toFixed(3)}`;
  const hit = lineCache.get(key); if (hit) return hit;
  const n = t.n;
  const avg = (a: Float64Array, w: number) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = i - w; j <= i + w; j++) { if (j < 0 || j >= n) continue; s += a[j]; c++; } o[i] = s / c; } return o; };
  const kn = avg(t.k, 4), kw = avg(t.k, 30);
  const off0 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const want = 95 * (kn[i] - 0.72 * kw[i]);
    const lim = (want > 0 ? t.wl[i] : t.wr[i]) - (t.gutter[i] && Math.sign(want) === t.gutter[i] ? 0.45 : 1.15);
    off0[i] = Math.max(-lim, Math.min(lim, want));
  }
  const off = avg(off0, 6);
  // curvature of the line itself, from its points
  const px = new Float64Array(n), py = new Float64Array(n);
  for (let i = 0; i < n; i++) { px[i] = t.x[i] - Math.sin(t.h[i]) * off[i]; py[i] = t.y[i] + Math.cos(t.h[i]) * off[i]; }
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 5), b = Math.min(n - 1, i + 5);
    const ab = Math.hypot(px[i] - px[a], py[i] - py[a]), bc = Math.hypot(px[b] - px[i], py[b] - py[i]), ca = Math.hypot(px[a] - px[b], py[a] - py[b]);
    const area2 = Math.abs((px[i] - px[a]) * (py[b] - py[a]) - (py[i] - py[a]) * (px[b] - px[a]));
    const r = area2 < 1e-9 ? 1e9 : (ab * bc * ca) / (2 * area2);
    const gut = t.gutter[i] ? 1.3 : 1;
    v[i] = Math.min(58, Math.sqrt(mu * gut * G * r));
  }
  // braking: no point on the line may need more than brakeG of deceleration to reach the next
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * brakeG * G * STEP));
  const line = { off, v };
  lineCache.set(key, line);
  return line;
}

// ---------------------------------------------------------------- ghosts: inputs packed as run-length codes
export function encodeInput(i: Input) {
  return Math.round(i.steer * 16) + 16 + 33 * (Math.round(i.throttle * 4) + 5 * (Math.round(i.brake * 4) + 5 * ((i.hand ? 1 : 0) + 2 * ((i.up ? 1 : 0) + 2 * (i.down ? 1 : 0)))));
}
export function decodeInput(code: number, out: Input = idleInput()): Input {
  out.steer = ((code % 33) - 16) / 16 || 0; code = Math.floor(code / 33);
  out.throttle = (code % 5) / 4; code = Math.floor(code / 5);
  out.brake = (code % 5) / 4; code = Math.floor(code / 5);
  out.hand = code % 2 === 1; code = Math.floor(code / 2);
  out.up = code % 2 === 1; code = Math.floor(code / 2);
  out.down = code % 2 === 1;
  return out;
}
export function packGhost(codes: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < codes.length;) { let j = i; while (j < codes.length && codes[j] === codes[i]) j++; out.push(codes[i].toString(36) + (j - i > 1 ? '.' + (j - i).toString(36) : '')); i = j; }
  return out.join(',');
}
export function unpackGhost(s: string, max = 120 * 60 * 6): number[] | null {
  if (typeof s !== 'string' || !/^[0-9a-z.,]*$/.test(s)) return null;
  const out: number[] = [];
  for (const part of s.split(',')) {
    if (!part) continue;
    const [c, n] = part.split('.');
    const code = parseInt(c, 36), count = n ? parseInt(n, 36) : 1;
    if (!Number.isFinite(code) || !Number.isFinite(count) || count < 1 || code < 0 || code >= 6600) return null;
    for (let k = 0; k < count; k++) { out.push(code); if (out.length > max) return null; }
  }
  return out;
}

// ---------------------------------------------------------------- the race
export type RaceEvent =
  | { k: 'wall'; car: number; x: number; y: number; mag: number; side: number }
  | { k: 'scrape'; car: number; x: number; y: number }
  | { k: 'bump'; x: number; y: number; mag: number }
  | { k: 'note'; note: Note }
  | { k: 'shift'; car: number; up: boolean }
  | { k: 'hook'; car: number } | { k: 'hookSpin'; car: number }
  | { k: 'driftStart' } | { k: 'driftEnd'; meter: number; boost: boolean } | { k: 'driftBroken' }
  | { k: 'bun'; left: number } | { k: 'overtake'; by: number } | { k: 'reset'; car: number }
  | { k: 'finish'; car: number; time: number } | { k: 'go' } | { k: 'crash'; car: number }
  | { k: 'rider'; why: 'drift' | 'big' | 'hit' | 'slow'; mood: number };

export type RaceOpts = {
  pass: PassId; reversed?: boolean;
  /** solo: delivery or time attack; duel: against a rival */
  rival?: RivalId | null;
  role?: 'lead' | 'chase';
  upgrades?: readonly string[]; assist?: number; manual?: boolean;
  noteLevel?: number; seed?: number; buns?: boolean;
  ghost?: number[] | null;
  /** the car the ghost was recorded with (defaults to the player's) */
  ghostCar?: { up: readonly string[]; assist: number; manual: boolean; sharp?: boolean; car?: CarId } | null;
  /** which of the player's cars (the Biscuit by default) */
  car?: CarId;
  /** a side job: the fragile cake (needs buns on), the doctor's deadline, or Granny Bramble riding along */
  job?: JobId;
  /** Sharp steering: a quicker keyboard filter (Smooth is the default) */
  sharp?: boolean;
  /** the competent bot drives the player's car (tests) */
  autopilot?: number;
  /** with autopilot: Enzo's clean demo line, with no reaction lag, wander, off nights or mistakes */
  demo?: boolean;
  countdown?: number;
  /** override the player's car (calibration) */
  spec?: CarSpec;
};

export const BUNS = 12;
/** How close to the tyres' limit the racing line is driven. */
export const LINE_GRIP = 0.9;
/** Guardrails: speed scrubbed per m/s of impact, and the impact that spins the car round. */
export const WALL = { scrub: 0.085, spin: 8.5, wreck: 11, rub: 7 };
/** Seconds a wrecked or spun car sits before it is set back on the road. */
export const RECOVER = 1.4;
/** Enzo's demo line: the racing line driven cleanly (no lag, wander or mistakes) that drifts the tight corners without a
 * gutter to hook: a handbrake tap `entry` m before the corner, then throttle through the slide and out on the boost.
 * Per pass: the pace, the tightest radius it drifts (0: never), and the entry. Each is the fastest clean setting found
 * (no rails, no spins, every bun) that is also clean one step slower, so a small handling change doesn't tip it over. */
export const DEMO = { brake: 0.88, hand: 0.3, throttle: 0.6, pass: {
  cedar: { pace: 0.975, drift: 25, entry: 9 }, lake: { pace: 0.945, drift: 60, entry: 9 }, stairs: { pace: 0.945, drift: 25, entry: 9 },
  fog: { pace: 1.005, drift: 0, entry: 9 }, tunnel: { pace: 0.96, drift: 45, entry: 9 }, summit: { pace: 0.95, drift: 60, entry: 4 },
} as Record<PassId, { pace: number; drift: number; entry: number }> };
/** The autopilot's chance per corner of a small error, so seeded runs differ. */
export const BOT_SLIP = 0.06;
/** How much a driver's pace varies night to night (a seeded ±half of this). */
export const FORM = 0.04;
export const DUEL_GAP = 1.0; // seconds: lead by more than this at the line to take a lead round
export const DROP_GAP = 3.0; // seconds: a chaser this far behind has dropped and the round is over
export const DRIFT = { minAngle: 0.14, minSpeed: 9, fill: 0.42, boostMin: 0.25, boostSecs: 1.6, boostMul: 1.22 };

type Racer = {
  car: Car; w: Where; idx: number; s: number; finished: number; lane: number;
  marks: Float32Array; stuck: number; resets: number; crashed: boolean;
  ai: { pace: number; brake: number; block: number; slipUntil: number; slipOff: number; nextCorner: number; human?: Human; dc?: number } | null;
  hookCool: number; gripT: number; gripV: number; wallT: number; scrapeT: number; hold: number;
};

const MARK = 4; // metres between gap marks
/** The autopilot's human side: what it decided REACTION seconds ago, and a slow wander off the ideal line. */
type Human = { buf: Float32Array; at: number; ph: [number, number, number] };
/** The competent bot drives like a person: it acts this many seconds late, wanders this far off the line (m). */
export const HUMAN = { reaction: 0.2, wander: 0.4 };
type DriftState = { drift: number; drifting: boolean; driftHold: number; driftScore: number; driftClean: boolean };

export class Race {
  track: Track; opts: RaceOpts; racers: Racer[] = []; ghost: Racer | null = null;
  t = -3; step = 0; events: RaceEvent[] = []; done = false; notes: Note[]; noteIdx = 0; lastNote: Note | null = null;
  buns = BUNS; wobble = 0; drift = 0; drifting = false; driftHold = 0; driftScore = 0; driftClean = true;
  inputs: number[] = []; rs = 0; leaderIdx = 0; passed = false; overtakes = 0;
  result: RoundResult | null = null; hits = 0;
  /** Granny Bramble's mood, 0..100 (rider job) */
  mood = JOB.rider.start;
  private rand: () => number; private gIn = idleInput(); private qIn = idleInput(); private aiIn = idleInput(); private tmp: Where = { i: 0, s: 0, d: 0, px: 0, py: 0 };
  readonly finishS: number; readonly fogLevel: number; readonly dark: boolean;

  constructor(opts: RaceOpts) {
    this.opts = opts;
    this.track = getTrack(opts.pass, !!opts.reversed);
    this.rand = rng(opts.seed ?? 1);
    this.finishS = finishS(this.track);
    this.fogLevel = this.track.def.fog; this.dark = this.track.def.dark;
    if (opts.job === 'cake') this.buns = 1;
    this.t = -(opts.countdown ?? 3);
    const spec = opts.spec ?? carSpec(opts.car, opts.upgrades ?? []);
    const lead = opts.role !== 'chase';
    const pS = opts.rival ? (lead ? START_S + 9 : START_S) : START_S;
    this.racers.push(this.makeRacer(spec, pS, 0, opts.manual ? false : true, opts.assist ?? ASSIST.strong, null, opts.sharp ? 'sharp' : 'smooth'));
    if (opts.rival) {
      const r = rival(opts.rival);
      // each night a driver's form varies a little (seeded): this is the only thing that changes between seeds
      const form = 1 + (this.rand() - 0.5) * FORM;
      const nerves = (1 - r.fog * this.fogLevel - r.dark * (this.dark ? 1 : 0)) * form;
      this.racers.push(this.makeRacer(rivalSpec(opts.rival), lead ? START_S : START_S + 9, 0, true, 0.6, // rivals steer smoothly by themselves and grip-drive
        { pace: r.pace * nerves, brake: r.brake * (1 - r.fog * this.fogLevel * 1.5), block: r.block, slipUntil: -1, slipOff: 0, nextCorner: 0 }, 'none'));
      this.leaderIdx = lead ? 0 : 1;
    }
    if (opts.ghost) {
      const gc = opts.ghostCar;
      this.ghost = gc ? this.makeRacer(carSpec(gc.car, gc.up), START_S, 0, !gc.manual, gc.assist, null, gc.sharp ? 'sharp' : 'smooth') : this.makeRacer(spec, START_S, 0, opts.manual ? false : true, opts.assist ?? ASSIST.strong, null, opts.sharp ? 'sharp' : 'smooth');
    }
    this.notes = paceNotes(this.track, opts.noteLevel ?? 0);
    this.corners = readRoad(this.track).corners;
  }
  corners: Corner[];

  private makeRacer(spec: CarSpec, s: number, d: number, auto: boolean, assist: number, ai: Racer['ai'], steer: SteerMode): Racer {
    const t = this.track, i = at(t, s);
    const x = t.x[i] - Math.sin(t.h[i]) * d, y = t.y[i] + Math.cos(t.h[i]) * d;
    const car = makeCar(spec, x, y, t.h[i], auto, assist, steer);
    return { car, w: { i, s, d, px: 0, py: 0 }, idx: i, s, finished: -1, lane: d, marks: new Float32Array(Math.ceil(t.len / MARK) + 2).fill(-1),
      stuck: 0, resets: 0, crashed: false, ai, hookCool: 0, gripT: 0, gripV: 1, wallT: 0, scrapeT: 0, hold: 0 };
  }

  get player() { return this.racers[0]; }
  get rival() { return this.racers[1] ?? null; }

  /** Advance one fixed step with the player's input. */
  tick(input: Input) {
    this.events.length = 0;
    if (this.done) return;
    const q = quantise(input, this.qIn);
    if (this.t < 0) {
      // countdown: engines rev, cars hold still
      this.t += DT; this.step++;
      const p = this.player.car; p.rpm += ((p.spec.idle + q.throttle * 5200) - p.rpm) * 0.08;
      if (this.t >= 0) { this.t = 0; this.events.push({ k: 'go' }); }
      return;
    }
    if (this.opts.autopilot) this.drive(0, this.aiIn, this.opts.autopilot), quantise(this.aiIn, q);
    if (this.player.finished < 0 && !this.player.crashed) this.inputs.push(encodeInput(q));
    for (let i = 0; i < this.racers.length; i++) {
      const r = this.racers[i];
      let inp: Input = q;
      if (this.held(r)) continue;
      if (r.finished >= 0 || r.crashed) { inp = this.aiIn; this.coast(r, inp); }
      else if (i > 0) { this.drive(i, this.aiIn, 0); inp = quantise(this.aiIn, this.aiIn); }
      this.move(r, i, inp);
    }
    if (this.ghost && this.opts.ghost) {
      const code = this.opts.ghost[this.rs];
      if (code !== undefined && this.ghost.finished < 0 && !this.held(this.ghost)) { decodeInput(code, this.gIn); this.move(this.ghost, -1, this.gIn); }
    }
    if (this.racers.length > 1) this.collideCars(this.racers[0], this.racers[1]);
    this.t += DT; this.step++; this.rs++;
    this.afterStep();
  }

  /** A wrecked car waits a moment before it is put back on the road. */
  private held(r: Racer) {
    if (r.hold <= 0) return false;
    r.hold -= DT;
    if (r.hold <= 0) { this.place(r); return false; }
    r.car.u = 0; r.car.v = 0; r.car.r = 0;
    return true;
  }

  /** Inputs for a car that has finished: lift and roll to a stop. */
  private coast(r: Racer, out: Input) { out.steer = 0; out.throttle = 0; out.brake = r.car.u > 2 ? 0.5 : 0; out.hand = false; out.up = false; out.down = false; void r; }

  private move(r: Racer, idx: number, inp: Input) {
    const t = this.track, c = r.car;
    const i = r.idx;
    // road effects: slope along the heading, light crests, gutter hooks
    const dh = c.h - t.h[i], along = Math.cos(dh);
    const kv = i > 0 && i < t.n - 1 ? (t.grade[i + 1] - t.grade[i - 1]) / 2 : 0;
    let grip = Math.max(0.5, Math.min(1.2, 1 + (c.u * c.u * kv) / G));
    r.hookCool = Math.max(0, r.hookCool - DT);
    if (r.gripT > 0) { r.gripT -= DT; grip *= r.gripV; }
    const side = t.gutter[i];
    const half = side === 1 ? t.wl[i] - GUTTER : side === -1 ? t.wr[i] - GUTTER : 0;
    c.hooked = 0;
    if (side && r.w.d * side > half - 0.75) {
      const beta = Math.abs(slipAngle(c));
      if (r.hookCool === 0 && (beta > 0.38 || c.u > 17.5)) {
        // a mistimed hook: the wheels trip in the drain and the car snaps round
        c.r += side * (1.4 + Math.min(1.5, (c.u - 14) * 0.15)); r.gripT = 0.55; r.gripV = 0.55; r.hookCool = 1.2;
        if (idx >= 0) this.events.push({ k: 'hookSpin', car: idx });
      } else if (r.gripT <= 0 || r.gripV > 1) {
        c.hooked = 1; grip *= 1.45;
        if (r.hookCool === 0) { r.hookCool = 1.0; r.gripT = 0.25; r.gripV = 1.2; if (idx >= 0) this.events.push({ k: 'hook', car: idx }); }
      }
    }
    c.grip = grip;
    const isPlayer = idx === 0;
    const shifted = stepCar(c, inp, { grade: t.grade[i] * along, gripMul: grip, boostMul: DRIFT.boostMul });
    if (shifted && idx >= 0) this.events.push({ k: 'shift', car: idx, up: shifted > 0 });
    // where is it now
    locate(t, c.x, c.y, r.idx, r.w);
    r.idx = r.w.i; r.s = r.w.s;
    this.walls(r, idx);
    // gap marks
    const m = Math.floor(r.s / MARK);
    for (let k = m; k >= 0 && r.marks[k] < 0; k--) r.marks[k] = this.t;
    // finish
    if (r.finished < 0 && r.s >= this.finishS) {
      r.finished = this.t;
      if (idx >= 0) this.events.push({ k: 'finish', car: idx, time: this.t });
    }
    // spun or stuck: after a moment, put the car back on the road
    const speed = Math.hypot(c.u, c.v), wrong = Math.cos(c.h - t.h[r.idx]) < -0.2;
    if (r.finished < 0 && this.t > 2 && (speed < 1.5 || wrong || Math.abs(slipAngle(c)) > 1.5)) r.stuck += DT; else r.stuck = Math.max(0, r.stuck - DT * 2);
    if (r.stuck > (wrong ? 1.6 : 2.2)) this.reset(r, idx);
    if (isPlayer) this.playerExtras(r);
    else if (idx === -1) this.meter(this.ghostDrift, r, false);
  }

  private walls(r: Racer, idx: number) {
    const t = this.track, c = r.car, i = r.idx;
    const dh = c.h - t.h[i], sd = Math.sin(dh), cd = Math.cos(dh);
    let maxL = -Infinity, maxR = -Infinity, lxL = 0, lxR = 0;
    for (let k = 0; k < 4; k++) {
      const lx = k < 2 ? 1.95 : -1.95, ly = k % 2 ? 0.85 : -0.85;
      const d = r.w.d + lx * sd + ly * cd;
      if (d - t.wl[i] > maxL) { maxL = d - t.wl[i]; lxL = lx; }
      if (-d - t.wr[i] > maxR) { maxR = -d - t.wr[i]; lxR = lx; }
    }
    r.wallT = Math.max(0, r.wallT - DT); r.scrapeT = Math.max(0, r.scrapeT - DT);
    for (const [pen, side, lx] of [[maxL, 1, lxL], [maxR, -1, lxR]] as const) {
      if (pen <= 0) continue;
      const nx = -Math.sin(t.h[i]) * side, ny = Math.cos(t.h[i]) * side; // toward this wall
      c.x -= nx * pen; c.y -= ny * pen; r.w.d -= side * pen;
      const { vx, vy } = worldVel(c);
      const vn = vx * nx + vy * ny;
      if (vn > 0) {
        const tx = -ny, ty = nx, vt = vx * tx + vy * ty;
        // a guardrail costs a lot of speed: the harder the hit, the more it scrubs, and a big one spins you
        const scrub = 1 - Math.min(0.75, WALL.scrub * vn);
        const vn2 = -vn * 0.28;
        setWorldVel(c, nx * vn2 + tx * vt * scrub, ny * vn2 + ty * vt * scrub);
        c.r = c.r * 0.6 - Math.sign(lx) * side * Math.min(2.4, vn * 0.12);
        if (vn > WALL.spin) { r.gripT = 0.9; r.gripV = 0.5; c.r += -Math.sign(lx || 1) * side * 1.6; }
        if (vn > WALL.wreck) { r.stuck = 99; }
        if (vn > 1.2 && r.wallT === 0) {
          r.wallT = 0.25;
          if (idx >= 0) this.events.push({ k: 'wall', car: idx, x: c.x + nx * 1, y: c.y + ny * 1, mag: vn, side });
          if (idx === 0) { this.hits++; this.hitBuns(vn); this.breakDrift(); this.riderMood('hit', -(JOB.rider.hit + vn)); }
          if (idx === -1) this.breakGhostDrift();
        }
      }
      // rubbing along the rail drags the car back
      { const sp = Math.hypot(c.u, c.v); if (sp > 1) { const k = Math.max(0, sp - WALL.rub * DT) / sp; c.u *= k; c.v *= k; } }
      if (r.scrapeT === 0 && Math.hypot(c.u, c.v) > 4 && idx >= 0) { r.scrapeT = 0.06; this.events.push({ k: 'scrape', car: idx, x: c.x + nx * 0.9, y: c.y + ny * 0.9 }); if (idx === 0) this.breakDrift(); }
      if (idx === -1 && r.scrapeT === 0 && Math.hypot(c.u, c.v) > 4) { r.scrapeT = 0.06; this.breakGhostDrift(); }
    }
  }

  private collideCars(a: Racer, b: Racer) {
    // two circles per car, front and rear
    for (const fa of [1.15, -1.15]) for (const fb of [1.15, -1.15]) {
      const ax = a.car.x + Math.cos(a.car.h) * fa, ay = a.car.y + Math.sin(a.car.h) * fa;
      const bx = b.car.x + Math.cos(b.car.h) * fb, by = b.car.y + Math.sin(b.car.h) * fb;
      const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), R = 1.9;
      if (d >= R || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, pen = R - d;
      a.car.x -= nx * pen / 2; a.car.y -= ny * pen / 2; b.car.x += nx * pen / 2; b.car.y += ny * pen / 2;
      const va = worldVel(a.car), vb = worldVel(b.car);
      const rel = (vb.vx - va.vx) * nx + (vb.vy - va.vy) * ny;
      if (rel < 0) {
        const j = -rel * 0.65;
        setWorldVel(a.car, va.vx - nx * j, va.vy - ny * j); setWorldVel(b.car, vb.vx + nx * j, vb.vy + ny * j);
        a.car.r += -Math.sign(fa) * 0.05 * j * Math.sign(nx * -Math.sin(a.car.h) + ny * Math.cos(a.car.h));
        b.car.r += Math.sign(fb) * 0.05 * j * Math.sign(nx * -Math.sin(b.car.h) + ny * Math.cos(b.car.h));
        if (-rel > 1) { this.events.push({ k: 'bump', x: (ax + bx) / 2, y: (ay + by) / 2, mag: -rel }); this.hitBuns(-rel * 0.7); this.breakDrift(); }
      }
    }
  }

  /** A wreck or a spin: the car stops where it is for a moment, then is set back on the road. */
  private reset(r: Racer, idx: number) {
    r.stuck = 0; r.resets++; r.hold = RECOVER;
    r.car.u = 0; r.car.v = 0; r.car.r = 0; r.car.boost = 0;
    if (idx >= 0) this.events.push({ k: 'reset', car: idx });
    if (idx === 0) { this.breakDrift(); this.hitBuns(6); }
    if (idx === -1) this.breakGhostDrift();
    if (this.racers.length > 1 && idx >= 0 && !r.crashed) { r.crashed = true; this.events.push({ k: 'crash', car: idx }); }
  }

  private place(r: Racer) {
    const t = this.track, i = r.idx, c = r.car;
    c.x = t.x[i]; c.y = t.y[i]; c.h = t.h[i]; c.u = 4; c.v = 0; c.r = 0; c.delta = 0; c.gear = 1; c.boost = 0; r.w.d = 0; r.hold = 0;
  }

  // ---- the player's drift meter, boost, buns and Enzo's notes
  private riderMood(why: 'drift' | 'big' | 'hit', by: number) {
    if (this.opts.job !== 'rider' || this.player.finished >= 0) return;
    this.mood = Math.max(0, Math.min(100, this.mood + by)); this.events.push({ k: 'rider', why, mood: this.mood });
  }
  private breakDrift() { if (this.drifting) { this.drifting = false; this.events.push({ k: 'driftBroken' }); } this.drift = 0; this.driftClean = false; }
  private hitBuns(mag: number) {
    if (!this.opts.buns || this.buns <= 0) return;
    if (this.opts.job === 'cake') { if (mag > JOB.cake.knock) { this.buns = 0; this.events.push({ k: 'bun', left: 0 }); } return; }
    const lost = Math.min(this.buns, Math.floor(Math.max(0, mag - 3) / 3.2) + (mag > 5.5 ? 1 : 0));
    if (lost > 0) { this.buns -= lost; this.events.push({ k: 'bun', left: this.buns }); }
  }
  /** The drift meter and its boost: the player's lives on the race, the ghost keeps its own so a replay matches. */
  private meter(st: DriftState, r: Racer, events: boolean) {
    const c = r.car, beta = Math.abs(slipAngle(c)), speed = Math.hypot(c.u, c.v);
    const sliding = beta > DRIFT.minAngle && beta < 1.2 && speed > DRIFT.minSpeed && r.finished < 0;
    if (sliding) {
      if (!st.drifting) { st.drifting = true; st.driftClean = true; if (events) this.events.push({ k: 'driftStart' }); }
      st.driftHold = 0;
      st.drift = Math.min(1, st.drift + DT * DRIFT.fill * Math.min(1.6, beta / 0.35));
      st.driftScore += DT * speed * beta * 10;
    } else if (st.drifting) {
      st.driftHold += DT;
      if (st.driftHold > 0.22) {
        st.drifting = false;
        const boost = st.drift >= DRIFT.boostMin && st.driftClean;
        if (boost) c.boost = Math.max(c.boost, DRIFT.boostSecs * st.drift);
        if (events) this.events.push({ k: 'driftEnd', meter: st.drift, boost });
        if (events && boost) this.riderMood(st.drift > 0.8 ? 'big' : 'drift', JOB.rider.drift * (0.5 + st.drift));
        st.drift = 0;
      }
    }
  }
  private ghostDrift: DriftState = { drift: 0, drifting: false, driftHold: 0, driftScore: 0, driftClean: true };
  private breakGhostDrift() { const g = this.ghostDrift; g.drifting = false; g.drift = 0; g.driftClean = false; }
  private playerExtras(r: Racer) {
    const c = r.car, speed = Math.hypot(c.u, c.v);
    this.meter(this, r, true);
    // the bun tray wobbles with hard cornering and braking
    if (this.opts.buns && this.buns > 0) {
      const g = Math.hypot(c.ax, c.ay) / G, cake = this.opts.job === 'cake';
      const [over, gain, calm] = cake ? [JOB.cake.over, JOB.cake.gain, JOB.cake.calm] : [0.9, 1.1, 0.22];
      this.wobble += (Math.max(0, g - over) * gain * c.spec.bunDamp - calm) * DT;
      this.wobble = Math.max(0, this.wobble);
      if (this.wobble >= 1) { this.wobble = 0.35; this.buns--; this.events.push({ k: 'bun', left: this.buns }); }
    }
    // Granny Bramble gets bored below a brisk pace
    if (this.opts.job === 'rider' && this.t > 3 && r.finished < 0 && speed < JOB.rider.slowSpeed) {
      const was = this.mood; this.mood = Math.max(0, this.mood - JOB.rider.slow * DT);
      if (Math.floor(was / 10) !== Math.floor(this.mood / 10)) this.events.push({ k: 'rider', why: 'slow', mood: this.mood });
    }
    // pace notes: called a little ahead, further ahead the better the notebook
    const lead = NOTE_LEAD[Math.max(0, Math.min(3, this.opts.noteLevel ?? 0))];
    const ahead = Math.max(lead.min, speed * lead.t);
    while (this.noteIdx < this.notes.length && this.notes[this.noteIdx].s - ahead <= r.s) {
      const n = this.notes[this.noteIdx++];
      if (n.s > r.s - 5) { this.lastNote = n; this.events.push({ k: 'note', note: n }); }
    }
  }

  private afterStep() {
    if (this.racers.length < 2) {
      if (this.player.finished >= 0 && !this.done) { this.done = true; this.result = { winner: 0, reason: 'solo', gap: 0, time: this.player.finished }; }
      return;
    }
    const [p, q] = this.racers;
    // who is ahead
    const ahead = p.s >= q.s ? 0 : 1;
    if (ahead !== this.leaderIdx && Math.abs(p.s - q.s) > 3) {
      // a pass: it counts once the cars are clear of each other
      this.leaderIdx = ahead; this.overtakes++; this.passed = true;
      this.events.push({ k: 'overtake', by: ahead });
    }
    if (this.done) return;
    const lead = this.opts.role !== 'chase' ? 0 : 1; // who started in front
    const chase = 1 - lead;
    const R = this.racers;
    if (R[0].crashed || R[1].crashed) {
      const w = R[0].crashed && R[1].crashed ? -1 : R[0].crashed ? 1 : 0;
      this.end({ winner: w as 0 | 1 | -1, reason: 'crash', gap: 0, time: this.t });
      return;
    }
    const fl = R[lead].finished, fc = R[chase].finished;
    if (fl >= 0 && fc >= 0) {
      if (fc < fl) this.end({ winner: chase as 0 | 1, reason: 'passed', gap: fl - fc, time: this.t });
      else if (fc - fl > DUEL_GAP) this.end({ winner: lead as 0 | 1, reason: 'pulled-away', gap: fc - fl, time: this.t });
      else this.end({ winner: -1, reason: 'held', gap: fc - fl, time: this.t });
    } else if (fl >= 0 && this.t - fl > DUEL_GAP) {
      this.end({ winner: lead as 0 | 1, reason: 'pulled-away', gap: this.t - fl, time: this.t });
    } else if (fc >= 0 && fl < 0) {
      this.end({ winner: chase as 0 | 1, reason: 'passed', gap: this.t - fc, time: this.t });
    } else if (this.gapOf(chase) > DROP_GAP + 2) {
      // the chaser has fallen hopelessly behind: no need to drive the rest
      this.end({ winner: lead as 0 | 1, reason: 'dropped', gap: this.gapOf(chase), time: this.t });
    }
  }
  private end(r: RoundResult) { this.done = true; this.result = r; }

  /** Seconds the given car is behind the other (negative when it is ahead). */
  gapOf(idx: number): number {
    if (this.racers.length < 2) return 0;
    const me = this.racers[idx], them = this.racers[1 - idx];
    if (me.s <= them.s) {
      const k = Math.floor(me.s / MARK), tm = them.marks[k];
      return tm < 0 ? 0 : Math.max(0, this.t - tm);
    }
    const k = Math.floor(them.s / MARK), tm = me.marks[k];
    return tm < 0 ? 0 : -Math.max(0, this.t - tm);
  }

  // ---- the AI driver: pure pursuit on the racing line, target speeds from the line, a personality on top
  drive(idx: number, out: Input, pace: number) {
    const r = this.racers[idx], c = r.car, t = this.track;
    if (!r.ai && idx === 0 && this.opts.demo) r.ai = { pace, brake: DEMO.brake, block: 0, slipUntil: -1, slipOff: 0, nextCorner: Infinity };
    if (!r.ai) {
      const n = Math.max(1, Math.round(HUMAN.reaction / DT));
      r.ai = { pace: pace * (1 + (this.rand() - 0.5) * FORM), brake: 0.95, block: 0.4, slipUntil: -1, slipOff: 0, nextCorner: 0,
        human: { buf: new Float32Array(n * 3), at: 0, ph: [this.rand() * 6.3, this.rand() * 6.3, this.rand() * 6.3] } };
    }
    const ai = r.ai, hu = ai.human;
    const line = racingLine(t, c.spec.mu * LINE_GRIP, ai.brake * c.spec.brake * 0.92);
    const speed = Math.max(0, c.u);
    // personality: an occasional small error going into a corner (seeded)
    if (ai.nextCorner < this.corners.length && r.s > this.corners[ai.nextCorner].start - 30) {
      const chance = idx === 0 ? BOT_SLIP : rival(this.opts.rival!).slip;
      if (this.rand() < chance) { ai.slipUntil = this.corners[ai.nextCorner].end; ai.slipOff = (this.rand() < 0.5 ? -1 : 1) * 0.9; }
      ai.nextCorner++;
    }
    const look = 4.5 + speed * (0.32 + (hu ? HUMAN.reaction : 0)); // a person reads ahead to make up for reacting late
    const j = at(t, r.s + look);
    let off = line.off[j];
    if (r.s < ai.slipUntil) off += ai.slipOff;
    // a person never quite holds the ideal line: a slow seeded wander either side of it
    if (hu) off += HUMAN.wander * (Math.sin(r.s / 37 + hu.ph[0]) * 0.6 + Math.sin(r.s / 13 + hu.ph[1]) * 0.4);
    // racecraft against the other car
    if (this.racers.length > 1) {
      const o = this.racers[1 - idx], gapM = o.s - r.s;
      if (gapM < 0 && gapM > -30 && ai.block > 0) {
        // leading: drift the line over to cover the follower's side
        off += (o.w.d - off) * ai.block * 0.55 * (t.wide[j] ? 1 : 0.6);
      } else if (gapM > 0 && gapM < 14) {
        // following: in a passing place, go round; otherwise don't run into the back of them
        if (t.wide[j] || o.car.u < 6) off = o.w.d > 0 ? -t.wr[j] + 1.4 : t.wl[j] - 1.4;
      }
    }
    off = Math.max(-t.wr[j] + 1.0, Math.min(t.wl[j] - 1.0, off));
    const tx = t.x[j] - Math.sin(t.h[j]) * off, ty = t.y[j] + Math.cos(t.h[j]) * off;
    // a person steers for where the car will be when their hands catch up: the pose a reaction time ahead
    const pt = hu ? HUMAN.reaction : 0, wv = worldVel(c), ph = c.h + c.r * pt;
    const dx = tx - (c.x + wv.vx * pt), dy = ty - (c.y + wv.vy * pt), ch = Math.cos(ph), sh = Math.sin(ph);
    const lx = dx * ch + dy * sh, ly = -dx * sh + dy * ch, d2 = lx * lx + ly * ly;
    const curv = (2 * ly) / Math.max(4, d2);
    const L = c.spec.a + c.spec.b;
    const want = Math.atan(L * curv);
    const lock = steerLock(c.spec, c.u);
    out.steer = Math.max(-1, Math.min(1, want / lock));
    // speed
    const vi = at(t, r.s + Math.min(6, speed * 0.12) + speed * (hu ? HUMAN.reaction : 0));
    let vt = line.v[vi] * ai.pace;
    const dc = idx === 0 && this.opts.demo ? this.demoCorner(r) : null;
    if (r.s < ai.slipUntil) vt *= 0.94;
    if (this.racers.length > 1) {
      const o = this.racers[1 - idx], gapM = o.s - r.s;
      // don't rear-end the leader on the narrow road
      if (gapM > 0 && gapM < 9 && !t.wide[j] && c.u > o.car.u && o.car.u > 6) vt = Math.min(vt, o.car.u - 0.5);
      else if (gapM > 0 && gapM < 14 && o.car.u <= 6) vt = Math.min(vt, 9); // creep past a stopped car
    }
    const beta = Math.abs(slipAngle(c));
    if (speed > vt + 0.25) { out.throttle = 0; out.brake = Math.min(1, (speed - vt) * 0.7 + 0.3); }
    else { out.brake = 0; out.throttle = Math.max(0, Math.min(1, (vt - speed) * 0.8 + 0.3)); }
    if (beta > 0.22 && !dc) out.throttle *= 0.4; // AI drivers grip-drive: catch a slide instead of feeding it
    out.hand = false; out.up = false; out.down = false;
    if (dc) {
      // Enzo's line drifts the tight corners: a handbrake tap at turn-in, then throttle to hold it round and boost out
      const k = r.s - (dc.start - DEMO.pass[this.opts.pass].entry);
      if (k >= 0 && k < DEMO.hand * Math.max(speed, 1) && speed > 12) { out.hand = true; out.brake = 0; }
      else if (beta > 0.1 && out.brake < 0.5) { out.brake = 0; out.throttle = Math.max(out.throttle, DEMO.throttle); }
    }
    if (hu) {
      // reaction time: what comes out now is what it decided a quarter of a second ago
      const b = hu.buf, k = hu.at * 3;
      const st = b[k], th = b[k + 1], br = b[k + 2];
      b[k] = out.steer; b[k + 1] = out.throttle; b[k + 2] = out.brake;
      hu.at = (hu.at + 1) % (b.length / 3);
      out.steer = st; out.throttle = th; out.brake = br;
    }
  }

  /** The tight corner (no gutter to hook) Enzo's demo line is drifting, or about to. */
  private demoCorner(r: Racer): Corner | null {
    const ai = r.ai!, cs = this.corners;
    if (ai.dc === undefined) ai.dc = 0;
    while (ai.dc < cs.length && cs[ai.dc].end < r.s) ai.dc++;
    const c = cs[ai.dc];
    const d = DEMO.pass[this.opts.pass];
    return c && c.radius < d.drift && !c.gutter && r.s > c.start - d.entry ? c : null;
  }

  /** The time the player has been running (0 before the start). */
  get time() { return Math.max(0, this.t); }
}

/** Enzo's line on a pass as ghost inputs, and its time: the demo run (stock Biscuit, Strong assist), recorded. */
export function enzoGhost(pass: PassId): { inputs: number[]; time: number } {
  const r = new Race({ pass, autopilot: DEMO.pass[pass].pace, demo: true, noteLevel: 3, seed: 3 });
  for (let n = 0; !r.done && n < 120 * 300; n++) r.tick(idleInput());
  return { inputs: r.inputs, time: r.player.finished };
}
/** The car Enzo's line is driven in, for replaying it as a ghost. */
export const ENZO_CAR = { up: [] as string[], assist: ASSIST.strong, manual: false, sharp: false, car: 'biscuit' as CarId };

// ---------------------------------------------------------------- duels: lead, chase, sudden death
export type RoundResult = { winner: 0 | 1 | -1; reason: 'pulled-away' | 'passed' | 'held' | 'crash' | 'dropped' | 'solo'; gap: number; time: number };
export type DuelOpts = Omit<RaceOpts, 'role' | 'pass' | 'reversed'> & { rival: RivalId; relay?: boolean };
export const MAX_ROUNDS = 6;

export class Duel {
  rounds: { role: 'lead' | 'chase'; result: RoundResult }[] = [];
  winner: 0 | 1 | -1 = -1; over = false; race!: Race;
  constructor(public opts: DuelOpts) { this.startRound(); }
  get pass(): PassId { return this.opts.relay ? 'summit' : rival(this.opts.rival).pass; }
  /** The relay's first round is the uphill leg (Enzo drives); every later round runs down. */
  reversedFor(round: number) { return !!this.opts.relay && round === 0; }
  roleFor(round: number): 'lead' | 'chase' { return round % 2 === 0 ? 'lead' : 'chase'; }
  get round() { return this.rounds.length; }
  get suddenDeath() { return this.rounds.length >= 2; }
  startRound() {
    const n = this.rounds.length;
    this.race = new Race({ ...this.opts, pass: this.pass, reversed: this.reversedFor(n), role: this.roleFor(n), seed: (this.opts.seed ?? 1) * 31 + n * 7 });
  }
  /** Record the finished round and decide the match if it is decided. Returns true when the match is over. */
  finishRound(): boolean {
    const res = this.race.result; if (!res) return false;
    this.rounds.push({ role: this.roleFor(this.rounds.length), result: res });
    const decided = duelOutcome(this.rounds.map((r) => r.result));
    if (decided !== null) { this.winner = decided; this.over = true; }
    return this.over;
  }
  score(): [number, number] { let a = 0, b = 0; for (const r of this.rounds) { if (r.result.winner === 0) a++; else if (r.result.winner === 1) b++; } return [a, b]; }
}

/**
 * The touge rules on a list of round results (player is 0). After two rounds, more round wins takes the match. Level
 * after two: sudden death, where the first round won outright ends it. After MAX_ROUNDS it goes to the total gap.
 */
export function duelOutcome(results: RoundResult[]): 0 | 1 | null {
  if (results.length < 2) return null;
  let a = 0, b = 0;
  for (const r of results.slice(0, 2)) { if (r.winner === 0) a++; else if (r.winner === 1) b++; }
  if (a !== b) return a > b ? 0 : 1;
  for (const r of results.slice(2)) if (r.winner !== -1) return r.winner;
  if (results.length >= MAX_ROUNDS) {
    // still level: whoever finished ahead overall on the held rounds
    let sum = 0; results.forEach((r, i) => { const playerLed = i % 2 === 0; sum += (playerLed ? 1 : -1) * r.gap; });
    return sum >= 0 ? 0 : 1;
  }
  return null;
}

// ---------------------------------------------------------------- medals for deliveries, from the bot's real runs
/** The competent bot's delivery time on each pass (seconds), measured by tests/pass-bot.mjs. */
export const BOT_TIMES: Record<PassId, number> = { cedar: 65.57, lake: 55.14, stairs: 67.79, fog: 57.07, tunnel: 54.23, summit: 82.38 };
export const MEDAL_FACTORS = [1.03, 1.16, 1.4]; // gold, silver, bronze: slower than the bot by this factor
export const MEDAL_BUNS = [11, 7, 4];
export function medalTimes(id: PassId) { return MEDAL_FACTORS.map((f) => Math.round(BOT_TIMES[id] * f * 10) / 10); }
/** 3 gold, 2 silver, 1 bronze, 0 none. */
export function deliveryMedal(id: PassId, time: number, buns: number) {
  const ts = medalTimes(id);
  for (let m = 0; m < 3; m++) if (time <= ts[m] && buns >= MEDAL_BUNS[m]) return 3 - m;
  return 0;
}
export function deliveryCoins(medal: number, buns: number) { return buns * 2 + [0, 10, 20, 35][medal]; }
// ---------------------------------------------------------------- side jobs
export type JobId = 'cake' | 'doctor' | 'rider';
/** Side job tuning. cake: wobble over `over` g at `gain`, settling at `calm`, and a rail knock over `knock` m/s breaks it.
 *  doctor: the deadline is the bot's time times `deadline`. rider: mood starts at `start`, a clean drift adds up to
 *  1.5 × `drift`, a rail hit takes `hit` plus the impact speed, and every second under `slowSpeed` m/s takes `slow`. */
export const JOB = {
  cake: { over: 0.8, gain: 1.5, calm: 0.2, knock: 5.5, pay: 60 },
  doctor: { deadline: 1.08, pay: 50 },
  rider: { start: 50, drift: 8, hit: 6, slow: 6, slowSpeed: 7, happy: 60, pay: 30 },
  firstBonus: 40,
};
export const JOBS: { id: JobId; name: string; icon: string; blurb: string }[] = [
  { id: 'cake', name: 'The wedding cake', icon: '🎂', blurb: 'One tall cake for the summit inn. It wobbles at a hard corner and breaks on any knock.' },
  { id: 'doctor', name: 'The doctor\'s run', icon: '🩺', blurb: 'Dr Wren\'s bag is in the boot and a baby is on the way. Beat the clock, buns or no buns.' },
  { id: 'rider', name: 'Granny Bramble', icon: '🦔', blurb: 'She wants to see the sunrise from the top, and she likes it fast and sideways. Keep her happy.' },
];
export const JOB_IDS = JOBS.map((j) => j.id);
export const jobDef = (id: JobId) => JOBS.find((j) => j.id === id)!;
export const jobDeadline = (pass: PassId) => Math.round(BOT_TIMES[pass] * JOB.doctor.deadline * 10) / 10;
/** Did the job succeed, and what does it pay (before the first-time bonus)? */
export function jobResult(job: JobId, pass: PassId, r: { time: number; buns: number; mood: number }) {
  if (job === 'cake') return { ok: r.buns > 0, coins: r.buns > 0 ? JOB.cake.pay : 0 };
  if (job === 'doctor') { const ok = r.time <= jobDeadline(pass); return { ok, coins: ok ? JOB.doctor.pay + Math.round((jobDeadline(pass) - r.time) * 2) : 0 }; }
  const ok = r.mood >= JOB.rider.happy; return { ok, coins: ok ? JOB.rider.pay + Math.round(r.mood / 2) : 0 };
}
export const jobKey = (job: JobId, pass: PassId) => `${job}:${pass}`;

export function duelCoins(rivalId: RivalId, won: boolean) { const i = RIVALS.findIndex((r) => r.id === rivalId); return won ? 45 + i * 15 : 12; }

// ---------------------------------------------------------------- the story ladder
export type SceneId = 'bakery' | 'carpark' | 'fog' | 'relay' | 'ending' | 'owl';
export type StoryStep =
  | { kind: 'scene'; scene: SceneId; lines: [string, string][] }
  | { kind: 'delivery'; pass: PassId; lines: [string, string][] }
  | { kind: 'duel'; rival: RivalId; lines: [string, string][] }
  | { kind: 'relay'; rival: 'fox'; lines: [string, string][] };

export const STORY: StoryStep[] = [
  { kind: 'scene', scene: 'bakery', lines: [['narrator', 'Four in the morning at the foot of Mount Kumori. The Hillside Bun Bakery is the only light on the street.'], ['dora', 'Twelve warm buns for the summit inn. Same as every night.'], ['enzo', 'And this year I\'m writing down every corner. Every single one!']] },
  { kind: 'delivery', pass: 'cedar', lines: [['enzo', 'First run with the notebook. I\'ll call the corners… I\'ll try to!'], ['dora', 'Hold the tray. Gentle on the guardrails.']] },
  { kind: 'scene', scene: 'carpark', lines: [['narrator', 'The summit car park. Vending machines hum. Somebody has been waiting.'], ['stoat', 'So you\'re the bun car that won\'t let anyone pass. Tomorrow night, the Cedar Switchbacks. You and me.'], ['enzo', 'D-Dora? Did he just challenge a bakery?']] },
  { kind: 'duel', rival: 'stoat', lines: [['enzo', 'Round one we lead: don\'t let him by, or win by a second. Round two we chase: stay close, or pass in the wide bits!']] },
  { kind: 'delivery', pass: 'lake', lines: [['enzo', 'Ripple from the lake crew sent a note: "Learn the esses first." So… we learn the esses.']] },
  { kind: 'duel', rival: 'otter', lines: [['enzo', 'Linked corners! Listen for "into"!']] },
  { kind: 'delivery', pass: 'stairs', lines: [['enzo', 'The Hairpin Stairs have drain gutters on the inside. Drop the inside wheels in, not too fast, not sideways, and it carries you round!']] },
  { kind: 'duel', rival: 'badger', lines: [['enzo', 'Bodger brakes super late. Don\'t try to out-brake him. Get him on the way out.']] },
  { kind: 'scene', scene: 'fog', lines: [['narrator', 'Up on the ridge the cloud sits on the road. The headlights stop ten metres ahead.'], ['dora', 'I can\'t see a thing, Enzo.'], ['enzo', 'Then listen to me. I\'ve got every corner. I promise.']] },
  { kind: 'delivery', pass: 'fog', lines: [['enzo', 'Fog Ridge. A couple of runs here and my notes will get much better. Trust them!']] },
  { kind: 'duel', rival: 'pika', lines: [['pika', 'P-please be careful in the fog…'], ['enzo', 'She\'s fast in the clear bits but brakes early in the cloud. That\'s where we get her.']] },
  { kind: 'delivery', pass: 'tunnel', lines: [['enzo', 'The old road has no lamps at all. Just us, the headlights and the notebook.']] },
  { kind: 'duel', rival: 'bat', lines: [['bat', 'I drive this road by ear. Let\'s see how well you listen.']] },
  { kind: 'duel', rival: 'goat', lines: [['goat', 'The whole mountain, top to bottom. If you can beat me, the dawn runner will want to meet you.']] },
  { kind: 'scene', scene: 'relay', lines: [['narrator', 'First light. A paper lantern marks the start. A white car is already waiting.'], ['fox', 'A relay. One of you drives up, the other drives down.'], ['dora', 'Enzo. You know this mountain better than anyone now. You take the wheel going up.'], ['enzo', 'M-me?! …Okay. You call the notes.']] },
  { kind: 'relay', rival: 'fox', lines: [['dora', 'Leg one: Enzo drives uphill, I read his notebook. Leg two: I drive down. Let\'s go home.']] },
  { kind: 'scene', scene: 'ending', lines: [['narrator', 'The sun comes up over a sea of cloud. At the summit inn, the buns are still warm.'], ['fox', 'So this is what warm buns taste like at dawn.'], ['enzo', 'Same time tomorrow? I\'ll bring extra.']] },
  // after the story (needs ended): the stranger at the bakery
  { kind: 'scene', scene: 'owl', lines: [['narrator', 'The next night. A pearl-grey car waits outside the bakery with its lights off. Nobody heard it arrive.'], ['owl', 'They say there\'s a bun car on this mountain that nobody can pass.'], ['enzo', 'W-we\'re just a bakery…'], ['owl', 'Fog Ridge, tonight. I won\'t be using my lights.']] },
  { kind: 'duel', rival: 'owl', lines: [['enzo', 'She sees through the fog. I can\'t. But I wrote down every corner, and the notebook doesn\'t need to see!']] },
];

// ---------------------------------------------------------------- saves
export const SAVE_KEY = 'kumori-pass-v1';
/** assist is 1 Strong, 0.5 Light or 0 Off (ASSIST); sharp picks the quicker steering filter */
export type Settings = { assist: number; sharp: boolean; manual: boolean; lite: boolean; sound: boolean; music: boolean; camera: number };
/** Ghosts are inputs replayed through the car, so a ghost recorded before the handling changed is dropped. */
export const GHOST_VERSION = 2;
export type Save = {
  v: 1; coins: number; upgrades: string[]; runs: Record<PassId, number>; story: number; beaten: RivalId[];
  medals: Record<PassId, number>; best: Record<PassId, number>; ghosts: Partial<Record<PassId, string>>;
  ghostMeta: Partial<Record<PassId, { up: string[]; assist: number; manual: boolean; sharp?: boolean; hv?: number; car?: CarId }>>;
  settings: Settings; ended: boolean;
  /** the car picked in the garage */
  car: CarId;
  /** side jobs done at least once, as jobKey(job, pass) */
  jobs: string[];
};
const PASS_IDS = PASSES.map((p) => p.id);
const zeroBy = (v: number) => Object.fromEntries(PASS_IDS.map((id) => [id, v])) as Record<PassId, number>;
export function newSave(): Save {
  return { v: 1, coins: 0, upgrades: [], runs: zeroBy(0), story: 0, beaten: [], medals: zeroBy(0), best: zeroBy(0), ghosts: {}, ghostMeta: {},
    settings: { assist: ASSIST.strong, sharp: false, manual: false, lite: false, sound: true, music: true, camera: 0 }, ended: false, car: 'biscuit', jobs: [] };
}
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const UPGRADE_IDS = ['flywheel', 'rear', 'tyres', 'lsd', 'intake', 'rack', 'tray', 'coilovers', 'strip'];
/** Read a save defensively: anything missing or wrong falls back to the default, and nothing throws. */
export function parseSave(raw: string | null | undefined): Save {
  const s = newSave();
  if (!raw) return s;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object' || (o as { v?: unknown }).v !== 1) return s;
  const d = o as Record<string, unknown>;
  s.coins = Math.floor(num(d.coins, 0, 1e6, 0));
  if (Array.isArray(d.upgrades)) s.upgrades = [...new Set(d.upgrades.filter((u): u is string => typeof u === 'string' && UPGRADE_IDS.includes(u)))];
  s.story = Math.floor(num(d.story, 0, STORY.length, 0));
  if (Array.isArray(d.beaten)) s.beaten = [...new Set(d.beaten.filter((u): u is RivalId => typeof u === 'string' && RIVALS.some((r) => r.id === u)))];
  for (const k of ['runs', 'medals', 'best'] as const) {
    const src = d[k];
    if (src && typeof src === 'object') for (const id of PASS_IDS) s[k][id] = num((src as Record<string, unknown>)[id], 0, k === 'medals' ? 3 : k === 'runs' ? 999 : 3600, 0);
    if (k !== 'best') for (const id of PASS_IDS) s[k][id] = Math.floor(s[k][id]);
  }
  if (d.ghosts && typeof d.ghosts === 'object') for (const id of PASS_IDS) {
    const g = (d.ghosts as Record<string, unknown>)[id];
    const meta = d.ghostMeta && typeof d.ghostMeta === 'object' ? (d.ghostMeta as Record<string, unknown>)[id] : null;
    if (typeof g === 'string' && unpackGhost(g) && meta && typeof meta === 'object' && (meta as Record<string, unknown>).hv === GHOST_VERSION) {
      const m = meta as Record<string, unknown>;
      s.ghosts[id] = g;
      s.ghostMeta[id] = { up: Array.isArray(m.up) ? m.up.filter((u): u is string => typeof u === 'string' && UPGRADE_IDS.includes(u)) : [], assist: num(m.assist, 0, 1, ASSIST.strong), manual: m.manual === true, sharp: m.sharp === true, hv: GHOST_VERSION,
        ...(CAR_IDS.includes(m.car as CarId) ? { car: m.car as CarId } : {}) };
    }
  }
  const st = d.settings;
  if (st && typeof st === 'object') {
    const x = st as Record<string, unknown>;
    // saves from before Strong/Light/Off held 0, 0.35, 0.6 or 0.85: Off stays off, Low becomes Light, the rest Strong
    const a = num(x.assist, 0, 1, ASSIST.strong), legacy = typeof x.sharp !== 'boolean';
    const assist = a < 0.01 ? ASSIST.off : legacy ? (a < 0.5 ? ASSIST.light : ASSIST.strong) : a < 0.75 ? ASSIST.light : ASSIST.strong;
    s.settings = { assist, sharp: x.sharp === true, manual: x.manual === true, lite: x.lite === true, sound: x.sound !== false, music: x.music !== false, camera: Math.floor(num(x.camera, 0, 2, 0)) };
  }
  s.ended = d.ended === true;
  // a car you have not unlocked (or one that doesn't exist) falls back to the Biscuit
  if (CAR_IDS.includes(d.car as CarId) && carUnlocked(s, d.car as CarId)) s.car = d.car as CarId;
  const jobKeys = JOB_IDS.flatMap((j) => PASSES.map((p) => jobKey(j, p.id)));
  if (Array.isArray(d.jobs)) s.jobs = [...new Set(d.jobs.filter((k): k is string => jobKeys.includes(k as string)))];
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);

/** Book-keeping after a finished run on a pass: the notebook gets better. */
export function recordRun(s: Save, id: PassId) { s.runs[id] = Math.min(999, (s.runs[id] ?? 0) + 1); }
export const passUnlocked = (s: Save, id: PassId) => {
  const i = STORY.findIndex((st) => (st.kind === 'delivery' && st.pass === id) || (st.kind === 'duel' && rival(st.rival).pass === id));
  return id === 'cedar' || s.ended || (i >= 0 && s.story >= i);
};
/** The steps after the ending scene are the postgame: Hush and the Pavlova only open from there. */
export const STORY_END = STORY.findIndex((st) => st.kind === 'scene' && st.scene === 'ending');
export const POSTGAME_RIVAL: RivalId = 'owl';
export const rivalUnlocked = (s: Save, id: RivalId) => s.beaten.includes(id) || (s.ended && id !== POSTGAME_RIVAL);
export const carUnlocked = (s: Save, id: CarId) => { const r = carDef(id).rival; return id === 'biscuit' || (s.ended && r !== POSTGAME_RIVAL) || (!!r && s.beaten.includes(r)); };
export function buyUpgrade(s: Save, id: string): boolean {
  const u = UPGRADE_LIST.find((x) => x.id === id);
  if (!u || s.upgrades.includes(id) || s.coins < u.cost) return false;
  s.coins -= u.cost; s.upgrades.push(id); return true;
}
import { UPGRADES as UPGRADE_LIST } from './pass-car.js';
export { UPGRADES, statCard, withUpgrades, BASE, BASE_STATS, idleInput, ASSIST, slipAngle as slipAngleOf } from './pass-car.js';
export type { Input, Car, CarSpec } from './pass-car.js';
export { PASSES, passDef, radiusAt, at } from './pass-tracks.js';
export type { PassId, Track } from './pass-tracks.js';

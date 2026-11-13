// The Arcade After Dark: the worlds, laid out by hand. The hub, the castle and its secret room, the sea and the Deep, and
// the cloud fortress. World units: the view is 720 tall. Nothing in here is random except each Static clump's shimmer
// seed. Also the shared types and the painted-frame helpers the rules need (sizes of the pillar, the block, the giant).
import { FRAMES, PX } from './afterdark-art.js';

export type WorldId = 'hub' | 'castle' | 'room' | 'sea' | 'deep' | 'cloud';
export type Ability = 'ping' | 'sweep' | 'gust';
export type HeroName = 'dora' | 'enzo';

// cabinet screen rect as fractions of the cabinet sprite (measured from the painting)
export const SCREEN = { x0: 0.14, x1: 0.86, y0: 0.215, y1: 0.505 };
// the hidden door's arch inside wall-door (fractions), and the tunnel inside pillar-open
export const DOOR = { x0: 0.22, x1: 0.78, y0: 0.19, y1: 0.99 };
export const TUNNEL = { cx: 0.5, cy: 0.6, r: 0.16 };
export const HB = { w: 28, h: 140 };      // land hero box: half-width, height above the feet
export const SB = { w: 40, h: 44 };       // swimmer box: half-width, half-height around the centre
export const PING_R = 540, GUST_R = 470;
/** no floor: a swimming world or the open sky */
export const NO_FLOOR = 99999;

// ───────────── painted frames: frames still waiting on art fall back to the nearest painted one
const ACT_FB: Record<string, string> = { gust: 'ability', gustw: 'reach', brace: 'hurt', awe: 'win', down: 'hurt', tumble: 'roll', glide1: 'dive', glide2: 'glide1', ride: 'win', land: 'idle', hang: 'reach' };
const PROP_FB: Record<string, string | null> = {
  'wall-tall': null, 'arm-walk1': 'armour', 'arm-walk2': 'armour', 'arm-turn': 'armour', 'arm-dazed': 'armour', jellyp1: 'jelly1', jellyp2: 'jelly2', 'jelly-dim': 'jelly1',
  mound: 'boulder', 'arch-sunk': 'pillar-open', crystal: 'coral', 'crystal-lit': 'coral', 'terrace-long': 'block', 'terrace-mid': 'block', disc: 'block', puff: 'block',
  'ped-gust': 'pedestal', 'ped-empty': 'pedestal', storm: null, brazier: 'candelabra', 'brazier-lit': 'candelabra', 'ledge-long': 'block', 'ledge-short': 'block', kchest: 'chest', 'kchest-open': 'chest',
  'ico-gust': 'btn-hand', 'btn-gust': 'btn-hand', 'ico-pearl': 'clam', pearl: 'clam', 'pearl-bubble': 'pearl', flag: null, arch: null, balloon: null,
};
export function fallbackFrame(n: string): string | null {
  if (n in PROP_FB) return PROP_FB[n];
  const m = n.match(/^(dora|enzo)-(\w+)-(\w+)$/);
  if (!m) return null;
  if (ACT_FB[m[3]]) return `${m[1]}-${m[2]}-${ACT_FB[m[3]]}`;
  if (m[2] === 'cloud') return `${m[1]}-hub-${m[3]}`;
  return null;
}
export type Frame = [string, number, number, number, number, number, number];
const frCache: Record<string, Frame | null> = {};
/** a painted frame, or the nearest painted stand-in */
export function FR(n: string): Frame | null {
  if (n in frCache) return frCache[n];
  let f: Frame | undefined = FRAMES[n], m: string | null = n, k = 0;
  while (!f && k++ < 4) { m = fallbackFrame(m!); if (!m) break; f = FRAMES[m]; }
  return (frCache[n] = f ?? null);
}
export const FRraw = (n: string): Frame | null => FRAMES[n] ?? null;
/** size of a frame in world units */
export function fsize(n: string): [number, number] { const f = FR(n); return f ? [f[3] / PX, f[4] / PX] : [0, 0]; }

// ───────────── the things in a world
export interface Static { x0: number; y0: number; x1: number; y1: number; kind: 'wall' | 'drift' | 'clump'; solid: boolean; alive: boolean; dis: number; delay: number; seed: number; blown?: number; guarded?: boolean }
export interface Pearl { id: string; x: number; y: number; hidden: boolean; revealed: boolean; got: boolean; t: number }
export interface Mover { n: string; cx: number; cy: number; ax: number; ay: number; w: number; ph: number; half: number; x: number; y: number; dx: number; dy: number }
export interface Swing { px: number; py: number; len: number; A: number; w: number; ph: number; half: number; x: number; y: number; dx: number; dy: number; ang: number }
export interface Plat { x0: number; x1: number; y: number; n?: string; mv?: Mover | Swing }
export interface Solid { x0: number; x1: number; y0: number; y1: number; id?: string; st?: Static; mv?: undefined }
export interface Portal { id: 'in' | 'out' | 'quick' | 'back'; x: number; y: number; to: WorldId; cab?: string; open: boolean; t?: number; door?: boolean; crystals?: boolean; hop?: string }
export interface Prop { n: string; x: number; y: number; l: 'back' | 'front' | 'wall'; s?: number }
export interface Cab { id: string; x: number; y: number; h: number; n: string; live: boolean; target?: WorldId; wob: number; bubble: number }
export interface Armour { x: number; x0: number; x1: number; dir: number; speed: number; daze: number; turn: number; h: number; walkT: number }
export interface Jelly { kind: 'bob' | 'patrol' | 'orbit'; n: string; x: number; y: number; ph: number; stun: number; tt: number; face: number; y0?: number; a?: number; x0?: number; x1?: number; sp?: number; cx?: number; cy?: number; r?: number }
export interface Current { x0: number; x1: number; y0: number; y1: number; vx: number; vy: number }
export interface Guard { ph: number; alive: boolean; x: number; y: number; vx: number; vy: number; t: number }
export interface Bank { x0: number; x1: number; y0: number; y1: number; alive: boolean; t: number; dir?: number }

export interface World {
  id: WorldId; W: number; kind: 'land' | 'swim'; floor: number; speed: number; jumpV: number; grav: number; outfit: string; tune: string; spawn: number; spawnY?: number;
  top: number; bottom: number; voidY?: number;
  statics: Static[]; plats: Plat[]; portals: Portal[]; props: Prop[]; pearls: Pearl[]; movers: Mover[]; swings: Swing[];
  currents: Current[]; jellies: Jelly[]; crystals: { x: number; y: number; lit: number }[];
  cabs?: Cab[];
  pit?: { x0: number; x1: number } | null;
  wall?: { x: number; open: boolean; t: number; knock: number; bubble: number; nearT: number };
  blocks?: { x: number; stack?: boolean }[];
  armours?: Armour[];
  web?: { x: number; y0: number; y1: number; burnt: boolean; t: number };
  chest?: { x: number; y: number; open: boolean };
  pedestal?: { x: number; y: number; taken: boolean };
  braziers?: { x: number; lit: boolean; t: number }[];
  dark?: { x0: number; x1: number };
  pillar?: { x: number; bottom: number; open: boolean; t: number };
  conch?: { x: number; y: number; used: boolean };
  mound?: { x: number; y: number; open: boolean; t: number; bubble: number };
  anchor?: { x: number; y: number; found: boolean; bare: boolean; gone: boolean; t: number; armT: number };
  guards?: Guard[];
  vents?: { x: number; y: number; top: number }[];
  winds?: { x0: number; x1: number; y0: number; y1: number; vx: number }[];
  banks?: Bank[];
  wheel?: { x: number; y: number; spun: boolean; t: number };
  bridge?: { x0: number; x1: number; y: number; out: number };
  shrine?: { x: number; y: number; taken: boolean };
}

export function makeWorlds(rnd: () => number): Record<WorldId, World> {
  const stat = (x0: number, y0: number, x1: number, y1: number, kind: Static['kind'], solid = true): Static => ({ x0, y0, x1, y1, kind, solid, alive: true, dis: 0, delay: 0, seed: Math.floor(rnd() * 1000) });
  let pn = 0;
  const pearl = (x: number, y: number, hidden = false): Pearl => ({ id: String(pn++), x, y, hidden, revealed: !hidden, got: false, t: 0 });
  const plat = (x0: number, x1: number, y: number, n: string): Plat => ({ x0, x1, y, n });
  const base = { top: 0, bottom: 720, statics: [], plats: [], portals: [], props: [], pearls: [], movers: [], swings: [], currents: [], jellies: [], crystals: [] };
  // ───────── hub: one screen of the arcade floor at night
  const cab = (id: string, x: number, live: boolean, target?: WorldId): Cab => ({ id, x, y: 614, h: 400, n: 'cab-' + id, live, target, wob: 0, bubble: 0 });
  const hub: World = {
    ...base, id: 'hub', W: 1280, kind: 'land', floor: 640, speed: 260, jumpV: 760, grav: 2300, outfit: 'hub', tune: 'hub', spawn: 110,
    cabs: [cab('harbour', 235, false), cab('castle', 480, true, 'castle'), cab('sea', 725, true, 'sea'), cab('cloud', 1010, false, 'cloud')],
    statics: [stat(905, 170, 990, 652, 'wall'), stat(985, 150, 1080, 652, 'wall'), stat(1075, 160, 1170, 652, 'wall'), stat(1165, 140, 1300, 652, 'wall'),
      stat(830, 600, 930, 660, 'drift', false), stat(1050, 600, 1200, 664, 'drift', false)],
  };
  // ───────── castle: one candlelit hall in four rooms: the steps, the armour's beat, the Static pit, the gallery and the wall
  pn = 0;
  const castle: World = {
    ...base, id: 'castle', W: 4250, kind: 'land', floor: 640, speed: 340, jumpV: 900, grav: 2500, outfit: 'castle', tune: 'castle', spawn: 280,
    statics: [stat(2150, 590, 2330, 662, 'drift', false), stat(2320, 590, 2500, 662, 'drift', false), stat(2490, 590, 2670, 662, 'drift', false), stat(2660, 590, 2850, 662, 'drift', false), stat(2840, 590, 3020, 662, 'drift', false), stat(3010, 590, 3100, 662, 'drift', false)],
    pit: { x0: 2150, x1: 3100 },
    wall: { x: 3950, open: false, t: 0, knock: 0, bubble: 0, nearT: 0 },
    blocks: [{ x: 560 }, { x: 740, stack: true }, { x: 1240 }, { x: 2010 }, { x: 3370 }],
    plats: [plat(860, 1060, 430, 'ledge-long'), plat(1300, 1520, 430, 'ledge-long'), plat(1700, 1940, 430, 'ledge-long'), plat(2040, 2200, 470, 'ledge-short'), plat(3450, 3710, 440, 'ledge-long')],
    swings: [0, Math.PI, 0, Math.PI].map((ph, i) => ({ px: 2330 + i * 250, py: 40, len: 395, A: 0.22, w: 1.4, ph, half: 88, x: 0, y: 0, dx: 0, dy: 0, ang: 0 })),
    armours: [{ x: 1500, x0: 1400, x1: 1880, dir: 1, speed: 120, daze: 0, turn: 0, h: 190, walkT: 0 }, { x: 3700, x0: 3560, x1: 3860, dir: -1, speed: 100, daze: 0, turn: 0, h: 190, walkT: 0 }],
    web: { x: 3580, y0: 290, y1: 440, burnt: false, t: 0 },
    chest: { x: 3660, y: 440, open: false },
    // the pearl over the chandelier pit hangs between the second and third chandeliers, low enough to reach from either
    pearls: [pearl(960, 365), pearl(1410, 365), pearl(3830, 560, true), pearl(2705, 300)],
    portals: [{ id: 'in', x: 100, y: 520, to: 'hub', cab: 'castle', open: true }, { id: 'quick', x: 3270, y: 520, to: 'hub', cab: 'castle', open: false, t: 0 }],
    props: [
      { n: 'candelabra', x: 300, y: 606, l: 'back' }, { n: 'bench', x: 1150, y: 606, l: 'back' }, { n: 'candelabra', x: 1990, y: 606, l: 'back' },
      { n: 'candelabra', x: 3200, y: 606, l: 'back' }, { n: 'tap-whale', x: 3780, y: 90, l: 'wall' }, { n: 'tap-castle', x: 1600, y: 70, l: 'wall' },
      { n: 'sconce', x: 2580, y: 150, l: 'wall' }, { n: 'table', x: 3540, y: 606, l: 'back' }, { n: 'pillar-c', x: 2140, y: 606, l: 'back' }, { n: 'books', x: 960, y: 432, l: 'back' },
    ],
  };
  // ───────── secret room: the sun crest; sweep the Static off the way out and relight both braziers
  const room: World = {
    ...base, id: 'room', W: 1280, kind: 'land', floor: 615, speed: 320, jumpV: 880, grav: 2500, outfit: 'castle', tune: 'room', spawn: 230,
    statics: [stat(850, 210, 945, 625, 'wall'), stat(940, 190, 1040, 625, 'wall'), stat(1035, 180, 1130, 625, 'wall'), stat(1125, 190, 1300, 625, 'wall'), stat(790, 575, 860, 630, 'drift', false)],
    pedestal: { x: 700, y: 606, taken: false },
    braziers: [{ x: 360, lit: false, t: 0 }, { x: 520, lit: false, t: 0 }],
    portals: [{ id: 'back', x: 95, y: 540, to: 'castle', open: true, door: true }, { id: 'out', x: 1150, y: 525, to: 'hub', cab: 'castle', open: true }],
  };
  // ───────── sea: a current to ride, three jelly patterns, the conch, the pillar, and the dark grotto with the sand mound
  pn = 0;
  type JellySpec = { kind: Jelly['kind']; n: string; ph: number; x?: number; y0?: number; a?: number; x0?: number; x1?: number; y?: number; sp?: number; cx?: number; cy?: number; r?: number };
  const jellies: JellySpec[] = [
    { kind: 'bob', x: 620, y0: 430, a: 110, ph: 0, n: 'jelly' }, { kind: 'patrol', x0: 700, x1: 1150, y: 470, sp: 0.9, ph: 0, n: 'jellyp' },
    { kind: 'bob', x: 1250, y0: 400, a: 120, ph: 2, n: 'jelly' }, { kind: 'orbit', cx: 2480, cy: 360, r: 120, sp: 0.9, ph: 0, n: 'jellyp' },
    { kind: 'orbit', cx: 2480, cy: 360, r: 120, sp: 0.9, ph: Math.PI, n: 'jellyp' }, { kind: 'bob', x: 2780, y0: 300, a: 140, ph: 1, n: 'jelly' },
    { kind: 'patrol', x0: 2900, x1: 3300, y: 260, sp: 0.8, ph: 1, n: 'jellyp' }, { kind: 'orbit', cx: 3150, cy: 420, r: 100, sp: -1, ph: 0, n: 'jelly' },
    { kind: 'patrol', x0: 3450, x1: 4050, y: 430, sp: 0.7, ph: 2, n: 'jellyp' }, { kind: 'bob', x: 3700, y0: 280, a: 150, ph: 0.5, n: 'jelly' }, { kind: 'orbit', cx: 3950, cy: 300, r: 110, sp: 1.1, ph: 1, n: 'jellyp' },
  ];
  const sea: World = {
    ...base, id: 'sea', W: 4500, kind: 'swim', floor: NO_FLOOR, jumpV: 0, grav: 0, top: 95, bottom: 590, speed: 300, outfit: 'sea', tune: 'sea', spawn: 280, spawnY: 330,
    statics: [stat(1080, 520, 1190, 615, 'clump', false), stat(1820, 20, 2050, 222, 'wall')],
    currents: [{ x0: 330, x1: 1380, y0: 150, y1: 270, vx: 230, vy: 0 }, { x0: 2500, x1: 3300, y0: 480, y1: 600, vx: -170, vy: 0 }],
    dark: { x0: 2150, x1: 4300 },
    pillar: { x: 1940, bottom: 650, open: false, t: 0 },
    conch: { x: 1520, y: 616, used: false },
    jellies: jellies.map((j) => ({ ...j, x: j.x ?? j.cx ?? j.x0!, y: j.y0 ?? j.cy ?? j.y!, stun: 0, tt: 0, face: 1 })),
    crystals: [{ x: 2300, y: 600 }, { x: 2750, y: 600 }, { x: 3350, y: 600 }, { x: 4050, y: 600 }].map((c) => ({ ...c, lit: 0 })),
    mound: { x: 3010, y: 612, open: false, t: 0, bubble: 0 },
    pearls: [pearl(560, 210), pearl(820, 190), pearl(1100, 230), pearl(1330, 200), pearl(1780, 300, true), pearl(2620, 180, true), pearl(3200, 545, true), pearl(3640, 560, true), pearl(4150, 180, true)],
    portals: [{ id: 'in', x: 105, y: 330, to: 'hub', cab: 'sea', open: true }, { id: 'out', x: 4380, y: 340, to: 'hub', cab: 'sea', open: true, crystals: true }],
    props: [
      { n: 'kelp', x: 330, y: 640, l: 'back' }, { n: 'boulder', x: 470, y: 640, l: 'back' }, { n: 'coral', x: 900, y: 640, l: 'back' },
      { n: 'kelp', x: 1400, y: 660, l: 'back' }, { n: 'anemone', x: 1660, y: 640, l: 'back' }, { n: 'vent', x: 1760, y: 640, l: 'back' },
      { n: 'kelp', x: 2250, y: 660, l: 'back' }, { n: 'boulder', x: 2820, y: 650, l: 'back' }, { n: 'chest', x: 4250, y: 640, l: 'back' }, { n: 'mast', x: 3560, y: 650, l: 'back' }, { n: 'kelp-tall', x: 3880, y: 655, l: 'back' },
      { n: 'mast', x: 2700, y: 650, l: 'back' }, { n: 'kelp-tall', x: 3120, y: 655, l: 'back' }, { n: 'bigclam', x: 1150, y: 650, l: 'back' }, { n: 'rock-ledge', x: 2440, y: 650, l: 'back' },
      { n: 'kelp', x: 520, y: 700, l: 'front', s: 1.1 }, { n: 'boulder', x: 2180, y: 690, l: 'front' }, { n: 'kelp', x: 3250, y: 700, l: 'front', s: 1.05 }, { n: 'boulder', x: 4000, y: 700, l: 'front' },
    ],
  };
  // ───────── the Deep: the Static's anchor. The ping finds its heart, the gust strips its guards, the sweep dissolves it
  pn = 0;
  const deep: World = {
    ...base, id: 'deep', W: 1280, kind: 'swim', floor: NO_FLOOR, jumpV: 0, grav: 0, top: 95, bottom: 590, speed: 280, outfit: 'sea', tune: 'deep', spawn: 230, spawnY: 360,
    statics: [stat(820, 140, 930, 640, 'wall'), stat(920, 100, 1030, 640, 'wall'), stat(1020, 150, 1140, 640, 'wall')],
    anchor: { x: 975, y: 380, found: false, bare: false, gone: false, t: 0, armT: 0 },
    guards: [0, 2.1, 4.2].map((ph) => ({ ph, alive: true, x: 0, y: 0, vx: 0, vy: 0, t: 0 })),
    dark: { x0: -100, x1: 1400 },
    pearls: [pearl(420, 560)],
    portals: [{ id: 'back', x: 90, y: 360, to: 'sea', open: true, door: true }, { id: 'out', x: 1150, y: 330, to: 'hub', cab: 'sea', open: false, t: 0 }],
    props: [{ n: 'kelp-tall', x: 260, y: 660, l: 'back' }, { n: 'bigclam-open', x: 430, y: 650, l: 'back' }, { n: 'coral', x: 640, y: 650, l: 'back' }, { n: 'kelp', x: 700, y: 700, l: 'front' }],
  };
  // ───────── the cloud fortress: floating terraces, an updraft, a drifting puff, a headwind; the gust is earned halfway
  pn = 0;
  const T = (x0: number, x1: number, y: number, n = 'terrace-long') => plat(x0, x1, y, n), D = (x0: number, y: number) => plat(x0, x0 + 110, y, 'disc');
  const cloud: World = {
    ...base, id: 'cloud', W: 6200, kind: 'land', floor: NO_FLOOR, voidY: 820, speed: 300, jumpV: 900, grav: 2300, outfit: 'cloud', tune: 'cloud', spawn: 220, spawnY: 560,
    plats: [T(-40, 560, 560), D(650, 520), D(840, 470), D(1030, 520), T(1220, 1500, 540, 'terrace-mid'), T(1820, 2180, 560, 'terrace-mid'),
      T(2000, 2560, 300), T(2900, 3200, 380, 'terrace-mid'), T(3560, 3900, 380, 'terrace-mid'), D(3990, 420), T(4380, 4900, 420), D(5250, 390), T(5420, 5820, 420, 'terrace-mid'), T(5650, 6200, 200)],
    movers: [{ n: 'puff', cx: 2720, cy: 330, ax: 110, ay: 0, w: 1.1, ph: 0, half: 70, x: 0, y: 0, dx: 0, dy: 0 },
      { n: 'disc', cx: 4235, cy: 380, ax: 0, ay: 55, w: 1.3, ph: 0, half: 55, x: 0, y: 0, dx: 0, dy: 0 },
      { n: 'puff', cx: 5075, cy: 420, ax: 95, ay: 0, w: 1.2, ph: 1, half: 70, x: 0, y: 0, dx: 0, dy: 0 }],
    vents: [{ x: 2080, y: 560, top: 190 }, { x: 5740, y: 420, top: 110 }],
    winds: [{ x0: 3920, x1: 4420, y0: -100, y1: 900, vx: -120 }],
    banks: [{ x0: 2480, x1: 2570, y0: 20, y1: 300, alive: true, t: 0 }, { x0: 4590, x1: 4670, y0: 60, y1: 420, alive: true, t: 0 }],
    wheel: { x: 3140, y: 380, spun: false, t: 0 },
    bridge: { x0: 3200, x1: 3560, y: 380, out: 0 },
    shrine: { x: 2330, y: 300, taken: false },
    statics: [stat(3350, 250, 3450, 380, 'drift', false), stat(4180, 170, 4280, 290, 'drift', false), stat(5470, 290, 5560, 420, 'drift', false), stat(5600, 300, 5690, 420, 'drift', false)],
    pearls: [pearl(895, 360), pearl(1660, 450), pearl(2160, 170), pearl(2720, 220), pearl(4045, 300), pearl(5300, 260), pearl(5960, 90)],
    portals: [{ id: 'in', x: 100, y: 470, to: 'hub', cab: 'cloud', open: true }, { id: 'out', x: 6080, y: 115, to: 'hub', cab: 'cloud', open: true }],
    props: [{ n: 'flag', x: 380, y: 560, l: 'back' }, { n: 'arch', x: 1360, y: 540, l: 'back' }, { n: 'flag', x: 3080, y: 380, l: 'back' }, { n: 'balloon', x: 4520, y: 420, l: 'back' }, { n: 'flag', x: 5800, y: 200, l: 'back' }],
  };
  // every world gets its own arrays (the spread above shares the empty defaults)
  const W = { hub, castle, room, sea, deep, cloud };
  for (const w of Object.values(W)) for (const f of ['statics', 'plats', 'portals', 'props', 'pearls', 'movers', 'swings', 'currents', 'jellies', 'crystals'] as const) (w[f] as unknown[]) = (w[f] as unknown[]).slice();
  return W;
}
/** 22: every pearl in the sea, castle, cloud and Deep, plus the castle's chest */
export const PEARL_WORLDS: WorldId[] = ['sea', 'castle', 'cloud', 'deep'];

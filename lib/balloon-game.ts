// Cloudberry Balloon: the rules. Dora and Enzo fly a hot-air balloon across a valley, side on. There's no steering:
// the burner heats the envelope (slowly) and the vent lets heat out, and the wind blows a different way at different
// heights, so you go where you want by choosing your height. Skim the hilltops to pick cloudberries, drop parcels on
// parachutes into the villages' gardens, ride thermals, dodge birds and a thunderhead, and land softly on the meadow
// at the end of each hop. Deterministic at 60 Hz with no DOM: the scene draws it, the page feeds it input, the bots
// and tests drive it.

export const DT = 1 / 60;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the levels
/** a band of wind from the band below it up to `top` (metres above sea level), blowing at `v` m/s (+ is east) */
export type Wind = { top: number; v: number };
export type Feature =
  | { k: 'hill'; x: number; w: number; h: number } | { k: 'lake'; x0: number; x1: number } | { k: 'forest'; x0: number; x1: number }
  | { k: 'cliff'; x: number; h: number; dir: 1 | -1 } | { k: 'gorge'; x0: number; x1: number; d: number };
export type Pad = { x: number; w: number; name: string; kind: 'start' | 'village' | 'finish' };
export type Thermal = { x: number; w: number; up: number };
export type Flock = { y: number; x0: number; x1: number; speed: number };
export type Storm = { x0: number; x1: number; y0: number; y1: number; every: number };
export type LevelId = 'farm' | 'mill' | 'lake' | 'forest' | 'cliffs' | 'gorge' | 'storm' | 'meadow';
export type Level = {
  id: LevelId; n: number; name: string; line: string; w: number; base: number; rough: number; seed: number;
  features: Feature[]; pads: Pad[]; winds: Wind[]; gust: number; thermals: Thermal[]; flocks: Flock[]; storm: Storm | null;
  bushes: number[]; drops: { x: number; name: string }[]; fuel: number; parcels: number; sandbags: number; berryGoal: number; par: number;
};

// (every map runs on 150 m past the finish, so there's room to overshoot it and come back)
const L = (o: Omit<Level, 'n'>, n: number): Level => ({ ...o, n, w: Math.max(o.w, o.pads[o.pads.length - 1].x + 150) });
export const LEVELS: Level[] = [
  L({ id: 'farm', name: 'Granny Bramble’s Farm', line: 'Up, along, and down on Mill Hill.', w: 900, base: 40, rough: 4, seed: 11,
    features: [{ k: 'hill', x: 430, w: 140, h: 45 }],
    pads: [{ x: 60, w: 50, name: 'Bramble Farm', kind: 'start' }, { x: 820, w: 70, name: 'Mill Hill meadow', kind: 'finish' }],
    winds: [{ top: 9999, v: 5 }], gust: 0.5, thermals: [], flocks: [], storm: null,
    bushes: [430, 300, 600], drops: [], fuel: 90, parcels: 0, sandbags: 2, berryGoal: 6, par: 160 }, 1),
  L({ id: 'mill', name: 'The Windmill', line: 'Two winds: east up high, west down low.', w: 1040, base: 50, rough: 6, seed: 23,
    features: [{ k: 'hill', x: 305, w: 130, h: 60 }, { k: 'hill', x: 720, w: 160, h: 40 }],
    pads: [{ x: 50, w: 50, name: 'Mill Hill', kind: 'start' }, { x: 510, w: 60, name: 'Windmill Green', kind: 'village' }, { x: 975, w: 70, name: 'Hollyhock Lane', kind: 'finish' }],
    winds: [{ top: 105, v: -3 }, { top: 9999, v: 6 }], gust: 0.8, thermals: [], flocks: [], storm: null,
    bushes: [305, 720, 375, 665], drops: [{ x: 450, name: 'the miller' }, { x: 810, name: 'the Hollyhocks' }], fuel: 150, parcels: 4, sandbags: 2, berryGoal: 9, par: 175 }, 2),
  L({ id: 'lake', name: 'Lake Lumen', line: 'Don’t land in the lake. Ride the low wind back if you overshoot.', w: 1050, base: 30, rough: 4, seed: 37,
    features: [{ k: 'lake', x0: 295, x1: 630 }, { k: 'hill', x: 755, w: 100, h: 50 }],
    pads: [{ x: 40, w: 50, name: 'Hollyhock Lane', kind: 'start' }, { x: 210, w: 60, name: 'Reed Jetty', kind: 'village' }, { x: 995, w: 70, name: 'Lighthouse Lawn', kind: 'finish' }],
    winds: [{ top: 90, v: -4 }, { top: 260, v: 6 }, { top: 9999, v: 9 }], gust: 1, thermals: [], flocks: [], storm: null,
    bushes: [755, 805, 140, 705], drops: [{ x: 250, name: 'the jetty' }, { x: 670, name: 'the boathouse' }, { x: 910, name: 'the lighthouse' }], fuel: 160, parcels: 5, sandbags: 3, berryGoal: 9, par: 170 }, 3),
  L({ id: 'forest', name: 'Bramblewood', line: 'Thermals rise over the sunny clearings. The treetops snag.', w: 1105, base: 60, rough: 8, seed: 41,
    features: [{ k: 'forest', x0: 130, x1: 390 }, { k: 'forest', x0: 495, x1: 810 }, { k: 'hill', x: 440, w: 80, h: 30 }, { k: 'hill', x: 925, w: 105, h: 50 }],
    pads: [{ x: 40, w: 50, name: 'Lighthouse Lawn', kind: 'start' }, { x: 440, w: 50, name: 'Woodcutter’s Clearing', kind: 'village' }, { x: 1055, w: 70, name: 'Fernside', kind: 'finish' }],
    winds: [{ top: 240, v: 4 }, { top: 360, v: -4 }, { top: 9999, v: 8 }], gust: 1, thermals: [{ x: 440, w: 60, up: 2.4 }, { x: 870, w: 70, up: 2 }], flocks: [], storm: null,
    bushes: [440, 925, 960, 90, 885], drops: [{ x: 470, name: 'the woodcutter' }, { x: 990, name: 'Fernside school' }], fuel: 160, parcels: 4, sandbags: 3, berryGoal: 12, par: 170 }, 4),
  L({ id: 'cliffs', name: 'Kestrel Cliffs', line: 'Up the cliffs, round the birds.', w: 1105, base: 40, rough: 10, seed: 53,
    features: [{ k: 'cliff', x: 340, h: 120, dir: 1 }, { k: 'hill', x: 585, w: 130, h: 40 }, { k: 'cliff', x: 845, h: 80, dir: 1 }],
    pads: [{ x: 40, w: 50, name: 'Fernside', kind: 'start' }, { x: 495, w: 60, name: 'Clifftop Inn', kind: 'village' }, { x: 1045, w: 70, name: 'Kestrel Point', kind: 'finish' }],
    winds: [{ top: 130, v: 2 }, { top: 330, v: 7 }, { top: 9999, v: -3 }], gust: 1.4, thermals: [{ x: 305, w: 50, up: 2.6 }], flocks: [{ y: 240, x0: 390, x1: 845, speed: 9 }, { y: 330, x0: 195, x1: 715, speed: -7 }], storm: null,
    bushes: [585, 635, 940, 990, 535], drops: [{ x: 515, name: 'the inn' }, { x: 765, name: 'the shepherd' }, { x: 1015, name: 'the kestrel keeper' }], fuel: 180, parcels: 5, sandbags: 3, berryGoal: 12, par: 180 }, 5),
  L({ id: 'gorge', name: 'Whistling Gorge', line: 'The gorge pulls you down. Keep your heat up and stay in the middle.', w: 1170, base: 160, rough: 8, seed: 67,
    features: [{ k: 'gorge', x0: 325, x1: 780, d: 130 }, { k: 'hill', x: 195, w: 105, h: 60 }, { k: 'hill', x: 940, w: 115, h: 70 }],
    pads: [{ x: 40, w: 50, name: 'Kestrel Point', kind: 'start' }, { x: 550, w: 50, name: 'Gorge Bottom Mill', kind: 'village' }, { x: 1120, w: 70, name: 'Pinefold', kind: 'finish' }],
    winds: [{ top: 310, v: 5 }, { top: 420, v: -3 }, { top: 9999, v: 10 }], gust: 1.8, thermals: [{ x: 550, w: 200, up: -1.6 }, { x: 940, w: 60, up: 2.2 }], flocks: [{ y: 360, x0: 585, x1: 1040, speed: -8 }], storm: null,
    bushes: [195, 940, 990, 570, 245], drops: [{ x: 570, name: 'the gorge mill' }, { x: 1055, name: 'Pinefold' }], fuel: 180, parcels: 4, sandbags: 3, berryGoal: 12, par: 180 }, 6),
  L({ id: 'storm', name: 'The Thunderhead', line: 'Count between the flashes and slip through underneath.', w: 1180, base: 120, rough: 10, seed: 79,
    features: [{ k: 'hill', x: 250, w: 125, h: 70 }, { k: 'forest', x0: 405, x1: 680 }, { k: 'hill', x: 930, w: 135, h: 90 }],
    pads: [{ x: 35, w: 50, name: 'Pinefold', kind: 'start' }, { x: 775, w: 60, name: 'Stormwatch', kind: 'village' }, { x: 1130, w: 70, name: 'Snowfoot', kind: 'finish' }],
    winds: [{ top: 270, v: 4 }, { top: 420, v: 8 }, { top: 9999, v: -4 }], gust: 2.2, thermals: [{ x: 250, w: 60, up: 2.4 }], flocks: [], storm: { x0: 435, x1: 715, y0: 320, y1: 580, every: 4 },
    bushes: [250, 290, 930, 965, 805], drops: [{ x: 795, name: 'Stormwatch' }, { x: 1055, name: 'the goatherd' }], fuel: 200, parcels: 4, sandbags: 3, berryGoal: 12, par: 185 }, 7),
  L({ id: 'meadow', name: 'The High Meadow', line: 'Thin air up here: everything takes more heat. The festival is waiting.', w: 1260, base: 260, rough: 12, seed: 97,
    features: [{ k: 'hill', x: 300, w: 155, h: 140 }, { k: 'cliff', x: 540, h: 90, dir: 1 }, { k: 'hill', x: 780, w: 145, h: 120 }, { k: 'gorge', x0: 930, x1: 1080, d: 90 }],
    pads: [{ x: 35, w: 50, name: 'Snowfoot', kind: 'start' }, { x: 650, w: 60, name: 'Shepherds’ Hut', kind: 'village' }, { x: 1205, w: 80, name: 'the festival meadow', kind: 'finish' }],
    winds: [{ top: 520, v: 5 }, { top: 650, v: -4 }, { top: 9999, v: 9 }], gust: 2, thermals: [{ x: 650, w: 60, up: 2.4 }, { x: 1010, w: 120, up: -1.4 }], flocks: [{ y: 570, x0: 180, x1: 900, speed: 8 }], storm: null,
    bushes: [300, 350, 780, 830, 660, 1170], drops: [{ x: 670, name: 'the shepherds' }, { x: 1165, name: 'the festival' }], fuel: 220, parcels: 4, sandbags: 3, berryGoal: 15, par: 205 }, 8),
];
export const level = (id: LevelId) => LEVELS.find((l) => l.id === id)!;

// ---------------------------------------------------------------- the ground
export const STEP = 2;
export type Terrain = { lv: Level; h: Float32Array; water: number; lake: (x: number) => boolean; canopy: (x: number) => number };
function noise1(seed: number) {
  const r: number[] = []; let s = seed >>> 0 || 1; for (let i = 0; i < 64; i++) { s = (s * 1664525 + 1013904223) >>> 0; r.push(s / 4294967296); }
  return (x: number) => { const i = Math.floor(x), f = x - i, a = r[((i % 64) + 64) % 64], b = r[(((i + 1) % 64) + 64) % 64]; return a + (b - a) * (f * f * (3 - 2 * f)); };
}
/** Build a level's ground: gentle rolling noise, the features, and flat pads. */
export function makeTerrain(lv: Level): Terrain {
  const n = Math.ceil(lv.w / STEP) + 1, h = new Float32Array(n), nz = noise1(lv.seed), nz2 = noise1(lv.seed * 7 + 3);
  let water = -1;
  for (let i = 0; i < n; i++) {
    const x = i * STEP;
    let y = lv.base + (nz(x / 90) - 0.5) * lv.rough * 2 + (nz2(x / 25) - 0.5) * lv.rough * 0.5;
    for (const f of lv.features) {
      if (f.k === 'hill') { const d = (x - f.x) / (f.w / 2); if (Math.abs(d) < 1) y += f.h * (0.5 + 0.5 * Math.cos(d * Math.PI)); }
      else if (f.k === 'cliff') y += f.h * smooth(f.x - 12 * f.dir, f.x + 12 * f.dir, x) * (f.dir > 0 ? 1 : 1);
      else if (f.k === 'gorge') { const d = Math.min(x - f.x0, f.x1 - x); if (d > 0) y -= f.d * smooth(0, 40, d); }
      else if (f.k === 'lake') { const d = Math.min(x - f.x0, f.x1 - x); if (d > 0) y -= 14 * smooth(0, 30, d); }
    }
    // the cliffs stay up: everything after a cliff is raised
    h[i] = y;
  }
  for (const f of lv.features) if (f.k === 'lake') water = lv.base - 4;
  // flatten the pads
  for (const p of lv.pads) {
    const y = h[clamp(Math.round(p.x / STEP), 0, n - 1)];
    for (let i = 0; i < n; i++) { const d = Math.abs(i * STEP - p.x) - p.w / 2 - STEP; if (d < 16) h[i] = d <= 0 ? y : h[i] + (y - h[i]) * (1 - smooth(0, 16, d)); }
  }
  const lakes = lv.features.filter((f): f is Extract<Feature, { k: 'lake' }> => f.k === 'lake'), forests = lv.features.filter((f): f is Extract<Feature, { k: 'forest' }> => f.k === 'forest');
  return {
    lv, h, water,
    lake: (x) => lakes.some((f) => x > f.x0 + 20 && x < f.x1 - 20),
    canopy: (x) => { for (const f of forests) { const d = Math.min(x - f.x0, f.x1 - x); if (d > 0 && !lv.pads.some((p) => Math.abs(x - p.x) < p.w / 2 + 25)) return 12 * smooth(0, 15, d); } return 0; },
  };
}
export function groundAt(t: Terrain, x: number) {
  const f = clamp(x / STEP, 0, t.h.length - 1.001), i = Math.floor(f), k = f - i;
  return t.h[i] + (t.h[i + 1] - t.h[i]) * k;
}
/** the top of whatever the basket would hit: the ground, the water, or the treetops */
export function surfaceAt(t: Terrain, x: number) { const g = groundAt(t, x); return Math.max(g + t.canopy(x), t.lake(x) ? t.water : -999); }

// ---------------------------------------------------------------- the flight
export const ENVELOPE = 22; // from the basket's floor to the top of the balloon
const BURN = 0.16, COOL = 0.03, VENT = 0.24, LIFT = 6, DRAG = 0.5, LAG = 2.2, SOFT = 1.8, CRASH = 5.5, PICK = 6, PEDAL = 2.2;
/** `pedal`: Enzo's little pedal propeller, -1 (west), 0 or 1 (east) */
export type Input = { burn: boolean; vent: boolean; drop: boolean; sand: boolean; pedal: number };
export const idleInput = (): Input => ({ burn: false, vent: false, drop: false, sand: false, pedal: 0 });
export type FlightEvent =
  | { k: 'liftoff' } | { k: 'touch'; soft: boolean; pad: string | null } | { k: 'bump'; lost: number } | { k: 'berry'; n: number } | { k: 'drop' }
  | { k: 'parcel'; hit: 'perfect' | 'good' | 'miss'; who: string | null } | { k: 'sand' } | { k: 'refuel' } | { k: 'flash'; hit: boolean } | { k: 'lowfuel' }
  | { k: 'end'; why: End };
export type End = 'landed' | 'splash' | 'crash' | 'stranded';
export type Parcel = { x: number; y: number; vx: number; vy: number; done: boolean };

export class Flight {
  lv: Level; ter: Terrain; t = 0;
  x: number; y: number; vx = 0; vy = 0; heat: number; fuel: number; parcels: number; sandbags: number; sandDropped = 0;
  grounded = true; pad: Pad | null; berries = 0; picked: boolean[]; delivered: ('perfect' | 'good' | null)[]; drops: Parcel[] = [];
  bumps = 0; over = false; why: End | null = null; touchV = 0; events: FlightEvent[] = []; burning = false; flash = 0; lowSaid = false;
  private prev = idleInput(); private bumpT = 0;
  constructor(lv: Level, ter = makeTerrain(lv)) {
    this.lv = lv; this.ter = ter;
    const s = lv.pads[0]; this.x = s.x; this.y = groundAt(ter, s.x); this.pad = s;
    this.fuel = lv.fuel; this.parcels = lv.parcels; this.sandbags = lv.sandbags;
    this.heat = this.neutral() - 0.06;
    this.picked = lv.bushes.map(() => false); this.delivered = lv.drops.map(() => null);
  }
  /** the heat that just holds the balloon level: thinner air higher up needs more, each sandbag dropped less */
  neutral(y = this.y) { return 0.5 + y / 5000 - 0.045 * this.sandDropped; }
  /** the wind at a height: the band it's in, blended near the edges, slower near the ground, with gusts */
  wind(x: number, y: number, t = this.t) {
    const ws = this.lv.winds; let v = ws[ws.length - 1].v;
    for (let i = 0; i < ws.length; i++) if (y < ws[i].top) { v = ws[i].v; if (i + 1 < ws.length) v += (ws[i + 1].v - v) * smooth(ws[i].top - 15, ws[i].top + 15, y); if (i > 0) v += (ws[i - 1].v - v) * (1 - smooth(ws[i - 1].top - 15, ws[i - 1].top + 15, y)); break; }
    const ag = y - groundAt(this.ter, x), near = clamp(0.05 + ag / 40, 0.05, 1);
    return v * near + this.lv.gust * Math.sin(t * 0.6 + x * 0.013) * Math.sin(t * 0.23 + 1.3);
  }
  /** thermals and downdrafts: an upward push (m/s² equivalent) over their columns, fading up high */
  lift(x: number, y: number) {
    let a = 0; const ag = y - groundAt(this.ter, x);
    for (const th of this.lv.thermals) { const d = (x - th.x) / th.w; if (Math.abs(d) < 1) a += th.up * (0.5 + 0.5 * Math.cos(d * Math.PI)) * clamp(1 - ag / 320, 0, 1); }
    return a;
  }
  birds(t = this.t) { return this.lv.flocks.map((f) => { const span = f.x1 - f.x0, p = ((f.speed * t) % (span * 2) + span * 2) % (span * 2), along = p < span ? p : span * 2 - p; return { x: f.x0 + along, y: f.y + Math.sin(t * 1.3 + f.x0) * 6, dir: (p < span ? 1 : -1) * Math.sign(f.speed) }; }); }
  get altitude() { return this.y - groundAt(this.ter, this.x); }
  /** a copy to try things out on (the bots plan with it) */
  clone() {
    const c = Object.assign(Object.create(Flight.prototype), this) as Flight;
    c.picked = [...this.picked]; c.delivered = [...this.delivered]; c.drops = this.drops.map((p) => ({ ...p })); c.events = []; c.prev = { ...this.prev };
    return c;
  }
  /** where a parcel dropped now would come down (for the HUD's guide) */
  predictDrop() { const p: Parcel = { x: this.x, y: this.y - 1, vx: this.vx, vy: this.vy, done: false }; for (let i = 0; i < 60 * 40 && !p.done; i++) this.stepParcel(p, this.t + i * DT, true); return p.x; }

  tick(inp: Input) {
    this.events.length = 0;
    if (this.over) return;
    const pressed = { drop: inp.drop && !this.prev.drop, sand: inp.sand && !this.prev.sand };
    this.prev = { ...inp }; this.t += DT; this.bumpT = Math.max(0, this.bumpT - DT); this.flash = Math.max(0, this.flash - DT);
    // the envelope's heat
    this.burning = inp.burn && this.fuel > 0;
    if (this.burning) { this.heat += BURN * DT; this.fuel = Math.max(0, this.fuel - DT); }
    this.heat -= COOL * this.heat * DT; if (inp.vent) this.heat -= VENT * DT; this.heat = clamp(this.heat, 0, 1.2);
    if (!this.lowSaid && this.fuel < this.lv.fuel * 0.2) { this.lowSaid = true; this.events.push({ k: 'lowfuel' }); }
    if (pressed.sand && this.sandbags > 0) { this.sandbags--; this.sandDropped++; this.events.push({ k: 'sand' }); }
    if (pressed.drop && this.parcels > 0 && !this.grounded) { this.parcels--; this.drops.push({ x: this.x, y: this.y - 1, vx: this.vx, vy: this.vy, done: false }); this.events.push({ k: 'drop' }); }
    for (const p of this.drops) if (!p.done) this.stepParcel(p, this.t, false);
    const a = LIFT * (this.heat - this.neutral()) + this.lift(this.x, this.y) - DRAG * this.vy;
    if (this.grounded) {
      if (a > 0.3) { this.grounded = false; this.pad = null; this.vy = 0.5; this.events.push({ k: 'liftoff' }); }
      else { this.vx = 0; this.vy = 0; this.checkStranded(); return; }
    }
    // the wind carries the balloon (catching up over a couple of seconds); the pedals add a little on top, enough to line
    // up over a bush or a garden or to creep along in the calm near the ground, not to fight a real wind
    this.vy += a * DT; this.vx += (this.wind(this.x, this.y) + clamp(inp.pedal, -1, 1) * PEDAL - this.vx) * (1 - Math.exp(-DT / LAG));
    let nx = clamp(this.x + this.vx * DT, 8, this.lv.w - 8); if (nx === 8 || nx === this.lv.w - 8) this.vx = 0;
    // the envelope's sides against rising ground (cliffs, the gorge walls): pushed back
    const side = Math.sign(this.vx) * 8, wall = surfaceAt(this.ter, nx + side);
    if (wall > this.y + 6) { nx = this.x; this.vx *= -0.3; this.bump(); }
    this.x = nx; this.y += this.vy * DT;
    if (this.y > 900) { this.y = 900; this.vy = Math.min(0, this.vy); }
    // the thunderhead
    const st = this.lv.storm;
    if (st && this.t % st.every < DT) { const inside = this.x > st.x0 && this.x < st.x1 && this.y + ENVELOPE > st.y0 && this.y < st.y1; this.flash = 0.35; this.events.push({ k: 'flash', hit: inside }); if (inside) { this.bump(2); this.vy -= 3; } }
    // birds
    for (const b of this.birds()) if (Math.abs(b.x - this.x) < 9 && b.y > this.y - 2 && b.y < this.y + ENVELOPE) this.bump();
    // cloudberries: skim the bushes with the basket
    this.lv.bushes.forEach((bx, i) => {
      if (this.picked[i]) return; const top = groundAt(this.ter, bx) + 1.5;
      // (Dora leans out with a berry net, so the basket only has to pass within a few metres)
      if (Math.abs(this.x - bx) < 5 && this.y > top - 1 && this.y < top + PICK) { this.picked[i] = true; this.berries += 3; this.events.push({ k: 'berry', n: this.berries }); }
    });
    // touching down
    const surf = surfaceAt(this.ter, this.x);
    if (this.y <= surf) {
      const g = groundAt(this.ter, this.x), onWater = this.ter.lake(this.x) && surf <= this.ter.water + 0.01, onTrees = surf > g + 0.5;
      this.y = surf;
      if (onWater) { this.end('splash'); return; }
      if (this.vy < -CRASH && !onTrees) { this.touchV = -this.vy; this.end('crash'); return; }
      if (onTrees || this.vy < -SOFT || Math.abs(this.vx) > 4) { this.vy = Math.abs(this.vy) * 0.35 + 0.5; this.vx *= 0.5; this.bump(); return; }
      this.touchV = -this.vy; this.vy = 0; this.vx = 0; this.grounded = true;
      const pad = this.lv.pads.find((p) => Math.abs(this.x - p.x) <= p.w / 2) ?? null; this.pad = pad;
      this.events.push({ k: 'touch', soft: true, pad: pad?.name ?? null });
      this.heat = Math.min(this.heat, this.neutral() - 0.02);
      if (pad?.kind === 'finish') { this.end('landed'); return; }
      if (pad?.kind === 'village' && this.fuel < this.lv.fuel) { this.fuel = this.lv.fuel; this.events.push({ k: 'refuel' }); }
    }
  }
  private stepParcel(p: Parcel, t: number, quiet: boolean) {
    // a little parachute: it falls at 4 m/s and drifts with the wind
    p.vy += (-4 - p.vy) * (1 - Math.exp(-DT / 0.6)); p.vx += (this.wind(p.x, p.y, t) - p.vx) * (1 - Math.exp(-DT / 1.2));
    p.x += p.vx * DT; p.y += p.vy * DT;
    if (p.y <= surfaceAt(this.ter, p.x)) {
      p.done = true; if (quiet) return;
      let best = -1, bd = 99;
      this.lv.drops.forEach((d, i) => { const dd = Math.abs(d.x - p.x); if (!this.delivered[i] && dd < bd) { bd = dd; best = i; } });
      const hit = bd < 2.5 ? 'perfect' : bd < 7 ? 'good' : 'miss';
      if (hit !== 'miss' && best >= 0) this.delivered[best] = hit;
      this.events.push({ k: 'parcel', hit, who: hit !== 'miss' && best >= 0 ? this.lv.drops[best].name : null });
    }
  }
  private bump(lost = 1) {
    if (this.bumpT > 0) return; this.bumpT = 1; this.bumps++;
    const n = Math.min(this.berries, lost); this.berries -= n; this.events.push({ k: 'bump', lost: n });
  }
  private checkStranded() { if (this.fuel <= 0 && this.pad?.kind !== 'village' && this.heat < this.neutral()) this.end('stranded'); }
  private end(why: End) { this.over = true; this.why = why; this.events.push({ k: 'end', why }); }
  /** the result of a finished hop: points and stars */
  result() {
    const lv = this.lv, landed = this.why === 'landed';
    const hits = this.delivered.filter(Boolean).length, perfect = this.delivered.filter((d) => d === 'perfect').length;
    const soft = landed ? Math.round(clamp((SOFT - this.touchV) / SOFT, 0, 1) * 200) : 0;
    const time = landed ? Math.max(0, Math.round((lv.par - this.t) * 2)) : 0;
    const points = landed ? this.berries * 20 + perfect * 150 + (hits - perfect) * 75 + soft + Math.round(this.fuel) * 2 + time + 300 : 0;
    const stars = landed ? 1 + (hits === lv.drops.length ? 1 : 0) + (this.berries >= lv.berryGoal ? 1 : 0) : 0;
    return { landed, points, stars, berries: this.berries, hits, perfect, soft, time, fuel: Math.round(this.fuel) };
  }
}

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'cloudberry-balloon-v1';
export type Save = {
  v: 1; best: Partial<Record<LevelId, { points: number; stars: number }>>; intro: boolean; ending: boolean;
  settings: { sound: boolean; music: boolean; guide: boolean }; stats: { flights: number; berries: number; parcels: number; splashes: number };
};
export const newSave = (): Save => ({ v: 1, best: {}, intro: false, ending: false, settings: { sound: true, music: true, guide: true }, stats: { flights: 0, berries: 0, parcels: 0, splashes: 0 } });
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  let d: Record<string, unknown>; try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return s;
  const b = (d.best && typeof d.best === 'object' && !Array.isArray(d.best) ? d.best : {}) as Record<string, unknown>;
  for (const lv of LEVELS) { const e = b[lv.id] as Record<string, unknown> | undefined; if (e && typeof e === 'object') s.best[lv.id] = { points: num(e.points, 0, 1e7, 0), stars: num(e.stars, 0, 3, 0) }; }
  s.intro = d.intro === true; s.ending = d.ending === true;
  const st = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  for (const k of ['sound', 'music', 'guide'] as const) if (typeof st[k] === 'boolean') s.settings[k] = st[k] as boolean;
  const ss = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as Record<string, unknown>;
  for (const k of Object.keys(s.stats) as (keyof Save['stats'])[]) s.stats[k] = num(ss[k], 0, 1e9, 0);
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** a hop is open once the one before it has been landed */
export const unlocked = (s: Save, id: LevelId) => { const i = LEVELS.findIndex((l) => l.id === id); return i === 0 || !!s.best[LEVELS[i - 1].id]; };
export const totalStars = (s: Save) => LEVELS.reduce((a, l) => a + (s.best[l.id]?.stars ?? 0), 0);
/** fold a finished flight into the save */
export function record(s: Save, f: Flight) {
  const r = f.result(); s.stats.flights++; s.stats.berries += r.berries; s.stats.parcels += r.hits; if (f.why === 'splash') s.stats.splashes++;
  const old = s.best[f.lv.id], best = !!r.landed && (!old || r.points > old.points);
  if (r.landed) s.best[f.lv.id] = { points: Math.max(old?.points ?? 0, r.points), stars: Math.max(old?.stars ?? 0, r.stars) };
  const ending = r.landed && f.lv.id === 'meadow' && !s.ending; if (ending) s.ending = true;
  return { ...r, best, ending };
}

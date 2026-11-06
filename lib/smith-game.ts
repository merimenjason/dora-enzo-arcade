// Pixel Smith: the rules. Enzo draws Dora's weapon pixel by pixel on a 12 by 12 grid at his easel, and Dora fights
// with exactly what he drew: the weapon's shape is its hitbox and its colours are its powers (gold cuts, grey knocks
// back, blue freezes, red burns, green heals). Critters burst into loose pixels that are the paint for the next
// weapon, and Dora's health is her own fur, so every pixel spent on a bigger weapon is one that can't patch her up.
// Deterministic at 60 ticks a second from a seed, with no DOM: the page draws it, the tests and bots drive it directly.

export const DT = 1 / 60;
export const W = 384, H = 216;
/** the floor Dora and the critters can stand on */
export const FLOOR = { x0: 24, y0: 46, x1: 360, y1: 206 };
export const GRID = 12;
/** game pixels per weapon pixel */
export const CELL = 2;
/** the handle: the one cell that is always there, bottom left of the grid */
export const GRIP = (GRID - 1) * GRID;
export const FUR = 30;
export const PATCH = 2;
export const ROOMS = 10, PER_FLOOR = [3, 3, 4];
/** the rooms after which Enzo opens his sketchbook */
export const PERK_AFTER = [2, 5, 8];
export const DORA_R = 6;

export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- paint
export type Paint = 'grey' | 'gold' | 'blue' | 'red' | 'green';
export const PAINTS: Paint[] = ['grey', 'gold', 'blue', 'red', 'green'];
export const PAINT: Record<Paint, { name: string; hex: string; text: string }> = {
  grey: { name: 'Stone', hex: '#8a8f9c', text: 'Cheap and heavy: a little damage and a big shove.' },
  gold: { name: 'Gold', hex: '#f2c14e', text: 'Cuts: the most damage of any colour.' },
  blue: { name: 'Frost', hex: '#5cb8f0', text: 'Chills: slows a critter, and enough of it freezes one solid.' },
  red: { name: 'Ember', hex: '#e8503a', text: 'Burns: a critter keeps losing health for a few seconds.' },
  green: { name: 'Moss', hex: '#5cc860', text: 'Heals: every green pixel that lands grows back a little of Dora’s fur.' },
};
export type Cells = (Paint | null)[];
export const noPaint = (): Record<Paint, number> => ({ grey: 0, gold: 0, blue: 0, red: 0, green: 0 });
const DMG: Record<Paint | 'wood', number> = { wood: 0.5, grey: 0.6, gold: 1, blue: 0.3, red: 0.3, green: 0.3 };
/** how much harder a pixel hits than one at the paw */
export const tip = (i: number) => 0.6 + local(i).a / 12;
/** seconds of chill that freeze a critter solid */
export const FROZEN = 2;

/** the 8 neighbours of a cell (corners count, so a diagonal line of pixels holds together) */
export function around(i: number) {
  const x = i % GRID, y = Math.floor(i / GRID), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((dx || dy) && nx >= 0 && ny >= 0 && nx < GRID && ny < GRID) out.push(ny * GRID + nx);
  }
  return out;
}
/** cells joined to the handle through other painted cells */
export function attached(cells: Cells) {
  const seen = new Set<number>([GRIP]), todo = [GRIP];
  while (todo.length) for (const n of around(todo.pop()!)) if (!seen.has(n) && cells[n]) { seen.add(n); todo.push(n); }
  return seen;
}
/** where a cell sits along the weapon (a, from the hand towards the tip) and across it (b), in cells. The weapon is
 *  the picture on the easel turned so its diagonal from the handle to the top right corner points the way Dora aims. */
export function local(i: number) {
  const u = (i % GRID) + 0.5, v = GRID - 1 - Math.floor(i / GRID) + 0.5;
  return { a: (u + v) / Math.SQRT2, b: (u - v) / Math.SQRT2 };
}
export function weaponStats(cells: Cells, perks: PerkLevels = noPerks()) {
  const n = cells.filter(Boolean).length;
  const count = noPaint(); for (const c of cells) if (c) count[c]++;
  let reach = local(GRIP).a;
  cells.forEach((c, i) => { if (c) reach = Math.max(reach, local(i).a); });
  const load = n * (perks.light ? 0.5 : 1);
  return {
    pixels: n, count,
    /** game pixels from Dora's paw to the tip */
    reach: Math.round(reach * CELL + 5),
    /** seconds a swing takes */
    swing: (0.2 + 0.005 * load) * (perks.twirl ? 1.3 : 1),
    speed: 78 * (1 - Math.min(0.45, load * 0.0035)),
  };
}
/** shapes Enzo can sketch in one go: rows of the grid, top first, '#' to paint. Painted in order from the handle out. */
export const SHAPES: Record<string, { name: string; rows: string[] }> = {
  sword: { name: 'Sword', rows: ['..........##', '.........###', '........###.', '.......###..', '......###...', '.....###....', '....###.....', '...###......', '#.###.......', '.###........', '.##.........', '#.#.........'] },
  dagger: { name: 'Dagger', rows: ['............', '............', '............', '............', '............', '............', '.....#......', '....##......', '...##.......', '#.##........', '.##.........', '#.#.........'] },
  hammer: { name: 'Hammer', rows: ['............', '............', '.....####...', '....######..', '...#######..', '...######...', '....####....', '...#........', '..#.........', '.#..........', '#...........', '#...........'] },
  fan: { name: 'Fan', rows: ['............', '............', '............', '#####.......', '#####.......', '#####.......', '####........', '####........', '###.........', '##..........', '#...........', '#...........'] },
};

// ---------------------------------------------------------------- critters
export type Kind = 'pebble' | 'glint' | 'frost' | 'ember' | 'moss' | 'smudge';
export const FOES: Record<Kind, { name: string; hp: number; r: number; speed: number; bite: number; drop: Paint; drops: number; cost: number; text: string }> = {
  pebble: { name: 'Pebble Beetle', hp: 5, r: 7, speed: 26, bite: 4, drop: 'grey', drops: 3, cost: 1, text: 'Plods straight at Dora. Bursts into grey stone pixels.' },
  glint: { name: 'Glint Magpie', hp: 3, r: 6, speed: 20, bite: 4, drop: 'gold', drops: 3, cost: 1.3, text: 'Circles about, then swoops. Watch for its sparkle. Bursts into gold.' },
  frost: { name: 'Frost Newt', hp: 6, r: 7, speed: 16, bite: 2, drop: 'blue', drops: 3, cost: 1.6, text: 'Keeps its distance and spits ice. A wall of pixels blocks the ice, but loses the pixel it hits.' },
  ember: { name: 'Ember Salamander', hp: 7, r: 7, speed: 34, bite: 3, drop: 'red', drops: 3, cost: 1.6, text: 'Fast and hot: a bump sets Dora’s fur smouldering. Bursts into red.' },
  moss: { name: 'Moss Tortoise', hp: 10, r: 8, speed: 15, bite: 3, drop: 'green', drops: 4, cost: 2, text: 'Slow, but heals every critter near it. Get it first.' },
  smudge: { name: 'The Smudge', hp: 260, r: 19, speed: 22, bite: 5, drop: 'gold', drops: 0, cost: 0, text: 'A giant rubber eraser with a grumpy face. Its rub wipes pixels clean off the weapon.' },
};
export const FLOORS = [
  { id: 'mine', name: 'Pebble Mine', kinds: ['pebble', 'glint'] as Kind[] },
  { id: 'cellar', name: 'Frost Cellar', kinds: ['pebble', 'glint', 'frost'] as Kind[] },
  { id: 'forge', name: 'Ember Forge', kinds: ['pebble', 'frost', 'ember', 'moss'] as Kind[] },
] as const;
export type FloorId = (typeof FLOORS)[number]['id'];
const BUDGET = [5, 7.5, 10, 10, 12.5, 15, 14, 17, 20];

// ---------------------------------------------------------------- perks: Enzo's sketchbook
export const PERKS = [
  { id: 'thick', name: 'Thick fur', text: 'Dora grows 10 more fur, and it all grows back now.' },
  { id: 'pots', name: 'Bigger pots', text: 'Every critter bursts into one more pixel.' },
  { id: 'polish', name: 'Polish', text: 'Gold pixels cut half as deep again.' },
  { id: 'snap', name: 'Cold snap', text: 'Blue chills twice as fast.' },
  { id: 'coals', name: 'Hot coals', text: 'Red burns twice as long.' },
  { id: 'thumb', name: 'Green thumb', text: 'Green heals twice as much.' },
  { id: 'light', name: 'Feather handle', text: 'The weapon weighs half as much: faster swings and quicker feet.' },
  { id: 'twirl', name: 'Twirl', text: 'Every swing goes all the way round, a little slower.' },
  { id: 'paws', name: 'Quick paws', text: 'Roll twice as often.' },
  { id: 'patch', name: 'Fur patch', text: 'One pixel of paint patches 4 fur instead of 2.' },
] as const;
export type PerkId = (typeof PERKS)[number]['id'];
export type PerkLevels = Record<PerkId, number>;
export const noPerks = (): PerkLevels => Object.fromEntries(PERKS.map((p) => [p.id, 0])) as PerkLevels;

// ---------------------------------------------------------------- the run
export type Phase = 'easel' | 'fight' | 'pick' | 'won' | 'lost';
export type Input = { mx: number; my: number; ax: number; ay: number; swing: boolean; roll: boolean };
export type Foe = {
  id: number; k: Kind; x: number; y: number; vx: number; vy: number; hp: number; max: number; r: number;
  /** a timer for whatever the critter does next */ t: number; mode: 'walk' | 'wind' | 'dash' | 'rub' | 'spawn';
  dx: number; dy: number; chill: number; burn: number; hitBy: number; flash: number;
};
export type Shot = { x: number; y: number; vx: number; vy: number; k: 'ice'; t: number };
export type Loose = { x: number; y: number; vx: number; vy: number; c: Paint; t: number };
export type Ev =
  | { k: 'swing' | 'roll' | 'hurt' | 'clear' | 'spawn' | 'shoot' | 'wind' | 'rub' | 'heal' | 'freeze' | 'burnt' | 'won' | 'lost' | 'dash'; x: number; y: number }
  | { k: 'hit'; x: number; y: number; n: number; c: Paint | 'wood' }
  | { k: 'kill'; x: number; y: number; foe: Kind }
  | { k: 'chip' | 'block' | 'pick'; x: number; y: number; c: Paint };

export class Run {
  seed: number; rs: number;
  phase: Phase = 'easel';
  room = 0;
  cells: Cells = Array(GRID * GRID).fill(null);
  paint = noPaint();
  perks = noPerks();
  offer: PerkId[] = [];
  dora = { x: 192, y: 150, vx: 0, vy: 0, fur: FUR, inv: 0, roll: 0, rollCd: 0, rx: 0, ry: 0, slow: 0, smoulder: 0, heal: 0, kick: 0, kx: 0, ky: 0 };
  aim = 0;
  /** the swing: seconds into it (or -1), how long it lasts, and which way it sweeps */
  sw = { t: -1, len: 0.3, dir: 1, cd: 0, n: 0 };
  foes: Foe[] = [];
  shots: Shot[] = [];
  loose: Loose[] = [];
  waves: Kind[][] = [];
  wave = 0;
  nextId = 1;
  clock = 0;
  events: Ev[] = [];
  seen: Kind[] = [];
  stats = { kills: 0, pixels: 0, bumps: 0, rooms: 0, time: 0, biggest: 0, chipped: 0 };
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1; this.rs = this.seed;
    this.paint = { ...noPaint(), grey: 12, gold: 6 };
  }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  get floor() { let n = this.room; for (let f = 0; f < PER_FLOOR.length; f++) { if (n < PER_FLOOR[f]) return FLOORS[f]; n -= PER_FLOOR[f]; } return FLOORS[2]; }
  get furMax() { return FUR + this.perks.thick * 10; }
  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get stat() { return weaponStats(this.cells, this.perks); }
  get boss() { return this.room === ROOMS - 1; }
  get swinging() { return this.sw.t >= 0; }

  // ---------------------------------------------------------------- the easel
  /** paints one cell; it has to touch the handle or a painted cell joined to it */
  paintCell(i: number, c: Paint) {
    if (this.phase !== 'easel' || i === GRIP || i < 0 || i >= GRID * GRID) return false;
    const was = this.cells[i];
    if (was === c) return false;
    if (!was && !around(i).some((n) => n === GRIP || (this.cells[n] && attached(this.cells).has(n)))) return false;
    if (this.paint[c] <= 0) return false;
    this.paint[c]--; if (was) this.paint[was]++;
    this.cells[i] = c;
    this.stats.biggest = Math.max(this.stats.biggest, this.stat.pixels);
    return true;
  }
  /** rubs a cell out, and anything left hanging falls off with it; all of it goes back in the pots */
  eraseCell(i: number) {
    if (this.phase !== 'easel' || !this.cells[i]) return false;
    this.paint[this.cells[i]!]++; this.cells[i] = null;
    this.dropLoose(true);
    return true;
  }
  clearWeapon() { if (this.phase !== 'easel') return; this.cells.forEach((c, i) => { if (c) { this.paint[c]++; this.cells[i] = null; } }); }
  /** sketches a shape from the handle out, using the given colours in order of preference while the paint lasts */
  sketch(shape: string, prefer: Paint[]) {
    if (this.phase !== 'easel' || !SHAPES[shape]) return 0;
    this.clearWeapon();
    const want = SHAPES[shape].rows.flatMap((row, y) => [...row].map((ch, x) => (ch === '#' ? y * GRID + x : -1))).filter((i) => i >= 0 && i !== GRIP);
    want.sort((p, q) => local(p).a - local(q).a);
    let n = 0;
    for (const i of want) {
      const c = prefer.find((p) => this.paint[p] > 0) ?? PAINTS.find((p) => this.paint[p] > 0);
      if (!c) break;
      if (this.paintCell(i, c)) n++;
    }
    return n;
  }
  /** spends one pixel of paint to patch Dora's fur */
  patch(c: Paint) {
    if (this.phase !== 'easel' || this.paint[c] <= 0 || this.dora.fur >= this.furMax) return false;
    this.paint[c]--; this.dora.fur = Math.min(this.furMax, this.dora.fur + (this.perks.patch ? 4 : PATCH));
    return true;
  }
  /** off to the next room with whatever is on the easel */
  fight() {
    if (this.phase !== 'easel') return false;
    this.phase = 'fight'; this.enter();
    return true;
  }
  pick(id?: PerkId) {
    if (this.phase !== 'pick') return false;
    if (id) { if (!this.offer.includes(id)) return false; this.perks[id]++; if (id === 'thick') this.dora.fur = this.furMax; }
    this.offer = []; this.phase = 'easel';
    return true;
  }

  // ---------------------------------------------------------------- rooms
  private enter() {
    const d = this.dora;
    Object.assign(d, { x: 192, y: 176, vx: 0, vy: 0, inv: 1, roll: 0, rollCd: 0, slow: 0, smoulder: 0, kick: 0 });
    this.aim = -Math.PI / 2; this.sw.t = -1; this.sw.cd = 0;
    this.foes = []; this.shots = []; this.loose = []; this.clock = 0; this.wave = 0;
    this.waves = this.plan(this.room);
    this.spawnWave();
  }
  plan(n: number): Kind[][] {
    if (n === ROOMS - 1) return [['smudge'], ['pebble', 'pebble', 'ember'], ['frost', 'moss', 'pebble']];
    const kinds = this.floor.kinds, waves: Kind[][] = [];
    let budget = BUDGET[n];
    const count = n < 3 ? 2 : 3;
    for (let w = 0; w < count; w++) {
      const share = w === count - 1 ? budget : budget / (count - w) * (0.85 + this.rnd() * 0.3), wave: Kind[] = [];
      let left = share;
      // the newest kind of each floor turns up in its first room for sure
      if (w === 0 && (n === PER_FLOOR[0] || n === PER_FLOOR[0] + PER_FLOOR[1])) {
        const k = kinds[kinds.length - 1]; wave.push(k); left -= FOES[k].cost;
      }
      while (left >= 1) {
        const can = kinds.filter((k) => FOES[k].cost <= left + 0.01);
        if (!can.length) break;
        const k = can[Math.floor(this.rnd() * can.length)]; wave.push(k); left -= FOES[k].cost;
      }
      if (!wave.length) wave.push('pebble');
      budget -= share - Math.max(0, left); waves.push(wave);
    }
    return waves;
  }
  private spawnWave() {
    const d = this.dora, spots = [{ x: 192, y: 50 }, { x: 34, y: 120 }, { x: 350, y: 120 }, { x: 50, y: 56 }, { x: 334, y: 56 }, { x: 110, y: 52 }, { x: 274, y: 52 }, { x: 60, y: 190 }, { x: 324, y: 190 }];
    const wave = this.waves[this.wave] ?? [];
    wave.forEach((k, j) => {
      const f = FOES[k];
      // spread out from the far side of Dora
      const far = spots.map((s, i) => ({ s, i, d: Math.hypot(s.x - d.x, s.y - d.y) + ((i + j * 3) % spots.length) * 9 })).sort((p, q) => q.d - p.d);
      const s = far[j % far.length].s;
      const x = clamp(s.x + (this.rnd() - 0.5) * 30, FLOOR.x0 + f.r, FLOOR.x1 - f.r), y = clamp(s.y + this.rnd() * 20, FLOOR.y0 + f.r, FLOOR.y1 - f.r);
      const hp = k === 'smudge' ? f.hp : f.hp * (1 + this.room * 0.12);
      this.foes.push({ id: this.nextId++, k, x, y, vx: 0, vy: 0, hp, max: hp, r: f.r, t: 0.9, mode: 'spawn', dx: 0, dy: 0, chill: 0, burn: 0, hitBy: -1, flash: 0 });
      if (!this.seen.includes(k)) this.seen.push(k);
      this.ev({ k: 'spawn', x, y });
    });
    this.wave++;
  }
  private ev(e: Ev) { this.events.push(e); }

  // ---------------------------------------------------------------- a tick
  tick(inp: Input) {
    this.events = [];
    if (this.phase !== 'fight') return;
    this.clock += DT; this.stats.time += DT;
    const d = this.dora, st = this.stat;
    // aim and swing
    if (!this.swinging) this.aim = Math.atan2(inp.ay - (d.y - 6), inp.ax - d.x);
    this.sw.cd = Math.max(0, this.sw.cd - DT);
    if (this.swinging) {
      this.sw.t += DT;
      if (this.sw.t >= this.sw.len) { this.sw.t = -1; this.sw.cd = 0.08; }
    } else if (inp.swing && this.sw.cd <= 0 && d.roll <= 0) {
      this.sw = { t: 0, len: st.swing, dir: -this.sw.dir || 1, cd: 0, n: this.sw.n + 1 };
      this.ev({ k: 'swing', x: d.x, y: d.y });
    }
    // Dora moves, or rolls
    d.inv = Math.max(0, d.inv - DT); d.rollCd = Math.max(0, d.rollCd - DT); d.slow = Math.max(0, d.slow - DT);
    if (inp.roll && d.roll <= 0 && d.rollCd <= 0 && !this.swinging) {
      let mx = inp.mx, my = inp.my; if (!mx && !my) { mx = Math.cos(this.aim); my = Math.sin(this.aim); }
      const l = Math.hypot(mx, my); d.rx = mx / l; d.ry = my / l; d.roll = 0.26; d.rollCd = this.perks.paws ? 0.35 : 0.7;
      this.ev({ k: 'roll', x: d.x, y: d.y });
    }
    if (d.roll > 0) { d.roll -= DT; d.vx = d.rx * 175; d.vy = d.ry * 175; }
    else {
      let mx = inp.mx, my = inp.my; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      const sp = st.speed * (d.slow > 0 ? 0.5 : 1) * (this.swinging ? 0.55 : 1);
      d.vx = mx * sp; d.vy = my * sp;
    }
    if (d.kick > 0) { d.kick -= DT; d.vx += d.kx; d.vy += d.ky; }
    d.x = clamp(d.x + d.vx * DT, FLOOR.x0 + DORA_R, FLOOR.x1 - DORA_R);
    d.y = clamp(d.y + d.vy * DT, FLOOR.y0 + DORA_R, FLOOR.y1 - DORA_R);
    if (d.smoulder > 0) {
      const before = Math.ceil(d.smoulder / 0.7); d.smoulder -= DT;
      if (Math.ceil(d.smoulder / 0.7) < before) this.lose(1, false);
    }
    this.foesTick();
    this.shotsTick();
    if (this.swinging) this.strike();
    this.looseTick();
    // the room is done when every wave is beaten
    if (this.phase === 'fight' && !this.foes.some((f) => f.hp > 0)) {
      if (this.wave < this.waves.length) this.spawnWave();
      else this.clear();
    }
    if (this.phase === 'fight' && d.fur <= 0) { this.phase = 'lost'; this.ev({ k: 'lost', x: d.x, y: d.y }); }
  }

  /** every painted cell of the weapon where it is right now, in game pixels */
  cellsNow() {
    const d = this.dora, out: { i: number; x: number; y: number; c: Paint | 'wood' }[] = [];
    const arc = this.perks.twirl ? Math.PI * 2 : 2.4;
    const th = this.swinging ? this.aim + this.sw.dir * (-arc / 2 + arc * this.ease(this.sw.t / this.sw.len)) : this.aim + (Math.cos(this.aim) >= 0 ? 0.5 : -0.5);
    const hx = d.x + Math.cos(th) * 4, hy = d.y - 6 + Math.sin(th) * 4, cs = Math.cos(th), sn = Math.sin(th);
    const put = (i: number, c: Paint | 'wood') => { const { a, b } = local(i); out.push({ i, c, x: hx + (cs * a - sn * b) * CELL, y: hy + (sn * a + cs * b) * CELL }); };
    put(GRIP, 'wood');
    this.cells.forEach((c, i) => { if (c) put(i, c); });
    return { cells: out, angle: th, hx, hy };
  }
  ease(p: number) { return p < 0 ? 0 : p > 1 ? 1 : 1 - Math.pow(1 - p, 2.2); }

  private strike() {
    const { cells } = this.cellsNow(), d = this.dora, pk = this.perks;
    for (const f of this.foes) {
      if (f.hp <= 0 || f.hitBy === this.sw.n || f.mode === 'spawn') continue;
      const touch = cells.filter((c) => Math.hypot(c.x - f.x, c.y - (f.y - f.r * 0.6)) < f.r + CELL * 0.7).slice(0, 14);
      if (!touch.length) continue;
      f.hitBy = this.sw.n; f.flash = 0.12;
      const n = noPaint(); let wood = 0, dmg = 0;
      // pixels further from the paw move faster through a swing, so they hit harder: the tip hits hardest
      for (const c of touch) {
        if (c.c === 'wood') wood++; else n[c.c]++;
        dmg += DMG[c.c] * (c.c === 'gold' ? 1 + 0.5 * pk.polish : 1) * tip(c.i);
      }
      if (f.k === 'smudge') dmg *= 0.8;
      f.hp -= dmg;
      if (n.blue) { f.chill = Math.min(4, f.chill + n.blue * 0.25 * (pk.snap ? 2 : 1)); if (f.chill >= FROZEN && f.k !== 'smudge') this.ev({ k: 'freeze', x: f.x, y: f.y }); }
      if (n.red) { f.burn = Math.min(6, f.burn + n.red * 0.5 * (pk.coals ? 2 : 1)); this.ev({ k: 'burnt', x: f.x, y: f.y }); }
      if (n.green) { const h = Math.min(4, n.green * 0.5 * (pk.thumb ? 2 : 1)); d.heal += h; this.ev({ k: 'heal', x: d.x, y: d.y }); }
      if (n.grey) {
        const a = Math.atan2(f.y - d.y, f.x - d.x), push = Math.min(170, 26 * n.grey) * (f.k === 'smudge' ? 0.15 : 1);
        f.vx = Math.cos(a) * push; f.vy = Math.sin(a) * push;
        if (f.mode === 'dash' || f.mode === 'wind') { f.mode = 'walk'; f.t = 1.2; }
      }
      const top = (['gold', 'grey', 'blue', 'red', 'green'] as Paint[]).reduce<Paint | 'wood'>((b, c) => (n[c] > (b === 'wood' ? wood : n[b]) ? c : b), 'wood');
      this.ev({ k: 'hit', x: f.x, y: f.y - f.r, n: touch.length, c: top });
      if (f.hp <= 0) this.kill(f);
    }
    while (d.heal >= 1) { d.heal--; d.fur = Math.min(this.furMax, d.fur + 1); }
  }
  private kill(f: Foe) {
    f.hp = 0; this.stats.kills++;
    const def = FOES[f.k];
    this.ev({ k: 'kill', x: f.x, y: f.y, foe: f.k });
    if (f.k === 'smudge') {
      // the Smudge bursts into a bit of everything
      for (const c of PAINTS) for (let j = 0; j < 4; j++) this.spill(f.x, f.y, c);
      for (const g of this.foes) if (g !== f && g.hp > 0) this.kill(g);
      return;
    }
    for (let j = 0; j < def.drops + this.perks.pots; j++) this.spill(f.x, f.y, def.drop);
  }
  private spill(x: number, y: number, c: Paint, sp = 55) {
    const a = this.rnd() * Math.PI * 2, v = sp * (0.4 + this.rnd() * 0.6);
    this.loose.push({ x, y: y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, t: 0 });
  }
  /** knocks a weapon cell off; it lands on the floor as a loose pixel, and so does anything left hanging */
  knock(i: number) {
    const c = this.cells[i]; if (!c) return;
    const where = this.cellsNow().cells.find((p) => p.i === i)!;
    this.cells[i] = null; this.stats.chipped++;
    this.ev({ k: 'chip', x: where.x, y: where.y, c });
    this.loose.push({ x: where.x, y: where.y, vx: (this.rnd() - 0.5) * 60, vy: -20 - this.rnd() * 30, c, t: 0 });
    this.dropLoose(false);
  }
  private dropLoose(refund: boolean) {
    const keep = attached(this.cells), pos = refund ? null : this.cellsNow().cells;
    this.cells.forEach((c, i) => {
      if (!c || keep.has(i)) return;
      this.cells[i] = null;
      if (refund) { this.paint[c]++; return; }
      const p = pos!.find((q) => q.i === i)!;
      this.loose.push({ x: p.x, y: p.y, vx: (this.rnd() - 0.5) * 60, vy: -10 - this.rnd() * 30, c, t: 0 });
    });
  }
  private lose(n: number, kick = true, from?: { x: number; y: number }) {
    const d = this.dora;
    d.fur = Math.max(0, d.fur - n); this.stats.bumps++;
    if (kick) {
      d.inv = 0.8;
      if (from) { const a = Math.atan2(d.y - from.y, d.x - from.x); d.kx = Math.cos(a) * 9; d.ky = Math.sin(a) * 9; d.kick = 0.15; }
    }
    this.ev({ k: 'hurt', x: d.x, y: d.y });
  }
  private hurtable() { const d = this.dora; return d.inv <= 0 && d.roll <= 0; }

  private foesTick() {
    const d = this.dora;
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
      const def = FOES[f.k];
      f.flash = Math.max(0, f.flash - DT);
      if (f.mode === 'spawn') { f.t -= DT; if (f.t <= 0) { f.mode = 'walk'; f.t = 0.5 + this.rnd() * 1.5; } continue; }
      if (f.burn > 0) { f.burn -= DT; f.hp -= 2 * DT; if (f.hp <= 0) { this.kill(f); continue; } }
      const chill = f.chill > 0 ? (f.chill -= DT, f.chill >= FROZEN && f.k !== 'smudge' ? 0 : 0.5) : 1;
      const dx = d.x - f.x, dy = d.y - f.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
      let vx = 0, vy = 0;
      f.t -= DT * (chill || 0);
      switch (f.k) {
        case 'pebble': vx = ux * def.speed; vy = uy * def.speed; break;
        case 'ember': vx = ux * def.speed; vy = uy * def.speed; break;
        case 'moss':
          vx = ux * def.speed; vy = uy * def.speed;
          for (const g of this.foes) if (g !== f && g.hp > 0 && g.k !== 'smudge' && Math.hypot(g.x - f.x, g.y - f.y) < 55) g.hp = Math.min(g.max, g.hp + 1.2 * DT * (chill ? 1 : 0));
          break;
        case 'glint':
          if (f.mode === 'walk') {
            vx = -uy * def.speed + ux * 6; vy = ux * def.speed + uy * 6;
            if (f.t <= 0 && dist < 150) { f.mode = 'wind'; f.t = 0.55; this.ev({ k: 'wind', x: f.x, y: f.y }); }
          } else if (f.mode === 'wind') { if (f.t <= 0) { f.mode = 'dash'; f.t = 0.4; f.dx = ux; f.dy = uy; this.ev({ k: 'dash', x: f.x, y: f.y }); } }
          else if (f.mode === 'dash') { vx = f.dx * 150; vy = f.dy * 150; if (f.t <= 0) { f.mode = 'walk'; f.t = 1.8 + this.rnd(); } }
          break;
        case 'frost': {
          const want = dist > 95 ? 1 : dist < 70 ? -1 : 0;
          vx = ux * def.speed * want - uy * 8; vy = uy * def.speed * want + ux * 8;
          if (f.t <= 0) {
            f.t = 2.1 + this.rnd() * 0.8;
            const sp = 70; this.shots.push({ x: f.x, y: f.y - 6, vx: ux * sp, vy: uy * sp, k: 'ice', t: 0 });
            this.ev({ k: 'shoot', x: f.x, y: f.y });
          }
          break;
        }
        case 'smudge':
          if (f.mode === 'walk') {
            vx = ux * def.speed; vy = uy * def.speed;
            if (f.t <= 0 && dist < 70) { f.mode = 'wind'; f.t = 0.7; f.dx = ux; f.dy = uy; this.ev({ k: 'wind', x: f.x, y: f.y }); }
            else if (f.t <= -4) { f.t = 2; this.waves.push(['pebble', 'pebble']); this.spawnWave(); }
          } else if (f.mode === 'wind') { if (f.t <= 0) { f.mode = 'rub'; f.t = 0.35; this.rub(f); } }
          else if (f.mode === 'rub') { if (f.t <= 0) { f.mode = 'walk'; f.t = 2.4 + this.rnd(); } }
          break;
      }
      // knocked-back critters slide, then walk again
      f.vx *= Math.pow(0.02, DT); f.vy *= Math.pow(0.02, DT);
      f.x = clamp(f.x + (vx * chill + f.vx) * DT, FLOOR.x0 + f.r, FLOOR.x1 - f.r);
      f.y = clamp(f.y + (vy * chill + f.vy) * DT, FLOOR.y0 + f.r, FLOOR.y1 - f.r);
      // and keep out of each other's way
      for (const g of this.foes) {
        if (g === f || g.hp <= 0 || g.id < f.id) continue;
        const ox = g.x - f.x, oy = g.y - f.y, od = Math.hypot(ox, oy) || 1, need = f.r + g.r - 2;
        if (od < need) { const p = (need - od) / 2; f.x -= (ox / od) * p; f.y -= (oy / od) * p; g.x += (ox / od) * p; g.y += (oy / od) * p; }
      }
      if (chill && Math.hypot(d.x - f.x, d.y - f.y) < f.r + DORA_R - 1 && this.hurtable()) {
        this.lose(def.bite, true, f);
        if (f.k === 'ember') d.smoulder = 2.1;
        if (f.mode === 'dash') { f.mode = 'walk'; f.t = 1.8; }
      }
    }
    this.foes = this.foes.filter((f) => f.hp > 0);
  }
  /** the Smudge rubs out a patch in front of it: weapon pixels there come off, and so does Dora's fur */
  private rub(f: Foe) {
    const cx = f.x + f.dx * 26, cy = f.y + f.dy * 26 - 6, d = this.dora;
    this.ev({ k: 'rub', x: cx, y: cy });
    const hit = this.cellsNow().cells.filter((c) => c.c !== 'wood' && Math.hypot(c.x - cx, c.y - cy) < 24).slice(0, 8);
    for (const c of hit) this.knock(c.i);
    if (Math.hypot(d.x - cx, d.y - 6 - cy) < 26 && this.hurtable()) this.lose(FOES.smudge.bite, true, f);
  }
  private shotsTick() {
    const d = this.dora;
    for (const s of this.shots) {
      s.t += DT; s.x += s.vx * DT; s.y += s.vy * DT;
      // a wall of pixels blocks the ice, and loses the pixel it hits
      const block = this.cellsNow().cells.find((c) => Math.hypot(c.x - s.x, c.y - s.y) < CELL + 2.5);
      if (block) {
        s.t = 99; this.ev({ k: 'block', x: s.x, y: s.y, c: block.c === 'wood' ? 'grey' : block.c });
        if (block.c !== 'wood') this.knock(block.i);
        continue;
      }
      if (Math.hypot(d.x - s.x, d.y - 6 - s.y) < DORA_R + 3 && this.hurtable()) { s.t = 99; this.lose(3, true, s); d.slow = 1.2; }
    }
    this.shots = this.shots.filter((s) => s.t < 4 && s.x > 0 && s.x < W && s.y > 0 && s.y < H);
  }
  private looseTick() {
    const d = this.dora, sweep = this.phase !== 'fight' || this.foes.length === 0;
    for (const p of this.loose) {
      p.t += DT;
      const dx = d.x - p.x, dy = d.y - 6 - p.y, dist = Math.hypot(dx, dy);
      if (p.t > 0.35 && (dist < 32 || sweep)) { const sp = 200 / Math.max(8, dist) * 30; p.vx += (dx / dist) * sp * DT * 8; p.vy += (dy / dist) * sp * DT * 8; }
      p.vx *= Math.pow(0.08, DT); p.vy *= Math.pow(0.08, DT);
      p.x = clamp(p.x + p.vx * DT, FLOOR.x0, FLOOR.x1); p.y = clamp(p.y + p.vy * DT, FLOOR.y0 - 10, FLOOR.y1);
      if (p.t > 0.35 && dist < 6) { p.t = -99; this.paint[p.c]++; this.stats.pixels++; this.ev({ k: 'pick', x: p.x, y: p.y, c: p.c }); }
    }
    this.loose = this.loose.filter((p) => p.t >= 0);
  }
  private clear() {
    // the room ends once every loose pixel is in the pots
    if (this.loose.length && this.clock < 600) return;
    const d = this.dora;
    this.stats.rooms++;
    this.ev({ k: 'clear', x: d.x, y: d.y });
    if (this.room === ROOMS - 1) { this.phase = 'won'; this.ev({ k: 'won', x: d.x, y: d.y }); return; }
    const done = this.room;
    this.room++;
    if (PERK_AFTER.includes(done)) { this.makeOffer(); this.phase = this.offer.length ? 'pick' : 'easel'; }
    else this.phase = 'easel';
  }
  makeOffer() {
    const can = PERKS.map((p) => p.id).filter((id) => !this.perks[id]);
    this.offer = [];
    while (this.offer.length < 3 && can.length) this.offer.push(can.splice(Math.floor(this.rnd() * can.length), 1)[0]);
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'pixel-smith-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { rooms: number; kills: number; biggest: number };
  stats: { runs: number; wins: number; kills: number; pixels: number };
  /** the last weapon taken into a fight, for "Draw it again" */
  last: string;
  seen: string[];
  settings: { sound: boolean; music: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { rooms: 0, kills: 0, biggest: 0 }, stats: { runs: 0, wins: 0, kills: 0, pixels: 0 }, last: '', seen: [], settings: { sound: true, music: true } });
const CODE: Record<string, Paint | null> = { '.': null, s: 'grey', g: 'gold', b: 'blue', r: 'red', m: 'green' };
export const cellsCode = (cells: Cells) => cells.map((c) => (c ? Object.keys(CODE).find((k) => CODE[k] === c)! : '.')).join('');
export const codeCells = (s: string): Cells | null => (s.length === GRID * GRID && [...s].every((ch) => ch in CODE) ? [...s].map((ch) => CODE[ch]) : null);
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    s.intro = o.intro === true;
    for (const k of ['rooms', 'kills', 'biggest'] as const) s.best[k] = num(o.best?.[k], 0);
    for (const k of ['runs', 'wins', 'kills', 'pixels'] as const) s.stats[k] = num(o.stats?.[k], 0);
    s.last = typeof o.last === 'string' && codeCells(o.last) ? o.last : '';
    s.seen = Array.isArray(o.seen) ? o.seen.filter((k: unknown): k is string => typeof k === 'string' && k in FOES) : [];
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** adds a finished run to the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.kills += r.stats.kills; s.stats.pixels += r.stats.pixels;
  if (r.phase === 'won') s.stats.wins++;
  s.best.rooms = Math.max(s.best.rooms, r.stats.rooms);
  s.best.kills = Math.max(s.best.kills, r.stats.kills);
  s.best.biggest = Math.max(s.best.biggest, r.stats.biggest);
}
/** draws a saved weapon again from the pots, as far as the paint goes (cells nearest the handle first) */
export function redraw(r: Run, code: string) {
  const want = codeCells(code); if (!want) return 0;
  r.clearWeapon();
  const order = want.map((c, i) => ({ c, i })).filter((p) => p.c && p.i !== GRIP).sort((p, q) => local(p.i).a - local(q.i).a);
  let n = 0;
  // a few passes, since a cell can only go down once its neighbour towards the handle is there
  for (let pass = 0; pass < 4; pass++) for (const p of order) if (!r.cells[p.i] && r.paintCell(p.i, p.c!)) n++;
  return n;
}

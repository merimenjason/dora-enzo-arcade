// Burrow Barrage: turn-based artillery in the style of Gunbound. Two teams of two take turns to set an angle and a
// power and fire across ground that every shot digs away. Rules only, no DOM: a seed and the list of inputs replay
// a match exactly. Distances are in cells; the scene draws each cell CELL pixels wide.

export const W = 400, H = 225;
/** A chinchilla is hit as a circle of UNIT_R, centred UNIT_UP above its feet. */
export const UNIT_R = 7, UNIT_UP = 7;
export const MAX_WIND = 10, MIN_ANGLE = 5, MAX_ANGLE = 175, CLIMB = 4, CHARGE_FULL = 3, DUSK_TURN = 48, DUSK_HURT = 8, SKIP_DELAY = 40;
const DT = 1 / 120, GRAVITY = 150, SPEED = 2.5, WIND_PULL = 3, MAX_TICKS = 120 * 14, SAFE_TICKS = 20, MUZZLE = 11, FALLOFF = 0.65, TUNNEL = 3;
/** Path points are kept every other tick, so a path plays back at this many points a second. */
export const PATH_RATE = 60;

export type RideId = 'catapult' | 'spitter' | 'digger' | 'cannon';
export type ItemId = 'dual' | 'heal' | 'hop';
/**
 * `count` projectiles fan out `spread` degrees apart. Each digs a crater of `crater` cells and hurts anything within
 * `blast` cells of its edge, shoving it `push` cells away. `bore` is how far it tunnels through the ground first.
 * `delay` is how long the shooter then waits for its next turn.
 */
export type ShotDef = { name: string; blurb: string; count: number; spread: number; damage: number; crater: number; blast: number; push: number; bore: number; delay: number };
export type Ride = { name: string; blurb: string; hp: number; move: number; shots: [ShotDef, ShotDef, ShotDef] };

export const RIDE_IDS: RideId[] = ['catapult', 'spitter', 'digger', 'cannon'];
export const RIDES: Record<RideId, Ride> = {
  catapult: {
    name: 'Hay Catapult', blurb: 'Slow and sturdy. Its bales hit hard and dig wide.', hp: 125, move: 26,
    shots: [
      { name: 'Hay Bale', blurb: 'One bale with a wide blast.', count: 1, spread: 0, damage: 30, crater: 13, blast: 18, push: 4, bore: 0, delay: 70 },
      { name: 'Heavy Bale', blurb: 'A packed bale: more hurt, smaller blast, a longer wait.', count: 1, spread: 0, damage: 36, crater: 9, blast: 10, push: 2, bore: 0, delay: 95 },
      { name: 'Bale Storm', blurb: 'Three bales, one after another.', count: 3, spread: 4, damage: 24, crater: 12, blast: 16, push: 4, bore: 0, delay: 125 },
    ],
  },
  spitter: {
    name: 'Seed Spitter', blurb: 'Light and quick, with the shortest waits between turns.', hp: 110, move: 40,
    shots: [
      { name: 'Seed Burst', blurb: 'Three seeds in a narrow fan.', count: 3, spread: 3, damage: 13, crater: 6, blast: 9, push: 1, bore: 0, delay: 65 },
      { name: 'Pip Shot', blurb: 'One hard pip. Tiny blast: it has to land on them.', count: 1, spread: 0, damage: 30, crater: 5, blast: 7, push: 1, bore: 0, delay: 55 },
      { name: 'Seed Hail', blurb: 'Six seeds in a fan.', count: 6, spread: 2.5, damage: 13, crater: 6, blast: 9, push: 1, bore: 0, delay: 110 },
    ],
  },
  digger: {
    name: 'Tunnel Digger', blurb: 'Its shots go through the ground, so hills are no cover.', hp: 120, move: 32,
    shots: [
      { name: 'Mole Shot', blurb: 'Tunnels through the ground, then bursts.', count: 1, spread: 0, damage: 34, crater: 9, blast: 17, push: 2, bore: 26, delay: 75 },
      { name: 'Sinkhole', blurb: 'Little hurt, a huge hole: dig the ground out from under them.', count: 1, spread: 0, damage: 20, crater: 22, blast: 15, push: 0, bore: 0, delay: 85 },
      { name: 'Deep Mole', blurb: 'Tunnels a long way, then bursts hard.', count: 1, spread: 0, damage: 50, crater: 12, blast: 20, push: 3, bore: 60, delay: 120 },
    ],
  },
  cannon: {
    name: 'Dust Cannon', blurb: 'Wide, soft blasts that shove everyone about.', hp: 115, move: 32,
    shots: [
      { name: 'Dust Puff', blurb: 'A wide blast that shoves whatever it reaches.', count: 1, spread: 0, damage: 21, crater: 8, blast: 25, push: 15, bore: 0, delay: 70 },
      { name: 'Gale', blurb: 'Hardly hurts, but shoves a long way: off a ledge, with luck.', count: 1, spread: 0, damage: 8, crater: 4, blast: 30, push: 34, bore: 0, delay: 85 },
      { name: 'Dust Storm', blurb: 'A huge blast and a long shove.', count: 1, spread: 0, damage: 32, crater: 14, blast: 37, push: 25, bore: 0, delay: 120 },
    ],
  },
};

export const ITEM_IDS: ItemId[] = ['dual', 'heal', 'hop'];
export const ITEMS: Record<ItemId, { name: string; blurb: string; delay: number }> = {
  dual: { name: 'Double Shot', blurb: 'Fires the chosen shot twice.', delay: 55 },
  heal: { name: 'Dandelion', blurb: 'Eat it for 40 health. Takes the place of a shot.', delay: 60 },
  hop: { name: 'Burrow Hop', blurb: 'Lob a marker and pop up wherever it lands. Takes the place of a shot.', delay: 50 },
};
export const HEAL = 40;

/** How far the computer's aim strays, in degrees and in points of power, either way. */
export const AI_LEVELS = [
  { name: 'Sleepy', angle: 8, power: 14 },
  { name: 'Sharp', angle: 4, power: 7 },
  { name: 'Deadeye', angle: 1, power: 3 },
];

/**
 * `top(x)` is the row of the ground's surface. `depth` makes the ground that thick with open air under it; `gaps` are
 * columns with no ground at all; `slabs` are extra blocks. `spawns` are the columns for team one's pair, then team two's.
 */
export type MapDef = { name: string; blurb: string; top?: (x: number) => number; depth?: number; gaps?: [number, number][]; slabs?: [number, number, number, number][]; spawns: [number, number, number, number] };
const bump = (x: number, at: number, wide: number) => Math.exp(-(((x - at) / wide) ** 2));
export const MAPS: MapDef[] = [
  { name: 'Clover Meadow', blurb: 'Gentle hills and nowhere to hide.', top: (x) => 150 + 10 * Math.cos((x - 200) / 38) + 5 * Math.cos((x - 200) / 13), spawns: [50, 110, 350, 290] },
  { name: 'Mossy Valley', blurb: 'High banks either side of a deep dip.', top: (x) => 92 + 80 * bump(x, 200, 95) + 3 * Math.cos((x - 200) / 9), spawns: [40, 100, 360, 300] },
  { name: 'The Mound', blurb: 'A hill in the middle. Lob over it or dig through it.', top: (x) => 168 - 92 * bump(x, 200, 42) + 4 * Math.cos((x - 200) / 17), spawns: [45, 110, 355, 290] },
  { name: 'Rope Bridge', blurb: 'Two cliffs and a thin bridge over a long drop.', top: (x) => 122 + 3 * Math.cos((x - 200) / 11), gaps: [[92, 307]], slabs: [[92, 120, 307, 127]], spawns: [45, 150, 355, 250] },
  { name: 'Sky Ledges', blurb: 'Floating ledges. Lose your footing and you are out.', slabs: [[14, 160, 96, 182], [104, 104, 176, 122], [168, 172, 232, 190], [224, 104, 296, 122], [304, 160, 386, 182]], spawns: [55, 140, 345, 260] },
  { name: 'Broken Crags', blurb: 'Steep ridges with two gaps to fall through.', top: (x) => 100 + 62 * Math.abs(((x / 50) % 2) - 1), gaps: [[94, 106], [294, 306]], spawns: [40, 72, 360, 328] },
];

/** One step of the ladder: the map, the rival pair and how well they aim. */
export type Rung = { map: number; rivals: [string, string]; coats: [string, string]; rides: [RideId, RideId]; level: number };
export const LADDER: Rung[] = [
  { map: 0, rivals: ['Pip', 'Mora'], coats: ['pip', 'mora'], rides: ['catapult', 'spitter'], level: 0 },
  { map: 1, rivals: ['Tumble', 'Sprout'], coats: ['tumble', 'sprout'], rides: ['cannon', 'catapult'], level: 0 },
  { map: 2, rivals: ['Ash', 'Cinder'], coats: ['ash', 'cinder'], rides: ['digger', 'catapult'], level: 1 },
  { map: 3, rivals: ['Gust', 'Breeze'], coats: ['gust', 'breeze'], rides: ['cannon', 'spitter'], level: 1 },
  { map: 4, rivals: ['Flint', 'Slate'], coats: ['flint', 'slate'], rides: ['spitter', 'digger'], level: 2 },
  { map: 5, rivals: ['Onyx', 'Opal'], coats: ['onyx', 'opal'], rides: ['catapult', 'digger'], level: 2 },
];

export type Unit = {
  id: number; team: number; name: string; coat: string; ride: RideId;
  x: number; y: number; hp: number; maxHp: number; alive: boolean;
  /** 0 points right, 90 straight up, 180 left. */
  angle: number; power: number;
  /** The power of this unit's last shot, shown as a mark on the power bar; -1 before its first. */
  lastPower: number;
  /** The unit with the lowest delay goes next. */
  delay: number;
  /** Turns taken since the last big shot; the big shot needs CHARGE_FULL. */
  charge: number; items: ItemId[];
  /** Cells walked this turn. */
  moved: number;
};

export type Event =
  | { type: 'turn'; id: number; wind: number; turn: number }
  | { type: 'shot'; id: number; ride: RideId; shot: number; path: number[]; boreAt: number; marker: boolean }
  | { type: 'boom'; x: number; y: number; crater: number; blast: number; circles: number[] }
  | { type: 'hurt'; id: number; amount: number; hp: number }
  | { type: 'shift'; id: number; x: number; y: number }
  | { type: 'out'; id: number; why: 'ko' | 'fell' }
  | { type: 'heal'; id: number; amount: number; hp: number }
  | { type: 'hop'; id: number; x: number; y: number }
  | { type: 'dusk' }
  | { type: 'over'; winner: number };

/** Where a shot came down. `hit` is the unit it struck, or -1; `lost` means it left the map. */
export type Landing = { path: number[]; x: number; y: number; vx: number; vy: number; hit: number; lost: boolean };
export type Plan = { walk: number; shot: number; item: ItemId | null; angle: number; power: number; score: number };
export type Setup = { map: number; seed: number; rides: [[RideId, RideId], [RideId, RideId]]; names?: [[string, string], [string, string]]; coats?: [[string, string], [string, string]]; first?: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function buildTerrain(def: MapDef): Uint8Array {
  const t = new Uint8Array(W * H);
  if (def.top) for (let x = 0; x < W; x++) {
    if (def.gaps?.some(([a, b]) => x >= a && x <= b)) continue;
    const top = Math.round(def.top(x)), end = def.depth ? Math.min(H, top + def.depth) : H;
    for (let y = Math.max(0, top); y < end; y++) t[y * W + x] = 1;
  }
  for (const [x0, y0, x1, y1] of def.slabs ?? []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t[y * W + x] = 1;
  return t;
}

export class Match {
  terrain!: Uint8Array;
  units: Unit[] = [];
  map = 0; seed = 1; wind = 0; turn = 1; activeId = 0;
  state: 'aim' | 'over' = 'aim';
  /** The winning team, or -1 for a draw. */
  winner = -1;
  events: Event[] = [];

  static start(s: Setup): Match {
    const m = new Match();
    m.map = s.map; m.seed = s.seed | 0;
    const def = MAPS[s.map];
    m.terrain = buildTerrain(def);
    const names = s.names ?? [['Dora', 'Enzo'], ['Pip', 'Mora']], coats = s.coats ?? [['dora', 'enzo'], ['pip', 'mora']], first = s.first ?? 0;
    for (let id = 0; id < 4; id++) {
      const team = id >> 1, slot = id & 1, ride = s.rides[team][slot], x = def.spawns[id];
      const u: Unit = {
        id, team, name: names[team][slot], coat: coats[team][slot], ride, x, y: 0, hp: RIDES[ride].hp, maxHp: RIDES[ride].hp, alive: true,
        angle: team === 0 ? 55 : 125, power: 60, lastPower: -1, delay: slot * 20 + (team === first ? 0 : 10), charge: 0, items: [...ITEM_IDS], moved: 0,
      };
      m.units.push(u);
      m.place(u, x, 0);
    }
    m.wind = Math.round(m.rand() * 10 - 5);
    m.activeId = m.next();
    m.events.push({ type: 'turn', id: m.activeId, wind: m.wind, turn: m.turn });
    return m;
  }

  clone(): Match {
    const m = new Match();
    m.terrain = this.terrain.slice(); m.units = this.units.map((u) => ({ ...u, items: [...u.items] }));
    m.map = this.map; m.seed = this.seed; m.wind = this.wind; m.turn = this.turn; m.activeId = this.activeId; m.state = this.state; m.winner = this.winner;
    return m;
  }

  get active(): Unit { return this.units[this.activeId]; }
  get over(): boolean { return this.state === 'over'; }
  unit(id: number): Unit | undefined { return this.units[id]; }
  solid(x: number, y: number): boolean { return x >= 0 && x < W && y >= 0 && y < H && this.terrain[y * W + x] === 1; }
  /** Whether the big shot is charged. */
  charged(u: Unit): boolean { return u.charge >= CHARGE_FULL; }
  /** Who takes the next `n` turns, assuming each takes an ordinary shot. */
  order(n: number): number[] {
    const d = this.units.map((u) => u.delay), out: number[] = [];
    if (this.state === 'over') return out;
    // The active unit's delay only grows once it fires, so count it as already charged here.
    let id = this.activeId;
    for (let i = 0; i < n; i++) {
      out.push(id); d[id] += 75;
      id = -1;
      for (const u of this.units) if (u.alive && (id < 0 || d[u.id] < d[id])) id = u.id;
      if (id < 0) break;
    }
    return out;
  }

  private rand(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private next(): number {
    let id = -1;
    for (const u of this.units) if (u.alive && (id < 0 || u.delay < this.units[id].delay)) id = u.id;
    return id;
  }
  /** The row a unit dropped at (x, y) comes to rest on, or -1 if there is no ground under it. */
  private rest(x: number, y: number): number {
    while (y > 0 && this.solid(x, y)) y--;
    while (y + 1 < H && !this.solid(x, y + 1)) y++;
    return y + 1 >= H ? -1 : y;
  }
  /** Puts a unit down at a column; false means it fell out of the map. */
  private place(u: Unit, x: number, y: number): boolean {
    const r = this.rest(x, y);
    u.x = x; u.y = r < 0 ? H + 20 : r;
    return r >= 0;
  }
  /** One step along the ground from (x, y): the new spot, or null if a wall, the map's edge or a drop into nothing is in the way. */
  private step(x: number, y: number, dir: number): [number, number] | null {
    const nx = x + dir;
    if (nx < UNIT_R || nx > W - 1 - UNIT_R) return null;
    let ny = y;
    if (this.solid(nx, y)) {
      let k = 1;
      while (k <= CLIMB && this.solid(nx, y - k)) k++;
      if (k > CLIMB) return null;
      ny = y - k;
    }
    const r = this.rest(nx, ny);
    return r < 0 ? null : [nx, r];
  }
  /** Where walking up to `steps` cells (negative is left) would end, and how many were taken. */
  private stroll(u: Unit, steps: number): [number, number, number] {
    let x = u.x, y = u.y, n = 0;
    const dir = Math.sign(steps);
    while (n < Math.abs(steps)) { const s = this.step(x, y, dir); if (!s) break; [x, y] = s; n++; }
    return [x, y, n * dir];
  }

  /** Walks the active unit one cell. */
  walk(dir: number): 'ok' | 'tired' | 'blocked' | 'over' {
    if (this.state !== 'aim') return 'over';
    const u = this.active;
    if (u.moved >= RIDES[u.ride].move) return 'tired';
    const s = this.step(u.x, u.y, dir < 0 ? -1 : 1);
    if (!s) return 'blocked';
    [u.x, u.y] = s; u.moved++;
    return 'ok';
  }
  aim(angle: number, power: number) {
    const u = this.active;
    u.angle = clamp(Math.round(angle), MIN_ANGLE, MAX_ANGLE); u.power = clamp(Math.round(power), 0, 100);
  }

  /** The unit a projectile at (x, y) touches, ignoring `skip`. */
  private struck(x: number, y: number, skip: number): number {
    for (const u of this.units) {
      if (!u.alive || u.id === skip) continue;
      const dx = x - u.x, dy = y - (u.y - UNIT_UP);
      if (dx * dx + dy * dy <= (UNIT_R + 1) * (UNIT_R + 1)) return u.id;
    }
    return -1;
  }
  /** Flies a shot from a unit without changing anything. `keep` records the path for drawing. */
  flight(u: Unit, angle: number, power: number, keep = false): Landing {
    const rad = (angle * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad), ax = this.wind * WIND_PULL;
    let x = u.x + cos * MUZZLE, y = u.y - UNIT_UP - sin * MUZZLE, vx = cos * power * SPEED, vy = -sin * power * SPEED;
    const path = keep ? [x, y] : [];
    if (this.solid(Math.floor(x), Math.floor(y))) return { path, x, y, vx, vy, hit: -1, lost: false };
    for (let t = 0; t < MAX_TICKS; t++) {
      vx += ax * DT; vy += GRAVITY * DT;
      for (let h = 1; h <= 2; h++) {
        const px = x + (vx * DT * h) / 2, py = y + (vy * DT * h) / 2;
        const hit = this.struck(px, py, t < SAFE_TICKS ? u.id : -1);
        if (hit >= 0 || this.solid(Math.floor(px), Math.floor(py))) { if (keep) path.push(px, py); return { path, x: px, y: py, vx, vy, hit, lost: false }; }
      }
      x += vx * DT; y += vy * DT;
      if (x < -30 || x > W + 30 || y > H + 12) return { path, x, y, vx, vy, hit: -1, lost: true };
      if (keep && (t & 1)) path.push(x, y);
    }
    return { path, x, y, vx, vy, hit: -1, lost: true };
  }
  /** Carries a landed shot on through the ground for `bore` cells, or until it meets someone. */
  private dig(l: Landing, bore: number, path?: number[]): Landing {
    if (!bore || l.lost || l.hit >= 0) return l;
    const len = Math.hypot(l.vx, l.vy) || 1, dx = l.vx / len, dy = l.vy / len;
    let x = l.x, y = l.y, hit = -1;
    for (let i = 0; i < bore; i++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny >= H || ny < 0) break;
      x = nx; y = ny; path?.push(x, y);
      hit = this.struck(x, y, -1);
      if (hit >= 0) break;
    }
    return { ...l, x, y, hit };
  }
  /** What a blast centred at (cx, cy) does to one unit: health lost and cells shoved. */
  harm(shot: ShotDef, cx: number, cy: number, u: Unit): [number, number] {
    // Measured from the edge a projectile touches, so a shot that lands on someone does its full damage.
    const d = Math.max(0, Math.hypot(u.x - cx, u.y - UNIT_UP - cy) - UNIT_R - 1);
    if (d >= shot.blast) return [0, 0];
    const k = 1 - (FALLOFF * d) / shot.blast;
    return [Math.round(shot.damage * k), Math.round(shot.push * k)];
  }
  /** The first second or so of the active unit's shot, for the aiming guide. */
  guide(points = 26): number[] { const u = this.active; return this.flight(u, u.angle, u.power, true).path.slice(0, points * 2); }

  private carve(cx: number, cy: number, r: number) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.terrain[y * W + x] = 0;
  }
  private knock(u: Unit, why: 'ko' | 'fell') {
    if (!u.alive) return;
    u.alive = false; u.hp = why === 'ko' ? 0 : u.hp;
    this.events.push({ type: 'out', id: u.id, why });
  }
  /** Shoves a unit sideways; it can go off a ledge or off the side of the map. */
  private shove(u: Unit, dir: number, cells: number): boolean {
    for (let i = 0; i < cells; i++) {
      const nx = u.x + dir;
      if (nx < 0 || nx >= W) { u.x = nx; return false; }
      if (this.solid(nx, u.y)) {
        let k = 1;
        while (k <= CLIMB && this.solid(nx, u.y - k)) k++;
        if (k > CLIMB) break;
        u.y -= k;
      }
      u.x = nx;
    }
    return true;
  }
  /** One projectile going off: dig, hurt, shove, then let everyone drop onto whatever ground is left. */
  private blast(shot: ShotDef, l: Landing, tunnel: number[]) {
    const circles: number[] = [];
    for (let i = 0; i < tunnel.length; i += 4) circles.push(tunnel[i], tunnel[i + 1], TUNNEL);
    circles.push(l.x, l.y, shot.crater);
    for (let i = 0; i < circles.length; i += 3) this.carve(circles[i], circles[i + 1], circles[i + 2]);
    this.events.push({ type: 'boom', x: l.x, y: l.y, crater: shot.crater, blast: shot.blast, circles });
    const before = this.units.map((u) => [u.x, u.y]);
    const gone: number[] = [];
    for (const u of this.units) {
      if (!u.alive) continue;
      const [dmg, push] = this.harm(shot, l.x, l.y, u);
      if (dmg > 0) { u.hp = Math.max(0, u.hp - dmg); this.events.push({ type: 'hurt', id: u.id, amount: dmg, hp: u.hp }); }
      if (push > 0 && u.hp > 0 && !this.shove(u, u.x === Math.round(l.x) ? (l.vx >= 0 ? 1 : -1) : u.x > l.x ? 1 : -1, push)) gone.push(u.id);
    }
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.hp <= 0) { this.knock(u, 'ko'); continue; }
      const stood = !gone.includes(u.id) && this.place(u, u.x, u.y);
      if (u.x !== before[u.id][0] || u.y !== before[u.id][1]) this.events.push({ type: 'shift', id: u.id, x: u.x, y: stood ? u.y : H + 20 });
      if (!stood) this.knock(u, 'fell');
    }
    this.check();
  }
  private check() {
    if (this.state === 'over') return;
    const left = [0, 1].filter((t) => this.units.some((u) => u.alive && u.team === t));
    if (left.length === 2) return;
    this.state = 'over'; this.winner = left.length ? left[0] : -1;
    this.events.push({ type: 'over', winner: this.winner });
  }
  private endTurn(u: Unit, delay: number) {
    u.delay += delay; u.moved = 0;
    if (this.state === 'over') return;
    this.turn++;
    if (this.turn > DUSK_TURN) {
      this.events.push({ type: 'dusk' });
      for (const v of this.units) if (v.alive) { v.hp = Math.max(0, v.hp - DUSK_HURT); this.events.push({ type: 'hurt', id: v.id, amount: DUSK_HURT, hp: v.hp }); }
      for (const v of this.units) if (v.alive && v.hp <= 0) this.knock(v, 'ko');
      this.check();
      if (this.over) return;
    }
    this.wind = clamp(this.wind + Math.round(this.rand() * 4 - 2), -MAX_WIND, MAX_WIND);
    this.activeId = this.next();
    this.events.push({ type: 'turn', id: this.activeId, wind: this.wind, turn: this.turn });
  }

  /** Why the active unit cannot take this shot or item right now, or '' if it can. */
  cannot(shot: number, item: ItemId | null): string {
    if (this.state !== 'aim') return 'The match is over.';
    const u = this.active;
    if (shot < 0 || shot > 2) return 'No such shot.';
    if (item && !u.items.includes(item)) return `${ITEMS[item].name} has been used.`;
    if (shot === 2 && item !== 'heal' && item !== 'hop' && !this.charged(u)) return `${RIDES[u.ride].shots[2].name} needs ${CHARGE_FULL - u.charge} more turn${CHARGE_FULL - u.charge === 1 ? '' : 's'} to charge.`;
    return '';
  }
  /** Fires the active unit's shot at its angle and power, with an item if one is given. */
  fire(shot: number, item: ItemId | null = null): 'ok' | 'no' {
    if (this.cannot(shot, item)) return 'no';
    const u = this.active, ride = RIDES[u.ride];
    if (item) u.items = u.items.filter((i) => i !== item);
    u.charge = Math.min(CHARGE_FULL, u.charge + 1);
    if (item === 'heal') {
      const amount = Math.min(HEAL, u.maxHp - u.hp);
      u.hp += amount;
      this.events.push({ type: 'heal', id: u.id, amount, hp: u.hp });
      this.endTurn(u, ITEMS.heal.delay);
      return 'ok';
    }
    u.lastPower = u.power;
    if (item === 'hop') {
      const l = this.flight(u, u.angle, u.power, true);
      this.events.push({ type: 'shot', id: u.id, ride: u.ride, shot: 0, path: l.path, boreAt: -1, marker: true });
      // The marker has to come down on open ground: one that hits someone or flies off the map is wasted.
      if (!l.lost && l.hit < 0) {
        const x = clamp(Math.round(l.x), UNIT_R, W - 1 - UNIT_R);
        if (this.place(u, x, Math.round(l.y))) this.events.push({ type: 'hop', id: u.id, x: u.x, y: u.y });
        else { this.events.push({ type: 'shift', id: u.id, x: u.x, y: u.y }); this.knock(u, 'fell'); this.check(); }
      }
      this.endTurn(u, ITEMS.hop.delay);
      return 'ok';
    }
    const def = ride.shots[shot];
    if (shot === 2) u.charge = 0;
    for (let round = 0; round < (item === 'dual' ? 2 : 1); round++) {
      for (let i = 0; i < def.count && u.alive && !this.over; i++) {
        const fly = this.flight(u, u.angle + (i - (def.count - 1) / 2) * def.spread, u.power, true), boreAt = fly.path.length / 2;
        const tunnel: number[] = [], end = this.dig(fly, def.bore, tunnel);
        this.events.push({ type: 'shot', id: u.id, ride: u.ride, shot, path: fly.path.concat(tunnel), boreAt: tunnel.length ? boreAt : -1, marker: false });
        if (!end.lost) this.blast(def, end, tunnel);
      }
    }
    this.endTurn(u, def.delay + (item === 'dual' ? ITEMS.dual.delay : 0));
    return 'ok';
  }
  /** Passes the turn; the wait is short. */
  skip(): 'ok' | 'no' {
    if (this.state !== 'aim') return 'no';
    const u = this.active;
    u.charge = Math.min(CHARGE_FULL, u.charge + 1);
    this.endTurn(u, SKIP_DELAY);
    return 'ok';
  }

  /** What one shot landing at a spot is worth to the shooter: hurt dealt to rivals, less hurt dealt to its own side. */
  private worth(u: Unit, def: ShotDef, x: number, y: number): number {
    let s = 0;
    const many = def.count > 1 ? def.count * 0.7 : 1;
    for (const v of this.units) {
      if (!v.alive) continue;
      const d = Math.min(v.hp, this.harm(def, x, y, v)[0] * many);
      if (d <= 0) continue;
      s += v.team !== u.team ? d + (d >= v.hp ? 30 : 0) : -1.5 * d - (d >= v.hp ? 80 : 0);
    }
    return s === 0 ? 0 : s - def.delay * 0.03;
  }
  /**
   * The computer's turn: tries every angle and power through the same flight the real shot uses and keeps the best,
   * walking first if nothing reaches from where it stands. `level` then spoils the aim (and draws from the seed)
   * unless `exact` is set.
   */
  plan(level: number, exact = false): Plan {
    const u = this.active, ride = RIDES[u.ride], foes = this.units.filter((v) => v.alive && v.team !== u.team);
    const shots = this.charged(u) ? [0, 1, 2] : [0, 1];
    let best: Plan = { walk: 0, shot: 0, item: null, angle: u.angle, power: u.power, score: 0 };
    let near = Infinity, fallback: Plan = best;
    const rate = (walk: number, angle: number, power: number) => {
      const l = this.flight(u, angle, power);
      if (l.lost) return;
      for (const s of shots) {
        const def = ride.shots[s], e = def.bore ? this.dig(l, def.bore) : l, score = this.worth(u, def, e.x, e.y);
        if (score > best.score) best = { walk, shot: s, item: null, angle, power, score };
      }
      // Nothing in reach: remember the shot that lands closest to a rival without hurting its own side, to dig towards them.
      if (best.score <= 0 && this.worth(u, ride.shots[0], l.x, l.y) >= 0) {
        for (const f of foes) { const d = Math.hypot(f.x - l.x, f.y - UNIT_UP - l.y); if (d < near) { near = d; fallback = { walk, shot: 0, item: null, angle, power, score: 0 }; } }
      }
    };
    const sweep = (walk: number, coarse: number) => {
      // Sweep by how high the barrel is raised, towards whichever sides have a rival, so both teams search alike.
      const right = foes.some((f) => f.x >= u.x), left = foes.some((f) => f.x < u.x);
      for (let up = MIN_ANGLE; up <= 88; up += coarse) for (let p = 20; p <= 100; p += 5) { if (right) rate(walk, up, p); if (left) rate(walk, 180 - up, p); }
    };
    sweep(0, 3);
    if (best.score < 12) {
      const [x, y] = [u.x, u.y], reach = ride.move - u.moved;
      for (const want of [reach, -reach, reach >> 1, -(reach >> 1)]) {
        const [nx, ny, n] = this.stroll(u, want);
        if (!n) continue;
        u.x = nx; u.y = ny;
        sweep(n, 4);
        u.x = x; u.y = y;
      }
    }
    if (best.score > 0) {
      const { walk, angle, power } = best, [x, y] = [u.x, u.y];
      if (walk) [u.x, u.y] = this.stroll(u, walk);
      for (let a = Math.max(MIN_ANGLE, angle - 2); a <= Math.min(MAX_ANGLE, angle + 2); a++) for (let p = Math.max(1, power - 4); p <= Math.min(100, power + 4); p++) rate(walk, a, p);
      u.x = x; u.y = y;
    } else best = fallback;
    // Below 45 there is no knock-out on offer, so a hurt chinchilla eats first.
    if (u.items.includes('heal') && u.hp <= u.maxHp * 0.4 && best.score < 45) best = { ...best, item: 'heal' };
    else if (level >= 1 && u.items.includes('dual') && best.score >= 28) best = { ...best, item: 'dual' };
    if (!exact) {
      const err = AI_LEVELS[clamp(level, 0, AI_LEVELS.length - 1)];
      best = { ...best, angle: clamp(best.angle + Math.round((this.rand() * 2 - 1) * err.angle), MIN_ANGLE, MAX_ANGLE), power: clamp(best.power + Math.round((this.rand() * 2 - 1) * err.power), 1, 100) };
    }
    return best;
  }
  /** Takes the active unit's whole turn for it. */
  aiTurn(level: number): Plan {
    const p = this.plan(level);
    for (let i = 0; i < Math.abs(p.walk); i++) this.walk(p.walk);
    this.aim(p.angle, p.power);
    this.fire(p.shot, p.item);
    return p;
  }
}

/** Stars for team one: one for winning, two with both chinchillas still in, three with half the pair's health left as well. */
export function stars(m: Match): number {
  if (m.state !== 'over' || m.winner !== 0) return 0;
  const mine = m.units.filter((u) => u.team === 0), up = mine.filter((u) => u.alive);
  if (up.length < 2) return 1;
  return up.reduce((s, u) => s + u.hp, 0) * 2 >= mine.reduce((s, u) => s + u.maxHp, 0) ? 3 : 2;
}
export const ladderMatch = (i: number, rides: [RideId, RideId], seed: number): Match =>
  Match.start({ map: LADDER[i].map, seed, rides: [rides, LADDER[i].rides], names: [['Dora', 'Enzo'], LADDER[i].rivals], coats: [['dora', 'enzo'], LADDER[i].coats] });

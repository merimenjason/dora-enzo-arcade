// Paperwing Post: the rules. Dora and Enzo ride a big paper glider out of their attic window and over the town, Dora
// flying and Enzo posting letters through windows. A glider only comes down: diving trades height for speed, pulling
// up trades speed for height (and too slow it stalls), and the warm air over chimneys and sunny squares lifts it back
// up. Post every letter, gather the loose pages blowing about town, and glide home to the attic window. Pages fold new
// gliders in Enzo's workshop. Deterministic at 60 Hz with no DOM: the scene draws it, the page feeds it input, the
// bots and tests drive it.

export const DT = 1 / 60;
const G = 9.8;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// ---------------------------------------------------------------- the town
/** x is east, z is south, y is up; the town is about 440 m across with the clock tower in the middle */
export const HALF = 220;
export const HOME = { x: -160, z: -160 }, GRANNY = { x: 165, z: 172 };
const HILLS = [{ x: HOME.x, z: HOME.z, r: 80, h: 24 }, { x: GRANNY.x, z: GRANNY.z, r: 75, h: 26 }];
/** the river's middle line, and how far either side is water */
export const riverZ = (x: number) => 92 + 24 * Math.sin(x / 70);
export const RIVER_HALF = 9;
export function groundAt(x: number, z: number) {
  let h = 0;
  for (const k of HILLS) { const d = Math.hypot(x - k.x, z - k.z); if (d < k.r) h += k.h * 0.5 * (1 + Math.cos((d / k.r) * Math.PI)); }
  const r = Math.abs(z - riverZ(x)); if (r < RIVER_HALF + 4) h -= 2 * clamp((RIVER_HALF + 4 - r) / 4, 0, 1);
  return h;
}
export const inRiver = (x: number, z: number) => Math.abs(z - riverZ(x)) < RIVER_HALF;

export type HouseKind = 'house' | 'tower' | 'bakery' | 'home' | 'granny';
/** a house: an axis-aligned box `w` (x) by `d` (z) with walls `h` high from `base`, a pitched roof `roof` high along x */
export type House = { id: number; kind: HouseKind; x: number; z: number; w: number; d: number; base: number; h: number; roof: number; wall: number; tile: number; chimney: { x: number; z: number; top: number; eave: number; up: number } | null };
export const WALLS = [0xf2e2c4, 0xf4cfc0, 0xd8e4cc, 0xcfe0ec, 0xf0d89a, 0xe6d0ea, 0xf6ead8];
export const TILES = [0xc8603e, 0xb45a48, 0x7a7488, 0xd07a4a, 0x8a5a4a];
export function buildTown(): House[] {
  const r = rng(7), out: House[] = [];
  const add = (o: Omit<House, 'id' | 'base'>) => { out.push({ ...o, id: out.length, base: groundAt(o.x, o.z) - 0.5 }); };
  // the three special houses: Dora and Enzo's on their hill, Granny Juniper's on hers, and the clock tower
  add({ kind: 'home', x: HOME.x, z: HOME.z, w: 12, d: 12, h: 11, roof: 6, wall: 0xf6ead8, tile: 0x5a6a8a, chimney: { x: HOME.x - 3, z: HOME.z - 3, top: 0, eave: 0, up: 3.6 } });
  add({ kind: 'granny', x: GRANNY.x, z: GRANNY.z, w: 13, d: 11, h: 9, roof: 6, wall: 0xe6d0ea, tile: 0xc8603e, chimney: { x: GRANNY.x + 3, z: GRANNY.z + 2, top: 0, eave: 0, up: 3.6 } });
  add({ kind: 'tower', x: 0, z: 0, w: 9, d: 9, h: 40, roof: 9, wall: 0xe8d8b8, tile: 0x4a6a8a, chimney: null });
  // the rest on a grid of blocks 40 m apart, with streets between, round the market square, clear of the river
  for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
    const cx = -200 + i * 40, cz = -200 + j * 40;
    if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;
    if (Math.abs(cz - riverZ(cx)) < 30) continue;
    if (Math.hypot(cx - HOME.x, cz - HOME.z) < 50 || Math.hypot(cx - GRANNY.x, cz - GRANNY.z) < 45) continue;
    const n = r() < 0.35 ? 1 : 2, alongX = r() < 0.5;
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (k ? 8 : -8), big = n === 1;
      const w = (big ? 18 : 11) + r() * 5, d = (big ? 16 : 10) + r() * 4, h = 6 + r() * (big ? 6 : 4);
      const x = cx + (alongX ? off : 0) + (r() - 0.5) * 3, z = cz + (alongX ? 0 : off) + (r() - 0.5) * 3;
      const ww = alongX && !big ? Math.min(w, 12) : w, dd = !alongX && !big ? Math.min(d, 12) : d;
      const chim = r() < 0.62 ? { x: x + (r() - 0.5) * ww * 0.5, z: z + (r() - 0.5) * dd * 0.4, top: 0, eave: 0, up: 3.2 + r() * 0.8 } : null;
      add({ kind: 'house', x, z, w: ww, d: dd, h, roof: 3.5 + r() * 3, wall: WALLS[Math.floor(r() * WALLS.length)], tile: TILES[Math.floor(r() * TILES.length)], chimney: chim });
    }
  }
  // the bakery: the house nearest the square's north-west corner, with the biggest chimney in town
  const bk = nearestHouse(out, -40, -40); bk.kind = 'bakery'; bk.chimney = { x: bk.x, z: bk.z, top: 0, eave: 0, up: 4.8 };
  for (const hs of out) if (hs.chimney) { hs.chimney.top = hs.base + hs.h + hs.roof + 2.5; hs.chimney.eave = hs.base + hs.h; }
  return out;
}
export function nearestHouse(hs: House[], x: number, z: number, kinds: HouseKind[] = ['house', 'bakery']) {
  let best = hs[0], bd = Infinity;
  for (const h of hs) { if (!kinds.includes(h.kind)) continue; const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
  return best;
}
/** the top of a house's roof over (x, z): walls up to `h`, then a ridge running along x */
export function roofAt(h: House, x: number, z: number) {
  if (Math.abs(x - h.x) > h.w / 2 || Math.abs(z - h.z) > h.d / 2) return -Infinity;
  if (h.kind === 'tower') return h.base + h.h + h.roof * (1 - Math.max(Math.abs(x - h.x) / (h.w / 2), Math.abs(z - h.z) / (h.d / 2)));
  return h.base + h.h + h.roof * (1 - Math.abs(z - h.z) / (h.d / 2));
}

// ---------------------------------------------------------------- gliders
export type GliderId = 'dart' | 'wing' | 'stunt';
export type Glider = { id: GliderId; name: string; line: string; cost: number; drag: number; sink: number; turn: number; sturdy: number };
export const GLIDERS: Glider[] = [
  { id: 'dart', name: 'The Dart', line: 'Quick and straight. Covers ground, but sinks faster.', cost: 0, drag: 0.0032, sink: 0.45, turn: 1.6, sturdy: 4 },
  { id: 'wing', name: 'The Broadwing', line: 'Long flat wings that float on the lightest warm air. Slow and gentle.', cost: 25, drag: 0.0052, sink: 0.22, turn: 1.9, sturdy: 4 },
  { id: 'stunt', name: 'The Swoop', line: 'Turns on a leaf and takes a knock. For tight streets and loops round the tower.', cost: 50, drag: 0.0042, sink: 0.36, turn: 2.5, sturdy: 5 },
];
export const glider = (id: GliderId) => GLIDERS.find((g) => g.id === id)!;

// ---------------------------------------------------------------- the flights
export type FlightId = 'morning' | 'market' | 'river' | 'tower' | 'washing' | 'birthday';
export type Sky = 'morning' | 'noon' | 'afternoon' | 'golden' | 'sunset';
export type Sunny = { x: number; z: number; r: number; up: number };
export type Level = { id: FlightId; n: number; name: string; line: string; sky: Sky; wind: [number, number]; letters: [number, number, string][]; tower: boolean; sunny: Sunny[]; pages: number; pageGoal: number; seed: number };
export const LEVELS: Level[] = [
  { id: 'morning', n: 1, name: 'Morning Post', line: 'Three letters on the near side of town. The bakery chimney is the warmest.', sky: 'morning', wind: [0, 0], tower: false, sunny: [],
    letters: [[-110, -95, 'the Thimbletons'], [-55, -125, 'Doctor Fennimore'], [-40, -40, 'Baker Hollis']], pages: 10, pageGoal: 6, seed: 101 },
  { id: 'market', n: 2, name: 'Market Day', line: 'Round the market square. The sun on the cobbles lifts you up.', sky: 'noon', wind: [1, 0], tower: false, sunny: [{ x: 0, z: 0, r: 26, up: 2 }],
    letters: [[40, -40, 'Miss Pennywhistle'], [-40, 40, 'the Pumbles'], [40, 40, 'Mayor Pumble'], [0, -80, 'the cheesemonger']], pages: 12, pageGoal: 8, seed: 202 },
  { id: 'river', n: 3, name: 'Down the River', line: 'A breeze from the west. Follow the river; mind the water.', sky: 'afternoon', wind: [1.3, 0], tower: false, sunny: [{ x: -80, z: 92, r: 18, up: 1.5 }],
    letters: [[-120, 55, 'the ferryman'], [-40, 130, 'Nell at the mill'], [60, 60, 'the Rooks'], [130, 130, 'Captain Rook']], pages: 12, pageGoal: 8, seed: 303 },
  { id: 'tower', n: 4, name: 'The Clockmaker', line: 'A letter for the top of the clock tower. Climb in the square’s warm air.', sky: 'noon', wind: [0, 0.8], tower: true, sunny: [{ x: 0, z: 0, r: 30, up: 2.4 }],
    letters: [[80, -80, 'the Hatters'], [120, -20, 'Doctor Fennimore'], [-100, 40, 'the Thimbletons']], pages: 12, pageGoal: 8, seed: 404 },
  { id: 'washing', n: 5, name: 'Washing Day', line: 'A gusty wind has blown everyone’s pages about. Far side of town.', sky: 'afternoon', wind: [-0.9, 1.8], tower: false, sunny: [{ x: 120, z: -120, r: 20, up: 1.8 }],
    letters: [[150, -120, 'Tilly Twig'], [100, -170, 'the Hatters'], [180, -40, 'Miss Pennywhistle'], [60, -140, 'the cheesemonger']], pages: 16, pageGoal: 10, seed: 505 },
  { id: 'birthday', n: 6, name: 'Granny’s Birthday', line: 'Everyone’s card for Granny Juniper, and the long glide to her hill at sunset.', sky: 'sunset', wind: [0.6, 0.6], tower: false, sunny: [{ x: 0, z: 0, r: 24, up: 2 }, { x: 100, z: 40, r: 18, up: 1.6 }],
    letters: [[-20, 60, 'Tilly Twig'], [90, 30, 'the Pumbles'], [130, 120, 'Captain Rook'], [GRANNY.x, GRANNY.z, 'Granny Juniper']], pages: 12, pageGoal: 8, seed: 606 },
];
export const level = (id: FlightId) => LEVELS.find((l) => l.id === id)!;

/** a letter's window: a point a metre out from a wall, two thirds of the way up, on the side facing `from` */
export type Target = { x: number; y: number; z: number; nx: number; nz: number; name: string; house: number };
function windowOf(hs: House[], h: House, fx: number, fz: number, name: string, high = false): Target {
  const dx = fx - h.x, dz = fz - h.z, y = h.base + (high ? h.h * 0.82 : h.h * 0.62);
  const at = (nx: number, nz: number): Target => ({ x: h.x + nx * (h.w / 2 + 1), y, z: h.z + nz * (h.d / 2 + 1), nx, nz, name, house: h.id });
  // the wall most facing `from`, unless the next house is too close in front of it to fly in; then the next best
  const sides = [at(1, 0), at(-1, 0), at(0, 1), at(0, -1)].sort((a, b) => (b.nx * dx / h.w + b.nz * dz / h.d) - (a.nx * dx / h.w + a.nz * dz / h.d));
  const clear = (t: Target) => [3, 6, 9].every((k) => roofTop(hs, t.x + t.nx * k, t.z + t.nz * k) < t.y - 1);
  return sides.find(clear) ?? sides[0];
}
export type Page = { x: number; y: number; z: number };
export type Course = { town: House[]; targets: Target[]; pages: Page[]; home: Target; start: { x: number; y: number; z: number; yaw: number } };
let townCache: House[] | null = null;
export const town = () => (townCache ??= buildTown());
export function course(lv: Level): Course {
  const hs = town(), homeH = hs.find((h) => h.kind === 'home')!, granny = hs.find((h) => h.kind === 'granny')!, tower = hs.find((h) => h.kind === 'tower')!;
  // each window faces the way you'd come from: the letter before it, or home for the first
  let px = HOME.x, pz = HOME.z;
  const targets = lv.letters.map(([x, z, name]) => {
    const h = x === GRANNY.x && z === GRANNY.z ? granny : nearestHouse(hs, x, z), t = windowOf(hs, h, px, pz, name);
    px = h.x; pz = h.z; return t;
  });
  if (lv.tower) targets.unshift(windowOf(hs, tower, HOME.x, HOME.z, 'the Clockmaker', true));
  // the attic window faces the town; you start just outside it, heading for the first letter
  const home = windowOf(hs, homeH, 0, 0, 'home', true); home.name = 'home';
  const t0 = targets[0], start = { x: home.x + home.nx * 3, y: home.y + 1, z: home.z + home.nz * 3, yaw: Math.atan2(t0.x - home.x, t0.z - home.z) };
  // the loose pages: drifting along the way from each letter to the next, up where you'd fly
  const r = rng(lv.seed), pages: Page[] = [], pts = [home, ...targets];
  for (let k = 0; k < lv.pages; k++) {
    const i = k % (pts.length - 1), a = pts[i], b = pts[i + 1], t = 0.2 + r() * 0.6;
    const x = a.x + (b.x - a.x) * t + (r() - 0.5) * 40, z = a.z + (b.z - a.z) * t + (r() - 0.5) * 40;
    pages.push({ x, z, y: Math.max(groundAt(x, z), roofTop(hs, x, z)) + 8 + r() * 16 });
  }
  return { town: hs, targets, pages, home, start };
}
/** the highest roof over (x, z), or -Infinity */
export function roofTop(hs: House[], x: number, z: number) { let m = -Infinity; for (const h of hs) { const y = roofAt(h, x, z); if (y > m) m = y; } return m; }

// ---------------------------------------------------------------- a flight
export type Input = { steer: number; pitch: number; post: boolean };
export const idleInput = (): Input => ({ steer: 0, pitch: 0, post: false });
export type End = 'home' | 'landed' | 'splash' | 'crumpled';
export type FlightEvent =
  | { k: 'post'; hit: 'perfect' | 'good'; name: string; i: number } | { k: 'nopost' } | { k: 'page'; n: number; i: number }
  | { k: 'bump'; left: number } | { k: 'lift' } | { k: 'stall' } | { k: 'end'; why: End; soft: boolean };
/** Enzo can post a letter from this far away across, from a little below the window to well above it (he tosses it
 *  down); close and level is perfect */
export const POST_REACH = 14, POST_ABOVE = 16, POST_BELOW = 6, POST_PERFECT = 6, PAGE_REACH = 3.5, BODY = 1.2;
export const reach = (t: { x: number; y: number; z: number }, x: number, y: number, z: number) => { const dy = y - t.y; return dy < -POST_BELOW || dy > POST_ABOVE ? Infinity : Math.hypot(t.x - x, t.z - z); };

export class Flight {
  lv: Level; c: Course; gl: Glider;
  x: number; y: number; z: number; yaw: number; pitch = -0.05; bank = 0; speed = 12; vy = 0;
  t = 0; delivered: boolean[]; perfect: boolean[]; got: boolean[]; pages = 0; bumps = 0; over = false; why: End | null = null; soft = false;
  events: FlightEvent[] = []; private lastPost = false; private bumpCd = 0; private stalled = false; private lifting = 0;
  constructor(lv: Level, gid: GliderId = 'dart') {
    this.lv = lv; this.c = course(lv); this.gl = glider(gid);
    const s = this.c.start; this.x = s.x; this.y = s.y; this.z = s.z; this.yaw = s.yaw;
    this.delivered = this.c.targets.map(() => false); this.perfect = this.c.targets.map(() => false); this.got = this.c.pages.map(() => false);
  }
  get altitude() { return this.y - Math.max(groundAt(this.x, this.z), roofTop(this.c.town, this.x, this.z)); }
  get left() { return this.delivered.filter((d) => !d).length; }
  /** warm air rising at a point: chimneys (a column from the eaves to 70 m over the pot) and the flight's sunny squares */
  lift(x: number, y: number, z: number) {
    let up = 0;
    for (const h of this.c.town) {
      const ch = h.chimney; if (!ch || y < ch.eave || y > ch.top + 70) continue;
      const d2 = (x - ch.x) ** 2 + (z - ch.z) ** 2; if (d2 > 484) continue;
      up += ch.up * Math.exp(-d2 / 120) * (y > ch.top + 50 ? (ch.top + 70 - y) / 20 : 1);
    }
    for (const s of this.lv.sunny) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r && y < groundAt(s.x, s.z) + 95) up += s.up * (1 - (d / s.r) ** 2); }
    return up;
  }
  /** the next letter: the nearest one still in the satchel */
  nextTarget(): number {
    let best = -1, bd = Infinity;
    this.c.targets.forEach((t, i) => { if (this.delivered[i]) return; const d = Math.hypot(t.x - this.x, t.z - this.z); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  tick(inp: Input) {
    this.events = []; if (this.over) return;
    const g = this.gl, dt = DT; this.t += dt; this.bumpCd = Math.max(0, this.bumpCd - dt);
    // bank and turn: the steer rolls the wings over, and banked wings turn the glider
    this.bank += (clamp(inp.steer, -1, 1) * 0.75 - this.bank) * Math.min(1, dt * 4);
    this.yaw -= (g.turn * G * Math.tan(this.bank)) / Math.max(7, this.speed) * dt;
    // pitch: up pulls the nose up, down pushes it down; too slow and the nose drops by itself
    if (this.speed < 6.5 && !this.stalled) { this.stalled = true; this.events.push({ k: 'stall' }); } else if (this.speed > 9) this.stalled = false;
    const want = this.stalled ? -0.55 : -0.06 + clamp(inp.pitch, -1, 1) * (inp.pitch > 0 ? 0.5 : 0.65);
    this.pitch += (want - this.pitch) * Math.min(1, dt * 3);
    // speed: gravity along the path, against the paper's drag
    this.speed = clamp(this.speed + (-G * Math.sin(this.pitch) - g.drag * this.speed * this.speed) * dt, 3, 34);
    const up = this.lift(this.x, this.y, this.z);
    if (up > 0.8 && this.lifting <= 0) this.events.push({ k: 'lift' });
    this.lifting = up > 0.8 ? 2 : this.lifting - dt;
    this.vy = this.speed * Math.sin(this.pitch) - g.sink / Math.max(0.5, Math.cos(this.bank)) + up;
    const h = this.speed * Math.cos(this.pitch);
    this.x += (Math.sin(this.yaw) * h + this.lv.wind[0]) * dt; this.z += (Math.cos(this.yaw) * h + this.lv.wind[1]) * dt; this.y += this.vy * dt;
    // the edge of the map: a soft turn back towards the town
    const out = Math.max(Math.abs(this.x), Math.abs(this.z)) - (HALF + 60);
    if (out > 0) { const back = Math.atan2(-this.x, -this.z); let d = back - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += clamp(d, -1, 1) * Math.min(1, out / 20) * dt * 2; }
    this.collide();
    if (this.over) return;
    // Enzo posts the letter when you press, if a window is in reach
    if (inp.post && !this.lastPost) {
      const i = this.nextTargetNear();
      if (i < 0) this.events.push({ k: 'nopost' });
      else { const t = this.c.targets[i], d = reach(t, this.x, this.y, this.z), hit = d < POST_PERFECT && Math.abs(this.y - t.y) < 6 ? 'perfect' : 'good'; this.delivered[i] = true; this.perfect[i] = hit === 'perfect'; this.events.push({ k: 'post', hit, name: t.name, i }); }
    }
    this.lastPost = inp.post;
    // pages: fly through one to catch it
    this.c.pages.forEach((p, i) => { if (!this.got[i] && Math.hypot(p.x - this.x, p.y - this.y, p.z - this.z) < PAGE_REACH) { this.got[i] = true; this.pages++; this.events.push({ k: 'page', n: this.pages, i }); } });
    // home: back through the attic window
    const hm = this.c.home;
    if (this.t > 6 && Math.hypot(hm.x - this.x, hm.y - this.y, hm.z - this.z) < 3.5) this.end('home', true);
  }
  /** the letter whose window is within Enzo's reach, nearest first */
  nextTargetNear(): number {
    let best = -1, bd = POST_REACH;
    this.c.targets.forEach((t, i) => { if (this.delivered[i]) return; const d = reach(t, this.x, this.y, this.z); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  private collide() {
    // houses: the walls and the roof slope; a knock bounces the glider off and crumples it a little
    for (const h of this.c.town) {
      if (Math.abs(this.x - h.x) > h.w / 2 + BODY || Math.abs(this.z - h.z) > h.d / 2 + BODY) continue;
      const top = roofAt(h, clamp(this.x, h.x - h.w / 2, h.x + h.w / 2), clamp(this.z, h.z - h.d / 2, h.z + h.d / 2));
      if (this.y - BODY * 0.6 > top) continue;
      // push out the shortest way: up over the roof, or out through the nearest wall
      const ox = h.w / 2 + BODY - Math.abs(this.x - h.x), oz = h.d / 2 + BODY - Math.abs(this.z - h.z), oy = top + BODY * 0.6 - this.y;
      if (oy < Math.min(ox, oz) && oy < 1.5) { this.y += oy; this.pitch = Math.max(this.pitch, 0.1); this.bump(0.7); }
      else if (ox < oz) { this.x += Math.sign(this.x - h.x) * ox; this.yaw = Math.atan2(-Math.sin(this.yaw), Math.cos(this.yaw)); this.bump(0.5); }
      else { this.z += Math.sign(this.z - h.z) * oz; this.yaw = Math.atan2(Math.sin(this.yaw), -Math.cos(this.yaw)); this.bump(0.5); }
      if (this.over) return;
    }
    // the ground ends the flight: softly if slow and level, in the river with a splash
    const gy = groundAt(this.x, this.z);
    if (this.y - 0.4 < gy) {
      this.y = gy + 0.4;
      if (inRiver(this.x, this.z)) this.end('splash', false);
      else this.end('landed', this.speed < 14 && this.pitch > -0.3);
    }
  }
  private bump(keep: number) {
    if (this.bumpCd > 0) { this.speed *= 0.98; return; }
    this.bumpCd = 1.2; this.bumps++; this.speed = Math.max(7, this.speed * keep);
    this.events.push({ k: 'bump', left: this.gl.sturdy - this.bumps });
    if (this.bumps >= this.gl.sturdy) this.end('crumpled', false);
  }
  private end(why: End, soft: boolean) { if (this.over) return; this.over = true; this.why = why; this.soft = soft; this.events.push({ k: 'end', why, soft }); }
  /** points and stars: a star for every letter posted, one for the pages, one for gliding home */
  result() {
    const posted = this.delivered.filter(Boolean).length, perfect = this.perfect.filter(Boolean).length, all = posted === this.delivered.length;
    const home = this.why === 'home', landing = home ? 400 : this.why === 'landed' && this.soft ? 100 : 0;
    const points = posted * 200 + perfect * 100 + this.pages * 25 + landing;
    const stars = (all ? 1 : 0) + (all && this.pages >= this.lv.pageGoal ? 1 : 0) + (all && home ? 1 : 0);
    return { posted, perfect, all, pages: this.pages, home, landing, points, stars, bumps: this.bumps, time: Math.round(this.t) };
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'paperwing-post-v1';
export type Best = { points: number; stars: number };
export type Save = {
  v: 1; intro: boolean; best: Partial<Record<FlightId, Best>>; paper: number; owned: GliderId[]; glider: GliderId; ending: boolean;
  settings: { sound: boolean; music: boolean; invert: boolean; tips: boolean };
  stats: { flights: number; letters: number; pages: number; home: number; crumples: number };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: {}, paper: 0, owned: ['dart'], glider: 'dart', ending: false, settings: { sound: true, music: true, invert: false, tips: true }, stats: { flights: 0, letters: 0, pages: 0, home: 0, crumples: 0 } });
/** a flight is open once every letter of the flight before it has been posted */
export const unlocked = (s: Save, id: FlightId) => { const i = LEVELS.findIndex((l) => l.id === id); return i === 0 || (s.best[LEVELS[i - 1].id]?.stars ?? 0) >= 1; };
export const totalStars = (s: Save) => LEVELS.reduce((n, l) => n + (s.best[l.id]?.stars ?? 0), 0);
/** fold a glider in the workshop with banked pages */
export function buy(s: Save, id: GliderId): boolean {
  const g = glider(id); if (s.owned.includes(id) || s.paper < g.cost) return false;
  s.paper -= g.cost; s.owned.push(id); s.glider = id; return true;
}
/** bank a finished flight: stats, pages for the workshop, the best, and whether that was the ending */
export function record(s: Save, f: Flight) {
  const r = f.result(), prev = s.best[f.lv.id];
  s.stats.flights++; s.stats.letters += r.posted; s.stats.pages += r.pages; if (r.home) s.stats.home++; if (f.why === 'crumpled') s.stats.crumples++;
  s.paper += r.pages;
  const best = !prev || r.points > prev.points;
  s.best[f.lv.id] = { points: Math.max(prev?.points ?? 0, r.points), stars: Math.max(prev?.stars ?? 0, r.stars) };
  const ending = f.lv.id === 'birthday' && r.all && !s.ending; if (ending) s.ending = true;
  return { ...r, best, ending };
}
export const serialise = (s: Save) => JSON.stringify(s);
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : d);
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  let d: Record<string, unknown>; try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return s;
  s.intro = d.intro === true; s.ending = d.ending === true;
  const b = (d.best && typeof d.best === 'object' ? d.best : {}) as Record<string, unknown>;
  for (const l of LEVELS) { const x = b[l.id] as Record<string, unknown> | undefined; if (x && typeof x === 'object') s.best[l.id] = { points: num(x.points, 0, 0, 1e6), stars: num(x.stars, 0, 0, 3) }; }
  s.paper = num(d.paper, 0, 0, 1e5);
  if (Array.isArray(d.owned)) s.owned = GLIDERS.filter((g) => g.id === 'dart' || (d.owned as unknown[]).includes(g.id)).map((g) => g.id);
  if (typeof d.glider === 'string' && s.owned.includes(d.glider as GliderId)) s.glider = d.glider as GliderId;
  const st = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  for (const k of ['sound', 'music', 'invert', 'tips'] as const) if (typeof st[k] === 'boolean') s.settings[k] = st[k] as boolean;
  const ss = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as Record<string, unknown>;
  for (const k of Object.keys(s.stats) as (keyof Save['stats'])[]) s.stats[k] = num(ss[k], 0, 0, 1e7);
  return s;
}

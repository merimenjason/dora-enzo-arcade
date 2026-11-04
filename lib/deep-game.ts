// Deepglow: Dora pilots a little submarine into a pitch-black abyss while Enzo reads the sonar log from the boat. The
// rules only: the world (a fixed, seeded cave system over a kilometre deep), the sub, sonar, light, oxygen and the hull,
// the creatures, specimens, upgrades, the save. Deterministic from a seed and no DOM; lib/deep-scene.ts draws it.

export const DT = 1 / 60;
/** metres per grid cell */
export const CELL = 2;
export const GW = 150, GH = 545;
/** the open sea above the cave mouth, in rows */
const SEA_ROWS = 7;
/** the one world every player explores, so the map they build up stays theirs */
export const WORLD_SEED = 1207;
export const SUB_R = 1.3;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** smooth value noise in 0..1 */
function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, s: number) => noise(x, y, s) * 0.6 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.1;

// ---------------------------------------------------------------- zones and creatures
export type ZoneId = 'twilight' | 'midnight' | 'abyss' | 'trench';
export const ZONES: { id: ZoneId; name: string; from: number; to: number; tint: string }[] = [
  { id: 'twilight', name: 'The Twilight', from: 0, to: 200, tint: '#1d5f7a' },
  { id: 'midnight', name: 'The Midnight', from: 200, to: 560, tint: '#122a52' },
  { id: 'abyss', name: 'The Abyss', from: 560, to: 960, tint: '#160f3a' },
  { id: 'trench', name: 'The Trench', from: 960, to: GH * CELL, tint: '#0b0618' },
];
export const zoneAt = (depth: number) => ZONES.find((z) => depth < z.to) ?? ZONES[ZONES.length - 1];

export type SpecId = 'mothjelly' | 'ribboneel' | 'krill' | 'crownsquid' | 'hatchet' | 'ghostray' | 'teacup' | 'starseed' | 'siphon' | 'isopod' | 'ventsnail' | 'lanternjaw';
export type Move = 'drift' | 'dart' | 'swim' | 'crawl' | 'swarm';
export type SpecDef = { id: SpecId; name: string; zone: ZoneId; move: Move; shy: boolean; glow: string; size: number; note: string };
export const SPECIES: SpecDef[] = [
  { id: 'mothjelly', name: 'Glass Moth Jelly', zone: 'twilight', move: 'drift', shy: false, glow: '#ffb3e6', size: 1.1, note: 'Beats its frilly wings like a moth at a lamp. It cannot see, but it can feel your propeller.' },
  { id: 'ribboneel', name: 'Ribbon Eel', zone: 'twilight', move: 'dart', shy: true, glow: '#5cc8ff', size: 1.5, note: 'Flicks away from any light. Switch the lamp off and drift close.' },
  { id: 'krill', name: 'Pepper Krill', zone: 'twilight', move: 'swarm', shy: false, glow: '#ff8a5c', size: 1.4, note: 'A whole swirling cloud of them. Each one is smaller than a grain of rice.' },
  { id: 'crownsquid', name: 'Lanterncrown Squid', zone: 'midnight', move: 'swim', shy: false, glow: '#b48cff', size: 1.2, note: 'Eight little lights round its head, blinked in turn like a lighthouse.' },
  { id: 'hatchet', name: 'Velvet Hatchetfish', zone: 'midnight', move: 'dart', shy: true, glow: '#8fd8ff', size: 0.8, note: 'Mirror sides and a glowing belly, so it vanishes against the light from above.' },
  { id: 'ghostray', name: 'Ghostfin Ray', zone: 'midnight', move: 'swim', shy: false, glow: '#e8f4ff', size: 1.8, note: 'So clear you can count its bones. It glides in slow circles for hours.' },
  { id: 'teacup', name: 'Teacup Octopus', zone: 'abyss', move: 'drift', shy: false, glow: '#ffb38a', size: 1, note: 'Flaps its ear-fins to hover. Enzo says it is the cutest thing in the sea.' },
  { id: 'starseed', name: 'Starseed Cucumber', zone: 'abyss', move: 'crawl', shy: false, glow: '#c79bff', size: 1.2, note: 'Crawls the floor with a sky full of stars inside it.' },
  { id: 'siphon', name: 'Lampshade Siphonophore', zone: 'abyss', move: 'drift', shy: false, glow: '#7fffd4', size: 2.4, note: 'Not one animal but a hundred, linked into a glowing chain.' },
  { id: 'isopod', name: 'Pearl Isopod', zone: 'trench', move: 'crawl', shy: false, glow: '#d6c8ff', size: 1.3, note: 'Armour like mother-of-pearl. It rolls into a ball if you bump it.' },
  { id: 'ventsnail', name: 'Ember Vent Snail', zone: 'trench', move: 'crawl', shy: false, glow: '#ff6a3d', size: 1, note: 'Lives by the hot vents with a shell of iron scales.' },
  { id: 'lanternjaw', name: 'Lanternjaw', zone: 'trench', move: 'dart', shy: true, glow: '#ffc34a', size: 1.1, note: 'A small, friendly cousin of the Grimlure. It hides its lure from bright lamps.' },
];
export const spec = (id: SpecId) => SPECIES.find((s) => s.id === id)!;
export const PER_SPECIES = 3;
/** research for a species' first specimen, for each one after, and one point per this many newly charted cells */
export const POINTS = { first: 30, repeat: 10, chart: 120 };

// ---------------------------------------------------------------- the world
export type Bell = { x: number; y: number; r: number };
export type Spawn = { kind: SpecId | 'grimlure' | 'veil'; x: number; y: number };
export type World = {
  seed: number; w: number; h: number;
  /** 1 = rock */ solid: Uint8Array;
  /** signed distance to rock in metres, at cell centres (negative inside rock) */ sdf: Float32Array;
  /** cells the sub fits through, reachable from the sea */ reach: Uint8Array;
  bells: Bell[]; vents: { x: number; y: number }[]; spawns: Spawn[];
  whale: { x: number; y: number; r: number };
  /** the spine of chambers from the sea to the whale, for the bots and Enzo's directions */ spine: { x: number; y: number }[];
};

/** why the last attempt at a world was thrown away (for the tests) */
export let worldFail = '';
export function makeWorld(seed = WORLD_SEED): World {
  for (let k = 0; k < 40; k++) { const w = tryWorld(seed + k * 101); if (w) return w; }
  throw new Error('no world');
}

function tryWorld(seed: number): World | null {
  const r = rng(seed), W = GW, H = GH;
  const open = new Float32Array(W * H).fill(-99);
  const carve = (cx: number, cy: number, rad: number) => {
    const x0 = Math.max(0, Math.floor(cx - rad - 3)), x1 = Math.min(W - 1, Math.ceil(cx + rad + 3)), y0 = Math.max(0, Math.floor(cy - rad - 3)), y1 = Math.min(H - 1, Math.ceil(cy + rad + 3));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = rad - Math.hypot(x - cx, y - cy), i = y * W + x; if (v > open[i]) open[i] = v; }
  };
  const tunnel = (ax: number, ay: number, bx: number, by: number, rad: number) => {
    const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.7), px = -(by - ay) / (L || 1), py = (bx - ax) / (L || 1), s = r() * 100;
    for (let i = 0; i <= n; i++) {
      const t = i / n, w = Math.sin(t * Math.PI) * (noise(t * 3.2, 0, seed + s) - 0.5) * Math.min(18, L * 0.35);
      carve(ax + (bx - ax) * t + px * w, ay + (by - ay) * t + py * w, rad * (0.85 + 0.3 * noise(t * 5, 1, seed + s)));
    }
  };
  // the spine: chambers from the cave mouth down to the whale's hall
  const spine: { x: number; y: number; r: number }[] = [{ x: W / 2, y: SEA_ROWS + 4, r: 6 }];
  let y = SEA_ROWS + 4, x = W / 2;
  while (y < H - 60) {
    y += 20 + r() * 18; x = clamp(x + (r() - 0.5) * 70, 18, W - 18);
    spine.push({ x, y, r: 5.5 + r() * 6 });
  }
  const whale = { x: W / 2 + (r() - 0.5) * 30, y: H - 24, r: 17 };
  spine.push({ x: whale.x, y: whale.y - 6, r: 8 });
  for (let i = 0; i < spine.length; i++) {
    const c = spine[i]; carve(c.x, c.y, c.r);
    if (i > 0) { const p = spine[i - 1]; tunnel(p.x, p.y, c.x, c.y, 2.7 + r() * 0.9); }
  }
  // the whale's hall: wide and tall
  for (let k = 0; k < 6; k++) carve(whale.x + (k - 2.5) * 6, whale.y + Math.sin(k) * 3, whale.r * 0.75);
  // side caves off the spine, some looping back
  const side: { x: number; y: number; r: number }[] = [];
  for (let i = 1; i < spine.length - 1; i++) {
    const c = spine[i];
    for (let b = 0; b < 2; b++) {
      if (r() > 0.75) continue;
      const dir = c.x > W / 2 ? -1 : 1, sx = clamp(c.x + dir * (22 + r() * 35) * (b ? -1 : 1), 14, W - 14), sy = clamp(c.y + (r() - 0.3) * 26, SEA_ROWS + 14, H - 40);
      const s = { x: sx, y: sy, r: 4.5 + r() * 6 };
      carve(s.x, s.y, s.r); tunnel(c.x, c.y, s.x, s.y, 2.5 + r() * 0.8); side.push(s);
      if (r() < 0.35 && i + 1 < spine.length - 1) { const n = spine[i + 1]; tunnel(s.x, s.y, n.x, n.y, 2.5); }
    }
  }
  const solid = new Uint8Array(W * H);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const i = yy * W + xx;
    const edge = xx < 2 || xx > W - 3 || yy > H - 3;
    // the open sea above, with a lumpy seabed below it
    const bed = SEA_ROWS + 2 + fbm(xx * 0.08, 0, seed) * 4;
    if (!edge && yy < bed) { solid[i] = 0; continue; }
    const v = open[i] + (fbm(xx * 0.18, yy * 0.18, seed) - 0.5) * 3.2;
    solid[i] = edge || v <= 0.35 ? 1 : 0;
  }
  const sdf = signedDistance(solid, W, H);
  // reachable: flood fill from the sea through cells the sub fits
  const reach = new Uint8Array(W * H), fit = SUB_R + 0.25, q: number[] = [];
  for (let xx = 0; xx < W; xx++) { const i = 1 * W + xx; if (sdf[i] > fit) { reach[i] = 1; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], xx = i % W, yy = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (!reach[j] && sdf[j] > fit) { reach[j] = 1; q.push(j); }
    }
  }
  const at = (xx: number, yy: number) => reach[Math.round(yy) * W + Math.round(xx)] === 1;
  if (!at(whale.x, whale.y)) { worldFail = 'whale'; return null; }
  // air bells: the top of a spine chamber every 130 m or so
  const bells: Bell[] = [];
  let lastBell = 0;
  for (const c of spine) {
    const depth = c.y * CELL;
    if (depth - lastBell < 130 || depth > (H - 40) * CELL) continue;
    let top = c.y; while (top > 0 && !solid[Math.round(top - 1) * W + Math.round(c.x)]) top--;
    if (c.y - top > 14) continue;
    bells.push({ x: c.x * CELL, y: (top + 2) * CELL, r: 4.2 }); lastBell = depth;
  }
  // creatures: three of each species in its zone, crawlers on the floor; vents in the trench and abyss
  const cells: number[] = [];
  for (let i = W * (SEA_ROWS + 6); i < W * H; i++) if (reach[i] && sdf[i] > 2.4) cells.push(i);
  const pick = (from: number, to: number, floor: boolean, near: { x: number; y: number }[], gap: number, room = 0) => {
    for (let tries = 0; tries < 400; tries++) {
      const i = cells[Math.floor(r() * cells.length)], xx = i % W, yy = (i / W) | 0, d = yy * CELL;
      if (d < from || d >= to || sdf[i] < room) continue;
      let fy = yy;
      // crawlers sit in the lowest cell above the floor that the sub can still reach
      if (floor) { while (fy < H - 1 && !solid[(fy + 1) * W + xx]) fy++; while (fy > yy && !reach[fy * W + xx]) fy--; if (!reach[fy * W + xx] || (fy - yy) * CELL > 30 || sdf[(fy + 2) * W + xx] > 0.5 && sdf[(fy + 3) * W + xx] > 0.5) continue; }
      const p = { x: (xx + 0.5) * CELL, y: (fy + 0.5) * CELL };
      if (near.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < gap)) continue;
      return p;
    }
    return null;
  };
  const spawns: Spawn[] = [], used: { x: number; y: number }[] = [];
  const vents: { x: number; y: number }[] = [];
  for (let k = 0; k < 9; k++) { const p = pick(760, GH * CELL, true, vents, 50); if (p) vents.push(p); }
  for (const s of SPECIES) {
    const z = ZONES.find((zz) => zz.id === s.zone)!;
    for (let k = 0; k < PER_SPECIES; k++) {
      let p = s.id === 'ventsnail' && vents[k] ? pick(Math.max(z.from, vents[k].y - 40), vents[k].y + 2, true, used, 6) : null;
      p = p ?? pick(z.from + (z.id === 'twilight' ? 30 : 0), z.to, s.move === 'crawl', used, 26);
      if (!p) { worldFail = `no room for ${s.id}`; return null; }
      spawns.push({ kind: s.id, ...p }); used.push(p);
    }
  }
  // hazards keep to open chambers, so there is always room to steer round them
  for (let k = 0; k < 22; k++) { const p = pick(230, 1000, false, used, 14, 5.5); if (p) { spawns.push({ kind: 'veil', ...p }); used.push(p); } }
  const lures: { x: number; y: number }[] = [];
  for (let k = 0; k < 7; k++) { const p = pick(320 + k * 90, 420 + k * 100, false, [...lures, ...bells], 60, 7); if (p) { spawns.push({ kind: 'grimlure', ...p }); lures.push(p); } }
  return { seed, w: W, h: H, solid, sdf, reach, bells, vents, spawns, whale: { x: whale.x * CELL, y: whale.y * CELL, r: whale.r * CELL }, spine: spine.map((c) => ({ x: c.x * CELL, y: c.y * CELL })) };
}

/** Signed distance from each cell centre to the rock edge, in metres: two chamfer passes each way. */
function signedDistance(solid: Uint8Array, W: number, H: number) {
  const far = 1e6, D = 1, E = Math.SQRT2;
  const pass = (src: (i: number) => boolean) => {
    const d = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) d[i] = src(i) ? 0 : far;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = d[i]; if (!v) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + D);
      if (y > 0) { v = Math.min(v, d[i - W] + D); if (x > 0) v = Math.min(v, d[i - W - 1] + E); if (x < W - 1) v = Math.min(v, d[i - W + 1] + E); }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = d[i]; if (!v) continue;
      if (x < W - 1) v = Math.min(v, d[i + 1] + D);
      if (y < H - 1) { v = Math.min(v, d[i + W] + D); if (x < W - 1) v = Math.min(v, d[i + W + 1] + E); if (x > 0) v = Math.min(v, d[i + W - 1] + E); }
      d[i] = v;
    }
    return d;
  };
  const toRock = pass((i) => solid[i] === 1), toWater = pass((i) => solid[i] === 0);
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = solid[i] ? -(toWater[i] - 0.5) * CELL : (toRock[i] - 0.5) * CELL;
  return out;
}

/** The signed distance to rock at a point (metres), bilinear between cell centres. Above the sea it is open water. */
export function sdfAt(w: World, x: number, y: number) {
  if (y < 0) return 10;
  const fx = x / CELL - 0.5, fy = y / CELL - 0.5;
  const x0 = clamp(Math.floor(fx), 0, w.w - 2), y0 = clamp(Math.floor(fy), 0, w.h - 2), u = clamp(fx - x0, 0, 1), v = clamp(fy - y0, 0, 1);
  const i = y0 * w.w + x0, s = w.sdf;
  return (s[i] * (1 - u) + s[i + 1] * u) * (1 - v) + (s[i + w.w] * (1 - u) + s[i + w.w + 1] * u) * v;
}
export const isRock = (w: World, x: number, y: number) => sdfAt(w, x, y) < 0;

/** A path through cells the sub fits, from a point to the nearest goal cell, as world points (or null). Breadth first. */
export function pathTo(w: World, x: number, y: number, goal: (cx: number, cy: number) => boolean, maxCells = 60000) {
  const W = w.w, sx = clamp(Math.floor(x / CELL), 0, W - 1), sy = clamp(Math.floor(y / CELL), 0, w.h - 1), start = sy * W + sx;
  const prev = new Int32Array(W * w.h).fill(-1); prev[start] = start;
  const q = [start];
  for (let h = 0; h < q.length && h < maxCells; h++) {
    const i = q[h], cx = i % W, cy = (i / W) | 0;
    if (goal(cx, cy)) {
      const out: { x: number; y: number }[] = [];
      for (let k = i; k !== start; k = prev[k]) out.push({ x: ((k % W) + 0.5) * CELL, y: (((k / W) | 0) + 0.5) * CELL });
      return out.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= w.h) continue;
      const j = ny * W + nx; if (prev[j] >= 0 || !w.reach[j]) continue;
      prev[j] = i; q.push(j);
    }
  }
  return null;
}

// ---------------------------------------------------------------- upgrades
export type UpgId = 'hull' | 'tank' | 'motor' | 'sonar' | 'lamp' | 'tray';
export const UPGRADES: { id: UpgId; name: string; line: string; cost: number[]; levels: string[] }[] = [
  { id: 'hull', name: 'Pressure hull', line: 'How deep you can go before the hull starts to creak, and how many knocks it takes.', cost: [40, 90, 140], levels: ['250 m', '520 m', '820 m', '1,100 m'] },
  { id: 'tank', name: 'Air tank', line: 'How long you can stay down.', cost: [30, 70, 130], levels: ['3 min', '4 min 20', '6 min', '8 min'] },
  { id: 'motor', name: 'Propeller', line: 'Top speed and push.', cost: [30, 70, 120], levels: ['Steady', 'Brisk', 'Zippy', 'Whoosh'] },
  { id: 'sonar', name: 'Sonar', line: 'How far each ping reaches, and how soon you can ping again.', cost: [25, 60, 110], levels: ['40 m', '55 m', '70 m', '90 m'] },
  { id: 'lamp', name: 'Headlamp', line: 'How far your lamp lights.', cost: [20, 50, 90], levels: ['9 m', '11 m', '13 m', '15 m'] },
  { id: 'tray', name: 'Sample tray', line: 'How many specimens you can carry up.', cost: [25, 55, 100], levels: ['3', '5', '7', '10'] },
];
export type Levels = Record<UpgId, number>;
export function stats(l: Levels) {
  return {
    rating: [250, 520, 820, 1100][l.hull], hullMax: [100, 120, 150, 180][l.hull],
    air: [180, 260, 360, 480][l.tank], motor: [1, 1.15, 1.3, 1.45][l.motor],
    sonar: [40, 55, 70, 90][l.sonar], sonarCd: [2.6, 2.2, 1.8, 1.4][l.sonar],
    lamp: [9, 11, 13, 15][l.lamp], tray: [3, 5, 7, 10][l.tray],
  };
}
export type Stats = ReturnType<typeof stats>;

// ---------------------------------------------------------------- the dive
export type Input = { x: number; y: number; ping: boolean; lamp: boolean };
export const idleInput = (): Input => ({ x: 0, y: 0, ping: false, lamp: false });
const THRUST = 7, DRAG = 1.35, SINK = 0.12;
export const SONAR_SPEED = 70;
export const RAYS = 200;
const BUMP_SAFE = 3.4, BUMP_DMG = 7;
const CATCH_R = 2.4, CATCH_SPEED = 3.4;

export type Creature = {
  id: number; kind: SpecId | 'grimlure' | 'veil'; x: number; y: number; vx: number; vy: number; hx: number; hy: number;
  phase: number; caught: boolean;
  /** dart: fleeing until; grimlure: hunting until, going home until; veil: sting cool-down */ until: number; home: number;
  state: 'idle' | 'flee' | 'hunt' | 'home';
  tx: number; ty: number;
  /** a sonar ping showed it until this time */ seen: number;
};
export type Ping = { x: number; y: number; t: number; range: number };
export type Echo = { x: number; y: number; t: number };
export type DiveEnd = 'surfaced' | 'air' | 'hull' | 'whale';
export type DiveEvent =
  | { k: 'ping' } | { k: 'bump'; mag: number } | { k: 'catch'; id: SpecId; first: boolean } | { k: 'trayFull' }
  | { k: 'sting' } | { k: 'bite' } | { k: 'lureNear' } | { k: 'bell' } | { k: 'creak' } | { k: 'zone'; id: ZoneId }
  | { k: 'lowAir' } | { k: 'lowHull' } | { k: 'whale' } | { k: 'end'; why: DiveEnd } | { k: 'lamp'; on: boolean } | { k: 'deep'; depth: number };

export type DiveOpts = { world: World; levels: Levels; seed?: number; known?: SpecId[]; mapped?: Uint8Array };

export class Dive {
  w: World; st: Stats; rand: () => number;
  t = 0; x: number; y: number; vx = 0; vy = 0; face: 1 | -1 = 1; aim = 0.35;
  hull: number; air: number; lamp = true; pingCd = 0;
  tray: SpecId[] = []; creatures: Creature[] = []; pings: Ping[] = []; echoes: Echo[] = [];
  events: DiveEvent[] = []; over = false; why: DiveEnd | null = null;
  deepest = 0; zone: ZoneId = 'twilight'; mapped: Uint8Array;
  /** seen the whale this dive */ whale = false;
  private known: Set<SpecId>; private prev = idleInput(); private warned = { air: false, hull: false, creak: 0, lure: 0, full: 0 };
  private started = false; private bellT = 0; private lastDeep = 0;
  constructor(o: DiveOpts) {
    this.w = o.world; this.st = stats(o.levels); this.rand = rng(o.seed ?? 1);
    this.hull = this.st.hullMax; this.air = this.st.air;
    this.known = new Set(o.known ?? []);
    this.mapped = o.mapped ?? new Uint8Array(this.w.w * this.w.h);
    this.x = this.w.spine[0].x; this.y = 1.2;
    this.creatures = this.w.spawns.map((s, i) => ({ id: i, kind: s.kind, x: s.x, y: s.y, vx: 0, vy: 0, hx: s.x, hy: s.y, phase: hash(i, 3, 9) * 6.28, caught: false, until: 0, home: 0, state: 'idle', tx: s.x, ty: s.y, seen: -9 }));
  }
  get depth() { return Math.max(0, this.y); }
  get speed() { return Math.hypot(this.vx, this.vy); }
  /** where the lamp points: the facing side, tilted by up and down */
  get lampDir() { return { x: this.face * Math.cos(this.aim), y: Math.sin(this.aim) }; }

  tick(input: Input) {
    this.events.length = 0;
    if (this.over) return;
    const pressedPing = input.ping && !this.prev.ping, pressedLamp = input.lamp && !this.prev.lamp;
    this.prev = { ...input };
    this.t += DT;
    if (pressedLamp) { this.lamp = !this.lamp; this.events.push({ k: 'lamp', on: this.lamp }); }
    // the sub: thrust, water drag, a gentle sink when idle
    const m = this.st.motor, ix = clamp(input.x, -1, 1), iy = clamp(input.y, -1, 1), il = Math.hypot(ix, iy), k = il > 1 ? 1 / il : 1;
    this.vx += ix * k * THRUST * m * DT; this.vy += iy * k * THRUST * m * DT;
    if (il < 0.1) this.vy += SINK * DT;
    const drag = Math.exp(-DRAG * DT); this.vx *= drag; this.vy *= drag;
    // warm vents push up
    for (const v of this.w.vents) { const dx = this.x - v.x, dy = v.y - this.y; if (Math.abs(dx) < 3.5 && dy > 0 && dy < 22) this.vy -= 5.5 * (1 - dy / 22) * DT; }
    this.x += this.vx * DT; this.y += this.vy * DT;
    if (this.y < 0.6) { this.y = 0.6; if (this.vy < 0) this.vy = 0; }
    if (Math.abs(this.vx) > 0.4) this.face = this.vx > 0 ? 1 : -1;
    const want = clamp(iy * 0.75 + (il < 0.1 ? 0.3 : 0), -0.9, 1.0); this.aim += (want - this.aim) * Math.min(1, 4 * DT);
    this.collide();
    this.deepest = Math.max(this.deepest, this.depth);
    if (this.depth > 10) this.started = true;
    const z = zoneAt(this.depth).id; if (z !== this.zone) { this.zone = z; this.events.push({ k: 'zone', id: z }); }
    if (this.depth > this.lastDeep + 100 && this.depth >= 100) { this.lastDeep = Math.floor(this.depth / 100) * 100; this.events.push({ k: 'deep', depth: this.lastDeep }); }
    // air: it runs down; an air bell or the surface fills it
    this.air -= DT;
    let inBell = false;
    for (const b of this.w.bells) if (Math.hypot(this.x - b.x, this.y - b.y) < b.r + 1) inBell = true;
    if (inBell) { if (this.bellT <= 0 && this.air < this.st.air - 5) this.events.push({ k: 'bell' }); this.bellT = 2; this.air = Math.min(this.st.air, this.air + 45 * DT); this.warned.air = false; }
    else this.bellT -= DT;
    if (this.depth < 3) this.air = this.st.air;
    // pressure: past the hull's rating it creaks and gives
    if (this.depth > this.st.rating) {
      this.hull -= (1.6 + (this.depth - this.st.rating) / 30) * DT;
      if (this.t > this.warned.creak) { this.events.push({ k: 'creak' }); this.warned.creak = this.t + 3; }
    }
    // sonar
    this.pingCd = Math.max(0, this.pingCd - DT);
    if (pressedPing && this.pingCd <= 0) this.ping();
    this.pings = this.pings.filter((p) => this.t - p.t < p.range / SONAR_SPEED + 0.2);
    if (this.echoes.length && this.t - this.echoes[0].t > 7) this.echoes = this.echoes.filter((e) => this.t - e.t < 7);
    this.markLit();
    this.creaturesStep();
    if (!this.warned.air && this.air < this.st.air * 0.25) { this.warned.air = true; this.events.push({ k: 'lowAir' }); }
    if (!this.warned.hull && this.hull < this.st.hullMax * 0.3) { this.warned.hull = true; this.events.push({ k: 'lowHull' }); }
    // the whale
    if (!this.whale && Math.hypot(this.x - this.w.whale.x, this.y - this.w.whale.y) < this.w.whale.r) { this.whale = true; this.events.push({ k: 'whale' }); this.end('whale'); return; }
    if (this.air <= 0) { this.air = 0; this.end('air'); return; }
    if (this.hull <= 0) { this.hull = 0; this.end('hull'); return; }
    if (this.started && this.depth < 2.5) this.end('surfaced');
  }
  end(why: DiveEnd) {
    this.over = true; this.why = why;
    // a rescue (out of air, or a broken hull) loses the tray: Enzo winches you up but the samples float away
    if (why === 'air' || why === 'hull') this.tray = [];
    this.events.push({ k: 'end', why });
  }

  private collide() {
    for (let it = 0; it < 3; it++) {
      const d = sdfAt(this.w, this.x, this.y) - SUB_R;
      if (d >= 0) return;
      const e = 0.15, gx = sdfAt(this.w, this.x + e, this.y) - sdfAt(this.w, this.x - e, this.y), gy = sdfAt(this.w, this.x, this.y + e) - sdfAt(this.w, this.x, this.y - e);
      const gl = Math.hypot(gx, gy) || 1, nx = gx / gl, ny = gy / gl;
      this.x -= nx * d; this.y -= ny * d;
      const vn = this.vx * nx + this.vy * ny;
      if (vn < 0) {
        if (it === 0 && -vn > BUMP_SAFE) { const mag = -vn - BUMP_SAFE; this.hull -= mag * BUMP_DMG; this.events.push({ k: 'bump', mag }); }
        else if (it === 0 && -vn > 1.2) this.events.push({ k: 'bump', mag: 0 });
        this.vx -= 1.3 * vn * nx; this.vy -= 1.3 * vn * ny;
      }
    }
  }

  ping() {
    this.pingCd = this.st.sonarCd;
    const range = this.st.sonar, t0 = this.t;
    this.pings.push({ x: this.x, y: this.y, t: t0, range });
    this.events.push({ k: 'ping' });
    for (let a = 0; a < RAYS; a++) {
      const ang = (a / RAYS) * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
      let d = 0;
      while (d < range) {
        const s = sdfAt(this.w, this.x + dx * d, this.y + dy * d);
        if (s < 0) { const hx = this.x + dx * d, hy = this.y + dy * d; this.echoes.push({ x: hx, y: hy, t: t0 + d / SONAR_SPEED }); this.mark(hx, hy, 1); break; }
        d += Math.max(0.35, s * 0.9);
      }
    }
    if (this.echoes.length > 4000) this.echoes.splice(0, this.echoes.length - 4000);
    // creatures in reach of the ping show for a while; Grimlures hear it from further away and come to look
    for (const c of this.creatures) {
      if (c.caught) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y);
      if (d < range && this.sees(this.x, this.y, c.x, c.y)) c.seen = t0 + d / SONAR_SPEED + 4;
      if (c.kind === 'grimlure' && d < range * 1.5 && c.state !== 'home') { c.state = 'hunt'; c.tx = this.x; c.ty = this.y; c.until = this.t + 9; }
    }
  }

  /** a clear line of water between two points */
  sees(ax: number, ay: number, bx: number, by: number) {
    const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 1.2);
    for (let i = 1; i < n; i++) if (sdfAt(this.w, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n) < 0) return false;
    return true;
  }
  private mark(x: number, y: number, r: number) {
    const W = this.w.w, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < this.w.h) this.mapped[yy * W + xx] = 1;
  }
  /** the lamp (or, with it off, a faint glow) maps the rock it lights */
  private markLit() {
    if ((this.step++ & 7) !== 0) return;
    const r = this.lamp ? this.st.lamp : 3, W = this.w.w, cx = Math.floor(this.x / CELL), cy = Math.floor(this.y / CELL), cr = Math.ceil(r / CELL);
    for (let yy = cy - cr; yy <= cy + cr; yy++) for (let xx = cx - cr; xx <= cx + cr; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= this.w.h) continue;
      if (Math.hypot(xx - cx, yy - cy) <= cr) this.mapped[yy * W + xx] = 1;
    }
  }
  private step = 0;

  /** is the sub lit up to this creature: inside the lamp's reach and cone (or right next to it) */
  litFor(c: { x: number; y: number }, reach = this.st.lamp) {
    const dx = c.x - this.x, dy = c.y - this.y, d = Math.hypot(dx, dy);
    if (d < 2.5) return this.lamp;
    if (!this.lamp || d > reach) return false;
    const L = this.lampDir; return (dx * L.x + dy * L.y) / d > 0.55;
  }

  private creaturesStep() {
    const t = this.t;
    for (const c of this.creatures) {
      if (c.caught) continue;
      const dx = this.x - c.x, dy = this.y - c.y, d = Math.hypot(dx, dy);
      if (c.kind === 'grimlure') { this.lure(c, d); continue; }
      if (c.kind === 'veil') {
        c.x = c.hx + Math.sin(t * 0.21 + c.phase) * 4; c.y = c.hy + Math.sin(t * 0.33 + c.phase * 2) * 2.5;
        if (d < 1.9 + SUB_R * 0.4 && t > c.until) { c.until = t + 1.2; this.hull -= 9; this.vx += (dx / (d || 1)) * 3; this.vy += (dy / (d || 1)) * 3; this.events.push({ k: 'sting' }); }
        continue;
      }
      const s = spec(c.kind);
      let px = c.x, py = c.y;
      if (s.move === 'drift' || s.move === 'swarm') { px = c.hx + Math.sin(t * 0.3 + c.phase) * 3; py = c.hy + Math.sin(t * 0.47 + c.phase) * 2; }
      else if (s.move === 'swim') { px = c.hx + Math.cos(t * 0.35 + c.phase) * 7; py = c.hy + Math.sin(t * 0.35 + c.phase) * 3.5; }
      else if (s.move === 'crawl') { px = c.hx + Math.sin(t * 0.12 + c.phase) * 2.5; py = c.hy; }
      else if (s.move === 'dart') {
        // shy darters flee a lamp shone at them, or a sub barging in fast; then drift home
        const spooked = this.litFor(c, this.st.lamp + 2) || (d < 6 && this.speed > 3.6);
        if (spooked && c.state !== 'flee') { c.state = 'flee'; c.until = t + 2.2; }
        if (c.state === 'flee') {
          if (t > c.until) c.state = 'home';
          const ax = -dx / (d || 1), ay = -dy / (d || 1); px = c.x + ax * 7 * DT; py = c.y + ay * 7 * DT;
        } else {
          const hx = c.hx + Math.sin(t * 0.5 + c.phase) * 2, hy = c.hy + Math.cos(t * 0.4 + c.phase) * 1.2, hd = Math.hypot(hx - c.x, hy - c.y);
          const v = Math.min(hd, 1.6 * DT); px = c.x + ((hx - c.x) / (hd || 1)) * v; py = c.y + ((hy - c.y) / (hd || 1)) * v;
          if (hd < 0.5) c.state = 'idle';
        }
      }
      if (sdfAt(this.w, px, py) > 0.6) { c.vx = (px - c.x) / DT; c.vy = (py - c.y) / DT; c.x = px; c.y = py; }
      // the catch: drift up gently
      if (d < CATCH_R && this.speed < CATCH_SPEED) {
        if (this.tray.length >= this.st.tray) { if (t > this.warned.full) { this.events.push({ k: 'trayFull' }); this.warned.full = t + 4; } }
        else { c.caught = true; this.tray.push(c.kind); const first = !this.known.has(c.kind); this.known.add(c.kind); this.events.push({ k: 'catch', id: c.kind, first }); }
      }
    }
  }
  private lure(c: Creature, d: number) {
    const t = this.t;
    // it sees a lamp shone at it from further than it can see a dark sub
    if (c.state !== 'home' && ((this.lamp && d < 24 && this.sees(c.x, c.y, this.x, this.y)) || d < 4.5)) { c.state = 'hunt'; c.tx = this.x; c.ty = this.y; c.until = t + 6; }
    let tx = c.hx + Math.cos(t * 0.15 + c.phase) * 8, ty = c.hy + Math.sin(t * 0.2 + c.phase) * 4, sp = 1.4;
    if (c.state === 'hunt') { tx = c.tx; ty = c.ty; sp = 4.4; if (t > c.until) c.state = 'idle'; }
    if (c.state === 'home') { tx = c.hx; ty = c.hy; sp = 3; if (t > c.until) c.state = 'idle'; }
    const ex = tx - c.x, ey = ty - c.y, el = Math.hypot(ex, ey);
    if (el > 0.3) {
      const step = Math.min(el, sp * DT), nx = c.x + (ex / el) * step, ny = c.y + (ey / el) * step;
      if (sdfAt(this.w, nx, ny) > 1) { c.vx = (nx - c.x) / DT; c.vy = (ny - c.y) / DT; c.x = nx; c.y = ny; }
      else if (c.state === 'hunt') c.state = 'idle';
    }
    if (c.state === 'hunt' && d < 14 && t > this.warned.lure) { this.events.push({ k: 'lureNear' }); this.warned.lure = t + 8; }
    if (d < 2.6 && c.state !== 'home') {
      this.hull -= 25; this.vx += ((this.x - c.x) / (d || 1)) * 6; this.vy += ((this.y - c.y) / (d || 1)) * 6;
      // a bite fills it up: it swims home and leaves you be for a while
      c.state = 'home'; c.until = t + 25; this.events.push({ k: 'bite' });
    }
  }

  /** a short way back to air: the surface, or an air bell, through the water the sub fits */
  wayToAir() {
    const bells = this.w.bells.map((b) => ({ x: Math.floor(b.x / CELL), y: Math.floor(b.y / CELL) }));
    return pathTo(this.w, this.x, this.y, (cx, cy) => cy <= 1 || bells.some((b) => Math.abs(b.x - cx) <= 1 && Math.abs(b.y - cy) <= 1));
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'deepglow-v1';
export type Save = {
  v: 1; points: number; levels: Levels;
  /** specimens banked per species */ journal: Partial<Record<SpecId, number>>;
  /** the sonar map, run-length packed */ map: string;
  whale: boolean; intro: boolean;
  settings: { sound: boolean; music: boolean };
  stats: { dives: number; rescues: number; deepest: number; banked: number };
};
export const newSave = (): Save => ({ v: 1, points: 0, levels: { hull: 0, tank: 0, motor: 0, sonar: 0, lamp: 0, tray: 0 }, journal: {}, map: '', whale: false, intro: false,
  settings: { sound: true, music: true }, stats: { dives: 0, rescues: 0, deepest: 0, banked: 0 } });
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
export function parseSave(raw: string | null): Save {
  const s = newSave();
  if (!raw) return s;
  let d: Record<string, unknown>;
  try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return s;
  s.points = Math.floor(num(d.points, 0, 1e6, 0));
  const lv = (d.levels && typeof d.levels === 'object' ? d.levels : {}) as Record<string, unknown>;
  for (const u of UPGRADES) s.levels[u.id] = Math.floor(num(lv[u.id], 0, u.cost.length, 0));
  const j = (d.journal && typeof d.journal === 'object' ? d.journal : {}) as Record<string, unknown>;
  for (const sp of SPECIES) { const n = Math.floor(num(j[sp.id], 0, 9999, 0)); if (n) s.journal[sp.id] = n; }
  if (typeof d.map === 'string' && /^[0-9a-z,]*$/.test(d.map) && d.map.length < 200000) s.map = d.map;
  s.whale = d.whale === true; s.intro = d.intro === true;
  const st = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  s.settings.sound = st.sound !== false; s.settings.music = st.music !== false;
  const ss = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as Record<string, unknown>;
  for (const k of Object.keys(s.stats) as (keyof Save['stats'])[]) s.stats[k] = Math.floor(num(ss[k], 0, 1e7, 0));
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** Pack the map's 0/1 cells as alternating run lengths in base 36 (starting with a run of 0s). */
export function packMap(m: Uint8Array) {
  const out: string[] = []; let cur = 0, run = 0;
  for (let i = 0; i < m.length; i++) { const v = m[i] ? 1 : 0; if (v === cur) run++; else { out.push(run.toString(36)); cur = v; run = 1; } }
  out.push(run.toString(36));
  return out.join(',');
}
export function unpackMap(s: string, n = GW * GH) {
  const m = new Uint8Array(n); if (!s) return m;
  let i = 0, cur = 0;
  for (const part of s.split(',')) { const run = parseInt(part, 36) || 0; if (cur) m.fill(1, i, Math.min(n, i + run)); i += run; cur ^= 1; if (i >= n) break; }
  return m;
}
export const mappedShare = (m: Uint8Array, w: World) => { let a = 0, b = 0; for (let i = 0; i < m.length; i++) if (w.reach[i]) { b++; if (m[i]) a++; } return b ? a / b : 0; };
export function upgradeCost(s: Save, id: UpgId) { const u = UPGRADES.find((x) => x.id === id)!; return s.levels[id] < u.cost.length ? u.cost[s.levels[id]] : null; }
export function buy(s: Save, id: UpgId) { const c = upgradeCost(s, id); if (c === null || s.points < c) return false; s.points -= c; s.levels[id]++; return true; }
/** What a finished dive brings home: research for the tray, the journal, the map and the records. */
export function bank(s: Save, d: Dive) {
  let earned = 0; const firsts: SpecId[] = [];
  // Enzo's chart: research for cave mapped for the first time (by sonar or lamp), surfaced or rescued
  const before = unpackMap(s.map, d.mapped.length); let fresh = 0;
  for (let i = 0; i < d.mapped.length; i++) if (d.mapped[i] && !before[i] && d.w.reach[i]) fresh++;
  const chart = Math.floor(fresh / POINTS.chart); earned += chart;
  for (const id of d.tray) { const had = s.journal[id] ?? 0; earned += had ? POINTS.repeat : POINTS.first; if (!had) firsts.push(id); s.journal[id] = had + 1; }
  s.points += earned; s.stats.dives++; s.stats.banked += d.tray.length;
  if (d.why === 'air' || d.why === 'hull') s.stats.rescues++;
  s.stats.deepest = Math.max(s.stats.deepest, Math.round(d.deepest));
  if (d.why === 'whale') s.whale = true;
  s.map = packMap(d.mapped);
  return { earned, firsts, chart };
}
export const journalCount = (s: Save) => SPECIES.filter((x) => (s.journal[x.id] ?? 0) > 0).length;

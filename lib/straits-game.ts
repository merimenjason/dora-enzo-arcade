// Little Red Dot: The Straits, the first voyage. The rules, with no DOM: a toy-sized bumboat sailing a small sea between
// Singapore's islands, otter rafts to outrun or sink, one conversation that changes the trip, docks to repair and
// upgrade at, and a hay bale to land on Pulau Ubin. Everything random comes from the seed, so a seed and the same
// inputs replay exactly. The map is a toy: the islands are named for real ones but are not where they really are.

export const DT = 1 / 60;
export const SAVE_KEY = 'straits-v1';
export const BOUND = 96; // the sea is a square, this far from the middle each way
export const SHORE_Z = -80; // the mainland fills everything north of this

export type HeroId = 'dora' | 'enzo';
export type Stance = 'hostile' | 'calm';
export type FoeKind = 'raft' | 'bishan' | 'hunter';
export type Phase = 'sail' | 'talk' | 'dock' | 'won' | 'lost';
export type DockAction = 'repair' | 'hull' | 'volley' | 'bounty';
export type Choice = 'bargain' | 'bluff' | 'fight' | 'ally' | 'trade' | 'decline' | 'wind' | 'cats' | 'shoo';

export interface Island { id: string; name: string; x: number; z: number; r: number; dock: [number, number] | null; view: boolean }
export const ISLANDS: Island[] = [
  { id: 'sentosa', name: 'Sentosa', x: -14, z: -34, r: 14, dock: [-14, -51], view: true },
  { id: 'stjohns', name: "St John's Island", x: 26, z: 4, r: 7, dock: [17, 4], view: true },
  { id: 'kusu', name: 'Kusu Island', x: 42, z: 22, r: 4, dock: null, view: false },
  { id: 'semakau', name: 'Pulau Semakau', x: -52, z: 30, r: 10, dock: null, view: false },
  { id: 'ubin', name: 'Pulau Ubin', x: 66, z: 58, r: 12, dock: [55.5, 48.5], view: false },
];
export const HOME = { id: 'home', name: 'Tiong Bahru jetty', x: 0, z: -75 };
export const KELONG = { x: 20, z: -24, r: 3.2 };
export const DOCKS = [{ id: 'home', name: HOME.name, x: HOME.x, z: HOME.z }, ...ISLANDS.filter(i => i.dock).map(i => ({ id: i.id, name: i.name, x: i.dock![0], z: i.dock![1] }))];

export const SPEEDS = [0, 2.2, 4.2, 6.2]; // stopped, rowing, half sail, full sail (metres a second)
export const SPEED_NAMES = ['STOPPED', 'ROW', 'HALF SAIL', 'FULL SAIL'];
export const HERO = {
  dora: { hull: 100, turn: 1.5, reload: 1.25, ram: 30 },
  enzo: { hull: 130, turn: 1.2, reload: 1.6, ram: 45 },
} as const;
const FOE = {
  raft: { hp: 40, speed: 3.1, r: 1.0, sight: 17, reload: 2.6, shot: 5, bump: 8 },
  bishan: { hp: 170, speed: 3.9, r: 1.7, sight: 60, reload: 1.7, shot: 7, bump: 14 },
  hunter: { hp: 90, speed: 5.1, r: 1.1, sight: 200, reload: 2.1, shot: 9, bump: 10 },
} as const;
export const PLAYER_R = 0.9;
export const VOLLEY_RANGE = 14;
export const COSTS = { hull: 10, volley: 10, bountyPerPip: 4 };

/** `fire` lets go the side that faces the nearest foe; `firePort` and `fireStar` let go one side whatever is there. */
export interface Input { turn: number; faster: boolean; slower: boolean; fire: boolean; firePort: boolean; fireStar: boolean; brace: boolean; ram: boolean; act: boolean }
export const NO_INPUT: Input = { turn: 0, faster: false, slower: false, fire: false, firePort: false, fireStar: false, brace: false, ram: false, act: false };

export interface Foe { id: number; kind: FoeKind; x: number; z: number; h: number; hp: number; max: number; cool: number; bump: number; path: [number, number][]; leg: number; chasing: boolean; alive: boolean }
export interface Shot { x: number; z: number; vx: number; vz: number; ttl: number; mine: boolean; dmg: number }
export interface Crate { x: number; z: number; seeds: number }
export type Ev =
  | { k: 'volley'; side: -1 | 1 } | { k: 'clam'; x: number; z: number } | { k: 'hit'; x: number; z: number; mine: boolean } | { k: 'sink'; x: number; z: number; kind: FoeKind }
  | { k: 'loot'; seeds: number } | { k: 'bump' } | { k: 'capsize' } | { k: 'dock'; id: string } | { k: 'talk' } | { k: 'found'; id: string } | { k: 'say'; text: string } | { k: 'won' } | { k: 'lost' };

export interface Game {
  seed: number; rng: number; hero: HeroId; t: number; phase: Phase;
  x: number; z: number; h: number; v: number; gear: number;
  hull: number; maxHull: number; hay: number; seeds: number; volley: number;
  /** Each side reloads on its own: port, then starboard. */
  reloadP: number; reloadS: number; ramCool: number; ramT: number; bracing: boolean; hurtT: number;
  foes: Foe[]; shots: Shot[]; crates: Crate[]; nextId: number;
  power: number; bounty: number; sunk: number; stance: Stance; met: boolean; outcome: Choice | 'none'; bluffed: boolean | null; bishanDown: boolean;
  /** The way the wind blows towards, as a heading; where it is veering to; seconds until it picks a new one; held for good by Tok Tiong. */
  wind: number; windTo: number; windT: number; windHeld: boolean;
  talkId: string | null; seen: string[]; ally: boolean;
  found: string[]; lastDock: string; dockId: string | null; nearDock: string | null; capsizes: number;
  events: Ev[];
}

// ---------- seeded random ----------
function rand(g: Game): number {
  g.rng = (g.rng + 0x6d2b79f5) | 0; let t = Math.imul(g.rng ^ (g.rng >>> 15), 1 | g.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const forward = (h: number): [number, number] => [Math.sin(h), Math.cos(h)];
export const starboard = (h: number): [number, number] => [-Math.cos(h), Math.sin(h)];

const PATROLS: [number, number][][] = [
  [[-6, -56], [18, -52], [8, -60]],
  [[30, -34], [44, -18], [30, -12], [22, -34]],
  [[6, 8], [14, 22], [-4, 20]],
  [[48, 4], [58, 24], [46, 34]],
  [[-34, 0], [-28, 22], [-44, 8]],
];

function spawn(g: Game, kind: FoeKind, x: number, z: number, path: [number, number][] = []): Foe {
  const f: Foe = { id: g.nextId++, kind, x, z, h: 0, hp: FOE[kind].hp, max: FOE[kind].hp, cool: 1 + rand(g), bump: 0, path, leg: 0, chasing: false, alive: true };
  g.foes.push(f); return f;
}

export function newGame(seed: number, hero: HeroId): Game {
  const g: Game = {
    seed, rng: seed | 0, hero, t: 0, phase: 'sail',
    x: HOME.x, z: HOME.z + 4, h: 0, v: 0, gear: 0,
    hull: HERO[hero].hull, maxHull: HERO[hero].hull, hay: 100, seeds: 0, volley: 12,
    reloadP: 0, reloadS: 0, ramCool: 0, ramT: 0, bracing: false, hurtT: 0,
    foes: [], shots: [], crates: [], nextId: 1,
    power: 100, bounty: 0, sunk: 0, stance: 'hostile', met: false, outcome: 'none', bluffed: null, bishanDown: false,
    wind: 0, windTo: 0, windT: 16, windHeld: false, talkId: null, seen: [], ally: false,
    found: ['home', 'ubin'], lastDock: 'home', dockId: null, nearDock: null, capsizes: 0, events: [],
  };
  g.wind = g.windTo = rand(g) * Math.PI * 2;
  for (const p of PATROLS) spawn(g, 'raft', p[0][0], p[0][1], p);
  return g;
}

// ---------- wind ----------
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/** How far off the wind the bow points: 0 with the wind dead astern, π straight into it. */
export const offWind = (h: number, wind: number) => Math.abs(wrap(h - wind));
const SAIL_CURVE: [number, number][] = [[0, 1], [1.2, 1.15], [1.9, 1.1], [2.4, 0.7], [2.8, 0.35], [Math.PI, 0.3]];
/** What the sail makes of the wind on this heading: best across it, poor close to it, almost nothing straight into it. Rowing ignores the wind. */
export function sailFactor(h: number, wind: number, gear: number): number {
  if (gear < 2) return 1; const a = offWind(h, wind);
  for (let i = 1; i < SAIL_CURVE.length; i++) if (a <= SAIL_CURVE[i][0]) { const [a0, f0] = SAIL_CURVE[i - 1], [a1, f1] = SAIL_CURVE[i]; return f0 + (f1 - f0) * (a - a0) / (a1 - a0); }
  return 0.3;
}
export function pointOfSail(h: number, wind: number): 'RUNNING' | 'REACHING' | 'BEATING' | 'IN IRONS' { const a = offWind(h, wind); return a < 0.7 ? 'RUNNING' : a < 2.05 ? 'REACHING' : a < 2.65 ? 'BEATING' : 'IN IRONS'; }

// ---------- conversations ----------
export interface Encounter { id: string; who: string; x: number; z: number; r: number; line: string; choices: { id: Choice; label: string; text: string }[] }
const SENTOSA_JETTY = ISLANDS[0].dock!, STJOHNS_JETTY = ISLANDS[1].dock!;
export const ENCOUNTERS: Encounter[] = [
  { id: 'bishan', who: 'Captain Bishan', x: KELONG.x, z: KELONG.z, r: KELONG.r + 9,
    line: 'You sail through our strait, small one. The Marina pack takes a toll, and today the toll is that whole hay bale.',
    choices: [
      { id: 'bargain', label: 'Bargain', text: 'Take a quarter. The rest feeds Ubin, and Ubin remembers its friends.' },
      { id: 'bluff', label: 'Bluff', text: "It isn't hay. It's durian husk. Go on, smell it." },
      { id: 'fight', label: 'Fight', text: 'Come and take it.' },
    ] },
  { id: 'kera', who: 'Auntie Kera', x: SENTOSA_JETTY[0], z: SENTOSA_JETTY[1], r: 9,
    line: 'Hay for Ubin, and the otters between you and it. We macaques have no love for that pack. Take our coconut mortar and give them something to remember, or sell me a little of that bale.',
    choices: [
      { id: 'ally', label: 'Ally', text: 'Lash it to the rail. Every volley hits harder, and the otters will hear whose side you are on.' },
      { id: 'trade', label: 'Trade', text: 'A tenth of the bale for fifteen sunflower seeds.' },
      { id: 'decline', label: 'Decline', text: 'Kind of you, Auntie. I will keep out of it.' },
    ] },
  { id: 'tiong', who: 'Tok Tiong', x: STJOHNS_JETTY[0], z: STJOHNS_JETTY[1], r: 8,
    line: 'Awk. Forty years on this jetty and I know every breeze and every cat between here and Ubin. What is it worth to you?',
    choices: [
      { id: 'wind', label: 'Fair wind', text: 'Six seeds for a wind that blows straight to Ubin and holds.' },
      { id: 'cats', label: 'Lose the cats', text: 'A tenth of the bale, and he tells the cats you sailed for Semakau.' },
      { id: 'shoo', label: 'Sail on', text: 'Nothing today, Tok.' },
    ] },
];
const UBIN_JETTY = ISLANDS[4].dock!;
/** The conversation that is open, with which answers can be given right now and why not. */
export function talkOf(g: Game) {
  const e = ENCOUNTERS.find(k => k.id === g.talkId); if (!e) return null;
  const why = (c: Choice): string => {
    if (c === 'bargain' && g.ally) return 'He has heard who your friends are.';
    if ((c === 'trade' || c === 'cats') && g.hay <= 10) return 'Not enough hay left to spare.';
    if (c === 'wind' && g.seeds < 6) return 'You have fewer than six seeds.';
    if (c === 'wind' && g.windHeld) return 'The wind is already yours.';
    if (c === 'cats' && g.bounty === 0) return 'No cat is after you.';
    return '';
  };
  return { ...e, choices: e.choices.map(c => ({ ...c, no: why(c.id) })) };
}
function showdown(g: Game) {
  if (g.foes.some(f => f.kind === 'bishan')) return;
  g.stance = 'hostile'; spawn(g, 'bishan', KELONG.x + 4, KELONG.z + 5);
  g.events.push({ k: 'say', text: 'Captain Bishan casts off. Sink his war raft or run for Ubin.' });
}
/** Give an answer in the open conversation. Returns false when none is open or that answer cannot be given. */
export function choose(g: Game, c: Choice): boolean {
  const t = g.phase === 'talk' ? talkOf(g) : null, pick = t?.choices.find(k => k.id === c);
  if (!t || !pick || pick.no) return false;
  g.phase = 'sail'; g.talkId = null; g.events.length = 0;
  const say = (text: string) => g.events.push({ k: 'say', text });
  if (t.id === 'bishan') g.outcome = c;
  if (c === 'bargain') { g.hay = Math.max(1, g.hay - 25); g.stance = 'calm'; say('The otters take a quarter of the bale and wave you through.'); }
  else if (c === 'bluff') {
    // A clean record helps: every bounty pip makes the otters less inclined to believe you.
    g.bluffed = rand(g) < clamp(0.65 - g.bounty * 0.15, 0.2, 0.65);
    if (g.bluffed) { g.stance = 'calm'; say('Bishan sniffs, gags, and waves you on. The whole bale is yours.'); }
    else { say('Bishan sniffs. "That is hay."'); showdown(g); }
  } else if (c === 'fight') showdown(g);
  else if (c === 'ally') {
    g.ally = true; g.volley += 6; say('A coconut mortar is lashed to the rail: every volley hits harder. The otters will hear of it.');
    if (g.stance === 'calm' && !g.bishanDown) { g.stance = 'hostile'; say('Word reaches the pack. The truce with the otters is off.'); }
  } else if (c === 'trade') { g.hay -= 10; g.seeds += 15; say('Auntie Kera weighs out fifteen seeds for a tenth of the bale.'); }
  else if (c === 'wind') { g.seeds -= 6; g.windHeld = true; g.wind = g.windTo = Math.atan2(UBIN_JETTY[0] - g.x, UBIN_JETTY[1] - g.z); say('Tok Tiong whistles, and the wind swings round to blow straight for Ubin. It will hold.'); }
  else if (c === 'cats') { g.hay -= 10; g.bounty = 0; for (const f of g.foes) if (f.kind === 'hunter') f.alive = false; g.foes = g.foes.filter(f => f.alive); say('Tok Tiong flaps off to tell the cats you sailed for Semakau. The bounty is forgotten.'); }
  else if (c === 'decline') say('Auntie Kera shrugs. "Mind the clams, then."');
  else say('Tok Tiong goes back to his nap.');
  return true;
}

// ---------- docks ----------
export function dockOptions(g: Game) {
  return {
    repair: { cost: Math.ceil((g.maxHull - g.hull) / 10), can: g.hull < g.maxHull },
    hull: { cost: COSTS.hull, can: g.maxHull < HERO[g.hero].hull + 75 },
    volley: { cost: COSTS.volley, can: g.volley < 24 },
    bounty: { cost: g.bounty * COSTS.bountyPerPip, can: g.bounty > 0 },
  };
}
/** Spend seeds at a dock. Returns false when it is not allowed or not affordable. */
export function dockAction(g: Game, a: DockAction): boolean {
  if (g.phase !== 'dock') return false;
  const o = dockOptions(g)[a]; if (!o.can || g.seeds < o.cost) return false;
  g.seeds -= o.cost;
  if (a === 'repair') g.hull = g.maxHull;
  else if (a === 'hull') { g.maxHull += 25; g.hull += 25; }
  else if (a === 'volley') g.volley += 4;
  else { g.bounty = 0; for (const f of g.foes) if (f.kind === 'hunter') f.alive = false; }
  return true;
}
export function leaveDock(g: Game) { if (g.phase === 'dock') { g.phase = 'sail'; g.dockId = null; } }

// ---------- one tick ----------
function hurt(g: Game, dmg: number) {
  g.hull -= g.bracing ? dmg * 0.4 : dmg; g.hurtT = 0.35;
  if (g.hull <= 0) capsize(g);
}
function capsize(g: Game) {
  g.capsizes++; g.hay -= 15; g.seeds = Math.floor(g.seeds / 2); g.events.push({ k: 'capsize' });
  if (g.hay <= 0) { g.hay = 0; g.phase = 'lost'; g.events.push({ k: 'lost' }); return; }
  const d = DOCKS.find(k => k.id === g.lastDock)!; const out = d.id === 'home' ? [0, 4] : outFrom(d);
  g.x = d.x + out[0]; g.z = d.z + out[1]; g.v = 0; g.gear = 0; g.hull = Math.round(g.maxHull * 0.6); g.shots.length = 0;
  for (const f of g.foes) { f.chasing = false; if (f.kind === 'raft') { f.x = f.path[0][0]; f.z = f.path[0][1]; } }
}
function outFrom(d: { id: string; x: number; z: number }): [number, number] {
  const i = ISLANDS.find(k => k.id === d.id)!; const l = dist(d.x, d.z, i.x, i.z) || 1; return [(d.x - i.x) / l * 3, (d.z - i.z) / l * 3];
}
function pushOut(o: { x: number; z: number }, r: number): boolean {
  let hit = false;
  for (const i of ISLANDS) { const d = dist(o.x, o.z, i.x, i.z), m = i.r + r; if (d < m) { const k = d || 1; o.x = i.x + (o.x - i.x) / k * m; o.z = i.z + (o.z - i.z) / k * m; hit = true; } }
  { const d = dist(o.x, o.z, KELONG.x, KELONG.z), m = KELONG.r + r; if (d < m) { const k = d || 1; o.x = KELONG.x + (o.x - KELONG.x) / k * m; o.z = KELONG.z + (o.z - KELONG.z) / k * m; hit = true; } }
  if (o.z < SHORE_Z + r) { o.z = SHORE_Z + r; hit = true; }
  if (Math.abs(o.x) > BOUND) { o.x = Math.sign(o.x) * BOUND; hit = true; }
  if (o.z > BOUND) { o.z = BOUND; hit = true; }
  return hit;
}
function nearestFoe(g: Game, range: number): Foe | null {
  let best: Foe | null = null, bd = range;
  for (const f of g.foes) if (f.alive) { const d = dist(g.x, g.z, f.x, f.z) - FOE[f.kind].r; if (d < bd) { bd = d; best = f; } }
  return best;
}
function sink(g: Game, f: Foe) {
  f.alive = false; g.sunk++; g.events.push({ k: 'sink', x: f.x, z: f.z, kind: f.kind });
  if (f.kind === 'raft') {
    g.crates.push({ x: f.x, z: f.z, seeds: 4 + Math.floor(rand(g) * 4) });
    g.power = Math.max(0, g.power - 15); g.bounty = Math.min(5, g.bounty + 1);
    if (g.stance === 'calm') { g.stance = 'hostile'; g.events.push({ k: 'say', text: 'You fired on the pack. The truce is off.' }); }
    if (g.power <= 40 && !g.bishanDown) showdown(g);
    if (g.bounty >= 2 && !g.foes.some(k => k.kind === 'hunter' && k.alive)) {
      const a = rand(g) * Math.PI * 2; spawn(g, 'hunter', clamp(g.x + Math.sin(a) * 40, -BOUND, BOUND), clamp(g.z + Math.cos(a) * 40, SHORE_Z + 6, BOUND));
      g.events.push({ k: 'say', text: 'The community cats have sent a hunter after you.' });
    }
  } else if (f.kind === 'bishan') {
    g.bishanDown = true; g.power = 0; g.stance = 'calm'; g.crates.push({ x: f.x, z: f.z, seeds: 20 });
    g.events.push({ k: 'say', text: 'Bishan yields. The strait is open and the otters will leave you be.' });
  } else { g.bounty = 0; g.crates.push({ x: f.x, z: f.z, seeds: 10 }); }
}

export function step(g: Game, inp: Input): void {
  g.events.length = 0;
  if (g.phase !== 'sail') return;
  g.t += DT;
  const H = HERO[g.hero];
  // the boat
  if (inp.faster) g.gear = Math.min(3, g.gear + 1);
  if (inp.slower) g.gear = Math.max(0, g.gear - 1);
  g.bracing = inp.brace;
  g.ramCool = Math.max(0, g.ramCool - DT); g.ramT = Math.max(0, g.ramT - DT); g.reloadP = Math.max(0, g.reloadP - DT); g.reloadS = Math.max(0, g.reloadS - DT); g.hurtT = Math.max(0, g.hurtT - DT);
  if (inp.ram && g.ramCool <= 0 && g.gear > 0) { g.ramT = 1.1; g.ramCool = 6; }
  // the wind veers slowly to a new quarter every so often, unless Tok Tiong is holding it
  if (!g.windHeld) { g.windT -= DT; if (g.windT <= 0) { g.windTo = g.wind + (rand(g) - 0.5) * 1.8; g.windT = 18 + rand(g) * 14; } g.wind += clamp(wrap(g.windTo - g.wind), -0.05 * DT, 0.05 * DT); }
  const want = SPEEDS[g.gear] * sailFactor(g.h, g.wind, g.gear) * (g.bracing ? 0.5 : 1) * (g.ramT > 0 ? 1.8 : 1);
  g.v += clamp(want - g.v, -3.2 * DT, (g.ramT > 0 ? 9 : 2.4) * DT);
  g.h -= clamp(inp.turn, -1, 1) * H.turn * (0.35 + 0.65 * Math.min(1, g.v / 3)) * DT;
  const [fx, fz] = forward(g.h); g.x += fx * g.v * DT; g.z += fz * g.v * DT;
  if (pushOut(g, PLAYER_R)) g.v *= 0.9;

  // volleys: three peanuts off one side. Each side reloads on its own, so a boat that turns to bring the other side
  // round fires twice as often as one that waits.
  const [sx, sz] = starboard(g.h);
  const volley = (side: -1 | 1) => {
    if (side < 0) g.reloadP = H.reload; else g.reloadS = H.reload;
    for (const k of [-1, 0, 1]) { const a = Math.atan2(sx * side, sz * side) + k * 0.12; g.shots.push({ x: g.x + sx * side * 0.6, z: g.z + sz * side * 0.6, vx: Math.sin(a) * 17 + fx * g.v * 0.5, vz: Math.cos(a) * 17 + fz * g.v * 0.5, ttl: VOLLEY_RANGE / 17, mine: true, dmg: g.volley }); }
    g.events.push({ k: 'volley', side });
  };
  if (inp.firePort && g.reloadP <= 0) volley(-1);
  if (inp.fireStar && g.reloadS <= 0) volley(1);
  if (inp.fire) { const t = nearestFoe(g, VOLLEY_RANGE + 4), side = t && (t.x - g.x) * sx + (t.z - g.z) * sz < 0 ? -1 : 1; if ((side < 0 ? g.reloadP : g.reloadS) <= 0) volley(side); }

  // foes
  for (const f of g.foes) {
    if (!f.alive) continue;
    const K = FOE[f.kind], d = dist(f.x, f.z, g.x, g.z), angry = f.kind !== 'raft' || g.stance === 'hostile';
    const sight = K.sight * (g.ally && f.kind === 'raft' ? 1.5 : 1);
    f.chasing = angry && d < sight && (f.chasing || d < sight * 0.8);
    let tx: number, tz: number, sp: number = K.speed;
    if (f.chasing) { tx = g.x; tz = g.z; if (d < 4 && f.kind !== 'bishan') sp *= 0.5; }
    else if (f.path.length) { const p = f.path[f.leg]; tx = p[0]; tz = p[1]; sp *= 0.55; if (dist(f.x, f.z, tx, tz) < 1.5) f.leg = (f.leg + 1) % f.path.length; }
    else { tx = f.x; tz = f.z; sp = 0; }
    const l = dist(f.x, f.z, tx, tz);
    if (l > 0.05 && sp > 0) { f.h = Math.atan2(tx - f.x, tz - f.z); f.x += (tx - f.x) / l * sp * DT; f.z += (tz - f.z) / l * sp * DT; }
    pushOut(f, K.r);
    f.cool -= DT; f.bump = Math.max(0, f.bump - DT);
    if (f.chasing && f.cool <= 0 && d < 11) {
      f.cool = K.reload; const n = f.kind === 'bishan' ? [-0.18, 0, 0.18] : [0];
      for (const k of n) { const a = Math.atan2(g.x - f.x, g.z - f.z) + k + (rand(g) - 0.5) * 0.12; g.shots.push({ x: f.x, z: f.z, vx: Math.sin(a) * 10.5, vz: Math.cos(a) * 10.5, ttl: 1.25, mine: false, dmg: K.shot }); }
      g.events.push({ k: 'clam', x: f.x, z: f.z });
    }
    if (d < K.r + PLAYER_R + 0.15 && f.bump <= 0) {
      f.bump = 1.2; g.events.push({ k: 'bump' });
      if (g.ramT > 0) { f.hp -= H.ram; hurt(g, 5); g.ramT = 0; g.v *= 0.4; if (f.hp <= 0) sink(g, f); }
      else if (angry) hurt(g, K.bump);
      const k = d || 1; f.x += (f.x - g.x) / k * 1.2; f.z += (f.z - g.z) / k * 1.2;
    }
    if (g.phase !== 'sail') return;
  }

  // shots
  for (const s of g.shots) {
    s.x += s.vx * DT; s.z += s.vz * DT; s.ttl -= DT;
    if (s.mine) {
      for (const f of g.foes) if (f.alive && s.ttl > 0 && dist(s.x, s.z, f.x, f.z) < FOE[f.kind].r + 0.25) { s.ttl = 0; f.hp -= s.dmg; g.events.push({ k: 'hit', x: s.x, z: s.z, mine: true }); if (f.hp <= 0) sink(g, f); }
    } else if (s.ttl > 0 && dist(s.x, s.z, g.x, g.z) < PLAYER_R + 0.2) { s.ttl = 0; g.events.push({ k: 'hit', x: s.x, z: s.z, mine: false }); hurt(g, s.dmg); }
    if (g.phase !== 'sail') return;
  }
  g.shots = g.shots.filter(s => s.ttl > 0);
  g.foes = g.foes.filter(f => f.alive);

  // loot, discoveries, the kelong, docks
  for (const c of g.crates) if (dist(c.x, c.z, g.x, g.z) < 1.8) { g.seeds += c.seeds; g.events.push({ k: 'loot', seeds: c.seeds }); c.seeds = 0; }
  g.crates = g.crates.filter(c => c.seeds > 0);
  for (const i of ISLANDS) if (!g.found.includes(i.id) && dist(g.x, g.z, i.x, i.z) < i.r + 16) { g.found.push(i.id); g.events.push({ k: 'found', id: i.id }); }
  for (const e of ENCOUNTERS) {
    if (g.seen.includes(e.id) || dist(g.x, g.z, e.x, e.z) >= e.r) continue;
    if (e.id === 'bishan') { if (g.bishanDown || g.foes.some(f => f.kind === 'bishan')) continue; g.met = true; }
    g.seen.push(e.id); g.talkId = e.id; g.phase = 'talk'; g.v = 0; g.gear = 0; g.events.push({ k: 'talk' }); return;
  }
  g.nearDock = null;
  for (const d of DOCKS) if (dist(g.x, g.z, d.x, d.z) < 4.5) g.nearDock = d.id;
  if (g.nearDock && inp.act && g.v < 3) {
    const id = g.nearDock; g.lastDock = id; g.v = 0; g.gear = 0;
    if (id === 'ubin') { g.phase = 'won'; g.events.push({ k: 'won' }); return; }
    g.phase = 'dock'; g.dockId = id; g.events.push({ k: 'dock', id });
    if (ISLANDS.find(i => i.id === id)?.view) for (const i of ISLANDS) if (!g.found.includes(i.id)) g.found.push(i.id);
  }
}

// ---------- the result ----------
export type Medal = 'gold' | 'silver' | 'bronze';
export function result(g: Game) {
  const medal: Medal = g.hay >= 100 ? 'gold' : g.hay >= 70 ? 'silver' : 'bronze';
  const how = g.bishanDown ? 'You broke the otter toll for good.' : g.outcome === 'bargain' ? 'You paid the toll and kept the peace.' : g.bluffed ? 'You talked your way through.' : g.met ? 'You ran the blockade.' : 'You slipped past the kelong unseen.';
  return { medal, hay: Math.round(g.hay), time: g.t, sunk: g.sunk, capsizes: g.capsizes, how: how + (g.ally ? ' The macaques count you a friend.' : '') };
}

// ---------- the save: best medal and times only; a voyage is short enough to start again ----------
export interface SaveData { v: 1; hero: HeroId; best: Medal | null; bestTime: number | null; voyages: number }
export const freshSave = (): SaveData => ({ v: 1, hero: 'dora', best: null, bestTime: null, voyages: 0 });
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw); if (!s || s.v !== 1) return null;
    const medals = ['gold', 'silver', 'bronze'];
    return { v: 1, hero: s.hero === 'enzo' ? 'enzo' : 'dora', best: medals.includes(s.best) ? s.best : null, bestTime: typeof s.bestTime === 'number' && s.bestTime > 0 ? s.bestTime : null, voyages: Number.isInteger(s.voyages) && s.voyages >= 0 ? s.voyages : 0 };
  } catch { return null; }
}
const RANK = { gold: 3, silver: 2, bronze: 1 };
export function recordVoyage(s: SaveData, g: Game): SaveData {
  const r = result(g), better = !s.best || RANK[r.medal] > RANK[s.best] || (r.medal === s.best && (s.bestTime === null || r.time < s.bestTime));
  return { v: 1, hero: g.hero, best: better ? r.medal : s.best, bestTime: better ? r.time : s.bestTime, voyages: s.voyages + 1 };
}

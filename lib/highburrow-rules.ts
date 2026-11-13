// Highburrow: the state shape and the pure rules (yields, Warmth, growth, paths, sight). No DOM.
// Every number the UI shows comes from `preview()`, and end of turn applies the same numbers, so the
// tooltips and the turn summary can never disagree.
import {
  W, H, MAP, RIVERS, TERRAIN, BUILDS, INDOOR, GOODS, FOOD, NEIGHBOURS, NEIGHBOUR_IDS, UNIT_INFO, EAT, FESTIVAL, STORE_CAP,
  idx, inMap, neighbours, hexDist, ring, season,
  type Good, type BuildKind, type IndoorJob, type NeighbourId, type Terrain,
} from './highburrow-world.js';

export type Fur = 0 | 1 | 2;            // grey, beige, dark
export const FUR_NAME = ['grey', 'beige', 'dark'];
export interface Settler { id: number; fur: Fur; job: string }
export type Store = Record<Good, number>;
export interface Village {
  id: number; name: string; q: number; r: number; settlers: Settler[]; store: Store;
  warmth: number; happy: number; growth: number; queue: BuildKind[]; work: number; built: BuildKind[];
  hungry: number; aidCd: number; founded: number;
}
export type UnitKind = 'dora' | 'enzo' | 'settler' | 'caravan';
/** a standing caravan route: shuttle between two villages carrying these goods, every turn */
export interface Route { a: number; b: number; carry: Good[]; leg: 'a' | 'b' }
export interface Unit {
  id: number; kind: UnitKind; q: number; r: number; mp: number; path: [number, number][];
  fur?: Fur; cargo?: Store; rest?: boolean; act?: string; route?: Route;
}
export interface NState { met: boolean; fr: number; befriendT: number; found: boolean; quest: 'open' | 'done'; learned: boolean; traded: number[] }
export type ReportKind = 'good' | 'bad' | 'info' | 'frost' | 'event' | 'grow' | 'build' | 'aid' | 'friend' | 'season' | 'win' | 'route' | 'decision' | 'waste';
export interface ReportItem { kind: ReportKind; text: string; v?: number; unit?: number; n?: NeighbourId; q?: number; r?: number }
export interface State {
  v: 1; seed: number; rng: number; turn: number; assist: boolean;
  seen: number[]; trail: number[]; passes: boolean;
  villages: Village[]; units: Unit[]; nb: Record<NeighbourId, NState>;
  nextId: number; frost: boolean; rains: number; snowstorm: boolean;
  skills: string[]; report: ReportItem[]; notes: ReportItem[];
  decision: string | null; decided: string[]; snap: number; over: '' | 'won' | 'late'; wonTurn: number;
  stats: { aid: number; frosts: number; trades: number; built: number; born: number; coldTurns: number; hungryTurns: number; wasted?: number };
}

export const emptyStore = (): Store => ({ quinoa: 0, potatoes: 0, wool: 0, salt: 0, stone: 0, silver: 0, cloth: 0 });
export const terrainAt = (q: number, r: number): Terrain => MAP[idx(q, r)];
export const bandAt = (q: number, r: number) => TERRAIN[terrainAt(q, r)].band;
export const hearts = (fr: number) => Math.min(5, Math.floor(fr / 20));
export const HEART_NAME = ['Strangers', 'Met', 'Acquaintances', 'Friends', 'Good friends', 'Best friends'];
export const pop = (s: State) => s.villages.reduce((a, v) => a + v.settlers.length, 0)
  + s.units.filter(u => u.kind === 'settler').length;
export const tileJob = (q: number, r: number) => `t:${q},${r}`;
export function parseTile(job: string): [number, number] | null {
  if (!job.startsWith('t:')) return null;
  const [q, r] = job.slice(2).split(',').map(Number); return [q, r];
}
export const villageAt = (s: State, q: number, r: number) => s.villages.find(v => v.q === q && v.r === r);
export const campAt = (q: number, r: number) => NEIGHBOUR_IDS.find(n => NEIGHBOURS[n].q === q && NEIGHBOURS[n].r === r);
export const hasSkill = (s: State, id: string) => s.skills.includes(id);
export const isSummit = (v: Village) => bandAt(v.q, v.r) >= 4;
/** the summit village sets festival quinoa aside: it is not eaten */
export const reservedQuinoa = (v: Village) => (isSummit(v) ? FESTIVAL.quinoa ?? 0 : 0);

/** can a unit stand here */
export function walkable(s: State, q: number, r: number) {
  const t = terrainAt(q, r);
  if (t === 'pass') return s.passes;
  return TERRAIN[t].walk;
}
export function moveCost(s: State, q: number, r: number) {
  if (s.trail[idx(q, r)]) return 1;
  return TERRAIN[terrainAt(q, r)].cost;
}
export function maxMp(s: State, u: Unit) {
  return UNIT_INFO[u.kind].mp + (u.kind === 'dora' && hasSkill(s, 'passes') ? 2 : 0);
}

/** tiles a village may work: its six neighbours, if seen, workable and not a camp */
export function workTiles(s: State, v: Village): [number, number][] {
  return neighbours(v.q, v.r).filter(([q, r]) => s.seen[idx(q, r)] && TERRAIN[terrainAt(q, r)].work && !campAt(q, r)
    && (terrainAt(q, r) !== 'pass' || s.passes));
}

export interface Part { label: string; n: number }
export interface TileYield { good?: Good; n: number; warmth: number; parts: Part[] }
/** what one settler makes on a tile this turn (the village centre gets the same plus one, for free) */
export function tileYield(s: State, v: Village, q: number, r: number, centre = false, fx = frostFx(s)): TileYield {
  const t = TERRAIN[terrainAt(q, r)];
  const parts: Part[] = [];
  if (t.warmth) { parts.push({ label: t.job, n: t.warmth }); return { n: 0, warmth: t.warmth + (centre ? 1 : 0), parts }; }
  if (!t.good) return { n: 0, warmth: 0, parts };
  parts.push({ label: t.job, n: t.n! });
  if (centre) parts.push({ label: 'Village ground', n: 1 });
  const food = FOOD.includes(t.good);
  if (food && RIVERS.has(idx(q, r))) parts.push({ label: 'River water', n: 1 });
  if (t.good === 'wool' && s.skills.includes('alpacas')) parts.push({ label: 'Kept alpacas', n: 1 });
  if (food && season(s.turn) === 'wet' && t.band <= 2) parts.push({ label: 'Wet season', n: 1 });
  if (t.good === 'salt' && season(s.turn) === 'dry') parts.push({ label: 'Dry season', n: 1 });
  if (food && s.rains > 0) parts.push({ label: 'Good rains', n: 1 });
  if (food && fx.frost && bandAt(v.q, v.r) >= 2) parts.push({ label: 'Frost night', n: -1 });
  let n = parts.reduce((a, p) => a + p.n, 0);
  if (v.warmth <= 0) { parts.push({ label: 'Freezing: half work', n: -Math.ceil(n / 2) }); n -= Math.ceil(n / 2); }
  else if (v.warmth < 30) { parts.push({ label: 'Chilly: cold paws', n: -1 }); n -= 1; }
  return { good: t.good, n: Math.max(0, n), warmth: 0, parts };
}
/** is the frost tonight known to the player (lookout or Assist), and does it happen */
export function frostFx(s: State) { return { frost: s.frost, known: s.frost && frostKnown(s) }; }
export const frostKnown = (s: State) => s.assist || s.villages.some(v => v.built.includes('lookout'));
export const FROST_COLD = (s: State) => (s.assist ? 5 : 8);

export interface Preview {
  goods: Record<Good, { n: number; parts: Part[] }>;
  food: { make: number; eat: number; net: number; short: number };
  warmth: { delta: number; parts: Part[]; next: number };
  happy: { target: number; parts: Part[]; next: number };
  work: { n: number; parts: Part[] };
  growth: { n: number; parts: Part[]; need: number; blocked: string };
  weave: { weavers: number; wool: number; cloth: number; idle: number };
  spoil: number;
  /** what the storehouse cap throws away this turn */
  waste: Partial<Record<Good, number>>;
}
const cnt = (v: Village, job: string) => v.settlers.filter(x => x.job === job).length;

/** the full breakdown of a village's next end of turn. `real` includes an unannounced frost (used by endTurn). */
export function preview(s: State, v: Village, real = false): Preview {
  const fx = frostFx(s);
  const frost = real ? fx.frost : fx.known;
  const fxx = { frost, known: frost };
  const goods = Object.fromEntries(GOODS.map(g => [g, { n: 0, parts: [] as Part[] }])) as Preview['goods'];
  let tileWarm = 0;
  const add = (g: Good, n: number, label: string) => { goods[g].n += n; goods[g].parts.push({ label, n }); };
  const c = tileYield(s, v, v.q, v.r, true, fxx);
  if (c.good && c.n) add(c.good, c.n, 'Village ground');
  tileWarm += c.warmth;
  for (const st of v.settlers) {
    const t = parseTile(st.job); if (!t) continue;
    const y = tileYield(s, v, t[0], t[1], false, fxx);
    if (y.good && y.n) add(y.good, y.n, TERRAIN[terrainAt(t[0], t[1])].job);
    tileWarm += y.warmth;
  }
  // weaving
  const weavers = v.built.includes('loom') ? cnt(v, 'weaver') : 0;
  const per = hasSkill(s, 'weave') ? 2 : 1;
  const woolHave = v.store.wool + goods.wool.n;
  const working = Math.min(weavers, Math.floor(woolHave / 2));
  if (working) { add('wool', -2 * working, 'Weavers'); add('cloth', working * per, hasSkill(s, 'weave') ? 'Weavers (Fine weaving)' : 'Weavers'); }
  // food
  const make = FOOD.reduce((a, g) => a + goods[g].n, 0);
  const eat = v.settlers.length * EAT;
  const have = v.store.potatoes + Math.max(0, v.store.quinoa - reservedQuinoa(v)) + make;
  const short = Math.max(0, eat - have);
  // spoilage on a frost night
  let spoil = 0;
  if (frost) {
    if (hasSkill(s, 'chuno')) add('potatoes', 2, 'Chuño (frost freeze-dries)');
    else {
      const pot = v.store.potatoes + Math.max(0, goods.potatoes.n);
      spoil = Math.floor(pot * (s.assist ? 0.15 : 0.25) * (v.built.includes('granary') ? 0.5 : 1));
    }
  }
  // warmth
  const band = bandAt(v.q, v.r);
  const wp: Part[] = [{ label: 'Burrow hearths', n: 2 }, { label: `Altitude: ${['cloud forest', 'terraces', 'puna', 'scree', 'snow line'][band]}`, n: -[1, 2, 4, 6, 8][band] }];
  if (season(s.turn) === 'dry') wp.push({ label: 'Dry season nights', n: -2 });
  if (frost) wp.push({ label: 'Frost night', n: -FROST_COLD(s) });
  if (cnt(v, 'hearth')) wp.push({ label: `Hearth keepers ×${cnt(v, 'hearth')}`, n: 3 * cnt(v, 'hearth') });
  if (v.built.includes('kiln')) { wp.push({ label: 'Kiln', n: 2 }); if (cnt(v, 'kiln')) wp.push({ label: 'Kiln keeper', n: 3 }); }
  if (v.built.includes('bath')) { wp.push({ label: 'Hot spring bath', n: 4 }); if (cnt(v, 'bath')) wp.push({ label: 'Bath attendant', n: 2 }); }
  if (tileWarm) wp.push({ label: 'Hot spring', n: tileWarm });
  const delta = wp.reduce((a, p) => a + p.n, 0);
  const wnext = Math.max(0, Math.min(100, v.warmth + delta));
  // happiness drifts 10 a turn toward its target
  const hp: Part[] = [{ label: 'Settled in', n: 60 }];
  if (wnext >= 60) hp.push({ label: 'Cosy and warm', n: 10 });
  else if (wnext <= 0) hp.push({ label: 'Freezing', n: -30 });
  else if (wnext < 30) hp.push({ label: 'Chilly', n: -20 });
  if (short) hp.push({ label: 'Hungry', n: -25 });
  if (v.built.includes('bath')) { hp.push({ label: 'Hot spring bath', n: 10 }); if (cnt(v, 'bath')) hp.push({ label: 'Bath attendant', n: 5 }); }
  if (v.built.includes('lookout') && cnt(v, 'lookout')) hp.push({ label: 'Watcher', n: 5 });
  const friends = NEIGHBOUR_IDS.filter(n => hearts(s.nb[n].fr) >= 3).length;
  if (friends) hp.push({ label: `Friends nearby ×${friends}`, n: 3 * friends });
  const target = Math.max(0, Math.min(100, hp.reduce((a, p) => a + p.n, 0)));
  const hnext = v.happy + Math.max(-10, Math.min(10, target - v.happy));
  // build work
  const kp: Part[] = [{ label: 'Everyone helps', n: 1 }];
  if (cnt(v, 'builder')) kp.push({ label: `Builders ×${cnt(v, 'builder')}`, n: 3 * cnt(v, 'builder') });
  if (s.units.some(u => u.kind === 'enzo' && u.q === v.q && u.r === v.r)) kp.push({ label: 'Enzo is helping', n: 4 });
  // growth
  const need = 8 + Math.round(2.5 * v.settlers.length);
  const gp: Part[] = [];
  let blocked = '';
  const net = make - eat - spoil;
  if (short) blocked = 'Hungry';
  else if (wnext < 30) blocked = 'Too cold (needs 30 Warmth)';
  else if (hnext < 40) blocked = 'Unhappy (needs 40)';
  else if (v.settlers.length >= 9) blocked = 'Village is full (9)';
  else {
    if (net > 0) gp.push({ label: 'Spare food', n: Math.min(3, net) });
    if (hnext >= 70) gp.push({ label: 'Happy', n: 1 });
    if (v.built.includes('granary') && cnt(v, 'granary')) gp.push({ label: 'Granary keeper', n: 2 });
    if (!gp.length) blocked = 'No spare food';
  }
  // the storehouse cap: food is eaten first, then anything over the cap is wasted
  const waste: Partial<Record<Good, number>> = {};
  let eatLeft = eat;
  for (const g of GOODS) {
    let after = v.store[g] + goods[g].n;
    if (FOOD.includes(g)) { const t = Math.min(eatLeft, Math.max(0, after - (g === 'quinoa' ? reservedQuinoa(v) : 0))); after -= t; eatLeft -= t; if (g === 'potatoes') after -= spoil; }
    const over = after - storeCap(v, g) - (g === 'quinoa' ? reservedQuinoa(v) : 0);
    if (over > 0) waste[g] = over;
  }
  return {
    goods, food: { make, eat, net, short }, spoil, waste,
    warmth: { delta, parts: wp, next: wnext }, happy: { target, parts: hp, next: hnext },
    work: { n: kp.reduce((a, p) => a + p.n, 0), parts: kp },
    growth: { n: blocked ? 0 : gp.reduce((a, p) => a + p.n, 0), parts: gp, need, blocked },
    weave: { weavers, wool: 2 * working, cloth: working * per, idle: weavers - working },
  };
}

/** free slots for an indoor job in a village */
export function slotsFree(v: Village, job: IndoorJob) {
  const d = INDOOR[job];
  if (d.needs && !v.built.includes(d.needs)) return 0;
  return d.slots - cnt(v, job);
}
export function jobFree(s: State, v: Village, job: string, except?: Settler) {
  const t = parseTile(job);
  if (t) return workTiles(s, v).some(([q, r]) => q === t[0] && r === t[1]) && !v.settlers.some(x => x !== except && x.job === job);
  if (!(job in INDOOR)) return false;
  return slotsFree(v, job as IndoorJob) + (except && except.job === job ? 1 : 0) > 0;
}
const VALUE: Record<Good, number> = { quinoa: 1, potatoes: 1, wool: 0.8, salt: 0.7, stone: 0.8, silver: 1.6, cloth: 2 };
/** pick a sensible job for a settler: food when short, warmth when cold, else the richest free tile */
export function bestJob(s: State, v: Village, st?: Settler): string {
  const p = preview(s, v);
  const free = (j: string) => jobFree(s, v, j, st);
  const cold = p.warmth.next < 40 || (p.warmth.delta < 0 && v.warmth + p.warmth.delta * 3 < 40);
  if (cold && free('hearth')) return 'hearth';
  const tiles = workTiles(s, v).map(([q, r]) => ({ j: tileJob(q, r), y: tileYield(s, v, q, r) })).filter(t => free(t.j));
  const foodNet = p.food.net - (st && st.job ? 0 : 1);
  const score = (t: { y: TileYield }) => (t.y.good ? t.y.n * VALUE[t.y.good] * (FOOD.includes(t.y.good) && foodNet < 2 ? 2 : 1) : t.y.warmth * (cold ? 1.5 : 0.6));
  tiles.sort((a, b) => score(b) - score(a));
  if (tiles.length && score(tiles[0]) >= 1.5) return tiles[0].j;
  if (free('weaver') && v.store.wool >= 2) return 'weaver';
  if (v.queue.length) return 'builder';
  return tiles.length ? tiles[0].j : free('hearth') ? 'hearth' : 'builder';
}

/** cheapest path (A*-ish Dijkstra on half-step costs). Unseen tiles count as plain walkable ground. */
export function findPath(s: State, from: [number, number], to: [number, number]): [number, number][] | null {
  const ok = (q: number, r: number) => !s.seen[idx(q, r)] || walkable(s, q, r);
  if (!inMap(to[0], to[1]) || !ok(to[0], to[1])) return null;
  const cost = (q: number, r: number) => (s.seen[idx(q, r)] ? moveCost(s, q, r) : 2);
  const dist = new Map<number, number>(); const prev = new Map<number, number>();
  const start = idx(from[0], from[1]), goal = idx(to[0], to[1]);
  dist.set(start, 0);
  const open: [number, number][] = [[0, start]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, cur] = open.shift()!;
    if (cur === goal) break;
    if (d > (dist.get(cur) ?? 1e9)) continue;
    const q = cur % W, r = Math.floor(cur / W);
    for (const [nq, nr] of neighbours(q, r)) {
      if (!ok(nq, nr)) continue;
      const ni = idx(nq, nr), nd = d + cost(nq, nr);
      if (nd < (dist.get(ni) ?? 1e9)) { dist.set(ni, nd); prev.set(ni, cur); open.push([nd, ni]); }
    }
  }
  if (!dist.has(goal)) return null;
  const path: [number, number][] = [];
  for (let c = goal; c !== start; c = prev.get(c)!) path.unshift([c % W, Math.floor(c / W)]);
  return path;
}
export function pathCost(s: State, path: [number, number][]) { return path.reduce((a, [q, r]) => a + moveCost(s, q, r), 0); }

export function sightOf(s: State, u: Unit) { return UNIT_INFO[u.kind].sight; }
export function villageSight(v: Village) { return 2 + (v.built.includes('lookout') ? 1 : 0); }
/** reveal around a point; returns how many tiles were new */
export function reveal(s: State, q: number, r: number, rad: number) {
  let n = 0;
  for (const [a, b] of ring(q, r, rad)) if (!s.seen[idx(a, b)]) { s.seen[idx(a, b)] = 1; n++; }
  return n;
}
/** where a new village may go (and why not) */
export function foundProblem(s: State, q: number, r: number): string {
  const t = terrainAt(q, r);
  if (!TERRAIN[t].walk || t === 'pass') return 'Villages need solid ground.';
  if (campAt(q, r)) return 'Neighbours already live here.';
  if (s.villages.length >= 5) return 'The valley has room for 5 villages.';
  const near = s.villages.find(v => hexDist([v.q, v.r], [q, r]) < 3);
  if (near) return `Too close to ${near.name} (3 tiles apart at least).`;
  return '';
}
/** a rough score for a village site, for the advisor and the site hints */
export function siteScore(s: State, q: number, r: number) {
  if (foundProblem(s, q, r)) return -1;
  let sc = 0;
  for (const [a, b] of neighbours(q, r)) {
    const t = TERRAIN[terrainAt(a, b)];
    if (!t.work || campAt(a, b)) continue;
    if (t.good) sc += t.n! * VALUE[t.good] * (FOOD.includes(t.good) ? 1.3 : 1) + (RIVERS.has(idx(a, b)) && FOOD.includes(t.good) ? 1 : 0);
    if (t.warmth) sc += 3;
  }
  return sc - bandAt(q, r) * 0.8;
}
export const storeCap = (v: Village, g: Good) => (FOOD.includes(g) && v.built.includes('granary') ? STORE_CAP * 2 : STORE_CAP);
export const caravanLoad = (u: Unit) => GOODS.reduce((a, g) => a + (u.cargo?.[g] ?? 0), 0);

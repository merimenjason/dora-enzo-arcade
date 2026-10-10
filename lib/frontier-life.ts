/** Presentation-only settlement activity. Never changes resources, combat, saves or elapsed game time. */
import { Game, HOME, W, H, type BuildingId, type HeroId } from './frontier-game.js';
export type Point = { x: number; y: number };
export type Resident = { id: string; kind: 'worker' | 'hero' | 'idle'; coat: number; hero?: HeroId; x: number; y: number; face: number; frame: number; walking: boolean; working: boolean; carrying: boolean; resource?: 'hay' | 'wood' | 'stone'; building?: BuildingId; phase: number };
type Job = { id: number; kind: BuildingId; x: number; y: number; workers: number; damaged: boolean; route: Point[] };
const cached = new WeakMap<Game, { signature: string; jobs: Job[]; patrols: Point[][] }>();
const key = (x: number, y: number) => y * W + x;
/** Shortest route over revealed, held tiles only. Blocked dens and sheer crags never become paths. */
export function settlementRoute(g: Game, target: Point): Point[] {
  if (!g.held(target.x, target.y)) return [];
  const queue: Point[] = [{ ...HOME }], parents = new Map<number, Point | null>([[key(HOME.x, HOME.y), null]]);
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    if (at.x === target.x && at.y === target.y) {
      const route: Point[] = []; let p: Point | null = at;
      while (p) { route.push(p); p = parents.get(key(p.x, p.y)) ?? null; } return route.reverse();
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const x = at.x + dx, y = at.y + dy, k = key(x, y);
      if (x < 0 || y < 0 || x >= W || y >= H || parents.has(k) || !g.held(x, y)) continue;
      parents.set(k, at); queue.push({ x, y });
    }
  }
  return [];
}
function layout(g: Game) {
  const signature = g.tiles.map(t => `${+t.seen}${t.t === 'crag' ? 'c' : ''}${t.f === 'den' || t.f === 'lair' ? 'd' : ''}`).join('') + g.buildings.map(b => `${b.id}:${b.kind}:${b.x},${b.y}:${b.workers}:${+b.damaged}`).join('|');
  const previous = cached.get(g); if (previous?.signature === signature) return previous;
  const jobs = g.buildings.filter(b => b.workers > 0).map(b => ({ ...b, route: settlementRoute(g, b) }));
  const choices: Point[] = [];
  for (let y = HOME.y - 2; y <= HOME.y + 2; y++) for (let x = HOME.x - 2; x <= HOME.x + 2; x++) if ((x !== HOME.x || y !== HOME.y) && g.held(x, y)) choices.push({ x, y });
  choices.sort((a, b) => (g.buildingAt(b.x, b.y)?.kind === 'tower' ? 10 : 0) - (g.buildingAt(a.x, a.y)?.kind === 'tower' ? 10 : 0) || Math.abs(b.x - HOME.x) + Math.abs(b.y - HOME.y) - Math.abs(a.x - HOME.x) - Math.abs(a.y - HOME.y));
  const patrols = [0, 1].map(i => settlementRoute(g, choices[i ? Math.floor(choices.length / 2) : 0] ?? HOME));
  const next = { signature, jobs, patrols }; cached.set(g, next); return next;
}
function along(route: Point[], progress: number) {
  const n = Math.max(0, route.length - 1), value = Math.max(0, Math.min(1, progress)) * n, index = Math.min(Math.floor(value), Math.max(0, n - 1));
  const a = route[index] ?? HOME, b = route[index + 1] ?? a, f = value - index;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, face: b.x < a.x ? -1 : 1 };
}
export function settlementAt(g: Game, time: number, motion = true): Resident[] {
  const { jobs, patrols } = layout(g), actors: Resident[] = [];
  for (const job of jobs) for (let i = 0; i < job.workers; i++) {
    const productive = !job.damaged && g.output(g.buildings.find(b => b.id === job.id)!) > 0;
    const travel = Math.max(3, (job.route.length - 1) * 2.2), cycle = travel * 2 + 7, phase = motion ? (time + job.id * 2.7 + i * cycle / 2) % cycle : travel + 1;
    let point = { x: job.x, y: job.y, face: 1 }, walking = false, carrying = false, working = false;
    if (motion && productive && job.route.length > 1) {
      if (phase < travel) { point = along(job.route, phase / travel); walking = true; }
      else if (phase < travel + 5) working = true;
      else if (phase < travel * 2 + 5) { point = along(job.route, 1 - (phase - travel - 5) / travel); point.face *= -1; walking = true; carrying = true; }
    } else working = productive;
    actors.push({ id: `worker-${job.id}-${i}`, kind: 'worker', coat: (job.id * 2 + i) % 4, ...point, frame: motion && walking ? Math.floor(time * 7 + i) % 4 : 0, walking, working: working && motion, carrying, resource: job.kind === 'farm' ? 'hay' : job.kind === 'lodge' ? 'wood' : job.kind === 'quarry' ? 'stone' : undefined, building: job.kind, phase: motion ? time * 5 + i + job.id : 0 });
  }
  for (const [i, hero] of g.heroes.filter(h => h.id === 'dora' || h.id === 'enzo').entries()) {
    const route = patrols[i % 2], moving = motion && hero.hurt <= 0 && route.length > 1, phase = motion ? (time + i * 7) % 22 : 0;
    const point = moving ? along(route, phase < 9 ? phase / 9 : phase < 11 ? 1 : phase < 20 ? 1 - (phase - 11) / 9 : 0) : { ...HOME, face: 1 };
    if (phase > 11 && phase < 20) point.face *= -1;
    actors.push({ id: hero.id, kind: 'hero', coat: 0, hero: hero.id, ...point, frame: moving ? Math.floor(time * 6) % 4 : 0, walking: moving && (phase < 9 || phase > 11 && phase < 20), working: false, carrying: false, phase: motion ? time * 4 + i : 0 });
  }
  for (let i = 0; i < Math.min(6, g.idle); i++) actors.push({ id: `idle-${i}`, kind: 'idle', coat: (i + 2) % 4, ...HOME, x: HOME.x + (i % 3 - 1) * .22, y: HOME.y + Math.floor(i / 3) * .15, face: i % 2 ? -1 : 1, frame: 0, walking: false, working: false, carrying: false, phase: motion ? time * 2 + i : 0 });
  return actors;
}
/** Unique footpath segments used by the workers' real routes. */
export function settlementPaths(g: Game): [Point, Point][] {
  const result: [Point, Point][] = [], used = new Set<string>();
  for (const { route } of layout(g).jobs) for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], edge = [key(a.x, a.y), key(b.x, b.y)].sort((x, y) => x - y).join(':');
    if (!used.has(edge)) { used.add(edge); result.push([a, b]); }
  }
  return result;
}

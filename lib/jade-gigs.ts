// Jade Street: side gigs, repeatable jobs between the story ones, each built as a small mission for the same runner.
// Delivery runs start at every open market, taxi fares at every safe house, street and rooftop races at the garage
// and the ladders, cooking at Chef Mo's wok and dumpling folding on Canal Row. Destinations are drawn from the night's
// seed so a gig is never the same twice in a row.
import { T, W, S, G, districtAt, DISTRICT_NAME, type District } from './jade-city.js';
import { rng, hashStr, dist } from './jade-rng.js';
import type { World, Near } from './jade-game.js';
import type { Mission, Step } from './jade-story.js';
import { safeOpen } from './jade-save.js';

export type GigDef = { id: string; title: string; at: [number, number] | string; d: District; giver: string; kind: string };
export const GIG_DEFS: GigDef[] = [
  { id: 'delivery-market', title: 'Delivery run', at: [20, 62], d: 'market', giver: 'kee', kind: 'delivery' },
  { id: 'delivery-temple', title: 'Delivery run', at: [34, 25], d: 'temple', giver: 'pang', kind: 'delivery' },
  { id: 'delivery-canal', title: 'Delivery run', at: [57, 40], d: 'canal', giver: 'lim', kind: 'delivery' },
  { id: 'delivery-docks', title: 'Delivery run', at: [88, 81], d: 'docks', giver: 'bo', kind: 'delivery' },
  { id: 'delivery-arcade', title: 'Delivery run', at: [117, 42], d: 'arcade', giver: 'gizmo', kind: 'delivery' },
  { id: 'taxi-market', title: 'Taxi fares', at: [4, 61], d: 'market', giver: 'kee', kind: 'taxi' },
  { id: 'taxi-docks', title: 'Taxi fares', at: [58, 81], d: 'docks', giver: 'bo', kind: 'taxi' },
  { id: 'race-street', title: 'Street race', at: [35, 41], d: 'market', giver: 'mo', kind: 'race' },
  { id: 'roof-market', title: 'Rooftop run', at: [8, 80], d: 'market', giver: 'mo', kind: 'roof-market' },
  { id: 'roof-arcade', title: 'Rooftop run', at: [92, 45], d: 'arcade', giver: 'gizmo', kind: 'roof-arcade' },
  { id: 'cook', title: 'Wok shift', at: 'wok-stall', d: 'market', giver: 'mo', kind: 'cook' },
  { id: 'dumplings', title: 'Dumpling shift', at: [50, 38], d: 'canal', giver: 'lim', kind: 'dumpling' },
  { id: 'locks', title: 'Crate cracking', at: [96, 64], d: 'docks', giver: 'bo', kind: 'locks' },
];
const where = (w: World, at: GigDef['at']): [number, number] => typeof at === 'string' ? [w.c.places[at].x, w.c.places[at].y] : [at[0] * T + T / 2, at[1] * T + T / 2];

/** gigs on offer: their district must be open (story job not running); the story's first chapter must be under way */
export function gigBoards(w: World): Near[] {
  if (!w.s.done.includes('m1')) return [];
  return GIG_DEFS.filter(g => w.open.has(g.d) && (g.kind !== 'taxi' || safeOpen(w.s, g.kind === 'taxi' && g.d === 'docks' ? 'safe-docks' : 'safe-market') || g.d === 'market'))
    .map(g => { const [x, y] = where(w, g.at); return { kind: 'gig' as const, label: `Side gig: ${g.title}`, x, y, id: g.id }; });
}

/** a spot near a road a ride can reach, in an open district, between `lo` and `hi` tiles away */
function dropSpot(w: World, R: () => number, x: number, y: number, lo: number, hi: number): [number, number] {
  for (let k = 0; k < 400; k++) {
    const a = R() * Math.PI * 2, d = (lo + R() * (hi - lo)) * T;
    const tx = Math.floor((x + Math.cos(a) * d) / T), ty = Math.floor((y + Math.sin(a) * d) / T);
    if (tx < 1 || ty < 1 || tx > 118 || ty > 90) continue;
    const i = ty * W + tx;
    if (w.c.solid[i] !== S.OPEN || w.c.ground[i] === G.ROAD || !w.open.has(districtAt(tx, ty))) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.c.ground[(ty + dy) * W + tx + dx] === G.ROAD)) continue;
    return [tx, ty];
  }
  return [Math.floor(x / T), Math.floor(y / T)];
}

export function gigMission(w: World, id: string): { m: Mission; reward: number; d: District } | null {
  const g = GIG_DEFS.find(x => x.id === id); if (!g) return null;
  const n = (w.s.best['gigs:' + id] ?? 0) + 1;
  const R = rng(hashStr(`${w.s.seed}:${id}:${w.s.night}:${n}`));
  const [x, y] = where(w, g.at);
  let steps: Step[] = []; let reward = 40;
  const home: [number, number] = [Math.floor(x / T), Math.floor(y / T)];
  switch (g.kind) {
    case 'delivery': {
      const to = dropSpot(w, R, x, y, 14, 26);
      const d = dist(to[0], to[1], home[0], home[1]);
      steps = [{ t: 'pickup', at: home, item: 'parcel', label: 'Pick up the parcel' }, { t: 'deliver', to, time: Math.round(d * 1.15 + 16), item: 'parcel', label: `Deliver the parcel in ${DISTRICT_NAME[districtAt(to[0], to[1])]}` }];
      reward = 30 + Math.round(d * 2.2); break;
    }
    case 'taxi': steps = [{ t: 'ride', kind: 'tuktuk', near: home, label: 'Get in the tuk-tuk' }, { t: 'fares', n: 2, label: 'Drive two fares' }]; reward = 50; break;
    case 'race': steps = [{ t: 'ride', kind: 'scooter', near: home, label: 'Get on a scooter' }, { t: 'race', ride: 'scooter', rival: 'scooter', marks: [[28, 32], [28, 64], [12, 64], [12, 48], [44, 48], [44, 32], [35, 32]], label: 'Win the street race' }]; reward = 90; break;
    case 'roof-market': steps = [{ t: 'race', ride: 'foot', roof: true, time: 45, marks: [[6, 80], [2, 79], [2, 75], [6, 75], [6, 71], [2, 71], [2, 67], [6, 67]], label: 'Climb the ladder and hop across every roof marker' }]; reward = 70; break;
    case 'roof-arcade': steps = [{ t: 'race', ride: 'foot', roof: true, time: 50, marks: [[95, 43], [95, 39], [99, 39], [99, 35], [103, 35], [103, 39], [103, 43]], label: 'Climb the ladder and hop across every roof marker' }]; reward = 80; break;
    case 'cook': steps = [{ t: 'mini', kind: 'wok', level: 2, label: 'Cook the orders' }]; reward = 45; break;
    case 'dumpling': steps = [{ t: 'mini', kind: 'dumpling', level: 2, label: 'Fold the dumplings' }]; reward = 45; break;
    case 'locks': steps = [{ t: 'mini', kind: 'lock', level: 2, label: 'Crack the crate lock' }]; reward = 60; break;
  }
  return { m: { id: 'gig-' + id, ch: 0, title: g.title, giver: g.giver, at: '', blurb: '', reward, rep: 2, steps }, reward, d: g.d };
}
export function startGig(w: World, id: string) {
  const r = gigMission(w, id); if (!r) return;
  w.s.best['gigs:' + id] = (w.s.best['gigs:' + id] ?? 0) + 1;
  w.startMission(r.m, { key: 'gig:' + id, reward: r.reward, d: r.d });
}

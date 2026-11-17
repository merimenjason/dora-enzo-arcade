// Jade Street (twelfth pass): the small pleasures over the Geylang River. A bowl of laksa at 328 Katong Laksa or the
// East Coast Lagoon hawker centre, a bauble hung on an Orchard Road Christmas tree (while the light-up is on: in
// season by the device calendar, and all through chapter eight), a kite flown on the East Coast beach, the planes coming
// in over Changi waved at from the viewing spots, and a hand with a traveller's suitcase at the terminal. Each has its
// own animation, and none needs a job. The hired bikes are ordinary rides (lib/jade-move.ts). No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import { isChristmas } from './jade-calendar.js';
import type { World, Near } from './jade-game.js';

export const LAKSA = 4;
/** a plane crosses Changi's sky every this many seconds (world time), taking `PLANE_FLY` to cross */
export const PLANE_EVERY = 24, PLANE_FLY = 9;
export type FarState = { night: number; baubles: Set<number>; once: Set<string> };
export const newFar = (): FarState => ({ night: -1, baubles: new Set(), once: new Set() });

/** is the Orchard Road light-up on: in season, or while chapter eight's story is still being played */
export const lightUp = (w: World) => (w.today ? isChristmas(w.today) : true) || (w.s.done.includes('m45') && !w.s.done.includes('m55'));
/** the plane overhead now (world units, heading), or null between planes */
/** seconds until the next plane comes in (0 while one is overhead): the prompt counts it down (pass 13) */
export const planeIn = (w: World) => { const ph = w.time % PLANE_EVERY; return ph <= PLANE_FLY ? 0 : PLANE_EVERY - ph; };
export function planeNow(w: World): { x: number; y: number; h: number; k: number } | null {
  const F = w.c.far; if (!F) return null;
  const ph = w.time % PLANE_EVERY; if (ph > PLANE_FLY) return null;
  const k = ph / PLANE_FLY, lane = Math.floor(w.time / PLANE_EVERY) % 2;
  // in over the sea from the south-east, down to the runway
  const x0 = 380 * T, y0 = (lane ? 60 : 96) * T, x1 = 362 * T, y1 = (lane ? 10 : 24) * T;
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, h: Math.atan2(y1 - y0, x1 - x0), k };
}
const open = (w: World, x: number, y: number) => w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)));
export function farStep(w: World) {
  const f = w.far; if (f.night !== w.s.night) { f.night = w.s.night; f.baubles.clear(); f.once.clear(); }
}
export function farNear(w: World, cand: (n: Near, r: number) => void) {
  const F = w.c.far, f = w.far; if (!F || w.p.ride) return;
  for (const id of ['laksa', 'hawker-ecp']) { const pl = w.c.places[id]; if (pl && open(w, pl.x, pl.y)) cand({ kind: 'far', id: 'laksa', label: `Slurp a bowl of laksa (${LAKSA} coins)`, x: pl.x, y: pl.y + 30 }, 70); }
  if (lightUp(w)) F.trees.forEach(([x, y], i) => { if (!f.baubles.has(i) && open(w, x, y)) cand({ kind: 'far', id: 'bauble:' + i, label: 'Hang a bauble on the Christmas tree', x, y: y + 30 }, 70); });
  for (const [x, y] of F.kites) if (open(w, x, y) && !f.once.has(`kite:${x}`)) cand({ kind: 'far', id: `kite:${x}`, label: 'Fly a kite', x, y }, 70);
  for (const [x, y] of F.spots) if (open(w, x, y)) cand({ kind: 'far', id: 'plane', label: planeNow(w) ? 'Wave at the plane coming in!' : `Watch for planes (next in ${Math.ceil(planeIn(w))} s)`, x, y }, 64);
  const t = w.c.places.terminal; if (t && open(w, t.x, t.y) && !f.once.has('suitcase')) cand({ kind: 'far', id: 'suitcase', label: 'Help a traveller with her suitcase', x: t.x, y: t.y + 20 }, 70);
}
export function farAct(w: World, id: string) {
  const p = w.p, f = w.far, s = w.s; p.face = 'down';
  if (id === 'laksa') {
    if (s.cash < LAKSA) { w.say(`A bowl of laksa is ${LAKSA} coins.`, 'bad'); return; }
    s.cash -= LAKSA; w.fx.push({ t: 'eat' });
    p.act = { n: 'laksa', t: 0, dur: 2, then: () => { s.stats.laksa++; w.say('Coconut, chilli, cockles. Shiok!', 'good'); } };
    return;
  }
  if (id.startsWith('bauble:')) {
    const i = +id.slice(7); p.face = 'up';
    p.act = { n: 'bauble', t: 0, dur: 1.4, then: () => {
      f.baubles.add(i); s.stats.baubles++; addRep(s, 'orchard', 1); w.fx.push({ t: 'good-deed' });
      const n = w.c.far!.trees.length; w.say(f.baubles.size === n ? 'Every tree on Orchard Road dressed. Merry Christmas!' : `Bauble hung (${f.baubles.size} of ${n}). Merry Christmas!`, 'good');
      if (f.baubles.size === n && !f.once.has('all-trees')) { f.once.add('all-trees'); s.cash += 15; w.banner = { text: 'Merry Christmas!', sub: 'Every tree dressed · +15 coins', t: 2.6 }; }
    } };
    return;
  }
  if (id.startsWith('kite:')) {
    f.once.add(id); p.face = 'up';
    p.act = { n: 'kite', t: 0, dur: 3, then: () => { s.stats.kites++; w.say('Up, up, up! The sea breeze takes it right over the casuarinas.', 'good'); } };
    return;
  }
  if (id === 'plane') {
    const pl = planeNow(w); p.face = 'up';
    p.act = { n: 'plane', t: 0, dur: 1.6, then: () => { if (pl) { s.stats.planes++; w.say(`Plane spotted! (${s.stats.planes} so far)`, 'good'); } else w.say(`Nothing yet. The next one comes in about ${Math.ceil(planeIn(w))} s.`, ''); } };
    return;
  }
  if (id === 'suitcase') {
    f.once.add('suitcase'); addRep(s, 'changi', 1);
    p.act = { n: 'suitcase', t: 0, dur: 2.2, then: () => { w.fx.push({ t: 'good-deed' }); w.say('The traveller says thank you in three languages. Safe flight!', 'good'); } };
  }
}

// Jade Street (twenty-fifth pass): Punggol and Coney Island's small pleasures, out of a job. Cast a line off the end of
// Punggol Point Jetty (its own two-frame animation: casting, then the rod bending as something bites) and look out from
// the Promenade across the water at Pulau Ubin's kampong lights (the look-out pose). Each counts towards a trophy (the
// fish) and the first of each a night is a little Punggol reputation. No DOM; deterministic: the catch goes round a list.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type PunggolState = { night: number; once: Set<string>; told: boolean; fish: number; views: number };
export const newPunggol = (): PunggolState => ({ night: -1, once: new Set(), told: false, fish: 0, views: 0 });
/** what bites off the jetty, in turn (everything goes back in) */
export const CATCH = ['a silver whiting, flapping', 'a little grouper, cross about it', 'a sea bass as long as your arm', 'an old boot, which you put in the bin',
  'a squid, which squirts you and is off', 'a pomfret, flat as a plate', 'a mangrove jack, red as a lantern'];
/** what you see across the water from the Promenade, in turn */
export const VIEW_SIGHTS = ['the lights of Pulau Ubin’s kampong houses, one by one along the shore', 'a bumboat putting across to Ubin, its lamp swinging',
  'a heron flying low over the water, slow as a kite', 'the long bridge to Coney Island, and cattle asleep at the end of it', 'the moon’s road on the water, all the way to Johor'];
/** how long a cast takes (seconds: casting, then the bite) */
export const FISH_S = 2.6;

const onPunggol = (w: World) => !!w.c.punggol && w.open.has('punggol');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'punggol';

export function punggolStep(w: World, dt: number) {
  const k = w.punggol; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); }
  if (!onPunggol(w) || w.run || !here(w, w.p.x, w.p.y)) return;
  if (!k.told) { k.told = true; w.say('Punggol and Coney Island! Fish off the end of Punggol Point Jetty (E), look across at Pulau Ubin from the Promenade (E), and ride the red park connectors.', 'good'); }
}
export function punggolNear(w: World, cand: (n: Near, r: number) => void) {
  const K = w.c.punggol; if (!K || !onPunggol(w) || w.p.ride || w.run) return;
  cand({ kind: 'punggol', id: 'fish', label: 'Cast a line off the jetty', x: K.jetty[0], y: K.jetty[1] }, 80);
  cand({ kind: 'punggol', id: 'view', label: 'Look across the water at Pulau Ubin', x: K.lookout[0], y: K.lookout[1] }, 80);
}
export function punggolAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.punggol; p.b.speed = 0;
  const rep = (what: string) => { if (!k.once.has(what)) { k.once.add(what); addRep(s, 'punggol', 1); } };
  if (id === 'fish') {
    p.face = 'up';
    p.act = { n: 'fish', t: 0, dur: FISH_S, then: () => {
      s.stats.fishes++; rep('fish');
      const f = CATCH[k.fish % CATCH.length]; k.fish++;
      w.say(s.stats.fishes === 1 ? `A tug! Up comes ${f}. You let it go again.` : `Up comes ${f} (${s.stats.fishes} so far). Back it goes.`, 'good');
    } };
    return;
  }
  if (id === 'view') {
    p.face = 'up';
    p.act = { n: 'lookout', t: 0, dur: 2.2, then: () => {
      rep('view');
      const v = VIEW_SIGHTS[k.views % VIEW_SIGHTS.length]; k.views++;
      w.say(`From the Promenade: ${v}.`, 'good');
    } };
  }
}

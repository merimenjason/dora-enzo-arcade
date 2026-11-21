// Jade Street (nineteenth pass): Mandai's small pleasures, all after dark. Ride the Night Safari tram from its stop (sat
// in the open carriage, holding the rail: its own animation) and see what its torch picks out; hold out a nectar cup at
// Bird Paradise's lory perch (arm out, a lorikeet landing on it: its own animation); and watch Dr Bintu's Creatures of
// the Night show from the amphitheatre (clapping: its own animation). Each counts towards a trophy and the first of each
// a night is a little Mandai reputation. No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type MandaiState = { night: number; once: Set<string>; told: boolean; sights: number; acts: number; tramT: number };
export const newMandai = (): MandaiState => ({ night: -1, once: new Set(), told: false, sights: 0, acts: 0, tramT: -99 });
/** what the tram's torch picks out on the loop, in turn */
export const SIGHTS = ['a Malayan tapir, white saddle glowing in the torchlight, chewing very slowly', 'a herd of sambar deer standing perfectly still, every eye shining',
  'an Asian elephant at the waterhole, flapping an ear at the tram', 'a pair of striped hyenas trotting along the fence, giggling',
  'a Malayan tiger asleep on a rock, one paw hanging over the edge', 'a family of otters squeaking along the stream bank'];
/** the Creatures of the Night show's acts, in turn */
export const ACTS = ['a binturong climbing the rope with its tail, smelling faintly of popcorn', 'a barn owl swooping silently over the front row',
  'an otter sorting the recycling into the right bins', 'a palm civet strolling along the stage beam'];
/** how long a tram ride takes round the loop (the scene's tram runs round with you on board) */
export const TRAM_S = 5;

const onMandai = (w: World) => !!w.c.mandai && w.open.has('mandai');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'mandai';

export function mandaiStep(w: World, dt: number) {
  const k = w.mandai; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); }
  if (!onMandai(w) || w.run || !here(w, w.p.x, w.p.y)) return;
  if (!k.told) { k.told = true; w.say('Night at Mandai! Ride the Night Safari tram from its stop (E), feed the lories at Bird Paradise (E), or watch the Creatures of the Night show (E).', 'good'); }
}
export function mandaiNear(w: World, cand: (n: Near, r: number) => void) {
  const M = w.c.mandai; if (!M || !onMandai(w) || w.p.ride) return;
  const [sx, sy] = M.stops[0];
  cand({ kind: 'mandai', id: 'tram', label: 'Ride the Night Safari tram', x: sx, y: sy }, 90);
  cand({ kind: 'mandai', id: 'lory', label: 'Feed the lories', x: M.perch[0], y: M.perch[1] }, 80);
  cand({ kind: 'mandai', id: 'show', label: 'Watch the Creatures of the Night show', x: M.stage[0], y: M.stage[1] }, 80);
}
export function mandaiAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.mandai; p.face = 'down'; p.b.speed = 0;
  const rep = (what: string) => { if (!k.once.has(what)) { k.once.add(what); addRep(s, 'mandai', 1); } };
  if (id === 'tram') {
    k.tramT = w.time;
    p.act = { n: 'tram', t: 0, dur: TRAM_S, then: () => {
      s.stats.trams++; rep('tram');
      const sight = SIGHTS[k.sights % SIGHTS.length]; k.sights++;
      w.say(`Round the loop on the Night Safari tram. In the torchlight: ${sight}.`, 'good');
    } };
    return;
  }
  if (id === 'lory') {
    p.act = { n: 'lory', t: 0, dur: 2.2, then: () => {
      s.stats.lories++; rep('lory');
      w.say(s.stats.lories === 1 ? 'You hold out the nectar cup and a rainbow lorikeet lands on your arm, slurping noisily.' : `Another lorikeet breakfast (${s.stats.lories} so far). They’re not fussy about whose arm.`, 'good');
    } };
    return;
  }
  if (id === 'show') {
    p.act = { n: 'clap', t: 0, dur: 2.6, then: () => {
      s.stats.shows++; rep('show');
      const act = ACTS[k.acts % ACTS.length]; k.acts++;
      w.say(`The Creatures of the Night show: ${act}. Applause!`, 'good');
    } };
  }
}

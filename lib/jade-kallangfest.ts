// Jade Street (eighteenth pass): Kallang's small pleasures. Start the Kallang Wave at the fan zone (crouch low, then up
// with both arms, and the fans round the stage go up after you, one after another: its own two-part animation), and
// stand on the Old Kallang Airport's apron looking up at whatever is flying over (head back, a paw shading the eyes,
// then pointing: its own animation). Each counts towards a trophy and the first of each a night is a little Kallang
// reputation. No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type KallangState = { night: number; once: Set<string>; told: boolean; skies: number; waveT: number };
export const newKallang = (): KallangState => ({ night: -1, once: new Set(), told: false, skies: 0, waveT: -99 });
/** what goes over the old airport, in turn (the black seaplane only until it has flown south, at the end of chapter eleven) */
export const SKIES = ['a Singapore Airlines jet sliding down towards Changi, wheels already out', 'a pair of RSAF F-16s rehearsing for the National Day flypast',
  'a Chinook with the state flag, practising for the parade', 'a little white Cessna, buzzing round the Kallang Basin like it is 1937 again',
  'a flock of Asian koels, very loud, very pleased with themselves'];
/** how long the wave takes to run round the fans at the fan zone (the scene's `kal-wave` effect) */
export const WAVE_S = 2.4;

const onKallang = (w: World) => !!w.c.kallang && w.open.has('kallang');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'kallang';

export function kallangStep(w: World, dt: number) {
  const k = w.kallang; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); }
  if (!onKallang(w) || w.run || !here(w, w.p.x, w.p.y)) return;
  if (!k.told) { k.told = true; w.say('Match night in Kallang! Start the Kallang Wave at the fan zone (E), or look up from the old airport’s apron (E).', 'good'); }
}
export function kallangNear(w: World, cand: (n: Near, r: number) => void) {
  const K = w.c.kallang; if (!K || !onKallang(w) || w.p.ride) return;
  cand({ kind: 'kallang', id: 'wave', label: 'Start the Kallang Wave', x: K.wave[0], y: K.wave[1] }, 90);
  cand({ kind: 'kallang', id: 'sky', label: 'Look up from the old apron', x: K.tower[0], y: K.tower[1] + 24 }, 80);
}
export function kallangAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.kallang; p.face = 'down'; p.b.speed = 0;
  if (id === 'wave') {
    k.waveT = w.time + 0.7; // the fans go up after you as you spring up
    p.act = { n: 'kwave', t: 0, dur: 1.4, then: () => {
      s.stats.waves++; w.fx.push({ t: 'kal-wave', x: p.x, y: p.y });
      if (!k.once.has('wave')) { k.once.add('wave'); addRep(s, 'kallang', 1); }
      w.say(s.stats.waves === 1 ? 'Up go your arms, and round it goes: the whole fan zone rises after you, row by row. The Kallang Wave!' : `The wave goes round the fan zone again (${s.stats.waves} so far)`, 'good');
    } };
    return;
  }
  if (id === 'sky') {
    p.act = { n: 'skyward', t: 0, dur: 2.6, then: () => {
      s.stats.skies++;
      const seaplane = !s.done.includes('m85') && s.done.includes('m76') && k.skies % 3 === 0;
      const sight = seaplane ? 'the black seaplane, rocking at its mooring off the old slipway. Nobody booked it in.' : SKIES[k.skies % SKIES.length];
      k.skies++;
      if (!k.once.has('sky')) { k.once.add('sky'); addRep(s, 'kallang', 1); }
      w.say(`From the old airport’s apron: ${sight}`, 'good');
    } };
  }
}

// Jade Street (twenty-second pass): Bukit Timah's small pleasures, out of a job. The Bukit Bunch sit about the trail and
// the Rail Corridor (lib/jade-bukit.ts haunts): walk past one and the macaque snatches your snack out of your hands (its
// own animation); shoo it off, arms wide and big, and it drops the bag (its own animation: never feed them, says the
// ranger). Read a pressed specimen sheet at the old herbarium through a magnifier (its own animation), sit on a rest
// shelter's log with a water bottle (its own animation), and touch the summit marker on Bukit Timah Hill (arms up: its
// own animation). Each counts towards a trophy and the first of each a night is a little Bukit Timah reputation. No DOM;
// deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import { dist } from './jade-rng.js';
import type { World, Near } from './jade-game.js';

export type BukitState = { night: number; once: Set<string>; told: boolean; reads: number;
  /** the haunt whose macaque has your snack (-1: none), and the haunts already visited (snatched or shooed) tonight */
  snatched: number; done: Set<number>; scareT: number };
export const newBukit = (): BukitState => ({ night: -1, once: new Set(), told: false, reads: 0, snatched: -1, done: new Set(), scareT: -99 });
/** what each specimen sheet in the herbarium's drawers is, in turn */
export const SHEETS = ['a pressed tembusu leaf, collected on the hill in 1890, the ink gone brown', 'a slipper orchid with a label in three hands',
  'a fern frond as long as your arm, from the quarry’s edge', 'a seed pod of the giant pitcher plant, from the summit in 1924',
  'a jelutong leaf, its veins like a map of the Rail Corridor', 'a sprig of the Bukit Timah begonia, found here and nowhere else'];
/** how near a haunt sets its macaque on you */
export const SNATCH_R = 70;

const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'bukit';
const onBukit = (w: World) => !!w.c.bukit && w.open.has('bukit');

export function bukitStep(w: World, dt: number) {
  const k = w.bukit; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); k.done.clear(); k.snatched = -1; }
  const B = w.c.bukit, p = w.p;
  if (!B || !onBukit(w) || w.run || p.ride || !here(w, p.x, p.y)) return;
  if (!k.told) { k.told = true; w.say('Bukit Timah! Read a specimen at the old herbarium (E), rest on a trail shelter’s log (E), touch the summit marker (E). And hold on to your snacks: the macaques are watching.', 'good'); }
  // walking past a macaque's haunt: it snatches your snack (once a haunt a night)
  if (k.snatched < 0 && !p.act && !p.air) B.haunts.forEach(([hx, hy], i) => {
    if (k.snatched >= 0 || k.done.has(i) || dist(hx, hy, p.x, p.y) > SNATCH_R) return;
    k.snatched = i; k.done.add(i); p.b.speed = 0; p.face = 'down';
    p.act = { n: 'snatched', t: 0, dur: 0.9, then: () => w.say('A macaque snatched your snack bag! Shoo it off (E): arms wide, be big. Never feed them.', 'bad') };
  });
}
export function bukitNear(w: World, cand: (n: Near, r: number) => void) {
  const B = w.c.bukit, k = w.bukit; if (!B || !onBukit(w) || w.p.ride || w.run) return;
  if (k.snatched >= 0) { const [hx, hy] = B.haunts[k.snatched]; cand({ kind: 'bukit', id: 'shoo', label: 'Shoo the macaque off your snack', x: hx, y: hy }, 120); }
  const hb = w.c.places.herbarium; if (hb) cand({ kind: 'bukit', id: 'specimen', label: 'Read a specimen sheet at the herbarium', x: hb.x, y: hb.y }, 80);
  B.shelters.forEach(([sx, sy], i) => cand({ kind: 'bukit', id: `rest:${i}`, label: 'Sit on the shelter’s log and get your breath', x: sx, y: sy }, 70));
  cand({ kind: 'bukit', id: 'summit', label: 'Touch the summit marker', x: B.summit[0], y: B.summit[1] }, 80);
}
export function bukitAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.bukit; p.face = 'down'; p.b.speed = 0;
  const rep = (what: string) => { if (!k.once.has(what)) { k.once.add(what); addRep(s, 'bukit', 1); } };
  if (id === 'shoo') {
    k.scareT = w.time;
    p.act = { n: 'scare', t: 0, dur: 1.2, then: () => {
      k.snatched = -1; s.stats.shoos++; rep('shoo');
      w.say(s.stats.shoos === 1 ? 'Arms wide, big voice: the macaque drops your snack and bolts up a tree, very offended. Puan Lotong would be proud.' : `Shooed off another one (${s.stats.shoos} so far), snack back, nobody fed.`, 'good');
    } };
    return;
  }
  if (id === 'specimen') {
    p.act = { n: 'specimen', t: 0, dur: 2.2, then: () => {
      s.stats.specimens++; rep('specimen');
      w.say(`Through the herbarium’s magnifier: ${SHEETS[k.reads % SHEETS.length]}.`, 'good'); k.reads++;
    } };
    return;
  }
  if (id.startsWith('rest:')) {
    p.act = { n: 'rest', t: 0, dur: 2.6, then: () => {
      s.stats.rests++; rep('rest');
      w.say(s.stats.rests === 1 ? 'A sit on the log, a long drink of water, and the forest goes on humming round you. Bliss.' : 'A rest on the log. A squirrel comes down to look at you, then goes back up.', 'good');
    } };
    return;
  }
  if (id === 'summit') {
    p.act = { n: 'summit', t: 0, dur: 1.4, then: () => {
      s.stats.summits++; rep('summit');
      w.say('Hand on the summit marker: 163 metres, the highest ground in Singapore. You can hear the whole forest from here.', 'good');
    } };
  }
}

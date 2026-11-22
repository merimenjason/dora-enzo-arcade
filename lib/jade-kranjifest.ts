// Jade Street (twenty-fourth pass): Kranji and Woodlands' small pleasures, out of a job. Watch the shorebirds from the
// Sungei Buloh hide (binoculars up: the look-out pose), and hold out a handful of hay to Hay Dairies' goats (its own
// animation). Each counts towards a trophy and the first of each a night is a little Kranji reputation. And at the
// Kranji War Memorial you may stand a while before the columns, hat in hand (its own animation): no prize, no
// reputation, no fanfare, only a quiet line. Inside the memorial's hedge you walk, never run (lib/jade-game.ts). No
// DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type KranjiState = { night: number; once: Set<string>; told: boolean; sights: number; bows: number };
export const newKranji = (): KranjiState => ({ night: -1, once: new Set(), told: false, sights: 0, bows: 0 });
/** what the binoculars show from the bird hide, in turn */
export const HIDE_SIGHTS = ['a flock of whimbrels probing the mud with their long curved bills', 'a grey heron standing so still it might be a post',
  'mudskippers flicking up their fins at each other, squabbling over a puddle', 'a crocodile sliding off the bank without a ripple',
  'a pair of collared kingfishers, blue as the Causeway’s lights', 'a Pacific golden plover, all the way from Siberia, having a rest'];
/** what you think about before the memorial, in turn: plain, quiet lines */
export const MEMORIAL_LINES = ['You stand quietly before the memorial, hat in hand. The names run up the columns, more than anyone could read in a day. After a while, you walk on.',
  'The lawn is very still. Rows of white headstones, the grass cut neat between them. You bow your head for a moment, then walk on.',
  'Somebody has left frangipani on the step. You stand a while, and the only sound is the wind in the trees. Then you walk on.'];
/** how long the bow lasts */
export const BOW_S = 3.0;

const onKranji = (w: World) => !!w.c.kranji && w.open.has('kranji');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'kranji';
/** a point inside the memorial's hedge (world) */
export function inQuiet(w: World, x: number, y: number) {
  const q = w.c.kranji?.quiet; if (!q) return false;
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  return tx >= q[0] && ty >= q[1] && tx <= q[2] && ty <= q[3];
}

export function kranjiStep(w: World, dt: number) {
  const k = w.kranji; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); }
  if (!onKranji(w) || w.run || !here(w, w.p.x, w.p.y)) return;
  if (!k.told) { k.told = true; w.say('Kranji and Woodlands! Watch the shorebirds from the Sungei Buloh hide (E), feed the goats at Hay Dairies (E), and see the Causeway’s famous jam from the waterfront.', 'good'); }
}
export function kranjiNear(w: World, cand: (n: Near, r: number) => void) {
  const K = w.c.kranji; if (!K || !onKranji(w) || w.p.ride || w.run) return;
  cand({ kind: 'kranji', id: 'hide', label: 'Watch the shorebirds from the hide', x: K.hide[0], y: K.hide[1] }, 80);
  cand({ kind: 'kranji', id: 'goats', label: 'Hold out a handful of hay to the goats', x: K.pen[0], y: K.pen[1] }, 90);
  cand({ kind: 'kranji', id: 'respect', label: 'Stand quietly before the memorial', x: K.respect[0], y: K.respect[1] }, 70);
}
export function kranjiAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.kranji; p.b.speed = 0;
  const rep = (what: string) => { if (!k.once.has(what)) { k.once.add(what); addRep(s, 'kranji', 1); } };
  if (id === 'hide') {
    p.face = 'up';
    p.act = { n: 'lookout', t: 0, dur: 2.4, then: () => {
      s.stats.hides++; rep('hide');
      const sight = HIDE_SIGHTS[k.sights % HIDE_SIGHTS.length]; k.sights++;
      w.say(`Through the hide’s slit window: ${sight}.`, 'good');
    } };
    return;
  }
  if (id === 'goats') {
    p.face = 'down';
    p.act = { n: 'goatfeed', t: 0, dur: 2.0, then: () => {
      s.stats.goatfeeds++; rep('goats');
      w.say(s.stats.goatfeeds === 1 ? 'A goat trots over, sniffs the hay, and eats it out of your hand in four big bites. Then it eyes your sleeve.' : `Hay for the goats (${s.stats.goatfeeds} handfuls so far). They are never full.`, 'good');
    } };
    return;
  }
  if (id === 'respect') {
    // no stat, no reputation, no trophy: a quiet line, in the calm voice
    p.face = 'up';
    p.act = { n: 'bow', t: 0, dur: BOW_S, then: () => { w.say(MEMORIAL_LINES[k.bows % MEMORIAL_LINES.length], 'info'); k.bows++; } };
  }
}

// Jade Street: the festivals and small pleasures over the Rochor River and on Sentosa. Little India and Kampong Glam
// take turns: on even nights the Deepavali light-up glows over Serangoon Road (the arch lit, the oil lamps along the
// road waiting for a light, kolam patterns at the doorsteps), on odd nights the Hari Raya bazaar sets up on Bussorah
// Street (stalls of kuih and ketupat under pelita lamps). Light a lamp, buy a kuih, smell the spices or the attar, sit
// in a deck chair on Siloso Beach or build a sandcastle: each has its own animation, and none needs a job. Warm and
// respectful: these are the neighbours' festivals and the heroes are guests. No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type EastFest = 'deepavali' | 'bazaar';
/** tonight's festival: the two take turns, so a player sees both within two nights */
export const eastFest = (night: number): EastFest => (night % 2 === 0 ? 'deepavali' : 'bazaar');
export type EastState = { night: number; fest: EastFest; lit: Set<number>; once: Set<string> };
export const newEast = (): EastState => ({ night: -1, fest: 'deepavali', lit: new Set(), once: new Set() });
export const KUIH = 3;

const open = (w: World, x: number, y: number) => w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)));
export function eastStep(w: World) {
  const e = w.east; if (!w.c.east) return;
  if (e.night !== w.s.night) { e.night = w.s.night; e.fest = eastFest(w.s.night); e.lit.clear(); e.once.clear(); }
}
/** the smell-the-shop spots: Mr Raju's spices and Puan Wangi's perfume */
const SNIFF: [string, string][] = [['spices', 'Smell the spices'], ['wangi', 'Smell the attar']];
export function eastNear(w: World, cand: (n: Near, r: number) => void) {
  const E = w.c.east, e = w.east; if (!E || w.p.ride) return;
  if (e.fest === 'deepavali') E.lamps.forEach(([x, y], i) => { if (!e.lit.has(i) && open(w, x, y)) cand({ kind: 'east', id: 'lamp:' + i, label: 'Light a Deepavali lamp', x, y }, 60); });
  if (e.fest === 'bazaar') for (const [x, y] of E.bazaar) if (open(w, x, y)) cand({ kind: 'east', id: 'kuih', label: `Buy a kuih at the bazaar (${KUIH} coins)`, x, y: y + 40 }, 70);
  for (const [id, label] of SNIFF) { const pl = w.c.places[id]; if (pl && open(w, pl.x, pl.y) && !e.once.has(id)) cand({ kind: 'east', id: 'sniff:' + id, label, x: pl.x, y: pl.y }, 70); }
  for (const [x, y] of E.chairs) if (open(w, x, y)) cand({ kind: 'east', id: 'lounge', label: 'Lie back in the deck chair', x, y }, 50);
  for (const [x, y] of E.beach) if (open(w, x, y) && !e.once.has(`castle:${x},${y}`)) cand({ kind: 'east', id: `castle:${x},${y}`, label: 'Build a sandcastle', x, y }, 60);
}
export function eastAct(w: World, id: string) {
  const p = w.p, e = w.east, s = w.s; p.face = 'down';
  if (id.startsWith('lamp:')) {
    const i = +id.slice(5);
    p.act = { n: 'light-lamp', t: 0, dur: 1.2, then: () => {
      e.lit.add(i); s.stats.lamps++; addRep(s, 'india', 1); w.fx.push({ t: 'lamp', x: p.b.x, y: p.b.y });
      const n = w.c.east!.lamps.length; w.say(e.lit.size === n ? 'Every lamp on Serangoon Road is lit. Happy Deepavali!' : `Lamp lit (${e.lit.size} of ${n}). Happy Deepavali!`, 'good');
      if (e.lit.size === n && !e.once.has('all-lamps')) { e.once.add('all-lamps'); s.cash += 15; w.banner = { text: 'Happy Deepavali!', sub: 'Every lamp lit · +15 coins', t: 2.6 }; }
    } };
    return;
  }
  if (id === 'kuih') {
    if (s.cash < KUIH) { w.say(`A kuih is ${KUIH} coins.`, 'bad'); return; }
    s.cash -= KUIH; p.act = { n: 'kuih', t: 0, dur: 1.8, then: () => { s.stats.kuih++; w.say('Kuih lapis, soft and sweet. Selamat Hari Raya!', 'good'); } };
    w.fx.push({ t: 'eat' }); return;
  }
  if (id.startsWith('sniff:')) {
    const what = id.slice(6); e.once.add(what);
    p.act = { n: 'sniff', t: 0, dur: 1.4, then: () => w.say(what === 'spices' ? 'Cardamom, cumin, cloves… achoo! Wonderful.' : 'Rose and sandalwood. Puan Wangi’s grandmother’s recipe.', 'good') };
    p.face = 'up'; return;
  }
  if (id === 'lounge') { p.act = { n: 'lounge', t: 0, dur: 3 }; w.fx.push({ t: 'relax' }); return; }
  if (id.startsWith('castle:')) {
    e.once.add(id); p.act = { n: 'castle', t: 0, dur: 2.2, then: () => { w.fx.push({ t: 'good-deed' }); w.say('A sandcastle with a moat. The tide will love it.', 'good'); } };
  }
}
/** is (x, y) near a lit lamp (the scene glows it) */
export const lampLit = (w: World, i: number) => w.east.fest === 'deepavali' && w.east.lit.has(i);

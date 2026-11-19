// Jade Street (fourteenth pass): the small pleasures of the west side. A plate of chwee kueh at Uncle Seng's cart in
// Tiong Bahru Market, the songbirds at the Tiong Bahru bird corner, a go on the Slingshot at Clarke Quay, feeding the
// koi in Jurong Lake, the stars through the Science Centre Observatory's telescope, and a lantern walk round the
// Chinese Garden while Lights by the Lake is on (in season by the device calendar, and all through chapter nine).
// Each has its own animation, and none needs a job. No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import { isMidAutumn } from './jade-calendar.js';
import type { World, Near } from './jade-game.js';

export const CHWEE = 3, SLING = 8, SLING_S = 3.2, WALK_S = 4;
/** what the telescope shows, in turn */
export const STARS = ['Saturn, rings and all', 'the Moon’s craters, close enough to touch', 'Jupiter and four little moons', 'the Orion Nebula, like spilt milk'];
export type SouthState = { night: number; once: Set<string>; fed: number; walk?: { x0: number; y0: number; x1: number; y1: number } };
export const newSouth = (): SouthState => ({ night: -1, once: new Set(), fed: 0 });

/** are the lanterns of Lights by the Lake lit: in season, or while chapter nine's story is still being played */
export const lakeLights = (w: World) => (w.today ? isMidAutumn(w.today) : true) || (w.s.done.includes('m55') && !w.s.done.includes('m65'));
const open = (w: World, x: number, y: number) => w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)));
export function southStep(w: World) {
  const f = w.south; if (f.night !== w.s.night) { f.night = w.s.night; f.once.clear(); f.fed = 0; }
  // the lantern walk carries you along the north shore of the lake
  if (f.walk) { const a = w.p.act; if (a?.n === 'lantern-walk') { const k = Math.min(1, a.t / a.dur); w.p.b.x = f.walk.x0 + (f.walk.x1 - f.walk.x0) * k; w.p.b.y = f.walk.y0 + (f.walk.y1 - f.walk.y0) * k; w.p.face = 'side'; w.p.flip = true; } else f.walk = undefined; }
}
export function southNear(w: World, cand: (n: Near, r: number) => void) {
  const S = w.c.south, f = w.south; if (!S || w.p.ride) return;
  if (open(w, S.kueh[0], S.kueh[1])) cand({ kind: 'south', id: 'chwee', label: `Eat a plate of chwee kueh (${CHWEE} coins)`, x: S.kueh[0], y: S.kueh[1] + 34 }, 74);
  if (open(w, S.birds[0], S.birds[1])) cand({ kind: 'south', id: 'birds', label: 'Listen to the songbirds', x: S.birds[0] + T / 2, y: S.birds[1] + 40 }, 80);
  if (open(w, S.sling[0], S.sling[1])) cand({ kind: 'south', id: 'sling', label: `Ride the Slingshot (${SLING} coins)`, x: S.sling[0], y: S.sling[1] + 50 }, 78);
  for (const [x, y] of S.koi) if (open(w, x, y)) cand({ kind: 'south', id: 'koi', label: 'Feed the koi', x, y }, 70);
  if (open(w, S.scope[0], S.scope[1])) cand({ kind: 'south', id: 'stars', label: 'Look through the telescope', x: S.scope[0], y: S.scope[1] + 30 }, 72);
  if (lakeLights(w) && open(w, S.walk[0][0], S.walk[0][1]) && !f.once.has('walk')) cand({ kind: 'south', id: 'walk', label: 'Carry a rabbit lantern round the lake', x: S.walk[0][0], y: S.walk[0][1] }, 70);
}
export function southAct(w: World, id: string) {
  const p = w.p, f = w.south, s = w.s; p.face = 'down';
  if (id === 'chwee') {
    if (s.cash < CHWEE) { w.say(`A plate of chwee kueh is ${CHWEE} coins.`, 'bad'); return; }
    s.cash -= CHWEE; w.fx.push({ t: 'eat' });
    p.act = { n: 'chwee', t: 0, dur: 2, then: () => { s.stats.chwee++; w.say('Soft rice cake, salty chai poh, a dab of chilli. Shiok!', 'good'); } };
    return;
  }
  if (id === 'birds') {
    p.face = 'up';
    p.act = { n: 'birdsong', t: 0, dur: 2.6, then: () => {
      s.stats.songs++; w.fx.push({ t: 'good-deed' });
      if (!f.once.has('birds')) { f.once.add('birds'); addRep(s, 'tiong', 1); }
      w.say('The merbok answers your whistle. The bird uncles nod: not bad, not bad.', 'good');
    } };
    return;
  }
  if (id === 'sling') {
    if (s.cash < SLING) { w.say(`A go on the Slingshot is ${SLING} coins.`, 'bad'); return; }
    s.cash -= SLING; w.fx.push({ t: 'sling' });
    p.act = { n: 'sling', t: 0, dur: SLING_S, then: () => { s.stats.slings++; w.fx.push({ t: 'good-deed' }); w.say(s.stats.slings === 1 ? 'Seventy metres up over the Singapore River and back. Again? Again!' : `Whee! (${s.stats.slings} rides)`, 'good'); } };
    return;
  }
  if (id === 'koi') {
    p.act = { n: 'koi', t: 0, dur: 2.2, then: () => {
      s.stats.koi++; f.fed++;
      if (f.fed === 3 && !f.once.has('koi')) { f.once.add('koi'); addRep(s, 'jurong', 1); s.cash += 10; w.banner = { text: 'The koi are full!', sub: 'Sifu Musang leaves a little thank-you · +10 coins', t: 2.6 }; }
      else w.say('The koi boil up orange and white. One blows a bubble at you.', 'good');
    } };
    return;
  }
  if (id === 'stars') {
    p.face = 'side'; p.flip = false;
    p.act = { n: 'stars', t: 0, dur: 2.6, then: () => { const k = s.stats.stars % STARS.length; s.stats.stars++; w.say(`Through the telescope: ${STARS[k]}.`, 'good'); } };
    return;
  }
  if (id === 'walk') {
    const S = w.c.south!; f.once.add('walk'); p.face = 'side'; p.flip = true;
    const [x0, y0] = [p.b.x, p.b.y], [x1, y1] = S.walk[1];
    p.act = { n: 'lantern-walk', t: 0, dur: WALK_S, then: () => { s.stats.lwalks++; addRep(s, 'jurong', 1); w.fx.push({ t: 'good-deed' }); w.say('Round the lake with a rabbit lantern, the pagoda glowing in the water. Happy Mid-Autumn!', 'good'); } };
    f.walk = { x0, y0, x1, y1 };
  }
}

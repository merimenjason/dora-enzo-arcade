// Jade Street (twenty-first pass): the Southern Islands' small pleasures, out of a job. Feed Kusu's tortoises a leaf of
// kangkong at the pond (crouched, holding it out: its own animation); float on your back in the Lazarus lagoon (its own
// animation, the water lapping round you); climb to Raffles Lighthouse's gallery and look out through the keeper's
// binoculars (its own animation); and peer into the rock pools on the reef (kneeling over the water: its own animation).
// Each counts towards a trophy and the first of each a night is a little Southern Islands reputation. No DOM;
// deterministic.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type IslandsState = { night: number; once: Set<string>; told: boolean; sights: number; finds: number; floatT: number };
export const newIslands = (): IslandsState => ({ night: -1, once: new Set(), told: false, sights: 0, finds: 0, floatT: -99 });
/** what the binoculars show from the lighthouse gallery, in turn */
export const SIGHTS = ['a container ship sliding past on the shipping lane, lit up like a street', 'the city’s towers across the water, Marina Bay Sands on the left',
  'a pod of dolphins breaking the surface south of the Sisters', 'the ferry’s lamp crossing back to Marina South Pier',
  'Kusu’s temple roof, gold in the moonlight', 'a black-naped tern asleep on the gallery rail, one eye open'];
/** what you see in a rock pool, in turn */
export const FINDS = ['a sea star, five arms and a sixth growing', 'a fiddler crab waving its one big claw at you', 'a giant clam, shutting slowly as your shadow falls',
  'a clownfish nipping in and out of its anemone', 'a seahorse hanging on to the seagrass by its tail', 'a nudibranch, frilly and orange, going nowhere fast'];
/** how long a float in the lagoon lasts */
export const FLOAT_S = 3.2;

const onIslands = (w: World) => !!w.c.islands && w.open.has('islands');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'islands';

export function islandsStep(w: World, dt: number) {
  const k = w.islands; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); }
  if (!onIslands(w) || w.run || !here(w, w.p.x, w.p.y)) return;
  if (!k.told) { k.told = true; w.say('The Southern Islands! Feed Kusu’s tortoises at the pond (E), float in the Lazarus lagoon (E), look out from Raffles Lighthouse (E), or peer into the rock pools on the reef (E).', 'good'); }
}
export function islandsNear(w: World, cand: (n: Near, r: number) => void) {
  const I = w.c.islands; if (!I || !onIslands(w) || w.p.ride || w.run) return;
  cand({ kind: 'islands', id: 'tortoise', label: 'Feed the tortoises a leaf of kangkong', x: I.pond[0], y: I.pond[1] }, 90);
  cand({ kind: 'islands', id: 'float', label: 'Float in the lagoon', x: I.lagoon[0], y: I.lagoon[1] }, 90);
  cand({ kind: 'islands', id: 'lookout', label: 'Look out from the lighthouse gallery', x: I.gallery[0], y: I.gallery[1] }, 80);
  I.pools.forEach(([px, py], i) => cand({ kind: 'islands', id: `pool:${i}`, label: 'Peer into the rock pool', x: px, y: py }, 60));
}
export function islandsAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.islands; p.face = 'down'; p.b.speed = 0;
  const rep = (what: string) => { if (!k.once.has(what)) { k.once.add(what); addRep(s, 'islands', 1); } };
  if (id === 'tortoise') {
    p.act = { n: 'tortoise', t: 0, dur: 2.2, then: () => {
      s.stats.tortoises++; rep('tortoise');
      w.say(s.stats.tortoises === 1 ? 'You hold out a leaf of kangkong and the oldest tortoise plods over and takes it, very slowly, very politely.' : `Breakfast for the tortoises (${s.stats.tortoises} leaves so far). They chew like they have all the time in the world. They do.`, 'good');
    } };
    return;
  }
  if (id === 'float') {
    k.floatT = w.time;
    p.act = { n: 'float', t: 0, dur: FLOAT_S, then: () => {
      s.stats.floats++; rep('float');
      w.say(s.stats.floats === 1 ? 'On your back in the warm lagoon, looking up. Somewhere over there, the lighthouse beam goes round.' : 'Another float in the lagoon. The stars don’t move. Neither do you.', 'good');
    } };
    return;
  }
  if (id === 'lookout') {
    p.face = 'up';
    p.act = { n: 'lookout', t: 0, dur: 2.4, then: () => {
      s.stats.lookouts++; rep('lookout');
      const sight = SIGHTS[k.sights % SIGHTS.length]; k.sights++;
      w.say(`From the lighthouse gallery, through the keeper’s binoculars: ${sight}.`, 'good');
    } };
    return;
  }
  if (id.startsWith('pool:')) {
    p.act = { n: 'peer', t: 0, dur: 1.6, then: () => {
      s.stats.peeks++; rep('pool');
      const f = FINDS[k.finds % FINDS.length]; k.finds++;
      w.say(`In the rock pool: ${f}.`, 'good');
    } };
  }
}

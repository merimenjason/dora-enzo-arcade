// Jade Street: learning in context. The first minutes teach one control at a time, when it matters: moving and
// running at the start, dash and hop next, getting on a ride when one is the next step, boost and honk once riding,
// the map after the first job, the market at the first stall, heat and hiding the first time a lantern lights, and
// sneaking when a job needs it. Each lesson shows the right key or touch button until you have done it once; learned
// lessons are kept in the save. Pure engine: the HUD reads `w.hint`.
import { FOOT } from './jade-move.js';
import { dist } from './jade-rng.js';
import type { World } from './jade-game.js';

export type Lesson = { id: string; text: string; keys: string[]; touch: string; when: (w: World) => boolean; done: (w: World, fx: string[]) => boolean; max?: number };
const onFoot = (w: World) => !w.p.ride && !w.p.roof;
const learned = (w: World, id: string) => w.s.learned.includes(id);
export const LESSONS: Lesson[] = [
  // contextual lessons first: they win when they apply
  { id: 'heat', text: 'Lanterns lit: the wardens are after you. Break their line of sight to put them out.', keys: [], touch: '', when: w => w.heat >= 1, done: w => w.heat < 1, max: 9 },
  { id: 'hide', text: 'Duck into a bead curtain or a basket to hide: lanterns go out twice as fast.', keys: ['E'], touch: 'Action', when: w => w.heat >= 1 && learned(w, 'heat') && onFoot(w) && w.c.hides.some(h => dist(h.x, h.y, w.p.x, w.p.y) < 420), done: w => w.p.hide, max: 14 },
  { id: 'sneak', text: 'Sneak to stay quiet: walk slowly and you are much harder to notice.', keys: ['Shift'], touch: 'Sneak', when: w => onFoot(w) && !!w.run && (w.run.cur?.t === 'tail' || w.run.cur?.t === 'stealth'), done: w => w.p.sneak && w.p.b.speed > 20 },
  { id: 'ride', text: 'Walk up to a ride and get on.', keys: ['E'], touch: 'Ride', when: w => onFoot(w) && (w.near?.kind === 'ride' || w.run?.cur?.t === 'ride'), done: w => !!w.p.ride },
  { id: 'market', text: 'A market stall: trade here. Buy cheap, sell where it pays, and haggle for a better price.', keys: ['E'], touch: 'Action', when: w => w.near?.kind === 'market' || w.run?.cur?.t === 'trade', done: () => false },
  { id: 'boost', text: 'Boost for a burst of speed.', keys: ['Space'], touch: 'Boost', when: w => !!w.p.ride && learned(w, 'ride'), done: (_w, fx) => fx.includes('boost') },
  { id: 'honk', text: 'Honk to clear townsfolk out of your way.', keys: ['Q'], touch: 'Honk', when: w => !!w.p.ride && learned(w, 'boost') && w.peds.some(p => dist(p.x, p.y, w.p.x, w.p.y) < 300), done: (_w, fx) => fx.includes('honk') },
  { id: 'map', text: 'Open the map to see the whole quarter, find markets and drop a pin.', keys: ['M'], touch: 'map', when: w => w.s.done.length >= 1 && !w.run, done: () => false },
  // the basics, in order
  { id: 'move', text: 'Move around the quarter.', keys: ['W', 'A', 'S', 'D'], touch: 'stick', when: w => onFoot(w), done: w => w.tutor.moved > 3 * 64 },
  { id: 'run', text: 'Push all the way to run.', keys: ['W', 'A', 'S', 'D'], touch: 'stick', when: w => onFoot(w) && learned(w, 'move'), done: w => w.tutor.ran > 1 },
  { id: 'dash', text: 'Dash for a quick burst: it knocks thieves over and dodges magpies.', keys: ['Space'], touch: 'Dash', when: w => onFoot(w) && learned(w, 'run'), done: (_w, fx) => fx.includes('dash') },
  { id: 'hop', text: 'Hop over crates, benches and hedges.', keys: ['Q'], touch: 'Hop', when: w => onFoot(w) && learned(w, 'dash'), done: (_w, fx) => fx.includes('hop') },
];
export type TutorState = { moved: number; ran: number; shownT: number; cur: string | null };
export const newTutor = (): TutorState => ({ moved: 0, ran: 0, shownT: 0, cur: null });

/** one step: count what the player did, finish the current lesson, choose the next */
export function tutorStep(w: World, dt: number, fx: string[]) {
  const t = w.tutor;
  if (!w.s.story.intro || w.talk || w.ui || w.failed) return;
  if (!w.p.ride) { t.moved += w.p.b.speed * dt; if (w.p.b.speed > FOOT.walk + 20) t.ran += dt; }
  const cur = t.cur ? LESSONS.find(l => l.id === t.cur) ?? null : null;
  if (cur) {
    t.shownT += dt;
    if (cur.done(w, fx)) { learn(w, cur.id); w.fx.push({ t: 'learned', name: cur.id }); t.cur = null; return; }
    if (cur.max && t.shownT > cur.max) { learn(w, cur.id); t.cur = null; return; }
    if (cur.when(w)) { const better = LESSONS.find(l => !learned(w, l.id) && l.when(w)); if (!better || LESSONS.indexOf(better) >= LESSONS.indexOf(cur)) return; }
    else if (t.shownT < 2) return;
  }
  const next = LESSONS.find(l => !learned(w, l.id) && l.when(w)) ?? null;
  if (next?.id !== t.cur) { t.cur = next?.id ?? null; t.shownT = 0; if (next?.id === 'move') t.moved = 0; if (next?.id === 'run') t.ran = 0; }
}
/** the page tells the tutor about things it sees (the map opened, the market opened) */
export function learn(w: World, id: string) { if (!w.s.learned.includes(id)) w.s.learned.push(id); if (w.tutor.cur === id) w.tutor.cur = null; }
export const lesson = (id: string | null) => (id ? LESSONS.find(l => l.id === id) ?? null : null);

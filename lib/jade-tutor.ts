// Jade Street: learning in context. The first minutes teach one control at a time, when it matters: moving and
// running at the start, dash and hop next, getting on a ride when one is the next step, boost and honk once riding,
// the map after the first job, the market at the first stall, heat and hiding the first time a lantern lights, and
// sneaking when a job needs it. Each lesson shows the right key or touch button until you have done it once; learned
// lessons are kept in the save. Pure engine: the HUD reads `w.hint`.
import { FOOT } from './jade-move.js';
import { dist } from './jade-rng.js';
import type { World } from './jade-game.js';
import { tagOption } from './jade-tag.js';
import { MRT_HINT } from './jade-mrt.js';
import { CABLE_HINT } from './jade-cable.js';

/** how long the one-time MRT and cable car hints stay up (seconds on screen) */
export const MRT_HINT_S = 12;
/** the job the MRT hint is about (Madame Glint's, at Chinatown station) and the cable car's first job */
export const MRT_JOB = 'm26', CABLE_JOB = 'm42';
/** the MRT hint only makes sense while Madame Glint's job at the gates is still to do */
const mrtNext = (w: World) => !w.s.done.includes(MRT_JOB);
/** `once`: a one-time notice rather than a control to practise. It counts as learned (and is saved) the moment it
 * first shows, steps off as soon as it no longer applies (a job, a ride), and never comes back (pass 13: the MRT hint
 * used to reappear after every job and ride, and so lingered across Katong, Orchard and Changi) */
export type Lesson = { id: string; text: string; kbText?: string; keys: string[]; touch: string; when: (w: World) => boolean; done: (w: World, fx: string[]) => boolean; max?: number; once?: boolean };
const onFoot = (w: World) => !w.p.ride && !w.p.roof;
const learned = (w: World, id: string) => w.s.learned.includes(id);
export const LESSONS: Lesson[] = [
  // contextual lessons first: they win when they apply. The MRT first of all, once, when the island opens and Madame
  // Glint's job at Chinatown station is on offer (what the hint says): shown until you ride (or for 12 s), with the gold
  // route line to Chinatown station while it shows
  { id: 'mrt', text: MRT_HINT, keys: ['E'], touch: 'Action', when: w => !!w.c.isle && w.open.has('heartland') && mrtNext(w) && !w.run && !w.p.ride, done: (_w, fx) => fx.includes('mrt'), max: MRT_HINT_S, once: true },
  // the cable car, once, when Sentosa opens (and Up the Cable Car is not yet done): until you ride it (or the ferry), or 12 s
  { id: 'cable', text: CABLE_HINT, keys: ['E'], touch: 'Action', when: w => !!w.c.east && w.open.has('resort') && !w.s.done.includes(CABLE_JOB) && !w.run && !w.p.ride, done: (_w, fx) => fx.includes('cable') || fx.includes('ferry-go'), max: MRT_HINT_S, once: true },
  { id: 'heat', text: 'Lanterns lit: the wardens are after you. Break their line of sight to put them out.', keys: [], touch: '', when: w => w.heat >= 1, done: w => w.heat < 1, max: 9 },
  { id: 'hide', text: 'Duck into a bead curtain or a basket to hide: lanterns go out twice as fast.', keys: ['E'], touch: 'Action', when: w => w.heat >= 1 && learned(w, 'heat') && onFoot(w) && w.c.hides.some(h => dist(h.x, h.y, w.p.x, w.p.y) < 420), done: w => w.p.hide, max: 14 },
  { id: 'sneak', text: 'Sneak to stay quiet: walk slowly and you are much harder to notice.', keys: ['Shift'], touch: 'Sneak', when: w => onFoot(w) && !!w.run && (w.run.cur?.t === 'tail' || w.run.cur?.t === 'stealth'), done: w => w.p.sneak && w.p.b.speed > 20 },
  { id: 'ride', text: 'Walk up to a ride and get on.', keys: ['E'], touch: 'Ride', when: w => onFoot(w) && (w.near?.kind === 'ride' || w.run?.cur?.t === 'ride'), done: w => !!w.p.ride },
  { id: 'market', text: 'A market stall: trade here. Buy cheap, sell where it pays, and haggle for a better price.', keys: ['E'], touch: 'Action', when: w => w.near?.kind === 'market' || w.run?.cur?.t === 'trade', done: () => false, max: 20 },
  { id: 'boost', text: 'Boost for a burst of speed.', keys: ['Space'], touch: 'Boost', when: w => !!w.p.ride && learned(w, 'ride'), done: (_w, fx) => fx.includes('boost') },
  { id: 'honk', text: 'Honk to clear townsfolk out of your way.', keys: ['Q'], touch: 'Honk', when: w => !!w.p.ride && learned(w, 'boost') && w.peds.some(p => dist(p.x, p.y, w.p.x, w.p.y) < 300), done: (_w, fx) => fx.includes('honk') },
  // the duo and the gadgets: the tag-team key when a move is on offer, switching when a job asks, the first gadget
  { id: 'tag', text: 'Your partner can help here: press F for a tag-team move (the green prompt says which).', keys: ['F'], touch: 'tag', when: w => { const o = tagOption(w); return !!o && o.kind !== 'wait' && o.kind !== 'call'; }, done: (_w, fx) => fx.includes('tag'), max: 20 },
  { id: 'switch', text: 'Switch to the other hero: the camera follows, and your partner keeps doing their part.', keys: ['Tab'], touch: 'portrait', when: w => !!w.run && (w.run.cur?.t === 'switch' || (w.run.cur?.t === 'tail' && !!w.run.cur.relay) || (w.run.cur?.t === 'race' && w.run.cur.relay !== undefined)), done: (_w, fx) => fx.includes('switch'), max: 30 },
  { id: 'fire', text: 'Aim with the mouse and click to fire your gadget. 1 and 2 swap gadgets, X reloads.', keys: ['Click'], touch: 'gadget', when: w => w.s.gear.own.length > 0 && !w.p.ride && !w.p.roof, done: (_w, fx) => fx.includes('fire'), max: 16 },
  { id: 'map', text: 'Open the map to see the whole quarter, find markets and drop a pin.', keys: ['M'], touch: 'map', when: w => w.s.done.length >= 1 && !w.run, done: () => false, max: 20 },
  // the basics, in order; each one gives up after a while on screen, so none hangs about for a player who never needs it
  { id: 'move', text: 'Move around the quarter.', keys: ['W', 'A', 'S', 'D'], touch: 'stick', when: w => onFoot(w), done: w => w.tutor.moved > 3 * 64, max: 14 },
  { id: 'run', text: 'Push all the way to run.', kbText: 'Keep a direction held to run; Shift walks quietly.', keys: ['W', 'A', 'S', 'D'], touch: 'stick', when: w => onFoot(w) && learned(w, 'move') && !w.p.sneak, done: w => w.tutor.ran > 1, max: 10 },
  { id: 'dash', text: 'Dash for a quick burst: it knocks thieves over and dodges crows.', keys: ['Space'], touch: 'Dash', when: w => onFoot(w) && learned(w, 'run'), done: (_w, fx) => fx.includes('dash'), max: 14 },
  { id: 'hop', text: 'Hop over crates, benches and hedges.', keys: ['Q'], touch: 'Hop', when: w => onFoot(w) && learned(w, 'dash'), done: (_w, fx) => fx.includes('hop'), max: 14 },
];
/** a save that has already ridden or skipped past the first ride never sees the hint: mark it learned on load */
export function settleLessons(s: { done: string[]; learned: string[]; stats?: { mrt?: number } }) {
  if ((s.done.includes(MRT_JOB) || (s.stats?.mrt ?? 0) > 0) && !s.learned.includes('mrt')) s.learned.push('mrt');
  if (s.done.includes(CABLE_JOB) && !s.learned.includes('cable')) s.learned.push('cable');
}
export type TutorState = { moved: number; ran: number; shownT: number; cur: string | null };
export const newTutor = (): TutorState => ({ moved: 0, ran: 0, shownT: 0, cur: null });

/** one step: count what the player did, finish the current lesson, choose the next */
export function tutorStep(w: World, dt: number, fx: string[]) {
  const t = w.tutor;
  if (!w.s.story.intro || w.talk || w.ui || w.failed) return;
  if (!w.p.ride) { t.moved += w.p.b.speed * dt; if (w.p.b.speed > FOOT.walk + 20) t.ran += dt; }
  const cur = t.cur ? LESSONS.find(l => l.id === t.cur) ?? null : null;
  if (cur) {
    // (a lesson's time on screen only counts while it can show: a banner or an important toast holds it back)
    if (!w.hush) t.shownT += dt;
    if (cur.done(w, fx)) { learn(w, cur.id); w.fx.push({ t: 'learned', name: cur.id }); t.cur = null; return; }
    if (cur.max && t.shownT > cur.max) { learn(w, cur.id); t.cur = null; return; }
    // a one-time notice goes the moment it no longer applies (it is already learned, so it never returns)
    if (cur.once && !cur.when(w)) { t.cur = null; return; }
    if (cur.when(w)) { const better = LESSONS.find(l => !learned(w, l.id) && l.when(w)); if (!better || LESSONS.indexOf(better) >= LESSONS.indexOf(cur)) return; }
    else if (t.shownT < 2) return;
  }
  const next = LESSONS.find(l => !learned(w, l.id) && l.when(w)) ?? null;
  if (next?.id !== t.cur) { t.cur = next?.id ?? null; t.shownT = 0; if (next?.id === 'move') t.moved = 0; if (next?.id === 'run') t.ran = 0; if (next?.once) learn(w, next.id), t.cur = next.id; }
}
/** the page tells the tutor about things it sees (the map opened, the market opened) */
export function learn(w: World, id: string) { if (!w.s.learned.includes(id)) w.s.learned.push(id); if (w.tutor.cur === id) w.tutor.cur = null; }
export const lesson = (id: string | null) => (id ? LESSONS.find(l => l.id === id) ?? null : null);

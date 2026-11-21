// Jade Street: the job givers standing in the world. Each person in PEOPLE who has a contact place stands there all
// night, facing the street (Tock at his toy stall once it opens); a giver whose job is offered somewhere else (Madame
// Glint at the Chinatown station, Big Kow under the rain tree) waits beside that spot while it is offered. They breathe
// and fidget when idle, wave when they have a job for you and you are near, and talk while their lines are on screen.
// Everyone here is solid: a round obstacle you walk up to, never through. Drawing is in jade-scene.ts (npc-* frames).
import { T, W, S, districtAt, type District } from './jade-city.js';
import { nearestFree } from './jade-nav.js';
import { PEOPLE } from './jade-story.js';
import { offered } from './jade-save.js';
import { stallOpen, stallPos } from './jade-gear.js';
import { dist } from './jade-rng.js';
import { listContracts, contractsOpen } from './jade-contracts.js';
import { owned, bizPos } from './jade-biz.js';
import { jobsAt } from './jade-empire.js';
import type { World } from './jade-game.js';
import type { Obstacle } from './jade-move.js';

export type CastPose = 'idle' | 'wave' | 'talk';
export type CastMember = { id: string; x: number; y: number; d: District; home: boolean; ph: number; job: string | null; ob: Obstacle };
/** everyone who can stand in the world: all of PEOPLE but the heroes */
export const CAST_IDS = Object.keys(PEOPLE).filter(k => k !== 'dora' && k !== 'enzo');
export const CAST_POSES = ['idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1'] as const;
/** how solid a giver is, and how near you must be before they wave */
export const CAST_R = 18, WAVE_NEAR = 560;
/** who never stands at their contact place because they are already shown doing something there (Mr Ong rides his
 *  trike round the market) */
const ROAMS = new Set(['ong']);

const phase = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return h / 997; };
const member = (w: World, id: string, x: number, y: number, home: boolean, job: string | null): CastMember => {
  const [fx, fy] = nearestFree(w.c, 'walk', x, y, w.open, 2);
  const d = districtAt(Math.floor(fx / T), Math.floor(fy / T));
  return { id, x: fx, y: fy, d, home, ph: phase(id), job, ob: { x: fx, y: fy, r: CAST_R } };
};

/** who stands where right now (a pure function of the city, the save and whether a job is running) */
export function castOf(w: World): CastMember[] {
  const out: CastMember[] = []; const at = new Map<string, string>();
  const jobs = w.run ? [] : offered(w.s);
  for (const id of CAST_IDS) {
    const pl = w.c.places[id];
    if (pl && pl.kind === 'contact' && !ROAMS.has(id) && w.open.has(pl.d)) { out.push(member(w, id, pl.x, pl.y, true, jobs.find(m => m.giver === id && m.at === id)?.id ?? null)); at.set(id, id); }
  }
  // a contract's giver (lib/jade-contracts.ts) waves too, once no story job of theirs is on offer
  if (!w.run) for (const l of listContracts(w, true)) { const c = out.find(x => x.id === l.c.giver && x.home && !x.job); if (c) c.job = 'con:' + l.which; }
  if (stallOpen(w.s) && w.open.has('market')) { const [gx, gy] = stallPos(w); out.push(member(w, 'tock', gx + 56, gy + 12, true, null)); }
  // a job offered away from its giver's own place: the giver waits beside it while it is offered
  for (const m of jobs) {
    const home = out.find(c => c.id === m.giver && c.home);
    if (home && m.at === m.giver) continue;
    const pl = w.c.places[m.at]; if (!pl) continue;
    const by = out.some(c => dist(c.x, c.y, pl.x, pl.y) < 30);
    // at a station the giver waits beside the gates, not on them (E at the gates rides the MRT)
    const gate = m.at.startsWith('stn-');
    const v = member(w, m.giver, pl.x + (gate ? 90 : by ? 52 : 0), pl.y + (gate ? 60 : by ? -6 : 0), false, m.id);
    if (!out.some(c => c.id === v.id && !c.home)) out.push(v);
  }
  // the empire's people (the twelfth pass): Ah Huat, Inspector Siew and Towkay Hoot wait on the pavement outside a
  // property of yours with their job on offer tonight (E there starts it), and Pak Duri stands guard outside each
  // property he watches
  if (!w.run) for (const b of owned(w.s)) {
    if (!w.open.has(b.d)) continue;
    const [bx, by] = bizPos(b);
    // beside the stand, not in front of it (the stand's own E prompt and its customers keep the front)
    const spot = () => { for (const [dx, dy] of SIDE_SPOTS) { const x = bx + dx, y = by + dy; if (w.c.solid[Math.floor(y / T) * W + Math.floor(x / T)] === S.OPEN && !out.some(c => dist(c.x, c.y, x, y) < 48)) return [x, y]; } return null; };
    for (const j of jobsAt(w, b.id)) {
      if (!EMP_FOLK.has(j.giver) || out.some(c => c.id === j.giver)) continue;
      const at = spot(); if (at) out.push(member(w, j.giver, at[0], at[1], false, `emp:${j.id}:${b.id}`));
    }
    if (w.s.biz[b.id]?.jaga && !out.some(c => c.id === 'duri' && dist(c.x, c.y, bx, by) < 200)) { const at = spot(); if (at) out.push(member(w, 'duri', at[0], at[1], false, null)); }
  }
  return out;
}
/** where the empire's people stand round a property's stand (offsets from its pavement point, nearest first) */
const SIDE_SPOTS: [number, number][] = [[-110, 30], [110, 30], [-110, 90], [110, 90], [-160, 40], [160, 40], [0, 130]];
/** the empire's people who stand outside a property with a job for you */
const EMP_FOLK = new Set(['huat', 'siew', 'hoot']);
/** a key that changes whenever castOf could: what is offered, whether a job runs, which districts are open */
export const castKey = (w: World) => `${w.run ? 'run' : offered(w.s).map(m => m.id).join() + ':' + (contractsOpen(w.s) ? listContracts(w).map(l => l.c.giver).join() : '') + ':' + owned(w.s).map(b => `${b.id}${w.s.biz[b.id].jaga ? 'j' : ''}${jobsAt(w, b.id).map(j => j.id).join('.')}`).join()}|${[...w.open].join()}|${stallOpen(w.s)}`;

/** what a giver is doing this moment */
export function castPose(w: World, c: CastMember): CastPose {
  const t = w.talk; const line = t && t.lines[t.i];
  if (line && line[0] === c.id) return 'talk';
  if (c.job && !w.run && dist(c.x, c.y, w.p.x, w.p.y) < WAVE_NEAR) return 'wave';
  return 'idle';
}
/** the frame for a pose at time t (idle breathes slowly, each giver out of step with the next) */
export function castFrame(c: CastMember, pose: CastPose, t: number) {
  const rate = pose === 'idle' ? 0.7 : pose === 'wave' ? 2.6 : 3.4;
  return `npc-${c.id}-${pose}-${Math.floor(t * rate + c.ph * 2) % 2}`;
}
/** nudge a circle out of every giver (used for the players, the partner and the townsfolk) */
export function castPush(cast: CastMember[], b: { x: number; y: number; r: number }) {
  for (const c of cast) {
    const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), min = c.ob.r + b.r;
    if (d >= min) continue;
    if (d < 0.01) { b.y += min; continue; }
    b.x = c.x + dx / d * min; b.y = c.y + dy / d * min;
  }
}

/** what a giver says when you walk up with no job to take: one line each, in their own voice */
export const CHAT: Record<string, string> = {
  kee: 'Fresh longans today! Mind the crows, they like my oranges too.',
  mo: 'Hungry? Come back later, the wok is still hot.',
  pang: 'My scales are lucky, you know. Touch wood, touch scales.',
  heron: 'The temple bell rings at midnight. Breathe slowly, little ones.',
  ren: 'Feet wide, back straight! A lion dancer never slouches.',
  kiri: 'The river is calm tonight. Need a boat? You know where I moor.',
  lim: 'Extra, extra! Crows seen near the quay. Read all about it!',
  bo: 'Heavy crates, light hearts. Mind the forklifts.',
  bristle: 'No jaywalking on my watch. Use the crossing, please.',
  gizmo: 'This next track goes out to two very fluffy chinchillas!',
  glint: 'Darlings. Shiny things simply find their way to me.',
  pip: 'I’m not a lookout! I’m just… looking. Out.',
  hoon: 'Chope your table first, then queue. Aiyoh, so simple.',
  teo: 'Kopi or teh? Say properly, I cannot read minds.',
  beng: 'Wah, your tail very shiok. Where you get it?',
  ong: 'Karang guni! Old newspaper, old radio, can sell!',
  lily: 'Next show is at ten. Front row is for the spirits, hor!',
  goh: 'Chess is like life. Think three moves ahead, then eat supper.',
  sleek: 'The river is our playground. Mind your fish.',
  kow: 'Bananas belong to everyone. Mostly to me.',
  kamal: 'Mind the gap, and mind the platform doors.',
  vanda: 'Island Night is nearly sold out! Well, it will be.',
  lepak: 'Lepak means relax. Try it. Lie down. See? Nice.',
  kaw: 'Kaypoh Crows Pte Ltd: we know everyone’s business.',
  tock: 'Every gadget is tested on me first. Mostly safely.',
  raju: 'Smell that? Cardamom, fresh this morning. Your nose says thank you.',
  malar: 'Jasmine for luck, marigold for joy. Take one, my dear.',
  kancil: 'Feel this songket. Gold thread, hand woven. Like holding sunshine.',
  wangi: 'A little attar on the wrist. Not too much. Perfume should whisper.',
  duyung: 'Fifty years on these waters and the sea still surprises me.',
  helang: 'Fort Siloso, all present and correct! Salute!',
  bising: 'KECOH! Ah, sorry. Mynahs only have one volume.',
  nine: 'Number Nine. Not Number Two. Never Number Two.',
  // the tenth pass: they turn up at your properties (lib/jade-empire.ts), not at a place of their own
  huat: 'Fresh stock every morning, boss. Cash only, no credit, no durian on the MRT.',
  siew: 'Clean counter, clean floor, clean bins. I can tell from the door, you know.',
  hoot: 'Hoo-hoo. Half price, always half price. How I do it? Trade secret.',
  duri: 'Nobody touches the till on my watch, boss. I am small, but I am very pointy.',
  rosie: 'Laksa with a spoon only, ah. Chopsticks for laksa is for tourists.',
  bala: 'Bike for hire! Two wheels, one bell, the whole coast to ride.',
  seng: 'Chwee kueh must eat hot. Cold one is just rice with regrets.',
  melati: 'One more song before the last bumboat, darling?',
  suria: 'Did you know Saturn would float in a bathtub? A very large bathtub.',
  musang: 'A lantern is only paper until somebody carries it.',
  buaya: 'Potong, sandwich or cone? Same price as 1985. Almost.',
  kerbau: 'Paddles up! Hear the drum? That is your heartbeat now.',
  tiara: 'Lights, music, crowd control. Christmas on Orchard Road is a full-time job.',
  faiz: 'Good evening. Clear skies tonight, light winds from the east. Perfect for flying.',
  ubin: 'Twelve people, then we go. Pulau Ubin waits for nobody, but the boat waits for twelve.',
  ciku: 'Darling, is that a real pearl? No? Then I am not interested.',
  ayu: 'Every bike checked, every bell rings. Mind the boars on Jalan Mamam, they don’t give way.',
  lan: 'The gongs start at dusk. Come early, the front bench fills up with aunties.',
  belangkas: 'Four hundred million years on this planet, and still people step on us. Watch your feet on the flats.',
  taring: 'Hmph. A Tusker never says sorry. He just digs somewhere else.',
  biru: 'Hup! Hup! Paddles in together or the boat goes round in circles. Ask my Tuesday crew.',
  tenuk: 'Forty thousand fans, six gates, one manager. Calmly. Everything is fine. Calmly.',
  kubung: 'The flying boats came down right there on the basin, in 1937. You could hear them from Geylang.',
  sutera: 'Such a pretty little basin, darlings. I shan’t be staying long.',
  kongkang: 'Slowly… slowly. On my trails… slow is… fast.',
  enggang: 'Mind your hair, darling: the lories think everything is a perch.',
  bintu: 'Yes, I smell of popcorn. All binturongs do. No, you may not eat me.',
  hantu: 'My owls see everything after dark. Everything is extra.',
};

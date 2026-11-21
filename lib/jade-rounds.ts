// Jade Street, the twentieth pass's new job step: `rounds`, a round of drop-offs. You set out carrying the round (a
// stack of garlands, a bakery box, the songbird cages, bowls of laksa) and hand one over at each stop: E beside it plays
// the step's own pose (a bowl held out, a garland draped over a doorway, a cage hooked up high), and the gold line goes
// on to the nearest stop still waiting. Each stop shows who waits there (a townsfolk with what they want in a bubble)
// or, for a hook or a shrine, a soft ring with the thing ghosted in it. A `time` limit (longer on Assist) is the
// customers getting fed up. Side jobs in lib/jade-gigs20.ts and Hawker Tales use it. No DOM; deterministic.
import { dist } from './jade-rng.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Near } from './jade-game.js';

type Rounds = Extract<Step, { t: 'rounds' }>;
/** how near a stop E reaches (world units) */
export const DROP_R = 84;
/** each act's verb, as the prompt and the HUD say it ("Hang the songbird cage") */
export const VERB: Record<Rounds['act'], string> = { serve: 'Hand over', drape: 'Drape', hang: 'Hang' };
/** how long each pose plays (seconds) */
export const ACT_DUR: Record<Rounds['act'], number> = { serve: 0.8, drape: 1.0, hang: 1.1 };

const left = (run: Run) => run.items.filter(it => !it.got);
function nearest(run: Run) {
  const p = run.w.p; let best: Run['items'][number] | null = null, bd = 1e9;
  for (const it of run.items) if (!it.got) { const d = dist(it.x, it.y, p.x, p.y); if (d < bd) { bd = d; best = it; } }
  return best;
}
/** the progress counter's word for each act ("Hung 2/4") */
const DONE: Record<Rounds['act'], string> = { serve: 'Served', drape: 'Draped', hang: 'Hung' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function roundsEnter(run: Run, st: Step): boolean {
  if (st.t !== 'rounds') return false;
  const w = run.w;
  run.items = st.drops.map((s, i) => { const [x, y] = run.spot(s); return { x, y, got: false, sprite: st.item, marks: st.who ? [st.who[i % st.who.length]] : undefined }; });
  run.progress = `${DONE[st.act]} 0/${st.drops.length}`;
  run.timer = st.time * (run.assist ? 1.4 : 1) * w.diff.timer;
  if (!w.p.carry) w.p.carry = st.item;
  return true;
}
export function roundsStep(run: Run, st: Step): boolean {
  if (st.t !== 'rounds') return false;
  const w = run.w, p = w.p, it = nearest(run);
  if (!it) return true;
  const d = dist(it.x, it.y, p.x, p.y);
  if (d < DROP_R && p.ride) run.label = `Hop off (E), then ${VERB[st.act].toLowerCase()} the ${st.what}`;
  else run.label = d < DROP_R ? `E: ${VERB[st.act].toLowerCase()} the ${st.what}` : st.label;
  return true;
}
export function roundsNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, p = run.w.p; if (!st || st.t !== 'rounds' || p.ride || p.act) return null;
  let k = -1, bd = DROP_R;
  run.items.forEach((it, i) => { if (!it.got) { const d = dist(it.x, it.y, x, y); if (d < bd) { bd = d; k = i; } } });
  if (k < 0) return null;
  const it = run.items[k];
  return { kind: 'job', label: `${VERB[st.act]} the ${st.what}`, x: it.x, y: it.y, id: `drop:${k}` };
}
export function roundsAct(run: Run, id: string): boolean {
  const st = run.cur, w = run.w, p = w.p; if (!st || st.t !== 'rounds' || p.act || !id.startsWith('drop:')) return false;
  const it = run.items[+id.split(':')[1]]; if (!it || it.got) return true;
  p.b.speed = 0; p.face = it.y < p.y - 20 && st.act === 'hang' ? 'up' : 'down';
  p.act = { n: st.act, t: 0, dur: ACT_DUR[st.act], then: () => {
    if (it.got || run.cur !== st) return; it.got = true;
    const n = run.items.length, got = n - left(run).length;
    run.progress = `${DONE[st.act]} ${got}/${n}`;
    w.fx.push({ t: 'deliver', x: it.x, y: it.y });
    if (got >= n) { p.carry = null; w.say(`Every ${st.what} handed over!`, 'good'); run.next(); return; }
    w.say(`${cap(st.what)} ${got} of ${n}: ${n - got} to go`, 'good');
  } };
  return true;
}
/** where the route arrow points: the nearest stop still waiting */
export function roundsTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur; if (!st || st.t !== 'rounds') return undefined;
  const it = nearest(run); return it ? [it.x, it.y] : null;
}
/** what the failure card says when the round runs out of time */
export const roundsTimeUp = (st: Rounds) => `Out of time! Follow the gold line from stop to stop and press E the moment the prompt shows: every ${st.what} counts.`;

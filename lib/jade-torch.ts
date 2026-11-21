// Jade Street, the nineteenth pass's new job step: `torch`, a lights-off night trail at the Night Safari. The lights go
// out and only your torch's circle is lit; glowing trail studs and a marker lead you on, one marker at a time (the gold
// route line still shows the way). Night animals rest by the trail (a fishing cat, a pangolin, a porcupine, a flying
// squirrel): out of the torchlight you see only their eyes shining, and a faint ring shows how far they can hear. Inside
// that ring, running (anything faster than a creep: hold Shift) fills the animal's Stir meter; standing still or creeping
// lets it settle. Full, it wakes and bolts into the dark, and you go back to the last marker you reached (a few seconds
// lost) while it settles again. Assist (on by default) shrinks the rings and slows the stirring; Hard widens and quickens
// them. Its own hero poses: creeping by torch, listening, startled. No DOM; deterministic.
import { dist } from './jade-rng.js';
import { FOOT } from './jade-move.js';
import type { Run } from './jade-mission.js';
import type { Step, Beast } from './jade-story.js';

type Torch = Extract<Step, { t: 'torch' }>;
/** an animal by the trail: where it rests, how stirred it is (0..1), seconds into a bolt (-1 resting), seconds still away */
export type BeastState = { x: number; y: number; kind: Beast; alarm: number; bolt: number; away: number };
export type TorchState = { beasts: BeastState[]; k: number; back: [number, number]; grace: number; bolts: number; t: number; startle: number };
/** what each animal is called on the HUD, and what it is doing */
export const BEAST_NAME: Record<Beast, string> = { fcat: 'fishing cat', pango: 'Sunda pangolin', porc: 'porcupine', squir: 'flying squirrel' };
const BEAST_DOING: Record<Beast, string> = { fcat: 'dozing', pango: 'curled up asleep', porc: 'snuffling about', squir: 'resting on a low branch' };
/** how far an animal hears a runner (world units) and how fast it stirs (a meter a second) on Normal; Assist and Hard */
export const TORCH = { ear: 150, earAssist: 128, earHard: 172, stir: 0.7, stirAssist: 0.42, stirHard: 1.0, settle: 0.4,
  /** how near a marker counts, the seconds a bolt costs, the seconds an animal stays away after bolting, the torch's light */
  reach: 64, lose: 6, away: 7, light: 230 } as const;
const ST = new WeakMap<Run, TorchState>();
export const torchOf = (run: Run) => ST.get(run) ?? null;
export const earOf = (run: Run) => run.assist ? TORCH.earAssist : run.w.s.settings.diff === 'hard' ? TORCH.earHard : TORCH.ear;
const stirOf = (run: Run) => (run.assist ? TORCH.stirAssist : run.w.s.settings.diff === 'hard' ? TORCH.stirHard : TORCH.stir) * run.mercy();
/** moving faster than a creep (a run, a dash, a hop) */
const loud = (run: Run) => { const p = run.w.p; return p.air || p.dashT > 0 || p.b.speed > FOOT.walk + 15; };

export function torchEnter(run: Run, st: Step): boolean {
  if (st.t !== 'torch') return false;
  const p = run.w.p;
  ST.set(run, { beasts: st.beasts.map(b => { const [x, y] = run.spot(b.at); return { x, y, kind: b.kind, alarm: 0, bolt: -1, away: 0 }; }), k: 0, back: [p.x, p.y], grace: 1.5, bolts: 0, t: 0, startle: 0 });
  run.progress = `Markers 0/${st.route.length}`;
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  run.meter = { name: 'Stir', v: 0 };
  run.w.say('Lights out. Follow the glowing studs by torch, and creep (hold Shift) past anything resting by the trail.', 'good');
  return true;
}
/** the animal whose hearing you are in (or nearest to it), and how far */
function nearest(run: Run, c: TorchState): [BeastState | null, number] {
  const p = run.w.p; let best: BeastState | null = null, bd = 1e9;
  for (const b of c.beasts) { if (b.bolt >= 0) continue; const d = dist(b.x, b.y, p.x, p.y); if (d < bd) { bd = d; best = b; } }
  return [best, bd];
}
export function torchStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'torch') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p; c.t += dt; c.grace = Math.max(0, c.grace - dt); c.startle = Math.max(0, c.startle - dt);
  if (p.ride) { run.label = 'Hop off (E): the trail is walked on foot'; return true; }
  const ear = earOf(run), noisy = loud(run);
  // the animals: stir while a runner is in earshot, settle otherwise; a bolting one runs off into the dark, then comes back
  for (const b of c.beasts) {
    if (b.bolt >= 0) { b.bolt += dt; if (b.bolt > 1.2) { b.away -= dt; if (b.away <= 0) { b.bolt = -1; b.alarm = 0; } } continue; }
    const d = dist(b.x, b.y, p.x, p.y);
    if (d < ear && noisy && c.grace <= 0 && !p.act) b.alarm = Math.min(1, b.alarm + stirOf(run) * dt * (d < ear * 0.5 ? 1.4 : 1));
    else b.alarm = Math.max(0, b.alarm - TORCH.settle * dt);
    if (b.alarm >= 1) {
      // it wakes and bolts: you jump back startled, and start the leg again from the last marker
      b.bolt = 0; b.away = TORCH.away; c.bolts++; run.hits++;
      p.b.speed = 0; p.face = 'down'; c.startle = 1.6;
      p.act = { n: 'torch-startle', t: 0, dur: 0.8, then: () => { w.placePlayer(c.back[0], c.back[1]); c.grace = 1.5; } };
      if (run.timer !== null) run.timer = Math.max(0.5, run.timer - TORCH.lose);
      w.fx.push({ t: 'torch-bolt', x: b.x, y: b.y });
      w.say(c.bolts === 1 ? `Too loud! The ${BEAST_NAME[b.kind]} woke and bolted. Back to the last marker: this time hold Shift and creep past.` : `The ${BEAST_NAME[b.kind]} bolted! Back to the last marker, -${TORCH.lose} s`, 'bad');
      return true;
    }
  }
  const [nb, nd] = nearest(run, c);
  run.meter = { name: 'Stir', v: nb && nd < ear + 60 ? nb.alarm : 0, bad: !!nb && nb.alarm > 0.5 };
  // the markers, one at a time
  const [mx, my] = run.spot(st.route[c.k]);
  if (dist(mx, my, p.x, p.y) < TORCH.reach) {
    c.k++; c.back = [mx, my]; run.progress = `Markers ${c.k}/${st.route.length}`;
    if (c.k >= st.route.length) { finish(run, c); return true; }
    w.fx.push({ t: 'torch-mark', x: mx, y: my });
  }
  // the words: an animal in earshot (or about to be), or the way on
  if (c.startle > 0) run.label = 'Shh… back at the last marker. Creep (hold Shift) past the animal this time';
  else if (nb && nd < ear + 90) {
    const name = BEAST_NAME[nb.kind];
    run.label = nb.alarm > 0.45 ? `The ${name} is stirring! Hold Shift and creep, or stand still till it settles`
      : nd < ear ? (noisy ? `Shh! A ${name} is ${BEAST_DOING[nb.kind]} right here: hold Shift to creep past` : `Creeping past the ${name}… keep holding Shift`)
      : `Shh! A ${name} is ${BEAST_DOING[nb.kind]} by the trail ahead: creep past (hold Shift)`;
  } else run.label = st.label;
  return true;
}
function finish(run: Run, c: TorchState) {
  const w = run.w; w.s.stats.torches++;
  w.say(c.bolts === 0 ? 'Through the dark without waking a thing. Softly, softly!' : 'Through the dark to the end of the trail!', 'good');
  run.next();
}
/** where the route arrow points: the next marker */
export function torchTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'torch' || !c) return undefined;
  return run.spot(st.route[Math.min(c.k, st.route.length - 1)]);
}

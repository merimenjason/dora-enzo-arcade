// Jade Street: medals for the story jobs. Each job has three marks, shown before you start: finish under its par
// time, keep the lanterns dark (no heat beyond what the job itself asks for), and finish without a retry. One mark
// is bronze, two silver, all three gold; a finish with none is still a finish. The seventh pass reworked thirteen
// jobs (and added three Hawker Tales) around the new job steps; their pars were set again from the solver. Par times are about 1.7
// times the scripted solver's time from the safe house (tests/jade-bot.mjs prints it), rounded to five seconds.
import { MISSIONS, type Mission } from './jade-story.js';

export const PAR: Record<string, number> = {
  // Hawker Tales
  k1: 40, k2: 65, k3: 80, k4: 130, k5: 60, k6: 75, k7: 130, k8: 80, k9: 60, k10: 85,
  // the island (chapter six), about 1.7 times the solver's time
  m26: 85, m27: 140, m28: 110, m29: 70, m30: 55, m31: 220, m32: 60, m33: 80, m34: 75, m35: 65,
  m1: 30, m2: 55, m3: 65, m4: 120, m5: 45, m6: 65, m7: 55, m8: 105, m9: 70, m10: 50,
  m11: 80, m12: 90, m13: 60, m14: 85, m15: 75, m16: 70, m17: 150, m18: 80, m19: 60, m20: 60,
  m21: 105, m22: 85, m23: 110, m24: 170, m25: 105,
  // Lights by the Lake (chapter nine) and its Hawker Tales, about 1.7 times the solver's time
  m56: 85, m57: 180, m58: 200, m59: 205, m60: 255, m61: 215, m62: 195, m63: 185, m64: 210, m65: 165, k17: 165, k18: 190, k19: 165,
  // the sixteenth pass's ride jobs (1.7 times the solver, like the rest)
  k20: 80, k21: 35, k22: 170, k23: 55,
  // Kampong Spirit (chapter ten, the seventeenth pass) and its Hawker Tales: 2.5 times the slower of the casual and
  // normal solvers (they read the boar trails as a person does), at least a minute; m66 includes the bumboat crossing
  m66: 320, m67: 60, m68: 60, m69: 160, m70: 60, m71: 70, m72: 285, m73: 110, m74: 60, m75: 145, k24: 60, k25: 60, k26: 60,
  // Kallang Roar (chapter eleven, the eighteenth pass) and its Hawker Tales: 2.5 times the slower of the casual and normal
  // solvers (they wait at the crowd's edge for a gap as a person does), at least a minute
  m76: 60, m77: 70, m78: 60, m79: 110, m80: 60, m81: 185, m82: 120, m83: 60, m84: 60, m85: 130, k27: 60, k28: 85, k29: 60,
};
export const MEDAL_NAME = ['Finished', 'Bronze', 'Silver', 'Gold'] as const;
export const MEDAL_SPRITE = ['ui-medal-none', 'ui-medal-bronze', 'ui-medal-silver', 'ui-medal-gold'] as const;
/** the most heat a job may reach and still count as keeping the lanterns dark */
/** (a heist may go loud: its getaway lights three lanterns, so three is allowed; a quiet one keeps them all dark) */
export const heatAllowed = (m: Mission) => Math.max(0, ...m.steps.map(s => s.t === 'heat' ? s.level : s.t === 'heist' ? 3 : 0));
export type Result = { time: number; maxHeat: number; retries: number };
export function marks(m: Mission, r: Result) {
  return { time: r.time <= (PAR[m.id] ?? 120), heat: Math.floor(r.maxHeat) <= heatAllowed(m), clean: r.retries === 0 };
}
export function medalOf(m: Mission, r: Result): number { const k = marks(m, r); return (k.time ? 1 : 0) + (k.heat ? 1 : 0) + (k.clean ? 1 : 0); }
export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/** the three marks as words, for the job offer and the jobs book */
export function goals(m: Mission): string[] {
  const h = heatAllowed(m);
  return [`Under ${fmtTime(PAR[m.id] ?? 120)}`, h ? `No more than ${h} lanterns` : 'No lanterns lit', 'No retries'];
}
export const JOB_IDS = MISSIONS.map(m => m.id);

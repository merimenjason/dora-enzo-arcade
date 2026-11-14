// Jade Street: medals for the story jobs. Each job has three marks, shown before you start: finish under its par
// time, keep the lanterns dark (no heat beyond what the job itself asks for), and finish without a retry. One mark
// is bronze, two silver, all three gold; a finish with none is still a finish. Par times are about 1.7
// times the scripted solver's time from the safe house (tests/jade-bot.mjs prints it), rounded to five seconds.
import { MISSIONS, type Mission } from './jade-story.js';

export const PAR: Record<string, number> = {
  m1: 30, m2: 55, m3: 65, m4: 120, m5: 45, m6: 65, m7: 55, m8: 105, m9: 70, m10: 50,
  m11: 80, m12: 155, m13: 60, m14: 85, m15: 75, m16: 70, m17: 95, m18: 80, m19: 60, m20: 60,
  m21: 105, m22: 85, m23: 110, m24: 135, m25: 105,
};
export const MEDAL_NAME = ['Finished', 'Bronze', 'Silver', 'Gold'] as const;
export const MEDAL_SPRITE = ['ui-medal-none', 'ui-medal-bronze', 'ui-medal-silver', 'ui-medal-gold'] as const;
/** the most heat a job may reach and still count as keeping the lanterns dark */
export const heatAllowed = (m: Mission) => Math.max(0, ...m.steps.map(s => s.t === 'heat' ? s.level : 0));
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

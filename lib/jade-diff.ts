// Jade Street: the three difficulties. Easy (the default, with Assist) is gentle; Normal has quicker wardens who see
// further and take longer to shake, tighter timers and faster rivals and thieves; Hard tightens all of it again and
// sends one more warden per lantern. Assist is separate and stacks on top (lib/jade-mission.ts, lib/jade-heat.ts).
export type Diff = 'easy' | 'normal' | 'hard';
export const DIFFS: Diff[] = ['easy', 'normal', 'hard'];
export type DiffNumbers = {
  /** seconds out of sight to put a lantern out */ evade: number;
  /** warden bike top speed (plus 12 a lantern) */ warden: number;
  /** wardens per lantern: lanterns + this (at least 1, at most 4) */ extra: number;
  /** seconds a warden needs beside you on foot to catch you */ grab: number;
  /** blimp speed */ blimp: number;
  /** how far wardens see */ sight: number;
  /** job timers are multiplied by this */ timer: number;
  /** chase targets' speed */ chase: number;
  /** race rivals' speed */ rival: number;
  /** lookouts' and Pip's range and how fast they grow suspicious */ look: number;
  /** how long a chase target may stay out of reach before it escapes */ lost: number;
  /** heat from crashing into traffic, times the base */ crash: number;
  /** heat for riding through a red light (0: the lights don't care) */ redLight: number;
};
export const DIFF: Record<Diff, DiffNumbers> = {
  easy: { evade: 3.2, warden: 205, extra: -1, grab: 0.35, blimp: 150, sight: 520, timer: 1, chase: 1, rival: 1, look: 1, lost: 1, crash: 1, redLight: 0 },
  normal: { evade: 5.4, warden: 256, extra: 0, grab: 0.2, blimp: 190, sight: 580, timer: 0.6, chase: 1.08, rival: 1.05, look: 1.16, lost: 0.6, crash: 2, redLight: 0.55 },
  hard: { evade: 6.6, warden: 276, extra: 1, grab: 0.15, blimp: 215, sight: 620, timer: 0.5, chase: 1.12, rival: 1.08, look: 1.22, lost: 0.5, crash: 3, redLight: 0.8 },
};
export const DIFF_NAME: Record<Diff, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const asDiff = (v: unknown): Diff => v === 'normal' || v === 'hard' ? v : 'easy';

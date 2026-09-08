import {
  Rng,
  makeDay,
  makeTraveler,
  violations,
  FLAG_TEXT,
  rentFor,
  type Flag,
} from './checkpoint-game.js';
export const REASONS: Record<Flag, string> = {
  permit: 'Missing permit',
  name: 'Identity mismatch',
  region: 'Region discrepancy',
  expired: 'Expired permit',
  weight: 'Weight discrepancy',
  seal: 'Missing seal',
  species: 'Species restriction',
  purpose: 'Purpose restriction',
};
export const PROVISIONS = {
  basic: {
    label: 'Shared hay',
    cost: 3,
    seconds: 0,
    description: 'A modest meal. Keep your savings.',
  },
  warm: {
    label: 'Warm supper',
    cost: 7,
    seconds: 20,
    description: 'Rested inspectors gain 20 seconds tomorrow.',
  },
} as const;
export type Provision = keyof typeof PROVISIONS;
export class RemakeGame {
  state: 'briefing' | 'shift' | 'report' | 'ending' = 'briefing';
  rng: Rng;
  day = makeDay(1);
  traveler;
  credits = 24;
  processed = 0;
  citations = 0;
  total = 0;
  correctTotal = 0;
  remaining = 150;
  timed = false;
  bonus = 0;
  settled = false;
  rentPaid = 0;
  mealPaid = 0;
  selected: Flag[] = [];
  verdict: null | {
    approved: boolean;
    correct: boolean;
    text: string;
    flags: Flag[];
  } = null;
  log: string[] = [];
  constructor(seed = 1909) {
    this.rng = new Rng(seed);
    this.traveler = makeTraveler(this.day, this.rng);
  }
  begin(timed = this.timed) {
    if (this.state !== 'briefing') return;
    this.timed = timed;
    this.remaining = 150 + this.bonus;
    this.state = 'shift';
  }
  toggle(flag: Flag) {
    if (this.state !== 'shift' || this.verdict) return;
    this.selected = this.selected.includes(flag)
      ? this.selected.filter((f) => f !== flag)
      : [...this.selected, flag];
  }
  decide(approved: boolean) {
    if (
      this.state !== 'shift' ||
      this.verdict ||
      (!approved && !this.selected.length)
    )
      return null;
    const flags = violations(this.traveler.papers, this.day);
    const correct = approved
      ? flags.length === 0
      : flags.length > 0 && this.selected.every((f) => flags.includes(f));
    this.processed++;
    this.total++;
    if (correct) this.correctTotal++;
    else this.citations++;
    this.credits += correct ? 6 : -3;
    const text = correct
      ? approved
        ? 'Entry granted. All documents are in order.'
        : 'Denial supported by the evidence. ' +
          this.selected.map((f) => FLAG_TEXT[f]).join(' ')
      : flags.length
        ? 'Citation. ' + flags.map((f) => FLAG_TEXT[f]).join(' ')
        : 'Citation. This traveler meets every current requirement.';
    this.verdict = { approved, correct, text, flags };
    this.log.push(
      `${this.traveler.papers.name} · ${approved ? 'admitted' : 'returned'} · ${correct ? '+6' : '−3'} credits`,
    );
    return this.verdict;
  }
  next() {
    if (this.state !== 'shift' || !this.verdict) return;
    this.verdict = null;
    this.selected = [];
    if (this.processed >= this.day.quota || this.remaining <= 0) {
      this.end();
      return;
    }
    this.traveler = makeTraveler(this.day, this.rng);
  }
  tick(seconds: number) {
    if (
      this.state !== 'shift' ||
      !this.timed ||
      !Number.isFinite(seconds) ||
      seconds < 0
    )
      return;
    this.remaining = Math.max(0, this.remaining - seconds);
    if (this.remaining === 0 && !this.verdict) this.end();
  }
  end() {
    if (this.state !== 'shift') return;
    this.state = 'report';
    this.settled = false;
    this.rentPaid = rentFor(this.day.day);
    this.credits -= this.rentPaid;
    this.mealPaid = 0;
  }
  settle(meal: Provision) {
    if (this.state !== 'report' || this.settled) return false;
    const p = PROVISIONS[meal];
    if (this.credits < p.cost) return false;
    this.credits -= p.cost;
    this.mealPaid = p.cost;
    this.bonus = p.seconds;
    this.settled = true;
    return true;
  }
  nextDay() {
    if (this.state !== 'report' || (!this.settled && this.credits >= 3)) return;
    if (this.day.day >= 7 || this.credits < 0 || !this.settled) {
      this.state = 'ending';
      return;
    }
    this.day = makeDay(this.day.day + 1);
    this.processed = 0;
    this.citations = 0;
    this.selected = [];
    this.verdict = null;
    this.traveler = makeTraveler(this.day, this.rng);
    this.state = 'briefing';
  }
  get accuracy() {
    return this.total
      ? Math.round((this.correctTotal / this.total) * 100)
      : 100;
  }
  get ending() {
    return this.credits < 0 || !this.settled
      ? 'The lights go out.'
      : 'A little further north.';
  }
}
// All route coordinates are world-space. Models face +Z. Turns happen while stationary.
export const STATION = { x: 0, z: 0 };
export const EXIT_PATH = [
  { x: 0, z: -1.5 },
  { x: 4, z: -1.5 },
  { x: 8, z: -1.5 },
];
export function routePose(approved: boolean, seconds: number) {
  const points = approved
    ? [STATION, ...EXIT_PATH]
    : [STATION, { x: 0, z: -6 }];
  let time = Math.max(0, seconds),
    heading = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      angle = Math.atan2(b.x - a.x, b.z - a.z),
      delta = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
    if (time < 0.6)
      return {
        x: a.x,
        z: a.z,
        heading: heading + delta * (time / 0.6),
        walking: false,
        done: false,
      };
    time -= 0.6;
    heading = angle;
    const duration = Math.hypot(b.x - a.x, b.z - a.z) / 1.8;
    if (time < duration) {
      const f = time / duration;
      return {
        x: a.x + (b.x - a.x) * f,
        z: a.z + (b.z - a.z) * f,
        heading,
        walking: true,
        done: false,
      };
    }
    time -= duration;
  }
  return { ...points[points.length - 1], heading, walking: false, done: true };
}

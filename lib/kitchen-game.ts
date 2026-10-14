/** Deterministic order-owned kitchen jobs. No shared inventory or double-serving. */
export const SAVE_KEY = 'midnight-kitchen-v1';
export const CREW = [
  { name: 'Dora', perk: 'Quick whisk', rates: [0.75, 1, 0.9] },
  { name: 'Enzo', perk: 'Swift service', rates: [1, 1, 0.65] },
  { name: 'Pip', perk: 'Pastry paws', rates: [0.65, 1.1, 1] },
  { name: 'Ember', perk: 'Hearth master', rates: [1, 0.65, 0.95] },
];
export const RECIPES = [
  { name: 'Clover crisp', times: [3, 4, 2] },
  { name: 'Moonberry tart', times: [4, 6, 2] },
  { name: 'Herbal tea', times: [2, 3, 2] },
  { name: 'Honey pastry', times: [5, 7, 2] },
  { name: 'Garden wrap', times: [4, 3, 2] },
];
export const SHIFTS = [
  'First lantern',
  'Berry welcome',
  'Tea at twilight',
  'Pastry parade',
  'Moonlit market',
  'A knock at midnight',
  'Clover gathering',
  'Garden supper',
  'Starfall festival',
  'The travelling troupe',
  'Last lanterns',
  'The midnight feast',
];
export type Profile = {
  version: 1;
  coins: number;
  unlocked: number;
  stars: number[];
  scores: number[];
  upgrades: number[];
};
export const freshProfile = (): Profile => ({
  version: 1,
  coins: 0,
  unlocked: 1,
  stars: Array(12).fill(0),
  scores: Array(12).fill(0),
  upgrades: [0, 0, 0],
});
const integer = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.floor(v)))
    : 0;
export function parseProfile(raw: string | null): Profile {
  try {
    const p = JSON.parse(raw ?? 'null');
    if (!p || p.version !== 1) return freshProfile();
    const arr = (v: unknown, n: number, m: number) =>
      Array.from({ length: n }, (_, i) =>
        integer(Array.isArray(v) ? v[i] : 0, m),
      );
    return {
      version: 1,
      coins: integer(p.coins, 1000000),
      unlocked: Math.max(1, integer(p.unlocked, 12)),
      stars: arr(p.stars, 12, 3),
      scores: arr(p.scores, 12, 1000000),
      upgrades: arr(p.upgrades, 3, 3),
    };
  } catch {
    return freshProfile();
  }
}
export function upgradeCost(p: Profile, i: number) {
  return 90 + 60 * p.upgrades[i];
}
export function buyUpgrade(p: Profile, i: number): Profile {
  if (i < 0 || i > 2 || p.upgrades[i] >= 3 || p.coins < upgradeCost(p, i))
    return p;
  return {
    ...p,
    coins: p.coins - upgradeCost(p, i),
    upgrades: p.upgrades.map((v, j) => (j === i ? v + 1 : v)),
  };
}
export type Stage =
  | 'new'
  | 'preparing'
  | 'prepared'
  | 'baking'
  | 'ready'
  | 'delivering';
export type Order = {
  id: number;
  recipe: number;
  customer: number;
  stage: Stage;
  patience: number;
  maxPatience: number;
};
export type Job = {
  order: number;
  crew: number;
  kind: number;
  remaining: number;
  duration: number;
};
export type Result = { won: boolean; stars: number; coins: number };
export class Kitchen {
  time = 0;
  duration: number;
  goal: number;
  served = 0;
  missed = 0;
  score = 0;
  combo = 0;
  lastServe = -100;
  orders: Order[] = [];
  jobs: Job[] = [];
  ended = false;
  result: Result | null = null;
  bellUntil = 0;
  bellReady = 0;
  events: ('arrive' | 'done' | 'serve' | 'miss' | 'bell' | 'end')[] = [];
  private seed: number;
  private nextId = 1;
  private arrival = 6;
  readonly upgrades: number[];
  constructor(
    readonly shift = 0,
    readonly cozy = false,
    upgrades: number[] = [0, 0, 0],
    seed = 417,
  ) {
    this.seed = seed >>> 0;
    this.upgrades = [...upgrades];
    this.duration = 90 + Math.floor(shift / 4) * 15;
    this.goal = 5 + shift;
    this.add();
    this.add();
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private add() {
    const maxRecipe = Math.min(5, 2 + Math.floor(this.shift / 2));
    const patience = 54 - this.shift * 1.5 + this.upgrades[2] * 4;
    this.orders.push({
      id: this.nextId++,
      recipe: Math.floor(this.random() * maxRecipe),
      customer: Math.floor(this.random() * 20),
      stage: 'new',
      patience,
      maxPatience: patience,
    });
    this.events.push('arrive');
  }
  canAdvance(o: Order) {
    const kind =
      o.stage === 'new'
        ? 0
        : o.stage === 'prepared'
          ? 1
          : o.stage === 'ready'
            ? 2
            : -1;
    return (
      kind >= 0 &&
      !this.ended &&
      (kind !== 1 ||
        this.jobs.filter((j) => j.kind === 1).length <
          (this.upgrades[1] >= 2 ? 2 : 1))
    );
  }
  advance(id: number, selected = -1): string {
    const o = this.orders.find((x) => x.id === id);
    if (!o || this.ended) return 'That order has left.';
    if (!this.canAdvance(o))
      return o.stage === 'prepared'
        ? 'The oven rack is occupied.'
        : 'Already being prepared.';
    const kind = o.stage === 'new' ? 0 : o.stage === 'prepared' ? 1 : 2;
    const free = CREW.map((_, i) => i).filter(
      (i) => !this.jobs.some((j) => j.crew === i),
    );
    const crew =
      selected < 0
        ? free.sort((a, b) => CREW[a].rates[kind] - CREW[b].rates[kind])[0]
        : free.includes(selected)
          ? selected
          : undefined;
    if (crew === undefined)
      return 'That chef is busy. Choose Auto crew or a free chef.';
    const duration =
      RECIPES[o.recipe].times[kind] *
      CREW[crew].rates[kind] *
      Math.pow(0.9, this.upgrades[kind]);
    this.jobs.push({ order: id, crew, kind, remaining: duration, duration });
    o.stage = (['preparing', 'baking', 'delivering'] as Stage[])[kind];
    return '';
  }
  bell() {
    if (this.ended || this.time < this.bellReady) return false;
    this.bellUntil = this.time + 5;
    this.bellReady = this.time + 22;
    this.orders.forEach(
      (o) => (o.patience = Math.min(o.maxPatience, o.patience + 4)),
    );
    this.events.push('bell');
    return true;
  }
  tick(dt: number) {
    if (this.ended || !Number.isFinite(dt) || dt <= 0) return;
    let rest = Math.min(dt, 60);
    while (rest > 0 && !this.ended) {
      const step = Math.min(rest, 0.05);
      this.step(step);
      rest -= step;
    }
  }
  private step(dt: number) {
    this.time += dt;
    for (const o of this.orders) {
      if (!this.cozy) o.patience -= dt;
      if (o.patience <= 0) {
        this.orders = this.orders.filter((x) => x !== o);
        this.jobs = this.jobs.filter((j) => j.order !== o.id);
        this.missed++;
        this.combo = 0;
        this.events.push('miss');
      }
    }
    for (const j of this.jobs) {
      j.remaining -= dt * (this.time < this.bellUntil ? 1.5 : 1);
      if (j.remaining > 0) continue;
      this.jobs = this.jobs.filter((x) => x !== j);
      const o = this.orders.find((x) => x.id === j.order);
      if (!o) continue;
      if (j.kind < 2) {
        o.stage = j.kind === 0 ? 'prepared' : 'ready';
        this.events.push('done');
      } else {
        this.orders = this.orders.filter((x) => x !== o);
        this.served++;
        this.combo =
          this.time - this.lastServe <= 10 ? Math.min(5, this.combo + 1) : 1;
        this.lastServe = this.time;
        this.score +=
          40 + Math.floor((30 * o.patience) / o.maxPatience) + this.combo * 5;
        this.events.push('serve');
      }
    }
    this.arrival -= dt;
    if (this.arrival <= 0) {
      if (this.orders.length < 4) this.add();
      this.arrival = Math.max(3.5, 7 - this.shift * 0.25);
    }
    if (!this.cozy && this.time >= this.duration) this.finish();
  }
  finish() {
    if (this.ended) return;
    this.ended = true;
    const won = this.served >= this.goal;
    const stars = this.cozy
      ? 0
      : won
        ? 1 +
          (this.missed === 0 ? 1 : 0) +
          (this.served >= this.goal + 2 ? 1 : 0)
        : 0;
    this.result = {
      won,
      stars,
      coins: this.cozy ? 0 : this.served * (won ? 5 : 3) + stars * 10,
    };
    this.events.push('end');
  }
}
export function settle(p: Profile, g: Kitchen): Profile {
  if (!g.result || g.cozy) return p;
  const stars = [...p.stars],
    scores = [...p.scores];
  stars[g.shift] = Math.max(stars[g.shift], g.result.stars);
  scores[g.shift] = Math.max(scores[g.shift], g.score);
  return {
    ...p,
    coins: p.coins + g.result.coins,
    unlocked: Math.max(
      p.unlocked,
      g.result.won ? Math.min(12, g.shift + 2) : 1,
    ),
    stars,
    scores,
  };
}

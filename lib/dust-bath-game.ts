/** Pure, seeded spa simulation. All durations are seconds; no DOM or wall clock. */
export type Mode = 'shift' | 'cozy';
export type Upgrade =
  | 'towels'
  | 'scoop'
  | 'decor'
  | 'thermo'
  | 'dryer'
  | 'lounge';
export type Temp = 'cool' | 'mild' | 'toasty';
export type Grain = 'fine' | 'medium' | 'coarse';
export type Stage = 'pour' | 'scrub' | 'fluff' | 'style';

/** Ordered bath stages. Regular guests use the first three, VIPs all four. */
export const STAGES: Stage[] = ['pour', 'scrub', 'fluff', 'style'];
export const STAGE_INFO: Record<Stage, { label: string; hint: string }> = {
  pour: { label: 'Pour', hint: 'Pour the warm dust' },
  scrub: { label: 'Scrub', hint: 'Work up a soft fluff' },
  fluff: { label: 'Fluff', hint: 'Fluff the coat sky-high' },
  style: { label: 'Style', hint: 'A little finishing flourish' },
};
/** Per-stage base sweet-spot window [low, high] on the 0..1 charge scale. */
const SPOT: Record<Stage, [number, number]> = {
  pour: [0.56, 0.8],
  scrub: [0.6, 0.82],
  fluff: [0.64, 0.86],
  style: [0.68, 0.88],
};
export const TEMPS: Temp[] = ['cool', 'mild', 'toasty'];
export const GRAINS: Grain[] = ['fine', 'medium', 'coarse'];

export const SHOP: Record<
  Upgrade,
  { name: string; cost: number; description: string; icon: string }
> = {
  towels: {
    name: 'Cloud towels',
    cost: 28,
    description: 'Wider sweet spot on every stage and half the splash mess.',
    icon: '▤',
  },
  scoop: {
    name: 'Golden scoop',
    cost: 34,
    description: 'Enzo refills in 1 second instead of 3, and carries 8 dust.',
    icon: '✧',
  },
  decor: {
    name: 'Fern sanctuary',
    cost: 30,
    description: 'A leafy spa and +12 seconds of patience for every guest.',
    icon: '❧',
  },
  thermo: {
    name: 'Crystal thermometer',
    cost: 48,
    description: 'Reveals each guest’s temp & grain wish and softens timing.',
    icon: '❂',
  },
  dryer: {
    name: 'Warm-air dryer',
    cost: 55,
    description: 'Fluff and style stages get a much wider, forgiving window.',
    icon: '❉',
  },
  lounge: {
    name: 'Skylight lounge',
    cost: 80,
    description: 'Opens a fourth dust bath so you can pamper more at once.',
    icon: '⌂',
  },
};

export interface Breed {
  id: string;
  label: string;
  color: string;
  belly: string;
  patch: boolean;
  temp: Temp;
  grain: Grain;
  patience: number;
  tip: number;
  stages: number;
  vip: boolean;
  quirk: string;
}
/** Six chinchilla varieties with distinct wishes, patience and tipping. */
export const BREEDS: Breed[] = [
  {
    id: 'grey',
    label: 'Standard grey',
    color: '#9aa6ad',
    belly: '#e8ecee',
    patch: false,
    temp: 'mild',
    grain: 'medium',
    patience: 46,
    tip: 1,
    stages: 3,
    vip: false,
    quirk: 'Easygoing regular. Happy with a balanced bath.',
  },
  {
    id: 'beige',
    label: 'Beige',
    color: '#e3c9a6',
    belly: '#f6ead4',
    patch: false,
    temp: 'toasty',
    grain: 'fine',
    patience: 40,
    tip: 1.2,
    stages: 3,
    vip: false,
    quirk: 'Loves a toasty bath with the finest dust.',
  },
  {
    id: 'white',
    label: 'Wilson white',
    color: '#f4f0e6',
    belly: '#ffffff',
    patch: false,
    temp: 'cool',
    grain: 'fine',
    patience: 34,
    tip: 1.15,
    stages: 3,
    vip: false,
    quirk: 'Delicate coat. Cool, fine dust and a narrow sweet spot.',
  },
  {
    id: 'ebony',
    label: 'Ebony',
    color: '#6f6a6d',
    belly: '#9a9296',
    patch: false,
    temp: 'toasty',
    grain: 'coarse',
    patience: 56,
    tip: 0.9,
    stages: 3,
    vip: false,
    quirk: 'Patient soul. Likes it toasty and coarse, tips modestly.',
  },
  {
    id: 'violet',
    label: 'Violet VIP',
    color: '#c3b2d4',
    belly: '#ece2f2',
    patch: false,
    temp: 'cool',
    grain: 'medium',
    patience: 38,
    tip: 1.8,
    stages: 4,
    vip: true,
    quirk: 'VIP guest: four stages, high standards, generous tips.',
  },
  {
    id: 'mosaic',
    label: 'Mosaic star',
    color: '#d8b48c',
    belly: '#f3e2c9',
    patch: true,
    temp: 'mild',
    grain: 'coarse',
    patience: 44,
    tip: 1.5,
    stages: 4,
    vip: true,
    quirk: 'Celebrity guest. A full four-stage spa day, please.',
  },
];

export interface Customer {
  id: number;
  breed: string;
  label: string;
  name: string;
  color: string;
  belly: string;
  patch: boolean;
  temp: Temp;
  grain: Grain;
  patience: number;
  maxPatience: number;
  tip: number;
  stages: number;
  vip: boolean;
  quirk: string;
}
export interface Bath {
  guest: Customer | null;
  stage: number;
  ratings: number[];
  temp: Temp;
  grain: Grain;
  mess: number;
  flash: number;
  perfectFlash: number;
}
const NAMES = [
  'Mochi',
  'Pebble',
  'Clover',
  'Pip',
  'Miso',
  'Willow',
  'Boba',
  'Maple',
  'Cinny',
  'Nimbus',
  'Tofu',
  'Juniper',
];

const emptyBath = (): Bath => ({
  guest: null,
  stage: 0,
  ratings: [],
  temp: 'mild',
  grain: 'medium',
  mess: 0,
  flash: 0,
  perfectFlash: 0,
});

export class DustBathGame {
  state: 'ready' | 'playing' | 'paused' | 'finished' = 'ready';
  mode: Mode = 'shift';
  time = 120;
  elapsed = 0;
  coins = 0;
  earned = 0;
  served = 0;
  perfect = 0;
  missed = 0;
  streak = 0;
  bestStreak = 0;
  wave = 1;
  upgrades: Record<Upgrade, boolean> = {
    towels: false,
    scoop: false,
    decor: false,
    thermo: false,
    dryer: false,
    lounge: false,
  };
  queue: Customer[] = [];
  baths: Bath[] = [emptyBath(), emptyBath(), emptyBath()];
  selected: number | null = null;
  activeBath = 0;
  dust = 6;
  treats = 3;
  holding = false;
  charge = 0;
  refill = 0;
  arrival = 4;
  nextId = 1;
  message = 'Welcome to the softest little spa in the Andes.';
  private seed: number;
  constructor(seed = 27) {
    this.seed = seed >>> 0;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  /** Number of bath stations (a fourth opens with the Skylight lounge). */
  get stations() {
    return this.upgrades.lounge ? 4 : 3;
  }
  get maxDust() {
    return this.upgrades.scoop ? 8 : 6;
  }
  /** Combo multiplier grows with consecutive perfect baths (1x → 2x). */
  get multiplier() {
    return 1 + Math.min(this.streak, 5) * 0.2;
  }
  get vipChance() {
    return this.mode === 'cozy'
      ? 0.14
      : Math.min(0.34, 0.05 + this.elapsed * 0.002);
  }
  get stage(): Stage {
    return STAGES[this.baths[this.activeBath]?.stage ?? 0];
  }
  /** Sweet-spot window for the active bath's current stage. */
  get sweet() {
    return this.spot(this.baths[this.activeBath]);
  }
  matchScore(bath: Bath | undefined) {
    if (!bath?.guest) return 0;
    return (
      (bath.temp === bath.guest.temp ? 1 : 0) +
      (bath.grain === bath.guest.grain ? 1 : 0)
    );
  }
  spot(bath: Bath | undefined) {
    if (!bath?.guest) return { lo: 0.6, hi: 0.82, center: 0.71 };
    const stage = STAGES[bath.stage];
    let [lo, hi] = SPOT[stage];
    if (this.upgrades.towels) {
      lo -= 0.05;
      hi += 0.05;
    }
    if (this.upgrades.thermo) {
      lo -= 0.02;
      hi += 0.02;
    }
    if ((stage === 'fluff' || stage === 'style') && this.upgrades.dryer) {
      lo -= 0.06;
      hi += 0.06;
    }
    if (bath.guest.vip) {
      lo += 0.035;
      hi -= 0.035;
    }
    const m = this.matchScore(bath);
    lo -= 0.02 * m;
    hi += 0.02 * m;
    lo = Math.max(0.34, lo);
    hi = Math.min(0.98, hi);
    return { lo, hi, center: (lo + hi) / 2 };
  }
  start(mode: Mode) {
    if (this.state === 'playing' || this.state === 'paused') return false;
    this.mode = mode;
    this.state = 'playing';
    this.time = 120;
    this.elapsed = 0;
    this.wave = 1;
    this.earned = this.served = this.perfect = this.missed = 0;
    this.streak = this.bestStreak = 0;
    this.queue = [];
    this.baths = Array.from({ length: this.stations }, emptyBath);
    this.selected = null;
    this.activeBath = 0;
    this.dust = this.maxDust;
    this.treats = 3;
    this.refill = 0;
    this.arrival = 4;
    this.cancel();
    this.spawn();
    this.spawn();
    this.message = 'Choose a waiting guest, then an empty bath to begin.';
    return true;
  }
  private spawn() {
    if (this.queue.length >= 5) return;
    const pool = BREEDS.filter((b) =>
      this.random() < this.vipChance ? b.vip : !b.vip,
    );
    const breed = pool[Math.floor(this.random() * pool.length)] ?? BREEDS[0];
    const factor =
      this.mode === 'cozy' ? 1 : Math.max(0.75, 1 - this.elapsed * 0.0015);
    const patience = Math.round(
      (breed.patience + (this.upgrades.decor ? 12 : 0)) * factor,
    );
    this.queue.push({
      id: this.nextId++,
      breed: breed.id,
      label: breed.label,
      name: NAMES[Math.floor(this.random() * NAMES.length)],
      color: breed.color,
      belly: breed.belly,
      patch: breed.patch,
      temp: breed.temp,
      grain: breed.grain,
      patience,
      maxPatience: patience,
      tip: breed.tip,
      stages: breed.stages,
      vip: breed.vip,
      quirk: breed.quirk,
    });
  }
  select(id: number) {
    if (this.state !== 'playing' || !this.queue.some((c) => c.id === id))
      return false;
    this.selected = id;
    this.message = 'Now choose an empty bath for your guest.';
    return true;
  }
  seat(index: number) {
    const bath = this.baths[index];
    if (this.state !== 'playing' || !bath || this.holding) return false;
    this.activeBath = index;
    if (bath.guest) {
      this.message = `${bath.guest.name} is ready for the ${STAGE_INFO[STAGES[bath.stage]].label.toLowerCase()} stage.`;
      return true;
    }
    const customer = this.queue.find((c) => c.id === this.selected);
    if (!customer) {
      this.message = 'Choose a guest in the waiting room first.';
      return false;
    }
    bath.guest = customer;
    bath.stage = 0;
    bath.ratings = [];
    bath.mess = 0;
    bath.temp = 'mild';
    bath.grain = 'medium';
    this.queue = this.queue.filter((c) => c.id !== customer.id);
    this.selected = null;
    this.message = `${customer.name} the ${customer.label} settled in. Set the dust, then pour.`;
    return true;
  }
  cycleTemp(index: number) {
    const bath = this.baths[index];
    if (this.state !== 'playing' || !bath?.guest || this.holding) return false;
    bath.temp = TEMPS[(TEMPS.indexOf(bath.temp) + 1) % TEMPS.length];
    this.message = `Dust warmth set to ${bath.temp}.`;
    return true;
  }
  cycleGrain(index: number) {
    const bath = this.baths[index];
    if (this.state !== 'playing' || !bath?.guest || this.holding) return false;
    bath.grain = GRAINS[(GRAINS.indexOf(bath.grain) + 1) % GRAINS.length];
    this.message = `Dust grain set to ${bath.grain}.`;
    return true;
  }
  begin() {
    if (this.state !== 'playing' || this.holding) return false;
    const bath = this.baths[this.activeBath];
    if (!bath?.guest) return false;
    if (STAGES[bath.stage] === 'pour') {
      if (!this.dust) {
        this.message = 'Out of dust! Ask Enzo for a refill.';
        return false;
      }
      this.dust--;
    }
    this.holding = true;
    this.charge = 0;
    return true;
  }
  cancel() {
    this.holding = false;
    this.charge = 0;
  }
  release() {
    if (!this.holding || this.state !== 'playing') return false;
    const bath = this.baths[this.activeBath];
    const guest = bath.guest;
    const charge = this.charge;
    this.cancel();
    if (!guest) return false;
    const { lo, hi, center } = this.spot(bath);
    const stage = STAGES[bath.stage];
    if (charge < lo) {
      this.message = `A little longer on the ${STAGE_INFO[stage].label.toLowerCase()}. Hold to the sweet spot.`;
      return false;
    }
    if (charge > hi) {
      bath.flash = 2;
      bath.mess = Math.min(3, bath.mess + 1);
      this.baths.forEach((b, i) => {
        if (Math.abs(i - this.activeBath) === 1 && b.guest) {
          b.mess = Math.min(3, b.mess + (this.upgrades.towels ? 0.5 : 1));
          b.flash = 2;
        }
      });
      this.streak = 0;
      this.message = `${guest.name}: achoo! Too much dust splashed the neighbors. Redo the ${STAGE_INFO[stage].label.toLowerCase()}.`;
      return false;
    }
    const rating = Math.max(
      0,
      1 - Math.abs(charge - center) / Math.max(0.02, (hi - lo) / 2),
    );
    bath.ratings.push(rating);
    bath.stage++;
    if (bath.stage < guest.stages) {
      const next = STAGES[bath.stage];
      this.message = `${STAGE_INFO[stage].label} done! Now ${STAGE_INFO[next].hint.toLowerCase()}.`;
      return true;
    }
    this.finishBath(bath, guest);
    return true;
  }
  private finishBath(bath: Bath, guest: Customer) {
    const matched = this.matchScore(bath);
    const clean = bath.mess === 0;
    const crisp = bath.ratings.every((r) => r >= 0.55);
    const flawless = clean && crisp && matched === 2;
    if (flawless) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.perfect++;
    } else {
      this.streak = 0;
    }
    const base = 5 * guest.stages;
    const prepBonus = matched * 3;
    const reward = Math.max(
      4,
      Math.round(
        (base + prepBonus - bath.mess * 3) * guest.tip * this.multiplier,
      ),
    );
    this.coins += reward;
    this.earned += reward;
    this.served++;
    bath.guest = null;
    bath.stage = 0;
    bath.ratings = [];
    bath.mess = 0;
    bath.flash = 1;
    bath.perfectFlash = flawless ? 1.4 : 0;
    const combo = this.streak > 1 ? ` ${this.streak}x combo!` : '';
    this.message = flawless
      ? `${guest.name} is cloud-soft! +${reward} coins.${combo} Perfect spa day.`
      : `${guest.name} is happy. +${reward} coins. Match the wishes for a perfect combo.`;
  }
  refillSupplies() {
    if (
      this.state !== 'playing' ||
      this.refill ||
      (this.dust === this.maxDust && this.treats === 3)
    )
      return false;
    this.refill = this.upgrades.scoop ? 1 : 3;
    this.message = 'Enzo is fetching fresh dust and treats…';
    return true;
  }
  treat() {
    if (this.state !== 'playing' || !this.treats) return false;
    const guest =
      this.queue.find((c) => c.id === this.selected) ??
      this.baths[this.activeBath].guest;
    if (!guest) {
      this.message = 'Select a waiting guest or an occupied bath for a treat.';
      return false;
    }
    this.treats--;
    guest.patience = guest.maxPatience;
    const bath = this.baths.find((b) => b.guest === guest);
    if (bath) bath.mess = Math.max(0, bath.mess - 1);
    this.message = `${guest.name} loved Enzo’s treat! Patience restored and a splash soothed.`;
    return true;
  }
  buy(upgrade: Upgrade) {
    if (
      !SHOP[upgrade] ||
      !['ready', 'finished'].includes(this.state) ||
      this.upgrades[upgrade] ||
      this.coins < SHOP[upgrade].cost
    )
      return false;
    this.coins -= SHOP[upgrade].cost;
    this.upgrades[upgrade] = true;
    if (upgrade === 'lounge') this.baths = Array.from({ length: 4 }, emptyBath);
    this.message = `${SHOP[upgrade].name} installed. Thank you for growing our spa!`;
    return true;
  }
  /** Restore saved coins and upgrades between visits (the page loads this). */
  restore(coins: number, upgrades: Partial<Record<Upgrade, boolean>>) {
    if (this.state !== 'ready') return false;
    if (Number.isFinite(coins) && coins >= 0) this.coins = Math.floor(coins);
    for (const key of Object.keys(this.upgrades) as Upgrade[]) {
      if (upgrades[key]) this.upgrades[key] = true;
    }
    if (this.upgrades.lounge) this.baths = Array.from({ length: 4 }, emptyBath);
    return true;
  }
  pause() {
    if (this.state === 'playing') {
      this.cancel();
      this.state = 'paused';
    } else if (this.state === 'paused') this.state = 'playing';
  }
  finish() {
    if (this.state !== 'playing') return;
    this.cancel();
    this.state = 'finished';
    this.message =
      'Doors closed. Your coins are ready for a little spa makeover.';
  }
  step(dt: number) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Small deterministic slices keep large test steps equivalent to real frames.
    let remaining = dt;
    while (remaining > 1e-9 && this.state === 'playing') {
      const d = Math.min(
        remaining,
        1 / 60,
        this.mode === 'shift' ? this.time : Infinity,
      );
      remaining -= d;
      this.elapsed += d;
      this.wave = 1 + Math.floor(this.elapsed / 40);
      if (this.holding) this.charge = Math.min(1, this.charge + d / 1.7);
      if (this.refill > 0) {
        this.refill = Math.max(0, this.refill - d);
        if (this.refill < 1e-8) {
          this.refill = 0;
          this.dust = this.maxDust;
          this.treats = 3;
          this.message = 'Enzo: fresh dust and treats, coming right up!';
        }
      }
      this.baths.forEach((b) => {
        b.flash = Math.max(0, b.flash - d);
        b.perfectFlash = Math.max(0, b.perfectFlash - d);
      });
      if (this.mode === 'shift') {
        for (const c of [
          ...this.queue,
          ...this.baths.flatMap((b) => (b.guest ? [b.guest] : [])),
        ]) {
          c.patience -= d;
          if (c.patience <= 0) {
            this.missed++;
            this.streak = 0;
            this.queue = this.queue.filter((q) => q.id !== c.id);
            if (this.selected === c.id) this.selected = null;
            this.baths.forEach((b, i) => {
              if (b.guest?.id === c.id) {
                b.guest = null;
                b.stage = 0;
                b.ratings = [];
                b.mess = 0;
                if (i === this.activeBath) this.cancel();
              }
            });
            this.message = `${c.name} headed home. Treats restore patience, or try cozy mode.`;
          }
        }
        this.time = Math.max(0, this.time - d);
        if (this.time < 1e-8) {
          this.time = 0;
          this.finish();
        }
      }
      this.arrival -= d;
      if (this.arrival <= 0) {
        this.spawn();
        const gap =
          this.mode === 'cozy'
            ? 7
            : Math.max(3.5, 6.5 - this.elapsed * 0.03);
        this.arrival += gap;
      }
    }
  }
}

/** Pure, seeded spa simulation. All durations are seconds; no DOM or wall clock. */
export type Mode = 'shift' | 'cozy';
export type Upgrade = 'towels' | 'scoop' | 'decor';
export const SHOP: Record<
  Upgrade,
  { name: string; cost: number; description: string }
> = {
  towels: {
    name: 'Cloud towels',
    cost: 30,
    description: 'Wider sweet spot and half the splash mess.',
  },
  scoop: {
    name: 'Golden scoop',
    cost: 40,
    description: 'Enzo refills in 1 second instead of 3.',
  },
  decor: {
    name: 'Fern sanctuary',
    cost: 25,
    description: 'A leafy spa and 15 extra seconds of patience.',
  },
};
export interface Customer {
  id: number;
  name: string;
  color: string;
  patience: number;
  maxPatience: number;
}
export interface Bath {
  guest: Customer | null;
  mess: number;
  flash: number;
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
];
const COLORS = ['#ded3c8', '#9faeb5', '#ead4b4', '#c5b4cf', '#bcbcaf'];
export class DustBathGame {
  state: 'ready' | 'playing' | 'paused' | 'finished' = 'ready';
  mode: Mode = 'shift';
  time = 120;
  coins = 0;
  earned = 0;
  served = 0;
  perfect = 0;
  missed = 0;
  upgrades: Record<Upgrade, boolean> = {
    towels: false,
    scoop: false,
    decor: false,
  };
  queue: Customer[] = [];
  baths: Bath[] = Array.from({ length: 3 }, () => ({
    guest: null,
    mess: 0,
    flash: 0,
  }));
  selected: number | null = null;
  activeBath = 0;
  dust = 6;
  treats = 3;
  holding = false;
  charge = 0;
  refill = 0;
  arrival = 5;
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
  get low() {
    return this.upgrades.towels ? 0.52 : 0.62;
  }
  get high() {
    return this.upgrades.towels ? 0.9 : 0.82;
  }
  start(mode: Mode) {
    if (this.state === 'playing' || this.state === 'paused') return false;
    this.mode = mode;
    this.state = 'playing';
    this.time = 120;
    this.earned = this.served = this.perfect = this.missed = 0;
    this.queue = [];
    this.baths = Array.from({ length: 3 }, () => ({
      guest: null,
      mess: 0,
      flash: 0,
    }));
    this.selected = null;
    this.activeBath = 0;
    this.dust = 6;
    this.treats = 3;
    this.refill = 0;
    this.arrival = 5;
    this.cancel();
    this.spawn();
    this.spawn();
    this.message = 'Choose a waiting guest, then an empty bath.';
    return true;
  }
  private spawn() {
    if (this.queue.length >= 4) return;
    const patience = 40 + (this.upgrades.decor ? 15 : 0);
    this.queue.push({
      id: this.nextId++,
      name: NAMES[Math.floor(this.random() * NAMES.length)],
      color: COLORS[Math.floor(this.random() * COLORS.length)],
      patience,
      maxPatience: patience,
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
      this.message = `${bath.guest.name} is ready. Hold scrub, then release in the sweet spot.`;
      return true;
    }
    const customer = this.queue.find((c) => c.id === this.selected);
    if (!customer) {
      this.message = 'Choose a guest in the waiting room first.';
      return false;
    }
    bath.guest = customer;
    this.queue = this.queue.filter((c) => c.id !== customer.id);
    this.selected = null;
    this.message = `${customer.name} settled in! Hold scrub, release in the sweet spot.`;
    return true;
  }
  begin() {
    if (
      this.state !== 'playing' ||
      this.holding ||
      !this.baths[this.activeBath].guest
    )
      return false;
    if (!this.dust) {
      this.message = 'Out of dust! Ask Enzo to refill.';
      return false;
    }
    this.dust--;
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
    if (charge < this.low) {
      this.message = 'A little longer! Hold until the marked sweet spot.';
      return false;
    }
    if (charge > this.high) {
      bath.flash = 2;
      bath.mess = Math.min(3, bath.mess + 1);
      this.baths.forEach((b, i) => {
        if (Math.abs(i - this.activeBath) === 1 && b.guest) {
          b.mess = Math.min(3, b.mess + (this.upgrades.towels ? 0.5 : 1));
          b.flash = 2;
        }
      });
      this.message = `${guest.name}: achoo! Dust splashed neighboring guests. Try a gentler scrub.`;
      return false;
    }
    const reward = Math.max(6, 12 - Math.ceil(bath.mess * 2));
    this.coins += reward;
    this.earned += reward;
    this.served++;
    if (!bath.mess) this.perfect++;
    bath.guest = null;
    bath.mess = 0;
    bath.flash = 1;
    this.message = `${guest.name} is cloud-soft! +${reward} coins. Choose your next guest.`;
    return true;
  }
  refillSupplies() {
    if (
      this.state !== 'playing' ||
      this.refill ||
      (this.dust === 6 && this.treats === 3)
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
    this.message = `${guest.name} loved Enzo’s treat! Patience restored and one splash soothed.`;
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
    this.message = `${SHOP[upgrade].name} installed. Thank you for growing our spa!`;
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
      if (this.holding) this.charge = Math.min(1, this.charge + d / 1.8);
      if (this.refill > 0) {
        this.refill = Math.max(0, this.refill - d);
        if (this.refill < 1e-8) {
          this.refill = 0;
          this.dust = 6;
          this.treats = 3;
          this.message = 'Enzo: fresh dust and treats, coming right up!';
        }
      }
      this.baths.forEach((b) => {
        b.flash = Math.max(0, b.flash - d);
      });
      if (this.mode === 'shift') {
        for (const c of [
          ...this.queue,
          ...this.baths.flatMap((b) => (b.guest ? [b.guest] : [])),
        ]) {
          c.patience -= d;
          if (c.patience <= 0) {
            this.missed++;
            this.queue = this.queue.filter((q) => q.id !== c.id);
            if (this.selected === c.id) this.selected = null;
            this.baths.forEach((b, i) => {
              if (b.guest?.id === c.id) {
                b.guest = null;
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
        this.arrival += this.mode === 'cozy' ? 8 : 6;
      }
    }
  }
}

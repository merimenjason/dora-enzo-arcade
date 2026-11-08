import type { Body } from './bellspire-physics.js';
import type { HeroId } from './bellspire-world.js';
import type { SaltLiftPlan } from './bellspire-salt-world.js';

type Phase = 'parked' | 'calling' | 'catch' | 'boarding' | 'rising' | 'arrived' | 'returning' | 'recall';
export type SaltPrompt = { key: 'up' | 'tag' | null; text: string; x: number };

export class SaltLift {
  phase: Phase;
  y: number;
  crossed: boolean;

  constructor(readonly plan: SaltLiftPlan, crossed: boolean) {
    this.crossed = crossed;
    this.phase = crossed ? 'arrived' : 'parked';
    this.y = plan.high;
  }

  get center() { return (this.plan.left + this.plan.right) / 2; }
  get upperEdge() { return this.plan.direction === 1 ? this.plan.right : this.plan.left; }
  get lowerEdge() { return this.plan.direction === 1 ? this.plan.left : this.plan.right; }
  get locked() { return this.phase !== 'parked' && this.phase !== 'calling' && this.phase !== 'catch'; }
  get targetY() {
    if (this.phase === 'parked' || this.phase === 'calling' || this.phase === 'catch' || this.phase === 'returning') return this.plan.low;
    return this.plan.high;
  }

  step() {
    const { high, low } = this.plan;
    if (this.phase === 'calling' || this.phase === 'returning') {
      this.y = Math.min(low, this.y + 2);
      if (this.y === low) this.phase = this.phase === 'calling' ? 'catch' : 'boarding';
    } else if (this.phase === 'rising' || this.phase === 'recall') {
      this.y = Math.max(high, this.y - 2);
      if (this.y === high) this.phase = 'arrived';
    }
  }

  private near(b: Body, x: number, y: number, tx: number, ty: number, reach: number) {
    return b.ground && !b.climb && Math.abs(x - tx) <= reach && Math.abs(y - ty) < 2;
  }

  private together(fx: number, fy: number) {
    return fx >= this.plan.left + 8 && fx <= this.plan.right - 8 && Math.abs(fy - this.y) < 4;
  }

  onUpper(x: number, y: number) {
    const beyond = (x - this.upperEdge) * this.plan.direction;
    return beyond >= 8 && beyond <= 125 && Math.abs(y - this.plan.high) < 2;
  }

  prompt(b: Body, x: number, y: number, lead: HeroId, fx: number, fy: number): SaltPrompt {
    const { station, low, direction } = this.plan;
    const aboard = this.near(b, x, y, this.center, this.y, 34);
    const party = this.together(fx, fy);
    const catchX = station + direction * 19;
    const upper = this.upperEdge + direction * 30;
    switch (this.phase) {
      case 'parked':
        if (!this.near(b, x, y, station, low, 44)) return { key: null, text: 'Walk to the ballast', x: station };
        return lead === 'dora' ? { key: 'up', text: 'Move the ballast one notch', x: station } : { key: 'tag', text: 'Tag to Dora to move the ballast', x: station };
      case 'calling':
        return { key: null, text: 'The lift is coming down', x: this.center };
      case 'catch':
        if (!this.near(b, x, y, catchX, low, 48)) return { key: null, text: 'Walk to the brass catch', x: catchX };
        return lead === 'enzo' ? { key: 'up', text: 'Lock the lift level', x: catchX } : { key: 'tag', text: 'Tag to Enzo to lock the lift', x: catchX };
      case 'boarding':
        if (this.crossed && this.onUpper(x, y)) return { key: 'up', text: 'Call the lift back up', x: upper };
        if (!aboard) return { key: null, text: 'Walk to the middle of the lift', x: this.center };
        return party ? { key: 'up', text: 'Ride to the upper landing', x: this.center } : { key: null, text: 'Wait for your partner to board', x: this.center };
      case 'rising':
      case 'returning':
      case 'recall':
        return { key: null, text: 'Let the lift reach its landing', x: this.center };
      case 'arrived':
        if (!this.crossed) return { key: null, text: 'Walk onto the upper landing', x: upper };
        if (aboard) return party ? { key: 'up', text: 'Ride back down', x: this.center } : { key: null, text: 'Wait for your partner to board', x: this.center };
        if ((x - this.lowerEdge) * direction < 0 && Math.abs(y - low) < 2) return { key: 'up', text: 'Call the lift back down', x: station };
        return { key: null, text: 'Walk aboard to ride back down', x: this.center };
    }
  }

  use(b: Body, x: number, y: number, lead: HeroId, fx: number, fy: number) {
    if (this.prompt(b, x, y, lead, fx, fy).key !== 'up') return false;
    if (this.phase === 'parked') this.phase = 'calling';
    else if (this.phase === 'catch') this.phase = 'boarding';
    else if (this.phase === 'boarding') this.phase = this.onUpper(x, y) ? 'recall' : 'rising';
    else if (this.phase === 'arrived') this.phase = 'returning';
    return true;
  }
}

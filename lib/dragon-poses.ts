// Dragon Playground: which painted frame each state shows. Pure, so tests/dragon.mjs can check that every state has a
// frame of its own (no state borrows another's pose) and that every frame named here is in the art atlases.
import type { OtterSt, RiderAct } from './dragon-game';

/** the otter's frame: a four-frame gallop, separate rise and fall in the air, a two-frame swim, and a look-back taunt
 *  for a moment after it gets past you ('hidden' is underground and shows bubbles, not a frame) */
export function otterPose(st: OtterSt, vy: number, runT: number, t: number, taunt: boolean): string | null {
  switch (st) {
    case 'run': return taunt ? 'taunt' : ['run1', 'run2', 'run3', 'run4'][Math.floor(runT * 10) % 4];
    case 'jump': return vy > 0 ? 'jump' : 'fall';
    case 'swim': return Math.floor(t * 5) % 2 ? 'swim2' : 'swim1';
    case 'hidden': return null;
    default: return st;   // dive, pop, stumble, barge, belly, cheer: frames named after their state
  }
}

/** the rider's frame: its own action, or a shout for a moment when an otter gets past */
export function riderPose(act: RiderAct, shout: boolean): string {
  if (shout && (act === 'sit' || act === 'lean')) return 'shout';
  return act;
}

export type DriverState = 'won' | 'lost' | 'wobble' | 'fast' | 'shout' | 'ride';
/** the driver's frame */
export function driverPose(s: DriverState): string {
  switch (s) {
    case 'won': return 'cheer';
    case 'lost': return 'sad';
    case 'wobble': return 'wobble';
    case 'fast': return 'lean';
    case 'shout': return 'shout';
    default: return 'sit';
  }
}

export const OTTER_STATES: OtterSt[] = ['run', 'jump', 'swim', 'dive', 'hidden', 'pop', 'stumble', 'barge', 'belly', 'cheer'];
export const RIDER_ACTS: RiderAct[] = ['sit', 'lean', 'swat', 'grab', 'hang', 'cheer', 'flap', 'wobble', 'sad'];

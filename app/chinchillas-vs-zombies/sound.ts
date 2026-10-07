// Chinchillas vs Zombies' sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('chinchillas-vs-zombies-sound-v1', {
  plant: [{ f: 180, to: 120, d: 0.09, type: 'sine', v: 0.11 }, { f: 1000, d: 0.07, noise: true, v: 0.04 }],
  shovel: [{ f: 1600, d: 0.1, noise: true, v: 0.07 }, { f: 240, to: 150, d: 0.08, type: 'triangle', v: 0.04 }],
  collect: [{ f: 880, d: 0.06, type: 'triangle', v: 0.05 }, { f: 1319, d: 0.14, type: 'triangle', v: 0.05, at: 0.06 }],
  hit: [{ f: 900, d: 0.045, noise: true, v: 0.05 }, { f: 200, to: 140, d: 0.04, type: 'sine', v: 0.03 }],
  chill: [{ f: 1500, to: 2400, d: 0.1, type: 'sine', v: 0.02 }, { f: 5000, d: 0.08, noise: true, v: 0.025 }],
  kill: [{ f: 260, to: 110, d: 0.18, type: 'sawtooth', v: 0.035 }, { f: 700, d: 0.12, noise: true, v: 0.05 }],
  smash: [{ f: 120, to: 50, d: 0.22, type: 'sine', v: 0.16 }, { f: 500, d: 0.16, noise: true, v: 0.09 }],
  boom: [{ f: 105, to: 38, d: 0.36, type: 'sine', v: 0.2 }, { f: 480, d: 0.3, noise: true, v: 0.13 }],
  dust: [{ f: 800, d: 0.22, noise: true, v: 0.09 }, { f: 170, to: 80, d: 0.14, type: 'sine', v: 0.07 }],
  cart: [{ f: 90, to: 140, d: 0.5, type: 'sawtooth', v: 0.04 }, { f: 400, d: 0.5, noise: true, v: 0.06 }],
  wave: [{ f: 147, d: 0.25, type: 'sawtooth', v: 0.03 }],
  flag: [{ f: 131, d: 0.3, type: 'sawtooth', v: 0.04 }, { f: 117, d: 0.3, type: 'sawtooth', v: 0.04, at: 0.3 }, { f: 98, d: 0.6, type: 'sawtooth', v: 0.04, at: 0.6 }],
  won: [{ f: 523, d: 0.14, type: 'triangle', v: 0.08 }, { f: 659, d: 0.14, type: 'triangle', v: 0.08, at: 0.14 }, { f: 784, d: 0.14, type: 'triangle', v: 0.08, at: 0.28 }, { f: 1047, d: 0.45, type: 'triangle', v: 0.08, at: 0.42 }],
  lost: [{ f: 392, d: 0.2, type: 'triangle', v: 0.07 }, { f: 330, d: 0.2, type: 'triangle', v: 0.07, at: 0.2 }, { f: 262, d: 0.5, type: 'triangle', v: 0.07, at: 0.4 }],
});

// Hay Maze Defence's sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('hay-maze-sound-v1', {
  block: [{ f: 150, to: 90, d: 0.1, type: 'sine', v: 0.12 }, { f: 900, d: 0.08, noise: true, v: 0.05 }],
  build: [{ f: 392, d: 0.07, type: 'triangle', v: 0.06 }, { f: 587, d: 0.12, type: 'triangle', v: 0.06, at: 0.07 }],
  upgrade: [{ f: 523, d: 0.07, type: 'triangle', v: 0.06 }, { f: 659, d: 0.07, type: 'triangle', v: 0.06, at: 0.07 }, { f: 880, d: 0.18, type: 'triangle', v: 0.06, at: 0.14 }],
  sell: [{ f: 660, to: 330, d: 0.14, type: 'triangle', v: 0.05 }],
  card: [{ f: 700, to: 940, d: 0.08, type: 'triangle', v: 0.05 }],
  wave: [{ f: 196, d: 0.2, type: 'sawtooth', v: 0.035 }, { f: 262, d: 0.36, type: 'sawtooth', v: 0.035, at: 0.2 }],
  kill: [{ f: 520, to: 780, d: 0.07, type: 'triangle', v: 0.045 }, { f: 1200, d: 0.05, noise: true, v: 0.03 }],
  leak: [{ f: 220, to: 110, d: 0.3, type: 'sawtooth', v: 0.06 }, { f: 300, d: 0.2, noise: true, v: 0.07 }],
  cleared: [{ f: 523, d: 0.12, type: 'triangle', v: 0.07 }, { f: 659, d: 0.12, type: 'triangle', v: 0.07, at: 0.12 }, { f: 784, d: 0.12, type: 'triangle', v: 0.07, at: 0.24 }, { f: 1047, d: 0.4, type: 'triangle', v: 0.07, at: 0.36 }],
  lost: [{ f: 392, d: 0.2, type: 'triangle', v: 0.07 }, { f: 330, d: 0.2, type: 'triangle', v: 0.07, at: 0.2 }, { f: 262, d: 0.5, type: 'triangle', v: 0.07, at: 0.4 }],
  hit: [{ f: 2000, d: 0.03, noise: true, v: 0.035 }],
  boom: [{ f: 100, to: 42, d: 0.26, type: 'sine', v: 0.16 }, { f: 450, d: 0.22, noise: true, v: 0.1 }],
  chill: [{ f: 1500, to: 2400, d: 0.12, type: 'sine', v: 0.02 }, { f: 5000, d: 0.1, noise: true, v: 0.02 }],
  flame: [{ f: 600, d: 0.22, noise: true, v: 0.06 }],
  zap: [{ f: 1400, to: 300, d: 0.09, type: 'sawtooth', v: 0.035 }, { f: 6000, d: 0.06, noise: true, v: 0.04 }],
  shatter: [{ f: 2600, to: 1600, d: 0.1, type: 'triangle', v: 0.05 }, { f: 7000, d: 0.12, noise: true, v: 0.06 }],
  flare: [{ f: 440, to: 990, d: 0.16, type: 'sine', v: 0.05 }],
  bell: [{ f: 880, d: 0.4, type: 'sine', v: 0.045 }, { f: 1320, d: 0.3, type: 'sine', v: 0.02 }],
});

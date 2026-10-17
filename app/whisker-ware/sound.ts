// Whisker Ware's sounds: short synthesised blips, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('whisker-ware-sound-v1', {
  tick: [{ f: 1046, d: 0.04, type: 'square', v: 0.02 }],
  blip: [{ f: 660, d: 0.035, type: 'triangle', v: 0.03 }],
  command: [{ f: 523, d: 0.06, type: 'square', v: 0.025 }, { f: 784, d: 0.09, type: 'square', v: 0.025, at: 0.06 }],
  win: [{ f: 659, d: 0.08, v: 0.05 }, { f: 880, d: 0.08, at: 0.08, v: 0.05 }, { f: 1319, d: 0.18, at: 0.16, v: 0.05 }],
  lose: [{ f: 330, to: 220, d: 0.25, type: 'sawtooth', v: 0.03 }, { f: 400, d: 0.1, noise: true, v: 0.03 }],
  speedup: [{ f: 523, to: 1046, d: 0.3, type: 'square', v: 0.025 }, { f: 659, to: 1319, d: 0.3, type: 'triangle', v: 0.025, at: 0.1 }],
  boss: [{ f: 140, to: 90, d: 0.5, type: 'sawtooth', v: 0.03 }, { f: 210, to: 120, d: 0.5, type: 'triangle', v: 0.03, at: 0.05 }],
  clear: [{ f: 523, d: 0.14, v: 0.06 }, { f: 784, d: 0.14, at: 0.14, v: 0.06 }, { f: 1046, d: 0.14, at: 0.28, v: 0.06 }, { f: 1568, d: 0.6, at: 0.42, v: 0.06 }],
  over: [{ f: 392, d: 0.2, type: 'triangle', v: 0.05 }, { f: 330, d: 0.2, at: 0.18, type: 'triangle', v: 0.05 }, { f: 262, d: 0.45, at: 0.36, type: 'triangle', v: 0.05 }],
});

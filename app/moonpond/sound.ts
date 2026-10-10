// Moonpond's sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('moonpond-sound-v1', {
  cast: [{ f: 900, to: 300, d: 0.22, type: 'triangle', v: 0.04 }, { f: 3000, d: 0.2, noise: true, v: 0.02 }],
  splash: [{ f: 1400, d: 0.22, noise: true, v: 0.07 }, { f: 300, to: 160, d: 0.16, v: 0.04 }],
  nibble: [{ f: 620, d: 0.05, v: 0.03 }],
  bite: [{ f: 880, d: 0.07, v: 0.07 }, { f: 1175, d: 0.12, at: 0.07, v: 0.07 }],
  hook: [{ f: 392, to: 587, d: 0.14, type: 'triangle', v: 0.06 }],
  jump: [{ f: 2200, d: 0.25, noise: true, v: 0.06 }, { f: 500, to: 900, d: 0.18, v: 0.03 }],
  land: [{ f: 523, d: 0.12, v: 0.05 }, { f: 659, d: 0.12, at: 0.1, v: 0.05 }, { f: 784, d: 0.24, at: 0.2, v: 0.05 }],
  first: [{ f: 523, d: 0.12, v: 0.055 }, { f: 659, d: 0.12, at: 0.11, v: 0.055 }, { f: 784, d: 0.12, at: 0.22, v: 0.055 }, { f: 1046, d: 0.4, at: 0.33, v: 0.055 }],
  early: [{ f: 330, to: 260, d: 0.2, type: 'triangle', v: 0.05 }],
  missed: [{ f: 300, to: 220, d: 0.3, type: 'triangle', v: 0.05 }],
  snapped: [{ f: 1800, to: 500, d: 0.09, type: 'square', v: 0.035 }, { f: 2600, d: 0.12, noise: true, v: 0.06 }],
  slipped: [{ f: 420, to: 250, d: 0.35, v: 0.045 }],
  request: [{ f: 784, d: 0.1, v: 0.045 }, { f: 988, d: 0.2, at: 0.1, v: 0.045 }],
  buy: [{ f: 660, d: 0.07, v: 0.05 }, { f: 990, d: 0.14, at: 0.07, v: 0.045 }],
  dawn: [{ f: 392, d: 0.25, v: 0.035 }, { f: 523, d: 0.25, at: 0.2, v: 0.035 }, { f: 659, d: 0.45, at: 0.4, v: 0.035 }],
  night: [{ f: 330, to: 262, d: 0.5, type: 'triangle', v: 0.035 }],
  complete: [{ f: 523, d: 0.18, v: 0.06 }, { f: 659, d: 0.18, at: 0.18, v: 0.06 }, { f: 784, d: 0.18, at: 0.36, v: 0.06 }, { f: 1046, d: 0.2, at: 0.54, v: 0.06 }, { f: 1318, d: 0.7, at: 0.72, v: 0.06 }],
  click: [{ f: 900, d: 0.04, v: 0.02 }],
  nope: [{ f: 220, d: 0.12, type: 'square', v: 0.02 }],
});

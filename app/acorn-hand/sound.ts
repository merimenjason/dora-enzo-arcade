// Acorn Hand's sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('acorn-hand-sound-v1', {
  pick: [{ f: 880, d: 0.04, type: 'triangle', v: 0.03 }],
  drop: [{ f: 660, d: 0.04, type: 'triangle', v: 0.025 }],
  deal: [{ f: 2200, d: 0.05, noise: true, v: 0.025 }],
  discard: [{ f: 1600, d: 0.12, noise: true, v: 0.03 }, { f: 300, to: 200, d: 0.08, type: 'triangle', v: 0.02, at: 0.04 }],
  chip: [{ f: 523, d: 0.07, type: 'triangle', v: 0.04 }],
  mult: [{ f: 659, d: 0.09, type: 'square', v: 0.025 }],
  times: [{ f: 784, to: 1175, d: 0.16, type: 'square', v: 0.03 }, { f: 3000, d: 0.12, noise: true, v: 0.02 }],
  sleep: [{ f: 220, to: 160, d: 0.18, type: 'triangle', v: 0.03 }],
  total: [{ f: 392, d: 0.1, v: 0.05 }, { f: 523, d: 0.1, at: 0.08, v: 0.05 }, { f: 784, d: 0.22, at: 0.16, v: 0.05 }],
  won: [{ f: 523, d: 0.12, v: 0.055 }, { f: 659, d: 0.12, at: 0.11, v: 0.055 }, { f: 784, d: 0.12, at: 0.22, v: 0.055 }, { f: 1046, d: 0.4, at: 0.33, v: 0.055 }],
  lost: [{ f: 392, d: 0.2, type: 'triangle', v: 0.05 }, { f: 330, d: 0.2, at: 0.18, type: 'triangle', v: 0.05 }, { f: 262, d: 0.45, at: 0.36, type: 'triangle', v: 0.05 }],
  coin: [{ f: 988, d: 0.06, v: 0.04 }, { f: 1319, d: 0.2, at: 0.06, v: 0.04 }],
  buy: [{ f: 740, d: 0.06, v: 0.04 }, { f: 988, d: 0.14, at: 0.06, v: 0.04 }],
  sell: [{ f: 988, d: 0.06, v: 0.035 }, { f: 659, d: 0.14, at: 0.06, v: 0.035 }],
  reroll: [{ f: 1800, d: 0.18, noise: true, v: 0.03 }, { f: 440, to: 660, d: 0.12, type: 'triangle', v: 0.03 }],
  use: [{ f: 600, to: 1200, d: 0.22, v: 0.04 }, { f: 3200, d: 0.15, noise: true, v: 0.015 }],
  boss: [{ f: 140, to: 90, d: 0.5, type: 'sawtooth', v: 0.03 }, { f: 210, to: 120, d: 0.5, type: 'triangle', v: 0.03, at: 0.05 }],
  victory: [{ f: 523, d: 0.14, v: 0.06 }, { f: 784, d: 0.14, at: 0.14, v: 0.06 }, { f: 1046, d: 0.14, at: 0.28, v: 0.06 }, { f: 1568, d: 0.7, at: 0.42, v: 0.06 }],
  flip: [{ f: 3200, d: 0.03, noise: true, v: 0.02 }],
  whoosh: [{ f: 900, d: 0.22, noise: true, v: 0.035 }],
  tear: [{ f: 4000, d: 0.16, noise: true, v: 0.04 }, { f: 1200, d: 0.12, noise: true, v: 0.03, at: 0.08 }],
  chirp: [{ f: 880, to: 1320, d: 0.07, type: 'triangle', v: 0.03 }, { f: 1100, to: 990, d: 0.06, type: 'triangle', v: 0.025, at: 0.07 }],
  click: [{ f: 900, d: 0.04, v: 0.02 }],
  nope: [{ f: 220, d: 0.12, type: 'square', v: 0.02 }],
});

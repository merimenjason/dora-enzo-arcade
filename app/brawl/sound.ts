// Hay Bale Brawl's sounds: short synthesised blips, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('hay-bale-sound-v1', {
  buy: [{ f: 523, d: 0.06, type: 'triangle', v: 0.04 }, { f: 784, d: 0.08, type: 'triangle', v: 0.04, at: 0.05 }],
  sell: [{ f: 880, d: 0.05, type: 'square', v: 0.02 }, { f: 1175, d: 0.08, type: 'square', v: 0.02, at: 0.05 }],
  merge: [{ f: 440, to: 660, d: 0.14, type: 'triangle', v: 0.05 }],
  level: [{ f: 523, d: 0.1, v: 0.05 }, { f: 659, d: 0.1, at: 0.09, v: 0.05 }, { f: 1046, d: 0.2, at: 0.18, v: 0.05 }],
  roll: [{ f: 300, d: 0.06, noise: true, v: 0.02 }, { f: 620, d: 0.05, type: 'square', v: 0.015, at: 0.04 }],
  hit: [{ f: 180, to: 90, d: 0.09, type: 'square', v: 0.03 }, { f: 300, d: 0.05, noise: true, v: 0.02 }],
  faint: [{ f: 520, to: 180, d: 0.22, type: 'triangle', v: 0.04 }],
  ability: [{ f: 988, d: 0.05, type: 'triangle', v: 0.03 }, { f: 1319, d: 0.07, type: 'triangle', v: 0.03, at: 0.04 }],
  win: [{ f: 659, d: 0.1, v: 0.05 }, { f: 880, d: 0.1, at: 0.1, v: 0.05 }, { f: 1319, d: 0.25, at: 0.2, v: 0.05 }],
  loss: [{ f: 392, d: 0.18, type: 'triangle', v: 0.05 }, { f: 294, d: 0.32, at: 0.16, type: 'triangle', v: 0.05 }],
  draw: [{ f: 523, d: 0.12, type: 'triangle', v: 0.04 }, { f: 523, d: 0.12, at: 0.14, type: 'triangle', v: 0.04 }],
});

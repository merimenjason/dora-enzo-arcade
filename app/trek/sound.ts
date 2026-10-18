// Chinchilla Trek's sounds: short synthesised blips, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('chinchilla-trek-sound-v1', {
  step: [{ f: 220, d: 0.05, noise: true, v: 0.015 }],
  hit: [{ f: 180, to: 90, d: 0.09, type: 'square', v: 0.03 }, { f: 300, d: 0.05, noise: true, v: 0.02 }],
  crit: [{ f: 260, to: 120, d: 0.12, type: 'square', v: 0.04 }, { f: 1200, d: 0.08, type: 'triangle', v: 0.03, at: 0.03 }],
  zap: [{ f: 1400, to: 700, d: 0.1, type: 'sawtooth', v: 0.02 }],
  dodge: [{ f: 600, to: 1100, d: 0.1, type: 'triangle', v: 0.03 }],
  level: [{ f: 523, d: 0.1, v: 0.05 }, { f: 659, d: 0.1, at: 0.09, v: 0.05 }, { f: 1046, d: 0.2, at: 0.18, v: 0.05 }],
  pick: [{ f: 784, d: 0.07, type: 'triangle', v: 0.04 }, { f: 1175, d: 0.1, type: 'triangle', v: 0.04, at: 0.06 }],
  chest: [{ f: 392, d: 0.1, type: 'triangle', v: 0.05 }, { f: 523, d: 0.1, at: 0.1, type: 'triangle', v: 0.05 }, { f: 784, d: 0.3, at: 0.2, v: 0.05 }],
  ko: [{ f: 520, to: 180, d: 0.22, type: 'triangle', v: 0.04 }],
  win: [{ f: 659, d: 0.1, v: 0.05 }, { f: 880, d: 0.1, at: 0.1, v: 0.05 }, { f: 1319, d: 0.25, at: 0.2, v: 0.05 }],
  lose: [{ f: 392, d: 0.18, type: 'triangle', v: 0.05 }, { f: 294, d: 0.32, at: 0.16, type: 'triangle', v: 0.05 }],
});

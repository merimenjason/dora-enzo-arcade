// Frostpaw Frontier's sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('frostpaw-frontier-sound-v1', {
  reveal: [{ f: 2400, d: 0.18, noise: true, v: 0.025 }, { f: 520, to: 700, d: 0.12, v: 0.03 }],
  cache: [{ f: 660, d: 0.08, v: 0.05 }, { f: 880, d: 0.12, at: 0.08, v: 0.045 }],
  join: [{ f: 523, d: 0.1, v: 0.045 }, { f: 784, d: 0.16, at: 0.1, v: 0.04 }],
  hero: [{ f: 523, d: 0.12, v: 0.05 }, { f: 659, d: 0.12, at: 0.11, v: 0.05 }, { f: 784, d: 0.12, at: 0.22, v: 0.05 }, { f: 1046, d: 0.3, at: 0.33, v: 0.05 }],
  build: [{ f: 160, to: 110, d: 0.1, v: 0.1 }, { f: 900, d: 0.08, noise: true, v: 0.04, at: 0.05 }],
  upgrade: [{ f: 392, d: 0.14, v: 0.05 }, { f: 523, d: 0.14, at: 0.12, v: 0.05 }, { f: 659, d: 0.28, at: 0.24, v: 0.05 }],
  train: [{ f: 440, to: 660, d: 0.18, type: 'triangle', v: 0.05 }],
  'win-fight': [{ f: 300, d: 0.12, noise: true, v: 0.08 }, { f: 523, d: 0.12, at: 0.12, v: 0.05 }, { f: 784, d: 0.22, at: 0.22, v: 0.05 }],
  'lose-fight': [{ f: 300, d: 0.12, noise: true, v: 0.08 }, { f: 330, to: 220, d: 0.35, at: 0.1, type: 'triangle', v: 0.06 }],
  night: [{ f: 220, to: 180, d: 0.6, type: 'triangle', v: 0.04 }, { f: 330, to: 260, d: 0.6, at: 0.15, type: 'sine', v: 0.03 }],
  dawn: [{ f: 523, d: 0.2, v: 0.035 }, { f: 659, d: 0.2, at: 0.15, v: 0.035 }, { f: 784, d: 0.35, at: 0.3, v: 0.035 }],
  'raid-held': [{ f: 392, d: 0.12, type: 'square', v: 0.025 }, { f: 523, d: 0.25, at: 0.12, type: 'square', v: 0.025 }],
  'raid-hit': [{ f: 120, d: 0.3, noise: true, v: 0.12 }, { f: 200, to: 110, d: 0.4, type: 'sawtooth', v: 0.03 }],
  leave: [{ f: 440, to: 300, d: 0.3, v: 0.035 }],
  rumour: [{ f: 600, d: 0.08, v: 0.035 }, { f: 600, d: 0.08, at: 0.16, v: 0.035 }],
  damaged: [{ f: 90, d: 0.25, noise: true, v: 0.09 }],
  repair: [{ f: 700, d: 0.05, noise: true, v: 0.04 }, { f: 700, d: 0.05, at: 0.1, noise: true, v: 0.04 }],
  won: [{ f: 523, d: 0.18, v: 0.06 }, { f: 659, d: 0.18, at: 0.18, v: 0.06 }, { f: 784, d: 0.18, at: 0.36, v: 0.06 }, { f: 1046, d: 0.6, at: 0.54, v: 0.06 }],
  lost: [{ f: 392, d: 0.3, type: 'triangle', v: 0.05 }, { f: 330, d: 0.3, at: 0.3, type: 'triangle', v: 0.05 }, { f: 262, d: 0.6, at: 0.6, type: 'triangle', v: 0.05 }],
  click: [{ f: 900, d: 0.04, v: 0.02 }],
  nope: [{ f: 220, d: 0.12, type: 'square', v: 0.02 }],
});

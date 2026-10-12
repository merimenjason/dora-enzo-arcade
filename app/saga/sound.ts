// Whisker Saga's sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('saga-sound-v1', {
  hit: [{ f: 220, to: 140, d: 0.05, type: 'square', v: 0.018 }],
  hurt: [{ f: 160, to: 100, d: 0.07, type: 'triangle', v: 0.03 }],
  skill: [{ f: 440, to: 880, d: 0.14, type: 'triangle', v: 0.05 }, { f: 2400, d: 0.12, noise: true, v: 0.025 }],
  heal: [{ f: 660, d: 0.08, v: 0.04 }, { f: 880, d: 0.16, at: 0.08, v: 0.04 }],
  shield: [{ f: 520, to: 780, d: 0.2, v: 0.04 }],
  windup: [{ f: 180, to: 320, d: 0.5, type: 'sawtooth', v: 0.03 }],
  interrupt: [{ f: 1200, to: 600, d: 0.1, type: 'square', v: 0.04 }, { f: 1568, d: 0.18, at: 0.08, v: 0.05 }],
  slam: [{ f: 110, to: 50, d: 0.4, type: 'triangle', v: 0.09 }, { f: 900, d: 0.3, noise: true, v: 0.07 }],
  call: [{ f: 300, to: 500, d: 0.25, type: 'sawtooth', v: 0.03 }],
  die: [{ f: 500, to: 200, d: 0.14, v: 0.03 }],
  fall: [{ f: 330, to: 110, d: 0.4, type: 'triangle', v: 0.05 }],
  wave: [{ f: 392, d: 0.1, v: 0.04 }, { f: 523, d: 0.16, at: 0.1, v: 0.04 }],
  won: [{ f: 523, d: 0.12, v: 0.055 }, { f: 659, d: 0.12, at: 0.11, v: 0.055 }, { f: 784, d: 0.12, at: 0.22, v: 0.055 }, { f: 1046, d: 0.4, at: 0.33, v: 0.055 }],
  lost: [{ f: 392, d: 0.2, type: 'triangle', v: 0.05 }, { f: 330, d: 0.2, at: 0.18, type: 'triangle', v: 0.05 }, { f: 262, d: 0.45, at: 0.36, type: 'triangle', v: 0.05 }],
  summon: [{ f: 600, to: 1200, d: 0.25, v: 0.04 }, { f: 3000, d: 0.2, noise: true, v: 0.02 }],
  epic: [{ f: 659, d: 0.1, v: 0.05 }, { f: 880, d: 0.1, at: 0.1, v: 0.05 }, { f: 1175, d: 0.3, at: 0.2, v: 0.05 }],
  legend: [{ f: 523, d: 0.12, v: 0.06 }, { f: 784, d: 0.12, at: 0.12, v: 0.06 }, { f: 1046, d: 0.12, at: 0.24, v: 0.06 }, { f: 1568, d: 0.6, at: 0.36, v: 0.06 }],
  level: [{ f: 520, to: 780, d: 0.12, v: 0.045 }],
  star: [{ f: 784, d: 0.1, v: 0.05 }, { f: 1175, d: 0.3, at: 0.1, v: 0.05 }],
  equip: [{ f: 320, d: 0.05, type: 'square', v: 0.025 }, { f: 480, d: 0.08, at: 0.05, type: 'square', v: 0.025 }],
  forge: [{ f: 1400, d: 0.06, type: 'square', v: 0.03 }, { f: 1900, d: 0.2, at: 0.07, v: 0.035 }],
  coin: [{ f: 988, d: 0.06, v: 0.04 }, { f: 1319, d: 0.2, at: 0.06, v: 0.04 }],
  click: [{ f: 900, d: 0.04, v: 0.02 }],
  nope: [{ f: 220, d: 0.12, type: 'square', v: 0.02 }],
});

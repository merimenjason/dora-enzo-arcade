// Chinchilla Clash's sounds: short synthesised cues, no files.
import { makeSound } from '../../lib/cue-sound';

export const sound = makeSound('chinchilla-clash-sound-v1', {
  pick: [{ f: 620, d: 0.04, type: 'triangle', v: 0.04 }],
  deploy: [{ f: 300, to: 520, d: 0.1, type: 'triangle', v: 0.07 }, { f: 900, d: 0.05, noise: true, v: 0.04, at: 0.02 }],
  rival: [{ f: 260, to: 200, d: 0.1, type: 'triangle', v: 0.045 }],
  no: [{ f: 180, d: 0.07, type: 'square', v: 0.03 }, { f: 150, d: 0.09, type: 'square', v: 0.03, at: 0.08 }],
  hit: [{ f: 1800, d: 0.035, noise: true, v: 0.05 }, { f: 240, to: 160, d: 0.04, type: 'triangle', v: 0.035 }],
  spin: [{ f: 2600, d: 0.12, noise: true, v: 0.05 }, { f: 420, to: 260, d: 0.1, type: 'sine', v: 0.03 }],
  poof: [{ f: 700, d: 0.16, noise: true, v: 0.07 }, { f: 190, to: 90, d: 0.12, type: 'sine', v: 0.05 }],
  boom: [{ f: 110, to: 40, d: 0.32, type: 'sine', v: 0.2 }, { f: 500, d: 0.28, noise: true, v: 0.13 }],
  crown: [{ f: 90, to: 38, d: 0.5, type: 'sine', v: 0.22 }, { f: 380, d: 0.45, noise: true, v: 0.14 }, { f: 784, d: 0.12, type: 'triangle', v: 0.07, at: 0.3 }, { f: 1047, d: 0.3, type: 'triangle', v: 0.07, at: 0.42 }],
  lost: [{ f: 90, to: 38, d: 0.5, type: 'sine', v: 0.22 }, { f: 380, d: 0.45, noise: true, v: 0.14 }, { f: 330, d: 0.14, type: 'triangle', v: 0.06, at: 0.3 }, { f: 247, d: 0.32, type: 'triangle', v: 0.06, at: 0.44 }],
  horn: [{ f: 294, d: 0.18, type: 'sawtooth', v: 0.035 }, { f: 392, d: 0.18, type: 'sawtooth', v: 0.035, at: 0.18 }, { f: 587, d: 0.4, type: 'sawtooth', v: 0.035, at: 0.36 }],
  win: [{ f: 523, d: 0.14, type: 'triangle', v: 0.08 }, { f: 659, d: 0.14, type: 'triangle', v: 0.08, at: 0.14 }, { f: 784, d: 0.14, type: 'triangle', v: 0.08, at: 0.28 }, { f: 1047, d: 0.45, type: 'triangle', v: 0.08, at: 0.42 }],
  lose: [{ f: 392, d: 0.2, type: 'triangle', v: 0.07 }, { f: 330, d: 0.2, type: 'triangle', v: 0.07, at: 0.2 }, { f: 262, d: 0.5, type: 'triangle', v: 0.07, at: 0.4 }],
  draw: [{ f: 440, d: 0.2, type: 'triangle', v: 0.06 }, { f: 440, d: 0.35, type: 'triangle', v: 0.06, at: 0.24 }],
});

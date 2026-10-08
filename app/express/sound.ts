import { makeSound } from '../../lib/cue-sound';
export const sound = makeSound('burrow-express-sound-v1', {
  build: [{ f: 440, to: 660, d: 0.09, type: 'triangle', v: 0.025 }],
  deliver: [{ f: 660, d: 0.06, v: 0.012 }, { f: 880, at: 0.05, d: 0.08, v: 0.012 }],
  station: [{ f: 330, d: 0.12, v: 0.035 }, { f: 495, at: 0.1, d: 0.15, v: 0.025 }],
  upgrade: [{ f: 440, d: 0.12, v: 0.03 }, { f: 660, at: 0.1, d: 0.15, v: 0.025 }],
  warning: [{ f: 220, d: 0.15, type: 'triangle', v: 0.035 }, { f: 196, at: 0.2, d: 0.18, type: 'triangle', v: 0.025 }],
  won: [{ f: 523, d: 0.16, v: 0.04 }, { f: 659, at: 0.14, d: 0.16, v: 0.04 }, { f: 784, at: 0.28, d: 0.3, v: 0.035 }],
  lost: [{ f: 330, to: 165, d: 0.4, type: 'triangle', v: 0.035 }],
});

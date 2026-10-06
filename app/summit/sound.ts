// Tiny WebAudio cues for Summit Shuffle: each is one or two short synthesised notes, so there are no files to load.
let ctx: AudioContext | null = null, muted = false;
export const setMuted = (m: boolean) => { muted = m; };

type Note = { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number; noise?: boolean };
const CUES: Record<string, Note[]> = {
  select: [{ f: 760, d: 0.05, type: 'triangle', v: 0.05 }],
  no: [{ f: 220, to: 170, d: 0.12, type: 'square', v: 0.04 }],
  step: [{ f: 420, to: 560, d: 0.07, type: 'triangle', v: 0.05 }, { f: 560, to: 700, d: 0.07, type: 'triangle', v: 0.05, at: 0.08 }],
  turn: [{ f: 520, d: 0.08, type: 'triangle', v: 0.05 }, { f: 700, d: 0.12, type: 'triangle', v: 0.05, at: 0.08 }],
  swing: [{ f: 0, d: 0.09, noise: true, v: 0.05 }, { f: 520, to: 260, d: 0.09, type: 'triangle', v: 0.04 }],
  skill: [{ f: 600, to: 900, d: 0.1, type: 'sine', v: 0.05 }],
  power: [{ f: 440, d: 0.1, type: 'triangle', v: 0.06 }, { f: 660, d: 0.1, type: 'triangle', v: 0.06, at: 0.09 }, { f: 880, d: 0.2, type: 'triangle', v: 0.06, at: 0.18 }],
  hit: [{ f: 180, to: 70, d: 0.14, type: 'sine', v: 0.12 }, { f: 0, d: 0.1, noise: true, v: 0.08 }],
  hurt: [{ f: 320, to: 150, d: 0.16, type: 'square', v: 0.06 }, { f: 0, d: 0.08, noise: true, v: 0.05 }],
  block: [{ f: 900, to: 700, d: 0.07, type: 'triangle', v: 0.05 }],
  fluff: [{ f: 500, to: 760, d: 0.09, type: 'sine', v: 0.04 }],
  heal: [{ f: 520, d: 0.1, type: 'sine', v: 0.06 }, { f: 780, d: 0.18, type: 'sine', v: 0.06, at: 0.09 }],
  growl: [{ f: 110, to: 70, d: 0.22, type: 'sawtooth', v: 0.06 }],
  out: [{ f: 500, to: 110, d: 0.3, type: 'triangle', v: 0.08 }],
  flee: [{ f: 300, to: 900, d: 0.25, type: 'triangle', v: 0.05 }],
  coin: [{ f: 990, d: 0.06, type: 'square', v: 0.04 }, { f: 1320, d: 0.14, type: 'square', v: 0.04, at: 0.06 }],
  win: [{ f: 523, d: 0.14, type: 'triangle', v: 0.08 }, { f: 659, d: 0.14, type: 'triangle', v: 0.08, at: 0.14 }, { f: 784, d: 0.14, type: 'triangle', v: 0.08, at: 0.28 }, { f: 1047, d: 0.4, type: 'triangle', v: 0.08, at: 0.42 }],
  lose: [{ f: 392, d: 0.2, type: 'triangle', v: 0.07 }, { f: 330, d: 0.2, type: 'triangle', v: 0.07, at: 0.2 }, { f: 262, d: 0.5, type: 'triangle', v: 0.07, at: 0.4 }],
};

export function cue(name: string) {
  if (muted || typeof window === 'undefined') return;
  const notes = CUES[name];
  if (!notes) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    const a = ctx;
    for (const n of notes) {
      const t = a.currentTime + (n.at ?? 0), gain = a.createGain();
      gain.gain.setValueAtTime(n.v ?? 0.06, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      gain.connect(a.destination);
      if (n.noise) {
        const buf = a.createBuffer(1, Math.ceil(a.sampleRate * n.d), a.sampleRate), data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = a.createBufferSource(); src.buffer = buf; src.connect(gain); src.start(t);
      } else {
        const osc = a.createOscillator(); osc.type = n.type ?? 'sine';
        osc.frequency.setValueAtTime(n.f, t); if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.d);
        osc.connect(gain); osc.start(t); osc.stop(t + n.d + 0.02);
      }
    }
  } catch { /* no audio: the game is silent, nothing else changes */ }
}

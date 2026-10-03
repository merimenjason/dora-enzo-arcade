// Tiny WebAudio cues for Burrow Tactics: each is one or two short synthesised notes, so there are no files to load.
let ctx: AudioContext | null = null, muted = false;
export const setMuted = (m: boolean) => { muted = m; };

type Note = { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number; noise?: boolean };
const CUES: Record<string, Note[]> = {
  step: [{ f: 520, to: 660, d: 0.05, type: 'triangle', v: 0.05 }],
  shoot: [{ f: 900, to: 300, d: 0.12, type: 'square', v: 0.05 }],
  throw: [{ f: 300, to: 620, d: 0.18, type: 'sine', v: 0.07 }],
  whack: [{ f: 180, to: 70, d: 0.14, type: 'sawtooth', v: 0.09 }, { f: 0, d: 0.08, noise: true, v: 0.08 }],
  hit: [{ f: 220, to: 110, d: 0.12, type: 'square', v: 0.07 }, { f: 0, d: 0.06, noise: true, v: 0.06 }],
  bite: [{ f: 320, to: 160, d: 0.09, type: 'sawtooth', v: 0.06 }],
  spit: [{ f: 700, to: 420, d: 0.14, type: 'sine', v: 0.06 }],
  push: [{ f: 260, to: 200, d: 0.08, type: 'triangle', v: 0.06 }],
  bump: [{ f: 130, to: 80, d: 0.1, type: 'square', v: 0.08 }],
  whoosh: [{ f: 0, d: 0.2, noise: true, v: 0.05 }],
  leap: [{ f: 300, to: 700, d: 0.16, type: 'triangle', v: 0.06 }],
  ko: [{ f: 500, to: 120, d: 0.25, type: 'triangle', v: 0.08 }],
  down: [{ f: 330, to: 110, d: 0.4, type: 'sine', v: 0.09 }],
  splash: [{ f: 0, d: 0.28, noise: true, v: 0.09 }, { f: 600, to: 200, d: 0.2, type: 'sine', v: 0.04 }],
  poof: [{ f: 0, d: 0.22, noise: true, v: 0.06 }],
  thud: [{ f: 110, to: 60, d: 0.14, type: 'sine', v: 0.12 }],
  break: [{ f: 0, d: 0.16, noise: true, v: 0.08 }, { f: 240, to: 120, d: 0.1, type: 'square', v: 0.04 }],
  collapse: [{ f: 90, to: 40, d: 0.45, type: 'sawtooth', v: 0.12 }, { f: 0, d: 0.4, noise: true, v: 0.1 }],
  block: [{ f: 660, d: 0.07, type: 'square', v: 0.05 }, { f: 880, d: 0.1, type: 'square', v: 0.05, at: 0.07 }],
  heal: [{ f: 520, d: 0.1, type: 'sine', v: 0.07 }, { f: 780, d: 0.16, type: 'sine', v: 0.07, at: 0.1 }],
  rustle: [{ f: 0, d: 0.12, noise: true, v: 0.04 }],
  emerge: [{ f: 140, to: 260, d: 0.2, type: 'sawtooth', v: 0.07 }],
  growl: [{ f: 110, to: 80, d: 0.4, type: 'sawtooth', v: 0.08 }],
  turn: [{ f: 520, d: 0.09, type: 'triangle', v: 0.07 }, { f: 700, d: 0.14, type: 'triangle', v: 0.07, at: 0.09 }],
  select: [{ f: 760, d: 0.05, type: 'triangle', v: 0.05 }],
  win: [{ f: 520, d: 0.12, type: 'triangle', v: 0.09 }, { f: 660, d: 0.12, type: 'triangle', v: 0.09, at: 0.12 }, { f: 780, d: 0.12, type: 'triangle', v: 0.09, at: 0.24 }, { f: 1040, d: 0.3, type: 'triangle', v: 0.09, at: 0.36 }],
  lose: [{ f: 390, d: 0.18, type: 'sine', v: 0.09 }, { f: 330, d: 0.18, type: 'sine', v: 0.09, at: 0.18 }, { f: 260, d: 0.4, type: 'sine', v: 0.09, at: 0.36 }],
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

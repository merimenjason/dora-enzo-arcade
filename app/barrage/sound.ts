// Tiny WebAudio cues for Burrow Barrage: each is one or two short synthesised notes, so there are no files to load.
let ctx: AudioContext | null = null, muted = false;
export const setMuted = (m: boolean) => { muted = m; };

type Note = { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number; noise?: boolean };
const CUES: Record<string, Note[]> = {
  step: [{ f: 420, to: 520, d: 0.04, type: 'triangle', v: 0.04 }],
  select: [{ f: 760, d: 0.05, type: 'triangle', v: 0.05 }],
  turn: [{ f: 520, d: 0.09, type: 'triangle', v: 0.06 }, { f: 700, d: 0.14, type: 'triangle', v: 0.06, at: 0.09 }],
  'launch-catapult': [{ f: 160, to: 420, d: 0.22, type: 'sine', v: 0.09 }, { f: 0, d: 0.1, noise: true, v: 0.05 }],
  'launch-spitter': [{ f: 900, to: 420, d: 0.09, type: 'square', v: 0.05 }],
  'launch-digger': [{ f: 220, to: 120, d: 0.2, type: 'sawtooth', v: 0.08 }],
  'launch-cannon': [{ f: 0, d: 0.3, noise: true, v: 0.09 }, { f: 120, to: 70, d: 0.2, type: 'sine', v: 0.1 }],
  boom: [{ f: 150, to: 50, d: 0.3, type: 'sine', v: 0.14 }, { f: 0, d: 0.28, noise: true, v: 0.12 }],
  'boom-big': [{ f: 110, to: 36, d: 0.5, type: 'sine', v: 0.16 }, { f: 0, d: 0.5, noise: true, v: 0.14 }],
  hurt: [{ f: 320, to: 180, d: 0.1, type: 'square', v: 0.05 }],
  fall: [{ f: 520, to: 200, d: 0.25, type: 'triangle', v: 0.06 }],
  fell: [{ f: 700, to: 90, d: 0.6, type: 'sine', v: 0.09 }],
  out: [{ f: 500, to: 120, d: 0.3, type: 'triangle', v: 0.08 }],
  heal: [{ f: 520, d: 0.1, type: 'sine', v: 0.07 }, { f: 780, d: 0.16, type: 'sine', v: 0.07, at: 0.1 }],
  hop: [{ f: 300, to: 900, d: 0.18, type: 'triangle', v: 0.06 }],
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

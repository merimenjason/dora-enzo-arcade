// Tiny WebAudio cues for Poof Panic: each is one or two short synthesised notes, so there are no files to load.
let ctx: AudioContext | null = null, muted = false;
export const setMuted = (m: boolean) => { muted = m; };

type Note = { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number; noise?: boolean };
const CUES: Record<string, Note[]> = {
  move: [{ f: 520, d: 0.03, type: 'triangle', v: 0.03 }],
  turn: [{ f: 680, to: 820, d: 0.04, type: 'triangle', v: 0.035 }],
  lock: [{ f: 170, to: 110, d: 0.07, type: 'sine', v: 0.09 }],
  pop: [{ f: 392, to: 523, d: 0.09, type: 'triangle', v: 0.08 }, { f: 784, d: 0.12, type: 'sine', v: 0.05, at: 0.07 }, { f: 0, d: 0.06, noise: true, v: 0.03, at: 0.05 }],
  send: [{ f: 500, to: 1200, d: 0.16, type: 'sine', v: 0.04 }],
  block: [{ f: 1100, to: 760, d: 0.08, type: 'triangle', v: 0.05 }],
  dust: [{ f: 120, to: 55, d: 0.2, type: 'sine', v: 0.14 }, { f: 0, d: 0.14, noise: true, v: 0.07 }],
  warn: [{ f: 300, d: 0.06, type: 'square', v: 0.025 }, { f: 300, d: 0.06, type: 'square', v: 0.025, at: 0.1 }],
  sweep: [{ f: 659, d: 0.1, type: 'triangle', v: 0.07 }, { f: 880, d: 0.1, type: 'triangle', v: 0.07, at: 0.09 }, { f: 1319, d: 0.3, type: 'triangle', v: 0.07, at: 0.18 }],
  count: [{ f: 440, d: 0.09, type: 'triangle', v: 0.06 }],
  go: [{ f: 880, d: 0.22, type: 'triangle', v: 0.07 }],
  select: [{ f: 760, d: 0.05, type: 'triangle', v: 0.05 }],
  win: [{ f: 523, d: 0.14, type: 'triangle', v: 0.08 }, { f: 659, d: 0.14, type: 'triangle', v: 0.08, at: 0.14 }, { f: 784, d: 0.14, type: 'triangle', v: 0.08, at: 0.28 }, { f: 1047, d: 0.4, type: 'triangle', v: 0.08, at: 0.42 }],
  lose: [{ f: 392, d: 0.2, type: 'triangle', v: 0.07 }, { f: 330, d: 0.2, type: 'triangle', v: 0.07, at: 0.2 }, { f: 262, d: 0.5, type: 'triangle', v: 0.07, at: 0.4 }],
};

/** Play a cue. `step` raises it by that many notes of a major scale (each link of a chain sounds higher); `gain` scales its volume. */
export function cue(name: string, step = 0, gain = 1) {
  if (muted || typeof window === 'undefined') return;
  const notes = CUES[name];
  if (!notes) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    const a = ctx, k = 2 ** (([0, 2, 4, 5, 7, 9, 11][step % 7] + 12 * Math.floor(step / 7)) / 12);
    for (const n of notes) {
      const t = a.currentTime + (n.at ?? 0), g = a.createGain();
      g.gain.setValueAtTime((n.v ?? 0.06) * gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      g.connect(a.destination);
      if (n.noise) {
        const buf = a.createBuffer(1, Math.ceil(a.sampleRate * n.d), a.sampleRate), data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = a.createBufferSource(); src.buffer = buf; src.connect(g); src.start(t);
      } else {
        const osc = a.createOscillator(); osc.type = n.type ?? 'sine';
        osc.frequency.setValueAtTime(n.f * k, t); if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to * k, t + n.d);
        osc.connect(g); osc.start(t); osc.stop(t + n.d + 0.02);
      }
    }
  } catch { /* no audio: the game is silent, nothing else changes */ }
}

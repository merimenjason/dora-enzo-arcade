// Tiny WebAudio cues, shared by the games that came without sound: every cue is a few short synthesised notes, so
// there are no files to load. A game lists its cues and gets back something to play them with and a mute switch that
// is remembered under the game's own key.
export type Tone = { f: number; to?: number; d: number; type?: OscillatorType; v?: number; at?: number; noise?: boolean };
export type Cues = Record<string, Tone[]>;

let ctx: AudioContext | null = null;
const SCALE = [0, 2, 4, 5, 7, 9, 11];

export function makeSound<K extends string>(key: string, cues: Record<K, Tone[]>) {
  let muted = false, read = false;
  const last = new Map<string, number>();
  const load = () => { if (read || typeof window === 'undefined') return; read = true; try { muted = window.localStorage.getItem(key) === 'off'; } catch { /* private window: sound stays on */ } };
  return {
    /** Whether sound is off. Reads the saved choice the first time, so call it from an effect, not during render. */
    muted: () => { load(); return muted; },
    setMuted: (m: boolean) => { read = true; muted = m; try { window.localStorage.setItem(key, m ? 'off' : 'on'); } catch { /* not saved, still applied */ } },
    /**
     * Play a cue. `step` raises it by that many notes of a major scale and `gain` scales its volume. The same cue will
     * not start again within `gap` seconds, so twenty things landing at once are one sound, not a wall of them.
     */
    cue: (name: K, step = 0, gain = 1, gap = 0.05) => {
      load();
      if (muted || typeof window === 'undefined') return;
      const notes = cues[name];
      if (!notes) return;
      try {
        ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (ctx.state === 'suspended') void ctx.resume();
        const a = ctx, was = last.get(name);
        if (was !== undefined && a.currentTime - was < gap) return;
        last.set(name, a.currentTime);
        const k = 2 ** ((SCALE[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)) / 12);
        for (const n of notes) {
          const t = a.currentTime + (n.at ?? 0), g = a.createGain();
          g.gain.setValueAtTime((n.v ?? 0.06) * gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
          g.connect(a.destination);
          if (n.noise) {
            const buf = a.createBuffer(1, Math.ceil(a.sampleRate * n.d), a.sampleRate), data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
            const src = a.createBufferSource(); src.buffer = buf;
            // `f` on a noise burst is where to cut it off: low for a thud, high for a hiss.
            if (n.f > 0) { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = n.f; src.connect(lp); lp.connect(g); } else src.connect(g);
            src.start(t);
          } else {
            const osc = a.createOscillator(); osc.type = n.type ?? 'sine';
            osc.frequency.setValueAtTime(n.f * k, t); if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to * k, t + n.d);
            osc.connect(g); osc.start(t); osc.stop(t + n.d + 0.02);
          }
        }
      } catch { /* no audio: the game is silent, nothing else changes */ }
    },
  };
}

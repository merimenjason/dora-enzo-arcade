/* Soft synthesized cues: no audio files, and silent until the player switches sound on. */
export type Cue = 'visit' | 'happy' | 'away' | 'coat' | 'return' | 'step';
const CUES: Record<
  Cue,
  { notes: number[]; wave: OscillatorType; gain: number; gap: number; length: number }
> = {
  visit: { notes: [587], wave: 'sine', gain: 0.05, gap: 0, length: 0.5 },
  happy: { notes: [587, 784], wave: 'sine', gain: 0.05, gap: 0.11, length: 0.6 },
  away: { notes: [262, 220], wave: 'triangle', gain: 0.04, gap: 0.16, length: 0.5 },
  coat: { notes: [784, 988, 1175], wave: 'sine', gain: 0.045, gap: 0.09, length: 0.7 },
  return: { notes: [392, 523, 659, 784], wave: 'triangle', gain: 0.045, gap: 0.12, length: 0.7 },
  step: { notes: [150], wave: 'triangle', gain: 0.03, gap: 0, length: 0.08 },
};
let ctx: AudioContext | null = null;
/** Browsers only start audio inside a user gesture, so call this from a click or key press. */
export function enableSound() {
  if (typeof window === 'undefined') return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  ctx ??= new Ctor();
  void ctx.resume();
}
export function playCue(cue: Cue) {
  const c = ctx;
  // Stay quiet in background tabs: offline catch-up should not burst out a pile of chimes.
  if (!c || c.state !== 'running' || document.hidden) return;
  const { notes, wave, gain, gap, length } = CUES[cue];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * gap;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(env).connect(c.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  });
}

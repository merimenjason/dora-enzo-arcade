import type { RollEvent } from '@/lib/roll-game';

/** Little synthesised sounds: a pop for every thing that sticks (lower for bigger things), bumps, chimes. Unlocked by a gesture. */
export class RollSound {
  private context: AudioContext | null = null;
  private off = false;
  private noise: AudioBuffer | null = null;
  private last = new Map<string, number>();
  constructor() { try { this.off = localStorage.getItem('fluff-roll-sound-v1') === 'off'; } catch { /* optional storage */ } }
  muted() { return this.off; }
  setMuted(off: boolean) { this.off = off; try { localStorage.setItem('fluff-roll-sound-v1', off ? 'off' : 'on'); } catch { /* optional storage */ } }
  unlock() {
    if (!this.context) { try { this.context = new AudioContext(); } catch { return; } }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }
  private note(type: OscillatorType, from: number, to: number, at: number, duration: number, level: number) {
    const c = this.context!, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + duration + 0.03); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  private hiss(kind: BiquadFilterType, from: number, to: number, duration: number, level: number, at = 0) {
    const c = this.context!;
    if (!this.noise) { const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
    s.buffer = this.noise; f.type = kind; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + duration); f.Q.value = 1.2;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + duration + 0.03); s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }
  /** `share` is how big the thing was next to the ball (0..0.6), so a big catch sounds bigger. */
  cue(e: RollEvent, share = 0.2) {
    const c = this.context; if (this.off || !c || c.state !== 'running') return;
    const now = c.currentTime, gap = e.kind === 'stick' ? 0.035 : 0.08, prev = this.last.get(e.kind) ?? -1; if (now - prev < gap) return; this.last.set(e.kind, now);
    switch (e.kind) {
      case 'stick': { const f = (1500 - share * 1500 + Math.random() * 120) * (1 + Math.min(e.streak, 15) * 0.03); this.note('sine', f, f * 0.55, 0, 0.09 + share * 0.2, 0.05 + share * 0.12); if (share > 0.3) this.hiss('lowpass', 1200, 300, 0.2, 0.08); break; }
      case 'bump': this.note('triangle', 200, 120, 0, 0.14, 0.12); this.hiss('lowpass', 900, 200, 0.12, 0.08); break;
      case 'fence': this.note('triangle', 260, 170, 0, 0.12, 0.1); break;
      case 'knock': [880, 660, 520].forEach((f, i) => this.note('sine', f, f * 0.8, i * 0.06, 0.12, 0.06)); break;
      case 'grow': this.note('triangle', 784, 784, 0, 0.16, 0.05); this.note('triangle', 1047, 1047, 0.08, 0.2, 0.05); break;
      case 'golden': [988, 1319, 1568, 1976].forEach((f, i) => this.note('sine', f, f, i * 0.07, 0.3, 0.06)); break;
      case 'ready': this.note('triangle', 659, 659, 0, 0.12, 0.05); this.note('triangle', 880, 880, 0.07, 0.18, 0.05); break;
      case 'goal': [523, 659, 784, 1047, 1319].forEach((f, i) => this.note('triangle', f, f, i * 0.1, 0.32, 0.07)); break;
      case 'tick': this.note('square', 1320, 1320, 0, 0.05, 0.03); break;
      case 'end': (e.reached ? [784, 988, 1175, 1568] : [523, 494, 523, 659]).forEach((f, i) => this.note('triangle', f, f, i * 0.14, 0.36, 0.06)); break;
    }
  }
  dispose() { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}

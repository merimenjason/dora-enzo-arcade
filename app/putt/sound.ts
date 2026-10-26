import type { PuttEvent } from '@/lib/putt-game';

/** Little synthesised course sounds: a wooden tock, rail knocks, mushroom boings, the cup's plunk. Unlocked by a gesture. */
export class PuttSound {
  private context: AudioContext | null = null;
  private off = false;
  private noise: AudioBuffer | null = null;
  private last = new Map<string, number>();
  constructor() { try { this.off = localStorage.getItem('puttering-paws-sound-v1') === 'off'; } catch { /* optional storage */ } }
  muted() { return this.off; }
  setMuted(off: boolean) { this.off = off; try { localStorage.setItem('puttering-paws-sound-v1', off ? 'off' : 'on'); } catch { /* optional storage */ } }
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
  cue(e: PuttEvent) {
    const c = this.context; if (this.off || !c || c.state !== 'running') return;
    // rattly sounds can fire every physics step; keep each to one per 60 ms
    const now = c.currentTime, prev = this.last.get(e.kind) ?? -1; if (now - prev < 0.06) return; this.last.set(e.kind, now);
    const speed = Math.min(1, (e.speed ?? 3) / 7);
    switch (e.kind) {
      case 'putt': this.hiss('bandpass', 2400, 1200, 0.05, 0.12 + speed * 0.12); this.note('sine', 980, 620, 0, 0.08, 0.08 + speed * 0.06); break;
      case 'wall': this.note('triangle', 260 + speed * 120, 170, 0, 0.09, 0.04 + speed * 0.1); this.hiss('bandpass', 900, 500, 0.04, 0.04 + speed * 0.06); break;
      case 'gate': this.note('triangle', 220, 150, 0, 0.12, 0.12); break;
      case 'bumper': this.note('sine', 320, 760, 0, 0.18, 0.1); this.note('sine', 640, 1100, 0.02, 0.12, 0.04); break;
      case 'mover': this.note('sawtooth', 120, 80, 0, 0.22, 0.05); this.note('sine', 180, 140, 0.05, 0.2, 0.06); break;
      case 'lip': this.note('sine', 1500, 1300, 0, 0.07, 0.07); this.note('sine', 1180, 1000, 0.06, 0.07, 0.05); break;
      case 'cup': this.note('sine', 520, 240, 0, 0.22, 0.14); this.hiss('lowpass', 1600, 300, 0.18, 0.08, 0.05); [784, 988, 1175].forEach((f, i) => this.note('triangle', f, f, 0.22 + i * 0.09, 0.22, 0.06)); if (e.strokes === 1) [1319, 1568, 2093].forEach((f, i) => this.note('triangle', f, f, 0.55 + i * 0.1, 0.35, 0.06)); break;
      case 'pickup': this.note('triangle', 523, 523, 0, 0.18, 0.05); this.note('triangle', 659, 659, 0.12, 0.25, 0.05); break;
      case 'splash': this.hiss('lowpass', 2600, 240, 0.55, 0.22); this.note('sine', 420, 160, 0, 0.25, 0.06); break;
      case 'sand': this.hiss('highpass', 1800, 3200, 0.22, 0.05 + speed * 0.06); break;
      case 'tunnel-in': this.note('sine', 700, 180, 0, 0.35, 0.08); break;
      case 'tunnel-out': this.note('sine', 260, 760, 0, 0.16, 0.09); break;
      case 'acorn': [1047, 1319, 1568, 2093].forEach((f, i) => this.note('triangle', f, f, i * 0.07, 0.26, 0.06)); break;
      case 'hole': this.note('triangle', 392, 392, 0, 0.2, 0.04); this.note('triangle', 523, 523, 0.12, 0.3, 0.04); break;
      case 'turn': this.note('triangle', 523, 523, 0, 0.18, 0.04); break;
      case 'round': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.note('triangle', f, f, i * 0.12, 0.3, 0.06)); break;
      default: break;
    }
  }
  dispose() { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}

// Kit Parade's little sounds: pops, boings, chimes and a soft "wheee", each a few short oscillator notes made on
// demand (no samples, no music rendering), with a mute switch the page saves in the profile.
import type { ParadeEvent } from '@/lib/parade-game';

type Kind = ParadeEvent['kind'] | 'select' | 'win' | 'short' | 'tap';

export class ParadeSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private last = new Map<string, number>();
  muted = false;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.5; this.out.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setMuted(m: boolean) { this.muted = m; if (this.out) this.out.gain.value = m ? 0 : 0.5; }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  /** One note: a wave from one pitch to another with a quick fade. */
  private note(type: OscillatorType, from: number, to: number, at: number, dur: number, level: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out!); o.start(t); o.stop(t + dur + 0.02);
  }
  /** A puff of soft noise, for digging and splashes. */
  private hush(at: number, dur: number, level: number, freq: number) {
    const c = this.ctx!, n = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) { const x = Math.sin(i * 12.9898) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out!); s.start(t); s.stop(t + dur);
  }
  play(kind: Kind) {
    if (!this.ctx || !this.out || this.muted) return;
    // never pile up: each sound at most every so often
    const now = performance.now(), gap = kind === 'dig' || kind === 'bale' ? 120 : kind === 'spawn' ? 60 : 50;
    if (now - (this.last.get(kind) ?? 0) < gap) return;
    this.last.set(kind, now);
    switch (kind) {
      case 'spawn': this.note('sine', 520, 880, 0, 0.09, 0.18); break;
      case 'assign': this.note('triangle', 660, 990, 0, 0.07, 0.2); this.note('sine', 1320, 1320, 0.05, 0.06, 0.1); break;
      case 'select': case 'tap': this.note('sine', 740, 740, 0, 0.05, 0.12); break;
      case 'home': this.note('sine', 784, 784, 0, 0.12, 0.2); this.note('sine', 1175, 1175, 0.08, 0.18, 0.18); break;
      case 'bounce': this.note('sine', 220, 660, 0, 0.18, 0.25); this.note('triangle', 520, 1040, 0.12, 0.25, 0.1); break;
      case 'glide': this.note('sine', 1200, 600, 0, 0.5, 0.08); break;
      case 'dizzy': this.note('triangle', 520, 300, 0, 0.18, 0.15); this.note('triangle', 480, 260, 0.16, 0.2, 0.12); break;
      case 'splash': this.hush(0, 0.25, 0.25, 1400); this.note('sine', 900, 300, 0, 0.12, 0.08); break;
      case 'dig': this.hush(0, 0.07, 0.18, 380); break;
      case 'bale': this.note('square', 330, 300, 0, 0.04, 0.05); this.note('sine', 220, 200, 0, 0.06, 0.12); break;
      case 'hug': for (const [i, f] of [523, 659, 784].entries()) this.note('sine', f, f, i * 0.06, 0.35, 0.12); break;
      case 'puff': this.hush(0, 0.18, 0.12, 2400); this.note('sine', 300, 500, 0, 0.12, 0.1); break;
      case 'climbed': this.note('triangle', 600, 900, 0, 0.08, 0.1); break;
      case 'shrug': this.note('triangle', 400, 340, 0, 0.12, 0.1); break;
      case 'win': for (const [i, f] of [523, 659, 784, 1047].entries()) this.note('triangle', f, f, i * 0.11, 0.3, 0.18); break;
      case 'short': for (const [i, f] of [523, 466, 392].entries()) this.note('sine', f, f, i * 0.16, 0.3, 0.14); break;
      default: break;
    }
  }
}

// Snapshot Safari's little sounds: a shutter, a soft whistle, berries landing, a chime for new journal slots and a
// twinkle per star. A few short oscillators and one noise buffer, made only when a sound plays.
export class SafariSound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  private get c() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  /** Call from a click or key press so the browser lets sound start. */
  unlock() { void this.c; }
  private tone(f: number, at: number, dur: number, type: OscillatorType = 'sine', level = 0.12, to?: number) {
    const c = this.c; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(at: number, dur: number, freq: number, level: number) {
    const c = this.c; if (!c) return;
    if (!this.noise) {
      this.noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  shutter() { this.hiss(0, 0.04, 3200, 0.35); this.hiss(0.07, 0.05, 2200, 0.25); this.tone(1800, 0, 0.03, 'square', 0.03); }
  whistle() { this.tone(1300, 0, 0.22, 'sine', 0.08, 1700); this.tone(1700, 0.26, 0.3, 'sine', 0.07, 1250); }
  toss() { for (let i = 0; i < 4; i++) this.tone(500 + i * 90, i * 0.05, 0.08, 'triangle', 0.06); }
  trap() { this.tone(880, 0, 0.08, 'square', 0.03); this.tone(660, 0.1, 0.1, 'square', 0.03); }
  scurry() { this.hiss(0, 0.18, 900, 0.08); this.hiss(0.12, 0.15, 1100, 0.06); }
  late() { this.tone(523, 0, 0.3, 'triangle', 0.07); this.tone(392, 0.3, 0.45, 'triangle', 0.07); }
  tap() { this.tone(660, 0, 0.06, 'triangle', 0.05); }
  star(i: number) { this.tone(880 * Math.pow(2, (i * 2) / 12), 0, 0.18, 'triangle', 0.06); }
  chime() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.4, 'triangle', 0.07)); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
}

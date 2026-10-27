// Dust Bunny Dungeon's little sounds: short Web Audio blips made on the spot, nothing rendered ahead of time.
// Sound on or off is kept in localStorage under its own key.
const KEY = 'dust-bunny-dungeon-sound-v1';

export class DungeonSound {
  private ctx: AudioContext | null = null;
  private off = false;
  constructor() { try { this.off = localStorage.getItem(KEY) === 'off'; } catch { /* storage is optional */ } }
  muted() { return this.off; }
  setMuted(on: boolean) { this.off = on; try { localStorage.setItem(KEY, on ? 'off' : 'on'); } catch { /* storage is optional */ } }
  unlock() {
    if (this.off) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx && AC) this.ctx = new AC();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    } catch { this.ctx = null; }
  }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  /** One soft note: a waveform sliding from one pitch to another. */
  private tone(type: OscillatorType, from: number, to: number, dur: number, level = 0.12, delay = 0) {
    if (this.off) return;
    this.unlock(); const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  step() { this.tone('triangle', 220, 180, 0.05, 0.05); }
  bop() { this.tone('square', 330, 160, 0.08, 0.07); }
  bonk() { this.tone('triangle', 140, 70, 0.12, 0.14); }
  poof() { this.tone('sine', 520, 980, 0.12, 0.08); this.tone('sine', 780, 1400, 0.1, 0.05, 0.05); }
  hurt() { this.tone('sawtooth', 300, 120, 0.22, 0.09); }
  pick() { this.tone('sine', 660, 990, 0.08, 0.08); this.tone('sine', 990, 1320, 0.08, 0.06, 0.07); }
  heal() { this.tone('sine', 520, 780, 0.15, 0.08); this.tone('sine', 780, 1040, 0.15, 0.06, 0.1); }
  whoosh() { this.tone('triangle', 900, 300, 0.16, 0.05); }
  clunk() { this.tone('square', 120, 90, 0.1, 0.08); this.tone('square', 180, 120, 0.08, 0.06, 0.06); }
  nope() { this.tone('triangle', 200, 160, 0.08, 0.06); }
  stairs() { [392, 330, 262, 196].forEach((f, k) => this.tone('triangle', f, f * 0.98, 0.12, 0.08, k * 0.08)); }
  surprise() { this.tone('square', 260, 520, 0.12, 0.06); }
  fanfare(won: boolean) {
    const notes = won ? [523, 659, 784, 1047, 784, 1047] : [392, 349, 311, 262];
    notes.forEach((f, k) => this.tone(won ? 'triangle' : 'sine', f, f, 0.2, 0.09, k * 0.14));
  }
}

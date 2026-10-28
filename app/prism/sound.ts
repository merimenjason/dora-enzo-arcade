// Prism Paws' little sounds, made on demand from a few oscillator notes (no files): a chime for each lantern lit, pitched
// by its colour on a pentatonic scale, a soft click to place or turn a piece, a sleepy "mrrp" when a kit wakes and a short
// arpeggio for a win. Nothing plays until the first tap or key, and the page saves the on/off switch.
export type SoundKind = 'place' | 'turn' | 'lift' | 'lit' | 'wake' | 'firefly' | 'win' | 'nope' | 'tap' | 'hint';

/** C major pentatonic, one note per colour mask 1-7. */
const CHIME = [0, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

export class PrismSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private last = new Map<string, number>();
  on = true;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = this.on ? 0.45 : 0; this.out.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setOn(on: boolean) { this.on = on; if (this.out) this.out.gain.value = on ? 0.45 : 0; }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  private note(type: OscillatorType, from: number, to: number, at: number, dur: number, level: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out!); o.start(t); o.stop(t + dur + 0.02);
  }
  play(kind: SoundKind, colour = 7, delay = 0) {
    if (!this.ctx || !this.out || !this.on) return;
    const now = performance.now(), key = kind === 'lit' ? `lit${colour}` : kind;
    if (now - (this.last.get(key) ?? 0) < 40) return;
    this.last.set(key, now);
    const d = delay;
    switch (kind) {
      case 'place': this.note('triangle', 900, 620, d, 0.06, 0.16); this.note('sine', 1400, 1400, d + 0.02, 0.05, 0.06); break;
      case 'turn': this.note('triangle', 760, 980, d, 0.05, 0.12); break;
      case 'lift': this.note('triangle', 620, 900, d, 0.06, 0.1); break;
      case 'tap': this.note('sine', 740, 740, d, 0.05, 0.1); break;
      case 'nope': this.note('triangle', 300, 240, d, 0.1, 0.08); break;
      case 'hint': this.note('sine', 988, 988, d, 0.12, 0.08); this.note('sine', 1318, 1318, d + 0.08, 0.16, 0.06); break;
      case 'lit': { const f = CHIME[colour] ?? 660; this.note('sine', f, f, d, 0.7, 0.16); this.note('sine', f * 2, f * 2, d, 0.4, 0.05); this.note('triangle', f * 1.5, f * 1.5, d + 0.03, 0.3, 0.03); break; }
      case 'wake': this.note('triangle', 380, 520, d, 0.12, 0.12); this.note('triangle', 520, 330, d + 0.11, 0.2, 0.1); break;
      case 'firefly': for (const [i, f] of [1318, 1568, 2093].entries()) this.note('sine', f, f, d + i * 0.05, 0.15, 0.06); break;
      case 'win': for (const [i, f] of [523.25, 659.25, 783.99, 1046.5, 1318.5].entries()) this.note('triangle', f, f, d + 0.25 + i * 0.1, 0.5, 0.14); break;
    }
  }
}

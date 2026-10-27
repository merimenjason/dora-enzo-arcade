// Pebble Pop's little sounds: each one a single short oscillator or a puff of noise, so they stay light even with
// five pebbles bouncing. Block hits climb a pentatonic scale with the combo.
import type { BlockType, PebbleEvent } from '@/lib/pebble-game';

const SCALE = [0, 2, 4, 7, 9];
const note = (step: number) => 392 * Math.pow(2, (SCALE[step % 5] + 12 * Math.floor(step / 5)) / 12);

export class PebbleSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private off = false;
  private last = new Map<string, number>();
  constructor(on: boolean) { this.off = !on; }
  setOn(on: boolean) { this.off = !on; if (this.out && this.ctx) this.out.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.02); }
  /** Starts audio; must be called from a click or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      this.out = this.ctx.createGain(); this.out.gain.value = this.off ? 0 : 0.5; this.out.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.4), this.ctx.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  /** Skips a sound that already played in the last `gap` seconds (multiball can hit many blocks at once). */
  private ok(key: string, gap: number) {
    const c = this.ctx; if (!c || this.off) return false;
    const t = c.currentTime; if ((this.last.get(key) ?? -1) > t - gap) return false; this.last.set(key, t); return true;
  }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(this.out!); o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(type: BiquadFilterType, f: number, dur: number, level: number, at = 0) {
    const c = this.ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
    s.buffer = this.noise; bq.type = type; bq.frequency.value = f; g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(this.out!); s.start(t, (f % 7) * 0.03); s.stop(t + dur + 0.02);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone('triangle', 660, 880, 0.07, 0.25); }
  buy() { if (this.ok('buy', 0.05)) { this.tone('triangle', 784, 784, 0.08, 0.3); this.tone('triangle', 1175, 1175, 0.12, 0.25, 0.07); } }
  private hit(type: BlockType, combo: number, popped: boolean) {
    if (type === 'dust') { if (this.ok('dust', 0.05)) this.hiss('lowpass', 900, 0.25, 0.35); return; }
    if (!this.ok('hit', 0.03)) return;
    const f = note(Math.min(14, combo));
    if (type === 'ice') { this.tone('sine', f * 2, f * 2.02, 0.12, 0.22); this.hiss('highpass', 5000, popped ? 0.15 : 0.06, popped ? 0.3 : 0.18); return; }
    if (type === 'moss') { this.tone('sine', f * 0.75, f * 0.6, 0.1, 0.25); return; }
    this.tone(popped ? 'triangle' : 'square', f, f * (popped ? 1.02 : 0.9), popped ? 0.12 : 0.06, popped ? 0.3 : 0.12);
    if (popped && (type === 'crate' || type === 'stout' || type === 'slide')) this.hiss('bandpass', 1400, 0.05, 0.2);
  }
  /** Plays whatever a batch of game events calls for. */
  play(events: PebbleEvent[]) {
    if (!this.ctx || this.off) return;
    for (const e of events) {
      switch (e.k) {
        case 'hit': this.hit(e.type, e.combo, e.popped); break;
        case 'paddle': if (this.ok('paddle', 0.04)) { this.tone('sine', 180, 110, 0.12, 0.45); this.hiss('lowpass', 600, 0.06, 0.25); if (e.spin >= 0.25) this.tone('sawtooth', 600, 1400, 0.18, 0.08); } break;
        case 'bounce': if (this.ok('bounce', 0.05)) this.tone('sine', 520, 480, 0.04, 0.12); break;
        case 'chain': if (this.ok('chain', 0.05)) { this.tone('square', 900, 300, 0.18, 0.12); this.hiss('bandpass', 2500, 0.12, 0.2); } break;
        case 'spark': if (this.ok('spark', 0.05)) this.tone('sawtooth', 1800, 2600, 0.06, 0.06); break;
        case 'burst': if (this.ok('burst', 0.08)) { this.hiss('lowpass', 1200, 0.3, 0.45); this.tone('sine', 140, 60, 0.25, 0.35); } break;
        case 'acorn': if (this.ok('acorn', 0.06)) { this.tone('sine', 1319, 1319, 0.08, 0.2); this.tone('sine', 1760, 1760, 0.12, 0.18, 0.06); } break;
        case 'drop': if (this.ok('drop', 0.08)) for (let i = 0; i < 3; i++) this.tone('sine', 1100 + i * 220, 1000 + i * 220, 0.05, 0.12, i * 0.04); break;
        case 'shield': if (this.ok('shield', 0.1)) { this.hiss('bandpass', 700, 0.35, 0.45); this.tone('sine', 300, 700, 0.25, 0.2); } break;
        case 'lost': this.tone('triangle', 520, 180, 0.6, 0.3); break;
        case 'launch': if (this.ok('launch', 0.1)) this.tone('sine', 300, 900, 0.14, 0.25); break;
        case 'catch': if (this.ok('catch', 0.05)) this.tone('sine', 400, 300, 0.08, 0.3); break;
        case 'combo': for (let i = 0; i < 3; i++) this.tone('triangle', note(5 + i * 2), note(5 + i * 2), 0.1, 0.22, i * 0.06); break;
        case 'boss': if (this.ok('boss', 0.08)) { this.tone('sawtooth', 110, 80, 0.3, 0.14); this.tone('sine', 220, 160, 0.2, 0.3); } break;
        case 'rebuild': this.tone('sawtooth', 90, 70, 0.5, 0.1); break;
        case 'clear': for (let i = 0; i < 5; i++) this.tone('triangle', note(5 + i), note(5 + i), 0.18, 0.25, i * 0.08); this.tone('sine', note(10), note(10), 0.5, 0.2, 0.42); break;
        default: break;
      }
    }
  }
  /** A short tune at the end of a run: rising for a win, a gentle shrug otherwise. */
  end(won: boolean) {
    if (!this.ctx || this.off) return;
    const steps = won ? [0, 2, 4, 5, 7, 10] : [4, 3, 2, 0];
    steps.forEach((s, i) => this.tone('triangle', note(s + 3), note(s + 3), won ? 0.22 : 0.3, 0.25, i * (won ? 0.11 : 0.18)));
  }
}

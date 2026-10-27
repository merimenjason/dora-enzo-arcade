// Hayloft Tycoon's little sounds: a few short Web Audio blips, nothing rendered ahead and nothing that runs while idle.
import { MUTE_KEY } from '@/lib/hayloft-game';

export class HayloftSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private off = false;
  private last = new Map<string, number>();
  constructor() { try { this.off = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage is optional */ } }
  muted() { return this.off; }
  setMuted(on: boolean) { this.off = on; try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch { /* storage is optional */ } }
  /** Browsers only allow sound after a tap: call this from one. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = 0.32; this.out.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  /** One soft note; `gap` keeps a sound from piling up when it fires often. */
  private note(key: string, freq: number, dur: number, type: OscillatorType, level: number, at = 0, slide = 1, gap = 0.035) {
    const c = this.ctx, out = this.out; if (this.off || !c || !out || c.state !== 'running') return;
    const now = c.currentTime + at, prev = this.last.get(key) ?? -1; if (at === 0 && now - prev < gap) return; this.last.set(key, now);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, now + dur);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(level, now + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(out); o.start(now); o.stop(now + dur + 0.02);
  }
  tap() { this.note('tap', 520 + Math.random() * 120, 0.09, 'sine', 0.25, 0, 1.5, 0.05); }
  coin() { this.note('coin', 1320, 0.07, 'triangle', 0.08, 0, 1.2, 0.12); }
  buy() { this.note('buy', 660, 0.08, 'triangle', 0.22); this.note('buy2', 990, 0.1, 'triangle', 0.18, 0.06); }
  nope() { this.note('nope', 220, 0.12, 'sine', 0.15, 0, 0.8); }
  milestone() { [0, 4, 7, 12].forEach((s, k) => this.note('ms' + k, 523 * 2 ** (s / 12), 0.22, 'triangle', 0.2, k * 0.07)); }
  burst() { [0, 5, 9, 12, 16].forEach((s, k) => this.note('bu' + k, 659 * 2 ** (s / 12), 0.18, 'sine', 0.18, k * 0.05)); }
  catch() { this.note('ca', 880, 0.12, 'sine', 0.22, 0, 1.5); this.note('ca2', 1320, 0.16, 'sine', 0.16, 0.08, 1.2); }
  twig(gold: boolean) { this.note('tw', gold ? 1175 : 784, 0.08, 'triangle', 0.2, 0, 1.3, 0.02); }
  gift() { [0, 7, 12, 16, 19].forEach((s, k) => this.note('gi' + k, 523 * 2 ** (s / 12), 0.3, 'triangle', 0.17, k * 0.09)); }
  migrate() { [0, 4, 7, 11, 14, 19, 24].forEach((s, k) => this.note('mi' + k, 392 * 2 ** (s / 12), 0.5, 'sine', 0.16, k * 0.11)); }
  dispose() { try { void this.ctx?.close(); } catch { /* already closed */ } this.ctx = null; }
}

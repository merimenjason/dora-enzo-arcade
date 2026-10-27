import type { GameEvent } from '@/lib/pawhaven-game';

/** Little synthesised sounds for the town: a plop for building, chimes for a home growing, bells for a caravan. */
export class HavenSound {
  private context: AudioContext | null = null;
  private off = false;
  private last = new Map<string, number>();
  constructor() { try { this.off = localStorage.getItem('pawhaven-sound-v1') === 'off'; } catch { /* optional storage */ } }
  muted() { return this.off; }
  setMuted(off: boolean) { this.off = off; try { localStorage.setItem('pawhaven-sound-v1', off ? 'off' : 'on'); } catch { /* optional storage */ } }
  unlock() {
    if (!this.context) { try { this.context = new AudioContext(); } catch { return; } }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }
  private note(type: OscillatorType, from: number, to: number, at: number, duration: number, level: number) {
    const c = this.context!, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + duration + 0.03); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  private ready(key: string, gap: number) {
    const c = this.context; if (this.off || !c || c.state !== 'running') return false;
    const prev = this.last.get(key) ?? -9; if (c.currentTime - prev < gap) return false; this.last.set(key, c.currentTime); return true;
  }
  /** The player's own actions. */
  play(kind: 'build' | 'road' | 'clear' | 'nope' | 'click') {
    if (!this.ready(kind, 0.05)) return;
    if (kind === 'build') { this.note('sine', 520, 260, 0, 0.14, 0.08); this.note('triangle', 780, 780, 0.05, 0.1, 0.03); }
    else if (kind === 'road') this.note('triangle', 300, 220, 0, 0.06, 0.04);
    else if (kind === 'clear') this.note('triangle', 260, 140, 0, 0.16, 0.06);
    else if (kind === 'nope') this.note('square', 200, 180, 0, 0.12, 0.03);
    else this.note('sine', 900, 900, 0, 0.04, 0.03);
  }
  cue(e: GameEvent) {
    switch (e.kind) {
      case 'levelUp': if (this.ready(e.kind, 0.25)) [659, 880].forEach((f, i) => this.note('triangle', f, f, i * 0.07, 0.18, 0.04)); break;
      case 'levelDown': if (this.ready(e.kind, 0.6)) this.note('sine', 440, 330, 0, 0.25, 0.04); break;
      case 'newcomer': if (this.ready(e.kind, 1.2)) this.note('sine', 1320, 1180, 0, 0.06, 0.02); break;
      case 'fire': if (this.ready(e.kind, 1)) [880, 660, 880, 660].forEach((f, i) => this.note('square', f, f, i * 0.12, 0.1, 0.025)); break;
      case 'fireOut': if (this.ready(e.kind, 0.5)) this.note('sine', 600, 900, 0, 0.2, 0.05); break;
      case 'fox': if (this.ready(e.kind, 1)) this.note('triangle', 700, 900, 0, 0.12, 0.04); break;
      case 'foxChased': if (this.ready(e.kind, 1)) this.note('triangle', 900, 500, 0, 0.2, 0.04); break;
      case 'caravan': if (this.ready(e.kind, 1)) [1047, 1319, 1568].forEach((f, i) => this.note('sine', f, f, i * 0.09, 0.25, 0.04)); break;
      case 'year': if (this.ready(e.kind, 1)) [523, 659, 784].forEach((f, i) => this.note('triangle', f, f, i * 0.1, 0.3, 0.04)); break;
      case 'goal': if (this.ready(e.kind, 0.5)) [784, 988, 1175].forEach((f, i) => this.note('triangle', f, f, i * 0.1, 0.3, 0.05)); break;
      case 'won': if (this.ready(e.kind, 1)) [523, 659, 784, 1047, 1319].forEach((f, i) => this.note('triangle', f, f, i * 0.12, 0.4, 0.06)); break;
    }
  }
  dispose() { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}

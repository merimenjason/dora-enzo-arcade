// Burrow Command's sounds: small Web Audio blips made on the spot, no files. Bumps are soft thocks, poofs are a puff of
// noise and a rising chirp, and each side answers an order in its own voice.
export type Cue = 'click' | 'select' | 'order' | 'place' | 'built' | 'trained' | 'research' | 'poof' | 'tidy' | 'hit' | 'alert' | 'say' | 'error' | 'win' | 'lose' | 'ability' | 'tunnel' | 'trap';

export class CommandSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Cue, number>();
  private mute = false;
  /** Muting is saved with the rest of the settings in the profile (burrow-command-v1). */
  constructor(muted: boolean) { this.mute = muted; }
  muted() { return this.mute; }
  setMuted(on: boolean) {
    this.mute = on;
    if (this.out) this.out.gain.value = on ? 0 : 0.5;
  }
  /** Browsers only allow sound after a click or key, so the context is made on the first one. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = this.mute ? 0 : 0.5; this.out.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the puff always sounds the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    } catch { this.ctx = null; }
  }
  private tone(type: OscillatorType, from: number, to: number, at: number, dur: number, level: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(level, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(this.out!); o.start(at); o.stop(at + dur + 0.02);
  }
  private hiss(f: number, q: number, at: number, dur: number, level: number, type: BiquadFilterType = 'bandpass') {
    const c = this.ctx!, s = c.createBufferSource(), b = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; b.type = type; b.frequency.value = f; b.Q.value = q;
    g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(b); b.connect(g); g.connect(this.out!); s.start(at); s.stop(at + dur + 0.02);
  }
  /** Plays a cue; `side` gives orders and selections their side's voice. Busy cues are thinned out. */
  play(cue: Cue, side: string = 'colony') {
    const c = this.ctx; if (!c || this.mute || c.state !== 'running') return;
    const now = c.currentTime, gap: Partial<Record<Cue, number>> = { hit: 0.07, poof: 0.08, trained: 0.15, select: 0.08, order: 0.08, say: 0.3, alert: 2 };
    if (now - (this.last.get(cue) ?? -9) < (gap[cue] ?? 0.03)) return;
    this.last.set(cue, now);
    const voice = side === 'guild' ? 0.8 : side === 'hive' ? 1.25 : 1;
    switch (cue) {
      case 'click': this.tone('triangle', 900, 700, now, 0.05, 0.12); break;
      case 'select':
        if (side === 'hive') { this.tone('square', 1400, 1400, now, 0.02, 0.05); this.tone('square', 1700, 1700, now + 0.04, 0.02, 0.05); }
        else this.tone('sine', 720 * voice, 980 * voice, now, 0.09, 0.15);
        break;
      case 'order':
        if (side === 'hive') { this.tone('square', 900, 900, now, 0.025, 0.05); this.hiss(5000, 2, now + 0.03, 0.04, 0.08); }
        else { this.tone('sine', 600 * voice, 820 * voice, now, 0.07, 0.14); this.tone('sine', 820 * voice, 700 * voice, now + 0.07, 0.07, 0.1); }
        break;
      case 'place': this.hiss(500, 0.8, now, 0.15, 0.25); this.tone('triangle', 220, 160, now, 0.12, 0.18); break;
      case 'built': [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, now + i * 0.08, 0.16, 0.13)); break;
      case 'trained': this.tone('sine', 660 * voice, 990 * voice, now, 0.12, 0.13); break;
      case 'research': [659, 784, 988, 1319].forEach((f, i) => this.tone('sine', f, f, now + i * 0.07, 0.18, 0.1)); break;
      case 'hit': this.tone('sine', 220, 120, now, 0.06, 0.08); this.hiss(1800, 1, now, 0.04, 0.04); break;
      case 'poof': this.hiss(2400, 0.7, now, 0.3, 0.18); this.tone('sine', 500, 1100, now + 0.05, 0.2, 0.08); break;
      case 'tidy': this.hiss(700, 0.6, now, 0.5, 0.25); this.tone('triangle', 330, 200, now, 0.3, 0.1); break;
      case 'alert': this.tone('triangle', 880, 880, now, 0.12, 0.15); this.tone('triangle', 660, 660, now + 0.16, 0.16, 0.15); break;
      case 'say': this.tone('sine', 520, 600, now, 0.06, 0.07); this.tone('sine', 640, 560, now + 0.07, 0.06, 0.06); break;
      case 'error': this.tone('triangle', 300, 220, now, 0.14, 0.12); break;
      case 'ability': this.hiss(3200, 1.5, now, 0.35, 0.12); this.tone('sine', 700, 1400, now, 0.25, 0.1); break;
      case 'tunnel': this.hiss(400, 0.5, now, 0.35, 0.22, 'lowpass'); break;
      case 'trap': this.tone('square', 400, 260, now, 0.12, 0.08); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, now + i * 0.13, 0.3, 0.14)); break;
      case 'lose': [440, 392, 349, 330].forEach((f, i) => this.tone('sine', f, f, now + i * 0.2, 0.35, 0.12)); break;
    }
  }
  dispose() { void this.ctx?.close(); this.ctx = null; }
}

// Kopi Peng Brawl sounds, all synthesised with WebAudio: punchy noise-and-thump hits, clangs for trays and woks,
// the lion-dance drum and cymbal, train door chimes, thunder, a jet's roar, and a looping tune per stage (a
// pentatonic erhu-ish lead over a gong-and-woodblock beat). Silent until the first input.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type Tune = 'title' | 's1' | 's2' | 's3' | 's4' | 's5' | 'boss' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[]; lt: OscillatorType }> = {
  title: { bpm: 108, lt: 'triangle', lead: [74, 0, 76, 79, 81, 0, 79, 76, 74, 0, 71, 0, 69, 71, 74, 0, 76, 0, 79, 81, 84, 81, 79, 76, 74, 76, 74, 71, 69, 0, 0, 0], bass: [50, 50, 57, 50, 45, 45, 52, 45] },
  s1: { bpm: 138, lt: 'square', lead: [69, 72, 74, 76, 79, 76, 74, 72, 69, 0, 67, 69, 72, 0, 74, 0, 76, 79, 81, 79, 76, 74, 72, 74, 76, 0, 74, 72, 69, 0, 0, 0], bass: [45, 45, 52, 45, 43, 43, 50, 43] },
  s2: { bpm: 150, lt: 'sawtooth', lead: [74, 74, 77, 79, 81, 0, 79, 77, 74, 0, 72, 74, 77, 0, 79, 0, 81, 84, 86, 84, 81, 79, 77, 79, 81, 0, 79, 77, 74, 0, 0, 0], bass: [50, 50, 50, 57, 48, 48, 48, 55] },
  s3: { bpm: 144, lt: 'square', lead: [71, 0, 74, 76, 78, 76, 74, 71, 69, 71, 74, 0, 71, 0, 0, 0, 78, 0, 81, 83, 85, 83, 81, 78, 76, 78, 76, 74, 71, 0, 0, 0], bass: [47, 47, 54, 47, 45, 45, 52, 45] },
  s4: { bpm: 126, lt: 'triangle', lead: [64, 67, 69, 71, 74, 0, 71, 69, 67, 0, 64, 0, 62, 64, 67, 0, 69, 71, 74, 76, 79, 76, 74, 71, 69, 71, 69, 67, 64, 0, 0, 0], bass: [40, 40, 47, 40, 38, 38, 45, 38] },
  s5: { bpm: 156, lt: 'sawtooth', lead: [76, 79, 81, 83, 86, 83, 81, 79, 76, 0, 74, 76, 79, 0, 81, 0, 83, 86, 88, 86, 83, 81, 79, 81, 83, 0, 81, 79, 76, 0, 0, 0], bass: [52, 52, 59, 52, 50, 50, 57, 50] },
  boss: { bpm: 132, lt: 'sawtooth', lead: [62, 0, 62, 65, 67, 0, 65, 62, 60, 0, 60, 62, 63, 62, 60, 58, 62, 0, 62, 65, 67, 70, 69, 67, 65, 0, 63, 62, 60, 0, 0, 0], bass: [38, 38, 45, 38, 36, 36, 43, 36] },
};

export class KopiSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; mus: GainNode | null = null; noise: AudioBuffer | null = null;
  sfxOn = true; musicOn = true;
  private tune: Tune = null; private timer: number | null = null; private next = 0; private n = 0; private last: Record<string, number> = {};

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new C(); this.ctx = ctx;
      this.out = ctx.createGain(); this.out.gain.value = 0.5; this.out.connect(ctx.destination);
      this.mus = ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0; this.mus.connect(this.out);
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
      let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      this.noise = b;
      if (this.tune) { const t = this.tune; this.tune = null; this.music(t); }
    } catch { this.ctx = null; }
  }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, to?: number, dest?: AudioNode) {
    const c = this.ctx!; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(dest ?? this.out!); o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', dest?: AudioNode) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest ?? this.out!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  play(name: string) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime; if ((this.last[name] ?? 0) > t - 0.04) return; this.last[name] = t;
    switch (name) {
      case 'swing': this.hiss(t, 0.09, 0.18, 2200, 0.8); break;
      case 'POK': case 'hit': this.tone(160, t, 0.08, 'sine', 0.6, 70); this.hiss(t, 0.05, 0.3, 1800); break;
      case 'PANG': case 'DUSH': this.tone(200, t, 0.12, 'triangle', 0.6, 60); this.hiss(t, 0.08, 0.4, 1400); break;
      case 'WHAM': case 'BONK': this.tone(120, t, 0.2, 'sine', 0.9, 40); this.hiss(t, 0.12, 0.5, 900); break;
      case 'KRAK': this.tone(90, t, 0.3, 'square', 0.4, 30); this.hiss(t, 0.25, 0.6, 600, 0.5); break;
      case 'CLANG': for (const f of [523, 787, 1244]) this.tone(f, t, 0.5, 'square', 0.08); this.hiss(t, 0.1, 0.3, 4000); break;
      case 'SPLASH': this.hiss(t, 0.35, 0.5, 1200, 0.4, 'lowpass'); break;
      case 'SSSS': this.hiss(t, 0.6, 0.35, 5000, 2, 'highpass'); break;
      case 'OINK': this.tone(240, t, 0.18, 'sawtooth', 0.25, 160); this.tone(260, t + 0.18, 0.18, 'sawtooth', 0.25, 170); break;
      case 'CROAK': case 'croak': this.tone(110, t, 0.3, 'sawtooth', 0.3, 80); break;
      case 'KO': this.tone(90, t, 0.6, 'sine', 1, 30); this.hiss(t, 0.5, 0.6, 500, 0.4); for (const f of [392, 523, 659]) this.tone(f, t + 0.1, 0.5, 'triangle', 0.15); break;
      case 'jump': this.tone(300, t, 0.12, 'sine', 0.2, 600); break;
      case 'land': this.tone(110, t, 0.07, 'sine', 0.3, 60); break;
      case 'hurt': this.tone(330, t, 0.14, 'square', 0.15, 180); break;
      case 'pick': this.tone(600, t, 0.06, 'triangle', 0.25, 900); break;
      case 'throw': this.hiss(t, 0.18, 0.25, 1500, 0.6); break;
      case 'eat': for (let i = 0; i < 3; i++) this.tone(700 + i * 200, t + i * 0.07, 0.08, 'triangle', 0.2); break;
      case 'special': this.tone(200, t, 0.5, 'sawtooth', 0.25, 800); this.hiss(t, 0.4, 0.3, 3000); break;
      case 'team': for (const [i, f] of [262, 330, 392, 523, 659].entries()) this.tone(f, t + i * 0.06, 0.4, 'square', 0.12); this.tone(80, t + 0.8, 0.7, 'sine', 1, 30); break;
      case 'drum': this.tone(90, t, 0.18, 'sine', 0.5, 60); break;
      case 'lion': for (let i = 0; i < 4; i++) { this.tone(80, t + i * 0.15, 0.15, 'sine', 0.6, 50); this.hiss(t + i * 0.15 + 0.07, 0.2, 0.2, 6000, 0.5, 'highpass'); } break;
      case 'trolley': for (let i = 0; i < 6; i++) this.hiss(t + i * 0.09, 0.05, 0.2, 2500, 3); break;
      case 'doors': this.tone(784, t, 0.3, 'sine', 0.3); this.tone(659, t + 0.3, 0.4, 'sine', 0.3); break;
      case 'doorsclose': for (let i = 0; i < 4; i++) this.tone(880, t + i * 0.18, 0.1, 'square', 0.12); break;
      case 'curve': this.hiss(t, 1.0, 0.2, 3500, 6); break;
      case 'dark': this.tone(180, t, 0.4, 'sawtooth', 0.2, 40); break;
      case 'thunder': this.hiss(t, 1.6, 0.8, 200, 0.4, 'lowpass'); break;
      case 'rain': this.hiss(t, 3, 0.25, 4000, 0.3, 'highpass'); break;
      case 'rumble': this.hiss(t, 1.6, 0.5, 300, 0.5, 'lowpass'); break;
      case 'jet': this.hiss(t, 1.2, 0.9, 700, 0.3, 'lowpass'); this.tone(120, t, 1.0, 'sawtooth', 0.2, 60); break;
      case 'event': this.tone(988, t, 0.1, 'square', 0.15); this.tone(740, t + 0.1, 0.2, 'square', 0.15); break;
      case 'boss': this.tone(73, t, 1.2, 'sawtooth', 0.4, 55); this.hiss(t, 1.2, 0.3, 300, 0.5, 'lowpass'); break;
      case 'go': this.tone(523, t, 0.1, 'square', 0.15); this.tone(784, t + 0.1, 0.18, 'square', 0.15); break;
      case 'hop': this.tone(400, t, 0.1, 'sine', 0.2, 800); break;
      case 'snatch': case 'drop': this.tone(1200, t, 0.08, 'square', 0.12, 1800); break;
      case 'break': this.hiss(t, 0.3, 0.5, 2500, 0.6); this.tone(1400, t, 0.15, 'square', 0.08, 700); break;
      case 'clear': for (const [i, f] of [523, 659, 784, 1047].entries()) this.tone(f, t + i * 0.12, 0.35, 'square', 0.15); break;
      case 'click': this.tone(900, t, 0.04, 'square', 0.1); break;
    }
  }
  music(t: Tune) {
    if (t === this.tune) return; this.tune = t;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (!t || !this.ctx) return;
    this.next = this.ctx.currentTime + 0.1; this.n = 0;
    this.timer = window.setInterval(() => this.sched(), 50);
  }
  private sched() {
    const c = this.ctx, tn = this.tune; if (!c || !tn) return;
    const T = TUNES[tn], step = 60 / T.bpm / 2;
    while (this.next < c.currentTime + 0.2) {
      const i = this.n % T.lead.length, t = this.next;
      const m = T.lead[i]; if (m) this.tone(mtof(m), t, step * 1.6, T.lt, 0.08, undefined, this.mus!);
      if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), t, step * 3.6, 'triangle', 0.2, undefined, this.mus!);
      if (i % 4 === 0) { this.tone(70, t, 0.16, 'sine', 0.5, 45, this.mus!); }
      if (i % 4 === 2) this.hiss(t, 0.05, 0.12, 2400, 4, 'bandpass', this.mus!);
      if (i % 16 === 0) this.hiss(t, 0.9, 0.08, 500, 6, 'bandpass', this.mus!);
      this.next += step; this.n++;
    }
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; }
}

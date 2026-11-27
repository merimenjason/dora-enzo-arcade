// Dragon Playground sounds, all synthesised with WebAudio: tile-chip clicks and thumps for the dragon's feet, a slide
// whoosh, a see-saw boing, chain rattles, longkang splashes, a crow's caw, the roar, and a looping playground tune per
// race (a bright pentatonic lead over a skipping beat, like a void-deck ice-cream cart). Silent until the first input.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type Tune = 'title' | 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[]; lt: OscillatorType }> = {
  title: { bpm: 112, lt: 'triangle', lead: [72, 0, 74, 76, 79, 0, 76, 74, 72, 0, 69, 0, 67, 69, 72, 0, 74, 0, 76, 79, 81, 79, 76, 74, 72, 74, 72, 69, 67, 0, 0, 0], bass: [48, 48, 55, 48, 45, 45, 52, 45] },
  r1: { bpm: 152, lt: 'square', lead: [76, 79, 81, 79, 76, 0, 74, 76, 79, 0, 81, 84, 81, 0, 79, 0, 76, 74, 72, 74, 76, 0, 79, 76, 74, 72, 69, 72, 74, 0, 0, 0], bass: [48, 48, 55, 48, 53, 53, 55, 55] },
  r2: { bpm: 146, lt: 'triangle', lead: [74, 0, 76, 79, 81, 79, 76, 0, 74, 76, 74, 71, 69, 0, 71, 74, 76, 0, 79, 81, 83, 81, 79, 76, 74, 0, 71, 69, 67, 0, 0, 0], bass: [43, 43, 50, 43, 48, 48, 50, 50] },
  r3: { bpm: 160, lt: 'square', lead: [69, 72, 74, 0, 76, 74, 72, 69, 67, 0, 69, 72, 74, 76, 79, 0, 81, 79, 76, 74, 72, 0, 74, 76, 72, 69, 67, 69, 72, 0, 0, 0], bass: [45, 45, 52, 45, 43, 43, 50, 43] },
  r4: { bpm: 138, lt: 'sawtooth', lead: [71, 74, 76, 0, 78, 76, 74, 71, 69, 0, 71, 0, 74, 76, 78, 0, 81, 78, 76, 74, 71, 0, 69, 71, 74, 0, 71, 69, 66, 0, 0, 0], bass: [47, 47, 54, 47, 45, 45, 52, 45] },
  r5: { bpm: 164, lt: 'square', lead: [79, 81, 84, 81, 79, 0, 76, 79, 81, 0, 84, 86, 88, 86, 84, 0, 81, 79, 76, 79, 81, 0, 84, 81, 79, 76, 74, 76, 79, 0, 0, 0], bass: [48, 48, 55, 48, 52, 52, 55, 57] },
};

export class DragonSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; mus: GainNode | null = null; noise: AudioBuffer | null = null;
  sfxOn = true; musicOn = true;
  private tune: Tune = null; private timer: number | null = null; private next = 0; private n = 0; private last: Record<string, number> = {};

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new C(); this.ctx = ctx;
      this.out = ctx.createGain(); this.out.gain.value = 0.5; this.out.connect(ctx.destination);
      this.mus = ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(this.out);
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
      let s = 11; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      this.noise = b;
      if (this.tune) { const t = this.tune; this.tune = null; this.music(t); }
    } catch { this.ctx = null; }
  }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.05); }
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
    const t = this.ctx.currentTime; if ((this.last[name] ?? 0) > t - 0.05) return; this.last[name] = t;
    switch (name) {
      case 'jump': this.tone(260, t, 0.14, 'triangle', 0.25, 620); this.hiss(t, 0.06, 0.15, 3000, 2); break;
      case 'land': this.tone(110, t, 0.08, 'sine', 0.35, 60); for (let i = 0; i < 3; i++) this.tone(2400 + i * 500, t + i * 0.02, 0.03, 'square', 0.04); break;
      case 'slide': this.hiss(t, 0.5, 0.3, 1800, 1.5); this.tone(500, t, 0.5, 'triangle', 0.12, 260); break;
      case 'spring': this.tone(180, t, 0.35, 'sine', 0.4, 720); this.tone(360, t + 0.05, 0.3, 'triangle', 0.15, 900); break;
      case 'grab': for (let i = 0; i < 4; i++) this.tone(1800 + (i % 2) * 600, t + i * 0.03, 0.04, 'square', 0.06); break;
      case 'fling': this.hiss(t, 0.3, 0.25, 2200, 0.8); this.tone(300, t, 0.3, 'triangle', 0.15, 900); break;
      case 'splash': this.hiss(t, 0.5, 0.55, 1100, 0.4, 'lowpass'); this.tone(200, t, 0.2, 'sine', 0.3, 70); break;
      case 'toast': this.tone(880, t, 0.06, 'triangle', 0.18); this.tone(1320, t + 0.05, 0.08, 'triangle', 0.18); break;
      case 'roar': this.tone(90, t, 0.9, 'sawtooth', 0.4, 55); this.hiss(t, 0.8, 0.45, 500, 0.6); this.tone(180, t, 0.7, 'square', 0.12, 90); break;
      case 'stumble': this.tone(320, t, 0.18, 'square', 0.12, 160); break;
      case 'swat': this.hiss(t, 0.1, 0.35, 2500, 0.7); this.tone(140, t + 0.04, 0.08, 'sine', 0.3, 70); break;
      case 'steal': case 'caw': this.tone(620, t, 0.18, 'sawtooth', 0.14, 380); this.tone(560, t + 0.2, 0.2, 'sawtooth', 0.12, 340); break;
      case 'bonk': this.tone(130, t, 0.18, 'sine', 0.6, 50); this.hiss(t, 0.1, 0.3, 900); break;
      case 'count': this.tone(660, t, 0.18, 'square', 0.14); break;
      case 'go': this.tone(990, t, 0.35, 'square', 0.16); this.tone(1320, t + 0.06, 0.3, 'triangle', 0.12); break;
      case 'flutter': for (let i = 0; i < 4; i++) this.hiss(t + i * 0.06, 0.05, 0.25, 1600, 1.2); break;
      case 'gulp': this.tone(400, t, 0.3, 'sine', 0.4, 90); break;
      case 'seed': for (let i = 0; i < 3; i++) this.tone(1200, t + i * 0.07, 0.05, 'square', 0.1, 700); break;
      case 'twin': for (const [i, f] of [523, 659, 784].entries()) this.tone(f, t + i * 0.05, 0.25, 'triangle', 0.15); break;
      case 'otterdive': this.tone(500, t, 0.15, 'sine', 0.15, 200); this.hiss(t, 0.2, 0.15, 1500, 1); break;
      case 'otterpop': this.tone(300, t, 0.12, 'sine', 0.18, 700); break;
      case 'surge': this.hiss(t, 0.35, 0.18, 2600, 1.2); this.tone(520, t, 0.25, 'triangle', 0.08, 900); break;
      case 'overtake': for (const [i, f] of [880, 1175, 988].entries()) this.tone(f, t + i * 0.07, 0.07, 'square', 0.07); break;
      case 'pass': this.tone(660, t, 0.1, 'triangle', 0.16); this.tone(990, t + 0.08, 0.16, 'triangle', 0.16); break;
      case 'knock': this.tone(170, t, 0.1, 'sine', 0.45, 60); this.hiss(t, 0.07, 0.35, 3200, 0.8); break;
      case 'boost': this.tone(440, t, 0.25, 'square', 0.1, 880); break;
      case 'win': for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) this.tone(f, t + i * 0.11, 0.4, 'square', 0.14); break;
      case 'lose': for (const [i, f] of [523, 466, 415, 349].entries()) this.tone(f, t + i * 0.16, 0.35, 'triangle', 0.15); break;
      case 'wake': for (let i = 0; i < 10; i++) this.tone(1200 + ((i * 7) % 5) * 260, t + i * 0.06, 0.2, 'triangle', 0.08); break;
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
      const m = T.lead[i]; if (m) this.tone(mtof(m), t, step * 1.4, T.lt, 0.07, undefined, this.mus!);
      if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), t, step * 3, 'triangle', 0.2, undefined, this.mus!);
      if (i % 4 === 0) this.tone(80, t, 0.12, 'sine', 0.45, 50, this.mus!);
      if (i % 2 === 1) this.hiss(t, 0.04, 0.08, 6000, 2, 'highpass', this.mus!);
      this.next += step; this.n++;
    }
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; }
}

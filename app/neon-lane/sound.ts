// Neon Lane sounds, all synthesised with WebAudio. Under everything is the hum of the sign; each spark is a tiny
// tick of current, pitched up the scale as you run a circuit, and a circuit going dark is a buzz that dies with a
// pop. A blown fuse is a crack and a fizz, the cicaks chirp their "chik-chak", and a caught cicak is a rising zip.
// The music is a late-night lounge loop on an electric piano over a soft bass. Silent until the first key or click.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
export type Tune = 'title' | 'night' | 'scared' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[] }> = {
  title: { bpm: 84, lead: [69, 0, 72, 0, 76, 0, 74, 72, 0, 0, 69, 0, 67, 0, 0, 0, 69, 0, 72, 0, 76, 79, 76, 74, 72, 0, 0, 0, 0, 0, 0, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40] },
  night: { bpm: 112, lead: [69, 72, 76, 0, 74, 0, 72, 69, 0, 67, 69, 0, 72, 0, 0, 0, 69, 72, 76, 79, 0, 76, 74, 0, 72, 0, 74, 72, 69, 0, 0, 0], bass: [45, 52, 41, 48, 43, 50, 40, 47] },
  scared: { bpm: 150, lead: [81, 79, 76, 79, 81, 84, 81, 79, 76, 74, 76, 79, 76, 74, 72, 74], bass: [57, 57, 52, 52] },
};

export class NeonSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; mus: GainNode | null = null; noise: AudioBuffer | null = null;
  sfxOn = true; musicOn = true;
  private tune: Tune = null; private timer: number | null = null; private next = 0; private n = 0; private last: Record<string, number> = {};
  private hum: { o: OscillatorNode; g: GainNode } | null = null; private run = 0;

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new C(); this.ctx = ctx;
      this.out = ctx.createGain(); this.out.gain.value = 0.5; this.out.connect(ctx.destination);
      this.mus = ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(this.out);
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
      let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      this.noise = b;
      if (this.tune) { const t = this.tune; this.tune = null; this.music(t); }
    } catch { this.ctx = null; }
  }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.05); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.humOff(); void this.ctx?.close(); this.ctx = null; }

  /** the sign's mains hum while a night is on */
  humOn() {
    if (!this.ctx || this.hum || !this.sfxOn) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 100; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.018, c.currentTime, 0.3);
    o.connect(f); f.connect(g); g.connect(this.out!); o.start(); this.hum = { o, g };
  }
  humOff() { if (!this.hum || !this.ctx) { this.hum = null; return; } const { o, g } = this.hum; g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1); o.stop(this.ctx.currentTime + 0.5); this.hum = null; }

  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, to?: number, dest?: AudioNode) {
    const c = this.ctx!; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.out!); o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', to?: number) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /** a spark: a tick of current, stepping up the scale while you keep eating, back down after a pause */
  spark() {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime; if (t - (this.last.spark ?? 0) > 0.5) this.run = 0; if (t - (this.last.spark ?? 0) < 0.05) return; this.last.spark = t;
    const i = this.run++ % 10, m = 76 + 12 * Math.floor(i / 5) + PENTA[i % 5];
    this.tone(mtof(m), t, 0.06, 'square', 0.03); this.tone(mtof(m + 12), t, 0.04, 'sine', 0.03);
  }

  play(name: string) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime; if ((this.last[name] ?? 0) > t - 0.05) return; this.last[name] = t;
    switch (name) {
      case 'dark': this.tone(120, t, 0.35, 'sawtooth', 0.06, 60); this.hiss(t + 0.3, 0.08, 0.2, 2500, 2); break;
      case 'low': this.tone(mtof(88), t, 0.12, 'sine', 0.06); this.tone(mtof(88), t + 0.15, 0.12, 'sine', 0.06); break;
      case 'fuse': this.hiss(t, 0.05, 0.6, 3000, 0.5, 'highpass'); this.hiss(t + 0.04, 0.6, 0.25, 6000, 1, 'bandpass', 1500); this.tone(90, t, 0.4, 'sawtooth', 0.12, 40); break;
      case 'catch': this.tone(300, t, 0.22, 'square', 0.08, 1400); for (const [i, m] of [79, 84, 88].entries()) this.tone(mtof(m), t + 0.1 + i * 0.05, 0.2, 'triangle', 0.1); break;
      case 'tail': this.tone(mtof(91), t, 0.1, 'triangle', 0.1); this.tone(mtof(96), t + 0.07, 0.15, 'triangle', 0.1); break;
      case 'moth': for (let i = 0; i < 6; i++) this.tone(mtof(84 + (i % 2) * 3), t + i * 0.05, 0.05, 'sine', 0.04); break;
      case 'mothEaten': for (const [i, m] of [79, 83, 86, 91].entries()) this.tone(mtof(m), t + i * 0.06, 0.25, 'triangle', 0.12); break;
      case 'gulp': this.tone(400, t, 0.18, 'sine', 0.12, 120); break;
      case 'chirp': for (let i = 0; i < 2; i++) { this.tone(2400, t + i * 0.12, 0.04, 'square', 0.03, 3200); this.hiss(t + i * 0.12, 0.04, 0.1, 4000, 8); } break;
      case 'zap': this.hiss(t, 0.6, 0.4, 5000, 0.8, 'bandpass', 400); for (let i = 0; i < 5; i++) this.tone(140 + i * 37, t + i * 0.05, 0.06, 'sawtooth', 0.08); break;
      case 'life': for (const [i, m] of [72, 76, 79, 84].entries()) this.tone(mtof(m), t + i * 0.08, 0.25, 'square', 0.06); break;
      case 'release': this.tone(160, t, 0.15, 'sine', 0.06, 240); break;
      case 'go': this.tone(mtof(72), t, 0.12, 'square', 0.06); this.tone(mtof(79), t + 0.12, 0.2, 'square', 0.07); break;
      case 'clear': for (const [i, m] of [84, 79, 76, 72].entries()) this.tone(mtof(m), t + i * 0.09, 0.2, 'sawtooth', 0.05); this.hiss(t + 0.36, 0.1, 0.3, 2000, 2); for (const [i, m] of [72, 76, 79, 84].entries()) this.tone(mtof(m), t + 0.6 + i * 0.1, 0.35, 'triangle', 0.12); break;
      case 'click': this.tone(1200, t, 0.04, 'square', 0.05); break;
      case 'win': for (const [i, m] of [72, 76, 79, 84, 79, 84, 88, 91].entries()) this.tone(mtof(m), t + i * 0.11, 0.4, 'triangle', 0.14); break;
      case 'lose': for (const [i, m] of [72, 70, 67, 63, 60].entries()) this.tone(mtof(m), t + i * 0.16, 0.4, 'triangle', 0.12); break;
    }
  }

  music(tune: Tune) {
    if (tune === this.tune) return;
    this.tune = tune;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (!tune || !this.ctx) return;
    const T = TUNES[tune], step = 60 / T.bpm / 2;
    this.next = this.ctx.currentTime + 0.05; this.n = 0;
    this.timer = window.setInterval(() => {
      const c = this.ctx; if (!c || !this.mus) return;
      while (this.next < c.currentTime + 0.25) {
        const i = this.n % T.lead.length, t = this.next;
        const m = T.lead[i];
        // an electric piano: a sine with a bell-like overtone
        if (m) { this.tone(mtof(m), t, 0.5, 'sine', 0.16, undefined, this.mus); this.tone(mtof(m) * 3.01, t, 0.15, 'sine', 0.04, undefined, this.mus); }
        if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length] - 12), t, step * 3.5, 'triangle', 0.3, undefined, this.mus);
        if (i % 2 === 1) { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g); g.connect(this.mus); s.start(t, Math.random() * 0.5); s.stop(t + 0.06); }
        this.next += step; this.n++;
      }
    }, 60);
  }
}

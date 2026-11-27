// Moth Hoop sounds, all synthesised with WebAudio. Every stitch is a soft plucked note on a pentatonic scale, pitched
// by how high up the picture it lands, so a column sewn bottom to top plays a little rising run and the kit sings as
// it fills. Pins pop, moths nibble, holes rip, gold moths whine on the way down. The music is a music-box waltz over
// a sewing-machine shuffle. Silent until the first key or click.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
export type Tune = 'title' | 'hoop' | 'queen' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[] }> = {
  title: { bpm: 96, lead: [76, 0, 79, 81, 0, 79, 76, 0, 74, 72, 0, 74, 76, 0, 0, 0, 79, 0, 81, 84, 0, 81, 79, 0, 76, 74, 0, 72, 74, 0, 0, 0], bass: [48, 55, 52, 55, 45, 52, 48, 52] },
  hoop: { bpm: 112, lead: [72, 76, 79, 76, 81, 79, 76, 74, 72, 0, 74, 76, 79, 0, 76, 0, 74, 77, 81, 77, 84, 81, 77, 76, 74, 0, 76, 74, 72, 0, 0, 0], bass: [48, 55, 52, 55, 50, 57, 53, 57] },
  queen: { bpm: 126, lead: [69, 72, 76, 72, 77, 76, 72, 71, 69, 0, 71, 72, 76, 0, 74, 0, 71, 74, 77, 74, 79, 77, 74, 72, 71, 0, 72, 71, 69, 0, 0, 0], bass: [45, 52, 48, 52, 44, 52, 47, 52] },
};

export class MothSound {
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
      let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      this.noise = b;
      if (this.tune) { const t = this.tune; this.tune = null; this.music(t); }
    } catch { this.ctx = null; }
  }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.05); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; }

  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, to?: number, dest?: AudioNode) {
    const c = this.ctx!; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.out!); o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', dest?: AudioNode) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest ?? this.out!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  /** a plucked thread: a bright triangle with a fast decay and a little noise for the pull-through */
  private pluck(m: number, t: number, vol: number) { this.tone(mtof(m), t, 0.35, 'triangle', vol); this.tone(mtof(m + 12), t, 0.12, 'sine', vol * 0.3); this.hiss(t, 0.03, vol * 0.4, 6000, 2, 'highpass'); }

  /** a run of stitches: rising notes, higher for stitches nearer the top of the picture */
  stitch(rows: number[]) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    // field rows 48 (bottom of the picture) to 7 (top) climb two octaves of the pentatonic scale
    rows.slice(0, 6).forEach((r, i) => { const k = Math.max(0, Math.min(14, Math.floor((48 - r) / 3))); this.pluck(60 + 12 * Math.floor(k / 5) + PENTA[k % 5], t + i * 0.035, 0.12); });
  }

  play(name: string) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime; if ((this.last[name] ?? 0) > t - 0.035) return; this.last[name] = t;
    switch (name) {
      case 'throw': this.hiss(t, 0.07, 0.12, 3500, 1.5); this.tone(900, t, 0.06, 'sine', 0.05, 1600); break;
      case 'pin': this.tone(1400, t, 0.06, 'square', 0.08, 700); this.hiss(t, 0.06, 0.22, 2500, 1); this.tone(1046, t + 0.03, 0.2, 'triangle', 0.1); break;
      case 'tick': this.tone(1800, t, 0.03, 'square', 0.05); break;
      case 'silk': for (const [i, m] of [79, 83, 86, 91].entries()) this.tone(mtof(m), t + i * 0.06, 0.4, 'triangle', 0.12); this.hiss(t, 0.2, 0.3, 1500, 0.6); break;
      case 'darn': this.pluck(55, t, 0.12); this.hiss(t, 0.08, 0.15, 2000, 2); break;
      case 'chew': this.hiss(t, 0.05, 0.12, 1200, 4); this.hiss(t + 0.08, 0.05, 0.1, 1100, 4); break;
      case 'hole': this.hiss(t, 0.18, 0.32, 2200, 0.8); this.tone(180, t, 0.12, 'sawtooth', 0.06, 90); break;
      case 'shiver': this.tone(660, t, 0.5, 'sawtooth', 0.04, 700); break;
      case 'dive': this.tone(1400, t, 0.45, 'sine', 0.12, 200); break;
      case 'hurt': this.tone(120, t, 0.35, 'sine', 0.6, 50); this.hiss(t, 0.25, 0.4, 700, 0.5); break;
      case 'block': for (const f of [1568, 2093]) this.tone(f, t, 0.4, 'triangle', 0.12); break;
      case 'drop': this.tone(mtof(84), t, 0.2, 'triangle', 0.1); this.tone(mtof(88), t + 0.08, 0.2, 'triangle', 0.1); break;
      case 'power': for (const [i, m] of [72, 76, 79, 84, 88].entries()) this.pluck(m, t + i * 0.05, 0.13); break;
      case 'row': for (const [i, m] of [79, 84, 88].entries()) this.tone(mtof(m), t + i * 0.07, 0.3, 'sine', 0.12); break;
      case 'arrive': this.tone(300, t, 0.15, 'sine', 0.03, 420); break;
      case 'hatch': this.hiss(t, 0.15, 0.2, 1800, 3); this.tone(500, t, 0.1, 'triangle', 0.05, 900); break;
      case 'egg': this.tone(700, t, 0.1, 'sine', 0.06, 400); break;
      case 'queen': this.tone(90, t, 0.6, 'sawtooth', 0.15, 70); this.hiss(t, 0.5, 0.25, 400, 0.5); break;
      case 'click': this.tone(1200, t, 0.04, 'square', 0.05); break;
      case 'win': for (const [i, m] of [72, 76, 79, 84, 79, 84, 88, 91].entries()) this.pluck(m, t + i * 0.11, 0.16); break;
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
        if (m) { this.tone(mtof(m + 12), t, 0.5, 'sine', 0.16, undefined, this.mus); this.tone(mtof(m + 24), t, 0.18, 'triangle', 0.05, undefined, this.mus); }
        if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), t, step * 3.5, 'triangle', 0.22, undefined, this.mus);
        // the sewing machine: a soft chug on every eighth
        const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = i % 2 ? 2600 : 1400; f.Q.value = 3;
        const g = c.createGain(); g.gain.setValueAtTime(i % 2 ? 0.03 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        s.connect(f); f.connect(g); g.connect(this.mus); s.start(t, Math.random() * 0.5); s.stop(t + 0.06);
        this.next += step; this.n++;
      }
    }, 60);
  }
}

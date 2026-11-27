// Tambak sounds, all synthesised with WebAudio. Pouring is a soft hiss of falling grains; a claim is a rush of sand
// with a rising run of plucked notes, longer for a bigger fill. Creatures splash, the crocodiles snap, the pufferfish
// bloops up, the tide clock rings a ship's bell. The music is a lilting joget-style tune on a plucked lead over a
// shaker that sounds like a tin of sand. Silent until the first key or click.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
export type Tune = 'title' | 'site' | 'boss' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[] }> = {
  title: { bpm: 100, lead: [72, 0, 74, 76, 0, 79, 76, 74, 72, 0, 69, 0, 72, 0, 0, 0, 74, 0, 76, 79, 0, 81, 79, 76, 74, 0, 72, 74, 76, 0, 0, 0], bass: [48, 55, 45, 52, 50, 57, 43, 50] },
  site: { bpm: 126, lead: [76, 79, 81, 79, 76, 74, 72, 74, 76, 0, 79, 0, 76, 74, 72, 0, 69, 72, 74, 72, 69, 67, 69, 72, 74, 0, 72, 69, 72, 0, 0, 0], bass: [45, 52, 48, 55, 43, 50, 45, 52] },
  boss: { bpm: 138, lead: [69, 72, 75, 72, 74, 72, 69, 67, 69, 0, 72, 0, 74, 75, 74, 0, 67, 70, 72, 70, 69, 67, 65, 67, 69, 0, 67, 65, 64, 0, 0, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40] },
};

export class TambakSound {
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
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', dest?: AudioNode, to?: number) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest ?? this.out!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  private pluck(m: number, t: number, vol: number) { this.tone(mtof(m), t, 0.4, 'triangle', vol); this.tone(mtof(m + 12), t, 0.12, 'sine', vol * 0.3); }

  /** a pour: a little hiss of grains, rising a touch as the trail gets longer */
  pour(len: number) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime; if ((this.last.pour ?? 0) > t - 0.06) return; this.last.pour = t;
    this.hiss(t, 0.09, 0.07, 3000 + Math.min(40, len) * 60, 2.5);
  }
  /** a claim: a rush of sand and a run of notes, longer for a bigger fill */
  claim(cells: number) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime, n = Math.max(2, Math.min(10, Math.round(Math.log2(cells + 1))));
    this.hiss(t, 0.25 + Math.min(0.6, cells / 1500), 0.25, 900, 0.7, 'lowpass', undefined, 3500);
    for (let i = 0; i < n; i++) this.pluck(67 + 12 * Math.floor(i / 5) + PENTA[i % 5], t + 0.04 + i * 0.05, 0.12);
  }

  play(name: string) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime; if ((this.last[name] ?? 0) > t - 0.05) return; this.last[name] = t;
    switch (name) {
      case 'hurt': this.hiss(t, 0.5, 0.45, 600, 0.6, 'lowpass', undefined, 200); this.tone(300, t, 0.4, 'sine', 0.2, 90); break;
      case 'snap': this.tone(220, t, 0.05, 'square', 0.15, 120); this.tone(180, t + 0.09, 0.06, 'square', 0.15, 90); break;
      case 'puff': this.tone(200, t, 0.35, 'sine', 0.12, 520); break;
      case 'bump': this.tone(140, t, 0.08, 'sine', 0.1, 90); break;
      case 'pick': for (const [i, m] of [79, 84, 88, 91].entries()) this.tone(mtof(m), t + i * 0.06, 0.35, 'triangle', 0.12); break;
      case 'spawn': this.tone(mtof(84), t, 0.3, 'sine', 0.06); this.tone(mtof(91), t + 0.1, 0.3, 'sine', 0.05); break;
      case 'crab': for (let i = 0; i < 4; i++) this.hiss(t + i * 0.07, 0.03, 0.2, 4000, 6); break;
      case 'tide': for (const [i, f] of [880, 880].entries()) { this.tone(f, t + i * 0.45, 1.2, 'sine', 0.18); this.tone(f * 2.76, t + i * 0.45, 0.6, 'sine', 0.05); } break;
      case 'join': for (const [i, m] of [72, 76, 79].entries()) this.pluck(m, t + i * 0.07, 0.14); break;
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
        if (m) { this.tone(mtof(m), t, 0.45, 'triangle', 0.16, undefined, this.mus); this.tone(mtof(m + 12), t, 0.12, 'sine', 0.05, undefined, this.mus); }
        if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), t, step * 3.5, 'sine', 0.28, undefined, this.mus);
        // the shaker: a tin of sand on every eighth, accented on the off-beat like a joget
        const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
        const g = c.createGain(); g.gain.setValueAtTime(i % 2 ? 0.05 : 0.025, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        s.connect(f); f.connect(g); g.connect(this.mus); s.start(t, Math.random() * 0.5); s.stop(t + 0.08);
        this.next += step; this.n++;
      }
    }, 60);
  }
}

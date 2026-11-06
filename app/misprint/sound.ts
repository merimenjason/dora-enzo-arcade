// Misprint sounds, all synthesised with WebAudio: a soft lo-fi loop written for this game (dusty Rhodes-ish chords on
// a lazy swing, a round bass, a tape-hiss bed and a brushed beat), and the press-room effects: a padded footstep, the
// plate slide (a paper swish ending in the roller's "ka-chunk"), the dull thunk of a refused shift, a two-note switch
// chirp, the ink-drop plip, the rubber-stamp thump of a finished page and a little fanfare for a finished zine.
// Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// four bars, two chords a bar: Fmaj7 Em7 Dm7 Cmaj7 (voiced low and warm), a bass under them and a sparse melody
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const BASS = [41, -1, 41, 48, 40, -1, 40, 47, 38, -1, 38, 45, 36, -1, 43, 36];
const MEL = [72, -1, 69, -1, 71, 72, -1, -1, 69, -1, 65, 67, -1, 64, -1, -1, 72, 74, -1, 72, 71, -1, 67, -1, 69, -1, 65, -1, 64, -1, -1, -1];

export class MisprintSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private step = 0; private nextAt = 0; private timer: ReturnType<typeof setInterval> | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      // the music goes through a gentle low-pass: lo-fi, never shrill
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(lp);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      let seed = 12345; for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
      this.noise = n;
      this.nextAt = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 60);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { if (this.timer) clearInterval(this.timer); void this.ctx?.close().catch(() => {}); this.ctx = null; }
  get unlocked() { return !!this.ctx; }

  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'sine', to = 0, out: AudioNode | null = this.sfx, attack = 0.005) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.03);
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, (t * 7.31) % 1.5); s.stop(t + len + 0.03);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  // ---------------------------------------------------------------- the loop: 76 bpm, eighth notes with a lazy swing
  private schedule() {
    const c = this.ctx; if (!c || !this.mus) return;
    const beat = 60 / 76 / 2;
    while (this.nextAt < c.currentTime + 0.25) {
      const i = this.step % 32, t = this.nextAt + (i % 2 ? beat * 0.16 : 0);
      if (i % 8 === 0) for (const m of CHORDS[(i / 8) | 0]) { this.tone(hz(m), t, beat * 7.5, 0.05, 'triangle', 0, this.mus, 0.03); this.tone(hz(m) * 2.001, t, beat * 3, 0.012, 'sine', 0, this.mus, 0.02); }
      if (i % 8 === 5) for (const m of CHORDS[(i / 8) | 0].slice(1)) this.tone(hz(m), t, beat * 2.4, 0.03, 'triangle', 0, this.mus, 0.02);
      const b = BASS[i % 16]; if (b > 0) this.tone(hz(b), t, beat * 1.7, 0.16, 'sine', 0, this.mus, 0.01);
      const m = MEL[i]; if (m > 0) { this.tone(hz(m), t, beat * 1.9, 0.045, 'sine', 0, this.mus, 0.01); this.tone(hz(m + 12), t, beat * 0.8, 0.012, 'triangle', 0, this.mus); }
      if (i % 8 === 0 || i % 8 === 5) this.tone(70, t, 0.18, 0.2, 'sine', 45, this.mus);           // soft kick
      if (i % 8 === 4) this.hiss(t, 0.16, 0.05, 1800, 0.7, 'bandpass', 900, this.mus);             // brushed snare
      this.hiss(t, beat * 0.5, i % 2 ? 0.008 : 0.014, 7000, 0.6, 'highpass', 0, this.mus);         // shaker
      if (i % 4 === 0) this.hiss(t, beat * 4, 0.006, 3000, 0.3, 'bandpass', 0, this.mus);          // tape hiss bed
      this.nextAt += beat; this.step++;
    }
  }

  // ---------------------------------------------------------------- effects
  stepSound() { const t = this.now; this.hiss(t, 0.06, 0.09, 600, 0.9, 'lowpass'); this.tone(150, t, 0.05, 0.05, 'sine', 110); }
  climb() { const t = this.now; this.hiss(t, 0.05, 0.08, 700, 1, 'lowpass'); this.tone(220, t + 0.05, 0.07, 0.05, 'sine', 300); }
  land() { const t = this.now; this.tone(110, t, 0.09, 0.12, 'sine', 70); this.hiss(t, 0.05, 0.05, 400, 1, 'lowpass'); }
  /** a plate slide: paper swish, then the roller's ka-chunk */
  slide() {
    const t = this.now;
    this.hiss(t, 0.16, 0.14, 1400, 0.8, 'bandpass', 4200);
    this.tone(95, t + 0.12, 0.08, 0.2, 'square', 60); this.hiss(t + 0.12, 0.05, 0.1, 900, 2);
    this.tone(70, t + 0.19, 0.12, 0.22, 'sine', 50); this.hiss(t + 0.19, 0.06, 0.08, 500, 2);
  }
  refuse() { const t = this.now; this.tone(90, t, 0.16, 0.24, 'sine', 55); this.hiss(t, 0.07, 0.06, 300, 1, 'lowpass'); }
  switchTo(who: 0 | 1) { const t = this.now, b = who ? 67 : 72; this.tone(hz(b), t, 0.09, 0.07, 'triangle'); this.tone(hz(b + 5), t + 0.07, 0.12, 0.07, 'triangle'); }
  drop() { const t = this.now; this.tone(hz(84), t, 0.12, 0.1, 'sine', hz(96)); this.tone(hz(91), t + 0.08, 0.2, 0.06, 'sine'); }
  undo() { const t = this.now; this.hiss(t, 0.1, 0.06, 3000, 0.7, 'bandpass', 1200); }
  button() { const t = this.now; this.tone(hz(79), t, 0.05, 0.05, 'triangle'); }
  hint() { const t = this.now; this.tone(hz(76), t, 0.1, 0.05, 'sine'); this.tone(hz(83), t + 0.08, 0.14, 0.05, 'sine'); }
  /** a finished page: the rubber stamp's thump */
  stamp() { const t = this.now; this.tone(120, t, 0.22, 0.32, 'sine', 50); this.hiss(t, 0.08, 0.16, 700, 0.8, 'lowpass'); this.tone(hz(72), t + 0.25, 0.3, 0.06, 'triangle'); this.tone(hz(79), t + 0.33, 0.4, 0.06, 'triangle'); }
  zine() { const t = this.now; [72, 76, 79, 84, 88].forEach((m, i) => { this.tone(hz(m), t + i * 0.11, 0.5, 0.07, 'triangle'); this.tone(hz(m - 12), t + i * 0.11, 0.4, 0.04, 'sine'); }); this.stamp(); }
}

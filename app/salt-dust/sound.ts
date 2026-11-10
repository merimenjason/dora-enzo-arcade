// Salt & Dust sounds, all synthesised with WebAudio: soft footsteps on salt, a sling's whirr, a pole's knock, water
// pouring, the divining gauge's ratchet, a two-note chime for a passed check and a low one for a failed one, and a
// slow panpipe-like breeze tune under the town and the flat. Silent until the first input.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export class SaltSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; on = true; music: number | null = null; step = 0;
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext(); this.out = this.ctx.createGain(); this.out.gain.value = 0.5; this.out.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  get now() { return this.ctx?.currentTime ?? 0; }
  tone(f: number, t: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0) {
    if (!this.ctx || !this.out || !this.on) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  hiss(t: number, dur: number, vol: number, freq: number, q = 1) {
    if (!this.ctx || !this.out || !this.on) return;
    const n = Math.floor(this.ctx.sampleRate * dur), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t);
  }
  play(id: string) {
    const t = this.now;
    switch (id) {
      case 'step': this.hiss(t, 0.06, 0.18, 2400, 2); break;
      case 'click': this.tone(hz(84), t, 0.06, 0.05, 'triangle'); break;
      case 'sling': this.hiss(t, 0.35, 0.25, 900, 3); this.tone(300, t + 0.3, 0.1, 0.06, 'triangle', 300); break;
      case 'swing': this.hiss(t, 0.2, 0.3, 600, 2); break;
      case 'hit': this.tone(140, t, 0.18, 0.25, 'sine', -60); this.hiss(t, 0.08, 0.2, 500, 1); break;
      case 'miss': this.hiss(t, 0.15, 0.12, 3000, 4); break;
      case 'down': this.tone(220, t, 0.4, 0.12, 'triangle', -120); break;
      case 'mend': [72, 76, 79].forEach((m, i) => this.tone(hz(m), t + i * 0.09, 0.3, 0.05, 'sine')); break;
      case 'pour': for (let i = 0; i < 6; i++) this.tone(500 + Math.random() * 500, t + i * 0.07, 0.08, 0.04, 'sine', 300); break;
      case 'crank': for (let i = 0; i < 10; i++) this.hiss(t + i * 0.12, 0.03, 0.2, 4000, 6); break;
      case 'spring': [67, 71, 74, 79, 83, 86].forEach((m, i) => this.tone(hz(m), t + 1.1 + i * 0.12, 0.6, 0.06, 'triangle')); break;
      case 'pass': this.tone(hz(76), t, 0.25, 0.08, 'triangle'); this.tone(hz(83), t + 0.12, 0.4, 0.08, 'triangle'); break;
      case 'fail': this.tone(hz(57), t, 0.35, 0.09, 'triangle'); this.tone(hz(53), t + 0.15, 0.45, 0.08, 'triangle'); break;
      case 'water': this.tone(hz(86), t, 0.12, 0.04, 'sine', -400); break;
      case 'turn': this.tone(hz(69), t, 0.12, 0.05, 'triangle'); break;
    }
  }
  /** a slow breeze tune: a pentatonic panpipe line, looped */
  musicOn(want: boolean) {
    if (!want || !this.on) { if (this.music !== null) { clearInterval(this.music); this.music = null; } return; }
    if (this.music !== null || !this.ctx) return;
    const line = [69, -1, 72, 74, 76, -1, 74, 72, 69, -1, -1, 67, 69, -1, -1, -1, 76, -1, 79, 76, 74, -1, 72, 74, 69, -1, -1, -1, -1, -1, -1, -1];
    this.music = window.setInterval(() => {
      const m = line[this.step++ % line.length];
      if (m > 0) { this.tone(hz(m), this.now, 0.9, 0.025, 'sine'); this.hiss(this.now, 0.4, 0.008, hz(m) * 2, 8); }
      if (this.step % 8 === 0) this.tone(hz(45), this.now, 1.6, 0.02, 'triangle');
    }, 420);
  }
}

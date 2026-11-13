// Above & Below sounds: a tiny WebAudio synth (soft noise for dirt, dust and water, sine and triangle chimes for the
// puzzle clicks, a hawk's screech). Silent until the first input. The game asks for sounds by name as events.
export class AboveSound {
  ctx: AudioContext | null = null; master: GainNode | null = null; noiseBuf: AudioBuffer | null = null; on = true;
  private last: Record<string, number> = {};

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); } catch { return; }
    const ac = this.ctx;
    this.master = ac.createGain(); this.master.gain.value = 0.5; this.master.connect(ac.destination);
    this.noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  stop() { try { void this.ctx?.close(); } catch { /* already closed */ } this.ctx = null; }
  private tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const ac = this.ctx; if (!ac || !this.on || !this.master) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, freq = 800, q = 1, vol = 0.2, delay = 0, type: BiquadFilterType = 'bandpass') {
    const ac = this.ctx; if (!ac || !this.on || !this.master || !this.noiseBuf) return;
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  sfx(id: string, a = 0) {
    if (!this.ctx || !this.on) return;
    // the same sound twice in one frame plays once
    const now = this.ctx.currentTime; if (this.last[id] != null && now - this.last[id] < 0.015) return; this.last[id] = now;
    const R = Math.random;
    switch (id) {
      case 'jump': this.tone(420, 0.16, 'sine', 0.14, 1.8); break;
      case 'land': this.noise(0.08, 500, 1, 0.1); break;
      case 'dig': this.noise(0.12, 300 + R() * 200, 1.5, 0.22); this.noise(0.08, 2200, 3, 0.05, 0.03); break;
      case 'crumble': this.noise(0.25, 260, 0.8, 0.12); break;
      case 'lever': this.tone(180, 0.18, 'square', 0.05, 1.4); this.noise(0.2, 900, 4, 0.06); break;
      case 'gush': this.noise(1.6, 700, 0.6, 0.18, 0, 'lowpass'); this.noise(1.2, 2400, 1, 0.05, 0.1); break;
      case 'splash': this.noise(0.3, 1600, 1, 0.12); this.tone(900, 0.08, 'sine', 0.05, 0.6); break;
      case 'pour': this.noise(0.5, 2000, 2, 0.08); break;
      case 'grow': this.tone(300 + a * 120, 0.25, 'triangle', 0.12, 1.5); break;
      case 'stamp': this.tone(90, 0.18, 'sine', 0.35, 0.5); this.noise(0.15, 300, 1, 0.2); break;
      case 'crack': this.noise(0.35, 1200, 1, 0.22); this.tone(140, 0.3, 'sine', 0.25, 0.4); break;
      case 'shine': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.06, 1, i * 0.05)); break;
      case 'heave': this.tone(110, 0.3, 'sawtooth', 0.06, 1.6); this.noise(0.3, 400, 1, 0.15); break;
      case 'pop': this.tone(500, 0.1, 'sine', 0.15, 2.2); break;
      case 'click': [784, 1175].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.16, 1, i * 0.09)); break;
      case 'swap': this.tone(600, 0.07, 'sine', 0.08, 1.3); this.tone(900, 0.07, 'sine', 0.06, 1, 0.05); break;
      case 'hurt': this.tone(330, 0.22, 'square', 0.06, 0.5); break;
      case 'hawk': this.tone(1500, 0.5, 'sawtooth', 0.035, 0.55); this.tone(1350, 0.35, 'sine', 0.05, 0.6, 0.45); break;
      case 'hiss': this.noise(0.4, 3000, 1, 0.08); break;
      case 'call': this.tone(a ? 880 : 660, 0.12, 'sine', 0.08, 1.2); this.tone(a ? 1100 : 820, 0.14, 'sine', 0.07, 1, 0.12); break;
      case 'door': this.tone(150, 0.4, 'sawtooth', 0.04, 1.3); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.13, 1, i * 0.11)); break;
      case 'ui': this.tone(700, 0.06, 'sine', 0.08); break;
    }
  }
}

// Brinelight sounds, all synthesised with WebAudio: soft thumps for kicks and paws, a bright tink for the wrong hero,
// splashes, lantern chimes, and three small tunes scheduled ahead of time: an accordion jig for Lantern Quay, a
// tarantella for the Fish Market, and a lower, steadier boss march. A light echo bus gives the harbour some air.
// Silent until the first input.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type Tune = 'jig' | 'tarantella' | 'boss' | 'map' | null;

const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[]; lt: OscillatorType; swing: number }> = {
  // D major jig in 6/8: a three-beat lilt
  jig: { bpm: 132, lt: 'triangle', swing: 0,
    lead: [74, 76, 78, 79, 78, 76, 74, 71, 74, 76, 78, 81, 79, 78, 76, 74, 79, 78, 76, 74, 76, 78, 76, 74, 71, 73, 74, 76, 73, 69, 71, 74],
    bass: [50, 57, 50, 57, 55, 59, 50, 57, 50, 57, 55, 57, 50, 54, 45, 49] },
  // A minor tarantella, quick and a little cheeky
  tarantella: { bpm: 150, lt: 'triangle', swing: 0,
    lead: [76, 77, 76, 75, 76, 72, 69, 72, 74, 76, 77, 74, 72, 71, 69, 0, 69, 71, 72, 74, 76, 79, 77, 76, 74, 72, 71, 72, 69, 0, 0, 0],
    bass: [45, 52, 45, 52, 50, 57, 45, 52, 44, 52, 45, 52, 50, 53, 52, 44] },
  // the boss march: low, steady, a minor-key brass figure
  boss: { bpm: 118, lt: 'sawtooth', swing: 0,
    lead: [62, 0, 62, 65, 67, 0, 65, 62, 60, 0, 60, 62, 63, 62, 60, 58, 62, 0, 62, 65, 67, 70, 69, 67, 65, 0, 63, 62, 60, 0, 0, 0],
    bass: [38, 38, 45, 38, 36, 36, 43, 36, 38, 38, 45, 38, 34, 36, 37, 38] },
  // the harbour map: slow and warm
  map: { bpm: 84, lt: 'sine', swing: 0,
    lead: [74, 0, 78, 0, 81, 0, 79, 78, 76, 0, 0, 0, 74, 0, 71, 0, 73, 0, 76, 0, 74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [50, 47, 43, 45, 50, 47, 43, 45] },
};

export class BrineSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; mus: GainNode | null = null; echo: DelayNode | null = null;
  noise: AudioBuffer | null = null; sfxOn = true; musicOn = true;
  private tune: Tune = null; private timer: number | null = null; private next = 0; private n = 0;
  private last: Record<string, number> = {};

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = new AudioContext(); this.ctx = C;
      this.out = C.createGain(); this.out.gain.value = 0.5;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.out.connect(comp); comp.connect(C.destination);
      // a soft echo send: the harbour's walls
      this.echo = C.createDelay(); this.echo.delayTime.value = 0.19;
      const fb = C.createGain(); fb.gain.value = 0.22; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(this.out);
      this.mus = C.createGain(); this.mus.gain.value = this.musicOn ? 0.06 : 0; this.mus.connect(this.out);
      const b = C.createBuffer(1, C.sampleRate, C.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      this.timer = window.setInterval(() => this.schedule(), 60);
    } catch { this.ctx = null; }
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.2); }
  play(t: Tune) { if (t === this.tune) return; this.tune = t; this.n = 0; if (this.ctx) this.next = this.ctx.currentTime + 0.15; }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, wet = 0) {
    const C = this.ctx; if (!C || !this.out || !this.sfxOn) return;
    const t = C.currentTime + delay, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); if (wet && this.echo) { const w = C.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.echo); }
    o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(dur: number, f0: number, f1: number, vol = 0.3, type: BiquadFilterType = 'bandpass', q = 1, delay = 0) {
    const C = this.ctx; if (!C || !this.out || !this.noise || !this.sfxOn) return;
    const t = C.currentTime + delay, s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  sfx(id: string) {
    if (!this.ctx) return;
    // the same sound twice in one frame is one sound, a little louder in the ear already
    const now = this.ctx.currentTime; if (now - (this.last[id] ?? -1) < 0.03) return; this.last[id] = now;
    const T = this.tone.bind(this), N = this.hiss.bind(this);
    switch (id) {
      case 'kick': T(190, 70, 0.1, 'sine', 0.5); N(0.07, 2600, 900, 0.24); break;
      case 'kick3': T(160, 45, 0.2, 'sine', 0.65); N(0.14, 3000, 500, 0.32); T(520, 260, 0.08, 'triangle', 0.1); break;
      case 'punch': T(120, 45, 0.14, 'sine', 0.65); N(0.08, 900, 300, 0.32, 'lowpass'); break;
      case 'slam': T(90, 30, 0.3, 'sine', 0.8); N(0.25, 1200, 120, 0.42, 'lowpass'); break;
      case 'tink': T(2300, 2100, 0.12, 'sine', 0.2, 0, 0.3); T(3500, 3400, 0.08, 'sine', 0.1); break;
      case 'guard': T(1800, 1700, 0.1, 'square', 0.06); T(900, 850, 0.12, 'triangle', 0.14); break;
      case 'whoosh': N(0.12, 600, 3000, 0.11, 'bandpass', 2); break;
      case 'dash': N(0.16, 500, 4200, 0.16, 'bandpass', 1.5); T(260, 420, 0.06, 'triangle', 0.06); break;
      case 'jump': T(330, 620, 0.12, 'triangle', 0.12); break;
      case 'land': N(0.06, 500, 150, 0.16, 'lowpass'); break;
      case 'tag': N(0.22, 400, 4000, 0.18, 'bandpass', 3); T(660, 990, 0.12, 'triangle', 0.11, 0.04); break;
      case 'flop': T(75, 28, 0.45, 'sine', 0.85); N(0.35, 800, 90, 0.45, 'lowpass'); break;
      case 'splash': N(0.55, 2400, 260, 0.3, 'lowpass', 0.8); N(0.25, 5000, 2000, 0.08, 'highpass', 0.5, 0.05); break;
      case 'chime': [1047, 1319, 1568, 2093].forEach((f, i) => T(f, f, 0.5, 'sine', 0.12, i * 0.07, 0.4)); break;
      case 'grab': T(240, 480, 0.08, 'square', 0.08); N(0.05, 1500, 600, 0.18); break;
      case 'heave': T(110, 160, 0.25, 'sawtooth', 0.05); N(0.2, 300, 900, 0.16, 'bandpass', 2); break;
      case 'pop': T(500, 900, 0.07, 'sine', 0.28); T(900, 300, 0.12, 'triangle', 0.1, 0.05); break;
      case 'throw': N(0.2, 400, 2600, 0.18, 'bandpass', 2); break;
      case 'ouch': T(480, 220, 0.16, 'square', 0.08); N(0.08, 1200, 400, 0.22); break;
      case 'downed': T(300, 120, 0.4, 'triangle', 0.14); N(0.15, 600, 200, 0.2, 'lowpass'); break;
      case 'tell': T(330, 660, 0.35, 'triangle', 0.1); T(495, 990, 0.35, 'triangle', 0.07); break;
      case 'tell2': T(220, 180, 0.4, 'sawtooth', 0.06); T(440, 360, 0.4, 'triangle', 0.09); break;
      case 'boom': T(70, 25, 0.55, 'sine', 0.85); N(0.5, 900, 60, 0.5, 'lowpass'); break;
      case 'rumble': T(55, 40, 0.8, 'sawtooth', 0.08); N(0.8, 300, 80, 0.3, 'lowpass'); break;
      case 'crack': N(0.12, 4000, 1500, 0.28, 'highpass'); T(260, 120, 0.25, 'square', 0.08); break;
      case 'crate': N(0.14, 1800, 500, 0.3, 'bandpass', 1.2); T(180, 90, 0.12, 'triangle', 0.18); break;
      case 'creak': T(140, 190, 0.3, 'sawtooth', 0.04); T(150, 120, 0.3, 'sawtooth', 0.03, 0.15); break;
      case 'ice': T(1600, 900, 0.18, 'sine', 0.1); N(0.3, 6000, 3000, 0.08, 'highpass'); break;
      case 'go': T(784, 784, 0.12, 'triangle', 0.18); T(1175, 1175, 0.25, 'triangle', 0.18, 0.13); break;
      case 'dbl': [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, f, 0.35, 'triangle', 0.12, i * 0.05, 0.3)); T(60, 25, 0.6, 'sine', 0.85); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => T(f, f, 0.4, 'triangle', 0.14, i * 0.12, 0.3)); break;
      case 'ready': T(880, 1320, 0.18, 'sine', 0.12); break;
      case 'secret': [784, 988, 1175, 1568, 1976].forEach((f, i) => T(f, f, 0.5, 'sine', 0.1, i * 0.08, 0.5)); break;
      case 'eat': T(400, 600, 0.06, 'sine', 0.14); T(600, 800, 0.06, 'sine', 0.12, 0.08); [659, 784, 1047].forEach((f, i) => T(f, f, 0.2, 'triangle', 0.07, 0.15 + i * 0.06)); break;
      case 'zap': N(0.25, 6000, 2000, 0.2, 'highpass', 2); T(1200, 300, 0.2, 'square', 0.06); break;
      case 'puff': N(0.3, 300, 1400, 0.22, 'bandpass', 1); T(200, 420, 0.3, 'sine', 0.12); break;
      case 'deflate': N(0.5, 1800, 300, 0.2, 'bandpass', 3); T(500, 120, 0.5, 'triangle', 0.08); break;
      case 'whistle': T(1700, 1900, 0.15, 'sine', 0.1); T(1900, 1700, 0.25, 'sine', 0.1, 0.17); break;
      case 'shriek': T(1400, 900, 0.3, 'sawtooth', 0.05); N(0.3, 3000, 1500, 0.12, 'bandpass', 3); break;
      case 'squawk': T(700, 500, 0.12, 'square', 0.06); T(800, 450, 0.14, 'square', 0.05, 0.13); break;
      case 'flutter': for (let i = 0; i < 4; i++) N(0.05, 1200, 800, 0.08, 'bandpass', 2, i * 0.06); break;
      case 'flip': T(300, 700, 0.12, 'triangle', 0.12); N(0.1, 900, 2000, 0.12); break;
      case 'bump': T(140, 70, 0.16, 'sine', 0.4); break;
      case 'counter': T(1000, 1500, 0.08, 'square', 0.06); T(160, 50, 0.25, 'sine', 0.6); N(0.12, 3500, 800, 0.25); break;
      case 'crateHit': N(0.08, 1600, 600, 0.22, 'bandpass', 1.5); T(200, 140, 0.08, 'triangle', 0.12); break;
      case 'jellyHum': T(220, 330, 0.5, 'sine', 0.05, 0, 0.3); T(223, 333, 0.5, 'sine', 0.04); break;
      case 'lobsterTell': T(180, 260, 0.25, 'square', 0.05); N(0.1, 2000, 800, 0.1); break;
      case 'urchinTell': N(0.25, 5000, 2500, 0.12, 'highpass', 2); T(400, 500, 0.2, 'triangle', 0.05); break;
      case 'netLand': N(0.2, 700, 200, 0.22, 'lowpass'); break;
      case 'whistleUp': T(1500, 2100, 0.25, 'sine', 0.1); T(2100, 2100, 0.2, 'sine', 0.08, 0.27); break;
      case 'festFull': [784, 988, 1175, 1568].forEach((f, i) => T(f, f * 1.01, 0.3, 'triangle', 0.1, i * 0.05, 0.4)); N(0.4, 2000, 8000, 0.06, 'highpass'); break;
      case 'netDrop': N(0.3, 1200, 300, 0.2, 'bandpass', 1); T(220, 110, 0.25, 'triangle', 0.1, 0.12); break;
      case 'regrow': T(200, 400, 0.4, 'triangle', 0.06); break;
      // the specials: a rising whistle into a spin for Dora, a falling bass with a big thud for Enzo
      case 'comet': N(0.45, 800, 6000, 0.2, 'bandpass', 2); T(520, 1560, 0.35, 'triangle', 0.12, 0, 0.4); break;
      case 'anchor': T(300, 900, 0.18, 'triangle', 0.1); T(200, 50, 0.6, 'sine', 0.3, 0.2); N(0.5, 500, 80, 0.2, 'lowpass', 1, 0.2); break;
    }
  }

  private schedule() {
    const C = this.ctx; if (!C || !this.mus || !this.tune) return;
    const tn = TUNES[this.tune], step = 60 / tn.bpm / 2;
    if (this.next < C.currentTime) this.next = C.currentTime + 0.05;
    while (this.next < C.currentTime + 0.25) {
      const n = this.n, t = this.next, m = tn.lead[n % tn.lead.length];
      if (m) this.note(m, t, step * 0.9, tn.lt, tn.lt === 'sawtooth' ? 0.18 : 0.45, true);
      const b = tn.bass[Math.floor(n / 2) % tn.bass.length];
      if (n % 2 === 0) this.note(b, t, step * 1.8, 'sine', 0.75, false);
      else if (this.tune !== 'map') this.note(b + 12 + (n % 4 === 1 ? 4 : 7), t, step * 0.5, 'square', 0.06, false);
      if (this.tune === 'boss' && n % 4 === 0) this.drum(t, 0.6);
      if (this.tune === 'tarantella' && n % 2 === 1) this.shaker(t);
      this.next += step; this.n++;
    }
  }
  private note(m: number, t: number, d: number, type: OscillatorType, v: number, wet: boolean) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.mus!); if (wet && this.echo) { const w = C.createGain(); w.gain.value = 0.25; g.connect(w); w.connect(this.echo); }
    o.start(t); o.stop(t + d + 0.02);
  }
  private drum(t: number, v: number) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.mus!); o.start(t); o.stop(t + 0.22);
  }
  private shaker(t: number) {
    const C = this.ctx!; if (!this.noise) return;
    const s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6000;
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.mus!); s.start(t, Math.random()); s.stop(t + 0.06);
  }
}

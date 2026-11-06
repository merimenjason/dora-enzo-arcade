// Burrow Clinic sounds, all synthesised with WebAudio. Three original loops in a jaunty 1950s lounge style: the clinic by
// day (a walking bass, vibraphone chords on the off-beat, a brushed swing beat and a cheeky little tune), a calmer
// evening loop (slower, softer, with a celesta melody) and the campaign map (a bouncy travelling tune with a scooter
// "beep-beep" now and then). Effects: the door chime, padded footsteps, the reception bell, one sound per machine
// (a whirr, a hiccup boing, a steam puff, bubbles, a hum, a buzz), the cure "ta-da", the coin ka-ching, a grumpy huff, the
// build thunk, the sell swish, the emergency slide whistle and a fanfare for goals met. Silent until the first click,
// tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
type Track = 'day' | 'evening' | 'map' | 'off';
// day: | C6 Am7 | Dm7 G7 | in C, two bars a chord pair, eight eighths a bar
const DAY_CH = [[60, 64, 67, 69], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]];
const DAY_BASS = [36, 40, 43, 45, 33, 36, 40, 43, 38, 41, 45, 41, 31, 35, 38, 41];
const DAY_MEL = [76, -1, 79, 76, -1, 74, 72, -1, 72, -1, 76, -1, 74, -1, -1, -1, 77, -1, 74, 72, -1, 69, 71, -1, 74, -1, 71, -1, 67, -1, -1, -1];
// evening: | Fmaj7 Em7 | Dm7 G7sus | slower and softer
const EVE_CH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [55, 60, 62, 65]];
const EVE_BASS = [41, -1, 48, -1, 40, -1, 47, -1, 38, -1, 45, -1, 43, -1, 50, -1];
const EVE_MEL = [81, -1, -1, 79, -1, -1, 76, -1, 79, -1, -1, -1, 77, -1, 74, -1, 76, -1, -1, 74, -1, -1, 72, -1, 74, -1, 72, -1, 67, -1, -1, -1];
// map: | F Dm | Gm C7 | a bouncy two-beat
const MAP_CH = [[65, 69, 72], [62, 65, 69], [67, 70, 74], [64, 67, 70]];
const MAP_BASS = [41, 48, 41, 48, 38, 45, 38, 45, 43, 50, 43, 50, 36, 43, 36, 43];
const MAP_MEL = [72, 74, 77, -1, 77, -1, 76, 74, 74, -1, 72, -1, 69, -1, -1, -1, 70, 72, 74, -1, 74, -1, 72, 70, 72, -1, 69, -1, 67, -1, -1, -1];

export class ClinicSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private track: Track = 'off';
  private step = 0; private nextAt = 0; private timer: ReturnType<typeof setInterval> | null = null;
  private lastStep = 0; private lastMachine = 0; private lastCoin = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.15 : 0; this.mus.connect(lp);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      let seed = 4321; for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
      this.noise = n;
      this.nextAt = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 60);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.15 : 0, this.ctx.currentTime, 0.1); }
  setTrack(t: Track) { if (t !== this.track) { this.track = t; this.step = 0; if (this.ctx) this.nextAt = this.ctx.currentTime + 0.15; } }
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
  /** a vibraphone note: a sine with a soft tremolo-ish partial */
  private vibe(m: number, t: number, len: number, vol: number) { this.tone(hz(m), t, len, vol, 'sine', 0, this.mus, 0.004); this.tone(hz(m) * 4, t, len * 0.25, vol * 0.18, 'sine', 0, this.mus, 0.002); }
  private get now() { return this.ctx?.currentTime ?? 0; }

  private schedule() {
    const c = this.ctx; if (!c || !this.mus) return;
    if (this.track === 'off') { this.nextAt = c.currentTime + 0.1; return; }
    const bpm = this.track === 'day' ? 132 : this.track === 'map' ? 120 : 84;
    const beat = 60 / bpm / 2;
    while (this.nextAt < c.currentTime + 0.25) {
      const i = this.step % 32, swing = i % 2 ? beat * 0.22 : 0, t = this.nextAt + swing, bar = (i / 8) | 0;
      if (this.track === 'day') {
        const ch = DAY_CH[bar];
        if (i % 4 === 2) for (const m of ch) this.vibe(m, t, beat * 1.6, 0.035);
        const b = DAY_BASS[i >> 1]; if (i % 2 === 0) this.tone(hz(b), t, beat * 1.6, 0.17, 'triangle', 0, this.mus, 0.006);
        const m = DAY_MEL[i]; if (m > 0) { this.tone(hz(m), t, beat * 1.4, 0.05, 'square', 0, this.mus, 0.004); this.tone(hz(m), t, beat * 1.4, 0.03, 'triangle', 0, this.mus); }
        if (i % 4 === 0) this.tone(80, t, 0.14, 0.18, 'sine', 45, this.mus);
        if (i % 4 === 2) this.hiss(t, 0.12, 0.05, 2400, 0.7, 'bandpass', 1200, this.mus);
        this.hiss(t, beat * 0.4, i % 2 ? 0.012 : 0.02, 8000, 0.6, 'highpass', 0, this.mus);
      } else if (this.track === 'evening') {
        const ch = EVE_CH[bar];
        if (i % 8 === 0) for (const m of ch) this.vibe(m, t, beat * 7, 0.03);
        const b = EVE_BASS[(i / 2) | 0]; if (i % 2 === 0 && b > 0) this.tone(hz(b), t, beat * 3, 0.14, 'sine', 0, this.mus, 0.01);
        const m = EVE_MEL[i]; if (m > 0) { this.tone(hz(m), t, beat * 2.5, 0.035, 'sine', 0, this.mus, 0.003); this.tone(hz(m) * 3, t, beat * 0.6, 0.008, 'sine', 0, this.mus); }
        if (i % 4 === 2) this.hiss(t, 0.2, 0.025, 2000, 0.5, 'bandpass', 900, this.mus);
      } else {
        const ch = MAP_CH[bar];
        if (i % 2 === 1) for (const m of ch) this.tone(hz(m), t, beat * 0.7, 0.025, 'triangle', 0, this.mus, 0.004);
        const b = MAP_BASS[(i / 2) | 0]; if (i % 2 === 0) this.tone(hz(b), t, beat * 0.9, 0.16, 'triangle', 0, this.mus, 0.005);
        const m = MAP_MEL[i]; if (m > 0) this.tone(hz(m), t, beat * 1.1, 0.05, 'square', 0, this.mus, 0.004);
        if (i % 2 === 0) this.tone(70, t, 0.1, 0.12, 'sine', 45, this.mus);
        if (i === 30) { this.tone(hz(84), t, 0.08, 0.03, 'square', 0, this.mus); this.tone(hz(84), t + beat * 0.6, 0.08, 0.03, 'square', 0, this.mus); }
      }
      this.nextAt += beat; this.step++;
    }
  }

  // ---------------------------------------------------------------- effects
  click() { const t = this.now; this.tone(880, t, 0.05, 0.06, 'triangle', 1100); }
  chime() { const t = this.now; this.tone(hz(84), t, 0.5, 0.08, 'sine'); this.tone(hz(79), t + 0.16, 0.6, 0.08, 'sine'); }
  stepSound() { const t = this.now; if (t - this.lastStep < 0.12) return; this.lastStep = t; this.hiss(t, 0.05, 0.05, 700, 0.9, 'lowpass'); this.tone(170, t, 0.04, 0.03, 'sine', 120); }
  bell() { const t = this.now; this.tone(hz(93), t, 0.7, 0.07, 'sine'); this.tone(hz(93) * 2.76, t, 0.3, 0.02, 'sine'); }
  machine(kind: string) {
    const t = this.now; if (t - this.lastMachine < 0.35) return; this.lastMachine = t;
    if (kind === 'whirr') { this.tone(220, t, 0.5, 0.05, 'sawtooth', 330); this.hiss(t, 0.5, 0.04, 1500, 2); }
    else if (kind === 'boing') { this.tone(200, t, 0.35, 0.12, 'sine', 600); this.tone(300, t + 0.12, 0.3, 0.06, 'sine', 900); }
    else if (kind === 'puff') this.hiss(t, 0.45, 0.12, 3000, 0.8, 'bandpass', 800);
    else if (kind === 'bubble') for (let i = 0; i < 4; i++) this.tone(400 + i * 130, t + i * 0.07, 0.06, 0.06, 'sine', 900 + i * 150);
    else if (kind === 'hum') this.tone(110, t, 0.6, 0.06, 'triangle', 115);
    else if (kind === 'buzz') this.tone(180, t, 0.4, 0.04, 'square', 175);
    else if (kind === 'bell') this.bell();
  }
  tada() { const t = this.now; [72, 76, 79, 84].forEach((m, i) => this.tone(hz(m), t + i * 0.07, 0.35, 0.07, 'triangle')); this.tone(hz(88), t + 0.3, 0.5, 0.05, 'sine'); }
  coin() { const t = this.now; if (t - this.lastCoin < 0.08) return; this.lastCoin = t; this.tone(hz(88), t, 0.08, 0.07, 'square'); this.tone(hz(95), t + 0.07, 0.35, 0.07, 'square'); }
  huff() { const t = this.now; this.hiss(t, 0.35, 0.12, 900, 1.2, 'bandpass', 300); this.tone(160, t, 0.25, 0.05, 'sawtooth', 90); }
  thunk() { const t = this.now; this.tone(120, t, 0.18, 0.2, 'sine', 55); this.hiss(t, 0.12, 0.08, 500, 1, 'lowpass'); }
  sell() { const t = this.now; this.hiss(t, 0.3, 0.08, 1200, 1, 'bandpass', 4000); this.tone(hz(84), t + 0.18, 0.2, 0.05, 'square'); }
  no() { const t = this.now; this.tone(220, t, 0.12, 0.08, 'triangle', 180); this.tone(180, t + 0.1, 0.16, 0.08, 'triangle', 150); }
  /** the emergency: a cute rising and falling slide whistle */
  siren() { const t = this.now; for (let i = 0; i < 2; i++) { this.tone(700, t + i * 0.5, 0.25, 0.07, 'sine', 1400); this.tone(1400, t + i * 0.5 + 0.25, 0.25, 0.07, 'sine', 700); } }
  goal() { const t = this.now; [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(hz(m), t + i * 0.09, 0.45, 0.07, 'triangle')); this.tone(hz(72), t + 0.7, 1, 0.05, 'sine'); this.tone(hz(76), t + 0.7, 1, 0.05, 'sine'); this.tone(hz(79), t + 0.7, 1, 0.05, 'sine'); }
  pick() { const t = this.now; this.tone(500, t, 0.12, 0.06, 'sine', 900); }
  drop() { const t = this.now; this.tone(800, t, 0.12, 0.06, 'sine', 400); this.tone(150, t + 0.1, 0.08, 0.08, 'sine', 90); }
}

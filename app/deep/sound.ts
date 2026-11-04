// Deepglow sounds, all synthesised with WebAudio: the sonar ping and its echoes coming back off the walls, the propeller's
// hum rising with speed, bubbles, a soft clunk off the rock or a hard crunch, the hull creaking past its rating, the
// sting of a veil and the Grimlure's bite, a glassy chime for a catch (a fuller one for a new species), the air bell's
// gulp, Enzo's radio crackle and chirp, and an original ambient soundtrack (written for this game) that sinks lower and
// slower the deeper you go. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'boat' | 'dive' | 'ending';
/** slow chords per song: the root sinks with depth while diving */
const SONGS: Record<SongId, { root: number; chords: number[][]; beat: number; bell: number[] }> = {
  boat: { root: 62, beat: 0.5, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [2, 5, 9, 12]], bell: [12, 16, 19, 23, 19, 16, 14, 12] },
  dive: { root: 57, beat: 0.75, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -2, 2, 5]], bell: [15, _n(), 12, _n(), 19, _n(), 17, _n()] },
  ending: { root: 64, beat: 0.6, chords: [[0, 4, 7, 14], [5, 9, 12, 16], [7, 11, 14, 19], [4, 7, 11, 16]], bell: [12, 14, 16, 19, 21, 19, 16, 14] },
};
function _n() { return -99; }

export class DeepSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private echo: DelayNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0; private depth = 0;
  private motor: { o: OscillatorNode; f: BiquadFilterNode; g: GainNode } | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0; this.mus.connect(comp);
      // a long watery echo the music and the sonar share
      const d = c.createDelay(2); d.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.42; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(comp); this.echo = d;
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.1); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  // ---------------------------------------------------------------- building blocks
  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'sine', to = 0, out: AudioNode | null = this.sfx, attack = 0.006) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
    return g;
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  // ---------------------------------------------------------------- effects
  /** the ping goes out, and the echo comes back later from walls further away */
  ping(range: number) {
    const t = this.now, g = this.tone(1320, t, 0.9, 0.32, 'sine', 1180);
    if (g && this.echo) g.connect(this.echo);
    const back = Math.min(1.2, range / 70);
    this.tone(1180, t + back * 0.6, 0.5, 0.07, 'sine', 1100); this.tone(1150, t + back, 0.4, 0.04, 'sine', 1080);
  }
  /** the motor's hum follows the sub's speed */
  thrust(speed: number) {
    const c = this.ctx; if (!c || !this.sfx) return;
    if (!this.motor) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 50; f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.sfx); o.start(); this.motor = { o, f, g };
    }
    const t = c.currentTime, k = Math.min(1, speed / 7);
    this.motor.o.frequency.setTargetAtTime(42 + k * 60, t, 0.1); this.motor.f.frequency.setTargetAtTime(160 + k * 500, t, 0.1); this.motor.g.gain.setTargetAtTime(0.012 + k * 0.05, t, 0.15);
  }
  quiet() { if (this.motor && this.ctx) this.motor.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
  bubbles() { const t = this.now; for (let i = 0; i < 4; i++) this.tone(500 + Math.random() * 700, t + i * 0.05 + Math.random() * 0.03, 0.06, 0.05, 'sine', 1400 + Math.random() * 600); }
  bump(mag: number) { const t = this.now; this.tone(90, t, 0.25 + mag * 0.05, Math.min(0.6, 0.2 + mag * 0.08), 'sine', 40); this.hiss(t, 0.2 + mag * 0.05, Math.min(0.4, 0.1 + mag * 0.06), 300, 1, 'lowpass'); if (mag > 1.5) this.tone(210, t, 0.4, 0.12, 'square', 140); }
  creak() { const t = this.now; this.tone(70, t, 1.2, 0.18, 'sawtooth', 52, this.sfx, 0.3); this.tone(105, t + 0.2, 0.9, 0.08, 'sawtooth', 96, this.sfx, 0.25); }
  sting() { const t = this.now; this.tone(1800, t, 0.18, 0.15, 'square', 900); this.hiss(t, 0.25, 0.2, 4000, 2); }
  bite() { const t = this.now; this.tone(120, t, 0.35, 0.6, 'sawtooth', 50); this.hiss(t, 0.3, 0.5, 500, 0.6, 'lowpass', 150); this.tone(60, t + 0.05, 0.6, 0.4, 'sine', 30); }
  lure() { const t = this.now; this.tone(hz(45), t, 2.2, 0.16, 'triangle', hz(44), this.sfx, 0.6); this.tone(hz(52), t + 0.3, 1.8, 0.08, 'sine', 0, this.sfx, 0.5); }
  catch(first: boolean) {
    const t = this.now, notes = first ? [84, 88, 91, 96, 100] : [84, 91];
    notes.forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.07, first ? 1.2 : 0.6, 0.12, 'sine'); if (g && this.echo) g.connect(this.echo); });
  }
  full() { const t = this.now; this.tone(hz(72), t, 0.15, 0.15, 'triangle'); this.tone(hz(69), t + 0.13, 0.25, 0.15, 'triangle'); }
  bell() { const t = this.now; for (let i = 0; i < 6; i++) this.tone(300 + i * 90, t + i * 0.06, 0.2, 0.1, 'sine', 700 + i * 120); this.hiss(t, 0.8, 0.15, 900, 0.7); }
  lamp(on: boolean) { const t = this.now; this.tone(on ? 1600 : 900, t, 0.04, 0.12, 'square'); this.hiss(t, 0.05, 0.1, 3000, 1); }
  warn() { const t = this.now; this.tone(hz(76), t, 0.18, 0.14, 'square'); this.tone(hz(76), t + 0.28, 0.18, 0.14, 'square'); }
  /** Enzo on the radio: a crackle, then his chirpy speech */
  radio(text: string) {
    const t = this.now; this.hiss(t, 0.18, 0.12, 2600, 1.5);
    const n = Math.min(8, Math.ceil(text.length / 9));
    for (let i = 0; i < n; i++) this.tone(480 + ((text.charCodeAt(i * 3) || 70) % 7) * 35, t + 0.15 + i * 0.075, 0.06, 0.06, 'square', 0, this.sfx);
  }
  stinger(good: boolean) { const t = this.now; (good ? [72, 76, 79, 84] : [72, 70, 67]).forEach((n, i) => this.tone(hz(n), t + i * 0.12, 0.5, 0.15, 'triangle')); }
  button() { this.tone(980, this.now, 0.05, 0.1, 'sine'); }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  setDepth(d: number) { this.depth = d; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song];
    // deeper: a little lower and a little slower
    const sink = this.song === 'dive' ? Math.min(7, Math.floor(this.depth / 150)) : 0, beat = s.beat * (1 + sink * 0.06);
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step, t = this.nextAt, bar = Math.floor(i / 8) % s.chords.length, chord = s.chords[bar], root = s.root - sink;
      // a pad at the top of each bar, a soft bass, and a glassy bell melody with the echo on it
      if (i % 8 === 0) for (const n of chord) this.tone(hz(root + n - 12), t, beat * 8.5, 0.05, 'triangle', 0, this.mus, beat * 2.5);
      if (i % 8 === 0 || i % 8 === 5) this.tone(hz(root - 24 + chord[0]), t, beat * 4, 0.16, 'sine', 0, this.mus, 0.08);
      const b = s.bell[i % s.bell.length];
      if (b > -50 && (this.song !== 'dive' || i % 2 === 0)) { const g = this.tone(hz(root + b + (bar % 2 ? 0 : 0)), t, beat * 2.2, 0.05, 'sine', 0, this.mus); if (g && this.echo) g.connect(this.echo); }
      this.nextAt += beat; this.step++;
    }
  }
}

// Tetherball sounds, all synthesised with WebAudio: the hook's zip and the clunk when it bites, the whoosh of the rope
// rising with the swing speed, the thock of an impact (deeper and louder the harder it hits), the tink off armour or a
// blocked acorn, poofs, blasts, wall slams, spikes, splintering crates, the dash, hurt, hearts, warnings, Enzo's chirpy
// voice, and an original chiptune soundtrack (written for this game): a bouncy title tune, a driving arena loop, a heavier
// one for the golem and a happy ending. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'title' | 'fight' | 'boss' | 'ending';
/** per song: tempo (seconds a step), root note, a bass line and a lead over a four-chord loop (-99 is a rest) */
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean }> = {
  title: { step: 0.15, root: 60, chords: [0, 5, -3, 7], bass: [0, -99, 7, -99, 12, -99, 7, -99], lead: [12, 16, 19, 16, 24, 19, 16, 14, 12, -99, 16, -99, 19, 21, 19, 16], drums: false },
  fight: { step: 0.12, root: 57, chords: [0, -4, 3, -2], bass: [0, 0, 12, 0, -99, 0, 12, 7], lead: [12, -99, 15, 12, 19, -99, 17, 15, 12, 15, 17, -99, 19, 22, 19, 17], drums: true },
  boss: { step: 0.13, root: 52, chords: [0, 1, -2, -1], bass: [0, 0, 0, 12, 0, 0, 10, 12], lead: [12, -99, 13, -99, 15, 13, 12, -99, 18, -99, 17, 15, 13, -99, 12, 10], drums: true },
  ending: { step: 0.16, root: 64, chords: [0, 5, 7, 5], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 14, 16, 19, 21, 19, 16, 14, 16, -99, 19, -99, 24, -99, -99, -99], drums: false },
};

export class TetherSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private whir: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.55; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(comp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  // ---------------------------------------------------------------- building blocks
  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'square', to = 0, out: AudioNode | null = this.sfx, attack = 0.004) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  // ---------------------------------------------------------------- effects
  hook() { const t = this.now; this.hiss(t, 0.12, 0.18, 2500, 2, 'bandpass', 5000); this.tone(700, t, 0.08, 0.05, 'square', 1400); }
  latch(heavy: boolean) { const t = this.now; this.tone(heavy ? 110 : 220, t, 0.1, 0.3, 'square', heavy ? 70 : 140); this.hiss(t, 0.05, 0.2, 1200, 1); }
  miss() { this.tone(500, this.now, 0.1, 0.06, 'triangle', 300); }
  yank() { const t = this.now; this.hiss(t, 0.15, 0.2, 900, 1, 'bandpass', 2200); this.tone(300, t, 0.12, 0.1, 'square', 600); }
  release(speed: number) { const t = this.now, k = Math.min(1, speed / 240); this.hiss(t, 0.25, 0.15 + k * 0.2, 1200 + k * 1800, 1.2, 'bandpass', 500); }
  /** the rope's whoosh follows the swing speed */
  whirl(speed: number) {
    const c = this.ctx; if (!c || !this.sfx || !this.noise) return;
    if (!this.whir) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 3; f.frequency.value = 400; g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); this.whir = { s, f, g };
    }
    const t = c.currentTime, k = Math.min(1, speed / 240), wob = 0.5 + 0.5 * Math.sin(t * (6 + k * 18));
    this.whir.f.frequency.setTargetAtTime(300 + k * 1400, t, 0.05); this.whir.g.gain.setTargetAtTime(speed > 30 ? (0.04 + k * 0.14) * (0.6 + 0.4 * wob) : 0, t, 0.04);
  }
  quiet() { if (this.whir && this.ctx) this.whir.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
  hit(dmg: number) {
    const t = this.now, k = Math.min(1, dmg / 5);
    this.tone(180 - k * 90, t, 0.12 + k * 0.1, 0.35 + k * 0.25, 'square', 50); this.hiss(t, 0.08 + k * 0.08, 0.3 + k * 0.2, 1800 - k * 900, 0.8, 'lowpass');
    if (dmg >= 4) this.tone(60, t, 0.3, 0.4, 'sine', 30);
  }
  tink() { const t = this.now; this.tone(2400, t, 0.08, 0.12, 'square', 1800); this.tone(3200, t + 0.02, 0.06, 0.06, 'triangle'); }
  poof() { const t = this.now; this.hiss(t, 0.25, 0.25, 900, 0.8, 'bandpass', 300); this.tone(600, t, 0.12, 0.08, 'triangle', 200); }
  fall() { this.tone(900, this.now, 0.5, 0.12, 'triangle', 120); }
  boom() { const t = this.now; this.hiss(t, 0.6, 0.6, 600, 0.6, 'lowpass', 80); this.tone(90, t, 0.5, 0.5, 'sine', 30); this.tone(160, t, 0.15, 0.25, 'square', 60); }
  slam() { const t = this.now; this.tone(80, t, 0.2, 0.4, 'square', 40); this.hiss(t, 0.15, 0.3, 500, 0.7, 'lowpass'); }
  spike() { const t = this.now; this.tone(1200, t, 0.08, 0.15, 'sawtooth', 600); this.hit(3); }
  crate() { const t = this.now; for (let i = 0; i < 4; i++) this.hiss(t + i * 0.03, 0.06, 0.2, 700 + i * 300, 3); this.tone(200, t, 0.1, 0.15, 'square', 120); }
  heart() { const t = this.now; [76, 81, 88].forEach((n, i) => this.tone(hz(n), t + i * 0.06, 0.15, 0.12, 'square')); }
  hurt() { const t = this.now; this.tone(400, t, 0.25, 0.3, 'sawtooth', 120); this.hiss(t, 0.15, 0.25, 1500, 1); }
  dash() { const t = this.now; this.hiss(t, 0.14, 0.2, 1800, 1.5, 'bandpass', 600); }
  warn(big: boolean) { const t = this.now; this.tone(big ? 220 : 880, t, 0.08, 0.1, 'square'); this.tone(big ? 220 : 880, t + 0.12, 0.08, 0.1, 'square'); }
  shot(rock: boolean) { this.tone(rock ? 200 : 700, this.now, 0.1, 0.1, 'triangle', rock ? 100 : 350); }
  quake() { const t = this.now; this.hiss(t, 0.8, 0.5, 300, 0.5, 'lowpass', 60); this.tone(50, t, 0.8, 0.5, 'sine', 30); }
  combo(n: number) { const t = this.now; for (let i = 0; i < Math.min(6, n); i++) this.tone(hz(72 + i * 4), t + i * 0.05, 0.12, 0.1, 'square'); }
  wave() { const t = this.now; [67, 72].forEach((n, i) => this.tone(hz(n), t + i * 0.1, 0.18, 0.12, 'square')); }
  clear() { const t = this.now; [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(hz(n), t + i * 0.09, 0.2, 0.13, 'square')); }
  pick() { const t = this.now; [79, 84, 91].forEach((n, i) => this.tone(hz(n), t + i * 0.05, 0.2, 0.12, 'triangle')); }
  /** Enzo talking: little chirps, one per few letters */
  enzo(text: string) { const t = this.now, n = Math.min(8, Math.ceil(text.length / 9)); for (let i = 0; i < n; i++) this.tone(520 + ((text.charCodeAt(i * 3) || 70) % 7) * 40, t + i * 0.07, 0.05, 0.05, 'square'); }
  stinger(good: boolean) { const t = this.now; (good ? [72, 76, 79, 84, 88] : [72, 69, 65, 60]).forEach((n, i) => this.tone(hz(n), t + i * 0.13, 0.4, 0.15, 'square')); }
  button() { this.tone(1100, this.now, 0.04, 0.08, 'square'); }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song];
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step, t = this.nextAt, chord = s.chords[Math.floor(i / 16) % s.chords.length], root = s.root + chord;
      const b = s.bass[i % s.bass.length]; if (b > -50) this.tone(hz(root - 24 + b), t, s.step * 0.9, 0.22, 'triangle', 0, this.mus);
      const l = s.lead[i % s.lead.length]; if (l > -50) this.tone(hz(root + l), t, s.step * 0.8, 0.07, 'square', 0, this.mus, 0.003);
      if (s.drums) {
        if (i % 4 === 0) this.tone(120, t, 0.1, 0.35, 'sine', 45, this.mus);
        if (i % 4 === 2) this.hiss(t, 0.08, 0.18, 2500, 0.8, 'highpass', 0, this.mus);
        if (i % 8 === 4) this.hiss(t, 0.12, 0.3, 1200, 0.6, 'bandpass', 0, this.mus);
      }
      this.nextAt += s.step; this.step++;
    }
  }
}

// Pixel Smith sounds, all synthesised with WebAudio: a whoosh for every swing (lower and slower for a heavier weapon),
// a different hit for each colour (a gold ting, a stone thud, a frosty crackle, an ember sizzle, a mossy chime), the pop
// of a Grumble bursting, a rising blip for each pixel picked up, Dora's roll and bumps, ice thrown and blocked, a pixel
// chipped off, the Smudge's squeaky rub, Enzo's brush and rubber at the easel, his chirpy voice, and an original
// chiptune soundtrack written for this game: a title tune, the easel, one loop for each place, the Smudge and an ending.
// Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'title' | 'easel' | 'mine' | 'cellar' | 'forge' | 'boss' | 'ending';
/** per song: seconds a step, root note, chord roots for a four-bar loop, a bass line and a lead (-99 is a rest) */
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean }> = {
  title: { step: 0.15, root: 62, chords: [0, 5, 7, 5], bass: [0, -99, 7, -99, 12, 7, -99, 5], lead: [12, -99, 16, 19, 24, -99, 19, 16, 17, -99, 14, -99, 12, 14, -99, -99], drums: false },
  easel: { step: 0.2, root: 65, chords: [0, 9, 5, 7], bass: [0, -99, -99, 7, 12, -99, 7, -99], lead: [16, -99, 19, -99, 17, 16, 14, -99, 12, -99, -99, 14, 16, -99, -99, -99], drums: false },
  mine: { step: 0.13, root: 57, chords: [0, 3, 5, 3], bass: [0, 0, 12, 0, 7, 0, 10, 12], lead: [12, -99, 15, 12, 17, -99, 15, -99, 19, 17, 15, -99, 12, -99, 10, 12], drums: true },
  cellar: { step: 0.14, root: 59, chords: [0, -4, -2, 3], bass: [0, -99, 7, 0, -99, 7, 12, 7], lead: [19, -99, 17, 15, -99, 14, 15, -99, 12, -99, 14, 15, 17, -99, -99, 10], drums: true },
  forge: { step: 0.12, root: 55, chords: [0, 1, 0, -2], bass: [0, 12, 0, 12, 1, 13, 0, 10], lead: [12, 13, 15, -99, 12, -99, 18, 17, 15, -99, 13, 12, -99, 10, 12, -99], drums: true },
  boss: { step: 0.11, root: 52, chords: [0, 3, 1, -2], bass: [0, 0, 12, 0, 0, 12, 10, 7], lead: [12, -99, 15, -99, 18, 17, -99, 15, 12, 13, -99, 12, 10, -99, 12, -99], drums: true },
  ending: { step: 0.17, root: 65, chords: [0, 5, 9, 7], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 16, 19, 24, 21, 19, 16, -99, 14, 16, 19, -99, 24, -99, -99, -99], drums: false },
};
export type Hue = 'grey' | 'gold' | 'blue' | 'red' | 'green' | 'wood';
const PICK: Record<Exclude<Hue, 'wood'>, number> = { grey: 72, gold: 84, blue: 79, red: 76, green: 81 };

export class SmithSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
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

  /** a whoosh: heavier weapons swing lower and longer */
  swing(len: number) { const t = this.now; this.hiss(t, len * 0.9, 0.22, 1800 - Math.min(1100, len * 1400), 1.4, 'bandpass', 500); }
  hit(c: Hue, n: number) {
    const t = this.now, v = Math.min(0.3, 0.12 + n * 0.012);
    switch (c) {
      case 'gold': this.tone(1500, t, 0.12, v, 'square', 2200); this.tone(hz(96), t + 0.03, 0.15, v * 0.5, 'triangle'); break;
      case 'grey': case 'wood': this.tone(160, t, 0.14, v * 1.3, 'square', 60); this.hiss(t, 0.1, v, 700, 0.8, 'lowpass'); break;
      case 'blue': this.hiss(t, 0.18, v, 4500, 3, 'bandpass', 2500); this.tone(1900, t, 0.08, v * 0.4, 'square', 1500); break;
      case 'red': this.hiss(t, 0.25, v, 2500, 0.6, 'highpass', 900); this.tone(300, t, 0.1, v * 0.6, 'sawtooth', 200); break;
      case 'green': [79, 86].forEach((m, i) => this.tone(hz(m), t + i * 0.04, 0.14, v * 0.6, 'triangle')); this.tone(200, t, 0.08, v, 'square', 120); break;
    }
  }
  pop(big = false) { const t = this.now; this.tone(big ? 300 : 700, t, 0.1, 0.22, 'square', big ? 80 : 180); this.hiss(t, big ? 0.6 : 0.16, big ? 0.35 : 0.2, 2000, 0.8, 'bandpass', 600); }
  private pickN = 0; private pickAt = 0;
  /** each pixel in a quick run of pickups goes up a step */
  pick(c: Exclude<Hue, 'wood'>) {
    const t = this.now; this.pickN = t - this.pickAt < 0.25 ? Math.min(this.pickN + 1, 10) : 0; this.pickAt = t;
    this.tone(hz(PICK[c] + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][this.pickN]), t, 0.06, 0.07, 'square');
  }
  roll() { const t = this.now; this.hiss(t, 0.22, 0.14, 900, 1, 'bandpass', 400); this.tone(260, t, 0.1, 0.06, 'triangle', 180); }
  hurt() { const t = this.now; this.tone(440, t, 0.25, 0.26, 'sawtooth', 140); this.hiss(t, 0.15, 0.2, 1500, 1); }
  shoot() { const t = this.now; this.tone(900, t, 0.12, 0.08, 'triangle', 1400); this.hiss(t, 0.12, 0.08, 5000, 2); }
  block() { const t = this.now; this.tone(2600, t, 0.05, 0.12, 'square', 2000); this.hiss(t, 0.1, 0.15, 5000, 2, 'highpass'); }
  chip() { const t = this.now; this.tone(1300, t, 0.08, 0.12, 'square', 500); }
  wind() { const t = this.now; [88, 91, 95].forEach((m, i) => this.tone(hz(m), t + i * 0.05, 0.08, 0.05, 'square')); }
  dash() { this.hiss(this.now, 0.25, 0.14, 2500, 1.5, 'bandpass', 900); }
  rub() { const t = this.now; for (let i = 0; i < 4; i++) this.tone(600 + (i % 2) * 200, t + i * 0.06, 0.06, 0.12, 'sawtooth', 450); }
  spawn() { this.hiss(this.now, 0.3, 0.08, 400, 0.8, 'lowpass', 1200); }
  freeze() { const t = this.now; this.tone(hz(100), t, 0.1, 0.06, 'square'); this.tone(hz(96), t + 0.05, 0.12, 0.05, 'square'); }
  heal() { this.tone(hz(88), this.now, 0.12, 0.05, 'triangle'); }
  clear() { const t = this.now; [72, 76, 79, 84, 88].forEach((n, i) => this.tone(hz(n), t + i * 0.08, 0.2, 0.12, 'square')); }
  dab(c: Hue) { const t = this.now; this.hiss(t, 0.05, 0.12, 2500, 1); this.tone(hz(c === 'wood' ? 70 : PICK[c] - 12), t, 0.06, 0.06, 'triangle'); }
  rubber() { const t = this.now; this.hiss(t, 0.09, 0.14, 900, 1.2); this.tone(500, t, 0.06, 0.05, 'sawtooth', 380); }
  patch() { const t = this.now; [76, 79, 83].forEach((n, i) => this.tone(hz(n), t + i * 0.04, 0.1, 0.08, 'triangle')); }
  no() { this.tone(180, this.now, 0.12, 0.1, 'square', 140); }
  perk() { const t = this.now; [79, 84, 91].forEach((n, i) => this.tone(hz(n), t + i * 0.05, 0.2, 0.12, 'triangle')); }
  enzo(text: string) { const t = this.now, n = Math.min(8, Math.ceil(text.length / 9)); for (let i = 0; i < n; i++) this.tone(520 + ((text.charCodeAt(i * 3) || 70) % 7) * 40, t + i * 0.07, 0.05, 0.05, 'square'); }
  stinger(good: boolean) { const t = this.now; (good ? [72, 76, 79, 84, 88] : [72, 69, 65, 60]).forEach((n, i) => this.tone(hz(n), t + i * 0.13, 0.4, 0.15, 'square')); }
  button() { this.tone(1100, this.now, 0.04, 0.08, 'square'); }

  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song];
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step, t = this.nextAt, root = s.root + s.chords[Math.floor(i / 16) % s.chords.length];
      const b = s.bass[i % s.bass.length]; if (b > -50) this.tone(hz(root - 24 + b), t, s.step * 0.9, 0.22, 'triangle', 0, this.mus);
      const l = s.lead[i % s.lead.length]; if (l > -50) this.tone(hz(root + l), t, s.step * 0.8, 0.07, 'square', 0, this.mus, 0.003);
      if (s.drums) {
        if (i % 4 === 0) this.tone(120, t, 0.1, 0.32, 'sine', 45, this.mus);
        if (i % 4 === 2) this.hiss(t, 0.06, 0.15, 3000, 0.8, 'highpass', 0, this.mus);
        if (i % 8 === 4) this.hiss(t, 0.12, 0.25, 1200, 0.6, 'bandpass', 0, this.mus);
      }
      this.nextAt += s.step; this.step++;
    }
  }
}

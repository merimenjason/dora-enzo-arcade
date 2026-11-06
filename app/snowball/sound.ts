// Snowball Siege sounds, all synthesised with WebAudio: the crunch of a scoop (softer for floor snow), the pat of a
// patch, the whoosh of a throw, the thud of a hit (bigger for a hard snowball), a powder burst, the crack of the ice
// and the splash of falling in, the flag falling, a cheer, the birdies of a stun, and an original chiptune soundtrack
// written for this game: a title tune, a bouncy match loop, a tense loop for the Summit and an ending. Silent until the
// first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'title' | 'match' | 'final' | 'ending';
/** per song: seconds a step, root note, chord roots for a four-bar loop, a bass line and a lead (-99 is a rest) */
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean; bell: boolean }> = {
  title: { step: 0.17, root: 67, chords: [0, 5, 9, 7], bass: [0, -99, 7, -99, 12, -99, 7, -99], lead: [16, -99, 19, 21, 19, -99, 16, 14, 12, -99, 14, 16, -99, -99, 12, -99], drums: false, bell: true },
  match: { step: 0.13, root: 64, chords: [0, 5, 7, 5], bass: [0, -99, 12, -99, 7, -99, 12, 7], lead: [12, 14, 16, -99, 19, -99, 16, 14, 12, -99, 9, -99, 7, 9, 12, -99], drums: true, bell: false },
  final: { step: 0.12, root: 57, chords: [0, 3, 8, 7], bass: [0, 0, 12, 0, 7, 0, 12, 10], lead: [12, -99, 15, -99, 19, 17, 15, -99, 12, -99, 10, 12, 15, -99, -99, -99], drums: true, bell: false },
  ending: { step: 0.18, root: 69, chords: [0, 5, 7, 0], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 16, 19, 24, 21, 19, 16, -99, 14, 16, 19, -99, 24, -99, -99, -99], drums: false, bell: true },
};

export class SnowballSound {
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
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.15 : 0; this.mus.connect(comp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.15 : 0, this.ctx.currentTime, 0.1); }
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

  /** a scoop of snow: two crunches, softer from the floor */
  scoop(floor = false) { const t = this.now, v = floor ? 0.12 : 0.22; this.hiss(t, 0.07, v, 2600, 0.8, 'bandpass', 1200); this.hiss(t + 0.08, 0.08, v * 0.8, 2200, 0.8, 'bandpass', 900); this.tone(hz(84), t + 0.14, 0.06, 0.04, 'triangle'); }
  pat() { const t = this.now; this.tone(160, t, 0.07, 0.2, 'sine', 90); this.hiss(t, 0.05, 0.12, 900, 1, 'lowpass'); this.tone(150, t + 0.09, 0.06, 0.14, 'sine', 90); }
  whoosh(hard = false) { const t = this.now; this.hiss(t, hard ? 0.35 : 0.25, hard ? 0.2 : 0.14, 600, 1.2, 'bandpass', 3000); if (hard) this.tone(140, t, 0.1, 0.12, 'square', 80); }
  thud(hard = false) { const t = this.now; this.tone(hard ? 90 : 130, t, hard ? 0.22 : 0.12, hard ? 0.4 : 0.26, 'sine', 45); this.hiss(t, hard ? 0.3 : 0.16, hard ? 0.28 : 0.18, 1400, 0.6, 'lowpass', 300); }
  powder() { this.hiss(this.now, 0.3, 0.12, 4000, 0.5, 'highpass', 1500); }
  crack() { const t = this.now; for (let i = 0; i < 3; i++) this.hiss(t + i * 0.035, 0.03, 0.25, 3200 - i * 600, 3); this.tone(1800, t, 0.12, 0.05, 'triangle', 900); }
  splash() { const t = this.now; this.hiss(t, 0.5, 0.3, 1200, 0.5, 'bandpass', 300); this.tone(300, t + 0.05, 0.2, 0.08, 'sine', 120); }
  flagFall() { const t = this.now; this.tone(500, t, 0.5, 0.12, 'sawtooth', 120); this.thud(true); }
  cheer() { const t = this.now; [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone(hz(n), t + i * 0.07, 0.3, 0.12, 'square')); this.hiss(t, 1.2, 0.14, 1200, 0.4, 'bandpass', 2000); }
  groan() { const t = this.now; [67, 63, 60, 55].forEach((n, i) => this.tone(hz(n), t + i * 0.14, 0.32, 0.1, 'triangle')); }
  /** birdies round a stunned head */
  stun() { const t = this.now; for (let i = 0; i < 4; i++) this.tone(hz(i % 2 ? 91 : 88), t + i * 0.08, 0.07, 0.06, 'square'); }
  wind() { this.hiss(this.now, 1.2, 0.08, 500, 0.6, 'bandpass', 1200); }
  no() { this.tone(180, this.now, 0.12, 0.1, 'square', 140); }
  button() { this.tone(1100, this.now, 0.04, 0.08, 'square'); }

  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song];
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step, t = this.nextAt, root = s.root + s.chords[Math.floor(i / 16) % s.chords.length];
      const b = s.bass[i % s.bass.length]; if (b > -50) this.tone(hz(root - 24 + b), t, s.step * 0.9, 0.22, 'triangle', 0, this.mus);
      const l = s.lead[i % s.lead.length]; if (l > -50) this.tone(hz(root + l), t, s.step * 0.8, 0.07, s.bell ? 'triangle' : 'square', 0, this.mus, 0.003);
      if (s.bell && i % 8 === 0) this.tone(hz(root + 24), t, 0.6, 0.04, 'sine', 0, this.mus);
      if (s.drums) {
        if (i % 4 === 0) this.tone(120, t, 0.1, 0.3, 'sine', 45, this.mus);
        if (i % 2 === 1) this.hiss(t, 0.04, 0.1, 6000, 0.8, 'highpass', 0, this.mus);
        if (i % 8 === 4) this.hiss(t, 0.12, 0.22, 1400, 0.6, 'bandpass', 0, this.mus);
      }
      this.nextAt += s.step; this.step++;
    }
  }
}

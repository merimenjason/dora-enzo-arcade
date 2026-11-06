// Snow Day League sounds, all synthesised with WebAudio: the flip of a card, the thump of a ban stamp, a pin pushed
// into cork, the whoosh of a throw, the thud of a hit, the pop of a KO, a fort's blocks crumbling, a flag falling, the
// crowd's cheer, Enzo's coach whistle, coins, and an original chiptune soundtrack: a cosy office loop, a thinking
// loop for the draft, a bouncy match loop, a tense final loop and a victory tune. Silent until the first click,
// tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'office' | 'draft' | 'match' | 'final' | 'victory';
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean; bell: boolean }> = {
  office: { step: 0.2, root: 65, chords: [0, 5, 9, 7], bass: [0, -99, 7, -99, 9, -99, 7, -99], lead: [12, -99, 16, -99, 19, 17, 16, -99, 14, -99, 12, -99, 9, -99, -99, -99], drums: false, bell: true },
  draft: { step: 0.22, root: 62, chords: [0, 3, 5, 3], bass: [0, -99, -99, 7, -99, -99, 5, -99], lead: [15, -99, 14, -99, 12, -99, -99, 10, 12, -99, -99, -99, 7, -99, 10, -99], drums: false, bell: true },
  match: { step: 0.125, root: 64, chords: [0, 5, 7, 9], bass: [0, -99, 12, 0, 7, -99, 12, 7], lead: [12, 14, 16, -99, 19, 16, 14, 12, 14, -99, 9, 12, 7, -99, 9, -99], drums: true, bell: false },
  final: { step: 0.115, root: 57, chords: [0, 3, 8, 7], bass: [0, 0, 12, 0, 7, 0, 12, 10], lead: [12, -99, 15, -99, 19, 17, 15, 12, 15, -99, 10, 12, 15, -99, 19, -99], drums: true, bell: false },
  victory: { step: 0.16, root: 67, chords: [0, 5, 7, 0], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 16, 19, 24, 21, 19, 16, -99, 14, 16, 19, -99, 24, -99, -99, -99], drums: true, bell: true },
};

export class LeagueSound {
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
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.14 : 0; this.mus.connect(comp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.14 : 0, this.ctx.currentTime, 0.1); }
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

  /** a card flicked onto the felt */
  flip() { const t = this.now; this.hiss(t, 0.06, 0.18, 3500, 1.5, 'bandpass', 1800); this.tone(900, t + 0.04, 0.03, 0.04, 'triangle'); }
  /** the ban stamp: a thump and an inky smack */
  stamp() { const t = this.now; this.tone(110, t, 0.18, 0.4, 'sine', 50); this.hiss(t, 0.12, 0.3, 700, 0.8, 'lowpass', 200); this.hiss(t + 0.02, 0.05, 0.12, 2500, 2); }
  /** a pin pushed into the cork */
  pin() { const t = this.now; this.tone(1400, t, 0.05, 0.08, 'triangle', 900); this.hiss(t + 0.02, 0.05, 0.1, 1200, 1, 'bandpass'); }
  whoosh(big = false) { const t = this.now; this.hiss(t, big ? 0.35 : 0.2, big ? 0.16 : 0.08, 600, 1.2, 'bandpass', 3000); }
  thud(hard = false) { const t = this.now; this.tone(hard ? 95 : 140, t, hard ? 0.2 : 0.1, hard ? 0.34 : 0.2, 'sine', 50); this.hiss(t, hard ? 0.25 : 0.12, hard ? 0.22 : 0.14, 1400, 0.6, 'lowpass', 300); }
  /** a KO: a bright pop and a falling chirp */
  pop() { const t = this.now; this.tone(700, t, 0.08, 0.2, 'square', 1400); this.tone(hz(84), t + 0.07, 0.18, 0.12, 'triangle', hz(72)); this.hiss(t, 0.18, 0.18, 3000, 0.7, 'highpass'); }
  crumble() { const t = this.now; for (let i = 0; i < 4; i++) this.hiss(t + i * 0.05, 0.09, 0.2 - i * 0.03, 900 - i * 120, 0.8, 'lowpass'); this.tone(80, t, 0.25, 0.22, 'sine', 40); }
  flagFall() { const t = this.now; this.tone(520, t, 0.6, 0.12, 'sawtooth', 110); this.tone(70, t + 0.45, 0.4, 0.4, 'sine', 35); this.hiss(t + 0.45, 0.5, 0.3, 800, 0.6, 'lowpass', 200); }
  cheer(big = false) { const t = this.now; if (big) [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone(hz(n), t + i * 0.07, 0.3, 0.1, 'square')); this.hiss(t, big ? 1.4 : 0.7, big ? 0.16 : 0.08, 1200, 0.4, 'bandpass', 2200); }
  groan() { const t = this.now; [67, 63, 60, 55].forEach((n, i) => this.tone(hz(n), t + i * 0.14, 0.32, 0.09, 'triangle')); }
  whistle() { const t = this.now; this.tone(2600, t, 0.12, 0.12, 'sine', 2900); this.tone(2900, t + 0.13, 0.28, 0.12, 'sine', 2500); this.hiss(t, 0.4, 0.04, 2800, 6); }
  surge() { const t = this.now; [76, 79, 83, 88].forEach((n, i) => this.tone(hz(n), t + i * 0.05, 0.12, 0.07, 'square')); }
  coin() { const t = this.now; this.tone(hz(88), t, 0.07, 0.1, 'square'); this.tone(hz(95), t + 0.07, 0.16, 0.1, 'square'); }
  no() { this.tone(180, this.now, 0.12, 0.1, 'square', 140); }
  button() { this.tone(1100, this.now, 0.04, 0.07, 'square'); }

  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song];
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step, t = this.nextAt, root = s.root + s.chords[Math.floor(i / 16) % s.chords.length];
      const b = s.bass[i % s.bass.length]; if (b > -50) this.tone(hz(root - 24 + b), t, s.step * 0.9, 0.2, 'triangle', 0, this.mus);
      const l = s.lead[i % s.lead.length]; if (l > -50) this.tone(hz(root + l), t, s.step * 0.8, 0.07, s.bell ? 'triangle' : 'square', 0, this.mus, 0.003);
      if (s.bell && i % 8 === 0) this.tone(hz(root + 24), t, 0.6, 0.035, 'sine', 0, this.mus);
      if (s.drums) {
        if (i % 4 === 0) this.tone(120, t, 0.1, 0.28, 'sine', 45, this.mus);
        if (i % 2 === 1) this.hiss(t, 0.04, 0.08, 6000, 0.8, 'highpass', 0, this.mus);
        if (i % 8 === 4) this.hiss(t, 0.12, 0.2, 1400, 0.6, 'bandpass', 0, this.mus);
      }
      this.nextAt += s.step; this.step++;
    }
  }
}

// Rulebook FC sounds, all synthesised with WebAudio: the thump of a pass (with a scoop for a long ball), a step for
// every cell a player moves, a big strike for shots, the keeper's slap, the post's clang, the scrape of a tackle, the
// referee's whistle (and the long one at full time), the crowd's roar for a goal, a groan for one conceded, the rustle
// of a law card and the scratch of a pen writing it into the rulebook (or Red Pen striking one out), and an original
// chiptune soundtrack written for this game: a title tune, a thoughtful loop while you plan, the card table between
// matches and an ending. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'title' | 'match' | 'cards' | 'ending';
/** per song: seconds a step, root note, chord roots for a four-bar loop, a bass line and a lead (-99 is a rest) */
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean }> = {
  title: { step: 0.15, root: 62, chords: [0, 5, 7, 5], bass: [0, -99, 7, -99, 12, -99, 7, -99], lead: [12, 14, 16, 19, -99, 16, 14, -99, 12, -99, 19, 21, 19, -99, 16, -99], drums: true },
  match: { step: 0.2, root: 57, chords: [0, 3, 5, 7], bass: [0, -99, -99, 7, -99, -99, 12, -99], lead: [12, -99, -99, 15, -99, 17, -99, -99, 19, -99, 17, -99, 15, -99, -99, -99], drums: false },
  cards: { step: 0.18, root: 65, chords: [0, 4, 9, 7], bass: [0, -99, -99, 7, 12, -99, 7, -99], lead: [16, -99, 21, -99, 19, 16, 14, -99, 16, -99, -99, 19, 21, -99, -99, -99], drums: false },
  ending: { step: 0.16, root: 67, chords: [0, 5, 9, 7], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 16, 19, 24, 21, 19, 16, -99, 14, 16, 19, -99, 24, -99, -99, -99], drums: true },
};

export class RulebookSound {
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

  /** a pass: a thump, with a scoop on top for a long ball */
  kick(lofted = false) { const t = this.now; this.tone(150, t, 0.08, 0.22, 'square', 70); this.hiss(t, 0.05, 0.12, 1800, 1); if (lofted) this.tone(400, t + 0.02, 0.14, 0.06, 'triangle', 900); }
  tread() { this.hiss(this.now, 0.04, 0.05, 900, 1, 'lowpass'); }
  shot() { const t = this.now; this.tone(110, t, 0.12, 0.35, 'square', 45); this.hiss(t, 0.25, 0.22, 2500, 0.9, 'bandpass', 600); }
  save() { const t = this.now; this.hiss(t, 0.09, 0.3, 1400, 0.7); this.tone(220, t, 0.08, 0.15, 'square', 140); }
  post() { const t = this.now; [1, 2.76, 5.4].forEach((k) => this.tone(520 * k, t, 0.5, 0.08, 'triangle')); }
  tackle() { const t = this.now; this.tone(180, t, 0.1, 0.2, 'square', 90); this.hiss(t, 0.2, 0.15, 700, 0.8, 'lowpass', 300); }
  steal() { const t = this.now; this.tone(300, t, 0.12, 0.16, 'sawtooth', 150); }
  whistle(long = false) { const t = this.now, n = long ? 3 : 1; for (let i = 0; i < n; i++) { this.tone(2900, t + i * 0.22, long && i === 2 ? 0.5 : 0.16, 0.07, 'sine', 0, this.sfx, 0.01); this.tone(2950, t + i * 0.22, long && i === 2 ? 0.5 : 0.16, 0.04, 'square'); } }
  roar() { const t = this.now; this.hiss(t, 1.4, 0.18, 800, 0.4, 'bandpass', 1400); this.hiss(t + 0.1, 1.1, 0.1, 2400, 0.5); }
  goal() { const t = this.now; [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone(hz(n), t + i * 0.06, 0.3, 0.12, 'square')); this.roar(); }
  concede() { const t = this.now; [67, 63, 60].forEach((n, i) => this.tone(hz(n), t + i * 0.12, 0.3, 0.1, 'triangle')); }
  card() { const t = this.now; this.hiss(t, 0.12, 0.1, 3500, 0.7, 'highpass'); this.tone(hz(84), t + 0.05, 0.12, 0.06, 'triangle'); }
  /** a law written into the rulebook: the scratch of a pen, then a chord */
  write() { const t = this.now; for (let i = 0; i < 5; i++) this.hiss(t + i * 0.06, 0.05, 0.08, 4000 - i * 300, 2); [79, 84, 91].forEach((n, i) => this.tone(hz(n), t + 0.32 + i * 0.05, 0.25, 0.12, 'triangle')); }
  strike() { const t = this.now; this.hiss(t, 0.3, 0.14, 2500, 1, 'bandpass', 900); this.tone(300, t + 0.1, 0.2, 0.1, 'sawtooth', 120); }
  enzo(text: string) { const t = this.now, n = Math.min(8, Math.ceil(text.length / 9)); for (let i = 0; i < n; i++) this.tone(520 + ((text.charCodeAt(i * 3) || 70) % 7) * 40, t + i * 0.07, 0.05, 0.05, 'square'); }
  stinger(good: boolean) { const t = this.now; (good ? [72, 76, 79, 84, 88] : [72, 69, 65, 60]).forEach((n, i) => this.tone(hz(n), t + i * 0.13, 0.4, 0.15, 'square')); }
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

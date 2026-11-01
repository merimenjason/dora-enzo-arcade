// Night Market's sounds, all made on the fly with WebAudio: a wooden clack for buttons and the dial's ticks, a koto
// pluck when a customer speaks, a shamisen twang for a counter-offer, coins chinking into the purse, a wind chime as
// a customer arrives and for a matching set, a low taiko thump when someone walks off, and the thud of a seal stamp.
// Under it all a slow koto melody on the yo pentatonic scale over a soft drone, brighter for the festival.
// Silent until the first click, tap or key; closed when the page goes.
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
const YO = [0, 2, 5, 7, 9]; // the yo scale
type Song = { root: number; bpm: number; melody: number[]; drone: number[] };
export type SongId = 'menu' | 'dusk' | 'night' | 'festival' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 72, drone: [0, 0, 3, 2], melody: [4, _, 3, _, 2, _, _, _, 3, _, 2, 1, 0, _, _, _, 2, _, 3, _, 4, _, 6, _, 5, _, _, _, _, _, _, _] },
  dusk: { root: 60, bpm: 66, drone: [0, 3, 0, 2], melody: [2, _, _, 3, 4, _, _, _, 3, _, 2, _, 0, _, _, _, 1, _, 2, _, 3, _, 2, _, 1, _, _, _, _, _, _, _] },
  night: { root: 57, bpm: 76, drone: [0, 0, 3, 4], melody: [0, _, 2, _, 3, _, 4, _, 3, _, 2, _, 3, _, _, _, 4, _, 5, _, 4, _, 2, _, 3, _, 1, _, 0, _, _, _] },
  festival: { root: 62, bpm: 104, drone: [0, 3, 4, 0], melody: [4, 5, 6, _, 5, _, 4, _, 6, _, 7, _, 6, 5, 4, _, 3, _, 4, _, 5, _, 4, 3, 2, _, 3, _, 4, _, _, _] },
  ending: { root: 64, bpm: 80, drone: [0, 3, 4, 0], melody: [4, _, 5, _, 6, _, _, _, 7, _, 6, _, 4, _, _, _, 5, _, 4, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};
const note = (root: number, deg: number) => root + YO[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);

export class MarketSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  private ok(key: string, gap: number) {
    const c = this.ctx; if (!c || !this.soundOn) return false;
    const t = c.currentTime; if ((this.last.get(key) ?? -1) > t - gap) return false; this.last.set(key, t); return true;
  }
  private tone(out: GainNode, type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = 0.004) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  private hiss(out: GainNode, dur: number, level: number, freq: number, q = 1, at = 0) {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, (freq % 7) / 10); s.stop(t + dur + 0.05);
  }
  /** A koto-ish pluck: a bright attack and a fast-fading body. */
  private pluck(out: GainNode, f: number, level: number, at = 0, dur = 0.9) {
    this.tone(out, 'triangle', f, f, dur, level, at, 0.002);
    this.tone(out, 'sine', f * 2.01, f * 2, dur * 0.5, level * 0.35, at, 0.002);
    this.tone(out, 'square', f * 3, f * 3, 0.05, level * 0.06, at, 0.001);
  }
  clack() { if (!this.ok('clack', 0.04)) return; this.tone(this.sfx!, 'square', 820, 600, 0.05, 0.08); this.hiss(this.sfx!, 0.04, 0.15, 2400, 3); }
  tick() { if (!this.ok('tick', 0.03)) return; this.tone(this.sfx!, 'square', 1500, 1300, 0.025, 0.035); }
  buy() { if (!this.ok('buy', 0.05)) return; this.clack(); this.tone(this.sfx!, 'triangle', hz(76), hz(76), 0.18, 0.12); }
  arrive() { if (!this.ok('arrive', 0.3)) return; const c = this.ctx!; [88, 93, 91].forEach((m, i) => this.tone(this.sfx!, 'sine', hz(m), hz(m), 1.2, 0.05, c.currentTime + i * 0.09)); }
  speak(high = false) { if (!this.ok('speak', 0.08)) return; this.pluck(this.sfx!, hz(high ? 74 : 67), 0.13, 0, 0.5); }
  counter() { if (!this.ok('counter', 0.1)) return; const c = this.ctx!; this.tone(this.sfx!, 'sawtooth', hz(57), hz(55), 0.35, 0.06); this.pluck(this.sfx!, hz(62), 0.12, c.currentTime + 0.05, 0.4); }
  coins(n = 3) {
    if (!this.ok('coins', 0.08)) return; const c = this.ctx!;
    for (let i = 0; i < Math.min(8, n); i++) { const t = c.currentTime + i * 0.055; this.tone(this.sfx!, 'sine', 2600 + (i % 3) * 330, 2500, 0.12, 0.07, t); this.tone(this.sfx!, 'sine', 3900 + (i % 2) * 250, 3800, 0.08, 0.04, t); }
  }
  sale() { if (!this.ok('sale', 0.2)) return; const c = this.ctx!; [0, 2, 4].forEach((d, i) => this.pluck(this.sfx!, hz(note(69, d)), 0.12, c.currentTime + i * 0.08)); this.coins(5); }
  chime() { if (!this.ok('chime', 0.2)) return; const c = this.ctx!; [91, 95, 98, 103].forEach((m, i) => this.tone(this.sfx!, 'sine', hz(m), hz(m), 1.4, 0.05, c.currentTime + i * 0.07)); }
  walk() { if (!this.ok('walk', 0.2)) return; this.tone(this.sfx!, 'sine', 90, 52, 0.45, 0.35); this.hiss(this.sfx!, 0.2, 0.12, 300, 1); this.pluck(this.sfx!, hz(55), 0.08, 0, 0.6); }
  stamp() { if (!this.ok('stamp', 0.1)) return; this.tone(this.sfx!, 'sine', 140, 70, 0.18, 0.3); this.hiss(this.sfx!, 0.08, 0.2, 900, 1); }
  lantern() { if (!this.ok('lantern', 0.08)) return; this.hiss(this.sfx!, 0.25, 0.08, 1800, 0.7); this.tone(this.sfx!, 'sine', hz(84), hz(86), 0.4, 0.05); }
  fanfare() { if (!this.ok('fanfare', 1)) return; const c = this.ctx!; [0, 2, 4, 5, 7, 9].forEach((d, i) => this.pluck(this.sfx!, hz(note(62, d)), 0.14, c.currentTime + i * 0.12, 1.2)); this.chime(); }
  /** Starts or switches the music loop. */
  music(id: SongId | null) {
    if (this.song === id) return;
    this.song = id; this.step = 0; this.nextAt = this.ctx ? this.ctx.currentTime + 0.1 : 0;
  }
  /** Schedules the music a little ahead; call every frame. */
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.musicOn || c.state !== 'running') return;
    const S = SONGS[this.song], beat = 60 / S.bpm / 2;
    if (this.nextAt < c.currentTime - 0.5) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.25) {
      const k = this.step % S.melody.length, m = S.melody[k];
      if (m !== _) this.pluck(this.mus!, hz(note(S.root, m)), 0.22, this.nextAt, 1.1);
      if (k % 8 === 0) { const d = S.drone[(k / 8) % S.drone.length]; this.tone(this.mus!, 'sine', hz(note(S.root - 24, d)), hz(note(S.root - 24, d)), beat * 8, 0.18, this.nextAt, 0.3); this.tone(this.mus!, 'triangle', hz(note(S.root - 12, d + 2)), hz(note(S.root - 12, d + 2)), beat * 7, 0.05, this.nextAt, 0.5); }
      if (this.song === 'festival' && k % 4 === 0) this.tone(this.mus!, 'sine', 110, 60, 0.2, 0.25, this.nextAt);
      this.step++; this.nextAt += beat;
    }
  }
}

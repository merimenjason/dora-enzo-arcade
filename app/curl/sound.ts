// Sweep & Slide's sounds, all made on the fly with WebAudio: the low scrape of granite on ice that rises and falls
// with the stones' speed, the rhythmic brush of the brooms, a deep clack when stones meet (louder the harder the hit),
// a soft thump on the boards, the woodland crowd cheering or groaning on the bank, the tick of the measuring tape,
// and a fanfare for the Cup. Under them a gentle folk loop of plucked strings and soft bells. Silent until the first
// click, tap or key; closed when the page goes.

const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[]; crickets: boolean };
export type SongId = 'menu' | 'match' | 'final' | 'practice' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 92, chords: [0, 3, 1, 4], crickets: false, melody: [4, _, 2, _, 4, _, 5, _, 4, _, 2, _, 0, _, _, _, 1, _, 2, _, 4, _, 2, _, 1, _, 0, _, _, _, _, _] },
  match: { root: 57, bpm: 84, chords: [0, 3, 4, 3], crickets: false, melody: [0, _, 2, _, 4, _, _, 2, 4, _, 5, _, 4, _, _, _, 2, _, _, 0, _, 2, _, _, 1, _, _, _, _, _, _, _] },
  final: { root: 55, bpm: 78, chords: [0, 4, 3, 4], crickets: false, melody: [4, _, _, 5, 4, _, 2, _, 0, _, _, _, 2, _, _, _, 4, _, 7, _, 5, _, 4, _, 2, _, _, _, _, _, _, _] },
  practice: { root: 64, bpm: 76, chords: [0, 3, 1, 3], crickets: false, melody: [5, _, _, _, 4, _, 2, _, 4, _, _, _, _, _, _, _, 3, _, 2, _, 0, _, _, _, 2, _, _, _, _, _, _, _] },
  ending: { root: 60, bpm: 70, chords: [0, 3, 1, 4], crickets: true, melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class CurlSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private scrape: { src: AudioBufferSourceNode; bq: BiquadFilterNode; g: GainNode } | null = null;
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
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; this.scrape = null; }
  private ok(key: string, gap: number) {
    const c = this.ctx; if (!c || !this.soundOn) return false;
    const t = c.currentTime; if ((this.last.get(key) ?? -1) > t - gap) return false; this.last.set(key, t); return true;
  }
  private tone(out: GainNode, type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = 0.005) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
  }
  private hiss(out: GainNode, type: BiquadFilterType, f0: number, f1: number, dur: number, level: number, at = 0, q = 1) {
    const c = this.ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; bq.type = type; bq.Q.value = q; bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 7) * 0.1); s.stop(t + dur + 0.03);
  }
  ui() { if (this.ok('ui', 0.04)) { this.tone(this.sfx!, 'triangle', 640, 860, 0.07, 0.12); this.hiss(this.sfx!, 'highpass', 4000, 6000, 0.04, 0.03); } }
  tick2() { if (this.ok('tick2', 0.05)) this.tone(this.sfx!, 'sine', 1800, 1700, 0.02, 0.03); }
  /** The granite scrape: a looping rumble whose loudness and brightness follow the fastest stone (0 … 4.6 m/s). */
  slide(v: number) {
    const c = this.ctx; if (!c || !this.sfx || !this.noise) return;
    if (!this.scrape) {
      const src = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise; src.loop = true; bq.type = 'lowpass'; bq.Q.value = 2; bq.frequency.value = 200; g.gain.value = 0;
      src.connect(bq); bq.connect(g); g.connect(this.sfx); src.start(); this.scrape = { src, bq, g };
    }
    const k = Math.min(1, v / 3), t = c.currentTime;
    this.scrape.g.gain.setTargetAtTime(v > 0.02 ? 0.05 + 0.2 * k : 0, t, 0.08);
    this.scrape.bq.frequency.setTargetAtTime(140 + 360 * k, t, 0.1);
  }
  /** One stroke of a broom on the ice. */
  brush(strong = true) { if (this.ok('brush', 0.07)) { const o = this.sfx!, now = this.ctx!.currentTime; this.hiss(o, 'bandpass', 3800, 2400, 0.11, strong ? 0.16 : 0.08, now, 1.6); this.hiss(o, 'highpass', 6000, 5000, 0.05, 0.04, now + 0.02); } }
  /** Stones meeting: a deep clack, harder and brighter for a harder hit. */
  clack(v: number) {
    if (!this.ok('clack', 0.03)) return;
    const o = this.sfx!, now = this.ctx!.currentTime, k = Math.min(1, v / 3);
    this.tone(o, 'sine', 210 + 90 * k, 90, 0.18, 0.18 + 0.32 * k, now, 0.002);
    this.hiss(o, 'bandpass', 1800 + 1600 * k, 900, 0.06, 0.12 + 0.25 * k, now, 3);
    this.tone(o, 'square', 820, 600, 0.025, 0.04 + 0.05 * k, now, 0.001);
  }
  thud() { if (this.ok('thud', 0.1)) { this.tone(this.sfx!, 'sine', 120, 60, 0.2, 0.2); this.hiss(this.sfx!, 'lowpass', 500, 120, 0.15, 0.15); } }
  /** The woodland crowd: a swell of voices, with whistles for a big moment. */
  cheer(big = false) {
    if (!this.ok('cheer', 0.5)) return;
    const o = this.sfx!, now = this.ctx!.currentTime, dur = big ? 2.2 : 1.3;
    this.hiss(o, 'bandpass', 900, 1300, dur, big ? 0.22 : 0.14, now, 0.8);
    this.hiss(o, 'bandpass', 2400, 2000, dur * 0.8, big ? 0.1 : 0.06, now + 0.05, 1.2);
    for (let i = 0; i < (big ? 6 : 3); i++) { const f = 1600 + ((i * 373) % 900); this.tone(o, 'sine', f, f * 1.25, 0.16, 0.035, now + 0.1 + i * 0.17); }
  }
  groan() { if (this.ok('groan', 0.6)) { const o = this.sfx!, now = this.ctx!.currentTime; this.hiss(o, 'bandpass', 700, 380, 1.1, 0.12, now, 1); this.tone(o, 'triangle', 330, 220, 0.7, 0.05, now + 0.05, 0.1); } }
  /** The measuring tape unrolling: quick ticks. */
  measure() { if (this.ok('measure', 0.3)) { const now = this.ctx!.currentTime; for (let i = 0; i < 10; i++) this.tone(this.sfx!, 'square', 2400, 2300, 0.012, 0.02, now + i * 0.045); } }
  /** The end's score: a little run of bells, one per point. */
  points(n: number, ours: boolean) { if (this.ok('points', 0.3)) { const now = this.ctx!.currentTime, base = ours ? 72 : 64; for (let i = 0; i < Math.max(1, n); i++) this.tone(this.sfx!, 'sine', hz(base + PENTA[i % 5]), hz(base + PENTA[i % 5]), 0.5, 0.07, now + i * 0.12); } }
  /** The Cup: a rising fanfare. */
  fanfare() { if (this.ok('fanfare', 1)) { const now = this.ctx!.currentTime; [0, 4, 7, 12, 7, 12, 16].forEach((d, i) => this.tone(this.sfx!, 'triangle', hz(67 + d), hz(67 + d), 0.4, 0.09, now + i * 0.14)); } }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    // a plucked lead: a bright attack that dies quickly, like a koto or a harp string
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'triangle', f, f, beat * 2.2, 0.09, at, 0.003); this.tone(m, 'sine', f * 2, f * 2, beat * 0.6, 0.025, at, 0.002); }
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'triangle', hz(r), hz(r), beat * 3, 0.1, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.024, at, 0.4); }
    if (step % 8 === 2) { const f = hz(song.root + 24 + deg(chord + 4)); this.tone(m, 'sine', f, f, beat, 0.015, at, 0.002); }
    if (song.crickets && step % 16 === 7) for (let i = 0; i < 3; i++) this.tone(m, 'sine', 4200, 4300, 0.03, 0.012, at + i * 0.05);
  }
}

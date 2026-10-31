// Paperfold's sounds, all made on the fly with WebAudio: a crisp paper rustle and a soft crease tick for every fold
// (a deeper, muffled one for a fold tucked behind), a hollow tap when a fold isn't allowed, a quick swish for undo,
// a papery snap and a little chime when the shape matches, a stamp and a bell run for the seal, and a lift of
// rising notes as the finished piece floats off to the festival. Under them a gentle plucked loop for each chapter,
// with crickets at night. Silent until the first click, tap or key; closed when the page goes.
import type { ChapterId } from '@/lib/fold-game';

const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[]; crickets: boolean };
export type SongId = 'menu' | ChapterId | 'festival' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 84, chords: [0, 3, 1, 4], crickets: false, melody: [4, _, 2, _, 3, _, _, _, 2, _, 0, _, 1, _, _, _, 2, _, 4, _, 5, _, 4, _, 2, _, _, _, _, _, _, _] },
  lanterns: { root: 60, bpm: 80, chords: [0, 3, 0, 4], crickets: false, melody: [2, _, _, 4, _, _, 3, _, 2, _, _, _, 0, _, _, _, 1, _, 2, _, 4, _, _, _, 3, _, 2, _, _, _, _, _] },
  boats: { root: 57, bpm: 76, chords: [0, 2, 3, 4], crickets: false, melody: [0, _, 2, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, _, 2, _, _, 0, _, 1, _, _, _, _, _, _, _] },
  cranes: { root: 64, bpm: 72, chords: [0, 3, 1, 3], crickets: false, melody: [5, _, _, _, 4, _, 2, _, 4, _, _, _, _, _, _, _, 3, _, 2, _, 0, _, _, _, 2, _, _, _, _, _, _, _] },
  stars: { root: 59, bpm: 68, chords: [0, 4, 3, 1], crickets: true, melody: [4, _, _, 5, _, _, 7, _, _, _, 5, _, 4, _, _, _, 2, _, _, _, 4, _, _, _, 0, _, _, _, _, _, _, _] },
  night: { root: 55, bpm: 74, chords: [0, 3, 4, 3], crickets: true, melody: [2, _, 4, _, 5, _, 4, _, 2, _, _, _, 0, _, _, _, 2, _, 4, _, 7, _, 5, _, 4, _, _, _, _, _, _, _] },
  festival: { root: 62, bpm: 90, chords: [0, 3, 4, 0], crickets: true, melody: [4, _, 4, _, 5, _, 7, _, 5, _, 4, _, 2, _, _, _, 4, _, 2, _, 0, _, 2, _, 4, _, _, _, _, _, _, _] },
  ending: { root: 64, bpm: 64, chords: [0, 3, 1, 4], crickets: true, melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class FoldSound {
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
  ui() { if (this.ok('ui', 0.04)) { this.tone(this.sfx!, 'triangle', 700, 940, 0.07, 0.12); this.hiss(this.sfx!, 'highpass', 4000, 6000, 0.04, 0.03); } }
  hover() { if (this.ok('hover', 0.09)) this.hiss(this.sfx!, 'bandpass', 3200, 2600, 0.03, 0.02, 0, 3); }
  /** A fold: the rustle as the paper lifts, then the crease landing (muffled when it tucks behind). */
  fold(under: boolean, layers: number) {
    if (!this.ok('fold', 0.05)) return;
    const o = this.sfx!, now = this.ctx!.currentTime;
    this.hiss(o, 'bandpass', 1800, 4200, 0.22, 0.13, now, 1.2);
    this.hiss(o, 'highpass', 5000, 7000, 0.12, 0.05, now + 0.08);
    const land = now + 0.36, f = under ? 900 : 1800 - Math.min(5, layers) * 120;
    this.hiss(o, under ? 'lowpass' : 'bandpass', f, f * 0.6, 0.07, 0.22, land, 2.5);
    this.tone(o, 'triangle', under ? 150 : 230, under ? 110 : 170, 0.08, 0.12, land);
  }
  nope() { if (this.ok('nope', 0.15)) { this.tone(this.sfx!, 'sine', 200, 150, 0.14, 0.12); this.hiss(this.sfx!, 'lowpass', 600, 300, 0.08, 0.1); } }
  undo() { if (this.ok('undo', 0.05)) this.hiss(this.sfx!, 'bandpass', 4200, 1600, 0.18, 0.1, 0, 1.4); }
  reset() { if (this.ok('reset', 0.1)) { const now = this.ctx!.currentTime; for (let i = 0; i < 3; i++) this.hiss(this.sfx!, 'bandpass', 2400 - i * 400, 1200, 0.1, 0.08, now + i * 0.07, 1.4); } }
  hint() { if (this.ok('hint', 0.2)) [988, 1319].forEach((f, i) => this.tone(this.sfx!, 'sine', f, f, 0.3, 0.06, this.ctx!.currentTime + i * 0.09)); }
  /** The shape matches: a papery snap, a chime, then the seal stamp and a bell run that climbs with the seal. */
  snap(seal: number) {
    if (!this.ok('snap', 0.3)) return;
    const o = this.sfx!, now = this.ctx!.currentTime;
    this.hiss(o, 'highpass', 3000, 1500, 0.06, 0.3, now); this.tone(o, 'square', 1400, 900, 0.03, 0.05, now);
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.5, 0.09, now + 0.08 + i * 0.07));
    const st = now + 0.75; this.tone(o, 'sine', 120, 70, 0.16, 0.25, st); this.hiss(o, 'lowpass', 900, 200, 0.12, 0.2, st);
    const run = seal >= 3 ? [1047, 1319, 1568, 2093] : seal === 2 ? [1047, 1319, 1568] : [1047, 1319];
    run.forEach((f, i) => this.tone(o, 'sine', f, f, 0.6, 0.07, st + 0.12 + i * 0.09));
  }
  float() { if (this.ok('float', 0.3)) [523, 659, 784, 1047].forEach((f, i) => this.tone(this.sfx!, 'sine', f, f * 1.02, 0.5, 0.05, this.ctx!.currentTime + i * 0.12, 0.05)); }
  light() { if (this.ok('light', 0.4)) { const now = this.ctx!.currentTime; for (let i = 0; i < 8; i++) this.tone(this.sfx!, 'triangle', hz(72 + PENTA[i % 5] + 12 * Math.floor(i / 5)), hz(72 + PENTA[i % 5]), 0.8, 0.06, now + i * 0.12); } }

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

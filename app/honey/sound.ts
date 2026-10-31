// Honeycomb Hollow's sounds, all made on the fly with WebAudio: a glassy clink as a trio turns (and a soft bonk when
// it springs back), bell chimes that climb a pentatonic scale as a cascade chains, a buzz for every bee, a shimmer for
// blossoms, a royal chord for jelly, wax cracking, a wasp's low drone, an acorn's wooden roll, a dew sparkle, and a
// glass music box for each area of the oak. Silent until the first click, tap or key; closed when the page goes.
import type { AreaId } from '@/lib/honey-game';

const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[] };
export type SongId = 'menu' | AreaId | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 65, bpm: 84, chords: [0, 3, 1, 4], melody: [4, _, 5, _, 7, _, 5, _, 4, _, 2, _, 4, _, _, _, 2, _, 4, _, 5, _, 4, _, 2, _, 0, _, _, _, _, _] },
  clover: { root: 64, bpm: 92, chords: [0, 3, 0, 4], melody: [2, _, 4, _, 7, _, 4, _, 5, _, 4, _, 2, _, _, _, 0, _, 2, _, 4, _, 5, _, 4, _, 2, _, _, _, _, _] },
  rose: { root: 62, bpm: 88, chords: [0, 2, 3, 4], melody: [4, _, _, 5, 4, _, 2, _, 4, _, _, _, 7, _, 5, _, 4, _, _, 2, 0, _, 2, _, 4, _, _, _, _, _, _, _] },
  lavender: { root: 60, bpm: 76, chords: [0, 3, 1, 3], melody: [7, _, _, _, 5, _, 4, _, 5, _, _, _, 4, _, 2, _, 4, _, _, _, 2, _, 0, _, 2, _, _, _, _, _, _, _] },
  heather: { root: 57, bpm: 80, chords: [0, 4, 3, 1], melody: [0, _, 2, _, 4, _, _, 2, 4, _, 5, _, 4, _, _, _, 2, _, 0, _, 2, _, 4, _, 2, _, _, _, _, _, _, _] },
  queen: { root: 67, bpm: 86, chords: [0, 3, 4, 0], melody: [4, _, 7, _, 9, _, 7, _, 5, _, 4, _, 5, _, _, _, 4, _, 2, _, 4, _, 5, _, 7, _, _, _, _, _, _, _] },
  ending: { root: 65, bpm: 72, chords: [0, 3, 1, 4], melody: [4, _, _, _, 5, _, 7, _, 9, _, _, _, 7, _, 5, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, _, _, _, _] },
};

export class HoneySound {
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
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate * 1.5), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.05); }
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
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 7) * 0.1); s.stop(t + dur + 0.03);
  }
  /** A glass bell: a sine with a bright, quickly fading partial. */
  private bell(f: number, level: number, at = 0, dur = 0.6) { const o = this.sfx!; this.tone(o, 'sine', f, f, dur, level, at, 0.002); this.tone(o, 'sine', f * 2.76, f * 2.76, dur * 0.35, level * 0.35, at, 0.001); this.tone(o, 'triangle', f * 4.1, f * 4.1, dur * 0.15, level * 0.12, at, 0.001); }
  ui() { if (this.ok('ui', 0.04)) { this.bell(1320, 0.06, 0, 0.18); } }
  hover() { if (this.ok('hover', 0.05)) this.tone(this.sfx!, 'sine', 1760, 1760, 0.05, 0.015, 0, 0.002); }
  turn() { if (this.ok('turn', 0.04)) { const now = this.ctx!.currentTime; this.hiss(this.sfx!, 'bandpass', 3000, 5200, 0.08, 0.04, now, 3); this.bell(2093, 0.035, now, 0.12); this.bell(2637, 0.03, now + 0.05, 0.12); } }
  bounce() { if (this.ok('bounce', 0.08)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'triangle', 330, 250, 0.12, 0.08, now); this.tone(this.sfx!, 'triangle', 250, 300, 0.1, 0.06, now + 0.12); } }
  /** A cascade climbs the scale: each link of the chain rings one step higher. */
  pop(chain: number, n: number) {
    if (!this.ok('pop', 0.03)) return;
    const now = this.ctx!.currentTime, k = chain - 1, deg = PENTA[k % 5] + 12 * Math.floor(k / 5), f = hz(76 + deg);
    this.bell(f, 0.11, now, 0.7); if (n > 4) this.bell(f * 1.5, 0.05, now + 0.04, 0.5);
    this.hiss(this.sfx!, 'highpass', 4000, 7000, 0.12, 0.05, now, 1);
  }
  buzz() { if (this.ok('buzz', 0.1)) { const c = this.ctx!, now = c.currentTime, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 220; lfo.frequency.value = 28; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2; g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.07, now + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.4); o.frequency.exponentialRampToValueAtTime(330, now + 0.35); o.connect(f); f.connect(g); g.connect(this.sfx!); o.start(now); lfo.start(now); o.stop(now + 0.42); lfo.stop(now + 0.42); } }
  blossom() { if (this.ok('blossom', 0.12)) { const now = this.ctx!.currentTime; [72, 76, 79, 84, 88].forEach((m, i) => this.bell(hz(m), 0.06, now + i * 0.035, 0.6)); this.hiss(this.sfx!, 'bandpass', 2000, 6000, 0.4, 0.04, now, 1); } }
  jelly() { if (this.ok('jelly', 0.2)) { const now = this.ctx!.currentTime; for (const m of [60, 64, 67, 72, 76]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 1.1, 0.045, now, 0.02); [84, 88, 91, 96].forEach((m, i) => this.bell(hz(m), 0.05, now + 0.1 + i * 0.06, 0.8)); } }
  combo() { if (this.ok('combo', 0.2)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'sine', 90, 45, 0.5, 0.25, now); this.hiss(this.sfx!, 'lowpass', 2400, 200, 0.6, 0.15, now, 0.8); [67, 71, 74, 79, 83, 86].forEach((m, i) => this.bell(hz(m), 0.06, now + 0.05 + i * 0.05, 0.7)); } }
  made() { if (this.ok('made', 0.08)) { const now = this.ctx!.currentTime; this.bell(hz(88), 0.06, now, 0.4); this.bell(hz(91), 0.05, now + 0.07, 0.5); } }
  wax() { if (this.ok('wax', 0.06)) { const now = this.ctx!.currentTime; this.hiss(this.sfx!, 'bandpass', 1800, 900, 0.09, 0.14, now, 2); this.tone(this.sfx!, 'triangle', 420, 260, 0.06, 0.06, now); } }
  freed() { if (this.ok('freed', 0.15)) { const now = this.ctx!.currentTime; this.buzz(); [79, 84, 88].forEach((m, i) => this.bell(hz(m), 0.05, now + 0.08 + i * 0.08, 0.4)); } }
  wasp() { if (this.ok('wasp', 0.3)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'sawtooth', 140, 170, 0.35, 0.04, now, 0.03); this.hiss(this.sfx!, 'bandpass', 500, 700, 0.3, 0.05, now, 4); } }
  shoo() { if (this.ok('shoo', 0.15)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'sawtooth', 200, 600, 0.3, 0.035, now, 0.01); } }
  acorn() { if (this.ok('acorn', 0.1)) { const now = this.ctx!.currentTime; for (let i = 0; i < 4; i++) this.tone(this.sfx!, 'triangle', 300 - i * 30, 200 - i * 20, 0.07, 0.1, now + i * 0.08); this.bell(hz(84), 0.05, now + 0.35, 0.4); } }
  dew() { if (this.ok('dew', 0.1)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'sine', 1400, 2400, 0.12, 0.06, now, 0.002); this.bell(hz(96), 0.04, now + 0.08, 0.3); } }
  moss() { if (this.ok('moss', 0.3)) this.hiss(this.sfx!, 'lowpass', 600, 300, 0.25, 0.05, 0, 0.7); }
  shuffle() { if (this.ok('shuffle', 0.4)) { const now = this.ctx!.currentTime; for (let i = 0; i < 8; i++) this.bell(hz(84 + PENTA[i % 5]), 0.03, now + i * 0.04, 0.2); } }
  win(stars: number) {
    if (!this.ok('win', 0.5)) return;
    const now = this.ctx!.currentTime, run = [72, 76, 79, 84, 88, 91].slice(0, 3 + stars);
    run.forEach((m, i) => this.bell(hz(m), 0.09, now + i * 0.12, 0.9));
    for (const m of [60, 64, 67]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 1.4, 0.04, now + run.length * 0.12, 0.05);
  }
  lose() { if (this.ok('lose', 0.6)) { const now = this.ctx!.currentTime; [76, 72, 69, 64].forEach((m, i) => this.bell(hz(m), 0.06, now + i * 0.16, 0.5)); } }

  // ---------------------------------------------------------------- music: a glass music box
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tickMusic() {
    const c = this.ctx;
    if (!c || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'sine', f, f, beat * 3, 0.08, at, 0.002); this.tone(m, 'sine', f * 2.76, f * 2.76, beat * 0.4, 0.015, at, 0.001); }
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'sine', hz(r), hz(r), beat * 3, 0.07, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.018, at, 0.4); }
  }
}

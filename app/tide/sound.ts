// Tidepool's sounds, all made on the fly with WebAudio: the sea washing over the rim at high tide and lapping at low
// tide, a soft clay "plop" when a creature goes in, a stone's clunk, a seaweed snip, a bucket's splash, a gull's cry
// and its flap when shooed, tiny bubbly nibbles, a pencil scratch for each sketch, a bright marimba run for a finished
// page and a slow chord when the season turns. Under them a gentle marimba-and-pad loop for each season.
// Silent until the first click, tap or key; closed when the page goes.
import type { Ev } from '@/lib/tide-game';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[] };
export type SongId = 'menu' | 'spring' | 'summer' | 'late' | 'autumn' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 80, chords: [0, 3, 1, 4], melody: [4, _, 2, _, 3, _, _, _, 2, _, 1, _, 0, _, _, _, 2, _, 3, _, 4, _, 5, _, 4, _, _, _, _, _, _, _] },
  spring: { root: 64, bpm: 76, chords: [0, 3, 0, 4], melody: [2, _, _, 4, _, _, 5, _, 4, _, 2, _, _, _, _, _, 1, _, _, 2, _, _, 4, _, 2, _, _, _, _, _, _, _] },
  summer: { root: 65, bpm: 88, chords: [0, 4, 3, 4], melody: [4, _, 5, _, 7, _, 5, _, 4, _, 2, _, 4, _, _, _, 5, _, 4, _, 2, _, 1, _, 2, _, _, _, _, _, _, _] },
  late: { root: 62, bpm: 72, chords: [0, 3, 1, 3], melody: [5, _, _, 4, _, 2, _, _, 4, _, _, 2, _, 1, _, _, 2, _, _, 1, _, 0, _, _, 1, _, _, _, _, _, _, _] },
  autumn: { root: 60, bpm: 66, chords: [0, 3, 4, 1], melody: [4, _, _, _, 2, _, 1, _, 2, _, _, _, 0, _, _, _, 1, _, 2, _, _, _, 4, _, 2, _, _, _, _, _, _, _] },
  ending: { root: 64, bpm: 62, chords: [0, 3, 1, 4], melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, _, _, 5, _, 4, _, 2, _, _, _, _, _, _, _] },
};

export class TideSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private sea: GainNode | null = null;
  private seaFilter: BiquadFilterNode | null = null;
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
      const n = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
      // the sea: looped noise through a low filter whose level follows the tide
      const src = c.createBufferSource(); src.buffer = n; src.loop = true;
      this.seaFilter = c.createBiquadFilter(); this.seaFilter.type = 'lowpass'; this.seaFilter.frequency.value = 500;
      this.sea = c.createGain(); this.sea.gain.value = 0;
      src.connect(this.seaFilter); this.seaFilter.connect(this.sea); this.sea.connect(this.sfx);
      src.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  /** The sea's wash: louder and brighter at high tide, a slow swell at low tide. */
  waves(level: number, on: boolean, t: number) {
    const c = this.ctx; if (!c || !this.sea || !this.seaFilter) return;
    const swell = 0.5 + 0.5 * Math.sin(t * 0.9);
    const g = on ? (0.02 + level * 0.06) * (0.6 + swell * 0.4) : 0;
    this.sea.gain.setTargetAtTime(g, c.currentTime, 0.3);
    this.seaFilter.frequency.setTargetAtTime(300 + level * 700 + swell * 200, c.currentTime, 0.3);
  }
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
  /** A marimba note: a woody sine with a quick overtone. */
  private mallet(out: GainNode, f: number, level: number, at = 0) { this.tone(out, 'sine', f, f, 0.6, level, at, 0.003); this.tone(out, 'sine', f * 4, f * 4, 0.08, level * 0.25, at, 0.002); }
  /** A soft clay plop. */
  private plop(level = 0.12, at = 0) { this.tone(this.sfx!, 'sine', 420, 140, 0.16, level, at); this.hiss(this.sfx!, 'lowpass', 900, 300, 0.12, level * 0.6, at, 0.7); }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 620, 930, 0.08, 0.15); }
  nope() { if (this.ok('nope', 0.15)) this.tone(this.sfx!, 'sine', 240, 170, 0.15, 0.1); }
  tool() { if (this.ok('tool', 0.04)) { this.tone(this.sfx!, 'sine', 330, 440, 0.06, 0.08); this.hiss(this.sfx!, 'bandpass', 2000, 1500, 0.04, 0.03, 0, 3); } }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'eat': if (this.ok('eat', 0.25)) { if (e.who === 'gull') break; this.tone(o, 'sine', 900, 1300, 0.05, 0.035); this.tone(o, 'sine', 1100, 1500, 0.05, 0.03, now + 0.06); } break;
        case 'born': if (e.how === 'brought') this.plop(0.16); else if (this.ok('born', 0.3)) [880, 1175].forEach((f, i) => this.mallet(o, f, 0.05, now + i * 0.07)); break;
        case 'die': if (e.cause === 'eaten' && this.ok('gulp', 0.3)) this.tone(o, 'sine', 300, 120, 0.12, 0.08); break;
        case 'hide': if (this.ok('hide', 0.4)) this.hiss(o, 'bandpass', 2400, 800, 0.2, 0.06, 0, 2); break;
        case 'swap': [523, 659, 784].forEach((f, i) => this.mallet(o, f, 0.08, now + i * 0.06)); this.tone(o, 'triangle', 300, 200, 0.06, 0.05, now + 0.2); break;
        case 'nest': case 'spawn': [659, 784, 988, 1319].forEach((f, i) => this.mallet(o, f, 0.08, now + i * 0.09)); this.hiss(o, 'highpass', 5000, 9000, 0.5, 0.03, now); break;
        case 'gull':
          if (e.st === 'in' && this.ok('gull', 1)) { [0, 0.22, 0.4].forEach((d, i) => this.tone(o, 'sawtooth', 1500 - i * 80, 1000 - i * 60, 0.16, 0.035, now + d)); }
          else if (e.st === 'shoo') { this.hiss(o, 'bandpass', 600, 1600, 0.3, 0.12, 0, 1.5); this.tone(o, 'sawtooth', 1400, 900, 0.12, 0.03, now + 0.1); }
          else if (e.st === 'grab') { this.hiss(o, 'lowpass', 1600, 400, 0.25, 0.14); this.tone(o, 'sawtooth', 1300, 1000, 0.18, 0.04, now + 0.15); }
          break;
        case 'tide': if (e.high) this.hiss(o, 'lowpass', 1800, 300, 1.6, 0.12, 0, 0.7); break;
        case 'storm': this.hiss(o, 'lowpass', 1200, 120, 2.5, 0.2, 0, 0.6); this.tone(o, 'sine', 70, 40, 1.6, 0.12); break;
        case 'find': this.mallet(o, 1047, 0.05); break;
        case 'act':
          if (e.t === 'rock') { this.tone(o, 'sine', 140, 70, 0.2, 0.18); this.hiss(o, 'lowpass', 600, 150, 0.2, 0.1); }
          else if (e.t === 'shell') { this.tone(o, 'triangle', 1800, 1500, 0.05, 0.06); this.tone(o, 'triangle', 2200, 1900, 0.04, 0.04, now + 0.05); }
          else if (e.t === 'plant') this.plop(0.1);
          else if (e.t === 'trim') { this.hiss(o, 'highpass', 3000, 5000, 0.05, 0.08); this.hiss(o, 'highpass', 3000, 5000, 0.05, 0.08, now + 0.09); }
          else if (e.t === 'bucket') { this.hiss(o, 'lowpass', 2500, 300, 0.9, 0.2, 0, 0.8); this.plop(0.14, now + 0.1); }
          break;
        case 'plank': this.tone(o, 'triangle', e.on ? 180 : 220, e.on ? 120 : 160, 0.18, 0.12); this.hiss(o, 'lowpass', 900, 200, 0.2, 0.06); break;
        case 'look': if (e.up) this.hiss(o, 'bandpass', 3500, 2500, 0.18, 0.05, 0, 4); else this.tone(o, 'sine', 700, 760, 0.05, 0.04); break;
        case 'page': [523, 659, 784, 1047, 1319].forEach((f, i) => this.mallet(o, f, 0.1, now + i * 0.08)); break;
        case 'season': [0, 4, 7, 11, 14].forEach((s, i) => this.tone(o, 'triangle', hz(60 + s), hz(60 + s), 1.6, 0.05, now + i * 0.12, 0.05)); break;
        case 'release': this.hiss(o, 'lowpass', 2000, 200, 3, 0.18, 0, 0.6); break;
        case 'ending': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.mallet(o, f, 0.1, now + 0.4 + i * 0.14)); break;
        default: break;
      }
    }
  }

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
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], d = song.melody[step % 32];
    if (d >= 0) this.mallet(m, hz(song.root + 12 + deg(d)), 0.12, at);
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'triangle', hz(r), hz(r), beat * 3, 0.12, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.025, at, 0.4); }
  }
}

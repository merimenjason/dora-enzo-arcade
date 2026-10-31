// Kite Day's sounds, all made on the fly with WebAudio: the wind itself (a soft filtered rush that swells in the gusts
// and hushes in the lulls), the line's hum that rises as it pulls tight, a flap and a rustle when the kite tumbles,
// chimes for rings, pops for puffs, balloons and bubbles, a happy ding-dong for a delivery, a whoosh for each trick,
// a splash or a leafy thump when it comes down, and a fanfare for medals. Under them a ukulele-ish summer loop.
// Silent until the first click, tap or key; closed when the page goes.
import type { Ev } from '@/lib/kite-game';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[]; lead: OscillatorType };
export type SongId = 'menu' | 'fly' | 'festival' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 92, chords: [0, 3, 4, 3], lead: 'triangle', melody: [4, _, 2, _, 3, _, 4, _, 7, _, _, _, 4, _, _, _, 3, _, 2, _, 0, _, 2, _, 3, _, _, _, _, _, _, _] },
  fly: { root: 60, bpm: 100, chords: [0, 4, 3, 4], lead: 'triangle', melody: [2, _, 4, _, _, 5, _, 4, 2, _, _, _, _, _, _, _, 0, _, 2, _, _, 3, _, 2, 1, _, _, _, _, _, _, _] },
  festival: { root: 65, bpm: 116, chords: [0, 3, 4, 0], lead: 'square', melody: [4, _, 4, 5, 7, _, 5, 4, 2, _, 4, _, 0, _, _, _, 2, _, 2, 3, 4, _, 3, 2, 1, _, 2, _, 4, _, _, _] },
  ending: { root: 64, bpm: 76, chords: [0, 3, 1, 4], lead: 'sine', melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class KiteSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private windGain: GainNode | null = null; private windFilter: BiquadFilterNode | null = null;
  private hum: OscillatorNode | null = null; private humGain: GainNode | null = null;
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
      // the wind: looping noise through a soft band-pass, its loudness and pitch following the gusts
      const src = c.createBufferSource(); src.buffer = n; src.loop = true;
      this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.7;
      this.windGain = c.createGain(); this.windGain.gain.value = 0;
      src.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.sfx); src.start();
      // the line's hum
      this.hum = c.createOscillator(); this.hum.type = 'sine'; this.hum.frequency.value = 180;
      this.humGain = c.createGain(); this.humGain.gain.value = 0;
      this.hum.connect(this.humGain); this.humGain.connect(this.sfx); this.hum.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  /** The air every frame: wind speed at the kite (m/s), the line's tension (newtons), and whether we are flying. */
  air(wind: number, tension: number, flying: boolean) {
    const c = this.ctx; if (!c || !this.windGain || !this.windFilter || !this.hum || !this.humGain) return;
    const t = c.currentTime, w = flying ? Math.max(0, Math.min(1.4, wind / 10)) : 0;
    this.windGain.gain.setTargetAtTime(0.02 + w * 0.09, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(300 + w * 700, t, 0.2);
    const tn = flying ? Math.max(0, Math.min(1, tension / 30)) : 0;
    this.hum.frequency.setTargetAtTime(140 + tn * 260, t, 0.08);
    this.humGain.gain.setTargetAtTime(tn > 0.15 ? 0.012 + tn * 0.03 : 0, t, 0.1);
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
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.16); }
  nope() { if (this.ok('nope', 0.15)) this.tone(this.sfx!, 'sine', 220, 160, 0.14, 0.1); }
  medal(n: number) {
    if (!this.ctx || !this.soundOn) return; const o = this.sfx!, now = this.ctx.currentTime;
    const run = n >= 3 ? [523, 659, 784, 1047, 1319, 1568] : n === 2 ? [523, 659, 784, 1047] : n === 1 ? [523, 659, 784] : [440, 415, 392];
    run.forEach((f, i) => this.tone(o, n ? 'triangle' : 'sine', f, f, 0.5, 0.09, now + 0.1 + i * 0.1));
  }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'ring': if (this.ok('ring', 0.05)) { const b = 72 + (e.i % 5) * 2; [0, 4, 7].forEach((s, i) => this.tone(o, 'sine', hz(b + s), hz(b + s), 0.5, 0.07, now + i * 0.05)); } break;
        case 'pop': if (this.ok('pop', 0.04)) { this.tone(o, 'sine', 900, 300, 0.08, 0.12); this.hiss(o, 'highpass', 3000, 6000, 0.07, 0.05); } break;
        case 'deliver': [784, 622].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.45, 0.1, now + i * 0.22)); break;
        case 'trick': if (e.who === 0 && this.ok('trick', 0.1)) { this.hiss(o, 'bandpass', 400, 2400, 0.45, 0.09, 0, 2); this.tone(o, 'triangle', hz(76 + Math.min(4, e.chain) * 2), hz(83 + Math.min(4, e.chain) * 2), 0.25, 0.06, now + 0.2); } break;
        case 'land':
          if (e.who !== 0) break;
          if (e.where === 'water') this.hiss(o, 'lowpass', 1800, 300, 0.5, 0.16);
          else if (e.where === 'tree') { this.hiss(o, 'bandpass', 2500, 1200, 0.35, 0.12, 0, 1.5); this.tone(o, 'sine', 180, 90, 0.15, 0.08); }
          else { this.tone(o, 'sine', 140, 60, 0.18, 0.14); this.hiss(o, 'lowpass', 600, 150, 0.15, 0.08); }
          break;
        case 'tumble': if (e.who === 0 && this.ok('tumble', 0.4)) for (let i = 0; i < 4; i++) this.hiss(o, 'bandpass', 900, 700, 0.06, 0.08, now + i * 0.09, 3); break;
        case 'recover': if (e.who === 0) this.tone(o, 'sine', 440, 660, 0.15, 0.05); break;
        case 'launch': if (e.who === 0) this.hiss(o, 'bandpass', 500, 1500, 0.4, 0.06, 0, 1.2); break;
        case 'touch': (e.by === 0 ? [988, 1319] : [494, 392]).forEach((f, i) => this.tone(o, 'triangle', f, f, 0.3, 0.09, now + i * 0.1)); break;
        case 'tangle': this.tone(o, 'sawtooth', 200, 120, 0.4, 0.05); break;
        case 'cue': if (e.good) this.tone(o, 'triangle', e.perfect ? 1319 : 988, e.perfect ? 1319 : 988, 0.3, 0.08); break;
        case 'dragonfly': if (this.ok('df', 0.1)) this.tone(o, 'square', 2200, 2600, 0.03, 0.02); break;
        case 'gust': this.hiss(o, 'bandpass', 300, 1100, 1.2, 0.05, 0, 0.8); break;
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
    if (d >= 0) this.tone(m, song.lead, hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 2, song.lead === 'square' ? 0.04 : 0.08, at, 0.01);
    // a strummed ukulele-ish chord on the off-beats, and a soft bass
    if (step % 4 === 2) for (const [i, k] of [0, 2, 4].entries()) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'triangle', f, f * 0.998, beat * 1.4, 0.035, at + i * 0.012, 0.003); }
    if (step % 8 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'sine', hz(r), hz(r), beat * 4, 0.12, at, 0.01); }
  }
}

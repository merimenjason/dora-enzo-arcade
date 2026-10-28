// Seedstorm's sounds, all made on the fly with WebAudio: soft shot ticks, puff pops, graze tings, a Bloom whoosh and
// chime, chords when a boss phase breaks, a hit "oof", and a light music loop per stage from a tiny step sequencer
// (a melody over a bass and a soft beat, each stage in its own key and tempo). Silent until the first click or key.
import type { Ev } from '@/lib/seedstorm-game';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** A song: root note, tempo, scale, chord roots (scale degrees, one per bar), and 32-step melodies (degrees, -1 rests). */
type Song = { root: number; bpm: number; scale: number[]; chords: number[]; melody: number[]; boss: number[] };
const _ = -1;
const SONGS: Song[] = [
  // Meadow Morning: bright and bouncy
  { root: 60, bpm: 104, scale: MAJOR, chords: [0, 5, 3, 4], melody: [4, _, 2, 4, 5, _, 4, _, 2, _, 0, 2, 4, _, _, _, 5, _, 4, 5, 7, _, 5, 4, 2, _, 4, _, 1, _, _, _], boss: [7, 7, _, 4, 5, _, 7, _, 9, _, 7, 5, 4, _, 2, _, 4, 4, _, 2, 4, _, 5, _, 7, _, 5, 4, 2, _, 0, _] },
  // Orchard Breeze: a skipping waltz-like lilt
  { root: 65, bpm: 112, scale: MAJOR, chords: [0, 3, 4, 0], melody: [2, 4, 7, _, 4, 2, 4, _, 5, 4, 2, _, 0, _, 2, _, 2, 4, 7, _, 9, 7, 5, _, 4, _, 2, _, 4, _, _, _], boss: [7, _, 9, 7, 4, _, 2, 4, 5, _, 7, 5, 2, _, 0, _, 4, _, 5, 4, 2, _, 4, 5, 7, _, 4, _, 2, _, _, _] },
  // Thunderhead: low and rolling
  { root: 57, bpm: 96, scale: DORIAN, chords: [0, 6, 3, 4], melody: [0, _, 2, _, 4, _, 2, _, 3, _, 2, 0, 6, _, _, _, 0, _, 2, _, 4, _, 7, _, 6, _, 4, 3, 2, _, _, _], boss: [7, _, 7, 6, 4, _, 2, _, 4, 6, 7, _, 9, _, 7, _, 4, _, 4, 3, 2, _, 0, _, 2, 3, 4, _, 6, _, 4, _] },
  // Moonlit Mist: slow and dreamy
  { root: 62, bpm: 88, scale: MAJOR, chords: [0, 5, 1, 4], melody: [4, _, _, 5, 4, _, 2, _, 0, _, _, _, 2, _, 4, _, 5, _, _, 7, 5, _, 4, _, 2, _, _, _, _, _, _, _], boss: [9, _, 7, _, 5, _, 4, _, 2, _, 4, 5, 4, _, _, _, 9, _, 7, _, 5, _, 7, _, 9, _, 11, _, 9, _, _, _] },
  // Eye of the Storm: urgent but still friendly
  { root: 55, bpm: 120, scale: DORIAN, chords: [0, 3, 6, 4], melody: [0, 2, 3, _, 4, _, 3, 2, 0, _, 6, _, 4, _, _, _, 0, 2, 3, _, 4, _, 7, 6, 4, _, 3, _, 2, _, _, _], boss: [7, _, 9, 10, 9, _, 7, _, 4, _, 7, _, 6, _, 4, _, 7, _, 9, 10, 11, _, 9, _, 7, _, 6, 4, 3, _, 2, _] },
];

export class SeedstormSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song = -1; private bossSong = false; private step = 0; private nextAt = 0; private playing = false;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const master = this.ctx.createGain(); master.gain.value = 0.6; master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = this.ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.32 : 0; this.mus.connect(master);
      const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.5), this.ctx.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  get ready() { return !!this.ctx; }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05); }
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
  private hiss(out: GainNode, type: BiquadFilterType, f0: number, f1: number, dur: number, level: number, at = 0) {
    const c = this.ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; bq.type = type; bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 5) * 0.05); s.stop(t + dur + 0.03);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.2); }
  buy() { if (this.ok('buy', 0.05)) { this.tone(this.sfx!, 'triangle', 784, 784, 0.1, 0.22); this.tone(this.sfx!, 'triangle', 1175, 1175, 0.16, 0.2, this.ctx!.currentTime + 0.07); } }
  page() { if (this.ok('page', 0.05)) this.tone(this.sfx!, 'sine', 520, 620, 0.06, 0.12); }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'shot': if (this.ok('shot', 0.09)) this.tone(o, 'square', e.pilot === 'dora' ? 1500 : 900, e.pilot === 'dora' ? 1300 : 700, 0.025, 0.018); break;
        case 'puff': if (this.ok('puff', 0.04)) { this.hiss(o, 'bandpass', 1800, 500, 0.12, 0.22); this.tone(o, 'sine', 700, 1100, 0.08, 0.12); } break;
        case 'graze': if (this.ok('graze', 0.035)) this.tone(o, 'sine', 2637, 2637, 0.07, 0.05); break;
        case 'collect': if (this.ok('collect', 0.05)) this.tone(o, 'triangle', e.big ? 1568 : 1319, e.big ? 2093 : 1480, 0.06, e.big ? 0.12 : 0.05); break;
        case 'hit': this.tone(o, 'triangle', 330, 110, 0.35, 0.35); this.hiss(o, 'lowpass', 900, 200, 0.3, 0.3); break;
        case 'saved': [784, 988, 1175].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.18, 0.18, now + i * 0.05)); break;
        case 'bloom':
          this.hiss(o, 'bandpass', 400, 4000, 0.6, 0.35);
          [1047, 1319, 1568, 2093, 2637].forEach((f, i) => this.tone(o, 'sine', f, f, 0.5, 0.12, now + 0.08 + i * 0.06)); break;
        case 'bloomUp': [1319, 1760].forEach((f, i) => this.tone(o, 'sine', f, f, 0.2, 0.12, now + i * 0.07)); break;
        case 'bossHit': if (this.ok('bossHit', 0.07)) this.tone(o, 'square', 220, 180, 0.03, 0.025); break;
        case 'bossIn': this.tone(o, 'sawtooth', 110, 82, 0.9, 0.08); this.hiss(o, 'lowpass', 300, 900, 0.9, 0.15); break;
        case 'phase': [523, 659].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.15, 0.12, now + i * 0.08)); break;
        case 'break': {
          const chord = e.timedOut ? [392, 494, 587] : [523, 659, 784, 1047];
          chord.forEach((f, i) => this.tone(o, 'triangle', f, f, 0.9, 0.16, now + i * 0.05, 0.02));
          this.hiss(o, 'highpass', 3000, 8000, 0.5, 0.12); break;
        }
        case 'calm': [659, 784, 988, 1319].forEach((f, i) => this.tone(o, 'sine', f, f, 1.2, 0.13, now + i * 0.12, 0.03)); break;
        case 'clear': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.25, 0.16, now + i * 0.09)); break;
        case 'over': [523, 466, 392, 330].forEach((f, i) => this.tone(o, 'triangle', f, f * 0.98, 0.4, 0.18, now + i * 0.2)); break;
        case 'won': [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.5, 0.15, now + i * 0.1)); break;
        case 'continue': [392, 523, 659, 784].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.2, 0.15, now + i * 0.07)); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- music
  /** Chooses the loop: a stage's tune, or its boss variant; -1 stops. */
  music(stage: number, boss: boolean) {
    if (stage === this.song && boss === this.bossSong) return;
    this.song = stage; this.bossSong = boss; this.step = 0; this.nextAt = 0;
  }
  /** Keeps the loop going; call every frame. `on` is false while paused or off the play screen. */
  tick(on: boolean) {
    const c = this.ctx; this.playing = on && this.song >= 1;
    if (!c || !this.playing || !this.musicOn) { this.nextAt = 0; return; }
    const song = SONGS[(this.song - 1) % SONGS.length], beat = 60 / (song.bpm + (this.bossSong ? 12 : 0)) / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.18) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => song.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    // melody
    const line = this.bossSong ? song.boss : song.melody, d = line[s];
    if (d >= 0) this.tone(m, this.bossSong ? 'square' : 'triangle', hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 1.8, this.bossSong ? 0.05 : 0.12, at, 0.01);
    // bass on the beat, a fifth on the off-beat
    if (step % 2 === 0) { const r = song.root - 12 + deg(chord) + (step % 4 === 2 ? 7 : 0); this.tone(m, 'sine', hz(r), hz(r), beat * 1.6, 0.2, at, 0.01); }
    // a soft chord pad at the start of each bar
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 7, 0.035, at, 0.15); }
    // the beat: a soft kick, a shaker
    if (step % 4 === 0) this.tone(m, 'sine', 120, 45, 0.16, 0.25, at, 0.002);
    if (step % 2 === 1) this.hiss(m, 'highpass', 6000, 9000, 0.04, this.bossSong ? 0.08 : 0.05, at);
    if (this.bossSong && step % 8 === 4) this.hiss(m, 'bandpass', 1800, 900, 0.12, 0.12, at);
  }
}

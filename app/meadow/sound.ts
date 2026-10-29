// Meadowmend's sounds, all made on the fly with WebAudio: a soft wooden pluck when a tile lands (brighter with each
// matching edge), little chimes for the matches, a turn tick, a rising bell run for a Perfect, a warm chord when a
// patch is finished, a splash and a duck's quack for a pond, a happy jingle for a granted wish and a soft sigh for a
// spoiled one, and a music-box flourish when the stack runs out. Under them a gentle pentatonic loop with birdsong.
// Silent until the first click, tap or key; closed when the page goes.
import type { Ev } from '@/lib/meadow-game';

const PENTA = [0, 2, 4, 7, 9], PENTA_MINOR = [0, 3, 5, 7, 10];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
/** A loop: root note, tempo, scale, a chord root per bar, and a 32-step melody in scale degrees (-1 rests). */
type Song = { root: number; bpm: number; scale: number[]; chords: number[]; melody: number[]; lead: OscillatorType; birds: boolean };
export type SongId = 'menu' | 'valley' | 'endless' | 'ending';
const SONGS: Record<SongId, Song> = {
  // a light morning tune for the menu
  menu: { root: 62, bpm: 84, scale: PENTA, chords: [0, 3, 1, 3], lead: 'triangle', birds: true, melody: [4, _, 3, _, 2, _, _, _, 3, _, 2, _, 0, _, _, _, 1, _, 2, _, 3, _, 4, _, 2, _, _, _, _, _, _, _] },
  // slow and spacious while you think
  valley: { root: 60, bpm: 72, scale: PENTA, chords: [0, 3, 0, 4], lead: 'sine', birds: true, melody: [2, _, _, _, 4, _, 3, _, 2, _, _, _, _, _, _, _, 0, _, _, 1, _, _, 2, _, 3, _, _, _, _, _, _, _] },
  // dusk in the endless meadow
  endless: { root: 57, bpm: 70, scale: PENTA_MINOR, chords: [0, 3, 2, 3], lead: 'sine', birds: true, melody: [4, _, _, 3, _, _, 2, _, 3, _, _, _, _, _, _, _, 2, _, _, 1, _, _, 0, _, 1, _, _, _, _, _, _, _] },
  // golden evening by the pond
  ending: { root: 64, bpm: 66, scale: PENTA, chords: [0, 3, 1, 4], lead: 'triangle', birds: false, melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class MeadowSound {
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
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.24 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.24 : 0, this.ctx.currentTime, 0.05); }
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
  /** A plucked string: a quick bright attack that rings down. */
  private pluck(f: number, level: number, at = 0) { const o = this.sfx!; this.tone(o, 'triangle', f, f * 0.995, 0.5, level, at, 0.003); this.tone(o, 'sine', f * 2, f * 2, 0.18, level * 0.4, at, 0.002); }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.18); }
  turn() { if (this.ok('turn', 0.03)) { this.tone(this.sfx!, 'square', 1800, 1500, 0.025, 0.03); this.hiss(this.sfx!, 'bandpass', 2400, 1800, 0.04, 0.05, 0, 3); } }
  pick() { if (this.ok('pick', 0.05)) this.tone(this.sfx!, 'sine', 520, 700, 0.07, 0.07); }
  nope() { if (this.ok('nope', 0.15)) this.tone(this.sfx!, 'sine', 220, 160, 0.14, 0.1); }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    const notes = [523, 587, 659, 784, 880, 1047, 1175];
    for (const e of events) {
      switch (e.k) {
        case 'place': {
          this.hiss(o, 'lowpass', 900, 200, 0.12, 0.12, now + 0.38, 0.8); this.tone(o, 'sine', 160, 80, 0.12, 0.12, now + 0.38);
          this.pluck(notes[Math.min(6, e.matches)] / 2, 0.14, now + 0.4);
          break;
        }
        case 'match': this.pluck(notes[(e.side + 2) % 7], 0.06, now + 0.42 + e.side * 0.04); break;
        case 'perfect': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(o, 'sine', f, f, 0.6, 0.08, now + 0.5 + i * 0.07)); this.hiss(o, 'highpass', 5000, 9000, 0.6, 0.04, now + 0.5); break;
        case 'close':
          if (e.pond) { this.hiss(o, 'bandpass', 600, 1400, 0.5, 0.14, now + 0.55, 2); this.tone(o, 'sawtooth', 520, 420, 0.12, 0.04, now + 0.9); this.tone(o, 'sawtooth', 500, 400, 0.12, 0.04, now + 1.05); }
          [0, 4, 7, 12].forEach((s, i) => this.tone(o, 'triangle', hz(67 + s), hz(67 + s), 0.9, 0.06, now + 0.5 + i * 0.05));
          break;
        case 'wish':
          if (e.state === 'done') [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.4, 0.09, now + 0.6 + i * 0.08));
          else if (e.state === 'failed') [523, 494, 440].forEach((f, i) => this.tone(o, 'sine', f, f * 0.97, 0.4, 0.06, now + 0.5 + i * 0.14));
          else if (e.state === 'new') this.tone(o, 'sine', 1319, 1568, 0.2, 0.05, now + 0.45);
          break;
        case 'bonus': if (this.ok('bonus', 0.2)) [1047, 1319].forEach((f, i) => this.tone(o, 'sine', f, f, 0.3, 0.06, now + 0.8 + i * 0.06)); break;
        case 'grow': this.tone(o, 'triangle', 988, 1175, 0.2, 0.05, now + 0.5); break;
        case 'undo': this.tone(o, 'sine', 700, 400, 0.15, 0.08); break;
        case 'end': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.5, 0.09, now + 0.7 + i * 0.12)); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- music
  /** Picks the loop (null stops it). */
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  /** Keeps the loop going; call every frame. `on` is false while paused. */
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => song.scale[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    if (d >= 0) this.tone(m, song.lead, hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 2.4, 0.09, at, 0.02);
    // a soft plucked bass and a slow pad
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'triangle', hz(r), hz(r), beat * 3, 0.13, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.03, at, 0.4); }
    // now and then, a bird
    if (song.birds && step % 16 === 11 && Math.floor(step / 16) % 2 === 0) { const f = 2600 + (step % 3) * 300; this.tone(m, 'sine', f, f * 1.25, 0.08, 0.03, at); this.tone(m, 'sine', f * 1.1, f * 1.4, 0.07, 0.025, at + 0.11); }
  }
}

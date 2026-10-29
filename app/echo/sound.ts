// Echo Burrow's sounds, all made on the fly with WebAudio: paw hops (Dora's higher and lighter), soft landings, a
// plate's click and a door's wooden slide, crate scrapes, a seesaw's clack and boing, crumbling stone, a seed's chime,
// the candle's last ticks, a soft bell as a recording starts, the rewind's backwards whoosh, a shimmer as the echo
// steps out, and a fanfare at the burrow door; under them a gentle loop per chapter from a tiny step sequencer.
// Silent until the first click, tap or key; closed when the page goes.
import type { Ev, ChapterId } from '@/lib/echo-game';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11], AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** A loop: root note, tempo, scale, a chord root per bar, and a 32-step melody in scale degrees (-1 rests). */
type Song = { root: number; bpm: number; scale: number[]; chords: number[]; melody: number[]; lead: OscillatorType };
const _ = -1;
const SONGS: Record<ChapterId | 'ending', Song> = {
  // a curious plucked tune among the roots
  cellar: { root: 57, bpm: 88, scale: DORIAN, chords: [0, 3, 4, 0], lead: 'triangle', melody: [0, _, 2, _, 4, _, 3, 2, 0, _, _, _, 4, _, 5, _, 4, _, 2, _, 3, _, 2, 0, 1, _, _, _, _, _, _, _] },
  // bouncy and a little silly between the mushrooms
  hollow: { root: 60, bpm: 104, scale: MAJOR, chords: [0, 5, 3, 4], lead: 'square', melody: [4, _, 2, 4, 7, _, 4, _, 5, _, 4, 2, 0, _, _, _, 2, _, 4, 5, 7, _, 9, _, 7, 5, 4, _, 2, _, _, _] },
  // flowing, like water over stones
  brook: { root: 62, bpm: 96, scale: LYDIAN, chords: [0, 1, 0, 4], lead: 'sine', melody: [7, 6, 4, _, 2, _, 4, _, 6, _, 7, _, 9, _, _, _, 7, _, 6, 4, 2, _, 1, _, 2, _, 4, _, _, _, _, _] },
  // glassy and slow in the crystal light
  gallery: { root: 64, bpm: 80, scale: AEOLIAN, chords: [0, 5, 3, 6], lead: 'sine', melody: [7, _, _, 9, _, _, 11, _, 9, _, 7, _, 4, _, _, _, 5, _, _, 7, _, _, 9, _, 7, _, 4, _, 2, _, _, _] },
  // warm, nearly home
  home: { root: 60, bpm: 92, scale: MAJOR, chords: [0, 3, 4, 0], lead: 'triangle', melody: [4, _, 5, _, 7, _, 9, _, 7, _, 4, _, 5, _, _, _, 2, _, 4, _, 5, _, 7, _, 4, _, 2, _, 0, _, _, _] },
  // the slow hearth-side version for the ending
  ending: { root: 60, bpm: 66, scale: MAJOR, chords: [0, 5, 3, 4], lead: 'sine', melody: [7, _, _, _, 9, _, 7, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, _, _, _, _, _, _] },
};

export class EchoSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private wind: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: ChapterId | 'ending' | null = null; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const master = this.ctx.createGain(); master.gain.value = 0.6; master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = this.ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.28 : 0; this.mus.connect(master);
      const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate), this.ctx.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
      // a quiet bed of wind for rooms with running fans
      const src = this.ctx.createBufferSource(), bq = this.ctx.createBiquadFilter(); src.buffer = n; src.loop = true;
      bq.type = 'bandpass'; bq.frequency.value = 700; bq.Q.value = 0.8;
      this.wind = this.ctx.createGain(); this.wind.gain.value = 0;
      src.connect(bq); bq.connect(this.wind); this.wind.connect(this.sfx); src.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, 0.05); }
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
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.05, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 7) * 0.1); s.stop(t + dur + 0.03);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.2); }
  /** The wind bed: on in rooms where a fan is blowing. */
  windOn(on: boolean) { const c = this.ctx, w = this.wind; if (!c || !w) return; w.gain.setTargetAtTime(on && this.soundOn ? 0.09 : 0, c.currentTime, 0.3); }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'jump': {
          const f = e.who === 'dora' ? 520 : 330;
          this.tone(o, 'sine', f, f * (e.boost ? 2.6 : 1.8), e.boost ? 0.22 : 0.12, 0.13);
          if (e.boost) this.tone(o, 'triangle', f * 2, f * 3.2, 0.18, 0.06, now + 0.04);
          break;
        }
        case 'land': if (this.ok('land', 0.05)) { const k = Math.min(1, e.v / 450); this.tone(o, 'sine', e.who === 'dora' ? 220 : 150, 70, 0.08 + k * 0.08, 0.06 + k * 0.16); this.hiss(o, 'lowpass', 900, 200, 0.06 + k * 0.08, 0.05 + k * 0.1); } break;
        case 'bonk': if (this.ok('bonk', 0.1)) { this.tone(o, 'square', 300, 260, 0.05, 0.05); this.tone(o, 'triangle', 900, 860, 0.15, 0.04, now + 0.01); } break;
        case 'plate': this.tone(o, 'square', e.on ? 1400 : 1000, e.on ? 1200 : 900, 0.03, 0.06); this.tone(o, 'triangle', e.on ? 700 : 520, e.on ? 700 : 520, 0.08, 0.08, now + 0.01); break;
        case 'door': this.hiss(o, 'bandpass', e.open ? 500 : 800, e.open ? 900 : 400, 0.32, 0.12, 0, 3); this.tone(o, 'sine', e.open ? 110 : 140, e.open ? 140 : 100, 0.3, 0.05); if (!e.open) this.tone(o, 'sine', 90, 60, 0.12, 0.12, now + 0.28); break;
        case 'lift': this.tone(o, 'sawtooth', e.up ? 80 : 100, e.up ? 100 : 80, 0.4, 0.035); this.hiss(o, 'bandpass', 300, 400, 0.4, 0.05, 0, 4); break;
        case 'push': if (this.ok('push', 0.16)) this.hiss(o, 'lowpass', 500, 260, 0.16, 0.12, 0, 1.5); break;
        case 'crate': this.tone(o, 'sine', 120, 60, 0.18, 0.22); this.hiss(o, 'lowpass', 700, 200, 0.15, 0.15); break;
        case 'flip': this.tone(o, 'square', 420, 380, 0.04, 0.08); this.tone(o, 'triangle', 200, 180, 0.15, 0.12, now + 0.01); break;
        case 'launch': this.tone(o, 'sine', 200, 900, 0.32, 0.16); this.tone(o, 'triangle', 400, 1500, 0.28, 0.06, now + 0.03); break;
        case 'shake': if (this.ok('shake', 0.12)) this.hiss(o, 'highpass', 2500, 3500, 0.08, 0.05); break;
        case 'crumble': this.hiss(o, 'bandpass', 1800, 400, 0.5, 0.2, 0, 1.2); for (let i = 0; i < 4; i++) this.tone(o, 'square', 900 - i * 120, 600 - i * 80, 0.03, 0.03, now + i * 0.06); break;
        case 'seed': [1319, 1568, 1976, 2637].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.22, 0.1, now + i * 0.06)); break;
        case 'fan': this.tone(o, 'sine', e.on ? 300 : 500, e.on ? 500 : 300, 0.25, 0.05); break;
        case 'candle': this.tone(o, 'sine', 1760, 1760, 0.06, 0.08); this.tone(o, 'sine', 880, 880, 0.12, 0.05, now + 0.02); break;
        case 'record': [523, 784].forEach((f, i) => this.tone(o, 'sine', f, f, 0.9, 0.08, now + i * 0.04, 0.01)); break;
        case 'rewind': {
          // a backwards whoosh: noise that swells and falls, under a falling glide
          const long = e.why === 'candle' || e.why === 'key';
          const d = long ? 0.7 : 0.45;
          this.hiss(o, 'bandpass', 3000, 300, d, 0.2, 0, 2);
          this.tone(o, 'sine', 1400, 200, d, 0.08);
          this.tone(o, 'triangle', 700, 100, d, 0.05, now + 0.05);
          break;
        }
        case 'live': [880, 1109, 1319, 1760].forEach((f, i) => this.tone(o, 'sine', f, f, 0.35, 0.05, now + i * 0.05)); break;
        case 'clear': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.45, 0.13, now + i * 0.09)); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- music
  /** Picks the loop for a chapter (null stops it). */
  music(ch: ChapterId | 'ending' | null) { if (ch === this.song) return; this.song = ch; this.step = 0; this.nextAt = 0; }
  /** Keeps the loop going; call every frame. `on` is false while paused. */
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.18) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => song.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    if (d >= 0) this.tone(m, song.lead, hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 1.8, song.lead === 'square' ? 0.045 : 0.1, at, 0.01);
    if (step % 2 === 0) { const r = song.root - 12 + deg(chord) + (step % 4 === 2 ? 7 : 0); this.tone(m, 'triangle', hz(r), hz(r), beat * 1.4, 0.15, at, 0.005); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 7, 0.03, at, 0.2); }
    // a drip now and then, like water in the dark
    if (step % 16 === 11) { const f = hz(song.root + 24 + deg((step * 3) % 7)); this.tone(m, 'sine', f * 1.5, f, 0.12, 0.05, at, 0.002); }
  }
}

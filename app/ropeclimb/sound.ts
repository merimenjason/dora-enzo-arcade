// Ropeclimb's sounds, all made on the fly with WebAudio: a springy boing for each leap (higher for a bigger one), soft
// paw thumps, claw scratches, the rope's creak when hauled and its twang when it snaps tight, straw crackle, a lantern
// clonk, wind through the knotholes, an owl's hoot and wing beats, the great bell, an acorn chime, a dust-bath fanfare,
// and a soft music loop per section from a tiny step sequencer. Silent until the first click, tap or key.
import type { Ev, SectionId } from '@/lib/ropeclimb-game';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MIXO = [0, 2, 4, 5, 7, 9, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** A loop: root note, tempo, scale, a chord root per bar, and a 32-step melody in scale degrees (-1 rests). */
type Song = { root: number; bpm: number; scale: number[]; chords: number[]; melody: number[]; lead: OscillatorType };
const _ = -1;
const SONGS: Record<SectionId, Song> = {
  // a plucky little cellar tune, a bit mysterious
  cellar: { root: 57, bpm: 92, scale: DORIAN, chords: [0, 3, 4, 0], lead: 'triangle', melody: [0, _, 2, _, 4, _, 2, 0, 3, _, _, 2, 0, _, _, _, 4, _, 5, 4, 2, _, 0, _, 2, _, 3, _, 1, _, _, _] },
  // a bouncy country stroll for the stables
  stables: { root: 60, bpm: 108, scale: MAJOR, chords: [0, 3, 4, 0], lead: 'triangle', melody: [4, _, 4, 5, 7, _, 4, _, 2, _, 2, 4, 5, _, _, _, 4, _, 4, 5, 7, _, 9, 7, 5, _, 4, _, 2, _, _, _] },
  // a sunny lilt in the hay
  hayloft: { root: 62, bpm: 100, scale: MIXO, chords: [0, 6, 3, 0], lead: 'sine', melody: [7, _, 6, 4, 2, _, 4, _, 6, _, 7, _, 4, _, _, _, 2, _, 4, 6, 7, _, 9, _, 7, 6, 4, _, 2, _, _, _] },
  // warm and swaying up among the lanterns
  rafters: { root: 55, bpm: 96, scale: MAJOR, chords: [0, 5, 3, 4], lead: 'triangle', melody: [2, _, 4, _, 7, _, _, 4, 5, _, 4, 2, 0, _, _, _, 2, _, 4, _, 7, _, 9, _, 7, _, 5, _, 4, _, _, _] },
  // hushed and twinkly, tiptoeing past the owls
  belfry: { root: 64, bpm: 76, scale: DORIAN, chords: [0, 5, 3, 4], lead: 'sine', melody: [7, _, _, 4, _, _, 2, _, 3, _, _, _, 0, _, _, _, 7, _, _, 9, _, _, 7, _, 4, _, _, _, 2, _, _, _] },
  // big and bright on the roof at sunset
  rooftop: { root: 60, bpm: 116, scale: MAJOR, chords: [0, 4, 5, 3], lead: 'triangle', melody: [7, _, 9, 7, 4, _, 7, _, 11, _, 9, _, 7, _, _, _, 4, _, 5, 7, 9, _, 7, _, 5, 4, 2, _, 0, _, _, _] },
};

export class RopeclimbSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private wind: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SectionId | null = null; private step = 0; private nextAt = 0; private ending = false;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const master = this.ctx.createGain(); master.gain.value = 0.6; master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = this.ctx.createGain(); this.mus.gain.value = this.musicOn ? 0.3 : 0; this.mus.connect(master);
      const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 1), this.ctx.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
      // a quiet wind bed, swelled by the gusts
      const src = this.ctx.createBufferSource(), bq = this.ctx.createBiquadFilter(); src.buffer = n; src.loop = true;
      bq.type = 'bandpass'; bq.frequency.value = 500; bq.Q.value = 0.7;
      this.wind = this.ctx.createGain(); this.wind.gain.value = 0;
      src.connect(bq); bq.connect(this.wind); this.wind.connect(this.sfx); src.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  get ready() { return !!this.ctx; }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.05); }
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
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 7) * 0.1); s.stop(t + dur + 0.03);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.2); }
  /** The charge building: a soft rising hum while a leap is held. */
  charge(k: number) { if (k > 0 && this.ok('charge', 0.11)) this.tone(this.sfx!, 'sine', 180 + k * 260, 200 + k * 280, 0.1, 0.03 + 0.03 * k); }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'jump': {
          // a springy boing, higher and longer for a bigger leap; Dora's a touch higher than Enzo's
          const b = e.who === 'dora' ? 1.12 : 1, f = (220 + 260 * e.charge) * b;
          this.tone(o, 'sine', f, f * 2.2, 0.16 + 0.08 * e.charge, 0.16); this.hiss(o, 'highpass', 2000, 4000, 0.06, 0.05); break;
        }
        case 'land': if (this.ok('land' + e.who, 0.06)) { this.tone(o, 'sine', e.hard ? 120 : 170, 60, e.hard ? 0.22 : 0.1, e.hard ? 0.4 : Math.min(0.25, 0.06 + e.v / 2500)); this.hiss(o, 'lowpass', 900, 200, e.hard ? 0.25 : 0.08, e.hard ? 0.25 : 0.08); } break;
        case 'grip': if (this.ok('grip', 0.05)) { this.hiss(o, 'bandpass', 3200, 1800, 0.07, 0.14, 0, 3); this.tone(o, 'square', 900, 700, 0.02, 0.02); } break;
        case 'catch': {
          // the rope snaps tight: a low twang and a creak
          const k = Math.min(1, e.v / 600);
          this.tone(o, 'sawtooth', 98, 92, 0.5, 0.06 + 0.06 * k, 0, 0.002); this.tone(o, 'triangle', 196, 180, 0.35, 0.1 + 0.06 * k, 0, 0.002);
          this.creak(now + 0.05); break;
        }
        case 'yank': this.tone(o, 'triangle', 160, 140, 0.2, 0.08, 0, 0.002); break;
        case 'drag': if (this.ok('drag', 0.3)) this.hiss(o, 'bandpass', 600, 300, 0.3, 0.12, 0, 2); break;
        case 'haul': this.creak(now); break;
        case 'slip': this.tone(o, 'triangle', 600, 200, 0.3, 0.14); this.hiss(o, 'bandpass', 2500, 800, 0.2, 0.12, 0, 2); break;
        case 'strain': this.tone(o, 'square', 740, 740, 0.06, 0.04); this.tone(o, 'square', 740, 740, 0.06, 0.04, now + 0.12); break;
        case 'fall': this.tone(o, 'triangle', 520, 260, 0.35, 0.1); break;
        case 'crumble': this.hiss(o, 'bandpass', 2400, 600, 0.45, 0.22, 0, 1.5); for (let i = 0; i < 4; i++) this.tone(o, 'square', 1400 - i * 200, 900 - i * 100, 0.02, 0.03, now + i * 0.05); break;
        case 'straw': this.hiss(o, 'highpass', 3000, 5000, 0.15, 0.04); break;
        case 'bonk': this.tone(o, 'square', 320, 280, 0.05, 0.08); this.tone(o, 'triangle', 1200, 1100, 0.3, 0.08, now + 0.01); this.hiss(o, 'lowpass', 1200, 300, 0.12, 0.15); break;
        case 'shove': this.hiss(o, 'lowpass', 700, 200, 0.2, 0.2); this.tone(o, 'sine', 140, 80, 0.15, 0.2); break;
        case 'gust': this.gust(); break;
        case 'gustWarn': if (this.ok('gustWarn', 0.5)) this.hiss(o, 'bandpass', 900, 1600, 0.6, 0.05, 0, 4); break;
        case 'stir': this.tone(o, 'sine', 420, 380, 0.25, 0.06); break;
        case 'hoot': this.tone(o, 'sine', 392, 370, 0.35, 0.18, 0, 0.05); this.tone(o, 'sine', 330, 310, 0.5, 0.18, now + 0.42, 0.05); break;
        case 'flap': for (let i = 0; i < 5; i++) this.hiss(o, 'lowpass', 900, 200, 0.14, 0.3, now + i * 0.12); break;
        case 'blown': this.tone(o, 'triangle', 700, 300, 0.3, 0.1); break;
        case 'bell': {
          // a big bronze bong with its partials
          const k = Math.min(1.4, e.v);
          for (const [f, l, d] of [[110, 0.22, 3.2], [220, 0.12, 2.6], [264, 0.08, 2], [330, 0.06, 1.6], [587, 0.03, 1.2]] as [number, number, number][]) this.tone(o, 'sine', f, f * 0.995, d, l * k, now, 0.002);
          break;
        }
        case 'acorn': [1319, 1568, 2093].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.18, 0.12, now + i * 0.06)); break;
        case 'tub': for (let i = 0; i < 6; i++) this.hiss(o, 'bandpass', 1200, 500, 0.25, 0.12, now + i * 0.16, 1.2); break;
        case 'checkpoint': [523, 659, 784, 1047].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.3, 0.14, now + 0.1 + i * 0.09)); break;
        case 'section': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.35, 0.12, now + i * 0.1)); break;
        case 'swap': this.tone(o, 'sine', e.who === 'dora' ? 880 : 660, e.who === 'dora' ? 1100 : 820, 0.07, 0.1); break;
        case 'let': break;
        case 'won': [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.6, 0.15, now + i * 0.12)); break;
        default: break;
      }
    }
  }
  private creak(at: number) { if (!this.ok('creak', 0.1)) return; this.tone(this.sfx!, 'sawtooth', 70, 95, 0.18, 0.05, at, 0.03); this.hiss(this.sfx!, 'bandpass', 500, 900, 0.16, 0.06, at, 6); }
  private gust() {
    const c = this.ctx!, w = this.wind!; if (!this.soundOn) return;
    w.gain.cancelScheduledValues(c.currentTime); w.gain.setTargetAtTime(0.35, c.currentTime, 0.15); w.gain.setTargetAtTime(0, c.currentTime + 1.4, 0.4);
  }

  // ---------------------------------------------------------------- music
  /** Picks the loop for a section (null stops it); `ending` plays the slow dawn version. */
  music(sec: SectionId | null, ending = false) { if (sec === this.song && ending === this.ending) return; this.song = sec; this.ending = ending; this.step = 0; this.nextAt = 0; }
  /** Keeps the loop going; call every frame. `on` is false while paused or off the climb. */
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / (this.ending ? 70 : song.bpm) / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.18) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => song.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    if (d >= 0) this.tone(m, song.lead, hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 1.8, 0.1, at, 0.01);
    // a plucked bass on the beat, a fifth on the off-beat
    if (step % 2 === 0) { const r = song.root - 12 + deg(chord) + (step % 4 === 2 ? 7 : 0); this.tone(m, 'triangle', hz(r), hz(r), beat * 1.4, 0.16, at, 0.005); }
    // a soft pad each bar
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 7, 0.03, at, 0.2); }
    // a gentle shaker of hay
    if (step % 2 === 1) this.hiss(m, 'highpass', 6000, 8000, 0.035, 0.035, at);
    if (step % 8 === 4) this.tone(m, 'sine', 140, 60, 0.12, 0.12, at, 0.002);
  }
}

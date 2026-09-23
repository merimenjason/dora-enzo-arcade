// Fluffstevania's music, synthesised live with Web Audio: a gothic loop for each area and a boss theme. Each loop
// is two bars of sixteenths: an organ-ish lead, a bass line on the eighths and a soft chord pad. Notes are scale
// degrees of a harmonic minor scale over the theme's root; 7 and up climb into the next octave.
import type { AreaId } from './fluffstevania-world';

export type Theme = AreaId | 'boss';
type Song = { bpm: number; root: number; lead: (number | null)[]; bass: number[]; pad: number[][]; wave: OscillatorType; leadGain: number };
const _ = null;
const SONGS: Record<Theme, Song> = {
  // Moonlit and wistful.
  approach: {
    bpm: 88, root: 220, wave: 'triangle', leadGain: 0.5,
    lead: [4, _, _, 2, 3, _, 2, _, 0, _, _, _, 1, 2, 3, _, 4, _, _, 7, 6, _, 4, _, 5, _, 4, 3, 2, _, _, _],
    bass: [0, 0, 5, 5, 3, 3, 4, 4], pad: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
  },
  // A stately organ in the great hall.
  hall: {
    bpm: 100, root: 146.8, wave: 'square', leadGain: 0.32,
    lead: [0, 2, 4, 7, 6, 4, 2, 4, 5, 4, 2, 1, 2, _, _, _, 0, 2, 4, 7, 8, 7, 6, 4, 5, 6, 4, 2, 0, _, _, _],
    bass: [0, 0, 3, 3, 5, 5, 4, 4], pad: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8]],
  },
  // A lopsided little cellar dance.
  cellar: {
    bpm: 112, root: 196, wave: 'triangle', leadGain: 0.5,
    lead: [0, _, 2, 0, 4, _, 2, _, 3, _, 1, _, 2, _, _, _, 0, _, 2, 0, 4, _, 7, _, 6, 4, 3, 1, 0, _, _, _],
    bass: [0, 4, 0, 4, 3, 6, 4, 6], pad: [[0, 2, 4], [0, 2, 4], [3, 5, 7], [4, 6, 8]],
  },
  // Driving clockwork up in the belfry.
  belfry: {
    bpm: 132, root: 164.8, wave: 'square', leadGain: 0.3,
    lead: [7, 4, 2, 4, 7, 4, 2, 4, 8, 5, 3, 5, 8, 5, 3, 5, 6, 4, 1, 4, 6, 4, 1, 4, 7, 6, 4, 2, 0, _, 0, _],
    bass: [0, 0, 5, 5, 3, 3, 4, 4], pad: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
  },
  // Slow and eerie among the jars and bones.
  catacombs: {
    bpm: 76, root: 174.6, wave: 'sine', leadGain: 0.6,
    lead: [0, _, _, _, 1, _, _, _, 0, _, 6, _, 4, _, _, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 0, _, _, _],
    bass: [0, 0, 1, 1, 5, 5, 4, 4], pad: [[0, 2, 4], [1, 3, 5], [5, 7, 9], [4, 6, 8]],
  },
  // Fast and furious.
  boss: {
    bpm: 156, root: 164.8, wave: 'sawtooth', leadGain: 0.22,
    lead: [0, 0, 7, 0, 6, 0, 4, 0, 5, 0, 4, 0, 2, 1, 2, 4, 0, 0, 7, 0, 8, 0, 7, 0, 6, 4, 5, 6, 7, _, 6, _],
    bass: [0, 0, 0, 0, 5, 5, 4, 4], pad: [[0, 2, 4], [0, 2, 4], [5, 7, 9], [4, 6, 8]],
  },
};
const SCALE = [0, 2, 3, 5, 7, 8, 11];
const freq = (root: number, degree: number, octave = 0) => {
  const o = Math.floor(degree / 7), d = ((degree % 7) + 7) % 7;
  return root * 2 ** ((SCALE[d] + (o + octave) * 12) / 12);
};

export class Music {
  private out: GainNode;
  private song: Song | null = null;
  private theme: Theme | null = null;
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private ctx: AudioContext, volume = 0.05) {
    this.out = ctx.createGain();
    this.out.gain.value = volume;
    this.out.connect(ctx.destination);
  }
  /** Switch to a theme (a no-op if it's already playing), or pass null for silence. */
  play(theme: Theme | null) {
    if (theme === this.theme) return;
    this.theme = theme;
    this.song = theme ? SONGS[theme] : null;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    if (this.song && !this.timer) this.timer = setInterval(() => this.tick(), 30);
    if (!this.song && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  stop() { this.play(null); this.out.disconnect(); }
  /** Schedule notes a little ahead of time so the loop never stutters. */
  private tick() {
    const song = this.song;
    if (!song || this.ctx.state !== 'running') return;
    const sixteenth = 60 / song.bpm / 4;
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.02;
    while (this.next < this.ctx.currentTime + 0.15) {
      const i = this.step % 32, lead = song.lead[i];
      if (lead !== null) this.note(song.wave, freq(song.root, lead, 1), this.next, sixteenth * 1.8, song.leadGain, true);
      if (i % 2 === 0) this.note('triangle', freq(song.root, song.bass[(i / 2) % 8] ?? 0, -1), this.next, sixteenth * 1.9, 0.9, false);
      if (i % 8 === 0) for (const d of song.pad[(i / 8) % 4]) this.note('sine', freq(song.root, d), this.next, sixteenth * 8, 0.18, false);
      this.next += sixteenth;
      this.step++;
    }
  }
  private note(wave: OscillatorType, hz: number, at: number, len: number, gain: number, vibrato: boolean) {
    const o = this.ctx.createOscillator(), v = this.ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(hz, at);
    if (vibrato) {
      const lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
      lfo.frequency.value = 5.5; depth.gain.value = hz * 0.006;
      lfo.connect(depth); depth.connect(o.frequency); lfo.start(at); lfo.stop(at + len + 0.05);
    }
    v.gain.setValueAtTime(0.0001, at);
    v.gain.linearRampToValueAtTime(gain, at + 0.012);
    v.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(v); v.connect(this.out);
    o.start(at); o.stop(at + len + 0.05);
  }
}

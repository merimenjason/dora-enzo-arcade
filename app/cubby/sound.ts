// Cubby Valley's sounds, all made on the fly with WebAudio: digs that sound like what they dig (a soft scuff of soil, a
// stony tok, a woody knock, a crunch of sand, a rustle of leaves), chips on a long dig, a wooden thunk when a block goes
// down, pops for pick-ups, a shimmering loom, a chime for a new recipe, a little fanfare when a neighbour moves in,
// footsteps, splashes, a swish and a hollow bonk for the bonk-stick, a poof, a boar's snort and thud, a moth's flutter,
// a gnasher's growl, a grumblefluff's nibble, an "oof"; and a music box for day, a hush for night, a hum for the cave
// and a fair tune. Silent until the first click, tap or key; closed when the page goes.
import { BLOCKS } from '@/lib/cubby-world';

const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[]; level: number };
export type SongId = 'menu' | 'day' | 'night' | 'cave' | 'fair';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 80, level: 1, chords: [0, 3, 1, 4], melody: [2, _, 4, _, 7, _, 4, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, 9, _, 7, _, 4, _, _, _, _, _] },
  day: { root: 65, bpm: 74, level: 1, chords: [0, 3, 0, 4], melody: [4, _, _, 5, 7, _, 5, _, 4, _, 2, _, 4, _, _, _, _, _, 2, _, 4, _, 5, _, 4, _, 2, _, 0, _, _, _] },
  night: { root: 57, bpm: 58, level: 0.7, chords: [0, 4, 3, 1], melody: [7, _, _, _, 5, _, _, _, 4, _, _, _, 2, _, _, _, 4, _, _, _, _, _, 2, _, 0, _, _, _, _, _, _, _] },
  cave: { root: 50, bpm: 50, level: 0.6, chords: [0, 1, 0, 4], melody: [_, _, _, _, 9, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _, 4, _, _, _, _, _, _, _, _, _, _, _] },
  fair: { root: 67, bpm: 104, level: 1.1, chords: [0, 3, 4, 0], melody: [4, _, 7, _, 9, 7, 4, _, 5, _, 4, 2, 4, _, _, _, 4, _, 7, _, 9, _, 12, _, 9, 7, 5, 4, 2, _, 0, _] },
};

export class CubbySound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx, master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate * 1.5), c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  get started() { return !!this.ctx; }
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
  private bell(f: number, level: number, at = 0, dur = 0.6) { const o = this.sfx!; this.tone(o, 'sine', f, f, dur, level, at, 0.002); this.tone(o, 'sine', f * 2.76, f * 2.76, dur * 0.35, level * 0.3, at, 0.001); }
  private now() { return this.ctx!.currentTime; }
  /** What a block is made of, for its sounds. */
  private stuff(b: number): 'soft' | 'stone' | 'wood' | 'sand' | 'leaf' | 'glass' {
    const k = BLOCKS[b]?.key ?? 'soil';
    if (['stone', 'chalk', 'ironstone', 'brick', 'pebbles', 'path', 'deepstone', 'chalk_tile', 'rose_tile', 'sky_tile', 'sun_tile', 'crystal', 'anvil', 'oven', 'lamp'].includes(k)) return 'stone';
    if (['log', 'planks', 'bookshelf', 'workbench', 'door', 'fence', 'ladder', 'bench', 'cart', 'drum', 'bed', 'stump'].includes(k)) return 'wood';
    if (['sand'].includes(k)) return 'sand';
    if (['leaves', 'tallgrass', 'daisy', 'bluebell', 'berrybush', 'cotton', 'mushroom', 'sapling', 'haybale', 'cushion', 'bunting'].includes(k)) return 'leaf';
    if (k === 'glass' || k === 'lantern' || k === 'chime') return 'glass';
    return 'soft';
  }
  dig(b: number) {
    if (!this.ok('dig', 0.05)) return;
    const n = this.now(), s = this.stuff(b), o = this.sfx!;
    if (s === 'stone') { this.tone(o, 'triangle', 520, 180, 0.12, 0.16, n); this.hiss(o, 'bandpass', 2400, 900, 0.18, 0.12, n, 2); }
    else if (s === 'wood') { this.tone(o, 'triangle', 300, 160, 0.14, 0.18, n); this.hiss(o, 'bandpass', 900, 500, 0.12, 0.08, n, 3); }
    else if (s === 'sand') this.hiss(o, 'highpass', 2000, 4000, 0.18, 0.12, n, 0.7);
    else if (s === 'leaf') this.hiss(o, 'bandpass', 3500, 1800, 0.22, 0.1, n, 0.8);
    else if (s === 'glass') { this.bell(1900, 0.07, n, 0.3); this.bell(2600, 0.05, n + 0.03, 0.25); this.hiss(o, 'highpass', 5000, 7000, 0.2, 0.05, n, 1); }
    else { this.hiss(o, 'lowpass', 900, 250, 0.16, 0.18, n, 0.8); this.tone(o, 'sine', 150, 80, 0.1, 0.1, n); }
    this.tone(o, 'sine', 900, 1400, 0.06, 0.03, n + 0.08, 0.002);
  }
  chip(b: number) { if (!this.ok('chip', 0.07)) return; const n = this.now(), s = this.stuff(b); if (s === 'stone') { this.tone(this.sfx!, 'square', 900, 500, 0.04, 0.035, n, 0.001); this.hiss(this.sfx!, 'bandpass', 3000, 2000, 0.05, 0.06, n, 4); } else this.hiss(this.sfx!, 'bandpass', 1400, 700, 0.06, 0.07, n, 2); }
  place(b: number) { if (!this.ok('place', 0.05)) return; const n = this.now(), s = this.stuff(b); this.tone(this.sfx!, 'triangle', s === 'stone' ? 260 : s === 'wood' ? 200 : 160, 110, 0.12, 0.17, n); this.hiss(this.sfx!, 'lowpass', 1400, 300, 0.08, 0.08, n, 1); }
  footstep(b: number) { if (!this.ok('step', 0.12)) return; const n = this.now(), s = this.stuff(b); this.hiss(this.sfx!, s === 'stone' ? 'bandpass' : 'lowpass', s === 'stone' ? 1800 : s === 'wood' ? 900 : 700, 300, 0.07, s === 'leaf' ? 0.03 : 0.035, n, s === 'stone' ? 3 : 1); }
  jump() { if (this.ok('jump', 0.15)) this.tone(this.sfx!, 'sine', 380, 620, 0.12, 0.05, 0, 0.005); }
  land() { if (this.ok('land', 0.15)) this.hiss(this.sfx!, 'lowpass', 600, 150, 0.12, 0.1, 0, 1); }
  pickup() { if (this.ok('pickup', 0.05)) { const n = this.now(); this.tone(this.sfx!, 'sine', 700, 1300, 0.08, 0.07, n, 0.002); this.bell(1760, 0.03, n + 0.05, 0.15); } }
  weave() { if (this.ok('weave', 0.2)) { const n = this.now(); [72, 76, 79, 84].forEach((m, i) => this.bell(hz(m), 0.06, n + i * 0.05, 0.5)); this.hiss(this.sfx!, 'bandpass', 3000, 6000, 0.35, 0.04, n, 1); } }
  learn() { if (this.ok('learn', 0.3)) { const n = this.now(); [79, 84, 88, 91].forEach((m, i) => this.bell(hz(m), 0.07, n + i * 0.08, 0.8)); } }
  quest() { if (this.ok('quest', 0.3)) { const n = this.now(); [72, 79, 84].forEach((m, i) => this.bell(hz(m), 0.08, n + i * 0.1, 0.7)); } }
  fanfare() { if (this.ok('fanfare', 1)) { const n = this.now(); [67, 72, 76, 79, 84].forEach((m, i) => this.bell(hz(m), 0.09, n + i * 0.11, 0.9)); for (const m of [60, 64, 67]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 1.4, 0.04, n + 0.55, 0.05); } }
  ui() { if (this.ok('ui', 0.04)) this.bell(1320, 0.05, 0, 0.15); }
  nope() { if (this.ok('nope', 0.2)) { const n = this.now(); this.tone(this.sfx!, 'triangle', 300, 220, 0.12, 0.07, n); this.tone(this.sfx!, 'triangle', 230, 170, 0.14, 0.06, n + 0.12); } }
  splash() { if (this.ok('splash', 0.2)) { this.hiss(this.sfx!, 'bandpass', 1200, 400, 0.4, 0.12, 0, 0.8); this.tone(this.sfx!, 'sine', 500, 200, 0.2, 0.05); } }
  swing() { if (this.ok('swing', 0.1)) this.hiss(this.sfx!, 'bandpass', 600, 2200, 0.16, 0.08, 0, 2); }
  bonk() { if (this.ok('bonk', 0.06)) { const n = this.now(); this.tone(this.sfx!, 'sine', 420, 180, 0.18, 0.22, n, 0.002); this.tone(this.sfx!, 'triangle', 840, 500, 0.08, 0.08, n, 0.002); } }
  poof() { if (this.ok('poof', 0.08)) { const n = this.now(); this.hiss(this.sfx!, 'lowpass', 2500, 300, 0.4, 0.16, n, 0.7); [84, 88, 91].forEach((m, i) => this.bell(hz(m), 0.04, n + 0.1 + i * 0.05, 0.3)); } }
  catchBunny() { if (this.ok('catch', 0.1)) { const n = this.now(); this.tone(this.sfx!, 'sine', 900, 1600, 0.1, 0.06, n, 0.002); this.hiss(this.sfx!, 'lowpass', 2000, 400, 0.25, 0.08, n, 0.7); } }
  hurt() { if (this.ok('hurt', 0.25)) { const n = this.now(); this.tone(this.sfx!, 'triangle', 330, 160, 0.22, 0.18, n); this.hiss(this.sfx!, 'lowpass', 900, 200, 0.2, 0.12, n, 1); } }
  ko() { if (this.ok('ko', 1)) { const n = this.now(); [72, 67, 64, 60].forEach((m, i) => this.bell(hz(m), 0.08, n + i * 0.16, 0.6)); } }
  snort() { if (this.ok('snort', 0.3)) { const n = this.now(); this.hiss(this.sfx!, 'bandpass', 500, 300, 0.18, 0.18, n, 3); this.hiss(this.sfx!, 'bandpass', 600, 280, 0.22, 0.2, n + 0.25, 3); this.tone(this.sfx!, 'sawtooth', 110, 90, 0.3, 0.04, n); } }
  thud() { if (this.ok('thud', 0.2)) { const n = this.now(); this.tone(this.sfx!, 'sine', 120, 50, 0.35, 0.3, n); this.hiss(this.sfx!, 'lowpass', 600, 100, 0.3, 0.15, n, 1); [88, 91, 88].forEach((m, i) => this.bell(hz(m), 0.03, n + 0.2 + i * 0.1, 0.2)); } }
  flutter() { if (this.ok('flutter', 0.6)) { const n = this.now(); for (let i = 0; i < 6; i++) this.hiss(this.sfx!, 'bandpass', 700, 500, 0.05, 0.04, n + i * 0.045, 2); } }
  snuff() { if (this.ok('snuff', 0.3)) { this.hiss(this.sfx!, 'highpass', 3000, 1200, 0.5, 0.09, 0, 0.7); } }
  growl() { if (this.ok('growl', 0.4)) { const n = this.now(); this.tone(this.sfx!, 'sawtooth', 90, 70, 0.4, 0.06, n, 0.03); this.hiss(this.sfx!, 'bandpass', 300, 200, 0.4, 0.1, n, 4); } }
  nibble() { if (this.ok('nibble', 0.3)) { const n = this.now(); for (let i = 0; i < 4; i++) this.tone(this.sfx!, 'square', 1200, 900, 0.03, 0.03, n + i * 0.06, 0.001); this.tone(this.sfx!, 'sine', 600, 900, 0.2, 0.05, n + 0.25); } }
  fling() { if (this.ok('fling', 0.1)) { const n = this.now(); this.tone(this.sfx!, 'sine', 300, 900, 0.1, 0.06, n, 0.002); this.hiss(this.sfx!, 'bandpass', 2000, 3000, 0.08, 0.05, n, 3); } }
  relight() { if (this.ok('relight', 0.2)) { const n = this.now(); this.hiss(this.sfx!, 'bandpass', 1500, 3000, 0.2, 0.06, n, 2); this.bell(hz(84), 0.05, n + 0.1, 0.4); } }
  grow() { if (this.ok('grow', 0.3)) { const n = this.now(); [72, 74, 76, 79].forEach((m, i) => this.bell(hz(m), 0.05, n + i * 0.06, 0.4)); } }

  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tickMusic() {
    const c = this.ctx;
    if (!c || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5), lv = song.level;
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'triangle', f, f, beat * 2.6, 0.06 * lv, at, 0.004); this.tone(m, 'sine', f * 2, f * 2, beat * 0.6, 0.015 * lv, at, 0.002); }
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'sine', hz(r), hz(r), beat * 3.5, 0.07 * lv, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.016 * lv, at, 0.5); }
    if (this.song === 'fair' && step % 2 === 1) this.hiss(m, 'highpass', 6000, 8000, 0.04, 0.03, at, 1);
  }
}

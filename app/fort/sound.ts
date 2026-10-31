// Pillow Fort's sounds, all made on the fly with WebAudio: a soft woolly whump for cushions (deeper the harder they
// land), a wooden knock for books and the stool, a china clink for teacups, a squeak for the duck, a hollow tap for
// boxes, a whoosh as a blanket settles, a tumble of bonks when pieces roll off the rug, a meow and a scrabble for the
// cat, a long low thunder rumble, a sleepy yawn, a heartbeat while the top wobbles, and a music-box lullaby for each
// room under the rain on the window. Silent until the first click, tap or key; closed when the page goes.
import type { Kind, RoomId } from '@/lib/fort-game';

const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[] };
export type SongId = 'menu' | RoomId | 'sandbox' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 72, chords: [0, 3, 1, 4], melody: [4, _, 2, _, 3, _, _, _, 2, _, 0, _, 1, _, _, _, 2, _, 4, _, 5, _, 4, _, 2, _, _, _, _, _, _, _] },
  living: { root: 60, bpm: 70, chords: [0, 3, 0, 4], melody: [2, _, _, 4, _, _, 3, _, 2, _, _, _, 0, _, _, _, 1, _, 2, _, 4, _, _, _, 3, _, 2, _, _, _, _, _] },
  attic: { root: 57, bpm: 66, chords: [0, 2, 3, 4], melody: [0, _, 2, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, _, 2, _, _, 0, _, 1, _, _, _, _, _, _, _] },
  library: { root: 64, bpm: 62, chords: [0, 3, 1, 3], melody: [5, _, _, _, 4, _, 2, _, 4, _, _, _, _, _, _, _, 3, _, 2, _, 0, _, _, _, 2, _, _, _, _, _, _, _] },
  treehouse: { root: 59, bpm: 68, chords: [0, 4, 3, 1], melody: [4, _, _, 5, _, _, 7, _, _, _, 5, _, 4, _, _, _, 2, _, _, _, 4, _, _, _, 0, _, _, _, _, _, _, _] },
  sandbox: { root: 62, bpm: 76, chords: [0, 3, 4, 0], melody: [4, _, 4, _, 5, _, 7, _, 5, _, 4, _, 2, _, _, _, 4, _, 2, _, 0, _, 2, _, 4, _, _, _, _, _, _, _] },
  ending: { root: 64, bpm: 58, chords: [0, 3, 1, 4], melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class FortSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private rainG: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private rainOn = false;
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
      // rain on the window: looping filtered noise, quiet, under everything
      const src = c.createBufferSource(), bq = c.createBiquadFilter(), hp = c.createBiquadFilter();
      src.buffer = n; src.loop = true; bq.type = 'lowpass'; bq.frequency.value = 2600; hp.type = 'highpass'; hp.frequency.value = 500;
      this.rainG = c.createGain(); this.rainG.gain.value = 0;
      src.connect(bq); bq.connect(hp); hp.connect(this.rainG); this.rainG.connect(this.sfx); src.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    this.applyRain();
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
  rain(on: boolean) { this.rainOn = on; this.applyRain(); }
  private applyRain() { if (this.rainG && this.ctx) this.rainG.gain.setTargetAtTime(this.rainOn ? 0.035 : 0, this.ctx.currentTime, 0.6); }
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
  ui() { if (this.ok('ui', 0.04)) { this.tone(this.sfx!, 'triangle', 620, 820, 0.07, 0.1); this.hiss(this.sfx!, 'bandpass', 1800, 2400, 0.05, 0.03, 0, 2); } }
  aim() { if (this.ok('aim', 0.08)) this.hiss(this.sfx!, 'bandpass', 900, 700, 0.04, 0.015, 0, 3); }
  turn() { if (this.ok('turn', 0.06)) { this.hiss(this.sfx!, 'bandpass', 1400, 2200, 0.09, 0.05, 0, 2); this.tone(this.sfx!, 'sine', 500, 640, 0.06, 0.04); } }
  release() { if (this.ok('release', 0.05)) this.hiss(this.sfx!, 'bandpass', 2600, 900, 0.18, 0.04, 0, 1.2); }
  /** A piece lands: the sound of what it is, louder and deeper the harder it hits. */
  thump(kind: Kind, v: number) {
    if (!this.ok('thump-' + kind, 0.06)) return;
    const o = this.sfx!, k = Math.min(1, v / 9), now = this.ctx!.currentTime;
    if (kind === 'cushion' || kind === 'pillow' || kind === 'floor' || kind === 'bolster') {
      this.hiss(o, 'lowpass', 520 + k * 300, 120, 0.22 + k * 0.1, 0.18 + k * 0.25, now, 0.8);
      this.tone(o, 'sine', 110 + k * 30, 55, 0.18, 0.12 + k * 0.18, now);
    } else if (kind === 'book' || kind === 'atlas' || kind === 'stool') {
      this.tone(o, 'triangle', 240 - k * 60, 140, 0.09, 0.14 + k * 0.2, now);
      this.hiss(o, 'bandpass', 1300, 700, 0.06, 0.1 + k * 0.12, now, 2);
    } else if (kind === 'teacup' || kind === 'teapot') {
      for (const [f, d] of [[2637, 0], [3520, 0.03], [2093, 0.07]]) this.tone(o, 'sine', f, f * 0.99, 0.35, 0.05 + k * 0.05, now + d, 0.002);
      this.tone(o, 'triangle', 300, 200, 0.06, 0.06, now);
    } else if (kind === 'duck') {
      this.tone(o, 'square', 1100, 1500, 0.08, 0.05 + k * 0.04, now, 0.01); this.tone(o, 'square', 1500, 900, 0.14, 0.05 + k * 0.04, now + 0.08, 0.01);
    } else if (kind === 'box') {
      this.tone(o, 'triangle', 170, 110, 0.12, 0.15 + k * 0.15, now); this.hiss(o, 'lowpass', 900, 300, 0.08, 0.1, now);
    } else if (kind === 'blanket') this.hiss(o, 'lowpass', 1200, 200, 0.45, 0.12, now, 0.7);
    else this.tone(o, 'sine', 1800, 1800, 0.2, 0.04, now, 0.002);
  }
  lost() { if (this.ok('lost', 0.2)) { const now = this.ctx!.currentTime; for (let i = 0; i < 4; i++) this.tone(this.sfx!, 'sine', 200 - i * 25, 120 - i * 15, 0.12, 0.12, now + i * 0.13); } }
  meow() { if (this.ok('meow', 0.5)) { const o = this.sfx!, now = this.ctx!.currentTime; this.tone(o, 'sawtooth', 520, 820, 0.18, 0.04, now, 0.04); this.tone(o, 'sawtooth', 820, 460, 0.32, 0.04, now + 0.18, 0.02); this.tone(o, 'sine', 1040, 920, 0.4, 0.03, now + 0.1, 0.05); } }
  pounce() { if (this.ok('pounce', 0.3)) { const now = this.ctx!.currentTime; this.hiss(this.sfx!, 'bandpass', 2400, 900, 0.2, 0.12, now, 1.5); this.tone(this.sfx!, 'sawtooth', 700, 1100, 0.12, 0.035, now + 0.05); } }
  thunder() { if (this.ok('thunder', 0.8)) { const now = this.ctx!.currentTime; this.hiss(this.sfx!, 'lowpass', 900, 60, 2.6, 0.55, now, 0.7); this.hiss(this.sfx!, 'lowpass', 300, 40, 2.2, 0.4, now + 0.25, 0.7); this.tone(this.sfx!, 'sine', 55, 35, 1.6, 0.25, now + 0.1, 0.05); } }
  yawn() { if (this.ok('yawn', 1)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'triangle', 420, 250, 0.9, 0.06, now, 0.25); this.hiss(this.sfx!, 'bandpass', 900, 500, 0.9, 0.04, now, 3); } }
  flop() { if (this.ok('flop', 0.5)) { const now = this.ctx!.currentTime; this.hiss(this.sfx!, 'lowpass', 600, 100, 0.5, 0.35, now, 0.7); this.tone(this.sfx!, 'sine', 90, 45, 0.4, 0.25, now); } }
  gasp() { if (this.ok('gasp', 1.2)) { const now = this.ctx!.currentTime; this.hiss(this.sfx!, 'bandpass', 1500, 2400, 0.3, 0.07, now, 4); this.tone(this.sfx!, 'sine', 700, 980, 0.22, 0.04, now, 0.03); } }
  /** A soft heartbeat while the top of the fort wobbles. */
  heart() { if (this.ok('heart', 0.7)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'sine', 70, 50, 0.12, 0.3, now); this.tone(this.sfx!, 'sine', 66, 48, 0.12, 0.22, now + 0.2); } }
  tick() { if (this.ok('tick', 0.5)) this.tone(this.sfx!, 'sine', 1320, 1320, 0.08, 0.05, 0, 0.002); }
  /** The fort stood: a music-box run that climbs with the stars. */
  win(stars: number) {
    if (!this.ok('win', 0.5)) return;
    const now = this.ctx!.currentTime, run = [72, 76, 79, 84, 88, 91].slice(0, 3 + stars);
    run.forEach((m, i) => { this.tone(this.sfx!, 'triangle', hz(m), hz(m), 0.6, 0.08, now + i * 0.11, 0.003); this.tone(this.sfx!, 'sine', hz(m + 12), hz(m + 12), 0.4, 0.025, now + i * 0.11, 0.002); });
  }
  flop2() { if (this.ok('fail', 0.6)) { const now = this.ctx!.currentTime; [400, 340, 280, 200].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f * 0.94, 0.22, 0.08, now + i * 0.16)); } }

  // ---------------------------------------------------------------- music: a music box
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tickMusic(on: boolean) {
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
    // the comb of a music box: a bright tine with a quick fade and a faint octave
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'sine', f, f, beat * 3, 0.09, at, 0.002); this.tone(m, 'triangle', f * 2, f * 2, beat * 0.5, 0.02, at, 0.001); }
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'sine', hz(r), hz(r), beat * 3, 0.08, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.02, at, 0.4); }
  }
}

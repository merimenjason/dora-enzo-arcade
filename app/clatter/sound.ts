// Clatterbox's sounds, all made on the fly with WebAudio: a cardboard scuff when a part is picked up and a tap when it
// lands, wooden clacks for dominoes (each a touch higher than the last), glassy tinks for marbles, cardboard thuds, a
// boing, a fan's whirr, a bellows' pfff, a wind-up car's ratchet, a balloon's pop, a snip, a fizz, the bell, the
// hedgehog's yawn, a sparrow's cheep and the toy train's toot. Under it all a bouncy music-box and ukulele-ish loop, a
// different key and feel for each room. Silent until the first click, tap or key; closed when the page goes.
import type { Ev } from '@/lib/clatter-game';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
type Song = { root: number; bpm: number; melody: number[]; bass: number[]; swing: number };
export type SongId = 'menu' | 'room0' | 'room1' | 'room2' | 'room3' | 'room4' | 'free' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 60, bpm: 104, swing: 0.1, bass: [0, 3, 4, 0], melody: [4, _, 2, _, 4, _, 7, _, 5, _, 4, _, 2, _, _, _, 3, _, 5, _, 4, _, 2, _, 0, _, 1, _, 2, _, _, _] },
  room0: { root: 62, bpm: 100, swing: 0.12, bass: [0, 4, 3, 4], melody: [0, 2, 4, _, 4, _, 5, 4, 2, _, _, _, 1, 2, 3, _, 3, _, 4, 3, 1, _, _, _, 0, 2, 4, 7, 6, 4, 2, _] },
  room1: { root: 65, bpm: 112, swing: 0.15, bass: [0, 5, 3, 4], melody: [7, _, 4, _, 5, _, 2, _, 4, 5, 4, 2, 0, _, _, _, 2, _, 4, _, 5, _, 7, _, 6, _, 4, _, 5, _, _, _] },
  room2: { root: 57, bpm: 96, swing: 0.08, bass: [0, 3, 0, 4], melody: [4, _, _, 5, 4, _, 2, _, 0, _, 2, _, 4, _, _, _, 5, _, _, 6, 5, _, 4, _, 2, _, 4, _, 1, _, _, _] },
  room3: { root: 60, bpm: 88, swing: 0.05, bass: [0, 5, 3, 4], melody: [2, _, 4, _, 5, _, 4, _, 2, _, 0, _, 1, _, _, _, 2, _, 4, _, 7, _, 5, _, 4, _, 2, _, 4, _, _, _] },
  room4: { root: 64, bpm: 118, swing: 0.12, bass: [0, 3, 4, 4], melody: [0, _, 4, _, 7, _, 9, _, 7, _, 4, _, 5, 4, 2, _, 3, _, 5, _, 8, _, 7, _, 6, _, 4, _, 7, _, _, _] },
  free: { root: 62, bpm: 96, swing: 0.1, bass: [0, 4, 5, 3], melody: [4, _, _, _, 2, _, 4, _, 5, _, _, _, 4, _, 2, _, 0, _, _, _, 2, _, 1, _, 2, _, _, _, _, _, _, _] },
  ending: { root: 60, bpm: 108, swing: 0.12, bass: [0, 3, 4, 0], melody: [7, _, 9, _, 7, _, 4, _, 5, _, 7, _, 4, _, 2, _, 0, _, 2, _, 4, _, 5, _, 4, _, 2, _, 0, _, _, _] },
};

export class ClatterSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private clackN = 0; private clackAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate), d = n.getChannelData(0);
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
  private chime(out: GainNode, f: number, dur: number, level: number, at = 0) {
    this.tone(out, 'sine', f, f, dur, level, at, 0.003);
    this.tone(out, 'sine', f * 3.01, f * 3.01, dur * 0.3, level * 0.2, at, 0.002);
  }
  ui() { if (this.ok('ui', 0.04)) { this.tone(this.sfx!, 'triangle', 700, 600, 0.05, 0.06); this.hiss(this.sfx!, 'bandpass', 1400, 900, 0.04, 0.04, 0, 3); } }
  nope() { if (this.ok('nope', 0.15)) { this.tone(this.sfx!, 'square', 180, 140, 0.12, 0.03); this.hiss(this.sfx!, 'lowpass', 600, 200, 0.1, 0.05); } }
  /** A cardboard scuff: a part lifted from the tray or the board. */
  pick() { if (this.ok('pick', 0.06)) this.hiss(this.sfx!, 'bandpass', 900, 1800, 0.1, 0.07, 0, 1.5); }
  /** Set down: a soft card tap. */
  place() { if (this.ok('place', 0.05)) { this.tone(this.sfx!, 'sine', 200, 140, 0.08, 0.1); this.hiss(this.sfx!, 'lowpass', 1200, 300, 0.07, 0.06); } }
  turn() { if (this.ok('turn', 0.03)) { this.tone(this.sfx!, 'triangle', 1100, 900, 0.03, 0.05); this.hiss(this.sfx!, 'bandpass', 3000, 2400, 0.03, 0.04, 0, 4); } }
  back() { if (this.ok('back', 0.08)) this.hiss(this.sfx!, 'bandpass', 2400, 700, 0.18, 0.06, 0, 1.2); }
  go() { if (!this.ok('go', 0.3)) return; const now = this.ctx!.currentTime; [0, 4, 7].forEach((d, i) => this.chime(this.sfx!, hz(72 + d), 0.25, 0.05, now + i * 0.06)); }
  rewind() { if (!this.ok('rewind', 0.3)) return; this.hiss(this.sfx!, 'bandpass', 3000, 600, 0.35, 0.06, 0, 2); this.tone(this.sfx!, 'triangle', 900, 300, 0.3, 0.03); }
  /** The run's events: each becomes its little noise, a clack louder for a harder hit. */
  events(evs: Ev[]) {
    const c = this.ctx; if (!c || !this.soundOn) return;
    for (const e of evs) {
      const v = Math.max(0.25, Math.min(1, e.s));
      switch (e.k) {
        case 'clack': {
          if (!this.ok('clack', 0.035)) break;
          if (c.currentTime - this.clackAt > 0.6) this.clackN = 0; this.clackAt = c.currentTime;
          const up = Math.pow(2, Math.min(12, this.clackN++) / 24);
          this.tone(this.sfx!, 'triangle', 1500 * up, 1100 * up, 0.035, 0.1 * v); this.hiss(this.sfx!, 'bandpass', 2600 * up, 2000, 0.03, 0.08 * v, 0, 5);
          break;
        }
        case 'tink': if (this.ok('tink', 0.05)) { this.tone(this.sfx!, 'sine', 2600, 2500, 0.08, 0.05 * v); this.tone(this.sfx!, 'sine', 3900, 3850, 0.05, 0.02 * v); } break;
        case 'thud': if (this.ok('thud', 0.06)) { this.tone(this.sfx!, 'sine', 140, 80, 0.12, 0.12 * v); this.hiss(this.sfx!, 'lowpass', 700, 200, 0.08, 0.07 * v); } break;
        case 'boing': if (this.ok('boing', 0.1)) { this.tone(this.sfx!, 'sine', 180, 520, 0.22, 0.1); this.tone(this.sfx!, 'triangle', 360, 900, 0.18, 0.03); } break;
        case 'puff': if (this.ok('puff', 0.15)) this.hiss(this.sfx!, 'lowpass', 1600, 300, 0.35, 0.12, 0, 0.8); break;
        case 'vroom': if (this.ok('vroom', 0.4)) { for (let i = 0; i < 8; i++) this.hiss(this.sfx!, 'bandpass', 2400, 2000, 0.02, 0.05, c.currentTime + i * 0.04, 6); this.tone(this.sfx!, 'sawtooth', 110, 160, 0.5, 0.025); } break;
        case 'pop': if (this.ok('pop', 0.1)) { this.hiss(this.sfx!, 'highpass', 800, 400, 0.08, 0.2); this.tone(this.sfx!, 'sine', 300, 60, 0.08, 0.12); } break;
        case 'snip': if (this.ok('snip', 0.1)) { this.hiss(this.sfx!, 'highpass', 5000, 7000, 0.04, 0.1); this.tone(this.sfx!, 'square', 2600, 2200, 0.02, 0.02); } break;
        case 'burn': if (this.ok('burn', 0.3)) this.hiss(this.sfx!, 'highpass', 3000, 6000, 0.5, 0.06, 0, 0.5); break;
        case 'ring': if (this.ok('ring', 0.25)) { const now = c.currentTime; this.chime(this.sfx!, 1320, 1.4, 0.1, now); this.chime(this.sfx!, 1320 * 1.5, 1.0, 0.04, now + 0.01); } break;
        case 'token': if (this.ok('token', 0.2)) { const now = c.currentTime; [0, 7, 12].forEach((d, i) => this.chime(this.sfx!, hz(84 + d), 0.3, 0.06, now + i * 0.05)); } break;
        case 'creak': if (this.ok('creak', 0.3)) this.tone(this.sfx!, 'sawtooth', 160, 120, 0.25, 0.015); break;
        case 'goal': this.goal(e.x); break;
        default: break;
      }
    }
  }
  /** A goal met: a little fanfare of chimes, and the payoff's own noise. */
  private goal(x: number) {
    if (!this.ok('goal', 0.2)) return;
    const now = this.ctx!.currentTime;
    [0, 4, 7, 12].forEach((d, i) => this.chime(this.sfx!, hz(76 + d), 0.4, 0.06, now + 0.05 + i * 0.07));
    void x;
  }
  /** The payoff noises, named by the page from the goal part. */
  yawn() { if (this.ok('yawn', 1)) { this.tone(this.sfx!, 'sine', 420, 220, 0.8, 0.06, 0, 0.1); this.hiss(this.sfx!, 'lowpass', 900, 300, 0.7, 0.03); } }
  cheep() { if (!this.ok('cheep', 0.5)) return; const now = this.ctx!.currentTime; for (let i = 0; i < 3; i++) this.tone(this.sfx!, 'sine', 3200, 4200, 0.07, 0.05, now + i * 0.12); }
  toot() { if (!this.ok('toot', 0.8)) return; const now = this.ctx!.currentTime; for (const [t, d] of [[0, 0.25], [0.32, 0.5]]) { this.tone(this.sfx!, 'square', 466, 466, d, 0.04, now + t, 0.02); this.tone(this.sfx!, 'square', 587, 587, d, 0.03, now + t, 0.02); } }
  click() { if (this.ok('click', 0.3)) { this.tone(this.sfx!, 'square', 1800, 1500, 0.02, 0.05); this.chime(this.sfx!, 988, 0.6, 0.04, this.ctx!.currentTime + 0.05); } }
  stars(n: number) { if (!this.ctx) return; const now = this.ctx.currentTime; for (let i = 0; i < n; i++) this.chime(this.sfx!, hz(79 + [0, 4, 7][i % 3]), 0.5, 0.06, now + 0.5 + i * 0.22); }
  /** Applause from the cardboard audience: soft pattering. */
  applause() {
    if (!this.ok('applause', 2)) return;
    const now = this.ctx!.currentTime;
    for (let i = 0; i < 46; i++) { const t = now + ((i * 0.041 + Math.sin(i * 7.1) * 0.02) % 2.2); this.hiss(this.sfx!, 'bandpass', 1700 + (i % 5) * 320, 1200, 0.05, 0.05, t, 2); }
  }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tickMusic(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt + (this.step % 2 ? song.swing * beat : 0), beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => MAJOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const d = song.melody[step % 32];
    // the lead: a music-box tine
    if (d >= 0) this.chime(m, hz(song.root + 12 + deg(d)), beat * 2.5, 0.06, at);
    // plucked bass on the beat, a strummed chord on the off-beat
    const chord = song.bass[Math.floor(step / 8) % 4];
    if (step % 4 === 0) this.tone(m, 'triangle', hz(song.root - 12 + deg(chord)), hz(song.root - 12 + deg(chord)), beat * 1.6, 0.1, at, 0.004);
    if (step % 4 === 2) for (const [i, k] of [0, 2, 4].entries()) this.tone(m, 'triangle', hz(song.root + deg(chord + k)), hz(song.root + deg(chord + k)), beat * 0.9, 0.025, at + i * 0.012, 0.003);
    // a woodblock tick
    if (step % 2 === 1) this.hiss(m, 'bandpass', 2200, 1800, 0.02, 0.03, at, 6);
  }
}

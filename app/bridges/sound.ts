// Twig & Twine's sounds, all made on the fly with WebAudio: a wooden tock when a member drops in (a softer one for
// twine, a hollow knock for bamboo), a pop for removing, a whoosh for undo, creaks that grow with the strain while the
// cart rolls, a crack and a thud for a snap, a twang for snapped twine, a splash (or a dusty poof in the canyon), a
// bump for the boat and a happy jingle for a crossing. Under them a gentle loop for each region with its own ambience:
// the brook's water and birds, drips in the ravine, frogs in the marsh and wind in the canyon.
// Silent until the first click, tap or key; closed when the page goes.
import type { Ev, Mat, RegionId } from '@/lib/bridges-game';

const PENTA = [0, 2, 4, 7, 9], PENTA_MINOR = [0, 3, 5, 7, 10];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; scale: number[]; chords: number[]; melody: number[]; lead: OscillatorType; amb: 'brook' | 'drip' | 'frog' | 'wind' | null };
export type SongId = 'menu' | RegionId | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 88, scale: PENTA, chords: [0, 3, 1, 4], lead: 'triangle', amb: null, melody: [2, _, 4, _, 3, _, 2, _, 0, _, _, _, 1, _, 2, _, 4, _, 5, _, 4, _, 2, _, 3, _, _, _, _, _, _, _] },
  brook: { root: 60, bpm: 80, scale: PENTA, chords: [0, 3, 0, 4], lead: 'triangle', amb: 'brook', melody: [4, _, _, 2, _, _, 3, _, 2, _, _, _, _, _, _, _, 0, _, 1, _, 2, _, _, _, 4, _, _, _, _, _, _, _] },
  ravine: { root: 57, bpm: 70, scale: PENTA_MINOR, chords: [0, 2, 3, 2], lead: 'sine', amb: 'drip', melody: [0, _, _, _, 2, _, 3, _, 2, _, _, _, _, _, _, _, 4, _, _, 3, _, _, 2, _, 0, _, _, _, _, _, _, _] },
  marsh: { root: 59, bpm: 76, scale: PENTA, chords: [0, 1, 3, 1], lead: 'sine', amb: 'frog', melody: [2, _, 1, _, 0, _, _, _, 1, _, 2, _, 4, _, _, _, 3, _, 2, _, 1, _, _, _, 0, _, _, _, _, _, _, _] },
  canyon: { root: 55, bpm: 74, scale: PENTA_MINOR, chords: [0, 3, 4, 3], lead: 'triangle', amb: 'wind', melody: [4, _, _, 3, 2, _, _, _, 3, _, 4, _, 5, _, _, _, 4, _, _, 2, 3, _, _, _, 0, _, _, _, _, _, _, _] },
  ending: { root: 64, bpm: 66, scale: PENTA, chords: [0, 3, 1, 4], lead: 'triangle', amb: 'wind', melody: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 3, _, 2, _, 1, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class BridgeSound {
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
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.16); }
  pick() { if (this.ok('pick', 0.04)) this.tone(this.sfx!, 'sine', 520, 700, 0.06, 0.07); }
  nope() { if (this.ok('nope', 0.15)) this.tone(this.sfx!, 'sine', 220, 160, 0.14, 0.1); }
  /** A member dropping into place. */
  place(m: Mat) {
    if (!this.ok('place', 0.03)) return;
    const o = this.sfx!;
    if (m === 'twine') { this.tone(o, 'triangle', 330, 300, 0.25, 0.08); this.hiss(o, 'bandpass', 2400, 1200, 0.08, 0.05, 0, 2); }
    else if (m === 'bamboo') { this.tone(o, 'sine', 420, 380, 0.18, 0.16); this.tone(o, 'sine', 840, 760, 0.08, 0.06); }
    else { const f = m === 'plank' ? 180 : 260; this.tone(o, 'triangle', f, f * 0.8, 0.12, 0.18); this.hiss(o, 'bandpass', f * 6, f * 3, 0.05, 0.12, 0, 3); }
  }
  remove() { if (this.ok('remove', 0.04)) { this.tone(this.sfx!, 'sine', 600, 300, 0.1, 0.1); this.hiss(this.sfx!, 'highpass', 3000, 1500, 0.06, 0.05); } }
  undo() { if (this.ok('undo', 0.04)) this.hiss(this.sfx!, 'bandpass', 900, 2400, 0.14, 0.08, 0, 1.5); }
  go() { if (this.ok('go', 0.2)) [523, 659, 784].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f, 0.18, 0.08, this.ctx!.currentTime + i * 0.07)); }
  /** Creaks that grow with the strain on the bridge; call every frame while testing. */
  creak(strain: number) {
    if (strain < 0.45 || !this.ctx) return;
    const gap = 0.9 - Math.min(0.6, (strain - 0.45) * 1.2);
    if (!this.ok('creak', gap)) return;
    const o = this.sfx!, lvl = Math.min(0.14, 0.03 + (strain - 0.45) * 0.22), f = 140 + ((this.ctx.currentTime * 997) % 90);
    this.tone(o, 'sawtooth', f, f * 0.82, 0.22 + strain * 0.2, lvl * 0.5, 0, 0.04);
    this.hiss(o, 'bandpass', f * 4, f * 2.5, 0.25, lvl, 0, 6);
  }
  /** Plays whatever a batch of simulation events calls for. */
  play(events: Ev[], region: RegionId) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'break':
          if (!this.ok('break', 0.05)) break;
          if (e.m === 'twine') { this.tone(o, 'triangle', 520, 140, 0.4, 0.14); this.tone(o, 'sine', 1040, 260, 0.25, 0.06); }
          else { this.hiss(o, 'highpass', 2600, 900, 0.12, 0.3); this.tone(o, 'square', 120, 50, 0.16, 0.1); this.hiss(o, 'lowpass', 500, 120, 0.3, 0.14, now + 0.05); }
          break;
        case 'splash':
          if (region === 'canyon') { this.hiss(o, 'lowpass', 800, 120, 0.7, 0.25, now + 0.1); this.tone(o, 'sine', 90, 50, 0.4, 0.2, now + 0.1); }
          else { this.hiss(o, 'bandpass', 500, 1800, 0.18, 0.3, now, 1); this.hiss(o, 'lowpass', 1500, 300, 0.8, 0.18, now + 0.08); this.tone(o, 'sine', 300, 900, 0.12, 0.06, now + 0.2); this.tone(o, 'sine', 380, 1000, 0.1, 0.05, now + 0.32); }
          // a little "oh no" slide
          [392, 370, 330].forEach((f, i) => this.tone(o, 'triangle', f, f * 0.97, 0.3, 0.06, now + 0.6 + i * 0.16));
          break;
        case 'boat': this.tone(o, 'sine', 160, 90, 0.3, 0.2); this.hiss(o, 'lowpass', 600, 150, 0.3, 0.15); [440, 392].forEach((f, i) => this.tone(o, 'square', f, f, 0.12, 0.04, now + 0.3 + i * 0.14)); break;
        case 'cross': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.4, 0.1, now + i * 0.1)); this.hiss(o, 'highpass', 6000, 9000, 0.8, 0.03, now + 0.4); break;
        case 'stuck': [392, 349].forEach((f, i) => this.tone(o, 'sine', f, f, 0.35, 0.08, now + i * 0.2)); break;
        case 'go': this.go(); break;
        case 'deck': if (this.ok('deck', 0.3)) this.tone(o, 'triangle', 200, 170, 0.1, 0.1); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- music and ambience
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
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
    if (d >= 0) this.tone(m, song.lead, hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 2.4, 0.08, at, 0.02);
    if (step % 4 === 0) { const r = song.root - 12 + deg(chord); this.tone(m, 'triangle', hz(r), hz(r), beat * 3, 0.12, at, 0.01); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.028, at, 0.4); }
    // the region's ambience
    switch (song.amb) {
      case 'brook': if (step % 16 === 11) { const f = 2600 + (step % 3) * 300; this.tone(m, 'sine', f, f * 1.25, 0.08, 0.03, at); this.tone(m, 'sine', f * 1.1, f * 1.4, 0.07, 0.025, at + 0.11); } if (step % 8 === 0) this.hiss(m, 'bandpass', 1400, 1100, beat * 8, 0.035, at, 0.8); break;
      case 'drip': if (step % 12 === 5) { const f = 1200 + (step % 5) * 140; this.tone(m, 'sine', f, f * 1.8, 0.06, 0.05, at); } break;
      case 'frog': if (step % 16 === 6 || step % 16 === 8) { this.tone(m, 'square', 180, 140, 0.07, 0.02, at); this.tone(m, 'square', 200, 150, 0.07, 0.02, at + 0.09); } break;
      case 'wind': if (step % 16 === 0) this.hiss(m, 'bandpass', 500, 900, beat * 14, 0.04, at, 2); break;
      default: break;
    }
  }
}

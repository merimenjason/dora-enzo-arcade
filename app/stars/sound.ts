// Starstitch's sounds, all made on the fly with WebAudio: a soft "plink" for every stitch that walks up a pentatonic
// scale as the thread grows, a falling pluck to unpick, a shimmer when the needle leaps between twins, a hushed
// "nope" when a star won't take the thread, a twinkle for a hint, a warm chord (and a little arpeggio) when a
// constellation is done, and a music-box lullaby under the night. Silent until the first click, tap or key; closed
// when the page goes.
const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const deg = (d: number) => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
const _ = -1;
export type SongId = 'menu' | 'night' | 'ending';
type Song = { root: number; bpm: number; chords: number[]; melody: number[] };
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 66, chords: [0, 3, 5, 4], melody: [7, _, 5, _, 4, _, _, _, 5, _, 7, _, 9, _, _, _, 7, _, 5, _, 4, _, 2, _, 4, _, _, _, _, _, _, _] },
  night: { root: 60, bpm: 58, chords: [0, 5, 3, 4], melody: [4, _, _, _, 7, _, _, _, 5, _, _, 4, _, _, _, _, 2, _, _, _, 4, _, _, _, 0, _, _, _, _, _, _, _] },
  ending: { root: 64, bpm: 70, chords: [0, 3, 5, 4], melody: [9, _, 7, _, 5, _, 7, _, 9, _, _, 10, 9, _, _, _, 7, _, 5, _, 4, _, 5, _, 7, _, _, _, _, _, _, _] },
};

export class StarsSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private verb: ConvolverNode | null = null;
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
      // a little starry reverb: a decaying noise tail made from a fixed hash, so it never changes
      const len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) { const x = Math.sin((i + ch * 7919) * 12.9898) * 43758.5453; d[i] = ((x - Math.floor(x)) * 2 - 1) * Math.pow(1 - i / len, 3); } }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.35; this.verb.connect(wet); wet.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master); this.sfx.connect(this.verb);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(master); this.mus.connect(this.verb);
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
  private tone(out: GainNode, type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = 0.004) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
  }
  /** A bell-like plink: a sine with a quieter, higher partial. */
  private plinkAt(f: number, level: number, at = 0) { this.tone(this.sfx!, 'sine', f, f, 0.9, level, at); this.tone(this.sfx!, 'sine', f * 2.76, f * 2.76, 0.25, level * 0.25, at); this.tone(this.sfx!, 'triangle', f * 2, f * 2, 0.4, level * 0.15, at); }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 880, 1320, 0.07, 0.1); }
  /** The n-th stitch: up the pentatonic scale, wrapping gently so long threads don't climb out of hearing. */
  stitch(n: number) { if (!this.ok('stitch', 0.03)) return; const d = (n - 1) % 12; this.plinkAt(hz(67 + deg(d)), 0.16); }
  start() { if (this.ok('start', 0.05)) this.plinkAt(hz(67 - 5), 0.13); }
  unpick() { if (this.ok('unpick', 0.04)) this.tone(this.sfx!, 'triangle', 660, 330, 0.18, 0.08); }
  jump() { if (!this.ok('jump', 0.1)) return; const now = this.ctx!.currentTime; for (let i = 0; i < 6; i++) this.tone(this.sfx!, 'sine', 1400 + i * 260, 1400 + i * 260, 0.25, 0.04, now + i * 0.03); }
  nope() { if (this.ok('nope', 0.2)) { this.tone(this.sfx!, 'sine', 196, 150, 0.2, 0.12); this.tone(this.sfx!, 'triangle', 233, 180, 0.16, 0.04); } }
  hint() { if (!this.ctx || !this.soundOn) return; const now = this.ctx.currentTime; [1568, 1976, 2349].forEach((f, i) => this.tone(this.sfx!, 'sine', f, f, 0.5, 0.06, now + i * 0.08)); }
  /** A constellation done: a warm chord and a rising arpeggio. */
  done(medal: boolean) {
    if (!this.ctx || !this.soundOn) return;
    const now = this.ctx.currentTime;
    for (const m of [48, 55, 60, 64, 67]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 2.6, 0.07, now, 0.08);
    [72, 76, 79, 84, 88].forEach((m, i) => this.plinkAt(hz(m), 0.1, now + 0.25 + i * 0.11));
    if (medal) [91, 96].forEach((m, i) => this.plinkAt(hz(m), 0.09, now + 0.9 + i * 0.14));
  }
  stuck() { if (this.ctx && this.soundOn) { const now = this.ctx.currentTime; [392, 349].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f * 0.98, 0.35, 0.06, now + i * 0.18)); } }

  // ---------------------------------------------------------------- music: a slow music box
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.25) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], d = song.melody[step % 32];
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'sine', f, f, beat * 3, 0.09, at, 0.003); this.tone(m, 'sine', f * 3, f * 3, beat, 0.012, at); }
    if (step % 8 === 0) { const r = hz(song.root - 12 + deg(chord)); this.tone(m, 'sine', r, r, beat * 7, 0.08, at, 0.2); }
    if (step % 2 === 1) { const k = [0, 2, 4, 2][(step >> 1) % 4], f = hz(song.root + deg(chord + k)); this.tone(m, 'triangle', f, f, beat * 1.5, 0.02, at, 0.003); }
  }
}

// Moonhop's sounds, all made on the fly with WebAudio: a soft rising hum while the ring charges, a whoosh on every
// leap, a squish on landing (a boing on jelly, a crunch on ice), a puff of cloud, a chime for each firefly that climbs
// the scale as the lantern fills, a warm chord when the lantern opens, a lullaby fanfare at home, a gentle "boing" when
// the lantern string reels them back, and a pop through a rabbit hole. The music is a slow music box that gains a
// layer with every firefly gathered. Silent until the first click, tap or key; closed when the page goes.
const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const deg = (d: number) => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
const _ = -1;
export type SongId = 'menu' | 'sky' | 'ending';
type Song = { root: number; bpm: number; chords: number[]; melody: number[]; bells: number[] };
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 70, chords: [0, 3, 5, 4], melody: [4, _, 5, _, 7, _, _, _, 5, _, 4, _, 2, _, _, _, 4, _, 7, _, 9, _, 7, _, 5, _, _, _, _, _, _, _], bells: [9, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _] },
  sky: { root: 60, bpm: 64, chords: [0, 5, 3, 4], melody: [2, _, 4, _, 7, _, _, 5, 4, _, _, _, 2, _, _, _, 0, _, 2, _, 4, _, _, 7, 5, _, _, _, _, _, _, _], bells: [7, _, _, 9, _, _, _, _, 10, _, _, 9, _, _, _, _] },
  ending: { root: 64, bpm: 72, chords: [0, 3, 5, 4], melody: [9, _, 7, _, 5, _, 7, _, 9, _, _, 10, 9, _, _, _, 7, _, 5, _, 4, _, 5, _, 7, _, _, _, _, _, _, _], bells: [12, _, _, _, 11, _, _, _, 9, _, _, _, 7, _, _, _] },
};

export class OrbitSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private verb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0; layers = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      // a soft night-sky reverb and a noise buffer, both from a fixed hash so they never change
      const len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) { const x = Math.sin((i + ch * 7919) * 12.9898) * 43758.5453; d[i] = ((x - Math.floor(x)) * 2 - 1) * Math.pow(1 - i / len, 3); } }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      const nl = Math.floor(c.sampleRate * 0.6); this.noise = c.createBuffer(1, nl, c.sampleRate);
      { const d = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) { const x = Math.sin(i * 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; } }
      const wet = c.createGain(); wet.gain.value = 0.3; this.verb.connect(wet); wet.connect(master);
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
  /** Filtered noise, swept from one frequency to another. */
  private hiss(f0: number, f1: number, dur: number, level: number, q = 1.2) {
    const c = this.ctx!, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    src.buffer = this.noise; bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.sfx!); src.start(t); src.stop(t + dur + 0.05);
  }
  private bell(f: number, level: number, at = 0) { this.tone(this.sfx!, 'sine', f, f, 1.1, level, at); this.tone(this.sfx!, 'sine', f * 2.76, f * 2.76, 0.3, level * 0.22, at); this.tone(this.sfx!, 'triangle', f * 2, f * 2, 0.45, level * 0.12, at); }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 880, 1320, 0.07, 0.1); }
  /** A soft tick that rises with the charge. */
  charge(k: number) { if (this.ok('charge', 0.09)) this.tone(this.sfx!, 'sine', 300 + k * 500, 320 + k * 520, 0.09, 0.035 + k * 0.03); }
  full() { if (this.ok('full', 0.5)) { this.bell(hz(84), 0.05); } }
  leap(power: number) { if (!this.ok('leap', 0.08)) return; this.hiss(500, 2400 + power * 1800, 0.35 + power * 0.15, 0.16 + power * 0.08, 0.9); this.tone(this.sfx!, 'sine', 220, 420 + power * 200, 0.16, 0.06); }
  land(kind: string, speed: number) {
    if (!this.ok('land', 0.06)) return;
    const k = Math.min(1, speed / 400);
    if (kind === 'jelly') { this.tone(this.sfx!, 'sine', 180, 520, 0.25, 0.14); return; }
    if (kind === 'ice') { this.hiss(4000, 2500, 0.18, 0.08 + k * 0.05, 3); this.tone(this.sfx!, 'triangle', 1400, 1100, 0.12, 0.04); return; }
    if (kind === 'moss') { this.hiss(600, 300, 0.14, 0.1 + k * 0.05, 1); return; }
    this.tone(this.sfx!, 'sine', 160, 70, 0.18, 0.14 + k * 0.08); this.hiss(900, 400, 0.12, 0.06 + k * 0.05, 1.5);
  }
  bounce(bean: boolean) { if (this.ok('bounce', 0.08)) { if (bean) this.tone(this.sfx!, 'square', 140, 90, 0.18, 0.05); this.tone(this.sfx!, 'sine', bean ? 260 : 200, bean ? 140 : 640, 0.3, 0.13); } }
  puff() { if (this.ok('puff', 0.1)) this.hiss(1200, 500, 0.4, 0.15, 0.7); }
  /** The n-th firefly of `tot`: up the scale as the lantern fills. */
  firefly(n: number, gold: boolean) {
    if (!this.ctx || !this.soundOn) return;
    const now = this.ctx.currentTime;
    if (gold) { [76, 79, 83, 88].forEach((m, i) => this.bell(hz(m), 0.09, now + i * 0.07)); return; }
    this.bell(hz(72 + deg(n + 1)), 0.12, now); this.bell(hz(84 + deg(n + 1)), 0.04, now + 0.06);
  }
  open() { if (!this.ctx || !this.soundOn) return; const now = this.ctx.currentTime; for (const m of [60, 64, 67, 72]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 1.8, 0.06, now, 0.05); [79, 84].forEach((m, i) => this.bell(hz(m), 0.08, now + 0.2 + i * 0.12)); }
  locked() { if (this.ok('locked', 0.5)) { const now = this.ctx!.currentTime; [392, 349].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f * 0.98, 0.3, 0.05, now + i * 0.15)); } }
  lost() { if (this.ok('lost', 0.4)) { this.tone(this.sfx!, 'sine', 520, 180, 0.5, 0.11); this.hiss(2000, 400, 0.6, 0.05, 1); } }
  back() { if (this.ok('back', 0.2)) this.tone(this.sfx!, 'sine', 300, 600, 0.2, 0.07); }
  hole() { if (this.ok('hole', 0.2)) { this.tone(this.sfx!, 'sine', 700, 180, 0.15, 0.1); const t = this.ctx!.currentTime; this.tone(this.sfx!, 'sine', 300, 900, 0.18, 0.1, t + 0.16); } }
  /** Home: a warm chord and a rising run of bells. */
  home(stars: number) {
    if (!this.ctx || !this.soundOn) return;
    const now = this.ctx.currentTime;
    for (const m of [48, 55, 60, 64, 67]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 2.6, 0.07, now, 0.08);
    [72, 76, 79, 84, 88].forEach((m, i) => this.bell(hz(m), 0.1, now + 0.25 + i * 0.11));
    for (let i = 0; i < stars; i++) this.bell(hz(91 + i * 4), 0.08, now + 1.0 + i * 0.22);
  }

  // ---------------------------------------------------------------- music: a slow music box, one layer per firefly
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.25) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], L = this.song === 'sky' ? this.layers : 4;
    // the bass pad is always there
    if (step % 8 === 0) { const r = hz(song.root - 12 + deg(chord)); this.tone(m, 'sine', r, r, beat * 7, 0.08, at, 0.2); }
    if (L >= 1 && step % 2 === 1) { const k = [0, 2, 4, 2][(step >> 1) % 4], f = hz(song.root + deg(chord + k)); this.tone(m, 'triangle', f, f, beat * 1.5, 0.022, at, 0.003); }
    const d = song.melody[step % 32];
    if (L >= 2 && d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'sine', f, f, beat * 3, 0.085, at, 0.003); this.tone(m, 'sine', f * 3, f * 3, beat, 0.01, at); }
    const b = song.bells[step % 16];
    if (L >= 3 && b >= 0 && step % 32 < 16) { const f = hz(song.root + 24 + deg(b)); this.tone(m, 'sine', f, f, beat * 4, 0.035, at, 0.003); this.tone(m, 'sine', f * 2.76, f * 2.76, beat, 0.006, at); }
  }
}

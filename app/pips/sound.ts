// Lucky Pips' sounds, all made on the fly with WebAudio: wooden dice clattering onto felt (a burst of little knocks
// that slows as they settle), a soft thunk as a die drops into a tool, a whoosh and a thwack for every hit (deeper for
// big ones), a wooden clack for block, a rising chime for healing, a bubble for poison, a crackle for burn, a bell for
// a stun, a coin-jingle for acorns, a fair-organ fanfare for a win. The music is a little fair-organ waltz per area.
// Silent until the first click, tap or key; closed when the page goes.
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const deg = (d: number) => MAJ[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const _ = -99;
export type SongId = 'menu' | 'meadow' | 'midway' | 'bigtop' | 'boss' | 'ending';
type Song = { root: number; bpm: number; chords: number[]; melody: number[] };
// waltzes: three beats a bar, melody in scale steps from the chord's root
const SONGS: Record<SongId, Song> = {
  menu: { root: 60, bpm: 132, chords: [0, 3, 4, 0, 5, 3, 4, 4], melody: [4, _, 2, 4, 5, 4, 2, _, 0, 1, 2, _, 3, _, 5, 4, _, 3, 2, _, 1, 0, _, _] },
  meadow: { root: 62, bpm: 140, chords: [0, 4, 0, 4, 3, 0, 4, 0], melody: [0, 2, 4, 7, _, 4, 5, 4, 2, 4, _, _, 3, 5, 7, 6, _, 4, 2, 1, 0, 1, _, _] },
  midway: { root: 57, bpm: 120, chords: [0, 5, 3, 4, 0, 5, 1, 4], melody: [4, _, 5, 4, 2, _, 0, _, 2, 1, _, _, 4, _, 5, 7, 5, 4, 2, _, 1, 2, _, _] },
  bigtop: { root: 55, bpm: 150, chords: [0, 0, 4, 4, 3, 3, 4, 0], melody: [0, 4, 7, 4, 0, 4, 5, _, 4, 2, _, _, 1, 4, 6, 4, 1, 4, 4, _, 2, 1, _, _] },
  boss: { root: 53, bpm: 156, chords: [0, 5, 0, 4, 0, 5, 3, 4], melody: [0, _, 0, 2, 3, _, 4, _, 3, 2, _, _, 0, _, 0, 2, 3, _, 5, 4, 3, 2, _, _] },
  ending: { root: 60, bpm: 112, chords: [0, 3, 4, 0, 5, 3, 4, 0], melody: [7, _, 4, 5, 7, _, 9, 7, 5, 4, _, _, 5, _, 4, 2, 4, 5, 4, _, 2, 0, _, _] },
};

export class PipsSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private verb: ConvolverNode | null = null;
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
      // a small tent-like room and a noise buffer, both from a fixed hash so they never change
      const len = Math.floor(c.sampleRate * 1.2), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) { const x = Math.sin((i + ch * 7919) * 12.9898) * 43758.5453; d[i] = ((x - Math.floor(x)) * 2 - 1) * Math.pow(1 - i / len, 4); } }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      const nl = Math.floor(c.sampleRate * 0.6); this.noise = c.createBuffer(1, nl, c.sampleRate);
      { const d = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) { const x = Math.sin(i * 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; } }
      const wet = c.createGain(); wet.gain.value = 0.18; this.verb.connect(wet); wet.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master); this.sfx.connect(this.verb);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.17 : 0; this.mus.connect(master); this.mus.connect(this.verb);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.17 : 0, this.ctx.currentTime, 0.05); }
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
  private hiss(f0: number, f1: number, dur: number, level: number, q = 1.2, at = 0, type: BiquadFilterType = 'bandpass') {
    const c = this.ctx!, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    src.buffer = this.noise; bp.type = type; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.01, dur * 0.25)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.sfx!); src.start(t, (t * 7.31) % 0.4); src.stop(t + dur + 0.05);
  }
  /** One wooden knock: a short resonant click with a hollow body. */
  private knock(at: number, level: number, pitch: number) {
    this.hiss(2600 * pitch, 1800 * pitch, 0.035, level, 6, at);
    this.tone(this.sfx!, 'triangle', 520 * pitch, 380 * pitch, 0.05, level * 0.5, at, 0.001);
  }
  bell(f: number, level: number, at = 0) { this.tone(this.sfx!, 'sine', f, f, 1.0, level, at); this.tone(this.sfx!, 'sine', f * 2.76, f * 2.76, 0.3, level * 0.22, at); }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 760, 1140, 0.06, 0.08); }
  /** n dice tumbling onto the felt: quick knocks that thin out as they settle. */
  clatter(n: number) {
    if (!this.ok('clatter', 0.12)) return;
    const now = this.ctx!.currentTime;
    for (let d = 0; d < n; d++) {
      let t = now + d * 0.035, gap = 0.05;
      for (let k = 0; k < 5; k++) { this.knock(t, 0.16 * Math.pow(0.72, k), 0.85 + ((d * 5 + k) % 7) * 0.06); t += gap; gap *= 1.35; }
    }
    this.hiss(900, 500, 0.35, 0.03, 0.7, now);
  }
  pick() { if (this.ok('pick', 0.05)) this.knock(0, 0.12, 1.3); }
  /** A die drops into a tool's slot. */
  thunk(fits: boolean) {
    if (!this.ok('thunk', 0.04)) return;
    if (!fits) { this.tone(this.sfx!, 'square', 180, 150, 0.12, 0.03); return; }
    this.tone(this.sfx!, 'sine', 220, 120, 0.12, 0.16); this.knock(0, 0.1, 0.8);
  }
  fire() { if (this.ok('fire', 0.06)) { this.hiss(600, 2600, 0.18, 0.08, 1.1); } }
  hit(n: number) {
    if (!this.ok('hit', 0.05)) return;
    const big = Math.min(1, n / 20);
    this.hiss(1800, 300, 0.16 + big * 0.12, 0.2 + big * 0.1, 0.8);
    this.tone(this.sfx!, 'sine', 160 - big * 50, 50, 0.2 + big * 0.2, 0.22 + big * 0.12);
    if (n >= 15) { this.hiss(5000, 900, 0.5, 0.08, 0.6); this.tone(this.sfx!, 'triangle', hz(79), hz(79), 0.4, 0.05); }
  }
  hurt(n: number) { if (!this.ok('hurt', 0.06)) return; this.tone(this.sfx!, 'sine', 240, 90, 0.18 + Math.min(0.2, n / 60), 0.18); this.hiss(1200, 400, 0.15, 0.1, 1); }
  block() { if (this.ok('block', 0.06)) { this.knock(0, 0.14, 0.7); this.tone(this.sfx!, 'triangle', 1180, 1170, 0.18, 0.04); } }
  blocked() { if (this.ok('blocked', 0.06)) { this.knock(0, 0.18, 0.6); this.tone(this.sfx!, 'sine', 900, 860, 0.25, 0.05); } }
  heal() { if (!this.ok('heal', 0.1)) return; const now = this.ctx!.currentTime; [72, 76, 79].forEach((m, i) => this.bell(hz(m), 0.06, now + i * 0.06)); }
  poison() { if (!this.ok('poison', 0.1)) return; const now = this.ctx!.currentTime; for (let i = 0; i < 3; i++) this.tone(this.sfx!, 'sine', 300 + i * 90, 700 + i * 120, 0.08, 0.06, now + i * 0.07); }
  burn() { if (!this.ok('burn', 0.1)) return; const now = this.ctx!.currentTime; for (let i = 0; i < 6; i++) this.hiss(3000, 1500, 0.03, 0.08, 4, now + i * 0.04 + (i % 2) * 0.013); this.hiss(500, 900, 0.3, 0.05, 0.6, now); }
  stun() { if (this.ok('stun', 0.2)) { this.bell(hz(84), 0.1); this.bell(hz(88), 0.06, this.ctx!.currentTime + 0.09); } }
  curse() { if (this.ok('curse', 0.2)) this.tone(this.sfx!, 'sawtooth', 220, 140, 0.35, 0.04); }
  acorns() { if (!this.ok('acorns', 0.1)) return; const now = this.ctx!.currentTime; [88, 91, 96].forEach((m, i) => this.tone(this.sfx!, 'square', hz(m), hz(m), 0.08, 0.025, now + i * 0.05)); }
  foe() { if (this.ok('foe', 0.08)) this.hiss(400, 1400, 0.22, 0.07, 1); }
  down() { if (this.ok('down', 0.15)) { this.hiss(3000, 300, 0.5, 0.1, 0.5); this.tone(this.sfx!, 'sine', 600, 200, 0.4, 0.06); } }
  win() {
    if (!this.ctx || !this.soundOn) return;
    const now = this.ctx.currentTime;
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(this.sfx!, 'square', hz(m), hz(m), 0.16, 0.035, now + i * 0.07));
    for (const m of [60, 64, 67, 72]) this.tone(this.sfx!, 'triangle', hz(m), hz(m), 1.4, 0.05, now + 0.5, 0.03);
  }
  lose() { if (!this.ctx || !this.soundOn) return; const now = this.ctx.currentTime; [67, 63, 60, 55].forEach((m, i) => this.tone(this.sfx!, 'triangle', hz(m), hz(m) * 0.99, 0.5, 0.07, now + i * 0.28)); }
  step() { if (this.ok('step', 0.1)) { this.knock(0, 0.06, 0.6); } }

  // ---------------------------------------------------------------- music: a little fair organ playing a waltz
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.25) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 48; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, bar = Math.floor(step / 3) % song.chords.length, chord = song.chords[bar], b = step % 3;
    // oom-pah-pah
    if (b === 0) { const f = hz(song.root - 12 + deg(chord)); this.tone(m, 'triangle', f, f, beat * 0.9, 0.12, at, 0.005); }
    else for (const k of [2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'square', f, f, beat * 0.35, 0.012, at, 0.004); }
    const d = song.melody[step % 24];
    if (d > -50) { const f = hz(song.root + 12 + deg(d)); this.tone(m, 'triangle', f, f, beat * 1.2, 0.06, at, 0.004); this.tone(m, 'sine', f * 2, f * 2, beat * 0.6, 0.015, at); }
  }
}

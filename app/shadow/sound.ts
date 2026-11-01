// Shadowplay's sounds, all made on the fly with WebAudio: a soft leathery flutter when a puppet is picked up, a wooden
// tick on each notch of depth and each turn, a little click when a puppet drops into place, a paper whisper for undo,
// a lantern's breathy hum when it slides, rising chimes as the picture comes close, and a bloom of bells when a scene
// comes alive. Under it all a gentle gamelan-like loop of bronze bells and a soft gong, a different mode for each story.
// Silent until the first click, tap or key; closed when the page goes.

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
// two five-note modes: a bright one (slendro-like) and a soft, minor-sounding one (pelog-like)
const BRIGHT = [0, 2, 5, 7, 9], SOFT = [0, 1, 3, 7, 8];
type Song = { root: number; bpm: number; scale: number[]; melody: number[]; gong: number; amb: 'crickets' | 'waves' | 'owl' | 'wind' | 'embers' | null };
export type SongId = 'menu' | 'story1' | 'story2' | 'story3' | 'story4' | 'story5' | 'free' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 76, scale: BRIGHT, gong: 16, amb: 'crickets', melody: [2, _, 3, _, 4, _, 3, _, 2, _, _, _, 0, _, 1, _, 2, _, 4, _, 5, _, 4, _, 3, _, _, _, 2, _, _, _] },
  story1: { root: 60, bpm: 72, scale: BRIGHT, gong: 16, amb: 'crickets', melody: [4, _, 3, _, 2, _, _, _, 3, _, 4, _, 5, _, _, _, 4, _, 2, _, 3, _, 1, _, 2, _, _, _, _, _, _, _] },
  story2: { root: 57, bpm: 68, scale: BRIGHT, gong: 16, amb: 'waves', melody: [0, _, _, 2, _, _, 4, _, 3, _, _, _, 2, _, _, _, 1, _, _, 2, _, _, 3, _, 0, _, _, _, _, _, _, _] },
  story3: { root: 62, bpm: 64, scale: SOFT, gong: 16, amb: 'owl', melody: [3, _, 2, _, 0, _, _, _, 1, _, 2, _, 3, _, _, _, 4, _, 3, _, 2, _, _, _, 0, _, _, _, _, _, _, _] },
  story4: { root: 59, bpm: 80, scale: BRIGHT, gong: 8, amb: 'crickets', melody: [2, 3, 4, _, 5, _, 4, _, 2, _, 3, _, 1, _, _, _, 2, 3, 4, _, 6, _, 5, _, 4, _, _, _, _, _, _, _] },
  story5: { root: 55, bpm: 70, scale: SOFT, gong: 16, amb: 'embers', melody: [0, _, 1, _, 3, _, _, _, 4, _, 3, _, 1, _, _, _, 0, _, 3, _, 4, _, 5, _, 4, _, _, _, _, _, _, _] },
  free: { root: 64, bpm: 70, scale: BRIGHT, gong: 16, amb: 'wind', melody: [4, _, _, _, 2, _, _, _, 3, _, _, _, 1, _, _, _, 2, _, _, _, 0, _, _, _, 1, _, _, _, _, _, _, _] },
  ending: { root: 62, bpm: 66, scale: BRIGHT, gong: 16, amb: 'crickets', melody: [4, _, 5, _, 6, _, 5, _, 4, _, _, _, 3, _, 2, _, 3, _, 4, _, 2, _, 1, _, 2, _, _, _, _, _, _, _] },
};

export class ShadowSound {
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
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
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
  /** A bronze bell: a fundamental with a few slightly out-of-tune partials, like a gamelan key. */
  private bell(out: GainNode, f: number, dur: number, level: number, at = 0) {
    this.tone(out, 'sine', f, f, dur, level, at, 0.004);
    this.tone(out, 'sine', f * 2.76, f * 2.76, dur * 0.4, level * 0.3, at, 0.002);
    this.tone(out, 'sine', f * 5.4, f * 5.4, dur * 0.15, level * 0.12, at, 0.001);
    this.tone(out, 'sine', f * 1.003, f * 1.003, dur, level * 0.5, at, 0.004);
  }
  ui() { if (this.ok('ui', 0.04)) this.bell(this.sfx!, 880, 0.18, 0.06); }
  nope() { if (this.ok('nope', 0.15)) this.tone(this.sfx!, 'sine', 220, 170, 0.14, 0.08); }
  /** A leathery flutter: a puppet lifted from its hook. */
  pick() { if (this.ok('pick', 0.06)) { this.hiss(this.sfx!, 'bandpass', 1800, 900, 0.09, 0.06, 0, 2.5); this.tone(this.sfx!, 'triangle', 300, 360, 0.05, 0.04); } }
  /** A wooden tick for each notch of depth, turn or rotation. */
  tick(pitch = 1) { if (this.ok('tick', 0.03)) { this.tone(this.sfx!, 'triangle', 900 * pitch, 700 * pitch, 0.04, 0.07); this.hiss(this.sfx!, 'bandpass', 3200 * pitch, 2400, 0.03, 0.05, 0, 4); } }
  /** A puppet dropped: a soft tap on the rod rail. */
  drop() { if (this.ok('drop', 0.05)) { this.tone(this.sfx!, 'sine', 240, 180, 0.08, 0.08); this.hiss(this.sfx!, 'lowpass', 900, 300, 0.06, 0.05); } }
  /** Clicked into its place. */
  snap() { if (this.ok('snap', 0.08)) { this.tone(this.sfx!, 'triangle', 1200, 1000, 0.05, 0.08); this.bell(this.sfx!, 1568, 0.3, 0.04, this.ctx!.currentTime + 0.03); } }
  /** A puppet taken off the rods or put back. */
  take(on: boolean) { if (this.ok('take', 0.06)) { this.hiss(this.sfx!, 'bandpass', on ? 700 : 1600, on ? 1600 : 700, 0.18, 0.07, 0, 1.5); } }
  undo() { if (this.ok('undo', 0.04)) this.hiss(this.sfx!, 'bandpass', 2600, 900, 0.16, 0.06, 0, 1.2); }
  /** A lantern sliding along its rail: a breathy hum. */
  lamp() { if (this.ok('lamp', 0.12)) { this.hiss(this.sfx!, 'bandpass', 500, 700, 0.2, 0.06, 0, 3); this.tone(this.sfx!, 'sine', 110, 116, 0.22, 0.03); } }
  hint() { if (this.ok('hint', 0.3)) [784, 988, 1175].forEach((f, i) => this.bell(this.sfx!, f, 0.4, 0.04, this.ctx!.currentTime + i * 0.09)); }
  /** A soft rising chime as the picture gets close: level is how close (0–1). */
  near(level: number) {
    if (!this.ctx || !this.soundOn || level < 0.7) return;
    const step = Math.min(4, Math.floor((level - 0.7) / 0.075));
    if (!this.ok('near' + step, 1.5)) return;
    this.bell(this.sfx!, hz(72 + BRIGHT[step]), 0.6, 0.03);
  }
  /** The picture is cast: a bloom of bells, a gong, and a little rising run. */
  cast() {
    if (!this.ok('cast', 0.5)) return;
    const o = this.sfx!, now = this.ctx!.currentTime;
    this.tone(o, 'sine', 98, 96, 2.4, 0.16, now, 0.01); this.tone(o, 'sine', 196 * 1.01, 196, 1.6, 0.05, now, 0.01);
    [0, 2, 5, 7, 9, 12, 14].forEach((d, i) => this.bell(o, hz(72 + d), 0.9, 0.06, now + 0.15 + i * 0.08));
    this.hiss(o, 'highpass', 6000, 9000, 1.2, 0.025, now + 0.4);
  }
  stars(n: number) { if (!this.ctx) return; const now = this.ctx.currentTime; for (let i = 0; i < n; i++) this.bell(this.sfx!, hz(84 + BRIGHT[(i * 2) % 5]), 0.5, 0.05, now + 0.6 + i * 0.25); }
  /** Applause from the woodland audience: soft pattering. */
  applause() {
    if (!this.ok('applause', 2)) return;
    const now = this.ctx!.currentTime;
    for (let i = 0; i < 40; i++) { const t = now + (i * 0.037 + Math.sin(i * 7.1) * 0.02) % 1.8; this.hiss(this.sfx!, 'bandpass', 1800 + (i % 5) * 300, 1200, 0.05, 0.05, t, 2); }
  }

  // ---------------------------------------------------------------- music and ambience
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tickMusic(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => song.scale[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    const s = step % 32, d = song.melody[s];
    // the lead: a bronze key, with a quick echo an octave up on every other note (like a second player)
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.bell(m, f, beat * 3, 0.07, at); if (step % 4 === 2) this.bell(m, f * 2, beat * 1.2, 0.02, at + beat / 2); }
    // the low keys walk slowly underneath
    if (step % 4 === 0) { const f = hz(song.root - 12 + deg([0, 2, 3, 1][Math.floor(step / 16) % 4])); this.bell(m, f, beat * 4, 0.08, at); }
    // the gong at the end of every cycle, and a soft kempul halfway
    if (step % song.gong === song.gong - 1) { this.tone(m, 'sine', hz(song.root - 24), hz(song.root - 24) * 0.99, beat * 10, 0.16, at, 0.01); this.tone(m, 'sine', hz(song.root - 12) * 1.007, hz(song.root - 12), beat * 6, 0.04, at, 0.01); }
    // the story's night sounds
    switch (song.amb) {
      case 'crickets': if (step % 8 === 3) for (let i = 0; i < 3; i++) this.tone(m, 'sine', 4300, 4300, 0.025, 0.012, at + i * 0.05); break;
      case 'waves': if (step % 16 === 0) this.hiss(m, 'lowpass', 400, 900, beat * 12, 0.05, at, 0.7); break;
      case 'owl': if (step % 32 === 20) { this.tone(m, 'sine', 380, 340, 0.3, 0.035, at); this.tone(m, 'sine', 380, 330, 0.45, 0.035, at + 0.45); } break;
      case 'wind': if (step % 16 === 0) this.hiss(m, 'bandpass', 500, 900, beat * 14, 0.035, at, 2); break;
      case 'embers': if (step % 6 === 1) this.hiss(m, 'highpass', 5000, 3000, 0.02, 0.03, at); break;
      default: break;
    }
  }
}

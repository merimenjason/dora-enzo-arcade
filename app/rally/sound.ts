// Wind-Up Rally's sounds, all made on the fly with WebAudio: a bright tin *ting* for a sweet-spot hit and a duller
// *tok* for an ordinary one, a whoosh for a swing, a clank when the shuttle hits the net or a toy topples, the ratchet
// clicks of a key being wound and a brass *ding* when it's full, a tiny tin crowd clattering after a point, and a
// music-box tune for each opponent (a music box: bright plucked bell tones over a soft comb hum). Silent until the
// first click, tap or key; closed when the page goes.
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
const MAJ = [0, 2, 4, 5, 7, 9, 11];
type Song = { root: number; bpm: number; melody: number[]; bass: number[] };
export type SongId = 'menu' | 'robot' | 'frog' | 'duck' | 'top' | 'knight' | 'penguin' | 'bear' | 'versus' | 'ending';
// melodies are scale degrees (0 = root) in eighth notes; -1 is a rest
const SONGS: Record<SongId, Song> = {
  menu: { root: 72, bpm: 92, bass: [0, 3, 4, 0], melody: [4, _, 2, _, 4, 5, 4, _, 2, _, 0, _, 1, 2, 3, _, 4, _, 2, _, 4, 5, 7, _, 6, 5, 4, _, 2, _, _, _] },
  robot: { root: 69, bpm: 120, bass: [0, 0, 4, 4], melody: [0, 0, 4, _, 0, 0, 4, _, 3, 3, 2, _, 1, _, 0, _, 0, 0, 4, _, 0, 0, 4, _, 5, 4, 3, _, 4, _, _, _] },
  frog: { root: 67, bpm: 132, bass: [0, 4, 0, 4], melody: [0, _, 4, _, 7, _, 4, _, 5, _, 4, 2, 0, _, _, _, 0, _, 4, _, 7, _, 9, _, 7, _, 4, 2, 4, _, _, _] },
  duck: { root: 74, bpm: 110, bass: [0, 3, 0, 4], melody: [4, 4, 2, _, 0, _, 2, _, 4, 4, 5, _, 4, _, _, _, 2, 2, 0, _, 1, _, 2, _, 4, 2, 1, _, 0, _, _, _] },
  top: { root: 71, bpm: 144, bass: [0, 4, 3, 4], melody: [0, 2, 4, 7, 4, 2, 0, _, 1, 3, 5, 8, 5, 3, 1, _, 2, 4, 6, 9, 6, 4, 2, _, 4, 2, 0, _, 7, _, _, _] },
  knight: { root: 62, bpm: 104, bass: [0, 0, 3, 4], melody: [0, _, 0, 4, 7, _, 7, _, 5, 4, 3, _, 4, _, _, _, 7, _, 7, 5, 4, _, 2, _, 3, 2, 1, _, 0, _, _, _] },
  penguin: { root: 76, bpm: 96, bass: [0, 5, 3, 4], melody: [7, _, 6, _, 4, _, 2, _, 4, _, _, 2, 0, _, _, _, 5, _, 4, _, 2, _, 0, _, 1, _, 2, _, 0, _, _, _] },
  bear: { root: 65, bpm: 84, bass: [0, 5, 3, 4], melody: [4, _, _, 5, 4, _, 2, _, 0, _, 2, _, 4, _, _, _, 5, _, _, 4, 5, _, 7, _, 6, _, 5, _, 4, _, _, _] },
  versus: { root: 70, bpm: 126, bass: [0, 3, 4, 3], melody: [0, 2, 4, _, 4, _, 2, 4, 5, _, 4, _, 2, _, _, _, 0, 2, 4, _, 7, _, 5, 4, 2, _, 1, _, 0, _, _, _] },
  ending: { root: 72, bpm: 76, bass: [0, 3, 4, 0], melody: [0, _, 4, _, 7, _, 9, _, 7, _, 4, _, 5, _, _, _, 4, _, 2, _, 4, _, 7, _, 11, _, 9, _, 7, _, _, _] },
};
const note = (root: number, deg: number) => root + MAJ[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);

export class RallySound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0; private rate = 1;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.62; master.connect(c.destination);
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
  private tone(out: GainNode, type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = 0.003) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  private hiss(out: GainNode, dur: number, level: number, freq: number, q = 1, at = 0, sweep = 0) {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur); f.Q.value = q;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, (freq % 7) / 10); s.stop(t + dur + 0.05);
  }
  /** A music-box bell: a pure tone with a bright, inharmonic shimmer, fading fast. */
  private bell(out: GainNode, f: number, level: number, at = 0, dur = 1.1) {
    this.tone(out, 'sine', f, f, dur, level, at, 0.002);
    this.tone(out, 'sine', f * 3.01, f * 3, dur * 0.35, level * 0.22, at, 0.001);
    this.tone(out, 'sine', f * 5.4, f * 5.4, dur * 0.12, level * 0.08, at, 0.001);
  }
  click() { if (!this.ok('click', 0.04)) return; this.tone(this.sfx!, 'square', 1800, 1400, 0.03, 0.05); this.hiss(this.sfx!, 0.03, 0.12, 3200, 4); }
  /** The racket meets the shuttle: a crisp tin ting on the sweet spot, a tok otherwise. */
  hit(sweet: boolean, smash = false) {
    if (!this.ok('hit', 0.03)) return;
    if (sweet) { this.tone(this.sfx!, 'sine', 2637, 2600, 0.5, 0.16); this.tone(this.sfx!, 'sine', 3951, 3900, 0.3, 0.08); this.tone(this.sfx!, 'triangle', 1318, 1300, 0.18, 0.07); }
    else { this.tone(this.sfx!, 'triangle', 700, 520, 0.08, 0.16); this.hiss(this.sfx!, 0.05, 0.22, 2200, 2); }
    if (smash) { this.hiss(this.sfx!, 0.22, 0.35, 1800, 0.8, 0, 0.3); this.tone(this.sfx!, 'sine', 160, 60, 0.25, 0.3); }
  }
  swing() { if (!this.ok('swing', 0.06)) return; this.hiss(this.sfx!, 0.16, 0.16, 900, 1.2, 0, 2.6); }
  hop() { if (!this.ok('hop', 0.05)) return; this.tone(this.sfx!, 'square', 300, 520, 0.08, 0.04); this.tone(this.sfx!, 'sine', 900, 1300, 0.08, 0.04); }
  /** The shuttle into the wire net: a buzzy clank. */
  net() { if (!this.ok('net', 0.2)) return; this.tone(this.sfx!, 'sawtooth', 220, 180, 0.25, 0.06); this.hiss(this.sfx!, 0.25, 0.2, 1500, 6); }
  cord() { if (!this.ok('cord', 0.2)) return; this.tone(this.sfx!, 'sine', 1975, 1900, 0.4, 0.08); this.hiss(this.sfx!, 0.15, 0.12, 2500, 5); }
  land() { if (!this.ok('land', 0.1)) return; this.tone(this.sfx!, 'triangle', 380, 300, 0.07, 0.1); this.hiss(this.sfx!, 0.08, 0.1, 1200, 1.5); }
  clank() { if (!this.ok('clank', 0.15)) return; this.tone(this.sfx!, 'square', 180, 90, 0.3, 0.1); this.hiss(this.sfx!, 0.3, 0.3, 700, 1.5); this.tone(this.sfx!, 'sine', 1240, 1180, 0.4, 0.06); }
  /** One ratchet click of a key being wound (call it as the key turns). */
  ratchet(pitch = 0) { if (!this.ok('ratchet', 0.055)) return; this.tone(this.sfx!, 'square', 2400 + pitch * 600, 1800, 0.018, 0.06); this.hiss(this.sfx!, 0.02, 0.2, 4200, 6); }
  wound() { if (!this.ok('wound', 0.3)) return; const c = this.ctx!; this.bell(this.sfx!, hz(88), 0.14, c.currentTime, 0.7); this.bell(this.sfx!, hz(95), 0.1, c.currentTime + 0.07, 0.7); }
  runout() { if (!this.ok('runout', 0.5)) return; this.tone(this.sfx!, 'triangle', 400, 90, 0.7, 0.1); this.hiss(this.sfx!, 0.5, 0.06, 500, 1, 0, 0.4); }
  /** The tin crowd: a patter of tiny clicks and a cheer. */
  crowd(big = false) {
    if (!this.ok('crowd', 0.3)) return; const c = this.ctx!;
    const n = big ? 26 : 12;
    for (let i = 0; i < n; i++) { const t = c.currentTime + (i * 0.037) + ((i * 7) % 5) * 0.011; this.tone(this.sfx!, 'square', 1600 + ((i * 131) % 900), 1400, 0.02, 0.025, t); }
    if (big) [0, 4, 7, 12].forEach((d, i) => this.bell(this.sfx!, hz(72 + d), 0.08, c.currentTime + 0.1 + i * 0.09));
  }
  point(mine: boolean) { if (!this.ok('point', 0.2)) return; const c = this.ctx!; (mine ? [0, 4, 7] : [4, 2, 0]).forEach((d, i) => this.bell(this.sfx!, hz(79 + d), 0.1, c.currentTime + i * 0.07, 0.6)); }
  fanfare(win: boolean) {
    if (!this.ok('fanfare', 1)) return; const c = this.ctx!;
    (win ? [0, 4, 7, 12, 7, 12, 16] : [7, 5, 4, 2, 0]).forEach((d, i) => this.bell(this.sfx!, hz(72 + d), 0.14, c.currentTime + i * 0.13, 1.2));
  }
  button() { if (!this.ok('button', 0.05)) return; this.tone(this.sfx!, 'triangle', 1100, 900, 0.05, 0.08); this.tone(this.sfx!, 'sine', 2200, 2150, 0.12, 0.03); }
  /** Starts or switches the music loop; slow (0..1) plays it slower for the replay. */
  music(id: SongId | null) {
    if (this.song === id) return;
    this.song = id; this.step = 0; this.nextAt = this.ctx ? this.ctx.currentTime + 0.1 : 0;
  }
  setRate(r: number) { this.rate = r; }
  /** Schedules the music a little ahead; call every frame. */
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.musicOn || c.state !== 'running') return;
    const S = SONGS[this.song], beat = 60 / S.bpm / 2 / this.rate;
    if (this.nextAt < c.currentTime - 0.5) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.25) {
      const k = this.step % S.melody.length, m = S.melody[k];
      if (m !== _) this.bell(this.mus!, hz(note(S.root, m)), 0.26, this.nextAt, 1.2);
      if (k % 8 === 0) { const d = S.bass[(k / 8) % S.bass.length]; this.bell(this.mus!, hz(note(S.root - 24, d)), 0.2, this.nextAt, 1.6); this.tone(this.mus!, 'sine', hz(note(S.root - 12, d + 2)), hz(note(S.root - 12, d + 2)), beat * 6, 0.04, this.nextAt, 0.2); }
      if (k % 4 === 2) this.tone(this.mus!, 'sine', hz(note(S.root - 12, S.bass[Math.floor(k / 8) % S.bass.length] + 4)), hz(note(S.root - 12, S.bass[Math.floor(k / 8) % S.bass.length] + 4)), beat * 1.5, 0.05, this.nextAt);
      this.step++; this.nextAt += beat;
    }
  }
}

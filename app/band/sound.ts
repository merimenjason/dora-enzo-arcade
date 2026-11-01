// Woodland Band's sound: every instrument synthesised with WebAudio (no audio files) and a look-ahead scheduler, so
// the band keeps rock-steady time while the page draws. A timer wakes every 25 ms and books the notes due in the next
// 120 ms on the audio clock; each booked step is also queued for the page, which bobs the musicians exactly when the
// step sounds. The hedgehog's kick, snare and hat, the woodpecker's blocks, the frog's plucked bass, the mole's tuba,
// the owl's breathy flute, Enzo's glockenspiel, Dora's ukulele strums and the bird choir's "ooh" chords; the
// audience humming a tune back (stomps, claps and clicks for drums); and little sounds for taps, stars and cheers.
// Silent until the first click, tap or key; closed when the page goes.
import { MUSICIANS, noteMidi, type MusicianId, type Song } from '@/lib/band-game';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export type Booked = { step: number; at: number; loop: number; hum: boolean; bus: 'band' | 'music' };
/** How long one step lasts: sixteen steps are sixteenth notes, eight steps are eighth notes. */
export const stepDur = (s: Song) => 60 / s.bpm / (s.steps === 16 ? 4 : 2);

export class BandSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private band: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  // the scheduler
  private timer = 0; private src: (() => Song | null) | null = null; private bus: 'band' | 'music' = 'band';
  private step = 0; private loop = 0; private nextAt = 0; private humSong: Song | null = null; private humLoop = -1;
  private t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  /** Steps booked but not yet handed to the page. */
  queue: Booked[] = [];
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }

  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
      const master = c.createGain(); master.gain.value = 0.7; master.connect(comp);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.band = c.createGain(); this.band.gain.value = this.soundOn ? 1 : 0; this.band.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.45 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  /** The clock everything keeps time by: the audio clock, or the page's when there is no audio. */
  now() { return this.live() ? this.ctx!.currentTime : ((typeof performance !== 'undefined' ? performance.now() : 0) - this.t0) / 1000; }
  /** Whether the audio clock is running (a browser may hold it until the first tap); until then the page's clock keeps time. */
  private live() { return !!this.ctx && this.ctx.state === 'running'; }
  private wasLive = false;
  setSound(on: boolean) { this.soundOn = on; if (this.ctx) for (const g of [this.sfx, this.band]) g?.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.45 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { this.stop(); void this.ctx?.close().catch(() => {}); this.ctx = null; }

  // ---------------------------------------------------------------- the scheduler
  /** Plays a song round and round, reading it afresh at every step so edits are heard straight away. */
  start(src: () => Song | null, bus: 'band' | 'music' = 'band') {
    this.stop();
    this.src = src; this.bus = bus; this.step = 0; this.loop = 0; this.humSong = null; this.humLoop = -1;
    this.wasLive = this.live(); this.nextAt = this.now() + 0.06;
    this.timer = window.setInterval(() => this.pump(), 25);
    this.pump();
  }
  stop() { if (this.timer) window.clearInterval(this.timer); this.timer = 0; this.src = null; this.queue = []; this.humSong = null; }
  get running() { return !!this.timer; }
  get busName() { return this.bus; }
  /** The audience hums `song` (just the rows to echo) for one time round, from the next bar. */
  hum(song: Song) { this.humSong = song; this.humLoop = this.step === 0 ? this.loop : this.loop + 1; }
  get humming() { return !!this.humSong; }
  private pump() {
    const src = this.src; if (!src) return;
    // the clock changed hands (audio started, or stopped): pick the beat up afresh on the new one
    if (this.live() !== this.wasLive) { this.wasLive = this.live(); this.nextAt = this.now() + 0.03; this.queue = []; }
    const ahead = this.now() + 0.12;
    if (this.nextAt < this.now() - 0.25) this.nextAt = this.now() + 0.03; // after a stall, pick the beat up again
    let guard = 0;
    while (this.nextAt < ahead && guard++ < 64) {
      const s = src(); if (!s) return;
      const hum = !!this.humSong && this.loop === this.humLoop;
      const play = hum ? this.humSong! : s;
      const d = stepDur(play), at = this.nextAt + (this.step % 2 ? play.swing * d : 0);
      this.book(play, this.step, at, d, hum);
      this.queue.push({ step: this.step, at, loop: this.loop, hum, bus: this.bus });
      if (this.queue.length > 256) this.queue.splice(0, 128);
      this.nextAt += d;
      this.step++;
      if (this.step >= play.steps) { this.step = 0; if (hum) { this.humSong = null; this.humLoop = -1; } this.loop++; }
    }
  }
  private book(s: Song, step: number, at: number, d: number, hum: boolean) {
    if (!this.live()) return;
    const out = this.bus === 'music' ? this.mus! : this.band!;
    if (this.bus === 'music' && !this.musicOn) return;
    for (const r of s.rows) {
      const p = r.n[step]; if (p === undefined || p < 0) continue;
      if (hum) this.humNote(out, s, r.m, p, at, d);
      else this.note(out, s, r.m, p, at, d, 1);
    }
  }

  // ---------------------------------------------------------------- the voices
  private ok(key: string, gap: number) {
    const c = this.ctx; if (!c || !this.soundOn) return false;
    const t = c.currentTime; if ((this.last.get(key) ?? -1) > t - gap) return false; this.last.set(key, t); return true;
  }
  private env(g: GainNode, t: number, level: number, attack: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + attack + dur);
  }
  private osc(out: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, level: number, attack = 0.004, vib = 0) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * vib, t + dur * 0.6); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + attack + dur + 0.05); }
    this.env(g, t, level, attack, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }
  private hiss(out: AudioNode, type: BiquadFilterType, f0: number, f1: number, t: number, dur: number, level: number, q = 1) {
    const c = this.ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; bq.type = type; bq.Q.value = q; bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    this.env(g, t, level, Math.min(0.01, dur / 4), dur); s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 7) * 0.1); s.stop(t + dur + 0.05);
  }
  /** A low-passed voice: for the tuba and the plucked bass. */
  private warm(out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, level: number, attack: number, cutoff: number) {
    const c = this.ctx!, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(cutoff * 0.4, t + dur); lp.Q.value = 2; lp.connect(out);
    this.osc(lp, type, f, f, t, dur, level, attack);
  }
  /** One musician's note at a time on the audio clock (also used to audition a cell as it is placed). */
  note(out: AudioNode, s: Song, m: MusicianId, p: number, t: number, d: number, vel: number) {
    const M = MUSICIANS[m], fs = noteMidi(s.key, m, p).map(hz);
    switch (m) {
      case 'hedgehog':
        if (p === 0) { this.osc(out, 'sine', 150, 42, t, 0.32, 0.9 * vel, 0.002); this.hiss(out, 'lowpass', 2000, 300, t, 0.02, 0.15 * vel); }
        else if (p === 1) { this.hiss(out, 'bandpass', 1900, 1200, t, 0.17, 0.45 * vel, 0.8); this.osc(out, 'triangle', 200, 150, t, 0.09, 0.25 * vel); }
        else this.hiss(out, 'highpass', 7500, 6000, t, 0.05, 0.22 * vel, 0.7);
        return;
      case 'woodpecker': { const f = [620, 880, 1240][p] ?? 880; this.osc(out, 'triangle', f, f * 0.96, t, 0.08, 0.4 * vel, 0.001); this.osc(out, 'sine', f * 2.3, f * 2.2, t, 0.03, 0.12 * vel, 0.001); this.hiss(out, 'bandpass', f * 2, f * 2, t, 0.015, 0.12 * vel, 4); return; }
      case 'frog': this.warm(out, 'triangle', fs[0], t, 0.55, 0.55 * vel, 0.004, 900); this.warm(out, 'square', fs[0], t, 0.25, 0.08 * vel, 0.004, 600); this.hiss(out, 'lowpass', 900, 200, t, 0.02, 0.06 * vel); return;
      case 'mole': this.warm(out, 'sawtooth', fs[0], t, Math.max(0.25, d * 1.7), 0.22 * vel, 0.035, 700); this.osc(out, 'sine', fs[0], fs[0], t, Math.max(0.25, d * 1.7), 0.25 * vel, 0.03); return;
      case 'owl': this.osc(out, 'sine', fs[0], fs[0], t, Math.max(0.22, d * 1.8), 0.22 * vel, 0.045, 0.008); this.osc(out, 'triangle', fs[0] * 2, fs[0] * 2, t, Math.max(0.15, d), 0.025 * vel, 0.04); this.hiss(out, 'bandpass', fs[0] * 2, fs[0] * 2, t, 0.12, 0.04 * vel, 3); return;
      case 'enzo': this.osc(out, 'sine', fs[0], fs[0], t, 1.1, 0.2 * vel, 0.002); this.osc(out, 'sine', fs[0] * 2.76, fs[0] * 2.76, t, 0.35, 0.06 * vel, 0.001); this.osc(out, 'sine', fs[0] * 5.4, fs[0] * 5.4, t, 0.12, 0.03 * vel, 0.001); return;
      case 'dora': fs.forEach((f, i) => { this.warm(out, 'triangle', f, t + i * 0.016, 0.7, 0.13 * vel, 0.003, 3000); this.osc(out, 'square', f, f, t + i * 0.016, 0.06, 0.012 * vel, 0.002); }); this.hiss(out, 'bandpass', 3000, 1500, t, 0.05, 0.05 * vel, 1); return;
      case 'birds': fs.forEach((f, i) => this.osc(out, i === 1 ? 'triangle' : 'sine', f * 2 * (1 + (i - 1) * 0.002), f * 2, t + i * 0.01, Math.max(0.3, d * 2.4), 0.07 * vel, 0.07, 0.012)); return;
    }
    void M;
  }
  /** The audience humming: "mmm" for notes and chords, stomps, claps and clicks for drums and blocks. */
  private humNote(out: AudioNode, s: Song, m: MusicianId, p: number, t: number, d: number) {
    const k = MUSICIANS[m].kind;
    if (k === 'drum') {
      if (p === 0) { this.osc(out, 'sine', 90, 50, t, 0.18, 0.7); this.hiss(out, 'lowpass', 400, 100, t, 0.08, 0.3); }
      else if (p === 1) { this.hiss(out, 'bandpass', 1400, 1100, t, 0.06, 0.5, 1.4); this.hiss(out, 'bandpass', 1500, 1200, t + 0.012, 0.05, 0.35, 1.4); }
      else this.hiss(out, 'bandpass', 3800, 3600, t, 0.025, 0.4, 6);
      return;
    }
    if (k === 'block') { const f = [500, 720, 1000][p] ?? 720; this.osc(out, 'sine', f * 1.6, f, t, 0.05, 0.4, 0.001); return; }
    const fs = noteMidi(s.key, m, p).map(hz);
    // hummed in a comfortable singing octave
    const voice = (f: number) => { let x = f; while (x < 160) x *= 2; while (x > 700) x /= 2; return x; };
    const list = k === 'chord' ? fs : [fs[0]];
    for (const f0 of list) {
      const f = voice(f0), c = this.ctx!, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 1.5; lp.connect(out);
      this.osc(lp, 'sawtooth', f, f, t, Math.max(0.2, d * 1.6), (k === 'chord' ? 0.05 : 0.11), 0.05, 0.01);
      this.osc(out, 'sine', f, f, t, Math.max(0.2, d * 1.6), (k === 'chord' ? 0.06 : 0.14), 0.05);
    }
  }

  // ---------------------------------------------------------------- little sounds
  /** One cell heard straight away, as it is placed or dragged. */
  audition(s: Song, m: MusicianId, p: number) { if (!this.ctx || p < 0 || !this.ok('aud' + m, 0.05)) return; this.note(this.sfx!, s, m, p, this.ctx.currentTime + 0.005, stepDur(s), 0.8); }
  ui() { if (this.ok('ui', 0.04)) { const t = this.ctx!.currentTime; this.osc(this.sfx!, 'triangle', 880, 1100, t, 0.05, 0.08); } }
  pop() { if (this.ok('pop', 0.04)) { const t = this.ctx!.currentTime; this.osc(this.sfx!, 'sine', 600, 250, t, 0.08, 0.12); } }
  nope() { if (this.ok('nope', 0.15)) { const t = this.ctx!.currentTime; this.osc(this.sfx!, 'square', 200, 150, t, 0.12, 0.03); } }
  join() { if (this.ok('join', 0.1)) { const t = this.ctx!.currentTime; [0, 4, 7].forEach((k, i) => this.osc(this.sfx!, 'triangle', hz(72 + k), hz(72 + k), t + i * 0.06, 0.2, 0.08)); } }
  stars(n: number) { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < n; i++) { const f = hz(84 + [0, 4, 7][i]); this.osc(this.sfx!, 'sine', f, f, t + 0.45 + i * 0.25, 0.7, 0.12, 0.002); this.osc(this.sfx!, 'sine', f * 2.76, f * 2.76, t + 0.45 + i * 0.25, 0.2, 0.03, 0.001); } }
  /** The woodland crowd: pattering paws and a rising "woo". */
  cheer() {
    if (!this.ok('cheer', 1.5)) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 40; i++) { const at = t + ((i * 0.047 + Math.sin(i * 7.1) * 0.02) % 1.9); this.hiss(this.sfx!, 'bandpass', 1500 + (i % 5) * 300, 1100, at, 0.045, 0.12, 2); }
    for (const [f, k] of [[330, 0], [415, 0.08], [494, 0.15]]) this.osc(this.sfx!, 'triangle', f, f * 1.5, t + k, 0.5, 0.03, 0.08);
  }
}

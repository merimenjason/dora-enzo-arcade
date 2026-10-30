// Kiln & Clay's sounds, all made on the fly with WebAudio: the wheel's low hum (higher when it spins faster), the wet
// swish of clay under a finger, a chime when the lump runs true, a plop when it opens, a creak when a wall wobbles, a
// soft "flump" and a slurp when it collapses, a splash of water, a snip for trimming, a bloop for a dip, a brush
// stroke for a band, the kiln's roar (louder as it heats) and the bellows' whoosh, a ding in the sweet band, a tink
// for a crack, a sparkle for a shine, acorns clinking into the jar and a happy jingle for a delivery. Under them a
// gentle folk loop for the workshop, a warmer one for the kiln, and one for the picnic at the end.
// Silent until the first click, tap or key; closed when the page goes.
import type { WheelEv } from '@/lib/pottery-game';

const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { root: number; bpm: number; chords: number[]; melody: number[]; lead: OscillatorType; pluck: boolean };
export type SongId = 'menu' | 'shop' | 'kiln' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { root: 62, bpm: 84, chords: [0, 3, 1, 4], lead: 'triangle', pluck: true, melody: [4, _, 2, _, 3, _, 4, _, 7, _, _, _, 5, _, 4, _, 2, _, 3, _, 4, _, 2, _, 0, _, _, _, _, _, _, _] },
  shop: { root: 60, bpm: 76, chords: [0, 3, 0, 4], lead: 'triangle', pluck: true, melody: [2, _, _, 4, _, _, 3, _, 2, _, _, _, 0, _, _, _, 1, _, 2, _, 4, _, _, _, 3, _, _, 2, _, _, _, _] },
  kiln: { root: 57, bpm: 70, chords: [0, 2, 3, 2], lead: 'sine', pluck: false, melody: [0, _, _, _, 2, _, 3, _, 4, _, _, _, _, _, _, _, 3, _, _, 2, _, _, 0, _, 1, _, _, _, _, _, _, _] },
  ending: { root: 64, bpm: 72, chords: [0, 3, 1, 4], lead: 'triangle', pluck: true, melody: [4, _, _, 5, 4, _, 2, _, 3, _, _, _, 4, _, 7, _, 5, _, _, 4, 2, _, 3, _, 4, _, _, _, _, _, _, _] },
};

export class PotterySound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  // the steady sounds: the wheel's hum, the clay under a finger, the kiln
  private humO: OscillatorNode | null = null; private humG: GainNode | null = null;
  private wetS: AudioBufferSourceNode | null = null; private wetF: BiquadFilterNode | null = null; private wetG: GainNode | null = null;
  private fireS: AudioBufferSourceNode | null = null; private fireF: BiquadFilterNode | null = null; private fireG: GainNode | null = null;
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
      // the hum
      this.humO = c.createOscillator(); this.humO.type = 'triangle'; this.humO.frequency.value = 60;
      this.humG = c.createGain(); this.humG.gain.value = 0; this.humO.connect(this.humG); this.humG.connect(this.sfx); this.humO.start();
      const loop = (f: BiquadFilterType, freq: number): [AudioBufferSourceNode, BiquadFilterNode, GainNode] => {
        const s = c.createBufferSource(); s.buffer = n; s.loop = true;
        const bq = c.createBiquadFilter(); bq.type = f; bq.frequency.value = freq; bq.Q.value = 0.8;
        const g = c.createGain(); g.gain.value = 0; s.connect(bq); bq.connect(g); g.connect(this.sfx!); s.start(); return [s, bq, g];
      };
      [this.wetS, this.wetF, this.wetG] = loop('bandpass', 900);
      [this.fireS, this.fireF, this.fireG] = loop('lowpass', 300);
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
  private set(g: GainNode | null, v: number, k = 0.06) { if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, k); }
  /** The steady sounds, every frame: the wheel spinning (0 stopped to 3 fast), a finger on the clay, the kiln's heat. */
  steady(o: { spin: number; touch: boolean; wet: number; heat: number; bellows: boolean }) {
    const c = this.ctx; if (!c || !this.soundOn) { this.set(this.humG, 0); this.set(this.wetG, 0); this.set(this.fireG, 0); return; }
    if (this.humO) this.humO.frequency.setTargetAtTime(48 + o.spin * 14, c.currentTime, 0.2);
    this.set(this.humG, o.spin > 0 ? 0.035 + o.spin * 0.01 : 0, 0.15);
    if (this.wetF) this.wetF.frequency.setTargetAtTime(500 + o.spin * 260 + (1 - o.wet) * 900, c.currentTime, 0.05);
    this.set(this.wetG, o.touch && o.spin > 0 ? 0.05 + o.wet * 0.06 : 0, 0.04);
    if (this.fireF) this.fireF.frequency.setTargetAtTime(180 + o.heat * 700 + (o.bellows ? 500 : 0), c.currentTime, 0.1);
    this.set(this.fireG, o.heat > 0 ? 0.05 + o.heat * 0.18 + (o.bellows ? 0.08 : 0) : 0, 0.12);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.15); }
  nope() { if (this.ok('nope', 0.15)) this.tone(this.sfx!, 'sine', 220, 160, 0.14, 0.1); }
  /** What the wheel's events sound like. */
  wheel(evs: WheelEv[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of evs) {
      switch (e.k) {
        case 'centred': [523, 784].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.3, 0.09, now + i * 0.09)); break;
        case 'opened': this.tone(o, 'sine', 300, 120, 0.18, 0.18); this.hiss(o, 'lowpass', 900, 200, 0.15, 0.1); break;
        case 'wobble': if (this.ok('wobble', 0.8)) { this.tone(o, 'sawtooth', 150, 120, 0.4, 0.04, 0, 0.05); this.hiss(o, 'bandpass', 500, 300, 0.4, 0.08, 0, 6); } break;
        case 'flump':
          this.tone(o, 'sine', 120, 40, 0.5, 0.35); this.hiss(o, 'lowpass', 700, 90, 0.6, 0.3, now + 0.02);
          this.hiss(o, 'bandpass', 1400, 300, 0.4, 0.1, now + 0.15, 3);
          [392, 349, 311].forEach((f, i) => this.tone(o, 'triangle', f, f * 0.97, 0.28, 0.05, now + 0.5 + i * 0.15));
          break;
        case 'water': this.hiss(o, 'bandpass', 2400, 800, 0.25, 0.14, now, 1.5); this.tone(o, 'sine', 600, 1200, 0.08, 0.05, now + 0.15); this.tone(o, 'sine', 700, 1400, 0.07, 0.04, now + 0.24); break;
        case 'trim': this.hiss(o, 'highpass', 4000, 6000, 0.12, 0.12); this.tone(o, 'triangle', 1500, 900, 0.08, 0.05); break;
        case 'relump': this.tone(o, 'sine', 200, 160, 0.2, 0.08); break;
        case 'dry': this.tone(o, 'square', 900, 1100, 0.07, 0.025); break;
        default: break;
      }
    }
  }
  dip() { if (this.ok('dip', 0.1)) { this.tone(this.sfx!, 'sine', 220, 520, 0.25, 0.16); this.hiss(this.sfx!, 'lowpass', 1200, 300, 0.35, 0.1); } }
  brush() { if (this.ok('brush', 0.08)) this.hiss(this.sfx!, 'bandpass', 3000, 1800, 0.18, 0.06, 0, 2); }
  speckle() { if (this.ok('speckle', 0.1)) for (let i = 0; i < 6; i++) this.tone(this.sfx!, 'sine', 2000 + i * 300, 2000 + i * 300, 0.04, 0.03, this.ctx!.currentTime + i * 0.035); }
  drip() { if (this.ok('drip', 0.1)) [0, 0.12, 0.22].forEach((d, i) => this.tone(this.sfx!, 'sine', 900 - i * 120, 1600 - i * 200, 0.08, 0.06, this.ctx!.currentTime + d)); }
  handle() { if (this.ok('handle', 0.1)) { this.tone(this.sfx!, 'sine', 400, 260, 0.12, 0.14); this.hiss(this.sfx!, 'lowpass', 800, 300, 0.1, 0.08); } }
  /** The kiln's moments: into and out of the sweet band, a flare, the end. */
  kiln(evs: { k: 'flare' | 'done' | 'enter' | 'leave' }[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of evs) {
      if (e.k === 'enter' && this.ok('enter', 0.3)) this.tone(o, 'triangle', 880, 880, 0.18, 0.06);
      if (e.k === 'leave' && this.ok('leave', 0.3)) this.tone(o, 'sine', 330, 300, 0.15, 0.04);
      if (e.k === 'flare') this.hiss(o, 'lowpass', 1600, 400, 0.6, 0.14);
      if (e.k === 'done') [196, 262, 330].forEach((f, i) => this.tone(o, 'sine', f, f, 1.4, 0.09, now + i * 0.04, 0.01));
    }
  }
  bellows() { if (this.ok('bellows', 0.35)) this.hiss(this.sfx!, 'bandpass', 600, 1400, 0.35, 0.09, 0, 1.2); }
  crack() { [3200, 2600].forEach((f, i) => this.tone(this.sfx!, 'sine', f, f * 0.9, 0.12, 0.06, this.ctx!.currentTime + i * 0.12)); }
  shine() { if (this.ctx && this.soundOn) [1319, 1568, 2093, 2637].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f, 0.5, 0.06, this.ctx!.currentTime + i * 0.07)); }
  stars(n: number) { if (this.ctx && this.soundOn) for (let i = 0; i < n; i++) this.tone(this.sfx!, 'triangle', 784 + i * 196, 784 + i * 196, 0.3, 0.1, this.ctx.currentTime + 0.2 + i * 0.22); }
  coins(n: number) { if (this.ctx && this.soundOn) for (let i = 0; i < Math.min(8, n); i++) this.tone(this.sfx!, 'square', 1800 + (i % 3) * 220, 1500, 0.05, 0.03, this.ctx.currentTime + 0.5 + i * 0.06); }
  happy() { if (this.ctx && this.soundOn) [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f, 0.35, 0.09, this.ctx!.currentTime + i * 0.1)); }
  oh() { if (this.ctx && this.soundOn) [392, 370, 330].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f * 0.97, 0.3, 0.06, this.ctx!.currentTime + i * 0.16)); }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], d = song.melody[step % 32];
    if (d >= 0) { const f = hz(song.root + 12 + deg(d)); this.tone(m, song.lead, f, f, beat * (song.pluck ? 1.6 : 2.6), 0.08, at, song.pluck ? 0.004 : 0.03); }
    if (step % 4 === 0) { const r = hz(song.root - 12 + deg(chord)); this.tone(m, 'triangle', r, r, beat * 3, 0.11, at, 0.01); }
    // a little strummed chord on the off-beats
    if (song.pluck && step % 4 === 2) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'triangle', f, f, beat * 0.9, 0.025, at + k * 0.012, 0.003); }
    if (!song.pluck && step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 8, 0.03, at, 0.4); }
  }
}

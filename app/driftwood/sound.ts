// Driftwood Post's sounds, all made on the fly with WebAudio: water lapping louder as the boat speeds up, a wind
// whoosh that follows the wind's strength, rain in a squall, a creak on every tack, a bell at the jetty, paper rustles
// for letters, shell chimes, bumps, Enzo's hammer, and a soft accordion-ish tune that changes with the time of day
// (a slow waltz at dawn, a bouncy jig by day, a warm lilt at golden hour and a hush at night). Silent until the first
// click, tap or key.
import type { Ev, DayPart } from '@/lib/driftwood-game';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const MAJOR = [0, 2, 4, 5, 7, 9, 11], LYDIAN = [0, 2, 4, 6, 7, 9, 11], MIXO = [0, 2, 4, 5, 7, 9, 10];
const _ = -1;
/** A tune: root, tempo, scale, beats a bar (3 for waltzes), chords (scale degrees, one a bar) and a 24- or 32-step melody. */
type Tune = { root: number; bpm: number; scale: number[]; bar: number; chords: number[]; melody: number[]; level: number };
const TUNES: Record<DayPart, Tune> = {
  dawn: { root: 62, bpm: 84, scale: MAJOR, bar: 6, chords: [0, 3, 4, 0], level: 0.8, melody: [4, _, 5, 4, 2, _, 0, _, 2, 4, _, _, 5, _, 7, 5, 4, _, 2, _, 1, 2, _, _] },
  day: { root: 65, bpm: 112, scale: MIXO, bar: 8, chords: [0, 3, 0, 4], level: 1, melody: [0, 2, 4, _, 4, 5, 4, 2, 0, _, 2, 4, 5, _, 4, _, 7, _, 5, 4, 2, _, 4, 2, 0, _, 1, 2, 0, _, _, _] },
  golden: { root: 60, bpm: 92, scale: MAJOR, bar: 6, chords: [0, 5, 3, 4], level: 0.85, melody: [7, _, 6, 5, _, 4, 5, _, 4, 2, _, _, 4, _, 5, 7, _, 9, 7, _, 5, 4, _, _] },
  night: { root: 57, bpm: 70, scale: LYDIAN, bar: 8, chords: [0, 1, 5, 4], level: 0.6, melody: [4, _, _, 3, 4, _, _, _, 7, _, 6, _, 4, _, _, _, 2, _, _, 3, 4, _, 6, _, 4, _, _, _, _, _, _, _] },
};

export class DriftwoodSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private amb: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private water: { g: GainNode; f: BiquadFilterNode } | null = null;
  private wind: { g: GainNode; f: BiquadFilterNode } | null = null;
  private rain: GainNode | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private part: DayPart = 'day'; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx, master = c.createGain(); master.gain.value = 0.7; master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.amb = c.createGain(); this.amb.gain.value = this.soundOn ? 1 : 0; this.amb.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.3 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same; lightly smoothed for a softer hiss
      let prev = 0; for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453, w = (x - Math.floor(x)) * 2 - 1; prev = prev * 0.35 + w * 0.65; d[i] = prev; }
      this.noise = n;
      const loop = (type: BiquadFilterType, f: number, q: number, out: GainNode, offset: number) => {
        const s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
        s.buffer = n; s.loop = true; bq.type = type; bq.frequency.value = f; bq.Q.value = q; g.gain.value = 0;
        s.connect(bq); bq.connect(g); g.connect(out); s.start(0, offset);
        return { g, f: bq };
      };
      this.water = loop('lowpass', 500, 0.7, this.amb, 0); this.wind = loop('bandpass', 700, 0.8, this.amb, 0.7);
      this.rain = loop('highpass', 3500, 0.5, this.amb, 1.3).g;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; const c = this.ctx; if (!c) return; for (const g of [this.sfx, this.amb]) g?.gain.setTargetAtTime(on ? 1 : 0, c.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.1); }
  /** Hidden or out of focus: everything falls silent at once (the wind and water don't play on in a background tab). */
  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  private ok(key: string, gap: number) {
    const c = this.ctx; if (!c || !this.soundOn) return false;
    const t = c.currentTime; if ((this.last.get(key) ?? -1) > t - gap) return false; this.last.set(key, t); return true;
  }
  private tone(out: GainNode, type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = 0.005, detune = 0) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  private hiss(out: GainNode, type: BiquadFilterType, f0: number, f1: number, dur: number, level: number, at = 0) {
    const c = this.ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; bq.type = type; bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(out); s.start(t, (f0 % 7) * 0.2); s.stop(t + dur + 0.05);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 620, 880, 0.08, 0.16); }
  /** Paper: a few soft crinkles. */
  rustle() { if (!this.ok('rustle', 0.08)) return; const t = this.ctx!.currentTime; for (let i = 0; i < 3; i++) this.hiss(this.sfx!, 'bandpass', 2600 + i * 700, 1800, 0.07, 0.12, t + i * 0.06); }
  bell() { if (!this.ok('bell', 0.3)) return; const t = this.ctx!.currentTime; for (const [f, l] of [[880, 0.16], [1760, 0.06], [2640, 0.04], [1108, 0.05]]) this.tone(this.sfx!, 'sine', f, f, 1.6, l, t, 0.004); }
  coins() { if (!this.ok('coins', 0.05)) return; const t = this.ctx!.currentTime; [1319, 1568, 2093].forEach((f, i) => this.tone(this.sfx!, 'triangle', f, f, 0.22, 0.12, t + i * 0.07)); }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'tack': case 'gybe':
          if (this.ok('creak', 0.4)) { this.tone(o, 'sawtooth', 140, 95, 0.35, 0.05, now, 0.05); this.tone(o, 'square', 230, 180, 0.22, 0.025, now + 0.08, 0.03); this.hiss(o, 'bandpass', 900, 500, 0.4, 0.12, now); }
          if (e.k === 'gybe' && this.ok('flap', 0.3)) this.hiss(o, 'lowpass', 1600, 400, 0.25, 0.2, now + 0.05);
          break;
        case 'bump': if (this.ok('bump', 0.12)) { this.tone(o, 'sine', e.hard ? 120 : 160, 60, e.hard ? 0.3 : 0.15, e.hard ? 0.4 : 0.15); this.hiss(o, 'lowpass', 1200, 300, e.hard ? 0.4 : 0.2, e.hard ? 0.35 : 0.12); } break;
        case 'scuff': this.tone(o, 'triangle', 420, 300, 0.2, 0.12, now + 0.1); break;
        case 'patch': for (let i = 0; i < 6; i++) this.tone(o, 'square', 1200, 900, 0.04, 0.05, now + 0.3 + i * 0.45); break;
        case 'patched': [523, 659, 784].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.18, 0.12, now + i * 0.08)); break;
        case 'dock': this.bell(); break;
        case 'castoff': this.hiss(o, 'lowpass', 600, 2400, 0.6, 0.15); this.tone(o, 'triangle', 392, 523, 0.25, 0.08, now + 0.1); break;
        case 'pickup': this.rustle(); break;
        case 'deliver': this.rustle(); this.coins(); break;
        case 'shell': [1568, 2093, 2637].forEach((f, i) => this.tone(o, 'sine', f, f, 0.4, 0.1, now + i * 0.06)); break;
        case 'bottle': this.tone(o, 'sine', 660, 990, 0.3, 0.12); this.tone(o, 'sine', 1320, 1320, 0.6, 0.06, now + 0.15); break;
        case 'seen': if (this.ok('seen', 2)) [784, 988].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.3, 0.07, now + i * 0.12)); break;
        case 'unlock': [659, 784, 1047].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.3, 0.1, now + i * 0.09)); break;
        case 'weather': if (e.w === 'squall') this.tone(o, 'sine', 70, 50, 1.4, 0.2, now, 0.3); break;
        case 'buy': [523, 659, 784, 1047].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.25, 0.13, now + i * 0.07)); break;
        case 'late': [440, 392].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.3, 0.1, now + i * 0.15)); break;
        case 'regatta': case 'ending': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.6, 0.12, now + i * 0.12, 0.02)); break;
        case 'slow': if (this.ok('slow', 1.2)) this.tone(o, 'sine', 520, 440, 0.15, 0.06); break;
        default: break;
      }
    }
  }
  /**
   * Keeps the ambience and the tune going; call every frame. `on` is false while paused or off the water.
   * `speed` and `wind` are 0..1-ish; `part` picks the tune.
   */
  tick(on: boolean, speed: number, wind: number, rain: boolean, part: DayPart) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, k = 0.25;
    this.water?.g.gain.setTargetAtTime(on ? 0.05 + Math.min(1, speed) * 0.22 : 0.02, t, k);
    this.water?.f.frequency.setTargetAtTime(380 + Math.min(1, speed) * 700, t, k);
    this.wind?.g.gain.setTargetAtTime(on ? 0.02 + Math.min(1.4, wind) * 0.06 + (rain ? 0.05 : 0) : 0, t, 0.6);
    this.wind?.f.frequency.setTargetAtTime(500 + wind * 500 + Math.sin(t * 0.7) * 120, t, 0.4);
    this.rain?.gain.setTargetAtTime(on && rain ? 0.12 : 0, t, 0.8);
    if (part !== this.part) { this.part = part; this.step = 0; }
    if (!on || !this.musicOn) { this.nextAt = 0; return; }
    const tune = TUNES[this.part], beat = 60 / tune.bpm / 2;
    if (this.nextAt < t) this.nextAt = t + 0.05;
    while (this.nextAt < t + 0.2) { this.note(tune, this.step, this.nextAt, beat); this.step = (this.step + 1) % (tune.melody.length * 2); this.nextAt += beat; }
  }
  /** One step of the tune: an accordion-ish melody (two detuned reeds), a bass and a chord pad on the bar. */
  private note(tune: Tune, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => tune.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const bar = Math.floor(step / tune.bar) % tune.chords.length, chord = tune.chords[bar], d = tune.melody[step % tune.melody.length], lv = tune.level;
    if (d >= 0) { const f = hz(tune.root + 12 + deg(d)); this.tone(m, 'sawtooth', f, f, beat * 1.7, 0.035 * lv, at, 0.03, -7); this.tone(m, 'sawtooth', f, f, beat * 1.7, 0.03 * lv, at, 0.03, 8); this.tone(m, 'triangle', f, f, beat * 1.8, 0.07 * lv, at, 0.02); }
    if (step % tune.bar === 0) { const r = hz(tune.root - 12 + deg(chord)); this.tone(m, 'sine', r, r, beat * 2.4, 0.2 * lv, at, 0.01); }
    else if (step % (tune.bar / 2) === 0) { for (const k of [2, 4]) { const f = hz(tune.root + deg(chord + k)); this.tone(m, 'triangle', f, f, beat * 1.2, 0.03 * lv, at, 0.02); } }
    if (step % tune.bar === 0) for (const k of [0, 2, 4]) { const f = hz(tune.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * tune.bar * 0.95, 0.025 * lv, at, 0.2); }
  }
}

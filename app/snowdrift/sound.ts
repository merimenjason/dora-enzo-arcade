// Snowdrift's sounds, all made on the fly with WebAudio: the runners' hiss on the snow (brighter and louder the faster
// they go, glassy on ice), a whoosh of wind in the air, a soft crunch on landing, chimes for a smooth landing, a
// rising sparkle for a flip, bumps for a tumble, a cocoa slurp, snowflake tinkles, a bonk on a cave roof, a poof into
// deep snow, a bell to push off, a fanfare at the lodge and a falling hush when the night wins; under them a cosy loop
// per valley from a tiny step sequencer, with a bright extra layer during a Snow Flurry.
// Silent until the first click, tap or key; closed when the page goes.
import type { Ev, ValleyId } from '@/lib/snowdrift-game';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MIXO = [0, 2, 4, 5, 7, 9, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** A loop: root note, tempo, scale, a chord root per bar, and a 32-step melody in scale degrees (-1 rests). */
type Song = { root: number; bpm: number; scale: number[]; chords: number[]; melody: number[]; lead: OscillatorType; bells: boolean };
const _ = -1;
export type SongId = ValleyId | 'lodge' | 'ending' | 'endless';
const SONGS: Record<SongId, Song> = {
  // a sunny little waltz-like hop over the meadow
  meadow: { root: 62, bpm: 104, scale: MAJOR, chords: [0, 3, 4, 0], lead: 'triangle', bells: true, melody: [4, _, 5, _, 7, _, 4, _, 2, _, 4, _, 0, _, _, _, 5, _, 7, _, 9, _, 7, 5, 4, _, 2, _, 4, _, _, _] },
  // gliding, wide intervals over the ice
  lake: { root: 64, bpm: 92, scale: LYDIAN, chords: [0, 1, 0, 4], lead: 'sine', bells: true, melody: [7, _, _, 4, _, _, 9, _, 7, _, 6, _, 4, _, _, _, 2, _, 4, _, 6, _, 7, _, 9, _, _, _, 7, _, _, _] },
  // hushed and echoing in the caves
  caves: { root: 57, bpm: 96, scale: DORIAN, chords: [0, 3, 0, 4], lead: 'sine', bells: false, melody: [0, _, 2, _, 3, _, _, _, 4, _, 3, _, 2, _, _, _, 0, _, 2, _, 3, _, 5, _, 4, _, _, _, _, _, _, _] },
  // blustery and bold on the ridge
  ridge: { root: 60, bpm: 112, scale: MIXO, chords: [0, 6, 3, 0], lead: 'square', bells: false, melody: [0, _, 4, _, 7, _, 6, _, 4, _, 2, _, 4, _, _, _, 0, _, 4, _, 7, _, 9, _, 7, _, 6, 4, 2, _, _, _] },
  // brave and bouncy across the gaps
  bridges: { root: 62, bpm: 108, scale: MAJOR, chords: [0, 4, 5, 3], lead: 'triangle', bells: true, melody: [7, _, 4, _, 5, _, 7, _, 9, _, 7, _, 4, _, _, _, 5, _, 4, _, 2, _, 4, _, 7, _, 5, _, 4, _, _, _] },
  // dreamy under the aurora
  aurora: { root: 61, bpm: 84, scale: LYDIAN, chords: [0, 5, 3, 1], lead: 'sine', bells: true, melody: [9, _, _, 7, _, _, 6, _, 4, _, _, _, 6, _, 7, _, 9, _, _, 11, _, _, 9, _, 7, _, _, _, _, _, _, _] },
  // the big finale tune
  summit: { root: 60, bpm: 116, scale: MAJOR, chords: [0, 5, 3, 4], lead: 'square', bells: true, melody: [4, _, 4, 5, 7, _, 7, _, 9, _, 7, _, 4, _, _, _, 5, _, 5, 4, 2, _, 4, _, 5, _, 7, _, 9, _, _, _] },
  // crackling fire in the lodge
  lodge: { root: 57, bpm: 72, scale: MAJOR, chords: [0, 3, 4, 0], lead: 'triangle', bells: false, melody: [4, _, _, 2, _, _, 0, _, 2, _, _, _, 4, _, 5, _, 4, _, _, 2, _, _, 0, _, _, _, _, _, _, _, _, _] },
  // slow and warm by the grand lodge's fire
  ending: { root: 60, bpm: 66, scale: MAJOR, chords: [0, 5, 3, 4], lead: 'sine', bells: true, melody: [7, _, _, _, 9, _, 7, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, _, _, _, _, _, _] },
  // moonlit and endless
  endless: { root: 59, bpm: 100, scale: DORIAN, chords: [0, 5, 3, 4], lead: 'triangle', bells: true, melody: [0, _, 3, _, 4, _, 7, _, 4, _, 3, _, 0, _, _, _, 2, _, 3, _, 5, _, 7, _, 9, _, 7, _, 5, _, _, _] },
};

export class SnowSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hissG: GainNode | null = null; private hissF: BiquadFilterNode | null = null;
  private windG: GainNode | null = null; private windF: BiquadFilterNode | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0; private flurry = false;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.26 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
      // the runners' hiss and the wind in the air: two loops of noise, shaped every frame
      const bed = (type: BiquadFilterType, f: number, q: number): [GainNode, BiquadFilterNode] => {
        const src = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
        src.buffer = n; src.loop = true; bq.type = type; bq.frequency.value = f; bq.Q.value = q; g.gain.value = 0;
        src.connect(bq); bq.connect(g); g.connect(this.sfx!); src.start(0, f % 0.5);
        return [g, bq];
      };
      [this.hissG, this.hissF] = bed('bandpass', 2400, 0.9);
      [this.windG, this.windF] = bed('lowpass', 500, 0.7);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.26 : 0, this.ctx.currentTime, 0.05); }
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
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'triangle', 660, 990, 0.08, 0.2); }
  buy() { if (!this.ctx || !this.soundOn) return; const o = this.sfx!, now = this.ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.25, 0.1, now + i * 0.05)); }
  /** Shapes the beds every frame: the hiss on the snow and the wind in the air, from the sled's speed. */
  ride(o: { on: boolean; air: boolean; speed: number; ice: boolean }) {
    const c = this.ctx; if (!c || !this.hissG || !this.windG || !this.hissF || !this.windF) return;
    const t = c.currentTime, k = Math.min(1, o.speed / 40), on = o.on && this.soundOn;
    this.hissG.gain.setTargetAtTime(on && !o.air ? 0.03 + k * 0.13 : 0, t, 0.05);
    this.hissF.frequency.setTargetAtTime((o.ice ? 3800 : 1500) + k * 2600, t, 0.08);
    this.windG.gain.setTargetAtTime(on ? (o.air ? 0.08 + k * 0.22 : k * 0.05) : 0, t, o.air ? 0.12 : 0.2);
    this.windF.frequency.setTargetAtTime(300 + k * 1200, t, 0.1);
  }
  /** Plays whatever a batch of game events calls for. */
  play(events: Ev[]) {
    if (!this.ctx || !this.soundOn) return;
    const o = this.sfx!, now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.k) {
        case 'go': this.tone(o, 'sine', 880, 880, 0.5, 0.1); this.tone(o, 'sine', 1320, 1320, 0.6, 0.06, now + 0.05); this.hiss(o, 'bandpass', 1200, 3000, 0.3, 0.1, 0, 1); break;
        case 'takeoff': if (this.ok('takeoff', 0.15)) this.hiss(o, 'bandpass', 600, 1800, 0.25, 0.06 + Math.min(0.08, e.v / 400), 0, 1.4); break;
        case 'land': {
          const k = Math.min(1, e.impact / 16);
          this.hiss(o, 'lowpass', 1400, 220, 0.1 + k * 0.14, 0.08 + k * 0.2, 0, 0.8);
          this.tone(o, 'sine', 140, 60, 0.12, 0.05 + k * 0.12);
          if (e.smooth) { const base = 1047 * Math.pow(1.122, Math.min(6, e.chain - 1)); [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(o, 'triangle', base * m, base * m, 0.32, 0.07, now + 0.02 + i * 0.045)); }
          if (e.flips > 0) { this.tone(o, 'square', 523, 2093, 0.35, 0.05, now + 0.02); [1568, 2093, 2637].forEach((f, i) => this.tone(o, 'sine', f, f, 0.4, 0.08, now + 0.08 + i * 0.07)); }
          break;
        }
        case 'tumble': for (let i = 0; i < 4; i++) { this.tone(o, 'sine', 180 - i * 25, 70, 0.12, 0.16, now + i * 0.12); this.hiss(o, 'lowpass', 900, 200, 0.12, 0.12, now + i * 0.12); } this.tone(o, 'triangle', 600, 300, 0.4, 0.05, now + 0.1); break;
        case 'flurry': if (e.on) { [1319, 1568, 1976, 2637, 3136].forEach((f, i) => this.tone(o, 'sine', f, f, 0.5, 0.06, now + i * 0.04)); this.hiss(o, 'highpass', 4000, 8000, 0.6, 0.06); } this.flurry = e.on; break;
        case 'bonk': this.tone(o, 'sine', 200, 90, 0.14, 0.2); [2637, 3136, 3520].forEach((f, i) => this.tone(o, 'sine', f, f, 0.2, 0.05, now + 0.05 + i * 0.05)); break;
        case 'fall': this.hiss(o, 'lowpass', 2400, 200, 0.6, 0.25, 0, 0.7); this.tone(o, 'sine', 400, 120, 0.5, 0.08); break;
        case 'respawn': this.tone(o, 'sine', 660, 990, 0.18, 0.08); break;
        case 'flake': if (this.ok('flake', 0.035)) { const f = 2093 + ((e.x * 37) % 5) * 220; this.tone(o, 'sine', f, f, 0.12, 0.045); } break;
        case 'cocoa': this.hiss(o, 'bandpass', 500, 1500, 0.3, 0.12, 0, 3); [784, 988, 1319].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.35, 0.1, now + 0.15 + i * 0.07)); break;
        case 'gust': if (e.on && this.ok('gust', 0.6)) this.hiss(o, 'bandpass', 300, 900, 0.9, 0.12, 0, 1.2); break;
        case 'finish': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.5, 0.12, now + i * 0.09)); break;
        case 'caught': [784, 659, 523, 392].forEach((f, i) => this.tone(o, 'sine', f, f * 0.98, 0.6, 0.09, now + i * 0.18)); this.hiss(o, 'lowpass', 1200, 200, 1.4, 0.08); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- music
  /** Picks the loop (null stops it). */
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; this.flurry = false; }
  /** Keeps the loop going; call every frame. `on` is false while paused. */
  tick(on: boolean) {
    const c = this.ctx;
    if (!c || !on || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.18) { this.note(song, this.step, this.nextAt, beat); this.step = (this.step + 1) % 64; this.nextAt += beat; }
  }
  private note(song: Song, step: number, at: number, beat: number) {
    const m = this.mus!, deg = (d: number) => song.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const bar = Math.floor(step / 8) % song.chords.length, chord = song.chords[bar], s = step % 32;
    const d = song.melody[s];
    if (d >= 0) this.tone(m, song.lead, hz(song.root + 12 + deg(d)), hz(song.root + 12 + deg(d)), beat * 1.8, song.lead === 'square' ? 0.04 : 0.1, at, 0.01);
    if (step % 2 === 0) { const r = song.root - 12 + deg(chord) + (step % 4 === 2 ? 7 : 0); this.tone(m, 'triangle', hz(r), hz(r), beat * 1.4, 0.14, at, 0.005); }
    if (step % 8 === 0) for (const k of [0, 2, 4]) { const f = hz(song.root + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 7, 0.03, at, 0.2); }
    // sleigh bells on the off-beats
    if (song.bells && step % 4 === 2) { const s0 = this.ctx!.createBufferSource(), bq = this.ctx!.createBiquadFilter(), g = this.ctx!.createGain(); s0.buffer = this.noise; bq.type = 'highpass'; bq.frequency.value = 6500; g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.09); s0.connect(bq); bq.connect(g); g.connect(m); s0.start(at, (step % 9) * 0.05); s0.stop(at + 0.12); }
    // the Snow Flurry's layer: a quick bright arpeggio over the chord
    if (this.flurry) { const k = [0, 2, 4, 7][step % 4], f = hz(song.root + 24 + deg(chord + k)); this.tone(m, 'sine', f, f, beat * 0.9, 0.05, at, 0.004); }
  }
}

// Powder Paws sounds, made on the fly with WebAudio in a chiptune voice: the hiss of skis on snow that rises with
// speed (and scrapes on ice), a swish on every hard carve, a whoosh off a ramp, a thump on landing, a rising arpeggio
// for a clean trick, a poof and a boing for a tumble, a jingle of bells for a postcard, gate dings, a low howl as the
// storm closes in, and a square-wave tune for the menu, the mountain and the cocoa. Silent until the first click,
// tap or key; closed when the page goes.
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const _ = -1;
type Song = { bpm: number; bass: number[]; lead: number[]; wave: OscillatorType };
export type SongId = 'menu' | 'ski' | 'cocoa' | 'ending';
const SONGS: Record<SongId, Song> = {
  menu: { bpm: 112, wave: 'square', bass: [48, _, 55, _, 52, _, 55, _, 45, _, 52, _, 48, _, 52, _, 41, _, 48, _, 45, _, 48, _, 43, _, 50, _, 47, _, 50, _], lead: [72, _, 76, 79, _, 76, 74, _, 72, _, 69, _, 72, _, _, _, 69, _, 72, 74, _, 72, 69, _, 67, _, 71, _, 74, _, _, _] },
  ski: { bpm: 144, wave: 'square', bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47], lead: [69, _, 72, 76, _, 74, 72, _, 71, _, 67, 71, _, 74, _, 72, 69, _, 65, 69, _, 72, 74, _, 76, _, 74, _, 71, _, _, _] },
  cocoa: { bpm: 84, wave: 'triangle', bass: [48, _, _, _, 53, _, _, _, 45, _, _, _, 50, _, 55, _], lead: [76, _, 74, 72, _, _, 74, _, 76, _, 79, _, 77, _, _, _, 74, _, 72, 69, _, _, 71, _, 72, _, _, _, _, _, _, _] },
  ending: { bpm: 120, wave: 'square', bass: [48, _, 55, _, 53, _, 55, _, 50, _, 57, _, 55, _, 59, _], lead: [72, 76, 79, 84, _, 79, 76, _, 77, 81, 84, 89, _, 84, 81, _, 79, 83, 86, 91, _, 86, 83, _, 84, _, _, _, 79, _, 84, _] },
};

export class PowderSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ski: { g: GainNode; f: BiquadFilterNode } | null = null;
  private wind: { g: GainNode; f: BiquadFilterNode } | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  /** Starts audio; must be called from a click, tap or key press. */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.55; master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(master);
      const n = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate), d = n.getChannelData(0);
      // a fixed hash instead of Math.random, so the noise is always the same
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
      // two endless noise beds: the skis on the snow and the storm's wind
      const bed = (type: BiquadFilterType, freq: number) => {
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = n; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(this.sfx!); s.start(); return { g, f };
      };
      this.ski = bed('bandpass', 2400); this.wind = bed('lowpass', 500);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  /** The continuous sounds: ski hiss by speed and surface, wind by how close the storm is (0..1). */
  bed(speed: number, onSnow: boolean, ice: boolean, storm: number) {
    const c = this.ctx; if (!c || !this.ski || !this.wind) return;
    const t = c.currentTime, v = Math.min(1, speed / 260);
    this.ski.g.gain.setTargetAtTime(onSnow ? 0.02 + v * 0.07 : 0, t, 0.06);
    this.ski.f.frequency.setTargetAtTime(ice ? 5200 : 1600 + v * 1800, t, 0.1);
    this.wind.g.gain.setTargetAtTime(storm * 0.16, t, 0.3);
    this.wind.f.frequency.setTargetAtTime(300 + storm * 700 + Math.sin(t * 1.3) * 120, t, 0.2);
  }
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
  private hiss(type: BiquadFilterType, f0: number, f1: number, dur: number, level: number, at = 0, q = 1) {
    const c = this.ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; bq.type = type; bq.Q.value = q; bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(bq); bq.connect(g); g.connect(this.sfx!); s.start(t, (f0 % 7) * 0.1); s.stop(t + dur + 0.03);
  }
  ui() { if (this.ok('ui', 0.04)) this.tone(this.sfx!, 'square', 990, 1320, 0.06, 0.04); }
  carve() { if (this.ok('carve', 0.25)) this.hiss('bandpass', 1800, 4200, 0.22, 0.09, 0, 1.5); }
  jump(big: boolean) { if (this.ok('jump', 0.2)) { this.hiss('bandpass', 600, 3000, big ? 0.5 : 0.3, 0.12, 0, 1); this.tone(this.sfx!, 'square', 330, big ? 990 : 660, 0.18, 0.04); } }
  land(clean: boolean) { if (this.ok('land', 0.1)) { this.tone(this.sfx!, 'triangle', 140, 60, 0.14, 0.2); this.hiss('lowpass', 1600, 300, 0.18, clean ? 0.1 : 0.16); } }
  trick(pts: number) {
    if (!this.ok('trick', 0.2)) return;
    const now = this.ctx!.currentTime, n = Math.min(8, 3 + Math.floor(pts / 300));
    [72, 76, 79, 84, 88, 91, 96, 100].slice(0, n).forEach((m, i) => this.tone(this.sfx!, 'square', hz(m), hz(m), 0.1, 0.05, now + i * 0.055));
  }
  crash() { if (this.ok('crash', 0.2)) { const now = this.ctx!.currentTime; this.hiss('lowpass', 2400, 200, 0.45, 0.25, now, 0.7); this.tone(this.sfx!, 'square', 520, 130, 0.35, 0.05, now + 0.05); this.tone(this.sfx!, 'triangle', 200, 420, 0.18, 0.06, now + 0.45); } }
  up() { if (this.ok('up', 0.3)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'square', hz(67), hz(67), 0.06, 0.03, now); this.tone(this.sfx!, 'square', hz(72), hz(72), 0.08, 0.03, now + 0.07); } }
  puff() { if (this.ok('puff', 0.15)) this.hiss('lowpass', 1800, 300, 0.25, 0.12); }
  mogul() { if (this.ok('mogul', 0.12)) this.tone(this.sfx!, 'triangle', 180, 320, 0.08, 0.06); }
  clack() { if (this.ok('clack', 0.1)) this.tone(this.sfx!, 'square', 1800, 1200, 0.04, 0.05); }
  gate(ok: boolean) { if (this.ok('gate', 0.08)) { if (ok) this.tone(this.sfx!, 'square', hz(84), hz(84), 0.09, 0.04); else { this.tone(this.sfx!, 'sawtooth', 220, 180, 0.22, 0.05); } } }
  postcard() { if (this.ok('postcard', 0.4)) { const now = this.ctx!.currentTime; [84, 88, 91, 96, 91, 96, 100].forEach((m, i) => { this.tone(this.sfx!, 'square', hz(m), hz(m), 0.12, 0.04, now + i * 0.07); this.tone(this.sfx!, 'sine', hz(m + 12), hz(m + 12), 0.25, 0.02, now + i * 0.07); }); } }
  bump() { if (this.ok('bump', 0.3)) this.tone(this.sfx!, 'square', 700, 300, 0.12, 0.04); }
  caught() { if (this.ok('caught', 1)) { const now = this.ctx!.currentTime; this.hiss('lowpass', 3000, 200, 1.4, 0.2, now, 0.6); [76, 72, 69, 67].forEach((m, i) => this.tone(this.sfx!, 'triangle', hz(m), hz(m), 0.3, 0.06, now + 0.3 + i * 0.18)); } }
  finish(medal: number) { if (this.ok('finish', 0.6)) { const now = this.ctx!.currentTime; [72, 76, 79, 84, 88, 91].slice(0, 3 + medal).forEach((m, i) => this.tone(this.sfx!, 'square', hz(m), hz(m), 0.16, 0.05, now + i * 0.1)); } }
  cheer() { if (this.ok('cheer', 0.5)) { const now = this.ctx!.currentTime; this.tone(this.sfx!, 'square', hz(88), hz(93), 0.08, 0.03, now); this.tone(this.sfx!, 'square', hz(91), hz(96), 0.1, 0.03, now + 0.09); } }

  // ---------------------------------------------------------------- music: a little chiptune band
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  tickMusic() {
    const c = this.ctx;
    if (!c || !this.musicOn || !this.song) { this.nextAt = 0; return; }
    const song = SONGS[this.song], beat = 60 / song.bpm / 2;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const s = this.step, at = this.nextAt, m = this.mus!;
      const b = song.bass[s % song.bass.length], l = song.lead[s % song.lead.length];
      if (b >= 0) this.tone(m, 'triangle', hz(b), hz(b), beat * 1.6, 0.16, at, 0.005);
      if (l >= 0) this.tone(m, song.wave, hz(l), hz(l), beat * 1.4, 0.05, at, 0.004);
      if (this.song === 'ski' && s % 4 === 2) { const c2 = this.ctx!, src = c2.createBufferSource(), g = c2.createGain(), f = c2.createBiquadFilter(); src.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6000; g.gain.setValueAtTime(0.06, at); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.05); src.connect(f); f.connect(g); g.connect(m); src.start(at); src.stop(at + 0.06); }
      this.step = (this.step + 1) % 64; this.nextAt += beat;
    }
  }
}

// Pawpark Skate sounds, all synthesised with WebAudio: the wheels' roll rising with speed, the tail's pop on an ollie,
// the clack of four wheels landing, a metal scrape on a rail (a wooden one on a ledge), a whoosh for every trick, a
// chime for a golden acorn, a fanfare for a goal, a thud and a scuff for a bail, and an original sunny skate groove
// (written for this game) with a different feel for each park. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'menu' | 'plaza' | 'hill' | 'roofs' | 'ending';
/** a bar is 16 steps: chords, a bass line (semitones from the root, -99 rest) and a drum feel */
const SONGS: Record<SongId, { root: number; bpm: number; chords: number[][]; bass: number[]; lead: number[]; swing: number; drums: 'light' | 'full' | 'brush' }> = {
  menu: { root: 55, bpm: 92, swing: 0.12, drums: 'light', chords: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]],
    bass: [0, -99, -99, 0, -99, -99, 7, -99, 0, -99, -99, 0, -99, 5, -99, 7], lead: [12, -99, 16, -99, 19, -99, 16, 14, -99, -99, 12, -99, 9, -99, -99, -99] },
  plaza: { root: 57, bpm: 108, swing: 0.1, drums: 'full', chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 5]],
    bass: [0, -99, 0, -99, 7, -99, -99, 5, -99, 4, -99, -99, 2, -99, 4, -99], lead: [16, -99, 19, 21, -99, 19, -99, 16, 14, -99, 12, -99, 14, 16, -99, -99] },
  hill: { root: 52, bpm: 100, swing: 0.16, drums: 'brush', chords: [[0, 4, 7, 14], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17]],
    bass: [0, -99, -99, 7, -99, -99, 12, -99, 0, -99, -99, 7, -99, 5, -99, -99], lead: [19, -99, -99, 21, 19, -99, 16, -99, -99, -99, 14, -99, 16, -99, -99, -99] },
  roofs: { root: 50, bpm: 96, swing: 0.2, drums: 'full', chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-7, -3, 0, 3]],
    bass: [0, -99, -99, 0, -99, 3, -99, -99, 5, -99, -99, 5, -99, 3, -2, -99], lead: [15, -99, 14, -99, 10, -99, -99, 12, -99, 15, -99, 17, 15, -99, -99, -99] },
  ending: { root: 60, bpm: 112, swing: 0.08, drums: 'full', chords: [[0, 4, 7, 12], [5, 9, 12, 16], [7, 11, 14, 19], [4, 7, 11, 16]],
    bass: [0, -99, 0, -99, 5, -99, 5, -99, 7, -99, 7, -99, 4, -99, 4, -99], lead: [12, 16, 19, 24, -99, 19, -99, 21, -99, 19, 16, -99, 14, -99, 16, -99] },
};

export class SkateSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private noise: AudioBuffer | null = null; private verb: DelayNode | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private roll: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  private scrape: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.26 : 0; this.mus.connect(comp);
      // a short slap-back room the lead and the chimes share
      const d = c.createDelay(1); d.delayTime.value = 0.18; const fb = c.createGain(); fb.gain.value = 0.28; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(comp); this.verb = d;
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.26 : 0, this.ctx.currentTime, 0.1); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  // ---------------------------------------------------------------- building blocks
  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'sine', to = 0, out: AudioNode | null = this.sfx, attack = 0.005) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
    return g;
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  private loop(type: BiquadFilterType, f: number, q: number) {
    const c = this.ctx!, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.sfx!); s.start(); return { s, f: fl, g };
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  // ---------------------------------------------------------------- the board
  /** the wheels' rumble, louder and brighter with speed; the scrape while grinding */
  board(speed: number, rolling: boolean, grinding: false | 'metal' | 'stone') {
    const c = this.ctx; if (!c || !this.sfx || !this.noise) return;
    this.roll ??= this.loop('lowpass', 300, 0.8); this.scrape ??= this.loop('bandpass', 2400, 3);
    const t = c.currentTime, k = Math.min(1, speed / 11);
    this.roll.f.frequency.setTargetAtTime(160 + k * 600, t, 0.08); this.roll.g.gain.setTargetAtTime(rolling && speed > 0.3 ? 0.05 + k * 0.12 : 0, t, 0.05);
    this.scrape.f.frequency.setTargetAtTime(grinding === 'metal' ? 3200 + k * 800 : 900, t, 0.05); this.scrape.f.Q.value = grinding === 'metal' ? 6 : 1.5;
    this.scrape.g.gain.setTargetAtTime(grinding ? 0.06 + k * 0.05 : 0, t, 0.03);
  }
  quiet() { const c = this.ctx; if (!c) return; for (const l of [this.roll, this.scrape]) l?.g.gain.setTargetAtTime(0, c.currentTime, 0.05); }
  ollie() { const t = this.now; this.tone(220, t, 0.06, 0.4, 'square', 90); this.hiss(t, 0.05, 0.35, 1800, 1.2); }
  land(hard: boolean) { const t = this.now; this.tone(hard ? 110 : 150, t, 0.1, 0.45, 'sine', 50); this.hiss(t, 0.08, 0.4, 900, 0.8); this.hiss(t + 0.03, 0.06, 0.25, 1400, 1); }
  flip() { const t = this.now; this.hiss(t, 0.22, 0.12, 900, 1.5, 'bandpass', 2600); this.tone(500, t, 0.05, 0.06, 'triangle', 700); }
  whoosh() { const t = this.now; this.hiss(t, 0.3, 0.1, 500, 1, 'bandpass', 1400); }
  grindOn(metal: boolean) { const t = this.now; this.tone(metal ? 1400 : 300, t, 0.08, 0.18, metal ? 'square' : 'triangle', metal ? 900 : 200); this.hiss(t, 0.06, 0.3, metal ? 4000 : 1200, 2); }
  bail() { const t = this.now; this.tone(90, t, 0.3, 0.5, 'sine', 40); this.hiss(t, 0.35, 0.35, 600, 0.6, 'lowpass', 200); this.tone(260, t + 0.18, 0.12, 0.2, 'square', 180); this.tone(240, t + 0.32, 0.1, 0.14, 'square', 170); }
  acorn() { const t = this.now; [88, 92, 95, 100].forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.06, 0.5, 0.12, 'sine'); if (g && this.verb) g.connect(this.verb); }); }
  gap() { const t = this.now; [79, 84].forEach((n, i) => this.tone(hz(n), t + i * 0.08, 0.3, 0.12, 'triangle')); }
  combo(size: number) { const t = this.now, top = Math.min(5, Math.floor(size / 1000)); for (let i = 0; i <= top; i++) this.tone(hz(76 + i * 3), t + i * 0.05, 0.25, 0.09, 'triangle'); }
  goal() { const t = this.now; [72, 76, 79, 84, 88].forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.09, 0.6, 0.14, 'triangle'); if (g && this.verb) g.connect(this.verb); }); this.hiss(t + 0.4, 0.6, 0.1, 6000, 0.7, 'highpass'); }
  special() { const t = this.now; for (let i = 0; i < 8; i++) this.tone(hz(84 + i * 2), t + i * 0.035, 0.3, 0.08, 'sine'); }
  ready() { const t = this.now; this.tone(hz(84), t, 0.1, 0.1, 'sine'); this.tone(hz(91), t + 0.08, 0.2, 0.1, 'sine'); }
  tick() { this.tone(1200, this.now, 0.04, 0.08, 'square'); }
  whistle() { const t = this.now; this.tone(2200, t, 0.5, 0.14, 'sine', 2600); this.tone(2600, t + 0.5, 0.4, 0.12, 'sine', 2200); }
  button() { this.tone(980, this.now, 0.05, 0.1, 'sine'); }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song], st = 60 / s.bpm / 4;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step % 16, bar = Math.floor(this.step / 16) % s.chords.length, chord = s.chords[bar], r = s.root;
      const t = this.nextAt + (i % 2 ? st * s.swing : 0), out = this.mus;
      // chords: a stab on 1 and the "and" of 2, a soft pad underneath
      if (i === 0) for (const n of chord) this.tone(hz(r + n), t, st * 15, 0.03, 'triangle', 0, out, st * 3);
      if (i === 0 || i === 6 || i === 10) for (const n of chord) this.tone(hz(r + n + 12), t, st * 1.6, 0.025, 'square', 0, out);
      const b = s.bass[i]; if (b > -50) this.tone(hz(r - 24 + chord[0] + b), t, st * 2.2, 0.2, 'triangle', 0, out);
      const l = s.lead[i]; if (l > -50 && Math.floor(this.step / 32) % 2 === 1) { const g = this.tone(hz(r + l), t, st * 2, 0.045, 'sine', 0, out); if (g && this.verb) g.connect(this.verb); }
      // drums
      if (s.drums !== 'light' || i % 8 === 0) { if (i === 0 || i === 8 || (s.drums === 'full' && i === 10)) { this.tone(120, t, 0.18, 0.5, 'sine', 45, out); } }
      if (i === 4 || i === 12) { if (s.drums === 'brush') this.hiss(t, 0.18, 0.18, 2200, 0.6, 'bandpass', 0, out); else { this.hiss(t, 0.12, 0.3, 1800, 0.8, 'bandpass', 0, out); this.tone(190, t, 0.08, 0.15, 'triangle', 140, out); } }
      if (i % 2 === 0) this.hiss(t, 0.03, i % 4 === 2 ? 0.1 : 0.05, 8000, 0.7, 'highpass', 0, out);
      this.nextAt += st; this.step++;
    }
  }
}

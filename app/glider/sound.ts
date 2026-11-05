// Paperwing Post sounds, all synthesised with WebAudio: the rush of air over the paper rising with speed, a rustle as
// the wings bank, a whoosh and a bright chime when Enzo posts a letter (brighter for a perfect one), a flutter for a
// caught page, a soft airy shimmer when warm air lifts you, a crumple for a knock, a wobble when the glider stalls, a
// splash, a little fanfare for gliding home, and an original lilting waltz (written for this game) with a different
// tune for the morning, the town, the river and the sunset. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'menu' | 'morning' | 'town' | 'river' | 'sunset' | 'ending';
/** a bar is 3 beats of 4 steps (a waltz): chords, a bass line (semitones from the chord's root, -99 rest) and a tune */
const SONGS: Record<SongId, { root: number; bpm: number; chords: number[][]; bass: number[]; lead: number[][] }> = {
  menu: { root: 65, bpm: 128, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[16, -99, -99, -99, 14, -99, 12, -99, 14, -99, -99, -99], [12, -99, -99, -99, 9, -99, -99, -99, 12, -99, 16, -99], [17, -99, -99, -99, 16, -99, 14, -99, 12, -99, -99, -99], [14, -99, -99, -99, -99, -99, 19, -99, 17, -99, -99, -99]] },
  morning: { root: 62, bpm: 136, chords: [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 12, -99, -99, -99],
    lead: [[12, -99, 16, -99, 19, -99, -99, -99, 16, -99, -99, -99], [17, -99, -99, -99, 21, -99, 19, -99, 17, -99, -99, -99], [16, -99, 19, -99, 24, -99, -99, -99, 19, -99, 16, -99], [14, -99, -99, -99, 17, -99, -99, -99, -99, -99, -99, -99]] },
  town: { root: 60, bpm: 144, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[19, -99, -99, -99, 16, -99, 17, -99, 19, -99, -99, -99], [19, -99, 21, -99, 23, -99, -99, -99, 19, -99, -99, -99], [21, -99, -99, -99, 19, -99, 16, -99, 12, -99, -99, -99], [14, -99, 16, -99, 17, -99, -99, -99, 14, -99, -99, -99]] },
  river: { root: 57, bpm: 120, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 12, -99, -99, -99],
    lead: [[15, -99, -99, -99, 12, -99, -99, -99, 10, -99, 12, -99], [8, -99, -99, -99, 12, -99, 15, -99, -99, -99, -99, -99], [17, -99, -99, -99, 15, -99, 14, -99, 15, -99, -99, -99], [14, -99, -99, -99, 10, -99, -99, -99, -99, -99, -99, -99]] },
  sunset: { root: 63, bpm: 112, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[19, -99, -99, -99, -99, -99, 16, -99, 14, -99, 12, -99], [12, -99, -99, -99, 9, -99, -99, -99, 16, -99, -99, -99], [17, -99, -99, -99, 16, -99, 12, -99, 9, -99, -99, -99], [14, -99, -99, -99, -99, -99, 11, -99, -99, -99, -99, -99]] },
  ending: { root: 62, bpm: 150, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[12, -99, 16, -99, 19, -99, 24, -99, 19, -99, 16, -99], [14, -99, 19, -99, 23, -99, -99, -99, 19, -99, -99, -99], [16, -99, 21, -99, 24, -99, 21, -99, 19, -99, 16, -99], [17, -99, 16, -99, 14, -99, 12, -99, -99, -99, -99, -99]] },
};

export class GliderSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private noise: AudioBuffer | null = null; private verb: DelayNode | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private wind: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  private rustle: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.28 : 0; this.mus.connect(comp);
      // a soft echo off the house fronts
      const d = c.createDelay(1); d.delayTime.value = 0.32; const fb = c.createGain(); fb.gain.value = 0.32; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
      d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(comp); this.verb = d;
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, 0.1); }
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
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  private loop(type: BiquadFilterType, f: number, q: number) {
    const c = this.ctx!, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.sfx!); s.start(); return { s, f: fl, g };
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  // ---------------------------------------------------------------- the flight
  /** air over the paper, louder and higher the faster you go, and a rustle while the wings are banked */
  air(speed: number, bank: number) {
    const c = this.ctx; if (!c || !this.sfx || !this.noise) return;
    this.wind ??= this.loop('bandpass', 500, 0.7); this.rustle ??= this.loop('highpass', 3000, 0.8);
    const t = c.currentTime, k = Math.min(1, Math.max(0, (speed - 6) / 20));
    this.wind.f.frequency.setTargetAtTime(300 + k * 1100 + Math.sin(t * 0.7) * 60, t, 0.2); this.wind.g.gain.setTargetAtTime(0.03 + k * 0.12, t, 0.25);
    this.rustle.g.gain.setTargetAtTime(Math.min(0.05, Math.abs(bank) * 0.05) * (0.6 + 0.4 * Math.sin(t * 31)), t, 0.06);
  }
  quiet() { const c = this.ctx; if (!c) return; for (const l of [this.wind, this.rustle]) l?.g.gain.setTargetAtTime(0, c.currentTime, 0.1); }
  launch() { const t = this.now; this.hiss(t, 0.6, 0.25, 600, 0.7, 'bandpass', 2400); [72, 76, 79].forEach((n, i) => this.tone(hz(n), t + 0.1 + i * 0.08, 0.4, 0.08, 'triangle')); }
  post(perfect: boolean) {
    const t = this.now; this.hiss(t, 0.35, 0.18, 2000, 0.8, 'bandpass', 700);
    (perfect ? [79, 83, 86, 91] : [79, 83, 86]).forEach((n, i) => { const g = this.tone(hz(n), t + 0.25 + i * 0.07, 0.7, 0.12, 'sine'); if (g && this.verb) g.connect(this.verb); });
  }
  nopost() { const t = this.now; this.tone(330, t, 0.12, 0.08, 'triangle', 280); }
  page(n: number) { const t = this.now; this.hiss(t, 0.25, 0.12, 4000, 1.2, 'bandpass', 2500); const g = this.tone(hz(84 + (n % 5) * 2), t + 0.05, 0.35, 0.07, 'triangle'); if (g && this.verb) g.connect(this.verb); }
  lift() { const t = this.now; [88, 91, 95].forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.09, 0.9, 0.025, 'sine', 0, this.sfx, 0.2); if (g && this.verb) g.connect(this.verb); }); }
  bump() { const t = this.now; this.hiss(t, 0.3, 0.35, 1400, 0.5, 'bandpass', 500); this.tone(140, t, 0.2, 0.3, 'sine', 70); this.hiss(t + 0.05, 0.2, 0.2, 3000, 0.6, 'highpass'); }
  stall() { const t = this.now; this.tone(hz(74), t, 0.25, 0.08, 'triangle', hz(67)); this.tone(hz(70), t + 0.2, 0.3, 0.08, 'triangle', hz(62)); }
  splash() { const t = this.now; this.hiss(t, 0.8, 0.4, 1800, 0.6, 'bandpass', 400); this.tone(200, t, 0.3, 0.2, 'sine', 80); }
  home() { const t = this.now; [72, 76, 79, 84, 88].forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.1, 0.8, 0.13, 'triangle'); if (g && this.verb) g.connect(this.verb); }); }
  landed() { const t = this.now; this.hiss(t, 0.4, 0.2, 900, 0.6, 'lowpass', 300); [72, 76, 79].forEach((n, i) => this.tone(hz(n), t + 0.2 + i * 0.12, 0.5, 0.1, 'triangle')); }
  sad() { const t = this.now; [72, 69, 65].forEach((n, i) => this.tone(hz(n), t + i * 0.18, 0.4, 0.1, 'triangle')); }
  fold() { const t = this.now; for (let i = 0; i < 3; i++) this.hiss(t + i * 0.12, 0.1, 0.2, 2500 + i * 500, 1, 'bandpass'); this.tone(hz(84), t + 0.4, 0.4, 0.1, 'triangle'); }
  button() { this.tone(880, this.now, 0.05, 0.1, 'sine'); }

  // ---------------------------------------------------------------- music: a music-box waltz
  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song], st = 60 / s.bpm / 4;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step % 12, bar = Math.floor(this.step / 12) % s.chords.length, chord = s.chords[bar], r = s.root, t = this.nextAt, out = this.mus;
      // oom on beat 1 (bass), pah-pah on 2 and 3 (the chord, squeezebox-reedy)
      const b = s.bass[i]; if (b > -50) this.tone(hz(r - 24 + chord[0] + b), t, st * 3, 0.2, 'triangle', 0, out);
      if (i === 4 || i === 8) for (const n of chord) { this.tone(hz(r + n), t, st * 2.4, 0.022, 'sawtooth', 0, out, 0.02); this.tone(hz(r + n + 0.08), t, st * 2.4, 0.016, 'square', 0, out, 0.02); }
      // the tune comes in on the second time round
      const l = s.lead[bar][i]; if (l > -50 && Math.floor(this.step / 48) % 2 === 1) { const g = this.tone(hz(r + l), t, st * 3.2, 0.05, 'triangle', 0, out, 0.02); if (g && this.verb) g.connect(this.verb); }
            this.nextAt += st; this.step++;
    }
  }
}

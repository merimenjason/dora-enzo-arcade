// Cloudberry Balloon sounds, all synthesised with WebAudio: the wind in the rigging rising with the breeze, the burner's
// roar while it's lit, the vent's sigh, a creak of wicker, a bright pluck for each handful of cloudberries, a pop and a
// flutter for a parachute, a cheer of bells for a parcel on the garden, a bump, thunder, the bump of a sandbag, and an
// original folk waltz (written for this game) with a different tune for the valley, the woods, the high places and the
// festival. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'menu' | 'valley' | 'woods' | 'high' | 'storm' | 'ending';
/** a bar is 3 beats of 4 steps (a waltz): chords, a bass line (semitones from the chord's root, -99 rest) and a tune */
const SONGS: Record<SongId, { root: number; bpm: number; chords: number[][]; bass: number[]; lead: number[][] }> = {
  menu: { root: 62, bpm: 132, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[12, -99, -99, -99, 16, -99, 14, -99, 12, -99, -99, -99], [9, -99, -99, -99, 12, -99, 17, -99, 16, -99, -99, -99], [14, -99, -99, -99, 11, -99, 14, -99, 19, -99, -99, -99], [16, -99, 14, -99, 12, -99, -99, -99, -99, -99, -99, -99]] },
  valley: { root: 60, bpm: 138, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[16, -99, -99, -99, 19, -99, 16, -99, 14, -99, 12, -99], [12, -99, -99, -99, 9, -99, -99, -99, 12, -99, 16, -99], [17, -99, -99, -99, 21, -99, 19, -99, 17, -99, 16, -99], [14, -99, -99, -99, -99, -99, 11, -99, 14, -99, -99, -99]] },
  woods: { root: 57, bpm: 120, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 12, -99, -99, -99],
    lead: [[15, -99, -99, -99, 14, -99, 12, -99, 10, -99, -99, -99], [12, -99, -99, -99, 8, -99, -99, -99, 7, -99, -99, -99], [14, -99, -99, -99, 17, -99, 14, -99, 10, -99, -99, -99], [11, -99, -99, -99, -99, -99, 14, -99, -99, -99, -99, -99]] },
  high: { root: 64, bpm: 126, chords: [[0, 4, 7], [5, 9, 12], [2, 5, 9], [7, 11, 14]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[19, -99, -99, -99, -99, -99, 16, -99, 19, -99, 21, -99], [21, -99, -99, -99, 17, -99, -99, -99, 16, -99, -99, -99], [14, -99, -99, -99, 17, -99, 21, -99, 19, -99, 17, -99], [19, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99]] },
  storm: { root: 55, bpm: 112, chords: [[0, 3, 7], [1, 5, 8], [-2, 3, 7], [-5, -2, 2]], bass: [0, -99, 0, -99, 7, -99, -99, -99, 6, -99, -99, -99],
    lead: [[12, -99, -99, -99, 13, -99, 12, -99, -99, -99, -99, -99], [10, -99, -99, -99, -99, -99, 8, -99, 7, -99, -99, -99], [15, -99, -99, -99, 14, -99, 12, -99, -99, -99, -99, -99], [11, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99]] },
  ending: { root: 62, bpm: 150, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[12, -99, 16, -99, 19, -99, 24, -99, 19, -99, 16, -99], [14, -99, 19, -99, 23, -99, -99, -99, 19, -99, -99, -99], [16, -99, 21, -99, 24, -99, 21, -99, 19, -99, 16, -99], [17, -99, 16, -99, 14, -99, 12, -99, -99, -99, -99, -99]] },
};

export class BalloonSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private noise: AudioBuffer | null = null; private verb: DelayNode | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private wind: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  private roar: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  private sigh: { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.28 : 0; this.mus.connect(comp);
      // a long soft echo, like a big valley
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
  /** the wind in the rigging (louder the faster it blows past), the burner's roar and the vent's sigh */
  air(wind: number, burning: boolean, venting: boolean) {
    const c = this.ctx; if (!c || !this.sfx || !this.noise) return;
    this.wind ??= this.loop('bandpass', 500, 0.7); this.roar ??= this.loop('lowpass', 420, 1.2); this.sigh ??= this.loop('bandpass', 1800, 1.4);
    const t = c.currentTime, k = Math.min(1, Math.abs(wind) / 10);
    this.wind.f.frequency.setTargetAtTime(300 + k * 700 + Math.sin(t * 0.7) * 80, t, 0.3); this.wind.g.gain.setTargetAtTime(0.025 + k * 0.07, t, 0.4);
    this.roar.f.frequency.setTargetAtTime(burning ? 520 + Math.sin(t * 23) * 60 : 300, t, 0.05); this.roar.g.gain.setTargetAtTime(burning ? 0.32 : 0, t, burning ? 0.04 : 0.12);
    this.sigh.g.gain.setTargetAtTime(venting ? 0.08 : 0, t, 0.08);
  }
  quiet() { const c = this.ctx; if (!c) return; for (const l of [this.wind, this.roar, this.sigh]) l?.g.gain.setTargetAtTime(0, c.currentTime, 0.1); }
  ignite() { const t = this.now; this.hiss(t, 0.18, 0.3, 2400, 1, 'bandpass', 600); this.tone(80, t, 0.2, 0.2, 'sine', 50); }
  creak() { const t = this.now; this.tone(180 + Math.random() * 60, t, 0.18, 0.05, 'sawtooth', 140); }
  liftoff() { const t = this.now; [72, 76, 79].forEach((n, i) => this.tone(hz(n), t + i * 0.08, 0.4, 0.08, 'triangle')); this.creak(); }
  berry(n: number) { const t = this.now, top = Math.min(4, Math.floor(n / 3)); for (let i = 0; i <= top; i++) { const g = this.tone(hz(81 + [0, 2, 4, 7, 9][i]), t + i * 0.05, 0.4, 0.11, 'triangle'); if (g && this.verb) g.connect(this.verb); } }
  drop() { const t = this.now; this.tone(320, t, 0.08, 0.2, 'square', 200); this.hiss(t + 0.08, 0.5, 0.12, 900, 0.8, 'bandpass', 2400); }
  parcel(hit: 'perfect' | 'good' | 'miss') {
    const t = this.now;
    if (hit === 'miss') { this.tone(220, t, 0.25, 0.15, 'triangle', 150); return; }
    const ns = hit === 'perfect' ? [79, 83, 86, 91] : [79, 83, 86]; ns.forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.07, 0.7, 0.12, 'sine'); if (g && this.verb) g.connect(this.verb); });
  }
  sand() { const t = this.now; this.hiss(t, 0.5, 0.12, 700, 0.8, 'lowpass', 300); this.tone(140, t + 0.4, 0.15, 0.2, 'sine', 70); }
  bump() { const t = this.now; this.tone(110, t, 0.25, 0.4, 'sine', 50); this.hiss(t, 0.2, 0.25, 500, 0.7, 'lowpass', 200); this.creak(); }
  touch(soft: boolean) { const t = this.now; this.tone(soft ? 150 : 100, t, 0.18, 0.3, 'sine', 60); this.hiss(t, 0.25, 0.2, 700, 0.6, 'lowpass', 200); }
  thunder(near: boolean) { const t = this.now; this.hiss(t, near ? 2.2 : 1.6, near ? 0.5 : 0.22, 200, 0.6, 'lowpass', 60); this.tone(55, t, 1.4, near ? 0.35 : 0.12, 'sine', 35); if (near) this.hiss(t, 0.15, 0.4, 3000, 0.5, 'highpass'); }
  splash() { const t = this.now; this.hiss(t, 0.8, 0.4, 1800, 0.6, 'bandpass', 400); this.tone(200, t, 0.3, 0.2, 'sine', 80); }
  refuel() { const t = this.now; [67, 71, 74].forEach((n, i) => this.tone(hz(n), t + i * 0.1, 0.3, 0.1, 'triangle')); }
  lowfuel() { const t = this.now; this.tone(hz(76), t, 0.2, 0.12, 'square'); this.tone(hz(72), t + 0.25, 0.3, 0.12, 'square'); }
  landed() { const t = this.now; [72, 76, 79, 84, 88].forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.1, 0.8, 0.13, 'triangle'); if (g && this.verb) g.connect(this.verb); }); }
  sad() { const t = this.now; [72, 69, 65].forEach((n, i) => this.tone(hz(n), t + i * 0.18, 0.4, 0.1, 'triangle')); }
  button() { this.tone(880, this.now, 0.05, 0.1, 'sine'); }

  // ---------------------------------------------------------------- music: an accordion-ish waltz
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
      if (this.song === 'storm' && i === 0 && bar === 0) this.hiss(t, 1.4, 0.04, 160, 0.6, 'lowpass', 60, out);
      this.nextAt += st; this.step++;
    }
  }
}

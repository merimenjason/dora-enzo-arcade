// The Clocktower Mystery sounds, all synthesised with WebAudio: footsteps and creaking doors, a soft pop for picking
// something up, the clink of metal in dough, a whistle, a splash, a magpie flap, the click of a wheel onto its
// spindle, the great bell, a gentle "no", and original music-box tunes (written for this game) for the title, dusk,
// the night, the hour before dawn and the ending. Silent until the first click, tap or key.
import type { Sfx } from '@/lib/clocktower-game';
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'menu' | 'dusk' | 'night' | 'dawn' | 'ending';
/** a bar is 3 beats of 4 steps (a waltz): chords, a bass line (semitones from the chord's root, -99 rest) and a tune */
const SONGS: Record<SongId, { root: number; bpm: number; chords: number[][]; bass: number[]; lead: number[][] }> = {
  menu: { root: 62, bpm: 104, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[15, -99, 14, -99, 12, -99, -99, -99, 10, -99, 12, -99], [8, -99, -99, -99, 12, -99, 15, -99, -99, -99, -99, -99], [17, -99, 15, -99, 14, -99, 12, -99, 10, -99, -99, -99], [11, -99, -99, -99, 14, -99, -99, -99, -99, -99, -99, -99]] },
  dusk: { root: 65, bpm: 112, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 12, -99, -99, -99],
    lead: [[16, -99, -99, -99, 19, -99, 17, -99, 16, -99, -99, -99], [12, -99, -99, -99, 16, -99, -99, -99, 21, -99, -99, -99], [17, -99, 16, -99, 14, -99, -99, -99, 12, -99, 14, -99], [14, -99, -99, -99, 11, -99, -99, -99, -99, -99, -99, -99]] },
  night: { root: 57, bpm: 96, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[12, -99, -99, -99, 15, -99, -99, -99, 19, -99, -99, -99], [17, -99, -99, -99, 14, -99, -99, -99, 10, -99, -99, -99], [15, -99, -99, -99, 12, -99, 8, -99, -99, -99, -99, -99], [11, -99, -99, -99, 14, -99, -99, -99, -99, -99, -99, -99]] },
  dawn: { root: 60, bpm: 108, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[19, -99, -99, -99, 16, -99, -99, -99, 12, -99, 16, -99], [17, -99, -99, -99, 21, -99, -99, -99, -99, -99, -99, -99], [16, -99, 14, -99, 12, -99, -99, -99, 9, -99, -99, -99], [14, -99, -99, -99, 19, -99, -99, -99, -99, -99, -99, -99]] },
  ending: { root: 62, bpm: 144, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: [0, -99, -99, -99, 7, -99, -99, -99, 7, -99, -99, -99],
    lead: [[12, -99, 16, -99, 19, -99, 24, -99, 19, -99, 16, -99], [14, -99, 19, -99, 23, -99, -99, -99, 19, -99, -99, -99], [16, -99, 21, -99, 24, -99, 21, -99, 19, -99, 16, -99], [17, -99, 16, -99, 14, -99, 12, -99, -99, -99, -99, -99]] },
};

export class ClockSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private noise: AudioBuffer | null = null; private verb: DelayNode | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
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


  // ---------------------------------------------------------------- things happening
  play(k: Sfx) {
    const t = this.now;
    switch (k) {
      case 'pickup': [79, 84, 88].forEach((n, i) => this.tone(hz(n), t + i * 0.06, 0.3, 0.09, 'triangle')); break;
      case 'creak': this.tone(180, t, 0.6, 0.06, 'sawtooth', 120); this.tone(260, t + 0.1, 0.5, 0.03, 'sawtooth', 200); break;
      case 'clink': [96, 100].forEach((n, i) => this.tone(hz(n), t + i * 0.12, 0.25, 0.08, 'sine')); break;
      case 'whistle': [79, 81, 83, 79, 76].forEach((n, i) => this.tone(hz(n), t + i * 0.16, 0.18, 0.07, 'sine')); break;
      case 'splash': this.hiss(t, 0.7, 0.35, 1600, 0.6, 'bandpass', 400); this.tone(220, t, 0.25, 0.15, 'sine', 90); break;
      case 'chime': [84, 88, 91, 96].forEach((n, i) => { const g = this.tone(hz(n), t + i * 0.14, 1.1, 0.07, 'sine'); if (g && this.verb) g.connect(this.verb); }); break;
      case 'nope': this.tone(300, t, 0.14, 0.07, 'triangle', 240); break;
      case 'door': this.hiss(t, 0.18, 0.12, 700, 0.8, 'lowpass', 300); this.tone(110, t + 0.08, 0.12, 0.08, 'sine', 80); break;
      case 'climb': for (let i = 0; i < 4; i++) this.hiss(t + i * 0.11, 0.06, 0.12, 1200, 1.2, 'bandpass'); break;
      case 'flap': for (let i = 0; i < 5; i++) this.hiss(t + i * 0.07, 0.05, 0.18, 2600, 0.9, 'bandpass'); break;
      case 'fit': this.tone(1400, t, 0.05, 0.12, 'square', 900); this.tone(hz(84), t + 0.06, 0.4, 0.06, 'sine'); break;
      case 'bell': for (let i = 0; i < 3; i++) { const g = this.tone(hz(55), t + i * 1.1, 2.4, 0.18, 'sine'); this.tone(hz(67) * 1.01, t + i * 1.1, 1.6, 0.05, 'sine'); if (g && this.verb) g.connect(this.verb); } break;
    }
  }
  step1() { this.hiss(this.now, 0.05, 0.05, 900, 1, 'lowpass'); }
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

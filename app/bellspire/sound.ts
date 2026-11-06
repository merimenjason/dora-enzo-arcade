// The Sunken Bellspire sounds, all synthesised with WebAudio. Original loops in an Andean-chiptune style: a quena-like
// lead (a breathy triangle with vibrato), a charango-like strum (quick plucked square notes), a bombo drum and low pads,
// with one tune per area plus a boss theme and a quiet title theme. Effects for every action. Silent until the first
// click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type Track = 'title' | 'hub' | 'halls' | 'docks' | 'towers' | 'crypt' | 'throne' | 'boss' | 'ending' | 'off';
type Song = { bpm: number; chords: number[][]; bass: number[]; mel: number[]; drum: string; lead: OscillatorType; pad: number };
// melodies are 32 eighths, -1 rests; chords one per 8 eighths
const SONGS: Record<Exclude<Track, 'off'>, Song> = {
  title: { bpm: 72, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bass: [45, 41, 43, 40], drum: 'x.......x.......', lead: 'triangle', pad: 0.03,
    mel: [69, -1, -1, 72, -1, 71, 69, -1, 67, -1, 64, -1, -1, -1, -1, -1, 69, -1, 72, -1, 74, -1, 76, -1, 74, -1, 72, 71, 69, -1, -1, -1] },
  hub: { bpm: 96, chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]], bass: [45, 43, 41, 40], drum: 'x...x.x.x...x.x.', lead: 'triangle', pad: 0.022,
    mel: [76, -1, 74, 72, 71, -1, 72, -1, 74, -1, 71, -1, 67, -1, -1, -1, 72, -1, 71, 69, 67, -1, 69, -1, 71, -1, 68, -1, 64, -1, -1, -1] },
  halls: { bpm: 84, chords: [[50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52]], bass: [38, 36, 34, 33], drum: 'x.......x...x...', lead: 'triangle', pad: 0.03,
    mel: [74, -1, -1, 77, 76, -1, 74, -1, 72, -1, -1, 69, -1, -1, -1, -1, 70, -1, 72, -1, 74, -1, 69, -1, 73, -1, -1, -1, 69, -1, -1, -1] },
  docks: { bpm: 112, chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]], bass: [43, 40, 36, 38], drum: 'x..xx.x.x..xx.x.', lead: 'square', pad: 0.016,
    mel: [79, -1, 78, 76, 74, -1, 76, 78, 79, -1, 74, -1, 71, -1, 72, 74, 76, -1, 74, 72, 71, -1, 72, 74, 76, -1, 74, -1, 71, -1, -1, -1] },
  towers: { bpm: 100, chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]], bass: [40, 36, 38, 35], drum: 'x...x...x...x.xx', lead: 'square', pad: 0.02,
    mel: [76, -1, 79, -1, 78, 76, 74, -1, 76, -1, -1, 71, -1, 74, 72, 71, 72, -1, 74, -1, 76, -1, 74, 72, 71, -1, 69, -1, 71, -1, -1, -1] },
  crypt: { bpm: 70, chords: [[45, 48, 52], [44, 48, 51], [41, 45, 48], [40, 44, 47]], bass: [33, 32, 29, 28], drum: 'x...............', lead: 'triangle', pad: 0.035,
    mel: [69, -1, -1, -1, 72, -1, 71, -1, 68, -1, -1, -1, -1, -1, -1, -1, 64, -1, 65, -1, 68, -1, 71, -1, 69, -1, -1, -1, -1, -1, -1, -1] },
  throne: { bpm: 76, chords: [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 55]], bass: [38, 35, 31, 33], drum: 'x.......x.......', lead: 'triangle', pad: 0.032,
    mel: [78, -1, -1, 76, 74, -1, 73, -1, 74, -1, -1, -1, 69, -1, -1, -1, 71, -1, 73, -1, 74, -1, 76, -1, 73, -1, -1, -1, -1, -1, -1, -1] },
  boss: { bpm: 140, chords: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 53, 57]], bass: [40, 40, 36, 38], drum: 'x.x.x.xxx.x.x.xx', lead: 'square', pad: 0.018,
    mel: [76, 76, -1, 79, -1, 76, 74, -1, 76, -1, 71, -1, 72, 74, 76, -1, 72, -1, 71, -1, 69, -1, 71, 72, 74, -1, 71, -1, 68, -1, 71, -1] },
  ending: { bpm: 80, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass: [48, 45, 41, 43], drum: 'x.......x.......', lead: 'triangle', pad: 0.03,
    mel: [76, -1, 79, -1, 81, -1, 79, 76, 74, -1, 72, -1, 74, -1, -1, -1, 72, -1, 74, -1, 76, -1, 79, -1, 77, -1, 76, -1, 72, -1, -1, -1] },
};

export class BellspireSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private track: Track = 'off';
  private step = 0; private nextAt = 0; private timer: ReturnType<typeof setInterval> | null = null;
  private last = new Map<string, number>();
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; lp.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(lp);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      let seed = 1234; for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
      this.noise = n;
      this.nextAt = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 60);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1); }
  setTrack(t: Track) { if (t !== this.track) { this.track = t; this.step = 0; if (this.ctx) this.nextAt = this.ctx.currentTime + 0.2; } }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { if (this.timer) clearInterval(this.timer); void this.ctx?.close().catch(() => {}); this.ctx = null; }

  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'sine', to = 0, out: AudioNode | null = this.sfx, attack = 0.005, vib = 0) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + len + 0.03); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.03);
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, (t * 7.31) % 1.5); s.stop(t + len + 0.03);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  private schedule() {
    const c = this.ctx; if (!c || !this.mus) return;
    if (this.track === 'off') { this.nextAt = c.currentTime + 0.1; return; }
    const s = SONGS[this.track];
    const beat = 60 / s.bpm / 2;
    while (this.nextAt < c.currentTime + 0.25) {
      const i = this.step % 32, t = this.nextAt, bar = (i / 8) | 0;
      const ch = s.chords[bar];
      if (i % 8 === 0) for (const m of ch) this.tone(hz(m), t, beat * 7.5, s.pad, 'sine', 0, this.mus, 0.15);
      // charango strum on the off-beats
      if (i % 2 === 1 && this.track !== 'crypt' && this.track !== 'title') ch.forEach((m, k) => this.tone(hz(m + 12), t + k * 0.012, beat * 0.5, 0.018, 'square', 0, this.mus, 0.002));
      if (i % 4 === 0) this.tone(hz(s.bass[bar] - (i % 8 === 4 ? -7 : 0)), t, beat * 3, 0.15, 'triangle', 0, this.mus, 0.008);
      if (s.drum[i % 16] === 'x') { this.tone(90, t, 0.18, 0.2, 'sine', 50, this.mus); this.hiss(t, 0.05, 0.02, 1400, 1, 'bandpass', 0, this.mus); }
      const m = s.mel[i];
      if (m > 0) {
        let len = 1; while (i + len < 32 && s.mel[i + len] === -1 && len < 4) len++;
        // the quena: a breathy lead with vibrato
        this.tone(hz(m), t, beat * len * 0.95, s.lead === 'square' ? 0.035 : 0.06, s.lead, 0, this.mus, 0.02, 0.008);
        this.hiss(t, beat * 0.6, 0.006, hz(m) * 2, 3, 'bandpass', 0, this.mus);
      }
      this.nextAt += beat; this.step++;
    }
  }

  /** One sound per game event id; repeats of the same sound are spaced out. */
  play(id: string) {
    const t = this.now;
    if (!this.ctx) return;
    const gap: Record<string, number> = { coin: 0.04, hit: 0.03, land: 0.08, locked: 0.4, swipe: 0.05, crack: 0.05, talk: 0.05 };
    const prev = this.last.get(id) ?? -1;
    if (t - prev < (gap[id] ?? 0.02)) return;
    this.last.set(id, t);
    switch (id) {
      case 'jump': this.tone(330, t, 0.12, 0.08, 'square', 620); break;
      case 'leap': this.tone(440, t, 0.14, 0.08, 'square', 880); this.hiss(t, 0.15, 0.04, 2400, 1, 'bandpass', 4000); break;
      case 'kick': this.tone(260, t, 0.08, 0.08, 'square', 520); this.hiss(t, 0.06, 0.05, 1800); break;
      case 'stroke': this.hiss(t, 0.16, 0.06, 900, 1, 'lowpass', 400); break;
      case 'land': this.hiss(t, 0.06, 0.05, 400, 1, 'lowpass'); break;
      case 'dash': this.hiss(t, 0.22, 0.1, 3000, 0.8, 'bandpass', 900); this.tone(220, t, 0.15, 0.04, 'sawtooth', 110); break;
      case 'splash': this.hiss(t, 0.35, 0.12, 1600, 0.6, 'bandpass', 500); break;
      case 'slash': this.hiss(t, 0.1, 0.1, 5000, 1.5, 'bandpass', 2500); break;
      case 'slash3': this.hiss(t, 0.16, 0.13, 6000, 1.2, 'bandpass', 2000); this.tone(660, t, 0.1, 0.03, 'square', 330); break;
      case 'staff': this.hiss(t, 0.14, 0.09, 1200, 1.2, 'bandpass', 600); this.tone(160, t, 0.08, 0.06, 'triangle', 90); break;
      case 'thrust': this.hiss(t, 0.1, 0.06, 3000, 1.5); break;
      case 'bounce': this.tone(500, t, 0.1, 0.08, 'square', 1000); break;
      case 'hit': this.tone(180, t, 0.08, 0.12, 'square', 70); this.hiss(t, 0.06, 0.08, 2000); break;
      case 'crit': this.tone(240, t, 0.12, 0.14, 'square', 60); this.hiss(t, 0.1, 0.1, 3000); this.tone(1200, t, 0.08, 0.04, 'square'); break;
      case 'bosshit': this.tone(120, t, 0.12, 0.14, 'square', 50); this.hiss(t, 0.08, 0.1, 1500); break;
      case 'poof': this.hiss(t, 0.3, 0.09, 1200, 0.5, 'bandpass', 300); this.tone(600, t, 0.2, 0.04, 'triangle', 1200); break;
      case 'hurt': this.tone(400, t, 0.2, 0.12, 'square', 120); break;
      case 'down': this.tone(440, t, 0.6, 0.1, 'triangle', 110); break;
      case 'wipe': [69, 65, 62, 57].forEach((m, i) => this.tone(hz(m), t + i * 0.18, 0.4, 0.08, 'triangle')); break;
      case 'coin': this.tone(hz(88), t, 0.06, 0.05, 'square'); this.tone(hz(93), t + 0.05, 0.12, 0.05, 'square'); break;
      case 'mp': this.tone(hz(84), t, 0.1, 0.05, 'sine', hz(91)); break;
      case 'chest': [72, 76, 79, 84].forEach((m, i) => this.tone(hz(m), t + i * 0.07, 0.25, 0.06, 'square')); break;
      case 'item': [76, 79, 83].forEach((m, i) => this.tone(hz(m), t + i * 0.09, 0.3, 0.06, 'triangle')); break;
      case 'heart': [72, 76, 79, 84, 88].forEach((m, i) => this.tone(hz(m), t + i * 0.08, 0.35, 0.06, 'triangle')); break;
      case 'relic': [67, 71, 74, 79, 83, 86].forEach((m, i) => this.tone(hz(m), t + i * 0.1, 0.6, 0.07, 'triangle', 0, this.sfx, 0.01, 0.01)); break;
      case 'level': [72, 79, 84, 91].forEach((m, i) => this.tone(hz(m), t + i * 0.06, 0.25, 0.06, 'square')); break;
      case 'bell': case 'toll': [0, 0.01].forEach((d, k) => { this.tone(hz(57 + k * 12), t + d, 2.2, 0.16 - k * 0.08, 'sine'); this.tone(hz(57) * 2.76, t, 1.2, 0.04, 'sine'); this.tone(hz(57) * 5.4, t, 0.6, 0.02, 'sine'); }); break;
      case 'chime': [84, 88, 91, 96].forEach((m, i) => this.tone(hz(m), t + i * 0.05, 1.2, 0.05, 'sine')); break;
      case 'clang': this.tone(hz(69) * 2.76, t, 0.6, 0.08, 'sine'); this.tone(hz(69), t, 0.8, 0.08, 'sine'); this.hiss(t, 0.08, 0.08, 3000); break;
      case 'shrine': [67, 72, 76, 79].forEach((m, i) => this.tone(hz(m), t + i * 0.12, 1, 0.06, 'sine')); break;
      case 'door': this.tone(110, t, 0.3, 0.1, 'sawtooth', 70); this.hiss(t, 0.3, 0.05, 600, 1, 'lowpass'); break;
      case 'locked': this.tone(150, t, 0.1, 0.08, 'square'); this.tone(130, t + 0.1, 0.14, 0.08, 'square'); break;
      case 'tag': this.tone(hz(76), t, 0.08, 0.06, 'square'); this.tone(hz(83), t + 0.06, 0.12, 0.06, 'square'); break;
      case 'bolt': this.tone(700, t, 0.18, 0.06, 'sawtooth', 300); this.hiss(t, 0.15, 0.04, 2500); break;
      case 'ember': [60, 64, 67, 72].forEach((m, i) => this.tone(hz(m), t + i * 0.04, 0.5, 0.05, 'sawtooth')); this.hiss(t, 0.6, 0.06, 900); break;
      case 'whirl': this.hiss(t, 0.4, 0.1, 2500, 1, 'bandpass', 5000); break;
      case 'fizzle': this.hiss(t, 0.2, 0.05, 900, 1, 'lowpass'); break;
      case 'lanternUp': this.tone(hz(72), t, 0.3, 0.05, 'triangle', hz(84)); this.hiss(t, 0.3, 0.03, 1500); break;
      case 'lanternDown': this.tone(hz(72), t, 0.25, 0.05, 'triangle', hz(60)); break;
      case 'candle': this.tone(hz(91), t, 0.08, 0.03, 'sine'); break;
      case 'crack': this.hiss(t, 0.08, 0.1, 1200, 2); break;
      case 'break': this.hiss(t, 0.5, 0.15, 800, 0.6, 'lowpass', 200); this.tone(90, t, 0.3, 0.12, 'square', 40); break;
      case 'talk': this.tone(hz(76 + Math.floor(Math.random() * 5)), t, 0.04, 0.03, 'square'); break;
      case 'mural': [64, 67, 71].forEach((m, i) => this.tone(hz(m), t + i * 0.12, 0.8, 0.04, 'sine')); break;
      case 'buy': this.tone(hz(84), t, 0.08, 0.05, 'square'); this.tone(hz(91), t + 0.07, 0.15, 0.05, 'square'); break;
      case 'equip': this.hiss(t, 0.08, 0.06, 3000); this.tone(hz(79), t, 0.1, 0.04, 'square'); break;
      case 'eat': this.tone(300, t, 0.08, 0.06, 'triangle', 200); this.tone(320, t + 0.12, 0.08, 0.06, 'triangle', 220); break;
      case 'warp': this.tone(200, t, 0.5, 0.06, 'sine', 1600); break;
      case 'tell': this.tone(hz(88), t, 0.12, 0.06, 'square'); this.tone(hz(88), t + 0.14, 0.12, 0.06, 'square'); break;
      case 'phase': this.tone(80, t, 0.8, 0.14, 'sawtooth', 40); break;
      case 'calm': [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => this.tone(hz(m), t + i * 0.12, 0.8, 0.06, 'triangle')); break;
      case 'quake': case 'smash': this.tone(60, t, 0.4, 0.2, 'sine', 30); this.hiss(t, 0.3, 0.1, 300, 1, 'lowpass'); break;
      case 'spit': case 'throw': this.hiss(t, 0.15, 0.06, 1500, 1, 'bandpass', 600); break;
      case 'tongue': case 'snap': this.tone(300, t, 0.08, 0.08, 'square', 120); break;
      case 'roar': this.hiss(t, 0.5, 0.12, 500, 0.7, 'bandpass', 200); this.tone(110, t, 0.4, 0.08, 'sawtooth', 70); break;
      case 'hop': this.tone(160, t, 0.12, 0.08, 'triangle', 320); break;
      case 'whoosh': this.hiss(t, 0.12, 0.05, 1200, 1); break;
      case 'bubble': [0, 0.08, 0.16].forEach((d) => this.tone(500 + d * 2000, t + d, 0.08, 0.04, 'sine', 900)); break;
      case 'flood': this.hiss(t, 1.2, 0.08, 400, 0.5, 'lowpass', 900); break;
      case 'caw': this.tone(900, t, 0.2, 0.05, 'sawtooth', 500); break;
      case 'hiss': this.hiss(t, 0.3, 0.04, 4000, 2); break;
      case 'ring': this.tone(hz(84), t, 0.3, 0.04, 'sine'); break;
      case 'stone': this.tone(70, t, 0.3, 0.1, 'square', 40); break;
      case 'pop': this.tone(900, t, 0.05, 0.05, 'sine', 400); break;
      case 'swipe': this.hiss(t, 0.08, 0.05, 4000, 1.5); break;
      case 'menu': this.tone(hz(84), t, 0.05, 0.04, 'square'); break;
      default: break;
    }
  }
}

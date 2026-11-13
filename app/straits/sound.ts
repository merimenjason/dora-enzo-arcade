// Little Red Dot: The Straits sounds, all synthesised with WebAudio: the wash of the sea and the rush of the hull
// through it, a jaunty sailing tune that gives way to a faster one when something is chasing you, and every effect
// (peanut volleys, clams, hits, bumps, a raft going under, seeds, the ram, the sail going up and down, jetties, Captain
// Bishan's hail, an island sighted, capsizing, and the end of the voyage). Silent until the first input.
import type { Ev } from '@/lib/straits-game';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;
type Tune = { bpm: number; wave: OscillatorType; mel: (number | null)[]; bass: number[]; vol: number; dec: number; drums: boolean };
const TUNES: Record<'sail' | 'fight', Tune> = {
  sail: { bpm: 104, wave: 'triangle', vol: 0.085, dec: 0.42, drums: false,
    mel: [74, _, 76, 74, 71, _, 67, _, 69, 71, 74, _, 71, 69, 67, _, 74, _, 76, 79, 76, _, 74, _, 71, 74, 71, 69, 67, _, _, _],
    bass: [43, 50, 40, 47, 43, 50, 45, 50] },
  fight: { bpm: 138, wave: 'square', vol: 0.04, dec: 0.2, drums: true,
    mel: [76, 79, 83, 79, 76, 79, 81, 79, 74, 78, 81, 78, 74, 78, 79, 78, 76, 79, 83, 86, 83, 81, 79, 76, 75, 78, 81, 78, 76, _, 76, _],
    bass: [40, 40, 43, 43, 38, 38, 35, 35] },
};

export class StraitsSound {
  ac: AudioContext | null = null; sfxOn = true; musicOn = true;
  private master: GainNode | null = null; private music: GainNode | null = null; private bus: GainNode | null = null;
  private wash: GainNode | null = null; private rush: GainNode | null = null; private noise: AudioBuffer | null = null;
  private tune: 'sail' | 'fight' = 'sail'; private nextT = 0; private stepN = 0; private timer: ReturnType<typeof setInterval> | null = null; private duck = 1;

  /** The first input unlocks audio. Safe to call again. */
  start() {
    if (this.ac) { if (this.ac.state === 'suspended') void this.ac.resume(); return; }
    try { this.ac = new AudioContext(); } catch { return; }
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = 0.8; this.master.connect(ac.destination);
    this.music = ac.createGain(); this.music.gain.value = this.musicOn ? 1 : 0; this.music.connect(this.master);
    this.bus = ac.createGain(); this.bus.gain.value = this.sfxOn ? 1 : 0; this.bus.connect(this.master);
    const buf = this.noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the sea: low noise that swells and falls; the hull: brighter noise that rises with speed
    const loop = (freq: number, type: BiquadFilterType, q: number) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.bus!); s.start(); return g; };
    this.wash = loop(420, 'lowpass', 0.4); this.rush = loop(1500, 'bandpass', 0.6);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.17; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(this.wash.gain); lfo.start(); this.wash.gain.value = 0.06;
    this.nextT = ac.currentTime + 0.1; this.timer = setInterval(() => this.sched(), 40);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; void this.ac?.close(); this.ac = null; }
  setSfx(on: boolean) { this.sfxOn = on; if (this.bus && this.ac) this.bus.gain.setTargetAtTime(on ? 1 : 0, this.ac.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.music && this.ac) this.music.gain.setTargetAtTime(on ? this.duck : 0, this.ac.currentTime, 0.1); }

  /** Called every frame: how fast the boat is going (0 to 1), whether something is after you, and whether play is held (talk, jetty, pause). */
  update(speed: number, danger: boolean, held: boolean) {
    const ac = this.ac; if (!ac || !this.rush || !this.music) return;
    this.rush.gain.setTargetAtTime(held ? 0 : 0.012 + speed * 0.07, ac.currentTime, 0.25);
    const want = danger && !held ? 'fight' : 'sail'; if (want !== this.tune) { this.tune = want; this.stepN = 0; }
    const duck = held ? 0.35 : 1; if (duck !== this.duck) { this.duck = duck; if (this.musicOn) this.music.gain.setTargetAtTime(duck, ac.currentTime, 0.2); }
  }

  private sched() {
    const ac = this.ac; if (!ac || !this.music) return; const T = TUNES[this.tune], dur = 60 / T.bpm / 2;
    if (this.nextT < ac.currentTime) this.nextT = ac.currentTime + 0.05;
    while (this.nextT < ac.currentTime + 0.15) {
      const i = this.stepN % T.mel.length, t = this.nextT, m = T.mel[i];
      if (m !== null) this.tone(this.music, T.wave, mtof(m), t, T.dec, T.vol);
      if (i % 4 === 0) this.tone(this.music, 'triangle', mtof(T.bass[(i / 4) % T.bass.length]), t, dur * 3.4, T.vol * 1.5);
      if (T.drums) { if (i % 8 === 0) this.tone(this.music, 'sine', 110, t, 0.14, 0.22, 45); if (i % 8 === 4) this.hiss(this.music, t, 0.09, 0.07, 1800); if (i % 2 === 1) this.hiss(this.music, t, 0.03, 0.025, 6000); }
      this.stepN++; this.nextT += dur;
    }
  }
  private tone(out: AudioNode, wave: OscillatorType, f: number, t: number, dec: number, vol: number, to?: number) {
    const ac = this.ac!, o = ac.createOscillator(), g = ac.createGain(); o.type = wave; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dec);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.03);
  }
  private hiss(out: AudioNode, t: number, dec: number, vol: number, freq: number, type: BiquadFilterType = 'highpass') {
    const ac = this.ac!, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = this.noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dec + 0.03);
  }
  private notes(ms: number[], wave: OscillatorType, gap: number, dec: number, vol: number) { const ac = this.ac, b = this.bus; if (!ac || !b) return; ms.forEach((m, i) => this.tone(b, wave, mtof(m), ac.currentTime + i * gap, dec, vol)); }

  /** One of the engine's events. */
  fx(e: Ev) {
    const ac = this.ac, b = this.bus; if (!ac || !b) return; const t = ac.currentTime;
    switch (e.k) {
      case 'volley': for (let i = 0; i < 3; i++) { this.tone(b, 'square', 520 - i * 40, t + i * 0.045, 0.07, 0.07, 180); this.hiss(b, t + i * 0.045, 0.05, 0.05, 2500); } break;
      case 'clam': this.tone(b, 'sine', 300, t, 0.16, 0.06, 620); break;
      case 'hit': if (e.mine) { this.tone(b, 'triangle', 240, t, 0.1, 0.12, 90); this.hiss(b, t, 0.12, 0.08, 900, 'lowpass'); } else { this.tone(b, 'sawtooth', 150, t, 0.2, 0.13, 55); this.hiss(b, t, 0.18, 0.12, 700, 'lowpass'); } break;
      case 'bump': this.tone(b, 'sine', 95, t, 0.22, 0.3, 40); this.hiss(b, t, 0.15, 0.1, 500, 'lowpass'); break;
      case 'sink': this.hiss(b, t, 0.9, 0.22, 1100, 'lowpass'); this.tone(b, 'sine', 320, t, 0.8, 0.12, 60); if (e.kind !== 'raft') this.notes([67, 71, 74, 79], 'triangle', 0.09, 0.3, 0.11); break;
      case 'loot': this.notes([84, 88, 91], 'sine', 0.06, 0.18, 0.1); break;
      case 'capsize': this.hiss(b, t, 1.2, 0.25, 800, 'lowpass'); this.notes([67, 63, 60, 55], 'triangle', 0.14, 0.35, 0.12); break;
      case 'dock': this.notes([79, 83], 'sine', 0.18, 0.9, 0.1); break;
      case 'talk': this.notes([62, 65, 62, 58], 'sawtooth', 0.11, 0.16, 0.07); break;
      case 'found': this.notes([72, 79], 'triangle', 0.12, 0.4, 0.09); break;
      case 'say': this.notes([76], 'sine', 0, 0.2, 0.05); break;
      case 'won': this.notes([67, 71, 74, 79, 74, 79, 83], 'triangle', 0.13, 0.5, 0.13); break;
      case 'lost': this.notes([64, 62, 59, 55, 52], 'triangle', 0.2, 0.6, 0.12); break;
    }
  }
  /** The sail going up or down a gear. */
  gear(up: boolean) { const ac = this.ac, b = this.bus; if (!ac || !b) return; this.hiss(b, ac.currentTime, 0.22, 0.07, up ? 1400 : 800, 'bandpass'); this.tone(b, 'triangle', up ? 330 : 262, ac.currentTime, 0.09, 0.05); }
  /** The ram's burst of speed. */
  ram() { const ac = this.ac, b = this.bus; if (!ac || !b) return; this.hiss(b, ac.currentTime, 0.7, 0.16, 1200, 'bandpass'); this.tone(b, 'sawtooth', 110, ac.currentTime, 0.5, 0.06, 330); }
  /** A button, an answer, something bought. */
  ui(good = true) { this.notes(good ? [72, 76] : [60], 'sine', 0.05, 0.12, 0.07); }
}

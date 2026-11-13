// The Arcade After Dark sounds, all synthesised with WebAudio: a little tune per world (the hub's night waltz, the
// sea's slow chords with bubbles, the castle's square-wave march, the cloud fortress's sparkles, the Deep, the secret
// room, the giant's drum-driven theme and the healed hub in a brighter key) and every effect (the ping's rising
// chirps, the sweep's whoosh and chime, the gust, the Static's crackle and dissolve, knocks, slams and roars).
// Silent until the first input. Ported from the prototype's audio.js.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
type Tune = { bpm: number; wave: OscillatorType; mel: (number | null)[]; bass: number[]; vol: number; dec: number; pad?: number[][]; drone?: boolean; sparkle?: boolean; bubbles?: boolean; drums?: boolean };
const _ = null;
const HUBM = [74, 77, 81, 77, 76, 79, 81, 79, 74, 77, 81, 84, 81, 79, 77, 76, 72, 76, 79, 76, 74, 77, 81, 77, 70, 74, 77, 74, 69, 73, 76, 81];
const TUNES: Record<string, Tune> = {
  hub: { bpm: 84, wave: 'triangle', mel: HUBM, bass: [50, 50, 48, 48, 48, 50, 46, 45], vol: 0.09, dec: 0.5 },
  healed: { bpm: 96, wave: 'triangle', mel: HUBM.map((n) => (n === 77 ? 78 : n === 72 ? 73 : n === 84 ? 85 : n === 70 ? 71 : n)), bass: [50, 50, 47, 47, 45, 50, 43, 45], vol: 0.1, dec: 0.45, sparkle: true },
  sea: { bpm: 64, wave: 'sine', mel: [77, _, 81, _, 84, _, 88, _, 86, _, 84, _, 81, _, 79, _, 76, _, 79, _, 83, _, 86, _, 84, _, 81, _, 77, _, _, _],
    bass: [41, 41, 40, 40, 38, 38, 36, 36], vol: 0.1, dec: 1.3, pad: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]], bubbles: true },
  castle: { bpm: 116, wave: 'square', mel: [67, 71, 74, 71, 72, 76, 74, 71, 69, 72, 71, 67, 65, 69, 67, _, 67, 71, 74, 79, 77, 74, 72, 71, 69, 72, 74, 72, 71, 67, 67, _],
    bass: [43, 43, 48, 43, 43, 50, 41, 43], vol: 0.045, dec: 0.28, drone: true },
  cloud: { bpm: 100, wave: 'triangle', mel: [79, 83, 86, 91, 88, 86, 83, 86, 81, 84, 88, 93, 91, 88, 84, 88, 79, 83, 86, 90, 88, 86, 83, 79, 81, 84, 88, 86, 83, 81, 79, _],
    bass: [55, 55, 52, 52, 48, 48, 50, 50], vol: 0.07, dec: 0.6, pad: [[67, 71, 74, 78], [64, 67, 71, 74], [60, 64, 67, 71], [62, 66, 69, 72]], sparkle: true },
  deep: { bpm: 56, wave: 'sine', mel: [69, _, _, 72, _, _, 76, _, 74, _, _, 72, _, _, 69, _, 67, _, _, 71, _, _, 74, _, 72, _, _, 69, _, _, _, _],
    bass: [33, 33, 31, 31, 29, 29, 28, 28], vol: 0.09, dec: 1.6, pad: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]], bubbles: true },
  boss: { bpm: 138, wave: 'square', mel: [62, 65, 69, 65, 62, 65, 70, 69, 62, 65, 69, 74, 72, 70, 69, 65, 60, 64, 67, 64, 60, 64, 69, 67, 61, 64, 67, 73, 72, 70, 69, 64],
    bass: [38, 38, 34, 34, 36, 36, 37, 37], vol: 0.045, dec: 0.22, drone: true, drums: true },
  room: { bpm: 72, wave: 'triangle', mel: [67, _, 71, _, 74, _, 79, _, 77, _, 74, _, 72, _, 71, _, 69, _, 72, _, 76, _, 74, _, 71, _, 67, _, _, _, _, _],
    bass: [43, 43, 48, 48, 41, 41, 43, 43], vol: 0.08, dec: 0.9 },
};

export class AfterDarkSound {
  ac: AudioContext | null = null; master: GainNode | null = null; music: GainNode | null = null; bus: GainNode | null = null;
  sfxOn = true; musicOn = true;
  private tune: string | null = null; private want: string | null = null; private nextT = 0; private stepN = 0; private timer: ReturnType<typeof setInterval> | null = null;

  /** the first input unlocks audio */
  start() {
    if (this.ac) { if (this.ac.state === 'suspended') void this.ac.resume(); return; }
    try { this.ac = new AudioContext(); } catch { return; }
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = 0.8; this.master.connect(ac.destination);
    this.music = ac.createGain(); this.music.gain.value = this.musicOn ? 1 : 0; this.music.connect(this.master);
    this.bus = ac.createGain(); this.bus.connect(this.master);
    this.timer = setInterval(() => this.sched(), 40);
    if (this.want) this.play(this.want);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; void this.ac?.close(); this.ac = null; }
  setMusic(on: boolean) { this.musicOn = on; if (this.music && this.ac) this.music.gain.setValueAtTime(on ? 1 : 0, this.ac.currentTime); }
  play(name: string | null) {
    this.want = name;
    const ac = this.ac;
    if (!ac || this.tune === name) return;
    this.tune = name; this.stepN = 0;
    if (!this.musicOn) return;
    this.music!.gain.cancelScheduledValues(ac.currentTime);
    this.music!.gain.setValueAtTime(0, ac.currentTime); this.music!.gain.linearRampToValueAtTime(1, ac.currentTime + 0.8);
    this.nextT = ac.currentTime + 0.1;
  }
  private note(m: number, t: number, dur: number, wave: OscillatorType, vol: number, dest?: AudioNode | null, attack = 0.01) {
    const ac = this.ac!, o = ac.createOscillator(), g = ac.createGain();
    o.type = wave; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    if (wave === 'square') { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(dest || this.music!); o.start(t); o.stop(t + dur + 0.05);
  }
  private sched() {
    const ac = this.ac; if (!ac || !this.tune || !this.musicOn) return;
    const T = TUNES[this.tune]; if (!T) return;
    const sp = 60 / T.bpm / 2;
    if (this.nextT < ac.currentTime) this.nextT = ac.currentTime + 0.05;
    while (this.nextT < ac.currentTime + 0.25) {
      const i = this.stepN % T.mel.length, t = this.nextT, m = T.mel[i];
      if (m) this.note(m, t, T.dec, T.wave, T.vol);
      if (i % 4 === 0) {
        const b = T.bass[(i / 4) % T.bass.length];
        this.note(b, t, sp * 4, 'sine', T.vol * 1.3, null, 0.03);
        if (T.drone) this.note(b + 7, t, sp * 4, 'triangle', T.vol * 0.5, null, 0.05);
      }
      if (T.pad && i % 8 === 0) for (const p of T.pad[(i / 8) % T.pad.length]) this.note(p, t, sp * 8.5, 'sine', T.vol * 0.22, null, 0.5);
      if (T.sparkle && i % 2 === 1 && Math.random() < 0.35) this.note(86 + [0, 3, 7, 10, 12][Math.floor(Math.random() * 5)], t, 0.3, 'sine', T.vol * 0.35);
      if (T.bubbles && Math.random() < 0.12) this.blip(t, this.music!);
      if (T.drums) { if (i % 4 === 0) this.kick(t); if (i % 4 === 2) this.hat(t); }
      this.nextT += sp; this.stepN++;
    }
  }
  private noise(dur: number) {
    const ac = this.ac!, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b; return s;
  }
  private blip(t: number, dest: AudioNode) {
    const ac = this.ac!, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    const f0 = 300 + Math.random() * 500; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.08);
    g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.1); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.12);
  }
  private kick(t: number) { const ac = this.ac!, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); g.connect(this.music!); o.start(t); o.stop(t + 0.18); }
  private hat(t: number) { const ac = this.ac!, s = this.noise(0.05), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.connect(f); f.connect(g); g.connect(this.music!); s.start(t); }
  /** a burst of noise through a filter */
  private hiss(dur: number, type: BiquadFilterType, f0: number, f1: number, at: number, vol: number, q?: number) {
    const ac = this.ac!, t = ac.currentTime, s = this.noise(dur), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; if (q) f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + at);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.92); s.connect(f); f.connect(g); g.connect(this.bus!); s.start(t);
  }
  private sweepTone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) {
    const ac = this.ac!, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.bus!); o.start(t); o.stop(t + dur + 0.02);
  }
  sfx(n: string, v?: number) {
    if (!this.ac || !this.sfxOn) return;
    try { this.fx(n, v); } catch { /* a sound never stops the game */ }
  }
  private fx(n: string, v?: number) {
    const ac = this.ac!, t = ac.currentTime, bus = this.bus!;
    const seq = (ms: number[], gap: number, dur: number, wave: OscillatorType, vol: number) => ms.forEach((m, i) => this.note(m, t + i * gap, dur, wave, vol, bus));
    switch (n) {
      case 'ping':
        for (let k = 0; k < 4; k++) {
          const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
          o.frequency.setValueAtTime(1046, t + k * 0.22); o.frequency.exponentialRampToValueAtTime(1568, t + k * 0.22 + 0.12);
          g.gain.setValueAtTime(0.0001, t + k * 0.22); g.gain.linearRampToValueAtTime(0.16 / (k + 1), t + k * 0.22 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0005, t + k * 0.22 + 0.5); o.connect(g); g.connect(bus); o.start(t + k * 0.22); o.stop(t + k * 0.22 + 0.55);
        }
        break;
      case 'sweep': this.hiss(0.5, 'bandpass', 400, 4000, 0.3, 0.25, 2); for (const [m, d] of [[79, 0], [83, 0.05], [86, 0.1], [91, 0.15]]) this.note(m, t + d + 0.08, 0.9, 'sine', 0.07, bus); break;
      case 'crackle': this.hiss(0.12, 'highpass', 2500, 2600, 0.1, v ?? 0.08); break;
      case 'dissolve': this.hiss(1.2, 'highpass', 800, 8000, 1, 0.18); [84, 88, 91, 96].forEach((m, i) => this.note(m, t + 0.3 + i * 0.08, 0.8, 'triangle', 0.05, bus)); break;
      case 'jump': this.sweepTone('square', 330, 660, 0.14, 0.04); break;
      case 'enter': seq([60, 64, 67, 72, 76, 79, 84, 88], 0.06, 0.35, 'triangle', 0.07); this.hiss(1.3, 'lowpass', 300, 6000, 1.1, 0.1); break;
      case 'exit': seq([88, 84, 79, 76, 72, 67], 0.06, 0.3, 'triangle', 0.06); break;
      case 'hurt': this.sweepTone('sawtooth', 420, 140, 0.3, 0.06); this.hiss(0.12, 'highpass', 2500, 2600, 0.1, 0.12); break;
      case 'gain': for (const [m, d] of [[67, 0], [71, 0.12], [74, 0.24], [79, 0.36], [83, 0.5], [86, 0.5], [91, 0.5]]) this.note(m, t + d, 1.2, 'triangle', 0.08, bus); break;
      case 'reveal': seq([76, 81, 83, 88, 93], 0.07, 1, 'sine', 0.07); break;
      case 'knock': for (let k = 0; k < 2; k++) this.sweepTone('sine', 140, 70, 0.14, 0.2, k * 0.16); break;
      case 'swap': this.note(79, t, 0.15, 'triangle', 0.06, bus); this.note(86, t + 0.07, 0.2, 'triangle', 0.06, bus); break;
      case 'pearl': this.note(91, t, 0.5, 'sine', 0.08, bus); this.note(96, t + 0.08, 0.6, 'sine', 0.07, bus); break;
      case 'nope': this.note(55, t, 0.15, 'triangle', 0.06, bus); this.note(52, t + 0.1, 0.2, 'triangle', 0.06, bus); break;
      case 'gust': this.hiss(0.7, 'bandpass', 300, 1800, 0.25, 0.3, 1.2); this.note(84, t + 0.05, 0.4, 'sine', 0.04, bus); this.note(91, t + 0.12, 0.4, 'sine', 0.035, bus); break;
      case 'whoosh': this.hiss(0.9, 'lowpass', 2500, 200, 0.8, 0.25); break;
      case 'clank': this.note(76, t, 0.25, 'square', 0.03, bus); this.note(83, t + 0.03, 0.25, 'square', 0.03, bus); break;
      case 'chime': seq([88, 93, 100], 0.05, 0.8, 'sine', 0.05); break;
      case 'roar': this.sweepTone('sawtooth', 90, 60, 1.1, 0.12); this.hiss(1.2, 'lowpass', 700, 650, 1, 0.08); break;
      case 'slam': this.sweepTone('sine', 110, 35, 0.4, 0.35); this.hiss(0.12, 'highpass', 2500, 2600, 0.1, 0.15); break;
      case 'tell': this.note(70, t, 0.3, 'triangle', 0.05, bus); this.note(73, t + 0.15, 0.3, 'triangle', 0.05, bus); break;
      case 'heal': seq([62, 66, 69, 74, 78, 81, 86, 90], 0.14, 1.6, 'triangle', 0.07); break;
    }
  }
}

// Kumori Pass sounds, all synthesised with WebAudio: a two-oscillator engine whose pitch follows the revs through a
// low-pass that opens with the throttle, a turbo whistle and blow-off once the big intake is fitted, backfire pops when
// you lift at high revs, a tyre squeal of filtered noise that rises with the slide, guardrail crunches and scrapes,
// the gutter's clack, a bun bouncing off the seat, gear-change clunks, Enzo's and Dora's chirpy speech blips, and an
// original driving synth soundtrack (bass, arps, a lead and drums, written for this game). Silent until the first
// click, tap or key; closed when the page goes.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const _ = -99;
export type SongId = 'menu' | 'drive' | 'duel' | 'fog' | 'dawn' | 'ending' | 'garage';
type Song = { bpm: number; root: number; prog: number[]; bass: number[]; arp: number[]; lead: number[]; drums: string; minor: boolean; bright: number };
// scale degrees; prog is one chord root per bar (4 bars), bass/arp are 16 steps per bar, lead is 32 steps over two bars
const SONGS: Record<SongId, Song> = {
  menu: { bpm: 96, root: 57, minor: true, bright: 0.6, prog: [0, 5, 3, 4], bass: [0, _, _, 0, _, _, 7, _, 0, _, _, 0, _, 7, _, 5], arp: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7],
    lead: [7, _, _, 9, 7, _, 4, _, 2, _, 4, _, _, _, _, _, 7, _, _, 9, 11, _, 9, _, 7, _, 4, _, 2, _, _, _], drums: 'k...h...s...h.h.' },
  drive: { bpm: 138, root: 52, minor: true, bright: 1, prog: [0, 5, 6, 4], bass: [0, 0, 7, 0, 0, 7, 0, 7, 0, 0, 7, 0, 10, 7, 5, 7], arp: [0, 4, 7, 11, 7, 4, 0, 4, 7, 11, 14, 11, 7, 4, 7, 11],
    lead: [14, _, 12, _, 11, _, 7, _, 9, _, _, 7, _, _, _, _, 14, _, 16, _, 14, _, 12, _, 11, _, 12, _, 9, _, _, _], drums: 'k.h.s.hkk.h.s.hh' },
  duel: { bpm: 150, root: 50, minor: true, bright: 1.1, prog: [0, 6, 5, 4], bass: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 10, 12, 10], arp: [0, 7, 12, 7, 3, 7, 12, 15, 0, 7, 12, 7, 5, 7, 12, 14],
    lead: [12, _, _, 15, _, _, 14, _, 12, _, 10, _, 12, _, _, _, 7, _, _, 10, _, _, 12, _, 14, _, 15, _, 14, _, 12, _], drums: 'k.hsk.hsk.hsk.ss' },
  fog: { bpm: 112, root: 55, minor: true, bright: 0.5, prog: [0, 3, 5, 4], bass: [0, _, _, _, 0, _, _, 7, 0, _, _, _, 5, _, _, 7], arp: [0, 7, 12, 14, 12, 7, 3, 7, 0, 7, 12, 15, 12, 7, 5, 7],
    lead: [_, _, 12, _, _, _, 10, _, 7, _, _, _, _, _, _, _, _, _, 12, _, _, _, 14, _, 15, _, 14, _, 12, _, _, _], drums: 'k.......s.....h.' },
  dawn: { bpm: 128, root: 57, minor: false, bright: 1, prog: [0, 4, 5, 3], bass: [0, 0, 7, 0, 0, 7, 0, 7, 0, 0, 7, 0, 9, 7, 4, 7], arp: [0, 4, 7, 11, 14, 11, 7, 4, 0, 4, 7, 11, 14, 16, 14, 11],
    lead: [16, _, 14, _, 11, _, 14, _, 16, _, _, 19, _, _, _, _, 16, _, 14, _, 11, _, 9, _, 11, _, 14, _, 12, _, _, _], drums: 'k.h.s.hkk.h.s.hh' },
  ending: { bpm: 84, root: 60, minor: false, bright: 0.5, prog: [0, 5, 3, 4], bass: [0, _, _, _, 7, _, _, _, 0, _, _, _, 7, _, 4, _], arp: [0, 4, 7, 11, 12, 11, 7, 4, 0, 4, 7, 11, 12, 14, 12, 11],
    lead: [11, _, _, 12, 14, _, _, _, 11, _, 9, _, 7, _, _, _, 9, _, _, 11, 12, _, _, 14, 16, _, 14, _, 12, _, _, _], drums: 'k.......s.......' },
  garage: { bpm: 104, root: 53, minor: false, bright: 0.7, prog: [0, 3, 4, 3], bass: [0, _, 0, _, 7, _, 0, _, 0, _, 0, _, 9, _, 7, _], arp: [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 4, 9, 11, 9, 7],
    lead: [_, _, _, _, 9, _, 7, _, 4, _, 7, _, _, _, _, _, _, _, _, _, 9, _, 11, _, 12, _, 11, _, 9, _, _, _], drums: 'k...s.h.k.k.s.h.' },
};
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];

export class PassSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null; private eng: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private last = new Map<string, number>();
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  // the engine voice
  private o1: OscillatorNode | null = null; private o2: OscillatorNode | null = null; private lp: BiquadFilterNode | null = null; private eg: GainNode | null = null;
  private sq: AudioBufferSourceNode | null = null; private sqF: BiquadFilterNode | null = null; private sqG: GainNode | null = null;
  private tb: OscillatorNode | null = null; private tbG: GainNode | null = null;
  private lastThrottle = 0; private lastRpm = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.eng = c.createGain(); this.eng.gain.value = this.soundOn ? 1 : 0; this.eng.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.22 : 0; this.mus.connect(comp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; const c = this.ctx; if (c) for (const g of [this.sfx, this.eng]) g?.gain.setTargetAtTime(on ? 1 : 0, c.currentTime, 0.03); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }
  private ok(key: string, gap: number) {
    const c = this.ctx; if (!c || !this.soundOn) return false;
    const t = c.currentTime; if ((this.last.get(key) ?? -1) > t - gap) return false; this.last.set(key, t); return true;
  }
  private tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = 0.004) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  private hiss(out: AudioNode, dur: number, level: number, freq: number, q = 1, at = 0, sweep = 0, type: BiquadFilterType = 'bandpass') {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = Math.max(c.currentTime, at || c.currentTime);
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur); f.Q.value = q;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, (freq % 7) / 10); s.stop(t + dur + 0.05);
  }

  // ---- the running engine, squeal and turbo
  startEngine() {
    const c = this.ctx; if (!c || this.o1) return;
    this.o1 = c.createOscillator(); this.o2 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2.type = 'square';
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 3; this.lp.frequency.value = 600;
    this.eg = c.createGain(); this.eg.gain.value = 0;
    const g2 = c.createGain(); g2.gain.value = 0.45;
    this.o1.connect(this.lp); this.o2.connect(g2); g2.connect(this.lp); this.lp.connect(this.eg); this.eg.connect(this.eng!);
    this.o1.start(); this.o2.start();
    this.sq = c.createBufferSource(); this.sq.buffer = this.noise; this.sq.loop = true;
    this.sqF = c.createBiquadFilter(); this.sqF.type = 'bandpass'; this.sqF.frequency.value = 1700; this.sqF.Q.value = 7;
    this.sqG = c.createGain(); this.sqG.gain.value = 0;
    this.sq.connect(this.sqF); this.sqF.connect(this.sqG); this.sqG.connect(this.eng!); this.sq.start();
    this.tb = c.createOscillator(); this.tb.type = 'sine'; this.tbG = c.createGain(); this.tbG.gain.value = 0; this.tb.connect(this.tbG); this.tbG.connect(this.eng!); this.tb.start();
  }
  stopEngine() {
    for (const n of [this.o1, this.o2, this.sq, this.tb]) { try { n?.stop(); } catch { /* already stopped */ } }
    this.o1 = this.o2 = this.tb = null; this.sq = null;
  }
  /** Call each frame while racing. */
  engine(rpm: number, throttle: number, slide: number, turbo: boolean, slow: number) {
    const c = this.ctx; if (!c || !this.o1) return;
    const t = c.currentTime, f = (rpm / 60) * 2 * slow; // a four-cylinder fires twice per revolution
    this.o1.frequency.setTargetAtTime(Math.max(20, f), t, 0.03); this.o2!.frequency.setTargetAtTime(Math.max(20, f * 0.5), t, 0.03);
    this.lp!.frequency.setTargetAtTime(300 + throttle * 1500 + rpm * 0.12, t, 0.05);
    this.eg!.gain.setTargetAtTime(0.05 + throttle * 0.07 + Math.min(0.04, rpm / 200000), t, 0.05);
    this.sqG!.gain.setTargetAtTime(Math.max(0, Math.min(1, slide)) * 0.16, t, 0.06);
    this.sqF!.frequency.setTargetAtTime(1400 + slide * 900, t, 0.08);
    if (turbo) { this.tb!.frequency.setTargetAtTime(2400 + rpm * 0.6, t, 0.2); this.tbG!.gain.setTargetAtTime(throttle * Math.max(0, rpm - 3500) / 4100 * 0.025, t, 0.25); }
    // lifting off at high revs: pops from the exhaust (and a blow-off with the turbo)
    if (this.lastThrottle > 0.6 && throttle < 0.2 && this.lastRpm > 5200) { this.backfire(); if (turbo) this.blowoff(); }
    this.lastThrottle = throttle; this.lastRpm = rpm;
  }
  quietEngine() { const c = this.ctx; if (!c || !this.eg) return; this.eg.gain.setTargetAtTime(0, c.currentTime, 0.1); this.sqG!.gain.setTargetAtTime(0, c.currentTime, 0.05); this.tbG!.gain.setTargetAtTime(0, c.currentTime, 0.05); }
  backfire() { if (!this.ok('pop', 0.12)) return; const c = this.ctx!; for (let i = 0; i < 3; i++) { this.hiss(this.sfx!, 0.06, 0.5, 300 + i * 90, 0.8, c.currentTime + i * 0.07); this.tone(this.sfx!, 'square', 90, 50, 0.05, 0.12, c.currentTime + i * 0.07); } }
  blowoff() { if (!this.ok('bov', 0.4)) return; this.hiss(this.sfx!, 0.35, 0.2, 3000, 2, 0, 0.4, 'highpass'); }
  // ---- one-shots
  wall(mag: number) { if (!this.ok('wall', 0.12)) return; const l = Math.min(0.6, 0.15 + mag * 0.04); this.tone(this.sfx!, 'sine', 120, 45, 0.3, l); this.hiss(this.sfx!, 0.3, l, 900, 0.7); this.tone(this.sfx!, 'square', 1400, 900, 0.25, l * 0.15); }
  scrape() { if (!this.ok('scrape', 0.07)) return; this.hiss(this.sfx!, 0.09, 0.12, 4200, 3); }
  bump(mag: number) { if (!this.ok('bump', 0.15)) return; this.tone(this.sfx!, 'triangle', 160, 80, 0.2, Math.min(0.4, 0.1 + mag * 0.05)); this.hiss(this.sfx!, 0.15, 0.2, 1200, 1); }
  shift() { if (!this.ok('shift', 0.1)) return; this.tone(this.sfx!, 'square', 220, 140, 0.05, 0.06); this.hiss(this.sfx!, 0.04, 0.08, 2600, 2); }
  hook() { if (!this.ok('hook', 0.3)) return; const c = this.ctx!; for (let i = 0; i < 4; i++) this.tone(this.sfx!, 'square', 500, 300, 0.03, 0.08, c.currentTime + i * 0.05); }
  bun() { if (!this.ok('bun', 0.12)) return; this.tone(this.sfx!, 'sine', 520, 260, 0.18, 0.2); this.tone(this.sfx!, 'sine', 900, 1300, 0.1, 0.06); }
  boost() { if (!this.ok('boost', 0.4)) return; this.hiss(this.sfx!, 0.6, 0.2, 800, 1, 0, 3); this.tone(this.sfx!, 'sawtooth', 220, 440, 0.4, 0.05); }
  driftStart() { if (!this.ok('dstart', 0.4)) return; this.tone(this.sfx!, 'triangle', 660, 990, 0.12, 0.05); }
  count(go: boolean) { this.tone(this.sfx!, 'square', go ? 1320 : 660, go ? 1320 : 660, go ? 0.5 : 0.18, 0.12); this.tone(this.sfx!, 'sine', go ? 2640 : 1320, go ? 2640 : 1320, go ? 0.4 : 0.12, 0.05); }
  button() { if (!this.ok('button', 0.05)) return; this.tone(this.sfx!, 'triangle', 1200, 900, 0.05, 0.08); this.tone(this.sfx!, 'sine', 2400, 2350, 0.08, 0.03); }
  whoosh() { if (!this.ok('whoosh', 0.3)) return; this.hiss(this.sfx!, 0.55, 0.35, 600, 0.8, 0, 6); this.tone(this.sfx!, 'sawtooth', 110, 55, 0.5, 0.06); }
  stinger(win: boolean) {
    if (!this.ok('stinger', 1)) return; const c = this.ctx!;
    (win ? [0, 4, 7, 12, 16] : [7, 3, 0, -5]).forEach((d, i) => { this.tone(this.sfx!, 'sawtooth', hz(64 + d), hz(64 + d), 0.4, 0.06, c.currentTime + i * 0.11); this.tone(this.sfx!, 'square', hz(76 + d), hz(76 + d), 0.3, 0.03, c.currentTime + i * 0.11); });
  }
  /** Chirpy speech blips for a line of dialogue: Enzo high and quick, Dora a little lower, rivals by species. */
  voice(who: string, text: string) {
    if (!this.ok('voice', 0.15)) return; const c = this.ctx!;
    const base = who === 'enzo' ? 980 : who === 'dora' ? 720 : who === 'goat' ? 300 : who === 'badger' ? 360 : who === 'bat' ? 1300 : who === 'pika' ? 1150 : 560;
    const n = Math.min(9, Math.max(3, Math.round(text.length / 6)));
    for (let i = 0; i < n; i++) {
      const ch = text.charCodeAt((i * 5) % Math.max(1, text.length)) || 70;
      const f = base * (1 + ((ch % 7) - 3) * 0.06);
      this.tone(this.sfx!, who === 'enzo' ? 'square' : 'triangle', f, f * (i === n - 1 && /[!?]/.test(text) ? 1.35 : 0.92), 0.06, 0.05, c.currentTime + i * 0.075);
    }
  }
  // ---- music
  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = this.ctx ? this.ctx.currentTime + 0.1 : 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.musicOn || c.state !== 'running') return;
    const S = SONGS[this.song], st = 60 / S.bpm / 4, sc = S.minor ? MIN : MAJ;
    const deg = (root: number, d: number) => root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const semi = (root: number, s: number) => root + s;
    if (this.nextAt < c.currentTime - 0.5) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.25) {
      const k = this.step % 64, bar = Math.floor(k / 16), i = k % 16, at = this.nextAt;
      const chord = deg(S.root, S.prog[bar]);
      const b = S.bass[i]; if (b !== _) { this.tone(this.mus!, 'sawtooth', hz(semi(chord - 12, b)), hz(semi(chord - 12, b)), st * 1.6, 0.16, at, 0.005); }
      const a = S.arp[i]; if (a !== _) this.tone(this.mus!, 'square', hz(semi(chord + 12, a)), hz(semi(chord + 12, a)), st * 0.9, 0.035 * S.bright, at, 0.002);
      const l = S.lead[k % 32]; if (l !== _) { const f = hz(deg(S.root + 12, l)); this.tone(this.mus!, 'sawtooth', f, f, st * 3.2, 0.06 * S.bright, at, 0.01); this.tone(this.mus!, 'sine', f * 2, f * 2, st * 2.5, 0.025, at, 0.01); }
      const d = S.drums[i];
      if (d === 'k') this.tone(this.mus!, 'sine', 140, 45, 0.18, 0.4, at, 0.002);
      else if (d === 's') { this.hiss(this.mus!, 0.14, 0.22, 1800, 0.7, at); this.tone(this.mus!, 'triangle', 220, 160, 0.08, 0.08, at); }
      else if (d === 'h') this.hiss(this.mus!, 0.04, 0.08, 8000, 1.5, at, 0, 'highpass');
      this.step++; this.nextAt += st;
    }
  }
}

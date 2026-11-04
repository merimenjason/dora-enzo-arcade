// Fluffball Smash! sounds, all synthesised with WebAudio: the racket's pop (brighter for a harder hit), the ball's
// bounce and the net's rattle, line calls, a crowd that roars for a winner, the charge-up hum, the rising sweep and
// power chord of a special move, the clang of a counter, fire, ice and wind, everyone's chirpy speech blips, and an
// original sports-anime soundtrack (written for this game). Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const _ = -99;
export type SongId = 'menu' | 'match' | 'final' | 'ending';
type Song = { bpm: number; root: number; prog: number[]; bass: number[]; arp: number[]; lead: number[]; drums: string; minor: boolean };
const SONGS: Record<SongId, Song> = {
  menu: { bpm: 120, root: 60, minor: false, prog: [0, 3, 4, 3], bass: [0, _, 0, _, 7, _, 0, _, 0, _, 0, _, 9, _, 7, _], arp: [0, 4, 7, 12, 7, 4, 0, 4, 0, 4, 7, 12, 14, 12, 7, 4],
    lead: [12, _, 14, _, 16, _, 19, _, 16, _, 14, _, 12, _, _, _, 14, _, 16, _, 17, _, 16, _, 14, _, 11, _, 12, _, _, _], drums: 'k.h.s.h.k.k.s.h.' },
  match: { bpm: 152, root: 57, minor: true, prog: [0, 5, 3, 4], bass: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 10, 12, 10], arp: [0, 3, 7, 12, 7, 3, 0, 3, 7, 10, 12, 15, 12, 10, 7, 3],
    lead: [12, _, _, 15, _, 14, 12, _, 10, _, 12, _, _, _, _, _, 15, _, _, 17, _, 15, 14, _, 12, _, 14, _, 15, _, _, _], drums: 'k.hsk.hsk.hsk.ss' },
  final: { bpm: 164, root: 55, minor: true, prog: [0, 6, 5, 4], bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 10, 10, 7, 7], arp: [0, 7, 12, 15, 12, 7, 3, 7, 0, 7, 12, 15, 17, 15, 12, 7],
    lead: [19, _, 17, _, 15, _, 14, 15, _, _, 12, _, _, _, _, _, 15, _, 17, _, 19, _, 22, _, 19, _, 17, _, 15, _, 14, _], drums: 'kkhsk.hskkhsk.sss' },
  ending: { bpm: 96, root: 62, minor: false, prog: [0, 4, 5, 3], bass: [0, _, _, _, 7, _, _, _, 0, _, _, _, 5, _, 7, _], arp: [0, 4, 7, 11, 12, 11, 7, 4, 0, 4, 7, 11, 14, 11, 7, 4],
    lead: [16, _, _, 14, 12, _, _, _, 11, _, 12, _, 14, _, _, _, 16, _, _, 17, 19, _, _, 16, 14, _, 12, _, 11, _, 12, _], drums: 'k...s...k.k.s...' },
};
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const PITCH: Record<string, number> = { dora: 660, enzo: 520, bramble: 720, sable: 760, sorrel: 700, gale: 300, marlow: 240, fern: 380, ember: 620, isolde: 480, narrator: 400 };

export class SmashSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  private hum: { o: OscillatorNode; g: GainNode } | null = null;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.2 : 0; this.mus.connect(comp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.03); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.05); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  // ---------------------------------------------------------------- building blocks
  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'sine', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  // ---------------------------------------------------------------- effects
  hit(power: number, smash: boolean) {
    const t = this.now;
    this.tone(320 + power * 260, t, 0.08, 0.5, 'triangle', 140);
    this.hiss(t, 0.06, 0.4 + power * 0.3, 2400 + power * 1800, 1.5);
    if (smash) { this.hiss(t, 0.25, 0.35, 900, 0.8, 'lowpass', 200); this.tone(110, t, 0.2, 0.4, 'sine', 50); }
  }
  bounce(z: number) { const t = this.now; this.tone(180, t, 0.07, 0.25 + Math.min(0.2, z * 0.05), 'sine', 90); this.hiss(t, 0.04, 0.12, 1200, 2); }
  net() { const t = this.now; this.hiss(t, 0.25, 0.3, 700, 3); this.tone(140, t, 0.18, 0.2, 'square', 90); }
  call(kind: 'out' | 'fault' | 'let') { const t = this.now; this.tone(kind === 'let' ? 900 : 1100, t, 0.12, 0.25, 'square'); if (kind !== 'let') this.tone(820, t + 0.13, 0.16, 0.22, 'square'); }
  crowd(big: boolean) { const t = this.now; this.hiss(t, big ? 1.8 : 1.0, big ? 0.32 : 0.18, 1000, 0.4); this.hiss(t + 0.05, big ? 1.4 : 0.8, big ? 0.18 : 0.1, 2600, 0.6); }
  ready() { const t = this.now; [0, 4, 7, 12].forEach((s, i) => this.tone(hz(76 + s), t + i * 0.06, 0.2, 0.18, 'square')); }
  special(fire: boolean, ice: boolean) {
    const t = this.now;
    this.hiss(t, 1.0, 0.45, 300, 1, 'bandpass', 6000);
    this.tone(110, t, 1.1, 0.25, 'sawtooth', 440);
    // the power chord as the cut-in lands
    for (const s of [0, 7, 12, 16]) this.tone(hz(52 + s), t + 0.35, 0.9, 0.12, 'sawtooth');
    if (fire) this.hiss(t + 0.3, 1.0, 0.35, 500, 0.6, 'lowpass', 1800);
    if (ice) for (let i = 0; i < 8; i++) this.tone(hz(88 + (i * 5) % 12), t + 0.3 + i * 0.07, 0.25, 0.08, 'triangle');
  }
  counter() { const t = this.now; this.tone(1400, t, 0.5, 0.35, 'square', 700); this.tone(1960, t, 0.4, 0.2, 'square', 900); this.hiss(t, 0.4, 0.4, 3000, 1); }
  blown() { const t = this.now; this.hiss(t, 0.5, 0.5, 600, 0.5, 'lowpass', 120); this.tone(220, t, 0.5, 0.3, 'sawtooth', 60); }
  wind() { const t = this.now; this.hiss(t, 1.2, 0.25, 400, 2, 'bandpass', 1400); }
  stinger(win: boolean) {
    const t = this.now, seq = win ? [0, 4, 7, 12, 16] : [7, 3, 0, -5];
    seq.forEach((s, i) => this.tone(hz(64 + s), t + i * 0.12, 0.4, 0.2, 'square'));
  }
  /** the charge-up hum while a swing is readied */
  charge(on: boolean, k: number) {
    const c = this.ctx; if (!c || !this.sfx) return;
    if (on && !this.hum) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; g.gain.value = 0; o.connect(g); g.connect(this.sfx); o.start(); this.hum = { o, g }; }
    if (!this.hum) return;
    this.hum.o.frequency.setTargetAtTime(180 + k * 260, c.currentTime, 0.03);
    this.hum.g.gain.setTargetAtTime(on ? 0.05 + k * 0.05 : 0, c.currentTime, 0.04);
    if (!on) { const h = this.hum; this.hum = null; setTimeout(() => { try { h.o.stop(); } catch { /* already stopped */ } }, 200); }
  }
  voice(who: string, text: string) {
    const t = this.now, base = PITCH[who] ?? 500, n = Math.min(10, Math.ceil(text.length / 6));
    for (let i = 0; i < n; i++) this.tone(base * (1 + Math.sin(i * 2.3) * 0.12), t + i * 0.07, 0.06, 0.08, who === 'narrator' ? 'sine' : 'triangle');
  }
  button() { this.tone(880, this.now, 0.05, 0.12, 'triangle'); }

  // ---------------------------------------------------------------- music
  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  /** schedule the next notes; call every frame */
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song], st = 60 / s.bpm / 4;
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    const scale = s.minor ? MIN : MAJ, deg = (n: number) => { const o = Math.floor(n / 7), i = ((n % 7) + 7) % 7; return scale[i] + 12 * o; };
    while (this.nextAt < c.currentTime + 0.15) {
      const i = this.step, bar = Math.floor(i / 16) % 4, k = i % 16, chord = deg(s.prog[bar]), t = this.nextAt;
      const b = s.bass[k]; if (b !== _) this.tone(hz(s.root - 24 + chord + b), t, st * 1.8, 0.35, 'triangle', 0, this.mus);
      const a = s.arp[k]; if (a !== _) this.tone(hz(s.root + chord + a), t, st * 0.9, 0.08, 'square', 0, this.mus);
      const l = s.lead[i % 32]; if (l !== _) this.tone(hz(s.root + deg(l)), t, st * 2.4, 0.13, 'sawtooth', 0, this.mus);
      const d = s.drums[k % s.drums.length];
      if (d === 'k') this.tone(140, t, 0.12, 0.6, 'sine', 45, this.mus);
      if (d === 's') this.hiss(t, 0.12, 0.3, 1800, 0.8, 'bandpass', 0, this.mus);
      if (d === 'h' || d === 's') this.hiss(t, 0.03, 0.12, 8000, 1, 'highpass', 0, this.mus);
      this.nextAt += st; this.step++;
    }
  }
}

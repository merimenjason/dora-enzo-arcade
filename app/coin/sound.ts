// Coin of the Realm sounds, all synthesised with WebAudio: the clink and whoosh of the coin changing paws, a shop
// bell when an order is filled, a huff from a grumpy seller, the Mayor's handbell, the Miser's sock, the Gossip's
// quack, the Pedlar's jingle, the Juggler's spin, a soft chime when Enzo overhears, Grumble footsteps and the snatch, a
// night chime at dusk and a cockerel at dawn, a fanfare when the bridge is built, Enzo's chirpy voice, and an
// original chiptune soundtrack written for this game: a title tune, a market-day bounce, a creepier loop for Grumble
// Hollow and an ending. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'title' | 'market' | 'hollow' | 'ending';
/** per song: seconds a step, root note, chord roots for a four-bar loop, a bass line and a lead (-99 is a rest) */
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean }> = {
  title: { step: 0.16, root: 67, chords: [0, 5, 2, 7], bass: [0, -99, 7, -99, 12, -99, 7, 4], lead: [12, 14, 16, 19, 16, -99, 14, 12, 9, -99, 12, -99, 7, -99, -99, -99], drums: false },
  market: { step: 0.13, root: 60, chords: [0, 5, 7, 0], bass: [0, 7, 12, 7, 0, 7, 12, 7], lead: [16, -99, 19, 16, 21, -99, 19, -99, 16, 14, 12, -99, 14, -99, 16, -99], drums: true },
  hollow: { step: 0.15, root: 57, chords: [0, 1, -2, 0], bass: [0, -99, 0, 7, -99, 6, -99, 3], lead: [12, -99, 13, -99, 15, -99, 13, 12, -99, -99, 10, -99, 12, -99, -99, -99], drums: true },
  ending: { step: 0.17, root: 65, chords: [0, 5, 9, 7], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 16, 19, 24, 21, 19, 16, -99, 14, 16, 19, -99, 24, -99, -99, -99], drums: false },
};

export class CoinSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private song: SongId | null = null; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.55; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(comp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; data[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1); }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'square', to = 0, out: AudioNode | null = this.sfx, attack = 0.004) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  /** the coin changes paws: a clink, a whoosh over the roofs, a clink */
  pass(far: boolean) { const t = this.now, l = far ? 0.42 : 0.28; this.tone(hz(96), t, 0.05, 0.08, 'square'); this.hiss(t + 0.03, l, 0.1, 1800, 1.2, 'bandpass', 600); this.tone(hz(100), t + l, 0.12, 0.1, 'square'); this.tone(hz(107), t + l + 0.04, 0.18, 0.06, 'triangle'); }
  order() { const t = this.now; this.tone(hz(88), t, 0.4, 0.14, 'triangle'); this.tone(hz(93), t + 0.09, 0.5, 0.12, 'triangle'); [76, 79, 84].forEach((n, i) => this.tone(hz(n), t + 0.18 + i * 0.06, 0.14, 0.08, 'square')); }
  grumpy() { const t = this.now; this.hiss(t, 0.25, 0.2, 500, 0.8, 'lowpass', 200); this.tone(160, t, 0.25, 0.12, 'sawtooth', 110); }
  mayor() { const t = this.now; for (let i = 0; i < 3; i++) { this.tone(hz(84), t + i * 0.16, 0.3, 0.1, 'triangle'); this.tone(hz(91), t + i * 0.16, 0.2, 0.04, 'sine'); } }
  miser() { const t = this.now; this.hiss(t, 0.15, 0.3, 300, 0.8, 'lowpass'); this.tone(90, t, 0.2, 0.25, 'sine', 60); this.tone(hz(84), t + 0.25, 0.3, 0.1, 'triangle'); }
  gossip() { const t = this.now; for (let i = 0; i < 2; i++) this.tone(700, t + i * 0.13, 0.09, 0.12, 'sawtooth', 450); }
  pedlar() { const t = this.now; for (let i = 0; i < 6; i++) this.tone(hz(90 + (i % 3) * 2), t + i * 0.04, 0.08, 0.06, 'square'); }
  juggler() { const t = this.now; for (let i = 0; i < 8; i++) this.tone(hz(72 + i * 2), t + i * 0.035, 0.05, 0.06, 'triangle'); }
  hear() { const t = this.now; this.tone(hz(83), t, 0.3, 0.06, 'sine'); this.tone(hz(90), t + 0.08, 0.35, 0.05, 'sine'); }
  grumble() { const t = this.now; this.tone(95, t, 0.12, 0.16, 'sawtooth', 70); this.hiss(t, 0.08, 0.1, 400, 1, 'lowpass'); }
  snatch() { const t = this.now; this.hiss(t, 0.2, 0.3, 1500, 1.5, 'bandpass', 3500); this.tone(400, t, 0.3, 0.16, 'sawtooth', 120); this.tone(hz(60), t + 0.3, 0.5, 0.12, 'triangle', hz(48)); }
  dusk() { const t = this.now; [79, 76, 72, 67].forEach((n, i) => this.tone(hz(n), t + i * 0.18, 0.5, 0.07, 'sine')); }
  dawn() { const t = this.now; this.tone(hz(79), t, 0.12, 0.08, 'square', hz(86)); this.tone(hz(86), t + 0.14, 0.12, 0.08, 'square'); this.tone(hz(88), t + 0.28, 0.35, 0.08, 'square', hz(84)); }
  wait() { const t = this.now; this.tone(1200, t, 0.03, 0.06, 'square'); this.tone(900, t + 0.25, 0.03, 0.06, 'square'); }
  flip() { const t = this.now; for (let i = 0; i < 5; i++) this.tone(hz(96 + (i % 2) * 3), t + i * 0.05, 0.04, 0.06, 'square'); }
  bridge() { const t = this.now; for (let i = 0; i < 4; i++) this.tone(120, t + i * 0.12, 0.08, 0.25, 'square', 70); [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => this.tone(hz(n), t + 0.5 + i * 0.1, 0.25, 0.13, 'square')); }
  fail() { const t = this.now; [67, 64, 60].forEach((n, i) => this.tone(hz(n), t + i * 0.12, 0.25, 0.12, 'triangle')); }
  pick() { const t = this.now; [79, 84, 91].forEach((n, i) => this.tone(hz(n), t + i * 0.05, 0.2, 0.12, 'triangle')); }
  enzo(text: string) { const t = this.now, n = Math.min(8, Math.ceil(text.length / 9)); for (let i = 0; i < n; i++) this.tone(520 + ((text.charCodeAt(i * 3) || 70) % 7) * 40, t + i * 0.07, 0.05, 0.05, 'square'); }
  stinger(good: boolean) { const t = this.now; (good ? [72, 76, 79, 84, 88] : [72, 69, 65, 60]).forEach((n, i) => this.tone(hz(n), t + i * 0.13, 0.4, 0.15, 'square')); }
  button() { this.tone(1100, this.now, 0.04, 0.08, 'square'); }

  music(id: SongId | null) { if (this.song === id) return; this.song = id; this.step = 0; this.nextAt = 0; }
  pump() {
    const c = this.ctx; if (!c || !this.song || !this.mus || !this.musicOn) return;
    const s = SONGS[this.song];
    if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step, t = this.nextAt, root = s.root + s.chords[Math.floor(i / 16) % s.chords.length];
      const b = s.bass[i % s.bass.length]; if (b > -50) this.tone(hz(root - 24 + b), t, s.step * 0.9, 0.22, 'triangle', 0, this.mus);
      const l = s.lead[i % s.lead.length]; if (l > -50) this.tone(hz(root + l), t, s.step * 0.8, 0.07, 'square', 0, this.mus, 0.003);
      if (s.drums) {
        if (i % 4 === 0) this.tone(120, t, 0.1, 0.32, 'sine', 45, this.mus);
        if (i % 4 === 2) this.hiss(t, 0.06, 0.15, 3000, 0.8, 'highpass', 0, this.mus);
        if (i % 8 === 4) this.hiss(t, 0.12, 0.25, 1200, 0.6, 'bandpass', 0, this.mus);
      }
      this.nextAt += s.step; this.step++;
    }
  }
}

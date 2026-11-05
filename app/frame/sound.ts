// Out of Frame sounds, all synthesised with WebAudio: Dora's hop and jump, the bump of a landing, a squashed Grumble,
// the twang of an arrow and the thunk when it sticks, a boulder's rumble, the crack of a falling rock, crumbling floor,
// splashes, pickups, the camera's shutter when a screen is done, a tick of the clock when the film runs low, Enzo's
// chirpy voice, and an original chiptune soundtrack written for this game: a title tune, one loop for each of the three
// places and an ending. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'title' | 'ruins' | 'cave' | 'temple' | 'ending';
/** per song: seconds a step, root note, chord roots for a four-bar loop, a bass line and a lead (-99 is a rest) */
const SONGS: Record<SongId, { step: number; root: number; chords: number[]; bass: number[]; lead: number[]; drums: boolean }> = {
  title: { step: 0.16, root: 62, chords: [0, 7, 9, 5], bass: [0, -99, 7, -99, 12, -99, 7, 5], lead: [12, 14, 16, -99, 19, -99, 16, 14, 12, -99, 9, 12, 14, -99, -99, -99], drums: false },
  ruins: { step: 0.13, root: 60, chords: [0, -3, 5, 7], bass: [0, 7, 12, 7, 0, 7, 12, 10], lead: [12, -99, 16, 19, 21, 19, 16, -99, 14, 16, 12, -99, 9, -99, 12, 14], drums: true },
  cave: { step: 0.15, root: 57, chords: [0, 3, -2, 5], bass: [0, -99, 0, 7, -99, 7, 12, -99], lead: [15, -99, 19, -99, 22, 19, -99, 15, 17, -99, 14, -99, 12, -99, -99, 10], drums: true },
  temple: { step: 0.12, root: 55, chords: [0, 5, 3, 7], bass: [0, 0, 12, 0, 10, 0, 12, 7], lead: [12, 15, 17, 19, -99, 19, 22, 19, 17, -99, 15, 17, 12, -99, 10, 12], drums: true },
  ending: { step: 0.17, root: 65, chords: [0, 5, 9, 7], bass: [0, -99, 7, 12, 0, -99, 7, 12], lead: [12, 16, 19, 24, 21, 19, 16, -99, 14, 16, 19, -99, 24, -99, -99, -99], drums: false },
};

export class FrameSound {
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

  jump() { this.tone(300, this.now, 0.14, 0.12, 'square', 700); }
  hop() { this.tone(400, this.now, 0.07, 0.06, 'square', 600); }
  land() { this.hiss(this.now, 0.06, 0.12, 600, 0.8, 'lowpass'); }
  stomp() { const t = this.now; this.tone(500, t, 0.1, 0.2, 'square', 150); this.hiss(t, 0.12, 0.2, 900, 0.8); this.tone(700, t + 0.06, 0.1, 0.1, 'square', 1100); }
  hurt() { const t = this.now; this.tone(420, t, 0.25, 0.28, 'sawtooth', 130); this.hiss(t, 0.15, 0.2, 1500, 1); }
  splash() { const t = this.now; this.hiss(t, 0.45, 0.35, 1800, 0.7, 'bandpass', 400); this.tone(700, t, 0.4, 0.1, 'triangle', 150); }
  acorn() { const t = this.now; this.tone(hz(84), t, 0.06, 0.1, 'square'); this.tone(hz(91), t + 0.05, 0.1, 0.1, 'square'); }
  film() { const t = this.now; for (let i = 0; i < 6; i++) this.tone(900 + i * 60, t + i * 0.03, 0.03, 0.06, 'square'); this.tone(hz(88), t + 0.2, 0.15, 0.1, 'triangle'); }
  heart() { const t = this.now; [76, 81, 88].forEach((n, i) => this.tone(hz(n), t + i * 0.06, 0.15, 0.12, 'square')); }
  arrow() { const t = this.now; this.tone(180, t, 0.12, 0.12, 'triangle', 90); this.hiss(t, 0.18, 0.1, 3000, 2, 'bandpass', 1200); }
  stick() { const t = this.now; this.tone(220, t, 0.05, 0.15, 'square', 120); this.hiss(t, 0.04, 0.12, 2000, 1); }
  tink() { const t = this.now; this.tone(2400, t, 0.06, 0.1, 'square', 1800); }
  boulder() { const t = this.now; this.hiss(t, 0.4, 0.2, 200, 0.6, 'lowpass', 120); this.tone(70, t, 0.35, 0.2, 'sine', 50); }
  drop() { const t = this.now; this.tone(900, t, 0.06, 0.1, 'square', 500); this.hiss(t, 0.1, 0.12, 2500, 1); }
  crash() { const t = this.now; this.hiss(t, 0.3, 0.3, 700, 0.6, 'lowpass', 150); this.tone(110, t, 0.2, 0.25, 'square', 50); }
  crumble() { const t = this.now; for (let i = 0; i < 3; i++) this.hiss(t + i * 0.05, 0.08, 0.15, 500 + i * 250, 2); }
  freeze() { this.tone(1600, this.now, 0.03, 0.03, 'square'); }
  /** the camera's shutter and a little fanfare */
  clear() {
    const t = this.now; this.hiss(t, 0.04, 0.4, 3000, 0.7, 'highpass'); this.hiss(t + 0.07, 0.05, 0.3, 2000, 0.7, 'highpass');
    [72, 76, 79, 84].forEach((n, i) => this.tone(hz(n), t + 0.15 + i * 0.08, 0.2, 0.12, 'square'));
  }
  low() { this.tone(880, this.now, 0.06, 0.06, 'square'); }
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

// Tembusu sounds, soft and few, all synthesised with WebAudio: a bird's two-note call now and then in the day, rain
// while a storm passes, three gentle notes when a fork is waiting, a soft chime for a pick or a planted seed, and a
// page turn for the journal. Silent until the first click or key, and off when the player turns sound off.
export class TembusuSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  private nextBird = 0;
  constructor(private on: boolean) {}
  unlock() {
    if (!this.on) return;
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return; }
      const c = this.ctx;
      this.out = c.createGain(); this.out.gain.value = 0.35; this.out.connect(c.destination);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  set(on: boolean) { this.on = on; if (!on) { this.stopRain(); if (this.out && this.ctx) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } else { this.unlock(); if (this.out && this.ctx) this.out.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.1); } }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.on && this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  private tone(f: number, at: number, len: number, vol: number, type: OscillatorType = 'sine', to = 0) {
    const c = this.ctx; if (!c || !this.out || !this.on) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f, at); if (to) o.frequency.exponentialRampToValueAtTime(to, at + len);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g); g.connect(this.out); o.start(at); o.stop(at + len + 0.05);
  }
  /** three soft rising notes: a fork is waiting */
  fork() { const t = this.ctx?.currentTime ?? 0; [0, 4, 7].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), t + i * 0.22, 0.6, 0.12, 'triangle')); }
  chime() { const t = this.ctx?.currentTime ?? 0; this.tone(784, t, 0.8, 0.1, 'sine'); this.tone(1175, t + 0.08, 0.7, 0.05, 'sine'); }
  page() {
    const c = this.ctx; if (!c || !this.out || !this.noise || !this.on) return;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 2500;
    const t = c.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t); s.stop(t + 0.3);
  }
  /** called every frame with the scene's mood: birds by day, rain in a storm */
  ambient(day: boolean, storm: boolean, wall: number) {
    if (!this.ctx || !this.on) return;
    if (storm && !this.rain && this.noise && this.out) {
      const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise; src.loop = true; f.type = 'lowpass'; f.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 2);
      src.connect(f); f.connect(g); g.connect(this.out); src.start(); this.rain = { src, gain: g };
    } else if (!storm) this.stopRain();
    if (day && !storm && wall > this.nextBird) {
      if (this.nextBird) { const t = this.ctx.currentTime, f = 2200 + Math.random() * 900; this.tone(f, t, 0.12, 0.04, 'sine', f * 1.25); this.tone(f * 0.9, t + 0.18, 0.16, 0.035, 'sine', f * 0.8); }
      this.nextBird = wall + 9 + Math.random() * 14;
    }
  }
  private stopRain() {
    if (!this.rain || !this.ctx) return;
    const r = this.rain; this.rain = null;
    r.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6); r.src.stop(this.ctx.currentTime + 3);
  }
}

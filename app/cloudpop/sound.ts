// Cloudpop sounds, all synthesised with WebAudio: soft pops pitched by layer (wisps are high and tiny, sleet is a
// low thump, bosses a rumble of thunder), a tink when armour shrugs a hit off, a wooden knock for placing, a rising
// chime for upgrades, coins for selling and round bonuses, and two small tunes: a pan-flute huayno for the valley and
// a slower, lower one for boss rounds. Silent until the first input; sounds are rate-limited so a big round stays calm.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Tune = 'valley' | 'boss' | 'menu' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[] }> = {
  // E minor pentatonic huayno: the lilting short-long Andean dance rhythm
  valley: { bpm: 126, lead: [76, 79, 81, 79, 76, 74, 71, 0, 74, 76, 79, 76, 74, 71, 69, 0, 71, 74, 76, 79, 81, 83, 81, 79, 76, 74, 76, 79, 76, 0, 0, 0], bass: [52, 59, 52, 59, 50, 57, 47, 54] },
  boss: { bpm: 104, lead: [64, 0, 67, 64, 62, 0, 59, 0, 64, 0, 67, 69, 67, 64, 62, 0, 59, 0, 62, 64, 62, 59, 57, 0, 59, 62, 64, 0, 0, 0, 0, 0], bass: [40, 40, 47, 40, 38, 38, 45, 38] },
  menu: { bpm: 88, lead: [76, 0, 79, 0, 83, 0, 81, 79, 76, 0, 0, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bass: [52, 47, 50, 45] },
};
const POP_NOTE: Record<string, number> = { wisp: 96, drizzle: 91, shower: 88, squall: 86, gale: 84, rumble: 74, frost: 93, hail: 79, tempest: 76, cloudburst: 81, sleet: 67 };

export class PopSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; mus: GainNode | null = null; noise: AudioBuffer | null = null;
  sfxOn = true; musicOn = true;
  private tune: Tune = null; private timer: number | null = null; private next = 0; private n = 0; private last: Record<string, number> = {};

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = new AudioContext(); this.ctx = C;
      this.out = C.createGain(); this.out.gain.value = 0.45;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
      this.out.connect(comp); comp.connect(C.destination);
      this.mus = C.createGain(); this.mus.gain.value = this.musicOn ? 0.07 : 0; this.mus.connect(this.out);
      const b = C.createBuffer(1, C.sampleRate, C.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      this.timer = window.setInterval(() => this.schedule(), 60);
    } catch { this.ctx = null; }
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.07 : 0, this.ctx.currentTime, 0.2); }
  play(t: Tune) { if (t === this.tune) return; this.tune = t; this.n = 0; if (this.ctx) this.next = this.ctx.currentTime + 0.15; }

  private schedule() {
    const C = this.ctx; if (!C || !this.tune || !this.mus) return;
    const T = TUNES[this.tune], step = 60 / T.bpm / 2;
    while (this.next < C.currentTime + 0.3) {
      const i = this.n % T.lead.length;
      // huayno lilt: short-long pairs
      const sw = i % 2 === 0 ? step * 0.8 : step * 1.2;
      const m = T.lead[i];
      if (m) this.flute(mtof(m), this.next, sw * 1.6);
      if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), this.next, step * 3, 'triangle', 0.5, this.mus);
      if (i % 4 === 2) this.drum(this.next);
      this.next += sw; this.n++;
    }
  }
  private flute(f: number, t: number, d: number) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain(), lfo = C.createOscillator(), lg = C.createGain();
    o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5.5; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.mus!); o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  }
  private drum(t: number) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.mus!); o.start(t); o.stop(t + 0.2);
  }
  private tone(f: number, t: number, d: number, type: OscillatorType, v: number, dest: AudioNode) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.02);
  }
  private burst(t: number, d: number, f: number, q: number, v: number) {
    const C = this.ctx!, s = C.createBufferSource(), bp = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(bp); bp.connect(g); g.connect(this.out!); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }
  private ok(k: string, gap: number) {
    if (!this.ctx || !this.sfxOn) return false;
    const now = this.ctx.currentTime; if ((this.last[k] ?? -1) > now - gap) return false;
    this.last[k] = now; return true;
  }
  pop(kind: string, boss = false) {
    if (boss) { if (!this.ok('boss', 0.3)) return; const t = this.ctx!.currentTime; this.burst(t, 0.9, 120, 0.7, 0.9); this.tone(55, t, 0.8, 'sawtooth', 0.25, this.out!); return; }
    if (!this.ok('pop', 0.035)) return;
    const t = this.ctx!.currentTime, m = (POP_NOTE[kind] ?? 84) + Math.floor(Math.random() * 3);
    this.tone(mtof(m), t, 0.07, 'sine', 0.22, this.out!); this.burst(t, 0.05, mtof(m) * 2, 2, 0.2);
  }
  clink() { if (!this.ok('clink', 0.12)) return; const t = this.ctx!.currentTime; this.tone(2400, t, 0.08, 'triangle', 0.12, this.out!); this.tone(3100, t + 0.02, 0.06, 'triangle', 0.08, this.out!); }
  place() { if (!this.ok('place', 0.05)) return; const t = this.ctx!.currentTime; this.tone(220, t, 0.12, 'triangle', 0.4, this.out!); this.burst(t, 0.08, 600, 1, 0.3); }
  upgrade() { if (!this.ok('up', 0.05)) return; const t = this.ctx!.currentTime; [72, 76, 79, 84].forEach((m, i) => this.tone(mtof(m), t + i * 0.06, 0.25, 'triangle', 0.25, this.out!)); }
  coins() { if (!this.ok('coin', 0.08)) return; const t = this.ctx!.currentTime; [88, 91, 96].forEach((m, i) => this.tone(mtof(m), t + i * 0.05, 0.12, 'square', 0.06, this.out!)); }
  leak() { if (!this.ok('leak', 0.25)) return; const t = this.ctx!.currentTime; this.tone(196, t, 0.25, 'sawtooth', 0.12, this.out!); this.tone(147, t + 0.12, 0.3, 'sawtooth', 0.1, this.out!); }
  ability() { if (!this.ok('ab', 0.1)) return; const t = this.ctx!.currentTime; this.burst(t, 0.6, 900, 0.5, 0.5); [67, 74, 79, 86].forEach((m, i) => this.tone(mtof(m), t + i * 0.05, 0.4, 'sine', 0.22, this.out!)); }
  click() { if (!this.ok('click', 0.03)) return; this.tone(660, this.ctx!.currentTime, 0.05, 'triangle', 0.15, this.out!); }
  bad() { if (!this.ok('bad', 0.15)) return; const t = this.ctx!.currentTime; this.tone(180, t, 0.15, 'square', 0.1, this.out!); }
  round() { if (!this.ok('round', 0.3)) return; const t = this.ctx!.currentTime; [79, 83, 86].forEach((m, i) => this.flute(mtof(m), t + i * 0.1, 0.4)); }
  win() { if (!this.ctx) return; const t = this.ctx.currentTime; [76, 79, 83, 88, 91].forEach((m, i) => this.tone(mtof(m), t + i * 0.12, 0.6, 'triangle', 0.3, this.out!)); }
  lose() { if (!this.ctx) return; const t = this.ctx.currentTime; [71, 67, 64, 59].forEach((m, i) => this.tone(mtof(m), t + i * 0.18, 0.6, 'sine', 0.3, this.out!)); }
  level() { if (!this.ok('lvl', 0.2)) return; const t = this.ctx!.currentTime; [79, 84, 88].forEach((m, i) => this.tone(mtof(m), t + i * 0.08, 0.3, 'triangle', 0.25, this.out!)); }
}

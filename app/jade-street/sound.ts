// Jade Street sounds, all synthesised with WebAudio: a pentatonic night-market tune on a plucked "guzheng" voice over
// a soft woodblock beat, a faster chase tune with a gong when the lanterns light or a chase starts, and short effects
// for every action (scooter putter on getting on, a whistle for wardens, coins, the lucky-cat chime, a wobble for the
// cake, clicks and sparks for the mini-games). Silent until the first input; effects are rate-limited.
import type { Fx } from '@/lib/jade-game';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
type Tune = 'street' | 'chase' | 'menu' | null;
const TUNES: Record<Exclude<Tune, null>, { bpm: number; lead: number[]; bass: number[] }> = {
  // G major pentatonic, a gentle walking tune
  street: { bpm: 96, lead: [74, 0, 76, 79, 81, 0, 79, 76, 74, 0, 71, 0, 69, 71, 74, 0, 76, 0, 79, 76, 74, 71, 69, 0, 67, 0, 69, 71, 74, 0, 0, 0], bass: [43, 50, 40, 47, 45, 52, 38, 45] },
  chase: { bpm: 138, lead: [79, 81, 83, 0, 86, 83, 81, 79, 76, 0, 79, 81, 79, 76, 74, 0, 79, 81, 83, 86, 88, 86, 83, 81, 79, 0, 76, 74, 76, 0, 0, 0], bass: [43, 43, 50, 43, 40, 40, 47, 40] },
  menu: { bpm: 76, lead: [79, 0, 0, 76, 74, 0, 71, 0, 74, 0, 0, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0, 0, 0, 0, 0, 0, 0, 0, 0], bass: [43, 38, 40, 36] },
};

export class JadeSound {
  ctx: AudioContext | null = null; out: GainNode | null = null; mus: GainNode | null = null; noise: AudioBuffer | null = null;
  sfxOn = true; musicOn = true;
  private tune: Tune = null; private timer: number | null = null; private next = 0; private n = 0; private last: Record<string, number> = {};

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = new AudioContext(); this.ctx = C;
      this.out = C.createGain(); this.out.gain.value = 0.42;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
      this.out.connect(comp); comp.connect(C.destination);
      this.mus = C.createGain(); this.mus.gain.value = this.musicOn ? 0.075 : 0; this.mus.connect(this.out);
      const b = C.createBuffer(1, C.sampleRate, C.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      this.timer = window.setInterval(() => this.schedule(), 60);
    } catch { this.ctx = null; }
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.075 : 0, this.ctx.currentTime, 0.2); }
  play(t: Tune) { if (t === this.tune) return; this.tune = t; this.n = 0; if (this.ctx) this.next = this.ctx.currentTime + 0.15; if (t === 'chase') this.gong(); }

  private schedule() {
    const C = this.ctx; if (!C || !this.tune || !this.mus) return;
    const T = TUNES[this.tune], step = 60 / T.bpm / 2;
    while (this.next < C.currentTime + 0.3) {
      const i = this.n % T.lead.length, m = T.lead[i];
      if (m) this.pluck(mtof(m), this.next, step * 2.4, this.mus);
      if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), this.next, step * 3.5, 'triangle', 0.45, this.mus);
      if (i % 2 === 0) this.block(this.next, i % 8 === 0 ? 900 : 1300, this.tune === 'chase' ? 0.35 : 0.22);
      this.next += step; this.n++;
    }
  }
  private pluck(f: number, t: number, d: number, dest: AudioNode, v = 0.42) {
    const C = this.ctx!, o = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.005;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
  }
  private block(t: number, f: number, v: number) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(this.mus!); o.start(t); o.stop(t + 0.1);
  }
  private tone(f: number, t: number, d: number, type: OscillatorType, v: number, dest: AudioNode, slide = 1) {
    const C = this.ctx!, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
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
  private get t() { return this.ctx!.currentTime; }
  gong() { if (!this.ok('gong', 1)) return; const t = this.t; this.tone(110, t, 1.6, 'sine', 0.3, this.out!, 0.97); this.tone(166, t, 1.2, 'sine', 0.15, this.out!, 0.98); this.burst(t, 0.4, 400, 0.6, 0.2); }
  click() { if (!this.ok('click', 0.03)) return; this.tone(880, this.t, 0.05, 'triangle', 0.14, this.out!); }
  bad() { if (!this.ok('bad', 0.15)) return; this.tone(200, this.t, 0.18, 'square', 0.09, this.out!, 0.7); }
  good() { if (!this.ok('good', 0.1)) return; const t = this.t; [79, 86].forEach((m, i) => this.pluck(mtof(m), t + i * 0.07, 0.3, this.out!, 0.3)); }
  coins() { if (!this.ok('coin', 0.08)) return; const t = this.t; [88, 93, 96].forEach((m, i) => this.tone(mtof(m), t + i * 0.05, 0.12, 'square', 0.05, this.out!)); }
  chime() { if (!this.ok('chime', 0.1)) return; const t = this.t; [84, 88, 91, 96].forEach((m, i) => this.pluck(mtof(m), t + i * 0.06, 0.5, this.out!, 0.3)); }
  fanfare() { if (!this.ctx) return; const t = this.t; [67, 71, 74, 79, 83, 86].forEach((m, i) => this.pluck(mtof(m), t + i * 0.1, 0.8, this.out!, 0.35)); this.tone(98, t, 1.2, 'triangle', 0.3, this.out!); }
  sad() { if (!this.ctx) return; const t = this.t; [71, 67, 64, 62].forEach((m, i) => this.pluck(mtof(m), t + i * 0.16, 0.6, this.out!, 0.3)); }
  whistle() { if (!this.ok('whistle', 0.7)) return; const t = this.t; this.tone(2200, t, 0.18, 'sine', 0.16, this.out!, 1.1); this.tone(2200, t + 0.22, 0.3, 'sine', 0.16, this.out!, 1.15); }
  engine(kind = '') { if (!this.ok('engine', 0.3)) return; const t = this.t; const f = kind === 'van' ? 55 : kind === 'boat' ? 70 : kind === 'trishaw' ? 0 : 90; if (!f) { this.tone(1200, t, 0.08, 'triangle', 0.15, this.out!); this.tone(1500, t + 0.1, 0.08, 'triangle', 0.15, this.out!); return; } for (let i = 0; i < 6; i++) this.tone(f * (1 + i * 0.04), t + i * 0.06, 0.08, 'sawtooth', 0.08, this.out!); }
  honk() { if (!this.ok('honk', 0.4)) return; const t = this.t; this.tone(415, t, 0.22, 'square', 0.08, this.out!); this.tone(523, t, 0.22, 'square', 0.06, this.out!); }
  bump(k = 0.5) { if (!this.ok('bump', 0.12)) return; const t = this.t; this.burst(t, 0.12, 300, 0.8, 0.25 + k * 0.35); this.tone(90, t, 0.12, 'sine', 0.3 * k + 0.1, this.out!, 0.6); }
  whoosh() { if (!this.ok('whoosh', 0.15)) return; this.burst(this.t, 0.22, 1400, 0.7, 0.22); }
  hop() { if (!this.ok('hop', 0.12)) return; this.tone(400, this.t, 0.14, 'sine', 0.18, this.out!, 2); }
  thud() { if (!this.ok('thud', 0.1)) return; this.tone(140, this.t, 0.1, 'sine', 0.25, this.out!, 0.5); }
  talk(k = 0) { if (!this.ok('talk', 0.06)) return; this.tone(mtof(76 + (k % 5) * 2), this.t, 0.05, 'triangle', 0.08, this.out!); }
  caw() { if (!this.ok('caw', 0.5)) return; const t = this.t; this.burst(t, 0.18, 1100, 3, 0.25); this.tone(700, t, 0.18, 'sawtooth', 0.06, this.out!, 0.7); this.burst(t + 0.24, 0.16, 1000, 3, 0.2); }
  spark() { if (!this.ok('spark', 0.06)) return; const t = this.t; this.burst(t, 0.08, 4000, 1, 0.3); this.tone(1800, t, 0.06, 'square', 0.04, this.out!); }
  sizzle() { if (!this.ok('sizzle', 0.25)) return; this.burst(this.t, 0.35, 5000, 0.5, 0.18); }
  clank() { if (!this.ok('clank', 0.06)) return; const t = this.t; this.tone(1600, t, 0.07, 'triangle', 0.15, this.out!); this.tone(2400, t, 0.05, 'triangle', 0.08, this.out!); }

  /** play the world's events */
  fx(list: Fx[]) {
    for (const f of list) switch (f.t) {
      case 'bump': case 'block': this.bump(f.k ?? 0.4); break;
      case 'hit': this.bump(0.9); this.coins(); break;
      case 'dash': case 'boost': this.whoosh(); break;
      case 'hop': this.hop(); break;
      case 'honk': this.honk(); break;
      case 'car-honk': this.honk(); break;
      case 'enter': case 'start-engine': this.engine(f.kind); break;
      case 'exit': case 'climb': this.thud(); break;
      case 'cat': this.chime(); break;
      case 'pickup': case 'deliver': case 'gate': case 'fare-in': case 'fare-out': case 'shoo': case 'dodge': this.good(); break;
      case 'checkpoint': this.click(); break;
      case 'fail': this.sad(); break;
      case 'mission-done': case 'daily': case 'district': case 'win': this.fanfare(); break;
      case 'heat-up': case 'whistle': this.whistle(); break;
      case 'caught': this.sad(); break;
      case 'buy': case 'sell': this.coins(); break;
      case 'wobble': this.bad(); break;
      case 'snatch': case 'caw': this.caw(); break;
      case 'spill': this.bump(0.7); break;
      case 'trophy': this.chime(); break;
      case 'talk': this.talk(); break;
      case 'mural': case 'swap': case 'stash': this.good(); break;
      case 'hide': case 'unhide': this.thud(); break;
      case 'look': this.bad(); break;
      case 'chase': this.gong(); break;
    }
  }
  /** mini-game events */
  mini(t: string) {
    switch (t) {
      case 'tick': case 'pinch': this.click(); break;
      case 'set': case 'catch': case 'plop': this.clank(); break;
      case 'drop': case 'spring': case 'buzz': case 'oops': case 'splat': case 'squish': this.bad(); break;
      case 'spark': this.spark(); break;
      case 'ready': this.good(); break;
      case 'vroom': this.engine(); break;
      case 'toss': this.whoosh(); this.sizzle(); break;
      case 'scorch': this.sizzle(); this.bad(); break;
      case 'open': case 'served': case 'steamed': case 'perfect': this.fanfare(); break;
      case 'good': this.good(); break;
      case 'messy': this.bad(); break;
      case 'fail': this.sad(); break;
    }
  }
}

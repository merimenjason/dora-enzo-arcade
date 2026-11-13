// Every Creature sounds, all synthesised with WebAudio (ported from the prototype's core.js): a voice for every form
// (the frog's ribbit, the tortoise's shell clack-clack, the bird's flap-flap, the beetle's click-click-click, the fox's
// yip, the otter's chirp and bubble, the chinchilla's squeak), the effects (splashes, poofs, the friend fanfare, the
// puzzle click, bonks, snaps, thunder), and a gentle generated tune per screen scheduled a quarter second ahead.
// Silent until the first input.
type Osc = OscillatorType;
const TUNES: Record<string, { bpm: number; root: number; scale: number[]; prog: number[]; lead: Osc; mel: number[]; perc: number }> = {
  title: { bpm: 84, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], lead: 'triangle', mel: [0, 2, 4, 3, -1, 2, 1, -1, 0, 4, 5, 4, 3, -1, 2, -1], perc: 0 },
  s1: { bpm: 92, root: 62, scale: [0, 2, 4, 7, 9], prog: [0, 3, 5, 4], lead: 'triangle', mel: [2, -1, 4, 3, 2, -1, 0, -1, 1, 2, 4, -1, 5, 4, 2, -1], perc: 1 },
  s2: { bpm: 104, root: 65, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], lead: 'square', mel: [0, 2, 4, 2, 5, -1, 4, 2, 3, -1, 2, 0, 1, 2, -1, -1], perc: 2 },
  s3: { bpm: 96, root: 57, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], lead: 'sine', mel: [4, 5, 4, 2, -1, 2, 3, 2, 0, -1, 1, 2, 4, -1, 2, -1], perc: 1 },
  s4: { bpm: 76, root: 57, scale: [0, 3, 5, 7, 10], prog: [0, 5, 3, 4], lead: 'triangle', mel: [0, -1, 2, 1, 0, -1, -1, 3, 2, -1, 1, -1, 0, -1, -1, -1], perc: 3 },
  calm: { bpm: 80, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0], lead: 'triangle', mel: [4, 5, 6, 5, 4, 2, 3, 4, 2, -1, 1, 2, 0, -1, -1, -1], perc: 0 },
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class CreatureSound {
  AC: AudioContext | null = null; MASTER: GainNode | null = null; MUS: GainNode | null = null; NB: AudioBuffer | null = null;
  muted = false;
  private cur: string | null = null; private next = 0; private stepN = 0; private timer: ReturnType<typeof setInterval> | null = null;

  start() {
    if (!this.AC) {
      try {
        const AC = new AudioContext(); this.AC = AC;
        this.MASTER = AC.createGain(); this.MASTER.gain.value = this.muted ? 0 : 1; this.MASTER.connect(AC.destination);
        this.MUS = AC.createGain(); this.MUS.gain.value = .55; this.MUS.connect(this.MASTER);
        this.timer = setInterval(() => this.musicTick(), 40);
      } catch { return; }
    }
    if (this.AC.state === 'suspended') void this.AC.resume();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; void this.AC?.close(); this.AC = null; }
  setMute(v: boolean) { this.muted = v; if (this.MASTER) this.MASTER.gain.value = v ? 0 : 1; }

  private tone(f: number, d: number, type: Osc = 'sine', v = .12, slide = 0, delay = 0) {
    const AC = this.AC; if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.0008, t + d);
    o.connect(g).connect(this.MASTER!); o.start(t); o.stop(t + d + .05);
  }
  private buf() {
    if (!this.NB && this.AC) { const AC = this.AC; this.NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const a = this.NB.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    return this.NB;
  }
  private noise(d: number, v = .15, f = 1200, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, f2 = 0) {
    const AC = this.AC; if (!AC) return; const t = AC.currentTime + delay;
    const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = this.buf();
    fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d); fl.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    s.connect(fl).connect(g).connect(this.MASTER!); s.start(t); s.stop(t + d + .05);
  }
  /** a voiced note through a lowpass, for animal calls */
  private vox(f: number, d: number, type: Osc, v: number, f2: number, lp: number, delay = 0) {
    const AC = this.AC; if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2, t + d); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.setValueAtTime(v, t + d * .6); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(fl).connect(g).connect(this.MASTER!); o.start(t); o.stop(t + d + .05);
  }
  /** each form's own voice, offset by `w` seconds */
  voice(form: string, w = 0) {
    const tone = (f: number, d: number, ty: Osc, v: number, sl = 0, dl = 0) => this.tone(f, d, ty, v, sl, dl + w);
    const noise = (d: number, v: number, f: number, q: number, ty: BiquadFilterType, dl = 0, f2 = 0) => this.noise(d, v, f, q, ty, dl + w, f2);
    const vox = (f: number, d: number, ty: Osc, v: number, f2: number, lp: number, dl = 0) => this.vox(f, d, ty, v, f2, lp, dl + w);
    if (form === 'frog') { vox(150, .07, 'square', .09, 230, 900); vox(170, .09, 'square', .09, 120, 800, .1); }                                         // ribbit
    else if (form === 'tort') { noise(.035, .25, 2200, 5, 'bandpass'); tone(420, .07, 'triangle', .1, .5); noise(.03, .2, 1700, 5, 'bandpass', .08); tone(360, .06, 'triangle', .08, .5, .08); } // shell clack-clack
    else if (form === 'bird') { noise(.09, .12, 900, .7, 'lowpass', 0, 300); noise(.09, .1, 900, .7, 'lowpass', .1, 300); }                          // flap-flap
    else if (form === 'beetle') { for (let i = 0; i < 3; i++) noise(.012, .22, 4600, 9, 'bandpass', i * .045); }                                     // click-click-click
    else if (form === 'fox') { vox(700, .08, 'sine', .1, 1350, 3000); vox(1150, .11, 'sine', .08, 620, 3000, .09); }                                 // yip
    else if (form === 'otter') { tone(1700, .05, 'sine', .07, 1.5); tone(1900, .06, 'sine', .06, 1.4, .07); tone(420, .07, 'sine', .05, 2.2, .14); }  // chirp + bubble
    else if (form === 'chin') { tone(880, .06, 'sine', .06, 1.3); tone(1100, .08, 'sine', .05, 1.2, .06); }
  }
  /** an effect by id; `v:<form>` is that form's voice */
  sfx(id: string, n = 0, w = 0) {
    if (!this.AC || this.muted) return;
    if (id.startsWith('v:')) { this.voice(id.slice(2), w); return; }
    const tone = (f: number, d: number, ty: Osc = 'sine', v = .12, sl = 0, dl = 0) => this.tone(f, d, ty, v, sl, dl + w);
    const noise = (d: number, v = .15, f = 1200, q = 1, ty: BiquadFilterType = 'bandpass', dl = 0, f2 = 0) => this.noise(d, v, f, q, ty, dl + w, f2);
    switch (id) {
      case 'jump': tone(420, .14, 'triangle', .08, 1.8); break;
      case 'frog': this.voice('frog', w); break;
      case 'hop': tone(700, .08, 'triangle', .05, 1.5); break;
      case 'flap': noise(.12, .1, 900, .8, 'lowpass', 0, 350); break;
      case 'splash': noise(.35, .2, 1600, .6, 'lowpass', 0, 300); tone(180, .2, 'sine', .06, .5); break;
      case 'plip': tone(900, .08, 'sine', .06, .5); break;
      case 'poof': noise(.3, .1, 2500, .7, 'bandpass', 0, 600); tone(880, .18, 'sine', .04, 1.6, .04); break;
      case 'croak': { const f = [196, 247, 294, 392][n] || 196; this.vox(f * .8, .09, 'square', .08, f * 1.2, 1100, w); this.vox(f, .12, 'square', .07, f * .7, 900, .11 + w); break; }
      case 'chirp': tone(2400, .06, 'sine', .05, 1.3); tone(2900, .07, 'sine', .04, 1.2, .08); break;
      case 'friend': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .35, 'triangle', .09, 1, i * .07)); break;
      case 'click': tone(120, .25, 'sine', .25, .5); noise(.09, .2, 500, 2); [784, 1175, 1568].forEach((f, i) => tone(f, .4, 'sine', .07, 1, .12 + i * .06)); break;
      case 'bonk': tone(1800, .25, 'triangle', .12, .9); tone(2700, .2, 'sine', .06, .9, .02); break;
      case 'hit': tone(220, .2, 'sawtooth', .05, .5); noise(.2, .1, 800); break;
      case 'snap': noise(.06, .2, 3000, 3); tone(500, .12, 'square', .05, .6, .04); break;
      case 'slip': tone(600, .3, 'sine', .07, .4); noise(.25, .06, 2500, 1); break;
      case 'nudge': tone(150, .12, 'sine', .15, .7); noise(.08, .08, 400); break;
      case 'swap': tone(660, .1, 'sine', .07, 1.5); break;
      case 'call': tone(980, .12, 'sine', .08, 1.35); tone(1320, .16, 'sine', .07, .8, .13); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .5, 'triangle', .08, 1, i * .12)); break;
      case 'deny': tone(220, .1, 'triangle', .06, .8); tone(196, .12, 'triangle', .05, .8, .09); break;
      case 'dig': noise(.08, .14, 500, 1.2, 'bandpass', 0, 250); break;
      case 'thunder': noise(1.6, .35, 300, .7, 'lowpass', 0, 60); noise(.25, .25, 2200, .8, 'bandpass'); break;
      case 'zap': noise(.3, .3, 3500, 1, 'highpass'); tone(90, .5, 'sawtooth', .07, .6); break;
      case 'boing': tone(160, .35, 'triangle', .14, 3.2); tone(320, .2, 'sine', .06, 2.5, .04); break;
      case 'dive': noise(.25, .14, 1200, .7, 'lowpass', 0, 250); tone(500, .2, 'sine', .05, .4); break;
      case 'whoosh': noise(.5, .12, 600, .6, 'bandpass', 0, 2400); break;
    }
  }

  // ---------------------------------------------------------------- music: a gentle generated tune per screen
  music(id: string | null) { if (this.cur === id) return; this.cur = id; this.stepN = 0; this.next = this.AC ? this.AC.currentTime + .15 : 0; }
  private mnote(f: number, t: number, d: number, type: Osc, v: number) {
    const AC = this.AC!, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .03); g.gain.exponentialRampToValueAtTime(.0008, t + d);
    o.connect(g).connect(this.MUS!); o.start(t); o.stop(t + d + .05);
  }
  private mhat(t: number, v: number, f = 7000) {
    const AC = this.AC!, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = this.buf(); fl.type = 'highpass'; fl.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); s.connect(fl).connect(g).connect(this.MUS!); s.start(t); s.stop(t + .08);
  }
  private musicTick() {
    const AC = this.AC; if (!AC || !this.cur || AC.state !== 'running') return;
    const T = TUNES[this.cur]; if (!T) return;
    const sp = 60 / T.bpm / 2; // eighth notes
    if (this.next < AC.currentTime) this.next = AC.currentTime + .05;
    while (this.next < AC.currentTime + .25) {
      const s = this.stepN, t = this.next, bar = (s >> 4) % 4, ch = T.prog[bar], st = s % 16, sc = T.scale;
      const deg = (i: number) => T.root + sc[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
      if (st % 8 === 0) { this.mnote(midi(deg(ch) - 24), t, sp * 7, 'sine', .16); [0, 2, 4].forEach((k) => this.mnote(midi(deg(ch + k) - 12), t, sp * 8, 'triangle', .022)); }
      if (st % 8 === 4) this.mnote(midi(deg(ch + 2) - 24), t, sp * 3, 'sine', .08);
      const m = T.mel[(st + (bar === 3 ? 8 : 0)) % 16];
      if (m >= 0 && (bar !== 2 || st < 12)) this.mnote(midi(deg(m + ch % 2)), t, sp * 1.8, T.lead, T.lead === 'square' ? .018 : .05);
      if (T.perc === 1 && st % 4 === 2) this.mhat(t, .025);
      if (T.perc === 2 && st % 2 === 1) this.mhat(t, .018);
      if (T.perc === 2 && st % 8 === 0) this.mnote(90, t, .12, 'sine', .07);
      if (T.perc === 3 && st % 16 === 0) this.mhat(t, .03, 900);
      this.stepN++; this.next += sp;
    }
  }
}

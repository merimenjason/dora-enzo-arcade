// Jade Street sounds, all synthesised with WebAudio: a pentatonic night-market tune on a plucked "guzheng" voice over
// a soft woodblock beat, a faster chase tune with a gong when the lanterns light or a chase starts, and short effects
// for every action (scooter putter on getting on, a whistle for wardens, coins, the lucky-cat chime, a wobble for the
// cake, clicks and sparks for the mini-games). Silent until the first input; effects are rate-limited.
// On a ride the street tune gives way to the ride radio (stations in radio.ts; the chase tune still wins when the
// lanterns are lit), and under everything runs a very quiet ambient bed for the district you are in (market chatter
// and sizzle, temple wind chimes and bells, lapping canal water, gulls and horns at the docks, neon hum and blips on
// the Strip) plus rain hiss and drips during showers.
import type { Fx } from '@/lib/jade-game';
import { stationList, stationOf, OFF, type Station } from './radio';

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
  /** the ride the radio is in (null on foot), the station index, and what the scheduler is playing now */
  private radioKind: string | null = null; private radioIx = 0; private playing = '';
  private amb: GainNode | null = null; private beds: Record<string, GainNode> = {}; private rainG: GainNode | null = null;
  private district = ''; private rain = 0;

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
      this.amb = C.createGain(); this.amb.gain.value = this.sfxOn ? 1 : 0; this.amb.connect(this.out);
      this.timer = window.setInterval(() => { this.schedule(); this.ambientTick(); }, 60);
    } catch { this.ctx = null; }
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; void this.ctx?.close(); this.ctx = null; this.amb = null; this.rainG = null; this.beds = {}; this.playing = ''; }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.075 : 0, this.ctx.currentTime, 0.2); }
  play(t: Tune) { if (t === this.tune) return; this.tune = t; this.n = 0; if (this.ctx) this.next = this.ctx.currentTime + 0.15; if (t === 'chase') this.gong(); }

  // ── the ride radio
  /** the station names for a ride kind ('boat' has its own), "Radio off" last */
  stations(kind: string | null): string[] { return stationList(kind); }
  stationName(kind: string | null, i: number): string { const l = stationList(kind); return l[((i % l.length) + l.length) % l.length]; }
  /** tune the radio for the ride the hero is on (null on foot: the street tune comes back); safe to call every frame */
  radio(kind: string | null) {
    if (kind === this.radioKind) return;
    this.radioKind = kind;
  }
  /** switch to station i (wrapping); returns its name */
  station(i: number): string {
    const l = stationList(this.radioKind); this.radioIx = ((i % l.length) + l.length) % l.length;
    if (this.radioKind) this.tuneStatic();
    return l[this.radioIx];
  }
  /** the station on air for the current ride, or null when on foot or switched off */
  onAir(): string | null { if (!this.radioKind) return null; const n = this.stationName(this.radioKind, this.radioIx); return n === OFF ? null : n; }
  private tuneStatic() { if (!this.ctx || !this.sfxOn) return; const t = this.t; this.burst(t, 0.25, 2600, 0.4, 0.12); this.tone(1400, t + 0.05, 0.12, 'sine', 0.05, this.out!, 0.5); }

  private schedule() {
    const C = this.ctx; if (!C || !this.tune || !this.mus) return;
    const st = this.tune === 'street' && this.radioKind ? stationOf(this.onAir() ?? '') : null;
    const off = this.tune === 'street' && this.radioKind && !this.onAir();
    const key = off ? 'off' : st ? 'radio:' + st.name : this.tune;
    if (key !== this.playing) { this.playing = key; this.n = 0; this.next = Math.max(this.next, C.currentTime + 0.15); }
    if (off) { this.next = C.currentTime; return; }
    if (st) { this.scheduleRadio(st); return; }
    const T = TUNES[this.tune], step = 60 / T.bpm / 2;
    while (this.next < C.currentTime + 0.3) {
      const i = this.n % T.lead.length, m = T.lead[i];
      if (m) this.pluck(mtof(m), this.next, step * 2.4, this.mus);
      if (i % 4 === 0) this.tone(mtof(T.bass[(i / 4) % T.bass.length]), this.next, step * 3.5, 'triangle', 0.45, this.mus);
      if (i % 2 === 0) this.block(this.next, i % 8 === 0 ? 900 : 1300, this.tune === 'chase' ? 0.35 : 0.22);
      this.next += step; this.n++;
    }
  }
  private scheduleRadio(S: Station) {
    const C = this.ctx!, step = 60 / S.bpm / 2, dest = this.mus!;
    while (this.next < C.currentTime + 0.3) {
      const i = this.n % S.lead.length, b = i % 8, t = this.next + (S.swing && i % 2 ? step * S.swing : 0);
      const m = S.lead[i];
      if (m) {
        let len = 1; while (len < 4 && !S.lead[(i + len) % S.lead.length]) len++;
        this.voice(S.voice, mtof(m), t, step * len, dest, i ? S.lead[i - 1] : 0);
      }
      if (i % 2 === 0) { const bm = S.bass[(i / 2) % S.bass.length]; if (bm) this.tone(mtof(bm), t, step * 1.8, S.voice === 'chip' ? 'square' : 'triangle', S.voice === 'chip' ? 0.16 : 0.42, dest); }
      if (b === 0 || (S.voice === 'chip' && b === 4)) {
        const ch = S.chords[Math.floor(i / 8) % S.chords.length], d = S.voice === 'chip' ? step * 1.2 : step * 7.5;
        for (const c of ch) this.tone(mtof(c), t, d, S.voice === 'chip' ? 'square' : 'sine', S.voice === 'chip' ? 0.035 : 0.075, dest);
      }
      if (S.kick[b] === 'x') this.tone(130, t, 0.16, 'sine', S.voice === 'keys' ? 0.4 : 0.55, dest, 0.35);
      if (S.snare[b] === 'x') this.hit(t, S.voice === 'keys' ? 0.12 : 0.09, 1900, 0.7, S.voice === 'keys' ? 0.16 : 0.26, dest);
      if (S.hat[b] === 'x') { if (S.voice === 'erhu' || S.kick === 'x.......') this.block(t, b === 0 ? 700 : 1000, 0.18); else this.hit(t, 0.03, 8000, 1, 0.08, dest); }
      this.next += step; this.n++;
    }
  }
  private voice(v: Station['voice'], f: number, t: number, d: number, dest: AudioNode, prev: number) {
    const C = this.ctx!;
    if (v === 'pluck') { this.pluck(f, t, Math.max(0.3, d * 1.4), dest); return; }
    if (v === 'chip') { this.tone(f, t, Math.min(d, 0.22), 'square', 0.12, dest); return; }
    if (v === 'keys') { this.tone(f, t, d * 1.3 + 0.3, 'sine', 0.36, dest); this.tone(f * 2.003, t, d * 0.6 + 0.1, 'triangle', 0.06, dest); return; }
    // erhu: a bowed sawtooth, softened, sliding up from the last note, with a slow vibrato
    const o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter(), vib = C.createOscillator(), vg = C.createGain();
    o.type = 'sawtooth'; const from = prev ? mtof(prev) : f * 0.97;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + d * 0.6); vib.connect(vg); vg.connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = f * 3; lp.Q.value = 2;
    const dd = d * 0.95 + 0.1;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.09); g.gain.setValueAtTime(0.14, t + dd * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + dd);
    o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); vib.start(t); o.stop(t + dd + 0.05); vib.stop(t + dd + 0.05);
  }
  private hit(t: number, d: number, f: number, q: number, v: number, dest: AudioNode) {
    const C = this.ctx!, s = C.createBufferSource(), bp = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(bp); bp.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }

  // ── ambient beds and rain
  /** the district you are in and how hard it is raining (0..1); call about once a second, cheap when unchanged */
  ambient(district: string, rain: number) { this.district = district; this.rain = Math.max(0, Math.min(1, rain)); this.ensureBeds(); this.fadeBeds(); }
  private ensureBeds() {
    const C = this.ctx; if (!C || !this.amb || !this.noise || this.rainG) return;
    const loop = (type: BiquadFilterType, f: number, q: number) => {
      const s = C.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = 0; s.loopEnd = this.noise!.duration;
      const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); s.start(); return fl;
    };
    const bed = (name: string, ...srcs: AudioNode[]) => { const g = C.createGain(); g.gain.value = 0; for (const n of srcs) n.connect(g); g.connect(this.amb!); this.beds[name] = g; return g; };
    const lfo = (rate: number, depth: number, param: AudioParam) => { const o = C.createOscillator(), g = C.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); };
    // market: a murmur of voices (a band of noise breathing in and out)
    const mur = loop('bandpass', 520, 0.9), mg = C.createGain(); mg.gain.value = 0.05; mur.connect(mg); lfo(0.7, 0.02, mg.gain); lfo(0.23, 120, (mur as BiquadFilterNode).frequency);
    bed('market', mg);
    // temple: a soft wind
    const wind = loop('lowpass', 380, 0.7), wg = C.createGain(); wg.gain.value = 0.045; wind.connect(wg); lfo(0.11, 0.03, wg.gain);
    bed('temple', wg);
    // canal: water lapping
    const lap = loop('lowpass', 300, 1.2), lg = C.createGain(); lg.gain.value = 0.06; lap.connect(lg); lfo(0.35, 0.05, lg.gain);
    bed('canal', lg);
    // docks: the sea
    const sea = loop('lowpass', 210, 0.8), sg = C.createGain(); sg.gain.value = 0.08; sea.connect(sg); lfo(0.09, 0.05, sg.gain);
    bed('docks', sg);
    // arcade: neon hum
    const hum = C.createOscillator(), hum2 = C.createOscillator(), hg = C.createGain(); hum.type = 'sine'; hum.frequency.value = 120; hum2.type = 'sine'; hum2.frequency.value = 240.6;
    hg.gain.value = 0.02; hum.connect(hg); hum2.connect(hg); hum.start(); hum2.start(); lfo(3.1, 0.006, hg.gain);
    bed('arcade', hg);
    // rain hiss
    const hiss = loop('highpass', 1500, 0.5), rl = C.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 7000; hiss.connect(rl);
    this.rainG = C.createGain(); this.rainG.gain.value = 0; rl.connect(this.rainG); this.rainG.connect(this.amb);
  }
  private fadeBeds() {
    const C = this.ctx; if (!C || !this.amb) return;
    const now = C.currentTime;
    this.amb.gain.setTargetAtTime(this.sfxOn ? 1 : 0, now, 0.3);
    for (const [d, g] of Object.entries(this.beds)) g.gain.setTargetAtTime(d === this.district ? 1 : 0, now, 1.2);
    this.rainG?.gain.setTargetAtTime(this.rain * 0.14, now, 1.5);
  }
  /** the odd sounds that make a district: chimes, bells, gulls, horns, sizzles, blips and rain drips */
  private ambientTick() {
    const C = this.ctx; if (!C || !this.amb || !this.sfxOn || !this.rainG) return;
    const t = C.currentTime + 0.05, r = Math.random(), a = this.amb;
    switch (this.district) {
      case 'market':
        if (r < 0.012) this.hit(t, 0.5, 5200, 0.5, 0.05, a);
        else if (r < 0.03) this.tone(mtof(70 + Math.floor(Math.random() * 8)), t, 0.06, 'triangle', 0.018, a);
        break;
      case 'temple':
        if (r < 0.02) { const n = [84, 86, 88, 91, 93, 96]; for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) this.pluck(mtof(n[Math.floor(Math.random() * n.length)]), t + i * 0.13, 0.9, a, 0.05); }
        else if (r < 0.023) { this.tone(220, t, 3, 'sine', 0.05, a, 0.995); this.tone(331, t, 2.2, 'sine', 0.02, a); }
        break;
      case 'canal':
        if (r < 0.006) this.tone(95, t, 0.5, 'sawtooth', 0.012, a, 1.25);
        else if (r < 0.02) this.tone(500 + Math.random() * 300, t, 0.06, 'sine', 0.02, a, 1.6);
        break;
      case 'docks':
        if (r < 0.008) { this.tone(1250, t, 0.22, 'sine', 0.03, a, 0.72); this.tone(1200, t + 0.28, 0.25, 'sine', 0.025, a, 0.7); }
        else if (r < 0.0095) { this.tone(87, t, 1.6, 'sawtooth', 0.025, a); this.tone(130, t, 1.6, 'sawtooth', 0.012, a); }
        else if (r < 0.016) { this.tone(1700, t, 0.07, 'triangle', 0.02, a); this.tone(2500, t, 0.05, 'triangle', 0.012, a); }
        break;
      case 'arcade':
        if (r < 0.025) this.tone(mtof(84 + Math.floor(Math.random() * 12)), t, 0.05, 'square', 0.012, a);
        break;
    }
    if (this.rain > 0.15 && Math.random() < this.rain * 0.12) this.tone(1800 + Math.random() * 1600, t + Math.random() * 0.05, 0.05, 'sine', 0.02 * this.rain, a, 0.6);
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

  ping() { if (!this.ok('ping', 0.3)) return; const t = this.t; this.tone(mtof(88), t, 0.12, 'sine', 0.12, this.out!); this.tone(mtof(93), t + 0.1, 0.2, 'sine', 0.12, this.out!); }
  sting() { if (!this.ok('sting', 1)) return; const t = this.t; [76, 79, 83].forEach((m, i) => this.pluck(mtof(m), t + i * 0.08, 0.4, this.out!, 0.28)); this.block(t, 1100, 0.2); }
  deed() { if (!this.ok('deed', 0.5)) return; const t = this.t; [72, 76, 79, 84, 88].forEach((m, i) => this.pluck(mtof(m), t + i * 0.07, 0.5, this.out!, 0.28)); this.coins(); }
  quack() { if (!this.ok('quack', 0.25)) return; const t = this.t; this.tone(620, t, 0.12, 'sawtooth', 0.05, this.out!, 0.7); this.burst(t, 0.1, 900, 4, 0.12); }
  push() { if (!this.ok('push', 0.25)) return; const t = this.t; this.tone(160, t, 0.12, 'triangle', 0.1, this.out!, 0.8); this.tone(70, t + 0.05, 0.14, 'sine', 0.2, this.out!, 0.6); }
  catchEngine(kind = '') { if (!this.ok('catch', 0.6)) return; const t = this.t; const f = kind === 'van' ? 50 : 80; for (let i = 0; i < 3; i++) this.tone(f, t + i * 0.16, 0.08, 'sawtooth', 0.06, this.out!, 0.8); this.tone(f, t + 0.5, 0.6, 'sawtooth', 0.09, this.out!, 1.8); }
  smoke() { if (!this.ok('smoke', 0.4)) return; this.burst(this.t, 0.5, 700, 0.5, 0.12); }
  busk() { if (!this.ok('busk', 1)) return; const t = this.t; [76, 79, 81, 83, 81, 79].forEach((m, i) => this.voice('erhu', mtof(m), t + i * 0.16, 0.18, this.out!, i ? [76, 79, 81, 83, 81][i - 1] : 0)); }
  dance() { if (!this.ok('dance', 2)) return; const t = this.t; [67, 71, 74, 71, 76, 74, 79, 0].forEach((m, i) => { if (m) this.pluck(mtof(m), t + i * 0.15, 0.3, this.out!, 0.22); this.block(t + i * 0.15, i % 2 ? 1300 : 900, 0.15); }); }
  skyLantern() { if (!this.ok('sky', 0.8)) return; const t = this.t; this.burst(t, 0.8, 900, 0.4, 0.1); [91, 96].forEach((m, i) => this.pluck(mtof(m), t + 0.3 + i * 0.2, 1.2, this.out!, 0.15)); }
  slurp() { if (!this.ok('slurp', 0.6)) return; const t = this.t; this.burst(t, 0.3, 1200, 2, 0.1); this.tone(300, t, 0.3, 'sine', 0.06, this.out!, 2.2); }
  firework() { if (!this.ok('firework', 0.15)) return; const t = this.t; this.tone(900, t, 0.5, 'sine', 0.04, this.out!, 2.2); this.burst(t + 0.5, 0.5, 600, 0.5, 0.3); this.tone(80, t + 0.5, 0.3, 'sine', 0.2, this.out!, 0.5); this.burst(t + 0.6, 0.6, 5000, 0.4, 0.06); }
  medal(k = 1) { if (!this.ctx) return; const t = this.t; const n = [79, 84, 88, 91].slice(0, 1 + Math.max(1, Math.min(3, k))); n.forEach((m, i) => this.pluck(mtof(m), t + i * 0.12, 0.9, this.out!, 0.3)); if (k >= 3) this.tone(mtof(96), t + 0.5, 1.2, 'sine', 0.08, this.out!); }
  lesson() { if (!this.ok('lesson', 0.5)) return; this.tone(mtof(86), this.t, 0.08, 'sine', 0.08, this.out!); }

  /** play the world's events */
  fx(list: Fx[]) {
    for (const f of list) switch (f.t) {
      case 'bump': case 'block': this.bump(f.k ?? 0.4); break;
      case 'hit': this.bump(0.9); this.coins(); break;
      case 'dash': case 'boost': this.whoosh(); break;
      case 'hop': this.hop(); break;
      case 'honk': this.honk(); break;
      case 'car-honk': this.honk(); break;
      case 'enter': this.engine(f.kind); break;
      case 'start-engine': this.catchEngine(f.kind); break;
      case 'text': this.ping(); break;
      case 'event': this.sting(); break;
      case 'good-deed': this.deed(); break;
      case 'quack': this.quack(); break;
      case 'push': this.push(); break;
      case 'smoke': this.smoke(); break;
      case 'busk': this.busk(); break;
      case 'dance': this.dance(); break;
      case 'sky-lantern': this.skyLantern(); break;
      case 'eat': this.slurp(); break;
      case 'firework': this.firework(); break;
      case 'medal': this.medal(f.k ?? 1); break;
      case 'lesson': this.lesson(); break;
      case 'chapter': this.gong(); break;
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

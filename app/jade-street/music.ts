// Jade Street music and voices, synthesised with WebAudio. Six themes, each with its own tempo, mode and band:
//   street   free roam: a walking guzheng melody over soft woodblocks and a low drone
//   market   a busier pluck with a hand-drum pattern and finger cymbals (in the Night Market and at the stalls)
//   chase    fast: the erhu lead over driving drums and a gong on the downbeat of each phrase
//   boss     Madame Glint: a minor-mode erhu with tom rolls and a low pulse
//   festival the lantern festival: bright guzheng runs, cymbals and a skipping drum
//   menu     slow and quiet
// The guzheng is a plucked string with a bright attack that bends up into pitch as a player presses the string; the
// erhu is a bowed, filtered sawtooth that slides between notes with a slow vibrato. Changing theme crossfades: the old
// layer keeps playing while it fades out over about a second and a half, so nothing cuts off.
// Voices: while a line types out, each character "speaks" in short pitched syllables (a babble), with their own pitch,
// timbre and speed: Uncle Kee low and slow, Pip squeaky and quick, Gizmo in chiptune, the crows in rasps.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type Theme = 'street' | 'market' | 'chase' | 'boss' | 'festival' | 'menu';
type Song = { bpm: number; lead: number[]; bass: number[]; lv: 'pluck' | 'erhu'; drums: string; perc: string; cym: string; pad?: number[]; v: number };
// lead: one note per eighth (0 rests); drums: 'x' big drum, 'o' small drum, 'b' woodblock, '.' rest (per eighth, loops)
export const SONGS: Record<Theme, Song> = {
  street: { bpm: 92, lv: 'pluck', v: 0.38, lead: [74, 0, 76, 79, 81, 0, 79, 76, 74, 0, 71, 0, 69, 71, 74, 0, 76, 0, 79, 76, 74, 71, 69, 0, 67, 0, 69, 71, 74, 0, 0, 0], bass: [43, 50, 40, 47, 45, 52, 38, 45], drums: 'b...b.b.', perc: '........', cym: '................................', pad: [55, 59, 62] },
  market: { bpm: 108, lv: 'pluck', v: 0.36, lead: [79, 81, 79, 76, 74, 76, 79, 0, 81, 83, 81, 79, 76, 0, 74, 76, 79, 0, 76, 74, 71, 74, 76, 0, 74, 71, 69, 71, 67, 0, 0, 0], bass: [43, 43, 47, 47, 45, 45, 50, 50], drums: 'o.b.o.bb', perc: '..x...x.', cym: '...............x...............x' },
  chase: { bpm: 138, lv: 'erhu', v: 0.34, lead: [79, 81, 83, 0, 86, 83, 81, 79, 76, 0, 79, 81, 79, 76, 74, 0, 79, 81, 83, 86, 88, 86, 83, 81, 79, 0, 76, 74, 76, 0, 0, 0], bass: [43, 43, 50, 43, 40, 40, 47, 40], drums: 'x.o.x.oo', perc: 'b.b.b.b.', cym: 'x...............................' },
  boss: { bpm: 126, lv: 'erhu', v: 0.36, lead: [76, 0, 77, 76, 72, 0, 71, 72, 76, 0, 77, 79, 77, 76, 72, 0, 81, 0, 79, 77, 76, 77, 76, 72, 71, 0, 69, 71, 72, 0, 0, 0], bass: [45, 45, 41, 41, 40, 40, 45, 44], drums: 'x..ox.oo', perc: '.b.b.b.b', cym: 'x.......x.......x.......x.....xx', pad: [57, 60, 64] },
  festival: { bpm: 116, lv: 'pluck', v: 0.4, lead: [79, 83, 86, 83, 88, 86, 83, 79, 81, 83, 81, 79, 76, 79, 81, 0, 83, 86, 88, 91, 88, 86, 83, 81, 79, 81, 83, 81, 79, 0, 0, 0], bass: [43, 50, 47, 50, 45, 52, 50, 43], drums: 'x.o.xoo.', perc: 'b.bbb.b.', cym: 'x...x...x...x...x...x...x...x.xx' },
  menu: { bpm: 72, lv: 'pluck', v: 0.34, lead: [79, 0, 0, 76, 74, 0, 71, 0, 74, 0, 0, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0, 0, 0, 0, 0, 0, 0, 0, 0], bass: [43, 38, 40, 36], drums: '........', perc: '........', cym: '................................', pad: [55, 59, 62] },
};
type Layer = { theme: Theme; bus: GainNode; n: number; next: number; fade: number };

export class Music {
  layers: Layer[] = []; cur: Theme | null = null;
  constructor(public C: AudioContext, public dest: GainNode, public noise: AudioBuffer) {}
  /** switch theme with a crossfade; safe to call every frame */
  set(t: Theme | null) {
    if (t === this.cur) return; this.cur = t; const C = this.C, now = C.currentTime;
    for (const l of this.layers) if (l.fade === 0) { l.fade = now + 1.6; l.bus.gain.cancelScheduledValues(now); l.bus.gain.setValueAtTime(l.bus.gain.value, now); l.bus.gain.linearRampToValueAtTime(0.0001, now + 1.5); }
    if (!t) return;
    const bus = C.createGain(); bus.gain.setValueAtTime(0.0001, now); bus.gain.linearRampToValueAtTime(1, now + 1.2); bus.connect(this.dest);
    this.layers.push({ theme: t, bus, n: 0, next: now + 0.1, fade: 0 });
  }
  /** stop everything at once (the radio has taken over) */
  hush() { this.set(null); }
  schedule() {
    const C = this.C, now = C.currentTime;
    this.layers = this.layers.filter(l => { if (l.fade && now > l.fade) { l.bus.disconnect(); return false; } return true; });
    for (const l of this.layers) {
      const S = SONGS[l.theme], step = 60 / S.bpm / 2;
      if (l.next < now) l.next = now + 0.02;
      while (l.next < now + 0.3) {
        const i = l.n % S.lead.length, t = l.next, m = S.lead[i];
        if (m) { let len = 1; while (len < 4 && !S.lead[(i + len) % S.lead.length]) len++; if (S.lv === 'pluck') this.guzheng(mtof(m), t, Math.max(0.5, step * len * 1.6), l.bus, S.v); else this.erhu(mtof(m), t, step * len, l.bus, i ? S.lead[i - 1] : 0, S.v * 0.45); }
        // the guzheng's glissando at the top of each phrase in the festival and market themes
        if ((l.theme === 'festival' || l.theme === 'market') && i % 16 === 15) for (let k = 0; k < 5; k++) this.guzheng(mtof(74 + [0, 2, 4, 7, 9][k]), t + k * 0.03, 0.4, l.bus, 0.12);
        if (i % 4 === 0) this.tone(mtof(S.bass[(i / 4) % S.bass.length]), t, step * 3.6, 'triangle', 0.32, l.bus);
        if (S.pad && i % 16 === 0) for (const p of S.pad) this.tone(mtof(p), t, step * 15, 'sine', 0.035, l.bus);
        const d = S.drums[i % S.drums.length], pc = S.perc[i % S.perc.length], cy = S.cym[i % S.cym.length];
        if (d === 'x') this.drum(t, 72, 0.5, l.bus); else if (d === 'o') this.drum(t, 150, 0.26, l.bus); else if (d === 'b') this.block(t, i % 8 === 0 ? 900 : 1250, 0.2, l.bus);
        if (pc === 'x') this.drum(t, 210, 0.2, l.bus); else if (pc === 'b') this.block(t, 1500, 0.12, l.bus);
        if (cy === 'x') this.cymbal(t, l.theme === 'chase' || l.theme === 'boss' ? 0.16 : 0.1, l.bus);
        if (l.theme === 'boss' && i % 32 === 28) for (let k = 0; k < 4; k++) this.drum(t + k * step / 2, 110 + k * 12, 0.28, l.bus);
        l.next += step; l.n++;
      }
    }
  }
  // ── instruments
  /** a plucked guzheng string: a bright attack that presses up into pitch, a ringing body and a soft octave */
  guzheng(f: number, t: number, d: number, dest: AudioNode, v = 0.38) {
    const C = this.C, o = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter();
    o.type = 'triangle'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o2.type = 'sine'; o2.frequency.value = f * 2.006;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    // the pick: a tiny click of noise
    const s = C.createBufferSource(), bp = C.createBiquadFilter(), ng = C.createGain(); s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 2;
    ng.gain.setValueAtTime(v * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02); s.connect(bp); bp.connect(ng); ng.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + 0.03);
  }
  /** a bowed erhu: a filtered sawtooth that slides from the last note, swelling, with a vibrato that grows */
  erhu(f: number, t: number, d: number, dest: AudioNode, prev: number, v = 0.16) {
    const C = this.C, o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter(), vib = C.createOscillator(), vg = C.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(prev ? mtof(prev) : f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.013, t + d * 0.7); vib.connect(vg); vg.connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = f * 3.2; lp.Q.value = 2.5;
    const dd = d * 0.95 + 0.08;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.08); g.gain.setValueAtTime(v * 0.85, t + dd * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + dd);
    o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); vib.start(t); o.stop(t + dd + 0.05); vib.stop(t + dd + 0.05);
  }
  drum(t: number, f: number, v: number, dest: AudioNode) {
    const C = this.C, o = C.createOscillator(), g = C.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
  }
  block(t: number, f: number, v: number, dest: AudioNode) {
    const C = this.C, o = C.createOscillator(), g = C.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.1);
  }
  cymbal(t: number, v: number, dest: AudioNode) {
    const C = this.C, s = C.createBufferSource(), hp = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 6000;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(hp); hp.connect(g); g.connect(dest); s.start(t, Math.random() * 0.3); s.stop(t + 0.65);
  }
  tone(f: number, t: number, d: number, type: OscillatorType, v: number, dest: AudioNode) {
    const C = this.C, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.02);
  }
}

// ── voices
export type Voice = { base: number; spread: number; wave: OscillatorType; rate: number; formant: number; v: number; rasp?: boolean };
export const VOICES: Record<string, Voice> = {
  kee: { base: 50, spread: 3, wave: 'triangle', rate: 0.11, formant: 700, v: 0.14 },
  mo: { base: 64, spread: 6, wave: 'sine', rate: 0.07, formant: 1400, v: 0.13 },
  pang: { base: 60, spread: 4, wave: 'triangle', rate: 0.09, formant: 1100, v: 0.13 },
  heron: { base: 69, spread: 5, wave: 'sawtooth', rate: 0.09, formant: 1700, v: 0.06 },
  ren: { base: 48, spread: 4, wave: 'sawtooth', rate: 0.1, formant: 600, v: 0.06 },
  kiri: { base: 70, spread: 6, wave: 'sine', rate: 0.07, formant: 1800, v: 0.13 },
  lim: { base: 79, spread: 8, wave: 'sine', rate: 0.06, formant: 2400, v: 0.1 },
  bo: { base: 43, spread: 3, wave: 'triangle', rate: 0.12, formant: 500, v: 0.16 },
  bristle: { base: 47, spread: 3, wave: 'square', rate: 0.1, formant: 650, v: 0.05, rasp: true },
  gizmo: { base: 67, spread: 7, wave: 'square', rate: 0.06, formant: 2000, v: 0.05 },
  glint: { base: 66, spread: 7, wave: 'sawtooth', rate: 0.08, formant: 1500, v: 0.06, rasp: true },
  pip: { base: 78, spread: 6, wave: 'square', rate: 0.05, formant: 2600, v: 0.045, rasp: true },
  dora: { base: 74, spread: 5, wave: 'sine', rate: 0.07, formant: 2000, v: 0.13 },
  enzo: { base: 65, spread: 5, wave: 'triangle', rate: 0.075, formant: 1500, v: 0.13 },
  crow: { base: 72, spread: 9, wave: 'sawtooth', rate: 0.06, formant: 1200, v: 0.05, rasp: true },
  warden: { base: 50, spread: 3, wave: 'square', rate: 0.1, formant: 700, v: 0.05, rasp: true },
};
export const voiceOf = (who: string) => VOICES[who] ?? VOICES.kee;
/** one syllable of a character's babble; `k` picks the syllable's pitch so a line always sounds the same */
export function syllable(C: AudioContext, dest: AudioNode, noise: AudioBuffer, vo: Voice, k: number, mood = 'calm') {
  const t = C.currentTime + 0.01;
  const lift = mood === 'happy' ? 2 : mood === 'worried' ? 3 : mood === 'cross' ? -2 : mood === 'smug' ? -1 : 0;
  const m = vo.base + lift + ((k * 7) % (vo.spread * 2 + 1)) - vo.spread;
  const d = vo.rate * (0.8 + ((k * 3) % 5) * 0.1);
  const o = C.createOscillator(), bp = C.createBiquadFilter(), g = C.createGain();
  o.type = vo.wave; o.frequency.setValueAtTime(mtof(m), t); o.frequency.exponentialRampToValueAtTime(mtof(m + (mood === 'worried' ? 2 : -1)), t + d);
  bp.type = 'bandpass'; bp.frequency.value = vo.formant; bp.Q.value = 1.2;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vo.v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(bp); bp.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.02);
  if (vo.rasp || k % 3 === 0) {
    const s = C.createBufferSource(), nb = C.createBiquadFilter(), ng = C.createGain(); s.buffer = noise; nb.type = 'bandpass'; nb.frequency.value = vo.formant * 1.8; nb.Q.value = 3;
    ng.gain.setValueAtTime(vo.rasp ? 0.08 : 0.03, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.connect(nb); nb.connect(ng); ng.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + 0.05);
  }
}

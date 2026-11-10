// Cloudsteel sounds, all synthesised with WebAudio: the whoosh of a cut, steel on steel for a guard, a bright ring
// for a deflect, a rising tone as a foe winds up (a low drone for a jade attack), a gong when posture breaks, the
// lantern's chime for Enzo, steady rain, and an original slow pentatonic theme on a breathy flute voice over a hand
// drum (written for this game), with a gentler walking tune for the climb; voices for talk, the lantern's chime, waking
// planks and stones, gates, pickups and footsteps. Silent until the first click, tap or key.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type SongId = 'menu' | 'explore' | 'fight' | 'boss' | 'ending';
const SONGS: Record<SongId, { root: number; bpm: number; lead: number[]; bass: number[]; drum: number[] }> = {
  menu: { root: 57, bpm: 76, lead: [0, -99, 3, 5, -99, 7, -99, 5, 3, -99, 0, -99, -2, -99, 0, -99], bass: [0, -99, -99, -99, 7, -99, -99, -99, 5, -99, -99, -99, 7, -99, -99, -99], drum: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  explore: { root: 62, bpm: 70, lead: [0, -99, -99, 2, 4, -99, 7, -99, 4, -99, 2, -99, 0, -99, -3, -99], bass: [0, -99, -99, -99, -99, -99, -99, -99, -5, -99, -99, -99, -99, -99, -99, -99], drum: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  fight: { root: 57, bpm: 118, lead: [12, -99, 10, 7, -99, 5, 7, -99, 3, -99, 5, 7, -99, 10, 7, -99], bass: [0, -99, 0, -99, 7, -99, 0, -99, 5, -99, 5, -99, 3, -99, 7, -99], drum: [2, 0, 1, 0, 1, 0, 1, 1, 2, 0, 1, 0, 1, 1, 1, 0] },
  boss: { root: 53, bpm: 128, lead: [12, 10, -99, 7, 5, -99, 7, 10, 12, -99, 15, -99, 12, 10, 7, -99], bass: [0, 0, -99, 0, 7, -99, 5, -99, 0, 0, -99, 0, 3, -99, 5, 7], drum: [2, 1, 1, 0, 2, 0, 1, 1, 2, 1, 1, 0, 2, 1, 1, 1] },
  ending: { root: 60, bpm: 84, lead: [0, 4, 7, -99, 9, 7, -99, 4, 7, -99, 12, -99, 9, -99, 7, -99], bass: [0, -99, -99, -99, 5, -99, -99, -99, 7, -99, -99, -99, 0, -99, -99, -99], drum: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0] },
};

export class CloudsteelSound {
  private ctx: AudioContext | null = null; private sfx: GainNode | null = null; private mus: GainNode | null = null; private noise: AudioBuffer | null = null;
  private rain: { s: AudioBufferSourceNode; g: GainNode } | null = null;
  private soundOn: boolean; private musicOn: boolean; private song: SongId | null = null; private step = 0; private nextAt = 0;
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC(); this.sfx = c.createGain(); this.mus = c.createGain(); this.sfx.connect(c.destination); this.mus.connect(c.destination);
      this.sfx.gain.value = this.soundOn ? 0.5 : 0; this.mus.gain.value = this.musicOn ? 0.22 : 0;
      const b = this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  suspend() { void this.ctx?.suspend(); } resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume(); }
  dispose() { void this.ctx?.close(); this.ctx = null; }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx) this.sfx.gain.value = on ? 0.5 : 0; }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus) this.mus.gain.value = on ? 0.22 : 0; }
  private tone(f: number, dur: number, type: OscillatorType, vol: number, to?: number, at = 0, out?: GainNode | null) {
    const c = this.ctx, o = out ?? this.sfx; if (!c || !o) return;
    const t = c.currentTime + at, osc = c.createOscillator(), g = c.createGain(); osc.type = type; osc.frequency.setValueAtTime(f, t); if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + dur + 0.02);
  }
  private hiss(dur: number, f: number, q: number, vol: number, to?: number, at = 0, out?: GainNode | null) {
    const c = this.ctx, o = out ?? this.sfx; if (!c || !o || !this.noise) return;
    const t = c.currentTime + at, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t); if (to) bp.frequency.exponentialRampToValueAtTime(to, t + dur); bp.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bp); bp.connect(g); g.connect(o); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  button() { this.tone(660, 0.07, 'triangle', 0.25, 880); }
  swing(n: number) { this.hiss(0.16 + n * 0.04, 900 + n * 300, 1.2, 0.5, 2600); }
  hit(heavy: boolean) { this.hiss(0.12, 500, 0.8, 0.7, 180); this.tone(heavy ? 150 : 220, 0.12, 'square', 0.25, 70); }
  deflect() { for (const f of [1760, 2640, 3520]) this.tone(f, 0.5, 'sine', 0.3, f * 0.99); this.hiss(0.06, 5000, 2, 0.6); }
  block() { this.tone(520, 0.14, 'square', 0.22, 300); this.hiss(0.08, 2400, 2, 0.4); }
  parried() { this.tone(900, 0.18, 'triangle', 0.3, 500); this.hiss(0.06, 3500, 2, 0.4); }
  hurt() { this.tone(180, 0.25, 'sawtooth', 0.35, 60); this.hiss(0.2, 300, 0.7, 0.6, 100); }
  dodge() { this.hiss(0.22, 600, 0.8, 0.45, 1800); }
  tell(jade: boolean) { if (jade) { this.tone(110, 0.9, 'sawtooth', 0.22, 180); this.tone(165, 0.9, 'sine', 0.2, 270); } else this.tone(1200, 0.35, 'sine', 0.16, 2400); }
  broken() { this.tone(98, 1.4, 'sine', 0.6, 92); this.tone(196, 1.1, 'triangle', 0.3, 190); this.hiss(0.3, 800, 0.6, 0.4, 200); }
  finisher() { this.hiss(0.3, 1200, 1, 0.7, 4000); this.tone(330, 0.5, 'triangle', 0.4, 990, 0.12); this.tone(110, 0.5, 'square', 0.3, 50, 0.15); }
  tagReady() { [0, 4, 7].forEach((s, i) => this.tone(hz(76 + s), 0.25, 'sine', 0.22, undefined, i * 0.07)); }
  tag() { [0, 3, 7, 10, 12].forEach((s, i) => this.tone(hz(69 + s), 0.5, 'sine', 0.28, undefined, i * 0.05)); this.hiss(0.5, 1500, 0.8, 0.4, 6000, 0.25); }
  round() { this.tone(147, 1.0, 'sine', 0.5, 140); this.tone(294, 0.8, 'triangle', 0.2, 290); }
  clear() { [0, 5, 7, 12].forEach((s, i) => this.tone(hz(69 + s), 0.3, 'triangle', 0.3, undefined, i * 0.11)); }
  won() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(hz(64 + s), 0.5, 'triangle', 0.32, undefined, i * 0.14)); }
  lost() { [0, -2, -5, -9].forEach((s, i) => this.tone(hz(62 + s), 0.5, 'triangle', 0.3, undefined, i * 0.2)); }
  /** a short voice blip for a line of talk: Dora, Enzo, or anyone else */
  talk(who: number) { const f = [880, 660, 520][who] ?? 520; this.tone(f, 0.06, 'triangle', 0.14, f * 1.12); this.tone(f * 1.5, 0.05, 'sine', 0.08, undefined, 0.05); }
  lantern() { [0, 7, 12, 16].forEach((s, i) => this.tone(hz(76 + s), 0.6, 'sine', 0.2, undefined, i * 0.06)); this.hiss(0.5, 3000, 1.5, 0.15, 6000); }
  plank() { this.tone(hz(83), 0.4, 'sine', 0.16, hz(88)); this.tone(220, 0.15, 'triangle', 0.15, 160); }
  stone() { this.tone(98, 1.2, 'sine', 0.45, 110); [0, 4, 7].forEach((s, i) => this.tone(hz(72 + s), 0.7, 'sine', 0.18, undefined, 0.1 + i * 0.1)); }
  gate() { this.hiss(1.6, 120, 0.6, 0.6, 60); this.tone(65, 1.6, 'sawtooth', 0.18, 50); [0, 5, 7, 12].forEach((s, i) => this.tone(hz(67 + s), 0.6, 'triangle', 0.22, undefined, 0.6 + i * 0.12)); }
  got(big: boolean) { (big ? [0, 4, 7, 11, 14] : [0, 7, 12]).forEach((s, i) => this.tone(hz(79 + s), 0.35, 'sine', 0.24, undefined, i * 0.07)); }
  cold() { this.tone(330, 0.3, 'sine', 0.15, 250); }
  footstep() { this.hiss(0.05, 900 + Math.random() * 400, 1.5, 0.09); }
  /** rain under everything while a fight is on */
  ambience(on: boolean) {
    const c = this.ctx; if (!c || !this.sfx || !this.noise) return;
    if (on && !this.rain) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = 'highpass'; f.frequency.value = 2200; g.gain.value = 0.07; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); this.rain = { s, g }; }
    if (!on && this.rain) { this.rain.s.stop(); this.rain = null; }
  }
  music(id: SongId | null) { if (id === this.song) return; this.song = id; this.step = 0; this.nextAt = 0; }
  /** call every frame: schedules the next notes of the song */
  pump() {
    const c = this.ctx, id = this.song; if (!c || !id || !this.mus) return;
    const s = SONGS[id], len = 60 / s.bpm / 2; if (this.nextAt < c.currentTime) this.nextAt = c.currentTime + 0.05;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step % 16, at = this.nextAt - c.currentTime, l = s.lead[i], b = s.bass[i], d = s.drum[i];
      if (l > -99) { this.tone(hz(s.root + 12 + l), len * 1.8, 'sine', 0.5, undefined, at, this.mus); this.hiss(len * 1.2, hz(s.root + 12 + l) * 2, 6, 0.25, undefined, at, this.mus); }
      if (b > -99) this.tone(hz(s.root - 12 + b), len * 1.6, 'triangle', 0.5, undefined, at, this.mus);
      if (d) this.tone(d === 2 ? 90 : 140, 0.16, 'sine', d === 2 ? 0.8 : 0.4, 50, at, this.mus);
      this.nextAt += len; this.step++;
    }
  }
}

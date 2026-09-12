// Procedural sound for Dusty Hollow: an ambient pad that changes with the time of
// day, rain and sea loops built from filtered noise, and short effect cues.
export type Mood = 'day' | 'evening' | 'night';

const CHORDS: Record<Mood, number[][]> = {
  day: [[261.6, 329.6, 392.0, 523.3], [293.7, 349.2, 440.0, 587.3], [220.0, 261.6, 329.6, 440.0], [246.9, 293.7, 392.0, 493.9]],
  evening: [[220.0, 261.6, 329.6, 392.0], [196.0, 246.9, 293.7, 392.0], [174.6, 220.0, 261.6, 349.2], [196.0, 233.1, 293.7, 349.2]],
  night: [[146.8, 174.6, 220.0, 293.7], [130.8, 164.8, 196.0, 261.6], [110.0, 146.8, 174.6, 220.0], [123.5, 146.8, 185.0, 246.9]],
};
const CUES: Record<string, [number, number, OscillatorType][]> = {
  catch: [[523, 0.12, 'triangle'], [659, 0.12, 'triangle'], [784, 0.25, 'triangle']],
  goal: [[659, 0.1, 'triangle'], [784, 0.1, 'triangle'], [988, 0.1, 'triangle'], [1319, 0.4, 'triangle']],
  coin: [[1046, 0.08, 'square'], [1318, 0.12, 'square']],
  talk: [[440, 0.06, 'sine'], [520, 0.08, 'sine']],
  dig: [[180, 0.14, 'sawtooth']],
  shake: [[330, 0.06, 'triangle'], [392, 0.1, 'triangle']],
  miss: [[220, 0.12, 'sawtooth'], [160, 0.25, 'sawtooth']],
  bite: [[990, 0.06, 'square'], [1200, 0.06, 'square']],
  nibble: [[700, 0.05, 'sine']],
  hook: [[600, 0.08, 'square'], [900, 0.14, 'square']],
  cast: [[520, 0.1, 'sine']],
  water: [[700, 0.05, 'sine'], [900, 0.1, 'sine']],
  flee: [[880, 0.05, 'sine'], [660, 0.08, 'sine']],
  star: [[1568, 0.15, 'sine'], [2093, 0.3, 'sine']],
  swap: [[500, 0.05, 'square']],
};

export class HollowSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private pad: { osc: OscillatorNode; gain: GainNode }[] = [];
  private padTimer = 0;
  private padChord = 0;
  private mood: Mood = 'day';
  private rain: GainNode | null = null;
  private sea: GainNode | null = null;
  private music = 0.5;
  private effects = 0.7;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = i % 2 ? 'triangle' : 'sine';
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.pad.push({ osc, gain });
    }
    this.rain = this.noiseLoop(ctx, 'highpass', 1800, 0.35);
    this.sea = this.noiseLoop(ctx, 'lowpass', 320, 0.45);
    this.setChord(true);
  }
  stop() {
    if (!this.ctx) return;
    void this.ctx.suspend();
  }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  setLevels(music: number, effects: number) {
    this.music = music; this.effects = effects;
    for (const p of this.pad) p.gain.gain.setTargetAtTime(this.padLevel(), this.ctx?.currentTime ?? 0, 0.5);
  }
  private padLevel() { return 0.035 * this.music; }
  private noiseLoop(ctx: AudioContext, type: BiquadFilterType, freq: number, lfoRate: number) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; data[i] = type === 'lowpass' ? last * 3.5 : w; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = lfoRate; lfoGain.gain.value = 0.4;
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    lfo.connect(lfoGain).connect(swell.gain);
    src.connect(filter).connect(swell).connect(gain).connect(this.master!);
    src.start(); lfo.start();
    return gain;
  }
  /** Called every frame with the game's state. */
  update(dt: number, hour: number, weather: 'clear' | 'rain' | 'snow', nearSea: boolean) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const mood: Mood = hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'evening' : 'night';
    if (mood !== this.mood) { this.mood = mood; this.padChord = 0; this.setChord(); }
    this.padTimer -= dt;
    if (this.padTimer <= 0) { this.padChord = (this.padChord + 1) % 4; this.setChord(); }
    const t = this.ctx.currentTime;
    this.rain?.gain.setTargetAtTime(weather === 'rain' ? 0.12 * this.music : 0, t, 1.5);
    this.sea?.gain.setTargetAtTime(nearSea ? 0.16 * this.music : 0.03 * this.music, t, 2);
  }
  private setChord(first = false) {
    if (!this.ctx) return;
    const chord = CHORDS[this.mood][this.padChord];
    const t = this.ctx.currentTime;
    this.pad.forEach((p, i) => {
      p.osc.frequency.setTargetAtTime(chord[i] / 2, t, first ? 0 : 0.8);
      p.gain.gain.setTargetAtTime(this.padLevel() * (i === 0 ? 1.2 : 0.8), t, 1.2);
    });
    this.padTimer = 5 + Math.random() * 3;
  }
  cue(kind: string) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || document.hidden || !this.master) return;
    const notes = CUES[kind];
    if (!notes) return;
    let t = c.currentTime;
    for (const [freq, len, wave] of notes) {
      const osc = c.createOscillator(), env = c.createGain();
      osc.type = wave; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.09 * this.effects, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(env).connect(this.master);
      osc.start(t); osc.stop(t + len + 0.02);
      t += len * 0.7;
    }
  }
}

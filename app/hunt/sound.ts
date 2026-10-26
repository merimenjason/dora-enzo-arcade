/** Quiet synthesised woodland cues; unlocked by a gesture and closed on page exit. */
export class HuntSound {
  private context: AudioContext | null = null;
  private off = false;
  constructor() { try { this.off = localStorage.getItem('grumble-hunt-sound-v1') === 'off'; } catch { /* optional storage */ } }
  muted() { return this.off; }
  setMuted(off: boolean) { this.off = off; try { localStorage.setItem('grumble-hunt-sound-v1', off ? 'off' : 'on'); } catch { /* optional storage */ } }
  unlock() { if (!this.context) { try { this.context = new AudioContext(); } catch { return; } } if (this.context.state === 'suspended') void this.context.resume().catch(() => {}); }
  cue(kind: string) {
    const c = this.context; if (this.off || !c || c.state !== 'running') return;
    if (kind in SHAPED) { SHAPED[kind](c); return; }
    const notes: Record<string, number> = { 'charge-1': 784, 'charge-2': 1046, guard: 520, 'hop-on': 620, 'ride-bonk': 820, 'buck-warning': 330, 'shaken-off': 410, plop: 260, bonk: 190, dizzy: 660, berry: 880, part: 740, nap: 523, bump: 140, shoot: 470, item: 830, interact: 392, grumpy: 247, sniff: 988, order: 587, gather: 698, trap: 311, craft: 784, tired: 294, snooze: 220, intro: 349, roar: 165, covered: 233, weather: 300, visitor: 370, 'turf-warning': 311, turf: 131, vine: 587, cling: 523, soft: 880, yank: 247, wall: 110, sling: 740, plink: 1175, fruit: 659, knockdown: 196, 'hazard-warning': 392, hazard: 131, finch: 988, wander: 247, away: 330, travel: 523, finisher: 1319, quest: 1047 };
    const osc = c.createOscillator(), gain = c.createGain(), now = c.currentTime, duration = kind === 'nap' ? 0.5 : 0.15;
    osc.type = 'sine'; osc.frequency.setValueAtTime(notes[kind] ?? 440, now); osc.frequency.exponentialRampToValueAtTime((notes[kind] ?? 440) * (kind === 'bonk' ? 0.45 : 1.3), now + duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.06, now + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(c.destination); osc.start(now); osc.stop(now + duration + 0.02); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  dispose() { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}

/** One quiet note: a waveform gliding from one pitch to another, with a soft attack and a fading tail. */
function note(c: AudioContext, type: OscillatorType, from: number, to: number, at: number, duration: number, level = 0.05) {
  const osc = c.createOscillator(), gain = c.createGain(), now = c.currentTime + at;
  osc.type = type; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain); gain.connect(c.destination); osc.start(now); osc.stop(now + duration + 0.02); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
/** A burst of filtered noise, for water and earth. */
function hiss(c: AudioContext, filter: BiquadFilterType, from: number, to: number, duration: number, level: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource(), shape = c.createBiquadFilter(), gain = c.createGain(), now = c.currentTime;
  source.buffer = buffer; shape.type = filter; shape.frequency.setValueAtTime(from, now); shape.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(shape); shape.connect(gain); gain.connect(c.destination); source.start(now); source.onended = () => { source.disconnect(); shape.disconnect(); gain.disconnect(); };
}
/** Cues with more shape than one blip: the river friends' moves, every Mighty move and the finale ribbon. */
const SHAPED: Record<string, (c: AudioContext) => void> = {
  // Paddlepaw's splash: a bright wash of water falling away.
  splash: (c) => { hiss(c, 'bandpass', 2600, 700, 0.42, 0.07); note(c, 'sine', 900, 1500, 0.02, 0.12, 0.025); },
  // Rumblesnout digging down: a low earthy rumble.
  dig: (c) => { hiss(c, 'lowpass', 420, 120, 0.55, 0.08); note(c, 'triangle', 82, 55, 0, 0.5, 0.05); },
  // ...and popping back up.
  pop: (c) => { note(c, 'sine', 260, 720, 0, 0.12, 0.06); hiss(c, 'lowpass', 900, 300, 0.18, 0.04); },
  // Any Mighty move: a rising golden shimmer under the usual orange warning.
  mighty: (c) => { [523, 659, 784, 1047].forEach((f, i) => note(c, 'triangle', f, f * 1.01, i * 0.06, 0.28, 0.035)); },
  // The Best of Friends ribbon: a little fanfare.
  keepsake: (c) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(c, 'sine', f, f, i * 0.11, i === 5 ? 0.7 : 0.22, 0.05)); },
};


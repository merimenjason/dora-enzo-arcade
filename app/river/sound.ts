import type { RiverEvent } from '../../lib/river-game';

const scores = [
  { notes: [55, 62, 64, 67, 64, 62, 57, 60], pace: .38, voice: 'sine' },
  { notes: [50, 57, 60, 57, 53, 55, 57, 48], pace: .28, voice: 'triangle' },
  { notes: [62, 69, 72, 74, 69, 67, 65, 67], pace: .33, voice: 'sine' },
  { notes: [43, 55, 58, 62, 55, 53, 58, 50], pace: .54, voice: 'sine' },
  { notes: [54, 66, 61, 69, 57, 64, 59, 62], pace: .43, voice: 'sine' },
  { notes: [48, 60, 64, 67, 55, 65, 64, 60], pace: .36, voice: 'triangle' },
] as const;
const notes: Record<RiverEvent, number> = {
  gate: 53, launch: 68, moor: 64, wheel: 55, hurt: 38, jump: 60, mark: 79, stake: 47, clear: 72, tag: 65,
};
export class RiverSound {
  private context?: AudioContext;
  private next = 0;
  private n = 0;
  private district = -1;
  music = true;
  effects = true;

  async ready() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state !== 'running') await this.context.resume();
    } catch { /* audio is optional when a browser denies playback */ }
  }
  private tone(note: number, at: number, duration: number, gain: number, voice: OscillatorType) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;
    const osc = ctx.createOscillator(), volume = ctx.createGain();
    osc.type = voice;
    osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
    volume.gain.setValueAtTime(.0001, at);
    volume.gain.exponentialRampToValueAtTime(gain, at + .018);
    volume.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(volume).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + .008);
  }
  play(event: RiverEvent) {
    const ctx = this.context;
    if (!ctx || !this.effects) return;
    const at = ctx.currentTime;
    this.tone(notes[event], at, .16, .045, 'triangle');
    if (event === 'wheel' || event === 'clear' || event === 'mark') this.tone(notes[event] + 7, at + .11, .24, .04, 'sine');
  }
  score(area: number) {
    const ctx = this.context;
    if (!this.music || !ctx || ctx.state !== 'running') return;
    const score = scores[area];
    if (this.district !== area || this.next < ctx.currentTime - .1) { this.next = ctx.currentTime + .03; this.n = 0; this.district = area; }
    if (ctx.currentTime + .14 < this.next) return;
    const note = score.notes[this.n % 8];
    this.tone(note, this.next, score.pace * .98, .026, score.voice);
    if (this.n % 2 === 0) this.tone(score.notes[0] - 12, this.next, score.pace * 1.65, .019, 'sine');
    if (area === 1 || area === 5) this.tone(30, this.next + .04, .09, .013, 'triangle');
    this.n++;
    this.next += score.pace;
  }
  close() { void this.context?.close(); }
}

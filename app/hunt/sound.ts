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
    const notes: Record<string, number> = { 'charge-1': 784, 'charge-2': 1046, guard: 520, 'hop-on': 620, 'ride-bonk': 820, 'buck-warning': 330, 'shaken-off': 410, plop: 260, bonk: 190, dizzy: 660, berry: 880, part: 740, nap: 523, bump: 140, shoot: 470, item: 830, interact: 392, grumpy: 247, sniff: 988, order: 587, gather: 698, trap: 311, craft: 784 };
    const osc = c.createOscillator(), gain = c.createGain(), now = c.currentTime, duration = kind === 'nap' ? 0.5 : 0.15;
    osc.type = 'sine'; osc.frequency.setValueAtTime(notes[kind] ?? 440, now); osc.frequency.exponentialRampToValueAtTime((notes[kind] ?? 440) * (kind === 'bonk' ? 0.45 : 1.3), now + duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.06, now + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(c.destination); osc.start(now); osc.stop(now + duration + 0.02); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  dispose() { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}

// Overclock sounds, all synthesised with WebAudio. Original synth-chiptune loops in a 16-bit action style: a pulse
// lead, a fast square arpeggio, a driving octave bass, a noise snare and hats. One tune per area, the hub, a boss
// theme, Lumen's theme, a title and an ending. Effects for every engine sound id. Silent until the first input.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export type Track = 'title' | 'hub' | 'roof' | 'port' | 'signs' | 'depot' | 'arcade' | 'highway' | 'scrap' | 'observatory' | 'plant' | 'tower' | 'boss' | 'lumen' | 'ending' | 'off';
// 32 sixteenths per bar-group: chords one per 8 steps; melody -1 rests; drum 'k' kick, 's' snare, 'h' hat
type Song = { bpm: number; chords: number[][]; mel: number[]; drum: string; lead: OscillatorType; arp: boolean };
const R = -1;
const SONGS: Record<Exclude<Track, 'off'>, Song> = {
  title: { bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], drum: 'k...h...s...h...k...h...s...h.h.', lead: 'square', arp: true,
    mel: [76, R, R, R, 79, R, 76, R, 74, R, 72, R, 71, R, R, R, 72, R, R, R, 74, R, 76, R, 79, R, 81, R, 79, R, R, R] },
  hub: { bpm: 96, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], drum: 'k.......s.......k...k...s.......', lead: 'triangle', arp: true,
    mel: [72, R, 76, R, 79, R, 76, R, 81, R, R, 79, R, 76, R, R, 77, R, 76, R, 74, R, 72, R, 74, R, R, R, 67, R, R, R] },
  roof: { bpm: 150, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [57, 61, 64]], drum: 'k.h.s.h.k.h.s.h.k.h.s.h.k.k.s.hh', lead: 'square', arp: true,
    mel: [69, R, 72, R, 76, R, 74, 72, 71, R, 72, R, 74, R, R, R, 72, R, 76, R, 79, R, 77, 76, 74, R, 76, R, 73, R, R, R] },
  port: { bpm: 138, chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]], drum: 'k.h.s.hkk.h.s.h.k.h.s.hkk.h.s.hh', lead: 'square', arp: true,
    mel: [79, R, 78, 76, R, 74, 76, R, 79, R, 83, R, 81, R, 79, R, 76, R, 74, 72, R, 71, 72, R, 74, R, 76, R, 78, R, R, R] },
  signs: { bpm: 144, chords: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]], drum: 'k.hhs.h.k.hhs.h.k.hhs.h.k.k.s.hh', lead: 'sawtooth', arp: true,
    mel: [76, 76, R, 79, R, 76, R, 74, 72, R, 71, R, 72, R, 74, R, 76, 76, R, 79, R, 81, R, 83, 81, R, 79, R, 78, R, R, R] },
  depot: { bpm: 132, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], drum: 'k...s.h.k.k.s.h.k...s.h.k.k.s.hh', lead: 'square', arp: false,
    mel: [74, R, R, 72, R, 74, R, 77, 76, R, 74, R, 72, R, 69, R, 70, R, R, 72, R, 74, R, 77, 76, R, 73, R, 69, R, R, R] },
  arcade: { bpm: 156, chords: [[60, 64, 67], [57, 60, 64], [62, 65, 69], [55, 59, 62]], drum: 'khh.shh.khh.shh.khh.shh.kkh.shhh', lead: 'square', arp: true,
    mel: [84, R, 79, R, 76, R, 79, 84, 86, R, 84, R, 81, R, R, R, 81, R, 77, R, 74, R, 77, 81, 83, R, 79, R, 74, R, 79, R] },
  highway: { bpm: 160, chords: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 54, 57]], drum: 'k.h.s.h.k.h.s.hhk.h.s.h.k.hks.hh', lead: 'sawtooth', arp: true,
    mel: [64, R, 67, R, 71, R, 74, R, 76, R, 74, 71, R, 67, R, R, 72, R, 71, R, 67, R, 64, R, 66, R, 67, R, 69, R, 71, R] },
  scrap: { bpm: 128, chords: [[45, 48, 52], [43, 47, 50], [41, 45, 48], [40, 44, 47]], drum: 'k..ks.h.k..ks.h.k..ks.h.k.kks.hh', lead: 'square', arp: false,
    mel: [69, R, R, 72, 71, R, 69, R, 67, R, R, 64, R, R, 67, R, 69, R, R, 72, 74, R, 76, R, 75, R, 71, R, 68, R, R, R] },
  observatory: { bpm: 112, chords: [[57, 61, 64, 68], [54, 57, 61, 64], [50, 54, 57, 61], [52, 56, 59, 62]], drum: 'k.......s.......k.....k.s.......', lead: 'triangle', arp: true,
    mel: [80, R, R, R, 78, R, 76, R, 73, R, R, R, 76, R, R, R, 78, R, R, R, 81, R, 80, R, 76, R, R, R, R, R, R, R] },
  plant: { bpm: 124, chords: [[50, 53, 57], [49, 52, 56], [46, 50, 53], [45, 49, 52]], drum: 'k...h...s...h.h.k...h...s...hhh.', lead: 'square', arp: true,
    mel: [74, R, R, R, 77, R, 76, R, 73, R, R, R, R, R, 69, R, 70, R, R, R, 74, R, 73, R, 69, R, R, R, 64, R, R, R] },
  tower: { bpm: 146, chords: [[47, 50, 54], [43, 47, 50], [45, 48, 52], [42, 46, 49]], drum: 'k.hks.h.k.hks.h.k.hks.h.kkhks.hh', lead: 'sawtooth', arp: true,
    mel: [71, R, 74, R, 78, R, 76, 74, 73, R, 71, R, 73, R, 74, R, 76, R, 79, R, 78, R, 76, 74, 73, R, 74, R, 70, R, R, R] },
  boss: { bpm: 168, chords: [[52, 55, 59], [52, 55, 59], [53, 57, 60], [51, 54, 59]], drum: 'k.hks.hkk.hks.hkk.hks.hkkkhks.hh', lead: 'square', arp: true,
    mel: [76, 76, R, 79, R, 76, 75, R, 76, R, 71, R, 72, 74, 76, R, 77, R, 76, R, 74, R, 72, 74, 75, R, 71, R, 67, R, 71, R] },
  lumen: { bpm: 120, chords: [[45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53], [44, 47, 50, 53]], drum: 'k...s...k.k.s...k...s...k.k.s.hh', lead: 'sawtooth', arp: true,
    mel: [81, R, R, R, 79, R, 76, R, 77, R, R, R, 76, R, 74, R, 72, R, R, R, 74, R, 76, R, 80, R, R, R, R, R, R, R] },
  ending: { bpm: 92, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], drum: 'k.......s.......k.......s.......', lead: 'triangle', arp: true,
    mel: [79, R, R, R, 76, R, 79, R, 84, R, R, R, 83, R, 81, R, 79, R, R, R, 77, R, 76, R, 74, R, R, R, 72, R, R, R] },
};

export class OverclockSound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null; private mus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundOn: boolean; private musicOn: boolean;
  private track: Track = 'off';
  private step = 0; private nextAt = 0; private timer: ReturnType<typeof setInterval> | null = null;
  private last = new Map<string, number>();
  constructor(sound: boolean, music: boolean) { this.soundOn = sound; this.musicOn = music; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext({ latencyHint: 'interactive' }); } catch { return; }
      const c = this.ctx;
      const master = c.createGain(); master.gain.value = 0.55; master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.soundOn ? 1 : 0; this.sfx.connect(comp);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.connect(comp);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.14 : 0; this.mus.connect(lp);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      let seed = 4321; for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
      this.noise = n;
      this.nextAt = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  setSound(on: boolean) { this.soundOn = on; if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setMusic(on: boolean) { this.musicOn = on; if (this.mus && this.ctx) this.mus.gain.setTargetAtTime(on ? 0.14 : 0, this.ctx.currentTime, 0.1); }
  setTrack(t: Track) { if (t !== this.track) { this.track = t; this.step = 0; if (this.ctx) this.nextAt = this.ctx.currentTime + 0.15; } }
  suspend() { void this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {}); }
  dispose() { if (this.timer) clearInterval(this.timer); void this.ctx?.close().catch(() => {}); this.ctx = null; }

  private tone(f: number, t: number, len: number, vol: number, type: OscillatorType = 'square', to = 0, out: AudioNode | null = this.sfx, attack = 0.003) {
    const c = this.ctx; if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.03);
  }
  private hiss(t: number, len: number, vol: number, f: number, q = 1, type: BiquadFilterType = 'bandpass', to = 0, out: AudioNode | null = this.sfx) {
    const c = this.ctx; if (!c || !out || !this.noise) return;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + len); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, (t * 3.7) % 0.9); s.stop(t + len + 0.03);
  }
  private get now() { return this.ctx?.currentTime ?? 0; }

  private schedule() {
    const c = this.ctx; if (!c || !this.mus) return;
    if (this.track === 'off') { this.nextAt = c.currentTime + 0.1; return; }
    const s = SONGS[this.track], st = 60 / s.bpm / 4;
    while (this.nextAt < c.currentTime + 0.2) {
      const i = this.step % 32, t = this.nextAt, ch = s.chords[(i / 8) | 0];
      // octave bass on the eighths
      if (i % 2 === 0) this.tone(hz(ch[0] - 12 + (i % 4 === 2 ? 12 : 0)), t, st * 1.8, 0.13, 'triangle', 0, this.mus);
      // the arpeggio
      if (s.arp) this.tone(hz(ch[i % ch.length] + 12), t, st * 0.9, 0.022, 'square', 0, this.mus);
      const d = s.drum[i];
      if (d === 'k') this.tone(140, t, 0.12, 0.22, 'sine', 45, this.mus);
      else if (d === 's') { this.hiss(t, 0.12, 0.07, 1800, 0.7, 'bandpass', 0, this.mus); this.tone(220, t, 0.06, 0.04, 'triangle', 120, this.mus); }
      else if (d === 'h') this.hiss(t, 0.03, 0.025, 8000, 1, 'highpass', 0, this.mus);
      const m = s.mel[i];
      if (m > 0) {
        let len = 1; while (i + len < 32 && s.mel[i + len] === R && len < 6) len++;
        this.tone(hz(m), t, st * len * 0.92, s.lead === 'triangle' ? 0.07 : 0.04, s.lead, 0, this.mus, 0.006);
        if (s.lead !== 'triangle') this.tone(hz(m) * 1.004, t, st * len * 0.9, 0.018, s.lead, 0, this.mus, 0.006);
      }
      this.nextAt += st; this.step++;
    }
  }

  /** One sound per game event id; repeats of the same sound are spaced out. */
  play(id: string) {
    const t = this.now;
    if (!this.ctx) return;
    const gap: Record<string, number> = { pellet: 0.045, blaster: 0.045, hitfoe: 0.03, clink: 0.06, bolt: 0.03, land: 0.08, climb: 0.12, hover: 0.15, magnetpull: 0.12 };
    const prev = this.last.get(id) ?? -1;
    if (t - prev < (gap[id] ?? 0.02)) return;
    this.last.set(id, t);
    switch (id) {
      case 'jump': this.tone(300, t, 0.1, 0.07, 'square', 700); break;
      case 'walljump': this.tone(360, t, 0.1, 0.07, 'square', 820); this.hiss(t, 0.05, 0.04, 2000); break;
      case 'hop': this.tone(420, t, 0.08, 0.05, 'square', 640); break;
      case 'land': this.hiss(t, 0.05, 0.05, 500, 1, 'lowpass'); break;
      case 'dash': this.hiss(t, 0.18, 0.09, 3200, 0.8, 'bandpass', 800); this.tone(180, t, 0.12, 0.04, 'sawtooth', 90); break;
      case 'climb': this.tone(220, t, 0.04, 0.03, 'square', 260); break;
      case 'hover': this.hiss(t, 0.16, 0.04, 1200, 2, 'bandpass', 1600); break;
      case 'hoverend': this.tone(400, t, 0.08, 0.03, 'triangle', 200); break;
      case 'pellet': case 'blaster': case 'blast': this.tone(880, t, 0.06, 0.04, 'square', 440); break;
      case 'charge': this.tone(220, t, 0.4, 0.04, 'sawtooth', 880); break;
      case 'blast3': this.tone(140, t, 0.3, 0.12, 'sawtooth', 60); this.hiss(t, 0.25, 0.1, 2000, 0.6, 'bandpass', 400); break;
      case 'hitfoe': this.tone(200, t, 0.06, 0.08, 'square', 80); break;
      case 'hitboss': this.tone(150, t, 0.1, 0.12, 'square', 60); this.hiss(t, 0.06, 0.08, 2500); break;
      case 'weak': this.tone(300, t, 0.15, 0.12, 'sawtooth', 80); this.hiss(t, 0.12, 0.1, 3000); this.tone(1200, t + 0.03, 0.08, 0.05, 'square'); break;
      case 'clink': this.tone(2400, t, 0.04, 0.03, 'square', 1800); break;
      case 'pop': case 'burst': this.hiss(t, 0.2, 0.12, 900, 0.6, 'bandpass', 200); this.tone(160, t, 0.15, 0.08, 'square', 50); break;
      case 'bigboom': this.hiss(t, 0.8, 0.18, 1200, 0.5, 'lowpass', 100); this.tone(80, t, 0.6, 0.2, 'sine', 30); break;
      case 'hurt': this.tone(500, t, 0.18, 0.1, 'square', 120); break;
      case 'down': this.tone(440, t, 0.6, 0.1, 'triangle', 110); break;
      case 'fall': this.tone(600, t, 0.4, 0.08, 'triangle', 150); break;
      case 'fail': [69, 65, 62, 57].forEach((m, i) => this.tone(hz(m), t + i * 0.16, 0.35, 0.07, 'square')); break;
      case 'bolt': this.tone(hz(88), t, 0.05, 0.04, 'square'); this.tone(hz(95), t + 0.04, 0.08, 0.04, 'square'); break;
      case 'heal': case 'energy': this.tone(hz(84), t, 0.12, 0.05, 'triangle', hz(91)); break;
      case 'tank': [72, 76, 79, 84].forEach((m, i) => this.tone(hz(m), t + i * 0.05, 0.2, 0.05, 'square')); break;
      case 'capsule': [72, 76, 79, 84, 88, 91].forEach((m, i) => this.tone(hz(m), t + i * 0.08, 0.35, 0.06, 'square')); break;
      case 'check': [76, 83].forEach((m, i) => this.tone(hz(m), t + i * 0.08, 0.25, 0.05, 'triangle')); break;
      case 'door': this.tone(90, t, 0.6, 0.12, 'sawtooth', 60); this.hiss(t, 0.5, 0.05, 600, 1, 'lowpass'); break;
      case 'tell': this.tone(hz(81), t, 0.08, 0.05, 'square'); this.tone(hz(81), t + 0.1, 0.08, 0.05, 'square'); break;
      case 'foetell': this.tone(hz(76), t, 0.06, 0.03, 'square'); break;
      case 'foeshot': this.tone(500, t, 0.08, 0.04, 'square', 300); break;
      case 'calm': [60, 64, 67, 72, 76].forEach((m, i) => this.tone(hz(m), t + i * 0.1, 0.5, 0.06, 'triangle')); break;
      case 'victory': [72, 72, 72, 76, 79, 84].forEach((m, i) => this.tone(hz(m), t + [0, 0.12, 0.24, 0.36, 0.5, 0.66][i], i === 5 ? 0.6 : 0.1, 0.06, 'square')); break;
      case 'teleport': this.tone(200, t, 0.4, 0.06, 'square', 1600); break;
      case 'tag': this.tone(hz(76), t, 0.06, 0.06, 'square'); this.tone(hz(83), t + 0.05, 0.1, 0.06, 'square'); this.hiss(t, 0.1, 0.05, 3000); break;
      case 'shield': this.tone(300, t, 0.2, 0.06, 'triangle', 600); break;
      case 'shieldoff': this.tone(500, t, 0.1, 0.03, 'triangle', 250); break;
      case 'reflect': this.tone(1500, t, 0.08, 0.05, 'square', 2200); break;
      case 'select': this.tone(hz(84), t, 0.05, 0.04, 'square'); break;
      case 'empty': this.tone(120, t, 0.12, 0.05, 'square'); break;
      case 'mount': this.tone(140, t, 0.3, 0.07, 'sawtooth', 280); break;
      case 'dismount': this.tone(280, t, 0.2, 0.05, 'sawtooth', 120); break;
      case 'crumble': this.hiss(t, 0.3, 0.12, 700, 0.6, 'lowpass', 200); break;
      case 'bump': this.tone(100, t, 0.06, 0.05, 'square'); break;
      case 'bounce': this.tone(400, t, 0.08, 0.05, 'square', 900); break;
      case 'slam': case 'quake': this.tone(70, t, 0.35, 0.2, 'sine', 35); this.hiss(t, 0.3, 0.1, 400, 0.6, 'lowpass'); break;
      case 'thunder': this.hiss(t, 0.7, 0.18, 2500, 0.4, 'lowpass', 200); break;
      case 'beam': case 'flare': this.tone(1200, t, 0.5, 0.05, 'sawtooth', 300); break;
      case 'magnet': case 'magnetpull': this.tone(110, t, 0.12, 0.05, 'sawtooth', 120); break;
      case 'spark': case 'zap': this.hiss(t, 0.08, 0.06, 5000, 2); break;
      case 'swarm': case 'fan': case 'prism': [84, 88, 91].forEach((m, i) => this.tone(hz(m), t + i * 0.03, 0.08, 0.03, 'square')); break;
      case 'drill': case 'drillboss': case 'dig': this.hiss(t, 0.25, 0.07, 300, 2, 'bandpass', 600); this.tone(80, t, 0.25, 0.04, 'sawtooth'); break;
      case 'throw': case 'toss': case 'spit': case 'glob': case 'mine': case 'decoy': case 'plate': case 'cloud': case 'strike': case 'mark': case 'ghost': case 'moon':
        this.tone(320, t, 0.12, 0.05, 'triangle', 520); break;
      case 'tongue': case 'lunge': case 'swoop': case 'sweep': case 'wind': case 'roll': this.hiss(t, 0.25, 0.08, 1500, 0.8, 'bandpass', 600); break;
      case 'fade': this.tone(600, t, 0.3, 0.04, 'sine', 200); break;
      case 'appear': this.tone(200, t, 0.3, 0.04, 'sine', 600); break;
      case 'buy': [79, 84, 88].forEach((m, i) => this.tone(hz(m), t + i * 0.05, 0.12, 0.05, 'square')); break;
      case 'menu': this.tone(hz(79), t, 0.04, 0.035, 'square'); break;
      default: this.tone(440, t, 0.05, 0.03, 'square');
    }
  }
}

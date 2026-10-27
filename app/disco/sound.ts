import { compose, type MusicEvent, type Song, type Judge } from '@/lib/disco-game';

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Songs are rendered once at this rate, in mono: plenty for these instruments and light on memory. */
const RATE = 24000;

type Kit = Record<'kick' | 'snare' | 'clap' | 'hat' | 'open', AudioBuffer>;
/** Renders each drum once as a short sample, so a song's thousands of hits are just buffer plays. */
async function kit(): Promise<Kit> {
  const one = async (dur: number, make: (c: OfflineAudioContext, noise: AudioBuffer) => void) => {
    const c = new OfflineAudioContext(1, Math.ceil(dur * RATE), RATE), b = c.createBuffer(1, RATE, RATE), d = b.getChannelData(0);
    // a fixed hash instead of Math.random, so the kit always sounds the same
    for (let i = 0; i < d.length; i++) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; d[i] = (x - Math.floor(x)) * 2 - 1; }
    make(c, b); return c.startRendering();
  };
  const hiss = (c: OfflineAudioContext, noise: AudioBuffer, type: BiquadFilterType, f: number, q: number, at: number, dur: number, level: number) => {
    const s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise; bq.type = type; bq.frequency.value = f; bq.Q.value = q;
    g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.0005, at + dur); s.connect(bq); bq.connect(g); g.connect(c.destination); s.start(at); s.stop(at + dur + 0.01);
  };
  const tone = (c: OfflineAudioContext, type: OscillatorType, from: number, to: number, dur: number, level: number) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(from, 0); o.frequency.exponentialRampToValueAtTime(to, Math.min(dur, 0.12));
    g.gain.setValueAtTime(level, 0); g.gain.exponentialRampToValueAtTime(0.001, dur); o.connect(g); g.connect(c.destination); o.start(0); o.stop(dur);
  };
  const [kick, snare, clap, hat, open] = await Promise.all([
    one(0.3, (c) => tone(c, 'sine', 150, 42, 0.28, 0.95)),
    one(0.2, (c, n) => { hiss(c, n, 'bandpass', 1900, 0.8, 0, 0.16, 0.5); tone(c, 'triangle', 190, 180, 0.09, 0.35); }),
    one(0.25, (c, n) => { for (let k = 0; k < 3; k++) hiss(c, n, 'bandpass', 1300, 1.4, k * 0.012, 0.12 + k * 0.03, 0.45); }),
    one(0.06, (c, n) => hiss(c, n, 'highpass', 7000, 1, 0, 0.045, 0.24)),
    one(0.25, (c, n) => hiss(c, n, 'highpass', 6400, 1, 0, 0.22, 0.2)),
  ]);
  return { kick, snare, clap, hat, open };
}
let kitReady: Promise<Kit> | null = null;

/** The band: plays a song's score into an offline context, so the whole song is rendered ahead of time. */
class Band {
  private echo: GainNode;
  constructor(private c: BaseAudioContext, private song: Song, private out: AudioNode, private drums: Kit) {
    // a soft echo instead of a room: cheap to render
    const d = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
    d.delayTime.value = (60 / song.bpm) * 0.75; fb.gain.value = 0.28; lp.type = 'lowpass'; lp.frequency.value = 2200; wet.gain.value = 0.22;
    this.echo = c.createGain(); this.echo.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(out);
  }
  private env(g: GainNode, at: number, peak: number, attack: number, dur: number, release: number) {
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + Math.max(attack, dur - release)); g.gain.exponentialRampToValueAtTime(0.0005, at + dur + release);
  }
  private osc(type: OscillatorType, f: number, at: number, stop: number, to: AudioNode, detune = 0) {
    const o = this.c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.detune.value = detune; o.connect(to); o.start(at); o.stop(stop); return o;
  }
  private hit(buf: AudioBuffer, at: number, level: number) {
    const s = this.c.createBufferSource(), g = this.c.createGain(); s.buffer = buf; g.gain.value = level; s.connect(g); g.connect(this.out); s.start(at);
  }
  play(e: MusicEvent, at: number) {
    const c = this.c, v = e.vel, out = this.out;
    switch (e.inst) {
      case 'kick': case 'snare': case 'clap': case 'hat': case 'open': this.hit(this.drums[e.inst], at, v); break;
      case 'bass': {
        const g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, at); f.frequency.exponentialRampToValueAtTime(300, at + Math.min(0.3, e.dur));
        f.connect(g); g.connect(out); this.env(g, at, 0.5 * v, 0.006, e.dur, 0.05);
        this.osc('sawtooth', freq(e.midi), at, at + e.dur + 0.1, f);
        break;
      }
      case 'lead': {
        const type = this.song.lead, g = c.createGain(); g.connect(out); g.connect(this.echo);
        this.env(g, at, (type === 'sine' ? 0.32 : type === 'triangle' ? 0.3 : type === 'sawtooth' ? 0.11 : 0.12) * v, 0.012, e.dur, 0.08);
        const a = this.osc(type, freq(e.midi), at, at + e.dur + 0.2, g);
        // a gentle vibrato on long notes
        if (e.dur > 0.35) {
          const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, at); depth.gain.linearRampToValueAtTime(freq(e.midi) * 0.008, at + 0.3);
          lfo.connect(depth); depth.connect(a.frequency); lfo.start(at); lfo.stop(at + e.dur + 0.2);
        }
        break;
      }
      case 'pad': {
        const g = c.createGain(); g.connect(out); this.env(g, at, 0.2 * v, 0.12, e.dur, 0.25);
        this.osc('triangle', freq(e.midi), at, at + e.dur + 0.4, g);
        break;
      }
      case 'bell': {
        const g = c.createGain(); g.connect(out); g.connect(this.echo);
        g.gain.setValueAtTime(0.18 * v, at); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.8);
        this.osc('sine', freq(e.midi), at, at + 0.85, g);
        break;
      }
    }
  }
}

/** Renders a whole song to a buffer, ahead of time, so playing it costs almost nothing and stays sample exact. */
async function render(song: Song): Promise<AudioBuffer> {
  kitReady ??= kit();
  const drums = await kitReady, sc = compose(song), c = new OfflineAudioContext(1, Math.ceil((sc.end + 0.5) * RATE), RATE);
  const bus = c.createGain(), comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  bus.gain.value = 0.85; bus.connect(comp); comp.connect(c.destination);
  const band = new Band(c, song, bus, drums);
  for (const e of sc.events) band.play(e, e.t);
  return c.startRendering();
}

/**
 * Dust Disco's sound: songs come from pre-rendered buffers on the live audio clock, which is also the game's clock.
 * Pausing suspends the whole context, which freezes that clock too. Effects are little live blips.
 */
export class DiscoSound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private music: GainNode | null = null;
  private start = 0;
  private off = false;
  private token = {};
  private buffers = new Map<string, Promise<AudioBuffer>>();
  constructor() { try { this.off = localStorage.getItem('dust-disco-sound-v1') === 'off'; } catch { /* optional storage */ } }
  muted() { return this.off; }
  setMuted(off: boolean) {
    this.off = off; try { localStorage.setItem('dust-disco-sound-v1', off ? 'off' : 'on'); } catch { /* optional storage */ }
    if (this.master && this.context) this.master.gain.setTargetAtTime(off ? 0 : 0.9, this.context.currentTime, 0.02);
  }
  /** Starts the audio context; must be called from a click or key press. */
  unlock() {
    if (!this.context) {
      try { this.context = new AudioContext({ latencyHint: 'interactive' }); } catch { return false; }
      const c = this.context;
      this.master = c.createGain(); this.master.gain.value = this.off ? 0 : 0.9; this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    return true;
  }
  get ready() { return !!this.context; }
  /** Renders a song ahead of time (no click needed); the two most recent stay ready. */
  prepare(song: Song) {
    let p = this.buffers.get(song.id);
    if (!p) {
      p = render(song); this.buffers.set(song.id, p);
      p.catch(() => this.buffers.delete(song.id));
      while (this.buffers.size > 2) this.buffers.delete(this.buffers.keys().next().value!);
    } else { this.buffers.delete(song.id); this.buffers.set(song.id, p); }
    return p;
  }
  /** The song clock in seconds: where the music the player hears now is, with the speakers' own delay taken off. */
  songTime() {
    const c = this.context; if (!c) return 0;
    return c.currentTime - this.start - (c.outputLatency || c.baseLatency || 0);
  }
  /** Plays `song` from `from` seconds, starting `lead` seconds after it is ready; `until` fades out early (for previews). */
  async play(song: Song, lead = 2, from = 0, until = Infinity, level = 0.85) {
    if (!this.unlock()) return false;
    this.stop();
    const token = (this.token = {}), buf = await this.prepare(song).catch(() => null);
    if (!buf || token !== this.token) return false;
    const c = this.context!, s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = level; s.connect(g); g.connect(this.master!);
    const at = c.currentTime + lead; this.start = at - from;
    s.start(at, Math.max(0, from));
    if (until < Infinity) { const end = at + until - from; g.gain.setValueAtTime(level, end - 1); g.gain.linearRampToValueAtTime(0, end); s.stop(end + 0.05); }
    this.source = s; this.music = g;
    return true;
  }
  /** Fades the song out (a preview ending, or leaving a song). */
  stop(fade = 0.08) {
    this.token = {};
    const c = this.context, s = this.source, g = this.music; if (!c || !s || !g) return;
    g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0, c.currentTime, fade / 3);
    try { s.stop(c.currentTime + fade + 0.05); } catch { /* already stopped */ }
    s.onended = () => { s.disconnect(); g.disconnect(); };
    this.source = null; this.music = null;
  }
  pause() { if (this.context?.state === 'running') void this.context.suspend(); }
  resume() { if (this.context?.state === 'suspended') void this.context.resume(); }
  /** The audio clock as heard, for calibration. */
  heardNow() { const c = this.context; return c ? c.currentTime - (c.outputLatency || c.baseLatency || 0) : 0; }
  /** Schedules `count` clicks `gap` seconds apart from `lead` seconds from now, and returns when each will be heard. */
  metronome(count: number, gap: number, lead: number) {
    const c = this.context; if (!c || !this.sfx) return [];
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const at = c.currentTime + lead + i * gap, g = c.createGain(), o = c.createOscillator();
      o.type = 'square'; o.frequency.value = i % 4 === 0 ? 1760 : 1320; o.connect(g); o.start(at); o.stop(at + 0.05);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.12, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.04); g.connect(this.sfx);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      out.push(at - (c.outputLatency || c.baseLatency || 0));
    }
    return out;
  }

  private blip(type: OscillatorType, from: number, to: number, delay: number, dur: number, level: number) {
    const c = this.context; if (!c || !this.sfx || this.off) return;
    const at = c.currentTime + delay, g = c.createGain(), o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    o.connect(g); g.connect(this.sfx); o.start(at); o.stop(at + dur + 0.05); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  /** A soft tick for a good press, pitched by lane so a run of notes plays a little tune of its own. */
  hit(j: Judge, lane: number) {
    if (j === 'miss') { this.blip('triangle', 140, 70, 0, 0.12, 0.18); return; }
    const f = [880, 988, 1175, 1319][lane] * (j === 'perfect' ? 1 : 0.75);
    this.blip('sine', f, f * 1.01, 0, 0.06, j === 'perfect' ? 0.12 : 0.08);
  }
  stray() { this.blip('triangle', 220, 160, 0, 0.05, 0.06); }
  ui() { this.blip('sine', 660, 990, 0, 0.07, 0.1); }
  dustUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.blip('triangle', f, f, i * 0.045, 0.25, 0.1)); }
  fanfare(win: boolean) {
    const notes = win ? [523, 659, 784, 1047, 784, 1047, 1319] : [392, 349, 311, 262];
    notes.forEach((f, i) => this.blip(win ? 'square' : 'triangle', f, f, i * (win ? 0.09 : 0.16), win ? 0.22 : 0.3, win ? 0.07 : 0.1));
  }
  cheer() { [1047, 1319, 1568, 2093].forEach((f, i) => this.blip('sine', f, f * 1.02, 0.6 + i * 0.07, 0.4, 0.05)); }
  dispose() { this.stop(0.01); void this.context?.close().catch(() => {}); this.context = null; }
}

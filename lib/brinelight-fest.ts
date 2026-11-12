// Brinelight festival breathers: a short mini-game between stages, one of three in turn. Same three buttons as the
// brawl (Attack, Jump, Tag), no words, never failable: the worst you can do is win one lantern. Skippable from the page.
// Deterministic like the engine: a seed and one input per 1/60 s step.
// - whack: three crab pots, one per button (left Attack, middle Jump, right Tag). A crab pops up; press its pot's
//   button to bonk it. A gold crab is worth three.
// - lanterns: Dora stands on Enzo's shoulders under a hook. Lanterns float in on the beat of the district's tune; press
//   any button as one reaches the hook to hang it. Perfect on the beat, good near it.
// - bottles: Enzo throws at three stacks of bottles while a marker swings over them; press to throw where it is.
import { STAGES } from './brinelight-levels.js';

export type FestKind = 'whack' | 'lanterns' | 'bottles';
export const FEST_KINDS: FestKind[] = ['whack', 'lanterns', 'bottles'];
export const FEST_DT = 1 / 60;
export const FEST_TIME = 24;
/** the breather after a stage, by the stage's place in the game: whack, lanterns, bottles, whack, ... */
export function festAfter(stageId: string): FestKind {
  const i = Object.keys(STAGES).indexOf(stageId);
  return FEST_KINDS[(i < 0 ? 0 : i) % 3];
}
export interface FestInput { atkP: boolean; jmpP: boolean; tagP: boolean }
export const FEST_NONE: FestInput = { atkP: false, jmpP: false, tagP: false };
export type FestEvent = { k: 'sfx'; id: string } | { k: 'pop'; x: number; y: number; text: string; col: string };

export interface Pot { st: 'down' | 'peek' | 'up' | 'bonk' | 'hide'; t: number; gold: boolean; upT: number }
export interface Lantern { arrive: number; st: 'fly' | 'hung' | 'drop' | 'gone'; t: number; grade: 0 | 1 | 2 }
export interface Stack { x: number; st: 'up' | 'tumble' | 'down'; t: number }
export interface Ball { t: number; x: number; hit: boolean }

export class FestGame {
  kind: FestKind; assist: boolean; t = 0; dur = FEST_TIME; done = false; score = 0; best = 0;
  events: FestEvent[] = [];
  private rs: number;
  // whack
  pots: Pot[] = [0, 1, 2].map(() => ({ st: 'down', t: 0, gold: false, upT: 1 }));
  dora = { pot: 1, t: 9, ok: true };
  private nextPop = 1.0;
  // lanterns
  beat: number; lanterns: Lantern[] = []; hung = 0; pair = { st: 'reach' as 'reach' | 'hang' | 'cheer' | 'oops', t: 9 };
  private nextL: number;
  // bottles
  stacks: Stack[] = [0.2, 0.5, 0.8].map((x) => ({ x, st: 'up', t: 0 }));
  aim = 0.5; balls: Ball[] = []; enzo = { st: 'idle' as 'idle' | 'windup' | 'toss' | 'cheer', t: 9 }; private cd = 0; private refill = -1; private aimAt = 0.5; rounds = 0;

  constructor(o: { kind: FestKind; seed?: number; assist?: boolean; bpm?: number; offset?: number }) {
    this.kind = o.kind; this.assist = o.assist ?? true; this.rs = (o.seed ?? 1) >>> 0 || 1;
    this.beat = 60 / (o.bpm ?? 120);
    // the page restarts the tune with its first beat 0.15 s in, so the lanterns arrive on beats
    this.nextL = o.offset ?? 0.15;
  }
  private rnd() { let t = (this.rs = (this.rs + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private sfx(id: string) { this.events.push({ k: 'sfx', id }); }
  private pop(x: number, y: number, text: string, col = '#ffe9a8') { this.events.push({ k: 'pop', x, y, text, col }); }
  /** lanterns won: one for playing, up to three for playing well */
  reward() {
    const [a, b] = this.kind === 'whack' ? [10, 18] : this.kind === 'lanterns' ? [10, 20] : [6, 12];
    return this.score >= b ? 3 : this.score >= a ? 2 : 1;
  }
  /** seconds a lantern takes to float in from the edge to the hook: two beats */
  flight() { return this.beat * 2; }
  /** how close to the beat a press must be: perfect, then good (wider with assist on) */
  windows(): [number, number] { return this.assist ? [0.12, 0.24] : [0.08, 0.16]; }
  /** the bottle marker's swing: one sweep across and back every few seconds */
  swing() { return this.assist ? 3.0 : 2.4; }
  /** half the width of a stack you can hit, as a fraction of the shelf */
  stackW() { return this.assist ? 0.12 : 0.09; }

  step(inp: FestInput) {
    const dt = FEST_DT;
    if (this.done) return;
    this.t += dt;
    if (this.kind === 'whack') this.whack(inp, dt);
    else if (this.kind === 'lanterns') this.lanternsStep(inp, dt);
    else this.bottles(inp, dt);
    if (this.t >= this.dur && !this.done) { this.done = true; this.sfx('win'); }
  }

  private whack(inp: FestInput, dt: number) {
    const D = this.dora; D.t += dt;
    for (const p of this.pots) {
      p.t += dt;
      if (p.st === 'peek' && p.t > 0.22) { p.st = 'up'; p.t = 0; }
      else if (p.st === 'up' && p.t > p.upT) { p.st = 'hide'; p.t = 0; }
      else if ((p.st === 'bonk' && p.t > 0.45) || (p.st === 'hide' && p.t > 0.15)) { p.st = 'down'; p.t = 0; }
    }
    this.nextPop -= dt;
    if (this.nextPop <= 0 && this.t < this.dur - 0.8) {
      const free = this.pots.map((p, i) => (p.st === 'down' ? i : -1)).filter((i) => i >= 0);
      if (free.length) {
        const i = free[Math.floor(this.rnd() * free.length)], p = this.pots[i];
        p.st = 'peek'; p.t = 0; p.gold = this.rnd() < 0.13; p.upT = (this.assist ? 1.4 : 1.1) * (1 - Math.min(0.3, this.t / this.dur * 0.3));
        this.sfx('pop');
      }
      // quicker as it goes, and now and then two at once
      this.nextPop = (this.assist ? 1.0 : 0.85) - Math.min(0.35, this.t * 0.015) + this.rnd() * 0.35;
      if (this.rnd() < 0.2) this.nextPop = 0.12;
    }
    const press = [inp.atkP, inp.jmpP, inp.tagP];
    press.forEach((on, i) => {
      if (!on) return;
      D.pot = i; D.t = 0;
      const p = this.pots[i];
      if (p.st === 'up' || p.st === 'peek') {
        const n = p.gold ? 3 : 1; this.score += n; D.ok = true;
        p.st = 'bonk'; p.t = 0; this.sfx(p.gold ? 'festFull' : 'bump');
        this.pop(i, 0, `+${n}`, p.gold ? '#ffe066' : '#ffe9a8');
      } else { D.ok = false; this.sfx('whoosh'); }
    });
  }

  private lanternsStep(inp: FestInput, dt: number) {
    const P = this.pair; P.t += dt;
    const fl = this.flight(), [pw, gw] = this.windows();
    // a lantern every two beats, arriving on the beat; the first after a beat or so to settle in
    while (this.nextL <= this.t + fl && this.nextL + fl < this.dur - 0.3) {
      this.lanterns.push({ arrive: this.nextL + fl, st: 'fly', t: 0, grade: 0 });
      this.nextL += this.beat * 2;
    }
    for (const l of this.lanterns) {
      l.t += dt;
      if (l.st === 'fly' && this.t > l.arrive + gw) { l.st = 'drop'; l.t = 0; }
      if (l.st === 'drop' && l.t > 1) l.st = 'gone';
    }
    if (inp.atkP || inp.jmpP || inp.tagP) {
      let best: Lantern | null = null, bd = 1e9;
      for (const l of this.lanterns) if (l.st === 'fly') { const d = Math.abs(this.t - l.arrive); if (d < bd) { bd = d; best = l; } }
      if (best && bd <= gw) {
        best.st = 'hung'; best.t = 0; best.grade = bd <= pw ? 2 : 1; this.hung++;
        this.score += best.grade === 2 ? 2 : 1; P.st = 'hang'; P.t = 0;
        this.sfx(best.grade === 2 ? 'chime' : 'ready'); this.pop(0, 0, best.grade === 2 ? '+2' : '+1', best.grade === 2 ? '#ffe066' : '#ffe9a8');
        if (this.hung % 5 === 0) { this.sfx('festFull'); P.st = 'cheer'; }
      } else if (best && bd < 0.6) { P.st = 'oops'; P.t = 0; this.sfx('whoosh'); }
    }
    if (P.st !== 'reach' && P.t > 0.5) P.st = 'reach';
  }

  private bottles(inp: FestInput, dt: number) {
    const E = this.enzo; E.t += dt; this.cd -= dt;
    this.aim = 0.5 - 0.42 * Math.cos((this.t / this.swing()) * Math.PI * 2);
    // the ball goes where the marker was when you pressed, not where it has swung to by the throw
    if ((inp.atkP || inp.jmpP || inp.tagP) && this.cd <= 0 && E.st !== 'windup') { E.st = 'windup'; E.t = 0; this.cd = this.assist ? 0.55 : 0.7; this.aimAt = this.aim; }
    if (E.st === 'windup' && E.t > 0.14) { E.st = 'toss'; E.t = 0; this.balls.push({ t: 0, x: this.aimAt, hit: false }); this.sfx('throw'); }
    if ((E.st === 'toss' || E.st === 'cheer') && E.t > 0.5) E.st = 'idle';
    for (const b of this.balls) {
      b.t += dt;
      if (!b.hit && b.t >= 0.42) {
        b.hit = true;
        const s = this.stacks.find((k) => k.st === 'up' && Math.abs(k.x - b.x) <= this.stackW());
        if (s) { s.st = 'tumble'; s.t = 0; this.score += 2; this.sfx('crate'); this.pop(s.x, 0, '+2'); }
        else this.sfx('bump');
      }
    }
    this.balls = this.balls.filter((b) => b.t < 1.1);
    for (const s of this.stacks) { s.t += dt; if (s.st === 'tumble' && s.t > 0.5) s.st = 'down'; }
    if (this.refill < 0 && this.stacks.every((s) => s.st === 'down')) {
      this.refill = 0.9; this.score += 2; this.rounds++; E.st = 'cheer'; E.t = 0; this.sfx('festFull'); this.pop(0.5, 0, '+2', '#ffe066');
    }
    if (this.refill >= 0) { this.refill -= dt; if (this.refill < 0) for (const s of this.stacks) { s.st = 'up'; s.t = 0; } }
  }
}

// Combo Ball: the rules. Dora, Enzo and Pip (with Tuft in goal) play turn-based three-a-side against the animal
// league on the shared tactics pitch (lib/tactics-football.ts), and a goal isn't worth one: it's worth chips × mult
// from the passing move that made it. Every completed pass adds chips, a first-time pass (played on in the turn it
// arrived) adds mult, and the shot cashes the chain in. The other side touching the ball wipes it, and the longer the
// chain runs the harder they press. Each match has a points target and a number of turns; reach the target before
// full time or the run is over. Between matches the transfer shop sells traits that bend the scoring.
// Deterministic from a seed, with no DOM: the page draws it, the tests and bots drive it directly.
import { Match, COLS, ROWS, rngNext, cheb } from './tactics-football.js';
import type { Hooks, Level, PassRec, ShotCtx, State, Team } from './tactics-football.js';

export { COLS, ROWS };
export const MATCHES = 9, SLOTS = 5, TURNS = 16;
/** the points targets, match by match */
export const TARGETS = [40, 60, 100, 200, 320, 500, 1200, 3000, 8000];
/** a conceded goal raises the target by this share of the match's own target */
export const CREEP = 0.15;
/** passes in a chain before the other side presses harder (twice as many with Cool Head), and the most it can grow */
export const PRESSURE = 4, PRESSURE_MAX = 2;
export const LEAGUES = [
  { name: 'Pebble League', text: 'The village green: rabbits, frogs and moles, with one of them pressing.' },
  { name: 'Meadow League', text: 'Two of them press now: slick otters, spiky hedgehogs and thieving magpies.' },
  { name: 'Summit League', text: 'Foxes, badgers and, in the final, the Grumble Galacticos.' },
];
/** the animal league, easiest first: each team plays its own way (a style in the tactics engine), with its own sprites
 * in public/art/kickabout/ (`<sprite>-stand` and so on; the keeper's are `<keeper>-stand` and `<keeper>-dive`) */
export const TEAMS: { id: string; name: string; kit: string; sprite: string; keeper: string; style: string; level: Level }[] = [
  { id: 'rabbit', name: 'Rabbit Rangers', kit: '#7ec8f0', sprite: 'rabbit', keeper: 'rabbit-keeper', style: 'Quick: they move 3 cells, but only lunge 1 cell to tackle.', level: { press: 1, zone: 1, lanes: 0, move: 3, shotRange: 3, keeper: -1 } },
  { id: 'frog', name: 'Frog Wanderers', kit: '#f09a3a', sprite: 'frog', keeper: 'frog-keeper', style: 'They love a long ball, and win any lofted pass that lands next to one of them.', level: { press: 1, zone: 1, lanes: 0, move: 2, shotRange: 4, aerial: true, keeper: -1 } },
  { id: 'mole', name: 'Mole Miners', kit: '#8a5a3a', sprite: 'mole', keeper: 'mole-keeper', style: 'Every other turn one mole tunnels to any free cell within 4 (the dotted arrow).', level: { press: 1, zone: 1, lanes: 1, move: 2, shotRange: 4, tunnel: true } },
  { id: 'otter', name: 'Otter Athletic', kit: '#2aa8a0', sprite: 'otter', keeper: 'otter-keeper', style: 'Slick: with the ball they pass twice in one go, and two of them press.', level: { press: 2, zone: 1, lanes: 1, move: 2, shotRange: 5, passes: 2, options: 1 } },
  { id: 'hog', name: 'Hedgehog Hotspurs', kit: '#3a5ad8', sprite: 'hog', keeper: 'hog-keeper', style: 'A spiky press: two close you down, lunging into every cell up to 2 away.', level: { press: 2, zone: 2, reach: 2, lanes: 1, move: 2, shotRange: 5, options: 1 } },
  { id: 'magpie', name: 'Magpie Rovers', kit: '#8a4ad8', sprite: 'magpie', keeper: 'magpie-keeper', style: 'Thieves: they steal any pass that goes past next to a magpie.', level: { press: 2, zone: 1, lanes: 1, move: 2, shotRange: 5, options: 1, thief: true } },
  { id: 'fox', name: 'Fox Forest', kit: '#24345a', sprite: 'fox', keeper: 'fox-keeper', style: 'Cunning: they read two passing lanes and break 3 cells at a time with the ball.', level: { press: 2, zone: 2, lanes: 2, move: 2, attackMove: 3, shotRange: 6, sweeper: 1, options: 2 } },
  { id: 'badger', name: 'Badger Borough', kit: '#d8a82a', sprite: 'badger', keeper: 'badger-keeper', style: 'Strong and slow: they move 1 cell, but lunge from 3 away and can’t be tackled from the front.', level: { press: 2, zone: 2, lanes: 2, move: 1, shotRange: 6, sweeper: 1, front: true } },
  { id: 'grumble', name: 'Grumble Galacticos', kit: '#3a8a3a', sprite: 'grumble', keeper: 'gkeeper', style: 'The final: four of them, quick, thieving and slick on the ball. Everything at once.', level: { press: 2, zone: 2, reach: 2, lanes: 2, move: 3, shotRange: 6, sweeper: 1, options: 2, extra: 1, thief: true, passes: 2 } },
];
export const team = (m: number) => TEAMS[Math.min(m, TEAMS.length - 1)];
export const OUR_SIDE = ['dora', 'enzo', 'pip'];

// ---------------------------------------------------------------- traits
export const TRAITS = [
  { id: 'metronome', name: 'Metronome', text: 'Every 5th pass in a chain doubles the chips so far.' },
  { id: 'routeone', name: 'Route One', text: 'Long passes (5 cells or more) give +2 mult instead of +10 chips.' },
  { id: 'ricochet', name: 'Ricochet', text: 'Their keeper’s saves bounce back to us, and the chain lives on with +10 chips.' },
  { id: 'backpass', name: 'Backpass Bandit', text: 'Passes backwards give +1 mult.' },
  { id: 'crossfield', name: 'Crossfield', text: 'Switches of play (4 rows or more across) give +1 mult as well.' },
  { id: 'volley', name: 'Volley', text: 'Catch a lofted pass and shoot in the same turn: that goal scores double.' },
  { id: 'hotstreak', name: 'Hot Streak', text: 'Each goal this match adds +1 mult to every goal after it.' },
  { id: 'coolhead', name: 'Cool Head', text: 'Their pressing builds up half as fast.' },
  { id: 'longrange', name: 'Long Range', text: 'Goals from 7 cells out or more get +3 mult.' },
  { id: 'tiki', name: 'Tiki-Taka', text: 'First-time passes give +2 mult, but other passes add no chips.' },
  { id: 'nutmeg', name: 'Nutmeg', text: 'Dribbling through a cell between two of them adds +5 chips.' },
  { id: 'piggy', name: 'Piggy Bank', text: 'After a goal, half its chips carry into our next goal.' },
  { id: 'lateshow', name: 'Late Show', text: 'Goals in the last 3 turns score double.' },
  { id: 'backheel', name: 'Backheel', text: 'Enzo’s first-time passes backwards give +2 mult.' },
] as const;
export type TraitId = (typeof TRAITS)[number]['id'];
export const trait = (id: TraitId) => TRAITS.find((t) => t.id === id)!;

/** one reason a chain grew, for the pop-ups */
export type Gain = { text: string; chips?: number; mult?: number; times?: number };
export type ChainValue = { chips: number; mult: number; passes: number; gains: Gain[] };

/** what a chain of our passes is worth so far: chips and mult, pass by pass, with the reason for each */
export function chainValue(chain: PassRec[], has: (id: TraitId) => boolean, whoOf: (id: number) => string, bonus = 0): ChainValue {
  const ours = chain.filter((p) => p.team === 0);
  let chips = 0, mult = 1, counted = 0;
  const gains: Gain[] = [];
  ours.forEach((p, i) => {
    const prev = ours[i - 1];
    if (prev && p.to === prev.from && p.from === prev.to) { gains.push({ text: 'Back to sender: nothing' }); return; }
    counted++;
    const noChips = has('tiki') && !p.oneTouch;
    let c = noChips ? 0 : 10, m = 0;
    const why: string[] = [];
    if (p.len >= 5) { if (has('routeone')) { m += 2; why.push('ROUTE ONE +2×'); } else if (!noChips) { c += 10; why.push('LONG'); } }
    if (p.lofted && !noChips) { c += 5; why.push('LOFTED'); }
    if (Math.abs(p.b.r - p.a.r) >= 4) { if (!noChips) { c += 10; why.push('SWITCH'); } if (has('crossfield')) { m += 1; why.push('CROSSFIELD +1×'); } }
    if (p.oneTouch) { const k = has('tiki') ? 2 : 1; m += k; why.push(`FIRST-TIME +${k}×`); }
    if (p.back && has('backpass')) { m += 1; why.push('BACKPASS +1×'); }
    if (p.back && p.oneTouch && has('backheel') && whoOf(p.from) === 'enzo') { m += 2; why.push('BACKHEEL +2×'); }
    chips += c; mult += m;
    gains.push({ text: why.length ? why.join(' · ') : 'PASS', chips: c, mult: m || undefined });
    if (has('metronome') && counted % 5 === 0 && chips > 0) { chips *= 2; gains.push({ text: 'METRONOME ×2 chips', times: 2 }); }
  });
  if (bonus) { chips += bonus; gains.push({ text: 'BONUS', chips: bonus }); }
  return { chips, mult, passes: counted, gains };
}

export type Phase = 'sheet' | 'play' | 'shop' | 'won' | 'lost';

export class Run {
  seed: number; rs: number;
  phase: Phase = 'sheet';
  match = 0;
  target = TARGETS[0];
  traits: TraitId[] = [];
  offer: TraitId[] = [];
  game!: Match;
  last: 'won' | 'lost' | '' = '';
  /** the last goal of ours, for the result line and the pop-up */
  lastGoal: { pts: number; notes: string[] } | null = null;
  stats = { goals: 0, passes: 0, best: 0, longest: 0, conceded: 0, won: 0, points: 0, turns: 0 };
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1; this.rs = this.seed;
    this.startMatch();
  }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  has(id: TraitId) { return (this.traits as string[]).includes(id); }
  get league() { return LEAGUES[Math.min(2, Math.floor(this.match / 3))]; }
  get foe() { return team(this.match); }
  get points() { return this.game.s.score[0]; }
  /** the chain we're building right now */
  get chain(): ChainValue { const s = this.game.s; return chainValue(s.chain, (id) => this.has(id), (id) => s.units[id].who, s.data.bonus ?? 0); }
  /** how much harder they press right now, from 0 */
  get pressure() { const n = this.game ? this.chain.passes : 0; return Math.min(PRESSURE_MAX, Math.floor(n / (this.has('coolhead') ? PRESSURE * 2 : PRESSURE))); }
  /** the Combo Ball rules, as hooks into the match */
  hooks(): Hooks {
    const base = this.foe.level;
    return {
      turns: () => TURNS,
      golden: () => false,
      parry: (team) => team === 0 && this.has('ricochet'),
      goalValue: (team, shot) => this.worth(team, shot),
      onChainReset: (s: State) => { s.data.bonus = 0; },
      // the longer our chain, the harder they press: the plan for each turn is made with the pressure as it stands
      onTurn: () => { if (this.game) { const k = this.pressure; this.game.o.level = k ? { ...base, press: base.press + k, zone: base.zone + k } : base; } },
    };
  }
  /** what a goal of ours is worth, and why: (10 + chips) × mult */
  worth(team: Team, shot: ShotCtx) {
    if (team === 1) return { value: 1, notes: [] };
    const s = this.game.s, v = chainValue(shot.chain, (id) => this.has(id), (id) => s.units[id].who, (s.data.bonus ?? 0) + (s.data.carry ?? 0));
    let mult = v.mult, times = 1;
    const notes: string[] = [];
    if (this.has('longrange') && shot.dist >= 7) { mult += 3; notes.push('Long Range +3×'); }
    if (this.has('hotstreak') && s.goals[0]) { mult += s.goals[0]; notes.push(`Hot Streak +${s.goals[0]}×`); }
    if (this.has('volley') && shot.header) { times *= 2; notes.push('Volley ×2'); }
    if (this.has('lateshow') && s.turn >= s.maxTurns - 3) { times *= 2; notes.push('Late Show ×2'); }
    if (s.data.carry) notes.push(`Piggy Bank +${s.data.carry}`);
    return { value: (10 + v.chips) * mult * times, notes: [`${10 + v.chips} × ${mult}${times > 1 ? ` × ${times}` : ''}`, ...notes] };
  }

  startMatch() {
    this.phase = 'sheet'; this.last = ''; this.lastGoal = null;
    this.target = TARGETS[this.match];
    this.game = undefined as unknown as Match;
    const t = this.foe;
    this.game = new Match({ seed: (this.seed * 31 + this.match * 977) >>> 0, outfield: [3, 3], who: { ours: OUR_SIDE, theirs: [t.sprite], keepers: ['keeper', t.keeper] }, level: t.level, hooks: this.hooks() });
  }
  ready() { if (this.phase === 'sheet') this.phase = 'play'; }

  // ---------------------------------------------------------------- the person's turn (each returns false if not allowed)
  move(id: number, c: number, r: number) {
    if (this.phase !== 'play') return false;
    const g = this.game, car = g.s.ball.holder === id;
    if (!g.move(id, c, r)) return false;
    // Nutmeg: the carrier dribbled through a cell with two of them beside it
    const ev = g.events.find((e) => e.k === 'move');
    if (car && this.has('nutmeg') && ev && ev.k === 'move' && ev.path.slice(1).some((p) => g.units.filter((u) => u.team === 1 && !u.keeper && cheb(u, p) === 1).length >= 2)) {
      g.s.data.bonus = (g.s.data.bonus ?? 0) + 5; g.s.data.nutmegs = (g.s.data.nutmegs ?? 0) + 1;
    }
    return this.after(true);
  }
  pass(id: number, to: number) { return this.phase === 'play' && this.after(this.game.pass(id, to)); }
  loft(id: number, c: number, r: number) { return this.phase === 'play' && this.after(this.game.loft(id, c, r)); }
  shoot(id: number, row: number) {
    if (this.phase !== 'play') return false;
    const g = this.game, s0 = g.s, before = this.chain, carry = s0.data.carry ?? 0;
    if (!g.shoot(id, row)) return false;
    const s = g.s, shot = g.events.find((e) => e.k === 'shot');
    const goal = g.events.find((e) => e.k === 'goal' && e.team === 0);
    if (goal && goal.k === 'goal') {
      const chips = before.chips + carry;
      this.lastGoal = { pts: goal.value, notes: goal.notes };
      s.data.carry = this.has('piggy') ? Math.floor(chips / 2) : 0;
    } else if (shot && shot.k === 'shot' && shot.result === 'saved' && shot.holder >= 0 && g.unit(shot.holder).team === 0 && this.has('ricochet')) {
      s.data.bonus = (s.data.bonus ?? 0) + 10;
    }
    return this.after(true);
  }
  tackle(id: number) { return this.phase === 'play' && this.after(this.game.tackle(id)); }
  /** Combo Ball's hint, which knows the chain: shoot once the chain is worth it (or it reaches the target), else a
   * safe pass that isn't straight back to whoever passed (best of all, to someone who can then score or play on first
   * time), else carry the ball forward out of their tackle zones. When they have the ball it's the engine's hint. */
  hint(): ReturnType<Match['hint']> {
    const m = this.game, car = m.carrier;
    if (this.phase !== 'play' || !car || car.team !== 0) return this.phase === 'play' ? m.hint() : null;
    const z = m.zones(), K = (c: { c: number; r: number }) => c.c * 32 + c.r;
    const bestShot = (id: number) => {
      const [lo, hi] = m.mouth(1);
      let row = -1, v = 0;
      for (let r = lo; r <= hi; r++) { const p = m.shotPreview(id, r); if ((p.result === 'goal' || p.result === 'deflected') && p.value > v) { v = p.value; row = r; } }
      return { row, v };
    };
    if (m.canAct(car)) {
      const shot = bestShot(car.id), need = this.target - this.points, last = m.s.chain[m.s.chain.length - 1];
      let best = -1, bs = -1e9;
      for (const q of m.units) {
        if (q.team !== 0 || q === car || q.keeper || z.has(K(q))) continue;
        if (last && last.team === 0 && last.to === car.id && last.from === q.id) continue;
        if (!m.passPreview(car.id, q.id).ok || !m.pass(car.id, q.id)) continue;
        const next = m.canAct(q) ? bestShot(q.id).v : 0;
        m.undo();
        const v = (q.c - car.c) * 2 + (q.moved ? 0 : 4) + (next > shot.v ? 20 : 0);
        if (v > bs) { bs = v; best = q.id; }
      }
      if (shot.row >= 0 && (shot.v >= need || this.chain.passes >= 2 || best < 0 || m.s.turn >= m.s.maxTurns - 2)) return { k: 'shoot', id: car.id, row: shot.row };
      if (best >= 0) return { k: 'pass', id: car.id, to: best };
      if (shot.row >= 0) return { k: 'shoot', id: car.id, row: shot.row };
    }
    if (!car.moved) {
      let cell: { c: number; r: number } | null = null, bs = -1e9;
      for (const q of m.reach(car.id)) { if (z.has(K(q))) continue; const v = q.c - Math.abs(q.r - 4) * 0.2; if (v > bs) { bs = v; cell = q; } }
      if (cell) return { k: 'move', id: car.id, c: cell.c, r: cell.r };
    }
    return null;
  }
  undo() { return this.phase === 'play' && this.game.undo(); }
  endTurn() { if (this.phase !== 'play') return false; this.stats.turns++; return this.after(this.game.endTurn()); }
  /** counts what happened, and ends the match at the target or at full time */
  private after(ok: boolean) {
    if (!ok) return false;
    const g = this.game, s = g.s;
    for (const e of g.events) {
      if (e.k === 'pass' && e.team === 0 && e.holder >= 0 && g.unit(e.holder)?.team === 0) this.stats.passes++;
      if (e.k === 'goal') {
        if (e.team === 0) { this.stats.goals++; this.stats.points += e.value; this.stats.best = Math.max(this.stats.best, e.value); }
        else { this.stats.conceded++; this.target += Math.round(TARGETS[this.match] * CREEP); }
      }
    }
    this.stats.longest = Math.max(this.stats.longest, this.chain.passes);
    if (s.score[0] >= this.target) { s.over = true; return this.endMatch(), true; }
    if (s.over) this.endMatch();
    return true;
  }
  endMatch() {
    const won = this.game.s.score[0] >= this.target;
    this.last = won ? 'won' : 'lost';
    if (!won) { this.phase = 'lost'; return; }
    this.stats.won++;
    if (this.match >= MATCHES - 1) { this.phase = 'won'; return; }
    this.phase = 'shop'; this.makeOffer();
  }
  makeOffer() {
    const pool: TraitId[] = TRAITS.map((t) => t.id).filter((id) => !this.has(id));
    this.offer = [];
    while (this.offer.length < 3 && pool.length) this.offer.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
  }
  /** takes a trait from the shop (dropping one when all five slots are full), or none; then the next match */
  pick(id?: TraitId, drop?: TraitId) {
    if (this.phase !== 'shop') return false;
    if (id) {
      if (!this.offer.includes(id)) return false;
      if (this.traits.length >= SLOTS) { if (!drop || !this.has(drop)) return false; this.traits = this.traits.filter((t) => t !== drop); }
      this.traits.push(id);
    }
    this.offer = []; this.match++;
    this.startMatch();
    return true;
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'combo-ball-v2';
export type Save = {
  v: 2; intro: boolean;
  best: { matches: number; goal: number; chain: number };
  stats: { runs: number; wins: number; goals: number; passes: number };
  settings: { sound: boolean; music: boolean };
};
export const newSave = (): Save => ({ v: 2, intro: false, best: { matches: 0, goal: 0, chain: 0 }, stats: { runs: 0, wins: 0, goals: 0, passes: 0 }, settings: { sound: true, music: true } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 2) return s;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    s.intro = o.intro === true;
    for (const k of ['matches', 'goal', 'chain'] as const) s.best[k] = num(o.best?.[k]);
    for (const k of ['runs', 'wins', 'goals', 'passes'] as const) s.stats[k] = num(o.stats?.[k]);
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** adds a finished run to the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.goals += r.stats.goals; s.stats.passes += r.stats.passes;
  if (r.phase === 'won') s.stats.wins++;
  s.best.matches = Math.max(s.best.matches, r.stats.won);
  s.best.goal = Math.max(s.best.goal, r.stats.best);
  s.best.chain = Math.max(s.best.chain, r.stats.longest);
}

// Rulebook FC: the season. Dora, Enzo, Pip and Bram (with Tuft in goal) play ten turn-based matches against the
// animal teams of the league (the Grumbles are the boss) on the shared tactics pitch (lib/tactics-football.ts): every
// opponent's next move is showing before we move, so each turn is a little puzzle. Win a match and Enzo lets you write one of three new laws of football into the
// rulebook for the rest of the run (gold cards); every opposing team brings a law of its own, and that stays too (purple
// cards). The laws are the build: each one is a hook into the match engine. A defeat is a strike, three strikes end the
// season, and finishing the tenth match with fewer wins the season.
// Deterministic from a seed, with no DOM: the page draws it, the tests and bots drive it directly.
import { Match, COLS, ROWS, MOUTH, TURNS, PASS, SHOT, cheb, rngNext } from './tactics-football.js';
import type { Hooks, Level, ShotCtx, Team, Cell } from './tactics-football.js';

export { COLS, ROWS };
export const MATCHES = 10, STRIKES = 3;
/** the league, easiest first: each animal team plays its own way (a style in the tactics engine), with its own sprites
 * in public/art/kickabout/ (`<sprite>-stand` and so on; the keeper's are `<keeper>-stand` and `<keeper>-dive`). The
 * Grumble Galacticos are the boss, and the tenth match is their rematch. */
export const TEAMS: { id: string; name: string; kit: string; sprite: string; keeper: string; style: string; level: Level }[] = [
  { id: 'rabbit', name: 'Rabbit Rangers', kit: '#7ec8f0', sprite: 'rabbit', keeper: 'rabbit-keeper', style: 'Quick: they move 3 cells, but only lunge 1 cell to tackle.', level: { press: 1, zone: 1, lanes: 0, move: 3, shotRange: 4 } },
  { id: 'frog', name: 'Frog Wanderers', kit: '#f09a3a', sprite: 'frog', keeper: 'frog-keeper', style: 'They love a long ball, and win any lofted pass that lands next to one of them.', level: { press: 1, zone: 1, lanes: 0, move: 2, shotRange: 4, aerial: true } },
  { id: 'mole', name: 'Mole Miners', kit: '#8a5a3a', sprite: 'mole', keeper: 'mole-keeper', style: 'Every other turn one mole tunnels to any free cell within 4 (the dotted arrow).', level: { press: 1, zone: 1, lanes: 0, move: 2, shotRange: 5, sweeper: 1, tunnel: true } },
  { id: 'otter', name: 'Otter Athletic', kit: '#2aa8a0', sprite: 'otter', keeper: 'otter-keeper', style: 'Slick: with the ball they pass twice in one go, and two of them press, lunging up to 2 cells.', level: { press: 2, zone: 2, reach: 2, lanes: 1, move: 2, shotRange: 5, sweeper: 1, passes: 2, options: 1 } },
  { id: 'hog', name: 'Hedgehog Hotspurs', kit: '#3a5ad8', sprite: 'hog', keeper: 'hog-keeper', style: 'A spiky press: three of them close you down, lunging into every cell up to 4 away. Five on the pitch.', level: { press: 3, zone: 3, reach: 4, lanes: 1, move: 2, attackMove: 3, shotRange: 6, sweeper: 1, options: 1, extra: 1 } },
  { id: 'magpie', name: 'Magpie Rovers', kit: '#8a4ad8', sprite: 'magpie', keeper: 'magpie-keeper', style: 'Thieves: they steal any pass that goes past next to a magpie, and their press lunges 4 cells.', level: { press: 3, zone: 2, reach: 4, lanes: 2, move: 2, attackMove: 3, shotRange: 6, sweeper: 1, options: 2, extra: 1, thief: true } },
  { id: 'fox', name: 'Fox Forest', kit: '#24345a', sprite: 'fox', keeper: 'fox-keeper', style: 'Cunning: they read two passing lanes, lunge from 4 cells away, and break 3 cells at a time with the ball.', level: { press: 3, zone: 2, reach: 4, lanes: 2, move: 2, attackMove: 3, shotRange: 7, sweeper: 1, options: 2, extra: 1 } },
  { id: 'badger', name: 'Badger Borough', kit: '#d8a82a', sprite: 'badger', keeper: 'badger-keeper', style: 'Strong and slow: they move 1 cell, but lunge from 4 away and can’t be tackled from the front.', level: { press: 3, zone: 4, reach: 4, lanes: 2, move: 1, shotRange: 7, sweeper: 1, options: 1, extra: 1, front: true } },
  { id: 'grumble', name: 'Grumble Galacticos', kit: '#3a8a3a', sprite: 'grumble', keeper: 'gkeeper', style: 'The boss: six of them, quick, thieving, good in the air and slick on the ball. Everything at once.', level: { press: 4, zone: 4, reach: 4, lanes: 2, move: 3, shotRange: 7, sweeper: 1, options: 2, extra: 2, thief: true, passes: 2, aerial: true } },
  { id: 'grumble2', name: 'Grumble Galacticos', kit: '#3a8a3a', sprite: 'grumble', keeper: 'gkeeper', style: 'The rematch: all of that again, and now they tunnel too.', level: { press: 4, zone: 4, reach: 4, lanes: 2, move: 3, shotRange: 7, sweeper: 1, options: 2, extra: 2, thief: true, passes: 2, aerial: true, tunnel: true } },
];
/** the middle third, where Mud lies */
export const MUD: [number, number] = [6, 8];

// ---------------------------------------------------------------- the laws
/** our laws: gold cards, chosen after a win; `icon` is the cell of the gold icon sheet */
export const OURS = [
  { id: 'woodwork', icon: 'a', name: 'Woodwork', text: 'A shot that hits their post, or a save at a corner of the goal, counts as a goal worth 1.' },
  { id: 'headers', icon: 'b', name: 'Headers Double', text: 'Catch a lofted pass and shoot in the same turn: that’s a header, worth 2.' },
  { id: 'wide', icon: 'c', name: 'Wide Open', text: 'The goal we attack is a row wider.' },
  { id: 'distance', icon: 'd', name: 'From Distance', text: 'We can score from our own half, and those goals are worth 3.' },
  { id: 'parry', icon: 'e', name: 'Parry Back', text: 'When their keeper saves, the ball goes to the nearest red shirt.' },
  { id: 'late', icon: 'f', name: 'Late Show', text: 'Our goals in the last 3 turns are worth double.' },
  { id: 'pinball', icon: 'g', name: 'Pinball', text: 'Ground passes can bank off the side boards, and goals from a banked move are worth double.' },
  { id: 'sticky', icon: 'h', name: 'Sticky Boots', text: 'A player who got a pass this turn can only be tackled from right beside them, not by a lunge from further off.' },
  { id: 'deflect', icon: 'i', name: 'Deflections', text: 'A shot blocked by one defender goes in off them, if the keeper’s not there.' },
  { id: 'smalldoor', icon: 'j', name: 'Small Door', text: 'Our goal looks tiny from far out: they have to come 2 columns closer to shoot.' },
  { id: 'kickoff', icon: 'k', name: 'Kick-off Special', text: 'A goal in the turn we kick off is worth double.' },
  { id: 'bender', icon: 'l', name: 'Bender', text: 'A ground pass curls round one defender in its way.' },
  { id: 'thunder', icon: 'm', name: 'Thunder Boots', text: 'We can shoot from 2 columns further out, and keepers cover a cell less.' },
  { id: 'secondwind', icon: 'n', name: 'Second Wind', text: 'Once a turn, one of our players can move twice.' },
  { id: 'hattrick', icon: 'o', name: 'Hat-trick', text: 'Every third goal we score in a match is worth triple.' },
  { id: 'redpen', icon: 'p', name: 'Red Pen', text: 'Strike out one of their laws.' },
] as const;
/** their laws: purple cards, one per opposing team */
export const THEIRS = [
  { id: 'closing', icon: 'a', name: 'Closing In', text: 'Hedges grow in from both touchlines every 4 turns.' },
  { id: 'heavy', icon: 'b', name: 'Heavy Ball', text: 'Ground passes reach a cell less every 4 turns.' },
  { id: 'noback', icon: 'c', name: 'No Back-passes', text: 'A pass backwards gives the ball to the other side.' },
  { id: 'giant', icon: 'd', name: 'Giant Keeper', text: 'Their keeper covers a cell more of the goal.' },
  { id: 'tiny', icon: 'e', name: 'Tiny Goal', text: 'The goal we attack is a row narrower.' },
  { id: 'fog', icon: 'f', name: 'Fog', text: 'In their half, we can’t see what players more than 3 cells from the ball will do.' },
  { id: 'wind', icon: 'g', name: 'Wind', text: 'Lofted passes drift a row with the wind, which changes every turn.' },
  { id: 'five', icon: 'h', name: 'One More', text: 'They play with one more outfield player.' },
  { id: 'ice', icon: 'i', name: 'Ice', text: 'Anyone who moves 2 cells in a straight line slides a third.' },
  { id: 'sore', icon: 'j', name: 'Sore Losers', text: 'Their goals count double while they’re losing.' },
  { id: 'mud', icon: 'k', name: 'Mud', text: 'The middle third is mud: a step there costs two.' },
  { id: 'bouncy', icon: 'l', name: 'Bouncy Ball', text: 'Lofted passes bounce on a cell when they land.' },
  { id: 'short', icon: 'm', name: 'Short Matches', text: 'Matches are 2 turns shorter.' },
  { id: 'bignet', icon: 'n', name: 'Big Net', text: 'Our goal is a row wider.' },
] as const;
export type OurId = (typeof OURS)[number]['id'];
export type TheirId = (typeof THEIRS)[number]['id'];
export type LawId = OurId | TheirId;
export const ours = (id: OurId) => OURS.find((l) => l.id === id)!;
export const theirs = (id: TheirId) => THEIRS.find((l) => l.id === id)!;
export const isOurs = (id: LawId): id is OurId => OURS.some((l) => l.id === id);
export const lawOf = (id: LawId) => (isOurs(id) ? ours(id) : theirs(id as TheirId));
/** the laws a team can bring to the first two matches */
export const GENTLE: TheirId[] = ['heavy', 'wind', 'mud', 'short', 'bouncy'];
/** pairs of laws that touch the same thing; both cards show a link in the rulebook */
export const LINKS: [LawId, LawId, string][] = [
  ['woodwork', 'tiny', 'The woodwork still counts when the goal shrinks.'],
  ['woodwork', 'giant', 'A giant keeper saves more shots at the corners: Woodwork counts those.'],
  ['headers', 'bouncy', 'A bouncy ball rolls on to a header.'],
  ['pinball', 'closing', 'The hedges are boards too.'],
  ['wide', 'tiny', 'Wide Open and Tiny Goal cancel out.'],
  ['deflect', 'five', 'One more of them means more deflections.'],
  ['smalldoor', 'bignet', 'Small Door keeps their shots close, even at a big net.'],
  ['bender', 'noback', 'A pass curled round a defender can go backwards.'],
  ['thunder', 'giant', 'Thunder Boots take back the giant’s extra cell.'],
  ['late', 'short', 'A short match still has a last 3 turns.'],
  ['secondwind', 'mud', 'A second move gets through the mud.'],
];
export const linksOf = (id: LawId) => LINKS.filter((l) => l[0] === id || l[1] === id);

/** the team for a match */
export const team = (m: number) => TEAMS[Math.min(m, TEAMS.length - 1)];

export type Phase = 'law' | 'play' | 'pick' | 'redpen' | 'won' | 'lost';
export const OUR_SIDE = ['dora', 'enzo', 'pip', 'bram'];

export class Run {
  seed: number; rs: number;
  phase: Phase = 'law';
  match = 0;
  /** the season's opposing laws, in the order the teams bring them */
  order: TheirId[] = [];
  book: { ours: OurId[]; theirs: TheirId[]; struck: TheirId[] } = { ours: [], theirs: [], struck: [] };
  offer: OurId[] = [];
  strikes = 0;
  results: ('won' | 'drawn' | 'lost')[] = [];
  game!: Match;
  last: 'won' | 'drawn' | 'lost' | '' = '';
  stats = { goals: 0, conceded: 0, headers: 0, woodwork: 0, best: 0, won: 0, drawn: 0, lost: 0, played: 0, turns: 0 };
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1; this.rs = this.seed;
    this.order = this.makeOrder();
    this.startMatch();
  }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  has(id: LawId) { return (this.book.ours as string[]).includes(id) || (this.book.theirs as string[]).includes(id); }
  get foe() { return team(this.match); }
  get law() { return this.order[this.match]; }

  makeOrder() {
    const gentle = GENTLE.slice(), out: TheirId[] = [];
    for (let k = 0; k < 2; k++) out.push(gentle.splice(Math.floor(this.rnd() * gentle.length), 1)[0]);
    const rest: TheirId[] = THEIRS.map((l) => l.id).filter((id) => !out.includes(id));
    while (out.length < MATCHES) out.push(rest.splice(Math.floor(this.rnd() * rest.length), 1)[0]);
    return out;
  }

  /** the laws, as hooks into the match */
  hooks(): Hooks {
    const has = (id: LawId) => this.has(id);
    const g = () => this.game as Match | undefined;
    return {
      turns: () => TURNS - (has('short') ? 2 : 0),
      mouth: (side) => {
        let [lo, hi] = MOUTH;
        if (side === 1) { if (has('wide')) hi++; if (has('tiny')) lo++; }
        else if (has('bignet')) hi++;
        return [lo, hi];
      },
      moveCost: (c) => (has('mud') && c >= MUD[0] && c <= MUD[1] ? 2 : 1),
      blocked: (_c, r) => {
        if (!has('closing')) return false;
        const h = this.hedge;
        return r < h || r >= ROWS - h;
      },
      passRange: () => (has('heavy') ? Math.max(3, PASS - Math.floor((g()?.s.turn ?? 0) / 4)) : PASS),
      landing: (_t, from, to) => {
        let { c, r } = to;
        if (has('bouncy')) { c += Math.sign(to.c - from.c); r += Math.sign(to.r - from.r); }
        if (has('wind')) r += g()?.s.wind ?? 0;
        return { c, r };
      },
      keeperCover: (side, _d, base) => base + (side === 1 && has('giant') ? 1 : 0) - (side === 1 && has('thunder') ? 1 : 0),
      shotRange: (side) => (side === 0 ? SHOT + (has('thunder') ? 2 : 0) : this.foe.level.shotRange - (has('smalldoor') ? 2 : 0)),
      farShot: (u) => u.team === 0 && has('distance') && u.c <= 6,
      sticky: (team) => team === 0 && has('sticky'),
      bank: (team) => team === 0 && has('pinball'),
      bend: (team) => team === 0 && has('bender'),
      noBack: (team, u, bent) => has('noback') && !(team === 1 && u.keeper) && !bent,
      slide: () => has('ice'),
      secondWind: (team) => team === 0 && has('secondwind'),
      goalValue: (team, shot) => this.worth(team, shot),
      woodwork: (team) => (team === 0 && has('woodwork') ? { value: 1, notes: ['Woodwork'] } : { value: 0, notes: [] }),
      parry: (team) => team === 0 && has('parry'),
      deflect: (team) => team === 0 && has('deflect'),
      extraUnits: (team) => (team === 1 && has('five') ? 1 : 0),
      wind: (_turn, rnd) => (has('wind') ? (rnd() < 0.5 ? -1 : 1) : 0),
    };
  }
  /** how far the hedges have come in from each touchline */
  get hedge() { return this.has('closing') ? Math.min(2, Math.floor(((this.game as Match | undefined)?.s.turn ?? 0) / 4)) : 0; }
  /** what a goal is worth under the laws in the book, and why */
  worth(team: Team, shot: ShotCtx) {
    const notes: string[] = [];
    let v = 1;
    const s = this.game.s;
    if (team === 1) {
      if (this.has('sore') && s.score[1] < s.score[0]) { v = 2; notes.push('Sore Losers ×2'); }
      return { value: v, notes };
    }
    if (shot.header) { if (this.has('headers')) { v *= 2; notes.push('Header ×2'); } else notes.push('Header'); }
    if (this.has('distance') && shot.c <= 6) { v *= 3; notes.push('From Distance ×3'); }
    if (this.has('late') && s.turn >= s.maxTurns - 3) { v *= 2; notes.push('Late Show ×2'); }
    if (this.has('pinball') && shot.chain.some((p) => p.banked && p.turn === shot.turn)) { v *= 2; notes.push('Pinball ×2'); }
    if (this.has('deflect') && shot.deflected) notes.push('Deflection');
    if (this.has('kickoff') && s.kicked === 0) { v *= 2; notes.push('Kick-off Special ×2'); }
    if (this.has('hattrick') && (s.goals[0] + 1) % 3 === 0) { v *= 3; notes.push('Hat-trick ×3'); }
    return { value: v, notes };
  }

  /** a new match: the opponents' law joins the book, then their card is shown until ready() */
  startMatch() {
    const law = this.law;
    if (law && !this.book.theirs.includes(law)) this.book.theirs.push(law);
    this.phase = 'law'; this.last = '';
    this.game = undefined as unknown as Match;
    const t = this.foe;
    this.game = new Match({ seed: (this.seed * 31 + this.match * 977) >>> 0, outfield: [4, 4], who: { ours: OUR_SIDE, theirs: [t.sprite], keepers: ['keeper', t.keeper] }, level: t.level, hooks: this.hooks() });
  }
  ready() { if (this.phase === 'law') this.phase = 'play'; }

  // ---------------------------------------------------------------- the person's turn (each returns false if not allowed)
  move(id: number, c: number, r: number) { return this.phase === 'play' && this.after(this.game.move(id, c, r)); }
  pass(id: number, to: number, bank: 'top' | 'bottom' | null = null) { return this.phase === 'play' && this.after(this.game.pass(id, to, bank)); }
  loft(id: number, c: number, r: number) { return this.phase === 'play' && this.after(this.game.loft(id, c, r)); }
  shoot(id: number, row: number) { return this.phase === 'play' && this.after(this.game.shoot(id, row)); }
  tackle(id: number) { return this.phase === 'play' && this.after(this.game.tackle(id)); }
  undo() { return this.phase === 'play' && this.game.undo(); }
  endTurn() { if (this.phase !== 'play') return false; this.stats.turns++; return this.after(this.game.endTurn()); }
  /** counts what happened, and ends the match when the engine says it's over */
  private after(ok: boolean) {
    if (!ok) return false;
    for (const e of this.game.events) {
      if (e.k === 'goal') {
        if (e.team === 0) { this.stats.goals += e.value; this.stats.best = Math.max(this.stats.best, e.value); if (e.notes.some((n) => n.startsWith('Header'))) this.stats.headers++; if (e.notes.includes('Woodwork')) this.stats.woodwork++; }
        else this.stats.conceded += e.value;
      }
    }
    if (this.game.s.over) this.endMatch();
    return true;
  }
  endMatch() {
    const [a, c] = this.game.s.score;
    const res = a > c ? 'won' : a === c ? 'drawn' : 'lost';
    this.results.push(res); this.stats.played++; this.stats[res]++; this.last = res;
    if (res === 'lost') this.strikes++;
    if (this.strikes >= STRIKES) { this.phase = 'lost'; return; }
    if (this.match >= MATCHES - 1) { this.phase = 'won'; return; }
    this.phase = 'pick';
    if (res === 'lost') this.offer = []; else this.makeOffer(res === 'won' ? 3 : 2);
  }
  /** cards on offer: from our pool, with Red Pen now and then once they've laws to strike */
  makeOffer(n: number) {
    const pool: OurId[] = OURS.map((l) => l.id).filter((id) => id !== 'redpen' && !this.book.ours.includes(id));
    this.offer = [];
    if (this.book.theirs.length && this.rnd() < 0.35) this.offer.push('redpen');
    while (this.offer.length < n && pool.length) this.offer.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
    for (let k = this.offer.length - 1; k > 0; k--) { const j = Math.floor(this.rnd() * (k + 1)); [this.offer[k], this.offer[j]] = [this.offer[j], this.offer[k]]; }
  }
  /** takes a card (none after a defeat); Red Pen then asks which of their laws to strike */
  pick(id?: OurId) {
    if (this.phase !== 'pick') return false;
    if (id) {
      if (!this.offer.includes(id)) return false;
      if (id === 'redpen') { this.offer = []; this.phase = 'redpen'; return true; }
      this.book.ours.push(id);
    }
    this.offer = []; this.match++;
    this.startMatch();
    return true;
  }
  strike(id: TheirId) {
    if (this.phase !== 'redpen' || !this.book.theirs.includes(id)) return false;
    this.book.theirs = this.book.theirs.filter((t) => t !== id); this.book.struck.push(id);
    this.phase = 'pick'; return this.pick();
  }
  /** for Fog: can we see what this opponent will do? */
  visible(id: number) {
    if (!this.has('fog')) return true;
    const u = this.game.unit(id), b: Cell = this.game.ballCell();
    return u.team === 0 || u.keeper || u.c < COLS / 2 || cheb(u, b) <= 3;
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'rulebook-fc-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { match: number; goal: number };
  stats: { runs: number; seasons: number; goals: number };
  /** every law that has been in a rulebook or offered */
  seen: LawId[];
  settings: { sound: boolean; music: boolean };
};
export const ALL_LAWS: LawId[] = [...OURS.map((l) => l.id), ...THEIRS.map((l) => l.id)];
export const newSave = (): Save => ({ v: 1, intro: false, best: { match: 0, goal: 0 }, stats: { runs: 0, seasons: 0, goals: 0 }, seen: [], settings: { sound: true, music: true } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    s.intro = o.intro === true;
    for (const k of ['match', 'goal'] as const) s.best[k] = num(o.best?.[k]);
    for (const k of ['runs', 'seasons', 'goals'] as const) s.stats[k] = num(o.stats?.[k]);
    if (Array.isArray(o.seen)) s.seen = ALL_LAWS.filter((id) => o.seen.includes(id));
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** notes the laws in a rulebook (and any card on offer) as discovered */
export function discover(s: Save, r: Run) {
  for (const id of [...r.book.ours, ...r.book.theirs, ...r.book.struck, ...r.offer] as LawId[]) if (!s.seen.includes(id)) s.seen.push(id);
}
/** adds a finished run to the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.goals += r.stats.goals;
  if (r.phase === 'won') s.stats.seasons++;
  s.best.match = Math.max(s.best.match, r.stats.played);
  s.best.goal = Math.max(s.best.goal, r.stats.best);
  discover(s, r);
}

// Acorn Hand: the rules of a poker-scoring card run. Deterministic and DOM-free: a run is a seed plus the choices made,
// and every random draw comes from the run's own generator, whose state is saved with it.
import {
  type Card, type Suit, type Gloss, type HandId, type Ctx, type Effect, type Charm, type Item, type Boss, type BossRule,
  HANDS, CONTAINS, CHARMS, TREATS, BOSSES, BLIND, ANTES, COST, ITEM_COST, VOUCHERS, VOUCHER_COST, voucherById, PACK_KINDS, SHOP_PACKS, BIG_PACK_ODDS, PACK_DEAL, CARD_PACK_GLOSS, packById, handById, charmById, treatById, bossByRule, anteBase, cardChips, isFace,
} from './acorn-hand-cards.js';

export * from './acorn-hand-cards.js';
/** The run save's shape; version 2 added vouchers and packs. The record has its own version, so it survives. */
export const SAVE_VERSION = 2, PROFILE_VERSION = 1;
export const START_NUTS = 4, HAND_SIZE = 8, PLAYS = 4, DISCARDS = 3, MAX_PLAY = 5, CHARM_SLOTS = 5, ITEM_SLOTS = 2;
export const INTEREST_EVERY = 5, INTEREST_CAP = 5, REROLL = 5, SHOP_CHARMS = 2, SHOP_ITEMS = 2;
/** What Squirrel Hoard raises the interest cap to, and what Haggler starts a reroll at. */
export const HOARD_CAP = 10, HAGGLER_REROLL = 3;
/** How often the shop offers a common, uncommon or rare charm, and how much more it likes one that fits the run. */
export const RARITY_ODDS = [0, 0.7, 0.25, 0.05], FIT_WEIGHT = 2.5;
export const SKIP_NUTS = 4;
/** Harder stakes for players who win. Each keeps every rule of the stakes below it; winning a run on one opens the next. */
export const STAKES = [
  { id: 'green', name: 'Green stake', text: 'The run as it comes.' },
  { id: 'bronze', name: 'Bronze stake', text: 'The small round pays no blind reward.' },
  { id: 'silver', name: 'Silver stake', text: 'Targets from ante 2 on are a quarter higher.' },
  { id: 'gold', name: 'Gold stake', text: 'One discard fewer each round.' },
] as const;
export const SILVER_TARGETS = 1.25;

/** A generator whose whole state is one number, so it saves and replays exactly. */
export class Rand {
  constructor(public s: number) { this.s = s >>> 0; }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number) { return Math.floor(this.next() * n); }
  pick<T>(a: readonly T[]) { return a[this.int(a.length)]; }
  shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  weighted<T>(a: readonly T[], w: (x: T) => number) {
    const total = a.reduce((s, x) => s + w(x), 0);
    let r = this.next() * total;
    for (const x of a) { r -= w(x); if (r < 0) return x; }
    return a[a.length - 1];
  }
}

// ── Reading a hand ────────────────────────────────────────────────────────────

export type Rules = { fourFlush: boolean; fourStraight: boolean; splash: boolean };
const NO_RULES: Rules = { fourFlush: false, fourStraight: false, splash: false };

/** The cards that make a straight of `len`, one per rank, aces high or low; null if there is none. */
function straightOf(cards: Card[], len: number): number[] | null {
  const byRank = new Map<number, number>();
  cards.forEach((c, i) => { if (!byRank.has(c.rank)) byRank.set(c.rank, i); });
  if (byRank.has(14)) byRank.set(1, byRank.get(14)!);
  for (let top = 14; top >= len; top--) {
    const run: number[] = [];
    for (let r = top; r > top - len; r--) { const i = byRank.get(r); if (i === undefined) break; run.push(i); }
    if (run.length === len) return run;
  }
  return null;
}
function flushOf(cards: Card[], len: number): number[] | null {
  for (let s = 0; s < 4; s++) { const idx = cards.flatMap((c, i) => (c.suit === s ? [i] : [])); if (idx.length >= len) return idx; }
  return null;
}

/** The best hand among the played cards and which of them score, as indices in play order. */
export function evaluate(cards: Card[], rules: Rules = NO_RULES): { hand: HandId; scoring: number[] } {
  const n = cards.length, all = cards.map((_, i) => i);
  const groups = new Map<number, number[]>();
  cards.forEach((c, i) => groups.set(c.rank, [...(groups.get(c.rank) ?? []), i]));
  const sets = [...groups.values()].sort((a, b) => b.length - a.length || cards[b[0]].rank - cards[a[0]].rank);
  const need = (big: boolean) => (big ? 4 : 5);
  const flush = n >= need(rules.fourFlush) ? flushOf(cards, need(rules.fourFlush)) : null;
  const straight = n >= need(rules.fourStraight) ? straightOf(cards, need(rules.fourStraight)) : null;
  const sorted = (idx: number[]) => [...new Set(idx)].sort((a, b) => a - b);
  let hand: HandId, scoring: number[];
  if (sets[0].length >= 5) { hand = flush && flush.length >= 5 ? 'ffive' : 'five'; scoring = sets[0]; }
  else if (straight && flush) { hand = 'sflush'; scoring = sorted([...straight, ...flush]); }
  else if (sets[0].length === 4) { hand = 'four'; scoring = sets[0]; }
  else if (sets[0].length === 3 && sets[1]?.length >= 2) { hand = 'full'; scoring = [...sets[0], ...sets[1]]; }
  else if (flush) { hand = 'flush'; scoring = flush; }
  else if (straight) { hand = 'straight'; scoring = straight; }
  else if (sets[0].length === 3) { hand = 'three'; scoring = sets[0]; }
  else if (sets[0].length === 2 && sets[1]?.length === 2) { hand = 'two'; scoring = [...sets[0], ...sets[1]]; }
  else if (sets[0].length === 2) { hand = 'pair'; scoring = sets[0]; }
  else { hand = 'high'; scoring = [all.reduce((best, i) => (cards[i].rank > cards[best].rank ? i : best), 0)]; }
  return { hand, scoring: rules.splash ? all : sorted(scoring) };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/** One moment of a score, with the running totals after it, for the page to count up and for the tests. */
/** `card` is the played card's index for card and boss steps, and the held card's index (in hand order) for held steps. */
export type Step = { who: 'hand' | 'card' | 'held' | 'charm' | 'boss'; ref: string; card?: number; text: string; chips: number; mult: number };
export type Score = { hand: HandId; level: number; scoring: number[]; steps: Step[]; chips: number; mult: number; total: number; nuts: number };
export type Owned = { id: string; state: number };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

/** The charm whose hooks a slot uses: itself, or for an echo, the next charm along that is not an echo. */
function acting(charms: Owned[], i: number): Owned | null {
  for (let k = i; k < charms.length; k++) { const def = charmById(charms[k].id)!; if (!def.echo) return charms[k]; if (k > i + 4) break; }
  return null;
}

/**
 * Score cards played from a hand. Pure: it reads the state it is given and changes nothing, so the page can show what a
 * selection would score and the bot can weigh every choice. `states` are the charm counters after the play's own
 * `played` hooks have run.
 */
export function scorePlay(o: {
  played: Card[]; held: Card[]; charms: Owned[]; states: number[]; levels: Record<HandId, number>; rules: Rules;
  playsLeft: number; discardsLeft: number; nuts: number; deckLeft: number; firstPlay: boolean; lastPlay: boolean;
  boss: BossRule | null; fame: HandId | null; sageLevels: number;
}): Score {
  const { hand, scoring } = evaluate(o.played, o.rules), h = handById(hand), level = o.levels[hand] + o.sageLevels;
  let chips = h.chips + h.upChips * (level - 1), mult = h.mult + h.upMult * (level - 1);
  const steps: Step[] = [{ who: 'hand', ref: hand, text: `${h.name} · level ${level}`, chips, mult }];
  if (o.boss === 'fame' && o.fame === hand) {
    chips = Math.floor(chips / 2); mult = Math.max(1, Math.floor(mult / 2));
    steps.push({ who: 'boss', ref: 'fame', text: 'The Lizard halves it', chips, mult });
  }
  const scoringCards = scoring.map((i) => o.played[i]);
  const ctx = (state: number): Ctx => ({
    hand, played: o.played, scoring: scoringCards, held: o.held, playsLeft: o.playsLeft, discardsLeft: o.discardsLeft,
    nuts: o.nuts, deckLeft: o.deckLeft, charms: o.charms.length, firstPlay: o.firstPlay, lastPlay: o.lastPlay, state,
  });
  let nuts = 0;
  const apply = (e: Effect | null, who: Step['who'], ref: string, card?: number) => {
    if (!e) return;
    const said: string[] = [];
    if (e.chips) { chips += e.chips; said.push(`+${fmt(e.chips)} chips`); }
    if (e.mult) { mult += e.mult; said.push(`+${fmt(e.mult)} mult`); }
    if (e.xmult && e.xmult !== 1) { mult *= e.xmult; said.push(`×${fmt(e.xmult)} mult`); }
    if (e.nuts) { nuts += e.nuts; said.push(`+${e.nuts} nuts`); }
    if (said.length) steps.push({ who, ref, card, text: said.join(', '), chips, mult });
  };
  const sleeping = (c: Card) => o.boss === `suit${c.suit}`;
  const team = o.charms.map((_, i) => acting(o.charms, i));
  scoring.forEach((pi, i) => {
    const c = o.played[pi];
    if (sleeping(c)) { steps.push({ who: 'boss', ref: o.boss!, card: pi, text: 'asleep: scores nothing', chips, mult }); return; }
    let times = 1;
    team.forEach((t) => { if (t && charmById(t.id)!.again?.(c, i, ctx(o.states[o.charms.indexOf(t)]))) times++; });
    for (let k = 0; k < times; k++) {
      apply({ chips: cardChips(c.rank) }, 'card', 'card', pi);
      if (c.gloss === 'honey') apply({ chips: 30 }, 'card', 'honey', pi);
      if (c.gloss === 'ember') apply({ mult: 4 }, 'card', 'ember', pi);
      if (c.gloss === 'crystal') apply({ xmult: 1.5 }, 'card', 'crystal', pi);
      team.forEach((t, ci) => { if (t) apply(charmById(t.id)!.card?.(c, i, ctx(o.states[o.charms.indexOf(t)])) ?? null, 'charm', o.charms[ci].id, pi); });
    }
  });
  o.held.forEach((c, hi) => team.forEach((t, ci) => { if (t && !sleeping(c)) apply(charmById(t.id)!.held?.(c, ctx(o.states[o.charms.indexOf(t)])) ?? null, 'held', o.charms[ci].id, hi); }));
  team.forEach((t, ci) => { if (t) apply(charmById(t.id)!.main?.(ctx(o.states[o.charms.indexOf(t)])) ?? null, 'charm', o.charms[ci].id); });
  return { hand, level, scoring, steps, chips, mult, total: Math.floor(chips * mult), nuts };
}

// ── A run ─────────────────────────────────────────────────────────────────────

export type Phase = 'pick' | 'round' | 'cashout' | 'shop' | 'pack' | 'over' | 'victory';
export type Round = {
  target: number; score: number; plays: number; discards: number; draw: number[]; hand: number[]; facedown: number[];
  firstPlay: boolean; played: number; last: Score | null; lastIds: number[];
};
export type Cash = { blind: number; plays: number; interest: number; charms: number; gold: number; total: number };
export type Shop = { charms: (string | null)[]; items: (Item | null)[]; packs: (string | null)[]; rerolls: number };
/** An open pack: what is in it (null once taken; cards have id -1 until taken), picks left, and the cards dealt for a treat pack. */
export type Pack = { id: string; options: (string | Card | null)[]; picks: number; dealt: number[] };
export type Save = {
  v: number; seed: number; rand: number; ante: number; blind: number; phase: Phase; endless: boolean; nuts: number; nextId: number;
  /** Absent in saves from before stakes, which are green runs. */
  stake?: number;
  deck: Card[]; levels: Record<HandId, number>; played: Record<HandId, number>; charms: Owned[]; items: Item[];
  bosses: BossRule[]; round: Round | null; cash: Cash | null; shop: Shop | null; pack: Pack | null; vouchers: string[]; offer: string | null; best: number; rounds: number;
};
const GLOSSES: Gloss[] = ['', 'honey', 'ember', 'crystal', 'gold'];

const freshLevels = () => Object.fromEntries(HANDS.map((h) => [h.id, 1])) as Record<HandId, number>;
const freshCounts = () => Object.fromEntries(HANDS.map((h) => [h.id, 0])) as Record<HandId, number>;

export class Run {
  seed: number; rand: Rand; ante = 1; blind = 0; phase: Phase = 'pick'; endless = false; nuts = START_NUTS; nextId = 0;
  deck: Card[] = []; levels = freshLevels(); played = freshCounts(); charms: Owned[] = []; items: Item[] = [];
  bosses: BossRule[] = []; round: Round | null = null; cash: Cash | null = null; shop: Shop | null = null; pack: Pack | null = null;
  /** Vouchers owned, in the order bought, and this ante's offer (null once bought, or when all are owned). */
  vouchers: string[] = []; offer: string | null = null;
  /** The best single hand of the run, and rounds won. */
  best = 0; rounds = 0;

  /** The stake, an index into STAKES. */
  stake: number;

  constructor(seed: number, stake = 0) {
    this.stake = stake;
    this.seed = seed >>> 0; this.rand = new Rand(this.seed ^ 0x5eed);
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) this.deck.push({ id: this.nextId++, rank: r, suit: s as Suit, gloss: '' });
    this.bossFor(1); this.rollOffer();
  }

  // What this round is
  /** The boss rule of an ante, choosing more as the run goes on, never the same rule twice in a row. */
  bossFor(ante: number): Boss {
    while (this.bosses.length < ante) {
      const last = this.bosses[this.bosses.length - 1];
      const unused = BOSSES.filter((b) => !this.bosses.includes(b.rule));
      const pool = (unused.length ? unused : BOSSES).filter((b) => b.rule !== last);
      this.bosses.push(this.rand.pick(pool).rule);
    }
    return bossByRule(this.bosses[ante - 1]);
  }
  get boss(): Boss | null { return this.blind === 2 ? this.bossFor(this.ante) : null; }
  get rule(): BossRule | null { return this.phase === 'round' ? this.boss?.rule ?? null : null; }
  targetOf(blind = this.blind) { return Math.round(anteBase(this.ante) * BLIND[blind].scale * (blind === 2 && this.bossFor(this.ante).rule === 'shell' ? 1.5 : 1) * (this.stake >= 2 && this.ante >= 2 ? SILVER_TARGETS : 1)); }
  has(rule: Charm['rule']) { return this.charms.filter((c) => charmById(c.id)!.rule === rule).length; }
  get rules(): Rules { const ff = this.has('fourFlush') > 0; return { fourFlush: ff, fourStraight: ff, splash: this.has('splash') > 0 }; }
  owns(v: string) { return this.vouchers.includes(v); }
  get handSize() { return HAND_SIZE + this.has('handSize') + (this.owns('hand') ? 1 : 0) - this.has('tight') - (this.boss?.rule === 'small' ? 1 : 0); }
  get maxPlays() { return this.boss?.rule === 'plays' ? 3 : PLAYS + this.has('play') + (this.owns('play') ? 1 : 0); }
  get maxDiscards() { return this.boss?.rule === 'nodiscard' ? 0 : Math.max(0, DISCARDS + this.has('discard') + (this.owns('discard') ? 1 : 0) - (this.stake >= 3 ? 1 : 0)); }
  get charmSlots() { return CHARM_SLOTS + (this.owns('shelf') ? 1 : 0); }
  get itemSlots() { return ITEM_SLOTS + (this.owns('pockets') ? 1 : 0); }
  get interestCap() { return this.owns('hoard') ? HOARD_CAP : INTEREST_CAP; }
  get shopCharms() { return SHOP_CHARMS + (this.owns('stall') ? 1 : 0); }
  get packBonus() { return this.owns('market') ? 1 : 0; }
  /** The hand type played most this run, which the Lizard halves; none until something has been played. */
  get fame(): HandId | null { let best: HandId | null = null; for (const h of HANDS) if (this.played[h.id] > 0 && (!best || this.played[h.id] > this.played[best])) best = h.id; return best; }
  card(id: number) { return this.deck.find((c) => c.id === id)!; }
  get hand(): Card[] { return this.round ? this.round.hand.map((id) => this.card(id)) : []; }
  hidden(id: number) { return !!this.round?.facedown.includes(id); }

  // Choosing a round
  /** Play the round on offer. */
  start() {
    if (this.phase !== 'pick') return false;
    const r: Round = {
      target: this.targetOf(), score: 0, plays: this.maxPlays, discards: this.maxDiscards, draw: this.rand.shuffle(this.deck.map((c) => c.id)),
      hand: [], facedown: [], firstPlay: true, played: 0, last: null, lastIds: [],
    };
    this.round = r; this.phase = 'round';
    this.fill(this.handSize);
    if (this.boss?.rule === 'fog') r.facedown = [...r.hand];
    return true;
  }
  /** Pass up a small or big round for a free item, or nuts if the item slots are full. */
  skip() {
    if (this.phase !== 'pick' || this.blind === 2) return null;
    let got: Item | null = null;
    if (this.items.length < this.itemSlots) { got = this.rollItem(); this.items.push(got); } else this.nuts += SKIP_NUTS;
    this.blind++;
    return got ?? 'nuts';
  }
  private fill(upTo: number, limit = Infinity) {
    const r = this.round!;
    let drawn = 0;
    while (r.hand.length < upTo && r.draw.length && drawn < limit) {
      const id = r.draw.shift()!; r.hand.push(id); drawn++;
      if (this.boss?.rule === 'veil' && isFace(this.card(id).rank)) r.facedown.push(id);
    }
  }
  /** Reorder the hand by rank (high first) or by suit. Indices the page holds go stale, so it selects by id. */
  sort(by: 'rank' | 'suit') {
    if (!this.round) return;
    // A face-down card goes to the end, so sorting cannot give away what it is.
    const key = (id: number) => { const c = this.card(id); return this.hidden(id) ? -1 : by === 'rank' ? c.rank * 4 + (3 - c.suit) : (3 - c.suit) * 20 + c.rank; };
    this.round.hand.sort((a, b) => key(b) - key(a) || a - b);
  }
  /** Move a card within the hand. */
  move(id: number, to: number) {
    const h = this.round?.hand; if (!h) return;
    const from = h.indexOf(id); if (from < 0) return;
    h.splice(from, 1); h.splice(Math.max(0, Math.min(h.length, to)), 0, id);
  }

  /** Why a set of cards cannot be played, or null if it can. */
  whyNot(ids: number[]): string | null {
    const r = this.round;
    if (this.phase !== 'round' || !r) return 'There is no round going.';
    if (!ids.length) return 'Choose the cards to play.';
    if (ids.length > MAX_PLAY) return `Play at most ${MAX_PLAY} cards.`;
    if (new Set(ids).size !== ids.length || ids.some((id) => !r.hand.includes(id))) return 'Those cards are not in your hand.';
    if (this.boss?.rule === 'five' && ids.length !== 5 && r.hand.length >= 5) return 'The Badger wants exactly five cards.';
    if (r.plays <= 0) return 'No plays left.';
    return null;
  }

  private context(ids: number[], last = false) {
    const r = this.round!, played = ids.map((id) => this.card(id)), held = r.hand.filter((id) => !ids.includes(id)).map((id) => this.card(id));
    const sageLevels = r.firstPlay ? this.charms.reduce((n, _, i) => n + (charmById(acting(this.charms, i)?.id ?? '')?.sage ? 1 : 0), 0) : 0;
    const probe = evaluate(played, this.rules);
    const ctx = (state: number): Ctx => ({
      hand: probe.hand, played, scoring: probe.scoring.map((i) => played[i]), held, playsLeft: r.plays - 1, discardsLeft: r.discards,
      nuts: this.nuts, deckLeft: r.draw.length, charms: this.charms.length, firstPlay: r.firstPlay, lastPlay: last || r.plays === 1, state,
    });
    const states = this.charms.map((c) => { const d = charmById(c.id)!; return d.played ? d.played(ctx(c.state)) : c.state; });
    return {
      played, held, states, sageLevels, hand: probe.hand,
      input: {
        played, held, charms: this.charms, states, levels: this.levels, rules: this.rules, playsLeft: r.plays - 1, discardsLeft: r.discards,
        nuts: this.nuts, deckLeft: r.draw.length, firstPlay: r.firstPlay, lastPlay: last || r.plays === 1, boss: this.rule, fame: this.fame, sageLevels,
      },
    };
  }
  /** What playing these cards would score, without playing them. */
  preview(ids: number[]): Score | null { return this.whyNot(ids) ? null : scorePlay(this.context(ids).input); }

  /** Play cards from the hand. Returns the score, or null if they cannot be played. */
  play(ids: number[]): Score | null {
    if (this.whyNot(ids)) return null;
    const r = this.round!, k = this.context(ids), s = scorePlay(k.input);
    this.charms.forEach((c, i) => { c.state = k.states[i]; });
    if (k.sageLevels) this.levels[k.hand] += k.sageLevels;
    this.played[s.hand]++;
    r.score += s.total; r.plays--; r.played++; r.firstPlay = false; r.last = s; r.lastIds = [...ids];
    this.nuts += s.nuts; this.best = Math.max(this.best, s.total);
    r.hand = r.hand.filter((id) => !ids.includes(id)); r.facedown = r.facedown.filter((id) => !ids.includes(id));
    if (r.score >= r.target) this.win();
    else if (r.plays <= 0) this.phase = 'over';
    else this.fill(this.handSize, this.boss?.rule === 'trickle' ? 3 : Infinity);
    return s;
  }
  /** Throw cards away and draw new ones. */
  discard(ids: number[]) {
    const r = this.round;
    if (this.phase !== 'round' || !r || r.discards <= 0 || !ids.length || ids.length > MAX_PLAY || new Set(ids).size !== ids.length || ids.some((id) => !r.hand.includes(id))) return false;
    const cards = ids.map((id) => this.card(id));
    for (const c of this.charms) { const d = charmById(c.id)!.discarded?.(cards, c.state); if (d) { if (d.state !== undefined) c.state = d.state; this.nuts += d.nuts ?? 0; } }
    r.discards--; r.hand = r.hand.filter((id) => !ids.includes(id)); r.facedown = r.facedown.filter((id) => !ids.includes(id));
    this.fill(this.handSize, this.boss?.rule === 'trickle' ? 3 : Infinity);
    return true;
  }

  private win() {
    const r = this.round!, boss = this.blind === 2;
    let charms = 0;
    for (const c of this.charms) { const w = charmById(c.id)!.roundWon?.(c.state, boss); if (w) { if (w.state !== undefined) c.state = w.state; charms += w.nuts ?? 0; } }
    const gold = 3 * r.hand.filter((id) => this.card(id).gloss === 'gold').length;
    const interest = Math.min(this.interestCap, Math.floor(this.nuts / INTEREST_EVERY));
    const blind = this.stake >= 1 && this.blind === 0 ? 0 : BLIND[this.blind].reward, total = blind + r.plays + interest + charms + gold;
    this.cash = { blind, plays: r.plays, interest, charms, gold, total };
    this.rounds++;
    this.phase = 'cashout';
  }
  /** Collect the round's nuts and go on to the shop, or to the victory screen after the eighth boss. */
  collect() {
    if (this.phase !== 'cashout' || !this.cash) return false;
    this.nuts += this.cash.total; this.cash = null; this.round = null;
    const beatFinal = this.blind === 2 && this.ante === ANTES && !this.endless;
    if (this.blind === 2) { this.ante++; this.blind = 0; this.bossFor(this.ante); this.rollOffer(); } else this.blind++;
    if (beatFinal) { this.phase = 'victory'; return true; }
    this.openShop();
    return true;
  }
  /** After winning, carry on into endless antes. */
  goEndless() { if (this.phase !== 'victory') return false; this.endless = true; this.openShop(); return true; }

  // The shop
  /** Charm ids the run already leans on: its most-played hand types and the deck's commonest suit. */
  private leanings(): Set<string> {
    const out = new Set<string>(['any']);
    const top = HANDS.filter((h) => this.played[h.id] > 0).sort((a, b) => this.played[b.id] - this.played[a.id]).slice(0, 2);
    for (const h of top) for (const c of CONTAINS[h.id]) out.add(c);
    const suits = [0, 1, 2, 3].map((s) => this.deck.filter((c) => c.suit === s).length), most = suits.indexOf(Math.max(...suits));
    if (suits[most] > 13) out.add(`s${most}`);
    if (this.deck.some((c) => c.gloss)) out.add('gloss');
    return out;
  }
  private rollCharm(taken: string[]): string | null {
    const free = CHARMS.filter((c) => !this.charms.some((o) => o.id === c.id) && !taken.includes(c.id));
    if (!free.length) return null;
    const lean = this.leanings(), lucky = this.owns('lucky');
    return this.rand.weighted(free, (c) => RARITY_ODDS[c.rarity] * (lucky && c.rarity > 1 ? 2 : 1) / CHARMS.filter((x) => x.rarity === c.rarity).length * (c.tags.some((t) => t !== 'any' && lean.has(t)) ? FIT_WEIGHT : 1)).id;
  }
  /** An almanac page's hand: five of a kind and flush five only once played, the most-played hand four times as likely. */
  private rollHand(taken: string[] = []): HandId {
    const lean = this.fame;
    const pool = HANDS.filter((h) => (h.id !== 'five' && h.id !== 'ffive' || this.played[h.id] > 0) && !taken.includes(h.id));
    return this.rand.weighted(pool, (h) => (h.id === lean ? 4 : 1)).id;
  }
  private rollItem(taken: Item[] = []): Item {
    if (this.rand.next() < 0.5) return { kind: 'almanac', id: this.rollHand(taken.filter((it) => it.kind === 'almanac').map((it) => it.id)) };
    return { kind: 'treat', id: this.rand.pick(TREATS.filter((t) => !taken.some((it) => it.kind === 'treat' && it.id === t.id))).id };
  }
  /** A playing card for a card pack: any rank and suit, glossed now and then. Its id is set when it is taken. */
  private rollCard(): Card {
    const rank = 2 + this.rand.int(13), suit = this.rand.int(4) as Suit;
    return { id: -1, rank, suit, gloss: this.rand.next() < CARD_PACK_GLOSS ? this.rand.pick(GLOSSES.slice(1)) : '' };
  }

  private stock() {
    const charms: (string | null)[] = [];
    for (let i = 0; i < this.shopCharms; i++) charms.push(this.rollCharm(charms.filter((x): x is string => !!x)));
    const items: (Item | null)[] = [];
    for (let i = 0; i < SHOP_ITEMS; i++) items.push(this.rollItem(items.filter((it): it is Item => !!it)));
    const packs: (string | null)[] = [];
    for (let i = 0; i < SHOP_PACKS; i++) { const kind = this.rand.pick(PACK_KINDS); packs.push(this.rand.next() < BIG_PACK_ODDS ? `${kind}-big` : kind); }
    return { charms, items, packs };
  }
  private openShop() { this.shop = { ...this.stock(), rerolls: 0 }; this.phase = 'shop'; }
  get rerollCost() { return (this.owns('haggler') ? HAGGLER_REROLL : REROLL) + (this.shop?.rerolls ?? 0); }
  priceOf(id: string) { return COST[charmById(id)!.rarity]; }
  sellPrice(id: string) { return Math.max(1, Math.floor(this.priceOf(id) / 2)); }
  buyCharm(slot: number) {
    const id = this.shop?.charms[slot];
    if (this.phase !== 'shop' || !id || this.charms.length >= this.charmSlots || this.charms.some((c) => c.id === id) || this.nuts < this.priceOf(id)) return false;
    this.nuts -= this.priceOf(id); this.shop!.charms[slot] = null;
    this.charms.push({ id, state: charmById(id)!.start ?? 0 });
    return true;
  }
  buyItem(slot: number) {
    const it = this.shop?.items[slot];
    if (this.phase !== 'shop' || !it || this.items.length >= this.itemSlots || this.nuts < ITEM_COST) return false;
    this.nuts -= ITEM_COST; this.shop!.items[slot] = null; this.items.push(it);
    return true;
  }
  sell(index: number) {
    const c = this.charms[index];
    if (!c || (this.phase !== 'shop' && this.phase !== 'pick' && this.phase !== 'round' && this.phase !== 'pack')) return false;
    // Selling a charm that changes the hand size mid-round would leave the hand the wrong size: only between rounds.
    if (this.phase === 'round' && charmById(c.id)!.rule) return false;
    this.nuts += this.sellPrice(c.id); this.charms.splice(index, 1);
    return true;
  }
  /** Swap a charm with its neighbour: order matters, ×mult is worth more at the end. */
  shift(index: number, by: -1 | 1) {
    const j = index + by;
    if (!this.charms[index] || !this.charms[j]) return false;
    [this.charms[index], this.charms[j]] = [this.charms[j], this.charms[index]];
    return true;
  }
  reroll() {
    if (this.phase !== 'shop' || this.nuts < this.rerollCost) return false;
    this.nuts -= this.rerollCost; const n = this.shop!.rerolls + 1, before = this.shop!.charms.filter((x): x is string => !!x);
    this.shop = { charms: [], items: this.shop!.items, packs: this.shop!.packs, rerolls: n };
    // A reroll shows charms you have not just been looking at.
    for (let i = 0; i < this.shopCharms; i++) this.shop.charms.push(this.rollCharm([...before, ...this.shop.charms.filter((x): x is string => !!x)]));
    return true;
  }
  leave() { if (this.phase !== 'shop') return false; this.shop = null; this.phase = 'pick'; return true; }
  /** Buy this ante's voucher. */
  buyVoucher() {
    const id = this.offer;
    if (this.phase !== 'shop' || !id || this.nuts < VOUCHER_COST) return false;
    this.nuts -= VOUCHER_COST; this.vouchers.push(id); this.offer = null;
    return true;
  }
  /** Put a voucher not yet owned on the shelf for the coming ante, or none once all are owned. */
  private rollOffer() {
    const free = VOUCHERS.filter((v) => !this.vouchers.includes(v.id));
    this.offer = free.length ? this.rand.pick(free).id : null;
  }

  // Booster packs
  /** Open one of the shop's packs: pay, roll what is inside and, for treats, deal cards from the deck to use them on. */
  openPack(slot: number) {
    const id = this.shop?.packs[slot], t = id ? packById(id) : undefined;
    if (this.phase !== 'shop' || !t || this.nuts < t.cost) return false;
    this.nuts -= t.cost; this.shop!.packs[slot] = null;
    const options: (string | Card | null)[] = [], names = () => options.filter((o): o is string => typeof o === 'string');
    for (let i = 0; i < t.shown + this.packBonus; i++) {
      const o = t.kind === 'charm' ? this.rollCharm(names()) : t.kind === 'almanac' ? this.rollHand(names())
        : t.kind === 'treat' ? this.rand.pick(TREATS.filter((x) => !names().includes(x.id))).id : this.rollCard();
      if (o !== null) options.push(o);
    }
    const dealt = t.kind === 'treat' ? this.rand.shuffle(this.deck.map((c) => c.id)).slice(0, PACK_DEAL) : [];
    const picks = Math.min(t.picks, options.length);
    if (picks) { this.pack = { id: t.id, options, picks, dealt }; this.phase = 'pack'; }
    return true;
  }
  /** Why option `i` of the open pack cannot be taken with these dealt cards selected, or null if it can. */
  packWhyNot(i: number, ids: number[] = []): string | null {
    const p = this.pack;
    if (this.phase !== 'pack' || !p) return 'No pack is open.';
    const o = p.options[i];
    if (o === null || o === undefined) return 'That one is taken.';
    const kind = packById(p.id)!.kind;
    if (kind === 'charm' && this.charms.some((c) => c.id === o)) return 'You already have that charm.';
    if (kind === 'charm' && this.charms.length >= this.charmSlots) return 'Your charm slots are full: sell one to make room.';
    return kind === 'treat' ? this.treatWhyNot(o as string, ids, p.dealt, 'Select cards dealt for the pack.') : null;
  }
  /** Take option `i`: a charm into a slot, a page or treat used at once, a card into the deck. The last pick closes the pack. */
  takePack(i: number, ids: number[] = []) {
    if (this.packWhyNot(i, ids)) return false;
    const p = this.pack!, o = p.options[i]!, kind = packById(p.id)!.kind;
    p.options[i] = null; p.picks--;
    if (kind === 'charm') this.charms.push({ id: o as string, state: charmById(o as string)!.start ?? 0 });
    else if (kind === 'almanac') this.levels[o as HandId]++;
    else if (kind === 'card') this.deck.push({ ...(o as Card), id: this.nextId++ });
    else this.applyTreat(o as string, ids);
    if (p.picks <= 0 || p.options.every((x) => x === null)) this.closePack();
    return true;
  }
  /** Leave what is left in the pack. */
  skipPack() { if (this.phase !== 'pack') return false; this.closePack(); return true; }
  private closePack() { this.pack = null; this.phase = 'shop'; }
  /** Charms on the shelf or in an open charm pack, which a Wishing stone must not hand out as well. */
  private onOffer(): string[] {
    const pack = this.pack && packById(this.pack.id)!.kind === 'charm' ? this.pack.options : [];
    return [...(this.shop?.charms ?? []), ...pack].filter((x): x is string => typeof x === 'string');
  }

  // Items
  /** Why a treat cannot be used on these cards, chosen from `pool`, or null if it can. */
  private treatWhyNot(id: string, ids: number[], pool: number[], where: string): string | null {
    const t = treatById(id)!;
    if (t.picks === 0) return t.id === 'wish' && this.charms.length >= this.charmSlots ? 'Your charm slots are full.' : null;
    if (!ids.length) return `Select ${t.picks === 1 ? 'a card' : `up to ${t.picks} cards`} first.`;
    if (ids.length > t.picks) return `Select at most ${t.picks}.`;
    if (ids.some((x) => !pool.includes(x))) return where;
    // A deck smaller than a hand could not deal the next round, and would not load.
    if (t.id === 'compost' && this.deck.length - ids.length < HAND_SIZE) return `Your deck can't go below ${HAND_SIZE} cards.`;
    return null;
  }
  /** Why an item cannot be used with these cards selected, or null if it can. */
  itemWhyNot(slot: number, ids: number[] = []): string | null {
    const it = this.items[slot];
    if (!it) return 'There is nothing in that slot.';
    if (it.kind === 'almanac') return null;
    if (treatById(it.id)!.picks > 0 && this.phase !== 'round') return 'Use it during a round, with cards selected.';
    return this.treatWhyNot(it.id, ids, this.round?.hand ?? [], 'Select cards in your hand.');
  }
  useItem(slot: number, ids: number[] = []) {
    if (this.itemWhyNot(slot, ids)) return false;
    const it = this.items[slot];
    this.items.splice(slot, 1);
    if (it.kind === 'almanac') { this.levels[it.id as HandId]++; return true; }
    this.applyTreat(it.id, ids);
    return true;
  }
  /** What a treat does to the cards chosen for it: in a round they are in the hand, in a treat pack among the dealt cards. */
  private applyTreat(id: string, ids: number[]) {
    const cards = ids.map((x) => this.card(x)), r = this.round, p = this.pack;
    const gloss = (g: Gloss) => cards.forEach((c) => { c.gloss = g; });
    switch (id) {
      case 'honey': gloss('honey'); break;
      case 'spice': gloss('ember'); break;
      case 'dew': gloss('crystal'); break;
      case 'leaf': gloss('gold'); break;
      case 'dye0': case 'dye1': case 'dye2': case 'dye3': cards.forEach((c) => { c.suit = Number(id[3]) as Suit; }); break;
      case 'sprout': cards.forEach((c) => { c.rank = Math.min(14, c.rank + 1); }); break;
      case 'mirror': { const copy: Card = { ...cards[0], id: this.nextId++ }; this.deck.push(copy); if (r) r.hand.push(copy.id); else if (p) p.dealt.push(copy.id); break; }
      case 'compost':
        this.deck = this.deck.filter((c) => !ids.includes(c.id));
        if (r) { r.hand = r.hand.filter((x) => !ids.includes(x)); this.fill(this.handSize); }
        if (p) p.dealt = p.dealt.filter((x) => !ids.includes(x));
        break;
      case 'tea': this.nuts += Math.min(this.nuts, 20); break;
      case 'wish': { const w = this.rollCharm(this.onOffer()); if (w) this.charms.push({ id: w, state: charmById(w)!.start ?? 0 }); break; }
    }
  }

  // Saving
  save(): Save {
    const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
    return {
      v: SAVE_VERSION, seed: this.seed, stake: this.stake, rand: this.rand.s, ante: this.ante, blind: this.blind, phase: this.phase, endless: this.endless, nuts: this.nuts,
      nextId: this.nextId, deck: copy(this.deck), levels: { ...this.levels }, played: { ...this.played }, charms: copy(this.charms), items: copy(this.items),
      bosses: [...this.bosses], round: copy(this.round), cash: copy(this.cash), shop: copy(this.shop), pack: copy(this.pack), vouchers: [...this.vouchers], offer: this.offer, best: this.best, rounds: this.rounds,
    };
  }
  /** Rebuild a run from a save, or null if anything about it is off. */
  static load(p: unknown): Run | null {
    const s = p as Save, big = Number.MAX_SAFE_INTEGER;
    const int = (x: unknown, lo: number, hi: number) => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
    const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
    const ids = (a: unknown, ok: (x: number) => boolean) => Array.isArray(a) && a.every((x) => Number.isInteger(x) && ok(x)) && new Set(a).size === a.length;
    try {
      if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION || !int(s.seed, 0, 0xffffffff) || !int(s.rand, 0, 0xffffffff)) return null;
      if (!int(s.ante, 1, 999) || !int(s.blind, 0, 2) || !['pick', 'round', 'cashout', 'shop', 'pack', 'over', 'victory'].includes(s.phase) || typeof s.endless !== 'boolean') return null;
      if (s.stake !== undefined && !int(s.stake, 0, STAKES.length - 1)) return null;
      if (!int(s.nuts, 0, big) || !int(s.nextId, 0, big) || !int(s.best, 0, big) || !int(s.rounds, 0, big)) return null;
      if (!Array.isArray(s.deck) || s.deck.length < 1 || s.deck.length > 500) return null;
      const okCard = (c: Card) => !!c && int(c.rank, 2, 14) && int(c.suit, 0, 3) && GLOSSES.includes(c.gloss);
      for (const c of s.deck) if (!okCard(c) || !int(c.id, 0, s.nextId - 1)) return null;
      if (new Set(s.deck.map((c) => c.id)).size !== s.deck.length) return null;
      const inDeck = (id: number) => s.deck.some((c) => c.id === id);
      for (const t of [s.levels, s.played]) if (!t || HANDS.some((h) => !int(t[h.id], 0, big))) return null;
      if (HANDS.some((h) => s.levels[h.id] < 1)) return null;
      if (!Array.isArray(s.vouchers) || !s.vouchers.every((v) => typeof v === 'string' && !!voucherById(v)) || new Set(s.vouchers).size !== s.vouchers.length) return null;
      if (s.offer !== null && (typeof s.offer !== 'string' || !voucherById(s.offer) || s.vouchers.includes(s.offer))) return null;
      const plus = (n: number, v: string) => n + (s.vouchers.includes(v) ? 1 : 0);
      if (!Array.isArray(s.charms) || s.charms.length > plus(CHARM_SLOTS, 'shelf') || s.charms.some((c) => !c || !charmById(c.id) || !num(c.state))) return null;
      if (new Set(s.charms.map((c) => c.id)).size !== s.charms.length) return null;
      const okItem = (it: Item | null) => !!it && ((it.kind === 'almanac' && HANDS.some((h) => h.id === it.id)) || (it.kind === 'treat' && !!treatById(it.id)));
      if (!Array.isArray(s.items) || s.items.length > plus(ITEM_SLOTS, 'pockets') || !s.items.every(okItem)) return null;
      if (!Array.isArray(s.bosses) || s.bosses.length < 1 || !s.bosses.every((b) => BOSSES.some((x) => x.rule === b))) return null;
      const r = s.round;
      if ((s.phase === 'round' || s.phase === 'cashout' || s.phase === 'over') !== !!r) return null;
      if (r) {
        if (!int(r.target, 1, big) || !int(r.score, 0, big) || !int(r.plays, 0, 99) || !int(r.discards, 0, 99) || !int(r.played, 0, 999) || typeof r.firstPlay !== 'boolean') return null;
        if (!ids(r.draw, inDeck) || !ids(r.hand, inDeck) || !ids(r.facedown, (id) => r.hand.includes(id)) || !ids(r.lastIds, () => true) || r.hand.some((id) => r.draw.includes(id))) return null;
        if (r.last !== null && (typeof r.last !== 'object' || !num(r.last.total))) return null;
      }
      if ((s.phase === 'cashout') !== !!s.cash) return null;
      if (s.cash && !['blind', 'plays', 'interest', 'charms', 'gold', 'total'].every((k) => int((s.cash as Record<string, unknown>)[k], 0, big))) return null;
      if ((s.phase === 'shop' || s.phase === 'pack') !== !!s.shop) return null;
      if (s.shop && (!Array.isArray(s.shop.charms) || !Array.isArray(s.shop.items) || !int(s.shop.rerolls, 0, big) || !Array.isArray(s.shop.packs) || s.shop.packs.length > SHOP_PACKS || !s.shop.packs.every((id) => id === null || (typeof id === 'string' && !!packById(id))) || s.shop.charms.length > plus(SHOP_CHARMS, 'stall') || s.shop.items.length > SHOP_ITEMS
        || !s.shop.charms.every((id) => id === null || !!charmById(id)) || !s.shop.items.every((it) => it === null || okItem(it)))) return null;
      if ((s.phase === 'pack') !== !!s.pack) return null;
      if (s.pack) {
        const p = s.pack, t = typeof p.id === 'string' ? packById(p.id) : undefined;
        if (!t || !Array.isArray(p.options) || p.options.length < 1 || p.options.length > t.shown + 1 || !int(p.picks, 1, t.picks) || !ids(p.dealt, inDeck)) return null;
        if (t.kind !== 'treat' && p.dealt.length) return null;
        const okOption = (o: unknown) => o === null || (t.kind === 'charm' ? typeof o === 'string' && !!charmById(o)
          : t.kind === 'almanac' ? HANDS.some((h) => h.id === o) : t.kind === 'treat' ? typeof o === 'string' && !!treatById(o)
          : okCard(o as Card) && (o as Card).id === -1);
        if (!p.options.every(okOption)) return null;
      }
      const g = new Run(s.seed, s.stake ?? 0);
      Object.assign(g, {
        ante: s.ante, blind: s.blind, phase: s.phase, endless: s.endless, nuts: s.nuts, nextId: s.nextId, deck: JSON.parse(JSON.stringify(s.deck)),
        levels: { ...s.levels }, played: { ...s.played }, charms: JSON.parse(JSON.stringify(s.charms)), items: JSON.parse(JSON.stringify(s.items)),
        bosses: [...s.bosses], round: JSON.parse(JSON.stringify(r)), cash: s.cash ? { ...s.cash } : null, shop: JSON.parse(JSON.stringify(s.shop)), pack: JSON.parse(JSON.stringify(s.pack)), vouchers: [...s.vouchers], offer: s.offer, best: s.best, rounds: s.rounds,
      });
      g.rand.s = s.rand;
      g.bossFor(g.ante);
      // Older saves may have two identical shelf items. Keep the first and repair only the duplicate.
      const seen: Item[] = [];
      if (g.shop) g.shop.items = g.shop.items.map((it) => {
        if (!it) return null;
        const next = seen.some((x) => x.kind === it.kind && x.id === it.id) ? g.rollItem(seen) : it;
        seen.push(next); return next;
      });
      return g;
    } catch { return null; }
  }
}

// ── The player's record across runs ───────────────────────────────────────────

/** `stake` is the highest stake open to the player; records from before stakes have none, which opens green only. */
export type Profile = { v: number; runs: number; wins: number; bestAnte: number; bestHand: number; seen: string[]; stake: number };
export const freshProfile = (): Profile => ({ v: PROFILE_VERSION, runs: 0, wins: 0, bestAnte: 0, bestHand: 0, seen: [], stake: 0 });
export function loadProfile(p: unknown): Profile {
  const s = p as Profile, ok = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
  if (!s || typeof s !== 'object' || s.v !== PROFILE_VERSION || !ok(s.runs) || !ok(s.wins) || !ok(s.bestAnte) || !ok(s.bestHand) || !Array.isArray(s.seen)) return freshProfile();
  return { ...s, seen: s.seen.filter((id) => typeof id === 'string' && !!charmById(id)), stake: Number.isInteger(s.stake) && s.stake >= 0 && s.stake < STAKES.length ? s.stake : 0 };
}
/** Fold a run into the record: called whenever it changes, so it is never more than a moment behind. */
export function record(p: Profile, run: Run, finished: boolean): Profile {
  const seen = new Set(p.seen);
  for (const c of run.charms) seen.add(c.id);
  run.shop?.charms.forEach((id) => { if (id) seen.add(id); });
  if (run.pack && packById(run.pack.id)?.kind === 'charm') run.pack.options.forEach((id) => { if (typeof id === 'string') seen.add(id); });
  return {
    ...p, stake: run.phase === 'victory' ? Math.max(p.stake, Math.min(STAKES.length - 1, run.stake + 1)) : p.stake, bestAnte: Math.max(p.bestAnte, run.phase === 'victory' ? ANTES : run.ante),
    bestHand: Math.max(p.bestHand, run.best), seen: [...seen], runs: p.runs + (finished ? 1 : 0), wins: p.wins + (finished && run.phase === 'victory' ? 1 : 0),
  };
}

// Summit Shuffle: a deck-building climb in the style of Slay the Spire. Dora or Enzo starts with ten plain cards and
// climbs three stretches of mountain, six stops and a guardian each, picking a route through fights, alphas, rest
// burrows, treat stalls and chance meetings, and adding a card after every fight.
//
// The engine is deterministic and has no DOM: every shuffle, predator roll and reward comes from three seeded
// streams held in the run itself, so a seed replays a climb exactly and a saved run carries on as if it never stopped.
// A whole card or a whole predator turn is resolved at once; `events` lists what happened, in order, for the scene
// to play back. Cards, trinkets and statuses are data in summit-shuffle-cards.ts, predators in summit-shuffle-foes.ts.
import { CARDS, POOL, STARTER_DECK, STATUS, TRINKETS, TRINKET_IDS, TIMED, costOf, valsOf, canUpgrade, describe, nameOf, type Card, type Ops, type StatusId, type Statuses } from './summit-shuffle-cards.js';
import { FOES, ACTS, type Move } from './summit-shuffle-foes.js';
export * from './summit-shuffle-cards.js';
export * from './summit-shuffle-foes.js';

export const ENERGY = 3, HAND = 5, MAX_HAND = 10, ROWS = 6, LANES = 4, MAX_FOES = 4, STOPS = ACTS.length * (ROWS + 1), SAVE_V = 1;
export const NAP = 0.3, THIN_NAP = 0.25, REMOVE_PRICE = 75, REMOVE_STEP = 25;

export type HeroId = 'dora' | 'enzo';
export const HEROES: Record<HeroId, { name: string; hp: number; trinket: string; blurb: string }> = {
  dora: { name: 'Dora', hp: 80, trinket: 'bell', blurb: 'Quick off the mark: her Ruby Bell gives her two more cards and one more energy to open every fight with.' },
  enzo: { name: 'Enzo', hp: 80, trinket: 'scarf', blurb: 'Hard to wear down: his Grey Scarf mends 5 health after every fight.' },
};
export const HERO_IDS: HeroId[] = ['dora', 'enzo'];

/** Harder climbs. Each altitude keeps every rule of the ones below it. */
export const ALTITUDES = [
  { name: 'Base Camp', text: 'The mountain as it is.' },
  { name: 'Altitude 1', text: 'Predators have 6% more health.' },
  { name: 'Altitude 2', text: 'Predators hit 15% harder.' },
  { name: 'Altitude 3', text: 'Thin air: naps heal 25% of your health, not 30%, and beating a guardian mends only 70% of what you have lost.' },
  { name: 'Altitude 4', text: 'You set out with a Fright in your deck.' },
  { name: 'Altitude 5', text: 'Guardians have 12% more health, and you set out with 5 less.' },
];

export type NodeType = 'fight' | 'alpha' | 'rest' | 'stall' | 'event' | 'stash' | 'boss';
export const NODE_NAMES: Record<NodeType, string> = { fight: 'Predators', alpha: 'Alpha predator', rest: 'Rest burrow', stall: 'Treat stall', event: 'Something on the trail', stash: 'Hidden stash', boss: 'Guardian' };
export type MapNode = { id: number; row: number; lane: number; type: NodeType; next: number[] };
export type Phase = 'map' | 'fight' | 'reward' | 'rest' | 'stall' | 'event' | 'won' | 'lost';

export type Foe = { uid: number; kind: string; name: string; hp: number; maxHp: number; fluff: number; st: Statuses; move: string; last: string[]; turns: number; mem: Record<string, number>; alive: boolean; fled: boolean; stolen: number };
export type Fight = {
  kind: 'fight' | 'alpha' | 'boss'; turn: number; energy: number;
  hand: Card[]; draw: Card[]; discard: Card[]; gone: Card[];
  /** The chinchilla's Fluff and statuses. */
  fluff: number; st: Statuses; foes: Foe[];
  /** Cards played this turn, and whether an attack card has been played this fight. */
  played: number; attacked: boolean; won: boolean;
};
export type Reward = { seeds: number; trinket: string | null; cards: Card[]; picked: boolean; relics: string[]; relicPicked: boolean; note: string };
export type Stall = { cards: { card: Card; price: number; sold: boolean }[]; trinkets: { id: string; price: number; sold: boolean }[]; removed: boolean };
export type Stats = { stops: number; fights: number; foes: number; turns: number; dealt: number; taken: number; cards: number; earned: number };
/** -1 is the chinchilla; 0 and up is a foe's place in the line; -2 is nobody (burrs, thorns). */
export type Ev =
  | { t: 'fight' } | { t: 'turn'; n: number } | { t: 'foes' }
  | { t: 'card'; id: string; up: boolean; target: number }
  | { t: 'hit'; to: number; from: number; dmg: number; blocked: number; hp: number; fluff: number }
  | { t: 'fluff'; who: number; n: number; fluff: number }
  | { t: 'st'; who: number; id: StatusId; n: number }
  | { t: 'heal'; n: number; hp: number }
  | { t: 'move'; who: number; name: string; attack: boolean }
  | { t: 'out'; who: number; fled: boolean }
  | { t: 'join'; who: number }
  | { t: 'add'; id: string; n: number }
  | { t: 'seeds'; n: number }
  | { t: 'slip' } | { t: 'shuffle' } | { t: 'won' } | { t: 'lost' };
export type Intent = { name: string; kind: 'attack' | 'block' | 'buff' | 'hex' | 'sleep' | 'flee' | 'call' | 'idle'; dmg: number; hits: number; text: string };

type Stream = 'map' | 'loot' | 'fight';
const WEIGHTS: [NodeType, number][][] = [
  [['fight', 1]],
  [['fight', 50], ['event', 50]],
  [['fight', 30], ['event', 20], ['alpha', 20], ['stall', 15], ['stash', 15]],
  [['fight', 30], ['event', 20], ['alpha', 20], ['rest', 15], ['stall', 15]],
  [['fight', 30], ['alpha', 25], ['event', 20], ['stall', 15], ['stash', 10]],
  [['rest', 1]],
];
const SPECIAL: NodeType[] = ['alpha', 'stall', 'rest', 'stash'];
const PRICE = { common: 50, uncommon: 80, rare: 150, trinket: 150 } as const;
const BAD_DRAWS = ['daze', 'thorn', 'mud'];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------- Chance meetings ----------
/** A card the player must point at for an option: one to take out, one to upgrade, or one to copy. */
export type CardPick = 'remove' | 'upgrade' | 'copy';
type EventOption = { label: string; detail: string; pick?: CardPick; can?: (r: Run) => boolean; act: (r: Run, card: Card | null) => string };
type EventDef = { id: string; name: string; text: string; options: EventOption[] };
const EVENTS: EventDef[] = [
  { id: 'apple', name: 'A Fallen Apple Tree', text: 'An old apple tree has come down across the trail, twigs and all.', options: [
    { label: 'Eat your fill', detail: 'Heal 18 health.', act: (r) => `Sweet and a little bruised. You mend ${r.mend(18)} health.` },
    { label: 'Gather twigs to chew', detail: 'Upgrade a card of your choice.', pick: 'upgrade', can: (r) => r.upgradable().length > 0, act: (r, c) => { r.upgrade(c!.uid); return `Sharper teeth: ${nameOf(c!)} is upgraded.`; } },
  ] },
  { id: 'hollow', name: 'A Dust Hollow', text: 'Fine grey dust, deep enough to roll in. Whatever you leave in it stays there.', options: [
    { label: 'Roll in the dust', detail: 'Take a card of your choice out of your deck for good.', pick: 'remove', can: (r) => r.deck.length > 1, act: (r, c) => { r.remove(c!.uid); return `${nameOf(c!)} is left behind in the dust.`; } },
    { label: 'Rest beside it', detail: 'Heal 10 health.', act: (r) => `A quiet sit. You mend ${r.mend(10)} health.` },
  ] },
  { id: 'trader', name: 'The Vizcacha Trader', text: 'An old vizcacha has spread a blanket of odds and ends beside the trail.', options: [
    { label: 'Trade a tuft of fur', detail: 'Lose 8 health. Gain a trinket.', can: (r) => r.hp > 8, act: (r) => { r.hp -= 8; const t = r.findTrinket(); return t ? `It stings, but you leave with the ${TRINKETS[t].name}.` : 'The blanket is bare, so the trader gives you 50 seeds for your trouble.'; } },
    { label: 'Pay 60 seeds', detail: 'Gain a rare card.', can: (r) => r.seeds >= 60, act: (r) => { r.seeds -= 60; const c = r.addCard(r.randomCard('rare')); return `The trader digs out something special: ${nameOf(c)}.`; } },
    { label: 'Walk on', detail: 'Nothing happens.', act: () => 'You nod and carry on up the trail.' },
  ] },
  { id: 'ledge', name: 'Something Shiny', text: 'A glint on a narrow ledge, out over the drop.', options: [
    { label: 'Climb out for it', detail: 'Probably a trinket. Perhaps a fall that costs 10 health.', act: (r) => {
      if (r.chance(0.6)) { const t = r.findTrinket(); return t ? `Got it: the ${TRINKETS[t].name}.` : 'Only 50 seeds, but they are yours.'; }
      r.hp = Math.max(1, r.hp - 10); return 'The ledge crumbles. You scrabble back up, bruised and empty-pawed.';
    } },
    { label: 'Leave it', detail: 'Nothing happens.', act: () => 'Not worth the drop. You carry on.' },
  ] },
  { id: 'fox', name: 'A Sleeping Fox', text: 'It is curled around a heap of seeds, snoring.', options: [
    { label: 'Steal the heap', detail: 'Gain 80 seeds. A Fright is added to your deck.', act: (r) => { r.seeds += 80; r.addCard('fright'); return 'One eye opens as you leave. You run, with 80 seeds and a Fright you will not shake off soon.'; } },
    { label: 'Creep past', detail: 'Gain 15 seeds it has dropped on the trail.', act: (r) => { r.seeds += 15; return 'You pick up 15 loose seeds on tiptoe and keep going.'; } },
  ] },
  { id: 'spring', name: 'A Hot Spring', text: 'Steam rises off a pool in the rocks.', options: [
    { label: 'Soak', detail: 'Raise your max health by 6.', act: (r) => { r.maxHp += 6; r.hp += 6; return 'You come out fluffier than you went in: 6 more max health.'; } },
    { label: 'Drink', detail: 'Heal a quarter of your max health.', act: (r) => `Warm all the way down. You mend ${r.mend(Math.floor(r.maxHp / 4))} health.` },
  ] },
  { id: 'elder', name: 'The Old Chinchilla', text: 'Grey-whiskered and in no hurry, she has climbed this mountain more times than she can count.', options: [
    { label: 'Learn a trick', detail: 'Gain an upgraded uncommon card.', act: (r) => { const c = r.addCard(r.randomCard('uncommon'), true); return `She shows you ${nameOf(c)}.`; } },
    { label: 'Practise a favourite', detail: 'Copy a card of your choice.', pick: 'copy', act: (r, c) => { r.addCard(c!.id, c!.up); return `Twice over: a second ${nameOf(c!)} joins your deck.`; } },
  ] },
  { id: 'rockslide', name: 'A Rockslide', text: 'The trail is buried under fallen stone.', options: [
    { label: 'Dig straight through', detail: 'Lose 7 health. Find 45 seeds.', can: (r) => r.hp > 7, act: (r) => { r.hp -= 7; r.seeds += 45; return 'Scraped paws, and 45 seeds somebody lost under the stones.'; } },
    { label: 'Shift one big rock', detail: 'Lose 3 health. A card in your deck is upgraded.', can: (r) => r.hp > 3 && r.upgradable().length > 0, act: (r) => { r.hp -= 3; const c = r.upgradeRandom(); return c ? `Hard work makes you sharper: ${nameOf(c)} is upgraded.` : 'Hard work, and nothing to show for it.'; } },
    { label: 'Go round', detail: 'Nothing happens.', act: () => 'The long way round, and no harm done.' },
  ] },
];
export const EVENT_IDS = EVENTS.map((e) => e.id);

export class Run {
  v = SAVE_V;
  seed = 1; hero: HeroId = 'dora'; level = 0;
  hp = 0; maxHp = 0; seeds = 0;
  deck: Card[] = []; trinkets: string[] = [];
  act = 0; maps: MapNode[][] = []; at = -1;
  /** The stops walked on this stretch so far, in order. */
  walked: number[] = [];
  phase: Phase = 'map';
  /** The fight on this stop. It stays, finished, until the stop is left, so its last moments can still be drawn. */
  fight: Fight | null = null; reward: Reward | null = null; stall: Stall | null = null;
  event: { id: string; done: string } | null = null;
  rng: Record<Stream, number> = { map: 1, loot: 1, fight: 1 };
  stats: Stats = { stops: 0, fights: 0, foes: 0, turns: 0, dealt: 0, taken: 0, cards: 0, earned: 0 };
  /** Every card and trinket this climb has shown, for the page's collection book. */
  found: { cards: string[]; trinkets: string[] } = { cards: [], trinkets: [] };
  removals = 0; pity = 0; nextUid = 1;
  private lastFight = ''; private actFights = 0; private seenEvents: string[] = [];
  /** The run as it was just before the fight in progress, so a saved run walks back into the same fight. */
  private entry: string | null = null;
  /** What has happened since the page last looked. Not saved. */
  events: Ev[] = [];
  /** Set on the bots' clones, which have nobody to show events to. */
  quiet = false;
  /** True while the first attack card of a fight is being resolved, for the Chew Stick. */
  private chewing = false;

  static start(o: { seed: number; hero: HeroId; level?: number }): Run {
    const r = new Run();
    r.seed = o.seed; r.hero = o.hero; r.level = Math.max(0, Math.min(ALTITUDES.length - 1, o.level ?? 0));
    r.rng = { map: (o.seed * 2654435761) >>> 0 || 1, loot: (o.seed * 40503 + 977) >>> 0 || 1, fight: (o.seed * 69069 + 12345) >>> 0 || 1 };
    r.maxHp = r.hp = HEROES[o.hero].hp - (r.level >= 5 ? 5 : 0);
    r.seeds = 60;
    for (const id of STARTER_DECK) r.addCard(id);
    if (r.level >= 4) r.addCard('fright');
    r.gainTrinket(HEROES[o.hero].trinket);
    for (let a = 0; a < ACTS.length; a++) r.maps.push(r.buildMap());
    return r;
  }

  // ---------- Saving ----------
  /** The run as text. In a fight this is the moment before it began, so loading it starts the same fight again. */
  save(): string { return this.phase === 'fight' && this.entry ? this.entry : this.snapshot(-1); }
  private snapshot(resume: number): string {
    const { events: _e, entry: _n, quiet: _q, chewing: _c, ...rest } = this as unknown as Record<string, unknown>;
    return JSON.stringify({ ...rest, resume });
  }
  /** A run from `save()`, or null if the text is not one this version understands. */
  static load(text: string): Run | null {
    try {
      const raw = JSON.parse(text);
      if (!raw || raw.v !== SAVE_V || !HEROES[raw.hero as HeroId] || !Array.isArray(raw.deck) || !Array.isArray(raw.maps)) return null;
      if (raw.deck.some((c: Card) => !CARDS[c.id]) || raw.trinkets.some((t: string) => !TRINKETS[t])) return null;
      const { resume, ...data } = raw;
      const r = Object.assign(new Run(), data) as Run;
      if (typeof resume === 'number' && resume >= 0 && r.go(resume)) return null;
      return r;
    } catch { return null; }
  }
  /** A copy to try things on, as far as the end of the fight and its reward. Only the maps are shared: nothing changes them after the start. */
  clone(): Run {
    const r = Object.assign(new Run(), this) as Run, f = this.fight;
    r.events = []; r.quiet = true; r.rng = { ...this.rng }; r.stats = { ...this.stats };
    r.deck = this.deck.map((c) => ({ ...c })); r.trinkets = this.trinkets.slice(); r.found = { cards: this.found.cards.slice(), trinkets: this.found.trinkets.slice() };
    if (f) r.fight = { ...f, hand: f.hand.slice(), draw: f.draw.slice(), discard: f.discard.slice(), gone: f.gone.slice(), st: { ...f.st }, foes: f.foes.map((x) => ({ ...x, st: { ...x.st }, mem: { ...x.mem }, last: x.last.slice() })) };
    return r;
  }

  // ---------- Chance ----------
  private rand(k: Stream): number {
    let t = (this.rng[k] = (this.rng[k] + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private int(k: Stream, n: number) { return Math.floor(this.rand(k) * n); }
  private one<T>(k: Stream, list: T[]): T { return list[this.int(k, list.length)]; }
  /** True that share of the time, from the loot stream. */
  chance(p: number) { return this.rand('loot') < p; }
  private weighted<T>(k: Stream, table: [T, number][]): T {
    let r = this.rand(k) * table.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of table) { r -= w; if (r < 0) return v; }
    return table[table.length - 1][0];
  }
  private ev(e: Ev) { if (!this.quiet) this.events.push(e); }
  has(id: string) { return this.trinkets.includes(id); }

  // ---------- The trail ----------
  /**
   * One stretch of mountain: four trails walked up six rows of four lanes, never crossing, sharing a stop wherever
   * they meet, and all ending at the guardian. Tried again until the stretch has an alpha, a stall and a chance meeting.
   */
  private buildMap(): MapNode[] {
    for (let attempt = 0; ; attempt++) {
      const grid: (MapNode | null)[][] = Array.from({ length: ROWS }, () => Array<MapNode | null>(LANES).fill(null));
      const links = new Set<string>();
      let firstStart = -1;
      for (let p = 0; p < 4; p++) {
        let lane = this.int('map', LANES);
        if (p === 0) firstStart = lane; else if (p === 1 && lane === firstStart) lane = (lane + 1 + this.int('map', LANES - 1)) % LANES;
        for (let row = 0; row < ROWS; row++) {
          grid[row][lane] ??= { id: 0, row, lane, type: 'fight', next: [] };
          if (row === ROWS - 1) break;
          let step = this.int('map', 3) - 1;
          if (lane + step < 0 || lane + step >= LANES) step = 0;
          // Two trails may not cross between the same pair of rows.
          if (step && links.has(`${row}:${lane + step}>${lane}`)) step = 0;
          links.add(`${row}:${lane}>${lane + step}`);
          lane += step;
        }
      }
      const nodes = grid.flat().filter((n): n is MapNode => !!n);
      nodes.forEach((n, i) => { n.id = i; });
      for (const key of links) { const [row, a, b] = key.split(/[:>]/).map(Number); const from = grid[row][a]!, to = grid[row + 1][b]!; if (!from.next.includes(to.id)) from.next.push(to.id); }
      for (const n of nodes) n.next.sort((a, b) => nodes[a].lane - nodes[b].lane);
      const boss: MapNode = { id: nodes.length, row: ROWS, lane: (LANES - 1) / 2, type: 'boss', next: [] };
      for (const n of nodes) if (n.row === ROWS - 1) n.next.push(boss.id);
      for (const n of nodes) {
        const parents = nodes.filter((p) => p.next.includes(n.id)).map((p) => p.type);
        let type: NodeType = 'fight';
        for (let tries = 0; tries < 8; tries++) { type = this.weighted('map', WEIGHTS[n.row]); if (!(SPECIAL.includes(type) && parents.includes(type)) || n.row === ROWS - 1) break; type = 'fight'; }
        n.type = type;
      }
      const count = (t: NodeType) => nodes.filter((n) => n.type === t).length;
      if (attempt > 60 || (nodes.length >= 12 && count('alpha') >= 1 && count('stall') >= 1 && count('event') >= 1)) return [...nodes, boss];
    }
  }
  get map(): MapNode[] { return this.maps[this.act]; }
  get node(): MapNode | null { return this.at < 0 ? null : this.map[this.at]; }
  /** The stops that can be walked to from here. */
  paths(): number[] { return this.phase !== 'map' ? [] : this.at < 0 ? this.map.filter((n) => n.row === 0).map((n) => n.id) : this.map[this.at].next; }
  /** Walks to a stop and starts whatever is there. Returns why not, or ''. */
  go(id: number): string {
    if (this.phase !== 'map') return 'You are busy here.';
    if (!this.paths().includes(id)) return 'The trail does not go there from here.';
    const n = this.map[id];
    if (n.type === 'fight' || n.type === 'alpha' || n.type === 'boss') this.entry = this.snapshot(id);
    this.at = id; this.walked.push(id); this.stats.stops++;
    if (n.type === 'fight' || n.type === 'alpha' || n.type === 'boss') this.startFight(n.type, this.encounter(n.type));
    else if (n.type === 'rest') this.phase = 'rest';
    else if (n.type === 'stall') { this.stall = this.stock(); this.phase = 'stall'; }
    else if (n.type === 'stash') {
      const t = this.findTrinket();
      this.reward = { seeds: 0, trinket: t, cards: [], picked: true, relics: [], relicPicked: true, note: t ? 'Somebody hid this under a flat stone.' : 'Somebody hid 50 seeds under a flat stone.' };
      this.phase = 'reward';
    } else {
      const fresh = EVENTS.filter((e) => !this.seenEvents.includes(e.id)), e = this.one('loot', fresh.length ? fresh : EVENTS);
      this.seenEvents.push(e.id); this.event = { id: e.id, done: '' }; this.phase = 'event';
    }
    return '';
  }
  private encounter(type: 'fight' | 'alpha' | 'boss'): string[] {
    const a = ACTS[this.act];
    if (type === 'boss') return a.boss;
    const pool = (type === 'alpha' ? a.alphas : this.actFights < 1 ? a.easy : a.hard).filter((e) => e.join() !== this.lastFight);
    const pick = this.one('loot', pool);
    if (type === 'fight') { this.actFights++; this.lastFight = pick.join(); }
    return pick;
  }
  /** Leaves a finished stop: back to the trail, on to the next stretch, or the summit. */
  leave(): string {
    if (this.phase === 'reward') { const w = this.reward!; if (w.relics.length && !w.relicPicked) return 'Choose a trinket first.'; }
    else if (this.phase === 'event') { if (!this.event!.done) return 'Choose what to do first.'; }
    else if (this.phase !== 'rest' && this.phase !== 'stall') return 'There is nothing to leave.';
    if (this.phase === 'rest') return 'Nap or groom first.';
    this.reward = null; this.stall = null; this.event = null; this.fight = null;
    if (this.node?.type === 'boss') {
      // A guardian's stretch is done: mend, and start at the foot of the next one.
      const lost = this.maxHp - this.hp;
      this.hp += this.level >= 3 ? Math.floor(lost * 0.7) : lost;
      this.act++; this.at = -1; this.walked = []; this.actFights = 0; this.lastFight = '';
    }
    this.phase = 'map';
    return '';
  }

  // ---------- The deck ----------
  addCard(id: string, up = false): Card { const c: Card = { id, up: up && canUpgrade({ id, up: false }), uid: this.nextUid++ }; this.deck.push(c); this.note(id); return c; }
  private note(id: string) { if (!this.found.cards.includes(id)) this.found.cards.push(id); }
  upgradable(): Card[] { return this.deck.filter(canUpgrade); }
  upgrade(uid: number): boolean { const c = this.deck.find((x) => x.uid === uid); if (!c || !canUpgrade(c)) return false; c.up = true; return true; }
  upgradeRandom(): Card | null { const list = this.upgradable(); if (!list.length) return null; const c = this.one('loot', list); c.up = true; return c; }
  remove(uid: number): boolean { const i = this.deck.findIndex((x) => x.uid === uid); if (i < 0 || this.deck.length <= 1) return false; this.deck.splice(i, 1); return true; }
  /** Heals up to `n` and returns how much was mended. */
  mend(n: number): number { const got = Math.max(0, Math.min(this.maxHp - this.hp, n)); this.hp += got; return got; }
  randomCard(rarity: 'common' | 'uncommon' | 'rare', not: string[] = []): string { return this.one('loot', POOL.filter((id) => CARDS[id].rarity === rarity && !not.includes(id))); }
  /** A trinket nobody has yet, added to the bag, or null (and 50 seeds) once they have all been found. */
  findTrinket(): string | null {
    const left = TRINKET_IDS.filter((t) => TRINKETS[t].tier === 'common' && !this.has(t));
    if (!left.length) { this.seeds += 50; return null; }
    const t = this.one('loot', left); this.gainTrinket(t); return t;
  }
  gainTrinket(id: string) {
    if (this.has(id)) return;
    this.trinkets.push(id);
    if (!this.found.trinkets.includes(id)) this.found.trinkets.push(id);
    if (id === 'wolfberry') { this.maxHp += 10; this.hp += 10; }
    if (id === 'summittea') { this.maxHp += 12; this.hp = this.maxHp; }
    if (id === 'chewtoy') { this.upgradeRandom(); this.upgradeRandom(); }
  }

  // ---------- Rest burrows ----------
  get napHeal() { return Math.floor(this.maxHp * (this.level >= 3 ? THIN_NAP : NAP)) + (this.has('rosehip') ? 15 : 0); }
  get canNap() { return !this.has('springwater'); }
  nap(): string { if (this.phase !== 'rest') return 'There is no burrow here.'; if (!this.canNap) return 'Spring Water keeps you wide awake.'; this.mend(this.napHeal); this.phase = 'map'; return ''; }
  groom(uid: number): string { if (this.phase !== 'rest') return 'There is no burrow here.'; if (!this.upgrade(uid)) return 'That card cannot be upgraded.'; this.phase = 'map'; return ''; }
  /** Moves on from a burrow without using it, for a chinchilla that can do neither. */
  skipRest(): string { if (this.phase !== 'rest') return 'There is no burrow here.'; this.phase = 'map'; return ''; }

  // ---------- Treat stalls ----------
  private price(base: number) { return Math.round(base * (0.9 + this.rand('loot') * 0.2) * (this.has('loyalty') ? 0.7 : 1)); }
  get removePrice() { return Math.round((REMOVE_PRICE + REMOVE_STEP * this.removals) * (this.has('loyalty') ? 0.7 : 1)); }
  private stock(): Stall {
    const ids: string[] = [], cards: Stall['cards'] = [];
    for (let i = 0; i < 5; i++) {
      const rarity = this.weighted('loot', [['common', 50], ['uncommon', 38], ['rare', 12]] as ['common' | 'uncommon' | 'rare', number][]), id = this.randomCard(rarity, ids);
      ids.push(id); this.note(id);
      cards.push({ card: { id, up: false, uid: this.nextUid++ }, price: this.price(PRICE[rarity]), sold: false });
    }
    // One card is always on offer at half price.
    const deal = cards[this.int('loot', cards.length)]; deal.price = Math.round(deal.price / 2);
    const left = TRINKET_IDS.filter((t) => TRINKETS[t].tier === 'common' && !this.has(t)), trinkets: Stall['trinkets'] = [];
    for (let i = 0; i < 2 && left.length; i++) { const id = left.splice(this.int('loot', left.length), 1)[0]; trinkets.push({ id, price: this.price(PRICE.trinket), sold: false }); if (!this.found.trinkets.includes(id)) this.found.trinkets.push(id); }
    return { cards, trinkets, removed: false };
  }
  buyCard(i: number): string {
    const s = this.stall?.cards[i];
    if (this.phase !== 'stall' || !s || s.sold) return 'That is not for sale.';
    if (this.seeds < s.price) return 'Not enough seeds.';
    this.seeds -= s.price; s.sold = true; this.deck.push(s.card); return '';
  }
  buyTrinket(i: number): string {
    const s = this.stall?.trinkets[i];
    if (this.phase !== 'stall' || !s || s.sold) return 'That is not for sale.';
    if (this.seeds < s.price) return 'Not enough seeds.';
    this.seeds -= s.price; s.sold = true; this.gainTrinket(s.id); return '';
  }
  buyRemoval(uid: number): string {
    if (this.phase !== 'stall' || !this.stall || this.stall.removed) return 'The stall has already taken a card today.';
    if (this.seeds < this.removePrice) return 'Not enough seeds.';
    const cost = this.removePrice;
    if (!this.remove(uid)) return 'That card cannot be taken out.';
    this.seeds -= cost; this.removals++; this.stall.removed = true; return '';
  }

  // ---------- Chance meetings ----------
  /** The meeting on this stop, with which options are open. */
  eventView() {
    const e = EVENTS.find((x) => x.id === this.event?.id);
    return e ? { name: e.name, text: e.text, done: this.event!.done, options: e.options.map((o) => ({ label: o.label, detail: o.detail, pick: o.pick ?? null, ok: o.can ? o.can(this) : true })) } : null;
  }
  /** The cards an option that needs one may be pointed at. */
  pickable(kind: CardPick): Card[] { return kind === 'upgrade' ? this.upgradable() : kind === 'remove' ? (this.deck.length > 1 ? this.deck.slice() : []) : this.deck.filter((c) => CARDS[c.id].type !== 'curse'); }
  choose(i: number, uid = -1): string {
    const e = EVENTS.find((x) => x.id === this.event?.id), o = e?.options[i];
    if (this.phase !== 'event' || !e || !o || this.event!.done) return 'There is nothing to choose.';
    if (o.can && !o.can(this)) return 'You cannot do that right now.';
    let card: Card | null = null;
    if (o.pick) { card = this.pickable(o.pick).find((c) => c.uid === uid) ?? null; if (!card) return 'Choose a card.'; }
    this.event!.done = o.act(this, card);
    return '';
  }

  // ---------- Rewards ----------
  /** Cards to choose from after a fight: mostly common, better after alphas, all rare after a guardian. */
  private offer(kind: Fight['kind']): Card[] {
    const n = 3 + (this.has('clover') ? 1 : 0), ids: string[] = [], out: Card[] = [];
    for (let i = 0; i < n; i++) {
      const roll = this.rand('loot'), rareAt = (kind === 'alpha' ? 0.12 : 0.04) + this.pity, uncommonAt = rareAt + (kind === 'alpha' ? 0.42 : 0.36);
      const rarity = kind === 'boss' || roll < rareAt ? 'rare' : roll < uncommonAt ? 'uncommon' : 'common';
      if (rarity === 'rare') this.pity = 0; else if (rarity === 'common') this.pity = Math.min(0.3, this.pity + 0.015);
      const id = this.randomCard(rarity, ids);
      ids.push(id); this.note(id);
      out.push({ id, up: rarity !== 'rare' && this.chance(this.act * 0.15), uid: this.nextUid++ });
    }
    return out;
  }
  takeCard(i: number): string {
    const w = this.reward;
    if (this.phase !== 'reward' || !w || w.picked || !w.cards[i]) return 'There is no card to take.';
    this.deck.push(w.cards[i]); w.picked = true; return '';
  }
  skipCards(): string { const w = this.reward; if (this.phase !== 'reward' || !w || w.picked) return 'There is no card to skip.'; w.picked = true; return ''; }
  takeRelic(i: number): string {
    const w = this.reward;
    if (this.phase !== 'reward' || !w || w.relicPicked || !w.relics[i]) return 'There is no trinket to take.';
    this.gainTrinket(w.relics[i]); w.relicPicked = true; return '';
  }
  private winFight() {
    const f = this.fight!;
    this.stats.fights++;
    if (this.has('scarf')) this.mend(5);
    if (this.has('raisinstash') && this.hp * 2 <= this.maxHp) this.mend(10);
    this.ev({ t: 'won' });
    if (f.kind === 'boss' && this.act === ACTS.length - 1) { this.phase = 'won'; this.entry = null; return; }
    const everyoneFled = f.foes.every((x) => x.fled);
    let seeds = this.has('emptypouch') || everyoneFled ? 0 : (f.kind === 'boss' ? 60 : f.kind === 'alpha' ? 25 : 10) + this.int('loot', f.kind === 'boss' ? 20 : 10) + (this.has('pebble') ? 12 : 0);
    this.seeds += seeds; this.stats.earned += seeds;
    const trinket = f.kind === 'alpha' ? this.findTrinket() : null;
    if (f.kind === 'alpha' && !trinket) seeds += 50;
    let relics: string[] = [];
    if (f.kind === 'boss') { const pool = TRINKET_IDS.filter((t) => TRINKETS[t].tier === 'boss' && !this.has(t)); while (relics.length < 3 && pool.length) relics.push(pool.splice(this.int('loot', pool.length), 1)[0]); for (const t of relics) if (!this.found.trinkets.includes(t)) this.found.trinkets.push(t); }
    else relics = [];
    this.reward = { seeds, trinket, cards: this.offer(f.kind), picked: false, relics, relicPicked: !relics.length, note: everyoneFled ? 'It got away with what it took.' : '' };
    this.phase = 'reward'; this.entry = null;
  }

  // ---------- Fights ----------
  private makeFoe(kind: string, uid: number): Foe {
    const d = FOES[kind], boss = ACTS.some((a) => a.boss.includes(kind));
    const hp = Math.round((d.hp[0] + this.int('fight', d.hp[1] - d.hp[0] + 1)) * (this.level >= 1 ? 1.06 : 1) * (boss && this.level >= 5 ? 1.12 : 1));
    const st: Statuses = { ...d.start };
    if (this.has('claws')) st.zoomies = (st.zoomies ?? 0) + 1;
    if (this.has('dusthouse')) st.exposed = (st.exposed ?? 0) + 1;
    return { uid, kind, name: d.name, hp, maxHp: hp, fluff: d.startFluff ?? 0, st, move: '', last: [], turns: 0, mem: st.doze ? { asleep: 1 } : {}, alive: true, fled: false, stolen: 0 };
  }
  private pickMove(x: Foe) {
    const d = FOES[x.kind], f = this.fight!;
    const id = d.next({ turn: x.turns, last: x.last, roll: this.int('fight', 100), low: x.hp * 2 <= x.maxHp, mem: x.mem, allies: f.foes.filter((o) => o.alive && o !== x).length });
    x.move = d.moves[id] ? id : Object.keys(d.moves)[0];
  }
  private shuffle<T>(list: T[]): T[] { for (let i = list.length - 1; i > 0; i--) { const j = this.int('fight', i + 1); [list[i], list[j]] = [list[j], list[i]]; } return list; }
  private startFight(kind: Fight['kind'], ids: string[]) {
    const f: Fight = { kind, turn: 0, energy: 0, hand: [], draw: [], discard: [], gone: [], fluff: 0, st: {}, foes: [], played: 0, attacked: false, won: false };
    this.fight = f; this.phase = 'fight'; this.chewing = false;
    f.draw = this.shuffle(this.deck.map((c) => ({ ...c })));
    if (this.has('suncrown')) for (let i = 0; i < 2; i++) f.draw.splice(this.int('fight', f.draw.length + 1), 0, { id: 'thorn', up: false, uid: this.nextUid++ });
    if (this.has('haycube')) f.fluff = 8;
    if (this.has('pumice')) f.st.zoomies = 1;
    if (this.has('claws')) f.st.zoomies = (f.st.zoomies ?? 0) + 2;
    if (this.has('collar')) f.st.bristle = 3;
    ids.forEach((id, i) => f.foes.push(this.makeFoe(id, i)));
    for (const x of f.foes) this.pickMove(x);
    this.ev({ t: 'fight' });
    this.startTurn();
  }
  private startTurn() {
    const f = this.fight!;
    f.turn++; this.stats.turns++;
    if (f.turn > 1 && !f.st.den) f.fluff = 0;
    for (const id of TIMED) if (f.st[id]) { f.st[id]! -= 1; if (!f.st[id]) delete f.st[id]; }
    f.energy = ENERGY + (this.has('springwater') ? 1 : 0) + (this.has('suncrown') ? 1 : 0) + (this.has('emptypouch') ? 1 : 0) + (this.has('lantern') && f.turn === 1 ? 1 : 0) + (this.has('bell') && f.turn === 1 ? 1 : 0) + (this.has('wheel') && f.turn % 3 === 0 ? 1 : 0) + (f.st.spare ?? 0);
    delete f.st.spare;
    f.played = 0;
    this.ev({ t: 'turn', n: f.turn });
    if (f.st.frenzy) this.buff('zoomies', f.st.frenzy);
    if (f.st.sticky) this.hexAll('burrs', f.st.sticky);
    if (this.has('moss') && f.turn === 2) this.gainFluff(12);
    this.draw(HAND + (this.has('twigs') ? 1 : 0) + (f.st.bright ?? 0) + (this.has('bell') && f.turn === 1 ? 2 : 0));
  }

  /** What an attack card's printed damage comes to against foe `t` (or nobody in particular) right now. */
  attackValue(d: number, t = -1, zx = 1): number {
    const f = this.fight!;
    let v = d + (f.st.zoomies ?? 0) * zx + (this.chewing ? 8 : 0);
    if (f.st.winded) v *= 0.75;
    if (t >= 0 && f.foes[t]?.st.exposed) v *= this.has('lavaledge') ? 1.75 : 1.5;
    return Math.max(0, Math.floor(v));
  }
  /** What a card's printed Fluff comes to right now. */
  fluffValue(b: number): number { const f = this.fight!; return Math.max(0, Math.floor((b + (f.st.fur ?? 0)) * (f.st.matted ? 0.75 : 1))); }
  /** What one hit of a predator's attack comes to right now. */
  foeAttackValue(x: Foe, base: number): number {
    const f = this.fight!;
    let v = (this.level >= 2 ? Math.floor(base * 1.15) : base) + (x.st.zoomies ?? 0);
    if (x.st.winded) v *= 0.75;
    if (f.st.exposed) v *= 1.5;
    return Math.max(0, Math.floor(v));
  }
  /** A card's text as it would play right now, aimed at foe `t` if given. Outside a fight, as printed. */
  textOf(c: Card, t = -1): string {
    if (!this.fight || this.phase !== 'fight') return describe(c);
    const chew = this.has('chewstick') && !this.fight.attacked && CARDS[c.id].type === 'attack', was = this.chewing;
    this.chewing = chew;
    const text = describe(c, { dmg: (d) => this.attackValue(d, t, c.id === 'fullpelt' ? valsOf(c).n : 1), fluff: (b) => this.fluffValue(b) });
    this.chewing = was;
    return text;
  }
  /** What a foe is about to do, with its damage worked out as it stands. */
  intentOf(i: number): Intent {
    const x = this.fight!.foes[i], m = FOES[x.kind].moves[x.move], parts: string[] = [], hits = m.hits ?? 1, dmg = m.dmg ? this.foeAttackValue(x, m.dmg) : 0;
    const names = (s: Statuses, you: boolean) => (Object.keys(s) as StatusId[]).map((id) => (TIMED.includes(id) ? `${you ? 'leaves you' : 'is'} ${STATUS[id].name} for ${plural(s[id]!, 'turn')}` : `${you ? 'gives you' : 'gains'} ${s[id]} ${STATUS[id].name}`));
    if (m.dmg) parts.push(`attacks for ${dmg}${hits > 1 ? `, ${hits} times` : ''}`);
    if (m.steal) parts.push(`steals up to ${m.steal} seeds if a hit lands`);
    if (m.block) parts.push(`gains ${m.block} Fluff`);
    if (m.self) parts.push(...names(m.self, false));
    if (m.hero) parts.push(...names(m.hero, true));
    if (m.add) parts.push(`puts ${m.add[1]} ${CARDS[m.add[0]].name} in your ${m.add[2]} pile`);
    if (m.summon) parts.push(`calls ${plural(m.summon[1], FOES[m.summon[0]].name)}`);
    if (m.shed) parts.push('shakes off everything you have put on it');
    if (m.flee) parts.push('runs off with what it stole');
    if (m.idle) parts.push('does nothing this turn');
    const kind: Intent['kind'] = x.st.doze && !m.dmg ? 'sleep' : m.dmg ? 'attack' : m.flee ? 'flee' : m.summon ? 'call' : m.idle ? 'idle' : m.hero || m.add ? 'hex' : m.self ? 'buff' : 'block';
    return { name: m.name, kind, dmg, hits, text: `${m.name}: ${parts.join(', ')}.` };
  }
  /** The damage coming at the chinchilla this turn if nothing changes. */
  get incoming(): number { const f = this.fight; if (!f) return 0; let n = 0; f.foes.forEach((x, i) => { if (x.alive) { const it = this.intentOf(i); n += it.dmg * it.hits; } }); return n; }

  // -- What cards may ask for (Ops) --
  get myFluff() { return this.fight!.fluff; }
  get playedBefore() { return this.fight!.played; }
  foeHas(t: number, id: StatusId) { return this.fight!.foes[t]?.st[id] ?? 0; }
  foeIn(t: number) { return !!this.fight!.foes[t]?.alive; }
  stripFluff(t: number) { const x = this.fight!.foes[t]; if (x?.alive && x.fluff) { x.fluff = 0; this.ev({ t: 'fluff', who: t, n: 0, fluff: 0 }); } }
  hit(t: number, d: number, zx = 1): number { return this.foeIn(t) ? this.strike(t, this.attackValue(d, t, zx), true) : 0; }
  hitAll(d: number) { this.fight!.foes.forEach((_, t) => { this.hit(t, d); }); }
  hitRandom(d: number) { const live = this.fight!.foes.map((x, t) => (x.alive ? t : -1)).filter((t) => t >= 0); if (live.length) this.hit(this.one('fight', live), d); }
  fluff(b: number) { this.gainFluff(this.fluffValue(b)); }
  gainFluff(n: number) { const f = this.fight!; if (n <= 0) return; f.fluff += n; this.ev({ t: 'fluff', who: -1, n, fluff: f.fluff }); }
  setFluff(n: number) { const f = this.fight!; f.fluff = Math.max(0, n); this.ev({ t: 'fluff', who: -1, n: 0, fluff: f.fluff }); }
  hex(t: number, id: StatusId, n: number) {
    const x = this.fight!.foes[t];
    if (!x?.alive || n <= 0) return;
    if (id === 'burrs' && this.has('burrcomb')) n += 1;
    x.st[id] = (x.st[id] ?? 0) + n;
    this.ev({ t: 'st', who: t, id, n });
  }
  hexAll(id: StatusId, n: number) { this.fight!.foes.forEach((_, t) => this.hex(t, id, n)); }
  buff(id: StatusId, n: number) { const f = this.fight!; if (!n) return; f.st[id] = (f.st[id] ?? 0) + n; if (!f.st[id]) delete f.st[id]; this.ev({ t: 'st', who: -1, id, n }); }
  addEnergy(n: number) { this.fight!.energy += n; }
  heal(n: number) { const got = this.mend(n); if (got) this.ev({ t: 'heal', n: got, hp: this.hp }); }
  raiseMax(n: number) { this.maxHp += n; this.hp += n; this.ev({ t: 'heal', n, hp: this.hp }); }
  cleanse() { const f = this.fight!; for (const id of TIMED) if (f.st[id]) { this.ev({ t: 'st', who: -1, id, n: -f.st[id]! }); delete f.st[id]; } }
  draw(n: number) {
    const f = this.fight!;
    for (; n > 0 && f.hand.length < MAX_HAND; n--) {
      if (!f.draw.length) {
        if (!f.discard.length) return;
        f.draw = this.shuffle(f.discard); f.discard = [];
        this.ev({ t: 'shuffle' });
        if (this.has('hayrack')) this.gainFluff(5);
      }
      const c = f.draw.pop()!;
      f.hand.push(c);
      if (this.has('goggles') && BAD_DRAWS.includes(c.id)) n++;
    }
  }

  // -- Damage --
  /** Takes `dmg` off a foe, Fluff first. `attack` is a hit from a card, which is what Curl Up, Short Temper and Bristle answer. */
  private strike(t: number, dmg: number, attack: boolean): number {
    const f = this.fight!, x = f.foes[t];
    if (!x?.alive) return 0;
    const blocked = Math.min(x.fluff, dmg), lost = Math.min(x.hp, dmg - blocked);
    x.fluff -= blocked; x.hp -= lost; this.stats.dealt += lost;
    this.ev({ t: 'hit', to: t, from: attack ? -1 : -2, dmg: lost, blocked, hp: x.hp, fluff: x.fluff });
    if (lost > 0 && x.st.doze) { delete x.st.doze; x.mem.asleep = 0; this.ev({ t: 'st', who: t, id: 'doze', n: -1 }); if (x.hp > 0) this.pickMove(x); }
    if (attack && lost > 0 && x.hp > 0) {
      if (x.st.curl) { x.fluff += x.st.curl; delete x.st.curl; this.ev({ t: 'fluff', who: t, n: x.fluff, fluff: x.fluff }); }
      if (x.st.angry) { x.st.zoomies = (x.st.zoomies ?? 0) + x.st.angry; this.ev({ t: 'st', who: t, id: 'zoomies', n: x.st.angry }); }
    }
    if (x.hp <= 0) this.down(t);
    if (attack && x.st.bristle && this.phase === 'fight') this.hurt(x.st.bristle, t);
    return lost;
  }
  private down(t: number) {
    const f = this.fight!, x = f.foes[t];
    x.alive = false; x.hp = 0; x.fluff = 0; this.stats.foes++;
    this.ev({ t: 'out', who: t, fled: false });
    if (x.stolen) { this.seeds += x.stolen; this.ev({ t: 'seeds', n: x.stolen }); x.stolen = 0; }
    f.foes.forEach((o, i) => { if (o.alive && o.st.bond) { o.st.zoomies = (o.st.zoomies ?? 0) + o.st.bond; this.ev({ t: 'st', who: i, id: 'zoomies', n: o.st.bond }); } });
    if (f.foes.every((o) => !o.alive)) { f.won = true; return; }
    if (this.has('alarmcall')) { f.energy += 1; this.draw(1); }
  }
  /** Takes `dmg` off the chinchilla, Fluff first. Returns the health lost. */
  private hurt(dmg: number, from: number): number {
    const f = this.fight!;
    if (dmg <= 0) return 0;
    const blocked = Math.min(f.fluff, dmg);
    let rest = dmg - blocked;
    f.fluff -= blocked;
    if (rest > 0 && f.st.slip) { f.st.slip -= 1; if (!f.st.slip) delete f.st.slip; rest = 0; this.ev({ t: 'slip' }); }
    if (rest > 1 && this.has('slab')) rest -= 1;
    rest = Math.min(this.hp, rest);
    this.hp -= rest; this.stats.taken += rest;
    this.ev({ t: 'hit', to: -1, from, dmg: rest, blocked, hp: this.hp, fluff: f.fluff });
    if (this.hp <= 0) { this.phase = 'lost'; this.ev({ t: 'lost' }); }
    return rest;
  }

  // -- The player's moves --
  /** Why hand card `i` cannot be played (at foe `t`, if it needs one), or ''. */
  cannot(i: number, t = -1): string {
    const f = this.fight, c = f?.hand[i];
    if (this.phase !== 'fight' || !f || !c) return 'There is no such card in your hand.';
    const d = CARDS[c.id], cost = costOf(c);
    if (cost === -2) return `${d.name} cannot be played.`;
    if (cost > f.energy || (cost === -1 && f.energy < 1)) return 'Not enough energy.';
    if (d.target) {
      const live = f.foes.filter((x) => x.alive).length;
      if (t < 0 && live > 1) return 'Choose a foe.';
      if (t >= 0 && !f.foes[t]?.alive) return 'That foe is out of the fight.';
    }
    return '';
  }
  /** Every card and target that can be played right now. */
  plays(): { i: number; t: number }[] {
    const f = this.fight, out: { i: number; t: number }[] = [];
    if (this.phase !== 'fight' || !f) return out;
    f.hand.forEach((c, i) => {
      if (CARDS[c.id].target) f.foes.forEach((x, t) => { if (x.alive && !this.cannot(i, t)) out.push({ i, t }); });
      else if (!this.cannot(i)) out.push({ i, t: -1 });
    });
    return out;
  }
  /** Plays hand card `i`. Returns why not, or ''. */
  play(i: number, t = -1): string {
    const why = this.cannot(i, t);
    if (why) return why;
    const f = this.fight!, c = f.hand.splice(i, 1)[0], d = CARDS[c.id], cost = costOf(c), x = cost === -1 ? f.energy : 0;
    f.energy -= cost === -1 ? f.energy : cost;
    let aim = d.target ? (t >= 0 ? t : f.foes.findIndex((o) => o.alive)) : -1;
    this.ev({ t: 'card', id: c.id, up: c.up, target: aim });
    this.chewing = d.type === 'attack' && !f.attacked && this.has('chewstick');
    let times = 1;
    if (d.type === 'attack' && f.st.encore) { times = 2; f.st.encore -= 1; if (!f.st.encore) delete f.st.encore; }
    for (let k = 0; k < times && this.phase === 'fight' && !f.won; k++) {
      // An encore whose foe is already out turns on the next one standing.
      if (d.target && !f.foes[aim]?.alive) { aim = f.foes.findIndex((o) => o.alive); if (aim < 0) break; }
      d.play?.(this as Ops, valsOf(c, x), aim);
    }
    this.chewing = false;
    f.played++; this.stats.cards++;
    if (d.type === 'attack') f.attacked = true;
    if (d.type !== 'power') (d.exhaust ? f.gone : f.discard).push(c);
    if (this.phase !== 'fight') return '';
    if (f.st.light && !f.won) this.gainFluff(f.st.light);
    if (f.won) this.winFight();
    return '';
  }
  /** Ends the chinchilla's turn: the hand goes, every predator takes its move, and the next hand is drawn. */
  endTurn(): string {
    const f = this.fight;
    if (this.phase !== 'fight' || !f) return 'There is no fight.';
    for (const c of f.hand) { const s = CARDS[c.id].sting; if (s) { this.hurt(s, -2); if (this.phase !== 'fight') return ''; } }
    if (f.st.nest) this.gainFluff(f.st.nest);
    if (this.has('hammock') && f.fluff === 0) this.gainFluff(6);
    for (const c of f.hand) (CARDS[c.id].fades ? f.gone : f.discard).push(c);
    f.hand = [];
    if (f.st.rush) { this.buff('zoomies', -f.st.rush); delete f.st.rush; }
    delete f.st.encore;
    this.ev({ t: 'foes' });
    const n = f.foes.length;
    for (let i = 0; i < n && !f.won; i++) { if (f.foes[i].alive) this.foeTurn(i); if (this.phase !== 'fight') return ''; }
    if (f.won) { this.winFight(); return ''; }
    this.startTurn();
    return '';
  }
  private foeTurn(i: number) {
    const f = this.fight!, x = f.foes[i];
    x.fluff = 0;
    if (x.st.burrs) {
      const b = x.st.burrs, lost = Math.min(x.hp, b);
      x.hp -= lost; this.stats.dealt += lost;
      if (b > 1) x.st.burrs = b - 1; else delete x.st.burrs;
      this.ev({ t: 'hit', to: i, from: -2, dmg: lost, blocked: 0, hp: x.hp, fluff: 0 });
      if (x.st.doze) { delete x.st.doze; x.mem.asleep = 0; if (x.hp > 0) this.pickMove(x); }
      if (x.hp <= 0) { this.down(i); return; }
    }
    const id = x.move, m: Move = FOES[x.kind].moves[id];
    this.ev({ t: 'move', who: i, name: m.name, attack: !!m.dmg });
    if (m.block) { x.fluff += m.block; this.ev({ t: 'fluff', who: i, n: m.block, fluff: x.fluff }); }
    if (m.dmg) for (let h = 0; h < (m.hits ?? 1) && x.alive; h++) {
      const lost = this.hurt(this.foeAttackValue(x, m.dmg), i);
      if (this.phase !== 'fight') return;
      if (lost > 0 && m.steal) { const got = Math.min(this.seeds, m.steal); if (got) { this.seeds -= got; x.stolen += got; this.ev({ t: 'seeds', n: -got }); } }
      if (f.st.bristle) this.strike(i, f.st.bristle, false);
    }
    if (!x.alive) return;
    if (m.self) for (const k of Object.keys(m.self) as StatusId[]) { x.st[k] = (x.st[k] ?? 0) + m.self[k]!; this.ev({ t: 'st', who: i, id: k, n: m.self[k]! }); }
    // A timed status lands one higher than the move says: it counts down as the chinchilla's turn starts, so the number shown is the turns it will be felt.
    if (m.hero) for (const k of Object.keys(m.hero) as StatusId[]) this.buff(k, m.hero[k]! + (TIMED.includes(k) && !f.st[k] ? 1 : 0));
    if (m.add) {
      for (let k = 0; k < m.add[1]; k++) { const c: Card = { id: m.add[0], up: false, uid: this.nextUid++ }; if (m.add[2] === 'draw') f.draw.splice(this.int('fight', f.draw.length + 1), 0, c); else f.discard.push(c); }
      this.note(m.add[0]); this.ev({ t: 'add', id: m.add[0], n: m.add[1] });
    }
    if (m.summon) for (let k = 0; k < m.summon[1] && f.foes.filter((o) => o.alive).length < MAX_FOES; k++) { const y = this.makeFoe(m.summon[0], f.foes.length); f.foes.push(y); this.pickMove(y); this.ev({ t: 'join', who: f.foes.length - 1 }); }
    if (m.shed) for (const k of ['exposed', 'winded', 'burrs'] as StatusId[]) if (x.st[k]) { this.ev({ t: 'st', who: i, id: k, n: -x.st[k]! }); delete x.st[k]; }
    if (m.flee) { x.alive = false; x.fled = true; this.ev({ t: 'out', who: i, fled: true }); if (f.foes.every((o) => !o.alive)) f.won = true; return; }
    if (m.idle) { x.mem.stirred = 1; x.mem.awake = 0; } else if (x.mem.stirred) x.mem.awake = (x.mem.awake ?? 0) + 1;
    if (x.st.rage) { x.st.zoomies = (x.st.zoomies ?? 0) + x.st.rage; this.ev({ t: 'st', who: i, id: 'zoomies', n: x.st.rage }); }
    // A sleeper that wakes by itself is not groggy: it goes straight to its first attack.
    if (x.st.doze) { x.st.doze -= 1; if (!x.st.doze) { delete x.st.doze; x.mem.asleep = 0; x.mem.stirred = 1; x.mem.awake = 0; } }
    for (const k of TIMED) if (x.st[k]) { x.st[k]! -= 1; if (!x.st[k]) delete x.st[k]; }
    x.turns++; x.last.push(id); if (x.last.length > 4) x.last.shift();
    this.pickMove(x);
  }
}

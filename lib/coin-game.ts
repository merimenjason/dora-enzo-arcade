// Coin of the Realm: the rules. You are a gold coin with Dora on one face and Enzo on the other, passing from paw to
// paw round a little market town. Every hour the townsfolk holding you spends you, and all you choose is whose paw you
// land in next. Paying the right sellers fills the day's orders, and every order is a plank for the town's bridge.
// Dora-side up you can roll two streets; Enzo-side up you only go next door, but you overhear what the folk round you
// are feeling. Thieves prowl the streets to snatch you: gulls at the harbour, magpies on the hill, Grumbles in their
// hollow. Deterministic, no DOM: towns and moods come from a seed.

export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}

// ---------------------------------------------------------------- townsfolk
export type Good = 'bread' | 'timber' | 'nails' | 'rope' | 'fish' | 'pot';
export const GOODS: Good[] = ['bread', 'timber', 'nails', 'rope', 'fish', 'pot'];
export const GOOD_NAMES: Record<Good, string> = { bread: 'bread', timber: 'timber', nails: 'nails', rope: 'rope', fish: 'fish', pot: 'pots' };
export type Trade = 'baker' | 'woodcutter' | 'smith' | 'weaver' | 'fisher' | 'potter';
export type Special = 'mayor' | 'pedlar' | 'gossip' | 'juggler' | 'miser';
export type Kind = Trade | Special;
export const TRADES: Trade[] = ['baker', 'woodcutter', 'smith', 'weaver', 'fisher', 'potter'];
export const SELLS: Record<Trade, Good> = { baker: 'bread', woodcutter: 'timber', smith: 'nails', weaver: 'rope', fisher: 'fish', potter: 'pot' };
export const isTrade = (k: Kind): k is Trade => k in SELLS;
export const FOLK: Record<Kind, { name: string; who: string; text: string }> = {
  baker: { name: 'Baker', who: 'a rabbit', text: 'Sells bread.' },
  woodcutter: { name: 'Woodcutter', who: 'a beaver', text: 'Sells timber.' },
  smith: { name: 'Smith', who: 'a badger', text: 'Sells nails.' },
  weaver: { name: 'Weaver', who: 'a mouse', text: 'Sells rope.' },
  fisher: { name: 'Fisher', who: 'an otter', text: 'Sells fish.' },
  potter: { name: 'Potter', who: 'a tortoise', text: 'Sells pots.' },
  mayor: { name: 'Mayor', who: 'an owl', text: 'Every morning starts in her paw. Once a day, pay her and she pins one more order on the board.' },
  pedlar: { name: 'Pedlar', who: 'a fox', text: 'Goes everywhere: from his paw the coin can go to anyone in town.' },
  gossip: { name: 'Gossip', who: 'a duck', text: 'Tells Enzo how everyone in town is feeling today.' },
  juggler: { name: 'Juggler', who: 'a raccoon', text: 'Spins the coin so it lands both ways up: Dora’s reach and Enzo’s ears at once.' },
  miser: { name: 'Miser', who: 'a toad', text: 'Once a day, gives a plank from his sock of savings, but keeps the coin two hours longer.' },
};
export type Mood = 'fair' | 'cheery' | 'grumpy';
export const MOODS: Record<Mood, string> = { fair: 'Fair: fills an order as usual.', cheery: 'Cheery: an order filled here is worth two planks.', grumpy: 'Grumpy: won’t sell today, so no order.' };
export type Face = 'dora' | 'enzo' | 'both';

// ---------------------------------------------------------------- towns
export const COLS = 4, ROWS = 3;
/** who does the snatching in each town; they all creep the same way, one street an hour */
export type Thief = 'gull' | 'magpie' | 'grumble';
export const THIEVES: Record<Thief, { name: string; one: string; text: string; meet: string; snatch: string }> = {
  gull: {
    name: 'Herring Gull', one: 'a herring gull', text: 'Saltwick Harbour’s thief: it waddles one street an hour towards the coin and snatches it.',
    meet: 'Herring gulls! They’ll grab anything shiny, and they waddle one street nearer every hour. If one reaches the paw we’re in, we’re snatched till morning. A red ring means don’t go there.',
    snatch: 'Snatched! Off in a gull’s beak till morning. That’s the rest of the day gone.',
  },
  magpie: {
    name: 'Magpie', one: 'a magpie', text: 'Russet Hill’s thief: nothing glints like a gold coin. It hops one street an hour towards it and snatches it.',
    meet: 'Magpies! Nothing glints like us. They hop one street nearer every hour, and if one reaches the paw we’re in, we’re in its nest till morning.',
    snatch: 'Snatched! Into the magpie’s nest till morning. That’s the rest of the day gone.',
  },
  grumble: {
    name: 'Grumble', one: 'a Grumble', text: 'Grumble Hollow’s thieves: they creep one street an hour towards the coin and stuff it in a sock.',
    meet: 'Grumbles! They creep one street nearer every hour. If one reaches the paw we’re in, we’re snatched till morning. A red ring means don’t go there.',
    snatch: 'Snatched! Into the Grumble’s sock till morning. That’s the rest of the day gone.',
  },
};
export const TOWNS = [
  { name: 'Bramble Green', goal: 6, thieves: 0, thief: 'gull' as Thief, specials: ['pedlar', 'gossip'] as Special[], grumpy: 0.12 },
  { name: 'Saltwick Harbour', goal: 7, thieves: 1, thief: 'gull' as Thief, specials: ['pedlar', 'gossip', 'miser'] as Special[], grumpy: 0.16 },
  { name: 'Russet Hill', goal: 8, thieves: 1, thief: 'magpie' as Thief, specials: ['pedlar', 'gossip', 'juggler', 'miser'] as Special[], grumpy: 0.2 },
  { name: 'Grumble Hollow', goal: 9, thieves: 2, thief: 'grumble' as Thief, specials: ['pedlar', 'gossip', 'juggler', 'miser'] as Special[], grumpy: 0.24 },
];
export const DAYS = 3, HOURS = 8, ORDERS = 3;
export type Folk = { id: number; kind: Kind; x: number; y: number; slot: number };
export type Town = { ix: number; name: string; folk: Folk[]; streets: [number, number][]; adj: number[][]; mayor: number; dens: number[]; thief: Thief; goal: number };

const slotXY = (slot: number) => ({ c: slot % COLS, r: Math.floor(slot / COLS) });
/** streets between two neighbouring plots, and a few diagonals (one per square of four, so no two cross) */
export function makeTown(seed: number, ix: number): Town {
  let s = ((seed >>> 0) ^ Math.imul(ix + 1, 0x9e3779b1)) >>> 0 || 1;
  const rnd = () => { const [v, n] = rngNext(s); s = n; return v; };
  const def = TOWNS[ix];
  const mayorSlot = 5 + Math.floor(rnd() * 2);
  const corners = [0, 3, 8, 11];
  let empty = mayorSlot;
  while (empty === mayorSlot || corners.includes(empty)) empty = Math.floor(rnd() * COLS * ROWS);
  const slots = Array.from({ length: COLS * ROWS }, (_, i) => i).filter((i) => i !== empty);
  // who lives where: the mayor in the middle, the rest shuffled
  const kinds: Kind[] = [...def.specials];
  const trades = [...TRADES];
  while (kinds.length + trades.length < slots.length - 1) trades.push(TRADES[Math.floor(rnd() * TRADES.length)]);
  kinds.push(...trades);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const folk: Folk[] = slots.map((slot, id) => {
    const { c, r } = slotXY(slot);
    return { id, slot, kind: slot === mayorSlot ? 'mayor' : kinds.pop()!, x: Math.round(56 + c * 90 + (rnd() - 0.5) * 18), y: Math.round(37 + r * 58 + (rnd() - 0.5) * 12) };
  });
  const bySlot = (slot: number) => folk.find((f) => f.slot === slot);
  const streets: [number, number][] = [];
  const add = (a?: Folk, b?: Folk) => { if (a && b && !streets.some(([p, q]) => (p === a.id && q === b.id) || (p === b.id && q === a.id))) streets.push([a.id, b.id]); };
  const grid: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 1 < COLS) grid.push([r * COLS + c, r * COLS + c + 1]);
    if (r + 1 < ROWS) grid.push([r * COLS + c, (r + 1) * COLS + c]);
  }
  for (const [a, b] of grid) if (rnd() < 0.72) add(bySlot(a), bySlot(b));
  for (let r = 0; r + 1 < ROWS; r++) for (let c = 0; c + 1 < COLS; c++) {
    if (rnd() < 0.3) { const tl = r * COLS + c; if (rnd() < 0.5) add(bySlot(tl), bySlot(tl + COLS + 1)); else add(bySlot(tl + 1), bySlot(tl + COLS)); }
  }
  // join everything up, and give everyone at least two streets where the grid allows
  const adjOf = () => { const a: number[][] = folk.map(() => []); for (const [p, q] of streets) { a[p].push(q); a[q].push(p); } return a; };
  for (let guard = 0; guard < 40; guard++) {
    const adj = adjOf(), seen = new Set([0]), stack = [0];
    while (stack.length) for (const n of adj[stack.pop()!]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    const lonely = folk.find((f) => adj[f.id].length < 2 && grid.some(([a, b]) => (a === f.slot && bySlot(b) && !adj[f.id].includes(bySlot(b)!.id)) || (b === f.slot && bySlot(a) && !adj[f.id].includes(bySlot(a)!.id))));
    if (seen.size === folk.length && !lonely) break;
    const cand = grid.filter(([a, b]) => {
      const fa = bySlot(a), fb = bySlot(b); if (!fa || !fb || adj[fa.id].includes(fb.id)) return false;
      return seen.size < folk.length ? seen.has(fa.id) !== seen.has(fb.id) : fa === lonely || fb === lonely;
    });
    if (!cand.length) break;
    const [a, b] = cand[Math.floor(rnd() * cand.length)]; add(bySlot(a), bySlot(b));
  }
  const adj = adjOf().map((l) => l.sort((a, b) => a - b));
  const mayor = bySlot(mayorSlot)!.id;
  const dens = corners.map((c) => bySlot(c)!.id).sort((a, b) => dist(adj, mayor)[b] - dist(adj, mayor)[a] || a - b).slice(0, def.thieves);
  return { ix, name: def.name, folk, streets, adj, mayor, dens, thief: def.thief, goal: def.goal };
}

/** streets from one townsfolk to everyone, not walking through the blocked ones */
export function dist(adj: number[][], from: number, blocked: number[] = []): number[] {
  const d = adj.map(() => Infinity); d[from] = 0; const q = [from];
  for (let i = 0; i < q.length; i++) for (const n of adj[q[i]]) if (d[n] === Infinity && !blocked.includes(n)) { d[n] = d[q[i]] + 1; q.push(n); }
  return d;
}

// ---------------------------------------------------------------- perks
export const PERKS = [
  { id: 'longday', name: 'Long day', max: 2, text: 'One more hour every day.' },
  { id: 'wander', name: 'Wanderlust', max: 1, text: 'Dora-side up, the coin rolls three streets, not two.' },
  { id: 'ears', name: 'Big ears', max: 1, text: 'Enzo-side up, Enzo hears everyone three streets away, not two.' },
  { id: 'lucky', name: 'Lucky toss', max: 2, text: 'Once a day, flip the coin over before it’s spent.' },
  { id: 'planks', name: 'Spare planks', max: 2, text: 'Every new town’s bridge starts with one plank.' },
  { id: 'butter', name: 'Butter paws', max: 1, text: 'Thieves slip and only move every other hour.' },
  { id: 'rainy', name: 'Rainy-day fund', max: 1, text: 'One more day in every town.' },
] as const;
export type PerkId = (typeof PERKS)[number]['id'];
export const noPerks = (): Record<PerkId, number> => ({ longday: 0, wander: 0, ears: 0, lucky: 0, planks: 0, butter: 0, rainy: 0 });

// ---------------------------------------------------------------- the run
export type Phase = 'play' | 'pick' | 'won' | 'lost';
export type Order = { good: Good; done: boolean };
export type Ev =
  | { k: 'pass'; from: number; to: number; face: Face }
  | { k: 'wait'; at: number; face: Face }
  | { k: 'flip'; face: Face }
  | { k: 'order'; at: number; good: Good; planks: number }
  | { k: 'grumpy'; at: number }
  | { k: 'hear'; at: number; ids: number[] }
  | { k: 'gossip'; at: number }
  | { k: 'mayor'; at: number; good: Good }
  | { k: 'miser'; at: number }
  | { k: 'pedlar'; at: number }
  | { k: 'juggler'; at: number }
  | { k: 'hour'; hour: number }
  | { k: 'thief'; i: number; from: number; to: number }
  | { k: 'snatch'; i: number; at: number }
  | { k: 'dusk'; day: number }
  | { k: 'dawn'; day: number }
  | { k: 'bridge' }
  | { k: 'won' }
  | { k: 'lost' };

export class Run {
  seed: number; rs: number;
  ix = 0; phase: Phase = 'play';
  town!: Town; planks = 0; day = 0; hour = 0;
  holder = 0; face: Face = 'dora';
  /** today: the order board, each townsfolk's mood, whether Enzo has heard it, how often each has been paid */
  orders: Order[] = []; moods: Mood[] = []; known: boolean[] = [];
  paid: number[] = []; yesterday: number[] = []; prosper: number[] = [];
  thieves: number[] = [];
  /** the coin's next spend can go anywhere (the pedlar) */
  anywhere = false;
  mayorUsed = false; miserUsed = false; flips = 0;
  perks = noPerks(); offer: PerkId[] = [];
  stats = { towns: 0, planks: 0, passes: 0, orders: 0, snatched: 0, days: 0 };
  seen: Kind[] = [];
  constructor(seed: number) { this.seed = seed >>> 0 || 1; this.rs = this.seed; this.enter(0); }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get hours() { return HOURS + this.perks.longday; }
  get days() { return DAYS + this.perks.rainy; }
  get goal() { return this.town.goal; }
  get flipsMax() { return this.perks.lucky; }
  get blocked() { return this.thieves; }

  enter(ix: number) {
    this.ix = ix; this.town = makeTown(this.seed, ix);
    this.planks = this.perks.planks; this.day = 0;
    this.prosper = this.town.folk.map(() => 0); this.yesterday = this.town.folk.map(() => 1);
    for (const f of this.town.folk) if (!this.seen.includes(f.kind)) this.seen.push(f.kind);
    this.phase = 'play'; this.dawn();
  }
  /** a new morning: the coin back in the mayor's paw, Dora-side up, fresh orders and moods, thieves home */
  dawn() {
    this.hour = 0; this.holder = this.town.mayor; this.face = 'dora'; this.anywhere = false;
    this.mayorUsed = false; this.miserUsed = false; this.flips = 0;
    this.paid = this.town.folk.map(() => 0);
    this.thieves = [...this.town.dens];
    const base = TOWNS[this.ix].grumpy;
    this.moods = this.town.folk.map((f) => {
      if (!isTrade(f.kind)) return 'fair';
      const fed = this.yesterday[f.id] > 0, v = this.rnd();
      const cheery = fed ? 0.3 : 0.08, grumpy = fed ? base * 0.5 : base + 0.2;
      return v < cheery ? 'cheery' : v < cheery + grumpy ? 'grumpy' : 'fair';
    });
    this.known = this.town.folk.map((f) => !isTrade(f.kind));
    const goods = this.goodsHere();
    this.orders = [];
    while (this.orders.length < Math.min(ORDERS, goods.length)) this.orders.push({ good: goods.splice(Math.floor(this.rnd() * goods.length), 1)[0], done: false });
  }
  goodsHere(): Good[] { return GOODS.filter((g) => this.town.folk.some((f) => isTrade(f.kind) && SELLS[f.kind] === g)); }
  /** how far the coin can go from here, by its face */
  reachOf(face = this.face) { return face === 'enzo' ? 1 : 2 + this.perks.wander; }
  /** who can be paid next */
  targets(): number[] {
    if (this.phase !== 'play') return [];
    const out: number[] = [];
    if (this.anywhere) { for (const f of this.town.folk) if (f.id !== this.holder && !this.thieves.includes(f.id)) out.push(f.id); return out; }
    const d = dist(this.town.adj, this.holder, this.thieves), r = this.reachOf();
    for (const f of this.town.folk) if (f.id !== this.holder && d[f.id] <= r && !this.thieves.includes(f.id)) out.push(f.id);
    return out;
  }
  /** who Enzo hears from here */
  hearing(at: number) { const d = dist(this.town.adj, at), r = 2 + this.perks.ears; return this.town.folk.filter((f) => d[f.id] <= r).map((f) => f.id); }
  /** a thief one step from where the coin would be: it would be snatched in the next hour */
  danger(at: number, hours = 1): boolean {
    if (!this.thieves.length || (this.perks.butter && this.hour % 2 === 0 && hours === 1)) return false;
    return this.thieves.some((g) => dist(this.town.adj, g)[at] <= hours);
  }
  /** spend the coin: it lands in this townsfolk's paw */
  pass(to: number): Ev[] {
    if (!this.targets().includes(to)) return [];
    const ev: Ev[] = [], from = this.holder, f = this.town.folk[to];
    this.anywhere = false; this.stats.passes++;
    this.face = f.kind === 'juggler' ? 'both' : this.face === 'dora' ? 'enzo' : 'dora';
    this.holder = to; this.paid[to]++; this.prosper[to]++;
    ev.push({ k: 'pass', from, to, face: this.face });
    let extra = 0;
    if (isTrade(f.kind)) {
      const o = this.orders.find((x) => !x.done && x.good === SELLS[f.kind as Trade]);
      if (o) {
        if (this.moods[to] === 'grumpy') { this.known[to] = true; ev.push({ k: 'grumpy', at: to }); }
        else { const n = this.moods[to] === 'cheery' ? 2 : 1; this.known[to] = true; o.done = true; this.planks += n; this.stats.orders++; this.stats.planks += n; ev.push({ k: 'order', at: to, good: o.good, planks: n }); }
      }
    } else if (f.kind === 'mayor' && !this.mayorUsed) {
      this.mayorUsed = true;
      const left = this.goodsHere().filter((g) => !this.orders.some((o) => o.good === g && !o.done));
      if (left.length) { const g = left[Math.floor(this.rnd() * left.length)]; this.orders.push({ good: g, done: false }); ev.push({ k: 'mayor', at: to, good: g }); }
    } else if (f.kind === 'miser' && !this.miserUsed) {
      this.miserUsed = true; this.planks++; this.stats.planks++; extra = 2; ev.push({ k: 'miser', at: to });
    } else if (f.kind === 'gossip') { this.known = this.known.map(() => true); ev.push({ k: 'gossip', at: to }); }
    else if (f.kind === 'pedlar') { this.anywhere = true; ev.push({ k: 'pedlar', at: to }); }
    else if (f.kind === 'juggler') ev.push({ k: 'juggler', at: to });
    if (this.face !== 'dora') { const ids = this.hearing(to).filter((i) => !this.known[i]); ids.forEach((i) => (this.known[i] = true)); ev.push({ k: 'hear', at: to, ids }); }
    if (this.planks >= this.goal) return this.finishTown(ev);
    for (let h = 0; h <= extra && this.phase === 'play'; h++) this.tick(ev);
    return ev;
  }
  /** nobody can be paid (or the player chooses to): the coin sits for an hour and turns over */
  wait(): Ev[] {
    if (this.phase !== 'play') return [];
    const ev: Ev[] = [];
    this.face = this.face === 'dora' ? 'enzo' : 'dora'; this.anywhere = false;
    ev.push({ k: 'wait', at: this.holder, face: this.face });
    if (this.face !== 'dora') { const ids = this.hearing(this.holder).filter((i) => !this.known[i]); ids.forEach((i) => (this.known[i] = true)); ev.push({ k: 'hear', at: this.holder, ids }); }
    this.tick(ev); return ev;
  }
  /** Lucky toss: turn the coin over without spending an hour */
  flip(): Ev[] {
    if (this.phase !== 'play' || this.flips >= this.flipsMax || this.face === 'both') return [];
    this.flips++; this.face = this.face === 'dora' ? 'enzo' : 'dora';
    const ev: Ev[] = [{ k: 'flip', face: this.face }];
    if (this.face === 'enzo') { const ids = this.hearing(this.holder).filter((i) => !this.known[i]); ids.forEach((i) => (this.known[i] = true)); ev.push({ k: 'hear', at: this.holder, ids }); }
    return ev;
  }
  /** an hour passes: the thieves creep one street nearer, and the day may end */
  private tick(ev: Ev[]) {
    this.hour++; ev.push({ k: 'hour', hour: this.hour });
    if (!(this.perks.butter && this.hour % 2 === 1)) {
      for (let i = 0; i < this.thieves.length; i++) {
        const g = this.thieves[i], d = dist(this.town.adj, this.holder);
        const next = this.town.adj[g].filter((n) => !this.thieves.includes(n) || n === this.holder).sort((a, b) => d[a] - d[b] || a - b)[0];
        if (next === undefined || d[next] >= d[g]) continue;
        this.thieves[i] = next; ev.push({ k: 'thief', i, from: g, to: next });
        if (next === this.holder) { this.stats.snatched++; ev.push({ k: 'snatch', i, at: next }); this.dusk(ev); return; }
      }
    }
    if (this.hour >= this.hours) this.dusk(ev);
  }
  private dusk(ev: Ev[]) {
    this.stats.days++; ev.push({ k: 'dusk', day: this.day });
    this.yesterday = [...this.paid];
    if (this.day + 1 >= this.days) { this.phase = 'lost'; ev.push({ k: 'lost' }); return; }
    this.day++; this.dawn(); ev.push({ k: 'dawn', day: this.day });
  }
  private finishTown(ev: Ev[]): Ev[] {
    this.stats.towns++; ev.push({ k: 'bridge' });
    if (this.ix + 1 >= TOWNS.length) { this.phase = 'won'; ev.push({ k: 'won' }); }
    else { this.phase = 'pick'; this.offer = this.makeOffer(); }
    return ev;
  }
  makeOffer() {
    const pool: PerkId[] = PERKS.filter((p) => this.perks[p.id] < p.max).map((p) => p.id);
    const out: PerkId[] = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
    return out;
  }
  pick(id?: PerkId) {
    if (this.phase !== 'pick') return false;
    if (id) { if (!this.offer.includes(id)) return false; this.perks[id]++; }
    this.offer = []; this.enter(this.ix + 1); return true;
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'coin-of-the-realm-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { towns: number; planks: number };
  stats: { runs: number; wins: number; planks: number };
  seen: string[];
  settings: { sound: boolean; music: boolean; fast: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { towns: 0, planks: 0 }, stats: { runs: 0, wins: 0, planks: 0 }, seen: [], settings: { sound: true, music: true, fast: false } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    s.intro = o.intro === true;
    s.best.towns = Math.min(TOWNS.length, num(o.best?.towns)); s.best.planks = num(o.best?.planks);
    for (const k of ['runs', 'wins', 'planks'] as const) s.stats[k] = num(o.stats?.[k]);
    s.seen = Array.isArray(o.seen) ? o.seen.filter((k: unknown): k is string => typeof k === 'string' && (k in FOLK || k in THIEVES)) : [];
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false; s.settings.fast = o.settings?.fast === true;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.planks += r.stats.planks;
  if (r.phase === 'won') s.stats.wins++;
  s.best.towns = Math.max(s.best.towns, r.stats.towns);
  s.best.planks = Math.max(s.best.planks, r.stats.planks);
}

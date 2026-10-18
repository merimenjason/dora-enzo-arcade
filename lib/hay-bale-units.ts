// Hay Bale Brawl: the roster. Thirty woodland units in five tiers, the summoned tokens and the snacks. Abilities are
// written against `Ctx`, which the game implements twice: once for the shop and once for a fight, so the same line of
// text means the same thing in both.

export type Tier = 1 | 2 | 3 | 4 | 5;
export type Level = 1 | 2 | 3;
export type Status = 'shell' | 'mint' | 'chilli' | null;
export type UnitId =
  | 'wren' | 'mouse' | 'ladybird' | 'toad' | 'bee' | 'dormouse'
  | 'hedgehog' | 'squirrel' | 'robin' | 'mole' | 'frog' | 'pip'
  | 'badger' | 'otter' | 'magpie' | 'rabbit' | 'porcupine' | 'beaver'
  | 'stoat' | 'tortoise' | 'crow' | 'skunk' | 'raccoon' | 'hare'
  | 'boar' | 'bear' | 'stag' | 'duchess' | 'hawk' | 'goose';
export type TokenId = 'mouselet' | 'log' | 'fawn';
export type SnackId = 'apple' | 'raisin' | 'honey' | 'hay' | 'mint' | 'chilli' | 'seed' | 'cake';
export type Trigger =
  | 'buy' | 'sell' | 'startTurn' | 'endTurn' | 'startBattle' | 'beforeAttack' | 'hurt' | 'faint' | 'knockOut'
  | 'friendSummoned' | 'friendAheadFaints' | 'friendFaints' | 'friendAte';

/** A unit on a line or in the shop. `tmpA` is attack that lasts the next fight only (the Raisin). */
export type Unit = { uid: number; id: UnitId | TokenId; a: number; h: number; level: Level; xp: number; status: Status; tmpA: number };

/**
 * What an ability can do. `friends` never includes the unit asking; both lists are living units, front first.
 * `enemies` is empty in the shop; `acorns` and `snackDiscount` do nothing in a fight.
 */
export interface Ctx {
  rand: { int(n: number): number };
  friends(u: Unit): Unit[];
  enemies(u: Unit): Unit[];
  ahead(u: Unit): Unit | null;
  behind(u: Unit): Unit | null;
  buff(u: Unit, a: number, h: number): void;
  damage(u: Unit, n: number): void;
  status(u: Unit, s: Status): void;
  summon(at: Unit, id: TokenId, a: number, h: number): void;
  acorns(n: number): void;
  snackDiscount(n: number): void;
}

/** `other` is the summoned friend, the friend that ate, the friend that fainted or the enemy knocked out. */
export type UnitDef = {
  id: UnitId; name: string; tier: Tier; a: number; h: number; on: Trigger;
  text: [string, string, string];
  run(ctx: Ctx, self: Unit, n: Level, other: Unit | null): void;
};

/** Up to `k` distinct units from `list`, chosen with the context's generator. */
export function some(ctx: Ctx, list: Unit[], k: number) {
  const pool = list.slice(), out: Unit[] = [];
  while (out.length < k && pool.length) out.push(pool.splice(ctx.rand.int(pool.length), 1)[0]);
  return out;
}
/** The first unit with the most of `score` (front-most on a tie). */
function most(list: Unit[], score: (u: Unit) => number) {
  let best: Unit | null = null;
  for (const u of list) if (!best || score(u) > score(best)) best = u;
  return best;
}
const lines = (f: (n: number) => string): [string, string, string] => [f(1), f(2), f(3)];
const PCT = [0, 0.33, 0.66, 0.99];

const defs: UnitDef[] = [
  // Tier 1
  { id: 'wren', name: 'Wren', tier: 1, a: 2, h: 1, on: 'sell', text: lines((n) => `Sell: give ${n} random ${n === 1 ? 'friend' : 'friends'} +1 attack.`),
    run: (c, s, n) => { for (const f of some(c, c.friends(s), n)) c.buff(f, 1, 0); } },
  { id: 'mouse', name: 'Field Mouse', tier: 1, a: 2, h: 1, on: 'faint', text: lines((n) => `Faint: summon a ${n}/${n} Mouselet in its place.`),
    run: (c, s, n) => c.summon(s, 'mouselet', n, n) },
  { id: 'ladybird', name: 'Ladybird', tier: 1, a: 1, h: 2, on: 'startBattle', text: lines((n) => `Start of battle: give the friend ahead +${n} attack.`),
    run: (c, s, n) => { const f = c.ahead(s); if (f) c.buff(f, n, 0); } },
  { id: 'toad', name: 'Toad', tier: 1, a: 2, h: 2, on: 'faint', text: lines((n) => `Faint: give the friend behind +${n}/+${n}.`),
    run: (c, s, n) => { const f = c.behind(s); if (f) c.buff(f, n, n); } },
  { id: 'bee', name: 'Bee', tier: 1, a: 1, h: 1, on: 'startBattle', text: lines((n) => `Start of battle: deal ${n} damage to a random enemy.`),
    run: (c, s, n) => { for (const e of some(c, c.enemies(s), 1)) c.damage(e, n); } },
  { id: 'dormouse', name: 'Dormouse', tier: 1, a: 1, h: 3, on: 'endTurn', text: lines((n) => `End turn: gain +0/+${n}.`),
    run: (c, s, n) => c.buff(s, 0, n) },
  // Tier 2
  { id: 'hedgehog', name: 'Hedgehog', tier: 2, a: 3, h: 2, on: 'faint', text: lines((n) => `Faint: deal ${2 * n} damage to every other unit, friend and rival.`),
    run: (c, s, n) => { for (const u of [...c.friends(s), ...c.enemies(s)]) c.damage(u, 2 * n); } },
  { id: 'squirrel', name: 'Squirrel', tier: 2, a: 2, h: 3, on: 'startTurn', text: lines((n) => `Start of turn: snacks in the shop cost ${n} less.`),
    run: (c, _s, n) => c.snackDiscount(n) },
  { id: 'robin', name: 'Robin', tier: 2, a: 2, h: 3, on: 'friendSummoned', text: lines((n) => `Friend summoned: give it +${n}/+${n}.`),
    run: (c, _s, n, o) => { if (o) c.buff(o, n, n); } },
  { id: 'mole', name: 'Mole', tier: 2, a: 1, h: 4, on: 'hurt', text: lines((n) => `Hurt: gain +${2 * n} attack.`),
    run: (c, s, n) => c.buff(s, 2 * n, 0) },
  { id: 'frog', name: 'Frog', tier: 2, a: 3, h: 3, on: 'friendAheadFaints', text: lines((n) => `Friend ahead faints: gain +${2 * n}/+${2 * n}.`),
    run: (c, s, n) => c.buff(s, 2 * n, 2 * n) },
  { id: 'pip', name: 'Pip', tier: 2, a: 2, h: 2, on: 'buy', text: lines((n) => `Buy: give 2 random friends +${n} health.`),
    run: (c, s, n) => { for (const f of some(c, c.friends(s), 2)) c.buff(f, 0, n); } },
  // Tier 3
  { id: 'badger', name: 'Badger', tier: 3, a: 4, h: 3, on: 'beforeAttack', text: lines((n) => `Before attack: deal ${2 * n} damage to the second enemy.`),
    run: (c, s, n) => { const e = c.enemies(s)[1]; if (e) c.damage(e, 2 * n); } },
  { id: 'otter', name: 'Otter', tier: 3, a: 3, h: 4, on: 'endTurn', text: lines((n) => `End turn: give the friend ahead +${n}/+${n}.`),
    run: (c, s, n) => { const f = c.ahead(s); if (f) c.buff(f, n, n); } },
  { id: 'magpie', name: 'Magpie', tier: 3, a: 3, h: 3, on: 'startTurn', text: lines((n) => `Start of turn: gain ${n} ${n === 1 ? 'acorn' : 'acorns'}.`),
    run: (c, _s, n) => c.acorns(n) },
  { id: 'rabbit', name: 'Rabbit', tier: 3, a: 3, h: 4, on: 'friendAte', text: lines((n) => `Friend eats a snack: give it +${n} more health.`),
    run: (c, _s, n, o) => { if (o) c.buff(o, 0, n); } },
  { id: 'porcupine', name: 'Porcupine', tier: 3, a: 2, h: 5, on: 'hurt', text: lines((n) => `Hurt: deal ${2 * n} damage to a random enemy.`),
    run: (c, s, n) => { for (const e of some(c, c.enemies(s), 1)) c.damage(e, 2 * n); } },
  { id: 'beaver', name: 'Beaver', tier: 3, a: 3, h: 3, on: 'faint', text: lines((n) => `Faint: summon a 0/${6 * n} Log Dam in its place.`),
    run: (c, s, n) => c.summon(s, 'log', 0, 6 * n) },
  // Tier 4
  { id: 'stoat', name: 'Stoat', tier: 4, a: 5, h: 3, on: 'knockOut', text: lines((n) => `Knock out: gain +${2 * n}/+${2 * n}.`),
    run: (c, s, n) => c.buff(s, 2 * n, 2 * n) },
  { id: 'tortoise', name: 'Tortoise', tier: 4, a: 2, h: 6, on: 'startBattle', text: lines((n) => `Start of battle: give Shell to the ${n === 1 ? 'front-most friend' : `${n} front-most friends`}.`),
    run: (c, s, n) => { for (const f of c.friends(s).slice(0, n)) c.status(f, 'shell'); } },
  { id: 'crow', name: 'Crow', tier: 4, a: 4, h: 4, on: 'friendFaints', text: lines((n) => `Friend faints: gain +${n}/+${n}.`),
    run: (c, s, n) => c.buff(s, n, n) },
  { id: 'skunk', name: 'Skunk', tier: 4, a: 3, h: 5, on: 'startBattle', text: lines((n) => `Start of battle: take ${Math.round(PCT[n] * 100)}% of the healthiest enemy's health.`),
    run: (c, s, n) => { const e = most(c.enemies(s), (u) => u.h); if (e) c.buff(e, 0, -Math.min(Math.floor(e.h * PCT[n]), e.h - 1)); } },
  { id: 'raccoon', name: 'Raccoon', tier: 4, a: 4, h: 4, on: 'startBattle', text: lines((n) => `Start of battle: take ${2 * n} attack from the enemy front and gain it.`),
    run: (c, s, n) => { const e = c.enemies(s)[0]; if (!e) return; const t = Math.min(2 * n, e.a); c.buff(e, -t, 0); c.buff(s, t, 0); } },
  { id: 'hare', name: 'Hare', tier: 4, a: 4, h: 3, on: 'startBattle', text: lines((n) => `Start of battle: deal ${50 * n}% of its attack to the enemy with the least health.`),
    run: (c, s, n) => { const e = most(c.enemies(s), (u) => -u.h); if (e) c.damage(e, Math.floor((s.a + s.tmpA) * n * 0.5)); } },
  // Tier 5
  { id: 'boar', name: 'Boar', tier: 5, a: 6, h: 6, on: 'beforeAttack', text: lines((n) => `Before attack: gain +${2 * n} attack.`),
    run: (c, s, n) => c.buff(s, 2 * n, 0) },
  { id: 'bear', name: 'Bear', tier: 5, a: 5, h: 8, on: 'startBattle', text: lines((n) => `Start of battle: give the friends ahead and behind +${3 * n} health.`),
    run: (c, s, n) => { for (const f of [c.ahead(s), c.behind(s)]) if (f) c.buff(f, 0, 3 * n); } },
  { id: 'stag', name: 'Stag', tier: 5, a: 6, h: 5, on: 'faint', text: lines((n) => `Faint: summon a ${4 * n}/${4 * n} Fawn in its place.`),
    run: (c, s, n) => c.summon(s, 'fawn', 4 * n, 4 * n) },
  { id: 'duchess', name: 'The Duchess', tier: 5, a: 3, h: 6, on: 'endTurn', text: lines((n) => `End turn: give every friend +${n}/+${n}.`),
    run: (c, s, n) => { for (const f of c.friends(s)) c.buff(f, n, n); } },
  { id: 'hawk', name: 'Hawk', tier: 5, a: 5, h: 5, on: 'startBattle', text: lines((n) => `Start of battle: deal ${5 * n} damage to the enemy with the most attack.`),
    run: (c, s, n) => { const e = most(c.enemies(s), (u) => u.a + u.tmpA); if (e) c.damage(e, 5 * n); } },
  { id: 'goose', name: 'Goose', tier: 5, a: 5, h: 7, on: 'hurt', text: lines((n) => `Hurt: give all friends +${n} attack.`),
    run: (c, s, n) => { for (const f of c.friends(s)) c.buff(f, n, 0); } },
];

export const UNITS = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<UnitId, UnitDef>;
export const UNIT_IDS = defs.map((d) => d.id);
export const TOKENS: Record<TokenId, { name: string }> = { mouselet: { name: 'Mouselet' }, log: { name: 'Log Dam' }, fawn: { name: 'Fawn' } };
export const isUnitId = (id: string): id is UnitId => id in UNITS;
export const isTokenId = (id: string): id is TokenId => id in TOKENS;

export const SNACKS: Record<SnackId, { id: SnackId; name: string; tier: Tier; text: string }> = {
  apple: { id: 'apple', name: 'Apple', tier: 1, text: '+1/+1.' },
  raisin: { id: 'raisin', name: 'Raisin', tier: 1, text: '+3 attack for the next fight only.' },
  honey: { id: 'honey', name: 'Honey', tier: 2, text: 'Shell: the next hit it takes deals 1.' },
  hay: { id: 'hay', name: 'Hay Bundle', tier: 2, text: '+1/+1 to two random friends.' },
  mint: { id: 'mint', name: 'Mint Leaf', tier: 3, text: 'Mint: every hit it takes deals 1 less.' },
  chilli: { id: 'chilli', name: 'Chilli', tier: 3, text: 'Chilli: its attacks also deal 2 to the enemy behind.' },
  seed: { id: 'seed', name: 'Sunflower Seed', tier: 4, text: '+1 experience.' },
  cake: { id: 'cake', name: 'Acorn Cake', tier: 5, text: '+3/+3.' },
};
export const SNACK_IDS = Object.keys(SNACKS) as SnackId[];

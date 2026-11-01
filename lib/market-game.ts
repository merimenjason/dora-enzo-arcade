// Night Market: the rules. Dora and Enzo run a little stall at the riverside Night Market for one moon month (28
// nights in 4 weeks). At dusk they buy wares from the suppliers that are open, at prices that shift with the season
// and with the market's rumours; they set out the stall (three wares at the front catch the eye, matching sets sell
// together) and light lanterns to draw a crowd. By lantern light the customers come one at a time. Each wants one
// ware, has a hidden top price, and shows tells (posture, ears, tail, how long they look, the weight of their purse,
// whether they have come back) that hint at it. The player names a price on a dial; the customer buys, counters or
// walks away, in the consistent way of their kind. Fair deals build reputation and reputation brings a bigger crowd;
// pushing too hard sours the regulars. Each week has an event and a request, up to three lanterns a week, and the
// month ends at the lantern festival, where the savings buy the lantern boat (or don't, yet).
//
// Deterministic and seeded: every random draw comes from the generator state kept in the game state, so a seed and
// the same choices replay a month exactly. No DOM, no wall clock, no Math.random.

export type ItemId = 'cup' | 'teapot' | 'scarf' | 'cloth' | 'tea' | 'moontea' | 'top' | 'lantern' | 'fish' | 'pearl';
export type SupplierId = 'potter' | 'weaver' | 'grower' | 'carver' | 'fisher';
export type SetId = 'teaset' | 'festival' | 'finery';
export type Persona = 'thrifty' | 'impulsive' | 'collector' | 'hurry' | 'regular' | 'poet';
export type Species = 'badger' | 'tanuki' | 'crane' | 'rabbit' | 'otter' | 'heron' | 'fox';
export type EventId = 'rain' | 'poets' | 'tax' | 'festival';
export type Mode = 'moon' | 'free';
export type Phase = 'dusk' | 'night' | 'dawn' | 'end';

export interface ItemDef { id: ItemId; name: string; plural: string; supplier: SupplierId; base: number; set: SetId | null }
export const ITEMS: Record<ItemId, ItemDef> = {
  cup: { id: 'cup', name: 'Teacup', plural: 'teacups', supplier: 'potter', base: 6, set: 'teaset' },
  teapot: { id: 'teapot', name: 'Teapot', plural: 'teapots', supplier: 'potter', base: 16, set: 'teaset' },
  scarf: { id: 'scarf', name: 'Silk scarf', plural: 'silk scarves', supplier: 'weaver', base: 13, set: 'finery' },
  cloth: { id: 'cloth', name: 'Wrapping cloth', plural: 'wrapping cloths', supplier: 'weaver', base: 8, set: null },
  tea: { id: 'tea', name: 'Green tea', plural: 'tins of green tea', supplier: 'grower', base: 7, set: null },
  moontea: { id: 'moontea', name: 'Moon tea', plural: 'tins of moon tea', supplier: 'grower', base: 15, set: null },
  top: { id: 'top', name: 'Spinning top', plural: 'spinning tops', supplier: 'carver', base: 5, set: 'festival' },
  lantern: { id: 'lantern', name: 'Paper lantern', plural: 'paper lanterns', supplier: 'carver', base: 9, set: 'festival' },
  fish: { id: 'fish', name: 'Dried fish', plural: 'dried fish', supplier: 'fisher', base: 4, set: null },
  pearl: { id: 'pearl', name: 'River pearl', plural: 'river pearls', supplier: 'fisher', base: 26, set: 'finery' },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const SETS: Record<SetId, { id: SetId; name: string; items: [ItemId, ItemId] }> = {
  teaset: { id: 'teaset', name: 'Tea set', items: ['teapot', 'cup'] },
  festival: { id: 'festival', name: 'Festival pair', items: ['lantern', 'top'] },
  finery: { id: 'finery', name: 'River finery', items: ['scarf', 'pearl'] },
};
export interface SupplierDef { id: SupplierId; name: string; who: string; items: [ItemId, ItemId]; hello: string }
export const SUPPLIERS: Record<SupplierId, SupplierDef> = {
  potter: { id: 'potter', name: 'The potter', who: 'Old Umeko, the potter', items: ['cup', 'teapot'], hello: 'Fresh from the kiln, still warm.' },
  weaver: { id: 'weaver', name: 'The weaver', who: 'Shige, the weaver', items: ['scarf', 'cloth'], hello: 'Woven by moonlight, every thread.' },
  grower: { id: 'grower', name: 'The tea grower', who: 'Aunt Chiyo, the tea grower', items: ['tea', 'moontea'], hello: 'Smell that. First picking.' },
  carver: { id: 'carver', name: 'The toy carver', who: 'Toku, the toy carver', items: ['top', 'lantern'], hello: 'Tops that hum and lanterns that glow.' },
  fisher: { id: 'fisher', name: 'The night fisher', who: 'Gen, the night fisher', items: ['fish', 'pearl'], hello: 'Dried this morning. And a pearl or two.' },
};
export const SUPPLIER_IDS = Object.keys(SUPPLIERS) as SupplierId[];

/** How each kind of customer haggles. The same kind always behaves the same way, so it can be learned. */
export interface PersonaDef {
  species: Species; label: string; note: string;
  mean: number; // top price against the going rate
  patience: number; // counters before they walk
  start: number; step: number; // their first counter and how fast it rises, against their top price
  walk: number; // an ask this far over their top price and they walk at once
  bias: { posture: number; ears: number; gaze: number; purse: number }; // how they skew the tells
  noise: number; // how loosely the tells follow the truth
}
export const PERSONAS: Record<Persona, PersonaDef> = {
  thrifty: { species: 'badger', label: 'Thrifty badger', note: 'Always haggles once, even at a fair price, and hides interest: a badger leaning in really wants it.', mean: 0.95, patience: 3, start: 0.62, step: 0.12, walk: 1.6, bias: { posture: -1, ears: -1, gaze: 0, purse: -0.6 }, noise: 0.45 },
  impulsive: { species: 'tanuki', label: 'Impulsive tanuki', note: 'Pays a little over the odds if you name it at once, but only waits for one counter. Tells are loud and honest.', mean: 1.12, patience: 1, start: 0.86, step: 0.1, walk: 1.32, bias: { posture: 0.3, ears: 0.3, gaze: 0.3, purse: 0.2 }, noise: 0.4 },
  collector: { species: 'crane', label: 'Collector crane', note: 'Pays handsomely for teapots, moon tea and pearls. Keeps a straight face, but the length of her look never lies.', mean: 1.0, patience: 2, start: 0.74, step: 0.13, walk: 1.5, bias: { posture: -0.4, ears: -0.4, gaze: 0, purse: 0.6 }, noise: 0.25 },
  hurry: { species: 'rabbit', label: 'Rabbit in a hurry', note: 'One counter, then gone. The tail always flicks (it means hurry, not keen) and the look is always short.', mean: 1.04, patience: 1, start: 0.82, step: 0.15, walk: 1.25, bias: { posture: 0, ears: 0, gaze: -1, purse: 0 }, noise: 0.4 },
  regular: { species: 'otter', label: 'Regular otter', note: 'Remembers you. Fair deals make them pay more next time; squeezing them sours them and the whole riverbank hears.', mean: 1.0, patience: 3, start: 0.8, step: 0.08, walk: 1.7, bias: { posture: 0, ears: 0, gaze: 0, purse: 0 }, noise: 0.3 },
  poet: { species: 'rabbit', label: 'Rabbit poet', note: 'Pays part in verses and leaves a tip for a fair price. Honest, dreamy tells.', mean: 1.05, patience: 2, start: 0.8, step: 0.1, walk: 1.5, bias: { posture: 0, ears: 0, gaze: 0.2, purse: -0.3 }, noise: 0.3 },
};
export const PERSONA_IDS = Object.keys(PERSONAS) as Persona[];
const COLLECTIBLE: ItemId[] = ['teapot', 'moontea', 'pearl'];

export const MOON_NIGHTS = 28;
export const FREE_NIGHTS = 7;
export const BOAT = 500; // the lantern boat's price, set from the bots' runs (tests/market-bot.mjs)
/** Weekly profit (takings less what the sold wares cost) for the first and second lantern, set from the bots' runs. */
export const WEEK_GOALS: [number, number][] = [[110, 160], [170, 250], [210, 320], [250, 380]];
export const FREE_GOALS: [number, number] = [140, 200];
export const START_PURSE = 30;
export const START_REP = 30;
export const OIL = 3; // a lit lantern's oil for one night
export const MAX_LANTERNS = 3;
export const FRONT_SLOTS = 3;

export interface Request { kind: 'set' | 'fair' | 'pearls' | 'lanterns'; need: number; text: string; who: string }
export const REQUESTS: Request[] = [
  { kind: 'set', need: 1, text: 'Sell a matching set together', who: 'Old Umeko' },
  { kind: 'fair', need: 8, text: 'Make 8 fair deals', who: 'Granny Kawa' },
  { kind: 'pearls', need: 3, text: 'Sell 3 river pearls', who: 'Gen' },
  { kind: 'lanterns', need: 6, text: 'Sell 6 paper lanterns', who: 'Toku' },
];
export const FREE_REQUEST: Request = { kind: 'fair', need: 6, text: 'Make 6 fair deals', who: 'Kiko' };

export interface Tells { posture: 'lean-in' | 'upright' | 'lean-back'; ears: 'pricked' | 'soft' | 'flat'; tail: 'flick' | 'still'; gaze: number; purse: 'heavy' | 'light'; returning: boolean }
export interface Customer {
  uid: number; persona: Persona; species: Species; name: string; want: ItemId; value: number;
  res: number; // hidden top price
  tells: Tells; round: number; offer: number | null; lastAsk: number | null; regular: number; returning: boolean;
}
export interface Unit { item: ItemId; paid: number; front: boolean; bought: number }
export interface Market { open: SupplierId[]; cost: Record<ItemId, number>; demand: Record<ItemId, number>; hot: ItemId[]; rumour: string; tip: { item: ItemId; kind: 'sell' | 'glut' }; event: EventId | null; rival: ItemId | null; story: string | null }
export interface NightLog { profit: number; sold: number; takings: number; fair: number; walked: number; sets: number; tips: number; tax: number; oil: number; repStart: number; served: number; missed: number }
export interface WeekLog { profit: number; takings: number; fair: number; sets: number; pearls: number; lanterns: number }
export interface WeekResult { week: number; takings: number; profit: number; lanterns: number; request: boolean }
export type Reply =
  | { kind: 'sold'; price: number; coins: number; verse: boolean; tip: number; set: { item: ItemId; price: number } | null; fair: boolean; pushed: boolean; line: string }
  | { kind: 'counter'; offer: number; line: string }
  | { kind: 'walk'; line: string; back: boolean }
  | { kind: 'none' };

export interface GameState {
  v: 1; mode: Mode; seed: number; rng: number; night: number; nights: number; phase: Phase;
  purse: number; rep: number; stock: Unit[]; cart: number; lanterns: number;
  market: Market; queue: number; back: { at: number; c: Customer }[]; customer: Customer | null; uid: number;
  tonight: NightLog; week: WeekLog; weeks: WeekResult[]; friends: number[]; seen: Persona[]; wordOfMouth: number;
  lastRumour: ItemId | null; spent: number; boat: boolean;
}

// ---- random numbers: mulberry32 with its state in the game state
function next(s: GameState) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(s: GameState, a: readonly T[]) => a[Math.floor(next(s) * a.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A roughly bell-shaped draw in -1..1. */
const wobble = (s: GameState) => (next(s) + next(s) + next(s)) / 1.5 - 1;

export const REGULARS = ['Granny Kawa', 'Mo', 'Little Suzu'];
const NAMES: Record<Persona, string[]> = {
  thrifty: ['Mr Hatch', 'Old Brindle', 'Aunt Moss', 'Grumbo'],
  impulsive: ['Pon', 'Ponta', 'Big Bun', 'Dango'],
  collector: ['Lady Tsuru', 'Madam Hana', 'Lady Shiro'],
  hurry: ['Dash', 'Quill', 'Skip', 'Pip'],
  regular: REGULARS,
  poet: ['Basho-bun', 'Little Haiku', 'Moonquill'],
};

// ---- the calendar
export const weekOf = (night: number) => Math.floor((night - 1) / 7);
export function eventFor(mode: Mode, night: number, seed: number): EventId | null {
  if (mode === 'moon') return night === 5 ? 'rain' : night === 12 ? 'poets' : night === 19 ? 'tax' : night === 28 ? 'festival' : null;
  if (night === FREE_NIGHTS) return 'festival';
  return night === 2 + (seed % 3) ? (seed % 2 ? 'rain' : 'poets') : null;
}
export const EVENTS: Record<EventId, { name: string; text: string }> = {
  rain: { name: 'Rain night', text: 'Rain on the river. Fewer folk, but scarves and wrapping cloths fly off the stall.' },
  poets: { name: "Poets' night", text: 'The rabbit poets gather on the bridge. They pay part in verses and tip a fair seller.' },
  tax: { name: 'The tax heron', text: 'The heron with the ledger comes for the market fee: a tenth of the purse, halved for a stall in good standing.' },
  festival: { name: 'Lantern festival', text: 'The whole riverbank turns out. Paper lanterns and tops sell like never before.' },
};
// how the season moves demand (what sells) and supply (what the suppliers charge), week by week
const SEASON: { demand: Partial<Record<ItemId, number>>; cost: Partial<Record<ItemId, number>>; hint: string }[] = [
  { demand: { tea: 1.25, fish: 1.15, cup: 1.1 }, cost: { tea: 0.8 }, hint: 'Harvest moon rising: new tea is cheap and everyone wants a cup of it.' },
  { demand: { scarf: 1.25, cloth: 1.15, moontea: 1.1 }, cost: { fish: 0.85 }, hint: 'Cold nights coming: scarves and cloths are in demand.' },
  { demand: { pearl: 1.2, teapot: 1.15, moontea: 1.15 }, cost: { cup: 0.85, top: 0.85 }, hint: 'The collectors are out: pearls, teapots and moon tea.' },
  { demand: { lantern: 1.4, top: 1.25, cup: 1.05 }, cost: { lantern: 1.15 }, hint: 'The festival is near: paper lanterns and tops will sell.' },
];
const STORY: Record<number, string> = {
  1: 'Granny Kawa the otter: “A new stall! Read your customers, dears. Watch their ears and how long they look.”',
  3: 'Enzo whispers: “Notice the badgers? They always pretend not to care.”',
  5: 'Rain drums on the awning. Dora rigs a cloth over the wares.',
  8: 'A new stall opens across the lane: Kiko the fox, waving cheerfully. “May the best stall win!” Shige the weaver lends you a bigger cart.',
  10: 'Kiko calls across: “Teacups are so last moon!” Dora sticks out her tongue.',
  12: 'Poets on the bridge, reciting to the moon. Keep a pocket for verses.',
  15: 'Toku the toy carver: “Festival lanterns, two weeks off. Mark my words.”',
  19: 'Tap, tap. The heron with the ledger is here.',
  22: 'Kiko trots over: “Truce for festival week? I’ll send you my overflow.” A friend now, and her cousin lends a bigger cart.',
  25: 'The boat builder waves from the jetty: “Your lantern boat is nearly ready!”',
  28: 'The lantern festival. Every lantern on the river is lit.',
};
export const moonPhase = (night: number) => ((night - 1) % 28) / 28; // 0 new, 0.5 full

export function cartSize(mode: Mode, night: number) { return mode === 'free' ? 10 : night >= 22 ? 12 : night >= 8 ? 10 : 8; }
export function requestFor(s: GameState): Request { return s.mode === 'free' ? FREE_REQUEST : REQUESTS[clamp(weekOf(s.night), 0, 3)]; }
export function goalsFor(s: GameState): [number, number] { return s.mode === 'free' ? FREE_GOALS : WEEK_GOALS[clamp(weekOf(s.night), 0, 3)]; }

// ---- a new month
const blankNight = (rep: number): NightLog => ({ profit: 0, sold: 0, takings: 0, fair: 0, walked: 0, sets: 0, tips: 0, tax: 0, oil: 0, repStart: rep, served: 0, missed: 0 });
const blankWeek = (): WeekLog => ({ profit: 0, takings: 0, fair: 0, sets: 0, pearls: 0, lanterns: 0 });
export function newGame(seed: number, mode: Mode = 'moon'): GameState {
  const sd = (Math.floor(Math.abs(seed)) % 1000000007) >>> 0;
  const s: GameState = {
    v: 1, mode, seed: sd, rng: (sd * 2654435761) >>> 0, night: 1, nights: mode === 'moon' ? MOON_NIGHTS : FREE_NIGHTS, phase: 'dusk',
    purse: START_PURSE, rep: START_REP, stock: [], cart: cartSize(mode, 1), lanterns: 0,
    market: null as unknown as Market, queue: 0, back: [], customer: null, uid: 0,
    tonight: blankNight(START_REP), week: blankWeek(), weeks: [], friends: [0, 0, 0], seen: [], wordOfMouth: 0,
    lastRumour: null, spent: 0, boat: false,
  };
  s.market = makeMarket(s);
  return s;
}

/** Tonight's market: which suppliers are open, their prices, what is in demand, the rumour, the event and the rival. */
function makeMarket(s: GameState): Market {
  const w = clamp(weekOf(s.night), 0, 3);
  const season = SEASON[s.mode === 'free' ? (s.seed + s.night) % 4 : w];
  const event = eventFor(s.mode, s.night, s.seed);
  // three or four suppliers open; never shut the same one two nights running if it can be helped
  const order = [...SUPPLIER_IDS];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(next(s) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const open = order.slice(0, next(s) < 0.5 ? 3 : 4).sort((a, b) => SUPPLIER_IDS.indexOf(a) - SUPPLIER_IDS.indexOf(b));
  const demand = {} as Record<ItemId, number>, cost = {} as Record<ItemId, number>;
  for (const id of ITEM_IDS) {
    demand[id] = (season.demand[id] ?? 1) * (1 + 0.06 * wobble(s));
    cost[id] = Math.max(1, Math.round(ITEMS[id].base * 0.62 * (season.cost[id] ?? 1) * (1 + 0.1 * wobble(s))));
  }
  // the rumour: a ware that will sell, or a supplier with a glut
  const sellable = ITEM_IDS.filter((id) => id !== s.lastRumour && open.includes(ITEMS[id].supplier));
  const rid = pick(s, sellable.length ? sellable : ITEM_IDS);
  const glut = next(s) < 0.35;
  let rumour: string;
  if (glut) { cost[rid] = Math.max(1, Math.round(cost[rid] * 0.7)); rumour = `${SUPPLIERS[ITEMS[rid].supplier].who.split(',')[0]} has too many ${ITEMS[rid].plural} and is selling them cheap tonight.`; }
  else { demand[rid] *= 1.35; rumour = `Word on the bridge: ${ITEMS[rid].plural} will sell tonight.`; }
  s.lastRumour = rid;
  if (event === 'rain') { demand.scarf *= 1.5; demand.cloth *= 1.5; }
  if (event === 'festival') { demand.lantern *= 1.6; demand.top *= 1.3; }
  let rival: ItemId | null = null;
  const rivalOn = s.mode === 'moon' ? s.night >= 8 && s.night <= 21 : s.night >= 2 && s.night < FREE_NIGHTS;
  if (rivalOn) { rival = pick(s, ITEM_IDS.filter((id) => id !== rid)); demand[rival] *= 0.75; }
  const hot = ITEM_IDS.filter((id) => demand[id] >= 1.15);
  const story = s.mode === 'moon' ? STORY[s.night] ?? null : s.night === 1 ? 'Free market: one week, your own seed, no boat to save for. How much can the stall take?' : null;
  return { open, cost, demand, hot, tip: { item: rid, kind: glut ? 'glut' : 'sell' }, rumour: (s.mode === 'free' || s.night > 1 ? '' : season.hint + ' ') + rumour, event, rival, story };
}
export const seasonHint = (s: GameState) => SEASON[s.mode === 'free' ? (s.seed + s.night) % 4 : clamp(weekOf(s.night), 0, 3)].hint;

// ---- dusk: buying and setting out the stall
export const goingRate = (s: GameState, id: ItemId) => Math.max(1, Math.round(ITEMS[id].base * s.market.demand[id]));
export function canBuy(s: GameState, id: ItemId) {
  return s.phase === 'dusk' && s.market.open.includes(ITEMS[id].supplier) && s.purse >= s.market.cost[id] && s.stock.length < s.cart;
}
export function buy(s: GameState, id: ItemId) {
  if (!canBuy(s, id)) return false;
  s.purse -= s.market.cost[id]; s.spent += s.market.cost[id];
  const front = s.stock.filter((u) => u.front).length < FRONT_SLOTS && !s.stock.some((u) => u.item === id && u.front);
  s.stock.push({ item: id, paid: s.market.cost[id], front, bought: s.night });
  return true;
}
/** Puts back a ware bought this dusk, for what was paid. */
export function unbuy(s: GameState, id: ItemId) {
  if (s.phase !== 'dusk') return false;
  let i = -1;
  for (let k = s.stock.length - 1; k >= 0; k--) if (s.stock[k].item === id && s.stock[k].bought === s.night) { i = k; break; }
  if (i < 0) return false;
  const [u] = s.stock.splice(i, 1); s.purse += u.paid; s.spent -= u.paid;
  return true;
}
export const frontItems = (s: GameState) => [...new Set(s.stock.filter((u) => u.front).map((u) => u.item))];
/** Puts a ware at the front of the stall (or takes it off the front). At most three different wares at the front. */
export function setFront(s: GameState, id: ItemId, on: boolean) {
  if (s.phase !== 'dusk') return false;
  const units = s.stock.filter((u) => u.item === id);
  if (!units.length) return false;
  if (on && !units.some((u) => u.front) && frontItems(s).length >= FRONT_SLOTS) return false;
  units.forEach((u, i) => { u.front = on && i === 0; });
  return true;
}
export function setLanterns(s: GameState, n: number) { if (s.phase !== 'dusk') return false; s.lanterns = clamp(Math.round(n), 0, MAX_LANTERNS); return true; }
/** How many customers tonight: the base crowd, lanterns, reputation, word of mouth, events and the friendly fox. */
export function crowd(s: GameState) {
  const ev = s.market.event;
  let n = 2 + s.lanterns + Math.floor(s.rep / 34) + s.wordOfMouth;
  if (ev === 'rain') n -= 2; if (ev === 'poets') n += 1; if (ev === 'festival') n += 4;
  if (s.mode === 'moon' && s.night >= 22) n += 1;
  return clamp(n, 2, 14);
}

// ---- night: the customers
export function openStall(s: GameState) {
  if (s.phase !== 'dusk') return false;
  s.phase = 'night';
  s.tonight = blankNight(s.rep);
  const oil = s.lanterns * OIL; s.purse -= Math.min(oil, s.purse); s.tonight.oil = oil;
  if (s.market.event === 'tax') {
    const fee = Math.round(s.purse * 0.1 * (s.rep >= 60 ? 0.5 : 1));
    s.purse -= fee; s.tonight.tax = fee;
  }
  s.queue = crowd(s); s.back = []; s.customer = null;
  return true;
}
/** What a customer has come for: a ware in demand that suits their kind. If the stall doesn't have it, they may
 * settle for something at the front (a little less keen), or shrug and move on. */
function wantOf(s: GameState, persona: Persona): { item: ItemId; settle: boolean } | null {
  const front = frontItems(s), have = new Set(s.stock.map((u) => u.item));
  const sets = Object.values(SETS).filter((st) => st.items.every((i) => front.includes(i)));
  const w = ITEM_IDS.map((id) => {
    let v = s.market.demand[id] * affinity(persona, id);
    if (front.includes(id)) v *= 2;
    if (sets.some((st) => st.items.includes(id))) v *= 1.3;
    return v;
  });
  let r = next(s) * w.reduce((a, b) => a + b, 0), id: ItemId = ITEM_IDS[ITEM_IDS.length - 1];
  for (let i = 0; i < ITEM_IDS.length; i++) { r -= w[i]; if (r <= 0) { id = ITEM_IDS[i]; break; } }
  if (have.has(id)) return { item: id, settle: false };
  if (front.length && next(s) < 0.55) return { item: pick(s, front), settle: true };
  return null;
}
export function affinity(persona: Persona, id: ItemId) {
  const b = ITEMS[id].base;
  switch (persona) {
    case 'thrifty': return b <= 8 ? 1.8 : b >= 15 ? 0.45 : 1;
    case 'collector': return COLLECTIBLE.includes(id) ? 3 : 0.6;
    case 'poet': return id === 'tea' || id === 'moontea' || id === 'lantern' ? 2.2 : 0.8;
    case 'impulsive': return id === 'top' || id === 'lantern' || id === 'scarf' ? 1.5 : 1;
    case 'hurry': return id === 'fish' || id === 'tea' || id === 'cup' ? 1.6 : 0.9;
    default: return 1;
  }
}
function personaFor(s: GameState): Persona {
  if (s.market.event === 'poets' && next(s) < 0.5) return 'poet';
  const reg = 0.6 + s.rep / 50 + s.friends.reduce((a, b) => a + Math.max(0, b), 0) * 0.15;
  const w: [Persona, number][] = [['thrifty', 1.2], ['impulsive', 1], ['collector', 0.7], ['hurry', 0.9], ['regular', reg]];
  let r = next(s) * w.reduce((a, [, v]) => a + v, 0);
  for (const [p, v] of w) { r -= v; if (r <= 0) return p; }
  return 'thrifty';
}
/** The tells that hint at a customer's top price, skewed in each kind's consistent way. */
export function makeTells(s: GameState, persona: Persona, ratio: number, returning: boolean): Tells {
  const d = PERSONAS[persona], z = (ratio - 1) / 0.18;
  const n = () => wobble(s) * d.noise * 2;
  const p = z + d.bias.posture + n(), e = z + d.bias.ears + n(), g = z + d.bias.gaze + n(), u = z + d.bias.purse + n();
  return {
    posture: p > 0.7 ? 'lean-in' : p < -0.7 ? 'lean-back' : 'upright',
    ears: e > 0.7 ? 'pricked' : e < -0.7 ? 'flat' : 'soft',
    tail: persona === 'hurry' || (persona === 'impulsive' && z > 0.6) ? 'flick' : 'still',
    gaze: persona === 'hurry' ? 1 : clamp(Math.round(g / 1.1 + 2.3), 1, 4),
    purse: u > 0 ? 'heavy' : 'light',
    returning,
  };
}
/** Reads the tells back into a guess at the top price against the going rate (what a sharp eye could work out). */
export function readTells(t: Tells, persona: Persona) {
  const d = PERSONAS[persona];
  const lvl = (v: string, hi: string, lo: string) => (v === hi ? 1.25 : v === lo ? -1.25 : 0);
  const parts: number[] = [lvl(t.posture, 'lean-in', 'lean-back') - d.bias.posture, lvl(t.ears, 'pricked', 'flat') - d.bias.ears, (t.purse === 'heavy' ? 0.7 : -0.7) - d.bias.purse];
  const gz = (t.gaze - 2.3) * 1.1 - d.bias.gaze;
  if (persona !== 'hurry') parts.push(gz, gz); // a long look counts double, except for a rabbit in a hurry
  let z = parts.reduce((a, b) => a + b, 0) / parts.length;
  if (persona === 'collector') z = z * 0.4 + gz * 0.6;
  if (t.returning) z += 0.5;
  return 1 + clamp(z, -2, 3.5) * 0.18;
}
/** Dora's guess at the top price, in coins. */
export const hunch = (c: Customer) => Math.round(c.value * readTells(c.tells, c.persona));

/** Calls up the next customer, or returns null when the night is over. */
export function nextCustomer(s: GameState): Customer | null {
  if (s.phase !== 'night') return null;
  s.customer = null;
  // someone who walked away earlier may come back
  const bi = s.back.findIndex((b) => b.at >= s.queue);
  if (bi >= 0) {
    const { c } = s.back.splice(bi, 1)[0];
    if (s.stock.some((u) => u.item === c.want)) { c.round = 0; c.offer = null; c.lastAsk = null; s.customer = c; s.tonight.served++; return c; }
  }
  while (s.queue > 0) {
    s.queue--;
    const persona = personaFor(s);
    const got = wantOf(s, persona);
    if (!got) { s.tonight.missed++; continue; }
    const want = got.item;
    const d = PERSONAS[persona];
    const value = goingRate(s, want);
    let mean = d.mean;
    if (persona === 'collector' && COLLECTIBLE.includes(want)) mean = 1.32;
    if (got.settle) mean *= 0.88;
    let regular = -1, name = pick(s, NAMES[persona]);
    if (persona === 'regular') { regular = Math.floor(next(s) * REGULARS.length); name = REGULARS[regular]; mean += 0.05 * s.friends[regular]; }
    const ratio = clamp(mean * (1 + 0.17 * wobble(s)), 0.6, 1.9);
    const c: Customer = { uid: ++s.uid, persona, species: d.species, name, want, value, res: value * ratio, tells: makeTells(s, persona, ratio, false), round: 0, offer: null, lastAsk: null, regular, returning: false };
    if (!s.seen.includes(persona)) s.seen.push(persona);
    s.customer = c; s.tonight.served++;
    return c;
  }
  // nobody left in the line: anyone still waiting to come back comes now
  if (s.back.length) { s.back.forEach((b) => { b.at = s.queue; }); return nextCustomer(s); }
  return null;
}
export const askRange = (c: Customer): [number, number] => [1, Math.max(4, Math.round(c.value * 2.5))];

const LINES = {
  sold: ['“Done! I’ll take it.”', '“A fair price. Wrap it up!”', '“Lovely. Here you are.”'],
  pushed: ['“Hm. Fine. But you drive a hard bargain.”', '“That’s steep… all right.”'],
  counter: ['“Too rich for me. How about {o}?”', '“I could do {o}.”', '“{o}, and not a coin more… for now.”'],
  walk: ['“Pah! Not at that price.”', '“I’ll look elsewhere.”', '“Goodness, no.”'],
  hurry: ['“No time! Bye!”'],
};
function sell(s: GameState, c: Customer, price: number): Reply {
  const i = s.stock.findIndex((u) => u.item === c.want && u.front) >= 0 ? s.stock.findIndex((u) => u.item === c.want && u.front) : s.stock.findIndex((u) => u.item === c.want);
  const [unit] = s.stock.splice(i, 1);
  if (unit.front) { const other = s.stock.find((u) => u.item === c.want); if (other) other.front = true; }
  const f = price / c.res, fair = f <= 0.92, pushed = f > 0.97;
  let coins = price, tip = 0; const verse = c.persona === 'poet';
  if (verse) { coins = Math.round(price * 0.7); tip = fair ? Math.round(price * 0.45) : 0; }
  s.purse += coins + tip;
  let rep = fair ? 1 : 0;
  if (c.persona === 'regular') {
    if (fair) { s.friends[c.regular] = clamp(s.friends[c.regular] + 1, -3, 5); rep = 2; }
    else if (pushed) { s.friends[c.regular] = clamp(s.friends[c.regular] - 1, -3, 5); rep = -2; }
  }
  if (verse && fair) rep += 1;
  // a matching set at the front of the stall: a happy customer takes the other half too
  let set: { item: ItemId; price: number } | null = null;
  const st = ITEMS[c.want].set;
  if (st && c.persona !== 'hurry' && f <= 0.97) {
    const mate = SETS[st].items.find((x) => x !== c.want)!;
    const mi = s.stock.findIndex((u) => u.item === mate && u.front);
    if (mi >= 0) {
      const [mu] = s.stock.splice(mi, 1); const other = s.stock.find((u) => u.item === mate); if (other) other.front = true;
      set = { item: mate, price: goingRate(s, mate) };
      s.week.profit += set.price - mu.paid; s.tonight.profit += set.price - mu.paid;
      s.purse += set.price; s.tonight.sets++; s.week.sets++; s.tonight.sold++; s.tonight.takings += set.price; s.week.takings += set.price;
      if (mate === 'pearl') s.week.pearls++; if (mate === 'lantern') s.week.lanterns++;
    }
  }
  s.rep = clamp(s.rep + rep, 0, 100);
  s.tonight.sold++; s.tonight.takings += coins + tip; s.week.takings += coins + tip;
  s.tonight.profit += coins + tip - unit.paid; s.week.profit += coins + tip - unit.paid; s.tonight.tips += tip;
  if (fair) { s.tonight.fair++; s.week.fair++; }
  if (c.want === 'pearl') s.week.pearls++; if (c.want === 'lantern') s.week.lanterns++;
  s.customer = null;
  const line = verse ? (fair ? '“For you, a verse — and a little something.”' : '“A verse for your trouble.”') : pushed ? pick(s, LINES.pushed) : pick(s, LINES.sold);
  return { kind: 'sold', price, coins, verse, tip, set, fair, pushed, line };
}
function walk(s: GameState, c: Customer): Reply {
  s.tonight.walked++;
  let rep = -2;
  if (c.persona === 'regular') { rep = -3; s.friends[c.regular] = clamp(s.friends[c.regular] - 1, -3, 5); }
  s.rep = clamp(s.rep + rep, 0, 100);
  // the keen ones may come back later, a little keener
  let back = false;
  if (!c.returning && c.persona !== 'hurry' && c.res >= c.value && next(s) < 0.5) {
    const r = c.res * 1.08 / c.value;
    const again: Customer = { ...c, res: c.res * 1.08, returning: true, tells: makeTells(s, c.persona, r, true) };
    s.back.push({ at: Math.max(0, s.queue - 2), c: again }); back = true;
  }
  s.customer = null;
  return { kind: 'walk', line: c.persona === 'hurry' ? LINES.hurry[0] : pick(s, LINES.walk), back };
}
/** The player names a price. The customer buys, counters or walks away, in their kind's consistent way. */
export function ask(s: GameState, price: number): Reply {
  const c = s.customer;
  if (s.phase !== 'night' || !c) return { kind: 'none' };
  const [lo, hi] = askRange(c);
  price = clamp(Math.round(price), lo, hi);
  const d = PERSONAS[c.persona];
  c.round++;
  const R = c.res;
  if (c.persona === 'impulsive' && c.round === 1 && price <= R * 1.08) return sell(s, c, price);
  if (c.persona === 'thrifty' && c.round === 1 && price > R * 0.8 && price <= R) return counter(s, c, Math.max(1, Math.floor(R * 0.8)), price);
  if (price <= R) return sell(s, c, price);
  if (price > R * d.walk || c.round > d.patience) return walk(s, c);
  const offer = Math.max((c.offer ?? 0) + 1, Math.floor(R * Math.min(1, d.start + (c.round - 1) * d.step)));
  return counter(s, c, Math.min(offer, Math.floor(R)), price);
}
function counter(s: GameState, c: Customer, offer: number, price: number): Reply {
  c.offer = Math.max(1, Math.min(offer, price - 1)); c.lastAsk = price;
  return { kind: 'counter', offer: c.offer, line: pick(s, LINES.counter).replace('{o}', String(c.offer)) };
}
/** Takes the customer's counter-offer. */
export function takeOffer(s: GameState): Reply {
  const c = s.customer;
  if (s.phase !== 'night' || !c || c.offer === null) return { kind: 'none' };
  return sell(s, c, c.offer);
}
/** Lets the customer go politely, with no sale and no hard feelings. */
export function letGo(s: GameState) { if (s.phase !== 'night' || !s.customer) return false; s.customer = null; return true; }

// ---- dawn: the night's tally, the week's lanterns, and the next dusk
export interface Dawn { night: NightLog; week: WeekResult | null; rep: number; ended: boolean }
export function closeStall(s: GameState): Dawn | null {
  if (s.phase !== 'night') return null;
  s.customer = null; s.queue = 0; s.back = [];
  s.phase = 'dawn';
  s.wordOfMouth = Math.min(1, Math.floor(s.tonight.fair / 4));
  s.rep = clamp(s.rep - 2, 0, 100); // the riverbank forgets a little every night
  let week: WeekResult | null = null;
  const weekEnd = s.mode === 'free' ? s.night === s.nights : s.night % 7 === 0;
  if (weekEnd) {
    const [a, b] = goalsFor(s), rq = requestFor(s);
    const have = rq.kind === 'set' ? s.week.sets : rq.kind === 'fair' ? s.week.fair : rq.kind === 'pearls' ? s.week.pearls : s.week.lanterns;
    const request = have >= rq.need;
    week = { week: s.mode === 'free' ? 0 : weekOf(s.night), takings: s.week.takings, profit: s.week.profit, lanterns: (s.week.profit >= a ? 1 : 0) + (s.week.profit >= b ? 1 : 0) + (request ? 1 : 0), request };
    s.weeks.push(week);
  }
  const ended = s.night >= s.nights;
  if (ended) { s.phase = 'end'; s.boat = s.mode === 'moon' && s.purse >= BOAT; }
  return { night: { ...s.tonight }, week, rep: s.rep, ended };
}
/** Progress on this week's request. */
export function requestProgress(s: GameState) {
  const rq = requestFor(s);
  const have = rq.kind === 'set' ? s.week.sets : rq.kind === 'fair' ? s.week.fair : rq.kind === 'pearls' ? s.week.pearls : s.week.lanterns;
  return { ...rq, have: Math.min(have, rq.need) };
}
export function nextDusk(s: GameState) {
  if (s.phase !== 'dawn') return false;
  if (s.mode === 'free' ? false : s.night % 7 === 0) s.week = blankWeek();
  s.night++; s.phase = 'dusk'; s.lanterns = Math.min(s.lanterns, MAX_LANTERNS);
  s.cart = Math.max(cartSize(s.mode, s.night), s.cart);
  s.market = makeMarket(s);
  return true;
}
export const totalLanterns = (s: GameState) => s.weeks.reduce((a, w) => a + w.lanterns, 0);
export const stockValue = (s: GameState) => s.stock.reduce((a, u) => a + u.paid, 0);

// ---- saving: a month in progress plus the best results, defensive against anything odd in storage
export interface Save { v: 1; run: GameState | null; best: { lanterns: number; boat: boolean; free: number; months: number }; tutorial: boolean; settings: { sound: boolean; music: boolean } }
export const SAVE_KEY = 'night-market-v1';
export const blankSave = (): Save => ({ v: 1, run: null, best: { lanterns: 0, boat: false, free: 0, months: 0 }, tutorial: false, settings: { sound: true, music: true } });
const isNum = (v: unknown, lo = -Infinity, hi = Infinity): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function validItemMap(m: unknown, lo: number, hi: number) { return isRec(m) && ITEM_IDS.every((id) => isNum(m[id], lo, hi)); }
function validTells(t: unknown) {
  return isRec(t) && ['lean-in', 'upright', 'lean-back'].includes(t.posture as string) && ['pricked', 'soft', 'flat'].includes(t.ears as string)
    && ['flick', 'still'].includes(t.tail as string) && isNum(t.gaze, 1, 4) && ['heavy', 'light'].includes(t.purse as string) && typeof t.returning === 'boolean';
}
function validCustomer(c: unknown) {
  return isRec(c) && PERSONA_IDS.includes(c.persona as Persona) && ITEM_IDS.includes(c.want as ItemId) && isNum(c.value, 1, 1000) && isNum(c.res, 0, 5000)
    && isNum(c.round, 0, 20) && (c.offer === null || isNum(c.offer, 0, 5000)) && isNum(c.regular, -1, 2) && validTells(c.tells) && typeof c.name === 'string';
}
/** Checks a stored month thoroughly; anything off and it is ignored rather than misread. */
export function validRun(o: unknown): o is GameState {
  if (!isRec(o) || o.v !== 1 || (o.mode !== 'moon' && o.mode !== 'free')) return false;
  if (!isNum(o.seed, 0) || !isNum(o.rng, 0, 4294967295) || !isNum(o.nights, 1, 28) || !isNum(o.night, 1, o.nights as number)) return false;
  if (!['dusk', 'night', 'dawn', 'end'].includes(o.phase as string) || !isNum(o.purse, 0, 1e7) || !isNum(o.rep, 0, 100) || !isNum(o.cart, 1, 20) || !isNum(o.lanterns, 0, MAX_LANTERNS)) return false;
  if (!Array.isArray(o.stock) || o.stock.length > 20 || !o.stock.every((u) => isRec(u) && ITEM_IDS.includes(u.item as ItemId) && isNum(u.paid, 0, 1000) && typeof u.front === 'boolean' && isNum(u.bought, 1, 28))) return false;
  const m = o.market;
  if (!isRec(m) || !Array.isArray(m.open) || !m.open.every((x) => SUPPLIER_IDS.includes(x as SupplierId)) || !validItemMap(m.cost, 1, 1000) || !validItemMap(m.demand, 0.1, 10)) return false;
  if (!Array.isArray(m.hot) || !m.hot.every((x) => ITEM_IDS.includes(x as ItemId)) || typeof m.rumour !== 'string' || !isRec(m.tip) || !ITEM_IDS.includes(m.tip.item as ItemId) || (m.tip.kind !== 'sell' && m.tip.kind !== 'glut') || (m.event !== null && !(m.event as string in EVENTS)) || (m.rival !== null && !ITEM_IDS.includes(m.rival as ItemId))) return false;
  if (!isNum(o.queue, 0, 40) || !Array.isArray(o.back) || !o.back.every((b) => isRec(b) && isNum(b.at, 0, 40) && validCustomer(b.c))) return false;
  if (o.customer !== null && !validCustomer(o.customer)) return false;
  const n = o.tonight, w = o.week;
  if (!isRec(n) || !isNum(n.profit) || !isRec(w) || !isNum(w.profit)) return false;
  if (!isRec(n) || !['sold', 'takings', 'fair', 'walked', 'sets', 'tips', 'tax', 'oil', 'repStart', 'served', 'missed'].every((k) => isNum(n[k], 0))) return false;
  if (!isRec(w) || !['takings', 'fair', 'sets', 'pearls', 'lanterns'].every((k) => isNum(w[k], 0))) return false;
  if (!Array.isArray(o.weeks) || o.weeks.length > 4 || !o.weeks.every((x) => isRec(x) && isNum(x.lanterns, 0, 3) && isNum(x.takings, 0) && isNum(x.profit) && isNum(x.week, 0, 3) && typeof x.request === 'boolean')) return false;
  if (!Array.isArray(o.friends) || o.friends.length !== 3 || !o.friends.every((f) => isNum(f, -3, 5))) return false;
  if (!Array.isArray(o.seen) || !o.seen.every((p) => PERSONA_IDS.includes(p as Persona))) return false;
  if (!isNum(o.wordOfMouth, 0, 1) || !isNum(o.uid, 0) || !isNum(o.spent) || typeof o.boat !== 'boolean' || (o.lastRumour !== null && !ITEM_IDS.includes(o.lastRumour as ItemId))) return false;
  return true;
}
export function readSave(raw: string | null): Save {
  const s = blankSave();
  if (!raw) return s;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return s; }
  if (!isRec(o) || o.v !== 1) return s;
  if (validRun(o.run)) s.run = o.run as GameState;
  const b = o.best;
  if (isRec(b)) {
    if (isNum(b.lanterns, 0, 12)) s.best.lanterns = Math.floor(b.lanterns);
    if (typeof b.boat === 'boolean') s.best.boat = b.boat;
    if (isNum(b.free, 0, 1e7)) s.best.free = Math.floor(b.free);
    if (isNum(b.months, 0, 1e6)) s.best.months = Math.floor(b.months);
  }
  if (typeof o.tutorial === 'boolean') s.tutorial = o.tutorial;
  if (isRec(o.settings)) { if (typeof o.settings.sound === 'boolean') s.settings.sound = o.settings.sound; if (typeof o.settings.music === 'boolean') s.settings.music = o.settings.music; }
  return s;
}
/** Records a finished month or free market in the best results. */
export function recordEnd(save: Save, s: GameState) {
  if (s.phase !== 'end') return;
  if (s.mode === 'moon') { save.best.lanterns = Math.max(save.best.lanterns, totalLanterns(s)); save.best.boat = save.best.boat || s.boat; save.best.months++; }
  else save.best.free = Math.max(save.best.free, s.purse);
}

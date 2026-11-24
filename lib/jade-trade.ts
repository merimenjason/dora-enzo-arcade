// Jade Street: trading. Six goods and five markets (one per district). Each market makes some goods cheaply and pays
// well for others; every in-game night the prices drift (seeded by the save's seed and the night), tips from contacts
// spike or crash one price for a night, reputation shaves the spread, and the haggle mini-game moves one deal.
// Capacity is set by how you travel (on foot 4, scooter 8 … van 40) plus what the garage adds; the safe-house stash
// holds the rest. Pure maths, tested in tests/jade.mjs.
import { rng, hashStr } from './jade-rng.js';
import type { District } from './jade-city.js';

export type Good = 'jade' | 'mooncake' | 'tea' | 'bowl' | 'fan' | 'mango';
export const GOODS: Good[] = ['jade', 'mooncake', 'tea', 'bowl', 'fan', 'mango'];
export const GOOD: Record<Good, { name: string; one: string; base: number }> = {
  jade: { name: 'Jade bangles', one: 'jade bangle', base: 120 },
  mooncake: { name: 'Mooncakes', one: 'mooncake', base: 34 },
  tea: { name: 'Tea', one: 'tin of tea', base: 22 },
  bowl: { name: 'Porcelain bowls', one: 'porcelain bowl', base: 58 },
  fan: { name: 'Silk fans', one: 'silk fan', base: 44 },
  mango: { name: 'Mangoes', one: 'mango', base: 12 },
};
/** each market's leaning per good: under 1 it's cheap to buy there, over 1 it pays well */
export const LEAN: Record<District, Record<Good, number>> = {
  market: { jade: 1.12, mooncake: 0.74, tea: 1.0, bowl: 1.08, fan: 0.95, mango: 0.7 },
  temple: { jade: 1.0, mooncake: 1.34, tea: 0.68, bowl: 0.95, fan: 1.3, mango: 1.08 },
  canal: { jade: 1.08, mooncake: 1.0, tea: 1.3, bowl: 0.7, fan: 0.86, mango: 0.96 },
  docks: { jade: 0.72, mooncake: 1.1, tea: 1.14, bowl: 1.32, fan: 1.05, mango: 1.36 },
  arcade: { jade: 1.38, mooncake: 1.18, tea: 0.95, bowl: 1.12, fan: 0.72, mango: 1.25 },
  heartland: { jade: 0.9, mooncake: 0.82, tea: 0.88, bowl: 1.2, fan: 1.1, mango: 0.8 },
  bay: { jade: 1.3, mooncake: 1.24, tea: 1.2, bowl: 0.84, fan: 1.28, mango: 1.15 },
  india: { jade: 1.16, mooncake: 0.96, tea: 0.74, bowl: 0.92, fan: 1.06, mango: 0.86 },
  glam: { jade: 0.94, mooncake: 1.12, tea: 1.18, bowl: 1.24, fan: 0.76, mango: 0.92 },
  resort: { jade: 1.34, mooncake: 1.06, tea: 1.0, bowl: 1.08, fan: 0.9, mango: 1.38 },
  // the twelfth pass: Orchard Road pays for jade and fans, Katong sells mooncakes and bowls cheap, Changi wants tea
  orchard: { jade: 1.4, mooncake: 1.16, tea: 1.1, bowl: 1.0, fan: 1.32, mango: 1.2 },
  katong: { jade: 1.02, mooncake: 0.7, tea: 0.96, bowl: 0.72, fan: 1.12, mango: 1.1 },
  changi: { jade: 0.88, mooncake: 1.22, tea: 1.36, bowl: 1.14, fan: 0.82, mango: 0.78 },
  // the fourteenth pass: Tiong Bahru sells tea and mangoes cheap, Clarke Quay pays for fans and jade, Jurong wants mooncakes
  tiong: { jade: 1.06, mooncake: 1.08, tea: 0.72, bowl: 1.1, fan: 0.98, mango: 0.74 },
  quay: { jade: 1.3, mooncake: 0.94, tea: 1.14, bowl: 0.86, fan: 1.36, mango: 1.16 },
  jurong: { jade: 0.84, mooncake: 1.4, tea: 1.2, bowl: 1.26, fan: 0.8, mango: 1.04 },
  // the island's provision shop: mangoes and fans off the kampong cheap, jade and mooncakes dear (all comes by bumboat)
  pulau: { jade: 1.38, mooncake: 1.3, tea: 0.92, bowl: 1.12, fan: 0.74, mango: 0.62 },
  kallang: { jade: 0.9, mooncake: 1.18, tea: 0.8, bowl: 1.26, fan: 1.4, mango: 1.1 },
  // the nineteenth pass: Mandai's market sells mangoes and tea cheap off the farms up north, pays for jade and bowls
  mandai: { jade: 1.32, mooncake: 1.1, tea: 0.78, bowl: 1.3, fan: 1.0, mango: 0.68 },
  // the twenty-first pass: the St John's canteen sells mangoes and fans cheap off the ferry, pays well for jade and tea
  islands: { jade: 1.36, mooncake: 1.12, tea: 1.3, bowl: 0.82, fan: 0.72, mango: 0.7 },
  // (the twenty-second pass) the trailhead shop: hikers buy tea and mangoes dear, and the Gardens' visitors fans
  bukit: { jade: 0.86, mooncake: 0.9, tea: 1.34, bowl: 1.1, fan: 1.24, mango: 1.3 },
  // the twenty-fourth pass: the Woodlands kopitiam sells mangoes and tea cheap off the Kranji farms and from over the
  // Causeway, pays well for jade and mooncakes
  kranji: { jade: 1.34, mooncake: 1.28, tea: 0.74, bowl: 1.1, fan: 0.96, mango: 0.64 },
  // (the twenty-fifth pass) the Punggol Point kopitiam: seafood folk pay for good tea and fans on the hot waterfront, and
  // the HDB town is full of mooncake buyers; mangoes come in on every lorry
  punggol: { jade: 1.2, mooncake: 1.28, tea: 1.34, bowl: 0.9, fan: 1.24, mango: 0.74 },
  bishan: { jade: 1.1, mooncake: 0.86, tea: 1.18, bowl: 1.26, fan: 0.82, mango: 1.22 },
};
export type Tip = { night: number; market: District; good: Good; mult: number; from: string; text: string };
export type Cargo = Record<Good, number>;
export const emptyCargo = (): Cargo => ({ jade: 0, mooncake: 0, tea: 0, bowl: 0, fan: 0, mango: 0 });
export const cargoCount = (c: Cargo) => GOODS.reduce((s, g) => s + (c[g] || 0), 0);
export const cargoValue = (c: Cargo) => GOODS.reduce((s, g) => s + (c[g] || 0) * GOOD[g].base, 0);

/** tonight's mid price for a good at a market (before spread, rep and haggling) */
export function midPrice(seed: number, night: number, m: District, g: Good, tips: Tip[] = [], event?: { market?: District; good?: Good; mult: number } | null): number {
  const r = rng(hashStr(`${seed}:${night}:${m}:${g}`));
  const drift = 0.86 + r() * 0.28;
  let p = GOOD[g].base * LEAN[m][g] * drift;
  for (const t of tips) if (t.night === night && t.market === m && t.good === g) p *= t.mult;
  if (event && (!event.market || event.market === m) && (!event.good || event.good === g)) p *= event.mult;
  return Math.max(1, p);
}
/** the rep tier for a reputation score (0..100): 0, 1 at 20, 2 at 50, 3 at 80 */
export const repTier = (rep: number) => rep >= 80 ? 3 : rep >= 50 ? 2 : rep >= 20 ? 1 : 0;
/** buy and sell prices per unit; `haggle` is a multiplier from the haggle game (0.85 great … 1.05 sour) */
export function prices(mid: number, rep: number, haggle = 1) {
  const t = repTier(rep);
  const buy = Math.max(1, Math.round(mid * (1.06 - 0.03 * t) * haggle));
  const sell = Math.max(1, Math.round(mid * (0.94 + 0.03 * t) / haggle));
  return { buy, sell: Math.min(sell, buy - (buy > 2 ? 1 : 0)) };
}
/** how many units fit: the ride's hold (or 4 on foot) plus the garage's cargo upgrade */
export function capacity(base: number, cargoLvl: number, onFoot: boolean) { return onFoot ? base + cargoLvl : base + cargoLvl * Math.ceil(base / 4); }

export type TradeResult = { ok: boolean; why?: string; cash: number; cargo: Cargo; n: number; total: number };
export function buy(cash: number, cargo: Cargo, cap: number, g: Good, n: number, unit: number): TradeResult {
  const room = cap - cargoCount(cargo), afford = Math.floor(cash / unit);
  const k = Math.min(n, room, afford);
  if (k <= 0) return { ok: false, why: room <= 0 ? 'No room left. Sell something or use a bigger ride.' : 'Not enough cash.', cash, cargo, n: 0, total: 0 };
  const c2 = { ...cargo, [g]: cargo[g] + k };
  return { ok: true, cash: cash - k * unit, cargo: c2, n: k, total: k * unit };
}
export function sell(cash: number, cargo: Cargo, g: Good, n: number, unit: number): TradeResult {
  const k = Math.min(n, cargo[g]);
  if (k <= 0) return { ok: false, why: `You have no ${GOOD[g].name.toLowerCase()}.`, cash, cargo, n: 0, total: 0 };
  return { ok: true, cash: cash + k * unit, cargo: { ...cargo, [g]: cargo[g] - k }, n: k, total: k * unit };
}
/** move goods between what you carry and the stash */
export function moveGoods(from: Cargo, to: Cargo, g: Good, n: number, toCap: number): { from: Cargo; to: Cargo; n: number } {
  const k = Math.max(0, Math.min(n, from[g], toCap - cargoCount(to)));
  return { from: { ...from, [g]: from[g] - k }, to: { ...to, [g]: to[g] + k }, n: k };
}

/** the haggle slider: a needle swinging 0..1; the sweet zone is centred at 0.5, wider with rep and assist */
export function haggleZone(rep: number, assist: boolean) { return 0.1 + repTier(rep) * 0.025 + (assist ? 0.07 : 0); }
export function haggleResult(pos: number, zone: number): { mult: number; grade: 'great' | 'good' | 'fair' | 'sour' } {
  const d = Math.abs(pos - 0.5);
  if (d <= zone * 0.35) return { mult: 0.86, grade: 'great' };
  if (d <= zone) return { mult: 0.93, grade: 'good' };
  if (d <= zone * 2.2) return { mult: 1, grade: 'fair' };
  return { mult: 1.04, grade: 'sour' };
}
/** needle position at time t (seconds) for a given swing speed */
export const needle = (t: number, speed: number) => { const p = (t * speed) % 2; return p < 1 ? p : 2 - p; };

/** the best trade on offer tonight between two open markets (used for hints and the bots) */
export function bestRoute(seed: number, night: number, open: District[], tips: Tip[] = [], event?: { market?: District; good?: Good; mult: number } | null) {
  let best = { from: open[0], to: open[0], good: 'mango' as Good, gain: 0 };
  for (const a of open) for (const b of open) if (a !== b) for (const g of GOODS) {
    const pa = prices(midPrice(seed, night, a, g, tips, event), 0).buy, pb = prices(midPrice(seed, night, b, g, tips, event), 0).sell;
    const gain = (pb - pa) / pa;
    if (gain > best.gain) best = { from: a, to: b, good: g, gain };
  }
  return best;
}

/** each market's name, the same on its E prompt and its panel */
export const MARKET_NAME: Record<District, string> = { market: 'Smith Street Market', temple: 'Temple Street Bazaar', canal: 'Boat Quay Market', docks: 'Tanjong Pagar Market', arcade: 'Club Street Neon Market', heartland: 'Toa Payoh Provision Shop', bay: 'Promenade Kiosk', india: 'Tekka Market', glam: 'Arab Street Market', resort: 'Siloso Beach Kiosk', orchard: 'Orchard Road Christmas Market', katong: 'Joo Chiat Market', changi: 'Changi Village Market', tiong: 'Tiong Bahru Market', quay: 'Clarke Quay Night Market', jurong: 'Jurong Lake Night Market', pulau: 'Ubin Town Provision Shop', kallang: 'Kallang Wave Mall Market', mandai: 'Mandai Market', islands: 'St John’s Canteen', bukit: 'Bukit Timah Trailhead Shop', kranji: 'Woodlands Kopitiam', punggol: 'Punggol Point Kopitiam', bishan: 'Ang Mo Kio Food Centre' };

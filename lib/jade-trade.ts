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

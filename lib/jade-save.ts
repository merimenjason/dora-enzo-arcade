// Jade Street: the save (localStorage 'jade-street-v2'), its repair and migration, progression (districts opened by the
// story, reputation tiers, safe houses, outfits, garage upgrades and paint), trophies and the stats screen.
// Version 1 saves (the pre-release shape: `money`, `done` as a comma string, one shared rep number) migrate forward.
import { DISTRICTS, type District } from './jade-city.js';
import { emptyCargo, GOODS, type Cargo, type Tip } from './jade-trade.js';
import { MISSIONS, CHAPTER_OPENS } from './jade-story.js';
import { hashStr, rng } from './jade-rng.js';

export const SAVE_KEY = 'jade-street-v2';
export const OLD_KEYS = ['jade-street-v1'];
export const SAVE_VERSION = 2;
export type Hero = 'dora' | 'enzo';
export type Settings = { sound: boolean; music: boolean; assist: boolean; diff: 'easy' | 'normal'; touch: 'auto' | 'on' | 'off'; shake: boolean };
export type Stats = { walked: number; driven: number; boated: number; missions: number; gigs: number; trades: number; profit: number; caught: number; escapes: number; bumps: number; cats: number; murals: number; maxHeat: number; playTime: number; minis: number };
export type Save = {
  v: number; seed: number; hero: Hero; started: boolean;
  cash: number; night: number; clock: number; cargo: Cargo; stash: Cargo;
  done: string[]; rep: Record<District, number>;
  upgrades: { speed: number; grip: number; cargo: number }; paint: string;
  outfits: Record<Hero, string[]>; outfit: Record<Hero, string>;
  cats: number[]; murals: string[]; trophies: string[]; tips: Tip[];
  safe: string; best: Record<string, number>; daily: string; dailyDone: string[];
  stats: Stats; settings: Settings;
};
export const OUTFITS: { id: string; name: string; hero: Hero | 'both'; price: number; need: { d: District; rep: number } | null; hue: number }[] = [
  { id: 'classic', name: 'Street classic', hero: 'both', price: 0, need: null, hue: 0 },
  { id: 'midnight', name: 'Midnight blue', hero: 'both', price: 120, need: { d: 'market', rep: 20 }, hue: 1 },
  { id: 'temple', name: 'Temple gold', hero: 'both', price: 200, need: { d: 'temple', rep: 30 }, hue: 2 },
  { id: 'canal', name: 'Canal teal', hero: 'both', price: 260, need: { d: 'canal', rep: 30 }, hue: 3 },
  { id: 'harbour', name: 'Harbour plum', hero: 'both', price: 320, need: { d: 'docks', rep: 30 }, hue: 4 },
  { id: 'neon', name: 'Neon pink', hero: 'both', price: 400, need: { d: 'arcade', rep: 30 }, hue: 5 },
];
export const PAINTS = [
  { id: 'red', name: 'Lantern red', price: 0, filter: 0 }, { id: 'jade', name: 'Jade', price: 60, filter: 140 },
  { id: 'gold', name: 'Gold', price: 80, filter: 40 }, { id: 'blue', name: 'Harbour blue', price: 80, filter: 210 },
  { id: 'violet', name: 'Neon violet', price: 120, filter: 280 },
];
export const UPGRADE_COST = [[150, 400, 900], [120, 350, 800], [100, 300, 700]] as const; // speed, grip, cargo per level
export const SAFE_HOUSES: { id: string; d: District; need: number; price: number }[] = [
  { id: 'safe-market', d: 'market', need: 0, price: 0 }, { id: 'safe-temple', d: 'temple', need: 15, price: 150 },
  { id: 'safe-canal', d: 'canal', need: 15, price: 200 }, { id: 'safe-docks', d: 'docks', need: 15, price: 250 }, { id: 'safe-arcade', d: 'arcade', need: 15, price: 300 },
];

export function newSave(seed = 1): Save {
  return {
    v: SAVE_VERSION, seed, hero: 'dora', started: false,
    cash: 100, night: 1, clock: 0, cargo: emptyCargo(), stash: emptyCargo(),
    done: [], rep: { market: 0, temple: 0, canal: 0, docks: 0, arcade: 0 },
    upgrades: { speed: 0, grip: 0, cargo: 0 }, paint: 'red',
    outfits: { dora: ['classic'], enzo: ['classic'] }, outfit: { dora: 'classic', enzo: 'classic' },
    cats: [], murals: [], trophies: [], tips: [], safe: 'safe-market', best: {}, daily: '', dailyDone: [],
    stats: { walked: 0, driven: 0, boated: 0, missions: 0, gigs: 0, trades: 0, profit: 0, caught: 0, escapes: 0, bumps: 0, cats: 0, murals: 0, maxHeat: 0, playTime: 0, minis: 0 },
    settings: { sound: true, music: true, assist: true, diff: 'easy', touch: 'auto', shake: true },
  };
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) => typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const cargoOf = (v: unknown): Cargo => { const c = emptyCargo(); if (v && typeof v === 'object') for (const g of GOODS) c[g] = Math.floor(num((v as Record<string, unknown>)[g], 0, 0, 999)); return c; };
const strs = (v: unknown, ok?: (s: string) => boolean) => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && (!ok || ok(x))))] : [];

/** read any stored save (current or older), repairing anything malformed; null or junk gives a new save */
export function loadSave(raw: string | null): Save {
  let o: Record<string, unknown> | null = null;
  try { o = raw ? JSON.parse(raw) : null; } catch { o = null; }
  if (!o || typeof o !== 'object') return newSave(1 + (hashStr(String(raw)) % 100000));
  if ((o.v ?? 1) === 1) o = migrate1(o);
  const s = newSave(Math.floor(num(o.seed, 1, 1, 2 ** 31)));
  s.hero = o.hero === 'enzo' ? 'enzo' : 'dora';
  s.started = o.started === true;
  s.cash = Math.floor(num(o.cash, 100, 0, 1e7));
  s.night = Math.floor(num(o.night, 1, 1, 1e5)); s.clock = num(o.clock, 0, 0, 719);
  s.cargo = cargoOf(o.cargo); s.stash = cargoOf(o.stash);
  const ids = new Set(MISSIONS.map(m => m.id));
  s.done = strs(o.done, x => ids.has(x));
  const rep = (o.rep ?? {}) as Record<string, unknown>;
  for (const d of DISTRICTS) s.rep[d] = num(rep[d], 0, 0, 100);
  const up = (o.upgrades ?? {}) as Record<string, unknown>;
  s.upgrades = { speed: Math.floor(num(up.speed, 0, 0, 3)), grip: Math.floor(num(up.grip, 0, 0, 3)), cargo: Math.floor(num(up.cargo, 0, 0, 3)) };
  s.paint = PAINTS.some(p => p.id === o!.paint) ? o.paint as string : 'red';
  const of = (o.outfits ?? {}) as Record<string, unknown>, oc = (o.outfit ?? {}) as Record<string, unknown>;
  for (const h of ['dora', 'enzo'] as Hero[]) {
    s.outfits[h] = [...new Set(['classic', ...strs(of[h], x => OUTFITS.some(f => f.id === x))])];
    s.outfit[h] = s.outfits[h].includes(oc[h] as string) ? oc[h] as string : 'classic';
  }
  s.cats = Array.isArray(o.cats) ? [...new Set((o.cats as unknown[]).filter((x): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < 50))] : [];
  s.murals = strs(o.murals); s.trophies = strs(o.trophies, x => TROPHIES.some(t => t.id === x));
  s.tips = Array.isArray(o.tips) ? (o.tips as Tip[]).filter(t => t && typeof t.night === 'number' && DISTRICTS.includes(t.market) && GOODS.includes(t.good)).slice(-12) : [];
  s.safe = SAFE_HOUSES.some(h => h.id === o!.safe) ? o.safe as string : 'safe-market';
  s.best = (o.best && typeof o.best === 'object') ? Object.fromEntries(Object.entries(o.best as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number> : {};
  s.daily = typeof o.daily === 'string' ? o.daily : ''; s.dailyDone = strs(o.dailyDone).slice(-60);
  const st = (o.stats ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(s.stats) as (keyof Stats)[]) s.stats[k] = num(st[k], 0, 0, 1e12);
  const se = (o.settings ?? {}) as Record<string, unknown>;
  s.settings = { sound: se.sound !== false, music: se.music !== false, assist: se.assist !== false, diff: se.diff === 'normal' ? 'normal' : 'easy', touch: se.touch === 'on' || se.touch === 'off' ? se.touch : 'auto', shake: se.shake !== false };
  return s;
}
/** version 1 (pre-release): { v:1, money, done: "m1,m2", rep: number, hero, cats: number } */
function migrate1(o: Record<string, unknown>): Record<string, unknown> {
  const done = typeof o.done === 'string' ? (o.done as string).split(',').filter(Boolean) : o.done;
  const r = typeof o.rep === 'number' ? (o.rep as number) : 0;
  return { ...o, v: 2, cash: o.cash ?? o.money, done, rep: { market: r, temple: 0, canal: 0, docks: 0, arcade: 0 }, cats: Array.isArray(o.cats) ? o.cats : [], started: true };
}

// ── progression
export const chapterOf = (s: Save) => { let ch = 1; for (let c = 1; c <= 5; c++) if (MISSIONS.filter(m => m.ch === c).every(m => s.done.includes(m.id))) ch = c + 1; return Math.min(ch, 6); };
export function openDistricts(s: Save): District[] {
  const out: District[] = ['market'];
  for (let c = 1; c <= 4; c++) if (s.done.includes(`m${c * 5}`)) out.push(CHAPTER_OPENS[c - 1]);
  return out;
}
/** story missions you may start now: the chapter's jobs in order, a couple at a time */
export function available(s: Save) {
  const ch = chapterOf(s);
  const todo = MISSIONS.filter(m => m.ch === ch && !s.done.includes(m.id));
  // the finale waits for the rest of the chapter; otherwise the first two open jobs are offered
  const nonFinal = todo.filter(m => m.id !== `m${ch * 5}`);
  return (nonFinal.length ? nonFinal.slice(0, 2) : todo.slice(0, 1));
}
export const safeOpen = (s: Save, id: string) => { const h = SAFE_HOUSES.find(x => x.id === id); return !!h && openDistricts(s).includes(h.d) && (h.need === 0 || s.trophies.includes('safe:' + id) || boughtSafe(s, id)); };
export const boughtSafe = (s: Save, id: string) => s.dailyDone.includes('house:' + id) || s.best['house:' + id] === 1;
export function buySafe(s: Save, id: string): string | null {
  const h = SAFE_HOUSES.find(x => x.id === id); if (!h) return 'No such safe house';
  if (safeOpen(s, id)) return 'Already yours';
  if (!openDistricts(s).includes(h.d)) return 'That district is still under fog';
  if (s.rep[h.d] < h.need) return `Needs ${h.need} reputation in this district`;
  if (s.cash < h.price) return `Needs ${h.price} coins`;
  s.cash -= h.price; s.best['house:' + id] = 1; return null;
}
export function buyUpgrade(s: Save, k: 'speed' | 'grip' | 'cargo'): string | null {
  const i = ['speed', 'grip', 'cargo'].indexOf(k), lvl = s.upgrades[k];
  if (lvl >= 3) return 'Fully upgraded';
  const cost = UPGRADE_COST[i][lvl];
  if (s.cash < cost) return `Needs ${cost} coins`;
  s.cash -= cost; s.upgrades[k] = lvl + 1; return null;
}
export function buyPaint(s: Save, id: string): string | null {
  const p = PAINTS.find(x => x.id === id); if (!p) return 'No such paint';
  if (s.paint === id) return 'Already painted';
  if (s.cash < p.price) return `Needs ${p.price} coins`;
  s.cash -= p.price; s.paint = id; return null;
}
export function buyOutfit(s: Save, h: Hero, id: string): string | null {
  const f = OUTFITS.find(x => x.id === id); if (!f) return 'No such outfit';
  if (s.outfits[h].includes(id)) { s.outfit[h] = id; return null; }
  if (f.need && s.rep[f.need.d] < f.need.rep) return `Needs ${f.need.rep} reputation in ${f.need.d === 'market' ? 'the Night Market' : f.need.d}`;
  if (s.cash < f.price) return `Needs ${f.price} coins`;
  s.cash -= f.price; s.outfits[h].push(id); s.outfit[h] = id; return null;
}
export const addRep = (s: Save, d: District, n: number) => { s.rep[d] = Math.min(100, Math.max(0, s.rep[d] + n)); };

// ── trophies
export const TROPHIES: { id: string; name: string; desc: string; test: (s: Save) => boolean }[] = [
  { id: 'first-job', name: 'First Job', desc: 'Finish your first story job.', test: s => s.done.length >= 1 },
  { id: 'dragon', name: 'Jade Dragon', desc: 'Win back the Jade Dragon.', test: s => s.done.includes('m5') },
  { id: 'bell', name: 'Golden Bell', desc: 'Win back the Golden Bell.', test: s => s.done.includes('m10') },
  { id: 'lantern', name: 'Pearl Lantern', desc: 'Win back the Pearl Lantern.', test: s => s.done.includes('m15') },
  { id: 'koi', name: 'Silver Koi', desc: 'Win back the Silver Koi.', test: s => s.done.includes('m20') },
  { id: 'drum', name: 'Phoenix Drum', desc: 'Win back the Phoenix Drum and start the festival.', test: s => s.done.includes('m25') },
  { id: 'cats-10', name: 'Lucky Paw', desc: 'Find 10 lucky cats.', test: s => s.cats.length >= 10 },
  { id: 'cats-25', name: 'Luckier Paw', desc: 'Find 25 lucky cats.', test: s => s.cats.length >= 25 },
  { id: 'cats-50', name: 'Luckiest Paw', desc: 'Find all 50 lucky cats.', test: s => s.cats.length >= 50 },
  { id: 'murals', name: 'Fresh Paint', desc: 'Restore every faded mural.', test: s => s.murals.length >= 13 },
  { id: 'trader', name: 'Market Mind', desc: 'Make 1,000 coins of trading profit.', test: s => s.stats.profit >= 1000 },
  { id: 'tycoon', name: 'Night Tycoon', desc: 'Make 10,000 coins of trading profit.', test: s => s.stats.profit >= 10000 },
  { id: 'escape', name: 'Slippery', desc: 'Lose the wardens five times.', test: s => s.stats.escapes >= 5 },
  { id: 'five', name: 'Five Lanterns', desc: 'Reach five lanterns of heat.', test: s => s.stats.maxHeat >= 5 },
  { id: 'gigs', name: 'Side Hustle', desc: 'Finish 10 side gigs.', test: s => s.stats.gigs >= 10 },
  { id: 'garage', name: 'Tuned Up', desc: 'Max out one garage upgrade.', test: s => Object.values(s.upgrades).some(v => v >= 3) },
  { id: 'wardrobe', name: 'Wardrobe', desc: 'Own three outfits for one hero.', test: s => s.outfits.dora.length >= 3 || s.outfits.enzo.length >= 3 },
  { id: 'rep', name: 'Local Legend', desc: 'Reach 80 reputation in a district.', test: s => Object.values(s.rep).some(v => v >= 80) },
  { id: 'daily', name: 'Regular', desc: 'Finish a daily market event.', test: s => s.dailyDone.some(x => x.startsWith('day:')) },
  { id: 'chefs', name: 'Kitchen Hand', desc: 'Play the mini-games 10 times.', test: s => s.stats.minis >= 10 },
];
/** award any trophies newly earned; returns their names */
export function checkTrophies(s: Save): string[] {
  const out: string[] = [];
  for (const t of TROPHIES) if (!s.trophies.includes(t.id) && t.test(s)) { s.trophies.push(t.id); out.push(t.name); }
  return out;
}

// ── the daily market event (same for everyone on a given date)
export const EVENTS = [
  { name: 'Mooncake Festival Eve', desc: 'Temple Hill pays half again for mooncakes tonight.', market: 'temple' as District, good: 'mooncake' as const, mult: 1.5, task: 'Sell 6 mooncakes at Temple Hill' },
  { name: 'Mango Glut', desc: 'Mango boats arrived: mangoes are cheap everywhere.', market: undefined, good: 'mango' as const, mult: 0.7, task: 'Sell 10 mangoes anywhere' },
  { name: 'Collectors in Town', desc: 'The Arcade Strip pays extra for jade tonight.', market: 'arcade' as District, good: 'jade' as const, mult: 1.35, task: 'Sell 3 jade bangles on the Strip' },
  { name: 'Typhoon Warning', desc: 'Tea is scarce at the Docks: prices up.', market: 'docks' as District, good: 'tea' as const, mult: 1.45, task: 'Sell 8 tins of tea at the Docks' },
  { name: 'Fan Dance Night', desc: 'Canal Row wants silk fans for the dance.', market: 'canal' as District, good: 'fan' as const, mult: 1.4, task: 'Sell 5 silk fans on Canal Row' },
  { name: 'Wedding Season', desc: 'Porcelain bowls are in demand at the Night Market.', market: 'market' as District, good: 'bowl' as const, mult: 1.35, task: 'Sell 4 porcelain bowls in the Night Market' },
];
export function dailyEvent(day: string) { const r = rng(hashStr('jade-day:' + day)); return { ...EVENTS[Math.floor(r() * EVENTS.length)], day, need: 0 }; }
export function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const DAILY_NEED: Record<string, number> = { mooncake: 6, mango: 10, jade: 3, tea: 8, fan: 5, bowl: 4 };

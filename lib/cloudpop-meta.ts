// Cloudpop: everything kept between runs. Player level, per-tower XP spent in the Tower Lab to unlock tiers 3-5,
// acorns spent on the Burrow Lore tree (44 nodes in four branches), medals per map x difficulty x mode, trophies,
// the seeded daily challenge, hero and skin unlocks, and settings. Saved as JSON under SAVE_KEY; load() repairs
// anything missing or out of range so an older or damaged save never breaks the game.
import { TOWERS, TOWER } from './cloudpop-towerdata.js';
import type { TowerId } from './cloudpop-towers.js';
import { MAPS, MAP } from './cloudpop-maps.js';
import { noPerks, type Perks, type Diff, type Mode, MODES, type RunConfig } from './cloudpop-game.js';
import type { HeroId } from './cloudpop-heroes.js';
import { rng, hashStr } from './cloudpop-rng.js';

export const SAVE_KEY = 'cloudpop-v1';
export const SAVE_VERSION = 1;

export interface Save {
  v: number;
  xp: number;
  acorns: number;
  acornsSpent: number;
  /** unspent tower XP */
  towerXp: Record<string, number>;
  /** highest unlocked tier per path */
  tiers: Record<string, [number, number, number]>;
  lore: string[];
  medals: string[];
  trophies: string[];
  heroes: HeroId[];
  skins: string[];
  hero: HeroId;
  skin: Record<string, string>;
  daily: { last: string; streak: number; done: string[] };
  stats: { pops: number; wins: number; games: number; bossPops: number; abilities: number; best: Record<string, number>; placed: string[]; dailyWins: number };
  settings: { assist: boolean; sound: boolean; music: boolean; auto: boolean; speed: number; tips: boolean };
}

export function newSave(): Save {
  return {
    v: SAVE_VERSION, xp: 0, acorns: 0, acornsSpent: 0, towerXp: {}, tiers: {}, lore: [], medals: [], trophies: [],
    heroes: ['dora'], skins: [], hero: 'dora', skin: {}, daily: { last: '', streak: 0, done: [] },
    stats: { pops: 0, wins: 0, games: 0, bossPops: 0, abilities: 0, best: {}, placed: [], dailyWins: 0 },
    settings: { assist: true, sound: true, music: true, auto: false, speed: 1, tips: true },
  };
}

const num = (v: unknown, d = 0, lo = 0, hi = 1e12) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
/** parse and repair a save; returns a fresh save for junk, future versions or wrong shapes */
export function loadSave(json: string | null): Save {
  const s = newSave();
  if (!json) return s;
  let o: Record<string, unknown>;
  try { o = JSON.parse(json); } catch { return s; }
  if (!o || typeof o !== 'object' || (typeof o.v === 'number' && o.v > SAVE_VERSION)) return s;
  s.xp = num(o.xp); s.acorns = num(o.acorns); s.acornsSpent = num(o.acornsSpent);
  const tx = (o.towerXp ?? {}) as Record<string, unknown>;
  const ti = (o.tiers ?? {}) as Record<string, unknown>;
  for (const t of TOWERS) {
    if (tx[t.id] !== undefined) s.towerXp[t.id] = num(tx[t.id]);
    const v = ti[t.id];
    if (Array.isArray(v) && v.length === 3) s.tiers[t.id] = v.map(x => num(x, 2, 2, 5)) as [number, number, number];
  }
  s.lore = strs(o.lore).filter(id => LORE_BY_ID[id]);
  s.medals = strs(o.medals);
  s.trophies = strs(o.trophies).filter(id => TROPHY_BY_ID[id]);
  s.heroes = strs(o.heroes).filter((h): h is HeroId => h === 'dora' || h === 'enzo');
  if (!s.heroes.includes('dora')) s.heroes.unshift('dora');
  s.skins = strs(o.skins);
  s.hero = s.heroes.includes(o.hero as HeroId) ? (o.hero as HeroId) : 'dora';
  if (o.skin && typeof o.skin === 'object') for (const [k, v] of Object.entries(o.skin as Record<string, unknown>)) if (typeof v === 'string') s.skin[k] = v;
  const d = (o.daily ?? {}) as Record<string, unknown>;
  s.daily = { last: typeof d.last === 'string' ? d.last : '', streak: num(d.streak), done: strs(d.done).slice(-60) };
  const st = (o.stats ?? {}) as Record<string, unknown>;
  s.stats.pops = num(st.pops); s.stats.wins = num(st.wins); s.stats.games = num(st.games); s.stats.bossPops = num(st.bossPops);
  s.stats.abilities = num(st.abilities); s.stats.dailyWins = num(st.dailyWins); s.stats.placed = strs(st.placed);
  if (st.best && typeof st.best === 'object') for (const [k, v] of Object.entries(st.best as Record<string, unknown>)) s.stats.best[k] = num(v);
  const se = (o.settings ?? {}) as Record<string, unknown>;
  for (const k of ['assist', 'sound', 'music', 'auto', 'tips'] as const) if (typeof se[k] === 'boolean') s.settings[k] = se[k] as boolean;
  s.settings.speed = num(se.speed, 1, 1, 3);
  // v0 prototype saves kept unlocked tiers as a flat "unlocks" list of "tower:path:tier"
  if (o.v === undefined && Array.isArray(o.unlocks)) {
    for (const u of strs(o.unlocks)) {
      const [id, p, t] = u.split(':'); if (!TOWER[id]) continue;
      const cur = s.tiers[id] ?? [2, 2, 2]; cur[+p] = Math.max(cur[+p], Math.min(5, +t)); s.tiers[id] = cur;
    }
  }
  return s;
}

// ── player level
export function levelXp(n: number): number { return n <= 1 ? 0 : 400 * (n - 1) + 60 * (n - 1) ** 2; }
export function playerLevel(xp: number): number { let l = 1; while (l < 50 && xp >= levelXp(l + 1)) l++; return l; }
export function towerUnlocked(s: Save, id: TowerId): boolean { return playerLevel(s.xp) >= TOWER[id].level; }
export function mapUnlocked(s: Save, id: string): boolean {
  const i = MAPS.findIndex(m => m.id === id); if (i < 0) return false;
  if (playerLevel(s.xp) >= MAPS[i].level) return true;
  return i > 0 && s.medals.some(k => k.startsWith(MAPS[i - 1].id + ':'));
}

// ── Tower Lab: tiers 1-2 are open; 3, 4 and 5 cost that tower's XP, path by path
export const TIER_XP = [0, 0, 0, 600, 2500, 8000];
export function tierCaps(s: Save, id: TowerId): [number, number, number] { return s.tiers[id] ?? [2, 2, 2]; }
export function labReason(s: Save, id: TowerId, path: number): string {
  const cap = tierCaps(s, id)[path];
  if (cap >= 5) return 'All unlocked';
  if ((s.towerXp[id] ?? 0) < TIER_XP[cap + 1]) return `Needs ${TIER_XP[cap + 1]} ${TOWER[id].name} XP`;
  return '';
}
export function labUnlock(s: Save, id: TowerId, path: number): string {
  const why = labReason(s, id, path); if (why) return why;
  const caps = [...tierCaps(s, id)] as [number, number, number];
  caps[path]++; s.towerXp[id] = (s.towerXp[id] ?? 0) - TIER_XP[caps[path]]; s.tiers[id] = caps;
  return '';
}

// ── Burrow Lore: four branches of eleven
export type Branch = 'crew' | 'wonders' | 'hearth' | 'legend';
export const BRANCHES: { id: Branch; name: string; desc: string }[] = [
  { id: 'crew', name: 'Crew', desc: 'Slingers, buskers, ember pots, ice carts and llamas.' },
  { id: 'wonders', name: 'Wonders', desc: 'Hay cannons, condors, reed boats and windmills.' },
  { id: 'hearth', name: 'Hearth', desc: 'Coins, lives, lanterns and terraces.' },
  { id: 'legend', name: 'Legend', desc: 'Heroes, abilities and luck.' },
];
export interface LoreNode { id: string; branch: Branch; name: string; desc: string; cost: number; req: string[]; col: number; row: number; icon: number; fx: (p: Perks) => void }
const mul = (o: Partial<Record<TowerId, number>>, ids: TowerId[], k: number) => { for (const i of ids) o[i] = (o[i] ?? 1) * k; };
const add = (o: Partial<Record<TowerId, number>>, ids: TowerId[], k: number) => { for (const i of ids) o[i] = (o[i] ?? 0) + k; };
const CREW: TowerId[] = ['pebble', 'busker', 'ember', 'ice', 'llama'];
const WONDERS: TowerId[] = ['hay', 'condor', 'boat', 'windmill'];
const N = (id: string, branch: Branch, row: number, col: number, cost: number, req: string[], icon: number, name: string, desc: string, fx: (p: Perks) => void): LoreNode => ({ id, branch, row, col, cost, req, icon, name, desc, fx });
export const LORE: LoreNode[] = [
  N('c1', 'crew', 0, 1, 3, [], 0, 'Sure Grip', 'Pebble Slingers hit one more puff.', p => add(p.pierce, ['pebble'], 1)),
  N('c2', 'crew', 1, 0, 4, ['c1'], 1, 'Busker Lessons', 'Pan-Flute Buskers reach 8% further.', p => mul(p.rangeMul, ['busker'], 1.08)),
  N('c3', 'crew', 1, 2, 4, ['c1'], 0, 'Llama Treats', 'Llamas spit 8% faster.', p => mul(p.rateMul, ['llama'], 0.92)),
  N('c4', 'crew', 2, 0, 6, ['c2'], 0, 'Cheap Pebbles', 'Pebble Slingers cost 10% less.', p => mul(p.costMul, ['pebble'], 0.9)),
  N('c5', 'crew', 2, 1, 6, ['c2', 'c3'], 2, 'Warm Coals', 'Ember Pots throw 8% faster.', p => mul(p.rateMul, ['ember'], 0.92)),
  N('c6', 'crew', 2, 2, 6, ['c3'], 3, 'Ice Cream Money', 'Raspadilla Carts cost 10% less.', p => mul(p.costMul, ['ice'], 0.9)),
  N('c7', 'crew', 3, 0, 10, ['c4'], 1, 'Keen Crew', 'Slingers reach 8% further; Buskers pop two more.', p => { mul(p.rangeMul, ['pebble'], 1.08); add(p.pierce, ['busker'], 2); }),
  N('c8', 'crew', 3, 1, 10, ['c5'], 0, 'Born Watchers', 'Every Pebble Slinger starts with Keen Eye for free.', p => { p.freeTier.pebble = [2, 1]; }),
  N('c9', 'crew', 3, 2, 10, ['c6'], 3, 'Glacier Training', 'Raspadilla Carts work 10% faster.', p => mul(p.rateMul, ['ice'], 0.9)),
  N('c10', 'crew', 4, 1, 16, ['c7', 'c8', 'c9'], 2, 'Veteran Crew', 'Crew upgrades cost 6% less.', p => mul(p.upgradeMul, CREW, 0.94)),
  N('c11', 'crew', 5, 1, 30, ['c10'], 1, 'Crew Spirit', 'Crew towers attack 5% faster and hit bosses 15% harder.', p => { mul(p.rateMul, CREW, 0.95); mul(p.bossMul, CREW, 1.15); }),
  N('w1', 'wonders', 0, 1, 3, [], 4, 'Tight Bales', 'Hay-Bale Cannons hit three more puffs.', p => add(p.pierce, ['hay'], 3)),
  N('w2', 'wonders', 1, 0, 4, ['w1'], 5, 'Condor Friends', 'Condor Roosts cost 8% less.', p => mul(p.costMul, ['condor'], 0.92)),
  N('w3', 'wonders', 1, 2, 4, ['w1'], 6, 'Reed Weavers', 'Reed Boats cost 10% less.', p => mul(p.costMul, ['boat'], 0.9)),
  N('w4', 'wonders', 2, 0, 6, ['w2'], 4, 'Long Barrel', 'Hay-Bale Cannons reach 8% further.', p => mul(p.rangeMul, ['hay'], 1.08)),
  N('w5', 'wonders', 2, 1, 6, ['w2', 'w3'], 5, 'Wide Wings', 'Condors see 8% further.', p => mul(p.rangeMul, ['condor'], 1.08)),
  N('w6', 'wonders', 2, 2, 6, ['w3'], 6, 'Paddle Practice', 'Reed Boats cast 8% faster.', p => mul(p.rateMul, ['boat'], 0.92)),
  N('w7', 'wonders', 3, 0, 10, ['w4'], 7, 'Mill Oil', 'Windmills gust 10% faster.', p => mul(p.rateMul, ['windmill'], 0.9)),
  N('w8', 'wonders', 3, 1, 10, ['w5'], 4, 'Bale Bargains', 'Hay-Bale Cannon upgrades cost 8% less.', p => mul(p.upgradeMul, ['hay'], 0.92)),
  N('w9', 'wonders', 3, 2, 10, ['w6'], 5, 'Thermals', 'Condors throw 8% faster.', p => mul(p.rateMul, ['condor'], 0.92)),
  N('w10', 'wonders', 4, 1, 16, ['w7', 'w8', 'w9'], 7, 'Wind Lore', 'Windmills cost 10% less and reach 8% further.', p => { mul(p.costMul, ['windmill'], 0.9); mul(p.rangeMul, ['windmill'], 1.08); }),
  N('w11', 'wonders', 5, 1, 30, ['w10'], 6, 'Wonders of the Valley', 'Wonders hit bosses 20% harder.', p => mul(p.bossMul, WONDERS, 1.2)),
  N('h1', 'hearth', 0, 1, 3, [], 10, 'Pocket Money', 'Start every run with $100 more.', p => { p.startCash += 100; }),
  N('h2', 'hearth', 1, 0, 4, ['h1'], 11, 'Spare Lives', 'Start with 20 more lives.', p => { p.startLives += 20; }),
  N('h3', 'hearth', 1, 2, 4, ['h1'], 9, 'Harvest Hands', 'Quinoa Terraces cost 8% less.', p => mul(p.costMul, ['quinoa'], 0.92)),
  N('h4', 'hearth', 2, 0, 6, ['h2'], 10, 'Market Sense', 'Towers sell back for 5% more.', p => { p.sellBack += 0.05; }),
  N('h5', 'hearth', 2, 1, 6, ['h2', 'h3'], 10, 'Round Bonus', 'Round bonuses are 10% bigger.', p => { p.bonusMul *= 1.1; }),
  N('h6', 'hearth', 2, 2, 6, ['h3'], 8, 'Lantern Oil', 'Lantern Keepers cost 10% less.', p => mul(p.costMul, ['lantern'], 0.9)),
  N('h7', 'hearth', 3, 0, 10, ['h4'], 10, 'Deep Pockets', 'Start with $200 more.', p => { p.startCash += 200; }),
  N('h8', 'hearth', 3, 1, 10, ['h5'], 9, 'Rich Terraces', 'All income is 10% bigger.', p => { p.incomeMul *= 1.1; }),
  N('h9', 'hearth', 3, 2, 10, ['h6'], 11, 'More Lives', 'Start with 40 more lives.', p => { p.startLives += 40; }),
  N('h10', 'hearth', 4, 1, 16, ['h7', 'h8', 'h9'], 8, 'Lantern Guild', 'Lantern Keeper upgrades cost 10% less.', p => mul(p.upgradeMul, ['lantern'], 0.9)),
  N('h11', 'hearth', 5, 1, 30, ['h10'], 10, 'Festival Fund', 'Start with $300 more and 10% bigger round bonuses.', p => { p.startCash += 300; p.bonusMul *= 1.1; }),
  N('l1', 'legend', 0, 1, 3, [], 12, 'Hero Snacks', 'Heroes cost 10% less.', p => { p.heroCostMul *= 0.9; }),
  N('l2', 'legend', 1, 0, 4, ['l1'], 12, 'Quick Study', 'Heroes earn 15% more XP.', p => { p.heroXpMul *= 1.15; }),
  N('l3', 'legend', 1, 2, 4, ['l1'], 14, 'Rested', 'Abilities recharge 5% faster.', p => { p.cdMul *= 0.95; }),
  N('l4', 'legend', 2, 0, 6, ['l2'], 12, 'Warm-up', 'Heroes start at level 2.', p => { p.heroStartLvl = Math.max(p.heroStartLvl, 2); }),
  N('l5', 'legend', 2, 1, 6, ['l2', 'l3'], 13, 'Field Notes', 'Heroes earn 15% more XP again.', p => { p.heroXpMul *= 1.15; }),
  N('l6', 'legend', 2, 2, 6, ['l3'], 11, 'Second Wind', 'One more second chance each run.', p => { p.secondWind += 1; }),
  N('l7', 'legend', 3, 0, 10, ['l4'], 14, 'Focus', 'Abilities recharge 8% faster.', p => { p.cdMul *= 0.92; }),
  N('l8', 'legend', 3, 1, 10, ['l5'], 12, 'Warm-up II', 'Heroes start at level 3.', p => { p.heroStartLvl = Math.max(p.heroStartLvl, 3); }),
  N('l9', 'legend', 3, 2, 10, ['l6'], 15, 'Lucky Acorn', 'Earn 20% more acorns.', () => {}),
  N('l10', 'legend', 4, 1, 16, ['l7', 'l8', 'l9'], 13, 'Hero Gear', 'Heroes cost 15% less again.', p => { p.heroCostMul *= 0.85; }),
  N('l11', 'legend', 5, 1, 30, ['l10'], 15, 'Legend of the Valley', 'Heroes start at level 5; abilities recharge 10% faster.', p => { p.heroStartLvl = Math.max(p.heroStartLvl, 5); p.cdMul *= 0.9; }),
];
export const LORE_BY_ID: Record<string, LoreNode> = Object.fromEntries(LORE.map(n => [n.id, n]));
/** a node is buyable when any one of its parents is bought */
export function loreReason(s: Save, id: string): string {
  const n = LORE_BY_ID[id]; if (!n) return 'No such lore';
  if (s.lore.includes(id)) return 'Already learned';
  if (n.req.length && !n.req.some(r => s.lore.includes(r))) return 'Learn a lore next to it first';
  if (s.acorns < n.cost) return `Needs ${n.cost} acorns`;
  return '';
}
export function buyLore(s: Save, id: string): string {
  const why = loreReason(s, id); if (why) return why;
  const n = LORE_BY_ID[id]; s.acorns -= n.cost; s.acornsSpent += n.cost; s.lore.push(id);
  return '';
}
export function perksFrom(s: Save): Perks {
  const p = noPerks();
  for (const id of s.lore) LORE_BY_ID[id]?.fx(p);
  return p;
}

// ── medals and trophies
export const medalKey = (map: string, diff: Diff, mode: Mode) => `${map}:${diff}:${mode}`;
export interface RunSummary {
  map: string; diff: Diff; mode: Mode; won: boolean; roundsWon: number; round: number; livesLost: number; pops: number; bossPops: number;
  towerXp: Record<string, number>; maxTier: number; heroLvl: number; placed: string[]; abilities: number; daily?: string; maxCash: number; freeplayRound: number;
}
export interface Trophy { id: string; name: string; desc: string; icon: number; test: (s: Save, r: RunSummary | null) => boolean }
const T = (id: string, icon: number, name: string, desc: string, test: Trophy['test']): Trophy => ({ id, icon, name, desc, test });
const won = (r: RunSummary | null) => !!r?.won;
export const TROPHIES: Trophy[] = [
  T('first-win', 8, 'First Festival', 'Win any run.', (s, r) => won(r)),
  T('win-easy', 8, 'Easy Breeze', 'Win on Easy.', (s, r) => won(r) && r!.diff === 'easy'),
  T('win-medium', 9, 'Steady Storm', 'Win on Medium. (Unlocks Dora\'s Moonlit Fiesta look.)', (s, r) => won(r) && r!.diff === 'medium'),
  T('win-hard', 13, 'Hard Rain', 'Win on Hard.', (s, r) => won(r) && r!.diff === 'hard'),
  T('flawless', 13, 'Not a Drop', 'Win without losing a single life.', (s, r) => won(r) && r!.livesLost === 0),
  T('endless', 15, 'Endless Storm', 'Win an Endless Storm.', (s, r) => won(r) && r!.mode === 'endless'),
  T('huracan', 15, 'Eye of the Storm', 'Pop Huracán.', (s, r) => !!r && r.round > 100),
  T('pop-10k', 10, 'Pop Ten Thousand', 'Pop 10,000 layers in all.', s => s.stats.pops >= 10000),
  T('pop-50k', 10, 'Pop Fifty Thousand', 'Pop 50,000 layers in all. (Unlocks Enzo\'s Harvest Gold look.)', s => s.stats.pops >= 50000),
  T('pop-250k', 10, 'Pop a Quarter Million', 'Pop 250,000 layers in all.', s => s.stats.pops >= 250000),
  T('tier5', 12, 'Masterwork', 'Buy a tier-5 upgrade.', (s, r) => (r?.maxTier ?? 0) >= 5),
  T('tier4', 12, 'Big Upgrade', 'Buy a tier-4 upgrade.', (s, r) => (r?.maxTier ?? 0) >= 4),
  T('all-towers', 14, 'Whole Crew', 'Build every kind of tower at least once.', s => TOWERS.every(t => s.stats.placed.includes(t.id))),
  T('hero-10', 9, 'Seasoned', 'Get a hero to level 10.', (s, r) => (r?.heroLvl ?? 0) >= 10),
  T('hero-20', 9, 'Legendary', 'Get a hero to level 20.', (s, r) => (r?.heroLvl ?? 0) >= 20),
  T('freeplay-100', 15, 'Round One Hundred', 'Reach round 100.', (s, r) => (r?.round ?? 0) >= 100),
  T('onekind', 4, 'One of a Kind', 'Win a Single Kind run.', (s, r) => won(r) && r!.mode === 'onekind'),
  T('reverse', 3, 'Uphill Battle', 'Win an Uphill run.', (s, r) => won(r) && r!.mode === 'reverse'),
  T('lean', 5, 'Lean Times', 'Win Lean Harvest.', (s, r) => won(r) && r!.mode === 'lean'),
  T('nightfall', 6, 'Night Watch', 'Win Nightfall.', (s, r) => won(r) && r!.mode === 'nightfall'),
  T('daily-1', 13, 'Daily Dancer', 'Win a daily challenge.', s => s.stats.dailyWins >= 1),
  T('daily-3', 13, 'Three in a Row', 'Win the daily three days running.', s => s.daily.streak >= 3),
  T('lore-10', 0, 'Lore Keeper', 'Learn 10 Burrow Lore.', s => s.lore.length >= 10),
  T('lore-branch', 0, 'Branch Master', 'Learn a whole Burrow Lore branch.', s => BRANCHES.some(b => LORE.filter(n => n.branch === b.id).every(n => s.lore.includes(n.id)))),
  T('medals-10', 0, 'Medal Shelf', 'Earn 10 medals.', s => s.medals.length >= 10),
  T('medals-30', 0, 'Medal Wall', 'Earn 30 medals.', s => s.medals.length >= 30),
  T('expert', 15, 'Summit Climber', 'Win on an expert map.', (s, r) => won(r) && MAP[r!.map]?.tier === 'expert'),
  T('all-maps', 4, 'Every Valley', 'Earn a medal on every map.', s => MAPS.every(m => s.medals.some(k => k.startsWith(m.id + ':')))),
  T('rich', 10, 'Festival Treasury', 'Hold $20,000 at once.', (s, r) => (r?.maxCash ?? 0) >= 20000),
  T('boss-50', 15, 'Storm Breaker', 'Break 50 boss shells in all.', s => s.stats.bossPops >= 50),
  T('abilities-50', 14, 'Showtime', 'Use 50 abilities in all.', s => s.stats.abilities >= 50),
  T('level-10', 9, 'Valley Elder', 'Reach player level 10.', s => playerLevel(s.xp) >= 10),
];
export const TROPHY_BY_ID: Record<string, Trophy> = Object.fromEntries(TROPHIES.map(t => [t.id, t]));
export const SKIN_TROPHY: Record<string, string> = { moonlit: 'win-medium', harvest: 'pop-50k' };

export const DIFF_XP: Record<Diff, number> = { easy: 1, medium: 1.5, hard: 2 };
export const WIN_ACORNS: Record<Diff, number> = { easy: 6, medium: 10, hard: 16 };

export interface RunReward { xp: number; acorns: number; medal: string; newTrophies: string[]; towerXp: Record<string, number>; levelBefore: number; levelAfter: number; unlocked: string[] }
/** bank a finished run into the save */
export function finishRun(s: Save, r: RunSummary): RunReward {
  const levelBefore = playerLevel(s.xp);
  const k = DIFF_XP[r.diff];
  const xp = Math.round(r.roundsWon * 10 * k + (r.won ? 200 * k : 0));
  s.xp += xp; s.stats.games++;
  s.stats.pops += r.pops; s.stats.bossPops += r.bossPops; s.stats.abilities += r.abilities;
  for (const p of r.placed) if (!s.stats.placed.includes(p)) s.stats.placed.push(p);
  s.stats.best[r.map] = Math.max(s.stats.best[r.map] ?? 0, r.round);
  const txp: Record<string, number> = {};
  for (const [id, n] of Object.entries(r.towerXp)) if (TOWER[id]) { const g = Math.round(n * (0.5 + 0.25 * k)); txp[id] = g; s.towerXp[id] = (s.towerXp[id] ?? 0) + g; }
  let acorns = Math.floor(r.roundsWon / 5);
  let medal = '';
  if (r.won) {
    s.stats.wins++;
    acorns += WIN_ACORNS[r.diff] * (r.mode === 'standard' || r.mode === 'daily' ? 1 : 1.5);
    if (r.daily) {
      if (!s.daily.done.includes(r.daily)) {
        s.daily.done.push(r.daily); acorns += 12; s.stats.dailyWins++;
        s.daily.streak = s.daily.last === prevDay(r.daily) ? s.daily.streak + 1 : 1; s.daily.last = r.daily;
      }
    } else {
      const key = medalKey(r.map, r.diff, r.mode);
      if (!s.medals.includes(key)) { s.medals.push(key); medal = key; acorns += 5; }
    }
  }
  if (s.lore.includes('l9')) acorns *= 1.2;
  acorns = Math.round(acorns);
  const newTrophies: string[] = [];
  for (const t of TROPHIES) if (!s.trophies.includes(t.id) && t.test(s, r)) { s.trophies.push(t.id); newTrophies.push(t.id); acorns += 3; }
  s.acorns += acorns;
  const unlocked: string[] = [];
  if (!s.heroes.includes('enzo') && (s.stats.wins >= 1 || playerLevel(s.xp) >= 3)) { s.heroes.push('enzo'); unlocked.push('hero:enzo'); }
  for (const [skin, tr] of Object.entries(SKIN_TROPHY)) if (s.trophies.includes(tr) && !s.skins.includes(skin)) { s.skins.push(skin); unlocked.push('skin:' + skin); }
  const levelAfter = playerLevel(s.xp);
  for (const t of TOWERS) if (t.level > levelBefore && t.level <= levelAfter) unlocked.push('tower:' + t.id);
  for (const m of MAPS) if (m.level > levelBefore && m.level <= levelAfter) unlocked.push('map:' + m.id);
  return { xp, acorns, medal, newTrophies, towerXp: txp, levelBefore, levelAfter, unlocked };
}

// ── the daily challenge: one seeded setup per calendar day
export function dayKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function prevDay(key: string): string { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1)); }
export interface Daily { key: string; map: string; diff: Diff; startRound: number; lastRound: number; startCash: number; towers: TowerId[]; hero: HeroId; title: string }
export function daily(key: string): Daily {
  const r = rng(hashStr('cloudpop-daily-' + key));
  const maps = MAPS.filter(m => m.tier !== 'expert');
  const map = maps[Math.floor(r() * maps.length)].id;
  const diff: Diff = r() < 0.5 ? 'easy' : 'medium';
  const startRound = 5 + Math.floor(r() * 20);
  const lastRound = startRound + 14;
  const pool = TOWERS.filter(t => !t.income).map(t => t.id);
  const towers: TowerId[] = [];
  while (towers.length < 4) { const t = pool[Math.floor(r() * pool.length)]; if (!towers.includes(t)) towers.push(t); }
  if (!towers.includes('lantern') && !towers.some(t => t === 'pebble' || t === 'busker')) towers[3] = 'busker';
  const startCash = 650 + Math.round((startRound - 1) * 160);
  const hero: HeroId = r() < 0.5 ? 'dora' : 'enzo';
  const titles = ['Market Morning', 'Wind from the Pass', 'Rain on the Terraces', 'Llama Day', 'Lantern Night', 'Hail at Noon', 'The Long Drizzle'];
  return { key, map, diff, startRound, lastRound, startCash, towers, hero, title: titles[Math.floor(r() * titles.length)] };
}
export function dailyConfig(d: Daily, s: Save): RunConfig {
  return { map: d.map, diff: d.diff, mode: 'daily', seed: hashStr(d.key), assist: s.settings.assist, hero: d.hero, startRound: d.startRound, lastRound: d.lastRound, startCash: d.startCash, allowed: d.towers, perks: perksFrom(s) };
}

/** the run config for a normal run from the save */
export function runConfig(s: Save, map: string, diff: Diff, mode: Mode, seed: number, oneKind?: TowerId): RunConfig {
  const allowed = TOWERS.filter(t => towerUnlocked(s, t.id)).map(t => t.id).filter(id => mode !== 'onekind' || id === oneKind);
  const unlocked: Partial<Record<TowerId, [number, number, number]>> = {};
  for (const t of TOWERS) unlocked[t.id] = tierCaps(s, t.id);
  return { map, diff, mode, seed, assist: s.settings.assist, hero: s.hero, skin: s.skin[s.hero], perks: perksFrom(s), unlocked, allowed };
}
export { MODES };

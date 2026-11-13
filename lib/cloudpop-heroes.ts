// Cloudpop: the two heroes. Pick Dora or Enzo before a run; the hero is placed like a tower (once), levels 1-20
// from the puffs it and the towers pop, and unlocks three activated abilities at levels 3, 10 and 20.
import { atk, stats, ability, type Stats, type Ability } from './cloudpop-towers.js';

export type HeroId = 'dora' | 'enzo';
export interface HeroLevel { lvl: number; text: string; fx: (s: Stats, h: HeroState) => void }
export interface HeroState { abilities: Ability[]; auraRangeMul: number; auraPierce: number; auraRate: number; discount: number }
export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  blurb: string;
  cost: number;
  r: number;
  base: () => Stats;
  levels: HeroLevel[];
  skins: { id: string; name: string; trophy: string }[];
}

/** total XP to reach each level (index = level) */
export const HERO_XP: number[] = [0, 0];
for (let l = 2; l <= 20; l++) HERO_XP[l] = HERO_XP[l - 1] + Math.round(180 * Math.pow(l - 1, 1.55));

const M = (s: Stats) => s.atks[0];

export const HEROES: Record<HeroId, HeroDef> = {
  dora: {
    id: 'dora', name: 'Dora', title: 'Festival Dancer', cost: 520, r: 26,
    blurb: 'Quick and bright. Flings handfuls of festival petals that slice through puffs, and dances the whole valley faster.',
    base: () => stats({ atks: [atk({ id: 'main', label: 'Petal fling', kind: 'shot', dmg: 1, pierce: 3, rate: 0.55, range: 175, speed: 780, count: 1 })] }),
    skins: [{ id: 'moonlit', name: 'Moonlit Fiesta', trophy: 'win-medium' }],
    levels: [
      { lvl: 2, text: 'Flings faster.', fx: s => { M(s).rate *= 0.85; } },
      { lvl: 3, text: 'Ability: Ribbon Whirl spins through every puff around her (12 damage each).', fx: (s, h) => { h.abilities.push(ability({ id: 'whirl', name: 'Ribbon Whirl', kind: 'nova', cd: 35, power: 12, radius: 230, desc: 'Every puff within 230 takes 12.' })); } },
      { lvl: 4, text: 'Petals pass through two more puffs.', fx: s => { M(s).pierce += 2; } },
      { lvl: 5, text: 'Sees night clouds.', fx: s => { s.sight = true; } },
      { lvl: 6, text: 'Hits harder.', fx: s => { M(s).dmg += 1; } },
      { lvl: 7, text: 'Towers near her reach 10% further.', fx: s => { s.aura = 190; s.auraRangeMul *= 1.1; } },
      { lvl: 8, text: 'Two petals per fling.', fx: s => { M(s).count = 2; M(s).spread = 0.2; } },
      { lvl: 9, text: 'Flings faster.', fx: s => { M(s).rate *= 0.85; } },
      { lvl: 10, text: 'Ability: Sun Dance makes every tower 40% faster for 10 seconds.', fx: (s, h) => { h.abilities.push(ability({ id: 'sundance', name: 'Sun Dance', kind: 'rally', cd: 60, power: 0.6, dur: 10, radius: 0, desc: 'Every tower attacks 40% faster for 10 seconds.' })); } },
      { lvl: 11, text: 'Hits harder; petals now Magic.', fx: s => { M(s).dmg += 1; M(s).dtype = 'magic'; } },
      { lvl: 12, text: 'Reaches further.', fx: s => { M(s).range += 35; } },
      { lvl: 13, text: 'Ribbon Whirl hits three times as hard.', fx: (s, h) => { const a = h.abilities.find(x => x.id === 'whirl'); if (a) a.power = 36; } },
      { lvl: 14, text: 'Towers near her hit one more puff.', fx: s => { s.auraPierce += 1; } },
      { lvl: 15, text: 'Three petals per fling.', fx: s => { M(s).count = 3; M(s).spread = 0.32; } },
      { lvl: 16, text: 'Flings faster.', fx: s => { M(s).rate *= 0.8; } },
      { lvl: 17, text: 'Much harder hits; strong against bosses.', fx: s => { M(s).dmg += 2; M(s).bossMult += 1; } },
      { lvl: 18, text: 'Sun Dance lasts 15 seconds.', fx: (s, h) => { const a = h.abilities.find(x => x.id === 'sundance'); if (a) a.dur = 15; } },
      { lvl: 19, text: 'Towers near her attack 10% faster.', fx: s => { s.auraRate *= 0.9; } },
      { lvl: 20, text: 'Ability: Inti\'s Blaze sets the whole sky alight: 400 damage to every puff.', fx: (s, h) => { M(s).dmg += 3; h.abilities.push(ability({ id: 'blaze', name: 'Inti\'s Blaze', kind: 'nova', cd: 90, power: 400, radius: 0, desc: 'Every puff on the map takes 400.' })); } },
    ],
  },
  enzo: {
    id: 'enzo', name: 'Enzo', title: 'Storm Scholar', cost: 600, r: 26,
    blurb: 'Steady and clever. Lobs clay pots that burst on a crowd, reads the weather to slow it, and calls lightning down on bosses.',
    base: () => stats({ atks: [atk({ id: 'main', label: 'Clay pot', kind: 'lob', dmg: 1, pierce: 8, rate: 1.1, range: 170, dtype: 'heavy', speed: 520, splash: 44, arc: true })] }),
    skins: [{ id: 'harvest', name: 'Harvest Gold', trophy: 'pop-50k' }],
    levels: [
      { lvl: 2, text: 'Wider bursts.', fx: s => { M(s).splash += 10; } },
      { lvl: 3, text: 'Ability: Weather Vane slows every puff to half speed for 6 seconds.', fx: (s, h) => { h.abilities.push(ability({ id: 'vane', name: 'Weather Vane', kind: 'flood', cd: 40, power: 0.5, dur: 6, desc: 'Every puff moves at half speed for 6 seconds.' })); } },
      { lvl: 4, text: 'Hits harder.', fx: s => { M(s).dmg += 1; } },
      { lvl: 5, text: 'Towers near him cost 5% less to buy and upgrade.', fx: s => { s.aura = 180; s.discount = 0.05; } },
      { lvl: 6, text: 'Lobs faster.', fx: s => { M(s).rate *= 0.85; } },
      { lvl: 7, text: 'Pots are Magic: they hurt Rumbles too.', fx: s => { M(s).dtype = 'magic'; } },
      { lvl: 8, text: 'Bursts hit more puffs.', fx: s => { M(s).pierce += 8; } },
      { lvl: 9, text: 'Sees night clouds.', fx: s => { s.sight = true; } },
      { lvl: 10, text: 'Ability: Lightning Rod hits the strongest puff for 2500 and chains to ten more.', fx: (s, h) => { h.abilities.push(ability({ id: 'rod', name: 'Lightning Rod', kind: 'strike', cd: 60, power: 2500, radius: 10, desc: 'Hits the strongest puff for 2500, then ten more for 250.' })); } },
      { lvl: 11, text: 'Hits harder.', fx: s => { M(s).dmg += 1; } },
      { lvl: 12, text: 'Reaches further.', fx: s => { M(s).range += 35; } },
      { lvl: 13, text: 'Towers near him cost 10% less.', fx: s => { s.discount = 0.1; } },
      { lvl: 14, text: 'Two pots per throw.', fx: s => { M(s).count = 2; M(s).spread = 0.3; } },
      { lvl: 15, text: 'Strong against bosses.', fx: s => { M(s).bossMult += 2; } },
      { lvl: 16, text: 'Weather Vane slows for 10 seconds.', fx: (s, h) => { const a = h.abilities.find(x => x.id === 'vane'); if (a) a.dur = 10; } },
      { lvl: 17, text: 'Much harder hits.', fx: s => { M(s).dmg += 3; } },
      { lvl: 18, text: 'Lightning Rod hits for 6000.', fx: (s, h) => { const a = h.abilities.find(x => x.id === 'rod'); if (a) a.power = 6000; } },
      { lvl: 19, text: 'Lobs faster.', fx: s => { M(s).rate *= 0.8; } },
      { lvl: 20, text: 'Ability: Clear Skies strips night and fog from every puff and hits each for 500.', fx: (s, h) => { M(s).dmg += 4; h.abilities.push(ability({ id: 'clear', name: 'Clear Skies', kind: 'nova', cd: 100, power: 500, radius: 0, desc: 'Every puff loses night and fog and takes 500.' })); } },
    ],
  },
};
export const HERO_IDS: HeroId[] = ['dora', 'enzo'];

/** a hero's stats and abilities at a level */
export function heroStats(id: HeroId, lvl: number): { s: Stats; h: HeroState } {
  const d = HEROES[id], s = d.base();
  const h: HeroState = { abilities: [], auraRangeMul: 1, auraPierce: 0, auraRate: 1, discount: 0 };
  for (const L of d.levels) if (L.lvl <= lvl) L.fx(s, h);
  return { s, h };
}
export function heroLevelFor(xp: number): number {
  let l = 1;
  while (l < 20 && xp >= HERO_XP[l + 1]) l++;
  return l;
}

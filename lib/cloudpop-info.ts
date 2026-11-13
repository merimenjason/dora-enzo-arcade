// Cloudpop: words for numbers. Builds a tower's stats at any tiers and the plain-language list of what an upgrade
// changes ("Pierce 2 → 3", "Sees night clouds", "New attack: Flame jet"), so the upgrade panel never has to guess.
import { TOWER } from './cloudpop-towerdata.js';
import { DTYPE_NAME } from './cloudpop-puffs.js';
import type { Stats, Atk, TowerId } from './cloudpop-towers.js';

export function statsAt(id: TowerId, tiers: readonly number[]): Stats {
  const d = TOWER[id], s = d.base();
  for (let p = 0; p < 3; p++) for (let i = 0; i < tiers[p]; i++) d.paths[p][i].fx(s);
  return s;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const perSec = (rate: number) => r1(1 / rate);

/** the headline numbers of one attack */
export function atkLine(a: Atk): string {
  const bits = [`${a.dmg > 0 ? a.dmg : 0} dmg`, `pierce ${a.pierce}`, `${perSec(a.rate)}/s`, `range ${Math.round(a.range)}`, DTYPE_NAME[a.dtype]];
  if (a.count > 1) bits.push(`×${a.count}`);
  if (a.splash) bits.push(`splash ${a.splash}`);
  return bits.join(' · ');
}

export function diffStats(a: Stats, b: Stats): string[] {
  const out: string[] = [];
  const cmp = (label: string, x: number, y: number, fmt = (n: number) => String(r1(n))) => { if (Math.abs(x - y) > 1e-6) out.push(`${label} ${fmt(x)} → ${fmt(y)}`); };
  for (const nb of b.atks) {
    const na = a.atks.find(q => q.id === nb.id);
    const pre = b.atks.length > 1 ? `${nb.label}: ` : '';
    if (!na) { out.push(`New attack: ${nb.label} (${atkLine(nb)})`); continue; }
    if (na.label !== nb.label) out.push(`${na.label} becomes ${nb.label}`);
    cmp(pre + 'Damage', na.dmg, nb.dmg);
    cmp(pre + 'Pierce', na.pierce, nb.pierce);
    cmp(pre + 'Attacks/s', 1 / na.rate, 1 / nb.rate);
    cmp(pre + 'Range', na.range, nb.range, n => String(Math.round(n)));
    cmp(pre + 'Shots', na.count, nb.count);
    cmp(pre + 'Splash', na.splash, nb.splash);
    cmp(pre + 'Bounces', na.bounce, nb.bounce);
    cmp(pre + 'Sparks', na.shards, nb.shards);
    cmp(pre + 'Boss damage ×', na.bossMult, nb.bossMult);
    cmp(pre + 'Knock-back', na.knock, nb.knock);
    cmp(pre + 'Freeze s', na.freeze, nb.freeze);
    cmp(pre + 'Stun s', na.stun, nb.stun);
    cmp(pre + 'Stings/s', na.dot, nb.dot);
    cmp(pre + 'Extra hit on frozen', na.brittle, nb.brittle);
    cmp(pre + 'Fog damage ×', na.fogMult, nb.fogMult);
    if (na.dtype !== nb.dtype) out.push(`${pre}${DTYPE_NAME[na.dtype]} → ${DTYPE_NAME[nb.dtype]}`);
    if (JSON.stringify(na.slow) !== JSON.stringify(nb.slow) && nb.slow) out.push(`${pre}Slows to ${Math.round(nb.slow[0] * 100)}% for ${nb.slow[1]} s`);
    if (JSON.stringify(na.burn) !== JSON.stringify(nb.burn) && nb.burn) out.push(`${pre}Burns ${nb.burn[0]}/s for ${nb.burn[1]} s`);
    if (!na.homing && nb.homing) out.push(`${pre}Shots home in`);
    if (!na.slowBoss && nb.slowBoss) out.push(`${pre}Slows bosses too`);
    if (!na.dotBoss && nb.dotBoss) out.push(`${pre}Stings bosses too`);
    if (na.freezeBoss !== nb.freezeBoss) out.push(`${pre}Freezes bosses ${nb.freezeBoss} s`);
    if (na.stunBoss !== nb.stunBoss) out.push(`${pre}Stuns bosses ${nb.stunBoss} s`);
    if (!na.stripNight && nb.stripNight) out.push(`${pre}Washes night off puffs`);
    if (!na.stripFog && nb.stripFog) out.push(`${pre}Clears fog so it can't regrow`);
    if (na.knockBoss !== nb.knockBoss) out.push(`${pre}Pushes bosses ${Math.round(nb.knockBoss * 100)}%`);
    if (na.grabRank !== nb.grabRank || na.grabBoss !== nb.grabBoss) out.push(nb.grabBoss ? `${pre}Can lift bosses` : `${pre}Lifts puffs back to the start`);
  }
  if (!a.sight && b.sight) out.push('Sees night clouds');
  cmp('Glow radius', a.aura, b.aura, n => String(Math.round(n)));
  if (!a.auraSight && b.auraSight) out.push('Towers in the glow see night clouds');
  if (a.auraRate !== b.auraRate) out.push(`Towers nearby ${Math.round((1 / b.auraRate - 1) * 100)}% faster`);
  cmp('Towers nearby: pierce +', a.auraPierce, b.auraPierce);
  cmp('Towers nearby: damage +', a.auraDmg, b.auraDmg);
  cmp('Towers nearby: boss damage +', a.auraBoss, b.auraBoss);
  if (a.auraRangeMul !== b.auraRangeMul) out.push(`Towers nearby reach ${Math.round((b.auraRangeMul - 1) * 100)}% further`);
  if (a.discount !== b.discount) out.push(`${Math.round(b.discount * 100)}% off towers and upgrades in range`);
  if (JSON.stringify(a.chill) !== JSON.stringify(b.chill) && b.chill) out.push(`Chill field: puffs move at ${Math.round(b.chill[0] * 100)}% within ${b.chill[1]}`);
  if (!a.chillFrost && b.chillFrost) out.push('Chill slows Frost puffs too');
  if (a.chillBoss !== b.chillBoss) out.push(`Chill slows bosses to ${Math.round(b.chillBoss * 100)}%`);
  cmp('Income $/round', a.income, b.income);
  cmp('Lives/round', a.lives, b.lives);
  if (a.interest !== b.interest) out.push(`${Math.round(b.interest * 100)}% interest each round`);
  cmp('Patrol radius', a.patrol, b.patrol);
  cmp('Condors', a.fliers, b.fliers);
  if (!a.hunt && b.hunt) out.push('Flies to the front puffs');
  if (a.sellBonus !== b.sellBonus) out.push(`All towers sell for ${Math.round(b.sellBonus * 100)}% more`);
  if (b.ability && b.ability.id !== a.ability?.id) out.push(`Ability: ${b.ability.name} (every ${b.ability.cd} s): ${b.ability.desc}`);
  return out;
}

/** what buying the next tier on a path would change */
export function upgradeDiff(id: TowerId, tiers: readonly number[], path: number): string[] {
  const next = [...tiers]; next[path]++;
  return diffStats(statsAt(id, tiers), statsAt(id, next));
}

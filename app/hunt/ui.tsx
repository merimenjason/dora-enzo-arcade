// Grumble Hunt page helpers: names and wording for the HUD and panels, the painted-atlas icons, and the save reader.
import { V5_SAVE_KEY, HuntGame, SAVE_KEY, V1_SAVE_KEY, V2_SAVE_KEY, V3_SAVE_KEY, V4_SAVE_KEY, type Hero, type ItemId, type MaterialId } from '@/lib/grumble-hunt-game';
import { STORY, POST_GAME_WEAPONS, WEAPON_TYPES, BASIC_WEAPONS, type WeaponType, ITEMS, MATERIALS, type Cost, type ItemEffect, type SnackEffect } from '@/lib/grumble-hunt-content';

export const AREA_NAMES: Record<string, string> = { meadow: 'Clover Meadow', marsh: 'Soggy Marsh', ridge: 'Windy Ridge', hollow: 'Pebble Hollow', peak: 'Frosty Peak' };
export const WEATHER_NAMES: Record<string, string> = { rain: 'Rain shower', mist: 'Mist', dust: 'Dust storm', blizzard: 'Blizzard' };
export const itemText = (e: ItemEffect) => e.kind === 'heal' ? `Restores ${e.fluff} Fluff.` : e.kind === 'drowsy' ? `Toss within 10 steps: the beast moves ${Math.round(e.slow * 100)}% slower for ${e.seconds} s.` : e.kind === 'dizzy' ? `Ring it beside the beast: +${e.amount} Dizzy.` : e.kind === 'trap' ? `A trap: the beast is stuck for ${e.seconds} s. One at a time.` : e.kind === 'hide' ? `Hide in smoke for ${e.seconds} s; the beast loses track and wanders.` : e.kind === 'track' ? `Glowing pawprints lead to the beast for ${e.seconds} s.` : 'A snack ingredient.';
export const snackText = (e: SnackEffect) => e.maxFluff ? `+${e.maxFluff} max Fluff` : e.staminaRegen ? `Rolls recover ${Math.round(e.staminaRegen * 100)}% faster` : e.dizzyBonus ? `+${Math.round(e.dizzyBonus * 100)}% Dizzy on every hit` : 'One extra rare-material roll at nap time';
/** The befriended-beast count the Pantry needs for something from a story chapter. */
export const opensAfter = (chapter: number) => `Opens in chapter ${chapter}`;
/** The result card's note after a story chapter: the next chapter, and any weapon it opens at the rack. */
export function nextChapterNote(id: number) {
  const next = STORY[id], opened = (next.unlocks.weapons ?? []).filter((t) => !BASIC_WEAPONS.includes(t)).map((t) => WEAPON_TYPES[t].name);
  return `Chapter ${id}, ${next.title}, is ready at the hunt board${opened.length ? `, and the ${opened.join(' and ')} is ready at the rack` : ''}!`;
}
export const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Cells of the painted atlases in public/art/hunt: tool tiers in icons-gear, beast materials in icons-materials and icons-materials-2. */
export const WEAPON_ICONS: Record<WeaponType, [number, number, number, number]> = {
  feather: [5, 8, 10, 11], puffer: [5, 12, 14, 15], pogo: [6, 0, 2, 3], umbrella: [6, 4, 6, 7],
  hammer: [1, 0, 2, 9], claws: [1, 3, 5, 11], bow: [1, 6, 8, 10], lance: [2, 0, 2, 12],
  wand: [2, 3, 5, 13], yoyo: [2, 6, 8, 14], greatsword: [3, 0, 2, 15], katana: [3, 3, 5, 15],
  sword: [3, 6, 8, 0], horn: [3, 9, 11, 1], gunlance: [3, 12, 14, 2], switchaxe: [4, 0, 2, 3],
  chargeblade: [4, 3, 5, 4], glaive: [4, 6, 8, 5], lightbow: [4, 9, 11, 6], heavybow: [4, 12, 14, 7],
};
export function WeaponIcon({ type, tier = 1, size = 44 }: { type: WeaponType; tier?: number; size?: number }) {
  const [sheet, base, final, glimmer] = WEAPON_ICONS[type];
  const lastSheet = POST_GAME_WEAPONS.includes(type) ? sheet : sheet === 1 ? 2 : type === 'katana' ? 4 : sheet >= 3 && type !== 'greatsword' ? 5 : sheet;
  return <Art sheet={sheet === 1 && tier !== 5 ? 'icons-gear' : `icons-weapons-${tier === 5 ? lastSheet : sheet}`} cell={tier === 5 ? glimmer : tier >= 3 ? final : base + tier - 1} size={size} />;
}
// What a held K does with each tool, in the words the HUD uses.
export const RELEASE_NAMES: Partial<Record<WeaponType, string>> = { horn: 'play a song', glaive: 'send the firefly', lightbow: 'swap acorns', chargeblade: 'switch', switchaxe: 'switch', lance: 'counter-thrust', heavybow: 'acorn flurry', feather: 'double-tickle' };
export const BIG_NAMES: Partial<Record<WeaponType, string[]>> = { hammer: ['Big bonk', 'Mega bonk'], bow: ['Two-seed shot', 'Three-seed shot'], wand: ['Big bubble'], yoyo: ['Loop-the-Loop'], puffer: ['Big Breath'], pogo: ['High Bounce'] };
export function chargeText(g: HuntGame) {
  const h = g.hold(), type = g.weapon(), big = BIG_NAMES[type] ?? ['Big bonk'];
  if (g.hero.cooldown > 0) return 'Tool recovering';
  if (h.kind === 'guard') return `Guarding · stamina ${Math.ceil(g.stamina)}%${type === 'umbrella' ? ' · tap J to spin' : ''}`;
  if (type === 'puffer' && g.breath > 0) return `Big Breath back in ${Math.ceil(g.breath)}s`;
  if (h.kind === 'release') return `Let go of K to ${RELEASE_NAMES[type] ?? 'use it'}`;
  if (h.kind === 'charge') return h.level ? `${big[h.level - 1]} ready${h.level < h.levels ? ' · keep holding' : '!'}` : 'Charging…';
  return g.guardTool() ? 'Hold K to guard' : h.levels ? 'Hold K to charge' : `Hold K to ${RELEASE_NAMES[type] ?? 'use it'}`;
}
/** The charge bar under the hero: its fill reaches each notch as a level is ready. */
export function ChargeMeter({ g }: { g: HuntGame }) {
  const h = g.hold(); if (h.kind !== 'charge' && h.kind !== 'guard') return null;
  const full = h.levels === 2 ? 1 : 0.35, fill = h.kind === 'guard' ? g.stamina / 100 : Math.min(1, h.amount / full);
  return <div className="hunt-charge" data-testid="charge-meter" data-kind={h.kind} data-level={h.level} data-full={h.kind === 'charge' && h.level === h.levels}>
    <span className="hunt-charge-bar"><span style={{ width: `${fill * 100}%` }} />{h.levels === 2 && <i style={{ left: '35%' }} />}</span>
    <strong>{chargeText(g)}</strong>
  </div>;
}
export const MOODS = ['happy', 'determined', 'dizzy', 'sleepy'];
/** Portrait cell: dizzy just after a bump, sleepy when Fluff is low, determined while swinging or charging. */
export const heroMood = (h: Hero) => h.invincible > 0 ? 2 : h.fluff < 30 ? 3 : h.charge > 0 || h.swing >= 0 ? 1 : 0;
export function Art({ sheet, cell, size, grid = 4 }: { sheet: string; cell: number; size: number; grid?: number }) {
  const at = (n: number) => `${(n / (grid - 1)) * 100}%`;
  return <span className="hunt-art" aria-hidden="true" style={{ width: size, height: size, backgroundImage: `url(/art/hunt/${sheet}.webp)`, backgroundSize: `${grid * 100}%`, backgroundPosition: `${at(cell % grid)} ${at(Math.floor(cell / grid))}` }} />;
}
/** A material or item icon, from whichever sheet holds it. */
export const Icon = ({ id, size }: { id: MaterialId | ItemId; size: number }) => id in MATERIALS ? <Art sheet={MATERIALS[id as MaterialId].icon >= 16 ? 'icons-materials-2' : 'icons-materials'} cell={MATERIALS[id as MaterialId].icon % 16} size={size} /> : <Art sheet="icons-items" cell={ITEMS[id as ItemId].icon} size={size} />;
export const nameOf = (id: MaterialId | ItemId) => id in MATERIALS ? MATERIALS[id as MaterialId].name : ITEMS[id as ItemId].name;
/** Cost chips: the icon, then what you have of what it needs. */
export const Costs = ({ cost, have }: { cost: Cost; have: Record<string, number> }) => <span className="hunt-costs">{Object.entries(cost).map(([id, n]) => <span key={id} title={nameOf(id as MaterialId)} data-short={(have[id] ?? 0) < (n ?? 0)}><Icon id={id as MaterialId} size={22} />{have[id] ?? 0}/{n}</span>)}</span>;
/** The v2 save, or the first build's v1 save when there is no v2 yet. */
export function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(V5_SAVE_KEY) || localStorage.getItem(V4_SAVE_KEY) || localStorage.getItem(V3_SAVE_KEY) || localStorage.getItem(V2_SAVE_KEY) || localStorage.getItem(V1_SAVE_KEY) || 'null'); } catch { return null; } }

/** A time in tenths of a second, as minutes and seconds. */
export const seconds = (tenths: number) => tenths >= 600 ? `${Math.floor(tenths / 600)} min ${(tenths % 600 / 10).toFixed(1)} s` : `${(tenths / 10).toFixed(1)} s`;

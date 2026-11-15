// Jade Street: the save (localStorage 'jade-street-v10'), its repair and migration, progression (districts opened by the
// story, reputation tiers, safe houses, outfits, garage upgrades and paint), trophies and the stats screen.
// Version 1 saves (the pre-release shape: `money`, `done` as a comma string, one shared rep number) and version 2 saves
// (the first release, 'jade-street-v2': no medals, story flags, lessons, messages or radio) and version 3 saves (the
// second release: no businesses, no Reduce shake), version 4 saves (the third release: no gadgets), version 5 saves
// (no Singapore streets), version 6 saves (no island: no MRT or taxi counts, no island ending) and version 7 saves (no
// job-step counts: photos, heists, traps and the rest) and version 8 saves (no partner setting, no lure, partner-help
// or kopi-bribe counts) and version 9 saves (no Little India, Kampong Glam or Sentosa: no cable car, ferry or
// festival counts, no chapter-seven ending) migrate forward, keeping every bit of progress, medals included.
import { DISTRICTS, type District } from './jade-city.js';
import { emptyCargo, GOODS, type Cargo, type Tip } from './jade-trade.js';
import { MISSIONS, SIDE, MISSION, CHAPTER_OPENS, FINALE, RESORT_OPENS } from './jade-story.js';
import { hashStr, rng } from './jade-rng.js';
import { asDiff, type Diff } from './jade-diff.js';
import { BIZ, newBiz, type BizState } from './jade-biz.js';
import { newGear, giveGadget, clipOf, ammoCap, GEAR_GIFT, GADGET_IDS, type GearState, type GadgetId } from './jade-gear.js';

export const SAVE_KEY = 'jade-street-v10';
export const OLD_KEYS = ['jade-street-v9', 'jade-street-v8', 'jade-street-v7', 'jade-street-v6', 'jade-street-v5', 'jade-street-v4', 'jade-street-v3', 'jade-street-v2', 'jade-street-v1'];
export const SAVE_VERSION = 10;
export type Hero = 'dora' | 'enzo';
/** `keys`: remapped keyboard actions (action -> KeyboardEvent.code); `bigText`: larger HUD text; `cbMarks`: colour-blind-safe
 * markers (shapes and patterns, not only colour) */
export type Settings = { sound: boolean; music: boolean; assist: boolean; diff: Diff; touch: 'auto' | 'on' | 'off'; shake: boolean; calm: boolean; keys: Record<string, string>; bigText: boolean; cbMarks: boolean;
  /** the partner's own initiative (lib/jade-pal.ts): helps on their own, only when you press F, or off */
  partner: PartnerMode };
export type PartnerMode = 'auto' | 'tag' | 'off';
export const PARTNER_MODES: PartnerMode[] = ['auto', 'tag', 'off'];
export type Stats = { walked: number; driven: number; boated: number; missions: number; gigs: number; trades: number; profit: number; caught: number; escapes: number; bumps: number; cats: number; murals: number; maxHeat: number; playTime: number; minis: number; bizCoins: number; shots: number; tags: number; switches: number; tolls: number; junk: number; kopi: number; chope: number;
  /** the island: Jade Line rides, taxi rides */
  mrt: number; taxi: number;
  /** the job steps: photos taken casing, heists (and quiet ones), stands held, disguises worn, clues found, traps
   * sprung full, crates swapped */
  photos: number; heists: number; quiet: number; defends: number; disguises: number; clues: number; traps: number; swaps: number;
  /** the eighth pass: guards lured by a noise you made, the partner's own help, witnesses bribed with kopi */
  lures: number; palHelps: number; bribes: number;
  /** the ninth pass: cable car and ferry rides, Deepavali lamps lit and Hari Raya bazaar treats, mynahs caught */
  cable: number; ferry: number; lamps: number; kuih: number; mynahs: number };
export type Save = {
  v: number; seed: number; hero: Hero; started: boolean;
  cash: number; night: number; clock: number; cargo: Cargo; stash: Cargo;
  done: string[]; rep: Record<District, number>;
  /** the job you were in when the game was last saved (a reload offers it again), if any */
  jobOpen?: string;
  upgrades: { speed: number; grip: number; cargo: number }; paint: string;
  outfits: Record<Hero, string[]>; outfit: Record<Hero, string>;
  cats: number[]; murals: string[]; trophies: string[]; tips: Tip[];
  safe: string; best: Record<string, number>; daily: string; dailyDone: string[];
  stats: Stats; settings: Settings;
  /** best result per story job: medal tier (0 finished, 1 bronze, 2 silver, 3 gold), best time, plays */
  medals: Record<string, Medal>;
  /** the storybook: the opening seen, the last chapter card shown, the ending seen, the island's ending seen */
  story: { intro: boolean; ch: number; ending: boolean; isle: boolean; lights: boolean };
  /** onboarding lessons already learned */
  learned: string[];
  /** texts on the phone */
  msgs: Msg[];
  /** the ride radio station (index into the ride's stations; -1 off) */
  radio: number;
  /** street events helped with */
  helped: number;
  /** the businesses you own (lib/jade-biz.ts) and the quarter's takings for the last nights */
  biz: Record<string, BizState>; bizLog: number[];
  /** the cartoon gadgets: owned, ammo, upgrades, who carries what (lib/jade-gear.ts) */
  gear: GearState;
  /** pocket things for the Singapore streets: tissue packets (chope), bird seed, bananas, chewing gum, old newspapers */
  bag: Bag;
  /** the fine city: total paid, tickets, repeat counts per offence, the last tickets */
  fines: Fines;
  /** the kopi lingo you have ordered at least once (the glossary ticks them) */
  lingo: string[];
};
export type Bag = { tissue: number; seed: number; banana: number; gum: number; junk: number };
export type FineRec = { kind: string; amt: number; night: number };
export type Fines = { paid: number; n: number; by: Record<string, number>; list: FineRec[]; fled: number };
export const newBag = (): Bag => ({ tissue: 2, seed: 0, banana: 0, gum: 0, junk: 0 });
export const newFines = (): Fines => ({ paid: 0, n: 0, by: {}, list: [], fled: 0 });
export type Medal = { m: number; t: number; plays: number };
/** a text; `kind` 'job' (an offer, with its job id) and 'fine' count on the phone's badge, chatter doesn't */
export type Msg = { id: number; from: string; text: string; night: number; read: boolean; kind?: 'job' | 'fine' | 'help'; job?: string };
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
  { id: 'safe-heartland', d: 'heartland', need: 10, price: 250 }, { id: 'safe-bay', d: 'bay', need: 15, price: 400 },
  { id: 'safe-india', d: 'india', need: 10, price: 300 }, { id: 'safe-glam', d: 'glam', need: 12, price: 350 }, { id: 'safe-resort', d: 'resort', need: 15, price: 450 },
];

export function newSave(seed = 1): Save {
  return {
    v: SAVE_VERSION, seed, hero: 'dora', started: false,
    cash: 100, night: 1, clock: 0, cargo: emptyCargo(), stash: emptyCargo(),
    done: [], rep: { market: 0, temple: 0, canal: 0, docks: 0, arcade: 0, heartland: 0, bay: 0, india: 0, glam: 0, resort: 0 },
    upgrades: { speed: 0, grip: 0, cargo: 0 }, paint: 'red',
    outfits: { dora: ['classic'], enzo: ['classic'] }, outfit: { dora: 'classic', enzo: 'classic' },
    cats: [], murals: [], trophies: [], tips: [], safe: 'safe-market', best: {}, daily: '', dailyDone: [],
    stats: { walked: 0, driven: 0, boated: 0, missions: 0, gigs: 0, trades: 0, profit: 0, caught: 0, escapes: 0, bumps: 0, cats: 0, murals: 0, maxHeat: 0, playTime: 0, minis: 0, bizCoins: 0, shots: 0, tags: 0, switches: 0, tolls: 0, junk: 0, kopi: 0, chope: 0, mrt: 0, taxi: 0, photos: 0, heists: 0, quiet: 0, defends: 0, disguises: 0, clues: 0, traps: 0, swaps: 0, lures: 0, palHelps: 0, bribes: 0, cable: 0, ferry: 0, lamps: 0, kuih: 0, mynahs: 0 },
    settings: { sound: true, music: true, assist: true, diff: 'easy', touch: 'auto', shake: true, calm: false, keys: {}, bigText: false, cbMarks: false, partner: 'auto' },
    medals: {}, story: { intro: false, ch: 0, ending: false, isle: false, lights: false }, learned: [], msgs: [], radio: 0, helped: 0,
    biz: Object.fromEntries(BIZ.map(b => [b.id, newBiz()])), bizLog: [], gear: newGear(), bag: newBag(), fines: newFines(), lingo: [],
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
  if (o.v === 2) o = migrate2(o);
  if (o.v === 3) o = migrate3(o);
  if (o.v === 4) o = migrate4(o);
  if (o.v === 5) o = migrate5(o);
  if (o.v === 6) o = migrate6(o);
  if (o.v === 7) o = migrate7(o);
  if (o.v === 8) o = migrate8(o);
  if (o.v === 9) o = migrate9(o);
  const s = newSave(Math.floor(num(o.seed, 1, 1, 2 ** 31)));
  s.hero = o.hero === 'enzo' ? 'enzo' : 'dora';
  s.started = o.started === true;
  s.cash = Math.floor(num(o.cash, 100, 0, 1e7));
  s.night = Math.floor(num(o.night, 1, 1, 1e5)); s.clock = num(o.clock, 0, 0, 719);
  s.cargo = cargoOf(o.cargo); s.stash = cargoOf(o.stash);
  const ids = new Set([...MISSIONS, ...SIDE].map(m => m.id));
  s.done = strs(o.done, x => ids.has(x));
  if (typeof o.jobOpen === 'string' && ids.has(o.jobOpen) && !s.done.includes(o.jobOpen)) s.jobOpen = o.jobOpen;
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
  s.settings = { sound: se.sound !== false, music: se.music !== false, assist: se.assist !== false, diff: asDiff(se.diff), touch: se.touch === 'on' || se.touch === 'off' ? se.touch : 'auto', shake: se.shake !== false, calm: se.calm === true, keys: keysOf(se.keys), bigText: se.bigText === true, cbMarks: se.cbMarks === true, partner: PARTNER_MODES.includes(se.partner as PartnerMode) ? se.partner as PartnerMode : 'auto' };
  const md = (o.medals ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(md)) if (ids.has(k) && v && typeof v === 'object') { const x = v as Record<string, unknown>; s.medals[k] = { m: Math.floor(num(x.m, 0, 0, 3)), t: num(x.t, 0, 0, 1e6), plays: Math.floor(num(x.plays, 1, 1, 1e6)) }; }
  const sy = (o.story ?? {}) as Record<string, unknown>;
  s.story = { intro: sy.intro === true, ch: Math.floor(num(sy.ch, 0, 0, 8)), ending: sy.ending === true, isle: sy.isle === true, lights: sy.lights === true };
  s.learned = strs(o.learned);
  s.msgs = Array.isArray(o.msgs) ? (o.msgs as Msg[]).filter(m => m && typeof m.text === 'string' && typeof m.from === 'string').slice(-30).map((m, i) => ({ id: Number.isInteger(m.id) ? m.id : i + 1, from: m.from, text: m.text, night: num(m.night, 1, 1, 1e5), read: m.read === true, ...(m.kind === 'job' || m.kind === 'fine' || m.kind === 'help' ? { kind: m.kind } : {}), ...(typeof m.job === 'string' ? { job: m.job } : {}) })) : [];
  s.radio = Math.floor(num(o.radio, 0, -1, 9)); s.helped = Math.floor(num(o.helped, 0, 0, 1e6));
  const bz = (o.biz ?? {}) as Record<string, unknown>;
  for (const b of BIZ) {
    const x = (bz[b.id] ?? {}) as Record<string, unknown>;
    const hist = Array.isArray(x.hist) ? (x.hist as unknown[]).filter((v): v is number => typeof v === 'number' && isFinite(v)).map(v => Math.max(0, Math.round(v))).slice(-10) : [];
    s.biz[b.id] = { lvl: Math.floor(num(x.lvl, 0, 0, 3)), bank: num(x.bank, 0, 0, 1e6), tonight: num(x.tonight, 0, 0, 1e6), hist, raids: Math.floor(num(x.raids, 0, 0, 1e6)), defended: Math.floor(num(x.defended, 0, 0, 1e6)) };
  }
  s.gear = gearOf(o.gear, s);
  const bg = (o.bag ?? {}) as Record<string, unknown>; const nb = newBag();
  s.bag = { tissue: Math.floor(num(bg.tissue, nb.tissue, 0, 99)), seed: Math.floor(num(bg.seed, 0, 0, 99)), banana: Math.floor(num(bg.banana, 0, 0, 99)), gum: Math.floor(num(bg.gum, 0, 0, 1)), junk: Math.floor(num(bg.junk, 0, 0, 6)) };
  const fi = (o.fines ?? {}) as Record<string, unknown>; const by = (fi.by ?? {}) as Record<string, unknown>;
  s.fines = { paid: num(fi.paid, 0, 0, 1e9), n: Math.floor(num(fi.n, 0, 0, 1e6)), fled: Math.floor(num(fi.fled, 0, 0, 1e6)), by: Object.fromEntries(Object.entries(by).filter(([, v]) => typeof v === 'number' && isFinite(v)).map(([k, v]) => [k, Math.max(0, Math.floor(v as number))])),
    list: Array.isArray(fi.list) ? (fi.list as FineRec[]).filter(f => f && typeof f.kind === 'string' && typeof f.amt === 'number').slice(-12).map(f => ({ kind: f.kind, amt: Math.max(0, Math.round(f.amt)), night: Math.floor(num(f.night, 1, 1, 1e5)) })) : [] };
  s.lingo = strs(o.lingo).slice(0, 40);
  s.bizLog = Array.isArray(o.bizLog) ? (o.bizLog as unknown[]).filter((v): v is number => typeof v === 'number' && isFinite(v)).map(v => Math.max(0, Math.round(v))).slice(-10) : [];
  return s;
}
/** version 2 (the first release): everything kept; a player who has started already saw the opening, has the
 * chapter cards up to their chapter, knows the controls once they have finished a job, and finished jobs show as
 * played without a medal (best times weren't kept) */
function migrate2(o: Record<string, unknown>): Record<string, unknown> {
  const done = Array.isArray(o.done) ? (o.done as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const ch = Math.min(6, 1 + [1, 2, 3, 4, 5].filter(c => done.includes(`m${c * 5}`)).length);
  const medals: Record<string, Medal> = {};
  for (const id of done) medals[id] = { m: 0, t: 0, plays: 1 };
  return { ...o, v: 3, medals, story: { intro: o.started === true, ch: o.started === true ? ch : 0, ending: done.includes('m25') }, learned: done.length ? [...LESSON_IDS] : [], msgs: [], radio: 0, helped: 0 };
}
/** version 4 (the third release): everything kept; the gadgets the story would have handed over are given, loaded */
function migrate4(o: Record<string, unknown>): Record<string, unknown> {
  const s = newSave(1); const done = Array.isArray(o.done) ? o.done as string[] : [];
  for (const id of Object.keys(GEAR_GIFT)) if (done.includes(id)) for (const g of GEAR_GIFT[id]) giveGadget(s, g);
  return { ...o, v: 5, gear: s.gear };
}
/** the gadget kit, repaired: known gadgets only, ammo and levels in range, each hero carrying at most two owned ones */
function gearOf(v: unknown, s: Save): GearState {
  const G = newGear(), o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  G.own = strs(o.own, x => (GADGET_IDS as string[]).includes(x)) as GadgetId[];
  const rec = (k: string) => (o[k] && typeof o[k] === 'object' ? o[k] : {}) as Record<string, unknown>;
  for (const g of GADGET_IDS) { G.lvl[g] = Math.floor(num(rec('lvl')[g], 0, 0, 2)); }
  const tmp = { ...s, gear: G };
  for (const g of GADGET_IDS) { G.clip[g] = Math.floor(num(rec('clip')[g], 0, 0, clipOf(tmp, g))); G.ammo[g] = Math.floor(num(rec('ammo')[g], 0, 0, ammoCap(tmp, g))); }
  const cr = rec('carry'), sl = rec('slot'), seen = new Set<string>();
  for (const h of ['dora', 'enzo'] as Hero[]) { G.carry[h] = strs(cr[h], x => G.own.includes(x as GadgetId) && !seen.has(x)).slice(0, 2) as GadgetId[]; G.carry[h].forEach(x => seen.add(x)); G.slot[h] = Math.floor(num(sl[h], 0, 0, 1)); }
  // an owned gadget nobody carries goes to a free hand
  for (const g of G.own) if (!seen.has(g)) { const h = (['dora', 'enzo'] as Hero[]).find(h => G.carry[h].length < 2); if (h) { G.carry[h].push(g); seen.add(g); } }
  return G;
}
/** version 3 (the second release): everything kept as it was; no business is owned yet, Reduce shake starts off */
/** version 5 (pass four): everything kept; the Singapore pocket (two tissue packets to start), no fines yet, default
 * keys, normal text and markers */
function migrate5(o: Record<string, unknown>): Record<string, unknown> {
  const se = (o.settings ?? {}) as Record<string, unknown>;
  return { ...o, v: 6, bag: newBag(), fines: newFines(), lingo: [], settings: { ...se, keys: {}, bigText: false, cbMarks: false } };
}
/** remapped keys: action names to KeyboardEvent codes, each code used once */
/** version 6 (the fifth release): everything kept; the island is new, so its counts start at zero and its ending is
 * unseen. A save that had finished the festival lands back in its safe house with chapter six waiting */
function migrate6(o: Record<string, unknown>): Record<string, unknown> {
  const st = (o.stats ?? {}) as Record<string, unknown>; const sy = (o.story ?? {}) as Record<string, unknown>;
  return { ...o, v: 7, stats: { ...st, mrt: 0, taxi: 0 }, story: { ...sy, isle: false } };
}
/** version 7 (the sixth release): everything kept, medals too (a reworked job keeps the medals it had); the job-step
 * counts are new and start at zero */
function migrate7(o: Record<string, unknown>): Record<string, unknown> {
  const st = (o.stats ?? {}) as Record<string, unknown>;
  return { ...o, v: 8, stats: { ...st, photos: 0, heists: 0, quiet: 0, defends: 0, disguises: 0, clues: 0, traps: 0, swaps: 0 } };
}
/** version 8 (the seventh release): everything kept, medals too; the partner helps on their own by default and the new
 * counts start at zero */
function migrate8(o: Record<string, unknown>): Record<string, unknown> {
  const st = (o.stats ?? {}) as Record<string, unknown>, se = (o.settings ?? {}) as Record<string, unknown>;
  return { ...o, v: 9, stats: { ...st, lures: 0, palHelps: 0, bribes: 0 }, settings: { ...se, partner: 'auto' } };
}
/** version 9 (the eighth release): everything kept, medals too; Little India, Kampong Glam and Sentosa are new, so the
 * cable car, ferry, festival and mynah counts start at zero and the chapter-seven ending is unseen */
function migrate9(o: Record<string, unknown>): Record<string, unknown> {
  const st = (o.stats ?? {}) as Record<string, unknown>, sy = (o.story ?? {}) as Record<string, unknown>;
  return { ...o, v: 10, stats: { ...st, cable: 0, ferry: 0, lamps: 0, kuih: 0, mynahs: 0 }, story: { ...sy, lights: false } };
}
function keysOf(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}; const used = new Set<string>();
  if (v && typeof v === 'object') for (const [k, c] of Object.entries(v as Record<string, unknown>)) if (/^[a-z0-9]{1,12}$/.test(k) && typeof c === 'string' && /^[A-Za-z0-9]{1,20}$/.test(c) && !used.has(c)) { out[k] = c; used.add(c); }
  return out;
}
function migrate3(o: Record<string, unknown>): Record<string, unknown> {
  const se = (o.settings ?? {}) as Record<string, unknown>;
  return { ...o, v: 4, biz: {}, bizLog: [], settings: { ...se, calm: false } };
}
/** the onboarding lessons (lib/jade-tutor.ts) */
export const LESSON_IDS = ['move', 'run', 'dash', 'hop', 'ride', 'boost', 'honk', 'map', 'market', 'heat', 'hide', 'sneak'] as const;
/** version 1 (pre-release): { v:1, money, done: "m1,m2", rep: number, hero, cats: number } */
function migrate1(o: Record<string, unknown>): Record<string, unknown> {
  const done = typeof o.done === 'string' ? (o.done as string).split(',').filter(Boolean) : o.done;
  const r = typeof o.rep === 'number' ? (o.rep as number) : 0;
  return { ...o, v: 2, cash: o.cash ?? o.money, done, rep: { market: r, temple: 0, canal: 0, docks: 0, arcade: 0 }, cats: Array.isArray(o.cats) ? o.cats : [], started: true };
}

// ── progression
export const chapterOf = (s: Save) => { let ch = 1; for (let c = 1; c <= 7; c++) { if (MISSIONS.filter(m => m.ch === c).every(m => s.done.includes(m.id))) ch = c + 1; else break; } return Math.min(ch, 8); };
export function openDistricts(s: Save): District[] {
  const out: District[] = ['market'];
  for (let c = 1; c <= 4; c++) if (s.done.includes(`m${c * 5}`)) out.push(CHAPTER_OPENS[c - 1]);
  // the island opens once the Phoenix Drum is home: chapter six takes the story out of Chinatown
  if (s.done.includes('m25')) out.push('heartland', 'bay');
  // chapter seven: Little India and Kampong Glam over the Rochor River once Island Night is won, Sentosa half way through
  if (s.done.includes('m35')) out.push('india', 'glam');
  if (s.done.includes(RESORT_OPENS)) out.push('resort');
  return out;
}
/** story missions you may start now: the chapter's jobs in order, a couple at a time */
export function available(s: Save) {
  const ch = chapterOf(s);
  const todo = MISSIONS.filter(m => m.ch === ch && !s.done.includes(m.id));
  // the finale waits for the rest of the chapter; otherwise the first two open jobs are offered
  const nonFinal = todo.filter(m => m.id !== FINALE[ch - 1]);
  return (nonFinal.length ? nonFinal.slice(0, 2) : todo.slice(0, 1));
}
/** Hawker Tales side jobs open now: their story job is done (two offered at a time, in order) */
export function sideJobs(s: Save) { return SIDE.filter(m => !s.done.includes(m.id) && s.done.includes(m.side!)).slice(0, 2); }
/** every job a contact offers right now: the story's and the side jobs */
export const offered = (s: Save) => [...available(s), ...sideJobs(s)];
export const isSide = (id: string) => !!MISSION[id]?.side;
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
  if (f.need && s.rep[f.need.d] < f.need.rep) return `Needs ${f.need.rep} reputation in ${f.need.d === 'market' ? 'Smith Street' : f.need.d}`;
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
  { id: 'island', name: 'Island Night', desc: 'Stop Director Kaw and win the Golden Chinchilla.', test: s => s.done.includes('m35') },
  { id: 'commuter', name: 'Commuter', desc: 'Ride the Jade Line five times.', test: s => s.stats.mrt >= 5 },
  { id: 'tumpang', name: 'Tumpang', desc: 'Take three taxi rides.', test: s => s.stats.taxi >= 3 },
  { id: 'lights', name: 'Island Lights', desc: 'Stop Crow Number Nine and light up Siloso Beach.', test: s => s.done.includes('m45') },
  { id: 'skyride', name: 'Sky Ride', desc: 'Ride the cable car three times.', test: s => s.stats.cable >= 3 },
  { id: 'ferry', name: 'Sea Legs', desc: 'Take the island ferry.', test: s => s.stats.ferry >= 1 },
  { id: 'festive', name: 'Festive', desc: 'Light a lamp at the Deepavali light-up and share kuih at the Hari Raya bazaar.', test: s => s.stats.lamps >= 1 && s.stats.kuih >= 1 },
  { id: 'kecoh', name: 'Quiet Please', desc: 'Catch ten Kecoh Mynahs.', test: s => s.stats.mynahs >= 10 },
  { id: 'ghost', name: 'Ghost', desc: 'Pull off a heist the quiet way.', test: s => s.stats.quiet >= 1 },
  { id: 'sleuth', name: 'Sleuth', desc: 'Find eight clues by asking the right questions.', test: s => s.stats.clues >= 8 },
  { id: 'netted', name: 'Net Result', desc: 'Spring three traps that catch the whole gang.', test: s => s.stats.traps >= 3 },
  { id: 'holdout', name: 'Hold the Fort', desc: 'See off every wave in three stands.', test: s => s.stats.defends >= 3 },
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
  { id: 'stake', name: 'Stallholder', desc: 'Buy a stake in a business.', test: s => Object.values(s.biz).some(b => b.lvl > 0) },
  { id: 'magnate', name: 'Quarter Magnate', desc: 'Own all six businesses at their grandest.', test: s => BIZ.every(b => s.biz[b.id]?.lvl >= 3) },
  { id: 'defender', name: 'Till Keeper', desc: 'Chase off three crow raids.', test: s => Object.values(s.biz).reduce((a, b) => a + b.defended, 0) >= 3 },
];
/** award any trophies newly earned; returns their names */
export function checkTrophies(s: Save): string[] {
  const out: string[] = [];
  for (const t of TROPHIES) if (!s.trophies.includes(t.id) && t.test(s)) { s.trophies.push(t.id); out.push(t.name); }
  return out;
}

// ── the daily market event (same for everyone on a given date)
export const EVENTS = [
  { name: 'Mooncake Festival Eve', desc: 'Temple Street pays half again for mooncakes tonight.', market: 'temple' as District, good: 'mooncake' as const, mult: 1.5, task: 'Sell 6 mooncakes at Temple Street' },
  { name: 'Mango Glut', desc: 'Mango boats arrived: mangoes are cheap everywhere.', market: undefined, good: 'mango' as const, mult: 0.7, task: 'Sell 10 mangoes anywhere' },
  { name: 'Collectors in Town', desc: 'The Clarke Quay pays extra for jade tonight.', market: 'arcade' as District, good: 'jade' as const, mult: 1.35, task: 'Sell 3 jade bangles on the Strip' },
  { name: 'Typhoon Warning', desc: 'Tea is scarce at the Tanjong Pagar Docks: prices up.', market: 'docks' as District, good: 'tea' as const, mult: 1.45, task: 'Sell 8 tins of tea at the Tanjong Pagar Docks' },
  { name: 'Fan Dance Night', desc: 'Canal Row wants silk fans for the dance.', market: 'canal' as District, good: 'fan' as const, mult: 1.4, task: 'Sell 5 silk fans on Canal Row' },
  { name: 'Wedding Season', desc: 'Porcelain bowls are in demand at Smith Street.', market: 'market' as District, good: 'bowl' as const, mult: 1.35, task: 'Sell 4 porcelain bowls in Smith Street' },
];
export function dailyEvent(day: string) { const r = rng(hashStr('jade-day:' + day)); return { ...EVENTS[Math.floor(r() * EVENTS.length)], day, need: 0 }; }
export function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const DAILY_NEED: Record<string, number> = { mooncake: 6, mango: 10, jade: 3, tea: 8, fan: 5, bowl: 4 };

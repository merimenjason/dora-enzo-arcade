// Jade Street: the save (localStorage 'jade-street-v11'), its repair and migration, progression (districts opened by the
// story, reputation tiers, safe houses, outfits, garage upgrades and paint), trophies and the stats screen.
// Version 1 saves (the pre-release shape: `money`, `done` as a comma string, one shared rep number) and version 2 saves
// (the first release, 'jade-street-v2': no medals, story flags, lessons, messages or radio) and version 3 saves (the
// second release: no businesses, no Reduce shake), version 4 saves (the third release: no gadgets), version 5 saves
// (no Singapore streets), version 6 saves (no island: no MRT or taxi counts, no island ending) and version 7 saves (no
// job-step counts: photos, heists, traps and the rest) and version 8 saves (no partner setting, no lure, partner-help
// or kopi-bribe counts) and version 9 saves (no Little India, Kampong Glam or Sentosa: no cable car, ferry or
// festival counts, no chapter-seven ending) and version 10 saves (no empire: no damage, jagas, boosts, ranks or empire
// counts) and version 11 saves (no contracts) migrate forward, keeping every bit of progress, medals included.
import { DISTRICTS, type District } from './jade-city.js';
import { emptyCargo, GOODS, type Cargo, type Tip } from './jade-trade.js';
import { MISSIONS, SIDE, MISSION, CHAPTER_OPENS, FINALE, RESORT_OPENS, CHANGI_OPENS, JURONG_OPENS, UBIN_OPENS, KALLANG_OPENS, MANDAI_OPENS, ISLANDS_OPENS, BUKIT_OPENS } from './jade-story.js';
import { hashStr, rng } from './jade-rng.js';
import { asDiff, type Diff } from './jade-diff.js';
import { BIZ, STALL_IDS, newBiz, rankOf, type BizState } from './jade-biz.js';
import { EMPIRE_JOB_IDS } from './jade-empjobs.js';
import { GIG20_DEFS } from './jade-gigs20.js';
import { GIG23_DEFS } from './jade-gigs23.js';
import { newGear, giveGadget, clipOf, ammoCap, GEAR_GIFT, GADGET_IDS, type GearState, type GadgetId } from './jade-gear.js';

export const SAVE_KEY = 'jade-street-v13';
export const OLD_KEYS = ['jade-street-v12', 'jade-street-v11', 'jade-street-v10', 'jade-street-v9', 'jade-street-v8', 'jade-street-v7', 'jade-street-v6', 'jade-street-v5', 'jade-street-v4', 'jade-street-v3', 'jade-street-v2', 'jade-street-v1'];
export const SAVE_VERSION = 13;
export type Hero = 'dora' | 'enzo';
/** `keys`: remapped keyboard actions (action -> KeyboardEvent.code); `bigText`: larger HUD text; `cbMarks`: colour-blind-safe
 * markers (shapes and patterns, not only colour) */
export type Settings = { sound: boolean; music: boolean; assist: boolean; diff: Diff; touch: 'auto' | 'on' | 'off'; shake: boolean; calm: boolean; keys: Record<string, string>; bigText: boolean; cbMarks: boolean;
  /** the partner's own initiative (lib/jade-pal.ts): helps on their own, only when you press F, or off */
  partner: PartnerMode };
export type PartnerMode = 'auto' | 'tag' | 'off';
export const PARTNER_MODES: PartnerMode[] = ['auto', 'tag', 'off'];
export type Stats = { walked: number; driven: number; boated: number; missions: number; gigs: number; trades: number; profit: number; caught: number; escapes: number; bumps: number; cats: number; murals: number; maxHeat: number; playTime: number; minis: number; bizCoins: number; shots: number; tags: number; switches: number; tolls: number; junk: number; kopi: number; chope: number;
  /** the island: MRT rides, taxi rides */
  mrt: number; taxi: number;
  /** the job steps: photos taken casing, heists (and quiet ones), stands held, disguises worn, clues found, traps
   * sprung full, crates swapped */
  photos: number; heists: number; quiet: number; defends: number; disguises: number; clues: number; traps: number; swaps: number;
  /** the eighth pass: guards lured by a noise you made, the partner's own help, witnesses bribed with kopi */
  lures: number; palHelps: number; bribes: number;
  /** the ninth pass: cable car and ferry rides, Deepavali lamps lit and Hari Raya bazaar treats, mynahs caught */
  cable: number; ferry: number; lamps: number; kuih: number; mynahs: number;
  /** the tenth pass: raids seen off (by you or your partner), raids missed, repairs, the partner's rounds of the tills,
   * empire jobs finished, health inspections passed with an A */
  raidsWon: number; raidsMissed: number; repairs: number; rounds: number; empJobs: number; gradeA: number;
  /** the twelfth pass: Atas Bats caught, bike rides along the coast, bowls of laksa, baubles hung on the Orchard Road
   * trees, kites flown, planes spotted */
  bats: number; bikes: number; laksa: number; baubles: number; kites: number; planes: number;
  /** the fourteenth pass: plates of chwee kueh, songs at the bird corner, Slingshot rides, koi fed, looks through the
   * telescope, lantern walks round Jurong Lake (all start at zero in an older save: the loader fills them in) */
  chwee: number; songs: number; slings: number; koi: number; stars: number; lwalks: number;
  /** the seventeenth pass: durians caught off the tree, looks from Jejawi Tower, boars shooed off their digs, Tusker Boys
   * caught, boar trails followed to the end, bumboat crossings (all start at zero in an older save: the loader fills them in) */
  durians: number; spies: number; digs: number; boars: number; trails: number; bumboats: number;
  /** the eighteenth pass: crowds squeezed through, Kallang Waves started at the fan zone, planes spotted from the old
   * airport's apron (all start at zero in an older save: the loader fills them in) */
  crowds: number; waves: number; skies: number;
  /** the nineteenth pass: night trails walked by torch, Night Safari tram rides, lories fed at Bird Paradise, Creatures of
   * the Night shows watched (all start at zero in an older save: the loader fills them in) */
  torches: number; trams: number; lories: number; shows: number;
  /** the twenty-first pass: reef crossings made on a tide, island ferry rides, tortoises fed on Kusu, floats in the
   * Lazarus lagoon, looks out from Raffles Lighthouse, rock pools peered into (the loader fills them in too) */
  tides: number; launches: number; tortoises: number; floats: number; lookouts: number; peeks: number;
  /** the twenty-second pass: summit climbs made, macaques shooed off a snack, herbarium specimens read, rests taken on a
   * trail shelter's log */
  summits: number; shoos: number; specimens: number; rests: number };
/** the empire (lib/jade-empire.ts): the highest rank reached (its card shows once), empire jobs finished (by id) and the
 * night each was last done (one a night) */
export type Empire = { rank: number; jobs: Record<string, number>; last: Record<string, number> };
export const newEmpire = (): Empire => ({ rank: 0, jobs: {}, last: {} });
/** the eleventh pass's contracts (lib/jade-contracts.ts): a rival gang muscling in on a district since `night` */
export type Contest = { d: District; gang: 'crow' | 'mac' | 'otter' | 'liz' | 'myna' | 'bat' | 'boar'; night: number };
/** a contract offer as the generator's reference (lib/jade-proc.ts CRef): it rebuilds the same contract every time */
export type OfferRef = { seed: number; tier: number; stars: 1 | 2 | 3; open: District[]; giver?: string; kind?: string; avoid?: string[] };
export type Contracts = {
  /** the three offers on the phone, the night they were dealt, the counter that seeds the next one */
  offers: OfferRef[]; night: number; n: number;
  /** contracts finished (and by kind), retakes won, the contract last routed to */
  done: number; kinds: Record<string, number>; retaken: number; pin: string;
  /** the contract of the day: its date, the best time that day (seconds, 0 for none), runs, whether it has paid */
  day: string; dayBest: number; dayRuns: number; dayPaid: boolean;
  contest: Contest | null;
};
export const newContracts = (): Contracts => ({ offers: [], night: 0, n: 0, done: 0, kinds: {}, retaken: 0, pin: '', day: '', dayBest: 0, dayRuns: 0, dayPaid: false, contest: null });
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
  story: { intro: boolean; ch: number; ending: boolean; isle: boolean; lights: boolean; /** chapter eight's ending (the Rain Vortex) seen */ coast: boolean; /** chapter nine's ending (Lights by the Lake) seen */ lake: boolean };
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
  /** the tenth pass: the empire's rank and its jobs */
  empire: Empire;
  /** the eleventh pass: the contracts on the phone, the contract of the day and the rivals' pushback */
  contracts: Contracts;
};
export type Bag = { tissue: number; seed: number; banana: number; gum: number; junk: number };
export type FineRec = { kind: string; amt: number; night: number };
export type Fines = { paid: number; n: number; by: Record<string, number>; list: FineRec[]; fled: number };
export const newBag = (): Bag => ({ tissue: 2, seed: 0, banana: 0, gum: 0, junk: 0 });
export const newFines = (): Fines => ({ paid: 0, n: 0, by: {}, list: [], fled: 0 });
export type Medal = { m: number; t: number; plays: number };
/** a text; `kind` 'job' (an offer, with its job id) and 'fine' count on the phone's badge, chatter doesn't */
export type Msg = { id: number; from: string; text: string; night: number; read: boolean; kind?: 'job' | 'fine' | 'help'; job?: string; /** a side gig's id (its board's Route me) */ gig?: string };
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
  { id: 'safe-orchard', d: 'orchard', need: 12, price: 500 }, { id: 'safe-katong', d: 'katong', need: 10, price: 400 }, { id: 'safe-changi', d: 'changi', need: 15, price: 550 },
  { id: 'safe-tiong', d: 'tiong', need: 10, price: 450 }, { id: 'safe-quay', d: 'quay', need: 12, price: 550 }, { id: 'safe-jurong', d: 'jurong', need: 15, price: 600 },
  // the seventeenth pass: the kampong house by Ubin Jetty
  { id: 'safe-ubin', d: 'pulau', need: 15, price: 650 },
  // the eighteenth pass: the old airport's hangar office
  { id: 'safe-kallang', d: 'kallang', need: 12, price: 650 },
  // the nineteenth pass: the ranger hut in the Night Safari's forest
  { id: 'safe-mandai', d: 'mandai', need: 12, price: 700 },
  // the twenty-first pass: the colonial bungalow on St John's Island
  { id: 'safe-islands', d: 'islands', need: 12, price: 700 },
  // the twenty-second pass: the black-and-white bungalow below Bukit Timah Hill
  { id: 'safe-bukit', d: 'bukit', need: 12, price: 720 },
];

export function newSave(seed = 1): Save {
  return {
    v: SAVE_VERSION, seed, hero: 'dora', started: false,
    cash: 100, night: 1, clock: 0, cargo: emptyCargo(), stash: emptyCargo(),
    done: [], rep: { market: 0, temple: 0, canal: 0, docks: 0, arcade: 0, heartland: 0, bay: 0, india: 0, glam: 0, resort: 0, orchard: 0, katong: 0, changi: 0, tiong: 0, quay: 0, jurong: 0, pulau: 0, kallang: 0, mandai: 0, islands: 0, bukit: 0 },
    upgrades: { speed: 0, grip: 0, cargo: 0 }, paint: 'red',
    outfits: { dora: ['classic'], enzo: ['classic'] }, outfit: { dora: 'classic', enzo: 'classic' },
    cats: [], murals: [], trophies: [], tips: [], safe: 'safe-market', best: {}, daily: '', dailyDone: [],
    stats: { walked: 0, driven: 0, boated: 0, missions: 0, gigs: 0, trades: 0, profit: 0, caught: 0, escapes: 0, bumps: 0, cats: 0, murals: 0, maxHeat: 0, playTime: 0, minis: 0, bizCoins: 0, shots: 0, tags: 0, switches: 0, tolls: 0, junk: 0, kopi: 0, chope: 0, mrt: 0, taxi: 0, photos: 0, heists: 0, quiet: 0, defends: 0, disguises: 0, clues: 0, traps: 0, swaps: 0, lures: 0, palHelps: 0, bribes: 0, cable: 0, ferry: 0, lamps: 0, kuih: 0, mynahs: 0, raidsWon: 0, raidsMissed: 0, repairs: 0, rounds: 0, empJobs: 0, gradeA: 0 , bats: 0, bikes: 0, laksa: 0, baubles: 0, kites: 0, planes: 0, chwee: 0, songs: 0, slings: 0, koi: 0, stars: 0, lwalks: 0, durians: 0, spies: 0, digs: 0, boars: 0, trails: 0, bumboats: 0, crowds: 0, waves: 0, skies: 0, torches: 0, trams: 0, lories: 0, shows: 0, tides: 0, launches: 0, tortoises: 0, floats: 0, lookouts: 0, peeks: 0, summits: 0, shoos: 0, specimens: 0, rests: 0 },
    settings: { sound: true, music: true, assist: true, diff: 'easy', touch: 'auto', shake: true, calm: false, keys: {}, bigText: false, cbMarks: false, partner: 'auto' },
    medals: {}, story: { intro: false, ch: 0, ending: false, isle: false, lights: false, coast: false, lake: false }, learned: [], msgs: [], radio: 0, helped: 0,
    biz: Object.fromEntries(BIZ.map(b => [b.id, newBiz()])), bizLog: [], gear: newGear(), bag: newBag(), fines: newFines(), lingo: [], empire: newEmpire(), contracts: newContracts(),
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
  if (o.v === 10) o = migrate10(o);
  if (o.v === 11) o = migrate11(o);
  if (o.v === 12) o = migrate12(o);
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
  s.story = { intro: sy.intro === true, ch: Math.floor(num(sy.ch, 0, 0, 15)), ending: sy.ending === true, isle: sy.isle === true, lights: sy.lights === true, coast: sy.coast === true, lake: sy.lake === true };
  s.learned = strs(o.learned);
  s.msgs = Array.isArray(o.msgs) ? (o.msgs as Msg[]).filter(m => m && typeof m.text === 'string' && typeof m.from === 'string').slice(-30).map((m, i) => ({ id: Number.isInteger(m.id) ? m.id : i + 1, from: m.from, text: m.text, night: num(m.night, 1, 1, 1e5), read: m.read === true, ...(m.kind === 'job' || m.kind === 'fine' || m.kind === 'help' ? { kind: m.kind } : {}), ...(typeof m.job === 'string' ? { job: m.job } : {}), ...(typeof m.gig === 'string' ? { gig: m.gig } : {}) })) : [];
  s.radio = Math.floor(num(o.radio, 0, -1, 9)); s.helped = Math.floor(num(o.helped, 0, 0, 1e6));
  const bz = (o.biz ?? {}) as Record<string, unknown>;
  for (const b of BIZ) {
    const x = (bz[b.id] ?? {}) as Record<string, unknown>;
    const hist = Array.isArray(x.hist) ? (x.hist as unknown[]).filter((v): v is number => typeof v === 'number' && isFinite(v)).map(v => Math.max(0, Math.round(v))).slice(-10) : [];
    const lvl = Math.floor(num(x.lvl, 0, 0, 3));
    s.biz[b.id] = { lvl, bank: num(x.bank, 0, 0, 1e6), tonight: num(x.tonight, 0, 0, 1e6), hist, raids: Math.floor(num(x.raids, 0, 0, 1e6)), defended: Math.floor(num(x.defended, 0, 0, 1e6)),
      dmg: lvl ? Math.floor(num(x.dmg, 0, 0, 1)) : 0, jaga: lvl > 0 && x.jaga === true, boost: Math.floor(num(x.boost, 0, 0, 9)), boostK: num(x.boostK, 1, 1, 2), missed: Math.floor(num(x.missed, 0, 0, 1e6)) };
    if (!s.biz[b.id].boost) s.biz[b.id].boostK = 1;
  }
  s.gear = gearOf(o.gear, s);
  const bg = (o.bag ?? {}) as Record<string, unknown>; const nb = newBag();
  s.bag = { tissue: Math.floor(num(bg.tissue, nb.tissue, 0, 99)), seed: Math.floor(num(bg.seed, 0, 0, 99)), banana: Math.floor(num(bg.banana, 0, 0, 99)), gum: Math.floor(num(bg.gum, 0, 0, 1)), junk: Math.floor(num(bg.junk, 0, 0, 6)) };
  const fi = (o.fines ?? {}) as Record<string, unknown>; const by = (fi.by ?? {}) as Record<string, unknown>;
  s.fines = { paid: num(fi.paid, 0, 0, 1e9), n: Math.floor(num(fi.n, 0, 0, 1e6)), fled: Math.floor(num(fi.fled, 0, 0, 1e6)), by: Object.fromEntries(Object.entries(by).filter(([, v]) => typeof v === 'number' && isFinite(v)).map(([k, v]) => [k, Math.max(0, Math.floor(v as number))])),
    list: Array.isArray(fi.list) ? (fi.list as FineRec[]).filter(f => f && typeof f.kind === 'string' && typeof f.amt === 'number').slice(-12).map(f => ({ kind: f.kind, amt: Math.max(0, Math.round(f.amt)), night: Math.floor(num(f.night, 1, 1, 1e5)) })) : [] };
  s.lingo = strs(o.lingo).slice(0, 40);
  const em = (o.empire ?? {}) as Record<string, unknown>; const nums = (v: unknown) => Object.fromEntries(Object.entries((v && typeof v === 'object' ? v : {}) as Record<string, unknown>).filter(([k, x]) => /^[a-z0-9-]{1,24}$/.test(k) && typeof x === 'number' && isFinite(x)).map(([k, x]) => [k, Math.max(0, Math.floor(x as number))]));
  s.empire = { rank: Math.floor(num(em.rank, 0, 0, 4)), jobs: nums(em.jobs), last: nums(em.last) };
  s.contracts = contractsOf(o.contracts);
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
/** version 10 (the ninth release): everything kept (jobs, medals, every stall and safe house you own, their tills); the
 * empire is new: nothing damaged, no jagas or boosts, the empire counts start at zero, and the rank you already hold
 * is marked seen so no card pops up for it */
function migrate10(o: Record<string, unknown>): Record<string, unknown> {
  const st = (o.stats ?? {}) as Record<string, unknown>;
  const tmp = newSave(1); const bz = (o.biz ?? {}) as Record<string, Record<string, unknown>>;
  for (const b of BIZ) tmp.biz[b.id].lvl = Math.floor(num(bz[b.id]?.lvl, 0, 0, 3));
  return { ...o, v: 11, stats: { ...st, raidsWon: 0, raidsMissed: 0, repairs: 0, rounds: 0, empJobs: 0, gradeA: 0 }, empire: { rank: rankOf(tmp), jobs: {}, last: {} } };
}
/** version 11 (the tenth release): everything kept; contracts are new, so none are done and no district is contested */
function migrate11(o: Record<string, unknown>): Record<string, unknown> { return { ...o, v: 12, contracts: newContracts() }; }
/** version 12 (the eleventh release): everything kept (jobs, medals, property, contracts and their offers); Orchard Road,
 * Katong and Changi are new, so the Atas Bats, bike, laksa, bauble, kite and plane counts start at zero and chapter
 * eight's ending is unseen. The job counts stay worked out from the jobs themselves */
function migrate12(o: Record<string, unknown>): Record<string, unknown> {
  const st = (o.stats ?? {}) as Record<string, unknown>, sy = (o.story ?? {}) as Record<string, unknown>;
  return { ...o, v: 13, stats: { ...st, bats: 0, bikes: 0, laksa: 0, baubles: 0, kites: 0, planes: 0 }, story: { ...sy, coast: false } };
}
const GANGS = ['crow', 'mac', 'otter', 'liz', 'myna', 'bat', 'boar'];
/** the contracts, repaired: offers with a known shape (a bad one is simply dealt again), counts in range */
function contractsOf(v: unknown): Contracts {
  const c = newContracts(), o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const n = (x: unknown, hi = 1e9) => typeof x === 'number' && isFinite(x) ? Math.max(0, Math.min(hi, Math.floor(x))) : 0;
  c.offers = (Array.isArray(o.offers) ? o.offers as Record<string, unknown>[] : []).filter(r => r && typeof r.seed === 'number' && [1, 2, 3].includes(r.stars as number) && Array.isArray(r.open)).slice(0, 3).map(r => ({
    seed: n(r.seed, 2 ** 32), tier: n(r.tier, 6), stars: r.stars as 1 | 2 | 3, open: (r.open as unknown[]).filter((d): d is District => DISTRICTS.includes(d as District)),
    ...(typeof r.giver === 'string' ? { giver: r.giver } : {}), ...(typeof r.kind === 'string' ? { kind: r.kind } : {}), ...(Array.isArray(r.avoid) ? { avoid: strs(r.avoid) } : {}) }));
  c.night = n(o.night); c.n = n(o.n); c.done = n(o.done); c.retaken = n(o.retaken); c.pin = typeof o.pin === 'string' ? o.pin.slice(0, 8) : '';
  c.kinds = Object.fromEntries(Object.entries((o.kinds && typeof o.kinds === 'object' ? o.kinds : {}) as Record<string, unknown>).filter(([k, x]) => /^[a-z]{1,16}$/.test(k) && typeof x === 'number').map(([k, x]) => [k, n(x)]));
  c.day = typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : ''; c.dayBest = n(o.dayBest, 1e5); c.dayRuns = n(o.dayRuns); c.dayPaid = o.dayPaid === true;
  const ct = o.contest as Record<string, unknown> | null;
  c.contest = ct && DISTRICTS.includes(ct.d as District) && GANGS.includes(ct.gang as string) ? { d: ct.d as District, gang: ct.gang as Contest['gang'], night: n(ct.night) } : null;
  return c;
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
export const chapterOf = (s: Save) => { let ch = 1; for (let c = 1; c <= 14; c++) { if (MISSIONS.filter(m => m.ch === c).every(m => s.done.includes(m.id))) ch = c + 1; else break; } return Math.min(ch, 15); };
export function openDistricts(s: Save): District[] {
  const out: District[] = ['market'];
  for (let c = 1; c <= 4; c++) if (s.done.includes(`m${c * 5}`)) out.push(CHAPTER_OPENS[c - 1]);
  // the island opens once the Phoenix Drum is home: chapter six takes the story out of Chinatown
  if (s.done.includes('m25')) out.push('heartland', 'bay');
  // chapter seven: Little India and Kampong Glam over the Rochor River once Island Night is won, Sentosa half way through
  if (s.done.includes('m35')) out.push('india', 'glam');
  if (s.done.includes(RESORT_OPENS)) out.push('resort');
  // chapter eight: Orchard Road (north-west) and Katong (over the Geylang River) once Siloso is won, Changi half way through
  if (s.done.includes('m45')) out.push('orchard', 'katong');
  if (s.done.includes(CHANGI_OPENS)) out.push('changi');
  // chapter nine: Tiong Bahru and Clarke Quay, west of Chinatown, once the Christmas Star is home, Jurong half way through
  if (s.done.includes('m55')) out.push('tiong', 'quay');
  if (s.done.includes(JURONG_OPENS)) out.push('jurong');
  // chapter ten: Pulau Ubin, over the strait from Changi by bumboat, once the Moon Lantern is home
  if (s.done.includes(UBIN_OPENS)) out.push('pulau');
  // chapter eleven: Kallang, south of Kampong Glam on the Kallang Basin, once the quarry men's tin is open
  if (s.done.includes(KALLANG_OPENS)) out.push('kallang');
  // chapter twelve: Mandai, in the north-west corner on the Upper Seletar Reservoir, once the Kallang Roar is over
  if (s.done.includes(MANDAI_OPENS)) out.push('mandai');
  // chapter thirteen: the Southern Islands, by the island ferry from Marina South Pier, once the seaplane has gone south
  if (s.done.includes(ISLANDS_OPENS)) out.push('islands');
  // chapter fourteen: Bukit Timah, by the MRT to Beauty World or Botanic Gardens, once Raffles Lighthouse is held
  if (s.done.includes(BUKIT_OPENS)) out.push('bukit');
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
  { id: 'commuter', name: 'Commuter', desc: 'Ride the MRT five times.', test: s => s.stats.mrt >= 5 },
  { id: 'tumpang', name: 'Tumpang', desc: 'Take three taxi rides.', test: s => s.stats.taxi >= 3 },
  { id: 'lights', name: 'Island Lights', desc: 'Stop Crow Number Nine and light up Siloso Beach.', test: s => s.done.includes('m45') },
  { id: 'skyride', name: 'Sky Ride', desc: 'Ride the cable car three times.', test: s => s.stats.cable >= 3 },
  { id: 'ferry', name: 'Sea Legs', desc: 'Take the island ferry.', test: s => s.stats.ferry >= 1 },
  { id: 'festive', name: 'Festive', desc: 'Light a lamp at the Deepavali light-up and share kuih at the Hari Raya bazaar.', test: s => s.stats.lamps >= 1 && s.stats.kuih >= 1 },
  { id: 'kecoh', name: 'Quiet Please', desc: 'Catch ten Kecoh Mynahs.', test: s => s.stats.mynahs >= 10 },
  // the twelfth pass
  { id: 'coast', name: 'Coast to Coast', desc: 'Stop Datin Ciku at the Rain Vortex and win back the Christmas Star.', test: s => s.done.includes('m55') },
  { id: 'atas', name: 'Not So Atas', desc: 'Catch ten Atas Bats.', test: s => s.stats.bats >= 10 },
  { id: 'pedal', name: 'Pedal Power', desc: 'Ride a hired bike along East Coast Park three times.', test: s => s.stats.bikes >= 3 },
  { id: 'shiok', name: 'Shiok!', desc: 'Slurp a bowl of laksa in Katong and hang a bauble on an Orchard Road tree.', test: s => s.stats.laksa >= 1 && s.stats.baubles >= 1 },
  { id: 'spotter', name: 'Plane Spotter', desc: 'Fly a kite at the beach and wave at five planes coming in at Changi.', test: s => s.stats.kites >= 1 && s.stats.planes >= 5 },
  // the fourteenth pass
  { id: 'lake', name: 'Lights by the Lake', desc: 'Stop Towkay Hoot at the Chinese Garden and win back the Moon Lantern.', test: s => s.done.includes('m65') },
  { id: 'chwee', name: 'Breakfast Club', desc: 'Eat chwee kueh at Tiong Bahru Market and listen to the songbirds at the bird corner.', test: s => s.stats.chwee >= 1 && s.stats.songs >= 1 },
  { id: 'sling', name: 'Up, Up and Away', desc: 'Ride the Slingshot at Clarke Quay three times.', test: s => s.stats.slings >= 3 },
  { id: 'stargazer', name: 'Stargazer', desc: 'See all four sights through the Science Centre Observatory’s telescope.', test: s => s.stats.stars >= 4 },
  { id: 'moonwalk', name: 'Moon Rabbit', desc: 'Feed the koi in Jurong Lake and carry a rabbit lantern round it.', test: s => s.stats.koi >= 1 && s.stats.lwalks >= 1 },
  // the seventeenth pass
  { id: 'kampong', name: 'Kampong Spirit', desc: 'Beat the lady in black feathers to the quarry men’s tin at Ketam Quarry.', test: s => s.done.includes('m75') },
  // the eighteenth pass
  { id: 'roar', name: 'Kallang Roar', desc: 'Carry the chart through the full-time crowd at the National Stadium and get it back off Pip on the basin.', test: s => s.done.includes('m85') },
  // the nineteenth pass
  { id: 'nightsafari', name: 'Night Safari', desc: 'Find the 1937 survey pillar by torchlight and see Madam Sutera off the Upper Seletar Reservoir.', test: s => s.done.includes('m95') },
  { id: 'softly', name: 'Softly, Softly', desc: 'Walk five night trails by torch without waking anything for long.', test: s => s.stats.torches >= 5 },
  { id: 'loryfeeder', name: 'Lory Breakfast Club', desc: 'Feed the lories at Bird Paradise five times.', test: s => s.stats.lories >= 5 },
  { id: 'nightowl', name: 'Night Owl', desc: 'Ride the Night Safari tram three times and watch the Creatures of the Night show.', test: s => s.stats.trams >= 3 && s.stats.shows >= 1 },
  // the twenty-first pass
  { id: 'lighthouse', name: 'Raffles Lighthouse', desc: 'Cross the reef on the spring tide and hold Raffles Lighthouse’s door against Kapitan Umang’s crew.', test: s => s.done.includes('m105') },
  { id: 'tidereader', name: 'Tide Reader', desc: 'Cross the reef flats on five tides.', test: s => s.stats.tides >= 5 },
  { id: 'slowfood', name: 'Slow Food', desc: 'Feed Kusu’s tortoises five times.', test: s => s.stats.tortoises >= 5 },
  { id: 'islandtime', name: 'Island Time', desc: 'Float in the Lazarus lagoon, look out from the lighthouse gallery and peer into three rock pools.', test: s => s.stats.floats >= 1 && s.stats.lookouts >= 1 && s.stats.peeks >= 3 },
  // the twenty-second pass
  { id: 'secondbearing', name: 'Second Bearing', desc: 'Hold the trig pillar on Bukit Timah Hill against Big Kow’s gang, then race down to the Orchid Garden.', test: s => s.done.includes('m115') },
  { id: 'hillrunner', name: 'Hill Runner', desc: 'Reach the summit of Bukit Timah Hill five times.', test: s => s.stats.summits >= 5 },
  { id: 'nofeeding', name: 'Don’t Feed the Monkeys', desc: 'Shoo five macaques off a snack on Bukit Timah, without feeding a single one.', test: s => s.stats.shoos >= 5 },
  { id: 'naturalist', name: 'Naturalist', desc: 'Read three herbarium specimens and rest on a trail shelter’s log.', test: s => s.stats.specimens >= 3 && s.stats.rests >= 1 },
  { id: 'squeeze', name: 'Excuse Me, Excuse Me', desc: 'Squeeze through five match-night crowds at the Sports Hub.', test: s => s.stats.crowds >= 5 },
  { id: 'mexican', name: 'Kallang Wave', desc: 'Start the Kallang Wave at the fan zone three times.', test: s => s.stats.waves >= 3 },
  { id: 'flyingboat', name: 'Flying Boat Spotter', desc: 'Spot three planes from the apron of the Old Kallang Airport.', test: s => s.stats.skies >= 3 },
  { id: 'tusker', name: 'Tusker Tamer', desc: 'Catch five dizzy Tusker Boys on Pulau Ubin, out of a job.', test: s => s.stats.boars >= 5 },
  { id: 'durian', name: 'King of Fruits', desc: 'Shake down three durians on Pulau Ubin and look out from Jejawi Tower.', test: s => s.stats.durians >= 3 && s.stats.spies >= 1 },
  { id: 'ranger', name: 'Jungle Ranger', desc: 'Follow three boar trails to the end.', test: s => s.stats.trails >= 3 },
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
  { id: 'magnate', name: 'Quarter Magnate', desc: 'Own the first eleven stalls at their grandest.', test: s => STALL_IDS.every(id => s.biz[id]?.lvl >= 3) },
  // the tenth pass: the empire's ranks (Street Stall is the Stallholder trophy), the whole empire, raids and its jobs
  { id: 'kopi-boss', name: 'Kopi Boss', desc: 'Reach the empire rank of Kopi Boss.', test: s => rankOf(s) >= 2 },
  { id: 'tycoon-sh', name: 'Shophouse Tycoon', desc: 'Reach the empire rank of Shophouse Tycoon.', test: s => rankOf(s) >= 3 },
  { id: 'taipan', name: 'Island Taipan', desc: 'Reach the empire rank of Island Taipan.', test: s => rankOf(s) >= 4 },
  { id: 'full-house', name: 'Full House', desc: 'Own every property on the island at its grandest.', test: s => BIZ.every(b => s.biz[b.id]?.lvl >= 3) },
  { id: 'night-watch', name: 'Night Watch', desc: 'See off ten raids on your properties.', test: s => s.stats.raidsWon >= 10 },
  { id: 'grade-a', name: 'Grade A', desc: 'Pass a health inspection with an A.', test: s => s.stats.gradeA >= 1 },
  { id: 'emp-jobs', name: 'Towkay', desc: 'Finish every kind of empire job.', test: s => EMPIRE_JOB_IDS.every(id => (s.empire?.jobs[id] ?? 0) > 0) },
  // the eleventh pass: contracts, the contract of the day and the rivals' pushback
  { id: 'contractor', name: 'Contractor', desc: 'Finish ten contracts.', test: s => (s.contracts?.done ?? 0) >= 10 },
  { id: 'cotd', name: 'Job of the Day', desc: 'Finish a contract of the day.', test: s => (s.contracts?.dayRuns ?? 0) >= 1 },
  { id: 'turf', name: 'Turf Holder', desc: 'Win back three contested districts.', test: s => (s.contracts?.retaken ?? 0) >= 3 },
  { id: 'defender', name: 'Till Keeper', desc: 'Chase off three crow raids.', test: s => Object.values(s.biz).reduce((a, b) => a + b.defended, 0) >= 3 },  // the twentieth pass: the side gigs past Chinatown (lib/jade-gigs20.ts)
  { id: 'every-corner', name: 'Every Corner', desc: 'Finish a side gig in every district past Chinatown.', test: s => [...new Set(GIG20_DEFS.map(g => g.d))].every(d => GIG20_DEFS.some(g => g.d === d && s.best['gig:' + g.id])) },
  { id: 'rounds', name: 'Round the Houses', desc: 'Finish every round: mooncakes, balloons, garlands, potong, laksa, luggage, pastries, lanterns and nectar feeders.', test: s => GIG20_DEFS.filter(g => ROUND_KINDS.includes(g.kind)).every(g => s.best['gig:' + g.id]) },
  { id: 'wheels-wakes', name: 'Wheels and Wakes', desc: 'Finish the river taxi run, the island bike loop and the buoy sprint.', test: s => ['river-taxi', 'ubin-loop', 'buoy-sprint'].every(id => s.best['gig:' + id]) },
  // the twenty-third pass: the second boards (lib/jade-gigs23.ts)
  { id: 'second-helpings', name: 'Second Helpings', desc: 'Finish the second side gig in every district that has one.', test: s => GIG23_DEFS.every(g => s.best['gig:' + g.id]) },
  { id: 'look-plant-count', name: 'Look, Plant, Count', desc: 'Finish the mural photo walk, the mangrove planting and the night trail count.', test: s => ['photo-walk', 'mangroves', 'night-count'].every(id => s.best['gig:' + id]) },
  { id: 'four-rivals', name: 'Four Rivals', desc: 'Outrun the macaque, the mynah, the otter and the crow in their own districts.', test: s => ['lion-dash', 'tekka-sprint', 'siloso-run', 'pagoda-run'].every(id => s.best['gig:' + id]) },
];
/** the side gigs that are rounds (lib/jade-rounds.ts) */
const ROUND_KINDS = ['mooncakes', 'balloons', 'garlands', 'potong', 'laksa', 'luggage', 'croissants', 'lanterns', 'feeders'];
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
  { name: 'Collectors in Town', desc: 'Club Street pays extra for jade tonight.', market: 'arcade' as District, good: 'jade' as const, mult: 1.35, task: 'Sell 3 jade bangles on the Strip' },
  { name: 'Typhoon Warning', desc: 'Tea is scarce at the Tanjong Pagar Docks: prices up.', market: 'docks' as District, good: 'tea' as const, mult: 1.45, task: 'Sell 8 tins of tea at the Tanjong Pagar Docks' },
  { name: 'Fan Dance Night', desc: 'Canal Row wants silk fans for the dance.', market: 'canal' as District, good: 'fan' as const, mult: 1.4, task: 'Sell 5 silk fans on Canal Row' },
  { name: 'Wedding Season', desc: 'Porcelain bowls are in demand at Smith Street.', market: 'market' as District, good: 'bowl' as const, mult: 1.35, task: 'Sell 4 porcelain bowls in Smith Street' },
];
export function dailyEvent(day: string) { const r = rng(hashStr('jade-day:' + day)); return { ...EVENTS[Math.floor(r() * EVENTS.length)], day, need: 0 }; }
export function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const DAILY_NEED: Record<string, number> = { mooncake: 6, mango: 10, jade: 3, tea: 8, fan: 5, bowl: 4 };

// Jade Street: owning businesses. Six stalls around the quarter (a noodle cart, a mooncake bakery, a tea house, a fan
// shop, a jade counter and a claw-machine booth) can be bought into once their district is open and its keepers trust
// you (reputation). Each earns coins through the night: a nightly rate set by its level, the district's reputation, the
// weather, tips and the daily event, and a local event that changes every night. Earnings pile up in the stall's till
// (at most three nights' worth) until you collect them at the stall or at a safe house; a night skipped by sleeping
// earns only for the part you were awake. Upgrades change the painted stall. Now and then crows raid an owned stall:
// a text, then a short defend job (get there, then dash into the fleeing crows before they get away); a lost raid
// costs part of the till. No DOM; all randomness is seeded.
import { T, DISTRICT_NAME, type District } from './jade-city.js';
import { rng, hashStr, dist, clamp } from './jade-rng.js';
import { showers } from './jade-weather.js';
import { nearestFree } from './jade-nav.js';
import type { Good } from './jade-trade.js';
import type { Save } from './jade-save.js';
import type { World } from './jade-game.js';
import type { Mission, Step } from './jade-story.js';
import type { Run, Actor } from './jade-mission.js';

export type BizId = 'noodle' | 'cake' | 'tea' | 'fan' | 'jade' | 'claw';
export type BizDef = { id: BizId; name: string; keeper: string; d: District; at: [number, number]; good: Good | null; price: number; up: [number, number]; income: [number, number, number, number]; rain: number; need: number };
export const BIZ: BizDef[] = [
  { id: 'noodle', name: 'Noodle Cart', keeper: 'mo', d: 'market', at: [39, 68], good: 'bowl', price: 500, up: [600, 1000], income: [0, 70, 120, 190], rain: 1.2, need: 15 },
  { id: 'cake', name: 'Mooncake Bakery', keeper: 'kee', d: 'market', at: [22, 59], good: 'mooncake', price: 650, up: [800, 1300], income: [0, 90, 150, 240], rain: 1, need: 20 },
  { id: 'tea', name: 'Hilltop Tea House', keeper: 'pang', d: 'temple', at: [39, 22], good: 'tea', price: 800, up: [950, 1600], income: [0, 110, 185, 290], rain: 1.25, need: 20 },
  { id: 'fan', name: 'Canal Fan Shop', keeper: 'kiri', d: 'canal', at: [57, 38], good: 'fan', price: 950, up: [1150, 1900], income: [0, 130, 220, 345], rain: 0.85, need: 20 },
  { id: 'jade', name: 'Harbour Jade Counter', keeper: 'bo', d: 'docks', at: [81, 79], good: 'jade', price: 1500, up: [1800, 3000], income: [0, 205, 345, 540], rain: 1, need: 25 },
  { id: 'claw', name: 'Neon Claw Booth', keeper: 'gizmo', d: 'arcade', at: [118, 37], good: null, price: 1200, up: [1450, 2400], income: [0, 165, 280, 440], rain: 1.3, need: 25 },
];
export const BIZ_OF = Object.fromEntries(BIZ.map(b => [b.id, b])) as Record<BizId, BizDef>;
export const BIZ_IDS = BIZ.map(b => b.id);
/** what the save keeps per business: level (0 not owned), coins waiting in the till, the last nights' takings */
export type BizState = { lvl: number; bank: number; tonight: number; hist: number[]; raids: number; defended: number };
export const newBiz = (): BizState => ({ lvl: 0, bank: 0, tonight: 0, hist: [], raids: 0, defended: 0 });
export const bizPos = (b: BizDef): [number, number] => [b.at[0] * T + T / 2, b.at[1] * T + T / 2];
export const owned = (s: Save) => BIZ.filter(b => (s.biz[b.id]?.lvl ?? 0) > 0);
export const bizSprite = (id: BizId, lvl: number) => `biz-${id}-${clamp(lvl, 0, 3)}`;

/** tonight's local event: a busker crowd lifts one district, another is quiet, the festival lifts every stall */
export type NightEvent = { kind: 'crowd' | 'quiet' | 'calm'; d: District | null; text: string };
export function nightEvent(seed: number, night: number, open: District[]): NightEvent {
  const R = rng(hashStr(`jade-biz:${seed}:${night}`)); const r = R();
  const d = open[Math.floor(R() * open.length)] ?? 'market';
  if (r < 0.4) return { kind: 'crowd', d, text: `A busker crowd fills ${DISTRICT_NAME[d]}: stalls there take 30% more` };
  if (r < 0.6) return { kind: 'quiet', d, text: `${DISTRICT_NAME[d][0].toUpperCase()}${DISTRICT_NAME[d].slice(1)} is quiet tonight: stalls there take 20% less` };
  return { kind: 'calm', d: null, text: 'An ordinary night on the streets' };
}
export const rainyNight = (seed: number, night: number) => showers(seed, night).length > 0;
/** a business's takings for a whole night at its level, with each factor that went into it */
export function bizRate(s: Save, id: BizId, open: District[], o: { daily?: { good: string; market?: District } | null; festival?: boolean } = {}) {
  const b = BIZ_OF[id], st = s.biz[id]; const lvl = st?.lvl ?? 0;
  if (!lvl) return { rate: 0, parts: [] as string[] };
  const parts: string[] = []; let k = 0.75 + s.rep[b.d] / 200;
  parts.push(`reputation ×${k.toFixed(2)}`);
  if (rainyNight(s.seed, s.night) && b.rain !== 1) { k *= b.rain; parts.push(`${b.rain > 1 ? 'rain brings customers' : 'rain keeps buyers away'} ×${b.rain}`); }
  const ev = nightEvent(s.seed, s.night, open);
  if (ev.d === b.d && ev.kind === 'crowd') { k *= 1.3; parts.push('busker crowd ×1.3'); }
  if (ev.d === b.d && ev.kind === 'quiet') { k *= 0.8; parts.push('quiet night ×0.8'); }
  if (b.good && s.tips.some(t => t.night === s.night && t.market === b.d && t.good === b.good)) { k *= 1.25; parts.push('a tip for its goods ×1.25'); }
  if (b.good && o.daily && o.daily.good === b.good && (!o.daily.market || o.daily.market === b.d)) { k *= 1.3; parts.push('the daily event ×1.3'); }
  if (o.festival) { k *= 1.2; parts.push('the festival ×1.2'); }
  return { rate: Math.round(b.income[lvl] * k), parts };
}
const TILL_NIGHTS = 3;
/** earnings for `mins` game minutes of the night (a night is 720) */
export function accrue(w: World, mins: number) {
  if (mins <= 0) return;
  const open = [...w.open];
  for (const b of owned(w.s)) {
    const st = w.s.biz[b.id]; const r = bizRate(w.s, b.id, open, { daily: w.event, festival: w.festival }).rate;
    const add = r * mins / 720; st.tonight += add; st.bank = Math.min(r * TILL_NIGHTS + 1, st.bank + add);
  }
}
/** the night ends: each stall's takings go into its history (the last 10 nights) and the quarter's total */
export function closeNight(s: Save) {
  let tot = 0;
  for (const b of owned(s)) { const st = s.biz[b.id]; st.hist.push(Math.round(st.tonight)); if (st.hist.length > 10) st.hist.shift(); tot += st.tonight; st.tonight = 0; }
  if (owned(s).length) { s.bizLog.push(Math.round(tot)); if (s.bizLog.length > 10) s.bizLog.shift(); }
}
export function canBuy(s: Save, id: BizId, open: District[]): string | null {
  const b = BIZ_OF[id], st = s.biz[id];
  if (st.lvl > 0) return 'Already yours';
  if (!open.includes(b.d)) return 'That district is still under fog';
  if (s.rep[b.d] < b.need) return `The keepers want ${b.need} reputation in ${DISTRICT_NAME[b.d]}`;
  if (s.cash < b.price) return `Needs ${b.price} coins`;
  return null;
}
export function buyBiz(s: Save, id: BizId, open: District[]): string | null {
  const why = canBuy(s, id, open); if (why) return why;
  s.cash -= BIZ_OF[id].price; s.biz[id].lvl = 1; return null;
}
export const upgradeCost = (id: BizId, lvl: number) => lvl >= 1 && lvl < 3 ? BIZ_OF[id].up[lvl - 1] : 0;
export function upgradeBiz(s: Save, id: BizId): string | null {
  const st = s.biz[id]; if (!st.lvl) return 'Buy a stake first';
  if (st.lvl >= 3) return 'Fully upgraded';
  const c = upgradeCost(id, st.lvl); if (s.cash < c) return `Needs ${c} coins`;
  s.cash -= c; st.lvl++; return null;
}
/** empty the till of one stall (or every stall); returns the coins */
export function collect(s: Save, id?: BizId): number {
  let n = 0;
  for (const b of owned(s)) { if (id && b.id !== id) continue; const st = s.biz[b.id]; const k = Math.floor(st.bank); n += k; st.bank -= k; }
  s.cash += n; s.stats.bizCoins += n; return n;
}
export const tillTotal = (s: Save) => owned(s).reduce((a, b) => a + Math.floor(s.biz[b.id].bank), 0);

// ── raids
/** about twice a night (at 4 and 8 hours) a stall you own may be raided while you are free; returns the stall */
export function raidCheck(w: World, before: number, after: number): BizId | null {
  const s = w.s; if (w.run || w.raidWait) return null;
  const mine = owned(s).filter(b => s.biz[b.id].bank >= 20); if (!mine.length) return null;
  const marks = [240, 480].filter(m => before < m && after >= m); if (!marks.length) return null;
  const R = rng(hashStr(`jade-raid:${s.seed}:${s.night}:${marks[0]}`));
  if (R() > (w.assist ? 0.3 : 0.4)) return null;
  return mine[Math.floor(R() * mine.length)].id;
}
/** the defend job: hurry to the stall, then catch the crows fleeing with the till */
export function raidMission(w: World, id: BizId): Mission {
  const b = BIZ_OF[id]; const [x, y] = bizPos(b);
  const far = dist(x, y, w.p.x, w.p.y) / T;
  const steps: Step[] = [
    { t: 'goto', at: b.at, label: `Hurry to the ${b.name}: crows are raiding the till`, r: 150, time: Math.round(far * 1.1 + 25) },
    { t: 'raid', at: b.at, n: w.diff.extra > 0 ? 4 : 3, label: 'Dash or ride into each crow before it gets away', cp: true },
  ];
  return { id: 'raid-' + id, ch: 0, title: `Raid on the ${b.name}`, giver: b.keeper, at: '', blurb: '', reward: 40, rep: 2, steps };
}
/** the crows burst out of the stall and run in different directions; each one that gets far enough away escapes */
export function raidEnter(run: Run, st: Extract<Step, { t: 'raid' }>) {
  const w = run.w; const [x, y] = run.spot(st.at);
  for (let i = 0; i < st.n; i++) {
    const a = i * Math.PI * 2 / st.n + 0.6;
    const [tx, ty] = nearestFree(w.c, 'walk', x + Math.cos(a) * 12 * T, y + Math.sin(a) * 12 * T, w.open, 6);
    const [sx, sy] = nearestFree(w.c, 'walk', x + Math.cos(a) * 40, y + Math.sin(a) * 40, w.open, 3);
    run.actors.push(run.actor('raider', sx, sy, 'foot', [[tx, ty]], 0));
  }
  run.count = 0; run.lost = 0; run.progress = `Caught 0/${st.n}`;
  run.meter = { name: 'Got away', v: 0 };
  w.fx.push({ t: 'caw' });
}
export function raidStep(run: Run, st: Extract<Step, { t: 'raid' }>, dt: number) {
  const w = run.w, p = w.p, pb = p.ride ? p.ride.b : p.b; const [x, y] = run.spot(st.at);
  const sp = (w.assist ? 125 : 150) * w.diff.chase;
  for (const a of run.actors as Actor[]) {
    if (a.gone) continue;
    a.t += dt;
    if (a.stun > 0) { a.stun -= dt; if (a.stun <= 0) a.gone = true; continue; }
    const end = run.walk(a, dt, a.t < 0.6 ? 0 : sp, false);
    const reach = 26 + pb.r + (w.assist ? 16 : 4);
    const hitting = p.ride ? pb.speed > 80 : (p.dashT > 0 || p.hopT > 0);
    if (dist(a.b.x, a.b.y, pb.x, pb.y) < reach && hitting) { a.stun = 0.8; a.hits = 1; run.count++; if (!p.ride && !p.act) p.act = { n: 'shoo', t: 0, dur: 0.45 }; w.fx.push({ t: 'shoo', x: a.b.x, y: a.b.y }); w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: 1, kind: 'feather' }); continue; }
    if ((end && a.t > 1) || dist(a.b.x, a.b.y, x, y) > 10 * T) { a.gone = true; run.lost++; w.fx.push({ t: 'snatch', x: a.b.x, y: a.b.y }); w.say('A crow got away with some coins!', 'bad'); }
  }
  const allow = w.assist ? 2 : 1;
  run.progress = `Caught ${run.count}/${st.n}`;
  run.meter = { name: `Got away ${run.lost}/${allow + 1}`, v: run.lost / (allow + 1), bad: run.lost >= allow };
  if (run.lost > allow) return run.fail('Too many crows got away with the till! Dash into them sooner.');
  if (run.actors.every(a => a.gone)) run.next();
}
/** a raid you didn't win: the crows take 40% of that stall's till */
export function raidLost(s: Save, id: BizId) { const st = s.biz[id]; if (!st) return 0; const k = Math.floor(st.bank * 0.4); st.bank -= k; st.raids++; return k; }
export function raidWon(s: Save, id: BizId) { const st = s.biz[id]; if (st) { st.defended++; st.raids++; } }
export const raidId = (missionId: string): BizId | null => missionId.startsWith('raid-') ? missionId.slice(5) as BizId : null;

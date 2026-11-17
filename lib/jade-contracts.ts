// Jade Street (eleventh pass): contracts on the phone. Once the Phoenix Drum is home (the first ending, job m25) the
// phone's Contracts tab always holds three offers built by lib/jade-proc.ts; a finished one is replaced at once and
// the rest are dealt fresh each night. Pay and difficulty climb with your empire rank, the districts where you own a
// property (your territory) and the contracts you have finished. The contract of the day is seeded by the date alone
// (always in Chinatown, open to every player who has contracts), so everyone plays the same one, with your best time
// kept. The rivals push back: some nights a gang muscles in on a district where you own property, its tills take less
// until you win the retake contract, so there is always something to do. Pure engine, no DOM.
import { CT_DISTRICTS, DISTRICT_NAME, T, type District } from './jade-city.js';
import { rng, hashStr, dist } from './jade-rng.js';
import { PEOPLE } from './jade-story.js';
import { offered, addRep, type Save } from './jade-save.js';
import { owned, CONTEST } from './jade-biz.js';
import { RAID_GANG } from './jade-props.js';
import { text } from './jade-phone.js';
import { genContract, contractMission, makeCtx, GANG, type CRef, type Contract, type GenCtx, type Gang } from './jade-proc.js';
import type { World, Near } from './jade-game.js';

/** the story job that opens contracts (the first ending) */
export const CONTRACTS_OPEN = 'm25';
export const OFFERS = 3;
export { newContracts, type Contracts, type Contest } from './jade-save.js';
export { CONTEST, contestFactor } from './jade-biz.js';
export const contractsOpen = (s: Save) => s.done.includes(CONTRACTS_OPEN);

// ── tiers and stars
/** districts where you own a property */
export const territory = (s: Save) => new Set(owned(s).map(b => b.d)).size;
/** 0 to 6: empire rank, half the territory, one per eight contracts */
export const tierOf = (s: Save) => Math.min(6, (s.empire?.rank ?? 0) + Math.floor(territory(s) / 2) + Math.floor((s.contracts?.done ?? 0) / 8));
/** the three offers' difficulty: an easy one, a middling one, a hard one (all harder at higher tiers) */
export function starsFor(slot: number, tier: number): 1 | 2 | 3 {
  if (slot === 0) return tier >= 4 ? 2 : 1;
  if (slot === 1) return tier >= 2 ? 2 : 1;
  return tier >= 3 ? 3 : 2;
}

// ── the generated contracts, cached (a contract is a pure function of its reference)
const ctxs = new Map<string, GenCtx>(); const cache = new Map<string, Contract>();
function ctxFor(open: District[]) { const k = open.join(); let c = ctxs.get(k); if (!c) { c = makeCtx(open); ctxs.set(k, c); if (ctxs.size > 4) ctxs.delete(ctxs.keys().next().value!); } return c; }
export function contractOf(ref: CRef): Contract {
  const k = JSON.stringify(ref); let c = cache.get(k);
  if (!c) { c = genContract(ctxFor(ref.open), ref); cache.set(k, c); if (cache.size > 24) cache.delete(cache.keys().next().value!); }
  return c;
}
/** the contract of the day: seeded by the date only, in Chinatown, two stars */
export const dailyRef = (day: string): CRef => ({ seed: hashStr('jade-cotd:' + day), tier: 3, stars: 2, open: CT_DISTRICTS.slice(), day });
/** the retake contract for the contest under way */
export function pushRef(s: Save, open: District[]): CRef | null {
  const c = s.contracts.contest; if (!c) return null;
  return { seed: hashStr(`jade-push:${s.seed}:${c.night}:${c.d}`), tier: tierOf(s), stars: 2, open: open.slice(), contest: { d: c.d, gang: c.gang } };
}
/** givers busy with a story job or Hawker Tale on offer (the story comes first) */
const busy = (s: Save) => offered(s).map(m => m.giver);

/** deal the offers: all fresh on a new night, a missing slot refilled at once */
export function dealOffers(w: World) {
  const s = w.s, cs = s.contracts; if (!contractsOpen(s)) return;
  if (cs.night !== s.night) { cs.offers = []; cs.night = s.night; }
  while (cs.offers.length < OFFERS) cs.offers.push(newOffer(w, cs.offers.length));
}
function newOffer(w: World, slot: number): CRef {
  const s = w.s, cs = s.contracts, tier = tierOf(s);
  const taken = cs.offers.map(r => r.giver);
  const ref: CRef = { seed: hashStr(`jade-offer:${s.seed}:${cs.n++}`), tier, stars: starsFor(slot, tier), open: [...w.open], avoid: [...busy(s), ...taken.filter((g): g is string => !!g)] };
  const c = contractOf(ref);
  return { ...ref, giver: c.giver, kind: c.kind };
}
/** every contract on the phone right now: the three offers, the contract of the day, the retake */
export type Listed = { which: string; c: Contract; tag: 'offer' | 'day' | 'push' };
let memo: { k: string; s: Save; out: Listed[] } | null = null;
export function listContracts(w: World): Listed[] {
  const s = w.s; if (!contractsOpen(s)) return [];
  dealOffers(w);
  // asked for every frame (the cast, the prompt, the gold line, the HUD): rebuilt only when something it reads changes
  const cs = s.contracts, k = `${s.seed}|${cs.night}|${cs.n}|${cs.offers.map(r => r.seed).join()}|${w.event?.day}|${w.open.size}|${cs.contest?.d ?? ''}:${cs.contest?.night ?? ''}|${tierOf(s)}`;
  if (memo && memo.k === k && memo.s === s) return memo.out;
  const out = listFresh(w); memo = { k, s, out }; return out;
}
function listFresh(w: World): Listed[] {
  const s = w.s;
  const out: Listed[] = s.contracts.offers.map((r, i) => ({ which: 'o' + i, c: contractOf(r), tag: 'offer' as const }));
  const day = w.event?.day; if (day && CT_DISTRICTS.every(d => w.open.has(d))) out.push({ which: 'day', c: contractOf(dailyRef(day)), tag: 'day' });
  const pr = pushRef(s, [...w.open]); if (pr) out.push({ which: 'push', c: contractOf(pr), tag: 'push' });
  return out;
}
export const findListed = (w: World, which: string) => listContracts(w).find(l => l.which === which) ?? null;

/** the contract of the day has paid in full today (a replay pays a quarter) */
export const dayPaid = (w: World) => { const cs = w.s.contracts; return !!w.event && cs.day === w.event.day && cs.dayPaid; };
/** today's record: best time (seconds, 0 for none) and runs */
export const dayRecord = (w: World) => { const cs = w.s.contracts; return w.event && cs.day === w.event.day ? { best: cs.dayBest, runs: cs.dayRuns } : { best: 0, runs: 0 }; };
/** start a contract from the phone or its giver */
export function startContract(w: World, which: string): string | null {
  if (w.run) return 'Finish the job you are on first';
  const l = findListed(w, which); if (!l) return 'That contract is gone';
  const m = contractMission(l.c, w.assist, w.s.settings.diff === 'hard');
  if (w.p.ride && l.c.mods.includes('foot')) w.exit();
  w.startMission(m, { key: `con:${which}:${l.c.ref.seed}`, reward: l.tag === 'day' && dayPaid(w) ? Math.round(l.c.pay / 4) : l.c.pay, d: l.c.d });
  return null;
}
/** a contract finished (lib/jade-game.ts finishMission): counts, the day's record, the retake, a fresh offer */
export function contractDone(w: World, key: string, time: number): string {
  const s = w.s, cs = s.contracts, [, which, seed] = key.split(':');
  const l = findListed(w, which); const c = l && String(l.c.ref.seed) === seed ? l.c : null;
  cs.done++; if (c) cs.kinds[c.kind] = (cs.kinds[c.kind] ?? 0) + 1;
  let sub = '';
  if (which === 'day') {
    const day = w.event?.day ?? ''; if (cs.day !== day) { cs.day = day; cs.dayBest = 0; cs.dayRuns = 0; cs.dayPaid = false; }
    cs.dayRuns++; cs.dayPaid = true;
    const best = !cs.dayBest || time < cs.dayBest; if (best) cs.dayBest = Math.round(time);
    sub = best ? ` · a new best for today (${fmt(cs.dayBest)})` : ` · today’s best is ${fmt(cs.dayBest)}`;
  } else if (which === 'push') {
    const ct = cs.contest; cs.contest = null; cs.retaken++;
    if (ct) { addRep(s, ct.d, 4); sub = ` · ${cap(DISTRICT_NAME[ct.d])} is yours again`; }
  } else {
    const i = Number(which.slice(1)); if (i >= 0 && i < cs.offers.length) cs.offers[i] = newOffer(w, i);
  }
  if (cs.pin === which) cs.pin = '';
  return sub;
}
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** the night turns: the rivals may contest a district where you own property */
export function contractNight(w: World) {
  const s = w.s, cs = s.contracts; if (!contractsOpen(s) || cs.contest) return;
  const mine = owned(s).filter(b => w.open.has(b.d)); if (!mine.length) return;
  const R = rng(hashStr(`jade-contest:${s.seed}:${s.night}`));
  if (R() > (w.assist ? CONTEST.oddsAssist : CONTEST.odds)) return;
  const b = mine[Math.floor(R() * mine.length)], gang = RAID_GANG[b.d] as Gang;
  cs.contest = { d: b.d, gang, night: s.night };
  text(w, b.keeper, `Trouble! The ${GANG[gang].name} are muscling in on ${DISTRICT_NAME[b.d]}. Our tills are down until somebody pushes them out (phone → Contracts).`);
}

// ── in the world: the giver's prompt, the route line
/** the giver of each listed contract, where they stand (beside their own place) */
export function giverAt(w: World, c: Contract): [number, number] | null {
  const cm = w.cast.find(x => x.id === c.giver && x.home); if (cm) return [cm.x, cm.y];
  const pl = w.c.places[c.at]; return pl && w.open.has(pl.d) ? [pl.x, pl.y] : null;
}
export function contractNear(w: World, cand: (n: Near, r: number, bias?: number) => void) {
  if (w.run || !contractsOpen(w.s)) return;
  const story = new Set(busy(w.s));
  for (const l of listContracts(w)) {
    // (pass 13: the contract you routed to is offered even when the giver also has a Hawker Tale or a story job, and
    // its prompt wins at their side; the other job is still there once it is done)
    const pinned = w.s.contracts.pin === l.which;
    if (story.has(l.c.giver) && !pinned) continue;
    const at = giverAt(w, l.c); if (!at) continue;
    cand({ kind: 'contract', label: `${PEOPLE[l.c.giver]?.name ?? l.c.giver}: ${l.tag === 'day' ? 'contract of the day' : l.tag === 'push' ? 'retake' : 'contract'} “${l.c.title}”`, x: at[0], y: at[1], id: l.which }, 76, pinned ? 40 : 0);
  }
}
/** where the gold line goes when no story job is on offer: the pinned contract's giver, else the nearest */
export function contractTarget(w: World): [number, number] | null {
  if (!contractsOpen(w.s)) return null;
  const ls = listContracts(w); if (!ls.length) return null;
  const pin = ls.find(l => l.which === w.s.contracts.pin);
  const story = new Set(busy(w.s)); let best: [number, number] | null = null, bd = 1e18;
  for (const l of pin ? [pin] : ls.filter(x => x.tag !== 'day' || !dayPaid(w))) {
    if (story.has(l.c.giver) && l !== pin) continue;
    const at = giverAt(w, l.c); if (!at) continue; const d = dist(at[0], at[1], w.p.x, w.p.y); if (d < bd) { bd = d; best = at; }
  }
  return best;
}
/** the next contract for the plaque between jobs */
export function nextContract(w: World): Listed | null {
  if (!contractsOpen(w.s)) return null;
  const ls = listContracts(w), pin = ls.find(l => l.which === w.s.contracts.pin); if (pin) return pin;
  const at = contractTarget(w); if (!at) return null;
  return ls.find(l => { const g = giverAt(w, l.c); return !!g && g[0] === at[0] && g[1] === at[1]; }) ?? null;
}
/** Route me: pin a contract and lead to its giver */
export function routeContract(w: World, which: string): string | null {
  const l = findListed(w, which); if (!l) return 'That contract is gone';
  const at = giverAt(w, l.c); if (!at) return 'Their district is still closed';
  w.s.contracts.pin = which; w.waypoint = [at[0], at[1] + T * 0.3]; w.routeT = 0; w.updateRoute(); return null;
}
/** a contract's E prompt was pressed */
export function contractAct(w: World, which: string) { const why = startContract(w, which); if (why) w.say(why, 'bad'); }

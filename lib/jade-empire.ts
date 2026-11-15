// Jade Street (tenth pass): the Chinatown empire. The businesses of lib/jade-biz.ts grow into twenty-six properties
// across every district (lib/jade-props.ts), and this file runs what happens round them:
//   raids     twice a night (11 pm and 3 am) a rival gang may raid a property with coins in its till. A text, a toast,
//             a pulsing pin on the map and the minimap, and a clock: get there in time (110 s, 150 s on Assist, the
//             clock stops while a job or a menu is open) and the raid becomes a short job, one of four kinds chosen by
//             the gang: hold the shop (defend), net them on their way in (trap), run down the one with the till
//             (chase) or catch the crows fleeing with coins (the old crow raid). Or send your partner, who goes there
//             on their own and wins it more often than not. A raid nobody answers costs that night's takings, or (two
//             in five, at level 2 and up) leaves the place damaged: it earns nothing till you repair it. Nothing is
//             ever lost for good. A jaga (night watchman, from Shophouse Tycoon) halves the odds of a raid there,
//             halves what a missed one costs, never lets it be damaged, and in a stand at the shop he patrols, notices
//             the gang (his own suspicious, alert and chasing states) and sees off the ones in the open.
//   rounds    from Kopi Boss your partner can go round the tills for you: they walk (or, far off screen, hop on the
//             Jade Line) to each property, collect, and hand you the coins when they are back at your side.
//   jobs      the empire jobs (lib/jade-empjobs.ts) built for the property you take them at, once a night each: a
//             supplier deal, a health inspector, a price war, a taxi rush, a river tour and karaoke night; a win boosts
//             that property's takings for a few nights.
//   ranks     Street Stall, Kopi Boss, Shophouse Tycoon, Island Taipan (lib/jade-biz.ts RANKS): a card and a text the
//             first time, each with its perk.
// Pure engine, no DOM; every roll is seeded by the save's seed and the night.
import { T, W, DISTRICT_NAME, districtAt } from './jade-city.js';
import { rng, hashStr, dist } from './jade-rng.js';
import { nearestFree } from './jade-nav.js';
import { FOOT } from './jade-move.js';
import { BIZ, BIZ_OF, bizPos, bizRate, owned, collect, raidWon, RANKS, rankOf, type BizId, type BizDef } from './jade-biz.js';
import { RAID_GANG, GANG_NAME } from './jade-props.js';
import { EMPIRE_JOBS, EMPIRE_JOB, type EmpJobDef } from './jade-empjobs.js';
import { PEOPLE, type Mission, type Step, type Spot } from './jade-story.js';
import { addRep } from './jade-save.js';
import { text } from './jade-phone.js';
import { newMind, type Mind } from './jade-aware.js';
import type { World, Near } from './jade-game.js';
import type { Actor } from './jade-mission.js';

export type RaidKind = 'defend' | 'trap' | 'chase' | 'grab';
export type Gang = 'crow' | 'mac' | 'otter' | 'liz' | 'myna';
/** a raid under way: the property, the gang, what kind of job it will be, seconds left to get there, and whether your
 * partner has gone to deal with it */
export type Raid = { id: BizId; gang: Gang; kind: RaidKind; t: number; total: number; sent: boolean };
/** the partner's errand: a round of the tills (collect) or a raid to see off (defend); `queue` the properties still to
 * visit, `got` the coins in their bag, `t` seconds out */
export type Round = { kind: 'collect' | 'defend'; queue: BizId[]; got: number; t: number; at: BizId | null; done: number; won?: boolean };
export type EmpState = { raid: Raid | null; round: Round | null; jaga: Actor | null; hinted: boolean; lastRank: number; /** no raids at the raid hours (the browser tests of other features) */ off?: boolean };
export const newEmp = (): EmpState => ({ raid: null, round: null, jaga: null, hinted: false, lastRank: -1 });

/** the numbers (Assist in brackets): seconds to reach a raid 110 (150), raid odds at each of the two raid hours 0.4 (0.3) */
export const EMP = { window: 110, windowAssist: 150, odds: 0.4, oddsAssist: 0.3, hours: [240, 480], minTill: 30, near: 230,
  /** a missed raid: share of the night's takings lost, and the chance it is damaged instead (level 2 and up, no jaga) */
  lose: 1, dmgOdds: 0.4,
  /** what a repair and a jaga cost (share of the stake, with a floor) */
  repairK: 0.12, repairMin: 80, jagaK: 0.3, jagaMin: 300,
  /** the partner seeing off a raid alone: base odds, per level, with a jaga, on Assist */
  sendBase: 0.55, sendLvl: 0.08, sendJaga: 0.2, sendAssist: 0.1 } as const;

const at = (b: BizDef): [number, number] => [b.at[0], b.at[1]];
export const repairCost = (id: BizId) => Math.max(EMP.repairMin, Math.round(BIZ_OF[id].price * EMP.repairK / 10) * 10);
export const jagaCost = (id: BizId) => Math.max(EMP.jagaMin, Math.round(BIZ_OF[id].price * EMP.jagaK / 10) * 10);
export const gangOf = (id: BizId): Gang => RAID_GANG[BIZ_OF[id].d];
/** which raid jobs a gang can bring: crows grab and run, the lizards keep low (no stand at the shop) */
export const RAID_KINDS: Record<Gang, RaidKind[]> = { crow: ['grab', 'defend', 'trap', 'chase'], mac: ['defend', 'trap', 'chase'], otter: ['defend', 'trap', 'chase'], myna: ['defend', 'trap', 'chase'], liz: ['trap', 'chase'] };
export const RAID_WHAT: Record<RaidKind, string> = { defend: 'Hold the shop', trap: 'Net them on the way in', chase: 'Run down the one with the till', grab: 'Catch the crows with the coins' };

// ── raids
/** the raid hours: maybe a raid on a property with coins in the till (one at a time, never mid-job) */
export function empireClock(w: World, before: number, after: number) {
  const s = w.s; if (w.emp.raid || w.run || w.emp.off) return;
  const marks = EMP.hours.filter(m => before < m && after >= m); if (!marks.length) return;
  const R = rng(hashStr(`jade-raid:${s.seed}:${s.night}:${marks[0]}`));
  const mine = owned(s).filter(b => w.open.has(b.d) && !s.biz[b.id].dmg && s.biz[b.id].bank >= EMP.minTill);
  if (!mine.length || R() > (w.assist ? EMP.oddsAssist : EMP.odds)) return;
  // a fuller till draws them; a jaga keeps them away
  const wt = mine.map(b => s.biz[b.id].bank * (s.biz[b.id].jaga ? 0.5 : 1)); let r = R() * wt.reduce((a, b) => a + b, 0), pick = mine[0];
  for (let i = 0; i < mine.length; i++) { r -= wt[i]; if (r <= 0) { pick = mine[i]; break; } }
  startRaidAlert(w, pick.id, R);
}
/** a raid begins: the text, the toast, the pin and the clock */
export function startRaidAlert(w: World, id: BizId, R = rng(hashStr(`jade-raidk:${w.s.seed}:${w.s.night}:${id}`))) {
  const b = BIZ_OF[id], gang = gangOf(id), kinds = RAID_KINDS[gang], st = w.s.biz[id];
  const kind = kinds[(st.raids + Math.floor(R() * kinds.length)) % kinds.length];
  const total = w.assist ? EMP.windowAssist : EMP.window;
  w.emp.raid = { id, gang, kind, t: total, total, sent: false };
  text(w, b.keeper, `Help! The ${GANG_NAME[gang]} are raiding the ${b.name}! Come quick (you have about ${Math.round(total / 60 * 2) / 2} minutes), or send ${w.mate.who === 'dora' ? 'Dora' : 'Enzo'} from the phone.`, { kind: 'help' });
  w.say(`Raid on the ${b.name}! Get there in time, or send your partner (phone → Empire).`, 'bad');
  w.fx.push({ t: 'raid-alert', name: b.name, x: bizPos(b)[0], y: bizPos(b)[1] });
}
/** E or arriving at the raided property: the raid's job starts */
export function startRaidJob(w: World) {
  const r = w.emp.raid; if (!r || w.run) return false;
  w.emp.raid = null; const b = BIZ_OF[r.id];
  w.startMission(raidJob(w, r.id, r.kind, r.gang), { key: 'raid:' + r.id, reward: raidReward(r.id), d: b.d });
  return true;
}
export const raidReward = (id: BizId) => 30 + Math.round(BIZ_OF[id].price * 0.04 / 5) * 5;
/** the raid's job, built for its property: one step of the kind the gang brings, then the keeper's thanks */
export function raidJob(w: World, id: BizId, kind: RaidKind, gang: Gang): Mission {
  const b = BIZ_OF[id], [px, py] = bizPos(b), name = GANG_NAME[gang], keep = b.keeper;
  let step: Step;
  if (kind === 'grab' && gang === 'crow') step = { t: 'raid', at: at(b), n: w.diff.extra > 0 ? 4 : 3, label: 'Dash or ride into each crow before it gets away', cp: true };
  else if (kind === 'defend' && gang !== 'liz') step = { t: 'defend', at: at(b), time: w.assist ? 40 : 45, waves: 2, per: w.assist ? 1 : 2, gang, what: 'Shop', label: `Hold the ${b.name}: knock the ${name} back before they reach the till${w.s.biz[id].jaga ? ' (Pak Duri, your jaga, helps)' : ''}`, cp: true };
  else if (kind === 'trap') {
    const t = trapPlan(w, px, py);
    step = t ? { t: 'trap', spots: t.spots, need: 3, bait: t.bait, wait: t.wait, path: t.path, gang, n: 3, catch: 2, label: `The ${name} are coming back for more: lay three nets on their way in (E)`, cp: true }
      : { t: 'chase', who: 'runner', skin: skinOf(gang), from: at(b), route: chaseLoop(w, px, py), bumps: 2, loot: 'coins', speed: w.assist ? 180 : 198, label: `One of the ${name} has the till! Run it down and bump it twice`, cp: true };
  } else step = { t: 'chase', who: 'runner', skin: skinOf(gang), from: at(b), route: chaseLoop(w, px, py), bumps: 2, loot: 'coins', speed: w.assist ? 180 : 198, label: `One of the ${name} has the till! Run it down and bump it twice`, cp: true };
  return { id: 'raid-' + id, ch: 0, title: `Raid on the ${b.name}`, giver: keep, at: '', blurb: '', reward: raidReward(id), rep: 2,
    steps: [step, { t: 'talk', lines: [[keep, `You came! The ${b.name} is safe and so is the till. Shiok!`, 'happy']] }] };
}
const skinOf = (g: Gang) => g === 'crow' ? undefined : g;
const tileOf = (x: number, y: number): [number, number] => [Math.floor(x / T), Math.floor(y / T)];
/** a loop of four street corners round the property for a chase (each on open pavement in an open district) */
export function chaseLoop(w: Pick<World, 'c' | 'open'>, px: number, py: number): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4, [x, y] = nearestFree(w.c, 'walk', px + Math.cos(a) * 9 * T, py + Math.sin(a) * 7 * T, w.open, 8);
    out.push(w.open.has(districtAt(...tileOf(x, y))) ? tileOf(x, y) : tileOf(px, py));
  }
  out.push(tileOf(...nearestFree(w.c, 'walk', px, py + T, w.open, 4)));
  return out;
}
/** the gang's way in for a trap: a walkable path of 9 to 18 tiles ending by the property, nets along it, a spot to
 * keep back at off to the side */
export function trapPlan(w: Pick<World, 'c' | 'open' | 'fieldTo'>, px: number, py: number): { spots: Spot[]; bait: Spot; wait: Spot; path: Spot[] } | null {
  const [bx, by] = nearestFree(w.c, 'walk', px, py + T, w.open, 4); const f = w.fieldTo('foot', bx, by);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 + 0.3, [sx, sy] = nearestFree(w.c, 'walk', bx + Math.cos(a) * 12 * T, by + Math.sin(a) * 12 * T, w.open, 6);
    if (!w.open.has(districtAt(...tileOf(sx, sy)))) continue;
    const tiles = tilesDown(f, ...tileOf(sx, sy)), L = tiles.length; if (L < 9 || L > 18) continue;
    const pick = (k: number) => tiles[Math.min(L - 2, Math.max(1, Math.round(L * k)))];
    const spots = [pick(0.3), pick(0.45), pick(0.6), pick(0.75)];
    const [mx, my] = tiles[Math.round(L * 0.55)], dx = tiles[L - 1][0] - tiles[0][0], dy = tiles[L - 1][1] - tiles[0][1], l = Math.hypot(dx, dy) || 1;
    const wait = tileOf(...nearestFree(w.c, 'walk', (mx - dy / l * 4 + 0.5) * T, (my + dx / l * 4 + 0.5) * T, w.open, 4));
    return { spots, bait: tiles[L - 1], wait, path: [tiles[0], pick(0.3), pick(0.6), tiles[L - 1]] };
  }
  return null;
}
/** every tile from (tx,ty) down a flow field to its goal (pathFrom simplifies to corners; a trap wants the tiles) */
export function tilesDown(f: { dist: Int32Array; tx: number; ty: number }, tx: number, ty: number): [number, number][] {
  const out: [number, number][] = []; if (f.dist[ty * W + tx] < 0) return out;
  for (let k = 0; k < 60; k++) {
    out.push([tx, ty]); if (tx === f.tx && ty === f.ty) break;
    let best = f.dist[ty * W + tx], bx = tx, by = ty;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (Math.abs(dx) + Math.abs(dy) !== 1) continue; const d = f.dist[(ty + dy) * W + tx + dx]; if (d >= 0 && d < best) { best = d; bx = tx + dx; by = ty + dy; } }
    if (bx === tx && by === ty) break; tx = bx; ty = by;
  }
  return out;
}
/** a raid nobody answered in time (or a raid job given up): that night's takings go, or the place is damaged */
export function missRaid(w: World, id: BizId, half = false): string {
  const s = w.s, st = s.biz[id], b = BIZ_OF[id];
  st.raids++; st.missed++; s.stats.raidsMissed++;
  const R = rng(hashStr(`jade-miss:${s.seed}:${s.night}:${id}:${st.missed}`));
  const soft = half || st.jaga;
  if (!soft && st.lvl >= 2 && R() < EMP.dmgOdds) { st.dmg = 1; w.fx.push({ t: 'raid-dmg', name: b.name }); return `The ${GANG_NAME[gangOf(id)]} smashed up the ${b.name}. It takes nothing until you repair it (${repairCost(id)} coins, at the shop).`; }
  const night = Math.max(st.tonight, bizRate(s, id, [...w.open]).rate * 0.5);
  const k = Math.floor(Math.min(st.bank, night * (soft ? 0.5 : EMP.lose)));
  st.bank -= k; st.tonight = soft ? st.tonight * 0.5 : 0;
  w.fx.push({ t: 'raid-lost', name: b.name, k });
  return `The ${GANG_NAME[gangOf(id)]} made off with ${k} coins from the ${b.name}${st.jaga ? ' (Pak Duri saved the rest)' : ''}.`;
}
/** a raid job won (lib/jade-game.ts finishMission) */
export function raidJobWon(w: World, id: BizId) { raidWon(w.s, id); w.s.stats.raidsWon++; }

// ── the partner's errands
export function canSend(w: World): string | null {
  if (w.two) return 'Your partner is player 2 now: they can walk over themselves';
  if (w.run) return 'Finish the job first';
  if (w.emp.round) return `${nameOf(w)} is already out`;
  if (w.mate.ride && !w.mate.seat) return `${nameOf(w)} is on a ride of their own`;
  return null;
}
const nameOf = (w: World) => w.mate.who === 'dora' ? 'Dora' : 'Enzo';
/** send the partner round the tills (from Kopi Boss): every owned property in an open district with coins in it */
export function sendRound(w: World): string | null {
  const why = canSend(w); if (why) return why;
  if (w.s.empire.rank < 2) return 'Reach Kopi Boss to send your partner round the tills';
  const left = owned(w.s).filter(b => w.open.has(b.d) && w.s.biz[b.id].bank >= 1);
  if (!left.length) return 'Every till is empty';
  // nearest first, then on to the nearest of the rest
  const queue: BizId[] = []; let [x, y] = [w.mate.x, w.mate.y]; const rest = left.slice();
  while (rest.length) { rest.sort((a, b) => dist(...bizPos(a), x, y) - dist(...bizPos(b), x, y)); const n = rest.shift()!; queue.push(n.id); [x, y] = bizPos(n); }
  w.emp.round = { kind: 'collect', queue, got: 0, t: 0, at: null, done: 0 };
  goNext(w); w.s.stats.rounds++;
  w.mate.act = { n: 'send', t: 0, dur: 0.8 }; w.fx.push({ t: 'round-out' });
  return null;
}
/** send the partner to see off the raid on their own */
export function sendDefend(w: World): string | null {
  const r = w.emp.raid; if (!r) return 'No raid to answer';
  const why = canSend(w); if (why) return why;
  r.sent = true;
  w.emp.round = { kind: 'defend', queue: [r.id], got: 0, t: 0, at: null, done: 0 };
  goNext(w); w.mate.act = { n: 'send', t: 0, dur: 0.8 }; w.fx.push({ t: 'round-out' });
  return null;
}
function goNext(w: World) {
  const rd = w.emp.round!, m = w.mate; rd.at = rd.queue.shift() ?? null;
  if (m.seat) { m.seat = null; m.b.x = w.p.x - 40; m.b.y = w.p.y + 10; }
  if (!rd.at) { m.ai = { ...m.ai, mode: 'follow', at: null, story: false, holding: false }; return; }
  const [x, y] = bizPos(BIZ_OF[rd.at]); const [gx, gy] = nearestFree(w.c, 'walk', x - 40, y + 50, w.open, 3);
  m.ai = { ...m.ai, mode: 'post', at: [gx, gy], story: true, holding: false, t: 0, stuck: 0, best: 1e9, offT: 0 };
}
/** hand over what the partner collected (back at your side, or a job needs them now) */
function handOver(w: World, early = false) {
  const rd = w.emp.round; if (!rd) return;
  w.emp.round = null;
  if (rd.got > 0) { w.s.cash += rd.got; w.s.stats.bizCoins += rd.got; w.fx.push({ t: 'coins', x: w.p.x, y: w.p.y, k: rd.got }); w.say(`${nameOf(w)} hands you ${rd.got} coins from ${rd.done} till${rd.done === 1 ? '' : 's'}.`, 'good'); }
  if (rd.kind === 'defend' && rd.won !== undefined && !early) w.say(rd.won ? `${nameOf(w)} saw off the raid on their own!` : `${nameOf(w)} got there, but the gang got away with some coins.`, rd.won ? 'good' : 'bad');
  if (w.mate.ai.story) w.mate.ai = { ...w.mate.ai, mode: 'follow', at: null, story: false };
  if (!w.mate.act && !w.mate.ride && !w.mate.seat && !early) w.mate.act = { n: 'bag', t: 0, dur: 1.1 };
}
function roundStep(w: World, dt: number) {
  const rd = w.emp.round!, m = w.mate; rd.t += dt;
  // a job, two players or a switch of hero ends the errand: what they have so far is yours
  if (w.run || w.two || m.ai.mode === 'follow' && rd.at) { handOver(w, true); return; }
  if (!rd.at) { if (dist(m.x, m.y, w.p.x, w.p.y) < 170 || rd.t > 240) handOver(w); return; }
  const b = BIZ_OF[rd.at], [bx, by] = bizPos(b);
  // there: by the counter, or at the spot they were sent to (it can be a tile or two off the counter)
  const goal = m.ai.at; if (m.act || dist(m.x, m.y, bx, by) > 90 && !(goal && dist(m.x, m.y, goal[0], goal[1]) < 48)) return;
  const st = w.s.biz[rd.at];
  if (rd.kind === 'collect') {
    const k = Math.floor(st.bank); st.bank -= k; rd.got += k; rd.done++;
    m.act = { n: 'collect', t: 0, dur: 0.9 }; m.face = 'up';
    if (k > 0) w.fx.push({ t: 'mate-coins', x: bx, y: by, k });
  } else {
    const R = rng(hashStr(`jade-send:${w.s.seed}:${w.s.night}:${rd.at}:${st.raids}`));
    const odds = Math.min(0.95, EMP.sendBase + EMP.sendLvl * st.lvl + (st.jaga ? EMP.sendJaga : 0) + (w.assist ? EMP.sendAssist : 0));
    rd.won = R() < odds;
    if (rd.won) { raidJobWon(w, rd.at); rd.got += Math.round(raidReward(rd.at) / 2); addRep(w.s, b.d, 1); w.s.stats.palHelps++; m.act = { n: 'shoo', t: 0, dur: 1.2 }; w.fx.push({ t: 'shoo', x: bx, y: by }); }
    else { w.say(missRaid(w, rd.at, true), 'bad'); m.act = { n: 'shoo', t: 0, dur: 1.2 }; }
    w.emp.raid = null;
  }
  goNext(w);
}

// ── the jaga in a stand at the shop: a smart guard on your side
function jagaStep(w: World, dt: number) {
  const run = w.run; const id = run && run.m.id.startsWith('raid-') ? run.m.id.slice(5) : null;
  if (!run || !id || run.cur?.t !== 'defend' || !w.s.biz[id]?.jaga) { w.emp.jaga = null; return; }
  const [px, py] = bizPos(BIZ_OF[id]);
  let j = w.emp.jaga;
  if (!j || !run.actors.includes(j)) {
    const [x, y] = nearestFree(w.c, 'walk', px + 60, py + 50, w.open, 3);
    j = run.actor('jaga', x, y, 'foot', [nearestFree(w.c, 'walk', px - 120, py + 60, w.open, 3), nearestFree(w.c, 'walk', px + 120, py + 60, w.open, 3)], 70);
    j.mind = newMind(); run.actors.push(j); w.emp.jaga = j;
  }
  const mind = j.mind as Mind; mind.t += dt; j.t += dt;
  // what he can see: a gang member in the open within 340 ahead of him, a sneak only within 110
  const pests = run.actors.filter(a => a.kind === 'pest' && !a.gone && a.extra !== 2);
  let seen: Actor | null = null, sd = 1e9;
  for (const a of pests) { const d = dist(a.b.x, a.b.y, j.b.x, j.b.y); const ahead = Math.abs(Math.atan2(a.b.y - j.b.y, a.b.x - j.b.x) - j.b.h) < 1.4 || d < 160; if (d < (a.sneaky ? 110 : 340) && ahead && d < sd) { sd = d; seen = a; } }
  const react = w.assist ? 0.5 : 0.7;
  if (seen && mind.st === 'patrol') { mind.st = 'sus'; mind.t = 0; mind.at = [seen.b.x, seen.b.y]; }
  if (mind.st === 'sus') { j.b.speed = 0; if (seen) j.b.h = Math.atan2(seen.b.y - j.b.y, seen.b.x - j.b.x); if (mind.t > react) { mind.st = seen ? 'alert' : 'back'; mind.t = 0; if (seen) w.fx.push({ t: 'jaga-call', x: j.b.x, y: j.b.y }); } return; }
  if (mind.st === 'alert') {
    const tgt = seen ?? pests.sort((a, b) => dist(a.b.x, a.b.y, j!.b.x, j!.b.y) - dist(b.b.x, b.b.y, j!.b.x, j!.b.y))[0];
    if (!tgt || mind.t > 6) { mind.st = 'back'; mind.t = 0; return; }
    const dx = tgt.b.x - j.b.x, dy = tgt.b.y - j.b.y, l = Math.hypot(dx, dy) || 1, sp = w.assist ? 175 : 160;
    j.b.h = Math.atan2(dy, dx); j.b.x += dx / l * sp * dt; j.b.y += dy / l * sp * dt; j.b.speed = sp;
    if (l < 44) { tgt.extra = 2; tgt.stun = 1.1; tgt.b.h = Math.atan2(tgt.b.y - py, tgt.b.x - px); w.fx.push({ t: 'shoo', x: tgt.b.x, y: tgt.b.y }); mind.st = 'patrol'; mind.t = 0; j.stun = 0.6; }
    return;
  }
  if (j.stun > 0) { j.stun -= dt; j.b.speed = 0; return; }
  // patrol (and back): his beat in front of the shop, stopping at each end to look round
  if (mind.st === 'back') mind.st = 'patrol';
  const [tx, ty] = j.route[j.wp % j.route.length], dx = tx - j.b.x, dy = ty - j.b.y, l = Math.hypot(dx, dy);
  if (l < 12) { j.look += dt; j.b.speed = 0; j.b.h += Math.sin(j.t * 2) * dt; if (j.look > 1.4) { j.look = 0; j.wp++; } return; }
  j.b.h = Math.atan2(dy, dx); j.b.x += dx / l * j.speed * dt; j.b.y += dy / l * j.speed * dt; j.b.speed = j.speed;
}

// ── the step, the night, prompts
export function empireStep(w: World, dt: number) {
  const s = w.s;
  // a new rank: a card, a text and its perk
  const r = rankOf(s);
  if (r > s.empire.rank) {
    s.empire.rank = r; const k = RANKS[r];
    w.fx.push({ t: 'rank-up', k: r, name: k.name });
    w.banner = { text: k.name, sub: `Empire rank ${r} of 4 · ${k.perk}`, t: 4 };
    text(w, 'huat', `Wah, ${k.name} already! ${k.perk}.`);
  }
  // the first hint: a stake you can afford, or a property for sale where you stand
  if (!w.emp.hinted && s.done.includes('m1') && !owned(s).length && !w.run && w.tick % 120 === 0) {
    const b = BIZ.filter(b => w.open.has(b.d) && s.cash >= b.price && s.rep[b.d] >= b.need)[0];
    if (b) { w.emp.hinted = true; if (!s.learned.includes('empire')) { s.learned.push('empire'); w.fx.push({ t: 'hint', msg: `You can afford a stake in the ${b.name}. Properties for sale have a gold pin on the map; buy in, and it earns coins every night (phone → Empire).` }); } }
  }
  if (w.emp.round) roundStep(w, dt);
  jagaStep(w, dt);
  const rd = w.emp.raid;
  if (rd && !rd.sent && !w.run) {
    rd.t -= dt;
    const b = BIZ_OF[rd.id], [bx, by] = bizPos(b);
    if (!w.p.roof && dist(w.p.x, w.p.y, bx, by) < EMP.near && !w.ferry && w.taxi?.st !== 'ride') { startRaidJob(w); return; }
    if (rd.t <= 0) { w.emp.raid = null; const msg = missRaid(w, rd.id); w.say(msg, 'bad'); text(w, b.keeper, msg); }
  }
}
/** the night ends: a nudge toward an empire job you could do tonight */
export function empireNight(w: World) {
  const s = w.s; const mine = owned(s).filter(b => w.open.has(b.d)); if (!mine.length) return;
  const R = rng(hashStr(`jade-empn:${s.seed}:${s.night}`)); if (R() > 0.5) return;
  const offers = mine.flatMap(b => jobsAt(w, b.id).map(j => [b, j] as const)); if (!offers.length) return;
  const [b, j] = offers[Math.floor(R() * offers.length)];
  text(w, j.giver, `${j.blurb} Come to the ${b.name} if you want the job (${j.reward} coins, and the shop takes more for ${j.boost[1]} nights).`);
}
/** the empire jobs a property offers now: its kind, your rank, not yet done tonight */
export function jobsAt(w: World, id: BizId): EmpJobDef[] {
  const b = BIZ_OF[id], st = w.s.biz[id]; if (!st?.lvl || st.dmg) return [];
  return EMPIRE_JOBS.filter(j => b.kind && j.kinds.includes(b.kind) && w.s.empire.rank >= j.rank && w.s.empire.last[j.id] !== w.s.night && (j.id !== 'karaoke' || w.open.has('docks')) && (j.id !== 'tour' || tourOk(w, b)));
}
const tourOk = (w: World, b: BizDef) => b.kind === 'kayak' ? w.open.has('resort') : w.open.has('canal');
/** start an empire job at a property */
export function startEmpireJob(w: World, jobId: string, id: BizId): string | null {
  if (w.run) return 'Finish the job you are on first';
  if (!jobsAt(w, id).some(j => j.id === jobId)) return 'Not on offer here tonight';
  const j = EMPIRE_JOB[jobId], m = empireJob(w, jobId, id);
  w.startMission(m, { key: `emp:${jobId}:${id}`, reward: j.reward, d: BIZ_OF[id].d });
  return null;
}
/** an empire job finished (lib/jade-game.ts finishMission): counts, the night, the boost */
export function empireJobDone(w: World, key: string) {
  const [, jobId, id] = key.split(':'); const j = EMPIRE_JOB[jobId], st = w.s.biz[id]; if (!j) return;
  w.s.empire.jobs[jobId] = (w.s.empire.jobs[jobId] ?? 0) + 1; w.s.empire.last[jobId] = w.s.night; w.s.stats.empJobs++;
  if (jobId === 'inspector') w.s.stats.gradeA++;
  if (st) { st.boost = j.boost[1]; st.boostK = j.boost[0]; }
}
/** E prompts at the properties: a damaged one says so; the raided one starts its job */
export function empireNear(w: World, cand: (n: Near, r: number) => void) {
  const rd = w.emp.raid; if (rd && !rd.sent && !w.run) { const [x, y] = bizPos(BIZ_OF[rd.id]); cand({ kind: 'empire', label: `Stop the raid on the ${BIZ_OF[rd.id].name}!`, x, y: y + 40, id: 'raid' }, EMP.near + 40); }
}
export function empireAct(w: World, id: string) { if (id === 'raid') startRaidJob(w); }
/** where the route line goes with nothing else on: the raid */
export function empireTarget(w: World): [number, number] | null { const rd = w.emp.raid; if (!rd || rd.sent) return null; return bizPos(BIZ_OF[rd.id]); }
/** a property's label for the E prompt */
export function bizLabel(w: World, b: BizDef): string {
  const st = w.s.biz[b.id];
  if (!st.lvl) return `${b.name} (for sale: ${b.price.toLocaleString('en-GB')} coins)`;
  if (st.dmg) return `${b.name}: damaged, repair it (${repairCost(b.id)} coins)`;
  const jobs = jobsAt(w, b.id);
  return `${b.name}: ${Math.floor(st.bank)} coins in the till${jobs.length ? ` · ${jobs.length} empire job${jobs.length > 1 ? 's' : ''}` : ''}`;
}
/** repairs and the jaga, through the World so the hero acts them out */
export function repairBiz(w: World, id: BizId): string | null {
  const st = w.s.biz[id]; if (!st?.dmg) return 'Nothing to repair';
  const c = repairCost(id); if (w.s.cash < c) return `Needs ${c} coins`;
  w.s.cash -= c; st.dmg = 0; w.s.stats.repairs++;
  if (!w.p.ride) w.p.act = { n: 'repair', t: 0, dur: 1.6 }; w.fx.push({ t: 'repair', name: BIZ_OF[id].name });
  return null;
}
export function hireJaga(w: World, id: BizId): string | null {
  const st = w.s.biz[id]; if (!st?.lvl) return 'Buy a stake first';
  if (st.jaga) return 'Pak Duri already keeps watch here';
  if (w.s.empire.rank < 3) return 'Reach Shophouse Tycoon to hire a jaga';
  const c = jagaCost(id); if (w.s.cash < c) return `Needs ${c} coins`;
  w.s.cash -= c; st.jaga = true;
  if (!w.p.ride) w.p.act = { n: 'shake', t: 0, dur: 1 }; w.fx.push({ t: 'jaga-hired', name: BIZ_OF[id].name });
  return null;
}
/** the ledger's totals: tonight's expected takings, what is in the tills, the last nights, what you have put in */
export function ledger(w: World) {
  const open = [...w.open], s = w.s, mine = owned(s);
  const rate = (id: BizId) => bizRate(s, id, open, { daily: w.event, festival: w.festival }).rate;
  return { mine: mine.length, all: BIZ.length, tonight: mine.reduce((a, b) => a + rate(b.id), 0), till: mine.reduce((a, b) => a + Math.floor(s.biz[b.id].bank), 0),
    damaged: mine.filter(b => s.biz[b.id].dmg).length, jagas: mine.filter(b => s.biz[b.id].jaga).length, rate };
}

// ── the empire jobs, built for the property they are taken at
function marketNear(w: World, x: number, y: number): string {
  let best = 'mk-market', bd = 1e18;
  for (const [id, pl] of Object.entries(w.c.places)) if (pl.kind === 'market' && w.open.has(pl.d)) { const d = dist(pl.x, pl.y, x, y); if (d < bd && d > 6 * T) { bd = d; best = id; } }
  return best;
}
/** litter round the front: five spots on the pavement within six tiles */
function litterSpots(w: World, x: number, y: number): Spot[] {
  const out: Spot[] = [];
  // six bits of litter round the block, five to ten tiles out (the inspector checks the whole street front)
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.5, r = (5 + (i * 7) % 6) * T; const [lx, ly] = nearestFree(w.c, 'walk', x + Math.cos(a) * r, y + 40 + Math.sin(a) * r, w.open, 4); out.push(tileOf(lx, ly)); }
  return out;
}
export function empireJob(w: World, jobId: string, id: BizId): Mission {
  const j = EMPIRE_JOB[jobId], b = BIZ_OF[id], [px, py] = bizPos(b), me = at(b), g = j.giver;
  const front = tileOf(...nearestFree(w.c, 'walk', px, py + T, w.open, 3));
  let steps: Step[] = [];
  switch (jobId) {
    case 'supplier': {
      const mk = marketNear(w, px, py), [mx, my] = [w.c.places[mk].x, w.c.places[mk].y], d = dist(mx, my, px, py) / T;
      steps = [
        { t: 'talk', lines: [[g, `Boss! Fresh stock at ${w.c.places[mk].name ?? 'the market'}, half the usual price, but it won’t keep. You fetch, I give you the price.`, 'happy'], ['hero', 'Deal. To the market, then straight to the kitchen.', 'calm']] },
        { t: 'pickup', at: mk, item: 'fish-basket', label: `Fetch Ah Huat’s stock from ${w.c.places[mk].name ?? 'the market'}`, cp: true },
        { t: 'deliver', to: front, item: 'fish-basket', time: Math.round(d * 1.15 + 22), fragile: 6, label: `Get the stock to the ${b.name} before it spoils (don’t bump it)` },
        { t: 'talk', lines: [[g, 'Fresh-fresh! Your cooks will be smiling all week.', 'happy']] },
      ];
      break;
    }
    case 'inspector':
      steps = [
        { t: 'talk', lines: [[g, `Inspector Siew, Environment Agency. I’m inspecting the ${b.name} shortly. Fine city, you know.`, 'calm'], ['mate', 'Litter by the door! Quick, before she gets there.', 'worried']] },
        { t: 'collect', items: litterSpots(w, px, py), item: 'litter', time: w.assist ? 70 : 55, label: `Pick up every bit of litter round the ${b.name} before the inspector arrives (E)`, cp: true },
        { t: 'goto', at: front, label: `Meet Inspector Siew at the door of the ${b.name}`, ride: 'foot', r: 90 },
        { t: 'talk', lines: [[g, 'Clean floor, clean bins, not one tissue packet. Grade A. Put it in the window.', 'happy']] },
      ];
      break;
    case 'pricewar': {
      const R = rng(hashStr(`jade-pw:${w.s.seed}:${w.s.night}:${id}`));
      // Hoot's store: a street corner 10 to 14 tiles away; his runner's way there; three crates and a guard outside
      let store: [number, number] = front, route: Spot[] = [], from: Spot = front;
      for (let k = 0; k < 10; k++) {
        const a = R() * Math.PI * 2, [sx, sy] = nearestFree(w.c, 'walk', px + Math.cos(a) * 12 * T, py + Math.sin(a) * 12 * T, w.open, 5);
        if (!w.open.has(districtAt(...tileOf(sx, sy)))) continue;
        const p = tilesDown(w.fieldTo('foot', sx, sy), ...tileOf(px, py + T)); if (p.length < 8 || p.length > 30) continue;
        // the runner sets off five tiles ahead of you (right beside you, he'd spot you at once)
        store = tileOf(sx, sy); from = p[Math.min(5, p.length - 1)]; route = [0.45, 0.75, 1].map(q => p[Math.min(p.length - 1, Math.round((p.length - 1) * q))]); break;
      }
      if (!route.length) route = [store];
      const [sx, sy] = [(store[0] + 0.5) * T, (store[1] + 0.5) * T];
      const crates: Spot[] = [0, 1, 2].map(q => tileOf(...nearestFree(w.c, 'walk', sx + Math.cos(q * 2.1) * 2.5 * T, sy + Math.sin(q * 2.1) * 2.5 * T, w.open, 3)));
      const g1 = tileOf(...nearestFree(w.c, 'walk', sx - 4 * T, sy + 3 * T, w.open, 3)), g2 = tileOf(...nearestFree(w.c, 'walk', sx + 4 * T, sy + 3 * T, w.open, 3));
      steps = [
        { t: 'talk', lines: [[g, `Hoo-hoo. Half price at Hoot’s, every night. The ${b.name}? Empty by Sunday.`, 'smug'], ['mate', 'Half price on rotten stock and fake boards. Follow his runner, find his store.', 'cross']] },
        { t: 'tail', from, route, calm: 0.85, label: 'Tail Hoot’s runner to his store (keep back, out of sight)', cp: true },
        { t: 'swap', crates, guards: [[g1, g2]], time: w.assist ? 90 : 70, decoy: 'ticket', label: 'Swap his fake “half price” boards for honest ones while his guard looks away (E at each crate)', cp: true },
        { t: 'talk', lines: [[g, 'Hoo?! My boards say… fair prices? Who did this?!', 'cross'], ['hero', 'Fine city, Towkay. Fair prices too.', 'smug']] },
      ];
      break;
    }
    case 'taxi':
      steps = [
        { t: 'talk', lines: [[g, 'The trains are down for repairs tonight and the queue at our stand goes round the block. Take the company tuk-tuk!', 'worried']] },
        { t: 'ride', kind: 'tuktuk', near: front, label: 'Get in the company tuk-tuk', cp: true },
        { t: 'fares', n: 3, label: 'Drive three fares' },
        { t: 'talk', lines: [[g, 'Three happy fares, three good reviews. The company thanks you!', 'happy']] },
      ];
      break;
    case 'tour': {
      const kay = b.kind === 'kayak';
      steps = [
        { t: 'talk', lines: [[g, kay ? 'Tourists for the lagoon tour! Round every buoy, and don’t tip them in.' : 'Tourists for the lantern tour! Through every gate, and wave at the ducks.', 'happy']] },
        kay ? { t: 'ride', kind: 'boat', near: [125, 108], label: 'Step into the tour boat by the ferry pier', cp: true } : { t: 'ride', kind: 'boat', near: 'jetty', label: 'Step into the bumboat at the jetty', cp: true },
        kay ? { t: 'race', ride: 'boat', time: w.assist ? 110 : 90, marks: [[124, 121], [114, 126], [96, 125], [114, 126], [132, 126], [132, 112]], label: 'Steer round every buoy before the tourists get bored' }
          : { t: 'race', ride: 'boat', time: w.assist ? 80 : 66, marks: [[67, 26], [67, 14], [67, 40], [67, 58], [67, 46], [67, 32]], label: 'Steer through every lantern gate before the tourists get bored' },
        { t: 'talk', lines: [[g, 'Five stars from the boat! They want to come back tomorrow.', 'happy']] },
      ];
      break;
    }
    case 'karaoke':
      steps = [
        { t: 'talk', lines: [[g, `Darling, my lucky microphone is at the getai stage and I’m on at the ${b.name} in no time!`, 'worried'], ['mate', 'Fetch the mic, then keep the crows off the stage.', 'calm']] },
        { t: 'pickup', at: 'getai', item: 'mic', label: 'Fetch Lily’s lucky microphone from the getai stage', cp: true },
        { t: 'deliver', to: front, item: 'mic', time: Math.round(dist(w.c.places.getai.x, w.c.places.getai.y, px, py) / T * 1.2 + 24), label: `Get the mic to the ${b.name} before the show` },
        { t: 'defend', at: me, time: w.assist ? 36 : 40, waves: 2, per: 1, gang: 'crow', what: 'Show', label: 'Crows heckling the show! Knock them back before they reach the stage', cp: true },
        { t: 'talk', lines: [[g, 'Encore! Encore! The till’s ringing like a cymbal, darling.', 'happy']] },
      ];
      break;
  }
  return { id: `emp-${jobId}`, ch: 0, title: j.title, giver: g, at: '', blurb: j.blurb, reward: j.reward, rep: 2, steps };
}
void PEOPLE; void FOOT; void DISTRICT_NAME;

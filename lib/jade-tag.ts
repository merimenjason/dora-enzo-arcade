// Jade Street: tag-team moves, all on one key (F). What F does depends on where you are: on a ride with your partner
// behind you, they grab (a magpie's loot, a thief's prize, a cargo snatcher); at a wall with crates against it, your
// partner gives you a boost up onto the roof (and from the roof edge you haul them up after you); near a magpie on
// foot, the two of you pounce together; with a warden on your tail, your partner waves and pulls a silly dance to
// draw them off; a job may ask for more (hold a lever, wait at a relay point: lib/jade-team.ts). Otherwise F tells
// your partner to wait, or calls them back. Each move has its own painted animation for both heroes.
import { T, districtAt } from './jade-city.js';
import { dist } from './jade-rng.js';
import { nearestFree } from './jade-nav.js';
import { catchEventMagpie } from './jade-gear.js';
import { GOOD, type Good } from './jade-trade.js';
import type { World, Player } from './jade-game.js';
import type { Actor } from './jade-mission.js';

export type TagOpt = { kind: string; label: string; go: () => void };
export const nameOf = (h: string) => h === 'dora' ? 'Dora' : 'Enzo';
/** the wall spots where one hero can boost the other onto the flat roofs: [street tile, roof tile] */
export const BOOSTS: { g: [number, number]; r: [number, number] }[] = [
  { g: [93, 39], r: [94, 39] }, { g: [105, 39], r: [104, 39] }, { g: [99, 41], r: [99, 40] }, { g: [99, 45], r: [99, 44] },
  { g: [7, 71], r: [6, 71] }, { g: [7, 79], r: [6, 79] }, { g: [3, 73], r: [2, 72] },
];
export const boostXY = (i: number, roof: boolean): [number, number] => { const b = BOOSTS[i]; const [x, y] = roof ? b.r : b.g; return [x * T + T / 2, y * T + T / 2]; };
export function boostNear(w: World, p: Player, roof = false, r = 80): number {
  for (let i = 0; i < BOOSTS.length; i++) { const [x, y] = boostXY(i, roof); if (dist(x, y, p.x, p.y) < r && w.open.has(districtAt(BOOSTS[i].g[0], BOOSTS[i].g[1]))) return i; }
  return -1;
}

/** what F would do right now (the HUD shows it), or null */
export function tagOption(w: World): TagOpt | null {
  const p = w.p, m = w.mate, n = nameOf(m.who);
  if (w.talk || w.ui || w.failed || p.act || p.hide || m.act) return null;
  const r = w.run?.tagOption(); if (r) return r;
  if (p.ride) {
    if (m.seat !== p.ride) return null;
    const t = grabTarget(w); if (t) return { kind: 'snatch', label: `${n} grabs it!`, go: () => snatch(w, t) };
    return null;
  }
  if (m.seat || m.ride) return null;
  const d = dist(p.x, p.y, m.x, m.y);
  if (!p.roof && !m.roof && d < 200) { const b = boostNear(w, p); if (b >= 0) return { kind: 'boost', label: `${n} gives you a boost onto the roof`, go: () => boost(w, p, m, b) }; }
  if (p.roof && !m.roof) { const b = boostNear(w, p, true, 90); if (b >= 0) return { kind: 'haul', label: `Haul ${n} up onto the roof`, go: () => haul(w, p, m, b) }; }
  const pt = pounceNear(w, m, p); if (pt) return { kind: 'pounce', label: 'Pounce on the magpie together!', go: () => pounce(w, pt.id) };
  if (w.heat >= 1 && !p.roof && !m.roof) { const wd = w.wardens.find(x => !x.leave && x.stun <= 0 && dist(x.b.x, x.b.y, m.x, m.y) < 560); if (wd) return { kind: 'distract', label: `${n} distracts the warden`, go: () => distract(w, wd.b.x, wd.b.y, 5) }; }
  if (m.ai.mode === 'follow') return { kind: 'wait', label: `${n} waits here`, go: () => { m.ai = { ...m.ai, mode: 'stay', at: [m.x, m.y], story: false }; w.fx.push({ t: 'tag-wait', x: m.x, y: m.y }); } };
  if (!m.ai.story) return { kind: 'call', label: `Call ${n} over`, go: () => { m.ai = { ...m.ai, mode: 'follow', story: false }; w.fx.push({ t: 'tag-call', x: m.x, y: m.y }); } };
  return null;
}
export function tag(w: World): boolean { const o = tagOption(w); if (!o) return false; o.go(); w.s.stats.tags = (w.s.stats.tags ?? 0) + 1; w.fx.push({ t: 'tag', kind: o.kind }); return true; }

// ── the passenger's grab
type Grab = { kind: 'actor'; a: Actor } | { kind: 'loot' } | { kind: 'event' } | { kind: 'snatcher'; i: number };
export const GRAB_REACH = 130;
export function grabTarget(w: World): Grab | null {
  const p = w.p, reach = GRAB_REACH * (w.assist ? 1.2 : 1);
  if (w.run) {
    for (const a of w.run.actors) if (!a.gone && a.stun <= 0 && ['cart', 'runner', 'boss', 'boat', 'raider', 'decoy', 'bagbird'].includes(a.kind) && dist(a.b.x, a.b.y, p.x, p.y) < reach + (a.kind === 'bagbird' ? 0 : 20) && (a.kind !== 'bagbird' || (a.extra ?? 0) > 0)) return { kind: 'actor', a };
    if (w.run.loot && dist(w.run.loot.x, w.run.loot.y, p.x, p.y) < reach + 20) return { kind: 'loot' };
    const it = w.run.items.find(i => !i.got && dist(i.x, i.y, p.x, p.y) < reach); if (it) return { kind: 'loot' };
  }
  const e = w.street; if (e && e.kind === 'magpie' && e.phase === 'on' && e.b && dist(e.b.x, e.b.y, p.x, p.y) < reach) return { kind: 'event' };
  const si = w.snatchers.findIndex(m => !m.out && dist(m.x, m.y, p.x, p.y) < reach); if (si >= 0) return { kind: 'snatcher', i: si };
  return null;
}
export function snatch(w: World, t: Grab) {
  const m = w.mate; m.grabT = 0.5; const p = w.p;
  w.fx.push({ t: 'grab', x: p.x, y: p.y, name: m.who });
  if (t.kind === 'actor') { w.run?.onGrab(t.a); return; }
  if (t.kind === 'loot') { w.run?.onGrab(null); return; }
  if (t.kind === 'event' && w.street) { catchEventMagpie(w, w.street); return; }
  if (t.kind === 'snatcher') { const s = w.snatchers[t.i]; s.out = true; s.dizzy = 1; if (s.took > 0 && s.good) { w.s.cargo[s.good as Good] += s.took; w.say(`${nameOf(m.who)} snatched your ${GOOD[s.good as Good].name.toLowerCase()} back!`, 'good'); s.took = 0; } else w.say(`${nameOf(m.who)} shooed the magpie off!`, 'good'); }
}

// ── boost up and haul up
export function boost(w: World, p: Player, m: Player, i: number) {
  const [gx, gy] = boostXY(i, false), [rx, ry] = boostXY(i, true);
  m.b.x = gx; m.b.y = gy + 6; m.face = 'down'; p.b.x = gx + 4; p.b.y = gy - 4; p.b.speed = 0; m.b.speed = 0;
  m.act = { n: 'boost-give', t: 0, dur: 0.9 };
  p.act = { n: 'boost-rise', t: 0, dur: 0.6, then: () => { p.roof = true; p.b.x = rx; p.b.y = ry; p.lastRoof = [rx, ry]; w.fx.push({ t: 'land', x: rx, y: ry, k: 0.4 }); } };
  m.ai = { ...m.ai, mode: 'stay', at: [gx, gy], story: false };
  w.fx.push({ t: 'boost', x: gx, y: gy, kind: 'up' });
}
export function haul(w: World, p: Player, m: Player, i: number) {
  const [gx, gy] = boostXY(i, false), [rx, ry] = boostXY(i, true);
  // the partner runs to the foot of the wall first (or is there already)
  const go = () => {
    m.b.x = gx; m.b.y = gy; p.b.x = rx; p.b.y = ry; p.b.speed = 0;
    p.act = { n: 'haul', t: 0, dur: 0.9 };
    m.act = { n: 'boost-rise', t: 0, dur: 0.9, then: () => { m.roof = true; m.b.x = rx + 20; m.b.y = ry + 6; m.lastRoof = [m.b.x, m.b.y]; m.ai = { ...m.ai, mode: 'follow', story: false }; } };
    w.fx.push({ t: 'boost', x: gx, y: gy, kind: 'haul' });
  };
  if (dist(m.x, m.y, gx, gy) > 260) { const [x, y] = nearestFree(w.c, 'walk', gx, gy, w.open, 2); m.b.x = x; m.b.y = y; }
  go();
}

// ── pounce together: the partner dives at the magpie; dash into it too within a moment for a double pounce
export function pounceNear(w: World, m: Player, p: Player): { id: number } | null {
  if (m.roof || p.ride || m.seat) return null;
  if (w.run) { const a = w.run.actors.find(a => !a.gone && a.stun <= 0 && ['runner', 'raider', 'decoy', 'bagbird', 'boss'].includes(a.kind) && (a.b.cls === 'foot' || a.kind === 'bagbird') && dist(a.b.x, a.b.y, m.x, m.y) < 340 && (a.kind !== 'bagbird' || (a.extra ?? 0) > 0)); if (a) return { id: a.id }; }
  const e = w.street; if (e && e.kind === 'magpie' && e.phase === 'on' && e.b && dist(e.b.x, e.b.y, m.x, m.y) < 340) return { id: -1 };
  return null;
}
export function pounce(w: World, id: number) {
  const m = w.mate; m.ai = { ...m.ai, mode: 'pounce', tgt: id, t: 0 };
  w.pounceAt = { id, t: w.time, mate: false, you: false };
  w.fx.push({ t: 'pounce', x: m.x, y: m.y, name: m.who });
}
/** the partner reaching the target during a pounce */
export function matePounceHit(w: World): boolean {
  const m = w.mate; if (m.ai.mode !== 'pounce') return false;
  const t = w.pounceTarget(m.ai.tgt); if (!t || dist(t[0], t[1], m.b.x, m.b.y) > 34) return false;
  m.ai.mode = 'follow'; m.act = { n: 'pounce', t: 0, dur: 0.3 };
  if (m.ai.tgt === -1 && w.street) { catchEventMagpie(w, w.street); return true; }
  return true;
}

// ── distract: wave and dance where they can see you
export function distract(w: World, tx: number, ty: number, dur: number) {
  const m = w.mate, a = Math.atan2(m.y - ty, m.x - tx);
  const [x, y] = nearestFree(w.c, 'walk', tx + Math.cos(a) * 200, ty + Math.sin(a) * 200, w.open, 3);
  m.ai = { ...m.ai, mode: 'distract', at: [x, y], t: 0, dur, holding: false };
  w.fx.push({ t: 'distract', x: m.x, y: m.y, name: m.who });
}
/** a warden who can see a waving, dancing partner stops to stare */
export function distractStep(w: World) {
  const m = w.mate; if (m.ai.mode !== 'distract' || !m.ai.holding) return;
  for (const wd of w.wardens) if (!wd.leave && dist(wd.b.x, wd.b.y, m.x, m.y) < 650) { wd.stun = Math.max(wd.stun, 0.25); wd.stare = 0.3; }
}
export const pounceWindow = (w: World) => w.assist ? 1.2 : 0.8;
export type { Actor };

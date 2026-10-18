// Hay Bale Brawl's motion: how a critter moves for the event playing now, where the lines stand while they close up,
// and the shop's short effects. Pure numbers, no canvas, so tests can check it. Everything is driven by an event's
// progress (0 to 1) or an effect's age, never by the clock alone: nobody bobs while nothing is happening.
import type { FightEvent, Outcome, Unit } from './hay-bale-game.js';

/** Offsets about a critter's feet: move, scale, tip over (radians, positive clockwise) and fade. */
export type Pose = { dx: number; dy: number; sx: number; sy: number; rot: number; alpha: number };
export const REST: Readonly<Pose> = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, alpha: 1 };

const clamp = (p: number) => Math.max(0, Math.min(1, p));
/** 0 up to 1 and back to 0. */
export const arc = (p: number) => Math.sin(Math.PI * clamp(p));
/** 0 to 1 with a small overshoot, for things popping into place. */
export const backOut = (p: number) => { const q = clamp(p) - 1; return 1 + q * q * (2.7 * q + 1.7); };
export const smooth = (p: number) => { const q = clamp(p); return q * q * (3 - 2 * q); };

type Shown = Unit & { dead?: boolean };
/** The two lines as they stand after the first `n` events. */
export function replayLines(o: Outcome, n: number) {
  const lines: Shown[][] = [o.left.map((u) => ({ ...u, a: u.a + u.tmpA, tmpA: 0 })), o.rival.line.map((u) => ({ ...u, a: u.a + u.tmpA, tmpA: 0 }))];
  const find = (uid: number) => lines[0].find((u) => u.uid === uid) ?? lines[1].find((u) => u.uid === uid);
  for (const e of o.events.slice(0, n)) {
    if (e.k === 'hit') { const u = find(e.uid); if (u) u.h = e.h; }
    else if (e.k === 'buff') { const u = find(e.uid); if (u) { u.a = e.a; u.h = e.h; } }
    else if (e.k === 'status') { const u = find(e.uid); if (u) u.status = e.status; }
    else if (e.k === 'faint') { const u = find(e.uid); if (u) u.dead = true; }
    else if (e.k === 'summon') {
      const l = lines[e.side]; let living = 0, at = l.length;
      for (let i = 0; i < l.length; i++) { if (living === e.at) { at = i; break; } if (!l[i].dead) living++; }
      l.splice(at, 0, { ...e.unit });
    } else if (e.k === 'line') lines[e.side] = e.uids.map((uid) => lines[e.side].find((u) => u.uid === uid)!).filter(Boolean);
  }
  return lines;
}

/**
 * How critter `u` on `side` (0 faces right, 1 faces left) moves while event `e` plays, `p` of the way through.
 * Only the critter the event is about moves. `calm` (reduced motion) keeps a 3 px lunge and the fade, nothing else.
 */
export function fightPose(e: FightEvent | undefined, u: { uid: number; dead?: boolean }, side: 0 | 1, p: number, calm: boolean): Pose {
  const f = side === 0 ? 1 : -1, mine = !!e && 'uid' in e && e.uid === u.uid;
  if (u.dead) {
    if (!mine || e!.k !== 'faint') return { ...REST, alpha: 0 };
    if (calm) return { ...REST, alpha: 1 - clamp(p) };
    // knocked off the bale: tips backwards, hops up and drops away as it fades
    const q = clamp(p);
    return { dx: -f * 22 * q, dy: -12 * arc(q) + 18 * q * q, sx: 1, sy: 1, rot: -f * 1.3 * smooth(q), alpha: 1 - q };
  }
  if (e?.k === 'summon' && e.unit.uid === u.uid) {
    if (calm) return { ...REST };
    const s = backOut(p * 1.15);
    return { ...REST, sx: s, sy: s };
  }
  if (!mine || !e) return { ...REST };
  const q = clamp(p);
  switch (e.k) {
    case 'attack': {
      if (calm) return { ...REST, dx: f * 3 * arc(q) };
      // lean back a quarter of the time, then a hop and lunge at the rival and back home
      if (q < 0.25) { const w = arc(q / 0.5); return { dx: -f * 5 * w, dy: 0, sx: 1 - 0.06 * w, sy: 1 + 0.08 * w, rot: -f * 0.08 * w, alpha: 1 }; }
      const l = arc((q - 0.25) / 0.75), back = q < 0.25 + 0.375 ? 0 : 1;
      return { dx: f * 16 * l, dy: -6 * l, sx: 1 + 0.08 * l * (1 - back), sy: 1 - 0.06 * l * (1 - back), rot: f * 0.12 * l, alpha: 1 };
    }
    case 'hit': {
      if (calm) return { ...REST };
      const k = arc(Math.min(1, q * 1.6)) * (1 - q), shake = Math.sin(q * 38) * 2 * (1 - q);
      return { dx: -f * 8 * k + shake, dy: 0, sx: 1 + 0.12 * k, sy: 1 - 0.12 * k, rot: -f * 0.1 * k, alpha: 1 };
    }
    case 'ability': case 'buff': {
      if (calm) return { ...REST };
      const h = arc(q);
      return { dx: 0, dy: -(e.k === 'ability' ? 8 : 5) * h, sx: 1 - 0.05 * h, sy: 1 + 0.08 * h, rot: 0, alpha: 1 };
    }
    case 'status': {
      if (calm) return { ...REST };
      const h = arc(q) * (1 - q);
      return { ...REST, sx: 1 + 0.1 * h, sy: 1 - 0.1 * h };
    }
    default: return { ...REST };
  }
}

/** Each critter's slot on its side (fractional while the line slides after a faint or a summon). */
export function linePlaces(o: Outcome, n: number, p: number, calm: boolean) {
  const now = replayLines(o, n), places = new Map<number, number>();
  const before = n > 0 && !calm ? replayLines(o, n - 1) : null, k = smooth(p);
  for (const side of [0, 1] as const) now[side].forEach((u, i) => {
    const was = before ? before[side].findIndex((x) => x.uid === u.uid) : -1;
    places.set(u.uid, was < 0 ? i : was + (i - was) * k);
  });
  return places;
}

/** The winners' one hop, `t` seconds after the last event. */
export const endHop = (t: number, calm: boolean) => (calm || t <= 0 || t >= 0.5 ? 0 : -9 * arc(t / 0.5));

// ── The shop ───────────────────────────────────────────────────────────────

/**
 * Something just happened in the shop, at `at` (ms, the frame clock). `i` is the line slot for land, level and eat,
 * and the shop slot for freeze (a snack slot as −1 − i); `n` is the acorns spent or earned, or 1 for a level-up.
 */
export type ShopFx = { k: 'land' | 'level' | 'eat' | 'sell' | 'roll' | 'freeze' | 'spend' | 'earn'; at: number; i: number; n?: number };
export const FX_LIFE: Record<ShopFx['k'], number> = { land: 0.45, level: 0.9, eat: 0.6, sell: 0.6, roll: 0.6, freeze: 0.5, spend: 0.8, earn: 0.8 };
/** How far through its life an effect is, 0 to 1; outside it the effect is not shown. */
export const fxAge = (fx: ShopFx, now: number) => (now - fx.at) / 1000 / FX_LIFE[fx.k];
export const liveFx = (fx: readonly ShopFx[], now: number) => fx.filter((x) => { const a = fxAge(x, now); return a >= 0 && a < 1; });

/** A line critter's squash when it lands, levels up or eats. */
export function slotPose(fx: readonly ShopFx[], now: number, i: number): Pose {
  for (const x of liveFx(fx, now)) {
    if (x.i !== i || (x.k !== 'land' && x.k !== 'level' && x.k !== 'eat')) continue;
    const q = fxAge(x, now);
    if (x.k === 'land') { const s = arc(q) * (1 - q); return { ...REST, dy: 0, sx: 1 + 0.22 * s, sy: 1 - 0.2 * s }; }
    const h = arc(Math.min(1, q * (x.k === 'level' ? 1.4 : 2)));
    return { ...REST, dy: -(x.k === 'level' ? 10 : 3) * h, sx: 1 - 0.05 * h, sy: 1 + 0.1 * h };
  }
  return { ...REST };
}

/** How big a fresh shop offer in slot `i` is drawn after a roll: grows in left to right. */
export function rollIn(fx: readonly ShopFx[], now: number, i: number) {
  const roll = liveFx(fx, now).find((x) => x.k === 'roll');
  if (!roll) return 1;
  return Math.max(0, Math.min(1.2, backOut(((now - roll.at) / 1000 - i * 0.05) / 0.28)));
}

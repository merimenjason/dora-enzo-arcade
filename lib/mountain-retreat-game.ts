/** Pure, one-second simulation. No browser APIs, randomness or wall clock reads. */
export const SAVE_KEY = 'dora-enzo-mountain-retreat-v1';
export const OFFLINE_CAP = 8 * 60 * 60;
export const ROOMS = [
  { name: 'Hearth & tea', detail: 'Juniper tea, warm paws', cost: 0 },
  { name: 'Cloud kitchen', detail: 'Fresh oat cakes at sunrise', cost: 55 },
  {
    name: 'Starlight suite',
    detail: 'A little closer to the stars',
    cost: 120,
  },
  { name: 'Alpine bath', detail: 'Mountain herbs & soft steam', cost: 220 },
] as const;
export type Duty = 'welcome' | 'comfort';
export type Supply = 'gather' | 'craft';
export type Activity = 'expedition' | 'festival';
export interface RetreatState {
  version: 1;
  savedAt: number;
  coins: number;
  hearts: number;
  supplies: number;
  rooms: number[];
  dora: Duty;
  enzo: Supply;
  elapsed: number;
  served: number;
  activity: { kind: Activity; remaining: number } | null;
  festivals: number;
  expeditions: number;
}
const cap = (n: number) => Math.min(1e9, n);
export function freshRetreat(now = 0): RetreatState {
  return {
    version: 1,
    savedAt: now,
    coins: 25,
    hearts: 0,
    supplies: 18,
    rooms: [1, 0, 0, 0],
    dora: 'welcome',
    enzo: 'gather',
    elapsed: 0,
    served: 0,
    activity: null,
    festivals: 0,
    expeditions: 0,
  };
}
export function roomCost(s: RetreatState, i: number) {
  return s.rooms[i] === 0 ? ROOMS[i].cost : (i + 1) * 35 * s.rooms[i];
}
export function upgradeRoom(s: RetreatState, i: number): boolean {
  if (
    !Number.isInteger(i) ||
    i < 0 ||
    i >= ROOMS.length ||
    s.activity ||
    s.rooms[i] >= 3 ||
    (i > 0 && !s.rooms[i - 1])
  )
    return false;
  const cost = roomCost(s, i);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.rooms[i]++;
  return true;
}
export function startActivity(s: RetreatState, kind: Activity): boolean {
  if (s.activity) return false;
  if (kind === 'expedition') {
    if (s.supplies < 12) return false;
    s.supplies -= 12;
    s.activity = { kind, remaining: 45 };
  } else if (kind === 'festival') {
    if (s.hearts < 12 || s.supplies < 20) return false;
    s.hearts -= 12;
    s.supplies -= 20;
    s.activity = { kind, remaining: 60 };
  } else return false;
  return true;
}
/** Both hosts leave normal work for activities. Rewards arrive exactly once. */
export function advanceRetreat(s: RetreatState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const ticks = Math.min(OFFLINE_CAP, Math.floor(seconds));
  for (let t = 0; t < ticks; t++) {
    if (s.activity) {
      s.activity.remaining--;
      if (s.activity.remaining <= 0) {
        if (s.activity.kind === 'expedition') {
          s.supplies = Math.min(120, s.supplies + 48);
          s.coins = cap(s.coins + 35);
          s.expeditions = cap(s.expeditions + 1);
        } else {
          s.coins = cap(s.coins + 110);
          s.hearts = cap(s.hearts + 24);
          s.festivals = cap(s.festivals + 1);
        }
        s.activity = null;
      }
      continue;
    }
    // Wrap at a multiple of every production period, preserving cadence and save bounds.
    s.elapsed = (s.elapsed + 1) % 999999990;
    if (s.elapsed % (s.enzo === 'gather' ? 3 : 6) === 0)
      s.supplies = Math.min(120, s.supplies + (s.enzo === 'gather' ? 2 : 1));
    if (s.elapsed % (s.dora === 'welcome' ? 6 : 10) === 0) {
      const rooms = s.rooms.filter(Boolean).length;
      if (s.supplies >= rooms) {
        s.supplies -= rooms;
        const quality = s.rooms.reduce((a, b) => a + b, 0);
        s.coins = cap(s.coins + quality * (s.enzo === 'craft' ? 3 : 2));
        s.hearts = cap(s.hearts + rooms * (s.dora === 'comfort' ? 3 : 1));
        s.served = cap(s.served + rooms);
      }
    }
  }
}
const integer = (v: unknown, max = 1e9): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
/** Reject the entire malformed save rather than silently accepting partial corruption. */
export function parseRetreat(raw: string | null): RetreatState | null {
  try {
    if (!raw || raw.length > 10000) return null;
    const s = JSON.parse(raw);
    if (
      !s ||
      s.version !== 1 ||
      !integer(s.savedAt, 8640000000000000) ||
      !integer(s.coins) ||
      !integer(s.hearts) ||
      !integer(s.supplies, 120) ||
      !integer(s.elapsed) ||
      !integer(s.served) ||
      !integer(s.festivals) ||
      !integer(s.expeditions)
    )
      return null;
    if (
      !Array.isArray(s.rooms) ||
      s.rooms.length !== 4 ||
      !s.rooms.every((v: unknown) => integer(v, 3)) ||
      s.rooms[0] < 1 ||
      s.rooms.some((v: number, i: number) => i > 0 && v > 0 && !s.rooms[i - 1])
    )
      return null;
    if (
      !['welcome', 'comfort'].includes(s.dora) ||
      !['gather', 'craft'].includes(s.enzo)
    )
      return null;
    if (
      s.activity !== null &&
      (!s.activity ||
        !['expedition', 'festival'].includes(s.activity.kind) ||
        !integer(
          s.activity.remaining,
          s.activity.kind === 'festival' ? 60 : 45,
        ) ||
        s.activity.remaining < 1)
    )
      return null;
    return {
      version: 1,
      savedAt: s.savedAt,
      coins: s.coins,
      hearts: s.hearts,
      supplies: s.supplies,
      rooms: [...s.rooms],
      dora: s.dora,
      enzo: s.enzo,
      elapsed: s.elapsed,
      served: s.served,
      activity: s.activity
        ? { kind: s.activity.kind, remaining: s.activity.remaining }
        : null,
      festivals: s.festivals,
      expeditions: s.expeditions,
    };
  } catch {
    return null;
  }
}
export function restoreRetreat(raw: string | null, now: number) {
  const parsed = parseRetreat(raw);
  const state = parsed || freshRetreat(now);
  const seconds = parsed
    ? Math.min(
        OFFLINE_CAP,
        Math.max(0, Math.floor((now - state.savedAt) / 1000)),
      )
    : 0;
  const before = state.coins;
  advanceRetreat(state, seconds);
  state.savedAt = now;
  return {
    state,
    seconds,
    earned: state.coins - before,
    invalid: !!raw && !parsed,
  };
}

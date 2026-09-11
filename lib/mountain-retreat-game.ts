/** Pure, one-second simulation. No browser APIs, randomness or wall clock reads. */
export const SAVE_KEY = 'dora-enzo-mountain-retreat-v1';
export const OFFLINE_CAP = 8 * 60 * 60;
export const SUPPLY_CAP = 200;
export const PANTRY_CAP = 9;
export const DECOR_CAP = 6;
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
/** Each room picks one of two specialties once it reaches level 3. */
export const PERKS = [
  [
    { name: 'Storyteller’s chair', detail: 'Granted wishes earn +1 extra reputation' },
    { name: 'Tea stall', detail: '+3 tips on every guest visit' },
  ],
  [
    { name: 'Bakery oven', detail: 'Enzo bakes oat cakes two at a time' },
    { name: 'Larder', detail: '+1 supply on every supply delivery' },
  ],
  [
    { name: 'Telescope', detail: 'Night visits earn +1 heart per room' },
    { name: 'Feather beds', detail: 'Comfort visits earn +1 heart per room' },
  ],
  [
    { name: 'Healing springs', detail: 'Outings finish a quarter sooner' },
    { name: 'Soap works', detail: 'Enzo makes herbal soap two at a time' },
  ],
] as const;
export type Item = 'oatcake' | 'soap';
export const ITEMS = {
  oatcake: { name: 'oat cake', room: 1 },
  soap: { name: 'herbal soap', room: 3 },
} as const;
export interface GuestType {
  id: string;
  name: string;
  /** The room this guest hopes to stay in; they only visit once it is open. */
  room: number;
  item: Item | null;
  /** Lodge rating needed before this guest books. */
  stars: number;
  night?: boolean;
  comfort?: boolean;
}
export const GUESTS: readonly GuestType[] = [
  { id: 'traveler', name: 'Traveler', room: 0, item: null, stars: 1 },
  { id: 'baker', name: 'Pastry fan', room: 1, item: 'oatcake', stars: 1 },
  { id: 'stargazer', name: 'Stargazer', room: 2, item: null, stars: 2, night: true },
  { id: 'hiker', name: 'Hiker', room: 3, item: 'soap', stars: 2 },
  { id: 'painter', name: 'Painter', room: 2, item: 'oatcake', stars: 3 },
  { id: 'duchess', name: 'Duchess', room: 3, item: 'soap', stars: 4, comfort: true },
  // Never books a room: only spotted from the Condor summit.
  { id: 'viscacha', name: 'Mountain viscacha', room: 0, item: null, stars: 99 },
];
export const VISCACHA = GUESTS.length - 1;
export const COATS = ['beige', 'black velvet', 'violet', 'ebony', 'sapphire'] as const;
/** Named regulars return every fifth visit; `coat` is fixed so players recognise them. */
export const REGULARS = [
  { name: 'Pip', guest: 3, coat: 4 },
  { name: 'Mochi', guest: 1, coat: 0 },
  { name: 'Luna', guest: 2, coat: 2 },
] as const;
export const FRIENDSHIP_CAP = 10;
export const POSTCARDS = [
  { at: 3, tips: 20 },
  { at: 6, tips: 40 },
  { at: 10, tips: 80 },
] as const;
export type Trail = 'lake' | 'juniper' | 'summit';
export const TRAILS = {
  lake: { name: 'Glass lake', seconds: 25, cost: 5, supplies: 18, tips: 12, stars: 1 },
  juniper: { name: 'Juniper trail', seconds: 45, cost: 12, supplies: 48, tips: 35, stars: 1 },
  summit: { name: 'Condor summit', seconds: 90, cost: 30, supplies: 60, tips: 90, stars: 2 },
} as const;
export const FESTIVAL = { seconds: 60, hearts: 12, supplies: 20, tips: 110, reward: 24 } as const;
export const DAY_SECONDS = 120;
export const NIGHT_FROM = 80;
export const SEASON_SECONDS = 360;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const season = (elapsed: number): Season =>
  SEASONS[Math.floor(elapsed / SEASON_SECONDS) % 4];
export const isNight = (elapsed: number) => elapsed % DAY_SECONDS >= NIGHT_FROM;
export type Duty = 'welcome' | 'comfort';
export type Supply = 'gather' | 'craft';
export type Activity = 'expedition' | 'festival';
export type Outcome = 'happy' | 'plain' | 'away';
export interface GuestVisit {
  guest: number;
  coat: number;
  /** Index into REGULARS, or -1 for a passing guest. */
  regular: number;
}
export interface VisitLog extends GuestVisit {
  outcome: Outcome;
  tips: number;
  hearts: number;
  /** Index into POSTCARDS earned on this visit, or -1. */
  postcard: number;
}
export interface RetreatState {
  version: 2;
  savedAt: number;
  coins: number;
  hearts: number;
  supplies: number;
  rooms: number[];
  /** Chosen specialty per room: -1 until picked at level 3. */
  perks: number[];
  dora: Duty;
  enzo: Supply;
  elapsed: number;
  served: number;
  visits: number;
  reputation: number;
  pantry: Record<Item, number>;
  /** One coat bitmask per guest type. */
  album: number[];
  friends: number[];
  decor: number;
  activity: { kind: Activity; remaining: number; trail: Trail | null } | null;
  festivals: number;
  expeditions: number;
  last: VisitLog | null;
}
const cap = (n: number) => Math.min(1e9, n);
export function freshRetreat(now = 0): RetreatState {
  return {
    version: 2,
    savedAt: now,
    coins: 25,
    hearts: 0,
    supplies: 18,
    rooms: [1, 0, 0, 0],
    perks: [-1, -1, -1, -1],
    dora: 'welcome',
    enzo: 'gather',
    elapsed: 0,
    served: 0,
    visits: 0,
    reputation: 0,
    pantry: { oatcake: 0, soap: 0 },
    album: GUESTS.map(() => 0),
    friends: REGULARS.map(() => 0),
    decor: 0,
    activity: null,
    festivals: 0,
    expeditions: 0,
    last: null,
  };
}
/** 1–5 stars, one per 20 reputation. */
export const rating = (s: RetreatState) =>
  Math.min(5, 1 + Math.floor(s.reputation / 20));
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
export function choosePerk(s: RetreatState, i: number, perk: number): boolean {
  if (
    !Number.isInteger(i) ||
    i < 0 ||
    i >= ROOMS.length ||
    (perk !== 0 && perk !== 1) ||
    s.activity ||
    s.rooms[i] < 3 ||
    s.perks[i] !== -1
  )
    return false;
  s.perks[i] = perk;
  return true;
}
export const activitySeconds = (s: RetreatState, kind: Activity, trail: Trail = 'juniper') => {
  const base = kind === 'festival' ? FESTIVAL.seconds : TRAILS[trail].seconds;
  return s.perks[3] === 0 ? base - Math.floor(base / 4) : base;
};
/** Why a trail is closed right now, or null when it can be walked. */
export function trailClosed(s: RetreatState, trail: Trail): string | null {
  if (rating(s) < TRAILS[trail].stars) return `Needs a ${TRAILS[trail].stars}-star lodge`;
  if (trail === 'summit' && season(s.elapsed) === 'winter') return 'Snowed in until spring';
  return null;
}
export function startActivity(
  s: RetreatState,
  kind: Activity,
  trail: Trail = 'juniper',
): boolean {
  if (s.activity) return false;
  if (kind === 'expedition') {
    if (!(trail in TRAILS) || trailClosed(s, trail)) return false;
    if (s.supplies < TRAILS[trail].cost) return false;
    s.supplies -= TRAILS[trail].cost;
    s.activity = { kind, remaining: activitySeconds(s, kind, trail), trail };
  } else if (kind === 'festival') {
    if (s.hearts < FESTIVAL.hearts || s.supplies < FESTIVAL.supplies) return false;
    s.hearts -= FESTIVAL.hearts;
    s.supplies -= FESTIVAL.supplies;
    s.activity = { kind, remaining: activitySeconds(s, kind), trail: null };
  } else return false;
  return true;
}
/** Festival rewards; summer crowds are half as big again. */
export const festivalReward = (s: RetreatState) =>
  season(s.elapsed) === 'summer'
    ? { tips: FESTIVAL.tips * 1.5, hearts: FESTIVAL.reward * 1.5 }
    : { tips: FESTIVAL.tips, hearts: FESTIVAL.reward };
export type Host = 'dora' | 'enzo';
export const HOST_STOP_SECONDS = { dora: 8, enzo: 12 } as const;
export const WALK_SECONDS = 2;
const TOURS = { dora: [0, 2, 3, 1], enzo: [1, 3, 0, 2] } as const;
export const visitPeriod = (s: RetreatState) =>
  s.dora === 'welcome' ? 6 : 10;
export const SUPPLY_SECONDS = 2;
export const RECIPE_SECONDS = 6;
export const RECIPE_COST = 2;
/** A labelled share of a reward, so the UI can explain every number. */
export interface Part {
  label: string;
  value: number;
}
export const total = (parts: Part[]) => parts.reduce((a, p) => a + p.value, 0);
const shown = (parts: Part[]) => parts.filter((p) => p.value > 0);
/** Where each supply delivery (every SUPPLY_SECONDS) comes from. */
export const supplyParts = (s: RetreatState, elapsed = s.elapsed): Part[] =>
  shown([
    s.enzo === 'gather'
      ? { label: 'Enzo gathering', value: 3 }
      : { label: 'Enzo crafting', value: 1 },
    { label: 'Spring blossoms', value: season(elapsed) === 'spring' ? 1 : 0 },
    { label: 'Larder', value: s.perks[1] === 1 ? 1 : 0 },
  ]);
export const supplyRate = (s: RetreatState) => total(supplyParts(s));
/** Tips and hearts a visit at `elapsed` pays before the featured guest's wish. */
export function visitRewards(s: RetreatState, elapsed = s.elapsed) {
  const rooms = s.rooms.filter(Boolean).length;
  const quality = s.rooms.reduce((a, b) => a + b, 0);
  const craft = s.enzo === 'craft';
  const comfort = s.dora === 'comfort';
  const when = season(elapsed);
  return {
    tips: shown([
      { label: `Room levels (${quality} × ${craft ? 3 : 2}${craft ? ', crafted' : ''})`, value: quality * (craft ? 3 : 2) },
      { label: `${rating(s)}-star rating (${rooms} rooms × ${rating(s) - 1})`, value: rooms * (rating(s) - 1) },
      { label: 'Decorations', value: s.decor },
      { label: 'Tea stall', value: s.perks[0] === 1 ? 3 : 0 },
      { label: 'Autumn harvest', value: when === 'autumn' ? rooms : 0 },
    ]),
    hearts: shown([
      { label: `${comfort ? 'Extra comfort' : 'Welcome'} (${rooms} rooms × ${comfort ? 3 : 1})`, value: rooms * (comfort ? 3 : 1) },
      { label: 'Feather beds', value: comfort && s.perks[2] === 1 ? rooms : 0 },
      { label: 'Telescope at night', value: isNight(elapsed) && s.perks[2] === 0 ? rooms : 0 },
      { label: 'Winter coziness', value: when === 'winter' ? rooms : 0 },
    ]),
  };
}
export const WISH_TIPS = 4;
export const ITEM_TIPS = 10;
export const WISH_HEARTS = 2;
const bits = (mask: number) => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
};
/** What changed between two saves of the same lodge, for the welcome-back summary. */
export function awaySummary(before: RetreatState, after: RetreatState) {
  return {
    visits: after.visits - before.visits,
    tips: after.coins - before.coins,
    hearts: after.hearts - before.hearts,
    reputation: after.reputation - before.reputation,
    supplies: after.supplies - before.supplies,
    oatcakes: after.pantry.oatcake - before.pantry.oatcake,
    soap: after.pantry.soap - before.pantry.soap,
    postcards: after.friends.reduce(
      (n, f, i) => n + POSTCARDS.filter((p) => p.at <= f && p.at > before.friends[i]).length,
      0,
    ),
    coats: after.album.reduce((n, mask, i) => n + bits(mask & ~before.album[i]), 0),
    outings:
      after.expeditions + after.festivals - before.expeditions - before.festivals,
  };
}
/** Which item Enzo's next recipe makes: alternates between the open workshops. */
export function recipeAt(s: RetreatState, elapsed: number): Item | null {
  const kinds = (['oatcake', 'soap'] as const).filter((k) => s.rooms[ITEMS[k].room] > 0);
  return kinds.length ? kinds[Math.floor(elapsed / RECIPE_SECONDS) % kinds.length] : null;
}
/** Where a host stands. Driven by `elapsed`, so hosts freeze when outings pause production. */
export function hostStop(s: RetreatState, host: Host) {
  const tour = TOURS[host].filter((i) => s.rooms[i] > 0);
  const period = HOST_STOP_SECONDS[host];
  const k = Math.floor(s.elapsed / period);
  const room = tour[k % tour.length];
  const from = tour[(k + tour.length - 1) % tour.length];
  return {
    room,
    from,
    walking: room !== from && s.elapsed % period < WALK_SECONDS,
  };
}
const mix = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
};
/** Guest types that could book right now: their room is open, the rating is high enough, and night guests only come at night. */
export function guestPool(s: RetreatState, elapsed = s.elapsed) {
  return GUESTS.flatMap((g, i) =>
    i !== VISCACHA &&
    s.rooms[g.room] > 0 &&
    g.stars <= rating(s) &&
    (!g.night || isNight(elapsed))
      ? [i]
      : [],
  );
}
/** The featured guest of visit number `v`. Deterministic, so the UI can show who is coming next. */
export function guestFor(s: RetreatState, v: number, elapsed: number): GuestVisit {
  const regulars = REGULARS.flatMap((r, i) => (s.rooms[GUESTS[r.guest].room] > 0 ? [i] : []));
  if (v % 5 === 4 && regulars.length) {
    const r = regulars[Math.floor(v / 5) % regulars.length];
    return { guest: REGULARS[r].guest, coat: REGULARS[r].coat, regular: r };
  }
  const pool = guestPool(s, elapsed);
  const h = mix(v);
  return { guest: pool[h % pool.length], coat: (h >>> 8) % COATS.length, regular: -1 };
}
export const nextVisitAt = (s: RetreatState) =>
  s.elapsed + visitPeriod(s) - (s.elapsed % visitPeriod(s));
export const upcomingGuest = (s: RetreatState) =>
  guestFor(s, s.visits, nextVisitAt(s));
/** Whether a guest's wish can be granted from the current lodge. */
export function canGrant(s: RetreatState, guest: number) {
  const g = GUESTS[guest];
  return (!g.comfort || s.dora === 'comfort') && (!g.item || s.pantry[g.item] > 0);
}
function visit(s: RetreatState) {
  const rooms = s.rooms.filter(Boolean).length;
  const who = guestFor(s, s.visits, s.elapsed);
  s.visits = cap(s.visits + 1);
  s.album[who.guest] |= 1 << who.coat;
  if (s.supplies < rooms) {
    s.reputation = Math.max(0, s.reputation - 3);
    s.last = { ...who, outcome: 'away', tips: 0, hearts: 0, postcard: -1 };
    return;
  }
  s.supplies -= rooms;
  const rewards = visitRewards(s);
  let tips = total(rewards.tips);
  let hearts = total(rewards.hearts);
  let postcard = -1;
  const happy = canGrant(s, who.guest);
  if (happy) {
    const item = GUESTS[who.guest].item;
    if (item) {
      s.pantry[item]--;
      tips += ITEM_TIPS;
    }
    tips += WISH_TIPS;
    hearts += WISH_HEARTS;
    s.reputation = Math.min(100, s.reputation + 1 + (s.perks[0] === 0 ? 1 : 0));
    if (who.regular >= 0 && s.friends[who.regular] < FRIENDSHIP_CAP) {
      const f = ++s.friends[who.regular];
      postcard = POSTCARDS.findIndex((p) => p.at === f);
      if (postcard >= 0) tips += POSTCARDS[postcard].tips;
    }
  } else s.reputation = Math.max(0, s.reputation - 1);
  s.coins = cap(s.coins + tips);
  s.hearts = cap(s.hearts + hearts);
  s.served = cap(s.served + rooms);
  s.last = { ...who, outcome: happy ? 'happy' : 'plain', tips, hearts, postcard };
}
function finishActivity(s: RetreatState) {
  const a = s.activity!;
  if (a.kind === 'expedition') {
    const trail = TRAILS[a.trail ?? 'juniper'];
    s.supplies = Math.min(SUPPLY_CAP, s.supplies + trail.supplies);
    s.coins = cap(s.coins + trail.tips);
    s.expeditions = cap(s.expeditions + 1);
    if (a.trail === 'lake')
      for (const k of ['oatcake', 'soap'] as const)
        s.pantry[k] = Math.min(PANTRY_CAP, s.pantry[k] + 1);
    if (a.trail === 'summit') {
      s.decor = Math.min(DECOR_CAP, s.decor + 1);
      s.album[VISCACHA] |= 1 << (s.expeditions % COATS.length);
      s.hearts = cap(s.hearts + 10);
    }
  } else {
    const reward = festivalReward(s);
    s.coins = cap(s.coins + reward.tips);
    s.hearts = cap(s.hearts + reward.hearts);
    s.reputation = Math.min(100, s.reputation + 5);
    s.festivals = cap(s.festivals + 1);
  }
  s.activity = null;
}
/** Both hosts leave normal work for activities. Rewards arrive exactly once. */
export function advanceRetreat(s: RetreatState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const ticks = Math.min(OFFLINE_CAP, Math.floor(seconds));
  for (let t = 0; t < ticks; t++) {
    if (s.activity) {
      s.activity.remaining--;
      if (s.activity.remaining <= 0) finishActivity(s);
      continue;
    }
    // Wrap at a multiple of every period (supplies, recipes, visits, host tours, days, seasons).
    s.elapsed = (s.elapsed + 1) % 999999360;
    if (s.elapsed % SUPPLY_SECONDS === 0)
      s.supplies = Math.min(SUPPLY_CAP, s.supplies + supplyRate(s));
    if (s.enzo === 'craft' && s.elapsed % RECIPE_SECONDS === 0) {
      const item = recipeAt(s, s.elapsed);
      if (item && s.pantry[item] < PANTRY_CAP && s.supplies >= RECIPE_COST) {
        s.supplies -= RECIPE_COST;
        const batch = (item === 'oatcake' ? s.perks[1] : s.perks[3]) === 0 ? 2 : 1;
        s.pantry[item] = Math.min(PANTRY_CAP, s.pantry[item] + batch);
      }
    }
    if (s.elapsed % visitPeriod(s) === 0) visit(s);
  }
}
const integer = (v: unknown, max = 1e9): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const list = (v: unknown, length: number, max: number) =>
  Array.isArray(v) && v.length === length && v.every((n) => integer(n, max));
function validLog(l: unknown): l is VisitLog {
  if (l === null) return true;
  if (!l || typeof l !== 'object') return false;
  const v = l as Record<string, unknown>;
  return (
    integer(v.guest, GUESTS.length - 1) &&
    integer(v.coat, COATS.length - 1) &&
    typeof v.regular === 'number' &&
    Number.isInteger(v.regular) &&
    v.regular >= -1 &&
    v.regular < REGULARS.length &&
    ['happy', 'plain', 'away'].includes(v.outcome as string) &&
    integer(v.tips) &&
    integer(v.hearts) &&
    typeof v.postcard === 'number' &&
    Number.isInteger(v.postcard) &&
    v.postcard >= -1 &&
    v.postcard < POSTCARDS.length
  );
}
/** Reject the entire malformed save rather than silently accepting partial corruption. Version-1 journals are upgraded. */
export function parseRetreat(raw: string | null): RetreatState | null {
  try {
    if (!raw || raw.length > 10000) return null;
    const s = JSON.parse(raw);
    if (
      !s ||
      (s.version !== 1 && s.version !== 2) ||
      !integer(s.savedAt, 8640000000000000) ||
      !integer(s.coins) ||
      !integer(s.hearts) ||
      !integer(s.supplies, s.version === 1 ? 120 : SUPPLY_CAP) ||
      !integer(s.elapsed) ||
      !integer(s.served) ||
      !integer(s.festivals) ||
      !integer(s.expeditions)
    )
      return null;
    if (
      !list(s.rooms, 4, 3) ||
      s.rooms[0] < 1 ||
      s.rooms.some((v: number, i: number) => i > 0 && v > 0 && !s.rooms[i - 1])
    )
      return null;
    if (
      !['welcome', 'comfort'].includes(s.dora) ||
      !['gather', 'craft'].includes(s.enzo)
    )
      return null;
    const v1 = s.version === 1;
    const extra = v1
      ? {
          ...freshRetreat(),
          activity: s.activity && { ...s.activity, trail: s.activity.kind === 'expedition' ? 'juniper' : null },
        }
      : s;
    if (
      !v1 &&
      (!integer(s.visits) ||
        !integer(s.reputation, 100) ||
        !Array.isArray(s.perks) ||
        s.perks.length !== 4 ||
        !s.perks.every((p: unknown, i: number) => p === -1 || ((p === 0 || p === 1) && s.rooms[i] === 3)) ||
        !s.pantry ||
        !integer(s.pantry.oatcake, PANTRY_CAP) ||
        !integer(s.pantry.soap, PANTRY_CAP) ||
        !list(s.album, GUESTS.length, (1 << COATS.length) - 1) ||
        !list(s.friends, REGULARS.length, FRIENDSHIP_CAP) ||
        !integer(s.decor, DECOR_CAP) ||
        !validLog(s.last))
    )
      return null;
    const a = extra.activity;
    if (
      a !== null &&
      (!a ||
        !['expedition', 'festival'].includes(a.kind) ||
        (a.kind === 'festival' ? a.trail !== null : !(a.trail in TRAILS)) ||
        !integer(a.remaining, a.kind === 'festival' ? FESTIVAL.seconds : TRAILS[a.trail as Trail].seconds) ||
        a.remaining < 1)
    )
      return null;
    return {
      version: 2,
      savedAt: s.savedAt,
      coins: s.coins,
      hearts: s.hearts,
      supplies: s.supplies,
      rooms: [...s.rooms],
      perks: [...extra.perks],
      dora: s.dora,
      enzo: s.enzo,
      elapsed: s.elapsed,
      served: s.served,
      visits: extra.visits,
      reputation: extra.reputation,
      pantry: { oatcake: extra.pantry.oatcake, soap: extra.pantry.soap },
      album: [...extra.album],
      friends: [...extra.friends],
      decor: extra.decor,
      activity: a ? { kind: a.kind, remaining: a.remaining, trail: a.trail } : null,
      festivals: s.festivals,
      expeditions: s.expeditions,
      last: extra.last ? { ...extra.last } : null,
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

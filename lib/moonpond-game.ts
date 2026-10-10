// Moonpond: a night-fishing journal. Dora and Enzo sit on the dock with a lantern, coax the pond's creatures up to
// the surface, sketch them and let them go. A night is a handful of casts; each cast is a throw, a bite and a reel.
// What comes to the lure depends on where it lands, the time of night, the weather, the lure and the moon, so the
// journal is filled by reading its clues. Deterministic: every bite comes from the seed, the night and the cast.

export const STEP = 1 / 60;
export const SAVE_VERSION = 1;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (...n: number[]) => n.reduce((h, v) => (Math.imul(h ^ (v >>> 0), 0x9e3779b1) + 0x7f4a7c15) >>> 0, 0x2545f491);

// ---------- The pond ----------

export type Zone = 'reeds' | 'lily' | 'open' | 'deep' | 'moon';
export type Time = 'dusk' | 'moonrise' | 'midnight' | 'firstlight';
export type Weather = 'clear' | 'mist' | 'rain' | 'fireflies';
export type Lure = 'glow' | 'clover' | 'dust';
export type Angler = 'dora' | 'enzo';
export type Style = 'steady' | 'darter' | 'diver' | 'jumper' | 'heavy';
export type Kind = 'creature' | 'curio' | 'legend';

export const ZONES: Zone[] = ['reeds', 'lily', 'open', 'deep', 'moon'];
export const TIMES: Time[] = ['dusk', 'moonrise', 'midnight', 'firstlight'];
export const WEATHERS: Weather[] = ['clear', 'mist', 'rain', 'fireflies'];
export const LURES: Lure[] = ['glow', 'clover', 'dust'];
export const ZONE_NAMES: Record<Zone, string> = { reeds: 'the reeds', lily: 'the lily pads', open: 'open water', deep: 'the deep channel', moon: "the moon's reflection" };
export const TIME_NAMES: Record<Time, string> = { dusk: 'dusk', moonrise: 'moonrise', midnight: 'midnight', firstlight: 'first light' };
export const WEATHER_NAMES: Record<Weather, string> = { clear: 'a clear night', mist: 'mist', rain: 'rain', fireflies: 'a firefly night' };
export const LURE_NAMES: Record<Lure, string> = { glow: 'Glow bead', clover: 'Clover knot', dust: 'Dust puff' };
export const PHASE_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
export const FULL_MOON = 4;

/** How far along the cast (0 at the dock, 1 at the far bank) each band of water starts. */
export const BANDS: [Zone, number][] = [['reeds', 0], ['lily', 0.2], ['open', 0.42], ['deep', 0.66]];
/** Furthest a full cast lands, by rod level. Level 2 also lets the lure settle on the moon's reflection. */
export const REACH = [0.56, 0.88, 0.88];
export const DORA_CAST = 1.15, ENZO_WINDOW = 1.15;
export const CHARGE_RATE = 0.85, MIN_CHARGE = 0.08, AIM_RATE = 1.2, FLIGHT = 0.7;
/** Seconds after the splash before a press counts, and after a catch or a loss before it can be dismissed. */
export const SETTLE = 0.4, LINGER = 0.7;
export const BITE_WINDOW = 0.6, NIBBLE = 0.35, MOON_RADIUS = 0.12;
export const BASE_CASTS = 8;

export const zoneAt = (d: number): Zone => { let z: Zone = 'reeds'; for (const [zone, from] of BANDS) if (d >= from) z = zone; return z; };

// ---------- The journal ----------

export type Species = {
  id: string; name: string; kind: Kind; zone: Zone; style: Style;
  /** 1 common, 2 uncommon, 3 rare, 4 legendary. A common's conditions are preferences; everyone else's are required. */
  rarity: 1 | 2 | 3 | 4;
  time?: Time[]; weather?: Weather[]; lure?: Lure[]; phase?: number[];
  /** Smallest and largest, in centimetres. Curiosities have no size. */
  size?: [number, number];
  /** How hard it pulls, 0 to 1. */
  strength: number; clue: string;
};

const s = (id: string, name: string, zone: Zone, rarity: 1 | 2 | 3, style: Style, strength: number, size: [number, number], clue: string, when: Partial<Pick<Species, 'time' | 'weather' | 'lure'>> = {}): Species =>
  ({ id, name, kind: 'creature', zone, rarity, style, strength, size, clue, ...when });
const curio = (id: string, name: string, zone: Zone, clue: string): Species => ({ id, name, kind: 'curio', zone, rarity: 2, style: 'steady', strength: 0.15, clue });

export const SPECIES: Species[] = [
  s('reed-skipper', 'Reed Skipper', 'reeds', 1, 'steady', 0.2, [4, 9], 'Always somewhere in the reeds.'),
  s('mud-puppy', 'Mud Puppy', 'reeds', 1, 'steady', 0.3, [6, 14], 'Noses about the reeds, fondest of clover.', { lure: ['clover'] }),
  s('dusk-newt', 'Dusk Newt', 'reeds', 1, 'darter', 0.3, [5, 11], 'Darts through the reeds before the moon is high.', { time: ['dusk', 'moonrise'] }),
  s('rain-peeper', 'Rain Peeper', 'reeds', 2, 'jumper', 0.35, [3, 7], 'Sings in the reeds, but only when it rains.', { weather: ['rain'] }),
  s('cattail-crab', 'Cattail Crab', 'reeds', 2, 'heavy', 0.5, [7, 15], 'Clings to the reeds and cannot resist a dust puff.', { lure: ['dust'] }),
  s('glass-shrimp', 'Glass Shrimp', 'reeds', 3, 'darter', 0.45, [2, 5], 'Seen in the reeds at first light, when the mist is down.', { time: ['firstlight'], weather: ['mist'] }),
  s('lantern-snail', 'Lantern Snail', 'reeds', 3, 'steady', 0.4, [3, 8], 'Climbs the reeds on firefly nights, towards anything that glows.', { weather: ['fireflies'], lure: ['glow'] }),

  s('lily-hopper', 'Lily Hopper', 'lily', 1, 'jumper', 0.3, [5, 12], 'Sits on the lily pads all night long.'),
  s('pad-minnow', 'Pad Minnow', 'lily', 1, 'steady', 0.2, [3, 8], 'Shoals under the lily pads and follows a glow.', { lure: ['glow'] }),
  s('whisker-loach', 'Whisker Loach', 'lily', 1, 'diver', 0.35, [8, 18], 'Roots under the lily pads, busiest at midnight.', { time: ['midnight'] }),
  s('clover-carp', 'Clover Carp', 'lily', 2, 'heavy', 0.55, [20, 46], 'A slow shape under the lily pads that only rises for clover.', { lure: ['clover'] }),
  s('mist-darter', 'Mist Darter', 'lily', 2, 'darter', 0.5, [6, 13], 'Flickers between the lily pads when the mist is down.', { weather: ['mist'] }),
  s('firefly-guppy', 'Firefly Guppy', 'lily', 3, 'darter', 0.5, [2, 6], 'Glows among the lily pads at moonrise on firefly nights.', { weather: ['fireflies'], time: ['moonrise'] }),
  s('sleepy-terrapin', 'Sleepy Terrapin', 'lily', 3, 'heavy', 0.7, [14, 30], 'Wakes among the lily pads at first light, for clover and nothing else.', { time: ['firstlight'], lure: ['clover'] }),

  s('ripple-perch', 'Ripple Perch', 'open', 1, 'steady', 0.35, [10, 24], 'Out in open water at any hour.'),
  s('silverside', 'Silverside', 'open', 1, 'darter', 0.35, [6, 14], 'Flashes across open water as the moon comes up.', { time: ['moonrise'] }),
  s('pond-bream', 'Pond Bream', 'open', 1, 'diver', 0.45, [14, 32], 'Grazes in open water and likes a clover knot.', { lure: ['clover'] }),
  s('dust-skater', 'Dust Skater', 'open', 2, 'jumper', 0.4, [2, 5], 'Skates on open water, chasing dust puffs.', { lure: ['dust'] }),
  s('storm-pike', 'Storm Pike', 'open', 2, 'darter', 0.65, [30, 70], 'Hunts in open water when rain breaks the surface.', { weather: ['rain'] }),
  s('star-sturgeon', 'Star Sturgeon', 'open', 3, 'heavy', 0.8, [50, 110], 'Crosses open water at midnight, only under a clear sky.', { time: ['midnight'], weather: ['clear'] }),
  s('fog-ray', 'Fog Ray', 'open', 3, 'diver', 0.7, [25, 55], 'Glides under open water in the mist, after dust.', { weather: ['mist'], lure: ['dust'] }),

  s('channel-chub', 'Channel Chub', 'deep', 1, 'steady', 0.45, [12, 28], 'Lives in the deep channel and is never far away.'),
  s('deepwater-eel', 'Deepwater Eel', 'deep', 1, 'diver', 0.5, [30, 75], 'Coils in the deep channel, liveliest at midnight.', { time: ['midnight'] }),
  s('pebble-goby', 'Pebble Goby', 'deep', 1, 'darter', 0.4, [4, 10], 'Hides on the bed of the deep channel and stirs for dust.', { lure: ['dust'] }),
  s('night-catfish', 'Night Catfish', 'deep', 2, 'heavy', 0.75, [35, 90], 'Leaves its hole in the deep channel at midnight.', { time: ['midnight'] }),
  s('glow-tetra', 'Glow Tetra', 'deep', 2, 'darter', 0.5, [3, 7], 'A spark in the deep channel that answers a glow bead.', { lure: ['glow'] }),
  s('thunder-gar', 'Thunder Gar', 'deep', 3, 'jumper', 0.8, [45, 100], 'Leaps from the deep channel at dusk in the rain.', { weather: ['rain'], time: ['dusk'] }),
  s('velvet-crayfish', 'Velvet Crayfish', 'deep', 3, 'heavy', 0.7, [10, 22], 'Walks the deep channel at first light, looking for clover.', { lure: ['clover'], time: ['firstlight'] }),

  s('moth-fish', 'Moth Fish', 'moon', 2, 'jumper', 0.55, [8, 18], "Leaps at the moon's reflection on a clear night."),
  s('pearl-mussel', 'Pearl Mussel', 'moon', 3, 'heavy', 0.6, [9, 16], "Opens under the moon's reflection for a dust puff.", { lure: ['dust'] }),

  curio('lost-button', 'Lost Button', 'reeds', 'Something small is caught in the reeds.'),
  curio('tiny-teacup', 'Tiny Teacup', 'lily', 'Something was left on the lily pads after a picnic.'),
  curio('bottle-note', 'Message in a Bottle', 'open', 'Something bobs about in open water.'),
  curio('glass-marble', 'Glass Marble', 'open', 'Something round rolled out into open water.'),
  curio('brass-key', 'Brass Key', 'deep', 'Something heavy sank in the deep channel.'),
  curio('sunken-bell', 'Sunken Bell', 'deep', 'Something in the deep channel rings when the pond is still.'),

  { id: 'ink-eel', name: 'Ink Eel', kind: 'legend', zone: 'deep', rarity: 4, style: 'diver', strength: 0.95, size: [90, 160], time: ['midnight'], lure: ['dust'], phase: [0], clue: 'Legend: at midnight under a new moon, something long stirs the dust of the deep channel.' },
  { id: 'crescent-carp', name: 'Crescent Carp', kind: 'legend', zone: 'open', rarity: 4, style: 'heavy', strength: 0.95, size: [60, 120], time: ['moonrise'], lure: ['glow'], phase: [1, 7], clue: 'Legend: when a crescent moon rises, a curved gleam follows a glow across open water.' },
  { id: 'old-mossback', name: 'Old Mossback', kind: 'legend', zone: 'reeds', rarity: 4, style: 'heavy', strength: 1, size: [40, 70], time: ['firstlight'], lure: ['clover'], phase: [2, 6], clue: 'Legend: at first light under a half moon, the oldest shell in the reeds comes up for clover.' },
  { id: 'moon-koi', name: 'Moon Koi', kind: 'legend', zone: 'moon', rarity: 4, style: 'jumper', strength: 1, size: [70, 130], time: ['midnight'], lure: ['glow'], phase: [FULL_MOON], clue: "Legend: once the other three are sketched, the full moon's reflection holds a glow at midnight." },
];
export const byId = new Map(SPECIES.map((x) => [x.id, x]));

export type Conditions = { zone: Zone; time: Time; weather: Weather; lure: Lure; phase: number };
const WEIGHT = [0, 10, 6, 4, 5], SOFT_MISS = 0.3, NEW_BONUS = 1.3, CURIO = 2, CURIO_KNOWN = 0.5;
/** How likely a creature is to take the lure. Zero when it would not come at all. */
export function weight(sp: Species, c: Conditions, known: (id: string) => boolean): number {
  if (sp.zone !== c.zone) return 0;
  if (sp.kind === 'curio') return known(sp.id) ? CURIO_KNOWN : CURIO;
  if (sp.id === 'moon-koi' && !SPECIES.every((x) => x.kind !== 'legend' || x.id === 'moon-koi' || known(x.id))) return 0;
  const fits = [!sp.time || sp.time.includes(c.time), !sp.weather || sp.weather.includes(c.weather), !sp.lure || sp.lure.includes(c.lure), !sp.phase || sp.phase.includes(c.phase)];
  let w = WEIGHT[sp.rarity];
  for (const fit of fits) if (!fit) { if (sp.rarity > 1) return 0; w *= SOFT_MISS; }
  return known(sp.id) ? w : w * NEW_BONUS;
}

// ---------- Shells and the shop ----------

export const SHELLS = [0, 2, 5, 12, 40], CURIO_SHELLS = 8, STAR_BONUS = 0.25;
export type UpgradeId = 'rod' | 'line' | 'oil' | 'bobber' | 'spyglass';
export const UPGRADES: Record<UpgradeId, { name: string; costs: number[]; blurb: string[] }> = {
  rod: { name: 'Rod', costs: [60, 220], blurb: ['Willow rod: casts reach the deep channel.', "Silver-tipped rod: the lure can settle on the moon's reflection."] },
  line: { name: 'Line', costs: [40, 110, 240], blurb: ['Waxed line: takes more strain.', 'Braided line: takes more strain still.', 'Spider-silk line: the strongest there is.'] },
  oil: { name: 'Lantern oil', costs: [50, 100, 170, 260], blurb: ['Nine casts a night.', 'Ten casts a night.', 'Eleven casts a night.', 'Twelve casts a night.'] },
  bobber: { name: 'Bobber', costs: [45, 130], blurb: ['Cork bobber: a longer moment to hook a bite.', 'Bell bobber: longer still.'] },
  spyglass: { name: "Enzo's spyglass", costs: [80], blurb: ['Shadows under the bobber show how rare they are.'] },
};
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
export const LURE_COST: Record<Lure, number> = { glow: 0, clover: 40, dust: 90 };
export const BOBBER_WINDOW = 0.1, LINE_BAND = 0.04, LINE_STRAIN = 0.25;

// ---------- Requests ----------

export type Request =
  | { type: 'spot'; zone: Zone; time: Time; reward: number }
  | { type: 'weather'; weather: Weather; reward: number }
  | { type: 'species'; id: string; reward: number }
  | { type: 'big'; reward: number };
export const requestText = (r: Request): string =>
  r.type === 'spot' ? `Show me something from ${ZONE_NAMES[r.zone]} at ${TIME_NAMES[r.time]}.`
    : r.type === 'weather' ? `Sketch anything on ${r.weather === 'rain' || r.weather === 'mist' ? 'a night of ' : ''}${WEATHER_NAMES[r.weather]}.`
      : r.type === 'species' ? `I'd love to see a ${byId.get(r.id)!.name}.`
        : 'Bring me a three-star catch.';

// ---------- The reel ----------

/** A surge lasts this long; a creature of strength 1 surges in SURGE_BASE + SURGE_STRENGTH of those beats. */
export const SURGE = 0.45, SURGE_BASE = 0.04, SURGE_STRENGTH = 0.22, SURGE_PULL = 0.55;
export const BAND_LOW = 0.34, BAND_HIGH = 0.68, SNAP_AFTER = 0.7, SLIP_AFTER = 1.6, JUMP = 0.6, TELL = 0.35;
/** How quickly the line tightens or loosens towards what the reel and the creature ask of it. */
export const LINE_RESPONSE = 4;
/** How fast strain and slack are forgiven, per second, once the line is back in the band. */
/** Strain builds at full speed once the line is this far over the band, and more slowly when it is barely over. */
export const OVER = 0.1;
export const STRAIN_EASE = 0.35, SLACK_EASE = 0.5;
/** How hard a creature of this style pulls (0 to 1) a given time into the fight, and whether it is leaping. */
export function pullAt(style: Style, tau: number, o1: number, o2: number, strength = 0): { pull: number; jump: boolean; tell: boolean } {
  let pull = 0.35, jump = false, tell = false;
  if (style === 'steady') pull = 0.35 + 0.08 * Math.sin(tau * 2 + o1 * 6);
  else if (style === 'darter') { const period = 1.5 + o1 * 0.4; pull = (tau + o2 * period) % period < 0.5 ? 0.95 : 0.15; }
  else if (style === 'diver') pull = 0.5 + 0.45 * Math.sin(tau * 1.3 + o1 * 6);
  else if (style === 'heavy') pull = 0.6 + 0.1 * Math.sin(tau * 0.9 + o1 * 6);
  else { const period = 2.8 + o1 * 0.8, at = tau % period; pull = 0.3; jump = at >= period - JUMP; tell = !jump && at >= period - JUMP - TELL; }
  // Sudden surges nobody can learn by heart: stronger creatures make more of them.
  const beat = Math.floor(tau / SURGE);
  if (beat > 1 && !jump && !tell && rng(mix(Math.floor(o2 * 1e9), beat))() < SURGE_BASE + SURGE_STRENGTH * strength) pull += SURGE_PULL * (0.3 + 0.7 * strength);
  return { pull: Math.min(1.2, pull), jump, tell };
}

// ---------- The game ----------

export type State = 'ready' | 'charging' | 'flying' | 'waiting' | 'hooked' | 'landed' | 'lost' | 'dawn';
export type Input = { hold?: boolean; left?: boolean; right?: boolean };
export type Entry = { n: number; best: number; stars: number };
export type Catch = { id: string; size: number; stars: number; shells: number; first: boolean; record: boolean; requests: number };
export type Loss = 'early' | 'missed' | 'snapped' | 'slipped';
export type Event = { t: string; id?: string; n?: number };
type Bite = { id: string; at: number; nibbles: number[]; window: number; size: number; o1: number; o2: number };
type Fight = { p: number; tension: number; strain: number; slack: number; tau: number; pull: number; jump: boolean; tell: boolean; strained: boolean };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class Game {
  seed: number;
  night = 1; weather: Weather = 'clear'; cast = 0;
  angler: Angler = 'dora'; lure: Lure = 'glow';
  state: State = 'ready'; aim = 0; charge = 0; private rising = true; private held = false;
  /** Seconds spent in the current state. */
  clock = 0;
  /** Where the lure sits: aim (-1 to 1), distance (0 to 1) and the water it is in. */
  bob: { aim: number; d: number; zone: Zone } | null = null;
  bite: Bite | null = null; fight: Fight | null = null;
  caught: Catch | null = null; loss: Loss | null = null;
  journal: Record<string, Entry> = {};
  shells = 0; up: Record<UpgradeId, number> = { rod: 0, line: 0, oil: 0, bobber: 0, spyglass: 0 };
  lures: Lure[] = ['glow']; requests: Request[] = []; private asked = 0;
  /** Catches and casts lost this night, for the dawn summary. */
  tonight: { catches: Catch[]; lost: number; shells: number } = { catches: [], lost: 0, shells: 0 };
  complete = false; events: Event[] = []; time = 0;

  constructor(seed = 1) {
    this.seed = seed >>> 0 || 1;
    this.weather = this.rollWeather();
    while (this.requests.length < 3) this.requests.push(this.makeRequest());
  }

  get phase() { return (this.night - 1) % 8; }
  get casts() { return BASE_CASTS + this.up.oil; }
  get left() { return this.casts - this.cast; }
  /** The time of night for the cast being made (or about to be). */
  get hour(): Time { return TIMES[Math.min(3, Math.floor((Math.min(this.cast, this.casts - 1) * 4) / this.casts))]; }
  get reach() { return Math.min(1, REACH[this.up.rod] * (this.angler === 'dora' ? DORA_CAST : 1)); }
  get window() { return (BITE_WINDOW + BOBBER_WINDOW * this.up.bobber) * (this.angler === 'enzo' ? ENZO_WINDOW : 1); }
  get bandHigh() { return BAND_HIGH + LINE_BAND * this.up.line; }
  get snapAfter() { return SNAP_AFTER + LINE_STRAIN * this.up.line; }
  get found() { return SPECIES.filter((x) => this.journal[x.id]).length; }
  known = (id: string) => !!this.journal[id];

  /** Where the moon's reflection lies for this cast, or null when there is none to see. */
  get moon(): { aim: number; d: number } | null {
    if (this.weather !== 'clear') return null;
    return { aim: 0.6 * Math.sin(this.night * 1.7 + this.cast * 0.9), d: 0.78 + 0.06 * Math.sin(this.night * 0.6 + this.cast * 1.3) };
  }
  /** The water a lure would be in at this aim and distance. */
  zoneFor(aim: number, d: number): Zone {
    const m = this.moon;
    if (m && this.up.rod >= 2 && Math.hypot(aim - m.aim, (d - m.d) * 2) <= MOON_RADIUS) return 'moon';
    return zoneAt(d);
  }
  conditions(zone: Zone): Conditions { return { zone, time: this.hour, weather: this.weather, lure: this.lure, phase: this.phase }; }
  /** Everything that could take the lure right now in that water, with its chance. */
  odds(zone: Zone): { sp: Species; chance: number }[] {
    const c = this.conditions(zone), all = SPECIES.map((sp) => ({ sp, w: weight(sp, c, this.known) })).filter((x) => x.w > 0), total = all.reduce((a, x) => a + x.w, 0);
    return all.map((x) => ({ sp: x.sp, chance: x.w / total }));
  }

  private rollWeather(): Weather {
    // The full moon always burns the cloud away.
    if (this.phase === FULL_MOON) return 'clear';
    const r = rng(mix(this.seed, this.night, 11))();
    return r < 0.4 ? 'clear' : r < 0.6 ? 'mist' : r < 0.8 ? 'rain' : 'fireflies';
  }
  private makeRequest(): Request {
    const r = rng(mix(this.seed, this.asked++, 23)), pick = <T>(list: T[]) => list[Math.floor(r() * list.length)], type = r();
    if (type < 0.35) return { type: 'spot', zone: pick(['reeds', 'lily', 'open', 'deep'] as Zone[]), time: pick(TIMES), reward: 10 };
    if (type < 0.55) return { type: 'weather', weather: pick(WEATHERS), reward: 6 };
    if (type < 0.85) return { type: 'species', id: pick(SPECIES.filter((x) => x.kind === 'creature' && x.rarity < 3 && x.zone !== 'moon')).id, reward: 12 };
    return { type: 'big', reward: 14 };
  }

  setLure(lure: Lure) { if (this.state !== 'ready' || !this.lures.includes(lure)) return false; this.lure = lure; return true; }
  /** The angler is chosen before the first cast of a night. */
  setAngler(who: Angler) { if (this.state !== 'ready' || this.cast > 0) return false; this.angler = who; return true; }
  cost(id: UpgradeId): number | null { return UPGRADES[id].costs[this.up[id]] ?? null; }
  buy(id: UpgradeId) {
    const cost = this.cost(id);
    if (cost === null || this.shells < cost || (this.state !== 'ready' && this.state !== 'dawn')) return false;
    this.shells -= cost; this.up[id]++; this.events.push({ t: 'buy', id }); return true;
  }
  buyLure(lure: Lure) {
    if (this.lures.includes(lure) || this.shells < LURE_COST[lure] || (this.state !== 'ready' && this.state !== 'dawn')) return false;
    this.shells -= LURE_COST[lure]; this.lures.push(lure); this.events.push({ t: 'buy', id: lure }); return true;
  }
  /** Starts the next night. Once the journal is full the weather may be chosen. */
  nextNight(weather?: Weather) {
    if (this.state !== 'dawn') return false;
    this.night++; this.cast = 0; this.state = 'ready'; this.aim = 0; this.charge = 0; this.clock = 0;
    this.bob = null; this.bite = null; this.fight = null; this.caught = null; this.loss = null;
    this.tonight = { catches: [], lost: 0, shells: 0 };
    this.weather = this.complete && weather && WEATHERS.includes(weather) ? weather : this.rollWeather();
    this.events.push({ t: 'night', n: this.night }); return true;
  }
  /** Drops a charge without casting (an interrupted touch). */
  cancel() { if (this.state === 'charging') { this.state = 'ready'; this.charge = 0; } this.held = false; }

  update(dt: number, input: Input = {}) {
    let left = Math.min(dt, 0.25);
    while (left > 1e-9) { const h = Math.min(STEP, left); this.tick(h, input); left -= h; }
  }

  private tick(dt: number, input: Input) {
    const hold = !!input.hold, press = hold && !this.held; this.held = hold;
    this.time += dt; this.clock += dt;
    if (this.state === 'ready' || this.state === 'charging') this.aim = clamp(this.aim + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * AIM_RATE * dt, -1, 1);
    if (this.state === 'ready') { if (press) { this.state = 'charging'; this.charge = 0; this.rising = true; } }
    else if (this.state === 'charging') {
      if (hold) {
        this.charge += (this.rising ? 1 : -1) * CHARGE_RATE * dt;
        if (this.charge >= 1) { this.charge = 1; this.rising = false; } else if (this.charge <= 0) { this.charge = 0; this.rising = true; }
      } else if (this.charge < MIN_CHARGE) { this.state = 'ready'; this.charge = 0; }
      else this.throw();
    }
    else if (this.state === 'flying') { if (this.clock >= FLIGHT) this.splash(); }
    else if (this.state === 'waiting') this.wait(press);
    else if (this.state === 'hooked') this.reel(dt, hold);
    else if ((this.state === 'landed' || this.state === 'lost') && press && this.clock >= LINGER) this.next();
  }

  private throw() {
    const d = this.charge * this.reach;
    this.bob = { aim: this.aim, d, zone: this.zoneFor(this.aim, d) };
    this.state = 'flying'; this.clock = 0; this.events.push({ t: 'cast' });
  }
  private splash() {
    const bob = this.bob!, r = rng(mix(this.seed, this.night, this.cast, 5)), list = this.odds(bob.zone);
    let roll = r(), sp = list[list.length - 1].sp;
    for (const x of list) { if (roll < x.chance) { sp = x.sp; break; } roll -= x.chance; }
    const pace = this.weather === 'rain' ? 0.7 : this.weather === 'mist' ? 1.2 : 1, count = Math.floor(r() * (this.weather === 'fireflies' ? 2 : 4)), nibbles: number[] = [];
    let at = (1.2 + r() * 1.6) * pace;
    for (let i = 0; i < count; i++) { nibbles.push(at); at += NIBBLE + 0.5 + r() * 0.9; }
    const size = sp.size ? Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * r() ** 1.6) * 10) / 10 : 0;
    this.bite = { id: sp.id, at, nibbles, window: this.window, size, o1: r(), o2: r() };
    this.state = 'waiting'; this.clock = 0; this.events.push({ t: 'splash' });
  }
  /** True while the bobber is dipping for a nibble that should be left alone. */
  get nibbling() { const b = this.bite; return this.state === 'waiting' && !!b && b.nibbles.some((n) => this.clock >= n && this.clock < n + NIBBLE); }
  /** True while the bobber is under and a press will hook. */
  get biting() { const b = this.bite; return this.state === 'waiting' && !!b && this.clock >= b.at && this.clock < b.at + b.window; }
  private wait(press: boolean) {
    const b = this.bite!, before = this.clock - STEP;
    for (const n of b.nibbles) if (before < n && this.clock >= n) this.events.push({ t: 'nibble' });
    if (before < b.at && this.clock >= b.at) this.events.push({ t: 'bite' });
    if (press && this.clock >= SETTLE) {
      if (this.clock >= b.at) {
        this.state = 'hooked'; this.clock = 0;
        this.fight = { p: 0, tension: 0.45, strain: 0, slack: 0, tau: 0, pull: 0, jump: false, tell: false, strained: false };
        this.events.push({ t: 'hook', id: b.id });
      } else this.lose('early');
    } else if (this.clock >= b.at + b.window) this.lose('missed');
  }
  private reel(dt: number, hold: boolean) {
    const f = this.fight!, b = this.bite!, sp = byId.get(b.id)!, was = f.jump;
    f.tau += dt;
    const now = pullAt(sp.style, f.tau, b.o1, b.o2, sp.strength), pull = now.pull * (0.45 + 0.55 * sp.strength);
    f.pull = pull; f.jump = now.jump; f.tell = now.tell;
    if (f.jump && !was) { f.strained = false; this.events.push({ t: 'jump' }); }
    const target = f.jump ? (hold ? 1 : 0.4) : hold ? 0.5 + 0.6 * pull : 0.05 + 0.35 * pull;
    f.tension = clamp(f.tension + (target - f.tension) * Math.min(1, LINE_RESPONSE * dt), 0, 1);
    if (f.tension > this.bandHigh) { f.strain += dt * (f.jump ? 2.5 : clamp((f.tension - this.bandHigh) / OVER, 0.3, 1.5)); f.strained = true; } else f.strain = Math.max(0, f.strain - STRAIN_EASE * dt);
    if (f.tension < BAND_LOW && !f.jump) f.slack += dt; else f.slack = Math.max(0, f.slack - SLACK_EASE * dt);
    if (hold && f.tension >= BAND_LOW && !f.jump) f.p += (0.26 - 0.13 * sp.strength) * (1 - 0.5 * pull) * dt;
    else if (f.tension < BAND_LOW && !f.jump) f.p = Math.max(0, f.p - (0.03 + 0.05 * sp.strength) * dt);
    // A leap ridden out on a loose line tires the creature.
    if (was && !f.jump && !f.strained) f.p += 0.04;
    if (f.strain >= this.snapAfter) this.lose('snapped');
    else if (f.slack >= SLIP_AFTER) this.lose('slipped');
    else if (f.p >= 1) this.land();
  }
  private lose(why: Loss) {
    this.state = 'lost'; this.loss = why; this.clock = 0; this.fight = null; this.cast++; this.tonight.lost++;
    this.events.push({ t: why });
  }
  private land() {
    const b = this.bite!, sp = byId.get(b.id)!, old = this.journal[sp.id], bob = this.bob!;
    const frac = sp.size ? (b.size - sp.size[0]) / (sp.size[1] - sp.size[0]) : 0, stars = !sp.size ? 1 : frac >= 0.8 ? 3 : frac >= 0.4 ? 2 : 1;
    const base = sp.kind === 'curio' ? CURIO_SHELLS : SHELLS[sp.rarity];
    let shells = Math.round(base * (1 + STAR_BONUS * (stars - 1))) + (old ? 0 : base), done = 0;
    const hour = this.hour;
    this.requests = this.requests.map((r) => {
      const met = r.type === 'spot' ? r.zone === bob.zone && r.time === hour : r.type === 'weather' ? r.weather === this.weather : r.type === 'species' ? r.id === sp.id : stars === 3;
      if (!met) return r;
      shells += r.reward; done++; return this.makeRequest();
    });
    this.journal[sp.id] = { n: (old?.n ?? 0) + 1, best: Math.max(old?.best ?? 0, b.size), stars: Math.max(old?.stars ?? 0, stars) };
    this.shells += shells;
    this.caught = { id: sp.id, size: b.size, stars, shells, first: !old, record: !!old && b.size > old.best, requests: done };
    this.tonight.catches.push(this.caught); this.tonight.shells += shells;
    this.state = 'landed'; this.clock = 0; this.fight = null; this.cast++;
    this.events.push({ t: old ? 'land' : 'first', id: sp.id });
    if (done) this.events.push({ t: 'request', n: done });
    if (!this.complete && this.found === SPECIES.length) { this.complete = true; this.events.push({ t: 'complete' }); }
  }
  private next() {
    this.bob = null; this.bite = null; this.caught = null; this.loss = null; this.charge = 0; this.clock = 0;
    if (this.cast >= this.casts) { this.state = 'dawn'; this.events.push({ t: 'dawn' }); } else this.state = 'ready';
  }

  // ---------- Saving ----------

  /** The journal, shells and gear: everything that lasts between nights. */
  profile() {
    return { v: SAVE_VERSION, seed: this.seed, night: this.night, journal: this.journal, shells: this.shells, up: this.up, lures: this.lures, requests: this.requests, asked: this.asked, complete: this.complete, angler: this.angler, lure: this.lure };
  }
  /** The night in progress. A cast that was in the air or on the line is taken again from the dock. */
  progress() {
    return { v: SAVE_VERSION, night: this.night, cast: this.cast, weather: this.weather, dawn: this.state === 'dawn', aim: this.aim, tonight: this.tonight };
  }
  static load(profile: unknown, progress?: unknown): Game | null {
    try {
      const p = profile as ReturnType<Game['profile']>, int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
      if (!p || typeof p !== 'object' || p.v !== SAVE_VERSION || !int(p.seed, 1, 0xffffffff) || !int(p.night, 1, 1e6) || !int(p.shells, 0, 1e9) || !int(p.asked, 3, 1e9)) return null;
      const g = new Game(p.seed);
      for (const id of UPGRADE_IDS) { if (!int(p.up?.[id], 0, UPGRADES[id].costs.length)) return null; g.up[id] = p.up[id]; }
      if (!Array.isArray(p.lures) || !p.lures.includes('glow') || p.lures.some((l) => !LURES.includes(l)) || new Set(p.lures).size !== p.lures.length) return null;
      if (!p.journal || typeof p.journal !== 'object') return null;
      for (const [id, e] of Object.entries(p.journal)) {
        const sp = byId.get(id);
        if (!sp || !e || !int(e.n, 1, 1e9) || !int(e.stars, 1, 3) || typeof e.best !== 'number' || !(e.best >= 0) || (sp.size ? e.best < sp.size[0] || e.best > sp.size[1] : e.best !== 0)) return null;
        g.journal[id] = { n: e.n, best: e.best, stars: e.stars };
      }
      if (!Array.isArray(p.requests) || p.requests.length !== 3) return null;
      for (const r of p.requests) {
        if (!r || !int(r.reward, 1, 1000)) return null;
        const ok = r.type === 'spot' ? ZONES.includes(r.zone) && TIMES.includes(r.time) : r.type === 'weather' ? WEATHERS.includes(r.weather) : r.type === 'species' ? byId.has(r.id) : r.type === 'big';
        if (!ok) return null;
      }
      if (!LURES.includes(p.lure) || !p.lures.includes(p.lure) || (p.angler !== 'dora' && p.angler !== 'enzo')) return null;
      g.night = p.night; g.shells = p.shells; g.lures = [...p.lures]; g.requests = p.requests.map((r) => ({ ...r })); g.asked = p.asked;
      g.complete = g.found === SPECIES.length; g.angler = p.angler; g.lure = p.lure; g.weather = g.rollWeather();
      const n = progress as ReturnType<Game['progress']> | null | undefined;
      if (n && typeof n === 'object' && n.v === SAVE_VERSION && n.night === g.night && int(n.cast, 0, g.casts) && WEATHERS.includes(n.weather) && (g.complete || n.weather === g.weather)
        && typeof n.aim === 'number' && Math.abs(n.aim) <= 1 && n.tonight && Array.isArray(n.tonight.catches) && int(n.tonight.lost, 0, 99) && int(n.tonight.shells, 0, 1e9)
        && n.tonight.catches.length + n.tonight.lost === n.cast && n.tonight.catches.every((c) => c && byId.has(c.id) && int(c.stars, 1, 3) && int(c.shells, 0, 1e6) && typeof c.size === 'number')) {
        g.cast = n.cast; g.weather = n.weather; g.aim = n.aim;
        g.tonight = { catches: n.tonight.catches.map((c) => ({ id: c.id, size: c.size, stars: c.stars, shells: c.shells, first: !!c.first, record: !!c.record, requests: c.requests | 0 })), lost: n.tonight.lost, shells: n.tonight.shells };
        if (n.dawn || g.cast >= g.casts) { if (g.cast < g.casts) return null; g.state = 'dawn'; }
      }
      return g;
    } catch { return null; }
  }
}

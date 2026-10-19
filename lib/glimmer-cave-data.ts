// Glimmer Cave's data: heroes, blocks, weapons and their overclocks, passives, rarities, critters, jobs, the wyrm,
// camp upgrades and the tuning numbers. Pure data and small functions, no DOM. Numbers are the design's
// (docs/superpowers/specs/19-10-2026-glimmer-cave-design.md); the ones the spec leaves to a call are marked (start)
// and are set by the bot.

export type Hero = 'dora' | 'enzo';
export type Hazard = 1 | 2 | 3 | 4 | 5;
export type LayerNo = 1 | 2 | 3 | 4 | 5;

/** A hero's base numbers. Class multipliers sit in CLASS below. */
export const BASE = { fluff: 100, speed: 3.2, pickup: 1.5, armour: 0, crit: 0.05, critMult: 2, grace: 0.5, radius: 0.3 };

export const LAYER_SECONDS = 300;
export const POD_SECONDS = 45;
export const POD_DISTANCE = [12, 20];
/** Seconds into layer 5 when the Rock Wyrm arrives. */
export const WYRM_AT = 180;
export const BUDDY_DAMAGE = 0.5;

// ── Blocks ─────────────────────────────────────────────────────────────────

export type Block = 'floor' | 'dirt' | 'gold' | 'bedrock' | 'crate' | 'lantern';
/** Seconds to dig a block at normal speed. Bedrock and lanterns can't be dug. */
export const DIG_TIME = { dirt: 0.6, gold: 1.0, crate: 1.0 };
/** Gold dropped by one gold block: 3-6 on layer 1, richer deeper. */
export function goldRange(layer: LayerNo): [number, number] { return [2 + layer, 5 + layer]; }

// ── Weapons ────────────────────────────────────────────────────────────────

export type WeaponId = 'sling' | 'pickaxe' | 'popper' | 'pulse' | 'lance' | 'puffer' | 'boomerang' | 'orbit' | 'bomb' | 'moths' | 'drum' | 'drill';
export type OverclockId =
  | 'sling.twin' | 'sling.heavy' | 'sling.ricochet' | 'sling.storm'
  | 'pickaxe.wide' | 'pickaxe.double' | 'pickaxe.quake' | 'pickaxe.goldrush'
  | 'popper.cluster' | 'popper.big' | 'popper.sticky' | 'popper.bouncy'
  | 'pulse.bright' | 'pulse.warm' | 'pulse.beacon' | 'pulse.hearth'
  | 'lance.prism' | 'lance.long' | 'lance.resonance' | 'lance.glimmer'
  | 'puffer.big' | 'puffer.sneezy' | 'puffer.cloud' | 'puffer.pepper'
  | 'boomerang.pair' | 'boomerang.long' | 'boomerang.whirl' | 'boomerang.sharp'
  | 'orbit.more' | 'orbit.wide' | 'orbit.twin' | 'orbit.sprout'
  | 'bomb.bigger' | 'bomb.quick' | 'bomb.chain' | 'bomb.prospector'
  | 'moths.swarm' | 'moths.dazzle' | 'moths.moonlit' | 'moths.firefly'
  | 'drum.deep' | 'drum.quick' | 'drum.avalanche' | 'drum.echo'
  | 'drill.twin' | 'drill.long' | 'drill.diamond' | 'drill.tunnelrat';

export const OVERCLOCKS: Record<OverclockId, { id: OverclockId; name: string; text: string }> = {
  'sling.twin': { id: 'sling.twin', name: 'Twin Sling', text: 'Two acorns, aimed apart.' },
  'sling.heavy': { id: 'sling.heavy', name: 'Heavy Acorn', text: '+80% damage, and a bigger shove.' },
  'sling.ricochet': { id: 'sling.ricochet', name: 'Ricochet', text: 'Acorns bounce to 2 more critters.' },
  'sling.storm': { id: 'sling.storm', name: 'Acorn Storm', text: 'Every 5th volley fires 8 acorns all round.' },
  'pickaxe.wide': { id: 'pickaxe.wide', name: 'Wide Swing', text: 'A 200 degree arc.' },
  'pickaxe.double': { id: 'pickaxe.double', name: 'Double Tap', text: 'A second, quicker swing.' },
  'pickaxe.quake': { id: 'pickaxe.quake', name: 'Quake Bonk', text: 'Each swing sends a short shockwave.' },
  'pickaxe.goldrush': { id: 'pickaxe.goldrush', name: 'Gold Rush', text: 'Blocks dug by a swing drop +50% gold.' },
  'popper.cluster': { id: 'popper.cluster', name: 'Cluster', text: 'Splits into 3 pebbles on landing.' },
  'popper.big': { id: 'popper.big', name: 'Big Pebble', text: '+60% splash radius.' },
  'popper.sticky': { id: 'popper.sticky', name: 'Sticky', text: 'Leaves a 2 s patch that slows critters.' },
  'popper.bouncy': { id: 'popper.bouncy', name: 'Bouncy', text: 'Bounces twice more.' },
  'pulse.bright': { id: 'pulse.bright', name: 'Bright', text: '+40% radius.' },
  'pulse.warm': { id: 'pulse.warm', name: 'Warm', text: 'Critters it touches are 25% slower for 2 s.' },
  'pulse.beacon': { id: 'pulse.beacon', name: 'Beacon', text: 'Every 3rd pulse reaches double radius.' },
  'pulse.hearth': { id: 'pulse.hearth', name: 'Hearth', text: 'Each pulse heals 1 Fluff per critter touched, up to 5.' },
  'lance.prism': { id: 'lance.prism', name: 'Prism', text: 'Splits into 3 lances.' },
  'lance.long': { id: 'lance.long', name: 'Long Shard', text: 'Twice as long, and it pierces everything.' },
  'lance.resonance': { id: 'lance.resonance', name: 'Resonance', text: 'A touched critter chimes, nudging its neighbours for 50%.' },
  'lance.glimmer': { id: 'lance.glimmer', name: 'Glimmer', text: 'Bonked critters drop double crystals 10% of the time.' },
  'puffer.big': { id: 'puffer.big', name: 'Big Puff', text: 'A wider cone.' },
  'puffer.sneezy': { id: 'puffer.sneezy', name: 'Sneezy', text: 'The cone also puffs behind.' },
  'puffer.cloud': { id: 'puffer.cloud', name: 'Choking Cloud', text: 'Leaves a lingering cloud for 2 s.' },
  'puffer.pepper': { id: 'puffer.pepper', name: 'Pepper Dust', text: '+100% damage, no slow.' },
  'boomerang.pair': { id: 'boomerang.pair', name: 'Pair', text: 'Two boomerangs.' },
  'boomerang.long': { id: 'boomerang.long', name: 'Long Throw', text: 'Flies 6 tiles.' },
  'boomerang.whirl': { id: 'boomerang.whirl', name: 'Whirl', text: 'Hovers and spins at its far point for 1 s.' },
  'boomerang.sharp': { id: 'boomerang.sharp', name: 'Sharp Twig', text: '+70% damage.' },
  'orbit.more': { id: 'orbit.more', name: 'More Seeds', text: '5 seeds.' },
  'orbit.wide': { id: 'orbit.wide', name: 'Wide Orbit', text: 'Circles at 2.4 tiles.' },
  'orbit.twin': { id: 'orbit.twin', name: 'Twin Ring', text: 'A second, counter-rotating ring.' },
  'orbit.sprout': { id: 'orbit.sprout', name: 'Sprout', text: 'Seeds leave a brief bramble patch.' },
  'bomb.bigger': { id: 'bomb.bigger', name: 'Bigger Bang', text: '+50% radius.' },
  'bomb.quick': { id: 'bomb.quick', name: 'Quick Fuse', text: 'A 0.4 s fuse.' },
  'bomb.chain': { id: 'bomb.chain', name: 'Chain Blast', text: 'Each burst sets off another 2 tiles away.' },
  'bomb.prospector': { id: 'bomb.prospector', name: 'Prospector', text: 'Blocks it digs always drop gold.' },
  'moths.swarm': { id: 'moths.swarm', name: 'Swarm', text: '4 moths.' },
  'moths.dazzle': { id: 'moths.dazzle', name: 'Dazzle', text: 'Critters they touch are stunned for 0.3 s.' },
  'moths.moonlit': { id: 'moths.moonlit', name: 'Moonlit', text: 'Moths fly straight through critters.' },
  'moths.firefly': { id: 'moths.firefly', name: 'Firefly', text: 'Moths burst for 15 when they return.' },
  'drum.deep': { id: 'drum.deep', name: 'Deep Drum', text: '+1.5 tiles radius.' },
  'drum.quick': { id: 'drum.quick', name: 'Quick Beat', text: 'Thumps every 2.5 s.' },
  'drum.avalanche': { id: 'drum.avalanche', name: 'Avalanche', text: 'The thump digs blocks in range.' },
  'drum.echo': { id: 'drum.echo', name: 'Echo', text: 'A second thump follows 0.5 s later.' },
  'drill.twin': { id: 'drill.twin', name: 'Twin Drill', text: 'Also drills backward.' },
  'drill.long': { id: 'drill.long', name: 'Long Bore', text: 'Bores 10 tiles.' },
  'drill.diamond': { id: 'drill.diamond', name: 'Diamond Bit', text: '+100% damage.' },
  'drill.tunnelrat': { id: 'drill.tunnelrat', name: 'Tunnel Rat', text: 'You scamper 25% faster for 2 s after each drill.' },
};

/** The secondary stat a card adds besides damage: a faster cooldown, a bigger size, or one more. */
export type Step = 'rate' | 'size' | 'count';

export type WeaponDef = {
  id: WeaponId; name: string; text: string;
  /** Damage at level 1. */
  damage: number;
  /** Seconds between uses at level 1. */
  cooldown: number;
  mines: boolean;
  /** The two twists offered at level 5 and at level 10. */
  oc5: [OverclockId, OverclockId];
  oc10: [OverclockId, OverclockId];
  /** What each card from level 2 to 12 adds besides damage. */
  steps: Step[];
  /** The weapon's other numbers: ranges, radii, speeds and the overclocks' figures. */
  p: Record<string, number>;
};

const alt = (a: Step, b: Step, c?: Step): Step[] => Array.from({ length: 11 }, (_, i) => (c ? [a, b, c][i % 3] : i % 2 ? b : a));

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sling: {
    id: 'sling', name: 'Acorn Sling', text: 'Flings an acorn at the nearest critter.', damage: 8, cooldown: 0.6, mines: false,
    oc5: ['sling.twin', 'sling.heavy'], oc10: ['sling.ricochet', 'sling.storm'], steps: alt('rate', 'count'),
    p: { range: 7, speed: 10, twinAngle: 15, heavy: 0.8, knock: 1, bounces: 2, stormEvery: 5, stormN: 8 },
  },
  pickaxe: {
    id: 'pickaxe', name: 'Pickaxe Bonk', text: 'Swings an arc the way you face, and digs.', damage: 14, cooldown: 0.9, mines: true,
    oc5: ['pickaxe.wide', 'pickaxe.double'], oc10: ['pickaxe.quake', 'pickaxe.goldrush'], steps: alt('rate', 'size'),
    p: { arc: 110, reach: 1.4, wideArc: 200, doubleDelay: 0.25, quakeReach: 2.5, goldrush: 0.5 },
  },
  popper: {
    id: 'popper', name: 'Pebble Popper', text: 'Lobs a pebble that splashes where it lands.', damage: 10, cooldown: 1.2, mines: false,
    oc5: ['popper.cluster', 'popper.big'], oc10: ['popper.sticky', 'popper.bouncy'], steps: alt('size', 'rate'),
    p: { splash: 1, range: 6, flight: 0.6, cluster: 3, bigSplash: 0.6, stickyFor: 2, stickySlow: 0.4, bounces: 2 },
  },
  pulse: {
    id: 'pulse', name: 'Lantern Pulse', text: 'A warm ring pulses out and pushes critters back.', damage: 6, cooldown: 2, mines: false,
    oc5: ['pulse.bright', 'pulse.warm'], oc10: ['pulse.beacon', 'pulse.hearth'], steps: alt('size', 'rate'),
    p: { radius: 2.5, bright: 0.4, warmSlow: 0.25, warmFor: 2, beaconEvery: 3, beaconMult: 2, heal: 1, healMax: 5 },
  },
  lance: {
    id: 'lance', name: 'Crystal Lance', text: 'Fires a piercing shard toward the densest crowd.', damage: 12, cooldown: 1.5, mines: false,
    oc5: ['lance.prism', 'lance.long'], oc10: ['lance.resonance', 'lance.glimmer'], steps: alt('rate', 'size'),
    p: { length: 6, width: 0.4, prism: 3, longMult: 2, chime: 0.5, chimeReach: 1, glimmerChance: 0.1 },
  },
  puffer: {
    id: 'puffer', name: 'Dust Puffer', text: 'Puffs a short cone ahead that slows critters.', damage: 5, cooldown: 0.8, mines: false,
    oc5: ['puffer.big', 'puffer.sneezy'], oc10: ['puffer.cloud', 'puffer.pepper'], steps: alt('rate', 'size'),
    p: { length: 2.5, cone: 60, wideCone: 100, slow: 0.3, slowFor: 1.5, cloudFor: 2, pepper: 1 },
  },
  boomerang: {
    id: 'boomerang', name: 'Twig Boomerang', text: 'Throws a twig that flies out and returns.', damage: 9, cooldown: 1.4, mines: false,
    oc5: ['boomerang.pair', 'boomerang.long'], oc10: ['boomerang.whirl', 'boomerang.sharp'], steps: alt('rate', 'count'),
    p: { range: 4, speed: 8, pair: 2, longRange: 6, whirlFor: 1, sharp: 0.7 },
  },
  orbit: {
    id: 'orbit', name: 'Seed Orbit', text: 'Seeds circle you and bonk whatever they touch.', damage: 7, cooldown: 0.4, mines: false,
    oc5: ['orbit.more', 'orbit.wide'], oc10: ['orbit.twin', 'orbit.sprout'], steps: alt('count', 'size'),
    p: { seeds: 3, radius: 1.6, speed: 3, more: 5, wide: 2.4, sproutFor: 1, sproutDamage: 3, sproutTick: 0.5 },
  },
  bomb: {
    id: 'bomb', name: 'Burrow Bomb', text: 'Drops a bomb that bursts and digs nearby blocks.', damage: 25, cooldown: 2.5, mines: true,
    oc5: ['bomb.bigger', 'bomb.quick'], oc10: ['bomb.chain', 'bomb.prospector'], steps: alt('size', 'rate'),
    p: { fuse: 1, radius: 1.5, bigger: 0.5, quickFuse: 0.4, chainReach: 2 },
  },
  moths: {
    id: 'moths', name: 'Glow Moths', text: 'Moths fly out, home in on critters and return.', damage: 6, cooldown: 0.5, mines: false,
    oc5: ['moths.swarm', 'moths.dazzle'], oc10: ['moths.moonlit', 'moths.firefly'], steps: alt('count', 'rate'),
    p: { moths: 2, speed: 7, range: 6, swarm: 4, dazzle: 0.3, fireflyDamage: 15, fireflyRadius: 1 },
  },
  drum: {
    id: 'drum', name: 'Rumble Drum', text: 'A thump that shakes and stuns everything near you.', damage: 10, cooldown: 4, mines: false,
    oc5: ['drum.deep', 'drum.quick'], oc10: ['drum.avalanche', 'drum.echo'], steps: alt('size', 'rate'),
    p: { radius: 3.5, stun: 0.5, deep: 1.5, quickCooldown: 2.5, echoDelay: 0.5 },
  },
  drill: {
    id: 'drill', name: 'Pebble Drill', text: 'Sends a spinning drill ahead that digs as it goes.', damage: 8, cooldown: 2, mines: true,
    oc5: ['drill.twin', 'drill.long'], oc10: ['drill.diamond', 'drill.tunnelrat'], steps: alt('rate', 'size'),
    p: { range: 6, speed: 8, width: 0.8, tick: 0.25, longRange: 10, diamond: 1, ratSpeed: 0.25, ratFor: 2 },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const START_POOL: WeaponId[] = ['sling', 'pickaxe', 'popper', 'pulse', 'lance', 'puffer', 'boomerang', 'orbit'];

export type UnlockRule = { k: 'layer'; n: 3 } | { k: 'finish' } | { k: 'finishHazard'; n: 2 } | { k: 'bonked'; n: 5000 };
export const UNLOCK: Record<'bomb' | 'moths' | 'drum' | 'drill', UnlockRule> = {
  bomb: { k: 'layer', n: 3 }, moths: { k: 'finish' }, drum: { k: 'finishHazard', n: 2 }, drill: { k: 'bonked', n: 5000 },
};

export const CLASS: Record<Hero, { start: WeaponId; fluff: number; dig: number; projectile: number; lamp: number; speed: number }> = {
  dora: { start: 'pickaxe', fluff: 1.15, dig: 2, projectile: 1, lamp: 1, speed: 1 },
  enzo: { start: 'sling', fluff: 1, dig: 1, projectile: 1.15, lamp: 1.3, speed: 1.1 },
};

// ── Card bonuses ───────────────────────────────────────────────────────────

/** A weapon card at rarity multiplier m adds damage 0.15 x m; its step adds rate (cooldown / (1 + 0.06 x m)), size
 *  (+0.1 x m to radii and lengths) or count (+1, not scaled). (start) */
export const CARD = { damage: 0.15, rate: 0.06, size: 0.1, count: 1 };

// ── Passives ───────────────────────────────────────────────────────────────

export type PassiveId = 'fluff' | 'paws' | 'magnet' | 'claws' | 'busy' | 'arms' | 'lucky' | 'coat';
export const PASSIVE_MAX = 5;
export const PASSIVE_IDS: PassiveId[] = ['fluff', 'paws', 'magnet', 'claws', 'busy', 'arms', 'lucky', 'coat'];
export const PASSIVES: Record<PassiveId, { id: PassiveId; name: string; text: string; per: number }> = {
  fluff: { id: 'fluff', name: 'Thick Fluff', text: '+15 max Fluff, and heals 15.', per: 15 },
  paws: { id: 'paws', name: 'Quick Paws', text: '+6% move speed.', per: 0.06 },
  magnet: { id: 'magnet', name: 'Magnet Whiskers', text: '+25% pickup radius.', per: 0.25 },
  claws: { id: 'claws', name: 'Sharp Claws', text: '+8% all damage.', per: 0.08 },
  busy: { id: 'busy', name: 'Busy Paws', text: '-6% weapon cooldowns.', per: 0.06 },
  arms: { id: 'arms', name: 'Strong Arms', text: '+25% dig speed.', per: 0.25 },
  lucky: { id: 'lucky', name: 'Lucky Tail', text: '+4% crit chance.', per: 0.04 },
  coat: { id: 'coat', name: 'Tough Coat', text: '+1 armour: takes 1 off each bump, to a minimum of 1.', per: 1 },
};

// ── Rarity ─────────────────────────────────────────────────────────────────

export const RARITY = { names: ['Common', 'Uncommon', 'Rare', 'Epic'], weights: [60, 28, 10, 2], mult: [1, 1.5, 2, 3] };
/** Each hazard above 1 moves 4 points from Common to Uncommon and 1 from Uncommon to Rare. */
export function rarityWeights(h: Hazard): [number, number, number, number] {
  const [c, u, r, e] = RARITY.weights;
  return [c - 4 * (h - 1), u + 4 * (h - 1) - (h - 1), r + (h - 1), e];
}

// ── Critters ───────────────────────────────────────────────────────────────

export type CritterId = 'soot' | 'mite' | 'beetle';
export const CRITTER_IDS: CritterId[] = ['soot', 'mite', 'beetle'];
export const CRITTERS: Record<CritterId, { name: string; fluff: number; speed: number; contact: number; xp: number; radius: number }> = {
  soot: { name: 'Soot sprite', fluff: 6, speed: 2.2, contact: 5, xp: 1, radius: 0.3 },
  mite: { name: 'Pink mite', fluff: 4, speed: 2.8, contact: 4, xp: 1, radius: 0.25 },
  beetle: { name: 'Mossy beetle', fluff: 30, speed: 1.4, contact: 10, xp: 4, radius: 0.45 },
};
/** Mites come in packs and hop in short dashes. (start) */
export const MITE = { pack: [5, 8], dash: 0.4, rest: 0.6 };
/** A beetle within `within` tiles rams `ram` tiles every `every` seconds. (start) */
export const BEETLE = { every: 4, within: 4, ram: 2, ramSpeed: 6 };
export const ELITE = { size: 1.6, fluff: 8, contact: 1.5, cache: 20, every: 60, from: 2 };

export function critterFluff(base: number, layer: LayerNo, h: Hazard) {
  return base * (1 + 0.35 * (layer - 1)) * (1 + 0.25 * (h - 1));
}

export const MAX_ALIVE = 300;
/** The number of critters the cave tries to keep alive `t` seconds into a layer. */
export function targetAlive(t: number, layer: LayerNo, h: Hazard, podRun: boolean) {
  const ramp = 20 + 100 * Math.max(0, Math.min(1, t / LAYER_SECONDS));
  return Math.min(MAX_ALIVE, ramp * Math.pow(1.25, layer - 1) * (1 + 0.2 * (h - 1)) * (podRun ? 2 : 1));
}
export const BURST = { every: 60, n: 30 };
/** Soot, mite and beetle weights per layer. (start) */
export const LAYER_MIX: Record<LayerNo, [number, number, number]> = {
  1: [70, 30, 0], 2: [60, 30, 10], 3: [45, 35, 20], 4: [40, 35, 25], 5: [40, 30, 30],
};

// ── Jobs ───────────────────────────────────────────────────────────────────

export type JobId = 'haul' | 'crates' | 'lanterns' | 'bigone';
export const JOB_IDS: JobId[] = ['haul', 'crates', 'lanterns', 'bigone'];
/** Every reward is multiplied by the layer number. */
export const JOBS = {
  haul: { name: 'Crystal haul', text: 'Pick up 60 crystals on this layer.', goal: 60, gold: 25 },
  crates: { name: 'Dig out the crates', text: 'Dig 3 buried crystal crates out of the rock.', goal: 3, crystals: 15, gold: 25 },
  lanterns: { name: 'Light the lanterns', text: 'Stand by 3 unlit lanterns for 3 s each.', goal: 3, stand: 3, reach: 1.2, pool: 3, slow: 0.3, gold: 25 },
  bigone: { name: 'Bonk the big one', text: 'An elite critter appears at 2:30. Bonk it.', at: 150, gold: 30, cache: 20 },
};

// ── The Rock Wyrm ──────────────────────────────────────────────────────────

/** Its Fluff is scaled by 1 + 0.25 x (hazard - 1); its gold is x hazard. (start, except where the spec fixes a number) */
export const WYRM = {
  fluff: 2500, segments: 8, spacing: 0.9, head: 0.9, body: 0.6, speed: 2.6, contact: 15, rumbleEvery: 8, telegraph: 1,
  ring: 4, ringWidth: 0.6, ringDamage: 15, diveAt: 0.5, diveFor: 6, fastAfter: 1.3, crystals: 100, gold: 200,
};
/** The id the wyrm's head goes by in `hit` events and to the weapons, which see it as a critter. */
export const WYRM_ID = -1;

// ── Levels ─────────────────────────────────────────────────────────────────

export function xpNeed(level: number) { return 5 + 3 * level; }

// ── Camp ───────────────────────────────────────────────────────────────────

export type UpgradeId = 'fluffier' | 'sharper' | 'quicker' | 'diggier' | 'magnetic' | 'prospector' | 'rerolls' | 'headstart';
export const UPGRADE_IDS: UpgradeId[] = ['fluffier', 'sharper', 'quicker', 'diggier', 'magnetic', 'prospector', 'rerolls', 'headstart'];
export const UPGRADES: Record<UpgradeId, { id: UpgradeId; name: string; text: string; per: number; max: number; base: number }> = {
  fluffier: { id: 'fluffier', name: 'Fluffier', text: '+8 max Fluff per level.', per: 8, max: 5, base: 40 },
  sharper: { id: 'sharper', name: 'Sharper', text: '+5% all damage per level.', per: 0.05, max: 5, base: 60 },
  quicker: { id: 'quicker', name: 'Quicker', text: '+3% move speed per level.', per: 0.03, max: 5, base: 40 },
  diggier: { id: 'diggier', name: 'Diggier', text: '+10% dig speed per level.', per: 0.1, max: 5, base: 30 },
  magnetic: { id: 'magnetic', name: 'Magnetic', text: '+10% pickup radius per level.', per: 0.1, max: 5, base: 30 },
  prospector: { id: 'prospector', name: 'Prospector', text: '+8% gold per level.', per: 0.08, max: 5, base: 50 },
  rerolls: { id: 'rerolls', name: 'Rerolls', text: '+1 reroll per dive per level.', per: 1, max: 3, base: 80 },
  headstart: { id: 'headstart', name: 'Head start', text: 'Start each dive one level higher.', per: 1, max: 3, base: 100 },
};
export function upgradeCost(id: UpgradeId, nextLevel: number) { return UPGRADES[id].base * nextLevel; }

// ── Layer tints ────────────────────────────────────────────────────────────

/** Warm purple, deeper violet, blue-violet, plum and ember-lit. The scene uses them; the engine doesn't. */
export const TINT: Record<LayerNo, string> = { 1: '#7a4a8c', 2: '#5a3a94', 3: '#4a4f9e', 4: '#6e3466', 5: '#a2502c' };

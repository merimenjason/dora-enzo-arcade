// Chinchilla Trek's data: skills, evolutions, foes, chapters, story scenes, gear and the tuning numbers. Pure data
// and small functions, no DOM. Numbers are the design's (docs/superpowers/specs/18-10-2026-chinchilla-trek-design.md).

export type Hero = 'dora' | 'enzo';
export type Level = 1 | 2 | 3;
export type ChapterNo = 1 | 2 | 3 | 4 | 5;

// ── Skills ─────────────────────────────────────────────────────────────────

export type SkillId =
  | 'combo' | 'counter' | 'sharp' | 'keen' | 'fluff' | 'shell' | 'dust' | 'static' | 'snack'
  | 'nap' | 'grit' | 'prickle' | 'pounce' | 'roll' | 'pepper' | 'frost' | 'lucky' | 'wind';
export type EvoId = 'storm' | 'fury' | 'bramble' | 'feast';
type Skill = { id: SkillId; name: string; v: [number, number, number]; text: [string, string, string] };

const pc = (n: number) => `${Math.round(n * 100)}%`;
const skill = (id: SkillId, name: string, v: [number, number, number], say: (n: number) => string): Skill => ({ id, name, v, text: [say(v[0]), say(v[1]), say(v[2])] });

/** Static Fluff's chance to zap on each attack, at every level. */
export const ZAP_CHANCE = 0.25;
export const SKILLS: Record<SkillId, Skill> = {
  combo: skill('combo', 'Combo', [0.2, 0.35, 0.5], (n) => `${pc(n)} chance to attack again (once a turn).`),
  counter: skill('counter', 'Counter', [0.2, 0.35, 0.5], (n) => `${pc(n)} chance to hit back when hit.`),
  sharp: skill('sharp', 'Sharp Teeth', [0.15, 0.25, 0.4], (n) => `+${pc(n)} attack.`),
  keen: skill('keen', 'Keen Eye', [0.1, 0.2, 0.3], (n) => `+${pc(n)} crit chance.`),
  fluff: skill('fluff', 'Extra Fluff', [0.2, 0.35, 0.5], (n) => `+${pc(n)} max HP.`),
  shell: skill('shell', 'Shell', [0.15, 0.25, 0.4], (n) => `Start of fight: a shield of ${pc(n)} of max HP.`),
  dust: skill('dust', 'Dust Cloud', [0.08, 0.15, 0.22], (n) => `+${pc(n)} dodge.`),
  static: skill('static', 'Static Fluff', [0.5, 0.8, 1.2], (n) => `Each attack: ${pc(ZAP_CHANCE)} chance of a zap for ${pc(n)} of attack.`),
  snack: skill('snack', 'Snack Break', [0.08, 0.14, 0.2], (n) => `Heal ${pc(n)} of the damage you deal.`),
  nap: skill('nap', 'Power Nap', [0.02, 0.04, 0.06], (n) => `End of each round: heal ${pc(n)} of max HP.`),
  grit: skill('grit', 'Grit', [0.3, 0.5, 0.8], (n) => `Below half HP: +${pc(n)} attack.`),
  prickle: skill('prickle', 'Prickles', [0.15, 0.25, 0.4], (n) => `Reflect ${pc(n)} of the damage you take.`),
  pounce: skill('pounce', 'Pounce', [2.5, 4, 5.5], (n) => `Your first attack in a fight deals ×${n}.`),
  roll: skill('roll', 'Dust Roll', [1.5, 2.5, 3.5], (n) => `Start of fight: deal ${pc(n)} of attack.`),
  pepper: skill('pepper', 'Pepper Dust', [0.1, 0.15, 0.2], (n) => `Hits add a burn of ${pc(n)} of attack each round (up to 5).`),
  frost: skill('frost', 'Frost Whiskers', [0.12, 0.2, 0.28], (n) => `${pc(n)} chance a hit freezes the foe for a turn.`),
  lucky: skill('lucky', 'Lucky Paw', [0.2, 0.4, 0.6], (n) => `+${pc(n)} acorns, and the wheel's bad slice turns lucky.`),
  wind: skill('wind', 'Second Wind', [0.3, 0.5, 0.7], (n) => `Once a trek, at 0 HP, stand back up with ${pc(n)} of max HP.`),
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const EVOS: Record<EvoId, { id: EvoId; name: string; from: [SkillId, SkillId]; text: string }> = {
  storm: { id: 'storm', name: 'Thunder Combo', from: ['combo', 'static'], text: 'Every extra attack also zaps for 120%, and Combo can chain twice.' },
  fury: { id: 'fury', name: 'Fluffy Fury', from: ['keen', 'grit'], text: 'Crits deal ×3; below half HP, +30% crit chance.' },
  bramble: { id: 'bramble', name: 'Bramble Shell', from: ['shell', 'prickle'], text: 'Your shield refills by 10% of max HP each round; reflect 60%.' },
  feast: { id: 'feast', name: 'Midnight Feast', from: ['snack', 'nap'], text: 'Heal 25% of the damage you deal, and 12% of max HP each round.' },
};
export const EVO_IDS = Object.keys(EVOS) as EvoId[];

// ── Foes and chapters ──────────────────────────────────────────────────────

/**
 * sting: its first hit adds a burn of 10% of its attack a round. shell: the first hit it takes is halved. chill:
 * every 4th turn its hit freezes the hero. swift: 15% dodge. double: every 3rd turn it attacks twice. regen: heals 5%
 * of its max HP a round. rage: +50% attack below half HP.
 */
export type Trait = 'sting' | 'shell' | 'chill' | 'swift' | 'double' | 'regen' | 'rage';
export type FoeId =
  | 'beetle' | 'mice' | 'toad' | 'wasp' | 'hedgepig' | 'kingmole'
  | 'magpie' | 'stoat' | 'sprite' | 'piglet' | 'raccoon' | 'badger'
  | 'crab' | 'heron' | 'pike' | 'vole' | 'turtle' | 'otter'
  | 'snowhare' | 'ptarmigan' | 'goatkid' | 'imp' | 'pika' | 'foxqueen'
  | 'bat' | 'moth' | 'wisp' | 'owlet' | 'shadowcat' | 'hornedowl';
export type Rank = 'foe' | 'elite' | 'boss';
type Foe = { id: FoeId; name: string; chapter: ChapterNo; rank: Rank; hp: number; atk: number; trait: Trait | null };

const foe = (id: FoeId, name: string, chapter: ChapterNo, rank: Rank, hp: number, atk: number, trait: Trait | null = null): Foe => ({ id, name, chapter, rank, hp, atk, trait });
/** Base stats by rank are foe 40/6, elite 90/8, boss 180/11; each foe is within 20% of its rank's. */
export const FOES: Record<FoeId, Foe> = {
  beetle: foe('beetle', 'Beetle', 1, 'foe', 46, 5), mice: foe('mice', 'Field Mouse Gang', 1, 'foe', 36, 6, 'double'),
  toad: foe('toad', 'Grumpy Toad', 1, 'foe', 44, 5, 'regen'), wasp: foe('wasp', 'Wasp', 1, 'foe', 34, 7, 'sting'),
  hedgepig: foe('hedgepig', 'Hedge Pig', 1, 'elite', 96, 8, 'shell'), kingmole: foe('kingmole', 'King Mole', 1, 'boss', 180, 11, 'rage'),
  magpie: foe('magpie', 'Magpie', 2, 'foe', 36, 7, 'swift'), stoat: foe('stoat', 'Stoat', 2, 'foe', 38, 6, 'double'),
  sprite: foe('sprite', 'Thornbush Sprite', 2, 'foe', 42, 5, 'regen'), piglet: foe('piglet', 'Wild Boar Piglet', 2, 'foe', 46, 6, 'rage'),
  raccoon: foe('raccoon', 'Old Raccoon', 2, 'elite', 90, 8, 'double'), badger: foe('badger', 'Grumbleton the Badger', 2, 'boss', 196, 11, 'rage'),
  crab: foe('crab', 'Crab', 3, 'foe', 44, 5, 'shell'), heron: foe('heron', 'Heron', 3, 'foe', 36, 7, 'swift'),
  pike: foe('pike', 'Pike', 3, 'foe', 38, 6, 'double'), vole: foe('vole', 'Water Vole', 3, 'foe', 42, 6),
  turtle: foe('turtle', 'Snapping Turtle', 3, 'elite', 104, 7, 'shell'), otter: foe('otter', 'Captain Otter', 3, 'boss', 172, 12, 'double'),
  snowhare: foe('snowhare', 'Snow Hare', 4, 'foe', 34, 7, 'swift'), ptarmigan: foe('ptarmigan', 'Ptarmigan', 4, 'foe', 40, 6),
  goatkid: foe('goatkid', 'Mountain Goat Kid', 4, 'foe', 46, 6, 'rage'), imp: foe('imp', 'Ice Imp', 4, 'foe', 38, 6, 'chill'),
  pika: foe('pika', 'Yeti Pika', 4, 'elite', 86, 9, 'swift'), foxqueen: foe('foxqueen', 'The Snow Fox Queen', 4, 'boss', 184, 11, 'chill'),
  bat: foe('bat', 'Bat', 5, 'foe', 34, 7, 'swift'), moth: foe('moth', 'Moth', 5, 'foe', 40, 6),
  wisp: foe('wisp', "Will-o'-wisp", 5, 'foe', 38, 6, 'regen'), owlet: foe('owlet', 'Night Owlet', 5, 'foe', 42, 6, 'sting'),
  shadowcat: foe('shadowcat', 'Shadow Cat', 5, 'elite', 88, 9, 'swift'), hornedowl: foe('hornedowl', 'The Great Horned Owl', 5, 'boss', 190, 12, 'regen'),
};
export const FOE_IDS = Object.keys(FOES) as FoeId[];

export type Chapter = { no: ChapterNo; name: string; foes: FoeId[]; elite: FoeId; boss: FoeId };
export const CHAPTERS: Chapter[] = [
  { no: 1, name: 'Clover Meadow', foes: ['beetle', 'mice', 'toad', 'wasp'], elite: 'hedgepig', boss: 'kingmole' },
  { no: 2, name: 'Bramble Wood', foes: ['magpie', 'stoat', 'sprite', 'piglet'], elite: 'raccoon', boss: 'badger' },
  { no: 3, name: 'Willow River', foes: ['crab', 'heron', 'pike', 'vole'], elite: 'turtle', boss: 'otter' },
  { no: 4, name: 'Frosty Peak', foes: ['snowhare', 'ptarmigan', 'goatkid', 'imp'], elite: 'pika', boss: 'foxqueen' },
  { no: 5, name: 'Moon Hollow', foes: ['bat', 'moth', 'wisp', 'owlet'], elite: 'shadowcat', boss: 'hornedowl' },
];

// ── Days ───────────────────────────────────────────────────────────────────

export const DAYS = 30;
export const FIXED_DAYS = { 10: 'elite', 15: 'crossroads', 20: 'elite', 25: 'pedlar', 30: 'boss' } as const;
export const DAY_WEIGHTS = { fight: 40, story: 20, cache: 12, find: 10, rest: 8, wheel: 5, pedlar: 5 };

// ── Story scenes ───────────────────────────────────────────────────────────

/** What a choice does. Acorn amounts are multiplied by the chapter. `hurt` never takes HP below 1. */
export type Effect =
  | { k: 'heal' | 'hurt'; pct: number } | { k: 'acorns'; n: number }
  | { k: 'stat'; stat: 'atk' | 'hp' | 'crit' | 'dodge'; v: number } | { k: 'cache' } | { k: 'later'; scene: string; days: number };
export type Choice = { label: string; odds?: number; win: Effect[]; winText: string; lose?: Effect[]; loseText?: string };
/** `{other}` in any text is the chinchilla you didn't pick. A follow-up scene is never rolled; only `later` brings it. */
export type Scene = { id: string; chapter: ChapterNo | 0; text: string; choices: [Choice, Choice]; followUp?: boolean };

const go = (label: string, win: Effect[], winText: string): Choice => ({ label, win, winText });
const risk = (label: string, odds: number, win: Effect[], winText: string, lose: Effect[], loseText: string): Choice => ({ label, odds, win, winText, lose, loseText });
const scene = (id: string, chapter: ChapterNo | 0, text: string, a: Choice, b: Choice, followUp = false): Scene => ({ id, chapter, text, choices: [a, b], ...(followUp ? { followUp } : {}) });

export const SCENES: Scene[] = [
  scene('mushroom', 0, 'A mushroom glows softly by the path. It smells like toast.',
    risk('Eat it (50/50)', 0.5, [{ k: 'stat', stat: 'atk', v: 0.1 }], 'You feel mighty! +10% attack for the trek.', [{ k: 'hurt', pct: 0.1 }], 'Your tummy grumbles. You lose 10% HP.'),
    go('Leave it', [], 'You leave the glowing mushroom to glow.')),
  scene('bird', 0, 'A little bird is tangled in some twine and peeping crossly.',
    go('Free it', [{ k: 'later', scene: 'birdback', days: 3 }], 'The bird shakes out its feathers and flutters off, chirping thanks.'),
    go('Walk on', [], 'You hum loudly so you can\'t hear the peeping.')),
  scene('birdback', 0, 'The bird you freed swoops down, carrying a pouch of acorns.',
    go('Thank it', [{ k: 'acorns', n: 15 }], 'It drops the pouch in your paws and sings you a song.'),
    go('Ask for a song instead', [{ k: 'heal', pct: 0.2 }], 'It sings so sweetly you feel rested.'), true),
  scene('dustbath', 0, 'A patch of perfect, powdery dust. A chinchilla\'s dream.',
    go('Roll in it', [{ k: 'heal', pct: 0.15 }], 'Fluffier than ever. You heal 15%.'),
    go('Practise dodging in the dust', [{ k: 'stat', stat: 'dodge', v: 0.03 }], 'Twist, flip, poof. +3% dodge.')),
  scene('pip', 0, 'Pip scampers up with a tiny bag, asking to come along.',
    go('Let Pip tag along', [{ k: 'later', scene: 'piphelp', days: 4 }], 'Pip hops into your satchel, giggling.'),
    go('Send Pip home with a hug', [{ k: 'acorns', n: 5 }], 'Pip waves goodbye and leaves you an acorn or two.')),
  scene('piphelp', 0, 'Pip pops out of your satchel holding a snack.',
    go('Share it', [{ k: 'heal', pct: 0.3 }], 'Crunchy and delicious. You heal 30%.'),
    go('Let Pip keep it', [{ k: 'stat', stat: 'hp', v: 0.05 }], 'Pip is so happy you feel sturdier. +5% max HP.'), true),
  scene('puddle', 0, 'A wide puddle lies across the path.',
    risk('Leap it (50/50)', 0.5, [{ k: 'acorns', n: 8 }], 'A perfect leap! You land beside some acorns.', [{ k: 'hurt', pct: 0.08 }], 'Splash. You are very soggy and a little sulky.'),
    go('Go around', [], 'The long way round. Dry, at least.')),
  scene('berrybush', 0, 'A bush heavy with berries, some ordinary, some shiny.',
    go('Pick the ordinary ones', [{ k: 'heal', pct: 0.2 }], 'Sweet and filling. You heal 20%.'),
    risk('Pick the shiny ones (50/50)', 0.5, [{ k: 'stat', stat: 'hp', v: 0.1 }], 'Fizzy! +10% max HP.', [{ k: 'hurt', pct: 0.05 }], 'Sour! Your whiskers curl.')),
  scene('napspot', 0, 'A warm, flat rock, exactly chinchilla-sized.',
    go('Nap', [{ k: 'heal', pct: 0.25 }], 'A lovely nap. You heal 25%.'),
    go('Keep going', [{ k: 'acorns', n: 5 }], 'You press on and find acorns under the next tree.')),
  scene('signpost', 0, 'A signpost has a riddle carved into it.',
    risk('Solve it (60/40)', 0.6, [{ k: 'cache' }], 'Clever! A new trick comes to mind.', [], 'Hmm. Nothing comes to mind.'),
    go('Ignore it', [{ k: 'acorns', n: 3 }], 'You find three acorns at the foot of the post.')),
  scene('picnic', 0, '{other} waves from a hilltop beside a picnic basket.',
    go('Join the picnic', [{ k: 'heal', pct: 0.3 }], 'Sandwiches and stories. You heal 30%.'),
    go('Grab a snack and go', [{ k: 'stat', stat: 'atk', v: 0.05 }], '{other} cheers you on. +5% attack.')),
  scene('stash', 0, 'A forgotten pile of acorns, with a little sign: "Help yourself."',
    go('Take a few', [{ k: 'acorns', n: 10 }], 'You take a few and leave a thank-you note.'),
    go('Leave them for others', [{ k: 'stat', stat: 'crit', v: 0.03 }], 'Kindness feels lucky. +3% crit.')),
  scene('clover', 1, 'The meadow is a sea of clover.',
    risk('Hunt for a four-leaf one (30/70)', 0.3, [{ k: 'stat', stat: 'crit', v: 0.05 }], 'Four leaves! +5% crit.', [], 'Three leaves, every single one.'),
    go('Make a daisy chain', [{ k: 'heal', pct: 0.1 }], 'Very relaxing. You heal 10%.')),
  scene('beehive', 1, 'A hive hums in a hollow log. Honey drips from it.',
    risk('Ask the bees nicely (50/50)', 0.5, [{ k: 'heal', pct: 0.3 }], 'They share! You heal 30%.', [{ k: 'hurt', pct: 0.1 }], 'A grumpy buzz. You hop away quickly.'),
    go('Tiptoe past', [], 'Bzzz. Nobody minds you.')),
  scene('thornpath', 2, 'A shortcut through the brambles. Something glints inside.',
    risk('Push through (60/40)', 0.6, [{ k: 'acorns', n: 10 }], 'Scratchy, but you find acorns!', [{ k: 'hurt', pct: 0.1 }], 'Prickly! Your fur is all tangled.'),
    go('Take the long way', [], 'You stroll round the brambles.')),
  scene('oldstump', 2, 'An old stump with a door in it. The door is ajar.',
    go('Peek inside', [{ k: 'cache' }], 'A book of tricks! You learn one.'),
    go('Sit on it and rest', [{ k: 'heal', pct: 0.15 }], 'A good sit. You heal 15%.')),
  scene('stones', 3, 'Stepping stones cross the river, slippery with moss.',
    risk('Hop across (50/50)', 0.5, [{ k: 'stat', stat: 'dodge', v: 0.03 }], 'Hop, hop, hop! +3% dodge.', [{ k: 'hurt', pct: 0.08 }], 'Plop. A cold, damp chinchilla.'),
    go('Follow the bank', [], 'A gentle walk along the water.')),
  scene('raft', 3, 'A little raft is tied to a willow.',
    go('Float downstream', [{ k: 'acorns', n: 10 }], 'Wheee! You spot acorns on the shore.'),
    go('Fish for supper', [{ k: 'heal', pct: 0.2 }], 'A pawful of watercress. You heal 20%.')),
  scene('snowball', 4, '{other} pops up from behind a snowdrift with a snowball.',
    go('Snowball fight!', [{ k: 'stat', stat: 'atk', v: 0.05 }], 'Great aim! +5% attack.'),
    go('Build a snow chinchilla', [{ k: 'heal', pct: 0.1 }], 'It looks just like you. You heal 10%.')),
  scene('hotspring', 4, 'Steam rises from a hot spring between the rocks.',
    go('Soak', [{ k: 'heal', pct: 0.35 }], 'Toasty. You heal 35%.'),
    go('Just warm your paws', [{ k: 'stat', stat: 'hp', v: 0.05 }], 'Warm paws, brave heart. +5% max HP.')),
  scene('fireflies', 5, 'Fireflies drift between the trees, blinking in patterns.',
    risk('Follow them (50/50)', 0.5, [{ k: 'cache' }], 'They lead you to a mossy book of tricks.', [{ k: 'hurt', pct: 0.05 }], 'They lead you in a circle. Dizzy!'),
    go('Watch them dance', [{ k: 'heal', pct: 0.15 }], 'So pretty. You heal 15%.')),
  scene('moonpool', 5, 'A still pool holds the whole moon.',
    go('Make a wish', [{ k: 'stat', stat: 'crit', v: 0.04 }], 'The moon winks. +4% crit.'),
    go('Have a drink', [{ k: 'heal', pct: 0.2 }], 'Cool and clear. You heal 20%.')),
];

// ── Gear ───────────────────────────────────────────────────────────────────

export type GearSlot = 'hat' | 'scarf' | 'charm' | 'boots';
export type Rarity = 0 | 1 | 2 | 3 | 4;
export const GEAR_SLOTS: GearSlot[] = ['hat', 'scarf', 'charm', 'boots'];
export const RARITY = ['Plain', 'Fine', 'Rare', 'Grand', 'Legend'] as const;
/** Hat: max HP. Scarf: attack. Charm: crit chance. Boots: dodge. */
export const GEAR_STAT: Record<GearSlot, [number, number, number, number, number]> = {
  hat: [10, 20, 35, 55, 80], scarf: [1, 2, 4, 6, 9], charm: [0.02, 0.04, 0.06, 0.09, 0.12], boots: [0.01, 0.02, 0.04, 0.06, 0.08],
};

// ── Tuning ─────────────────────────────────────────────────────────────────

export const CHAPTER_SCALE = [1, 1.5, 2.2, 3.1, 4.3];
export const DAY_SCALE = 0.045;
/** Experience from level `level` to the next. */
export const xpNeed = (level: number) => 2 + Math.floor(level / 4);
export const FIGHT_XP: Record<Rank, number> = { foe: 3, elite: 8, boss: 0 };
/** Acorns per win, times the chapter. */
export const FIGHT_ACORNS: Record<Rank, number> = { foe: 3, elite: 12, boss: 30 };
/** The Pedlar's prices, times the chapter. */
export const PEDLAR_PRICE = { snack: 15, card: 25, charm: 30 };
export const trainCost = (level: number) => 20 + 10 * level;
export const TRAIN_STEP = { atk: 1, hp: 10 };

// Jade Street: the story. The Kaypoh Crows swiped the quarter's five lucky heirlooms; twenty-five jobs from the
// shopkeepers, five chapters, each ending in a chase for one heirloom that clears the fog from the next district.
// Missions are lists of steps the runner in lib/jade-mission.ts understands; `cp` marks a checkpoint (a failed step
// restarts from the last one). Places are names from lib/jade-city.ts or [tileX, tileY] pairs. 'hero' in a line is
// whoever you are playing (Dora or Enzo) and 'mate' is the other one, your partner.
import type { District } from './jade-city.js';
import type { VehicleKind } from './jade-move.js';
import type { Good } from './jade-trade.js';

export type Spot = string | [number, number];
/** a portrait expression per line: 'calm' is the character's usual portrait, the others are painted moods */
export type Mood = 'calm' | 'happy' | 'worried' | 'cross' | 'smug';
export const MOODS: Mood[] = ['calm', 'happy', 'worried', 'cross', 'smug'];
export type Line = [string, string, Mood?];
/** the chase set pieces: a stall the cart smashes, drums rolling off the temple steps, the canal drawbridge, the dock
 * crane's swinging container and the yard gate (lib/jade-setpiece.ts); `wp` is the route leg that triggers it */
export type SetDef = { k: 'stall' | 'drums' | 'bridge' | 'crane' | 'gate'; at: [number, number]; wp: number };
export type Step =
  | { t: 'talk'; lines: Line[]; cp?: boolean }
  | { t: 'goto'; at: Spot; label: string; r?: number; ride?: VehicleKind | 'foot'; time?: number; cp?: boolean }
  | { t: 'ride'; kind: VehicleKind; label: string; near?: Spot; locked?: boolean; cp?: boolean }
  | { t: 'pickup'; at: Spot; item: string; label: string; cp?: boolean }
  | { t: 'deliver'; to: Spot; time: number; label: string; item: string; fragile?: number; cp?: boolean }
  | { t: 'mini'; kind: MiniKind; level: number; label: string; cp?: boolean }
  /** `finish`: the last bump must be a double pounce (both heroes within a moment), the passenger's grab, or a net */
  | { t: 'chase'; who: 'cart' | 'boat' | 'boss' | 'runner'; from: Spot; route: Spot[]; bumps: number; loot: string; label: string; speed: number; sets?: SetDef[]; phase?: 1 | 2; finish?: 'pounce' | 'snatch' | 'net'; cp?: boolean }
  /** `rope`: the float only swings in under the flags while the partner hauls the bunting rope there */
  | { t: 'float'; label: string; rope?: Spot; cp?: boolean }
  | { t: 'raid'; at: Spot; n: number; label: string; cp?: boolean }
  /** `relay`: from waypoint `at` on, the hero who started is easy for Pip to spot; the partner waits at `spot` */
  | { t: 'tail'; from: Spot; route: Spot[]; label: string; relay?: { at: number; spot: Spot }; cp?: boolean }
  /** `flanks`: crows come in pairs from both sides and the partner guards the far flank */
  | { t: 'escort'; from: Spot; route: Spot[]; label: string; crows: number; flanks?: boolean; cp?: boolean }
  /** `relay`: the marks from this one on count only for the partner waiting there (a hand-off) */
  | { t: 'race'; marks: Spot[]; label: string; rival?: 'runner' | 'scooter' | 'boat'; roof?: boolean; time?: number; ride?: VehicleKind | 'foot'; relay?: number; cp?: boolean }
  /** `shutter`: the goal's shutter is down unless the partner holds its lever there */
  | { t: 'stealth'; lookouts: Spot[][]; goal: Spot; exit: Spot; label: string; shutter?: Spot; cp?: boolean }
  /** `high`: up on balconies, reached only by the passenger's grab or a gadget; `watch`: a window lookout there */
  | { t: 'collect'; items: Spot[]; item: string; time: number; label: string; high?: boolean; watch?: [number, number]; cp?: boolean }
  | { t: 'heat'; level: number; label: string; cp?: boolean }
  | { t: 'trade'; profit: number; label: string; time?: number; cp?: boolean }
  | { t: 'fares'; n: number; label: string; cp?: boolean }
  /** the partner is sent somewhere (to wait, hold or guard); `wait` holds the job until they are there */
  | { t: 'post'; at: Spot; mode?: 'post' | 'hold' | 'guard' | 'stay'; wait?: boolean; label: string; cp?: boolean }
  /** take control of the other hero (Tab) */
  | { t: 'switch'; label: string; cp?: boolean }
  /** the partner holds the lever (F near it) while you go through the gate tiles it opens */
  | { t: 'hold'; lever: Spot; gate: [number, number][]; through: Spot; r?: number; time?: number; label: string; cp?: boolean }
  /** give the partner a boost onto the roof at boost spot `at` (lib/jade-tag.ts BOOSTS) */
  | { t: 'boost'; at: number; label: string; cp?: boolean }
  /** a crow circles with a loot bag: knock it loose with a gadget, or pounce when it swoops low */
  | { t: 'bag'; at: Spot; loot?: string; time?: number; label: string; cp?: boolean };
export type MiniKind = 'lock' | 'wires' | 'wok' | 'dumpling' | 'haggle' | 'kopi';
export type Mission = { id: string; ch: number; title: string; giver: string; at: string; blurb: string; reward: number; rep: number; steps: Step[]; tip?: { market: District; good: Good; mult: number } };

export const PEOPLE: Record<string, { name: string; face: string; who: string }> = {
  kee: { name: 'Uncle Kee', face: 'face-kee', who: 'tortoise grocer' },
  tock: { name: 'Tock', face: 'face-tock', who: 'mole toymaker' },
  mo: { name: 'Chef Mo', face: 'face-mo', who: 'otter chef' },
  pang: { name: 'Auntie Pang', face: 'face-pang', who: 'pangolin trader' },
  heron: { name: 'Brother Heron', face: 'face-heron', who: 'temple keeper' },
  ren: { name: 'Master Ren', face: 'face-ren', who: 'lion-dance master' },
  kiri: { name: 'Kiri', face: 'face-kiri', who: 'bumboat captain' },
  lim: { name: 'Mr Lim', face: 'face-lim', who: 'news-stand mynah' },
  bo: { name: 'Big Bo', face: 'face-bo', who: 'dock foreman' },
  bristle: { name: 'Captain Bristle', face: 'face-bristle', who: 'chief warden' },
  hoon: { name: 'Auntie Hoon', face: 'face-hoon', who: 'chicken-rice goose auntie' },
  teo: { name: 'Uncle Teo', face: 'face-teo', who: 'kopi uncle (a sun bear)' },
  beng: { name: 'Ah Beng', face: 'face-beng', who: 'char kway teow rooster' },
  ong: { name: 'Mr Ong', face: 'face-ong', who: 'karang guni man (a badger)' },
  lily: { name: 'Lily Sparkle', face: 'face-lily', who: 'getai singer (a peacock)' },
  goh: { name: 'Uncle Goh', face: 'face-goh', who: 'void-deck chess uncle (a macaque)' },
  sleek: { name: 'Ma Sleek', face: 'face-sleek', who: 'Riverside Romp otter boss' },
  kow: { name: 'Big Kow', face: 'face-kow', who: 'Bukit Bunch macaque boss' },
  gizmo: { name: 'Gizmo', face: 'face-gizmo', who: 'arcade DJ' },
  glint: { name: 'Madame Glint', face: 'face-glint', who: 'Kaypoh Crows boss' },
  pip: { name: 'Pip', face: 'face-pip', who: 'Kaypoh Crows rookie' },
  dora: { name: 'Dora', face: 'face-dora', who: 'you' },
  enzo: { name: 'Enzo', face: 'face-enzo', who: 'you' },
};
export const HEIRLOOMS = [
  { id: 'dragon', name: 'Jade Dragon', sprite: 'h-dragon', ch: 1 },
  { id: 'bell', name: 'Golden Bell', sprite: 'h-bell', ch: 2 },
  { id: 'lantern', name: 'Pearl Lantern', sprite: 'h-lantern', ch: 3 },
  { id: 'koi', name: 'Silver Koi', sprite: 'h-koi', ch: 4 },
  { id: 'drum', name: 'Phoenix Drum', sprite: 'h-drum', ch: 5 },
] as const;
/** which district each chapter's finale opens (chapter 1 is played in Smith Street) */
export const CHAPTER_OPENS: District[] = ['temple', 'canal', 'docks', 'arcade'];
export const CHAPTERS = ['Smith Street', 'Temple Street', 'Boat Quay', 'Tanjong Pagar Docks', 'Clarke Quay'];

// road crossings by name: X(v, h) is the lane tile where vertical road v meets horizontal road h
const V = { a: 10, b: 26, c: 42, d: 60, e: 71, f: 90, g: 106 } as const;
const Hh = { n: 12, m: 30, s: 46, d: 62, x: 22 } as const;
const X = (v: keyof typeof V, h: keyof typeof Hh): [number, number] => [V[v] + 2, Hh[h] + 2];

export const MISSIONS: Mission[] = [
  // ── Chapter 1: Smith Street (Jade Dragon)
  { id: 'm1', ch: 1, title: 'Opening Night', giver: 'kee', at: 'kee', reward: 60, rep: 12, blurb: 'Help Uncle Kee get a crate of mangoes to Chef Mo.',
    steps: [
      { t: 'talk', lines: [['kee', 'Ah, hero! Good timing. The whole quarter is in a flap.', 'happy'], ['kee', 'The Kaypoh Crows swooped last night and took our five lucky heirlooms. Without them, no festival.', 'worried'], ['hero', 'Then we get them back. Where do we start?', 'smug'], ['mate', 'Together, like always. Two pairs of paws are faster than one.', 'happy'], ['kee', 'Start small. Chef Mo needs these mangoes for her stall, and my legs are slower than my stories.', 'calm']] },
      { t: 'pickup', at: [16, 44], item: 'crate', label: 'Pick up the crate of mangoes', cp: true },
      { t: 'ride', kind: 'scooter', near: [19, 45], locked: true, label: 'Get on the red scooter by the kerb' },
      { t: 'deliver', to: 'mo', time: 75, fragile: 8, item: 'crate', label: 'Ride the mangoes to Chef Mo before they bruise' },
      { t: 'talk', lines: [['mo', 'Mangoes! You are a lifesaver. Hop off and say hi properly.', 'happy'], ['mo', 'A crow has been circling my wok all night. Something tells me we will be busy.', 'worried']] },
    ] },
  { id: 'm2', ch: 1, title: 'Hot Wok, Cold Trail', giver: 'mo', at: 'mo', reward: 80, rep: 12, blurb: 'Cook for Chef Mo’s queue, then catch the tip-jar thief.',
    steps: [
      { t: 'talk', lines: [['mo', 'The queue is round the corner! Grab a wok. Catch what the order needs, toss before it scorches.', 'calm'], ['hero', 'How hard can it be?', 'smug']] },
      { t: 'mini', kind: 'wok', level: 1, label: 'Cook the order', cp: true },
      { t: 'talk', lines: [['mo', 'Hey! That crow just pinched my tip jar!', 'cross'], ['pip', 'Finders keepers, fluffballs!', 'smug'], ['mate', 'He’s too slippery for one of us. Pounce together: I dive, you dash!', 'cross']] },
      { t: 'chase', who: 'runner', from: [34, 74], route: [[41, 76], [40, 66], [28, 66], [28, 76]], bumps: 2, loot: 'coins', speed: 205, finish: 'pounce', label: 'Pounce on Pip together: F sends {mate} in, then dash into him', cp: true },
      { t: 'pickup', at: 'loot', item: 'coins', label: 'Grab the tip jar' },
      { t: 'goto', at: 'mo', label: 'Bring the jar back to Chef Mo' },
      { t: 'talk', lines: [['mo', 'My hero. That little one called himself Pip. He’ll be back.', 'happy']] },
    ] },
  { id: 'm3', ch: 1, title: 'Whistle Stop', giver: 'kee', at: 'kee', reward: 90, rep: 12, blurb: 'Knock over the crows’ lookout crates, then shake off the wardens.',
    steps: [
      { t: 'talk', lines: [['kee', 'The crows stack crates by the market to spy from. Knock them down!', 'cross'], ['kee', 'Mind you, the raccoon wardens hate a mess. Lanterns light up when you make trouble.', 'worried'], ['hero', 'And then?', 'calm'], ['kee', 'Then you lose them. Alleys, a bead curtain, or a quick jacket swap at your safe house.', 'smug']] },
      { t: 'talk', lines: [['mate', 'Those crates are up on the balconies. You drive, I’ll ride behind and knock them off!', 'smug']] },
      { t: 'ride', kind: 'scooter', near: [19, 45], label: 'Get on a scooter ({mate} hops on behind)' },
      { t: 'collect', items: [[24, 63], [14, 64], [4, 48]], item: 'lookout', time: 70, high: true, label: 'Ride under each balcony crate and press F: {mate} knocks it down', cp: true },
      { t: 'heat', level: 2, label: 'Lose the wardens: break their line of sight or hide' },
      { t: 'goto', at: 'kee', label: 'Report back to Uncle Kee' },
      { t: 'talk', lines: [['kee', 'Ha! Captain Bristle will be chewing his moustache. Well done.', 'happy'], ['kee', 'Here, toys from my nephew Tock’s stall: a slingshot of sticky-rice balls and a paint squirter. Crows hate a sticky beak.', 'smug'], ['mate', 'Festival toys! Click to fire, 1 and 2 to swap. Wardens don’t like being splatted, mind.', 'happy']] },
    ] },
  { id: 'm4', ch: 1, title: 'Shadow the Feathers', giver: 'mo', at: 'mo', reward: 100, rep: 14, blurb: 'Tail Pip to the Crow hideout without being spotted.',
    steps: [
      { t: 'talk', lines: [['mo', 'Pip is back, strutting about with a sack. Follow him, but not too close.', 'worried'], ['mo', 'Hold the walk button to sneak. If he turns round, duck behind something.', 'calm'], ['mate', 'He’ll know your face after a while. I’ll wait at the corner by the lanterns and take over from there.', 'smug']] },
      { t: 'tail', from: [30, 64], route: [[28, 58], [28, 48], [20, 48], [12, 48], [12, 36], [2, 36]], relay: { at: 3, spot: [14, 44] }, label: 'Follow Pip, but stay out of sight; switch to {mate} at the corner (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'A painted door in a back yard. That’s the hideout.', 'smug'], ['mo', 'Brilliant. Tell Uncle Kee, he has an idea about doors.', 'happy']] },
    ] },
  { id: 'm5', ch: 1, title: 'The Jade Dragon', giver: 'kee', at: 'kee', reward: 250, rep: 20, blurb: 'Open the hideout and chase down the Jade Dragon.',
    steps: [
      { t: 'talk', lines: [['kee', 'I was a locksmith before I was a grocer. Here, take my old hairpin.', 'smug'], ['kee', 'Feel each pin. When it glows, let go.', 'calm']] },
      { t: 'goto', at: [2, 37], label: 'Go to the hideout door', ride: 'foot', cp: true },
      { t: 'mini', kind: 'lock', level: 1, label: 'Pick the lock' },
      { t: 'talk', lines: [['pip', 'Eek! Boss said nobody finds this place!', 'worried'], ['hero', 'That’s the Jade Dragon on his cart!', 'cross']] },
      { t: 'ride', kind: 'scooter', near: [4, 36], label: 'Jump on the scooter' },
      { t: 'talk', lines: [['mate', 'Get me alongside after a couple of bumps and I’ll snatch the Dragon right off his cart!', 'smug']] },
      { t: 'chase', who: 'cart', from: X('a', 'm'), route: [X('a', 's'), X('b', 's'), X('b', 'd'), X('c', 'd'), X('c', 'm'), X('a', 'm')], bumps: 3, loot: 'h-dragon', speed: 250, finish: 'snatch', label: 'Bump Pip’s cart twice, then ride alongside: F and {mate} grabs the Dragon', sets: [{ k: 'stall', at: [24, 50], wp: 2 }], cp: true },
      { t: 'pickup', at: 'loot', item: 'h-dragon', label: 'Grab the Jade Dragon' },
      { t: 'goto', at: 'kee', label: 'Take the Jade Dragon to Uncle Kee' },
      { t: 'talk', lines: [['kee', 'The Jade Dragon! Smith Street will sleep easy tonight.', 'happy'], ['kee', 'The fog over Temple Street is lifting. Brother Heron rang to say the Golden Bell is gone too.', 'worried']] },
    ] },
  // ── Chapter 2: Temple Street (Golden Bell)
  { id: 'm6', ch: 2, title: 'Auntie’s Tea Run', giver: 'pang', at: 'pang', reward: 90, rep: 12, blurb: 'Learn to trade: buy tea on Temple Street, sell it in Smith Street.', tip: { market: 'market', good: 'tea', mult: 1.35 },
    steps: [
      { t: 'talk', lines: [['pang', 'So you are the one chasing crows. Chasing costs money, dear.', 'smug'], ['pang', 'Tea is cheap up here and dear in Smith Street tonight. Buy low, sell high.', 'calm'], ['pang', 'And haggle! Stop the needle in the middle and I’ll knock some off. Gently.', 'smug']] },
      { t: 'trade', profit: 40, time: 200, label: 'Make 40 coins profit before the tea goes stale (Temple Street → Smith Street)', cp: true },
      { t: 'goto', at: 'pang', label: 'Tell Auntie Pang how it went' },
      { t: 'talk', lines: [['pang', 'A natural! Your stall-keeper rep is growing. Better prices for you now.', 'happy']] },
    ] },
  { id: 'm7', ch: 2, title: 'The Hundred Steps', giver: 'heron', at: 'heron', reward: 110, rep: 14, blurb: 'Race a crow up the temple path on foot.',
    steps: [
      { t: 'talk', lines: [['heron', 'Peace, little one. A crow boasts it can beat anyone to the top of the hill.', 'calm'], ['heron', 'Wheels are not allowed on the steps. Hop the hedges, dash the paths.', 'smug']] },
      { t: 'race', ride: 'foot', rival: 'runner', marks: [[36, 14], [37, 10], [26, 9], [11, 9], [11, 3], [19, 7]], label: 'Beat the crow to the temple', cp: true },
      { t: 'talk', lines: [['heron', 'Swift feet. The crow muttered something about the bell being taken down the hill tonight.', 'worried']] },
    ] },
  { id: 'm8', ch: 2, title: 'The Lion Wakes', giver: 'ren', at: 'ren', reward: 130, rep: 14, blurb: 'Escort the lion-dance troupe and shoo the crows.',
    steps: [
      { t: 'talk', lines: [['ren', 'My lion dances to the market square for luck. The crows want its red envelopes.', 'calm'], ['ren', 'Stay close. Dash into any crow that swoops in. A gentle bump sends them packing.', 'calm'], ['mate', 'They’ll come from both sides. I’ll guard the far flank, you take the near one!', 'smug']] },
      { t: 'escort', from: [17, 20], route: [[18, 26], [18, 32], [22, 32], [22, 44], [20, 48], [20, 50]], crows: 6, flanks: true, label: 'Keep the crows off the lion dance ({mate} guards the far side)', cp: true },
      { t: 'talk', lines: [['ren', 'Wonderful! The lion bows to you both. Here, a box of party poppers for the festival.', 'happy'], ['mate', 'Lob one and the sparks stun everything close. Perfect for crow traffic jams.', 'happy']] },
    ] },
  { id: 'm9', ch: 2, title: 'Wedding Cake Weather', giver: 'mo', at: 'mo', reward: 150, rep: 14, blurb: 'Rush a melting wedding cake up to the temple.',
    steps: [
      { t: 'talk', lines: [['mo', 'A wedding at the temple and the cake is MELTING. Take my van, it has the cool box.', 'worried'], ['mo', 'Smooth driving! Every bump wobbles it.', 'cross']] },
      { t: 'ride', kind: 'van', near: [35, 64], label: 'Get in Chef Mo’s van' },
      { t: 'pickup', at: [34, 65], item: 'cake', label: 'Load the wedding cake', cp: true },
      { t: 'deliver', to: 'temple-steps', time: 80, fragile: 6, item: 'cake', label: 'Deliver the cake before it melts (gently!)' },
      { t: 'talk', lines: [['heron', 'A perfect cake. The bride is crying happy tears.', 'happy']] },
    ] },
  { id: 'm10', ch: 2, title: 'The Golden Bell', giver: 'heron', at: 'heron', reward: 300, rep: 20, blurb: 'Chase the cart carrying the Golden Bell down Temple Street.',
    steps: [
      { t: 'talk', lines: [['heron', 'There! The cart with the Golden Bell, rolling down the hill road!', 'worried'], ['hero', 'Not on my watch.', 'cross']] },
      { t: 'ride', kind: 'scooter', near: [35, 14], label: 'Grab a scooter', cp: true },
      { t: 'chase', who: 'cart', from: X('b', 'n'), route: [X('a', 'n'), X('a', 'm'), X('c', 'm'), X('c', 'n'), X('b', 'n')], bumps: 3, loot: '', speed: 265, label: 'Bump the bell cart three times', sets: [{ k: 'drums', at: [19, 13], wp: 0 }], cp: true },
      { t: 'talk', lines: [['mate', 'The bell’s in a bag and a crow’s got it! Up there, circling!', 'worried'], ['hero', 'Knock it loose with a shot, or catch it when it swoops low!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'h-bell', time: 60, label: 'Knock the loot bag out of the crow’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-bell', label: 'Grab the Golden Bell' },
      { t: 'goto', at: 'heron', label: 'Return the bell to Brother Heron' },
      { t: 'talk', lines: [['heron', 'It rings again! Listen.', 'happy'], ['heron', 'The canal folk say a pearl glow was seen on a crow boat. The Boat Quay is open to you.', 'calm']] },
    ] },
  // ── Chapter 3: Boat Quay (Pearl Lantern)
  { id: 'm11', ch: 3, title: 'Learn the Water', giver: 'kiri', at: 'kiri', reward: 110, rep: 12, blurb: 'Take a bumboat through Kiri’s course.',
    steps: [
      { t: 'talk', lines: [['kiri', 'Ever steered a boat? It’s like a scooter that’s had a big lunch.', 'smug'], ['kiri', 'Through my lantern gates and back, before the tide turns.', 'calm']] },
      { t: 'ride', kind: 'boat', near: 'jetty', label: 'Step into the bumboat', cp: true },
      { t: 'race', ride: 'boat', time: 59, marks: [[67, 32], [67, 46], [67, 58], [67, 40], [67, 14], [67, 26]], label: 'Steer through every lantern gate' },
      { t: 'talk', lines: [['kiri', 'Not bad! You only scared three ducks.', 'happy'], ['kiri', 'Take my bubble blower. Wardens slip on the soapy puddles, and crows hate wet feathers.', 'smug']] },
    ] },
  { id: 'm12', ch: 3, title: 'Dumpling Disguise', giver: 'mo', at: 'lim', reward: 130, rep: 14, blurb: 'Fold dumplings as cover, then follow the crow courier.',
    steps: [
      { t: 'talk', lines: [['lim', 'Psst. Crows meet at the canal stall at midnight. Fold dumplings, look busy, listen.', 'smug'], ['hero', 'I can fold a dumpling. Probably.', 'worried']] },
      { t: 'goto', at: [52, 37], label: 'Go to the canal market stall', ride: 'foot', cp: true },
      { t: 'mini', kind: 'dumpling', level: 1, label: 'Fold dumplings and keep your ears open' },
      { t: 'talk', lines: [['pip', '…the lantern goes by boat at dawn…', 'smug'], ['hero', 'Got it. Now to follow that courier.', 'smug']] },
      { t: 'tail', from: [52, 40], route: [[56, 41], [58, 46], [58, 52], [50, 52], [47, 56], [47, 60]], label: 'Follow the courier without being seen', cp: true },
      { t: 'talk', lines: [['lim', 'A boathouse! I’ll let Kiri know.', 'happy']] },
    ] },
  { id: 'm13', ch: 3, title: 'Hot Tip', giver: 'lim', at: 'lim', reward: 150, rep: 14, blurb: 'Use Mr Lim’s tip: porcelain is cheap on Canal Row and dear at the temple tonight.', tip: { market: 'temple', good: 'bowl', mult: 1.5 },
    steps: [
      { t: 'talk', lines: [['lim', 'Tip of the night: the temple’s caretakers smashed their bowls. They’ll pay double.', 'smug'], ['lim', 'Canal Row has porcelain going cheap. A bigger ride carries more!', 'calm']] },
      { t: 'trade', profit: 120, time: 240, label: 'Make 120 coins profit before the temple buys elsewhere (Canal Row → Temple Street)', cp: true },
      { t: 'goto', at: 'lim', label: 'Tell Mr Lim' },
      { t: 'talk', lines: [['lim', 'Read all about it: young chinchilla makes a killing!', 'happy']] },
    ] },
  { id: 'm14', ch: 3, title: 'Wobbly Cargo', giver: 'kiri', at: 'kiri', reward: 160, rep: 14, blurb: 'Pedal a tower of clay pots over the canal bridges without a crash.',
    steps: [
      { t: 'talk', lines: [['kiri', 'My cousin’s pots need to get to Smith Street square. A trishaw rides smoothest.', 'calm'], ['kiri', 'Six bumps and they’re shards. Slow round the corners!', 'worried']] },
      { t: 'ride', kind: 'trishaw', near: [62, 22], label: 'Get on the trishaw', cp: true },
      { t: 'pickup', at: [63, 25], item: 'pots', label: 'Load the pots' },
      { t: 'deliver', to: 'mk-market', time: 110, fragile: 4, item: 'pots', label: 'Deliver the pots in one piece' },
      { t: 'talk', lines: [['kiri', 'Not a crack! You have gentle paws.', 'happy']] },
    ] },
  { id: 'm15', ch: 3, title: 'The Pearl Lantern', giver: 'kiri', at: 'kiri', reward: 350, rep: 20, blurb: 'Boat chase down the canal after the Pearl Lantern.',
    steps: [
      { t: 'talk', lines: [['kiri', 'There’s the crow boat, pearl glow and all! It slipped through the lock gate!', 'cross'], ['mate', 'The lever on the bank holds the gate open. I’ll hang on to it, you take the boat through!', 'smug']] },
      { t: 'ride', kind: 'boat', near: 'jetty', label: 'Jump into the boat', cp: true },
      { t: 'hold', lever: [65, 26], gate: [[66, 27], [67, 27], [68, 27]], through: [67, 29], r: 80, label: 'Get {mate} on the lock lever (F), then steer through the gate: Through the lock gate before it shuts!' },
      { t: 'chase', who: 'boat', from: [67, 30], route: [[67, 58], [67, 20], [67, 50], [67, 6]], bumps: 3, loot: 'h-lantern', speed: 225, label: 'Bump the crow boat three times', sets: [{ k: 'bridge', at: [67, 44], wp: 0 }], cp: true },
      { t: 'pickup', at: 'loot', item: 'h-lantern', label: 'Fish out the Pearl Lantern' },
      { t: 'goto', at: 'kiri', label: 'Bring the lantern to Kiri' },
      { t: 'talk', lines: [['kiri', 'It glows like a moon on the water. Thank you.', 'happy'], ['kiri', 'Big Bo at the Tanjong Pagar Docks says a silver fish was loaded into a crow crate. The Docks are open!', 'calm']] },
    ] },
  // ── Chapter 4: the Tanjong Pagar Docks (Silver Koi)
  { id: 'm16', ch: 4, title: 'Night Shift', giver: 'bo', at: 'bo', reward: 140, rep: 12, blurb: 'Ferry three dock workers home in a tuk-tuk.',
    steps: [
      { t: 'talk', lines: [['bo', 'Welcome to the Tanjong Pagar Docks, small one. My crew’s bus is broken and they’re sleepy.', 'calm'], ['bo', 'Grab that tuk-tuk. Pick them up, drop them home, three fares.', 'happy']] },
      { t: 'ride', kind: 'tuktuk', near: [56, 64], label: 'Get in the tuk-tuk', cp: true },
      { t: 'fares', n: 3, label: 'Drive three dock workers home' },
      { t: 'talk', lines: [['bo', 'They’re singing your name. Badly, but warmly.', 'happy'], ['bo', 'Take this net launcher. Built it for crabs; works on carts.', 'smug']] },
    ] },
  { id: 'm17', ch: 4, title: 'Container Maze', giver: 'bo', at: 'bo', reward: 180, rep: 14, blurb: 'Sneak through the container yard and pinch the shipping list.',
    steps: [
      { t: 'talk', lines: [['bo', 'The crows run the container yard at night. Their shipping list is in the yard office.', 'worried'], ['bo', 'Lookouts everywhere. Keep out of their torch beams. Sneak, wait, go.', 'cross']] },
      { t: 'goto', at: 'yard-gate', label: 'Go to the yard gate', ride: 'foot', cp: true },
      { t: 'talk', lines: [['mate', 'The office shutter is down. I’ll sneak round the back and hold its lever; you slip in and grab the list.', 'smug']] },
      { t: 'stealth', lookouts: [[[99, 69], [103, 69], [103, 72], [99, 72]], [[106, 72], [112, 72], [112, 73], [106, 73]], [[99, 77], [108, 77]], [[113, 76], [113, 80], [118, 80]]], goal: 'manifest', exit: 'yard-gate', shutter: [114, 66], label: 'Send {mate} to the shutter (F), reach the office unseen, take the list, get out' },
      { t: 'talk', lines: [['bo', 'The Silver Koi ships at dawn in crate eleven. We’ll be ready.', 'smug']] },
    ] },
  { id: 'm18', ch: 4, title: 'Hot Goods', giver: 'bristle', at: 'bo', reward: 160, rep: 14, blurb: 'The crows framed you. Lose five lanterns of heat.',
    steps: [
      { t: 'talk', lines: [['bristle', 'Halt! A report says a chinchilla has been bumping my crates. Wardens, after them!', 'cross'], ['hero', 'That was the crows!', 'worried'], ['bo', 'Run, little one! Lose them, then we sort it out.', 'worried']] },
      { t: 'heat', level: 5, label: 'Lose all five lanterns of heat', cp: true },
      { t: 'goto', at: 'bo', label: 'Sneak back to Big Bo' },
      { t: 'talk', lines: [['bristle', 'Hmph. Big Bo vouches for you. Mind my crates.', 'cross'], ['bo', 'He likes you really.', 'smug']] },
    ] },
  { id: 'm19', ch: 4, title: 'Jump-Start Jamboree', giver: 'bo', at: 'bo', reward: 170, rep: 14, blurb: 'Crows cut the dock scooters’ wires. Fix two and ride them to the garage.',
    steps: [
      { t: 'talk', lines: [['bo', 'Snip, snip, the crows cut every scooter’s wires. Match the colours, she’ll start.', 'cross'], ['mate', 'Two scooters, two of us. I’ll wait by the second one; switch to me when yours is in.', 'smug']] },
      { t: 'post', at: [75, 65], mode: 'stay', label: '{mate} heads for the second scooter' },
      { t: 'ride', kind: 'scooter', near: [58, 68], locked: true, label: 'Jump-start the first scooter', cp: true },
      { t: 'goto', at: [57, 79], label: 'Ride it to the Tide Shed before the jump-start fades', r: 120, time: 40 },
      { t: 'switch', label: 'Switch to {mate}, waiting by the second scooter (Tab)', cp: true },
      { t: 'ride', kind: 'scooter', near: [76, 66], locked: true, label: 'Jump-start the second scooter' },
      { t: 'goto', at: [57, 79], label: 'Ride it to the Tide Shed before the jump-start fades', r: 120, time: 40 },
      { t: 'talk', lines: [['bo', 'Purring like kittens. You’re handy!', 'happy']] },
    ] },
  { id: 'm20', ch: 4, title: 'The Silver Koi', giver: 'bo', at: 'bo', reward: 400, rep: 20, blurb: 'Chase crate eleven through the docks.',
    steps: [
      { t: 'talk', lines: [['bo', 'Crate eleven is on that crow cart! Go go go!', 'cross']] },
      { t: 'ride', kind: 'scooter', near: [53, 64], label: 'Grab a scooter', cp: true },
      { t: 'talk', lines: [['mate', 'Bump it twice, then I’ll net it from the back seat. Or get me alongside and I’ll grab the crate!', 'smug']] },
      { t: 'chase', who: 'cart', from: X('d', 'd'), route: [X('e', 'd'), X('f', 'd'), [92, 78], X('f', 'd'), [74, 78], X('d', 'd')], bumps: 3, loot: 'h-koi', speed: 275, finish: 'net', label: 'Bump the cart twice, then net it (click) or ride alongside for {mate}’s grab (F)', sets: [{ k: 'crane', at: [92, 71], wp: 2 }, { k: 'gate', at: [92, 74], wp: 2 }], cp: true },
      { t: 'pickup', at: 'loot', item: 'h-koi', label: 'Catch the Silver Koi' },
      { t: 'goto', at: 'bo', label: 'Bring it to Big Bo' },
      { t: 'talk', lines: [['bo', 'Shiny! Now the last one. The Phoenix Drum is in Madame Glint’s roost, up Clarke Quay.', 'happy'], ['bo', 'The neon lights are on for you.', 'smug']] },
    ] },
  // ── Chapter 5: Clarke Quay (Phoenix Drum)
  { id: 'm21', ch: 5, title: 'Neon Night Race', giver: 'gizmo', at: 'gizmo', reward: 180, rep: 14, blurb: 'Beat a crow racer round the Strip on a scooter.',
    steps: [
      { t: 'talk', lines: [['gizmo', 'Yo yo! A crow racer says no chinchilla can beat him round the Strip.', 'smug'], ['gizmo', 'Prove him wrong and I’ll tell you how to get into the Roost.', 'calm']] },
      { t: 'ride', kind: 'scooter', near: [100, 25], label: 'Hop on a scooter', cp: true },
      { t: 'race', ride: 'scooter', rival: 'scooter', marks: [X('g', 'x'), X('g', 's'), X('f', 's'), X('f', 'm'), X('e', 'm'), X('e', 'x'), X('f', 'x'), [100, 24]], label: 'Win the race' },
      { t: 'talk', lines: [['gizmo', 'Legendary! The Roost has a back way: across the rooftops.', 'happy'], ['gizmo', 'And take my confetti cannon. One blast scatters a whole flock. Party trick!', 'smug']] },
    ] },
  { id: 'm22', ch: 5, title: 'Rooftop Relay', giver: 'gizmo', at: 'gizmo', reward: 200, rep: 14, blurb: 'Run the flat roofs, hopping the gaps, before time runs out.',
    steps: [
      { t: 'talk', lines: [['gizmo', 'A relay across the flat roofs! One of you runs the first leg, the other takes the baton halfway.', 'calm'], ['mate', 'Give me a leg-up by the crates on the wall, then climb the ladder and run to me!', 'smug']] },
      { t: 'goto', at: [93, 39], label: 'Go to the crates against the roof wall', ride: 'foot', cp: true },
      { t: 'boost', at: 0, label: 'Boost {mate} onto the roof (F by the crates)' },
      { t: 'goto', at: [93, 44], label: 'Climb the ladder by the noodle bar', ride: 'foot' },
      { t: 'race', ride: 'foot', roof: true, time: 52, relay: 5, marks: [[95, 43], [99, 43], [103, 43], [103, 39], [99, 39], [95, 39], [95, 35], [99, 35], [104, 35]], label: 'Hop across every roof marker; hand the baton to {mate} halfway' },
      { t: 'talk', lines: [['gizmo', 'You’re basically a bird. A fluffy one.', 'happy']] },
    ] },
  { id: 'm23', ch: 5, title: 'Crack the Claw', giver: 'gizmo', at: 'gizmo', reward: 220, rep: 14, blurb: 'Collect the crew passcodes hidden around the Strip.',
    steps: [
      { t: 'talk', lines: [['gizmo', 'The Roost door wants three passcode tokens. Crows stash them in claw machines.', 'calm']] },
      { t: 'talk', lines: [['mate', 'See that lit window over the claw machines? A lookout. Paint the glass, or I’ll go and pull faces at it.', 'smug']] },
      { t: 'collect', items: [[85, 33], [104, 48], [115, 27]], item: 'token', time: 80, watch: [104, 45], label: 'Collect the three tokens; paint the window lookout or send {mate} to distract it (F)', cp: true },
      { t: 'goto', at: [113, 57], label: 'Go to the Roost door', ride: 'foot' },
      { t: 'mini', kind: 'lock', level: 2, label: 'Pick the Roost lock' },
      { t: 'talk', lines: [['glint', 'Well, well. The fluffball found my door. Come and catch me, darling!', 'smug']] },
    ] },
  { id: 'm24', ch: 5, title: 'Lantern Parade', giver: 'ren', at: 'gizmo', reward: 240, rep: 14, blurb: 'Escort the lion dance down the neon boulevard.',
    steps: [
      { t: 'talk', lines: [['ren', 'The parade must go through the Strip for the festival to begin. The whole Crew is waiting.', 'worried'], ['hero', 'Let them try.', 'smug']] },
      { t: 'talk', lines: [['mate', 'Both flanks again. Confetti scatters a whole flock if they bunch up!', 'smug']] },
      { t: 'escort', from: [80, 24], route: [[88, 24], [96, 24], [104, 24], [112, 24], [116, 24]], crows: 8, flanks: true, label: 'Protect the lion dance ({mate} guards the far side)', cp: true },
      { t: 'talk', lines: [['ren', 'The Crew scatters! Only Madame Glint remains.', 'happy']] },
    ] },
  { id: 'm25', ch: 5, title: 'Glint’s Last Flight', giver: 'glint', at: 'gizmo', reward: 600, rep: 25, blurb: 'Catch Madame Glint and win back the Phoenix Drum.',
    steps: [
      { t: 'talk', lines: [['glint', 'You want the Phoenix Drum? Catch me if you can, on wheels!', 'smug'], ['hero', 'Here we go.', 'cross']] },
      { t: 'ride', kind: 'scooter', near: [110, 25], label: 'Get on a scooter', cp: true },
      { t: 'chase', who: 'boss', phase: 1, from: X('g', 'x'), route: [X('g', 's'), X('f', 's'), X('f', 'x'), X('g', 'x')], bumps: 2, loot: '', speed: 256, label: 'Bump the real Madame Glint twice (she sparkles gold; decoys don’t)', cp: true },
      { t: 'talk', lines: [['glint', 'Lucky bump! Mind the neon, darling. The signs on the Strip are ever so loose.', 'cross'], ['hero', 'Watch the shadows, dodge the signs.', 'smug']] },
      { t: 'chase', who: 'boss', phase: 2, from: X('f', 'm'), route: [X('e', 'm'), X('e', 'x'), X('g', 'x'), X('g', 'm')], bumps: 2, loot: '', speed: 260, label: 'Dodge the falling signs and bump her twice more', cp: true },
      { t: 'talk', lines: [['glint', 'Grr! To my float! Nobody catches a phoenix in flight!', 'cross'], ['hero', 'Then I’ll fly too. Up the fire ladder!', 'smug'], ['mate', 'The float rides too far out. I’ll haul the bunting rope and swing it in under the flags!', 'smug']] },
      { t: 'float', rope: [107, 32], label: 'Send {mate} to the bunting rope (F), climb the fire ladder and leap onto Glint’s float from a flag', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-drum', label: 'Take back the Phoenix Drum' },
      { t: 'talk', lines: [['glint', 'Fine, FINE. Shiny things are just so… shiny.', 'worried'], ['pip', 'Boss, maybe we could join the festival instead?', 'worried'], ['glint', '…With a nice seat near the lanterns?', 'smug'], ['kee', 'All five heirlooms home! Light the lanterns, the festival begins!', 'happy'], ['hero', 'Best night ever.', 'happy'], ['mate', 'Best team ever.', 'happy']] },
    ] },
];
export const MISSION = Object.fromEntries(MISSIONS.map(m => [m.id, m])) as Record<string, Mission>;

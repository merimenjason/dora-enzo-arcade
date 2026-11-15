// Jade Street: the story. The Kaypoh Crows swiped the quarter's five lucky heirlooms; jobs from the shopkeepers in
// chapters, the first five each ending in a chase for one heirloom that clears the fog from the next district, the
// sixth on the island. MISSIONS and SIDE are the only source of how many jobs there are (see jobCounts).
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
  /** `stink`: the cargo leaves a smell trail, and a warden who walks into it starts to wonder (heat, never a chase) */
  | { t: 'deliver'; to: Spot; time: number; label: string; item: string; fragile?: number; stink?: boolean; cp?: boolean }
  | { t: 'mini'; kind: MiniKind; level: number; label: string; cp?: boolean }
  /** `finish`: the last bump must be a double pounce (both heroes within a moment), the passenger's grab, or a net */
  | { t: 'chase'; who: 'cart' | 'boat' | 'boss' | 'runner'; from: Spot; route: Spot[]; bumps: number; loot: string; label: string; speed: number; sets?: SetDef[]; phase?: 1 | 2; finish?: 'pounce' | 'snatch' | 'net'; skin?: 'otter' | 'mac' | 'liz' | 'kaw'; cp?: boolean }
  /** `rope`: the float only swings in under the flags while the partner hauls the bunting rope there */
  | { t: 'float'; label: string; rope?: Spot; cp?: boolean }
  | { t: 'raid'; at: Spot; n: number; label: string; cp?: boolean }
  /** `relay`: from waypoint `at` on, the hero who started is easy for Pip to spot; the partner waits at `spot` */
  | { t: 'tail'; from: Spot; route: Spot[]; label: string; relay?: { at: number; spot: Spot }; cp?: boolean; /** under 1: the one you tail notices you more slowly */ calm?: number }
  /** `flanks`: crows come in pairs from both sides and the partner guards the far flank */
  | { t: 'escort'; from: Spot; route: Spot[]; label: string; crows: number; flanks?: boolean; skin?: 'otter'; cp?: boolean }
  /** `relay`: the marks from this one on count only for the partner waiting there (a hand-off) */
  | { t: 'race'; marks: Spot[]; label: string; rival?: 'runner' | 'scooter' | 'boat'; roof?: boolean; time?: number; ride?: VehicleKind | 'foot'; relay?: number; cp?: boolean }
  /** `shutter`: the goal's shutter is down unless the partner holds its lever there */
  /** `calm`: lookouts grow sure more slowly (a multiplier on the Alert meter's rise); `pause`: each stops this many
   * seconds at the ends of its beat, sweeping its torch, so a careful player can read the gap */
  | { t: 'stealth'; lookouts: Spot[][]; goal: Spot; exit: Spot; label: string; shutter?: Spot; calm?: number; pause?: number; cp?: boolean }
  /** `high`: up on balconies, reached only by the passenger's grab or a gadget; `watch`: a window lookout there */
  | { t: 'collect'; items: Spot[]; item: string; time: number; label: string; high?: boolean; watch?: [number, number]; cp?: boolean }
  | { t: 'heat'; level: number; label: string; cp?: boolean }
  | { t: 'trade'; profit: number; label: string; time?: number; cp?: boolean }
  | { t: 'fares'; n: number; label: string; cp?: boolean }
  /** ride the Jade Line to station `to` (E at a station entrance) */
  | { t: 'train'; to: string; label: string; cp?: boolean }
  /** race the train: it leaves station `from` as the step starts; reach station `to` before it pulls in */
  | { t: 'beat'; from: string; to: string; label: string; cp?: boolean }
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
/** `side`: a Hawker Tales side job, offered once that story job is done (lib/jade-save.ts sideJobs) */
export type Mission = { id: string; side?: string; ch: number; title: string; giver: string; at: string; blurb: string; reward: number; rep: number; steps: Step[]; tip?: { market: District; good: Good; mult: number } };

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
  kamal: { name: 'Mr Kamal', face: 'face-kamal', who: 'Toa Payoh station master (a colugo)' },
  vanda: { name: 'Ms Vanda', face: 'face-vanda', who: 'Island Night producer (a hornbill)' },
  lepak: { name: 'Lord Lepak', face: 'face-lepak', who: 'Longkang Lizards boss (a water monitor)' },
  kaw: { name: 'Director Kaw', face: 'face-kaw', who: 'Kaypoh Crows Pte Ltd (a house crow)' },
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
export const CHAPTERS = ['Smith Street', 'Temple Street', 'Boat Quay', 'Tanjong Pagar Docks', 'Clarke Quay', 'The Island'];
/** the last job of each chapter (its finale) */
export const FINALE = ['m5', 'm10', 'm15', 'm20', 'm25', 'm35'];

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
      { t: 'deliver', to: 'temple-steps', time: 80, fragile: 7, item: 'cake', label: 'Deliver the cake before it melts (gently!)' },
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
      { t: 'stealth', lookouts: [[[99, 69], [103, 69], [103, 72], [99, 72]], [[106, 72], [112, 72], [112, 73], [106, 73]], [[99, 77], [108, 77]], [[113, 76], [113, 80], [118, 80]]], goal: 'manifest', exit: 'yard-gate', shutter: [114, 66], calm: 0.8, pause: 1.4, label: 'Send {mate} to the shutter (F), reach the office unseen, take the list, get out' },
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
    ] },  // ── Chapter 6: the Island (Toa Payoh and Marina Bay). Director Kaw, Madame Glint's cousin, franchises the Kaypoh
  // Crows across the island and hires its gangs for one big caper: the Golden Chinchilla at the Float-About Stage
  { id: 'm26', ch: 6, title: 'Next Stop, Toa Payoh', giver: 'glint', at: 'stn-chinatown', reward: 260, rep: 14, blurb: 'Ride the Jade Line to Toa Payoh and catch the crow who pinched Mr Kamal’s station keys.',
    steps: [
      { t: 'talk', lines: [['glint', 'Darlings! Bad news. My cousin, Director Kaw, has turned the Crew into a company. Kaypoh Crows Pte Ltd.', 'worried'], ['pip', 'He has a briefcase. And a slogan. Franchising mischief island-wide!', 'worried'], ['hero', 'Then we go island-wide too.', 'smug'], ['mate', 'The Jade Line runs from right here. Two coins a ride. And no durians on the train!', 'smug']] },
      { t: 'train', to: 'stn-toapayoh', label: 'Take the Jade Line to Toa Payoh (E at the station entrance)', cp: true },
      { t: 'talk', lines: [['kamal', 'Welcome to Toa Payoh! I’m Mr Kamal, station master. Also: robbed. A crow in a little tie snatched my station keys!', 'worried'], ['kamal', 'There he goes, round the bus interchange!', 'cross'], ['mate', 'Crows are slippery. Pounce together: F sends me in, you dash.', 'smug']] },
      { t: 'chase', who: 'runner', from: [158, 33], route: [[165, 33], [165, 24], [150, 24], [143, 30], [150, 34]], bumps: 2, loot: 'loot-bag', speed: 200, finish: 'pounce', label: 'Pounce on the crow together: F sends {mate} in, then dash into him', cp: true },
      { t: 'pickup', at: 'loot', item: 'loot-bag', label: 'Grab Mr Kamal’s keys' },
      { t: 'goto', at: 'kamal', label: 'Bring the keys back to Mr Kamal', ride: 'foot' },
      { t: 'talk', lines: [['kamal', 'My keys! The trains can sleep tonight. The heartlands owe you one.', 'happy'], ['kamal', 'That crow said Director Kaw is hiring. The Bukit Bunch, the lizards in the longkang, even the bay otters.', 'worried'], ['hero', 'Then we talk to them first.', 'smug']] },
    ] },
  { id: 'm27', ch: 6, title: 'Void Deck Monkeys', giver: 'kow', at: 'raintree', reward: 280, rep: 14, blurb: 'Big Kow’s nephews are stashing mooncake boxes on the void-deck ledges for Director Kaw.',
    steps: [
      { t: 'talk', lines: [['kow', 'Ooh ooh. Okay, okay. A crow in a suit promised my nephews a lifetime of bananas.', 'worried'], ['kow', 'They pinched the residents’ mooncakes and hid them up on the ledges. Paiseh!', 'worried'], ['mate', 'Ledges are my job. You drive under them, I knock the boxes down.', 'smug'], ['hero', 'Mooncakes up on the ledges. Scooter first, then we hop up and get them.', 'calm']] },
      { t: 'ride', kind: 'scooter', near: [142, 10], label: 'Get on a scooter ({mate} hops on behind)', cp: true },
      { t: 'collect', items: [[131, 9], [148, 9], [162, 9], [176, 11]], item: 'mooncakes', time: 95, high: true, label: 'Ride under each ledge and press F: {mate} knocks the mooncakes down (or shoot them)' },
      { t: 'goto', at: 'raintree', label: 'Back to Big Kow’s rain tree', ride: 'foot' },
      { t: 'talk', lines: [['kow', 'All of them? Wah. My nephew Ah Tan still has the biggest box. He’s running!', 'cross'], ['mate', 'Net him. Monkeys can’t wriggle out of a net.', 'smug']] },
      { t: 'chase', who: 'runner', skin: 'mac', from: [140, 6], route: [[150, 10], [160, 14], [150, 18], [140, 14], [140, 6]], bumps: 2, loot: 'mooncakes', speed: 195, finish: 'net', label: 'Trip Ah Tan, then tangle him in the net (click)', cp: true },
      { t: 'pickup', at: 'loot', item: 'mooncakes', label: 'Pick up the mooncake box' },
      { t: 'talk', lines: [['kow', 'Okay lah. The Bukit Bunch is out of Kaw’s company. Bananas are not everything.', 'happy'], ['kow', 'He said the lizards in the drain are keeping something for him.', 'calm']] },
    ] },
  { id: 'm28', ch: 6, title: 'Longkang Lizards', giver: 'lepak', at: 'lepak', reward: 300, rep: 14, blurb: 'Tail Kaw’s courier to the storm drain where the Longkang Lizards keep his stash.',
    steps: [
      { t: 'talk', lines: [['lepak', 'Mmm. I am Lord Lepak. Lepak means I don’t move much. Why are you disturbing my sunbathing?', 'calm'], ['hero', 'Your lizards are keeping things for Director Kaw.', 'smug'], ['lepak', 'Are they? Hmm. I was sleeping. Follow his courier and see.', 'calm'], ['mate', 'The courier will know your face. I’ll wait by the wet market: switch to me there.', 'smug']] },
      { t: 'tail', from: [136, 24], route: [[143, 24], [150, 24], [157, 24], [163, 24], [164, 30]], relay: { at: 3, spot: [155, 21] }, calm: 0.75, label: 'Follow the courier out of sight; switch to {mate} at the corner (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'He handed a sack to a lizard behind the wet market!', 'cross'], ['lepak', 'Ah. That is Kriss, my fastest. Slippery on soap, though.', 'calm']] },
      { t: 'chase', who: 'runner', skin: 'liz', from: [163, 32], route: [[156, 34], [146, 34], [140, 31], [134, 33], [143, 24], [158, 24]], bumps: 2, loot: 'loot-bag', speed: 180, finish: 'net', label: 'Trip Kriss (a bubble makes a lizard slip), then net him (click)', cp: true },
      { t: 'pickup', at: 'loot', item: 'loot-bag', label: 'Grab the sack' },
      { t: 'goto', at: 'lepak', label: 'Show Lord Lepak what was in it', ride: 'foot' },
      { t: 'talk', lines: [['lepak', 'Stage passes for Island Night at the Float-About Stage. And a drawing of the Golden Chinchilla.', 'worried'], ['lepak', 'Kaw paid us in kueh. Very nice kueh. But the Longkang Lizards don’t steal awards. Too much effort.', 'happy'], ['mate', 'So Island Night is the big caper.', 'cross']] },
    ] },
  { id: 'm29', ch: 6, title: 'Tumpang Rush', giver: 'kamal', at: 'kamal', reward: 260, rep: 12, blurb: 'The interchange buses are stuck behind a crow roadblock. Give the stranded heartlanders a lift home.',
    steps: [
      { t: 'talk', lines: [['kamal', 'The crows parked carts across the bus interchange. The aunties are stranded!', 'worried'], ['kamal', 'Borrow the tuk-tuk by the market. Tumpang, means give them a lift.', 'calm'], ['mate', 'I’ll ride up front and hold the shopping. Mind the silver zones, the uncles cross slowly.', 'smug'], ['hero', 'Three fares, one tuk-tuk. Hold on to your shopping, aunties!', 'smug']] },
      { t: 'ride', kind: 'tuktuk', near: [158, 34], label: 'Take the tuk-tuk by the provision shop', cp: true },
      { t: 'fares', n: 3, label: 'Pick up the fares' },
      { t: 'goto', at: 'kamal', label: 'Back to Mr Kamal' },
      { t: 'talk', lines: [['kamal', 'Everyone home, nobody fined. Toa Payoh salutes you!', 'happy'], ['kamal', 'Ms Vanda at the bay needs you. Her stage lights went missing on the expressway.', 'worried']] },
    ] },
  { id: 'm30', ch: 6, title: 'Expressway Express', giver: 'vanda', at: 'vanda', reward: 320, rep: 14, blurb: 'A crow cart is speeding the stolen stage lights round the expressways. Catch it before the gantries empty your purse.',
    steps: [
      { t: 'talk', lines: [['vanda', 'I’m Ms Vanda, producer of Island Night. My stage lights! A crow cart took them up the parkway!', 'worried'], ['vanda', 'The gantries charge every pass, darling. Make it quick.', 'calm'], ['mate', 'Bump it, then ride alongside: I’ll grab the crate off the back (F).', 'smug'], ['hero', 'A cart on the expressway? Then we take the fast lane too.', 'smug']] },
      { t: 'ride', kind: 'scooter', near: [165, 63], label: 'Get on a scooter by Marina Way', cp: true },
      { t: 'chase', who: 'cart', from: [168, 64], route: [[168, 80], [124, 80], [124, 38], [190, 38], [198, 50], [198, 64], [168, 64]], bumps: 3, loot: 'light-crate', speed: 245, finish: 'snatch', label: 'Bump the crow cart twice, then ride alongside for {mate}’s grab (F)', cp: true },
      { t: 'pickup', at: 'loot', item: 'light-crate', label: 'Catch the crate of lights' },
      { t: 'goto', at: 'vanda', label: 'Bring the lights to Ms Vanda' },
      { t: 'talk', lines: [['vanda', 'Not a scratch! You two drive like a music video.', 'happy'], ['vanda', 'The otters on the bay say the crows are chasing them off the promenade. Can you help?', 'worried']] },
    ] },
  { id: 'm31', ch: 6, title: 'Otters of the Bay', giver: 'sleek', at: 'promenade', reward: 320, rep: 14, blurb: 'Walk Ma Sleek’s pups along the promenade past Kaw’s crows, then sail them home to the holt.',
    steps: [
      { t: 'talk', lines: [['sleek', 'Hehe, hello again. Kaw’s crows want my pups to swim their stolen things across the bay.', 'cross'], ['sleek', 'My pups said no. Now the crows chase them every night!', 'worried'], ['mate', 'Both flanks, like the lion dance. Bubbles keep otters happy, nets keep crows busy.', 'smug'], ['hero', 'Stay close, little ones. We’ll walk you right past the crows.', 'calm']] },
      { t: 'escort', from: [146, 66], route: [[154, 66], [162, 66], [172, 66], [182, 66], [191, 66]], crows: 7, flanks: true, skin: 'otter', label: 'Guard the otter pups along the promenade ({mate} takes the far side)', cp: true },
      { t: 'ride', kind: 'boat', near: [193, 70], label: 'Take the bumboat at the boardwalk' },
      { t: 'goto', at: 'holt', label: 'Sail round to the otters’ holt on the breakwater', ride: 'boat', r: 140 },
      { t: 'talk', lines: [['sleek', 'Home! The Riverside Romp is with you, fluffies.', 'happy'], ['sleek', 'Kaw keeps his plans in his office at Raffles Place. Top floor, crows everywhere.', 'calm']] },
    ] },
  { id: 'm32', ch: 6, title: 'Office Hours', giver: 'vanda', at: 'raffles', reward: 340, rep: 14, blurb: 'Sneak into the Kaypoh Crows’ head office at Raffles Place and find Kaw’s plan for Island Night.',
    steps: [
      { t: 'talk', lines: [['vanda', 'Kaypoh Crows Pte Ltd has a head office now. With a water cooler.', 'worried'], ['mate', 'Its shutter only stays up while someone holds the lever. Send me (F), then sneak in.', 'smug'], ['hero', 'Sneak. Shift. Got it.', 'calm']] },
      { t: 'stealth', lookouts: [[[132, 57], [138, 57]], [[132, 61], [139, 61]], [[139, 56], [139, 60]]], goal: 'crownest', exit: [142, 58], shutter: [133, 60], calm: 0.8, pause: 1.5, label: 'Send {mate} to the shutter lever (F), reach Kaw’s desk unseen, then get out', cp: true },
      { t: 'talk', lines: [['hero', 'A plan with arrows. At the big finale, they swap the Golden Chinchilla for a chocolate one.', 'cross'], ['vanda', 'The prize for Island Night! And his runner already took the stage pass onto the train at Bayfront.', 'worried']] },
    ] },
  { id: 'm33', ch: 6, title: 'MRT Chase', giver: 'vanda', at: 'vanda', reward: 360, rep: 15, blurb: 'Kaw’s runner is on the train to Toa Payoh with the stage pass. Beat the train there.',
    steps: [
      { t: 'talk', lines: [['vanda', 'The runner rides the viaduct to Toa Payoh. Can a scooter beat a train?', 'worried'], ['hero', 'On Bayfront Avenue, at night? Watch us.', 'smug'], ['mate', 'Keep to the lights. And no speeding in the silver zones!', 'smug']] },
      { t: 'ride', kind: 'scooter', near: [200, 62], label: 'Get on a scooter by Bayfront station', cp: true },
      { t: 'beat', from: 'stn-bayfront', to: 'stn-toapayoh', label: 'Beat the train to Toa Payoh station: it’s on the viaduct overhead' },
      { t: 'goto', at: 'stn-toapayoh', ride: 'foot', r: 160, label: 'Hop off at the station steps' },
      { t: 'talk', lines: [['hero', 'Doors opening… there he is!', 'cross'], ['mate', 'Pounce together when he steps off!', 'smug']] },
      { t: 'chase', who: 'runner', from: [147, 33], route: [[144, 33], [143, 24], [158, 24], [165, 30], [151, 34]], bumps: 2, loot: 'loot-bag', speed: 205, finish: 'pounce', label: 'Pounce on the runner together: F sends {mate} in, then dash', cp: true },
      { t: 'pickup', at: 'loot', item: 'loot-bag', label: 'Grab the stage pass' },
      { t: 'talk', lines: [['kamal', 'Fastest arrival I’ve ever seen. And nobody fined!', 'happy'], ['vanda', 'Without the pass he can’t get backstage. He’ll try something loud instead.', 'worried']] },
    ] },
  { id: 'm34', ch: 6, title: 'Showtime Setup', giver: 'vanda', at: 'vanda', reward: 360, rep: 15, blurb: 'Gather the concert lights the crows hid round the bay and wire up the Float-About Stage.',
    steps: [
      { t: 'talk', lines: [['vanda', 'Island Night starts soon and the crows hid my last lights around the bay!', 'worried'], ['mate', 'A crow lookout in the mall window. Paint the glass or let me pull faces at it.', 'smug'], ['hero', 'Five crates of lights, one stage. Let’s light it up.', 'smug']] },
      { t: 'collect', items: [[148, 64], [164, 64], [183, 62], [191, 66], [145, 76]], item: 'light-crate', time: 110, watch: [190, 61], label: 'Collect the five crates of lights; paint the window lookout or send {mate} to distract it (F)', cp: true },
      { t: 'goto', at: 'stage', label: 'Over the walkway to the Float-About Stage', ride: 'foot', r: 110 },
      { t: 'mini', kind: 'wires', level: 2, label: 'Wire up the stage lights' },
      { t: 'talk', lines: [['vanda', 'Lights! Sound! Fluffballs! We’re ready.', 'happy'], ['lepak', 'I will watch from my deck chair. Very supportive.', 'calm'], ['kow', 'Bukit Bunch in the front row!', 'happy']] },
    ] },
  { id: 'm35', ch: 6, title: 'Bay Front Finale', giver: 'kaw', at: 'stage', reward: 900, rep: 25, blurb: 'Director Kaw grabs the Golden Chinchilla in the middle of Island Night. Stop him on the bay.',
    steps: [
      { t: 'talk', lines: [['kaw', 'Ladies, gentlemen, fluffballs. Kaypoh Crows Pte Ltd thanks you for your business!', 'happy'], ['vanda', 'He’s taken the Golden Chinchilla! Into a boat!', 'worried'], ['mate', 'Boats by the boardwalk. Go go go!', 'cross']] },
      { t: 'ride', kind: 'boat', near: [146, 69], label: 'Jump in the bumboat by the boardwalk', cp: true },
      { t: 'chase', who: 'boat', from: [151, 72], route: [[166, 76], [180, 76], [190, 71], [176, 70], [160, 72], [150, 78]], bumps: 3, loot: '', speed: 205, finish: 'net', label: 'Bump Kaw’s boat twice, then net it (click)', cp: true },
      { t: 'talk', lines: [['kaw', 'Nets! How unprofessional. I’ll take the promenade!', 'cross'], ['mate', 'He’s heading for the promenade. Bring the boat in by the resort!', 'cross']] },
      { t: 'goto', at: [193, 70], label: 'Pull up at the boardwalk by the resort', ride: 'boat', r: 130 },
      { t: 'goto', at: [195, 68], label: 'Jump ashore', ride: 'foot', r: 140 },
      { t: 'chase', who: 'runner', skin: 'kaw', from: [190, 66], route: [[180, 66], [170, 66], [160, 64], [150, 66], [146, 62], [165, 63]], bumps: 2, loot: '', speed: 210, finish: 'pounce', label: 'Pounce on Director Kaw together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['kaw', 'Fine! Then nobody gets it! Fly, Crow Number Nine!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'statuette', time: 60, label: 'Knock the Golden Chinchilla out of the crow’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'statuette', label: 'Catch the Golden Chinchilla' },
      { t: 'talk', lines: [['kaw', 'I… may need to restructure.', 'worried'], ['glint', 'Cousin. Come home. The festival needs someone to hold the lanterns.', 'smug'], ['vanda', 'And the Golden Chinchilla for Island Night goes to… the heroes of the island!', 'happy'], ['hero', 'Best island ever.', 'happy'], ['mate', 'Best team ever. Again.', 'happy']] },
    ] },
];
// ── Hawker Tales: the Singapore side jobs. They sit outside the five chapters (ch 0), open once their story job is
// done, and pay like a story job; the townsfolk they help are in PEOPLE.
export const SIDE: Mission[] = [
  { id: 'k1', side: 'm3', ch: 0, title: 'The Kopi Run', giver: 'teo', at: 'teo', reward: 70, rep: 8, blurb: 'Make Uncle Teo’s kopi orders, then run the tray to Uncle Goh’s chess game.',
    steps: [
      { t: 'talk', lines: [['teo', 'Eh, hero! My hands so busy today. You know kopi lingo or not?', 'calm'], ['hero', 'Kopi… is coffee?', 'calm'], ['teo', 'Kopi-O is no milk, C is evaporated milk, kosong is no sugar, peng is ice. Simple! Your phone has the list.', 'happy'], ['teo', 'Make the orders for the chess uncles at the void deck. Then run them over, don’t spill!', 'calm']] },
      { t: 'goto', at: 'teo', label: 'Step behind Uncle Teo’s kopi counter', r: 110, ride: 'foot' },
      { t: 'mini', kind: 'kopi', level: 1, label: 'Make the drinks the way Uncle Teo calls them', cp: true },
      { t: 'deliver', to: 'goh', time: 70, fragile: 6, item: 'kopi-tray', label: 'Carry the kopi tray to Uncle Goh at the void deck (gently!)' },
      { t: 'talk', lines: [['goh', 'Wah, my kopi-O kosong! Still hot some more. Steady lah.', 'happy'], ['goh', 'You play chess? Next time. Now I must win this game first.', 'calm']] },
    ] },
  { id: 'k2', side: 'm5', ch: 0, title: 'The Stolen Wok', giver: 'beng', at: 'beng', reward: 110, rep: 10, blurb: 'Ah Beng’s seasoned wok rolled off on a Kaypoh Crows cart. Get it back before the dinner rush.',
    steps: [
      { t: 'talk', lines: [['beng', 'Bro! Bro! The crows took my wok! Twenty years of wok hei inside!', 'worried'], ['hero', 'A whole wok? On what?', 'calm'], ['beng', 'On a cart lah! Bump it twice, then ride alongside: your partner grab the wok. Can or not?', 'cross'], ['hero', 'Can!', 'happy']] },
      { t: 'chase', who: 'cart', from: X('a', 's'), route: [X('b', 's'), X('b', 'd'), X('a', 'd'), X('a', 's'), X('b', 's')], bumps: 3, loot: 'wok', speed: 235, finish: 'snatch', label: 'Bump the crows’ cart twice, then ride alongside: F and {mate} grabs the wok', cp: true },
      { t: 'pickup', at: 'loot', item: 'wok', label: 'Grab the wok' },
      { t: 'goto', at: 'beng', label: 'Bring the wok back to Ah Beng', cp: true },
      { t: 'mini', kind: 'wok', level: 1, label: 'Christen it: toss a plate of char kway teow' },
      { t: 'talk', lines: [['beng', 'Wah, the wok hei is back! Shiok!', 'happy'], ['beng', 'Free plate for you anytime, bro. Steady!', 'happy']] },
    ] },
  { id: 'k3', side: 'm7', ch: 0, title: 'Durian Run', giver: 'goh', at: 'goh', reward: 120, rep: 10, blurb: 'Carry a crate of prize durians from the wet market to the temple. Everyone will smell you coming.',
    steps: [
      { t: 'talk', lines: [['goh', 'My cousin at Temple Street wants the best durians in Chinatown. Only from the wet market, you know.', 'calm'], ['hero', 'What’s that smell?', 'worried'], ['goh', 'That is the smell of quality! But no durian on the bus or the trishaw hor. Fine, you know.', 'happy'], ['goh', 'And the wardens can follow the smell. Keep moving, keep away from them.', 'calm']] },
      { t: 'pickup', at: 'wetmarket', item: 'durian', label: 'Pick up the durian crate at the wet market', cp: true },
      { t: 'deliver', to: 'temple-steps', time: 110, stink: true, item: 'durian', label: 'Carry the durians to the temple steps (no buses! keep clear of wardens)' },
      { t: 'talk', lines: [['goh', 'My cousin says: wah, very shiok. He sends you this. Don’t eat it all at once.', 'happy']] },
    ] },
  { id: 'k4', side: 'm8', ch: 0, title: 'Monkey Business', giver: 'hoon', at: 'hoon', reward: 120, rep: 10, blurb: 'The Bukit Bunch snatched the hawker centre’s takeaway bags. Big Kow’s fastest boy has the last one.',
    steps: [
      { t: 'talk', lines: [['hoon', 'Aiyoh! Those monkeys again! They grabbed all my takeaway bags!', 'worried'], ['kow', 'Ooh ooh! Finders keepers, auntie!', 'happy'], ['hoon', 'They dropped some running away. Pick them up, then catch the one with the big bag.', 'cross']] },
      { t: 'collect', items: [[13, 61], [26, 61], [29, 57]], item: 'bag', time: 90, label: 'Pick up the three takeaway bags the macaques dropped', cp: true },
      { t: 'chase', who: 'runner', skin: 'mac', from: [34, 74], route: [[41, 76], [40, 66], [28, 66], [28, 76]], bumps: 2, loot: 'bun', speed: 200, finish: 'pounce', label: 'Pounce on the macaque together: F sends {mate} in, then dash into it', cp: true },
      { t: 'pickup', at: 'loot', item: 'bun', label: 'Grab the bag of buns' },
      { t: 'goto', at: 'hoon', label: 'Bring the bags back to Auntie Hoon' },
      { t: 'talk', lines: [['kow', 'Ooh. Paiseh, auntie. Can have one bun or not?', 'worried'], ['hoon', 'Aiyah, take one lah. Only one!', 'happy']] },
    ] },
  { id: 'k5', side: 'm9', ch: 0, title: 'The Kueh Recipe', giver: 'hoon', at: 'hoon', reward: 140, rep: 12, blurb: 'Auntie Hoon’s grandmother’s kueh lapis recipe has gone missing. Pip has been seen with a scrap of paper.',
    steps: [
      { t: 'talk', lines: [['hoon', 'My mama’s kueh lapis recipe! Forty layers! Gone from my tin!', 'worried'], ['hero', 'Pip was on Smith Street this morning…', 'calm'], ['hoon', 'Follow him. Don’t let him see you, he will fly off with it.', 'cross']] },
      { t: 'tail', from: [30, 64], route: [[28, 58], [28, 48], [20, 48], [12, 48], [12, 36], [2, 36]], label: 'Follow Pip, but stay out of sight (the five-foot ways hide you)', cp: true },
      { t: 'bag', at: 'here', loot: 'recipe', time: 60, label: 'A crow has the recipe! Knock it loose (shoot it, or dash when it swoops low)', cp: true },
      { t: 'goto', at: 'hoon', label: 'Bring the recipe back to Auntie Hoon' },
      { t: 'talk', lines: [['hoon', 'Wah, still in one piece! Tomorrow I make kueh, you come eat.', 'happy'], ['pip', 'Can I have a slice too? …No? Okay.', 'worried']] },
    ] },
  { id: 'k6', side: 'm12', ch: 0, title: 'The Otter Smugglers', giver: 'mo', at: 'mo', reward: 150, rep: 12, blurb: 'Ma Sleek is running crates of stolen prawns up the Singapore River in her sampan. Bump it to a stop.',
    steps: [
      { t: 'talk', lines: [['mo', 'My prawns for the satay stall! Ma Sleek’s otters took the whole crate.', 'cross'], ['sleek', 'Hehe! Borrowing only! Catch me on the river if you can!', 'happy'], ['hero', 'Bumboat it is.', 'calm']] },
      { t: 'ride', kind: 'boat', label: 'Step into a bumboat', near: [66, 24] },
      { t: 'chase', who: 'boat', skin: 'otter', from: [67, 30], route: [[67, 58], [67, 20], [67, 50], [67, 6]], bumps: 3, loot: 'prawns', speed: 210, label: 'Bump Ma Sleek’s sampan three times', cp: true },
      { t: 'pickup', at: 'loot', item: 'prawns', label: 'Fish out the crate of prawns' },
      { t: 'goto', at: 'kiri', label: 'Bring the prawns to Kiri’s jetty (she runs them to Chef Mo)' },
      { t: 'talk', lines: [['sleek', 'Aww, no fair. Okay okay, next time we pay.', 'worried'], ['mo', 'Next time, you buy like everyone else!', 'cross']] },
    ] },
  { id: 'k7', side: 'm17', ch: 0, title: 'Getai Rescue', giver: 'lily', at: 'lily', reward: 160, rep: 12, blurb: 'Lily Sparkle’s getai show is tonight, but the stage lights are dead and a crow ran off with her microphone.',
    steps: [
      { t: 'talk', lines: [['lily', 'Aiyoh, aiyoh! The show starts soon and my lights are dead!', 'worried'], ['lily', 'And a cheeky crow took my microphone! The spirits are waiting in the front row!', 'cross'], ['hero', 'Lights first, then the crow.', 'calm']] },
      { t: 'goto', at: 'getai', label: 'Go to the getai stage', r: 110, ride: 'foot' },
      { t: 'mini', kind: 'wires', level: 2, label: 'Rewire the stage lights', cp: true },
      { t: 'chase', who: 'runner', from: [60, 74], route: [[65, 74], [64, 66], [56, 66], [56, 74]], bumps: 2, loot: 'mic', speed: 205, finish: 'pounce', label: 'Pounce on the crow together: F sends {mate} in, then dash into it', cp: true },
      { t: 'pickup', at: 'loot', item: 'mic', label: 'Grab the microphone' },
      { t: 'goto', at: 'lily', label: 'Bring the microphone to Lily Sparkle' },
      { t: 'talk', lines: [['lily', 'Thank you, thank you! This song is for you two!', 'happy'], ['lily', 'Front row? No, no, that one is for the spirits. You sit second row.', 'calm']] },
    ] },
];
export const MISSION = Object.fromEntries([...MISSIONS, ...SIDE].map(m => [m.id, m])) as Record<string, Mission>;

/** every count of jobs shown to the player, derived from MISSIONS and SIDE (never written in by hand): story jobs and
 *  Hawker Tales done and in all, the medal marks (three a story job) earned and possible, and gold medals */
export function jobCounts(s: { done: string[]; medals: Record<string, { m: number } | undefined> }) {
  const story = MISSIONS.filter(m => s.done.includes(m.id)).length, tales = SIDE.filter(m => s.done.includes(m.id)).length;
  return {
    story, storyAll: MISSIONS.length, tales, talesAll: SIDE.length, done: story + tales, all: MISSIONS.length + SIDE.length,
    marks: MISSIONS.reduce((a, m) => a + (s.medals[m.id]?.m ?? 0), 0), marksAll: MISSIONS.length * 3,
    gold: MISSIONS.filter(m => s.medals[m.id]?.m === 3).length,
  };
}

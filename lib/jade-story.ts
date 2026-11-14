// Jade Street: the story. The Magpie Crew swiped the quarter's five lucky heirlooms; twenty-five jobs from the
// shopkeepers, five chapters, each ending in a chase for one heirloom that clears the fog from the next district.
// Missions are lists of steps the runner in lib/jade-mission.ts understands; `cp` marks a checkpoint (a failed step
// restarts from the last one). Places are names from lib/jade-city.ts or [tileX, tileY] pairs. 'hero' in a line is
// whoever you are playing (Dora or Enzo).
import type { District } from './jade-city.js';
import type { VehicleKind } from './jade-move.js';
import type { Good } from './jade-trade.js';

export type Spot = string | [number, number];
export type Line = [string, string];
export type Step =
  | { t: 'talk'; lines: Line[]; cp?: boolean }
  | { t: 'goto'; at: Spot; label: string; r?: number; ride?: VehicleKind | 'foot'; cp?: boolean }
  | { t: 'ride'; kind: VehicleKind; label: string; near?: Spot; locked?: boolean; cp?: boolean }
  | { t: 'pickup'; at: Spot; item: string; label: string; cp?: boolean }
  | { t: 'deliver'; to: Spot; time: number; label: string; item: string; fragile?: number; cp?: boolean }
  | { t: 'mini'; kind: MiniKind; level: number; label: string; cp?: boolean }
  | { t: 'chase'; who: 'cart' | 'boat' | 'boss' | 'runner'; from: Spot; route: Spot[]; bumps: number; loot: string; label: string; speed: number; cp?: boolean }
  | { t: 'tail'; from: Spot; route: Spot[]; label: string; cp?: boolean }
  | { t: 'escort'; from: Spot; route: Spot[]; label: string; magpies: number; cp?: boolean }
  | { t: 'race'; marks: Spot[]; label: string; rival?: 'runner' | 'scooter' | 'boat'; roof?: boolean; time?: number; ride?: VehicleKind | 'foot'; cp?: boolean }
  | { t: 'stealth'; lookouts: Spot[][]; goal: Spot; exit: Spot; label: string; cp?: boolean }
  | { t: 'collect'; items: Spot[]; item: string; time: number; label: string; cp?: boolean }
  | { t: 'heat'; level: number; label: string; cp?: boolean }
  | { t: 'trade'; profit: number; label: string; cp?: boolean }
  | { t: 'fares'; n: number; label: string; cp?: boolean };
export type MiniKind = 'lock' | 'wires' | 'wok' | 'dumpling' | 'haggle';
export type Mission = { id: string; ch: number; title: string; giver: string; at: string; blurb: string; reward: number; rep: number; steps: Step[]; tip?: { market: District; good: Good; mult: number } };

export const PEOPLE: Record<string, { name: string; face: string; who: string }> = {
  kee: { name: 'Uncle Kee', face: 'face-kee', who: 'tortoise grocer' },
  mo: { name: 'Chef Mo', face: 'face-mo', who: 'otter chef' },
  pang: { name: 'Auntie Pang', face: 'face-pang', who: 'pangolin trader' },
  heron: { name: 'Brother Heron', face: 'face-heron', who: 'temple keeper' },
  ren: { name: 'Master Ren', face: 'face-ren', who: 'lion-dance master' },
  kiri: { name: 'Kiri', face: 'face-kiri', who: 'canal boatwoman' },
  lim: { name: 'Mr Lim', face: 'face-lim', who: 'news-stand mynah' },
  bo: { name: 'Big Bo', face: 'face-bo', who: 'dock foreman' },
  bristle: { name: 'Captain Bristle', face: 'face-bristle', who: 'chief warden' },
  gizmo: { name: 'Gizmo', face: 'face-gizmo', who: 'arcade DJ' },
  glint: { name: 'Madame Glint', face: 'face-glint', who: 'Magpie Crew boss' },
  pip: { name: 'Pip', face: 'face-pip', who: 'Magpie Crew rookie' },
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
/** which district each chapter's finale opens (chapter 1 is played in the Night Market) */
export const CHAPTER_OPENS: District[] = ['temple', 'canal', 'docks', 'arcade'];
export const CHAPTERS = ['The Night Market', 'Temple Hill', 'The Canal Quarter', 'The Docks', 'The Arcade Strip'];

// road crossings by name: X(v, h) is the lane tile where vertical road v meets horizontal road h
const V = { a: 10, b: 26, c: 42, d: 60, e: 71, f: 90, g: 106 } as const;
const Hh = { n: 12, m: 30, s: 46, d: 62, x: 22 } as const;
const X = (v: keyof typeof V, h: keyof typeof Hh): [number, number] => [V[v] + 2, Hh[h] + 2];

export const MISSIONS: Mission[] = [
  // ── Chapter 1: the Night Market (Jade Dragon)
  { id: 'm1', ch: 1, title: 'Opening Night', giver: 'kee', at: 'kee', reward: 60, rep: 12, blurb: 'Help Uncle Kee get a crate of mangoes to Chef Mo.',
    steps: [
      { t: 'talk', lines: [['kee', 'Ah, hero! Good timing. The whole quarter is in a flap.'], ['kee', 'The Magpie Crew swooped last night and took our five lucky heirlooms. Without them, no festival.'], ['hero', 'Then we get them back. Where do we start?'], ['kee', 'Start small. Chef Mo needs these mangoes for her stall, and my legs are slower than my stories.']] },
      { t: 'pickup', at: [16, 44], item: 'crate', label: 'Pick up the crate of mangoes', cp: true },
      { t: 'ride', kind: 'scooter', near: [19, 45], locked: true, label: 'Get on the red scooter by the kerb' },
      { t: 'deliver', to: 'mo', time: 75, item: 'crate', label: 'Ride the mangoes to Chef Mo in the food court' },
      { t: 'talk', lines: [['mo', 'Mangoes! You are a lifesaver. Hop off and say hi properly.'], ['mo', 'A magpie has been circling my wok all night. Something tells me we will be busy.']] },
    ] },
  { id: 'm2', ch: 1, title: 'Hot Wok, Cold Trail', giver: 'mo', at: 'mo', reward: 80, rep: 12, blurb: 'Cook for Chef Mo’s queue, then catch the tip-jar thief.',
    steps: [
      { t: 'talk', lines: [['mo', 'The queue is round the corner! Grab a wok. Catch what the order needs, toss before it scorches.'], ['hero', 'How hard can it be?']] },
      { t: 'mini', kind: 'wok', level: 1, label: 'Cook the order', cp: true },
      { t: 'talk', lines: [['mo', 'Hey! That magpie just pinched my tip jar!'], ['pip', 'Finders keepers, fluffball!']] },
      { t: 'chase', who: 'runner', from: [34, 74], route: [[38, 76], [40, 66], [28, 66], [28, 76]], bumps: 2, loot: 'coins', speed: 205, label: 'Dash into the magpie to make it drop the jar', cp: true },
      { t: 'pickup', at: 'loot', item: 'coins', label: 'Grab the tip jar' },
      { t: 'goto', at: 'mo', label: 'Bring the jar back to Chef Mo' },
      { t: 'talk', lines: [['mo', 'My hero. That little one called himself Pip. He’ll be back.']] },
    ] },
  { id: 'm3', ch: 1, title: 'Whistle Stop', giver: 'kee', at: 'kee', reward: 90, rep: 12, blurb: 'Knock over the magpies’ lookout crates, then shake off the wardens.',
    steps: [
      { t: 'talk', lines: [['kee', 'The magpies stack crates by the market to spy from. Knock them down!'], ['kee', 'Mind you, the raccoon wardens hate a mess. Lanterns light up when you make trouble.'], ['hero', 'And then?'], ['kee', 'Then you lose them. Alleys, a bead curtain, or a quick jacket swap at your safe house.']] },
      { t: 'ride', kind: 'scooter', near: [19, 45], label: 'Get on a scooter' },
      { t: 'collect', items: [[24, 63], [14, 64], [4, 48]], item: 'lookout', time: 90, label: 'Bump the three lookout crates', cp: true },
      { t: 'heat', level: 2, label: 'Lose the wardens: break their line of sight or hide' },
      { t: 'goto', at: 'kee', label: 'Report back to Uncle Kee' },
      { t: 'talk', lines: [['kee', 'Ha! Captain Bristle will be chewing his moustache. Well done.']] },
    ] },
  { id: 'm4', ch: 1, title: 'Shadow the Feathers', giver: 'mo', at: 'mo', reward: 100, rep: 14, blurb: 'Tail Pip to the Magpie hideout without being spotted.',
    steps: [
      { t: 'talk', lines: [['mo', 'Pip is back, strutting about with a sack. Follow him, but not too close.'], ['mo', 'Hold the walk button to sneak. If he turns round, duck behind something.']] },
      { t: 'tail', from: [30, 64], route: [[28, 58], [28, 48], [20, 48], [12, 48], [12, 36], [2, 36]], label: 'Follow Pip, but stay out of sight', cp: true },
      { t: 'talk', lines: [['hero', 'A painted door in a back yard. That’s the hideout.'], ['mo', 'Brilliant. Tell Uncle Kee, he has an idea about doors.']] },
    ] },
  { id: 'm5', ch: 1, title: 'The Jade Dragon', giver: 'kee', at: 'kee', reward: 250, rep: 20, blurb: 'Open the hideout and chase down the Jade Dragon.',
    steps: [
      { t: 'talk', lines: [['kee', 'I was a locksmith before I was a grocer. Here, take my old hairpin.'], ['kee', 'Feel each pin. When it glows, let go.']] },
      { t: 'goto', at: [2, 37], label: 'Go to the hideout door', ride: 'foot', cp: true },
      { t: 'mini', kind: 'lock', level: 1, label: 'Pick the lock' },
      { t: 'talk', lines: [['pip', 'Eek! Boss said nobody finds this place!'], ['hero', 'That’s the Jade Dragon on his cart!']] },
      { t: 'ride', kind: 'scooter', near: [4, 36], label: 'Jump on the scooter' },
      { t: 'chase', who: 'cart', from: X('a', 'm'), route: [X('a', 's'), X('b', 's'), X('b', 'd'), X('c', 'd'), X('c', 'm'), X('a', 'm')], bumps: 3, loot: 'h-dragon', speed: 250, label: 'Bump Pip’s cart three times', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-dragon', label: 'Grab the Jade Dragon' },
      { t: 'goto', at: 'kee', label: 'Take the Jade Dragon to Uncle Kee' },
      { t: 'talk', lines: [['kee', 'The Jade Dragon! The Night Market will sleep easy tonight.'], ['kee', 'The fog over Temple Hill is lifting. Brother Heron rang to say the Golden Bell is gone too.']] },
    ] },
  // ── Chapter 2: Temple Hill (Golden Bell)
  { id: 'm6', ch: 2, title: 'Auntie’s Tea Run', giver: 'pang', at: 'pang', reward: 90, rep: 12, blurb: 'Learn to trade: buy tea on Temple Hill, sell it in the Night Market.', tip: { market: 'market', good: 'tea', mult: 1.35 },
    steps: [
      { t: 'talk', lines: [['pang', 'So you are the one chasing magpies. Chasing costs money, dear.'], ['pang', 'Tea is cheap up here and dear in the Night Market tonight. Buy low, sell high.'], ['pang', 'And haggle! Stop the needle in the middle and I’ll knock some off. Gently.']] },
      { t: 'trade', profit: 40, label: 'Make 40 coins profit trading (tea: Temple Hill → Night Market)', cp: true },
      { t: 'goto', at: 'pang', label: 'Tell Auntie Pang how it went' },
      { t: 'talk', lines: [['pang', 'A natural! Your stall-keeper rep is growing. Better prices for you now.']] },
    ] },
  { id: 'm7', ch: 2, title: 'The Hundred Steps', giver: 'heron', at: 'heron', reward: 110, rep: 14, blurb: 'Race a magpie up the temple path on foot.',
    steps: [
      { t: 'talk', lines: [['heron', 'Peace, little one. A magpie boasts it can beat anyone to the top of the hill.'], ['heron', 'Wheels are not allowed on the steps. Hop the hedges, dash the paths.']] },
      { t: 'race', ride: 'foot', rival: 'runner', marks: [[36, 14], [37, 10], [26, 9], [11, 9], [11, 3], [19, 7]], label: 'Beat the magpie to the temple', cp: true },
      { t: 'talk', lines: [['heron', 'Swift feet. The magpie muttered something about the bell being taken down the hill tonight.']] },
    ] },
  { id: 'm8', ch: 2, title: 'The Lion Wakes', giver: 'ren', at: 'ren', reward: 130, rep: 14, blurb: 'Escort the lion-dance troupe and shoo the magpies.',
    steps: [
      { t: 'talk', lines: [['ren', 'My lion dances to the market square for luck. The magpies want its red envelopes.'], ['ren', 'Stay close. Dash into any magpie that swoops in. A gentle bump sends them packing.']] },
      { t: 'escort', from: [17, 20], route: [[18, 26], [18, 32], [22, 32], [22, 44], [20, 48], [20, 50]], magpies: 5, label: 'Keep the magpies off the lion dance', cp: true },
      { t: 'talk', lines: [['ren', 'Wonderful! The lion bows to you. Here is something for your trouble.']] },
    ] },
  { id: 'm9', ch: 2, title: 'Wedding Cake Weather', giver: 'mo', at: 'mo', reward: 150, rep: 14, blurb: 'Rush a melting wedding cake up to the temple.',
    steps: [
      { t: 'talk', lines: [['mo', 'A wedding at the temple and the cake is MELTING. Take my van, it has the cool box.'], ['mo', 'Smooth driving! Every bump wobbles it.']] },
      { t: 'ride', kind: 'van', near: [35, 64], label: 'Get in Chef Mo’s van' },
      { t: 'pickup', at: [34, 65], item: 'cake', label: 'Load the wedding cake', cp: true },
      { t: 'deliver', to: 'temple-steps', time: 80, fragile: 5, item: 'cake', label: 'Deliver the cake before it melts (gently!)' },
      { t: 'talk', lines: [['heron', 'A perfect cake. The bride is crying happy tears.']] },
    ] },
  { id: 'm10', ch: 2, title: 'The Golden Bell', giver: 'heron', at: 'heron', reward: 300, rep: 20, blurb: 'Chase the cart carrying the Golden Bell down Temple Hill.',
    steps: [
      { t: 'talk', lines: [['heron', 'There! The cart with the Golden Bell, rolling down the hill road!'], ['hero', 'Not on my watch.']] },
      { t: 'ride', kind: 'scooter', near: [24, 14], label: 'Grab a scooter', cp: true },
      { t: 'chase', who: 'cart', from: X('b', 'n'), route: [X('c', 'n'), X('c', 'm'), X('a', 'm'), X('a', 'n'), X('b', 'n')], bumps: 3, loot: 'h-bell', speed: 265, label: 'Bump the bell cart three times', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-bell', label: 'Grab the Golden Bell' },
      { t: 'goto', at: 'heron', label: 'Return the bell to Brother Heron' },
      { t: 'talk', lines: [['heron', 'It rings again! Listen.'], ['heron', 'The canal folk say a pearl glow was seen on a magpie boat. The Canal Quarter is open to you.']] },
    ] },
  // ── Chapter 3: the Canal Quarter (Pearl Lantern)
  { id: 'm11', ch: 3, title: 'Learn the Water', giver: 'kiri', at: 'kiri', reward: 110, rep: 12, blurb: 'Take a canal boat through Kiri’s course.',
    steps: [
      { t: 'talk', lines: [['kiri', 'Ever steered a boat? It’s like a scooter that’s had a big lunch.'], ['kiri', 'Through my lantern gates and back, before the tide turns.']] },
      { t: 'ride', kind: 'boat', near: 'jetty', label: 'Step into the canal boat', cp: true },
      { t: 'race', ride: 'boat', time: 70, marks: [[67, 32], [67, 46], [67, 58], [67, 40], [67, 14], [67, 26]], label: 'Steer through every lantern gate' },
      { t: 'talk', lines: [['kiri', 'Not bad! You only scared three ducks.']] },
    ] },
  { id: 'm12', ch: 3, title: 'Dumpling Disguise', giver: 'mo', at: 'lim', reward: 130, rep: 14, blurb: 'Fold dumplings as cover, then follow the magpie courier.',
    steps: [
      { t: 'talk', lines: [['lim', 'Psst. Magpies meet at the canal stall at midnight. Fold dumplings, look busy, listen.'], ['hero', 'I can fold a dumpling. Probably.']] },
      { t: 'goto', at: [52, 37], label: 'Go to the canal market stall', ride: 'foot', cp: true },
      { t: 'mini', kind: 'dumpling', level: 1, label: 'Fold dumplings and keep your ears open' },
      { t: 'talk', lines: [['pip', '…the lantern goes by boat at dawn…'], ['hero', 'Got it. Now to follow that courier.']] },
      { t: 'tail', from: [52, 40], route: [[56, 41], [58, 46], [58, 52], [50, 52], [47, 56], [47, 60]], label: 'Follow the courier without being seen', cp: true },
      { t: 'talk', lines: [['lim', 'A boathouse! I’ll let Kiri know.']] },
    ] },
  { id: 'm13', ch: 3, title: 'Hot Tip', giver: 'lim', at: 'lim', reward: 150, rep: 14, blurb: 'Use Mr Lim’s tip: porcelain is cheap on Canal Row and dear at the temple tonight.', tip: { market: 'temple', good: 'bowl', mult: 1.5 },
    steps: [
      { t: 'talk', lines: [['lim', 'Tip of the night: the temple’s caretakers smashed their bowls. They’ll pay double.'], ['lim', 'Canal Row has porcelain going cheap. A bigger ride carries more!']] },
      { t: 'trade', profit: 120, label: 'Make 120 coins profit (porcelain: Canal Row → Temple Hill)', cp: true },
      { t: 'goto', at: 'lim', label: 'Tell Mr Lim' },
      { t: 'talk', lines: [['lim', 'Read all about it: young chinchilla makes a killing!']] },
    ] },
  { id: 'm14', ch: 3, title: 'Wobbly Cargo', giver: 'kiri', at: 'kiri', reward: 160, rep: 14, blurb: 'Pedal a tower of clay pots over the canal bridges without a crash.',
    steps: [
      { t: 'talk', lines: [['kiri', 'My cousin’s pots need to get to the Night Market square. A trishaw rides smoothest.'], ['kiri', 'Six bumps and they’re shards. Slow round the corners!']] },
      { t: 'ride', kind: 'trishaw', near: [62, 22], label: 'Get on the trishaw', cp: true },
      { t: 'pickup', at: [63, 25], item: 'pots', label: 'Load the pots' },
      { t: 'deliver', to: 'mk-market', time: 110, fragile: 6, item: 'pots', label: 'Deliver the pots in one piece' },
      { t: 'talk', lines: [['kiri', 'Not a crack! You have gentle paws.']] },
    ] },
  { id: 'm15', ch: 3, title: 'The Pearl Lantern', giver: 'kiri', at: 'kiri', reward: 350, rep: 20, blurb: 'Boat chase down the canal after the Pearl Lantern.',
    steps: [
      { t: 'talk', lines: [['kiri', 'There’s the magpie boat, pearl glow and all! Take mine, quick!']] },
      { t: 'ride', kind: 'boat', near: 'jetty', label: 'Jump into the boat', cp: true },
      { t: 'chase', who: 'boat', from: [67, 30], route: [[67, 58], [67, 20], [67, 50], [67, 6]], bumps: 3, loot: 'h-lantern', speed: 225, label: 'Bump the magpie boat three times', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-lantern', label: 'Fish out the Pearl Lantern' },
      { t: 'goto', at: 'kiri', label: 'Bring the lantern to Kiri' },
      { t: 'talk', lines: [['kiri', 'It glows like a moon on the water. Thank you.'], ['kiri', 'Big Bo at the Docks says a silver fish was loaded into a magpie crate. The Docks are open!']] },
    ] },
  // ── Chapter 4: the Docks (Silver Koi)
  { id: 'm16', ch: 4, title: 'Night Shift', giver: 'bo', at: 'bo', reward: 140, rep: 12, blurb: 'Ferry three dock workers home in a tuk-tuk.',
    steps: [
      { t: 'talk', lines: [['bo', 'Welcome to the Docks, small one. My crew’s bus is broken and they’re sleepy.'], ['bo', 'Grab that tuk-tuk. Pick them up, drop them home, three fares.']] },
      { t: 'ride', kind: 'tuktuk', near: [56, 64], label: 'Get in the tuk-tuk', cp: true },
      { t: 'fares', n: 3, label: 'Drive three dock workers home' },
      { t: 'talk', lines: [['bo', 'They’re singing your name. Badly, but warmly.']] },
    ] },
  { id: 'm17', ch: 4, title: 'Container Maze', giver: 'bo', at: 'bo', reward: 180, rep: 14, blurb: 'Sneak through the container yard and pinch the shipping list.',
    steps: [
      { t: 'talk', lines: [['bo', 'The magpies run the container yard at night. Their shipping list is in the yard office.'], ['bo', 'Lookouts everywhere. Keep out of their torch beams. Sneak, wait, go.']] },
      { t: 'goto', at: 'yard-gate', label: 'Go to the yard gate', ride: 'foot', cp: true },
      { t: 'stealth', lookouts: [[[99, 69], [103, 69], [103, 72], [99, 72]], [[106, 72], [112, 72], [112, 73], [106, 73]], [[99, 77], [108, 77]], [[113, 76], [113, 80], [118, 80]]], goal: 'manifest', exit: 'yard-gate', label: 'Reach the office unseen, take the list, get out' },
      { t: 'talk', lines: [['bo', 'The Silver Koi ships at dawn in crate eleven. We’ll be ready.']] },
    ] },
  { id: 'm18', ch: 4, title: 'Hot Goods', giver: 'bristle', at: 'bo', reward: 160, rep: 14, blurb: 'The magpies framed you. Lose five lanterns of heat.',
    steps: [
      { t: 'talk', lines: [['bristle', 'Halt! A report says a chinchilla has been bumping my crates. Wardens, after them!'], ['hero', 'That was the magpies!'], ['bo', 'Run, little one! Lose them, then we sort it out.']] },
      { t: 'heat', level: 5, label: 'Lose all five lanterns of heat', cp: true },
      { t: 'goto', at: 'bo', label: 'Sneak back to Big Bo' },
      { t: 'talk', lines: [['bristle', 'Hmph. Big Bo vouches for you. Mind my crates.'], ['bo', 'He likes you really.']] },
    ] },
  { id: 'm19', ch: 4, title: 'Jump-Start Jamboree', giver: 'bo', at: 'bo', reward: 170, rep: 14, blurb: 'Magpies cut the dock scooters’ wires. Fix two and ride them to the garage.',
    steps: [
      { t: 'talk', lines: [['bo', 'Snip, snip, the magpies cut every scooter’s wires. Match the colours, she’ll start.']] },
      { t: 'ride', kind: 'scooter', near: [58, 68], locked: true, label: 'Jump-start the first scooter', cp: true },
      { t: 'goto', at: [57, 79], label: 'Ride it to the Tide Shed', r: 120 },
      { t: 'ride', kind: 'scooter', near: [76, 66], locked: true, label: 'Jump-start the second scooter', cp: true },
      { t: 'goto', at: [57, 79], label: 'Ride it to the Tide Shed', r: 120 },
      { t: 'talk', lines: [['bo', 'Purring like kittens. You’re handy!']] },
    ] },
  { id: 'm20', ch: 4, title: 'The Silver Koi', giver: 'bo', at: 'bo', reward: 400, rep: 20, blurb: 'Chase crate eleven through the docks.',
    steps: [
      { t: 'talk', lines: [['bo', 'Crate eleven is on that magpie cart! Go go go!']] },
      { t: 'ride', kind: 'scooter', near: [53, 64], label: 'Grab a scooter', cp: true },
      { t: 'chase', who: 'cart', from: X('d', 'd'), route: [X('e', 'd'), X('f', 'd'), [92, 78], X('f', 'd'), [74, 78], X('d', 'd')], bumps: 3, loot: 'h-koi', speed: 275, label: 'Bump the cart three times', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-koi', label: 'Catch the Silver Koi' },
      { t: 'goto', at: 'bo', label: 'Bring it to Big Bo' },
      { t: 'talk', lines: [['bo', 'Shiny! Now the last one. The Phoenix Drum is in Madame Glint’s roost, up the Arcade Strip.'], ['bo', 'The neon lights are on for you.']] },
    ] },
  // ── Chapter 5: the Arcade Strip (Phoenix Drum)
  { id: 'm21', ch: 5, title: 'Neon Night Race', giver: 'gizmo', at: 'gizmo', reward: 180, rep: 14, blurb: 'Beat a magpie racer round the Strip on a scooter.',
    steps: [
      { t: 'talk', lines: [['gizmo', 'Yo yo! A magpie racer says no chinchilla can beat him round the Strip.'], ['gizmo', 'Prove him wrong and I’ll tell you how to get into the Roost.']] },
      { t: 'ride', kind: 'scooter', near: [100, 25], label: 'Hop on a scooter', cp: true },
      { t: 'race', ride: 'scooter', rival: 'scooter', marks: [X('g', 'x'), X('g', 's'), X('f', 's'), X('f', 'm'), X('e', 'm'), X('e', 'x'), X('f', 'x'), [100, 24]], label: 'Win the race' },
      { t: 'talk', lines: [['gizmo', 'Legendary! The Roost has a back way: across the rooftops.']] },
    ] },
  { id: 'm22', ch: 5, title: 'Rooftop Relay', giver: 'gizmo', at: 'gizmo', reward: 200, rep: 14, blurb: 'Run the flat roofs, hopping the gaps, before time runs out.',
    steps: [
      { t: 'talk', lines: [['gizmo', 'Climb the ladder by the noodle bar. Hop the gaps between roofs. Fall and you just climb back.']] },
      { t: 'goto', at: [93, 44], label: 'Go to the ladder', ride: 'foot', cp: true },
      { t: 'race', ride: 'foot', roof: true, time: 60, marks: [[95, 43], [99, 43], [103, 43], [103, 39], [99, 39], [95, 39], [95, 35], [99, 35], [104, 35]], label: 'Hop across every roof marker' },
      { t: 'talk', lines: [['gizmo', 'You’re basically a bird. A fluffy one.']] },
    ] },
  { id: 'm23', ch: 5, title: 'Crack the Claw', giver: 'gizmo', at: 'gizmo', reward: 220, rep: 14, blurb: 'Collect the crew passcodes hidden around the Strip.',
    steps: [
      { t: 'talk', lines: [['gizmo', 'The Roost door wants three passcode tokens. Magpies stash them in claw machines.']] },
      { t: 'collect', items: [[85, 33], [104, 48], [115, 27]], item: 'token', time: 120, label: 'Collect the three passcode tokens', cp: true },
      { t: 'goto', at: [113, 57], label: 'Go to the Roost door', ride: 'foot' },
      { t: 'mini', kind: 'lock', level: 2, label: 'Pick the Roost lock' },
      { t: 'talk', lines: [['glint', 'Well, well. The fluffball found my door. Come and catch me, darling!']] },
    ] },
  { id: 'm24', ch: 5, title: 'Lantern Parade', giver: 'ren', at: 'gizmo', reward: 240, rep: 14, blurb: 'Escort the lion dance down the neon boulevard.',
    steps: [
      { t: 'talk', lines: [['ren', 'The parade must go through the Strip for the festival to begin. The whole Crew is waiting.'], ['hero', 'Let them try.']] },
      { t: 'escort', from: [80, 24], route: [[88, 24], [96, 24], [104, 24], [112, 24], [116, 24]], magpies: 8, label: 'Protect the lion dance', cp: true },
      { t: 'talk', lines: [['ren', 'The Crew scatters! Only Madame Glint remains.']] },
    ] },
  { id: 'm25', ch: 5, title: 'Glint’s Last Flight', giver: 'glint', at: 'gizmo', reward: 600, rep: 25, blurb: 'Catch Madame Glint and win back the Phoenix Drum.',
    steps: [
      { t: 'talk', lines: [['glint', 'You want the Phoenix Drum? Catch me if you can, on wheels!'], ['hero', 'Here we go.']] },
      { t: 'ride', kind: 'scooter', near: [110, 25], label: 'Get on a scooter', cp: true },
      { t: 'chase', who: 'boss', from: X('g', 'x'), route: [X('g', 's'), X('f', 's'), X('f', 'x'), X('g', 'x')], bumps: 2, loot: '', speed: 280, label: 'Bump Madame Glint twice', cp: true },
      { t: 'talk', lines: [['glint', 'Lucky bump! But I’m faster on the boulevard!']] },
      { t: 'chase', who: 'boss', from: X('f', 'm'), route: [X('e', 'm'), X('e', 'x'), X('g', 'x'), X('g', 'm')], bumps: 2, loot: '', speed: 290, label: 'Bump her twice more', cp: true },
      { t: 'talk', lines: [['glint', 'Grr! One last lap, and I won’t go easy!']] },
      { t: 'chase', who: 'boss', from: X('f', 's'), route: [X('g', 's'), X('g', 'x'), X('f', 'x'), X('f', 's')], bumps: 2, loot: 'h-drum', speed: 300, label: 'Final lap: two more bumps!', cp: true },
      { t: 'pickup', at: 'loot', item: 'h-drum', label: 'Take back the Phoenix Drum' },
      { t: 'talk', lines: [['glint', 'Fine, FINE. Shiny things are just so… shiny.'], ['pip', 'Boss, maybe we could join the festival instead?'], ['glint', '…With a nice seat near the lanterns?'], ['kee', 'All five heirlooms home! Light the lanterns, the festival begins!'], ['hero', 'Best night ever.']] },
    ] },
];
export const MISSION = Object.fromEntries(MISSIONS.map(m => [m.id, m])) as Record<string, Mission>;

// Jade Street: the story. The Kaypoh Crows swiped the quarter's five lucky heirlooms; jobs from the shopkeepers in
// chapters, the first five each ending in a chase for one heirloom that clears the fog from the next district, the
// sixth on the island. MISSIONS and SIDE are the only source of how many jobs there are (see jobCounts).
// Missions are lists of steps the runner in lib/jade-mission.ts understands; `cp` marks a checkpoint (a failed step
// restarts from the last one). Places are names from lib/jade-city.ts or [tileX, tileY] pairs. 'hero' in a line is
// whoever you are playing (Dora or Enzo) and 'mate' is the other one, your partner.
import type { District } from './jade-city.js';
import type { VehicleKind } from './jade-move.js';
import type { Good } from './jade-trade.js';
import { EMPIRE_JOBS } from './jade-empjobs.js';

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
  | { t: 'deliver'; to: Spot; time: number; label: string; item: string; fragile?: number; stink?: boolean; cp?: boolean;
    /** the ninth pass: the wardens are out in force; every ticket or warning while this step runs costs this many seconds */
    fines?: number }
  | { t: 'mini'; kind: MiniKind; level: number; label: string; cp?: boolean }
  /** `finish`: the last bump must be a double pounce (both heroes within a moment), the passenger's grab, or a net */
  | { t: 'chase'; who: 'cart' | 'boat' | 'boss' | 'runner'; from: Spot; route: Spot[]; bumps: number; loot: string; label: string; speed: number; sets?: SetDef[]; phase?: 1 | 2; finish?: 'pounce' | 'snatch' | 'net'; skin?: 'otter' | 'mac' | 'liz' | 'kaw' | 'myna' | 'nine'; cp?: boolean }
  /** `rope`: the float only swings in under the flags while the partner hauls the bunting rope there */
  | { t: 'float'; label: string; rope?: Spot; cp?: boolean }
  | { t: 'raid'; at: Spot; n: number; label: string; cp?: boolean }
  /** `relay`: from waypoint `at` on, the hero who started is easy for Pip to spot; the partner waits at `spot` */
  | { t: 'tail'; from: Spot; route: Spot[]; label: string; relay?: { at: number; spot: Spot }; cp?: boolean; /** under 1: the one you tail notices you more slowly */ calm?: number; /** a rival gang's runner (contracts) */ skin?: 'otter' | 'mac' | 'liz' | 'myna' }
  /** `flanks`: crows come in pairs from both sides and the partner guards the far flank */
  | { t: 'escort'; from: Spot; route: Spot[]; label: string; crows: number; flanks?: boolean; skin?: 'otter'; cp?: boolean }
  /** `relay`: the marks from this one on count only for the partner waiting there (a hand-off) */
  | { t: 'race'; marks: Spot[]; label: string; rival?: 'runner' | 'scooter' | 'boat'; roof?: boolean; time?: number; ride?: VehicleKind | 'foot'; relay?: number; cp?: boolean; /** the rival's speed against the usual (a slow raft) */ pace?: number }
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
  /** ride the cable car or the ferry to stop `to` (E at the station or the pier) */
  | { t: 'cable'; to: string; label: string; cp?: boolean }
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
  | { t: 'bag'; at: Spot; loot?: string; time?: number; label: string; skin?: 'myna'; cp?: boolean }
  // ── the seventh pass's job steps (lib/jade-jobs.ts)
  /** case the joint: photograph spots (E) from where you have a clear view of them, without the guards seeing you; each
   * photo is intel the next step uses (lib/jade-jobs.ts INTEL); `need` photos end the step (all of them by default) */
  | { t: 'case'; spots: { at: Spot; kind: Intel }[]; guards: Spot[][]; need?: number; label: string; cp?: boolean }
  /** the heist: choose quiet or loud. Quiet sneaks in at `back` (only with the back door cased) or at `front`, past the
   * guards and `cams` ([x, y, facing in degrees]), cracks the safe and slips out the same way; loud sends the partner
   * to set off a confetti diversion at the front, then it is a race to the safe before `time` runs out and a getaway
   * with heat to `drop`. Spotted on a quiet job, the alarm goes off and it turns loud */
  | { t: 'heist'; front: Spot; back: Spot; safe: Spot; drop: Spot; guards: Spot[][]; cams: [number, number, number][]; time: number; loot: string; level: number; label: string; cp?: boolean }
  /** hold out: `waves` waves of a gang (`per` in the first, one more each wave after) raid `at` for `time` seconds;
   * knock them back before they grab; `what` names the thing you guard (the Stall, the Stage, the Float) */
  | { t: 'defend'; at: Spot; time: number; waves: number; per: number; gang: 'mac' | 'otter' | 'crow' | 'myna'; what: string; label: string; cp?: boolean }
  /** blend in: put on the disguise at `rack` (the partner waits there), then walk with the crowd along `route` to `goal`
   * past the lookouts ([x, y, facing in degrees]); running, hopping, bumping folk or walking alone where they look
   * raises Suspicion */
  | { t: 'blend'; rack: Spot; route: Spot[]; goal: Spot; lookouts: [number, number, number][]; crowd: number; folk?: 'intern' | 'town'; label: string; cp?: boolean }
  /** the detective: ask the witnesses (the right question gets a clue), then search the spots for the one that fits
   * every clue; nothing is pinned (Assist draws a ring that narrows with each clue) */
  | { t: 'detective'; witnesses: Witness[]; spots: { at: Spot; tags: string[]; what: string }[]; item: string; time: number; label: string; cp?: boolean }
  /** set a trap: lay nets at `need` of the trap spots (E), put the bait down at `bait`, keep back by `wait`, and spring
   * a net (F) while one of the gang walking `path` is on it; catch `catch` of the `n` */
  | { t: 'trap'; spots: Spot[]; need: number; bait: Spot; wait: Spot; path: Spot[]; gang: 'mac' | 'otter' | 'liz' | 'crow' | 'myna'; n: number; catch: number; label: string; cp?: boolean }
  /** swap: slip a decoy into each crate (E: a moment crouched at it) while the guards look the other way */
  | { t: 'swap'; crates: Spot[]; guards: Spot[][]; time: number; decoy: string; skin?: 'liz' | 'myna'; label: string; cp?: boolean };
/** what a photo while casing tells you: the back way in, the guards' beats, where the cameras are wired, the safe's make */
export type Intel = 'door' | 'rota' | 'cam' | 'safe';
/** a witness: `ask` are the three questions on offer, `right` the one that gets the clue (its `tag` must be among the
 * hiding spot's tags), `junk` what they say to the others */
export type Witness = { at: Spot; sp: string; name: string; ask: [string, string, string]; right: number; clue: string; tag: string; junk: [string, string, string] };
export type MiniKind = 'lock' | 'wires' | 'wok' | 'dumpling' | 'haggle' | 'kopi' | 'safe';
/** `side`: a Hawker Tales side job, offered once that story job is done (lib/jade-save.ts sideJobs) */
export type Mission = { id: string; side?: string; ch: number; title: string; giver: string; at: string; blurb: string; reward: number; rep: number; steps: Step[]; tip?: { market: District; good: Good; mult: number };
  /** the eleventh pass's contracts (lib/jade-proc.ts): modifiers the runner applies, and the giver's barks when it fails */
  mods?: ('night' | 'rain' | 'timer' | 'foot' | 'solo' | 'wardens')[]; fails?: string[] };

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
  // the ninth pass: Little India, Kampong Glam and Sentosa
  raju: { name: 'Mr Raju', face: 'face-raju', who: 'Little India spice merchant (a mongoose)' },
  malar: { name: 'Auntie Malar', face: 'face-malar', who: 'garland-stall auntie (a spotted dove)' },
  kancil: { name: 'Abang Kancil', face: 'face-kancil', who: 'Arab Street textile trader (a mousedeer)' },
  wangi: { name: 'Puan Wangi', face: 'face-wangi', who: 'Kampong Glam perfumer (a binturong)' },
  duyung: { name: 'Kapten Duyung', face: 'face-duyung', who: 'Sentosa ferry captain (a dugong)' },
  helang: { name: 'Sergeant Helang', face: 'face-helang', who: 'Fort Siloso ranger (a sea eagle)' },
  bising: { name: 'Boss Bising', face: 'face-bising', who: 'Kecoh Mynahs boss (a mynah)' },
  nine: { name: 'Crow Number Nine', face: 'face-nine', who: 'Director Kaw’s old assistant (a house crow)' },
  // the tenth pass: the empire's supplier, the health inspector, the rival towkay and the jaga you can hire
  huat: { name: 'Ah Huat', face: 'face-huat', who: 'wholesale supplier (a wild boar)' },
  siew: { name: 'Inspector Siew', face: 'face-siew', who: 'health inspector (a milky stork)' },
  hoot: { name: 'Towkay Hoot', face: 'face-hoot', who: 'rival towkay (a buffy fish owl)' },
  duri: { name: 'Pak Duri', face: 'face-duri', who: 'night watchman, a jaga (a porcupine)' },
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
export const CHAPTERS = ['Smith Street', 'Temple Street', 'Boat Quay', 'Tanjong Pagar Docks', 'Clarke Quay', 'The Island', 'Island Lights'];
/** the last job of each chapter (its finale) */
export const FINALE = ['m5', 'm10', 'm15', 'm20', 'm25', 'm35', 'm45'];
/** the story job that opens Sentosa (half way through chapter seven) */
export const RESORT_OPENS = 'm40';

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
      { t: 'ride', kind: 'scooter', near: [19, 45], locked: true, label: 'Jump-start the red scooter by the kerb (E), then ride it' },
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
  { id: 'm10', ch: 2, title: 'The Golden Bell', giver: 'heron', at: 'heron', reward: 300, rep: 20, blurb: 'Slip in with the temple crowd to find the Golden Bell, then chase the cart carrying it down Temple Street.',
    steps: [
      { t: 'talk', lines: [['heron', 'Crows in the courtyard, dressed as pilgrims. One of them has the Golden Bell.', 'worried'], ['heron', 'Take a shawl from the rack by me and walk with the worshippers to the pagoda. Do not run, and listen.', 'calm'], ['mate', 'I’ll watch the gate. Stay among the crowd.', 'calm']] },
      { t: 'blend', rack: [21, 9], route: [[22, 9], [25, 8], [28, 8], [31, 7], [33, 8]], goal: [33, 8], lookouts: [[25, 6, 90], [29, 10, 270], [34, 5, 110]], crowd: 9, label: 'Walk with the worshippers to the pagoda (no running in the shawl!)', cp: true },
      { t: 'talk', lines: [['pip', '…bell’s on the cart, down the hill road, go go go!', 'smug'], ['heron', 'There! The cart with the Golden Bell, rolling down the hill road!', 'worried'], ['hero', 'Not on my watch.', 'cross']] },
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
  { id: 'm12', ch: 3, title: 'Dumpling Disguise', giver: 'mo', at: 'lim', reward: 130, rep: 14, blurb: 'Fold dumplings as cover, then put on a disguise and drift past the crows’ lookouts to listen in.',
    steps: [
      { t: 'talk', lines: [['lim', 'Psst. Crows meet at the canal steps at midnight. Fold dumplings, look busy, listen.', 'smug'], ['hero', 'I can fold a dumpling. Probably.', 'worried']] },
      { t: 'goto', at: [52, 37], label: 'Go to the canal market stall', ride: 'foot', cp: true },
      { t: 'mini', kind: 'dumpling', level: 1, label: 'Fold dumplings and keep your ears open' },
      { t: 'talk', lines: [['lim', 'Good cover. They’re huddled down by the canal steps now. Take a coat off my rack and stroll over with the shoppers.', 'smug'], ['mate', 'I’ll mind the rack. Walk, don’t run. If a lookout stares, read your paper (E).', 'smug']] },
      { t: 'blend', rack: [47, 39], route: [[46, 39], [50, 39], [55, 39], [59, 38], [63, 38], [64, 41]], goal: [64, 41], lookouts: [[53, 36, 90], [58, 41, 270], [63, 35, 100]], crowd: 10, label: 'Stroll with the shoppers to the canal steps (no running in the coat!)', cp: true },
      { t: 'talk', lines: [['pip', '…the lantern goes by boat at dawn, from the old boathouse…', 'smug'], ['hero', '(A boathouse at dawn. Got it.)', 'smug'], ['lim', 'A boathouse! I’ll let Kiri know.', 'happy']] },
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
  { id: 'm17', ch: 4, title: 'Container Maze', giver: 'bo', at: 'bo', reward: 180, rep: 14, blurb: 'Case the container yard with a camera, then crack the office safe for the shipping list: quietly, or with a bang.',
    steps: [
      { t: 'talk', lines: [['bo', 'The crows run the container yard at night. Their shipping list is locked in the office safe.', 'worried'], ['bo', 'Case it first. Photograph what you can from the shadows: every photo makes the job easier.', 'calm']] },
      { t: 'goto', at: 'yard-gate', label: 'Go to the yard gate', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: [120, 69], kind: 'door' }, { at: [97, 68], kind: 'rota' }, { at: [110, 69], kind: 'cam' }, { at: 'manifest', kind: 'safe' }], need: 3, guards: [[[99, 69], [103, 69], [103, 72], [99, 72]], [[106, 72], [112, 72], [112, 73], [106, 73]], [[99, 77], [108, 77]], [[113, 76], [113, 80], [118, 80]]], label: 'Photograph three things (E) from cover: the back door, the guard rota, the camera wiring, the safe' },
      { t: 'talk', lines: [['mate', 'Right. Quiet: we sneak in, crack it, sneak out. Loud: I fire the confetti cannon at the gate and you run for it.', 'smug'], ['hero', 'Loud means heat. Quiet means nerves.', 'calm']] },
      { t: 'heist', front: 'yard-gate', back: [120, 69], safe: 'manifest', drop: 'mk-docks', guards: [[[99, 69], [103, 69], [103, 72], [99, 72]], [[106, 72], [112, 72], [112, 73], [106, 73]], [[99, 77], [108, 77]], [[113, 76], [113, 80], [118, 80]]], cams: [[105, 70, 0], [114, 75, 270]], time: 70, loot: 'manifest', level: 2, label: 'Crack the yard office safe', cp: true },
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
  { id: 'm24', ch: 5, title: 'Lantern Parade', giver: 'ren', at: 'gizmo', reward: 240, rep: 14, blurb: 'Hold the lion dance’s parade float on the neon boulevard while the whole Crew swoops in for its lanterns.',
    steps: [
      { t: 'talk', lines: [['ren', 'The parade must stop on the Strip for the festival to begin. The whole Crew is waiting for our float.', 'worried'], ['hero', 'Let them try.', 'smug']] },
      { t: 'talk', lines: [['mate', 'They’ll come in waves for the lanterns. Run into them, dash, hop: anything that knocks them back. I’ll take the far side.', 'smug'], ['ren', 'And if they grab one, tidy the float between waves (E).', 'calm']] },
      { t: 'defend', at: [104, 23], time: 70, waves: 3, per: 2, gang: 'crow', what: 'Float', label: 'Hold the parade float: knock the crows back before they grab its lanterns ({mate} guards the far side)', cp: true },
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
  { id: 'm26', ch: 6, title: 'Next Stop, Toa Payoh', giver: 'glint', at: 'stn-chinatown', reward: 260, rep: 14, blurb: 'Ride the Jade Line to Toa Payoh, ask around the interchange and work out where a crow hid Mr Kamal’s station keys.',
    steps: [
      { t: 'talk', lines: [['glint', 'Darlings! Bad news. My cousin, Director Kaw, has turned the Crew into a company. Kaypoh Crows Pte Ltd.', 'worried'], ['pip', 'He has a briefcase. And a slogan. Franchising mischief island-wide!', 'worried'], ['hero', 'Then we go island-wide too.', 'smug'], ['mate', 'The Jade Line runs from right here. Two coins a ride. And no durians on the train!', 'smug']] },
      { t: 'train', to: 'stn-toapayoh', label: 'Take the Jade Line to Toa Payoh (E at the station entrance)', cp: true },
      { t: 'talk', lines: [['kamal', 'Welcome to Toa Payoh! I’m Mr Kamal, station master. Also: robbed. A crow in a little tie snatched my station keys and hid them somewhere round here!', 'worried'], ['mate', 'Somebody saw something. Ask the right question and they’ll remember.', 'smug'], ['hero', 'Then we search the one place that fits every clue. No guessing.', 'calm']] },
      { t: 'detective', item: 'loot-bag', time: 150, witnesses: [
        { at: [148, 32], sp: 'rabbit', name: 'auntie with the trolley', ask: ['Did you see which way he went?', 'Was he carrying anything?', 'Was he in a hurry?'], right: 0, clue: 'He hopped under the covered walkway, out of the rain.', tag: 'roof', junk: ['', 'A briefcase? A bag? Aiyoh, so many crows these days.', 'Everybody in Toa Payoh is in a hurry. Couldn’t say.'] },
        { at: [157, 29], sp: 'sunbear', name: 'uncle at the bus stop', ask: ['Which way did the crow go?', 'What did the crow smell of?', 'What colour was his tie?'], right: 1, clue: 'Curry puffs! He must have hidden them near food.', tag: 'food', junk: ['Behind the bus. When it left, he was gone.', '', 'Red? Blue? I am colour-blind, lah.'] },
        { at: [140, 32], sp: 'duck', name: 'cleaner by the drain', ask: ['Did he drop anything?', 'Where did he fly off to?', 'Did he say anything?'], right: 0, clue: 'A grey feather, on something blue. I swept it up after.', tag: 'blue', junk: ['', 'Up. Crows fly up. Then I sweep.', 'Caw. Just caw. Very rude.'] },
      ], spots: [
        { at: [146, 25], tags: ['food', 'roof'], what: 'curry puff stall’s crates' },
        { at: [156, 25], tags: ['blue', 'roof'], what: 'blue recycling bins' },
        { at: [139, 22], tags: ['blue', 'food', 'roof'], what: 'blue cooler box under the kopitiam awning' },
        { at: [144, 32], tags: [], what: 'flower planters' },
        { at: [165, 32], tags: ['blue'], what: 'blue bicycle rack' },
      ], label: 'Ask the witnesses round the interchange (E), then search where the clues point', cp: true },
      { t: 'goto', at: 'kamal', label: 'Bring the keys back to Mr Kamal', ride: 'foot' },
      { t: 'talk', lines: [['kamal', 'My keys! The trains can sleep tonight. The heartlands owe you one.', 'happy'], ['kamal', 'That crow said Director Kaw is hiring. The Bukit Bunch, the lizards in the longkang, even the bay otters.', 'worried'], ['hero', 'Then we talk to them first.', 'smug']] },
    ] },
  { id: 'm27', ch: 6, title: 'Void Deck Monkeys', giver: 'kow', at: 'raintree', reward: 280, rep: 14, blurb: 'Big Kow’s nephews stashed mooncake boxes on the void-deck ledges for Director Kaw. Get them down, then net the nephews when they come back for more.',
    steps: [
      { t: 'talk', lines: [['kow', 'Ooh ooh. Okay, okay. A crow in a suit promised my nephews a lifetime of bananas.', 'worried'], ['kow', 'They pinched the residents’ mooncakes and hid them up on the ledges. Paiseh!', 'worried'], ['mate', 'Ledges are my job. You drive under them, I knock the boxes down.', 'smug'], ['hero', 'Mooncakes up on the ledges. Scooter first, then we hop up and get them.', 'calm']] },
      { t: 'ride', kind: 'scooter', near: [142, 10], label: 'Get on a scooter ({mate} hops on behind)', cp: true },
      { t: 'collect', items: [[131, 9], [148, 9], [162, 9], [176, 11]], item: 'mooncakes', time: 95, high: true, label: 'Ride under each ledge and press F: {mate} knocks the mooncakes down (or shoot them)' },
      { t: 'goto', at: 'raintree', label: 'Back to Big Kow’s rain tree', ride: 'foot' },
      { t: 'talk', lines: [['kow', 'All of them? Wah. But my nephews will be back for more, they always are. Ah Tan leads them.', 'cross'], ['mate', 'Then we’re ready for them. Nets on their path, a mooncake for bait, and we wait well back.', 'smug'], ['hero', 'And spring each net (F) when one of them is right on it.', 'calm']] },
      { t: 'trap', spots: [[155, 10], [149, 10], [143, 10], [140, 9]], need: 3, bait: [138, 8], wait: [146, 3], path: [[162, 10], [155, 10], [149, 10], [143, 10], [139, 8]], gang: 'mac', n: 3, catch: 2, label: 'Lay three nets on the nephews’ path (E)', cp: true },
      { t: 'talk', lines: [['kow', 'Okay lah. The Bukit Bunch is out of Kaw’s company. Bananas are not everything.', 'happy'], ['kow', 'Ah Tan says the lizards in the drain are keeping something for him.', 'calm']] },
    ] },
  { id: 'm28', ch: 6, title: 'Longkang Lizards', giver: 'lepak', at: 'lepak', reward: 300, rep: 14, blurb: 'Tail Kaw’s courier to the wet market, then swap the goods in his crates for decoys under his guards’ noses.',
    steps: [
      { t: 'talk', lines: [['lepak', 'Mmm. I am Lord Lepak. Lepak means I don’t move much. Why are you disturbing my sunbathing?', 'calm'], ['hero', 'Your lizards are keeping things for Director Kaw.', 'smug'], ['lepak', 'Are they? Hmm. I was sleeping. Follow his courier and see.', 'calm'], ['mate', 'The courier will know your face. I’ll wait by the wet market: switch to me there.', 'smug']] },
      { t: 'tail', from: [136, 24], route: [[143, 24], [150, 24], [157, 24], [163, 24], [164, 30]], relay: { at: 3, spot: [155, 21] }, calm: 0.75, label: 'Follow the courier out of sight; switch to {mate} at the corner (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'He’s packing crates behind the wet market, and two of your lizards are guarding them.', 'cross'], ['lepak', 'Ah. Kaw pays them in kueh. Very lazy guards, my lizards: they look round now and then, that’s all.', 'calm'], ['mate', 'Here: decoy boxes. Swap them in while they look the other way. F and I’ll keep one busy.', 'smug']] },
      { t: 'swap', crates: [[157, 22], [161, 22], [165, 21], [158, 25]], guards: [[[155, 23], [166, 23]], [[167, 20], [167, 26]]], time: 90, decoy: 'decoy', skin: 'liz', label: 'Slip a decoy into each crate (E) while the lizards look away', cp: true },
      { t: 'goto', at: 'lepak', label: 'Show Lord Lepak what was in the crates', ride: 'foot' },
      { t: 'talk', lines: [['lepak', 'Stage passes for Island Night at the Float-About Stage. And a drawing of the Golden Chinchilla.', 'worried'], ['lepak', 'Kaw paid us in kueh. Very nice kueh. But the Longkang Lizards don’t steal awards. Too much effort.', 'happy'], ['mate', 'And Kaw’s crows are driving off with boxes of nothing. So Island Night is the big caper.', 'cross']] },
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
  { id: 'm32', ch: 6, title: 'Office Hours', giver: 'vanda', at: 'raffles', reward: 340, rep: 14, blurb: 'Walk into the Kaypoh Crows’ head office in disguise with the interns, then sneak up to Kaw’s desk for his Island Night plan.',
    steps: [
      { t: 'talk', lines: [['vanda', 'Kaypoh Crows Pte Ltd has a head office now. With a water cooler. And lookouts on the plaza.', 'worried'], ['vanda', 'The interns change shift at midnight. Borrow a coat off my rack and walk in with them.', 'happy'], ['mate', 'I’ll wait by the rack. Stay among the interns and keep to a walk.', 'smug']] },
      { t: 'blend', rack: [152, 61], route: [[152, 60], [149, 59], [146, 58], [144, 58]], goal: [144, 58], lookouts: [[147, 57, 150], [150, 62, 250], [145, 61, 300]], crowd: 9, folk: 'intern', label: 'Walk in with the interns (keep to a walk, stay among them)', cp: true },
      { t: 'talk', lines: [['mate', 'Made it! Inside, the shutter only stays up while someone holds the lever. Send me (F), then sneak in.', 'smug'], ['hero', 'Sneak. Shift. Got it.', 'calm']] },
      { t: 'stealth', lookouts: [[[132, 57], [138, 57]], [[132, 61], [139, 61]], [[139, 56], [139, 60]]], goal: 'crownest', exit: [142, 58], shutter: [133, 60], calm: 0.7, pause: 1.5, label: 'Send {mate} to the shutter lever (F), reach Kaw’s desk unseen, then get out', cp: true },
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
  // ── chapter seven: Island Lights. Kaw has gone home to hold Glint's lanterns, but his old assistant, Crow Number
  // Nine, keeps the company's spare keys and has hired Boss Bising's Kecoh Mynahs, who can copy anybody's voice. In
  // Little India they muddle Deepavali, in Kampong Glam the Hari Raya bazaar, and the big caper is the island's
  // fireworks on Sentosa
  { id: 'm36', ch: 7, title: 'Garlands for Deepavali', giver: 'kamal', at: 'kamal', reward: 380, rep: 15, blurb: 'The Jade Line runs on to Little India. Someone in Auntie Malar’s own voice cancelled the temple’s garlands: find where they went and get them to the temple in time.',
    steps: [
      { t: 'talk', lines: [['kamal', 'Good news! The Jade Line runs on now: Bugis, Little India, even Beach station on Sentosa when it opens.', 'happy'], ['kamal', 'Bad news: Auntie Malar at the flower market phoned. Or someone with her voice did.', 'worried'], ['mate', 'Someone copying voices? That’s new.', 'worried'], ['hero', 'Little India station, then. Two coins.', 'smug']] },
      { t: 'train', to: 'stn-littleindia', label: 'Take the Jade Line to Little India (E at the station gates)', cp: true },
      { t: 'goto', at: 'malar', label: 'Find Auntie Malar at the flower market on Buffalo Road', ride: 'foot' },
      { t: 'talk', lines: [['malar', 'Vanakkam, my dears! Somebody called the temple in MY voice and said no garlands this year. Then my jasmine strings vanished!', 'worried'], ['malar', 'Deepavali is in two nights. The whole street will be lit. The garlands must be there.', 'worried'], ['hero', 'Somebody round here saw something. We ask, then we search where the clues point.', 'calm']] },
      { t: 'detective', item: 'garland', time: 150, witnesses: [
        { at: [236, 10], sp: 'rabbit', name: 'auntie by the Emporium doors', ask: ['Did you hear anybody shouting?', 'Did you see who it was?', 'Did they go into the Emporium?'], right: 0, clue: 'Shouting in Auntie Malar’s voice! From up high, on a ledge. Funny voice, very squeaky.', tag: 'high', junk: ['', 'Too many people tonight. Everybody looks like somebody.', 'Maybe? Everybody goes into the Emporium. Twenty-four hours!'] },
        { at: [252, 9], sp: 'sunbear', name: 'uncle with the flower cart', ask: ['Which way did they go?', 'What did they smell of?', 'How many of them were there?'], right: 1, clue: 'Sweets! Ghee and sugar. Whoever took the jasmine was eating jalebi.', tag: 'sweet', junk: ['Every way. Little India has many ways.', '', 'One? Five? They move so fast, I lost count.'] },
        { at: [241, 32], sp: 'duck', name: 'cleaner on Serangoon Road', ask: ['Did anyone drop something?', 'Did they touch the light-up?', 'What were they wearing?'], right: 0, clue: 'Black feathers with white patches, stuck on something blue. Mynah feathers, I tell you.', tag: 'blue', junk: ['', 'The switch box is playing up, but who did it, I don’t know.', 'Scarves? Hats? In thirty years I never look at clothes.'] },
      ], spots: [
        { at: [241, 9], tags: ['sweet', 'high'], what: 'flower planters by the sari shop' },
        { at: [260, 9], tags: ['blue', 'high'], what: 'blue recycling bins behind the villa' },
        { at: [233, 32], tags: ['sweet', 'blue', 'high'], what: 'blue cooler box under the shophouse awning' },
        { at: [250, 33], tags: ['blue'], what: 'bicycle rack by the rain trees' },
        { at: [222, 10], tags: ['sweet'], what: 'newspaper stack by the temple gate' },
      ], label: 'Ask round Serangoon Road (E), then search where every clue points', cp: true },
      { t: 'talk', lines: [['hero', 'Jasmine and marigold, every string. And a mynah feather on the lid.', 'smug'], ['mate', 'The temple wants them before the lamps are lit. Run, don’t squash them!', 'cross']] },
      { t: 'deliver', to: 'temple-li', item: 'garland', time: 60, fragile: 4, label: 'Carry the garlands to the temple on Race Course Road (gently: bumps crush them)', cp: true },
      { t: 'talk', lines: [['malar', 'You found them! The temple steps look like a festival already. Thank you, thank you.', 'happy'], ['raju', 'Mynahs. Javan mynahs, the Kecoh lot. They copy everything: phones, whistles, Auntie’s voice.', 'cross'], ['raju', 'And they don’t steal for themselves. Somebody is paying them in jalebi.', 'worried']] },
    ] },
  { id: 'm37', ch: 7, title: 'The Spice Switch', giver: 'raju', at: 'raju', reward: 400, rep: 15, blurb: 'The mynahs carried Mr Raju’s Deepavali spices off to the yard behind the Emporium. Swap them for sacks of sawdust while the mynah lookouts aren’t watching.',
    steps: [
      { t: 'talk', lines: [['raju', 'Cardamom, cumin, turmeric, my best garam masala. Twelve sacks, gone to the yard behind the Emporium.', 'cross'], ['raju', 'The mynahs guard them for someone. They look around, they chatter, they look away. Silly birds, but sharp eyes.', 'calm'], ['mate', 'Sawdust sacks for spice sacks. Like Uncle Teo’s kopi. They won’t know till they cook.', 'smug']] },
      { t: 'goto', at: [228, 10], label: 'Go round to the yard behind the All-Hours Emporium', ride: 'foot', cp: true },
      { t: 'swap', crates: [[230, 9], [234, 10], [238, 9], [241, 10]], guards: [[[229, 7], [242, 7]], [[242, 11], [229, 11]]], time: 90, decoy: 'decoy', skin: 'myna', label: 'Slip a sawdust sack into each pile (E) while the mynahs look away', cp: true },
      { t: 'goto', at: 'raju', label: 'Bring the spices back to Mr Raju', ride: 'foot' },
      { t: 'talk', lines: [['raju', 'Smell that! Now my shop smells like Deepavali again.', 'happy'], ['raju', 'Under the sacks: a ticket stub for Sentosa’s fireworks night, and a note. “Payment in jalebi. Signed, No. 9.”', 'worried'], ['hero', 'Crow Number Nine. Kaw’s old assistant.', 'cross']] },
    ] },
  { id: 'm38', ch: 7, title: 'Light-Up Night', giver: 'malar', at: 'malar', reward: 420, rep: 16, blurb: 'Fix the Deepavali light-up over Serangoon Road, then guard Auntie Malar’s sweets stall from a mynah raid while the street lights up.',
    steps: [
      { t: 'talk', lines: [['malar', 'Tonight the light-up goes on over Serangoon Road. But the switch box is all tangled. Somebody pulled the wires!', 'worried'], ['mate', 'Wires are my favourite. Then we stand guard: the mynahs will want the sweets.', 'smug'], ['malar', 'Murukku, laddu, jalebi for the whole street. Open house!', 'happy']] },
      { t: 'goto', at: [243, 33], label: 'To the light-up arch on Serangoon Road', ride: 'foot', cp: true },
      { t: 'mini', kind: 'wires', level: 2, label: 'Rewire the light-up’s switch box' },
      { t: 'talk', lines: [['hero', 'Lights on! Look at that arch.', 'happy'], ['mate', 'And here come the mynahs. Wave after wave. Knock them back before they grab a box!', 'cross']] },
      { t: 'defend', at: 'serangoon', time: 70, waves: 3, per: 2, gang: 'myna', what: 'Stall', label: 'Guard Auntie Malar’s sweets stall: knock the mynahs back before they grab ({mate} helps on their own)', cp: true },
      { t: 'talk', lines: [['malar', 'Happy Deepavali, my dears! Take a box of murukku. Take two!', 'happy'], ['bising', 'KECOH! Ah, never mind. Next time, chinchillas. Next time!', 'cross'], ['raju', 'That big loud one is Boss Bising. He has a roost somewhere across the river, in Kampong Glam.', 'calm']] },
    ] },
  { id: 'm39', ch: 7, title: 'Bolts of Arab Street', giver: 'kancil', at: 'kancil', reward: 420, rep: 16, blurb: 'Nine’s crows rent a back room off Haji Lane and keep Abang Kancil’s best songket there. Walk in with the shoppers, then follow the mynah courier home.',
    steps: [
      { t: 'talk', lines: [['kancil', 'Assalamualaikum, friends. My songket for the Hari Raya bazaar, woven gold, three bolts. A crow “bought” them with a cheque that bounced.', 'worried'], ['kancil', 'They keep them off Haji Lane, and lookouts on the corner watch for chinchillas.', 'calm'], ['mate', 'Then we don’t look like chinchillas. Porter’s coat from the stall, or we make a fuss and slip past.', 'smug']] },
      { t: 'blend', rack: [229, 45], route: [[233, 45], [238, 45], [242, 45], [242, 52], [240, 55]], goal: [238, 56], lookouts: [[236, 42, 270], [243, 50, 180], [243, 54, 120]], crowd: 9, folk: 'town', label: 'Walk with the shoppers along Arab Street into Haji Lane (keep to a walk)', cp: true },
      { t: 'talk', lines: [['hero', 'The songket! And a mynah stuffing a note in its beak. It’s leaving.', 'cross'], ['mate', 'Let it lead us home. I’ll wait past the mosque: switch to me there.', 'smug']] },
      { t: 'tail', from: [242, 56], route: [[243, 60], [250, 60], [262, 60], [268, 62], [269, 70]], relay: { at: 3, spot: [262, 59] }, calm: 0.8, label: 'Follow the courier out of sight; switch to {mate} past the mosque (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'Their roost. A whole rain tree full of mynahs, by the sea.', 'smug'], ['kancil', 'And my songket back home. Terima kasih! The bazaar will be beautiful.', 'happy']] },
    ] },
  { id: 'm40', ch: 7, title: 'Haji Lane Hush', giver: 'wangi', at: 'wangi', reward: 440, rep: 16, blurb: 'The mynahs copy every sound in Haji Lane and the shops can’t hear themselves think. Catch the noisiest: nets on their path, or run them down.',
    steps: [
      { t: 'talk', lines: [['wangi', 'Selamat malam. I make perfume, and perfume needs calm. Every night the mynahs land on Haji Lane and copy everything. Phones, bells, scooters, me!', 'cross'], ['wangi', 'Catch the three noisiest and Boss Bising will listen. He always does when his best singers are missing.', 'happy'], ['mate', 'Nets and jalebi for bait. Or we just chase them.', 'smug']] },
      { t: 'trap', spots: [[231, 55], [234, 56], [237, 55], [240, 56]], need: 3, bait: [242, 56], wait: [236, 61], path: [[228, 56], [231, 55], [234, 56], [237, 55], [240, 56], [242, 56]], gang: 'myna', n: 3, catch: 2, label: 'Lay three nets along Haji Lane (E)', cp: true },
      { t: 'talk', lines: [['bising', 'My singers! In nets! Okay, okay, chinchillas. Let them go and Bising tells you something.', 'worried'], ['bising', 'Crow Number Nine pays us in jalebi to copy voices. His big night is on Sentosa: the fireworks. Bridge is open now, cable car too.', 'calm'], ['wangi', 'Sentosa, then. Go, before he copies the whole sky.', 'happy']] },
    ] },
  { id: 'm41', ch: 7, title: 'Bazaar Night', giver: 'kancil', at: 'kancil', reward: 460, rep: 16, blurb: 'Hang the ketupat lanterns the mynahs scattered round Kampong Glam, then carry Puan Wangi’s attar crate to the Hari Raya bazaar. The wardens are out in force: every ticket costs time.',
    steps: [
      { t: 'talk', lines: [['kancil', 'The bazaar opens tonight on Bussorah Street! But the mynahs scattered our ketupat lanterns all over the place.', 'worried'], ['wangi', 'And my attar crate must be at the bazaar stall before the first customers. Gently, it is glass.', 'calm'], ['mate', 'Wardens everywhere tonight. Zebras, walk lights, no speeding. A ticket would cost us minutes.', 'smug']] },
      { t: 'collect', items: [[222, 44], [243, 57], [250, 59], [262, 71]], item: 'ketupat', time: 90, label: 'Gather the four ketupat lanterns round Kampong Glam', cp: true },
      { t: 'pickup', at: 'wangi', item: 'perfume', label: 'Pick up Puan Wangi’s attar crate' },
      { t: 'deliver', to: 'bussorah', item: 'perfume', time: 55, fragile: 4, fines: 8, label: 'Carry the attar to the bazaar on Bussorah Street: no tickets (each costs 8 s), no bumps', cp: true },
      { t: 'talk', lines: [['kancil', 'Selamat Hari Raya! Come, eat. Ketupat, rendang, kuih lapis, all for you.', 'happy'], ['wangi', 'Not one drop spilled. And not one ticket! You are very law-abiding thieves.', 'happy'], ['hero', 'We’re not thieves. We just take things back.', 'smug']] },
    ] },
  { id: 'm42', ch: 7, title: 'Up the Cable Car', giver: 'helang', at: 'cable-harbour', reward: 460, rep: 16, blurb: 'Ride the cable car over the harbour to Sentosa and catch the mynah who snatched Sergeant Helang’s fireworks schedule.',
    steps: [
      { t: 'talk', lines: [['helang', 'Sergeant Helang, Fort Siloso ranger. Salute! A mynah took the fireworks schedule out of my claws and flew to Sentosa!', 'cross'], ['helang', 'The cable car is fastest. Over the harbour, right to the island.', 'calm'], ['mate', 'A cable car! I call the window.', 'happy']] },
      { t: 'cable', to: 'cable-sentosa', label: 'Ride the cable car to Sentosa (E at the HarbourFront cable car)', cp: true },
      { t: 'talk', lines: [['hero', 'There! On the railing, with the schedule!', 'cross'], ['bising', 'Not mine! That one’s a freelancer. Catch him, catch him!', 'worried']] },
      { t: 'chase', who: 'runner', skin: 'myna', from: [70, 99], route: [[80, 99], [89, 99], [89, 110], [80, 117], [64, 117], [58, 110], [58, 99]], bumps: 2, loot: 'loot-bag', speed: 195, finish: 'net', label: 'Catch the mynah: bump it twice, then net it (click)', cp: true },
      { t: 'pickup', at: 'loot', item: 'loot-bag', label: 'Grab the fireworks schedule' },
      { t: 'talk', lines: [['helang', 'Excellent capture! The schedule says… the show’s firing box is stored at the theme park. Nine will want it.', 'worried'], ['mate', 'Then we get it first.', 'smug']] },
    ] },
  { id: 'm43', ch: 7, title: 'Galaxy Studios After Dark', giver: 'helang', at: 'park', reward: 480, rep: 17, blurb: 'Nine’s crows have the fireworks firing box locked in the ride-control office behind the Coral Dome. Case it, then take it: quiet or loud.',
    steps: [
      { t: 'talk', lines: [['helang', 'Galaxy Studios is shut for the night. Nine’s crows are in the ride-control office behind the Coral Dome.', 'worried'], ['mate', 'Look first, then go in. Doors, beats, cameras, the safe.', 'smug']] },
      { t: 'goto', at: [102, 111], label: 'Go round behind the Coral Dome', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: [111, 104], kind: 'door' }, { at: [103, 108], kind: 'rota' }, { at: [104, 105], kind: 'cam' }, { at: [107, 107], kind: 'safe' }], need: 3, guards: [[[103, 105], [110, 105]], [[110, 110], [103, 110]]], label: 'Photograph three things (E): the back door, the guard rota, the camera, the safe' },
      { t: 'talk', lines: [['mate', 'Quiet or loud? Either way the firing box comes out.', 'smug']] },
      { t: 'heist', front: [103, 111], back: [111, 104], safe: [107, 107], drop: 'park', guards: [[[103, 105], [110, 105]], [[110, 110], [103, 110]]], cams: [[104, 106, 0], [110, 108, 180]], time: 65, loot: 'firebox', level: 2, label: 'Crack the ride-control safe', cp: true },
      { t: 'talk', lines: [['helang', 'The firing box! Without it nobody sets off anything.', 'happy'], ['nine', 'Fine. Keep the box. Nine has a backup plan, and a boat.', 'calm'], ['duyung', 'A boat? In MY harbour? Come to the ferry pier, quick!', 'cross']] },
    ] },
  { id: 'm44', ch: 7, title: 'Ferry Fiasco', giver: 'duyung', at: 'duyung', reward: 480, rep: 17, blurb: 'The mynahs cut the harbour buoys loose and Nine’s raft is collecting them. Steer the bumboat round every buoy before the raft does.',
    steps: [
      { t: 'talk', lines: [['duyung', 'Kapten Duyung, ferry captain, fifty years on these waters. Somebody cut my buoys loose!', 'cross'], ['duyung', 'Nine’s raft is collecting them to mark out his own fireworks barge. Get to each buoy first!', 'worried'], ['mate', 'Bumboat’s by the pier. I’ll steer the spotlight.', 'smug']] },
      { t: 'ride', kind: 'boat', near: [125, 108], label: 'Jump in the bumboat by the ferry pier', cp: true },
      { t: 'race', ride: 'boat', rival: 'boat', pace: 0.9, time: 80, marks: [[132, 112], [142, 118], [132, 126], [114, 126], [96, 125], [124, 121]], label: 'Steer round every buoy before Nine’s raft', cp: true },
      { t: 'goto', at: 'duyung', label: 'Back to Kapten Duyung at the pier', ride: 'foot', r: 140 },
      { t: 'talk', lines: [['duyung', 'Every buoy home. The ferry runs to Marina Bay again: three coins, best view in Singapore.', 'happy'], ['bising', 'Psst. Chinchillas. Nine stopped paying in jalebi. He’s at the fort, with the spare fireworks. Bising helps you now.', 'calm']] },
    ] },
  { id: 'm45', ch: 7, title: 'Siloso Showdown', giver: 'bising', at: 'beach', reward: 1000, rep: 25, blurb: 'Crow Number Nine is holed up in Fort Siloso with the spare fireworks. Get past his mynah lookouts, chase him down the beach and win the island’s lights back.',
    steps: [
      { t: 'talk', lines: [['bising', 'Nine is in the old fort. The mynah lookouts still work for him, they don’t know yet. Bising is too loud to sneak.', 'worried'], ['helang', 'The fort gate has a lever. One holds it, one goes in.', 'calm'], ['mate', 'Send me to the lever (F). You sneak.', 'smug']] },
      { t: 'goto', at: [52, 110], label: 'Go to the edge of Siloso Point', ride: 'foot', cp: true },
      { t: 'stealth', lookouts: [[[47, 107], [47, 111]], [[36, 109], [44, 109]], [[45, 105], [45, 108]]], goal: 'fort', exit: [52, 110], shutter: [44, 111], calm: 0.5, pause: 1.5, label: 'Send {mate} to the gate lever (F), reach the fort unseen, then get out', cp: true },
      { t: 'talk', lines: [['nine', 'You again! Nine Lives Fireworks Pte Ltd will not be stopped! Kaw never let me run anything!', 'cross'], ['hero', 'He’s running for the beach!', 'cross'], ['mate', 'Pounce together: F sends me in, then dash!', 'cross']] },
      { t: 'chase', who: 'runner', skin: 'nine', from: [46, 110], route: [[52, 117], [64, 118], [78, 118], [90, 121], [104, 120], [86, 117]], bumps: 2, loot: '', speed: 205, finish: 'pounce', label: 'Pounce on Crow Number Nine together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['nine', 'Fine! Then nobody gets fireworks! Fly, little mynah, fly!', 'cross'], ['bising', 'That mynah is mine! Hey! Come back! Kecoh!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'firebox', skin: 'myna', time: 60, label: 'Knock the spare firing box out of the mynah’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'firebox', label: 'Catch the firing box' },
      { t: 'talk', lines: [['nine', 'I just wanted… one night that was mine.', 'worried'], ['kaw', 'Nine. Come home. You can run the lantern stall. Your own stall.', 'calm'], ['helang', 'And the island’s lights go up on Siloso Beach. Fire!', 'happy'], ['hero', 'Best fireworks ever.', 'happy'], ['mate', 'Best island ever. All of it.', 'happy']] },
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
  { id: 'k4', side: 'm8', ch: 0, title: 'Monkey Business', giver: 'hoon', at: 'hoon', reward: 120, rep: 10, blurb: 'The Bukit Bunch dropped the hawker centre’s takeaway bags all over Chinatown. Pick them up, then hold Auntie Hoon’s stall when they come back for more.',
    steps: [
      { t: 'talk', lines: [['hoon', 'Aiyoh! Those monkeys again! They grabbed all my takeaway bags!', 'worried'], ['kow', 'Ooh ooh! Finders keepers, auntie!', 'happy'], ['hoon', 'They dropped some running away. Pick them up first.', 'cross']] },
      { t: 'collect', items: [[13, 61], [26, 61], [29, 57]], item: 'bag', time: 90, label: 'Pick up the three takeaway bags the macaques dropped', cp: true },
      { t: 'goto', at: 'hoon', label: 'Bring the bags back to Auntie Hoon' },
      { t: 'talk', lines: [['kow', 'Ooh ooh! Everybody! Lunch is at Auntie Hoon’s!', 'happy'], ['hoon', 'Aiyoh, here they come! Don’t let them touch my chicken rice!', 'worried'], ['mate', 'Run into them, dash, hop: knock them back before they grab. I’ll take the far side.', 'smug']] },
      { t: 'defend', at: 'hoon', time: 60, waves: 2, per: 5, gang: 'mac', what: 'Stall', label: 'Guard Auntie Hoon’s stall: knock the macaques back before they grab', cp: true },
      { t: 'talk', lines: [['kow', 'Ooh. Paiseh, auntie. Can have one bun or not?', 'worried'], ['hoon', 'Aiyah, take one lah. Only one!', 'happy']] },
    ] },
  { id: 'k5', side: 'm4', ch: 0, title: 'The Kueh Recipe', giver: 'hoon', at: 'hoon', reward: 140, rep: 12, blurb: 'Auntie Hoon’s grandmother’s kueh lapis recipe has gone missing. Ask around the market and work out where Pip hid it.',
    steps: [
      { t: 'talk', lines: [['hoon', 'My mama’s kueh lapis recipe! Forty layers! Gone from my tin!', 'worried'], ['hero', 'Pip was on Smith Street this morning…', 'calm'], ['hoon', 'Ask around the market. But ask properly, ah! Then look where it fits.', 'cross']] },
      { t: 'detective', item: 'recipe', time: 140, witnesses: [
        { at: [22, 68], sp: 'cat', name: 'cat at the noodle stall', ask: ['What did Pip smell of?', 'Did Pip buy anything?', 'Did Pip look worried?'], right: 0, clue: 'Pandan! Sweet and green. He went near something sweet.', tag: 'sweet', junk: ['', 'Crows don’t queue. He didn’t buy, I’m sure.', 'Crows always look worried. Hard to say.'] },
        { at: [14, 74], sp: 'goose', name: 'goose with the umbrella', ask: ['Did Pip have the recipe with him?', 'Did Pip fly low or high?', 'Did Pip talk to anyone?'], right: 1, clue: 'High! Up on a shelf or an awning, he was.', tag: 'high', junk: ['A paper? Maybe a napkin? I only saw wings.', '', 'Not to me. Crows never say thank you.'] },
        { at: [25, 73], sp: 'hedgehog', name: 'hedgehog selling newspapers', ask: ['What was Pip holding?', 'Did Pip read the paper?', 'Did you see where Pip slept?'], right: 0, clue: 'A folded paper. He tucked it in with more paper, like a page in a book.', tag: 'paper', junk: ['', 'Crows only read the racing page. No, no.', 'In a tree? Crows sleep in trees, right?'] },
      ], spots: [
        { at: [13, 66], tags: ['sweet'], what: 'pandan leaf baskets' },
        { at: [24, 66], tags: ['high', 'paper'], what: 'newspaper bundle on the awning' },
        { at: [26, 71], tags: ['sweet', 'high'], what: 'stack of kueh steamers' },
        { at: [30, 66], tags: ['sweet', 'high', 'paper'], what: 'kueh boxes on the top shelf' },
        { at: [18, 80], tags: ['paper'], what: 'recycling bin' },
      ], label: 'Ask the stallholders (E), then search where the clues point', cp: true },
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
  { id: 'k7', side: 'm17', ch: 0, title: 'Getai Rescue', giver: 'lily', at: 'lily', reward: 160, rep: 12, blurb: 'Lily Sparkle’s getai show is tonight: fix the dead stage lights, then hold the stage against the crows until the curtain goes up.',
    steps: [
      { t: 'talk', lines: [['lily', 'Aiyoh, aiyoh! The show starts soon and my lights are dead!', 'worried'], ['lily', 'And the crows keep swooping in for my sequins! The spirits are waiting in the front row!', 'cross'], ['hero', 'Lights first, then the crows.', 'calm']] },
      { t: 'goto', at: 'getai', label: 'Go to the getai stage', r: 110, ride: 'foot' },
      { t: 'mini', kind: 'wires', level: 2, label: 'Rewire the stage lights', cp: true },
      { t: 'talk', lines: [['lily', 'The lights work! But look, the crows heard the music!', 'worried'], ['mate', 'Hold the stage till the curtain goes up! Knock them back before they grab the costumes.', 'smug']] },
      { t: 'defend', at: 'getai', time: 60, waves: 3, per: 3, gang: 'crow', what: 'Stage', label: 'Hold the getai stage: knock the crows back until the show starts', cp: true },
      { t: 'talk', lines: [['lily', 'Thank you, thank you! This song is for you two!', 'happy'], ['lily', 'Front row? No, no, that one is for the spirits. You sit second row.', 'calm']] },
    ] },
  { id: 'k8', side: 'm10', ch: 0, title: 'The Abacus Job', giver: 'pang', at: 'pang', reward: 170, rep: 12, blurb: 'The crows pawned Auntie Pang’s golden abacus and keep it in their counting-house safe. Case the lane, then take it back: quiet or loud.',
    steps: [
      { t: 'talk', lines: [['pang', 'My golden abacus! The crows say I “sold” it to them. I did not! Now it’s in the safe behind their counting house.', 'cross'], ['hero', 'A safe. Guards?', 'calm'], ['pang', 'Guards, a camera, a back door down the alley. Look first, then go in.', 'calm']] },
      { t: 'goto', at: [45, 23], label: 'Go to the end of the counting-house lane', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: [52, 16], kind: 'door' }, { at: [45, 26], kind: 'rota' }, { at: [46, 23], kind: 'cam' }, { at: [52, 21], kind: 'safe' }], need: 3, guards: [[[47, 23], [51, 23]], [[54, 23], [58, 23]], [[52, 26], [52, 29]]], label: 'Photograph three things (E): the alley door, the guard rota, the camera, the safe' },
      { t: 'talk', lines: [['mate', 'Quiet or loud? Either way, the abacus comes home.', 'smug']] },
      { t: 'heist', front: [45, 23], back: [52, 16], safe: [52, 21], drop: 'pang', guards: [[[47, 23], [51, 23]], [[54, 23], [58, 23]], [[52, 26], [52, 29]]], cams: [[46, 23, 0], [52, 22, 90]], time: 60, loot: 'abacus', level: 2, label: 'Crack the counting-house safe', cp: true },
      { t: 'talk', lines: [['pang', 'Every bead still there! Count it with me: one, two, three… thank you!', 'happy']] },
    ] },
  { id: 'k9', side: 'm7', ch: 0, title: 'The Kopi Switch', giver: 'teo', at: 'teo', reward: 130, rep: 10, blurb: 'The crows stacked Uncle Teo’s stolen kopi beans at the void deck to sell. Swap them for sacks of sawdust before they load up.',
    steps: [
      { t: 'talk', lines: [['teo', 'Aiyoh! My best kopi beans! The crows took six sacks to sell at the void deck. My beans!', 'worried'], ['mate', 'Then we swap them. Sawdust in their crates, beans back to Uncle Teo. They’ll never know till they brew it.', 'smug'], ['teo', 'Hah! Crow kopi with sawdust. Serve them right.', 'happy']] },
      { t: 'goto', at: [36, 74], label: 'Go round to the void deck', ride: 'foot', cp: true },
      { t: 'swap', crates: [[40, 75], [42, 77], [40, 80]], guards: [[[39, 73], [39, 81]], [[43, 72], [43, 80]]], time: 80, decoy: 'decoy', label: 'Slip a sawdust sack into each crate (E) while the guards look away', cp: true },
      { t: 'goto', at: 'teo', label: 'Back to Uncle Teo’s counter', ride: 'foot' },
      { t: 'talk', lines: [['teo', 'Smell that! My beans! Next kopi on the house, one week.', 'happy']] },
    ] },
  { id: 'k10', side: 'm15', ch: 0, title: 'Otter Ambush', giver: 'kiri', at: 'kiri', reward: 150, rep: 12, blurb: 'Ma Sleek’s otters raid Kiri’s jetty for her catch every night. Lay nets on the jetty, bait them with prawns, and spring the nets.',
    steps: [
      { t: 'talk', lines: [['kiri', 'Every night, the otters come up my jetty and take my catch. Cheeky!', 'cross'], ['mate', 'Nets on the jetty, a basket of prawns at the end, and we wait out of sight.', 'smug'], ['hero', 'And spring each net when one of them is on it. Gently!', 'calm']] },
      { t: 'trap', spots: [[64, 27], [64, 24], [64, 21], [64, 19]], need: 4, bait: [64, 17], wait: [60, 18], path: [[64, 30], [64, 26], [64, 22], [64, 18]], gang: 'otter', n: 4, catch: 3, label: 'Lay four nets on the jetty (E)', cp: true },
      { t: 'talk', lines: [['sleek', 'Hehe. Tangled! Okay okay, we buy our prawns now.', 'worried'], ['kiri', 'You’d better! Thank you, fluffies.', 'happy']] },
    ] },
  // the ninth pass's Hawker Tales, in Little India, Kampong Glam and on Sentosa
  { id: 'k11', side: 'm37', ch: 0, title: 'Teh Tarik Time', giver: 'raju', at: 'raju', reward: 170, rep: 12, blurb: 'Mr Raju’s cousin runs the teh tarik at the Tekka hawker centre and he’s run off his feet. Pull the orders, then run the tray over.',
    steps: [
      { t: 'talk', lines: [['raju', 'My cousin’s teh tarik stall: queue down to Race Course Road. Can you help pull the orders? Teh, teh-c, teh-o, kosong, siew dai…', 'worried'], ['mate', 'Same lingo as Uncle Teo’s kopi. We know this!', 'smug']] },
      { t: 'mini', kind: 'kopi', level: 2, label: 'Make the teh orders', cp: true },
      { t: 'deliver', to: 'hawker-li', item: 'kopi-tray', time: 45, fragile: 4, label: 'Run the tray to the hawker centre tables (no spills)' },
      { t: 'talk', lines: [['raju', 'Pulled so high, not a drop spilled! My cousin says you can have teh tarik free forever. Or one week.', 'happy']] },
    ] },
  { id: 'k12', side: 'm40', ch: 0, title: 'The Missing Attar', giver: 'wangi', at: 'wangi', reward: 180, rep: 12, blurb: 'One bottle of Puan Wangi’s rose attar went missing on Haji Lane. Ask the neighbours and find where it was hidden, by its scent and its clues.',
    steps: [
      { t: 'talk', lines: [['wangi', 'My rose attar, the oldest bottle, my grandmother’s recipe. A mynah, I think. It always copies my shop bell first.', 'worried'], ['hero', 'Ask around, then search. No guessing.', 'calm']] },
      { t: 'detective', item: 'perfume', time: 140, witnesses: [
        { at: [222, 56], sp: 'tapir', name: 'auntie at the café tables', ask: ['Did you smell roses?', 'Did the bird come in here?', 'Was the bird carrying a box?'], right: 0, clue: 'Roses, yes! Then something sweet, like the kuih stall. It went that way, past the bins.', tag: 'sweet', junk: ['', 'Here? No, no, only cats come in for the lamb.', 'A box, a bag, I was looking for my son. Sorry.'] },
        { at: [243, 59], sp: 'civet', name: 'student on Haji Lane', ask: ['Did you draw the bird?', 'Did you see where the bird landed?', 'Was it a crow or a mynah?'], right: 1, clue: 'On top of something. It hopped up high and pushed something under.', tag: 'high', junk: ['I draw walls, not birds. It was too quick.', '', 'Black bird. All black birds look the same at night.'] },
        { at: [234, 70], sp: 'mousedeer', name: 'office worker by Bugis station', ask: ['Did the bird drop anything?', 'Which way did it run?', 'Did anyone chase it?'], right: 0, clue: 'A scrap of newspaper. It was carrying the bottle wrapped in paper.', tag: 'paper', junk: ['', 'Towards the exit. Exit B. Or C. I always get lost.', 'In the bazaar crowd? Nobody can chase anything.'] },
      ], spots: [
        { at: [222, 61], tags: ['sweet', 'high'], what: 'flower planters by the restaurant row' },
        { at: [243, 61], tags: ['sweet', 'high', 'paper'], what: 'newspaper bundle on the awning ledge' },
        { at: [229, 71], tags: ['paper'], what: 'newspaper stack by Bugis station' },
        { at: [250, 61], tags: ['high', 'paper'], what: 'recycling bins by the mosque gate' },
      ], label: 'Ask the neighbours (E), then search where every clue points', cp: true },
      { t: 'goto', at: 'wangi', label: 'Bring the attar back to Puan Wangi', ride: 'foot' },
      { t: 'talk', lines: [['wangi', 'Smell that. Roses, sandalwood, and my grandmother. Terima kasih, little ones.', 'happy']] },
    ] },
  { id: 'k13', side: 'm44', ch: 0, title: 'Siloso Fun Run', giver: 'duyung', at: 'duyung', reward: 190, rep: 12, blurb: 'Kapten Duyung’s grandnephew, a cheeky crow cadet, says nobody beats him along Siloso Beach. Prove him wrong.',
    steps: [
      { t: 'talk', lines: [['duyung', 'My grandnephew is a crow cadet. Don’t ask. He says nobody beats him along the beach.', 'happy'], ['mate', 'Sand slows everybody. Even crows.', 'smug']] },
      { t: 'goto', at: [52, 119], label: 'To the start line at the west end of the beach', ride: 'foot', cp: true },
      { t: 'race', ride: 'foot', rival: 'runner', marks: [[62, 121], [74, 122], [86, 120], [98, 122], [110, 120], [116, 117]], label: 'Beat the crow cadet along Siloso Beach' },
      { t: 'talk', lines: [['duyung', 'Ha! He’s sulking in the lagoon. Good for him. Ice kacang on me.', 'happy']] },
    ] },
];
export const MISSION = Object.fromEntries([...MISSIONS, ...SIDE].map(m => [m.id, m])) as Record<string, Mission>;

/** every count of jobs shown to the player, derived from MISSIONS and SIDE (never written in by hand): story jobs and
 *  Hawker Tales done and in all, the medal marks (three a story job) earned and possible, and gold medals */
export function jobCounts(s: { done: string[]; medals: Record<string, { m: number } | undefined>; empire?: { jobs: Record<string, number> }; contracts?: { done: number; retaken: number; kinds: Record<string, number> } }) {
  const empire = EMPIRE_JOBS.filter(j => (s.empire?.jobs[j.id] ?? 0) > 0).length;
  const story = MISSIONS.filter(m => s.done.includes(m.id)).length, tales = SIDE.filter(m => s.done.includes(m.id)).length;
  return {
    story, storyAll: MISSIONS.length, tales, talesAll: SIDE.length, done: story + tales, all: MISSIONS.length + SIDE.length,
    marks: MISSIONS.reduce((a, m) => a + (s.medals[m.id]?.m ?? 0), 0), marksAll: MISSIONS.length * 3,
    gold: MISSIONS.filter(m => s.medals[m.id]?.m === 3).length,
    /** the tenth pass: kinds of empire job finished at least once, and how many kinds there are */
    empire, empireAll: EMPIRE_JOBS.length,
    /** the eleventh pass: contracts finished (from the save; they are made, not listed), retakes won, kinds tried */
    contracts: s.contracts?.done ?? 0, retaken: s.contracts?.retaken ?? 0, contractKinds: Object.keys(s.contracts?.kinds ?? {}).length,
  };
}

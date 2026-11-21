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
import { mvT } from './jade-layout.js';

export type Spot = string | [number, number];
/** a portrait expression per line: 'calm' is the character's usual portrait, the others are painted moods */
export type Mood = 'calm' | 'happy' | 'worried' | 'cross' | 'smug';
export const MOODS: Mood[] = ['calm', 'happy', 'worried', 'cross', 'smug'];
export type Line = [string, string, Mood?];
/** the chase set pieces: a stall the cart smashes, drums rolling off the temple steps, the canal drawbridge, the dock
 * crane's swinging container and the yard gate (lib/jade-setpiece.ts); `wp` is the route leg that triggers it */
/** a chase or tail target's painted body other than Pip's: a gang member (otter, macaque, lizard, mynah, bat) or a boss
 * (Director Kaw, Crow Number Nine, Datin Ciku) */
export type Skin = 'otter' | 'mac' | 'liz' | 'kaw' | 'myna' | 'nine' | 'bat' | 'ciku' | 'hoot' | 'boar' | 'taring';
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
  | { t: 'chase'; who: 'cart' | 'boat' | 'boss' | 'runner'; from: Spot; route: Spot[]; bumps: number; loot: string; label: string; speed: number; sets?: SetDef[]; phase?: 1 | 2; finish?: 'pounce' | 'snatch' | 'net'; skin?: Skin; cp?: boolean; /** who you chase, as the messages name them (Pip when unset) */ name?: string }
  /** `rope`: the float only swings in under the flags while the partner hauls the bunting rope there */
  | { t: 'float'; label: string; rope?: Spot; cp?: boolean }
  | { t: 'raid'; at: Spot; n: number; label: string; cp?: boolean }
  /** `relay`: from waypoint `at` on, the hero who started is easy for Pip to spot; the partner waits at `spot` */
  | { t: 'tail'; from: Spot; route: Spot[]; label: string; relay?: { at: number; spot: Spot }; cp?: boolean; /** under 1: the one you tail notices you more slowly */ calm?: number; /** a rival gang's runner (contracts) */ skin?: Skin; /** who you tail, as the messages name them ("the crow"); Pip when unset */ name?: string }
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
  /** ride the MRT to station `to` (E at a station entrance) */
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
  | { t: 'bag'; at: Spot; loot?: string; time?: number; label: string; skin?: 'myna' | 'bat'; cp?: boolean }
  // ── the seventh pass's job steps (lib/jade-jobs.ts)
  /** case the joint: photograph spots (E) from where you have a clear view of them, without the guards seeing you; each
   * photo is intel the next step uses (lib/jade-jobs.ts INTEL); `need` photos end the step (all of them by default) */
  /** the sixteenth pass: the tandem along the park, the partner on the back saddle tossing a parcel (F) at each mark */
  | { t: 'toss'; marks: Spot[]; item: string; time?: number; label: string; cp?: boolean }
  /** the sixteenth pass: a delivery on the dragon boat, timed for a boat with the partner drumming */
  | { t: 'paddle'; to: Spot; time: number; item: string; label: string; cp?: boolean }
  | { t: 'case'; spots: { at: Spot; kind: Intel }[]; guards: Spot[][]; need?: number; label: string; cp?: boolean; /** who keeps watch (guards in caps when unset) */ skin?: 'liz' | 'myna' | 'bat' | 'boar' }
  /** the heist: choose quiet or loud. Quiet sneaks in at `back` (only with the back door cased) or at `front`, past the
   * guards and `cams` ([x, y, facing in degrees]), cracks the safe and slips out the same way; loud sends the partner
   * to set off a confetti diversion at the front, then it is a race to the safe before `time` runs out and a getaway
   * with heat to `drop`. Spotted on a quiet job, the alarm goes off and it turns loud */
  | { t: 'heist'; front: Spot; back: Spot; safe: Spot; drop: Spot; guards: Spot[][]; cams: [number, number, number][]; time: number; loot: string; level: number; label: string; cp?: boolean }
  /** hold out: `waves` waves of a gang (`per` in the first, one more each wave after) raid `at` for `time` seconds;
   * knock them back before they grab; `what` names the thing you guard (the Stall, the Stage, the Float) */
  | { t: 'defend'; at: Spot; time: number; waves: number; per: number; gang: 'mac' | 'otter' | 'crow' | 'myna' | 'bat' | 'boar'; what: string; label: string; cp?: boolean }
  /** blend in: put on the disguise at `rack` (the partner waits there), then walk with the crowd along `route` to `goal`
   * past the lookouts ([x, y, facing in degrees]); running, hopping, bumping folk or walking alone where they look
   * raises Suspicion */
  | { t: 'blend'; rack: Spot; route: Spot[]; goal: Spot; lookouts: [number, number, number][]; crowd: number; folk?: 'intern' | 'town'; label: string; cp?: boolean }
  /** the detective: ask the witnesses (the right question gets a clue), then search the spots for the one that fits
   * every clue; nothing is pinned (Assist draws a ring that narrows with each clue) */
  | { t: 'detective'; witnesses: Witness[]; spots: { at: Spot; tags: string[]; what: string }[]; item: string; time: number; label: string; cp?: boolean }
  /** set a trap: lay nets at `need` of the trap spots (E), put the bait down at `bait`, keep back by `wait`, and spring
   * a net (F) while one of the gang walking `path` is on it; catch `catch` of the `n` */
  | { t: 'trap'; spots: Spot[]; need: number; bait: Spot; wait: Spot; path: Spot[]; gang: 'mac' | 'otter' | 'liz' | 'crow' | 'myna' | 'bat' | 'boar'; n: number; catch: number; label: string; cp?: boolean }
  /** swap: slip a decoy into each crate (E: a moment crouched at it) while the guards look the other way */
  /** the seventeenth pass (lib/jade-track.ts): follow a boar trail, reading each set of hoof prints (E) to show the
   * next; `old`: crusted prints off the line (shown once fresh set `oldAt` is read) that lead nowhere; `time`: the rain */
  | { t: 'track'; route: Spot[]; old?: Spot[]; oldAt?: number; time?: number; label: string; cp?: boolean }
  /** the eighteenth pass (lib/jade-crowd.ts): get from `from` to `to` through `lanes` lanes of match-night fans
   * streaming across the way (`span` tiles either side); a fan walks into you and you are shoved back; `ticket`: E at
   * the turnstile at `to` to end it; `item`: carried through (`keep`: still carried after) */
  | { t: 'crowd'; from: Spot; to: Spot; lanes: number; span?: number; time?: number; item?: string; keep?: boolean; ticket?: boolean; label: string; cp?: boolean }
  | { t: 'swap'; crates: Spot[]; guards: Spot[][]; time: number; decoy: string; skin?: 'liz' | 'myna' | 'bat' | 'boar'; /** what the HUD calls a crate ('loot sack') */ thing?: string; label: string; cp?: boolean };
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
  // the twelfth pass: Katong, Orchard Road and Changi
  rosie: { name: 'Nyonya Rosie', face: 'face-rosie', who: 'Katong laksa auntie (a leopard cat)' },
  bala: { name: 'Uncle Bala', face: 'face-bala', who: 'East Coast Park bike-hire uncle (a mudskipper)' },
  tiara: { name: 'Ms Tiara', face: 'face-tiara', who: 'Orchard Road light-up producer (a crimson sunbird)' },
  faiz: { name: 'Captain Faiz', face: 'face-faiz', who: 'airline pilot at Changi (a stork-billed kingfisher)' },
  ubin: { name: 'Pak Ubin', face: 'face-ubin', who: 'Changi Village bumboat man (a sambar deer)' },
  ciku: { name: 'Datin Ciku', face: 'face-ciku', who: 'Atas Bats boss (a fruit bat)' },
  // the fourteenth pass: Tiong Bahru, Clarke Quay and Jurong
  seng: { name: 'Uncle Seng', face: 'face-seng', who: 'Tiong Bahru chwee kueh uncle (a dusky langur)' },
  melati: { name: 'Kak Melati', face: 'face-melati', who: 'Clarke Quay jazz singer (a Singapura cat)' },
  suria: { name: 'Dr Suria', face: 'face-suria', who: 'Science Centre astronomer (a slow loris)' },
  musang: { name: 'Sifu Musang', face: 'face-musang', who: 'Chinese Garden lantern maker (a palm civet)' },
  // the sixteenth pass: the ride jobs' two new givers
  buaya: { name: 'Uncle Buaya', face: 'face-buaya', who: 'Orchard Road ice-cream uncle (a saltwater crocodile)' },
  kerbau: { name: 'Coach Kerbau', face: 'face-kerbau', who: 'Clarke Quay dragon-boat coach (a water buffalo)' },
  // the seventeenth pass: Pulau Ubin
  ayu: { name: 'Kak Ayu', face: 'face-ayu', who: 'Pulau Ubin bicycle-rental keeper, Pak Ubin’s cousin (a red junglefowl)' },
  lan: { name: 'Auntie Lan', face: 'face-lan', who: 'Ubin wayang singer (a straw-headed bulbul)' },
  belangkas: { name: 'Uncle Belangkas', face: 'face-belangkas', who: 'Chek Jawa nature guide (a horseshoe crab)' },
  taring: { name: 'Tok Taring', face: 'face-taring', who: 'Tusker Boys boss (a wild boar)' },
  // the eighteenth pass: Kallang
  biru: { name: 'Coach Biru', face: 'face-biru', who: 'Kallang dragon-boat and rowing coach (a collared kingfisher)' },
  tenuk: { name: 'Ms Tenuk', face: 'face-tenuk', who: 'Sports Hub events manager (a Malayan tapir)' },
  kubung: { name: 'Uncle Kubung', face: 'face-kubung', who: 'caretaker of the Old Kallang Airport and its archive (a Sunda colugo)' },
  sutera: { name: 'Madam Sutera', face: 'face-sutera', who: 'the lady in black feathers (a black swan)' },
  // the tenth pass: the empire's supplier, the health inspector, the rival towkay and the jaga you can hire
  huat: { name: 'Ah Huat', face: 'face-huat', who: 'wholesale supplier (a wild boar)' },
  siew: { name: 'Inspector Siew', face: 'face-siew', who: 'health inspector (a milky stork)' },
  hoot: { name: 'Towkay Hoot', face: 'face-hoot', who: 'rival towkay, and chapter nine’s lantern collector (a buffy fish owl)' },
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
export const CHAPTERS = ['Smith Street', 'Temple Street', 'Boat Quay', 'Tanjong Pagar Docks', 'Club Street', 'The Island', 'Island Lights', 'Christmas Star', 'Lights by the Lake', 'Kampong Spirit', 'Kallang Roar'];
/** the last job of each chapter (its finale) */
export const FINALE = ['m5', 'm10', 'm15', 'm20', 'm25', 'm35', 'm45', 'm55', 'm65', 'm75', 'm85'];
/** the story job that opens Sentosa (half way through chapter seven) */
export const RESORT_OPENS = 'm40';
/** the story job that opens Changi (half way through chapter eight) */
export const CHANGI_OPENS = 'm52';
/** the story job that opens Jurong (half way through chapter nine) */
export const JURONG_OPENS = 'm61';
/** the story job that opens Pulau Ubin (the end of chapter nine: chapter ten is set there) */
export const UBIN_OPENS = 'm65';
/** the story job that opens Kallang (the end of chapter ten: chapter eleven is set there) */
export const KALLANG_OPENS = 'm75';

// ── every [x, y] tile in a step is written in the old frame (where the district was first laid out) and moved once,
// here, through the layout table (lib/jade-layout.ts); names ('kee', 'here', 'loot') are places and stay
/** a Kallang tile by its local column and row (lib/jade-kallang.ts kalOld, written out here so the story needs no
 * city at run time): the north strip's rows 0-13 sit under Kampong Glam, the rest east of Sentosa, both in the old frame */
const K = (lx: number, ly: number): [number, number] => ly < 14 ? [212 + lx, 82 + ly] : [148 + lx, 82 + ly];
/** a spot: a place name stays, a tile moves */
export const mvSpot = <S extends Spot>(s: S): S => (typeof s === 'string' ? s : mvT(s[0], s[1])) as S;
const mvSpots = (a: Spot[]) => a.map(mvSpot);
/** [x, y, facing in degrees]: the tile moves, the facing stays */
const mvFacing = (a: [number, number, number][]) => a.map(([x, y, f]) => [...mvT(x, y), f] as [number, number, number]);
/** every tile a step names, moved (an exhaustive switch: a new step kind won't compile until it is listed here); an
 * optional field the step didn't have stays absent */
export function mvStep(st: Step): Step {
  const o = mvStepFields(st) as Record<string, unknown>;
  for (const k of Object.keys(o)) if (o[k] === undefined && !(k in st)) delete o[k];
  return o as Step;
}
function mvStepFields(st: Step): Step {
  switch (st.t) {
    case 'talk': case 'mini': case 'heat': case 'trade': case 'fares': case 'train': case 'cable': case 'beat': case 'switch': case 'boost':
      return st; // nothing on the map (boost's `at` is an index into BOOSTS)
    case 'goto': case 'pickup': case 'raid': case 'post': case 'defend': return { ...st, at: mvSpot(st.at) };
    case 'bag': return { ...st, at: mvSpot(st.at) };
    case 'ride': return st.near === undefined ? st : { ...st, near: mvSpot(st.near) };
    case 'deliver': return { ...st, to: mvSpot(st.to) };
    case 'paddle': return { ...st, to: mvSpot(st.to) };
    case 'toss': return { ...st, marks: mvSpots(st.marks) };
    case 'track': return { ...st, route: mvSpots(st.route), ...(st.old ? { old: mvSpots(st.old) } : {}) };
    case 'crowd': return { ...st, from: mvSpot(st.from), to: mvSpot(st.to) };
    case 'chase': return { ...st, from: mvSpot(st.from), route: mvSpots(st.route), sets: st.sets?.map(d => ({ ...d, at: mvT(d.at[0], d.at[1]) })) };
    case 'float': return st.rope === undefined ? st : { ...st, rope: mvSpot(st.rope) };
    case 'tail': return { ...st, from: mvSpot(st.from), route: mvSpots(st.route), relay: st.relay && { ...st.relay, spot: mvSpot(st.relay.spot) } };
    case 'escort': return { ...st, from: mvSpot(st.from), route: mvSpots(st.route) };
    case 'race': return { ...st, marks: mvSpots(st.marks) }; // `relay` is an index into marks
    case 'stealth': return { ...st, lookouts: st.lookouts.map(mvSpots), goal: mvSpot(st.goal), exit: mvSpot(st.exit), shutter: st.shutter === undefined ? undefined : mvSpot(st.shutter) };
    case 'collect': return { ...st, items: mvSpots(st.items), watch: st.watch && mvT(st.watch[0], st.watch[1]) };
    case 'hold': return { ...st, lever: mvSpot(st.lever), gate: st.gate.map(([x, y]) => mvT(x, y)), through: mvSpot(st.through) };
    case 'case': return { ...st, spots: st.spots.map(o => ({ ...o, at: mvSpot(o.at) })), guards: st.guards.map(mvSpots) };
    case 'heist': return { ...st, front: mvSpot(st.front), back: mvSpot(st.back), safe: mvSpot(st.safe), drop: mvSpot(st.drop), guards: st.guards.map(mvSpots), cams: mvFacing(st.cams) };
    case 'blend': return { ...st, rack: mvSpot(st.rack), route: mvSpots(st.route), goal: mvSpot(st.goal), lookouts: mvFacing(st.lookouts) };
    case 'detective': return { ...st, witnesses: st.witnesses.map(o => ({ ...o, at: mvSpot(o.at) })), spots: st.spots.map(o => ({ ...o, at: mvSpot(o.at) })) };
    case 'trap': return { ...st, spots: mvSpots(st.spots), bait: mvSpot(st.bait), wait: mvSpot(st.wait), path: mvSpots(st.path) };
    case 'swap': return { ...st, crates: mvSpots(st.crates), guards: st.guards.map(mvSpots) };
    default: { const never: never = st; return never; }
  }
}
/** a mission with every step's tiles moved */
export const mvMission = (m: Mission): Mission => ({ ...m, steps: m.steps.map(mvStep) });
function mvMissions(ms: Mission[]): Mission[] { return ms.map(mvMission); }

// road crossings by name: X(v, h) is the lane tile where vertical road v meets horizontal road h
const V = { a: 10, b: 26, c: 42, d: 60, e: 71, f: 90, g: 106 } as const;
const Hh = { n: 12, m: 30, s: 46, d: 62, x: 22 } as const;
const X = (v: keyof typeof V, h: keyof typeof Hh): [number, number] => [V[v] + 2, Hh[h] + 2];

export const MISSIONS: Mission[] = mvMissions([
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
      { t: 'talk', lines: [['bo', 'Shiny! Now the last one. The Phoenix Drum is in Madame Glint’s roost, up Club Street.', 'happy'], ['bo', 'The neon lights are on for you.', 'smug']] },
    ] },
  // ── Chapter 5: Club Street (Phoenix Drum)
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
  // Crows across the island and hires its gangs for one big caper: the Golden Chinchilla at the Float @ Marina Bay
  { id: 'm26', ch: 6, title: 'Next Stop, Toa Payoh', giver: 'glint', at: 'stn-chinatown', reward: 260, rep: 14, blurb: 'Ride the MRT to Toa Payoh, ask around the interchange and work out where a crow hid Mr Kamal’s station keys.',
    steps: [
      { t: 'talk', lines: [['glint', 'Darlings! Bad news. My cousin, Director Kaw, has turned the Crew into a company. Kaypoh Crows Pte Ltd.', 'worried'], ['pip', 'He has a briefcase. And a slogan. Franchising mischief island-wide!', 'worried'], ['hero', 'Then we go island-wide too.', 'smug'], ['mate', 'The MRT runs from right here. Two coins a ride. And no durians on the train!', 'smug']] },
      { t: 'train', to: 'stn-toapayoh', label: 'Take the MRT to Toa Payoh (E at the station entrance)', cp: true },
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
      { t: 'tail', name: 'the courier', from: [136, 24], route: [[143, 24], [150, 24], [157, 24], [163, 24], [164, 30]], relay: { at: 3, spot: [155, 21] }, calm: 0.75, label: 'Follow the courier out of sight; switch to {mate} at the corner (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'He’s packing crates behind the wet market, and two of your lizards are guarding them.', 'cross'], ['lepak', 'Ah. Kaw pays them in kueh. Very lazy guards, my lizards: they look round now and then, that’s all.', 'calm'], ['mate', 'Here: decoy boxes. Swap them in while they look the other way. F and I’ll keep one busy.', 'smug']] },
      { t: 'swap', crates: [[157, 22], [161, 22], [165, 21], [158, 25]], guards: [[[155, 23], [166, 23]], [[167, 20], [167, 26]]], time: 90, decoy: 'decoy', skin: 'liz', label: 'Slip a decoy into each crate (E) while the lizards look away', cp: true },
      { t: 'goto', at: 'lepak', label: 'Show Lord Lepak what was in the crates', ride: 'foot' },
      { t: 'talk', lines: [['lepak', 'Stage passes for Island Night at the Float @ Marina Bay. And a drawing of the Golden Chinchilla.', 'worried'], ['lepak', 'Kaw paid us in kueh. Very nice kueh. But the Longkang Lizards don’t steal awards. Too much effort.', 'happy'], ['mate', 'And Kaw’s crows are driving off with boxes of nothing. So Island Night is the big caper.', 'cross']] },
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
      { t: 'chase', who: 'runner', name: 'the runner', from: [147, 33], route: [[144, 33], [143, 24], [158, 24], [165, 30], [151, 34]], bumps: 2, loot: 'loot-bag', speed: 205, finish: 'pounce', label: 'Pounce on the runner together: F sends {mate} in, then dash', cp: true },
      { t: 'pickup', at: 'loot', item: 'loot-bag', label: 'Grab the stage pass' },
      { t: 'talk', lines: [['kamal', 'Fastest arrival I’ve ever seen. And nobody fined!', 'happy'], ['vanda', 'Without the pass he can’t get backstage. He’ll try something loud instead.', 'worried']] },
    ] },
  { id: 'm34', ch: 6, title: 'Showtime Setup', giver: 'vanda', at: 'vanda', reward: 360, rep: 15, blurb: 'Gather the concert lights the crows hid round the bay and wire up the Float @ Marina Bay.',
    steps: [
      { t: 'talk', lines: [['vanda', 'Island Night starts soon and the crows hid my last lights around the bay!', 'worried'], ['mate', 'A crow lookout in the mall window. Paint the glass or let me pull faces at it.', 'smug'], ['hero', 'Five crates of lights, one stage. Let’s light it up.', 'smug']] },
      { t: 'collect', items: [[148, 64], [164, 64], [183, 62], [191, 66], [145, 76]], item: 'light-crate', time: 110, watch: [190, 61], label: 'Collect the five crates of lights; paint the window lookout or send {mate} to distract it (F)', cp: true },
      { t: 'goto', at: 'stage', label: 'Over the walkway to the Float @ Marina Bay', ride: 'foot', r: 110 },
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
      { t: 'chase', who: 'runner', name: 'Director Kaw', skin: 'kaw', from: [190, 66], route: [[180, 66], [170, 66], [160, 64], [150, 66], [146, 62], [165, 63]], bumps: 2, loot: '', speed: 210, finish: 'pounce', label: 'Pounce on Director Kaw together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['kaw', 'Fine! Then nobody gets it! Fly, Crow Number Nine!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'statuette', time: 60, label: 'Knock the Golden Chinchilla out of the crow’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'statuette', label: 'Catch the Golden Chinchilla' },
      { t: 'talk', lines: [['kaw', 'I… may need to restructure.', 'worried'], ['glint', 'Cousin. Come home. The festival needs someone to hold the lanterns.', 'smug'], ['vanda', 'And the Golden Chinchilla for Island Night goes to… the heroes of the island!', 'happy'], ['hero', 'Best island ever.', 'happy'], ['mate', 'Best team ever. Again.', 'happy']] },
    ] },
  // ── chapter seven: Island Lights. Kaw has gone home to hold Glint's lanterns, but his old assistant, Crow Number
  // Nine, keeps the company's spare keys and has hired Boss Bising's Kecoh Mynahs, who can copy anybody's voice. In
  // Little India they muddle Deepavali, in Kampong Glam the Hari Raya bazaar, and the big caper is the island's
  // fireworks on Sentosa
  { id: 'm36', ch: 7, title: 'Garlands for Deepavali', giver: 'kamal', at: 'kamal', reward: 380, rep: 15, blurb: 'The MRT runs on to Little India. Someone in Auntie Malar’s own voice cancelled the temple’s garlands: find where they went and get them to the temple in time.',
    steps: [
      { t: 'talk', lines: [['kamal', 'Good news! The MRT runs on now: Bugis, Little India, even Beach station on Sentosa when it opens.', 'happy'], ['kamal', 'Bad news: Auntie Malar at the flower market phoned. Or someone with her voice did.', 'worried'], ['mate', 'Someone copying voices? That’s new.', 'worried'], ['hero', 'Little India station, then. Two coins.', 'smug']] },
      { t: 'train', to: 'stn-littleindia', label: 'Take the MRT to Little India (E at the station gates)', cp: true },
      { t: 'goto', at: 'malar', label: 'Find Auntie Malar at the flower market on Buffalo Road', ride: 'foot' },
      { t: 'talk', lines: [['malar', 'Vanakkam, my dears! Somebody called the temple in MY voice and said no garlands this year. Then my jasmine strings vanished!', 'worried'], ['malar', 'Deepavali is in two nights. The whole street will be lit. The garlands must be there.', 'worried'], ['hero', 'Somebody round here saw something. We ask, then we search where the clues point.', 'calm']] },
      { t: 'detective', item: 'garland', time: 150, witnesses: [
        { at: [236, 10], sp: 'rabbit', name: 'auntie by Mustafa Centre’s doors', ask: ['Did you hear anybody shouting?', 'Did you see who it was?', 'Did they go into Mustafa?'], right: 0, clue: 'Shouting in Auntie Malar’s voice! From up high, on a ledge. Funny voice, very squeaky.', tag: 'high', junk: ['', 'Too many people tonight. Everybody looks like somebody.', 'Maybe? Everybody goes into the Emporium. Twenty-four hours!'] },
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
  { id: 'm37', ch: 7, title: 'The Spice Switch', giver: 'raju', at: 'raju', reward: 400, rep: 15, blurb: 'The mynahs carried Mr Raju’s Deepavali spices off to the yard behind Mustafa Centre. Swap them for sacks of sawdust while the mynah lookouts aren’t watching.',
    steps: [
      { t: 'talk', lines: [['raju', 'Cardamom, cumin, turmeric, my best garam masala. Twelve sacks, gone to the yard behind Mustafa Centre.', 'cross'], ['raju', 'The mynahs guard them for someone. They look around, they chatter, they look away. Silly birds, but sharp eyes.', 'calm'], ['mate', 'Sawdust sacks for spice sacks. Like Uncle Teo’s kopi. They won’t know till they cook.', 'smug']] },
      { t: 'goto', at: [228, 10], label: 'Go round to the yard behind Mustafa Centre', ride: 'foot', cp: true },
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
      { t: 'tail', name: 'the courier', from: [242, 56], route: [[243, 60], [250, 60], [262, 60], [268, 62], [269, 70]], relay: { at: 3, spot: [262, 59] }, calm: 0.8, label: 'Follow the courier out of sight; switch to {mate} past the mosque (Tab)', cp: true },
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
  { id: 'm43', ch: 7, title: 'Universal Studios Singapore After Dark', giver: 'helang', at: 'park', reward: 480, rep: 17, blurb: 'Nine’s crows have the fireworks firing box locked in the ride-control office behind S.E.A. Aquarium. Case it, then take it: quiet or loud.',
    steps: [
      { t: 'talk', lines: [['helang', 'Universal Studios Singapore is shut for the night. Nine’s crows are in the ride-control office behind S.E.A. Aquarium.', 'worried'], ['mate', 'Look first, then go in. Doors, beats, cameras, the safe.', 'smug']] },
      { t: 'goto', at: [102, 111], label: 'Go round behind S.E.A. Aquarium', ride: 'foot', cp: true },
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
      { t: 'chase', who: 'runner', name: 'Crow Number Nine', skin: 'nine', from: [46, 110], route: [[52, 117], [64, 118], [78, 118], [90, 121], [104, 120], [86, 117]], bumps: 2, loot: '', speed: 205, finish: 'pounce', label: 'Pounce on Crow Number Nine together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['nine', 'Fine! Then nobody gets fireworks! Fly, little mynah, fly!', 'cross'], ['bising', 'That mynah is mine! Hey! Come back! Kecoh!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'firebox', skin: 'myna', time: 60, label: 'Knock the spare firing box out of the mynah’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'firebox', label: 'Catch the firing box' },
      { t: 'talk', lines: [['nine', 'I just wanted… one night that was mine.', 'worried'], ['kaw', 'Nine. Come home. You can run the lantern stall. Your own stall.', 'calm'], ['helang', 'And the island’s lights go up on Siloso Beach. Fire!', 'happy'], ['hero', 'Best fireworks ever.', 'happy'], ['mate', 'Best island ever. All of it.', 'happy']] },
    ] },
  // ── Chapter 8: Christmas Star. The MRT runs on to Katong and Changi Airport past the Geylang River, and to Orchard Road. Datin
  // Ciku, the Atas Bats' boss, a fruit bat in pearls who only likes the nicest things, wants the great star off the top of
  // the Orchard Road light-up for her Emerald Hill townhouse, and her bats help themselves to everything else on the way
  { id: 'm46', ch: 8, title: 'The Laksa Line', giver: 'kamal', at: 'kamal', reward: 500, rep: 16, blurb: 'The MRT runs on past the Geylang River. Nyonya Rosie in Katong is out of cockles on the busiest laksa night of the year, and bats keep pinching her prawns.',
    steps: [
      { t: 'talk', lines: [['kamal', 'Big news! The line runs on to Katong Park, Orchard and Changi Airport. And Nyonya Rosie in Katong is calling for help.', 'happy'], ['kamal', 'Something about bats. In bow ties.', 'worried'], ['mate', 'Bats in bow ties. Okay. Katong Park station, then.', 'smug']] },
      { t: 'train', to: 'stn-katong', label: 'Take the MRT to Katong Park (E at the station gates)', cp: true },
      { t: 'goto', at: 'rosie', label: 'Find Nyonya Rosie by her laksa shop on East Coast Road', ride: 'foot' },
      { t: 'talk', lines: [['rosie', 'Aiyoh, finally! My laksa needs cockles and prawns, and the bats took my whole basket off the step.', 'worried'], ['rosie', 'Uncle Bala at the seafood centre keeps a spare basket for me. Go, go! The queue is already round the corner.', 'cross'], ['hero', 'Prawns, cockles, back before the broth boils.', 'calm']] },
      { t: 'pickup', at: 'seafood', item: 'prawns', label: 'Pick up the seafood basket at the East Coast seafood centre', cp: true },
      { t: 'deliver', to: 'laksa', item: 'prawns', time: 75, fragile: 6, label: 'Carry the basket to 328 Katong Laksa before the broth boils (bumps spill it)' },
      { t: 'mini', kind: 'wok', level: 2, label: 'Help Nyonya Rosie cook the laksa' },
      { t: 'talk', lines: [['rosie', 'Shiok! Coconut, chilli, cockles. Now Katong smells like Katong again.', 'happy'], ['rosie', 'Those bats, they are the Atas Bats. They only take nice things. Prawns, pearls, porcelain.', 'cross'], ['mate', 'Atas. Posh. Posh bats.', 'smug']] },
    ] },
  { id: 'm47', ch: 8, title: 'The Kamcheng Jar', giver: 'rosie', at: 'rosie', reward: 520, rep: 16, blurb: 'Nyonya Rosie’s great-grandmother’s kamcheng jar went missing from the Peranakan mansion on Joo Chiat. Ask the neighbours, then search where every clue points.',
    steps: [
      { t: 'talk', lines: [['rosie', 'My kamcheng! Pink and gold porcelain, a hundred years old. Gone from the mansion while I was cooking.', 'worried'], ['rosie', 'The whole street was out. Somebody must have seen something.', 'calm'], ['hero', 'We ask, then we look where the clues point.', 'calm']] },
      { t: 'goto', at: 'joochiat', label: 'Go up Joo Chiat Road to the shophouses', ride: 'foot', cp: true },
      { t: 'detective', item: 'kamcheng', time: 150, witnesses: [
        { at: [297, 44], sp: 'robin', name: 'uncle with the songbird cage', ask: ['Did you hear anything?', 'Did you see where it went?', 'Did they look rich?'], right: 1, clue: 'Up! Something with leathery wings carried a pink thing up high. My birds went crazy.', tag: 'high', junk: ['Only my birds singing. Best singers in Katong.', '', 'Everybody in Katong looks rich tonight. Christmas, you know.'] },
        { at: [285, 44], sp: 'pigeon', name: 'auntie with the shopping bags', ask: ['What did they smell of?', 'Which way did they go?', 'Were they wearing anything?'], right: 0, clue: 'Durian! Strong, strong durian. Who goes stealing smelling of durian?', tag: 'fruit', junk: ['', 'This way, that way, I was busy looking at the kebaya shop.', 'Pearls? A bow tie? Very smart for a thief.'] },
        { at: [305, 44], sp: 'tapir', name: 'shopkeeper sweeping his five-foot way', ask: ['Did anyone drop anything?', 'Did you see a car?', 'What time was it?'], right: 0, clue: 'Painted tiles, broken, round the back by the shade. Like someone banged into a wall going round.', tag: 'shade', junk: ['', 'No car, only bicycles tonight.', 'Laksa time. Everybody’s time is laksa time.'] },
      ], spots: [
        { at: [312, 44], tags: ['high', 'fruit', 'shade'], what: 'the durian crates under the shophouse awning' },
        { at: [289, 44], tags: ['fruit'], what: 'the fruit stall by the corner' },
        { at: [320, 45], tags: ['high', 'shade'], what: 'the mansion’s back verandah' },
        { at: [278, 44], tags: ['high'], what: 'the shophouse balcony planters' },
        { at: [302, 38], tags: ['fruit', 'shade'], what: 'the market tarpaulins' },
      ], label: 'Ask round Joo Chiat Road (E), then search where every clue points', cp: true },
      { t: 'talk', lines: [['hero', 'The kamcheng! Not a crack. And a little fruit-bat bow tie stuck on the lid.', 'smug'], ['mate', 'Gently back to the mansion. It is older than Uncle Teo.', 'cross']] },
      { t: 'deliver', to: 'mansion', item: 'kamcheng', time: 60, fragile: 4, label: 'Carry the kamcheng back to the Peranakan mansion (gently: bumps crack it)', cp: true },
      { t: 'talk', lines: [['rosie', 'Thank you, thank you. My great-grandmother is smiling somewhere.', 'happy'], ['ciku', 'Darlings! That jar was a little gift for my collection. Never mind. There are nicer things on Orchard Road.', 'happy'], ['rosie', 'That one is Datin Ciku. She roosts in the casuarinas by the beach and thinks the whole East Coast is her shopping trip.', 'cross']] },
    ] },
  { id: 'm48', ch: 8, title: 'Pedal to the Park', giver: 'bala', at: 'bala', reward: 520, rep: 16, blurb: 'A bat on Uncle Bala’s last hired bike is racing off with his cash tin along the East Coast Park cycling track. Take the next bike and beat it round the markers.',
    steps: [
      { t: 'talk', lines: [['bala', 'Wah lau! A bat rode off on my bike with my cash tin in the basket! Bats can’t even pedal properly!', 'cross'], ['bala', 'It always goes round the track markers to show off. Take that bike, cut it off at every one.', 'calm'], ['mate', 'A bike! No engine, no fuss. I’ll ring the bell.', 'happy']] },
      { t: 'ride', kind: 'bike', near: [288, 80], label: 'Hop on the hired bike by Uncle Bala’s rack', cp: true },
      { t: 'race', ride: 'bike', rival: 'scooter', pace: 0.8, time: 85, marks: [[300, 82], [320, 81], [310, 86], [292, 85], [280, 81], [298, 82]], label: 'Pedal round every track marker before the bat', cp: true },
      { t: 'goto', at: 'bala', label: 'Ride back to Uncle Bala', r: 140 },
      { t: 'talk', lines: [['bala', 'My tin! And the bat fell in the bushes, wah, so paiseh for it.', 'happy'], ['bala', 'You keep the bike as long as you like. Free for friends. Ride by the sea, very shiok.', 'happy']] },
    ] },
  { id: 'm49', ch: 8, title: 'Lagoon Rush', giver: 'bala', at: 'bala', reward: 540, rep: 16, blurb: 'The East Coast Lagoon hawker centre is packed for the Christmas weekend, and the Atas Bats are swooping on every plate. Hold the stalls.',
    steps: [
      { t: 'talk', lines: [['bala', 'Christmas weekend! Everybody at the hawker centre: satay, sambal stingray, carrot cake.', 'happy'], ['bala', 'And the bats are circling. They want the satay and the nice plates.', 'worried'], ['mate', 'Then we hold the stalls. Knock them back before they grab.', 'smug']] },
      { t: 'goto', at: 'hawker-ecp', label: 'Head to the East Coast Lagoon hawker centre', cp: true },
      { t: 'defend', at: 'hawker-ecp', time: 66, waves: 3, per: 2, gang: 'bat', what: 'Stall', label: 'Guard the hawker stalls: knock the bats back before they grab ({mate} helps on their own)', cp: true },
      { t: 'talk', lines: [['bala', 'Not one stick of satay lost! The uncles want to give you free sugarcane for a year.', 'happy'], ['ciku', 'Hawker food is so last season anyway. Ta-ta, darlings! I am off to do some real shopping.', 'happy'], ['hero', 'Real shopping. Orchard Road.', 'cross']] },
    ] },
  { id: 'm50', ch: 8, title: 'Light-Up on Orchard', giver: 'tiara', at: 'tiara', reward: 560, rep: 17, blurb: 'The bats pulled out the wires of the Orchard Road Christmas light-up and scattered its baubles. Rewire the switch box and hang them back on the trees.',
    steps: [
      { t: 'talk', lines: [['tiara', 'Tiara, Orchard Road light-up producer. Lights on in one hour, and look: wires everywhere, baubles everywhere!', 'worried'], ['tiara', 'Bats. Bats in bow ties. They took the big star off the arch and they want the rest.', 'cross'], ['mate', 'Wires first, then baubles. Then we find that star.', 'smug']] },
      { t: 'goto', at: [300, 21], label: 'To the switch box under the light-up arch outside Lucky Plaza', ride: 'foot', cp: true },
      { t: 'mini', kind: 'wires', level: 3, label: 'Rewire the light-up switch box' },
      { t: 'collect', items: [[282, 21], [296, 33], [314, 10], [307, 37]], item: 'bauble', time: 90, label: 'Gather the four baubles the bats dropped along Orchard Road', cp: true },
      { t: 'goto', at: 'ion', label: 'Bring the baubles to the ION Orchard tree', ride: 'foot' },
      { t: 'talk', lines: [['tiara', 'Lights on! Look at it, all the way from Tanglin to Dhoby Ghaut.', 'happy'], ['tiara', 'But no star on top. Without the star, it’s just a very long string of lights.', 'worried'], ['hero', 'Then we get the star back.', 'calm']] },
    ] },
  { id: 'm51', ch: 8, title: 'Window Shopping', giver: 'tiara', at: 'tiara', reward: 580, rep: 17, blurb: 'The bats keep their shopping in the loading bay behind Lucky Plaza. Walk in with the Christmas crowd, then swap their bags for decoys while the lookouts preen.',
    steps: [
      { t: 'talk', lines: [['tiara', 'The bats bring everything to the loading bay behind Lucky Plaza. Bags and bags. Perfume, shoes, my star’s spare bulbs.', 'cross'], ['tiara', 'Their lookouts watch for chinchillas, but tonight the whole island is shopping.', 'calm'], ['mate', 'Then we shop too. Shopping bags from the rack, walk slow, look tired.', 'smug']] },
      { t: 'blend', rack: [293, 21], route: [[296, 21], [301, 21], [306, 21], [309, 25], [309, 31]], goal: [306, 33], lookouts: [[303, 20, 90], [309, 22, 180], [308, 31, 270]], crowd: 9, folk: 'town', label: 'Walk with the shoppers past Lucky Plaza to the loading bay (keep to a walk)', cp: true },
      { t: 'talk', lines: [['hero', 'Bags everywhere. And bats everywhere, pretending not to watch.', 'worried'], ['mate', 'Swap each bag for a decoy full of tissue paper. They’ll never know till they open them.', 'smug']] },
      { t: 'swap', crates: [[302, 33], [305, 34], [310, 34], [313, 33]], guards: [[[301, 36], [313, 36]], [[313, 32], [301, 32]]], time: 90, decoy: 'decoy', skin: 'bat', label: 'Slip a decoy bag into each pile (E) while the bats look away', cp: true },
      { t: 'goto', at: 'tiara', label: 'Bring the shopping back to Ms Tiara', ride: 'foot' },
      { t: 'talk', lines: [['tiara', 'My spare bulbs! And in this bag… an invitation. Emerald Hill, tonight. “Star viewing, by invitation only. Datin C.”', 'worried'], ['hero', 'She’s going to show it off. At home.', 'cross'], ['mate', 'Then we visit. Without an invitation.', 'smug']] },
    ] },
  { id: 'm52', ch: 8, title: 'Emerald Hill', giver: 'tiara', at: 'tiara', reward: 600, rep: 18, blurb: 'Datin Ciku keeps the Christmas Star in the safe of her Emerald Hill townhouse. Case the place, then take it back: quiet or loud.',
    steps: [
      { t: 'talk', lines: [['tiara', 'Emerald Hill. Old Peranakan terraces, very pretty, very quiet. Her bats guard the house.', 'worried'], ['mate', 'Look first. Doors, guards, cameras, the safe.', 'smug']] },
      { t: 'goto', at: [286, 10], label: 'Go up Emerald Hill Road', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: [289, 7], kind: 'door' }, { at: [283, 9], kind: 'rota' }, { at: [280, 4], kind: 'cam' }, { at: [283, 6], kind: 'safe' }], need: 3, guards: [[[277, 4], [289, 4]], [[276, 10], [283, 10]]], label: 'Photograph three things (E): the back door, the bat rota, the camera, the safe' },
      { t: 'talk', lines: [['mate', 'Quiet or loud? Either way, the star comes home.', 'smug']] },
      { t: 'heist', front: [283, 10], back: [289, 7], safe: [283, 6], drop: 'safe-orchard', guards: [[[277, 4], [289, 4]], [[276, 10], [283, 10]]], cams: [[280, 5, 0], [288, 9, 180]], time: 65, loot: 'xmas-star', level: 3, label: 'Crack Datin Ciku’s safe', cp: true },
      { t: 'talk', lines: [['hero', 'The safe’s empty. Just a boarding pass. Changi Airport, first flight out.', 'worried'], ['ciku', 'Darlings, you’re too late! The star and I are going on holiday. Somewhere with nicer shops.', 'happy'], ['tiara', 'Changi! The line runs to the airport now. Go!', 'cross']] },
    ] },
  { id: 'm53', ch: 8, title: 'Changi Village Stakeout', giver: 'ubin', at: 'ubin', reward: 600, rep: 18, blurb: 'Pak Ubin says the bats meet at the Changi Village hawker centre before every job. Net them on their way in, then follow the courier to the airport.',
    steps: [
      { t: 'talk', lines: [['ubin', 'Selamat datang. Fifty years I take the bumboat to Pulau Ubin. I see everything at this jetty.', 'calm'], ['ubin', 'The bats come through the village every night. Nasi lemak first, then they fly to the airport.', 'calm'], ['mate', 'Nets on their path, nasi lemak for bait. Then we follow the one who gets away.', 'smug']] },
      { t: 'goto', at: 'village', label: 'Go into Changi Village', ride: 'foot', cp: true },
      { t: 'trap', spots: [[340, 58], [344, 58], [348, 58], [352, 58]], need: 3, bait: [355, 58], wait: [348, 61], path: [[332, 58], [336, 58], [340, 58], [344, 58], [348, 58], [352, 58], [355, 58]], gang: 'bat', n: 3, catch: 2, label: 'Lay three nets along the village street (E)', cp: true },
      { t: 'talk', lines: [['hero', 'Two in the nets. And one with a luggage tag in its claws, flying low.', 'smug'], ['mate', 'Let it lead us. I’ll wait by the station: switch to me there.', 'smug']] },
      { t: 'tail', name: 'the courier', skin: 'bat', from: [345, 56], route: [[345, 50], [345, 44], [346, 36], [349, 30], [354, 24]], relay: { at: 3, spot: [352, 37] }, calm: 0.55, label: 'Follow the courier to the airport; switch to {mate} by the baggage hall (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'The baggage hall. Datin Ciku’s luggage is going through tonight.', 'cross'], ['ubin', 'Captain Faiz flies the morning plane. He will help you. Tell him Ubin sent you.', 'happy']] },
    ] },
  { id: 'm54', ch: 8, title: 'Lost Luggage', giver: 'faiz', at: 'faiz', reward: 620, rep: 18, blurb: 'A bat in a porter’s cap is wheeling Datin Ciku’s suitcase across the apron to her plane. Captain Faiz says stop it before it’s loaded.',
    steps: [
      { t: 'talk', lines: [['faiz', 'Captain Faiz. Good evening. A bat porter is taking a suitcase to my plane that I did not load.', 'calm'], ['faiz', 'Heavy, star-shaped, and it hums Christmas songs. Most irregular.', 'worried'], ['mate', 'There! Across the apron, with a trolley!', 'cross']] },
      { t: 'chase', who: 'runner', name: 'the porter', skin: 'bat', from: [350, 30], route: [[356, 30], [362, 26], [362, 12], [350, 9], [336, 10], [334, 12], [344, 22]], bumps: 2, loot: 'suitcase', speed: 200, finish: 'net', label: 'Catch the bat porter: bump it twice, then net it (click)', cp: true },
      { t: 'pickup', at: 'loot', item: 'suitcase', label: 'Grab the suitcase' },
      { t: 'talk', lines: [['hero', 'It’s… full of fruit. And a note. “Decoy, darlings. Love, C.”', 'cross'], ['faiz', 'Then the real star is still at the airport. Jewel. She loves the waterfall.', 'calm'], ['mate', 'The Rain Vortex. Of course she does.', 'smug']] },
    ] },
  { id: 'm55', ch: 8, title: 'Rain Vortex', giver: 'faiz', at: 'faiz', reward: 1200, rep: 25, blurb: 'Datin Ciku is hanging the Christmas Star over the Rain Vortex at Jewel for her farewell party. Slip past her bat lookouts, run her down round the forest valley, and bring the star home.',
    steps: [
      { t: 'talk', lines: [['faiz', 'Jewel is closed for the night. Only the waterfall, the forest and the bats.', 'calm'], ['ubin', 'Her lookouts hang from the terraces. They see well in the dark, but they are very vain.', 'calm'], ['mate', 'Then I keep them busy at the east door. You go in quiet.', 'smug']] },
      { t: 'goto', at: [331, 46], label: 'Go to Jewel’s south doors', ride: 'foot', cp: true },
      { t: 'stealth', lookouts: [[[327, 38], [327, 42]], [[335, 40], [335, 36]], [[328, 33], [335, 33]]], goal: 'vortex', exit: [331, 46], calm: 0.55, pause: 1.5, label: 'Reach the Rain Vortex unseen past the bat lookouts, then get out', cp: true },
      { t: 'talk', lines: [['ciku', 'Darlings! You came to my party! No invitation, of course. How very common.', 'happy'], ['hero', 'The star, Datin. It belongs to Orchard Road.', 'calm'], ['ciku', 'Then catch me! In heels!', 'happy']] },
      { t: 'chase', who: 'runner', name: 'Datin Ciku', skin: 'ciku', from: [331, 40], route: [[327, 36], [327, 24], [331, 20], [336, 24], [336, 36], [331, 42], [327, 30]], bumps: 2, loot: '', speed: 200, finish: 'pounce', label: 'Pounce on Datin Ciku together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['ciku', 'My cape! My PEARLS! Very well. Take your little star. Bertie, fly it away!', 'cross'], ['mate', 'One of her bats has the star! It’s going up over the waterfall!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'xmas-star', skin: 'bat', time: 60, label: 'Knock the Christmas Star out of the bat’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'xmas-star', label: 'Catch the Christmas Star' },
      { t: 'talk', lines: [['ciku', 'I only wanted something nobody else had.', 'worried'], ['tiara', 'Then come and switch it on with us, Datin. Everybody gets to have it. That’s the point.', 'happy'], ['rosie', 'And laksa after. My treat.', 'happy'], ['hero', 'Best Christmas ever.', 'happy'], ['mate', 'Best island ever. All of it, coast to coast.', 'happy']] },
    ] },
  // ── Chapter 9: Lights by the Lake. West of Chinatown the MRT runs on to Clarke Quay, Tiong Bahru and Jurong East.
  // The Mid-Autumn lanterns are going up round Jurong Lake, and Towkay Hoot, the rival towkay, a buffy fish owl who
  // thinks everything has a price, is buying up (and, where nobody will sell, helping himself to) every lantern on the
  // island for a gala of his own, with the otters and the lizards on his payroll
  { id: 'm56', ch: 9, title: 'Breakfast at Tiong Bahru', giver: 'kamal', at: 'kamal', reward: 620, rep: 18, blurb: 'The MRT runs on west of Chinatown. Uncle Seng at Tiong Bahru Market has a queue round the block for his chwee kueh and no rice flour: somebody bought every sack in the estate.',
    steps: [
      { t: 'talk', lines: [['kamal', 'More news! The line runs on west: Clarke Quay, Tiong Bahru, and Jurong East when the last bit of track is checked.', 'happy'], ['kamal', 'And Uncle Seng at Tiong Bahru Market is asking for you two. By name!', 'calm'], ['mate', 'Famous for helping. Tiong Bahru station, then.', 'smug']] },
      { t: 'train', to: 'stn-tiong', label: 'Take the MRT to Tiong Bahru (E at the station gates)', cp: true },
      { t: 'goto', at: 'seng', label: 'Find Uncle Seng at his chwee kueh cart outside Tiong Bahru Market', ride: 'foot' },
      { t: 'talk', lines: [['seng', 'Forty years I steam chwee kueh here. Today, no rice flour! Somebody bought every sack in Tiong Bahru. Cash. Before sunrise.', 'worried'], ['seng', 'The kopitiam on Seng Poh Road keeps one sack for me under the counter. Go, go, my queue is to the bird corner already.', 'cross'], ['hero', 'One sack, no spills.', 'calm']] },
      { t: 'pickup', at: 'tbkopi', item: 'parcel', label: 'Pick up the sack of rice flour at the Seng Poh Road kopitiam', cp: true },
      { t: 'deliver', to: 'chweekueh', item: 'parcel', time: 70, fragile: 6, label: 'Carry the flour to Uncle Seng’s cart before the steamers go cold (bumps spill it)' },
      { t: 'mini', kind: 'wok', level: 2, label: 'Fry the chai poh topping with Uncle Seng' },
      { t: 'talk', lines: [['seng', 'Shiok. Soft cake, salty chai poh. Now Tiong Bahru smells like morning again.', 'happy'], ['seng', 'The one who bought my flour left a card. A gold owl on it. “Towkay Hoot: everything has a price.”', 'cross'], ['mate', 'Hoot. The rival towkay. What does an owl want with rice flour?', 'worried']] },
    ] },
  { id: 'm57', ch: 9, title: 'The Silent Corner', giver: 'seng', at: 'seng', reward: 640, rep: 18, blurb: 'Sifu Musang sent the bird corner the first rabbit lantern of the Mid-Autumn festival. It has vanished, and the songbirds have stopped singing. Ask round the estate, then search where every clue points.',
    steps: [
      { t: 'talk', lines: [['seng', 'Every year Sifu Musang from the Chinese Garden sends our bird corner the first rabbit lantern. This morning: gone. And the birds, not one note.', 'worried'], ['seng', 'Tiong Bahru people see everything from their balconies. Ask them.', 'calm'], ['hero', 'We ask, then we look where the clues point.', 'calm']] },
      { t: 'goto', at: 'birdcorner', label: 'Go to the Tiong Bahru bird corner', ride: 'foot', cp: true },
      { t: 'detective', item: 'rabbit-lantern', time: 150, witnesses: [
        { at: [256, 111], sp: 'tabby', name: 'neighbour with the tote bag', ask: ['Did you hear anything?', 'What did the thief look like?', 'Which way did they go?'], right: 2, clue: 'Down, not up. Something low and wet slipped away under the tables, towards the shade.', tag: 'low', junk: ['Only the coffee machine. It is a very loud coffee machine.', 'I was reading. A good book hides the whole world.', ''] },
        { at: [268, 112], sp: 'robin', name: 'bird uncle with the empty hook', ask: ['Why did the birds stop?', 'Was it one of the cats?', 'What time was it?'], right: 0, clue: 'They smelled the river. Fishy! My merbok hates a fishy smell. It was by the old books, I tell you.', tag: 'books', junk: ['', 'The cats here are gentlemen. Never.', 'Kopi time. Before the second kopi.'] },
        { at: [280, 113], sp: 'goose', name: 'auntie sweeping the temple step', ask: ['Did anyone drop anything?', 'Did you see a van?', 'Were they in a hurry?'], right: 0, clue: 'Wet paw prints, small ones, round the back where the awning keeps the rain off.', tag: 'shade', junk: ['', 'No van. Only a trishaw, and he is my cousin.', 'Everybody is in a hurry now. Not like last time.'] },
      ], spots: [
        { at: [275, 113], tags: ['low', 'books', 'shade'], what: 'under the book cart’s awning' },
        { at: [258, 112], tags: ['low'], what: 'under the bakery’s tables' },
        { at: [270, 111], tags: ['books'], what: 'the bookshop’s window box' },
        { at: [282, 112], tags: ['shade'], what: 'the temple’s side porch' },
        { at: [262, 113], tags: ['low', 'shade'], what: 'the bench under the frangipani' },
      ], label: 'Ask round the bird corner (E), then search where every clue points', cp: true },
      { t: 'talk', lines: [['hero', 'The rabbit lantern! A bit damp, and an otter’s whisker stuck in the paper.', 'smug'], ['mate', 'Otters. In Tiong Bahru. Somebody is paying them.', 'cross']] },
      { t: 'deliver', to: 'birdcorner', item: 'rabbit-lantern', time: 60, fragile: 4, label: 'Carry the rabbit lantern back to the bird corner (gently: it is paper)', cp: true },
      { t: 'talk', lines: [['seng', 'Listen! The merbok first, then all of them. Tiong Bahru is singing again.', 'happy'], ['hoot', 'A charming little lantern. I offered a fair price for it, you know. I always offer first.', 'calm'], ['seng', 'That is Towkay Hoot. He is buying every lantern on the island. The otters bring him what people will not sell. Kak Melati at Clarke Quay knows more.', 'cross']] },
    ] },
  { id: 'm58', ch: 9, title: 'Canopy Lights', giver: 'melati', at: 'melati', reward: 660, rep: 18, blurb: 'The otters pulled the wires out of the Clarke Quay canopy lights and tipped the river’s lotus lanterns all over the quay. Rewire the switch box and gather them up.',
    steps: [
      { t: 'talk', lines: [['melati', 'Kak Melati. I sing here every night, darling, and tonight I am singing in the dark.', 'worried'], ['melati', 'Otters. They pulled the canopy’s wires and scattered the lotus lanterns we float on the river for Mid-Autumn.', 'cross'], ['mate', 'Wires first, then lanterns. Then we ask the otters who is paying.', 'smug']] },
      { t: 'goto', at: [303, 101], label: 'To the switch box under the canopy by the Slingshot', ride: 'foot', cp: true },
      { t: 'mini', kind: 'wires', level: 3, label: 'Rewire the canopy light switch box' },
      { t: 'collect', items: [[292, 101], [316, 101], [327, 108], [294, 107]], item: 'lotus-lantern', time: 95, label: 'Gather the four lotus lanterns the otters tipped out along the quay (Read Bridge crosses the river)', cp: true },
      { t: 'goto', at: 'stage-quay', label: 'Bring the lanterns to Kak Melati’s stage', ride: 'foot' },
      { t: 'talk', lines: [['melati', 'Lights! Oh, look at the canopy. Pink, blue, the whole river is blushing.', 'happy'], ['melati', 'But my band cannot play. The otters took the instruments down the river on a bumboat.', 'worried'], ['hero', 'Then we take a bumboat too.', 'calm']] },
    ] },
  { id: 'm59', ch: 9, title: 'River Run', giver: 'melati', at: 'melati', reward: 660, rep: 18, blurb: 'The Riverside Romp are showing off down the Singapore River with the band’s instruments on their bumboat. Take the bumboat at the steps and beat them round every marker.',
    steps: [
      { t: 'talk', lines: [['melati', 'There! The otters, with my double bass standing up in their bumboat like a mast!', 'cross'], ['melati', 'They always race round the markers to show off. Beat them and they must hand everything back. Otter rules.', 'calm'], ['mate', 'Otter rules. I like otter rules.', 'happy']] },
      { t: 'ride', kind: 'boat', near: [303, 103], label: 'Jump in the bumboat at the steps by Read Bridge', cp: true },
      { t: 'race', ride: 'boat', rival: 'boat', pace: 0.85, time: 95, marks: [[316, 105], [327, 104], [305, 103], [293, 105], [314, 106], [324, 104]], label: 'Steer round every river marker before the otters’ boat', cp: true },
      { t: 'goto', at: 'melati', label: 'Back to Kak Melati at the stage', ride: 'foot', r: 140 },
      { t: 'talk', lines: [['melati', 'My bass! Not a scratch. And the otters are bowing. Such manners, for thieves.', 'happy'], ['melati', 'They say an owl pays them in fish. Tonight he wants my stage, for his own gala.', 'worried']] },
    ] },
  { id: 'm60', ch: 9, title: 'Hold the Stage', giver: 'melati', at: 'melati', reward: 680, rep: 18, blurb: 'Towkay Hoot wants the Clarke Quay stage cleared for his gala. The otters will not cross Kak Melati twice, so he has sent paid crows for the speakers, the lights and the lanterns. Hold the stage.',
    steps: [
      { t: 'talk', lines: [['melati', 'The show starts in a minute, and look up: crows, all along the godown roofs. That owl pays in shiny things.', 'worried'], ['mate', 'Then we hold the stage. Knock them back before they grab.', 'smug']] },
      { t: 'goto', at: 'stage-quay', label: 'Get to the Clarke Quay stage', cp: true },
      { t: 'defend', at: 'stage-quay', time: 66, waves: 3, per: 2, gang: 'crow', what: 'Stage', label: 'Guard the stage: knock the crows back before they grab ({mate} helps on their own)', cp: true },
      { t: 'talk', lines: [['melati', 'Not a single lantern lost! Listen to that crowd.', 'happy'], ['hoot', 'Bravo. Keep your little stage. I have all the lanterns that matter, safe in Godown Number Nine.', 'happy'], ['hero', 'Godown Number Nine. He just told us.', 'smug']] },
    ] },
  { id: 'm61', ch: 9, title: 'Godown No. 9', giver: 'melati', at: 'melati', reward: 700, rep: 19, blurb: 'Towkay Hoot keeps the lanterns he has bought and “borrowed” in Godown No. 9, south of Eu Tong Sen Street. Case the place, then take them back: quiet or loud.',
    steps: [
      { t: 'talk', lines: [['melati', 'Godown Number Nine, behind the night market. Lizards on the door. He hires everybody, that owl.', 'worried'], ['mate', 'Look first. Doors, guards, cameras, the safe.', 'smug']] },
      { t: 'goto', at: [312, 118], label: 'Cross Coleman Bridge to Godown No. 9', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: [321, 122], kind: 'door' }, { at: [319, 124], kind: 'rota' }, { at: [316, 124], kind: 'cam' }, { at: [312, 120], kind: 'safe' }], need: 3, guards: [[[312, 124], [321, 124]], [[313, 118], [321, 118]]], label: 'Photograph three things (E): the side door, the guard rota, the camera, the strongroom' },
      { t: 'talk', lines: [['mate', 'Quiet or loud? Either way, the lanterns come home.', 'smug']] },
      { t: 'heist', front: [317, 123], back: [321, 122], safe: [312, 120], drop: 'safe-quay', guards: [[[312, 124], [321, 124]], [[313, 118], [321, 118]]], cams: [[314, 124, 0], [320, 118, 180]], time: 65, loot: 'lantern-crate', level: 3, label: 'Crack the strongroom of Godown No. 9', cp: true },
      { t: 'talk', lines: [['hero', 'Crates of lanterns! But not the big one. Just a delivery note: “Moon Lantern. Jurong. Handle with claws.”', 'worried'], ['hoot', 'You found my small change. The Moon Lantern of the Chinese Garden is already mine, little ones.', 'happy'], ['melati', 'Jurong! Mr Kamal says the track is checked. The line runs to Jurong East tonight. Go!', 'cross']] },
    ] },
  { id: 'm62', ch: 9, title: 'Science Night', giver: 'suria', at: 'suria', reward: 700, rep: 19, blurb: 'Dr Suria of the Science Centre Observatory has seen lizards carrying crates past her telescope every night. Net them on Jurong Gateway Road, then follow the one that gets away.',
    steps: [
      { t: 'talk', lines: [['suria', 'Oh! Hello. Dr Suria. I look at the sky, mostly. But lately I look at the road.', 'calm'], ['suria', 'Every night at the same minute, three monitor lizards carry crates past my observatory. I have a graph.', 'worried'], ['mate', 'Nets on their path, a snack for bait. Then we follow the one that gets away.', 'smug']] },
      { t: 'goto', at: 'science', label: 'Go to the front of the Science Centre', ride: 'foot', cp: true },
      { t: 'trap', spots: [[202, 103], [206, 103], [210, 103], [214, 103]], need: 3, bait: [218, 103], wait: [212, 101], path: [[199, 103], [202, 103], [206, 103], [210, 103], [214, 103], [218, 103]], gang: 'liz', n: 3, catch: 2, label: 'Lay three nets along the road outside the Science Centre (E)', cp: true },
      { t: 'talk', lines: [['hero', 'Two in the nets. The third has a crate with a gold owl stamped on it.', 'smug'], ['mate', 'Let it lead us. I’ll wait down the road: switch to me there.', 'smug']] },
      { t: 'tail', name: 'the lizard', skin: 'liz', from: [221, 103], route: [[228, 104], [228, 110], [228, 116], [229, 121], [236, 121]], relay: { at: 3, spot: [240, 118] }, calm: 0.55, label: 'Follow the lizard down Jurong Town Hall Road; switch to {mate} by the night market (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'A warehouse behind the night market. Full of lanterns, by the glow.', 'cross'], ['suria', 'Then that is where the Moon Lantern’s frame went. Sifu Musang has been so sad. I have a plan. It involves a school trip.', 'happy']] },
    ] },
  { id: 'm63', ch: 9, title: 'School Trip', giver: 'suria', at: 'suria', reward: 720, rep: 19, blurb: 'A Science Centre school trip walks past Towkay Hoot’s warehouse tonight. Walk in with the children, then swap his lantern crates for crates of model rockets while the lizards doze.',
    steps: [
      { t: 'talk', lines: [['suria', 'Forty children, one teacher, and a walk to the night market for rocket ice cream. Nobody looks twice at a school trip.', 'happy'], ['suria', 'Take backpacks from the rack by the station. Walk slowly. Look bored.', 'calm'], ['mate', 'Bored. I can do bored.', 'smug']] },
      { t: 'blend', rack: [228, 112], route: [[228, 113], [228, 118], [232, 118], [236, 118]], goal: [236, 121], lookouts: [[230, 113, 90], [233, 118, 180], [241, 119, 180]], crowd: 9, folk: 'town', label: 'Walk with the school trip to the night market behind the station (keep to a walk)', cp: true },
      { t: 'talk', lines: [['hero', 'Crates everywhere. And lizards everywhere, pretending to be asleep.', 'worried'], ['mate', 'Swap each crate for one of Dr Suria’s rocket crates. Same size, same rattle.', 'smug']] },
      { t: 'swap', crates: [[229, 121], [232, 121], [239, 121], [241, 123]], guards: [[[228, 120], [241, 120]], [[238, 124], [241, 124]]], time: 90, decoy: 'decoy', skin: 'liz', label: 'Slip a rocket crate in for each lantern crate (E) while the lizards look away', cp: true },
      { t: 'goto', at: 'musang', label: 'Take the lanterns to Sifu Musang at the Chinese Garden gate' },
      { t: 'talk', lines: [['musang', 'My lanterns. Every rabbit, every lotus. Thank you, young ones.', 'happy'], ['musang', 'But the Moon Lantern, the big one for the lake: Hoot has it on the pagoda already, for his gala. Tickets only.', 'worried'], ['hero', 'Then we make a new plan.', 'calm']] },
    ] },
  { id: 'm64', ch: 9, title: 'The Lantern Lions', giver: 'musang', at: 'musang', reward: 720, rep: 19, blurb: 'The lion dance leads the lantern procession from the garden gate round the lake to the tea house before the festival opens, and Towkay Hoot has paid the crows to break it up.',
    steps: [
      { t: 'talk', lines: [['musang', 'Lights by the Lake opens tonight, Moon Lantern or no Moon Lantern. The lion dance leads the lanterns round the east shore to the tea house.', 'calm'], ['musang', 'Crows on the gate roof. Paid crows. They will dive for the lion’s red envelopes and scatter the procession.', 'worried'], ['mate', 'I take the far side. Nothing touches the lions.', 'smug']] },
      { t: 'goto', at: 'garden', label: 'Meet the lion dance at the Chinese Garden gate', ride: 'foot', cp: true },
      { t: 'escort', from: [220, 112], route: [[220, 113], [220, 118], [221, 124], [212, 125], [208, 125]], crows: 5, flanks: true, label: 'Keep the crows off the lion dance round the lake ({mate} guards the far side)', cp: true },
      { t: 'talk', lines: [['musang', 'Every lantern lit, and the lake is full of moons. Almost.', 'happy'], ['hoot', 'Very pretty. Mine is bigger. Gala at the pagoda, midnight. You are not invited.', 'happy'], ['hero', 'We’ll see you at midnight, Towkay.', 'cross']] },
    ] },
  { id: 'm65', ch: 9, title: 'Lights by the Lake', giver: 'musang', at: 'musang', reward: 1400, rep: 26, blurb: 'Towkay Hoot is unveiling the stolen Moon Lantern at the seven-storey pagoda. Slip past his lookouts, run him down round Jurong Lake, and bring the moon back to the festival.',
    steps: [
      { t: 'talk', lines: [['musang', 'The garden is closed for his gala. Only the pagoda, the lake and his lookouts.', 'calm'], ['suria', 'I have timed them. They stop and stare at the moon every few steps. Everybody does.', 'happy'], ['mate', 'Then I keep the gate busy. You go in quiet along the north shore.', 'smug']] },
      { t: 'goto', at: [216, 112], label: 'Go in past the stone lions', ride: 'foot', cp: true },
      { t: 'stealth', lookouts: [[[214, 107], [217, 107]], [[211, 107], [211, 109]], [[207, 107], [201, 107]]], goal: 'pagoda', exit: [216, 112], calm: 0.55, pause: 1.5, label: 'Reach the seven-storey pagoda unseen past the lookouts, then get out', cp: true },
      { t: 'talk', lines: [['hoot', 'Gate-crashers. I did offer to buy you two, once. You were not for sale. Most irritating.', 'cross'], ['hero', 'The Moon Lantern, Towkay. It belongs to the lake.', 'calm'], ['hoot', 'Everything has a price. Yours is: catch me first!', 'happy']] },
      { t: 'chase', who: 'runner', name: 'Towkay Hoot', skin: 'hoot', from: [206, 112], route: [[213, 111], [219, 112], [220, 116], [220, 123], [212, 125], [220, 123], [220, 116], [214, 111]], bumps: 2, loot: '', speed: 200, finish: 'pounce', label: 'Pounce on Towkay Hoot together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['hoot', 'My jacket! My dignity! Fine. FINE. Crow! Take the lantern up where they cannot reach!', 'cross'], ['mate', 'A crow has the Moon Lantern! It’s going up over the lake!', 'cross']] },
      { t: 'bag', at: 'here', loot: 'moon-lantern', time: 60, label: 'Knock the Moon Lantern out of the crow’s claws (shoot it, or dash when it swoops low)', cp: true },
      { t: 'pickup', at: 'loot', item: 'moon-lantern', label: 'Catch the Moon Lantern' },
      { t: 'talk', lines: [['hoot', 'I only wanted the best party on the island. For once, I wanted them to come to mine.', 'worried'], ['musang', 'Then come to ours, Towkay. A lantern costs nothing to carry.', 'happy'], ['seng', 'And chwee kueh after. I brought the steamer.', 'happy'], ['hero', 'Happy Mid-Autumn, everybody.', 'happy'], ['mate', 'Best moon ever. The whole island under it.', 'happy']] },
    ] },
  // ── chapter ten, Kampong Spirit (the seventeenth pass): Pulau Ubin, over the strait by Pak Ubin's bumboat. The Tusker
  // Boys are rooting up the whole island by night, and not for tapioca. Tiles are old-frame (the island's corner is old
  // 332, 96); lib/jade-ubin.ts lays the island out
  { id: 'm66', ch: 10, title: 'Bumboat to Ubin', giver: 'ubin', at: 'ubin', reward: 720, rep: 18, blurb: 'Pak Ubin’s cousin runs the bicycle rental on Pulau Ubin, and the island’s wayang troupe needs Auntie Lan’s mended headdress before the first show. Take the bumboat over, borrow a bike and get it to the stage.',
    steps: [
      { t: 'talk', lines: [['ubin', 'Lights by the Lake, eh? Very nice. Now come see a real kampong. My bumboat leaves from the jetty, four coins.', 'happy'], ['ubin', 'My cousin Ayu has the bicycles. And Auntie Lan’s headdress is in the box, mended. Her show starts soon.', 'calm'], ['mate', 'An island with no cars. I like it already.', 'happy']] },
      { t: 'cable', to: 'jetty-ubin', label: 'Take Pak Ubin’s bumboat from the Changi Point jetty to Pulau Ubin (E at the jetty)', cp: true },
      { t: 'goto', at: 'ayu', label: 'Find Kak Ayu at the bicycle rental by Ubin Town', ride: 'foot' },
      { t: 'talk', lines: [['ayu', 'You must be the two my cousin texted about. Welcome to Ubin! Bikes are by the rack, take any.', 'happy'], ['ayu', 'Mind the tracks after dark. The boars have gone strange this month. Digging everywhere, even the temple steps.', 'worried']] },
      { t: 'ride', kind: 'bike', near: 'bikes-ubin', label: 'Hop on a rental bike by the rack (E)', cp: true },
      { t: 'deliver', to: 'lan', item: 'headdress', time: 50, fragile: 3, label: 'Pedal the headdress to Auntie Lan at the wayang stage on Jalan Ubin: gently, it is mended', cp: true },
      { t: 'talk', lines: [['lan', 'My phoenix crown! Not a bead missing. You have a gentle wheel.', 'happy'], ['lan', 'Now if only the boars would leave my stage alone. Every night, holes under the planks. What do they want under a stage?', 'worried'], ['hero', 'Holes with a plan behind them. We’ll find out.', 'smug']] },
    ] },
  { id: 'm67', ch: 10, title: 'Hoof Prints', giver: 'ayu', at: 'ayu', reward: 730, rep: 18, blurb: 'Something broke into the Ubin Town provision shop and took nothing but the old maps off the wall. The hoof prints lead away up the red earth. Follow them, set by set.',
    steps: [
      { t: 'talk', lines: [['ayu', 'The provision shop! The door off its hinges, the rice untouched, and the old quarry maps gone from the wall.', 'cross'], ['ayu', 'Boar prints all round the back. Fresh ones shine a little in the red earth. Read each set and it shows you the next.', 'calm'], ['mate', 'Tracking. Like proper jungle rangers.', 'happy']] },
      { t: 'goto', at: [348, 112], label: 'Go behind the shops to Jalan Ubin, where the prints start', ride: 'foot', cp: true },
      { t: 'track', route: [[348, 112], [347, 109], [346, 106], [343, 108], [346, 104], [347, 101]], old: [[351, 112]], oldAt: 0, time: 80, label: 'Read the first set of hoof prints (E), then follow the trail they show', cp: true },
      { t: 'talk', lines: [['hero', 'The trail ends at a hut in the trees north of Pekan Quarry. A big one. With a mat that says KEEP OUT in hoof.', 'worried'], ['taring', 'Who is that in my forest? Out! Out before I set the boys on you!', 'cross'], ['mate', 'That must be the boss. Tusks like a pair of bananas.', 'smug'], ['ayu', 'Tok Taring. He was a nice old boar, once. Ask Uncle Belangkas: he sees everything from Chek Jawa.', 'worried']] },
    ] },
  { id: 'm68', ch: 10, title: 'Durian Season', giver: 'lan', at: 'lan', reward: 740, rep: 19, blurb: 'The kampong orchard’s durians are falling early, and the Tusker Boys get to the windfalls first. Pick the ripe ones off the high branches from Auntie Lan’s tandem, then pedal them to the temple for the festival offering.',
    steps: [
      { t: 'talk', lines: [['lan', 'The temple festival needs the first durians of the season, and the boars are eating every one that drops.', 'worried'], ['lan', 'Pick them off the branch before they fall. Take my tandem: one pedals, one reaches up. Careful of the thorns!', 'calm']] },
      { t: 'goto', at: 'orchard-ubin', label: 'Go to the kampong durian orchard south of the wayang stage', ride: 'foot', cp: true },
      { t: 'ride', kind: 'tandem', near: [348, 116], label: 'Hop on Auntie Lan’s tandem by the orchard (E): {mate} rides on the back' },
      { t: 'collect', items: [[349, 117], [355, 117], [357, 117], [350, 119]], item: 'i-durian', time: 70, high: true, label: 'Pedal under each durian tree and press F: {mate} picks it off the branch', cp: true },
      { t: 'deliver', to: 'temple-ubin', item: 'durian', time: 40, stink: true, label: 'Pedal the durians to the temple on Jalan Ubin before the smell brings every boar on the island', cp: true },
      { t: 'talk', lines: [['lan', 'The first durians, on the altar. Even the gods will go back for seconds.', 'happy'], ['hero', 'And the boars didn’t eat one. Ayu says they had maps. Since when do boars read maps?', 'worried']] },
    ] },
  { id: 'm69', ch: 10, title: 'Wayang Night', giver: 'lan', at: 'lan', reward: 760, rep: 19, blurb: 'Opening night of Auntie Lan’s wayang, and the Tusker Boys mean to dig right under the stage while the gongs play. Hold the stage till the last bow.',
    steps: [
      { t: 'talk', lines: [['lan', 'The gongs start in a minute. And listen: grunting, under the stage. Lots of grunting.', 'worried'], ['mate', 'Then we keep them off the planks till the curtain. Shoo, not hurt.', 'smug']] },
      { t: 'goto', at: 'wayang', label: 'Get to the wayang stage on Jalan Ubin', cp: true },
      { t: 'defend', at: 'wayang', time: 64, waves: 3, per: 2, gang: 'boar', what: 'Stage', label: 'Hold the wayang stage: knock the Tusker Boys back before they dig in ({mate} helps on their own)', cp: true },
      { t: 'talk', lines: [['lan', 'A full house and not one hole! Bravo, bravo!', 'happy'], ['taring', 'Sing all you like, bird. What is under that stage was buried before your grandmother’s grandmother. And it is mine.', 'cross'], ['hero', 'Buried. So it’s treasure he’s after.', 'worried']] },
    ] },
  { id: 'm70', ch: 10, title: 'Tower Watch', giver: 'belangkas', at: 'belangkas', reward: 770, rep: 19, blurb: 'Uncle Belangkas has watched lamps moving round the Tuskers’ den all week from Jejawi Tower. Go and look closer: photograph what the boars keep in their hut.',
    steps: [
      { t: 'talk', lines: [['belangkas', 'Ah, young ones. I count crabs for a living, slowly. But from Jejawi Tower I count lamps too, and the boars have many.', 'calm'], ['belangkas', 'Their hut north of Pekan Quarry. Take my camera, keep to the trees, and see what they are keeping.', 'worried']] },
      { t: 'goto', at: [347, 103], label: 'Go up Jalan Mamam to the Tuskers’ den, north of Pekan Quarry', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: [349, 101], kind: 'door' }, { at: [346, 100], kind: 'rota' }, { at: [352, 101], kind: 'cam' }, { at: [350, 103], kind: 'safe' }], need: 3, guards: [[[345, 102], [352, 102]], [[348, 104], [348, 100]]], skin: 'boar', label: 'Photograph three things (E): the hut door, the dig rota, the lookout boar, the map table', cp: true },
      { t: 'talk', lines: [['hero', 'A map table! The provision shop maps, pinned together, and a rota: “Stage. Temple. Orchard. Ketam.” Every place they dug.', 'smug'], ['belangkas', 'The old granite quarry men buried their pay in tins, my father said. Maybe the boars have heard the same story.', 'calm'], ['mate', 'Then the next place on the rota is where we’ll be first.', 'smug']] },
    ] },
  { id: 'm71', ch: 10, title: 'The Night Forager', giver: 'belangkas', at: 'belangkas', reward: 780, rep: 19, blurb: 'A Tusker Boy with a lamp and a spade leaves the den every night. Follow him down Jalan Mamam to wherever he digs, and change over to your partner half way so he never sees the same face twice.',
    steps: [
      { t: 'talk', lines: [['belangkas', 'Every night at ten, one boar, one lamp, one spade. He looks behind him a great deal.', 'calm'], ['mate', 'Then he sees you, then he sees me. Never the same chinchilla twice.', 'smug']] },
      { t: 'goto', at: [344, 101], label: 'Wait in the trees by the Tuskers’ den, off Jalan Mamam', ride: 'foot', cp: true },
      { t: 'tail', name: 'the forager', skin: 'boar', from: [347, 100], route: [[347, 104], [347, 107], [351, 107], [354, 106], [359, 107]], relay: { at: 2, spot: [347, 108] }, calm: 0.6, label: 'Follow the forager down Jalan Mamam and east past Pekan Quarry; switch to {mate} at the corner (Tab)', cp: true },
      { t: 'talk', lines: [['hero', 'Jalan Endut Senin, by the old milestone. He paced twelve steps from it and started digging. Then he stopped and went home. Wrong spot.', 'worried'], ['mate', 'So they don’t know where it is either. They’re missing a piece.', 'smug']] },
    ] },
  { id: 'm72', ch: 10, title: 'Sacks for Sacks', giver: 'ayu', at: 'ayu', reward: 790, rep: 20, blurb: 'Everything the Tusker Boys have dug up is in sacks at their den: the shop’s maps, the temple’s old bell, the stage’s lost props. Swap each sack for a sack of tapioca while they snore.',
    steps: [
      { t: 'talk', lines: [['ayu', 'They snore after midnight. Everyone on the island hears it. Like a lorry with a cold.', 'happy'], ['ayu', 'Here: tapioca sacks, same size. Boars love tapioca. They’ll never notice.', 'happy']] },
      { t: 'goto', at: [349, 106], label: 'Creep up Jalan Mamam to the den', ride: 'foot', cp: true },
      // (the loot sacks sit on dry ground round the hut, clear of Pekan Quarry's pond: two by the hut, two by the
      // pond's west bank; one boar paces in front of the door, one up and down the bank between the lower two)
      { t: 'swap', crates: [[344, 100], [351, 99], [343, 103], [347, 104]], guards: [[[346, 101], [352, 101]], [[345, 102], [345, 105]]], time: 90, decoy: 'decoy', skin: 'boar', thing: 'loot sack', label: 'Sneak (hold Shift) to each loot sack and swap in a tapioca sack (E) when no boar is watching it', cp: true },
      { t: 'goto', at: 'ayu', label: 'Take the sacks back to Kak Ayu at the bicycle rental' },
      { t: 'talk', lines: [['ayu', 'The maps! The temple bell! And what is this, wrapped in oilcloth?', 'happy'], ['hero', 'Half a page, torn. Old ink. A quarry, a winch, a cross, and on the back, a ship with black sails.', 'worried'], ['ayu', 'Half. So someone has the other half.', 'worried']] },
    ] },
  { id: 'm73', ch: 10, title: 'Round the Island', giver: 'ayu', at: 'ayu', reward: 800, rep: 20, blurb: 'The Tusker Boys have challenged the kampong to the Round-the-Island bike race: lose and they dig where they like. Ride the first half, hand over to your partner, and beat the clock.',
    steps: [
      { t: 'talk', lines: [['ayu', 'Tok Taring wants a race. If the kampong wins, the boars stop digging till the festival. If they win, they dig the jetty!', 'worried'], ['mate', 'Two of us, one bike each, half the island each. Easy.', 'smug']] },
      { t: 'ride', kind: 'bike', near: 'bikes-ubin', label: 'Take a bike from the rack (E)', cp: true },
      { t: 'race', ride: 'bike', time: 95, relay: 3, marks: [[343, 113], [350, 113], [355, 108], [359, 106], [355, 113], [352, 117], [344, 117]], label: 'Ride every flag round the island: {mate} takes over at the third (Tab)', cp: true },
      { t: 'talk', lines: [['ayu', 'The kampong wins! No digging till the festival!', 'happy'], ['taring', 'Bah. A promise is a promise. But my buyer does not wait for festivals.', 'cross'], ['hero', 'His buyer. So the Tuskers are working for someone.', 'worried']] },
    ] },
  { id: 'm74', ch: 10, title: 'Tusker Round-up', giver: 'lan', at: 'lan', reward: 820, rep: 20, blurb: 'The Tusker Boys broke their promise and are digging up the temple steps tonight. Net them along Jalan Ubin, then run down Tok Taring himself.',
    steps: [
      { t: 'talk', lines: [['lan', 'They are at the temple steps with spades! On festival week!', 'cross'], ['mate', 'Nets along Jalan Ubin, durian for bait. They never say no to durian.', 'smug']] },
      { t: 'goto', at: [345, 113], label: 'Go to Jalan Ubin outside the shops', ride: 'foot', cp: true },
      { t: 'trap', spots: [[347, 113], [350, 113], [353, 113], [356, 113]], need: 3, bait: [341, 113], wait: [345, 112], path: [[357, 112], [353, 113], [350, 113], [347, 113], [344, 113], [341, 113]], gang: 'boar', n: 3, catch: 2, label: 'Lay three nets along Jalan Ubin (E), the durian at the far end for bait', cp: true },
      { t: 'talk', lines: [['taring', 'My boys! In nets! Like fish!', 'cross'], ['hero', 'Give it up, Tok Taring. Who are you digging for?', 'calm'], ['taring', 'Catch me first, little furballs!', 'cross']] },
      { t: 'chase', who: 'runner', name: 'Tok Taring', skin: 'taring', from: [355, 112], route: [[355, 108], [358, 106], [355, 106], [355, 112], [350, 113], [347, 110], [347, 105]], bumps: 2, loot: '', speed: 190, finish: 'net', label: 'Net Tok Taring together: F sends {mate} in, then dash', cp: true },
      { t: 'talk', lines: [['taring', 'Oof. All right. ALL RIGHT. A lady came on a boat with black sails. Black feathers, a voice like silk. She pays in gold.', 'worried'], ['taring', 'She has half a chart. She wanted the other half, from the quarry men’s tin. We were only digging!', 'worried'], ['lan', 'Then you can dig the temple steps back in, Tok. Tonight.', 'cross']] },
    ] },
  { id: 'm75', ch: 10, title: 'Kampong Spirit', giver: 'belangkas', at: 'belangkas', reward: 1450, rep: 26, blurb: 'Your half of the chart shows where the quarry men’s tin lies at Ketam Quarry, and rain is coming to wash the trail away. Follow the last trail, slip past the boars the lady still pays, and open the tin before she does.',
    steps: [
      { t: 'talk', lines: [['belangkas', 'Rain coming, from the strait. It will wash every print off the island in a minute or two.', 'worried'], ['hero', 'Tok Taring’s boys went for the tin tonight, without him. A trail from the den to Ketam Quarry.', 'cross'], ['mate', 'Fast, then. Read the prints, beat the rain.', 'smug']] },
      { t: 'goto', at: [347, 104], label: 'Go to the Tuskers’ den, where tonight’s trail starts', ride: 'foot', cp: true },
      // (the trail ends at the quarry's gate, out of the lookouts' sight: it once ended on the winch itself, a tile from
      // both boars, so the sneak began inside their view and nearly every first try was caught there)
      { t: 'track', route: [[347, 105], [347, 108], [345, 110], [344, 109]], old: [[350, 108]], oldAt: 1, time: 75, label: 'Follow tonight’s trail to Ketam Quarry before the rain washes it away (E: read each set)', cp: true },
      { t: 'stealth', lookouts: [[[337, 110], [341, 110]], [[340, 107], [340, 110]]], goal: [338, 108], exit: [346, 109], calm: 0.6, pause: 1.4, label: 'Slip past the boar lookouts to the old winch at Ketam Quarry, then get out', cp: true },
      { t: 'pickup', at: [338, 108], item: 'tin-chest', label: 'Dig up the quarry men’s tin by the winch' },
      { t: 'mini', kind: 'lock', level: 3, label: 'Pick the rusted lock on the tin', cp: true },
      { t: 'talk', lines: [['hero', 'Old coins, a pay book… and the other half of the chart. They fit. A coast, a reef, an island with no name.', 'worried'], ['taring', 'You found it. Good. Better you than her. Look, on the strait.', 'worried'], ['mate', 'A junk. Black sails. No lamps. Just sitting out there in the rain.', 'worried'], ['belangkas', 'And someone on the deck, all in black feathers, looking right at us.', 'worried'], ['hero', 'Then we keep the chart. And we find out where it leads before she does.', 'calm']] },
    ] },
  // ── chapter eleven, the eighteenth pass: Kallang, match week at the Sports Hub. Madam Sutera, the lady in black
  // feathers, lands her seaplane on the Kallang Basin; she wants the 1937 flying-boat survey that photographed the island
  // with no name. It ends on a hook, not an ending.
  { id: 'm76', ch: 11, title: 'Scarves for the Fans', giver: 'tenuk', at: 'tenuk', reward: 840, rep: 20, blurb: 'Cup final week at the Sports Hub, and the fans are already pouring in. Ms Tenuk needs a box of home scarves from Kallang Wave Mall at the fan-zone stage for the giveaway: through the crowd, without dropping a scarf.',
    steps: [
      { t: 'talk', lines: [['tenuk', 'Ah. The two from Ubin. Uncle Kubung said you might come. Welcome to Kallang, in cup final week. Calmly, please.', 'calm'], ['tenuk', 'The scarves for the giveaway are at Kallang Wave Mall and the stage is at the far end of the fan walk. Between them: forty thousand fans.', 'worried'], ['mate', 'A crowd. We wait for the gaps and squeeze through. Excuse me, excuse me.', 'happy']] },
      { t: 'pickup', at: K(41, 28), item: 'kal-scarf', label: 'Pick up the box of scarves outside Kallang Wave Mall', cp: true },
      { t: 'crowd', from: K(41, 28), to: K(41, 39), lanes: 3, span: 3, time: 60, item: 'kal-scarf', label: 'Get the scarves down the fan walk to the stage: wait for a gap in each stream of fans, then squeeze through', cp: true },
      { t: 'talk', lines: [['tenuk', 'Not one scarf on the ground. You have done crowds before.', 'happy'], ['hero', 'Ms Tenuk, what is that, out on the basin? A plane, on the water. All black.', 'worried'], ['tenuk', 'A seaplane. It landed at dawn by the old airport. Nobody booked it in. I do not like things nobody booked in.', 'cross']] },
    ] },
  { id: 'm77', ch: 11, title: 'Dawn Paddle', giver: 'biru', at: 'biru', reward: 850, rep: 20, blurb: 'Coach Biru’s dragon-boat crew is two paddlers short for the dawn time trial round the basin buoys. Take a seat, keep time with the drum, and beat the rowing club’s sampan round the course.',
    steps: [
      { t: 'talk', lines: [['biru', 'YOU TWO! Arms like that, you paddle! Dawn trial, round the buoys, beat the club sampan. Hup hup!', 'happy'], ['mate', 'One paddles, one drums. I’ll keep the beat.', 'smug']] },
      { t: 'goto', at: 'pontoon', label: 'Go down to the rowing club’s pontoon on the Kallang Basin', ride: 'foot', cp: true },
      { t: 'ride', kind: 'dragon', near: 'pontoon', label: 'Step into a dragon boat at the pontoon (E): {mate} takes the drum' },
      { t: 'race', ride: 'dragon', rival: 'boat', time: 90, pace: 0.85, marks: [K(9, 27), K(3, 31), K(8, 37), K(13, 41), K(14, 32), K(11, 25)], label: 'Paddle round the six buoys before the club sampan (Space: surge with the drum)', cp: true },
      { t: 'talk', lines: [['biru', 'Faster than my Tuesday crew! Faster than my Thursday crew! Do not tell them.', 'happy'], ['hero', 'Coach, the black seaplane by the old airport slipway. Whose is it?', 'worried'], ['biru', 'A lady in black feathers. Walked up the slipway like she owned it. Asked me the way to the airport archive.', 'worried'], ['mate', 'Black feathers. A voice like silk?', 'worried'], ['biru', 'Like silk. How did you know?', 'calm']] },
    ] },
  { id: 'm78', ch: 11, title: 'Hangar Files', giver: 'kubung', at: 'kubung', reward: 860, rep: 21, blurb: 'Uncle Kubung keeps the Old Kallang Airport’s archive, and since the seaplane landed, crows in caps have been carrying crates out of his hangar. Photograph what they are up to, and do not let them see you.',
    steps: [
      { t: 'talk', lines: [['kubung', 'In 1937 this was the finest airport in the Empire. Flying boats came down on the basin and taxied up my slipway.', 'calm'], ['kubung', 'Now crows in caps carry my crates out in the night. Old logbooks, maps, photographs. Will you look, quietly?', 'worried']] },
      { t: 'goto', at: K(23, 14), label: 'Go round to the old airport’s apron, in front of the terminal', ride: 'foot', cp: true },
      { t: 'case', spots: [{ at: K(19, 8), kind: 'door' }, { at: K(28, 8), kind: 'rota' }, { at: K(30, 12), kind: 'cam' }, { at: K(20, 13), kind: 'safe' }], need: 3, guards: [[K(18, 10), K(30, 10)], [K(25, 15), K(25, 9)]], label: 'Photograph three things (E): the hangar door, the crates’ list, the lookout, the strongbox', cp: true },
      { t: 'talk', lines: [['hero', 'The crates’ list: “Logbooks, 1937. Survey photographs. Charts.” And on every crate, a black feather.', 'worried'], ['kubung', 'The flying-boat survey! In 1937 a flying boat flew south from this basin and photographed an island that is on no map.', 'worried'], ['mate', 'An island with no name. Like on our chart.', 'smug']] },
    ] },
  { id: 'm79', ch: 11, title: 'Follow the Feather', giver: 'kubung', at: 'kubung', reward: 870, rep: 21, blurb: 'A crow you know too well is carrying one of Uncle Kubung’s crates from the hangar to the Sports Hub. Follow Pip without being seen, and change over to your partner on the boulevard so Pip never sees the same face twice.',
    steps: [
      { t: 'talk', lines: [['kubung', 'One crow in a cap, one crate, every night. Off down Stadium Boulevard, very pleased with itself.', 'calm'], ['hero', 'That cap. That swagger. That’s Pip.', 'cross'], ['mate', 'Then Pip sees you, then Pip sees me. Never the same chinchilla twice.', 'smug']] },
      { t: 'goto', at: K(22, 13), label: 'Wait by the old terminal for Pip to come out of the hangar', ride: 'foot', cp: true },
      { t: 'tail', from: K(24, 13), route: [K(24, 15), K(31, 15), K(31, 21), K(34, 25), K(38, 27), K(39, 32)], relay: { at: 3, spot: K(33, 21) }, calm: 0.55, label: 'Follow Pip down the boulevard to the Sports Hub; switch to {mate} by the station (Tab)', cp: true },
      { t: 'talk', lines: [['sutera', 'Thank you, Pip. And thank you, little ones, for walking my courier home. You have something of mine, I believe. A chart.', 'calm'], ['hero', 'It’s not yours. The quarry men buried it, and we dug it up.', 'cross'], ['sutera', 'Half a story, darlings. The other half flew out of this basin in 1937. I will have both. I always do.', 'happy'], ['mate', 'She’s very… silky.', 'worried']] },
    ] },
  { id: 'm80', ch: 11, title: 'Through the Turnstiles', giver: 'tenuk', at: 'tenuk', reward: 880, rep: 21, blurb: 'Madam Sutera has a box at the stadium for the semi-final, and Ms Tenuk saw a crate carried in through the west gate. Get through the pre-match crowd and show your ticket before kick-off.',
    steps: [
      { t: 'talk', lines: [['tenuk', 'Your lady in black has a box for tonight. Her crows carried a crate in at the west gate. Here: two tickets.', 'calm'], ['tenuk', 'Kick-off in a few minutes. The west concourse is solid with fans. Calmly, and quickly.', 'worried']] },
      { t: 'goto', at: K(21, 24), label: 'Go to the top of the west concourse, by the Riverwalk', ride: 'foot', cp: true },
      { t: 'crowd', from: K(21, 24), to: K(22, 33), lanes: 3, span: 3, time: 70, ticket: true, label: 'Squeeze through the pre-match crowd to the west gate, then show your ticket (E)', cp: true },
      { t: 'talk', lines: [['hero', 'The steward says the crows left again, with the crate, out towards the fan zone.', 'worried'], ['tenuk', 'The fan zone. Where my big screen is. Where forty thousand people will watch the second half if the bowl is full. Oh no.', 'cross']] },
    ] },
  { id: 'm81', ch: 11, title: 'Big Screen', giver: 'tenuk', at: 'tenuk', reward: 890, rep: 22, blurb: 'The Kaypoh Crows are at the fan zone pulling the cables out of Ms Tenuk’s big screen. Hold the stage and the screen until the half-time whistle.',
    steps: [
      { t: 'talk', lines: [['tenuk', 'Crows in the cables! If the screen goes dark the fan zone riots. Politely, but it riots.', 'worried'], ['mate', 'Then we keep them off it till half-time. Shoo, not hurt.', 'smug']] },
      { t: 'goto', at: 'fanzone', label: 'Get to the fan-zone stage at the end of the fan walk', cp: true },
      { t: 'defend', at: 'fanzone', time: 62, waves: 3, per: 2, gang: 'crow', what: 'Big Screen', label: 'Hold the fan zone: knock the crows back before they reach the screen’s cables ({mate} helps on their own)', cp: true },
      { t: 'talk', lines: [['tenuk', 'The screen held! And the fans did not even notice. That is the best kind of event.', 'happy'], ['hero', 'It was a distraction. While we were here, the crate went back to the hangar.', 'cross']] },
    ] },
  { id: 'm82', ch: 11, title: 'Crate Swap', giver: 'kubung', at: 'kubung', reward: 900, rep: 22, blurb: 'Madam Sutera’s crates are on the apron, ready to load into the seaplane at dawn. Swap each one for a crate of old newspapers while the crows on watch look the other way.',
    steps: [
      { t: 'talk', lines: [['kubung', 'Four crates on my apron, for the seaplane at dawn. My logbooks are in one of them. I have crates of old newspapers, the same size.', 'worried'], ['mate', 'Newspapers for logbooks. She’ll be reading the weather forecast from 1990.', 'smug']] },
      { t: 'goto', at: K(23, 15), label: 'Creep onto the old airport’s apron', ride: 'foot', cp: true },
      { t: 'swap', crates: [K(19, 10), K(27, 10), K(21, 14), K(29, 13)], guards: [[K(18, 11), K(30, 11)], [K(25, 15), K(25, 9)]], time: 90, decoy: 'decoy', label: 'Swap a newspaper crate for each of hers (E) while the crows look away', cp: true },
      { t: 'goto', at: 'kubung', label: 'Take the crates back to Uncle Kubung at the terminal' },
      { t: 'talk', lines: [['kubung', 'My logbooks! The survey, 1937… but look. The page with the photograph is torn out.', 'worried'], ['hero', 'So she has the photograph of the island. And we have the chart that shows the way in past the reef.', 'worried'], ['kubung', 'Then she needs your chart, and you need her photograph. Oh dear. That is how wars start. Or friendships.', 'calm']] },
    ] },
  { id: 'm83', ch: 11, title: 'Logbook Run', giver: 'biru', at: 'biru', reward: 910, rep: 22, blurb: 'Crows are watching every road out of Kallang, and Uncle Kubung’s logbook must reach the Riverwalk steps, where Ms Tenuk’s car is waiting. Coach Biru says go by water: paddle it across the basin against the clock.',
    steps: [
      { t: 'talk', lines: [['biru', 'Crows on the boulevard, crows on the bridge. But no crow can catch a dragon boat in full flight. Hup hup!', 'happy'], ['mate', 'I drum, you paddle. And mind the logbook: it’s older than both of us put together.', 'smug']] },
      { t: 'goto', at: 'pontoon', label: 'Go down to the pontoon with the logbook', ride: 'foot', cp: true },
      { t: 'ride', kind: 'dragon', near: 'pontoon', label: 'Step into a dragon boat at the pontoon (E): {mate} takes the drum' },
      { t: 'paddle', to: K(14, 39), time: 60, item: 'kal-charts', label: 'Paddle the logbook across the basin to the Riverwalk steps (Space: surge with the drum)', cp: true },
      { t: 'talk', lines: [['tenuk', 'Logbook received. It goes in the Sports Hub safe, under the trophy. Nobody gets near the trophy.', 'calm'], ['hero', 'Not even Madam Sutera?', 'worried'], ['tenuk', 'She has a ticket for the final. Everybody has a ticket for the final.', 'worried']] },
    ] },
  { id: 'm84', ch: 11, title: 'One of the Crowd', giver: 'tenuk', at: 'tenuk', reward: 930, rep: 23, blurb: 'Final night. Madam Sutera is meeting her crows at the south gate, and two chinchillas in team scarves are just two more fans. Put on the home shirt, walk with the crowd, and listen.',
    steps: [
      { t: 'talk', lines: [['tenuk', 'She meets her crows at the south gate before kick-off. Two chinchillas would stand out. Two fans would not.', 'calm'], ['mate', 'Home shirts. Red and white. I look good in red and white.', 'happy']] },
      { t: 'blend', rack: K(40, 28), route: [K(40, 29), K(41, 34), K(40, 39), K(35, 41), K(32, 41)], goal: K(31, 41), lookouts: [[...K(38, 35), 0], [...K(34, 42), 270]], crowd: 8, folk: 'town', label: 'Put on the home shirt by the scarf kiosk (E), then walk with the fans to the south gate', cp: true },
      { t: 'talk', lines: [['sutera', 'The photograph shows the island. Their chart shows the way in past the reef. One without the other is a very pretty postcard.', 'calm'], ['sutera', 'At the final whistle the whole stadium pours out at once. Pip: in the crowd, take the chart. Then the plane.', 'happy'], ['hero', 'At full time, then. We’ll be ready.', 'cross']] },
    ] },
  { id: 'm85', ch: 11, title: 'Kallang Roar', giver: 'biru', at: 'biru', reward: 1600, rep: 28, blurb: 'Full time at the cup final, and the National Stadium empties all at once. Get the chart through the roaring crowd to the pontoon, run down Pip on the basin when the crows strike, and see where Madam Sutera goes next.',
    steps: [
      { t: 'talk', lines: [['biru', 'Final whistle! Home team wins! Listen to that, the Kallang Roar! Fifty thousand voices!', 'happy'], ['hero', 'And fifty thousand people coming out at once. With us in the middle, holding the chart.', 'worried'], ['biru', 'The boats are ready at the pontoon. Get the chart to the water, and we paddle it home.', 'calm']] },
      { t: 'goto', at: K(37, 41), label: 'Go to the stadium’s south gate as the final whistle blows', ride: 'foot', cp: true },
      { t: 'crowd', from: K(37, 41), to: K(20, 41), lanes: 3, span: 2, time: 70, item: 'i-map', keep: true, label: 'Carry the chart west through the crowd pouring out of the stadium: wait for each gap, then squeeze through', cp: true },
      { t: 'talk', lines: [['hero', 'Through! Now down to the pontoon and—', 'happy'], ['mate', 'PIP! Pip has the chart! Snatched it right off you! Pip’s in the club’s sampan!', 'cross']] },
      { t: 'goto', at: 'pontoon', label: 'Run up the Riverwalk to the pontoon after Pip', ride: 'foot', cp: true },
      { t: 'ride', kind: 'dragon', near: 'pontoon', label: 'Jump into a dragon boat at the pontoon (E): {mate} takes the drum' },
      { t: 'chase', who: 'boat', from: K(9, 28), route: [K(4, 34), K(10, 39), K(14, 33), K(8, 27), K(3, 36), K(12, 41)], bumps: 3, loot: 'i-map', speed: 200, label: 'Paddle after Pip’s sampan and bump it three times', cp: true },
      { t: 'talk', lines: [['hero', 'Got it! The chart, dry and whole. Sorry, Pip.', 'happy'], ['sutera', 'Keep it, darlings. A chart is only paper. I have the photograph, and the photograph has the bearing.', 'happy'], ['mate', 'The seaplane! Its engines are going! She’s taking off across the basin!', 'worried'], ['biru', 'Heading south. Low and fast, over the Straits.', 'worried'], ['hero', 'South. Towards an island with no name. And she’s a day ahead of us.', 'cross']] },
    ] },
]);
// ── Hawker Tales: the Singapore side jobs. They sit outside the five chapters (ch 0), open once their story job is
// done, and pay like a story job; the townsfolk they help are in PEOPLE.
export const SIDE: Mission[] = mvMissions([
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
  // the twelfth pass's Hawker Tales: Katong, Orchard Road and Changi
  { id: 'k14', side: 'm47', ch: 0, title: 'Kueh for the Kebaya Club', giver: 'rosie', at: 'rosie', reward: 200, rep: 12, blurb: 'Nyonya Rosie’s kebaya ladies meet at the songbird corner tonight. Fold the kueh with her, then run the tray over before it goes soggy.',
    steps: [
      { t: 'talk', lines: [['rosie', 'Kueh lapis, ang ku kueh, onde-onde. My kebaya ladies eat like birds. Very hungry birds.', 'happy'], ['mate', 'We fold, you steam. Then we run.', 'smug']] },
      { t: 'mini', kind: 'dumpling', level: 2, label: 'Fold the kueh with Nyonya Rosie', cp: true },
      { t: 'pickup', at: 'rosie', item: 'kuih', label: 'Take the tray of kueh' },
      { t: 'deliver', to: 'birds', item: 'kuih', time: 55, fragile: 5, label: 'Carry the kueh to the songbird corner (bumps squash them)', cp: true },
      { t: 'talk', lines: [['rosie', 'They say the onde-onde is better than mine. Hmph. Next time I fold, you watch.', 'happy']] },
    ] },
  { id: 'k15', side: 'm52', ch: 0, title: 'Shopping Spree', giver: 'tiara', at: 'tiara', reward: 210, rep: 12, blurb: 'Ms Tiara’s whole crew dropped their shopping running from the bats. Gather the bags along Orchard Road before the night market closes.',
    steps: [
      { t: 'talk', lines: [['tiara', 'My crew ran from the bats and dropped everything! Gifts for the whole team, all over Orchard Road.', 'worried'], ['hero', 'Four bags. We’ll find them.', 'calm']] },
      { t: 'collect', items: [[279, 10], [306, 9], [320, 21], [288, 33]], item: 'shop-bags', time: 85, label: 'Gather the four shopping bags along Orchard Road', cp: true },
      { t: 'goto', at: 'tiara', label: 'Bring the bags back to Ms Tiara', ride: 'foot' },
      { t: 'talk', lines: [['tiara', 'Every gift! You two are on the light-up team now. Honorary.', 'happy']] },
    ] },
  { id: 'k16', side: 'm54', ch: 0, title: 'Last Bumboat to Ubin', giver: 'ubin', at: 'ubin', reward: 220, rep: 12, blurb: 'Pak Ubin’s old rival says his bumboat is faster. Take Pak Ubin’s boat round the channel markers off Changi Beach and prove him wrong.',
    steps: [
      { t: 'talk', lines: [['ubin', 'That young otter says his boat is faster than mine. Fifty years! Faster!', 'cross'], ['ubin', 'Take my bumboat round the markers. Show him how an old boat goes.', 'happy']] },
      { t: 'ride', kind: 'boat', near: [368, 90], label: 'Jump in Pak Ubin’s bumboat by the jetty', cp: true },
      { t: 'race', ride: 'boat', rival: 'boat', pace: 0.88, time: 80, marks: [[360, 94], [346, 95], [332, 94], [346, 91], [362, 91]], label: 'Steer round every channel marker before the otter’s boat', cp: true },
      { t: 'goto', at: 'ubin', label: 'Back to Pak Ubin at the jetty', ride: 'foot', r: 140 },
      { t: 'talk', lines: [['ubin', 'Hah! Old boat, old captain, still the fastest. Come, kopi on me.', 'happy']] },
    ] },
  // the fourteenth pass's Hawker Tales: Tiong Bahru, Clarke Quay and Jurong
  { id: 'k17', side: 'm57', ch: 0, title: 'Cages before Dawn', giver: 'seng', at: 'seng', reward: 230, rep: 12, blurb: 'The bird uncles’ spare cages are locked in the storeroom behind the Monkey God Temple, and the key is lost. Pick the lock, then carry the cages to the bird corner before the morning song.',
    steps: [
      { t: 'talk', lines: [['seng', 'The singing contest is at sunrise and the spare cages are locked up. The key? In somebody’s other trousers.', 'worried'], ['mate', 'A lock. We know locks.', 'smug']] },
      { t: 'goto', at: 'monkeygod', label: 'Go to the storeroom beside the Monkey God Temple', ride: 'foot', cp: true },
      { t: 'mini', kind: 'lock', level: 2, label: 'Pick the storeroom lock' },
      { t: 'pickup', at: 'monkeygod', item: 'bird-pole', label: 'Take the songbird cages' },
      { t: 'deliver', to: 'birdcorner', item: 'bird-pole', time: 55, fragile: 5, label: 'Carry the cages to the bird corner (gently: bumps bend the bamboo)', cp: true },
      { t: 'talk', lines: [['seng', 'Just in time. Hear that? My merbok is warming up. He will win, you watch.', 'happy']] },
    ] },
  { id: 'k18', side: 'm61', ch: 0, title: 'Encore', giver: 'melati', at: 'melati', reward: 240, rep: 12, blurb: 'A gust off the river took Kak Melati’s song sheets down both banks of Clarke Quay. Gather them before the encore.',
    steps: [
      { t: 'talk', lines: [['melati', 'My song sheets! The wind took them off the stand, over the river, everywhere. And the crowd wants one more.', 'worried'], ['hero', 'Four sheets. Both banks. Back before the applause stops.', 'calm']] },
      { t: 'collect', items: [[291, 101], [312, 107], [328, 107], [306, 113]], item: 'recipe', time: 85, label: 'Gather the four song sheets along both banks (Read Bridge and Coleman Bridge cross the river)', cp: true },
      { t: 'goto', at: 'melati', label: 'Bring the sheets back to Kak Melati', ride: 'foot' },
      { t: 'talk', lines: [['melati', 'Every page! This one is for you two, darlings. Front row.', 'happy']] },
    ] },
  { id: 'k19', side: 'm63', ch: 0, title: 'Rocket Day', giver: 'suria', at: 'suria', reward: 250, rep: 12, blurb: 'The school trip launched their model rockets all at once, and they came down all over Jurong. Find them before the bus leaves.',
    steps: [
      { t: 'talk', lines: [['suria', 'Four rockets, four excellent launches, and no idea where any of them landed. I did tell them about wind.', 'worried'], ['mate', 'We’ll find them. Rockets are easy. They’re the pointy things.', 'smug']] },
      { t: 'collect', items: [[200, 102], [222, 103], [238, 103], [232, 113]], item: 'rocket', time: 90, label: 'Find the four model rockets round the Science Centre and Jem', cp: true },
      { t: 'goto', at: 'suria', label: 'Bring the rockets back to Dr Suria' },
      { t: 'talk', lines: [['suria', 'All four, and only one bent fin. The children say you are the best ground crew in Singapore.', 'happy']] },
    ] },
  // ── the sixteenth pass: a job for each of the fifteenth pass's rides
  { id: 'k20', side: 'm51', ch: 0, title: 'Two Scoops', giver: 'buaya', at: 'buaya', reward: 260, rep: 12, blurb: 'Datin Ciku’s bats took Uncle Buaya’s whole freezer of potong for their gala and are guarding it behind Ngee Ann City. Bats can’t resist the ice-cream chime. Ring it, and while they eat, photograph the proof.',
    steps: [
      { t: 'talk', lines: [['buaya', 'Thirty years I ride this motorbike down Orchard Road. Tonight, my freezer: gone! The Atas Bats are selling MY potong at their gala behind Ngee Ann City.', 'cross'], ['buaya', 'Inspector Siew needs photos, but the bats are on guard. Secret: no bat can resist the ice-cream chime. Take my motorbike.', 'happy'], ['mate', 'I’ll ride in the sidecar and hand out the cones.', 'smug']] },
      { t: 'ride', kind: 'icecream', near: 'buaya', label: 'Get on Uncle Buaya’s ice-cream motorbike (E)', cp: true },
      { t: 'case', skin: 'bat', spots: [{ at: [315, 7], kind: 'door' }, { at: [319, 7], kind: 'safe' }, { at: [323, 8], kind: 'rota' }, { at: [326, 7], kind: 'cam' }], need: 3, guards: [[[316, 9], [319, 9]], [[322, 10], [325, 10]]],
        label: 'Ride up to the bats and ring the chime (Q): they come for an ice cream. While they eat, hop off (E) and photograph three things', cp: true },
      { t: 'goto', at: 'buaya', label: 'Take the photos back to Uncle Buaya' },
      { t: 'talk', lines: [['buaya', 'Wah, clear clear! The freezer, the back door, even their rota. Inspector Siew will be very happy. The bats, not so much.', 'happy'], ['buaya', 'Two scoops each, on the house. Next time, you ring the chime anywhere you like.', 'happy']] },
    ] },
  { id: 'k21', side: 'm59', ch: 0, title: 'Bak Chang by Boat', giver: 'kerbau', at: 'kerbau', reward: 270, rep: 12, blurb: 'Coach Kerbau’s dragon-boat crew are training at the harbour and their bak chang supper is still at Clarke Quay. Paddle it down the Singapore River before it goes cold. Alone you’re too slow: take the partner to drum.',
    steps: [
      { t: 'talk', lines: [['kerbau', 'Paddles up! My crew trains at the harbour tonight and their bak chang is still here, hot. Cold bak chang, no power.', 'worried'], ['kerbau', 'One paddles, one drums. The drum is the secret: on the beat, the boat surges twice as often. Space on the beat!', 'happy'], ['mate', 'I’ll drum. You paddle. Don’t steer into a bridge.', 'smug']] },
      { t: 'ride', kind: 'dragon', near: 'kerbau', label: 'Climb into the dragon boat (E): {mate} takes the drum', cp: true },
      { t: 'paddle', to: [8, 88], time: 17, item: 'kuih', label: 'Paddle the bak chang down the river to the harbour', cp: true },
      { t: 'talk', lines: [['kerbau', 'Still steaming! You two have the timing of a full crew. Come and train with us any night.', 'happy'], ['mate', 'My arms say no. My stomach says bak chang.', 'happy']] },
    ] },
  { id: 'k22', side: 'm49', ch: 0, title: 'Picnic Post', giver: 'bala', at: 'bala', reward: 260, rep: 12, blurb: 'Four families at East Coast Park ordered nasi lemak from the hawker centre, and Uncle Bala’s delivery cyclist is off sick. Take the tandem: one pedals, one tosses.',
    steps: [
      { t: 'talk', lines: [['bala', 'Four families, four nasi lemak, all at the barbecue pits along the park. My delivery boy? Fever. Take the tandem!', 'worried'], ['mate', 'You pedal, I toss from the back. I have very good aim.', 'smug'], ['bala', 'Toss gently, ah. Nasi lemak is not a frisbee.', 'calm']] },
      { t: 'ride', kind: 'tandem', near: 'bala', label: 'Get on the tandem (E): {mate} hops on the back', cp: true },
      { t: 'toss', marks: [[280, 86], [290, 85], [309, 85], [316, 86]], item: 'nasi-lemak', time: 80, label: 'Pedal past the four barbecue pits: F near each one and {mate} tosses the nasi lemak', cp: true },
      { t: 'goto', at: 'bala', label: 'Ride back to Uncle Bala' },
      { t: 'talk', lines: [['bala', 'Four families, four thumbs up, zero rice on the floor. Wah, power! Keep the tandem as long as you like.', 'happy']] },
    ] },
  { id: 'k23', side: 'm45', ch: 0, title: 'Down Siloso Road', giver: 'helang', at: 'helang', reward: 270, rep: 12, blurb: 'A Kecoh mynah snatched Sergeant Helang’s medal and is hopping off down Siloso Road. A luge cart is the fastest thing on Sentosa.',
    steps: [
      { t: 'talk', lines: [['helang', 'Attention! A mynah has my long-service medal! Last seen heading for the Skyline Luge!', 'cross'], ['hero', 'Downhill, fast, no brakes. Sounds like us.', 'smug']] },
      { t: 'ride', kind: 'luge', near: [75, 100], label: 'Get in the Skyline Luge cart on Siloso Road (E)', cp: true },
      { t: 'chase', who: 'runner', name: 'the mynah', skin: 'myna', from: [81, 101], route: [[100, 101], [118, 101], [118, 113], [95, 113], [93, 102], [104, 102]], bumps: 3, loot: '', speed: 245, label: 'Luge after the mynah down Siloso Road and bump it three times', cp: true },
      { t: 'talk', lines: [['helang', 'My medal! Polished, even. Mynahs like shiny things. Excellent pursuit, soldiers. Salute!', 'happy']] },
    ] },
  // the seventeenth pass: three on Pulau Ubin
  { id: 'k24', side: 'm66', ch: 0, title: 'Kampong Post', giver: 'ayu', at: 'bikes-ubin', reward: 280, rep: 12, blurb: 'The postman’s bike has a flat, so the kampong’s letters go by Kak Ayu’s tandem today. Pedal the round and drop each bundle at the door without stopping.',
    steps: [
      { t: 'talk', lines: [['ayu', 'Postman Ah Seng has a puncture and forty letters. You ride, I’ll mend.', 'happy'], ['mate', 'You pedal, I throw. Partners.', 'smug']] },
      // (the rental's own tandem, parked past the bike rack: near the rental's door, a spare once spawned boxed in
      // between a coconut palm, the shop and the pond)
      { t: 'ride', kind: 'tandem', near: [351, 119], label: 'Take Kak Ayu’s tandem from the rental (E): {mate} rides on the back', cp: true },
      { t: 'toss', marks: [[344, 113], [351, 113], [356, 110], [356, 107]], item: 'parcel', time: 80, label: 'Pedal past the four kampong doors: F near each one and {mate} tosses the letters', cp: true },
      { t: 'talk', lines: [['ayu', 'Every letter home, and not one in a puddle. Ah Seng says you can have his round.', 'happy']] },
    ] },
  { id: 'k25', side: 'm70', ch: 0, title: 'Crab Count', giver: 'belangkas', at: 'chekjawa', reward: 280, rep: 12, blurb: 'The low tide at Chek Jawa only lasts so long. Help Uncle Belangkas count his cousins, the horseshoe crabs, along the boardwalk before the water comes back.',
    steps: [
      { t: 'talk', lines: [['belangkas', 'Every year I count the horseshoe crabs on the flats. Cousins, all of them. This year my knees say no.', 'calm'], ['mate', 'We count, you write. Four sightings, quick before the tide.', 'happy']] },
      { t: 'collect', items: [[361, 106], [364, 106], [364, 113], [360, 113]], item: 'horseshoe-crab', time: 70, label: 'Walk the Chek Jawa boardwalk and count the four horseshoe crabs (E at each) before the tide comes in', cp: true },
      { t: 'talk', lines: [['belangkas', 'Four! Up from three last year. Small numbers, but going the right way.', 'happy']] },
    ] },
  { id: 'k26', side: 'm68', ch: 0, title: 'Stinky Cargo', giver: 'lan', at: 'orchard-ubin', reward: 290, rep: 12, blurb: 'Pak Ubin is taking a basket of the orchard’s durians back over to Changi for the troupe’s cousins. Pedal it to the jetty before the bumboat goes, and outrun the smell.',
    steps: [
      { t: 'talk', lines: [['lan', 'A basket of durians for my cousins in Changi Village. Pak Ubin’s boat leaves soon.', 'happy'], ['mate', 'A basket of durians. On a bike. Past every boar on the island.', 'worried']] },
      { t: 'pickup', at: [350, 117], item: 'durian', label: 'Pick up the durian basket by the orchard lane' },
      { t: 'ride', kind: 'bike', near: [348, 116], label: 'Get on a bike (E)' },
      { t: 'deliver', to: 'jetty-ubin', item: 'durian', time: 45, stink: true, fines: 6, label: 'Rush the durians to the Ubin jetty: don’t knock into anyone (each bump costs 6 s)', cp: true },
      { t: 'talk', lines: [['ubin', 'Wah, I can smell them from the boat! Good ones. Climb aboard, durians.', 'happy']] },
    ] },
  // the eighteenth pass: three in Kallang
  { id: 'k27', side: 'm76', ch: 0, title: 'The Big Drum', giver: 'tenuk', at: 'fanzone', reward: 300, rep: 12, blurb: 'Uncle Gendang, the sun bear who leads the home end’s drumming, left his big drum at the fan-zone stage, and the band starts at the mall in a minute. Carry it back up the fan walk through the crowd.',
    steps: [
      { t: 'talk', lines: [['tenuk', 'Uncle Gendang’s drum. Without it the home end is just very loud singing. Could you?', 'calm'], ['mate', 'A big drum through a big crowd. Excuse me, excuse me, mind the drum.', 'happy']] },
      { t: 'crowd', from: K(41, 39), to: K(41, 28), lanes: 3, span: 3, time: 60, item: 'kal-drum', label: 'Carry the drum up the fan walk to the mall: wait for a gap in each stream of fans, then squeeze through', cp: true },
      { t: 'talk', lines: [['tenuk', 'The drum is home, and listen: boom, boom, boom. The whole mall is shaking. Good.', 'happy']] },
    ] },
  { id: 'k28', side: 'm77', ch: 0, title: 'Morning Run', giver: 'biru', at: 'club', reward: 300, rep: 12, blurb: 'Coach Biru runs the Riverwalk every morning before practice and says no paddler alive can keep up. Prove him wrong: every marker along the water before he gets back to the boathouse.',
    steps: [
      { t: 'talk', lines: [['biru', 'Every morning: boathouse, Riverwalk, sea wall, and back. No paddler alive has beaten me. Hup!', 'happy'], ['mate', 'He has very short legs for someone who talks so fast.', 'smug']] },
      { t: 'race', ride: 'foot', rival: 'runner', time: 80, pace: 0.9, marks: [K(12, 20), K(18, 25), K(18, 33), K(19, 42), K(18, 30), K(11, 21)], label: 'Run every marker along the Riverwalk and back before Coach Biru', cp: true },
      { t: 'talk', lines: [['biru', 'Beaten! By a chinchilla! In my own Riverwalk! Same time tomorrow?', 'happy']] },
    ] },
  { id: 'k29', side: 'm78', ch: 0, title: 'Loose Pages', giver: 'kubung', at: 'airport', reward: 300, rep: 12, blurb: 'A gust off the basin blew a box of Uncle Kubung’s old flight logs open, and the pages are skating across the apron. Pick up all four before the wind takes them into the water.',
    steps: [
      { t: 'talk', lines: [['kubung', 'The wind! My 1938 logs, all over the apron! Four pages, and the basin is very wet.', 'worried'], ['mate', 'Four pages. We can do four pages.', 'happy']] },
      { t: 'collect', items: [K(17, 9), K(31, 5), K(29, 14), K(20, 15)], item: 'kal-charts', time: 70, label: 'Pick up the four flight-log pages blowing across the apron (E at each) before they reach the water', cp: true },
      { t: 'talk', lines: [['kubung', 'All four. Every take-off, every landing. Thank you. History is mostly paper, and paper is mostly wind.', 'happy']] },
    ] },
]);
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

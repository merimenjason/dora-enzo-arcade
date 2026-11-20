// Jade Street (eleventh pass): procedural contracts. The story's jobs run out; contracts never do. A contract is built
// from a seed: a giver from the cast who stands in an open district, a rival gang, a kind of job (an archetype that
// strings two to four of the existing step kinds into one story: fetch and deliver, run down a thief, net a gang, tail
// a runner and swap the crates, crack a safe, hold a stall, walk the lion, race, play detective, slip past in a
// disguise, pick a lock, sweep a street for the inspector, or win a district back), places from the island's own map
// (named spots, markets, safe houses, the empire's properties and plain pavement, each checked to be in an open district
// and reachable on foot from the giver), some modifiers (a graveyard shift, a storm, a tight clock, no rides, the partner
// busy elsewhere, the wardens out in force) and first-person lines in the giver's voice and the gang's. The same seed
// and the same context always give the same contract (tests/jade-proc.mjs checks a thousand seeds).
//   genContract  the contract (pure: the city, the open districts, the seed)
//   contractMission  the job the runner in lib/jade-mission.ts plays (a few numbers depend on Assist)
// The offers on the phone, the contract of the day and the rivals' pushback live in lib/jade-contracts.ts.
import { T, W, S, districtAt, streetAt, DISTRICT_NAME, CT_DISTRICTS, type City, type District } from './jade-city.js';
import { city as cityOnce } from './jade-city.js';
import { field, nearestFree, type Field } from './jade-nav.js';
import { rng, hashStr, dist } from './jade-rng.js';
import { PEOPLE, MISSIONS, SIDE, type Mission, type Step, type Spot, type Witness, type Line, type Mood } from './jade-story.js';
import { BIZ, bizPos } from './jade-biz.js';
import { RAID_GANG, GANG_NAME } from './jade-props.js';
import { chaseLoop, trapPlan, tilesDown } from './jade-empire.js';
import { FRAMES } from './jade-art.js';

export type Gang = 'crow' | 'mac' | 'otter' | 'liz' | 'myna' | 'bat';
/** night: a graveyard shift (darker, guards see less far); rain: a storm the whole way; timer: every clock is
 * shorter; foot: no rides; solo: the partner is busy elsewhere; wardens: the fine city's wardens out in force */
export type Mod = 'night' | 'rain' | 'timer' | 'foot' | 'solo' | 'wardens';
export const MODS: Mod[] = ['night', 'rain', 'timer', 'foot', 'solo', 'wardens'];
export const MOD_NAME: Record<Mod, string> = { night: 'Graveyard shift', rain: 'Storm', timer: 'Tight clock', foot: 'No rides', solo: 'Partner busy', wardens: 'FINE CITY' };
export const MOD_TEXT: Record<Mod, string> = {
  night: 'After midnight: darker streets, and guards see a little less far',
  rain: 'A thunderstorm the whole way',
  timer: 'Every clock in the job runs shorter',
  foot: 'On foot only: no scooters, boats or taxis',
  solo: 'Your partner is busy elsewhere: no help, no tag-team moves',
  wardens: 'The wardens are out in force: every ticket costs you seconds',
};
export type Kind = 'courier' | 'recover' | 'sting' | 'undercover' | 'heist' | 'stand' | 'parade' | 'race' | 'sleuth' | 'blend' | 'crack' | 'sweep' | 'retake';
export const KINDS: Kind[] = ['courier', 'recover', 'sting', 'undercover', 'heist', 'stand', 'parade', 'race', 'sleuth', 'blend', 'crack', 'sweep', 'retake'];
export const KIND_NAME: Record<Kind, string> = { courier: 'Delivery', recover: 'Recovery', sting: 'Sting', undercover: 'Undercover', heist: 'Heist', stand: 'Stand', parade: 'Escort', race: 'Race', sleuth: 'Detective', blend: 'Disguise', crack: 'Safecracking', sweep: 'Clean-up', retake: 'Turf' };
/** what the generator is asked for: a seed, the tier (from rank, territory and contracts done), the difficulty in
 * stars, the open districts; optional: the day (contract of the day), a contested district (the rivals' pushback), a
 * giver and kind already chosen (an offer regenerated from the save), givers to avoid (busy with a story job) */
export type CRef = { seed: number; tier: number; stars: 1 | 2 | 3; open: District[]; day?: string; contest?: { d: District; gang: Gang }; giver?: string; kind?: string; avoid?: string[] };
export type Contract = { id: string; ref: CRef; kind: Kind; stars: 1 | 2 | 3; giver: string; at: string; d: District; gang: Gang; mods: Mod[];
  title: string; blurb: string; pay: number; rep: number; steps: Step[];
  /** the step kinds that make up the job (no talk or plain walking) */
  core: Step['t'][];
  /** the giver's line when it is done, and their barks if it goes wrong */
  win: string; fails: string[] };
/** what the generator needs from the world: the city, the open districts and flow fields (a World has all three) */
export type GenCtx = { c: City; open: Set<District>; fieldTo(cls: 'foot' | 'walk' | 'small' | 'big' | 'boat', x: number, y: number): Field };

/** a context of its own (tests, the phone before the world exists): flow fields cached by goal */
export function makeCtx(open: District[]): GenCtx {
  const c = cityOnce(), set = new Set(open), cache = new Map<string, Field>();
  return { c, open: set, fieldTo(cls, x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T), k = `${cls}:${tx}:${ty}`; let f = cache.get(k);
    if (!f) { f = field(c, cls, tx, ty, set); cache.set(k, f); if (cache.size > 80) cache.delete(cache.keys().next().value!); }
    return f;
  } };
}

// ── the cast, the gangs and their voices
/** who gives contracts: everyone with a contact place of their own (Mr Ong rides his round, so not him) */
export const GIVERS = ['kee', 'mo', 'pang', 'heron', 'ren', 'kiri', 'lim', 'gizmo', 'bo', 'hoon', 'beng', 'teo', 'goh', 'lily', 'kamal', 'vanda', 'raju', 'malar', 'kancil', 'wangi', 'helang', 'duyung', 'lepak', 'bising', 'rosie', 'bala', 'tiara', 'faiz', 'ubin', 'ciku', 'seng', 'melati', 'suria', 'musang', 'buaya', 'kerbau'];
/** a giver whose face and body are painted (the phone card shows the face, the street the body); one still waiting for
 * art gives no contracts. A gang boss only needs the face, for a taunt */
const painted = (g: string, body = GIVERS.includes(g)) => !!FRAMES[PEOPLE[g]?.face ?? ''] && (!body || !!FRAMES[`npc-${g}-idle-0`]);
/** the two gang bosses who hire you against somebody else's gang */
const BOSS_GANG: Record<string, Gang> = { lepak: 'liz', bising: 'myna', ciku: 'bat' };
type Voice = { hi: string[]; ok: string[]; oops: string[] };
/** each giver's own way of talking: how they open, how they say thanks, what they say when it goes wrong */
export const VOICE: Record<string, Voice> = {
  kee: { hi: ['Ah, hero! Good timing, good timing.', 'You again! My favourite customers.'], ok: ['Shiok! Free longans for you, take, take.', 'Like I always say: small paws, big hearts.'], oops: ['Aiyoh. Never mind, try again lah.', 'My knees are slower than you, and even I…'] },
  mo: { hi: ['Hungry? Later. Work first.', 'Quick, before my wok cools down!'], ok: ['Perfect timing, like a good stir-fry.', 'You two are better than my sous-chef.'], oops: ['Burnt! Again from the top.', 'Too slow, too slow! Wok hei waits for nobody.'] },
  pang: { hi: ['My scales are tingling. Something is wrong.', 'Come, come, sit. No, don’t sit. Listen.'], ok: ['Lucky scales never lie. Thank you, dears.', 'I knew I could count on you. One, two, three…'], oops: ['Touch wood, touch scales, try again.', 'Hmm. The scales say: not like that.'] },
  heron: { hi: ['Peace, little ones. And then, trouble.', 'Breathe slowly. Then run quickly.'], ok: ['The bell will ring sweeter tonight.', 'Balance is restored. Mostly.'], oops: ['Patience. The second try is the wiser one.', 'Even the heron misses the first fish.'] },
  ren: { hi: ['Feet wide! Back straight! Now listen.', 'A lion dancer never sits still, and neither do you.'], ok: ['Strong legs, strong heart. Good!', 'The lion bows to you tonight.'], oops: ['Sloppy footwork! Again!', 'A lion falls, a lion gets up.'] },
  kiri: { hi: ['Ahoy! The river is talking tonight.', 'Hop aboard. Well, not literally.'], ok: ['Smooth sailing. You have river paws.', 'Tide’s with you tonight, mates.'], oops: ['Rough water. Bail out and go again.', 'Even I run aground sometimes.'] },
  lim: { hi: ['Psst. Extra, extra, I have a story.', 'Read all about it: you two, hired again.'], ok: ['Front-page stuff! Headline: chinchillas save the day.', 'That one goes in the late edition.'], oops: ['Stop the presses. That did not go well.', 'Correction tomorrow: they will try again.'] },
  gizmo: { hi: ['Yo yo yo! This one is a banger.', 'Turn it up! I got a job with a beat.'], ok: ['Mic drop! You two are the remix.', 'Crowd goes wild! Encore!'], oops: ['Record scratch! Run it back.', 'Off beat, off beat. Again from the drop.'] },
  bo: { hi: ['Heavy crates, light hearts. Got one for you.', 'Mind the forklifts and listen up.'], ok: ['Strong work. Union rates, paid in full.', 'Shipped and signed. Good hustle.'], oops: ['Dropped the load! Pick it up and go again.', 'Forklift could do better. Kidding. Again.'] },
  hoon: { hi: ['Aiyoh, you came! Got problem, big problem.', 'Chope your spot and listen, ah.'], ok: ['Wah, so fast! Chicken rice on the house.', 'Good kids. Your mama must be proud.'], oops: ['Aiyoh, how can like that? Again!', 'Don’t play play ah. Try again.'] },
  beng: { hi: ['Wah, bro, you came! Steady.', 'Eh, bro, got one job for you, very shiok one.'], ok: ['Steady lah, bro! Respect.', 'Power! Next round char kway teow on me.'], oops: ['Alamak, bro. Relax, one more time.', 'Cannot like that lah. Again, again.'] },
  teo: { hi: ['Kopi or job? Today, job.', 'Sit, sit. Kopi-O kosong later. Job first.'], ok: ['Good. Very good. Like kopi, strong.', 'Shiok. This one I remember.'], oops: ['Like teh with no sugar. Try again.', 'Cannot read minds, but I can read that. Again.'] },
  goh: { hi: ['Chess is war, and so is this.', 'Three moves ahead. Here is move one.'], ok: ['Checkmate. Well played, young ones.', 'Good move. Very good move.'], oops: ['You moved too fast. Think, then move.', 'A pawn lost is not the game lost.'] },
  lily: { hi: ['Darlings! I need a little drama.', 'Front row seats, darlings, and a favour.'], ok: ['Encore! You were fabulous.', 'Standing ovation, darlings!'], oops: ['Off-key, darlings. From the top!', 'The show must go on. Again!'] },
  kamal: { hi: ['Mind the gap, and mind this job.', 'Next stop: trouble. Please alight.'], ok: ['Right on schedule. Like the MRT, cannot be late.', 'Arrived on time. Impressive.'], oops: ['Service delayed. Please try again.', 'This train is not in service. Go again.'] },
  vanda: { hi: ['Darlings, the show is in danger!', 'I have a production problem.'], ok: ['That’s a wrap! Bravo.', 'Five stars, sold out, all thanks to you.'], oops: ['Cut! Reset positions.', 'Take two, everybody.'] },
  raju: { hi: ['Smell that? That is the smell of a job.', 'Cardamom, cumin, and a problem.'], ok: ['Wonderful! My nose says thank you too.', 'Spicy work. Very spicy.'], oops: ['Too much chilli in that plan. Again.', 'No, no, no. Slowly, then quickly.'] },
  malar: { hi: ['My dear, my dear, come here.', 'Jasmine for luck, and a job for you.'], ok: ['Marigolds for you both. Well done, my dears.', 'You make an auntie very happy.'], oops: ['Never mind, my dear. Again, slowly.', 'Even flowers wilt. Water them and try again.'] },
  kancil: { hi: ['Salam, friends. A small favour, a big problem.', 'Feel this cloth. Now feel my worry.'], ok: ['Like gold thread. Terima kasih!', 'Woven tight. Well done, friends.'], oops: ['A loose thread. Pull it and try again.', 'Aduh. Again, friends.'] },
  wangi: { hi: ['A little trouble, like a little attar.', 'Come closer. This should only whisper.'], ok: ['Exquisite. Like jasmine at dusk.', 'Perfect, darlings. Not too much.'], oops: ['Too strong, too loud. Again.', 'Overpowering. Try again, gently.'] },
  helang: { hi: ['Attention! Mission briefing!', 'Ranger Helang reporting. Listen up!'], ok: ['Mission accomplished! Salute!', 'Well executed, soldiers.'], oops: ['Regroup! Again!', 'A tactical retreat. Now advance again!'] },
  duyung: { hi: ['Fifty years on these waters. Never seen this.', 'Ahoy, little ones. Trouble at sea, and on land.'], ok: ['Steady as she goes. Good work.', 'Ice kacang on me, as always.'], oops: ['Rough seas. Back to port and try again.', 'The sea teaches patience. Again.'] },
  lepak: { hi: ['Lepak means relax. But not today.', 'Don’t tell the lizards I asked you, ah.'], ok: ['Nice. Now I can lie down again.', 'Steady. Very steady.'], oops: ['Aiyah. Relax first, then go again.', 'Even a monitor lizard trips sometimes.'] },
  bising: { hi: ['KECOH! Sorry. Shh. I have a job.', 'Mynahs only have one volume, so listen fast!'], ok: ['KECOH! I mean, thank you!', 'Loudest thanks on the island!'], oops: ['Aiyoh! Too quiet, too slow!', 'Again! LOUDER! I mean, faster!'] },
  rosie: { hi: ['Aiyoh, you came! Sit, eat first. No, work first.', 'Got problem, and got laksa. Problem first.'], ok: ['Shiok! Like my laksa: just right.', 'Good kids. Take some kueh home.'], oops: ['Aiyoh, too much santan in that plan. Again.', 'Never mind, the broth can wait. Try again.'] },
  bala: { hi: ['Eh, friends! Got one job, very shiok one.', 'Ring ring! Bala here, got problem.'], ok: ['Wah, power! Free bike for a week.', 'Steady! Like riding downhill.'], oops: ['Puncture! Pump it up and go again.', 'Fell off the bike? Get back on lah.'] },
  seng: { hi: ['Eh, you two! Come, come. Got small job.', 'Eat first? No. Job first, then eat.'], ok: ['Steady lah! Like my chwee kueh: soft inside.', 'Good, good. One plate on the house.'], oops: ['Aiyah, steamer too hot, plan too cold. Again.', 'Never mind. Even the merbok sings flat sometimes.'] },
  melati: { hi: ['Darlings! A little number for you.', 'The band is tuning up. So should you.'], ok: ['Encore! Encore! That was perfect pitch.', 'You two could headline, darling.'], oops: ['A flat note, darling. From the top.', 'The show must go on. Again.'] },
  suria: { hi: ['Oh! Hello. I have a hypothesis, and a job.', 'By my calculations, you are right on time.'], ok: ['The data agrees: excellent work.', 'Result confirmed. Thank you both!'], oops: ['An anomaly. We repeat the experiment.', 'Interesting failure. Again, with notes.'] },
  buaya: { hi: ['Eh, small ones! Uncle got job, and got ice cream.', 'Ding-ding! Come, come, before it melts.'], ok: ['Wah, shiok! Two scoops for you.', 'Steady! Like my potong: cold and solid.'], oops: ['Aiyoh, melted. Never mind, try again.', 'Slowly lah. Again.'] },
  kerbau: { hi: ['Paddles up, crew! Got a job.', 'Hear the drum? That means work.'], ok: ['Power! Like a full crew at the finish.', 'Good stroke, good timing. Rest.'], oops: ['Out of time! Again, on the drum.', 'Catch the beat. Once more.'] },
  musang: { hi: ['Young ones. The lanterns need careful paws.', 'Sit. Listen. Then go quickly.'], ok: ['Well carried. The light is steady.', 'The garden thanks you. So do I.'], oops: ['Paper tears. We paste, we try again.', 'Slowly, slowly. Once more.'] },
  tiara: { hi: ['Places, everyone! I have a job.', 'Cue lights, cue music, cue chinchillas.'], ok: ['That’s a wrap! Lights look perfect.', 'Standing room only, all thanks to you.'], oops: ['Cut! Back to first positions.', 'Technical difficulty. We go again.'] },
  faiz: { hi: ['Good evening, crew. A small irregularity.', 'Captain speaking. Please fasten your seatbelts.'], ok: ['A textbook landing. Well done.', 'Right on time. The tower thanks you.'], oops: ['We will be going around again.', 'A little turbulence. Second approach.'] },
  ubin: { hi: ['Selamat datang. Sit, the tide is slow tonight.', 'Fifty years at this jetty, and still something new.'], ok: ['Bagus. Like the old days.', 'Steady hands. Good sailors.'], oops: ['The tide turned. Wait, then go again.', 'Slowly, slowly. The boat still floats.'] },
  ciku: { hi: ['Darlings! A little favour, very exclusive.', 'Only the nicest chinchillas for this one.'], ok: ['Divine! Simply divine.', 'Mwah! You have taste.'], oops: ['How common. Again, darlings.', 'Not quite atas enough. Try again.'] },
};
/** a gang's name from the shared table (lib/jade-props.ts GANG_NAME), without the species on the end, so a rename there
 * flows through every contract */
const gangName = (g: Gang, one: string) => (GANG_NAME[g] ?? g).replace(new RegExp(` ${one}s$`), '');
export const GANG: Record<Gang, { name: string; one: string; boss: string; skin?: 'otter' | 'mac' | 'liz' | 'myna' | 'bat'; taunt: string[]; brag: string[] }> = {
  crow: { name: gangName('crow', 'crow'), one: 'crow', boss: 'pip', taunt: ['Finders keepers, fluffballs!', 'Kaypoh means we know everything. Even this!'], brag: ['Caw! Shiny is mine!', 'Kaypoh Crows Pte Ltd, at your disservice!'] },
  mac: { name: gangName('mac', 'macaque'), one: 'macaque', boss: 'kow', skin: 'mac', taunt: ['Bananas belong to everyone. Mostly me!', 'Hoo hoo! Catch me if you can!'], brag: ['The Bunch takes what the Bunch likes!', 'Bananas first, questions never!'] },
  otter: { name: gangName('otter', 'otter'), one: 'otter', boss: 'sleek', skin: 'otter', taunt: ['Borrowing only! Hehe!', 'The river is our playground!'], brag: ['Splash and dash!', 'Otters don’t steal. We just… find early.'] },
  liz: { name: gangName('liz', 'lizard'), one: 'lizard', boss: 'lepak', skin: 'liz', taunt: ['Lepak lah, it’s only a small thing.', 'Down the drain it goes!'], brag: ['Slow and steady, then fast and gone.', 'The longkang never gives back.'] },
  myna: { name: gangName('myna', 'mynah'), one: 'mynah', boss: 'bising', skin: 'myna', taunt: ['KECOH! Mine now!', 'Loud and proud and gone!'], brag: ['We sing, we swipe, we fly!', 'KECOH KECOH KECOH!'] },
  bat: { name: gangName('bat', 'bat'), one: 'bat', boss: 'ciku', skin: 'bat', taunt: ['Darling, it simply had to be mine.', 'So atas, so mine! Mwah!'], brag: ['We only take the nicest things.', 'Datin Ciku sends her regards. Ciao!'] },
};
/** the things a job is about, each with a painted sprite (lib/jade-scene.ts itemSprite) and how it is spoken of */
export const ITEMS: { id: string; name: string; fragile?: boolean; stink?: boolean; food?: boolean }[] = [
  { id: 'crate', name: 'crate of mangoes', fragile: true, food: true }, { id: 'cake', name: 'wedding cake', fragile: true, food: true },
  { id: 'pots', name: 'stack of clay pots', fragile: true }, { id: 'parcel', name: 'sack of rice', food: true }, { id: 'coins', name: 'tip jar' },
  { id: 'durian', name: 'crate of durians', stink: true, food: true }, { id: 'recipe', name: 'secret recipe' }, { id: 'bag', name: 'handbag' },
  { id: 'prawns', name: 'basket of prawns', stink: true, food: true }, { id: 'statuette', name: 'lucky statuette', fragile: true }, { id: 'mic', name: 'lucky microphone' },
  { id: 'kopi-tray', name: 'tray of kopi', fragile: true, food: true }, { id: 'fish-basket', name: 'basket of fresh fish', stink: true, food: true },
  { id: 'light-crate', name: 'crate of festival lights' }, { id: 'mooncakes', name: 'box of mooncakes', food: true }, { id: 'wok', name: 'grandmother’s wok' },
  { id: 'manifest', name: 'shipping list' },
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// ── the detective's clues (the painted clue marks: lib/jade-jobs.ts CLUE_MARK) and hiding spots (their painted props)
type Tag = 'roof' | 'food' | 'blue' | 'sweet' | 'high' | 'paper';
const ASK: Record<Tag, [string, string]> = {
  roof: ['Was the {one} out in the rain?', 'No, dry as a biscuit. It kept under a roof the whole time.'],
  food: ['What was the {one} eating?', 'Something fried. Crumbs everywhere! It was near food, for sure.'],
  blue: ['What colour was near the {one}?', 'Blue, blue, all blue. Like the sea on a postcard.'],
  sweet: ['What did the {one} smell of?', 'Sugar and pandan. Somewhere sweet.'],
  high: ['Did the {one} go up or down?', 'Up! On a ledge or a shelf, somewhere high.'],
  paper: ['How did the {one} wrap it?', 'In paper, then tucked it in with more paper.'],
};
const JUNK: [string, string][] = [
  ['Is the hawker centre open?', 'Always open, always got queue.'], ['Are you hungry?', 'Always.'], ['Did it rain this morning?', 'A little. My umbrella is new, see?'],
  ['Do you know {giver}?', 'Everybody knows {giver}.'], ['How much is a kopi here?', 'One-twenty. For you, also one-twenty.'], ['Seen any wardens?', 'Wardens, crows, mynahs, bats. Everybody is kaypoh tonight.'],
  ['Is that your bicycle?', 'Not mine. Don’t tell the warden.'], ['What time is it?', 'Late. Very late. Why you ask me?'], ['Nice night, isn’t it?', 'Nice for who? My feet are tired.'],
];
const SPOTS: { what: string; tags: Tag[] }[] = [
  { what: 'tray of curry puffs', tags: ['food'] }, { what: 'recycling bins under the five-foot way', tags: ['paper', 'roof'] },
  { what: 'blue cooler box', tags: ['blue', 'food'] }, { what: 'flower planters on the ledge', tags: ['high'] },
  { what: 'bicycles under the blue awning', tags: ['blue', 'roof'] }, { what: 'pandan leaf baskets', tags: ['sweet', 'food'] },
  { what: 'newspaper bundle on the ledge', tags: ['paper', 'high'] }, { what: 'stack of kueh steamers', tags: ['sweet', 'food', 'high'] },
  { what: 'kueh boxes on the top shelf', tags: ['sweet', 'high', 'paper'] }, { what: 'litter bin', tags: ['paper'] },
  { what: 'blue awning over the stall', tags: ['blue', 'high', 'roof'] }, { what: 'kopi tins under the counter roof', tags: ['food', 'roof'] },
];
/** three-clue cases with exactly one hiding spot that fits every clue */
const CASES: { tags: Tag[]; ans: number; dec: number[] }[] = (() => {
  const out: { tags: Tag[]; ans: number; dec: number[] }[] = [];
  SPOTS.forEach((sp, ans) => {
    if (sp.tags.length !== 3) return;
    const tags = sp.tags; const dec = SPOTS.map((x, i) => i).filter(i => i !== ans && SPOTS[i].tags.some(t => tags.includes(t)) && !tags.every(t => SPOTS[i].tags.includes(t)));
    if (dec.length >= 4) out.push({ tags, ans, dec });
  });
  return out;
})();
const FOLK = ['cat', 'goose', 'hedgehog', 'duck', 'rabbit', 'sunbear', 'dog', 'rooster'];
const FOLK_ROLE = ['by the kopi stall', 'with the umbrella', 'selling newspapers', 'on the bench', 'at the bus stop', 'with the shopping trolley', 'sweeping the five-foot way', 'feeding the pigeons'];

// ── the story's set pieces, reused: a heist (casing, then the safe) or a disguise walk has hand-placed guards,
// cameras and lookouts, so contracts borrow them from the jobs that already proved them (the bots play every one)
type Venue = { d: District; steps: Step[]; name: string };
const VENUES: { heist: Venue[]; blend: Venue[] } = (() => {
  const heist: Venue[] = [], blend: Venue[] = [], c = cityOnce();
  const dOf = (s: Spot) => typeof s === 'string' ? c.places[s]?.d ?? 'market' : districtAt(s[0], s[1]);
  for (const m of [...MISSIONS, ...SIDE]) {
    const i = m.steps.findIndex(s => s.t === 'case'), j = m.steps.findIndex(s => s.t === 'heist');
    if (i >= 0 && j > i) { const g = m.steps[i - 1]; const h = m.steps[j] as Extract<Step, { t: 'heist' }>; heist.push({ d: dOf(h.front), steps: [...(g?.t === 'goto' ? [g] : []), m.steps[i], h], name: m.title }); }
    const b = m.steps.find(s => s.t === 'blend') as Extract<Step, { t: 'blend' }> | undefined;
    if (b) blend.push({ d: dOf(b.goal), steps: [b], name: m.title });
  }
  return { heist, blend };
})();
export const venueCount = () => ({ heist: VENUES.heist.length, blend: VENUES.blend.length });

// ── small helpers
const tileOf = (x: number, y: number): [number, number] => [Math.floor(x / T), Math.floor(y / T)];
const mid = (t: [number, number]): [number, number] => [(t[0] + 0.5) * T, (t[1] + 0.5) * T];
const pick = <X>(R: () => number, a: readonly X[]): X => a[Math.floor(R() * a.length) % a.length];
const shuffle = <X>(R: () => number, a: X[]): X[] => { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const an = (s: string) => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s;
const name = (id: string) => PEOPLE[id]?.name ?? id;
const r5 = (x: number) => Math.round(x / 5) * 5;
/** foot tiles from a tile to a goal tile (-1: unreachable) */
function pathLen(ctx: GenCtx, from: [number, number], to: [number, number]): number {
  const f = ctx.fieldTo('foot', ...mid(to)); const d = f.dist[from[1] * W + from[0]]; return d >= 0 ? d / 10 : -1;
}
/** a place's name for a line: its own name, the street it is on, or the district */
export function spotName(ctx: GenCtx, s: Spot): string {
  if (typeof s === 'string') { const pl = ctx.c.places[s]; if (!pl) return 'the spot'; if (pl.kind === 'contact') return name(s); if (pl.name) return pl.name; s = tileOf(pl.x, pl.y); }
  const st = streetAt(s[0], s[1]); return st ?? DISTRICT_NAME[districtAt(s[0], s[1])];
}
const spotXY = (ctx: GenCtx, s: Spot): [number, number] => typeof s === 'string' ? [ctx.c.places[s].x, ctx.c.places[s].y] : mid(s);
const spotTile = (ctx: GenCtx, s: Spot): [number, number] => tileOf(...spotXY(ctx, s));
const okTile = (ctx: GenCtx, t: [number, number]) => t[0] > 0 && t[1] > 0 && ctx.open.has(districtAt(t[0], t[1])) && ctx.c.solid[t[1] * W + t[0]] === S.OPEN;
/** a walkable tile lo to hi tiles from (x,y), in an open district, reachable on foot from `home` within `maxPath` */
function ringTile(ctx: GenCtx, R: () => number, x: number, y: number, lo: number, hi: number, home: [number, number], maxPath = hi * 2.6, d?: District): [number, number] | null {
  for (let k = 0; k < 24; k++) {
    const a = R() * Math.PI * 2, r = (lo + R() * (hi - lo)) * T;
    const t = tileOf(...nearestFree(ctx.c, 'walk', x + Math.cos(a) * r, y + Math.sin(a) * r, ctx.open, 5));
    if (!okTile(ctx, t) || (d && districtAt(t[0], t[1]) !== d)) continue;
    const L = pathLen(ctx, t, home); if (L < 0 || L > maxPath) continue;
    return t;
  }
  return null;
}
/** the named places of the open districts a job can send you to (markets, landmarks, safe houses, other people) */
function namedPlaces(ctx: GenCtx, not: string[]): string[] {
  return Object.entries(ctx.c.places).filter(([id, p]) => ctx.open.has(p.d) && !not.includes(id) && (p.kind === 'market' || p.kind === 'safe' || (p.kind === 'spot' && !!p.name) || (p.kind === 'contact' && GIVERS.includes(id) && !BOSS_GANG[id]))).map(([id]) => id).sort();
}

// ── the generator
const STAR_K = [1, 1, 1.35, 1.75];
/** coins a step kind is worth (before stars, tier and modifiers) */
const STEP_PAY: Partial<Record<Step['t'], number>> = { pickup: 15, deliver: 40, chase: 70, tail: 60, trap: 75, swap: 70, case: 60, heist: 130, defend: 65, escort: 70, race: 65, detective: 85, blend: 85, mini: 35, collect: 45, bag: 45, heat: 35 };
type Build = { steps: Step[]; blurb: string; title: string; item?: string };
type B = { ctx: GenCtx; R: () => number; g: string; gp: [number, number]; gt: [number, number]; d: District; gang: Gang; stars: 1 | 2 | 3; mods: Mod[]; tier: number; contest?: { d: District; gang: Gang } };

export function genContract(ctx: GenCtx, ref: CRef): Contract {
  // separate streams, so a giver or kind forced from the save never shifts what follows
  const sub = (k: string) => rng(hashStr(`jade-con:${ref.seed}:${k}`));
  const Rg = sub('giver'), Rk = sub('kind'), Rm = sub('mods'), Rt = sub('text');
  const stars = ref.stars;
  for (let attempt = 0; attempt < 12; attempt++) {
    const Rb = sub('body' + attempt);
    // the giver: in an open district (the contested one for a pushback), not busy with a story job
    const pool = GIVERS.filter(g => { const pl = ctx.c.places[g]; return pl && painted(g) && ctx.open.has(pl.d) && !(ref.avoid ?? []).includes(g) && (!ref.contest || pl.d === ref.contest.d || attempt > 3); });
    const giver = ref.giver && attempt === 0 ? ref.giver : pick(attempt ? Rb : Rg, pool.length ? pool : ['kee']);
    const pl = ctx.c.places[giver]; if (!pl) continue;
    const d = ref.contest?.d ?? pl.d;
    let gang: Gang = ref.contest?.gang ?? RAID_GANG[d];
    if (BOSS_GANG[giver] === gang) gang = pick(Rb, (['crow', 'mac', 'otter', 'liz', 'myna', 'bat'] as Gang[]).filter(x => x !== gang && x !== 'liz'));
    const kinds = kindsFor(ctx, ref, d);
    const kind: Kind = ref.contest ? 'retake' : ref.kind && attempt === 0 && kinds.includes(ref.kind as Kind) ? ref.kind as Kind : pick(attempt ? Rb : Rk, kinds);
    const mods = modsFor(Rm, kind, stars, !!ref.day);
    const gt = tileOf(...nearestFree(ctx.c, 'walk', pl.x, pl.y + T * 0.6, ctx.open, 3));
    const b: B = { ctx, R: Rb, g: giver, gp: [pl.x, pl.y], gt, d, gang, stars, mods, tier: ref.tier, contest: ref.contest };
    const built = BUILD[kind](b);
    if (!built || !valid(ctx, built.steps, gt)) continue;
    const core = built.steps.map(s => s.t).filter(t => t !== 'talk' && t !== 'goto' && t !== 'ride');
    const v = VOICE[giver] ?? VOICE.kee;
    const steps: Step[] = [
      { t: 'talk', lines: opening(Rt, giver, gang, kind, built, mods) },
      ...built.steps,
      { t: 'talk', lines: [[giver, pick(Rt, v.ok), 'happy'], ...(Rt() < 0.4 ? [['mate', pick(Rt, MATE_WIN), 'happy'] as Line] : [])] },
    ];
    // the solo partner can't be told to do anything: no steps that post them
    const pay = r5((40 + built.steps.reduce((a, s) => a + (STEP_PAY[s.t] ?? 0), 0)) * STAR_K[stars] * (1 + 0.15 * ref.tier) * (1 + 0.1 * mods.length) * (ref.day ? 1.5 : 1) * (ref.contest ? 1.4 : 1));
    return { id: `con-${ref.seed}`, ref, kind, stars, giver, at: giver, d, gang, mods, title: built.title, blurb: built.blurb, pay, rep: 2 + stars, steps, core,
      win: pick(Rt, v.ok), fails: v.oops.slice() };
  }
  // a plain delivery round the giver's own block: always possible
  return fallback(ctx, ref);
}
const MATE_WIN = ['Easy peasy, kopi squeezy.', 'Another one for the book!', 'We make a good team, don’t we?', 'Can we get supper now?'];

/** which kinds of job fit: the ones whose places exist in the open districts */
function kindsFor(ctx: GenCtx, ref: CRef, d: District): Kind[] {
  const out: Kind[] = ['courier', 'recover', 'sting', 'undercover', 'stand', 'race', 'sleuth', 'crack', 'sweep'];
  if (VENUES.heist.some(v => ctx.open.has(v.d) && (v.d === d || CT_DISTRICTS.includes(v.d) === CT_DISTRICTS.includes(d)))) out.push('heist');
  if (VENUES.blend.some(v => ctx.open.has(v.d) && (v.d === d || CT_DISTRICTS.includes(v.d) === CT_DISTRICTS.includes(d)))) out.push('blend');
  if (d !== 'resort') out.push('parade');
  void ref; return out;
}
/** modifiers: a one-star job gets none or one, more stars more, each only where it changes something */
function modsFor(R: () => number, kind: Kind, stars: number, daily: boolean): Mod[] {
  const fits: Mod[] = ['night', 'rain'];
  if (['courier', 'crack', 'sweep', 'sleuth', 'undercover'].includes(kind)) fits.push('timer');
  if (kind !== 'race' && kind !== 'heist') fits.push('foot');
  if (!['heist', 'blend', 'stand', 'parade', 'retake'].includes(kind)) fits.push('solo');
  if (['courier', 'crack', 'recover'].includes(kind)) fits.push('wardens');
  const n = Math.min(2, Math.max(0, stars - 1 + (R() < 0.35 ? 1 : 0) - (daily ? 0 : 0)));
  return shuffle(R, fits).slice(0, n).sort((a, b) => MODS.indexOf(a) - MODS.indexOf(b));
}
/** every place a step names is in an open district and reachable on foot from the giver */
function valid(ctx: GenCtx, steps: Step[], home: [number, number]): boolean {
  const spots: Spot[] = [];
  for (const s of steps) {
    const st = s as Record<string, unknown>;
    for (const k of ['at', 'to', 'from', 'goal', 'bait', 'wait', 'rack', 'front', 'safe', 'near']) if (st[k] && st[k] !== 'loot') spots.push(st[k] as Spot);
    for (const k of ['route', 'marks', 'crates', 'path', 'items']) if (Array.isArray(st[k])) spots.push(...st[k] as Spot[]);
    if (s.t === 'trap') spots.push(...s.spots);
    if (s.t === 'detective') { spots.push(...s.spots.map(x => x.at), ...s.witnesses.map(x => x.at)); }
    if (s.t === 'case') spots.push(...s.spots.map(x => x.at));
    for (const g of (s as { guards?: Spot[][] }).guards ?? []) spots.push(...g);
  }
  for (const sp of spots) {
    if (typeof sp === 'string' && !ctx.c.places[sp]) return false;
    const t = spotTile(ctx, sp); if (!ctx.open.has(districtAt(t[0], t[1]))) return false;
    // a solid prop on the spot (a stall, a crate) is fine: the step's own E reach covers it; the tile next to it must walk
    const ft = tileOf(...nearestFree(ctx.c, 'walk', ...mid(t), ctx.open, 3));
    if (pathLen(ctx, ft, home) < 0) return false;
  }
  return true;
}

// ── the opening lines: the giver's hello, the problem in their voice, the gang's taunt, the partner's plan
function opening(R: () => number, g: string, gang: Gang, kind: Kind, b: Build, mods: Mod[]): Line[] {
  const v = VOICE[g] ?? VOICE.kee, G = GANG[gang];
  const lines: Line[] = [[g, pick(R, v.hi), 'worried'], [g, b.blurb, 'calm']];
  if (['recover', 'sting', 'stand', 'retake', 'undercover'].includes(kind) && R() < 0.6 && painted(G.boss)) lines.push([G.boss, pick(R, G.taunt), 'cross']);
  if (mods.includes('solo')) lines.push(['mate', 'I’m minding the stall for this one. You’re on your own, but I believe in you!', 'happy']);
  else if (mods.includes('foot')) lines.push(['mate', 'No rides on this one. Good thing we have fast paws.', 'smug']);
  else if (mods.includes('rain')) lines.push(['mate', 'Thunder coming. Mind the puddles!', 'worried']);
  else if (mods.includes('wardens')) lines.push(['mate', 'Wardens everywhere tonight. No jaywalking, no littering, no nothing!', 'worried']);
  else if (mods.includes('night')) lines.push(['mate', 'Graveyard shift. Dark streets, sleepy guards.', 'smug']);
  else lines.push(['hero', pick(R, ['On it.', 'Leave it to us.', 'Easy. Probably.', 'Consider it done.']), 'smug']);
  return lines;
}

// ── the kinds of job
const fragileOf = (it: string) => ITEM[it]?.fragile ? 6 : undefined;
/** a delivery's clock: a fair walk at a person's pace from the path, longer for fragile cargo, shorter with the timer */
function delTime(b: B, tiles: number, fragile: boolean) { return Math.round((tiles * 0.74 + 18) * (fragile ? 1.25 : 1) * (b.mods.includes('timer') ? 0.86 : 1) * [1, 1, 0.96, 0.92][b.stars]); }
function extra(b: B, at: [number, number], item: string, steps: Step[]): void {
  // a crow swoops for the cargo on the way (two stars and up): knock its bag loose, then pick it up
  if (b.stars >= 2 && b.R() < 0.45) {
    const t = ringTile(b.ctx, b.R, ...mid(at), 3, 6, b.gt, 30); if (t) { steps.push({ t: 'bag', at: t, loot: item, label: `A crow snatched the ${ITEM[item]?.name ?? item}! Knock its bag loose (a gadget, or pounce when it swoops low)`, cp: true }, { t: 'pickup', at: 'loot', item, label: `Pick up the ${ITEM[item]?.name ?? item}` }); }
  }
}
const BUILD: Record<Kind, (b: B) => Build | null> = {
  courier(b) {
    const { ctx, R } = b; const places = namedPlaces(ctx, [b.g]);
    const item = pick(R, ITEMS.filter(i => i.id !== 'manifest' && i.id !== 'coins')).id;
    const from = shuffle(R, places).find(p => { const L = pathLen(ctx, spotTile(ctx, p), b.gt); return L > 6 && L < 26; });
    if (!from) return null;
    const ft = spotTile(ctx, from);
    const to = shuffle(R, places).find(p => { if (p === from) return false; const L = pathLen(ctx, spotTile(ctx, p), ft); return L > 12 && L < (b.stars >= 3 ? 40 : 32); });
    if (!to) return null;
    const L = pathLen(ctx, spotTile(ctx, to), ft), it = ITEM[item];
    const steps: Step[] = [{ t: 'pickup', at: from, item, label: `Pick up the ${it.name} at ${spotName(ctx, from)}`, cp: true }];
    extra(b, ft, item, steps);
    steps.push({ t: 'deliver', to, item, time: delTime(b, L, !!it.fragile), fragile: fragileOf(item), stink: it.stink && b.stars >= 2 ? true : undefined, fines: b.mods.includes('wardens') ? 3 : undefined, label: `Get the ${it.name} to ${spotName(ctx, to)}${it.fragile ? ' (gently!)' : ''}` });
    const toName = spotName(ctx, to);
    return { steps, item, title: pick(R, [`The ${cap(it.name.split(' of ').pop()!)} Run`, it.fragile ? 'Handle With Care' : 'Special Delivery', `Express to ${toName.replace(/^the /, 'The ')}`]),
      blurb: pick(R, [`My ${it.name} is waiting at ${spotName(ctx, from)}, and ${toName} needs it tonight. Can you carry it over?`, `${cap(toName)} ordered ${an(it.name)}, and my legs are no good tonight. ${spotName(ctx, from)} has it ready.`]) };
  },
  recover(b) {
    const { ctx, R } = b, G = GANG[b.gang], item = pick(R, ITEMS.filter(i => !i.fragile && !i.stink)).id, it = ITEM[item];
    const steps: Step[] = [];
    let from = ringTile(ctx, R, ...b.gp, 3, 6, b.gt, 14); if (!from) return null;
    if (b.stars >= 2) {
      const tl = tailTo(b, b.gt); if (!tl) return null;
      steps.push({ t: 'tail', name: `the ${G.one}`, from: tl.from, route: tl.route, calm: 0.85, skin: G.skin, label: `Tail the ${G.one} back to the hideout (keep back, out of sight)`, cp: true });
      from = tl.end;
    }
    const loop = chaseLoop(ctx, ...mid(from)); if (loop.some(s => typeof s !== 'string' && !okTile(ctx, s))) return null;
    steps.push({ t: 'chase', who: 'runner', name: `the ${G.one}`, skin: G.skin, from, route: loop, bumps: b.stars >= 3 ? 3 : 2, loot: item, speed: 192 + 6 * b.stars + Math.min(6, b.tier), label: `The ${G.one} has the ${it.name}! Run it down and bump it${b.stars >= 3 ? ' three times' : ' twice'}`, cp: true });
    steps.push({ t: 'pickup', at: 'loot', item, label: `Pick up the ${it.name}` });
    if (b.stars >= 3) steps.push({ t: 'heat', level: 2, label: 'The wardens think you’re the thief! Lose them (out of sight, or hide)' });
    steps.push({ t: 'goto', at: b.g, label: `Bring the ${it.name} back to ${name(b.g)}` });
    return { steps, item, title: pick(R, [`${G.name} Took My ${cap(it.name.split(' ').pop()!)}`, 'Give It Back Lah', `Catch That ${cap(G.one)}`, 'Snatch and Grab']),
      blurb: pick(R, [`${cap(an(G.one))} from the ${G.name} swiped my ${it.name}, right off the counter. Get it back!`, `The ${G.name} took my ${it.name}. One of them is still hanging about nearby, looking smug.`]) };
  },
  sting(b) {
    const { ctx, R } = b, G = GANG[b.gang]; const tg = trapGang(b.gang);
    const anchors = anchorsNear(b, 4, 18); let plan = null, at: [number, number] | null = null;
    for (const a of anchors) { plan = trapPlan(ctx, ...mid(a)); if (plan && valid(ctx, [{ t: 'trap', ...plan, need: 3, gang: tg, n: 3, catch: 2, label: '' } as Step], b.gt)) { at = a; break; } plan = null; }
    if (!plan || !at) return null;
    const steps: Step[] = [{ t: 'trap', spots: plan.spots, need: 3, bait: plan.bait, wait: plan.wait, path: plan.path, gang: tg, n: 3, catch: b.stars >= 3 ? 3 : 2, label: `The ${G.name} come this way every night: lay three nets on their path (E), bait it, and spring them (F)`, cp: true }];
    if (b.stars >= 2) { const loop = chaseLoop(ctx, ...mid(plan.bait as [number, number])); steps.push({ t: 'chase', who: 'runner', name: `the ${G.one}`, skin: G.skin, from: plan.bait, route: loop, bumps: 2, loot: 'coins', speed: 190 + 6 * b.stars, label: `Their ringleader got away with the takings! Run it down`, cp: true }, { t: 'pickup', at: 'loot', item: 'coins', label: 'Pick up the takings' }); }
    else { const lt = litter(b, at, 4); if (!lt) return null; steps.push({ t: 'collect', items: lt, item: 'litter', time: 75, label: 'They dropped their loot all over: pick it up before the warden comes (E)', cp: true }); }
    steps.push({ t: 'goto', at: b.g, label: `Tell ${name(b.g)} it’s done` });
    const place = spotName(ctx, at);
    return { steps, title: pick(R, ['Net Profit', `Ambush on ${place.replace(/^the /, 'The ')}`, `Nets for the ${G.name}`]),
      blurb: pick(R, [`Every night the ${G.name} come down ${place} to cause trouble. Tonight we wait for them with nets.`, `The ${G.name} have been raiding ${place}. I want them netted, like fish.`]) };
  },
  undercover(b) {
    const { ctx, R } = b, G = GANG[b.gang];
    const tl = tailTo(b, b.gt); if (!tl) return null;
    const [sx, sy] = mid(tl.end);
    const crates = [0, 1, 2].map(q => tileOf(...nearestFree(ctx.c, 'walk', sx + Math.cos(q * 2.1 + R()) * 2.5 * T, sy + Math.sin(q * 2.1) * 2.5 * T, ctx.open, 3)));
    const g1 = tileOf(...nearestFree(ctx.c, 'walk', sx - 4 * T, sy + 3 * T, ctx.open, 3)), g2 = tileOf(...nearestFree(ctx.c, 'walk', sx + 4 * T, sy + 3 * T, ctx.open, 3));
    const steps: Step[] = [
      { t: 'tail', name: `the ${G.one}`, from: tl.from, route: tl.route, calm: 0.85, skin: G.skin, label: `Tail the ${G.one} to their store (keep back, out of sight)`, cp: true },
      { t: 'swap', crates, guards: b.stars >= 3 ? [[g1, g2], [g2, g1]] : [[g1, g2]], time: Math.round(78 * (b.mods.includes('timer') ? 0.86 : 1)), decoy: 'ticket', skin: b.gang === 'liz' || b.gang === 'myna' || b.gang === 'bat' ? b.gang : undefined, label: 'Swap their stolen goods for decoys while the guard looks away (E at each crate)', cp: true },
    ];
    if (b.stars >= 2) steps.push({ t: 'heat', level: 2, label: 'The wardens saw you at the crates! Lose them (out of sight, or hide)' });
    steps.push({ t: 'goto', at: b.g, label: `Back to ${name(b.g)}` });
    return { steps, title: pick(R, ['Follow the Runner', 'Swap Shop', 'The Switcheroo', 'Fake Goods']),
      blurb: pick(R, [`The ${G.name} sell stolen goods out of a back-lane store. Follow their runner there and swap the lot for decoys.`, `One of the ${G.name} runs stolen stock every night. Find where they keep it and switch it out.`]) };
  },
  heist(b) {
    const { ctx, R } = b;
    const vs = VENUES.heist.filter(v => ctx.open.has(v.d)).sort((x, y) => (x.d === b.d ? 0 : 1) - (y.d === b.d ? 0 : 1));
    const v = vs[0]?.d === b.d ? vs[0] : pick(R, vs); if (!v) return null;
    const item = pick(R, ['statuette', 'recipe', 'manifest', 'bag', 'coins']), it = ITEM[item];
    const h = v.steps[v.steps.length - 1] as Extract<Step, { t: 'heist' }>;
    const steps: Step[] = v.steps.map(s => s.t === 'heist' ? { ...s, loot: item, level: Math.min(3, b.stars + 1), time: Math.round(s.time * (b.stars >= 3 ? 0.92 : 1)), label: `Crack the safe for the ${it.name}` } : s.t === 'case' ? { ...s, need: b.stars >= 3 ? Math.min(s.spots.length, (s.need ?? s.spots.length) + 1) : s.need } : { ...s });
    steps.push({ t: 'goto', at: b.g, label: `Bring the ${it.name} to ${name(b.g)}` });
    const place = spotName(ctx, h.safe);
    return { steps, item, title: pick(R, [`The ${place.replace(/^the /, '')} Job`, 'Safe Hands', 'Night Shift', 'Quiet or Loud']),
      blurb: `The ${GANG[b.gang].name} locked my ${it.name} in a safe at ${place}. Case it first, then go in: quiet or loud, your choice.` };
  },
  stand(b) {
    const { ctx, R } = b, gang = defGang(b.gang), G = GANG[gang];
    const anchors = anchorsNear(b, 0, 14); const at = anchors[0]; if (!at) return null;
    const what = pick(R, ['Stall', 'Shop', 'Counter']);
    const steps: Step[] = [{ t: 'defend', at, time: 40 + 3 * b.stars, waves: b.stars >= 3 ? 3 : 2, per: b.stars >= 2 ? 2 : 1, gang, what, label: `Hold the ${what.toLowerCase()}: knock the ${G.name} back before they reach it`, cp: true }];
    if (b.stars >= 2) { const loop = chaseLoop(ctx, ...mid(at)); steps.push({ t: 'chase', who: 'runner', name: `the ${G.one}`, skin: G.skin, from: at, route: loop, bumps: 2, loot: 'coins', speed: 190 + 6 * b.stars, label: 'Their ringleader ran off with the float! Run it down', cp: true }, { t: 'pickup', at: 'loot', item: 'coins', label: 'Pick up the float' }); }
    else { const lt = litter(b, at, 4); if (!lt) return null; steps.push({ t: 'collect', items: lt, item: 'litter', time: 75, label: `They left a mess behind: tidy it before the warden sees (E)`, cp: true }); }
    steps.push({ t: 'goto', at: b.g, label: `Tell ${name(b.g)} it’s safe` });
    const place = spotName(ctx, at);
    return { steps, title: pick(R, [`Hold the ${what}`, 'Stand Your Ground', 'Not on My Watch']),
      blurb: pick(R, [`The ${G.name} said they’re coming for the ${what.toLowerCase()} on ${place} tonight. Hold it till they give up.`, `The ${G.name} want the ${what.toLowerCase()} on ${place}. Not on my watch. Well, on yours.`]) };
  },
  parade(b) {
    const { ctx, R } = b;
    const start = ringTile(ctx, R, ...b.gp, 2, 4, b.gt, 10); if (!start) return null;
    const end = ringTile(ctx, R, ...mid(start), 10, 16, b.gt, 36); if (!end) return null;
    const f = ctx.fieldTo('walk', ...mid(end)); const tiles = tilesDown(f, ...start); if (tiles.length < 8) return null;
    const route = [0.3, 0.55, 0.8, 1].map(q => tiles[Math.min(tiles.length - 1, Math.round((tiles.length - 1) * q))]);
    const steps: Step[] = [{ t: 'escort', from: start, route, crows: 4 + b.stars, label: 'Walk with the lion dance and shoo off the crows going for its red envelopes', cp: true }];
    if (b.stars >= 2) steps.push({ t: 'defend', at: end, time: 36, waves: 2, per: 1, gang: defGang(b.gang), what: 'Stage', label: `Hold the stage: the ${GANG[defGang(b.gang)].name} want to crash the show`, cp: true });
    else { const lt = litter(b, end, 4); if (!lt) return null; steps.push({ t: 'collect', items: lt, item: 'litter', time: 75, label: 'Firecracker paper everywhere: sweep it up before the warden comes (E)', cp: true }); }
    steps.push({ t: 'goto', at: b.g, label: `Back to ${name(b.g)}` });
    return { steps, title: pick(R, ['Lion on the Move', 'Parade Duty', 'Envelopes, Please']),
      blurb: pick(R, [`The lion dance goes to ${spotName(ctx, end)} tonight, and the crows want its red envelopes. Walk with it.`, `A lion dance for luck, to ${spotName(ctx, end)}. Keep the crows off the envelopes.`]) };
  },
  race(b) {
    const { ctx, R } = b; const foot = b.mods.includes('foot');
    const start = ringTile(ctx, R, ...b.gp, 2, 4, b.gt, 10); if (!start) return null;
    const cls = foot ? 'walk' : 'small';
    const end = ringTile(ctx, R, ...mid(start), 16, 26, b.gt, 70); if (!end) return null;
    const f = ctx.fieldTo(cls, ...mid(end)); const tiles = tilesDown(f, ...start); if (tiles.length < 20) return null;
    if (tiles.some(t => !ctx.open.has(districtAt(t[0], t[1])))) return null;
    const n = foot ? 4 : 5; const marks = Array.from({ length: n }, (_, i) => tiles[Math.min(tiles.length - 1, Math.round((tiles.length - 1) * (i + 1) / n))]);
    const steps: Step[] = [];
    if (!foot) steps.push({ t: 'ride', kind: 'scooter', near: start, label: 'Get on a scooter' });
    steps.push({ t: 'race', ride: foot ? 'foot' : 'scooter', rival: foot ? 'runner' : 'scooter', marks, pace: [1, 0.86, 0.92, 0.97][b.stars], label: `Beat the ${GANG[b.gang].one} to every marker`, cp: true });
    { const lt = litter(b, end, 4); if (!lt) return null; steps.push({ t: 'collect', items: lt, item: 'litter', time: Math.round((b.stars >= 2 ? 60 : 72) * (b.mods.includes('timer') ? 0.86 : 1)), label: 'Their fans dropped flyers everywhere: pick them up before the warden comes (E)', cp: true }); }
    steps.push({ t: 'goto', at: b.g, label: `Back to ${name(b.g)}` });
    return { steps, title: pick(R, [`Street Race: ${DISTRICT_NAME[b.d].replace(/^the /, 'The ')}`, `Fastest Paws in ${DISTRICT_NAME[b.d].replace(/^the /, 'the ')}`, 'Tyre Burner']),
      blurb: `${cap(an(GANG[b.gang].one))} from the ${GANG[b.gang].name} says nobody beats them to ${spotName(ctx, end)}. Prove them wrong, ${foot ? 'on foot' : 'on a scooter'}.` };
  },
  sleuth(b) {
    const { ctx, R } = b, G = GANG[b.gang]; const cs = pick(R, CASES); const item = pick(R, ['recipe', 'statuette', 'bag', 'mic', 'coins']), it = ITEM[item];
    const centre = ringTile(ctx, R, ...b.gp, 3, 8, b.gt, 20); if (!centre) return null;
    const chosen = shuffle(R, [cs.ans, ...shuffle(R, cs.dec).slice(0, 4)]);
    const spots: { at: Spot; tags: string[]; what: string }[] = []; const used: [number, number][] = [];
    for (const i of chosen) { let t: [number, number] | null = null; for (let k = 0; k < 8 && !t; k++) { const c = ringTile(ctx, R, ...mid(centre), 2, 9, b.gt, 36); if (c && used.every(u => dist(u[0], u[1], c[0], c[1]) >= 3)) t = c; } if (!t) return null; used.push(t); spots.push({ at: t, tags: SPOTS[i].tags, what: SPOTS[i].what }); }
    const folk = shuffle(R, FOLK), roles = shuffle(R, FOLK_ROLE);
    const witnesses: Witness[] = [];
    for (let k = 0; k < 3; k++) {
      let t: [number, number] | null = null;
      for (let q = 0; q < 6 && !t; q++) { const c = ringTile(ctx, R, ...mid(centre), 1, 8, b.gt, 34); if (c && used.every(u => dist(u[0], u[1], c[0], c[1]) >= 2)) t = c; }
      if (!t) return null; used.push(t);
      const tag = cs.tags[k], right = Math.floor(R() * 3), junk = shuffle(R, JUNK).slice(0, 2);
      const fill = (s: string) => s.replace(/\{one\}/g, G.one).replace(/\{giver\}/g, name(b.g));
      const ask: string[] = [], jk: string[] = []; let j = 0;
      for (let q = 0; q < 3; q++) { if (q === right) { ask.push(fill(ASK[tag][0])); jk.push(''); } else { ask.push(fill(junk[j][0])); jk.push(fill(junk[j][1])); j++; } }
      witnesses.push({ at: t, sp: folk[k], name: `${folk[k]} ${roles[k]}`, ask: ask as [string, string, string], right, clue: fill(ASK[tag][1]), tag, junk: jk as [string, string, string] });
    }
    const steps: Step[] = [{ t: 'detective', item, time: Math.round([0, 150, 140, 130][b.stars] * (b.mods.includes('timer') ? 0.86 : 1)), witnesses, spots, label: 'Ask the neighbours (E), then search where every clue points', cp: true }];
    { const loop = chaseLoop(ctx, ...mid(spotTile(ctx, spots[chosen.indexOf(cs.ans)].at))); steps.push({ t: 'chase', who: 'runner', name: `the ${G.one}`, skin: G.skin, from: spots[chosen.indexOf(cs.ans)].at, route: loop, bumps: b.stars >= 3 ? 2 : 1, loot: item, speed: 180 + 6 * b.stars, label: `The ${G.one} came back for it! Run it down`, cp: true }, { t: 'pickup', at: 'loot', item, label: `Pick up the ${it.name}` }); }
    steps.push({ t: 'goto', at: b.g, label: `Bring the ${it.name} back to ${name(b.g)}`, ride: 'foot' });
    return { steps, item, title: pick(R, [`Who Took the ${cap(it.name.split(' ').pop()!)}?`, `The Case of the Missing ${cap(it.name.split(' ').pop()!)}`, 'Kaypoh Detective']),
      blurb: `My ${it.name} is gone, and ${an(G.one)} was seen nearby. Ask around properly, ah, then look where every clue points.` };
  },
  blend(b) {
    const { ctx, R } = b; const vs = VENUES.blend.filter(v => ctx.open.has(v.d)); const v = vs.find(x => x.d === b.d) ?? pick(R, vs); if (!v) return null;
    const bl = v.steps[0] as Extract<Step, { t: 'blend' }>, item = pick(R, ['recipe', 'manifest', 'bag']), it = ITEM[item];
    const steps: Step[] = [
      { t: 'goto', at: bl.rack, label: `Go to the coat rack at ${spotName(ctx, bl.rack)}`, ride: 'foot', cp: true },
      { ...bl, label: 'Put on the disguise and walk with the crowd past the lookouts (no running in the coat!)', cp: true },
      { t: 'pickup', at: bl.goal, item, label: `Lift the ${it.name} while they’re not looking` },
      { t: 'deliver', to: b.g, item, time: delTime(b, Math.max(10, pathLen(ctx, spotTile(ctx, bl.goal), b.gt)), false), label: `Get the ${it.name} back to ${name(b.g)}` },
    ];
    return { steps, item, title: pick(R, ['In Plain Sight', 'Undercover Uncle', 'Disguise Time']),
      blurb: `The ${GANG[b.gang].name} are keeping my ${it.name} past their lookouts. Wear a coat, walk with the crowd, take it back.` };
  },
  crack(b) {
    const { ctx, R } = b; const places = namedPlaces(ctx, [b.g]);
    const at = shuffle(R, places).find(p => { const L = pathLen(ctx, spotTile(ctx, p), b.gt); return L > 8 && L < 28; }); if (!at) return null;
    const kind = b.stars >= 3 ? 'safe' : b.stars === 2 ? pick(R, ['lock', 'wires'] as const) : 'lock';
    const item = pick(R, ['coins', 'recipe', 'statuette', 'mooncakes']), it = ITEM[item];
    const L = pathLen(ctx, spotTile(ctx, at), b.gt);
    const steps: Step[] = [
      { t: 'goto', at, label: `Go to ${spotName(ctx, at)}`, ride: b.mods.includes('foot') ? 'foot' : undefined, cp: true },
      { t: 'mini', kind, level: Math.min(3, b.stars + 1), label: kind === 'safe' ? 'Crack the safe' : kind === 'wires' ? 'Hot-wire the shutter' : 'Pick the lock' },
      { t: 'deliver', to: b.g, item, time: delTime(b, Math.max(10, L), !!it.fragile), fines: b.mods.includes('wardens') ? 3 : undefined, label: `Get the ${it.name} to ${name(b.g)}` },
    ];
    extra(b, spotTile(ctx, at), item, steps); if (steps[steps.length - 1].t !== 'deliver') { const dl = steps.splice(2, 1)[0]; steps.push(dl); }
    return { steps, item, title: pick(R, [`Crack the ${kind === 'safe' ? 'Safe' : kind === 'wires' ? 'Shutter' : 'Lock'}`, 'Locksmith Night', 'Click Click Open']),
      blurb: `The ${GANG[b.gang].name} locked my ${it.name} up at ${spotName(ctx, at)}. My fingers are too old for locks. Yours aren’t.` };
  },
  sweep(b) {
    const { ctx, R } = b; const at = anchorsNear(b, 0, 12)[0] ?? b.gt;
    const lt = litter(b, at, 5 + b.stars); if (!lt) return null;
    const steps: Step[] = [{ t: 'collect', items: lt, item: 'litter', time: Math.round([0, 72, 66, 60][b.stars] * (b.mods.includes('timer') ? 0.86 : 1)), label: `The ${GANG[b.gang].name} trashed the street: pick up every bit of litter before the inspector comes (E)`, cp: true }];
    steps.push({ t: 'heat', level: 1 + (b.stars >= 3 ? 1 : 0), label: 'A warden thinks the mess was yours! Lose them (out of sight, or hide)' });
    steps.push({ t: 'goto', at: b.g, label: `Tell ${name(b.g)} the street is clean`, ride: 'foot' });
    return { steps, title: pick(R, ['Fine City Sweep', 'Grade A Street', 'Litter Patrol']),
      blurb: `The ${GANG[b.gang].name} threw a party on ${spotName(ctx, at)} and left the mess. The inspector is coming. Fine city, you know!` };
  },
  retake(b) {
    const { ctx, R } = b, G = GANG[b.gang];
    // the contested district's properties first, then any anchor
    const props = BIZ.filter(p => p.d === b.d).map(p => tileOf(...nearestFree(ctx.c, 'walk', bizPos(p)[0], bizPos(p)[1] + T, ctx.open, 3)));
    const at = shuffle(R, props).find(t => okTile(ctx, t) && pathLen(ctx, t, b.gt) >= 0) ?? anchorsNear(b, 0, 20)[0]; if (!at) return null;
    const steps: Step[] = [];
    const plan = trapPlan(ctx, ...mid(at));
    if (plan && R() < 0.5) steps.push({ t: 'trap', spots: plan.spots, need: 3, bait: plan.bait, wait: plan.wait, path: plan.path, gang: trapGang(b.gang), n: 3, catch: 2, label: `The ${G.name} are moving in: net them on their way (E, then F)`, cp: true });
    else if (b.gang !== 'liz') steps.push({ t: 'defend', at, time: 44, waves: 2, per: 2, gang: defGang(b.gang), what: 'Turf', label: `Hold the street: knock the ${G.name} back`, cp: true });
    else if (plan) steps.push({ t: 'trap', spots: plan.spots, need: 3, bait: plan.bait, wait: plan.wait, path: plan.path, gang: 'liz', n: 3, catch: 2, label: `The ${G.name} are moving in: net them on their way (E, then F)`, cp: true });
    else return null;
    steps.push({ t: 'chase', who: 'runner', name: `the ${G.one}`, skin: G.skin, from: at, route: chaseLoop(ctx, ...mid(at)), bumps: 2, loot: 'coins', speed: 196, label: `Their boss’s runner has the protection money! Run it down`, cp: true }, { t: 'pickup', at: 'loot', item: 'coins', label: 'Pick up the money' });
    steps.push({ t: 'goto', at: b.g, label: `Tell ${name(b.g)} ${DISTRICT_NAME[b.d]} is yours again` });
    return { steps, title: pick(R, [`Retake ${DISTRICT_NAME[b.d].replace(/^the /, 'the ')}`, `Turf War: ${DISTRICT_NAME[b.d].replace(/^the /, 'The ')}`, `Push Back the ${G.name}`]),
      blurb: `The ${G.name} are muscling in on ${DISTRICT_NAME[b.d]}: our tills are down every night they stay. Push them out.` };
  },
};
const defGang = (g: Gang): 'mac' | 'otter' | 'crow' | 'myna' | 'bat' => g === 'liz' ? 'crow' : g;
const trapGang = (g: Gang): 'mac' | 'otter' | 'liz' | 'crow' | 'myna' | 'bat' => g;
/** a tail from `from` to a corner 10 to 14 tiles off: the runner starts five tiles down the way */
function tailTo(b: B, from: [number, number]): { from: Spot; route: Spot[]; end: [number, number] } | null {
  const { ctx, R } = b;
  for (let k = 0; k < 10; k++) {
    const a = R() * Math.PI * 2, [sx, sy] = nearestFree(ctx.c, 'walk', (from[0] + 0.5) * T + Math.cos(a) * 12 * T, (from[1] + 0.5) * T + Math.sin(a) * 12 * T, ctx.open, 5);
    const end = tileOf(sx, sy); if (!okTile(ctx, end)) continue;
    const p = tilesDown(ctx.fieldTo('walk', sx, sy), ...from); if (p.length < 9 || p.length > 30) continue;
    if (p.some(t => !ctx.open.has(districtAt(t[0], t[1])))) continue;
    return { from: p[Math.min(5, p.length - 1)], route: [0.45, 0.75, 1].map(q => p[Math.min(p.length - 1, Math.round((p.length - 1) * q))]), end };
  }
  return null;
}
/** spots to hold or net: the giver's district's properties and markets, nearest first, lo to hi tiles from the giver */
function anchorsNear(b: B, lo: number, hi: number): [number, number][] {
  const { ctx } = b; const out: [number, number][] = [];
  for (const p of BIZ) if (ctx.open.has(p.d)) out.push(tileOf(...nearestFree(ctx.c, 'walk', bizPos(p)[0], bizPos(p)[1] + T, ctx.open, 3)));
  for (const pl of Object.values(ctx.c.places)) if (pl.kind === 'market' && ctx.open.has(pl.d)) out.push(tileOf(...nearestFree(ctx.c, 'walk', pl.x, pl.y + T, ctx.open, 3)));
  const sc = out.map(t => [t, pathLen(ctx, t, b.gt)] as const).filter(([t, L]) => L >= lo && L <= hi && okTile(ctx, t)).sort((a, z) => a[1] - z[1] || a[0][0] - z[0][0] || a[0][1] - z[0][1]);
  // a little seeded variety among the near ones
  const head = sc.slice(0, 3).map(x => x[0]); return [...shuffle(b.R, head), ...sc.slice(3).map(x => x[0])];
}
/** n bits of litter four to nine tiles round a spot, on walkable pavement */
function litter(b: B, at: [number, number], n: number): Spot[] | null {
  const { ctx } = b; const out: [number, number][] = [];
  for (let i = 0; i < n; i++) { const t = ringTile(ctx, b.R, ...mid(at), 3, 8, b.gt, 40); if (!t) return null; out.push(t); }
  return out;
}
function fallback(ctx: GenCtx, ref: CRef): Contract {
  const giver = ref.giver ?? 'kee', pl = ctx.c.places[giver] ?? ctx.c.places.kee, gt = tileOf(...nearestFree(ctx.c, 'walk', pl.x, pl.y + T, ctx.open, 3));
  const to = namedPlaces(ctx, [giver])[0] ?? 'mk-market';
  const L = Math.max(10, pathLen(ctx, spotTile(ctx, to), gt));
  return { id: `con-${ref.seed}`, ref, kind: 'courier', stars: ref.stars, giver, at: giver, d: pl.d, gang: RAID_GANG[pl.d], mods: [], title: 'Special Delivery', blurb: 'A parcel for a friend, quick quick.', pay: 60, rep: 2,
    steps: [{ t: 'talk', lines: [[giver, 'A parcel for a friend, quick quick.', 'calm']] }, { t: 'pickup', at: gt, item: 'parcel', label: 'Pick up the parcel', cp: true }, { t: 'deliver', to, item: 'parcel', time: Math.round(L * 0.74 + 18), label: `Get the parcel to ${spotName(ctx, to)}` }, { t: 'talk', lines: [[giver, 'Shiok!', 'happy']] }],
    core: ['deliver'], win: 'Shiok!', fails: ['Aiyoh, again lah.'] };
}

// ── the job the runner plays
/** how much sharper a Hard contract is than a Normal one (Normal: timers 0.9, chases 1.04, rival pace +0.03); pass 13
 * tuned these so the Hard bot's first tries land near 80 to 85% (they were 89%, against Normal's 92%) */
export const HARD_CON = { timer: 0.8, chase: 1.1, pace: 0.07, swap: 0.85, calm: 1.25, getaway: 1, getawayStars: 2 };
/** the contract as a Mission for lib/jade-mission.ts: a few numbers bend to Assist the way the empire's jobs do */
export function contractMission(c: Contract, assist: boolean, hard = false): Mission {
  // the twelfth pass: Hard sharpens a contract a little more than Normal (the gap was two first tries in 150); the
  // thirteenth adds a getaway to the middling and hard offers and sharper tails (HARD_CON)
  const H = HARD_CON, tk = hard ? H.timer : 0.9, ck = hard ? H.chase : 1.04, pk = hard ? H.pace : 0.03;
  const steps = c.steps.map(s => {
    // without assist a contract is a notch sharper than its story counterpart: you have done all this before
    if (!assist) {
      if (s.t === 'deliver' && s.time) return { ...s, time: Math.round(s.time * tk) };
      if ((s.t === 'collect' || s.t === 'detective') && s.time) return { ...s, time: Math.round(s.time * tk) };
      if (s.t === 'chase') return { ...s, speed: Math.round(s.speed * ck) };
      if (s.t === 'escort') return { ...s, crows: s.crows + 1 };
      if (s.t === 'race' && s.pace) return { ...s, pace: Math.min(1, s.pace + pk) };
      if (hard && s.t === 'swap') return { ...s, time: Math.round(s.time * H.swap) };
      if (hard && (s.t === 'tail' || s.t === 'stealth')) return { ...s, calm: (s.calm ?? 1) * H.calm };
      return s;
    }
    if (s.t === 'defend') return { ...s, per: Math.max(1, s.per - 1) };
    if (s.t === 'chase') return { ...s, speed: Math.round(s.speed * 0.93) };
    if (s.t === 'swap') return { ...s, time: Math.round(s.time * 1.2) };
    return s;
  });
  // Hard: the wardens saw the whole thing. A two- or three-star contract without a getaway gets one after its last piece of
  // work (before the walk back), so it ends with a chase you have to shake; (tighter clocks alone barely moved
  // the bots, and squeezing a delivery further walled the blend contracts, whose delivery is on foot)
  if (hard && !assist && c.stars >= H.getawayStars && !steps.some(s => s.t === 'heat')) {
    let i = steps.length; while (i > 0 && steps[i - 1].t === 'talk') i--;
    if (i > 0 && steps[i - 1].t === 'goto') i--;
    if (i > 1) steps.splice(i, 0, { t: 'heat', level: H.getaway, label: 'The wardens saw the whole thing! Lose them (out of sight, or hide)' });
  }
  return { id: c.id, ch: 0, title: c.title, giver: c.giver, at: c.at, blurb: c.blurb, reward: c.pay, rep: c.rep, steps, mods: c.mods, fails: c.fails };
}
void dist; void (null as unknown as Mood);

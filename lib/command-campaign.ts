// Burrow Command's campaign: ten missions in which Dora and Enzo's colony meets the Ringtail Guild and the Clockwork
// Hive, and every misunderstanding ends in friendship. Each mission sets up its own pieces, talks, and decides by its own
// goal (gather, hold out, rescue, escort, tidy away, race). Also the saved profile: campaign stars and settings.
import { World, SIDES, T, TICK_HZ, dist, tiles, kit, type Building, type Difficulty, type MapDef, type SideId, type Unit, MAPS } from './command-game.js';
import { Computer, type AiOpts } from './command-ai.js';

export type Who = 'dora' | 'enzo' | 'marlo' | 'queen' | 'pip' | 'scout';
export type Line = { who: Who; text: string };
export type Backdrop = 'meadow' | 'junkyard' | 'clockwood' | 'glimmer' | 'festival';
export const SPEAKERS: Record<Who, { name: string; color: string }> = {
  dora: { name: 'Dora', color: '#f2a0b4' }, enzo: { name: 'Enzo', color: '#9fb4c8' }, marlo: { name: 'Marlo', color: '#b59ae0' },
  queen: { name: 'The Queen', color: '#e6c36a' }, pip: { name: 'Pip', color: '#c9a77d' }, scout: { name: 'A scout', color: '#d8cfc0' },
};

/** What a mission keeps track of while it runs. */
export type MissionState = { said: Set<string>; marks: Record<string, number>; done: boolean };
export type Mission = {
  id: string; n: number; title: string; backdrop: Backdrop; blurb: string;
  /** The goal as the HUD shows it. */
  goal: string;
  brief: Line[]; outro: Line[];
  /** What each of the three stars asks. */
  stars: [string, string, string];
  map: MapDef;
  /** The player is always player 0, the Burrow Colony. Other players, their sides, teams and computer opponents. */
  others: { side: SideId; team: number; ai: Difficulty; opts?: AiOpts; name?: string; color?: string }[];
  setup(w: World, st: MissionState): void;
  /** Lines said during play, once each, when `when` first holds. */
  talk: { key: string; when: (w: World, st: MissionState) => boolean; line: Line }[];
  /** 'win', 'lose' (with why), or null to keep playing. */
  check(w: World, st: MissionState): { win: boolean; why: string } | null;
  /** Stars 2 and 3 (the first is for winning). */
  extra(w: World, st: MissionState): [boolean, boolean];
  /** Optional scripted waves and happenings. */
  tick?(w: World, st: MissionState): void;
  /** How the test pilot plays it: where to send the army (null: stay home), and when. */
  pilot: { aim(w: World, st: MissionState): [number, number] | null; go?(w: World, st: MissionState): boolean; glimmer?: number; diff?: Difficulty };
};

const S = (s: number) => Math.round(s * TICK_HZ);
const M = (m: number) => Math.round(m * 60 * TICK_HZ);
const at = (tx: number, ty: number): [number, number] => [tx * T + T / 2, ty * T + T / 2];
const spawn = (w: World, p: number, type: string, tx: number, ty: number) => { const [x, y] = w.freeSpotNear(tx, ty); return w.spawnUnit(p, type, x, y); };
const group = (w: World, p: number, list: [string, number][], tx: number, ty: number) => {
  const out: Unit[] = [];
  let k = 0;
  for (const [type, n] of list) for (let i = 0; i < n; i++, k++) out.push(spawn(w, p, type, tx + (k % 4), ty + Math.floor(k / 4)));
  return out;
};
const home = (w: World, p: number, tx: number, ty: number, workers: number) => {
  const side = w.players[p].side, b = w.placeBuilding(p, SIDES[side].hq, tx, ty, true);
  for (let i = 0; i < workers; i++) spawn(w, p, SIDES[side].worker, tx + (i % 3), ty + 3 + Math.floor(i / 3));
  return b;
};
const flagged = (w: World, flag: string) => [...w.flags.entries()].filter(([, f]) => f === flag).map(([id]) => id);
const alive = (w: World, id: number) => w.byId.has(id);
const heroesGone = (w: World) => flagged(w, 'hero').some((id) => !alive(w, id));
const heroName = (w: World) => { for (const id of flagged(w, 'hero')) if (!alive(w, id)) return w.flags.get(-id) ?? 'A hero'; return 'A hero'; };
/** Marks a unit as a hero the mission is lost without. */
const hero = (w: World, u: Unit) => { w.flags.set(u.id, 'hero'); w.flags.set(-u.id, u.def.name); return u; };
const hqLost = (w: World) => !w.buildings.some((b) => b.owner === 0 && b.def.hq);
const allGone = (w: World, p: number) => !w.buildings.some((b) => b.owner === p);
const minutes = (w: World) => w.tick / (60 * TICK_HZ);
const lost = (w: World) => w.players[0].stats.lost;
const say = (who: Who, text: string): Line => ({ who, text });
const once = (key: string, when: (w: World, st: MissionState) => boolean, who: Who, text: string) => ({ key, when, line: say(who, text) });
const after = (s: number) => (w: World) => w.tick >= S(s);
const near = (w: World, owner: number, x: number, y: number, r: number) => w.units.some((u) => u.owner === owner && !w.frozen.has(u.id) && dist(u.x, u.y, x, y) <= tiles(r));

/** Sends a wave of `list` from (tx, ty) to attack-move on (gx, gy). */
function wave(w: World, p: number, list: [string, number][], tx: number, ty: number, gx: number, gy: number) {
  const us = group(w, p, list, tx, ty);
  w.exec({ p, k: 'amove', ids: us.map((u) => u.id), x: gx * T, y: gy * T });
  return us;
}

const mapOf = (id: string, name: string, w: number, h: number, starts: [number, number][], features: MapDef['features'], sites: [number, number][] = []): MapDef =>
  ({ id, name, blurb: '', w, h, starts, sites, features, mirror: false });

// ---------------------------------------------------------------- the missions
export const MISSIONS: Mission[] = [
  {
    id: 'harvest', n: 1, title: 'First Harvest', backdrop: 'meadow',
    blurb: 'Spring has come to the meadow. Help the colony bring the hay in and get ready for the year.',
    goal: 'Gather 400 hay, and build a Hay Hut and a Pebble Pit.',
    brief: [
      say('dora', 'Good morning, Enzo! The meadow is golden again. Shall we get the colony busy?'),
      say('enzo', 'Hay first. Select our gatherers with a drag, then right-click a meadow to set them working.'),
      say('dora', 'And once there is hay to spare, a Hay Hut for room and a Pebble Pit for practice!'),
    ],
    outro: [say('enzo', 'The barns are full. A good start.'), say('dora', 'Hmm... Enzo, did you see those little masked faces watching from the hedge?')],
    stars: ['Finish the harvest', 'Within 5 minutes', 'Train 3 Pebble Slingers'],
    map: mapOf('m-harvest', 'Home Meadow', 40, 30, [[6, 12]], [
      ...kit(6, 12, [0.2, 1], [1, -0.2]), ...kit(6, 12, [0.1, -1], [-0.5, -1], 4),
      { t: 'pond', x: 26, y: 8, rx: 5, ry: 3 }, { t: 'wood', x: 34, y: 22, rx: 5, ry: 5 }, { t: 'wood', x: 20, y: 27, rx: 6, ry: 2 }, { t: 'rocks', x: 18, y: 4, rx: 2, ry: 1.5 },
    ]),
    others: [],
    setup(w) { home(w, 0, 6, 12, 4); hero(w, spawn(w, 0, 'dora', 10, 13)); w.players[0].hay = 100; },
    talk: [
      once('h1', after(25), 'enzo', 'Gatherers carry hay back to the Great Burrow by themselves. Click the Burrow and press Q for more of them.'),
      once('h2', (w) => w.players[0].stats.hay >= 150, 'dora', 'Lovely! Select a gatherer, press B, and pick the Hay Hut. Then click a clear spot.'),
      once('h3', (w) => w.has(w.players[0], 'hut'), 'enzo', 'Room for eight more. Now a Pebble Pit, so we can practise our slinging.'),
      once('h4', (w) => w.has(w.players[0], 'pit'), 'dora', 'The Pebble Pit is ready! Click it and press Q to train a Pebble Slinger.'),
    ],
    check(w) {
      const p = w.players[0];
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (p.stats.hay >= 400 && w.has(p, 'hut') && w.has(p, 'pit')) return { win: true, why: 'The harvest is in!' };
      return null;
    },
    extra: (w, st) => [minutes(w) <= 5, (st.marks['trained:slinger'] ?? 0) >= 3],
    pilot: { aim: () => null },
  },
  {
    id: 'footprints', n: 2, title: 'Muddy Footprints', backdrop: 'junkyard',
    blurb: 'Hay keeps going missing from the far barns, and there are little muddy pawprints everywhere.',
    goal: 'Follow the pawprints and tidy away the raccoons’ Stash Den. Keep Dora and Enzo safe.',
    brief: [
      say('enzo', 'Three bales gone from the far barn, and pawprints with five little fingers.'),
      say('dora', 'Let’s follow them. Gently! Whoever it is might just be hungry.'),
      say('enzo', 'Right-click to walk, A then click to attack-move. Dora’s Rally Song (F) mends everyone near her.'),
    ],
    outro: [
      say('pip', 'Aaah! Don’t poof me! We only took the hay because our Big Bin ran empty this winter...'),
      say('dora', 'Oh! You could have just asked, little one. What’s your name?'),
      say('pip', 'Pip. I’ll tell Marlo you’re not grumpy at all. Mostly.'),
    ],
    stars: ['Tidy away the Stash Den', 'Within 8 minutes', 'Lose no more than 4 friends'],
    map: mapOf('m-footprints', 'Hedgerow Lane', 56, 40, [[5, 16], [46, 15]], [
      ...kit(5, 16, [-0.2, 1], [0, -1]),
      { t: 'wood', x: 22, y: 6, rx: 6, ry: 5 }, { t: 'wood', x: 24, y: 34, rx: 7, ry: 5 }, { t: 'pond', x: 30, y: 20, rx: 3, ry: 4 },
      { t: 'rocks', x: 38, y: 10, rx: 2, ry: 3 }, { t: 'wood', x: 52, y: 34, rx: 4, ry: 4 },
    ]),
    others: [{ side: 'guild', team: 1, ai: 'easy', opts: { passive: true, noExpand: true, armyCap: 14 }, name: 'Raccoons' }],
    setup(w) {
      home(w, 0, 5, 16, 6); w.players[0].hay = 200;
      hero(w, spawn(w, 0, 'dora', 10, 18)); hero(w, spawn(w, 0, 'enzo', 10, 20));
      group(w, 0, [['slinger', 4], ['fluffguard', 1]], 11, 15);
      w.placeBuilding(0, 'pit', 10, 22, true); w.placeBuilding(0, 'hut', 10, 11, true);
      home(w, 1, 50, 16, 4); w.players[1].hay = 300;
      const den = w.placeBuilding(1, 'stash', 46, 20, true); w.flags.set(den.id, 'goal');
      w.placeBuilding(1, 'lantern', 42, 16, true); w.placeBuilding(1, 'lantern', 44, 23, true); w.placeBuilding(1, 'yard', 46, 11, true);
      group(w, 1, [['scrapper', 4], ['tosser', 3]], 40, 18); group(w, 1, [['scrapper', 3], ['tosser', 2], ['trapper', 1]], 36, 10);
      group(w, 1, [['scrapper', 3], ['tosser', 2]], 34, 28);
    },
    talk: [
      once('f1', (w) => w.units.some((u) => u.owner === 1 && w.seen(0, u.x, u.y)), 'scout', 'Masked faces! They’re raccoons... and they look ready to bop.'),
      once('f2', (w) => w.buildings.some((b) => b.owner === 1 && b.def.tower && w.seenBuilding(0, b)), 'enzo', 'A Lantern Post. It throws lids. Let the Fluffguard go first.'),
    ],
    check(w) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (!flagged(w, 'goal').some((id) => alive(w, id))) return { win: true, why: 'The Stash Den is tidied away.' };
      if (hqLost(w)) return { win: false, why: 'The Great Burrow was tidied away.' };
      return null;
    },
    extra: (w) => [minutes(w) <= 8, lost(w) <= 4],
    pilot: { aim: (w) => goalAt(w), go: (w) => armyWorth(w) >= 1600 },
  },
  {
    id: 'hollow', n: 3, title: 'Hold the Hollow', backdrop: 'meadow',
    blurb: 'Word has spread that the colony has hay to spare, and lots of raccoons are on their way. Not all of them got Pip’s message.',
    goal: 'Hold out for 6 minutes until Marlo arrives. Keep the Great Burrow standing.',
    brief: [
      say('pip', 'I told Marlo! But the Scrapper gangs came over the hills before he heard...'),
      say('enzo', 'Then we hold the hollow. Watch Stumps on the paths, slingers behind the Fluffguards.'),
      say('dora', 'And a Dust Bath to mend everyone between waves. We can do this!'),
    ],
    outro: [
      say('marlo', 'ENOUGH, my scrappy darlings! Back to the Bin, all of you. Goodness, what a fuss.'),
      say('marlo', 'Marlo, leader of the Ringtail Guild, at your service. I believe we owe you some hay. And an apology.'),
      say('dora', 'Apology accepted. And you can borrow hay whenever the Bin runs empty. Just knock!'),
    ],
    stars: ['Hold out 6 minutes', 'Keep the Great Burrow above half', 'Lose no more than 10 friends'],
    map: mapOf('m-hollow', 'The Hollow', 48, 40, [[21, 18]], [
      ...kit(21, 18, [-1, 0.1], [0, 1]), ...kit(21, 18, [0.1, -1], [-1, -0.5], 4),
      { t: 'rocks', x: 34, y: 8, rx: 4, ry: 3 }, { t: 'rocks', x: 36, y: 32, rx: 4, ry: 3 }, { t: 'wood', x: 8, y: 34, rx: 5, ry: 4 },
      { t: 'wood', x: 6, y: 5, rx: 4, ry: 3 }, { t: 'pond', x: 30, y: 21, rx: 1.5, ry: 2 },
    ]),
    others: [{ side: 'guild', team: 1, ai: 'easy', opts: { passive: true, noBuild: true }, name: 'Scrapper gangs' }],
    setup(w) {
      home(w, 0, 21, 18, 8); w.players[0].hay = 450; w.players[0].glimmer = 100;
      w.placeBuilding(0, 'hut', 17, 22, true); w.placeBuilding(0, 'pit', 26, 22, true);
      hero(w, spawn(w, 0, 'dora', 24, 22)); hero(w, spawn(w, 0, 'enzo', 25, 17));
      group(w, 0, [['slinger', 4], ['fluffguard', 2]], 26, 15);
      // the gangs' camp, off the map's edge, so they have somewhere to be from
      w.placeBuilding(1, 'stash', 45, 1, true);
    },
    tick(w, st) {
      const n = Math.floor(w.tick / S(55));
      if (w.tick > 0 && w.tick % S(55) === 0 && n <= 6) {
        const big = n + 1;
        wave(w, 1, [['scrapper', 2 + big], ['tosser', 1 + Math.floor(big / 2)], ...(n >= 3 ? [['trapper', 1] as [string, number]] : []), ...(n >= 4 ? [['cart', 1] as [string, number]] : [])], n % 2 ? 46 : 44, n % 2 ? 36 : 3, 22, 19);
        st.marks.waves = n;
      }
    },
    talk: [
      once('w1', after(50), 'pip', 'Here they come! Over the eastern hills!'),
      once('w2', after(3 * 60), 'enzo', 'Halfway there. Mend up in the Dust Bath if you have one.'),
      once('w3', after(5 * 60), 'dora', 'One more minute! I can hear someone shouting over the hill...'),
    ],
    check(w) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (hqLost(w)) return { win: false, why: 'The Great Burrow was tidied away.' };
      if (w.tick >= M(6)) return { win: true, why: 'Marlo has arrived!' };
      return null;
    },
    extra(w) { const b = w.buildings.find((x) => x.owner === 0 && x.def.hq); return [!!b && b.hp * 2 >= b.maxHp, lost(w) <= 10]; },
    pilot: { aim: () => null },
  },
  {
    id: 'kits', n: 4, title: 'Lost Kits', backdrop: 'clockwood',
    blurb: 'Three kits wandered off to look at the new raccoon kites and haven’t come home. And something in the woods is ticking.',
    goal: 'Find the three lost kits and bring them home to the Great Burrow. Keep Enzo and the kits safe.',
    brief: [
      say('dora', 'Bramble, Tuft and little Sorrel. They were last seen heading east, past the old oak.'),
      say('enzo', 'I’ll go. Lost kits join us when one of our own walks near them.'),
      say('marlo', 'My Kite Riders say there are odd clicking beetles in those woods. Be careful, friend.'),
    ],
    outro: [
      say('enzo', 'All three, home and dusty. Not a whisker out of place.'),
      say('dora', 'Those beetles weren’t chasing them, you know. They were walking in little circles... as if they were lost too.'),
    ],
    stars: ['Bring all three kits home', 'Within 7 minutes', 'No kit gets bumped'],
    map: mapOf('m-kits', 'Ticking Woods', 60, 44, [[5, 20]], [
      ...kit(5, 20, [-0.2, 1], [0, -1]),
      { t: 'wood', x: 22, y: 12, rx: 5, ry: 6 }, { t: 'wood', x: 24, y: 34, rx: 6, ry: 5 }, { t: 'wood', x: 40, y: 22, rx: 4, ry: 7 },
      { t: 'wood', x: 54, y: 8, rx: 4, ry: 4 }, { t: 'pond', x: 46, y: 38, rx: 5, ry: 2.5 }, { t: 'rocks', x: 34, y: 6, rx: 2, ry: 2 },
      { t: 'clear', x: 30, y: 6, rx: 2, ry: 2 }, { t: 'clear', x: 51, y: 31, rx: 2, ry: 2 }, { t: 'clear', x: 49, y: 15, rx: 2, ry: 2 },
    ]),
    others: [{ side: 'hive', team: 1, ai: 'easy', opts: { passive: true, noBuild: true }, name: 'Lost beetles' }],
    setup(w) {
      home(w, 0, 5, 20, 5); w.players[0].hay = 250;
      w.placeBuilding(0, 'pit', 10, 25, true);
      hero(w, spawn(w, 0, 'enzo', 10, 21));
      group(w, 0, [['slinger', 3], ['fluffguard', 1]], 11, 18);
      for (const [x, y] of [[30, 6], [51, 31], [49, 15]] as [number, number][]) { const k = spawn(w, 0, 'gatherer', x, y); w.flags.set(k.id, 'kit'); w.frozen.add(k.id); }
      // beetles wandering in circles, and a spring tower that keeps them going
      w.placeBuilding(1, 'spring', 36, 30, true); w.placeBuilding(1, 'spring', 44, 10, true);
      for (const [x, y, a, b] of [[30, 26, 36, 18], [44, 14, 50, 22], [36, 36, 44, 30], [30, 12, 38, 8]] as [number, number, number, number][]) {
        const g = group(w, 1, [['clicker', 2], ['squirt', 1]], x, y);
        w.exec({ p: 1, k: 'patrol', ids: g.map((u) => u.id), x: a * T, y: b * T });
      }
    },
    tick(w) {
      for (const id of flagged(w, 'kit')) {
        if (!w.frozen.has(id)) continue;
        const k = w.unit(id); if (!k) continue;
        if (w.units.some((u) => u.owner === 0 && !w.frozen.has(u.id) && dist(u.x, u.y, k.x, k.y) < tiles(3))) {
          w.frozen.delete(id);
          w.events.push({ k: 'say', who: 'pip', text: 'A kit is found! Bring it home to the Great Burrow.' });
        }
      }
    },
    talk: [once('k1', (w) => w.units.some((u) => u.owner === 1 && w.seen(0, u.x, u.y)), 'enzo', 'Beetles... wind-up ones. They slow right down away from those Spring Towers.')],
    check(w) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      const kits = flagged(w, 'kit');
      if (kits.some((id) => !alive(w, id))) return { win: false, why: 'A kit was poofed home dizzy (it’s fine, just embarrassed).' };
      const hq = w.buildings.find((b) => b.owner === 0 && b.def.hq);
      if (!hq) return { win: false, why: 'The Great Burrow was tidied away.' };
      if (kits.every((id) => { const k = w.unit(id)!; return !w.frozen.has(id) && dist(k.x, k.y, hq.x, hq.y) < tiles(6); })) return { win: true, why: 'All three kits are home!' };
      return null;
    },
    extra: (w) => [minutes(w) <= 7, flagged(w, 'kit').every((id) => { const k = w.unit(id); return !!k && k.hp === k.maxHp; })],
    pilot: { aim: (w) => { const k = flagged(w, 'kit').map((id) => w.unit(id)).find((u) => u && w.frozen.has(u.id)); return k ? [k.x, k.y] : null; } },
  },
  {
    id: 'ticking', n: 5, title: 'The Ticking Woods', backdrop: 'clockwood',
    blurb: 'The beetles have built Spring Towers right by the colony’s meadows and are whirring about grumpily, nibbling the hay.',
    goal: 'Tidy away the three Spring Towers by the meadows. Keep Dora and Enzo safe.',
    brief: [
      say('enzo', 'Three Spring Towers, right on our meadows. The beetles get grumpy if anyone comes near.'),
      say('dora', 'Away from their springs they slow down. If we tidy the towers away, they’ll have to go home to wind up.'),
      say('marlo', 'A word of advice from a fellow tinkerer: those Spark Coils sting. Diggers from a Digger’s Den reach further.'),
    ],
    outro: [
      say('dora', 'They’re trundling home. Slowly. Very slowly.'),
      say('enzo', 'Something has them worried. Beetles don’t usually come this far from the Clockwood.'),
    ],
    stars: ['Tidy away all three Spring Towers', 'Within 15 minutes', 'Lose no more than 12 friends'],
    map: mapOf('m-ticking', 'Meadow’s Edge', 60, 50, [[6, 22], [48, 22]], [
      ...kit(6, 22, [-0.2, 1], [0, -1]),
      { t: 'wood', x: 28, y: 4, rx: 7, ry: 3 }, { t: 'wood', x: 28, y: 46, rx: 7, ry: 3 }, { t: 'pond', x: 24, y: 25, rx: 2.5, ry: 4 },
      { t: 'hay', x: 34, y: 12 }, { t: 'hay', x: 36, y: 14 }, { t: 'hay', x: 34, y: 36 }, { t: 'hay', x: 36, y: 34 }, { t: 'glimmer', x: 30, y: 24 },
      ...kit(48, 22, [1, 0], [0, 1], 5),
      { t: 'wood', x: 56, y: 6, rx: 4, ry: 4 }, { t: 'rocks', x: 44, y: 40, rx: 3, ry: 2 },
    ]),
    others: [{ side: 'hive', team: 1, ai: 'normal', opts: { noExpand: true, armyCap: 18, delay: M(3) }, name: 'Grumpy Hive' }],
    setup(w) {
      home(w, 0, 6, 22, 7); w.players[0].hay = 400; w.players[0].glimmer = 150;
      w.placeBuilding(0, 'hut', 3, 17, true); w.placeBuilding(0, 'pit', 11, 26, true); w.placeBuilding(0, 'library', 11, 18, true);
      hero(w, spawn(w, 0, 'dora', 12, 23)); hero(w, spawn(w, 0, 'enzo', 13, 22));
      group(w, 0, [['slinger', 4], ['fluffguard', 2]], 14, 20);
      home(w, 1, 48, 22, 7); w.players[1].hay = 400;
      w.placeBuilding(1, 'brood', 44, 27, true); w.placeBuilding(1, 'cell', 52, 18, true); w.placeBuilding(1, 'cell', 52, 28, true);
      for (const [x, y] of [[30, 13], [30, 35], [37, 24]] as [number, number][]) { const s = w.placeBuilding(1, 'spring', x, y, true); w.flags.set(s.id, 'goal'); }
      w.placeBuilding(1, 'coil', 33, 20, true);
      group(w, 1, [['clicker', 3], ['squirt', 2]], 34, 26); group(w, 1, [['clicker', 2], ['squirt', 2]], 32, 15);
    },
    talk: [
      once('t1', (w) => flagged(w, 'goal').filter((id) => alive(w, id)).length === 2, 'dora', 'One tower down! Look, the beetles nearby are already slowing.'),
      once('t2', (w) => flagged(w, 'goal').filter((id) => alive(w, id)).length === 1, 'enzo', 'Just one left.'),
    ],
    check(w) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (hqLost(w)) return { win: false, why: 'The Great Burrow was tidied away.' };
      if (!flagged(w, 'goal').some((id) => alive(w, id))) return { win: true, why: 'All three Spring Towers are tidied away.' };
      return null;
    },
    extra: (w) => [minutes(w) <= 15, lost(w) <= 12],
    pilot: { aim: (w) => goalAt(w), go: (w) => armyWorth(w) >= 1500 },
  },
  {
    id: 'bargain', n: 6, title: 'Marlo’s Bargain', backdrop: 'junkyard',
    blurb: 'Marlo has an idea: a raccoon who speaks a little Clockwork. But the road to the eastern burrow runs right past the beetles.',
    goal: 'Escort Marlo to the eastern Tunnel Mound. Keep Marlo, Dora and Enzo safe.',
    brief: [
      say('marlo', 'I once fixed a beetle’s key with a bent fork. We chatted. Clicked, rather. I can talk to them!'),
      say('enzo', 'Then we get you to the eastern burrow, and from there to the Clockwood.'),
      say('dora', 'Marlo’s Shiny Toss (F) dazzles anyone grumpy for a moment. Handy in an ambush!'),
    ],
    outro: [
      say('marlo', 'Click, whirr, click-click... Oh dear. Oh dear oh dear.'),
      say('marlo', 'They say their Queen has stopped ticking. The whole Hive has been gathering glimmer to wind her, and nobody can get near her.'),
      say('dora', 'So that’s why they were so far from home! They were never grumpy. They were worried.'),
    ],
    stars: ['Get Marlo to the eastern burrow', 'Within 6 minutes', 'Marlo above half health'],
    map: mapOf('m-bargain', 'The Long Road', 72, 30, [[2, 12], [66, 12]], [
      { t: 'wood', x: 20, y: 3, rx: 9, ry: 3 }, { t: 'wood', x: 20, y: 27, rx: 9, ry: 3 }, { t: 'wood', x: 44, y: 4, rx: 7, ry: 4 }, { t: 'wood', x: 46, y: 27, rx: 8, ry: 3 },
      { t: 'pond', x: 32, y: 15, rx: 3, ry: 3 }, { t: 'rocks', x: 56, y: 9, rx: 2, ry: 2 }, { t: 'rocks', x: 56, y: 21, rx: 2, ry: 2 },
      { t: 'path', x: 36, y: 22, rx: 30, ry: 1.2 },
    ]),
    others: [{ side: 'hive', team: 1, ai: 'easy', opts: { passive: true, noBuild: true }, name: 'Worried beetles' }],
    setup(w, st) {
      const m = w.placeBuilding(0, 'mound', 68, 13, true); st.marks.mound = m.id;
      const marlo = hero(w, spawn(w, 0, 'marlo', 4, 15)); st.marks.marlo = marlo.id;
      hero(w, spawn(w, 0, 'dora', 4, 13)); hero(w, spawn(w, 0, 'enzo', 5, 14));
      group(w, 0, [['slinger', 5], ['fluffguard', 2], ['tosser', 2]], 6, 12);
      w.placeBuilding(1, 'spring', 26, 13, true); w.placeBuilding(1, 'spring', 50, 15, true); w.placeBuilding(1, 'coil', 52, 12, true);
      w.placeBuilding(1, 'coil', 28, 18, true); w.placeBuilding(1, 'coil', 41, 9, true); w.placeBuilding(1, 'spring', 40, 18, true);
      group(w, 1, [['clicker', 4], ['squirt', 3]], 24, 16); group(w, 1, [['shellback', 2], ['squirt', 3], ['clicker', 2]], 40, 12);
      group(w, 1, [['clicker', 4], ['squirt', 3], ['shellback', 1]], 52, 17); group(w, 1, [['squirt', 3], ['buzzer', 2]], 56, 22);
    },
    tick(w, st) {
      // an ambush from the woods once Marlo passes the pond
      const m = w.unit(st.marks.marlo);
      if (m && !st.marks.ambush && m.x > 34 * T) { st.marks.ambush = 1; wave(w, 1, [['clicker', 5], ['squirt', 3], ['buzzer', 2]], 44, 2, 38, 14); w.events.push({ k: 'say', who: 'enzo', text: 'From the trees! Fluffguards to the front!' }); }
    },
    talk: [once('b1', (w) => w.units.some((u) => u.owner === 1 && w.seen(0, u.x, u.y)), 'marlo', 'Beetles ahead. Mind their springs: they’re strongest close to them.')],
    check(w, st) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      const m = w.unit(st.marks.marlo), b = w.building(st.marks.mound);
      if (!b) return { win: false, why: 'The eastern Tunnel Mound was tidied away.' };
      if (m && w.gap(m, b) < tiles(1.5)) return { win: true, why: 'Marlo made it to the eastern burrow.' };
      return null;
    },
    extra(w, st) { const m = w.unit(st.marks.marlo); return [minutes(w) <= 6, !!m && m.hp * 2 >= m.maxHp]; },
    pilot: { aim: (w, st) => { const b = w.building(st.marks.mound); return b ? [b.x - T * 2, b.y] : null; } },
  },
  {
    id: 'winddown', n: 7, title: 'Wind-Down', backdrop: 'clockwood',
    blurb: 'A band of over-anxious beetles won’t let anyone near the Clockwood at all. The Guild has come to help.',
    goal: 'With the Guild beside you, tidy away the anxious beetles’ Hive Core.',
    brief: [
      say('marlo', 'My Tinkerers are setting up the Big Bin to the south. We’ll be right beside you.'),
      say('enzo', 'Their springs keep them going. Tidy the Spring Towers first and they’ll run down.'),
      say('dora', 'Then we can reach the Hive Core, and they can finally rest. Nicely, everyone!'),
    ],
    outro: [
      say('marlo', 'Click, whirr... They say thank you. Running about worrying had them all wound up.'),
      say('enzo', 'The path into the Clockwood is open. The Queen is somewhere in there.'),
    ],
    stars: ['Tidy away the Hive Core', 'Within 18 minutes', 'Lose no more than 25 friends'],
    map: { ...MAPS[3], id: 'm-winddown', name: 'Pebble Ridge' },
    others: [
      { side: 'guild', team: 0, ai: 'normal', opts: { noExpand: true }, name: 'Marlo’s Guild' },
      { side: 'hive', team: 1, ai: 'normal', opts: { delay: M(2) }, name: 'Anxious beetles' },
    ],
    setup(w, st) {
      const [a, b] = [w.starts[0], w.starts[1]];
      home(w, 0, a[0], a[1], 6); w.players[0].hay = 300;
      hero(w, spawn(w, 0, 'dora', a[0] + 4, a[1] + 4)); hero(w, spawn(w, 0, 'enzo', a[0] + 5, a[1] + 3));
      const s = w.sites[1]; home(w, 1, s[0], s[1], 6); w.players[1].hay = 300;
      const core = home(w, 2, b[0], b[1], 8); w.players[2].hay = 500; st.marks.core = core.id;
      w.placeBuilding(2, 'brood', b[0] - 5, b[1] - 1, true); w.placeBuilding(2, 'spring', b[0] - 6, b[1] - 7, true); w.placeBuilding(2, 'cell', b[0] + 1, b[1] - 4, true);
    },
    talk: [once('d1', after(5 * 60), 'marlo', 'The Guild is ready when you are! Our Junk Carts are rolling.')],
    check(w, st) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (hqLost(w)) return { win: false, why: 'The Great Burrow was tidied away.' };
      if (!alive(w, st.marks.core)) return { win: true, why: 'The Hive Core is tidied away. The beetles can rest.' };
      return null;
    },
    extra: (w) => [minutes(w) <= 18, lost(w) <= 25],
    pilot: { aim: (w, st) => { const b = w.building(st.marks.core); return b ? [b.x, b.y] : null; }, go: (w) => armyWorth(w) >= 2200, diff: 'hard' },
  },
  {
    id: 'rush', n: 8, title: 'Glimmer Rush', backdrop: 'glimmer',
    blurb: 'The Queen needs glimmer to wind her key. The Hive is gathering as fast as it can, but it has to be the purest glimmer from the valley.',
    goal: 'Gather 1200 glimmer before the Hive gathers 1200. (Being first wins the honour of bringing it.)',
    brief: [
      say('dora', 'A friendly race! Whoever brings 1200 glimmer first gets to carry it to the Queen.'),
      say('enzo', 'The beetles are fast gatherers. Get more gatherers working, and claim the valley deposits.'),
      say('marlo', 'Ahem: the beetles can be... competitive. Do guard your gatherers.'),
    ],
    outro: [
      say('dora', 'We did it! Though the beetles were very close.'),
      say('marlo', 'They insist on carrying half of it. They say it’s only polite.'),
    ],
    stars: ['Gather 1200 glimmer first', 'Within 9 minutes', 'Lose no buildings'],
    map: mapOf('m-rush', 'Glimmer Valley', 64, 46, [[5, 20], [56, 20]], [
      ...kit(5, 20, [-1, 0], [0.4, 1], 5), ...kit(56, 20, [1, 0], [-0.4, -1], 5),
      { t: 'glimmer', x: 30, y: 10 }, { t: 'glimmer', x: 32, y: 34 }, { t: 'glimmer', x: 22, y: 22 }, { t: 'glimmer', x: 40, y: 22 },
      { t: 'glimmer', x: 31, y: 22 },
      { t: 'rocks', x: 31, y: 4, rx: 6, ry: 2 }, { t: 'rocks', x: 31, y: 42, rx: 6, ry: 2 }, { t: 'rocks', x: 16, y: 34, rx: 3, ry: 3 }, { t: 'rocks', x: 47, y: 10, rx: 3, ry: 3 },
    ]),
    others: [{ side: 'hive', team: 1, ai: 'normal', opts: { noExpand: true, delay: M(3), armyCap: 14, glimmer: 12 }, name: 'Hive gatherers' }],
    setup(w) {
      home(w, 0, 5, 20, 8); home(w, 1, 56, 20, 8);
      w.players[0].hay = 300; w.players[1].hay = 300;
      w.placeBuilding(0, 'pit', 10, 25, true); w.placeBuilding(1, 'brood', 51, 15, true);
      hero(w, spawn(w, 0, 'dora', 11, 20)); hero(w, spawn(w, 0, 'enzo', 11, 22));
    },
    talk: [
      once('r1', (w) => w.players[1].stats.glimmer >= 600, 'marlo', 'The beetles are halfway there!'),
      once('r2', (w) => w.players[0].stats.glimmer >= 600, 'enzo', 'Halfway! Keep them coming.'),
    ],
    check(w, st) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (hqLost(w)) return { win: false, why: 'The Great Burrow was tidied away.' };
      if (w.players[0].stats.glimmer >= 1200) return { win: true, why: '1200 glimmer, first!' };
      if (w.players[1].stats.glimmer >= 1200) return { win: false, why: 'The Hive got to 1200 glimmer first. Good race, though!' };
      return null;
    },
    extra: (w) => [minutes(w) <= 9, !lostBuilding(w)],
    pilot: { aim: () => null, glimmer: 14 },
  },
  {
    id: 'garden', n: 9, title: 'The Queen’s Garden', backdrop: 'clockwood',
    blurb: 'Deep in the Clockwood the Queen Beetle sits still, her key jammed. Her worried guards won’t let anyone pass, not even with glimmer.',
    goal: 'Bring Dora and Enzo to the Queen in her garden. Try not to poof too many worried guards.',
    brief: [
      say('marlo', 'The guards are too worried to listen. But the Queen will. Get Dora and Enzo to her.'),
      say('enzo', 'We’ll go quietly along the stream. Let the guards be, if we can.'),
      say('dora', 'Tunnel Mound’s ready behind us if we need to fall back. Let’s go and say hello.'),
    ],
    outro: [
      say('queen', '...tick. Tick, tick. Oh! Oh, my dears. Someone has wiped the dust from my key.'),
      say('queen', 'My children were so frightened. They thought everyone was coming to take the glimmer away.'),
      say('dora', 'Nobody wanted to take anything. We only wanted to help. All of us. Even the raccoons.'),
      say('queen', 'Then there will be a festival. The first one with all three of us. Tick-tick!'),
    ],
    stars: ['Reach the Queen', 'Within 8 minutes', 'Poof fewer than 10 guards'],
    map: mapOf('m-garden', 'The Clockwood', 56, 56, [[3, 47], [44, 4]], [
      { t: 'wood', x: 14, y: 14, rx: 10, ry: 9 }, { t: 'wood', x: 40, y: 40, rx: 10, ry: 9 }, { t: 'wood', x: 28, y: 30, rx: 4, ry: 4 },
      { t: 'pond', x: 20, y: 34, rx: 2, ry: 6 }, { t: 'pond', x: 36, y: 20, rx: 6, ry: 2 }, { t: 'rocks', x: 50, y: 22, rx: 2, ry: 4 },
      { t: 'clear', x: 46, y: 7, rx: 5, ry: 4 }, { t: 'path', x: 30, y: 27, rx: 20, ry: 1 },
    ]),
    others: [{ side: 'hive', team: 1, ai: 'easy', opts: { passive: true, noBuild: true }, name: 'Worried guards' }],
    setup(w, st) {
      hero(w, spawn(w, 0, 'dora', 4, 48)); hero(w, spawn(w, 0, 'enzo', 5, 49));
      group(w, 0, [['slinger', 5], ['fluffguard', 3], ['puffer', 2]], 6, 46);
      w.placeBuilding(0, 'mound', 2, 51, true); w.placeBuilding(0, 'bath', 6, 51, true);
      const q = w.spawnUnit(1, 'queen', 47 * T, 7 * T); w.frozen.add(q.id); st.marks.queen = q.id;
      w.placeBuilding(1, 'spring', 43, 10, true); w.placeBuilding(1, 'spring', 26, 24, true); w.placeBuilding(1, 'coil', 30, 22, true); w.placeBuilding(1, 'coil', 40, 14, true);
      for (const [x, y, a, b] of [[18, 44, 26, 38], [26, 26, 34, 30], [44, 16, 50, 26], [36, 6, 30, 12], [10, 30, 16, 26]] as [number, number, number, number][]) {
        const g = group(w, 1, [['clicker', 2], ['squirt', 2], ['shellback', 1]], x, y);
        w.exec({ p: 1, k: 'patrol', ids: g.map((u) => u.id), x: a * T, y: b * T });
      }
    },
    talk: [once('g1', (w, st) => { const q = w.unit(st.marks.queen); return !!q && w.seen(0, q.x, q.y); }, 'dora', 'There she is! Under the brass arch. Quickly now!')],
    check(w, st) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      const q = w.unit(st.marks.queen); if (!q) return { win: false, why: 'The Queen was poofed. That should not happen!' };
      const heroes = flagged(w, 'hero').map((id) => w.unit(id)!);
      if (heroes.every((h) => dist(h.x, h.y, q.x, q.y) < tiles(3.5))) return { win: true, why: 'Dora and Enzo reached the Queen.' };
      return null;
    },
    extra: (w) => [minutes(w) <= 8, w.players[0].stats.poofed < 10],
    pilot: { aim: (w, st) => { const q = w.unit(st.marks.queen); return q ? [q.x - T, q.y + T] : null; } },
  },
  {
    id: 'festival', n: 10, title: 'Festival of Friends', backdrop: 'festival',
    blurb: 'The night before the festival, a storm overwound a whole hall of beetles. Now they whirr about in a frenzy, tipping over every table.',
    goal: 'With the Guild and the Hive beside you, calm the Overwound by tidying away all their buildings.',
    brief: [
      say('queen', 'The storm’s lightning wound them far too tight. They don’t know what they’re doing, poor dears.'),
      say('marlo', 'The Guild will hold the south. Junk Carts are loaded with very soft apples.'),
      say('enzo', 'And the Hive holds the east. We go up the middle.'),
      say('dora', 'Calm them down, then let’s have the best festival the meadow has ever seen!'),
    ],
    outro: [
      say('queen', 'Unwound and sleepy. Thank you, all of you.'),
      say('marlo', 'Now then: who wants berries? I brought a bin full. A clean one!'),
      say('enzo', 'Hay bales for seats, beetle lanterns, raccoon kites...'),
      say('dora', 'And friends from all over. Happy festival, everyone!'),
    ],
    stars: ['Calm the Overwound', 'Within 20 minutes', 'Keep Dora and Enzo above half health'],
    map: mapOf('m-festival', 'Festival Meadow', 64, 64, [[5, 5], [52, 52], [5, 52], [52, 5]], [
      ...kit(5, 5, [0.7, 0.7], [-0.3, 1]), ...kit(52, 52, [-0.7, -0.7], [0.3, -1]), ...kit(5, 52, [0.7, -0.7], [1, 0.3], 5), ...kit(52, 5, [-0.7, 0.7], [-1, -0.3], 5),
      { t: 'pond', x: 32, y: 32, rx: 3, ry: 3 }, { t: 'wood', x: 20, y: 32, rx: 2, ry: 6 }, { t: 'wood', x: 44, y: 32, rx: 2, ry: 6 },
      { t: 'wood', x: 32, y: 20, rx: 6, ry: 2 }, { t: 'wood', x: 32, y: 44, rx: 6, ry: 2 }, { t: 'glimmer', x: 30, y: 26 }, { t: 'glimmer', x: 33, y: 37 },
    ], [[16, 16], [45, 45]]),
    others: [
      { side: 'guild', team: 0, ai: 'normal', opts: { noExpand: true, target: [54 * T, 54 * T] }, name: 'Marlo’s Guild' },
      { side: 'hive', team: 0, ai: 'normal', opts: { noExpand: true, target: [54 * T, 54 * T] }, name: 'The Queen’s Hive' },
      { side: 'hive', team: 1, ai: 'normal', opts: { delay: M(3) }, name: 'The Overwound', color: '#d9724a' },
    ],
    setup(w, st) {
      home(w, 0, 5, 5, 6); w.players[0].hay = 400; w.players[0].glimmer = 100;
      w.placeBuilding(0, 'pit', 10, 10, true); w.placeBuilding(0, 'hut', 2, 10, true); w.placeBuilding(0, 'stump', 13, 14, true);
      group(w, 0, [['slinger', 6], ['fluffguard', 2]], 12, 8);
      const d = hero(w, spawn(w, 0, 'dora', 10, 6)), e = hero(w, spawn(w, 0, 'enzo', 11, 7)); st.marks.dora = d.id; st.marks.enzo = e.id;
      home(w, 1, 5, 52, 6); home(w, 2, 52, 5, 6);
      const q = spawn(w, 2, 'queen', 50, 10); void q;
      home(w, 3, 52, 52, 10); w.players[3].hay = 500; w.players[3].glimmer = 100;
      w.placeBuilding(3, 'brood', 46, 54, true); w.placeBuilding(3, 'brood', 54, 46, true); w.placeBuilding(3, 'spring', 47, 47, true); w.placeBuilding(3, 'cell', 58, 50, true); w.placeBuilding(3, 'cell', 50, 58, true);
      group(w, 3, [['clicker', 3], ['squirt', 3], ['shellback', 1]], 45, 46);
    },
    tick(w, st) {
      for (const k of ['dora', 'enzo']) { const h = w.unit(st.marks[k]); if (h && h.hp * 2 < h.maxHp) st.marks[k + 'Low'] = 1; }
    },
    talk: [
      once('x1', after(170), 'queen', 'Here they come, whirring! My beetles will help wherever they’re near a spring.'),
      once('x2', (w) => w.buildings.filter((b) => b.owner === 3).length <= 3, 'marlo', 'Nearly there! Their last buildings are wobbling!'),
    ],
    check(w) {
      if (heroesGone(w)) return { win: false, why: `${heroName(w)} was poofed home dizzy.` };
      if (hqLost(w) && !w.buildings.some((b) => b.owner === 0)) return { win: false, why: 'The colony’s buildings were all tidied away.' };
      if (allGone(w, 3)) return { win: true, why: 'The Overwound are calm at last.' };
      return null;
    },
    extra: (w, st) => [minutes(w) <= 20, !st.marks.doraLow && !st.marks.enzoLow],
    pilot: { aim: (w) => { const b = w.buildings.find((x) => x.owner === 3); return b ? [b.x, b.y] : null; }, go: (w) => armyWorth(w) >= 2400, diff: 'hard' },
  },
];

/** Where the nearest goal building stands. */
function goalAt(w: World): [number, number] | null {
  let best: [number, number] | null = null, bd = Infinity;
  for (const id of flagged(w, 'goal')) { const b = w.building(id); if (b) { const d = b.x + b.y; if (d < bd) { bd = d; best = [b.x, b.y]; } } }
  return best;
}
const armyWorth = (w: World) => w.units.filter((u) => u.owner === 0 && !u.def.worker).reduce((s, u) => s + u.def.hay + u.def.glimmer * 2 + (u.def.hero ? 300 : 0), 0);

/**
 * A computer player for the player's side, used by the tests to show every mission can be won: it runs the economy like
 * a computer opponent and sends the army (heroes too) where the mission's plan says.
 */
export class Pilot {
  private ai: Computer;
  constructor(readonly m: Mission, readonly st: MissionState) { this.ai = new Computer(m.pilot.diff ?? 'normal', { noArmy: true, noExpand: true, glimmer: m.pilot.glimmer }); }
  think(w: World, p: import('./command-game.js').Player) {
    this.ai.think(w, p);
    if (w.tick % 20 !== 0) return;
    const all = w.units.filter((u) => u.owner === 0 && !u.def.worker && u.def.dmg > 0 && !w.frozen.has(u.id));
    const army = all.filter((u) => !u.def.hero), heroes = all.filter((u) => u.def.hero);
    // kits that have been found head home
    const hq = w.buildings.find((b) => b.owner === 0 && b.def.hq);
    const kits = flagged(w, 'kit').map((id) => w.unit(id)).filter((u): u is Unit => !!u && !w.frozen.has(u.id) && !u.order);
    if (hq && kits.length) w.exec({ p: 0, k: 'move', ids: kits.map((u) => u.id), x: hq.x, y: hq.y + T * 2 });
    const aim0 = this.m.pilot.aim(w, this.st), go = !this.m.pilot.go || this.m.pilot.go(w, this.st) || this.st.marks.going;
    // trouble at home comes first
    const threat = w.units.find((e) => w.enemies(0, e.owner) && w.seen(0, e.x, e.y) && w.buildings.some((b) => b.owner === 0 && dist(b.x, b.y, e.x, e.y) < tiles(9)));
    let aim: [number, number] | null = aim0 && go ? aim0 : null;
    if (threat && !aim) { const free = army.filter((u) => !u.target); if (free.length) w.exec({ p: 0, k: 'amove', ids: free.map((u) => u.id), x: threat.x, y: threat.y }); aim = [threat.x, threat.y]; }
    else if (!aim) {
      if (hq) {
        const idle = army.filter((u) => !u.order && !u.target && dist(u.x, u.y, hq.x, hq.y) > tiles(7));
        if (idle.length) w.exec({ p: 0, k: 'amove', ids: idle.map((u) => u.id), x: hq.x + T * 3, y: hq.y + T * 3 });
      }
      this.heroes(w, heroes, army, hq, hq ? [hq.x + T * 3, hq.y + T * 3] : null);
      return;
    }
    if (aim0 && go) this.st.marks.going = 1;
    const rest = army;
    const stale = rest.filter((u) => !u.target && (!u.order || (u.order.k === 'amove' && dist(u.order.x, u.order.y, aim[0], aim[1]) > tiles(3))));
    if (stale.length && !threat) w.exec({ p: 0, k: 'amove', ids: stale.map((u) => u.id), x: aim[0], y: aim[1] });
    this.heroes(w, heroes, rest, hq, aim);
  }
  private heroes(w: World, heroes: Unit[], rest: Unit[], hq: Building | undefined, aim: [number, number] | null) {
    if (!aim) return;
    // heroes stay a step behind the army, and step back to catch their breath when bumped about
    let cx = aim[0], cy = aim[1];
    if (rest.length) { cx = 0; cy = 0; for (const u of rest) { cx += u.x; cy += u.y; } cx = Math.round(cx / rest.length); cy = Math.round(cy / rest.length); }
    for (const h of heroes) {
      const foe = w.units.find((e) => w.enemies(0, e.owner) && !w.frozen.has(e.id) && dist(e.x, e.y, h.x, h.y) < tiles(5));
      if (h.def.ability && h.abCd <= 0 && foe) w.exec({ p: 0, k: 'ability', ids: [h.id], ab: h.def.ability, x: foe.x, y: foe.y });
      if (h.hp * 2 < h.maxHp) { this.st.marks['tired' + h.id] = 1; }
      if (this.st.marks['tired' + h.id]) {
        if (h.hp * 5 >= h.maxHp * 4) delete this.st.marks['tired' + h.id];
        const back = hq ?? { x: h.homeX, y: h.homeY };
        if (!h.order || h.order.k !== 'move') w.exec({ p: 0, k: 'move', ids: [h.id], x: back.x + T * 2, y: back.y + T * 2 });
        continue;
      }
      const tx = rest.length && dist(cx, cy, aim[0], aim[1]) > tiles(4) ? cx : aim[0], ty = rest.length && dist(cx, cy, aim[0], aim[1]) > tiles(4) ? cy : aim[1];
      if (!h.target && (!h.order || h.order.k !== 'amove' || dist(h.order.x, h.order.y, tx, ty) > tiles(2))) w.exec({ p: 0, k: 'amove', ids: [h.id], x: tx, y: ty });
    }
  }
}

/** True when one of the player's buildings was tidied away during the match (tracked by the script). */
function lostBuilding(w: World) { return (w.flags.get(-1) ?? '') === 'lostBuilding'; }

/** Runs a mission: talks, waves, and the goal. */
export class MissionScript {
  st: MissionState = { said: new Set(), marks: {}, done: false };
  outcome: { win: boolean; why: string; stars: [boolean, boolean, boolean]; secs: number } | null = null;
  constructor(readonly m: Mission) {}
  tick(w: World) {
    if (this.st.done) return;
    for (const e of w.events) {
      if (e.k === 'tidy' && e.owner === 0) w.flags.set(-1, 'lostBuilding');
      if (e.k === 'trained' && e.owner === 0) this.st.marks['trained:' + e.type] = (this.st.marks['trained:' + e.type] ?? 0) + 1;
    }
    this.m.tick?.(w, this.st);
    for (const t of this.m.talk) if (!this.st.said.has(t.key) && t.when(w, this.st)) { this.st.said.add(t.key); w.events.push({ k: 'say', who: t.line.who, text: t.line.text }); }
    const r = this.m.check(w, this.st);
    if (r) {
      this.st.done = true;
      const [b, c] = r.win ? this.m.extra(w, this.st) : [false, false];
      this.outcome = { win: r.win, why: r.why, stars: [r.win, b, c], secs: Math.round(w.tick / TICK_HZ) };
      w.result = { winner: r.win ? 0 : 1, reason: 'mission', text: r.why };
    }
  }
}

/** Sets up a mission's match, its computer players and its script. */
export function startMission(m: Mission, seed: number) {
  const slots = [{ side: 'colony' as SideId, team: 0, name: 'Colony' }, ...m.others.map((o) => ({ side: o.side, team: o.team, ai: o.ai, name: o.name, color: o.color }))];
  const w = new World({ map: m.map, seed, slots, bare: true, scripted: true });
  const script = new MissionScript(m);
  m.setup(w, script.st);
  m.others.forEach((o, i) => { w.brains[i + 1] = new Computer(o.ai, o.opts ?? {}); });
  w.script = script;
  w.refreshFog(true);
  return { w, script };
}
export const missionById = (id: string) => MISSIONS.find((m) => m.id === id) ?? null;

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'burrow-command-v1';
export type Speed = 0.75 | 1 | 1.5;
export type Profile = {
  v: 1;
  /** Best stars per mission (0..3). */
  stars: Record<string, number>;
  /** Fastest win per mission, in seconds. */
  best: Record<string, number>;
  settings: { mute: boolean; speed: Speed; edge: boolean; diff: Difficulty; side: SideId; foe: SideId; map: string; hints: boolean };
  skirmish: { played: number; won: number; bySide: Record<SideId, { played: number; won: number }> };
};
export const freshProfile = (): Profile => ({
  v: 1, stars: {}, best: {},
  settings: { mute: false, speed: 1, edge: true, diff: 'normal', side: 'colony', foe: 'guild', map: MAPS[0].id, hints: true },
  skirmish: { played: 0, won: 0, bySide: { colony: { played: 0, won: 0 }, guild: { played: 0, won: 0 }, hive: { played: 0, won: 0 } } },
});
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : 0);
const pickOf = <K extends string | number>(v: unknown, list: readonly K[], d: K): K => (list.includes(v as K) ? (v as K) : d);
/** Reads a saved profile defensively: anything broken or from another version starts fresh. */
export function readProfile(raw: string | null | undefined): Profile {
  const p = freshProfile();
  if (!raw) return p;
  let j: Record<string, unknown>;
  try { j = JSON.parse(raw); } catch { return p; }
  if (!j || typeof j !== 'object' || j.v !== 1) return p;
  const ids = MISSIONS.map((m) => m.id);
  const stars = (j.stars ?? {}) as Record<string, unknown>, best = (j.best ?? {}) as Record<string, unknown>;
  for (const id of ids) { if (stars[id] !== undefined) p.stars[id] = num(stars[id], 0, 3); if (best[id] !== undefined) p.best[id] = num(best[id], 0, 99999); }
  const s = (j.settings ?? {}) as Record<string, unknown>;
  p.settings = {
    mute: s.mute === true, speed: pickOf<Speed>(s.speed, [0.75, 1, 1.5], 1), edge: s.edge !== false,
    diff: pickOf(s.diff as Difficulty, ['easy', 'normal', 'hard'] as const, 'normal'), side: pickOf(s.side as SideId, ['colony', 'guild', 'hive'] as const, 'colony'),
    foe: pickOf(s.foe as SideId, ['colony', 'guild', 'hive'] as const, 'guild'), map: pickOf(s.map as string, MAPS.map((m) => m.id), MAPS[0].id), hints: s.hints !== false,
  };
  const k = (j.skirmish ?? {}) as Record<string, unknown>;
  p.skirmish.played = num(k.played, 0, 1e6); p.skirmish.won = Math.min(p.skirmish.played, num(k.won, 0, 1e6));
  const bs = (k.bySide ?? {}) as Record<string, Record<string, unknown>>;
  for (const side of ['colony', 'guild', 'hive'] as SideId[]) { const v = bs[side] ?? {}; p.skirmish.bySide[side] = { played: num(v.played, 0, 1e6), won: Math.min(num(v.played, 0, 1e6), num(v.won, 0, 1e6)) }; }
  return p;
}
/** A mission is open once the one before it has been won. */
export const unlocked = (p: Profile, i: number) => i === 0 || (p.stars[MISSIONS[i - 1]?.id] ?? 0) > 0;
export const totalStars = (p: Profile) => MISSIONS.reduce((s, m) => s + (p.stars[m.id] ?? 0), 0);
/** Keeps the best stars and time for a mission. */
export function recordMission(p: Profile, id: string, stars: [boolean, boolean, boolean], secs: number): Profile {
  const n = stars.filter(Boolean).length, q = { ...p, stars: { ...p.stars }, best: { ...p.best } };
  if (!stars[0]) return q;
  q.stars[id] = Math.max(q.stars[id] ?? 0, n);
  q.best[id] = Math.min(q.best[id] ?? Infinity, secs);
  return q;
}
export function recordSkirmish(p: Profile, side: SideId, won: boolean): Profile {
  const q = { ...p, skirmish: { ...p.skirmish, bySide: { ...p.skirmish.bySide } } };
  q.skirmish.played++; if (won) q.skirmish.won++;
  const s = q.skirmish.bySide[side]; q.skirmish.bySide[side] = { played: s.played + 1, won: s.won + (won ? 1 : 0) };
  return q;
}
export type { Building };

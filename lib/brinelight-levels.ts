// Brinelight: the hand-authored content. Six districts on the harbour map (areas 3–6 are listed but not built yet),
// their stages, and every scene laid out by hand as string rows: a decor row behind the railing, five walkable lanes
// (back to front) and a decor row in the foreground. One character is one column of COL world units.
// The engine (lib/brinelight-game.ts) reads this file; nothing here is random.

export const COL = 40;

/** Walkable lanes, back to front. Lane r stands at depth z = LANE_Z[r]. */
export const LANE_Z = [8, 44, 80, 116, 152];

export type FloorId = 'quay' | 'street' | 'breakwater' | 'market';
export type FarId = 'harbour' | 'town' | 'alley' | 'market' | 'square';
export type FoeKind = 'crab' | 'hermit' | 'gull' | 'puffer' | 'shrimp' | 'lobster' | 'jelly' | 'urchin';
export type BossKind = 'brute' | 'clamps' | 'knuckles' | 'admiral';
export type NpcId = 'mabel' | 'twins' | 'barnaby';

/**
 * A wave: groups spawn one after another as the last group thins out. A token is a foe kind with the side it comes
 * from: `crab>` from the right, `<crab` from the left, `crab` from alternating sides. `crab@2` lines it up in lane 2
 * (a conga line, for the dash special). `call` is what a shrimp lookout whistles up if nobody stops it in time.
 */
export interface WaveDef { col: number; kind: 'wave'; groups: string[]; call?: string[]; lantern?: number; teach?: 'special' }
export interface BossDef { col: number; kind: 'boss'; who: BossKind }
export interface CartDef { col: number; kind: 'cart'; lane: number }
export interface TalkDef { col: number; kind: 'talk'; who: NpcId; line: string }
export interface TutDef { col: number; kind: 'tutorial' }
export type EventDef = WaveDef | BossDef | CartDef | TalkDef | TutDef;

export interface SceneDef {
  id: string; name: string; floor: FloorId; far: FarId;
  /** decor behind the railing: b barrel, p lobster pot, o bollard, c crate, f fish crate, r rope, S ice stall,
   *  L lobster stall, A awning post, X fish boxes, W basket, R brine barrel, D dried fish, T hand truck, M mussels,
   *  N net coil, Z brazier, B bell; @ Mabel, & Pip and Pepper, $ Barnaby */
  back: string;
  /** the five lanes: . floor; b barrel (Enzo lifts and throws it); c crate; s crate with a snack; k crate with a
   *  lantern charm; f fish crate (a snack); i block of fish-ice (Enzo shoves it); n a cargo net hanging overhead
   *  (Dora kicks it down); g a lantern charm lying in the open; m a sea-shanty scroll; a the way into a hidden scene
   *  (back lane only) */
  lanes: [string, string, string, string, string];
  front: string;
  /** lantern strings over the scene: column and how many lanterns hang on it */
  strings: { col: number; need: number }[];
  events: EventDef[];
  /** a hidden scene reached through `a`; after it the stage carries on with the next scene */
  secret?: string;
  /** charms and the shanty in this scene, for the map's counts */
  charms: number; shanty?: boolean;
}

export interface StageDef { id: string; area: number; name: string; scenes: string[]; panel?: string }
export interface AreaDef {
  id: number; name: string; ready: boolean; mood: string; blurb: string;
  stages: string[]; boss: string;
}

export const AREAS: AreaDef[] = [
  { id: 1, name: 'Lantern Quay', ready: true, mood: 'jig', blurb: 'Crates and fish to throw, and Clamps the Dockboss on his pier.', stages: ['1-1', '1-2', '1-3'], boss: 'Clamps the Dockboss' },
  { id: 2, name: 'The Fish Market', ready: true, mood: 'tarantella', blurb: 'Hanging nets to kick down and fish-ice to shove, under the Gull Admiral’s awnings.', stages: ['2-1', '2-2', '2-3'], boss: 'The Gull Admiral' },
  { id: 3, name: 'The Ropewalk and Shipyard', ready: false, mood: 'work song', blurb: 'Barrels roll down the belt. Not built yet.', stages: [], boss: 'Old Tanglejaw' },
  { id: 4, name: 'The Lighthouse Rocks', ready: false, mood: 'storm', blurb: 'The tide surges. Not built yet.', stages: [], boss: 'Bertha Boathouse' },
  { id: 5, name: 'The Smugglers’ Caves', ready: false, mood: 'cave', blurb: 'Lit only by plankton jars. Not built yet.', stages: [], boss: 'The Cuttle Conjurer' },
  { id: 6, name: 'Pinchwell’s Breakwater Fort', ready: false, mood: 'finale', blurb: 'The fort of stolen lanterns. Not built yet.', stages: [], boss: 'Grand Pinchwell' },
];

export const STAGES: Record<string, StageDef> = {
  '1-1': { id: '1-1', area: 1, name: 'Dusk on the Quay', scenes: ['q1', 'q2', 'q3'] },
  '1-2': { id: '1-2', area: 1, name: 'The Harbour Front', scenes: ['s1', 's2'] },
  '1-3': { id: '1-3', area: 1, name: 'Clamps’ Pier', scenes: ['bw'], panel: 'panel-quay' },
  '2-1': { id: '2-1', area: 2, name: 'The Market Gate', scenes: ['m1', 'm2', 'm3'] },
  '2-2': { id: '2-2', area: 2, name: 'The Back Stalls', scenes: ['m4', 'm5'] },
  '2-3': { id: '2-3', area: 2, name: 'The Awnings', scenes: ['sq1', 'sq2'], panel: 'panel-market' },
};

export const SCENES: Record<string, SceneDef> = {
  // ─────────────────────────────────────────── Area 1 · Lantern Quay
  q1: {
    id: 'q1', name: 'Dusk on the Quay', floor: 'quay', far: 'harbour',
    back:  '..b...p.o.......c.b.....r....f...p.o.......b..c..',
    lanes: [
      '.................................................',
      '.................................................',
      '.................................................',
      '.........................s.......................',
      '.................................................',
    ],
    front: 'f.........r..........c........p.........r........',
    strings: [{ col: 7, need: 1 }, { col: 22, need: 2 }, { col: 40, need: 3 }],
    events: [
      { col: 0, kind: 'tutorial' },
      { col: 3, kind: 'talk', who: 'mabel', line: 'The Scuttle Crew took the lanterns! Win them back, deckhands.' },
      { col: 40, kind: 'wave', groups: ['crab>', 'crab> <crab', '<crab crab>', 'crab> gull>'], lantern: 2 },
    ],
    charms: 0,
  },
  q2: {
    id: 'q2', name: 'Crate Row', floor: 'quay', far: 'harbour',
    back:  '.c.c..b.....p..o.....f.b.b........o...p...c..',
    lanes: [
      '.............................................',
      '........c..................................k.',
      '.............................................',
      '..................b..........................',
      '.......................s.....................',
    ],
    front: '..p.......c......r.........f..........c......',
    strings: [{ col: 14, need: 3 }, { col: 34, need: 3 }],
    events: [
      { col: 14, kind: 'wave', groups: ['crab> crab>', '<crab hermit>', 'crab> <crab'], lantern: 0 },
      { col: 34, kind: 'wave', groups: ['puffer>', 'crab> <crab', 'puffer> <crab', 'hermit> crab>'], lantern: 1 },
    ],
    charms: 1,
  },
  q3: {
    id: 'q3', name: 'Lookout Post', floor: 'quay', far: 'harbour',
    back:  '..o.....b.c......p.....@...f......o..b..c.r...',
    lanes: [
      '..............................................',
      '..............................................',
      '..............c...............................',
      '..............................................',
      '.......f..............................k.......',
    ],
    front: 'r.........p........c........b.......f.........',
    strings: [{ col: 12, need: 3 }, { col: 26, need: 3 }, { col: 40, need: 3 }],
    events: [
      { col: 12, kind: 'wave', groups: ['shrimp> crab> <crab', 'hermit>', '<crab crab>'], call: ['crab> crab>'], lantern: 0 },
      { col: 23, kind: 'talk', who: 'mabel', line: 'Run at a line of them and leap! They go down like skittles.' },
      { col: 26, kind: 'wave', groups: ['crab>@2 crab>@2 crab>@2 crab>@2', 'gull> <crab', 'crab>@1 crab>@1 crab>@1'], lantern: 1, teach: 'special' },
      { col: 40, kind: 'wave', groups: ['crab> <crab gull>', 'shrimp> puffer> <crab', 'hermit> <hermit', 'crab> <crab crab>'], call: ['<crab crab>'], lantern: 2 },
    ],
    charms: 1,
  },
  s1: {
    id: 's1', name: 'Harbour Front', floor: 'street', far: 'town',
    back:  '..W..f...b...........c.b..T....r....W.........',
    lanes: [
      '..............................a...............',
      '..............................................',
      '...........c..................................',
      '..............................................',
      '..s......................................k....',
    ],
    front: '...b.........o.........W.........p.......c....',
    strings: [{ col: 12, need: 3 }, { col: 38, need: 3 }],
    events: [
      { col: 12, kind: 'wave', groups: ['crab> puffer>', '<crab gull>', 'hermit> <crab', 'crab> <puffer'], lantern: 0 },
      { col: 24, kind: 'cart', lane: 2 },
      { col: 38, kind: 'wave', groups: ['crab>@2 crab>@2 crab>@2', 'shrimp> <puffer', 'gull> hermit> <crab', '<gull crab> crab>'], call: ['crab> <crab gull>'], lantern: 1 },
    ],
    secret: 'alley',
    charms: 1,
  },
  alley: {
    id: 'alley', name: 'The Hidden Alley', floor: 'street', far: 'alley',
    back:  '..W....$.....b.c......',
    lanes: [
      '......................',
      '...........g..........',
      '......................',
      '..........m...........',
      '................g.....',
    ],
    front: 'b.......W.....c.......',
    strings: [{ col: 11, need: 2 }],
    events: [
      { col: 5, kind: 'talk', who: 'barnaby', line: 'A song for a lantern? Keep the scroll, it’s an old shanty.' },
      { col: 14, kind: 'wave', groups: ['<crab crab>', 'hermit>'], lantern: 0 },
    ],
    charms: 2, shanty: true,
  },
  s2: {
    id: 's2', name: 'Bell Steps', floor: 'street', far: 'town',
    back:  '.f...b..W.....c.c.....B......r..b..',
    lanes: [
      '...................................',
      '.....c.............................',
      '...................................',
      '.............b.....................',
      '...k...............s...............',
    ],
    front: '....p.......f........W......c......',
    strings: [{ col: 10, need: 3 }, { col: 26, need: 4 }],
    events: [
      { col: 10, kind: 'wave', groups: ['puffer> <puffer', 'gull> crab>', '<hermit shrimp>', 'crab> <crab gull>'], call: ['crab> crab>'], lantern: 0 },
      { col: 26, kind: 'boss', who: 'brute' },
    ],
    charms: 1,
  },
  bw: {
    id: 'bw', name: 'Clamps’ Pier', floor: 'breakwater', far: 'harbour',
    back:  '..b...c....o...b.b.c...o......',
    lanes: [
      '..............................',
      '..............................',
      '.........f....................',
      '..............................',
      '..............................',
    ],
    front: '.r.......b......o.......r.....',
    strings: [{ col: 8, need: 3 }, { col: 22, need: 6 }],
    events: [
      { col: 8, kind: 'wave', groups: ['hermit> crab>', '<crab crab> gull>', 'puffer> <hermit'], lantern: 0 },
      { col: 22, kind: 'boss', who: 'clamps' },
    ],
    charms: 0,
  },
  // ─────────────────────────────────────────── Area 2 · The Fish Market
  m1: {
    id: 'm1', name: 'Ice Hall', floor: 'market', far: 'market',
    back:  '.S..X..S.R..W..S...X..M..S...R..W..S.',
    lanes: [
      '.....................................',
      '..........i..............i...........',
      '.....................................',
      '...i................................k',
      '...........s...........i.............',
    ],
    front: '..W.......N.........X.......Z.......M',
    strings: [{ col: 12, need: 3 }, { col: 28, need: 4 }],
    events: [
      { col: 3, kind: 'talk', who: 'twins', line: 'Shove the fish-ice, Enzo! It slides right through them.' },
      { col: 12, kind: 'wave', groups: ['lobster>', 'crab> <crab', 'crab> <lobster'], lantern: 0 },
      { col: 28, kind: 'wave', groups: ['crab> lobster>', '<hermit puffer>', 'lobster> <crab', 'crab> <crab gull>'], lantern: 1 },
    ],
    charms: 1,
  },
  m2: {
    id: 'm2', name: 'Net Lofts', floor: 'market', far: 'market',
    back:  '..D..S..L....D...S..X..D..L...S..D...',
    lanes: [
      '.....................................',
      '.......n..............n..............',
      '..............n...............n......',
      '.....................................',
      '....f......................k.........',
    ],
    front: '.N......M.........Z.......W......X...',
    strings: [{ col: 11, need: 3 }, { col: 27, need: 4 }],
    events: [
      { col: 11, kind: 'wave', groups: ['jelly> crab>', '<crab crab>', 'jelly> <gull'], lantern: 0 },
      { col: 27, kind: 'wave', groups: ['jelly> <jelly', 'gull> crab>', 'lobster> <crab crab>', '<jelly hermit>'], lantern: 1 },
    ],
    charms: 1,
  },
  m3: {
    id: 'm3', name: 'Crab Counters', floor: 'market', far: 'market',
    back:  '.L..S..X..L..R..S..W..L..S..X...L..S..',
    lanes: [
      '......................................',
      '...........i..........................',
      '......................................',
      '.........................n............',
      '..s.................................k.',
    ],
    front: '...M.......W.......X.......N.......Z..',
    strings: [{ col: 10, need: 3 }, { col: 22, need: 5 }, { col: 34, need: 4 }],
    events: [
      { col: 10, kind: 'wave', groups: ['shrimp> lobster>', '<crab crab>', 'puffer> <crab'], call: ['<crab crab> jelly>'], lantern: 0 },
      { col: 22, kind: 'wave', groups: ['crab>@1 crab>@1 crab>@1 crab>@1 crab>@1', 'puffer> <jelly', 'crab>@3 crab>@3 crab>@3 lobster>'], lantern: 1, teach: 'special' },
      { col: 34, kind: 'wave', groups: ['hermit> gull>', '<puffer jelly> crab>', 'lobster> <lobster', 'crab> <crab urchin>'], lantern: 2 },
    ],
    charms: 1,
  },
  m4: {
    id: 'm4', name: 'Urchin Gutter', floor: 'market', far: 'market',
    back:  '..X..S..T..D.......W..S..X..R..D..S...',
    lanes: [
      '................a.....................',
      '.....................i................',
      '......................................',
      '.....i...........................k....',
      '..............f.......................',
    ],
    front: '.Z.......W........M.......N.......X...',
    strings: [{ col: 10, need: 3 }, { col: 30, need: 4 }],
    events: [
      { col: 10, kind: 'wave', groups: ['urchin> crab>', '<crab urchin>', 'lobster> <crab'], lantern: 0 },
      { col: 30, kind: 'wave', groups: ['urchin> <urchin lobster>', 'jelly> shrimp>', '<hermit urchin> crab>', '<jelly crab> urchin>'], call: ['crab> <crab urchin>'], lantern: 1 },
    ],
    secret: 'larder',
    charms: 1,
  },
  larder: {
    id: 'larder', name: 'The Smugglers’ Larder', floor: 'market', far: 'alley',
    back:  '..R..&......X.X..R....',
    lanes: [
      '......................',
      '.........g............',
      '..............i.......',
      '.......m..............',
      '...............g......',
    ],
    front: '.X.......R........W...',
    strings: [{ col: 12, need: 2 }],
    events: [
      { col: 4, kind: 'talk', who: 'twins', line: 'Shh! The crabs hide the good lanterns down here.' },
      { col: 13, kind: 'wave', groups: ['urchin> <crab', 'crab> crab>'], lantern: 0 },
    ],
    charms: 2, shanty: true,
  },
  m5: {
    id: 'm5', name: 'Fishmongers’ Ring', floor: 'market', far: 'market',
    back:  '.S..L..X..B..W..S..R..X..L..',
    lanes: [
      '............................',
      '....c.......................',
      '............................',
      '............................',
      '...s....................k...',
    ],
    front: '..M.......Z.......N.......W.',
    strings: [{ col: 8, need: 3 }, { col: 20, need: 4 }],
    events: [
      { col: 8, kind: 'wave', groups: ['jelly> lobster>', '<urchin crab>', 'shrimp> <crab'], call: ['crab> <crab'], lantern: 0 },
      { col: 20, kind: 'boss', who: 'knuckles' },
    ],
    charms: 1,
  },
  sq1: {
    id: 'sq1', name: 'Market Square', floor: 'market', far: 'square',
    back:  '..A....X..R....A....S..W....A....X..L..A..',
    lanes: [
      '..........................................',
      '........n..................n..............',
      '.................i........................',
      '...............................n..........',
      '....s.............................k.......',
    ],
    front: '.N.......Z........M........W.........X....',
    strings: [{ col: 10, need: 3 }, { col: 22, need: 4 }, { col: 34, need: 4 }],
    events: [
      { col: 10, kind: 'wave', groups: ['gull> <gull crab>', 'jelly> <crab', 'lobster> <gull'], lantern: 0 },
      { col: 22, kind: 'wave', groups: ['lobster> <lobster', 'jelly> urchin>', '<crab crab> puffer>'], lantern: 1 },
      { col: 34, kind: 'wave', groups: ['shrimp> puffer> <urchin', 'crab>@3 crab>@3 crab>@3 gull>', 'hermit> <lobster jelly>', 'gull> <jelly lobster>'], call: ['gull> <gull'], lantern: 2 },
    ],
    charms: 1,
  },
  sq2: {
    id: 'sq2', name: 'Admiral’s Perch', floor: 'market', far: 'square',
    back:  '..A....R....A..X....A...',
    lanes: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    front: '.Z.....N.......M.....W..',
    strings: [{ col: 6, need: 3 }, { col: 16, need: 6 }],
    events: [
      { col: 16, kind: 'boss', who: 'admiral' },
    ],
    charms: 0,
  },
};

/** every secret in the built areas, as `<scene>:<index>` ids, in scene order */
export function secretIds(): string[] {
  const out: string[] = [];
  for (const st of Object.values(STAGES)) {
    for (const id of st.scenes) {
      const sc = SCENES[id];
      for (let i = 0; i < sc.charms; i++) out.push(`${id}:c${i}`);
      if (sc.shanty) out.push(`${id}:shanty`);
      if (sc.secret) {
        const h = SCENES[sc.secret];
        for (let i = 0; i < h.charms; i++) out.push(`${h.id}:c${i}`);
        if (h.shanty) out.push(`${h.id}:shanty`);
      }
    }
  }
  return out;
}

export const BOSS_NAME: Record<BossKind, string> = {
  brute: 'Crusty Magnus', clamps: 'Clamps the Dockboss', knuckles: 'Kid Knuckles', admiral: 'The Gull Admiral',
};
export const NPC_NAME: Record<NpcId, string> = { mabel: 'Old Mabel', twins: 'Pip and Pepper', barnaby: 'Barnaby' };

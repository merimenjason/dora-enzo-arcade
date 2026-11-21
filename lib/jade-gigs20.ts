// Jade Street, the twentieth pass: side gigs for the districts past Chinatown. Before this pass every gig board stood in
// Chinatown; now each later district has its own, run by its own givers round its own landmarks: Uncle Kamal's mooncake
// round and cab fares in Toa Payoh, Auntie Vanda's balloons and promenade run at Marina Bay, Malar's temple garlands,
// Kancil's batik, Duyung's runaway beach balls, Uncle Buaya's potong, Rosie's laksa round and kamcheng, Faiz's lost
// luggage, Seng's bakery round and chwee kueh, Kerbau's river taxi, Musang's lanterns in the Chinese Garden, Ayu's
// island bike loop and Coach Biru's buoy sprint. Routes are hand-placed (old-frame tiles, moved once through the layout
// table, as the story's are), so nothing lands in a pond; the timers come from each route's foot or boat path (see
// tests/jade-twenty.mjs) with room for a first-timer on Normal. Appended after Chinatown's gigs in GIG_DEFS.
import type { District } from './jade-city.js';
import { mvStep, type Step } from './jade-story.js';

export type Gig20 = { id: string; title: string; at: [number, number]; d: District; giver: string; kind: string };
/** the boards: `at` in the old frame (lib/jade-gigs.ts moves them as it does Chinatown's) */
export const GIG20_DEFS: Gig20[] = [
  { id: 'mooncakes-tp', title: 'Mooncake round', at: [154, 32], d: 'heartland', giver: 'kamal', kind: 'mooncakes' },
  { id: 'fares-tp', title: 'Toa Payoh fares', at: [149, 33], d: 'heartland', giver: 'kamal', kind: 'fares-tp' },
  { id: 'balloons-bay', title: 'Balloon round', at: [155, 71], d: 'bay', giver: 'vanda', kind: 'balloons' },
  { id: 'promenade', title: 'Promenade run', at: [158, 67], d: 'bay', giver: 'vanda', kind: 'promenade' },
  { id: 'garlands-li', title: 'Garland round', at: [240, 22], d: 'india', giver: 'malar', kind: 'garlands' },
  { id: 'batik', title: 'Batik for Bussorah', at: [233, 55], d: 'glam', giver: 'kancil', kind: 'batik' },
  { id: 'beachballs', title: 'Runaway beach balls', at: [113, 112], d: 'resort', giver: 'duyung', kind: 'beachballs' },
  { id: 'potong', title: 'Potong round', at: [307, 12], d: 'orchard', giver: 'buaya', kind: 'potong' },
  { id: 'laksa-round', title: 'Laksa round', at: [287, 57], d: 'katong', giver: 'rosie', kind: 'laksa' },
  { id: 'kamcheng', title: 'Kamcheng to the mansion', at: [289, 61], d: 'katong', giver: 'rosie', kind: 'kamcheng' },
  { id: 'luggage', title: 'Lost luggage', at: [352, 24], d: 'changi', giver: 'faiz', kind: 'luggage' },
  { id: 'croissants', title: 'Bakery round', at: [252, 113], d: 'tiong', giver: 'seng', kind: 'croissants' },
  { id: 'chweekueh', title: 'Chwee kueh to the flats', at: [258, 103], d: 'tiong', giver: 'seng', kind: 'chweekueh' },
  { id: 'river-taxi', title: 'River taxi run', at: [311, 102], d: 'quay', giver: 'kerbau', kind: 'river-taxi' },
  { id: 'lanterns-jg', title: 'Garden lanterns', at: [219, 113], d: 'jurong', giver: 'musang', kind: 'lanterns' },
  { id: 'ubin-loop', title: 'Island bike loop', at: [347, 119], d: 'pulau', giver: 'ayu', kind: 'ubin-loop' },
  { id: 'buoy-sprint', title: 'Buoy sprint', at: [158, 102], d: 'kallang', giver: 'biru', kind: 'buoy-sprint' },
];
/** Kallang's local tiles, as the story writes them */
const K = (lx: number, ly: number): [number, number] => ly < 14 ? [212 + lx, 82 + ly] : [148 + lx, 82 + ly];

/** each gig's steps (written in the old frame) and pay; `home` is the board's tile, already moved */
export function gig20Steps(kind: string, home: [number, number]): { steps: Step[]; reward: number } | null {
  const S = (steps: Step[], reward: number) => ({ steps: steps.map(mvStep), reward });
  // the board's own tile is already in the new frame, so steps that start there are added after the move
  const at = (st: Step[], reward: number, first?: Step) => { const r = S(st, reward); if (first) r.steps.unshift(first); return r; };
  switch (kind) {
    case 'mooncakes': return S([{ t: 'rounds', act: 'serve', item: 'mooncakes', what: 'box of mooncakes', drops: [[144, 30], [128, 25], [158, 15], [168, 21]], who: ['rabbit', 'hedgehog', 'goose', 'cat'], time: 92, label: 'Take a box of mooncakes to each neighbour waiting at the void decks' }], 70);
    case 'fares-tp': return at([{ t: 'fares', n: 2, label: 'Drive two Toa Payoh fares' }], 60, { t: 'ride', kind: 'tuktuk', near: home, label: 'Get in Uncle Kamal’s tuk-tuk' });
    case 'balloons': return S([{ t: 'rounds', act: 'serve', item: 'balloons', what: 'balloon', drops: [[138, 65], [165, 61], [183, 67], [197, 75], [143, 75]], who: ['rabbit', 'duck', 'tapir', 'civet', 'dog'], time: 120, label: 'Hand a balloon to each kid waiting round the bay' }], 80);
    case 'promenade': return S([{ t: 'race', ride: 'foot', rival: 'runner', pace: 0.72, marks: [[170, 67], [190, 67], [196, 74], [190, 67], [170, 67]], label: 'Beat the crow along the promenade, over the bridge and back' }], 70);
    case 'garlands': return S([{ t: 'rounds', act: 'drape', item: 'garland', what: 'garland', drops: [[219, 10], [230, 15], [245, 15], [251, 21], [228, 25]], time: 76, label: 'Drape a garland over each glowing doorway for the temple festival' }], 75);
    case 'batik': return S([{ t: 'pickup', at: [234, 55], item: 'g20-batik', label: 'Pick up the bolt of batik' }, { t: 'deliver', to: 'bussorah', time: 40, item: 'g20-batik', label: 'Take the batik to the tailor on Bussorah Street' }], 55);
    case 'beachballs': return S([{ t: 'collect', items: [[104, 121], [90, 119], [72, 122], [58, 119], [44, 121]], item: 'beach-ball', time: 75, label: 'Run along Siloso Beach and catch every runaway beach ball' }], 65);
    case 'potong': return S([{ t: 'rounds', act: 'serve', item: 'g20-potong', what: 'potong', drops: [[290, 11], [312, 11], [322, 22], [300, 26], [316, 34]], who: ['egret', 'pigeon', 'robin', 'rabbit', 'duck'], time: 92, label: 'Hand a potong ice cream to each shopper waiting along Orchard Road' }], 75);
    case 'laksa': return S([{ t: 'rounds', act: 'serve', item: 'g20-laksa', what: 'bowl of laksa', drops: [[282, 62], [296, 61], [307, 55], [292, 45]], who: ['robin', 'cat', 'egret', 'goose'], time: 64, label: 'Carry a bowl of laksa to each table waiting in Katong' }], 65);
    case 'kamcheng': return S([{ t: 'pickup', at: [289, 60], item: 'kamcheng', label: 'Pick up Auntie Rosie’s kamcheng' }, { t: 'deliver', to: 'mansion', time: 50, fragile: 6, item: 'kamcheng', label: 'Carry the kamcheng to the Peranakan mansion: gently!' }], 70);
    case 'luggage': return S([{ t: 'rounds', act: 'serve', item: 'suitcase', what: 'suitcase', drops: [[331, 8], [341, 10], [333, 37], [356, 36]], who: ['pigeon', 'egret', 'dog', 'robin'], time: 90, label: 'Hand each lost suitcase back to its traveller round the airport' }], 75);
    case 'croissants': return S([{ t: 'rounds', act: 'serve', item: 'g20-croissants', what: 'box of pastries', drops: [[258, 124], [276, 124], [282, 113], [270, 113]], who: ['squirrel', 'tabby', 'frog', 'rabbit'], time: 80, label: 'Take a box of pastries to each neighbour waiting round the estate' }], 65);
    case 'chweekueh': return S([{ t: 'pickup', at: [259, 103], item: 'g20-chweekueh', label: 'Pick up the plate of chwee kueh' }, { t: 'deliver', to: 'flats', time: 56, fragile: 6, item: 'g20-chweekueh', label: 'Carry the chwee kueh to the flats: steady, or they slide off' }], 60);
    case 'river-taxi': return S([{ t: 'ride', kind: 'boat', near: [303, 103], label: 'Jump in the bumboat at the steps by Read Bridge' }, { t: 'race', ride: 'boat', time: 70, marks: [[305, 103], [293, 105], [314, 106], [327, 104], [316, 105]], label: 'Steer the river taxi past every jetty marker' }], 75);
    case 'lanterns': return S([{ t: 'rounds', act: 'hang', item: 'moon-lantern', what: 'lantern', drops: [[206, 109], [208, 112], [200, 120], [222, 113], [210, 124]], time: 80, label: 'Hang a lantern on each empty hook round the Chinese Garden' }], 70);
    case 'ubin-loop': return S([{ t: 'ride', kind: 'bike', near: 'bikes-ubin', label: 'Take a bike from the rack (E)' }, { t: 'race', ride: 'bike', time: 60, marks: [[344, 117], [352, 117], [355, 113], [359, 106], [355, 108], [350, 113], [343, 113]], label: 'Ride every flag round the island loop' }], 70);
    case 'buoy-sprint': return S([{ t: 'goto', at: 'pontoon', label: 'Go down to the rowing club’s pontoon', ride: 'foot' }, { t: 'ride', kind: 'dragon', near: 'pontoon', label: 'Step into a dragon boat at the pontoon (E)' }, { t: 'race', ride: 'dragon', time: 90, marks: [K(11, 25), K(14, 32), K(13, 41), K(8, 37), K(3, 31), K(9, 27)], label: 'Paddle round the six buoys the other way (Space: surge)' }], 80);
  }
  return null;
}

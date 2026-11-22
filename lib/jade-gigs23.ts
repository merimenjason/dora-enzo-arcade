// Jade Street, the twenty-third pass: second helpings. The districts that had a single side gig get another, set by their
// own givers round their own landmarks, and chosen to play differently from the one already there: Master Ren's lion-dance
// dash round the temple, a mynah that steals Auntie Malar's jasmine and Mr Raju's Tekka sprint (Little India, which had
// the least to do), Puan Wangi's mural photo walk through Kampong Glam, Sergeant Helang's run to Fort Siloso, Ms Tiara's
// fallen light-up stars on Orchard Road, Pak Ubin's coast ride along Changi Beach, Kak Melati's satay round the Clarke Quay
// godowns, Dr Suria's pagoda run in the Chinese Garden, Uncle Belangkas's mangrove planting at Chek Jawa, Ms Tenuk's
// water station at the Sports Hub, Encik Kongkang's night count on the Night Safari trail and Auntie Ku's beach clean-up
// across the Southern Islands. Routes are hand-placed (old-frame tiles, moved once through the layout table, as the
// story's and the twentieth pass's are); timers come from each route's own path (tests/jade-twentythree.mjs). Appended after
// the twentieth pass's gigs in GIG_DEFS, so nothing earlier moves.
import { mvStep, type Step } from './jade-story.js';
import type { Gig20 } from './jade-gigs20.js';

/** the boards: `at` in the old frame (lib/jade-gigs.ts moves them as it does the rest) */
export const GIG23_DEFS: Gig20[] = [
  { id: 'lion-dash', title: 'Lion-dance dash', at: [17, 16], d: 'temple', giver: 'ren', kind: 'lion-dash' },
  { id: 'jasmine-myna', title: 'Jasmine thief', at: [236, 22], d: 'india', giver: 'malar', kind: 'jasmine-myna' },
  { id: 'tekka-sprint', title: 'Tekka sprint', at: [228, 21], d: 'india', giver: 'raju', kind: 'tekka-sprint' },
  { id: 'photo-walk', title: 'Mural photo walk', at: [241, 56], d: 'glam', giver: 'wangi', kind: 'photo-walk' },
  { id: 'siloso-run', title: 'Siloso run', at: [44, 110], d: 'resort', giver: 'helang', kind: 'siloso-run' },
  { id: 'stars-orchard', title: 'Fallen light-up stars', at: [300, 11], d: 'orchard', giver: 'tiara', kind: 'stars-orchard' },
  { id: 'coast-ride', title: 'Changi coast ride', at: [358, 79], d: 'changi', giver: 'ubin', kind: 'coast-ride' },
  { id: 'satay-quay', title: 'Satay by the river', at: [301, 100], d: 'quay', giver: 'melati', kind: 'satay-quay' },
  { id: 'pagoda-run', title: 'Pagoda run', at: [222, 106], d: 'jurong', giver: 'suria', kind: 'pagoda-run' },
  { id: 'mangroves', title: 'Mangrove planting', at: [356, 108], d: 'pulau', giver: 'belangkas', kind: 'mangroves' },
  { id: 'water-station', title: 'Water station', at: [184, 110], d: 'kallang', giver: 'tenuk', kind: 'water-station' },
  { id: 'night-count', title: 'Night trail count', at: [10, 122], d: 'mandai', giver: 'kongkang', kind: 'night-count' },
  { id: 'beach-clean', title: 'Island beach clean-up', at: [6, 139], d: 'islands', giver: 'ku', kind: 'beach-clean' },
];
/** the Southern Islands' local tiles (lib/jade-islands.ts islOld) */
const I = (lx: number, ly: number): [number, number] => [lx, 128 + ly];

export function gig23Steps(kind: string): { steps: Step[]; reward: number } | null {
  const S = (steps: Step[], reward: number) => ({ steps: steps.map(mvStep), reward });
  switch (kind) {
    case 'lion-dash': return S([{ t: 'race', ride: 'foot', rival: 'runner', skin: 'mac', pace: 0.64, time: 95, marks: [[19, 12], [19, 7], [35, 7], [42, 12], [42, 27], [29, 27], [16, 16]], label: 'Beat the macaque round the temple to the lion dance: up the steps, along the top, down Pagoda Street and back' }], 70);
    case 'jasmine-myna': return S([{ t: 'bag', at: [242, 22], loot: 'garland', time: 60, skin: 'myna', label: 'Knock the jasmine garland out of the mynah’s beak (shoot it, or dash when it swoops low)' }, { t: 'deliver', to: 'malar', time: 30, item: 'garland', label: 'Take the jasmine back to Auntie Malar’s stall' }], 70);
    case 'tekka-sprint': return S([{ t: 'race', ride: 'foot', rival: 'runner', skin: 'myna', pace: 0.7, time: 75, marks: [[227, 22], [227, 33], [240, 33], [244, 25], [244, 15], [236, 12], [228, 15]], label: 'Beat the mynah round Tekka: down to the hawker centre, across to the station and back up Serangoon Road' }], 70);
    case 'photo-walk': return S([{ t: 'rounds', act: 'photo', item: 'i-camera', what: 'mural', sights: ['g23-mural-a', 'g23-mural-b', 'g23-mural-c'], drops: [[229, 56], [236, 55], [250, 58], [256, 72], [233, 66]], time: 90, label: 'Photograph each mural round Kampong Glam for Puan Wangi’s guide' }], 70);
    case 'siloso-run': return S([{ t: 'race', ride: 'foot', rival: 'runner', skin: 'otter', pace: 0.7, time: 100, marks: [[48, 121], [70, 122], [88, 121], [70, 119], [46, 119], [40, 107]], label: 'Beat the otter along Siloso Beach and back up to Fort Siloso' }], 75);
    case 'stars-orchard': return S([{ t: 'collect', items: [[288, 11], [284, 22], [293, 26], [310, 25], [315, 11], [320, 22]], item: 'xmas-star', time: 90, label: 'Pick up every light-up star the wind blew off Orchard Road' }], 70);
    case 'coast-ride': return S([{ t: 'ride', kind: 'bike', near: [348, 81], label: 'Take the bike by the beach path (E)' }, { t: 'race', ride: 'bike', time: 80, marks: [[335, 81], [326, 85], [345, 88], [365, 88], [372, 81], [358, 79]], label: 'Ride the Changi Beach coast path through every marker' }], 70);
    case 'satay-quay': return S([{ t: 'rounds', act: 'serve', item: 'g23-satay', what: 'plate of satay', drops: [[293, 100], [308, 102], [320, 100], [327, 102], [300, 102]], who: ['cat', 'frog', 'squirrel', 'tabby', 'duck'], time: 100, label: 'Carry a plate of satay to each table along the river' }], 75);
    case 'pagoda-run': return S([{ t: 'race', ride: 'foot', rival: 'runner', pace: 0.7, time: 90, marks: [[200, 106], [199, 118], [200, 125], [215, 125], [222, 119], [222, 108]], label: 'Beat the crow round the Chinese Garden lake, past the pagoda and back' }], 75);
    case 'mangroves': return S([{ t: 'rounds', act: 'plant', item: 'g23-seedling', what: 'mangrove seedling', drops: [[354, 106], [351, 108], [356, 111], [351, 112], [359, 113]], time: 65, label: 'Plant a mangrove seedling in each patch of mud round Chek Jawa' }], 75);
    case 'water-station': return S([{ t: 'rounds', act: 'serve', item: 'g23-cup', what: 'cup of water', drops: [[170, 110], [170, 121], [188, 124], [193, 114]], who: ['fanbear', 'fanotter', 'fankancil', 'rabbit'], time: 80, label: 'Hand a cup of water to each runner round the stadium' }], 70);
    case 'night-count': return S([{ t: 'torch', route: [[9, 124], [15, 126], [20, 127], [13, 122]], beasts: [{ at: [12, 125], kind: 'porc' }, { at: [18, 127], kind: 'squir' }], time: 120, label: 'Walk the night trail by torch and count each animal: creep (hold Shift) past them so they stay asleep' }], 75);
    case 'beach-clean': return S([{ t: 'collect', items: [I(1, 9), I(4, 18), I(13, 22), I(36, 6), I(41, 17)], item: 'g23-flotsam', time: 150, label: 'Clear the washed-up nets and bottles off the beaches on Kusu, the Sisters and Lazarus' }], 80);
  }
  return null;
}

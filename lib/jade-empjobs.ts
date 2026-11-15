// Jade Street (tenth pass): the empire jobs, short jobs about the properties you own. Each is offered by the
// properties of the kinds it lists (once a night per job), built for the property it was taken at by
// lib/jade-empire.ts (`empireJob`), and run by the same job runner as everything else. The list here is the only
// source of how many there are (jobCounts in lib/jade-story.ts counts them). Pure data.
import type { PropKind } from './jade-props.js';

export type EmpJobDef = { id: string; title: string; giver: string; kinds: PropKind[]; rank: number; blurb: string; reward: number;
  /** the takings boost a win gives the property: a multiplier for some nights */
  boost: [number, number] };
export const EMPIRE_JOBS: EmpJobDef[] = [
  { id: 'supplier', title: 'Supplier Deal', giver: 'huat', kinds: ['food', 'bar'], rank: 1, reward: 120, boost: [1.25, 3],
    blurb: 'Ah Huat has fresh stock at the market at a good price, if you fetch it yourself and get it to the kitchen before it spoils.' },
  { id: 'inspector', title: 'Health Inspector', giver: 'siew', kinds: ['food', 'bar'], rank: 1, reward: 140, boost: [1.15, 5],
    blurb: 'Inspector Siew is on her way. Fine city: pick up every bit of litter round the front before she arrives, and the place gets an A.' },
  { id: 'pricewar', title: 'Price War', giver: 'hoot', kinds: ['food', 'shop', 'shophouse', 'bar'], rank: 2, reward: 200, boost: [1.3, 3],
    blurb: 'Towkay Hoot is undercutting you with fake half-price boards. Tail his runner to his store and swap the boards for honest ones.' },
  { id: 'taxi', title: 'Taxi Rush', giver: 'kamal', kinds: ['taxi'], rank: 1, reward: 150, boost: [1.25, 3],
    blurb: 'The MRT is down for the night and the queue at the stand is round the block. Take the company tuk-tuk and drive three fares.' },
  { id: 'tour', title: 'River Tour', giver: 'kiri', kinds: ['bumboat', 'kayak'], rank: 1, reward: 150, boost: [1.25, 3],
    blurb: 'A boatload of tourists wants the lantern tour. Steer through every gate before they get bored.' },
  { id: 'karaoke', title: 'Karaoke Night', giver: 'lily', kinds: ['karaoke', 'bar'], rank: 1, reward: 160, boost: [1.3, 3],
    blurb: 'Lily Sparkle is singing tonight, but her lucky microphone is at the getai stage, and the crows have heard there is a crowd.' },
];
export const EMPIRE_JOB_IDS = EMPIRE_JOBS.map(j => j.id);
export const EMPIRE_JOB = Object.fromEntries(EMPIRE_JOBS.map(j => [j.id, j])) as Record<string, EmpJobDef>;

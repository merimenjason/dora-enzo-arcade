// Cloudpop: the hand-written rounds. Each round is a list of groups "count kind[.mods] gap [@start]": count puffs of
// a kind, `gap` seconds apart, starting `start` seconds into the round. Mods: n night (hidden), f fog (regrows),
// x fortified. Easy ends after round 40, Medium after 60, Hard after 80; Endless Storm runs 6 to 100. Freeplay after
// a win, and rounds past 100, are generated from a seed with the same building blocks.
import { PUFFS, layers, type PuffKind } from './cloudpop-puffs.js';
import { rng } from './cloudpop-rng.js';

export interface Group { kind: PuffKind; count: number; gap: number; start: number; night: boolean; fog: boolean; fort: boolean }

const R: string[] = [
  /* 1 */ '20 wisp 0.9',
  /* 2 */ '30 wisp 0.7',
  /* 3 */ '20 wisp 0.6; 6 drizzle 0.9 @6',
  /* 4 */ '30 wisp 0.5; 15 drizzle 0.7 @4',
  /* 5 */ '10 wisp 0.6; 25 drizzle 0.6 @3',
  /* 6 */ '15 wisp 0.5; 15 drizzle 0.5 @2; 5 shower 1 @8',
  /* 7 */ '20 wisp 0.4; 20 drizzle 0.5 @2; 6 shower 0.9 @8',
  /* 8 */ '10 wisp 0.4; 20 drizzle 0.4 @2; 14 shower 0.7 @6',
  /* 9 */ '30 shower 0.6',
  /* 10 */ '100 drizzle 0.22',
  /* 11 */ '12 wisp 0.4; 10 drizzle 0.5; 12 shower 0.6 @4; 2 squall 1.2 @10',
  /* 12 */ '15 drizzle 0.5; 10 shower 0.6 @3; 5 squall 1 @8',
  /* 13 */ '50 drizzle 0.35; 23 shower 0.5 @6',
  /* 14 */ '40 wisp 0.3; 20 drizzle 0.4 @2; 15 shower 0.5 @6; 8 squall 0.8 @11; 4 gale 1.2 @16',
  /* 15 */ '20 wisp 0.4; 15 shower 0.5 @3; 12 squall 0.6 @8; 5 gale 0.9 @14',
  /* 16 */ '20 shower 0.35; 8 squall 0.6 @5',
  /* 17 */ '8 squall.f 0.9',
  /* 18 */ '80 shower 0.25',
  /* 19 */ '10 shower 0.4; 4 squall 0.8 @3; 5 squall.f 0.9 @6; 7 gale 0.8 @10',
  /* 20 */ '6 hail 1.6',
  /* 21 */ '14 gale 0.5; 8 squall 0.6 @4',
  /* 22 */ '16 rumble 0.9',
  /* 23 */ '7 rumble 0.9; 7 frost 0.9 @4',
  /* 24 */ '1 shower.n 1; 20 squall 0.4 @3',
  /* 25 */ '25 gale.f 0.5; 10 squall 0.5 @6',
  /* 26 */ '5 tempest 1.2; 10 gale 0.4 @4',
  /* 27 */ '60 drizzle 0.2; 45 shower 0.25 @3; 45 squall 0.3 @8; 45 gale 0.35 @14',
  /* 28 */ '6 hail.x 1.6',
  /* 29 */ '12 squall 0.4; 12 gale.f 0.5 @4; 4 rumble 0.8 @9',
  /* 30 */ '9 hail 1.1; 6 tempest 1.2 @6',
  /* 31 */ '8 tempest 0.9; 8 rumble.f 0.8 @5',
  /* 32 */ '25 rumble 0.5; 28 frost 0.5 @5; 8 hail 0.9 @12',
  /* 33 */ '20 shower.n 0.5; 13 squall.n 0.5 @6',
  /* 34 */ '160 squall 0.12; 6 tempest 1 @10',
  /* 35 */ '35 gale 0.25; 5 cloudburst 1.2 @6',
  /* 36 */ '81 gale 0.15',
  /* 37 */ '7 tempest 0.8; 15 frost 0.5 @3; 10 squall.n 0.5 @8; 6 rumble.f 0.7 @12',
  /* 38 */ '4 sleet 1.6; 30 gale 0.3 @6',
  /* 39 */ '10 tempest 0.6; 10 cloudburst 0.8 @6; 18 rumble 0.4 @12',
  /* 40 */ '1 thunderhead 1; 20 gale 0.4 @8',
  /* 41 */ '6 tempest 0.7; 8 sleet 1.1 @5',
  /* 42 */ '6 cloudburst.f 0.9; 4 sleet 1.2 @6',
  /* 43 */ '1 thunderhead 1; 5 sleet 1.2 @9',
  /* 44 */ '23 tempest 0.5',
  /* 45 */ '10 sleet.f 0.8; 20 cloudburst 0.4 @6',
  /* 46 */ '2 thunderhead 9; 10 squall.n 0.5 @3',
  /* 47 */ '70 frost 0.15; 12 cloudburst.n 0.5 @8',
  /* 48 */ '12 sleet 0.6; 15 rumble.f 0.3 @3',
  /* 49 */ '200 squall 0.08; 20 sleet 0.6 @12',
  /* 50 */ '2 thunderhead 3; 8 sleet 0.8 @2; 20 cloudburst 0.4 @8',
  /* 51 */ '25 sleet.f 0.6',
  /* 52 */ '10 sleet.x 0.8; 25 cloudburst 0.3 @4',
  /* 53 */ '70 squall.n 0.1; 10 tempest.n 0.6 @6',
  /* 54 */ '3 thunderhead 3; 20 sleet 0.6 @6',
  /* 55 */ '30 sleet.x 0.5',
  /* 56 */ '2 thunderhead.x 7; 1 thunderhead 1 @15',
  /* 57 */ '36 cloudburst.f 0.3; 8 sleet.x 0.7 @6',
  /* 58 */ '5 thunderhead 3; 26 sleet 0.55 @4',
  /* 59 */ '50 sleet.f 0.35',
  /* 60 */ '1 anvilhead 1; 10 sleet.x 0.8 @6',
  /* 61 */ '5 thunderhead 2; 30 sleet.x 0.4 @5',
  /* 62 */ '1 anvilhead 1; 15 cloudburst.n 0.3 @3; 8 thunderhead 1.5 @8',
  /* 63 */ '60 sleet.f 0.25',
  /* 64 */ '8 thunderhead.x 1.6',
  /* 65 */ '1 whirlwind 1; 2 anvilhead 6 @4',
  /* 66 */ '3 whirlwind 3; 20 sleet.nx 0.4 @4',
  /* 67 */ '14 thunderhead 1.2; 40 sleet 0.3 @4',
  /* 68 */ '2 anvilhead 4; 6 thunderhead.x 1.5 @6',
  /* 69 */ '90 sleet.f 0.18',
  /* 70 */ '6 whirlwind 2; 2 anvilhead.x 6 @6',
  /* 71 */ '20 thunderhead 0.9',
  /* 72 */ '3 anvilhead 3; 40 cloudburst.nf 0.15 @3',
  /* 73 */ '10 whirlwind 1.5',
  /* 74 */ '4 anvilhead.x 3; 60 sleet.x 0.2 @4',
  /* 75 */ '6 anvilhead 2.5; 10 thunderhead.x 1 @4',
  /* 76 */ '12 whirlwind 1.2; 100 sleet 0.12 @5',
  /* 77 */ '4 anvilhead.x 2; 20 thunderhead 0.6 @4',
  /* 78 */ '120 sleet.nfx 0.08; 8 anvilhead 2 @6',
  /* 79 */ '8 anvilhead.x 1.6; 12 whirlwind 1 @6',
  /* 80 */ '1 stormcrown 1; 6 anvilhead 3 @10',
  /* 81 */ '2 stormcrown 8',
  /* 82 */ '30 thunderhead.x 0.5; 20 whirlwind 0.8 @5',
  /* 83 */ '10 anvilhead.x 1.2',
  /* 84 */ '2 stormcrown 6; 10 anvilhead 1.5 @5',
  /* 85 */ '300 sleet.nfx 0.04',
  /* 86 */ '20 whirlwind 0.5; 8 anvilhead.x 1 @4',
  /* 87 */ '3 stormcrown 5',
  /* 88 */ '12 anvilhead.x 0.8; 40 thunderhead 0.3 @4',
  /* 89 */ '30 whirlwind 0.4; 2 stormcrown.x 6 @5',
  /* 90 */ '4 stormcrown 4; 20 anvilhead 0.8 @5',
  /* 91 */ '40 whirlwind 0.3; 300 sleet.x 0.04 @3',
  /* 92 */ '3 stormcrown.x 4; 60 thunderhead.x 0.2 @4',
  /* 93 */ '30 anvilhead 0.4',
  /* 94 */ '5 stormcrown 3; 30 whirlwind 0.3 @4',
  /* 95 */ '20 anvilhead.x 0.5; 400 sleet.nfx 0.03 @3',
  /* 96 */ '6 stormcrown.x 2.5',
  /* 97 */ '60 whirlwind 0.2; 30 anvilhead 0.3 @4',
  /* 98 */ '8 stormcrown 2',
  /* 99 */ '40 anvilhead.x 0.3; 10 stormcrown 1.5 @4',
  /* 100 */ '1 huracan 1; 2 stormcrown.x 8 @12',
];
export const AUTHORED = R.length;

export function parseRound(src: string): Group[] {
  return src.split(';').map(s => s.trim()).filter(Boolean).map(g => {
    const [cnt, kindMods, gap, at] = g.split(/\s+/);
    const [kind, mods = ''] = kindMods.split('.');
    if (!(kind in PUFFS)) throw new Error('bad puff ' + kind);
    return {
      kind: kind as PuffKind, count: +cnt, gap: +gap, start: at ? +at.slice(1) : 0,
      night: mods.includes('n'), fog: mods.includes('f'), fort: mods.includes('x'),
    };
  });
}

/** freeplay rounds past the authored ones: a seeded mix whose layers grow each round */
function freeplay(n: number, seed: number): Group[] {
  const r = rng(seed * 7919 + n * 104729);
  const pool: PuffKind[] = ['sleet', 'cloudburst', 'thunderhead', 'whirlwind', 'anvilhead', 'stormcrown'];
  const out: Group[] = [];
  const kinds = 2 + Math.floor(r() * 2);
  for (let i = 0; i < kinds; i++) {
    const kind = pool[Math.min(pool.length - 1, Math.floor(r() * pool.length * Math.min(1, 0.55 + (n - 100) / 60)))];
    const big = PUFFS[kind].boss;
    const count = Math.max(1, Math.round((big ? 2 + (n - 95) / 4 : 40 + (n - 95) * 4) * (0.6 + r() * 0.6)));
    out.push({ kind, count, gap: big ? 1.5 : 0.08, start: i * 4, night: r() < 0.4, fog: !big && r() < 0.5, fort: r() < 0.5 });
  }
  if (n % 10 === 0) out.push({ kind: 'huracan', count: Math.floor((n - 90) / 10), gap: 6, start: 8, night: false, fog: false, fort: n >= 120 });
  return out;
}

export function roundGroups(n: number, seed = 1): Group[] {
  if (n >= 1 && n <= R.length) return parseRound(R[n - 1]);
  return freeplay(n, seed);
}

/** boss toughness past round 80 (2% a round), and speed for freeplay */
export function bossScale(n: number): number { return n <= 80 ? 1 : 1 + (n - 80) * 0.02 + (n > 100 ? (n - 100) * 0.03 : 0); }
export function speedScale(n: number): number { return n <= 80 ? 1 : n <= 100 ? 1 + (n - 80) * 0.01 : 1.2 + (n - 100) * 0.02; }
/** cash per layer popped falls off in late rounds, so income towers matter */
export function popCash(n: number): number { return n <= 50 ? 1 : n <= 60 ? 0.5 : n <= 80 ? 0.3 : n <= 100 ? 0.15 : 0.05; }
export const roundBonus = (n: number) => 100 + n;

/** total layers in a round: the difficulty curve the tests check */
export function roundLayers(n: number, seed = 1): number {
  let t = 0;
  for (const g of roundGroups(n, seed)) t += g.count * layers(g.kind, g.fort, bossScale(n));
  return t;
}
/** the seconds the round takes to send everything */
export function roundLength(n: number, seed = 1): number {
  return Math.max(...roundGroups(n, seed).map(g => g.start + g.gap * (g.count - 1)));
}
/** a short description of what is coming, for the next-round preview */
export function preview(n: number, seed = 1): { kind: PuffKind; count: number; night: boolean; fog: boolean; fort: boolean }[] {
  return roundGroups(n, seed).map(g => ({ kind: g.kind, count: g.count, night: g.night, fog: g.fog, fort: g.fort }));
}

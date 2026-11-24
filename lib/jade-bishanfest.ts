// Jade Street (twenty-sixth pass): Bishan and Ang Mo Kio's small pleasures, out of a job. Sit in at the Ang Mo Kio
// void deck's stone chess table for a blitz game with the uncles (its own two poses: chin on fist thinking, then the
// piece slapped down), and slide down Bishan-Ang Mo Kio Park's grassy bank on a flattened carton, the way every heartland
// kid has (its own pose: leaning back, arms up, the hero carried down the slope). Each counts towards a trophy and the
// first of each a night is a little Bishan reputation. No DOM; deterministic: the games go round a list.
import { T, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import type { World, Near } from './jade-game.js';

export type BishanState = { night: number; once: Set<string>; told: boolean; games: number; slides: number };
export const newBishan = (): BishanState => ({ night: -1, once: new Set(), told: false, games: 0, slides: 0 });
/** how the blitz games at the void deck go, in turn: [won, what the uncles say] */
export const GAMES: [boolean, string][] = [
  [true, 'Checkmate! The uncles all lean in. “Wah, who teach you? Again, again.”'],
  [false, 'Uncle Tan forks your rook and your queen at once. “Young people, always rushing.”'],
  [true, 'You win with a pawn on the last row. Uncle Lim pays you in kacang puteh.'],
  [false, 'Stalemate… no, Uncle Ong finds a mate in two. Everybody has an opinion about it.'],
  [true, 'A smothered mate with the knight! The kopi uncle claps. The bird uncle’s merbok sings.'],
];
/** what you see sliding down the grassy bank, in turn */
export const SLIDE_SIGHTS = ['the river flashing past at the bottom', 'a family of otters looking up at you, unimpressed', 'the AMK blocks tipping over the top of the bank',
  'a kingfisher bolting off a reed', 'the sky, mostly, and then grass'];
/** how long a chess game takes (seconds: thinking, then the move) and a slide down the bank */
export const CHESS_S = 2.8, SLIDE_S = 1.5;

const onBishan = (w: World) => !!w.c.bishan && w.open.has('bishan');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'bishan';

export function bishanStep(w: World, dt: number) {
  const k = w.bishan; void dt;
  if (k.night !== w.s.night) { k.night = w.s.night; k.once.clear(); }
  // a slide down the bank carries you from the top to the bottom while its pose plays
  const B = w.c.bishan, a = w.p.act;
  if (B && a && a.n === 'bankslide') { const f = Math.min(1, a.t / a.dur), e = f * f; w.p.b.x = B.bank[0][0] + (B.bank[1][0] - B.bank[0][0]) * e; w.p.b.y = B.bank[0][1] + (B.bank[1][1] - B.bank[0][1]) * e; }
  if (!onBishan(w) || w.run || !here(w, w.p.x, w.p.y)) return;
  if (!k.told) { k.told = true; w.say('Bishan and Ang Mo Kio! Play blitz chess with the uncles at the AMK void deck (E), slide down the park’s grassy bank on a carton (E), and watch for the otters on the river.', 'good'); }
}
export function bishanNear(w: World, cand: (n: Near, r: number) => void) {
  const B = w.c.bishan; if (!B || !onBishan(w) || w.p.ride || w.run) return;
  cand({ kind: 'bishan', id: 'chess', label: 'Play blitz chess with the void-deck uncles', x: B.chess[0] - 46, y: B.chess[1] + 12 }, 80);
  cand({ kind: 'bishan', id: 'slide', label: 'Slide down the grassy bank on a carton', x: B.bank[0][0], y: B.bank[0][1] }, 80);
}
export function bishanAct(w: World, id: string) {
  const p = w.p, s = w.s, k = w.bishan, B = w.c.bishan; p.b.speed = 0;
  const rep = (what: string) => { if (!k.once.has(what)) { k.once.add(what); addRep(s, 'bishan', 1); } };
  if (id === 'chess' && B) {
    p.face = 'side'; p.b.x = B.chess[0] - 46; p.b.y = B.chess[1] + 12;
    p.act = { n: 'blitz', t: 0, dur: CHESS_S, then: () => {
      s.stats.blitz++; rep('chess');
      const [won, say] = GAMES[k.games % GAMES.length]; k.games++;
      if (won) s.stats.blitzWins++;
      w.say(say, won ? 'good' : 'bad');
    } };
    return;
  }
  if (id === 'slide' && B) {
    p.face = 'down'; p.b.x = B.bank[0][0]; p.b.y = B.bank[0][1];
    w.fx.push({ t: 'hop', x: p.b.x, y: p.b.y });
    p.act = { n: 'bankslide', t: 0, dur: SLIDE_S, then: () => {
      p.b.x = B.bank[1][0]; p.b.y = B.bank[1][1];
      s.stats.bankslides++; rep('slide');
      w.fx.push({ t: 'land', x: p.b.x, y: p.b.y, k: 0.5 });
      const v = SLIDE_SIGHTS[k.slides % SLIDE_SIGHTS.length]; k.slides++;
      w.say(`Wheee! Down the bank: ${v}.`, 'good');
    } };
  }
}

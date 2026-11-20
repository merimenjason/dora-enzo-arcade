// Jade Street (seventeenth pass): Pulau Ubin's small pleasures and its wild boars, out of a job. Shake a durian tree,
// catch what falls and eat it under the tree; climb Jejawi Tower and look out over Chek Jawa through the binoculars. And
// the Tusker Boys (wild boars, cartoon and harmless): a few root about at their digs; walk up and shoo one off (E) and it
// bolts, leaving whatever it rooted up. Get too close to one on a dirt track and it paws the ground, then charges
// straight down the track at you: step off the line. A boar that misses (or bowls you over) ends up dizzy for a moment,
// and E then catches it. Each has its own animation. No DOM; deterministic (the world's own generator).
import { T, W, districtAt } from './jade-city.js';
import { addRep } from './jade-save.js';
import { dist } from './jade-rng.js';
import { nearestFree } from './jade-nav.js';
import type { World, Near } from './jade-game.js';

export type Boar = { x: number; y: number; h: number; st: 'root' | 'paw' | 'charge' | 'dizzy' | 'flee' | 'gone'; t: number; dig: number; vx: number; vy: number };
export type UbinState = { night: number; once: Set<string>; boars: Boar[]; cd: number; spied: number; told: boolean };
export const newUbin = (): UbinState => ({ night: -1, once: new Set(), boars: [], cd: 6, spied: 0, told: false });

/** how many boars root about at once, how near one notices you on a track (world units), how long it paws first (a
 * human's reaction time and then some; longer on Assist), its charge speed and how long a charge runs */
export const BOARS = 3, NOTICE = 300, PAW_S = 1.1, PAW_ASSIST = 1.6, CHARGE_V = 430, CHARGE_S = 1.2, DIZZY_S = 2.6, GONE_S = 35;
/** what the binoculars show from Jejawi Tower, in turn */
export const SIGHTS = ['a pair of oriental pied hornbills in a fig tree', 'a grey heron stalking the seagrass', 'a horseshoe crab trundling over the flats',
  'the kelong off the north shore, lamps lit', 'otters tumbling along the shore', 'the Johor Strait, flat as glass under the moon'];
/** what a boar leaves at its dig when you shoo it off */
const FINDS: [string, number][] = [['a handful of old coins', 6], ['a rusty kerosene lamp (you sell it to the provision shop)', 5], ['a buried tin of sweets', 4], ['a lost bicycle bell (Kak Ayu tips you)', 5], ['a granite chip that sparkles (a collector buys it)', 4]];

const onUbin = (w: World) => !!w.c.ubin && w.open.has('pulau');
const here = (w: World, x: number, y: number) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'pulau';
const assist = (w: World) => w.s.settings.assist;

export function ubinStep(w: World, dt: number) {
  const u = w.ubin, U = w.c.ubin; if (!U) return;
  if (u.night !== w.s.night) { u.night = w.s.night; u.once.clear(); u.boars = []; }
  if (!onUbin(w) || w.run || !here(w, w.p.x, w.p.y)) { if (w.run) u.boars = []; return; }
  if (!u.told) { u.told = true; w.say('Wild boars root about on Ubin! Shoo one off its dig (E) for whatever it dug up. If one paws the ground at you, step off its line!', 'good'); }
  // keep three at their digs (a shooed one comes back after a while, at another dig)
  while (u.boars.length < BOARS) {
    const used = new Set(u.boars.map(b => b.dig)), free = U.digs.map((_, i) => i).filter(i => !used.has(i));
    const dig = free[Math.floor(w.R() * free.length)] ?? 0, [x, y] = U.digs[dig];
    u.boars.push({ x, y, h: 0, st: 'root', t: w.R() * 2, dig, vx: 0, vy: 0 });
  }
  u.cd -= dt;
  const p = w.p;
  for (const b of u.boars) {
    b.t += dt;
    switch (b.st) {
      case 'root': {
        // a boar near you, with you along a straight run of track from it, paws the ground (one at a time, now and then)
        const d = dist(b.x, b.y, p.x, p.y);
        if (u.cd <= 0 && !p.ride && !p.act && d < NOTICE && d > 90 && onTrackLine(w, b.x, b.y, p.x, p.y)) { b.st = 'paw'; b.t = 0; b.h = Math.atan2(p.y - b.y, p.x - b.x); u.cd = 9 + w.R() * 6; w.fx.push({ t: 'boar-snort', x: b.x, y: b.y }); }
        break;
      }
      case 'paw': if (b.t >= (assist(w) ? PAW_ASSIST : PAW_S)) { b.st = 'charge'; b.t = 0; b.vx = Math.cos(b.h) * CHARGE_V * (assist(w) ? 0.82 : 1); b.vy = Math.sin(b.h) * CHARGE_V * (assist(w) ? 0.82 : 1); } break;
      case 'charge': {
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, tx = Math.floor(nx / T), ty = Math.floor(ny / T);
        const blocked = w.c.solid[ty * W + tx] !== 0;
        if (!blocked) { b.x = nx; b.y = ny; }
        if (dist(b.x, b.y, p.x, p.y) < 36 && !p.ride) {
          // bowled over: a tumble, no harm done
          p.b.speed = 0; p.b.x += b.vx * 0.12; p.b.y += b.vy * 0.12; p.act = { n: 'tumble', t: 0, dur: 0.9 };
          w.fx.push({ t: 'boar-bump', x: p.x, y: p.y }); w.say('Oof! Bowled over by a Tusker Boy. Next time, step off its line!', 'bad');
          b.st = 'dizzy'; b.t = 0;
        } else if (blocked || b.t >= CHARGE_S) { b.st = 'dizzy'; b.t = 0; w.fx.push({ t: 'boar-miss', x: b.x, y: b.y }); }
        break;
      }
      case 'dizzy': if (b.t >= DIZZY_S) flee(w, b); break;
      case 'flee': b.x += b.vx * dt; b.y += b.vy * dt; if (b.t > 2.2) { b.st = 'gone'; b.t = 0; } break;
      case 'gone': if (b.t > GONE_S) { const i = u.boars.indexOf(b); u.boars.splice(i, 1); } break;
    }
  }
}
/** is (x1, y1) along a straight run of open ground from (x0, y0), both on a track: the line a boar charges down */
function onTrackLine(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const U = w.c.ubin!; return U.tracks.some(([a, b]) => {
    const along = (x: number, y: number) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / (L * L); const qx = a[0] + (b[0] - a[0]) * k, qy = a[1] + (b[1] - a[1]) * k; return k > -0.05 && k < 1.05 && Math.hypot(x - qx, y - qy) < T * 1.6; };
    return along(x0, y0) && along(x1, y1);
  });
}
function flee(w: World, b: Boar) {
  const a = Math.atan2(b.y - w.p.y, b.x - w.p.x); b.st = 'flee'; b.t = 0; b.vx = Math.cos(a) * 260; b.vy = Math.sin(a) * 260;
  const [x, y] = nearestFree(w.c, 'walk', b.x + b.vx * 2, b.y + b.vy * 2, w.open, 3); b.vx = (x - b.x) / 2.2; b.vy = (y - b.y) / 2.2;
}

export function ubinNear(w: World, cand: (n: Near, r: number) => void) {
  const U = w.c.ubin, u = w.ubin; if (!U || !onUbin(w) || w.p.ride) return;
  for (const [x, y] of U.durians) cand({ kind: 'ubin', id: 'durian', label: 'Shake the durian tree', x, y: y + 30 }, 74);
  cand({ kind: 'ubin', id: 'spy', label: 'Climb Jejawi Tower and look out', x: U.tower[0], y: U.tower[1] + 24 }, 80);
  for (const b of u.boars) {
    if (b.st === 'root') cand({ kind: 'ubin', id: 'shoo:' + u.boars.indexOf(b), label: 'Shoo the boar off its dig', x: b.x, y: b.y }, 80);
    if (b.st === 'dizzy') cand({ kind: 'ubin', id: 'grab:' + u.boars.indexOf(b), label: 'Catch the dizzy boar!', x: b.x, y: b.y }, 90);
  }
}
export function ubinAct(w: World, id: string) {
  const p = w.p, s = w.s, u = w.ubin; p.face = 'down'; p.b.speed = 0;
  const [what, n] = id.split(':'), b = u.boars[+n];
  if (what === 'durian') {
    p.face = 'up';
    p.act = { n: 'tree-shake', t: 0, dur: 1.2, then: () => {
      w.fx.push({ t: 'durian-drop', x: p.x, y: p.y - 40 });
      p.act = { n: 'catch', t: 0, dur: 0.9, then: () => {
        p.act = { n: 'eat-durian', t: 0, dur: 2.2, then: () => {
          s.stats.durians++; w.fx.push({ t: 'good-deed' });
          if (!u.once.has('durian')) { u.once.add('durian'); addRep(s, 'pulau', 1); }
          w.say(s.stats.durians === 1 ? 'Caught it! Creamy, bitter-sweet, a little boozy: a proper kampong durian. Shiok!' : `Another durian, straight off the tree (${s.stats.durians} so far)`, 'good');
        } };
      } };
    } };
    return;
  }
  if (what === 'spy') {
    p.face = 'up';
    p.act = { n: 'spy', t: 0, dur: 2.8, then: () => {
      s.stats.spies++; const sight = SIGHTS[u.spied++ % SIGHTS.length];
      if (!u.once.has('spy')) { u.once.add('spy'); addRep(s, 'pulau', 1); }
      w.say(`From the top of Jejawi Tower: ${sight}.`, 'good');
    } };
    return;
  }
  if (what === 'shoo' && b && b.st === 'root') {
    p.face = 'side'; p.flip = b.x < p.x;
    p.act = { n: 'shoo', t: 0, dur: 0.5, then: () => {
      if (b.st !== 'root') return;
      const [find, coins] = FINDS[(b.dig + s.night) % FINDS.length];
      flee(w, b); s.cash += coins; s.stats.digs++; w.fx.push({ t: 'boar-flee', x: b.x, y: b.y });
      w.say(`Shoo! The boar bolts, leaving ${find}. +${coins} coins`, 'good');
    } };
    return;
  }
  if (what === 'grab' && b && b.st === 'dizzy') {
    p.act = { n: 'barge', t: 0, dur: 0.5, then: () => {
      if (b.st !== 'dizzy') return;
      s.stats.boars++; s.cash += 8; b.st = 'gone'; b.t = 0; w.fx.push({ t: 'boar-caught', x: b.x, y: b.y });
      w.say(s.stats.boars === 1 ? 'Got him! The Tusker Boy squeals, pays an 8-coin “sorry” and trots off home.' : `Another Tusker Boy caught (${s.stats.boars}). +8 coins`, 'good');
    } };
  }
}

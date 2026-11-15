// Jade Street: the two cheeky rival gangs of the Singapore streets, each with its own turf and its own street event
// (the Kaypoh Crows, the story's thieves, are in lib/jade-story.ts). The Riverside Romp, a family of smooth-coated
// otters led by Ma Sleek, smuggle crates off the Boat Quay and Tanjong Pagar banks and slip away into the water. The
// Bukit Bunch, Big Kow's mob of macaques, snatch bags and buns at the hawker centre and the void deck and scamper for
// the temple park. Gadgets work on each in their own way: an otter can't resist a soap bubble (it stops to play) and
// is too slippery for paint; a macaque grabs a sticky-rice ball (or a banana from the mama shop) and sits down to
// munch, and a popper or confetti makes it leap and drop what it took, but it dodges a dash. On the island the otters
// work the bay front too, the macaques the Toa Payoh void decks, and a third gang joins them: the Longkang Lizards,
// Lord Lepak's water monitors, who lounge in the storm drain, pinch snacks and slide back into the longkang. A lizard
// slips on a soap bubble and is too lazy to dodge, but paint just makes it blink and it flops down to sunbathe (lepak)
// when it is far from you. Each gang has a hideout on the island (c.isle.hideouts). Never menacing: caught, they just
// look sheepish. Over the Rochor River a fourth gang works Little India, Kampong Glam and Sentosa: the Kecoh Mynahs,
// Boss Bising's Javan mynahs in mustard polka-dot scarves. They snatch kuih and garlands, hop-fly in short bursts over
// whatever is in the way, and copy every sound they hear (a phone, a whistle, your partner's voice), which makes you
// cover your ears. A soap bubble sets one bobbing after it, paint makes it stop to preen, a rice ball is lunch, a
// popper scatters the flock (they drop what they took), and E shoos one in reach. Caught, a mynah just looks
// embarrassed. No DOM; seeded.
import { T, W, H, S, districtAt, type District } from './jade-city.js';
import { drive, type Body } from './jade-move.js';
import { downhill, nearestFree } from './jade-nav.js';
import { dist } from './jade-rng.js';
import { addRep } from './jade-save.js';
import { pedTile } from './jade-folk.js';
import { text } from './jade-phone.js';
import { bark, cheer } from './jade-sg.js';
import type { World, Near } from './jade-game.js';

export type GangKind = 'otters' | 'macaques' | 'lizards' | 'mynahs';
export const GANG = {
  otters: { name: 'the Riverside Romp', boss: 'sleek', turf: ['canal', 'docks', 'bay'] as District[], loot: 'crate', lines: ['Hehe! Finders keepers!', 'Wheee, into the river!', 'Mama Sleek says hi!'], caught: ['Aww, no fair!', 'Okay okay, take it back lah.'] },
  macaques: { name: 'the Bukit Bunch', boss: 'kow', turf: ['market', 'temple', 'heartland'] as District[], loot: 'bag', lines: ['Ooh ooh! Mine now!', 'Bun! Bun! Bun!', 'Big Kow will be so proud!'], caught: ['Ooh. Paiseh.', 'Fine lah, have it back.'] },
  lizards: { name: 'the Longkang Lizards', boss: 'lepak', turf: ['heartland', 'bay'] as District[], loot: 'snack', lines: ['Sssnacks!', 'Lepak time, hehe.', 'Back to the longkang!'], caught: ['Aiyah. So tiring.', 'Okay, okay. Can lie down now?'] },
  mynahs: { name: 'the Kecoh Mynahs', boss: 'bising', turf: ['india', 'glam', 'resort'] as District[], loot: 'kuih', lines: ['Kecoh! Kecoh!', 'Ring ring! Hello? Hehe!', 'Mine, mine, mine!'], caught: ['Oops. Paiseh.', 'Okay lah. Here, take back.'] },
};
export type MobState = 'run' | 'play' | 'munch' | 'leap' | 'dizzy' | 'netted' | 'swim' | 'lepak' | 'preen' | 'gone';
export type Mob = { id: number; b: Body; has: boolean; st: MobState; t: number; goal: [number, number] | null; anim: number; slip?: number;
  /** a mynah: seconds left of a hop-flight (it flies straight over whatever is in the way), and of a mimicked sound */
  fly?: number; sing?: number };
export type GangEvent = { kind: GangKind; d: District; t: number; mobs: Mob[]; drops: { x: number; y: number }[]; got: number; done: boolean };
export type GangState = { ev: GangEvent | null; wait: number };
export const newGangs = (): GangState => ({ ev: null, wait: 70 });

/** the bank of the river or harbour nearest to (x,y) that an otter can slip into */
function waterEdge(w: World, x: number, y: number): [number, number] {
  let best: [number, number] = [x, y], bd = 1e9;
  const tx0 = Math.floor(x / T), ty0 = Math.floor(y / T);
  for (let ty = ty0 - 14; ty <= ty0 + 14; ty++) for (let tx = tx0 - 14; tx <= tx0 + 14; tx++) {
    if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) continue;
    if (w.c.solid[ty * W + tx] !== S.WATER) continue;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => pedTile(w.c, tx + dx, ty + dy));
    if (!open) continue;
    const d = Math.hypot(tx - tx0, ty - ty0); if (d < bd && d > 5) { bd = d; best = [tx * T + T / 2, ty * T + T / 2]; }
  }
  return best;
}

export function startGang(w: World, kind: GangKind): GangEvent | null {
  const px = w.p.x, py = w.p.y;
  const turf = GANG[kind].turf.filter(d => w.open.has(d));
  const here = districtAt(Math.floor(px / T), Math.floor(py / T));
  if (!turf.includes(here)) return null;
  // they start a little way off, out of the way of traffic
  let sx = 0, sy = 0, ok = false;
  for (let k = 0; k < 30 && !ok; k++) {
    const a = w.R() * Math.PI * 2, d = 320 + w.R() * 260;
    const [x, y] = nearestFree(w.c, 'walk', px + Math.cos(a) * d, py + Math.sin(a) * d, w.open, 3);
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (pedTile(w.c, tx, ty) && districtAt(tx, ty) === here) { sx = x; sy = y; ok = true; }
  }
  if (!ok) return null;
  const n = kind === 'macaques' ? 2 : kind === 'mynahs' ? 4 : 3;
  const mobs: Mob[] = [];
  for (let i = 0; i < n; i++) mobs.push({ id: w.nextId++, b: { x: sx + (i - 1) * 30, y: sy + (i % 2) * 24, h: 0, speed: 0, r: 13, len: 0, cls: 'walk' }, has: true, st: 'run', t: 0, goal: null, anim: i });
  const ev: GangEvent = { kind, d: here, t: 0, mobs, drops: [], got: 0, done: false };
  w.gangs.ev = ev; w.fx.push({ t: 'event', kind });
  text(w, GANG[kind].boss, kind === 'otters'
    ? 'Hehe, my little ones are borrowing some crates from the quay tonight. Catch them if you can! (Ma Sleek)'
    : kind === 'lizards' ? 'Mmm. My lizards found snacks near you. They will run. Slowly. (Lord Lepak)'
    : kind === 'mynahs' ? 'KECOH! My singers just borrowed some kuih near you. Catch them if you can hear them! (Boss Bising)'
    : 'Ooh ooh! My boys found some very nice bags and buns near you. Bye bye! (Big Kow)');
  bark(w, sx, sy - 40, GANG[kind].lines);
  return ev;
}

export function gangsStep(w: World, dt: number) {
  const G = w.gangs, p = w.p;
  if (!G.ev) {
    if (w.run || w.heat >= 1 || p.roof || w.s.done.length < 3 || w.street) return;
    G.wait -= dt;
    if (G.wait <= 0) { G.wait = 80 + w.R() * 60; const r = w.R(); startGang(w, r < 0.34 ? 'otters' : r < 0.67 ? 'macaques' : 'lizards') ?? startGang(w, 'mynahs') ?? startGang(w, 'lizards') ?? startGang(w, 'macaques') ?? startGang(w, 'otters'); }
    return;
  }
  const ev = G.ev; ev.t += dt;
  if (ev.done) { if (ev.t > 3) G.ev = null; return; }
  if (w.run || ev.t > 75 * (w.assist ? 1.3 : 1) || dist(ev.mobs[0].b.x, ev.mobs[0].b.y, p.x, p.y) > 2400) { finish(w, ev); return; }
  const pb = p.ride ? p.ride.b : p.b;
  for (const m of ev.mobs) {
    m.anim += dt; if (m.t > 0) m.t -= dt;
    if (m.st === 'gone') continue;
    if (m.st === 'swim') { m.b.y += 60 * dt; if (m.t <= 0) m.st = 'gone'; continue; }
    // a lizard far from you flops down to sunbathe for a moment (lepak), then ambles on
    if (ev.kind === 'lizards' && m.st === 'run' && m.has && m.t <= 0 && dist(m.b.x, m.b.y, p.x, p.y) > 520 && w.R() < dt * 0.25) { m.st = 'lepak'; m.t = 2.5; }
    if (m.st === 'lepak' && (p.ride ? pb.speed > 90 : (p.dashT > 0 || p.hopT > 0)) && dist(m.b.x, m.b.y, pb.x, pb.y) < m.b.r + pb.r + 12) { drop(w, ev, m, 'dizzy', 1.6); continue; }
    if (ev.kind === 'mynahs' && mynaStep(w, ev, m, dt)) continue;
    if (m.st !== 'run') { m.b.speed *= 0.85; if (m.t <= 0) m.st = m.st === 'netted' || !m.has ? 'gone' : 'run'; if (m.st === 'gone') bark(w, m.b.x, m.b.y - 36, GANG[ev.kind].caught); continue; }
    if (!m.has) { m.st = 'gone'; continue; }
    // otters run for the water; macaques for the far side of the block, and on for the hills
    if (!m.goal || dist(m.b.x, m.b.y, m.goal[0], m.goal[1]) < 40) {
      if (ev.kind !== 'macaques') { m.goal = waterEdge(w, m.b.x, m.b.y); if (m.goal && dist(m.b.x, m.b.y, m.goal[0], m.goal[1]) < 60) { m.st = 'swim'; m.t = 3; w.fx.push({ t: 'splash', x: m.b.x, y: m.b.y }); w.say(ev.kind === 'otters' ? 'An otter slipped into the water with a crate!' : 'A lizard slid into the longkang with the snacks!', 'bad'); continue; } }
      else { for (let k = 0; k < 20; k++) { const a = w.R() * Math.PI * 2, d = (8 + w.R() * 8) * T; const tx = Math.floor((m.b.x + Math.cos(a) * d) / T), ty = Math.floor((m.b.y + Math.sin(a) * d) / T); if (pedTile(w.c, tx, ty) && w.open.has(districtAt(tx, ty))) { m.goal = [tx * T + T / 2, ty * T + T / 2]; break; } } }
    }
    const close = dist(m.b.x, m.b.y, pb.x, pb.y);
    const sp = (close < 240 ? 190 : 140) * (w.assist ? 0.84 : 1) * (close > 900 ? 0.6 : 1) * (ev.kind === 'lizards' ? 0.85 : 1);
    const g = m.goal ?? [m.b.x, m.b.y];
    const f = w.fieldTo('walk', g[0], g[1]); const n = downhill(w.c, f, m.b.x, m.b.y, w.open) ?? g;
    const dx = n[0] - m.b.x, dy = n[1] - m.b.y, l = Math.hypot(dx, dy) || 1;
    drive(w.ctx(), m.b, dx / l, dy / l, sp, 900, 10, dt, true);
    // a dash or a ride into them: an otter drops its crate; a macaque dodges (half the time)
    const hitting = p.ride ? pb.speed > 90 : (p.dashT > 0 || p.hopT > 0);
    if (hitting && close < m.b.r + pb.r + (w.assist ? 18 : 8)) {
      if (ev.kind === 'macaques' && (m.id + Math.floor(w.time * 2)) % 2 === 0) { m.st = 'leap'; m.t = 0.5; m.b.x += dx / l * 40; m.b.y += dy / l * 40; bark(w, m.b.x, m.b.y - 36, ['Too slow!', 'Ooh ooh, missed!']); }
      else drop(w, ev, m, 'dizzy', 1.6);
    }
  }
  // walk over a dropped crate or bag to take it back
  for (let i = ev.drops.length - 1; i >= 0; i--) { const d = ev.drops[i]; if (!p.ride && dist(d.x, d.y, p.x, p.y) < 40) { ev.drops.splice(i, 1); ev.got++; w.s.cash += 12; w.fx.push({ t: 'pickup' }); w.say(`Got it back! +12 coins (${ev.got} of ${ev.mobs.length})`, 'good'); } }
  if (ev.mobs.every(m => m.st === 'gone' || !m.has) && !ev.drops.length) finish(w, ev);
}
function drop(w: World, ev: GangEvent, m: Mob, st: MobState, t: number) {
  m.slip = undefined;
  if (m.has) { m.has = false; ev.drops.push({ x: m.b.x + 18, y: m.b.y + 10 }); w.fx.push({ t: 'drop', x: m.b.x, y: m.b.y }); }
  m.st = st; m.t = t; m.b.speed = 0;
}
function finish(w: World, ev: GangEvent) {
  ev.done = true; ev.t = 0;
  if (ev.got >= ev.mobs.length) { w.s.cash += 20; addRep(w.s, ev.d, 3); w.s.helped++; w.banner = { text: 'Good deed!', sub: `Everything back from ${GANG[ev.kind].name} · +20 coins bonus`, t: 2.8 }; w.fx.push({ t: 'good-deed', k: 20 }); cheer(w); }
  else if (ev.got) { addRep(w.s, ev.d, 1); w.say(`You got ${ev.got} back from ${GANG[ev.kind].name}.`, 'good'); }
  else w.say(`${GANG[ev.kind].name[0].toUpperCase()}${GANG[ev.kind].name.slice(1)} got away this time.`, 'bad');
}

/** what a gadget does to a gang member; true when the shot is used up */
export function gangHit(w: World, m: Mob, g: string): boolean {
  const ev = w.gangs.ev; if (!ev || m.st === 'gone' || m.st === 'swim') return false;
  if (ev.kind === 'lizards') {
    if (g === 'bubble') { drop(w, ev, m, 'dizzy', 2.2); m.slip = 2.2; bark(w, m.b.x, m.b.y - 36, ['Whoa, slippery!', 'Soap! Unfair!']); return true; }
    if (g === 'paint') { bark(w, m.b.x, m.b.y - 36, ['Blink. Blink. Still here.']); return true; }
    if (g === 'net') { drop(w, ev, m, 'netted', 2.5); return true; }
    if (g === 'sling') { drop(w, ev, m, 'munch', 4); bark(w, m.b.x, m.b.y - 36, ['Ooh, a rice ball. Nice.']); return true; }
    drop(w, ev, m, 'dizzy', 1.4); return true;
  }
  if (ev.kind === 'mynahs') {
    w.s.stats.mynahs += g === 'net' ? 1 : 0;
    if (g === 'bubble') { drop(w, ev, m, 'play', 3.5); bark(w, m.b.x, m.b.y - 36, ['Ooh, shiny bubble!', 'Pop pop pop!']); return true; }
    if (g === 'paint') { drop(w, ev, m, 'preen', 3.2); bark(w, m.b.x, m.b.y - 36, ['My feathers! So messy!', 'Must preen, must preen.']); return true; }
    if (g === 'net') { drop(w, ev, m, 'netted', 2.5); return true; }
    if (g === 'sling') { drop(w, ev, m, 'munch', 4.5); bark(w, m.b.x, m.b.y - 36, ['Rice ball! Kecoh!']); return true; }
    if (g === 'popper' || g === 'confetti') { for (const q of ev.mobs) if (q.st === 'run' && dist(q.b.x, q.b.y, m.b.x, m.b.y) < 200) { drop(w, ev, q, 'leap', 1.1); q.fly = 1.1; } bark(w, m.b.x, m.b.y - 36, ['SQUAWK!', 'Scatter!']); return true; }
    drop(w, ev, m, 'dizzy', 1.3); return true;
  }
  if (ev.kind === 'otters') {
    if (g === 'bubble') { drop(w, ev, m, 'play', 4); bark(w, m.b.x, m.b.y - 36, ['Ooh, bubble!', 'Wheee!']); return true; }
    if (g === 'paint') { bark(w, m.b.x, m.b.y - 36, ['Too slippery! Hehe!']); return true; }
    if (g === 'net') { drop(w, ev, m, 'netted', 2.5); return true; }
    drop(w, ev, m, 'dizzy', g === 'confetti' ? 0.8 : 1.4); return true;
  }
  if (g === 'sling') { drop(w, ev, m, 'munch', 5); bark(w, m.b.x, m.b.y - 36, ['Ooh! Rice ball!']); return true; }
  if (g === 'popper' || g === 'confetti') { drop(w, ev, m, 'leap', 1.2); m.b.x += 30; return true; }
  if (g === 'paint') { drop(w, ev, m, 'dizzy', 1.8); return true; }
  if (g === 'net') { drop(w, ev, m, 'netted', 2.5); return true; }
  drop(w, ev, m, 'dizzy', 1.2); return true;
}
/** a mynah's own moves: short hop-flights over whatever is in the way, a mimicked sound now and then (the heroes
 * cover their ears), and the flight home to the roost when it gets clear away. True when it has moved this step. */
const MIMIC = ['Ring ring! Ring ring!', 'Wee-woo, wee-woo!', 'Peep peep! Reversing!', 'Oi, chinchilla!', 'Teh tarik, one!', 'Mind the gap!'];
function mynaStep(w: World, ev: GangEvent, m: Mob, dt: number): boolean {
  const p = w.p;
  if (m.sing !== undefined) { m.sing -= dt; if (m.sing <= 0) m.sing = undefined; }
  if (m.st === 'run' && m.has && m.sing === undefined && w.R() < dt * 0.22) {
    m.sing = 1.4; bark(w, m.b.x, m.b.y - 40, MIMIC); w.fx.push({ t: 'mimic', x: m.b.x, y: m.b.y });
    if (!p.ride && !p.act && dist(m.b.x, m.b.y, p.x, p.y) < 260) { p.act = { n: 'ears', t: 0, dur: 0.9 }; p.face = 'down'; }
  }
  if (m.st === 'preen' || m.st === 'play') { m.b.speed *= 0.85; if (m.t <= 0) m.st = 'gone'; if (m.st === 'gone') bark(w, m.b.x, m.b.y - 36, GANG.mynahs.caught); return true; }
  if (m.st !== 'run' || !m.has) return false;
  // the goal: the roost, or the far side of the block
  if (!m.goal || dist(m.b.x, m.b.y, m.goal[0], m.goal[1]) < 40) {
    const roost = w.c.isle?.hideouts.myna;
    if (roost && w.R() < 0.4) m.goal = [roost[0], roost[1]];
    else for (let k = 0; k < 20; k++) { const a = w.R() * Math.PI * 2, d = (6 + w.R() * 8) * T; const tx = Math.floor((m.b.x + Math.cos(a) * d) / T), ty = Math.floor((m.b.y + Math.sin(a) * d) / T); if (pedTile(w.c, tx, ty) && GANG.mynahs.turf.includes(districtAt(tx, ty)) && w.open.has(districtAt(tx, ty))) { m.goal = [tx * T + T / 2, ty * T + T / 2]; break; } }
  }
  const close = dist(m.b.x, m.b.y, p.x, p.y);
  // far from you, it flies home with the loot
  if (close > 1500) { m.st = 'gone'; w.say('A mynah flew off home with its kuih!', 'bad'); return true; }
  if (m.fly === undefined && w.R() < dt * (close < 220 ? 0.9 : 0.25)) m.fly = 0.9;
  if (m.fly !== undefined) {
    m.fly -= dt; if (m.fly <= 0) m.fly = undefined;
    const g = m.goal ?? [m.b.x, m.b.y], dx = g[0] - m.b.x, dy = g[1] - m.b.y, l = Math.hypot(dx, dy) || 1;
    const sp = 230 * (w.assist ? 0.8 : 1);
    m.b.h = Math.atan2(dy, dx); m.b.speed = sp; m.b.x += dx / l * sp * dt; m.b.y += dy / l * sp * dt;
    // it lands somewhere it can walk
    if (m.fly === undefined) { const [fx, fy] = nearestFree(w.c, 'walk', m.b.x, m.b.y, w.open, 3); m.b.x = fx; m.b.y = fy; }
    return true;
  }
  return false;
}
/** shoo a mynah in reach (E): it flaps up and drops what it took */
export function shoo(w: World, m: Mob) {
  const ev = w.gangs.ev; if (!ev) return;
  w.p.act = { n: 'shoo', t: 0, dur: 0.6 }; w.p.face = 'side'; w.p.flip = m.b.x < w.p.x;
  drop(w, ev, m, 'leap', 1); m.fly = 1; bark(w, m.b.x, m.b.y - 36, ['Eep! Okay okay!', 'Shoo yourself!']);
  w.fx.push({ t: 'shoo', x: m.b.x, y: m.b.y });
}
/** toss a banana from the mama shop at a macaque in reach; shoo a mynah */
export function gangNear(w: World, cand: (n: Near, r: number) => void) {
  const ev = w.gangs.ev; if (!ev || ev.done || w.p.ride) return;
  if (ev.kind === 'mynahs') { for (const m of ev.mobs) if (m.has && m.st === 'run' && m.fly === undefined) cand({ kind: 'gang', id: 'shoo:' + m.id, label: 'Shoo the mynah!', x: m.b.x, y: m.b.y }, 90); return; }
  if (ev.kind !== 'macaques' || w.s.bag.banana <= 0) return;
  for (const m of ev.mobs) if (m.has && m.st === 'run') cand({ kind: 'gang', id: 'banana:' + m.id, label: `Toss a banana to the macaque (${w.s.bag.banana} left)`, x: m.b.x, y: m.b.y }, 150);
}
export function gangAct(w: World, id: string) {
  const ev = w.gangs.ev; if (!ev) return;
  const sm = ev.mobs.find(q => 'shoo:' + q.id === id); if (sm) { shoo(w, sm); return; }
  const m = ev.mobs.find(q => 'banana:' + q.id === id); if (!m) return;
  w.s.bag.banana--; w.p.act = { n: 'toss', t: 0, dur: 0.5 }; w.p.face = 'side'; w.p.flip = m.b.x < w.p.x;
  drop(w, ev, m, 'munch', 6); bark(w, m.b.x, m.b.y - 36, ['Banana!! Ooh ooh!']);
}
/** the mob sprite for the scene */
export function mobSprite(kind: GangKind, m: Mob): { name: string; flip: boolean } {
  const k = Math.floor(m.anim * 6) % 2, side = Math.abs(Math.cos(m.b.h)) > Math.abs(Math.sin(m.b.h));
  const P = kind === 'otters' ? 'otter' : kind === 'lizards' ? 'liz' : 'mac';
  if (kind === 'mynahs') {
    if (m.fly !== undefined) return { name: `myna-fly-${k}`, flip: false };
    if (m.st === 'play') return { name: 'myna-bubble', flip: false };
    if (m.st === 'preen') return { name: 'myna-preen', flip: false };
    if (m.st === 'netted') return { name: 'myna-netted', flip: false };
    if (m.st === 'dizzy') return { name: 'myna-dizzy', flip: false };
    if (m.st === 'munch') return { name: 'myna-munch', flip: false };
    if (m.sing !== undefined) return { name: 'myna-sing', flip: Math.cos(m.b.h) < 0 };
    if (m.b.speed < 10) return { name: 'myna-taunt', flip: false };
    if (side) return { name: `myna-run-${k}`, flip: Math.cos(m.b.h) < 0 };
    return { name: `myna-walk-${Math.sin(m.b.h) > 0 ? 'down' : 'up'}-${k}`, flip: false };
  }
  if (kind === 'lizards') {
    if (m.st === 'swim') return { name: 'liz-swim', flip: false };
    if (m.st === 'lepak' || m.st === 'munch') return { name: 'liz-lepak', flip: false };
    if (m.st === 'netted') return { name: 'liz-netted', flip: false };
    if (m.st === 'dizzy') return { name: m.slip ? 'liz-slip' : 'liz-dizzy', flip: false };
    if (m.b.speed < 10) return { name: 'liz-taunt', flip: false };
    if (side) return { name: m.has ? `liz-run-${k}` : `liz-walk-down-${k}`, flip: Math.cos(m.b.h) < 0 };
    return { name: `liz-walk-${Math.sin(m.b.h) > 0 ? 'down' : 'up'}-${k}`, flip: false };
  }
  if (m.st === 'swim') return { name: `otter-swim-${k}`, flip: false };
  if (m.st === 'play') return { name: 'otter-bubble', flip: false };
  if (m.st === 'netted') return { name: kind === 'otters' ? 'otter-netted' : 'mac-dizzy', flip: false };
  if (m.st === 'dizzy') return { name: `${P}-dizzy`, flip: false };
  if (m.st === 'munch') return { name: 'mac-munch', flip: false };
  if (m.st === 'leap') return { name: kind === 'macaques' ? 'mac-startled' : 'otter-dizzy', flip: false };
  if (m.b.speed < 10) return { name: `${P}-taunt`, flip: false };
  if (side) return { name: `${P}-run-${k}`, flip: Math.cos(m.b.h) < 0 };
  return { name: `${P}-walk-${Math.sin(m.b.h) > 0 ? 'down' : 'up'}-${k}`, flip: false };
}

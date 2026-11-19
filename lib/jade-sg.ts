// Jade Street: the Singapore streets in free roam (the places are laid out in lib/jade-sgcity.ts). Road-toll gantries
// charge a coin, or tell the wardens where you are when the lanterns are lit; the five-foot ways keep you dry and half
// hidden; at the hawker centre the aunties chope tables with tissue packets (so can you, and there is a dinner-time
// chope rush); Mr Ong the karang guni man pedals his round buying old newspapers; pigeons, chewing gum and litter are
// the fine city's little temptations; the townsfolk speak a word of Singlish; tropical thunderstorms burst over the
// river; and most nights bring one festival: a Hungry Ghost getai show in the docks car park, a lion dance procession
// that closes a street, or a mooncake lantern walk through the temple park. No DOM; all randomness is seeded.
import { T, W, districtAt } from './jade-city.js';
import { mvP } from './jade-layout.js';
import { drive, type Body } from './jade-move.js';
import { downhill } from './jade-nav.js';
import { rng, hashStr, dist, clamp } from './jade-rng.js';
import { addRep } from './jade-save.js';
import { addHeat, lanterns } from './jade-heat.js';
import { offence } from './jade-fines.js';
import { showers } from './jade-weather.js';
import { SG_FOLK } from './jade-folk.js';
import type { World, Near } from './jade-game.js';

// ── Singlish, light and fond
export const BARKS = {
  bump: ['Wah lau! Walk properly lah!', 'Aiyoh, so fast for what?', 'Oi! Look where you going!'],
  honk: ['Horn so loud for what?', 'Aiyoh, my heart!', 'Wah, steady lah, no need to honk.'],
  help: ['Steady lah!', 'Wah, very good!', 'Shiok!'],
  idle: ['Can or not?', 'Eat already?', 'Wah, so late still walking around?', 'Hot like oven today.'],
  paiseh: ['Paiseh!', 'Sorry ah!', 'Paiseh, paiseh!'],
  ong: ['Karang guniii! Old newspaper, old radio, can sell!', 'Karang guni! Got old newspaper or not?'],
  goh: ['Your move. No rush, I got all night.', 'Aiyah, cannot like that one. Think first.', 'Wah, this one steady.'],
  hoon: ['Chope already, don’t simply sit ah!', 'Eat already or not? Chicken rice very nice today.'],
  teo: ['Kopi-o kosong? Teh peng? Say properly hor.', 'One kopi coming! Shiok one.'],
  beng: ['Bro, my wok hei is the best in Chinatown, steady!', 'Wah lau, so many crows today.'],
  lily: ['Aiyoh! Front row is for the spirits, please don’t sit there!', 'Thank you, thank you! Next song is a classic!'],
  lion: ['Huat ah!', 'Gong xi fa cai! Huat ah!'],
};
export type Bark = { x: number; y: number; text: string; t: number; hero?: boolean };
export function bark(w: World, x: number, y: number, list: string[], hero = false) {
  if (w.barks.some(b => dist(b.x, b.y, x, y) < 90 && b.t < 2)) return;
  // one queue for the pop-ups: passers-by keep quiet while a talk or an important notice is up, and no more than two
  // remarks hang in the air at once (a hero's own line always gets through)
  if (!hero && (w.talk || w.hush || w.barks.filter(b => b.t < 2.2).length >= 2)) return;
  w.barks.push({ x, y, text: list[Math.floor(w.R() * list.length)], t: 0, hero });
  if (w.barks.length > 3) w.barks.shift();
  w.fx.push({ t: 'bark', x, y });
}

// ── the kopi lingo (the kopi mini-game in lib/jade-mini.ts orders with it; the glossary page lists it)
export const LINGO: { term: string; means: string }[] = [
  { term: 'Kopi', means: 'Coffee with condensed milk and sugar' },
  { term: 'Teh', means: 'Tea with condensed milk and sugar' },
  { term: 'O', means: 'No milk (sugar only): kopi-o, teh-o' },
  { term: 'C', means: 'Evaporated milk and sugar instead of condensed milk: kopi-c, teh-c' },
  { term: 'Kosong', means: 'No sugar ("zero")' },
  { term: 'Siew dai', means: 'Less sweet' },
  { term: 'Ga dai', means: 'Extra sweet' },
  { term: 'Peng', means: 'Iced' },
  { term: 'Chope', means: 'To reserve a seat, usually with a packet of tissues on the table' },
  { term: 'Makan', means: 'To eat; food' },
  { term: 'Shiok', means: 'Delicious, wonderful' },
  { term: 'Paiseh', means: 'Sorry, embarrassed' },
  { term: 'Wah lau', means: 'Oh my goodness! (exasperated)' },
  { term: 'Steady lah', means: 'Well done, cool' },
  { term: 'Can or not?', means: 'Is that possible? Will you?' },
  { term: 'Karang guni', means: 'The rag-and-bone man who buys old newspapers and junk' },
  { term: 'Kaypoh', means: 'Busybody, nosy (the Kaypoh Crows can never leave anything alone)' },
  { term: 'Getai', means: 'Live stage shows during the Hungry Ghost month; the front row is left empty for the spirits' },
  { term: 'Ang pao', means: 'A red packet of money given for luck' },
  { term: 'Huat ah!', means: 'May we prosper! (a lucky cheer)' },
];

// ── per-world state
export type Fest = 'getai' | 'lion' | 'lantern' | null;
export type SgState = {
  /** the tables at the hawker centre: 0 free, 1 choped by you, 2 by an auntie; the chope rush */
  chope: number[]; rush: { t: number; aunties: { b: Body; tgt: number; done: boolean }[]; won: boolean } | null; rushT: number;
  /** Mr Ong on his round (index of the next point), tonight's junk (spot indices still lying there) */
  ong: { b: Body; i: number; wait: number }; junk: number[];
  /** pigeons at each square (a flap timer) and gum and litter for tonight */
  pigeons: { x: number; y: number; ph: number; fly: number }[]; gum: number[]; litter: [number, number][]; held: number;
  /** tonight's festival, the lion dance's place, the lantern kids, how long you've walked a lantern, what you've
   *  done once tonight (cheer, chess, ang pao) */
  fest: Fest; lion: { x: number; y: number; on: boolean }; kids: { x: number; y: number; i: number }[]; lantern: number; once: Set<string>;
  /** gantry cooldowns, how wet you are, the storm's flash, when you last did something that blows a gum bubble */
  gant: number[]; wet: number; flash: number; storm: number; gumT: number; barkT: number; night: number;
  lastX: number; lastY: number;
};
export function newSg(): SgState {
  return { chope: [], rush: null, rushT: 50, ong: { b: { x: 0, y: 0, h: 0, speed: 0, r: 14, len: 0, cls: 'walk' }, i: 0, wait: 0 }, junk: [], pigeons: [], gum: [], litter: [], held: 0,
    fest: null, lion: { x: 0, y: 0, on: false }, kids: [], lantern: 0, once: new Set(), gant: [], wet: 0, flash: 0, storm: 0, gumT: 0, barkT: 0, night: -1, lastX: 0, lastY: 0 };
}
/** tonight's festival (seeded): a getai once the docks are open, a lion dance, a lantern walk, or a plain night */
export function festOf(seed: number, night: number, docksOpen: boolean): Fest {
  const r = rng(hashStr(`jade-fest:${seed}:${night}`))();
  if (r < 0.28 && docksOpen) return 'getai';
  if (r < 0.5) return 'lion';
  if (r < 0.72) return 'lantern';
  return null;
}
/** a tropical thunderstorm: the heaviest shower of a night bursts into one (0 to 1) */
export function stormAt(seed: number, night: number, clock: number): number {
  for (const sh of showers(seed, night)) {
    if (sh.k < 0.8) continue;
    const t = clock - sh.at; if (t < sh.len * 0.25 || t > sh.len * 0.75) continue;
    return clamp(Math.min(t - sh.len * 0.25, sh.len * 0.75 - t) / 6, 0, 1);
  }
  return 0;
}
/** the lion dance's run down Smith Street (old-frame world units, moved by its start through the layout table) */
const LION_AT = mvP(2 * T, 47.5 * T);
const LION_ROAD = { y: LION_AT[1], x0: LION_AT[0], x1: LION_AT[0] + 42 * T, from: 150, to: 420 };

/** set the night up: tables, junk, gum, litter, the festival */
function newNightSg(w: World) {
  const sg = w.sg, c = w.c.sg; if (!c) return;
  const R = rng(hashStr(`jade-sg:${w.s.seed}:${w.s.night}`));
  sg.night = w.s.night;
  sg.chope = c.tables.map(() => (R() < 0.34 ? 2 : 0));
  sg.junk = c.junk.map((_, i) => i).filter(() => R() < 0.5).slice(0, 4);
  sg.gum = c.gum.map((_, i) => i).filter(() => R() < 0.6);
  sg.litter = [[c.hawker.x0 * T + 3.5 * T, (c.hawker.y0 + 6) * T], [c.hawker.x0 * T + 9.5 * T, (c.hawker.y0 + 3) * T]];
  sg.pigeons = [];
  for (const [x, y] of c.pigeons) for (let k = 0; k < 5; k++) sg.pigeons.push({ x: x + (R() - 0.5) * 110, y: y + (R() - 0.5) * 80, ph: R() * 6, fly: 0 });
  sg.fest = festOf(w.s.seed, w.s.night, w.open.has('docks'));
  sg.once = new Set(); sg.lantern = 0;
  sg.kids = sg.fest === 'lantern' ? [0, 1, 2, 3].map(i => ({ x: 0, y: 0, i })) : [];
  const [ox, oy] = c.round[0]; sg.ong = { b: { x: ox, y: oy, h: 0, speed: 0, r: 14, len: 0, cls: 'walk' }, i: 1, wait: 0 };
}

export function sgStep(w: World, dt: number) {
  const c = w.c.sg; if (!c) return;
  const sg = w.sg, p = w.p, px = p.x, py = p.y;
  if (sg.night !== w.s.night) newNightSg(w);
  // ── the storm
  sg.storm = stormAt(w.s.seed, w.s.night, w.s.clock);
  if (sg.storm > 0.5 && w.R() < dt * 0.12) { sg.flash = 0.35; w.fx.push({ t: 'thunder', k: sg.storm }); }
  sg.flash = Math.max(0, sg.flash - dt);
  // ── five-foot ways: shade and shelter
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  p.shade = !p.ride && !p.roof && c.fivefoot[ty * W + tx] === 1;
  if (!p.ride && !p.roof && w.rain > 0.5 && !p.shade) sg.wet += dt;
  if (p.shade && sg.wet > 4 && !p.act && !w.run) { sg.wet = 0; p.act = { n: 'shake-wet', t: 0, dur: 0.9 }; p.face = 'down'; w.fx.push({ t: 'shake', x: px, y: py }); }
  if (w.rain < 0.2) sg.wet = Math.max(0, sg.wet - dt);
  // ── gantries: a coin, or with the lanterns lit, the camera tells the wardens
  if (p.ride && p.ride.kind !== 'boat') {
    c.gantries.forEach((g, i) => {
      if ((sg.gant[i] ?? 0) > w.time) return;
      const crossed = g.axis === 'h' ? (sg.lastX - g.x) * (px - g.x) <= 0 && Math.abs(py - g.y) < 2.2 * T && sg.lastX !== px : (sg.lastY - g.y) * (py - g.y) <= 0 && Math.abs(px - g.x) < 2.2 * T && sg.lastY !== py;
      if (!crossed) return;
      sg.gant[i] = w.time + 3;
      if (lanterns(w) >= 1) { addHeat(w, 0.35, 'gantry'); w.lastSeen = [px, py]; w.seenT = 0; w.fx.push({ t: 'gantry', x: g.x, y: g.y, k: 1 }); w.say('Gantry camera! The wardens know where you are.', 'bad'); }
      else if (w.s.cash > 0) { w.s.cash -= 1; w.s.stats.tolls = (w.s.stats.tolls ?? 0) + 1; w.fx.push({ t: 'gantry', x: g.x, y: g.y, k: 0 }); }
    });
  }
  sg.lastX = px; sg.lastY = py;
  // ── Mr Ong pedals his round, stopping now and then to call out
  const o = sg.ong;
  if (o.wait > 0) { o.wait -= dt; o.b.speed = 0; }
  else {
    const [gx, gy] = c.round[o.i % c.round.length];
    if (dist(o.b.x, o.b.y, gx, gy) < 40) { o.i = (o.i + 1) % c.round.length; if (w.R() < 0.4) { o.wait = 4; if (dist(o.b.x, o.b.y, px, py) < 600) bark(w, o.b.x, o.b.y - 30, BARKS.ong); } }
    else if (w.open.has(districtAt(Math.floor(gx / T), Math.floor(gy / T)))) {
      const f = w.fieldTo('walk', gx, gy); const n = downhill(w.c, f, o.b.x, o.b.y, w.open) ?? [gx, gy];
      const dx = n[0] - o.b.x, dy = n[1] - o.b.y, l = Math.hypot(dx, dy) || 1;
      drive(w.ctx(), o.b, dx / l, dy / l, dist(o.b.x, o.b.y, px, py) < 140 ? 0 : 70, 400, 6, dt, true);
    }
  }
  // ── pigeons: scatter from a run or a ride, then settle back
  for (const pg of sg.pigeons) { pg.ph += dt; pg.fly = Math.max(0, pg.fly - dt); if (!pg.fly && dist(pg.x, pg.y, px, py) < (p.ride ? 120 : p.dashT > 0 ? 90 : 0)) { pg.fly = 2.2; w.fx.push({ t: 'flap', x: pg.x, y: pg.y }); } }
  // ── chewing gum: a bubble now and then, which a ticket warden may well see
  if (w.s.bag.gum > 0 && !p.ride && !p.act && !w.talk && !w.run) {
    sg.gumT += dt;
    if (sg.gumT > 14) { sg.gumT = 0; p.act = { n: 'gum', t: 0, dur: 1.1 }; p.face = 'down'; w.fx.push({ t: 'gum', x: px, y: py }); offence(w, 'gum', px, py); }
  }
  // ── the chope rush: at dinner time, aunties stream in to chope the free tables; beat them to three
  if (!w.run && !sg.rush && dist(px, py, (c.hawker.x0 + 6) * T, (c.hawker.y0 + 4) * T) < 640) { sg.rushT -= dt; if (sg.rushT <= 0) startRush(w); }
  if (sg.rush) rushStep(w, dt);
  // ── the lion dance procession closes a street (free roam only: in a job the lion steps aside)
  const L = sg.lion; L.on = sg.fest === 'lion' && w.s.clock > LION_ROAD.from && w.s.clock < LION_ROAD.to;
  if (L.on) { const k = (w.s.clock - LION_ROAD.from) / (LION_ROAD.to - LION_ROAD.from); L.x = LION_ROAD.x0 + (LION_ROAD.x1 - LION_ROAD.x0) * k; L.y = LION_ROAD.y; if (dist(L.x, L.y, px, py) < 500 && w.R() < dt * 0.25) bark(w, L.x, L.y - 60, BARKS.lion); }
  // ── the lantern walk: the kids loop the temple park's path; walk with a lantern near them and they share mooncake
  if (sg.fest === 'lantern' && w.c.paths.length) {
    const pa = w.c.paths[0].pts, n = pa.length;
    for (const k of sg.kids) { const u = ((w.time * 0.035 + k.i * 0.06) % 1) * (n - 1); const j = Math.floor(u), f = u - j; const a = pa[j], b = pa[Math.min(n - 1, j + 1)]; k.x = a[0] + (b[0] - a[0]) * f; k.y = a[1] + (b[1] - a[1]) * f; }
    if (p.carry === 'lantern' && !p.ride && sg.kids.some(k => dist(k.x, k.y, px, py) < 360) && p.b.speed > 20) {
      sg.lantern += dt;
      if (sg.lantern >= 30 && !sg.once.has('lantern')) { sg.once.add('lantern'); p.carry = null; w.s.cash += 20; addRep(w.s, 'temple', 2); w.s.helped++; w.banner = { text: 'Lantern walk!', sub: 'The kids share a mooncake · +20 coins', t: 2.6 }; w.fx.push({ t: 'good-deed', k: 20 }); }
    }
  } else if (p.carry === 'lantern') p.carry = null;
  // ── the getai crowd and the spirits' front row
  if (sg.fest === 'getai' && w.open.has('docks')) {
    const [gx, gy] = c.getai;
    if (!w.street && !w.crowd && dist(gx, gy, px, py) < 900) w.crowd = { x: gx, y: gy + 40 };
    if (!p.ride && Math.abs(px - gx) < 2.4 * T && Math.abs(py - (gy + 0.9 * T)) < 0.6 * T) bark(w, gx - 40, gy - 90, [BARKS.lily[0]]);
  }
  // ── a word of Singlish from the townsfolk
  sg.barkT -= dt;
  if (sg.barkT <= 0) {
    sg.barkT = 0.4;
    for (const pd of w.peds) {
      const d = dist(pd.x, pd.y, px, py); if (d > 220 || !SG_FOLK.includes(pd.sp)) continue;
      if (d < 70 && (p.dashT > 0 || (p.ride && p.ride.b.speed > 140))) { bark(w, pd.x, pd.y - 40, BARKS.bump); if (!p.ride) bark(w, px, py - 50, BARKS.paiseh, true); break; }
      if (pd.scare > 0.6 && w.fx.some(f => f.t === 'honk')) { bark(w, pd.x, pd.y - 40, BARKS.honk); break; }
      if (d < 110 && p.b.speed < 10 && w.R() < 0.05) { bark(w, pd.x, pd.y - 40, BARKS.idle); break; }
    }
    for (const [id, list] of [['hoon', BARKS.hoon], ['teo', BARKS.teo], ['beng', BARKS.beng], ['goh', BARKS.goh]] as [string, string[]][]) {
      const pl = w.c.places[id]; if (pl && !w.run && dist(pl.x, pl.y, px, py) < 140 && w.R() < 0.04) bark(w, pl.x, pl.y - 50, list);
    }
  }
  for (const b of w.barks) b.t += dt;
  w.barks = w.barks.filter(b => b.t < 2.8);
}
/** a cheer from the street after a good deed */
export function cheer(w: World) { const pd = w.peds.find(q => SG_FOLK.includes(q.sp) && dist(q.x, q.y, w.p.x, w.p.y) < 400); if (pd) bark(w, pd.x, pd.y - 40, BARKS.help); }

function startRush(w: World) {
  const c = w.c.sg!, sg = w.sg; sg.rushT = 140 + w.R() * 80;
  const free = sg.chope.filter(v => v === 0).length; if (free < 4) { sg.chope = sg.chope.map(v => (v === 2 && w.R() < 0.6 ? 0 : v)); }
  const [ax, ay] = [(c.hawker.x0 + 6) * T, (c.hawker.y0 - 0.5) * T];
  sg.rush = { t: 0, won: false, aunties: [0, 1, 2].map(k => ({ b: { x: ax + (k - 1) * 50, y: ay, h: Math.PI / 2, speed: 0, r: 12, len: 0, cls: 'walk' as const }, tgt: -1, done: false })) };
  w.fx.push({ t: 'event', kind: 'chope' });
  w.banner = { text: 'Chope rush!', sub: 'Dinner time: chope three tables with tissue packets before the aunties do', t: 3 };
}
function rushStep(w: World, dt: number) {
  const r = w.sg.rush!, sg = w.sg, c = w.c.sg!; r.t += dt;
  const mine = sg.chope.filter(v => v === 1).length;
  if (!r.won && mine >= 3) { r.won = true; w.s.cash += 30; addRep(w.s, 'market', 2); w.s.helped++; w.s.stats.chope = (w.s.stats.chope ?? 0) + 1; w.banner = { text: 'Choped!', sub: 'Three tables are yours · +30 coins', t: 2.6 }; w.fx.push({ t: 'good-deed', k: 30 }); cheer(w); }
  for (const a of r.aunties) {
    if (a.done) continue;
    if (a.tgt < 0 || sg.chope[a.tgt] !== 0) { const free = sg.chope.map((v, i) => [v, i]).filter(([v]) => v === 0).map(([, i]) => i); if (!free.length) { a.done = true; continue; } a.tgt = free[Math.floor(w.R() * free.length)]; }
    const t = c.tables[a.tgt], gx = t.x, gy = t.y + 34;
    if (dist(a.b.x, a.b.y, gx, gy) < 26) { sg.chope[a.tgt] = 2; a.tgt = -1; w.fx.push({ t: 'chope', x: t.x, y: t.y, k: 2 }); continue; }
    const dx = gx - a.b.x, dy = gy - a.b.y, l = Math.hypot(dx, dy) || 1;
    drive(w.ctx(), a.b, dx / l, dy / l, (w.assist ? 70 : 92) * (r.t < 3 ? 0.4 : 1), 500, 8, dt, true);
  }
  if (r.t > 45 || r.aunties.every(a => a.done) || w.run) { if (!r.won && !w.run) w.say('The aunties choped every table. Next time, bring more tissue packets!', 'bad'); sg.rush = null; }
}

/** what you can do near the Singapore places right now */
export function sgNear(w: World, cand: (n: Near, r: number) => void) {
  const c = w.c.sg; if (!c) return;
  const sg = w.sg, p = w.p, s = w.s;
  if (w.open.has('market')) {
    c.tables.forEach((t, i) => {
      const v = sg.chope[i];
      if (v === 0) cand({ kind: 'sg', id: 'chope:' + i, label: s.bag.tissue > 0 ? `Chope this table with a tissue packet (${s.bag.tissue} left)` : 'Chope this table (buy tissue packets at the mama shop)', x: t.x, y: t.y + 36 }, 64);
      else if (v === 1) cand({ kind: 'sg', id: 'makan:' + i, label: 'Sit and makan at your table (4 coins)', x: t.x, y: t.y + 36 }, 64);
      else cand({ kind: 'sg', id: 'taken:' + i, label: 'Choped already (a tissue packet means it’s taken)', x: t.x, y: t.y + 36 }, 64);
    });
    cand({ kind: 'sg', id: 'mama', label: 'Mama shop: tissue packets, bird seed, bananas', x: c.mama[0], y: c.mama[1] + 40 }, 76);
    cand({ kind: 'sg', id: 'chess', label: 'Play a game of chess with Uncle Goh', x: c.chess[0] - 50, y: c.chess[1] + 10 }, 70);
    sg.junk.forEach(i => { const [x, y] = c.junk[i]; cand({ kind: 'sg', id: 'junk:' + i, label: 'Pick up the old newspapers (Mr Ong buys them)', x, y }, 56); });
    sg.litter.forEach(([x, y], i) => cand({ kind: 'sg', id: 'litter:' + i, label: 'Pick up the litter', x, y }, 56));
    if (sg.held > 0 || s.bag.gum > 0) for (const [x, y] of c.bins) cand({ kind: 'sg', id: 'bin', label: s.bag.gum > 0 ? 'Spit the gum in the bin' : 'Put the litter in the bin', x, y }, 60);
    if (s.bag.junk > 0) cand({ kind: 'sg', id: 'ong', label: `Sell ${s.bag.junk} bundle${s.bag.junk > 1 ? 's' : ''} of newspapers to Mr Ong`, x: sg.ong.b.x, y: sg.ong.b.y }, 90);
  }
  sg.gum.forEach(i => { const [x, y] = c.gum[i]; if (w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)))) cand({ kind: 'sg', id: 'gum:' + i, label: 'Pick up a stick of chewing gum?', x, y }, 50); });
  if (s.bag.seed > 0) for (const [x, y] of c.pigeons) if (w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T)))) cand({ kind: 'sg', id: 'feed', label: 'Feed the pigeons', x, y }, 110);
  if (sg.lion.on && !sg.once.has('angpao')) cand({ kind: 'sg', id: 'angpao', label: 'Give the lion an ang pao (2 coins)', x: sg.lion.x, y: sg.lion.y + 50 }, 120);
  if (sg.fest === 'lantern' && p.carry !== 'lantern' && !sg.once.has('lantern')) for (const k of sg.kids) cand({ kind: 'sg', id: 'lantern', label: 'Join the lantern walk', x: k.x, y: k.y }, 90);
  if (sg.fest === 'getai' && w.open.has('docks') && !sg.once.has('getai')) cand({ kind: 'sg', id: 'getai', label: 'Cheer at the getai show', x: c.getai[0], y: c.getai[1] + 70 }, 110);
  if (w.open.has('market')) cand({ kind: 'sg', id: 'kopi', label: 'Help Uncle Teo make kopi (orders in kopi lingo)', x: c.kopi[0], y: c.kopi[1] + 50 }, 70);
}
/** do it */
export function sgAct(w: World, id: string) {
  const c = w.c.sg!, sg = w.sg, p = w.p, s = w.s;
  const [k, a] = id.split(':'); const i = Number(a);
  p.face = 'down';
  switch (k) {
    case 'chope':
      if (s.bag.tissue <= 0) { w.say('No tissue packets left. The mama shop at the void deck sells them.', 'bad'); return; }
      p.act = { n: 'chope', t: 0, dur: 0.6, then: () => { s.bag.tissue--; sg.chope[i] = 1; w.fx.push({ t: 'chope', x: c.tables[i].x, y: c.tables[i].y, k: 1 }); p.act = { n: 'chope-done', t: 0, dur: 0.6 }; } };
      return;
    case 'makan':
      if (s.cash < 4) { w.say('You need 4 coins.', 'bad'); return; }
      s.cash -= 4; sg.chope[i] = 0; p.act = { n: 'eat', t: 0, dur: 2.2, then: () => { p.act = { n: 'shiok', t: 0, dur: 0.9 }; bark(w, p.x, p.y - 50, ['Shiok!'], true); addRep(s, 'market', 1); } }; w.fx.push({ t: 'eat' });
      return;
    case 'taken': bark(w, c.tables[i].x, c.tables[i].y - 40, ['Eh, this one chope already!', 'Got tissue paper means got people, you know.']); return;
    case 'mama': w.ui = { kind: 'mama' }; w.fx.push({ t: 'open' }); return;
    case 'chess':
      p.act = { n: 'sit-chess', t: 0, dur: 2.6, then: () => { bark(w, c.chess[0], c.chess[1] - 60, BARKS.goh); if (!sg.once.has('chess')) { sg.once.add('chess'); addRep(s, 'market', 1); } } };
      return;
    case 'junk':
      if (s.bag.junk >= 6) { w.say('Your arms are full of newspapers. Sell them to Mr Ong first.', 'bad'); return; }
      p.act = { n: 'pick-litter', t: 0, dur: 0.6, then: () => { sg.junk = sg.junk.filter(j => j !== i); s.bag.junk++; s.stats.junk = (s.stats.junk ?? 0) + 1; w.fx.push({ t: 'pickup' }); } };
      return;
    case 'litter':
      p.act = { n: 'pick-litter', t: 0, dur: 0.6, then: () => { sg.litter.splice(i, 1); sg.held++; w.say('Now find a bin (the green ones).'); } };
      return;
    case 'bin':
      p.act = { n: 'bin-litter', t: 0, dur: 0.6, then: () => { if (s.bag.gum > 0) s.bag.gum = 0; else sg.held = Math.max(0, sg.held - 1); addRep(s, districtAt(Math.floor(p.x / T), Math.floor(p.y / T)), 1); bark(w, p.x + 30, p.y - 50, ['Wah, good citizen!']); } };
      return;
    case 'ong': {
      const n = s.bag.junk, coins = n * 3;
      p.act = { n: 'sell-junk', t: 0, dur: 0.8, then: () => { s.bag.junk = 0; s.cash += coins; bark(w, sg.ong.b.x, sg.ong.b.y - 40, [`${n} bundle${n > 1 ? 's' : ''}, ${coins} coins. Steady!`]); w.fx.push({ t: 'coin', k: coins }); } };
      sg.ong.wait = 2; return;
    }
    case 'gum':
      p.act = { n: 'pick-litter', t: 0, dur: 0.5, then: () => { sg.gum = sg.gum.filter(j => j !== i); s.bag.gum = 1; sg.gumT = 9; w.say('Chewing gum! In this city that’s a fine if a warden sees you. Spit it in a bin.', 'bad'); } };
      return;
    case 'feed':
      p.act = { n: 'feed', t: 0, dur: 1.2, then: () => { s.bag.seed--; for (const pg of sg.pigeons) if (dist(pg.x, pg.y, p.x, p.y) < 260) { pg.x += (p.x - pg.x) * 0.5; pg.y += (p.y + 40 - pg.y) * 0.5; } w.fx.push({ t: 'coo', x: p.x, y: p.y }); offence(w, 'pigeons', p.x, p.y); } };
      return;
    case 'angpao':
      if (s.cash < 2) { w.say('You need 2 coins.', 'bad'); return; }
      s.cash -= 2; sg.once.add('angpao'); p.act = { n: 'serve', t: 0, dur: 0.8, then: () => { addRep(s, districtAt(Math.floor(p.x / T), Math.floor(p.y / T)), 2); bark(w, sg.lion.x, sg.lion.y - 70, BARKS.lion); w.fx.push({ t: 'good-deed', k: 0 }); } };
      return;
    case 'lantern': p.carry = 'lantern'; sg.lantern = 0; w.say('Walk with the lantern kids for a while.', 'good'); return;
    case 'getai': sg.once.add('getai'); p.act = { n: 'clap', t: 0, dur: 1.6, then: () => { addRep(s, 'docks', 2); bark(w, c.getai[0], c.getai[1] - 90, [BARKS.lily[1]]); } }; return;
    case 'kopi': w.ui = { kind: 'mini', mini: 'kopi', level: 1, from: 'sg' }; w.fx.push({ t: 'mini' }); return;
  }
}
/** the mama shop: a few coins for the things the streets need */
export const MAMA: { id: 'tissue' | 'seed' | 'banana'; name: string; n: number; price: number; blurb: string }[] = [
  { id: 'tissue', name: 'Tissue packets', n: 3, price: 2, blurb: 'Three packets. Leave one on a table to chope it.' },
  { id: 'seed', name: 'Bird seed', n: 1, price: 2, blurb: 'The pigeons love it. The wardens don’t.' },
  { id: 'banana', name: 'Bananas', n: 2, price: 3, blurb: 'The Bukit Bunch can’t resist a banana: toss one to a macaque (E) and it drops what it took.' },
];
export function mamaBuy(w: World, id: string): string | null {
  const it = MAMA.find(m => m.id === id); if (!it) return 'Not sold here';
  if (w.s.cash < it.price) return `Needs ${it.price} coins`;
  if (w.s.bag[it.id] >= 30) return 'Your pockets are full';
  w.s.cash -= it.price; w.s.bag[it.id] += it.n; w.fx.push({ t: 'buy' }); return null;
}
/** the lion dance takes the street: its tiles are closed while it passes (free roam only) */
export function sgGates(w: World, gates: Set<number>) {
  const L = w.sg.lion; if (!L.on || w.run) return;
  const tx = Math.floor(L.x / T);
  const y0 = Math.floor(LION_ROAD.y / T) - 1;
  for (let y = y0; y <= y0 + 3; y++) for (let x = tx - 1; x <= tx + 1; x++) if (x >= 0 && x < W) gates.add(y * W + x);
}
/** something cars must stop for (the lion dance) */
export const sgBlockers = (w: World): [number, number, number][] => w.sg.lion.on ? [[w.sg.lion.x, w.sg.lion.y, 70]] : [];

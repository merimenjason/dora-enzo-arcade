// Glimmer Cave's weapons: each weapon's state, firing and shots. Deterministic and DOM-free. The dive calls
// `runWeapons` once per step for the hero and once for the buddy, after it rebuilds its critter grid.

import { BASE, BUDDY_DAMAGE, CLASS, CRITTERS, DIG_TIME, ELITE, WEAPONS, WYRM, WYRM_ID, type OverclockId, type WeaponId } from './glimmer-cave-data.js';
import { solid, tileAt } from './glimmer-cave-map.js';
import type { Critter, Dive } from './glimmer-cave-game.js';

/** A held weapon. `dmg`, `rate` and `size` are summed card bonuses; `count` is the extra count; `cd` is the time to
 *  the next fire; `n` counts fires, for "every 5th volley" and "every 3rd pulse". */
export type WeaponState = { id: WeaponId; level: number; overclocks: OverclockId[]; dmg: number; rate: number; size: number; count: number; cd: number; n: number };

export function newWeapon(id: WeaponId): WeaponState {
  return { id, level: 1, overclocks: [], dmg: 0, rate: 0, size: 0, count: 0, cd: 0, n: 0 };
}

export type Owner = 'hero' | 'buddy';

/**
 * A live shot: a projectile, a zone, an orbiter or a short-lived effect for the scene to draw. Positions are in tiles.
 * Every shot carries its owner, its weapon and `t`, its age in seconds. Effects (`splash`, `burst`, `lance`, a
 * resolved `swing` or `thump`) only show and fade.
 */
type ShotBase = { who: Owner; w: WeaponState; t: number };
export type Shot = ShotBase & (
  /** An acorn: `dx`, `dy` is its unit heading, `v` its speed, `left` the tiles it may still fly. */
  | { k: 'acorn'; x: number; y: number; dx: number; dy: number; v: number; left: number; dmg: number; knock: number; bounces: number; hit: number[] }
  /** A pickaxe swing of `arc` degrees about `ang` (radians). `wait` > 0 is a Double Tap swing still to come. */
  | { k: 'swing'; x: number; y: number; ang: number; arc: number; reach: number; quake: number; wait: number; dmg: number; gold: number }
  /** A lobbed pebble from (x0, y0) to (x1, y1) over `dur` s; (x, y) is its shadow and `h` its height, 0 to 1. */
  | { k: 'pebble'; x: number; y: number; h: number; x0: number; y0: number; x1: number; y1: number; dur: number; dmg: number; splash: number; bounces: number }
  | { k: 'splash'; x: number; y: number; r: number }
  /** A Sticky patch that slows critters inside it by `slow`. */
  | { k: 'patch'; x: number; y: number; r: number; left: number; slow: number }
  /** A lantern pulse growing from 0 to `max`. */
  | { k: 'ring'; x: number; y: number; r: number; max: number; dmg: number; hit: Set<number>; healed: number }
  | { k: 'lance'; x: number; y: number; dx: number; dy: number; len: number }
  /** A puff cone of `cone` degrees and `len` tiles; a Choking Cloud stays `left` s and hits again every tick. */
  | { k: 'puff'; x: number; y: number; dx: number; dy: number; len: number; cone: number; left: number; tick: number; dmg: number; slow: number; cloud: boolean }
  /** A twig flying out `out` more tiles, hovering (`hover` s, Whirl) or coming back. */
  | { k: 'twig'; x: number; y: number; dx: number; dy: number; v: number; out: number; back: boolean; hover: number; spin: number; dmg: number; hit: Set<number> }
  /** An orbiting seed at angle `ang` (radians) and radius `r`, turning `dir`; `cd` is its time to the next touch. */
  | { k: 'seed'; x: number; y: number; ang: number; dir: 1 | -1; r: number; cd: number; rest: number; dmg: number }
  | { k: 'bramble'; x: number; y: number; r: number; left: number; tick: number; dmg: number }
  | { k: 'bomb'; x: number; y: number; fuse: number; r: number; dmg: number; chain: boolean; gold: boolean }
  | { k: 'burst'; x: number; y: number; r: number }
  /** A glow moth resting on its owner, out after `target`, or flying back. */
  | { k: 'moth'; x: number; y: number; state: 'rest' | 'out' | 'back'; target: Critter | null; cd: number; rest: number; v: number; dmg: number; hit: Set<number> }
  /** A drum thump of radius `r`; `wait` > 0 is an Echo still to come. */
  | { k: 'thump'; x: number; y: number; r: number; wait: number; dmg: number; dig: boolean }
  /** A drill: `hit` maps each critter it has touched to the drill's age at that touch, for the per-tick damage. */
  | { k: 'drill'; x: number; y: number; dx: number; dy: number; v: number; left: number; dmg: number; hit: Map<number, number> }
);

// ── Tuning (calls; the spec leaves these to the build) ─────────────────────

/** "Knocks back" and a pulse's push move a critter this far, stopping at rock. */
const KNOCK = 0.5;
/** No slow takes more than 90% of a critter's speed, so a ramming beetle never freezes. */
const SLOW_MAX = 0.9;
/** How long a hit critter shows its flinch. */
const HIT_FLASH = 0.2;
/** The biggest target radius (the wyrm's head, else an elite beetle), plus room for a knockback since the grid was built. */
const PAD = Math.max(CRITTERS.beetle.radius * ELITE.size, WYRM.head) + KNOCK + 0.1;
const ACORN_R = 0.1, TWIG_R = 0.3, MOTH_R = 0.15, SEED_R = 0.25, BRAMBLE_R = 0.5;
/** A lantern pulse grows at this many tiles a second, then lingers. */
const PULSE_SPEED = 12, RING_LINGER = 0.15;
/** A lance pierces this many critters until Long Shard; it looks this far for the densest crowd. */
const LANCE_PIERCE = 3, LANCE_LOOK = 6;
/** Degrees between Prism's lances, the boomerangs of a Pair, and extra acorns or drills. */
const PRISM_SPREAD = 20, TWIG_SPREAD = 20;
/** Cluster pebbles land this far from the first; a Bouncy pebble hops this far in this long. */
const CLUSTER_OUT = 1, BOUNCE_HOP = 1.5, BOUNCE_FLIGHT = 0.4;
/** A Choking Cloud hits whatever is inside it this often. A Whirl twig hits again this often. */
const CLOUD_TICK = 0.5, HOVER_TICK = 0.25;
/** A Chain Blast's second bomb goes off this soon. */
const CHAIN_FUSE = 0.2;
/** A moth gives up after this long out; it lands back within CATCH tiles of its owner, as a twig does. */
const MOTH_OUT = 2, CATCH = 0.3;
/** How long each effect shows. */
const SHOW = { splash: 0.3, burst: 0.3, lance: 0.25, swing: 0.2, thump: 0.4, puff: 0.25 };
const DEG = Math.PI / 180;

// ── Effective stats ────────────────────────────────────────────────────────

/** A weapon's numbers after cards, overclocks and its owner. `dmg` is before all-damage bonuses and crits, which
 *  `hurtCritter` adds; `cd` is seconds between fires; `size` multiplies radii and lengths; `count` is extra
 *  projectiles; `speed` multiplies projectile speeds. */
export type Eff = { dmg: number; cd: number; size: number; count: number; speed: number };

/** The overclocks that multiply damage, and by how much more. */
const OC_DAMAGE: Partial<Record<OverclockId, number>> = {
  'sling.heavy': WEAPONS.sling.p.heavy, 'puffer.pepper': WEAPONS.puffer.p.pepper,
  'boomerang.sharp': WEAPONS.boomerang.p.sharp, 'drill.diamond': WEAPONS.drill.p.diamond,
};

/** The one place a weapon's card bonuses become numbers: damage x (1 + dmg), cooldown / (1 + rate) x the hero's
 *  cooldown multiplier, sizes x (1 + size), and count extra. The buddy's weapon does BUDDY_DAMAGE and ignores the
 *  hero's passives. */
export function effective(d: Dive, w: WeaponState, who: Owner = 'hero'): Eff {
  const def = WEAPONS[w.id], hero = who === 'hero';
  let dmg = def.damage * (1 + w.dmg) * (hero ? 1 : BUDDY_DAMAGE);
  for (const oc of w.overclocks) dmg *= 1 + (OC_DAMAGE[oc] ?? 0);
  const base = has(w, 'drum.quick') ? def.p.quickCooldown : def.cooldown;
  const cls = hero ? d.hero : d.hero === 'dora' ? 'enzo' : 'dora';
  return { dmg, cd: base / (1 + w.rate) * (hero ? d.st.cooldown : 1), size: 1 + w.size, count: w.count, speed: CLASS[cls].projectile };
}

const has = (w: WeaponState, oc: OverclockId) => w.overclocks.includes(oc);

// ── Hits ───────────────────────────────────────────────────────────────────

/** `buddy` hits take no all-damage bonus and never crit; `glimmer` gives a bonk a chance of double crystals. */
export type HitOpts = { buddy?: boolean; glimmer?: boolean };
const HERO_HIT: HitOpts = {}, BUDDY_HIT: HitOpts = { buddy: true }, GLIMMER_HIT: HitOpts = { glimmer: true };

/**
 * Hits a critter for `base` from (x, y): rolls the crit, applies the hero's all-damage bonus and emits `hit`. At 0
 * Fluff it emits `bonk`, drops its crystals (ELITE.cache for an elite) and counts it; otherwise `knock` pushes it that
 * far away from (x, y). Returns the damage done. A critter already bonked this step takes nothing. The wyrm's head
 * (id WYRM_ID) passes its damage to `Dive.hurtWyrm` and is never knocked.
 */
export function hurtCritter(d: Dive, c: Critter, base: number, x: number, y: number, o: HitOpts = HERO_HIT, knock = 0): number {
  if (c.fluff <= 0) return 0;
  let dmg = base, crit = false;
  if (!o.buddy) {
    dmg *= d.st.damage;
    if (!d.critOff && d.rand.next() < d.st.crit) { crit = true; dmg *= BASE.critMult; }
  }
  d.events.push({ k: 'hit', id: c.id, x: c.x, y: c.y, dmg, crit });
  // The wyrm's head stands in the grid as a critter; its Fluff, diving and bonk are the dive's.
  if (c.id === WYRM_ID) { d.hurtWyrm(dmg); return dmg; }
  c.fluff -= dmg; c.hit = HIT_FLASH;
  if (c.fluff <= 0) {
    d.bonked++;
    d.events.push({ k: 'bonk', id: c.id, kind: c.kind, elite: c.elite, x: c.x, y: c.y });
    const n = c.elite ? ELITE.cache : CRITTERS[c.kind].xp;
    d.crystals.push({ x: c.x, y: c.y, n });
    if (o.glimmer && d.rand.next() < WEAPONS.lance.p.glimmerChance) d.crystals.push({ x: c.x + 0.2, y: c.y, n });
  } else if (knock) {
    const ex = c.x - x, ey = c.y - y, l = Math.hypot(ex, ey);
    if (l > 1e-6) d.nudge(c, ex / l * knock, ey / l * knock);
  }
  return dmg;
}

/** The hit options for the owner being run; set by `runWeapons`. */
let opts: HitOpts = HERO_HIT;
const hit = (d: Dive, c: Critter, dmg: number, x: number, y: number, knock = 0) => hurtCritter(d, c, dmg, x, y, opts, knock);

function slowCritter(c: Critter, slow: number, secs: number) {
  c.slow = Math.min(SLOW_MAX, Math.max(c.slow, slow)); c.slowFor = Math.max(c.slowFor, secs);
}
function stunCritter(c: Critter, secs: number) { c.stun = Math.max(c.stun, secs); }

// ── Geometry ───────────────────────────────────────────────────────────────

const rad = (c: Critter) => c.id === WYRM_ID ? WYRM.head : CRITTERS[c.kind].radius * (c.elite ? ELITE.size : 1);
const scratch: Critter[] = [], scratch2: Critter[] = [];

/** The live critters a shot of radius r touches sweeping from (x, y) along the unit (ux, uy) for len tiles, nearest
 *  first. Segment against circle, so nothing is skipped however far a step goes. */
function along(d: Dive, x: number, y: number, ux: number, uy: number, len: number, r: number) {
  const out: { c: Critter; t: number }[] = [];
  for (const c of d.grid.near(x + ux * len / 2, y + uy * len / 2, len / 2 + r + PAD, scratch)) {
    if (c.fluff <= 0) continue;
    const px = c.x - x, py = c.y - y, s = px * ux + py * uy, t = Math.max(0, Math.min(len, s)), ex = px - ux * t, ey = py - uy * t, rr = r + rad(c);
    if (ex * ex + ey * ey <= rr * rr) out.push({ c, t: s });
  }
  return out.sort((a, b) => a.t - b.t || a.c.id - b.c.id);
}

/** Live critters whose circles reach within r of (x, y), into `out`. */
function within(d: Dive, x: number, y: number, r: number, out = scratch) {
  const got = d.grid.near(x, y, r + PAD, out);
  let k = 0;
  for (const c of got) { const rr = r + rad(c); if (c.fluff > 0 && (c.x - x) ** 2 + (c.y - y) ** 2 <= rr * rr) got[k++] = c; }
  got.length = k;
  return got;
}

/** The nearest live critter whose centre is within range of (x, y), skipping the ids in `skip`. */
function nearest(d: Dive, x: number, y: number, range: number, skip: number[] | null): Critter | null {
  let best: Critter | null = null, bd = Infinity;
  for (const c of d.grid.near(x, y, range + PAD, scratch)) {
    if (c.fluff <= 0 || (skip && skip.includes(c.id))) continue;
    const d2 = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d2 <= range * range && (d2 < bd || (d2 === bd && best && c.id < best.id))) { bd = d2; best = c; }
  }
  return best;
}

const rockAt = (d: Dive, x: number, y: number) => solid(tileAt(d.map, Math.floor(x), Math.floor(y)));
const diggable = (d: Dive, tx: number, ty: number) => tileAt(d.map, tx, ty) in DIG_TIME;

/** How far a shot of radius r gets from (x, y) along (ux, uy), up to len, before rock or a blocker (the wyrm). */
function clear(d: Dive, x: number, y: number, ux: number, uy: number, len: number, r: number) {
  const n = Math.max(1, Math.ceil(len / 0.2));
  for (let i = 1; i <= n; i++) {
    const s = len * i / n, px = x + ux * s, py = y + uy * s;
    if (rockAt(d, px, py) || d.blocks(px, py, r)) return len * (i - 1) / n;
  }
  return len;
}

/** Digs every diggable block whose centre is within r of (x, y) and, unless cosHalf is -2, inside the sector of
 *  half-angle acos(cosHalf) about (fx, fy). */
function digIn(d: Dive, x: number, y: number, r: number, fx: number, fy: number, cosHalf: number, gold = 1, always = false) {
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
    if (!diggable(d, tx, ty)) continue;
    const ex = tx + 0.5 - x, ey = ty + 0.5 - y, l = Math.hypot(ex, ey);
    if (l > r || (l > 1e-6 && (ex * fx + ey * fy) / l < cosHalf - 1e-9)) continue;
    d.digBlock(tx, ty, gold, always);
  }
}

const ownerX = (d: Dive, who: Owner) => who === 'hero' ? d.hx : d.buddy.x;
const ownerY = (d: Dive, who: Owner) => who === 'hero' ? d.hy : d.buddy.y;
const fired = (d: Dive, w: WeaponId, x: number, y: number, dx: number, dy: number) => { d.events.push({ k: 'fire', w, x, y, dx, dy }); };

// ── Running the weapons ────────────────────────────────────────────────────

const NONE: WeaponState[] = [];

/** Advances the owner's shots, then fires each of its weapons whose cooldown is up. A weapon with nothing to aim at
 *  waits, ready, until it has. Shots fired this step first move next step. */
export function runWeapons(d: Dive, who: Owner): void {
  const ws = who === 'hero' ? d.weapons : d.buddyWeapon ? [d.buddyWeapon] : NONE;
  opts = who === 'buddy' ? BUDDY_HIT : ws.some(w => w.id === 'lance' && has(w, 'lance.glimmer')) ? GLIMMER_HIT : HERO_HIT;
  const sh = d.shots;
  let k = 0;
  // Shots added while advancing (splashes, brambles, a chain bomb) are appended and advanced in this same pass.
  for (let i = 0; i < sh.length; i++) { const s = sh[i]; if (s.who !== who || advance(d, s)) sh[k++] = s; }
  sh.length = k;
  const ox = ownerX(d, who), oy = ownerY(d, who);
  for (const w of ws) {
    const e = effective(d, w, who);
    if (w.id === 'orbit') { keepSeeds(d, w, who, e, ox, oy); continue; }
    if (w.id === 'moths') { keepMoths(d, w, who, e, ox, oy); continue; }
    w.cd -= d.dt;
    if (w.cd > 1e-9) continue;
    if (FIRE[w.id](d, w, who, e, ox, oy)) { w.n++; w.cd += e.cd; } else w.cd = 0;
  }
}

type Fire = (d: Dive, w: WeaponState, who: Owner, e: Eff, ox: number, oy: number) => boolean;

/** Moves one shot a step; false when it's done. */
function advance(d: Dive, s: Shot): boolean {
  s.t += d.dt;
  switch (s.k) {
    case 'acorn': return acorn(d, s);
    case 'swing':
      if (s.wait > 0) { s.wait -= d.dt; if (s.wait <= 1e-9) { swing(d, s); s.t = 0; } return true; }
      return s.t < SHOW.swing;
    case 'pebble': return pebble(d, s);
    case 'patch':
      s.left -= d.dt;
      for (const c of within(d, s.x, s.y, s.r)) slowCritter(c, s.slow, 0.1);
      return s.left > 0;
    case 'ring': return ring(d, s);
    case 'puff':
      if (s.cloud) { s.tick -= d.dt; if (s.tick <= 1e-9) { s.tick += CLOUD_TICK; puffHit(d, s); } }
      return s.t < s.left;
    case 'twig': return twig(d, s);
    case 'seed': return seed(d, s);
    case 'bramble':
      s.left -= d.dt; s.tick -= d.dt;
      if (s.tick <= 1e-9) { s.tick += WEAPONS.orbit.p.sproutTick; for (const c of within(d, s.x, s.y, s.r)) hit(d, c, s.dmg, s.x, s.y); }
      return s.left > 0;
    case 'bomb':
      s.fuse -= d.dt;
      if (s.fuse > 1e-9) return true;
      bomb(d, s);
      return false;
    case 'moth': return moth(d, s);
    case 'thump':
      if (s.wait > 0) { s.wait -= d.dt; if (s.wait <= 1e-9) { s.x = ownerX(d, s.who); s.y = ownerY(d, s.who); thump(d, s); s.t = 0; } return true; }
      return s.t < SHOW.thump;
    case 'drill': return drill(d, s);
    case 'splash': return s.t < SHOW.splash;
    case 'burst': return s.t < SHOW.burst;
    case 'lance': return s.t < SHOW.lance;
  }
}

// ── Acorn Sling: the nearest critter in range ──────────────────────────────

const sling: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.sling.p, c = nearest(d, ox, oy, p.range, null);
  if (!c) return false;
  const aim = Math.atan2(c.y - oy, c.x - ox), knock = has(w, 'sling.heavy') ? KNOCK * p.knock : 0, bounces = has(w, 'sling.ricochet') ? p.bounces : 0;
  const storm = has(w, 'sling.storm') && (w.n + 1) % p.stormEvery === 0;
  const n = (storm ? p.stormN : has(w, 'sling.twin') ? 2 : 1) + e.count, gap = storm ? 2 * Math.PI / n : p.twinAngle * DEG;
  for (let i = 0; i < n; i++) {
    const a = storm ? aim + i * gap : aim + (i - (n - 1) / 2) * gap;
    d.shots.push({ k: 'acorn', who, w, t: 0, x: ox, y: oy, dx: Math.cos(a), dy: Math.sin(a), v: p.speed * e.speed, left: p.range + 1, dmg: e.dmg, knock, bounces, hit: [] });
  }
  fired(d, 'sling', ox, oy, Math.cos(aim), Math.sin(aim));
  return true;
};

/** Flies a step, hitting the first critter on its path; Ricochet turns it to the nearest critter it hasn't hit. */
function acorn(d: Dive, s: Extract<Shot, { k: 'acorn' }>): boolean {
  let go = s.v * d.dt;
  while (go > 1e-9) {
    const len = Math.min(go, s.left), free = clear(d, s.x, s.y, s.dx, s.dy, len, ACORN_R);
    const f = along(d, s.x, s.y, s.dx, s.dy, free, ACORN_R).find(h => !s.hit.includes(h.c.id));
    if (!f) {
      s.x += s.dx * free; s.y += s.dy * free; s.left -= len;
      return free >= len && s.left > 1e-9;
    }
    const to = Math.max(0, Math.min(free, f.t - rad(f.c) - ACORN_R));
    s.x += s.dx * to; s.y += s.dy * to; s.left -= to; go -= to;
    hit(d, f.c, s.dmg, s.x, s.y, s.knock); s.hit.push(f.c.id);
    if (s.bounces <= 0) return false;
    s.bounces--;
    const n = nearest(d, s.x, s.y, WEAPONS.sling.p.range, s.hit);
    if (!n) return false;
    const ex = n.x - s.x, ey = n.y - s.y, l = Math.hypot(ex, ey) || 1;
    s.dx = ex / l; s.dy = ey / l; s.left = WEAPONS.sling.p.range + 1;
  }
  return true;
}

// ── Pickaxe Bonk: an arc the way the hero faces, which digs ────────────────

const pickaxe: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.pickaxe.p;
  const make = (wait: number): Shot => ({
    k: 'swing', who, w, t: 0, x: ox, y: oy, ang: 0, wait, dmg: e.dmg, arc: has(w, 'pickaxe.wide') ? p.wideArc : p.arc,
    reach: p.reach * e.size, quake: has(w, 'pickaxe.quake') ? p.quakeReach * e.size : 0, gold: has(w, 'pickaxe.goldrush') ? 1 + p.goldrush : 1,
  });
  const now = make(0) as Extract<Shot, { k: 'swing' }>;
  swing(d, now); d.shots.push(now);
  if (has(w, 'pickaxe.double')) d.shots.push(make(p.doubleDelay));
  fired(d, 'pickaxe', ox, oy, d.face.x, d.face.y);
  return true;
};

/** Swings from the owner now: hits every critter in the arc within reach (Quake Bonk: out to its shockwave) and digs
 *  every block whose centre is in the arc within reach. */
function swing(d: Dive, s: Extract<Shot, { k: 'swing' }>) {
  const ox = ownerX(d, s.who), oy = ownerY(d, s.who), fx = d.face.x, fy = d.face.y, cosHalf = Math.cos(s.arc / 2 * DEG);
  s.x = ox; s.y = oy; s.ang = Math.atan2(fy, fx);
  for (const c of within(d, ox, oy, Math.max(s.reach, s.quake))) {
    const ex = c.x - ox, ey = c.y - oy, l = Math.hypot(ex, ey);
    if (l > 1e-6 && (ex * fx + ey * fy) / l < cosHalf - 1e-9) continue;
    hit(d, c, s.dmg, ox, oy);
  }
  digIn(d, ox, oy, s.reach, fx, fy, cosHalf, s.gold);
}

// ── Pebble Popper: a lob at a random critter in range ──────────────────────

const popper: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.popper.p, list = d.grid.near(ox, oy, p.range, scratch).filter(c => c.fluff > 0);
  if (!list.length) return false;
  const c = list[d.rand.int(list.length)];
  d.shots.push({
    k: 'pebble', who, w, t: 0, x: ox, y: oy, h: 0, x0: ox, y0: oy, x1: c.x, y1: c.y, dur: p.flight, dmg: e.dmg,
    splash: p.splash * e.size * (has(w, 'popper.big') ? 1 + p.bigSplash : 1), bounces: has(w, 'popper.bouncy') ? p.bounces : 0,
  });
  fired(d, 'popper', ox, oy, c.x - ox, c.y - oy);
  return true;
};

/** Flies a step; on landing it splashes (Cluster: three splashes around the spot), leaves a Sticky patch, and Bouncy
 *  hops it on along its line. */
function pebble(d: Dive, s: Extract<Shot, { k: 'pebble' }>): boolean {
  const f = Math.min(1, s.t / s.dur);
  s.x = s.x0 + (s.x1 - s.x0) * f; s.y = s.y0 + (s.y1 - s.y0) * f; s.h = 4 * f * (1 - f);
  if (f < 1) return true;
  const p = WEAPONS.popper.p, l = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
  const ux = l > 1e-6 ? (s.x1 - s.x0) / l : d.face.x, uy = l > 1e-6 ? (s.y1 - s.y0) / l : d.face.y;
  if (has(s.w, 'popper.cluster')) {
    const a0 = Math.atan2(uy, ux);
    for (let i = 0; i < p.cluster; i++) { const a = a0 + i * 2 * Math.PI / p.cluster; splash(d, s, s.x + Math.cos(a) * CLUSTER_OUT, s.y + Math.sin(a) * CLUSTER_OUT); }
  } else splash(d, s, s.x, s.y);
  if (has(s.w, 'popper.sticky')) d.shots.push({ k: 'patch', who: s.who, w: s.w, t: 0, x: s.x, y: s.y, r: s.splash, left: p.stickyFor, slow: p.stickySlow });
  if (s.bounces <= 0) return false;
  s.bounces--; s.t = 0; s.dur = BOUNCE_FLIGHT; s.x0 = s.x; s.y0 = s.y; s.x1 = s.x + ux * BOUNCE_HOP; s.y1 = s.y + uy * BOUNCE_HOP;
  return true;
}

function splash(d: Dive, s: Extract<Shot, { k: 'pebble' }>, x: number, y: number) {
  for (const c of within(d, x, y, s.splash)) hit(d, c, s.dmg, x, y);
  d.shots.push({ k: 'splash', who: s.who, w: s.w, t: 0, x, y, r: s.splash });
}

// ── Lantern Pulse: a ring from the owner that pushes ───────────────────────

const pulse: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.pulse.p, beacon = has(w, 'pulse.beacon') && (w.n + 1) % p.beaconEvery === 0;
  const max = p.radius * e.size * (has(w, 'pulse.bright') ? 1 + p.bright : 1) * (beacon ? p.beaconMult : 1);
  d.shots.push({ k: 'ring', who, w, t: 0, x: ox, y: oy, r: 0, max, dmg: e.dmg, hit: new Set(), healed: 0 });
  fired(d, 'pulse', ox, oy, 0, 0);
  return true;
};

/** Grows a step, hitting and pushing each critter its edge reaches once; Warm slows them, Hearth heals per hit. */
function ring(d: Dive, s: Extract<Shot, { k: 'ring' }>): boolean {
  if (s.r >= s.max) return s.t < s.max / PULSE_SPEED + RING_LINGER;
  s.r = Math.min(s.max, s.r + PULSE_SPEED * d.dt);
  const p = WEAPONS.pulse.p, warm = has(s.w, 'pulse.warm'), hearth = has(s.w, 'pulse.hearth');
  for (const c of within(d, s.x, s.y, s.r)) {
    if (s.hit.has(c.id)) continue;
    s.hit.add(c.id);
    hit(d, c, s.dmg, s.x, s.y, KNOCK);
    if (warm) slowCritter(c, p.warmSlow, p.warmFor);
    if (hearth && s.healed < p.healMax) { s.healed++; d.fluff = Math.min(d.st.maxFluff, d.fluff + p.heal); }
  }
  return true;
}

// ── Crystal Lance: a piercing line toward the densest crowd ────────────────

const lance: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.lance.p, count = [0, 0, 0, 0, 0, 0, 0, 0], sx = [0, 0, 0, 0, 0, 0, 0, 0], sy = [0, 0, 0, 0, 0, 0, 0, 0];
  let any = false;
  for (const c of d.grid.near(ox, oy, LANCE_LOOK, scratch)) {
    if (c.fluff <= 0) continue;
    const i = (Math.round(Math.atan2(c.y - oy, c.x - ox) / (Math.PI / 4)) + 8) % 8;
    count[i]++; sx[i] += c.x - ox; sy[i] += c.y - oy; any = true;
  }
  if (!any) return false;
  // The 8-way sector with the most critters; ties go to the one nearest the way the hero faces.
  const fi = (Math.round(Math.atan2(d.face.y, d.face.x) / (Math.PI / 4)) + 8) % 8;
  let best = fi;
  for (let j = 1; j < 8; j++) for (const i of [(fi + j) % 8, (fi - j + 8) % 8]) if (count[i] > count[best]) best = i;
  // Aim at the mean offset of the winning sector's critters, so a crowd off the compass point is still struck.
  const aim = sx[best] || sy[best] ? Math.atan2(sy[best], sx[best]) : best * Math.PI / 4, long = has(w, 'lance.long'), n = has(w, 'lance.prism') ? p.prism : 1;
  for (let i = 0; i < n; i++) {
    const a = aim + (i - (n - 1) / 2) * PRISM_SPREAD * DEG, ux = Math.cos(a), uy = Math.sin(a);
    const len = clear(d, ox, oy, ux, uy, p.length * e.size * (long ? p.longMult : 1), p.width / 2);
    const struck = along(d, ox, oy, ux, uy, len, p.width / 2).slice(0, long ? Infinity : LANCE_PIERCE);
    for (const { c } of struck) {
      hit(d, c, e.dmg, ox, oy);
      if (!has(w, 'lance.resonance')) continue;
      for (const o of d.grid.near(c.x, c.y, p.chimeReach, scratch2)) if (o !== c && o.fluff > 0) hit(d, o, e.dmg * p.chime, c.x, c.y);
    }
    d.shots.push({ k: 'lance', who, w, t: 0, x: ox, y: oy, dx: ux, dy: uy, len });
  }
  fired(d, 'lance', ox, oy, Math.cos(aim), Math.sin(aim));
  return true;
};

// ── Dust Puffer: a cone the way the hero faces, which slows ────────────────

const puffer: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.puffer.p, cloud = has(w, 'puffer.cloud'), pepper = has(w, 'puffer.pepper');
  for (const back of has(w, 'puffer.sneezy') ? [1, -1] : [1]) {
    const s: Extract<Shot, { k: 'puff' }> = {
      k: 'puff', who, w, t: 0, x: ox, y: oy, dx: d.face.x * back, dy: d.face.y * back, len: p.length * e.size,
      cone: has(w, 'puffer.big') ? p.wideCone : p.cone, left: cloud ? p.cloudFor : SHOW.puff, tick: CLOUD_TICK, dmg: e.dmg, slow: pepper ? 0 : p.slow, cloud,
    };
    puffHit(d, s); d.shots.push(s);
  }
  fired(d, 'puffer', ox, oy, d.face.x, d.face.y);
  return true;
};

function puffHit(d: Dive, s: Extract<Shot, { k: 'puff' }>) {
  const cosHalf = Math.cos(s.cone / 2 * DEG);
  for (const c of within(d, s.x, s.y, s.len)) {
    const ex = c.x - s.x, ey = c.y - s.y, l = Math.hypot(ex, ey);
    if (l > 1e-6 && (ex * s.dx + ey * s.dy) / l < cosHalf - 1e-9) continue;
    hit(d, c, s.dmg, s.x, s.y);
    if (s.slow > 0) slowCritter(c, s.slow, WEAPONS.puffer.p.slowFor);
  }
}

// ── Twig Boomerang: out at the nearest critter (or ahead) and back ─────────

const boomerang: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.boomerang.p, range = has(w, 'boomerang.long') ? p.longRange : p.range, c = nearest(d, ox, oy, range, null);
  const aim = c ? Math.atan2(c.y - oy, c.x - ox) : Math.atan2(d.face.y, d.face.x), n = (has(w, 'boomerang.pair') ? p.pair : 1) + e.count;
  for (let i = 0; i < n; i++) {
    const a = aim + (i - (n - 1) / 2) * TWIG_SPREAD * DEG;
    d.shots.push({ k: 'twig', who, w, t: 0, x: ox, y: oy, dx: Math.cos(a), dy: Math.sin(a), v: p.speed * e.speed, out: range, back: false, hover: 0, spin: 0, dmg: e.dmg, hit: new Set() });
  }
  fired(d, 'boomerang', ox, oy, Math.cos(aim), Math.sin(aim));
  return true;
};

/** Out until its range or rock, hitting each critter once; Whirl hovers there, hitting again every HOVER_TICK;
 *  then it homes back to its owner, hitting each critter once more. */
function twig(d: Dive, s: Extract<Shot, { k: 'twig' }>): boolean {
  const sweep = (ux: number, uy: number, len: number) => {
    for (const { c } of along(d, s.x, s.y, ux, uy, len, TWIG_R)) if (!s.hit.has(c.id)) { s.hit.add(c.id); hit(d, c, s.dmg, s.x, s.y); }
  };
  if (s.hover > 0) {
    s.hover -= d.dt; s.spin -= d.dt;
    if (s.spin <= 1e-9) { s.spin += HOVER_TICK; s.hit.clear(); }
    sweep(1, 0, 0);
    if (s.hover <= 1e-9) { s.back = true; s.hit.clear(); }
    return true;
  }
  if (!s.back) {
    const len = Math.min(s.out, s.v * d.dt), free = clear(d, s.x, s.y, s.dx, s.dy, len, TWIG_R);
    sweep(s.dx, s.dy, free);
    s.x += s.dx * free; s.y += s.dy * free; s.out -= len;
    if (free < len || s.out <= 1e-9) {
      s.hit.clear();
      if (has(s.w, 'boomerang.whirl')) { s.hover = WEAPONS.boomerang.p.whirlFor; s.spin = 0; } else s.back = true;
    }
    return true;
  }
  const ex = ownerX(d, s.who) - s.x, ey = ownerY(d, s.who) - s.y, l = Math.hypot(ex, ey), go = s.v * d.dt;
  if (l < 1e-6) return false;
  s.dx = ex / l; s.dy = ey / l;
  sweep(s.dx, s.dy, Math.min(l, go));
  if (l <= go + CATCH) return false;
  s.x += s.dx * go; s.y += s.dy * go;
  return true;
}

// ── Seed Orbit: seeds circling the owner ───────────────────────────────────

/** Keeps the right number of seeds circling (rebuilt evenly spaced when the count changes) and refreshes their
 *  radius, damage and rest from the weapon's current numbers. */
function keepSeeds(d: Dive, w: WeaponState, who: Owner, e: Eff, ox: number, oy: number) {
  const p = WEAPONS.orbit.p, n = (has(w, 'orbit.more') ? p.more : p.seeds) + e.count, rings = has(w, 'orbit.twin') ? 2 : 1;
  const r = (has(w, 'orbit.wide') ? p.wide : p.radius) * e.size;
  let got = 0;
  for (const s of d.shots) if (s.k === 'seed' && s.w === w) { got++; s.r = r; s.dmg = e.dmg; s.rest = e.cd; }
  if (got === n * rings) return;
  remove(d, s => s.k === 'seed' && s.w === w);
  for (let ring = 0; ring < rings; ring++) for (let i = 0; i < n; i++) {
    const ang = 2 * Math.PI * i / n + (ring ? Math.PI / n : 0);
    d.shots.push({ k: 'seed', who, w, t: 0, x: ox + Math.cos(ang) * r, y: oy + Math.sin(ang) * r, ang, dir: ring ? -1 : 1, r, cd: 0, rest: e.cd, dmg: e.dmg });
  }
}

/** Turns a step around the owner; when rested, it hits every critter its arc swept (Sprout: and leaves brambles). */
function seed(d: Dive, s: Extract<Shot, { k: 'seed' }>): boolean {
  const p = WEAPONS.orbit.p, x0 = s.x, y0 = s.y;
  s.ang += s.dir * p.speed * d.dt;
  s.x = ownerX(d, s.who) + Math.cos(s.ang) * s.r; s.y = ownerY(d, s.who) + Math.sin(s.ang) * s.r;
  s.cd -= d.dt;
  if (s.cd > 1e-9) return true;
  const ex = s.x - x0, ey = s.y - y0, l = Math.hypot(ex, ey), ux = l > 1e-9 ? ex / l : 1, uy = l > 1e-9 ? ey / l : 0;
  const struck = along(d, x0, y0, ux, uy, l, SEED_R);
  if (!struck.length) return true;
  for (const { c } of struck) hit(d, c, s.dmg, s.x, s.y);
  s.cd = s.rest;
  if (has(s.w, 'orbit.sprout')) {
    const dmg = p.sproutDamage * s.dmg / WEAPONS.orbit.damage;
    d.shots.push({ k: 'bramble', who: s.who, w: s.w, t: 0, x: s.x, y: s.y, r: BRAMBLE_R, left: p.sproutFor, tick: p.sproutTick, dmg });
  }
  return true;
}

// ── Burrow Bomb: dropped where the owner stands; it bursts and digs ────────

const bombFire: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.bomb.p;
  d.shots.push({
    k: 'bomb', who, w, t: 0, x: ox, y: oy, fuse: has(w, 'bomb.quick') ? p.quickFuse : p.fuse, r: p.radius * e.size * (has(w, 'bomb.bigger') ? 1 + p.bigger : 1),
    dmg: e.dmg, chain: has(w, 'bomb.chain'), gold: has(w, 'bomb.prospector'),
  });
  fired(d, 'bomb', ox, oy, 0, 0);
  return true;
};

/** Bursts: hits everything within its radius and digs every block whose centre is inside it (Prospector: always
 *  for gold). Chain Blast sets off one more bomb 2 tiles the way the hero faces. */
function bomb(d: Dive, s: Extract<Shot, { k: 'bomb' }>) {
  for (const c of within(d, s.x, s.y, s.r)) hit(d, c, s.dmg, s.x, s.y);
  digIn(d, s.x, s.y, s.r, 1, 0, -2, 1, s.gold);
  d.shots.push({ k: 'burst', who: s.who, w: s.w, t: 0, x: s.x, y: s.y, r: s.r });
  if (s.chain) {
    const reach = WEAPONS.bomb.p.chainReach;
    d.shots.push({ ...s, t: 0, x: s.x + d.face.x * reach, y: s.y + d.face.y * reach, fuse: CHAIN_FUSE, chain: false });
  }
}

// ── Glow Moths: out to the nearest critter not already chased, and back ────

function keepMoths(d: Dive, w: WeaponState, who: Owner, e: Eff, ox: number, oy: number) {
  const p = WEAPONS.moths.p, n = (has(w, 'moths.swarm') ? p.swarm : p.moths) + e.count;
  let got = 0;
  for (const s of d.shots) if (s.k === 'moth' && s.w === w) { got++; s.dmg = e.dmg; s.rest = e.cd; s.v = p.speed * e.speed; }
  if (got === n) return;
  remove(d, s => s.k === 'moth' && s.w === w);
  for (let i = 0; i < n; i++) d.shots.push({ k: 'moth', who, w, t: 0, x: ox, y: oy, state: 'rest', target: null, cd: 0, rest: e.cd, v: p.speed * e.speed, dmg: e.dmg, hit: new Set() });
}

/** Rests on its owner until rested and a critter is in range; flies at its target and hits it (Moonlit: everything
 *  it passes through on the way), Dazzle stunning; then flies back, and Firefly bursts around the owner. */
function moth(d: Dive, s: Extract<Shot, { k: 'moth' }>): boolean {
  const p = WEAPONS.moths.p, ox = ownerX(d, s.who), oy = ownerY(d, s.who);
  if (s.state === 'rest') {
    s.x = ox; s.y = oy; s.cd -= d.dt;
    if (s.cd > 1e-9) return true;
    s.cd = 0;
    const chased: number[] = [];
    for (const o of d.shots) if (o.k === 'moth' && o !== s && o.state === 'out' && o.target) chased.push(o.target.id);
    const c = nearest(d, ox, oy, p.range, chased) ?? nearest(d, ox, oy, p.range, null);
    if (!c) return true;
    s.state = 'out'; s.target = c; s.t = 0; s.hit.clear();
    fired(d, 'moths', ox, oy, c.x - ox, c.y - oy);
    return true;
  }
  if (s.state === 'out') {
    const c = s.target;
    if (!c || c.fluff <= 0 || s.t > MOTH_OUT) { s.state = 'back'; s.target = null; return true; }
    const ex = c.x - s.x, ey = c.y - s.y, l = Math.hypot(ex, ey), ux = l > 1e-9 ? ex / l : 1, uy = l > 1e-9 ? ey / l : 0, go = Math.min(l, s.v * d.dt);
    let reached = false;
    for (const { c: o } of along(d, s.x, s.y, ux, uy, go, MOTH_R)) {
      if (o !== c && !has(s.w, 'moths.moonlit')) continue;
      if (s.hit.has(o.id)) continue;
      s.hit.add(o.id); hit(d, o, s.dmg, s.x, s.y);
      if (has(s.w, 'moths.dazzle')) stunCritter(o, p.dazzle);
      if (o === c) reached = true;
    }
    s.x += ux * go; s.y += uy * go;
    if (reached) { s.state = 'back'; s.target = null; }
    return true;
  }
  const ex = ox - s.x, ey = oy - s.y, l = Math.hypot(ex, ey), go = s.v * d.dt;
  if (l > go + CATCH) { s.x += ex / l * go; s.y += ey / l * go; return true; }
  s.x = ox; s.y = oy; s.state = 'rest'; s.cd = s.rest;
  if (has(s.w, 'moths.firefly')) for (const c of within(d, ox, oy, p.fireflyRadius)) hit(d, c, p.fireflyDamage * s.dmg / WEAPONS.moths.damage, ox, oy);
  return true;
}

// ── Rumble Drum: a thump around the owner that stuns ───────────────────────

const drum: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.drum.p;
  const make = (wait: number): Extract<Shot, { k: 'thump' }> => ({
    k: 'thump', who, w, t: 0, x: ox, y: oy, r: (p.radius + (has(w, 'drum.deep') ? p.deep : 0)) * e.size, wait, dmg: e.dmg, dig: has(w, 'drum.avalanche'),
  });
  const now = make(0);
  thump(d, now); d.shots.push(now);
  if (has(w, 'drum.echo')) d.shots.push(make(p.echoDelay));
  fired(d, 'drum', ox, oy, 0, 0);
  return true;
};

function thump(d: Dive, s: Extract<Shot, { k: 'thump' }>) {
  for (const c of within(d, s.x, s.y, s.r)) { hit(d, c, s.dmg, s.x, s.y); stunCritter(c, WEAPONS.drum.p.stun); }
  if (s.dig) digIn(d, s.x, s.y, s.r, 1, 0, -2);
}

// ── Pebble Drill: a spinning drill the way the hero faces, which digs ──────

const drillFire: Fire = (d, w, who, e, ox, oy) => {
  const p = WEAPONS.drill.p, left = (has(w, 'drill.long') ? p.longRange : p.range) * e.size;
  const n = 1 + e.count, base = Math.atan2(d.face.y, d.face.x);
  for (const back of has(w, 'drill.twin') ? [0, Math.PI] : [0]) for (let i = 0; i < n; i++) {
    const a = base + back + (i - (n - 1) / 2) * TWIG_SPREAD * DEG;
    d.shots.push({ k: 'drill', who, w, t: 0, x: ox, y: oy, dx: Math.cos(a), dy: Math.sin(a), v: p.speed * e.speed, left, dmg: e.dmg, hit: new Map() });
  }
  if (who === 'hero' && has(w, 'drill.tunnelrat')) d.rat = p.ratFor;
  fired(d, 'drill', ox, oy, d.face.x, d.face.y);
  return true;
};

/** Bores a step: digs each diggable block its centre enters and stops at bedrock, a lantern or a blocker. Each
 *  critter it touches is hit at once, then again every tick while it still touches. */
function drill(d: Dive, s: Extract<Shot, { k: 'drill' }>): boolean {
  const p = WEAPONS.drill.p, want = Math.min(s.left, s.v * d.dt), n = Math.max(1, Math.ceil(want / 0.25));
  let len = want, alive = true;
  for (let i = 1; i <= n; i++) {
    const at = want * i / n, px = s.x + s.dx * at, py = s.y + s.dy * at, tx = Math.floor(px), ty = Math.floor(py);
    if (diggable(d, tx, ty)) d.digBlock(tx, ty);
    else if (rockAt(d, px, py) || d.blocks(px, py, p.width / 2)) { len = want * (i - 1) / n; alive = false; break; }
  }
  for (const { c } of along(d, s.x, s.y, s.dx, s.dy, len, p.width / 2)) {
    const last = s.hit.get(c.id);
    if (last !== undefined && s.t - last < p.tick - 1e-9) continue;
    s.hit.set(c.id, s.t); hit(d, c, s.dmg, s.x, s.y);
  }
  s.x += s.dx * len; s.y += s.dy * len; s.left -= want;
  return alive && s.left > 1e-9;
}

// ── The table ──────────────────────────────────────────────────────────────

const FIRE: Record<WeaponId, Fire> = {
  sling, pickaxe, popper, pulse, lance, puffer, boomerang, orbit: () => true, bomb: bombFire, moths: () => true, drum, drill: drillFire,
};

/** Drops the shots matching `f`, in place. */
function remove(d: Dive, f: (s: Shot) => boolean) {
  const sh = d.shots; let k = 0;
  for (let i = 0; i < sh.length; i++) if (!f(sh[i])) sh[k++] = sh[i];
  sh.length = k;
}

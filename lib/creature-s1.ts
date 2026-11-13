// Every Creature, screen 1: The Lake. Befriend the frog (three hops near it) and the tortoise (nudge it back onto its
// feet), ride the tortoise over the pike's water to tip the log into a ramp; befriend the beetle (catch it after its
// runs) and the chick (bump it while it flaps), fly the beetle up to the perch so it climbs the slick cliff and unrolls
// the vine, then everyone climbs to the top. Plus the shared screen helpers. Rules only; drawing is in
// lib/creature-scene-screens.ts.
import {
  G, SCR, F, rnd, clamp, lerp, sm, H, O, ev, snd, voice, unlocked, fx, splash, sparkle, feathers, ring,
  type Form, type Hero, type Surface, type Screen, type Hint, type Pose, type Pad,
} from './creature-core.js';
import { dropCarry, dismount, reachable, zoneOf, touchingWall } from './creature-forms.js';

// ---------------------------------------------------------------- shared screen helpers
/** a bird carrying a friend sets it down where it lands */
export function setDown(h: Hero, s: Surface, after?: (c: Hero, s: Surface) => void) {
  if (['pad', 'padsink', 'back'].includes(s.kind)) return false;
  const c = h.carry!; dropCarry(h); c.y = s.y; c.ground = true; c.surf = s.kind; h.y = s.y - 54; h.vy = 0; h.x += h.face * -6; h.ground = false;
  if (after) after(c, s); return true;
}
export function befriend(kind: Exclude<Form, 'chin'>, h: Hero, x: number, y: number) {
  if (G.friends[kind]) return;
  G.friends[kind] = true; G.stuckT = 0; G.stats.friendAt[kind] = +G.total.toFixed(1); ev('friend', kind, h.name);
  sparkle(x, y, 34); ring(x, y, 120, 'gold', 1); snd('friend'); voice(kind, .45);
  if (h.form === 'chin') h.friendT = 1.1;
  G.flyIcons.push({ kind, x, y, t: 0 });
}
export function puzzleClick(id: string, x: number, y: number) { G.stats.puzzleAt[G.si + ':' + id] = +G.total.toFixed(1); G.stuckT = 0; snd('click'); G.shake = .35; sparkle(x, y, 40); ring(x, y, 160, 'gold', 1.1); ev('puzzle', id); }
export const toward = (a: Hero, tx: number): Hint => ({ k: 'move', d: Math.sign(tx - a.x) || 1 });
/** the key hint for calling or swapping to the partner: the call button in solo play when it can reach */
export const callOrSwap = (): Hint => reachable(zoneOf(H()), zoneOf(O())) && !G.two ? { k: 'call' } : { k: 'swap' };
/** the key hint that makes the pair x (one hero) + y (the other) */
export function needPair(x: Form, y: Form): Hint {
  const a = H(), b = O();
  if ((a.form === x && b.form === y) || (a.form === y && b.form === x)) return null;
  if (a.form !== x && a.form !== y) return { k: 'form', f: unlocked(x) ? x : y };
  if (G.assist && SCR.pair && SCR.pair(a.form, a) === (a.form === x ? y : x)) return { k: 'call' };
  return { k: 'swap' };
}
export const E = (a: number, b: number, u: number) => lerp(a, b, clamp(u, 0, 1));

// ---------------------------------------------------------------- The Lake
export const GY1 = 816, GY2 = 657;
export interface S1State {
  ramp: number; vine: number; perched: boolean;
  pike: { st: string; x: number; dir: number; t: number; tgt: Hero | null; rx: number; cool: number; lock: boolean; sulk?: number };
  heron: { st: string; t: number; tgt: Hero | null };
  parent: { st: string; t: number; x: number; y: number; twig: number };
  A: {
    frog: { x: number; y: number; st: string; t: number; hop: number; hopT: number; seq: number[]; demoT: number; demoN: number; demoHopT: number; puzzT: number };
    tort: { x: number; y: number; st: string; t: number; flips: number; cool: number; pop: number };
    beetle: { x: number; y: number; st: string; t: number; runs: number; tx: number; cy: number; demoT: number; face: number };
    chick: { x: number; y: number; st: string; t: number; hgt: number; face: number; boost: number; bump?: number };
  };
  cliffT: number; shownCliff: boolean;
}
const S = () => G.S as S1State;
const LV1 = {
  W: 1920, H: 1080,
  water: { x1: 470, x2: 1296, y: 848 },
  bank: [[-80, GY1], [444, GY1], [520, 852], [660, 1010]] as [number, number][],
  rects: [
    { id: 'bank', x1: 1296, y1: GY2, x2: 1612, y2: 1300, rampSkip: 1 as const },
    { id: 'cliff', x1: 1608, y1: 167, x2: 2100, y2: 1300 },
    { id: 'perch', x1: 1526, y1: 418, x2: 1612, y2: 444 },
  ],
  walls: [{ x: 1608, top: 167, bot: GY2, slick: 444, kind: 'cliff' }, { x: 1296, top: GY2, bot: 900, kind: 'lip' }],
  vines: [{ x: 1590, top: 175, bot: GY2, exitX: 1642, exitY: 167, on: () => S().vine >= 1 }],
  ramps: [{ pts: [[1128, 886], [1300, 659]] as [number, number][], on: () => S().ramp >= 1 }],
  pads: [{ x: 610, w: 104, img: 'pad2' }, { x: 735, w: 96, img: 'pad1' }, { x: 858, w: 92, img: 'pad3' }] as Pad[],
  pike: { x1: 925, x2: 1290 }, heronY: 315, heron: { x: 1880, y: 167 }, log: { x: 1338, y: GY2 }, coil: { x: 1630, y: 167 }, stone: { x: 1716, y: 167 },
  nest: { x: 1568, y: 418 }, fall: { x1: 1772, x2: 1834, top: 192, bot: 840 }, twig: { x: 1450, y: GY2 },
};

const s1 = {
  id: 's1', name: 'The Lake', tune: 's1', bg: 'bg', art: ['bg'], LV: LV1,
  start: [[285, GY1], [205, GY1]] as [number, number][],
  camWin: { x: 1616, y: 260 },
  init(): S1State {
    for (const p of LV1.pads) p.dip = 0;
    return {
      ramp: 0, vine: 0, perched: false,
      pike: { st: 'lurk', x: 1120, dir: 1, t: 0, tgt: null, rx: 0, cool: 2.5, lock: false },
      heron: { st: 'idle', t: 0, tgt: null },
      parent: { st: 'away', t: 6, x: 1250, y: 120, twig: 0 },
      A: {
        frog: { x: 405, y: GY1, st: 'sit', t: 0, hop: 0, hopT: 0, seq: [], demoT: 2.2, demoN: 0, demoHopT: 0, puzzT: 0 },
        tort: { x: 105, y: GY1, st: 'back', t: 0, flips: 0, cool: 0, pop: 0 },
        beetle: { x: 1455, y: GY2, st: 'idle', t: 0, runs: 0, tx: 1455, cy: 0, demoT: 3, face: -1 },
        chick: { x: 1500, y: GY2, st: 'ground', t: 0, hgt: 0, face: 1, boost: 0 },
      },
      cliffT: 0, shownCliff: false,
    };
  },
  zone(x: number, y: number) { if (y < 200 && x > 1590) return 'top'; if (x > 1296 && x < 1612 && y < GY2 + 12) return 'bank'; return 'meadow'; },
  linked(a: string | number, b: string | number) { const k = [String(a), String(b)].sort((p, q) => p.localeCompare(q)).join(); return (k === 'bank,meadow' && S().ramp >= 1) || (k === 'bank,top' && S().vine >= 1); },
  pair(f: Form): Form | null { return ({ tort: 'frog', frog: 'tort', bird: 'beetle', beetle: 'bird' } as Partial<Record<Form, Form>>)[f] || null; },
  noForm(h: Hero) { return h.ground && h.surf === 'perch'; }, // the perch is a thin, bouncing branch: no room to change form
  block(h: Hero) { const TA = S().A.tort; if (!G.friends.tort && Math.abs(h.y - TA.y) < 40 && Math.abs(h.x - TA.x) < 62 && Math.sign(TA.x - h.x) === Math.sign(h.vx)) h.vx = 0; },
  birdCap(h: Hero) { if (h.form === 'bird' && h.carry && h.y < 352 && h.vy < 0) h.vy *= .6; }, // too heavy to climb much past the perch
  carryLand(h: Hero, s: Surface) { return setDown(h, s, (c, s) => { if (s.kind === 'perch' && c.form === 'beetle') this.onPerch(); }); },
  actNear(h: Hero) {
    const st = S(), L = LV1;
    if (!G.friends.tort && Math.abs(h.x - st.A.tort.x) < 90 && Math.abs(h.y - st.A.tort.y) < 50) { this.nudgeTort(h); return true; }
    if (st.ramp === 0 && Math.abs(h.y - GY2) < 12 && Math.abs(h.x - L.log.x) < 80) { this.tipLog(h); return true; }
    if (st.vine === 0 && h.y <= 169 && Math.abs(h.x - L.coil.x) < 80) { st.vine = .001; h.nudgeT = .4; snd('nudge'); ev('vine', h.name); return true; }
    return false;
  },
  onJump(h: Hero) { // the frog's three hops
    const A = S().A.frog;
    if (!G.friends.frog && Math.abs(h.x - A.x) < 280 && Math.abs(h.y - A.y) < 80 && !h.ride) {
      const win = G.assist ? 1.9 : 1.3;
      if (A.seq.length && G.t - A.seq[A.seq.length - 1] > win) { A.seq = []; A.puzzT = .8; }
      A.seq.push(G.t); A.hopT = .42; A.hop = 1; snd('croak', A.seq.length - 1); A.demoT = 5;
      ring(A.x, A.y - 20, 22 + A.seq.length * 10);
      if (A.seq.length >= 3) befriend('frog', h, A.x, A.y - 30);
    }
  },
  nudgeTort(h: Hero) {
    const A = S().A.tort; if (A.cool > 0 || G.friends.tort) return;
    A.flips++; A.cool = .4; A.pop = 1; h.nudgeT = .35; snd('nudge'); fx(A.x, A.y - 10, 6, { a: -Math.PI / 2, spread: 1.5, s: 150, g: 500, k: 'dust', r: 8 });
    if (A.flips >= (G.assist ? 2 : 3)) { A.st = 'up'; befriend('tort', h, A.x, A.y - 40); }
  },
  tipLog(h: Hero) { if (S().ramp > 0) return; S().ramp = .001; h.nudgeT = .4; snd('nudge'); ev('log', h.name); },
  onPerch() { const st = S(); if (st.perched) return; st.perched = true; G.stuckT = 0; sparkle(LV1.nest.x, 400, 22); snd('click'); ring(1580, 410, 90, 'gold', .8); ev('perch'); },
  stage() {
    const f = G.friends, st = S();
    if (!f.frog || !f.tort) return 'meet1';
    if (st.ramp < 1) return 'lake';
    if (!f.beetle || !f.bird) return 'meet2';
    if (st.vine < 1) return 'cliff';
    return 'top';
  },
  goal() { return G.heroes.every((h) => h.y <= 170 && h.x > 1568 && !h.respawn && !h.climb && !h.ride); },
  update(dt: number) {
    const st = S(), L = LV1;
    if (st.ramp > 0 && st.ramp < 1) { st.ramp = Math.min(1, st.ramp + dt * 1.6); if (st.ramp >= 1) { splash(1180, L.water.y, 2); snd('splash'); puzzleClick('ramp', 1230, 760); } }
    if (st.vine > 0 && st.vine < 1) { st.vine = Math.min(1, st.vine + dt * 1.3); if (st.vine >= 1) puzzleClick('vine', 1590, 420); }
    for (const p of L.pads) p.dip = Math.max(0, (p.dip || 0) - dt * 1.2);
    if (!st.perched && G.heroes.some((h) => h.form === 'beetle' && h.ground && h.surf === 'perch')) this.onPerch();
    if (st.perched && st.vine < 1 && !G.heroes.some((h) => h.form === 'beetle' && !h.respawn && h.y < 446)) st.perched = false;
    if (st.ramp === 0) for (const h of G.heroes) if (!h.respawn && Math.abs(h.y - GY2) < 12 && h.x > 1296 && h.x - L.log.x < 130 && h.ground) this.tipLog(h);
    this.animals(dt); this.updPike(dt); this.updHeron(dt); this.updParent(dt);
    for (const h of G.heroes) h.danger = st.pike.st === 'tell' && st.pike.tgt === h && st.pike.lock;
    // show the carry early the first time both cliff friends are made and nobody has been carried yet
    if (this.stage() === 'cliff' && !st.perched) { st.cliffT += dt; if (!st.shownCliff && st.cliffT > 7 && !G.demo && !G.ev.some((e) => e[0] === 'grab')) { st.shownCliff = true; G.demo = { kind: 'cliff', t: 0, dur: 7.5 }; ev('demo', 'cliff-early'); } }
  },
  animals(dt: number) {
    const A = S().A, hs = G.heroes, L = LV1;
    const fr = A.frog; fr.t += dt;
    if (fr.hopT > 0) { fr.hopT -= dt; fr.hop = Math.max(0, fr.hopT / .42); }
    if (fr.puzzT > 0) fr.puzzT -= dt;
    if (!G.friends.frog) {
      const near = hs.some((h) => Math.abs(h.x - fr.x) < 520);
      fr.demoT -= dt;
      if (fr.demoN > 0) { fr.demoHopT -= dt; if (fr.demoHopT <= 0) { fr.demoN--; fr.hopT = .42; fr.hop = 1; snd('croak', 2 - fr.demoN); fr.demoHopT = .5; } }
      else if (fr.demoT <= 0 && near && !fr.seq.length) { fr.demoN = 3; fr.demoHopT = 0; fr.demoT = 6; }
      if (fr.seq.length && G.t - fr.seq[fr.seq.length - 1] > (G.assist ? 1.9 : 1.3)) { fr.seq = []; fr.puzzT = .8; }
    } else {
      const tx = L.pads[0].x;
      if (Math.abs(fr.x - tx) > 4) { fr.x += Math.sign(tx - fr.x) * Math.min(Math.abs(tx - fr.x), dt * 240); fr.y = lerp(fr.y, L.water.y - 4, dt * 3); fr.hop = Math.abs(Math.sin(fr.t * 9)); }
      else { fr.hop = fr.hopT > 0 ? fr.hop : 0; if (rnd() < dt * .2) { fr.hopT = .42; fr.hop = 1; } }
    }
    const to = A.tort; to.t += dt; if (to.cool > 0) to.cool -= dt; to.pop = Math.max(0, to.pop - dt * 3);
    if (!G.friends.tort) { for (const h of hs) if (!h.respawn && h.inp && Math.abs(h.y - to.y) < 40 && Math.abs(h.x - to.x) < 66 && h.inp.mx === Math.sign(to.x - h.x)) this.nudgeTort(h); }
    else if (to.st === 'up') to.x = Math.max(to.x - dt * 25, 60);
    const be = A.beetle; be.t += dt;
    if (!G.friends.beetle) {
      const near = hs.filter((h) => !h.respawn && h.y < GY2 + 30 && h.y > GY2 - 95 && Math.abs(h.x - be.x) < 130 && be.cy === 0).sort((p, q) => Math.abs(p.x - be.x) - Math.abs(q.x - be.x))[0];
      const maxRuns = G.assist ? 2 : 3;
      if (be.st === 'idle' || be.st === 'tired') {
        if (near && be.st === 'idle' && be.runs < maxRuns) {
          let d = Math.sign(be.x - near.x) || 1, tx = be.x + d * 170;
          if (tx < 1335 || tx > 1590) { d = -d; tx = near.x + d * 120; }
          be.tx = clamp(tx, 1335, 1590); be.st = 'run'; be.runs++; be.face = Math.sign(be.tx - be.x); voice('beetle');
        } else if (near && Math.abs(near.x - be.x) < 56 && be.runs >= maxRuns) { befriend('beetle', near, be.x, be.y - 20); be.st = 'happy'; }
        else if (be.runs >= maxRuns) be.st = 'tired';
        be.demoT -= dt;
        if (be.st === 'idle' && be.demoT <= 0 && !near) { be.st = 'demo'; be.tx = 1588; be.face = 1; }
      } else if (be.st === 'run') {
        be.x += Math.sign(be.tx - be.x) * Math.min(Math.abs(be.tx - be.x), dt * 400);
        if (Math.abs(be.tx - be.x) < 2) be.st = be.runs >= maxRuns ? 'tired' : 'idle';
      } else if (be.st === 'demo') {
        if (be.cy === 0 && Math.abs(be.x - be.tx) > 2) be.x += Math.sign(be.tx - be.x) * Math.min(Math.abs(be.tx - be.x), dt * 150);
        else { be.cy += dt * 60; if (be.cy > 70) { be.st = 'slide'; snd('slip'); } }
      } else if (be.st === 'slide') {
        be.cy -= dt * 160; if (rnd() < .4) fx(be.x + 14, GY2 - be.cy, 1, { a: Math.PI / 2, spread: .4, s: 60, g: 500, r: 3 });
        if (be.cy <= 0) { be.cy = 0; be.st = 'idle'; be.demoT = 6; be.tx = be.x - 80; be.x -= 1; be.face = -1; }
      }
    } else { be.st = 'happy'; be.x = Math.max(1340, be.x - dt * 40); }
    const ch = A.chick; ch.t += dt;
    if (!G.friends.bird) {
      const cyc = ch.t % 3.4;
      if (cyc < 1.2) { ch.st = 'ground'; ch.hgt = Math.max(0, ch.hgt - dt * 400); }
      else if (cyc < 2.1) { ch.st = 'flap'; ch.hgt = lerp(ch.hgt, 150, dt * 4); if (rnd() < .06) snd('chirp'); }
      else if (cyc < 2.8) { ch.st = 'flap'; ch.hgt = 150 + Math.sin(ch.t * 14) * 6; }
      else { ch.st = 'tumble'; ch.hgt = Math.max(0, ch.hgt - dt * 380); }
      for (const h of hs) {
        if (h.respawn) continue;
        const hy = h.y - F[h.form].h * .6, cy = ch.y - ch.hgt - 20;
        if (Math.abs(h.x - ch.x) < 60 && Math.abs(hy - cy) < 60 + F[h.form].h * .3) {
          if (ch.hgt > 40 || (G.assist && h.ground && h.form !== 'tort')) { ch.st = 'boost'; ch.boost = 0; befriend('bird', h, ch.x, cy); }
          else if (!ch.bump || G.t - ch.bump > .8) { ch.bump = G.t; ch.x = clamp(ch.x + (Math.sign(ch.x - h.x) || 1) * 40, 1340, 1595); snd('chirp'); }
        }
      }
    } else {
      if (ch.st === 'boost') { ch.boost = Math.min(1, ch.boost + dt * .9); ch.x = lerp(ch.x, L.nest.x, ch.boost * .2); ch.hgt = lerp(ch.hgt, GY2 - L.nest.y + 6, ch.boost * .2); if (ch.boost >= 1) { ch.st = 'nest'; ch.x = L.nest.x; ch.hgt = GY2 - L.nest.y + 6; } }
      else if (rnd() < dt * .3) snd('chirp');
    }
  },
  /** the chick's parent fetches twigs for the nest: swoops low, grabs one from above, carries it up to the perch */
  updParent(dt: number) {
    const p = S().parent, L = LV1; if (!G.friends.bird) { p.st = 'away'; return; }
    p.t -= dt; const near = G.heroes.some((h) => h.x > 1150);
    const tw = L.twig, n = L.nest;
    if (p.st === 'away') { if (p.t <= 0 && near && !S().perched) { p.st = 'in'; p.t = 1.6; p.x = 1180; p.y = 120; snd('chirp'); } }
    else if (p.st === 'in') { const u = 1 - p.t / 1.6; p.x = lerp(1180, tw.x, sm(u)); p.y = lerp(120, tw.y - 70, sm(u)) + Math.sin(u * Math.PI) * 60; if (p.t <= 0) { p.st = 'grab'; p.t = .5; snd('chirp'); ring(tw.x, tw.y - 20, 30); } }
    else if (p.st === 'grab') { p.y = tw.y - 70 + Math.sin(p.t * 20) * 4; if (p.t <= 0) { p.st = 'up'; p.t = 2.2; p.twig = 1; } }
    else if (p.st === 'up') { const u = 1 - p.t / 2.2; p.x = lerp(tw.x, n.x + 10, sm(u)); p.y = lerp(tw.y - 70, n.y - 66, sm(u)); if (rnd() < .1) snd('flap'); if (p.t <= 0) { p.st = 'perch'; p.t = 1.6; p.twig = 0; sparkle(n.x, n.y - 20, 8); snd('chirp'); } }
    else if (p.st === 'perch') { p.x = n.x + 30; p.y = n.y; if (p.t <= 0) { p.st = 'out'; p.t = 1.4; } }
    else if (p.st === 'out') { const u = 1 - p.t / 1.4; p.x = lerp(n.x + 30, 1180, u); p.y = lerp(n.y, 100, u); if (p.t <= 0) { p.st = 'away'; p.t = 7; } }
  },
  updPike(dt: number) {
    const p = S().pike, L = LV1; p.t += dt; if (p.cool > 0) p.cool -= dt;
    const inZone = (h: Hero) => h.swim && !h.respawn && h.x > L.pike.x1 && h.x < L.pike.x2;
    const tell = G.assist ? 2.0 : 1.3;
    if (p.st === 'lurk') {
      p.x += p.dir * dt * 70; if (p.x > L.pike.x2 - 30) p.dir = -1; if (p.x < L.pike.x1 + 30) p.dir = 1;
      if (p.cool <= 0) { const t = G.heroes.find(inZone); if (t) { p.st = 'tell'; p.t = 0; p.tgt = t; p.rx = t.x; p.lock = false; ev('pikeTell', t.name, t.form); } }
    } else if (p.st === 'tell') {
      const t = p.tgt!;
      if (!inZone(t) && !p.lock) { p.st = 'lurk'; p.cool = .6; return; }
      if (p.t < tell - .45) p.rx = t.x; else p.lock = true;
      p.x = lerp(p.x, p.rx, dt * 2.5); p.dir = Math.sign(p.rx - p.x) || p.dir;
      if (p.t >= tell) {
        p.st = 'lunge'; p.t = 0; p.x = p.rx; splash(p.rx, L.water.y, 1.2); snd('snap');
        const hit = G.heroes.find((h) => inZone(h) && Math.abs(h.x - p.rx) < (h.form === 'tort' ? 85 : 55));
        if (hit) {
          if (hit.form === 'tort' && hit.shell) { p.st = 'bonk'; p.t = 0; snd('bonk'); voice('tort'); sparkle(p.rx, L.water.y - 60, 14, '#fff'); G.stats.blocks++; ev('block'); G.shake = .15; }
          else {
            G.stats.hits++; snd('hit'); hit.hurt = .55; ev('pikeHit', hit.name, hit.form);
            if (hit.form === 'tort') { hit.knock = -280; const r = hit.rider; if (r && !G.assist) { dismount(r, 420); r.vx = -120; } }
            else { hit.x -= 30; hit.swim = false; hit.vy = -520; hit.knock = -330; hit.ground = false; }
          }
        }
      }
    } else if (p.st === 'lunge') { if (p.t > .6) { p.st = 'dive'; p.t = 0; } }
    else if (p.st === 'bonk') { if (p.t > .9) { p.st = 'dive'; p.t = 0; p.sulk = 1; } }
    else if (p.st === 'dive') { if (p.t > .45) { p.st = 'lurk'; p.t = 0; p.cool = p.sulk ? 4 : 2.2; p.sulk = 0; } }
  },
  updHeron(dt: number) {
    const r = S().heron, L = LV1; r.t += dt;
    if (r.st === 'bow') return;
    const high = (h: Hero) => h.form === 'bird' && !h.respawn && h.y < L.heronY && h.x > 1360;
    if (r.st === 'idle') { const b = G.heroes.find(high); if (b) { r.st = 'peer'; r.t = 0; r.tgt = b; } }
    else if (r.st === 'peer') {
      if (!high(r.tgt!)) r.st = 'idle';
      else if (r.t > (G.assist ? .6 : .4)) {
        const b = r.tgt!; r.st = 'snap'; r.t = 0; snd('snap'); G.stats.hits++; ev('heron', b.name);
        b.hurt = .6; b.vy = 260; b.knock = -200; b.flaps = 99; feathers(b.x, b.y - 40, 10, b.name); if (b.carry) dropCarry(b);
      }
    } else if (r.st === 'snap') { if (r.t > .7) r.st = 'idle'; }
  },
  onClear() { S().heron.st = 'bow'; S().heron.t = 0; },
  /** the cheering spots on the clifftop (the prototype's first spot was past the edge, so Dora fell off mid-cheer) */
  celebrate(i: number) { return { x: LV1.stone.x - 90 + i * 70, y: 167 }; },
  hint(): Hint {
    const a = H(), b = O(), f = G.friends, s = this.stage(), L = LV1, st = S();
    if (s === 'meet1') {
      if (!f.frog) return Math.abs(a.x - st.A.frog.x) > 260 ? toward(a, st.A.frog.x) : { k: 'act' };
      return Math.abs(a.x - st.A.tort.x) > 80 ? toward(a, st.A.tort.x) : { k: 'act' };
    }
    if (s === 'lake') {
      if (a.y < GY2 + 8 && a.x > 1300) return toward(a, L.log.x - 20);
      if (a.ride && a.ride.x > 1180) return { k: 'act' };
      if (a.form === 'tort' && a.rider && a.x > 1180) return { k: 'swap' };
      const n = needPair('tort', 'frog'); if (n) return n;
      if (a.form === 'tort' && !a.rider) return Math.abs(a.x - b.x) > 90 ? toward(a, b.x) : { k: 'call' };
      if (a.form === 'frog' && !a.ride) return toward(a, b.x);
      return toward(a, 1280);
    }
    if (s === 'meet2') {
      if (a.x < 1300) return a.form === 'chin' || a.form === 'frog' ? toward(a, 1400) : { k: 'form', f: 'chin' };
      if (a.y < GY2 - 20) return toward(a, 1440);
      if (!f.beetle) return toward(a, st.A.beetle.x);
      return Math.abs(a.x - st.A.chick.x) > 50 ? toward(a, st.A.chick.x) : { k: 'act' };
    }
    if (s === 'cliff') {
      if (a.y <= 169) return Math.abs(a.x - L.coil.x) > 60 ? toward(a, L.coil.x) : { k: 'act' };
      if (st.perched || (a.form === 'beetle' && a.y < 430 && a.x > 1530)) { if (a.form !== 'beetle') return { k: 'swap' }; if (a.climb) return { k: 'up' }; return touchingWall(a) ? { k: 'up' } : { k: 'move', d: 1 }; }
      const n = needPair('bird', 'beetle'); if (n) return n;
      if (a.form === 'beetle' && !a.ride) return { k: 'swap' };
      if (a.form === 'bird' && !a.carry) return Math.abs(a.x - b.x) > 40 ? toward(a, b.x) : { k: 'act' };
      if (a.carry) { if (a.y + 48 > 405) return a.x > 1505 ? toward(a, 1480) : { k: 'act' }; return a.x < 1560 ? toward(a, 1570) : { k: 'act' }; }
      return { k: 'act' };
    }
    if (a.y <= 169) return callOrSwap();
    if (a.form !== 'chin') return { k: 'form', f: 'chin' };
    return Math.abs(a.x - 1590) > 30 ? toward(a, 1590) : { k: 'up' };
  },
  wantDemo(s: string) { return s === 'lake' || s === 'cliff' || s === 'top'; },
  demoDur(s: string) { return s === 'lake' ? 7 : s === 'top' ? 4.5 : 7.5; },
  demoPose(d: { kind: string; t: number }): Pose[] {
    const t = d.t, out: Pose[] = [], L = LV1;
    if (d.kind === 'lake') {
      let tx = 480, fy = L.water.y - 44, fx_ = 470;
      if (t < .8) { tx = 520; fx_ = E(420, 520, t / .8); fy = E(GY1, L.water.y - 40, t / .8) - Math.sin(Math.PI * clamp(t / .8, 0, 1)) * 70; }
      else if (t < 4.8) { tx = E(520, 1240, sm((t - .8) / 4)); fx_ = tx; fy = L.water.y - 40; }
      else if (t < 5.6) { tx = 1240; const u = (t - 4.8) / .8; fx_ = E(1240, 1350, u); fy = E(L.water.y - 40, GY2, u) - Math.sin(Math.PI * u) * 140; }
      else { tx = 1240; fx_ = 1350; fy = GY2; }
      out.push({ img: t > .8 && t < 4.8 ? 'a-tort-walk' : 'a-tort-up', x: tx, y: L.water.y + 26, h: 80, f: 1 });
      out.push({ img: t > 4.8 && t < 5.6 || t < .8 ? 'a-frog-hop' : 'a-frog-sit', x: fx_, y: fy, h: 52, f: 1 });
      if (t > 5.6) out.push({ spark: 1, x: 1350, y: 620 });
    } else if (d.kind === 'top') {
      const u = sm((t - .4) / 3.2);
      out.push({ img: 'a-beetle-run' + (1 + ((t * 8 | 0) % 2)), x: 1590, y: E(GY2, 175, u), h: 36, f: 1, rot: -Math.PI / 2 });
      if (t > 3.6) out.push({ spark: 1, x: 1630, y: 150 });
    } else {
      let cx_ = 1440, cy = 600, bx = 1440, by = GY2, img = 'a-beetle-idle';
      if (t < .8) cy = E(560, 610, t / .8);
      else if (t < 3) { const u = sm((t - .8) / 2.2); cx_ = E(1440, 1585, u); cy = E(610, 380, u); bx = cx_; by = cy + 40; img = 'a-beetle-happy'; }
      else if (t < 6) { cx_ = 1585; cy = 380; const u = sm((t - 3.2) / 2.6); bx = t < 3.3 ? E(1585, 1588, (t - 3) / .3) : 1588; by = E(420, 172, u); img = t < 3.2 ? 'a-beetle-run1' : 'a-beetle-run' + (1 + ((t * 8 | 0) % 2)); }
      else { cx_ = 1585; cy = 380; bx = L.coil.x; by = 170; img = 'a-beetle-happy'; }
      out.push({ img: t > .8 && t < 3 ? 'a-chick-flap' : 'a-chick-perch', x: cx_, y: cy, h: 50, f: 1 });
      out.push({ img, x: bx, y: by, h: 36, f: 1, rot: t > 3.2 && t < 6 ? -Math.PI / 2 : 0 });
      if (t > 6) out.push({ spark: 1, x: L.coil.x, y: 150 });
    }
    return out;
  },
};
export const S1: Screen & typeof s1 = s1;

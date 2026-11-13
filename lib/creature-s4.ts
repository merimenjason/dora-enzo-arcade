// Every Creature, screen 4: Storm Falls, the finale. A huge Storm Heron is bound by a thorny vine and lashes out with
// lightning. Untie its three knots, each with a pairing from the chapter:
//  1. fox + tortoise: the shell draws the lightning while the fox digs up the vine's stake;
//  2. otter + frog: dive together to the crevice where only a frog fits;
//  3. bird + beetle: fly low over the pool, rise behind the waterfall spray, and the beetle bites the last knot.
// Rules only; drawing is in lib/creature-scene-screens.ts.
import { G, NOINP, rnd, clamp, lerp, sm, H, O, ev, snd, voice, fx, sparkle, feathers, dirt, type Form, type Hero, type Screen, type Hint, type Pose, type Rect } from './creature-core.js';
import { dropCarry, dismount } from './creature-forms.js';
import { puzzleClick, toward, needPair } from './creature-s1.js';

export const S4G = 760, S4W = 830;
export interface S4State {
  knots: number[]; dig: number; crevT: number; biteT: number; storm: number; calmT: number;
  sky: { st: string; t: number; rx: number; ry: number; tgt: Hero | null; lock: boolean };
  watch: { st: string; t: number; tgt?: Hero }; flash: number; bolt: { x: number; y: number; t: number; seed: number } | null; intro: number;
}
const S = () => G.S as S4State;
const LV4 = {
  W: 1920, H: 1080,
  water: { x1: 700, x2: 1150, y: S4W, dive: 165 },
  bank: [[-80, S4G], [700, S4G], [760, 900], [780, 1100]] as [number, number][],
  rects: [
    { id: 'rock', x1: 1150, y1: S4G, x2: 1500, y2: 1300 },
    { id: 'rcliff', x1: 1640, y1: 300, x2: 2100, y2: 1300 },
  ] as Rect[],
  walls: [{ x: 1150, top: S4G, bot: 1060, slick: S4G, kind: 'rock' }],
  heron: { x: 1330, y: S4G }, stake: { x: 520, y: S4G }, crev: { x: 930, y: 1000 }, neck: { x: 1300, y: 390 },
  fall: { x1: 1520, x2: 1636 },
};

const s4 = {
  id: 's4', name: 'Storm Falls', tune: 's4', bg: 'bg-s4', art: ['bg-s4', 'sheron-idle', 'sheron-raise', 'knot', 'dora-fox-idle', 'dora-otter-idle'], LV: LV4,
  start: [[120, S4G], [60, S4G]] as [number, number][],
  camWin: { x: 960, y: 540 },
  init(): S4State { return { knots: [0, 0, 0], dig: 0, crevT: 0, biteT: 0, storm: 1, calmT: 0, sky: { st: 'rest', t: 1.5, rx: 0, ry: 0, tgt: null, lock: false }, watch: { st: 'idle', t: 0 }, flash: 0, bolt: null, intro: 0 }; },
  phase() { const k = S().knots; return !k[0] ? 0 : !k[1] ? 1 : !k[2] ? 2 : 3; },
  stage() { return ['stake', 'crevice', 'crest', 'calm'][this.phase()]; },
  zone(x: number, y: number) { return x > 1640 && y < 400 ? 'cliff' : 'all'; },
  linked() { return false; },
  pair(f: Form): Form | null {
    const p = this.phase(), m = (o: Partial<Record<Form, Form>>, d: Form) => o[f] || d;
    return p === 0 ? m({ fox: 'tort', tort: 'fox' }, 'fox') : p === 1 ? m({ otter: 'frog', frog: 'otter' }, 'otter') : p === 2 ? m({ bird: 'beetle', beetle: 'bird' }, 'bird') : null;
  },
  stay(b: Hero) { return b.form === 'tort' && this.phase() === 0; },
  open(h: Hero) { return !h.respawn && !h.dive && !h.ride && h.arriveT <= 0 && h.x < 1500 && h.y > 600; },
  actNear(h: Hero) { const L = LV4; if (h.form === 'fox' && !S().knots[0] && Math.abs(h.x - L.stake.x) < 70 && h.ground) return true; return false; },
  ai(b: Hero) { const L = LV4; if (b.form === 'fox' && !S().knots[0] && Math.abs(b.x - L.stake.x) < 70 && b.ground) return { ...NOINP, actH: true }; return null; },
  untie(i: number, x: number, y: number) { const st = S(); st.knots[i] = 1; puzzleClick('knot' + (i + 1), x, y); snd('thunder'); st.flash = .5; feathers(LV4.heron.x, 500, 8, 'enzo'); ev('knot', i + 1); if (i === 2) this.calm(); },
  calm() { S().calmT = 0; G.tune = 'calm'; },
  update(dt: number) {
    const st = S(), L = LV4, ph = this.phase();
    if (st.flash > 0) st.flash -= dt; if (st.bolt) { st.bolt.t += dt; if (st.bolt.t > .35) st.bolt = null; }
    if (ph === 3) { st.storm = Math.max(0, st.storm - dt * .35); st.calmT += dt; return; }
    // knot 1: the fox digs up the stake (held Space); a strike on the fox undoes it
    for (const h of G.heroes) {
      h.digging = false;
      if (ph === 0 && h.form === 'fox' && h.ground && !h.respawn && h.hurt <= 0 && Math.abs(h.x - L.stake.x) < 70 && h.inp && h.inp.actH) {
        h.digging = true; h.face = 1; st.dig += dt; if (rnd() < .4) dirt(h.x + 30, S4G, 1); if ((G.t * 7 | 0) !== ((G.t - dt) * 7 | 0)) snd('dig');
        if (st.dig >= 4.3) this.untie(0, L.stake.x, S4G - 40);
      }
    }
    // knot 2: the otter dives with a frog on its belly to the crevice; the frog wriggles in and unties it
    const ot = G.heroes.find((h) => h.form === 'otter' && h.dive && Math.abs(h.x - L.crev.x) < 70 && h.y > L.crev.y - 30);
    if (ph === 1 && ot) {
      if (ot.rider && ot.rider.form === 'frog') { st.crevT += dt; if (rnd() < .3) fx(L.crev.x, L.crev.y - 10, 1, { a: -Math.PI / 2, spread: .8, s: 80, g: -120, k: 'bubble', life: .9, r: 5 }); if (st.crevT > .9) this.untie(1, L.crev.x, S4W + 20); }
      else if (ot.bumped == null || G.t - ot.bumped > 1.2) { ot.bumped = G.t; snd('deny'); ot.denyT = .5; ev('crevTooBig', ot.name); }
    } else st.crevT = 0;
    // knot 3: a carried beetle bites through it; a bird alone just pricks itself
    if (ph === 2) {
      const bd = G.heroes.find((h) => h.form === 'bird' && !h.respawn && (Math.hypot(h.x - L.neck.x, h.y - 30 - L.neck.y) < 80 || (h.carry && Math.hypot(h.carry.x - L.neck.x, h.carry.y - 20 - L.neck.y) < 85)));
      if (bd && bd.carry && bd.carry.form === 'beetle') { st.biteT += dt; bd.vy = Math.min(bd.vy, 30); bd.flaps = 0; if ((G.t * 8 | 0) !== ((G.t - dt) * 8 | 0)) voice('beetle'); if (st.biteT > .8) { this.untie(2, L.neck.x, L.neck.y); } }
      else if (bd && !bd.carry && bd.hurt <= 0) { bd.hurt = .5; bd.knock = 220; bd.vy = 200; snd('hit'); feathers(bd.x, bd.y - 30, 5, bd.name); ev('thornBird', bd.name); }
      else st.biteT = 0;
    }
    this.sky(dt, ph); this.watch(dt, ph);
    for (const h of G.heroes) h.danger = st.sky.st === 'tell' && st.sky.lock && st.sky.tgt === h;
  },
  /** phases 1-2: lightning at whoever is out in the open on land (a tortoise draws it; its shell takes it); the pool is safe */
  sky(dt: number, ph: number) {
    const st = S(), k = st.sky; k.t -= dt;
    if (ph === 2) { k.st = 'rest'; return; }
    const tell = G.assist ? 2.0 : 1.4;
    const target = () => { const c = G.heroes.filter((h) => this.open(h) && !h.swim && !(h.ride && h.ride.swim)); return c.find((h) => h.form === 'tort') || c.find((h) => h.digging) || c[(rnd() * c.length) | 0]; };
    if (k.st === 'rest') { if (k.t <= 0) { const t = target(); if (t) { k.st = 'tell'; k.t = tell; k.tgt = t; k.lock = false; ev('skyTell', t.name, t.form); } else k.t = .5; } }
    else if (k.st === 'tell') {
      const t = k.tgt!;
      if (!this.open(t) && !k.lock) { k.st = 'rest'; k.t = .6; return; }
      if (k.t > .45) { k.rx = t.x; k.ry = t.swim ? S4W : t.y; } else k.lock = true;
      if (k.t <= 0) {
        st.bolt = { x: k.rx, y: k.ry, t: 0, seed: rnd() }; st.flash = .25; snd('zap'); snd('thunder', undefined, .12);
        const near = G.heroes.filter((h) => !h.respawn && !h.dive && !h.ride && Math.abs(h.x - k.rx) < (h.form === 'tort' ? 85 : 66) && Math.abs(h.y - k.ry) < 140);
        const shell = near.find((h) => h.form === 'tort' && h.shell);
        if (shell) { k.st = 'reel'; k.t = 1.2; snd('bonk'); voice('tort'); sparkle(shell.x, shell.y - 50, 20, '#cfeaff'); G.stats.blocks++; G.shake = .2; ev('skyBlock'); }
        else { for (const h of near) { G.stats.hits++; snd('hit'); h.hurt = .6; h.vy = -380; h.knock = -260; h.ground = false; h.swim = false; if (h.rider) dismount(h.rider, 300); if (h.carry) dropCarry(h); if (h.form === 'fox') st.dig = 0; ev('skyHit', h.name, h.form); } k.st = 'rest'; k.t = ph === 1 ? 2.4 : .9; }
      }
    } else if (k.st === 'reel') { if (k.t <= 0) { k.st = 'rest'; k.t = .7; } }
  },
  /** phase 3: the heron watches the sky in front of it and lunges at birds there */
  watch(dt: number, ph: number) {
    const w = S().watch, L = LV4; w.t += dt;
    if (ph !== 2) { w.st = 'idle'; return; }
    const seen = (h: Hero) => h.form === 'bird' && !h.respawn && h.x < L.heron.x - 20 && h.x > 640 && h.y < 620;
    if (w.st === 'idle') { const b = G.heroes.find(seen); if (b) { w.st = 'peer'; w.t = 0; w.tgt = b; } }
    else if (w.st === 'peer') { if (!seen(w.tgt!)) w.st = 'idle'; else if (w.t > (G.assist ? .7 : .45)) { const b = w.tgt!; w.st = 'snap'; w.t = 0; snd('snap'); G.stats.hits++; ev('heronSnap', b.name); b.hurt = .6; b.vy = 260; b.knock = -240; b.flaps = 99; feathers(b.x, b.y - 40, 10, b.name); if (b.carry) dropCarry(b); } }
    else if (w.st === 'snap') { if (w.t > .8) w.st = 'idle'; }
  },
  goal() { return this.phase() === 3 && S().calmT > 2; },
  celebrate(i: number) { return { x: 420 + i * 80, y: S4G }; },
  hint(): Hint {
    const a = H(), b = O(), st = S(), L = LV4, ph = this.phase();
    if (ph === 0) {
      const n = needPair('fox', 'tort'); if (n) return n;
      if (a.form === 'fox') return Math.abs(a.x - L.stake.x) > 50 ? toward(a, L.stake.x) : { k: 'act' };
      if (Math.abs(b.x - L.stake.x) > 60) return { k: 'swap' };
      return st.sky.st === 'tell' && st.sky.tgt === a ? { k: 'act' } : toward(a, L.stake.x - 120);
    }
    if (ph === 1) {
      const n = needPair('otter', 'frog'); if (n) return n;
      const ot = a.form === 'otter' ? a : b;
      if (ot.rider !== (ot === a ? b : a)) return a.form === 'otter' ? (Math.abs(a.x - b.x) > 90 ? toward(a, b.x) : { k: 'call' }) : toward(a, b.x);
      if (!ot.dive && Math.abs(ot.x - L.crev.x) > 40) return toward(a, L.crev.x);
      return { k: 'down', d: Math.abs(ot.x - L.crev.x) > 30 ? Math.sign(L.crev.x - ot.x) : 0 };
    }
    if (ph === 2) {
      const n = needPair('bird', 'beetle'); if (n) return n;
      if (a.form === 'beetle') return { k: 'swap' };
      if (!a.carry && a.y > b.y + 50 && Math.abs(a.x - b.x) > 40) return { k: 'act', d: Math.sign(b.x - a.x) };
      if (!a.carry) return Math.abs(a.x - b.x) > 40 ? toward(a, b.x) : { k: 'act' };
      if (a.x < L.heron.x + 60) return a.y > 720 ? { k: 'act', d: 1 } : toward(a, L.heron.x + 160);
      return a.y > L.neck.y + 40 ? { k: 'act', d: a.x > L.neck.x + 90 ? -1 : 0 } : toward(a, L.neck.x + 50);
    }
    return null;
  },
  wantDemo(s: string) { return s !== 'calm'; },
  demoDur(s: string) { return s === 'crest' ? 7 : 6; },
  demoPose(d: { kind: string; t: number }): Pose[] {
    const t = d.t, out: Pose[] = [], L = LV4;
    if (d.kind === 'stake') { out.push({ img: 'a-tort-back', x: L.stake.x - 140, y: S4G + 4, h: 60, f: 1 }); out.push({ img: 'kit-sniff', x: L.stake.x, y: S4G, h: 54, f: 1 }); if (t > 1 && t < 1.4) out.push({ bolt: 1, x: L.stake.x - 140, y: S4G - 40 }); if (t > 4.5) out.push({ spark: 1, x: L.stake.x, y: S4G - 60 }); }
    else if (d.kind === 'crevice') { const u = sm(t / 4), x = lerp(780, L.crev.x, u), y = lerp(S4W + 10, L.crev.y, clamp((t - 1.5) / 2, 0, 1)); out.push({ img: 'pup-swim', x, y: y + 16, h: 40, f: 1 }); out.push({ img: 'a-frog-sit', x, y: y - 14, h: 34, f: 1 }); if (t > 4.5) out.push({ spark: 1, x: L.crev.x, y: L.crev.y - 30 }); }
    else {
      const pts = [[300, 700], [800, 740], [1150, 740], [1460, 640], [1420, 420], [L.neck.x + 30, L.neck.y + 30]];
      const u = clamp(t / 5.5, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, u | 0), f = u - i, x = lerp(pts[i][0], pts[i + 1][0], f), y = lerp(pts[i][1], pts[i + 1][1], f);
      out.push({ img: (t * 8 | 0) % 2 ? 'parent-fly1' : 'parent-fly2', x, y, h: 70, f: pts[i + 1][0] >= pts[i][0] ? 1 : -1 });
      out.push({ img: 'a-beetle-happy', x, y: y + 40, h: 30, f: 1 });
      if (t > 5.6) out.push({ spark: 1, x: L.neck.x, y: L.neck.y });
    }
    return out;
  },
};
export const S4: Screen & typeof s4 = s4;

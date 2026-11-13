// Every Creature, screen 3: Otter River. Befriend an otter pup (catch its pebble three times), then:
//  - new pairing: the current beats everyone but the otter; only a frog can hold its breath, so the otter carries the
//    frog on its belly and they dive together under the willow's driftwood jam;
//  - reprise: the frog springs off the otter's belly onto the high bank and tips a log into a ramp for the otter.
// Rules only; drawing is in lib/creature-scene-screens.ts.
import { G, F, clamp, lerp, sm, H, O, ev, snd, voice, rnd, ring, sparkle, splash, dirt, type Form, type Hero, type Screen, type Hint, type Pose, type Rect } from './creature-core.js';
import { befriend, puzzleClick, toward, needPair } from './creature-s1.js';

export const S3G = 760, S3W = 860;
export interface S3State {
  ramp: number; through: boolean; washT: number;
  pup: { st: string; t: number; catches: number; px: number; py: number; tx: number; fl: number; held: boolean; from?: { x: number; y: number } };
}
const S = () => G.S as S3State;
const LV3 = {
  W: 1920, H: 1080,
  water: { x1: 430, x2: 1560, y: S3W, dive: 140 },
  current: { x1: 650, x2: 1560, v: -230 },
  bank: [[-80, S3G], [400, S3G], [470, 870], [560, 1010]] as [number, number][],
  rects: [
    { id: 'jam', x1: 1000, x2: 1160, y1: -300, y2: 950, noTop: 1 },
    { id: 'rbank', x1: 1560, y1: 640, x2: 2100, y2: 1300, rampSkip: 1 },
  ] as Rect[],
  walls: [{ x: 1560, top: 640, bot: 1000, slick: 640, kind: 'rock' }],
  ramps: [{ pts: [[1380, 880], [1565, 645]] as [number, number][], on: () => S().ramp >= 1 }],
  log: { x: 1610, y: 640 }, pup: { x: 560 },
};

const s3 = {
  id: 's3', name: 'Otter River', tune: 's3', bg: 'bg-s3', art: ['bg-s3', 'dora-otter-idle', 'enzo-otter-idle', 'pup-float', 'pebble'], LV: LV3,
  start: [[120, S3G], [60, S3G]] as [number, number][],
  camWin: { x: 1700, y: 500 },
  init(): S3State { return { ramp: 0, pup: { st: 'float', t: 2, catches: 0, px: 560, py: S3W, tx: 0, fl: 0, held: false }, through: false, washT: 0 }; },
  stage() { const st = S(); if (!G.friends.otter) return 'meet'; if (!st.through) return 'dive'; if (st.ramp < 1) return 'bank'; return 'exit'; },
  zone(x: number, y: number) { if (x < 1000) return 'left'; if (x >= 1560 && y < 700) return 'right'; return 'mid'; },
  linked(a: string | number, b: string | number) { return [String(a), String(b)].sort((p, q) => p.localeCompare(q)).join() === 'mid,right' && S().ramp >= 1; },
  pair(f: Form): Form | null { return ({ otter: 'frog', frog: 'otter' } as Partial<Record<Form, Form>>)[f] || (this.stage() === 'dive' ? 'otter' : null); },
  actNear(h: Hero) {
    const st = S(), L = LV3;
    if (st.ramp === 0 && h.ground && h.y <= 642 && Math.abs(h.x - L.log.x) < 80) { this.tipLog(h); return true; }
    return false;
  },
  tipLog(h: Hero) { if (S().ramp > 0) return; S().ramp = .001; h.nudgeT = .4; snd('nudge'); ev('log', h.name); },
  update(dt: number) {
    const st = S(), L = LV3;
    if (st.ramp > 0 && st.ramp < 1) { st.ramp = Math.min(1, st.ramp + dt * 1.6); if (st.ramp >= 1) { splash(1450, S3W, 2); snd('splash'); puzzleClick('ramp', 1480, 760); } }
    if (st.ramp === 0) for (const h of G.heroes) if (!h.respawn && h.ground && h.y <= 642 && h.x > 1560 && h.x - L.log.x < 110 && h.form !== 'otter') this.tipLog(h);
    if (!st.through && G.heroes.some((h) => h.x > 1170 && !h.respawn)) { st.through = true; puzzleClick('jam', 1250, 820); }
    this.pup(dt);
  },
  pup(dt: number) {
    const p = S().pup; p.t -= dt;
    if (G.friends.otter) { p.st = 'clap'; p.px = lerp(p.px, 500, dt); return; }
    if (p.st === 'float' && p.t <= 0) { p.st = 'toss'; p.t = .35; voice('otter'); }
    else if (p.st === 'toss' && p.t <= 0) { p.st = 'fly'; p.fl = 0; p.from = { x: p.px, y: S3W - 30 }; p.tx = 170 + rnd() * 200; const hs = G.heroes.filter((h) => h.x < 420); if (hs.length && rnd() < .5) p.tx = clamp(hs[0].x + (rnd() - .5) * 160, 150, 380); snd('whoosh'); }
    else if (p.st === 'fly') {
      p.fl += dt / 1.5;
      if (p.fl >= 1) {
        const c = G.heroes.find((h) => !h.respawn && Math.abs(h.x - p.tx) < (G.assist ? 58 : 44) && h.y > 700 && h.y < 780);
        if (c) { p.catches++; ring(c.x, c.y - 60, 40); sparkle(c.x, c.y - 70, 10); snd('chirp'); ev('catch', c.name, p.catches); c.friendT = c.form === 'chin' ? .5 : 0; if (p.catches >= 3) { befriend('otter', c, p.px, S3W - 40); return; } p.st = 'back'; p.fl = 0; p.from = { x: c.x, y: c.y - 70 }; }
        else { p.st = 'float'; p.t = 1.1; dirt(p.tx, S3G, 4); snd('plip'); ev('miss'); }
      }
    } else if (p.st === 'back') { p.fl += dt / 1; if (p.fl >= 1) { p.st = 'float'; p.t = .9; splash(p.px, S3W, .4); } }
  },
  pebblePos() {
    const p = S().pup;
    if (p.st === 'fly') { const u = p.fl; return { x: lerp(p.from!.x, p.tx, u), y: lerp(p.from!.y, S3G - 10, u) - Math.sin(Math.PI * u) * 260 }; }
    if (p.st === 'back') { const u = p.fl; return { x: lerp(p.from!.x, p.px, u), y: lerp(p.from!.y, S3W - 30, u) - Math.sin(Math.PI * u) * 200 }; }
    return null;
  },
  goal() { return G.heroes.every((h) => h.x > 1770 && h.y < 650 && !h.respawn && !h.ride); },
  celebrate(i: number) { return { x: 1760 + i * 70, y: 640 }; },
  hint(): Hint {
    const a = H(), b = O(), st = S(), s = this.stage();
    if (s === 'meet') { const p = st.pup; if (a.x > 420) return toward(a, 300); return p.st === 'fly' ? toward(a, p.tx) : null; }
    if (s === 'dive' || (s === 'bank' && Math.max(a.x, b.x) < 1170 && a.y > 700)) {
      const n = needPair('otter', 'frog'); if (n) return n;
      const ot = a.form === 'otter' ? a : b, fr = ot === a ? b : a;
      if (ot.rider !== fr) { if (a.form === 'otter') return Math.abs(a.x - b.x) > 90 ? toward(a, b.x) : { k: 'call' }; return toward(a, b.x); }
      if (ot.x < 900) return toward(a, 1200);
      return { k: 'down', d: 1 };
    }
    if (s === 'bank') {
      if (a.y < 700) return Math.abs(a.x - LV3.log.x) > 60 ? toward(a, LV3.log.x) : { k: 'act' };
      if (a.ride) return a.x < 1480 ? toward(a, 1520) : { k: 'act' };
      if (a.form === 'otter' && a.rider) return a.x < 1480 ? toward(a, 1520) : { k: 'swap' };
      if (a.form === 'frog' && a.swim) return Math.abs(a.x - b.x) > 90 || b.form !== 'otter' ? { k: 'call' } : toward(a, b.x);
      return toward(a, 1500);
    }
    if (a.x < 1170) { if (a.form !== 'otter') return { k: 'form', f: 'otter' }; return a.x < 900 ? toward(a, 1200) : { k: 'down', d: 1 }; }
    if (a.y > 700) return a.form === 'otter' || F[a.form].swim ? toward(a, 1560) : { k: 'call' };
    return toward(a, 1900);
  },
  wantDemo(s: string) { return s === 'dive' || s === 'bank'; },
  demoDur(s: string) { return s === 'dive' ? 6 : 4; },
  demoPose(d: { kind: string; t: number }): Pose[] {
    const t = d.t, out: Pose[] = [];
    if (d.kind === 'dive') {
      const x = lerp(700, 1300, sm(t / 5)), under = x > 940 && x < 1220, y = under ? S3W + 120 : S3W + 10;
      out.push({ img: 'pup-swim', x, y: y + 16, h: 40, f: -1 });
      out.push({ img: 'a-frog-sit', x, y: y - 14, h: 34, f: 1 });
      if (t > 5) out.push({ spark: 1, x: 1300, y: 800 });
    } else {
      const u = clamp(t / 1.2, 0, 1);
      out.push({ img: 'pup-float', x: 1500, y: S3W + 10, h: 40, f: 1 });
      out.push({ img: u < 1 ? 'a-frog-hop' : 'a-frog-sit', x: lerp(1500, 1620, u), y: lerp(S3W - 20, 640, u) - Math.sin(Math.PI * u) * 120, h: 40, f: 1 });
      if (t > 1.6) out.push({ spark: 1, x: 1610, y: 600 });
    }
    return out;
  },
};
export const S3: Screen & typeof s3 = s3;

// Every Creature, screen 2: Fox Hollow. Befriend a fox kit (tag it three times at hide and seek), then:
//  - new pairing: a shelled tortoise keeps the hawk busy (it bonks and reels) while the fox digs a tunnel under the bramble;
//  - reprise: the tortoise drops onto a seesaw and launches a light friend up the clay bank to tug the root door open.
// Rules only; drawing is in lib/creature-scene-screens.ts.
import { G, NOINP, rnd, clamp, lerp, sm, H, O, ev, snd, voice, fx, sparkle, feathers, ring, dirt, floorAt, type Form, type Hero, type Surface, type Screen, type Hint, type Pose, type Rect } from './creature-core.js';
import { dropCarry, dismount, attach } from './creature-forms.js';
import { befriend, puzzleClick, toward, needPair } from './creature-s1.js';

export const S2G = 800;
export interface S2State {
  kit: { bush: number; st: string; t: number; tags: number; x: number };
  hawk: { st: string; t: number; x: number; y: number; cool: number; tgt: Hero | null; rx: number; ry?: number; lock: boolean; k: number; fx?: number; fy?: number };
  dig: number; tunnel: number; saw: number; sawT: number; launched: boolean; door: number; digHint: number;
}
const S = () => G.S as S2State;
const LV2 = {
  W: 1920, H: 1080,
  bank: [[-80, S2G], [1290, S2G], [1340, 690], [1418, 690], [1428, 738]] as [number, number][],
  rects: [
    { id: 'humpwall', x1: 1345, y1: 748, x2: 1420, y2: 1300 },
    { id: 'flat', x1: 1420, y1: S2G, x2: 2100, y2: 1300 },
    { id: 'bramble', x1: 1150, y1: 330, x2: 1290, y2: S2G, thorn: 1 as const },
    { id: 'clay', x1: 1640, y1: 430, x2: 2100, y2: 655 },
  ] as Rect[],
  walls: [{ x: 1640, top: 430, bot: S2G, slick: 430, kind: 'clay' }],
  unsafe: ['bramble'],
  field: { x1: 560, x2: 1150 }, tree: { x: 622, y: 362 }, dig: { x: 1095 }, exitHole: { x: 1338 },
  bushes: [150, 300, 450], piv: { x: 1520, y: 772, half: 108 }, door: { x1: 1640, x2: 1700 }, root: { x: 1770, y: 430 },
};

const s2 = {
  id: 's2', name: 'Fox Hollow', tune: 's2', bg: 'bg-s2',
  art: ['bg-s2', 'dora-fox-idle', 'enzo-fox-idle', 'kit-peek', 'hawk-perch', 'plank', 'mound'], LV: LV2,
  start: [[90, S2G], [40, S2G]] as [number, number][],
  camWin: { x: 1700, y: 620 },
  init(): S2State {
    return {
      kit: { bush: 1, st: 'hide', t: 1.2, tags: 0, x: 300 }, hawk: { st: 'perch', t: 0, x: 622, y: 362, cool: 1.5, tgt: null, rx: 0, lock: false, k: 0 },
      dig: 0, tunnel: 0, saw: .3, sawT: 0, launched: false, door: 0, digHint: 0,
    };
  },
  rects(): Rect[] { return S().door >= 1 ? [] : [{ id: 'door', x1: 1640, y1: 655, x2: 1700, y2: S2G }]; },
  stage() { const st = S(); if (!G.friends.fox) return 'meet'; if (!st.tunnel) return 'dig'; if (!st.launched && st.door < 1) return 'seesaw'; if (st.door < 1) return 'door'; return 'exit'; },
  zone(x: number, y: number) { if (x < 1150) return 'field'; if (x >= 1640 && y < 640) return 'top'; if (x >= 1640 && y > 640) return 'burrow'; return 'hollow'; },
  linked(a: string | number, b: string | number) { const st = S(), k = [String(a), String(b)].sort((p, q) => p.localeCompare(q)).join(); return (k === 'field,hollow' && !!st.tunnel) || ((k === 'burrow,hollow' || k === 'burrow,top') && st.door >= 1); },
  pair(f: Form): Form | null { const s = this.stage(); if (s === 'dig') return ({ fox: 'tort', tort: 'fox' } as Partial<Record<Form, Form>>)[f] || 'fox'; if (s === 'seesaw') return f === 'tort' ? 'beetle' : 'tort'; return null; },
  stay(b: Hero) { return b.form === 'tort' && this.inField(b) && this.stage() === 'dig'; },
  inField(h: Hero) { const L = LV2.field; return h.x > L.x1 && h.x < L.x2 && !h.under && h.y > 600; },
  /** the friend you call to the seesaw waits on its far end */
  callSpot(a: Hero, b: Hero) {
    if (this.stage() === 'seesaw' && a.form === 'tort' && a.x > 1340 && b.form !== 'tort' && S().saw > 0) { const x = 1606; return { x, y: this.plankY(x) }; }
    return null;
  },
  plankY(x: number) { const P = LV2.piv; return P.y + (x - P.x) * Math.tan(S().saw); },
  surfaces(e: Hero, x: number, cand: (y: number, kind: string) => void) { const P = LV2.piv; if (Math.abs(x - P.x) < P.half) cand(this.plankY(x), 'plank'); },
  landed(h: Hero, s: Surface) {
    if (s.kind === 'bramble') { this.thorn(h); return; }
    if (s.kind === 'plank' && h.form === 'tort' && h.x < LV2.piv.x - 20 && S().saw > 0) this.tip(h);
  },
  thorn(h: Hero) { if (h.hurt > 0) return; h.hurt = .5; h.vy = -380; h.knock = h.x < 1220 ? -260 : 260; h.ground = false; snd('hit'); fx(h.x, h.y - 30, 6, { s: 160, g: 400, k: 'leaf', r: 6 }); ev('thorn', h.name, h.form); },
  tip(h: Hero) {
    const st = S(), P = LV2.piv; st.saw = -.3; st.sawT = 1.2; snd('boing'); G.shake = .2; ev('seesaw', h.name);
    for (const o of G.heroes) {
      const r = o.ride ? null : o;
      if (r && r !== h && r.form !== 'tort' && r.ground && r.surf === 'plank' && r.x > P.x + 20) {
        r.vy = -1300; r.vx = 0; r.ground = false; r.surf = ''; r.longJump = false; r.flung = 1.4; ev('launch', r.name, r.form); sparkle(r.x, r.y - 20, 12);
      }
    }
  },
  noForm() { return false; },
  actNear(h: Hero) {
    const st = S(), L = LV2;
    if (st.tunnel && h.ground && !h.under) {
      if (Math.abs(h.x - L.dig.x) < 45 && h.y > 700) { this.enter(h, L.exitHole.x); return true; }
      if (Math.abs(h.x - L.exitHole.x) < 40 && h.y > 700) { this.enter(h, L.dig.x); return true; }
    }
    if (st.door === 0 && h.y <= 432 && Math.abs(h.x - L.root.x) < 80 && h.form !== 'bird') { st.door = .001; h.nudgeT = .4; snd('nudge'); ev('root', h.name); return true; }
    if (h.form === 'fox' && !st.tunnel && Math.abs(h.x - L.dig.x) < 70 && h.ground) return true; // digging is held, see update
    return false;
  },
  enter(h: Hero, to: number) { h.under = .55; h.underTo = to; h.vx = 0; dirt(h.x, h.y, 8); snd('dig'); ev('tunnel', h.name); },
  /** the partner fox digs on its own at the spot; a partner on the clay top tugs the root */
  ai(b: Hero) {
    const st = S(), L = LV2;
    if (b.form === 'fox' && !st.tunnel && Math.abs(b.x - L.dig.x) < 70 && b.ground) return { ...NOINP, actH: true };
    if (st.door === 0 && b.y <= 432 && b.ground && b.form !== 'bird') { if (Math.abs(b.x - L.root.x) < 60) { this.actNear(b); return NOINP; } return { ...NOINP, mx: Math.sign(L.root.x - b.x) }; }
    return null;
  },
  update(dt: number) {
    const st = S(), L = LV2;
    // tunnel travel
    for (const h of G.heroes) if ((h.under ?? 0) > 0) { h.under! -= dt; h.vx = 0; if (h.under! <= 0) { h.under = 0; h.x = h.underTo!; h.y = floorAt(h.x); h.ground = true; h.vy = -260; dirt(h.x, h.y, 10); snd('dig'); if (h.rider) attach(h); } }
    for (const h of G.heroes) if ((h.flung ?? 0) > 0) { h.flung! -= dt; if (h.ground || h.ride) h.flung = 0; else if (h.y < 470 || h.x < 1590) h.x += 330 * dt; }
    this.kit(dt); this.hawk(dt);
    // digging: the fox holds Space at the soft earth; the hawk knocks it back to nothing
    let digging = false;
    for (const h of G.heroes) {
      h.digging = false;
      if (h.form === 'fox' && !st.tunnel && h.ground && !h.respawn && h.hurt <= 0 && Math.abs(h.x - L.dig.x) < 70 && h.inp && h.inp.actH) {
        h.digging = true; digging = true; h.face = 1; st.dig += dt; if (rnd() < .4) dirt(h.x + 30, S2G, 1); if ((G.t * 7 | 0) !== ((G.t - dt) * 7 | 0)) snd('dig');
        if (st.dig >= 4.3) { st.tunnel = 1; puzzleClick('tunnel', L.dig.x + 100, 700); voice('fox'); dirt(L.dig.x, S2G, 30); ev('tunnelOpen'); }
      }
    }
    if (!digging && st.dig > 0 && !st.tunnel) st.digHint += dt;
    // the seesaw rocks back when the tortoise steps off
    if (st.sawT > 0) st.sawT -= dt;
    const tortOn = G.heroes.some((h) => h.form === 'tort' && h.ground && h.surf === 'plank' && h.x < L.piv.x);
    if (!tortOn && st.sawT <= 0) st.saw = Math.min(.3, st.saw + dt * .8);
    if (!st.launched && G.heroes.some((h) => h.y < 440 && h.x > 1640 && h.ground)) { st.launched = true; puzzleClick('launch', 1700, 400); }
    if (st.door > 0 && st.door < 1) { st.door = Math.min(1, st.door + dt * 1.4); if (st.door >= 1) puzzleClick('door', 1670, 720); }
    for (const h of G.heroes) { const hk = st.hawk; h.danger = (hk.st === 'tell' && hk.lock && hk.tgt === h) || (hk.st === 'dive' && hk.tgt === h); }
  },
  kit(dt: number) {
    const k = S().kit, L = LV2;
    if (G.friends.fox) { k.st = 'happy'; k.x = lerp(k.x, 60, dt); return; }
    k.t -= dt;
    if (k.st === 'hide' && k.t <= 0) { k.st = 'peek'; k.t = G.assist ? 2.4 : 1.6; k.x = L.bushes[k.bush]; voice('fox'); }
    else if (k.st === 'peek') {
      for (const h of G.heroes) if (!h.respawn && Math.abs(h.x - k.x) < 62 && h.y > 700) {
        k.tags++; sparkle(k.x, S2G - 90, 14); ring(k.x, S2G - 60, 50); snd('chirp'); ev('tag', k.tags);
        if (k.tags >= 3) { befriend('fox', h, k.x, S2G - 60); return; }
        k.st = 'hide'; k.t = .5; this.moveKit(h); return;
      }
      if (k.t <= 0) { k.st = 'hide'; k.t = 1.1; this.moveKit(); }
    }
  },
  moveKit(h?: Hero) {
    const k = S().kit, L = LV2; let n; do n = rnd() * 3 | 0; while (n === k.bush);
    if (h) { const far = [0, 1, 2].sort((a, b) => Math.abs(L.bushes[b] - h.x) - Math.abs(L.bushes[a] - h.x)); n = far[0] === k.bush ? far[1] : far[0]; }
    k.bush = n;
  },
  hawk(dt: number) {
    const k = S().hawk, L = LV2, T = L.tree; k.t += dt; if (k.cool > 0) k.cool -= dt;
    if (!G.friends.fox) { k.st = 'perch'; return; }
    const target = () => {
      const c = G.heroes.filter((h) => !h.respawn && !h.ride && h.arriveT <= 0 && (this.inField(h) || (h.form === 'bird' && h.y < 640)));
      return c.find((h) => h.form === 'tort') || c.sort((a, b) => Math.abs(a.x - T.x) - Math.abs(b.x - T.x))[0];
    };
    const tell = G.assist ? 1.8 : 1.3;
    if (k.st === 'perch') { k.x = T.x; k.y = T.y; if (k.cool <= 0) { const t = target(); if (t) { k.st = 'tell'; k.t = 0; k.tgt = t; k.rx = t.x; k.lock = false; snd('snap'); ev('hawkTell', t.name, t.form); } } }
    else if (k.st === 'tell') {
      const t = k.tgt!, still = this.inField(t) || (t.form === 'bird' && t.y < 640);
      if ((!still || t.respawn) && !k.lock) { k.st = 'perch'; k.cool = .5; return; }
      if (k.t < tell - .45) { k.rx = t.x; k.ry = t.y; } else k.lock = true;
      if (k.t >= tell) { k.st = 'dive'; k.t = 0; k.fx = T.x; k.fy = T.y; snd('whoosh'); }
    } else if (k.st === 'dive') {
      const u = clamp(k.t / .42, 0, 1); k.x = lerp(k.fx!, k.rx, u); k.y = lerp(k.fy!, k.ry! - 40, u * u);
      if (u >= 1) {
        const hit = G.heroes.find((h) => !h.respawn && !h.under && Math.abs(h.x - k.rx) < (h.form === 'tort' ? 85 : 66) && Math.abs(h.y - k.ry!) < 120);
        if (hit && hit.form === 'tort' && hit.shell) { k.st = 'dazed'; k.t = 0; snd('bonk'); voice('tort'); sparkle(k.rx, k.ry! - 70, 14, '#fff'); G.stats.blocks++; G.shake = .15; ev('hawkBonk'); k.y = hit.y - 60; k.x = hit.x + 40; }
        else {
          if (hit) { G.stats.hits++; snd('hit'); hit.hurt = .55; hit.vy = -420; hit.knock = hit.x < 900 ? -300 : -340; hit.ground = false; if (hit.carry) dropCarry(hit); if (hit.rider) dismount(hit.rider, 300); feathers(hit.x, hit.y - 30, 5, hit.name); ev('hawkHit', hit.name, hit.form); if (hit.form === 'fox') S().dig = 0; }
          k.st = 'up'; k.t = 0; k.fx = k.x; k.fy = k.y;
        }
      }
    } else if (k.st === 'dazed') { if (k.t > 1.2) { k.st = 'up'; k.t = 0; k.fx = k.x; k.fy = k.y; } }
    else if (k.st === 'up') { const u = clamp(k.t / .7, 0, 1); k.x = lerp(k.fx!, T.x, sm(u)); k.y = lerp(k.fy!, T.y, sm(u)); if (u >= 1) { k.st = 'perch'; k.cool = 0; } }
  },
  goal() { return G.heroes.every((h) => h.x > 1850 && h.y > 700 && !h.respawn && !h.ride); },
  celebrate(i: number) { return { x: 1800 + i * 60, y: S2G }; },
  hint(): Hint {
    const a = H(), b = O(), st = S(), L = LV2, s = this.stage();
    if (s === 'meet') { const k = st.kit; return k.st === 'peek' ? toward(a, k.x) : toward(a, L.bushes[1]); }
    if (s === 'dig') {
      const n = needPair('fox', 'tort'); if (n) return n;
      if (a.form === 'fox') { if (b.form === 'tort' && !this.inField(b)) return { k: 'swap' }; return Math.abs(a.x - L.dig.x) > 50 ? toward(a, L.dig.x) : { k: 'act' }; }
      if (!this.inField(a)) return toward(a, 800);
      if (Math.abs(b.x - L.dig.x) > 60) return { k: 'swap' };
      return st.hawk.st === 'tell' ? { k: 'act' } : null;
    }
    if (s === 'seesaw') {
      if (a.x < 1290) return Math.abs(a.x - L.dig.x) > 30 ? toward(a, L.dig.x) : { k: 'act' };
      const n = needPair('tort', 'beetle'); if (n && !(a.form !== 'tort' && b.form === 'tort')) return n;
      if (a.form === 'tort') { const onR = b.surf === 'plank' && b.x > L.piv.x + 20; if (st.saw < 0 && !onR) return toward(a, 1590); if (!onR) return a.x < 1340 ? toward(a, 1385) : { k: 'call' }; return toward(a, 1460); }
      if (b.form !== 'tort') return { k: 'form', f: 'tort' };
      return Math.abs(a.x - 1600) > 20 ? toward(a, 1600) : { k: 'swap' };
    }
    if (s === 'door') { if (a.y < 440) return Math.abs(a.x - L.root.x) > 60 ? toward(a, L.root.x) : { k: 'act' }; return { k: 'swap' }; }
    if (a.y < 640) return toward(a, 1600);
    return toward(a, 1900);
  },
  wantDemo(s: string) { return s === 'dig' || s === 'seesaw'; },
  demoDur(s: string) { return s === 'dig' ? 6.5 : 4.5; },
  demoPose(d: { kind: string; t: number }): Pose[] {
    const t = d.t, out: Pose[] = [], L = LV2;
    if (d.kind === 'dig') {
      const u = (t % 3.2) / 3.2;
      out.push({ img: 'a-tort-back', x: 820, y: S2G + 4, h: 60, f: 1 });
      const hx = u < .5 ? lerp(L.tree.x, 820, sm(u * 2)) : 860, hy = u < .5 ? lerp(L.tree.y, S2G - 60, (u * 2) ** 2) : S2G - 30;
      out.push({ img: u < .5 ? 'hawk-dive' : 'hawk-dazed', x: hx, y: hy, h: 90, f: 1 });
      out.push({ img: 'kit-sniff', x: L.dig.x, y: S2G, h: 54, f: 1 });
      if (t > 4.5) out.push({ spark: 1, x: L.dig.x + 100, y: 740 });
    } else {
      const u = clamp((t - .6) / 1, 0, 1);
      out.push({ img: 'a-tort-walk', x: lerp(1380, 1450, u), y: lerp(690, 742, u * u), h: 56, f: 1 });
      const v = clamp((t - 1.6) / 1.4, 0, 1);
      out.push({ img: 'a-beetle-happy', x: lerp(1600, 1700, v), y: v > 0 ? lerp(800, 430, v) - Math.sin(v * Math.PI) * 120 : 800, h: 36, f: 1 });
      if (t > 3) out.push({ spark: 1, x: L.root.x, y: 400 });
    }
    return out;
  },
};
export const S2: Screen & typeof s2 = s2;

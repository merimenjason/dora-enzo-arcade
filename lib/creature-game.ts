// Every Creature, Chapter One: the chapter flow. Title → four screens (The Lake, Fox Hollow, Otter River, Storm Falls)
// → the end card; the fixed 60 Hz step (solo with a partner AI and the call, or two players), auto-boarding, ghost
// demos for stuck players, the checkpoint save (`every-creature-cp1`), the hero sprite picker and a snapshot for tests.
// Pure, no DOM: the page feeds inputs in and plays the queued sounds. Ported from the prototype's main.js.
import {
  G, LV, SCR, F, NOINP, FORMS, bindGame, bindScreen, seedRnd, rnd, lerp, H, O, other, ev, snd, fx, sparkle, tickFx,
  type Game, type Hero, type Input, type Friends, type Form, type Screen,
} from './creature-core.js';
import { mkHero, setForm, cycleForm, swap, callPartner, aiInput, dismount, dropCarry, grab, attach, updHero } from './creature-forms.js';
import { S1 } from './creature-s1.js';
import { S2 } from './creature-s2.js';
import { S3 } from './creature-s3.js';
import { S4 } from './creature-s4.js';

export * from './creature-core.js';
export { setForm, cycleForm, swap, callPartner, dismount } from './creature-forms.js';

export const SCREENS: Screen[] = [S1, S2, S3, S4];
export const DT = 1 / 60;
export const SAVE_KEY = 'every-creature-cp1';
export interface Checkpoint { si: number; friends: Friends; total: number }

/** a checkpoint from storage, or null when there is none or it doesn't fit this build */
export function parseSave(raw: string | null): Checkpoint | null {
  try {
    const c = JSON.parse(raw ?? 'null');
    if (!c || typeof c.si !== 'number' || !(c.si > 0 && c.si < SCREENS.length) || typeof c.friends !== 'object') return null;
    return { si: c.si, friends: { ...noFriends(), ...c.friends }, total: +c.total || 0 };
  } catch { return null; }
}
const noFriends = (): Friends => ({ tort: false, frog: false, bird: false, beetle: false, fox: false, otter: false });

export interface NewGame { seed?: number; si?: number; total?: number; mode?: Game['mode']; assist?: boolean; two?: boolean; friends?: Partial<Friends> }
export function newGame(o: NewGame = {}): Game {
  seedRnd((o.seed || 7) * 7919 + 13);
  const g: Game = {
    t: 0, total: o.total || 0, si: 0, mode: o.mode || 'play', assist: o.assist !== false, two: !!o.two, act: 0,
    heroes: [null as unknown as Hero, null as unknown as Hero],
    friends: Object.assign(noFriends(), o.friends || {}),
    fx: [], poofs: [], rings: [], flyIcons: [], shake: 0, clear: false, clearT: 0, transT: 0, endT: 0,
    demo: null, demoCool: 0, idleT: 0, stuckT: 0, scheme: 'arrows', ev: [], S: null, tune: null, sfx: [],
    stats: { formChanges: 0, swaps: 0, calls: 0, denied: 0, splashes: 0, hits: 0, blocks: 0, slips: 0, friendAt: {}, puzzleAt: {}, inputs: 0, scr: [] },
  };
  bindGame(g);
  g.heroes = [mkHero('dora', 285, 800), mkHero('enzo', 205, 800)];
  loadScreen(o.si || 0);
  return g;
}
/** the checkpoint to store after loading a screen (screens after the first) */
export function checkpoint(): Checkpoint | null { return G.si > 0 ? { si: G.si, friends: { ...G.friends }, total: G.total } : null; }

export function loadScreen(i: number) {
  bindScreen(SCREENS[i]); G.si = i; G.S = SCR.init(); G.t = 0; G.clear = false; G.clearT = 0; G.demo = null; G.demoCool = 4; G.stuckT = 0; G.idleT = 0;
  G.fx = []; G.rings = []; G.poofs = [];
  G.heroes.forEach((h, k) => {
    const [x, y] = SCR.start[k], form = h.form, hn = mkHero(h.name, x, y); Object.assign(h, hn);
    for (const key of Object.keys(h) as (keyof Hero)[]) if (!(key in hn)) delete h[key];
    h.form = form === 'tort' || form === 'chin' || form === 'fox' || form === 'beetle' || form === 'frog' ? form : 'chin';
  });
  G.stats.scr[i] = { i, t0: G.total, swaps0: G.stats.swaps, forms0: G.stats.formChanges, calls0: G.stats.calls, time: null };
  G.tune = SCR.tune;
  ev('screen', SCR.id);
}
export function nextReady() { return G.si + 1 < SCREENS.length ? G.si + 1 : -1; }

const busy = (x: Input | null) => !!x && !!(x.mx || x.my || x.actP || x.actH || x.upP || x.formP || x.formSet || x.swapP || x.callP);
/** one fixed step of play */
export function step(raw: { a?: Input; b?: Input | null }, dt = DT) {
  if (G.mode !== 'play') return;
  G.t += dt; G.total += dt; G.stuckT += dt; G.idleT += dt; if (G.demoCool > 0) G.demoCool -= dt; if (G.shake > 0) G.shake -= dt;
  let inA = raw.a || NOINP, inB = raw.b || null;
  if (busy(inA) || busy(inB)) G.idleT = 0;
  if (G.clear) { inA = NOINP; inB = NOINP; }
  const riderSteer = (h: Hero, x: Input): Input => { // a rider steers the pair from its seat; Space hops off
    const c = h.ride!;
    const ib = { ...NOINP, mx: x.mx, my: c.form === 'bird' ? 0 : x.my, actP: c.form === 'bird' ? x.upP : false, actH: c.form === 'bird' ? x.my < 0 : (c.form === 'tort' && c.danger) || (c.form === 'otter' && x.my > 0) };
    if (x.actP) dismount(h, ['tort', 'otter', 'fox'].includes(c.form) ? (F[h.form].jump || 0) * (c.form === 'otter' ? 1.12 : 1) : 0);
    else if (x.mx) h.face = x.mx;
    return ib;
  };
  if (!G.two) {
    if (inA.swapP) swap();
    const a = H(), b = O();
    if (inA.formSet) setForm(a, a.form === inA.formSet ? 'chin' : inA.formSet); else if (inA.formP) cycleForm(a, inA.formP);
    if (inA.callP) callPartner();
    let ia = inA, ib = aiInput(b, a);
    if (a.ride) { ib = riderSteer(a, ia); ia = NOINP; }
    if (b.ride === a) ib = NOINP;
    for (const h of G.heroes) if (!h.under) updHero(h, h === a ? ia : ib, dt);
  } else {
    const ins = [inA, inB || NOINP];
    G.heroes.forEach((h, i) => { const x = ins[i]; if (x.formSet) setForm(h, h.form === x.formSet ? 'chin' : x.formSet); else if (x.formP) cycleForm(h, x.formP); });
    G.heroes.forEach((h, i) => {
      let x = ins[i];
      if (h.ride) { const steer = riderSteer(h, x); if (h.ride) h.ride.inp2 = steer; x = NOINP; }
      else if (h.inp2 && h.rider && !busy(x)) x = { ...x, actH: h.inp2.actH };
      h.inp2 = null;
      if (!h.under) updHero(h, x, dt);
    });
  }
  // a bird coming down onto its beetle partner picks it up
  for (const bd of G.heroes) {
    const bt = other(bd);
    if (bd.form === 'bird' && bt.form === 'beetle' && !bd.carry && !bt.ride && !bt.climb && !bd.respawn && !bt.respawn && bd.hurt <= 0 && !bd.ground && bd.vy >= -50 && !(G.t - (bd.dropAt ?? -9) < 1.2)) {
      const gx = G.assist ? 70 : 46, gy = G.assist ? 125 : 75;
      if (Math.abs(bd.x - bt.x) < gx && bt.y - bd.y > 6 && bt.y - bd.y < gy) grab(bd, bt);
    }
    if (bd.carry) bd.carryT += dt;
  }
  for (const h of G.heroes) attach(h);
  SCR.update(dt);
  updDemo(dt);
  // screen clear: celebrate, then move on
  if (!G.clear && SCR.goal()) {
    G.clear = true; G.clearT = 0; G.stats.scr[G.si]!.time = +(G.total - G.stats.scr[G.si]!.t0).toFixed(1); G.stats.puzzleAt[G.si + ':goal'] = +G.total.toFixed(1);
    snd('win'); if (SCR.onClear) SCR.onClear(); ev('clear', SCR.id);
    for (const h of G.heroes) { if (h.ride) dismount(h, 0); if (h.carry) dropCarry(h); }
  } else if (G.clear) {
    G.clearT += dt;
    const cam = SCR.camWin;
    G.heroes.forEach((h, i) => { const p = SCR.celebrate(i); if (!h.respawn) { h.x = lerp(h.x, p.x, dt * 2.5); h.face = 1; if (h.ground && h.y > p.y - 3 && Math.abs(h.y - p.y) < 30) h.y = p.y; } });
    if (rnd() < .5) fx(cam.x + (rnd() - .5) * 900, cam.y - 500, 1, { a: Math.PI / 2, spread: .6, s: 80, g: 60, k: 'petal', life: 5, r: 8 });
    if (G.clearT % 1.2 < dt) sparkle(cam.x, cam.y - 80, 24);
    if (G.clearT > 3.4) {
      const n = nextReady();
      if (n >= 0) { G.mode = 'trans'; G.transT = 0; G.nextSi = n; snd('whoosh'); }
      else { G.mode = 'end'; G.endT = 0; G.endFull = G.si === SCREENS.length - 1; G.tune = 'calm'; ev('end', +G.total.toFixed(1)); }
    }
  }
}
function updDemo(dt: number) {
  if (G.demo) { G.demo.t += dt; if (G.demo.t > G.demo.dur) { G.demo = null; G.demoCool = 22; } return; }
  if (G.demoCool > 0 || G.clear) return;
  const s = SCR.stage();
  const want = (G.stuckT > (G.assist ? 16 : 30) && G.idleT > 2.5) || G.idleT > (G.assist ? 9 : 14) || G.stuckT > (G.assist ? 35 : 55);
  if (want && SCR.wantDemo(s)) { G.demo = { kind: s, t: 0, dur: SCR.demoDur(s) }; ev('demo', s); }
}
/** the transition card and the end card; returns true on the frame a new screen loads (the camera should snap) */
export function tickModes(dt: number) {
  let loaded = false;
  if (G.mode === 'trans') { const was = G.transT; G.transT += dt; if (was < .6 && G.transT >= .6) { loadScreen(G.nextSi!); loaded = true; } if (G.transT > 2.2) G.mode = 'play'; }
  if (G.mode === 'end') G.endT += dt;
  return loaded;
}
/** leave the title (or the end card) for the first screen, or for a checkpoint */
export function startGame(cp: Checkpoint | null, o: { assist: boolean; two: boolean; seed?: number }) {
  newGame(cp ? { si: cp.si, friends: cp.friends, total: cp.total, assist: o.assist, two: o.two, seed: o.seed } : { assist: o.assist, two: o.two, seed: o.seed });
  G.mode = 'trans'; G.transT = .6; G.nextSi = G.si;
  return G;
}
/** a step for tests and bots: the play step, the modes and the effects */
export function advance(inA: Partial<Input> = {}, n = 1, inB?: Partial<Input>) {
  for (let i = 0; i < n; i++) { step({ a: { ...NOINP, ...inA }, b: inB ? { ...NOINP, ...inB } : null }); tickModes(DT); tickFx(DT); G.sfx.length = 0; }
}

// ---------------------------------------------------------------- the painted frame for a hero right now
export function heroSprite(h: Hero): string {
  const n = h.name, f = h.form, mv = Math.abs(h.vx) > 10;
  if (f === 'chin') {
    if (h.respawn > 0 || h.hurt > 0) return n + '-hurt';
    if (G.clear) return n + '-cheer';
    if (h.friendT > 0) return n + '-friend';
    if (h.climb) return n + '-climb' + (1 + (((h.climbAnim || 0) | 0) % 2));
    if (h.ride) return n + '-ride';
    if (h.nudgeT > 0) return n + '-nudge';
    if (!h.ground) return h.vy < 0 ? n + '-jump' : n + '-fall';
    if (h.landT > 0) return n + '-land';
    if (mv) return n + '-run' + [1, 2, 3, 2][(h.anim * 10 | 0) % 4];
    return (h.t % 3.3 < .15) ? n + '-blink' : n + '-idle';
  }
  const p = n + '-' + f + '-';
  if (h.respawn > 0 || h.hurt > 0) return p + 'hurt';
  if (f === 'tort') {
    if (h.shell) return p + 'shell';
    if (h.rider && !mv) return p + 'carry';
    if (h.swim) return p + (mv ? 'swim' + (1 + ((h.anim * 4 | 0) % 2)) : 'swim' + (1 + ((h.anim * 1.5 | 0) % 2)));
    if (mv) return p + 'walk' + (1 + ((h.anim * 5 | 0) % 2));
    return p + (G.clear && (h.t % 1 < .5) ? 'carry' : 'idle');
  }
  if (f === 'frog') {
    if (h.ride) return p + 'ride';
    if (h.swim) return p + (mv ? 'swim' + (1 + ((h.anim * 5 | 0) % 2)) : 'swim2');
    if (!h.ground) return p + 'leap';
    if (h.landT > 0) return p + 'land';
    if (mv) return p + ((h.anim * 6 | 0) % 2 ? 'land' : 'idle');
    return p + ((h.t % 4 < .5 || G.clear && h.t % 1 < .5) ? 'puff' : 'idle');
  }
  if (f === 'bird') {
    if (h.carry) return p + ((h.anim * 8 | 0) % 2 ? 'carry' : 'flap2');
    if (!h.ground) { if (h.flapT > 0) return p + (h.flapT > .13 ? 'flap1' : 'flap2'); return h.vy > 0 ? p + 'glide' : p + 'flap2'; }
    if (h.landT > 0) return p + 'land';
    if (mv) return p + ((h.anim * 6 | 0) % 2 ? 'hop' : 'idle');
    return p + (G.clear && h.t % 1 < .5 ? 'flap1' : 'idle');
  }
  if (f === 'fox') {
    if (h.digging) return p + 'dig' + (1 + ((h.anim * 9 | 0) % 2));
    if (h.ride) return p + 'idle';
    if (!h.ground) return p + 'leap';
    if (mv) return p + 'run' + (1 + ((h.anim * 9 | 0) % 2));
    if (h.rider) return p + 'carry';
    if (h.inp && h.inp.my > 0) return p + 'sniff';
    return p + (G.clear && h.t % 1 < .5 ? 'leap' : 'idle');
  }
  if (f === 'otter') {
    if (h.swim) { if (h.dive) return p + (h.y < LV.water!.y + (LV.water!.dive || 140) - 20 ? 'dive' : 'glide'); if (h.rider || !mv) return p + 'float'; return p + 'swim' + (1 + ((h.anim * 5 | 0) % 2)); }
    if (h.ride) return p + 'idle';
    if (!h.ground) return p + 'leap';
    if (mv) return p + ((h.anim * 6 | 0) % 2 ? 'walk' : 'idle');
    return p + (G.clear && h.t % 1 < .5 ? 'leap' : 'idle');
  }
  // beetle
  if (h.ride) return p + (h.ride.form === 'bird' ? 'carried' : 'idle');
  if (h.climb) return p + 'climb' + (1 + (((h.climbAnim || 0) | 0) % 2));
  if (!h.ground) return p + 'hop';
  if (mv) return p + 'walk' + (1 + ((h.anim * 8 | 0) % 2));
  return p + (G.clear && h.t % 1 < .5 ? 'hop' : 'idle');
}

/** a plain snapshot of the running game for tests and the bots */
export function snapshot() {
  return {
    t: +G.t.toFixed(2), total: +G.total.toFixed(1), mode: G.mode, si: G.si, screen: SCR.id, clear: G.clear, assist: G.assist, two: G.two, active: H().name, stage: SCR.stage(),
    heroes: G.heroes.map((h) => ({ name: h.name, form: h.form, x: +h.x.toFixed(1), y: +h.y.toFixed(1), vx: +h.vx.toFixed(0), vy: +h.vy.toFixed(0), ground: h.ground, swim: h.swim, dive: h.dive, surf: h.surf, climb: h.climb, ride: h.ride ? h.ride.name : null, rider: h.rider ? h.rider.name : null, carry: h.carry ? h.carry.name : null, shell: h.shell, hurt: h.hurt > 0, respawn: h.respawn > 0, under: (h.under ?? 0) > 0, sprite: heroSprite(h) })),
    friends: { ...G.friends }, demo: G.demo && G.demo.kind, idleT: +G.idleT.toFixed(1), hint: G.mode === 'play' ? SCR.hint() : null,
  };
}
export const ALL_FORMS: Form[] = FORMS;

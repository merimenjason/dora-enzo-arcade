// Above & Below: the four rooms of Chapter One, in order. Each room is one painting with its geometry (ground line,
// caves, soft and hidden soil), its beats (the puzzle steps, who must do each, where, and the hint icon), and its rules.
// Drawing lives in lib/above-scene.ts. Pure: no DOM.
import { WW, CELL, type Geo } from './above-world.js';
import type { AboveGame, Hero, HeroId, Act, Brace, Dirs } from './above-game.js';
import { STREAM, DEN } from './above-rooms2.js';

export interface Beat { id: string; who: HeroId | 'both'; tx: number; ty: number; act: 'act' | 'move' | 'up' | 'down' | 'hold'; icon: string; ghost?: string; noGhost?: boolean }
export interface Route { tx: number; ty: number; act: Beat['act']; id: string }
export interface Leaf { x: number; y: number; bob: number; minX: number; maxX: number; exitX: number; exitLX?: number; exitY: number; driftX: number; floorY: number }
export interface Cap { x: number; y: number; gone: boolean; vy: number; vx: number; px: number; py: number; lift: boolean }
export interface Grubber { x: number; dir: number; st: string; t: number; hp: number; atk: number; nx: number; firstWind: boolean; firstRing: boolean; tell: number }
export interface Clod { x: number; t: number; y: number; hit: boolean; done: boolean }
/** the current room's moving parts; each room fills in its own */
export interface O {
  hawk: { on: boolean; t: number; x: number; phase: 'wait' | 'warn' | 'pass'; next: number; pass: number; dir: number };
  leaf?: Leaf;
  // the meadow
  sluice?: { x: number; y: number; open: boolean; t: number };
  root?: { x: number; y: number; wet: number }; cup?: { x: number; y: number };
  sapling?: { x: number; y: number; stage: number; t: number; growing: boolean };
  flag?: { x: number; y: number; cracks: number; broken: boolean; t: number; wob: number }; beam?: number; onFlag?: boolean;
  bug?: { x: number; y: number; state: 'block' | 'hiss' | 'flinch' | 'squint' | 'ball' | 'gone'; t: number; vx: number };
  caps?: Cap[]; door?: { x: number; y: number; open: number };
  // the orchard roots
  lift?: number; rope?: number; gatesUp?: boolean; gateT?: number; ditchT?: number;
  // the stream bank
  fall?: number; dust?: { x: number; y: number; vy: number; t: number }[]; basinT?: number;
  // Old Grubber's den
  gb?: Grubber; wave?: { x: number; dir: number; t: number } | null; clods?: Clod[]; bar?: number;
}
export interface HawkCfg {
  x0: number; x1: number; homeX: number; homeY: number; groundMax: number;
  active(g: AboveGame): boolean; cover(g: AboveGame, D: Hero): boolean; canHide(g: AboveGame, D: Hero): boolean; coverIcon: string;
  gap?(g: AboveGame): number; coverAt?(g: AboveGame, D: Hero): [number, number];
}
export interface Room {
  id: string; name: string; bg: string; dodgy?: boolean;
  spawn: Record<HeroId, [number, number]>; geo: Geo; beats: Beat[];
  climb?: { x: number; top: number; bottom: number; exitX: number; exitY: number; ready(g: AboveGame): boolean };
  hawk?: HawkCfg;
  init(g: AboveGame, o: O): void;
  update(g: AboveGame, dt: number): void;
  route?(g: AboveGame, h: Hero, b: Beat): Route | null;
  needFor?(g: AboveGame, b: Beat): HeroId;
  tryAct?(g: AboveGame, h: Hero, d: Dirs): boolean;
  actTick?(g: AboveGame, h: Hero, a: Act): void;
  stamped?(g: AboveGame, h: Hero): void;
  landed?(g: AboveGame, h: Hero): void;
  dugNothing?(g: AboveGame, h: Hero, a: Act): void;
  duck?(g: AboveGame, h: Hero): void;
  rodeOff?(g: AboveGame, h: Hero, dir: number): void;
  platform?(g: AboveGame, h: Hero, ny: number): boolean;
  braceTick?(g: AboveGame, h: Hero, b: Brace, dt: number): void;
  stations?(g: AboveGame): { dora: number | null; enzo: number | null };
  helpers?(g: AboveGame): void;
  glints?(g: AboveGame, b: Beat): [number, number][];
  icon?(g: AboveGame, b: Beat): string;
  focusPts?(g: AboveGame): [number, number][];
  clipHero?(g: AboveGame, h: Hero): number | null;
  faceX?(g: AboveGame): number;
  loose?(g: AboveGame): boolean;
}

// ───────────────────────────────────────────── 1 · The Meadow
// the sluice, the leaf, the plug, the thirsty root, the sapling, the cracked flagstone, the woodlouse in the dark,
// the bolt-holes and the hawk, then both through the round door
export const Y = { meadow: 375, bank: 255, pit: 902, ledge: 642, cham: 697, hawk: 622 };
export const X = { cliff: 835, bankEnd: 1190, slopeEnd: 1250, pitR: 585, chamL: 958, chamR: 1240 };
const onFlag = (h: Hero) => Math.abs(h.x - 1062) < 54 && Math.abs(h.y - Y.bank) < 6;
function crack(g: AboveGame) {
  const o = g.o; if (o.flag!.broken) return;
  o.flag!.cracks++; o.flag!.t = 0; g.fx('crumb', 1062, Y.bank + 4, 6); g.sfx('crack');
  if (o.flag!.cracks >= 2) { o.flag!.broken = true; o.flag!.t = 0; g.sfx('shine'); g.flash = 0.3; g.advance('stamp'); o.bug!.state = 'squint'; o.bug!.t = 0; }
  else if (o.bug!.state === 'block' || o.bug!.state === 'hiss') { o.bug!.state = 'flinch'; o.bug!.t = 0; g.sfx('shine'); }
}
function popCap(g: AboveGame, i: number) {
  const c = g.o.caps![i]; c.gone = true; c.vy = -520; c.px = c.x; c.py = Y.meadow - 30; c.vx = (i ? 1 : -1) * 120;
  const hx = [[1305, 1350], [1418, 1465]][i]; g.world.clearRect(hx[0] + 2, Y.meadow - 2, hx[1], 482);
  g.sfx('heave'); g.sfx('pop'); g.shake = 5; g.fx('crumb', c.x, Y.meadow, 14);
  if (g.beat <= 7) { if (g.beat < 7) g.beat = 7; g.advance('heave'); }
}
function bugUpdate(g: AboveGame, dt: number, E: Hero) {
  const b = g.o.bug!; b.t += dt;
  if (b.state === 'block' || b.state === 'hiss') {
    const dx = E.x - b.x;
    b.state = Math.abs(dx) < 120 && E.y > 600 ? 'hiss' : 'block';
    if (b.state === 'hiss' && b.t > 1.2) { b.t = 0; g.sfx('hiss'); }
    if (Math.abs(dx) < 50 && Math.abs(E.y - b.y) < 60) g.bump(E, -1);
  } else if (b.state === 'flinch') { if (b.t > 0.8) { b.state = 'block'; b.t = 0; } }
  else if (b.state === 'squint') { if (b.t > 0.9) { b.state = 'ball'; b.t = 0; b.vx = 0; } }
  else if (b.state === 'ball') {
    b.vx = Math.min(300, b.vx + 500 * dt); b.x += b.vx * dt;
    if (b.x > X.chamR - 10) b.y = Math.max(Y.hawk, b.y - 260 * dt);
    if (b.x > WW + 80) b.state = 'gone';
  }
}
export const MEADOW: Room = {
  id: 'meadow', name: 'The Meadow', bg: 'bg',
  spawn: { dora: [330, Y.meadow], enzo: [210, Y.pit] },
  geo: {
    ground(x) {
      if (x < X.cliff) return Y.meadow;
      if (x < X.bankEnd) return Y.bank;
      if (x < X.slopeEnd) return Y.bank + (x - X.bankEnd) / (X.slopeEnd - X.bankEnd) * (Y.meadow - Y.bank);
      return Y.meadow;
    },
    caves: [[40, 485, X.pitR, Y.pit], [X.pitR, 490, X.chamL + 4, Y.ledge], [X.chamL, 445, X.chamR + 4, Y.cham], [X.chamR, 478, WW, Y.hawk]],
    soft(x, y) {
      const w = Math.sin(y * 0.09) * 6 + Math.sin(y * 0.23 + 1) * 4;
      if (y >= 490 && y < Y.ledge && x >= 674 + w && x < 750 - w * 0.7) return true;
      for (const [c, hw, hh] of [[96, 70, 64], [530, 60, 90]]) { const k = (x - c) / hw; if (Math.abs(k) < 1 && y > Y.pit - hh * (1 - k * k) && y < Y.pit) return true; }
      return false;
    },
  },
  beats: [
    { id: 'sluice', who: 'dora', tx: 488, ty: Y.meadow, act: 'act', icon: 'sluice0', ghost: 'd_pull2' },
    { id: 'ride', who: 'enzo', tx: 640, ty: Y.ledge, act: 'move', icon: 'leaf', ghost: 'e_ride' },
    { id: 'dig', who: 'enzo', tx: 660, ty: Y.ledge, act: 'act', icon: 'e_dig1', ghost: 'e_dig1' },
    { id: 'water', who: 'enzo', tx: 798, ty: Y.ledge, act: 'act', icon: 'cup', ghost: 'e_water' },
    { id: 'climb', who: 'dora', tx: 812, ty: Y.meadow, act: 'up', icon: 'sap3', ghost: 'd_climb1' },
    { id: 'stamp', who: 'dora', tx: 1062, ty: Y.bank, act: 'act', icon: 'flag', ghost: 'd_stamp2' },
    { id: 'pass', who: 'enzo', tx: 1300, ty: Y.hawk, act: 'move', icon: 'bug_ball' },
    { id: 'heave', who: 'enzo', tx: 1441, ty: Y.hawk, act: 'act', icon: 'boulder', ghost: 'e_heave2' },
    { id: 'hawk', who: 'dora', tx: 1441, ty: Y.meadow, act: 'down', icon: 'd_duck', ghost: 'd_duck' },
    { id: 'door', who: 'both', tx: 1470, ty: Y.hawk, act: 'move', icon: 'door0' },
  ],
  climb: { x: 812, top: Y.bank, bottom: Y.meadow, exitX: X.cliff + 26, exitY: Y.bank, ready: (g) => g.o.sapling!.stage >= 3 },
  hawk: {
    x0: X.bankEnd - 10, x1: WW, homeX: 1120, homeY: Y.bank, groundMax: Y.meadow + 8,
    active: (g) => g.beat >= 6 && g.beat <= 8 && (g.heroes.dora.x > 1120 || g.beat >= 7),
    cover: (_g, D) => D.y > Y.meadow + 8,
    canHide: (g, D) => g.o.caps!.some((c) => c.gone && Math.abs(D.x - c.x) < 40), coverIcon: 'd_duck',
  },
  init(g, o) {
    Object.assign(o, {
      sluice: { x: 452, y: Y.meadow + 3, open: false, t: 0 },
      leaf: { x: 400, y: Y.pit, bob: 0, minX: 110, maxX: 528, exitX: X.pitR + 30, exitY: Y.ledge, driftX: 520, floorY: Y.pit },
      root: { x: 848, y: 488, wet: 0 }, cup: { x: 772, y: Y.ledge },
      sapling: { x: 812, y: Y.meadow + 4, stage: 0, t: 0, growing: false },
      flag: { x: 1062, y: Y.bank + 2, cracks: 0, broken: false, t: 9, wob: 0 }, beam: 0, onFlag: false,
      bug: { x: 1186, y: Y.cham, state: 'block', t: 0, vx: 0 },
      caps: [{ x: 1327, y: 470, gone: false, vy: 0, vx: 0, px: 0, py: 0, lift: false }, { x: 1441, y: 470, gone: false, vy: 0, vx: 0, px: 0, py: 0, lift: false }],
      door: { x: 1494, y: Y.hawk + 2, open: 0 },
    });
    g.world.water.set([40, 485, X.pitR, Y.pit], [478]);
  },
  route(g, h, b) {
    if (h.id === 'dora' && b.tx > X.cliff && h.x < X.cliff && h.y > Y.bank + 40 && g.o.sapling!.stage >= 3) return { tx: 812, ty: Y.meadow, act: 'up', id: 'climb' };
    return null;
  },
  needFor(g) { const D = g.heroes.dora; return Math.abs(D.x - 1470) > 70 || D.y < 500 ? 'dora' : 'enzo'; },
  tryAct(g, h) {
    const o = g.o;
    if (h.id === 'dora') {
      if (!o.sluice!.open && g.near(h, 488, 46) && h.y < Y.meadow + 4 && h.y > Y.meadow - 30) { h.face = -1; h.x = 500; g.startAct(h, 'pull', 1.0); return true; }
      return false;
    }
    if (!o.root!.wet && o.sluice!.open && g.near(h, 800, 44) && Math.abs(h.y - Y.ledge) < 26) { h.face = 1; h.x = 798; g.startAct(h, 'water', 1.1); return true; }
    for (let i = 0; i < 2; i++) {
      const c = o.caps![i];
      if (!c.gone && !c.lift && g.near(h, c.x, 34) && Math.abs(h.y - Y.hawk) < 22) { h.x = c.x; g.startAct(h, 'heave', 1.0); h.act!.cap = i; return true; }
    }
    return false;
  },
  // the flagstone cracks when stamped OR when Dora lands on it from a jump (the natural platformer move)
  stamped(g, h) { if (onFlag(h)) crack(g); },
  landed(g, h) { if (h.id === 'dora' && onFlag(h)) { g.sfx('stamp'); g.shake = 3; crack(g); } },
  actTick(g, h, a) {
    const o = g.o;
    if (a.name === 'pull' && !a.fired && a.t > 0.55) {
      a.fired = true; o.sluice!.open = true; o.sluice!.t = 0; g.sfx('lever'); g.sfx('gush');
      g.world.water.flowing = true; g.world.water.target = Y.ledge + 4; g.advance('sluice'); g.flash = 0.25;
    }
    if (a.name === 'water') {
      if (a.t > 0.25 && a.t < 0.95 && g.rnd() < 0.7) g.fx('drop', h.x + 34, h.y - 46);
      if (!a.fired && a.t > 0.9) { a.fired = true; o.root!.wet = 0.01; g.sfx('pour'); g.advance('water'); const s = o.sapling!; s.stage = 0; s.growing = true; s.t = 0; }
    }
    if (a.name === 'heave') {
      const c = o.caps![a.cap!];
      if (a.t > 0.35) c.lift = true;
      if (!a.fired && a.t > 0.55) { a.fired = true; popCap(g, a.cap!); }
      if (a.t < 0.5) g.fx('crumb', c.x + (g.rnd() - 0.5) * 40, 478, 1);
    }
  },
  rodeOff(g) { if (g.beat === 1) g.advance('ride'); },
  duck(g, h) {
    if (h.id !== 'dora') return;
    for (const c of g.o.caps!) if (c.gone && Math.abs(h.x - c.x) < 34 && h.y >= Y.meadow - 2 && !h.dropping) {
      h.x = c.x; h.y += 6; h.ground = false; h.vy = 120; h.dropping = true; g.sfx('pop');
    }
  },
  update(g, dt) {
    const o = g.o, D = g.heroes.dora, E = g.heroes.enzo, s = o.sapling!, W = g.world;
    if (s.growing) {
      s.t += dt; const st = 1 + Math.min(2, Math.floor(s.t / 0.55));
      if (st !== s.stage) { s.stage = st; g.sfx('grow', st); g.fx('leaves', s.x, Y.meadow - st * 40, 6 + st * 3); g.shake = 2; }
      if (s.t > 1.3) { s.growing = false; g.sfx('click'); }
    }
    if (o.root!.wet) o.root!.wet = Math.min(1, o.root!.wet + dt);
    if (o.flag!.broken) o.beam = Math.min(1, o.beam! + dt * 1.6);
    if (o.sluice!.open) o.sluice!.t += dt;
    o.flag!.t += dt;
    // stepping onto the cracked stone makes it rock and creak, and dust sifts into the dark below: a wordless "stamp me"
    const on = onFlag(D) && D.ground && !o.flag!.broken;
    if (on && !o.onFlag) { o.flag!.wob = 0.5; g.sfx('crack'); g.fx('sift', 1040, Y.bank + 30, 6); }
    o.onFlag = on; o.flag!.wob = Math.max(0, o.flag!.wob - dt);
    if (g.beat === 4 && D.state !== 'climb' && D.y <= Y.bank + 2 && D.x > X.cliff) g.advance('climb');
    bugUpdate(g, dt, E);
    if (g.beat <= 2) {
      let fx = 790; for (let x = 660; x < 768; x += CELL) if (W.cellAt(x, Y.ledge - 34) === 2 || W.cellAt(x, Y.ledge - 70) === 2) { fx = x; break; }
      g.beats[2].tx = Math.max(624, fx - 30); g.plugClear = fx === 790;
    }
    if (g.beat === 2 && (E.x > 744 || (g.plugClear && E.x > 690)) && E.y <= Y.ledge + 8) g.advance('dig');
    if (g.beat === 6 && E.x > X.chamR + 10 && E.y <= Y.hawk + 8) g.advance('pass');
    for (const c of o.caps!) if (c.gone && c.py < 900) {
      c.vy += 1500 * dt; c.px += c.vx * dt; c.py += c.vy * dt;
      if (c.py > Y.meadow - 22 && c.vy > 0) { c.py = Y.meadow - 22; c.vy *= -0.35; c.vx *= 0.6; if (Math.abs(c.vy) < 40) c.vy = 0; }
    }
    if (D.dropping && D.ground && D.y > Y.meadow + 40) D.dropping = false;
    D.hidden = D.y > Y.meadow + 8;
    if (g.beat === 8 && D.y > Y.meadow + 40 && D.ground) g.advance('hawk');
    const nd = (h: Hero) => Math.abs(h.x - 1470) < 70 && h.y > Y.meadow + 100 && h.ground;
    if (g.beat >= 9 && nd(D) && nd(E) && g.mode === 'play' && !g.leaving) { o.door!.open = 1; g.advance('door'); g.leave(); }
    if (g.beat >= 7 && (nd(D) || nd(E))) o.door!.open = Math.max(o.door!.open, Math.min(0.35, o.door!.open + dt));
  },
  stations(g) {
    const bt = g.beat, o = g.o, D = g.heroes.dora, E = g.heroes.enzo;
    let d: number | null = bt <= 0 ? null : bt <= 4 ? 790 : bt <= 6 ? 1060 : bt === 7 ? 1150 : null;
    let e: number | null = bt <= 0 ? o.leaf!.x : bt <= 1 ? null : bt <= 2 ? 660 : bt <= 3 ? 798 : bt <= 5 ? 900 : bt === 6 ? null : bt === 7 ? 1441 : bt === 8 ? 1440 : null;
    if (bt >= 9) { d = D.y > 500 ? 1470 : null; e = 1470; }
    if (d != null && D.y > Y.meadow - 10 && d > X.cliff) d = 790;   // she can't climb by herself
    if (e != null && bt >= 2 && E.x < X.pitR) e = null;
    return { dora: d, enzo: e };
  },
  glints(g, b) {
    const o = g.o;
    const s = ({ sluice: [[476, 330]], dig: [[690, 560]], water: [[848, 610]], climb: [[812, 300]], stamp: [[1062, Y.bank - 10]],
      heave: o.caps!.filter((c) => !c.gone).map((c) => [c.x, 470]), hawk: o.caps!.filter((c) => c.gone).map((c) => [c.x, Y.meadow - 6]),
      ride: [[o.leaf!.x, o.leaf!.y - 20]], door: [[1494, 560]], pass: [[1250, 600]] } as Record<string, [number, number][]>)[b.id] || [];
    if (b.id !== 'climb' && g.route(g.heroes.dora, b).id === 'climb') s.push([812, 300]);
    return s;
  },
  clipHero(_g, h) { return h.hidden && h.id === 'dora' && h.y < Y.meadow + 60 ? Y.meadow + 4 : null; },
};

// ───────────────────────────────────────────── 2 · The Orchard Roots
// new cross-layer verb: BRACE. Enzo holds a root bridge up from below while Dora crosses the ditch, then both pull
// ropes at once on either side of the soil line to lift the two gates
export const Y2 = { meadow: 366, ditch: 470, tun: 650, tunTop: 495 }, X2 = { d0: 500, d1: 603, mid: 552, post: 880, gate: 1000 };
export const bridgeTop = (g: AboveGame) => Y2.ditch - (Y2.ditch - Y2.meadow) * g.o.lift!;
export const holding = (g: AboveGame) => { const E = g.heroes.enzo; return E.state === 'brace' && E.brace!.name === 'hold'; };
const pulling = (h: Hero) => h.state === 'brace' && h.brace!.name === 'pull';
export const ORCHARD: Room = {
  id: 'orchard', name: 'The Orchard Roots', bg: 'bg2',
  spawn: { dora: [90, Y2.meadow], enzo: [90, Y2.tun] },
  geo: { ground: (x) => (x >= X2.d0 && x < X2.d1 ? Y2.ditch : Y2.meadow), caves: [[0, Y2.tunTop, WW, Y2.tun]] },
  beats: [
    { id: 'bridge', who: 'both', tx: X2.mid, ty: Y2.tun, act: 'hold', icon: 'rootlog', ghost: 'e_hold' },
    { id: 'ropes', who: 'both', tx: X2.post - 40, ty: Y2.meadow, act: 'hold', icon: 'pulley', ghost: 'd_rope1' },
    { id: 'exit', who: 'both', tx: 1490, ty: Y2.meadow, act: 'move', icon: 'd_wave' },
  ],
  init(g, o) {
    Object.assign(o, { lift: 0, rope: 0, gatesUp: false, gateT: 0, ditchT: 0 });
    g.world.fillRect(X2.gate - 16, Y2.meadow - 140, X2.gate + 16, Y2.meadow, 1);
    g.world.fillRect(X2.gate - 16, Y2.tunTop, X2.gate + 16, Y2.tun, 1);
  },
  platform(g, h, ny) {
    if (h.id !== 'dora') return false;
    const top = bridgeTop(g);
    return Math.abs(h.x - X2.mid) < 68 && ny >= top && h.y <= top + 4 && h.vy >= 0;
  },
  needFor(g, b) {
    const D = g.heroes.dora, E = g.heroes.enzo;
    if (b.id === 'bridge') return g.o.lift! > 0.85 || holding(g) ? 'dora' : 'enzo';
    if (b.id === 'ropes') return pulling(D) && !pulling(E) ? 'enzo' : 'dora';
    return D.x < E.x ? 'dora' : 'enzo';
  },
  route(_g, h, b) {
    if (b.id === 'bridge') return h.id === 'enzo' ? { tx: X2.mid, ty: Y2.tun, act: 'hold', id: 'bridge' } : { tx: 680, ty: Y2.meadow, act: 'move', id: 'bridge' };
    if (b.id === 'ropes') return { tx: X2.post - 40, ty: h.id === 'dora' ? Y2.meadow : Y2.tun, act: 'hold', id: 'ropes' };
    return { tx: 1490, ty: h.id === 'dora' ? Y2.meadow : Y2.tun, act: 'move', id: 'exit' };
  },
  tryAct(g, h) {
    const floor = h.id === 'dora' ? Y2.meadow : Y2.tun;
    if (h.id === 'enzo' && g.near(h, X2.mid, 46) && Math.abs(h.y - Y2.tun) < 20) { h.face = 1; g.startBrace(h, 'hold', X2.mid - 4); g.sfx('heave'); return true; }
    if (!g.o.gatesUp && g.near(h, X2.post - 40, 46) && Math.abs(h.y - floor) < 20) { h.face = 1; g.startBrace(h, 'pull', X2.post - 40); g.sfx('lever'); return true; }
    return false;
  },
  braceTick(g, h, b) {
    if (b.name === 'hold' && g.rnd() < 0.15) g.fx('crumb', X2.mid + (g.rnd() - 0.5) * 30, Y2.tunTop + 4, 1);
    if (b.name === 'pull' && g.rnd() < 0.08) g.fx('dust', h.x + 30, h.y, 1);
  },
  update(g, dt) {
    const o = g.o, D = g.heroes.dora, E = g.heroes.enzo;
    // the bridge rises while Enzo holds it, and sinks when he lets go
    const want = holding(g) ? 1 : 0, was = o.lift!;
    o.lift! += Math.sign(want - o.lift!) * Math.min(Math.abs(want - o.lift!), (want ? 1.8 : 1.1) * dt);
    if (want && was < 0.98 && o.lift! >= 0.98) { g.sfx('click'); g.shake = 2; }
    // Dora standing in the ditch rides it up; if she sits there with no bridge, she scrambles back out
    const inDitch = D.x > X2.d0 && D.x < X2.d1 && D.state === 'free';
    if (inDitch && D.ground && D.y > bridgeTop(g) - 2) D.y = bridgeTop(g);
    if (inDitch && D.ground && D.y > Y2.meadow + 40 && o.lift! < 0.2) {
      o.ditchT! += dt;
      if (o.ditchT! > 1.2) { o.ditchT = 0; D.state = 'clamber'; D.clT = 0.35; D.clX = X2.d0 - 20; D.clY = Y2.meadow; D.face = -1; g.sfx('jump'); }
    } else o.ditchT = 0;
    if (g.beat === 0 && D.x > X2.d1 + 14 && D.y <= Y2.meadow + 4) g.advance('bridge');
    // the twin ropes: alone, a gate only creaks up a little; together they lift both and wedge them open
    if (!o.gatesUp) {
      const a = pulling(D), b = pulling(E);
      if (a && b) o.rope = Math.min(1, o.rope! + 0.8 * dt);
      else if (a || b) o.rope! += Math.sign(0.25 - o.rope!) * Math.min(Math.abs(0.25 - o.rope!), 0.6 * dt);
      else o.rope = Math.max(0, o.rope! - 0.5 * dt);
      if (o.rope! >= 1) {
        o.gatesUp = true; o.gateT = 0; g.sfx('door'); g.sfx('shine'); g.flash = 0.2; g.shake = 3;
        g.world.clearRect(X2.gate - 16, Y2.meadow - 140, X2.gate + 16, Y2.meadow); g.world.clearRect(X2.gate - 16, Y2.tunTop, X2.gate + 16, Y2.tun);
        for (const h of [D, E]) if (pulling(h)) g.endBrace(h, false);
        if (g.beat <= 1) { g.beat = 1; g.advance('ropes'); }
      }
    } else o.gateT! += dt;
  },
  stations(g) {
    const bt = g.beat, D = g.heroes.dora;
    if (bt === 0) return { dora: D.x < X2.d0 ? X2.d0 - 30 : 700, enzo: X2.mid };
    if (bt === 1) return { dora: X2.post - 40, enzo: X2.post - 40 };
    return { dora: 1490, enzo: 1490 };
  },
  glints(g, b) {
    if (b.id === 'bridge') return g.o.lift! > 0.85 ? [[660, Y2.meadow - 20]] : [[X2.mid, Y2.tunTop + 30], [X2.mid, Y2.ditch - 20]];
    if (b.id === 'ropes') return [[X2.post, Y2.meadow - 100], [X2.post, Y2.tun - 90]];
    return [[1490, Y2.meadow - 40], [1490, Y2.tun - 40]];
  },
};

export { STREAM, DEN, Y3, X3, BUSHES3, Y4, levering, grubberFrame } from './above-rooms2.js';
export const ROOMS: Room[] = [MEADOW, ORCHARD, STREAM, DEN];

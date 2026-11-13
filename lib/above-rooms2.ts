// Above & Below: rooms 3 and 4 of Chapter One (the first two are in lib/above-rooms.ts). Pure: no DOM.
import { WW, CELL } from './above-world.js';
import type { AboveGame, Hero } from './above-game.js';
import type { Room, Grubber } from './above-rooms.js';

// ───────────────────────────────────────────── 3 · The Stream Bank
// a reprise with a twist: the sluice only runs while Dora holds the lever down, so Enzo must cross the basin on the leaf
// while she holds. New verb: STAMP-AND-DIG. Hard clay blocks the tunnel; each stamp above shakes a seam loose for a few
// seconds (the dust falls where to dig) and Enzo must dig it before it sets. The hawk is back; bushes hide Dora.
export const Y3 = { meadow: 365, tun: 612, tunTop: 490, basin: 792 }, X3 = { b0: 465, b1: 705, clay0: 895, clay1: 1052, lever: 520 };
export const BUSHES3 = [800, 975, 1150];
export const levering = (g: AboveGame) => { const D = g.heroes.dora; return D.state === 'brace' && D.brace!.name === 'lever'; };
const nearestBush = (x: number) => BUSHES3.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
/** the front of the clay still in Enzo's way */
function faceX(g: AboveGame) {
  for (let x = X3.clay0; x < X3.clay1; x += CELL) for (let y = 516; y < Y3.tun - 4; y += CELL) if (g.world.cellAt(x, y)) return x;
  return X3.clay1 + 20;
}
const cleared = (g: AboveGame) => faceX(g) > X3.clay1;
function loose(g: AboveGame) { const f = faceX(g); return g.world.count(f - 8, f + 40, 516, Y3.tun, 2) > 0; }
export const STREAM: Room = {
  id: 'stream', name: 'The Stream Bank', bg: 'bg3',
  spawn: { dora: [600, Y3.meadow], enzo: [120, Y3.tun] },
  geo: {
    ground: () => Y3.meadow,
    caves: [[0, Y3.tunTop, WW, Y3.tun], [X3.b0, Y3.tunTop, X3.b1, Y3.basin]],
    solid: (x, y) => x >= X3.clay0 && x < X3.clay1 && y >= Y3.tunTop - 8 && y < 512,
    hidden: (x, y) => x >= X3.clay0 && x < X3.clay1 && y >= 512 && y < Y3.tun,
  },
  beats: [
    { id: 'lever', who: 'both', tx: X3.lever, ty: Y3.meadow, act: 'hold', icon: 'sluice1', ghost: 'd_lever' },
    { id: 'clay', who: 'both', tx: 960, ty: Y3.meadow, act: 'act', icon: 'd_stamp2', ghost: 'd_stamp2' },
    { id: 'exit', who: 'both', tx: 1490, ty: Y3.meadow, act: 'move', icon: 'd_wave' },
  ],
  hawk: {
    x0: 600, x1: WW, homeX: 560, homeY: Y3.meadow, groundMax: Y3.meadow + 8,
    active: (g) => g.beat >= 1,
    cover: (_g, D) => D.ducking && BUSHES3.some((b) => Math.abs(D.x - b) < 46),
    canHide: (_g, D) => BUSHES3.some((b) => Math.abs(D.x - b) < 46), coverIcon: 'bush',
    gap: (g) => (g.beat === 1 ? 5 : 0), coverAt: (_g, D) => [nearestBush(D.x), Y3.meadow - 50],
  },
  init(g, o) {
    Object.assign(o, {
      sluice: { x: 470, y: Y3.meadow + 3, open: false, t: 0 },
      leaf: { x: 560, y: Y3.basin, bob: 0, minX: X3.b0 + 60, maxX: X3.b1 - 60, exitX: X3.b1 + 30, exitLX: X3.b0 - 28, exitY: Y3.tun, driftX: X3.b1 - 60, floorY: Y3.basin },
      fall: 0, dust: [], basinT: 0,
    });
    const W = g.world.water; W.set([X3.b0, Y3.tunTop, X3.b1, Y3.basin], [474]); W.rate = 80; W.drain = 22;
  },
  faceX, loose,
  needFor(g, b) {
    const E = g.heroes.enzo;
    if (b.id === 'lever') return g.world.water.level < Y3.tun + 30 || E.state === 'ride' ? 'enzo' : 'dora';
    if (b.id === 'clay') return cleared(g) || loose(g) ? 'enzo' : 'dora';
    return g.heroes.dora.x < E.x ? 'dora' : 'enzo';
  },
  route(g, h, b) {
    if (b.id === 'lever') return h.id === 'dora' ? { tx: X3.lever, ty: Y3.meadow, act: 'hold', id: 'lever' } : { tx: X3.b1 + 40, ty: Y3.tun, act: 'move', id: 'ride' };
    if (b.id === 'clay' && cleared(g)) return { tx: X3.clay1 + 70, ty: h.id === 'dora' ? Y3.meadow : Y3.tun, act: 'move', id: 'through' };
    if (b.id === 'clay') { const f = faceX(g); return h.id === 'dora' ? { tx: Math.min(X3.clay1 - 12, f + 14), ty: Y3.meadow, act: 'act', id: 'clay' } : { tx: f - 30, ty: Y3.tun, act: 'act', id: 'dig' }; }
    return { tx: 1490, ty: h.id === 'dora' ? Y3.meadow : Y3.tun, act: 'move', id: 'exit' };
  },
  tryAct(g, h) {
    if (h.id === 'dora' && g.near(h, X3.lever, 44) && Math.abs(h.y - Y3.meadow) < 20 && g.beat === 0) { h.face = -1; g.startBrace(h, 'lever', X3.lever); g.sfx('lever'); return true; }
    return false;
  },
  // a stamp over the clay shakes a seam loose right below her feet; dust sifts down to show where
  stamped(g, h) {
    if (h.y > Y3.meadow + 6 || h.x < X3.clay0 - 40 || h.x > X3.clay1 + 40) return;
    const n = g.world.reveal(h.x - 64, h.x + 64, g.assist ? 7 : 4.5);
    for (let i = 0; i < 14; i++) g.o.dust!.push({ x: h.x + (g.rnd() - 0.5) * 60, y: Y3.tunTop + g.rnd() * 10, vy: 30 + g.rnd() * 60, t: 0 });
    if (n) { g.sfx('crack'); g.stats.reveals++; }
  },
  dugNothing(g, h) {
    if (g.beat === 1 && g.world.cellAt(h.x + h.face * 30, h.y - 40) === 3) { g.sfx('ui'); g.fx('stars', h.x + h.face * 30, h.y - 50); g.startAct(h, 'dust', 0.4); }
  },
  update(g, dt) {
    const o = g.o, D = g.heroes.dora, E = g.heroes.enzo, W = g.world, Wt = W.water;
    // Enzo stranded in the drained basin scrambles out after a moment (onwards once the lever beat is done, else back)
    if (E.state === 'free' && E.ground && E.x > X3.b0 && E.x < X3.b1 && E.y > Y3.tun + 60 && Wt.level > E.y - 20) {
      o.basinT! += dt;
      if (o.basinT! > 1.4) {
        o.basinT = 0; const fwd = g.beat >= 1 || E.x > (X3.b0 + X3.b1) / 2;
        E.state = 'clamber'; E.clT = 0.45; E.clX = fwd ? X3.b1 + 24 : X3.b0 - 24; E.clY = Y3.tun; E.face = fwd ? 1 : -1; g.sfx('jump');
      }
    } else o.basinT = 0;
    const lev = levering(g);
    Wt.flowing = lev; Wt.target = lev ? Y3.tun + 2 : Y3.basin + 4;
    o.fall = Math.max(0, Math.min(1, o.fall! + (lev ? 3 : -2) * dt));
    if (g.beat === 0 && E.x > X3.b1 + 12 && E.y <= Y3.tun + 4 && E.state !== 'ride') g.advance('lever');
    if (g.beat >= 1 && lev) g.endBrace(D, false);
    if (g.beat === 1 && g.rnd() < 0.1) {   // crumbs of clay too small to matter just crumble away
      const left = W.count(X3.clay0, X3.clay1 + 4, 516, Y3.tun, 3) + W.count(X3.clay0, X3.clay1 + 4, 516, Y3.tun, 2);
      if (left > 0 && left <= 6) {
        for (let y = 516; y < Y3.tun; y += CELL) for (let x = X3.clay0; x < X3.clay1 + 4; x += CELL) if (W.cellAt(x, y) >= 2) { W.fillRect(x, y, x + 1, y + 1, 0); g.fx('crumb', x, y, 2); }
      }
    }
    if (g.beat === 1 && (E.x > X3.clay1 + 6 || (cleared(g) && E.x > X3.clay1 - 30)) && E.y <= Y3.tun + 4) g.advance('clay');
    for (const p of o.dust!) { p.t += dt; p.y += p.vy * dt; }
    o.dust = o.dust!.filter((p) => p.t < 1.6 && p.y < Y3.tun);
    D.inBush = D.ducking && BUSHES3.some((b) => Math.abs(D.x - b) < 46);
  },
  stations(g) {
    const bt = g.beat, f = faceX(g);
    if (bt === 0) return { dora: X3.lever, enzo: g.world.water.level < Y3.tun + 30 ? X3.b0 - 24 : X3.b0 - 30 };
    if (bt === 1) return cleared(g) ? { dora: X3.clay1 + 70, enzo: X3.clay1 + 70 } : { dora: Math.min(X3.clay1 - 12, f + 14), enzo: f - 30 };
    return { dora: 1490, enzo: 1490 };
  },
  helpers(g) {   // assist: the hero nobody steers runs for a bush when the hawk calls
    const D = g.heroes.dora, k = g.o.hawk;
    if (!(g.assist && !g.twoP && g.active !== 'dora')) return;
    if (k.on && (k.phase === 'warn' || k.phase === 'pass')) D.auto = nearestBush(D.x);
  },
  glints(g, b) {
    if (b.id === 'lever') return g.world.water.level < Y3.tun + 30 ? [[X3.b1 + 40, Y3.tun - 40], [g.o.leaf!.x, g.o.leaf!.y - 20]] : [[X3.lever - 30, Y3.meadow - 50]];
    if (b.id === 'clay') { const f = faceX(g); if (f > X3.clay1) return [[X3.clay1 + 60, Y3.tun - 40]]; return loose(g) ? [[f + 10, 560]] : [[f + 20, Y3.meadow - 10]]; }
    return [[1490, Y3.meadow - 40], [1490, Y3.tun - 40]];
  },
};

// ───────────────────────────────────────────── 4 · Old Grubber's Den
// a cross-layer set piece: below, Grubber swipes high (Enzo ducks) or sends a dirt wave along the floor (Enzo jumps);
// then he tunnels up and the meadow heaves under Dora (ground rings, a longer first tell, the hero's face over the
// danger). When his nose pokes out, Dora stamps it; he tumbles down dizzy, and Enzo boops him. Three boops and the
// grumpy old mole yawns and falls asleep.
export const Y4 = { meadow: 372, den: 692, denTop: 455 };
const tell = (g: AboveGame, first: boolean, base: number) => (first ? base * 1.6 : base) + (g.assist ? 0.3 : 0);
const setSt = (b: Grubber, st: string) => { b.st = st; b.t = 0; };
function hitNose(g: AboveGame, h: Hero) {
  const b = g.o.gb!;
  if (b.st === 'nose' && Math.abs(h.x - b.nx) < 56 && h.y <= Y4.meadow + 4) {
    g.sfx('pop'); g.sfx('crack'); g.shake = 6; g.fx('stars', b.nx, Y4.meadow - 30); b.x = b.nx; setSt(b, 'fall'); g.stats.noseStamps++;
  }
}
function boop(g: AboveGame) {
  const b = g.o.gb!; if (b.st !== 'dizzy') return;
  b.hp--; g.sfx('heave'); g.sfx('shine'); g.flash = 0.2; g.shake = 5; g.fx('stars', b.x, Y4.den - 200);
  setSt(b, b.hp <= 0 ? 'yawn' : 'bonk');
}
/** Old Grubber's painted frame for his state */
export function grubberFrame(b: Grubber) {
  const s = b.st;
  if (s === 'wind' || s === 'dive') return s === 'dive' && b.t > 0.4 ? 'g_up' : 'g_wind';
  if (s === 'swipe') return 'g_swipe';
  if (s === 'windlow') return Math.floor(b.t * 8) % 2 ? 'g_dig' : 'g_idle';
  if (s === 'dig') return 'g_dig';
  if (s === 'intro' || s === 'recover') return b.t < 0.8 && s === 'recover' ? 'g_bonk' : 'g_roar';
  if (s === 'dizzy' || s === 'fall') return 'g_dizzy';
  if (s === 'bonk') return 'g_bonk';
  if (s === 'yawn') return 'g_yawn';
  if (s === 'sleep') return 'g_sleep';
  return 'g_idle';
}
export const DEN: Room = {
  id: 'den', name: "Old Grubber's Den", bg: 'bg4', dodgy: true,
  spawn: { dora: [220, Y4.meadow], enzo: [220, Y4.den] },
  geo: { ground: () => Y4.meadow, caves: [[60, Y4.denTop, 1480, Y4.den]] },
  beats: [{ id: 'grubber', who: 'both', tx: 700, ty: Y4.den, act: 'move', icon: 'g_face', noGhost: true }],
  init(_g, o) {
    o.gb = { x: 1150, dir: -1, st: 'intro', t: 0, hp: 3, atk: 0, nx: 0, firstWind: true, firstRing: true, tell: 1 };
    o.wave = null; o.clods = []; o.bar = 0;
  },
  icon(g) { const s = g.o.gb!.st; return s === 'nose' ? 'g_nose' : s === 'dizzy' ? 'g_dizzy' : s === 'rings' ? 'mound' : 'g_face'; },
  focusPts(g) {
    const b = g.o.gb!;
    if (['rings', 'erupt', 'nose'].includes(b.st)) return [[b.nx, Y4.meadow - 60]];
    return [[b.x - 170, Y4.den - 40], [b.x + 170, Y4.den - 40]];
  },
  needFor(g) { const s = g.o.gb!.st; return s === 'nose' || s === 'rings' || s === 'erupt' ? 'dora' : 'enzo'; },
  route(g, h) {
    const b = g.o.gb!;
    if (b.st === 'nose') return h.id === 'dora' ? { tx: b.nx, ty: Y4.meadow, act: 'act', id: 'nose' } : { tx: b.nx - 130, ty: Y4.den, act: 'move', id: 'wait' };
    if (b.st === 'dizzy') return h.id === 'enzo' ? { tx: b.x + (h.x < b.x ? -170 : 170), ty: Y4.den, act: 'act', id: 'boop' } : { tx: b.x, ty: Y4.meadow, act: 'move', id: 'wait' };
    if (b.st === 'rings') return { tx: b.nx + (h.x < b.nx ? -230 : 230), ty: h.id === 'dora' ? Y4.meadow : Y4.den, act: 'move', id: 'away' };
    return { tx: h.x, ty: h.y, act: 'move', id: 'dodge' };
  },
  tryAct(g, h) {
    const b = g.o.gb!;
    if (h.id === 'enzo' && b.st === 'dizzy' && Math.abs(h.x - b.x) < 200 && Math.abs(h.y - Y4.den) < 20) {
      h.face = b.x > h.x ? 1 : -1; g.startAct(h, 'heave', 0.6); h.act!.boop = true; return true;
    }
    return false;
  },
  actTick(g, _h, a) { if (a.boop && !a.fired && a.t > 0.3) { a.fired = true; boop(g); } },
  stamped(g, h) { hitNose(g, h); },
  landed(g, h) { if (h.id === 'dora') hitNose(g, h); },
  update(g, dt) {
    const o = g.o, b = o.gb!, D = g.heroes.dora, E = g.heroes.enzo; b.t += dt;
    o.bar = Math.min(1, o.bar! + ((b.st === 'intro' && b.t < 1) ? 0 : 1) * dt * 2);
    const face = () => { b.dir = E.x < b.x ? -1 : 1; };
    switch (b.st) {
      case 'intro': if (b.t > 0.4 && b.t - dt <= 0.4) { g.sfx('hawk'); g.shake = 8; } if (b.t > 2.4) setSt(b, 'prowl'); break;
      case 'prowl': {
        face(); const gap = Math.abs(E.x - b.x);
        if (gap > 260) b.x += b.dir * 70 * dt;
        b.x = Math.max(260, Math.min(1300, b.x));
        if (b.t > 1.1) {
          if (b.atk >= 2) { b.atk = 0; setSt(b, 'dive'); }
          else { setSt(b, b.atk % 2 === 0 ? 'wind' : 'windlow'); b.tell = tell(g, b.firstWind, 1.0); b.firstWind = false; }
        }
        break;
      }
      case 'wind': if (b.t > b.tell) { setSt(b, 'swipe'); g.sfx('hiss'); } break;
      case 'swipe': {
        const x0 = b.x + b.dir * 120, x1 = b.x + b.dir * 330;
        if (b.t > 0.12 && b.t < 0.36 && E.state !== 'hurt' && Math.abs(E.y - Y4.den) < 30 && (E.x - Math.min(x0, x1)) * (E.x - Math.max(x0, x1)) < 0 && !E.ducking) g.bump(E, b.dir);
        if (b.t > 0.55) { b.atk++; setSt(b, 'prowl'); }
        break;
      }
      case 'windlow': if (b.t > b.tell) { setSt(b, 'dig'); o.wave = { x: b.x + b.dir * 150, dir: b.dir, t: 0 }; g.sfx('crumble'); } break;
      case 'dig': if (b.t > 0.7) { b.atk++; setSt(b, 'prowl'); } break;
      case 'dive':   // he rears, roars, and tunnels up toward Dora
        if (b.t > 0.7) {
          setSt(b, 'rings'); b.nx = Math.max(160, Math.min(1380, D.x)); b.tell = tell(g, b.firstRing, 1.3); b.firstRing = false;
          for (let i = 0; i < 3; i++) o.clods!.push({ x: Math.max(120, Math.min(1420, E.x + (i - 1) * 170 + (g.rnd() - 0.5) * 60)), t: -i * 0.35, y: Y4.denTop + 6, hit: false, done: false });
        }
        break;
      case 'rings':
        if (b.t > b.tell) {
          setSt(b, 'erupt'); g.sfx('heave'); g.sfx('pop'); g.shake = 9; g.fx('crumb', b.nx, Y4.meadow, 20); g.fx('leaves', b.nx, Y4.meadow - 20, 10);
          if (Math.abs(D.x - b.nx) < 80 && D.y <= Y4.meadow + 4) g.bump(D, D.x < b.nx ? -1 : 1);
        }
        break;
      case 'erupt': if (b.t > 0.9) setSt(b, 'nose'); break;
      case 'nose': if (b.t > (g.assist ? 5.5 : 4)) { setSt(b, 'retreat'); g.sfx('hiss'); } break;
      case 'retreat': if (b.t > 0.6) { b.x = b.nx; setSt(b, 'prowl'); } break;
      case 'fall': if (b.t > 0.5) { setSt(b, 'dizzy'); g.sfx('call', 0); } break;
      case 'dizzy': if (b.t > (g.assist ? 6.5 : 4.5)) setSt(b, 'recover'); break;
      case 'bonk': if (b.t > 0.9) setSt(b, 'recover'); break;
      case 'recover': if (b.t > 1.0) setSt(b, 'prowl'); break;
      case 'yawn': if (b.t > 1.6) { setSt(b, 'sleep'); g.sfx('win'); } break;
      case 'sleep': if (b.t > 2.2 && g.mode === 'play') { g.advance('grubber'); g.stats.rooms.push(['den', +(g.t - g.startT).toFixed(1)]); g.win(); } break;
    }
    // his body shoves Enzo away (gently) unless he is dizzy or asleep
    if (['prowl', 'wind', 'windlow', 'dig', 'recover', 'intro'].includes(b.st) && Math.abs(E.x - b.x) < 120 && Math.abs(E.y - Y4.den) < 30) g.bump(E, E.x < b.x ? -1 : 1);
    // the dirt wave along the den floor: jump it
    if (o.wave) {
      const w = o.wave; w.t += dt; w.x += w.dir * 430 * dt;
      if (g.rnd() < 0.6) g.fx('crumb', w.x, Y4.den - 4, 2);
      if (Math.abs(E.x - w.x) < 30 && E.y > Y4.den - 24) g.bump(E, w.dir);
      if (w.x < 70 || w.x > 1470 || w.t > 4) o.wave = null;
    }
    // clods shaken loose from the den roof while he tunnels: a ring on the floor marks each one
    for (const c of o.clods!) {
      c.t += dt;
      if (c.t > 0.9) {
        c.y += 900 * dt * Math.min(1, (c.t - 0.9) * 3);
        if (!c.hit && Math.abs(E.x - c.x) < 34 && c.y > E.y - 90 && c.y < E.y) { c.hit = true; g.bump(E, E.x < c.x ? -1 : 1); }
        if (c.y >= Y4.den - 10 && !c.done) { c.done = true; g.fx('crumb', c.x, Y4.den - 6, 8); g.sfx('land'); }
      }
    }
    o.clods = o.clods!.filter((c) => c.t < 2.2);
    // assist: the hero nobody steers dodges by themselves
    E.autoDuck = false; E.autoJump = false;
    if (!g.twoP && g.assist && g.active !== 'enzo') {
      if (b.st === 'wind' && Math.abs(E.x - b.x) < 360 && b.t > b.tell - 0.35) E.autoDuck = true;
      if (b.st === 'swipe') E.autoDuck = true;
      if (o.wave && Math.abs(E.x - o.wave.x) < 110 && Math.sign(E.x - o.wave.x) === o.wave.dir) E.autoJump = true;
    }
  },
  stations(g) {
    const b = g.o.gb!, D = g.heroes.dora, E = g.heroes.enzo, away = (h: Hero, x: number) => x + (h.x < x ? -230 : 230);
    let d: number | null = null, e: number | null = null;
    if (b.st === 'rings' || b.st === 'erupt') d = Math.max(140, Math.min(1400, away(D, b.nx)));
    if (b.st === 'nose') d = b.nx;
    if (b.st === 'dizzy' || b.st === 'fall') e = b.x + (E.x < b.x ? -170 : 170);
    if (b.st === 'nose') e = b.nx + (E.x < b.nx ? -190 : 190);
    for (const c of g.o.clods!) if (c.t < 0.9 && Math.abs(E.x - c.x) < 50) e = c.x + (E.x < c.x ? -90 : 90);
    return { dora: d, enzo: e };
  },
  glints(g) {
    const b = g.o.gb!;
    if (b.st === 'nose') return [[b.nx, Y4.meadow - 30]];
    if (b.st === 'dizzy') return [[b.x, Y4.den - 230]];
    return [];
  },
};

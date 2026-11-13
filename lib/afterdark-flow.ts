// The Arcade After Dark: the chapter's next goal, interactions, transitions (the dive into a cabinet, popping out, the
// quick hop, the fade through a door) and the cutscenes. Ported from the prototype's flow.js.
import { SCREEN, fsize, type Cab, type Portal, type World, type WorldId } from './afterdark-worlds.js';
import { type Game, W0, lead, partner, sfx, ev, spark, rnd, rr, clamp, lerp, TAU, placeHeroes, entryOf, heroMid, wakeHub } from './afterdark-core.js';
import { doPing, doSweep, doGust, swapHeroes } from './afterdark-move.js';
import { startBoss } from './afterdark-boss.js';

export type Goal = 'castle' | 'sea' | 'cloud' | 'hubsweep' | 'boss' | null;
/** the one thing that matters next; the hub, the hints and the hop portals all read this */
export function goal(g: Game): Goal {
  const f = g.flags, a = g.abil;
  if (!a.ping) return f.castleBlocked ? 'sea' : 'castle';
  if (!a.sweep) return 'castle';
  if (!f.hubSwept) return 'hubsweep';
  if (!a.gust) return 'cloud';
  if (!f.anchor) return 'sea';
  if (!f.boss) return 'boss';
  return null;
}
export function hubSuggestion(g: Game): Cab | null {
  const k = goal(g);
  return g.W.hub.cabs!.find((c) => c.id === k) ?? null;
}
/** a world's exit can hop straight into the next cabinet once this one has nothing left that matters */
export function hopTarget(g: Game, w: World, p: Portal): string | null {
  const k = goal(g);
  if (p.hop) return p.hop;
  if (k !== 'castle' && k !== 'sea' && k !== 'cloud') return null;
  const cab = p.cab || w.id;
  if (k === cab) return null;
  return k;
}
export function portalOpen(g: Game, w: World, p: Portal) {
  if (!p.open) return false;
  if (w.id === 'room' && p.id === 'out') return g.flags.roomClear;
  if (p.crystals) return w.crystals.every((c) => c.lit > 0);
  return true;
}

export interface Near { kind: 'cab' | 'portal' | 'conch' | 'mound' | 'wall' | 'pedestal' | 'shrine'; obj: unknown; x: number; y: number; d?: number }
/** what is the lead hero near? (shared by E, the Act button and the hints) */
export function nearThing(g: Game): Near | null {
  const w = W0(g), h = lead(g);
  if (w.id === 'hub') {
    if (g.boss) return null;
    let best: Near | null = null;
    for (const c of w.cabs!) { const d = Math.abs(h.x - c.x); if (d < 95 && (!best || d < best.d!)) best = { kind: 'cab', obj: c, d, x: c.x, y: c.y - c.h * 0.62 }; }
    return best;
  }
  for (const p of w.portals) {
    if (!portalOpen(g, w, p)) continue;
    const py = w.kind === 'swim' || w.floor > 5000 ? p.y : w.floor - 90;
    if (Math.abs(h.x - p.x) < 95 && Math.abs(heroMid(g, h) - (w.kind === 'land' && w.floor < 5000 ? heroMid(g, h) : py)) < 140) return { kind: 'portal', obj: p, x: p.x, y: py - 110 };
  }
  if (w.id === 'sea' && !w.conch!.used && Math.abs(h.x - w.conch!.x) < 150 && h.y > 380) return { kind: 'conch', obj: w.conch, x: w.conch!.x, y: w.conch!.y - 190 };
  if (w.id === 'sea' && Math.abs(h.x - w.mound!.x) < 150 && h.y > 330) return { kind: 'mound', obj: w.mound, x: w.mound!.x, y: w.mound!.y - 220 };
  if (w.id === 'castle' && h.x > w.wall!.x - 140) return { kind: 'wall', obj: w.wall, x: w.wall!.x + 120, y: w.floor - 330 };
  if (w.id === 'room' && !w.pedestal!.taken && Math.abs(h.x - w.pedestal!.x) < 120) return { kind: 'pedestal', obj: w.pedestal, x: w.pedestal!.x, y: w.pedestal!.y - 230 };
  if (w.id === 'cloud' && !w.shrine!.taken && Math.abs(h.x - w.shrine!.x) < 120 && Math.abs(h.y - w.shrine!.y) < 60) return { kind: 'shrine', obj: w.shrine, x: w.shrine!.x, y: w.shrine!.y - 260 };
  return null;
}

export function interact(g: Game) {
  const n = nearThing(g), h = lead(g), w = W0(g);
  if (!n) { h.reachT = 0.3; return; }
  if (n.kind === 'cab') {
    const c = n.obj as Cab;
    if (c.id === 'castle' && g.flags.castleBlocked && !g.abil.ping) { c.wob = 0.5; c.bubble = 3; sfx(g, 'knock'); h.reachT = 0.3; ev(g, 'castle refuses'); }
    else if (c.live && c.target) startDive(g, c);
    else { c.wob = 0.5; c.bubble = 2; sfx(g, 'nope'); h.reachT = 0.3; }
  } else if (n.kind === 'portal') takePortal(g, n.obj as Portal);
  else if (n.kind === 'conch') {
    g.cut = { kind: 'ping', t: 0, dur: 3 }; w.conch!.used = true;
    if (g.lead !== 'enzo') swapHeroes(g);
  } else if (n.kind === 'mound') {
    if (w.mound!.open) startFade(g, 'deep', (d) => d.spawn, 1);
    else { h.reachT = 0.4; w.mound!.bubble = 3; sfx(g, 'knock'); }
  } else if (n.kind === 'wall') {
    if (w.wall!.open) { startFade(g, 'room', (r) => r.spawn, 1); return; }
    h.reachT = 0.45; w.wall!.knock = 0.4; w.wall!.bubble = 3.5; g.stats.knocks++; sfx(g, 'knock'); ev(g, 'knock');
    if (!g.abil.ping) g.flags.castleBlocked = true;
  } else if (n.kind === 'pedestal') {
    g.cut = { kind: 'sweep', t: 0, dur: 2.7 };
    if (g.lead !== 'dora') swapHeroes(g);
  } else if (n.kind === 'shrine') g.cut = { kind: 'gust', t: 0, dur: 3 };
}
export function takePortal(g: Game, p: Portal) {
  const w = W0(g);
  if (p.door) { if (w.id === 'room') startFade(g, 'castle', () => g.W.castle.wall!.x - 60, -1); else startFade(g, 'sea', () => g.W.sea.mound!.x - 150, -1); return; }
  startExit(g, p.cab || w.id, hopTarget(g, w, p));
}

// ───────────── transitions
export function cabScreen(c: Cab) {
  const [cw, ch] = fsize(c.n), x0 = c.x - cw / 2, y0 = c.y - ch;
  return { x: x0 + cw * SCREEN.x0, y: y0 + ch * SCREEN.y0, w: cw * (SCREEN.x1 - SCREEN.x0), h: ch * (SCREEN.y1 - SCREEN.y0) };
}
export function startDive(g: Game, c: Cab) {
  const to = c.target!;
  g.trans = { kind: 'dive', t: 0, dur: g.hop ? 1.3 : 1.7, cab: c, to, snapWorld: to, snapAtSpawn: true,
    from: [lead(g), partner(g)].map((h) => ({ h, x: h.x, y: h.y })) };
  for (const h of [lead(g), partner(g)]) { h.diveT = 9; h.vx = h.vy = 0; }
  sfx(g, 'enter'); ev(g, 'enter ' + to);
  if (to === 'castle' && g.stats.castleFirst === null) g.stats.castleFirst = !g.abil.ping;
  if (to === 'sea' && g.stats.castleFirst === null) g.stats.castleFirst = false;
}
function startExit(g: Game, cabId: string, hop: string | null) {
  const from = g.world;
  g.world = 'hub'; g.stats.visits.hub++;
  const c = g.W.hub.cabs!.find((k) => k.id === cabId)!;
  placeHeroes(g, 'hub', c.x, g.W.hub.floor, 1);
  for (const h of [lead(g), partner(g)]) h.hidden = true;
  g.trans = { kind: 'exit', t: 0, dur: hop ? 1.1 : 1.5, cab: c, snapWorld: from, snapAtSpawn: false, hop };
  sfx(g, 'exit'); g.tune = g.flags.healed ? 'healed' : 'hub'; ev(g, 'exit to hub' + (hop ? ' hop ' + hop : ''));
}
export function startFade(g: Game, to: WorldId, xf: (w: World) => number, face: number) { g.trans = { kind: 'fade', t: 0, dur: 0.9, to, xf, face, done: false }; sfx(g, 'enter'); }
function arrive(g: Game, to: WorldId) {
  g.world = to; g.stats.visits[to]++;
  const w = g.W[to], e = entryOf(g, to);
  g.hop = null; g.ckpt = null;
  placeHeroes(g, to, e.x, e.y, 1);
  for (const h of [lead(g), partner(g)]) {
    if (w.kind === 'swim') { h.rollT = 0.55; h.vx = 240; }
    else { h.vy = -520; h.ground = false; h.vx = 0; }
  }
  partner(g).x = e.x - 80;
  spark(g, to, e.x - 90, w.kind === 'swim' ? e.y : e.y - 150, 26, '#fff6d0', 260, 0.8, 5);
  g.tune = w.tune; g.flash = 0.55;
}
export function updTrans(g: Game, dt: number) {
  const T = g.trans!; T.t += dt;
  const p = T.t / T.dur;
  if (T.kind === 'dive') {
    const s = cabScreen(T.cab!), cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    for (const f of T.from!) {
      const q = clamp(T.t / 0.75, 0, 1), e = 1 - Math.pow(1 - q, 3);
      f.h.x = lerp(f.x, cx + (f.h === lead(g) ? 10 : -10), e);
      f.h.y = lerp(f.y, cy + 60, e) - Math.sin(q * Math.PI) * 120;
      f.h.sc = lerp(1, 0.22, e); f.h.alpha = q < 0.8 ? 1 : 1 - (q - 0.8) / 0.2;
      if (q >= 1) f.h.hidden = true;
    }
    if (T.t >= T.dur) { g.trans = null; arrive(g, T.to!); }
  } else if (T.kind === 'exit') {
    const c = T.cab!, s = cabScreen(c), cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const heroes = [lead(g), partner(g)];
    if (T.hop) {   // the quick hop: pop out and straight into the next cabinet, no walking
      heroes.forEach((h) => (h.hidden = true));
      if (T.t >= T.dur) {
        g.trans = null; g.hop = T.hop;
        const nc = g.W.hub.cabs!.find((k) => k.id === T.hop)!;
        placeHeroes(g, 'hub', nc.x, g.W.hub.floor, 1); heroes.forEach((h) => (h.hidden = true));
        startDive(g, nc);
      }
      return;
    }
    heroes.forEach((h, i) => {
      const q = clamp((T.t - 0.75 - i * 0.1) / 0.6, 0, 1);
      if (q <= 0) { h.hidden = true; return; }
      h.hidden = false; const e = 1 - Math.pow(1 - q, 3);
      const sg = hubSuggestion(g), dir = sg && sg.x < c.x - 10 ? -1 : 1;
      const tx = clamp(c.x + (i === 0 ? 50 : -40) * dir, 60, 1220);
      h.x = lerp(cx, tx, e); h.y = lerp(cy, g.W.hub.floor, q * q) - Math.sin(q * Math.PI) * 140;
      h.sc = lerp(0.25, 1, e); h.alpha = 1; h.rollT = q < 1 ? 0.1 : 0; h.face = dir;
    });
    if (T.t >= T.dur) { g.trans = null; for (const h of heroes) { h.y = g.W.hub.floor; h.sc = 1; h.hidden = false; h.landT = 0.12; h.rollT = 0; h.ground = true; } g.safe = { x: lead(g).x, y: lead(g).y }; }
  } else {
    if (p >= 0.5 && !T.done) {
      T.done = true; g.world = T.to!; g.stats.visits[T.to!]++;
      const w = g.W[T.to!]; placeHeroes(g, T.to!, T.xf!(w), w.kind === 'swim' ? (w.spawnY || 360) : w.floor, T.face!); g.tune = w.tune; ev(g, 'door to ' + T.to);
    }
    if (T.t >= T.dur) g.trans = null;
  }
}

// ───────────── cutscenes: the three gifts, the hub waking, the anchor's fall, the giant gathering, the healing
export function updCut(g: Game, dt: number) {
  const C = g.cut!; C.t += dt;
  const w = W0(g), h = lead(g);
  const walkTo = (tx: number, ty?: number) => { h.x = lerp(h.x, tx, 1 - Math.exp(-6 * dt)); if (ty !== undefined) h.y = lerp(h.y, ty, 1 - Math.exp(-6 * dt)); h.reachT = 0.1; };
  if (C.kind === 'ping') {
    const cn = w.conch!;
    if (C.t < 0.6) { walkTo(cn.x - 70, cn.y - 150); h.face = 1; }
    if (C.t > 0.6 && !C.got) { C.got = true; sfx(g, 'gain'); g.abil.ping = true; g.flags.conch = true; g.stats.tPing = g.playT; ev(g, 'PING'); h.winT = 1.1; g.flash = 0.35; spark(g, 'sea', cn.x, cn.y - 90, 40, '#8ff7f0', 280, 1, 5); g.hintIdle = 2.5; }
    if (C.t > 1.9 && !C.pinged) { C.pinged = true; doPing(g); }
  } else if (C.kind === 'sweep') {
    const p = w.pedestal!;
    if (C.t < 0.6) { walkTo(p.x - 85); h.face = 1; }
    if (C.t > 0.6 && !C.got) { C.got = true; p.taken = true; sfx(g, 'gain'); g.abil.sweep = true; g.flags.crest = true; ev(g, 'SWEEP'); h.winT = 1.3; g.flash = 0.4; spark(g, 'room', p.x, p.y - 160, 40, '#ffd77a', 280, 1, 5); g.hintIdle = 2.5; }
    if (C.t > 2 && !C.swept) { C.swept = true; h.face = 1; doSweep(g); }
  } else if (C.kind === 'gust') {
    const s = w.shrine!;
    if (C.t < 0.6) { walkTo(s.x - 80); h.face = 1; }
    if (C.t > 0.6 && !C.got) { C.got = true; s.taken = true; sfx(g, 'gain'); g.abil.gust = true; g.stats.tGust = g.playT; ev(g, 'GUST'); h.winT = 1.2; partner(g).winT = 1.2; g.flash = 0.35; spark(g, 'cloud', s.x, s.y - 170, 40, '#dff4ff', 280, 1, 5); g.hintIdle = 2.5; }
    if (C.t > 2 && !C.blown) { C.blown = true; h.face = 1; doGust(g); }
  } else if (C.kind === 'wake') {   // the hub Static is gone: the cloud cabinet wakes
    if (C.t > 0.5 && !C.a) { C.a = true; sfx(g, 'heal'); wakeHub(g, false); g.W.hub.cabs!.find((c) => c.id === 'cloud')!.wob = 0.6; }
    if (C.t > 1.2) { lead(g).winT = Math.max(lead(g).winT, 0.2); }
  } else if (C.kind === 'flee') {   // the anchor dissolves; what is left of the Static flees up and out
    g.shake = Math.max(g.shake, 0.3 * (1 - C.t / C.dur));
    for (let i = 0; i < 3; i++) g.parts.push({ w: 'deep', x: rr(g, 700, 1200), y: rr(g, 150, 600), vx: rr(g, 150, 400), vy: rr(g, -400, -150), life: 1.2, max: 1.2, col: rnd(g) < 0.6 ? '#b9a4ff' : '#efe6ff', size: rr(g, 3, 7), kind: 'pix' });
    if (C.t > 1 && !C.a) { C.a = true; const o = w.portals[1]; o.open = true; o.t = 0; h.aweT = 1.5; partner(g).aweT = 1.5; sfx(g, 'roar'); }
  } else if (C.kind === 'gather') {   // all the Static left in the arcade gathers into the giant
    if (!C.a) { C.a = true; g.tune = 'boss'; sfx(g, 'roar'); }
    for (const hh of [lead(g), partner(g)]) { hh.aweT = 0.3; hh.face = 1; }
    for (let i = 0; i < 4; i++) { const a = rnd(g) * TAU, r = rr(g, 500, 900); g.parts.push({ w: 'hub', x: 1010 + Math.cos(a) * r, y: 380 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 1.1, vy: -Math.sin(a) * r * 0.66, life: 0.9, max: 0.9, col: rnd(g) < 0.6 ? '#b9a4ff' : '#efe6ff', size: rr(g, 3, 7), kind: 'pix' }); }
    g.shake = Math.max(g.shake, 0.12);
    if (C.t > 1.2 && !g.boss) startBoss(g);
  } else if (C.kind === 'heal') {
    if (C.t > 0.7 && !C.a) { C.a = true; sfx(g, 'heal'); g.tune = 'healed'; g.healT = 0; g.flags.healed = true; for (const c of w.cabs!) c.live = true; }
    if (C.t > 1.8 && !C.b) { C.b = true; lead(g).winT = 2.5; partner(g).winT = 2.5; }
    if (C.t > 1) for (let i = 0; i < 2; i++) g.parts.push({ w: 'hub', x: rr(g, 0, 1280), y: rr(g, 200, 700), vx: rr(g, -10, 10), vy: rr(g, -40, -15), life: 2.5, max: 2.5, col: rnd(g) < 0.5 ? '#ffd98a' : '#fff4d0', size: rr(g, 2, 5), kind: 'mote' });
  }
  if (C.t >= C.dur) { const k = C.kind; g.cut = null; if (k === 'heal') { g.mode = 'end'; g.endT = 0; g.stats.tHeal = g.playT; ev(g, 'END'); } }
}

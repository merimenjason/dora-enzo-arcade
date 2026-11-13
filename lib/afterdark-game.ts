// The Arcade After Dark, Chapter One: the engine's front door. A fixed 60 Hz step, seeded randomness (a seed replays a
// run exactly), no DOM. Dora and Enzo hop into the arcade's cabinets (a castle, a sea, a cloud fortress), earn an
// ability in each (Enzo's ping, Dora's sweep, the gust for both) that carries across every world, and use them on the
// Static that is eating the arcade, then on the Static giant in the hub. Also the wordless hints, which pose each hero
// shows, and the save. Rules live in afterdark-move (movement, abilities), afterdark-things (each world's things),
// afterdark-flow (goals, transitions, cutscenes) and afterdark-boss; drawing in afterdark-scene.
import { type World, type WorldId, type HeroName } from './afterdark-worlds.js';
import {
  type Game, type Hero, type Input, type Hint, NO_INPUT, DT, newGame, applyWorldProgress, W0, lead, partner, updParts, entryOf, placeHeroes, heroMid,
} from './afterdark-core.js';
import { moveLand, moveSwim, followTrail, useAbility, swapHeroes, updRings, groundBelow } from './afterdark-move.js';
import { updWorld, abilityNeeds } from './afterdark-things.js';
import { goal, hubSuggestion, nearThing, interact, updTrans, updCut } from './afterdark-flow.js';
import { bossNeed } from './afterdark-boss.js';
import { fsize, TUNNEL } from './afterdark-worlds.js';

export * from './afterdark-core.js';
export { goal, hubSuggestion, nearThing, interact, cabScreen, portalOpen, hopTarget } from './afterdark-flow.js';
export { abilityNeeds } from './afterdark-things.js';
export { solidsOf, platsOf, groundBelow, swapHeroes, useAbility, webActive, catchMargin } from './afterdark-move.js';
export { bossNeed, bossCore } from './afterdark-boss.js';

export function step(g: Game, I: Input = NO_INPUT) {
  const dt = DT;
  g.time += dt;
  const acted = !!(I.mx || I.my || I.jumpP || I.eP || I.jP || I.kP || I.swapP || I.actP);
  if (acted) g.lastAct = g.time;
  if (g.mode === 'end') g.endT += dt;
  else { g.playT += dt; g.stats.worldT[g.world] = (g.stats.worldT[g.world] || 0) + dt; }
  if (g.trans) updTrans(g, dt);
  else if (g.cut) updCut(g, dt);
  const L = lead(g), P = partner(g);
  const busy = g.trans || g.cut || g.mode !== 'play';
  const J = busy ? NO_INPUT : I;
  if (!busy) {
    if (I.swapP) swapHeroes(g);
    if (I.eP) interact(g);
    else if (I.jP) useAbility(g);
    else if (I.kP) useAbility(g, 'gust');
    else if (I.actP) { if (nearThing(g)) interact(g); else useAbility(g, null, true); }
    if (acted && g.hintIdle < 5) g.hintIdle = g.assist ? 5 : 8;
  }
  for (const h of [L, P]) {
    h.hurtT = Math.max(0, h.hurtT - dt); h.invT = Math.max(0, h.invT - dt); h.abilT = Math.max(0, h.abilT - dt); h.gustT = Math.max(0, h.gustT - dt);
    h.reachT = Math.max(0, h.reachT - dt); h.winT = Math.max(0, h.winT - dt); h.landT = Math.max(0, h.landT - dt); h.rollT = Math.max(0, h.rollT - dt);
    h.diveT = Math.max(0, h.diveT - dt); h.braceT = Math.max(0, h.braceT - dt); h.aweT = Math.max(0, h.aweT - dt);
    h.animT += dt;
  }
  if (!g.trans || g.trans.kind === 'fade') {
    const lw = W0(g), Ld = lead(g);
    if (lw.kind === 'swim') moveSwim(g, Ld, lw, J, dt); else moveLand(g, Ld, lw, J, dt);
    Ld.f = heroSuffix(g, Ld, lw);
    if (Ld === lead(g)) {
      Ld.trail.push({ x: Ld.x, y: Ld.y, f: Ld.f, face: Ld.face, g: Ld.ground }); if (Ld.trail.length > 90) Ld.trail.shift();
      followTrail(g, partner(g), lead(g), lw, dt);
    }
  }
  updWorld(g, dt);
  updRings(g, dt);
  for (const a of g.arcs) a.t += dt;
  g.arcs = g.arcs.filter((a) => a.t < 0.55);
  updParts(g, dt);
  g.shake = Math.max(0, g.shake - dt); g.flash = Math.max(0, g.flash - dt);
  if (g.healT >= 0) g.healT += dt;
  computeHint(g);
}

// ───────────── hints: glints are always on; key prompts in the player's own keys appear only after idling
function computeHint(g: Game) {
  g.hint = null;
  if (g.mode !== 'play' || g.trans || g.cut) return;
  if (g.time - g.lastAct < g.hintIdle) return;
  g.hint = hintFor(g);
}
/** the next step, as a cue: the key, where to show it, and where it points */
export function hintFor(g: Game): Hint | null {
  const w = W0(g), h = lead(g), n = nearThing(g);
  const top = w.kind === 'swim' ? h.y - 110 : h.y - 200;
  const move = (x: number, y?: number): Hint => ({ key: x > h.x ? 'R' : 'L', x: h.x, y: top, tx: x, ty: y });
  const E = (): Hint => ({ key: 'E', x: n!.x, y: n!.y, tx: n!.x, ty: n!.y });
  const abil = (ab: string): Hint => {
    if (ab === 'gust') return { key: g.assist ? 'J' : 'K', x: h.x, y: top };
    const has = (h.name === 'enzo' && ab === 'ping') || (h.name === 'dora' && ab === 'sweep');
    return { key: has || g.assist ? 'J' : 'swap', x: h.x, y: top };
  };
  const need = abilityNeeds(g), want = (k: 'ping' | 'sweep' | 'gust') => g.abil[k] && need[k] < 1;
  const out = () => { const p = w.portals.find((q) => q.id === 'out')!; return n && n.kind === 'portal' && (n.obj as { id: string }).id === 'out' ? E() : move(p.x, p.y); };
  if (w.id === 'hub') {
    if (g.boss) { const k = bossNeed(g); return k ? abil(k) : null; }
    const walls = w.statics.filter((s) => s.alive && s.kind === 'wall');
    if (goal(g) === 'hubsweep' && walls.length) { const edge = Math.min(...walls.map((s) => s.x0)); return h.x > edge - 220 ? abil('sweep') : move(edge); }
    const c = hubSuggestion(g);
    if (n && n.kind === 'cab' && c && n.obj === c) return E();
    return c ? move(c.x) : null;
  }
  for (const k of ['ping', 'gust', 'sweep'] as const) if (want(k) && !(w.id === 'castle' && k === 'ping' && g.flags.door)) return abil(k);
  if (w.id === 'cloud' && !h.ground && h.vy > 0 && !groundBelow(w, h.x, h.y)) return { key: 'jump', x: h.x, y: top };
  if (w.id === 'sea') {
    if (!w.conch!.used) return n && n.kind === 'conch' ? E() : move(w.conch!.x, w.conch!.y - 120);
    const [, pph] = fsize('pillar'), tunY = w.pillar!.bottom - pph * (1 - TUNNEL.cy);
    if (!w.pillar!.open || h.x < w.pillar!.x + 60) return move(w.pillar!.x + 120, tunY);
    if (goal(g) === 'sea' && g.abil.gust) return w.mound!.open ? (n && n.kind === 'mound' ? E() : move(w.mound!.x)) : move(w.mound!.x, w.mound!.y - 120);
    const cr = w.crystals.find((c) => !c.lit); if (cr) return move(cr.x, cr.y - 200);
    return out();
  }
  if (w.id === 'deep') {
    if (g.flags.anchor) return out();
    const a = w.anchor!, al = w.statics.filter((s) => s.alive);
    return move(a.found && a.bare && al.length ? Math.min(...al.map((s) => s.x0)) - 150 : a.x - (a.found ? 420 : 300), a.y);
  }
  if (w.id === 'castle') {
    const wl = w.wall!;
    if (wl.open) return n && n.kind === 'wall' ? E() : move(wl.x);
    if (g.abil.ping) return move(wl.x);
    if (g.flags.castleBlocked) return n && n.kind === 'portal' ? E() : move(w.portals[1].x);
    return n && n.kind === 'wall' ? E() : move(wl.x);
  }
  if (w.id === 'room') {
    if (!w.pedestal!.taken) return n && n.kind === 'pedestal' ? E() : move(w.pedestal!.x);
    const b = w.braziers!.find((q) => !q.lit); if (b) return move(b.x);
    if (!g.flags.roomClear) { const edge = Math.min(...w.statics.filter((s) => s.alive && s.kind === 'wall').map((s) => s.x0)); return h.x > edge - 220 ? abil('sweep') : move(edge); }
    return out();
  }
  if (w.id === 'cloud') {
    if (!w.shrine!.taken) return n && n.kind === 'shrine' ? E() : move(w.shrine!.x);
    return out();
  }
  return null;
}

// ───────────── which painted pose a hero shows (the partner copies the lead's poses from its trail)
export function heroSuffix(g: Game, h: Hero, w: World): string {
  const swim = w.kind === 'swim';
  if (h.hurtT > 0) return g.boss ? 'down' : 'hurt';
  if (swim) {
    if (h.rollT > 0) return 'roll';
    if (h.gustT > 0) return h.gustT > 0.45 ? 'gustw' : 'gust';
    if (h.abilT > 0) return 'ability';
    if (h.winT > 0) return 'win';
    if (h.reachT > 0) return 'reach';
    const sp = Math.hypot(h.vx, h.vy);
    if (h.inCurrent && Math.abs(h.vx) < 60) return 'tumble';
    if (sp > 90) {
      if (h.vy < -150 && Math.abs(h.vx) < 150) return 'up';
      if (h.vy > 150 && Math.abs(h.vx) < 150) return 'down';
      return ['swim1', 'swim2', 'swim3', 'swim2'][Math.floor(h.animT * 7) % 4];
    }
    return Math.floor(h.animT * 2.5) % 2 ? 'tread2' : 'tread1';
  }
  if (h.diveT > 0) return 'dive';
  if (h.rollT > 0) return 'fall';
  if (h.gustT > 0) return h.gustT > 0.45 ? 'gustw' : 'gust';
  if (h.abilT > 0) return 'ability';
  if (h.braceT > 0) return 'brace';
  if (h.aweT > 0) return 'awe';
  if (h.winT > 0) return Math.floor(h.winT * 3) % 2 && !h.ground ? 'jump' : 'win';
  if (h.reachT > 0) return 'reach';
  if (h.rideT > 0) return 'ride';
  if (h.glide) return Math.floor(h.animT * 4) % 2 ? 'glide2' : 'glide1';
  if (!h.ground) return h.vy < 0 ? 'jump' : 'fall';
  if (h.landT > 0 && w.outfit === 'cloud') return 'land';
  if (Math.abs(h.vx) > 10) return ['walk1', 'walk2', 'walk3', 'walk4'][Math.floor(h.animT * (w.speed / 30)) % 4];
  return 'idle';
}
export function heroFrame(g: Game, h: Hero, w: World) {
  const busy = h.hurtT > 0 || h.winT > 0 || h.aweT > 0 || h.braceT > 0 || h.diveT > 0 || h.rollT > 0 || h.reachT > 0;
  const f = h === lead(g) || busy ? heroSuffix(g, h, w) : h.f || 'idle';
  return `${h.name}-${w.outfit}-${f}`;
}

/** put both heroes into a world (tests, the bots and the save use it) */
export function warp(g: Game, wid: WorldId, x?: number, y?: number) {
  g.world = wid; const e = entryOf(g, wid);
  placeHeroes(g, wid, x ?? e.x, y ?? e.y, 1); g.tune = g.W[wid].tune;
}

// ───────────── the save: settings, the best run, and the chapter so far (resumed in the hub)
export const SAVE_KEY = 'after-dark-v1';
export interface Progress { abil: Game['abil']; flags: Game['flags']; pearls: string[]; playT: number; lead: HeroName }
export interface SaveData { v: 1; assist: boolean; sound: boolean; music: boolean; best: { time: number; pearls: number } | null; progress: Progress | null; runs: number }
export function freshSave(): SaveData { return { v: 1, assist: true, sound: true, music: true, best: null, progress: null, runs: 0 }; }
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || typeof s.assist !== 'boolean') return null;
    return { ...freshSave(), ...s };
  } catch { return null; }
}
/** every pearl's id, world-qualified: 'sea:3', and 'castle:chest' for the chest */
export function pearlIds(g: Game) {
  const out: string[] = [];
  for (const k of ['sea', 'castle', 'cloud', 'deep'] as const) for (const p of g.W[k].pearls) if (p.got) out.push(`${k}:${p.id}`);
  if (g.W.castle.chest!.open) out.push('castle:chest');
  return out;
}
/** the chapter so far, worth saving once the heroes stand in the hub between cabinets */
export function progressOf(g: Game): Progress | null {
  if (g.mode !== 'play' || g.world !== 'hub' || g.trans || g.cut || g.boss || !(g.abil.ping || g.flags.castleBlocked || g.stats.pearls)) return null;
  return { abil: { ...g.abil }, flags: { ...g.flags }, pearls: pearlIds(g), playT: Math.round(g.playT), lead: g.lead };
}
/** a new game picked up where a save left off: in the hub, with the abilities, the worlds' locks and the pearls */
export function resume(p: Progress, opts: { seed?: number; assist?: boolean } = {}): Game {
  const g = newGame(opts);
  Object.assign(g.abil, p.abil); Object.assign(g.flags, p.flags); g.flags.boss = false; g.flags.healed = false;
  applyWorldProgress(g);
  for (const id of p.pearls) {
    const [k, n] = id.split(':') as [WorldId, string];
    if (n === 'chest') { g.W.castle.chest!.open = true; g.stats.pearls++; continue; }
    const q = g.W[k]?.pearls.find((x) => x.id === n); if (q && !q.got) { q.got = q.revealed = true; g.stats.pearls++; }
  }
  g.playT = p.playT; g.lead = p.lead;
  placeHeroes(g, 'hub', g.W.hub.spawn, 640, 1);
  return g;
}

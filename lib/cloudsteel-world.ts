// Cloudsteel: the story's world. A fixed 60 Hz simulation with no DOM: Dora walking the three areas of the climb (the
// Rain Terrace, the Cloud-Forest Path and the Citadel Gate) with Enzo at her heels; talking, picking things up, Enzo's
// lantern lighting spirit bridges, sun-stones and jade seals; the gates and exits; and handing each duel to the Fight
// engine (lib/cloudsteel-game.ts) and taking the result back. What is where, and every line of talk, is in
// lib/cloudsteel-story.ts. Drawing is in lib/cloudsteel-scene.ts, the page in app/cloudsteel/page.tsx.
import type { FoeDef, Upgrades } from './cloudsteel-game.js';
import { AREAS, DUELS, ITEMS, NPCS, PICKUPS, SCENES, STONES, WORLDS_ORDER, type ItemId } from './cloudsteel-story.js';

export const STORY_V = 1, WALK = 3.6, LANTERN = { len: 54, at: 24, r: 3.5, wick: 5.5, reach: 2.6 }, PICKUP = { len: 72, at: 32 }, REACH = 1.9;

export type AreaId = 'terrace' | 'forest' | 'citadel';
export type Shape = { k: 'rect'; x0: number; z0: number; x1: number; z1: number } | { k: 'circle'; x: number; z: number; r: number };
export type Who = 'dora' | 'enzo' | 'qori' | 'tupa' | 'atoq' | 'kin' | 'archer' | 'mallku' | 'titu' | 'ukhu' | 'stone';
/** a line of talk; `mood` picks the speaker's second talking painting */
export type Line = { who: Who; text: string; mood?: 1 };
export type Effect = { flag: string } | { give: ItemId } | { end: true };
export type SceneDef = { lines: Line[]; choice?: { yes: string; no: string }; then?: Effect[]; no?: Effect[] };
export type Glyph = 'serpent' | 'puma' | 'condor' | 'sun';
export type Gate = { id: string; shape: Shape; seal: 'sun' | 'jade' | 'worlds' };
export type Plank = { id: string; x: number; z: number; hx: number; hz: number; deep?: boolean };
export type Exit = { shape: Shape; to: AreaId; x: number; z: number; face: number };
export type Trigger = { id: string; shape: Shape; scene: string; need?: (w: WorldView) => boolean };
export type Sign = { id: string; x: number; z: number; scene: string; label: string };
export type Prop = { kind: string; x: number; z: number; s?: number; r?: number; solid?: number };
export type Area = {
  id: AreaId; name: string; walk: Shape[]; solid: Shape[]; gates: Gate[]; planks: Plank[]; exits: Exit[]; triggers: Trigger[]; signs: Sign[];
  spawn: { x: number; z: number; face: number }; props: Prop[];
};
export type Duel = { id: string; area: AreaId; title: string; x: number; z: number; rot: number; foes: FoeDef[]; stand: { x: number; z: number; face: number }[];
  optional: boolean; reward?: ItemId; retreat: { x: number; z: number }; before: string; after: string };
export type Npc = { id: string; who: Who; name: string; area: AreaId; x: number; z: number; face: number; scene: string; when?: (w: WorldView) => boolean; at?: (w: WorldView) => { area: AreaId; x: number; z: number; face: number } | null };
export type Pickup = { id: ItemId; area: AreaId; x: number; z: number };
export type Stone = { id: string; area: AreaId; x: number; z: number; glyph: Glyph; face: number; scene: string };
/** what the story's conditions can ask */
export type WorldView = { has(flag: string): boolean; got(item: ItemId): boolean; won(duel: string): boolean; isLit(id: string): boolean; quipus: number };

export type WInput = { x: number; z: number; act: boolean; lantern: boolean; choose: 0 | 1 | 2 };
export const idleW = (): WInput => ({ x: 0, z: 0, act: false, lantern: false, choose: 0 });
export type Mode = 'walk' | 'talk' | 'lantern' | 'pickup' | 'duel' | 'arrive' | 'end';
export type Near = { kind: 'npc' | 'pickup' | 'sign' | 'stone' | 'duel'; id: string; label: string; x: number; z: number } | null;
export type WorldEvent =
  | { t: 'talk'; scene: string } | { t: 'line'; who: Who } | { t: 'endTalk' } | { t: 'lantern'; x: number; z: number; r: number } | { t: 'plank'; id: string }
  | { t: 'stone'; id: string } | { t: 'stonesReset' } | { t: 'gate'; id: string } | { t: 'pickup'; id: ItemId } | { t: 'got'; id: ItemId }
  | { t: 'duel'; id: string } | { t: 'travel'; to: AreaId } | { t: 'end' } | { t: 'step' } | { t: 'cold' };
export type StoryStats = { ticks: number; fightTicks: number; deflects: number; falls: number; finishers: number; damage: number; duels: number };
export type StorySave = { v: number; area: AreaId; x: number; z: number; face: number; flags: string[]; got: string[]; lit: string[]; won: string[]; seq: string[]; stats: StoryStats; done: boolean };

const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export function inShape(s: Shape, x: number, z: number, pad = 0) {
  if (s.k === 'rect') return x >= s.x0 - pad && x <= s.x1 + pad && z >= s.z0 - pad && z <= s.z1 + pad;
  return Math.hypot(x - s.x, z - s.z) <= s.r + pad;
}
/** a point in the fight's frame (centred on the duel, foes coming from -z) to the world */
export function duelToWorld(d: Duel, lx: number, lz: number) {
  const c = Math.cos(d.rot), s = Math.sin(d.rot);
  return { x: d.x + lx * c + lz * s, z: d.z - lx * s + lz * c };
}

export class World implements WorldView {
  area: AreaId = 'terrace'; x = 0; z = 0; face = Math.PI; mode: Mode = 'walk'; t = 0; tick_ = 0;
  moving = false; stepT = 0;
  enzo = { x: 0, z: 0, face: Math.PI, moving: false, lantern: 0 };
  flags = new Set<string>(); gotItems = new Set<string>(); lit = new Set<string>(); wonDuels = new Set<string>(); seq: string[] = [];
  talk: { scene: string; def: SceneDef; i: number; who: string | null } | null = null;
  duel: Duel | null = null; done = false; lastGot: ItemId | null = null;
  stats: StoryStats = { ticks: 0, fightTicks: 0, deflects: 0, falls: 0, finishers: 0, damage: 0, duels: 0 };
  events: WorldEvent[] = [];
  private trail: { x: number; z: number }[] = []; private prev: WInput = idleW(); private pickupId: ItemId | null = null; private pending: Effect[] = [];

  constructor() { this.enter('terrace', AREAS.terrace.spawn.x, AREAS.terrace.spawn.z, AREAS.terrace.spawn.face); }

  // ------------------------------------------------------------- the questions the story asks
  has(f: string) { return this.flags.has(f); }
  got(i: ItemId) { return this.gotItems.has(i); }
  won(d: string) { return this.wonDuels.has(d); }
  isLit(id: string) { return this.lit.has(id); }
  get quipus() { let n = 0; for (const i of this.gotItems) if (i.startsWith('q')) n++; return n; }
  get ups(): Upgrades { return { edge: this.got('edge'), feather: this.got('feather'), claw: this.got('claw'), flame: this.got('flame') }; }
  get lanternR() { return this.got('wick') ? LANTERN.wick : LANTERN.r; }
  get areaDef() { return AREAS[this.area]; }

  /** the NPCs standing in this area now, with where they stand */
  npcs() {
    const out: (Npc & { x: number; z: number; face: number })[] = [];
    for (const n of NPCS) {
      if (n.when && !n.when(this)) continue;
      const at = n.at ? n.at(this) : null, p = at ?? { area: n.area, x: n.x, z: n.z, face: n.face };
      if (p.area === this.area) out.push({ ...n, ...p });
    }
    return out;
  }
  /** the duels whose foes are waiting in this area */
  duels() { return DUELS.filter((d) => d.area === this.area && !this.won(d.id)); }
  pickups() { return PICKUPS.filter((p) => p.area === this.area && !this.got(p.id)); }
  stones() { return STONES.filter((s) => s.area === this.area); }
  gateOpen(g: Gate) { return this.flags.has(`gate:${g.id}`); }
  plankLit(p: Plank) { return this.lit.has(p.id); }

  /** can Dora stand here? On a walkable shape and not in a wall or a shut gate, or on a lit plank */
  walkable(x: number, z: number) {
    const a = this.areaDef;
    for (const p of a.planks) if (this.lit.has(p.id) && Math.abs(x - p.x) <= p.hx && Math.abs(z - p.z) <= p.hz) return true;
    if (!a.walk.some((s) => inShape(s, x, z))) return false;
    for (const s of a.solid) if (inShape(s, x, z, 0.3)) return false;
    for (const p of a.props) if (p.solid && Math.hypot(x - p.x, z - p.z) < p.solid + 0.3) return false;
    for (const s of this.stones()) if (Math.hypot(x - s.x, z - s.z) < 0.85) return false;
    for (const g of a.gates) if (!this.gateOpen(g) && inShape(g.shape, x, z)) return false;
    for (const n of this.npcs()) if (Math.hypot(x - n.x, z - n.z) < 0.7) return false;
    for (const d of this.duels()) for (const s of d.stand) if (Math.hypot(x - s.x, z - s.z) < 0.7) return false;
    return true;
  }

  private enter(area: AreaId, x: number, z: number, face: number) {
    this.area = area; this.x = x; this.z = z; this.face = face;
    this.enzo.x = x - Math.sin(face) * 1.6; this.enzo.z = z - Math.cos(face) * 1.6; this.enzo.face = face;
    if (!this.walkable(this.enzo.x, this.enzo.z)) { this.enzo.x = x; this.enzo.z = z; }
    this.trail = [{ x: this.enzo.x, z: this.enzo.z }, { x, z }];
  }

  // ------------------------------------------------------------- one tick
  tick(inp: WInput) {
    this.events.length = 0; this.tick_++; this.t++;
    const p = this.prev, act = inp.act && !p.act, lantern = inp.lantern && !p.lantern; this.prev = { ...inp };
    if (this.mode !== 'duel' && this.mode !== 'end') this.stats.ticks++;
    this.moving = false;
    switch (this.mode) {
      case 'walk': this.walk(inp, act, lantern); break;
      case 'talk': this.stepTalk(act, inp.choose); break;
      case 'lantern': this.stepLantern(); break;
      case 'pickup': this.stepPickup(); break;
      case 'arrive': if (this.t >= 30) this.setMode('walk'); break;
      default: break;
    }
    this.follow();
  }
  private setMode(m: Mode) { this.mode = m; this.t = 0; }

  private walk(inp: WInput, act: boolean, lantern: boolean) {
    const mag = Math.hypot(inp.x, inp.z);
    if (mag > 0.15) {
      const k = mag > 1 ? 1 / mag : 1, vx = inp.x * k * WALK / 60, vz = inp.z * k * WALK / 60;
      this.face += wrap(Math.atan2(inp.x, inp.z) - this.face) * 0.25;
      const nx = this.x + vx, nz = this.z + vz, inside = !this.walkable(this.x, this.z);
      // a fight can end with Dora inside someone's elbow room: let her step out of it
      if (inside && this.areaDef.walk.some((s) => inShape(s, nx, nz))) { this.x = nx; this.z = nz; this.moving = true; }
      else if (this.walkable(nx, nz)) { this.x = nx; this.z = nz; this.moving = true; }
      else if (Math.abs(vx) > 1e-4 && this.walkable(nx, this.z)) { this.x = nx; this.moving = true; }
      else if (Math.abs(vz) > 1e-4 && this.walkable(this.x, nz)) { this.z = nz; this.moving = true; }
      if (this.moving && ++this.stepT % 20 === 0) this.events.push({ t: 'step' });
      const last = this.trail[this.trail.length - 1];
      if (Math.hypot(this.x - last.x, this.z - last.z) > 0.25) { this.trail.push({ x: this.x, z: this.z }); if (this.trail.length > 80) this.trail.shift(); }
    }
    const a = this.areaDef;
    // exits, then the scenes that start by themselves
    for (const e of a.exits) if (inShape(e.shape, this.x, this.z)) {
      this.events.push({ t: 'travel', to: e.to }); this.enter(e.to, e.x, e.z, e.face); this.setMode('arrive'); return;
    }
    for (const tr of a.triggers) if (!this.flags.has(`seen:${tr.id}`) && inShape(tr.shape, this.x, this.z) && (!tr.need || tr.need(this))) { this.flags.add(`seen:${tr.id}`); this.startTalk(tr.scene, null); return; }
    for (const d of this.duels()) if (!d.optional && Math.hypot(this.x - d.x, this.z - d.z) < 6.5) { this.startTalk(d.before, d.id); return; }
    if (act) { const n = this.near(); if (n) { this.interact(n); return; } }
    if (lantern) { this.setMode('lantern'); return; }
  }

  /** the nearest thing Dora can talk to or use, for the prompt */
  near(): Near {
    let best: Near = null, bd = REACH;
    const consider = (kind: NonNullable<Near>['kind'], id: string, label: string, x: number, z: number, reach = REACH) => { const d = Math.hypot(x - this.x, z - this.z); if (d < Math.min(bd, reach) + 0.6) { bd = d; best = { kind, id, label, x, z }; } };
    for (const n of this.npcs()) consider('npc', n.id, `Talk to ${n.name}`, n.x, n.z);
    for (const d of this.duels()) if (d.optional) for (const s of d.stand) consider('duel', d.id, `Talk to ${DUEL_WHO[d.id] ?? d.title}`, s.x, s.z, 2.4);
    for (const p of this.pickups()) consider('pickup', p.id, `Pick up ${ITEMS[p.id].name}`, p.x, p.z, 1.4);
    for (const s of this.areaDef.signs) consider('sign', s.id, s.label, s.x, s.z);
    for (const s of this.stones()) consider('stone', s.id, 'Look at the stone', s.x, s.z);
    return best;
  }
  private interact(n: NonNullable<Near>) {
    if (n.kind === 'pickup') { this.pickupId = n.id as ItemId; this.face = Math.atan2(n.x - this.x, n.z - this.z); this.setMode('pickup'); this.events.push({ t: 'pickup', id: n.id as ItemId }); return; }
    if (n.kind === 'npc') { const npc = this.npcs().find((o) => o.id === n.id)!; this.startTalk(npc.scene, null, npc.id); return; }
    if (n.kind === 'duel') { const d = DUELS.find((o) => o.id === n.id)!; this.startTalk(d.before, d.id); return; }
    if (n.kind === 'sign') { const s = this.areaDef.signs.find((o) => o.id === n.id)!; this.startTalk(s.scene, null); return; }
    const st = STONES.find((o) => o.id === n.id)!; this.startTalk(st.scene, null);
  }

  // ------------------------------------------------------------- talking
  private duelOf: string | null = null;
  private startTalk(scene: string, duel: string | null, who: string | null = null) {
    const def = SCENES[scene](this);
    this.talk = { scene, def, i: 0, who }; this.duelOf = duel; this.setMode('talk');
    if (who) { const n = this.npcs().find((o) => o.id === who); if (n) this.face = Math.atan2(n.x - this.x, n.z - this.z); }
    if (duel) { const d = DUELS.find((o) => o.id === duel)!; const s = d.stand[0]; this.face = Math.atan2(s.x - this.x, s.z - this.z); }
    this.events.push({ t: 'talk', scene }, { t: 'line', who: def.lines[0].who });
  }
  /** on the last line of a scene with a choice, the page offers it; act alone does not answer it */
  get choosing() { return !!this.talk && !!this.talk.def.choice && this.talk.i === this.talk.def.lines.length - 1; }
  get line() { return this.talk ? this.talk.def.lines[this.talk.i] : null; }
  private stepTalk(act: boolean, choose: 0 | 1 | 2) {
    const tk = this.talk!; if (this.t < 8) return;
    if (this.choosing) { if (choose) this.finishTalk(choose === 1); return; }
    if (!act) return;
    if (tk.i < tk.def.lines.length - 1) { tk.i++; this.t = 0; this.events.push({ t: 'line', who: tk.def.lines[tk.i].who }); return; }
    this.finishTalk(true);
  }
  /** the talk is over: its effects happen, and a duel's talk starts the fight unless Dora said "not now" */
  private finishTalk(yes: boolean) {
    const tk = this.talk!, duel = this.duelOf; this.talk = null; this.duelOf = null; this.events.push({ t: 'endTalk' }); this.setMode('walk');
    for (const e of (yes ? tk.def.then : tk.def.no) ?? []) this.apply(e);
    if (duel && yes && this.mode === 'walk') this.beginDuel(DUELS.find((o) => o.id === duel)!);
  }
  private apply(e: Effect) {
    if ('flag' in e) this.flags.add(e.flag);
    else if ('give' in e) this.give(e.give);
    else if ('end' in e) { this.done = true; this.setMode('end'); this.events.push({ t: 'end' }); }
  }
  private give(id: ItemId) { if (this.gotItems.has(id)) return; this.gotItems.add(id); this.lastGot = id; this.events.push({ t: 'got', id }); }

  // ------------------------------------------------------------- the lantern
  private stepLantern() {
    if (this.t === LANTERN.at) {
      const r = this.lanternR; this.events.push({ t: 'lantern', x: this.x, z: this.z, r });
      let any = false;
      for (const p of this.areaDef.planks) if (!this.lit.has(p.id) && (!p.deep || this.got('wick')) && Math.hypot(p.x - this.x, p.z - this.z) <= r) { this.lit.add(p.id); this.events.push({ t: 'plank', id: p.id }); any = true; }
      for (const g of this.areaDef.gates) if (g.seal === 'jade' && !this.gateOpen(g) && this.got('jade') && this.distTo(g.shape) <= LANTERN.reach + 0.6) { this.openGate(g); any = true; }
      for (const s of this.stones()) if (!this.lit.has(s.id) && Math.hypot(s.x - this.x, s.z - this.z) <= LANTERN.reach) { this.lightStone(s); any = true; }
      if (!any) this.events.push({ t: 'cold' });
    }
    if (this.t >= LANTERN.len) this.setMode('walk');
  }
  private distTo(s: Shape) {
    if (s.k === 'circle') return Math.max(0, Math.hypot(this.x - s.x, this.z - s.z) - s.r);
    const dx = Math.max(s.x0 - this.x, 0, this.x - s.x1), dz = Math.max(s.z0 - this.z, 0, this.z - s.z1); return Math.hypot(dx, dz);
  }
  private openGate(g: Gate) { this.flags.add(`gate:${g.id}`); this.events.push({ t: 'gate', id: g.id }); }
  private lightStone(s: Stone) {
    this.lit.add(s.id); this.events.push({ t: 'stone', id: s.id });
    const gates = this.areaDef.gates;
    if (s.glyph === 'sun') { const g = gates.find((o) => o.seal === 'sun'); if (g && !this.gateOpen(g)) this.openGate(g); return; }
    // the three worlds: below, this one, above, in that order
    this.seq.push(s.glyph);
    const ok = this.seq.every((gl, i) => gl === WORLDS_ORDER[i]);
    if (!ok) { for (const o of this.stones()) if (o.glyph !== 'sun') this.lit.delete(o.id); this.seq = []; this.events.push({ t: 'stonesReset' }); return; }
    if (this.seq.length === WORLDS_ORDER.length) { const g = gates.find((o) => o.seal === 'worlds'); if (g && !this.gateOpen(g)) this.openGate(g); }
  }

  // ------------------------------------------------------------- picking up
  private stepPickup() {
    if (this.t === PICKUP.at && this.pickupId) this.give(this.pickupId);
    if (this.t >= PICKUP.len) { this.pickupId = null; this.setMode('walk'); }
  }

  // ------------------------------------------------------------- duels
  private beginDuel(d: Duel) { this.duel = d; this.setMode('duel'); this.events.push({ t: 'duel', id: d.id }); }
  /** the page ran the fight: a win records it, gives the reward and plays the scene after */
  endDuel(won: boolean, s?: { ticks: number; deflects: number; falls: number; finishers: number; damage: number }) {
    const d = this.duel; if (!d || this.mode !== 'duel') return;
    if (s) { this.stats.fightTicks += s.ticks; this.stats.deflects += s.deflects; this.stats.falls += s.falls; this.stats.finishers += s.finishers; this.stats.damage += Math.round(s.damage); }
    this.duel = null;
    if (!won) { // step back down the path; the foe waits
      this.x = d.retreat.x; this.z = d.retreat.z; this.face = Math.atan2(d.x - this.x, d.z - this.z); this.enter(this.area, this.x, this.z, this.face); this.setMode('arrive'); return;
    }
    this.wonDuels.add(d.id); this.stats.duels++;
    // Dora finishes the fight where it ended; Enzo comes over
    this.setMode('walk'); this.trail = [{ x: this.enzo.x, z: this.enzo.z }, { x: this.x, z: this.z }];
    if (d.reward) this.give(d.reward);
    this.startTalk(d.after, null);
  }
  /** where the fight left Dora, in the world */
  placeFromFight(lx: number, lz: number, face: number, ex: number, ez: number) {
    const d = this.duel; if (!d) return;
    const p = duelToWorld(d, lx, lz), e = duelToWorld(d, ex, ez);
    this.x = p.x; this.z = p.z; this.face = face + d.rot; this.enzo.x = e.x; this.enzo.z = e.z;
    if (!this.walkable(this.x, this.z)) { const b = d.retreat; this.x = b.x; this.z = b.z; }
    if (!this.walkable(this.enzo.x, this.enzo.z)) { this.enzo.x = this.x; this.enzo.z = this.z; }
  }

  // ------------------------------------------------------------- Enzo follows along Dora's path
  private follow() {
    const e = this.enzo;
    if (this.mode === 'lantern') { // he steps up beside her and lifts the lantern
      const tx = this.x + Math.cos(this.face) * 0.95, tz = this.z - Math.sin(this.face) * 0.95;
      if (this.walkable(tx, tz)) { e.x += (tx - e.x) * 0.15; e.z += (tz - e.z) * 0.15; }
      e.face = this.face; e.moving = false; e.lantern = Math.min(1, this.t / 14); return;
    }
    e.lantern = Math.max(0, e.lantern - 0.08);
    if (this.mode === 'duel') return;
    if (this.mode === 'talk' && this.line) { // he turns to whoever is talking
      const n = this.talk?.who ? this.npcs().find((o) => o.id === this.talk!.who) : null;
      if (n) e.face = Math.atan2(n.x - e.x, n.z - e.z);
    }
    // the trail point about 1.6 m behind Dora
    let need = 1.6, tx = this.trail[0].x, tz = this.trail[0].z, px = this.x, pz = this.z;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const q = this.trail[i], d = Math.hypot(q.x - px, q.z - pz);
      if (d >= need) { const k = need / d; tx = px + (q.x - px) * k; tz = pz + (q.z - pz) * k; need = 0; break; }
      need -= d; px = q.x; pz = q.z; tx = q.x; tz = q.z;
    }
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d > 9) { e.x = tx; e.z = tz; }
    else if (d > 0.08) { const v = Math.min(d, (WALK * 1.25) / 60 * (d > 0.6 ? 1.3 : 1)); e.x += (dx / d) * v; e.z += (dz / d) * v; e.face += wrap(Math.atan2(dx, dz) - e.face) * 0.2; e.moving = v > 0.02; }
    else e.moving = false;
  }

  // ------------------------------------------------------------- saving
  toSave(): StorySave {
    return { v: STORY_V, area: this.area, x: round(this.x), z: round(this.z), face: round(this.face), flags: [...this.flags], got: [...this.gotItems], lit: [...this.lit], won: [...this.wonDuels], seq: [...this.seq], stats: { ...this.stats }, done: this.done };
  }
  static fromSave(o: unknown): World | null {
    const s = o as Partial<StorySave> | null;
    if (!s || typeof s !== 'object' || s.v !== STORY_V || !(s.area && s.area in AREAS)) return null;
    const strs = (a: unknown) => Array.isArray(a) ? a.filter((v): v is string => typeof v === 'string') : [];
    const w = new World();
    w.flags = new Set(strs(s.flags)); w.gotItems = new Set(strs(s.got).filter((i) => i in ITEMS)); w.lit = new Set(strs(s.lit)); w.wonDuels = new Set(strs(s.won).filter((d) => DUELS.some((o) => o.id === d)));
    w.seq = strs(s.seq).filter((g) => (WORLDS_ORDER as readonly string[]).includes(g));
    if (s.stats && typeof s.stats === 'object') for (const k of Object.keys(w.stats) as (keyof StoryStats)[]) { const v = (s.stats as StoryStats)[k]; if (typeof v === 'number' && v >= 0) w.stats[k] = v; }
    const a = AREAS[s.area as AreaId];
    w.enter(s.area as AreaId, a.spawn.x, a.spawn.z, a.spawn.face);
    if (typeof s.x === 'number' && typeof s.z === 'number' && w.walkable(s.x, s.z)) { w.enter(w.area, s.x, s.z, typeof s.face === 'number' ? s.face : a.spawn.face); }
    w.done = !!s.done; if (w.done) w.mode = 'end';
    return w;
  }
}
const round = (v: number) => Math.round(v * 100) / 100;

// ------------------------------------------------------------- the quest arrow
/** the next thing the main quest needs, and what to do there: walk to it (a duel or an exit starts by itself when Dora
 *  gets close), or lift the lantern once there. Optional duels and secrets are never the goal */
export type Goal = { area: AreaId; x: number; z: number; label: string; act: 'walk' | 'lantern' };
const ORDER: AreaId[] = ['terrace', 'forest', 'citadel'];
const AREA_TO: Record<AreaId, string> = { terrace: 'the Rain Terrace', forest: 'the Cloud-Forest Path', citadel: 'the Citadel Gate' };
/** where Dora stands to wake each stone with the lantern */
const STONE_AT: Record<string, { x: number; z: number }> = { sun: { x: 1.8, z: -22.3 }, serpent: { x: -7, z: -15 }, puma: { x: 0, z: -18 }, condor: { x: 7, z: -15 } };
const STONE_NAME: Record<string, string> = { serpent: 'the serpent stone (the world below)', puma: 'the puma stone (this world)', condor: 'the condor stone (the world above)' };
/** the main quest's next step, wherever it is on the mountain; null once the story is over */
function questStep(w: World): Goal | null {
  if (w.done) return null;
  const duel = (id: string, label: string): Goal => { const d = DUELS.find((o) => o.id === id)!; return { area: d.area, x: d.x, z: d.z, label, act: 'walk' }; };
  if (!w.won('atoq')) return duel('atoq', 'face Atoq on the plaza');
  if (!w.has('gate:sun')) return { area: 'terrace', ...STONE_AT.sun, label: 'wake the sun-stone with the lantern', act: 'lantern' };
  if (!w.has('seen:crossed')) {
    const bridge = AREAS.forest.planks.filter((p) => p.id.startsWith('b'));
    if (bridge.some((p) => !w.isLit(p.id))) {
      // stand on the furthest plank already awake (or at the head of the bridge) and lift the lantern again
      let at = { x: 11, z: -26.6 }; for (const p of bridge) if (w.isLit(p.id)) at = { x: p.x, z: p.z };
      return { area: 'forest', ...at, label: 'wake the spirit bridge with the lantern', act: 'lantern' };
    }
    return { area: 'forest', x: 11, z: -46.6, label: 'cross the spirit bridge', act: 'walk' };
  }
  if (!w.won('ambush')) return duel('ambush', 'get past the sword-kin');
  if (!w.has('gate:outer')) return { area: 'citadel', x: 0, z: -3.2, label: 'open the jade seal with the lantern', act: 'lantern' };
  if (!w.has('gate:worlds')) { const g = WORLDS_ORDER[w.seq.length] ?? WORLDS_ORDER[0]; return { area: 'citadel', ...STONE_AT[g], label: `wake ${STONE_NAME[g]}`, act: 'lantern' }; }
  if (!w.won('ukhu')) return duel('ukhu', 'face Ukhu at the Condor Gate');
  return null;
}
/** the quest arrow's goal in the area Dora is in: the next step, or the way out towards it */
export function nextGoal(w: World): Goal | null {
  const g = questStep(w); if (!g) return null;
  if (g.area === w.area) return { ...g, label: `Next: ${g.label}` };
  const fwd = ORDER.indexOf(g.area) > ORDER.indexOf(w.area);
  const e = w.areaDef.exits.find((o) => (ORDER.indexOf(o.to) > ORDER.indexOf(w.area)) === fwd);
  if (!e) return null;
  const c = e.shape.k === 'rect' ? { x: (e.shape.x0 + e.shape.x1) / 2, z: (e.shape.z0 + e.shape.z1) / 2 } : { x: e.shape.x, z: e.shape.z };
  return { area: w.area, ...c, label: `Next: ${fwd ? 'on' : 'back'} to ${AREA_TO[e.to]}`, act: 'walk' };
}
/** which way to walk towards a goal along the ground (round walls and gorges), from a distance field over a 0.5 m grid
 *  that is worked out again whenever the goal, the area or what is walkable changes */
export class GoalGuide {
  private key = ''; private dist: Float32Array | null = null; private x0 = 0; private z0 = 0; private nx = 0; private nz = 0;
  private static C = 0.5;
  dir(w: World, g: Goal): { x: number; z: number } | null {
    const k = `${w.area}|${g.x},${g.z}|${w.lit.size}|${[...w.flags].filter((f) => f.startsWith('gate:')).length}|${w.wonDuels.size}`;
    if (k !== this.key) { this.key = k; this.build(w, g); }
    const C = GoalGuide.C, d = this.dist!, at = (i: number, j: number) => (i < 0 || j < 0 || i >= this.nx || j >= this.nz ? Infinity : d[j * this.nx + i]);
    const i0 = Math.round((w.x - this.x0) / C), j0 = Math.round((w.z - this.z0) / C);
    let best = at(i0, j0), bi = i0, bj = j0;
    // the lowest cell within two steps: the direction downhill
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const v = at(i0 + di, j0 + dj) + Math.hypot(di, dj) * C * 0.01; if (v < best) { best = v; bi = i0 + di; bj = j0 + dj; } }
    if (!isFinite(best) || (bi === i0 && bj === j0)) { const dx = g.x - w.x, dz = g.z - w.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; }
    const dx = bi * C + this.x0 - w.x, dz = bj * C + this.z0 - w.z, l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }
  private build(w: World, g: Goal) {
    const C = GoalGuide.C; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const grow = (a: number, b: number, c: number, d: number) => { x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, c); z1 = Math.max(z1, d); };
    for (const s of w.areaDef.walk) if (s.k === 'rect') grow(s.x0, s.z0, s.x1, s.z1); else grow(s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r);
    for (const p of w.areaDef.planks) grow(p.x - p.hx, p.z - p.hz, p.x + p.hx, p.z + p.hz);
    this.x0 = x0 - 1; this.z0 = z0 - 1; this.nx = Math.ceil((x1 - x0 + 2) / C) + 1; this.nz = Math.ceil((z1 - z0 + 2) / C) + 1;
    const n = this.nx * this.nz, d = this.dist = new Float32Array(n).fill(Infinity), ok = new Uint8Array(n);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) ok[j * this.nx + i] = w.walkable(this.x0 + i * C, this.z0 + j * C) ? 1 : 0;
    // seed every walkable cell near the goal (the goal itself may stand in a stone's or a foe's elbow room)
    const q: number[] = [], gi = (g.x - this.x0) / C, gj = (g.z - this.z0) / C;
    for (let r = 1.2; !q.length && r < 8; r += 1) for (let j = Math.floor(gj - r / C); j <= Math.ceil(gj + r / C); j++) for (let i = Math.floor(gi - r / C); i <= Math.ceil(gi + r / C); i++) {
      if (i < 0 || j < 0 || i >= this.nx || j >= this.nz || !ok[j * this.nx + i] || Math.hypot(i - gi, j - gj) * C > r) continue;
      d[j * this.nx + i] = Math.hypot(i - gi, j - gj) * C; q.push(j * this.nx + i);
    }
    // Dijkstra-ish relaxation over eight neighbours (a plain queue, re-queued on improvement: the grid is small)
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = c % this.nx, j = (c / this.nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= this.nx || b >= this.nz) continue;
        const o = b * this.nx + a; if (!ok[o] || (di && dj && (!ok[j * this.nx + a] || !ok[b * this.nx + i]))) continue;
        const v = d[c] + (di && dj ? Math.SQRT2 : 1) * C; if (v < d[o] - 1e-4) { d[o] = v; q.push(o); }
      }
    }
  }
}
/** who to name in the prompt for an optional duel */
const DUEL_WHO: Record<string, string> = { kin1: 'the Sword-Kin', titu: 'Titu', mallku: 'Mallku' };

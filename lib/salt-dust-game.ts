// Salt & Dust: the deterministic engine. No DOM. The party walks a tile grid in two places, talks (with skill checks),
// crosses the salt flat with a draining canteen, and may fight the Dust Runners on a turn-based grid with action points.
// Randomness (hit rolls and damage) comes from a seeded generator kept in the save, so a seed replays a game exactly.
// The page calls `tick(dt)` every frame for walking and the journey, and the action methods on clicks.
import {
  MAPS, NPCS, SPOTS, LLAMAS, TALK, HEROES, LEGS, EVENTS, FOES, FIGHT_START, RULES, WATER_MAX, START_WATER, START_SILVER, SKILL_NAME,
  type Place, type HeroId, type Skill, type Npc, type Spot, type Opt, type TalkNode, type NodeId, type Leg, type PortraitId,
} from './salt-dust-world.js';

export * from './salt-dust-world.js';
export const SAVE_KEY = 'salt-dust-v1';
/** walking speed, tiles a second, and how long one stage of the journey takes, seconds */
export const WALK_SPEED = 3.6, LEG_TIME = 2.4, FIND_TIME = 2.8;

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, get state() { return a; }, set state(v: number) { a = v >>> 0; } };
}

export type Mode = 'explore' | 'talk' | 'travel' | 'combat' | 'finding' | 'end';
export type Dir = 'fr' | 'fl' | 'br' | 'bl';
/** someone on the walking grid: their tile, the tile they're stepping from and how far through the step */
export interface Walker { x: number; y: number; fx: number; fy: number; t: number; dir: Dir; moving: boolean }
export type Flags = Record<string, boolean | string | undefined> & { peace?: string };

export interface Unit {
  id: string; side: 'hero' | 'foe'; name: string; portrait: PortraitId;
  x: number; y: number; hp: number; max: number; ap: number; maxAp: number;
  down: boolean; fled: boolean; nap: boolean; dir: Dir;
}
export type CombatEvent =
  | { k: 'turn'; id: string }
  | { k: 'move'; id: string; path: [number, number][] }
  | { k: 'attack'; id: string; target: string; hit: boolean; dmg: number; chance: number }
  | { k: 'mend'; id: string; target: string; heal: number }
  | { k: 'drink'; id: string; heal: number }
  | { k: 'down'; id: string }
  | { k: 'surrender' }
  | { k: 'over'; result: 'won' | 'lost' };
export interface Combat {
  units: Unit[]; order: string[]; turn: number; round: number; mends: number; quiet: boolean;
  over: null | 'won' | 'lost'; log: string[];
}
export interface ShownOpt { text: string; check?: { skill: Skill; n: number; have: number; who: HeroId; parts: string }; pass: boolean; blocked: string | null; index: number }
export interface Save {
  v: 1; mode: 'explore' | 'travel' | 'end'; place: Place; at: NodeId; f: Flags; water: number; silver: number;
  hp: Record<HeroId, number>; pos: Record<HeroId, [number, number]>; rng: number; passed: string[]; failed: string[];
}

export function freshSave(seed = 1): Save {
  const m = MAPS.town;
  return { v: 1, mode: 'explore', place: 'town', at: 'tunupa', f: {}, water: START_WATER, silver: START_SILVER, hp: { dora: HEROES.dora.hp, enzo: HEROES.enzo.hp },
    pos: { dora: [...m.dora], enzo: [...m.enzo] }, rng: seed >>> 0, passed: [], failed: [] };
}
export function parseSave(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Save;
    if (!s || s.v !== 1 || !['explore', 'travel', 'end'].includes(s.mode) || !(s.place in MAPS)) return null;
    if (typeof s.water !== 'number' || typeof s.silver !== 'number' || !s.hp || !s.pos || !s.f || typeof s.f !== 'object') return null;
    if (!(s.at in LEGS)) return null;
    for (const h of ['dora', 'enzo'] as HeroId[]) {
      if (typeof s.hp[h] !== 'number' || !Array.isArray(s.pos[h]) || s.pos[h].length !== 2) return null;
    }
    return { ...s, passed: Array.isArray(s.passed) ? s.passed : [], failed: Array.isArray(s.failed) ? s.failed : [], rng: s.rng >>> 0 };
  } catch { return null; }
}

const DIRS4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** which way a step from (fx, fy) to (x, y) faces on screen: +x is down-right, +y down-left */
export function dirOf(dx: number, dy: number, was: Dir): Dir {
  if (dx > 0) return 'fr'; if (dy > 0) return 'fl'; if (dx < 0) return 'bl'; if (dy < 0) return 'br'; return was;
}
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class SaltGame {
  mode: Mode = 'explore';
  place: Place = 'town';
  at: NodeId = 'tunupa';
  f: Flags = {};
  water = START_WATER;
  silver = START_SILVER;
  hp: Record<HeroId, number> = { dora: HEROES.dora.hp, enzo: HEROES.enzo.hp };
  party: Record<HeroId, Walker>;
  /** Dora walks this path; Enzo follows one step behind */
  path: [number, number][] = [];
  /** what to open when the walk ends */
  goal: { talk: string; face: [number, number] } | null = null;
  talk: { id: string; back: 'explore' | 'travel'; speaker: string } | null = null;
  /** the line the heroes said last, and who said it (for the talking animation) */
  said: { who: HeroId; t: number } | null = null;
  journey: { from: NodeId; to: NodeId; t: number; leg: Leg; paid: number } | null = null;
  visited: NodeId[] = ['tunupa'];
  combat: Combat | null = null;
  events: CombatEvent[] = [];
  findT = 0;
  passed: string[] = [];
  failed: string[] = [];
  /** help on: foes aim a little worse, and the page shows hints, ranges and odds */
  help = true;
  r: ReturnType<typeof rng>;
  /** something the page should show once (a toast), cleared by the page */
  note: string | null = null;

  constructor(save: Save = freshSave()) {
    this.r = rng(save.rng || 1);
    this.mode = save.mode === 'travel' ? 'travel' : save.mode;
    this.place = save.place; this.at = save.at; this.f = { ...save.f };
    this.water = Math.max(0, Math.min(WATER_MAX, save.water)); this.silver = Math.max(0, save.silver);
    this.hp = { dora: Math.max(1, Math.min(HEROES.dora.hp, save.hp.dora)), enzo: Math.max(1, Math.min(HEROES.enzo.hp, save.hp.enzo)) };
    this.passed = [...save.passed]; this.failed = [...save.failed];
    const w = (p: [number, number]): Walker => ({ x: p[0], y: p[1], fx: p[0], fy: p[1], t: 1, dir: 'br', moving: false });
    this.party = { dora: w(save.pos.dora), enzo: w(save.pos.enzo) };
    if (!this.open(this.party.dora.x, this.party.dora.y, true)) this.resetPositions();
  }

  save(): Save {
    const mode = this.mode === 'end' || this.mode === 'finding' ? 'end' : this.mode === 'travel' || (this.mode === 'talk' && this.talk?.back === 'travel') ? 'travel' : 'explore';
    // a fight in progress is saved as the moment before it: the party in the yard, Tika ready to talk
    return { v: 1, mode, place: this.place, at: this.journey ? this.journey.from : this.at, f: { ...this.f }, water: this.water, silver: this.silver, hp: { ...this.hp },
      pos: { dora: [this.party.dora.x, this.party.dora.y], enzo: [this.party.enzo.x, this.party.enzo.y] }, rng: this.r.state, passed: [...this.passed], failed: [...this.failed] };
  }

  // ─── the party ───
  addWater(n: number) { this.water = Math.max(0, Math.min(WATER_MAX, this.water + n)); }
  hurt() { return this.hp.dora < HEROES.dora.hp || this.hp.enzo < HEROES.enzo.hp; }
  healAll() { this.hp.dora = HEROES.dora.hp; this.hp.enzo = HEROES.enzo.hp; }
  /** a check's numbers: the party's best hero at the skill, plus what they've learned */
  skillFor(c: { skill: Skill; bonus?: (g: SaltGame) => [number, string][] }) {
    const who: HeroId = HEROES.dora.skills[c.skill] >= HEROES.enzo.skills[c.skill] ? 'dora' : 'enzo';
    const base = HEROES[who].skills[c.skill];
    const bonus = c.bonus?.(this) ?? [];
    const have = base + bonus.reduce((s, [n]) => s + n, 0);
    const parts = `${HEROES[who].name} ${base}` + bonus.map(([n, why]) => ` + ${n} ${why}`).join('');
    return { who, have, parts };
  }
  /** Tika's toll in water: three, or four once she's been needled */
  toll() { return this.f.speechTried && !this.f.peace ? 4 : this.f.mastTried && !this.f.peace ? 4 : 3; }
  makePeace(how: string) { this.f.peace = how; }

  // ─── walking ───
  map() { return MAPS[this.place]; }
  npcs(place: Place = this.place): (Npc & { x: number; y: number })[] {
    return NPCS.filter((n) => n.place === place && (!n.here || n.here(this))).map((n) => ({ ...n, ...(this.f.peace && ASIDE[n.id] ? { x: ASIDE[n.id][0], y: ASIDE[n.id][1] } : {}) }));
  }
  spots(place: Place = this.place): Spot[] { return SPOTS.filter((s) => s.place === place); }
  /** a tile anyone can stand on (ignoring the party when `self`) */
  open(x: number, y: number, self = false): boolean {
    const m = this.map();
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (m.rows[y][x] === '#') return false;
    if (this.npcs().some((n) => n.x === x && n.y === y)) return false;
    if (this.place === 'town' && LLAMAS.some((l) => l.some(([lx, ly]) => lx === x && ly === y))) return false;
    return true;
  }
  resetPositions() {
    const m = this.map();
    for (const h of ['dora', 'enzo'] as HeroId[]) { const p = m[h]; this.party[h] = { x: p[0], y: p[1], fx: p[0], fy: p[1], t: 1, dir: 'br', moving: false }; }
    this.path = []; this.goal = null;
  }
  /** shortest walk from Dora to any of `targets` (BFS over open tiles, 4 ways) */
  route(targets: [number, number][]): [number, number][] | null {
    const d = this.party.dora, m = this.map(), key = (x: number, y: number) => y * m.w + x;
    const want = new Set(targets.filter(([x, y]) => this.open(x, y)).map(([x, y]) => key(x, y)));
    if (!want.size) return null;
    const prev = new Map<number, number>([[key(d.x, d.y), -1]]);
    const q: [number, number][] = [[d.x, d.y]];
    while (q.length) {
      const [x, y] = q.shift()!;
      if (want.has(key(x, y))) {
        const out: [number, number][] = []; let k = key(x, y);
        while (k !== key(d.x, d.y)) { out.unshift([k % m.w, Math.floor(k / m.w)]); k = prev.get(k)!; }
        return out;
      }
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (this.open(nx, ny) && !prev.has(key(nx, ny))) { prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]); }
      }
    }
    return null;
  }
  /** click a tile: walk there, or open whoever or whatever is there */
  clickTile(x: number, y: number): boolean {
    if (this.mode !== 'explore') return false;
    const who = this.npcs().find((n) => n.x === x && n.y === y);
    if (who) return this.clickNpc(who.id);
    const spot = this.spots().find((s) => (s.x === x && s.y === y) || (s.at[0] === x && s.at[1] === y));
    if (spot) return this.clickSpot(spot.id);
    const p = this.route([[x, y]]);
    if (!p) return false;
    this.path = p; this.goal = null;
    return true;
  }
  clickNpc(id: string): boolean {
    if (this.mode !== 'explore') return false;
    const n = this.npcs().find((q) => q.id === id);
    if (!n || !n.talk) return false;
    const next = DIRS8.map(([dx, dy]) => [n.x + dx, n.y + dy] as [number, number]);
    const d = this.party.dora;
    if (cheb(d, n) <= 1) { this.path = []; this.face(n.x, n.y); this.openTalk(n.talk, n.id); return true; }
    const p = this.route(next);
    if (!p) return false;
    this.path = p; this.goal = { talk: n.talk, face: [n.x, n.y] }; this.goalWho = n.id;
    return true;
  }
  goalWho = '';
  clickSpot(id: string): boolean {
    if (this.mode !== 'explore') return false;
    const s = this.spots().find((q) => q.id === id);
    if (!s) return false;
    const d = this.party.dora;
    if (d.x === s.at[0] && d.y === s.at[1]) { this.face(s.x, s.y); this.openTalk(s.talk, s.id); return true; }
    const p = this.route([s.at]);
    if (!p) return false;
    this.path = p; this.goal = { talk: s.talk, face: [s.x, s.y] }; this.goalWho = s.id;
    return true;
  }
  /** walk one tile with the keyboard, in screen terms: up, down, left, right */
  step(dx: number, dy: number): boolean {
    if (this.mode !== 'explore' || this.path.length) return false;
    const d = this.party.dora;
    if (!this.open(d.x + dx, d.y + dy)) return false;
    this.path = [[d.x + dx, d.y + dy]]; this.goal = null;
    return true;
  }
  face(x: number, y: number) {
    const d = this.party.dora;
    d.dir = dirOf(Math.sign(x - d.x), x !== d.x ? 0 : Math.sign(y - d.y), d.dir);
    if (x !== d.x && y !== d.y) d.dir = y > d.y ? (x > d.x ? 'fr' : 'fl') : (x > d.x ? 'br' : 'bl');
  }

  tick(dt: number) {
    if (this.said) { this.said.t -= dt; if (this.said.t <= 0) this.said = null; }
    if (this.mode === 'explore') this.walk(dt);
    else if (this.mode === 'travel' && this.journey) this.journeyTick(dt);
    else if (this.mode === 'finding') { this.findT += dt; if (this.findT >= FIND_TIME) { this.mode = 'end'; } }
  }
  private walk(dt: number) {
    const d = this.party.dora, e = this.party.enzo;
    let left = dt * WALK_SPEED;
    while (left > 0) {
      if (d.t < 1) {
        const take = Math.min(left, 1 - d.t);
        d.t += take; e.t = Math.min(1, e.t + take); left -= take;
        if (d.t < 1) break;
      }
      e.t = 1;
      if (!this.path.length) {
        d.moving = false; e.moving = false;
        if (this.goal) { const g = this.goal; this.goal = null; this.face(g.face[0], g.face[1]); this.openTalk(g.talk, this.goalWho); }
        break;
      }
      const [nx, ny] = this.path[0];
      if (!this.open(nx, ny)) { this.path = []; this.goal = null; d.moving = false; break; }
      this.path.shift();
      // Enzo steps into the tile Dora leaves, unless he's already next to where she's going
      if ((e.x === nx && e.y === ny) || cheb(e, { x: nx, y: ny }) > 1) {
        e.fx = e.x; e.fy = e.y; e.dir = dirOf(d.x - e.x, d.y - e.y, e.dir); e.x = d.x; e.y = d.y; e.t = 0; e.moving = true;
      } else e.moving = false;
      d.fx = d.x; d.fy = d.y; d.dir = dirOf(nx - d.x, ny - d.y, d.dir); d.x = nx; d.y = ny; d.t = 0; d.moving = true;
    }
    if (!this.path.length && d.t >= 1) { d.moving = false; if (e.t >= 1) e.moving = false; }
  }

  // ─── talking ───
  openTalk(id: string, speaker = '') {
    if (!TALK[id]) return;
    this.talk = { id, back: this.mode === 'travel' ? 'travel' : 'explore', speaker };
    this.mode = 'talk'; this.path = [];
    this.party.dora.moving = false; this.party.enzo.moving = false;
  }
  node(): TalkNode | null { return this.talk ? TALK[this.talk.id] : null; }
  line(): string { const n = this.node(); return !n ? '' : typeof n.text === 'function' ? n.text(this) : n.text; }
  /** the replies on offer now, with each check's numbers worked out */
  options(): ShownOpt[] {
    const n = this.node(); if (!n) return [];
    const out: ShownOpt[] = [];
    n.opts.forEach((o: Opt, index) => {
      if (o.show && !o.show(this)) return;
      const text = typeof o.text === 'function' ? o.text(this) : o.text;
      let check: ShownOpt['check'], pass = true;
      if (o.check) { const s = this.skillFor(o.check); check = { skill: o.check.skill, n: o.check.n, have: s.have, who: s.who, parts: s.parts }; pass = s.have >= o.check.n; }
      out.push({ text, check, pass, blocked: o.block ? o.block(this) : null, index });
    });
    return out;
  }
  /** pick the `i`th reply on offer */
  choose(i: number): boolean {
    if (this.mode !== 'talk' || !this.talk) return false;
    const shown = this.options()[i];
    if (!shown || shown.blocked) return false;
    const n = this.node()!, o = n.opts[shown.index], talk = this.talk;
    if (shown.check) {
      const tag = `${talk.id}:${shown.check.skill}`;
      (shown.pass ? this.passed : this.failed).push(tag);
      this.said = { who: shown.check.who, t: 1.6 };
      this.note = `${SKILL_NAME[shown.check.skill]} ${shown.check.n}: ${shown.pass ? 'passed' : 'failed'} (${shown.check.parts})`;
    } else this.said = { who: 'dora', t: 1.2 };
    const next = o.run(this, shown.pass);
    if (this.mode !== 'talk') { this.talk = null; return true; }
    if (next && TALK[next]) this.talk = { ...talk, id: next };
    else { this.talk = null; this.mode = talk.back; }
    return true;
  }

  // ─── the journey ───
  startTravel() { this.mode = 'travel'; this.at = 'tunupa'; this.journey = null; }
  /** the ways on from here */
  legs(): Leg[] { return this.mode === 'travel' && !this.journey ? LEGS[this.at] : []; }
  canRest() { return this.mode === 'travel' && !this.journey && this.hurt() && this.water >= 1; }
  rest(): boolean { if (!this.canRest()) return false; this.water -= 1; this.healAll(); this.note = 'You rest and drink a cup. Both of you feel better.'; return true; }
  backToTown(): boolean {
    if (this.mode !== 'travel' || this.journey || this.at !== 'tunupa') return false;
    this.mode = 'explore'; this.place = 'town';
    this.resetPositions();
    return true;
  }
  go(i: number): boolean {
    const leg = this.legs()[i];
    if (!leg) return false;
    this.journey = { from: this.at, to: leg.to, t: 0, leg, paid: 0 };
    return true;
  }
  private journeyTick(dt: number) {
    const j = this.journey!;
    j.t = Math.min(1, j.t + dt / LEG_TIME);
    // the canteen drains as you walk, a cup at a time
    const due = Math.floor(j.t * j.leg.water + 0.5 - 1e-9);
    while (j.paid < Math.min(due, j.leg.water)) {
      j.paid++;
      if (this.water > 0) this.water--;
      else { for (const h of ['dora', 'enzo'] as HeroId[]) this.hp[h] = Math.max(1, this.hp[h] - 2); this.note = 'The canteen is dry. The heat takes its toll (−2 health each).'; }
    }
    if (j.t < 1) return;
    this.journey = null; this.at = j.to;
    if (!this.visited.includes(j.to)) this.visited.push(j.to);
    if (j.to === 'coipa') { this.arriveYard(); return; }
    const ev = EVENTS[j.to];
    if (ev && !this.f['ev:' + j.to]) { this.f['ev:' + j.to] = true; this.openTalk(ev); }
  }
  arriveYard() {
    this.mode = 'explore'; this.place = 'yard'; this.f.atYard = true; this.resetPositions();
    this.note = 'Coipa Yard. Enzo’s gauge is humming hard.';
  }

  // ─── the end ───
  findSpring() { this.mode = 'finding'; this.findT = 0; this.f.found = true; this.face(12, 3); }
  ending(): { title: string; lines: string[]; next: string } {
    const how = this.f.peace;
    const lines: string[] = [];
    lines.push(how === 'fought' ? 'You beat the Dust Runners in the salt, and nobody was badly hurt. Tika watched from her sail-cart as the water came.'
      : how === 'share' ? 'You talked Tika round: Runners and Wardens will drink from the same spring. Nobody in Tunupa would have believed it.'
      : how === 'mast' ? 'You called Tika’s bluff about her cracked mast, and the Runners let you be without a fight.'
      : how === 'guild' ? 'The Brine Guild’s blue seal opened the yard without a fight.'
      : 'You paid Tika’s toll in water, and the yard was yours to search.');
    lines.push(`Under the old iron pump, Enzo’s gauge found a spring. Water left in the canteen: ${this.water} / ${WATER_MAX}. Skill checks passed: ${this.passed.length}.`);
    if (this.f.wardens) lines.push('The Wardens gave their word to share the new spring with Tunupa.');
    if (this.f.guild) lines.push('Parina of the Brine Guild counts you as friends.');
    return { title: 'The spring at Coipa Yard', lines, next: 'What’s next: the Brine Guild’s lagoon city, where Parina says the rains are bought and sold, and someone has been buying them all.' };
  }

  // ─── the fight ───
  startCombat() {
    const quiet = !!(this.f.tracks || this.f.unseen);
    const hero = (id: HeroId, p: [number, number]): Unit => ({ id, side: 'hero', name: HEROES[id].name, portrait: id, x: p[0], y: p[1], hp: this.hp[id], max: HEROES[id].hp, ap: HEROES[id].ap, maxAp: HEROES[id].ap, down: false, fled: false, nap: false, dir: 'br' });
    const foes = FOES.map((d): Unit => { const p = FIGHT_START[d.id as 'tika']; return { id: d.id, side: 'foe', name: d.name, portrait: d.portrait, x: p[0], y: p[1], hp: d.hp, max: d.hp, ap: d.ap, maxAp: d.ap, down: false, fled: false, nap: quiet, dir: 'fl' }; });
    const units = [hero('dora', quiet ? FIGHT_START.doraQuiet : FIGHT_START.dora), hero('enzo', quiet ? FIGHT_START.enzoQuiet : FIGHT_START.enzo), ...foes];
    this.combat = { units, order: ['dora', 'runnerA', 'enzo', 'runnerB', 'tika'], turn: 0, round: 1, mends: RULES.mendUses, quiet, over: null, log: [] };
    this.mode = 'combat'; this.events = [];
    if (quiet) this.combat.log.push('The Runners were dozing in the heat. You get the first moves.');
    this.events.push({ k: 'turn', id: 'dora' });
  }
  unit(id: string) { return this.combat?.units.find((u) => u.id === id) ?? null; }
  current(): Unit | null { const c = this.combat; return c && !c.over ? this.unit(c.order[c.turn]) : null; }
  heroTurn(): boolean { const u = this.current(); return !!u && u.side === 'hero'; }
  fightTile(x: number, y: number) { const m = MAPS.yard; return x >= 0 && y >= 0 && x < m.w && y < m.h && m.rows[y][x] === 'f'; }
  occupied(x: number, y: number, except?: Unit) { return this.combat!.units.some((u) => u !== except && !u.fled && u.x === x && u.y === y); }
  /** every tile `u` can walk to this turn, with the path there */
  reach(u: Unit = this.current()!): Map<string, [number, number][]> {
    const out = new Map<string, [number, number][]>();
    if (!u || !this.combat) return out;
    const q: { x: number; y: number; p: [number, number][] }[] = [{ x: u.x, y: u.y, p: [] }];
    const seen = new Set([`${u.x},${u.y}`]);
    while (q.length) {
      const c = q.shift()!;
      if (c.p.length) out.set(`${c.x},${c.y}`, c.p);
      if (c.p.length >= Math.floor(u.ap / RULES.move)) continue;
      for (const [dx, dy] of DIRS4) {
        const nx = c.x + dx, ny = c.y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || !this.fightTile(nx, ny) || this.occupied(nx, ny, u)) continue;
        seen.add(k); q.push({ x: nx, y: ny, p: [...c.p, [nx, ny]] });
      }
    }
    return out;
  }
  attackCost(u: Unit) { return u.id === 'dora' ? RULES.slingAp : u.id === 'enzo' ? RULES.poleAp : RULES.spearAp; }
  /** the chance (0-100) that `a` hits `t` from where they stand now; 0 if out of reach */
  hitChance(a: Unit, t: Unit): number {
    if (t.down || t.fled || a.side === t.side) return 0;
    if (a.id === 'dora') {
      const d = dist(a, t);
      if (d > RULES.slingRange + 0.01) return 0;
      return Math.max(RULES.slingMin, RULES.slingBase - RULES.slingFall * Math.max(0, Math.ceil(d) - 2));
    }
    if (cheb(a, t) > 1) return 0;
    return a.id === 'enzo' ? RULES.poleHit : this.help ? RULES.spearHitHelp : RULES.spearHit;
  }
  private roll(range: [number, number]) { return range[0] + Math.floor(this.r.next() * (range[1] - range[0] + 1)); }
  private faceUnit(u: Unit, x: number, y: number) {
    const dx = x - u.x, dy = y - u.y;
    u.dir = dx + dy >= 0 ? (dx >= dy ? 'fr' : 'fl') : (dx >= dy ? 'br' : 'bl');
  }
  /** the current hero walks to (x, y) */
  move(x: number, y: number): boolean {
    const u = this.current(); if (!u || u.side !== 'hero') return false;
    const p = this.reach(u).get(`${x},${y}`); if (!p) return false;
    this.walkUnit(u, p);
    return true;
  }
  private walkUnit(u: Unit, p: [number, number][]) {
    if (!p.length) return;
    let px = u.x, py = u.y;
    for (const [x, y] of p) { u.dir = dirOf(x - px, y - py, u.dir); px = x; py = y; }
    u.x = px; u.y = py; u.ap -= p.length * RULES.move;
    this.events.push({ k: 'move', id: u.id, path: p });
  }
  attack(targetId: string): boolean {
    const u = this.current(), t = this.unit(targetId);
    if (!u || !t || u.side !== 'hero') return false;
    return this.strike(u, t);
  }
  private strike(u: Unit, t: Unit): boolean {
    const cost = this.attackCost(u), chance = this.hitChance(u, t);
    if (u.ap < cost || chance <= 0) return false;
    u.ap -= cost; this.faceUnit(u, t.x, t.y);
    const hit = this.r.next() * 100 < chance;
    const dmg = hit ? this.roll(u.id === 'dora' ? RULES.slingDmg : u.id === 'enzo' ? RULES.poleDmg : RULES.spearDmg) : 0;
    this.events.push({ k: 'attack', id: u.id, target: t.id, hit, dmg, chance });
    if (hit) {
      t.hp = Math.max(0, t.hp - dmg);
      if (t.side === 'hero') this.hp[t.id as HeroId] = Math.max(0, t.hp);
      if (t.hp <= 0) { t.down = true; this.events.push({ k: 'down', id: t.id }); }
    }
    this.checkOver();
    return true;
  }
  canMend(target: Unit) { const u = this.current(); return !!u && u.id === 'enzo' && this.combat!.mends > 0 && u.ap >= RULES.mendAp && target.side === 'hero' && cheb(u, target) <= 1 && target.hp < target.max; }
  mend(targetId: string): boolean {
    const u = this.current(), t = this.unit(targetId);
    if (!u || !t || !this.canMend(t)) return false;
    u.ap -= RULES.mendAp; this.combat!.mends--;
    const heal = Math.min(RULES.mendHeal, t.max - t.hp);
    t.hp += heal; t.down = false; this.hp[t.id as HeroId] = t.hp;
    if (t !== u) this.faceUnit(u, t.x, t.y);
    this.events.push({ k: 'mend', id: u.id, target: t.id, heal });
    return true;
  }
  canDrink() { const u = this.current(); return !!u && u.side === 'hero' && u.ap >= RULES.drinkAp && this.water >= 1 && u.hp < u.max; }
  drink(): boolean {
    const u = this.current(); if (!u || !this.canDrink()) return false;
    u.ap -= RULES.drinkAp; this.water -= 1;
    const heal = Math.min(RULES.drinkHeal, u.max - u.hp); u.hp += heal; this.hp[u.id as HeroId] = u.hp;
    this.events.push({ k: 'drink', id: u.id, heal });
    return true;
  }
  /** end the current hero's turn (or a foe's); moves on to whoever is next and alive */
  endTurn(): boolean {
    const c = this.combat; if (!c || c.over) return false;
    for (let i = 0; i < c.order.length; i++) {
      c.turn = (c.turn + 1) % c.order.length;
      if (c.turn === 0) { c.round++; for (const u of c.units) u.nap = false; }
      const u = this.unit(c.order[c.turn])!;
      if (u.down || u.fled) continue;
      if (u.side === 'foe' && u.nap) continue;
      u.ap = u.maxAp;
      this.events.push({ k: 'turn', id: u.id });
      return true;
    }
    return true;
  }
  /** the whole of the current foe's turn: close in and jab, or back off when hurt */
  foeTurn(): boolean {
    const c = this.combat, u = this.current();
    if (!c || !u || u.side !== 'foe') return false;
    const heroes = c.units.filter((h) => h.side === 'hero' && !h.down);
    if (heroes.length) {
      const near = heroes.reduce((a, b) => (cheb(u, a) <= cheb(u, b) ? a : b));
      if (u.hp <= RULES.fleeAt) {
        // back away from the nearest hero
        let best: [number, number][] = [], bd = cheb(u, near);
        for (const p of this.reach(u).values()) { const end = p[p.length - 1], d = cheb({ x: end[0], y: end[1] }, near); if (d > bd) { bd = d; best = p; } }
        this.walkUnit(u, best);
      } else {
        if (cheb(u, near) > 1) {
          // the shortest walk to a tile next to any standing hero
          let best: [number, number][] | null = null;
          for (const p of this.reach({ ...u, ap: 99 } as Unit).values()) {
            const end = p[p.length - 1];
            if (heroes.some((h) => cheb({ x: end[0], y: end[1] }, h) <= 1) && (!best || p.length < best.length)) best = p;
          }
          if (best) this.walkUnit(u, best.slice(0, Math.floor(u.ap / RULES.move)));
          else {
            // nobody reachable: step as close as possible
            let p2: [number, number][] = [], bd = cheb(u, near);
            for (const p of this.reach(u).values()) { const end = p[p.length - 1], d = cheb({ x: end[0], y: end[1] }, near); if (d < bd) { bd = d; p2 = p; } }
            this.walkUnit(u, p2);
          }
        }
        // jab while there's AP for it (a Runner who starts next to you jabs twice)
        for (let k = 0; k < 2 && !this.combat!.over; k++) {
          const target = heroes.filter((h) => !h.down && cheb(u, h) <= 1).sort((a, b) => a.hp - b.hp)[0];
          if (!target || u.ap < RULES.spearAp) break;
          this.strike(u, target);
        }
      }
    }
    if (!c.over) this.endTurn();
    return true;
  }
  private checkOver() {
    const c = this.combat!;
    if (c.over) return;
    const foes = c.units.filter((u) => u.side === 'foe');
    const beaten = foes.filter((u) => u.down).length;
    if (foes.find((u) => u.id === 'tika')!.down || beaten >= 2) {
      for (const u of foes) if (!u.down) { u.fled = false; u.down = true; }
      this.events.push({ k: 'surrender' });
      c.over = 'won'; this.events.push({ k: 'over', result: 'won' });
    } else if (c.units.filter((u) => u.side === 'hero').every((u) => u.down)) {
      c.over = 'lost'; this.events.push({ k: 'over', result: 'lost' });
    }
  }
  /** after the fight's last animation: back to walking in the yard */
  finishCombat() {
    const c = this.combat; if (!c || !c.over) return;
    if (c.over === 'won') {
      for (const h of ['dora', 'enzo'] as HeroId[]) this.hp[h] = Math.max(1, this.unit(h)!.hp);
      this.f.fought = true; this.makePeace('fought');
      this.combat = null; this.mode = 'explore'; this.place = 'yard'; this.placeAfterFight();
      this.openTalk('tika.beaten', 'tika');
    } else {
      this.water = Math.floor(this.water / 2);
      this.hp.dora = Math.ceil(HEROES.dora.hp / 2); this.hp.enzo = Math.ceil(HEROES.enzo.hp / 2);
      this.f.lost = true; this.f.speechTried = false; this.f.mastTried = false;
      this.combat = null; this.mode = 'explore'; this.place = 'yard'; this.resetPositions();
      this.openTalk('tika.won', 'tika');
    }
  }
  private placeAfterFight() {
    const c = this.combat;
    void c;
    for (const h of ['dora', 'enzo'] as HeroId[]) {
      const p = this.party[h];
      if (!this.open(p.x, p.y, true)) { const m = MAPS.yard[h]; p.x = m[0]; p.y = m[1]; }
      p.fx = p.x; p.fy = p.y; p.t = 1; p.moving = false;
    }
  }
  /** walk the party to where the heroes stood when the fight ended */
  syncFromCombat() {
    if (!this.combat) return;
    for (const h of ['dora', 'enzo'] as HeroId[]) { const u = this.unit(h)!; const p = this.party[h]; p.x = p.fx = u.x; p.y = p.fy = u.y; p.t = 1; p.dir = u.dir; }
  }

  // ─── what to do next ───
  hint(): string {
    if (this.mode === 'combat') {
      const u = this.current();
      if (!u) return '';
      if (u.side === 'foe') return `${u.name}’s turn…`;
      const foes = this.combat!.units.filter((f) => f.side === 'foe' && !f.down);
      const can = foes.filter((f) => this.hitChance(u, f) > 0);
      if (u.ap < RULES.move && u.ap < this.attackCost(u)) return `${u.name} is out of action points. Press End Turn.`;
      if (can.length && u.ap >= this.attackCost(u)) return u.id === 'dora' ? `Click a Runner to sling a stone (${RULES.slingAp} AP). The odds show over each one.` : `Click the Runner next to you to strike with the pole (${RULES.poleAp} AP).`;
      if (u.id === 'enzo' && this.combat!.mends > 0 && this.combat!.units.some((h) => h.side === 'hero' && h.hp < h.max && cheb(u, h) <= 1) && u.ap >= RULES.mendAp) return 'Enzo can Mend a hurt friend next to him, or himself.';
      return u.id === 'dora' ? 'Click a teal tile to move closer: the sling reaches 6 tiles, and hits more often up close.' : 'Click a teal tile to walk Enzo up next to a Runner.';
    }
    if (this.mode === 'travel') return this.journey ? 'Walking… the canteen drains as you go.' : this.at === 'tunupa' ? 'Pick a route. The island way costs less water and has shade; the flat is quicker.' : 'Choose how to go on.';
    if (this.place === 'town') {
      if (!this.f.quest) return 'Talk to Grandmother Wayra by the wind pump. Click someone to walk over and talk.';
      if (!this.f.pumpTip) return 'Ask Wayra what to know before you haggle, then try Parina at her stall.';
      if (!this.f.guild && !this.f.barterTried) return 'Try haggling with Parina at her stall (Barter).';
      if (!this.f.wardens && !this.f.shareTried) return 'The Warden Captain at the well might be talked round (Speech).';
      if (this.water < 6) return 'Top up your water, then take the road at the bottom of the plaza.';
      return 'Take the road out at the bottom of the plaza to set out for Coipa Yard.';
    }
    if (this.place === 'yard') {
      if (!this.f.peace) return 'Talk to Tika by the sail-cart. Talking first can save a fight, but you can fight too.';
      return 'Walk to the old iron pump at the top right and use Enzo’s gauge.';
    }
    return '';
  }
}

/** where the Runners stand once they've let you be */
export const ASIDE: Record<string, [number, number]> = { tika: [18, 7], runnerA: [16, 9], runnerB: [18, 10] };

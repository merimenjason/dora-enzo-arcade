import { DISTRICTS, GUARDIANS, REACHES, TILE, type Marker, type Point } from './river-world.js';

export type Hero = 'dora' | 'enzo';
export type Difficulty = 'story' | 'standard' | 'expert';
export type Pose = 'idle' | 'run' | 'jump' | 'land' | 'climb' | 'hurt' | 'use' | 'brace' | 'shove' | 'wade' | 'recover' | 'victory' | 'walk' | 'reach';
export type RiverInput = Point & { use?: boolean; jump?: boolean; skill?: boolean; tag?: boolean };
export type RiverOptions = { assist: boolean; difficulty: Difficulty };
export type RiverEvent = 'gate' | 'launch' | 'moor' | 'wheel' | 'hurt' | 'jump' | 'mark' | 'stake' | 'clear' | 'tag';
type Runner = Point & { face: number; pose: Pose; poseFor: number; air: number; guard: number };
type Boat = Point & { vx: number; vy: number; aboard: boolean; passenger: boolean; dock: number };
type Foe = Point & { start: Marker; kind: number; phase: number; face: number; action: number; stunned: number; cooldown: number };
type Arena = { phase: number; since: number; primed: boolean; hold: number };
export type Save = {
  v: 1; seed: number; room: number; frontier: number; marks: string[];
  cleared: string[]; spring: boolean; springCleared: string[];
};
export const SAVE_KEY = 'river-remembers-v1';
export const DEFAULT_OPTIONS: RiverOptions = { assist: true, difficulty: 'standard' };
const ZERO = { x: 0, y: 0 };
const magnitude = (p: Point) => Math.hypot(p.x, p.y);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (from: number, to: number, ratio: number) => from + (to - from) * ratio;
const approach = (from: number, to: number, step: number) => from + Math.max(-step, Math.min(step, to - from));
const countLimit = (n: unknown, fallback: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < REACHES.length ? n : fallback;
export const newRiverSave = (seed = 3731): Save => ({ v: 1, seed: seed >>> 0 || 3731, room: 0, frontier: 0, marks: [], cleared: [], spring: false, springCleared: [] });
const reachIds = new Set(REACHES.map(room => room.id));
function ids(list: unknown): string[] {
  return Array.isArray(list) ? [...new Set(list.filter((id): id is string => typeof id === 'string' && reachIds.has(id)))].slice(0, REACHES.length) : [];
}
export function readRiverSave(raw: string | null): Save {
  const blank = newRiverSave();
  try {
    const s = JSON.parse(raw ?? 'null');
    if (!s || s.v !== 1) return blank;
    const frontier = countLimit(s.frontier, 0);
    const cleared = ids(s.cleared);
    const spring = s.spring === true && cleared.includes('spillback');
    return {
      ...blank, seed: Number.isInteger(s.seed) && s.seed > 0 && s.seed <= 0xffffffff ? s.seed : blank.seed,
      frontier, room: Math.min(frontier, countLimit(s.room, 0)), marks: ids(s.marks),
      cleared, spring, springCleared: spring ? ids(s.springCleared) : [],
    };
  } catch { return blank; }
}

const CHANNELS = 'abcd';
const FLOW: Record<string, Point> = {
  '>': { x: 1.12, y: 0 }, '<': { x: -1.12, y: 0 }, '^': { x: 0, y: -.92 }, v: { x: 0, y: .92 },
};
export type Surface = { tile: string; depth: number; flow: Point; solid: boolean; jumpable: boolean };
export type Prompt = { key: 'use' | 'tag' | 'skill' | 'jump'; text: string; at?: Point };
type Use = { mark: Marker; action: 'turn' | 'launch' | 'moor' | 'wheel' | 'exit' | 'mark' | 'stake' | 'climb' | 'weight' | 'ride'; text: string; hero?: Hero; can: boolean };
const DOCKS = 'Jmo';
const REACH_RADIUS = 27;
const GUARDIAN_BEATS = [
  { tell: 89, hit: 42, cycle: 329, arc: 'cross' },
  { tell: 75, hit: 31, cycle: 292, arc: 'line' },
  { tell: 69, hit: 50, cycle: 305, arc: 'wake' },
  { tell: 100, hit: 58, cycle: 356, arc: 'ring' },
  { tell: 61, hit: 48, cycle: 282, arc: 'line' },
  { tell: 78, hit: 65, cycle: 337, arc: 'fan' },
] as const;
export type Strike = Point & { width: number; height: number; kind: typeof GUARDIAN_BEATS[number]['arc'] };


export class RiverGame {
  readonly options: RiverOptions;
  save: Save;
  roomIndex: number;
  tick = 0;
  elapsed = 0;
  lead: Hero = 'dora';
  heroes!: Record<Hero, Runner>;
  boat!: Boat;
  foes: Foe[] = [];
  water = [0, 1, 0, 1];
  gates = [false, false];
  worked = [false, false];
  moored = false;
  wheel = false;
  weight = false;
  pinned = [false, false];
  private hitStop = 0;
  arena?: Arena;
  hearts = 5;
  invulnerable = 0;
  clear = false;
  fall = false;
  ending = false;
  useBuffer = 0;
  events: { kind: RiverEvent; x: number; y: number; tick: number }[] = [];
  private previous: RiverInput = ZERO;

  constructor(save = newRiverSave(), options = DEFAULT_OPTIONS) {
    this.save = structuredClone(save);
    this.options = { ...options };
    this.roomIndex = Math.min(save.frontier, save.room);
    this.enter(this.roomIndex);
  }

  get room() { return REACHES[this.roomIndex]; }
  get player() { return this.heroes[this.lead]; }
  get healthMax() { return this.options.difficulty === 'story' ? 7 : this.options.difficulty === 'expert' ? 4 : 5; }
  get splitHandle() { return this.save.frontier >= 14; }
  get longLine() { return this.save.frontier >= 28; }
  get boss() { return this.room.guardian ? GUARDIANS[this.room.district] : undefined; }
  get springHere() { return this.save.spring && this.roomIndex % 7 === 5; }
  get cycle() {
    const pattern = GUARDIAN_BEATS[this.room.district];
    return pattern.cycle - (this.arena?.phase ? 12 : 0) + (this.options.assist ? 24 : 0);
  }
  get beat() {
    if (!this.arena || this.arena.phase >= 2) return 'calm';
    if (!this.arena.primed) return 'guard';
    if (this.arena.hold) return 'open';
    const pattern = GUARDIAN_BEATS[this.room.district];
    const frame = (this.tick - this.arena.since) % this.cycle;
    return frame < pattern.tell ? 'tell' : frame < pattern.tell + pattern.hit ? 'strike' : 'open';
  }

  enter(index: number) {
    if (!Number.isInteger(index) || index < 0 || index > this.save.frontier || index >= REACHES.length) return false;
    this.roomIndex = index;
    this.save.room = index;
    this.tick = 0;
    this.elapsed = 0;
    this.lead = 'dora';
    const create = (mark: Marker): Runner => ({ x: mark.x, y: mark.y, face: 1, pose: 'idle', poseFor: 0, air: 0, guard: 0 });
    this.heroes = { dora: create(this.get('D')[0]), enzo: create(this.get('E')[0]) };
    const dock = this.get('J')[0];
    this.boat = { x: dock.x, y: dock.y, vx: 0, vy: 0, aboard: false, passenger: false, dock: this.room.markers.indexOf(dock) };
    this.gates = [this.springHere, false];
    this.pinned = [false, false];
    this.weight = false;
    this.hitStop = 0;
    this.worked = [false, false];
    this.water = this.springHere ? [1, 0, 0, 1] : [0, 1, 0, 1];
    this.foes = this.get('0123456789AB').map((m, i) => ({
      x: m.x, y: m.y, start: m, kind: parseInt(m.type, 12), face: 1, action: 0, stunned: 0, cooldown: 0,
      phase: (Math.imul(this.save.seed ^ (this.roomIndex + i * 31), 1664525) >>> 0) % 241,
    }));
    this.moored = this.wheel = this.clear = this.fall = this.ending = false;
    this.arena = this.room.guardian ? { phase: 0, since: 0, primed: false, hold: 0 } : undefined;
    this.hearts = this.healthMax;
    this.invulnerable = 0;
    this.useBuffer = 0;
    this.previous = ZERO;
    this.events = [];
    return true;
  }

  get(types: string) { return this.room.markers.filter(marker => types.includes(marker.type)); }
  tileAt(col: number, row: number) {
    return this.room.rows[row]?.[col] ?? '#';
  }
  surface(col: number, row: number): Surface {
    const tile = this.tileAt(col, row);
    const channel = tile === 'T' ? 1 : tile === 'V' ? 3 : CHANNELS.indexOf(tile);
    if (channel >= 0) {
      const depth = this.water[channel];
      const center = this.room.height * .53;
      const drift = this.room.district === 4 ? (channel % 2 ? -.74 : .72) : .66;
      return { tile, depth, flow: { x: drift * depth, y: Math.sign(center - row) * .26 * depth }, solid: false, jumpable: false };
    }
    if (tile in FLOW) return { tile, depth: 1, flow: FLOW[tile], solid: false, jumpable: false };
    let depth = '~@!*uw'.includes(tile) ? 1 : tile === ',' ? .25 : 0;
    let flow: Point = depth ? { x: .24, y: 0 } : ZERO;
    if (tile === '=') depth = this.water[0] > .7 ? 0 : 1;
    if (tile === ':') depth = this.water[0];
    if (tile === '!') flow = this.water[0] > .65 ? { x: 1.76, y: .12 } : { x: .36, y: .12 };
    if (tile === '@') flow = { x: row % 3 === 0 ? -.72 : .53, y: col % 2 ? .47 : -.46 };
    if (tile === '*') flow = { x: 1.32 * this.water[0], y: this.water[2] > .65 ? -.78 : .7 };
    return { tile, depth, flow, solid: tile === '#' || tile === '+', jumpable: tile === '+' };
  }

  at(p: Point) { return this.surface(Math.floor(p.x / TILE), Math.floor(p.y / TILE)); }

  private canWalk(x: number, y: number, air: number) {
    for (const offset of [{ x: -4, y: 0 }, { x: 4, y: 0 }, { x: 0, y: -4 }, { x: 0, y: 4 }]) {
      const at = this.at({ x: x + offset.x, y: y + offset.y });
      if ((at.solid && !(at.jumpable && air > 2)) || at.depth >= .48) return false;
    }
    return true;
  }
  canSail(x: number, y: number) {
    const tile = this.at({ x, y });
    return !tile.solid && tile.depth >= .48;
  }
  private move(who: Point, dx: number, dy: number, pass: (x: number, y: number) => boolean) {
    if (pass(who.x + dx, who.y)) who.x += dx;
    if (pass(who.x, who.y + dy)) who.y += dy;
  }

  private emit(kind: RiverEvent, at: Point = this.player) {
    this.events.push({ kind, x: at.x, y: at.y, tick: this.tick });
  }
  private pose(pose: Pose, ticks: number) {
    this.player.pose = pose;
    this.player.poseFor = ticks;
  }

  private wetNextTo(dock: Marker): Point | undefined {
    for (const [x, y] of [[0, TILE], [TILE, 0], [-TILE, 0], [0, -TILE], [TILE, TILE], [-TILE, TILE]]) {
      const point = { x: dock.x + x, y: dock.y + y };
      if (this.canSail(point.x, point.y)) return point;
    }
    return undefined;
  }
  get exitReady() { return this.arena ? this.arena.phase === 2 : this.wheel; }
  get feedReady() {
    return this.get('TV').every(intake => this.water[intake.type === 'T' ? 1 : 3] >= .72);
  }
  get wheelReady() {
    return this.moored && this.feedReady && (!this.get('k').length || this.weight) && this.get('gjq').every(mark => this.worked[mark.type === 'g' ? 0 : 1]);
  }
  private offer(): Use | undefined {
    const result: Use[] = [];
    const nearby = (types: string, radius = REACH_RADIUS) => this.get(types).filter(m => distance(m, this.player) <= radius);
    for (const mark of nearby('X', 21)) {
      result.push({ mark, action: 'exit', text: this.exitReady ? 'Leave this reach' : 'Restore the reach first', can: this.exitReady });
    }
    for (const mark of nearby('O', 21)) {
      result.push({ mark, action: 'wheel', text: this.wheel ? 'The wheel is turning' : this.wheelReady ? 'Set the mill wheel' : this.moored && !this.feedReady ? 'The mill intake is dry' : 'Set the gates and moor on the far bank', hero: 'enzo', can: !this.wheel && this.wheelReady });
    }
    for (const mark of nearby('gjq', 21)) {
      result.push({ mark, action: 'turn', text: 'Turn the sluice', hero: 'dora', can: true });
    }
    for (const mark of nearby('uw', this.options.assist ? 33 : 26)) {
      if (!this.arena || this.arena.phase >= 2 || mark.type !== (this.arena.phase ? 'w' : 'u')) continue;
      const can = this.arena.primed && this.water[this.arena.phase * 2] > .66 && this.beat === 'open' && this.boat.aboard;
      result.push({ mark, action: 'stake', text: can ? 'Stake the exposed guardian' : this.arena.primed ? 'Wait for the sweep to pass' : 'Dora must turn the gate for this phase', hero: 'enzo', can });
    }
    if (this.lead === 'dora' && this.get('q').length && !this.boat.aboard) {
      const dock = this.room.markers[this.boat.dock];
      if (dock && distance(dock, this.player) <= 22 && this.wetNextTo(dock)) {
        result.push({ mark: dock, action: 'ride', text: this.boat.passenger ? 'Step off the skiff' : 'Ride as a passenger', can: true });
      }
    }
    if (this.lead === 'enzo') {
      for (const mark of nearby(DOCKS, this.longLine ? 32 : 25)) {
        const moor = this.boat.aboard;
        if (moor || this.wetNextTo(mark) && (this.room.markers[this.boat.dock] === mark || mark.type === 'J')) {
          result.push({ mark, action: moor ? 'moor' : 'launch', text: moor ? 'Moor and step ashore' : 'Board the skiff', can: true });
        }
      }
    }
    if (!this.save.marks.includes(this.room.id)) {
      for (const mark of nearby('sS', 18)) {
        const can = mark.type === 's' || this.splitHandle && this.longLine;
        result.push({ mark, action: 'mark', text: can ? 'Read the water mark' : 'Return with the long line', can });
      }
    }
    for (const mark of nearby('k', 17)) {
      if (!this.weight) result.push({ mark, action: 'weight', text: 'Take the mill counterweight', hero: 'enzo', can: !this.boat.aboard });
    }
    for (const mark of nearby('H', 17)) result.push({ mark, action: 'climb', text: 'Climb the step', can: !(this.lead === 'enzo' && this.boat.aboard) });
    return result.sort((a, b) => distance(a.mark, this.player) - distance(b.mark, this.player)).find(a => a.can && (!a.hero || a.hero === this.lead)) ?? result[0];
  }

  prompt(): Prompt | undefined {
    if (this.clear || this.fall) return;
    const use = this.offer();
    if (use) {
      if (use.hero && use.hero !== this.lead) return this.options.assist ? { key: 'tag', text: `Switch to ${use.hero === 'dora' ? 'Dora' : 'Enzo'} · ${use.text}`, at: use.mark } : undefined;
      if (this.options.assist && this.splitHandle && use.action === 'turn' && this.worked[use.mark.type === 'g' ? 0 : 1] && this.tick % 220 > 135) {
        return { key: 'skill', text: 'Split handle · feed both branches', at: use.mark };
      }
      return use.can || this.options.assist ? { key: 'use', text: use.text, at: use.mark } : undefined;
    }
    if (this.options.assist && this.tick < 450 && this.roomIndex === 0) return this.lead === 'dora' ?
      { key: 'use', text: 'Walk to the copper sluice and turn it', at: this.get('g')[0] } :
      { key: 'use', text: 'Find the reed skiff at the launch', at: this.get('J')[0] };
    if (this.options.assist && this.boat.aboard && this.lead === 'enzo' && this.at(this.player).tile === '!') return { key: 'skill', text: 'Pole through the spill' };
  }

  objective() {
    if (this.arena && this.boss) {
      if (this.arena.phase === 2) return 'The water is quiet. Reach the far exit.';
      return this.arena.phase ? this.boss.second : this.boss.first;
    }
    if (this.wheel) return 'The wheel is turning. Take the far exit.';
    if (this.wheelReady) return 'Enzo can start the mill wheel.';
    if (this.moored && !this.feedReady) return 'Dora: send water back through the mill intake. Enzo: wait on the dry bank.';
    if (this.get('q').length && this.worked[0] && !this.worked[1]) {
      return this.boat.passenger ? 'Enzo: ferry Dora to the island dock.' : 'Dora: board at the launch. The island has a second gate.';
    }
    if (this.get('k').length && !this.weight && this.worked[0]) return 'Moor at the island dock and carry its counterweight to the mill.';
    if (this.get('gj').some(m => !this.worked[m.type === 'g' ? 0 : 1])) return 'Dora: work the copper gates. Enzo: take the skiff to the far bank.';
    return 'Enzo: steer to the far mooring and step ashore.';
  }

  private use() {
    const offered = this.offer();
    if (!offered?.can || offered.hero && offered.hero !== this.lead) return false;
    const { mark, action } = offered;
    if (action === 'turn') {
      const branch = mark.type === 'g' ? 0 : 1;
      this.gates[branch] = !this.gates[branch];
      this.pinned[branch] = false;
      this.worked[branch] = true;
      this.pose('shove', 20);
      if (this.arena && branch === this.arena.phase) {
        this.arena.primed = true;
        this.arena.since = this.tick;
        this.arena.hold = 0;
        this.gates[branch] = true;
      }
      this.emit('gate');
    } else if (action === 'ride') {
      this.boat.passenger = !this.boat.passenger;
      this.pose('climb', 17);
      if (this.boat.passenger) Object.assign(this.player, { x: mark.x, y: mark.y });
      this.emit('launch');
    } else if (action === 'launch') {
      const next = this.wetNextTo(mark);
      if (!next) return false;
      Object.assign(this.boat, next, { aboard: true, vx: 0, vy: 0, dock: this.room.markers.indexOf(mark) });
      Object.assign(this.player, next);
      this.pose('use', 13);
      this.emit('launch');
    } else if (action === 'moor') {
      Object.assign(this.boat, mark, { aboard: false, vx: 0, vy: 0, dock: this.room.markers.indexOf(mark) });
      Object.assign(this.player, { x: mark.x, y: mark.y });
      if (this.boat.passenger) {
        this.boat.passenger = false;
        Object.assign(this.heroes.dora, { x: mark.x, y: mark.y });
        this.heroes.dora.pose = 'climb';
        this.heroes.dora.poseFor = 17;
      }
      if (mark.type === 'm') this.moored = true;
      this.pose('climb', 17);
      this.emit('moor');
    } else if (action === 'weight') {
      this.weight = true;
      this.pose('reach', 24);
      this.emit('wheel');
    } else if (action === 'wheel') {
      this.wheel = true;
      this.pose('use', 24);
      this.emit('wheel');
    } else if (action === 'exit') {
      this.finish();
    } else if (action === 'mark') {
      this.save.marks.push(this.room.id);
      this.pose('reach', 24);
      this.emit('mark');
    } else if (action === 'climb') {
      const candidates = [{ x: mark.x, y: mark.y - TILE }, { x: mark.x + TILE, y: mark.y }, { x: mark.x - TILE, y: mark.y }];
      const to = candidates.find(p => distance(p, this.player) > 11 && this.canWalk(p.x, p.y, 0));
      if (to) Object.assign(this.player, to);
      this.pose('climb', 22);
    } else if (action === 'stake' && this.arena) {
      this.arena.phase++;
      this.arena.primed = false;
      this.arena.hold = 0;
      this.arena.since = this.tick;
      this.pose('use', 24);
      this.hitStop = 5;
      this.emit('stake');
    }
    return true;
  }

  private finish() {
    this.clear = true;
    if (this.springHere) {
      if (!this.save.springCleared.includes(this.room.id)) this.save.springCleared.push(this.room.id);
    } else {
      if (!this.save.cleared.includes(this.room.id)) this.save.cleared.push(this.room.id);
      this.save.frontier = Math.max(this.save.frontier, Math.min(REACHES.length - 1, this.roomIndex + 1));
      this.save.room = Math.min(REACHES.length - 1, this.roomIndex + 1);
      this.ending = this.roomIndex === REACHES.length - 1;
    }
    this.heroes.dora.pose = this.heroes.enzo.pose = 'victory';
    this.emit('clear');
  }

  beginSpring() {
    if (!this.save.cleared.includes('spillback')) return false;
    if (this.save.springCleared.length >= DISTRICTS.length) this.save.springCleared = [];
    this.save.spring = true;
    return this.enter(5);
  }
  advance() {
    if (!this.clear) return false;
    if (this.springHere) return this.roomIndex + 7 < REACHES.length && this.enter(this.roomIndex + 7);
    return this.roomIndex + 1 < REACHES.length && this.enter(this.roomIndex + 1);
  }

  private refreshWater() {
    for (let i = 0; i < 4; i++) {
      const open = this.gates[i >> 1];
      this.water[i] = approach(this.water[i], Number(this.pinned[i >> 1] || (i % 2 ? !open : open)), this.options.assist ? .043 : .029);
    }
    // Gates always have a dry return. If a stopped hero was on the
    // disappearing shelf, ease them onto the closest reachable dry step.
    for (const hero of ['dora', 'enzo'] as const) {
      if (this.boat.aboard && (hero === 'enzo' || this.boat.passenger)) continue;
      const runner = this.heroes[hero];
      if (this.at(runner).depth < .48) continue;
      const from = { x: Math.floor(runner.x / TILE), y: Math.floor(runner.y / TILE) };
      const choices: Point[] = [];
      for (let y = from.y - 4; y <= from.y + 4; y++) {
        for (let x = from.x - 4; x <= from.x + 4; x++) {
          const pt = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
          if (this.canWalk(pt.x, pt.y, 0)) choices.push(pt);
        }
      }
      Object.assign(runner, choices.sort((a, b) => distance(a, runner) - distance(b, runner))[0] ?? this.get(hero === 'dora' ? 'D' : 'E')[0]);
    }
    if (this.boat.aboard && !this.canSail(this.boat.x, this.boat.y)) {
      const nearby = this.get(DOCKS).sort((a, b) => distance(a, this.boat) - distance(b, this.boat))[0];
      Object.assign(this.boat, { x: nearby.x, y: nearby.y, aboard: false, dock: this.room.markers.indexOf(nearby), vx: 0, vy: 0 });
      Object.assign(this.heroes.enzo, { x: nearby.x, y: nearby.y });
      if (this.boat.passenger) Object.assign(this.heroes.dora, { x: nearby.x, y: nearby.y });
      this.boat.passenger = false;
    }
  }

  private damage() {
    if (this.invulnerable || this.player.guard || this.player.air > 0) return;
    this.invulnerable = this.options.assist ? 105 : 72;
    this.hearts--;
    this.hitStop = 3;
    this.pose('hurt', 24);
    this.emit('hurt');
    if (this.hearts <= 0) this.fall = true;
  }

  private updateFoes() {
    const hero = this.player;
    for (const foe of this.foes) {
      if (foe.cooldown) foe.cooldown--;
      if (foe.stunned) { foe.stunned--; continue; }
      const elapsed = this.tick + foe.phase;
      const t = elapsed % 192;
      const dx = hero.x - foe.x, dy = hero.y - foe.y, range = Math.hypot(dx, dy) || 1;
      const near = range < 125;
      const flow = this.at(foe).flow;
      const patrol = Math.sin(elapsed / 32);
      const toward = (speed: number) => ({ x: dx * speed / range, y: dy * speed / range });
      let force: Point = ZERO;
      foe.action = 0;
      switch (foe.kind) {
        case 0: force = { x: patrol * .72, y: .1 }; break;
        case 1: force = { x: flow.x * .42, y: patrol * .63 }; break;
        case 2: force = t > 128 ? toward(1.9) : { x: patrol * .5, y: 0 }; foe.action = t > 128 ? 3 : t > 98 ? 2 : 1; break;
        case 3: if (near && t > 125) { force = toward(2.05); foe.action = 3; } else { force = { x: patrol, y: -.2 }; foe.action = t > 100 ? 2 : 1; } break;
        case 4: if (this.boat.aboard && near) { force = toward(1.27); foe.action = 3; } else force = { x: flow.x, y: patrol * .48 }; break;
        case 5: force = t > 135 ? { x: -2.1, y: 0 } : { x: .35, y: patrol * .32 }; foe.action = t > 135 ? 3 : t > 106 ? 2 : 1; break;
        case 6: force = { x: .12, y: patrol * .75 }; if (near && t > 112 && t < 154) foe.action = 3; break;
        case 7: force = { x: .29, y: this.water[0] > .55 ? -.46 : .56 }; break;
        case 8: force = { x: Math.cos(elapsed / 22) * 1.18, y: patrol * .55 }; break;
        case 9: foe.action = t > 138 ? 3 : t > 110 ? 2 : 0; break;
        case 10: force = { x: 1.2 * flow.x + patrol, y: flow.y * 1.2 }; foe.action = 1; break;
        case 11: if (near && this.boat.aboard && t > 114) { force = toward(2.15); foe.action = 3; } else { force = { x: .6 * patrol, y: -.12 }; foe.action = t > 90 ? 2 : 1; } break;
      }
      const next = { x: foe.x + force.x, y: foe.y + force.y };
      if (distance(next, foe.start) < 57) this.move(foe, force.x, force.y, (x, y) => !this.at({ x, y }).solid);
      if (Math.abs(force.x) > .1) foe.face = Math.sign(force.x);
      const attack = foe.action === 3 || foe.kind !== 9 && foe.kind !== 6;
      const reach = foe.kind === 6 && foe.action === 3 ? 24 : 13;
      if (attack && !foe.cooldown && distance(foe, hero) < reach) {
        if (hero.guard) { foe.stunned = 108; this.emit('hurt', foe); }
        else {
          if (foe.kind === 4 && this.boat.aboard) this.boat.vx -= .85;
          if (!this.invulnerable && !hero.air) foe.cooldown = this.options.assist ? 248 : 150;
          this.damage();
        }
      }
    }
  }

  bossPosition(): Point {
    const stake = this.get(this.arena?.phase ? 'w' : 'u')[0];
    const cycle = this.arena?.primed ? this.tick - this.arena.since : 0;
    const span = this.room.district === 1 || this.room.district === 5 ? 34 : 19;
    return stake ? { x: stake.x + 38 + Math.sin(cycle / 39) * span, y: stake.y - 27 + Math.cos(cycle / 41) * 11 } : ZERO;
  }

  strike(): Strike {
    const boss = this.bossPosition();
    const kind = GUARDIAN_BEATS[this.room.district].arc;
    const far = this.arena?.phase === 1;
    if (kind === 'line') return { ...boss, x: boss.x + (far ? -16 : 16), width: 91, height: 22, kind };
    if (kind === 'wake') return { ...boss, x: boss.x + 10, y: boss.y + 11, width: 66, height: 32, kind };
    if (kind === 'ring') return { ...boss, width: 73, height: 62, kind };
    if (kind === 'fan') return { ...boss, x: boss.x + (far ? -18 : 18), y: boss.y + 9, width: 104, height: 47, kind };
    return { ...boss, y: boss.y + 12, width: 52, height: 36, kind };
  }

  private guardianHit() {
    if (!this.arena || this.beat !== 'strike' || !this.boat.aboard || this.lead !== 'enzo') return;
    const sweep = this.strike();
    const dx = (this.player.x - sweep.x) / (sweep.width * .5);
    const dy = (this.player.y - sweep.y) / (sweep.height * .5);
    const r = dx * dx + dy * dy;
    if (r > (this.options.assist ? .74 : 1) || sweep.kind === 'ring' && r < .25) return;
    if (sweep.kind === 'wake' && !this.invulnerable && !this.player.guard) this.boat.vx += this.arena.phase ? -1.2 : 1.2;
    this.damage();
  }

  step(input: RiverInput) {
    if (this.clear || this.fall) return;
    this.tick++;
    this.elapsed++;
    if (this.hitStop > 0) {
      this.hitStop--;
      if (!input.use && !input.jump && !input.tag && !input.skill) {
        this.previous = { ...input };
        return;
      }
    }
    this.events = this.events.filter(e => this.tick - e.tick < 75);
    if (this.invulnerable) this.invulnerable--;
    this.refreshWater();
    if (this.arena?.hold) this.arena.hold--;
    for (const runner of Object.values(this.heroes)) {
      if (runner.poseFor) runner.poseFor--;
      if (runner.guard) runner.guard--;
      if (runner.air && --runner.air === 0) {
        runner.pose = 'land';
        runner.poseFor = 10;
      }
    }
    const edge = (key: 'tag' | 'use' | 'jump' | 'skill') => Boolean(input[key] && !this.previous[key]);
    if (edge('tag')) {
      this.lead = this.lead === 'dora' ? 'enzo' : 'dora';
      this.useBuffer = 0;
      this.emit('tag');
    }
    const player = this.player;
    const axis = { x: Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0, y: Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0 };
    const size = Math.max(1, magnitude(axis));
    axis.x /= size;
    axis.y /= size;
    if (Math.abs(axis.x) > .07) player.face = Math.sign(axis.x);
    const sailing = this.lead === 'enzo' && this.boat.aboard;
    if (this.lead === 'dora' && this.boat.passenger) {
      if (edge('use') && !this.boat.aboard) this.use();
      this.previous = { ...input };
      return;
    }
    if (edge('skill')) {
      if (sailing) {
        const paddle = magnitude(axis) > .1 ? axis : { x: player.face, y: 0 };
        this.boat.vx += paddle.x * 1.46;
        this.boat.vy += paddle.y * 1.46;
        player.guard = 20;
      } else {
        player.guard = 47;
        const lever = this.lead === 'dora' && this.splitHandle ? this.get('gjq').find(m => distance(m, player) < 16) : undefined;
        if (lever) {
          const index = lever.type === 'g' ? 0 : 1;
          this.pinned[index] = !this.pinned[index];
          this.emit('gate');
        }
      }
      this.pose('brace', 22);
    }
    if (edge('jump') && !sailing && !player.air) {
      player.air = 26;
      this.pose('jump', 26);
      this.emit('jump');
    }
    if (sailing) {
      const flow = this.at(this.boat).flow;
      const resistance = this.options.assist ? .76 : .91;
      // In assist, letting go of the stick lets the pole hold against the
      // current. Deliberate steering still gets the full current.
      const drift = this.options.assist && magnitude(axis) < .05 ? .14 : 1;
      this.boat.vx = mix(this.boat.vx, axis.x * 2.65 + flow.x * drift, 1 - resistance);
      this.boat.vy = mix(this.boat.vy, axis.y * 2.65 + flow.y * drift, 1 - resistance);
      this.move(this.boat, this.boat.vx, this.boat.vy, (x, y) => this.canSail(x, y));
      Object.assign(player, { x: this.boat.x, y: this.boat.y });
      if (this.boat.passenger) Object.assign(this.heroes.dora, { x: this.boat.x, y: this.boat.y });
    } else {
      const speed = (this.lead === 'dora' ? 2.8 : 2.48) * (this.at(player).depth > .1 ? .77 : 1);
      this.move(player, axis.x * speed, axis.y * speed, (x, y) => this.canWalk(x, y, player.air));
    }
    if (!player.poseFor) player.pose = magnitude(axis) > .07 ? this.at(player).depth > .1 && !sailing ? 'wade' : 'run' : 'idle';
    if (edge('use')) {
      if (!this.use() && this.options.assist && this.arena?.primed && this.lead === 'enzo' && this.boat.aboard) this.useBuffer = 145;
    } else if (this.useBuffer > 0) {
      this.useBuffer--;
      if (this.beat === 'open' && this.offer()?.action === 'stake' && this.use()) this.useBuffer = 0;
    }
    if (!this.clear) this.updateFoes();
    this.guardianHit();
    this.previous = { ...input };
  }

  district() { return DISTRICTS[this.room.district]; }
}

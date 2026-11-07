// Overclock: the city. Every stage is built by a small level builder from sections (runs, gaps, steps, climbs,
// shafts, platform hops, hazards, secrets, a mini-boss arena and a boss room), so each section also writes the route a
// player (or the bot) takes through it. Tiles are 16 px; a stage is 26 rows tall with the main ground near row 19.
//
// Tiles: ' ' air, '#' solid, '=' ledge (stand on it, jump up through it), '^' spikes, '%' cracked block (a full
// charge, the Drill Dash, the Scrap Toss or the Quake Stomp breaks it), '~' deep water (a pit on foot; the hover-bike
// rides over it), and three tiles that change once another boss is rebooted (the stage's `gate` flag): 'x' a barrier
// that clears, 'o' a ledge that appears, 'w' an electric puddle that goes safe.

export const T = 16;
export const ROWS = 26;
export const GROUND = 19;

export type StageId = 'intro' | 'port' | 'signs' | 'depot' | 'arcade' | 'highway' | 'scrap' | 'observatory' | 'plant' | 'tower1' | 'tower2' | 'tower3' | 'training';
export type BossId = 'sentinel' | 'crab' | 'chameleon' | 'mole' | 'peacock' | 'heron' | 'rhino' | 'owl' | 'firefly' | 'spider' | 'serpent' | 'lumen';
export type CoreBoss = 'crab' | 'chameleon' | 'mole' | 'peacock' | 'heron' | 'rhino' | 'owl' | 'firefly';
export type Area = 'roof' | 'port' | 'signs' | 'depot' | 'arcade' | 'highway' | 'scrap' | 'observatory' | 'plant' | 'tower';
export type FoeKind = 'drone' | 'sentry' | 'bat' | 'hopper' | 'claw' | 'riot' | 'gecko' | 'grub' | 'holo' | 'jelly' | 'cube' | 'dish' | 'firefly' | 'sweeper';
export type Armour = 'helmet' | 'legs' | 'body' | 'arm';
export type ItemKind = 'heart' | 'tank' | Armour;
/** What a secret needs beyond the heroes' starting kit (Dora's climb, Enzo's full charge): a boss rebooted (the city
 *  changed), the air-dash from the leg parts, or the hover-bike. */
export type Req = { flag?: CoreBoss; legs?: boolean; bike?: boolean };
/** A step of a route. `act` tells the bot what the section needs: jump at x, dash-jump, climb a wall (Dora), break a
 *  cracked wall with a full charge (Enzo), air-dash, ride the bike, take an item, or fight. */
export type Act = 'run' | 'jump' | 'dashjump' | 'climb' | 'charge' | 'airdash' | 'bike' | 'item' | 'mini' | 'boss' | 'drop' | 'hover' | 'back';
export type Way = { x: number; y: number; act: Act; item?: string };
export type ItemSpot = { id: string; kind: ItemKind; x: number; y: number; req: Req; hint: string };
export type FoeSpot = { kind: FoeKind; x: number; y: number; big?: boolean };
export type Arena = { c0: number; c1: number; r0: number; r1: number };
export type Stage = {
  id: StageId; name: string; area: Area; boss: BossId | null; gate: CoreBoss | null; grid: string[]; w: number; h: number;
  /** a second city change in the same stage: its ledges are 'O' */
  gate2?: CoreBoss;
  spawn: { x: number; y: number }; checks: { x: number; y: number; assist: boolean }[]; items: ItemSpot[]; foes: FoeSpot[];
  pickups: { kind: 'bolt' | 'hp' | 'en'; x: number; y: number }[]; bikes: { x: number; y: number; x1: number }[];
  /** the main route, and the side trips to each item (taken at `at`, an index into `route`) */
  route: Way[]; detours: { at: number; item: string; req: Req; ways: Way[] }[];
  mini: Arena | null; arena: Arena | null; door: { c: number; r0: number; r1: number } | null;
  gravity: number; rain: boolean; dark: boolean; music: string;
  /** tower3: the refight gallery's teleporters (x, y) and the shared refight arena */
  gallery?: { pads: { x: number; y: number; boss: CoreBoss }[]; final: { x: number; y: number }; arena: Arena; lumen: Arena };
  /** short in-play prompts (key glyphs, no text walls) for the intro: the action and the x span */
  prompts: { x0: number; x1: number; action: string }[];
};

/** Builder: a grid of chars, a cursor column `x` and the ground row `g` under the route. */
class B {
  grid: string[][];
  x = 0; g = GROUND;
  route: Way[] = [];
  detours: Stage['detours'] = [];
  items: ItemSpot[] = [];
  foes: FoeSpot[] = [];
  checks: Stage['checks'] = [];
  pickups: Stage['pickups'] = [];
  bikes: Stage['bikes'] = [];
  prompts: Stage['prompts'] = [];
  mini: Arena | null = null; arena: Arena | null = null; door: Stage['door'] = null;
  gallery: Stage['gallery'];
  constructor(public w: number) { this.grid = Array.from({ length: ROWS }, () => Array(w).fill(' ')); }
  set(c: number, r: number, ch: string) { if (c >= 0 && c < this.w && r >= 0 && r < ROWS) this.grid[r][c] = ch; }
  get(c: number, r: number) { return c >= 0 && c < this.w && r >= 0 && r < ROWS ? this.grid[r][c] : '#'; }
  fill(c0: number, r0: number, c1: number, r1: number, ch: string) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, ch); }
  /** ground columns from row g to the bottom */
  ground(c0: number, n: number, g = this.g) { this.fill(c0, g, c0 + n - 1, ROWS - 1, '#'); }
  way(dx: number, act: Act = 'run', dy = 0, item?: string) { this.route.push({ x: (this.x + dx) * T + 8, y: (this.g + dy) * T, act, item }); }
  px(c: number) { return c * T + 8; }
  py(r: number) { return r * T; }
  foe(kind: FoeKind, dx: number, dy = -1, big = false) {
    const fly = kind === 'drone' || kind === 'bat' || kind === 'jelly' || kind === 'firefly';
    const hang = kind === 'claw' || kind === 'holo';
    this.foes.push({ kind, x: this.px(this.x + dx), y: hang ? this.py(this.g + dy) : fly ? this.py(this.g + dy) - 8 : this.py(this.g), big });
  }
  bolt(dx: number, dy = -1, n = 1) { for (let i = 0; i < n; i++) this.pickups.push({ kind: 'bolt', x: this.px(this.x + dx + i), y: this.py(this.g + dy) + 8 }); }
  pick(kind: 'hp' | 'en', dx: number, dy = -1) { this.pickups.push({ kind, x: this.px(this.x + dx), y: this.py(this.g + dy) + 8 }); }
  check(assist = false) { this.checks.push({ x: this.px(this.x), y: this.py(this.g), assist }); }
  item(id: string, kind: ItemKind, c: number, r: number, req: Req, hint: string) { this.items.push({ id, kind, x: this.px(c), y: this.py(r + 1), req, hint }); }

  // ─── route sections ───
  run(n: number) { this.ground(this.x, n); this.x += n; this.way(-1); return this; }
  gap(n: number, landing = 3) {
    this.way(-1, n > 4 ? 'dashjump' : 'jump');
    this.x += n; this.ground(this.x, landing); this.x += landing; this.way(-1); return this;
  }
  /** spikes across n columns, with ledges over them */
  spikes(n: number) {
    this.ground(this.x, n); for (let c = this.x; c < this.x + n; c++) this.set(c, this.g - 1, '^');
    this.way(-1, 'jump');
    for (let c = this.x + 1; c < this.x + n - 2; c += 4) this.fill(c, this.g - 3, c + 1, this.g - 3, '=');
    this.x += n; this.ground(this.x, 3); this.x += 3; this.way(-1); return this;
  }
  up(k: number, n = 4) { this.way(-1, 'jump'); this.g -= k; this.ground(this.x, n); this.x += n; this.way(-1); return this; }
  down(k: number, n = 4) { this.g += k; this.ground(this.x, n); this.x += n; this.way(-1); return this; }
  /** a wall k rows high: Dora climbs it (Enzo can't: tag) */
  climb(k: number, n = 5) { this.way(-1, 'climb'); this.g -= k; this.ground(this.x, n); this.x += n; this.way(-1); return this; }
  /** a shaft to wall-jump up (or climb): a wall over the entry and a high wall ahead, `wide` columns apart */
  shaft(k: number, wide = 3, n = 5) {
    this.ground(this.x, 3); this.x += 3;
    const c0 = this.x, g0 = this.g;
    this.ground(c0, wide, g0);
    this.fill(c0 - 2, g0 - k - 3, c0 - 1, g0 - 3, '#');
    this.x += wide; this.way(-1, 'climb');
    this.g -= k; this.ground(this.x, n); this.fill(this.x, this.g, this.x + n - 1, g0, '#'); this.x += n; this.way(-1); return this;
  }
  /** ledges over a pit: n ledges of width 3, gaps of 2 or 3 */
  hops(n: number, rise = 0) {
    let r = this.g;
    for (let i = 0; i < n; i++) {
      this.route.push({ x: this.px(this.x - 1), y: this.py(r), act: 'jump' }); this.x += 2 + (rise >= 2 ? 0 : i % 2);
      r = this.g - (i % 2 ? rise : 0);
      this.fill(this.x, r, this.x + 2, r, '='); this.fill(this.x, r + 1, this.x + 2, r + 1, '#');
      this.x += 3; this.route.push({ x: this.px(this.x - 1), y: this.py(r), act: 'run' });
    }
    this.route.push({ x: this.px(this.x - 1), y: this.py(r), act: 'jump' }); this.x += 2; this.ground(this.x, 4); this.x += 4; this.way(-1); return this;
  }
  /** a floor of electric puddles ('w' while the gate flag is unset): stepping stones over it */
  puddles(n: number) {
    this.ground(this.x, n); for (let c = this.x; c < this.x + n; c++) this.set(c, this.g - 1, 'w');
    this.way(-1, 'jump');
    for (let c = this.x + 1; c < this.x + n - 2; c += 4) this.fill(c, this.g - 3, c + 1, this.g - 3, '=');
    this.x += n; this.ground(this.x, 3); this.x += 3; this.way(-1); return this;
  }
  /** a low corridor with a ceiling 3 rows up */
  tunnel(n: number) { this.ground(this.x, n); this.fill(this.x, this.g - 8, this.x + n - 1, this.g - 3, '#'); this.x += n; this.way(-1); return this; }

  // ─── secrets ───
  private detour(item: string, req: Req, ways: Way[]) { this.detours.push({ at: this.route.length - 1, item, req, ways }); }
  /** a tall pillar beside the route with a capsule on top: Dora climbs (or the leg parts' air-dash from a ledge) */
  secretClimb(id: string, kind: ItemKind, k: number, req: Req = {}, hint = 'Climb the tall pillar') {
    const c = this.x; this.ground(c, 3); this.fill(c + 3, this.g - k, c + 5, ROWS - 1, '#');
    this.item(id, kind, c + 4, this.g - k - 1, req, hint);
    this.detour(id, req, [{ x: this.px(c + 2), y: this.py(this.g), act: 'climb' }, { x: this.px(c + 4), y: this.py(this.g - k), act: 'item', item: id }]);
    this.x += 6; this.ground(this.x, 3); this.x += 3; this.way(-1); return this;
  }
  /** a hollow block on the route with a cracked face: the route hops over its roof, and a full charge (or any
   *  block-breaking power) opens the face to the capsule inside */
  secretCrack(id: string, kind: ItemKind, req: Req = {}, hint = 'A cracked wall: a full charge breaks it') {
    const c = this.x; this.ground(c, 11);
    this.fill(c + 4, this.g - 3, c + 8, this.g - 1, '#');
    this.fill(c + 5, this.g - 2, c + 7, this.g - 1, ' ');
    this.fill(c + 4, this.g - 2, c + 4, this.g - 1, '%');
    // a ledge to hop up onto the block's roof
    this.fill(c + 1, this.g - 2, c + 3, this.g - 2, '=');
    this.item(id, kind, c + 6, this.g - 1, req, hint);
    this.detour(id, req, [{ x: this.px(c + 2), y: this.py(this.g), act: 'charge' }, { x: this.px(c + 6), y: this.py(this.g), act: 'item', item: id },
      { x: this.px(c + 2), y: this.py(this.g), act: 'back' }]);
    // the route goes over the block's roof (once the face is broken, walking in leads nowhere)
    this.x += 1; this.way(0, 'jump'); this.route.push({ x: this.px(c + 2), y: this.py(this.g - 2), act: 'jump' }, { x: this.px(c + 6), y: this.py(this.g - 3), act: 'run' }); this.x += 2; this.x += 8; this.way(-1); return this;
  }
  /** a capsule behind a barrier that clears when the gate boss is rebooted ('x') */
  secretBarrier(id: string, kind: ItemKind, flag: CoreBoss, hint: string) {
    // a sealed room the route climbs over; its door, on the far side, is the barrier
    const c = this.x; this.ground(c, 8);
    this.fill(c + 2, this.g - 6, c + 7, this.g - 6, '#'); this.fill(c + 2, this.g - 5, c + 2, this.g - 1, '#');
    this.fill(c + 7, this.g - 5, c + 7, this.g - 1, 'x');
    this.item(id, kind, c + 4, this.g - 1, { flag }, hint);
    this.x += 8; this.ground(this.x, 2); this.x += 2; this.way(-1);
    this.detour(id, { flag }, [{ x: this.px(c + 4), y: this.py(this.g), act: 'item', item: id }, { x: this.px(c + 9), y: this.py(this.g), act: 'run' }]);
    return this;
  }
  /** ledges that appear when the gate boss is rebooted ('o'), stepping up to a high capsule */
  secretLedges(id: string, kind: ItemKind, flag: CoreBoss, hint: string, tile: 'o' | 'O' = 'o') {
    // a stair of light ledges (two tiles apart, an easy hop each) up to a high capsule
    const c = this.x; this.ground(c, 16);
    const steps = [[c + 2, this.g - 2], [c + 5, this.g - 4], [c + 8, this.g - 6], [c + 11, this.g - 8]];
    for (const [sc, sr] of steps) this.fill(sc, sr, sc + 2, sr, tile);
    this.fill(c + 12, this.g - 10, c + 14, this.g - 10, '=');
    this.item(id, kind, c + 13, this.g - 11, { flag }, hint);
    this.detour(id, { flag }, [
      { x: this.px(c + 1), y: this.py(this.g), act: 'jump' },
      ...steps.map(([sc, sr]) => ({ x: this.px(sc + 1), y: this.py(sr), act: 'jump' as const })),
      { x: this.px(c + 13), y: this.py(this.g - 10), act: 'item', item: id }, { x: this.px(c + 15), y: this.py(this.g), act: 'drop' }]);
    this.x += 16; this.ground(this.x, 2); this.x += 2; this.way(-1); return this;
  }
  /** a capsule lying in a dip of electric puddles ('w', safe once the gate boss is rebooted); a ledge over it */
  secretPuddle(id: string, kind: ItemKind, flag: CoreBoss, hint: string) {
    const c = this.x; this.ground(c, 4);
    this.ground(c + 4, 8, this.g + 2); this.fill(c + 4, this.g + 1, c + 11, this.g + 1, 'w');
    this.fill(c + 5, this.g - 2, c + 8, this.g - 2, '=');
    this.ground(c + 12, 4);
    this.item(id, kind, c + 8, this.g + 1, { flag }, hint);
    this.detour(id, { flag }, [{ x: this.px(c + 8), y: this.py(this.g + 2), act: 'item', item: id }, { x: this.px(c + 13), y: this.py(this.g), act: 'jump' }]);
    this.way(3, 'jump'); this.x += 16; this.way(-1); return this;
  }
  /** a tower Dora climbs on the route; from its top, a capsule ledge floats `gap` columns away, high over the ground
   *  beyond: too far for a dash-jump or Enzo's hover, but the leg parts' air-dash reaches it */
  secretAirdash(id: string, kind: ItemKind, gap = 11, hint = 'Too far to jump from the tower: an air-dash would reach it') {
    const c = this.x; this.ground(c, 4); this.fill(c + 4, this.g - 7, c + 6, ROWS - 1, '#');
    this.way(-1, 'climb'); this.x = c + 6;
    this.route.push({ x: this.px(c + 6), y: this.py(this.g - 7), act: 'run' });
    this.ground(c + 7, gap + 8);
    this.fill(c + 7 + gap, this.g - 7, c + 9 + gap, this.g - 7, '=');
    this.item(id, kind, c + 8 + gap, this.g - 8, { legs: true }, hint);
    this.detour(id, { legs: true }, [{ x: this.px(c + 6), y: this.py(this.g - 7), act: 'airdash' }, { x: this.px(c + 8 + gap), y: this.py(this.g - 7), act: 'item', item: id },
      { x: this.px(c + 11 + gap), y: this.py(this.g), act: 'drop' }]);
    this.x = c + 7 + gap + 8; this.way(-1); return this;
  }
  /** an optional hover-bike run: a bike at the start and a long stretch of deep water ('~'), with barriers to hop on
   *  the bike and high ledges for those on foot. With an item, a block halfway along has a low tunnel under it at the
   *  waterline: the bike rides through it to the capsule; on foot, Dora climbs over the block. */
  bikeRun(n: number, id: string | null, kind: ItemKind = 'tank') {
    const c = this.x; this.ground(c, 4);
    this.bikes.push({ x: this.px(c + 1), y: this.py(this.g), x1: this.px(c + 4 + n) });
    for (let i = c + 4; i < c + 4 + n; i++) { this.fill(i, this.g, i, this.g, '~'); this.fill(i, this.g + 1, i, ROWS - 1, '~'); }
    const t0 = id ? c + 4 + Math.floor(n / 2) - 4 : -99;
    const inT = (i: number) => i >= t0 - 4 && i <= t0 + 10;
    // (no barrier to hop just before the tunnel: a hop there would land the bike on the ledges above it)
    for (let i = c + 12; i < c + 4 + n - 4; i += 11) if (!inT(i) && !(i >= t0 - 14 && i < t0)) this.fill(i, this.g - 1, i, this.g - 1, '#');
    for (let i = c + 5; i < c + 4 + n - 1; i += 5) if (!inT(i) && !inT(i + 2)) this.fill(i, this.g - 3, i + 2, this.g - 3, '=');
    if (id) {
      this.fill(t0, this.g - 8, t0 + 7, this.g - 3, '#');
      this.fill(t0 - 3, this.g - 3, t0 - 1, this.g - 3, '=');
      this.fill(t0 + 8, this.g - 3, t0 + 10, this.g - 3, '=');
      this.item(id, kind, t0 + 4, this.g - 1, { bike: true }, 'A low tunnel at the waterline: only the hover-bike fits');
    }
    this.way(0, 'bike');
    this.x = c + 4 + n; this.ground(this.x, 5); this.x += 5; this.way(-1); return this;
  }

  // ─── arenas ───
  miniArena(kind: FoeKind) {
    const c0 = this.x; this.ground(c0, 22); this.fill(c0, this.g - 12, c0 + 21, this.g - 12, '#');
    this.mini = { c0, c1: c0 + 21, r0: this.g - 11, r1: this.g - 1 };
    this.foes.push({ kind, x: this.px(c0 + 16), y: ['drone', 'bat', 'jelly', 'firefly'].includes(kind) ? this.py(this.g - 4) : ['claw', 'holo'].includes(kind) ? this.py(this.g - 10) : this.py(this.g), big: true });
    this.x += 4; this.way(0, 'mini'); this.x += 18; this.way(-1); return this;
  }
  bossRoom() {
    this.check(); this.ground(this.x, 3); this.x += 3;
    const c0 = this.x;
    this.ground(c0, 24); this.fill(c0, 0, c0 + 23, this.g - 12, '#'); this.fill(c0 + 23, 0, c0 + 23, ROWS - 1, '#');
    this.fill(c0 - 3, 0, c0 - 1, this.g - 5, '#');
    this.door = { c: c0, r0: this.g - 4, r1: this.g - 1 };
    this.arena = { c0: c0 + 1, c1: c0 + 22, r0: this.g - 11, r1: this.g - 1 };
    this.x = c0 + 2; this.way(0, 'boss'); this.x = c0 + 24; return this;
  }
  done(id: StageId, name: string, area: Area, boss: BossId | null, gate: CoreBoss | null, extra: Partial<Stage> = {}): Stage {
    // trim to what was built, with walls at both ends
    const used = Math.max(this.x + 1, ...this.grid.map((r) => { let i = r.length - 1; while (i > 0 && r[i] === ' ') i--; return i + 2; }));
    this.w = Math.min(this.w, used); this.grid = this.grid.map((r) => r.slice(0, this.w));
    this.fill(0, 0, 0, ROWS - 1, '#'); this.fill(this.w - 1, 0, this.w - 1, ROWS - 1, '#');
    const grid = this.grid.map((r) => r.join(''));
    return {
      id, name, area, boss, gate, grid, w: this.w, h: ROWS, spawn: { x: this.px(3), y: this.py(GROUND) }, checks: this.checks, items: this.items,
      foes: this.foes, pickups: this.pickups, bikes: this.bikes, route: this.route, detours: this.detours, mini: this.mini, arena: this.arena,
      door: this.door, gravity: 1, rain: false, dark: false, music: area, gallery: this.gallery, prompts: this.prompts, ...extra,
    };
  }
}

// ─── the stages ─────────────────────────────────────────────────────────────

function intro(): Stage {
  const b = new B(420);
  b.run(10); b.prompts.push({ x0: 0, x1: 10 * T, action: 'move' });
  b.prompts.push({ x0: 10 * T, x1: 24 * T, action: 'jump' });
  b.gap(3, 4); b.up(2, 6); b.foe('drone', 3, -4);
  b.prompts.push({ x0: 24 * T, x1: 40 * T, action: 'shoot' });
  b.run(8); b.foe('sentry', 5); b.bolt(2, -1, 3);
  b.prompts.push({ x0: 40 * T, x1: 56 * T, action: 'dash' });
  b.run(4); b.gap(6, 4); b.check(true); b.run(6); b.pick('hp', 3);
  b.prompts.push({ x0: 62 * T, x1: 76 * T, action: 'climb' });
  b.climb(6, 6); b.foe('drone', 3, -3);
  b.prompts.push({ x0: 76 * T, x1: 90 * T, action: 'tag' });
  b.run(4); b.down(3, 6); b.foe('sentry', 4);
  b.prompts.push({ x0: 90 * T, x1: 104 * T, action: 'charge' });
  b.run(4); b.secretCrack('intro-bolts', 'tank'); b.check(); b.run(4); b.hops(2); b.foe('bat', 2, -5);
  b.bossRoom();
  const s = b.done('intro', 'Rooftop Run', 'roof', 'sentinel', null);
  s.items = []; s.detours = [];
  // the intro's cracked alcove holds bolts, not a capsule
  return s;
}

function port(): Stage {
  const b = new B(420);
  b.run(10); b.foe('sentry', 7); b.bolt(4, -1, 3);
  b.gap(3); b.run(4); b.foe('claw', 2, -6);
  b.hops(3, 2); b.foe('drone', 0, -5);
  b.run(5); b.secretClimb('heart-port', 'heart', 7);
  b.up(2, 6); b.foe('riot', 4); b.gap(4); b.check(true); b.run(5); b.foe('claw', 3, -6);
  b.bikeRun(40, null);
  b.check(); b.miniArena('claw');
  b.run(4); b.secretPuddle('legs', 'legs', 'heron', 'Electric puddles: the rain over the port has to stop');
  b.shaft(6, 3); b.foe('drone', 2, -4); b.run(6); b.foe('riot', 4); b.check(true);
  b.down(3, 6); b.foe('sentry', 4); b.spikes(9); b.run(4);
  b.bossRoom();
  return b.done('port', 'Crane Port', 'port', 'crab', 'heron', { rain: false });
}

function signs(): Stage {
  const b = new B(420);
  b.run(10); b.foe('gecko', 6);
  b.up(3, 5); b.foe('drone', 3, -4); b.gap(4); b.run(4); b.foe('gecko', 2);
  b.shaft(7, 3); b.run(6); b.bolt(1, -1, 3); b.foe('bat', 4, -5);
  b.secretCrack('tank-signs', 'tank'); b.check(true);
  b.down(4, 6); b.foe('riot', 4); b.hops(3, 1); b.foe('drone', 1, -5);
  b.check(); b.miniArena('gecko');
  b.run(4); b.secretBarrier('heart-signs', 'heart', 'rhino', 'Scrap blocks the alley: something strong could clear it');
  b.spikes(9); b.foe('bat', 2, -6); b.climb(6, 6); b.foe('gecko', 3); b.check(true); b.run(4); b.down(4, 6); b.foe('riot', 3);
  b.gap(4); b.run(4);
  b.bossRoom();
  return b.done('signs', 'Sign District', 'signs', 'chameleon', 'rhino');
}

function depot(): Stage {
  const b = new B(420);
  b.run(8); b.tunnel(12); b.foe('grub', 6); b.foe('sentry', 10);
  b.run(4); b.gap(4); b.run(4); b.foe('grub', 2);
  b.secretCrack('body', 'body'); b.check(true);
  b.shaft(6, 3); b.run(6); b.foe('bat', 3, -5); b.hops(3); b.foe('drone', 2, -5);
  b.check(); b.miniArena('grub');
  b.run(4); b.secretLedges('heart-depot', 'heart', 'owl', 'The depot lift has no power: the dishes on the hill feed it');
  b.down(2, 6); b.foe('sweeper', 4); b.bikeRun(36, 'tank-depot');
  b.check(true); b.run(4); b.foe('grub', 3); b.climb(5, 6); b.foe('sentry', 4); b.run(4);
  b.bossRoom();
  return b.done('depot', 'Train Depot', 'depot', 'mole', 'owl');
}

function arcade(): Stage {
  const b = new B(420);
  b.run(10); b.foe('holo', 6, -6);
  b.hops(3, 2); b.foe('jelly', 1, -5); b.run(4); b.foe('hopper', 2);
  b.secretClimb('helmet', 'helmet', 8); b.check(true);
  b.up(3, 6); b.foe('holo', 3, -5); b.spikes(9); b.run(4); b.foe('hopper', 2);
  b.check(); b.miniArena('holo');
  b.run(4); b.secretLedges('heart-arcade', 'heart', 'chameleon', 'Dark sign frames: they need lighting up');
  b.shaft(7, 3); b.foe('jelly', 2, -5); b.run(5); b.check(true); b.down(4, 6); b.foe('hopper', 3); b.gap(5); b.run(4); b.foe('holo', 2, -6);
  b.bossRoom();
  return b.done('arcade', 'Light Arcade', 'arcade', 'peacock', 'chameleon');
}

function highway(): Stage {
  const b = new B(420);
  b.run(10); b.foe('sentry', 7);
  b.puddles(10); b.run(4); b.foe('drone', 2, -5);
  b.secretPuddle('heart-highway', 'heart', 'heron', 'Electric puddles: they stay live while the storm rages');
  b.check(true); b.bikeRun(50, 'tank-highway');
  b.check(); b.miniArena('sentry');
  b.run(4); b.secretLedges('tank-highway2', 'tank', 'firefly', 'Dead street lights: the power plant feeds them', 'O');
  b.gap(4); b.up(3, 5); b.foe('bat', 2, -5); b.puddles(10); b.check(true); b.run(4); b.foe('sweeper', 3); b.gap(5); b.run(4);
  b.bossRoom();
  return b.done('highway', 'Rain Highway', 'highway', 'heron', 'heron', { rain: true, gate2: 'firefly' });
}

function scrap(): Stage {
  const b = new B(420);
  b.run(10); b.foe('cube', 7);
  b.up(2, 5); b.foe('sweeper', 3); b.gap(4); b.run(5); b.foe('cube', 3);
  b.secretCrack('arm', 'arm'); b.check(true);
  b.climb(7, 6); b.foe('dish', 3); b.run(4); b.hops(3, 2); b.foe('bat', 1, -5);
  b.check(); b.miniArena('cube');
  b.run(4); b.secretBarrier('heart-scrap', 'heart', 'crab', 'A heavy scrap wall: a magnet crane could lift it');
  b.down(5, 6); b.foe('riot', 4); b.spikes(9); b.check(true); b.shaft(6, 3); b.foe('sweeper', 2); b.run(4);
  b.bossRoom();
  return b.done('scrap', 'Junk Compactor', 'scrap', 'rhino', 'crab');
}

function observatory(): Stage {
  const b = new B(420);
  b.run(10); b.foe('dish', 7);
  b.gap(5); b.run(4); b.foe('firefly', 2, -4); b.up(3, 5); b.foe('hopper', 3);
  b.secretClimb('tank-observatory', 'tank', 8); b.check(true);
  b.hops(3, 3); b.foe('drone', 1, -6); b.climb(7, 6); b.foe('dish', 3);
  b.check(); b.miniArena('dish');
  b.run(4); b.secretLedges('heart-observatory', 'heart', 'peacock', 'Empty hologram frames: a light show could fill them');
  b.gap(6); b.run(4); b.foe('jelly', 2, -5); b.check(true); b.down(4, 6); b.foe('hopper', 3); b.run(4);
  b.bossRoom();
  return b.done('observatory', 'Star Observatory', 'observatory', 'owl', 'peacock', { gravity: 0.62 });
}

function plant(): Stage {
  const b = new B(420);
  b.run(10); b.foe('firefly', 6, -4); b.foe('sentry', 9);
  b.spikes(9); b.run(4); b.foe('jelly', 2, -5); b.shaft(6, 3); b.run(5); b.foe('firefly', 3, -4);
  b.secretAirdash('tank-plant', 'tank', 10, 'Too far to jump from the tower: Dora can make it with a jump and an air-dash at the top'); b.check(true);
  b.hops(3, 2); b.foe('drone', 1, -5); b.run(4); b.foe('riot', 2);
  b.check(); b.miniArena('firefly');
  b.run(4); b.secretBarrier('heart-plant', 'heart', 'mole', 'A sealed train line: the depot’s tunnels feed it');
  b.climb(6, 6); b.foe('sweeper', 3); b.check(true); b.gap(4); b.run(4); b.foe('firefly', 2, -5); b.down(5, 6); b.run(4);
  b.bossRoom();
  return b.done('plant', 'Power Plant', 'plant', 'firefly', 'mole', { dark: true });
}

function tower1(): Stage {
  const b = new B(420);
  b.run(10); b.foe('sentry', 6); b.foe('drone', 9, -5);
  b.shaft(7, 3); b.foe('riot', 4); b.run(6); b.foe('holo', 3, -6); b.gap(5); b.run(4); b.check(true);
  b.hops(3, 2); b.foe('bat', 1, -5); b.climb(6, 6); b.foe('dish', 3); b.spikes(9); b.check(); b.run(4); b.foe('gecko', 2); b.run(4);
  b.bossRoom();
  return b.done('tower1', 'Sky Tower: Base', 'tower', 'spider', null);
}

function tower2(): Stage {
  const b = new B(420);
  b.run(10); b.foe('firefly', 5, -4); b.foe('cube', 8);
  b.puddles(10); b.run(4); b.foe('jelly', 2, -5); b.bikeRun(34, null);
  b.check(true); b.shaft(8, 3); b.foe('drone', 2, -4); b.run(5); b.hops(3, 2); b.foe('bat', 1, -5); b.check(); b.down(4, 6); b.foe('riot', 3); b.run(4);
  b.bossRoom();
  return b.done('tower2', 'Sky Tower: Spire', 'tower', 'serpent', 'heron');
}

function tower3(): Stage {
  const b = new B(420);
  b.run(10); b.foe('sweeper', 6); b.climb(6, 6); b.foe('holo', 3, -6); b.run(4); b.check();
  // the refight gallery: eight teleporter pads on a long hall
  const g0 = b.x; b.ground(g0, 36); b.fill(g0, b.g - 12, g0 + 35, b.g - 12, '#');
  const order: CoreBoss[] = ['crab', 'chameleon', 'mole', 'peacock', 'heron', 'rhino', 'owl', 'firefly'];
  const pads = order.map((boss, i) => ({ x: b.px(g0 + 3 + i * 4), y: b.py(b.g), boss }));
  const final = { x: b.px(g0 + 34), y: b.py(b.g) };
  b.x = g0 + 2; b.way(0, 'boss'); b.x = g0 + 36;
  // the refight arena and Lumen's hall, past the gallery's end wall (reached only by teleporter)
  b.fill(b.x, 0, b.x + 1, ROWS - 1, '#');
  const a0 = b.x + 2; b.ground(a0, 24); b.fill(a0, 0, a0 + 23, b.g - 12, '#'); b.fill(a0 + 24, 0, a0 + 25, ROWS - 1, '#');
  const l0 = a0 + 26; b.ground(l0, 26); b.fill(l0, 0, l0 + 25, b.g - 14, '#');
  b.fill(l0 + 2, b.g - 3, l0 + 5, b.g - 3, '='); b.fill(l0 + 9, b.g - 3, l0 + 12, b.g - 3, '=');
  b.x = l0 + 26;
  b.gallery = { pads, final, arena: { c0: a0 + 1, c1: a0 + 22, r0: b.g - 11, r1: b.g - 1 }, lumen: { c0: l0 + 1, c1: l0 + 24, r0: b.g - 13, r1: b.g - 1 } };
  b.arena = b.gallery.lumen;
  return b.done('tower3', 'Sky Tower: Crown', 'tower', 'lumen', null);
}

function training(): Stage {
  const b = new B(420);
  b.run(14); b.foe('sentry', 10); b.gap(3, 4); b.climb(5, 6); b.foe('drone', 3, -4); b.run(4); b.down(5, 8); b.foe('riot', 5);
  b.secretCrack('training-wall', 'tank'); b.run(4);
  const s = b.done('training', 'Training Room', 'roof', null, null);
  s.items = []; s.detours = [];
  return s;
}

export const STAGES: Record<StageId, Stage> = {
  intro: intro(), port: port(), signs: signs(), depot: depot(), arcade: arcade(), highway: highway(), scrap: scrap(),
  observatory: observatory(), plant: plant(), tower1: tower1(), tower2: tower2(), tower3: tower3(), training: training(),
};
export const BOSS_STAGES: StageId[] = ['port', 'signs', 'depot', 'arcade', 'highway', 'scrap', 'observatory', 'plant'];
export const CORE_BOSSES: CoreBoss[] = ['crab', 'chameleon', 'mole', 'peacock', 'heron', 'rhino', 'owl', 'firefly'];
export const STAGE_OF: Record<CoreBoss, StageId> = { crab: 'port', chameleon: 'signs', mole: 'depot', peacock: 'arcade', heron: 'highway', rhino: 'scrap', owl: 'observatory', firefly: 'plant' };
export const BOSS_NAME: Record<BossId, string> = {
  sentinel: 'Rooftop Sentinel', crab: 'Magnet Crab', chameleon: 'Neon Chameleon', mole: 'Subway Mole', peacock: 'Hologram Peacock',
  heron: 'Storm Heron', rhino: 'Scrapyard Rhino', owl: 'Satellite Owl', firefly: 'Firefly Queen', spider: 'Antenna Spider', serpent: 'Cable Serpent', lumen: 'Lumen',
};
/** Each boss's weakness: another boss's core. */
export const WEAK: Record<CoreBoss, CoreBoss> = { crab: 'heron', heron: 'rhino', rhino: 'owl', owl: 'firefly', firefly: 'peacock', peacock: 'chameleon', chameleon: 'mole', mole: 'crab' };
/** What rebooting each boss changes elsewhere in the city. */
export const CHANGES: Record<CoreBoss, { stage: StageId; text: string }[]> = {
  crab: [{ stage: 'scrap', text: 'The port’s magnet cranes swing over to the Junk Compactor and lift its scrap wall.' }],
  chameleon: [{ stage: 'arcade', text: 'The signs calm down, and the Light Arcade’s dark sign frames light up into ledges.' }],
  mole: [{ stage: 'plant', text: 'The old train line under the Power Plant is open again.' }],
  peacock: [{ stage: 'observatory', text: 'Hologram bridges shine over the Star Observatory’s gaps.' }],
  heron: [{ stage: 'highway', text: 'The rain stops: the Rain Highway’s puddles are safe now.' }, { stage: 'port', text: 'The Crane Port’s docks dry out too.' }],
  rhino: [{ stage: 'signs', text: 'The rubble blocking a Sign District alley has been shoved aside.' }],
  owl: [{ stage: 'depot', text: 'The dishes beam power to the Train Depot: its lift ledges run again.' }],
  firefly: [{ stage: 'highway', text: 'The street lights over the Rain Highway glow again, lighting ledges up high.' }],
};
export const STAGE_NAME = (id: StageId) => STAGES[id].name;
export const ALL_ITEMS: ItemSpot[] = BOSS_STAGES.flatMap((s) => STAGES[s].items.map((i) => ({ ...i, stage: s })));
export const ITEM_STAGE: Record<string, StageId> = Object.fromEntries(BOSS_STAGES.flatMap((s) => STAGES[s].items.map((i) => [i.id, s])));

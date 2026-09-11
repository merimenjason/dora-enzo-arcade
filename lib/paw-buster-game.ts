// Paw Buster X: a Mega Man X-style side-scroller. Dora blasts with a chargeable paw buster,
// Enzo slashes with a whisker saber, and the pair tag in and out. Pure and deterministic: the
// page feeds held buttons into step() at a fixed rate and reads the state back to draw it.
export const TILE = 30, ROWS = 18, VIEW_W = 960, VIEW_H = 540;
export const PHYS = { run: 170, dash: 340, dashTime: 0.4, jump: 520, wallJump: 470, kick: 0.12, gravity: 1500, maxFall: 600, slide: 110, cut: -200 };
export const HERO = { hp: 16, tank: 2, w: 20, h: 30 };
export const CHARGE = { mid: 0.55, full: 1.4 };
export const ENERGY = 28, WEAPON_COST = 2, PIT_DAMAGE = 6, SPIKE_DAMAGE = 6, TAG_TIME = 2, TAG_BONUS = 1.5, WEAKNESS = 3;

export type StageId = 'snowcap' | 'cloud' | 'caldera' | 'citadel';
export type WeaponId = 'buster' | 'frost' | 'gale' | 'ember';
export type HeroId = 'dora' | 'enzo';
export type BossKind = 'fox' | 'owl' | 'snake' | 'cougar';
export type EnemyKind = 'beetle' | 'bat' | 'turret';
export type ShotKind = 'lemon' | 'mid' | 'full' | 'frost' | 'gale' | 'ember' | 'pellet' | 'shard' | 'feather' | 'fire' | 'wave' | 'claw';
export type Input = { left: boolean; right: boolean; jump: boolean; fire: boolean; dash: boolean; swap: boolean; prev: boolean; next: boolean };
export const NO_INPUT: Input = { left: false, right: false, jump: false, fire: false, dash: false, swap: false, prev: false, next: false };

export const WEAPONS: Record<WeaponId, { name: string; from: StageId | null; color: string; detail: string }> = {
  buster: { name: 'Paw Buster', from: null, color: '#ffe27a', detail: 'Dora fires; hold to charge. Enzo swings his whisker saber, which also cuts enemy shots.' },
  frost: { name: 'Frost Shard', from: 'snowcap', color: '#9fe3ff', detail: 'A fast ice shard that pierces every enemy in a line.' },
  gale: { name: 'Gale Feather', from: 'cloud', color: '#cfeeb4', detail: 'Three feathers in a fan.' },
  ember: { name: 'Ember Coil', from: 'caldera', color: '#ff9a4a', detail: 'A fireball that drops and rolls along the ground.' },
};
export const STAGES: { id: StageId; name: string; boss: BossKind; bossName: string; weapon: WeaponId | null; weakness: WeaponId | null; blurb: string }[] = [
  { id: 'snowcap', name: 'Snowcap Ridge', boss: 'fox', bossName: 'Frost Fox', weapon: 'frost', weakness: 'ember', blurb: 'Icy ledges and a fox who never stops running.' },
  { id: 'cloud', name: 'Cloud Forest', boss: 'owl', bossName: 'Storm Owl', weapon: 'gale', weakness: 'frost', blurb: 'Misty treetops, swooping bats and a storm on silent wings.' },
  { id: 'caldera', name: 'Ember Caldera', boss: 'snake', bossName: 'Magma Snake', weapon: 'ember', weakness: 'gale', blurb: 'Lava rock, spitting turrets and a snake beneath the stone.' },
  { id: 'citadel', name: 'Cougar Citadel', boss: 'cougar', bossName: 'Cougar Kingpin', weapon: null, weakness: null, blurb: 'The final fortress. Opens once the three mavericks fall.' },
];
export const MAVERICKS: StageId[] = ['snowcap', 'cloud', 'caldera'];
const BOSS_HP: Record<BossKind, number> = { fox: 32, owl: 32, snake: 32, cougar: 44 };
const BOSS_SIZE: Record<BossKind, [number, number]> = { fox: [52, 40], owl: [46, 42], snake: [62, 24], cougar: [56, 44] };
const PATTERNS: Record<BossKind, string[]> = {
  fox: ['shards', 'dash', 'leap', 'shards', 'leap', 'dash'],
  owl: ['hover', 'swoop', 'gust', 'swoop', 'hover', 'gust'],
  snake: ['spit', 'lunge', 'burrow', 'spit', 'burrow', 'lunge'],
  cougar: ['pounce', 'claw', 'dash', 'roar', 'claw', 'pounce', 'dash'],
};

// ---------- progress ----------
export type Progress = { cleared: StageId[]; tanks: StageId[]; best: Partial<Record<StageId, number>> };
export const SAVE_KEY = 'paw-buster-x-v1';
export const freshProgress = (): Progress => ({ cleared: [], tanks: [], best: {} });
const isStage = (v: unknown): v is StageId => STAGES.some((s) => s.id === v);
export function parseProgress(raw: string | null): Progress {
  if (!raw) return freshProgress();
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || v.version !== 1 || !Array.isArray(v.cleared) || !Array.isArray(v.tanks) || typeof v.best !== 'object' || !v.best) return freshProgress();
    const best: Progress['best'] = {};
    for (const [k, t] of Object.entries(v.best)) if (isStage(k) && typeof t === 'number' && Number.isFinite(t) && t > 0) best[k] = t;
    return { cleared: [...new Set(v.cleared.filter(isStage))] as StageId[], tanks: [...new Set(v.tanks.filter((s: unknown) => isStage(s) && s !== 'citadel'))] as StageId[], best };
  } catch {
    return freshProgress();
  }
}
export const saveProgress = (p: Progress) => JSON.stringify({ version: 1, ...p });
export const unlocked = (p: Progress, id: StageId) => id !== 'citadel' || MAVERICKS.every((s) => p.cleared.includes(s));
export const weaponsFor = (p: Progress): WeaponId[] => (['buster', 'frost', 'gale', 'ember'] as WeaponId[]).filter((w) => w === 'buster' || p.cleared.includes(WEAPONS[w].from!));
export const maxHp = (p: Progress) => HERO.hp + HERO.tank * p.tanks.length;

// ---------- stage maps ----------
type Spawn = { kind: EnemyKind; x: number; y: number };
type ItemKind = 'hp' | 'ammo' | 'tank';
export type StageMap = { cols: number; tiles: Uint8Array; spawns: Spawn[]; items: { kind: ItemKind; x: number; y: number }[]; checkpoints: { x: number; y: number }[]; start: { x: number; y: number }; arena: number };
class Builder {
  cols: number[][] = [];
  spawns: Spawn[] = [];
  items: StageMap['items'] = [];
  checkpoints: StageMap['checkpoints'] = [];
  start = { x: 0, y: 0 };
  arenaCol = 0;
  h = 3;
  get x() { return this.cols.length; }
  private col(h: number, spike = false) {
    const c = Array<number>(ROWS).fill(0);
    for (let r = ROWS - h; r < ROWS; r++) c[r] = 1;
    if (spike && h > 0) c[ROWS - h] = 2;
    this.cols.push(c);
  }
  /** Ground `h` tiles tall for `n` columns. */
  run(n: number, h = this.h) { this.h = h; for (let i = 0; i < n; i++) this.col(h); return this; }
  pit(n: number) { for (let i = 0; i < n; i++) this.col(0); return this; }
  spikes(n: number) { for (let i = 0; i < n; i++) this.col(this.h, true); return this; }
  /** A floating ledge `len` wide, starting `back` columns behind the cursor, its top `height` tiles up. */
  ledge(back: number, len: number, height: number) { for (let i = 0; i < len; i++) this.cols[this.x - back + i][ROWS - height] = 1; return this; }
  private top(c: number) { const r = this.cols[c].findIndex((t) => t); return (r < 0 ? ROWS : r) * TILE; }
  private at(back: number, above: number) { const c = this.x - 1 - back; return { x: c * TILE + TILE / 2, y: this.top(c) - above * TILE }; }
  enemy(kind: EnemyKind, back = 0, above = 0) { this.spawns.push({ kind, ...this.at(back, above) }); return this; }
  item(kind: ItemKind, back = 0, above = 0) { this.items.push({ kind, ...this.at(back, above) }); return this; }
  checkpoint(back = 0) { this.checkpoints.push(this.at(back, 0)); return this; }
  begin(back: number) { this.start = this.at(back, 0); return this; }
  /** A one-screen boss room: a gate column that seals behind the heroes, 30 columns of floor and a full-height far wall. */
  arena() { this.arenaCol = this.x; this.run(31, 3); this.cols.push(Array<number>(ROWS).fill(1)); return this; }
  done(): StageMap {
    const tiles = new Uint8Array(this.x * ROWS);
    this.cols.forEach((c, i) => c.forEach((t, r) => (tiles[i * ROWS + r] = t)));
    return { cols: this.x, tiles, spawns: this.spawns, items: this.items, checkpoints: this.checkpoints, start: this.start, arena: this.arenaCol };
  }
}
// Rises of two tiles or less can be jumped; taller faces are wall-jump climbs. Plain pits are three
// tiles at most; five-tile pits need a dash jump.
const BUILDS: Record<StageId, (b: Builder) => Builder> = {
  snowcap: (b) => b.run(12, 3).begin(9).enemy('beetle', 1)
    .run(6, 5).run(5, 5).enemy('beetle', 1)
    .pit(3)
    .run(8, 5).enemy('turret', 2).item('hp', 6)
    .run(5, 7).spikes(3)
    .run(6, 7).checkpoint(4).enemy('bat', 1, 4)
    .run(8, 12).run(6, 12).enemy('beetle', 2)
    .run(4, 8).run(6, 4)
    .pit(7).ledge(5, 3, 5)
    .run(5, 4).enemy('turret', 1)
    .run(2, 10).item('tank', 1)
    .run(8, 4).enemy('beetle', 3).enemy('bat', 5, 4)
    .pit(5)
    .run(8, 4).item('hp', 5).checkpoint(2)
    .run(3, 3).arena(),
  cloud: (b) => b.run(10, 3).begin(7).enemy('bat', 1, 4)
    .pit(3).run(6, 4).enemy('beetle', 1)
    .pit(9).ledge(7, 2, 6).ledge(4, 2, 8)
    .run(6, 6).enemy('turret', 1).enemy('bat', 4, 5)
    .run(4, 8).spikes(2).run(5, 8).checkpoint(3)
    .run(3, 14).item('tank', 1)
    .run(6, 5).enemy('bat', 2, 3).enemy('bat', 5, 6)
    .pit(10).ledge(8, 2, 5).ledge(5, 2, 7).ledge(2, 2, 5)
    .run(7, 5).enemy('beetle', 2).item('ammo', 5)
    .run(5, 7).enemy('turret', 1)
    .run(6, 4).item('hp', 3).checkpoint(1)
    .run(3, 3).arena(),
  caldera: (b) => b.run(10, 4).begin(7).enemy('turret', 1)
    .spikes(3).run(5, 4).enemy('beetle', 1)
    .run(5, 6).pit(3).run(4, 6).enemy('turret', 1)
    .spikes(4).ledge(3, 2, 9)
    .run(6, 6).checkpoint(3).item('hp', 1)
    .run(3, 11).item('tank', 1)
    .run(5, 5).enemy('beetle', 2).enemy('bat', 4, 5)
    .pit(5).run(4, 5).spikes(2).run(6, 5).enemy('turret', 1)
    .run(7, 10).enemy('bat', 3, 3)
    .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
    .run(3, 3).arena(),
  citadel: (b) => b.run(10, 3).begin(7).enemy('beetle', 1)
    .run(4, 5).enemy('turret', 1).spikes(3).run(5, 5).enemy('bat', 2, 4)
    .run(6, 11).enemy('turret', 1)
    .run(4, 7).pit(5).run(5, 7).enemy('beetle', 1).checkpoint(4).item('hp', 3)
    .spikes(4).run(4, 7).enemy('bat', 1, 4)
    .pit(10).ledge(8, 2, 6).ledge(5, 2, 9).ledge(2, 2, 6)
    .run(5, 4).enemy('turret', 1).run(4, 9).run(4, 4).enemy('beetle', 1)
    .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
    .run(3, 3).arena(),
};
export function buildStage(id: StageId): StageMap { return BUILDS[id](new Builder()).done(); }

// ---------- live state ----------
export type Player = { x: number; y: number; w: number; h: number; vx: number; vy: number; face: 1 | -1; ground: boolean; slide: 0 | 1 | -1; dashT: number; airDash: boolean; kickT: number; kickDir: number; hurtT: number; invT: number; charge: number; slashT: number; slashCd: number; slashId: number; combo: number; shotCd: number; fireBuf: number; swapCd: number; tagT: number; runT: number; safe: { x: number; y: number } };
export type Shot = { x: number; y: number; vx: number; vy: number; r: number; dmg: number; kind: ShotKind; hero: boolean; life: number; pierce: boolean; hits: number[]; grav: number; weapon: WeaponId | null };
export type Enemy = { id: number; kind: EnemyKind; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; face: number; t: number; flash: number; slash: number; x0: number; y0: number; mode: 0 | 1 | 2; alive: boolean; ground: boolean };
export type Boss = { kind: BossKind; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; max: number; face: 1 | -1; move: string; t: number; cycle: number; inv: number; flinch: number; ground: boolean; hidden: boolean; tx: number; ty: number; fired: number; slash: number; deathT: number };
export type Item = { kind: ItemKind; x: number; y: number; vy: number; gone: boolean };
export type Effect = { x: number; y: number; t: number; kind: 'spark' | 'boom' | 'dust' | 'heal' };
export type State = 'ready' | 'play' | 'paused' | 'boss' | 'clearing' | 'clear' | 'lost';
type Body = { x: number; y: number; w: number; h: number };
const overlap = (a: Body, b: Body) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const ENEMY: Record<EnemyKind, { w: number; h: number; hp: number }> = { beetle: { w: 24, h: 20, hp: 3 }, bat: { w: 24, h: 18, hp: 2 }, turret: { w: 26, h: 28, hp: 4 } };

export class PawBusterGame {
  readonly stage: (typeof STAGES)[number];
  readonly map: StageMap;
  progress: Progress;
  tiles!: Uint8Array;
  state: State = 'ready';
  readyT = 0;
  introT = 0;
  endT = 0;
  time = 0;
  clock = 0;
  camX = 0;
  shake = 0;
  wind = 0;
  hero: HeroId = 'dora';
  hp: Record<HeroId, number> = { dora: 0, enzo: 0 };
  max = HERO.hp;
  weapon = 0;
  energy: Record<WeaponId, number> = { buster: ENERGY, frost: ENERGY, gale: ENERGY, ember: ENERGY };
  player!: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  shots: Shot[] = [];
  items: Item[] = [];
  effects: Effect[] = [];
  banner = { text: '', t: 0 };
  events: string[] = [];
  checkpoint = -1;
  kills = 0;
  fight = false;
  newBest = false;
  private prev: Input = { ...NO_INPUT };
  private serial = 0;

  constructor(stage: StageId, progress: Progress = freshProgress()) {
    this.stage = STAGES.find((s) => s.id === stage)!;
    this.map = buildStage(stage);
    this.progress = { cleared: [...progress.cleared], tanks: [...progress.tanks], best: { ...progress.best } };
    this.load();
  }
  get weapons() { return weaponsFor(this.progress); }
  get weaponId(): WeaponId { return this.weapons[this.weapon] ?? 'buster'; }
  get partner(): HeroId { return this.hero === 'dora' ? 'enzo' : 'dora'; }
  get victory() { return this.state === 'clear' && this.stage.id === 'citadel'; }
  get chargeLevel() { const c = this.player.charge; return c >= CHARGE.full ? 2 : c >= CHARGE.mid ? 1 : 0; }

  /** (Re)build the stage and put both heroes, at full health, at the last checkpoint reached. */
  private load() {
    this.tiles = this.map.tiles.slice();
    this.max = maxHp(this.progress);
    this.hp = { dora: this.max, enzo: this.max };
    this.hero = 'dora';
    this.energy = { buster: ENERGY, frost: ENERGY, gale: ENERGY, ember: ENERGY };
    this.enemies = this.map.spawns.map((s) => this.spawnEnemy(s.kind, s.x, s.y));
    this.items = this.map.items.filter((i) => i.kind !== 'tank' || !this.progress.tanks.includes(this.stage.id)).map((i) => ({ ...i, y: i.y - 14, vy: 0, gone: false }));
    const at = this.checkpoint >= 0 ? this.map.checkpoints[this.checkpoint] : this.map.start;
    this.player = { x: at.x - HERO.w / 2, y: at.y - HERO.h, w: HERO.w, h: HERO.h, vx: 0, vy: 0, face: 1, ground: true, slide: 0, dashT: 0, airDash: false, kickT: 0, kickDir: 0, hurtT: 0, invT: 0, charge: 0, slashT: 0, slashCd: 0, slashId: 0, combo: 0, shotCd: 0, fireBuf: 0, swapCd: 0, tagT: 0, runT: 0, safe: { x: at.x - HERO.w / 2, y: at.y - HERO.h } };
    this.boss = null;
    this.fight = false;
    this.shots = [];
    this.effects = [];
    this.wind = 0;
    this.state = 'ready';
    this.readyT = 1.2;
    this.camX = this.cameraTarget();
    this.say('READY');
  }
  retry() { if (this.state === 'lost') this.load(); }
  pause() { if (this.state === 'play' || this.state === 'boss') { this.resume = this.state; this.state = 'paused'; } else if (this.state === 'paused') this.state = this.resume; }
  private resume: State = 'play';
  private say(text: string) { this.banner = { text, t: 1.6 }; }
  private spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const d = ENEMY[kind];
    return { id: this.serial++, kind, x: x - d.w / 2, y: y - d.h, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp, face: -1, t: 0, flash: 0, slash: -1, x0: x - d.w / 2, y0: y - d.h, mode: 0, alive: true, ground: false };
  }

  // ----- world -----
  tile(c: number, r: number) {
    if (c < 0 || c >= this.map.cols) return 1;
    if (r >= ROWS) return 0;
    return this.tiles[c * ROWS + Math.max(0, r)];
  }
  solid(x: number, y: number) { return this.tile(Math.floor(x / TILE), Math.floor(y / TILE)) !== 0; }
  /** Move a box through the tile grid one axis at a time; reports what it ran into. */
  private move(b: Body, dx: number, dy: number) {
    let hitX = 0, hitY = 0, spike = false;
    if (dx) {
      b.x += dx;
      const c = Math.floor((dx > 0 ? b.x + b.w - 0.001 : b.x) / TILE);
      for (let r = Math.floor(b.y / TILE); r <= Math.floor((b.y + b.h - 0.001) / TILE); r++) {
        const t = this.tile(c, r);
        if (!t) continue;
        spike ||= t === 2;
        b.x = dx > 0 ? c * TILE - b.w : (c + 1) * TILE;
        hitX = Math.sign(dx);
        break;
      }
    }
    if (dy) {
      b.y += dy;
      const r = Math.floor((dy > 0 ? b.y + b.h - 0.001 : b.y) / TILE);
      for (let c = Math.floor(b.x / TILE); c <= Math.floor((b.x + b.w - 0.001) / TILE); c++) {
        const t = this.tile(c, r);
        if (!t) continue;
        spike ||= t === 2;
        b.y = dy > 0 ? r * TILE - b.h : (r + 1) * TILE;
        hitY = Math.sign(dy);
        break;
      }
    }
    return { hitX, hitY, spike };
  }
  private touchingWall(b: Body, side: number) {
    const c = Math.floor((side > 0 ? b.x + b.w + 1 : b.x - 1) / TILE);
    for (let r = Math.floor((b.y + 4) / TILE); r <= Math.floor((b.y + b.h - 4) / TILE); r++) if (this.tile(c, r) === 1) return true;
    return false;
  }
  private cameraTarget() {
    if (this.fight) return this.map.arena * TILE;
    const p = this.player;
    return Math.max(0, Math.min(this.map.cols * TILE - VIEW_W, p.x + p.w / 2 - VIEW_W * 0.42));
  }
  private fx(x: number, y: number, kind: Effect['kind']) { this.effects.push({ x, y, t: 0, kind }); }

  // ----- the frame -----
  step(dt: number, input: Input = NO_INPUT) {
    dt = Math.min(dt, 1 / 60);
    const edge = { ...input };
    for (const k of Object.keys(input) as (keyof Input)[]) edge[k] = input[k] && !this.prev[k];
    const released = this.prev.fire && !input.fire;
    this.prev = { ...input };
    this.clock += dt;
    this.banner.t = Math.max(0, this.banner.t - dt);
    this.shake = Math.max(0, this.shake - dt);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < 0.5);
    if (this.state === 'paused') return;
    if (this.state === 'lost' || this.state === 'clear') { this.endT += dt; return; }
    if (this.state === 'ready') { this.readyT -= dt; if (this.readyT <= 0) this.state = 'play'; }
    if (this.state === 'boss') { this.introT -= dt; if (this.introT <= 0) { this.state = 'play'; this.say('GO!'); } }
    const control = this.state === 'play';
    if (control) this.time += dt;
    this.updatePlayer(dt, control ? input : NO_INPUT, control ? edge : NO_INPUT, control && released);
    // updatePlayer can end the run.
    if ((this.state as State) === 'lost') return;
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
    this.updateItems(dt);
    this.hits();
    const target = this.cameraTarget();
    this.camX += (target - this.camX) * Math.min(1, dt * 9);
    if (Math.abs(target - this.camX) < 0.5) this.camX = target;
  }

  private updatePlayer(dt: number, input: Input, edge: Input, released: boolean) {
    const p = this.player, dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.invT = Math.max(0, p.invT - dt);
    p.shotCd = Math.max(0, p.shotCd - dt);
    p.fireBuf = Math.max(0, p.fireBuf - dt);
    p.slashCd = Math.max(0, p.slashCd - dt);
    p.slashT = Math.max(0, p.slashT - dt);
    p.swapCd = Math.max(0, p.swapCd - dt);
    p.tagT = Math.max(0, p.tagT - dt);
    if (edge.swap && p.swapCd <= 0 && this.hp[this.partner] > 0) this.swap(false);
    if (edge.next || edge.prev) {
      const n = this.weapons.length;
      if (n > 1) { this.weapon = (this.weapon + (edge.next ? 1 : n - 1)) % n; p.charge = 0; this.events.push('weapon'); this.say(WEAPONS[this.weaponId].name.toUpperCase()); }
    }
    if (p.hurtT > 0) {
      p.hurtT -= dt;
      p.vx = -p.face * 90;
    } else {
      if (edge.dash && p.ground && p.dashT <= 0) { p.dashT = PHYS.dashTime; this.events.push('dash'); this.fx(p.x + p.w / 2 - p.face * 10, p.y + p.h, 'dust'); }
      if (p.dashT > 0) { p.dashT -= dt; if (!input.dash || (dir && dir !== p.face) || !p.ground) p.dashT = 0; }
      if (p.ground) p.airDash = false;
      const speed = p.dashT > 0 || p.airDash ? PHYS.dash : PHYS.run;
      if (p.kickT > 0) { p.kickT -= dt; p.vx = p.kickDir * speed; }
      else if (p.dashT > 0) p.vx = p.face * PHYS.dash;
      else { p.vx = dir * speed; if (dir) p.face = dir as 1 | -1; }
      if (edge.jump) {
        const wall = this.touchingWall(p, 1) ? 1 : this.touchingWall(p, -1) ? -1 : 0;
        if (p.ground) { p.vy = -PHYS.jump; p.airDash = p.dashT > 0 || input.dash; p.dashT = 0; p.ground = false; this.events.push('jump'); }
        else if (wall) { p.vy = -PHYS.wallJump; p.kickT = PHYS.kick; p.kickDir = -wall; p.face = -wall as 1 | -1; p.airDash = input.dash; p.vx = p.kickDir * (p.airDash ? PHYS.dash : PHYS.run); this.events.push('jump'); this.fx(p.x + (wall > 0 ? p.w : 0), p.y + p.h / 2, 'spark'); }
      }
      if (!input.jump && p.vy < PHYS.cut && p.kickT <= 0) p.vy = PHYS.cut;
      this.attack(dt, input, edge, released);
    }
    p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.gravity * dt);
    p.slide = 0;
    if (!p.ground && dir && p.vy > 0 && p.kickT <= 0 && this.touchingWall(p, dir)) { p.vy = Math.min(p.vy, PHYS.slide); p.slide = dir as 1 | -1; p.face = -dir as 1 | -1; }
    const wind = this.wind && this.state === 'play' ? this.wind : 0;
    const hit = this.move(p, (p.vx + wind) * dt, p.vy * dt);
    if (hit.hitY > 0) { if (!p.ground && p.vy > 300) this.fx(p.x + p.w / 2, p.y + p.h, 'dust'); p.ground = true; p.vy = 0; }
    else { if (hit.hitY < 0) p.vy = 0; p.ground = hit.hitY > 0; }
    if (p.ground && !this.move({ ...p }, 0, 1).hitY) p.ground = false;
    p.runT = p.ground && p.vx ? p.runT + dt : 0;
    if (hit.spike) { this.hurt(SPIKE_DAMAGE, p.x + p.w / 2 - p.face, true); p.vy = -380; p.ground = false; }
    else if (p.ground && !this.fight) p.safe = { x: p.x, y: p.y };
    if (p.y > ROWS * TILE + 40) {
      this.hurt(PIT_DAMAGE, p.x, true, true);
      if (this.state !== 'lost') { Object.assign(p, { x: p.safe.x, y: p.safe.y, vx: 0, vy: 0, dashT: 0, kickT: 0, hurtT: 0, invT: 1.2 }); this.events.push('fall'); }
    }
    // Checkpoints and the boss door.
    const next = this.map.checkpoints[this.checkpoint + 1];
    if (next && p.x + p.w / 2 >= next.x) { this.checkpoint++; this.say('CHECKPOINT'); this.events.push('checkpoint'); }
    if (!this.fight && p.x > (this.map.arena + 1.5) * TILE) this.startFight();
  }

  private attack(dt: number, input: Input, edge: Input, released: boolean) {
    const p = this.player, w = this.weaponId, mx = p.x + p.w / 2 + p.face * 16, my = p.y + 12;
    // A press during a cooldown is buffered briefly and fires as soon as it can, so mashing never drops a shot.
    if (edge.fire) p.fireBuf = 0.2;
    if (w !== 'buster') {
      if (p.fireBuf > 0 && p.shotCd <= 0 && this.energy[w] >= WEAPON_COST) {
        p.fireBuf = 0;
        this.energy[w] -= WEAPON_COST;
        p.shotCd = 0.3;
        const shot = (vx: number, vy: number, kind: ShotKind, dmg: number, extra: Partial<Shot> = {}) => this.shots.push({ x: mx, y: my, vx, vy, r: 8, dmg, kind, hero: true, life: 2.5, pierce: false, hits: [], grav: 0, weapon: w, ...extra });
        if (w === 'frost') shot(p.face * 480, 0, 'frost', 2, { pierce: true });
        if (w === 'gale') for (const a of [-0.35, 0, 0.35]) shot(Math.cos(a) * p.face * 360, Math.sin(a) * 360, 'gale', 1.5);
        if (w === 'ember') shot(p.face * 230, -160, 'ember', 2, { grav: 900, life: 3 });
        this.events.push('special');
      }
      return;
    }
    if (this.hero === 'enzo') {
      if (p.fireBuf > 0 && p.slashCd <= 0) { p.fireBuf = 0; p.slashT = 0.16; p.slashCd = 0.3; p.slashId++; p.combo = (p.combo + 1) % 3; this.events.push('slash'); }
      return;
    }
    const lemons = this.shots.filter((s) => s.kind === 'lemon').length;
    // Fast, short-lived shots and a generous cap, so tapping as fast as you can always fires.
    if (p.fireBuf > 0 && p.shotCd <= 0 && lemons < 8) { p.fireBuf = 0; this.shots.push({ x: mx, y: my, vx: p.face * 640, vy: 0, r: 5, dmg: 1, kind: 'lemon', hero: true, life: 0.9, pierce: false, hits: [], grav: 0, weapon: 'buster' }); p.shotCd = 0.1; this.events.push('shot'); }
    if (input.fire) {
      const before = this.chargeLevel;
      p.charge += dt;
      if (this.chargeLevel > before) this.events.push(this.chargeLevel === 2 ? 'charge2' : 'charge1');
    } else if (released) {
      const lvl = this.chargeLevel;
      if (lvl) this.shots.push({ x: mx, y: my, vx: p.face * 460, vy: 0, r: lvl === 2 ? 14 : 9, dmg: lvl === 2 ? 4 : 2, kind: lvl === 2 ? 'full' : 'mid', hero: true, life: 1.6, pierce: lvl === 2, hits: [], grav: 0, weapon: 'buster' });
      if (lvl) this.events.push(lvl === 2 ? 'blast' : 'shot');
      p.charge = 0;
    }
  }

  /** Tag the partner in. A forced swap happens when the active hero is knocked out. */
  private swap(forced: boolean) {
    const p = this.player;
    this.hero = this.partner;
    p.swapCd = 0.8;
    p.tagT = forced ? 0 : TAG_TIME;
    p.charge = 0;
    p.slashT = 0;
    if (forced) { p.invT = 1.5; this.say(`${this.hero.toUpperCase()} TAGS IN`); }
    this.events.push('swap');
    this.fx(p.x + p.w / 2, p.y + p.h / 2, 'heal');
  }
  hurt(dmg: number, fromX: number, hazard = false, force = false) {
    const p = this.player;
    if (this.state === 'clearing' || this.state === 'clear' || this.state === 'lost') return;
    if (p.invT > 0 && !force) return;
    this.hp[this.hero] = Math.max(0, this.hp[this.hero] - dmg);
    p.invT = 1;
    p.hurtT = hazard ? 0 : 0.3;
    p.face = fromX > p.x + p.w / 2 ? 1 : -1;
    if (!hazard) p.vy = -220;
    p.charge = 0;
    p.dashT = 0;
    this.shake = 0.2;
    this.events.push('hurt');
    if (this.hp[this.hero] > 0) return;
    this.events.push('down');
    if (this.hp[this.partner] > 0) this.swap(true);
    else { this.state = 'lost'; this.endT = 0; this.events.push('lost'); }
  }

  // ----- enemies -----
  private awake(b: Body) { return b.x + b.w > this.camX - 60 && b.x < this.camX + VIEW_W + 60; }
  private updateEnemies(dt: number) {
    const p = this.player, px = p.x + p.w / 2, py = p.y + p.h / 2;
    for (const e of this.enemies) {
      if (!e.alive || !this.awake(e)) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if (e.kind === 'beetle') {
        e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
        const hit = this.move(e, e.face * 50 * dt, e.vy * dt);
        e.ground = hit.hitY > 0;
        if (e.ground) e.vy = 0;
        const ahead = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
        if (hit.hitX || (e.ground && !this.solid(ahead, e.y + e.h + 4))) e.face = -e.face;
        if (e.y > ROWS * TILE) e.alive = false;
      } else if (e.kind === 'bat') {
        if (e.mode === 0) {
          e.x = e.x0 + Math.sin(e.t * 1.3) * 26;
          e.y = e.y0 + Math.sin(e.t * 3) * 10;
          if (Math.abs(px - ex) < 190 && e.t > 1) { e.mode = 1; e.t = 0; const d = Math.hypot(px - ex, py - ey) || 1; e.vx = ((px - ex) / d) * 130; e.vy = ((py - ey) / d) * 130; }
        } else if (e.mode === 1) {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.t > 1.3) { e.mode = 2; e.t = 0; }
        } else {
          const dx = e.x0 - e.x, dy = e.y0 - e.y, d = Math.hypot(dx, dy);
          if (d < 4) { e.mode = 0; e.t = 0; }
          else { e.x += (dx / d) * 90 * dt; e.y += (dy / d) * 90 * dt; }
        }
        e.face = px > ex ? 1 : -1;
      } else {
        e.face = px > ex ? 1 : -1;
        if (e.t > 2.2) {
          e.t = 0;
          if (Math.abs(px - ex) < 460) { const d = Math.hypot(px - ex, py - ey) || 1; this.enemyShot(ex, e.y + 8, ((px - ex) / d) * 210, ((py - e.y - 8) / d) * 210, 'pellet', 2); this.events.push('enemy-shot'); }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }
  private enemyShot(x: number, y: number, vx: number, vy: number, kind: ShotKind, dmg: number, extra: Partial<Shot> = {}) {
    this.shots.push({ x, y, vx, vy, r: kind === 'wave' ? 10 : kind === 'claw' ? 11 : 6, dmg, kind, hero: false, life: 4, pierce: false, hits: [], grav: 0, weapon: null, ...extra });
  }
  private damageEnemy(e: Enemy, dmg: number) {
    e.hp -= dmg * (this.player.tagT > 0 ? TAG_BONUS : 1);
    e.flash = 0.12;
    this.fx(e.x + e.w / 2, e.y + e.h / 2, 'spark');
    if (e.hp > 0) { this.events.push('hit'); return; }
    e.alive = false;
    this.kills++;
    this.fx(e.x + e.w / 2, e.y + e.h / 2, 'boom');
    this.events.push('kill');
    const drop: ItemKind | null = this.kills % 5 === 0 ? 'ammo' : this.kills % 3 === 0 ? 'hp' : null;
    if (drop) this.items.push({ kind: drop, x: e.x + e.w / 2, y: e.y, vy: -160, gone: false });
  }

  // ----- boss -----
  private startFight() {
    this.fight = true;
    for (let r = 0; r < ROWS; r++) this.tiles[this.map.arena * ROWS + r] = 1;
    const kind = this.stage.boss, [w, h] = BOSS_SIZE[kind], floor = (ROWS - 3) * TILE;
    const x = (this.map.arena + 24) * TILE;
    this.boss = { kind, x, y: kind === 'owl' ? 120 : floor - h, w, h, vx: 0, vy: 0, hp: BOSS_HP[kind], max: BOSS_HP[kind], face: -1, move: 'idle', t: 0, cycle: -1, inv: 0, flinch: 0, ground: kind !== 'owl', hidden: false, tx: 0, ty: 0, fired: 0, slash: -1, deathT: 0 };
    this.enemies = [];
    this.shots = this.shots.filter((s) => s.hero);
    this.state = 'boss';
    this.introT = 2.2;
    this.player.dashT = 0;
    this.player.charge = 0;
    this.say('WARNING');
    this.events.push('warning');
  }
  private rest(b: Boss) { b.move = 'idle'; b.t = 0; b.fired = 0; b.vx = 0; }
  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    const p = this.player, px = p.x + p.w / 2, py = p.y + p.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const left = (this.map.arena + 1) * TILE, right = (this.map.arena + 31) * TILE, floor = (ROWS - 3) * TILE;
    if (this.state === 'clearing') {
      b.deathT += dt;
      if (Math.floor(b.deathT * 8) !== Math.floor((b.deathT - dt) * 8)) this.fx(b.x + ((b.deathT * 97) % b.w), b.y + ((b.deathT * 61) % b.h), 'boom');
      if (b.deathT > 2.4) this.finish();
      return;
    }
    b.inv = Math.max(0, b.inv - dt);
    const flying = b.kind === 'owl';
    const physics = () => {
      if (flying) { b.x = Math.max(left, Math.min(right - b.w, b.x + b.vx * dt)); b.y = Math.max(40, Math.min(floor - b.h, b.y + b.vy * dt)); return { hitX: b.x <= left || b.x >= right - b.w ? 1 : 0 }; }
      b.vy = Math.min(PHYS.maxFall * 1.4, b.vy + PHYS.gravity * dt);
      const hit = this.move(b, b.vx * dt, b.vy * dt);
      b.ground = hit.hitY > 0;
      if (b.ground || hit.hitY < 0) b.vy = 0;
      return hit;
    };
    if (b.flinch > 0) { b.flinch -= dt; b.vx = 0; if (flying) b.vy = 0; physics(); return; }
    if (this.state !== 'play') { b.vx = 0; physics(); return; }
    const rage = b.hp < b.max / 2 ? 1.25 : 1;
    b.t += dt * rage;
    const toward = (px > bx ? 1 : -1) as 1 | -1;
    const next = () => { const pat = PATTERNS[b.kind]; b.cycle++; b.move = pat[b.cycle % pat.length]; b.t = 0; b.fired = 0; b.face = toward; };
    const leap = (vy: number) => {
      if (b.fired === 0) { b.vy = -vy; b.vx = Math.max(-320, Math.min(320, (px - bx) / 0.85)); b.ground = false; b.fired = 1; b.t = 0.001; }
      else if (b.fired === 1 && b.ground && b.t > 0.15) {
        b.vx = 0; b.fired = 2; this.shake = 0.25; this.events.push('stomp');
        for (const s of [-1, 1]) this.enemyShot(bx, floor - 10, s * 230, 0, 'wave', 3);
        this.rest(b);
      }
    };
    const dash = () => {
      if (b.t < 0.35) { b.vx = 0; return; }
      b.vx = b.face * 380 * rage;
    };
    let hit = { hitX: 0 };
    switch (b.move) {
      case 'idle':
        b.vx = 0;
        if (flying) { b.vx = (VIEW_W / 2 + this.map.arena * TILE - bx) * 1.2; b.vy = (110 - b.y) * 2; }
        b.face = toward;
        if (b.t > 0.6) next();
        break;
      case 'dash': dash(); break;
      case 'leap': case 'pounce': leap(b.move === 'pounce' ? 680 : 620); break;
      case 'shards':
        if (b.t > 0.35 && !b.fired) { b.fired = 1; const a = Math.atan2(py - by, px - bx); for (const d of [-0.22, 0, 0.22]) this.enemyShot(bx, by, Math.cos(a + d) * 260, Math.sin(a + d) * 260, 'shard', 3); this.events.push('enemy-shot'); }
        if (b.t > 0.9) this.rest(b);
        break;
      case 'hover': {
        const mid = this.map.arena * TILE + VIEW_W / 2;
        b.vx = (mid + Math.sin(b.t * 1.6) * 300 - bx) * 3;
        b.vy = (110 - b.y) * 3;
        b.face = toward;
        if (Math.floor(b.t / 0.45) > b.fired) { b.fired++; this.enemyShot(bx, b.y + b.h, Math.max(-120, Math.min(120, (px - bx) * 0.4)), 200, 'feather', 2); }
        if (b.t > 2.6) this.rest(b);
        break;
      }
      case 'swoop':
        if (b.t < 0.45) { b.vx = 0; b.vy = 0; break; }
        if (!b.fired) { b.fired = 1; b.tx = px - b.w / 2; b.ty = Math.min(floor - b.h, py - b.h / 2); this.events.push('swoop'); }
        {
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
          if (d < 8 || b.t > 1.8) this.rest(b);
          else { b.vx = (dx / d) * 430 * rage; b.vy = (dy / d) * 430 * rage; }
        }
        break;
      case 'gust':
        b.vx = 0; b.vy = 0;
        this.wind = toward * 120;
        if ((b.t > 0.5 && b.fired === 0) || (b.t > 1.2 && b.fired === 1)) { b.fired++; this.enemyShot(bx, by, toward * 240, 0, 'feather', 2); }
        if (b.t > 2.2) { this.wind = 0; this.rest(b); }
        break;
      case 'spit':
        if (b.t > 0.3 && !b.fired) { b.fired = 1; for (const v of [140, 210, 280]) this.enemyShot(bx + b.face * 20, by - 6, b.face * v, -430, 'fire', 3, { grav: 900 }); this.events.push('enemy-shot'); }
        if (b.t > 1) this.rest(b);
        break;
      case 'lunge':
        if (b.t < 0.4) { b.vx = 0; break; }
        b.vx = b.face * 420 * rage;
        break;
      case 'burrow':
        b.vx = 0;
        if (b.t < 0.45) { b.hidden = true; b.tx = Math.max(left, Math.min(right - b.w, px - b.w / 2)); }
        else if (b.t < 1.25) b.x = b.tx;
        else if (!b.fired) { b.fired = 1; b.hidden = false; b.vy = -560; b.ground = false; this.shake = 0.2; this.events.push('stomp'); }
        else if (b.ground && b.t > 1.45) this.rest(b);
        break;
      case 'claw':
        b.vx = 0;
        if ((b.t > 0.3 && b.fired === 0) || (b.t > 0.75 && b.fired === 1)) { this.enemyShot(bx + b.face * 24, floor - (b.fired ? 62 : 14), b.face * 330, 0, 'claw', 3); b.fired++; this.events.push('slash'); }
        if (b.t > 1.2) this.rest(b);
        break;
      case 'roar':
        b.vx = 0;
        if (b.t > 0.5 && !b.fired) {
          b.fired = 1; this.shake = 0.5; this.events.push('roar');
          const bats = this.enemies.filter((e) => e.kind === 'bat').length;
          for (let i = bats; i < 2; i++) { const e = this.spawnEnemy('bat', (this.map.arena + 6 + i * 18) * TILE, 150); e.t = 1; this.enemies.push(e); }
        }
        if (b.t > 1.1) this.rest(b);
        break;
    }
    if (b.move !== 'burrow') b.hidden = false;
    hit = physics();
    if (hit.hitX && (b.move === 'dash' || b.move === 'lunge')) { b.face = -b.face as 1 | -1; this.shake = 0.15; this.rest(b); }
  }
  private damageBoss(b: Boss, dmg: number, weapon: WeaponId | null) {
    if (b.inv > 0 || b.hidden || this.state !== 'play') return false;
    const weak = weapon !== null && weapon === this.stage.weakness;
    b.hp -= dmg * (weak ? WEAKNESS : 1) * (this.player.tagT > 0 ? TAG_BONUS : 1);
    b.inv = 0.1;
    this.fx(b.x + b.w / 2, b.y + b.h / 2, 'spark');
    if (weak) { b.flinch = 0.45; this.wind = 0; this.events.push('weak'); } else this.events.push('hit');
    if (b.hp <= 0) {
      b.hp = 0; this.state = 'clearing'; b.deathT = 0; b.vx = 0; this.wind = 0;
      this.shots = []; this.enemies = [];
      this.player.invT = 99;
      this.events.push('boss-down');
    }
    return true;
  }
  private finish() {
    const id = this.stage.id;
    if (!this.progress.cleared.includes(id)) this.progress.cleared.push(id);
    const best = this.progress.best[id];
    this.newBest = best === undefined || this.time < best;
    if (this.newBest) this.progress.best[id] = Math.round(this.time * 10) / 10;
    this.state = 'clear';
    this.endT = 0;
    this.say(this.stage.weapon ? `WEAPON GET: ${WEAPONS[this.stage.weapon].name.toUpperCase()}` : 'MISSION COMPLETE');
    this.events.push('clear');
  }

  // ----- shots, items, contact -----
  private updateShots(dt: number) {
    const alive: Shot[] = [];
    for (const s of this.shots) {
      s.life -= dt;
      s.vy += s.grav * dt;
      s.x += s.vx * dt;
      if (s.life <= 0 || this.solid(s.x, s.y)) continue;
      s.y += s.vy * dt;
      if (s.kind === 'ember' && s.vy > 0 && this.solid(s.x, s.y + s.r)) { s.y = Math.floor((s.y + s.r) / TILE) * TILE - s.r; s.vy = 0; s.vx = Math.sign(s.vx) * 260; }
      else if (this.solid(s.x, s.y)) continue;
      if (s.x < this.camX - 40 || s.x > this.camX + VIEW_W + 40 || s.y > ROWS * TILE + 40 || s.y < -80) continue;
      alive.push(s);
    }
    this.shots = alive;
  }
  private updateItems(dt: number) {
    const p = this.player;
    for (const it of this.items) {
      if (it.gone) continue;
      if (it.kind !== 'tank') {
        it.vy = Math.min(PHYS.maxFall, it.vy + PHYS.gravity * dt);
        const box = { x: it.x - 7, y: it.y - 7, w: 14, h: 14 };
        const hit = this.move(box, 0, it.vy * dt);
        if (hit.hitY) it.vy = 0;
        it.y = box.y + 7;
        if (it.y > ROWS * TILE + 20) it.gone = true;
      }
      if (!overlap(p, { x: it.x - 10, y: it.y - 10, w: 20, h: 20 })) continue;
      it.gone = true;
      this.fx(it.x, it.y, 'heal');
      if (it.kind === 'hp') { this.hp[this.hero] = Math.min(this.max, this.hp[this.hero] + 6); this.events.push('pickup'); }
      if (it.kind === 'ammo') { for (const w of Object.keys(this.energy) as WeaponId[]) this.energy[w] = Math.min(ENERGY, this.energy[w] + 8); this.events.push('pickup'); }
      if (it.kind === 'tank' && !this.progress.tanks.includes(this.stage.id)) {
        this.progress.tanks.push(this.stage.id);
        this.max = maxHp(this.progress);
        this.hp.dora = Math.min(this.max, this.hp.dora + HERO.tank);
        this.hp.enzo = Math.min(this.max, this.hp.enzo + HERO.tank);
        this.say('HEART TANK · MAX HEALTH UP');
        this.events.push('tank');
      }
    }
    this.items = this.items.filter((i) => !i.gone);
  }
  /** The saber's reach: a box in front of Enzo while a swing is live. */
  get saberBox(): Body | null {
    const p = this.player;
    if (this.hero !== 'enzo' || p.slashT <= 0) return null;
    return { x: p.face > 0 ? p.x + p.w - 4 : p.x - 40, y: p.y - 8, w: 44, h: 44 };
  }
  private hits() {
    const p = this.player, saber = this.saberBox, b = this.boss;
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      const box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.hero) {
        for (const e of this.enemies) {
          if (!e.alive || s.hits.includes(e.id) || !overlap(box, e)) continue;
          s.hits.push(e.id);
          this.damageEnemy(e, s.dmg);
          if (!s.pierce) { s.life = 0; break; }
        }
        if (s.life > 0 && b && !s.hits.includes(-1) && overlap(box, b) && this.damageBoss(b, s.dmg, s.weapon)) { s.hits.push(-1); if (!s.pierce) s.life = 0; }
        else if (s.life > 0 && b && !b.hidden && b.inv > 0 && overlap(box, b) && !s.pierce && this.state === 'play') s.life = 0;
      } else {
        if (saber && s.kind !== 'wave' && overlap(box, saber)) { s.life = 0; this.fx(s.x, s.y, 'spark'); this.events.push('deflect'); continue; }
        if (overlap(box, p)) { this.hurt(s.dmg, s.x); if (s.kind !== 'wave') s.life = 0; }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    if (saber) {
      const dmg = p.combo === 2 ? 4 : 3;
      for (const e of this.enemies) if (e.alive && e.slash !== p.slashId && overlap(saber, e)) { e.slash = p.slashId; this.damageEnemy(e, dmg); }
      if (b && b.slash !== p.slashId && overlap(saber, b) && this.damageBoss(b, dmg, 'buster')) b.slash = p.slashId;
    }
    for (const e of this.enemies) if (e.alive && overlap(p, e)) this.hurt(3, e.x + e.w / 2);
    if (b && !b.hidden && this.state === 'play' && overlap(p, b)) this.hurt(4, b.x + b.w / 2);
  }

  /** One line for screen readers and tests. */
  get status() {
    const s = this.stage, hp = (h: HeroId) => `${h === 'dora' ? 'Dora' : 'Enzo'} ${Math.ceil(this.hp[h])}/${this.max}`;
    const who = this.hero === 'dora' ? 'Dora' : 'Enzo';
    const boss = this.boss ? ` · ${s.bossName} ${Math.ceil(this.boss.hp)}/${this.boss.max}` : '';
    return `${s.name} · ${who} in play · ${hp('dora')} · ${hp('enzo')} · ${WEAPONS[this.weaponId].name}${boss}`;
  }
}

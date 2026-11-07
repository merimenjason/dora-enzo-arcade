// The Sunken Bellspire: the deterministic engine. No DOM; one `step(input)` is one tick at 60 per second. Randomness
// comes from a seeded generator, so a seed and the same inputs replay a game exactly.
import {
  ROOMS, AREAS, COLS, ROWS, TILE, SCREEN_W, SCREEN_H, ABILITIES, ABILITY_ORDER, SPELLS, GEAR, START_EQUIP, FOOD, SHOP, BOSSES, MURALS,
  SCRIPTS, WATER_AREAS, SHRINE_NAMES, GUARDIANS, GUARDIAN_AREA,
  type Room, type AreaId, type Ability, type HeroId, type SpellId, type Slot, type FoodId, type BossId, type Line, type WaterArea, type Perk,
} from './bellspire-world.js';
import { BOXES, FOE_BODY } from './bellspire-art.js';
import { newBody, stepBody, support, HERO_W, HERO_H, RUN, type Body, type Env, type Caps, type BodyInput } from './bellspire-physics.js';

export * from './bellspire-world.js';
export { HERO_W, HERO_H, type Body } from './bellspire-physics.js';
export const VIEW_W = 480, VIEW_H = 270;
export const SAVE_KEY = 'bellspire-v1';

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; attack: boolean; dash: boolean; cast: boolean; tag: boolean };
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, attack: false, dash: false, cast: false, tag: false };

// ─── the map, indexed ──────────────────────────────────────────────────────

const CELLS = new Map<string, Room>();
for (const r of ROOMS) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) CELLS.set(`${r.gx + x},${r.gy + y}`, r);
export const TOTAL_CELLS = CELLS.size;
export const roomAt = (gx: number, gy: number) => CELLS.get(`${gx},${gy}`);
export const roomById = (id: string) => ROOMS.find((r) => r.id === id)!;
export const roomOfTile = (c: number, r: number) => roomAt(Math.floor(c / COLS), Math.floor(r / ROWS));
export const roomOfPoint = (x: number, y: number) => roomOfTile(Math.floor(x / TILE), Math.floor(y / TILE));
export const roomRect = (r: Room) => ({ x: r.gx * SCREEN_W, y: r.gy * SCREEN_H, w: r.w * SCREEN_W, h: r.h * SCREEN_H });

/** The character at a world tile; outside every room is stone. */
export function rawChar(c: number, r: number): string {
  const room = roomOfTile(c, r);
  if (!room) return '#';
  return room.rows[r - room.gy * ROWS]?.[c - room.gx * COLS] ?? '#';
}
export const DOOR_CHARS = 'djlkcub';
export const TERRAIN = '#=Hgx^f';
/** The tile under a placed thing is air. */
export const baseChar = (ch: string) => (TERRAIN.includes(ch) || DOOR_CHARS.includes(ch) ? ch : '.');

export type Thing = { ch: string; c: number; r: number; i: number; room: string };
export type Group = { id: string; ch: string; tiles: [number, number][]; horiz: boolean; c: number; r: number; w: number; h: number };
export type RoomInfo = { room: Room; things: Thing[]; doors: Group[]; walls: Group[]; floats: { c0: number; c1: number; r: number }[] };
const THING_CHARS = 'SMRCABOU@Titwhv' + 'FmerKIazJG';
export const FOE_CHARS: Record<string, FoeKind> = { F: 'frog', m: 'moth', e: 'eel', r: 'reed', K: 'condor', I: 'imp', a: 'shell', z: 'vizcacha', J: 'jelly', G: 'golem' };

export const INFO = new Map<string, RoomInfo>();
const GROUP_AT = new Map<string, Group>();
for (const room of ROOMS) {
  const things: Thing[] = [], doors: Group[] = [], walls: Group[] = [], floats: RoomInfo['floats'] = [];
  const count: Record<string, number> = {};
  const seen = new Set<string>();
  const c0 = room.gx * COLS, r0 = room.gy * ROWS;
  for (let y = 0; y < room.rows.length; y++) {
    const row = room.rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x], c = c0 + x, r = r0 + y;
      if (THING_CHARS.includes(ch)) { count[ch] = (count[ch] ?? 0) + 1; things.push({ ch, c, r, i: count[ch] - 1, room: room.id }); }
      if (ch === 'f' && (x === 0 || row[x - 1] !== 'f')) { let e = x; while (row[e + 1] === 'f') e++; floats.push({ c0: c, c1: c0 + e, r }); }
      if ((DOOR_CHARS.includes(ch) || ch === 'x') && !seen.has(`${c},${r}`)) {
        const tiles: [number, number][] = [];
        const stack: [number, number][] = [[x, y]];
        seen.add(`${c},${r}`);
        while (stack.length) {
          const [px, py] = stack.pop()!;
          tiles.push([c0 + px, r0 + py]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = px + dx, ny = py + dy;
            if (room.rows[ny]?.[nx] === ch && !seen.has(`${c0 + nx},${r0 + ny}`)) { seen.add(`${c0 + nx},${r0 + ny}`); stack.push([nx, ny]); }
          }
        }
        const cs = tiles.map((t) => t[0]), rs = tiles.map((t) => t[1]);
        const minC = Math.min(...cs), minR = Math.min(...rs), w = Math.max(...cs) - minC + 1, h = Math.max(...rs) - minR + 1;
        const list = ch === 'x' ? walls : doors;
        const g: Group = { id: `${room.id}:${ch}${list.length}`, ch, tiles, horiz: w > h, c: minC, r: minR, w, h };
        list.push(g);
        for (const [tc, tr] of tiles) GROUP_AT.set(`${tc},${tr}`, g);
      }
    }
  }
  INFO.set(room.id, { room, things, doors, walls, floats });
}
export const groupAt = (c: number, r: number) => GROUP_AT.get(`${c},${r}`);

/** Where one room opens into the next: every open edge tile, with the room on the other side. The wisp walks this
 * graph to point the way. */
type Link = { from: string; to: string; c: number; r: number };
const LINKS = new Map<string, Link[]>();
for (const room of ROOMS) {
  const c0 = room.gx * COLS, r0 = room.gy * ROWS, W = room.w * COLS, H = room.h * ROWS;
  const list: Link[] = [];
  const edge: [number, number, number, number][] = [];
  for (let x = 0; x < W; x++) edge.push([c0 + x, r0, 0, -1], [c0 + x, r0 + H - 1, 0, 1]);
  for (let y = 0; y < H; y++) edge.push([c0, r0 + y, -1, 0], [c0 + W - 1, r0 + y, 1, 0]);
  for (const [c, r, dx, dy] of edge) {
    if ('#^'.includes(rawChar(c, r))) continue;
    const n = roomOfTile(c + dx, r + dy);
    if (n && n.id !== room.id && !'#^'.includes(rawChar(c + dx, r + dy))) list.push({ from: room.id, to: n.id, c, r });
  }
  LINKS.set(room.id, list);
}

/** Every doorway on the map: each run of open tiles across a border between two map cells of different rooms (and
 *  the shafts up and down), with where along the edge it is (0 to 1), the room and area on the other side, and the
 *  door that holds it, if any. The maps draw these as gaps, stubs into the unknown, area-coloured entrances and locks. */
export type MapExit = { cx: number; cy: number; dx: number; dy: number; at: number; from: string; to: string; toArea: AreaId; cross: boolean; door: Group | null };
export const MAP_EXITS: MapExit[] = (() => {
  const out: MapExit[] = [];
  const open = (c: number, r: number) => !'#^'.includes(rawChar(c, r));
  for (const room of ROOMS) for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    const cx = room.gx + x, cy = room.gy + y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = roomAt(cx + dx, cy + dy);
      if (!n || n.id === room.id) continue;
      const len = dx ? ROWS : COLS;
      // the border tiles on this side and the other, along the edge
      const tile = (i: number): [number, number, number, number] => dx
        ? [cx * COLS + (dx > 0 ? COLS - 1 : 0), cy * ROWS + i, cx * COLS + (dx > 0 ? COLS : -1), cy * ROWS + i]
        : [cx * COLS + i, cy * ROWS + (dy > 0 ? ROWS - 1 : 0), cx * COLS + i, cy * ROWS + (dy > 0 ? ROWS : -1)];
      let i = 0;
      while (i < len) {
        const [a, b, c2, d2] = tile(i);
        if (!(open(a, b) && open(c2, d2))) { i++; continue; }
        const i0 = i;
        while (i < len) { const [a2, b2, c3, d3] = tile(i); if (!(open(a2, b2) && open(c3, d3))) break; i++; }
        const mid = (i0 + i - 1) / 2;
        // a door on either side, within a couple of tiles of the run
        const [mc, mr] = tile(Math.round(mid));
        const doors = [...INFO.get(room.id)!.doors, ...INFO.get(n.id)!.doors];
        const door = doors.find((d) => mc >= d.c - 2 && mc <= d.c + d.w + 1 && mr >= d.r - 2 && mr <= d.r + d.h + 1 && d.ch !== 'b') ?? null;
        out.push({ cx, cy, dx, dy, at: (mid + 0.5) / len, from: room.id, to: n.id, toArea: n.area, cross: n.area !== room.area, door });
      }
    }
  }
  return out;
})();

/** Everything counted for 100%: map cells, chests, pedestals, murals and bosses. */
export const COMPLETION = (() => {
  let chests = 0, pedestals = 0;
  for (const info of INFO.values()) for (const t of info.things) { if (t.ch === 'C') chests++; if (t.ch === 'A') pedestals++; }
  return { cells: TOTAL_CELLS, chests, pedestals, murals: MURALS.length, bosses: Object.keys(BOSSES).length };
})();

export function surfaceRow(room: Room, water: Record<WaterArea, 0 | 1>): number | null {
  if (!room.water) return null;
  const lvl = (WATER_AREAS as string[]).includes(room.area) ? water[room.area as WaterArea] : 0;
  return room.water[lvl];
}
export const surfaceY = (room: Room, row: number) => (room.gy * ROWS + row) * TILE + 8;

// ─── heroes, gear and levels ───────────────────────────────────────────────

export const xpToNext = (level: number) => Math.round(18 * level ** 1.55);
export const BASE: Record<HeroId, { hp: number; hpL: number; mp: number; mpL: number; atk: number; atkL: number; mag: number; magL: number }> = {
  dora: { hp: 40, hpL: 6, mp: 12, mpL: 2, atk: 6, atkL: 1.3, mag: 3, magL: 0.6 },
  enzo: { hp: 34, hpL: 5, mp: 20, mpL: 3, atk: 6, atkL: 1.2, mag: 7, magL: 1.5 },
};
export const HEART_HP = 6, DROP_MP = 3;
export type Equip = Record<Slot, string | null>;
export type HeroSave = { level: number; xp: number; hp: number; mp: number; down: boolean };
export type Save = {
  v: 1; shrine: string; heroes: Record<HeroId, HeroSave>; abilities: Ability[]; spells: SpellId[];
  food: Record<FoodId, number>; coins: number; gear: string[]; equip: Record<HeroId, Equip>;
  flags: string[]; water: Record<WaterArea, 0 | 1>; seen: string[]; hearts: number; drops: number;
  drop: { x: number; y: number; coins: number } | null; time: number; lead: HeroId;
};

export function freshSave(): Save {
  return {
    v: 1, shrine: 'landing', lead: 'dora',
    heroes: { dora: { level: 1, xp: 0, hp: 40, mp: 12, down: false }, enzo: { level: 1, xp: 0, hp: 34, mp: 20, down: false } },
    abilities: [], spells: ['whirl', 'bolt'], food: { cake: 2, tea: 1 }, coins: 0,
    gear: ['bronze-sword', 'oak-staff', 'teal-coat', 'rust-coat'], equip: { dora: { ...START_EQUIP.dora }, enzo: { ...START_EQUIP.enzo } },
    flags: [], water: { halls: 1, docks: 0, throne: 1 }, seen: [], hearts: 0, drops: 0, drop: null, time: 0,
  };
}

/** Reads a stored save; anything malformed starts fresh (null). */
export function parseSave(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Save;
    const base = freshSave();
    if (!s || s.v !== 1 || typeof s.shrine !== 'string' || !ROOMS.some((r) => r.id === s.shrine)) return null;
    for (const h of ['dora', 'enzo'] as HeroId[]) {
      const x = s.heroes?.[h];
      if (!x || ![x.level, x.xp, x.hp, x.mp].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null;
    }
    if (!Array.isArray(s.abilities) || !s.abilities.every((a) => a in ABILITIES)) return null;
    if (!Array.isArray(s.spells) || !s.spells.every((a) => a in SPELLS)) return null;
    if (!Array.isArray(s.gear) || !s.gear.every((g) => g in GEAR)) return null;
    if (!Array.isArray(s.flags) || !Array.isArray(s.seen)) return null;
    if (typeof s.coins !== 'number' || !s.food || typeof s.food.cake !== 'number' || typeof s.food.tea !== 'number') return null;
    for (const h of ['dora', 'enzo'] as HeroId[]) for (const slot of ['weapon', 'coat', 'ring', 'relic'] as Slot[]) {
      const id = s.equip?.[h]?.[slot];
      if (id !== null && (typeof id !== 'string' || !s.gear.includes(id) || GEAR[id].slot !== slot)) return null;
    }
    for (const a of WATER_AREAS) if (s.water?.[a] !== 0 && s.water?.[a] !== 1) return null;
    return { ...base, ...s, lead: s.lead === 'enzo' ? 'enzo' : 'dora' };
  } catch { return null; }
}

export function heroStats(save: Save, hero: HeroId) {
  const b = BASE[hero], lv = save.heroes[hero].level - 1;
  let atk = b.atk + b.atkL * lv, def = 0, mag = b.mag + b.magL * lv;
  let hp = b.hp + b.hpL * lv + save.hearts * HEART_HP, mp = b.mp + b.mpL * lv + save.drops * DROP_MP;
  const perks: Perk[] = [];
  for (const id of Object.values(save.equip[hero])) {
    if (!id) continue;
    const g = GEAR[id];
    atk += g.atk ?? 0; def += g.def ?? 0; mag += g.mag ?? 0; hp += g.hp ?? 0; mp += g.mp ?? 0;
    if (g.perk) perks.push(g.perk);
  }
  return { atk: Math.round(atk), def, mag: Math.round(mag), maxHp: Math.round(hp), maxMp: Math.round(mp), perks };
}

// ─── enemies ───────────────────────────────────────────────────────────────

export type FoeKind = 'frog' | 'moth' | 'eel' | 'reed' | 'condor' | 'imp' | 'shell' | 'vizcacha' | 'jelly' | 'golem';
export const FOES: Record<FoeKind, { name: string; hp: number; atk: number; xp: number; coins: number; w: number; h: number; fly?: boolean; swim?: boolean; light?: [number, number, number, number] }> = {
  frog: { name: 'Stone Lake-Frog', hp: 16, atk: 5, xp: 6, coins: 3, w: 22, h: 16 },
  moth: { name: 'Lantern Moth', hp: 5, atk: 3, xp: 3, coins: 1, w: 12, h: 10, fly: true, light: [1, 0.62, 0.25, 46] },
  eel: { name: 'Eel Serpent', hp: 10, atk: 4, xp: 5, coins: 2, w: 26, h: 8, swim: true },
  reed: { name: 'Reed-Boat Sentinel', hp: 18, atk: 5, xp: 8, coins: 3, w: 14, h: 24 },
  condor: { name: 'Condor Knight', hp: 22, atk: 6, xp: 12, coins: 4, w: 18, h: 24, fly: true },
  imp: { name: 'Bell Imp', hp: 9, atk: 4, xp: 6, coins: 2, w: 12, h: 14 },
  shell: { name: 'Drowned Armour Shell', hp: 30, atk: 6, xp: 14, coins: 5, w: 18, h: 24 },
  vizcacha: { name: 'Mud Vizcacha', hp: 10, atk: 4, xp: 6, coins: 2, w: 14, h: 14 },
  jelly: { name: 'Glow Jelly', hp: 8, atk: 4, xp: 5, coins: 2, w: 14, h: 14, fly: true, light: [0.3, 1, 0.9, 40] },
  golem: { name: 'Salt Golem', hp: 50, atk: 8, xp: 25, coins: 8, w: 26, h: 32 },
};
/** A guardian's box from its painted frame (the frame the scene shows for its state: rest, wind-up, attack or calm),
 *  drawn from (ax, ay) and mirrored when flipped, scaled by k about the frame's centre. */
export function bossArtBox(b: { st: string; calm: boolean }, sheet: string, ax: number, ay: number, flip: boolean, k: number): Rect {
  const atk = /hop|tongue|pounce|dash|leap|swing|drop|sweep/.test(b.st) && !b.st.endsWith('Tell');
  const fr = b.calm ? 5 : b.st.endsWith('Tell') ? 1 : atk ? 2 : 0;
  const [x0, y0, x1, y1] = BOXES[sheet][fr];
  const l = flip ? -x1 : x0, r = flip ? -x0 : x1, w = (r - l) * k, h = (y1 - y0) * k;
  return { x: ax + (l + r) / 2 - w / 2, y: ay + (y0 + y1) / 2 - h / 2, w, h };
}

/** Which of a foe's 8 frames shows now (idle x2, move x4, wind-up, attack): worked out here from the game clock, so
 *  the scene draws exactly the frame its hitbox was taken from. */
export function foeFrame(e: { kind: FoeKind; id: number; st: string; vx: number; vy: number; ground: boolean }, tick: number): number {
  const base = FOE_BODY[e.kind][0], f = FOES[e.kind];
  const moving = f.fly || f.swim || Math.abs(e.vx) > 0.15;
  let frame = moving ? base + 2 + (Math.floor((tick + e.id * 5) / (f.fly ? 5 : 7)) % 4) : base + (Math.floor((tick + e.id * 11) / 28) % 2);
  if (e.st === 'tell') frame = base + 6;
  else if (e.st === 'strike' || e.st === 'lunge' || e.st === 'swoop') frame = base + 7;
  if (e.kind === 'frog') {
    // the frog's own hop: crouch (tell), spring up mouth open, sail, land
    if (e.st === 'sleep') frame = base;
    else if (e.st === 'wake') frame = base + 1;
    else if (e.st === 'hop') frame = e.ground ? base + 5 : e.vy < -1 ? base + 7 : e.vy > 1 ? base + 4 : base + 3;
    else if (e.st !== 'tell') frame = base + (Math.floor((tick + e.id * 11) / 28) % 2);
  }
  return frame;
}

/** A foe's box from a painted frame (by default its first, idle one), scaled by k about the frame's centre. The art
 *  faces left; mirrored when facing right. */
export function foeBox(e: { kind: FoeKind; x: number; y: number; face: number }, k: number, frame = FOE_BODY[e.kind][0]): Rect {
  const [x0, y0, x1, y1] = BOXES.foes[frame];
  const l = e.face > 0 ? -x1 : x0, r = e.face > 0 ? -x0 : x1;
  const w = (r - l) * k, h = (y1 - y0) * k, cx = (l + r) / 2, cy = (y0 + y1) / 2 + 1;
  return { x: e.x + cx - w / 2, y: e.y + cy - h / 2, w, h };
}

export type Enemy = {
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number; hp: number; max: number; face: 1 | -1;
  st: string; t: number; cd: number; hx: number; hy: number; flash: number; hidden: boolean; alive: boolean; ground: boolean;
  tx: number; ty: number; stun: number;
};
export type Shot = {
  id: number; kind: 'bolt' | 'mud' | 'shard' | 'water' | 'seed' | 'bell' | 'paint' | 'bubble' | 'lily';
  friendly: boolean; x: number; y: number; vx: number; vy: number; g: number; life: number; dmg: number; r: number; hits: number[];
};
export type Wave = { x: number; y: number; dir: 1 | -1; speed: number; life: number; h: number; dmg: number };
export type Ring = { x: number; y: number; r: number; vr: number; max: number; thick: number; dmg: number; friendly: boolean; kind: 'imp' | 'chime'; hit: number[]; rung: string[] };
export type Marker = { x: number; y: number; t: number; kind: 'bell' | 'lily' | 'aim' };
export type Pickup = { id: number; kind: 'coin' | 'mp' | 'hp' | 'bag'; x: number; y: number; vy: number; amount: number; t: number };
export type Rect = { x: number; y: number; w: number; h: number };

// ─── bosses ────────────────────────────────────────────────────────────────

export type Boss = {
  id: BossId; x: number; y: number; hp: number; max: number; phase: 1 | 2 | 3; st: string; t: number; dur: number; face: 1 | -1;
  flash: number; tellT: number; step: number; hurt: Rect[]; harm: Rect[]; calm: boolean; heads: { x: number; y: number; bx: number; by: number; st: string; t: number; tx: number; ty: number }[];
  arms: { x: number; y: number }[]; low: number; vis: number; side: 1 | -1; sx: number; sy: number;
  /** where the body is drawn (kept while it can't be hit) */
  body: Rect;
};

// ─── the game ──────────────────────────────────────────────────────────────

export type GameEvent =
  | { k: 'sfx'; id: string; x?: number; y?: number }
  | { k: 'hit'; x: number; y: number; big: boolean; color?: string }
  | { k: 'shake'; n: number }
  | { k: 'flash'; color: string; n: number }
  | { k: 'save' } | { k: 'shop' } | { k: 'mural'; n: number } | { k: 'ending'; full: boolean }
  | { k: 'level'; hero: HeroId; level: number } | { k: 'item'; text: string; icon?: number }
  | { k: 'bell'; x: number; y: number } | { k: 'room'; id: string } | { k: 'boss'; id: BossId } | { k: 'down'; hero: HeroId }
  | { k: 'wipe' } | { k: 'pulse'; x: number; y: number; r: number; color: [number, number, number] }
  /** a number to pop off something: damage dealt (hit, big for finishers, spell), damage taken (hurt), heals, XP and coins */
  | { k: 'num'; x: number; y: number; n: number; kind: NumKind }
  /** attack at a lit shrine: the page opens the map for travel; and a journey's arrival */
  | { k: 'travelOpen'; id: string } | { k: 'travel'; id: string }
  /** a Puma Tooth hit landed twice as hard */
  | { k: 'crit'; x: number; y: number } | { k: 'seal'; id: string; n: number };
export type NumKind = 'hit' | 'big' | 'spell' | 'hurt' | 'heal' | 'xp' | 'coin';

/** `wisp`: the guiding wisp, shown only while the helping hand is on (on unless turned off) */
export type Settings = { assist: boolean; strict: boolean; wisp?: boolean };
/** `spell` says which of Enzo's spells a cast is, so the scene can show its own pose */
type Act = { kind: 'swing' | 'thrust' | 'whirl' | 'cast' | 'tagin'; t: number; n: number; hit: Set<number>; dur: number; spell?: 'bolt' | 'ember' | 'chime' | 'lantern' };
type HeroRt = { inv: number; hurtT: number; act: Act | null; combo: number; buf: boolean; castHold: number; swingCd: number };
type Follower = { x: number; y: number; face: 1 | -1; air: boolean; moving: boolean; swim: boolean; climb: boolean; swipeT: number; swipeCd: number };

const ALL_HEROES: HeroId[] = ['dora', 'enzo'];
const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Swing timings: windup, active, recover (ticks), reach, height. */
export const SWING = {
  dora: { wind: 3, act: 5, rec: 9, reach: 24, h: 20, mult: [1, 1, 1.5] },
  enzo: { wind: 6, act: 6, rec: 13, reach: 34, h: 24, mult: [1.1, 1.1, 1.6] },
} as const;
export const TAG_CD = 50, TAG_INV = 24, HURT_INV = 70;
export const LANTERN_SMALL = 46, LANTERN_BIG = 118;

export class BellspireGame {
  save: Save;
  settings: Settings;
  seed: number;
  rngState: number;
  tick = 0;
  room: Room;
  body: Body;
  lead: HeroId;
  hero: Record<HeroId, HeroRt> = { dora: this.newRt(), enzo: this.newRt() };
  follower: Follower;
  trail: { x: number; y: number; face: 1 | -1; air: boolean; swim: boolean; climb: boolean }[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  waves: Wave[] = [];
  rings: Ring[] = [];
  markers: Marker[] = [];
  pickups: Pickup[] = [];
  embers: { t: number; hits: Map<number, number> } | null = null;
  boss: Boss | null = null;
  bossEntry: { x: number; y: number } | null = null;
  waterY = new Map<string, number>();
  arenaWater: { row: number; t: number } | null = null;
  lanternUp = false;
  lanternR = LANTERN_SMALL;
  dialog: { lines: Line[]; i: number; then?: () => void } | null = null;
  toast: { text: string; t: number } | null = null;
  events: GameEvent[] = [];
  hitstop = 0;
  tagCd = 0;
  safe: { x: number; y: number };
  safeT = 0;
  idleT = 0;
  lostT = 0;
  wisp: { x: number; y: number; on: boolean; tx: number; ty: number } = { x: 0, y: 0, on: false, tx: 0, ty: 0 };
  wispPath: { x: number; y: number }[] = [];
  wispRest = 0;
  /** Where the wisp leads; by default the doorway towards the next story goal. */
  wispGoal: ((g: BellspireGame) => { x: number; y: number } | null) | null = (g) => g.wayToGoal();
  ended = false;
  nextId = 1;
  prev: Input = NO_INPUT;
  lastToast = '';
  lastToastT = -999;
  regenT = 0;
  shrineHealT = 0;

  constructor(save?: Save | null, settings: Partial<Settings> = {}, seed = 1) {
    this.save = save ? JSON.parse(JSON.stringify(save)) : freshSave();
    this.settings = { assist: true, strict: false, ...settings };
    if (this.settings.strict) this.settings.assist = false;
    this.seed = seed; this.rngState = seed >>> 0 || 1;
    this.lead = this.save.lead;
    if (this.save.heroes[this.lead].down) this.lead = other(this.lead);
    // an old save where Ukumari opened the throne before every guardian was calm: the seals hold it shut again
    // (unless the story is already over)
    if (this.flag('keeper') && !this.flag('ending') && this.restless().length) this.save.flags = this.save.flags.filter((f) => f !== 'keeper');
    if (this.save.heroes.dora.down && this.save.heroes.enzo.down) { this.save.heroes.dora.down = false; this.save.heroes.dora.hp = 1; this.lead = 'dora'; }
    const start = this.shrineSpot(this.save.shrine) ?? this.startSpot();
    this.room = roomOfPoint(start.x, start.y - 4)!;
    this.body = newBody(start.x, start.y);
    this.safe = { ...start };
    this.follower = { x: start.x - 16, y: start.y, face: 1, air: false, moving: false, swim: false, climb: false, swipeT: 0, swipeCd: 0 };
    this.enterRoom(this.room, true);
    for (const h of ALL_HEROES) this.clampHero(h);
    if (!this.flag('script:intro')) { this.setFlag('script:intro'); this.say(SCRIPTS.intro); }
  }

  private newRt(): HeroRt { return { inv: 0, hurtT: 0, act: null, combo: 0, buf: false, castHold: 0, swingCd: 0 }; }

  // ─── small helpers ───────────────────────────────────────────────────────
  rand() { let x = this.rngState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rngState = x >>> 0; return this.rngState / 4294967296; }
  flag(f: string) { return this.save.flags.includes(f); }
  setFlag(f: string) { if (!this.flag(f)) this.save.flags.push(f); }
  /** The guardians not yet calmed (each holds one bell seal on the throne door), in story order. */
  restless(): (typeof GUARDIANS)[number][] { return GUARDIANS.filter((b) => !this.flag(`boss:${b}`)); }
  /** How many of the throne door's four bell seals are open. */
  sealsOpen() { return GUARDIANS.length - this.restless().length; }
  /** The restless guardians named with their areas: "the Reed Hydra in the Reed Docks and the Puma of the Murals in…" */
  restlessText() {
    const parts = this.restless().map((b) => `${BOSSES[b].name.replace(/^The /, 'the ')} in the ${AREAS[GUARDIAN_AREA[b]].name}`);
    return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }
  has(a: Ability) { return this.save.abilities.includes(a); }
  stats(h: HeroId) { return heroStats(this.save, h); }
  perk(h: HeroId, p: Perk) { return this.stats(h).perks.includes(p); }
  emit(e: GameEvent) { this.events.push(e); }
  sfx(id: string, x?: number, y?: number) { this.emit({ k: 'sfx', id, x, y }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  say(lines: Line[], then?: () => void) { if (lines.length) this.dialog = { lines, i: 0, then }; else then?.(); }
  note(text: string, force = false) {
    if (!force && text === this.lastToast && this.tick - this.lastToastT < 150) return;
    this.toast = { text, t: 200 }; this.lastToast = text; this.lastToastT = this.tick;
  }
  get leadRt() { return this.hero[this.lead]; }
  get leadSave() { return this.save.heroes[this.lead]; }
  get assistMul() { return this.settings.assist ? 0.6 : 1; }
  get bossSpeed() { return this.settings.assist ? 0.8 : 1; }
  get tellMul() { return this.settings.assist ? 1.25 : 1; }
  enzoPos() { return this.lead === 'enzo' ? { x: this.body.x, y: this.body.y - 14 } : { x: this.follower.x, y: this.follower.y - 14 }; }
  leadRect(): Rect { return { x: this.body.x - HERO_W / 2, y: this.body.y - HERO_H, w: HERO_W, h: HERO_H }; }

  private startSpot() {
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === '@') return { x: t.c * TILE + 8, y: (t.r + 1) * TILE };
    return { x: 100, y: 100 };
  }
  shrineSpot(id: string) {
    const info = INFO.get(id);
    const t = info?.things.find((x) => x.ch === 'S');
    return t ? { x: t.c * TILE + 8 + 18, y: (t.r + 1) * TILE } : null;
  }
  clampHero(h: HeroId) {
    const s = this.save.heroes[h], st = this.stats(h);
    s.hp = clamp(Math.round(s.hp), 0, st.maxHp); s.mp = clamp(Math.round(s.mp), 0, st.maxMp);
    if (s.hp <= 0 && !s.down) s.down = true;
  }

  // ─── the world as the body sees it ───────────────────────────────────────
  doorOpen(g: Group): boolean {
    if (g.ch === 'u') return this.flag('keeper') && this.restless().length === 0;
    if (g.ch === 'b') return !(this.boss && this.boss.st !== 'wait' && roomOfTile(g.c, g.r) === this.room);
    return this.flag(`door:${g.id}`);
  }
  wallBroken(g: Group) { return this.flag(`wall:${g.id}`); }
  glassLit(c: number, r: number) {
    if (!this.lanternUp) return false;
    const e = this.enzoPos();
    const dx = c * TILE + 8 - e.x, dy = r * TILE + 8 - e.y;
    return dx * dx + dy * dy < (this.lanternR - 6) ** 2;
  }
  solidTile(c: number, r: number): boolean {
    const ch = rawChar(c, r);
    if (ch === '#' || ch === '^') return true;
    if (ch === 'x') { const g = groupAt(c, r); return !g || !this.wallBroken(g); }
    if (DOOR_CHARS.includes(ch)) { const g = groupAt(c, r); return !g || !this.doorOpen(g); }
    if (ch === 'g') {
      if (!this.glassLit(c, r)) return false;
      // ghost-glass never closes around a body standing in it
      const b = this.body;
      if (c * TILE < b.x + HERO_W / 2 && c * TILE + TILE > b.x - HERO_W / 2 && r * TILE < b.y && r * TILE + TILE > b.y - HERO_H) return false;
      return true;
    }
    return false;
  }
  ladderTile(c: number, r: number): boolean {
    const ch = rawChar(c, r);
    if (ch === 'H') return true;
    if (DOOR_CHARS.includes(ch)) {
      const g = groupAt(c, r);
      if (g && g.horiz && this.doorOpen(g) && (rawChar(c, r - 1) === 'H' || rawChar(c, r + 1) === 'H')) return true;
    }
    return false;
  }
  surfaceAt(x: number, y: number): number | null {
    const room = roomOfPoint(x, y);
    if (!room) return null;
    if (room === this.room && this.arenaWater) return surfaceY(room, this.arenaWater.row);
    const cur = this.waterY.get(room.id);
    if (cur !== undefined) return cur;
    const row = surfaceRow(room, this.save.water);
    return row === null ? null : surfaceY(room, row);
  }
  floatList() {
    const info = INFO.get(this.room.id)!;
    if (!info.floats.length) return [];
    const surf = this.waterY.get(this.room.id);
    return info.floats.map((f) => {
      const rest = f.r * TILE + 10;
      const y = surf !== undefined ? Math.min(rest, surf - 3) : rest;
      return { x0: f.c0 * TILE, x1: (f.c1 + 1) * TILE, y };
    });
  }
  readonly env: Env = {
    solid: (c, r) => this.solidTile(c, r),
    oneway: (c, r) => rawChar(c, r) === '=' || (this.ladderTile(c, r) && !this.ladderTile(c, r - 1) && !this.solidTile(c, r - 1)),
    ladder: (c, r) => this.ladderTile(c, r),
    hazard: (c, r) => rawChar(c, r) === '^',
    surface: (x, y) => this.surfaceAt(x, y),
    deep: (x, y) => { const room = roomOfPoint(x, y); return room && room.deep !== undefined ? (room.gy * ROWS + room.deep) * TILE : null; },
    floats: () => this.floatCache,
  };
  floatCache: { x0: number; x1: number; y: number }[] = [];

  caps(h: HeroId = this.lead): Caps {
    const quick = this.perk(h, 'quick') ? 1.08 : 1;
    return {
      speed: RUN[h] * quick, dash: h === 'dora' && this.has('dash'), double: h === 'dora' && this.has('double'),
      wallkick: h === 'dora' && this.has('wallkick'), glide: h === 'enzo' && this.has('glide'), deep: this.has('deep'),
      swimMul: this.perk(h, 'swim') ? 1.3 : 1, coyote: this.settings.assist ? 9 : 6, buffer: this.settings.assist ? 9 : 6,
    };
  }

  // ─── rooms ───────────────────────────────────────────────────────────────
  enterRoom(room: Room, first = false) {
    // a calmed guardian always gives its rewards, even if the heroes somehow leave before it settles
    if (this.boss?.calm && !this.flag(`boss:${this.boss.id}`)) this.bossDone();
    const prevRoom = this.room;
    this.room = room;
    this.enemies = []; this.shots = []; this.waves = []; this.rings = []; this.markers = []; this.arenaWater = null;
    this.pickups = this.pickups.filter((p) => p.kind === 'bag');
    this.waterY.clear();
    const row = surfaceRow(room, this.save.water);
    if (row !== null) this.waterY.set(room.id, surfaceY(room, row));
    this.floatCache = this.floatList();
    const info = INFO.get(room.id)!;
    for (const t of info.things) {
      const kind = FOE_CHARS[t.ch];
      if (!kind) continue;
      const f = FOES[kind];
      const x = t.c * TILE + 8, y = (t.r + 1) * TILE;
      this.enemies.push({
        id: this.nextId++, kind, x, y: f.fly || f.swim ? y - 1 : y, vx: 0, vy: 0, hp: f.hp, max: f.hp, face: -1, st: kind === 'frog' ? 'sleep' : 'idle', t: 0, cd: 30 + Math.floor(this.rand() * 40),
        hx: x, hy: f.fly || f.swim ? y - 1 : y, flash: 0, hidden: false, alive: true, ground: false, tx: x, ty: y, stun: 0,
      });
    }
    this.boss = null; this.bossEntry = null;
    if (room.boss && !this.flag(`boss:${room.boss}`)) this.spawnBoss(room.boss);
    if (!first) this.emit({ k: 'room', id: room.id });
    if (room.script && !this.flag(`script:${room.script}`) && !first) { this.setFlag(`script:${room.script}`); this.say(SCRIPTS[room.script]); }
    if (room.dark && !this.flag('script:firstDark') && !first) { this.setFlag('script:firstDark'); this.say(SCRIPTS.firstDark); }
    if (prevRoom !== room) this.lostT = 0;
  }

  spawnBoss(id: BossId) {
    const rr = roomRect(this.room);
    const info = INFO.get(this.room.id)!;
    const o = info.things.find((t) => t.ch === 'O')!;
    const def = BOSSES[id];
    const ox = o.c * TILE + 8, oy = (o.r + 1) * TILE;
    const b: Boss = {
      id, x: ox, y: oy, hp: def.hp, max: def.hp, phase: 1, st: 'wait', t: 0, dur: 0, face: -1, flash: 0, tellT: 0, step: 0, hurt: [], harm: [], calm: false,
      heads: [], arms: [], low: 0, vis: 1, side: 1, sx: ox, sy: oy, body: { x: ox - 30, y: oy - 50, w: 60, h: 50 },
    };
    if (id === 'hydra') b.heads = [[-46, -96], [0, -128], [44, -88]].map(([dx, dy]) => ({ x: ox + dx, y: oy + dy, bx: ox + dx, by: oy + dy, st: 'idle', t: 0, tx: 0, ty: 0 }));
    if (id === 'warden') { b.x = rr.x + rr.w / 2; b.y = rr.y + 150; b.arms = [{ x: b.x - 90, y: b.y + 20 }, { x: b.x + 90, y: b.y + 20 }]; }
    this.boss = b;
  }

  // ─── the main tick ───────────────────────────────────────────────────────
  step(inp: Input) {
    const p = this.prev;
    const pressed = {
      jump: inp.jump && !p.jump, attack: inp.attack && !p.attack, dash: inp.dash && !p.dash, cast: inp.cast && !p.cast,
      tag: inp.tag && !p.tag, up: inp.up && !p.up, down: inp.down && !p.down,
    };
    const released = { cast: !inp.cast && p.cast };
    this.prev = inp;
    this.tick++;
    if (this.toast && --this.toast.t <= 0) this.toast = null;
    if (this.dialog) {
      if (pressed.jump || pressed.attack || pressed.up) {
        this.dialog.i++; this.sfx('talk');
        if (this.dialog.i >= this.dialog.lines.length) { const then = this.dialog.then; this.dialog = null; then?.(); }
      }
      return;
    }
    if (this.ended) return;
    if (this.hitstop > 0) { this.hitstop--; return; }
    this.save.time += 1 / 60;
    const any = inp.left || inp.right || inp.up || inp.down || inp.jump || inp.attack || inp.dash || inp.cast || inp.tag;
    this.idleT = any ? 0 : this.idleT + 1;
    this.lostT++;

    // water and floats
    this.updateWater();

    const lead = this.lead, rt = this.leadRt, b = this.body;
    for (const h of ALL_HEROES) { const r = this.hero[h]; if (r.inv > 0) r.inv--; if (r.hurtT > 0) r.hurtT--; if (r.swingCd > 0) r.swingCd--; }
    if (this.tagCd > 0) this.tagCd--;

    // tag
    if (pressed.tag) this.tryTag();

    // actions
    const busy = rt.hurtT > 0;
    if (!busy) {
      if (pressed.attack && !rt.act && this.canOpenTravel()) {
        // attack at a lit shrine, with nothing about to bite: the map opens for travel instead of a swing
        this.emit({ k: 'travelOpen', id: this.room.id });
      } else if (pressed.attack) {
        if (rt.act && rt.act.kind === 'swing') rt.buf = true;
        else if (!rt.act && rt.swingCd <= 0) {
          if (lead === 'dora' && !b.ground && inp.down && !b.swim && !b.climb) this.startAct('thrust', 0);
          else if (!b.climb) this.startAct('swing', 0);
        }
      }
      if (pressed.cast && !b.climb) {
        if (lead === 'enzo' && inp.down) this.toggleLantern();
        else if (lead === 'enzo' && inp.up) this.castChime();
        else if (lead === 'enzo') rt.castHold = 1;
        else this.castWhirl();
      }
    }
    if (lead === 'enzo' && rt.castHold > 0) {
      if (inp.cast) rt.castHold++;
      if (released.cast || !inp.cast) {
        const held = rt.castHold; rt.castHold = 0;
        if (held >= 24 && this.save.spells.includes('ember')) this.castEmber();
        else if (held >= 24 && !this.save.spells.includes('ember')) { this.note('Enzo hasn’t learned the Ember Ring yet. A tap of V casts the Lantern Bolt.'); this.castBolt(); }
        else this.castBolt();
      }
    }
    if (pressed.dash && !this.caps().dash) {
      if (lead === 'enzo' && this.has('dash')) this.note('Only Dora can dash. Press Shift to tag her in.');
      else if (!this.has('dash')) this.note('Dora hasn’t found the Reed Dash yet.');
    }
    if (pressed.up && b.ground && !b.climb) this.interact();

    // the body
    const act = rt.act;
    const rooted = (act && act.kind !== 'thrust' && b.ground && act.t < act.dur - 2) || rt.hurtT > 8;
    let dir: -1 | 0 | 1 = inp.left === inp.right ? 0 : inp.left ? -1 : 1;
    if (rooted && act?.kind === 'cast') dir = 0;
    const bin: BodyInput = { dir, up: inp.up, down: inp.down, jumpP: pressed.jump && !(act?.kind === 'cast'), jumpH: inp.jump, dashP: pressed.dash };
    const wasSwim = b.swim, faceBefore = b.face;
    const caps = this.caps();
    if (rooted && b.ground && act?.kind === 'swing') { caps.speed *= 0.35; }
    // ride a float
    const onFloat = b.ground && b.onOneway ? this.floatCache.find((f) => Math.abs(f.y - b.y) < 0.6 && b.x + HERO_W / 2 > f.x0 && b.x - HERO_W / 2 < f.x1) : undefined;
    const fBefore = onFloat?.y;
    this.floatCache = this.floatList();
    if (onFloat && fBefore !== undefined) {
      const now = this.floatCache.find((f) => f.x0 === onFloat.x0);
      if (now) b.y = now.y;
    }
    // facing holds only while a blow is landing (a swing's active frames, a cast's release): the wind-up and the
    // recovery turn freely, so holding the other way turns the next cut of a combo round
    const sw = SWING[this.lead];
    const lockFace = !!act && ((act.kind === 'swing' && act.t >= sw.wind && act.t < sw.wind + sw.act) || (act.kind === 'cast' && act.t < act.dur));
    if (lockFace) b.face = faceBefore;
    const climbing = b.climb;
    stepBody(b, bin, this.env, caps);
    if (lockFace) b.face = faceBefore;
    if (b.jumped) this.sfx(b.jumped === 'swim' ? 'stroke' : b.jumped === 'wall' ? 'kick' : b.jumped === 'air' ? 'leap' : 'jump');
    if (b.dashed) { this.sfx('dash'); rt.inv = Math.max(rt.inv, 14); }
    if (b.landed && !climbing) this.sfx('land'); // stepping off the top of a ladder is a pull-up, not a landing
    if (b.swim && !wasSwim) this.sfx('splash', b.x, b.y);
    if (b.bonk) this.bonkHatch();

    // the acting hero's attack
    this.updateAct();

    // safe ledge, hazards, regen
    const sup = b.ground ? support(this.env, b) : null;
    if (sup === 'solid' && !b.swim && !this.nearHazard()) { if (++this.safeT >= 8) { this.safe = { x: b.x, y: b.y }; } } else this.safeT = 0;
    if (b.hazard) this.hitHazard();
    this.regen();

    // follower
    this.updateFollower();

    // the world
    this.updateEnemies();
    this.updateShots();
    this.updateRings();
    if (this.boss) this.updateBoss();
    this.updatePickups();
    this.touchThings();
    this.touchDoors();
    this.updateLantern();

    // room change
    const nr = roomOfPoint(b.x, b.y - HERO_H / 2);
    if (nr && nr !== this.room) this.changeRoom(nr);
    const cell = `${Math.floor(b.x / SCREEN_W)},${Math.floor((b.y - HERO_H / 2) / SCREEN_H)}`;
    if (!this.save.seen.includes(cell) && roomAt(Math.floor(b.x / SCREEN_W), Math.floor((b.y - HERO_H / 2) / SCREEN_H))) { this.save.seen.push(cell); this.lostT = 0; }
    this.updateWisp();
  }

  changeRoom(nr: Room) {
    this.enterRoom(nr);
    this.trail = [];
    this.follower.x = this.body.x - this.body.face * 14; this.follower.y = this.body.y;
  }

  // ─── water ───────────────────────────────────────────────────────────────
  updateWater() {
    const row = surfaceRow(this.room, this.save.water);
    const cur = this.waterY.get(this.room.id);
    if (row === null) { if (cur !== undefined) { const tgt = (this.room.gy * ROWS + this.room.h * ROWS) * TILE + 40; const n = cur + 1.4; if (n >= tgt) this.waterY.delete(this.room.id); else this.waterY.set(this.room.id, n); } return; }
    const target = surfaceY(this.room, row);
    if (cur === undefined) { this.waterY.set(this.room.id, (this.room.gy * ROWS + this.room.h * ROWS) * TILE + 8); return; }
    if (Math.abs(cur - target) <= 1.2) this.waterY.set(this.room.id, target);
    else this.waterY.set(this.room.id, cur + Math.sign(target - cur) * 1.2);
    if (this.arenaWater && --this.arenaWater.t <= 0) this.arenaWater = null;
  }
  waterMoving() { const row = surfaceRow(this.room, this.save.water); const cur = this.waterY.get(this.room.id); return row !== null && cur !== undefined && Math.abs(cur - surfaceY(this.room, row)) > 0.5; }

  ringBell(area: AreaId, x: number, y: number) {
    if (!(WATER_AREAS as string[]).includes(area)) return;
    const a = area as WaterArea;
    this.save.water[a] = this.save.water[a] ? 0 : 1;
    this.sfx('bell', x, y); this.emit({ k: 'bell', x, y }); this.emit({ k: 'pulse', x, y, r: 160, color: [1, 0.85, 0.45] }); this.emit({ k: 'shake', n: 6 });
    this.note(`The ${AREAS[a].name} ${this.save.water[a] ? 'flood' : 'drain'}${this.save.water[a] ? '' : ''}${a === 'docks' ? '' : ''}.`, true);
    this.toast = { text: this.save.water[a] ? `The water rises in the ${AREAS[a].name}.` : `The water drains from the ${AREAS[a].name}.`, t: 200 };
    this.setFlag(`rang:${a}`);
  }

  // ─── tagging ─────────────────────────────────────────────────────────────
  tryTag() {
    const o = other(this.lead);
    if (this.save.heroes[o].down) { this.note(`${o === 'dora' ? 'Dora' : 'Enzo'} is knocked out. Rest at a candle shrine or drink muña tea to wake ${o === 'dora' ? 'Dora' : 'Enzo'}.`); this.sfx('locked'); return; }
    if (this.tagCd > 0) return;
    if (this.boss && this.boss.calm) return;
    const b = this.body;
    const fx = this.follower.x, fy = this.follower.y;
    this.follower.x = b.x; this.follower.y = b.y; this.follower.face = b.face;
    this.lead = o; this.save.lead = o;
    this.tagCd = TAG_CD;
    b.dashT = 0; b.kickT = 0; b.glide = false;
    b.airJumps = this.caps().double ? 1 : 0; b.airDash = true;
    const rt = this.hero[o];
    rt.act = null; rt.inv = Math.max(rt.inv, TAG_INV);
    this.startAct('tagin', 0);
    this.trail = [];
    void fx; void fy;
    this.sfx('tag');
    this.emit({ k: 'pulse', x: b.x, y: b.y - 12, r: 60, color: o === 'dora' ? [0.5, 0.95, 0.9] : [1, 0.7, 0.35] });
  }

  // ─── attacks and spells ──────────────────────────────────────────────────
  startAct(kind: Act['kind'], n: number, spell?: Act['spell']) {
    const rt = this.leadRt, sw = SWING[this.lead];
    const fast = this.perk(this.lead, 'fast') ? 0.7 : 1;
    const dur = kind === 'swing' ? sw.wind + sw.act + Math.round(sw.rec * fast) : kind === 'thrust' ? 999 : kind === 'whirl' ? 26 : kind === 'cast' ? 16 : 14;
    rt.act = { kind, t: 0, n, hit: new Set(), dur, spell };
    rt.buf = false;
    if (kind === 'swing') this.sfx(this.lead === 'dora' ? (n === 2 ? 'slash3' : 'slash') : 'staff');
    if (kind === 'thrust') this.sfx('thrust');
  }

  /** The hitbox of the lead's current attack, if it is in its active frames. */
  attackBox(): { r: Rect; mult: number; finisher: boolean; ring?: number } | null {
    const rt = this.leadRt, act = rt.act, b = this.body;
    if (!act) return null;
    const sw = SWING[this.lead];
    if (act.kind === 'swing') {
      if (act.t < sw.wind || act.t >= sw.wind + sw.act) return null;
      const reach = sw.reach + (this.perk(this.lead, 'reach') ? 8 : 0);
      // the cut sweeps from the 38-pixel hero's chest down to the floor in front (the rising second cut reaches higher);
      // the scene draws its arc from this same box
      const y = act.n === 1 ? b.y - 41 : b.y - 31, h = act.n === 1 ? 36 : 30;
      return { r: { x: b.face > 0 ? b.x : b.x - reach, y, w: reach, h }, mult: sw.mult[act.n], finisher: act.n === 2 };
    }
    if (act.kind === 'thrust') return { r: { x: b.x - 7, y: b.y - 4, w: 14, h: 16 }, mult: 1.2, finisher: false };
    if (act.kind === 'whirl') return act.t % 8 < 4 ? { r: { x: b.x - 30, y: b.y - HERO_H - 10, w: 60, h: HERO_H + 16 }, mult: 0.8, finisher: false, ring: 30 } : null;
    if (act.kind === 'tagin') return act.t < 8 ? { r: { x: b.x - 30, y: b.y - HERO_H - 8, w: 60, h: HERO_H + 12 }, mult: 1, finisher: false, ring: 30 } : null;
    return null;
  }

  updateAct() {
    const rt = this.leadRt, act = rt.act, b = this.body;
    if (!act) return;
    act.t++;
    if (act.kind === 'thrust') {
      if (b.ground || b.swim || b.climb) { rt.act = null; return; }
    } else if (act.t >= act.dur) {
      const was = act;
      rt.act = null;
      if (was.kind === 'swing') {
        if (rt.buf && was.n < 2) this.startAct('swing', was.n + 1);
        else { rt.combo = 0; rt.swingCd = was.n === 2 ? 12 : 3; }
      }
      return;
    }
    if (act.kind === 'whirl' && act.t % 8 === 0) act.hit.clear();
    const box = this.attackBox();
    if (!box) return;
    const atk = this.stats(this.lead).atk;
    let crit = false; // the Puma Tooth doubled a hit: the scene flashes it orange
    const dmgOf = (mult: number) => {
      let d = Math.max(1, Math.round(atk * mult));
      if (this.perk(this.lead, 'crit') && this.rand() < 0.15) { d *= 2; crit = true; }
      return d;
    };
    let landed = false;
    for (const e of this.enemies) {
      if (!e.alive || e.hidden || act.hit.has(e.id)) continue;
      if (overlap(box.r, this.foeRect(e))) { act.hit.add(e.id); crit = false; this.damageFoe(e, dmgOf(box.mult), b.face, box.finisher); landed = true; if (crit) this.emit({ k: 'crit', x: e.x, y: e.y - 10 }); }
    }
    if (this.boss && !this.boss.calm) {
      for (const h of this.boss.hurt) if (!act.hit.has(-1) && overlap(box.r, h)) { act.hit.add(-1); crit = false; this.damageBoss(dmgOf(box.mult) * ((h as Rect & { mul?: number }).mul ?? 1), box.r.x + box.r.w / 2, box.r.y + box.r.h / 2); landed = true; if (crit) this.emit({ k: 'crit', x: box.r.x + box.r.w / 2, y: box.r.y + box.r.h / 2 }); }
    }
    // breakable walls, chests and water bells react to a swing too
    if (act.kind !== 'tagin') {
      for (const g of INFO.get(this.room.id)!.walls) {
        if (this.wallBroken(g) || act.hit.has(-1000 - INFO.get(this.room.id)!.walls.indexOf(g))) continue;
        const gr = { x: g.c * TILE, y: g.r * TILE, w: g.w * TILE, h: g.h * TILE };
        if (overlap(box.r, gr)) { act.hit.add(-1000 - INFO.get(this.room.id)!.walls.indexOf(g)); this.hitWall(g); landed = true; }
      }
      for (const t of INFO.get(this.room.id)!.things) {
        const tr = { x: t.c * TILE, y: t.r * TILE - (t.ch === 'B' ? 8 : 0), w: TILE, h: TILE + (t.ch === 'B' ? 8 : 0) };
        if (!overlap(box.r, tr)) continue;
        if (t.ch === 'C' && !this.flag(`chest:${this.room.id}:${t.i}`)) this.openChest(t);
        if (t.ch === 'B' && !act.hit.has(-2000 - t.i)) { act.hit.add(-2000 - t.i); this.ringBell(this.room.area, t.c * TILE + 8, t.r * TILE); this.firstBell(); }
        if (t.ch === 'i' && !this.flag(`candle:${this.room.id}:${t.i}:${this.visitKey()}`)) {
          this.setFlag(`candle:${this.room.id}:${t.i}:${this.visitKey()}`);
          this.dropCoins(t.c * TILE + 8, t.r * TILE + 8, 1 + Math.floor(this.rand() * 3));
          this.sfx('candle');
        }
      }
    }
    if (landed) {
      this.hitstop = box.finisher ? 4 : 3;
      if (act.kind === 'thrust') { b.vy = -5.2; b.airJumps = this.caps().double ? 1 : 0; b.airDash = true; this.sfx('bounce'); }
    }
  }
  visitKey() { return 'v'; }
  firstBell() { if (!this.flag('script:bell')) { this.setFlag('script:bell'); } }

  /** Where a foe can be hit: its painted body (the bounds of its body frame, measured from the art), at 90% so the
   *  very tips of ears and fins don't count. The scene draws every foe from the same point, (x, y + 1), so the box
   *  and the picture always line up. */
  foeRect(e: Enemy): Rect { return foeBox(e, 0.9, foeFrame(e, this.tick)); }

  /** A foe's lunge or thrust: a band reaching out in front of its body, at the height of its middle. */
  strikeRect(e: Enemy): Rect {
    const r = this.foeRect(e), len = e.kind === 'reed' ? 26 : 22;
    return { x: e.face > 0 ? r.x + r.w - 4 : r.x - len + 4, y: r.y + r.h / 2 - 6, w: len, h: 12 };
  }

  /** Where touching a foe hurts: a smaller box, so brushing its edge is forgiven. */
  contactRect(e: Enemy): Rect { return foeBox(e, 0.72, foeFrame(e, this.tick)); }

  damageFoe(e: Enemy, dmg: number, dir: number, big: boolean, spell = false) {
    e.hp -= dmg; e.flash = 8;
    const f = FOES[e.kind];
    { const r = this.foeRect(e); this.emit({ k: 'num', x: e.x, y: r.y, n: dmg, kind: spell ? 'spell' : big ? 'big' : 'hit' }); }
    if (e.kind !== 'golem' && e.kind !== 'shell') { e.vx = dir * (big ? 2.4 : 1.6); if (!f.fly && !f.swim) e.vy = -1.5; }
    this.emit({ k: 'hit', x: e.x, y: e.y - f.h / 2, big });
    this.sfx(big ? 'crit' : 'hit', e.x, e.y);
    if (e.kind === 'frog' && e.st === 'sleep') { e.st = 'wake'; e.t = 0; }
    if (e.hp <= 0) {
      e.alive = false;
      this.emit({ k: 'pulse', x: e.x, y: e.y - f.h / 2, r: 50, color: [0.9, 0.95, 1] });
      this.sfx('poof', e.x, e.y);
      this.gainXp(f.xp);
      this.emit({ k: 'num', x: e.x, y: e.y - f.h, n: f.xp, kind: 'xp' });
      this.dropCoins(e.x, e.y - f.h / 2, f.coins);
      if (this.rand() < 0.22) this.pickups.push({ id: this.nextId++, kind: this.rand() < 0.5 ? 'mp' : 'hp', x: e.x, y: e.y - f.h / 2, vy: -2, amount: 4, t: 0 });
    }
  }

  dropCoins(x: number, y: number, n: number) {
    const lucky = this.perk('dora', 'lucky') || this.perk('enzo', 'lucky');
    const total = Math.round(n * (lucky ? 1.25 : 1));
    this.emit({ k: 'num', x, y: y - 8, n: total, kind: 'coin' });
    for (let i = 0; i < Math.min(total, 6); i++) this.pickups.push({ id: this.nextId++, kind: 'coin', x: x + (this.rand() - 0.5) * 12, y, vy: -2 - this.rand() * 1.5, amount: i === 0 ? total - Math.min(total, 6) + 1 : 1, t: 0 });
  }

  gainXp(xp: number) {
    const mul = this.perk('dora', 'xp') || this.perk('enzo', 'xp') ? 1.25 : 1;
    for (const h of ALL_HEROES) {
      const s = this.save.heroes[h];
      s.xp += Math.round(xp * mul);
      while (s.xp >= xpToNext(s.level)) {
        s.xp -= xpToNext(s.level); s.level++;
        const st = this.stats(h);
        if (!s.down) { s.hp = st.maxHp; s.mp = st.maxMp; }
        this.emit({ k: 'level', hero: h, level: s.level }); this.sfx('level');
      }
    }
  }

  spendMp(n: number, what: string) {
    const s = this.leadSave;
    if (s.mp < n) { this.note(`Not enough MP for the ${what} (it needs ${n}).`); this.sfx('fizzle'); return false; }
    s.mp -= n; return true;
  }
  castWhirl() {
    if (!this.spendMp(SPELLS.whirl.mp, SPELLS.whirl.name)) return;
    this.startAct('whirl', 0); this.sfx('whirl');
  }
  magic() { return this.stats('enzo').mag; }
  castBolt() {
    if (!this.spendMp(SPELLS.bolt.mp, SPELLS.bolt.name)) return;
    const b = this.body;
    this.startAct('cast', 0, 'bolt');
    this.shots.push({ id: this.nextId++, kind: 'bolt', friendly: true, x: b.x + b.face * 10, y: b.y - 14, vx: b.face * 4, vy: 0, g: 0, life: 70, dmg: Math.round(4 + this.magic() * 1.2), r: 5, hits: [] });
    this.sfx('bolt');
  }
  castEmber() {
    if (!this.spendMp(SPELLS.ember.mp, SPELLS.ember.name)) return;
    this.startAct('cast', 0, 'ember');
    this.embers = { t: 0, hits: new Map() };
    this.sfx('ember');
  }
  castChime() {
    if (!this.save.spells.includes('chime')) { this.note('Enzo hasn’t learned the Bell Chime yet. It waits somewhere in the Bell Towers.'); this.sfx('locked'); return; }
    const cost = Math.max(1, SPELLS.chime.mp - (this.perk('enzo', 'cheapchime') ? 2 : 0));
    if (!this.spendMp(cost, SPELLS.chime.name)) return;
    this.startAct('cast', 0, 'chime');
    const b = this.body;
    this.rings.push({ x: b.x, y: b.y - 14, r: 4, vr: 4.4, max: 150, thick: 8, dmg: Math.round(this.magic() * 0.6), friendly: true, kind: 'chime', hit: [], rung: [] });
    this.sfx('chime');
    this.emit({ k: 'pulse', x: b.x, y: b.y - 14, r: 150, color: [1, 0.85, 0.45] });
  }
  toggleLantern() {
    if (!this.has('lantern')) { this.note('The lantern needs the Moonwick before Enzo can raise it.'); this.sfx('locked'); return; }
    this.lanternUp = !this.lanternUp;
    this.startAct('cast', 0, 'lantern');
    this.sfx(this.lanternUp ? 'lanternUp' : 'lanternDown');
    if (this.lanternUp) this.emit({ k: 'pulse', x: this.body.x, y: this.body.y - 20, r: 120, color: [1, 0.8, 0.45] });
    if (this.lanternUp && !this.flag('lit:first')) this.setFlag('lit:first');
  }
  updateLantern() {
    const enzoOk = !this.save.heroes.enzo.down;
    if (!enzoOk) this.lanternUp = false;
    const big = LANTERN_BIG * (this.perk('enzo', 'bright') ? 1.4 : 1) * (this.perk('enzo', 'secrets') || this.perk('dora', 'secrets') ? 1.15 : 1);
    const target = this.lanternUp ? big : enzoOk ? LANTERN_SMALL : 0;
    this.lanternR += (target - this.lanternR) * 0.12;
    if (Math.abs(target - this.lanternR) < 0.5) this.lanternR = target;
  }

  // ─── interacting ─────────────────────────────────────────────────────────
  /** The thing ↑ would use right now, if any. */
  nearby(): Thing | null {
    const b = this.body;
    if (!b.ground || b.climb) return null;
    const info = INFO.get(this.room.id)!;
    let best: Thing | null = null, bd = 1e9;
    for (const t of info.things) {
      if (!'SMRUC'.includes(t.ch)) continue;
      if (t.ch === 'C' && this.flag(`chest:${this.room.id}:${t.i}`)) continue;
      const dx = Math.abs(t.c * TILE + 8 - b.x), dy = Math.abs((t.r + 1) * TILE - b.y);
      const reach = t.ch === 'M' || t.ch === 'S' ? 30 : 20;
      if (dx < reach && dy < 26 && dx < bd) { best = t; bd = dx; }
    }
    return best;
  }
  /** What ↑ does here, for the on-screen hint. */
  nearbyLabel(): string | null {
    const t = this.nearby();
    if (!t) return null;
    return ({ S: 'Rest and save', M: 'Talk to Wayra', R: 'Read the mural', U: 'Talk to Ukumari', C: 'Open the chest' } as Record<string, string>)[t.ch] ?? null;
  }
  interact() {
    const best = this.nearby();
    if (!best) return;
    if (best.ch === 'S') this.rest();
    else if (best.ch === 'M') {
      if (!this.flag('script:wayra')) { this.setFlag('script:wayra'); this.say(SCRIPTS.wayra, () => this.emit({ k: 'shop' })); }
      else this.emit({ k: 'shop' });
      this.sfx('talk');
    } else if (best.ch === 'R') {
      const n = this.room.murals?.[best.i] ?? 0;
      this.setFlag(`mural:${n}`); this.emit({ k: 'mural', n }); this.sfx('mural');
    } else if (best.ch === 'U') {
      const rest = this.restless();
      if (rest.length) {
        // not yet: Ukumari names the guardians whose bells still ring, and where they are
        const n = ['', 'One bell still rings', 'Two bells still ring', 'Three bells still ring', 'All four bells still ring'][rest.length];
        const why: Line = { who: 'ukumari', text: `${n}: ${this.restlessText()}. Calm ${rest.length === 1 ? 'it' : 'them'}, and the throne will open.` };
        const first = !this.flag('script:keeperEarly');
        this.setFlag('script:keeperEarly');
        this.say(first ? [...SCRIPTS.keeperEarly, why] : [why]);
      } else this.say(this.flag('keeper') ? [{ who: 'ukumari', text: 'The throne door is open. Be gentle with her, Dora and Enzo.' }] : SCRIPTS.keeper, () => {
        if (!this.flag('keeper')) { this.setFlag('keeper'); this.note('Ukumari opened the throne door.', true); this.sfx('door'); }
      });
    } else if (best.ch === 'C') this.openChest(best);
  }

  rest() {
    const healed = this.stats(this.lead).maxHp - this.leadSave.hp, before = this.litShrines().length, wasLit = this.litShrines().includes(this.room.id);
    for (const h of ALL_HEROES) { const s = this.save.heroes[h], st = this.stats(h); s.down = false; s.hp = st.maxHp; s.mp = st.maxMp; }
    if (healed > 0) this.emit({ k: 'num', x: this.body.x, y: this.body.y - 30, n: healed, kind: 'heal' });
    // the shrine the heroes last woke at stays lit when they rest somewhere new
    if (this.save.shrine) this.setFlag(`shrine:${this.save.shrine}`);
    this.save.shrine = this.room.id;
    this.setFlag(`shrine:${this.room.id}`);
    this.sfx('shrine'); this.emit({ k: 'pulse', x: this.body.x, y: this.body.y - 20, r: 140, color: [1, 0.75, 0.4] });
    this.emit({ k: 'save' });
    // the first time a second shrine is lit, say how travel works
    if (!wasLit && before === 1 && this.litShrines().length === 2) this.note('Shrines are linked: ↑ to rest, X to travel.', true);
    else this.note('Rested and saved. Both heroes are fully healed.', true);
  }

  openChest(t: Thing) {
    const key = `chest:${this.room.id}:${t.i}`;
    if (this.flag(key)) return;
    this.setFlag(key);
    const what = this.room.chests?.[t.i] ?? 'coins:10';
    this.grant(what, t.c * TILE + 8, t.r * TILE);
    this.sfx('chest');
  }

  grant(what: string, x: number, y: number) {
    const [kind, id] = what.split(':');
    if (kind === 'coins') { this.dropCoins(x, y, Number(id)); this.emit({ k: 'item', text: `${id} coins`, icon: 20 }); }
    else if (kind === 'heart') {
      this.save.hearts++;
      for (const h of ALL_HEROES) if (!this.save.heroes[h].down) this.save.heroes[h].hp += HEART_HP;
      this.emit({ k: 'item', text: `Bell Heart: both heroes +${HEART_HP} max HP`, icon: 22 }); this.sfx('heart');
    } else if (kind === 'drop') {
      this.save.drops++;
      for (const h of ALL_HEROES) this.save.heroes[h].mp += DROP_MP;
      this.emit({ k: 'item', text: `Moon Drop: both heroes +${DROP_MP} max MP`, icon: 23 }); this.sfx('heart');
    } else if (kind === 'cake' || kind === 'tea') {
      this.save.food[kind as FoodId]++;
      this.emit({ k: 'item', text: FOOD[kind as FoodId].name, icon: FOOD[kind as FoodId].icon });
    } else if (kind === 'gear') {
      if (!this.save.gear.includes(id)) this.save.gear.push(id);
      this.emit({ k: 'item', text: `${GEAR[id].name}: equip it from the menu (Esc)`, icon: GEAR[id].icon }); this.sfx('item');
    } else if (kind === 'ability') this.giveAbility(id as Ability, true);
    else if (kind === 'spell') {
      if (!this.save.spells.includes(id as SpellId)) this.save.spells.push(id as SpellId);
      this.emit({ k: 'item', text: `${SPELLS[id as SpellId].name}: ${SPELLS[id as SpellId].how}` }); this.sfx('relic');
    }
    for (const h of ALL_HEROES) this.clampHero(h);
  }

  giveAbility(a: Ability, announce: boolean) {
    if (!this.has(a)) this.save.abilities.push(a);
    if (a === 'chime' && !this.save.spells.includes('chime')) this.save.spells.push('chime');
    this.setFlag(`ability:${a}`);
    if (announce) {
      this.emit({ k: 'item', text: `${ABILITIES[a].name}! ${ABILITIES[a].how}`, icon: 24 + ABILITY_ORDER.indexOf(a) });
      this.sfx('relic'); this.emit({ k: 'pulse', x: this.body.x, y: this.body.y - 16, r: 160, color: [0.7, 0.9, 1] }); this.emit({ k: 'flash', color: '#fff', n: 10 });
    }
  }

  touchThings() {
    const b = this.body, me = this.leadRect();
    for (const t of INFO.get(this.room.id)!.things) {
      if (t.ch !== 'A') continue;
      const a = this.room.ability;
      if (!a || this.has(a)) continue;
      if (overlap(me, { x: t.c * TILE, y: t.r * TILE - 8, w: TILE, h: TILE + 8 })) this.giveAbility(a, true);
    }
    void b;
  }

  touchDoors() {
    const b = this.body;
    const me = { x: b.x - HERO_W / 2 - 2, y: b.y - HERO_H - 2, w: HERO_W + 4, h: HERO_H + 4 };
    for (const g of INFO.get(this.room.id)!.doors) {
      if (this.doorOpen(g)) continue;
      const gr = { x: g.c * TILE, y: g.r * TILE, w: g.w * TILE, h: g.h * TILE };
      const near = { x: gr.x - 2, y: gr.y - 2, w: gr.w + 4, h: gr.h + 4 };
      if (g.ch === 'l' && this.lanternUp) {
        const e = this.enzoPos();
        const dx = Math.max(gr.x - e.x, 0, e.x - (gr.x + gr.w)), dy = Math.max(gr.y - e.y, 0, e.y - (gr.y + gr.h));
        if (dx * dx + dy * dy < (this.lanternR * 0.8) ** 2) { this.openDoor(g); continue; }
      }
      if (!overlap(me, near)) continue;
      this.lockedDoor(g);
    }
  }
  lockedDoor(g: Group) {
    const ab: Record<string, Ability> = { d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime' };
    const a = ab[g.ch];
    if (a && 'djk'.includes(g.ch) && this.has(a)) { this.openDoor(g); return; }
    let text = '';
    if (a && !this.has(a)) text = `${ABILITIES[a].needs}.`;
    else if (g.ch === 'l') text = 'The hatch is sealed with darkness. Raise Enzo’s lantern next to it (as Enzo: ↓ + V).';
    else if (g.ch === 'c') text = 'A bell-sealed door. Ring it with the Bell Chime (as Enzo: ↑ + V).';
    else if (g.ch === 'u') text = this.restless().length
      ? `The throne door is held by four bell seals, ${this.sealsOpen()} of 4 open. Still ringing: ${this.restlessText()}.`
      : 'The throne door is tied shut with an old bell rope. Whoever keeps the bells could open it.';
    else if (g.ch === 'b') text = 'The way out is sealed until the guardian calms down.';
    if (text) { this.note(text); if (this.lastToastT === this.tick) this.sfx('locked'); }
  }
  openDoor(g: Group) {
    this.setFlag(`door:${g.id}`);
    this.sfx('door'); this.emit({ k: 'pulse', x: (g.c + g.w / 2) * TILE, y: (g.r + g.h / 2) * TILE, r: 70, color: hexRgb(ABILITIES[({ d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime' } as Record<string, Ability>)[g.ch] ?? 'chime'].color) });
    this.note('The door opens.', true);
  }
  bonkHatch() { /* hatches open on touch through touchDoors */ }

  nearHazard() {
    const b = this.body, c = Math.floor(b.x / TILE), r = Math.round(b.y / TILE);
    for (let dc = -1; dc <= 1; dc++) for (let dr = 0; dr <= 1; dr++) if (rawChar(c + dc, r + dr) === '^') return true;
    return false;
  }
  hitHazard() {
    const rt = this.leadRt;
    const s = this.leadSave;
    const dmg = Math.max(1, Math.round(4 * this.assistMul));
    s.hp -= dmg; rt.inv = Math.max(rt.inv, 50);
    this.sfx('hurt'); this.emit({ k: 'shake', n: 5 });
    this.note('Ouch! Back to the last safe ledge.', false);
    const b = this.body;
    b.x = this.safe.x; b.y = this.safe.y; b.vx = 0; b.vy = 0; b.dashT = 0; b.ground = false;
    this.follower.x = b.x - b.face * 24; this.follower.y = b.y; this.trail = [];
    if (s.hp <= 0) this.downLead();
  }

  hurtLead(atk: number, fromX: number) {
    const rt = this.leadRt, b = this.body;
    if (rt.inv > 0 || b.dashT > 0 || this.dialog) return false;
    const st = this.stats(this.lead);
    const dmg = Math.max(1, Math.round(atk * this.assistMul - st.def * 0.5));
    this.leadSave.hp -= dmg;
    rt.inv = HURT_INV; rt.hurtT = 16; rt.act = null; rt.castHold = 0;
    this.sfx('hurt'); this.emit({ k: 'shake', n: 4 }); this.emit({ k: 'hit', x: b.x, y: b.y - 12, big: false, color: '#ff6a6a' });
    this.emit({ k: 'num', x: b.x, y: b.y - 30, n: dmg, kind: 'hurt' });
    if (!this.perk(this.lead, 'sturdy')) {
      const dir = b.x >= fromX ? 1 : -1;
      // knock-back never throws a hero off a ledge or into a pit
      const c = Math.floor((b.x + dir * 14) / TILE);
      let ground = false;
      for (let r = Math.floor(b.y / TILE); r < Math.floor(b.y / TILE) + 3; r++) { if (rawChar(c, r) === '^') break; if (this.solidTile(c, r) || rawChar(c, r) === '=') { ground = true; break; } }
      b.vx = ground || b.swim ? dir * 2.2 : 0; if (!b.swim && b.ground) b.vy = -2.4;
      b.dashT = 0;
    }
    if (this.leadSave.hp <= 0) this.downLead();
    return true;
  }

  downLead() {
    const h = this.lead;
    this.leadSave.hp = 0; this.leadSave.down = true;
    this.emit({ k: 'down', hero: h }); this.sfx('down');
    if (h === 'enzo') this.lanternUp = false;
    const o = other(h);
    if (!this.save.heroes[o].down) {
      this.lead = o; this.save.lead = o;
      this.hero[o].inv = 90; this.hero[o].act = null;
      this.note(`${h === 'dora' ? 'Dora' : 'Enzo'} is knocked out! ${o === 'dora' ? 'Dora' : 'Enzo'} takes the lead.`, true);
      return;
    }
    this.wipe();
  }

  wipe() {
    this.emit({ k: 'wipe' }); this.sfx('wipe');
    for (const h of ALL_HEROES) { const s = this.save.heroes[h], st = this.stats(h); s.down = false; s.hp = st.maxHp; s.mp = st.maxMp; this.hero[h] = this.newRt(); }
    this.lead = 'dora'; this.save.lead = 'dora';
    const b = this.body;
    if (this.boss && this.bossEntry) {
      // the boss door is a checkpoint: try again from the doorway, nothing lost
      const entry = this.bossEntry;
      const id = this.boss.id;
      this.enterRoom(this.room, true);
      this.spawnBoss(id);
      this.boss!.st = 'wait';
      Object.assign(b, newBody(entry.x, entry.y));
      this.note('Back at the boss door. Watch for the flash before each attack.', true);
    } else {
      if (this.save.coins > 0) {
        const prevBag = this.save.drop?.coins ?? 0;
        this.save.drop = { x: this.safe.x, y: this.safe.y, coins: this.save.coins + prevBag };
        this.save.coins = 0;
      }
      const spot = this.shrineSpot(this.save.shrine) ?? this.startSpot();
      Object.assign(b, newBody(spot.x, spot.y));
      const room = roomOfPoint(spot.x, spot.y - 4)!;
      this.enterRoom(room, true);
      this.note(this.save.drop ? 'Both heroes woke up at the candle shrine. The coins you dropped are waiting where you fell.' : 'Both heroes woke up at the candle shrine.', true);
    }
    this.safe = { x: b.x, y: b.y };
    this.follower.x = b.x - 24; this.follower.y = b.y; this.trail = [];
    this.lanternUp = false;
  }

  regen() {
    if (++this.regenT >= 120) {
      this.regenT = 0;
      for (const h of ALL_HEROES) {
        const s = this.save.heroes[h];
        if (s.down) continue;
        s.mp += this.perk(h, 'regen') ? 2 : 1;
        this.clampHero(h);
      }
    }
    if (this.settings.assist && INFO.get(this.room.id)!.things.some((t) => t.ch === 'S') && ++this.shrineHealT >= 20) {
      this.shrineHealT = 0;
      for (const h of ALL_HEROES) { const s = this.save.heroes[h]; if (!s.down) { s.hp += 1; this.clampHero(h); } }
    }
  }

  // ─── the follower ────────────────────────────────────────────────────────
  updateFollower() {
    const b = this.body, f = this.follower;
    this.trail.push({ x: b.x, y: b.y, face: b.face, air: !b.ground && !b.climb, swim: b.swim, climb: b.climb });
    if (this.trail.length > 22) this.trail.shift();
    const t = this.trail[0];
    const gap = 24; // far enough apart that the two heroes read as two
    let tx = t.x, ty = t.y;
    if (Math.abs(b.x - tx) < gap && Math.abs(b.y - ty) < 4) tx = b.x - b.face * gap;
    const dx = tx - f.x, dy = ty - f.y;
    f.moving = Math.abs(dx) > 0.4;
    f.x += clamp(dx * 0.35, -4, 4); f.y += clamp(dy * 0.35, -6, 6);
    if (Math.abs(dx) > 120 || Math.abs(dy) > 120) { f.x = tx; f.y = ty; }
    f.face = Math.abs(dx) > 0.5 ? (dx > 0 ? 1 : -1) : b.face;
    f.air = t.air; f.swim = t.swim; f.climb = t.climb;
    // Dora swipes at enemies near her while following
    const helper = other(this.lead);
    if (f.swipeT > 0) f.swipeT--;
    if (f.swipeCd > 0) f.swipeCd--;
    if (helper === 'dora' && !this.save.heroes.dora.down && f.swipeCd <= 0) {
      for (const e of this.enemies) {
        if (!e.alive || e.hidden) continue;
        const r = this.foeRect(e);
        if (Math.abs(e.x - f.x) < 30 && f.y > r.y - 6 && f.y - HERO_H < r.y + r.h + 6) {
          f.face = e.x > f.x ? 1 : -1; f.swipeT = 10; f.swipeCd = 55;
          this.damageFoe(e, Math.max(1, Math.round(this.stats('dora').atk * 0.4)), f.face, false);
          this.sfx('swipe');
          break;
        }
      }
    }
  }

  // ─── enemies ─────────────────────────────────────────────────────────────
  foeEnv(e: Enemy, dy: number) {
    // simple walker physics on tiles: fall, stand, stop at walls and ledges
    const f = FOES[e.kind];
    e.vy = Math.min(e.vy + 0.3, 5);
    let ny = e.y + e.vy;
    const c0 = Math.floor((e.x - f.w / 2) / TILE), c1 = Math.floor((e.x + f.w / 2 - 0.01) / TILE);
    e.ground = false;
    if (e.vy >= 0) {
      const r = Math.floor(ny / TILE);
      for (let c = c0; c <= c1; c++) if (this.solidTile(c, r) || rawChar(c, r) === '=') { if (e.y <= r * TILE + 0.01) { ny = r * TILE; e.vy = 0; e.ground = true; } }
    }
    e.y = ny;
    const nx = e.x + e.vx;
    const edge = e.vx > 0 ? nx + f.w / 2 : nx - f.w / 2;
    const ce = Math.floor(edge / TILE);
    let blocked = false;
    for (let r = Math.floor((e.y - f.h) / TILE); r <= Math.floor((e.y - 1) / TILE); r++) if (this.solidTile(ce, r)) blocked = true;
    if (!blocked) e.x = nx; else { e.vx = 0; }
    void dy;
    return blocked;
  }
  ledgeAhead(e: Enemy, dir: number) {
    const f = FOES[e.kind];
    const c = Math.floor((e.x + dir * (f.w / 2 + 4)) / TILE), r = Math.floor(e.y / TILE);
    return !(this.solidTile(c, r) || rawChar(c, r) === '=') || rawChar(c, r) === '^';
  }

  updateEnemies() {
    const b = this.body, me = this.leadRect();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const f = FOES[e.kind];
      if (e.flash > 0) e.flash--;
      e.t++;
      if (e.cd > 0) e.cd--;
      const dx = b.x - e.x, dy = b.y - e.y, dist = Math.hypot(dx, dy);
      const toward = (dx >= 0 ? 1 : -1) as 1 | -1;
      // knock-back decays
      if (f.fly || f.swim) { e.x += e.vx; e.vx *= 0.85; }
      switch (e.kind) {
        case 'frog': {
          if (e.st === 'sleep') { if (Math.abs(dx) < 90 && Math.abs(dy) < 50) { e.st = 'wake'; e.t = 0; this.sfx('stone', e.x, e.y); } this.foeEnv(e, 0); break; }
          if (e.st === 'wake') { if (e.t > 34) { e.st = 'idle'; e.t = 0; } this.foeEnv(e, 0); break; }
          if (e.ground) e.vx *= 0.7;
          if (e.st === 'idle' && e.t > 40 && e.ground) { e.st = 'tell'; e.t = 0; e.face = toward; }
          else if (e.st === 'tell' && e.t > 22) { e.st = 'hop'; e.t = 0; e.vy = -4.6; e.vx = e.face * 1.6; this.sfx('hop', e.x, e.y); }
          else if (e.st === 'hop' && e.ground && e.t > 4) { e.st = 'idle'; e.t = 0; }
          if (e.st === 'hop' && !e.ground) e.vx = e.face * 1.6;
          this.foeEnv(e, 0);
          break;
        }
        case 'moth': {
          const near = dist < 150;
          e.hx += near ? clamp(dx, -0.3, 0.3) : (e.tx - e.hx) * 0.01;
          e.hy += near ? clamp(dy - 14, -0.2, 0.2) : 0; // hovers at chest height
          e.x = e.hx + Math.sin(e.t * 0.035) * 22; e.y = e.hy + Math.sin(e.t * 0.06) * 8;
          e.face = toward;
          break;
        }
        case 'eel': {
          const surf = this.surfaceAt(e.hx, e.hy);
          e.hidden = surf === null || surf > e.hy - 17; // its whole body under the surface
          if (e.hidden) { e.st = 'idle'; break; }
          if (e.st === 'idle') {
            e.x += e.face * 0.7;
            if (Math.abs(e.x - e.hx) > 60 || this.solidTile(Math.floor((e.x + e.face * 14) / TILE), Math.floor((e.y - 4) / TILE))) e.face = (-e.face) as 1 | -1;
            e.y += (e.hy - e.y) * 0.05 + Math.sin(e.t * 0.08) * 0.3;
            if (b.swim && dist < 80 && e.cd <= 0) { e.st = 'tell'; e.t = 0; e.face = toward; this.sfx('hiss', e.x, e.y); }
          } else if (e.st === 'tell') { if (e.t > 26) { e.st = 'lunge'; e.t = 0; e.tx = dx / Math.max(1, dist); e.ty = dy / Math.max(1, dist); } }
          else if (e.st === 'lunge') { e.x += e.tx * 3; e.y += e.ty * 3; if (e.t > 18) { e.st = 'back'; e.t = 0; e.cd = 70; } }
          else if (e.st === 'back') { e.x += (e.hx - e.x) * 0.05; e.y += (e.hy - e.y) * 0.05; if (e.t > 40) { e.st = 'idle'; e.t = 0; } }
          const s2 = this.surfaceAt(e.x, e.y);
          if (s2 !== null && e.y - 6 < s2) e.y = s2 + 6;
          break;
        }
        case 'reed': case 'shell': case 'golem': {
          const speed = e.kind === 'reed' ? 0.5 : e.kind === 'shell' ? 0.4 : 0.35;
          const reach = e.kind === 'golem' ? 70 : e.kind === 'shell' ? 34 : 40;
          if (e.st === 'idle') {
            if (Math.abs(dx) < 160 && Math.abs(dy) < 40) e.face = toward;
            const blocked = this.ledgeAhead(e, e.face);
            e.vx = blocked ? 0 : e.face * speed;
            if (blocked && Math.abs(dx) >= 160) e.face = (-e.face) as 1 | -1;
            if (Math.abs(dx) < reach && Math.abs(dy) < 30 && e.cd <= 0) { e.st = 'tell'; e.t = 0; e.vx = 0; e.face = toward; }
          } else if (e.st === 'tell') {
            e.vx *= 0.5;
            if (e.t > (e.kind === 'golem' ? 40 : 30)) {
              e.st = 'strike'; e.t = 0; this.sfx(e.kind === 'golem' ? 'smash' : 'thrust', e.x, e.y);
              if (e.kind === 'golem') { for (const d of [-1, 1] as const) this.waves.push({ x: e.x + d * 16, y: e.y, dir: d, speed: 2, life: 50, h: 12, dmg: f.atk }); this.emit({ k: 'shake', n: 4 }); }
            }
          } else if (e.st === 'strike') {
            if (e.kind !== 'golem') {
              if (e.t < 12 && overlap(this.strikeRect(e), me)) this.hurtLead(f.atk, e.x);
            }
            if (e.t > 14) { e.st = 'idle'; e.t = 0; e.cd = e.kind === 'golem' ? 90 : 55; }
          }
          if (e.ground && e.st !== 'idle') e.vx *= 0.8;
          this.foeEnv(e, 0);
          break;
        }
        case 'condor': {
          if (e.st === 'idle') {
            e.y = e.hy + Math.sin(e.t * 0.05) * 2; e.x += (e.hx - e.x) * 0.05; e.face = toward;
            if (dist < 130 && e.cd <= 0) { e.st = 'tell'; e.t = 0; this.sfx('caw', e.x, e.y); }
          } else if (e.st === 'tell') { if (e.t > 32) { e.st = 'swoop'; e.t = 0; const d = Math.max(1, dist); e.tx = dx / d * 2.6; e.ty = (dy - 10) / d * 2.6; } }
          else if (e.st === 'swoop') {
            e.x += e.tx; e.y += e.ty;
            if (e.t > 50 || this.solidTile(Math.floor(e.x / TILE), Math.floor(e.y / TILE))) { e.st = 'back'; e.t = 0; }
          } else if (e.st === 'back') {
            e.x += clamp(e.hx - e.x, -1.3, 1.3); e.y += clamp(e.hy - e.y, -1.3, 1.3);
            if (Math.hypot(e.hx - e.x, e.hy - e.y) < 2) { e.st = 'idle'; e.t = 0; e.cd = 70; }
          }
          break;
        }
        case 'imp': {
          if (e.ground) e.vx *= 0.7;
          if (e.st === 'idle') {
            if (e.ground && e.t % 50 === 0 && Math.abs(dx) < 180) { e.vy = -3; e.vx = toward * 0.9; e.face = toward; }
            if (e.ground && dist < 110 && e.cd <= 0) { e.st = 'tell'; e.t = 0; e.face = toward; }
          } else if (e.st === 'tell') { if (e.t > 30) { e.st = 'idle'; e.t = 0; e.cd = 140; this.rings.push({ x: e.x, y: e.y - 8, r: 4, vr: 2, max: 50, thick: 6, dmg: f.atk, friendly: false, kind: 'imp', hit: [], rung: [] }); this.sfx('ring', e.x, e.y); } }
          this.foeEnv(e, 0);
          break;
        }
        case 'vizcacha': {
          if (e.ground) e.vx *= 0.7;
          e.face = toward;
          if (e.st === 'idle') {
            if (Math.abs(dx) < 44 && Math.abs(dy) < 30 && e.ground && e.cd < 40 && !this.ledgeAhead(e, -toward)) { e.vy = -3; e.vx = -toward * 1.5; }
            if (dist < 170 && e.cd <= 0 && e.ground) { e.st = 'tell'; e.t = 0; }
          } else if (e.st === 'tell' && e.t > 26) {
            e.st = 'idle'; e.t = 0; e.cd = 100;
            const time = 40, vx = clamp(dx / time, -3, 3);
            this.shots.push({ id: this.nextId++, kind: 'mud', friendly: false, x: e.x, y: e.y - 10, vx, vy: -3.2, g: 0.16, life: 120, dmg: f.atk, r: 5, hits: [] });
            this.sfx('throw', e.x, e.y);
          }
          this.foeEnv(e, 0);
          break;
        }
        case 'jelly': {
          const near = dist < 110;
          e.hx += near ? clamp(dx, -0.25, 0.25) : 0;
          e.x = e.hx; e.y = e.hy + Math.sin(e.t * 0.035) * 22;
          const surf = this.surfaceAt(e.x, e.y);
          if (surf !== null && e.y - 22 < surf && e.hy > surf) e.y = surf + 22; // stays under the surface
          break;
        }
      }
      // touching an enemy hurts (sleeping frogs and hidden eels are harmless)
      if (e.alive && !e.hidden && e.st !== 'sleep' && e.st !== 'wake' && overlap(me, this.contactRect(e))) this.hurtLead(f.atk, e.x);
    }
    this.enemies = this.enemies.filter((e) => e.alive || false);
    // shockwaves along the floor
    for (const w of this.waves) {
      w.x += w.dir * w.speed; w.life--;
      if (this.solidTile(Math.floor((w.x + w.dir * 4) / TILE), Math.floor((w.y - 4) / TILE))) w.life = 0;
      if (overlap(me, { x: w.x - 6, y: w.y - w.h, w: 12, h: w.h })) this.hurtLead(w.dmg, w.x - w.dir * 10);
    }
    this.waves = this.waves.filter((w) => w.life > 0);
  }
  shrink(r: Rect, n: number): Rect { return { x: r.x + n, y: r.y + n, w: Math.max(1, r.w - 2 * n), h: Math.max(1, r.h - 2 * n) }; }

  updateShots() {
    const me = this.leadRect();
    for (const s of this.shots) {
      s.life--;
      s.vy += s.g; s.x += s.vx; s.y += s.vy;
      if (s.kind === 'bubble') {
        const b = this.body;
        s.vx += clamp(b.x - s.x, -1, 1) * 0.02; s.vy += clamp(b.y - 14 - s.y, -1, 1) * 0.02;
        s.vx = clamp(s.vx, -0.8, 0.8); s.vy = clamp(s.vy, -0.8, 0.8);
      }
      if (s.kind !== 'bubble' && s.kind !== 'bell' && s.kind !== 'lily' && this.solidTile(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) { s.life = 0; this.emit({ k: 'hit', x: s.x, y: s.y, big: false, color: s.friendly ? '#ffd27a' : '#8a6a4a' }); continue; }
      if ((s.kind === 'bell' || s.kind === 'lily') && this.solidTile(Math.floor(s.x / TILE), Math.floor((s.y + s.r) / TILE))) { s.life = 0; this.emit({ k: 'hit', x: s.x, y: s.y, big: true, color: '#e8c070' }); this.sfx('clang', s.x, s.y); continue; }
      const sr = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.friendly) {
        for (const e of this.enemies) if (e.alive && !e.hidden && !s.hits.includes(e.id) && overlap(sr, this.foeRect(e))) { s.hits.push(e.id); this.damageFoe(e, s.dmg, Math.sign(s.vx) || 1, false, s.kind === 'bolt'); s.life = 0; break; }
        if (s.life > 0 && this.boss && !this.boss.calm) for (const h of this.boss.hurt) if (overlap(sr, h)) { this.damageBoss(s.dmg, s.x, s.y, s.kind === 'bolt'); s.life = 0; break; }
        if (s.life > 0) for (const t of INFO.get(this.room.id)!.things) if (t.ch === 'B' && overlap(sr, { x: t.c * TILE, y: t.r * TILE - 8, w: TILE, h: TILE + 8 })) { this.ringBell(this.room.area, t.c * TILE + 8, t.r * TILE); s.life = 0; break; }
      } else {
        if (overlap(sr, this.shrink(me, 2))) { if (this.hurtLead(s.dmg, s.x)) s.life = s.kind === 'bubble' ? 0 : 0; }
        // the hero's swing pops bubbles and knocks shots away
        const box = this.attackBox();
        if (box && (s.kind === 'bubble' || s.kind === 'mud' || s.kind === 'seed' || s.kind === 'paint') && overlap(box.r, sr)) { s.life = 0; this.emit({ k: 'hit', x: s.x, y: s.y, big: false }); this.sfx('pop', s.x, s.y); }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    // Ember Ring
    if (this.embers) {
      const em = this.embers; em.t++;
      const c = this.lead === 'enzo' ? { x: this.body.x, y: this.body.y - 12 } : { x: this.follower.x, y: this.follower.y - 12 };
      for (let i = 0; i < 8; i++) {
        const a = em.t * 0.12 + (i * Math.PI) / 4, ex = c.x + Math.cos(a) * 34, ey = c.y + Math.sin(a) * 34;
        const er = { x: ex - 5, y: ey - 5, w: 10, h: 10 };
        for (const e of this.enemies) {
          if (!e.alive || e.hidden) continue;
          if ((em.hits.get(e.id) ?? -99) > em.t - 12) continue;
          if (overlap(er, this.foeRect(e))) { em.hits.set(e.id, em.t); this.damageFoe(e, Math.round(this.magic() * 0.7), ex > c.x ? 1 : -1, false, true); }
        }
        if (this.boss && !this.boss.calm && (em.hits.get(-1) ?? -99) <= em.t - 12) for (const h of this.boss.hurt) if (overlap(er, h)) { em.hits.set(-1, em.t); this.damageBoss(Math.round(this.magic() * 0.7), ex, ey, true); break; }
      }
      if (em.t > 70) this.embers = null;
    }
  }

  updateRings() {
    const me = this.leadRect(), b = this.body;
    for (const g of this.rings) {
      g.r += g.vr;
      if (g.friendly) {
        for (const e of this.enemies) {
          if (!e.alive || e.hidden || g.hit.includes(e.id)) continue;
          if (Math.hypot(e.x - g.x, e.y - FOES[e.kind].h / 2 - g.y) < g.r) { g.hit.push(e.id); this.damageFoe(e, g.dmg, e.x > g.x ? 1 : -1, false, true); e.stun = 60; }
        }
        if (this.boss && !this.boss.calm && !g.hit.includes(-1)) for (const h of this.boss.hurt) {
          const cx = clamp(g.x, h.x, h.x + h.w), cy = clamp(g.y, h.y, h.y + h.h);
          if (Math.hypot(cx - g.x, cy - g.y) < g.r) { g.hit.push(-1); this.damageBoss(g.dmg, cx, cy, true); break; }
        }
        for (const t of INFO.get(this.room.id)!.things) {
          if (t.ch !== 'B' || g.rung.includes(`b${t.i}`)) continue;
          if (Math.hypot(t.c * TILE + 8 - g.x, t.r * TILE - g.y) < g.r) { g.rung.push(`b${t.i}`); this.ringBell(this.room.area, t.c * TILE + 8, t.r * TILE); }
        }
        for (const d of INFO.get(this.room.id)!.doors) {
          if (d.ch !== 'c' || this.doorOpen(d) || g.rung.includes(d.id)) continue;
          const cx = clamp(g.x, d.c * TILE, (d.c + d.w) * TILE), cy = clamp(g.y, d.r * TILE, (d.r + d.h) * TILE);
          if (Math.hypot(cx - g.x, cy - g.y) < g.r) { g.rung.push(d.id); this.openDoor(d); }
        }
      } else {
        const cx = clamp(g.x, me.x, me.x + me.w), cy = clamp(g.y, me.y, me.y + me.h);
        const d = Math.hypot(cx - g.x, cy - g.y);
        const far = Math.hypot(Math.max(Math.abs(me.x - g.x), Math.abs(me.x + me.w - g.x)), Math.max(Math.abs(me.y - g.y), Math.abs(me.y + me.h - g.y)));
        if (d < g.r + g.thick / 2 && far > g.r - g.thick / 2) this.hurtLead(g.dmg, g.x);
      }
    }
    this.rings = this.rings.filter((g) => g.r < g.max);
    void b;
  }

  updatePickups() {
    const b = this.body, me = this.leadRect();
    if (this.save.drop && roomOfPoint(this.save.drop.x, this.save.drop.y - 4) === this.room && !this.pickups.some((p) => p.kind === 'bag')) {
      this.pickups.push({ id: this.nextId++, kind: 'bag', x: this.save.drop.x, y: this.save.drop.y - 6, vy: 0, amount: this.save.drop.coins, t: 0 });
    }
    for (const p of this.pickups) {
      p.t++;
      if (p.kind !== 'bag') {
        p.vy = Math.min(p.vy + 0.18, 3);
        const ny = p.y + p.vy;
        if (this.solidTile(Math.floor(p.x / TILE), Math.floor((ny + 3) / TILE)) || rawChar(Math.floor(p.x / TILE), Math.floor((ny + 3) / TILE)) === '=') p.vy = 0; else p.y = ny;
        // pickups drift to the hero once close
        const dx = b.x - p.x, dy = b.y - 10 - p.y;
        if (Math.hypot(dx, dy) < 40 && p.t > 20) { p.x += dx * 0.15; p.y += dy * 0.15; }
      }
      if (p.t > 10 && overlap(me, { x: p.x - 5, y: p.y - 5, w: 10, h: 10 })) {
        p.t = -1;
        if (p.kind === 'coin') { this.save.coins += p.amount; this.sfx('coin'); }
        else if (p.kind === 'mp') { this.leadSave.mp += p.amount; this.clampHero(this.lead); this.sfx('mp'); }
        else if (p.kind === 'hp') { const was = this.leadSave.hp; this.leadSave.hp += p.amount * 2; this.clampHero(this.lead); this.sfx('mp'); if (this.leadSave.hp > was) this.emit({ k: 'num', x: b.x, y: b.y - 30, n: this.leadSave.hp - was, kind: 'heal' }); }
        else if (p.kind === 'bag') { this.save.coins += p.amount; this.save.drop = null; this.sfx('coin'); this.note(`Picked up your ${p.amount} dropped coins.`, true); }
      }
      if (p.kind === 'coin' && p.t > 900) p.t = -1;
    }
    this.pickups = this.pickups.filter((p) => p.t >= 0);
  }

  hitWall(g: Group) {
    const key = `wallhit:${g.id}`;
    const n = (this.save.flags.filter((f) => f === key).length) + 1;
    this.save.flags.push(key);
    this.emit({ k: 'hit', x: (g.c + 0.5) * TILE, y: (g.r + g.h / 2) * TILE, big: false, color: '#b8a890' });
    this.sfx('crack');
    if (n >= 3) {
      this.save.flags = this.save.flags.filter((f) => f !== key);
      this.setFlag(`wall:${g.id}`);
      this.sfx('break'); this.emit({ k: 'shake', n: 5 });
      this.note('A secret passage!', true);
    }
  }

  // ─── bosses ──────────────────────────────────────────────────────────────
  bossRoomRect() { return roomRect(this.room); }
  floorY() { const rr = this.bossRoomRect(); return rr.y + 15 * TILE; }

  damageBoss(dmg: number, x: number, y: number, spell = false) {
    const b = this.boss!;
    if (b.calm || b.st === 'wait' || b.st === 'intro' || b.vis < 0.5) return;
    b.hp -= dmg; b.flash = 8;
    this.emit({ k: 'hit', x, y, big: dmg > 12 }); this.emit({ k: 'num', x, y: y - 10, n: Math.round(dmg), kind: spell ? 'spell' : dmg > 12 ? 'big' : 'hit' }); this.sfx('bosshit', x, y);
    const ratio = b.hp / b.max;
    const phase = ratio < 0.3 ? 3 : ratio < 0.6 ? 2 : 1;
    if (phase > b.phase) { b.phase = phase as 1 | 2 | 3; this.emit({ k: 'flash', color: '#fff', n: 8 }); this.sfx('phase'); this.emit({ k: 'shake', n: 8 }); }
    if (b.hp <= 0) { b.hp = 0; b.calm = true; b.st = 'calm'; b.t = 0; b.harm = []; this.shots = this.shots.filter((s) => s.friendly); this.waves = []; this.rings = []; this.markers = []; this.sfx('calm'); this.emit({ k: 'flash', color: '#fff', n: 16 }); this.emit({ k: 'shake', n: 12 }); }
  }

  /** Change state; a `tell` flashes and plays a warning, and lasts longer with assist on. */
  go(st: string, dur: number, tell = false) {
    const b = this.boss!;
    b.st = st; b.t = 0; b.dur = tell ? dur * this.tellMul : dur;
    if (tell) { b.tellT = b.dur; this.sfx('tell', b.x, b.y); this.emit({ k: 'flash', color: '#ffe8a0', n: 4 }); }
  }

  updateBoss() {
    const b = this.boss!;
    const me = this.leadRect();
    if (b.flash > 0) b.flash--;
    if (b.tellT > 0) b.tellT -= this.bossSpeed;
    if (b.st === 'wait') {
      // the fight starts once both heroes are through the door
      const rr = this.bossRoomRect();
      const inside = this.room.id === 'idol' ? this.body.x < rr.x + 26 * TILE : this.body.x > rr.x + 3 * TILE;
      if (inside) {
        this.bossEntry = { x: this.body.x, y: this.body.y };
        b.st = 'intro'; b.t = 0; b.dur = 90;
        this.emit({ k: 'boss', id: b.id });
        if (!this.flag(`script:boss:${b.id}`)) { this.setFlag(`script:boss:${b.id}`); this.say(SCRIPTS[b.id]); }
      }
      b.hurt = []; b.harm = [];
      return;
    }
    b.t += this.bossSpeed;
    if (b.st === 'calm') {
      b.harm = []; b.hurt = [];
      if (b.t > 100) this.bossDone();
      return;
    }
    b.harm = []; b.hurt = [];
    if (b.id === 'frog') this.bossFrog(b);
    else if (b.id === 'hydra') this.bossHydra(b);
    else if (b.id === 'puma') this.bossPuma(b);
    else if (b.id === 'warden') this.bossWarden(b);
    else this.bossMother(b);
    for (const h of b.harm) if (overlap(me, this.shrink(h, 2))) { this.hurtLead(BOSSES[b.id].atk, h.x + h.w / 2); break; }
    // falling things marked on the floor
    for (const m of this.markers) m.t -= this.bossSpeed;
    this.markers = this.markers.filter((m) => {
      if (m.t > 0) return true;
      if (m.kind === 'aim') return false;
      this.shots.push({ id: this.nextId++, kind: m.kind as 'bell' | 'lily', friendly: false, x: m.x, y: this.bossRoomRect().y + 40, vx: 0, vy: 2, g: 0.18 * this.bossSpeed, life: 200, dmg: BOSSES[b.id].atk, r: 8, hits: [] });
      return false;
    });
  }

  bossDone() {
    const b = this.boss!;
    this.setFlag(`boss:${b.id}`);
    if ((GUARDIANS as readonly string[]).includes(b.id)) {
      // one of the throne door's bell seals goes quiet
      const n = this.sealsOpen();
      this.note(`The ${AREAS[GUARDIAN_AREA[b.id as (typeof GUARDIANS)[number]]].name} bell is quiet. ${n} of 4 seals open.`, true);
      this.sfx('chime');
      this.emit({ k: 'seal', id: b.id, n });
    }
    this.gainXp(BOSSES[b.id].xp);
    for (const r of BOSSES[b.id].reward) this.grant(r, b.x, b.y - 30);
    for (const h of ALL_HEROES) { const s = this.save.heroes[h], st = this.stats(h); s.down = false; s.hp = st.maxHp; s.mp = st.maxMp; }
    this.boss = null; this.bossEntry = null; this.arenaWater = null;
    const done = SCRIPTS[`${b.id}Done`] ?? [];
    if (b.id === 'mother') {
      this.save.water.throne = 1;
      this.say(done, () => { this.ended = true; this.setFlag('ending'); this.emit({ k: 'ending', full: this.completion().pct >= 100 }); this.emit({ k: 'save' }); });
    } else this.say(done, () => this.emit({ k: 'save' }));
  }

  bossFrog(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body;
    const W = 64, H = 50;
    if (b.st !== 'hop') b.face = lead.x > b.x ? 1 : -1;
    const body: Rect = { x: b.x - W / 2, y: b.y - H, w: W, h: H };
    // hit where it is painted (the scene draws it from (x, y + 2)); its body still moves it
    b.hurt.push(bossArtBox(b, 'boss-frog', b.x, b.y + 2, b.face > 0, 0.85)); b.body = body;
    const cycle = b.phase === 1 ? ['hop', 'spit', 'hop', 'spit'] : b.phase === 2 ? ['hop', 'tongue', 'spit', 'hop'] : ['hop', 'spit', 'tongue', 'hop', 'tongue'];
    switch (b.st) {
      case 'intro': if (b.t > 60) this.go('idle', 50); break;
      case 'idle': if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; this.go(`${nx}Tell`, nx === 'hop' ? 40 : 38, true); } break;
      case 'hopTell': if (b.t > b.dur) { b.sx = b.x; b.sy = clamp(lead.x, rr.x + 60, rr.x + rr.w - 70); this.go('hop', 50 / this.bossSpeed * this.bossSpeed); this.sfx('hop', b.x, b.y); } break;
      case 'hop': {
        const p = clamp(b.t / 50, 0, 1);
        b.x = b.sx + (b.sy - b.sx) * p; b.y = floor - Math.sin(Math.PI * p) * 72;
        b.harm.push(bossArtBox(b, 'boss-frog', b.x, b.y + 2, b.face > 0, 0.62));
        if (p >= 1) {
          b.y = floor; this.emit({ k: 'shake', n: 7 }); this.sfx('quake', b.x, b.y);
          if (b.phase >= 2) for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 34, y: floor, dir: d, speed: 2.2 * this.bossSpeed, life: 90, h: 12, dmg: BOSSES.frog.atk });
          this.go('idle', b.phase === 3 ? 34 : 46);
        }
        break;
      }
      case 'spitTell': if (b.t > b.dur) {
        const n = b.phase === 3 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const tx = clamp(lead.x + (i - (n - 1) / 2) * 34, rr.x + 20, rr.x + rr.w - 20), time = (44 + i * 10) / this.bossSpeed;
          const g = 0.18 * this.bossSpeed * this.bossSpeed;
          const sy = b.y - 40, vy = ((floor - 8 - sy) - 0.5 * g * time * time) / time;
          this.shots.push({ id: this.nextId++, kind: 'water', friendly: false, x: b.x + b.face * 26, y: sy, vx: (tx - b.x - b.face * 26) / time, vy, g, life: 240, dmg: BOSSES.frog.atk, r: 6, hits: [] });
        }
        this.sfx('spit', b.x, b.y); this.go('idle', 52);
      } break;
      case 'tongueTell': if (b.t > b.dur) this.go('tongue', 26); break;
      case 'tongue': {
        const p = b.t < 13 ? b.t / 13 : 1 - (b.t - 13) / 13;
        const len = 230 * clamp(p, 0, 1);
        b.harm.push({ x: b.face > 0 ? b.x + 20 : b.x - 20 - len, y: floor - 24, w: len, h: 9 });
        if (b.t > 26) this.go('idle', 44);
        break;
      }
    }
  }

  bossHydra(b: Boss) {
    const lead = this.body, sp = this.bossSpeed;
    b.body = { x: b.x - 34, y: b.y - 100, w: 68, h: 100 };
    // the coiled body is tough; the heads take more
    b.hurt.push(Object.assign({ ...b.body }, { mul: 0.5 }));
    for (const h of b.heads) {
      h.t += sp;
      const sway = Math.sin((this.tick + h.bx) * 0.03) * 6;
      if (h.st === 'idle') { h.x += (h.bx + sway - h.x) * 0.1; h.y += (h.by - h.y) * 0.1; }
      else if (h.st === 'aim') {
        h.x += (h.bx + 24 - h.x) * 0.1; h.y += (h.by - 14 - h.y) * 0.1;
        // the head picks its spot well before it strikes (and can only reach so far), so a step aside dodges it
        const dur = 50 * this.tellMul, lockAt = dur - 28 * this.tellMul;
        if (h.t >= lockAt && h.t - sp < lockAt) {
          const dx = lead.x - h.bx, dy = lead.y - 12 - h.by, d = Math.hypot(dx, dy), k = d > 250 ? 250 / d : 1;
          h.tx = h.bx + dx * k; h.ty = h.by + dy * k; this.markers.push({ x: h.tx, y: this.floorY(), t: 28 * this.tellMul, kind: 'aim' });
        }
        if (h.t > dur) { h.st = 'lunge'; h.t = 0; this.sfx('snap', h.x, h.y); }
      }
      else if (h.st === 'lunge') { const p = clamp(h.t / 14, 0, 1); h.x = h.x + (h.tx - h.x) * p; h.y = h.y + (h.ty - h.y) * p; if (h.t > 14) { h.st = 'hold'; h.t = 0; } }
      else if (h.st === 'hold') { if (h.t > 30) { h.st = 'back'; h.t = 0; } }
      else if (h.st === 'back') { h.x += (h.bx - h.x) * 0.1; h.y += (h.by - h.y) * 0.1; if (h.t > 24) { h.st = 'idle'; h.t = 0; } }
      const hr = { x: h.x - 14, y: h.y - 11, w: 28, h: 22 };
      if (h.st === 'lunge' || (h.st === 'hold' && h.t < 8)) b.harm.push(hr);
      if (h.st === 'hold' || h.st === 'back') b.hurt.push(Object.assign(hr, { mul: 1.5 }));
      if (h.st === 'aim') b.tellT = Math.max(b.tellT, 2);
    }
    switch (b.st) {
      case 'intro': if (b.t > 70) this.go('idle', 60); break;
      case 'idle': if (b.t > b.dur) {
        const free = b.heads.filter((h) => h.st === 'idle');
        if (b.phase === 3 && free.length === 3 && b.step % 2 === 1) {
          b.heads.forEach((h, i) => { h.st = 'aim'; h.t = -i * 30; });
          this.sfx('tell', b.x, b.y); this.emit({ k: 'flash', color: '#d8ffb0', n: 4 });
          this.go('idle', 150);
        } else if (free.length) {
          const h = free[b.step % free.length]; h.st = 'aim'; h.t = 0;
          this.sfx('tell', h.x, h.y); this.emit({ k: 'flash', color: '#d8ffb0', n: 3 });
          this.go(b.phase >= 2 && b.step % 3 === 2 ? 'seedTell' : 'idle', b.phase >= 2 && b.step % 3 === 2 ? 40 : 80, b.phase >= 2 && b.step % 3 === 2);
        } else this.go('idle', 20);
        b.step++;
      } break;
      case 'seedTell': if (b.t > b.dur) {
        const h = b.heads[1];
        for (let i = 0; i < 3; i++) {
          const time = (46 + i * 8) / sp, g = 0.16 * sp * sp, tx = lead.x + (i - 1) * 40;
          const vy = ((this.floorY() - 6 - h.y) - 0.5 * g * time * time) / time;
          this.shots.push({ id: this.nextId++, kind: 'seed', friendly: false, x: h.x, y: h.y, vx: (tx - h.x) / time, vy, g, life: 240, dmg: BOSSES.hydra.atk, r: 5, hits: [] });
        }
        this.sfx('spit', h.x, h.y); this.go('idle', 60);
      } break;
    }
  }

  bossPuma(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body, sp = this.bossSpeed;
    const W = 54, H = 32;
    const body: Rect = { x: b.x - W / 2, y: b.y - H, w: W, h: H };
    if (b.vis > 0.5) b.hurt.push(bossArtBox(b, 'boss-puma', b.x, b.y + 2, b.face > 0, 0.85));
    b.body = body;
    const left = rr.x + 2 * TILE + 30, right = rr.x + rr.w - TILE - 30;
    switch (b.st) {
      case 'intro': if (b.t > 70) this.go('prowl', 60); break;
      case 'prowl': {
        b.face = lead.x > b.x ? 1 : -1; b.x = clamp(b.x + b.face * 0.9 * sp, left, right);
        if (b.t > b.dur) {
          const opts = b.phase === 1 ? ['pounce', 'dash'] : b.phase === 2 ? ['pounce', 'mural', 'dash'] : ['pounce', 'mural', 'pounce', 'dash'];
          const nx = opts[b.step++ % opts.length];
          if (nx === 'mural') { b.side = lead.x > rr.x + rr.w / 2 ? -1 : 1; this.go('muralTell', 56, true); }
          else this.go(`${nx}Tell`, nx === 'pounce' ? 40 : 36, true);
        }
        break;
      }
      case 'pounceTell': b.face = lead.x > b.x ? 1 : -1; if (b.t > b.dur) { b.sx = b.x; b.sy = clamp(lead.x, left, right); this.go('pounce', 44); this.sfx('roar', b.x, b.y); } break;
      case 'pounce': {
        const p = clamp(b.t / 44, 0, 1);
        b.x = b.sx + (b.sy - b.sx) * p; b.y = floor - Math.sin(Math.PI * p) * 84;
        b.harm.push(bossArtBox(b, 'boss-puma', b.x, b.y + 2, b.face > 0, 0.62));
        if (p >= 1) {
          b.y = floor; this.emit({ k: 'shake', n: 5 }); this.sfx('land', b.x, b.y);
          if (b.phase === 3) for (const vx of [-2, -1, 1, 2]) this.shots.push({ id: this.nextId++, kind: 'paint', friendly: false, x: b.x, y: b.y - 20, vx: vx * sp, vy: -4 * sp, g: 0.18 * sp * sp, life: 200, dmg: BOSSES.puma.atk, r: 5, hits: [] });
          this.go('land', 40);
        }
        break;
      }
      case 'land': if (b.t > b.dur) this.go('prowl', 50); break;
      case 'dashTell': b.face = lead.x > b.x ? 1 : -1; if (b.t > b.dur) { this.go('dash', 200); this.sfx('roar', b.x, b.y); } break;
      case 'dash': case 'leap': {
        b.vis = 1;
        b.x += b.face * 5 * sp;
        b.harm.push(bossArtBox(b, 'boss-puma', b.x, b.y + 2, b.face > 0, 0.62));
        if (b.x <= left || b.x >= right) { b.x = clamp(b.x, left, right); this.go('skid', 34); this.emit({ k: 'shake', n: 3 }); }
        break;
      }
      case 'skid': if (b.t > b.dur) this.go('prowl', 50); break;
      case 'muralTell': {
        b.vis = Math.max(0, 1 - b.t / 20);
        if (b.t > b.dur) { b.x = b.side < 0 ? left : right; b.face = (-b.side) as 1 | -1; b.y = floor; this.go('leap', 200); this.sfx('roar', b.x, b.y); }
        break;
      }
    }
  }

  bossWarden(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body, sp = this.bossSpeed;
    const highBottom = rr.y + 150, lowBottom = floor - 6;
    const bottom = highBottom + (lowBottom - highBottom) * b.low;
    const body: Rect = { x: b.x - 52, y: bottom - 112, w: 104, h: 112 };
    b.hurt.push(body); b.body = body;
    const restArm = (i: number) => ({ x: b.x + (i ? 90 : -90), y: bottom - 30 + Math.sin(this.tick * 0.04 + i) * 4 });
    const swingArm = (i: number, p: number) => {
      const from = i === 0 ? rr.x + 40 : rr.x + rr.w - 40, to = i === 0 ? rr.x + rr.w - 40 : rr.x + 40;
      return { x: from + (to - from) * p, y: floor - 13 };
    };
    for (let i = 0; i < 2; i++) b.arms[i] = b.arms[i] ?? restArm(i);
    const armsRest = () => { for (let i = 0; i < 2; i++) { const r = restArm(i); b.arms[i].x += (r.x - b.arms[i].x) * 0.12; b.arms[i].y += (r.y - b.arms[i].y) * 0.12; } };
    const cycle = b.phase === 1 ? ['swing', 'toll', 'swing', 'bells'] : b.phase === 2 ? ['swing2', 'toll', 'bells', 'swing2', 'toll'] : ['swing2', 'toll', 'bells', 'toll', 'swing2'];
    switch (b.st) {
      case 'intro': armsRest(); if (b.t > 80) this.go('hang', 60); break;
      case 'hang': armsRest(); b.low = Math.max(0, b.low - 0.03); if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; b.side = (b.step % 2 ? 1 : -1); this.go(`${nx}Tell`, 46, true); } break;
      case 'swingTell': case 'swing2Tell': {
        const i = b.side > 0 ? 0 : 1;
        const start = { x: i === 0 ? rr.x + 40 : rr.x + rr.w - 40, y: floor - 13 };
        armsRest(); b.arms[i].x += (start.x - b.arms[i].x) * 0.15; b.arms[i].y += (rr.y + 70 - b.arms[i].y) * 0.15;
        if (b.t > b.dur) this.go(b.st === 'swingTell' ? 'swing' : 'swing2', b.st === 'swingTell' ? 64 : 110);
        break;
      }
      case 'swing': case 'swing2': {
        const i0 = b.side > 0 ? 0 : 1;
        armsRest();
        const run = (i: number, t0: number) => {
          const p = clamp((b.t - t0) / 64, 0, 1);
          if (b.t < t0 || p >= 1) return;
          const a = swingArm(i, p); b.arms[i].x = a.x; b.arms[i].y = a.y;
          b.harm.push({ x: a.x - 14, y: a.y - 12, w: 28, h: 24 });
          if (Math.floor(b.t) % 8 === 0) this.sfx('whoosh', a.x, a.y);
        };
        run(i0, 0);
        if (b.st === 'swing2') { if (b.t > 44 && b.t < 46) { this.sfx('tell', b.x, b.y); } run(1 - i0, 46); }
        if (b.t > b.dur) this.go('hang', 40);
        break;
      }
      case 'tollTell': armsRest(); if (b.t > b.dur) this.go('drop', 16); break;
      case 'drop': {
        armsRest();
        b.low = clamp(b.t / 16, 0, 1);
        if (b.low > 0.6) b.harm.push(this.shrink(body, 8));
        if (b.t >= 16) {
          b.low = 1; this.emit({ k: 'shake', n: 10 }); this.sfx('toll', b.x, b.y); this.emit({ k: 'pulse', x: b.x, y: floor - 20, r: 260, color: [1, 0.75, 0.35] });
          for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 56, y: floor, dir: d, speed: 2.6 * sp, life: 220, h: 14, dmg: BOSSES.warden.atk });
          this.go('rest', b.phase === 3 ? 120 : 110);
        }
        break;
      }
      case 'rest': {
        armsRest();
        if (b.phase === 3 && b.t >= 40 && b.t < 40 + sp) for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 56, y: floor, dir: d, speed: 2.6 * sp, life: 220, h: 14, dmg: BOSSES.warden.atk });
        if (b.t > b.dur) this.go('rise', 30);
        break;
      }
      case 'rise': armsRest(); b.low = clamp(1 - b.t / 30, 0, 1); if (b.t > b.dur) this.go('hang', 50); break;
      case 'bellsTell': {
        armsRest();
        if (b.t < sp) {
          const n = b.phase === 1 ? 3 : b.phase === 2 ? 4 : 5;
          const xs = [clamp(lead.x, rr.x + 30, rr.x + rr.w - 30)];
          while (xs.length < n) { const x = rr.x + 40 + this.rand() * (rr.w - 80); if (xs.every((o) => Math.abs(o - x) > 60)) xs.push(x); }
          for (const x of xs) this.markers.push({ x, y: floor, t: (b.dur + 10), kind: 'bell' });
        }
        if (b.t > b.dur) this.go('hang', 70);
        break;
      }
    }
  }

  bossMother(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body, sp = this.bossSpeed;
    b.face = -1;
    // her body is where she is painted: the scene draws her from (x + 40, y + 2)
    b.body = bossArtBox(b, 'boss-mother', b.x + 40, b.y + 2, false, 0.85);
    b.hurt.push(b.body);
    const cycle = b.phase === 1 ? ['sweep', 'bubbles', 'sweep'] : b.phase === 2 ? ['sweep', 'rise', 'bubbles', 'sweep'] : ['sweep', 'lilies', 'bubbles', 'sweep', 'lilies'];
    switch (b.st) {
      case 'intro': if (b.t > 90) this.go('idle', 60); break;
      case 'idle': if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; this.go(`${nx}Tell`, nx === 'sweep' ? 55 : 44, true); } break;
      case 'sweepTell': if (b.t > b.dur) this.go('sweep', 56); break;
      case 'sweep': {
        const p = clamp(b.t / 56, 0, 1);
        const x = b.x - 60 - (b.x - 60 - (rr.x + 30)) * p;
        b.arms[0] = { x, y: floor - 10 };
        b.harm.push({ x: x - 18, y: floor - 20, w: 36, h: 20 });
        if (b.t > 56) { b.arms = []; this.go('idle', 50); }
        break;
      }
      case 'bubblesTell': if (b.t > b.dur) {
        for (let i = 0; i < 4; i++) this.shots.push({ id: this.nextId++, kind: 'bubble', friendly: false, x: b.x - 70, y: b.y - 60 - i * 10, vx: -0.6 - i * 0.1, vy: -0.3 + i * 0.2, g: 0, life: 300, dmg: BOSSES.mother.atk - 2, r: 7, hits: [] });
        this.sfx('bubble', b.x, b.y); this.go('idle', 70);
      } break;
      case 'riseTell': if (b.t > b.dur) { this.arenaWater = { row: 13, t: 420 }; this.sfx('flood', b.x, b.y); this.go('idle', 60); } break;
      case 'liliesTell': if (b.t < sp) {
        const xs = [clamp(lead.x, rr.x + 40, b.x - 120)];
        while (xs.length < 5) { const x = rr.x + 40 + this.rand() * (b.x - 160 - rr.x); if (xs.every((o) => Math.abs(o - x) > 50)) xs.push(x); }
        for (const x of xs) this.markers.push({ x, y: floor, t: b.dur + 10, kind: 'lily' });
      } if (b.t > b.dur) this.go('idle', 70); break;
    }
  }

  // ─── the wisp: a little light that shows the way when you seem lost ──────
  /** The next thing the story wants: the abilities and guardians in their order, then the coat, Ukumari and the
   * Lake Mother. Null once everything is done. */
  nextGoal(): { room: string; x: number; y: number } | null {
    const find = (pred: (t: Thing, r: Room) => boolean) => { for (const i of INFO.values()) for (const t of i.things) if (pred(t, i.room)) return t; return null; };
    const steps: [() => boolean, (t: Thing, r: Room) => boolean][] = [
      [() => this.has('dash'), (t, r) => t.ch === 'A' && r.ability === 'dash'],
      [() => this.flag('boss:frog'), (t, r) => t.ch === 'O' && r.boss === 'frog'],
      [() => this.has('double'), (t, r) => t.ch === 'A' && r.ability === 'double'],
      [() => this.flag('boss:hydra'), (t, r) => t.ch === 'O' && r.boss === 'hydra'],
      [() => this.has('wallkick'), (t, r) => t.ch === 'A' && r.ability === 'wallkick'],
      [() => this.flag('boss:puma'), (t, r) => t.ch === 'O' && r.boss === 'puma'],
      [() => this.has('chime'), (t, r) => t.ch === 'A' && r.ability === 'chime'],
      [() => this.flag('boss:warden'), (t, r) => t.ch === 'O' && r.boss === 'warden'],
      [() => this.has('deep'), (t, r) => t.ch === 'C' && r.chests?.[t.i] === 'ability:deep'],
      [() => this.flag('keeper'), (t) => t.ch === 'U'],
      [() => this.flag('boss:mother'), (t, r) => t.ch === 'O' && r.boss === 'mother'],
    ];
    if (ABILITY_ORDER.every((a) => this.has(a)) && this.restless().length) {
      // every ability owned but seals still shut: the nearest restless guardian
      const here = this.room;
      const dist = (t: Thing) => { const r = roomOfTile(t.c, t.r)!; return Math.hypot(r.gx + r.w / 2 - here.gx - here.w / 2, r.gy + r.h / 2 - here.gy - here.h / 2); };
      const cands = this.restless().map((id) => find((t, r) => t.ch === 'O' && r.boss === id)).filter((t): t is Thing => !!t);
      cands.sort((a, b) => dist(a) - dist(b));
      const t = cands[0];
      if (t) return { room: t.room, x: t.c * TILE + 8, y: t.r * TILE };
    }
    for (const [done, pred] of steps) {
      if (done()) continue;
      const t = find(pred);
      return t ? { room: t.room, x: t.c * TILE + 8, y: t.r * TILE } : null;
    }
    return null;
  }
  /** Where the wisp should float: the goal itself when it is in this room, else the doorway towards it (a search over
   * rooms, skipping doorways behind doors that are shut). */
  wayToGoal(): { x: number; y: number } | null {
    const goal = this.nextGoal();
    if (!goal) return null;
    if (goal.room === this.room.id) return goal;
    const shut = (l: Link) => [l.from, l.to].some((id) => INFO.get(id)!.doors.some((d) => !this.doorOpen(d) && l.c >= d.c - 2 && l.c <= d.c + d.w + 1 && l.r >= d.r - 1 && l.r <= d.r + d.h));
    const prev = new Map<string, Link | null>([[this.room.id, null]]);
    const queue = [this.room.id];
    while (queue.length && !prev.has(goal.room)) {
      const id = queue.shift()!;
      for (const l of LINKS.get(id)!) if (!prev.has(l.to) && !shut(l)) { prev.set(l.to, l); queue.push(l.to); }
    }
    if (!prev.has(goal.room)) return goal;
    let l = prev.get(goal.room)!;
    while (l.from !== this.room.id) l = prev.get(l.from)!;
    // the middle of that doorway
    const same = LINKS.get(this.room.id)!.filter((o) => o.to === l.to && Math.abs(o.c - l.c) + Math.abs(o.r - l.r) < 6);
    const mx = same.reduce((a, o) => a + o.c, 0) / same.length, my = same.reduce((a, o) => a + o.r, 0) / same.length;
    return { x: mx * TILE + 8, y: my * TILE + 4 };
  }
  /** Is the guiding wisp shown: the helping hand on (never in Strict), its own setting not off, and a goal left. */
  wispOn() { return this.settings.assist && !this.settings.strict && this.settings.wisp !== false && !this.flag('ending'); }
  /** The guiding wisp: while the helping hand is on it is always there, a little ahead of the lead along the way to
   *  the next goal (over the goal itself once it is in this room). It keeps clear of the heroes' faces, drifts up to
   *  a corner in a guardian's arena, and never touches the game: it only moves. */
  updateWisp() {
    const w = this.wisp, b = this.body;
    if (!this.wispOn()) { w.on = false; this.wispPath = []; return; }
    const head = { x: b.x, y: b.y - 30 };
    if (!w.on) { w.on = true; w.x = head.x + b.face * 26; w.y = head.y - 10; w.tx = w.x; w.ty = w.y; }
    let tx: number, ty: number;
    if (this.boss) {
      // out of the fight: up in the arena's far corner from the lead
      const rr = this.bossRoomRect();
      tx = b.x < rr.x + rr.w / 2 ? rr.x + rr.w - 28 : rr.x + 28; ty = rr.y + 30; this.wispPath = [];
    } else {
      if (this.tick % 20 === 0 || !this.wispPath.length) {
        const goal = this.wispGoal?.(this) ?? null;
        this.wispPath = goal ? this.flightPath(b.x, b.y - 20, goal.x, goal.y) : [];
      }
      // the point about 56 px along the way from the lead (or the end, if nearer)
      let left = 56, px = b.x, py = b.y - 20;
      for (const p of this.wispPath) {
        const d = Math.hypot(p.x - px, p.y - py);
        if (d >= left) { px += ((p.x - px) / d) * left; py += ((p.y - py) / d) * left; left = 0; break; }
        left -= d; px = p.x; py = p.y;
      }
      if (!this.wispPath.length) { px = head.x - b.face * 20; py = head.y - 18; }
      tx = px; ty = py;
    }
    // never over a face: at least 24 px from the lead's head
    const hx = tx - head.x, hy = ty - head.y, hd = Math.hypot(hx, hy);
    if (hd < 24) { const k = hd < 0.01 ? 0 : 24 / hd; tx = hd < 0.01 ? head.x : head.x + hx * k; ty = hd < 0.01 ? head.y - 24 : head.y + hy * k; }
    w.tx = tx; w.ty = ty;
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy), v = Math.min(3, 0.8 + d * 0.06);
    if (d > v) { w.x += (dx / d) * v; w.y += (dy / d) * v; } else { w.x = tx; w.y = ty; }
  }
  /** A flight through open tiles of this room (never through stone or a shut door), as a few waypoints. */
  flightPath(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
    const room = this.room, c0 = room.gx * COLS, r0 = room.gy * ROWS, W = room.w * COLS, H = room.h * ROWS;
    const open = (c: number, r: number) => c >= c0 && r >= r0 && c < c0 + W && r < r0 + H && !this.solidTile(c, r) && rawChar(c, r) !== '^';
    const near = (c: number, r: number): [number, number] => {
      if (open(c, r)) return [c, r];
      for (let k = 1; k < 4; k++) for (const [dc, dr] of [[0, -k], [-k, 0], [k, 0], [0, k]]) if (open(c + dc, r + dr)) return [c + dc, r + dr];
      return [c, r];
    };
    const [sc, sr] = near(Math.floor(x0 / TILE), Math.floor(y0 / TILE));
    const [ec, er] = near(Math.floor(x1 / TILE), Math.floor(y1 / TILE));
    const key = (c: number, r: number) => (r - r0) * W + (c - c0);
    const prev = new Map<number, number>([[key(sc, sr), -1]]);
    const queue: [number, number][] = [[sc, sr]];
    while (queue.length) {
      const [c, r] = queue.shift()!;
      if (c === ec && r === er) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, k = key(nc, nr);
        if (!open(nc, nr) || prev.has(k)) continue;
        prev.set(k, key(c, r)); queue.push([nc, nr]);
      }
    }
    if (!prev.has(key(ec, er))) return [{ x: x1, y: y1 }];
    const tiles: number[] = [];
    for (let k = key(ec, er); k !== -1; k = prev.get(k)!) tiles.push(k);
    tiles.reverse();
    // a waypoint at every turn, so each leg is a straight run along open tiles (no corner is ever cut)
    const at = (k: number) => ({ c: k % W, r: Math.floor(k / W) });
    const keep = tiles.filter((k, i) => {
      if (i === 0 || i === tiles.length - 1) return true;
      const a = at(tiles[i - 1]), b = at(k), c = at(tiles[i + 1]);
      return b.c - a.c !== c.c - b.c || b.r - a.r !== c.r - b.r;
    });
    return keep.map((k) => ({ x: (c0 + (k % W)) * TILE + 8, y: (r0 + Math.floor(k / W)) * TILE + 8 }));
  }

  // ─── menus (called by the page) ──────────────────────────────────────────
  buy(id: string): string | null {
    const item = SHOP.find((s) => s.id === id);
    if (!item) return 'Not for sale.';
    if (item.id in GEAR && this.save.gear.includes(item.id)) return 'You already have one.';
    if (this.save.coins < item.price) return `Not enough coins: it costs ${item.price}.`;
    this.save.coins -= item.price;
    if (item.id === 'cake' || item.id === 'tea') this.save.food[item.id]++;
    else this.save.gear.push(item.id);
    this.sfx('buy');
    return null;
  }
  equip(hero: HeroId, slot: Slot, id: string | null): string | null {
    if (id !== null) {
      const g = GEAR[id];
      if (!g || !this.save.gear.includes(id)) return 'You don’t have that.';
      if (g.slot !== slot) return 'That doesn’t go there.';
      if (g.hero && g.hero !== hero) return `Only ${g.hero === 'dora' ? 'Dora' : 'Enzo'} can use the ${g.name}.`;
      const o = other(hero);
      if (this.save.equip[o][slot] === id) this.save.equip[o][slot] = null;
    } else if (slot === 'weapon') return 'Every hero needs a weapon.';
    this.save.equip[hero][slot] = id;
    for (const h of ALL_HEROES) this.clampHero(h);
    this.sfx('equip');
    return null;
  }
  eat(food: FoodId): string | null {
    if (this.save.food[food] <= 0) return `No ${FOOD[food].name} left.`;
    if (food === 'cake') {
      const s = this.leadSave, st = this.stats(this.lead);
      if (s.hp >= st.maxHp) return `${this.lead === 'dora' ? 'Dora' : 'Enzo'} is already at full HP.`;
      const was = s.hp;
      s.hp += Math.round(st.maxHp * 0.4);
      this.clampHero(this.lead);
      this.emit({ k: 'num', x: this.body.x, y: this.body.y - 30, n: s.hp - was, kind: 'heal' });
    } else {
      for (const h of ALL_HEROES) { const s = this.save.heroes[h], st = this.stats(h); if (s.down) { s.down = false; s.hp = Math.round(st.maxHp * 0.5); } s.mp += Math.round(st.maxMp * 0.5); }
    }
    this.save.food[food]--;
    for (const h of ALL_HEROES) this.clampHero(h);
    this.sfx('eat');
    return null;
  }
  litShrines() { return ROOMS.filter((r) => this.flag(`shrine:${r.id}`) || r.id === this.save.shrine).map((r) => r.id); }
  /** Standing at a candle shrine (close enough that ↑ would use it). */
  atShrine() { return this.nearby()?.ch === 'S'; }
  /** Attack opens travel instead of swinging: the lead on the ground at a lit shrine, no guardian fight, and no awake
   *  foe within about 80 px (so a fight at a shrine still swings). */
  canOpenTravel() {
    const b = this.body;
    if (!b.ground || b.swim || b.climb || this.dialog || !this.atShrine() || !this.litShrines().includes(this.room.id)) return false;
    if (this.boss && !this.boss.calm && this.boss.st !== 'wait') return false;
    return !this.enemies.some((e) => e.alive && !e.hidden && e.st !== 'sleep' && Math.hypot(e.x - b.x, e.y - b.y) < 80);
  }
  /** Why travel to a shrine can't happen now, or null if it can. Travel never heals: only resting does. */
  whyNotTravel(id: string): string | null {
    if (this.boss && !this.boss.calm && this.boss.st !== 'wait') return 'You can’t leave in the middle of a boss fight.';
    if (!this.litShrines().includes(id)) return 'Light that shrine first by resting at it.';
    if (id === this.room.id) return 'You are here.';
    if (this.settings.strict && !this.atShrine()) return 'In strict mode you can only travel from a candle shrine.';
    return null;
  }
  travel(id: string): string | null {
    const why = this.whyNotTravel(id);
    if (why) return why;
    const spot = this.shrineSpot(id)!;
    Object.assign(this.body, newBody(spot.x, spot.y));
    this.enterRoom(roomOfPoint(spot.x, spot.y - 4)!, true);
    this.follower.x = spot.x - 24; this.follower.y = spot.y; this.trail = [];
    this.safe = { ...spot };
    this.sfx('warp');
    this.emit({ k: 'travel', id });
    this.note(`Arrived at the ${SHRINE_NAMES[id] ?? AREAS[roomById(id)!.area].name}.`, true);
    return null;
  }

  completion() {
    const C = COMPLETION;
    let chests = 0, peds = 0;
    for (const info of INFO.values()) for (const t of info.things) {
      if (t.ch === 'C' && this.flag(`chest:${info.room.id}:${t.i}`)) chests++;
      if (t.ch === 'A' && info.room.ability && this.has(info.room.ability)) peds++;
    }
    const murals = MURALS.filter((_, i) => this.flag(`mural:${i}`)).length;
    const bosses = (Object.keys(BOSSES) as BossId[]).filter((id) => this.flag(`boss:${id}`)).length;
    const cells = this.save.seen.length;
    const got = cells + chests + peds + murals + bosses, total = C.cells + C.chests + C.pedestals + C.murals + C.bosses;
    return { cells, chests, peds, murals, bosses, got, total, pct: Math.floor((got / total) * 100) };
  }

  /** A copy of the save for storing: the hero's place is the last shrine. */
  snapshot(): Save { return JSON.parse(JSON.stringify(this.save)); }

  // ─── debug helpers for the browser tests and bots ────────────────────────
  teleport(roomId: string, c: number, r: number) {
    const room = roomById(roomId);
    const x = (room.gx * COLS + c) * TILE + 8, y = (room.gy * ROWS + r + 1) * TILE;
    Object.assign(this.body, newBody(x, y));
    this.enterRoom(room, true);
    this.follower.x = x - 24; this.follower.y = y; this.trail = [];
    this.safe = { x, y };
    this.dialog = null;
  }
  setWater(area: WaterArea, level: 0 | 1) { this.save.water[area] = level; const row = surfaceRow(this.room, this.save.water); if (row !== null) this.waterY.set(this.room.id, surfaceY(this.room, row)); else this.waterY.delete(this.room.id); this.floatCache = this.floatList(); }
  unlockMap() { for (const k of CELLS.keys()) if (!this.save.seen.includes(k)) this.save.seen.push(k); }
  setHp(hero: HeroId, hp: number) { const s = this.save.heroes[hero]; s.hp = hp; if (hp > 0) s.down = false; this.clampHero(hero); if (hp <= 0 && hero === this.lead) this.downLead(); else if (hp <= 0) s.down = true; }
  fightBoss(id: BossId) {
    const room = ROOMS.find((r) => r.boss === id)!;
    this.save.flags = this.save.flags.filter((f) => f !== `boss:${id}`);
    const entryC = id === 'frog' ? 27 : 2, entryR = 14;
    this.teleport(room.id, entryC, entryR);
  }
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

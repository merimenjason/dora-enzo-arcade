// Echo Burrow's rules: a time-loop puzzle platformer for two. In each room one chinchilla records a run while the
// candle burns; then time rewinds and the other plays live beside a shimmering echo that replays the first run tick
// for tick. The echo presses plates, rides lifts, flips seesaws, lights glow-moss and can be stood on, but nothing
// ever pushes or blocks it, so there are no paradoxes. Deterministic at a fixed 60 ticks a second with no DOM and no
// randomness: the same inputs always give the same room, which is how the bot replays every stored solution.
import { ROOM_DEFS, CHAPTERS, type RoomDef, type ChapterId } from './echo-rooms.js';

export { ROOM_DEFS, CHAPTERS, type RoomDef, type ChapterId } from './echo-rooms.js';

// ---------------------------------------------------------------- numbers
export const T = 16, COLS = 24, ROWS = 13, WORLD_W = COLS * T, WORLD_H = ROWS * T;
export const TPS = 60, DT = 1 / TPS;
export const SAVE_KEY = 'echo-burrow-v1';
/** Gravity and the fastest fall, in world units (a tile is 16) per second. */
export const G = 1000, MAX_FALL = 420;
export type Who = 'dora' | 'enzo';
export const other = (w: Who): Who => (w === 'dora' ? 'enzo' : 'dora');
/**
 * The two of them. Dora is light and springy: a smaller box that fits one-tile kit tunnels, a higher jump (3 tiles),
 * and a weight of 1. Enzo is heavy and strong: a box two tiles tall, a 2-tile jump, weight 2 for heavy plates and
 * seesaws, and he pushes crates.
 */
export const KIT = {
  dora: { w: 10, h: 13, run: 96, accel: 1100, decel: 1500, air: 800, airDecel: 500, jump: 345, weight: 1 },
  enzo: { w: 14, h: 22, run: 78, accel: 900, decel: 1300, air: 650, airDecel: 420, jump: 288, weight: 2 },
} as const;
/** Jumping off the head of Dora's echo springs 25% faster. */
export const BOOST = 1.25;
/** Ticks of grace: jump just after walking off a ledge (coyote), or just before landing (buffer). */
export const COYOTE = 6, BUFFER = 6;
/** Releasing jump while rising keeps this much of the speed, for short hops. */
export const JUMP_CUT = 0.5;
/** Enzo's walking speed while shoving a crate. */
export const PUSH = 45;
/** Doors slide fully open or shut in 10 ticks; lifts move 48 units a second. */
export const DOOR_STEP = 1 / 10, LIFT_SPEED = 48;
/** Seesaws: four tiles wide, the low pad 6 above the floor and the high one 26; a fall faster than `impact` onto the
 *  high pad by a weight of 2 or more flips it and launches whatever stands on the other pad. */
export const SAW = { w: 64, pad: 24, low: 6, high: 26, mid: 16, impact: 90, launch: { dora: 470, enzo: 330, crate: 300 } } as const;
/** A crumbling ledge falls this many ticks after anyone stands on it, and stays gone until time rewinds. */
export const CRUMBLE_TICKS = 30;
/** Glow-moss is solid for the live climber while the echo is within this distance of it. */
export const MOSS_R = 52;
/** Wind lifts Dora (up to `cap`) but only slows Enzo's fall (to `cap`). */
export const FAN = { dora: { lift: 1900, cap: -130 }, enzo: { lift: 800, cap: 50 } } as const;
/** How long the rewind plays before the next loop starts. */
export const REWIND_TICKS = 42, RETRY_TICKS = 26;
const EPS = 1e-6;

// ---------------------------------------------------------------- input
export type Input = { x: -1 | 0 | 1; jump: boolean };
export const idleInput = (): Input => ({ x: 0, jump: false });
/** Input as bits: 1 left, 2 right, 4 jump. */
export const inputBits = (i: Input) => (i.x < 0 ? 1 : 0) | (i.x > 0 ? 2 : 0) | (i.jump ? 4 : 0);
export const bitsInput = (b: number): Input => ({ x: b & 1 ? -1 : b & 2 ? 1 : 0, jump: !!(b & 4) });
/** Run-length text for a list of inputs, like `R40 RJ12 _6`. */
export function encodeInputs(bits: ArrayLike<number>): string {
  const out: string[] = [];
  for (let i = 0; i < bits.length;) {
    let j = i; while (j < bits.length && bits[j] === bits[i]) j++;
    const b = bits[i], k = (b & 1 ? 'L' : '') + (b & 2 ? 'R' : '') + (b & 4 ? 'J' : '');
    out.push((k || '_') + (j - i)); i = j;
  }
  return out.join(' ');
}
export function decodeInputs(text: string): number[] {
  const out: number[] = [];
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = /^([LRJ_]+)(\d+)$/.exec(tok); if (!m) throw new Error(`bad input token "${tok}"`);
    const b = (m[1].includes('L') ? 1 : 0) | (m[1].includes('R') ? 2 : 0) | (m[1].includes('J') ? 4 : 0);
    for (let n = Number(m[2]); n > 0; n--) out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------- rooms
/** Tile kinds. */
export const AIR = 0, ROCK = 1, LEDGE = 2, CRUMBLE = 3, MOSS = 4, FAN_TILE = 5, KIT_ROCK = 6;
export type Plate = { c: number; r: number; g: number; heavy: boolean };
export type Door = { c: number; r: number; h: number; g: number };
export type LiftDef = { c: number; r: number; w: number; up: number; g: number };
export type SawDef = { c: number; r: number; down: 0 | 1 };
export type Wind = { c: number; top: number; bottom: number };
export type Room = {
  index: number; def: RoomDef; id: string; name: string; chapter: ChapterId; first: Who; second: Who;
  candle: number; par: number;
  tiles: Uint8Array; plates: Plate[]; doors: Door[]; lifts: LiftDef[]; saws: SawDef[]; winds: Wind[];
  crates: { c: number; r: number }[];
  start: Record<Who, { c: number; r: number }>; exit: { c: number; r: number }; seed: { c: number; r: number } | null;
  /** Per group (1 to 4): all its plates must be pressed (not just one), and how many ticks its doors stay open after. */
  all: boolean[]; hold: number[]; fanGroup: number;
};
const DOOR_LETTERS = 'ABCD';
const at = (c: number, r: number) => r * COLS + c;

/** Turns a room's text map into its tiles and pieces. Throws on a map it can't read; `validateRoom` checks the rest. */
export function parseRoom(index: number): Room {
  const def = ROOM_DEFS[index];
  if (!def) throw new Error(`no room ${index}`);
  const tiles = new Uint8Array(COLS * ROWS), plates: Plate[] = [], doors: Door[] = [], saws: SawDef[] = [], crates: { c: number; r: number }[] = [];
  const fans: { c: number; r: number }[] = [];
  const starts: Partial<Record<Who, { c: number; r: number }>> = {};
  let exit: { c: number; r: number } | null = null, seed: { c: number; r: number } | null = null;
  if (def.map.length !== ROWS) throw new Error(`${def.id}: the map has ${def.map.length} rows, not ${ROWS}`);
  def.map.forEach((row, r) => {
    if (row.length !== COLS) throw new Error(`${def.id}: row ${r} has ${row.length} columns, not ${COLS}`);
    [...row].forEach((ch, c) => {
      const i = at(c, r);
      switch (ch) {
        case '#': tiles[i] = ROCK; break;
        case 'k': tiles[i] = KIT_ROCK; break;
        case '=': tiles[i] = LEDGE; break;
        case '~': tiles[i] = CRUMBLE; break;
        case '%': tiles[i] = MOSS; break;
        case '^': tiles[i] = FAN_TILE; fans.push({ c, r }); break;
        case '.': break;
        case 'o': crates.push({ c, r }); break;
        case 'd': if (starts.dora) throw new Error(`${def.id}: two Doras`); starts.dora = { c, r }; break;
        case 'z': if (starts.enzo) throw new Error(`${def.id}: two Enzos`); starts.enzo = { c, r }; break;
        case 'e': if (exit) throw new Error(`${def.id}: two burrow doors`); exit = { c, r }; break;
        case '*': if (seed) throw new Error(`${def.id}: two golden seeds`); seed = { c, r }; break;
        case 'v': case 'V': saws.push({ c, r, down: ch === 'v' ? 0 : 1 }); break;
        default:
          if (ch >= '1' && ch <= '8') { const n = Number(ch); plates.push({ c, r, g: n > 4 ? n - 4 : n, heavy: n > 4 }); }
          else if (DOOR_LETTERS.includes(ch)) {
            const g = DOOR_LETTERS.indexOf(ch) + 1;
            if (r > 0 && def.map[r - 1][c] === ch) { const d = doors.find((x) => x.c === c && x.r + x.h === r && x.g === g); if (d) d.h++; }
            else doors.push({ c, r, h: 1, g });
          } else throw new Error(`${def.id}: unknown map character "${ch}" at ${c},${r}`);
      }
    });
  });
  if (!starts.dora || !starts.enzo) throw new Error(`${def.id}: needs a start for Dora (d) and Enzo (z)`);
  if (!exit) throw new Error(`${def.id}: needs a burrow door (e)`);
  // wind rises from each fan until the first solid tile
  const winds: Wind[] = fans.map(({ c, r }) => {
    let top = r - 1; while (top > 0 && tiles[at(c, top - 1)] === AIR) top--;
    return { c, top: top * T, bottom: r * T };
  });
  const all = [false, false, false, false, false], hold = [0, 0, 0, 0, 0];
  for (const g of def.all ?? []) all[g] = true;
  for (const [g, s] of Object.entries(def.hold ?? {})) hold[Number(g)] = Math.round(s * TPS);
  return {
    index, def, id: def.id, name: def.name, chapter: def.chapter, first: def.first, second: other(def.first),
    candle: Math.round(def.candle * TPS), par: def.par,
    tiles, plates, doors, lifts: (def.lifts ?? []).map((l) => ({ ...l })), saws, winds, crates,
    start: starts as Record<Who, { c: number; r: number }>, exit, seed, all, hold, fanGroup: def.fan ?? 0,
  };
}

/** Everything wrong with a room's data, as sentences; an empty list means the room is sound. */
export function validateRoom(index: number): string[] {
  const out: string[] = [];
  let R: Room;
  try { R = parseRoom(index); } catch (e) { return [(e as Error).message]; }
  const id = R.id, tile = (c: number, r: number) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? ROCK : R.tiles[at(c, r)]);
  const solidish = (c: number, r: number) => { const k = tile(c, r); return k === ROCK || k === KIT_ROCK || k === CRUMBLE || k === FAN_TILE || k === LEDGE || k === MOSS; };
  const ch = (c: number, r: number) => R.def.map[r][c];
  for (let c = 0; c < COLS; c++) { if (tile(c, 0) !== ROCK && tile(c, 0) !== KIT_ROCK) out.push(`${id}: the ceiling has a hole at column ${c}`); if (tile(c, ROWS - 1) !== ROCK && tile(c, ROWS - 1) !== KIT_ROCK) out.push(`${id}: the floor has a hole at column ${c}`); }
  for (let r = 0; r < ROWS; r++) { if (tile(0, r) !== ROCK && tile(0, r) !== KIT_ROCK) out.push(`${id}: the left wall has a hole at row ${r}`); if (tile(COLS - 1, r) !== ROCK && tile(COLS - 1, r) !== KIT_ROCK) out.push(`${id}: the right wall has a hole at row ${r}`); }
  if (!CHAPTERS.some((c) => c.id === R.chapter)) out.push(`${id}: unknown chapter ${R.chapter}`);
  if (!(R.candle >= 10 * TPS && R.candle <= 26 * TPS)) out.push(`${id}: the candle burns ${R.candle / TPS} s, not 10 to 26`);
  if (!(R.par >= 2 && R.par <= 6)) out.push(`${id}: par ${R.par} loops is out of range`);
  if (!R.def.hint || R.def.hint.length > 140) out.push(`${id}: needs a short hint`);
  // the starts stand on floor with room above; Enzo needs two tiles of headroom
  for (const who of ['dora', 'enzo'] as Who[]) {
    const s = R.start[who], need = who === 'enzo' ? 2 : 1;
    if (!solidish(s.c, s.r + 1)) out.push(`${id}: ${who} starts in mid-air`);
    for (let k = 1; k < need; k++) if (tile(s.c, s.r - k) !== AIR || DOOR_LETTERS.includes(ch(s.c, s.r - k))) out.push(`${id}: ${who} has no headroom at the start`);
  }
  if (!solidish(R.exit.c, R.exit.r + 1)) out.push(`${id}: the burrow door floats`);
  if (tile(R.exit.c, R.exit.r - 1) !== AIR) out.push(`${id}: the burrow door needs two tiles of height`);
  for (const p of R.plates) if (!solidish(p.c, p.r + 1)) out.push(`${id}: plate ${p.g} at ${p.c},${p.r} has no floor under it`);
  for (const p of R.crates) if (!solidish(p.c, p.r + 1) && !R.def.map[p.r + 1]?.[p.c]?.match(/[o]/)) out.push(`${id}: a crate at ${p.c},${p.r} floats`);
  // every plate group drives something, and every door has plates
  const used = new Set<number>();
  for (const d of R.doors) used.add(d.g);
  for (const l of R.lifts) used.add(l.g);
  if (R.fanGroup) used.add(R.fanGroup);
  for (const p of R.plates) if (!used.has(p.g)) out.push(`${id}: plate group ${p.g} opens nothing`);
  for (const g of used) if (!R.plates.some((p) => p.g === g)) out.push(`${id}: group ${g} has no plate`);
  for (const d of R.doors) { if (!solidish(d.c, d.r - 1)) out.push(`${id}: door ${DOOR_LETTERS[d.g - 1]} at ${d.c},${d.r} has no lintel to slide into`); }
  // lifts run through open air, with a plank that fits
  for (const l of R.lifts) {
    if (l.w < 1 || l.up < 1 || l.c < 1 || l.c + l.w > COLS - 1) out.push(`${id}: a lift has a bad size`);
    for (let k = 0; k <= l.up; k++) for (let c = l.c; c < l.c + l.w; c++) { const r = l.r - k; if (k > 0 && tile(c, r) !== AIR) out.push(`${id}: the lift at ${l.c},${l.r} runs into rock at ${c},${r}`); }
    if (!R.plates.some((p) => p.g === l.g)) out.push(`${id}: a lift has no plate`);
  }
  // seesaws sit on the floor in four clear tiles
  for (const s of R.saws) {
    for (let c = s.c; c < s.c + 4; c++) { if (c !== s.c && ch(c, s.r) !== '.') out.push(`${id}: the seesaw at ${s.c},${s.r} overlaps ${ch(c, s.r)} at ${c}`); if (!solidish(c, s.r + 1)) out.push(`${id}: the seesaw at ${s.c},${s.r} has no floor at ${c}`); if (tile(c, s.r - 1) !== AIR) out.push(`${id}: the seesaw at ${s.c},${s.r} has no room above at ${c}`); }
  }
  // a seed, if any, is reachable air
  if (R.seed && tile(R.seed.c, R.seed.r) !== AIR) out.push(`${id}: the seed is in rock`);
  if (R.fanGroup && !R.winds.length) out.push(`${id}: a fan group but no fans`);
  return out;
}

export const ROOMS: Room[] = ROOM_DEFS.map((_, i) => parseRoom(i));
export const ROOM_COUNT = ROOMS.length;

// ---------------------------------------------------------------- the game
export type Pose = 'idle' | 'run' | 'jump' | 'fall' | 'push' | 'squeeze' | 'cheer';
export const POSES: Pose[] = ['idle', 'run', 'jump', 'fall', 'push', 'squeeze', 'cheer'];
export type Phase = 'record' | 'rewind' | 'live' | 'clear';
/** The live climber. `ground` names what they stand on ('' in the air): 'tile', 'echo', 'lift:N', 'crate:N' or 'saw:N:S'. */
export type Body = {
  who: Who; x: number; y: number; px: number; py: number; vx: number; vy: number; face: 1 | -1;
  ground: string; was: string; coyote: number; buffer: number; held: boolean; cut: boolean; push: boolean; impact: number; pose: Pose; wind: boolean;
};
export type Crate = { x: number; y: number; px: number; py: number; vy: number; ground: string; impact: number };
export type Lift = { y: number; py: number; base: number; top: number };
export type Saw = { down: 0 | 1; top: [number, number]; ptop: [number, number]; flip: number };
export type Ev =
  | { k: 'jump'; who: Who; boost: boolean } | { k: 'land'; who: Who; v: number } | { k: 'bonk'; who: Who }
  | { k: 'plate'; i: number; on: boolean } | { k: 'door'; i: number; open: boolean } | { k: 'lift'; i: number; up: boolean }
  | { k: 'push'; i: number } | { k: 'flip'; i: number } | { k: 'launch'; who: Who | 'crate' } | { k: 'crumble'; c: number; r: number } | { k: 'shake'; c: number; r: number }
  | { k: 'seed'; by: 'live' | 'echo' } | { k: 'crate'; i: number; v: number } | { k: 'fan'; on: boolean }
  | { k: 'record' } | { k: 'live' } | { k: 'rewind'; to: 'live' | 'record'; why: 'candle' | 'key' | 'retry' | 'rerecord' } | { k: 'candle'; left: number } | { k: 'clear'; loops: number; seed: boolean };

/** One recorded tick: where the recorder was and how they looked. */
export const FRAME = 5;
const box = (x: number, y: number, w: number, h: number) => ({ l: x - w / 2, r: x + w / 2, t: y - h, b: y });
type Box = { l: number; r: number; t: number; b: number };
type Rect = { l: number; r: number; t: number; b: number };
type Surface = { key: string; l: number; r: number; top: number; ptop: number };
const approach = (v: number, to: number, d: number) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));
const overlapX = (a: Box, l: number, r: number) => a.r > l + EPS && a.l < r - EPS;
const overlapY = (a: Box, t: number, b: number) => a.b > t + EPS && a.t < b - EPS;

export class EchoGame {
  readonly room: Room;
  phase: Phase = 'record';
  /** Ticks into the current loop. */
  t = 0;
  /** Loops played in this room: the recording is loop 1. */
  loops = 1;
  /** Who is moving now (the recorder in loop 1). */
  who: Who;
  p!: Body;
  crates: Crate[] = [];
  doors: { open: number; hold: number; want: boolean }[] = [];
  lifts: Lift[] = [];
  saws: Saw[] = [];
  /** Per tile: 0 sound, 1..CRUMBLE_TICKS shaking, -1 fallen. */
  crumble: Int16Array;
  pressed: boolean[] = [];
  groups = [false, false, false, false, false];
  fanOn = true;
  seed = false;
  seedBy: 'live' | 'echo' | null = null;
  /** The recording: FRAME numbers a tick, the first loop's inputs, and how many ticks it holds. */
  frames = new Float64Array(0);
  recInputs: number[] = [];
  liveInputs: number[] = [];
  /** The live climber's own path this loop (for the rewind to play backwards). */
  trail: number[] = [];
  /** The echo: where it is now and was last tick, and whether it stands on something. */
  echo = { x: 0, y: 0, px: 0, py: 0, face: 1 as 1 | -1, pose: 'idle' as Pose, ground: true, on: false };
  rewindT = 0; rewindLen = 0; rewindTo: 'live' | 'record' = 'live';
  clearT = 0;
  events: Ev[] = [];
  /** For search bots: skip the trail and live input log, which only grow. */
  lean = false;
  private rec: number[] = [];

  constructor(index: number) {
    this.room = ROOMS[index];
    if (!this.room) throw new Error(`no room ${index}`);
    this.who = this.room.first;
    this.crumble = new Int16Array(COLS * ROWS);
    this.begin('record');
  }
  get echoWho(): Who { return this.room.first; }
  get recording() { return this.phase === 'record'; }
  get frameCount() { return this.frames.length / FRAME; }
  /** Seconds of candle left while recording (or of the echo's replay while live). */
  get candleLeft() { return this.phase === 'record' ? Math.max(0, this.room.candle - this.t) : Math.max(0, this.frameCount - this.t); }

  // ---------------------------------------------------------------- loops
  /** Resets the room and starts a loop: 'record' for the first climber, 'live' for the second beside the echo. */
  private begin(kind: 'record' | 'live') {
    const R = this.room;
    this.phase = kind; this.t = 0;
    this.who = kind === 'record' ? R.first : R.second;
    const s = R.start[this.who], k = KIT[this.who];
    const x = s.c * T + T / 2, y = (s.r + 1) * T;
    this.p = { who: this.who, x, y, px: x, py: y, vx: 0, vy: 0, face: s.c < COLS / 2 ? 1 : -1, ground: 'tile', was: 'tile', coyote: 0, buffer: 0, held: true, cut: false, push: false, impact: 0, pose: 'idle', wind: false };
    void k;
    this.crates = R.crates.map((c) => { const x = c.c * T + T / 2, y = (c.r + 1) * T; return { x, y, px: x, py: y, vy: 0, ground: 'tile', impact: 0 }; });
    this.doors = R.doors.map(() => ({ open: 0, hold: 0, want: false }));
    this.lifts = R.lifts.map((l) => { const base = (l.r + 1) * T; return { y: base, py: base, base, top: base - l.up * T }; });
    this.saws = R.saws.map((s) => { const b = (s.r + 1) * T, top: [number, number] = s.down === 0 ? [b - SAW.low, b - SAW.high] : [b - SAW.high, b - SAW.low]; return { down: s.down, top, ptop: [top[0], top[1]], flip: 0 }; });
    this.crumble.fill(0);
    this.pressed = R.plates.map(() => false);
    this.groups = [false, false, false, false, false];
    this.fanOn = !R.fanGroup;
    this.seed = false; this.seedBy = null;
    this.trail = [];
    if (kind === 'record') { this.rec = []; this.recInputs = []; this.echo.on = false; }
    else {
      this.liveInputs = [];
      this.echo.on = true;
      const f = this.frameAt(0, true);
      Object.assign(this.echo, f, { px: f.x, py: f.y });
    }
    // plates already pressed at the start (by a crate, say) count from the first tick
    this.updatePlates(false);
    for (let i = 0; i < this.doors.length; i++) if (this.doors[i].want) this.doors[i].open = 1;
    this.events.push({ k: kind });
  }
  /** The echo's frame for tick `k` of a live loop (the start pose before tick 0, the last pose after the end). */
  frameAt(k: number, before = false) {
    const n = this.frameCount, R = this.room, s = R.start[R.first];
    if (n === 0 || (before && k === 0)) return { x: s.c * T + T / 2, y: (s.r + 1) * T, face: (s.c < COLS / 2 ? 1 : -1) as 1 | -1, pose: 'idle' as Pose, ground: true };
    const i = Math.min(k, n - 1) * FRAME, f = this.frames;
    const ended = k >= n;
    const pose = POSES[f[i + 3]] ?? 'idle';
    return { x: f[i], y: f[i + 1], face: (f[i + 2] < 0 ? -1 : 1) as 1 | -1, pose: ended && (pose === 'run' || pose === 'push') ? 'idle' as Pose : pose, ground: f[i + 4] > 0 };
  }
  /** R: while recording, stop and rewind to the live loop; while live, try the live loop again with the same echo. */
  rewind() {
    if (this.phase === 'record') this.endRecording('key');
    else if (this.phase === 'live') this.startRewind('live', 'retry');
  }
  /** Shift+R: throw the echo away and record again. */
  rerecord() { if (this.phase === 'record' || this.phase === 'live') this.startRewind('record', 'rerecord'); }
  private endRecording(why: 'candle' | 'key') {
    this.frames = Float64Array.from(this.rec);
    this.startRewind('live', why);
  }
  private startRewind(to: 'live' | 'record', why: 'candle' | 'key' | 'retry' | 'rerecord') {
    this.phase = 'rewind'; this.rewindTo = to;
    this.rewindLen = this.rewindT = why === 'candle' || why === 'key' ? REWIND_TICKS : RETRY_TICKS;
    this.events.push({ k: 'rewind', to, why });
  }
  /** Ends a rewind at once (for bots and tests). */
  skipRewind() { if (this.phase === 'rewind') { this.rewindT = 0; this.finishRewind(); } }
  private finishRewind() { this.loops++; this.begin(this.rewindTo); }

  // ---------------------------------------------------------------- solids
  tileAt(c: number, r: number) { return c < 0 || r < 0 || c >= COLS || r >= ROWS ? ROCK : this.room.tiles[at(c, r)]; }
  /** Glow-moss is lit while the echo is close. */
  mossLit(c: number, r: number) {
    if (!this.echo.on) return false;
    const e = this.echo, ex = e.x, ey = e.y - KIT[this.echoWho].h / 2, dx = c * T + T / 2 - ex, dy = r * T + T / 2 - ey;
    return dx * dx + dy * dy <= MOSS_R * MOSS_R;
  }
  /** Is this tile solid for this mover? (`who` is the live climber, or null for a crate.) Ledges count only from above. */
  private solid(c: number, r: number, who: Who | null, b: Box) {
    const k = this.tileAt(c, r);
    if (k === ROCK || k === KIT_ROCK || k === FAN_TILE) return true;
    if (k === CRUMBLE) return this.crumble[at(c, r)] >= 0;
    if (k === MOSS) {
      if (!who || !this.mossLit(c, r)) return false;
      // a tile that lights up around the climber doesn't trap them: it's solid only once they're clear of it
      return !(b.r > c * T + EPS && b.l < c * T + T - EPS && b.b > r * T + EPS && b.t < r * T + T - EPS);
    }
    return false;
  }
  private doorRect(i: number): Rect | null {
    const d = this.room.doors[i], h = d.h * T * (1 - this.doors[i].open);
    return h < 0.5 ? null : { l: d.c * T, r: d.c * T + T, t: d.r * T, b: d.r * T + h };
  }
  private crateRect(i: number): Rect { const c = this.crates[i]; return { l: c.x - T / 2, r: c.x + T / 2, t: c.y - T, b: c.y }; }
  private playerRect(): Rect { const p = this.p, k = KIT[p.who]; return box(p.x, p.y, k.w, k.h); }
  /** Rectangles that block a mover: doors, crates (for the climber) and the climber (for crates). */
  private rects(forCrate: number): Rect[] {
    const out: Rect[] = [];
    for (let i = 0; i < this.doors.length; i++) { const r = this.doorRect(i); if (r) out.push(r); }
    for (let i = 0; i < this.crates.length; i++) if (i !== forCrate) out.push(this.crateRect(i));
    if (forCrate >= 0) out.push(this.playerRect());
    return out;
  }
  /** Surfaces you can stand on but pass up through: ledges are tiles; these are lifts, seesaw pads and the echo's head. */
  private surfaces(forPlayer: boolean): Surface[] {
    const out: Surface[] = [];
    this.room.lifts.forEach((l, i) => { const L = this.lifts[i]; out.push({ key: `lift:${i}`, l: l.c * T, r: (l.c + l.w) * T, top: L.y, ptop: L.py }); });
    this.room.saws.forEach((s, i) => {
      const S = this.saws[i], x0 = s.c * T, b = (s.r + 1) * T;
      out.push({ key: `saw:${i}:0`, l: x0, r: x0 + SAW.pad, top: S.top[0], ptop: S.ptop[0] });
      out.push({ key: `saw:${i}:1`, l: x0 + SAW.w - SAW.pad, r: x0 + SAW.w, top: S.top[1], ptop: S.ptop[1] });
      out.push({ key: `saw:${i}:m`, l: x0 + SAW.pad, r: x0 + SAW.w - SAW.pad, top: b - SAW.mid, ptop: b - SAW.mid });
    });
    if (forPlayer && this.echo.on) {
      const k = KIT[this.echoWho], e = this.echo;
      out.push({ key: 'echo', l: e.x - k.w / 2, r: e.x + k.w / 2, top: e.y - k.h, ptop: e.py - k.h });
    }
    return out;
  }

  /** How far a box can slide sideways, stopping at rock and the given rectangles. */
  private sweepX(b: Box, dx: number, who: Who | null, rects: Rect[]) {
    if (dx === 0) return 0;
    let allow = dx;
    const r0 = Math.floor((b.t + EPS) / T), r1 = Math.floor((b.b - EPS) / T);
    if (dx > 0) {
      const c0 = Math.floor((b.r - EPS) / T) + 1, c1 = Math.floor((b.r + dx - EPS) / T);
      for (let c = c0; c <= c1 && allow > 0; c++) for (let r = r0; r <= r1; r++) if (this.solid(c, r, who, b)) { allow = Math.min(allow, c * T - b.r); break; }
      for (const q of rects) if (q.l >= b.r - EPS && q.l < b.r + allow && overlapY(b, q.t, q.b)) allow = Math.min(allow, q.l - b.r);
      return Math.max(0, allow);
    }
    const c0 = Math.floor((b.l + EPS) / T) - 1, c1 = Math.floor((b.l + dx + EPS) / T);
    for (let c = c0; c >= c1 && allow < 0; c--) for (let r = r0; r <= r1; r++) if (this.solid(c, r, who, b)) { allow = Math.max(allow, c * T + T - b.l); break; }
    for (const q of rects) if (q.r <= b.l + EPS && q.r > b.l + allow && overlapY(b, q.t, q.b)) allow = Math.max(allow, q.r - b.l);
    return Math.min(0, allow);
  }
  /**
   * How far a box can move up or down. Going down it lands on rock, ledges, rectangles and the one-way surfaces it was
   * above; the answer says what it landed on.
   */
  private sweepY(b: Box, dy: number, who: Who | null, rects: Rect[], surfaces: Surface[]): { dy: number; on: string } {
    if (dy === 0) return { dy: 0, on: '' };
    const c0 = Math.floor((b.l + EPS) / T), c1 = Math.floor((b.r - EPS) / T);
    if (dy > 0) {
      let allow = dy, on = '';
      const rA = Math.floor((b.b - EPS) / T) + 1, rB = Math.floor((b.b + dy - EPS) / T);
      for (let r = rA; r <= rB && !on; r++) for (let c = c0; c <= c1; c++) {
        const k = this.tileAt(c, r);
        if (this.solid(c, r, who, b) || (k === LEDGE && r * T >= b.b - EPS)) { if (r * T - b.b < allow + EPS) { allow = r * T - b.b; on = 'tile'; } break; }
      }
      for (const q of rects) if (q.t >= b.b - EPS && q.t <= b.b + allow + EPS && overlapX(b, q.l, q.r)) { if (q.t - b.b < allow - EPS || !on) { allow = Math.min(allow, q.t - b.b); on = this.rectKey(q); } }
      // moving surfaces win ties, so a climber on a lift at floor level rides it
      for (const s of surfaces) {
        if (!overlapX(b, s.l, s.r)) continue;
        if (b.b <= Math.max(s.top, s.ptop) + EPS && b.b + dy >= s.top - EPS && s.top - b.b <= allow + EPS) {
          const d = s.top - b.b;
          if (d < 0 && this.sweepY(b, d, who, rects, []).dy > d + EPS) continue; // no room to be scooped up
          allow = d; on = s.key;
        }
      }
      return { dy: allow, on };
    }
    let allow = dy, on = '';
    const rA = Math.floor((b.t + EPS) / T) - 1, rB = Math.floor((b.t + dy + EPS) / T);
    for (let r = rA; r >= rB && !on; r--) for (let c = c0; c <= c1; c++) if (this.solid(c, r, who, b)) { allow = Math.max(allow, r * T + T - b.t); on = 'tile'; break; }
    for (const q of rects) if (q.b <= b.t + EPS && q.b > b.t + allow - EPS && overlapX(b, q.l, q.r)) { allow = Math.max(allow, q.b - b.t); on = 'rect'; }
    return { dy: Math.min(0, allow), on };
  }
  private rectKey(q: Rect) {
    for (let i = 0; i < this.crates.length; i++) { const c = this.crates[i]; if (q.l === c.x - T / 2 && q.b === c.y) return `crate:${i}`; }
    const p = this.p; if (q.b === p.y && q.l === p.x - KIT[p.who].w / 2) return 'player';
    return 'tile';
  }

  // ---------------------------------------------------------------- the tick
  step(inp: Input) {
    if (this.phase === 'rewind') { if (--this.rewindT <= 0) this.finishRewind(); return; }
    if (this.phase === 'clear') { this.clearT++; return; }
    const bits = inputBits(inp);
    if (this.phase === 'record') this.recInputs.push(bits); else if (!this.lean) this.liveInputs.push(bits);
    this.p.impact = 0; for (const c of this.crates) c.impact = 0;
    this.moveLifts();
    if (this.phase === 'live') this.moveEcho();
    this.movePlayer(inp);
    this.moveCrates();
    this.seesaws();
    this.crumbling();
    this.updatePlates(true);
    this.pickups();
    const p = this.p;
    if (!this.lean) this.trail.push(p.x, p.y, p.face, POSES.indexOf(p.pose), p.ground ? 1 : 0);
    if (this.phase === 'record') {
      this.rec.push(p.x, p.y, p.face, POSES.indexOf(p.pose), p.ground ? 1 : 0);
      this.t++;
      const left = this.room.candle - this.t;
      if (left > 0 && left <= 3 * TPS && left % TPS === 0) this.events.push({ k: 'candle', left: left / TPS });
      if (left <= 0) this.endRecording('candle');
    } else if (this.phase === 'live') this.t++;
  }

  private moveLifts() {
    this.room.lifts.forEach((l, i) => {
      const L = this.lifts[i]; L.py = L.y;
      const want = this.groups[l.g] ? L.top : L.base, sp = LIFT_SPEED * DT;
      if (L.y === want) return;
      let dy = want < L.y ? -Math.min(sp, L.y - want) : Math.min(sp, want - L.y);
      const key = `lift:${i}`;
      if (dy < 0) {
        // never squash a rider into the ceiling: stop where the first one would bump
        dy = Math.max(dy, this.riderRoom(key, dy, 0));
        if (dy > -EPS) return;
      }
      L.y += dy;
      this.carry(key, 0, dy, 0);
    });
  }
  /** How far up the riders of a support (and their riders) can go. */
  private riderRoom(key: string, dy: number, depth: number): number {
    let allow = dy;
    if (depth > 3) return 0;
    if (this.p.ground === key) { const k = KIT[this.p.who]; allow = Math.max(allow, this.sweepY(box(this.p.x, this.p.y, k.w, k.h), dy, this.p.who, this.rects(-1), []).dy); }
    this.crates.forEach((c, i) => { if (c.ground === key) { allow = Math.max(allow, this.sweepY(box(c.x, c.y, T, T), dy, null, this.rects(i), []).dy); allow = Math.max(allow, this.riderRoom(`crate:${i}`, allow, depth + 1)); } });
    return allow;
  }
  /** Moves whatever stands on a support along with it. */
  private carry(key: string, dx: number, dy: number, depth: number) {
    if (depth > 3) return;
    const p = this.p;
    if (p.ground === key) {
      const k = KIT[p.who];
      if (dx) p.x += this.sweepX(box(p.x, p.y, k.w, k.h), dx, p.who, this.rects(-1));
      if (dy < 0) p.y += this.sweepY(box(p.x, p.y, k.w, k.h), dy, p.who, this.rects(-1), []).dy;
      else if (dy > 0) p.y += dy;
    }
    this.crates.forEach((c, i) => {
      if (c.ground !== key) return;
      const ox = c.x, oy = c.y;
      if (dx) c.x += this.sweepX(box(c.x, c.y, T, T), dx, null, this.rects(i));
      if (dy < 0) c.y += this.sweepY(box(c.x, c.y, T, T), dy, null, this.rects(i), []).dy;
      else if (dy > 0) c.y += dy;
      if (c.x !== ox || c.y !== oy) this.carry(`crate:${i}`, c.x - ox, c.y - oy, depth + 1);
    });
  }

  private moveEcho() {
    const e = this.echo, f = this.frameAt(this.t);
    e.px = e.x; e.py = e.y;
    e.x = f.x; e.y = f.y; e.face = f.face; e.pose = f.pose; e.ground = f.ground;
    // Enzo's echo re-enacts his shoves: a crate it walks into slides along, unless something now blocks it
    if (this.echoWho === 'enzo' && e.ground && e.x !== e.px) {
      const k = KIT.enzo, b = box(e.x, e.y, k.w, k.h), dx = e.x - e.px;
      this.crates.forEach((c, i) => {
        const q = this.crateRect(i);
        if (!overlapY(b, q.t, q.b)) return;
        if (dx > 0 && e.x < c.x && b.r > q.l + EPS) this.shove(i, b.r - q.l);
        else if (dx < 0 && e.x > c.x && b.l < q.r - EPS) this.shove(i, b.l - q.r);
      });
    }
    // standing on the echo's head: ride along
    const p = this.p;
    if (p.ground === 'echo') {
      const k = KIT[p.who], dx = e.x - e.px, dy = e.y - e.py;
      if (dx) p.x += this.sweepX(box(p.x, p.y, k.w, k.h), dx, p.who, this.rects(-1));
      if (dy < 0) p.y += this.sweepY(box(p.x, p.y, k.w, k.h), dy, p.who, this.rects(-1), []).dy;
      else if (dy > 0) p.y += this.sweepY(box(p.x, p.y, k.w, k.h), dy, p.who, this.rects(-1), this.surfaces(true)).dy;
    }
  }

  private inWind(b: Box) {
    if (!this.fanOn) return false;
    for (const w of this.room.winds) if (b.r > w.c * T + 4 && b.l < w.c * T + T - 4 && b.b > w.top && b.t < w.bottom) return true;
    return false;
  }

  private movePlayer(inp: Input) {
    const p = this.p, k = KIT[p.who];
    p.px = p.x; p.py = p.y;
    const press = inp.jump && !p.held;
    p.held = inp.jump;
    if (press) p.buffer = BUFFER; else if (p.buffer > 0) p.buffer--;
    // run
    const target = inp.x * k.run;
    const a = p.ground ? (inp.x ? k.accel : k.decel) : (inp.x ? k.air : k.airDecel);
    p.vx = approach(p.vx, target, a * DT);
    if (inp.x) p.face = inp.x;
    // jump: off the ground, or just after leaving it
    if (p.buffer > 0 && (p.ground || p.coyote > 0)) {
      const from = p.ground || p.was, boost = from === 'echo' && this.echoWho === 'dora';
      p.vy = -k.jump * (boost ? BOOST : 1);
      p.ground = ''; p.coyote = 0; p.buffer = 0; p.cut = true;
      this.events.push({ k: 'jump', who: p.who, boost });
    }
    if (p.cut && !inp.jump && p.vy < 0) { p.vy *= JUMP_CUT; p.cut = false; }
    if (p.vy >= 0) p.cut = false;
    // fall, and the wind
    p.vy = Math.min(MAX_FALL, p.vy + G * DT);
    p.wind = this.inWind(box(p.x, p.y, k.w, k.h));
    if (p.wind) {
      const f = FAN[p.who];
      if (p.who === 'dora') { if (p.vy > f.cap) p.vy = Math.max(f.cap, p.vy - f.lift * DT); }
      else { p.vy -= f.lift * DT; if (p.vy > f.cap) p.vy = Math.max(f.cap, p.vy - 2400 * DT); }
    }
    // sideways, shoving crates if Enzo
    const rects = this.rects(-1), dx = p.vx * DT;
    p.push = false;
    if (dx !== 0) {
      const b = box(p.x, p.y, k.w, k.h);
      const doorsOnly: Rect[] = []; for (let i = 0; i < this.doors.length; i++) { const r = this.doorRect(i); if (r) doorsOnly.push(r); }
      let allow = this.sweepX(b, dx, p.who, doorsOnly);
      // the nearest crate in the way
      let best = -1, gap = Infinity;
      this.crates.forEach((c, i) => {
        const q = this.crateRect(i); if (!overlapY(b, q.t, q.b)) return;
        const g = dx > 0 ? q.l - b.r : b.l - q.r;
        if (g >= -EPS && g < Math.abs(allow) - EPS && g < gap) { gap = Math.max(0, g); best = i; }
      });
      if (best >= 0) {
        if (p.who === 'enzo' && p.ground) {
          const want = Math.min(Math.abs(allow), Math.abs(PUSH * DT) + gap) - gap, moved = this.shove(best, Math.sign(dx) * want);
          allow = Math.sign(dx) * (gap + Math.abs(moved));
          if (Math.abs(moved) > EPS || gap < EPS) { p.push = true; p.vx = Math.sign(p.vx) * Math.min(Math.abs(p.vx), PUSH); }
        } else allow = Math.sign(dx) * gap;
      }
      p.x += allow;
      if (Math.abs(allow - dx) > EPS && !p.push) p.vx = 0;
    }
    // up and down
    const wasGround = p.ground;
    const res = this.sweepY(box(p.x, p.y, k.w, k.h), p.vy * DT, p.who, rects, this.surfaces(true));
    p.y += res.dy;
    if (p.vy >= 0 && res.on) {
      if (!wasGround) { p.impact = p.vy; this.events.push({ k: 'land', who: p.who, v: p.vy }); }
      p.vy = 0; p.ground = res.on === 'player' ? 'tile' : res.on;
    } else {
      if (p.vy < 0 && res.on) { if (p.vy < -60) this.events.push({ k: 'bonk', who: p.who }); p.vy = 0; }
      p.ground = '';
    }
    if (p.ground) { p.coyote = 0; p.was = p.ground; }
    else if (wasGround && p.vy >= 0) { p.coyote = COYOTE; p.was = wasGround; }
    else if (p.coyote > 0) p.coyote--;
    // how they look
    // Dora flattens herself under a low roof (a kit tunnel)
    let low = false;
    if (p.who === 'dora' && p.ground) { const b = box(p.x, p.y, k.w, k.h), hr = Math.floor((b.t - 3) / T); for (let c = Math.floor((b.l + EPS) / T); c <= Math.floor((b.r - EPS) / T); c++) if (this.solid(c, hr, p.who, b)) low = true; }
    p.pose = !p.ground ? (p.vy < 0 ? 'jump' : 'fall') : p.push ? 'push' : low ? 'squeeze' : Math.abs(p.vx) > 8 ? 'run' : 'idle';
  }
  /** Enzo shoves a crate along; returns how far it went. */
  private shove(i: number, d: number) {
    const c = this.crates[i];
    const m = this.sweepX(box(c.x, c.y, T, T), d, null, this.rects(i));
    if (Math.abs(m) > EPS) { c.x += m; this.events.push({ k: 'push', i }); this.carry(`crate:${i}`, m, 0, 1); if (c.ground && !this.supported(i)) c.ground = ''; }
    return m;
  }
  private supported(i: number) { const c = this.crates[i]; return this.sweepY(box(c.x, c.y, T, T), 0.5, null, this.rects(i), this.surfaces(false)).dy < 0.5 - EPS; }

  private moveCrates() {
    this.crates.forEach((c, i) => {
      c.px = c.x; c.py = c.y;
      const was = c.ground;
      c.vy = Math.min(MAX_FALL, c.vy + G * DT);
      const res = this.sweepY(box(c.x, c.y, T, T), c.vy * DT, null, this.rects(i), this.surfaces(false));
      c.y += res.dy;
      if (c.vy >= 0 && res.on) {
        if (!was) { c.impact = c.vy; if (c.vy > 120) this.events.push({ k: 'crate', i, v: c.vy }); }
        c.vy = 0; c.ground = res.on;
      } else { if (c.vy < 0 && res.on) c.vy = 0; c.ground = ''; }
    });
  }

  private seesaws() {
    this.room.saws.forEach((s, i) => {
      const S = this.saws[i]; S.ptop = [S.top[0], S.top[1]];
      if (S.flip > 0) S.flip--;
      const hi: 0 | 1 = S.down === 0 ? 1 : 0, key = `saw:${i}:${hi}`, x0 = s.c * T;
      const padL = hi === 0 ? x0 : x0 + SAW.w - SAW.pad, padR = padL + SAW.pad, hiTop = S.top[hi];
      let land = false;
      const p = this.p;
      if (p.who === 'enzo' && p.ground === key && p.impact >= SAW.impact) land = true;
      this.crates.forEach((c) => { if (c.ground === key && c.impact >= SAW.impact) land = true; });
      if (this.echo.on && this.echoWho === 'enzo') {
        const e = this.echo, k = KIT.enzo;
        if (e.py <= hiTop + EPS && e.y >= hiTop - EPS && e.y - e.py >= SAW.impact * DT && e.x + k.w / 2 > padL + EPS && e.x - k.w / 2 < padR - EPS) land = true;
      }
      if (!land) return;
      // flip: the landing pad drops, the other springs up and throws whatever stands on it
      const lo: 0 | 1 = hi === 0 ? 1 : 0, b = (s.r + 1) * T;
      S.down = hi; S.top[hi] = b - SAW.low; S.top[lo] = b - SAW.high; S.flip = 8;
      this.events.push({ k: 'flip', i });
      const upKey = `saw:${i}:${lo}`, rise = SAW.low - SAW.high;
      if (p.ground === key) p.y = S.top[hi];
      if (p.ground === upKey) {
        const kk = KIT[p.who]; p.y += this.sweepY(box(p.x, p.y, kk.w, kk.h), rise, p.who, this.rects(-1), []).dy;
        p.vy = -SAW.launch[p.who]; p.ground = ''; p.coyote = 0; p.cut = false; this.events.push({ k: 'launch', who: p.who });
      }
      this.crates.forEach((c, j) => {
        if (c.ground === key) c.y = S.top[hi];
        else if (c.ground === upKey) { c.y += this.sweepY(box(c.x, c.y, T, T), rise, null, this.rects(j), []).dy; c.vy = -SAW.launch.crate; c.ground = ''; this.events.push({ k: 'launch', who: 'crate' }); }
      });
    });
  }

  private crumbling() {
    const R = this.room;
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      const i = at(c, r);
      if (R.tiles[i] !== CRUMBLE) continue;
      const st = this.crumble[i];
      if (st < 0) continue;
      if (st > 0) { if (++this.crumble[i] >= CRUMBLE_TICKS) { this.crumble[i] = -1; this.events.push({ k: 'crumble', c, r }); } continue; }
      const top = r * T, l = c * T, rr = l + T, on = (x: number, y: number, w: number) => Math.abs(y - top) < 1e-3 && x + w / 2 > l + EPS && x - w / 2 < rr - EPS;
      // only paws set it off (a crate resting on one would break it at once)
      let hit = this.p.ground !== '' && on(this.p.x, this.p.y, KIT[this.p.who].w);
      if (this.echo.on && this.echo.ground && on(this.echo.x, this.echo.y, KIT[this.echoWho].w)) hit = true;
      if (hit) { this.crumble[i] = 1; this.events.push({ k: 'shake', c, r }); }
    }
  }

  /** Works out which plates are pressed, then the doors, lifts and fans they drive. */
  private updatePlates(sounds: boolean) {
    const R = this.room, p = this.p;
    R.plates.forEach((pl, i) => {
      const floor = (pl.r + 1) * T, l = pl.c * T + 2, r = pl.c * T + T - 2;
      const on = (x: number, y: number, w: number) => Math.abs(y - floor) < 0.5 && x + w / 2 > l && x - w / 2 < r;
      let wgt = 0;
      if (on(p.x, p.y, KIT[p.who].w)) wgt += KIT[p.who].weight;
      for (const c of this.crates) if (on(c.x, c.y, T)) wgt += 2;
      if (this.echo.on && on(this.echo.x, this.echo.y, KIT[this.echoWho].w)) wgt += KIT[this.echoWho].weight;
      const now = wgt >= (pl.heavy ? 2 : 1);
      if (now !== this.pressed[i] && sounds) this.events.push({ k: 'plate', i, on: now });
      this.pressed[i] = now;
    });
    for (let g = 1; g <= 4; g++) {
      const ps = R.plates.map((pl, i) => (pl.g === g ? this.pressed[i] : null)).filter((x): x is boolean => x !== null);
      const was = this.groups[g];
      this.groups[g] = ps.length > 0 && (R.all[g] ? ps.every(Boolean) : ps.some(Boolean));
      if (sounds && was !== this.groups[g]) R.lifts.forEach((l, i) => { if (l.g === g) this.events.push({ k: 'lift', i, up: this.groups[g] }); });
    }
    const fan = !R.fanGroup || this.groups[R.fanGroup];
    if (sounds && fan !== this.fanOn) this.events.push({ k: 'fan', on: fan });
    this.fanOn = fan;
    R.doors.forEach((d, i) => {
      const D = this.doors[i], active = this.groups[d.g];
      if (active) D.hold = R.hold[d.g];
      const want = active || D.hold > 0;
      if (!active && D.hold > 0 && sounds) D.hold--;
      if (want !== D.want && sounds) this.events.push({ k: 'door', i, open: want });
      D.want = want;
      if (!sounds) return;
      if (want) D.open = Math.min(1, D.open + DOOR_STEP);
      else if (D.open > 0) {
        // a closing door waits rather than shut on anyone (the echo is a ghost, so not on it)
        const next = Math.max(0, D.open - DOOR_STEP), h = d.h * T * (1 - next);
        const q = { l: d.c * T, r: d.c * T + T, t: d.r * T, b: d.r * T + h };
        const pr = this.playerRect();
        let blocked = pr.r > q.l + EPS && pr.l < q.r - EPS && pr.b > q.t + EPS && pr.t < q.b - EPS;
        for (let j = 0; j < this.crates.length && !blocked; j++) { const c = this.crateRect(j); if (c.r > q.l + EPS && c.l < q.r - EPS && c.b > q.t + EPS && c.t < q.b - EPS) blocked = true; }
        if (!blocked) D.open = next;
      }
    });
  }

  private pickups() {
    const R = this.room, p = this.p;
    if (R.seed && !this.seed) {
      const sx = R.seed.c * T + T / 2, sy = R.seed.r * T + T / 2, near = (x: number, y: number, w: number, h: number) => sx > x - w / 2 - 5 && sx < x + w / 2 + 5 && sy > y - h - 5 && sy < y + 5;
      const k = KIT[p.who];
      if (near(p.x, p.y, k.w, k.h)) { this.seed = true; this.seedBy = 'live'; }
      else if (this.echo.on && near(this.echo.x, this.echo.y, KIT[this.echoWho].w, KIT[this.echoWho].h)) { this.seed = true; this.seedBy = 'echo'; }
      if (this.seed) this.events.push({ k: 'seed', by: this.seedBy! });
    }
    if (this.phase === 'live' && this.atExit()) {
      this.phase = 'clear'; this.clearT = 0;
      this.events.push({ k: 'clear', loops: this.loops, seed: this.seed });
    }
  }
  /** Is the live climber in the burrow door? */
  atExit() {
    const e = this.room.exit, p = this.p;
    return p.x > e.c * T + 1 && p.x < e.c * T + T - 1 && p.y > (e.r - 1) * T + 4 && p.y <= (e.r + 1) * T + 0.5;
  }

  /** The stars this clear earned: [cleared, golden seed, within par]. */
  stars(): [boolean, boolean, boolean] {
    const c = this.phase === 'clear';
    return [c, c && this.seed, c && this.loops <= this.room.par];
  }

  // ---------------------------------------------------------------- bots
  /** Everything that changes during a loop, for searching (the recording itself never changes while live). */
  snapshot() {
    return {
      phase: this.phase, t: this.t, loops: this.loops, who: this.who, p: { ...this.p }, crates: this.crates.map((c) => ({ ...c })),
      doors: this.doors.map((d) => ({ ...d })), lifts: this.lifts.map((l) => ({ ...l })), saws: this.saws.map((s) => ({ ...s, top: [s.top[0], s.top[1]] as [number, number], ptop: [s.ptop[0], s.ptop[1]] as [number, number] })),
      crumble: this.crumble.slice(), pressed: [...this.pressed], groups: [...this.groups], fanOn: this.fanOn, seed: this.seed, seedBy: this.seedBy, echo: { ...this.echo },
    };
  }
  restore(s: ReturnType<EchoGame['snapshot']>) {
    this.phase = s.phase; this.t = s.t; this.loops = s.loops; this.who = s.who; this.p = { ...s.p }; this.crates = s.crates.map((c) => ({ ...c }));
    this.doors = s.doors.map((d) => ({ ...d })); this.lifts = s.lifts.map((l) => ({ ...l })); this.saws = s.saws.map((x) => ({ ...x, top: [x.top[0], x.top[1]], ptop: [x.ptop[0], x.ptop[1]] }));
    this.crumble = s.crumble.slice(); this.pressed = [...s.pressed]; this.groups = [...s.groups]; this.fanOn = s.fanOn; this.seed = s.seed; this.seedBy = s.seedBy; this.echo = { ...s.echo };
    this.events.length = 0;
  }
}

/**
 * Plays a room from two input recordings: the first climber's (then R, unless the candle ends it first) and the
 * second's beside the echo, then waits up to `idle` ticks. For the bot and the tests.
 */
export function playRoom(index: number, first: string | number[], second: string | number[], idle = 120) {
  const g = new EchoGame(index), a = typeof first === 'string' ? decodeInputs(first) : first, b = typeof second === 'string' ? decodeInputs(second) : second;
  for (const bits of a) { if (g.phase !== 'record') break; g.step(bitsInput(bits)); }
  if (g.phase === 'record') g.rewind();
  g.skipRewind();
  for (const bits of b) { if (g.phase !== 'live') break; g.step(bitsInput(bits)); }
  for (let i = 0; i < idle && g.phase === 'live'; i++) g.step(idleInput());
  g.events.length = 0;
  return g;
}

// ---------------------------------------------------------------- saving
export type RoomSave = { clear: boolean; seed: boolean; par: boolean; best: number };
export type Save = { v: 1; rooms: Record<string, RoomSave>; last: number; ended: boolean; settings: { sound: boolean; music: boolean; shake: boolean } };
export const freshSave = (): Save => ({ v: 1, rooms: {}, last: 0, ended: false, settings: { sound: true, music: true, shake: true } });
/** Reads a save, keeping what makes sense and dropping the rest; a broken or old save starts fresh. */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return s;
    if (o.rooms && typeof o.rooms === 'object' && !Array.isArray(o.rooms)) {
      for (const R of ROOMS) {
        const r = (o.rooms as Record<string, unknown>)[R.id];
        if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
        const q = r as Record<string, unknown>, clear = q.clear === true;
        if (!clear) continue;
        const best = typeof q.best === 'number' && Number.isFinite(q.best) ? Math.max(2, Math.min(9999, Math.floor(q.best))) : 0;
        s.rooms[R.id] = { clear, seed: q.seed === true, par: q.par === true, best };
      }
    }
    s.last = typeof o.last === 'number' && Number.isInteger(o.last) && o.last >= 0 && o.last < ROOM_COUNT ? o.last : 0;
    s.ended = o.ended === true;
    if (o.settings && typeof o.settings === 'object') { const st = o.settings as Record<string, unknown>; s.settings.sound = st.sound !== false; s.settings.music = st.music !== false; s.settings.shake = st.shake !== false; }
    if (!unlocked(s, s.last)) s.last = 0;
  } catch { return freshSave(); }
  return s;
}
/** Keeps the best of a clear: stars only ever add up. Returns which stars are new. */
export function recordClear(s: Save, g: EchoGame): { first: boolean; seed: boolean; par: boolean } {
  const [, seed, par] = g.stars(), id = g.room.id, was = s.rooms[id];
  const r: RoomSave = was ? { ...was } : { clear: false, seed: false, par: false, best: 0 };
  const out = { first: !r.clear, seed: seed && !r.seed, par: par && !r.par };
  r.clear = true; r.seed ||= seed; r.par ||= par; r.best = r.best ? Math.min(r.best, g.loops) : g.loops;
  s.rooms[id] = r;
  return out;
}
export const cleared = (s: Save, i: number) => !!(ROOMS[i] && s.rooms[ROOMS[i].id]?.clear);
/** A room opens once either of the two before it is cleared, so one stubborn room never blocks the way. */
export const unlocked = (s: Save, i: number) => i === 0 || (i > 0 && i < ROOM_COUNT && (cleared(s, i - 1) || (i >= 2 && cleared(s, i - 2))));
export function starCount(s: Save, i: number) { const r = ROOMS[i] && s.rooms[ROOMS[i].id]; return r ? (r.clear ? 1 : 0) + (r.seed ? 1 : 0) + (r.par ? 1 : 0) : 0; }
export const totalStars = (s: Save) => ROOMS.reduce((n, _, i) => n + starCount(s, i), 0);
export const chapterRooms = (ch: ChapterId) => ROOMS.filter((r) => r.chapter === ch).map((r) => r.index);

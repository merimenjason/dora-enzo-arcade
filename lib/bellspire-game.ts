// The Sunken Bellspire: the deterministic engine. No DOM; one `step(input)` is one tick at 60 per second. Randomness
// comes from a seeded generator, so a seed and the same inputs replay a game exactly.
import {
  ROOMS, AREAS, COLS, ROWS, TILE, SCREEN_W, SCREEN_H, ABILITIES, ABILITY_ORDER, SPELLS, GEAR, START_EQUIP, FOOD, SHOP, BOSSES, MURALS,
  SCRIPTS, WATER_AREAS, SHRINE_NAMES, GUARDIANS, GUARDIAN_AREA, BELFRY_GUARDIANS, BELFRY_AREAS, WIND_AREAS, ALL_BOSSES, abilityIcon,
  GLACIER_GUARDIANS, FOUNDRY_GUARDIANS, FOUNDRY_AREAS, SALT_GUARDIANS, ORCHARD_GUARDIANS, PERK_STATS, RECAST_PERKS, RECAST_PRICE, crystalSpans, isOrchardRoom,
  type Room, type AreaId, type Ability, type HeroId, type SpellId, type Slot, type FoodId, type BossId, type Line, type WaterArea, type Perk, type WindArea,
} from './bellspire-world.js';
import { BOXES, FOE_BODY } from './bellspire-art.js';
import { newBody, stepBody, support, onIce, hookInReach, ropeAim, GRAV, MAX_FALL, ropeBail, boxClear, ASSIST_REACH, HERO_W, HERO_H, RUN, type Body, type Env, type Caps, type BodyInput, type RopeAim } from './bellspire-physics.js';
/** The hook the guided rope is coming up to: bright (with a faint rope to it) when her fall as it goes now will bring
 *  her within reach in the next half second, so it will catch; faint when it's near (within twice the reach) but she
 *  needs more height or to get closer. */
function nearHook(env: Env, b: Body) {
  let best: { x: number; y: number } | null = null, bd = (ASSIST_REACH * 2.2) ** 2;
  for (const h of env.hooks?.() ?? []) {
    if (h.x === b.skipX && h.y === b.skipY) continue;
    const d2 = (h.x - b.x) ** 2 + (h.y - b.y + HERO_H) ** 2;
    if (h.y < b.y - HERO_H - 6 && d2 < bd) { bd = d2; best = h; }
  }
  if (!best) return null;
  // her path from here (no input: the speed she has and gravity)
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, will = false;
  for (let t = 0; t < 30 && !will; t++) {
    x += vx; vy = Math.min(MAX_FALL, vy + GRAV); y += vy;
    const dx = best.x - x, dy = best.y - (y - HERO_H);
    will = dy <= -6 && dx * dx + dy * dy < ASSIST_REACH * ASSIST_REACH;
  }
  return { ...best, far: !will };
}

import { SALT_GATE } from './bellspire-salt-world.js';
import { GlacierTerrain, glacierPoint, savedFall, GLACIER_TELL } from './bellspire-glacier.js';
import { GLACIER_GATE, GLACIER_NAMES, GLACIER_RETURN, GLACIER_VAULT, GLACIER_VAULT_DOOR, GLACIER_VAULT_FROM, ROOT_LIFT, SLICK, glacierTile, isGlacierRoom } from './bellspire-glacier-world.js';
import { graftFlag, graftSpans, ORCHARD_EXIT, ORCHARD_GATE, ORCHARD_RETURN } from './bellspire-orchard-world.js';
import { SaltLift } from './bellspire-salt-lift.js';

export * from './bellspire-world.js';
export { HERO_W, HERO_H, type Body } from './bellspire-physics.js';
export const VIEW_W = 480, VIEW_H = 270;
export const SAVE_KEY = 'bellspire-v1';
/** New Game+ keeps its own save, so the first game's save is never touched. */
export const NGP_SAVE_KEY = 'bellspire-v1-ngp';

/** The doors the last guardian of each area opens onto the next expansion: what opened and where (for the unlock
 *  dialog, the map marker and the title's "Next:" line), and the flag set once the heroes have gone through. */
export const UNLOCKS = [
  { id: 'salt', after: 'hollow', room: 'fgate', ch: '?', visited: 'salt:visited', area: 'The Salt Road', door: 'the old supply door', at: 'at the Foundry Gate Candle',
    title: 'The Salt Road is open', where: 'Tupa has opened the old supply door on the east side of the Foundry Gate Candle. Walk up to it and press Up to go through.' },
  { id: 'orchard', after: 'tollkeeper', room: ORCHARD_RETURN, ch: ',', visited: 'orchard:visited', area: 'The Night Orchard', door: 'the orchard wicket', at: 'in the Salt Tollhouse',
    title: 'The Night Orchard is open', where: 'The orchard wicket on the east side of the Salt Tollhouse has swung open. Walk up to it and press Up. Killa is waiting on the other side.' },
  { id: 'glacier', after: 'graft-mother', room: GLACIER_RETURN, ch: '(', visited: 'glacier:visited', area: 'The Glacier Stair', door: 'the root lift', at: 'in the Mother of Grafts’ chamber',
    title: 'The Glacier Stair is open', where: 'The root lift on the high east terrace of the Mother of Grafts’ chamber has woken. Climb the ladder at the east end of her room and press Up at the lift.' },
] as const;
export type Unlock = (typeof UNLOCKS)[number];

/** What the heroes say on finding the last thing in an expansion, after its ending: then its epilogue. */
const EXPANSION_FOUND: ['salt' | 'orchard' | 'glacier', Line[]][] = [
  ['salt', [{ who: 'dora', text: 'That’s every screen and every chest on the Salt Road, Enzo.' }, { who: 'enzo', text: 'Suma said there’d be a festival at the Tollhouse. Let’s go and count bells.' }]],
  ['orchard', [{ who: 'enzo', text: 'Dora, that’s all of the orchard. Every terrace, every cellar, every mural.' }, { who: 'dora', text: 'Then Killa owes us a basket. Come on, it’s harvest night.' }]],
  ['glacier', [{ who: 'dora', text: 'That’s the whole Stair, Enzo. Every ice fall, every chest, every mural.' }, { who: 'enzo', text: 'Phuyu’s lighting a fire at the Sun Gate tonight. Everyone’s coming up.' }]],
];

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
export const DOOR_CHARS = 'djlkcubynZ89&V>';
/** The doors an ability opens by touch (or, for the lantern and the chime, by light and by ringing). */
export const DOOR_ABILITY: Record<string, Ability> = { d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime', y: 'rope', n: 'echo', '8': 'hammer', '&': 'resonance' };
export const TERRAIN = '#=Hgx^f~_:+-|';
/** The tile under a placed thing is air. */
export const baseChar = (ch: string) => (TERRAIN.includes(ch) || DOOR_CHARS.includes(ch) ? ch : '.');

export type Thing = { ch: string; c: number; r: number; i: number; room: string };
export type Group = { id: string; ch: string; tiles: [number, number][]; horiz: boolean; c: number; r: number; w: number; h: number };
export type RoomInfo = { room: Room; things: Thing[]; doors: Group[]; walls: Group[]; floats: { c0: number; c1: number; r: number }[]; hooks: { x: number; y: number }[] };
const THING_CHARS = 'SMRCABOU@Titwhv' + 'oQWPD' + 'FmerKIazJG' + 'YXLE' + 'N%*!12345678?;,q[]{}()/';
export const FOE_CHARS: Record<string, FoeKind> = {
  F: 'frog', m: 'moth', e: 'eel', r: 'reed', K: 'condor', I: 'imp', a: 'shell', z: 'vizcacha', J: 'jelly', G: 'golem',
  Y: 'gust', X: 'hawk', L: 'clapper', E: 'beetle',
  1: 'ingot', 2: 'ember', 3: 'cbat', 4: 'gsnail', 5: 'brine-skater', 6: 'salt-hare', 7: 'pack-tick', 8: 'crust-crawler',
  '[': 'wall-moth', ']': 'thorn-hare', '{': 'clay-beetle', '}': 'root-mite',
};
/** Where a bell hook's rope catches: just under the hook's eye. */
export const hookPoint = (c: number, r: number) => ({ x: c * TILE + 8, y: r * TILE + 4 });

export const INFO = new Map<string, RoomInfo>();
const GROUP_AT = new Map<string, Group>();
for (const room of ROOMS) {
  const things: Thing[] = [], doors: Group[] = [], walls: Group[] = [], floats: RoomInfo['floats'] = [], hooks: RoomInfo['hooks'] = [];
  const count: Record<string, number> = {};
  const seen = new Set<string>();
  const c0 = room.gx * COLS, r0 = room.gy * ROWS;
  for (let y = 0; y < room.rows.length; y++) {
    const row = room.rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x], c = c0 + x, r = r0 + y;
      if (THING_CHARS.includes(ch)) { count[ch] = (count[ch] ?? 0) + 1; things.push({ ch, c, r, i: count[ch] - 1, room: room.id }); }
      if (ch === 'o') hooks.push(hookPoint(c, r));
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
  INFO.set(room.id, { room, things, doors, walls, floats, hooks });
}
export const groupAt = (c: number, r: number) => GROUP_AT.get(`${c},${r}`);

/** The Foundry Below's molten channels: each run of `~` along a floor is one channel (a Frost Fan cools it all). */
export type Channel = { id: string; room: string; r: number; c0: number; c1: number };
export const CHANNELS: Channel[] = [];
const CHANNEL_AT = new Map<string, Channel>();
for (const room of ROOMS) room.rows.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) if (row[x] === '~' && (x === 0 || row[x - 1] !== '~')) {
    let e = x; while (row[e + 1] === '~') e++;
    const ch: Channel = { id: `${room.id}:~${CHANNELS.filter((q) => q.room === room.id).length}`, room: room.id, r: room.gy * ROWS + y, c0: room.gx * COLS + x, c1: room.gx * COLS + e };
    CHANNELS.push(ch);
    for (let c = ch.c0; c <= ch.c1; c++) CHANNEL_AT.set(`${c},${ch.r}`, ch);
  }
});
export const channelAt = (c: number, r: number) => CHANNEL_AT.get(`${c},${r}`);
/** Every beam door ('&'), in any room: a prism's beam reaches through walls to the doors near it. */
export const BEAM_DOORS: Group[] = [...INFO.values()].flatMap((i) => i.doors.filter((d) => d.ch === '&'));
/** How long a frosted channel stays a crust (ticks; longer with the helping hand), and how long it glows first. */
export const FROST_T = 600, FROST_GLOW = 120, FROST_ASSIST = 1.5;
/** The mist vents: one cycle (ticks), how long a puff lasts (longer with the helping hand). */
export const VENT_P = 330, VENT_UP = 150, VENT_UP_ASSIST = 240;
/** The forge heat: what a tick in the heat adds (of 100), what a tick in the shade takes away, and the hurt each
 *  second the gauge is full (a share of max HP). */
export const HEAT_RATE = 0.16, HEAT_COOL = 1.2, HEAT_HURT = 0.06;
/** A humming crystal's bridge: how long it stands (ticks) and the gap between one slab and the next lighting. */
export const CRYSTAL_LIFE = 600, CRYSTAL_GAP = 6;
/** Beam doors: each prism opens the beam doors within this many pixels of it. */
export const BEAM_REACH = 8 * TILE;

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
    if ('#^-'.includes(rawChar(c, r))) continue;
    const n = roomOfTile(c + dx, r + dy);
    if (n && n.id !== room.id && !'#^-'.includes(rawChar(c + dx, r + dy))) list.push({ from: room.id, to: n.id, c, r });
  }
  LINKS.set(room.id, list);
}

/** Every doorway on the map: each run of open tiles across a border between two map cells of different rooms (and
 *  the shafts up and down), with where along the edge it is (0 to 1), the room and area on the other side, and the
 *  door that holds it, if any. The maps draw these as gaps, stubs into the unknown, area-coloured entrances and locks. */
export type MapExit = { cx: number; cy: number; dx: number; dy: number; at: number; from: string; to: string; toArea: AreaId; cross: boolean; door: Group | null };
/** The Windward Belfry's own rooms (the rope rooms in the citadel are part of the expansion, but on the citadel's
 *  side of the water). */
const BELFRY_ROOMS_SET = new Set(ROOMS.filter((r) => r.area === 'cloud' || r.area === 'loft').map((r) => r.id));
export const isBelfryRoom = (id: string) => BELFRY_ROOMS_SET.has(id);
/** The Foundry Below's rooms (under the citadel, on foot through the seal). */
const FOUNDRY_ROOMS_SET = new Set(ROOMS.filter((r) => r.fd).map((r) => r.id));
export const isFoundryRoom = (id: string) => FOUNDRY_ROOMS_SET.has(id);
export const MAP_EXITS: MapExit[] = (() => {
  const out: MapExit[] = [];
  const open = (c: number, r: number) => !'#^-'.includes(rawChar(c, r));
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

/** The citadel's own guardians and the Lake Mother: the bosses counted for the first epilogue. */
export const BASE_BOSSES: BossId[] = ['frog', 'hydra', 'puma', 'warden', 'mother'];
/** ...and with the Windward Belfry's three: the bosses counted for the second epilogue. */
export const BELFRY_BOSSES: BossId[] = [...BASE_BOSSES, 'condor', 'clappers', 'tune'];
/** Everything counted for 100%: map cells, chests, pedestals, murals and bosses; `base` is the citadel alone (what the
 *  first epilogue asks for), the rest adds the Windward Belfry and the rope rooms. */
export const COMPLETION = (() => {
  const count = (exp: boolean | null, fd = true) => {
    let cells = 0, chests = 0, pedestals = 0, murals = 0;
    for (const r of ROOMS) {
      if (r.salt || isOrchardRoom(r) || isGlacierRoom(r)) continue; // The Foundry epilogue retains its original requirements.
      if (exp !== null && !!r.exp !== exp) continue;
      if (!fd && r.fd) continue;
      cells += r.w * r.h; murals += r.murals?.length ?? 0;
      for (const t of INFO.get(r.id)!.things) { if (t.ch === 'C') chests++; if (t.ch === 'A') pedestals++; }
    }
    return { cells, chests, pedestals, murals };
  };
  const sr = ROOMS.filter((r) => r.salt);
  const salt = { cells: sr.reduce((n, r) => n + r.w * r.h, 0), chests: sr.reduce((n, r) => n + (r.chests?.length ?? 0), 0), murals: 0, bosses: SALT_GUARDIANS.length };
  const orchard = ROOMS.filter(isOrchardRoom).reduce((n, r) => ({
    cells: n.cells + r.w * r.h, chests: n.chests + (r.chests?.length ?? 0), murals: n.murals + (r.murals?.length ?? 0), bosses: n.bosses,
  }), { cells: 0, chests: 0, murals: 0, bosses: ORCHARD_GUARDIANS.length });
  const glacier = ROOMS.filter(isGlacierRoom).reduce((n, r) => ({
    cells: n.cells + r.w * r.h, chests: n.chests + (r.chests?.length ?? 0), murals: n.murals + (r.murals?.length ?? 0), bosses: n.bosses,
  }), { cells: 0, chests: 0, murals: 0, bosses: GLACIER_GUARDIANS.length });
  return { ...count(null), bosses: ALL_BOSSES.length, salt, orchard, glacier, base: { ...count(false), bosses: BASE_BOSSES.length }, belfry: { ...count(null, false), bosses: BELFRY_BOSSES.length } };
})();

// ─── the Echo Trials (at any lit shrine once the Out-of-Tune Bell is calm) ──────────
/** A trial: the Guardian Rush (all eight guardians back to back, with one heal between each), or an area's run (from
 *  its shrine, touch each trial bell in order). `medals` are the gold, silver and bronze times in seconds, set from
 *  the bots (tests/bellspire-trials-bot.mjs): a run's gold is 1.2x the planner's own line (silver 1.6x, bronze 2.4x);
 *  the rush's gold is beaten by about one casual bot in eight, and silver by most of them. */
export type TrialDef = {
  id: string; name: string; kind: 'rush' | 'run'; area?: AreaId; from?: string; text: string;
  goals: { room: string; c: number; r: number }[]; wind?: Record<WindArea, 1 | -1>; medals: [number, number, number];
};
/** The Guardian Rush's order: the story's. */
export const RUSH: BossId[] = ['frog', 'hydra', 'puma', 'warden', 'mother', 'condor', 'clappers', 'tune'];
/** The Grand Rush (once the Hollow Bell is calm): every guardian, the Foundry Below's three too. */
export const GRAND_RUSH: BossId[] = [...RUSH, 'founder', 'choir', 'hollow'];
/** What one heal between guardians gives back (of max HP and MP; a knocked-out hero wakes with it). */
export const RUSH_HEAL = 0.5;
/** Every trial runs with this pantry (the save's own food is set aside and comes back after). */
export const TRIAL_FOOD: Record<FoodId, number> = { cake: 2, tea: 1 };
export const TRIALS: TrialDef[] = [
  { id: 'rush', name: 'Guardian Rush', kind: 'rush', text: 'All eight guardians, one after another. One heal between each.', goals: [], medals: [320, 380, 520] },
  { id: 'run:hub', name: 'Landing Dash', kind: 'run', area: 'hub', from: 'landing', text: 'Down the rope cellar and up to the well.', goals: [{ room: 'ropecellar', c: 15, r: 8 }, { room: 'well', c: 13, r: 14 }], medals: [18, 24, 36] },
  { id: 'run:halls', name: 'Flooded Halls Run', kind: 'run', area: 'halls', from: 'chapel', text: 'Down to the sink, then out to the gate.', goals: [{ room: 'sink', c: 17, r: 32 }, { room: 'gate', c: 14, r: 14 }], medals: [58, 78, 116] },
  { id: 'run:docks', name: 'Reed Docks Run', kind: 'run', area: 'docks', from: 'mill', text: 'The boathouse, the dock gate, then out along the jetty.', goals: [{ room: 'boathouse', c: 27, r: 8 }, { room: 'dgate', c: 15, r: 14 }, { room: 'jetty', c: 24, r: 11 }], medals: [32, 42, 63] },
  { id: 'run:towers', name: 'Bell Towers Run', kind: 'run', area: 'towers', from: 'gears', text: 'The shaft, the roost, then the attic.', goals: [{ room: 'shaft', c: 12, r: 14 }, { room: 'roost', c: 17, r: 10 }, { room: 'attic', c: 15, r: 14 }], medals: [51, 68, 102] },
  { id: 'run:crypt', name: 'Crypt Murals Run', kind: 'run', area: 'crypt', from: 'cshrine', text: 'Into the vault, then up the stair.', goals: [{ room: 'vault', c: 27, r: 9 }, { room: 'stair', c: 12, r: 14 }], medals: [29, 39, 58] },
  { id: 'run:throne', name: 'Sunken Throne Run', kind: 'run', area: 'throne', from: 'tshrine', text: 'Out to the garden, then back to the throne gate.', goals: [{ room: 'garden', c: 15, r: 14 }, { room: 'tgate', c: 15, r: 6 }], medals: [68, 90, 135] },
  { id: 'run:cloud', name: 'Cloudstair Run', kind: 'run', area: 'cloud', from: 'cliffoot', text: 'Up the Cloudstair with the wind at your back, to the bannerwalk.', goals: [{ room: 'windgate', c: 25, r: 14 }, { room: 'cairns', c: 29, r: 13 }, { room: 'bannerwalk', c: 31, r: 14 }], wind: { cloud: -1, loft: 1 }, medals: [93, 124, 186] },
  { id: 'rush:grand', name: 'Grand Guardian Rush', kind: 'rush', text: 'All eleven guardians, the foundry’s three as well. One heal between each.', goals: [], medals: [450, 590, 780] },
  { id: 'run:cast', name: 'Forge Sprint', kind: 'run', area: 'cast', from: 'fgate', text: 'Through the molten channels and down the vents to the crucible hall.', goals: [{ room: 'channel', c: 30, r: 14 }, { room: 'vents', c: 26, r: 31 }, { room: 'crucible', c: 45, r: 14 }], medals: [41, 54, 80] },
  { id: 'run:glass', name: 'Glass Echo', kind: 'run', area: 'glass', from: 'caveshrine', text: 'Past the glass snails and up the glass stair on the crystals’ bridge.', goals: [{ room: 'snails', c: 50, r: 14 }, { room: 'glassstair', c: 4, r: 31 }, { room: 'glassstair', c: 4, r: 14 }], medals: [20, 26, 36] },
  { id: 'run:loft', name: 'Belfry Loft Run', kind: 'run', area: 'loft', from: 'loftbase', text: 'Up the bell shaft and the cogworks to the top of the belfry.', goals: [{ room: 'bellshaft', c: 15, r: 31 }, { room: 'cogworks', c: 30, r: 6 }, { room: 'belltop', c: 30, r: 14 }], medals: [52, 69, 103] },
];
export const MEDALS = ['gold', 'silver', 'bronze'] as const;
export type Medal = (typeof MEDALS)[number];
export const trialById = (id: string) => TRIALS.find((t) => t.id === id) ?? null;
/** The medal a time earns (null: slower than bronze). */
export function medalFor(def: TrialDef, secs: number | undefined): Medal | null {
  if (secs === undefined) return null;
  const i = def.medals.findIndex((m) => secs <= m);
  return i < 0 ? null : MEDALS[i];
}
/** Seconds to a tenth, from ticks. */
export const trialSecs = (ticks: number) => Math.round((ticks / 60) * 10) / 10;

// ─── New Game+ ─────────────────────────────────────────────────────────────
/** Each guardian's HP in New Game+ (and each one has a new attack). */
export const NGP_HP = 1.4;
/** ...and hits at least this hard (before the heroes' defence): the Hail Condor's blow, give or take. */
export const NGP_HIT = 18;
/** New Game+ can start once the Out-of-Tune Bell is calm. */
export const ngpReady = (s: Save | null) => !!s && s.flags.includes('boss:tune');
/** A New Game+ save from a finished one: the heroes keep their levels, their gear (as worn) and their spells, and the
 *  Echo Trials' best times; the abilities, the Bell Hearts and Moon Drops, the coins and the map start again (the
 *  Bell Chime spell comes back with its pedestal, since it opens doors). */
export function newGamePlusSave(done: Save): Save {
  const s = freshSave();
  s.ngp = (done.ngp ?? 0) + 1;
  for (const h of ['dora', 'enzo'] as HeroId[]) {
    s.heroes[h] = { level: done.heroes[h].level, xp: done.heroes[h].xp, hp: 9999, mp: 9999, down: false };
  }
  s.gear = [...new Set([...s.gear, ...done.gear])];
  s.equip = JSON.parse(JSON.stringify(done.equip));
  s.spells = [...new Set([...s.spells, ...done.spells.filter((sp) => sp !== 'chime')])];
  s.medals = { ...done.medals };
  s.recast = { ...(done.recast ?? {}) };
  s.lead = done.lead;
  return s;
}

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
  /** the Windward Belfry: each windy area's wind (1 east, −1 west); the Echo Trials' best times (seconds, by trial
   *  id); and which New Game+ round this is (0 for the first time through) */
  wind: Record<WindArea, 1 | -1>; medals: Record<string, number>; ngp: number;
  /** Tupa's recasts: a perk worked into a piece of gear (by gear id) */
  recast: Record<string, Perk>;
};

export function freshSave(): Save {
  return {
    v: 1, shrine: 'landing', lead: 'dora',
    heroes: { dora: { level: 1, xp: 0, hp: 40, mp: 12, down: false }, enzo: { level: 1, xp: 0, hp: 34, mp: 20, down: false } },
    abilities: [], spells: ['whirl', 'bolt'], food: { cake: 2, tea: 1 }, coins: 0,
    gear: ['bronze-sword', 'oak-staff', 'teal-coat', 'rust-coat'], equip: { dora: { ...START_EQUIP.dora }, enzo: { ...START_EQUIP.enzo } },
    flags: [], water: { halls: 1, docks: 0, throne: 1 }, seen: [], hearts: 0, drops: 0, drop: null, time: 0,
    wind: { cloud: 1, loft: 1 }, medals: {}, ngp: 0, recast: {},
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
    // saves from before the Windward Belfry have no wind, medals or round: they start with the defaults (and every
    // total is recomputed from the flags, so their completion simply grows with the new things to find)
    const wind = { ...base.wind };
    for (const a of WIND_AREAS) if (s.wind?.[a] === 1 || s.wind?.[a] === -1) wind[a] = s.wind[a];
    const medals: Record<string, number> = {};
    if (s.medals && typeof s.medals === 'object') for (const [k, v] of Object.entries(s.medals)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) medals[k] = v;
    const ngp = typeof s.ngp === 'number' && s.ngp >= 0 ? Math.floor(s.ngp) : 0;
    // (saves from before the Foundry Below have no recasts; a recast of gear not owned or of an unknown perk is dropped)
    const recast: Record<string, Perk> = {};
    if (s.recast && typeof s.recast === 'object') for (const [k, v] of Object.entries(s.recast)) if (s.gear.includes(k) && (RECAST_PERKS as string[]).includes(v)) recast[k] = v;
    return { ...base, ...s, wind, medals, ngp, recast, lead: s.lead === 'enzo' ? 'enzo' : 'dora' };
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
    // Tupa's recast adds a second perk to this piece
    const rc = save.recast?.[id];
    if (rc && rc !== g.perk) perks.push(rc);
  }
  for (const p of perks) { const ps = PERK_STATS[p]; if (ps) { atk += ps.atk ?? 0; def += ps.def ?? 0; mag += ps.mag ?? 0; } }
  return { atk: Math.round(atk), def, mag: Math.round(mag), maxHp: Math.round(hp), maxMp: Math.round(mp), perks };
}

// ─── enemies ───────────────────────────────────────────────────────────────

export type FoeKind = 'frog' | 'moth' | 'eel' | 'reed' | 'condor' | 'imp' | 'shell' | 'vizcacha' | 'jelly' | 'golem' | 'gust' | 'hawk' | 'clapper' | 'beetle' | 'ingot' | 'ember' | 'cbat' | 'gsnail' | 'brine-skater' | 'salt-hare' | 'pack-tick' | 'crust-crawler' | 'wall-moth' | 'thorn-hare' | 'clay-beetle' | 'root-mite';
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
  gust: { name: 'Wind Spirit', hp: 12, atk: 5, xp: 10, coins: 3, w: 18, h: 16, fly: true },
  hawk: { name: 'Hail-Hawk', hp: 18, atk: 7, xp: 15, coins: 4, w: 20, h: 16, fly: true },
  clapper: { name: 'Clapper Creature', hp: 24, atk: 7, xp: 16, coins: 5, w: 16, h: 24, fly: true },
  beetle: { name: 'Bell-Beetle', hp: 20, atk: 6, xp: 13, coins: 4, w: 16, h: 14 },
  ingot: { name: 'Ingot Walker', hp: 30, atk: 9, xp: 22, coins: 6, w: 18, h: 18 },
  ember: { name: 'Ember Wisp', hp: 14, atk: 7, xp: 18, coins: 4, w: 14, h: 14, fly: true, light: [1, 0.55, 0.2, 50] },
  cbat: { name: 'Crystal Bat', hp: 16, atk: 8, xp: 20, coins: 5, w: 18, h: 14, fly: true, light: [0.85, 0.45, 1, 34] },
  'brine-skater': { name: 'Brine Skater', hp: 25, atk: 9, xp: 22, coins: 5, w: 25, h: 14 },
  'salt-hare': { name: 'Salt Hare', hp: 32, atk: 10, xp: 25, coins: 6, w: 18, h: 21 },
  'pack-tick': { name: 'Pack Tick', hp: 22, atk: 10, xp: 24, coins: 5, w: 17, h: 17, fly: true },
  'crust-crawler': { name: 'Crust Crawler', hp: 42, atk: 11, xp: 31, coins: 7, w: 25, h: 17 },
  'wall-moth': { name: 'Wall Moth', hp: 24, atk: 9, xp: 25, coins: 5, w: 18, h: 16, fly: true },
  'thorn-hare': { name: 'Thorn Hare', hp: 34, atk: 11, xp: 28, coins: 6, w: 16, h: 22 },
  'clay-beetle': { name: 'Clay Beetle', hp: 39, atk: 10, xp: 29, coins: 6, w: 22, h: 17 },
  'root-mite': { name: 'Root Mite', hp: 30, atk: 10, xp: 25, coins: 5, w: 16, h: 14 },
  gsnail: { name: 'Glass Snail', hp: 36, atk: 8, xp: 26, coins: 7, w: 18, h: 16 },
};
/** A foe's body frames (idle and moving): from the art, or a stand-in until a kind's own sheet is painted. */
export const foeBody = (k: FoeKind): number[] => FOE_BODY[k] ?? FOE_BODY[({ gust: 'moth', hawk: 'condor', clapper: 'imp', beetle: 'vizcacha' } as Record<string, string>)[k] ?? 'moth'];
/** A guardian's box from its painted frame (the frame the scene shows for its state: rest, wind-up, attack or calm),
 *  drawn from (ax, ay) and mirrored when flipped, scaled by k about the frame's centre. */
export function bossArtBox(b: { st: string; calm: boolean }, sheet: string, ax: number, ay: number, flip: boolean, k: number): Rect {
  const atk = /hop|tongue|pounce|dash|leap|swing|drop|sweep|twin|flopUp|flopDown|chorus|spout/.test(b.st) && !b.st.endsWith('Tell');
  const fr = b.calm ? 5 : b.st.endsWith('Tell') ? 1 : atk ? 2 : 0;
  const [x0, y0, x1, y1] = BOXES[sheet]?.[fr] ?? [-50, -100, 50, 0];
  const l = flip ? -x1 : x0, r = flip ? -x0 : x1, w = (r - l) * k, h = (y1 - y0) * k;
  return { x: ax + (l + r) / 2 - w / 2, y: ay + (y0 + y1) / 2 - h / 2, w, h };
}

/** Which of a foe's 8 frames shows now (idle x2, move x4, wind-up, attack): worked out here from the game clock, so
 *  the scene draws exactly the frame its hitbox was taken from. */
export function foeFrame(e: { kind: FoeKind; id: number; st: string; vx: number; vy: number; ground: boolean }, tick: number): number {
  const base = foeBody(e.kind)[0], f = FOES[e.kind];
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
export function foeBox(e: { kind: FoeKind; x: number; y: number; face: number }, k: number, frame = foeBody(e.kind)[0]): Rect {
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
  id: number; kind: 'bolt' | 'mud' | 'shard' | 'water' | 'seed' | 'bell' | 'paint' | 'bubble' | 'lily' | 'hail' | 'ice' | 'puff' | 'gale' | 'cog' | 'sour' | 'plank'
    | 'spark' | 'glob' | 'glass' | 'cnote' | 'splash' | 'toll' | 'drop' | 'blank';
  friendly: boolean; x: number; y: number; vx: number; vy: number; g: number; life: number; dmg: number; r: number; hits: number[];
};
export type Wave = { x: number; y: number; dir: 1 | -1; speed: number; life: number; h: number; dmg: number };
export type Ring = { x: number; y: number; r: number; vr: number; max: number; thick: number; dmg: number; friendly: boolean; kind: 'imp' | 'chime' | 'slam'; hit: number[]; rung: string[] };
/** floor markers: a falling bell, lily or (the hydra's rain) seed; where a head will strike; where the frog will land
 *  (`shadow`); where the Lake Mother's spout will rise (`swirl`) */
export type Marker = { x: number; y: number; t: number; kind: 'bell' | 'lily' | 'aim' | 'seed' | 'shadow' | 'swirl' | 'drop' | 'blank' | 'flood' };
export type Pickup = { id: number; kind: 'coin' | 'mp' | 'hp' | 'bag'; x: number; y: number; vy: number; amount: number; t: number };
export type Rect = { x: number; y: number; w: number; h: number };

// ─── bosses ────────────────────────────────────────────────────────────────

export type Boss = {
  id: BossId; x: number; y: number; hp: number; max: number; phase: 1 | 2 | 3; st: string; t: number; dur: number; face: 1 | -1;
  flash: number; tellT: number; step: number; hurt: Rect[]; harm: Rect[]; calm: boolean; heads: { x: number; y: number; bx: number; by: number; st: string; t: number; tx: number; ty: number; hp?: number; max?: number; ang?: number; av?: number }[];
  arms: { x: number; y: number }[]; low: number; vis: number; side: 1 | -1; sx: number; sy: number;
  /** a guardian's own target and choice (the condor's dive spot and which planks it breaks) */
  tx: number; ty: number;
  /** where the body is drawn (kept while it can't be hit) */
  body: Rect;
  /** the Foundry Below's guardians: the Founder's frost spots (offsets from its middle, ticks left); a stun; the
   *  Hollow Bell's form (1 or 2) and its lava's height (world y); the Glass Choir's song (singer order) and how far
   *  into it the heroes have rung back */
  spots?: { dx: number; dy: number; t: number }[]; stun?: number; form?: number; lava?: number; song?: number[]; sung?: number;
};

// ─── the game ──────────────────────────────────────────────────────────────

export type GameEvent =
  | { k: 'sfx'; id: string; x?: number; y?: number }
  | { k: 'hit'; x: number; y: number; big: boolean; color?: string }
  | { k: 'shake'; n: number }
  | { k: 'flash'; color: string; n: number }
  | { k: 'save' } | { k: 'shop' } | { k: 'mural'; n: number } | { k: 'unlock'; id: Unlock['id'] } | { k: 'ending'; full: boolean; belfry?: boolean; foundry?: boolean; salt?: boolean; orchard?: boolean; glacier?: boolean }
  /** Tupa's forge opened; cracked glass shattered; a prism's beam to a door; a channel frosted; a slam landed */
  | { k: 'forge' } | { k: 'shatter'; x: number; y: number } | { k: 'beam'; x: number; y: number; tx: number; ty: number } | { k: 'frost'; x: number; y: number; w: number }
  | { k: 'slam'; x: number; y: number; bounce: boolean }
  /** the wind in an area turned round; an echo bell's notes appeared; Dora's rope caught or let go */
  | { k: 'wind'; area: WindArea; dir: 1 | -1 } | { k: 'notes'; x: number; y: number } | { k: 'rope'; on: boolean; x: number; y: number }
  | { k: 'level'; hero: HeroId; level: number } | { k: 'item'; text: string; icon?: number }
  | { k: 'bell'; x: number; y: number } | { k: 'room'; id: string } | { k: 'boss'; id: BossId } | { k: 'down'; hero: HeroId }
  | { k: 'wipe' } | { k: 'pulse'; x: number; y: number; r: number; color: [number, number, number] }
  /** a number to pop off something: damage dealt (hit, big for finishers, spell), damage taken (hurt), heals, XP and coins */
  | { k: 'num'; x: number; y: number; n: number; kind: NumKind }
  /** attack at a lit shrine: the page opens the map for travel; and a journey's arrival */
  | { k: 'travelOpen'; id: string } | { k: 'travel'; id: string }
  /** a Puma Tooth hit landed twice as hard */
  | { k: 'crit'; x: number; y: number } | { k: 'seal'; id: string; n: number }
  /** an Echo Trial began, a trial bell was touched (n of `of`), or the trial ended (won, or failed or given up) */
  | { k: 'trialStart'; id: string } | { k: 'trialBell'; id: string; n: number; of: number; x: number; y: number }
  | { k: 'trial'; id: string; won: boolean; secs: number; medal: Medal | null; best: number | null; newBest: boolean };
export type NumKind = 'hit' | 'big' | 'spell' | 'hurt' | 'heal' | 'xp' | 'coin';

/** `wisp`: the guiding wisp, shown only while the helping hand is on (on unless turned off) */
export type Settings = { assist: boolean; strict: boolean; wisp?: boolean };
/** `spell` says which of Enzo's spells a cast is, so the scene can show its own pose */
type Act = { kind: 'swing' | 'thrust' | 'whirl' | 'cast' | 'tagin' | 'slam'; t: number; n: number; hit: Set<number>; dur: number; spell?: 'bolt' | 'ember' | 'chime' | 'lantern' | 'echo' | 'frost' | 'gale' | 'resonance' };
/** An echo bell's note: a ledge of light (x0 to x1 at height y) that shows from `at` until `life` ticks. */
export type Note = { key: string; room: string; x0: number; x1: number; y: number; t: number; at: number; life: number };
/** A float as the body sees it this tick: reed platforms, echo notes and the tops of swinging bells. */
export type Float = { x0: number; x1: number; y: number; key: string; kind: 'reed' | 'note' | 'bell' | 'lift' | 'branch' };
/** How long an echo bell's notes stay (ticks), and the gap between one note and the next appearing. */
export const NOTE_LIFE = 240, NOTE_GAP = 12;
/** With the helping hand, echo notes last three times as long (12 seconds; on top of the Carillon Staff's double time). */
export const NOTE_ASSIST = 3;
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
/** Ticks V must be held for the Gale Wave (the Ember Ring comes at 24). */
export const GALE_HOLD = 72;
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
  wispGoal: ((g: BellspireGame) => { x: number; y: number } | null) | null = (g) => g.echoGuide() ?? g.wayToGoal();
  ended = false;
  nextId = 1;
  prev: Input = NO_INPUT;
  lastToast = '';
  lastToastT = -999;
  regenT = 0;
  shrineHealT = 0;
  /** echo notes standing in the air (any room; only the current room's are solid) */
  notes: Note[] = [];
  /** the Hail Condor's bridge: planks broken (column → ticks until the plank is back) */
  planks = new Map<number, number>();
  /** a guardian's arena wind (its gust zones blow only while it fights): direction and strength */
  arenaWind = { dir: 1 as 1 | -1, str: 1 };
  /** the Echo Trial being run: its ticks (a run's clock starts on the first key), the next bell or guardian, the save
   *  as it was (it all comes back after), the shrine it started from, and the pause before the next guardian */
  trial: { def: TrialDef; t: number; i: number; started: boolean; back: Save; from: string; next: number } | null = null;
  /** the Foundry Below: frosted channels (channel id → ticks of crust left); the forge heat gauge (0 to 100) and its
   *  hurt clock; the vents' clock offset */
  frozen = new Map<string, number>();
  heat = 0;
  heatT = 0;
  /** (while a slam's shockwave lands its hits) */
  slamming = false;

  constructor(save?: Save | null, settings: Partial<Settings> = {}, seed = 1) {
    this.save = save ? JSON.parse(JSON.stringify(save)) : freshSave();
    this.settings = { assist: true, strict: false, ...settings };
    if (this.settings.strict) this.settings.assist = false;
    this.seed = seed; this.rngState = seed >>> 0 || 1;
    this.lead = this.save.lead;
    if (this.save.heroes[this.lead].down) this.lead = other(this.lead);
    // an old save where Ukumari opened the throne before every guardian was calm: the seals hold it shut again
    // (unless the story is already over)
    if (this.flag('keeper') && !this.flag('ending') && !this.flag('boss:mother') && this.restless().length) this.save.flags = this.save.flags.filter((f) => f !== 'keeper');
    // a save from before the expansions' weapons (09-11-2026): guardians already calm still hand over their gear
    for (const [id, boss] of Object.entries(BOSSES)) if (this.flag(`boss:${id}`)) for (const r of boss.reward) if (r.startsWith('gear:') && !this.save.gear.includes(r.slice(5))) this.save.gear.push(r.slice(5));
    if (this.save.heroes.dora.down && this.save.heroes.enzo.down) { this.save.heroes.dora.down = false; this.save.heroes.dora.hp = 1; this.lead = 'dora'; }
    const start = this.shrineSpot(this.save.shrine) ?? this.startSpot();
    this.room = roomOfPoint(start.x, start.y - 4)!;
    this.body = newBody(start.x, start.y);
    this.safe = { ...start };
    this.follower = { x: start.x - 16, y: start.y, face: 1, air: false, moving: false, swim: false, climb: false, swipeT: 0, swipeCd: 0 };
    this.enterRoom(this.room, true);
    for (const h of ALL_HEROES) this.clampHero(h);
    if (!this.flag('script:intro')) {
      this.setFlag('script:intro');
      // New Game+ says what carries over first
      this.say(this.save.ngp ? [{ who: 'sign', text: `New Game+${this.save.ngp > 1 ? ` ${this.save.ngp}` : ''}: Dora and Enzo keep their levels, gear and spells, but the abilities wait on their pedestals again. Every guardian is tougher and has a new attack.` }, ...SCRIPTS.intro] : SCRIPTS.intro);
    }
    // a save that has already calmed the Lake Mother hears there's more, straight away
    if (this.flag('boss:mother') && !this.flag('script:belfryCall')) this.note('New: the Windward Belfry. Rest at a shrine to hear about it from Wayra.', true);
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
    if (g.ch === 'Z') return BELFRY_GUARDIANS.every((b) => this.flag(`boss:${b}`));
    if (g.ch === '9') return this.flag('boss:tune');
    if (g.ch === 'V') return FOUNDRY_GUARDIANS.every((b) => this.flag(`boss:${b}`));
    if (g.ch === '>') {
      const id = roomOfTile(g.c, g.r)?.boss;
      return !!id && this.flag(`boss:${id}`);
    }
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
  glacier: GlacierTerrain | null = null;
  glacierWork = 0;
  glacierClimbing = false;

  glacierPracticePick() {
    if (this.room.id !== 'glacier-slide') return false;
    const c = Math.floor(this.body.x / TILE) - this.room.gx * COLS;
    return (c >= 12 && c <= 23) || (c >= 37 && c <= 44);
  }

  glacierKnown() { return this.flag('boss:graft-mother') || this.flag('glacier:visited'); }
  glacierGeometry(c: number, r: number) {
    const room = roomOfTile(c, r);
    if (!room?.glacier) return null;
    return glacierTile(room, c, r, COLS, ROWS, i => room === this.room && this.glacier ? this.glacier.state(i) : savedFall(room, i, f => this.flag(f)));
  }

  solidTile(c: number, r: number): boolean {
    const ch = rawChar(c, r);
    if (ch === SLICK || this.glacier && this.glacierGeometry(c, r)?.solid) return true;
    if (ch === '#' || ch === '^' || ch === '~' || ch === '_' || ch === ':' || ch === '+') return true;
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
    if (this.glacier && this.lead === 'dora' && this.has('icepick') && this.glacierGeometry(c, r)?.climb) return true;
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
  saltLift: SaltLift | null = null;
  saltWork: { hero: HeroId; until: number; face: 1 | -1 } | null = null;
  orchardWork: { hero: HeroId; until: number; face: 1 | -1 } | null = null;

  orchardKnown() { return this.flag('boss:tollkeeper') || this.flag('orchard:visited') || isOrchardRoom(this.room); }

  graftTargets() {
    const origin = roomRect(this.room);
    return (this.room.grafts ?? []).flatMap((g, index) => {
      const bloom = graftFlag(this.room.id, index, 'bloom'), shear = graftFlag(this.room.id, index, 'shear');
      const ripe = this.flag(bloom);
      const tile = !ripe ? g.bud : g.tie;
      if (!tile || (ripe && this.flag(shear))) return [];
      return [{
        x: origin.x + (tile[0] + 0.5) * TILE, y: origin.y + (tile[1] + 1) * TILE,
        ability: ripe ? 'shear' as const : 'bloom' as const, flag: ripe ? shear : bloom,
      }];
    });
  }

  private nearGraft(range: number) {
    return this.graftTargets().filter((p) => Math.abs(p.y - this.body.y) < 27 && Math.abs(p.x - this.body.x) < range)
      .sort((a, b) => Math.abs(a.x - this.body.x) - Math.abs(b.x - this.body.x))[0];
  }

  orchardHint(): { x: number; y: number; key: 'up' | 'attack' | 'tag' | null; text: string } | null {
    if (!this.helping()) return null;
    const arena = this.orchardControl();
    const p = arena ?? this.nearGraft(88);
    if (!p) return null;
    if (!p.ability) return { ...p, key: null, text: arena?.waiting ?? 'Watch the graft' };
    if (!this.has(p.ability)) return { ...p, key: null, text: `Find ${ABILITIES[p.ability].name}` };
    if (Math.abs(p.x - this.body.x) >= 39 || Math.abs(p.y - this.body.y) >= 27) {
      return { ...p, key: null, text: p.ability === 'bloom' ? 'Go to the golden bud' : 'Go to the ochre tie' };
    }
    const who = p.ability === 'bloom' ? 'enzo' : 'dora';
    if (this.lead !== who) return { ...p, key: 'tag', text: who === 'enzo' ? 'Tag to Enzo to wake the bud' : 'Tag to Dora to cut the tie' };
    return { ...p, key: who === 'enzo' ? 'up' : 'attack', text: who === 'enzo' ? 'Wake the golden bud' : 'Cut the ochre tie' };
  }

  useOrchard(ability: 'bloom' | 'shear') {
    if (!this.body.ground || this.body.climb || (this.leadRt.act && this.leadRt.act.kind !== 'tagin') || this.leadRt.hurtT > 0) return false;
    const who = ability === 'bloom' ? 'enzo' : 'dora';
    if (this.lead !== who || !this.has(ability)) return false;
    const arena = this.orchardControl();
    const p = arena ?? this.nearGraft(39);
    if (!p || p.ability !== ability || Math.abs(p.x - this.body.x) >= 39 || Math.abs(p.y - this.body.y) >= 27) return false;
    if (arena && this.boss) {
      if (ability === 'bloom') { this.boss.low = 1; this.go('orchardTell', 68 * this.tellMul, true); }
      else { this.boss.low = 0; this.go('orchardOpen', this.helping() ? 420 : 265); }
    } else if ('flag' in p) {
      this.setFlag(p.flag);
      this.emit({ k: 'save' });
    }
    this.orchardWork = { hero: who, face: this.body.x <= p.x ? 1 : -1, until: this.tick + 24 };
    if (this.leadRt.act?.kind === 'tagin') this.leadRt.act = null;
    this.body.vx = 0;
    this.sfx(ability === 'bloom' ? 'chime' : 'shatter', p.x, p.y);
    this.emit({ k: 'pulse', x: p.x, y: p.y - 12, r: 48, color: [1, 0.74, 0.25] });
    return true;
  }

  saltKnown() { return this.flag('boss:hollow') || this.flag('salt:visited') || !!this.room.salt; }

  saltPrompt() {
    const lift = this.saltLift;
    if (!lift) return null;
    const { x, y } = roomRect(this.room);
    const ask = lift.prompt(this.body, this.body.x - x, this.body.y - y, this.lead, this.follower.x - x, this.follower.y - y);
    if (!this.has('ballast') && lift.phase === 'parked') return { ...ask, key: null, text: 'Find Shoulder Shift at the Salt Gate' };
    if (!this.has('catch') && lift.phase === 'catch') return { ...ask, key: null, text: 'Take Lift Catch from the pedestal' };
    return ask;
  }

  floatList(): Float[] {
    const info = INFO.get(this.room.id)!, out: Float[] = [];
    const surf = this.waterY.get(this.room.id);
    if (this.saltLift) {
      const { x, y } = roomRect(this.room), { plan, y: deck } = this.saltLift;
      out.push({ x0: x + plan.left, x1: x + plan.right, y: y + deck, key: 'salt-lift', kind: 'lift' });
    }
    for (const f of info.floats) {
      const rest = f.r * TILE + 10;
      const y = surf !== undefined ? Math.min(rest, surf - 3) : rest;
      out.push({ x0: f.c0 * TILE, x1: (f.c1 + 1) * TILE, y, key: `f${f.c0},${f.r}`, kind: 'reed' });
    }
    for (const n of this.notes) if (n.room === this.room.id && n.t >= n.at && n.t < n.life) out.push({ x0: n.x0, x1: n.x1, y: n.y, key: n.key, kind: 'note' });
    for (const sb of this.swingBells()) out.push({ x0: sb.x - 22, x1: sb.x + 22, y: sb.y, key: `p${sb.i}`, kind: 'bell' });
    if (this.room.grafts) for (const span of graftSpans(this.room, (key) => this.flag(key), TILE, COLS, ROWS)) out.push({ ...span, kind: 'branch' });
    return out;
  }
  /** The giant swinging bells in this room: each one's pivot, angle, and where the top of the bell is (the part to
   *  stand on), from the clock, so they swing the same for everybody. */
  swingBells(room: Room = this.room, tick = this.tick) {
    const info = INFO.get(room.id)!, out: { i: number; px: number; py: number; ang: number; x: number; y: number }[] = [];
    for (const t of info.things) {
      if (t.ch !== 'P') continue;
      const sw = room.swings?.[t.i];
      if (!sw) continue;
      const ang = sw.amp * Math.sin(2 * Math.PI * (tick / sw.period + sw.phase));
      const px = t.c * TILE + 8, py = t.r * TILE, len = sw.len * TILE;
      out.push({ i: t.i, px, py, ang, x: px + Math.sin(ang) * len, y: Math.round(py + Math.cos(ang) * len) });
    }
    return out;
  }
  /** The gust at a point: the room's zones, pushed by the area's wind (an arena's zones only while its guardian
   *  fights, with the wind it sets). */
  windAt(x: number, y: number): number {
    const room = roomOfPoint(x, y);
    if (!room?.gusts) return 0;
    const c = Math.floor(x / TILE) - room.gx * COLS, r = Math.floor(y / TILE) - room.gy * ROWS;
    for (const z of room.gusts) {
      if (c < z[0] || c > z[2] || r < z[1] || r > z[3]) continue;
      if (z[5] === 'boss') {
        const b = this.boss;
        if (!b || b.calm || b.st === 'wait' || room !== this.room) continue;
        return z[4] * this.arenaWind.str * this.arenaWind.dir;
      }
      return z[4] * this.windDir(room.area);
    }
    return 0;
  }
  windDir(area: AreaId): 1 | -1 { return (WIND_AREAS as string[]).includes(area) ? this.save.wind[area as WindArea] : 1; }
  /** A broken plank on the Hail Condor's bridge: not there to stand on. */
  plankBroken(c: number, r: number) { return this.planks.size > 0 && (this.planks.get(c) ?? 0) > 0 && this.room.id === 'condorbridge' && r === this.room.gy * ROWS + 12; }
  readonly env: Env = {
    solid: (c, r) => this.solidTile(c, r),
    oneway: (c, r) => (rawChar(c, r) === '=' && !this.plankBroken(c, r)) || (this.ladderTile(c, r) && !this.ladderTile(c, r - 1) && !this.solidTile(c, r - 1)),
    ladder: (c, r) => this.ladderTile(c, r),
    hazard: (c, r) => this.hazardTile(c, r),
    bouncy: (c, r) => rawChar(c, r) === '+',
    ice: (c, r) => this.glacier !== null && rawChar(c, r) === SLICK,
    surface: (x, y) => this.surfaceAt(x, y),
    deep: (x, y) => { const room = roomOfPoint(x, y); return room && room.deep !== undefined ? (room.gy * ROWS + room.deep) * TILE : null; },
    floats: () => this.floatCache,
    wind: (x, y) => this.windAt(x, y),
    hooks: () => INFO.get(this.room.id)!.hooks,
  };
  /** Does this tile burn: salt and brambles, lava, molten bronze not frosted, slag no vent has hardened. */
  hazardTile(c: number, r: number): boolean {
    const ch = rawChar(c, r);
    if (ch === '^' || ch === '_') return true;
    if (ch === '~') { const q = channelAt(c, r); return !q || !this.frozen.has(q.id); }
    if (ch === ':') return !this.slagHard(roomOfTile(c, r));
    return false;
  }
  /** A channel's state: hot, a crust, or a crust glowing because it is about to melt. */
  channelState(q: Channel): 'hot' | 'crust' | 'glow' { const t = this.frozen.get(q.id); return t === undefined ? 'hot' : t <= FROST_GLOW ? 'glow' : 'crust'; }
  /** Frost a channel: a crust for a while (longer with the helping hand). */
  chill(q: Channel) {
    const was = this.frozen.has(q.id);
    this.frozen.set(q.id, Math.round(FROST_T * (this.helping() ? FROST_ASSIST : 1)));
    if (!was) { this.sfx('freeze', (q.c0 + q.c1 + 1) * TILE / 2, q.r * TILE); this.emit({ k: 'frost', x: q.c0 * TILE, y: q.r * TILE, w: (q.c1 - q.c0 + 1) * TILE }); }
    if (!this.flag('frost:first')) { this.setFlag('frost:first'); this.note('The bronze cools to a crust. It glows before it melts again: keep moving!', true); }
  }
  /** Frosted channels melt back; with the helping hand a crust never melts under a hero standing on it. */
  updateFrozen() {
    const b = this.body;
    if (this.room.fd && this.ventPhase() === 0 && INFO.get(this.room.id)!.things.some((t) => t.ch === '%')) this.sfx('puff');
    for (const [id, t] of this.frozen) {
      if (t <= 1) {
        const q = CHANNELS.find((x) => x.id === id)!;
        const under = this.helping() && b.ground && Math.abs(b.y - q.r * TILE) < 1 && b.x + HERO_W / 2 > q.c0 * TILE && b.x - HERO_W / 2 < (q.c1 + 1) * TILE;
        if (under) continue;
        this.frozen.delete(id);
      } else this.frozen.set(id, t - 1);
    }
  }
  /** The mist vents in a room puff on one clock (each room a little out of step); while they puff, its slag is hard.
   *  With the helping hand the puffs last longer, and slag stays hard under a hero standing on it. */
  ventPhase(room: Room | undefined = this.room) { const k = room ? ROOMS.indexOf(room) * 97 : 0; return (this.tick + k) % VENT_P; }
  ventUp(room: Room | undefined = this.room) { return this.ventPhase(room) < (this.helping() ? VENT_UP_ASSIST : VENT_UP); }
  /** Ticks left in this puff (0 between puffs). */
  ventLeft(room: Room | undefined = this.room) { return this.ventUp(room) ? (this.helping() ? VENT_UP_ASSIST : VENT_UP) - this.ventPhase(room) : 0; }
  slagHard(room: Room | undefined) {
    if (!room) return false;
    if (this.ventUp(room)) return true;
    const b = this.body;
    return this.helping() && room === this.room && b.ground && rawChar(Math.floor(b.x / TILE), Math.round(b.y / TILE)) === ':';
  }
  /** The forge heat: it builds while the lead stands in a hot zone, falls in the shade, and a vent's mist or a shrine
   *  resets it. Full, it burns a little every second; with the helping hand it builds slower and never knocks a hero
   *  out. The Forge Apron and Ashwork Smock (and a recast) halve it. */
  updateHeat() {
    const b = this.body, room = this.room;
    if (!room.fd || this.boss && this.boss.st !== 'wait') { this.heat = Math.max(0, this.heat - HEAT_COOL); return; }
    const c = Math.floor(b.x / TILE) - room.gx * COLS, r = Math.floor((b.y - 4) / TILE) - room.gy * ROWS;
    const hot = !!room.heat?.some((z) => c >= z[0] && c <= z[2] && r >= z[1] && r <= z[3]);
    // a vent's mist close by: cool at once
    const mist = this.ventUp() && INFO.get(room.id)!.things.some((t) => t.ch === '%' && Math.abs(t.c * TILE + 8 - b.x) < 3 * TILE && Math.abs(t.r * TILE - b.y) < 5 * TILE);
    if (mist) { if (this.heat > 20) this.emit({ k: 'pulse', x: b.x, y: b.y - 14, r: 40, color: [0.8, 0.9, 1] }); this.heat = 0; this.heatT = 0; return; }
    if (!hot) { this.heat = Math.max(0, this.heat - HEAT_COOL); this.heatT = 0; return; }
    const rate = HEAT_RATE * (this.helping() ? 0.6 : 1) * (this.perk(this.lead, 'cool') ? 0.5 : 1);
    this.heat = Math.min(100, this.heat + rate);
    if (this.heat >= 100 && ++this.heatT >= 60) {
      this.heatT = 0;
      const s = this.leadSave, st = this.stats(this.lead), dmg = Math.max(1, Math.round(st.maxHp * HEAT_HURT));
      // the helping hand: the heat can't knock a hero out
      s.hp -= this.helping() ? Math.min(dmg, s.hp - 1) : dmg;
      this.emit({ k: 'num', x: b.x, y: b.y - 30, n: dmg, kind: 'hurt' }); this.sfx('sizzle', b.x, b.y);
      if (!this.flag('heat:first')) { this.setFlag('heat:first'); this.note('Too hot! Find shade, a vent’s mist or a shrine to cool down.', true); }
      if (s.hp <= 0) this.downLead();
    }
  }
  floatCache: Float[] = [];
  /** what the lead stands on this tick, if it moves: a reed raft, a swinging bell or an echo note (for the poses) */
  riding = '';

  caps(h: HeroId = this.lead): Caps {
    const quick = this.perk(h, 'quick') ? 1.08 : 1;
    return {
      speed: RUN[h] * quick, dash: h === 'dora' && this.has('dash'), double: h === 'dora' && this.has('double'),
      wallkick: h === 'dora' && this.has('wallkick'), glide: h === 'enzo' && this.has('glide'), deep: this.has('deep'), slam: h === 'dora' && this.has('hammer'),
      swimMul: this.perk(h, 'swim') ? 1.3 : 1, coyote: this.settings.assist ? 9 : 6, buffer: this.settings.assist ? 9 : 6,
      icePick: h === 'dora' && (this.has('icepick') || this.glacierPracticePick()) && this.glacier !== null,
      rope: h === 'dora' && this.has('rope'), windMul: this.perk(h, 'windward') ? 0.5 : 1, grip: this.perk(h, 'grip'),
      // the guided rope is the helping hand's; Strict keeps the free swing
      ropeAssist: h === 'dora' && this.has('rope') && this.settings.assist && !this.settings.strict,
    };
  }

  // ─── rooms ───────────────────────────────────────────────────────────────
  enterRoom(room: Room, first = false) {
    // a calmed guardian always gives its rewards, even if the heroes somehow leave before it settles
    if (this.boss?.calm && !this.flag(`boss:${this.boss.id}`)) this.bossDone();
    const prevRoom = this.room;
    this.room = room;
    this.glacier = room.glacier ? new GlacierTerrain(room, f => this.flag(f), (f, v) => { if (v) this.setFlag(f); else this.save.flags = this.save.flags.filter(k => k !== f); }) : null;
    this.glacierWork = 0;
    this.glacierClimbing = false;
    this.enemies = []; this.shots = []; this.waves = []; this.rings = []; this.markers = []; this.arenaWater = null;
    this.planks.clear(); this.arenaWind = { dir: 1, str: 1 }; this.notes = this.notes.filter((n) => !n.key.startsWith('tune:'));
    this.pickups = this.pickups.filter((p) => p.kind === 'bag');
    this.waterY.clear();
    if (prevRoom !== room || !this.saltLift) this.saltLift = room.saltLift ? new SaltLift(room.saltLift, this.flag(`salt:crossed:${room.id}`)) : null;
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
    if (prevRoom !== room) { this.lostT = 0; this.saltWork = null; this.orchardWork = null; }
  }

  spawnBoss(id: BossId) {
    const rr = roomRect(this.room);
    const info = INFO.get(this.room.id)!;
    const o = info.things.find((t) => t.ch === 'O')!;
    const def = BOSSES[id];
    const ox = o.c * TILE + 8, oy = (o.r + 1) * TILE;
    // New Game+: every guardian is tougher
    const hp = Math.round(def.hp * (this.save.ngp ? NGP_HP : 1));
    const b: Boss = {
      id, x: ox, y: oy, hp, max: hp, phase: 1, st: 'wait', t: 0, dur: 0, face: -1, flash: 0, tellT: 0, step: 0, hurt: [], harm: [], calm: false,
      heads: [], arms: [], low: 0, vis: 1, side: 1, sx: ox, sy: oy, tx: ox, ty: 0, body: { x: ox - 30, y: oy - 50, w: 60, h: 50 },
    };
    if (id === 'hydra') b.heads = [[-46, -96], [0, -128], [44, -88]].map(([dx, dy]) => ({ x: ox + dx, y: oy + dy, bx: ox + dx, by: oy + dy, st: 'idle', t: 0, tx: 0, ty: 0 }));
    if (id === 'warden') { b.x = rr.x + rr.w / 2; b.y = rr.y + 150; b.arms = [{ x: b.x - 90, y: b.y + 20 }, { x: b.x + 90, y: b.y + 20 }]; }
    if (id === 'condor') { b.y = rr.y + 12 * TILE - 92; b.sx = b.x; b.sy = b.y; }
    if (id === 'clappers') {
      // two clappers on ropes from the rafters: [0] the Iron Clapper (Dora's blade), [1] the Glass Clapper (spells)
      const half = Math.round(hp / 2);
      b.heads = [20, 40].map((c) => ({ x: rr.x + c * TILE + 8, y: rr.y + 2 * TILE + 132, bx: rr.x + c * TILE + 8, by: rr.y + 2 * TILE, st: 'idle', t: 0, tx: 132, ty: 0, hp: half, max: half, ang: 0, av: 0 }));
      b.hp = b.max = half * 2;
    }
    if (id === 'choir') { b.heads = [-150, 0, 150].map((dx) => ({ x: ox + dx, y: oy, bx: ox + dx, by: oy, st: 'idle', t: 0, tx: 0, ty: 0 })); b.song = []; b.sung = 0; }
    if (id === 'hollow') { b.form = 1; b.lava = rr.y + 15 * TILE; b.sx = ox; b.sy = rr.y + 11 * TILE; b.y = b.sy; }
    if (id === 'founder') b.spots = [];
    if (id === 'tune') { b.x = rr.x + rr.w / 2; b.sy = rr.y + 2 * TILE; b.heads = [{ x: b.x, y: b.sy + 110, bx: b.x, by: b.sy, st: 'idle', t: 0, tx: 110, ty: 0, ang: 0, av: 0 }]; b.y = b.sy + 110; }
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
    if (this.trial) this.updateTrial(inp);
    else if (this.tick % 15 === 0) { this.checkEpilogue(); this.checkUnlock(); }

    // water and floats, echo notes fading, the condor's broken planks mending
    this.updateWater();
    for (const n of this.notes) n.t++;
    this.notes = this.notes.filter((n) => n.t < n.life);
    this.updateFrozen();
    this.updateGlacier();
    for (const [c, t] of this.planks) { if (t <= 1) this.planks.delete(c); else this.planks.set(c, t - 1); }

    const lead = this.lead, rt = this.leadRt, b = this.body;
    for (const h of ALL_HEROES) { const r = this.hero[h]; if (r.inv > 0) r.inv--; if (r.hurtT > 0) r.hurtT--; if (r.swingCd > 0) r.swingCd--; }
    if (this.tagCd > 0) this.tagCd--;

    // tag (not while Dora hangs on the rope or flies off it: Enzo can't hold it)
    if (pressed.tag && this.glacierClimbing) { this.note('Step off the ice before tagging.'); this.sfx('locked'); }
    else if (pressed.tag && (b.rope || b.fly)) { this.note('Dora’s on the rope. Tag once she’s on her feet.'); this.sfx('locked'); }
    else if (pressed.tag) this.tryTag();
    const iceBrake = this.lead === 'dora' && (this.has('icepick') || this.glacierPracticePick()) && inp.down && inp.attack && onIce(this.env, b);
    let ropeP = false, slamP = false;

    // actions
    const busy = rt.hurtT > 0;
    if (!busy) {
      if (iceBrake) { if (rt.act?.kind === 'swing') rt.act = null; }
      else if (pressed.attack && this.useOrchard('shear')) {
        // The cut is its own action, rather than also doing a normal sword swing.
      } else if (pressed.attack && !rt.act && this.canOpenTravel()) {
        // attack at a lit shrine, with nothing about to bite: the map opens for travel instead of a swing
        this.emit({ k: 'travelOpen', id: this.room.id });
      } else if (pressed.attack && lead === 'dora' && !b.ground && !b.swim && !b.climb && !b.rope && this.has('rope') && hookInReach(this.env, b)) {
        // in the air by a bell hook: the rope instead of a swing
        ropeP = true; rt.act = null;
      } else if (pressed.attack && b.rope) {
        // already swinging: nothing to do but hold on
      } else if (pressed.attack) {
        if (rt.act && rt.act.kind === 'swing') rt.buf = true;
        else if (!rt.act && rt.swingCd <= 0) {
          // with the Bell Hammer, ↓ + attack in the air is a slam (it still bounces off a foe it lands on)
          if (lead === 'dora' && !b.ground && inp.down && !b.swim && !b.climb && this.has('hammer')) { this.startAct('slam', 0); slamP = true; }
          else if (lead === 'dora' && !b.ground && inp.down && !b.swim && !b.climb) this.startAct('thrust', 0);
          else if (!b.climb) this.startAct('swing', 0);
        }
      }
      if (pressed.cast && !b.climb && !b.rope) {
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
        if (held >= GALE_HOLD && this.save.spells.includes('gale')) this.castGale();
        else if (held >= 24 && this.save.spells.includes('ember')) this.castEmber();
        else if (held >= 24 && !this.save.spells.includes('ember')) { this.note('Enzo hasn’t learned the Ember Ring yet. A tap of V casts the Lantern Bolt.'); this.castBolt(); }
        else if (this.nearGlacierFall('water', 112) && this.save.spells.includes('frost')) this.castGlacierFrost();
        else if (!b.ground && !b.swim && this.save.spells.includes('frost')) this.castFrost();
        // on the ground by molten bronze, or facing the Molten Founder, the Frost Fan sweeps low across the floor
        else if (b.ground && this.save.spells.includes('frost') && (this.hotChannelNear(5 * TILE) || (this.boss?.id === 'founder' && !this.boss.calm))) this.castFrost(true);
        else this.castBolt();
      }
    }
    if (pressed.dash && !this.caps().dash) {
      if (lead === 'enzo' && this.has('dash')) this.note('Only Dora can dash. Press Shift to tag her in.');
      else if (!this.has('dash')) this.note('Dora hasn’t found the Reed Dash yet.');
    }
    const workedGraft = pressed.up && b.ground && !b.climb && this.useOrchard('bloom');
    const workedMirror = pressed.up && b.ground && !b.climb && this.turnGlacierMirror();
    if (pressed.up && b.ground && !b.climb && !workedGraft && !workedMirror) this.interact();

    // the body
    const act = rt.act;
    const rooted = (act && act.kind !== 'thrust' && b.ground && act.t < act.dur - 2) || rt.hurtT > 8;
    let dir: -1 | 0 | 1 = inp.left === inp.right ? 0 : inp.left ? -1 : 1;
    const graftPose = (this.orchardWork?.hero === this.lead && this.orchardWork.until - this.tick > 8) || workedMirror || this.lead === 'enzo' && this.glacierWork - this.tick > 11;
    if ((rooted && act?.kind === 'cast') || graftPose) dir = 0;
    const bin: BodyInput = { dir, up: inp.up && !graftPose, down: inp.down, jumpP: pressed.jump && !(act?.kind === 'cast') && !graftPose, jumpH: inp.jump, dashP: pressed.dash, ropeP, slamP, iceBrakeH: iceBrake };
    const wasSwim = b.swim, faceBefore = b.face;
    const caps = this.caps();
    if (rooted && b.ground && act?.kind === 'swing') { caps.speed *= 0.35; }
    // ride a float: reed platforms bob with the water, swinging bells carry the heroes along their arc
    const onFloat = b.ground && b.onOneway ? this.floatCache.find((f) => Math.abs(f.y - b.y) < 0.6 && b.x + HERO_W / 2 > f.x0 && b.x - HERO_W / 2 < f.x1) : undefined;
    this.riding = onFloat?.kind ?? '';
    this.saltLift?.step();
    this.floatCache = this.floatList();
    if (onFloat) {
      const now = this.floatCache.find((f) => f.key === onFloat.key);
      if (now) {
        const dx = now.x0 - onFloat.x0;
        if (dx && boxClear(this.env, b.x + dx - HERO_W / 2, now.y - HERO_H, b.x + dx + HERO_W / 2, now.y - 0.01)) b.x += dx;
        if (now.kind === 'lift') {
          const dy = now.y - onFloat.y;
          const { x0, x1 } = now;
          if (this.follower.x >= x0 && this.follower.x <= x1 && Math.abs(this.follower.y - onFloat.y) < 5) {
            this.follower.y += dy;
            for (const pt of this.trail) if (pt.x >= x0 && pt.x <= x1 && Math.abs(pt.y - onFloat.y) < 5) pt.y += dy;
          }
        }
        b.y = now.y;
      }
    }
    // facing holds only while a blow is landing (a swing's active frames, a cast's release): the wind-up and the
    // recovery turn freely, so holding the other way turns the next cut of a combo round
    const sw = SWING[this.lead];
    const lockFace = !!act && ((act.kind === 'swing' && act.t >= sw.wind && act.t < sw.wind + sw.act) || (act.kind === 'cast' && act.t < act.dur));
    if (lockFace) b.face = faceBefore;
    const climbing = b.climb;
    stepBody(b, bin, this.env, caps);
    this.glacierClimbing = !!(this.glacier && b.climb && this.glacierGeometry(Math.floor(b.x / TILE), Math.floor((b.y - 9) / TILE))?.climb);
    if (lockFace) b.face = faceBefore;
    if (b.jumped) this.sfx(b.jumped === 'swim' ? 'stroke' : b.jumped === 'wall' ? 'kick' : b.jumped === 'air' ? 'leap' : 'jump');
    if (b.dashed) { this.sfx('dash'); rt.inv = Math.max(rt.inv, 14); }
    if (b.landed && !climbing) this.sfx('land'); // stepping off the top of a ladder is a pull-up, not a landing
    if (b.swim && !wasSwim) this.sfx('splash', b.x, b.y);
    if (b.bonk) this.bonkHatch();
    if (b.slamHit) this.slamImpact();
    if (b.hooked && b.rope) { this.sfx('rope', b.rope.hx, b.rope.hy); this.emit({ k: 'rope', on: true, x: b.rope.hx, y: b.rope.hy }); }
    if (b.unhooked) { this.sfx(b.jumped === 'rope' ? 'leap' : 'ropeOff', b.x, b.y); this.emit({ k: 'rope', on: false, x: b.x, y: b.y }); }
    this.updateRopeGuide(inp);

    // the acting hero's attack
    this.updateAct();

    // safe ledge, hazards, regen
    const sup = b.ground ? support(this.env, b) : null;
    // (on the condor's bridge the planks count too, so a fall through a broken one comes back up onto the bridge)
    const bridge = sup === 'oneway' && this.room.id === 'condorbridge' && this.planks.size === 0;
    if ((sup === 'solid' || bridge) && !b.swim && !this.nearHazard()) { if (++this.safeT >= 8) { this.safe = { x: b.x, y: b.y }; } } else this.safeT = 0;
    if (b.hazard) this.hitHazard();
    this.regen();
    this.updateHeat();

    // follower
    this.updateFollower();
    if (this.saltLift) {
      const lift = this.saltLift, { x, y } = roomRect(this.room);
      const lx = b.x - x, ly = b.y - y;
      if (lx > lift.plan.left && lx < lift.plan.right && ly > lift.plan.low + 8) {
        this.teleport(this.room.id, Math.floor(lift.plan.station / TILE), 14);
        this.note('Back at the lower landing.');
      } else if (b.ground && lift.phase === 'arrived' && !lift.crossed && lift.onUpper(lx, ly)) {
        lift.crossed = true;
        this.setFlag(`salt:crossed:${this.room.id}`);
        this.sfx('calm');
        this.emit({ k: 'save' });
      }
    }

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
    const dur = kind === 'swing' ? sw.wind + sw.act + Math.round(sw.rec * fast) : kind === 'thrust' || kind === 'slam' ? 999 : kind === 'whirl' ? 26 : kind === 'cast' ? 16 : 14;
    rt.act = { kind, t: 0, n, hit: new Set(), dur, spell };
    rt.buf = false;
    if (kind === 'swing') this.sfx(this.lead === 'dora' ? (n === 2 ? 'slash3' : 'slash') : 'staff');
    if (kind === 'thrust') this.sfx('thrust');
    if (kind === 'slam') this.sfx('hammerUp');
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
    if (act.kind === 'slam') return b.slam > 7 ? { r: { x: b.x - 9, y: b.y - 6, w: 18, h: 18 }, mult: 1.6, finisher: true } : null;
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
    } else if (act.kind === 'slam') {
      if (b.slam === 0 && act.t > 1) { rt.act = null; return; }
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
      for (const h of this.boss.hurt) if (!act.hit.has(-1) && overlap(box.r, h)) { act.hit.add(-1); crit = false; this.damageBoss(dmgOf(box.mult) * ((h as Rect & { mul?: number }).mul ?? 1), box.r.x + box.r.w / 2, box.r.y + box.r.h / 2, false, h, act.kind); landed = true; if (crit) this.emit({ k: 'crit', x: box.r.x + box.r.w / 2, y: box.r.y + box.r.h / 2 }); }
    }
    // breakable walls, chests and water bells react to a swing too
    if (act.kind !== 'tagin') {
      for (const g of INFO.get(this.room.id)!.walls) {
        if (this.wallBroken(g) || act.hit.has(-1000 - INFO.get(this.room.id)!.walls.indexOf(g))) continue;
        const gr = { x: g.c * TILE, y: g.r * TILE, w: g.w * TILE, h: g.h * TILE };
        if (overlap(box.r, gr)) { act.hit.add(-1000 - INFO.get(this.room.id)!.walls.indexOf(g)); this.hitWall(g); landed = true; }
      }
      for (const t of INFO.get(this.room.id)!.things) {
        const tall = t.ch === 'B' || t.ch === 'W';
        const tr = { x: t.c * TILE, y: t.r * TILE - (tall ? 8 : 0), w: TILE, h: TILE + (tall ? 8 : 0) };
        if (!overlap(box.r, tr)) continue;
        if (t.ch === 'W' && !act.hit.has(-3000 - t.i)) { act.hit.add(-3000 - t.i); this.ringWind(t); landed = true; }
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
      if (act.kind === 'thrust' || act.kind === 'slam') { b.vy = -5.2; b.slam = 0; b.airJumps = this.caps().double ? 1 : 0; b.airDash = true; this.sfx('bounce'); if (act.kind === 'slam') rt.act = null; }
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
    // the glass snail's shell: half a blow, but a hammer slam shatters it
    if (e.kind === 'gsnail') { if (this.slamming || this.leadRt.act?.kind === 'slam') { dmg *= 3; big = true; } else dmg = Math.max(1, Math.round(dmg / 2)); }
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
      // Harvest (the Night Orchard coats): drops come more often and heal more
      const harvest = ALL_HEROES.some((h) => this.perk(h, 'harvest'));
      if (this.rand() < (harvest ? 0.4 : 0.22)) this.pickups.push({ id: this.nextId++, kind: this.rand() < 0.5 ? 'mp' : 'hp', x: e.x, y: e.y - f.h / 2, vy: -2, amount: harvest ? 10 : 4, t: 0 });
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
    const b = this.body;
    // by an echo bell, the chime is swept out in a ringing arc toward it (its own pose)
    const echo = this.has('echo') && INFO.get(this.room.id)!.things.some((t) => t.ch === 'Q' && Math.hypot(t.c * TILE + 8 - b.x, t.r * TILE - b.y) < 150);
    // by a humming crystal or a prism (with Resonance), its own pose: the staff raised, listening
    const res = this.has('resonance') && INFO.get(this.room.id)!.things.some((t) => (t.ch === '*' || t.ch === '!') && Math.hypot(t.c * TILE + 8 - b.x, t.r * TILE - b.y) < 150);
    this.startAct('cast', 0, res ? 'resonance' : echo ? 'echo' : 'chime');
    this.rings.push({ x: b.x, y: b.y - 14, r: 4, vr: 4.4, max: 150, thick: 8, dmg: Math.round(this.magic() * 0.6), friendly: true, kind: 'chime', hit: [], rung: [] });
    this.sfx('chime');
    this.emit({ k: 'pulse', x: b.x, y: b.y - 14, r: 150, color: [1, 0.85, 0.45] });
  }
  /** A molten channel still hot within `d` px of the lead (along the floor ahead or below). */
  hotChannelNear(d: number): Channel | null {
    const b = this.body;
    let best: Channel | null = null, bd = d;
    for (const q of CHANNELS) {
      if (q.room !== this.room.id || this.frozen.has(q.id)) continue;
      const dx = Math.max(q.c0 * TILE - b.x, 0, b.x - (q.c1 + 1) * TILE), dy = q.r * TILE - b.y;
      if (dy < -2 * TILE || dy > 9 * TILE) continue;
      if (dx < bd) { bd = dx; best = q; }
    }
    return best;
  }
  /** In the air: three hail shards in a fan, forward and down. On the ground by molten bronze: a low sweep of frost
   *  along the floor. Either way the cold washes over molten channels close by and cools them into a crust. */
  castFrost(low = false) {
    if (!this.spendMp(SPELLS.frost.mp, SPELLS.frost.name)) return;
    this.startAct('cast', 0, 'frost');
    const b = this.body, dmg = Math.round(this.magic() * 0.75);
    for (let i = 0; i < 4; i++) { const q = this.hotChannelNear(7 * TILE); if (!q) break; this.chill(q); }
    if (low) { for (const a of [0, 0.15]) this.shots.push({ id: this.nextId++, kind: 'hail', friendly: true, x: b.x + b.face * 8, y: b.y - 6, vx: Math.cos(a) * 3.8 * b.face, vy: 0, g: 0, life: 45, dmg, r: 5, hits: [] }); this.sfx('frost', b.x, b.y); return; }
    for (const a of [0.35, 0.7, 1.05]) this.shots.push({ id: this.nextId++, kind: 'hail', friendly: true, x: b.x + b.face * 8, y: b.y - 14, vx: Math.cos(a) * 4.2 * b.face, vy: Math.sin(a) * 4.2, g: 0.04, life: 60, dmg, r: 5, hits: [] });
    this.sfx('frost', b.x, b.y);
  }
  /** Held long: a rolling wave of wind along the ground that knocks foes back and rings wind bells. */
  castGale() {
    if (!this.spendMp(SPELLS.gale.mp, SPELLS.gale.name)) return;
    this.startAct('cast', 0, 'gale');
    const b = this.body;
    this.shots.push({ id: this.nextId++, kind: 'gale', friendly: true, x: b.x + b.face * 14, y: b.y - 12, vx: b.face * 3.4, vy: 0, g: 0, life: 80, dmg: Math.round(this.magic() * 1.3), r: 14, hits: [] });
    this.sfx('gale', b.x, b.y); this.emit({ k: 'shake', n: 3 });
  }
  /** A wind bell rung (hit, bolted, chimed or blown): the area's wind turns round. */
  ringWind(t: Thing) {
    const area = this.room.area;
    if (!(WIND_AREAS as string[]).includes(area)) return;
    const a = area as WindArea;
    this.save.wind[a] = this.save.wind[a] > 0 ? -1 : 1;
    const x = t.c * TILE + 8, y = t.r * TILE;
    this.sfx('windbell', x, y); this.emit({ k: 'wind', area: a, dir: this.save.wind[a] }); this.emit({ k: 'pulse', x, y, r: 150, color: [0.8, 0.95, 1] });
    this.note(`The wind turns round: it blows ${this.save.wind[a] > 0 ? 'east →' : '← west'} now.`, true);
    this.setFlag('rang:wind');
  }
  /** An echo bell rung by the chime: three notes appear along its path, one after another. */
  ringEcho(t: Thing) {
    const x = t.c * TILE + 8, y = t.r * TILE;
    if (!this.has('echo')) { this.note('The echo bell hums, but its note slips away. Something on the mountain could teach Enzo to hold it.'); this.sfx('locked'); return; }
    const path = this.room.echoes?.[t.i];
    if (!path) return;
    const life = NOTE_LIFE * (this.perk('enzo', 'notes') ? 2 : 1) * (this.helping() ? NOTE_ASSIST : 1);
    this.notes = this.notes.filter((n) => !n.key.startsWith(`${this.room.id}:${t.i}:`));
    path.forEach(([dc, dr], k) => {
      const c = t.c + dc, r = t.r + dr;
      this.notes.push({ key: `${this.room.id}:${t.i}:${k}`, room: this.room.id, x0: c * TILE, x1: (c + 2) * TILE, y: r * TILE, t: 0, at: k * NOTE_GAP, life: life + k * NOTE_GAP });
    });
    this.sfx('echo', x, y); this.emit({ k: 'notes', x, y }); this.emit({ k: 'pulse', x, y, r: 120, color: [0.4, 0.95, 1] });
    if (!this.flag('rang:echo')) { this.setFlag('rang:echo'); this.note(`Three notes hang in the air for ${this.helping() ? 'about twelve' : 'a few'} seconds. Climb them!`, true); }
  }
  /** A humming crystal rung by the chime (with Resonance): its bridge lights up, slab after slab. */
  ringCrystal(t: Thing) {
    const x = t.c * TILE + 8, y = t.r * TILE;
    if (!this.has('resonance')) { this.note('The crystal hums back, but the sound slips away. Something in the foundry could teach Enzo to hold it.'); this.sfx('locked'); return; }
    const path = this.room.crystals?.[t.i];
    if (!path) return;
    const life = CRYSTAL_LIFE * (this.perk('enzo', 'notes') ? 2 : 1) * (this.helping() ? NOTE_ASSIST : 1);
    const pre = `${this.room.id}:x${t.i}:`;
    this.notes = this.notes.filter((n) => !n.key.startsWith(pre));
    // (the slabs join into one walkway along a row: see crystalSpans)
    crystalSpans(t.c, t.r, path).forEach(({ x0, x1, y }, k) => {
      this.notes.push({ key: `${pre}${k}`, room: this.room.id, x0, x1, y, t: 0, at: k * CRYSTAL_GAP, life: life + k * CRYSTAL_GAP });
    });
    this.sfx('crystal', x, y); this.emit({ k: 'notes', x, y }); this.emit({ k: 'pulse', x, y, r: 120, color: [0.8, 0.55, 1] });
    if (!this.flag('rang:crystal')) { this.setFlag('rang:crystal'); this.note(`The crystals line up into a bridge for ${this.helping() ? 'about half a minute' : 'about ten seconds'}. Go!`, true); }
  }
  /** A prism rung by the chime (with Resonance): a beam to every beam door close by, and they open. */
  ringPrism(t: Thing) {
    const x = t.c * TILE + 8, y = t.r * TILE + 8;
    if (!this.has('resonance')) { this.note('The prism glints, but nothing answers. It wants a note held true.'); this.sfx('locked'); return; }
    let n = 0;
    for (const d of BEAM_DOORS) {
      const dx = (d.c + d.w / 2) * TILE, dy = (d.r + d.h / 2) * TILE;
      if (Math.hypot(dx - x, dy - y) > BEAM_REACH || this.doorOpen(d)) continue;
      this.emit({ k: 'beam', x, y, tx: dx, ty: dy }); this.openDoor(d); n++;
    }
    this.sfx('beam', x, y); this.emit({ k: 'pulse', x, y, r: 90, color: [0.85, 0.6, 1] });
    if (!n) this.note('The prism’s beam finds no shut door.', true);
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
  /** The helping hand is on (and not Strict). */
  helping() { return this.settings.assist && !this.settings.strict; }
  /** An echo bell close by, with the helping hand on and the Echo Step learned (for its glow and its prompt). */
  echoNear(): Thing | null {
    if (!this.helping() || !(this.has('echo') || this.has('resonance'))) return null;
    const b = this.body;
    let best: Thing | null = null, bd = 1e9;
    for (const t of INFO.get(this.room.id)!.things) {
      if (!(t.ch === 'Q' && this.has('echo')) && !((t.ch === '*' || (t.ch === '!' && this.prismShut(t))) && this.has('resonance'))) continue;
      const dx = Math.abs(t.c * TILE + 8 - b.x), dy = Math.abs((t.r + 1) * TILE - b.y);
      if (dx < 56 && dy < 40 && dx < bd) { best = t; bd = dx; }
    }
    return best;
  }
  /** What the echo bell close by asks for: ring it (Enzo) or tag to Enzo (Dora). Null without one. */
  echoHint(): 'ring' | 'tag' | null {
    const t = this.echoNear();
    if (!t || this.dialog) return null;
    const pre = t.ch === '*' ? `${this.room.id}:x${t.i}:` : `${this.room.id}:${t.i}:`;
    if (t.ch !== '!' && this.notes.some((n) => n.key.startsWith(pre) && n.t < n.life - 60)) return null;
    if (this.lead === 'enzo') return 'ring';
    return this.save.heroes.enzo.down ? null : 'tag';
  }
  /** With the helping hand and the Frost Fan learned: a hot molten channel close by on the ground, and what it asks for
   *  (frost it as Enzo, or tag to Enzo as Dora). Null without one. */
  /** With the helping hand: slag in the floor close by on the hero's own level, in a room with mist vents, and whether
   *  to wait for a puff or go now (it's hard while they puff). Null without any, or once the hero stands on slag. */
  ventHint(): { c: number; r: number; ask: 'wait' | 'go' } | null {
    if (!this.helping() || this.dialog || !this.body.ground) return null;
    if (!INFO.get(this.room.id)!.things.some((t) => t.ch === '%')) return null;
    const b = this.body, c = Math.floor(b.x / TILE), r = Math.round(b.y / TILE);
    if (rawChar(c, r) === ':') return null;
    for (let d = 1; d <= 5; d++) for (const s of [b.face, -b.face]) if (rawChar(c + s * d, r) === ':') return { c: c + s * d, r, ask: this.ventUp() ? 'go' : 'wait' };
    return null;
  }
  /** With the helping hand, fighting the Molten Founder: what to do next. Enzo frosts it; once a frosted patch is on
   *  it, Dora strikes there (tagging between the two as needed). Null outside the fight. */
  founderHint(): 'frost' | 'tagDora' | 'tagEnzo' | 'strike' | null {
    const f = this.boss;
    if (!this.helping() || this.dialog || !f || f.id !== 'founder' || f.calm || f.st === 'wait' || f.st === 'intro') return null;
    const spots = (f.spots ?? []).length > 0, { enzo, dora } = this.save.heroes;
    if (enzo.down) return this.lead === 'dora' ? 'strike' : null;
    if (this.lead === 'enzo') return spots && !dora.down ? 'tagDora' : 'frost';
    return spots ? 'strike' : 'tagEnzo';
  }
  frostHint(): { q: Channel; ask: 'frost' | 'tag' } | null {
    if (!this.helping() || this.dialog || !this.save.spells.includes('frost') || !this.body.ground) return null;
    const q = this.hotChannelNear(5 * TILE);
    if (!q) return null;
    if (this.lead === 'enzo') return { q, ask: 'frost' };
    return this.save.heroes.enzo.down ? null : { q, ask: 'tag' };
  }
  /** With the helping hand: the echo bell in this room when its notes are the way on (the way to the goal leads well
   *  above the heroes and above the bell's first note, and its notes aren't standing), for the wisp and the maps. */
  echoGuide(): { room: string; x: number; y: number } | null {
    if (!this.helping() || !this.has('echo')) return null;
    const bells = INFO.get(this.room.id)!.things.filter((t) => t.ch === 'Q' && this.room.echoes?.[t.i]);
    if (!bells.length) return null;
    const way = this.wayToGoal();
    const b = this.body;
    if (!way || way.y > b.y - 4 * TILE) return null;
    let best: Thing | null = null, bd = 1e9;
    for (const t of bells) {
      const first = (t.r + this.room.echoes![t.i][0][1]) * TILE;
      if (way.y > first || b.y <= first) continue;
      if (this.notes.some((n) => n.key.startsWith(`${this.room.id}:${t.i}:`) && n.t < n.life - 60)) continue;
      const d = Math.hypot(t.c * TILE + 8 - way.x, t.r * TILE - way.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best ? { room: this.room.id, x: best.c * TILE + 8, y: best.r * TILE } : null;
  }
  /** A prism with a shut beam door in its reach. */
  prismShut(t: Thing) {
    const x = t.c * TILE + 8, y = t.r * TILE + 8;
    return BEAM_DOORS.some((d) => !this.doorOpen(d) && Math.hypot((d.c + d.w / 2) * TILE - x, (d.r + d.h / 2) * TILE - y) <= BEAM_REACH);
  }
  nearby(): Thing | null {
    const b = this.body;
    if (!b.ground || b.climb) return null;
    const info = INFO.get(this.room.id)!;
    let best: Thing | null = null, bd = 1e9;
    for (const t of info.things) {
      if (!'SMRUCDN?;,q()/'.includes(t.ch)) continue;
      if (t.ch === 'C' && this.flag(`chest:${this.room.id}:${t.i}`)) continue;
      const dx = Math.abs(t.c * TILE + 8 - b.x), dy = Math.abs((t.r + 1) * TILE - b.y);
      const reach = t.ch === 'M' || t.ch === 'S' || t.ch === 'D' || t.ch === 'N' ? 30 : 20;
      if (dx < reach && dy < 26 && dx < bd) { best = t; bd = dx; }
    }
    return best;
  }
  /** Killa, the orchard keeper, at the Orchard Wicket: a first meeting with Dora and Enzo, then a word that moves on
   *  with the story (Lantern Bloom, the Graft Shear, each guardian, then the root lift up to the Glacier Stair). */
  killaLines(first = false): Line[] {
    const k = (text: string): Line => ({ who: 'killa', text }), d = (text: string): Line => ({ who: 'dora', text }), e = (text: string): Line => ({ who: 'enzo', text });
    const meet = first ? [
      k('Oh! Visitors through the wicket. I’m Killa. I keep what’s left of the orchard.'),
      d('I’m Dora, and this is Enzo. The Tollkeeper is calm, so the salt road is open again.'),
      k('Then the caravans will want fruit, and the grafts haven’t flowered in years.'),
      e('My lantern woke a little golden bud on the way in. Only for a moment.'),
    ] : [];
    if (!this.has('bloom')) return [...meet, k('Then you’re the light they have been waiting for. Take Lantern Bloom from the pedestal up the steps, and the golden buds will open for you.')];
    if (!this.has('shear')) return [...meet, k('Lantern Bloom suits you, Enzo. Now Dora needs my Graft Shear: it’s on the low landing of the Graft Terraces, east of here.'), d('Wake the bud, then cut the ochre tie. I can do that.')];
    if (!this.flag('boss:bracken-stag')) return [...meet, k('Wake the bud, cut the tie, and the branch above comes down to meet you. The Bracken Stag guards the far end of the terraces.'), e('Its antlers could catch in a branch, if I open one in its path.')];
    if (!this.flag('boss:rootback')) return [...meet, k('The Stag is grazing quietly for the first time in years. Below the cistern, the Rootback has dug itself into the Root Vault.'), d('Then down the ladders we go.')];
    if (!this.flag('boss:graft-mother')) return [...meet, k('The Rootback has settled. Only the Mother of Grafts is left, at the bottom of the Root Cellars. She guards one side, then the other.'), e('So we watch which side she strikes from, and open that bud.')];
    if (!this.flag('glacier:visited')) return [...meet, k('Every lamp in the orchard is lit. And listen: the old root lift in the Mother’s chamber has woken. Climb to the high east terrace of her room and ride it up past the snowline.'), d('The root lift. East terrace. Got it.')];
    if (!this.flag('boss:sun-gate')) return [...meet, k('Phuyu sent word down the root lift: the Sun Gate is still frozen shut. Mind the ice, both of you.'), e('Phuyu showed us how to turn the sun onto it.')];
    return [...meet, k('The first carts go up to the pass tomorrow. I packed one basket just for you two.'), d('Thank you, Killa. It smells like summer.')];
  }
  /** Suma, the salt road's tally keeper, at the Salt Gate: a first meeting, then a word that moves on with the story
   *  (her road's two moves and three guardians, then the orchard wicket, and the caravans up to the pass). */
  sumaLines(first = false): Line[] {
    const s = (text: string): Line => ({ who: 'suma', text }), d = (text: string): Line => ({ who: 'dora', text }), e = (text: string): Line => ({ who: 'enzo', text });
    const meet = first ? [
      s('Halt! Load and weight, please... no, sorry. Habit. I’m Suma. I counted every load on this road until the bells went quiet.'),
      e('Tupa opened the supply door for us. I’m Enzo, and this is Dora.'),
      d('What stopped the caravans?'),
      s('Three guardians took the scales and the lifts. Nobody has been past them since.'),
    ] : [];
    if (!this.has('ballast')) return [...meet, s('Take Shoulder Shift from this pedestal, Dora. Then Enzo needs Lift Catch, by the first hoist. Dora moves the ballast. Enzo locks the lift level. Both of you ride.')];
    if (!this.has('catch')) return [...meet, s('Shoulder Shift suits you. Lift Catch is by the first hoist, Enzo. Dora lowers the deck, you lock it level, then both of you ride.'), e('One shifts, one catches. Like a tally: both sides have to match.')];
    if (!this.flag('boss:weighmaster')) return [...meet, s('The Whiteback Weighmaster holds the steps. Set the stop and draw it into a charge: its flank opens when it hits.'), d('Make it charge, then strike the side. Got it.')];
    if (!this.flag('boss:panback')) return [...meet, s('One guardian calm. I’ve marked it on my cord. The Panback Armadillo is down in the galleries: raise the weighing pan under it, Enzo.'), e('And Dora strikes the belly while it’s up.')];
    if (!this.flag('boss:tollkeeper')) return [...meet, s('Two knots on the cord. Only the Last Tollkeeper is left, in the Tollhouse. Shift its counterweight, Dora, then strike under the raised shield.'), d('Last one. Let’s go.')];
    if (!this.flag('orchard:visited')) return [...meet, s('The road is open and the loads are moving! And when the Tollkeeper fell, the old orchard wicket swung open on the east side of the Tollhouse. Killa keeps the orchard through there.'), e('An orchard, up here? I want to see that.')];
    if (!this.flag('boss:graft-mother')) return [...meet, s('Killa’s fruit would sell from here to the lake, if the grafts would flower again.'), d('We’re working on it, Suma.')];
    if (!this.flag('boss:sun-gate')) return [...meet, s('Salt down to the lake, fruit up from the orchard. Phuyu says the pass will take both, once the Sun Gate opens.'), e('Then we’ll open it.')];
    return [...meet, s('Seven loads of salt and three of fruit, all the way up to the pass. I’ve never tied so many knots in one day.'), d('You’ll need a longer cord, Suma.')];
  }
  /** What ↑ does here, for the on-screen hint. */
  nearbyLabel(): string | null {
    const t = this.nearby();
    if (!t) return null;
    if (t.ch === '?') return this.room.salt ? 'Return to the Foundry Gate' : this.saltKnown() ? 'Enter the Salt Road' : 'Inspect the old supply door';
    if (t.ch === ',') return isOrchardRoom(this.room) ? 'Return to the Tollhouse' : this.orchardKnown() ? 'Enter the Night Orchard' : 'Inspect the orchard wicket';
    if (t.ch === 'q') return 'Talk to Killa';
    if (t.ch === '(') return this.room.id === GLACIER_GATE ? 'Take the root lift down' : this.glacierKnown() ? 'Take the root lift up' : 'Inspect the root lift';
    if (t.ch === ')') return 'Talk to Phuyu';
    if (t.ch === '/') return this.room.id === GLACIER_VAULT ? 'Return to Meltwater Run' : 'Enter the Cold Vault';
    return ({ ';': 'Talk to Suma', S: 'Rest and save', M: 'Talk to Wayra', R: 'Read the mural', U: 'Talk to Ukumari', C: 'Open the chest', D: 'Take Wayra’s boat', N: 'Talk to Tupa' } as Record<string, string>)[t.ch] ?? null;
  }
  interact() {
    const salt = this.saltPrompt();
    if (salt?.key === 'up' && this.saltLift) {
      const { x, y } = roomRect(this.room);
      const phase = this.saltLift.phase;
      if (this.saltLift.use(this.body, this.body.x - x, this.body.y - y, this.lead, this.follower.x - x, this.follower.y - y)) {
        if (phase === 'parked' || phase === 'catch') this.saltWork = { hero: this.lead, until: this.tick + 24, face: this.saltLift.plan.direction };
        this.sfx('door');
      }
      return;
    }
    if (this.useSaltGuardian()) return;
    const best = this.nearby();
    if (!best) return;
    if (best.ch === '(' || best.ch === '/') {
      if (best.ch === '(' && !this.glacierKnown()) { this.note('The root lift will wake when the Mother of Grafts is calm.'); return; }
      if (best.ch === '(') {
        if (this.room.id === GLACIER_GATE) this.teleport(GLACIER_RETURN, ...ROOT_LIFT);
        else { this.setFlag('glacier:visited'); this.teleport(GLACIER_GATE, 3, 14); }
      } else if (this.room.id === GLACIER_VAULT) this.teleport(GLACIER_VAULT_FROM, ...GLACIER_VAULT_DOOR);
      else this.teleport(GLACIER_VAULT, 3, 14);
      this.sfx('door'); this.emit({ k: 'save' });
      return;
    }
    if (best.ch === ')') {
      const camp = this.room.id === 'glacier-camp';
      this.say([{ who: 'phuyu', text: camp ? 'Take my Sun Mirror, Enzo. Turn it in a brass socket where there is light. The beam will make the ice run.' : 'Welcome above the snowline. Let the ice carry you, then plant your boots on stone. My camp is up the road.' }]);
      this.sfx('talk');
      return;
    }
    if (best.ch === ',') {
      const back = isOrchardRoom(this.room);
      if (!back && !this.orchardKnown()) { this.note('The orchard wicket opens after the Tollkeeper is calm.'); return; }
      if (back) this.teleport(ORCHARD_RETURN, ...ORCHARD_EXIT);
      else this.teleport(ORCHARD_GATE, 3, 11);
      this.setFlag('orchard:visited');
      this.sfx('door');
      this.emit({ k: 'room', id: this.room.id });
      return;
    }
    if (best.ch === 'q') {
      const first = !this.flag('script:killa');
      this.setFlag('script:killa');
      this.say(this.killaLines(first));
      this.sfx('talk');
      return;
    }
    if (best.ch === '?') {
      if (!this.room.salt && !this.saltKnown()) { this.note('Tupa will open the old supply door once the Hollow Bell is calm.'); return; }
      const back = !!this.room.salt;
      this.teleport(back ? 'fgate' : SALT_GATE, back ? 25 : 5, 14);
      this.setFlag('salt:visited');
      this.sfx('door');
      this.emit({ k: 'room', id: this.room.id });
      return;
    }
    if (best.ch === ';') {
      const first = !this.flag('script:suma');
      this.setFlag('script:suma');
      this.say(this.sumaLines(first));
      this.sfx('talk');
      return;
    }
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
    else if (best.ch === 'D') this.takeBoat();
    else if (best.ch === 'N') {
      if (!this.flag('script:tupa')) { this.setFlag('script:tupa'); this.say(SCRIPTS.tupa, () => this.emit({ k: 'forge' })); }
      else this.emit({ k: 'forge' });
      this.sfx('talk');
    }
  }
  /** Why Tupa can't recast this piece with this perk now, or null if they can. */
  whyNotRecast(id: string, perk: Perk): string | null {
    const g = GEAR[id];
    if (!g || !this.save.gear.includes(id)) return 'You don’t have that.';
    if (!(RECAST_PERKS as string[]).includes(perk)) return 'Tupa can’t work that in.';
    if (g.perk === perk) return `The ${g.name} already has that.`;
    if (this.save.recast[id] === perk) return 'It’s already recast with that.';
    if (this.save.coins < RECAST_PRICE) return `Needs ${RECAST_PRICE - this.save.coins} more coins.`;
    return null;
  }
  /** Tupa recasts a piece of gear in the forge with a perk worked in (one recast per piece: a new one replaces it). */
  recast(id: string, perk: Perk): string | null {
    const why = this.whyNotRecast(id, perk);
    if (why) return why;
    this.save.coins -= RECAST_PRICE;
    this.save.recast[id] = perk;
    for (const h of ALL_HEROES) this.clampHero(h);
    this.sfx('anvil'); this.setFlag('recast:first');
    this.emit({ k: 'save' });
    return null;
  }

  /** Wayra's boat: from the landing to the foot of the Cloudstair and back, once the Lake Mother is calm. */
  takeBoat() {
    if (!this.flag('boss:mother')) { this.say(SCRIPTS.boatEarly); this.sfx('talk'); return; }
    const to = this.room.id === 'landing' ? 'cliffoot' : 'landing';
    const t = INFO.get(to)!.things.find((x) => x.ch === 'D')!;
    const x = t.c * TILE + 8 + 22, y = (t.r + 1) * TILE;
    Object.assign(this.body, newBody(x, y));
    this.body.face = 1;
    this.changeRoom(roomById(to));
    this.follower.x = x - 18; this.follower.y = y;
    this.safe = { x, y };
    this.sfx('row'); this.emit({ k: 'travel', id: to }); this.emit({ k: 'flash', color: '#fff4e0', n: 10 });
    this.setFlag('belfry:visited');
    this.note(to === 'cliffoot' ? 'Wayra rows you across to the foot of the Cloudstair.' : 'Wayra rows you back to the Lakebed Landing.', true);
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
    // once the Lake Mother is calm, Wayra tells the heroes about the bell on the mountain (once)
    if (this.flag('boss:mother') && !this.flag('script:belfryCall') && !isBelfryRoom(this.room.id)) { this.setFlag('script:belfryCall'); this.say(SCRIPTS.belfryCall); }
    if (this.flag('boss:tune') && !this.flag('script:trials')) { this.setFlag('script:trials'); this.say(SCRIPTS.trials); }
    // and then Ukumari hears the seal under the throne crack (once)
    else if (this.flag('boss:tune') && !this.flag('script:foundryCall') && !isBelfryRoom(this.room.id)) { this.setFlag('script:foundryCall'); this.say(SCRIPTS.foundryCall); }
    this.heat = 0;
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
      this.emit({ k: 'item', text: `${SPELLS[id as SpellId].name}: ${SPELLS[id as SpellId].how}`, icon: id === 'frost' ? 38 : id === 'gale' ? 39 : undefined }); this.sfx('relic');
    }
    for (const h of ALL_HEROES) this.clampHero(h);
  }

  giveAbility(a: Ability, announce: boolean) {
    if (!this.has(a)) this.save.abilities.push(a);
    if (a === 'chime' && !this.save.spells.includes('chime')) this.save.spells.push('chime');
    this.setFlag(`ability:${a}`);
    if (announce) {
      this.emit({ k: 'item', text: `${ABILITIES[a].name}! ${ABILITIES[a].how}`, icon: abilityIcon(a) });
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
    const a = DOOR_ABILITY[g.ch];
    if (a && 'djkyn'.includes(g.ch) && this.has(a)) { this.openDoor(g); return; }
    let text = '';
    if (a && !this.has(a)) text = `${ABILITIES[a].needs}.`;
    else if (g.ch === 'l') text = 'The hatch is sealed with darkness. Raise Enzo’s lantern next to it (as Enzo: ↓ + V).';
    else if (g.ch === 'c') text = 'A bell-sealed door. Ring it with the Bell Chime (as Enzo: ↑ + V).';
    else if (g.ch === 'u') text = this.restless().length
      ? `The throne door is held by four bell seals, ${this.sealsOpen()} of 4 open. Still ringing: ${this.restlessText()}.`
      : 'The throne door is tied shut with an old bell rope. Whoever keeps the bells could open it.';
    else if (g.ch === 'b') text = 'The way out is sealed until the guardian calms down.';
    else if (g.ch === '9') text = 'An old bronze seal in the floor. Something far above has to ring true before it cracks.';
    else if (g.ch === 'V') {
      const left = FOUNDRY_GUARDIANS.filter((b) => !this.flag(`boss:${b}`)).map((b) => BOSSES[b].name.replace(/^The /, 'the '));
      text = `The deep seal holds while ${left.join(' and ')} ${left.length === 1 ? 'is' : 'are'} still restless.`;
    } else if (g.ch === '8' && this.has('hammer')) text = 'Cracked glass. Slam it from above: jump, then ↓ + attack as Dora.';
    else if (g.ch === '&' && this.has('resonance')) text = 'A beam door. Ring the chime by its prism, as Enzo (↑ + V).';
    else if (g.ch === 'Z') {
      const left = BELFRY_GUARDIANS.filter((b) => !this.flag(`boss:${b}`)).map((b) => BOSSES[b].name.replace(/^The /, 'the '));
      text = `The belfry seal holds while ${left.join(' and ')} ${left.length === 1 ? 'is' : 'are'} still restless.`;
    }
    if (text) { this.note(text); if (this.lastToastT === this.tick) this.sfx('locked'); }
  }
  openDoor(g: Group) {
    this.setFlag(`door:${g.id}`);
    this.sfx('door'); this.emit({ k: 'pulse', x: (g.c + g.w / 2) * TILE, y: (g.r + g.h / 2) * TILE, r: 70, color: hexRgb(ABILITIES[DOOR_ABILITY[g.ch] ?? 'chime'].color) });
    this.note('The door opens.', true);
  }
  bonkHatch() { /* hatches open on touch through touchDoors */ }
  /** Dora's Bell Hammer lands: cracked glass under her shatters, a shockwave rings bells and hurts foes close by. */
  slamImpact() {
    const b = this.body, c = Math.floor(b.x / TILE), r = Math.round(b.y / TILE);
    let broke = false;
    for (let dc = -1; dc <= 1; dc++) {
      const g = groupAt(c + dc, r);
      if (g && g.ch === '8' && !this.doorOpen(g)) { this.openDoor(g); this.emit({ k: 'shatter', x: b.x, y: b.y }); this.sfx('shatter', b.x, b.y); broke = true; }
    }
    const dmg = Math.round(this.stats('dora').atk * 1.3);
    this.rings.push({ x: b.x, y: b.y - 4, r: 4, vr: 4, max: 56, thick: 10, dmg, friendly: true, kind: 'slam', hit: [], rung: [] });
    this.emit({ k: 'slam', x: b.x, y: b.y, bounce: b.bounced });
    this.emit({ k: 'shake', n: broke ? 8 : 5 });
    this.sfx(b.bounced ? 'boing' : 'slam', b.x, b.y);
  }

  nearHazard() {
    const b = this.body, c = Math.floor(b.x / TILE), r = Math.round(b.y / TILE);
    for (let dc = -1; dc <= 1; dc++) for (let dr = 0; dr <= 1; dr++) if ('^_~:'.includes(rawChar(c + dc, r + dr))) return true;
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
    // New Game+: a guardian's blows land at least as hard as NGP_HIT, so the early ones still matter to strong heroes
    if (this.save.ngp && this.boss && !this.boss.calm && atk > 0) atk = Math.max(atk, NGP_HIT);
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
    // hit on the guided rope: back to the ledge she swung from, safe (the hit itself still counts)
    if (b.rope && this.caps().ropeAssist && ropeBail(this.env, b)) this.emit({ k: 'rope', on: false, x: b.x, y: b.y });
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
    // in an Echo Trial, both heroes knocked out ends it
    if (this.trial) { this.endTrial(false, 'Both heroes were knocked out.'); return; }
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
        // Caravan stamina (the Salt Road coats): HP too, but never while a guardian is awake
        if (this.perk(h, 'mend') && !this.boss) s.hp += 3;
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
        case 'wall-moth':
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
        case 'condor': case 'hawk': {
          if (e.st === 'idle') {
            e.y = e.hy + Math.sin(e.t * 0.05) * 2; e.x += (e.hx - e.x) * 0.05; e.face = toward;
            // a hail-hawk drops hail on a hero passing underneath
            if (e.kind === 'hawk' && Math.abs(dx) < 40 && dy > 16 && e.t % 50 === 0) { this.shots.push({ id: this.nextId++, kind: 'ice', friendly: false, x: e.x, y: e.y, vx: 0, vy: 1.5, g: 0.12, life: 120, dmg: f.atk, r: 5, hits: [] }); this.sfx('hail', e.x, e.y); }
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
        case 'gust': {
          // a wind spirit: bobs about, drifts toward the heroes and puffs a gust at them that shoves as it stings
          const near = dist < 160;
          e.hx += near ? clamp(dx, -0.25, 0.25) : 0; e.hy += near ? clamp(dy - 34, -0.15, 0.15) : 0;
          e.x = e.hx + Math.sin(e.t * 0.03) * 16; e.y = e.hy + Math.sin(e.t * 0.05) * 6; e.face = toward;
          if (e.st === 'idle' && dist < 150 && e.cd <= 0) { e.st = 'tell'; e.t = 0; }
          else if (e.st === 'tell' && e.t > 30) {
            e.st = 'strike'; e.t = 0; e.cd = 130;
            const d = Math.max(1, dist);
            this.shots.push({ id: this.nextId++, kind: 'puff', friendly: false, x: e.x, y: e.y - 8, vx: (dx / d) * 2.2, vy: ((dy - 12) / d) * 2.2, g: 0, life: 90, dmg: f.atk, r: 7, hits: [] });
            this.sfx('puff', e.x, e.y);
          } else if (e.st === 'strike' && e.t > 16) { e.st = 'idle'; e.t = 0; }
          break;
        }
        case 'clapper': {
          // hangs on a rope tied above its spot (its angle kept in tx): sways, then draws back and swings at a hero
          const len = 34, ax = e.hx, ay = e.hy - len;
          if (e.st === 'idle') {
            e.tx = 0.15 * Math.sin(e.t * 0.05);
            if (Math.abs(dx) < 70 && dy > -14 && dy < 70 && e.cd <= 0) { e.st = 'tell'; e.t = 0; e.face = toward; this.sfx('creak', e.x, e.y); }
          } else if (e.st === 'tell') {
            e.tx += (-0.9 * e.face - e.tx) * 0.15;
            if (e.t > 26) { e.st = 'strike'; e.t = 0; this.sfx('swoosh', e.x, e.y); }
          } else if (e.st === 'strike') {
            e.tx = -0.9 * e.face + 1.9 * e.face * Math.min(1, e.t / 14);
            if (e.t > 34) { e.st = 'idle'; e.t = 0; e.cd = 70; }
          }
          e.x = ax + Math.sin(e.tx) * len; e.y = ay + Math.cos(e.tx) * len;
          break;
        }
        case 'clay-beetle':
        case 'beetle': {
          // a wind-up bell-beetle: trundles back and forth, then rolls at a hero in its bell
          if (e.st === 'idle') {
            const blocked = this.ledgeAhead(e, e.face) || this.foeEnv({ ...e, vx: e.face * 2, y: e.y - 1 } as Enemy, 0);
            if (blocked) e.face = (-e.face) as 1 | -1;
            e.vx = e.face * 0.45;
            if (Math.abs(dx) < 130 && Math.abs(dy) < 24 && e.cd <= 0 && e.ground) { e.st = 'tell'; e.t = 0; e.face = toward; e.vx = 0; this.sfx('wind', e.x, e.y); }
          } else if (e.st === 'tell') {
            e.vx = 0;
            if (e.t > 28) { e.st = 'lunge'; e.t = 0; }
          } else if (e.st === 'lunge') {
            e.vx = e.face * 2.4;
            if (e.t > 50 || this.ledgeAhead(e, e.face)) { e.st = 'idle'; e.t = 0; e.cd = 90; e.vx = 0; }
          }
          if (this.foeEnv(e, 0) && e.st === 'lunge') { e.st = 'idle'; e.t = 0; e.cd = 90; this.sfx('clang', e.x, e.y); }
          break;
        }
        // ─── the Foundry Below ───
        case 'ingot': {
          // an ingot on legs: plods along, then hops toward a hero and splashes bronze both ways where it lands
          if (e.st === 'idle') {
            if (this.ledgeAhead(e, e.face)) e.face = (-e.face) as 1 | -1;
            e.vx = e.face * 0.4;
            if (Math.abs(dx) < 110 && Math.abs(dy) < 40 && e.cd <= 0 && e.ground) { e.st = 'tell'; e.t = 0; e.face = toward; e.vx = 0; this.sfx('clank', e.x, e.y); }
          } else if (e.st === 'tell') { e.vx = 0; if (e.t > 26) { e.st = 'hop'; e.t = 0; e.vy = -4.4; e.vx = e.face * 1.4; this.sfx('hop', e.x, e.y); } }
          else if (e.st === 'hop') {
            if (!e.ground) e.vx = e.face * 1.4;
            else if (e.t > 4) {
              e.st = 'idle'; e.t = 0; e.cd = 100; e.vx = 0;
              for (const d of [-1, 1]) this.hostile('glob', e.x + d * 8, e.y - 6, d * 1.5, -2.6, 0.16, Math.round(f.atk * 0.8), 5, 90);
              this.sfx('splash', e.x, e.y);
            }
          }
          this.foeEnv(e, 0);
          break;
        }
        case 'ember': {
          // an ember wisp: drifts near its hearth, then spits a spread of sparks (each one that lands warms the heat gauge)
          const near = dist < 170;
          e.hx += near ? clamp(dx, -0.25, 0.25) : (e.tx - e.hx) * 0.01;
          e.hy += near ? clamp(dy - 50, -0.2, 0.2) : 0;
          e.x = e.hx + Math.sin(e.t * 0.05) * 14; e.y = e.hy + Math.sin(e.t * 0.08) * 6;
          e.face = toward;
          if (e.st === 'idle' && near && e.cd <= 0) { e.st = 'tell'; e.t = 0; this.sfx('fire', e.x, e.y); }
          else if (e.st === 'tell' && e.t > 30) {
            const a = Math.atan2(dy - 12, dx);
            for (const da of [-0.3, 0, 0.3]) this.hostile('spark', e.x, e.y - 6, Math.cos(a + da) * 2.2, Math.sin(a + da) * 2.2, 0, f.atk, 4, 120);
            e.st = 'idle'; e.t = 0; e.cd = 150;
          }
          break;
        }
        case 'cbat': {
          // a crystal bat: hangs from the roof until a hero passes under, then swoops down through them and back up
          if (e.st === 'idle') {
            e.x = e.hx; e.y = e.hy;
            if (Math.abs(dx) < 70 && dy > 0 && dy < 150 && e.cd <= 0) { e.st = 'tell'; e.t = 0; e.face = toward; this.sfx('squeak', e.x, e.y); }
          } else if (e.st === 'tell') { e.y = e.hy + Math.sin(e.t * 0.9) * 1.5; if (e.t > 24) { e.st = 'swoop'; e.t = 0; e.tx = b.x; e.ty = b.y - 8; } }
          else if (e.st === 'swoop') {
            // a dip: down to where the hero stood and up the far side
            const p = clamp(e.t / 60, 0, 1);
            e.x = e.hx + (e.tx - e.hx) * p * 2;
            e.y = e.hy + (e.ty - e.hy) * Math.sin(p * Math.PI);
            if (p >= 1) { e.st = 'back'; e.t = 0; }
          } else if (e.st === 'back') { e.x += (e.hx - e.x) * 0.05; e.y += (e.hy - e.y) * 0.05; if (e.t > 50) { e.st = 'idle'; e.t = 0; e.cd = 90; } }
          break;
        }
        case 'gsnail': {
          // a glass snail: slow, its shell shrugs off half a blow (a hammer slam shatters it), and now and then it flicks
          // a shard of glass along the floor
          if (e.st === 'idle') {
            if (this.ledgeAhead(e, e.face) || this.foeEnv({ ...e, vx: e.face * 2, y: e.y - 1 } as Enemy, 0)) e.face = (-e.face) as 1 | -1;
            e.vx = e.face * 0.25;
            if (Math.abs(dx) < 140 && Math.abs(dy) < 30 && e.cd <= 0) { e.st = 'tell'; e.t = 0; e.face = toward; e.vx = 0; }
          } else if (e.st === 'tell') { e.vx = 0; if (e.t > 30) { this.hostile('glass', e.x + e.face * 10, e.y - 6, e.face * 2.2, 0, 0, f.atk, 4, 80); this.sfx('shatter', e.x, e.y); e.st = 'idle'; e.t = 0; e.cd = 140; } }
          this.foeEnv(e, 0);
          break;
        }
        case 'brine-skater':
        case 'thorn-hare':
        case 'salt-hare':
        case 'pack-tick':
        case 'root-mite':
        case 'crust-crawler': {
          const kind = e.kind;
          if (e.st === 'idle') {
            if (kind === 'pack-tick') {
              e.x = e.hx; e.y = e.hy; e.vx = 0; e.vy = 0;
            } else {
              if (this.ledgeAhead(e, e.face)) e.face = e.face === 1 ? -1 : 1;
              e.vx = e.face * (kind === 'brine-skater' ? 0.85 : 0.38);
              if (this.foeEnv(e, 0)) e.face = e.face === 1 ? -1 : 1;
            }
            if (Math.abs(dx) < (kind === 'pack-tick' ? 56 : 92) && Math.abs(dy) < 115 && e.cd <= 0) {
              e.st = 'tell'; e.t = 0; e.face = toward; e.vx = 0;
            }
          } else if (e.st === 'tell' && e.t > (this.helping() ? 37 : 26)) {
            e.st = 'strike'; e.t = 0;
            e.vx = e.face * (kind === 'brine-skater' ? 4.4 : kind === 'crust-crawler' ? 3.1 : 1.5);
            e.vy = kind === 'salt-hare' ? -2.7 : 0;
            if (kind === 'salt-hare') this.hostile('shard', e.x + e.face * 10, e.y - 10, e.face * 2.4, -1.8, 0.12, f.atk, 4, 78);
          } else if (e.st === 'strike') {
            if (this.foeEnv(e, 0) || e.t > 38) { e.st = kind === 'pack-tick' ? 'back' : 'idle'; e.t = 0; e.cd = 105; }
          } else if (e.st === 'back') {
            e.x += (e.hx - e.x) * 0.12; e.y += (e.hy - e.y) * 0.12;
            if (e.t > 36) { e.st = 'idle'; e.cd = 100; e.t = 0; }
          }
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
      if (s.friendly && s.kind === 'hail') { const q = channelAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)); if (q && !this.frozen.has(q.id)) this.chill(q); }
      if (s.kind !== 'bubble' && s.kind !== 'bell' && s.kind !== 'lily' && this.solidTile(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) { s.life = 0; this.emit({ k: 'hit', x: s.x, y: s.y, big: false, color: s.friendly ? '#ffd27a' : '#8a6a4a' }); continue; }
      if ((s.kind === 'bell' || s.kind === 'lily') && this.solidTile(Math.floor(s.x / TILE), Math.floor((s.y + s.r) / TILE))) { s.life = 0; this.emit({ k: 'hit', x: s.x, y: s.y, big: true, color: '#e8c070' }); this.sfx('clang', s.x, s.y); continue; }
      const sr = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.friendly && s.kind === 'gale') {
        // the Gale Wave rolls on through everything it hits, once each, and rings the wind bells it passes
        for (const e of this.enemies) if (e.alive && !e.hidden && !s.hits.includes(e.id) && overlap(sr, this.foeRect(e))) { s.hits.push(e.id); this.damageFoe(e, s.dmg, Math.sign(s.vx) || 1, true, true); e.vx += Math.sign(s.vx) * 4; e.stun = 40; }
        if (this.boss && !this.boss.calm && !s.hits.includes(-1)) for (const h of this.boss.hurt) if (overlap(sr, h)) { s.hits.push(-1); this.damageBoss(s.dmg, s.x, s.y, true, h, s.kind); break; }
        for (const t of INFO.get(this.room.id)!.things) if (t.ch === 'W' && !s.hits.includes(-3000 - t.i) && overlap(sr, { x: t.c * TILE, y: t.r * TILE - 8, w: TILE, h: TILE + 8 })) { s.hits.push(-3000 - t.i); this.ringWind(t); }
      } else if (s.friendly) {
        for (const e of this.enemies) if (e.alive && !e.hidden && !s.hits.includes(e.id) && overlap(sr, this.foeRect(e))) { s.hits.push(e.id); this.damageFoe(e, s.dmg, Math.sign(s.vx) || 1, false, s.kind === 'bolt' || s.kind === 'hail'); s.life = 0; break; }
        if (s.life > 0 && this.boss && !this.boss.calm) for (const h of this.boss.hurt) if (overlap(sr, h)) { this.damageBoss(s.dmg, s.x, s.y, s.kind === 'bolt' || s.kind === 'hail', h, s.kind); s.life = 0; break; }
        if (s.life > 0) for (const t of INFO.get(this.room.id)!.things) if ((t.ch === 'B' || t.ch === 'W') && overlap(sr, { x: t.c * TILE, y: t.r * TILE - 8, w: TILE, h: TILE + 8 })) { if (t.ch === 'B') this.ringBell(this.room.area, t.c * TILE + 8, t.r * TILE); else this.ringWind(t); s.life = 0; break; }
      } else {
        if (overlap(sr, this.shrink(me, 2))) { if (s.kind === 'puff') this.body.vx += Math.sign(s.vx) * 3; if (this.hurtLead(s.dmg, s.x)) s.life = 0; }
        // the hero's swing pops bubbles and knocks shots away
        const box = this.attackBox();
        if (box && (s.kind === 'bubble' || s.kind === 'mud' || s.kind === 'seed' || s.kind === 'paint' || s.kind === 'puff' || s.kind === 'ice' || s.kind === 'sour') && overlap(box.r, sr)) { s.life = 0; this.emit({ k: 'hit', x: s.x, y: s.y, big: false }); this.sfx('pop', s.x, s.y); }
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
        if (this.boss && !this.boss.calm && (em.hits.get(-1) ?? -99) <= em.t - 12) for (const h of this.boss.hurt) if (overlap(er, h)) { em.hits.set(-1, em.t); this.damageBoss(Math.round(this.magic() * 0.7), ex, ey, true, h); break; }
      }
      if (em.t > 70) this.embers = null;
    }
  }

  updateRings() {
    const me = this.leadRect(), b = this.body;
    for (const g of this.rings) {
      g.r += g.vr;
      if (g.friendly) {
        this.slamming = g.kind === 'slam';
        for (const e of this.enemies) {
          if (!e.alive || e.hidden || g.hit.includes(e.id)) continue;
          if (Math.hypot(e.x - g.x, e.y - FOES[e.kind].h / 2 - g.y) < g.r) { g.hit.push(e.id); this.damageFoe(e, g.dmg, e.x > g.x ? 1 : -1, false, true); e.stun = 60; }
        }
        this.slamming = false;
        if (this.boss && !this.boss.calm && !g.hit.includes(-1)) for (const h of this.boss.hurt) {
          const cx = clamp(g.x, h.x, h.x + h.w), cy = clamp(g.y, h.y, h.y + h.h);
          if (Math.hypot(cx - g.x, cy - g.y) < g.r) { g.hit.push(-1); this.damageBoss(g.dmg, cx, cy, g.kind !== 'slam', h, g.kind); break; }
        }
        for (const t of INFO.get(this.room.id)!.things) {
          if (!(g.kind === 'slam' ? 'BWh' : 'BWQ*!').includes(t.ch) || g.rung.includes(`${t.ch}${t.i}`)) continue;
          if (Math.hypot(t.c * TILE + 8 - g.x, t.r * TILE - g.y) >= g.r) continue;
          g.rung.push(`${t.ch}${t.i}`);
          if (t.ch === 'B') this.ringBell(this.room.area, t.c * TILE + 8, t.r * TILE);
          else if (t.ch === 'W') this.ringWind(t);
          else if (t.ch === 'h') { this.sfx('bell', t.c * TILE + 8, t.r * TILE); this.emit({ k: 'bell', x: t.c * TILE + 8, y: t.r * TILE }); }
          else if (t.ch === '*') this.ringCrystal(t);
          else if (t.ch === '!') this.ringPrism(t);
          else this.ringEcho(t);
        }
        for (const d of INFO.get(this.room.id)!.doors) {
          if (d.ch !== 'c' || g.kind !== 'chime' || this.doorOpen(d) || g.rung.includes(d.id)) continue;
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

  damageBoss(dmg: number, x: number, y: number, spell = false, h?: Rect, src?: string) {
    const b = this.boss!;
    if (b.calm || b.st === 'wait' || b.st === 'intro' || b.vis < 0.5) return;
    const part = (h as (Rect & { part?: number }) | undefined)?.part;
    if (this.glacier && (b.st !== 'glacierOpen' || this.lead !== 'dora' || spell)) {
      this.sfx('clank', x, y); return;
    }
    if (b.id === 'founder') {
      // the Molten Founder: Enzo's frost leaves a cold spot where it lands; only there does a blade bite (and hard).
      // Other spells only singe it. With Enzo knocked out, every hit counts, so the fight can't stall
      const spots = (b.spots ??= []);
      const frosty = src === 'hail' || src === 'ice';
      if (frosty) { spots.push({ dx: x - b.x, dy: y - b.y, t: this.helping() ? 480 : 300 }); if (spots.length > 4) spots.shift(); this.sfx('freeze', x, y); dmg *= 0.5; }
      else if (!this.save.heroes.enzo.down) {
        const near = spots.some((p) => Math.hypot(b.x + p.dx - x, b.y + p.dy - y) < (this.helping() ? 30 : 20));
        if (spell) dmg *= 0.3;
        else if (near) dmg *= 1.6;
        else {
          this.emit({ k: 'hit', x, y, big: false, color: '#ffb070' }); this.sfx('clank', x, y);
          this.note(spots.length ? 'Hit the frosted patch! Only there does the bronze crack.' : 'Too hot to dent! Enzo’s Frost Fan can cool a patch of it.');
          return;
        }
      }
    }
    if (b.id === 'choir') {
      // the Glass Choir: while it listens, ring its notes back in the order it sang them (strike the singers); the whole
      // song stuns it. Out of turn, or while it sings, it only rings sour
      if (b.st === 'stun') dmg *= 1.5;
      else if (b.st === 'listen' && part !== undefined && b.song) {
        if (part === b.song[b.sung ?? 0]) {
          b.sung = (b.sung ?? 0) + 1;
          this.sfx(`note${part}`, x, y); this.emit({ k: 'notes', x, y });
          dmg = b.max * 0.04;
          if (b.sung >= b.song.length) { dmg = b.max * 0.12; this.go('stun', this.helping() ? 300 : 220); this.note('The choir falls silent, dazed. Strike now!', true); this.emit({ k: 'shake', n: 6 }); }
        } else {
          this.sfx('sour', x, y); b.sung = 0;
          this.note(this.helping() ? 'Out of turn! Follow the numbers over the singers: start again.' : 'A sour chord! Start the song again.');
          if (!this.helping()) this.rings.push({ x: b.heads[part]?.x ?? x, y: (b.heads[part]?.y ?? y) - 30, r: 6, vr: 2.4, max: 70, thick: 8, dmg: BOSSES.choir.atk, friendly: false, kind: 'imp', hit: [], rung: [] });
          return;
        }
      } else { this.emit({ k: 'hit', x, y, big: false, color: '#d8b8ff' }); this.sfx('clank', x, y); return; }
    }
    if (b.id === 'hollow') {
      // the Hollow Bell: its shell shrugs off blows (a slam on its crown rings it hard); once its molten heart is out, a
      // Resonance chime stuns it, and stunned it takes double
      if (b.form === 1) {
        if (src === 'slam' && y < b.body.y + b.body.h * 0.45) { dmg *= 2.2; this.sfx('toll', x, y); this.emit({ k: 'shake', n: 8 }); }
        else { dmg *= 0.6; if (!this.flag('hollow:tip')) { this.setFlag('hollow:tip'); this.note('The shell is thick. Slam its crown from above: jump high, then ↓ + attack as Dora.', true); } }
      }
      if (b.form === 2 && src === 'chime' && this.has('resonance') && b.st !== 'stun') { this.go('stun', this.helping() ? 260 : 180); this.note('The chime holds it still. Now!', true); this.sfx('crystal', x, y); }
      if (b.st === 'stun') dmg *= 2;
    }
    if (b.id === 'clappers' && part !== undefined) {
      // each clapper gives only to one hero: the iron to Dora, the glass to Enzo (his staff or his spells)
      const head = b.heads[part];
      if (!head || (head.hp ?? 0) <= 0) return;
      // (with the hero it answers to knocked out, it gives to the other one's blows too, so the fight can't stall)
      const alone = this.save.heroes[part === 0 ? 'dora' : 'enzo'].down;
      if (!alone && this.lead !== (part === 0 ? 'dora' : 'enzo')) {
        this.emit({ k: 'hit', x, y, big: false, color: '#9aa4b0' }); this.sfx('clank', x, y);
        this.note(part === 0 ? 'Clank! Only Dora can dent the Iron Clapper. Tag over!' : 'Tink! Only Enzo can crack the Glass Clapper. Tag over!');
        return;
      }
      head.hp = Math.max(0, (head.hp ?? 0) - dmg);
      if (head.hp <= 0) { head.st = 'calm'; head.t = 0; this.note(part === 0 ? 'The Iron Clapper hangs still. Now the glass one!' : 'The Glass Clapper hangs still. Now the iron one!', true); this.sfx('calm'); }
      b.hp = b.heads.reduce((a, hh) => a + (hh.hp ?? 0), 0) + dmg;
    }
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
      // (the frog's, the clappers' and the bell's doors are on the east: the fight starts a few steps inside)
      const fromEast = this.room.id === 'idol' || this.room.id === 'clapperloft' || this.room.id === 'belltop' || this.room.id === 'choir' || b.id === 'panback' || b.id === 'glass-vicuna';
      // and never while a hero is still climbing up under a boss door that would shut over them (the condor bridge's
      // hatch from the bannerwalk)
      const under = INFO.get(this.room.id)!.doors.some((d) => d.ch === 'b' && this.body.x >= d.c * TILE && this.body.x <= (d.c + d.w) * TILE && this.body.y > d.r * TILE + 2);
      const inside = !under && (!this.glacier || this.body.ground && !this.body.climb) && (fromEast ? this.body.x < rr.x + rr.w - 4 * TILE : this.body.x > rr.x + 3 * TILE);
      if (inside) {
        this.bossEntry = { x: this.body.x, y: this.body.y };
        b.st = 'intro'; b.t = 0; b.dur = 90;
        this.emit({ k: 'boss', id: b.id });
        if (!this.flag(`script:boss:${b.id}`)) { this.setFlag(`script:boss:${b.id}`); this.say(SCRIPTS[b.id] ?? []); }
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
    else if (b.id === 'condor') this.bossCondor(b);
    else if (b.id === 'clappers') this.bossClappers(b);
    else if (b.id === 'tune') this.bossTune(b);
    else if (b.id === 'founder') this.bossFounder(b);
    else if (b.id === 'choir') this.bossChoir(b);
    else if (b.id === 'hollow') this.bossHollow(b);
    else if (b.id === 'weighmaster' || b.id === 'panback' || b.id === 'tollkeeper') this.updateSaltGuardian(b);
    else if (isOrchardRoom(this.room)) this.updateOrchardGuardian(b);
    else if (this.glacier) this.updateGlacierGuardian(b);
    else this.bossMother(b);
    for (const h of b.harm) if (overlap(me, this.shrink(h, 2))) { this.hurtLead(BOSSES[b.id].atk, h.x + h.w / 2); break; }
    // falling things marked on the floor
    for (const m of this.markers) m.t -= this.bossSpeed;
    this.markers = this.markers.filter((m) => {
      if (m.t > 0) return true;
      if (m.kind === 'aim' || m.kind === 'shadow' || m.kind === 'swirl' || m.kind === 'flood') return false;
      this.shots.push({ id: this.nextId++, kind: m.kind as 'bell' | 'lily' | 'seed' | 'drop' | 'blank', friendly: false, x: m.x, y: this.bossRoomRect().y + 40, vx: 0, vy: 2, g: 0.18 * this.bossSpeed, life: 200, dmg: BOSSES[b.id].atk, r: 8, hits: [] });
      return false;
    });
  }

  bossDone() {
    const b = this.boss!;
    if (this.trial?.def.kind === 'rush') { this.rushCalm(b); return; }
    this.setFlag(`boss:${b.id}`);
    if ((GUARDIANS as readonly string[]).includes(b.id)) {
      // one of the throne door's bell seals goes quiet
      const n = this.sealsOpen();
      this.note(`The ${AREAS[GUARDIAN_AREA[b.id as (typeof GUARDIANS)[number]]].name} bell is quiet. ${n} of 4 seals open.`, true);
      this.sfx('chime');
      this.emit({ k: 'seal', id: b.id, n });
    }
    if ((FOUNDRY_GUARDIANS as readonly string[]).includes(b.id)) {
      const n = FOUNDRY_GUARDIANS.filter((g) => this.flag(`boss:${g}`)).length;
      this.note(n === 2 ? 'Both foundry bells are quiet: the deep seal is open.' : `${BOSSES[b.id].name} is calm. 1 of 2 deep seals quiet.`, true);
      this.sfx('chime');
    }
    if ((BELFRY_GUARDIANS as readonly string[]).includes(b.id)) {
      const n = BELFRY_GUARDIANS.filter((g) => this.flag(`boss:${g}`)).length;
      this.note(n === 2 ? 'Both belfry bells are quiet: the belfry seal is open.' : `${BOSSES[b.id].name} is calm. 1 of 2 belfry seals quiet.`, true);
      this.sfx('chime');
    }
    this.gainXp(BOSSES[b.id].xp);
    for (const r of BOSSES[b.id].reward) this.grant(r, b.x, b.y - 30);
    for (const h of ALL_HEROES) { const s = this.save.heroes[h], st = this.stats(h); s.down = false; s.hp = st.maxHp; s.mp = st.maxMp; }
    this.boss = null; this.bossEntry = null; this.arenaWater = null;
    const done = SCRIPTS[`${b.id}Done`] ?? [];
    if (b.id === 'mother') {
      this.save.water.throne = 1;
      this.say(done, () => this.finish());
    } else if (b.id === 'tune') this.say(done, () => this.finishBelfry());
    else if (b.id === 'hollow') this.say(done, () => this.finishFoundry());
    else if (b.id === 'tollkeeper') this.say([
      { who: 'sign', text: 'The toll gate swings open. By dawn the salt caravans have a road again.' },
      { who: 'suma', text: 'Listen! Pack bells, all the way down the steps. I’m going to need a longer tally cord.' },
      { who: 'enzo', text: 'Those bells are from the mules, Dora. Hundreds of them.' },
      { who: 'dora', text: 'And something by the Tollhouse just clicked open. A little wicket, on the east side.' },
    ], () => this.finishArea('salt'));
    else if (b.id === 'graft-mother') this.say([
      { who: 'enzo', text: 'Look at the branches, Dora. All the way up the hill.' },
      { who: 'killa', text: 'Every lamp in the orchard is lit. I haven’t seen that since I was small.' },
      { who: 'dora', text: 'Will the grafts keep, now?' },
      { who: 'killa', text: 'They’ll keep. And hear that creaking? The root lift up there has woken. It climbs past the snowline.' },
      { who: 'sign', text: 'At dawn Killa carried the first basket down to the caravan road.' },
    ], () => this.finishArea('orchard'));
    else if (b.id === 'sun-gate') this.say([
      { who: 'phuyu', text: 'Look down. You can see the first carts coming up from the orchard.' },
      { who: 'enzo', text: 'The whole pass is in the sun.' },
      { who: 'dora', text: 'I bet Suma is counting every one of them.' },
      { who: 'phuyu', text: 'Then come back to camp. There’s tea, and a long way down tomorrow.' },
    ], () => this.finishArea('glacier'));
    else this.say(done, () => this.emit({ k: 'save' }));
    this.planks.clear(); this.arenaWind = { dir: 1, str: 1 }; this.notes = this.notes.filter((nn) => !nn.key.startsWith('tune:'));
  }

  /** The story's end: the ending screen, with the epilogue when everything has been found (once earned, the
   *  'epilogue' flag keeps it). Saved first. */
  finish() {
    const full = this.completion().base.pct >= 100;
    this.ended = true; this.setFlag('ending');
    if (full) this.setFlag('epilogue');
    this.emit({ k: 'save' });
    this.emit({ k: 'ending', full });
  }
  /** After the Lake Mother, the moment the last thing is found: a word from the heroes, then the epilogue. Once. */
  checkEpilogue() {
    if (this.ended || this.dialog || this.boss || !this.flag('boss:mother')) return;
    // an expansion's epilogue, once its ending has played and the last thing in it is found
    for (const [area, lines] of EXPANSION_FOUND) {
      if (!this.flag(`${area}:ending`) || this.flag(`${area}:epilogue`) || this.completion()[area].pct < 100) continue;
      this.setFlag(`${area}:epilogue`);
      this.emit({ k: 'save' });
      this.say(lines, () => this.finishArea(area));
      return;
    }
    // once the belfry is in tune too, the second epilogue when every last thing (citadel and belfry) is found; it
    // stands for the first as well when both are earned at once
    // once the Hollow Bell is calm, the third epilogue when every last thing (the Foundry Below too) is found
    if (this.flag('boss:hollow') && !this.flag('epilogue3') && this.completion().pct >= 100) {
      this.setFlag('epilogue'); this.setFlag('epilogue2'); this.setFlag('epilogue3');
      this.emit({ k: 'save' });
      this.say([
        { who: 'dora', text: 'Enzo, that’s the lot. Citadel, belfry, foundry. Every chest, every mural, every bell.' },
        { who: 'enzo', text: 'Then the forge can go quiet. Tupa said there’d be a new bell to hear tonight.' },
      ], () => this.finishFoundry());
      return;
    }
    if (this.flag('boss:tune') && !this.flag('epilogue2') && this.completion().belfry.pct >= 100) {
      this.setFlag('epilogue'); this.setFlag('epilogue2');
      this.emit({ k: 'save' });
      this.say([
        { who: 'enzo', text: 'Dora, that’s all of it. The citadel and the belfry, every chest and every mural.' },
        { who: 'dora', text: 'Then I know where everybody’s going to be tonight. Listen: both belfries.' },
      ], () => this.finishBelfry());
      return;
    }
    if (this.flag('epilogue')) return;
    if (this.completion().base.pct < 100) return;
    this.setFlag('epilogue');
    this.emit({ k: 'save' });
    this.say([
      { who: 'dora', text: 'That’s everything, Enzo. Every chest, every mural, every bell.' },
      { who: 'enzo', text: 'Then let’s go up to the shore. I think someone’s planned a picnic.' },
    ], () => this.finish());
  }

  /** Once an area's last guardian is calm and the game is back in play: the unlock dialog, naming the door that
   *  opened and where it is. Once per door (the 'unlock:<id>' flag keeps it); a door already used never asks. */
  checkUnlock() {
    if (this.ended || this.dialog || this.boss || this.trial) return;
    for (const u of UNLOCKS) {
      if (!this.flag(`boss:${u.after}`) || this.flag(`unlock:${u.id}`)) continue;
      this.setFlag(`unlock:${u.id}`);
      if (this.flag(u.visited)) continue;
      this.emit({ k: 'save' });
      this.emit({ k: 'unlock', id: u.id });
      return;
    }
  }
  /** The expansion doors that are open but not used yet: each has a marker on the maps until the heroes go through. */
  newDoors(): (Unlock & { x: number; y: number })[] {
    return UNLOCKS.filter((u) => this.flag(`boss:${u.after}`) && !this.flag(u.visited)).map((u) => {
      const t = INFO.get(u.room)!.things.find((th) => th.ch === u.ch)!;
      return { ...u, x: t.c * TILE + 8, y: t.r * TILE };
    });
  }
  /** One line for the title's save card: the open door not used yet, or else the next thing the story wants. */
  nextLine(): string | null {
    const doors = this.newDoors();
    if (doors.length) {
      const [d, ...more] = doors;
      return `${d.area} is open: ${d.door} ${d.at}${more.map((m) => `. ${m.area} is open too`).join('')}`;
    }
    const goal = this.nextGoal();
    if (!goal) return null;
    const t = INFO.get(goal.room)?.things.find((th) => th.c * TILE + 8 === goal.x && th.r * TILE === goal.y);
    const room = roomById(goal.room), named = GLACIER_NAMES[room.id] ?? SHRINE_NAMES[room.id];
    const the = (n: string) => n.replace(/^The /, 'the ');
    const place = named ? the(named) : `the ${AREAS[room.area].name.replace(/^The /, '')}`;
    if (!t) return `Head for ${place}`;
    if (t.ch === 'A' && room.ability) return `Find ${ABILITIES[room.ability].name} in ${place}`;
    if (t.ch === 'O' && room.boss) return `Calm ${the(BOSSES[room.boss].name)}`;
    if (t.ch === 'C') return `Open the chest in ${place}`;
    if (t.ch === 'U') return 'Talk to Ukumari';
    const door = UNLOCKS.find((u) => u.room === room.id && u.ch === t.ch);
    if (door) return `Go through ${door.door} to ${door.area}`;
    return `Head for ${place}`;
  }

  /** An expansion's end (the Salt Road, the Night Orchard, the Glacier Stair): its ending page, with its epilogue
   *  when everything in that area has been found (its '<area>:epilogue' flag keeps it). Saved first. */
  finishArea(area: 'salt' | 'orchard' | 'glacier') {
    const full = this.completion()[area].pct >= 100;
    this.setFlag(`${area}:ending`); this.ended = true;
    if (full) this.setFlag(`${area}:epilogue`);
    this.emit({ k: 'save' });
    this.emit({ k: 'ending', full, [area]: true });
  }

  /** The Windward Belfry's end: the Out-of-Tune Bell in tune again. The second epilogue follows when everything,
   *  citadel and belfry, has been found ('epilogue2' keeps it). Saved first. */
  finishBelfry() {
    const full = this.completion().belfry.pct >= 100;
    this.ended = true; this.setFlag('ending'); this.setFlag('belfry:ending');
    if (full) this.setFlag('epilogue2');
    this.emit({ k: 'save' });
    this.emit({ k: 'ending', full, belfry: true });
  }
  /** The Foundry Below's end: the Hollow Bell recast, whole and in tune. The third epilogue follows when everything,
   *  the foundry too, has been found ('epilogue3' keeps it). Saved first. */
  finishFoundry() {
    const full = this.completion().pct >= 100;
    this.ended = true; this.setFlag('ending'); this.setFlag('foundry:ending');
    if (full) this.setFlag('epilogue3');
    this.emit({ k: 'save' });
    this.emit({ k: 'ending', full, foundry: true });
  }

  bossFrog(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body, sp = this.bossSpeed;
    const W = 64, H = 50;
    if (b.st !== 'hop' && !b.st.startsWith('flop')) b.face = lead.x > b.x ? 1 : -1;
    const body: Rect = { x: b.x - W / 2, y: b.y - H, w: W, h: H };
    // hit where it is painted (the scene draws it from (x, y + 2)); its body still moves it
    b.hurt.push(bossArtBox(b, 'boss-frog', b.x, b.y + 2, b.face > 0, 0.85)); b.body = body;
    const ngp = this.save.ngp ? ['flop'] : [];
    const cycle = b.phase === 1 ? ['hop', ...ngp, 'spit', 'hop', 'spit'] : b.phase === 2 ? ['hop', 'tongue', 'spit', ...ngp, 'hop'] : ['hop', 'spit', 'tongue', ...ngp, 'hop', 'tongue'];
    switch (b.st) {
      case 'intro': if (b.t > 60) this.go('idle', 50); break;
      // New Game+: the belly flop. A deep squat, a leap clean out of sight, its shadow following the lead, then a
      // crash down on the shadow that sends a wave both ways (and a moment winded after)
      case 'flopTell': if (b.t > b.dur) { b.sx = b.x; this.go('flopUp', 26); this.sfx('hop', b.x, b.y); } break;
      case 'flopUp': {
        const p = clamp(b.t / 26, 0, 1);
        b.y = floor - p * p * 300;
        if (p >= 1) { this.markers.push({ x: clamp(lead.x, rr.x + 50, rr.x + rr.w - 60), y: floor, t: 64, kind: 'shadow' }); this.go('flopAim', 64); }
        break;
      }
      case 'flopAim': {
        // the shadow creeps after the lead for most of a second, then holds still (that's the moment to move)
        const m = this.markers.find((k) => k.kind === 'shadow');
        if (m && b.t < 40) m.x += clamp(clamp(lead.x, rr.x + 50, rr.x + rr.w - 60) - m.x, -1.6 * sp, 1.6 * sp);
        if (m) b.x = m.x;
        if (b.t > b.dur) { this.go('flopDown', 14); this.markers = this.markers.filter((k) => k.kind !== 'shadow'); }
        break;
      }
      case 'flopDown': {
        const p = clamp(b.t / 14, 0, 1);
        b.y = floor - 300 * (1 - p * p);
        b.harm.push(bossArtBox(b, 'boss-frog', b.x, b.y + 2, b.face > 0, 0.7));
        if (p >= 1) {
          b.y = floor; this.emit({ k: 'shake', n: 12 }); this.sfx('quake', b.x, b.y);
          for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 34, y: floor, dir: d, speed: 2.6 * sp, life: 110, h: 12, dmg: BOSSES.frog.atk });
          this.go('flopLand', 56);
        }
        break;
      }
      case 'flopLand': if (b.t > b.dur) this.go('idle', 30); break;
      case 'idle': if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; this.go(`${nx}Tell`, nx === 'hop' ? 40 : nx === 'flop' ? 48 : 38, true); } break;
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
      // (New Game+: rearing back for the seed rain, all three heads up and shaking)
      const rear = b.st === 'rainTell' || b.st === 'rain';
      if (h.st === 'idle' && rear) { h.x += (h.bx - 10 + (this.tick % 4 < 2 ? 2 : -2) - h.x) * 0.15; h.y += (h.by - 44 - h.y) * 0.12; }
      else if (h.st === 'idle') { h.x += (h.bx + sway - h.x) * 0.1; h.y += (h.by - h.y) * 0.1; }
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
        // (the rain waits for every head to come back first)
        if (this.save.ngp && b.step % 4 === 2 && free.length < 3) { this.go('idle', 10); break; }
        if (this.save.ngp && b.step % 4 === 2) {
          // New Game+: the seed rain. Every head rears and spits high; seeds come down all over the pool but for one
          // gap, marked by where no seed is
          const rr = this.bossRoomRect(), x0 = rr.x + 2 * TILE + 20, x1 = rr.x + rr.w - 2 * TILE - 20, n = Math.floor((x1 - x0) / 38);
          const gap = 1 + Math.floor(this.rand() * (n - 3));
          for (let i = 0; i <= n; i++) if (i !== gap && i !== gap + 1) this.markers.push({ x: x0 + i * 38, y: this.floorY(), t: 50 * this.tellMul + 40, kind: 'seed' });
          this.go('rainTell', 50, true);
        } else if (b.phase === 3 && free.length === 3 && b.step % 2 === 1) {
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
      case 'rainTell': if (b.t > b.dur) { this.go('rain', 40); this.sfx('spit', b.x, b.y - 100); } break;
      case 'rain': if (b.t > b.dur) this.go('idle', 70); break;
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
          const ngp = this.save.ngp ? ['twin'] : [];
          const opts = b.phase === 1 ? ['pounce', ...ngp, 'dash'] : b.phase === 2 ? ['pounce', 'mural', ...ngp, 'dash'] : ['pounce', 'mural', 'pounce', ...ngp, 'dash'];
          const nx = opts[b.step++ % opts.length];
          if (nx === 'twin') { b.side = b.x > rr.x + rr.w / 2 ? 1 : -1; this.go('twinTell', 54, true); }
          else if (nx === 'mural') { b.side = lead.x > rr.x + rr.w / 2 ? -1 : 1; this.go('muralTell', 56, true); }
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
      // New Game+: the painted twin. The puma rears and paints a copy of itself on the far wall; both charge at once
      // from either side (the twin a beat later), so the heroes jump one and then the other
      case 'twinTell': {
        b.face = (-b.side) as 1 | -1;
        b.x = clamp(b.x + b.side * 0.8 * sp, left, right);
        b.arms[0] = { x: b.side > 0 ? left : right, y: floor };
        if (b.t > b.dur) { this.go('twin', 220); this.sfx('roar', b.x, b.y); }
        break;
      }
      case 'twin': {
        b.x += b.face * 4.6 * sp;
        b.harm.push(bossArtBox(b, 'boss-puma', b.x, b.y + 2, b.face > 0, 0.62));
        const tw = b.arms[0];
        if (tw && b.t > 22) {
          tw.x -= b.face * 4.6 * sp;
          b.harm.push(bossArtBox(b, 'boss-puma', tw.x, floor + 2, b.face < 0, 0.62));
          if (tw.x <= left || tw.x >= right) b.arms = [];
        }
        if (b.x <= left || b.x >= right) { b.x = clamp(b.x, left, right); if (!b.arms.length || b.t > 200) { b.arms = []; this.go('skid', 34); this.emit({ k: 'shake', n: 3 }); } }
        break;
      }
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
    const ngp = this.save.ngp ? ['chorus'] : [];
    const cycle = b.phase === 1 ? ['swing', 'toll', ...ngp, 'swing', 'bells'] : b.phase === 2 ? ['swing2', 'toll', ...ngp, 'bells', 'swing2', 'toll'] : ['swing2', 'toll', 'bells', ...ngp, 'toll', 'swing2'];
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
      // New Game+: the chorus. Both hand bells fly up over the heroes and come down one after the other where the
      // marks show, each ringing out a short wave of sound where it lands
      case 'chorusTell': case 'chorus': {
        const mk = (x: number, t: number) => { const mx = clamp(x, rr.x + 50, rr.x + rr.w - 50); this.markers.push({ x: mx, y: floor, t, kind: 'aim' }); return mx; };
        if (b.st === 'chorusTell' && b.t <= sp) { b.sx = mk(lead.x, b.dur + 14); b.sy = b.sx; }
        if (b.st === 'chorus' && b.t >= 26 && b.t < 26 + sp) b.sy = mk(lead.x, 28);
        for (let i = 0; i < 2; i++) {
          const x = i === 0 ? b.sx : b.sy, t0 = i === 0 ? 0 : 40;
          const a = b.arms[i], high = rr.y + 56 + i * 10;
          if (b.st === 'chorusTell' || b.t < t0) { a.x += ((i === 1 && b.st === 'chorus' && b.t > 26 ? b.sy : x + (i ? 60 : 0)) - a.x) * 0.12; a.y += (high + Math.sin(this.tick * 0.5 + i) * 3 - a.y) * 0.15; continue; }
          const p = clamp((b.t - t0) / 14, 0, 1);
          a.x = x; a.y = high + (floor - 13 - high) * p * p;
          if (p < 1) b.harm.push({ x: a.x - 14, y: a.y - 12, w: 28, h: 24 });
          if (b.t - t0 >= 14 && b.t - t0 < 14 + sp) {
            this.rings.push({ x: a.x, y: floor - 10, r: 6, vr: 2.4 * sp, max: 84, thick: 8, dmg: BOSSES.warden.atk, friendly: false, kind: 'imp', hit: [], rung: [] });
            this.sfx('toll', a.x, a.y); this.emit({ k: 'shake', n: 5 });
          }
        }
        if (b.st === 'chorusTell' && b.t > b.dur) this.go('chorus', 100);
        else if (b.st === 'chorus' && b.t > b.dur) this.go('hang', 60);
        break;
      }
      case 'bellsTell': {
        armsRest();
        // (the first step of a state: the timer has already moved on by one step)
        if (b.t <= sp) {
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

  // ─── the Windward Belfry's guardians ──────────────────────────────────────
  /** A falling or flying hostile shot. */
  hostile(kind: Shot['kind'], x: number, y: number, vx: number, vy: number, g: number, dmg: number, r = 6, life = 200) {
    this.shots.push({ id: this.nextId++, kind, friendly: false, x, y, vx, vy, g, life, dmg, r, hits: [] });
  }
  /** Break the bridge planks from column c0 to c1 (room columns) for a while. */
  breakPlanks(c0: number, c1: number, ticks: number) {
    const base = this.room.gx * COLS;
    for (let c = Math.max(8, c0); c <= Math.min(81, c1); c++) this.planks.set(base + c, ticks);
    this.sfx('crack'); this.emit({ k: 'shake', n: 6 });
    for (let c = c0; c <= c1; c += 2) this.hostile('plank', (base + c) * TILE + 8, this.room.gy * ROWS * TILE + 12 * TILE + 4, (this.rand() - 0.5) * 1.5, 0.5, 0.25, 0, 5, 60);
  }

  /** The Hail Condor: circles over its rope bridge, rains diagonal hail, dives at the heroes (breaking planks) and
   *  turns the wind with its wings. Phase 2 adds the gusts, phase 3 the storm and the bridge-breaker. */
  bossCondor(b: Boss) {
    const rr = this.bossRoomRect(), lead = this.body, sp = this.bossSpeed, atk = BOSSES.condor.atk;
    const bridge = rr.y + 12 * TILE, home = bridge - 92;
    // its body is where it is painted: the scene draws it with its talons at (x, y + 30), so perched to rest they grip
    // the bridge
    const body: Rect = bossArtBox(b, 'boss-condor', b.x, b.y + 30, b.face > 0, 0.7);
    b.body = body;
    const low = b.st === 'rest' || b.st === 'dive';
    b.hurt.push(Object.assign({ ...body }, { mul: b.st === 'rest' ? 1.4 : 1 }));
    if (b.st !== 'dive') b.face = lead.x > b.x ? 1 : -1;
    const cycle = b.phase === 1 ? ['hail', 'dive', 'hail', 'dive'] : b.phase === 2 ? ['hail', 'gust', 'dive', 'dive'] : ['storm', 'gust', 'break', 'dive', ...(this.save.ngp ? ['icicles'] : [])];
    // drifting to its next perch in the sky
    const drift = (tx: number, ty: number, k = 0.04) => { b.x += (tx - b.x) * k * sp; b.y += (ty - b.y) * k * sp; };
    switch (b.st) {
      case 'intro': drift(b.sx, home); if (b.t > 60) this.go('idle', 40); break;
      case 'idle': {
        drift(b.sx, home + Math.sin(this.tick * 0.05) * 8, 0.03);
        if (b.t > b.dur) {
          const nx = cycle[b.step++ % cycle.length];
          b.sx = clamp(lead.x + (this.rand() < 0.5 ? -1 : 1) * 110, rr.x + 120, rr.x + rr.w - 120);
          this.go(`${nx}Tell`, nx === 'dive' ? 34 : 40, true);
          if (nx === 'dive') { b.tx = clamp(lead.x, rr.x + 10 * TILE, rr.x + 80 * TILE); this.markers.push({ x: b.tx, y: bridge, t: 34 * this.tellMul, kind: 'aim' }); }
          if (nx === 'break') { b.ty = this.rand(); for (let k = 0; k < 3; k++) this.markers.push({ x: rr.x + (14 + Math.floor((b.ty * 3 + k) % 3) * 22 + k) * TILE, y: bridge, t: 40 * this.tellMul, kind: 'aim' }); }
        }
        break;
      }
      case 'hailTell': case 'stormTell': drift(b.x, home - 16); if (b.t > b.dur) { this.go(b.st === 'stormTell' ? 'storm' : 'hail', 100); this.sfx('hail', b.x, b.y); } break;
      case 'hail': case 'storm': {
        // hail falls in diagonal streaks, slanting with the wind
        const every = b.st === 'storm' ? 5 : 8;
        if (Math.floor(b.t) % every === 0 && Math.floor(b.t - sp) % every !== 0) this.hostile('ice', rr.x + 8 * TILE + this.rand() * 74 * TILE, rr.y + 2 * TILE, this.arenaWind.dir * 1.3 * sp, 2.4 * sp, 0.02, Math.round(atk * 0.6), 5);
        if (b.t > b.dur) this.go('idle', b.phase === 3 ? 34 : 48);
        break;
      }
      case 'diveTell': drift(b.x, home - 24, 0.08); if (b.t > b.dur) { b.sx = b.x; b.sy = b.y; this.go('dive', 44); this.sfx('caw', b.x, b.y); } break;
      case 'dive': {
        const p = clamp(b.t / 44, 0, 1);
        b.x = b.sx + (b.tx - b.sx) * p;
        b.y = b.sy + (bridge - 18 - b.sy) * Math.sin(Math.PI * Math.min(1, p * 1.25));
        b.harm.push(this.shrink(body, 6));
        if (p >= 0.4 && b.step >= 0 && b.phase >= 2 && b.ty !== -1) { b.ty = -1; const c = Math.floor((b.tx - rr.x) / TILE); this.breakPlanks(c - 2, c + 2, 220); }
        if (p >= 1) { b.ty = 0; this.go('rest', 46); }
        break;
      }
      case 'rest': drift(b.x, bridge - 30, 0.1); if (b.t > b.dur) this.go('idle', 30); break;
      case 'gustTell': drift(b.x, home); if (b.t > b.dur) {
        // its wings sweep: the wind on the bridge blows hard away from the condor
        this.arenaWind = { dir: lead.x > b.x ? 1 : -1, str: 2.2 };
        this.go('gust', 110); this.sfx('gale', b.x, b.y);
      } break;
      case 'gust': {
        drift(b.x, home);
        if (Math.floor(b.t) % 30 === 0 && Math.floor(b.t - sp) % 30 !== 0) this.hostile('puff', b.x, b.y - 10, this.arenaWind.dir * 2.6, 0.4, 0, Math.round(atk * 0.5), 8, 120);
        if (b.t > b.dur) { this.arenaWind = { dir: this.arenaWind.dir, str: 1 }; this.go('idle', 40); }
        break;
      }
      case 'breakTell': drift(b.x, home - 10); if (b.t > b.dur) {
        for (let k = 0; k < 3; k++) { const c = 14 + Math.floor((b.ty * 3 + k) % 3) * 22 + k; this.breakPlanks(c - 3, c + 3, 260); }
        this.go('idle', 60);
      } break;
      // New Game+: a row of icicles drops from the cliffs, marked first
      case 'icicles': case 'iciclesTell': if (b.st === 'iciclesTell' && b.t > b.dur) {
        for (let k = 0; k < 8; k++) this.markers.push({ x: rr.x + (12 + k * 9) * TILE, y: bridge, t: 30 + k * 6, kind: 'aim' });
        this.go('icicles', 90);
      } else if (b.st === 'icicles') {
        for (const m of this.markers) if (m.kind === 'aim' && m.t <= sp && m.t > 0) this.hostile('ice', m.x, rr.y + 2 * TILE, 0, 3, 0.1, atk, 6);
        if (b.t > b.dur) this.go('idle', 40);
      } break;
    }
    void low;
  }

  /** The Twin Clappers: two bell-tongues on ropes. The Iron Clapper only gives to Dora's blade, the Glass Clapper
   *  only to Enzo's spells, so the heroes tag between them. They take turns: a big swing across the loft, a slam
   *  into the floor (with shockwaves), and from phase 2 they clap together, ringing out a shock ring. */
  bossClappers(b: Boss) {
    const rr = this.bossRoomRect(), lead = this.body, sp = this.bossSpeed, atk = BOSSES.clappers.atk, floor = this.floorY();
    const alive = b.heads.map((h, i) => ((h.hp ?? 0) > 0 ? i : -1)).filter((i) => i >= 0);
    const angry = alive.length === 1;
    b.body = { x: rr.x + 18 * TILE, y: rr.y + 4 * TILE, w: 24 * TILE, h: 9 * TILE };
    for (const [i, h] of b.heads.entries()) {
      h.t += sp;
      const len = h.tx;
      const toward = lead.x > h.bx ? 1 : -1;
      switch (h.st) {
        case 'idle': h.ang! += (0.12 * Math.sin((this.tick + i * 60) * 0.05) - h.ang!) * 0.08 * sp; h.tx += (158 - h.tx) * 0.1; break;
        case 'calm': h.ang! *= 0.95; h.tx += (120 - h.tx) * 0.05; break;
        case 'swingTell': h.ang! += (-0.8 * h.ty - h.ang!) * 0.1 * sp; if (h.t > 36 * this.tellMul) { h.st = 'swing'; h.t = 0; this.sfx('swoosh', h.x, h.y); } break;
        case 'swing': {
          // from drawn back, right across the loft and back to rest, hauled up a little so it skims over a hero who
          // stays down (a jump meets it)
          h.tx += (140 - h.tx) * 0.25 * sp;
          const p = clamp(h.t / 46, 0, 1);
          h.ang = h.ty * (-0.8 + 1.9 * Math.sin(Math.PI * 0.5 * Math.min(1, p * 1.6))) * (1 - Math.max(0, p - 0.7) / 0.3 * 0.9);
          if (p >= 1) { h.st = 'idle'; h.t = 0; if (b.phase >= 3 && this.rand() < 0.8) this.clapperShots(h, i); } // (it throws after most swings, not all)
          break;
        }
        case 'slamTell': h.tx += (86 - h.tx) * 0.12 * sp; h.ang! *= 0.8; h.x += (lead.x - h.x) * 0.02; if (h.t > 30 * this.tellMul) { h.st = 'slam'; h.t = 0; } break;
        case 'slam': {
          h.tx = Math.min(floor - h.by - 22, h.tx + 7 * sp);
          if (h.tx >= floor - h.by - 22 && h.ty !== 9) {
            h.ty = 9; this.emit({ k: 'shake', n: 7 }); this.sfx('clang', h.x, floor);
            // in phase 3 waves roll out from a little way off (so a hero beside it sees them coming), with the thrown
            // shards and cogs
            if (this.boss!.phase >= 3) for (const d of [-1, 1] as const) this.waves.push({ x: h.x + d * 40, y: floor, dir: d, speed: 2 * sp, life: 90, h: 10, dmg: Math.round(atk * 0.8) });
          }
          if (h.t > 40) { h.st = 'idle'; h.t = 0; h.ty = toward; }
          break;
        }
        case 'clapTell': h.ang! += ((i === 0 ? 0.55 : -0.55) * -1 - h.ang!) * 0.1 * sp; if (h.t > 34 * this.tellMul) { h.st = 'clap'; h.t = 0; } break;
        case 'clap': {
          // both swing in to meet in the middle, and the clash rings out
          h.ang = (i === 0 ? 1 : -1) * Math.min(1.05, -0.55 + h.t * 0.08);
          if (h.t >= 20 && i === 1) {
            const cx = (b.heads[0].x + b.heads[1].x) / 2, cy = (b.heads[0].y + b.heads[1].y) / 2;
            this.rings.push({ x: cx, y: cy, r: 6, vr: 2.6 * sp, max: 130, thick: 8, dmg: atk, friendly: false, kind: 'imp', hit: [], rung: [] });
            this.sfx('ring', cx, cy); this.emit({ k: 'shake', n: 6 });
          }
          if (h.t > 30) { h.st = 'idle'; h.t = 0; }
          break;
        }
      }
      h.x = h.bx + Math.sin(h.ang!) * len; h.y = h.by + Math.cos(h.ang!) * len;
      const r: Rect = { x: h.x - 15, y: h.y - 24, w: 30, h: 48 };
      // hanging still at chest height it can be hit and does no harm; swinging, slamming or clapping it does
      if ((h.hp ?? 0) > 0) { b.hurt.push(Object.assign({ ...r }, { part: i })); if (h.st !== 'idle') b.harm.push(this.shrink(r, 5)); }
    }
    switch (b.st) {
      case 'intro': if (b.t > 70) this.go('idle', 50); break;
      case 'idle': {
        // the rest between attacks counts from when the last one has finished
        if (b.heads.some((h) => h.st !== 'idle' && h.st !== 'calm')) { b.t = 0; break; }
        if (b.t <= b.dur || alive.length === 0) break;
        const cycle = b.phase === 1 ? ['swing', 'slam'] : ['swing', 'clap', 'slam', ...(this.save.ngp ? ['double'] : [])];
        const nx = cycle[b.step % cycle.length];
        const who = alive[b.step % alive.length];
        b.step++;
        const h = b.heads[who];
        h.ty = lead.x > h.bx ? 1 : -1;
        if (nx === 'clap' && alive.length === 2) { for (const hh of b.heads) { hh.st = 'clapTell'; hh.t = 0; } this.sfx('tell', b.heads[0].x, b.heads[0].y); this.emit({ k: 'flash', color: '#ffe8a0', n: 4 }); }
        else if (nx === 'double') for (const i of alive) { const hh = b.heads[i]; hh.st = 'slamTell'; hh.t = 0; }
        else { h.st = nx === 'slam' ? 'slamTell' : 'swingTell'; h.t = 0; this.sfx('tell', h.x, h.y); this.emit({ k: 'flash', color: '#ffe8a0', n: 4 }); }
        // the warning lasts the whole wind-up (and the drop of a slam)
        b.tellT = (nx === 'slam' || nx === 'double' ? 30 : nx === 'clap' ? 34 : 36) * this.tellMul + 12;
        // alone, it hangs still a while longer between attacks: the moment to land blows
        this.go('idle', angry ? 40 : b.phase === 3 ? 32 : 36);
        break;
      }
    }
  }
  /** After a swing, an angry clapper throws: glass shards at the lead, or iron cogs that bounce along the floor. */
  clapperShots(h: Boss['heads'][number], i: number) {
    const lead = this.body, atk = BOSSES.clappers.atk;
    if (i === 1) for (const a of [-0.25, 0, 0.25]) { const dx = lead.x - h.x, dy = lead.y - 12 - h.y, d = Math.max(1, Math.hypot(dx, dy)), ca = Math.cos(a), sa = Math.sin(a); this.hostile('shard', h.x, h.y, ((dx * ca - dy * sa) / d) * 2, ((dx * sa + dy * ca) / d) * 2, 0, Math.round(atk * 0.6)); }
    else for (const d of [-1, 1]) this.hostile('cog', h.x, h.y, d * 1.6, -2.5, 0.16, Math.round(atk * 0.7), 7);
  }

  /** The Out-of-Tune Bell: the belfry's cracked great bell. It tolls shockwaves, swings right across its loft, and
   *  from phase 2 retunes the room: the wind turns, notes appear to climb (it rises out of reach without them) and
   *  then vanish. Phase 3 adds a rain of sour notes. */
  bossTune(b: Boss) {
    const rr = this.bossRoomRect(), lead = this.body, sp = this.bossSpeed, atk = BOSSES.tune.atk, floor = this.floorY();
    const h = b.heads[0];
    h.t += sp;
    const cycle = b.phase === 1 ? ['toll', 'swing'] : b.phase === 2 ? ['retune', 'toll', 'swing'] : ['retune', 'sour', 'swing', 'toll', ...(this.save.ngp ? ['crack'] : [])];
    const lenTo = (L: number, k = 0.06) => { h.tx += (L - h.tx) * k * sp; };
    switch (b.st) {
      case 'intro': h.ang = 0.05 * Math.sin(b.t * 0.1); if (b.t > 80) this.go('idle', 50); break;
      case 'idle': {
        h.ang! += (0.08 * Math.sin(this.tick * 0.04) - h.ang!) * 0.05 * sp; lenTo(b.vis < 1 ? 70 : 140);
        if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; this.go(`${nx}Tell`, nx === 'swing' ? 40 : 36, true); h.ty = lead.x > b.x ? -1 : 1; }
        break;
      }
      case 'tollTell': h.ang! *= 0.9; if (b.t > b.dur) {
        this.sfx('toll', b.x, b.y); this.emit({ k: 'shake', n: 8 });
        // a ring of sound round the bell (step back out of it); from phase 2 waves roll on along the floor from its edge
        // (then jump them)
        this.rings.push({ x: h.x, y: h.y + 30, r: 6, vr: 2.2 * sp, max: 76, thick: 8, dmg: atk, friendly: false, kind: 'imp', hit: [], rung: [] });
        if (b.phase >= 2) for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 80, y: floor, dir: d, speed: 1.8 * sp, life: 140, h: 14, dmg: atk });
        this.go(b.phase === 3 ? 'toll2' : 'idle', b.phase === 3 ? 26 : 36);
      } break;
      case 'toll2': if (b.t > b.dur) { for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 80, y: floor, dir: d, speed: 2.2 * sp, life: 110, h: 14, dmg: atk }); this.sfx('toll', b.x, b.y); this.go('idle', 44); } break;
      case 'swingTell': h.ang! += (0.9 * h.ty - h.ang!) * 0.08 * sp; lenTo(128, 0.08); if (b.t > b.dur) { this.go('swing', 150); this.sfx('swoosh', b.x, b.y); } break;
      case 'swing': {
        // a long pendulum right across the loft that skims just over a standing hero's ears: stay low on the floor (a
        // jump, or the side ledges near the top of its arc, are in its way)
        const A = b.phase === 3 ? 1.15 : 0.95;
        h.ang = A * h.ty * Math.cos(b.t * 0.075);
        lenTo(128, 0.1);
        b.harm.push({ x: h.x - 36, y: h.y - 30, w: 72, h: 66 });
        if (b.t > b.dur) this.go('idle', 30);
        break;
      }
      case 'retuneTell': h.ang! *= 0.9; if (b.t > b.dur) {
        // the wind turns round and gets up, notes appear to climb, and the bell rises out of reach without them
        this.arenaWind = { dir: (-this.arenaWind.dir) as 1 | -1, str: 1.6 };
        this.notes = this.notes.filter((n) => !n.key.startsWith('tune:'));
        const steps = [[8, 12], [13, 9], [18, 6], [41, 12], [46, 9], [51, 6]];
        steps.forEach(([c, r], k) => this.notes.push({ key: `tune:${k}`, room: this.room.id, x0: (this.room.gx * COLS + c) * TILE, x1: (this.room.gx * COLS + c + 2) * TILE, y: (this.room.gy * ROWS + r) * TILE, t: 0, at: (k % 3) * NOTE_GAP, life: 330 + (k % 3) * NOTE_GAP }));
        this.sfx('echo', b.x, b.y); this.emit({ k: 'wind', area: 'loft', dir: this.arenaWind.dir });
        b.vis = 0.99; this.go('high', 300);
      } break;
      case 'high': {
        lenTo(64, 0.05); h.ang! += (0.2 * Math.sin(b.t * 0.03) - h.ang!) * 0.05 * sp;
        if (b.t > b.dur) { b.vis = 1; this.arenaWind = { dir: this.arenaWind.dir, str: 1 }; this.go('idle', 30); }
        break;
      }
      case 'sourTell': if (b.t > b.dur) { this.go('sour', 90); } break;
      case 'sour': {
        if (Math.floor(b.t) % 8 === 0 && Math.floor(b.t - sp) % 8 !== 0) { const a = Math.PI / 2 + (this.rand() - 0.5) * 2.2; this.hostile('sour', h.x, h.y + 34, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.03, Math.round(atk * 0.6), 6); }
        if (b.t > b.dur) this.go('idle', 40);
        break;
      }
      // New Game+: the crack flares and spits a spiral of sour notes
      case 'crackTell': if (b.t > b.dur) this.go('crack', 80); break;
      case 'crack': {
        if (Math.floor(b.t) % 6 === 0 && Math.floor(b.t - sp) % 6 !== 0) { const a = b.t * 0.3; this.hostile('sour', h.x, h.y, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0, Math.round(atk * 0.5), 6); }
        if (b.t > b.dur) this.go('idle', 40);
        break;
      }
    }
    h.x = h.bx + Math.sin(h.ang!) * h.tx; h.y = h.by + Math.cos(h.ang!) * h.tx;
    b.x = h.x; b.y = h.y + 40;
    const body: Rect = { x: h.x - 40, y: h.y - 34, w: 80, h: 74 };
    b.body = body;
    // hanging low between attacks it can be hit from the floor (and only its swing hurts)
    b.hurt.push(Object.assign({ ...body }, { mul: b.st === 'high' ? 1.5 : 1 }));
    void rr;
  }

  orchardControl() {
    const b = this.boss;
    if (!b || !isOrchardRoom(this.room) || b.calm || b.st === 'wait' || b.st === 'intro' || b.st === 'orchardOpen') return null;
    const side = b.id === 'graft-mother' ? b.side : -1;
    const distance = b.id === 'bracken-stag' ? 144 : 128;
    return {
      x: b.sx + side * distance, y: b.sy,
      ability: b.st === 'orchardRest' ? 'bloom' as const : b.st === 'orchardCaught' ? 'shear' as const : null,
      waiting: b.id === 'bracken-stag' ? 'Let the stag catch its antlers' : b.id === 'rootback' ? 'Wait for its shell to lift' : 'Wait for the roots to settle',
    };
  }

  private nearGlacierSocket(range: number) {
    const b = this.body;
    const sockets = this.room.glacier?.sockets ?? [];
    let best: { i: number; x: number; y: number } | null = null, dist = range;
    for (const [i, s] of sockets.entries()) {
      const p = glacierPoint(this.room, s.at[0], s.at[1] + 1);
      const dx = Math.hypot(b.x - p.x, b.y - p.y);
      if (dx < dist) { dist = dx; best = { i, ...p }; }
    }
    return best;
  }

  nearGlacierFall(state: 'water' | 'frozen', range: number) {
    if (!this.glacier) return null;
    const b = this.body;
    let best: { i: number; x: number; y: number } | null = null, dist = range;
    for (const [i, f] of (this.room.glacier?.falls ?? []).entries()) {
      if (this.glacier.state(i) !== state) continue;
      const o = roomRect(this.room), x0 = o.x + f.c * TILE, x1 = x0 + f.w * TILE;
      const x = (x0 + x1) / 2, y = Math.min(o.y + f.bottom * TILE, Math.max(o.y + f.top * TILE, b.y));
      const dx = Math.hypot(Math.max(x0 - b.x, b.x - x1, 0), y - b.y);
      if (dx < dist) { dist = dx; best = { i, x, y }; }
    }
    return best;
  }

  private glacierBeam() {
    const b = this.boss;
    return b?.id === 'sun-gate' && (b.st === 'glacierTell' || b.st === 'glacierRush');
  }

  turnGlacierMirror() {
    const t = this.nearGlacierSocket(32);
    if (!t || !this.glacier) return false;
    if (this.lead !== 'enzo' || !this.has('sunmirror')) { this.note('Enzo can turn this with the Sun Mirror.'); return true; }
    if (this.boss?.st === 'intro' || this.boss?.st === 'wait') return true;
    if (this.boss?.st === 'glacierOpen') return true;
    if (!this.glacier.turn(t.i, this.tick, this.helping(), this.glacierBeam())) {
      this.note(this.room.boss === 'sun-gate' ? 'Wait until the Warden’s eye lights up.' : 'No light reaches this socket. Turn the sunlit mirror first.');
      this.sfx('locked'); return true;
    }
    this.body.vx = 0;
    this.glacierWork = this.tick + 27;
    this.sfx('chime', t.x, t.y);
    this.emit({ k: 'pulse', x: t.x, y: t.y - 16, r: 130, color: [1, 0.83, 0.48] });
    const b = this.boss;
    if (b?.id === 'glass-vicuna' && b.st === 'glacierRest') this.go('glacierTell', GLACIER_TELL.vicuna, true);
    if (b?.id === 'serac-osjollo' && !b.low) { b.low = 1; this.go('glacierDrop', 36); }
    if (b?.id === 'sun-gate') this.go('glacierOpen', this.helping() ? 430 : 325);
    if (!b && !this.room.glacier?.falls?.some(f => f.timed)) this.emit({ k: 'save' });
    return true;
  }

  private castGlacierFrost() {
    const f = this.nearGlacierFall('water', 112);
    if (!this.glacier || !f) return;
    // The terrain cast does no damage and costs no MP, so an empty lantern cannot strand the pair.
    this.startAct('cast', 0, 'frost');
    this.glacier.change(f.i, 'frozen', this.tick, this.helping());
    this.sfx('frost', f.x, f.y - 28);
    this.emit({ k: 'pulse', x: f.x, y: f.y - 24, r: 95, color: [0.63, 0.95, 1] });
    if (!this.boss && !this.room.glacier?.falls?.[f.i].timed) this.emit({ k: 'save' });
  }

  private updateGlacier() {
    if (!this.glacier) return;
    const b = this.body, o = roomRect(this.room);
    this.glacier.update(this.tick, this.helping(), i => {
      const f = this.room.glacier?.falls?.[i];
      if (!f) return false;
      return overlap(this.leadRect(), { x: o.x + f.c * TILE, y: o.y + f.top * TILE, w: f.w * TILE, h: (f.bottom - f.top) * TILE });
    }, b);
    for (const i of this.glacier.icicles) {
      if (i.stage === 'tell' && i.t === 0) this.sfx('crack', i.x, i.y);
      if (i.stage === 'fall' && overlap(this.leadRect(), { x: i.x - 7, y: i.y, w: 14, h: 26 })) this.hurtLead(19, i.x);
    }
  }

  glacierHint(): { x: number; y: number; keys: (keyof Input)[]; text: string } | null {
    if (!this.glacier || !this.helping() || this.glacierClimbing) return null;
    const b = this.body, boss = this.boss, lead = this.lead;
    const at = (text: string, keys: (keyof Input)[] = [], x = b.x, y = b.y) => ({ text, keys, x, y });
    if (boss?.st === 'glacierOpen') return lead === 'dora' ? at('Strike now', ['attack'], boss.x, boss.y) : at('Tag to Dora to strike', ['tag']);
    const icicle = this.glacier.icicles.find(i => i.stage === 'tell' && Math.abs(b.x - i.x) < 66);
    if (icicle) return at('Ice is shaking. Keep moving!', [], icicle.x, b.y);
    const t = this.nearGlacierSocket(70);
    const water = this.nearGlacierFall('water', 112);
    const climbRoom = this.room.id !== 'glacier-first-thaw' && this.room.id !== 'glacier-mirrors' && boss?.id !== 'glass-vicuna';
    if (water && climbRoom) return lead === 'enzo' ? at('Freeze the fall', ['cast'], water.x, water.y) : at('Tag to Enzo to freeze the fall', ['tag']);
    const ice = this.nearGlacierFall('frozen', 38);
    if (climbRoom && ice && this.has('icepick') && b.y > roomRect(this.room).y + (this.room.glacier?.falls?.[ice.i].top ?? 0) * TILE + 4) return lead === 'dora' ? at('Climb the ice', ['up'], ice.x, ice.y) : at('Tag to Dora to climb', ['tag']);
    const c = Math.floor(b.x / TILE), r = Math.floor((b.y - 9) / TILE);
    if (this.has('icepick') && [c - 1, c, c + 1].some(cx => this.glacierGeometry(cx, r)?.climb)) {
      return lead === 'dora' ? at('Grip the ice wall', ['up']) : at('Tag to Dora to grip the ice', ['tag']);
    }
    const active = t && (!this.glacier.lit(t.i) || (boss && boss.st === 'glacierTell') || (this.room.glacier?.falls?.some(f => f.timed) && this.glacier.state(0) === 'plug'));
    if (active && t && this.has('sunmirror')) {
      if (!this.glacier.powered(t.i, this.glacierBeam())) return at(boss ? 'Wait for the Warden’s eye to shine' : 'This socket is in shadow. Turn the first mirror.', [], t.x, t.y);
      return lead === 'enzo' ? at('Turn the mirror', ['up'], t.x, t.y) : at('Tag to Enzo to turn the mirror', ['tag']);
    }
    if ((this.has('icepick') || this.glacierPracticePick()) && lead === 'dora' && onIce(this.env, b) && Math.abs(b.vx) > 0.8 && !b.iceBraking) return at(this.has('icepick') ? 'Plant the Ice Pick to brake' : 'Try the tethered pick to brake', ['down', 'attack']);
    if (this.room.id === 'glacier-landing' && onIce(this.env, b) && Math.abs(b.vx) > 0.5) return at('Let go to coast. Stone stops the slide.');
    return null;
  }

  private updateGlacierGuardian(b: Boss) {
    const ice = this.glacier!, o = roomRect(this.room), floor = this.floorY(), hunter = b.id === 'serac-osjollo', gate = b.id === 'sun-gate';
    const fall = this.room.glacier?.falls?.[0];
    const fallX = o.x + ((fall?.c ?? 0) + (fall?.w ?? 0) / 2) * TILE;
    const tell = gate ? GLACIER_TELL.warden : hunter ? GLACIER_TELL.osjollo : GLACIER_TELL.vicuna;
    const player = this.body;
    const setBody = () => { b.body = { x: b.x - (gate ? 43 : 35), y: b.y - (gate ? 68 : 51), w: gate ? 86 : 70, h: gate ? 68 : 51 }; };
    setBody();
    if (b.st === 'intro') { if (b.t >= b.dur) this.go('glacierRest', 68); return; }
    if (b.st === 'glacierDrop') {
      b.x = fallX; b.y = Math.min(floor, b.sy + b.t * b.t * 0.19);
      if (b.t >= b.dur) { b.y = floor; this.go('glacierRest', 72); }
      return;
    }
    if (b.st === 'glacierRest') {
      if (hunter && b.low && ice.state(0) === 'frozen' && player.y <= b.sy + 2 && player.x > fallX - TILE) {
        this.go('glacierPerchTell', tell, true); return;
      }
      if (b.t >= b.dur) {
        b.tx = Math.max(o.x + 10 * TILE, Math.min(o.x + o.w - 10 * TILE, player.x));
        b.face = !hunter || b.tx < b.x ? -1 : 1;
        this.go('glacierTell', tell, true);
      }
      return;
    }
    if (b.st === 'glacierPerchTell') {
      if (b.t >= b.dur) { b.step = 1; this.go('glacierRush', 36); }
      return;
    }
    if (b.st === 'glacierTell') {
      if (b.t >= b.dur) { b.step = 0; this.go('glacierRush', gate ? 72 : hunter ? 44 : 59); }
      return;
    }
    if (b.st === 'glacierRush') {
      const u = Math.min(1, b.t / b.dur);
      if (gate) {
        const x = Math.max(o.x + 4 * TILE, b.sx - b.t * (4.7 + 0.25 * b.phase));
        b.harm.push({ x: x - 13, y: floor - 15, w: 26, h: 15 });
      } else if (hunter && b.step) {
        b.x = fallX + (b.sx - fallX) * u; b.y = floor + (b.sy - floor) * u - Math.sin(u * Math.PI) * 41;
      } else if (hunter) {
        const start = b.low ? fallX : b.sx, end = b.tx;
        b.x = start + (end - start) * u;
        b.y = floor - Math.sin(u * Math.PI) * 75;
        if (u > 0.68) b.harm.push({ x: b.x - 17, y: floor - 16, w: 34, h: 16 });
      } else {
        const end = ice.state(0) === 'water' ? fallX : o.x + 8 * TILE;
        b.x = b.sx + (end - b.sx) * u; b.y = b.sy; b.face = -1;
        b.harm.push({ x: b.x - 17, y: floor - 15, w: 34, h: 15 });
      }
      if (b.t >= b.dur) {
        if (hunter && b.step || !hunter && !gate && ice.state(0) === 'water') {
          b.harm = []; this.go('glacierOpen', this.helping() ? 430 : 325);
          this.sfx('splash', b.x, b.y);
        } else {
          b.x = hunter && b.low ? fallX : b.sx; b.y = hunter && b.low ? floor : b.sy;
          this.go('glacierRest', 84);
        }
      }
      setBody(); return;
    }
    if (b.st === 'glacierOpen') {
      if (hunter) { b.x = b.sx; b.y = b.sy; }
      setBody(); b.hurt.push(b.body);
      if (b.t >= b.dur) {
        b.x = b.sx; b.y = b.sy; b.low = 0;
        const inFall = this.nearGlacierFall('frozen', 6) || this.nearGlacierFall('water', 6);
        ice.resetArena();
        if (inFall) ice.change(inFall.i, 'frozen', this.tick, this.helping());
        this.go('glacierRest', 96);
      }
    }
  }

  private updateOrchardGuardian(b: Boss) {
    const side = b.id === 'graft-mother' ? b.side : -1;
    const shell = { x: b.x - 36, y: b.y - 56, w: 72, h: 56 };
    b.body = shell;
    if (b.st === 'intro') {
      if (b.t >= b.dur) this.go('orchardRest', 120);
      return;
    }
    if (b.st === 'orchardRest') {
      // A periodic sweep gives the player a reason to use the high ledges. Waking a bud instead
      // makes the same attack catch on the graft and opens the next part of the fight.
      if (b.t >= b.dur) this.go('orchardTell', 76 * this.tellMul, true);
      return;
    }
    if (b.st === 'orchardTell') {
      b.face = side;
      if (b.t >= b.dur) this.go('orchardRush', b.id === 'graft-mother' ? 54 : 32);
      return;
    }
    if (b.st === 'orchardRush') {
      const width = b.id === 'bracken-stag' ? 91 : b.id === 'rootback' ? 58 : 99;
      if (b.id === 'bracken-stag') b.x = b.sx + side * Math.min(80, b.t * 2.7);
      if (!b.low || b.id === 'graft-mother') b.harm.push({ x: side < 0 ? b.x - width : b.x, y: b.sy - 21, w: width, h: 21 });
      if (b.t >= b.dur) {
        if (b.low) this.go('orchardCaught', Infinity);
        else { b.x = b.sx; this.go('orchardRest', 160); }
      }
      return;
    }
    if (b.st === 'orchardOpen') {
      b.hurt.push({ x: b.x - 36, y: b.y - 48, w: 72, h: 48 });
      if (b.t >= b.dur) {
        b.x = b.sx;
        if (b.id === 'graft-mother') b.side = b.side === 1 ? -1 : 1;
        this.go('orchardRest', 140);
      }
    }
  }

  /** The Molten Founder: a walking furnace with a ladle. Only frosted spots take a blade (see damageBoss). */
  saltGuardianControl() {
    const b = this.boss;
    if (!b || !this.room.salt || b.calm || b.st === 'wait' || b.st === 'intro') return null;
    const rr = roomRect(this.room);
    const kind: 'pan' | 'shield' | 'stop' = b.id === 'panback' ? 'pan' : b.id === 'tollkeeper' ? 'shield' : 'stop';
    const x = rr.x + (kind === 'pan' ? 736 : kind === 'shield' ? 192 : 124);
    return { kind, x, y: rr.y + 240 };
  }

  saltGuardianHint() {
    const b = this.boss, control = this.saltGuardianControl();
    if (!b || !control || !this.helping()) return null;
    if (b.st === 'stagger') return { key: 'attack', text: b.id === 'panback' ? 'Strike the exposed belly' : 'Strike the exposed flank', x: b.x };
    if (b.id === 'weighmaster' && b.low) return { key: null, text: 'Stand behind the ballast stop', x: control.x - 44 };
    if (b.id === 'tollkeeper' && b.low && b.st === 'open') return { key: null, text: b.low === -1 ? 'Strike from the open left side' : 'Strike from the open right side', x: b.x + b.low * 40 };
    if (Math.abs(this.body.x - control.x) > 45 || !this.body.ground) return { key: null, text: control.kind === 'stop' ? 'Go to the ballast stop' : 'Go to the lift lever', x: control.x };
    const hero = control.kind === 'pan' ? 'enzo' : 'dora';
    if (this.lead !== hero && !this.save.heroes[hero].down) return { key: 'tag', text: hero === 'dora' ? 'Tag to Dora' : 'Tag to Enzo', x: control.x };
    if (b.id === 'panback' && b.st !== 'perched') return { key: null, text: 'Wait for the armadillo to settle on the pan', x: control.x };
    if (b.id === 'tollkeeper' && b.st !== 'rest') return { key: null, text: 'Wait for the shields to settle', x: control.x };
    return { key: 'up', text: { stop: 'Set the ballast stop', pan: 'Raise the pan under its shell', shield: 'Shift the counterweight to lift a shield' }[control.kind], x: control.x };
  }

  useSaltGuardian() {
    const b = this.boss, control = this.saltGuardianControl();
    if (!b || !control || !this.body.ground || Math.abs(this.body.x - control.x) > 45 || Math.abs(this.body.y - control.y) > 4) return false;
    const hero = control.kind === 'pan' ? 'enzo' : 'dora';
    if (this.lead !== hero && !this.save.heroes[hero].down) {
      this.note(hero === 'dora' ? 'Tag to Dora to shift the ballast.' : 'Tag to Enzo to raise the pan.');
      return true;
    }
    if (b.id === 'weighmaster' && b.low === 0 && this.has('ballast')) {
      b.low = 1;
    } else if (b.id === 'panback' && b.st === 'perched' && this.has('catch')) {
      this.go('panRise', 34);
    } else if (b.id === 'tollkeeper' && b.st === 'rest' && this.has('ballast')) {
      b.low = b.side;
      b.side = b.side === 1 ? -1 : 1;
      this.go('open', this.helping() ? 560 : 350);
    } else return true;
    this.saltWork = { hero: this.lead, until: this.tick + 24, face: this.body.x <= control.x ? 1 : -1 };
    this.sfx('door', control.x, control.y);
    return true;
  }

  updateSaltGuardian(b: Boss) {
    const rr = roomRect(this.room), floor = rr.y + 240, lead = this.body, sp = this.bossSpeed;
    const atlas = `boss-${b.id}`;
    const exposed = (rect: Rect) => { b.hurt.push(rect); };
    const dangerous = (rect: Rect) => { b.harm.push(rect); };
    const square = (w: number, h: number, shift = 0): Rect => ({ x: b.x - w / 2 + shift, y: b.y - h, w, h });
    const movingBack = (speed: number) => {
      const dx = b.sx - b.x;
      b.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * sp);
      if (Math.abs(dx) <= speed * sp) this.go(b.id === 'panback' ? 'perched' : 'rest', 48);
    };
    if (b.id === 'weighmaster') {
      switch (b.st) {
        case 'intro': if (b.t >= b.dur) this.go('rest', 45); break;
        case 'rest': if (b.t >= b.dur) { b.face = lead.x < b.x ? -1 : 1; this.go('chargeTell', (b.phase > 1 ? 49 : 65) * this.tellMul, true); } break;
        case 'chargeTell': if (b.t >= b.dur) this.go('charge', 160); break;
        case 'charge': {
          const edge = rr.x + (b.face === -1 ? 62 : rr.w - 62);
          const nx = b.x + b.face * 4.2 * sp;
          if (b.low && b.face === -1 && nx <= rr.x + 196) {
            b.x = rr.x + 196;
            this.emit({ k: 'shake', n: 3 });
            this.sfx('land', b.x, floor);
            this.go('stagger', this.helping() ? 480 : 300);
          } else {
            b.x = b.face === -1 ? Math.max(edge, nx) : Math.min(edge, nx);
            dangerous(bossArtBox(b, atlas, b.x, b.y, b.face > 0, 0.88));
            if (b.x === edge || b.t >= b.dur) this.go('back', 0);
          }
          break;
        }
        case 'stagger':
          exposed(square(100, 71));
          if (b.t >= b.dur) this.go('back', 0);
          break;
        case 'back': movingBack(4.1); break;
      }
    } else if (b.id === 'panback') {
      switch (b.st) {
        case 'intro': if (b.t >= b.dur) this.go('perched', 120); break;
        case 'perched':
          if (b.t >= b.dur + (this.helping() ? 80 : 0)) { b.face = lead.x < b.x ? -1 : 1; this.go('rollTell', 50 * this.tellMul, true); }
          break;
        case 'rollTell': if (b.t >= b.dur) this.go('roll', 64); break;
        case 'roll':
          b.x = clamp(b.x + b.face * 4.5 * sp, rr.x + 90, rr.x + rr.w - 90);
          dangerous(square(70, 46));
          if (b.t >= b.dur) this.go('back', 0);
          break;
        case 'back': movingBack(5); break;
        case 'panRise':
          b.y = floor - Math.round(24 * clamp(b.t / b.dur, 0, 1));
          if (b.t >= b.dur) this.go('stagger', this.helping() ? 510 : 300);
          break;
        case 'stagger':
          exposed({ x: b.x - 60, y: b.y - 58, w: 120, h: 64 });
          if (b.t >= b.dur) this.go('panDown', 35);
          break;
        case 'panDown':
          b.y = floor - Math.round(24 * (1 - clamp(b.t / b.dur, 0, 1)));
          if (b.t >= b.dur) this.go('perched', 120);
          break;
      }
    } else {
      switch (b.st) {
        case 'intro': if (b.t >= b.dur) this.go('rest', 0); break;
        case 'open':
          exposed(square(72, 85, b.low * 34));
          if (b.t >= b.dur) { b.low = 0; this.go('sweepTell', 55 * this.tellMul, true); }
          break;
        case 'sweepTell':
          if (b.t >= b.dur) {
            this.go('sweep', 65);
            for (const dir of [-1, 1] as const) this.waves.push({ x: b.x + dir * 38, y: floor, dir, speed: 3 * sp, life: 145, h: 12, dmg: BOSSES.tollkeeper.atk });
          }
          break;
        case 'sweep': if (b.t >= b.dur) this.go('rest', 0); break;
      }
    }
  }

  bossFounder(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body, sp = this.bossSpeed, atk = BOSSES.founder.atk;
    for (const p of b.spots ?? []) p.t -= sp;
    b.spots = (b.spots ?? []).filter((p) => p.t > 0);
    const ngp = this.save.ngp ? ['twin'] : [];
    const cycle = b.phase === 1 ? ['pour', 'pound', 'pour'] : b.phase === 2 ? ['pour', 'rain', ...ngp, 'pound'] : ['flood', 'pour', 'rain', ...ngp, 'pound'];
    if (b.st === 'idle' || b.st === 'intro') b.face = lead.x > b.x ? 1 : -1;
    switch (b.st) {
      case 'intro': if (b.t > 70) this.go('idle', 60); break;
      case 'idle': {
        // it lumbers after the lead, slowly
        if (Math.abs(lead.x - b.x) > 70) b.x = clamp(b.x + b.face * 0.55 * sp, rr.x + 70, rr.x + rr.w - 90);
        if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; this.go(`${nx}Tell`, nx === 'pound' ? 44 : 40, true); }
        break;
      }
      case 'pourTell': case 'twinTell': if (b.t > b.dur) {
        // the ladle tips: three globs of bronze arc toward the lead (twice in New Game+)
        const n = b.st === 'twinTell' ? 2 : 1;
        for (let k = 0; k < n; k++) for (const f of [0.75, 1, 1.25]) {
          const dx = (lead.x - b.x) * f + (k ? b.face * 60 : 0), t = 46;
          this.hostile('glob', b.x + b.face * 40, b.y - 90, dx / t, -4.2 - k, 0.18, Math.round(atk * 0.8), 7, 160);
        }
        this.sfx('pour', b.x, b.y); this.go('pour', 30);
      } break;
      case 'pour': if (b.t > b.dur) this.go('idle', b.phase === 3 ? 34 : 48); break;
      case 'poundTell': if (b.t > b.dur) {
        for (const d of [-1, 1] as const) this.waves.push({ x: b.x + d * 50, y: floor, dir: d, speed: 2 * sp, life: 150, h: 14, dmg: atk });
        this.sfx('slam', b.x, b.y); this.emit({ k: 'shake', n: 8 }); this.go('pound', 36);
      } break;
      case 'pound': if (b.t > b.dur) this.go('idle', 44); break;
      case 'rainTell': if (b.t > b.dur) {
        // drops of molten bronze from the crucibles above: marked on the floor first
        const xs = [lead.x, ...[0, 1, 2, 3].map(() => rr.x + 40 + this.rand() * (rr.w - 80))];
        xs.forEach((x, k) => this.markers.push({ x, y: floor, t: (this.helping() ? 70 : 50) + k * 10, kind: 'drop' }));
        this.go('rain', 70);
      } break;
      case 'rain': if (b.t > b.dur) this.go('idle', 40); break;
      case 'floodTell': if (b.t > b.dur) {
        // the moulds spill: a tall wave rolls in from each wall (jump it, or ride it out on a ledge)
        for (const d of [1, -1] as const) this.waves.push({ x: d > 0 ? rr.x + 20 : rr.x + rr.w - 20, y: floor, dir: d, speed: 1.6 * sp, life: 300, h: 20, dmg: atk });
        this.sfx('pour', b.x, b.y); this.go('flood', 60);
      } break;
      case 'flood': if (b.t > b.dur) this.go('idle', 50); break;
    }
    b.y = floor;
    b.body = bossArtBox(b, 'boss-founder', b.x, b.y + 2, b.face > 0, 0.85);
    b.hurt.push(b.body);
    // its touch burns (but not the ladle's back swing)
    b.harm.push(this.shrink(b.body, 14));
  }

  /** The Glass Choir: three singers. It sings a song (a note from each in turn); then it listens, and the heroes ring
   *  it back by striking the singers in the same order. Between songs it throws glass. */
  bossChoir(b: Boss) {
    const lead = this.body, sp = this.bossSpeed, atk = BOSSES.choir.atk, floor = this.floorY();
    const len = b.phase === 1 ? 3 : b.phase === 2 ? 4 : 5, gap = this.helping() ? 52 : 38;
    for (const h of b.heads) { h.y = floor; if (h.st !== 'idle' && (h.t -= sp) <= 0) h.st = 'idle'; }
    const song = (b.song ??= []);
    switch (b.st) {
      case 'intro': if (b.t > 80) this.go('singTell', 30, true); break;
      case 'singTell': if (b.t > b.dur) {
        song.length = 0;
        for (let k = 0; k < len; k++) { let n = Math.floor(this.rand() * 3); if (k && n === song[k - 1]) n = (n + 1 + Math.floor(this.rand() * 2)) % 3; song.push(n); }
        b.sung = 0; this.go('sing', len * gap + 20);
      } break;
      case 'sing': {
        // each singer lights and sings its note in turn
        const k = Math.floor(b.t / gap), prev = Math.floor((b.t - sp) / gap);
        if (k < len && (k !== prev || b.t <= sp)) { const h = b.heads[song[k]]; h.st = 'sing'; h.t = gap - 8; this.sfx(`note${song[k]}`, h.x, h.y - 40); this.emit({ k: 'notes', x: h.x, y: h.y - 60 }); }
        if (b.t > b.dur) { this.go('listen', this.helping() ? 900 : 480); if (!this.flag('choir:tip')) { this.setFlag('choir:tip'); this.note('Now ring its song back: strike the singers in the order they sang.', true); } }
        break;
      }
      case 'listen': if (b.t > b.dur) { b.sung = 0; this.go('shardsTell', 36, true); } break;
      case 'stun': if (b.t > b.dur) this.go('shardsTell', 40, true); break;
      case 'shardsTell': if (b.t > b.dur) {
        // each singer throws a fan of glass at the lead
        for (const h of b.heads) for (const da of [-0.25, 0, 0.25]) {
          const a = Math.atan2(lead.y - 14 - (h.y - 50), lead.x - h.x) + da;
          this.hostile('glass', h.x, h.y - 50, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0, Math.round(atk * 0.7), 5, 150);
        }
        this.sfx('shatter', b.x, b.y - 40);
        this.go(b.phase === 3 && this.save.ngp ? 'shards2' : 'rest', 50);
      } break;
      case 'shards2': if (b.t > b.dur) { for (const h of b.heads) this.hostile('glass', h.x, h.y - 50, 0, -3, 0.12, Math.round(atk * 0.6), 5, 160); this.go('rest', 40); } break;
      case 'rest': if (b.t > b.dur) this.go('singTell', 30, true); break;
    }
    b.hurt = b.heads.map((h, i) => Object.assign({ x: h.x - 18, y: h.y - 72, w: 36, h: 72 }, { part: i }));
    b.body = { x: b.heads[0].x - 30, y: floor - 80, w: b.heads[2].x - b.heads[0].x + 60, h: 80 };
    // only their glass hurts (the singers themselves don't)
  }

  /** The Hollow Bell: over a lava pit. First its dark shell (it tolls, swings and drops bell blanks; a slam on its
   *  crown rings it hard); at half, the shell cracks and its molten heart flies at the heroes, ringed by shards (a
   *  Resonance chime stuns it). The lava rises as it fights: with the helping hand slower, and never over the stone. */
  bossHollow(b: Boss) {
    const rr = this.bossRoomRect(), lead = this.body, sp = this.bossSpeed, atk = BOSSES.hollow.atk, help = this.helping();
    const base = rr.y + 15 * TILE;
    if (b.form === 1 && b.hp <= b.max / 2 && b.st !== 'crack') { this.go('crack', 90); this.emit({ k: 'flash', color: '#ffb060', n: 12 }); this.sfx('shatter', b.x, b.y); this.note('The shell cracks open: its molten heart is free!', true); }
    // the lava: it rises in the second form toward the ledges (with the helping hand it stops below the stone)
    // (in the second form it swells for a while and ebbs again; the ledges up top stay dry)
    const high = b.form === 2 && this.tick % 1200 < 640;
    const top = high ? (help ? rr.y + 12 * TILE + 6 : rr.y + 10.6 * TILE) : base - 8;
    const lava = b.lava ?? base;
    b.lava = lava > top ? Math.max(top, lava - 0.15 * (help ? 0.5 : 1) * sp) : Math.min(top, lava + 0.2 * sp);
    if (lead.y > b.lava + 3 && !this.save.heroes[this.lead].down && b.st !== 'intro') {
      // into the lava: a burn, and back up to the last safe stone (a ledge, if the lava has covered it)
      this.hurtLead(Math.round(atk * 0.7), lead.x);
      const ledges = [rr.x + 17 * TILE + 8, rr.x + 42 * TILE + 8];
      const to = this.safe.y < b.lava - 8 ? this.safe : { x: ledges.reduce((a, x) => (Math.abs(x - lead.x) < Math.abs(a - lead.x) ? x : a)), y: rr.y + 8 * TILE };
      lead.x = to.x; lead.y = to.y; lead.vx = 0; lead.vy = 0; lead.dashT = 0; lead.ground = false;
      this.follower.x = lead.x - lead.face * 24; this.follower.y = lead.y; this.trail = [];
      this.emit({ k: 'hit', x: lead.x, y: b.lava, big: true, color: '#ff8a30' });
    }
    const ngp = this.save.ngp ? ['blanks2'] : [];
    const cycle = b.form === 1 ? ['toll', 'swing', 'blanks', ...ngp] : ['lunge', 'orbit', 'lunge', ...(b.phase === 3 ? ['blanks'] : []), ...ngp];
    switch (b.st) {
      case 'intro': if (b.t > 80) this.go('idle', 50); break;
      case 'idle': {
        // it drifts above the middle of the pit (its heart hunts the lead)
        const tx = b.form === 1 ? b.sx : clamp(lead.x, rr.x + 80, rr.x + rr.w - 80), ty = b.form === 1 ? b.sy : rr.y + 6 * TILE;
        b.x += (tx - b.x) * 0.02 * sp; b.y += (ty + Math.sin(this.tick * 0.05) * 6 - b.y) * 0.04 * sp;
        b.face = lead.x > b.x ? 1 : -1;
        if (b.t > b.dur) { const nx = cycle[b.step++ % cycle.length]; this.go(`${nx}Tell`, nx === 'lunge' ? 46 : 40, true); b.tx = lead.x; b.ty = lead.y - 20; }
        break;
      }
      case 'tollTell': if (b.t > b.dur) {
        this.rings.push({ x: b.x, y: b.y - 40, r: 8, vr: 2.3 * sp, max: 120, thick: 9, dmg: atk, friendly: false, kind: 'imp', hit: [], rung: [] });
        this.sfx('toll', b.x, b.y); this.emit({ k: 'shake', n: 8 }); this.go('toll', 40);
      } break;
      case 'swingTell': if (b.t > b.dur) { this.go('swing', 120); this.sfx('swoosh', b.x, b.y); } break;
      case 'swing': {
        // a wide swoop across the pit, low over the stone
        // (only over the middle of the pit: the outer stones are out of its reach)
        b.x = b.sx + Math.sin(b.t * 0.052) * 150; b.y = b.sy + 12 * Math.abs(Math.sin(b.t * 0.052));
        if (b.t > b.dur) this.go('idle', 40);
        break;
      }
      case 'blanksTell': case 'blanks2Tell': if (b.t > b.dur) {
        const n = b.st === 'blanks2Tell' ? 6 : 4;
        for (let k = 0; k < n; k++) this.markers.push({ x: k === 0 ? lead.x : rr.x + 60 + this.rand() * (rr.w - 120), y: rr.y + 12 * TILE, t: (help ? 70 : 52) + k * 12, kind: 'blank' });
        this.sfx('tell', b.x, b.y); this.go('blanks', 70);
      } break;
      case 'crack': if (b.t > b.dur) { b.form = 2; b.phase = Math.max(b.phase, 2) as 1 | 2 | 3; this.go('idle', 40); } break;
      case 'lungeTell': { b.face = b.tx > b.x ? 1 : -1; if (b.t > b.dur) { b.sx = b.x; b.vis = 1; this.go('lunge', 40); this.sfx('swoosh', b.x, b.y); } } break;
      case 'lunge': {
        const p = clamp(b.t / 40, 0, 1);
        b.x = b.sx + (b.tx - b.sx) * p; b.y += (b.ty - b.y) * 0.08 * sp;
        if (b.t > b.dur) { b.sx = rr.x + rr.w / 2; this.go('idle', 46); }
        break;
      }
      case 'orbitTell': if (b.t > b.dur) this.go('orbit', 200); break;
      case 'orbit': {
        // shards wheel round it as it follows the lead slowly
        b.x += clamp(lead.x - b.x, -0.7, 0.7) * sp;
        const n = b.phase === 3 ? 4 : 3, R = 54 + 10 * Math.sin(b.t * 0.05);
        for (let k = 0; k < n; k++) { const a = b.t * 0.05 + (k * Math.PI * 2) / n; b.harm.push({ x: b.x + Math.cos(a) * R - 8, y: b.y - 50 + Math.sin(a) * R - 8, w: 16, h: 16 }); }
        if (b.t > b.dur) this.go('idle', 40);
        break;
      }
      case 'stun': b.y = Math.min(b.y + 0.4 * sp, rr.y + 10 * TILE); if (b.t > b.dur) this.go('idle', 30); break;
      default: if (b.t > b.dur) this.go('idle', 40);
    }
    const sheet = b.form === 2 ? 'boss-hollowb' : 'boss-hollow';
    b.body = bossArtBox(b, sheet, b.x, b.y + 2, b.face > 0, 0.85);
    b.hurt.push(b.body);
    if (b.st === 'swing' || b.st === 'lunge') b.harm.push(this.shrink(b.body, 10));
  }

  bossMother(b: Boss) {
    const rr = this.bossRoomRect(), floor = this.floorY(), lead = this.body, sp = this.bossSpeed;
    b.face = -1;
    // her body is where she is painted: the scene draws her from (x + 40, y + 2)
    b.body = bossArtBox(b, 'boss-mother', b.x + 40, b.y + 2, false, 0.85);
    b.hurt.push(b.body);
    const ngp = this.save.ngp ? ['spout'] : [];
    const cycle = b.phase === 1 ? ['sweep', ...ngp, 'bubbles', 'sweep'] : b.phase === 2 ? ['sweep', 'rise', ...ngp, 'bubbles', 'sweep'] : ['sweep', 'lilies', 'bubbles', ...ngp, 'sweep', 'lilies'];
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
      // New Game+: the spouts. She rises up out of the lake and three whirlpools open on the floor, the first under the
      // lead; one after another each throws up a tall column of water
      case 'spoutTell': {
        // (the timer has already moved on by one step the first time a state runs, so the first step is b.t <= sp)
        if (b.t <= sp) {
          const x0 = clamp(lead.x, rr.x + 40, b.x - 120), dir = x0 > rr.x + 160 ? -1 : 1;
          b.arms = [0, 1, 2].map((i) => ({ x: clamp(x0 + dir * i * 72, rr.x + 30, b.x - 110), y: floor }));
          for (const a of b.arms) this.markers.push({ x: a.x, y: floor, t: b.dur + 60, kind: 'swirl' });
        }
        if (b.t > b.dur) { this.go('spout', 80); this.sfx('flood', b.x, b.y); }
        break;
      }
      case 'spout': {
        b.arms.forEach((a, i) => {
          const t0 = i * 18, u = b.t - t0;
          if (u >= 0 && u < 34) b.harm.push({ x: a.x - 13, y: rr.y + 30, w: 26, h: floor - rr.y - 30 });
          if (u >= 0 && u < sp) { this.emit({ k: 'shake', n: 4 }); this.sfx('splash', a.x, floor); }
        });
        if (b.t > b.dur) { b.arms = []; this.go('idle', 60); }
        break;
      }
      case 'riseTell': if (b.t > b.dur) { this.arenaWater = { row: 13, t: 420 }; this.sfx('flood', b.x, b.y); this.go('idle', 60); } break;
      case 'liliesTell': if (b.t <= sp) {
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
    if (this.saltLift && !this.saltLift.crossed) {
      const p = this.saltPrompt()!;
      const { x, y } = roomRect(this.room), lift = this.saltLift;
      return { room: this.room.id, x: x + p.x, y: y + (p.x === lift.plan.station ? lift.plan.low : lift.y) - 18 };
    }
    if (isOrchardRoom(this.room)) {
      const graft = this.nearGraft(144);
      if (graft && this.has(graft.ability)) return { room: this.room.id, x: graft.x, y: graft.y - 18 };
    }
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
      // (meeting Ukumari is behind the Lake Mother in the story; a save with her calm never needs to go back)
      [() => this.flag('keeper') || this.flag('boss:mother'), (t) => t.ch === 'U'],
      [() => this.flag('boss:mother'), (t, r) => t.ch === 'O' && r.boss === 'mother'],
      // the Windward Belfry
      [() => this.has('rope'), (t, r) => t.ch === 'A' && r.ability === 'rope'],
      [() => this.flag('boss:condor'), (t, r) => t.ch === 'O' && r.boss === 'condor'],
      [() => this.flag('boss:clappers'), (t, r) => t.ch === 'O' && r.boss === 'clappers'],
      [() => this.flag('boss:tune'), (t, r) => t.ch === 'O' && r.boss === 'tune'],
      // the Foundry Below
      [() => this.has('hammer'), (t, r) => t.ch === 'A' && r.ability === 'hammer'],
      [() => this.flag('boss:founder'), (t, r) => t.ch === 'O' && r.boss === 'founder'],
      [() => this.flag('boss:choir'), (t, r) => t.ch === 'O' && r.boss === 'choir'],
      [() => this.flag('boss:hollow'), (t, r) => t.ch === 'O' && r.boss === 'hollow'],
      [() => this.flag('salt:visited'), (t, r) => t.ch === '?' && r.id === 'fgate'],
      [() => this.has('ballast'), (t, r) => t.ch === 'A' && r.ability === 'ballast'],
      [() => this.has('catch'), (t, r) => t.ch === 'A' && r.ability === 'catch'],
      ...SALT_GUARDIANS.map((id): [() => boolean, (t: Thing, r: Room) => boolean] => [() => this.flag(`boss:${id}`), (t, r) => t.ch === 'O' && r.boss === id]),
      [() => this.flag('orchard:visited'), (t, r) => t.ch === ',' && r.id === ORCHARD_RETURN],
      [() => this.has('bloom'), (t, r) => t.ch === 'A' && r.ability === 'bloom'],
      [() => this.has('shear'), (t, r) => t.ch === 'A' && r.ability === 'shear'],
      ...ORCHARD_GUARDIANS.map((id): [() => boolean, (t: Thing, r: Room) => boolean] => [() => this.flag(`boss:${id}`), (t, r) => t.ch === 'O' && r.boss === id]),
      // the Glacier Stair, in the order of the climb
      [() => this.flag('glacier:visited'), (t, r) => t.ch === '(' && r.id === GLACIER_RETURN],
      [() => this.has('sunmirror'), (t, r) => t.ch === 'A' && r.ability === 'sunmirror'],
      [() => this.flag('boss:glass-vicuna'), (t, r) => t.ch === 'O' && r.boss === 'glass-vicuna'],
      [() => this.has('icepick'), (t, r) => t.ch === 'A' && r.ability === 'icepick'],
      [() => this.flag('boss:serac-osjollo'), (t, r) => t.ch === 'O' && r.boss === 'serac-osjollo'],
      [() => this.flag('boss:sun-gate'), (t, r) => t.ch === 'O' && r.boss === 'sun-gate'],
    ];
    if (ABILITY_ORDER.slice(0, 7).every((a) => this.has(a)) && this.restless().length) {
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
  /** The guided rope's picture (the helping hand, Dora only): in the air, the hook that will catch itself (it glows,
   *  with a faint rope to it); on the rope, where a jump would fly, the way held or faced. */
  ropeGuide: { hook: { x: number; y: number; far: boolean } | null; aim: RopeAim | null } = { hook: null, aim: null };
  updateRopeGuide(inp: Input) {
    const b = this.body, caps = this.caps();
    this.ropeGuide = { hook: null, aim: null };
    if (!caps.ropeAssist || this.lead !== 'dora') return;
    if (b.rope) {
      const dir = (inp.left !== inp.right ? (inp.left ? -1 : 1) : b.face) as 1 | -1;
      this.ropeGuide.aim = ropeAim(this.env, b, dir);
    } else if (!b.ground && !b.climb && !b.swim && !b.fly) this.ropeGuide.hook = nearHook(this.env, b);
  }
  /** Does the map show the Windward Belfry yet: once the Lake Mother is calm (Wayra will row then), or once the heroes
   *  have been there. Before that the maps keep it a secret. */
  /** Does the map show the Foundry Below yet: once its seal has cracked (the Out-of-Tune Bell calm), or once the heroes
   *  have been down there. */
  foundryKnown(): boolean { return this.flag('boss:tune') || FOUNDRY_ROOMS_SET.has(this.room.id) || this.save.seen.some((k) => CELLS.get(k)?.fd); }
  belfryKnown(): boolean { return this.flag('boss:mother') || this.flag('belfry:visited') || BELFRY_ROOMS_SET.has(this.room.id); }
  /** Wayra's boat on one shore, in world pixels. */
  boatAt(room: 'landing' | 'cliffoot'): { room: string; x: number; y: number } {
    const t = INFO.get(room)!.things.find((th) => th.ch === 'D')!;
    return { room, x: t.c * TILE + 8, y: t.r * TILE };
  }
  /** Where the maps mark the wisp's lead: the next goal, or Wayra's boat on this shore when the goal is across the
   *  water (as the wisp itself leads). */
  private saltPortalGoal(goal: { room: string; x: number; y: number }) {
    // the regions in a chain: the citadel (with the belfry and foundry), the Salt Road, the Night Orchard and the
    // Glacier Stair, each joined to the next by one door; across regions, the door out of this one towards the goal
    const region = (r: Room) => (isGlacierRoom(r) ? 3 : isOrchardRoom(r) ? 2 : r.salt ? 1 : 0);
    const here = region(this.room), there = region(roomById(goal.room));
    if (here === there) return goal;
    // [room, door] going up out of each region, and going down
    const up: [string, string][] = [['fgate', '?'], [ORCHARD_RETURN, ','], [GLACIER_RETURN, '(']];
    const down: [string, string][] = [['', ''], [SALT_GATE, '?'], [ORCHARD_GATE, ','], [GLACIER_GATE, '(']];
    const [id, ch] = there > here ? up[here] : down[here];
    const t = INFO.get(id)!.things.find((th) => th.ch === ch)!;
    return { room: id, x: t.c * TILE + 8, y: t.r * TILE };
  }

  mapGoal(): { room: string; x: number; y: number } | null {
    const echo = this.echoGuide();
    if (echo) return echo;
    const target = this.nextGoal();
    if (!target) return null;
    const goal = this.saltPortalGoal(target);
    const here = BELFRY_ROOMS_SET.has(this.room.id);
    return BELFRY_ROOMS_SET.has(goal.room) !== here ? this.boatAt(here ? 'cliffoot' : 'landing') : goal;
  }
  /** What the minimap's edge arrow points at, once the belfry is known. In the citadel: Wayra's boat, while the
   *  belfry still has rooms not seen or the next goal is over there. In the belfry: the nearest room not seen yet in
   *  the first area with any (the Cloudstair, then the Belfry Loft), or with everything seen, the boat back. */
  mapTarget(): { kind: 'boat' | 'area'; area?: string; x: number; y: number } | null {
    if (this.flag('boss:hollow')) {
      const goal = this.mapGoal();
      return goal ? { kind: 'area', area: roomById(goal.room).area, x: goal.x, y: goal.y } : null;
    }
    if (!this.belfryKnown()) return null;
    const seen = new Set(this.save.seen), here = BELFRY_ROOMS_SET.has(this.room.id);
    const unseen = (area: string) => ROOMS.filter((r) => r.area === area).flatMap((r) => {
      const out: { x: number; y: number }[] = [];
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (!seen.has(`${r.gx + x},${r.gy + y}`)) out.push({ x: (r.gx + x + 0.5) * COLS * TILE, y: (r.gy + y + 0.5) * ROWS * TILE });
      return out;
    });
    const goal = this.nextGoal();
    if (!here) {
      const left = BELFRY_AREAS.some((a) => unseen(a).length > 0);
      return left || (goal && BELFRY_ROOMS_SET.has(goal.room)) ? { kind: 'boat', ...this.boatAt('landing') } : null;
    }
    for (const area of BELFRY_AREAS) {
      const cells = unseen(area);
      if (!cells.length) continue;
      const b = this.body;
      cells.sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y));
      return { kind: 'area', area, ...cells[0] };
    }
    return { kind: 'boat', ...this.boatAt('cliffoot') };
  }
  /** Where the wisp should float: the goal itself when it is in this room, else the doorway towards it (a search over
   * rooms, skipping doorways behind doors that are shut). */
  wayToGoal(): { x: number; y: number } | null {
    const target = this.nextGoal();
    if (!target) return null;
    let goal = this.saltPortalGoal(target);
    // the belfry is across the water: first, Wayra's boat on this side
    if (BELFRY_ROOMS_SET.has(goal.room) !== BELFRY_ROOMS_SET.has(this.room.id)) {
      const boat = INFO.get(BELFRY_ROOMS_SET.has(this.room.id) ? 'cliffoot' : 'landing')!.things.find((t) => t.ch === 'D')!;
      goal = { room: boat.room, x: boat.c * TILE + 8, y: boat.r * TILE };
    }
    if (goal.room === this.room.id) return goal;
    // a door the heroes can open with what they have (walk into a dash door with the dash, raise the lantern at a
    // hatch, ring a bell seal) is a way through; only doors they can't open yet are shut
    const canOpen = (d: Group) => this.doorOpen(d) || (DOOR_ABILITY[d.ch] !== undefined && this.has(DOOR_ABILITY[d.ch]));
    const shut = (l: Link) => [l.from, l.to].some((id) => INFO.get(id)!.doors.some((d) => !canOpen(d) && l.c >= d.c - 2 && l.c <= d.c + d.w + 1 && l.r >= d.r - 1 && l.r <= d.r + d.h));
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
  wispOn() { return this.settings.assist && !this.settings.strict && this.settings.wisp !== false && (this.flag('glacier:visited') ? !this.flag('boss:sun-gate') : this.flag('orchard:visited') ? !this.flag('boss:graft-mother') : !this.flag('boss:tollkeeper')); }
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
    if (!b.ground || b.swim || b.climb || this.dialog || this.trial || !this.atShrine() || !this.litShrines().includes(this.room.id)) return false;
    if (this.boss && !this.boss.calm && this.boss.st !== 'wait') return false;
    return !this.enemies.some((e) => e.alive && !e.hidden && e.st !== 'sleep' && Math.hypot(e.x - b.x, e.y - b.y) < 80);
  }
  /** Why travel to a shrine can't happen now, or null if it can. Travel never heals: only resting does. */
  whyNotTravel(id: string): string | null {
    if (this.trial) return 'Not during an Echo Trial. Give it up first (Esc).';
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

  /** What has been found, out of everything (the citadel and the Windward Belfry); `base` counts the citadel alone,
   *  for the first epilogue. Worked out from the flags each time, so an old save's totals simply grow. */
  completion() {
    const C = COMPLETION;
    const tally = (exp: boolean | null) => {
      let chests = 0, peds = 0, murals = 0, cells = 0;
      for (const info of INFO.values()) {
        if (info.room.salt || isOrchardRoom(info.room) || isGlacierRoom(info.room) || exp !== null && !!info.room.exp !== exp) continue;
        for (const t of info.things) {
          if (t.ch === 'C' && this.flag(`chest:${info.room.id}:${t.i}`)) chests++;
          if (t.ch === 'A' && info.room.ability && this.has(info.room.ability)) peds++;
        }
        for (const n of info.room.murals ?? []) if (this.flag(`mural:${n}`)) murals++;
      }
      for (const k of this.save.seen) { const r = CELLS.get(k); if (r && !r.salt && !isOrchardRoom(r) && !isGlacierRoom(r) && (exp === null || !!r.exp === exp)) cells++; }
      return { cells, chests, peds, murals };
    };
    const all = tally(null), base = tally(false);
    const bosses = ALL_BOSSES.filter((id) => this.flag(`boss:${id}`)).length;
    const baseBosses = BASE_BOSSES.filter((id) => this.flag(`boss:${id}`)).length;
    // the citadel and the Windward Belfry, without the Foundry Below (for the second epilogue)
    const fd = { cells: 0, chests: 0, peds: 0, murals: 0 };
    for (const info of INFO.values()) {
      if (!info.room.fd) continue;
      for (const t of info.things) {
        if (t.ch === 'C' && this.flag(`chest:${info.room.id}:${t.i}`)) fd.chests++;
        if (t.ch === 'A' && info.room.ability && this.has(info.room.ability)) fd.peds++;
      }
      for (const n of info.room.murals ?? []) if (this.flag(`mural:${n}`)) fd.murals++;
    }
    for (const k of this.save.seen) { const r = CELLS.get(k); if (r?.fd) fd.cells++; }
    const belfBosses = BELFRY_BOSSES.filter((id) => this.flag(`boss:${id}`)).length, F = C.belfry;
    const fgot = all.cells - fd.cells + all.chests - fd.chests + all.peds - fd.peds + all.murals - fd.murals + belfBosses;
    const ftotal = F.cells + F.chests + F.pedestals + F.murals + F.bosses;
    const belfry = { cells: all.cells - fd.cells, chests: all.chests - fd.chests, peds: all.peds - fd.peds, murals: all.murals - fd.murals, bosses: belfBosses, got: fgot, total: ftotal, pct: Math.floor((fgot / ftotal) * 100) };
    const got = all.cells + all.chests + all.peds + all.murals + bosses, total = C.cells + C.chests + C.pedestals + C.murals + C.bosses;
    const bgot = base.cells + base.chests + base.peds + base.murals + baseBosses, B = C.base, btotal = B.cells + B.chests + B.pedestals + B.murals + B.bosses;
    let saltCells = 0, saltChests = 0;
    for (const cell of this.save.seen) if (CELLS.get(cell)?.salt) saltCells++;
    for (const info of INFO.values()) if (info.room.salt) for (const t of info.things) if (t.ch === 'C' && this.flag(`chest:${info.room.id}:${t.i}`)) saltChests++;
    const salt = { cells: saltCells, chests: saltChests, murals: 0, bosses: SALT_GUARDIANS.filter((id) => this.flag(`boss:${id}`)).length };
    const orchard = { cells: 0, chests: 0, murals: 0, bosses: ORCHARD_GUARDIANS.filter((id) => this.flag(`boss:${id}`)).length };
    for (const cell of this.save.seen) { const r = CELLS.get(cell); if (r && isOrchardRoom(r)) orchard.cells++; }
    for (const info of INFO.values()) if (isOrchardRoom(info.room)) {
      for (const t of info.things) if (t.ch === 'C' && this.flag(`chest:${info.room.id}:${t.i}`)) orchard.chests++;
      for (const n of info.room.murals ?? []) if (this.flag(`mural:${n}`)) orchard.murals++;
    }
    const glacier = { cells: 0, chests: 0, murals: 0, bosses: GLACIER_GUARDIANS.filter(id => this.flag(`boss:${id}`)).length };
    for (const cell of this.save.seen) { const r = CELLS.get(cell); if (r && isGlacierRoom(r)) glacier.cells++; }
    for (const info of INFO.values()) if (isGlacierRoom(info.room)) {
      for (const t of info.things) if (t.ch === 'C' && this.flag(`chest:${info.room.id}:${t.i}`)) glacier.chests++;
      for (const n of info.room.murals ?? []) if (this.flag(`mural:${n}`)) glacier.murals++;
    }
    // each expansion's share found: screens, chests, murals and guardians against its own totals
    const pctOf = (a: { cells: number; chests: number; murals: number; bosses: number }, of: { cells: number; chests: number; murals: number; bosses: number }) =>
      Math.floor(((a.cells + a.chests + a.murals + a.bosses) / (of.cells + of.chests + of.murals + of.bosses)) * 100);
    const areaPct = { salt: { ...salt, pct: pctOf(salt, C.salt) }, orchard: { ...orchard, pct: pctOf(orchard, C.orchard) }, glacier: { ...glacier, pct: pctOf(glacier, C.glacier) } };
    return { ...all, bosses, got, total, ...areaPct, pct: Math.floor((got / total) * 100), base: { ...base, bosses: baseBosses, got: bgot, total: btotal, pct: Math.floor((bgot / btotal) * 100) }, belfry };
  }

  /** A copy of the save for storing: the hero's place is the last shrine. During an Echo Trial it is the save as it
   *  was before the trial (nothing a trial does is kept but its best time). */
  snapshot(): Save { return JSON.parse(JSON.stringify(this.trial ? this.trial.back : this.save)); }

  // ─── the Echo Trials ─────────────────────────────────────────────────────
  /** Why the trials can't be run at all yet, or null once they are open. */
  trialsLocked(): string | null {
    return this.flag('boss:tune') ? null : 'Calm the Out-of-Tune Bell at the top of the Windward Belfry to open the Echo Trials.';
  }
  /** Why a trial can't start now, or null if it can. */
  whyNotTrial(id: string): string | null {
    const def = trialById(id);
    if (!def) return 'There is no such trial.';
    const locked = this.trialsLocked();
    if (locked) return locked;
    if (this.trial) return 'A trial is already running. Finish it or give it up first (Esc).';
    if (this.boss && !this.boss.calm && this.boss.st !== 'wait') return 'You can’t start a trial in the middle of a boss fight.';
    if (this.ended || this.dialog) return 'Not right now.';
    // (by the candle: standing, or just set down there at the end of a trial)
    const b = this.body, near = INFO.get(this.room.id)!.things.some((t) => t.ch === 'S' && Math.abs(t.c * TILE + 8 - b.x) < 30 && Math.abs((t.r + 1) * TILE - b.y) < 26);
    if (!near || b.climb || !this.litShrines().includes(this.room.id)) return 'Stand at a lit candle shrine to start a trial.';
    if (def.from && !this.litShrines().includes(def.from)) return `Light the ${SHRINE_NAMES[def.from]} first: this run starts there.`;
    if (def.id === 'rush:grand' && !this.flag('boss:hollow')) return 'The Grand Rush opens once the Hollow Bell is calm.';
    if (def.id === 'run:glass' && !this.has('resonance')) return 'The Glass Echo needs Enzo’s Resonance.';
    return null;
  }
  /** Start an Echo Trial from the shrine the heroes stand at. Both heroes start fresh, with the trial pantry, the
   *  water as it first was and the run's wind; afterwards the save comes back as it was, plus any best time. */
  startTrial(id: string): string | null {
    const why = this.whyNotTrial(id);
    if (why) return why;
    const def = trialById(id)!;
    const back = JSON.parse(JSON.stringify(this.save)) as Save;
    this.trial = { def, t: 0, i: 0, started: def.kind === 'rush', back, from: this.room.id, next: 0 };
    const base = freshSave();
    this.save.food = { ...TRIAL_FOOD }; this.save.water = { ...base.water }; this.save.wind = { ...(def.wind ?? base.wind) };
    this.save.drop = null;
    for (const h of ALL_HEROES) { const sv = this.save.heroes[h], st = this.stats(h); sv.down = false; sv.hp = st.maxHp; sv.mp = st.maxMp; this.hero[h] = this.newRt(); }
    this.boss = null; this.bossEntry = null; this.arenaWater = null; this.notes = []; this.planks.clear(); this.lanternUp = false;
    this.shots = []; this.waves = []; this.rings = []; this.markers = [];
    if (def.kind === 'rush') this.rushNext();
    else {
      const spot = this.shrineSpot(def.from!)!;
      Object.assign(this.body, newBody(spot.x, spot.y));
      this.enterRoom(roomOfPoint(spot.x, spot.y - 4)!, true);
      this.follower.x = spot.x - 24; this.follower.y = spot.y; this.trail = [];
      this.safe = { ...spot };
      this.note(`${def.name}: touch the ${def.goals.length} trial bells in order. The clock starts when you move.`, true);
    }
    this.sfx('chime'); this.emit({ k: 'trialStart', id });
    return null;
  }
  /** The Guardian Rush: into the next guardian's doorway. */
  rushNext() {
    const t = this.trial!, list = this.rushList(), id = list[t.i];
    this.fightBoss(id);
    this.note(`${t.i + 1} of ${list.length}: ${BOSSES[id].name}.`, true);
  }
  /** The guardians in this rush, in order (the Grand Rush has the foundry's three too). */
  rushList(): BossId[] { return this.trial?.def.id === 'rush:grand' ? GRAND_RUSH : RUSH; }
  /** A guardian in the rush is calm: one heal, a breath, and on to the next (or the end). */
  rushCalm(b: Boss) {
    const t = this.trial!;
    this.boss = null; this.bossEntry = null; this.arenaWater = null;
    this.planks.clear(); this.arenaWind = { dir: 1, str: 1 }; this.notes = [];
    t.i++;
    if (t.i >= this.rushList().length) { this.endTrial(true); return; }
    for (const h of ALL_HEROES) {
      const sv = this.save.heroes[h], st = this.stats(h);
      if (sv.down) { sv.down = false; sv.hp = 0; }
      sv.hp += Math.round(st.maxHp * RUSH_HEAL); sv.mp += Math.round(st.maxMp * RUSH_HEAL);
      this.clampHero(h);
    }
    this.sfx('shrine'); this.emit({ k: 'pulse', x: this.body.x, y: this.body.y - 20, r: 120, color: [1, 0.8, 0.5] });
    this.emit({ k: 'num', x: this.body.x, y: this.body.y - 30, n: Math.round(this.stats(this.lead).maxHp * RUSH_HEAL), kind: 'heal' });
    this.note(`${BOSSES[b.id].name} is calm. One heal, then ${BOSSES[this.rushList()[t.i]].name}.`, true);
    t.next = 100;
  }
  /** Each tick of a trial: the clock, the rush's pause between guardians, and a run's trial bells. */
  updateTrial(inp: Input) {
    const t = this.trial!;
    if (!t.started && (inp.left || inp.right || inp.jump || inp.dash || inp.up || inp.down)) t.started = true;
    if (t.started) t.t++;
    if (t.def.kind === 'rush') {
      if (t.next > 0 && --t.next === 0) this.rushNext();
      return;
    }
    const goal = t.def.goals[t.i];
    const p = this.trialBellAt(goal);
    if (overlap(this.leadRect(), { x: p.x - 12, y: p.y - 36, w: 24, h: 36 })) {
      t.i++;
      this.sfx('chime'); this.emit({ k: 'pulse', x: p.x, y: p.y - 18, r: 90, color: [0.6, 0.9, 1] });
      this.emit({ k: 'trialBell', id: t.def.id, n: t.i, of: t.def.goals.length, x: p.x, y: p.y });
      if (t.i >= t.def.goals.length) this.endTrial(true);
      else this.note(`Trial bell ${t.i} of ${t.def.goals.length}: ${trialSecs(t.t).toFixed(1)}s.`, true);
    }
  }
  /** Where a run's trial bell stands (world px: the middle of its tile, on the floor). */
  trialBellAt(goal: { room: string; c: number; r: number }) {
    const rm = roomById(goal.room);
    return { x: (rm.gx * COLS + goal.c) * TILE + 8, y: (rm.gy * ROWS + goal.r + 1) * TILE };
  }
  /** The trial is over: the save comes back as it was, with the best time kept, and the heroes stand at the shrine
   *  they started from. `won` false is a wipe or giving up. */
  endTrial(won: boolean, why = 'Given up.') {
    const t = this.trial;
    if (!t) return;
    const secs = trialSecs(t.t), id = t.def.id;
    const before = t.back.medals[id];
    const newBest = won && (before === undefined || secs < before);
    this.trial = null;
    this.save = t.back;
    if (newBest) this.save.medals[id] = secs;
    this.lead = this.save.lead; if (this.save.heroes[this.lead].down) this.lead = other(this.lead);
    for (const h of ALL_HEROES) this.hero[h] = this.newRt();
    this.boss = null; this.bossEntry = null; this.arenaWater = null; this.notes = []; this.planks.clear(); this.arenaWind = { dir: 1, str: 1 }; this.lanternUp = false;
    this.shots = []; this.waves = []; this.rings = []; this.markers = []; this.dialog = null;
    const spot = this.shrineSpot(t.from) ?? this.shrineSpot(this.save.shrine) ?? this.startSpot();
    Object.assign(this.body, newBody(spot.x, spot.y));
    this.enterRoom(roomOfPoint(spot.x, spot.y - 4)!, true);
    this.follower.x = spot.x - 24; this.follower.y = spot.y; this.trail = [];
    this.safe = { ...spot };
    const best = this.save.medals[id] ?? null, medal = won ? medalFor(t.def, secs) : null;
    this.sfx(won ? 'calm' : 'locked');
    this.note(won ? `${t.def.name}: ${secs.toFixed(1)}s${medal ? `, ${medal}` : ''}${newBest ? '. A new best!' : `. Best ${best!.toFixed(1)}s.`}` : `${t.def.name}: ${why} Back at the shrine.`, true);
    this.emit({ k: 'trial', id, won, secs, medal, best, newBest });
    this.emit({ k: 'save' });
  }
  /** Give up the trial being run (the pause menu). */
  quitTrial() { this.endTrial(false); }

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
  setWind(area: WindArea, dir: 1 | -1) { this.save.wind[area] = dir; }
  setWater(area: WaterArea, level: 0 | 1) { this.save.water[area] = level; const row = surfaceRow(this.room, this.save.water); if (row !== null) this.waterY.set(this.room.id, surfaceY(this.room, row)); else this.waterY.delete(this.room.id); this.floatCache = this.floatList(); }
  unlockMap() { for (const k of CELLS.keys()) if (!this.save.seen.includes(k)) this.save.seen.push(k); }
  setHp(hero: HeroId, hp: number) { const s = this.save.heroes[hero]; s.hp = hp; if (hp > 0) s.down = false; this.clampHero(hero); if (hp <= 0 && hero === this.lead) this.downLead(); else if (hp <= 0) s.down = true; }
  fightBoss(id: BossId) {
    const room = ROOMS.find((r) => r.boss === id)!;
    this.save.flags = this.save.flags.filter((f) => f !== `boss:${id}`);
    const entryC = id === 'frog' || id === 'clappers' || id === 'tune' || id === 'choir' ? (id === 'frog' ? 27 : 56) : id === 'condor' ? 3 : id === 'founder' ? 44 : id === 'hollow' ? 17 : 2;
    const entryR = id === 'condor' ? 11 : id === 'hollow' ? 7 : 14;
    this.teleport(room.id, entryC, entryR);
  }
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

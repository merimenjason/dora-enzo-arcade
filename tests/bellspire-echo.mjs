// The Sunken Bellspire: echo bells with the helping hand. A quiet echo bell asks to be rung ("↑ + V ring" for Enzo,
// "tag to Enzo to ring" for Dora), its notes last twice as long, and the wisp and the maps point at it when its notes
// are the way on. Strict keeps the notes' own time and no prompt or guide. Human-paced bots then climb every echo
// bell's notes (Enzo rings, Dora tags in and climbs) in both modes.
// Run from tests/bellspire.mjs (after compiling the engine into .checks/), or `--bots` for the table on its own.
import assert from 'node:assert/strict';
import { BellspireGame, freshSave, INFO, COLS, ROWS, TILE, NO_INPUT, BASE_ABILITIES, NOTE_LIFE, NOTE_ASSIST, roomById } from '../.checks/bellspire-game.js';
import { Graph, stateKey } from '../.checks/bellspire-nav.js';

const ASSIST = { assist: true, strict: false }, STRICT = { assist: false, strict: true };
const I = (o = {}) => ({ ...NO_INPUT, ...o });
const quiet = (g) => { g.dialog = null; g.enemies = []; };
const done = (extra = ['rope', 'echo']) => {
  const s = freshSave();
  s.abilities = [...BASE_ABILITIES, ...extra];
  s.spells = ['whirl', 'bolt', 'ember', 'chime'];
  s.flags.push('script:intro', 'script:firstDark', 'script:wayra', 'script:bell', 'keeper', 'boss:frog', 'boss:hydra', 'boss:puma', 'boss:warden', 'boss:mother', 'script:belfryCall', 'script:cliff', 'script:wind', 'script:echo', 'rang:echo');
  s.heroes.dora.level = s.heroes.enzo.level = 12;
  return s;
};
const world = (room, c, r) => { const rm = roomById(room); return { x: (rm.gx * COLS + c) * TILE + 8, y: (rm.gy * ROWS + r + 1) * TILE }; };
const bellOf = (room) => INFO.get(room).things.find((t) => t.ch === 'Q');
const game = (settings, room, c, r, seed = 3, lead = 'enzo') => {
  const g = new BellspireGame(done(), settings, seed);
  g.lead = lead; g.save.lead = lead; g.save.heroes.enzo.mp = 90;
  g.teleport(room, c, r); quiet(g);
  for (let i = 0; i < 4; i++) { g.step(I()); quiet(g); }
  return g;
};

/** Every echo bell's climb: where the notes lead (a stand spot, in room tiles), and how far from the bell a player
 *  starts. The louvres' notes lead on by the Bell Rope to the chest ledge. */
export const CLIMBS = [
  { room: 'cairns', to: [32, 4] },
  { room: 'loftbase', to: [31, 3] },
  { room: 'louvres', to: [2, 5] },
  { room: 'cogworks', to: [27, 6] },
];

const GRAPHS = new Map();
const navState = (g) => ({ abilities: [...g.save.abilities], water: { ...g.save.water }, wind: { ...g.save.wind }, keeper: g.flag('keeper'), calmed: g.save.flags.filter((f) => f.startsWith('boss:')).map((f) => f.slice(5)) });
/** Do one planned move for real, as the planner simulated it (a fresh press for each jump). */
function doMove(g, e) {
  const b = g.body, f = { x: b.x, y: b.y };
  g.step(I()); quiet(g);
  let air = false, landed = false, held = false;
  for (let t = 0; t < e.ticks; t++) {
    let inp = t < e.macro.max && !landed ? e.macro.input(t, g.body, f) : { dir: 0, jumpP: false, jumpH: false, dashP: false, up: false, down: false };
    if (landed && e.macro.name.startsWith('walk')) inp = { dir: 0, jumpP: false, jumpH: false, dashP: false, up: false, down: false };
    const jump = inp.jumpP ? !held : held && !!inp.jumpH;
    held = inp.jumpP ? !held : jump;
    if (inp.jumpP && !jump) { g.step(I({ left: inp.dir < 0, right: inp.dir > 0 })); quiet(g); held = true; }
    g.step(I({ left: inp.dir < 0, right: inp.dir > 0, up: inp.up, down: inp.down, jump: held, attack: !!inp.ropeP, dash: inp.dashP }));
    quiet(g);
    if (!g.body.ground) air = true; else if (air && !g.body.swim) landed = true;
  }
}

/**
 * A player at a human pace: as Enzo they walk up to the bell from a few tiles away, notice it (a 12 to 15 tick
 * reaction), ring it (↑ + V), tag to Dora a reaction later, then climb the notes the way the route planner would,
 * but hesitating before every move as a person does (a reaction plus a look round: 10 to 40 ticks, now and then a
 * second or more). The louvres' climb ends on the Bell Rope. First try only: dropping back to the floor, any hurt, or
 * the notes fading under her is a miss. (This measures the notes' time at a human pace, not jumping skill; the rope
 * bots in tests/bellspire-rope.mjs model sloppy jumps.)
 */
export function echoHuman(cl, seed, settings = ASSIST) {
  let rs = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
  const q = bellOf(cl.room), rm = roomById(cl.room);
  const qc = q.c - rm.gx * COLS, qr = q.r - rm.gy * ROWS;
  const path = rm.echoes[q.i];
  const side = path[0][0] > 0 ? -1 : 1; // start on the side away from the notes
  const g = game(settings, cl.room, qc + side * (2 + Math.floor(rnd() * 4)), qr, seed);
  const delay = 12 + Math.floor(rnd() * 4);
  const goal = world(cl.room, cl.to[0], cl.to[1]);
  const floorY = g.body.y, hp0 = g.leadSave.hp, t0 = g.tick;
  const assisted = settings.assist && !settings.strict;
  const idle = (n) => { for (let i = 0; i < n; i++) { g.step(I()); quiet(g); } };
  // walk up to the bell, notice it, ring it
  for (let i = 0; i < 200 && Math.abs(q.c * TILE + 8 - g.body.x) > 14 + rnd() * 8; i++) { const d = q.c * TILE + 8 - g.body.x; g.step(I({ left: d < 0, right: d > 0 })); quiet(g); }
  idle(delay);
  g.step(I({ up: true, cast: true })); g.step(I({ up: true })); quiet(g);
  // the notes appear; a reaction later, tag to Dora
  idle(delay + Math.floor(rnd() * 10));
  for (let i = 0; i < 60 && g.lead !== 'dora'; i++) { g.step(I({ tag: i % 2 === 0 })); quiet(g); }
  if (g.lead !== 'dora') return { ok: false, why: 'tag', t: g.tick - t0, delay };
  const st = navState(g), key = `${stateKey(st)}|${assisted}`;
  if (!GRAPHS.has(key)) GRAPHS.set(key, new Graph(st, assisted));
  const G = GRAPHS.get(key);
  let climbed = false;
  for (let tries = 0; tries < 6; tries++) {
    idle(delay);
    const from = G.nodeAt(g.body.x, g.body.y, false, g.body.climb);
    const plan = G.path(from, (n) => n.mode === 'ground' && Math.abs(n.x - goal.x) < 28 && n.y === goal.y, 20000);
    if (!plan) return { ok: false, why: 'no way', t: g.tick - t0, delay };
    let fromKey = from.key;
    for (const e of plan) {
      // a hesitation before each move: a reaction, a look round, sometimes longer
      idle(10 + Math.floor(rnd() * 30) + (rnd() < 0.15 ? 30 + Math.floor(rnd() * 40) : 0));
      // and lining up where the move starts, as a player shuffles to the edge they jump from
      const at = G.nodes.get(fromKey);
      for (let i = 0; i < 40 && g.body.ground && Math.abs(g.body.x - at.x) > 1.5; i++) {
        const d = at.x - g.body.x;
        g.step(I({ left: d < 0, right: d > 0 })); quiet(g);
        for (let k = 0; k < 6 && Math.abs(g.body.vx) > 0.05; k++) { g.step(I()); quiet(g); }
      }
      fromKey = e.to;
      const hp = g.leadSave.hp;
      doMove(g, e);
      if (g.leadSave.hp < hp || g.leadSave.hp < hp0) return { ok: false, why: 'hurt', t: g.tick - t0, delay };
      if (g.body.ground && Math.abs(g.body.y - floorY) > 4) climbed = true;
      if (climbed && g.body.ground && Math.abs(g.body.y - floorY) < 2) return { ok: false, why: 'fell', t: g.tick - t0, delay };
      if (g.body.ground && Math.abs(g.body.x - goal.x) < 28 && Math.abs(g.body.y - goal.y) < 2) return { ok: true, t: g.tick - t0, delay };
      const to = G.nodes.get(e.to);
      if (Math.abs(g.body.x - to.x) > 12 || Math.abs(g.body.y - to.y) > 4) break; // not where the move was meant to end: look again
    }
  }
  return { ok: false, why: 'time', t: g.tick - t0, delay };
}

export function echoBots(seeds = 24, log = console.log) {
  const out = {};
  for (const [label, settings] of [['assist', ASSIST], ['strict', STRICT]]) for (const cl of CLIMBS) {
    let wins = 0, ticks = 0;
    const why = {};
    for (let s = 1; s <= seeds; s++) {
      const r = echoHuman(cl, s * 7919, settings);
      if (r.ok) { wins++; ticks += r.t; } else why[r.why] = (why[r.why] ?? 0) + 1;
    }
    out[`${label}:${cl.room}`] = wins / seeds;
    log(`echo bot ${label.padEnd(6)} ${cl.room.padEnd(9)} ${wins}/${seeds} first try (${Math.round((wins / seeds) * 100)}%), ${wins ? (ticks / wins / 60).toFixed(1) : '-'} s from the bell${Object.keys(why).length ? `, missed: ${Object.entries(why).map(([k, v]) => `${v} ${k}`).join(', ')}` : ''}`);
  }
  return out;
}

export default function echo() {
  let checks = 0;
  const ok = (c, m) => { assert.ok(c, m); checks++; };
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
  const q = bellOf('cairns'), rm = roomById('cairns'), qc = q.c - rm.gx * COLS;

  // ─── the notes' time ────────────────────────────────────────────────────────
  for (const [label, s, mul] of [['assist', ASSIST, NOTE_ASSIST], ['strict', STRICT, 1]]) {
    const g = game(s, 'cairns', qc + 2, 13);
    g.step(I({ up: true, cast: true })); for (let i = 0; i < 20; i++) { g.step(I()); quiet(g); }
    const life = g.notes[0]?.life;
    eq(life, NOTE_LIFE * mul, `${label}: the first note lasts ${(NOTE_LIFE * mul / 60).toFixed(0)} seconds`);
  }
  ok(NOTE_ASSIST >= 2, 'with the helping hand, at least twice as long');
  {
    const g = game(ASSIST, 'cairns', qc + 2, 13);
    g.save.gear.push('carillon-staff'); g.equip('enzo', 'weapon', 'carillon-staff');
    g.step(I({ up: true, cast: true })); for (let i = 0; i < 20; i++) { g.step(I()); quiet(g); }
    eq(g.notes[0].life, NOTE_LIFE * 2 * NOTE_ASSIST, 'and the Carillon Staff still doubles that');
  }

  // ─── the prompt ─────────────────────────────────────────────────────────────
  {
    const g = game(ASSIST, 'cairns', qc + 2, 13);
    eq(g.echoHint(), 'ring', 'Enzo by a quiet echo bell: “↑ + V ring”');
    eq(g.echoNear()?.ch, 'Q', 'and it is the bell close by');
    const d = game(ASSIST, 'cairns', qc + 2, 13, 3, 'dora');
    eq(d.echoHint(), 'tag', 'Dora by one: “tag to Enzo to ring”');
    d.save.heroes.enzo.down = true;
    eq(d.echoHint(), null, 'not with Enzo knocked out');
    const far = game(ASSIST, 'cairns', qc + 12, 13);
    eq(far.echoHint(), null, 'nothing from across the room');
    g.step(I({ up: true, cast: true })); for (let i = 0; i < 20; i++) { g.step(I()); quiet(g); }
    eq(g.echoHint(), null, 'nor while its notes hang in the air');
    const st = game(STRICT, 'cairns', qc + 2, 13);
    eq([st.echoNear(), st.echoHint()], [null, null], 'Strict: no prompt');
    const no = new BellspireGame(done(['rope']), ASSIST, 3); no.lead = 'enzo'; no.teleport('cairns', qc + 2, 13); quiet(no); no.step(I());
    eq(no.echoHint(), null, 'nor before the Echo Step');
  }

  // ─── the guide ──────────────────────────────────────────────────────────────
  {
    // the cairns' shelf (its chest) is the goal: the wisp and the maps point at the bell until its notes are up
    const g = game(ASSIST, 'cairns', qc + 6, 13);
    const chest = INFO.get('cairns').things.find((t) => t.ch === 'C');
    g.nextGoal = () => ({ room: 'cairns', x: chest.c * TILE + 8, y: chest.r * TILE });
    const bell = { room: 'cairns', x: q.c * TILE + 8, y: q.r * TILE };
    eq(g.echoGuide(), bell, 'the way on is up the notes: the guide points at the echo bell');
    eq(g.mapGoal(), bell, 'so do the maps');
    eq(g.wispGoal(g), bell, 'and the wisp');
    g.lead = 'enzo';
    for (let i = 0; i < 80; i++) { g.step(I({ left: true })); quiet(g); if (Math.abs(g.body.x - bell.x) < 12) break; }
    g.step(I({ up: true, cast: true })); for (let i = 0; i < 20; i++) { g.step(I()); quiet(g); }
    for (let i = 0; i < 30; i++) { g.step(I()); quiet(g); }
    eq(g.echoGuide(), null, 'once its notes are up, the guide leads on up them');
    const st = game(STRICT, 'cairns', qc + 6, 13);
    st.nextGoal = g.nextGoal;
    eq(st.echoGuide(), null, 'Strict: no guide to the bell');
    // a goal level with the heroes doesn't need the notes
    const lv = game(ASSIST, 'cairns', qc + 6, 13);
    lv.nextGoal = () => ({ room: 'cairns', x: (rm.gx * COLS + 50) * TILE + 8, y: (rm.gy * ROWS + 13) * TILE });
    eq(lv.echoGuide(), null, 'a goal on the floor needs no bell');
    // the loft's foot: the hatch up the notes
    const lb = roomById('loftbase'), lq = bellOf('loftbase');
    const g2 = game(ASSIST, 'loftbase', lq.c - lb.gx * COLS + 3, 13);
    g2.nextGoal = () => ({ room: 'bellshaft', x: 0, y: 0 });
    const way = g2.wayToGoal();
    ok(way && way.y < g2.body.y - 4 * TILE, 'from the loft’s foot, the way to the bell shaft is up through the hatch');
    eq(g2.echoGuide(), { room: 'loftbase', x: lq.c * TILE + 8, y: lq.r * TILE }, 'so the guide points at the loft’s echo bell');
  }

  // ─── the bots ───────────────────────────────────────────────────────────────
  const rates = echoBots(24, () => {});
  for (const cl of CLIMBS) ok(rates[`assist:${cl.room}`] >= 0.95, `with the helping hand, a human-paced player climbs the ${cl.room}’s echo notes first try in ${Math.round(rates[`assist:${cl.room}`] * 100)}% of 24 seeds (needs 95%)`);
  return checks;
}

if (process.argv[1]?.endsWith('bellspire-echo.mjs')) {
  const seeds = Number(process.argv.find((a) => a.startsWith('--seeds='))?.slice(8) ?? 24);
  const one = process.argv.find((a) => a.startsWith('--trace='))?.slice(8);
  if (one) { const [room, seed, mode] = one.split(':'); console.log(echoHuman(CLIMBS.find((c) => c.room === room), +seed * 7919, mode === 'strict' ? STRICT : ASSIST)); }
  else if (process.argv.includes('--bots')) echoBots(seeds);
  else console.log(`bellspire echo: ${echo()} checks passed`);
}

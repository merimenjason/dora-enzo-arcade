// The Sunken Bellspire bots. Two kinds:
//  * boss bots that play like people: they see the boss 12-15 ticks late (a human's reaction time), fumble now and then,
//    and only use what a player at that point of the game would have (levels, abilities, gear). A "casual" bot plays
//    with the helping hand on; a "pro" bot plays with it off. Target: casual wins each boss within three tries in at
//    least 85% of seeds, pro in at least 70%.
//  * a route bot that plays the whole game from a new game with the route planner (lib/bellspire-nav.ts), in the
//    real engine with enemies, doors, bells and the lantern, to prove the game can be finished: the citadel to the
//    Lake Mother, then Keep exploring, Wayra's boat and the Windward Belfry to the Out-of-Tune Bell (the wind bells,
//    the Bell Rope and the echo notes done for real), then back across and down the seal into the Foundry Below to
//    the Hollow Bell (molten bronze cooled, slag waited out, glass slammed, beam doors and crystal bridges rung, all
//    for real). It plays the belfry a second time from the finished citadel save, loaded as the title's Continue
//    loads it.
// Then the Echo Trials' and New Game+'s bots (tests/bellspire-trials-bot.mjs).
// Run after compiling the engine into .checks/. `--quick` runs fewer seeds.
import assert from 'node:assert/strict';
import { BellspireGame, freshSave, parseSave, trialById, BOSSES, TILE, HERO_W, HERO_H, ROOMS, INFO, ABILITY_ORDER, roomById, roomRect, groupAt, rawChar, isBelfryRoom, NOTE_LIFE, WIND_AREAS, SCRIPTS, MURALS, COLS, ROWS, channelAt, isFoundryRoom, CHANNELS, VENT_P } from '../.checks/bellspire-game.js';
import { Graph, stateKey, nodeRoom, NOTES } from '../.checks/bellspire-nav.js';

const QUICK = process.argv.includes('--quick');
const ONLY = process.argv.find((a) => a.startsWith('--boss='))?.slice(7);
const VERBOSE = process.argv.includes('--verbose');

// ─── what a player has when they reach each boss: the route bot's levels on the shortest way through, so a player who
// explores more arrives stronger than this ────────────────────────────────
const PRESET = {
  frog: { level: 2, abilities: ['dash'], hearts: 0, drops: 0, gear: [], spells: [] },
  hydra: { level: 4, abilities: ['dash', 'lantern', 'double'], hearts: 1, drops: 0, gear: ['reed-ring'], spells: [] },
  puma: { level: 6, abilities: ['dash', 'lantern', 'double', 'wallkick'], hearts: 2, drops: 0, gear: ['reed-ring'], spells: ['ember'] },
  warden: { level: 7, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime'], hearts: 2, drops: 1, gear: ['reed-ring', 'puma-tooth'], spells: ['ember', 'chime'] },
  mother: { level: 9, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep'], hearts: 3, drops: 1, gear: ['reed-ring', 'reed-cutter', 'puma-tooth'], spells: ['ember', 'chime'] },
  // the Windward Belfry: after the Lake Mother, on the shortest way up the mountain
  condor: { level: 10, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope'], hearts: 4, drops: 1, gear: ['reed-ring', 'moonsteel', 'puma-tooth', 'windward-jacket'], spells: ['ember', 'chime'] },
  clappers: { level: 11, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope', 'echo'], hearts: 4, drops: 1, gear: ['reed-ring', 'moonsteel', 'puma-tooth', 'windward-jacket', 'star-lamp'], spells: ['ember', 'chime', 'frost'] },
  tune: { level: 12, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope', 'echo'], hearts: 5, drops: 2, gear: ['reed-ring', 'moonsteel', 'puma-tooth', 'windward-jacket', 'condor-talon', 'star-lamp'], spells: ['ember', 'chime', 'frost', 'gale'], flags: ['boss:condor', 'boss:clappers'] },
  // the Foundry Below: after the Out-of-Tune Bell, on the shortest way down
  founder: { level: 13, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope', 'echo', 'hammer'], hearts: 5, drops: 2, gear: ['reed-ring', 'moonsteel', 'puma-tooth', 'windward-jacket', 'condor-talon', 'star-lamp'], spells: ['ember', 'chime', 'frost', 'gale'], flags: ['boss:condor', 'boss:clappers', 'boss:tune'] },
  choir: { level: 14, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope', 'echo', 'hammer', 'resonance'], hearts: 6, drops: 2, gear: ['reed-ring', 'moonsteel', 'puma-tooth', 'windward-jacket', 'condor-talon', 'star-lamp'], spells: ['ember', 'chime', 'frost', 'gale'], flags: ['boss:condor', 'boss:clappers', 'boss:tune', 'boss:founder'] },
  hollow: { level: 15, abilities: ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope', 'echo', 'hammer', 'resonance'], hearts: 6, drops: 3, gear: ['reed-ring', 'moonsteel', 'puma-tooth', 'windward-jacket', 'condor-talon', 'star-lamp', 'ladle-staff'], spells: ['ember', 'chime', 'frost', 'gale'], flags: ['boss:condor', 'boss:clappers', 'boss:tune', 'boss:founder', 'boss:choir'] },
};

/** New Game+: each guardian with the abilities of that point of the story again, but the levels, gear and spells
 *  (bar the Bell Chime, which comes back with its pedestal) of a finished game, and the tougher guardians. */
export function ngpPresetSave(id) {
  // (the foundry's guardians: a party that has finished the foundry too)
  const end = ['founder', 'choir', 'hollow'].includes(id) ? PRESET.hollow : PRESET.tune, p = PRESET[id];
  return presetSave(id, { level: end.level, gear: end.gear, spells: end.spells.filter((sp) => sp !== 'chime' || p.abilities.includes('chime')), ngp: 1 });
}

export function presetSave(id, over = {}) {
  const p = { ...PRESET[id], ...over }, s = freshSave();
  if (over.ngp) s.ngp = over.ngp;
  s.abilities = [...p.abilities]; s.hearts = p.hearts; s.drops = p.drops;
  for (const g of p.gear) if (!s.gear.includes(g)) s.gear.push(g);
  for (const sp of p.spells) if (!s.spells.includes(sp)) s.spells.push(sp);
  for (const h of ['dora', 'enzo']) s.heroes[h].level = p.level;
  s.food = { cake: 3, tea: 1 };
  s.flags.push('script:intro', ...(p.flags ?? []));
  const g = new BellspireGame(s, {}, 1);
  for (const id2 of p.gear) {
    const def = g.save.gear.includes(id2) && (id2 in { 'reed-cutter': 1, moonsteel: 1, 'condor-talon': 1 }) ? 'dora' : null;
    if (def) g.equip('dora', 'weapon', id2);
  }
  if (p.gear.includes('reed-coat')) g.equip('dora', 'coat', 'reed-coat');
  if (p.gear.includes('windward-jacket')) g.equip('dora', 'coat', 'windward-jacket');
  if (p.gear.includes('star-lamp')) g.equip('enzo', 'weapon', 'star-lamp');
  if (p.gear.includes('reed-ring')) g.equip('dora', 'ring', 'reed-ring');
  if (p.gear.includes('puma-tooth')) g.equip('dora', 'relic', 'puma-tooth');
  for (const h of ['dora', 'enzo']) { const st = g.stats(h); g.save.heroes[h].hp = st.maxHp; g.save.heroes[h].mp = st.maxMp; }
  return g.snapshot();
}

const rectDist = (x, y, r) => Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.w)), Math.max(r.y - y, 0, y - (r.y + r.h)));
const NO = { left: false, right: false, up: false, down: false, jump: false, attack: false, dash: false, cast: false, tag: false };

/** A human-paced boss player. */
export function bossBot(id, seed, { assist = true, delay = 13, noise = 0.08, ngp = false } = {}) {
  const g = new BellspireGame(ngp ? ngpPresetSave(id) : presetSave(id), { assist, strict: !assist }, seed);
  g.fightBoss(id);
  let rs = seed * 9301 + 49297;
  const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
  const seen = []; // what the boss looked like, `delay` ticks ago
  let low = 1;
  let tries = 1, wiped = false, tick = 0, prev = NO, hold = 0, jumpHold = 0, ate = 0, lastDecision = NO, react = 0, move = null, moveT = 0;
  const maxTicks = 60 * 60 * 6;
  while (!g.flag(`boss:${id}`) && tick < maxTicks && tries <= 3) {
    tick++;
    for (const e of g.drainEvents()) if (e.k === 'wipe') { tries++; wiped = true; }
    if (tries > 3) break;
    if (g.dialog) { g.step({ ...NO, jump: tick % 2 === 0 }); continue; }
    const b = g.boss;
    seen.push(b ? {
      id: b.id, st: b.st, tell: b.tellT > 0, harm: b.harm.map((r) => ({ ...r })), hurt: b.hurt.map((r) => ({ ...r })), body: { ...b.body }, x: b.x, y: b.y, calm: b.calm,
      shots: g.shots.filter((s) => !s.friendly).map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, g: s.g, kind: s.kind })),
      waves: g.waves.map((w) => ({ x: w.x, dir: w.dir, speed: w.speed, h: w.h })), rings: g.rings.filter((r) => !r.friendly).map((r) => ({ ...r })),
      markers: g.markers.map((m) => ({ ...m })), heads: b.heads.map((h) => ({ st: h.st, x: h.x })), ...fdView(b),
    } : null);
    if (seen.length > delay + 2) seen.shift();
    const v = seen[Math.max(0, seen.length - 1 - delay)];
    // a person keeps doing the same thing for a few ticks
    let inp = lastDecision;
    if (move) {
      const m = move(moveT++, g);
      if (m) { g.step(m); prev = m; continue; }
      move = null; react = 0;
    }
    if (--react <= 0) {
      react = 3 + Math.floor(rnd() * 4);
      inp = decide(g, v, rnd, noise);
      lastDecision = inp;
      if (inp.run) { move = inp.run; moveT = 0; lastDecision = NO; continue; }
    }
    // jumps are held for a while, then released
    if (inp.jump && !prev.jump) jumpHold = 16;
    const out = { ...inp };
    if (jumpHold > 0) { out.jump = true; jumpHold--; } else if (prev.jump && inp.jump) out.jump = false;
    if (out.attack && prev.attack) out.attack = false;
    if (out.tag && prev.tag) out.tag = false;
    // eat a quinoa cake when low, like a careful player would (from the menu)
    if (g.leadSave.hp < g.stats(g.lead).maxHp * 0.3 && g.save.food.cake > 0 && tick - ate > 300) { g.eat('cake'); ate = tick; }
    g.step(out);
    { const f = (g.save.heroes.dora.hp + g.save.heroes.enzo.hp) / (g.stats('dora').maxHp + g.stats('enzo').maxHp); if (f < low) low = f; }
    prev = out; void hold;
  }
  void wiped;
  return { won: g.flag(`boss:${id}`), tries: Math.min(tries, 4), ticks: tick, low };
}

/** What a player sees of the Foundry Below's guardians: the Founder's frost spots, the choir's song (the helping hand
 *  numbers it; without it a player has heard it), the Hollow Bell's form and its lava. */
export const fdView = (b) => ({ spots: b.spots?.map((p) => ({ ...p })), song: b.song ? [...b.song] : undefined, sung: b.sung, form: b.form, lava: b.lava });
export function decide(g, v, rnd, noise) {
  const fd = v && (v.id === 'founder' || v.id === 'choir' || v.id === 'hollow') ? decideFoundry(g, v, rnd, noise) : null;
  if (fd) return fd;
  const out = decide0(g, v, rnd, noise);
  // a clapper's swing skims over a standing hero: keep fighting, but don't jump into it
  if (v?.id === 'clappers' && v.heads.some((h) => h.st === 'swing') && !v.waves.length) out.jump = false;
  return out;
}
/** The Foundry Below's guardians: the dodging is decide0's; what to hit (and how) is their own. Returns null to leave
 *  it to decide0 (with `v.hurt` narrowed to what is worth hitting). */
function decideFoundry(g, v, rnd, noise) {
  const b = g.body, other = g.lead === 'dora' ? 'enzo' : 'dora';
  if (v.st === 'wait' || v.st === 'intro' || v.calm) return null;
  const canTag = !g.save.heroes[other].down && g.tagCd === 0;
  if (v.id === 'founder') {
    // Enzo frosts it (a Frost Fan from the air), then a blade where it is frosted; Enzo's staff does fine on the spots
    const spots = (v.spots ?? []).filter((p) => p.t > 40);
    if (g.save.heroes.enzo.down) return null;
    if (!spots.length) {
      if (g.lead !== 'enzo') { if (canTag) return { ...NO, tag: true }; return null; }
      const c = v.body.x + v.body.w / 2, d = Math.abs(c - b.x);
      // from a little way off: jump, and fan the frost forward and down onto it
      const inp = { ...NO };
      if (d < 50) { if (c > b.x) inp.left = true; else inp.right = true; return inp; }
      if (d > 110) { if (c > b.x) inp.right = true; else inp.left = true; return inp; }
      if ((c > b.x) !== (b.face > 0)) { if (c > b.x) inp.right = true; else inp.left = true; return inp; }
      if (g.leadSave.mp < 6 && g.save.food.tea > 0) g.eat('tea');
      if (b.ground) inp.jump = true; else if (b.vy < -1.5) { inp.cast = true; inp.jump = true; }
      return inp;
    }
    v = { ...v, hurt: spots.map((p) => ({ x: v.x + p.dx - 6, y: v.y + p.dy - 6, w: 12, h: 12 })) };
    if (g.lead === 'enzo' && canTag && g.save.heroes.dora.hp > g.stats('dora').maxHp * 0.5 && rnd() < 0.3) return { ...NO, tag: true };
    return decide0(g, v, rnd, noise);
  }
  if (v.id === 'choir') {
    // while it sings, stand back; while it listens, strike the singer whose note comes next; stunned, strike anything
    if (v.st === 'sing' || v.st === 'singTell' || v.st === 'rest' || v.st === 'shardsTell' || v.st === 'shards2') return decide0(g, { ...v, hurt: [], tell: true }, rnd, noise);
    if (v.st === 'listen' && v.song) {
      const want = v.song[v.sung ?? 0];
      const h = v.hurt.find((r) => r.part === want);
      if (h) return decide0(g, { ...v, hurt: [h], tell: false }, rnd, noise);
    }
    return decide0(g, { ...v, tell: false }, rnd, noise);
  }
  if (v.id === 'hollow' && v.form === 1 && v.st !== 'crack' && !g.save.heroes.dora.down) {
    // its shell: Dora slams its crown, from the inner end of a ledge (jump, jump again, dash over it, ↓ + attack).
    // Out on the ledge's far end, nothing of the first form reaches
    const rr = roomRect(g.room), ledge = rr.y + 8 * TILE, side = b.x < rr.x + rr.w / 2 ? -1 : 1;
    const edge = side < 0 ? rr.x + 21 * TILE - 4 : rr.x + 38 * TILE + 4, safe = side < 0 ? rr.x + 16 * TILE : rr.x + 43 * TILE;
    const onLedge = b.ground && Math.abs(b.y - ledge) < 3;
    const toward = (x) => ({ ...NO, left: x < b.x - 2, right: x > b.x + 2 });
    if (!onLedge) return toLedge(g, rr);
    if (v.st === 'swing' || v.st === 'swingTell') return toward(safe);
    if (g.lead !== 'dora') return canTag ? { ...NO, tag: true } : toward(safe);
    if (Math.abs(b.x - edge) > 3) return toward(edge);
    if (!['idle', 'toll', 'blanks', 'tollTell', 'blanksTell'].includes(v.st) || Math.abs(v.x - (rr.x + rr.w / 2)) > 40) return { ...NO };
    if (rnd() < noise) return { ...NO };
    let slammed = false;
    return { ...NO, run: (t, gg) => {
      const h = gg.body, B = gg.boss?.body;
      if (!B || t > 150 || (t > 30 && h.ground)) return null;
      const inp = { ...NO, right: h.x < B.x + B.w / 2 - 4, left: h.x > B.x + B.w / 2 + 4 };
      if (t < 14 || (t >= 18 && t < 30)) inp.jump = true;
      if (t === 22) inp.dash = true;
      if (!slammed && t > 18 && h.y < B.y + 10 && h.x > B.x + 2 && h.x < B.x + B.w - 2) { inp.down = inp.attack = true; slammed = true; }
      else if (slammed) { inp.down = true; inp.left = inp.right = false; }
      return inp;
    } };
  }
  if (v.id === 'hollow') {
    // keep to the stone (and up on the ledges while the lava is high); its heart: Enzo's chime holds it still
    const rr = roomRect(g.room), stone = rr.y + 12 * TILE, ledge = rr.y + 8 * TILE;
    const high = v.lava !== undefined && v.lava < stone - 2;
    const platforms = high ? [[13, 21, ledge], [38, 46, ledge]] : [[3, 12, stone], [24, 35, stone], [47, 56, stone], [13, 21, ledge], [38, 46, ledge]];
    const onPlat = (x, y) => platforms.find(([c0, c1, py]) => Math.abs(y - py) < 3 && x >= rr.x + c0 * TILE + 4 && x <= rr.x + (c1 + 1) * TILE - 4);
    const here = b.ground ? onPlat(b.x, b.y) : null;
    if (b.ground && !here) {
      // somewhere unsafe: to the nearest safe stone (up onto a ledge by jumping toward it)
      let best = null, bd = 1e9;
      for (const p of platforms) { const x = clamp(b.x, rr.x + p[0] * TILE + 12, rr.x + (p[1] + 1) * TILE - 12), d = Math.abs(x - b.x) + Math.abs(p[2] - b.y); if (d < bd) { bd = d; best = { x, y: p[2] }; } }
      const inp = { ...NO, left: best.x < b.x, right: best.x > b.x };
      if (best.y < b.y - 4) inp.jump = true;
      return inp;
    }
    if (v.form === 2 && g.has('resonance') && v.st !== 'stun' && Math.hypot(v.x - b.x, v.y - 50 - b.y) < 140) {
      if (g.lead !== 'enzo') { if (canTag && g.save.heroes.enzo.hp > g.stats('enzo').maxHp * 0.4) return { ...NO, tag: true }; }
      else if (g.leadSave.mp >= 6 && rnd() < 0.3) return { ...NO, up: true, cast: true };
    }
    const out = decide0(g, v, rnd, noise);
    // never walk off the stone into the pit: hold at the edge (a jump across is only to another stone)
    if (b.ground && here && (out.left || out.right)) {
      const nx = b.x + (out.right ? 10 : -10);
      if (!onPlat(nx, b.y)) { out.left = out.right = false; }
    }
    if (high && out.jump && !here) out.jump = true;
    return out;
  }
  return null;
}
const clamp = (v, a, c) => Math.max(a, Math.min(c, v));
/** In the Hollow Bell's pit: up onto a ledge (from a stone's end nearest one, a jump toward it; off a wall, a kick). */
function toLedge(g, rr) {
  const b = g.body, X = (c) => rr.x + c * TILE;
  const side = b.x < rr.x + rr.w / 2 ? -1 : 1, mid = side < 0 ? X(17.5) : X(42.5);
  const dirTo = (x) => (x < b.x ? { left: true } : { right: true });
  if (b.wall) return { ...NO, jump: true, ...dirTo(mid) };
  // in the air: the second jump at the top of the first, if still below the ledge
  if (!b.ground) return { ...NO, ...dirTo(mid), jump: b.vy > -0.5 && b.y > rr.y + 8 * TILE - 2 };
  // which stone: its end toward the ledge
  const c = (b.x - rr.x) / TILE;
  const [edge, dir] = c < 13 ? [X(12.4), 1] : c > 46 ? [X(47.6), -1] : side < 0 ? [X(24.6), -1] : [X(35.4), 1];
  if (Math.abs(b.x - edge) > 4) return { ...NO, ...dirTo(edge) };
  return { ...NO, jump: true, ...(dir > 0 ? { right: true } : { left: true }) };
}
function decide0(g, v, rnd, noise) {
  const inp = { ...NO };
  const b = g.body;
  const me = { x: b.x, y: b.y - HERO_H / 2 };
  if (!v) { inp.right = true; return inp; }
  if (v.st === 'wait' || v.st === 'intro') { const c = v.body.x + v.body.w / 2; if (Math.abs(c - b.x) > 140) { if (c > b.x) inp.right = true; else inp.left = true; } return inp; }
  if (rnd() < noise) { if (rnd() < 0.5) inp.left = true; else inp.right = true; return inp; }
  // switch to the healthier hero when low
  const other = g.lead === 'dora' ? 'enzo' : 'dora';
  if (g.leadSave.hp < g.stats(g.lead).maxHp * 0.35 && !g.save.heroes[other].down && g.save.heroes[other].hp > g.stats(other).maxHp * 0.5 && g.tagCd === 0) { inp.tag = true; return inp; }
  const away = (x) => { if (x > b.x) inp.left = true; else inp.right = true; };
  // floor shockwaves: jump them
  for (const w of v.waves) {
    const d = (b.x - w.x) * w.dir;
    if (d > 0 && d < 34 + w.speed * 4 && b.ground) { inp.jump = true; return inp; }
  }
  // falling things: get out from under them
  for (const s of v.shots) {
    if (s.vy > -10) {
      // where will it cross my height?
      let x = s.x, y = s.y, vy = s.vy;
      for (let t = 0; t < 90 && y < b.y - 4; t++) { vy += s.g; x += s.vx; y += vy; }
      if (Math.abs(x - b.x) < 22 && y >= b.y - 20) { away(x); if (Math.abs(x - b.x) < 10 && b.ground && rnd() < 0.3) inp.dash = true; return inp; }
    }
  }
  // the hydra's seed rain (New Game+): seeds fall everywhere but one gap, so head for the gap and wait in it
  const seeds = v.markers.filter((m) => m.kind === 'seed').map((m) => m.x).sort((a, c) => a - c);
  if (seeds.length > 4) {
    let gx = b.x, gw = 0;
    for (let i = 1; i < seeds.length; i++) if (seeds[i] - seeds[i - 1] > gw) { gw = seeds[i] - seeds[i - 1]; gx = (seeds[i] + seeds[i - 1]) / 2; }
    if (Math.abs(gx - b.x) > 6) { if (gx > b.x) inp.right = true; else inp.left = true; if (Math.abs(gx - b.x) > 60 && g.has('dash') && g.lead === 'dora' && b.ground && rnd() < 0.2) inp.dash = true; }
    return inp;
  }
  for (const m of v.markers) if (Math.abs(m.x - b.x) < (m.kind === 'shadow' ? 46 : m.kind === 'aim' || m.kind === 'swirl' ? 34 : 28)) { away(m.x); if (m.kind === 'aim' && g.has('dash') && g.lead === 'dora' && m.t < 12) inp.dash = true; return inp; }
  for (const r of v.rings) if (Math.abs(Math.hypot(r.x - b.x, r.y - me.y) - r.r) < 30) { away(r.x); return inp; }
  // the Out-of-Tune Bell's swing skims over a standing hero: stay down and wait
  if (v.id === 'tune' && v.st === 'swing') return inp;

  // active attacks: keep clear, and jump a low sweep or tongue
  for (const h of v.harm) {
    const d = rectDist(b.x, me.y, h);
    if (d < 40) {
      if (h.h < 26 && h.y > b.y - 30 && b.ground) { inp.jump = true; return inp; }
      away(h.x + h.w / 2);
      if (d < 18 && g.has('dash') && g.lead === 'dora' && b.ground) inp.dash = true;
      return inp;
    }
  }
  // a warning: back off and wait for it
  // the clappers take turns: back off only from the one about to slam
  if (v.id === 'clappers') for (const h of v.heads) if ((h.st === 'slamTell' || h.st === 'slam') && Math.abs(h.x - b.x) < 120) { away(h.x); return inp; }
  // the Out-of-Tune Bell: only its toll's ring needs room (a swing goes over a hero who stays down)
  if (v.id === 'tune' && (v.st === 'tollTell' || v.st === 'toll2')) { const c = v.body.x + v.body.w / 2; if (Math.abs(c - b.x) < 100) { away(c); return inp; } }
  if (v.tell && !v.calm && v.id !== 'hydra' && v.id !== 'clappers' && v.id !== 'tune') {
    const c = v.body.x + v.body.w / 2;
    if (Math.abs(c - b.x) < 110) { away(c); return inp; }
    return inp;
  }
  // the Twin Clappers: Dora for the iron one, Enzo for the glass one; tag over when the lead can't hurt what is left
  let hurt = v.hurt;
  if (v.id === 'clappers') {
    const mine = g.lead === 'dora' ? 0 : 1;
    hurt = g.save.heroes[other].down ? v.hurt : v.hurt.filter((h) => h.part === mine);
    if (!hurt.length) { if (!g.save.heroes[other].down && g.tagCd === 0) inp.tag = true; return inp; }
  }
  // otherwise: go and hit the nearest open spot
  let best = null, bd = 1e9;
  for (const h of hurt) { const d = rectDist(b.x, me.y, h); if (d < bd) { bd = d; best = h; } }
  if (!best) { const c = v.body.x + v.body.w / 2; if (Math.abs(c - b.x) < 80) away(c); return inp; }
  const cx = best.x + best.w / 2;
  const reach = g.lead === 'dora' ? 20 : 30;
  const dx = cx - b.x;
  const edge = dx > 0 ? best.x - b.x : b.x - (best.x + best.w);
  if (edge > reach - 4) { if (dx > 0) inp.right = true; else inp.left = true; }
  else if (edge < -2 && Math.abs(dx) < best.w / 2 + 6) { /* standing inside: step out */ if (dx > 0) inp.left = true; else inp.right = true; }
  else if ((dx > 0) !== (b.face > 0)) { if (dx > 0) inp.right = true; else inp.left = true; }
  // high targets: jump and swing
  const high = best.y + best.h < b.y - HERO_H - 4;
  if (edge <= reach) {
    if (high && b.ground) inp.jump = true;
    if (!high || !b.ground) inp.attack = true;
  }
  // Enzo throws bolts from range when the target is high
  if (g.lead === 'enzo' && high && Math.abs(dx) < 200 && g.leadSave.mp >= 3 && rnd() < 0.2) inp.cast = true;
  return inp;
}

// ─── the route bot ────────────────────────────────────────────────────────
const thingsOf = (ch) => { const out = []; for (const info of INFO.values()) for (const t of info.things) if (t.ch === ch) out.push({ ...t, room: info.room }); return out; };
/** The story in order: where to go, and what to do there. */
function objectives() {
  const ped = (a) => { const t = thingsOf('A').find((x) => x.room.ability === a); return { name: `get ${a}`, done: (g) => g.has(a), at: t, act: 'touch' }; };
  const boss = (id) => { const t = thingsOf('O').find((x) => x.room.boss === id); return { name: `calm ${id}`, done: (g) => g.flag(`boss:${id}`), at: t, act: 'boss', boss: id }; };
  const coat = thingsOf('C').find((t) => t.room.chests?.[t.i] === 'ability:deep');
  const keeper = thingsOf('U')[0];
  const boat = thingsOf('D').find((t) => t.room.id === 'landing');
  return {
    citadel: [
      ped('dash'), boss('frog'), ped('double'), boss('hydra'), ped('wallkick'), boss('puma'), ped('chime'), boss('warden'),
      { name: 'get deep', done: (g) => g.has('deep'), at: coat, act: 'chest' },
      { name: 'meet Ukumari', done: (g) => g.flag('keeper'), at: keeper, act: 'talk' },
      boss('mother'),
    ],
    belfry: [
      { name: 'row across', done: (g) => isBelfryRoom(g.room.id) || g.flag('boss:tune'), at: boat, act: 'boat' },
      ped('rope'), boss('condor'), boss('clappers'), boss('tune'),
    ],
    // the Foundry Below: rowed back to the citadel, down through the seal under the Pearl Throne Candle
    foundry: [
      { name: 'row back', done: (g) => !isBelfryRoom(g.room.id), at: thingsOf('D').find((t) => t.room.id === 'cliffoot'), act: 'boat' },
      ped('hammer'), boss('founder'), boss('choir'), boss('hollow'),
    ],
  };
}
const navState = (g) => ({ abilities: [...g.save.abilities], water: { ...g.save.water }, wind: { ...g.save.wind }, keeper: g.flag('keeper'), calmed: g.save.flags.filter((f) => f.startsWith('boss:')).map((f) => f.slice(5)) });
/** An echo note the planner stands on (it counts them as always there; the bot rings their bell first). */
/** (Where two bells' notes share a spot, as the two ends of a crystal bridge do, the one nearer `from`.) */
const noteAt = (n, from = null) => {
  if (n.mode !== 'ground') return null;
  const qs = NOTES.filter((q) => Math.abs(n.y - q.y) < 1 && n.x >= q.x0 - 2 && n.x <= q.x1 + 2);
  if (!from || qs.length < 2) return qs[0] ?? null;
  return qs.reduce((a, q) => (Math.hypot(q.bx - from.x, q.by - from.y) < Math.hypot(a.bx - from.x, a.by - from.y) ? q : a));
};
const WIND_SETS = [{ cloud: 1, loft: 1 }, { cloud: -1, loft: 1 }, { cloud: 1, loft: -1 }, { cloud: -1, loft: -1 }];
const near = (t, dx = 20) => (n) => n.mode === 'ground' && Math.abs(n.x - (t.c * TILE + 8)) < dx && Math.abs(n.y - (t.r + 1) * TILE) < 18;
const inRoom = (id) => (n) => nodeRoom(n)?.id === id;

const WATER_SETS = [{ halls: 1, docks: 0, throne: 1 }, { halls: 0, docks: 0, throne: 1 }, { halls: 1, docks: 1, throne: 1 }, { halls: 0, docks: 1, throne: 0 }];
const U_DOOR = [...INFO.values()].flatMap((i) => i.doors).find((d) => d.ch === 'u');
const Z_DOOR = [...INFO.values()].flatMap((i) => i.doors).find((d) => d.ch === 'Z');

/** Watches a run like a referee: the throne opens only with all four seals, the wisp's goal can always be reached
 *  with what the heroes have (allowing the water bells, and in the belfry every wind the wind bells can set), its
 *  doorway never leads through a shut door, the belfry is never entered before the Lake Mother, and saving and loading
 *  keeps the seals, the wind, the totals and the wisp's goal. */
function referee(g) {
  const reachCache = new Map();
  const r = { checks: 0, throne: 0, badGoal: [], badWay: 0, saveLoad: 0, saveLoadBad: [], ledBy: { dora: 0, enzo: 0 }, lastGoal: '', boatEarly: 0, belfryChecks: 0, wispOff: 0, winds: new Set() };
  r.retarget = (n) => { g = n; r.lastGoal = ''; };
  const canReach = (goal0) => {
    // across the water, the wisp leads to Wayra's boat on this side first
    let goal = goal0;
    if (isBelfryRoom(goal.room) !== isBelfryRoom(g.room.id)) {
      const t = INFO.get(isBelfryRoom(g.room.id) ? 'cliffoot' : 'landing').things.find((x) => x.ch === 'D');
      goal = { room: t.room, x: t.c * TILE + 8, y: t.r * TILE };
    }
    const base = { abilities: [...g.save.abilities], keeper: g.flag('keeper'), calmed: g.save.flags.filter((f) => f.startsWith('boss:')).map((f) => f.slice(5)) };
    const sets = isBelfryRoom(g.room.id) ? [g.save.wind, ...WIND_SETS].map((wind) => ({ water: g.save.water, wind })) : [g.save.water, ...WATER_SETS].map((water) => ({ water, wind: g.save.wind }));
    for (const ws of sets) {
      const st = { ...base, ...ws };
      const k = `${stateKey(st)}|${g.room.id}`;
      if (!reachCache.has(k)) {
        const G = new Graph(st, true);
        const spots = [...G.reach([G.nodeAt(g.body.x, g.body.y, g.body.swim && !g.body.ground, g.body.climb)])].map((key) => G.nodes.get(key));
        reachCache.set(k, spots);
      }
      // (a guardian's room counts once the heroes can get into it: the Hollow Bell hangs over its pit)
      const bossRoom = goal === goal0 && roomById(goal.room)?.boss;
      if (reachCache.get(k).some((n) => bossRoom ? nodeRoom(n)?.id === goal.room : Math.abs(n.x - goal.x) < 40 && Math.abs(n.y - (goal.y + TILE)) < 48)) return true;
    }
    return false;
  };
  r.tick = (ticks) => {
    r.ledBy[g.lead]++;
    if (isBelfryRoom(g.room.id)) { r.winds.add(JSON.stringify(g.save.wind)); if (!g.flag('boss:mother')) r.boatEarly++; }
    if (g.doorOpen(U_DOOR) && g.restless().length) r.throne++;
    if (g.dialog || g.boss || ticks % 120 !== 0) return;
    const goal = g.nextGoal();
    if (!goal) return;
    const key = `${goal.room}:${goal.x}:${goal.y}`;
    if (key === r.lastGoal && ticks % 1200 !== 0) return;
    r.lastGoal = key; r.checks++;
    if (isBelfryRoom(goal.room)) { r.belfryChecks++; if (!g.wispOn()) r.wispOff++; }
    if (!canReach(goal)) r.badGoal.push(`${Math.round(ticks / 60)}s ${g.room.id}→${goal.room}`);
    // the doorway it heads for: never behind a shut door (wayToGoal skips those), and never the goal itself through
    // a wall when the goal is in another room
    const way = g.wayToGoal();
    if (way && goal.room !== g.room.id && way.x === goal.x && way.y === goal.y) { r.badWay++; r.badWays = [...(r.badWays ?? []), `${Math.round(ticks / 60)}s ${g.room.id}→${goal.room} [${g.save.abilities.join(',')}] water ${JSON.stringify(g.save.water)}`]; }
  };
  r.saveLoad = () => {
    const loaded = new BellspireGame(parseSave(JSON.stringify(g.snapshot())), { assist: true }, 1);
    r.saveLoadN = (r.saveLoadN ?? 0) + 1;
    const a = [g.sealsOpen(), g.doorOpen(U_DOOR), g.doorOpen(Z_DOOR), g.nextGoal()?.room ?? null, g.wispOn(), g.save.wind, g.completion().pct, g.save.abilities.length];
    const b = [loaded.sealsOpen(), loaded.doorOpen(U_DOOR), loaded.doorOpen(Z_DOOR), loaded.nextGoal()?.room ?? null, loaded.wispOn(), loaded.save.wind, loaded.completion().pct, loaded.save.abilities.length];
    if (JSON.stringify(a) !== JSON.stringify(b)) r.saveLoadBad.push(`${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  };
  return r;
}

export function routeBot(seed, { maxMinutes = 240, log = false, save = null, trial = null, foundry = true } = {}) {
  // a new game, or (with `save`) the finished citadel save loaded from the title's Continue
  let g = new BellspireGame(save ? parseSave(JSON.stringify(save)) : null, { assist: true }, seed);
  const ref = referee(g);
  const graphs = new Map();
  const fails = new Map();
  const graph = () => { const st = navState(g); const k = stateKey(st); if (!graphs.has(k)) graphs.set(k, new Graph(st, true)); return graphs.get(k); };
  let prev = NO, ticks = 0;
  const limit = maxMinutes * 3600;
  const timeline = [], endings = [], trials = [];
  const step = (inp) => {
    if (g.dialog) inp = { ...NO, jump: ticks % 2 === 0 };
    // fight back against anything close by, like a player would
    const out = { ...inp };
    if (out.jump && prev.jump && !inp.__hold) out.jump = inp.jump;
    g.step(out); prev = out; ticks++;
    ref.tick(ticks);
    for (const e of g.drainEvents()) { if (e.k === 'item' && log) console.log(`  [${Math.round(ticks / 60)}s] ${e.text}`); if (e.k === 'ending') endings.push({ ...e, at: ticks }); if (e.k === 'trial') trials.push(e); }
  };
  const idle = (n) => { for (let i = 0; i < n; i++) step({ ...NO }); };
  const tagTo = (h) => { let n = 0; while (g.lead !== h && n++ < 120) { if (g.tagCd === 0 && !g.save.heroes[h].down) { step({ ...NO, tag: true }); step({ ...NO }); } else step({ ...NO }); } };
  const lanternUp = () => {
    if (!g.has('lantern') || g.lanternUp || g.save.heroes.enzo.down) return;
    const back = g.lead; tagTo('enzo');
    step({ ...NO, down: true }); step({ ...NO, down: true, cast: true }); step({ ...NO }); idle(16);
    if (back === 'dora') tagTo('dora');
  };
  const chimeNear = () => {
    if (!g.has('chime')) return;
    const b = g.body;
    const shut = INFO.get(g.room.id).doors.some((d) => d.ch === 'c' && !g.doorOpen(d) && Math.hypot((d.c + d.w / 2) * TILE - b.x, (d.r + d.h / 2) * TILE - b.y) < 130);
    if (!shut) return;
    const back = g.lead; tagTo('enzo');
    if (g.leadSave.mp < 4) { g.eat('tea'); }
    step({ ...NO, up: true }); step({ ...NO, up: true, cast: true }); step({ ...NO }); idle(30);
    if (back === 'dora') tagTo('dora');
  };
  const swat = () => {
    const b = g.body;
    for (const e of g.enemies) {
      if (!e.alive || e.hidden) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (Math.abs(dx) < 40 && Math.abs(dy) < 30) {
        for (let i = 0; i < 24 && e.alive; i++) step({ ...NO, left: dx < 0 && i < 2, right: dx > 0 && i < 2, attack: i % 6 === 2 });
        return true;
      }
    }
    return false;
  };
  const heal = () => {
    for (const h of ['dora', 'enzo']) {
      const s = g.save.heroes[h];
      if (s.down && g.save.food.tea > 0) g.eat('tea');
    }
    if (g.leadSave.hp < g.stats(g.lead).maxHp * 0.4 && g.save.food.cake > 0) g.eat('cake');
  };
  /** Replay one planned move in the real game. */
  const run = (e, G, fromKey = -1) => {
    const m = e.macro;
    if (m.hero !== g.lead) tagTo(m.hero);
    const b = g.body;
    step({ ...NO });
    // stand where the planner assumed: the middle of this tile (a few small steps)
    // (on a ladder, the very rung the planner set off from: the nearest rung by position can be the one below)
    const nf = G.nodes.get(fromKey);
    const n0 = nf && nf.mode === 'climb' && b.climb && Math.abs(nf.x - b.x) < 4 && Math.abs(nf.y - b.y) < 20 ? nf : G.nodeAt(b.x, b.y, b.swim && !b.ground, b.climb);
    if (b.ground && n0.mode === 'ground') for (let i = 0; i < 24 && Math.abs(b.x - n0.x) > 1.2; i++) { step({ ...NO, left: b.x > n0.x && i % 3 === 0, right: b.x < n0.x && i % 3 === 0 }); }
    for (let i = 0; i < 20 && b.ground && Math.abs(b.vx) > 0.01; i++) step({ ...NO });
    if (b.climb && n0.mode === 'climb') for (let i = 0; i < 20 && Math.abs(b.y - n0.y) > 0.9; i++) step({ ...NO, up: b.y > n0.y + 0.9, down: b.y < n0.y - 0.9 });
    const from = { x: b.x, y: b.y };
    let air = false, landed = false, held = false;
    const rope = m.name.startsWith('rope');
    for (let t = 0; t < m.max + 60; t++) {
      let bi = t < m.max && !landed ? m.input(t, b, from) : { dir: 0, up: false, down: false, jumpP: false, jumpH: false, dashP: false };
      let jump = bi.jumpP || bi.jumpH;
      if (rope) {
        // on the rope a press must be a fresh key-down (letting go jumps): let go for a tick first if it was held
        const j = bi.jumpP ? !held : held && !!bi.jumpH;
        held = bi.jumpP ? !held : j;
        if (bi.jumpP && !j) { step({ ...NO, left: bi.dir < 0, right: bi.dir > 0 }); held = true; }
        jump = held;
      }
      const inp = { ...NO, left: bi.dir < 0, right: bi.dir > 0, up: bi.up, down: bi.down || !!bi.slamP, jump, dash: bi.dashP, attack: !!bi.ropeP || !!bi.slamP };
      step(inp);
      if (!b.ground) air = true; else if (air && !b.swim) landed = true;
      const n = G.nodes.get(e.to);
      if (t > 2 && b.ground && Math.abs(b.vx) < 0.05 && n.mode === 'ground' && Math.abs(b.x - n.x) < 12 && Math.abs(b.y - n.y) < 2) return true;
      if (t > 2 && n.mode === 'swim' && b.swim && !b.ground && Math.abs(b.x - n.x) < 12 && Math.abs(b.y - n.y) < 12) return true;
      if (t > 2 && n.mode === 'climb' && b.climb && b.vy === 0 && Math.abs(b.x - n.x) < 4 && Math.abs(b.y - n.y) < 9) return true;
      if (t > 2 && n.mode === 'wall' && b.wall === n.wall && Math.abs(b.x - n.x) < 6 && Math.abs(b.y - n.y) < 16) return true;
      if (t > m.max + 10 && b.ground && Math.abs(b.vx) < 0.05) return false;
      if (g.dialog || g.boss && g.boss.st !== 'wait') return false;
    }
    return false;
  };
  const notesUp = (q) => g.floatCache.some((f) => f.kind === 'note' && Math.abs(f.y - q.y) < 2 && Math.abs(f.x0 - q.x0) < 2);
  /** Sound an echo bell as Enzo (↑ + V within the chime's reach), then hand back to whoever climbs. */
  const ringEcho = (q) => {
    tagTo('enzo');
    if (g.leadSave.mp < 8 && g.save.food.tea > 0) g.eat('tea');
    step({ ...NO, up: true }); step({ ...NO, up: true, cast: true }); step({ ...NO });
    for (let i = 0; i < 40 && !notesUp(q); i++) step({ ...NO });
    return notesUp(q);
  };
  /** Replay planned moves back to back with no settling between them, as fast as the planner planned them (the climb
   *  up the notes has to fit inside their few seconds). */
  const drive = (edges, until, G = null, fromKey = -1) => {
    for (const e of edges) {
      if (ticks > until) return;
      if (e.macro.hero !== g.lead) tagTo(e.macro.hero);
      step({ ...NO });
      // from a spot to stand or a rung, first stand where the planner set off from (as run() does)
      const nf = G?.nodes.get(fromKey), b = g.body;
      if (nf && nf.mode === 'ground' && b.ground && Math.abs(b.x - nf.x) < 24) {
        for (let k = 0; k < 3 && Math.abs(b.x - nf.x) > 1.2; k++) {
          for (let i = 0; i < 40 && Math.abs(b.x - nf.x) > 1.2; i++) { const far = Math.abs(b.x - nf.x) > 5 || i % 3 === 0; step({ ...NO, left: b.x > nf.x && far, right: b.x < nf.x && far }); }
          for (let i = 0; i < 20 && Math.abs(b.vx) > 0.01; i++) step({ ...NO });
        }
      }
      if (nf && nf.mode === 'climb' && b.climb) for (let i = 0; i < 20 && Math.abs(b.y - nf.y) > 0.9; i++) step({ ...NO, up: b.y > nf.y + 0.9, down: b.y < nf.y - 0.9 });
      fromKey = e.to;
      const f = { x: g.body.x, y: g.body.y };
      let air = false, landed = false, held = false;
      for (let t = 0; t < e.ticks; t++) {
        let bi = t < e.macro.max && !landed ? e.macro.input(t, g.body, f) : { dir: 0, jumpP: false, jumpH: false, dashP: false, up: false, down: false };
        if (landed && e.macro.name.startsWith('walk')) bi = { dir: 0, jumpP: false, jumpH: false, dashP: false, up: false, down: false };
        const j = bi.jumpP ? !held : held && !!bi.jumpH;
        held = bi.jumpP ? !held : j;
        if (bi.jumpP && !j) { step({ ...NO, left: bi.dir < 0, right: bi.dir > 0 }); held = true; }
        step({ ...NO, left: bi.dir < 0, right: bi.dir > 0, up: bi.up, down: bi.down || !!bi.slamP, jump: held, attack: !!bi.ropeP || !!bi.slamP, dash: bi.dashP });
        if (!g.body.ground) air = true; else if (air && !g.body.swim) landed = true;
      }
    }
  };
  /** Walk the planner's path to the first node that satisfies `goal`. */
  const go = (goal, label, depth = 0) => {
    for (let attempt = 0; attempt < 40 && ticks < limit; attempt++) {
      heal(); lanternUp(); chimeNear();
      if (swat()) continue;
      const G = graph();
      const start = G.nodeAt(g.body.x, g.body.y, g.body.swim && !g.body.ground, g.body.climb);
      if (goal(start)) return true;
      const path = G.path(start, goal, 60000);
      if (!path) return false;
      // the foundry: molten bronze to cool, slag to wait for, glass to break and beam doors to open on the way
      if (isFoundryRoom(g.room.id) && depth < 2 && foundryPrep(path, G, depth)) continue;
      // echo notes ahead: walk to the foot of the climb, ring their bell, and climb straight away
      const k = path.findIndex((e) => { const q = noteAt(G.nodes.get(e.to)); return q && !notesUp(q); });
      if (k === 0 && depth < 2) {
        const q = noteAt(G.nodes.get(path[0].to), g.body);
        if (Math.hypot(g.body.x - q.bx, g.body.y - (q.by + TILE)) > 120) {
          // too far from the bell to ring it: first to a spot by it
          go((n) => n.mode === 'ground' && Math.hypot(n.x - q.bx, n.y - (q.by + TILE)) < 100 && !noteAt(n), 'echo bell', depth + 1);
          continue;
        }
        if (!ringEcho(q)) continue;
        const rung = ticks;
        const G2 = graph(), s2 = G2.nodeAt(g.body.x, g.body.y, false, g.body.climb);
        const p2 = G2.path(s2, goal, 60000);
        if (!p2) continue;
        // up to the last note on the way, and one move off it
        let last = -1; p2.forEach((e, i) => { if (noteAt(G2.nodes.get(e.to))) last = i; });
        drive(p2.slice(0, last + 2), rung + NOTE_LIFE - 10, G2, s2.key);
        r_notes.climbs++; if (isFoundryRoom(g.room.id)) r_notes.bridges++;
        continue;
      }
      let fromKey = start.key;
      const chunk = path.slice(0, k > 0 ? Math.min(k, 6) : 6);
      // in the belfry, the planned moves are replayed back to back exactly as the planner simulated them (a still
      // tick between moves, no settling): its rope swings, wall kicks up shafts and gusty jumps only work as planned
      // (and in an Echo Trial's run everywhere: the clock wants the planner's own line)
      // (but in the foundry each move settles first: its slag strips sit tight against the lava)
      if (((trial && !isFoundryRoom(g.room.id)) || isBelfryRoom(g.room.id)) && !g.dialog) {
        // never stop on a wall mid-shaft: carry on to the next spot to stand or rung
        while (chunk.length < path.length && G.nodes.get(chunk.at(-1).to).mode === 'wall' && !noteAt(G.nodes.get(path[chunk.length].to))) chunk.push(path[chunk.length]);
        const end = G.nodes.get(chunk.at(-1).to);
        drive(chunk, Infinity, G, start.key);
        for (let i = 0; i < 40 && !g.body.ground && !g.body.climb && !g.body.swim; i++) step({ ...NO });
        if (g.boss && g.boss.st !== 'wait') return true;
        const here = G.nodeAt(g.body.x, g.body.y, g.body.swim && !g.body.ground, g.body.climb);
        if (Math.abs(g.body.x - end.x) > 20 || Math.abs(g.body.y - end.y) > 12) {
          // the first move that went wrong is struck off after two misses, so the planner finds another way
          const fk = `${stateKey(navState(g))}|${start.key}|${chunk[0].macro.name}`;
          const n = (fails.get(fk) ?? 0) + 1; fails.set(fk, n);
          if (n >= 3) { const list = G.edges.get(start.key); if (list) G.edges.set(start.key, list.filter((x) => x !== chunk[0])); }
          if (log && process.env.BS_MISS) console.log(`    miss: ${chunk.map((e) => e.macro.name).join(' ')} to (${Math.round(end.x)},${Math.round(end.y)}), ended at (${Math.round(g.body.x)},${Math.round(g.body.y)}) ${g.room.id}`);
        }
        if (goal(here)) return true;
        continue;
      }
      for (const e of chunk) {
        const before = { x: g.body.x, y: g.body.y, room: g.room.id };
        const ok = run(e, G, fromKey);
        if (!ok) {
          // a move that keeps failing in the real game is struck off, so the planner finds another way
          const fk = `${stateKey(navState(g))}|${fromKey}|${e.macro.name}`;
          const n = (fails.get(fk) ?? 0) + 1;
          fails.set(fk, n);
          if (n >= 2) { const list = G.edges.get(fromKey); if (list) G.edges.set(fromKey, list.filter((x) => x !== e)); }
        }
        fromKey = e.to;
        if (!ok) {
          if (log && attempt > (process.env.BS_MISS ? -1 : 30)) { const n = G.nodes.get(e.to); console.log(`    miss: ${e.macro.name} from ${before.room} (${Math.round(before.x)},${Math.round(before.y)}) to ${n.mode} (${Math.round(n.x)},${Math.round(n.y)}), ended at (${Math.round(g.body.x)},${Math.round(g.body.y)}) climb=${g.body.climb} ground=${g.body.ground} swim=${g.body.swim} lead=${g.lead} dialog=${!!g.dialog} boss=${g.boss?.st} room=${g.room.id}`); }
          break;
        }
        if (g.boss && g.boss.st !== 'wait') return true;
      }
      const now = G.nodeAt(g.body.x, g.body.y, g.body.swim && !g.body.ground, g.body.climb);
      if (goal(now)) return true;
    }
    if (log) console.log(`  gave up walking to ${label}`);
    return false;
  };
  /** The Foundry Below's steps the planner takes as done: before the next few moves, cool a molten channel they cross
   *  (Enzo's Frost Fan from its edge), wait for the vents' puff over slag, slam cracked glass they drop through and
   *  ring the prism by a beam door they pass. Returns true when it did something (so the caller plans again). */
  const foundryPrep = (path, G, depth) => {
    const pts = [{ x: g.body.x, y: g.body.y }, ...path.slice(0, 8).map((e) => G.nodes.get(e.to))];
    const spans = (x0, x1, y0, y1) => pts.some((n, i) => {
      const a = pts[Math.max(0, i - 1)];
      return Math.max(a.x, n.x) > x0 && Math.min(a.x, n.x) < x1 && Math.max(a.y, n.y) > y0 && Math.min(a.y, n.y) < y1;
    });
    // molten channels
    for (const q of CHANNELS) {
      if (q.room !== g.room.id || g.channelState(q) === 'crust') continue;
      if (!spans(q.c0 * TILE - 4, (q.c1 + 1) * TILE + 4, q.r * TILE - 40, q.r * TILE + 8)) continue;
      if (!g.hotChannelNear(5 * TILE)) {
        const ok = go((n) => n.mode === 'ground' && Math.abs(n.y - q.r * TILE) < 24 && n.x > q.c0 * TILE - 4 * TILE && n.x < (q.c1 + 1) * TILE + 4 * TILE && (n.x < q.c0 * TILE || n.x > (q.c1 + 1) * TILE), 'channel edge', depth + 1);
        if (!ok) return false;
      }
      const back = g.lead; tagTo('enzo');
      if (g.leadSave.mp < 8 && g.save.food.tea > 0) g.eat('tea');
      for (let i = 0; i < 20 && !g.body.ground; i++) step({ ...NO });
      step({ ...NO, cast: true }); step({ ...NO }); idle(12);
      if (g.channelState(q) !== 'hot') r_notes.frosts++;
      if (back === 'dora') tagTo('dora');
      return true;
    }
    // slag: to the last spot before it, then wait there for a fresh puff of the vents (and straight across)
    const info = INFO.get(g.room.id);
    const onSlag = (n) => n.mode === 'ground' && rawChar(Math.floor(n.x / TILE), Math.round(n.y / TILE)) === ':';
    const j = path.slice(0, 8).findIndex((e) => onSlag(G.nodes.get(e.to)));
    if (j > 0) { const key = path[j - 1].to; return go((n) => n.key === key, 'slag edge', depth + 1); }
    if (j === 0 && !onSlag(G.nodeAt(g.body.x, g.body.y))) {
      let last = 0; path.slice(0, 8).forEach((e, i) => { if (onSlag(G.nodes.get(e.to))) last = i; });
      const need = path.slice(0, last + 1).reduce((a, e) => a + e.ticks, 0) + 30;
      for (let i = 0; i < VENT_P && g.ventUp() && g.ventLeft() < need; i++) step({ ...NO });
      for (let i = 0; i < VENT_P && !g.ventUp(); i++) step({ ...NO });
      return false;
    }
    // cracked glass under the way down: stand on it, and slam
    for (const d of info.doors) {
      if (d.ch !== '8' || g.doorOpen(d) || !spans(d.c * TILE, (d.c + d.w) * TILE, d.r * TILE + 2, (d.r + d.h) * TILE + 40)) continue;
      const on = (n) => n.mode === 'ground' && Math.abs(n.y - d.r * TILE) < 2 && n.x > d.c * TILE + 2 && n.x < (d.c + d.w) * TILE - 2;
      if (!on(G.nodeAt(g.body.x, g.body.y)) && !go(on, 'cracked glass', depth + 1)) return false;
      tagTo('dora');
      for (let i = 0; i < 12; i++) step({ ...NO, jump: true });
      step({ ...NO, down: true, attack: true });
      for (let i = 0; i < 60 && !g.doorOpen(d); i++) step({ ...NO, down: true });
      idle(10);
      if (g.doorOpen(d)) r_notes.slams++;
      return true;
    }
    // a beam door in the way: its prism (on this side), and the chime
    for (const d of info.doors) {
      if (d.ch !== '&' || g.doorOpen(d) || !spans(d.c * TILE - 2, (d.c + d.w) * TILE + 2, d.r * TILE, (d.r + d.h) * TILE + 2)) continue;
      const dx = (d.c + d.w / 2) * TILE, dy = (d.r + d.h / 2) * TILE;
      const pr = thingsOf('!').find((t) => t.room.id === g.room.id && Math.hypot(t.c * TILE + 8 - dx, t.r * TILE + 8 - dy) <= 8 * TILE);
      if (!pr) return false;
      if (!go(near(pr, 28), 'prism', depth + 1)) return false;
      tagTo('enzo');
      if (g.leadSave.mp < 8 && g.save.food.tea > 0) g.eat('tea');
      step({ ...NO, up: true }); step({ ...NO, up: true, cast: true }); step({ ...NO }); idle(30);
      if (g.doorOpen(d)) r_notes.beams++;
      return true;
    }
    return false;
  };
  /** In the belfry: if the goal can't be reached in this wind, find a wind bell that turns it round. */
  const fixWind = (goal) => {
    if (!isBelfryRoom(g.room.id)) return false;
    const here = navState(g);
    for (const bell of thingsOf('W')) {
      const area = bell.room.area;
      if (!WIND_AREAS.includes(area)) continue;
      const flipped = { ...here, wind: { ...here.wind, [area]: here.wind[area] > 0 ? -1 : 1 } };
      const k = stateKey(flipped);
      if (!graphs.has(k)) graphs.set(k, new Graph(flipped, true));
      const G2 = graphs.get(k), G = graph();
      const start = G.nodeAt(g.body.x, g.body.y);
      if (!G.path(start, near(bell, 28), 60000)) continue;
      const bx = bell.c * TILE + 8, by = (bell.r + 1) * TILE;
      if (!G2.path(G2.nodeAt(bx, by), goal, 60000)) continue;
      if (log) console.log(`  ring the ${bell.room.id} wind bell (${area})`);
      if (!go(near(bell, 28), `${bell.room.id} wind bell`)) continue;
      const before = g.save.wind[area];
      for (let i = 0; i < 60 && g.save.wind[area] === before; i++) step({ ...NO, left: g.body.x > bx + 2 && i % 8 < 2, right: g.body.x < bx - 2 && i % 8 < 2, attack: i % 8 === 4 });
      idle(20);
      if (g.save.wind[area] !== before) { r_notes.winds++; return true; }
    }
    return false;
  };
  /** If the goal can't be reached with the water as it is, find a bell that fixes it. */
  const fixWater = (goal) => {
    const bells = thingsOf('B');
    const here = navState(g);
    for (const bell of bells) {
      const area = bell.room.area;
      if (!(area in here.water)) continue;
      const flipped = { ...here, water: { ...here.water, [area]: here.water[area] ? 0 : 1 } };
      const k = stateKey(flipped);
      if (!graphs.has(k)) graphs.set(k, new Graph(flipped, true));
      const G2 = graphs.get(k), G = graph();
      // can we reach the bell now, and the goal once it has rung?
      const start = G.nodeAt(g.body.x, g.body.y);
      const toBell = G.path(start, near(bell, 28), 60000);
      if (!toBell) continue;
      const bx = bell.c * TILE + 8, by = (bell.r + 1) * TILE;
      if (!G2.path(G2.nodeAt(bx, by), goal, 60000)) continue;
      if (log) console.log(`  ring the ${bell.room.id} bell (${area})`);
      if (!go(near(bell, 28), `${bell.room.id} bell`)) continue;
      const before = g.save.water[area];
      for (let i = 0; i < 60 && g.save.water[area] === before; i++) step({ ...NO, left: g.body.x > bx + 2 && i % 8 < 2, right: g.body.x < bx - 2 && i % 8 < 2, attack: i % 8 === 4 });
      idle(30);
      for (let i = 0; i < 600 && g.waterMoving(); i++) step({ ...NO });
      return g.save.water[area] !== before;
    }
    return false;
  };
  const r_notes = { climbs: 0, winds: 0, frosts: 0, slams: 0, beams: 0, bridges: 0, heat: 0 };
  const play = (list) => {
  for (const o of list) {
    if (o.done(g)) continue;
    // (into a guardian's room on something to stand on, not clinging to a wall at its edge)
    const goal = o.act === 'boss' ? (n) => n.mode === 'ground' && inRoom(o.at.room.id)(n) : near(o.at, o.act === 'touch' ? 10 : 20);
    if (log) console.log(`[${Math.round(ticks / 60)}s] ${o.name}`);
    let reached = false;
    for (let k = 0; k < 6 && !reached && ticks < limit; k++) {
      reached = go(goal, o.name);
      if (!reached) { if (!fixWater(goal) && !fixWind(goal)) break; }
    }
    if (!reached && o.done(g)) reached = true;
    if (!reached) return { ok: false, at: o.name, ticks, room: g.room.id, timeline, x: g.body.x, y: g.body.y, swim: g.body.swim, climb: g.body.climb, ground: g.body.ground, water: { ...g.save.water }, ab: [...g.save.abilities], lantern: g.lanternUp };
    if (o.act === 'boss') {
      // fight like the boss bot, from here
      let rs = seed;
      const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
      // (eating a cake when low, as the boss bots do; the Hollow Bell's fight is the longest, so up to 12 minutes)
      let ate = -999, jumpHold = 0;
      for (let i = 0; i < 12 * 3600 && !g.flag(`boss:${o.boss}`); i++) {
        if (g.boss && g.leadSave.hp < g.stats(g.lead).maxHp * 0.3 && g.save.food.cake > 0 && i - ate > 300) { g.eat('cake'); ate = i; }
        const bb = g.boss;
        const v = bb ? { id: bb.id, st: bb.st, tell: bb.tellT > 0, harm: bb.harm, hurt: bb.hurt, body: bb.body, x: bb.x, y: bb.y, calm: bb.calm, shots: g.shots.filter((s) => !s.friendly), waves: g.waves, rings: g.rings.filter((r) => !r.friendly), markers: g.markers, heads: bb.heads.map((h) => ({ st: h.st, x: h.x })), ...fdView(bb) } : null;
        if (!bb && !g.flag(`boss:${o.boss}`)) { go(inRoom(o.at.room.id), o.name); continue; }
        const inp = decide(g, v, rnd, 0.05);
        if (inp.run) { for (let t = 0; t < 200; t++) { const m = inp.run(t, g); if (!m) break; step(m); i++; } continue; }
        if (inp.attack && prev.attack) inp.attack = false;
        if (isFoundryRoom(o.at.room.id)) {
          // (the foundry's fights climb to ledges: jumps held for a while, as the boss bots do)
          if (inp.jump && !prev.jump) jumpHold = 16;
          if (jumpHold > 0) { inp.jump = true; jumpHold--; } else if (prev.jump && inp.jump) inp.jump = false;
        } else if (inp.jump) inp.jump = !(prev.jump && g.body.ground);
        step(inp);
      }
      idle(30);
      if (!g.flag(`boss:${o.boss}`)) return { ok: false, at: o.name, ticks, room: g.room.id, timeline };
    } else if (o.act === 'boat') {
      for (let i = 0; i < 80 && !o.done(g); i++) step({ ...NO, up: i % 4 === 0 });
      idle(30);
    } else if (o.act === 'chest' || o.act === 'talk') {
      for (let i = 0; i < 40 && !o.done(g); i++) step({ ...NO, up: i % 4 === 0 });
      idle(30);
    } else idle(20);
    timeline.push({ what: o.name, at: Math.round(ticks / 60), level: g.save.heroes.dora.level });
    ref.saveLoad();
    if (o.name === 'meet Ukumari') {
      // an old save from before the seals: Ukumari opened the door with the hydra skipped. Loading locks it again,
      // and the wisp leads to the hydra, which can be reached
      const old = parseSave(JSON.stringify(g.snapshot()));
      old.flags = old.flags.filter((f) => f !== 'boss:hydra');
      const og = new BellspireGame(old, { assist: true }, 2);
      ref.oldSave = { relocked: !og.flag('keeper') && !og.doorOpen(U_DOOR), wisp: og.nextGoal()?.room ?? null };
      // and before the Lake Mother, Wayra won't row
      const bg = new BellspireGame(parseSave(JSON.stringify(g.snapshot())), { assist: true }, 4);
      bg.takeBoat();
      ref.boatShut = !isBelfryRoom(bg.room.id) && bg.dialog?.lines === SCRIPTS.boatEarly;
    }
    if (!o.done(g)) return { ok: false, at: o.name, ticks, room: g.room.id, timeline };
  }
  return null;
  };
  // an Echo Trial's run (from a finished save at its shrine): the planner's way to each trial bell in turn, played
  // for real, ringing a wind bell if the wind is wrong
  if (trial) {
    const def = trialById(trial);
    idle(5);
    const why = g.startTrial(trial);
    if (why) return { ok: false, why };
    for (const goal of def.goals) {
      const p = g.trialBellAt(goal);
      const at = (n) => n.mode === 'ground' && Math.abs(n.x - p.x) < 10 && Math.abs(n.y - p.y) < 6;
      let reached = false;
      for (let k = 0; k < 4 && !reached && g.trial && ticks < limit; k++) { reached = go(at, goal.room); if (!reached && !fixWind(at)) break; }
      if (!g.trial) break;
      for (let i = 0; i < 30 && g.trial && g.trial.i <= def.goals.indexOf(goal); i++) step({ ...NO, left: g.body.x > p.x + 2, right: g.body.x < p.x - 2 });
      if (!reached && g.trial) return { ok: false, at: goal.room, ticks, room: g.room.id };
    }
    const r = trials.at(-1);
    return { ok: !!r?.won, secs: r?.secs, medal: r?.medal, ticks };
  }
  const OBJ = objectives();
  let citadel = null;
  if (!save) {
    const fail = play(OBJ.citadel);
    if (fail) return fail;
    citadel = afterCitadel();
    // the ending screen's Keep exploring: the save loads again without the ending
    const s = parseSave(JSON.stringify(g.snapshot()));
    s.flags = s.flags.filter((f) => f !== 'ending');
    g = new BellspireGame(s, { assist: true }, seed + 100);
    ref.retarget(g); prev = NO;
  }
  let belfry = null, belfrySave = null;
  if (!g.flag('boss:tune')) {
    const fail = play(OBJ.belfry);
    if (fail) return { ...fail, citadel };
    idle(60);
    belfry = { completion: g.completion(), endings: endings.filter((e) => e.belfry), epilogue: afterBelfry() };
    belfrySave = g.snapshot();
    // the belfry's ending screen's Keep exploring
    const s = parseSave(JSON.stringify(belfrySave));
    s.flags = s.flags.filter((f) => f !== 'ending');
    g = new BellspireGame(s, { assist: true }, seed + 200);
    ref.retarget(g); prev = NO;
  }
  if (foundry) {
    const fail = play(OBJ.foundry);
    if (fail) return { ...fail, citadel, belfry, belfrySave };
    idle(60);
  }
  const fdEnd = endings.filter((e) => e.foundry);
  return { ok: g.flag('boss:tune') && g.flag('boss:mother') && (!foundry || g.flag('boss:hollow')), ticks, timeline, completion: citadel?.completion ?? null, ref, epilogue: citadel?.epilogue ?? null, citadelSave: citadel?.save ?? null, belfrySave, belfry, foundry: foundry ? { endings: fdEnd, completion: g.completion(), heat: r_notes.heat, frosts: r_notes.frosts, slams: r_notes.slams, beams: r_notes.beams, bridges: r_notes.bridges } : null, moves: r_notes, level: g.save.heroes.dora.level };

  /** After the belfry's ending: Keep exploring, find what's left, and the second epilogue plays once (the first
   *  never again). */
  function afterBelfry() {
    const post = parseSave(JSON.stringify(g.snapshot()));
    post.flags = post.flags.filter((f) => f !== 'ending');
    const pg = new BellspireGame(post, { assist: true }, 5);
    const pct0 = pg.completion().pct;
    let fired = 0, early = 0, first = 0;
    for (let i = 0; i < 60; i++) { pg.step({ ...NO }); for (const e of pg.drainEvents()) if (e.k === 'ending') early++; }
    pg.save.seen = []; for (const rm of ROOMS) for (let y = 0; y < rm.h; y++) for (let x = 0; x < rm.w; x++) pg.save.seen.push(`${rm.gx + x},${rm.gy + y}`);
    for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') pg.setFlag(`chest:${info.room.id}:${t.i}`);
    for (let i = 0; i < MURALS.length; i++) pg.setFlag(`mural:${i}`);
    for (let i = 0; i < 900; i++) { pg.step({ ...NO, jump: i % 2 === 0 }); for (const e of pg.drainEvents()) if (e.k === 'ending') { if (e.belfry && e.full) fired++; else first++; } }
    // and it stays once: a reload after it does not play it again
    const again = new BellspireGame(parseSave(JSON.stringify(pg.snapshot())), { assist: true }, 6);
    let twice = 0;
    for (let i = 0; i < 300; i++) { again.step({ ...NO, jump: i % 2 === 0 }); for (const e of again.drainEvents()) if (e.k === 'ending') twice++; }
    return { pct0, pct: pg.completion().pct, early: pct0 < 100 ? early : 0, fired, first, twice, flag: pg.flag('epilogue2') };
  }
  /** After the citadel's ending: Keep exploring, find what's left of the citadel, and the epilogue plays once. */
  function afterCitadel() {
  const snap = g.snapshot();
  const post = parseSave(JSON.stringify(snap));
  post.flags = post.flags.filter((f) => f !== 'ending');
  const pg = new BellspireGame(post, { assist: true }, 3);
  const pct0 = pg.completion().pct;
  let epi = 0, early = 0;
  for (let i = 0; i < 60; i++) { pg.step({ ...NO }); for (const e of pg.drainEvents()) if (e.k === 'ending') early++; }
  pg.save.seen = []; for (const rm of ROOMS) for (let y = 0; y < rm.h; y++) for (let x = 0; x < rm.w; x++) pg.save.seen.push(`${rm.gx + x},${rm.gy + y}`);
  for (const info of INFO.values()) for (const t of info.things) if (t.ch === 'C') pg.setFlag(`chest:${info.room.id}:${t.i}`);
  for (let i = 0; i < 10; i++) pg.setFlag(`mural:${i}`);
  for (let i = 0; i < 600; i++) { pg.step({ ...NO, jump: i % 2 === 0 }); for (const e of pg.drainEvents()) if (e.k === 'ending' && e.full) epi++; }
  return { completion: g.completion(), epilogue: { pct0, early: pct0 < 100 ? early : 0, fired: epi }, save: snap };
  }
}

// ─── run ──────────────────────────────────────────────────────────────────
function runBosses() {
const seeds = QUICK ? 8 : 24;
let checks = 0;
const report = [];
// This runner covers the original through-Foundry boss presets. The Salt Road
// encounters use the interaction sequences in tests/bellspire-salt.mjs.
if (ONLY) assert.ok(ONLY in PRESET, `No boss bot preset for ${ONLY}`);
for (const id of Object.keys(PRESET)) {
  if (ONLY && id !== ONLY) continue;
  for (const [label, assist, need] of [['casual', true, 0.85], ['pro', false, 0.7]]) {
    let wins = 0, tries = 0, ticks = 0, first = 0, lows = 0;
    for (let s = 1; s <= seeds; s++) {
      const delay = 12 + (s % 4);
      const r = bossBot(id, s * 7919, { assist, delay, noise: assist ? 0.1 : 0.06 });
      if (r.won) { wins++; tries += r.tries; ticks += r.ticks; if (r.tries === 1) first++; }
      lows += r.low;
      if (VERBOSE) console.log(id, label, s, r);
    }
    const rate = wins / seeds;
    report.push(`${id.padEnd(7)} ${label.padEnd(6)} ${wins}/${seeds} won within 3 tries (${Math.round(rate * 100)}%), ${first} on the first try, ${wins ? Math.round(ticks / wins / 60) : '-'}s a win, lowest HP ${Math.round((lows / seeds) * 100)}% on average`);
    console.log(report[report.length - 1]);
    assert.ok(rate >= need, `${id} ${label} bot won ${Math.round(rate * 100)}% (needs ${need * 100}%)`);
    checks++;
  }
}
void TILE; void HERO_W; void ROOMS; void INFO; void ABILITY_ORDER; void roomById;
console.log(`bellspire bots: ${checks} boss checks passed`);
}
function runRoute() {
  const arg = process.argv.find((a) => a.startsWith('--route-seeds='))?.slice(14);
  const seeds = arg ? arg.split(',').map(Number) : QUICK ? [1] : [1, 2, 3];
  const tl = (r) => r.timeline.map((t) => `${t.what} ${Math.round(t.at / 60)}m L${t.level}`).join(', ');
  const belfryChecks = (r, how) => {
    const f = r.ref, e = r.belfry.epilogue;
    console.log(`  belfry (${how}): ${f.belfryChecks} belfry wisp goals checked, ${f.badGoal.length} out of reach; winds seen ${[...f.winds].length}; ${r.moves.winds} wind bells rung, ${r.moves.climbs} echo-note climbs; ${f.saveLoadN} save/loads, ${f.saveLoadBad.length} changed; in the belfry before the Lake Mother ${f.boatEarly} ticks; belfry ending ${r.belfry.endings.length}x at ${r.belfry.completion.pct}%; epilogue2 fired ${e.fired}x after finding the rest (early ${e.early}, the first epilogue again ${e.first}x, again after a reload ${e.twice}x)`);
    assert.deepEqual(f.badGoal, [], `the wisp only ever points at something the heroes can reach (${how})`);
    assert.equal(f.badWay, 0, `the wisp never heads through a wall (${how}: ${f.badWays})`);
    assert.ok(f.belfryChecks > 0, `the referee checked the wisp in the belfry (${how})`);
    assert.equal(f.wispOff, 0, `the wisp is on all the way to the belfry (${how})`);
    assert.ok(f.winds.size >= 2, `the wind was turned round on the way (${how})`);
    assert.ok(r.moves.climbs > 0, `the route climbed echo notes for real (${how})`);
    assert.deepEqual(f.saveLoadBad, [], `saving and loading after each belfry step keeps the wind, seals, totals and wisp (${how})`);
    assert.equal(f.boatEarly, 0, `never in the belfry before the Lake Mother (${how})`);
    assert.equal(r.belfry.endings.length, 1, `the belfry's ending plays once (${how})`);
    assert.equal(e.fired, 1, `finding the rest plays the second epilogue once (${how})`);
    assert.equal(e.early + e.first + e.twice, 0, `and nothing else (${how})`);
  };
  for (const seed of seeds) {
    const r = routeBot(seed, { log: VERBOSE });
    if (!r.ok && VERBOSE) console.log(r);
    console.log(`route bot seed ${seed}: ${r.ok ? 'finished' : `stuck at "${r.at}" in ${r.room}`} after ${Math.round(r.ticks / 3600)} min (${tl(r)})`);
    assert.ok(r.ok, `the route bot finishes the game (seed ${seed})`);
    const f = r.ref, led = f.ledBy.dora + f.ledBy.enzo;
    console.log(`  referee: ${f.checks} wisp goals checked, ${f.badGoal.length} out of reach, ${f.badWay} through a wall; throne open early ${f.throne} ticks; boat shut before the Lake Mother ${f.boatShut}; old save relocked ${f.oldSave?.relocked}, wisp to ${f.oldSave?.wisp}; Dora led ${Math.round((f.ledBy.dora / led) * 100)}%, Enzo ${Math.round((f.ledBy.enzo / led) * 100)}%; citadel ending at ${r.completion.base.pct}% of the citadel, epilogue fired ${r.epilogue.fired}x after finding the rest (early ${r.epilogue.early})`);
    assert.equal(f.throne, 0, 'the throne never opens before all four seals');
    assert.ok(f.oldSave?.relocked && f.oldSave.wisp === 'lagoon', 'an old save with the hydra skipped locks the throne again and the wisp leads to the hydra');
    assert.ok(f.boatShut, 'before the Lake Mother, Wayra won’t row');
    assert.ok(f.ledBy.dora > 0 && f.ledBy.enzo > 0, 'both heroes lead');
    assert.equal(r.epilogue.fired, 1, 'after the ending, finding the rest plays the epilogue once');
    assert.equal(r.epilogue.early, 0, 'and not before');
    belfryChecks(r, 'straight through');
    // and on down into the Foundry Below, to the Hollow Bell
    const fd = r.foundry;
    console.log(`  foundry: ${fd.frosts} channels cooled, ${fd.slams} glass slammed, ${fd.beams} beam doors opened, ${fd.bridges} crystal-bridge crossings; foundry ending ${fd.endings.length}x at ${fd.completion.pct}%; ${tl(r).split(', ').slice(-4).join(', ')}`);
    assert.ok(fd.frosts > 0 && fd.slams > 0 && fd.beams > 0 && fd.bridges > 0, `the route cooled bronze, broke glass, opened a beam door and crossed a crystal bridge for real (seed ${seed})`);
    assert.equal(fd.endings.length, 1, `the foundry's ending plays once (seed ${seed})`);
    assert.deepEqual(f.badGoal, [], `the wisp only points at what can be reached in the foundry too (seed ${seed})`);
    // the same belfry from the finished citadel save, as the title's Continue loads it
    const c = routeBot(seed, { log: VERBOSE, save: r.citadelSave, foundry: false });
    if (!c.ok && VERBOSE) console.log(c);
    console.log(`route bot seed ${seed} from a finished citadel save: ${c.ok ? 'finished' : `stuck at "${c.at}" in ${c.room}`} after ${Math.round(c.ticks / 3600)} min (${tl(c)})`);
    assert.ok(c.ok, `the route bot finishes the belfry from a finished citadel save (seed ${seed})`);
    belfryChecks(c, 'from the save');
  }
}
if (process.argv[1]?.endsWith('bellspire-bot.mjs')) {
  if (!process.argv.includes('--route-only')) runBosses();
  if (!ONLY) runRoute();
  // and the Echo Trials' and New Game+'s bots (tests/bellspire-trials-bot.mjs)
  // (in its own process: it imports this file's bots, which can't be imported while this file is still running)
  if (!ONLY && !process.argv.includes('--route-only')) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [new URL('./bellspire-trials-bot.mjs', import.meta.url).pathname, ...process.argv.slice(2)], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

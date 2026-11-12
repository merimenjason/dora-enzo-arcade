// Brinelight bots, playing like people rather than perfect players. Every bot sees the game 200–300 ms late (it acts
// on a snapshot from that long ago), presses buttons a few times a second at most, and fumbles some inputs. Four of
// them:
// - masher: walks at the nearest foe and mashes Attack, jumps now and then, and tags only when the game's own prompt
//   asks (half the time). Never dodges on purpose.
// - casual: mashes too, but follows the prompts most of the time, sometimes steps out of a marked lane or jumps a tell,
//   and tags when its hits tink.
// - tagger: plays the two-hero rule: picks the hero the target wants, tags in mid-combo to chain, double-teams when the
//   meter is full, and uses the dash special on a line of foes.
// - soloist: never tags by choice (only when a hero is knocked out), to show what one hero alone can do.
// The new moves: everyone but the masher follows the prompts for them (hold Attack, Tag + Attack, Jump at the wall or
// while carrying); the casual bot and the tagger also pick up the pickup weapons lying near, and the tagger uses the
// moves on its own where they fit (a slide at a guarding lobster, a pound into a crowd or an urchin, a spin with a crowd
// round Enzo, the team-up when the meter fills from the ropewalk on). Each run reports its style rank.
// Each runs every built stage over seeds, with assist on (the default) and off. They play the scene goals too: they keep
// under a gull thief (Dora jumps at it when it swoops), fight raiders at a stall, and run ahead of the tide. A clear within the time cap counts;
// retries (both heroes down, the wave restarts) are counted separately. Thresholds: with assist on, the casual bot
// must clear area 1 at least 90% of the time with at most one retry on average, and the masher at least 70%; with
// assist on, the tagger must clear every stage. `--quick` runs fewer seeds. Run after compiling the engine into
// .checks/ (npm test does).
import assert from 'node:assert/strict';
import { BrineGame, STAGES, NO_INPUT, LANE_Z, foeWants } from '../.checks/brinelight-game.js';

const QUICK = process.argv.includes('--quick');
const ONLY = process.argv.find((a) => a.startsWith('--stage='))?.slice(8);
const SEEDS = QUICK ? 6 : 24;
const CAP = 15 * 60 * 60;   // 15 minutes of play per stage at most
function rngOf(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PERSONAS = {
  masher: { rate: 6, miss: 0.1, followPrompt: 0.5, dodge: 0, tagWrong: 0, chain: 0, special: 0, dbl: 0.5, right: false, solo: false, secret: 0, moves: 0, gear: 0 },
  casual: { rate: 5, miss: 0.12, followPrompt: 0.8, dodge: 0.4, tagWrong: 0.5, chain: 0, special: 0.25, dbl: 0.8, right: false, solo: false, secret: 0.2, moves: 0.15, gear: 0.4 },
  tagger: { rate: 5, miss: 0.06, followPrompt: 0.9, dodge: 0.7, tagWrong: 0.9, chain: 0.5, special: 0.6, dbl: 1, right: true, solo: false, secret: 0.6, moves: 0.5, gear: 0.7 },
  soloist: { rate: 5, miss: 0.08, followPrompt: 0, dodge: 0.6, tagWrong: 0, chain: 0, special: 0.3, dbl: 0, right: false, solo: true, secret: 0, moves: 0.3, gear: 0.3 },
};

/** one bot plays one stage; returns the outcome */
export function playStage(stage, seed, assist, persona) {
  const P = PERSONAS[persona], r = rngOf(seed * 131 + persona.length);
  const g = new BrineGame({ stage, seed, assist, skipTalk: true });
  const delay = Math.round((0.2 + r() * 0.1) * 60);
  const seen = [];   // delayed perception
  let held = { mx: 0, mz: 0 }, nextPress = 0, frame = 0, tapPlan = [], chainWait = 0;
  const sp = { tries: 0, landed: 0 };
  const look = () => {
    const p = g.hero();
    return {
      p: { x: p.x, z: p.z, h: p.h, st: p.st, name: p.name, hp: p.hp, weapon: p.weapon?.kind ?? null, holding: !!p.hold, poundCD: p.poundCD },
      gear: g.items.filter((i) => !i.dead && !i.held && i.h < 20 && (i.kind === 'fish' || i.kind === 'oar' || i.kind === 'netbag')).map((i) => ({ x: i.x, z: i.z })),
      foes: g.foes.filter((f) => g.hittable(f) && f.st !== 'ko').map((f) => ({ x: f.x, z: f.z, h: f.h, kind: f.kind, st: f.st, want: foeWants(f), lane: f.lane, grab: f.daze > 0 || (f.kind === 'hermit' && f.shell) })),
      boss: g.boss && { x: g.boss.x, z: g.boss.z, h: g.boss.h, st: g.boss.st, kind: g.boss.kind, tz: g.boss.tz, tx: g.boss.tx },
      rolls: g.rolls.filter((c) => c.kind === 'barrel').map((c) => ({ id: c, z: LANE_Z[c.lane], x: c.x })),
      goal: g.goal && { kind: g.goal.kind, x: g.goal.x, z: g.goal.z, h: g.goal.h, st: g.goal.st, won: g.goal.won, done: g.goal.done, front: g.goal.front },
      prompt: g.prompt, fest: g.fest, combo: g.combo.n, door: g.secretDoor(), lock: g.lock, cam: g.cam, len: g.len, partnerOk: g.partner().hp > 0 && g.partner().ready,
    };
  };
  while (g.mode !== 'clear' && frame < CAP) {
    frame++;
    seen.push(look()); if (seen.length > delay) seen.shift();
    const v = seen[0];
    const inp = { ...NO_INPUT };
    if (g.mode === 'play') {
      const p = v.p, me = g.hero();
      // pick a target: the nearest foe (the tagger prefers foes its hero can hurt), else the boss
      let tgt = null, bd = 1e9;
      for (const f of v.foes) {
        let d = Math.abs(f.x - p.x) + Math.abs(f.z - p.z) * 1.5;
        if (P.right && f.want && f.want !== p.name) d += 400;
        if (d < bd) { bd = d; tgt = f; }
      }
      const boss = v.boss && !['end', 'gone', 'intro'].includes(v.boss.st) ? v.boss : null;
      if (!tgt && boss) tgt = { x: boss.x, z: boss.z, h: boss.h, kind: boss.kind, st: boss.st, want: null };
      // movement toward the target, offset so we stand beside it
      let mx = 0, mz = 0;
      const danger = boss && (['rock', 'roll', 'tell', 'shriek', 'dive', 'wingtell', 'swoop', 'stomp', 'crouch', 'hop', 'stomptell', 'sweepw', 'bubble', 'whipw'].includes(boss.st));
      if (tgt) {
        // Enzo grabs by walking into a dazed foe or a shelled hermit without pressing Attack; the masher never bothers
        held.grabbing = persona !== 'masher' && p.name === 'enzo' && p.st !== 'hold' && tgt.grab && !boss && r() < 0.9;
        const side = p.x < tgt.x ? -1 : 1, want = tgt.x + side * (boss && tgt === boss ? 120 : held.grabbing ? 30 : 75);
        if (Math.abs(want - p.x) > 14) mx = want > p.x ? 1 : -1;
        if (Math.abs(tgt.z - p.z) > 12) mz = tgt.z > p.z ? 1 : -1;
      } else if (!v.lock) {
        mx = 1;   // walk on to the next fight
        if (frame % 30 === 0) { held.stuck = Math.abs(p.x - (held.lastX ?? -99)) < 6 ? (held.stuck || 0) + 1 : 0; held.lastX = p.x; }
        if (held.stuck >= 2) { mz = p.z > 80 ? -1 : 1; if (frame % 20 === 0) inp.atkP = true; if (held.stuck > 6) held.stuck = 0; }
        if (v.door !== null && r() < P.secret / 60 && Math.abs(v.door - p.x) < 300) { held.secret = true; }
        if (held.secret && v.door !== null) { mx = Math.abs(v.door - p.x) > 10 ? Math.sign(v.door - p.x) : 0; mz = -1; }
      }
      // scene goals: keep under the gull thief (a foe in the way still gets hit), and keep ahead of the tide
      const G = v.goal;
      if (G && !G.done && G.kind === 'chase' && !G.won && (!tgt || Math.abs(tgt.x - p.x) > 180)) {
        const tx = G.x - 70; mx = Math.abs(tx - p.x) > 20 ? Math.sign(tx - p.x) : 0; mz = Math.abs(G.z - p.z) > 12 ? Math.sign(G.z - p.z) : 0;
      }
      if (G && !G.done && G.kind === 'tide' && p.x < G.front + 170) { mx = 1; if (Math.abs(p.z - 80) > 50) mz = p.z > 80 ? -1 : 1; }
      // carrying out a prompt that points somewhere (a barrel to pick up, a hole to plug): walk there, don't punch
      // a pickup weapon lying near, with nobody in the way: go and get it
      if (P.gear && !p.weapon && !p.holding && !held.goto && v.gear.length && (!tgt || Math.abs(tgt.x - p.x) > 200)) {
        const it = v.gear.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b));
        if (Math.abs(it.x - p.x) < 320 && r() < P.gear / 4) held.goto = { x: it.x, z: it.z, n: 50 };
      }
      if (held.goto && held.goto.n > 0) {
        held.goto.n--; held.grabbing = true;
        mx = Math.abs(held.goto.x - p.x) > 16 ? Math.sign(held.goto.x - p.x) : 0; mz = Math.abs(held.goto.z - p.z) > 10 ? Math.sign(held.goto.z - p.z) : 0;
      }
      // a barrel rumbling down the belt in my lane: some people step out of it (once each), the masher never does
      for (const c of v.rolls) {
        if (held.seenRoll?.has(c.id) || Math.abs(c.z - p.z) > 30 || c.x < p.x - 40) continue;
        (held.seenRoll ??= new Set()).add(c.id);
        if (r() < P.dodge) held.laneMove = { mz: p.z > 80 ? -1 : 1, n: 26 };
      }
      if (held.laneMove && held.laneMove.n > 0) { held.laneMove.n--; mz = held.laneMove.mz; }
      // dodging a marked lane or a dive shadow
      if (danger && r() < P.dodge * 0.15) held.dodgeT = 30;
      if (held.dodgeT > 0 && boss) { held.dodgeT--; const tz = boss.st === 'rock' || boss.st === 'roll' || boss.st === 'wingtell' || boss.st === 'swoop' ? boss.z : boss.tz ?? boss.z; mz = p.z > tz ? 1 : -1; if (Math.abs(p.z - tz) > 70) mz = 0; if ((boss.st === 'roll' || boss.st === 'swoop' || boss.st === 'sweepw' || boss.st === 'whipw') && Math.abs(boss.x - p.x) < 260 && (p.name === 'dora' || boss.st !== 'roll')) inp.jmpP = true; }
      // human hands: a press every so often, with fumbles
      if (frame >= nextPress && g.mode === 'play' && tapPlan.length === 0) {
        nextPress = frame + Math.round(60 / P.rate * (0.7 + r() * 0.6));
        const pr = v.prompt;
        const follow = pr && r() < P.followPrompt;
        const near = tgt && Math.abs(tgt.x - p.x) < 150 && Math.abs(tgt.z - p.z) < 40;
        const crowd = v.foes.filter((f) => Math.abs(f.x - p.x) < 200 && Math.abs(f.z - p.z) < 60 && f.h < 40);
        if (follow && pr.act === 'hold') held.holdAtk = 24;
        else if (follow && pr.act === 'team') { inp.tagP = true; inp.atkP = true; }
        else if (g.moves >= 3 && P.moves && v.fest >= 100 && v.partnerOk && near && r() < P.moves) { inp.tagP = true; inp.atkP = true; }
        else if (g.moves >= 2 && P.moves && !p.weapon && !p.holding && p.h <= 0 && r() < P.moves * 0.5 && (
          (p.name === 'dora' && crowd.some((f) => f.kind === 'lobster' && (f.st === 'block' || f.st === 'idle' || f.st === 'walk'))) ||
          (p.name === 'enzo' && p.poundCD <= 0 && (crowd.length >= 3 || crowd.some((f) => f.kind === 'urchin' && f.st !== 'roll'))))) held.holdAtk = 24;
        else if (g.moves >= 1 && P.moves && p.name === 'enzo' && p.st === 'hold' && crowd.length >= 2 && r() < P.moves) inp.jmpP = true;
        else if (follow && (pr.act === 'grab' || pr.act === 'plug') && pr.x !== undefined && boss) held.goto = { x: pr.x, z: pr.z, n: 50 };
        else if (follow && pr.act === 'move' && Math.abs(pr.dir) === 2) held.laneMove = { mz: Math.sign(pr.dir), n: 24 };
        else if (follow && pr.act === 'tag') inp.tagP = true;
        else if (follow && pr.act === 'jmp') { inp.jmpP = true; held.airAtk = 10 + Math.round(r() * 8); }
        else if (follow && pr.act === 'dbl' && r() < P.dbl) { inp.atkP = true; inp.jmpP = true; }
        else if (follow && pr.act === 'special' && (p.st === 'idle' || p.st === 'walk') && r() < Math.max(0.5, P.special)) tapPlan = planSpecial(pr.dir || 1, r);
        else if (P.dbl && v.fest >= 100 && v.partnerOk && near && r() < P.dbl * 0.5) { inp.atkP = true; inp.jmpP = true; }
        else if (!P.solo && P.tagWrong && v.partnerOk && tgt && tgt.want && tgt.want !== p.name && near && r() < P.tagWrong) inp.tagP = true;
        else if (!P.solo && P.chain && v.combo >= 3 && v.partnerOk && r() < P.chain) inp.tagP = true;
        else if (P.special && tapPlan.length === 0 && (p.st === 'idle' || p.st === 'walk') && lineAhead(v) && r() < P.special * 0.5) tapPlan = planSpecial(lineAhead(v), r);
        else if (tgt && tgt.h > 40 && p.name === 'dora' && near) { inp.jmpP = true; held.airAtk = 8 + Math.round(r() * 8); }
        else if (G && G.kind === 'chase' && !G.won && G.st === 'swoop' && p.name === 'dora' && persona !== 'masher' && Math.abs(G.x - p.x) < 150 && p.h <= 0) { inp.jmpP = true; held.airAtk = 10 + Math.round(r() * 8); }
        else if (near && !held.grabbing) inp.atkP = r() > P.miss;
        else if (!tgt && r() < 0.05) inp.jmpP = true;
        if (persona === 'masher' && r() < 0.08) inp.jmpP = true;
        if (P.solo && inp.tagP) inp.tagP = false;
      }
      if (held.airAtk > 0) { held.airAtk--; if (held.airAtk === 0) inp.atkP = true; }
      if (held.holdAtk > 0) { if (held.holdAtk === 24) inp.atkP = true; held.holdAtk--; inp.atkH = true; }
      // the special: double-tap toward the line, jump, then attack, with human timing
      if (tapPlan.length) {
        const s = tapPlan.shift();
        mx = s.mx; mz = 0;
        if (s.jmp) inp.jmpP = true;
        if (s.atk) { inp.atkP = true; sp.tries++; held.watch = 90; held.before = g.stats.specialHits; }
      }
      if (held.watch > 0) { held.watch--; if (held.watch === 0 && g.stats.specialHits > held.before) sp.landed++; }
      inp.mx = mx; inp.mz = mz;
      void me; void chainWait;
    }
    g.step(inp);
  }
  return { goals: g.stats.goals, goalsLost: g.stats.goalsLost, overboard: g.stats.overboard, cleared: g.mode === 'clear', time: g.stats.time, retries: g.stats.retries, dmg: g.stats.dmg, specials: g.stats.specials, specialHits: g.stats.specialHits, specialLanded: g.stats.specialLanded, spTries: sp.tries, spLanded: sp.landed, tags: g.stats.tags, chains: g.stats.tagChains, tinks: g.stats.tinks, dbls: g.stats.dbls, found: g.newFound.length, rank: g.styleRank(), moves: g.stats.wallKicks + g.stats.spins + g.stats.slides + g.stats.pounds + g.stats.teams, weaponHits: g.stats.weaponHits, hazards: g.stats.hazards, elites: g.stats.elites, bossTime: g.stats.bossTime, frames: frame, game: g };
}
function lineAhead(v) {
  for (const dir of [1, -1]) {
    const n = v.foes.filter((f) => (f.x - v.p.x) * dir > 60 && (f.x - v.p.x) * dir < 480 && Math.abs(f.z - v.p.z) < 40 && f.h < 30).length;
    if (n >= 3) return dir;
  }
  return 0;
}
/** frames of stick for a double tap, a jump during the dash and an attack in the air, with human gaps */
function planSpecial(dir, r) {
  const out = [];
  for (let i = 0; i < 3 + Math.floor(r() * 4); i++) out.push({ mx: 0 });   // let go of the stick first
  const tap = 4 + Math.floor(r() * 3), gap = 4 + Math.floor(r() * 5);
  for (let i = 0; i < tap; i++) out.push({ mx: dir });
  for (let i = 0; i < gap; i++) out.push({ mx: 0 });
  for (let i = 0; i < 5; i++) out.push({ mx: dir });
  out.push({ mx: dir, jmp: true });
  for (let i = 0; i < 6 + Math.floor(r() * 6); i++) out.push({ mx: dir });
  out.push({ mx: dir, atk: true });
  return out;
}

// ─────────────────────────────────────────── the report
const MAIN = process.argv[1]?.endsWith('brinelight-bot.mjs');
const stages = ONLY ? [ONLY] : Object.keys(STAGES);
const table = {};
if (MAIN) for (const assist of [true, false]) {
  for (const persona of Object.keys(PERSONAS)) {
    for (const st of stages) {
      const res = [];
      for (let s = 1; s <= SEEDS; s++) res.push(playStage(st, s, assist, persona));
      const n = res.length, cl = res.filter((x) => x.cleared);
      const row = {
        clear: cl.length / n, clean: res.filter((x) => x.cleared && x.retries === 0).length / n,
        retries: res.reduce((a, x) => a + x.retries, 0) / n, dmg: res.reduce((a, x) => a + x.dmg, 0) / n, time: cl.length ? cl.reduce((a, x) => a + x.time, 0) / cl.length : 0,
        spTries: res.reduce((a, x) => a + x.spTries, 0), spDone: res.reduce((a, x) => a + x.specials, 0), spLanded: res.reduce((a, x) => a + x.specialLanded, 0), specialHits: res.reduce((a, x) => a + x.specialHits, 0) / n,
        chains: res.reduce((a, x) => a + x.chains, 0) / n, tinks: res.reduce((a, x) => a + x.tinks, 0) / n, dbls: res.reduce((a, x) => a + x.dbls, 0) / n,
        goals: res.reduce((a, x) => a + x.goals, 0), goalsLost: res.reduce((a, x) => a + x.goalsLost, 0), overboard: res.reduce((a, x) => a + x.overboard, 0) / n,
        rank: res.reduce((a, x) => a + x.rank, 0) / n, ranks: [0, 1, 2, 3].map((k) => res.filter((x) => x.rank === k).length), moves: res.reduce((a, x) => a + x.moves, 0) / n,
        weaponHits: res.reduce((a, x) => a + x.weaponHits, 0) / n, hazards: res.reduce((a, x) => a + x.hazards, 0) / n, elites: res.reduce((a, x) => a + x.elites, 0) / n,
        boss: Object.values(cl[0]?.bossTime ?? {})[0] ? cl.reduce((a, x) => a + (Object.values(x.bossTime)[0] || 0), 0) / cl.length : 0,
      };
      table[`${assist ? 'on' : 'off'}|${persona}|${st}`] = row;
      console.log(`assist ${assist ? 'on ' : 'off'} ${persona.padEnd(8)} ${st}: clear ${(row.clear * 100).toFixed(0).padStart(3)}%  no-retry ${(row.clean * 100).toFixed(0).padStart(3)}%  retries ${row.retries.toFixed(2)}  hurt ${row.dmg.toFixed(0).padStart(3)}  time ${row.time.toFixed(0).padStart(4)}s  boss ${row.boss.toFixed(0).padStart(3)}s  chains ${row.chains.toFixed(1)}  tinks ${row.tinks.toFixed(0)}  special: ${row.spTries} tried, ${row.spDone} done, ${row.spLanded} landed, ${row.specialHits.toFixed(1)} foes hit/run  dbl ${row.dbls.toFixed(1)}  goals ${row.goals} won, ${row.goalsLost} lost, ${row.overboard.toFixed(1)} overboard/run  style C/B/A/S ${row.ranks.join('/')}  moves ${row.moves.toFixed(1)}  weapon hits ${row.weaponHits.toFixed(1)}  hazards ${row.hazards.toFixed(1)}  elites ${row.elites.toFixed(1)}`);
    }
  }
}
if (MAIN && !ONLY) {
  const a1 = ['1-1', '1-2', '1-3'];
  const avg = (p, k, a = 'on') => a1.reduce((s, st) => s + table[`${a}|${p}|${st}`][k], 0) / a1.length;
  console.log(`area 1, assist on: casual clears ${(avg('casual', 'clear') * 100).toFixed(0)}% (${avg('casual', 'retries').toFixed(2)} retries), masher ${(avg('masher', 'clear') * 100).toFixed(0)}%`);
  assert.ok(avg('casual', 'clear') >= 0.9, 'a casual player clears area 1 easily');
  assert.ok(avg('casual', 'retries') <= 1, 'a casual player rarely retries in area 1');
  assert.ok(avg('masher', 'clear') >= 0.7, 'a masher gets through area 1 with assist on');
  for (const st of stages) assert.ok(table[`on|tagger|${st}`].clear >= 0.9, `the tagger clears ${st}`);
  // with assist on the casual player and the tagger get through every stage without retrying, and the masher with a
  // retry now and then
  for (const st of stages) {
    for (const p of ['casual', 'tagger']) assert.ok(table[`on|${p}|${st}`].clean >= 0.9, `the ${p} clears ${st} without a retry`);
    assert.ok(table[`on|masher|${st}`].clear >= 0.8, `the masher gets through ${st}`);
  }
  // the style rank spreads: a masher repeating one attack ranks lower than the tagger mixing everything
  const rk = (p) => stages.reduce((s, st) => s + table[`on|${p}|${st}`].rank, 0) / stages.length;
  console.log(`style rank (0 C … 3 S), assist on: masher ${rk('masher').toFixed(2)}, casual ${rk('casual').toFixed(2)}, tagger ${rk('tagger').toFixed(2)}, soloist ${rk('soloist').toFixed(2)}`);
  assert.ok(rk('tagger') > rk('masher') && rk('masher') > rk('soloist'), 'mixing it up ranks higher than mashing, and both higher than one hero alone');
  console.log('brinelight bots ok');
}

// Above & Below bots: play Chapter One through the engine with key presses and human reaction times. Every bot looks
// at the game, then waits 200–300 ms of game time before it looks again; taps last 60–110 ms; it fumbles now and then
// (a wrong-way tap before a walk, an overshoot), and it never sees anything the screen doesn't show. Three kinds:
// - casual: solo, knows the answer; swaps to whichever hero the game calls for (holding the act key through a swap is
//   the quick hand-off). One run in three is reckless and ignores the hawk.
// - pair: two players on one keyboard (Dora on WASD + Space + E, Enzo on the arrows + / + .), each with their own hands.
// - explorer: solo, with no answer key: follows only the on-screen cues (glints, calling heroes, key prompts after
//   idling, the ghost demo), wanders, and tries buttons when stuck.
// Ported from the prototype's Playwright bots (bots2.mjs), with a virtual clock instead of a browser. One change: the explorer
// waits to land before trying its next button (the prototype's pressed Act mid-jump in a fixed rhythm). The prototype's
// final batch: casual with assist 3/3 (118–137 s), casual without assist 3/3 (186–219 s), pair 3/3 (127–138 s),
// explorer with assist 3/3 (458–557 s), explorer without assist 1/2. Thresholds (seeds per row: 6, or 2 with --quick;
// explorers: 3, or 1 with --quick): casual with assist clears every run with a median under 200 s; casual without
// assist clears at least two runs in three; the pair clears every run; the explorer with assist clears at least two in
// three (with --quick, its one run must clear). The explorer without assist is reported only.
// Run after compiling the engine into .checks/ (npm run bot:above does).
import assert from 'node:assert/strict';
import { AboveGame, Keys } from '../.checks/above-game.js';

const QUICK = process.argv.includes('--quick');
const ONLY = process.argv.find((a) => a.startsWith('--kind='))?.slice(7);
const VERBOSE = process.argv.includes('--verbose');
const SOLO = { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown', jump: 'Space', act: 'KeyE', swap: 'ShiftLeft' };
const P1 = { l: 'KeyA', r: 'KeyD', u: 'KeyW', d: 'KeyS', jump: 'Space', act: 'KeyE' };
const P2 = { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown', jump: 'Slash', act: 'Period' };
const BUSH = [800, 1150];

function rngOf(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let R = Math.random;
const rnd = (a, b) => a + R() * (b - a);

/** a virtual clock: bot code runs until it sleeps; the game steps until the earliest sleeper is due */
function clock(g, keys) {
  const waiters = []; let seq = 0;
  const sleep = (ms) => new Promise((res) => waiters.push({ at: g.t + ms / 1000, res, seq: seq++ }));
  const drive = async (done) => {
    for (;;) {
      await new Promise((r) => setImmediate(r));
      if (done()) return;
      if (!waiters.length) continue;
      waiters.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const w = waiters.shift();
      while (g.t < w.at - 1e-9) { const [a, b] = keys.take(); g.step(a, b); }
      w.res();
    }
  };
  return { sleep, drive };
}

class Hands {
  constructor(keys, map, sleep) { this.keys = keys; this.k = map; this.sleep = sleep; this.down = new Set(); }
  async hold(b, on) {
    const c = this.k[b]; if (!c) return;
    if (on && !this.down.has(c)) { this.down.add(c); this.keys.down(c); } else if (!on && this.down.has(c)) { this.down.delete(c); this.keys.up(c); }
  }
  async tap(b) { await this.hold(b, true); await this.sleep(rnd(60, 110)); await this.hold(b, false); }
  async dir(d) {
    if (d && R() < 0.06) { await this.hold(d > 0 ? 'l' : 'r', true); await this.hold(d > 0 ? 'r' : 'l', false); await this.sleep(rnd(80, 160)); }
    await this.hold('l', d < 0); await this.hold('r', d > 0);
  }
  async moveOnly() { for (const b of ['l', 'r', 'u', 'd', 'jump']) await this.hold(b, false); }
  async release() { for (const b of ['l', 'r', 'u', 'd', 'jump', 'act']) await this.hold(b, false); }
  async press(b) { await this.hold(b, false); await this.sleep(rnd(40, 80)); await this.hold(b, true); }   // a fresh press, then keep holding
}

// ───────── knows what to do for one hero (casual solo uses two of these on one pair of hands; a pair gives each its own)
function knower(hands, id, sleep, opts = {}) {
  let lastX = null, stillT = 0;
  const go = async (h, gx, tol = 22) => {
    const dx = gx - h.x;
    if (Math.abs(dx) <= tol) { if (R() < 0.25) await sleep(rnd(60, 160)); await hands.dir(0); return true; }
    await hands.hold('u', false); await hands.hold('d', false);
    if (h.state === 'brace') await hands.hold('act', false);
    await hands.dir(Math.sign(dx));
    if (lastX != null && Math.abs(h.x - lastX) < 2 && h.state === 'free') stillT++; else stillT = 0;
    lastX = h.x;
    if (stillT >= 3) { stillT = 0; if (id === 'enzo' && R() < 0.6) await hands.tap('act'); else await hands.tap('jump'); }
    return false;
  };
  async function boss(s, h) {
    const B = s.boss;
    if (id === 'enzo') {
      if (B.st === 'wind' && Math.abs(h.x - B.x) < 380) { await hands.dir(0); await hands.hold('d', true); return; }
      if (B.st === 'swipe') { await hands.hold('d', true); return; }
      await hands.hold('d', false);
      if (B.wave != null && Math.abs(h.x - B.wave) < 140 && Math.sign(h.x - B.wave) === Math.sign(h.x - B.x)) { await hands.tap('jump'); return; }
      for (const c of B.clods) if (Math.abs(h.x - c) < 60) { await go(h, c + (h.x < c ? -110 : 110), 10); return; }
      if (B.st === 'dizzy') { if (await go(h, B.x + (h.x < B.x ? -170 : 170), 30)) await hands.tap('act'); return; }
      const want = B.x + (h.x < B.x ? -300 : 300);
      if (Math.abs(h.x - B.x) < 260) await go(h, Math.max(110, Math.min(1430, want)), 30); else await hands.dir(0);
      return;
    }
    if (B.st === 'rings') { await go(h, Math.max(130, Math.min(1400, B.nx + (h.x < B.nx ? -240 : 240))), 20); return; }
    if (B.st === 'nose') { if (await go(h, B.nx, 24)) await hands.tap('act'); return; }
    await hands.dir(0);
  }
  return async function step(s) {
    const h = s[id], r = s.routes && s.routes[id], b = s.beatId, room = s.room;
    if (!r || h.state === 'carried' || h.state === 'clamber' || h.state === 'hurt') { await hands.moveOnly(); return; }
    // the hawk: hide in a bush (stream) or wait at the bank edge (meadow)
    if (id === 'dora' && s.hawk.on && (s.hawk.phase === 'warn' || s.hawk.phase === 'pass') && !opts.reckless) {
      if (room === 'meadow' && b === 'hawk' && h.x < 1200 && h.y < 300) { await hands.dir(0); return; }
      if (room === 'stream' && h.x > 600) {
        const bx = BUSH.reduce((a, c) => (Math.abs(c - h.x) < Math.abs(a - h.x) ? c : a));
        if (Math.abs(bx - h.x) <= 450) { if (h.state === 'brace') await hands.hold('act', false); if (await go(h, bx, 20)) await hands.hold('d', true); return; }
      }
    }
    if (id === 'dora') await hands.hold('d', false);
    // room-specific know-how
    if (room === 'meadow' && id === 'enzo' && b === 'ride') {
      if (s.water <= 652) { await hands.dir(1); return; }
      if (h.state !== 'ride' && Math.abs(h.x - s.leaf.x) > 20 && s.water > 880) await go(h, s.leaf.x); else await hands.dir(0);
      return;
    }
    if (room === 'meadow' && b === 'door') { await go(h, 1470, 40); return; }
    if (room === 'orchard' && b === 'bridge' && id === 'dora' && (s.lift < 0.92 || s.enzo.state !== 'brace') && h.x < 500) { await go(h, 470, 16); return; }
    if (room === 'stream' && b === 'lever' && id === 'enzo') {
      if (h.state === 'ride') { await hands.dir(1); return; }
      if (s.water > 640 && h.x < 465) { await go(h, 436, 16); return; }
    }
    if (room === 'stream' && b === 'clay' && r.id !== 'through') {
      if (id === 'dora') { if (s.loose) { await go(h, r.tx, 30); return; } }
      else {
        if (!s.loose) { await go(h, r.tx - 10, 26); return; }
        if (await go(h, r.tx, 22)) { await hands.dir(1); await sleep(rnd(60, 120)); await hands.dir(0); await hands.tap('act'); }
        return;
      }
    }
    if (room === 'den') { await boss(s, h); return; }
    // generic: go to the route target and do the act
    if (!(await go(h, r.tx, r.act === 'down' ? 14 : 22))) return;
    if (r.act === 'act') await hands.tap('act');
    else if (r.act === 'hold') { if (h.state !== 'brace') await hands.press('act'); }
    else if (r.act === 'up') { await hands.hold('u', true); await sleep(rnd(900, 1400)); await hands.hold('u', false); await hands.dir(1); await sleep(300); }
    else if (r.act === 'down') { await hands.hold('d', true); await sleep(rnd(300, 500)); await hands.hold('d', false); }
    else if (r.act === 'move' && r.id === 'pass') await hands.dir(1);
  };
}

async function runCasual(g, keys, C, cap, opts) {
  const H = new Hands(keys, SOLO, C.sleep); const k = { dora: knower(H, 'dora', C.sleep, opts), enzo: knower(H, 'enzo', C.sleep, opts) };
  let lastRoom = '';
  for (;;) {
    const s = g.snapshot(); if (s.mode !== 'play' || s.t > cap) return;
    if (s.leaving || s.room !== lastRoom) { lastRoom = s.room; await H.release(); await C.sleep(300); continue; }
    const need = s.need;
    if (need && s.active !== need) {
      // a quick hand-off: keep holding the action if the current hero is bracing
      if (s[s.active].state === 'brace') await H.moveOnly(); else await H.release();
      await C.sleep(rnd(150, 350)); await H.tap('swap');
    } else if (need) await k[need](s);
    await C.sleep(rnd(200, 300));
  }
}
async function runPair(g, keys, C, cap, opts) {
  const A = new Hands(keys, P1, C.sleep), B = new Hands(keys, P2, C.sleep);
  const kd = knower(A, 'dora', C.sleep, opts), ke = knower(B, 'enzo', C.sleep, opts);
  let done = false;
  const loop = async (step) => { while (!done) { const st = g.snapshot(); if (st.mode !== 'play' || st.t > cap) { done = true; break; } if (!st.leaving) await step(st); await C.sleep(rnd(200, 300)); } };
  await Promise.all([loop(kd), loop(ke)]);
}
// ───────── the explorer: no answer key, only what is on screen (glints, calls, key prompts, the ghost, bubbles)
async function runExplorer(g, keys, C, cap) {
  const H = new Hands(keys, SOLO, C.sleep), sleep = C.sleep;
  let wallX = null, wallN = 0, wander = 0, wdir = 1, lastSwap = -9, lastBeat = '', beatStart = 0, paused = 0, tries = 0, focus = null, looked = false, holdUntil = 0;
  const order = ['act', 'u', 'd', 'jump'];
  for (;;) {
    const s = g.snapshot(); if (s.mode !== 'play' || s.t > cap) return;
    if (s.leaving) { await H.release(); await sleep(300); continue; }
    const me = s[s.active], other = s.active === 'dora' ? 'enzo' : 'dora', key = s.room + s.beatId;
    if (key !== lastBeat) { lastBeat = key; beatStart = s.t; looked = false; tries = 0; focus = null; }
    const stuck = s.t - beatStart;
    if (s.t < holdUntil) { await sleep(250); continue; }   // still holding the act key on purpose
    if (stuck > 14 && !looked) { looked = true; await H.release(); paused = s.t + rnd(7.5, 9); }
    if (s.t < paused && !s.prompt) { await sleep(250); continue; }
    paused = 0;
    // a hawk overhead: anyone who has been carried off once runs for the nearest bush
    if (s.active === 'dora' && s.room === 'stream' && s.stats.hawkCatches > 0 && (s.hawk.phase === 'warn' || s.hawk.phase === 'pass')) {
      const bx = BUSH.reduce((a, c) => (Math.abs(c - me.x) < Math.abs(a - me.x) ? c : a));
      if (Math.abs(bx - me.x) > 20) await H.dir(Math.sign(bx - me.x)); else { await H.dir(0); await H.hold('d', true); }
      await sleep(250); continue;
    }
    await H.hold('d', false);
    let cue = null;
    if (s.prompt && s.prompt.who === s.active) cue = { kind: 'prompt', ...s.prompt };
    else if (s.ghostAt) cue = { kind: 'ghost', ...s.ghostAt };
    else if (s.calls.some((c) => c.calling && c.who === other) && s.t - lastSwap > 3 && R() < 0.5) cue = { kind: 'swap' };
    if (cue && cue.kind === 'prompt') {
      if (cue.what === 'swap') { await H.moveOnly(); await H.tap('swap'); lastSwap = s.t; }
      else if (cue.what === 'move') { await H.hold('act', false); await H.dir(cue.dir); }
      else if (cue.what === 'act') { await H.dir(0); if (cue.hold) { await H.press('act'); holdUntil = s.t + rnd(2.5, 4); } else await H.tap('act'); }
      else if (cue.what === 'up') { await H.dir(0); await H.hold('u', true); await sleep(1200); await H.hold('u', false); await H.dir(1); await sleep(300); }
      else if (cue.what === 'down') { await H.dir(0); await H.hold('d', true); await sleep(400); await H.hold('d', false); }
    } else if (cue && (cue.kind === 'swap' || (cue.kind === 'ghost' && cue.who !== s.active && R() < 0.7))) {
      await H.moveOnly(); await H.tap('swap'); lastSwap = s.t;
    } else {
      const mine = s.glints.filter((gl) => (s.active === 'dora' ? gl[1] < 470 : gl[1] > 440));
      if (cue && cue.kind === 'ghost') focus = [cue.x, cue.y];
      else if (mine.length && R() < 0.7) focus = mine.reduce((a, gl) => (Math.abs(gl[0] - me.x) < Math.abs(a[0] - me.x) ? gl : a));
      else if (!mine.length && s.t - lastSwap > 6 && R() < 0.25) { await H.release(); await H.tap('swap'); lastSwap = s.t; focus = null; await sleep(250); continue; }
      if (focus) {
        const dx = focus[0] - me.x;
        if (Math.abs(dx) > 20 && me.x === wallX) wallN++; else wallN = 0;
        wallX = me.x;
        if (Math.abs(dx) > 20 && wallN >= 3) { wallN = 0; await H.tap(R() < 0.5 ? 'jump' : 'act'); await H.hold('u', true); await sleep(rnd(500, 900)); await H.hold('u', false); }
        else if (Math.abs(dx) > 20) { await H.hold('act', false); await H.dir(Math.sign(dx)); if (R() < 0.12) await H.tap('jump'); if (s.active === 'enzo' && R() < 0.25) await H.tap('act'); }
        else if (!me.ground) await H.dir(0);   // wait to land before trying the next button
        else {
          await H.dir(0); const b = order[tries++ % order.length];
          if (b === 'act' && tries % 8 === 1) { await H.press('act'); holdUntil = s.t + rnd(2, 3.5); }   // sometimes you hold a button to see what happens
          else if (b === 'u' || b === 'd') { await H.hold(b, true); await sleep(rnd(500, 1100)); await H.hold(b, false); if (b === 'u') { await H.dir(1); await sleep(300); await H.dir(0); } }
          else await H.tap(b);
        }
      } else {
        if (s.t > wander) { wander = s.t + rnd(1, 3); wdir = R() < 0.5 ? -1 : 1; }
        await H.hold('act', false); await H.dir(wdir); if (R() < 0.1) await H.tap('jump'); if (R() < 0.1) await H.tap('act');
      }
    }
    await sleep(rnd(200, 300));
  }
}

/** one bot plays the chapter from room `room`; returns the outcome */
export async function play(kind, seed, assist, room = 0) {
  R = rngOf(seed * 977 + kind.length * 31 + (assist ? 7 : 0));
  const g = new AboveGame({ seed, assist });
  const keys = new Keys();
  g.start(kind === 'pair', room); keys.twoP = g.twoP;
  const C = clock(g, keys), cap = kind === 'explorer' ? 1080 : 720;
  const opts = { reckless: kind === 'casual' && seed % 3 === 2 };
  let finished = false;
  const bot = (kind === 'pair' ? runPair : kind === 'explorer' ? runExplorer : runCasual)(g, keys, C, cap, opts).then(() => { finished = true; });
  await C.drive(() => finished);
  await bot;
  const st = g.stats, s = g.snapshot();
  return { kind, seed, assist, cleared: g.mode === 'win', time: g.mode === 'win' ? +g.clearT.toFixed(1) : null, stuckAt: g.mode === 'win' ? null : `${s.room}:${s.beatId}`,
    rooms: st.rooms, swaps: st.swaps, bumps: st.bumps, hawk: st.hawkCatches, prompts: st.keyPrompts, ghosts: st.ghosts, autoDist: Math.round(st.autoDist) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [
    ['casual', true, QUICK ? 2 : 6], ['casual', false, QUICK ? 2 : 6], ['pair', true, QUICK ? 2 : 6],
    ['explorer', true, QUICK ? 1 : 3], ['explorer', false, QUICK ? 0 : 2],
  ].filter((r) => !ONLY || r[0] === ONLY);
  const out = {};
  for (const [kind, assist, n] of rows) {
    const res = [];
    for (let i = 1; i <= n; i++) { const r = await play(kind, i, assist); res.push(r); if (VERBOSE) console.log(JSON.stringify(r)); }
    if (!n) continue;
    const won = res.filter((r) => r.cleared), times = won.map((r) => r.time).sort((a, b) => a - b), med = times.length ? times[Math.floor(times.length / 2)] : null;
    const bumps = res.reduce((a, r) => a + r.bumps.dora + r.bumps.enzo, 0) / res.length, hawk = res.reduce((a, r) => a + r.hawk, 0) / res.length;
    out[`${kind}-${assist ? 'assist' : 'noassist'}`] = { won: won.length, n, med };
    console.log(`${kind.padEnd(8)} assist ${assist ? 'on ' : 'off'}  cleared ${won.length}/${n}  median ${med ?? '-'} s  range ${times.length ? `${times[0]}–${times[times.length - 1]}` : '-'} s  bumps ${bumps.toFixed(1)}  hawk ${hawk.toFixed(1)}${won.length < n ? `  stuck: ${res.filter((r) => !r.cleared).map((r) => r.stuckAt).join(', ')}` : ''}`);
  }
  const need = (k, f, msg) => { if (out[k]) assert.ok(f(out[k]), `${k}: ${msg} (${JSON.stringify(out[k])})`); };
  need('casual-assist', (o) => o.won === o.n && o.med < 200, 'casual with assist must clear every run, median under 200 s');
  need('casual-noassist', (o) => o.won * 3 >= o.n * 2, 'casual without assist must clear two runs in three');
  need('pair-assist', (o) => o.won === o.n, 'the pair must clear every run');
  need('explorer-assist', (o) => (QUICK ? o.won === o.n : o.won * 3 >= o.n * 2), 'the explorer with assist must clear');
  console.log('above bots: ok');
}

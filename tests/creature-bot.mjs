// Every Creature bots, playing like people rather than perfect players (ported from the prototype's bot.js). Both react
// 200–300 ms late, overshoot, and fumble about 10% of their decisions (a random step or a stray Space).
// - casual: follows the game's own idle key prompts (the hint a stuck player sees) promptly.
// - explorer: doesn't know the answers. It wanders and tries things (moves, Space, Up, forms, swaps, calls), pauses
//   (the game shows prompts and ghost demos to idle players), then follows the prompts for a while and wanders off again.
// Each plays the whole chapter (four screens) with assist on, the default, solo with the partner AI. A screen that takes
// more than 7 minutes counts as stuck. Thresholds (the prototype's casual bot cleared 10 of 10 in about 4.2 minutes):
// the casual bot must clear the chapter every time and average under 6 minutes; the explorer, which wanders off
// mid-solution by design, must clear at least half the time (it clears 6 of 10 seeds, most often losing the Storm
// Falls knots to the lightning while it wanders). `--quick` runs fewer seeds. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { newGame, step, tickModes, tickFx, snapshot, G, SCR, H, O, NOINP, DT } from '../.checks/creature-game.js';

const QUICK = process.argv.includes('--quick');
const SEEDS = QUICK ? 4 : 10;
const CAP = 420 * 60;   // frames per screen before it counts as stuck

export function makeBot(kind, seed) {
  let s = seed * 9301 + 49297; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const B = { t: 0, nextDec: 0, q: [], hold: { mx: 0, mxT: 0, my: 0, myT: 0, act: 0 }, lastD: 0, flip: 0, cool: {}, phase: 'wander', phT: 4 + r() * 6, wdir: 1 };
  const delay = () => .2 + r() * .1;
  function decide() {
    if (kind === 'explorer') {
      B.phT -= .25;
      if (B.phase === 'wander' && B.phT <= 0) { B.phase = 'pause'; B.phT = 6.5 + r() * 2; }
      else if (B.phase === 'pause' && B.phT <= 0) { B.phase = 'follow'; B.phT = 7 + r() * 6; }
      else if (B.phase === 'follow' && B.phT <= 0) { B.phase = 'wander'; B.phT = 6 + r() * 10; }
      if (B.phase === 'pause') return null;
      if (B.phase === 'wander') {
        const x = r();
        if (x < .55) { if (r() < .25) B.wdir = -B.wdir; return { k: 'move', d: B.wdir }; }
        if (x < .72) return { k: 'act' };
        if (x < .8) return { k: 'up' };
        if (x < .87) { const fs = ['chin', 'tort', 'frog', 'bird', 'beetle', 'fox', 'otter'].filter((f) => f === 'chin' || G.friends[f]); return { k: 'form', f: fs[(r() * fs.length) | 0] }; }
        if (x < .91) return { k: 'swap' };
        if (x < .95) return { k: 'call' };
        if (x < .98) return { k: 'down' };
        return null;
      }
    }
    return SCR.hint();
  }
  const push = (at, act) => B.q.push({ at, ...act });
  B.tick = function (dt) {
    B.t += dt;
    const inp = { ...NOINP };
    if (G.mode !== 'play') return inp;
    if (B.t >= B.nextDec) {
      B.nextDec = B.t + .22 + r() * .1;
      let h = decide();
      const a = H();
      if (r() < .1) h = r() < .5 ? { k: 'move', d: r() < .5 ? -1 : 1, fumble: 1 } : { k: 'act', fumble: 1 };
      if (h) {
        const at = B.t + delay();
        if (h.k === 'move') {
          const fine = B.lastD && h.d !== B.lastD; B.lastD = h.d; B.flip = fine ? 3 : Math.max(0, B.flip - 1);
          push(at, { mx: h.d, dur: B.flip ? .06 + r() * .05 : .38 });
        } else if (h.k === 'act') {
          const hold = (a.form === 'fox' || a.form === 'tort') && !h.fumble;
          push(at, { act: hold ? .45 : .1, edge: !(hold && B.hold.act > B.t) });
          if (h.d) push(at, { mx: h.d, dur: .3 });
        } else if (h.k === 'up') push(at, { up: 1, my: -1, dur: .4 });
        else if (h.k === 'down') { push(at, { my: 1, dur: .45 }); if (h.d) push(at, { mx: h.d, dur: .4 }); }
        else if (h.k === 'form') { if (!(B.cool.form > B.t)) { B.cool.form = B.t + 1; push(at, { form: h.f }); } }
        else if (h.k === 'swap') { if (!(B.cool.swap > B.t)) { B.cool.swap = B.t + 1.2; push(at, { swap: 1 }); } }
        else if (h.k === 'call') { if (!(B.cool.call > B.t)) { B.cool.call = B.t + 1.6; push(at, { call: 1 }); } }
      }
    }
    const due = B.q.filter((e) => e.at <= B.t); B.q = B.q.filter((e) => e.at > B.t);
    for (const e of due) {
      if (e.mx != null) { B.hold.mx = e.mx; B.hold.mxT = B.t + e.dur; }
      if (e.my != null) { B.hold.my = e.my; B.hold.myT = B.t + e.dur; }
      if (e.up) inp.upP = true;
      if (e.act) { if (e.edge !== false) inp.actP = true; B.hold.act = B.t + e.act; }
      if (e.form) inp.formSet = e.form;
      if (e.swap) inp.swapP = true;
      if (e.call) inp.callP = true;
    }
    if (B.hold.mxT > B.t) inp.mx = B.hold.mx;
    if (B.hold.myT > B.t) inp.my = B.hold.my;
    if (B.hold.act > B.t) inp.actH = true;
    return inp;
  };
  return B;
}

/** run a whole chapter headless; returns the outcome */
export function runBot(kind, seed, o = {}) {
  newGame({ seed, si: o.si || 0, friends: o.friends, assist: o.assist !== false });
  const bot = makeBot(kind, seed); let f = 0, scrF = 0, lastSi = G.si; const stuck = [];
  while (f < 60 * 60 * 40) {
    if (G.mode === 'end') break;
    if (G.si !== lastSi) { lastSi = G.si; scrF = 0; }
    const inp = bot.tick(DT); step({ a: inp }); tickModes(DT); tickFx(DT); G.sfx.length = 0; f++; scrF++;
    if (scrF > CAP) { stuck.push({ si: G.si, stage: SCR.stage(), a: `${H().form}@${H().x | 0},${H().y | 0}`, b: `${O().form}@${O().x | 0},${O().y | 0}`, hint: JSON.stringify(SCR.hint()) }); break; }
  }
  return { kind, seed, total: +G.total.toFixed(1), end: G.mode === 'end', si: G.si, screens: G.stats.scr.filter(Boolean).map((x) => x.time), swaps: G.stats.swaps, calls: G.stats.calls, forms: G.stats.formChanges, hits: G.stats.hits, splashes: G.stats.splashes, demos: G.ev.filter((e) => e[0] === 'demo').length, stuck };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const fmt = (s) => `${(s / 60) | 0}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const res = {};
  for (const kind of ['casual', 'explorer']) {
    const runs = [];
    for (let s = 1; s <= SEEDS; s++) runs.push(runBot(kind, s));
    const clears = runs.filter((r) => r.end), avg = clears.reduce((a, r) => a + r.total, 0) / Math.max(1, clears.length);
    const per = [0, 1, 2, 3].map((i) => { const t = clears.map((r) => r.screens[i]).filter((x) => x != null); return t.length ? fmt(t.reduce((a, b) => a + b, 0) / t.length) : '-'; });
    res[kind] = { clears: clears.length, n: runs.length, avg };
    console.log(`${kind.padEnd(8)} cleared ${clears.length}/${runs.length}, average ${fmt(avg)} (screens ${per.join(' / ')}), calls ${(runs.reduce((a, r) => a + r.calls, 0) / runs.length).toFixed(0)}, swaps ${(runs.reduce((a, r) => a + r.swaps, 0) / runs.length).toFixed(0)}, hits ${(runs.reduce((a, r) => a + r.hits, 0) / runs.length).toFixed(1)}, splashes ${(runs.reduce((a, r) => a + r.splashes, 0) / runs.length).toFixed(1)}, demos ${(runs.reduce((a, r) => a + r.demos, 0) / runs.length).toFixed(1)}`);
    for (const r of runs) if (!r.end) console.log(`  stuck: seed ${r.seed} ${JSON.stringify(r.stuck)}`);
  }
  assert.equal(res.casual.clears, res.casual.n, 'the casual bot clears the chapter every time');
  assert.ok(res.casual.avg < 6 * 60, 'the casual bot clears the chapter in under 6 minutes on average');
  assert.ok(res.explorer.clears >= Math.ceil(res.explorer.n * .5), 'the explorer clears the chapter at least half the time');
  console.log('creature bots: ok');
}

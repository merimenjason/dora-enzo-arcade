// Snapshot Safari bots: a careful photographer (walks between groups, tiptoes in, hides, waits for behaviours, frames on a
// third and uses the tools) and a careless one (always hurries, snaps the moment anything is in view), 36 outings each.
// The careful one should fill most of the journal, but only over many outings, and clearly beat the careless one.
import assert from 'node:assert/strict';
import { SafariGame, TRAILS, TIMES, SPECIES, ALL_SLOTS, FRAME_H, ASPECT, freshProfile, develop, paste, isOpen, toolsFor, journalStars, slotsFilled, slotKey, boxOf, behaviourOf, rng } from '../.checks/safari-game.js';

const OUTINGS = 36, TI = { morning: 0, noon: 1, dusk: 2 };

/** Which open trail and time has the most journal stars still to find, with a little seeded wobble. */
function planOuting(p, r) {
  const tools = toolsFor(p), opts = [];
  for (const tr of TRAILS) for (const tm of TIMES) {
    if (!isOpen(p, tr.id) || !isOpen(p, tm.id)) continue;
    let gain = 0;
    for (const s of SPECIES) {
      const w = s.where[tr.id]?.[TI[tm.id]] ?? 0; if (!w) continue;
      for (const b of s.b) {
        const ok = b.w[TI[tm.id]] > 0 || (b.need === 'berries' && tools.berries) || (b.need === 'whistle' && tools.whistle);
        if (!ok || (b.need === 'alone' && !tools.trap)) continue;
        const st = p.journal[slotKey(s.id, b.id)]?.st; gain += (st === undefined ? 5 : Math.max(0, 4 - st) * 0.5) * Math.min(1, w / 2) * (b.rare ? 0.6 : 1);
      }
    }
    opts.push({ tr: tr.id, tm: tm.id, v: gain * (0.75 + r() * 0.5) });
  }
  opts.sort((a, b) => b.v - a.v);
  return opts[0];
}

/** Frames an animal on a third, with room in front of it, zoomed so it fills about half the frame. */
function frameOn(g, a) {
  const b = boxOf(a), zoom = Math.max(1, Math.min(8, Math.min(FRAME_H * 0.5 / b.h, (FRAME_H * ASPECT * 0.62) / b.w)));
  const fh = FRAME_H / zoom, fw = fh * ASPECT;
  g.aim(b.cx - (a.dir * fw) / 6, b.cy + fh / 6, zoom);
}

function careful(p, seed) {
  const r = rng(seed), plan = planOuting(p, r);
  const g = new SafariGame({ trail: plan.tr, time: plan.tm, who: 'dora', seed: Math.floor(r() * 1e9), tools: toolsFor(p), day: p.outings + 1 });
  const done = new Set(), took = new Map(), tossed = new Set();
  let group = -1, since = 0, trapGroup = -1, trapWait = 0;
  const live = (k) => g.animals.filter((a) => a.group === k && a.state !== 'gone' && a.state !== 'flee');
  const want = (a) => { const k = slotKey(a.sp.id, behaviourOf(a).id); return Math.max(p.journal[k]?.st ?? 0, took.get(k) ?? 0); };
  for (let tick = 0; g.state === 'out'; tick++) {
    if (tick % 6 === 0) {
      // the camera trap: set it near a creature that only shows itself to nobody, back off, then fetch it
      if (g.trap && !g.trap.back) {
        if (trapWait > 0) { trapWait -= 0.2; const away = g.trap.x - 17; if (g.x > away + 0.5) g.move(-1, 'tiptoe'); else { g.move(0); g.hide(true); } }
        else { const gap = g.trap.x - g.x; g.move(gap > 0 ? 1 : -1, 'walk'); }
      } else {
        if (group < 0 || done.has(group) || !live(group).length) {
          if (group >= 0) done.add(group);
          const ahead = [...new Set(g.animals.filter((a) => a.state === 'live' && a.x > g.x - 2 && !done.has(a.group)).map((a) => a.group))]
            .map((k) => ({ k, x: Math.min(...live(k).map((a) => a.x)) })).sort((a, b) => a.x - b.x);
          group = ahead.length ? ahead[0].k : -1; since = 0;
          if (group < 0 || g.film <= 0) { g.home(); break; }
        }
        const ms = live(group), sp = ms[0].sp, gx = Math.min(...ms.map((a) => a.x)), dist = gx - g.x;
        const standoff = 3 + 7 * sp.shy;
        const lonely = sp.b.find((b) => b.need === 'alone');
        if (lonely && g.tools.trap && !g.trap && (p.journal[slotKey(sp.id, lonely.id)]?.st ?? 0) < 4) {
          if (dist > 7) g.move(1, dist > 24 ? 'walk' : 'tiptoe'); else { g.move(0); g.placeTrap(); trapGroup = group; trapWait = 60; done.add(group); }
        } else if (dist > standoff + 14) g.move(1, 'walk');
        else if (dist > standoff) {
          // stop early in cover if there is some on the way in
          const cov = g.cover();
          if (cov && dist < standoff + 5 && sp.shy > 0.5) { g.move(0); g.hide(true); } else g.move(1, 'tiptoe');
          if (!g.moving) since += 0.2;
        } else { if (g.moving) g.move(0); if (g.cover() && !g.crouch) g.hide(true); since += 0.2; }
        if (!g.moving) {
          // the tools: berries for berry lovers, a whistle for anyone who answers one
          if (g.berries > 0 && !tossed.has(group) && since > 2 && ms.some((a) => a.sp.likes || a.sp.b.some((b) => b.need === 'berries'))) {
            const bb = sp.b.find((b) => b.need === 'berries');
            if (!bb || (p.journal[slotKey(sp.id, bb.id)]?.st ?? 0) < 4) { g.hide(false); g.toss(); tossed.add(group); }
          }
          const wb = sp.b.find((b) => b.need === 'whistle');
          if (wb && g.tools.whistle && since > 4 && Math.max(p.journal[slotKey(sp.id, wb.id)]?.st ?? 0, took.get(slotKey(sp.id, wb.id)) ?? 0) < 4) g.whistle();
          // pick the best-looking animal to frame: one doing something the journal still wants
          const pool = g.animals.filter((a) => a.state === 'live' && Math.abs(a.x - g.x) < 13).sort((a, b) => (want(a) - want(b)) || (Number(behaviourOf(b).rare) - Number(behaviourOf(a).rare)));
          const a = pool[0];
          if (a) {
            frameOn(g, a);
            const pv = g.preview(), need = want(a);
            if (pv && pv.sp === a.sp.id && g.steady > 0.95 && g.film > 0) {
              const enough = need === 0 ? (pv.st >= 4 || (since > 12 && pv.st >= 3) || since > 24) : pv.st > need && (pv.st >= 4 || since > 16);
              if (enough && pv.st > need) { const ph = g.snap(); if (ph) { const k = slotKey(ph.sp, ph.bh); took.set(k, Math.max(took.get(k) ?? 0, ph.st)); } }
            }
          }
          if (since > 30 || g.film <= 0) { done.add(group); g.hide(false); }
        }
      }
    }
    g.step();
  }
  if (process.env.VERBOSE && g.trap) console.log("trap", g.trail.id, g.time, g.trap.x, g.trap.back, g.trap.shots.map((s) => s.sp + ":" + s.bh + ":" + s.st).join(" "), g.animals.filter((a) => a.sp.id === "cat").map((a) => a.x.toFixed(0) + a.state).join(" "));
  return g;
}

function careless(p, seed) {
  const r = rng(seed), opts = [];
  for (const tr of TRAILS) for (const tm of TIMES) if (isOpen(p, tr.id) && isOpen(p, tm.id)) opts.push([tr.id, tm.id]);
  const [tr, tm] = opts[Math.floor(r() * opts.length)];
  const g = new SafariGame({ trail: tr, time: tm, who: 'enzo', seed: Math.floor(r() * 1e9), tools: toolsFor(p), day: p.outings + 1 });
  g.move(1, 'run');
  for (let tick = 0; g.state === 'out'; tick++) {
    if (tick % 3 === 0) {
      const a = g.animals.filter((x) => x.state !== 'gone' && Math.abs(x.x - g.x) < 12).sort((x, y) => Math.abs(x.x - g.x) - Math.abs(y.x - g.x))[0];
      if (a) { const b = boxOf(a); g.aim(b.cx, b.cy, 2); if (g.preview()) g.snap(); }
      if (g.x >= g.trail.len || g.film <= 0) g.home();
    }
    g.step();
  }
  return g;
}

function season(bot, seed) {
  const p = freshProfile(), r = rng(seed), log = [];
  let shots = 0, stars = 0;
  for (let i = 0; i < OUTINGS; i++) {
    const g = bot(p, Math.floor(r() * 1e9)), all = g.photos;
    const keep = develop(p, all).filter((d) => d.keep).map((d) => d.photo);
    paste(p, all, keep);
    shots += all.length; stars += all.reduce((n, x) => n + x.st, 0);
    log.push({ n: i + 1, where: `${g.trail.id}/${g.time}`, photos: all.length, avg: all.length ? +(all.reduce((n, x) => n + x.st, 0) / all.length).toFixed(2) : 0, slots: slotsFilled(p), stars: journalStars(p) });
  }
  return { p, log, avg: shots ? stars / shots : 0 };
}

const slots = ALL_SLOTS.length;
const good = season(careful, 2026), bad = season(careless, 2026);
if (process.env.VERBOSE) { console.table(good.log); console.table(bad.log); console.log(ALL_SLOTS.filter((k) => !good.p.journal[k]).join(' ')); }
const at = (n) => good.log[n - 1];
const most = good.log.find((l) => l.slots >= slots * 0.75);
assert.ok(most, `the careful photographer fills most of the journal in ${OUTINGS} outings (${good.log.at(-1).slots} of ${slots})`);
assert.ok(most.n >= 16, `but it takes many outings (75% after outing ${most.n})`);
assert.ok(at(1).slots <= 12 && at(5).slots <= slots * 0.45 && at(10).slots <= slots * 0.7, `the journal fills slowly (${at(1).slots}, ${at(5).slots}, ${at(10).slots} slots after 1, 5 and 10 outings)`);
assert.ok(good.p.journal[slotKey('cat', 'stalk')] || good.log.at(-1).stars < 190, 'once the camera trap opens, it catches the Andean cat prowling');
assert.ok(good.avg >= 3.3 && good.avg <= 4.3, `careful photos average about 3.5 to 4 stars (${good.avg.toFixed(2)})`);
assert.ok(bad.avg < 2.2, `careless photos are mostly wobbly (${bad.avg.toFixed(2)} stars)`);
assert.ok(journalStars(good.p) >= 2 * journalStars(bad.p), `the careful journal clearly beats the careless one (${journalStars(good.p)} vs ${journalStars(bad.p)} stars)`);
const again = season(careful, 2026);
assert.equal(JSON.stringify(again.p), JSON.stringify(good.p), 'a seeded season replays exactly');
console.log(`Snapshot Safari bot: careful ${good.log.at(-1).slots}/${slots} slots, ${journalStars(good.p)}★ (75% by outing ${most.n}, ${good.avg.toFixed(2)}★ a photo); careless ${slotsFilled(bad.p)} slots, ${journalStars(bad.p)}★ (${bad.avg.toFixed(2)}★ a photo).`);

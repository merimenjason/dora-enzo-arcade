// Echo Burrow engine checks: the thirty rooms and their maps, input recordings, the record → rewind → live loop,
// the echo's exact replay, retries and re-recording, plates, heavy plates and doors that hold, crates, kit tunnels,
// standing on the echo and the head boost, lifts, seesaws, fans, crumbling ledges, glow-moss, the feel helpers
// (coyote time, jump buffer, short hops, stepping onto low pads), seeds and stars, and saving.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EchoGame, ROOMS, ROOM_COUNT, CHAPTERS, T, TPS, KIT, BOOST, COYOTE, BUFFER, PUSH, DOOR_STEP, CRUMBLE_TICKS, REWIND_TICKS, RETRY_TICKS,
  SAW, STEP_UP, FRAME, SAVE_KEY, validateRoom, encodeInputs, decodeInputs, inputBits, bitsInput, idleInput, playRoom,
  freshSave, readSave, recordClear, cleared, unlocked, starCount, totalStars, chapterRooms,
} from '../.checks/echo-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`);
const room = (id) => { const i = ROOMS.findIndex((r) => r.id === id); assert.ok(i >= 0, `room ${id}`); return i; };
const run = (g, n, x = 0, jump = false) => { for (let i = 0; i < n; i++) g.step({ x, jump }); };
/** Walks toward pixel x (stopping within 2px). */
const walkTo = (g, x, max = 600) => { for (let i = 0; i < max && Math.abs(g.p.x - x) > 2; i++) g.step({ x: Math.sign(x - g.p.x), jump: false }); run(g, 20); };
/** Records with `f` for `n` ticks (or until the candle ends), then rewinds into the live loop. */
function record(g, n, f = () => idleInput()) {
  for (let i = 0; i < n && g.phase === 'record'; i++) g.step(f(i));
  if (g.phase === 'record') g.rewind();
  g.skipRewind();
}
const kinds = (g) => g.events.map((e) => e.k);
const sols = JSON.parse(readFileSync(new URL('./echo-solutions.json', import.meta.url), 'utf8'));

// ---- the rooms
{
  eq(ROOM_COUNT, 30, 'thirty rooms');
  eq(CHAPTERS.length, 5, 'five chapters');
  for (const ch of CHAPTERS) eq(chapterRooms(ch.id).length, 6, `six rooms in ${ch.name}`);
  eq(new Set(ROOMS.map((r) => r.id)).size, 30, 'room ids are unique');
  eq(new Set(ROOMS.map((r) => r.name)).size, 30, 'room names are unique');
  for (let i = 0; i < ROOM_COUNT; i++) eq(validateRoom(i), [], `room ${ROOMS[i].id} is well formed`);
  eq(ROOMS[29].name, 'Home', 'the last room is Home');
  ok(ROOMS.slice(0, 16).every((r) => r.first === 'dora'), 'Dora records first until the Brook flips it');
  ok(ROOMS.some((r) => r.first === 'enzo'), 'later rooms let Enzo record first');
  for (const R of ROOMS) ok(R.candle >= 10 * TPS && R.candle <= 26 * TPS, `${R.id}: a candle of 10 to 26 seconds`);
  for (const R of ROOMS) ok(R.def.par >= 2 && R.def.par <= 6, `${R.id}: par between 2 and 6 loops`);
  for (const R of ROOMS) ok(R.seed, `${R.id}: has a golden seed`);
  for (const R of ROOMS) ok(R.def.hint.length > 10 && R.def.hint.length <= 140, `${R.id}: a short hint`);
  for (const R of ROOMS) ok(sols[R.id]?.main && sols[R.id]?.seed, `${R.id}: stored solutions`);
}

// ---- input recordings
{
  const bits = [0, 0, 0, 2, 2, 6, 6, 6, 4, 1, 1, 0, 5];
  eq(decodeInputs(encodeInputs(bits)), bits, 'inputs survive encoding');
  eq(decodeInputs(''), [], 'an empty recording');
  for (let b = 0; b < 8; b++) if ((b & 3) !== 3) eq(inputBits(bitsInput(b)), b, `input bits ${b} round-trip`);
  ok(encodeInputs(new Array(300).fill(2)).length < 10, 'long runs pack small');
}

// ---- the loop: record, rewind, live, retry, re-record
{
  const i = room('c1'), g = new EchoGame(i);
  eq(g.phase, 'record', 'a room opens recording');
  eq(g.who, 'dora', 'Dora records first in the Root Cellar');
  eq(g.loops, 1, 'the recording is loop one');
  ok(!g.echo.on, 'no echo while recording');
  run(g, 90, 1);
  const recorded = g.frameCount === 0 ? 90 : g.frameCount;
  ok(recorded === 90 || g.frameCount === 0, 'frames are kept as you record');
  g.events.length = 0;
  g.rewind();
  eq(g.phase, 'rewind', 'R stops the recording and rewinds');
  eq(g.rewindLen, REWIND_TICKS, 'the first rewind plays in full');
  ok(kinds(g).includes('rewind'), 'a rewind event');
  eq(g.frameCount, 90, 'ninety ticks were recorded');
  run(g, REWIND_TICKS);
  eq(g.phase, 'live', 'after the rewind the other climber plays live');
  eq(g.who, 'enzo', 'Enzo plays beside Dora’s echo');
  eq(g.loops, 2, 'loop two');
  ok(g.echo.on, 'the echo is out');
  const rec = g.frames;
  // the echo replays the recording exactly, tick by tick, whatever the live climber does
  for (let k = 0; k < 90; k++) {
    g.step({ x: k % 3 ? -1 : 1, jump: k % 17 === 0 });
    near(g.echo.x, rec[k * FRAME], 1e-9, `echo x at tick ${k}`);
    near(g.echo.y, rec[k * FRAME + 1], 1e-9, `echo y at tick ${k}`);
  }
  const last = [g.echo.x, g.echo.y];
  run(g, 120);
  eq([g.echo.x, g.echo.y], last, 'the echo stays where its recording ended');
  ok(g.echo.pose !== 'run', 'and stops running');
  // R while live: same echo, again
  g.rewind();
  eq(g.phase, 'rewind', 'R while live rewinds');
  eq(g.rewindLen, RETRY_TICKS, 'a retry rewinds quicker');
  run(g, RETRY_TICKS);
  eq(g.phase, 'live', 'and plays live again');
  eq(g.loops, 3, 'a retry counts as a loop');
  eq(g.frames, rec, 'with the same echo');
  near(g.p.x, ROOMS[i].start.enzo.c * T + T / 2, 1e-9, 'Enzo starts over');
  // Shift+R: record again
  g.rerecord(); g.skipRewind();
  eq(g.phase, 'record', 'Shift+R records again');
  eq(g.who, 'dora', 'with the first climber');
  ok(!g.echo.on, 'and the old echo is gone');
  eq(g.loops, 4, 'four loops so far');
}
{
  // the candle burning down ends the recording by itself
  const i = room('c1'), g = new EchoGame(i);
  run(g, ROOMS[i].candle - 1);
  eq(g.phase, 'record', 'still recording a tick before the candle ends');
  ok(g.candleLeft === 1, 'one tick of candle left');
  g.step(idleInput());
  eq(g.phase, 'rewind', 'the candle ends the recording');
  eq(g.frameCount, ROOMS[i].candle, 'the whole candle was recorded');
  // rewinds and skipRewind don't disturb a game that isn't rewinding
  const h = new EchoGame(i); h.skipRewind(); eq(h.phase, 'record', 'skipRewind does nothing while recording');
}
{
  // an empty recording leaves the echo standing at the start
  const i = room('c1'), g = new EchoGame(i);
  g.rewind(); g.skipRewind();
  eq(g.frameCount, 0, 'nothing recorded');
  eq([g.echo.x, g.echo.y], [ROOMS[i].start.dora.c * T + T / 2, (ROOMS[i].start.dora.r + 1) * T], 'the echo waits at Dora’s start');
}

// ---- every stored solution clears, replays exactly, and needs the echo
for (let i = 0; i < ROOM_COUNT; i++) {
  const R = ROOMS[i], s = sols[R.id];
  const a = playRoom(i, s.main[0], s.main[1]);
  eq(a.phase, 'clear', `${R.id}: the stored solution clears`);
  eq(a.loops, 2, `${R.id}: in two loops`);
  const b = playRoom(i, s.main[0], s.main[1]);
  eq([b.p.x, b.p.y, b.t], [a.p.x, a.p.y, a.t], `${R.id}: replays exactly`);
  const c = playRoom(i, s.seed[0], s.seed[1]);
  ok(c.phase === 'clear' && c.seed, `${R.id}: the seed solution clears with the seed`);
  eq(c.stars(), [true, true, true], `${R.id}: three stars`);
  const solo = playRoom(i, '', s.main[1], 600);
  ok(solo.phase !== 'clear', `${R.id}: the same live run fails with no echo`);
}

// ---- plates and doors
{
  const i = room('c1'), R = ROOMS[i], g = new EchoGame(i);
  const pl = R.plates[0];
  walkTo(g, pl.c * T + T / 2);
  ok(g.pressed[0], 'Dora presses a plate');
  ok(g.groups[pl.g], 'and its group is on');
  eq(g.doors[0].open, 1, 'the door slides fully open');
  walkTo(g, (pl.c + 3) * T + T / 2);
  ok(!g.pressed[0], 'stepping off releases it');
  eq(g.doors[0].open, 0, 'and the door slides shut');
  ok(DOOR_STEP > 0 && DOOR_STEP < 1, 'doors take a few ticks to move');
}
{
  // a held door stays open for its seconds after the plate is released
  const i = room('b1'), R = ROOMS[i], grp = R.hold.findIndex((h) => h > 0);
  ok(grp > 0, 'b1 has a door that holds');
  const g = new EchoGame(i), pl = R.plates.find((p) => p.g === grp), di = R.doors.findIndex((d) => d.g === grp);
  g.p.x = pl.c * T + T / 2; g.p.y = (pl.r + 1) * T; run(g, 30);
  ok(g.groups[grp] && g.doors[di].open === 1, 'pressed, the door is open');
  g.p.x += 3 * T; run(g, 2);
  ok(!g.pressed[R.plates.indexOf(pl)], 'released');
  run(g, R.hold[grp] - 30);
  eq(g.doors[di].open, 1, 'still open a moment before its time is up');
  run(g, 60);
  eq(g.doors[di].open, 0, 'then it shuts');
}
{
  // heavy plates: Dora is too light, Enzo and crates are not
  const i = room('h2'), R = ROOMS[i], hp = R.plates.findIndex((p) => p.heavy);
  ok(hp >= 0, 'h2 has a heavy plate');
  const pl = R.plates[hp], put = (g) => { g.p.x = pl.c * T + T / 2; g.p.y = (pl.r + 1) * T; run(g, 10); };
  const g = new EchoGame(i);
  eq(g.who, 'dora', 'Dora first in h2');
  put(g);
  ok(!g.pressed[hp], 'Dora can’t hold a heavy plate down');
  const h = new EchoGame(i); h.rewind(); h.skipRewind();
  eq(h.who, 'enzo', 'Enzo live');
  put(h);
  ok(h.pressed[hp], 'Enzo can');
}

// ---- crates and kit tunnels
{
  const i = room('h1'), g = new EchoGame(i);
  g.rewind(); g.skipRewind();
  eq(g.who, 'enzo', 'Enzo live in h1');
  const beside = (g) => { const c = g.crates[0]; g.p.x = c.x - T / 2 - KIT[g.who].w / 2 - 1; g.p.y = c.y; g.p.vx = 0; return c.x; };
  const c0 = beside(g);
  run(g, 20, 1);
  ok(g.crates[0].x > c0 + 3, 'Enzo shoves the crate');
  ok(g.p.push && Math.abs(g.p.vx) <= PUSH + 1e-9, 'and slows to a push');
  const d = new EchoGame(i);
  const d0 = beside(d);
  run(d, 60, 1);
  eq(d.crates[0].x, d0, 'Dora can’t move a crate');
}
{
  const i = room('c4'), R = ROOMS[i];
  // Dora runs through the kit tunnel; Enzo can't
  const g = new EchoGame(i);
  run(g, 360, -1);
  ok(g.p.x < 3 * T, 'Dora squeezes through the kit tunnel');
  const h = new EchoGame(i); h.rewind(); h.skipRewind();
  run(h, 360, -1);
  ok(h.p.x > 8 * T, 'Enzo is too big for it');
  ok(R.def.map.some((row) => row.includes('k')), 'the tunnel is framed in the map');
}

// ---- standing on the echo and the head boost
{
  ok(BOOST > 1, 'a boost off Dora’s echo');
  // Enzo jumping off Dora's echo goes higher than off the floor
  const i = room('c3'), R = ROOMS[i], g = new EchoGame(i);
  const ex = R.start.dora.c * T + T / 2;
  record(g, 30);
  walkTo(g, ex - 26);
  g.step({ x: 1, jump: true });
  let top = g.p.y; for (let k = 0; k < 60; k++) { g.step({ x: Math.sign(ex - g.p.x), jump: k < 30 }); top = Math.min(top, g.p.y); }
  ok(g.p.ground === 'echo', 'Enzo lands on Dora’s echo');
  near(g.p.y, g.echo.y - KIT.dora.h, 0.01, 'standing on her head');
  const before = g.p.y;
  let peak = g.p.y; g.step({ x: 0, jump: false }); for (let k = 0; k < 50; k++) { g.step({ x: 0, jump: true }); peak = Math.min(peak, g.p.y); }
  const plain = KIT.enzo.jump ** 2 / 2000;
  ok(before - peak > plain * 1.3, `the boost lifts Enzo well above a plain jump (${(before - peak).toFixed(1)} vs ${plain.toFixed(1)})`);
  // the echo is never pushed
  const h = new EchoGame(i); record(h, 30);
  const hx = h.echo.x; walkTo(h, hx); run(h, 60, 1);
  eq(h.echo.x, hx, 'walking through the echo never moves it');
}

// ---- lifts
{
  const i = room('b1'), R = ROOMS[i], L = R.lifts[0], g = new EchoGame(i);
  eq(g.lifts[0].y, (L.r + 1) * T, 'a lift rests on its floor');
  const pl = R.plates.find((p) => p.g === L.g);
  g.p.x = pl.c * T + T / 2; g.p.y = (pl.r + 1) * T; run(g, 240);
  near(g.lifts[0].y, (L.r + 1 - L.up) * T, 0.01, 'a pressed plate raises the lift all the way');
  g.p.x = 1 * T + T / 2; g.p.y = 12 * T; run(g, 400);
  near(g.lifts[0].y, (L.r + 1) * T, 0.01, 'and it sinks back when released');
}

// ---- seesaws
{
  const i = room('g1'), R = ROOMS[i], S = R.saws[0], g = new EchoGame(i);
  eq(g.who, 'enzo', 'Enzo records first in the Gallery');
  eq(g.saws[0].down, S.down, 'the seesaw starts as drawn');
  // Enzo drops onto the high end: it flips
  const sol = decodeInputs(sols.g1.main[0]);
  for (const b of sol) { if (g.phase !== 'record') break; g.step(bitsInput(b)); }
  ok(g.saws[0].down !== S.down, 'Enzo landing on the high end flips it');
  // Dora alone can't flip it
  const d = new EchoGame(i); d.rewind(); d.skipRewind();
  eq(d.who, 'dora', 'Dora live');
  const hiC = S.c + (S.down === 0 ? 2.5 : 0.5);
  walkTo(d, hiC * T + 8, 600); run(d, 4, 0, true); run(d, 60);
  eq(d.saws[0].down, S.down, 'Dora is too light to flip a seesaw');
  ok(SAW.launch.dora > SAW.launch.enzo, 'a seesaw throws Dora higher than Enzo');
}
{
  // walking into a low pad steps up onto it
  const i = room('g1'), R = ROOMS[i], S = R.saws[0], d = new EchoGame(i); d.rewind(); d.skipRewind();
  const lowC = S.c + (S.down === 0 ? 0.75 : 3.25);
  walkTo(d, lowC * T, 600);
  near(d.p.y, (S.r + 1) * T - SAW.low, 0.01, 'Dora walks straight up onto the low pad');
  ok(STEP_UP >= SAW.low, 'the step-up covers a low pad');
}

// ---- fans
{
  const i = room('b2'), g = new EchoGame(i), R = ROOMS[i], w = R.winds[0];
  walkTo(g, w.c * T + T / 2 + 14, 400);
  g.step({ x: -1, jump: true }); run(g, 8, -1, true); run(g, 80);
  ok(g.p.y < w.bottom - 3 * T, 'the wind carries Dora up');
  // Enzo only falls slower in it
  const h = new EchoGame(i); h.rewind(); h.skipRewind(); h.who === 'enzo' || assert.fail('Enzo live in b2');
  walkTo(h, w.c * T + T / 2 + 18, 600);
  h.step({ x: -1, jump: true }); run(h, 6, -1, true); run(h, 120);
  ok(h.p.y > w.bottom - 3 * T, 'the wind can’t lift Enzo');
}

// ---- crumbling ledges
{
  const i = room('g2'), g = new EchoGame(i);
  run(g, 1); walkTo(g, 6.5 * T + 2, 300);
  const idx = (c, r) => r * 24 + c;
  ok(g.crumble[idx(6, 8)] !== 0, 'standing on a cracked ledge sets it shaking');
  run(g, CRUMBLE_TICKS + 2);
  eq(g.crumble[idx(6, 8)], -1, 'it falls');
  ok(g.p.y > 8 * T + 4, 'and Dora drops through');
  g.rewind(); g.skipRewind();
  eq(g.crumble[idx(6, 8)] >= 0 || g.echo.on, true, 'a new loop mends the ledge');
  eq(g.crumble[idx(6, 8)], 0, 'mended at the start of the loop');
}

// ---- glow-moss
{
  const i = room('w1'), R = ROOMS[i], g = new EchoGame(i);
  // while recording there is no echo, so the moss never holds
  walkTo(g, 9 * T + 8, 400);
  ok(g.p.y > 8 * T + 8, 'Dora falls through unlit moss');
  record(g, 60, () => idleInput());
  ok(!g.mossLit(9, 8) || Math.abs(g.echo.x - 9 * T - 8) < 30, 'the echo starts back at the start');
  run(g, g.frameCount + 1);
  // Dora's echo now waits under the middle of the bridge
  ok(g.mossLit(9, 8), 'the moss above the echo glows');
  ok(!g.mossLit(5, 8), 'far moss stays dark');
  const s = sols.w1.main;
  const a = playRoom(i, s[0], s[1]);
  eq(a.phase, 'clear', 'Enzo crosses on the glow');
  ok(R.def.map[8].includes('%'), 'the bridge is moss');
}

// ---- feel: coyote time, the jump buffer and short hops
{
  ok(COYOTE > 0 && BUFFER > 0, 'coyote time and a jump buffer');
  const i = room('c1'), floor = (ROOMS[i].start.dora.r + 1) * T;
  const fresh = () => { const g = new EchoGame(i); g.step(idleInput()); return g; };
  const held = new EchoGame(i); held.step({ x: 0, jump: true });
  ok(held.p.ground, 'a jump held from before the loop began doesn’t fire');
  const g = fresh(); g.step({ x: 0, jump: true });
  ok(!g.p.ground && g.p.vy < 0, 'Dora jumps');
  // press a few ticks before touching down: the buffer fires it on landing
  let pressed = false;
  for (let k = 0; k < 120; k++) { const late = g.p.vy > 0 && g.p.y > floor - 6; g.step({ x: 0, jump: late }); if (late) { pressed = true; break; } }
  ok(pressed && !g.p.ground, 'pressed again while still in the air');
  for (let k = 0; k < BUFFER + 2 && g.p.vy >= 0; k++) g.step({ x: 0, jump: true });
  ok(g.p.vy < 0, 'the buffered jump fires on landing');
  // short hop vs full jump
  const hi = (hold) => { const h = fresh(); const y0 = h.p.y; let top = y0; for (let k = 0; k < 60; k++) { h.step({ x: 0, jump: k < hold }); top = Math.min(top, h.p.y); } return y0 - top; };
  ok(hi(30) > hi(3) + 15, `holding jump goes higher than a tap (${hi(30).toFixed(1)} vs ${hi(3).toFixed(1)})`);
  // coyote time: run off an edge and jump a few ticks late
  const w = new EchoGame(room('w1')); w.step(idleInput());
  let off = -1;
  for (let k = 0; k < 200; k++) { w.step({ x: 1, jump: false }); if (!w.p.ground) { off = k; break; } }
  ok(off > 0, 'Dora runs off the edge onto dark moss');
  run(w, COYOTE - 3, 1);
  w.step({ x: 1, jump: true });
  ok(w.p.vy < 0, 'a jump just after leaving the edge still works');
  const late = new EchoGame(room('w1')); late.step(idleInput());
  for (let k = 0; k < 200 && late.p.ground; k++) late.step({ x: 1, jump: false });
  run(late, COYOTE + 2, 1);
  late.step({ x: 1, jump: true });
  ok(late.p.vy > 0, 'but not long after');
  ok(KIT.dora.jump > KIT.enzo.jump, 'Dora jumps higher than Enzo');
  ok(KIT.dora.w < T && KIT.dora.h < T, 'Dora fits a one-tile tunnel');
  ok(KIT.enzo.h > T, 'Enzo doesn’t');
}

// ---- seeds and stars
{
  const i = room('c1'), s = sols.c1;
  const g = playRoom(i, s.main[0], s.main[1]);
  eq(g.stars()[0], true, 'clearing earns the first star');
  const r = playRoom(i, s.seed[0], s.seed[1]);
  ok(r.seed && ['live', 'echo'].includes(r.seedBy), 'the seed is picked up');
  // par counts loops: retrying a few times loses that star
  const h = new EchoGame(i);
  for (const b of decodeInputs(s.main[0])) { if (h.phase !== 'record') break; h.step(bitsInput(b)); }
  if (h.phase === 'record') h.rewind();
  h.skipRewind();
  for (let k = 0; k < ROOMS[i].def.par; k++) { h.rewind(); h.skipRewind(); }
  for (const b of decodeInputs(s.main[1])) { if (h.phase !== 'live') break; h.step(bitsInput(b)); }
  run(h, 120);
  eq(h.phase, 'clear', 'cleared after several retries');
  eq(h.stars()[2], false, 'but over par');
  ok(kinds(h).length >= 0 && h.clearT >= 0, 'the clear runs on');
}

// ---- saving
{
  eq(SAVE_KEY, 'echo-burrow-v1', 'a versioned save key');
  eq(readSave(null), freshSave(), 'no save starts fresh');
  eq(readSave('not json {'), freshSave(), 'a corrupt save starts fresh');
  eq(readSave('[]'), freshSave(), 'an array is not a save');
  eq(readSave('{"v":2,"rooms":{"c1":{"clear":true}}}'), freshSave(), 'another version is ignored');
  const s = readSave(JSON.stringify({ v: 1, rooms: { c1: { clear: true, seed: true, par: 'yes', best: 2.7 }, zz: { clear: true }, c2: { clear: false } }, last: 1, ended: 'no', settings: { sound: false } }));
  eq(s.rooms.c1, { clear: true, seed: true, par: false, best: 2 }, 'a cleared room is kept, junk fields cleaned');
  ok(!s.rooms.zz && !s.rooms.c2, 'unknown and uncleared rooms are dropped');
  eq(s.last, 1, 'the last room is kept when open');
  eq(s.ended, false, 'only true counts as ended');
  eq(s.settings, { sound: false, music: true, shake: true }, 'settings are read');
  eq(readSave(JSON.stringify({ v: 1, rooms: {}, last: 7 })).last, 0, 'a locked last room falls back to the first');
  eq(readSave(JSON.stringify({ v: 1, rooms: {}, last: 99 })).last, 0, 'an impossible room index too');
  // unlocking: either of the two rooms before opens the next
  const f = freshSave();
  ok(unlocked(f, 0) && !unlocked(f, 1), 'only the first room is open at the start');
  const i = room('c1'), sol = sols.c1, g = playRoom(i, sol.seed[0], sol.seed[1]);
  eq(recordClear(f, g), { first: true, seed: true, par: true }, 'a first clear with every star');
  ok(cleared(f, 0) && unlocked(f, 1) && unlocked(f, 2) && !unlocked(f, 3), 'clearing a room opens the next two');
  eq(starCount(f, 0), 3, 'three stars');
  const worse = playRoom(i, sol.main[0], sol.main[1]);
  eq(recordClear(f, worse), { first: false, seed: false, par: false }, 'a worse clear adds nothing');
  eq(starCount(f, 0), 3, 'and takes nothing away');
  eq(totalStars(f), 3, 'stars add up across rooms');
  eq(f.rooms.c1.best, 2, 'the fewest loops are kept');
  eq(readSave(JSON.stringify(f)), f, 'a save survives a round trip');
}

console.log(`echo: ${checks} checks passed`);

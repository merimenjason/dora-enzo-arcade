// Every Creature engine tests: the checkpoint save, a seed replaying exactly, forms (unlocking, the mid-air and perch
// refusals, cycling, back to chinchilla), swapping and the partner call (with assist it arrives in the pairing form,
// boards a carrier, and can't reach another zone), riding and steering a carrier, every screen's friends and puzzles
// (The Lake: the frog's three hops, the tortoise's nudges, the pike against a shell, the log ramp, the beetle's runs,
// the chick, the bird carrying the beetle to the perch, the slick cliff, the vine; Fox Hollow: hide and seek, digging
// under the hawk, the shell's bonk, the tunnel, the seesaw launch, the root door; Otter River: three pebble catches,
// the current, a frog on the otter's belly through the jam and a chinchilla washed off, the log ramp; Storm Falls: the
// three knots and the lightning against a shell), the ghost demo for an idle player, two players, the respawn footing
// fix, and that every frame the game can ask for is painted. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newGame, advance, step, parseSave, checkpoint, snapshot, heroSprite, setForm, cycleForm, swap, callPartner, startGame,
  G, SCR, H, O, NOINP, SCREENS, FORMS, SAVE_KEY,
} from '../.checks/creature-game.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const ALL = { tort: true, frog: true, bird: true, beetle: true, fox: true, otter: true };
/** a game on screen si with all friends, both heroes placed, nothing from the screen's threats in the way */
function at(si, o = {}) {
  newGame({ seed: o.seed ?? 3, si, friends: o.friends ?? ALL, assist: o.assist !== false, two: !!o.two });
  return G;
}
const put = (h, x, y, form) => { if (form) h.form = form; h.x = x; h.y = y; h.vx = h.vy = 0; h.ground = true; h.swim = false; h.surf = 'bank'; h.lastSafe = { x, y }; };
const ev = (name) => G.ev.filter((e) => e[0] === name);
const sizes = JSON.parse(readFileSync(new URL('../public/art/every-creature/sizes.json', import.meta.url)));

// ---------------------------------------------------------------- save, determinism
test('the checkpoint parses and rejects junk', () => {
  assert.equal(SAVE_KEY, 'every-creature-cp1');
  assert.equal(parseSave(null), null); assert.equal(parseSave('nope'), null); assert.equal(parseSave('{"si":0,"friends":{}}'), null);
  assert.equal(parseSave('{"si":9,"friends":{}}'), null);
  const c = parseSave('{"si":2,"friends":{"tort":true},"total":61.5}');
  assert.deepEqual(c, { si: 2, friends: { tort: true, frog: false, bird: false, beetle: false, fox: false, otter: false }, total: 61.5 });
  at(0); assert.equal(checkpoint(), null, 'no checkpoint on the first screen');
  at(2, { friends: { tort: true } }); assert.equal(checkpoint().si, 2);
  startGame(c, { assist: true, two: false }); assert.equal(G.si, 2); assert.equal(G.mode, 'trans'); assert.ok(G.friends.tort && !G.friends.fox);
});
test('a seed replays exactly', () => {
  const run = () => { newGame({ seed: 11 }); const inputs = [{ mx: 1 }, { actP: true }, { mx: -1 }, {}, { callP: true }]; for (let i = 0; i < 1200; i++) advance(inputs[(i / 37 | 0) % 5]); return JSON.stringify(snapshot()) + G.ev.length; };
  assert.equal(run(), run());
});

// ---------------------------------------------------------------- forms
test('forms unlock with friends, need footing and cycle', () => {
  at(0, { friends: {} }); const a = H(); put(a, 200, 816);
  setForm(a, 'tort'); assert.equal(a.form, 'chin', 'a locked form is refused');
  G.friends.tort = true; setForm(a, 'tort'); assert.equal(a.form, 'tort'); assert.ok(ev('form').length === 1);
  setForm(a, 'chin'); a.ground = false; G.friends.frog = true; setForm(a, 'frog'); assert.equal(a.form, 'chin', 'no change in mid-air'); assert.equal(G.stats.denied, 1);
  a.ground = true; cycleForm(a, 1); assert.equal(a.form, 'tort'); cycleForm(a, 1); assert.equal(a.form, 'frog'); cycleForm(a, 1); assert.equal(a.form, 'chin');
  advance({ formSet: 'frog' }); assert.equal(a.form, 'frog'); advance(); advance({ formSet: 'frog' }); assert.equal(a.form, 'chin', 'its own number again is back to chinchilla');
});
test('no form change on the perch branch', () => {
  at(0); const a = H(); put(a, 1560, 418, 'beetle'); a.surf = 'perch'; setForm(a, 'chin'); assert.equal(a.form, 'beetle');
});
test('swap hands control to the partner', () => {
  at(0); assert.equal(H().name, 'dora'); advance({ swapP: true }); assert.equal(H().name, 'enzo'); assert.equal(G.stats.swaps, 1);
});
test('the call: the partner arrives in the pairing form and boards a carrier', () => {
  at(0); const a = H(), b = O(); put(a, 300, 816, 'tort'); put(b, 120, 816, 'chin');
  callPartner(); assert.equal(b.form, 'frog', 'with assist the partner turns into the tortoise’s pair'); assert.ok(b.arriveT > 0);
  advance({}, 50); assert.equal(b.ride, a, 'the frog rides the tortoise'); assert.equal(a.rider, b);
  callPartner(); advance({}, 5); assert.equal(a.rider, null, 'calling again lets the rider off');
});
test('the call can’t reach a zone that isn’t linked', () => {
  at(0); const a = H(), b = O(); put(a, 1700, 167); put(b, 200, 816); G.S.vine = 0;
  callPartner(); assert.ok(ev('callFar').length === 1); assert.equal(b.arriveT, 0);
});
test('a rider steers the carrier and Space hops off', () => {
  at(0); const a = H(), b = O(); put(a, 300, 816, 'frog'); put(b, 300, 816, 'tort'); advance({}, 2);
  b.x = 300; a.x = 300; a.y = 700; a.ground = false; a.vy = 100; advance({}, 20); assert.equal(a.ride, b);
  const x0 = b.x; advance({ mx: -1 }, 30); assert.ok(b.x < x0 - 40, 'the tortoise walks where the frog points');
  advance({ actP: true }); assert.equal(a.ride, null); assert.ok(a.vy < 0, 'hopped off upward');
});

// ---------------------------------------------------------------- The Lake
test('the frog befriends after three hops close together', () => {
  at(0, { friends: {} }); const a = H(); put(a, 330, 816);
  for (let i = 0; i < 3; i++) { advance({ actP: true }); advance({}, 40); }
  assert.ok(G.friends.frog); assert.ok(G.flyIcons.length || ev('friend').length);
});
test('the tortoise befriends after two nudges with assist, three without', () => {
  at(0, { friends: {} }); let a = H(); put(a, 160, 816); for (let i = 0; i < 2; i++) { advance({ actP: true }); advance({}, 30); } assert.ok(G.friends.tort);
  at(0, { friends: {}, assist: false }); a = H(); put(a, 160, 816); for (let i = 0; i < 2; i++) { advance({ actP: true }); advance({}, 30); } assert.ok(!G.friends.tort);
  advance({ actP: true }); assert.ok(G.friends.tort);
});
test('a chinchilla sinks on a lily pad; a frog stands on it', () => {
  at(0); const a = H(); put(a, 735, 700); a.ground = false; advance({}, 30); assert.ok(a.respawn > 0, 'the chinchilla goes in');
  at(0); const f = H(); put(f, 735, 700, 'frog'); f.ground = false; advance({}, 30); assert.equal(f.surf, 'pad');
});
test('the pike: a shelled tortoise bonks it, anyone else is hit', () => {
  at(0); const a = H(), b = O(); put(b, 200, 816); put(a, 1100, 882, 'tort'); a.swim = true; a.y = 848 + 34;
  let guard = 0; while (G.S.pike.st !== 'lunge' && G.S.pike.st !== 'bonk' && guard++ < 600) advance({ actH: true });
  assert.equal(G.S.pike.st, 'bonk'); assert.equal(G.stats.blocks, 1);
  at(0); const c = H(); put(O(), 200, 816); put(c, 1100, 862, 'frog'); c.swim = true; c.y = 862;
  guard = 0; while (G.S.pike.st !== 'lunge' && guard++ < 600) advance();
  assert.ok(ev('pikeHit').length === 1);
});
test('the log tips into a ramp and links the bank', () => {
  at(0); const a = H(); put(a, 1360, 657); assert.ok(!SCR.linked('bank', 'meadow'));
  advance({ actP: true }); advance({}, 60); assert.equal(G.S.ramp, 1); assert.ok(SCR.linked('bank', 'meadow'));
});
test('the beetle runs off twice, then is caught; the chick befriends when bumped low with assist', () => {
  at(0, { friends: { tort: true, frog: true } }); G.S.ramp = 1; const a = H(); put(O(), 200, 816);
  put(a, 1340, 657); for (let i = 0; i < 600 && !G.friends.beetle; i++) { const be = G.S.A.beetle; advance({ mx: Math.sign(be.x - a.x) }); }
  assert.ok(G.friends.beetle); assert.equal(G.S.A.beetle.runs, 2);
  put(a, G.S.A.chick.x - 30, 657); advance({}, 3); assert.ok(G.friends.bird);
});
test('a bird swooping onto its beetle partner carries it; landing on the perch sets it down', () => {
  at(0); G.S.ramp = 1; const a = H(), b = O(); put(b, 1450, 657, 'beetle'); put(a, 1450, 560, 'bird'); a.ground = false; a.vy = 50;
  advance({}, 2); assert.equal(a.carry, b); assert.ok(ev('grab').length);
  a.x = 1560; a.y = 360; a.vy = 0; advance({}, 90); assert.ok(G.S.perched, 'the beetle is on the perch'); assert.equal(b.surf, 'perch');
});
test('the cliff is slick below the perch; the beetle climbs from the perch and unrolls the vine', () => {
  at(0); const a = H(); put(a, 1578, 657, 'beetle'); advance({ my: -1 }, 2); assert.equal(a.climb, 'wall'); advance({ my: -1 }, 120); assert.ok(a.y > 440, 'it slides back down below the perch');
  at(0); const c = H(); put(c, 1578, 418, 'beetle'); c.surf = 'perch'; advance({ my: -1 }, 200); assert.ok(c.y <= 168, 'it reaches the top from the perch');
  advance({}, 2); put(c, 1640, 167); advance({ actP: true }); advance({}, 60); assert.equal(G.S.vine, 1);
});
test('a chinchilla climbs the vine and both on the top clears The Lake', () => {
  at(0); G.S.ramp = 1; G.S.vine = 1; const a = H(), b = O(); put(b, 1700, 167); put(a, 1590, 657);
  advance({ my: -1 }, 2); assert.equal(a.climb, 'vine'); advance({ my: -1 }, 200); assert.ok(a.y <= 167 && !a.climb);
  advance({}, 2); assert.ok(G.clear); advance({}, 230); assert.equal(G.mode, 'trans');
  advance({}, 140); assert.equal(G.si, 1); assert.equal(G.mode, 'play');
});

// ---------------------------------------------------------------- Fox Hollow
test('hide and seek: three tags befriend the fox kit', () => {
  at(1, { friends: { tort: true, frog: true, bird: true, beetle: true } }); const a = H(); put(O(), 40, 800);
  for (let i = 0; i < 2000 && !G.friends.fox; i++) { const k = G.S.kit; if (k.st === 'peek') { a.x = k.x; a.y = 800; } advance(); }
  assert.ok(G.friends.fox); assert.equal(G.S.kit.tags, 3);
});
test('the fox digs under the hawk while a shelled tortoise draws it', () => {
  at(1); const a = H(), b = O(); put(a, 1095, 800, 'fox'); put(b, 800, 800, 'tort');
  for (let i = 0; i < 400; i++) advance({ actH: true, actP: i === 0 });
  assert.ok(G.S.tunnel, 'the tunnel opens after 4.3 s of digging'); assert.ok(G.stats.blocks >= 1, 'the hawk bonked off the shell');
});
test('the hawk resets the dig when it hits the fox', () => {
  at(1); const a = H(); put(O(), 40, 800); put(a, 1095, 800, 'fox');
  let hit = false; for (let i = 0; i < 600 && !hit; i++) { advance({ actH: true }); hit = ev('hawkHit').length > 0; }
  assert.ok(hit); assert.ok(G.S.dig < 1);
});
test('through the tunnel, onto the seesaw, launched up the clay, and the root door opens', () => {
  at(1); G.S.tunnel = 1; const a = H(), b = O(); put(a, 1095, 800);
  advance({ actP: true }); advance({}, 40); assert.ok(Math.abs(a.x - 1338) < 40, 'out of the exit hole');
  put(b, 1606, 0, 'beetle'); b.y = SCR.plankY(1606); b.surf = 'plank'; put(a, 1380, 690, 'tort'); a.ground = false; a.vy = 300; a.x = 1440; a.y = 700;
  advance({}, 20); assert.ok(ev('launch').length, 'the tortoise’s drop flings the beetle'); advance({}, 120); assert.ok(G.S.launched);
  put(b, 1770, 430); swap(); advance({ actP: true }); advance({}, 60); assert.equal(G.S.door, 1); assert.ok(SCR.linked('burrow', 'hollow'));
});
test('the bramble hurts', () => {
  at(1); const a = H(); put(a, 1100, 800); a.ground = false; a.y = 300; a.x = 1200; advance({}, 30); assert.ok(ev('thorn').length);
});

// ---------------------------------------------------------------- Otter River
test('three pebble catches befriend the otter pup', () => {
  at(2, { friends: { tort: true, frog: true, bird: true, beetle: true, fox: true } }); const a = H(); put(O(), 60, 760);
  for (let i = 0; i < 4000 && !G.friends.otter; i++) { const p = G.S.pup; if (p.st === 'fly' && p.fl > .7) { a.x = p.tx; a.y = 760; } advance(); }
  assert.ok(G.friends.otter); assert.equal(G.S.pup.catches, 3);
});
test('the current sweeps a tortoise back and barely lets a frog through; the otter beats it', () => {
  at(2); const a = H(); put(a, 900, 860 + 34, 'tort'); a.swim = true; advance({ mx: 1 }, 60); assert.ok(a.x < 900, 'a tortoise loses to the current');
  at(2); const fr = H(); put(fr, 900, 874, 'frog'); fr.swim = true; advance({ mx: 1 }, 60); assert.ok(fr.x < 930, 'a frog crawls');
  advance({}, 60); assert.ok(fr.x < 900, 'and drifts back when it stops');
  at(2); const o = H(); put(o, 900, 876, 'otter'); o.swim = true; advance({ mx: 1 }, 60); assert.ok(o.x > 950, 'the otter swims against it');
});
test('a frog rides the otter’s dive under the jam; a chinchilla is washed off', () => {
  at(2); const a = H(), b = O(); put(a, 600, 876, 'otter'); a.swim = true; put(b, 600, 760, 'frog'); b.ground = false; advance({}, 30);
  assert.equal(b.ride, a); advance({ my: 1 }, 10); assert.ok(a.dive); assert.equal(b.ride, a, 'the frog holds its breath');
  for (let i = 0; i < 300 && !G.S.through; i++) advance({ my: 1, mx: 1 }); assert.ok(G.S.through, 'through the driftwood jam');
  at(2); const c = H(), d = O(); put(c, 600, 876, 'otter'); c.swim = true; put(d, 600, 760, 'chin'); d.ground = false; advance({}, 30);
  assert.equal(d.ride, c); advance({ my: 1 }, 3); assert.ok(ev('washOff').length); assert.ok(d.respawn > 0);
});
test('the high bank’s log becomes a ramp; both on the bank clears Otter River', () => {
  at(2); const a = H(), b = O(); put(a, 1620, 640); advance({ actP: true }); advance({}, 60); assert.equal(G.S.ramp, 1);
  put(a, 1800, 640); put(b, 1850, 640); G.S.through = true; advance({}, 2); assert.ok(G.clear);
});

// ---------------------------------------------------------------- Storm Falls
test('knot 1: the fox digs up the stake while a shelled tortoise takes the lightning', () => {
  at(3); const a = H(), b = O(); put(a, 520, 760, 'fox'); put(b, 300, 760, 'tort');
  for (let i = 0; i < 500 && !G.S.knots[0]; i++) advance({ actH: true });
  assert.equal(G.S.knots[0], 1); assert.ok(G.stats.blocks >= 1, 'the shell took a strike');
});
test('knot 2: only a frog on the otter’s belly fits the crevice', () => {
  at(3); G.S.knots[0] = 1; const a = H(), b = O(); put(a, 930, 846, 'otter'); a.swim = true; put(b, 300, 760);
  advance({ my: 1 }, 60); assert.ok(ev('crevTooBig').length, 'an otter alone is too big'); assert.equal(G.S.knots[1], 0);
  put(b, 930, 700, 'frog'); b.ground = false; advance({}, 1); a.dive = false; a.y = 846; advance({}, 30); assert.equal(b.ride, a);
  for (let i = 0; i < 200 && !G.S.knots[1]; i++) advance({ my: 1 }); assert.equal(G.S.knots[1], 1);
});
test('knot 3: a bird carrying a beetle bites the last knot from behind the heron’s head; a bird alone pricks itself', () => {
  at(3); G.S.knots = [1, 1, 0]; const a = H(), b = O(); put(a, 1300, 450, 'bird'); a.ground = false; put(b, 300, 760);
  advance({}, 2); assert.ok(ev('thornBird').length);
  at(3); G.S.knots = [1, 1, 0]; const c = H(), d = O(); put(d, 1340, 470, 'beetle'); d.ground = false; put(c, 1340, 420, 'bird'); c.ground = false; c.carry = d; d.ride = c;
  for (let i = 0; i < 120 && !G.S.knots[2]; i++) advance(); assert.equal(G.S.knots[2], 1);
  assert.equal(SCR.phase(), 3); advance({}, 140); assert.ok(G.clear, 'the storm calms and the chapter clears');
  advance({}, 220); assert.equal(G.mode, 'end'); assert.ok(G.endFull); assert.equal(G.tune, 'calm');
});

// ---------------------------------------------------------------- helping a stuck player, two players, respawn
test('an idle player is shown a ghost demo', () => {
  at(0); G.S.A; G.friends.frog = G.friends.tort = true; put(H(), 200, 816); put(O(), 120, 816);
  advance({}, 60 * 10); assert.ok(G.demo || ev('demo').length, 'a demo plays after 9 s idle with assist');
  assert.ok(SCR.demoPose(G.demo ?? { kind: 'lake', t: 1, dur: 7 }).length > 0);
});
test('every screen has a hint at every stage start', () => {
  for (let si = 0; si < SCREENS.length; si++) { at(si, { friends: {} }); const h = SCR.hint(); assert.ok(h === null || typeof h.k === 'string'); }
});
test('two players each steer their own hero', () => {
  at(0, { two: true }); const a = G.heroes[0], b = G.heroes[1]; put(a, 300, 816); put(b, 200, 816);
  for (let i = 0; i < 20; i++) step({ a: { ...NOINP, mx: 1 }, b: { ...NOINP, mx: -1 } });
  assert.ok(a.x > 320 && b.x < 180); advance({ swapP: true }); assert.equal(G.act, 0, 'no swapping in two-player');
});
test('a hero respawns with footing even when its safe spot was a wider form’s', () => {
  at(3); const a = H(); put(O(), 300, 760); put(a, 1136, 760, 'otter'); advance({}, 2); assert.equal(a.lastSafe.x, 1136);
  a.form = 'chin'; a.y = 900; a.ground = false; a.x = 1128; advance({}, 2); assert.ok(a.respawn > 0); advance({}, 60);
  advance({}, 30); assert.ok(a.ground && a.respawn === 0, 'stands on the rock after respawning'); assert.ok(a.x >= 1137);
});

// ---------------------------------------------------------------- art
test('every frame a hero can show is painted', () => {
  at(3); const h = H(), missing = new Set();
  const states = [
    {}, { respawn: .3 }, { hurt: .3 }, { friendT: .5 }, { climb: 'vine', climbAnim: 1 }, { climb: 'wall', climbAnim: 0 }, { nudgeT: .2 }, { ground: false, vy: -100 }, { ground: false, vy: 100 },
    { landT: .1 }, { vx: 100, anim: .05 }, { vx: 100, anim: .15 }, { vx: 100, anim: .25 }, { vx: 100, anim: .35 }, { t: .1 }, { shell: true }, { swim: true }, { swim: true, vx: 100, anim: .3 }, { swim: true, dive: true, y: 900 }, { swim: true, dive: true, y: 1100 },
    { digging: true }, { digging: true, anim: .1 }, { inp: { my: 1 } }, { flapT: .2, ground: false }, { flapT: .05, ground: false }, { t: 3.5 },
  ];
  for (const name of ['dora', 'enzo']) for (const f of FORMS) for (const s of states) {
    const other = { name: name === 'dora' ? 'enzo' : 'dora', form: 'bird' };
    const hero = { ...h, name, form: f, ground: true, vx: 0, anim: 0, t: 1, respawn: 0, hurt: 0, friendT: 0, climb: null, nudgeT: 0, landT: 0, shell: false, swim: false, dive: false, digging: false, flapT: 0, ride: null, rider: null, carry: null, inp: null, y: 760, ...s };
    for (const extra of [{}, { ride: other }, { rider: other }, { carry: other }]) { const k = heroSprite({ ...hero, ...extra }); if (!sizes[k]) missing.add(k); }
    G.clear = true; const k = heroSprite(hero); if (!sizes[k]) missing.add(k); G.clear = false;
  }
  assert.deepEqual([...missing], []);
});
test('every screen’s art and every picture the scenes name is painted', () => {
  for (const s of SCREENS) for (const n of [s.bg, ...s.art]) assert.ok(sizes[n], n);
  const src = ['scene', 'scene-screens', 's1', 's2', 's3', 's4'].map((f) => readFileSync(new URL(`../lib/creature-${f}.ts`, import.meta.url), 'utf8')).join('\n');
  const named = new Set([...src.matchAll(/(?:spr|img:?)\(?\s*'([a-z0-9-]+)'(?!\s*\+)/g)].map((m) => m[1]));
  for (const k of ['ic-', 'lock-', 'port-', 'btn-', 'poof']) for (const n of [...named]) if (n === k) named.delete(n);
  const missing = [...named].filter((nm) => !sizes[nm]);
  assert.deepEqual(missing, []);
  for (const f of FORMS) assert.ok(sizes['ic-' + f], 'icon ' + f);
  for (let i = 1; i <= 8; i++) assert.ok(sizes['poof' + i]);
  for (const n of ['a-beetle-run1', 'a-beetle-run2', 'parent-fly1', 'parent-fly2', 'stick-base', 'stick-knob', 'keycap', 'padlock', 'lock-fox', 'lock-otter', 'port-dora', 'port-enzo']) assert.ok(sizes[n], n);
});

console.log(`creature: ${n} tests passed`);

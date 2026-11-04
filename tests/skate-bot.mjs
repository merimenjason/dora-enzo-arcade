// Pawpark Skate bots. A vert skater plays whole two-minute sessions the way a decent player would: it rides at a
// quarter-pipe (pushing on the flat and pumping the transition), throws a flip and a grab in every air, varies them so
// they don't lose value, rolls out and turns back, and (the "linker") holds a manual between airs to chain them into one
// combo. On Cloverdrop Hill it skates the halfpipe wall to wall. The park goals must be fair: the plain score goal
// within reach of the simple skater, the pro score and the combo goal within reach of the linker, and none of them
// handed out by a bot that only pushes about. Four seeds: odd ones skate as Dora, even ones as Enzo.
import assert from 'node:assert/strict';
import { Session, PARKS, idleInput, DT } from '../.checks/skate-game.js';

const I = (o = {}) => ({ ...idleInput(), ...o });
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); return a < 0 ? a + Math.PI : a - Math.PI; };
const FLIPS = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
const GRABS = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }];
/** where each park's bot skates: a quarter-pipe to ride at, and for the halfpipe the one facing it */
const WALLS = { plaza: [11], hill: [0, 2], roofs: [3] };

function bot(pid, seed, link) {
  const s = new Session({ park: pid, char: seed % 2 ? 'enzo' : 'dora', seed });
  const walls = WALLS[pid].map((i) => s.pk.pieces[i]);
  // start in front of the first wall
  const w0 = walls[0], mid = (w0.c0 + w0.c1) / 2, back = w0.at - w0.dir * 12;
  if (w0.axis === 'x') s.place(back, mid, w0.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 4); else s.place(mid, back, w0.dir > 0 ? 0 : Math.PI, 4);
  let mode = 'in', target = 0, k = 0, flipped = false, grabbing = false, hold = 0, turnDir = 0;
  while (!s.over && s.t < 200) {
    const w = walls[target], a = w.axis, u = (a === 'x' ? s.p.x : s.p.z) - w.at, toward = -Math.sign(u * w.dir) || 1;
    let inp = I();
    if (s.state === 'air') {
      if (!flipped && s.v.y > 1.5) { flipped = true; inp = I({ flip: true, ...FLIPS[k % FLIPS.length] }); }
      else if (flipped && !s.flip && s.v.y > -3.2 && (grabbing || s.v.y > 0)) { grabbing = true; inp = I({ grab: true, ...GRABS[k % GRABS.length] }); }
      else grabbing = false;
    } else if (s.state === 'grind') inp = I({ x: Math.max(-1, Math.min(1, s.grind.bal * 3 + s.grind.bv)) });
    else if (s.state === 'ground' || s.state === 'manual') {
      if (flipped) { flipped = false; grabbing = false; k++; mode = 'out'; if (walls.length > 1) { target = 1 - target; mode = 'in'; } }
      const wN = walls[target], uN = (wN.axis === 'x' ? s.p.x : s.p.z) - wN.at;
      // the heading towards the wall, and the way along it to its middle
      const wantYaw = wN.axis === 'x' ? (wN.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (wN.dir > 0 ? 0 : Math.PI);
      const midC = (wN.c0 + wN.c1) / 2, off = (wN.axis === 'x' ? s.p.z : s.p.x) - midC;
      const goYaw = mode === 'in' ? wantYaw : wrap(wantYaw + Math.PI);
      const travel = s.fakie ? wrap(s.yaw + Math.PI) : s.yaw;
      const corr = Math.max(-0.5, Math.min(0.5, -off * 0.08)) * (wN.axis === 'x' ? (wN.dir > 0 ? -1 : 1) : (wN.dir > 0 ? 1 : -1));
      const d = wrap(goYaw + (mode === 'in' ? corr : 0) - travel);
      inp = I({ x: Math.max(-1, Math.min(1, -d * 2.2)), y: s.n.y < 0.97 ? -1 : (Math.abs(d) < 0.6 ? -1 : 0) });
      // up on the deck behind the lip: drop back in
      if (uN * wN.dir > wN.r * 0.95 && s.n.y > 0.97) mode = 'out';
      if (mode === 'out' && Math.abs(uN) > 9) { mode = 'turn'; turnDir = 0; }
      if (mode === 'turn') {
        // turn the way that brings you back towards the middle of the wall
        if (!turnDir) { const side = Math.sin(travel) * (wN.axis === 'x' ? 0 : 1) + Math.cos(travel) * (wN.axis === 'x' ? 1 : 0); turnDir = (off * side >= 0 ? 1 : -1) * (wN.axis === 'x' ? 1 : -1) * (wN.dir > 0 ? 1 : -1) || 1; }
        inp = I({ x: turnDir, y: -1 }); if (Math.abs(wrap(wantYaw - travel)) < 0.35) mode = 'in';
      }
      if (s.state === 'manual') {
        // balance with up and down; step down before the wall, so the push and pump are free
        inp.y = Math.max(-1, Math.min(1, -(s.manual.bal * 3 + s.manual.bv))); inp.grind = mode === 'in' && Math.abs(uN) < 5 && s.manual.t > 0.2;
      } else if (link && s.combo.length && s.n.y > 0.97 && hold > 0.05 && Math.abs(uN) > 5) inp.grind = true;
      hold = s.combo.length ? hold + DT : 0;
    }
    s.tick(inp);
    if (s.state === 'bail') { flipped = false; grabbing = false; mode = 'in'; }
  }
  return s;
}
/** a skater who only pushes and turns, never tricks */
function pusher(pid, seed) {
  const s = new Session({ park: pid, char: 'dora', seed });
  while (!s.over && s.t < 200) s.tick(I({ y: -1, x: Math.sin(s.t * 0.7) }));
  return s;
}

const seeds = [1, 2, 3, 4];
for (const pk of PARKS) {
  const goal = (kind) => pk.goals.find((g) => g.kind === kind).n;
  const plain = seeds.map((sd) => bot(pk.id, sd, false)), linked = seeds.map((sd) => bot(pk.id, sd, true)), lazy = pusher(pk.id, 1);
  const avg = (xs, f) => xs.reduce((a, x) => a + f(x), 0) / xs.length;
  const sc = avg(plain, (x) => x.score), lsc = avg(linked, (x) => x.score), lc = avg(linked, (x) => x.bestCombo);
  console.log(`${pk.name.padEnd(22)} simple ${sc.toFixed(0).padStart(6)}  linker ${lsc.toFixed(0).padStart(6)} best combo ${lc.toFixed(0).padStart(6)}  pusher ${lazy.score}   goals ${goal('score')}/${goal('pro')}/${goal('combo')}`);
  assert.ok(plain.every((x) => x.over), 'sessions end');
  assert.ok(sc >= goal('score'), `${pk.name}: the score goal is within reach of a simple skater (${sc.toFixed(0)} vs ${goal('score')})`);
  assert.ok(sc < goal('pro'), `${pk.name}: the pro goal takes more than the simple line (${sc.toFixed(0)} vs ${goal('pro')})`);
  assert.ok(Math.max(...linked.map((x) => x.score)) >= goal('pro'), `${pk.name}: the pro goal is within reach of a linker (${lsc.toFixed(0)} vs ${goal('pro')})`);
  assert.ok(Math.max(...linked.map((x) => x.bestCombo)) >= goal('combo'), `${pk.name}: the combo goal is within reach of a linker (${lc.toFixed(0)} vs ${goal('combo')})`);
  assert.ok(lazy.score < goal('score') / 4, `${pk.name}: pushing about earns next to nothing (${lazy.score})`);
}
console.log('skate-bot: all good');

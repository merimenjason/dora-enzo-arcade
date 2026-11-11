// The Sunken Bellspire: finding the way into each expansion. For each finished area the wisp's goal list points at
// the next door, the maps route through the doors between regions, the unlock dialog fires once per door (and never
// for a door already used), and the title's "Next:" line names the open door.
// Run after compiling the engine: see `npm run test:bellspire`.
import assert from 'node:assert/strict';
import { BellspireGame, ABILITY_ORDER, ALL_BOSSES, SALT_GUARDIANS, ORCHARD_GUARDIANS, GLACIER_GUARDIANS, INFO, NO_INPUT, TILE,
  UNLOCKS, freshSave } from '../.checks/bellspire-game.js';

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); passed++; };

const thing = (room, ch) => { const t = INFO.get(room).things.find((th) => th.ch === ch); return { room, x: t.c * TILE + 8, y: t.r * TILE }; };
const before = (list, a) => list.slice(0, list.indexOf(a));
/** A save at the end of each area: the citadel, belfry and foundry ('foundry'), then the Salt Road, the Night Orchard
 *  and the Glacier Stair, every ability and guardian of the areas before it. */
function saveAt(stage, shrine) {
  const s = freshSave();
  const abil = { foundry: before(ABILITY_ORDER, 'ballast'), salt: before(ABILITY_ORDER, 'bloom'), orchard: before(ABILITY_ORDER, 'sunmirror'), glacier: ABILITY_ORDER }[stage];
  s.abilities = [...abil];
  const bosses = [...ALL_BOSSES.filter((b) => !SALT_GUARDIANS.includes(b) && !ORCHARD_GUARDIANS.includes(b) && !GLACIER_GUARDIANS.includes(b))];
  if (stage !== 'foundry') bosses.push(...SALT_GUARDIANS);
  if (stage === 'orchard' || stage === 'glacier') bosses.push(...ORCHARD_GUARDIANS);
  if (stage === 'glacier') bosses.push(...GLACIER_GUARDIANS);
  s.flags.push('script:intro', 'script:firstDark', 'script:belfryCall', 'script:trials', 'script:foundryCall', 'keeper', 'epilogue', 'epilogue2', 'epilogue3',
    ...bosses.map((b) => `boss:${b}`));
  if (stage !== 'foundry') s.flags.push('salt:visited');
  if (stage === 'orchard' || stage === 'glacier') s.flags.push('orchard:visited');
  if (stage === 'glacier') s.flags.push('glacier:visited');
  s.shrine = shrine ?? 'landing';
  return s;
}
const game = (save, settings = { assist: true, strict: false, wisp: true }) => new BellspireGame(save, settings, 7);
const run = (g, n) => { const ev = []; for (let i = 0; i < n; i++) { g.step(NO_INPUT); ev.push(...g.drainEvents()); } return ev; };
const unlocks = (ev) => ev.filter((e) => e.k === 'unlock').map((e) => e.id);

// ─── nextGoal: after each area, the next door ─────────────────────────────
{
  eq(game(saveAt('foundry')).nextGoal(), thing('fgate', '?'), 'Hollow Bell calm: the next goal is the supply door in the Foundry Gate');
  eq(game(saveAt('salt')).nextGoal(), thing('salt-tollhouse', ','), 'Last Tollkeeper calm: the next goal is the orchard wicket in the Salt Tollhouse');
  eq(game(saveAt('orchard')).nextGoal(), thing('orchard-mother', '('), 'Mother of Grafts calm: the next goal is the root lift in her chamber');
  eq(game(saveAt('glacier')).nextGoal(), null, 'Sun Gate calm: nothing left to point at');
}
// ─── the Glacier Stair in the goal list, in the order of the climb ────────
{
  const s = saveAt('orchard'); s.flags.push('glacier:visited');
  const g = game(s);
  const order = [];
  const flags = ['ability:sunmirror', 'boss:glass-vicuna', 'ability:icepick', 'boss:serac-osjollo', 'boss:sun-gate'];
  for (const f of flags) {
    order.push(g.nextGoal()?.room);
    if (f.startsWith('ability:')) g.save.abilities.push(f.slice(8)); else g.setFlag(f);
  }
  eq(order, ['glacier-camp', 'glacier-vicuna', 'glacier-serac', 'glacier-osjollo', 'glacier-sun-gate'], 'Sun Mirror, Glass-Horn Vicuña, Ice Pick, Serac Osjollo, Sun Gate');
  eq(g.nextGoal(), null, 'and nothing after the Sun Gate');
}
// ─── the maps: across regions, the door out of this one ──────────────────
{
  const atLanding = game(saveAt('orchard', 'landing'));
  eq(atLanding.mapGoal(), thing('fgate', '?'), 'from the citadel, a root-lift goal is marked at the supply door first');
  const inSalt = game(saveAt('orchard', 'salt-toll-road'));
  ok(inSalt.room.salt, 'the Toll Road candle is on the Salt Road');
  eq(inSalt.mapGoal(), thing('salt-tollhouse', ','), 'from the Salt Road, at the orchard wicket');
  const inOrchard = game(saveAt('orchard'));
  inOrchard.teleport('orchard-wicket', 3, 11);
  eq(inOrchard.mapGoal(), thing('orchard-mother', '('), 'in the orchard, at the root lift itself');
  const s = saveAt('orchard'); s.flags.push('glacier:visited');
  const back = game(s); back.teleport('orchard-wicket', 3, 11);
  eq(back.mapGoal(), thing('orchard-mother', '('), 'a glacier goal from the orchard: the root lift');
  const up = game(s); up.teleport('glacier-landing', 3, 14);
  eq(up.mapGoal().room, 'glacier-camp', 'on the Stair, straight to the Sun Mirror');
  const down = game(saveAt('salt')); down.teleport('glacier-landing', 3, 14);
  eq(down.mapGoal(), thing('glacier-landing', '('), 'on the Stair with an orchard goal: the root lift down');
  const wisp = game(s); wisp.teleport('glacier-landing', 3, 14);
  ok(wisp.wispOn(), 'the wisp leads on the Glacier Stair');
  wisp.setFlag('boss:sun-gate');
  ok(!wisp.wispOn(), 'and rests once the Sun Gate is calm');
}
// ─── the unlock dialog: once per door ────────────────────────────────────
for (const [stage, id, shrine] of [['foundry', 'salt', 'fgate'], ['salt', 'orchard', 'salt-toll-road'], ['orchard', 'glacier', 'orchard-wicket']]) {
  const g = game(saveAt(stage, shrine));
  const ev = run(g, 40);
  eq(unlocks(ev), [id], `${id}: the unlock dialog fires when play resumes`);
  ok(ev.some((e) => e.k === 'save'), `${id}: and the game saves, so it is not asked again`);
  eq(unlocks(run(g, 120)), [], `${id}: only once`);
  const again = game(g.snapshot(), { assist: true, strict: false, wisp: true });
  eq(unlocks(run(again, 60)), [], `${id}: not again after a reload`);
  ok(again.newDoors().some((d) => d.id === id), `${id}: the map marker stays until the door is used`);
  const u = UNLOCKS.find((x) => x.id === id);
  ok(again.nextLine().startsWith(`${u.area} is open: ${u.door}`), `${id}: the title says which door: ${again.nextLine()}`);
  again.setFlag(u.visited);
  ok(!again.newDoors().some((d) => d.id === id), `${id}: and the marker goes once the heroes have been through`);
  // an old save that already used the door: no dialog, ever
  const used = saveAt(stage, shrine); used.flags.push(u.visited);
  eq(unlocks(run(game(used), 40)), [], `${id}: an old save that has been through the door is never asked`);
  // and a Strict game is told too (the dialog is not the helping hand)
  eq(unlocks(run(game(saveAt(stage, shrine), { assist: false, strict: true, wisp: false }), 40)), [id], `${id}: Strict games are told as well`);
}
{
  // two doors open and neither used (an old save that skipped the orchard): one dialog each, one at a time
  const s = saveAt('orchard'); s.flags = s.flags.filter((f) => f !== 'orchard:visited');
  const g = game(s);
  eq(unlocks(run(g, 20)), ['orchard'], 'two doors open: the first one first');
  eq(unlocks(run(g, 20)), ['glacier'], 'then the next');
  eq(g.newDoors().map((d) => d.id), ['orchard', 'glacier'], 'both marked on the map');
  ok(g.nextLine().includes('The Glacier Stair is open too'), 'and the title names both');
}
// ─── the title's "Next:" line ──────────────────────────────────────────────
{
  const s = freshSave(); s.flags.push('script:intro');
  eq(game(s).nextLine(), 'Find Reed Dash in the Flooded Halls', 'a new game: the first ability');
  const s2 = saveAt('orchard'); s2.flags.push('glacier:visited');
  eq(game(s2).nextLine(), 'Find Sun Mirror in Phuyu’s Camp', 'on the Stair: the Sun Mirror at Phuyu’s camp');
  s2.abilities.push('sunmirror');
  eq(game(s2).nextLine(), 'Calm the Glass-Horn Vicuña', 'then the vicuña');
  eq(game(saveAt('glacier')).nextLine(), null, 'nothing once the Sun Gate is calm');
}

console.log(`bellspire guide: ${passed} checks passed`);

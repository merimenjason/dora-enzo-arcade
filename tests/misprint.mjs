// Misprint engine checks: the rules (each chinchilla stands on its own ink, purple and the key plate; the other ink is
// a ghost; registration marks hold nobody but stop a plate; gravity; one-cell ledges; a shift carries its chinchilla
// and refuses to push ink off the paper, push someone into something solid, or drop someone off the page; riders and
// the scoop; stamps, folds and ladders), undo and restart, the solver against every page (par at or above the optimum
// and within 30% of it, the ink drop reachable, each page's new idea genuinely needed, no page finishable by one
// chinchilla unless it is a tutorial made that way, a gentle start and nothing past about 40 moves), stars, unlocking,
// and the save, corrupt saves included. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  PAGES, ZINES, page, buildPage, step, solve, won, solidFor, revealed, Game, key, ACTIONS,
  newSave, parseSave, serialise, record, stars, starCount, zineOpen, pageOpen, nextPage, doneIn, zineDone, zinePages, UNLOCK_AT, SAVE_KEY,
} from '../.checks/misprint-game.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const mk = (map) => buildPage({ id: 't', zine: 0, name: 't', caption: '', par: 1, map });
const go = (pg, acts, st = pg.start) => { for (const a of acts) { const r = step(pg, st, a); assert.ok(r.ok, `${a} should be allowed (${r.ok ? '' : r.reason})`); st = r.state; } checks++; return st; };
const no = (pg, st, a) => { const r = step(pg, st, a); return r.ok ? null : r.reason; };
const sw = (st) => ({ ...st, active: 1 - st.active });

// ---------------------------------------------------------------- solidity, ghost ink, the key plate, gravity
{
  const pg = mk([
    '+......+',
    '........',
    'D.E.....',
    'PTXY....',
    '.P......',
    '+......+',
  ]);
  ok(solidFor(pg, 0, 0, 3, pg.start) && !solidFor(pg, 1, 0, 3, pg.start), 'pink holds Dora, not Enzo');
  ok(solidFor(pg, 1, 1, 3, pg.start) && !solidFor(pg, 0, 1, 3, pg.start), 'teal holds Enzo, not Dora');
  ok(solidFor(pg, 0, 2, 3, pg.start) && solidFor(pg, 1, 2, 3, pg.start), 'purple holds both');
  ok(solidFor(pg, 0, 3, 3, pg.start) && solidFor(pg, 1, 3, 3, pg.start), 'the yellow key plate holds both');
  ok(!solidFor(pg, 0, 0, 0, pg.start), 'a registration mark holds nobody');
  ok(solidFor(pg, 0, 2, 2, pg.start) && solidFor(pg, 1, 0, 2, pg.start), 'each chinchilla is solid to the other');
  // Dora steps onto the teal: it is a ghost, so she falls through it onto the pink below
  const a = go(pg, ['R']);
  eq(a.pos[0], [1, 3], 'Dora fell through teal ink and landed on pink, inside the teal cell');
  // Enzo stands on that same teal cell from above
  const b = go(pg, ['L'], sw(pg.start));
  eq(b.pos[1], [1, 2], 'Enzo stands on teal');
  // gravity never leaves anyone hanging, and nobody may fall off the page
  const pg2 = mk(['+....+', '......', '.D..E.', '.P..T.', '+....+']);
  eq(no(pg2, pg2.start, 'L'), 'fall', 'a step off the edge of the ink into the void is refused');
  eq(no(pg2, pg2.start, 'R'), 'fall', 'and so is a step onto ink that is a ghost to you');
  eq(no(pg2, pg2.start, 'sU'), 'edge', 'marks in the corners pin the plate: its ink can’t leave the paper');
}

// ---------------------------------------------------------------- ledges and walls
{
  const pg = mk([
    '+.......+',
    '.........',
    '....P..P.',
    '.D.PP..PE',
    'XXXXXXXPX',
    '+.......+',
  ]);
  let st = go(pg, ['R', 'R']);
  eq(st.pos[0], [3, 2], 'a one-cell ledge climbs itself');
  st = go(pg, ['R'], st);
  eq(st.pos[0], [4, 1], 'and the next one');
  st = go(pg, ['R'], st);
  eq(st.pos[0], [5, 3], 'walking off the top falls back to the floor');
  st = go(pg, ['R'], st);
  eq(no(pg, st, 'R'), 'blocked', 'a wall two cells high stops a walk');
  eq(no(pg, st, 'U'), 'nothing', 'no ladder, nothing to climb');
}

// ---------------------------------------------------------------- shifting plates
{
  const pg = mk([
    'n.......n',
    '.........',
    '..D......',
    '.PPP.....',
    '.........',
    '..Y......',
    'nE......n',
    'TTTTTTTTT',
  ]);
  let st = go(pg, ['sR']);
  eq([st.pos[0], st.off[0]], [[3, 2], [1, 0]], 'a shift moves the plate and its chinchilla together');
  st = go(pg, ['sL']);
  eq(st.off[0], [-1, 0], 'one to the left');
  eq(no(pg, st, 'sL'), 'edge', 'a second would push pink ink off the paper');
  st = go(pg, ['sU', 'sU']);
  eq(st.pos[0], [2, 0], 'up to the top of the page');
  eq(no(pg, st, 'sU'), 'blocked', 'the plate could go higher, but Dora can’t leave the page');
  st = go(pg, ['sD', 'sD']);
  eq(st.pos[0], [2, 4], 'down two');
  eq(no(pg, st, 'sD'), 'blocked', 'the key plate stops Dora, so her plate won’t move');
  eq(no(pg, pg.start, 'L'), null, 'stepping left along the raft is fine');
  eq(no(pg, go(pg, ['L']), 'L'), 'fall', 'stepping off the raft would drop her off the page');
  eq(no(pg, sw(pg.start), 'sU'), 'edge', 'the teal plate is pinned by its marks');
  eq(no(pg, sw(pg.start), 'Q') === null, true, 'switching is always allowed');
  // a plate shift while the other chinchilla stands in the way is refused
  const pg2 = mk(['+.....', '......', '..DE..', '.PPXT.', '+....n']);
  eq(no(pg2, pg2.start, 'sR'), 'blocked', 'Dora can’t be shifted into Enzo');
}

// ---------------------------------------------------------------- riding, and the scoop
{
  const pg = mk([
    'n.......n',
    '.........',
    '.........',
    '....T....',
    '....E....',
    '...DT....',
    '...PP....',
    'n.......n',
  ]);
  let st = go(pg, ['R']);
  eq(st.pos[0], [4, 5], 'Dora walks into the teal under Enzo (a ghost to her)');
  const blocked = no(pg, st, 'sU');
  eq(blocked, 'blocked', 'Enzo can’t be lifted into the teal above his head, so the plate stays put');
  const pg2 = mk(['n.......n', '.........', '.........', '.........', '....E....', '...DT....', '...PP....', 'n.......n']);
  st = go(pg2, ['R', 'sU', 'sU']);
  eq(st.pos, [[4, 3], [4, 2]], 'the scoop: Dora shifts up from underneath and Enzo rides on her head');
  st = go(pg2, ['L'], st);
  eq(st.pos, [[3, 3], [3, 2]], 'a rider rides along on walks too');
  st = go(pg2, ['sD', 'sD'], st);
  eq(st.pos, [[3, 5], [3, 4]], 'and down with the plate');
  // without riding, the same plan fails
  eq(step(pg2, go(pg2, ['R']), 'sU', { noRide: true }).ok, false, 'with riding off, Dora would bump into Enzo instead');
}

// ---------------------------------------------------------------- stamps
{
  const pg = mk([
    '+.......+',
    '.........',
    'D........',
    'P1.......',
    '.........',
    'E........',
    'T4444T...',
    '+.......+',
  ]);
  eq(revealed(pg, pg.start, {}), [false, false], 'nothing printed until someone stands on the stamp');
  eq(no(pg, sw(pg.start), 'R'), 'fall', 'Enzo can’t step onto unprinted cells');
  let st = go(pg, ['R']);
  eq(revealed(pg, st, {}), [false, true], 'Dora on her pink stamp prints Enzo’s dotted teal cells');
  st = go(pg, ['Q', 'R', 'R', 'R', 'R', 'R'], st);
  eq(st.pos[1], [5, 5], 'Enzo walks across the printed bridge');
  st = go(pg, ['Q', 'L'], st);
  eq(revealed(pg, st, {}), [false, false], 'off the stamp, the cells fade');
  // a stamp may not print ink on top of someone
  const pg2 = mk(['+......+', '........', 'D.......', 'P1......', '.E......', '.4......', '.T......', '+......+']);
  const r = step(pg2, pg2.start, 'R');
  eq(r.ok ? 'ok' : r.reason, 'embed', 'pressing the stamp would print teal on Enzo, so the step is refused');
}

// ---------------------------------------------------------------- folds
{
  const pg = mk([
    '.........',
    '.........',
    '.........',
    '...^^....',
    '.........',
    '.........',
    'D..E..>..',
    'P..TTTTTT',
    '+........',
  ]);
  let st = go(pg, ['sU', 'sU', 'sU', 'sU'], sw(pg.start));
  eq(st.pos[1], [3, 2], 'Enzo rides his plate up through the fold');
  eq(no(pg, st, 'sD'), 'blocked', 'but can’t come back down through it');
  st = go(pg, ['R'], st);
  eq(st.pos[1], [4, 2], 'and the fold holds him from above');
  const flat = sw(pg.start);
  st = go(pg, ['R', 'R', 'R', 'R'], flat);
  eq(st.pos[1], [7, 6], 'a sideways fold lets him through one way');
  eq(no(pg, st, 'L'), 'blocked', 'but not back');
  ok(step(pg, st, 'L', { noFold: true }).ok, 'with folds off it is plain paper');
}

// ---------------------------------------------------------------- ladders
{
  const pg = mk([
    '+.......+',
    '.........',
    '.........',
    '...p.....',
    '...p.....',
    '..Dp..E..',
    'XXXXXXXXX',
    '+.......+',
  ]);
  let st = go(pg, ['R', 'U', 'U', 'U']);
  eq(st.pos[0], [3, 2], 'Dora climbs her pink ladder and stands on top of it');
  st = go(pg, ['D', 'D'], st);
  eq(st.pos[0], [3, 4], 'and climbs back down, holding on halfway');
  const e = go(pg, ['L', 'L', 'L'], sw(pg.start));
  eq(e.pos[1], [3, 5], 'Enzo walks into the pink ladder (a ghost to him)');
  eq(no(pg, e, 'U'), 'nothing', 'but only its owner can climb it');
  eq(no(pg, go(pg, ['R']), 'U', ), null, 'Dora can');
  eq(step(pg, go(pg, ['R']), 'U', { noLadder: true }).ok, false, 'with ladders off, nobody climbs');
}

// ---------------------------------------------------------------- undo, restart, the hint
{
  const g = new Game('g1');
  ok(!g.undo(), 'nothing to undo at the start'); ok(!g.restart(), 'nothing to restart');
  const p0 = JSON.stringify(g.st);
  g.do('R'); g.do('R'); g.do('Q');
  eq(g.moves, 2, 'switching is free; walks count');
  ok(g.undo() && g.st.active === 0, 'undo takes back the switch'); ok(g.undo() && g.moves === 1, 'and a walk');
  ok(g.restart() && JSON.stringify(g.st) === p0 && g.moves === 0, 'restart goes back to the start');
  ok(g.undo() && g.moves === 1, 'and undo brings the moves back');
  const r = g.do('L'); ok(r.ok, 'walking back');
  const refusedMoves = g.moves; g.do('sU'); eq(g.moves, refusedMoves, 'a refused move costs nothing');
  const h = g.hint(); ok(h !== null && ACTIONS.includes(h), 'the hint names a move'); eq(g.hints, 1, 'and is counted');
  while (!g.done) { const a = g.hint(); assert.ok(a); g.do(a); }
  ok(g.won && g.done, 'following the hints finishes the page');
  eq(g.do('R').ok, false, 'nothing moves once a page is done');
}

// ---------------------------------------------------------------- every page, against the solver
const rows = [];
const OFF = { shift: { noShift: true }, ride: { noRide: true }, yellow: { noYellow: true }, stamp: { noStamp: true }, fold: { noFold: true }, ladder: { noLadder: true } };
const ids = new Set();
for (const def of PAGES) {
  ok(!ids.has(def.id), `${def.id} is unique`); ids.add(def.id);
  const pg = page(def.id);
  ok(pg.w >= 10 && pg.w <= 16 && pg.h >= 8 && pg.h <= 10, `${def.id} is a sensible size (${pg.w}x${pg.h})`);
  ok(def.caption.length > 10 && def.caption.length < 150, `${def.id} has a one-line caption`);
  const s = solve(pg);
  ok(s, `${def.id} is solvable`);
  // replay the solution through the plain step function
  let st = pg.start; for (const a of s.actions) { const r = step(pg, st, a); assert.ok(r.ok, `${def.id}: solution move ${a}`); st = r.state; }
  ok(won(pg, st), `${def.id}: the solution finishes the page`);
  ok(def.par >= s.moves, `${def.id}: par ${def.par} is at least the optimum ${s.moves}`);
  ok(def.par <= Math.floor(s.moves * 1.3), `${def.id}: par ${def.par} is within 30% of the optimum ${s.moves}`);
  ok(s.moves <= 40, `${def.id}: at most about 40 moves (${s.moves})`);
  ok(pg.drop >= 0, `${def.id} has an ink drop`);
  const d = solve(pg, pg.start, {}, true);
  ok(d, `${def.id}: the ink drop can be collected on the way to finishing`);
  const dOnly = solve(pg, pg.start, { only: 0 }), eOnly = solve(pg, pg.start, { only: 1 });
  if (def.solo) ok(dOnly || eOnly, `${def.id} is a one-chinchilla tutorial`);
  else ok(!dOnly && !eOnly, `${def.id} can’t be finished by Dora alone or Enzo alone`);
  let without = '';
  if (def.teaches && OFF[def.teaches]) {
    const x = solve(pg, pg.start, OFF[def.teaches]);
    ok(!x || x.moves >= Math.ceil(s.moves * 1.3), `${def.id} needs ${def.teaches}: without it ${x ? x.moves : 'unsolvable'} vs ${s.moves}`);
    without = x ? `${x.moves}` : 'impossible';
  }
  if (def.teaches === 'switch') ok(!dOnly && !eOnly, `${def.id}: both chinchillas are needed`);
  rows.push({ id: def.id, zine: def.zine, name: def.name, opt: s.moves, par: def.par, sw: s.switches, drop: d.moves, teaches: def.teaches ?? '', without, explored: s.explored });
}
eq(PAGES.length, 30, 'thirty pages'); eq(ZINES.length, 3, 'three zines');
for (let z = 0; z < 3; z++) eq(zinePages(z).length, 10, `ten pages in ${ZINES[z].name}`);
// a gentle start: the first five pages are short
for (const r of rows.slice(0, 5)) ok(r.opt <= 18, `${r.id} is near-trivial (${r.opt} moves)`);
// each new idea is introduced on its own page
const intro = Object.fromEntries(['yellow', 'stamp', 'fold', 'ladder'].map((m) => [m, PAGES.findIndex((p) => p.teaches === m)]));
for (const [m, i] of Object.entries(intro)) {
  ok(i >= 0, `${m} has an introduction page`);
  const uses = (p) => { const pg = page(p.id); return m === 'yellow' ? pg.yellow.some(Boolean) : m === 'fold' ? pg.fold.some(Boolean) : m === 'stamp' ? pg.plate.some((pl) => pl.includes(3)) : pg.plate.some((pl) => pl.includes(2)); };
  ok(PAGES.slice(0, i).every((p) => !uses(p)), `nothing before ${PAGES[i].id} uses ${m}`);
}

// ---------------------------------------------------------------- stars, the save, unlocking
{
  const s = newSave();
  eq(stars(PAGES[0], undefined), [false, false, false], 'no stars before finishing');
  record(s, 'g1', PAGES[0].par + 3, false, 2);
  eq(stars(PAGES[0], s.pages.g1), [true, false, false], 'finished over par without the drop: one star');
  record(s, 'g1', PAGES[0].par, true, 0);
  eq(stars(PAGES[0], s.pages.g1), [true, true, true], 'at par with the drop: three');
  eq(s.pages.g1.hints, 0, 'the fewest hints are kept');
  record(s, 'g1', PAGES[0].par + 9, false, 5);
  eq(s.pages.g1, { best: PAGES[0].par, drop: true, hints: 0 }, 'a worse run never lowers a record');
  eq(starCount(s), 3, 'three stars in all');
  ok(zineOpen(s, 0) && !zineOpen(s, 1), 'the first zine is open, the second is not');
  ok(pageOpen(s, 'g1') && pageOpen(s, 'g4') && !pageOpen(s, 'g5'), 'pages open two ahead of what is done');
  for (const p of zinePages(0).slice(0, UNLOCK_AT)) record(s, p.id, p.par, false, 0);
  ok(zineOpen(s, 1) && !zineOpen(s, 2), `${UNLOCK_AT} pages done opens the next zine`);
  eq(doneIn(s, 0), UNLOCK_AT, 'done counted'); ok(!zineDone(s, 0), 'not complete yet');
  s.settings.peek = true; ok(zineOpen(s, 2) && pageOpen(s, 's10'), 'peek ahead opens everything');
  eq(nextPage('g3'), 'g4', 'the next page'); eq(nextPage('g10'), null, 'none after the last page of a zine');
  // round trip
  const back = parseSave(serialise(s));
  eq(back, s, 'the save round-trips');
  eq(SAVE_KEY, 'misprint-v1', 'the save key');
  // corrupt saves
  const fresh = newSave();
  for (const bad of [null, '', 'not json', '[]', '42', '{"v":2,"pages":{"g1":{"best":3}}}', '{"v":1,"pages":[]}'])
    eq(parseSave(bad), fresh, `a corrupt save (${String(bad).slice(0, 20)}) starts fresh`);
  const odd = parseSave(JSON.stringify({ v: 1, pages: { g1: { best: 'x' }, g2: { best: -4 }, zz: { best: 5 }, g3: { best: 7.6, drop: 'yes', hints: -2 }, g4: { best: Infinity } }, settings: { sound: 'loud', music: false, peek: 1 }, seenIntro: 'yes', ended: [0, 7, 'a', 2, 2] }));
  eq(odd.pages, { g3: { best: 7, drop: false, hints: 0 } }, 'bad records are dropped, odd ones cleaned');
  eq(odd.settings, { sound: true, music: false, peek: false, motion: true }, 'bad settings fall back');
  eq([odd.seenIntro, odd.ended], [false, [0, 2]], 'and the rest');
}

// ---------------------------------------------------------------- determinism
{
  const pg = page('g10'); const a = solve(pg), b = solve(pg);
  eq(a.actions, b.actions, 'the solver is deterministic');
  ok(key(pg, pg.start) !== key(pg, { ...pg.start, active: 1 }), 'the state key tells the active chinchilla apart');
}

console.log('page  zine  opt  par  switches  drop  teaches   without  explored  name');
for (const r of rows) console.log(`${r.id.padEnd(5)} ${String(r.zine + 1).padEnd(5)} ${String(r.opt).padStart(3)}  ${String(r.par).padStart(3)}  ${String(r.sw).padStart(8)}  ${String(r.drop).padStart(4)}  ${r.teaches.padEnd(8)}  ${String(r.without).padStart(10)}  ${String(r.explored).padStart(8)}  ${r.name}`);
console.log(`PASS Misprint: ${checks} checks`);

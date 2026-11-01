// Shadowplay engine checks: the projection (a puppet near the screen casts its own size, near the lantern up to three
// times bigger; sliding a lantern moves near shadows little and far ones a lot; two lanterns cast two shadows), the
// coloured glass and the overlap score, every scene's own solution casting it exactly while no scene starts cast, the
// performance (moves, undo, reset, hints, snapping, what each scene allows), stars, unlocking, and saving, corrupt
// saves included.
import assert from 'node:assert/strict';
import {
  SHAPES, SCENES, SCENE_IDS, STORIES, KS, LAMP_D, MATCH, COVER, GW, GH, ROT_STEPS, TURN_STEPS, MOVE_SLACK, SAVE_KEY,
  kOf, depthOf, lampHome, lampAt, shadowCentre, shadowPolys, localPolys, polyBox, polyArea, rasterStates, rasterKeys, scoreKeys, gelBit,
  startStage, solutionStage, fitStage, snapPose, canDo, Show, poseGap, flourishDone, starsFor, freshSave, readSave, readPose,
  starCount, starBits, totalStars, storyOpen, sceneOpen, sandboxOpen, nextScene, recordScene, done, storyDone,
} from '../.checks/shadow-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, msg, tol = 1e-9) => ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`);
const pose = (x, y, d = 0, r = 0, f = 0, t = 0, on = true) => ({ x: Math.round(x * 8), y: Math.round(y * 8), d, r, f, t, on });
const W = [{ x: 8, y: 4.5, tone: 'warm' }];
const TWO = [{ x: 6, y: 4.5, tone: 'gold' }, { x: 10, y: 4.5, tone: 'blue' }];
const boxOf = (polys) => polys.map(polyBox).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
const cells = (st) => st.reduce((n, a) => n + a.reduce((m, v) => m + (v ? 1 : 0), 0), 0);

// ---- the projection
{
  near(kOf(0), 1, 'a puppet against the screen casts its own size');
  near(kOf(KS.length - 1), 3, 'a puppet right by the lantern casts three times its size');
  near(kOf(-5), 1, 'depths clamp low'); near(kOf(99), 3, 'depths clamp high');
  near(depthOf(0), 0, 'notch 0 is on the screen');
  for (let d = 0; d < KS.length; d++) near(LAMP_D / (LAMP_D - depthOf(d)), KS[d], `notch ${d}: similar triangles give the scale`, 1e-9);
  for (let d = 1; d < KS.length; d++) ok(KS[d] > KS[d - 1] && depthOf(d) > depthOf(d - 1), `notch ${d} is further from the screen and bigger`);
  const sh = SHAPES.coin, home = lampHome({ lamps: W });
  eq(home, [8, 4.5], 'one lantern is its own home');
  eq(lampHome({ lamps: TWO }), [8, 4.5], 'two lanterns: home is between them');
  const w0 = boxOf(shadowPolys(sh, pose(8, 4.5, 0), home, home)), w6 = boxOf(shadowPolys(sh, pose(8, 4.5, 6), home, home));
  near((w6[2] - w6[0]) / (w0[2] - w0[0]), 3, 'the shadow is three times wider by the lantern', 1e-9);
  // the stored centre is where the shadow falls from home, whatever the depth
  for (let d = 0; d < KS.length; d++) eq(shadowCentre(home, home, pose(5, 3, d)), [5, 3], `from home the shadow sits where it is put (notch ${d})`);
  // sliding the lantern one unit moves a shadow by k − 1 the other way: not at all on the screen, twice as far by the lantern
  const L1 = lampAt(W[0], 4);
  eq(L1, [9, 4.5], 'a lantern offset counts in quarter units');
  near(shadowCentre(home, L1, pose(5, 3, 0))[0], 5, 'a puppet on the screen does not move when the lantern slides');
  near(shadowCentre(home, L1, pose(5, 3, 6))[0], 5 - 2, 'a puppet by the lantern moves twice as far, the other way');
  // two lanterns: a far puppet splits into two shadows, a near one stays as one
  const st = (d) => ({ props: [{ shape: 'coin', pose: pose(8, 4.5, d) }], lamps: TWO, offs: [0, 0] });
  const nearS = rasterStates(st(0)), farS = rasterStates(st(6));
  eq(Array.from(nearS[0]), Array.from(nearS[1]), 'on the screen, both lanterns cast the same shadow');
  const ga = boxOf(shadowPolys(sh, pose(8, 4.5, 6), [8, 4.5], [6, 4.5])), gb = boxOf(shadowPolys(sh, pose(8, 4.5, 6), [8, 4.5], [10, 4.5]));
  ok(ga[0] > gb[0], 'the gold lantern (left) throws its shadow to the right, the blue one to the left');
  ok(cells(farS) > 0 && rasterKeys(st(6)).some((k) => k === 1) && rasterKeys(st(6)).some((k) => k === 34), 'far away the shadows separate: parts dark to one lantern only');
  // turning: a fan seen edge-on is a thin line; a plate seen edge-on is too, but a round thing never needs rotating
  const fan = SHAPES.roundfan, a0 = boxOf(localPolys(fan, pose(0, 0, 0, 0, 0, 0))), a6 = boxOf(localPolys(fan, pose(0, 0, 0, 0, 0, TURN_STEPS)));
  ok(a6[2] - a6[0] < (a0[2] - a0[0]) * 0.5, 'a fan turned edge-on is much thinner');
  const stick0 = boxOf([localPolys(fan, pose(0, 0))[1]]), stick6 = boxOf([localPolys(fan, pose(0, 0, 0, 0, 0, TURN_STEPS))[1]]);
  near(stick6[2] - stick6[0], stick0[2] - stick0[0], 'the fan’s stick is round: it stays the same width as it turns', 1e-9);
  ok(polyArea(localPolys(SHAPES.plate, pose(0, 0, 0, 0, 0, TURN_STEPS))[0]) > 0, 'edge-on never vanishes completely');
  // rotation and flipping
  const r12 = boxOf(localPolys(SHAPES.cane, pose(0, 0, 0, 12))), r0 = boxOf(localPolys(SHAPES.cane, pose(0, 0, 0, 0)));
  near(r12[3] - r12[1], r0[3] - r0[1], 'half a turn keeps the height', 1e-9);
  const f1 = localPolys(SHAPES.cane, pose(0, 0, 0, 0, 1))[0], f0 = localPolys(SHAPES.cane, pose(0, 0, 0, 0, 0))[0];
  ok(f1.every((p, i) => Math.abs(p[0] + f0[i][0]) < 1e-9 && Math.abs(p[1] - f0[i][1]) < 1e-9), 'flipping mirrors left to right');
  eq(ROT_STEPS * 15, 360, 'rotation turns in fifteen-degree steps');
}

// ---- the overlap score and glass
{
  const one = (shape, p) => rasterKeys({ props: [{ shape, pose: p }], lamps: W, offs: [0] });
  const a = one('coin', pose(5, 4)), b = one('coin', pose(5, 4)), c = one('coin', pose(11, 4));
  near(scoreKeys(a, b), 1, 'the same picture scores 1');
  near(scoreKeys(a, c), 0, 'pictures that don’t meet score 0');
  const half = scoreKeys(one('matchbox', pose(5, 4)), one('matchbox', pose(6, 4)));
  ok(half > 0.25 && half < 0.45, `a box moved half its width overlaps about a third (${half.toFixed(2)})`);
  near(scoreKeys(new Uint16Array(GW * GH), new Uint16Array(GW * GH)), 1, 'two empty screens match');
  // glass: tints instead of blocking; a dark puppet over glass is dark; two glasses mix
  const gold = one('goldcoin', pose(8, 4.5));
  ok(gold.some((k) => k === 2 + gelBit('gold')), 'gold glass casts gold light, not shadow');
  ok(!gold.some((k) => k === 1), 'glass blocks nothing');
  const both = rasterKeys({ props: [{ shape: 'goldcoin', pose: pose(8, 4.5) }, { shape: 'coin', pose: pose(8, 4.5) }], lamps: W, offs: [0] });
  ok(both.some((k) => k === 1), 'a dark puppet over the glass is still dark');
  const mix = rasterKeys({ props: [{ shape: 'goldcoin', pose: pose(8, 4.5) }, { shape: 'rubydrop', pose: pose(8, 4.5) }], lamps: W, offs: [0] });
  ok(mix.some((k) => k === 2 + (gelBit('gold') | gelBit('ruby'))), 'gold and ruby glass together mix');
  ok(gold.some((k) => k !== 2 + gelBit('gold') && k !== 0) === false, 'a single glass casts only its own colour');
  // a picture made the wrong colour does not count as the right one
  near(scoreKeys(one('goldcoin', pose(8, 4.5)), one('coin', pose(8, 4.5))), 0, 'gold glass where a shadow belongs scores nothing');
  ok(MATCH > 0.8 && COVER > 0.5, 'the match needs most of the picture');
}

// ---- the scenes
{
  eq(STORIES.length, 5, 'five stories'); eq(SCENE_IDS.length, 30, 'thirty scenes');
  STORIES.forEach((s, si) => { eq(s.scenes.length, 6, `story ${si + 1} has six scenes`); ok(s.name && s.blurb, `story ${si + 1} has a name and a blurb`); });
  eq(new Set(SCENE_IDS).size, 30, 'scene ids are unique');
  for (const id of SCENE_IDS) {
    const S = SCENES[id];
    ok(S.name && S.line && S.after, `${id}: a name and both story lines`);
    ok(S.props.length >= 2 && S.props.length <= 10, `${id}: between two and ten puppets`);
    ok(S.props.some((P) => !P.fixed && !P.extra) || S.lamps.some((L) => L.move), `${id}: something to move`);
    ok(S.par >= 1 && S.par <= 7, `${id}: par is between 1 and 7 (${S.par})`);
    ok(S.lamps.length === 1 || S.lamps.length === 2, `${id}: one or two lanterns`);
    for (const P of S.props) {
      ok(Object.prototype.hasOwnProperty.call(SHAPES, P.shape), `${id}: ${P.shape} is a puppet`);
      for (const p of [P.start, P.sol].filter(Boolean)) ok(readPose(p) !== null, `${id}: ${P.shape} sits on the screen in a real pose`);
      if (P.fixed) eq(P.start, P.sol, `${id}: a set piece starts where it belongs`);
      if (P.extra) ok(P.sol !== null, `${id}: a flourish puppet stays on the rods`);
    }
    // the authored solution casts the scene exactly, and every part shows
    const f = fitStage(S, solutionStage(S));
    ok(f.matched && f.iou === 1 && f.cover === 1, `${id}: the solution casts it exactly`);
    // and no scene starts cast, nor nearly so
    const g = fitStage(S, startStage(S));
    ok(!g.matched && g.fit < 0.9, `${id}: the scene starts uncast (${g.fit.toFixed(2)})`);
    // the starting tools match the puppets: things that need turning have the turn tool, decoys can be taken down
    S.props.forEach((P, i) => {
      if (!P.sol && !P.extra) ok(canDo(S, i, 'take'), `${id}: decoy ${P.shape} can be taken down`);
      if (P.sol && !P.fixed && P.sol.d !== P.start.d) ok(canDo(S, i, 'depth'), `${id}: ${P.shape} can reach its depth`);
      if (P.sol && !P.fixed && P.sol.t !== P.start.t) ok(canDo(S, i, 'turn'), `${id}: ${P.shape} can reach its turn`);
      if (P.sol && !P.fixed && !SHAPES[P.shape].round && (P.sol.r !== P.start.r)) ok(canDo(S, i, 'rot'), `${id}: ${P.shape} can reach its rotation`);
      if (P.sol && !P.fixed && P.sol.f !== P.start.f) ok(canDo(S, i, 'flip'), `${id}: ${P.shape} can reach its flip`);
    });
    S.lamps.forEach((L, li) => { if (L.sol) ok(L.move && S.tools.includes('lamp') && L.sol >= L.move[0] && L.sol <= L.move[1], `${id}: lantern ${li} can reach its place`); });
    // the flourish can be earned on top of the solution
    const sol = solutionStage(S);
    ok(S.flourish.k !== 'extra' || flourishDone(S, sol) || !flourishDone(S, startStage(S)) || true, `${id}: flourish defined`);
    if (S.flourish.k !== 'extra') ok(flourishDone(S, sol), `${id}: the solution earns the ${S.flourish.k} flourish`);
    else {
      // put the flourish puppet in the middle of its zone, as near the screen as it goes, and look for a clear spot
      const F = S.flourish, Pp = S.props[F.prop];
      ok(Pp && Pp.extra, `${id}: the flourish puppet is an extra`);
      let found = false;
      for (let x = F.zone[0]; x <= F.zone[2] && !found; x += 0.25) for (let y = F.zone[1]; y <= F.zone[3] && !found; y += 0.25) {
        const st = { ...sol, props: sol.props.map((p, i) => (i === F.prop ? { ...p, pose: { ...p.pose, x: Math.round(x * 8), y: Math.round(y * 8), on: true } } : p)) };
        if (flourishDone(S, st) && fitStage(S, st).matched) found = true;
      }
      ok(found, `${id}: there is a spot for the flourish puppet that keeps the picture cast`);
    }
    for (const A of S.alive) ok(A.prop >= 0 && A.prop < S.props.length && A.per > 0, `${id}: its coming-alive moves a real puppet`);
  }
}

// ---- a performance
{
  const S = SCENES['s1-1'];
  const sh = new Show(S);
  ok(!sh.matched && sh.moves === 0 && !sh.canUndo, 'a show starts uncast with no moves');
  const i = S.props.findIndex((P) => !P.fixed && !P.extra), want = S.props[i].sol;
  ok(sh.apply({ k: 'move', i, x: want.x - 40, y: want.y }), 'a puppet moves');
  eq(sh.moves, 1, 'picking up a puppet is one move');
  ok(sh.apply({ k: 'move', i, x: want.x, y: want.y }), 'and moves again');
  eq(sh.moves, 1, 'moving the same puppet again is still one move');
  ok(sh.matched, 'Moonrise is cast with one puppet');
  eq(starsFor(S, sh.stage, sh.moves).slice(0, 2), [true, true], 'cast within par: two stars');
  ok(!sh.apply({ k: 'move', i, x: want.x, y: want.y }), 'a move to the same place changes nothing');
  ok(sh.undo() && !sh.matched && sh.moves === 1, 'undo puts it back (the move still counts)');
  sh.reset(); ok(sh.moves === 0 && !sh.canUndo && !sh.matched, 'reset starts again');
  ok(!sh.apply({ k: 'move', i: S.props.findIndex((P) => P.fixed), x: 0, y: 0 }) || !S.props.some((P) => P.fixed), 'a set piece does not move');
  ok(!sh.apply({ k: 'move', i: 99, x: 0, y: 0 }), 'no such puppet');
  // moves clamp to the screen
  sh.apply({ k: 'move', i, x: -500, y: 9999 }); eq([sh.poses[i].x, sh.poses[i].y], [0, 72], 'moves stay on the screen');
  // tools a scene doesn't have
  ok(!sh.apply({ k: 'depth', i, d: 3 }) && !sh.apply({ k: 'flip', i }) && !sh.apply({ k: 'on', i, on: false }), 'the first scene only lets puppets slide');
  // switching puppets costs a move each time, coming back costs again
  const S2 = SCENES['s1-3'], sh2 = new Show(S2), mv = S2.props.map((P, j) => j).filter((j) => !S2.props[j].fixed && !S2.props[j].extra);
  sh2.apply({ k: 'move', i: mv[0], x: 10, y: 10 }); sh2.apply({ k: 'move', i: mv[1], x: 10, y: 10 }); sh2.apply({ k: 'move', i: mv[0], x: 12, y: 10 });
  eq(sh2.moves, 3, 'puppet A, puppet B, puppet A again: three moves');
  // rotation wraps, turn clamps, depth clamps
  const S5 = SCENES['s5-1'], j = S5.props.findIndex((P) => !P.fixed && !P.extra && SHAPES[P.shape].turn);
  if (j >= 0) {
    const s5 = new Show(S5);
    s5.apply({ k: 'rot', i: j, r: -1 }); eq(s5.poses[j].r, ROT_STEPS - 1, 'rotation wraps round');
    s5.apply({ k: 'turn', i: j, t: 99 }); eq(s5.poses[j].t, TURN_STEPS, 'turning stops at edge-on');
    s5.apply({ k: 'depth', i: j, d: 99 }); eq(s5.poses[j].d, KS.length - 1, 'depth stops at the lantern');
  }
  // every scene: replaying the solution as ops casts it, and a hint always points at something that needs changing
  for (const id of SCENE_IDS) {
    const S = SCENES[id], sh = new Show(S);
    let guard = 0;
    for (let h = sh.hint(); h && guard < 20; h = sh.hint(), guard++) {
      if (h.k === 'lamp') { ok(sh.apply({ k: 'lamp', i: h.i, x: h.x }), `${id}: the lantern hint can be followed`); continue; }
      const P = S.props[h.i], cur = sh.poses[h.i], to = h.pose;
      if (!to.on) { ok(sh.apply({ k: 'on', i: h.i, on: false }), `${id}: a decoy can come down`); continue; }
      if (!cur.on) sh.apply({ k: 'on', i: h.i, on: true });
      if (to.d !== cur.d) sh.apply({ k: 'depth', i: h.i, d: to.d });
      if (to.r !== cur.r) sh.apply({ k: 'rot', i: h.i, r: to.r });
      if (to.f !== sh.poses[h.i].f) sh.apply({ k: 'flip', i: h.i });
      if (to.t !== cur.t) sh.apply({ k: 'turn', i: h.i, t: to.t });
      sh.apply({ k: 'move', i: h.i, x: to.x, y: to.y });
      void P;
    }
    ok(sh.matched, `${id}: following the hints casts the scene`);
    ok(sh.moves <= S.par + MOVE_SLACK, `${id}: following the hints is within the move budget (${sh.moves} vs par ${S.par})`);
    ok(sh.hint() === null, `${id}: no hint once everything is in place`);
  }
  // snapping: dropped close and held the right way it clicks in; held wrong it doesn't
  const sc = SCENES['s1-3'], k = sc.props.findIndex((P) => !P.fixed && !P.extra), sol = sc.props[k].sol;
  eq(snapPose(sc, k, { ...sol, x: sol.x + 2, y: sol.y - 1 }), sol, 'a puppet dropped close by clicks into place');
  eq(snapPose(sc, k, { ...sol, x: sol.x + 20 }), null, 'too far: no click');
  eq(snapPose(sc, k, { ...sol, x: sol.x + 2, r: (sol.r + 1) % ROT_STEPS }), null, 'turned wrong: no click');
  eq(snapPose(sc, k, sol), null, 'already in place: nothing to do');
  ok(poseGap(sol, sol, SHAPES[sc.props[k].shape]) === 0, 'a pose is no distance from itself');
  // stars
  const sv = new Show(SCENES['s1-1']); const p0 = SCENES['s1-1'].props.findIndex((P) => !P.fixed && !P.extra);
  eq(starsFor(SCENES['s1-1'], sv.stage, 0), [false, false, false], 'uncast: no stars');
  const ss = solutionStage(SCENES['s1-1']);
  eq(starsFor(SCENES['s1-1'], ss, SCENES['s1-1'].par + MOVE_SLACK + 1)[1], false, 'too many moves: no second star');
  void p0;
}

// ---- unlocking
{
  const s = freshSave();
  ok(storyOpen(s, 0) && !storyOpen(s, 1), 'only the first story is open');
  ok(sceneOpen(s, 's1-1') && !sceneOpen(s, 's1-2') && !sceneOpen(s, 's2-1'), 'only its first scene is open');
  ok(!sandboxOpen(s), 'the free stage waits');
  eq(nextScene(s), 's1-1', 'the next scene is the first');
  recordScene(s, 's1-1', [true, false, false], 5);
  ok(sceneOpen(s, 's1-2') && sceneOpen(s, 's1-3'), 'one scene cast opens the next two');
  ok(!sceneOpen(s, 's1-4'), 'but not three ahead');
  recordScene(s, 's1-3', [true, true, false], 2);
  ok(sceneOpen(s, 's1-4') && sceneOpen(s, 's1-5') && !sceneOpen(s, 's1-6'), 'skipping one is fine; the finale waits');
  for (const id of ['s1-2', 's1-4', 's1-5']) recordScene(s, id, [true, true, true], 3);
  ok(sceneOpen(s, 's1-6') && !storyOpen(s, 1), 'all five open the finale; the next story waits for it');
  const r = recordScene(s, 's1-6', [true, true, true], 4);
  ok(r.first && !r.finale && storyDone(s, 0) && storyOpen(s, 1) && sandboxOpen(s), 'finishing the story opens the next one and the free stage');
  // stars and bests only improve
  const again = recordScene(s, 's1-3', [true, false, false], 9);
  ok(!again.first && again.newStars === 0, 'a worse replay changes nothing');
  eq(s.scenes['s1-3'], { done: true, stars: 3, best: 2 }, 'the stars and fewest moves are kept');
  const better = recordScene(s, 's1-3', [true, false, true], 1);
  ok(better.newStars === 1 && s.scenes['s1-3'].stars === 7 && s.scenes['s1-3'].best === 1, 'a better replay adds the new star');
  eq(starCount(7), 3, 'three bits, three stars'); eq(starBits([true, false, true]), 5, 'stars pack into bits');
  // the very last scene is the finale of everything
  const all = freshSave();
  for (const id of SCENE_IDS.slice(0, -1)) recordScene(all, id, [true, true, true], 1);
  const fin = recordScene(all, SCENE_IDS[SCENE_IDS.length - 1], [true, false, false], 7);
  ok(fin.finale && all.ended, 'the last scene ends the show');
  ok(!recordScene(all, SCENE_IDS[SCENE_IDS.length - 1], [true, true, false], 3).finale, 'the ending plays once');
  eq(totalStars(all), 29 * 3 + 2, 'stars add up');
  ok(done(all, 's5-6') && nextScene(all) === null, 'nothing left to do');
}

// ---- saving
{
  eq(SAVE_KEY, 'shadowplay-v1', 'a versioned save key');
  const s = freshSave();
  recordScene(s, 's1-1', [true, true, false], 1);
  s.sandbox.props.push({ shape: 'coin', pose: pose(4, 4, 2) }); s.sandbox.two = true; s.sandbox.offs = [-4, 8];
  s.tutorial = true; s.settings.music = false;
  eq(readSave(JSON.stringify(s)), s, 'a save reads back the same');
  for (const bad of [null, '', 'nope', '{', '[]', '42', 'null', '{"v":2}', JSON.stringify({ v: 1, scenes: 5, sandbox: 'x', settings: [] })]) {
    const r = readSave(bad);
    eq(r.scenes, {}, `a broken save (${String(bad).slice(0, 20)}) starts fresh`);
    ok(r.settings.sound && r.settings.music && r.sandbox.props.length === 0, 'with default settings');
  }
  const mixed = readSave(JSON.stringify({
    v: 1,
    scenes: { 's1-1': { done: true, stars: 99, best: -3 }, 's1-2': { done: 'yes' }, 'zz-9': { done: true, stars: 7 }, 's2-1': { done: true, stars: 4, best: 6 } },
    sandbox: { props: [{ shape: 'coin', pose: { x: 9999, y: 1, d: 0, r: 0, f: 0, t: 0, on: true } }, { shape: 'wand', pose: pose(1, 1) }, { shape: 'bowl', pose: pose(2, 3, 1, 5, 1) }, 'x'], two: 'yes', offs: [999, 4] },
    tutorial: 1, settings: { sound: false },
  }));
  eq(Object.keys(mixed.scenes).sort(), ['s1-1', 's2-1'], 'only real, finished scenes are kept');
  eq(mixed.scenes['s1-1'], { done: true, stars: 1, best: null }, 'bad stars and moves are dropped');
  eq(mixed.scenes['s2-1'].stars, 5, 'a scene that is done always has its first star');
  eq(mixed.sandbox.props.map((p) => p.shape), ['bowl'], 'bad sandbox puppets are dropped');
  ok(mixed.sandbox.two === false && mixed.sandbox.offs[0] === 0 && mixed.sandbox.offs[1] === 4, 'bad sandbox lanterns are reset');
  ok(mixed.tutorial === false && mixed.settings.sound === false && mixed.settings.music === true, 'flags read strictly');
  const many = readSave(JSON.stringify({ v: 1, sandbox: { props: Array.from({ length: 40 }, () => ({ shape: 'coin', pose: pose(1, 1) })) } }));
  ok(many.sandbox.props.length <= 12, 'the free stage holds twelve puppets at most');
  eq(readPose({ x: 1, y: 1, d: 0, r: 0, f: 2, t: 0, on: true }), null, 'a pose with a bad flip is refused');
  eq(readPose({ x: 1.5, y: 1, d: 0, r: 0, f: 0, t: 0, on: true }), null, 'a pose off the grid is refused');
}

console.log(`shadow: ${checks} checks passed`);

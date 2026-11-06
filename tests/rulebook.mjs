// Rulebook FC engine checks: the league (ten teams, each its own style, the Grumbles last), the season (law reveal, a win's
// three cards, a draw's two, a defeat's strike, three strikes out, the tenth match won), Red Pen, the laws as hooks into
// the match (goal sizes, mud, hedges, heavy ball, short matches, an extra player, what goals are worth), Fog, and the save.
// Run after `npm test` has compiled the engines into .checks/ (or `npm run test:rulebook`).
import assert from 'node:assert/strict';
import { Run, TEAMS, OURS, THEIRS, GENTLE, LINKS, MATCHES, STRIKES, MUD, team, linksOf, lawOf, isOurs, SAVE_KEY, ALL_LAWS, newSave, parseSave, serialise, discover, bank } from '../.checks/rulebook-game.js';
import { MOUTH, TURNS, PASS, COLS } from '../.checks/tactics-football.js';

/** ends the current match with a given score */
function finish(r, us, them) {
  r.game.s.score = [us, them]; r.game.s.over = true;
  r.endMatch();
}
/** a fresh match with only these laws in the book */
function withLaws(ours, theirs, seed = 3) {
  const r = new Run(seed);
  // their law for the match is one of these (or Fog, which only changes what we see)
  r.book.ours = ours; r.book.theirs = theirs.slice(); r.order[0] = theirs[0] ?? 'fog';
  r.startMatch(); r.book.theirs = theirs.slice();
  r.ready();
  return r;
}

{
  // the league: ten fixtures, animal teams easiest first, the Grumbles at the end, each with sprites and a style
  assert.equal(TEAMS.length, MATCHES);
  assert.deepEqual(TEAMS.slice(0, 8).map((t) => t.id), ['rabbit', 'frog', 'mole', 'otter', 'hog', 'magpie', 'fox', 'badger']);
  assert.ok(TEAMS.slice(8).every((t) => t.sprite === 'grumble'), 'the Grumbles are the boss');
  for (const t of TEAMS) { assert.ok(t.name && t.kit && t.style && t.keeper); assert.equal(team(TEAMS.indexOf(t)), t); }
  assert.equal(TEAMS[0].level.move, 3, 'rabbits are quick'); assert.ok(TEAMS[1].level.aerial, 'frogs love a long ball');
  assert.ok(TEAMS[2].level.tunnel); assert.equal(TEAMS[3].level.passes, 2); assert.ok(TEAMS[5].level.thief);
  assert.equal(TEAMS[7].level.move, 1); assert.ok(TEAMS[7].level.front);
  // the early sides are gentle: one presser, small tackle zones, no lanes read
  for (const t of TEAMS.slice(0, 3)) { assert.equal(t.level.press, 1); assert.equal(t.level.zone, 1); assert.equal(t.level.lanes, 0); }
  // each match is played against that team's sprites
  const r = new Run(5);
  assert.equal(r.game.units.find((u) => u.team === 1 && !u.keeper).who, 'rabbit');
  assert.equal(r.game.units.find((u) => u.team === 1 && u.keeper).who, 'rabbit-keeper');
}

{
  // the season: their law is revealed, a win offers three cards, a draw two, a defeat none (and a strike)
  const r = new Run(21);
  assert.equal(r.phase, 'law'); assert.equal(r.match, 0); assert.ok(GENTLE.includes(r.order[0]) && GENTLE.includes(r.order[1]), 'gentle laws first');
  assert.equal(new Set(r.order).size, MATCHES, 'ten different laws');
  assert.deepEqual(r.book.theirs, [r.order[0]]);
  assert.ok(!r.move(0, 7, 4), 'nothing happens until the card is read'); r.ready(); assert.equal(r.phase, 'play');
  finish(r, 2, 1); assert.equal(r.phase, 'pick'); assert.equal(r.offer.length, 3); assert.deepEqual(r.results, ['won']);
  const card = r.offer.find((id) => id !== 'redpen');
  assert.ok(r.pick(card)); assert.ok(r.book.ours.includes(card)); assert.equal(r.match, 1); assert.equal(r.phase, 'law');
  assert.equal(r.book.theirs.length, 2);
  r.ready(); finish(r, 1, 1); assert.equal(r.offer.length, 2); assert.equal(r.strikes, 0);
  assert.ok(!r.pick('nonsense')); assert.ok(r.pick()); assert.equal(r.match, 2, 'a card can be passed up');
  r.ready(); finish(r, 0, 2); assert.equal(r.strikes, 1); assert.equal(r.offer.length, 0); assert.ok(r.pick());
  r.ready(); finish(r, 0, 1); r.pick(); r.ready(); finish(r, 0, 1);
  assert.equal(r.strikes, STRIKES); assert.equal(r.phase, 'lost');
  // finishing the tenth match with strikes to spare wins the season
  const w = new Run(22);
  for (let k = 0; k < MATCHES; k++) { w.ready(); finish(w, 1, 0); if (w.phase === 'pick') w.pick(); }
  assert.equal(w.phase, 'won'); assert.equal(w.stats.won, MATCHES);
}

{
  // Red Pen strikes one of their laws out of the book
  const r = new Run(30);
  r.ready(); r.book.theirs.push('giant');
  r.phase = 'pick'; r.offer = ['redpen', 'wide'];
  assert.ok(r.pick('redpen')); assert.equal(r.phase, 'redpen');
  assert.ok(!r.strike('fog'), 'only a law in the book');
  assert.ok(r.strike('giant')); assert.ok(!r.book.theirs.includes('giant')); assert.ok(r.book.struck.includes('giant'));
  assert.equal(r.match, 1); assert.equal(r.phase, 'law');
  // Red Pen turns up now and then
  let seen = 0;
  for (let k = 0; k < 40; k++) { const q = new Run(100 + k); q.makeOffer(3); if (q.offer.includes('redpen')) seen++; assert.equal(new Set(q.offer).size, q.offer.length); }
  assert.ok(seen > 5 && seen < 30);
}

{
  // the laws are hooks into the match
  const plain = withLaws([], []);
  assert.deepEqual(plain.game.mouth(1), MOUTH); assert.equal(plain.game.s.maxTurns, TURNS);
  assert.deepEqual(withLaws(['wide'], []).game.mouth(1), [MOUTH[0], MOUTH[1] + 1], 'Wide Open');
  assert.deepEqual(withLaws([], ['tiny']).game.mouth(1), [MOUTH[0] + 1, MOUTH[1]], 'Tiny Goal');
  assert.deepEqual(withLaws(['wide'], ['tiny']).game.mouth(1).map((x) => x), [MOUTH[0] + 1, MOUTH[1] + 1], 'the two together are as wide as ever');
  assert.deepEqual(withLaws([], ['bignet']).game.mouth(0), [MOUTH[0], MOUTH[1] + 1], 'Big Net');
  assert.equal(withLaws([], ['short']).game.s.maxTurns, TURNS - 2, 'Short Matches');
  assert.equal(withLaws([], ['five']).game.units.filter((u) => u.team === 1 && !u.keeper).length, 5, 'one more of them');
  const mud = withLaws([], ['mud']).game;
  assert.equal(mud.h.moveCost(MUD[0], 4), 2); assert.equal(mud.h.moveCost(MUD[0] - 1, 4), 1);
  const heavy = withLaws([], ['heavy']).game;
  assert.equal(heavy.h.passRange(0), PASS); heavy.s.turn = 8; assert.equal(heavy.h.passRange(0), PASS - 2);
  const hedge = withLaws([], ['closing']);
  assert.ok(!hedge.game.h.blocked(5, 0)); hedge.game.s.turn = 4; assert.ok(hedge.game.h.blocked(5, 0) && !hedge.game.h.blocked(5, 1));
  const small = withLaws(['smalldoor'], []);
  assert.equal(small.game.h.shotRange(1), TEAMS[0].level.shotRange - 2, 'Small Door keeps their shots close');
  assert.equal(withLaws(['thunder'], []).game.h.shotRange(0), 9, 'Thunder Boots');
  // what a goal is worth
  const ctx = (o) => ({ by: 0, team: 0, c: 12, r: 4, row: 4, dist: 3, header: false, deflected: false, turn: 2, chain: [], lastTouch: 0, ...o });
  assert.equal(withLaws([], []).worth(0, ctx({})).value, 1);
  assert.equal(withLaws(['headers'], []).worth(0, ctx({ header: true })).value, 2, 'Headers Double');
  assert.equal(withLaws(['distance'], []).worth(0, ctx({ c: 5 })).value, 3, 'From Distance');
  const late = withLaws(['late'], []); late.game.s.turn = late.game.s.maxTurns - 2; assert.equal(late.worth(0, ctx({})).value, 2, 'Late Show');
  assert.equal(withLaws(['pinball'], []).worth(0, ctx({ chain: [{ banked: true, turn: 2 }] })).value, 2, 'Pinball');
  const hat = withLaws(['hattrick'], []); hat.game.s.goals[0] = 2; assert.equal(hat.worth(0, ctx({})).value, 3, 'the third is a hat-trick');
  const sore = withLaws([], ['sore']); sore.game.s.score = [2, 0]; assert.equal(sore.worth(1, ctx({ team: 1 })).value, 2, 'Sore Losers');
  sore.game.s.score = [0, 0]; assert.equal(sore.worth(1, ctx({ team: 1 })).value, 1);
  const kick = withLaws(['kickoff'], []); kick.game.s.kicked = 0; assert.equal(kick.worth(0, ctx({})).value, 2, 'Kick-off Special');
  assert.equal(withLaws(['woodwork'], []).game.h.woodwork(0).value, 1); assert.equal(withLaws([], []).game.h.woodwork(0).value, 0);
  // the giant keeper covers more, and Thunder Boots take it back
  assert.equal(withLaws([], ['giant']).game.h.keeperCover(1, 3, 2), 3);
  assert.equal(withLaws(['thunder'], ['giant']).game.h.keeperCover(1, 3, 2), 2);
  // Fog: we can't see what they'll do deep in their half away from the ball
  const fog = withLaws([], ['fog']);
  const far = fog.game.units.find((u) => u.team === 1 && !u.keeper && u.c >= COLS / 2 && Math.max(Math.abs(u.c - 7), Math.abs(u.r - 4)) > 3);
  if (far) assert.ok(!fog.visible(far.id));
  assert.ok(fog.visible(0));
}

{
  // every law has a card, an icon, a line of text; links point both ways
  for (const l of [...OURS, ...THEIRS]) { assert.ok(l.name && l.text && /^[a-p]$/.test(l.icon)); assert.equal(lawOf(l.id), l); }
  assert.equal(OURS.length, 16); assert.equal(THEIRS.length, 14);
  assert.ok(isOurs('redpen') && !isOurs('fog'));
  for (const [a, b] of LINKS) { assert.ok(linksOf(a).length && linksOf(b).length); assert.ok(ALL_LAWS.includes(a) && ALL_LAWS.includes(b)); }
}

{
  // the save: round trip, junk ignored, laws discovered, a finished run banked
  assert.equal(SAVE_KEY, 'rulebook-fc-v1');
  const s = newSave();
  assert.deepEqual(parseSave(null), s); assert.deepEqual(parseSave('nope'), s); assert.deepEqual(parseSave('{"v":2}'), s);
  const r = new Run(8); r.ready(); finish(r, 3, 0);
  discover(s, r); assert.ok(s.seen.includes(r.order[0])); assert.ok(r.offer.every((id) => s.seen.includes(id)));
  r.stats.best = 2; r.phase = 'lost'; bank(s, r);
  assert.equal(s.stats.runs, 1); assert.equal(s.best.match, 1); assert.equal(s.best.goal, 2); assert.equal(s.stats.seasons, 0);
  s.settings.music = false;
  const back = parseSave(serialise(s));
  assert.deepEqual({ ...back, seen: back.seen.slice().sort() }, { ...s, seen: s.seen.slice().sort() });
  const junk = parseSave(JSON.stringify({ v: 1, best: { match: -4, goal: 'x' }, seen: ['fog', 'zzz'], settings: { sound: false } }));
  assert.equal(junk.best.match, 0); assert.deepEqual(junk.seen, ['fog']); assert.equal(junk.settings.sound, false); assert.equal(junk.settings.music, true);
}

{
  // a whole match played through the Run: the same seed gives the same match
  const play = () => { const r = new Run(77); r.ready(); for (let k = 0; k < 40 && r.phase === 'play'; k++) r.endTurn(); return r; };
  const a = play(), b = play();
  assert.notEqual(a.phase, 'play'); assert.deepEqual(a.results, b.results); assert.deepEqual(a.game.s.score, b.game.s.score);
  assert.ok(a.stats.turns >= TURNS - 2);
}

console.log('Rulebook FC: the league, the season, Red Pen, the laws as hooks, Fog and the save all check out');

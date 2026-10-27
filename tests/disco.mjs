// Dust Disco engine checks: the songs compose, the charts are playable and replay exactly, and the judge scores fairly.
import assert from 'node:assert/strict';
import { SONGS, DIFFS, DIFF, WINDOW, STRAY, POINTS, DUST_UP, compose, chart, pitch, DiscoGame, grade, multiplier, readProfile, record, unlocked, cleared, totalStars, freshProfile, SAVE_KEY } from '../.checks/disco-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// ---- songs and composing
ok(SONGS.length === 12 && new Set(SONGS.map((s) => s.id)).size === 12, 'twelve songs with their own ids');
for (const s of SONGS) {
  for (const name of s.form) ok(s.sections[name], `${s.id}: section ${name} exists`);
  for (const [name, sec] of Object.entries(s.sections)) {
    const bar = s.meter * s.res;
    for (const m of sec.mel) {
      const t = m.trim().split(/\s+/);
      ok(t.length % bar === 0, `${s.id}.${name}: a melody phrase fills whole bars (${t.length} steps, ${bar} a bar)`);
      ok(t.every((x) => x === '-' || x === '.' || /^-?\d+$/.test(x)), `${s.id}.${name}: melody tokens`);
    }
    for (const k of ['k', 's', 'h']) ok(sec.drums[k].length === s.meter * 4, `${s.id}.${name}: ${k} drums are one bar of 16ths`);
    ok(sec.bass.length === s.meter * 2, `${s.id}.${name}: bass is one bar of 8ths`);
  }
  const a = compose(s), b = compose(s);
  ok(a === b, 'a song is composed once and cached');
  ok(a.events.length > 300 && a.end > 60 && a.end < 150, `${s.id}: a full song of ${a.end.toFixed(0)} s`);
  ok(a.events.every((e, i) => i === 0 || e.t >= a.events[i - 1].t), `${s.id}: music events in time order`);
  ok(a.events.every((e) => e.dur > 0 && e.midi > 20 && e.midi < 110), `${s.id}: every event has a length and a sane pitch`);
  ok(a.events.some((e) => e.inst === 'lead') && a.events.some((e) => e.inst === 'bell') && a.events.some((e) => e.inst === 'clap'), `${s.id}: lead, chorus bells and claps`);
}
ok(pitch(SONGS[0], 0) === 72 && pitch(SONGS[0], 7) === 84 && pitch(SONGS[0], -1) === 71, 'scale degrees climb octaves and go below the tonic');

// ---- charts
for (const s of SONGS) {
  const density = [];
  for (const d of DIFFS) {
    const c = chart(s, d), n = c.notes, D = DIFF[d];
    ok(chart(s, d) === c, 'charts are cached');
    ok(n.length > 50, `${s.id}/${d}: ${n.length} notes`);
    ok(n.every((x, i) => x.id === i && x.lane >= 0 && x.lane <= 3 && x.t >= 0 && x.len >= 0), `${s.id}/${d}: notes are well formed`);
    ok(n.every((x, i) => i === 0 || x.t >= n[i - 1].t), `${s.id}/${d}: notes in time order`);
    ok(n.every((x) => x.t + x.len < c.end), `${s.id}/${d}: the song outlasts its last note`);
    // never two notes in a lane closer than the lane gap, and never a note inside a hold in its own lane
    for (let l = 0; l < 4; l++) {
      const lane = n.filter((x) => x.lane === l);
      ok(lane.every((x, i) => i === 0 || x.t - (lane[i - 1].t + lane[i - 1].len) >= D.laneGap - 1e-6), `${s.id}/${d}: lane ${l} is never crowded`);
    }
    // chords are pairs, everything else is spaced out by the difficulty's gap
    const times = [...new Set(n.map((x) => x.t.toFixed(6)))].map(Number);
    ok(times.every((t) => n.filter((x) => Math.abs(x.t - t) < 1e-6).length <= 2), `${s.id}/${d}: at most two notes at once`);
    ok(n.filter((x) => x.chord).length % 2 === 0, `${s.id}/${d}: chord notes come in pairs`);
    const gap = Math.min(...times.slice(1).map((t, i) => t - times[i]));
    ok(gap >= Math.min(D.gap, 0.5 * c.spb) * 0.8, `${s.id}/${d}: closest notes ${gap.toFixed(3)} s apart`);
    if (d === 'easy') ok(n.every((x) => !x.chord), `${s.id}: easy has no chords`);
    if (!D.overlap) ok(n.every((x) => !x.len || !n.some((y) => y !== x && y.t > x.t + 1e-6 && y.t < x.t + x.len)), `${s.id}/${d}: nothing to press while holding`);
    ok([0, 1, 2, 3].every((l) => n.filter((x) => x.lane === l).length >= n.length * 0.1), `${s.id}/${d}: every lane gets used`);
    density.push(n.length / c.end);
  }
  ok(density[0] < density[1] && density[1] < density[2], `${s.id}: easy < normal < hard (${density.map((x) => x.toFixed(2)).join(' < ')} a second)`);
  ok(density[0] <= 1.4 && density[2] >= 2.8, `${s.id}: easy stays gentle and hard is busy`);
}

// ---- judging
const first = (g, lane) => g.chart.notes.find((n) => n.lane === lane && !n.len && !n.chord);
{
  const g = new DiscoGame('burrow', 'normal'), n = first(g, g.chart.notes[0].lane);
  g.tick(n.t - 0.5); g.press(n.lane, n.t + 0.02);
  ok(g.counts.perfect === 1 && g.combo === 1 && g.score === POINTS.perfect, 'a press 20 ms late is perfect');
}
for (const [off, want] of [[0.06, 'great'], [-0.07, 'great'], [0.12, 'good'], [-0.13, 'good'], [-0.17, 'miss']]) {
  const g = new DiscoGame('burrow', 'normal'), n = g.chart.notes.find((x) => !x.len && !x.chord);
  ok(n === g.chart.notes[0], 'the opening note is a plain tap');
  g.press(n.lane, n.t + off);
  ok(g.counts[want] === 1, `a press ${Math.round(off * 1000)} ms off is ${want}`);
}
{
  const g = new DiscoGame('burrow', 'normal'), n = g.chart.notes[0];
  g.press(n.lane, n.t - 1);
  ok(g.counts.stray === 1 && g.groove < 50 && g.counts.miss === 0, 'a press with nothing near is a stray and costs a little groove');
  g.tick(n.t + WINDOW.good + 0.01);
  ok(g.notes[0].judge === 'miss' && g.combo === 0, 'a note let past is missed');
  g.press(n.lane, n.t + WINDOW.good + 0.02);
  ok(g.counts.miss === 1, 'pressing after the miss does not judge the note twice');
}
{
  // holds: keep it down to the end, or let go early and drop it
  const g = new DiscoGame('pond', 'normal', { noFail: true }), i = g.chart.notes.findIndex((n) => n.len > 0.5), n = g.chart.notes[i];
  g.tick(n.t - 0.3); g.press(n.lane, n.t); ok(g.holding(i), 'pressing a hold starts holding');
  g.tick(n.t + n.len + 0.01); ok(g.counts.hold === 1 && !g.holding(i), 'held to the end pays the tail');
  const h = new DiscoGame('pond', 'normal', { noFail: true });
  h.tick(n.t - 0.3); h.press(n.lane, n.t); const drops = h.counts.drop; h.release(n.lane, n.t + n.len * 0.4);
  ok(h.counts.drop === drops + 1 && h.combo === 0, 'letting go halfway drops the hold and the combo');
  const k = new DiscoGame('pond', 'normal', { noFail: true });
  k.tick(n.t - 0.3); k.press(n.lane, n.t); k.release(n.lane, n.t + n.len - 0.05);
  ok(k.counts.hold === 1, 'letting go a hair before the end still counts');
}
ok(multiplier(0) === 1 && multiplier(19) === 1 && multiplier(20) === 2 && multiplier(60) === 4 && multiplier(500) === 4, 'combo multiplier climbs to 4');
ok(grade(100) === 'S' && grade(95) === 'S' && grade(90) === 'A' && grade(80) === 'B' && grade(70) === 'C' && grade(10) === 'D', 'grades');

// a perfect run: every note on time, every hold to the end, Dust Up whenever it is ready
const play = (id, diff, opts = {}) => {
  const g = new DiscoGame(id, diff, opts), timeline = [];
  for (const n of g.chart.notes) { timeline.push([n.t, 'p', n.lane]); if (n.len) timeline.push([n.t + n.len + 0.01, 'r', n.lane]); }
  timeline.sort((a, b) => a[0] - b[0] || (a[1] === 'r' ? -1 : 1));
  for (const [t, kind, lane] of timeline) { if (opts.dust) g.dust(t); kind === 'p' ? g.press(lane, t) : g.release(lane, t); }
  g.tick(g.chart.end + 0.1);
  return g;
};
{
  const g = play('summit', 'hard'), r = g.result();
  ok(r.cleared && r.grade === 'S' && r.fullCombo && r.allPerfect && r.accuracy === 100 && r.stars === 3, 'a perfect run is an all-perfect S');
  ok(r.maxCombo === g.chart.notes.length, 'the combo counts every note');
  const d = play('summit', 'hard', { dust: true });
  ok(d.events.some((e) => e.kind === 'dustup') && d.result().score > r.score * 1.2, 'Dust Up doubles points while it lasts');
  ok(d.events.filter((e) => e.kind === 'dustup').every((e) => e.until > e.t), 'Dust Up runs for a while');
  const replay = play('summit', 'hard', { dust: true });
  ok(replay.result().score === d.result().score, 'a run replays to the same score');
}
{
  const g = new DiscoGame('hall', 'normal');
  ok(!g.dust(0), 'Dust Up needs sparkle first');
  g.sparkle = 100; g.tick(1); ok(g.dust(1) && g.dustUp && g.sparkle === 0, 'a full meter starts Dust Up and empties');
  ok(Math.abs(g.dustUntil - 1 - DUST_UP.beats * g.chart.spb) < 1e-9, 'a full meter lasts 16 beats');
  g.tick(g.dustUntil + 0.01); ok(!g.dustUp && g.events.some((e) => e.kind === 'dustdown'), 'and then it ends');
}
{
  // doing nothing runs the groove out; never fail lets the song play through
  const g = new DiscoGame('hall', 'hard'); for (let t = 0; t < g.chart.end + 1 && g.state === 'play'; t += 0.05) g.tick(t);
  ok(g.state === 'fail' && g.result().stars === 0 && !g.result().cleared, 'standing still fails');
  const n = new DiscoGame('hall', 'hard', { noFail: true }); for (let t = 0; t < n.chart.end + 1; t += 0.05) n.tick(t);
  ok(n.state === 'clear' && n.result().grade === 'D' && n.counts.miss === n.chart.notes.length, 'never fail plays to the end');
  // mashing every lane all the time fails too
  const m = new DiscoGame('market', 'normal');
  for (let t = 0; t < m.chart.end && m.state === 'play'; t += 0.03) for (let l = 0; l < 4; l++) { m.press(l, t); m.release(l, t + 0.01); }
  ok(m.state === 'fail', 'mashing fails');
}

// ---- saving
{
  const p = freshProfile();
  ok(unlocked(p, 0) && !unlocked(p, 1), 'only the first song is open at the start');
  const r = play('burrow', 'easy').result();
  const news = record(p, r);
  ok(cleared(p, 'burrow') && unlocked(p, 1) && !unlocked(p, 2), 'clearing a song opens the next');
  ok(news.includes('NEW SONG: HAY LOFT HOP') && news.includes('FULL COMBO') && news.includes('ALL PERFECT'), 'the news says so');
  ok(totalStars(p) === 3, 'three stars for an S');
  const again = record(p, r); ok(!again.includes('NEW BEST') && p.best['burrow:easy'].plays === 2, 'the same score is not a new best');
  const fail = new DiscoGame('hayloft', 'hard'); for (let t = 0; t < 60 && fail.state === 'play'; t += 0.1) fail.tick(t);
  record(p, fail.result()); ok(p.best['hayloft:hard'].stars === 0 && !cleared(p, 'hayloft'), 'a failed song is played but not cleared');
  p.speed = 7; p.offset = -30; p.noFail = true;
  const back = readProfile(JSON.stringify(p));
  ok(JSON.stringify(back) === JSON.stringify(p), 'a save reads back the same');
  ok(JSON.stringify(readProfile('{nope')) === JSON.stringify(freshProfile()), 'a broken save starts afresh');
  const odd = readProfile(JSON.stringify({ speed: 99, offset: 9999, best: { 'zzz:easy': { score: 1 }, 'burrow:extreme': { score: 1 } }, diff: 'wild' }));
  ok(odd.speed === 5 && odd.offset === 0 && Object.keys(odd.best).length === 0 && odd.diff === 'easy', 'nonsense in a save is ignored');
  ok(SAVE_KEY === 'dust-disco-v1', 'versioned save key');
}
ok(STRAY > WINDOW.good, 'the stray window reaches past the good window');

console.log(`Dust Disco: ${checks} engine checks passed.`);

// Woodland Band engine checks: the cast and keys, notes snapping into the scale (so no wrong notes), echo matching
// note for note, every rule scoring (mood, fix and limit), changes counted for the second star, share codes
// round-tripping (and bad codes refused), the clearings and unlocking, and saves (fresh, kept, and corrupt).
import assert from 'node:assert/strict';
import {
  MUSICIANS, ORDER, KEYS, SCALES, SAVE_KEY, R, noteMidi, snapMidi, pitchFor, pitchName, degreeSemis, setCell, addRow, removeRow, shiftRow,
  changes, check, describe, echoRow, judge, starBits, starCount, encode, decode, freshSave, readSave, recordSolve, cloneSong, solvedSong, rowText, emptyRow, onBeat,
} from '../.checks/band-game.js';
import { REQUESTS, REQ_IDS, CLEARINGS, reqOpen, clearingOpen, nextRequest, totalStars, jamOpen, jamCast, jamKeys, isFinale } from '../.checks/band-levels.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const song = (rows, o = {}) => ({ steps: 16, bpm: 100, swing: 0, key: 1, rows, ...o });

// ---- the cast and keys
ok(ORDER.length === 8 && ORDER.every((m) => MUSICIANS[m] && MUSICIANS[m].span >= 3), 'eight musicians, each with a range');
ok(SAVE_KEY === 'woodland-band-v1', 'the save key');
ok(KEYS.length === 5 && CLEARINGS.every((c, i) => c.key === i), 'a key for each clearing');

// ---- the scale: every pitch index is a note of the key, and any MIDI note snaps into it
for (let k = 0; k < KEYS.length; k++) {
  const K = KEYS[k], inKey = (m) => SCALES[K.scale].includes((((m - K.root) % 12) + 12) % 12);
  for (const m of ['frog', 'mole', 'owl', 'enzo']) for (let p = 0; p < MUSICIANS[m].span; p++) ok(inKey(noteMidi(k, m, p)[0]), `${K.name}: ${m} pitch ${p} is in key`);
  for (let p = 0; p < 6; p++) ok(noteMidi(k, 'dora', p).length === 3, `${K.name}: Dora strums a triad`);
  for (let midi = 40; midi < 90; midi++) { const s = snapMidi(midi, k); ok(inKey(s) && Math.abs(s - midi) <= 2, `${K.name}: ${midi} snaps to ${s}, in key and near`); }
  for (const m of ['owl', 'enzo', 'frog']) for (let p = 0; p < MUSICIANS[m].span; p++) assert.equal(pitchFor(k, m, noteMidi(k, m, p)[0]), p, 'pitchFor inverts noteMidi');
}
ok(snapMidi(61, 0) === 60 && snapMidi(66, 0) === 67 && snapMidi(65, 0) === 64 && snapMidi(68, 0) === 67, 'C pentatonic snaps C♯→C, F♯→G, F→E, A♭→G (ties go down)');
ok(degreeSemis([0, 2, 4, 7, 9], 5) === 12 && degreeSemis([0, 2, 4, 7, 9], 7) === 16, 'scale steps wrap into the next octave');
ok(noteMidi(0, 'hedgehog', 1).length === 0 && pitchName(0, 'hedgehog', 1) === 'snare' && pitchName(0, 'woodpecker', 2) === 'high', 'drums and blocks have no pitch, just a name');
ok(pitchName(1, 'owl', 0) === 'F' && pitchName(1, 'dora', 3) === 'IV' && pitchName(4, 'owl', 0) === 'A', 'note and chord names');
ok(JSON.stringify(noteMidi(1, 'dora', 0)) === JSON.stringify([65, 69, 72]), 'F major I chord is F A C');
ok(noteMidi(4, 'frog', 0)[0] === 33 && noteMidi(4, 'enzo', 0)[0] === 69, 'the frog plays two octaves down, Enzo one up');

// ---- editing
{
  const s = song([R('owl', '0...............')]);
  ok(setCell(s, 'owl', 2, 4) && s.rows[0].n[2] === 4, 'a cell is set');
  ok(!setCell(s, 'owl', 2, 4), 'setting the same value is no change');
  setCell(s, 'owl', 3, 99); ok(s.rows[0].n[3] === 9, 'pitches clamp into the range');
  ok(!setCell(s, 'frog', 0, 1), 'no row, no cell');
  ok(addRow(s, 'hedgehog') && s.rows[0].m === 'hedgehog', 'a new musician sits in stage order');
  ok(!addRow(s, 'hedgehog'), 'one row per musician');
  ok(!addRow(s, 'frog', 2), 'a full stage refuses more');
  ok(removeRow(s, 'hedgehog') && s.rows.length === 1, 'a musician leaves');
  shiftRow(s, 'owl', 1); ok(rowText(s.rows[0]) === '.0.49...........', 'a row shifts along, wrapping');
  shiftRow(s, 'owl', -2); ok(rowText(s.rows[0]) === '.49............0', 'and back round the end');
  ok(emptyRow('frog', 8).n.length === 8 && onBeat(16, 4) && !onBeat(16, 2) && onBeat(8, 2), 'empty rows and the big beats');
}
// ---- changes
{
  const a = song([R('owl', '0.2.............'), R('frog', '0...............')]);
  const b = cloneSong(a); ok(changes(a, b) === 0, 'no changes');
  b.rows[0].n[0] = 1; b.rows[0].n[4] = 3; ok(changes(a, b) === 2, 'two cells differ');
  b.bpm = 140; b.key = 3; ok(changes(a, b) === 2, 'tempo and key are free');
  addRow(b, 'enzo'); b.rows.find((r) => r.m === 'enzo').n[1] = 2; ok(changes(a, b) === 4, 'a new musician is one, plus their notes');
  removeRow(b, 'frog'); ok(changes(a, b) === 5, 'taking one off is one');
}
// ---- echo matching
{
  const t = R('owl', '0.2.4...........');
  ok(echoRow(song([R('owl', '0.2.4...........')]), t).ok, 'an exact echo');
  const near = echoRow(song([R('owl', '0.2.5...........')]), t);
  ok(!near.ok && near.score > 0.6 && near.score < 1, 'one wrong pitch is close but not it');
  const shifted = echoRow(song([R('owl', '.0.2.4..........')]), t);
  ok(!shifted.ok && shifted.score < near.score, 'a step late is further off');
  ok(!echoRow(song([R('owl', '0.2.4.......4...')]), t).ok, 'an extra note spoils it');
  ok(echoRow(song([R('frog', '0.2.4...........')]), t).score === 0, 'the wrong musician scores nothing');
}
// ---- rules
{
  const s = song([R('hedgehog', '0...1...0...1...'), R('frog', '0.......0.......'), R('owl', '..2...4...2...4.')], { bpm: 90 });
  const v = (r) => check(s, r);
  ok(v({ k: 'tempo', min: 60, max: 100 }).ok && !v({ k: 'tempo', min: 120, max: 180 }).ok, 'tempo');
  ok(v({ k: 'tempo', min: 120, max: 180 }).score < v({ k: 'tempo', min: 100, max: 180 }).score, 'tempo closeness grows as it nears');
  ok(v({ k: 'density', min: 0, max: 0.75 }).ok && !v({ k: 'density', min: 1, max: 99 }).ok, 'density: 10 notes in 16 steps');
  ok(v({ k: 'sync', min: 0.4, max: 1 }).ok && !v({ k: 'sync', min: 0.5, max: 1 }).ok, 'sync: 4 of 10 between the big beats');
  ok(v({ k: 'band', min: 3, max: 3 }).ok && !v({ k: 'band', min: 4, max: 99 }).ok, 'band size');
  ok(v({ k: 'has', m: ['frog', 'owl'] }).ok && !v({ k: 'has', m: ['enzo'] }).ok && v({ k: 'lacks', m: ['mole'] }).ok, 'has and lacks');
  ok(v({ k: 'range', min: 12, max: 99 }).ok, 'range: the low frog to the owl is wide');
  ok(v({ k: 'pitch', min: 0, max: 62 }).ok && !v({ k: 'pitch', min: 72, max: 999 }).ok, 'pitch: the mean is low with the frog in');
  ok(v({ k: 'with', a: 'frog', b: 'hedgehog', bp: 0 }).ok && !v({ k: 'with', a: 'frog', b: 'hedgehog' }).ok, 'with: on the kicks, but not every drum');
  ok(v({ k: 'apart', a: 'owl', b: 'hedgehog' }).ok && !v({ k: 'apart', a: 'frog', b: 'hedgehog' }).ok, 'apart');
  ok(!v({ k: 'same', a: 'frog', b: 'hedgehog' }).ok, 'same');
  ok(v({ k: 'at', m: 'hedgehog', step: 4, p: 1 }).ok && !v({ k: 'at', m: 'hedgehog', step: 4, p: 0 }).ok, 'at');
  ok(v({ k: 'uses', m: 'hedgehog', p: 1 }).ok && !v({ k: 'uses', m: 'hedgehog', p: 2 }).ok, 'uses');
  ok(!v({ k: 'climb', m: 'owl', min: 3 }).ok && check(song([R('owl', '0.1.4.6.........')]), { k: 'climb', m: 'owl', min: 4 }).ok, 'climb');
  ok(v({ k: 'ends', m: 'owl', p: 4 }).ok && !v({ k: 'ends', m: 'owl', p: 2 }).ok, 'ends');
  ok(v({ k: 'count', m: 'owl', min: 4, max: 4 }).ok, 'count');
  for (const id of REQ_IDS) for (const r of [...REQUESTS[id].rules, REQUESTS[id].flourish.rule]) { const d = describe(r, REQUESTS[id].start.key); ok(typeof d === 'string' && d.length > 4 && !/undefined|NaN/.test(d), `${id}: “${d}”`); }
}
// ---- requests, stars
ok(REQ_IDS.length === 30 && CLEARINGS.length === 5 && CLEARINGS.every((c) => c.requests.length === 6), 'thirty requests in five clearings');
ok(['echo', 'mood', 'fix', 'limit'].every((k) => REQ_IDS.some((id) => REQUESTS[id].kind === k)), 'every kind of request');
for (const id of REQ_IDS) {
  const q = REQUESTS[id], j = judge(solvedSong(q), q);
  ok(j.solved && j.flourish && changes(q.start, solvedSong(q)) <= q.par, `${id}: the designed solution earns three stars`);
  ok(!judge(q.start, q).solved && judge(q.start, q).close < 1, `${id}: not solved at the start`);
  if (q.maxRows) { const s = cloneSong(solvedSong(q)); for (const m of q.cast) addRow(s, m, 99); ok(!judge(s, q).solved || s.rows.length <= q.maxRows, `${id}: too many musicians breaks the limit`); }
}
ok(starBits(true, 3, 4, false) === 3 && starBits(true, 5, 4, true) === 5 && starBits(false, 0, 9, true) === 0 && starCount(7) === 3, 'star bits');

// ---- share codes
for (const id of REQ_IDS) { const s = solvedSong(REQUESTS[id]), c = encode(s), d = decode(c); assert.deepEqual(d, s, `${id}: the song round-trips through ${c}`); ok(c.length < 90, `${id}: a short code`); }
{
  let x = 99; const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 200; k++) {
    const steps = r() < 0.3 ? 8 : 16, rows = ORDER.filter(() => r() < 0.5).map((m) => ({ m, n: Array.from({ length: steps }, () => (r() < 0.4 ? Math.floor(r() * MUSICIANS[m].span) : -1)) }));
    const s = { steps, bpm: 60 + Math.floor(r() * 121), swing: Math.floor(r() * 61) / 100, key: Math.floor(r() * 5), rows };
    assert.deepEqual(decode(encode(s)), s, 'random songs round-trip');
  }
  n++;
  const c = encode(solvedSong(REQUESTS['5-6']));
  ok(decode('  ' + c + '\n') !== null, 'spaces around a pasted code are fine');
  for (const bad of ['', 'hello', 'WB', 'WBAAAA', c.slice(0, -2), c.slice(0, 10) + (c[10] === 'A' ? 'B' : 'A') + c.slice(11), c + 'AAAA', 'XX' + c.slice(2), c.replace(/.$/, '!')]) ok(decode(bad) === null, `a bad code is refused: ${JSON.stringify(bad).slice(0, 30)}`);
}
// ---- progress
{
  const s = freshSave();
  ok(reqOpen(s, '1-1') && !reqOpen(s, '1-2') && clearingOpen(s, 0) && !clearingOpen(s, 1), 'only the first request is open');
  ok(nextRequest(s) === '1-1' && !jamOpen(s) && jamCast(s).length === 4 && jamKeys(s).length === 1, 'a fresh start');
  for (const id of REQ_IDS.slice(0, 6)) recordSolve(s, id, 1, 3, solvedSong(REQUESTS[id]));
  ok(clearingOpen(s, 1) && reqOpen(s, '2-1') && !reqOpen(s, '2-2') && jamOpen(s), 'Mossy Hollow done opens the Riverbank and the jam');
  ok(jamCast(s).includes('owl') && jamKeys(s).length === 2, 'the jam gains the owl and a key');
  ok(totalStars(s) === 6, 'six stars');
  const r = recordSolve(s, '1-1', 6, 9, solvedSong(REQUESTS['1-1']));
  ok(!r.first && r.newStars === 2 && s.reqs['1-1'].stars === 7 && s.reqs['1-1'].best === 3, 'stars merge, best changes kept');
  ok(isFinale('5-6') && !isFinale('5-5'), 'the finale');
}
// ---- saves
{
  const s = freshSave();
  recordSolve(s, '1-1', 7, 6, solvedSong(REQUESTS['1-1']));
  s.slots[1] = { name: 'Hoedown', code: encode(solvedSong(REQUESTS['1-6'])) }; s.jam = encode(solvedSong(REQUESTS['2-1'])); s.ended = true; s.settings.music = false;
  const back = readSave(JSON.stringify(s), (id) => id in REQUESTS);
  assert.deepEqual(back, s, 'a save round-trips'); n++;
  for (const raw of [null, '', 'nope', '{', '[]', '42', 'null', '{"v":2}', JSON.stringify({ v: 1, reqs: 5, slots: 'x', jam: 7, settings: [] })]) {
    const r = readSave(raw); ok(r.v === 1 && Object.keys(r.reqs).length === 0 && r.slots.length === 4 && r.slots.every((x) => x === null) && r.jam === '' && r.settings.sound, `corrupt save ${String(raw).slice(0, 16)} gives a fresh one`);
  }
  const odd = readSave(JSON.stringify({ v: 1, reqs: { '1-1': { done: true, stars: 99, best: -4, code: 'junk' }, '9-9': { done: true }, '1-2': { done: 'yes' }, '1-3': null }, slots: [{ name: 5, code: 'WBbad' }, { code: s.slots[1].code }, 'x'], jam: 'WB', ended: 'yes', tutorial: 1, settings: { sound: 'no', music: false } }), (id) => id in REQUESTS);
  ok(odd.reqs['1-1'].stars === 1 && odd.reqs['1-1'].best === null && odd.reqs['1-1'].code === '', 'odd fields in a solve are dropped');
  ok(!odd.reqs['9-9'] && !odd.reqs['1-2'] && !odd.reqs['1-3'], 'unknown or half-done requests are ignored');
  ok(odd.slots[0] === null && odd.slots[1].name === 'Song 2' && odd.slots[2] === null, 'bad slots are dropped, good ones named');
  ok(odd.jam === '' && odd.ended === false && odd.tutorial === false && odd.settings.sound === true && odd.settings.music === false, 'odd flags are ignored');
}
console.log(`band: ${n} checks passed`);

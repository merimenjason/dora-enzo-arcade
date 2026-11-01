// Woodland Band: the rules. A song is a grid of beat columns (8 or 16 steps) by musician rows, one row per musician;
// each cell is off (-1) or a pitch index inside the musician's range, counted in steps of the song's scale, so every
// note is always in key. Requests are checked here: echo (the audience's tune, note for note), mood and fix rules
// (tempo, how busy, how high, off-beat bounce, who plays with whom), and the three-musician limit. Also the stars,
// unlocking, share codes and the save. Deterministic and DOM-free: no Math.random and no clock.

export const SAVE_KEY = 'woodland-band-v1';
export type MusicianId = 'hedgehog' | 'woodpecker' | 'frog' | 'mole' | 'owl' | 'enzo' | 'dora' | 'birds';
export type Kind = 'drum' | 'block' | 'bass' | 'lead' | 'chord';
export type Musician = { id: MusicianId; name: string; plays: string; kind: Kind; span: number; octave: number; def: number; blurb: string };
/** The cast, in the order they sit on the stage (drums at the top, the leads, then the chords). */
export const MUSICIANS: Record<MusicianId, Musician> = {
  hedgehog: { id: 'hedgehog', name: 'Hedgehog', plays: 'drums', kind: 'drum', span: 3, octave: 0, def: 0, blurb: 'kick at the bottom, snare above, the tishy hat on top' },
  woodpecker: { id: 'woodpecker', name: 'Woodpecker', plays: 'wood blocks', kind: 'block', span: 3, octave: 0, def: 1, blurb: 'three hollow blocks: low, middle and high' },
  frog: { id: 'frog', name: 'Frog', plays: 'double bass', kind: 'bass', span: 8, octave: -2, def: 0, blurb: 'deep plucked bass notes' },
  mole: { id: 'mole', name: 'Mole', plays: 'tuba', kind: 'bass', span: 6, octave: -1, def: 0, blurb: 'big round oompahs' },
  owl: { id: 'owl', name: 'Owl', plays: 'flute', kind: 'lead', span: 10, octave: 0, def: 0, blurb: 'the tune, breathy and sweet' },
  enzo: { id: 'enzo', name: 'Enzo', plays: 'glockenspiel', kind: 'lead', span: 10, octave: 1, def: 0, blurb: 'bright sparkles way up high' },
  dora: { id: 'dora', name: 'Dora', plays: 'ukulele', kind: 'chord', span: 6, octave: 0, def: 0, blurb: 'strummed chords' },
  birds: { id: 'birds', name: 'Bird choir', plays: 'chords', kind: 'chord', span: 6, octave: 0, def: 0, blurb: 'three birds singing a chord together' },
};
export const ORDER: MusicianId[] = ['hedgehog', 'woodpecker', 'frog', 'mole', 'owl', 'enzo', 'dora', 'birds'];
export const DRUMS = ['kick', 'snare', 'hat'], BLOCKS = ['low', 'middle', 'high'];
/** Chord names for a chord musician's pitch index: the triads on the scale's first six steps. */
export const CHORD_NAMES = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];

export type ScaleId = 'pentatonic' | 'major' | 'minor' | 'dorian';
export const SCALES: Record<ScaleId, number[]> = {
  pentatonic: [0, 2, 4, 7, 9], major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
};
/** The seven-note scale chords are built from (a pentatonic tune sits on its major scale). */
const PARENT: Record<ScaleId, number[]> = { pentatonic: SCALES.major, major: SCALES.major, minor: SCALES.minor, dorian: SCALES.dorian };
export type Key = { id: string; name: string; root: number; scale: ScaleId };
/** The keys: one for each clearing, all of them open in the jam. */
export const KEYS: Key[] = [
  { id: 'c-pent', name: 'C pentatonic', root: 60, scale: 'pentatonic' },
  { id: 'f-major', name: 'F major', root: 65, scale: 'major' },
  { id: 'd-dorian', name: 'D dorian', root: 62, scale: 'dorian' },
  { id: 'eb-major', name: 'E♭ major', root: 63, scale: 'major' },
  { id: 'a-minor', name: 'A minor', root: 57, scale: 'minor' },
];
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const TEMPO_MIN = 60, TEMPO_MAX = 180, MAX_ROWS = 6;

export type Row = { m: MusicianId; n: number[] };
export type Song = { steps: number; bpm: number; swing: number; key: number; rows: Row[] };

// ---------------------------------------------------------------- notes and the scale
/** Semitones above the root for a scale step (wraps up into the next octave). */
export function degreeSemis(scale: number[], d: number): number { const L = scale.length; return scale[((d % L) + L) % L] + 12 * Math.floor(d / L); }
/** The MIDI notes a musician sounds for a pitch index in a key: one note, a triad for a chord, or nothing for drums. */
export function noteMidi(key: number, m: MusicianId, p: number): number[] {
  const K = KEYS[key] ?? KEYS[0], M = MUSICIANS[m];
  if (M.kind === 'drum' || M.kind === 'block') return [];
  const base = K.root + 12 * M.octave;
  if (M.kind === 'chord') { const sc = PARENT[K.scale]; return [0, 2, 4].map((k) => base + degreeSemis(sc, p + k)); }
  return [base + degreeSemis(SCALES[K.scale], p)];
}
/** The nearest note of the key to any MIDI note (a tie goes down). Everything played is in key. */
export function snapMidi(midi: number, key: number): number {
  const K = KEYS[key] ?? KEYS[0], sc = SCALES[K.scale];
  let best = midi, bd = 99;
  for (let o = -1; o <= 1; o++) for (const s of sc) {
    const c = K.root + 12 * (Math.floor((midi - K.root) / 12) + o) + s, d = Math.abs(c - midi);
    if (d < bd || (d === bd && c < best)) { bd = d; best = c; }
  }
  return best;
}
/** The pitch index a musician would use for a MIDI note: snapped into the key, then clamped into its range. */
export function pitchFor(key: number, m: MusicianId, midi: number): number {
  const M = MUSICIANS[m]; if (M.kind === 'drum' || M.kind === 'block' || M.kind === 'chord') return clamp(Math.round(midi), 0, M.span - 1);
  const s = snapMidi(midi, key);
  let best = 0, bd = 999;
  for (let p = 0; p < M.span; p++) { const d = Math.abs(noteMidi(key, m, p)[0] - s); if (d < bd) { bd = d; best = p; } }
  return best;
}
/** A friendly name for a cell: "kick", "high", "IV", or a note name like "G". */
export function pitchName(key: number, m: MusicianId, p: number): string {
  const M = MUSICIANS[m];
  if (M.kind === 'drum') return DRUMS[p] ?? '';
  if (M.kind === 'block') return BLOCKS[p] ?? '';
  if (M.kind === 'chord') return CHORD_NAMES[p] ?? '';
  const n = noteMidi(key, m, p)[0];
  return NOTE_NAMES[((n % 12) + 12) % 12];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- songs
export function emptyRow(m: MusicianId, steps: number): Row { return { m, n: Array(steps).fill(-1) }; }
export function cloneSong(s: Song): Song { return { ...s, rows: s.rows.map((r) => ({ m: r.m, n: r.n.slice() })) }; }
export function rowOf(s: Song, m: MusicianId): Row | undefined { return s.rows.find((r) => r.m === m); }
/** A row written as text: '.' is off, '0'-'9' then 'a', 'b' are pitch indexes. */
export function R(m: MusicianId, text: string): Row { return { m, n: [...text].map((c) => (c === '.' ? -1 : parseInt(c, 36))) }; }
export function rowText(r: Row): string { return r.n.map((v) => (v < 0 ? '.' : v.toString(36))).join(''); }
export function noteCount(s: Song): number { let n = 0; for (const r of s.rows) for (const v of r.n) if (v >= 0) n++; return n; }
/** Musicians with at least one note. */
export function playing(s: Song): MusicianId[] { return s.rows.filter((r) => r.n.some((v) => v >= 0)).map((r) => r.m); }
/** Sets a cell (clamped into the musician's range). Returns whether anything changed. */
export function setCell(s: Song, m: MusicianId, step: number, p: number): boolean {
  const r = rowOf(s, m); if (!r || step < 0 || step >= s.steps) return false;
  const v = p < 0 ? -1 : clamp(Math.round(p), 0, MUSICIANS[m].span - 1);
  if (r.n[step] === v) return false;
  r.n[step] = v; return true;
}
/** Adds a musician's row in stage order; false if they are already there or the stage is full. */
export function addRow(s: Song, m: MusicianId, max = MAX_ROWS): boolean {
  if (rowOf(s, m) || s.rows.length >= max) return false;
  s.rows.push(emptyRow(m, s.steps)); s.rows.sort((a, b) => ORDER.indexOf(a.m) - ORDER.indexOf(b.m)); return true;
}
export function removeRow(s: Song, m: MusicianId): boolean { const i = s.rows.findIndex((r) => r.m === m); if (i < 0) return false; s.rows.splice(i, 1); return true; }
/** Moves a row's notes along by d steps, wrapping round. */
export function shiftRow(s: Song, m: MusicianId, d: number): boolean {
  const r = rowOf(s, m); if (!r || !r.n.some((v) => v >= 0)) return false;
  const L = r.n.length, o = r.n.slice(); for (let i = 0; i < L; i++) r.n[(((i + d) % L) + L) % L] = o[i]; return true;
}
/**
 * How many changes turn one song into another: each cell that differs is one, a musician added or taken off is one
 * (plus the notes they bring). Tempo, swing and key are free.
 */
export function changes(a: Song, b: Song): number {
  let n = 0;
  for (const m of ORDER) {
    const ra = rowOf(a, m), rb = rowOf(b, m);
    if (ra && rb) { for (let i = 0; i < Math.max(ra.n.length, rb.n.length); i++) if ((ra.n[i] ?? -1) !== (rb.n[i] ?? -1)) n++; }
    else if (rb) n += 1 + rb.n.filter((v) => v >= 0).length;
    else if (ra) n += 1;
  }
  return n;
}
/** Whether a step is on one of the four main beats of the bar. */
export const onBeat = (steps: number, i: number) => i % Math.max(1, steps / 4) === 0;

// ---------------------------------------------------------------- rules
export type Rule =
  | { k: 'tempo'; min: number; max: number }
  | { k: 'density'; min: number; max: number }
  | { k: 'range'; min: number; max: number }
  | { k: 'pitch'; min: number; max: number }
  | { k: 'sync'; min: number; max: number }
  | { k: 'band'; min: number; max: number }
  | { k: 'has'; m: MusicianId[] }
  | { k: 'lacks'; m: MusicianId[] }
  | { k: 'count'; m: MusicianId; min: number; max: number }
  | { k: 'with'; a: MusicianId; b: MusicianId; bp?: number }
  | { k: 'apart'; a: MusicianId; b: MusicianId }
  | { k: 'same'; a: MusicianId; b: MusicianId }
  | { k: 'at'; m: MusicianId; step: number; p?: number }
  | { k: 'uses'; m: MusicianId; p: number }
  | { k: 'climb'; m: MusicianId; min: number }
  | { k: 'ends'; m: MusicianId; p: number };
export type Verdict = { ok: boolean; score: number };

/** Every melodic note (bass and leads) as MIDI, for the range and pitch rules. */
function tune(s: Song): number[] {
  const out: number[] = [];
  for (const r of s.rows) { const k = MUSICIANS[r.m].kind; if (k === 'bass' || k === 'lead') for (const v of r.n) if (v >= 0) out.push(noteMidi(s.key, r.m, v)[0]); }
  return out;
}
/** 1 inside [min, max], falling away outside it over `soft`. */
const band = (v: number, min: number, max: number, soft: number): Verdict => {
  if (v >= min - 1e-9 && v <= max + 1e-9) return { ok: true, score: 1 };
  const d = v < min ? min - v : v - max; return { ok: false, score: clamp(1 - d / soft, 0, 0.95) };
};
const notesOf = (s: Song, m: MusicianId) => (rowOf(s, m)?.n ?? []).map((v, i) => [i, v]).filter(([, v]) => v >= 0);

export function check(s: Song, r: Rule): Verdict {
  switch (r.k) {
    case 'tempo': return band(s.bpm, r.min, r.max, 50);
    case 'density': return band(noteCount(s) / s.steps, r.min, r.max, Math.max(0.6, r.max - r.min));
    case 'range': { const t = tune(s); return t.length ? band(Math.max(...t) - Math.min(...t), r.min, r.max, 10) : { ok: false, score: 0 }; }
    case 'pitch': { const t = tune(s); return t.length ? band(t.reduce((a, b) => a + b, 0) / t.length, r.min, r.max, 14) : { ok: false, score: 0 }; }
    case 'sync': {
      const n = noteCount(s); if (!n) return { ok: false, score: 0 };
      let off = 0; for (const row of s.rows) row.n.forEach((v, i) => { if (v >= 0 && !onBeat(s.steps, i)) off++; });
      return band(off / n, r.min, r.max, 0.4);
    }
    case 'band': return band(playing(s).length, r.min, r.max, 3);
    case 'has': { const p = playing(s), got = r.m.filter((m) => p.includes(m)).length; return { ok: got === r.m.length, score: got / r.m.length }; }
    case 'lacks': { const p = playing(s), bad = r.m.filter((m) => p.includes(m)).length; return { ok: bad === 0, score: 1 - bad / r.m.length }; }
    case 'count': return band(notesOf(s, r.m).length, r.min, r.max, Math.max(3, r.min));
    case 'with': {
      const a = rowOf(s, r.a), b = rowOf(s, r.b); if (!a || !b) return { ok: false, score: 0 };
      const want = b.n.map((v) => v >= 0 && (r.bp === undefined || v === r.bp));
      if (!want.some(Boolean)) return { ok: false, score: 0 };
      let good = 0, all = 0; for (let i = 0; i < s.steps; i++) { if (want[i] || a.n[i] >= 0) { all++; if (want[i] === a.n[i] >= 0) good++; } }
      return { ok: good === all, score: all ? good / all : 0 };
    }
    case 'apart': {
      const a = rowOf(s, r.a), b = rowOf(s, r.b); if (!a || !b || !a.n.some((v) => v >= 0) || !b.n.some((v) => v >= 0)) return { ok: false, score: 0 };
      let clash = 0; for (let i = 0; i < s.steps; i++) if (a.n[i] >= 0 && b.n[i] >= 0) clash++;
      return { ok: clash === 0, score: 1 - clash / s.steps };
    }
    case 'same': {
      const a = rowOf(s, r.a), b = rowOf(s, r.b); if (!a || !b || !b.n.some((v) => v >= 0)) return { ok: false, score: 0 };
      let good = 0, all = 0; for (let i = 0; i < s.steps; i++) { if (a.n[i] >= 0 || b.n[i] >= 0) { all++; if (a.n[i] === b.n[i]) good++; } }
      return { ok: good === all, score: good / all };
    }
    case 'at': { const v = rowOf(s, r.m)?.n[r.step] ?? -1; const ok = v >= 0 && (r.p === undefined || v === r.p); return { ok, score: ok ? 1 : v >= 0 ? 0.5 : 0 }; }
    case 'uses': { const ok = notesOf(s, r.m).some(([, v]) => v === r.p); return { ok, score: ok ? 1 : 0 }; }
    case 'climb': {
      const n = notesOf(s, r.m); if (!n.length) return { ok: false, score: 0 };
      let up = 0; for (let i = 1; i < n.length; i++) if (n[i][1] > n[i - 1][1]) up++;
      const ok = up === n.length - 1 && n.length >= r.min;
      return { ok, score: ok ? 1 : Math.min(0.95, (up + 1) / Math.max(r.min, n.length)) };
    }
    case 'ends': { const n = notesOf(s, r.m); const ok = n.length > 0 && n[n.length - 1][1] === r.p; return { ok, score: ok ? 1 : n.length ? 0.4 : 0 }; }
  }
}
/** A rule in the audience's words, for the request card. */
export function describe(r: Rule, key: number): string {
  const nm = (m: MusicianId) => (m === 'birds' ? 'the bird choir' : m === 'dora' || m === 'enzo' ? MUSICIANS[m].name : 'the ' + MUSICIANS[m].name.toLowerCase());
  const list = (ms: MusicianId[]) => ms.map(nm).join(' and ');
  const pn = (m: MusicianId, p: number) => pitchName(key, m, p);
  const span = (min: number, max: number, unit: string, lo = 0, hi = 999) => (min <= lo ? `at most ${max}${unit}` : max >= hi ? `at least ${min}${unit}` : `${min} to ${max}${unit}`);
  switch (r.k) {
    case 'tempo': return r.min <= TEMPO_MIN ? `slow: tempo ${r.max} or under` : r.max >= TEMPO_MAX ? `quick: tempo ${r.min} or over` : `tempo ${r.min} to ${r.max}`;
    case 'density': return r.min <= 0 ? `calm: at most ${Math.round(r.max * 16) / 16 === r.max ? r.max : r.max.toFixed(1)} notes a step` : r.max >= 99 ? `busy: at least ${r.min} notes a step` : `${r.min} to ${r.max} notes a step`;
    case 'range': return `the tune spans ${span(r.min, r.max, ' semitones', 0, 99)}`;
    case 'pitch': { const a = (v: number) => NOTE_NAMES[((Math.round(v) % 12) + 12) % 12] + (Math.floor(Math.round(v) / 12) - 1); return r.min <= 0 ? `low: the tune stays around ${a(r.max)} or below` : r.max >= 999 ? `high: the tune sits around ${a(r.min)} or above` : `the tune sits between ${a(r.min)} and ${a(r.max)}`; }
    case 'sync': return r.min <= 0 ? `steady: most notes on the big beats` : `bouncy: ${Math.round(r.min * 100)}% of notes between the big beats`;
    case 'band': return r.min === r.max ? `exactly ${r.min} musicians playing` : r.max >= 99 ? `at least ${r.min} musicians playing` : `${r.min} to ${r.max} musicians playing`;
    case 'has': return `${list(r.m)} must play`;
    case 'lacks': return `no ${r.m.map((m) => MUSICIANS[m].name.toLowerCase()).join(' or ')}`;
    case 'count': return `${nm(r.m)}: ${span(r.min, r.max, ' notes', 0, 99)}`;
    case 'with': return `${nm(r.a)} plays exactly with ${nm(r.b)}${r.bp !== undefined ? `’s ${pn(r.b, r.bp)}` : ''}`;
    case 'apart': return `${nm(r.a)} and ${nm(r.b)} take turns, never together`;
    case 'same': return `${nm(r.a)} plays just what ${nm(r.b)} plays`;
    case 'at': return `${nm(r.m)} plays ${r.p !== undefined ? 'a ' + pn(r.m, r.p) + ' ' : ''}on step ${r.step + 1}`;
    case 'uses': return `${nm(r.m)} plays a ${pn(r.m, r.p)}`;
    case 'climb': return `${nm(r.m)} climbs: ${r.min}+ notes, each higher`;
    case 'ends': return `${nm(r.m)}’s last note is ${pn(r.m, r.p)}`;
  }
}

// ---------------------------------------------------------------- requests
export type ReqKind = 'echo' | 'mood' | 'fix' | 'limit';
export type Request = {
  id: string; clearing: number; n: number; name: string; kind: ReqKind;
  /** What the audience asks for, and what they say after. */
  ask: string; after: string;
  start: Song;
  /** Musicians who may join. */
  cast: MusicianId[];
  maxRows?: number;
  /** The tempo knob's range, if it may turn. */
  tempo?: [number, number];
  /** Echo: the rows the audience hums. */
  target?: Row[];
  rules: Rule[];
  flourish: { text: string; rule: Rule };
  /** Changes for the second star. */
  par: number;
  /** A designed solution (rows and tempo) that earns all three stars. */
  sol: { bpm?: number; rows: Row[] };
  /** A first-time tip. */
  tip?: { title: string; text: string };
};
export type Clearing = { id: string; name: string; blurb: string; key: number; requests: string[] };

/** How close one hummed row is to the player's row, cell by cell. */
export function echoRow(s: Song, t: Row): Verdict {
  const r = rowOf(s, t.m); if (!r) return { ok: false, score: 0 };
  let good = 0, all = 0;
  for (let i = 0; i < t.n.length; i++) { const a = t.n[i], b = r.n[i] ?? -1; if (a >= 0 || b >= 0) { all++; if (a === b) good++; else if (a >= 0 && b >= 0) good += 0.4; } }
  const ok = all > 0 && t.n.every((v, i) => v === (r.n[i] ?? -1));
  return { ok, score: ok ? 1 : all ? Math.min(0.95, good / all) : 0 };
}
export type Judgement = { solved: boolean; close: number; parts: Verdict[]; flourish: boolean; limitOk: boolean };
/** Where the song stands against a request: each part (hummed rows first, then rules), closeness and the flourish. */
export function judge(s: Song, q: Request): Judgement {
  const parts: Verdict[] = [];
  for (const t of q.target ?? []) parts.push(echoRow(s, t));
  for (const r of q.rules) parts.push(check(s, r));
  const limitOk = !q.maxRows || s.rows.length <= q.maxRows;
  const solved = parts.every((p) => p.ok) && limitOk;
  const close = solved ? 1 : Math.min(0.97, parts.reduce((a, p) => a + p.score, 0) / Math.max(1, parts.length) * (limitOk ? 1 : 0.8));
  return { solved, close, parts, flourish: check(s, q.flourish.rule).ok, limitOk };
}
export const starBits = (solved: boolean, ch: number, par: number, flourish: boolean) => (solved ? 1 : 0) | (solved && ch <= par ? 2 : 0) | (solved && flourish ? 4 : 0);
export const starCount = (bits: number) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
/** The song a request starts from, with the solution's rows written in (for the bot, the hint and the festival). */
export function solvedSong(q: Request): Song {
  const s = cloneSong(q.start);
  if (q.sol.bpm) s.bpm = q.sol.bpm;
  s.rows = q.sol.rows.map((r) => ({ m: r.m, n: r.n.slice() })).sort((a, b) => ORDER.indexOf(a.m) - ORDER.indexOf(b.m));
  return s;
}

// ---------------------------------------------------------------- share codes
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/**
 * A song as a short code: "WB" then base-64 of [version, steps and key, tempo, swing, rows, then per row the
 * musician and its cells packed two to a byte, and a check byte]. Load it back with `decode`.
 */
export function encode(s: Song): string {
  const b: number[] = [1, (s.steps === 16 ? 1 : 0) | (clamp(s.key, 0, 15) << 1), clamp(Math.round(s.bpm), TEMPO_MIN, TEMPO_MAX) - TEMPO_MIN, clamp(Math.round(s.swing * 100), 0, 60), s.rows.length];
  for (const r of s.rows) {
    b.push(ORDER.indexOf(r.m));
    for (let i = 0; i < s.steps; i += 2) b.push(((r.n[i] + 1) & 15) | (((r.n[i + 1] ?? -1) + 1) << 4));
  }
  b.push(b.reduce((a, v) => (a * 31 + v) & 255, 7));
  let out = 'WB', acc = 0, bits = 0;
  for (const v of b) { acc = (acc << 8) | v; bits += 8; while (bits >= 6) { bits -= 6; out += B64[(acc >> bits) & 63]; } acc &= (1 << bits) - 1; }
  if (bits) out += B64[(acc << (6 - bits)) & 63];
  return out;
}
export function decode(code: string): Song | null {
  const c = String(code ?? '').trim().replace(/\s+/g, '');
  if (!/^WB[A-Za-z0-9_-]{6,}$/.test(c)) return null;
  const b: number[] = []; let acc = 0, bits = 0;
  for (const ch of c.slice(2)) { const v = B64.indexOf(ch); if (v < 0) return null; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; b.push((acc >> bits) & 255); acc &= (1 << bits) - 1; } }
  if (b.length < 6 || b[0] !== 1) return null;
  const steps = b[1] & 1 ? 16 : 8, key = b[1] >> 1, bpm = b[2] + TEMPO_MIN, swing = b[3] / 100, nrows = b[4];
  if (key >= KEYS.length || bpm > TEMPO_MAX || swing > 0.6 || nrows > ORDER.length) return null;
  const need = 5 + nrows * (1 + steps / 2) + 1;
  if (b.length < need || b.length > need + 1) return null;
  if (b.slice(0, need - 1).reduce((a, v) => (a * 31 + v) & 255, 7) !== b[need - 1]) return null;
  const rows: Row[] = []; let o = 5;
  for (let k = 0; k < nrows; k++) {
    const m = ORDER[b[o++]]; if (!m || rows.some((r) => r.m === m)) return null;
    const n: number[] = [];
    for (let i = 0; i < steps / 2; i++) { const v = b[o++]; n.push((v & 15) - 1, (v >> 4) - 1); }
    if (n.some((v) => v >= MUSICIANS[m].span)) return null;
    rows.push({ m, n });
  }
  rows.sort((a, z) => ORDER.indexOf(a.m) - ORDER.indexOf(z.m));
  return { steps, bpm, swing, key, rows };
}

// ---------------------------------------------------------------- the save
export type ReqSave = { done: boolean; stars: number; best: number | null; code: string };
export type Slot = { name: string; code: string } | null;
export type Save = {
  v: 1; reqs: Record<string, ReqSave>; slots: Slot[]; jam: string; ended: boolean; tutorial: boolean;
  settings: { sound: boolean; music: boolean };
};
export const SLOTS = 4;
export function freshSave(): Save { return { v: 1, reqs: {}, slots: Array(SLOTS).fill(null), jam: '', ended: false, tutorial: false, settings: { sound: true, music: true } }; }
/** Reads a save defensively: anything odd is dropped, never trusted, and nothing throws. */
export function readSave(raw: string | null | undefined, known: (id: string) => boolean = () => true): Save {
  const s = freshSave();
  if (!raw) return s;
  let o: unknown; try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object' || (o as { v?: unknown }).v !== 1) return s;
  const d = o as Record<string, unknown>;
  if (d.reqs && typeof d.reqs === 'object') for (const [id, v] of Object.entries(d.reqs as Record<string, unknown>)) {
    if (!known(id) || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    if (r.done !== true) continue;
    const stars = typeof r.stars === 'number' && Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 7 ? r.stars | 1 : 1;
    const best = typeof r.best === 'number' && Number.isFinite(r.best) && r.best >= 0 && r.best < 10000 ? Math.floor(r.best) : null;
    const code = typeof r.code === 'string' && decode(r.code) ? r.code : '';
    s.reqs[id] = { done: true, stars, best, code };
  }
  if (Array.isArray(d.slots)) for (let i = 0; i < SLOTS; i++) {
    const v = d.slots[i] as Record<string, unknown> | null;
    if (v && typeof v === 'object' && typeof v.code === 'string' && decode(v.code)) s.slots[i] = { name: typeof v.name === 'string' ? v.name.slice(0, 24) : `Song ${i + 1}`, code: v.code };
  }
  if (typeof d.jam === 'string' && decode(d.jam)) s.jam = d.jam;
  s.ended = d.ended === true; s.tutorial = d.tutorial === true;
  const st = d.settings as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') { if (typeof st.sound === 'boolean') s.settings.sound = st.sound; if (typeof st.music === 'boolean') s.settings.music = st.music; }
  return s;
}
/** Records a solve: keeps the best stars (as bits, merged) and fewest changes, and the song itself. */
export function recordSolve(s: Save, id: string, bits: number, ch: number, song: Song): { first: boolean; newStars: number } {
  const old = s.reqs[id], was = old ? starCount(old.stars) : 0;
  const stars = (old?.stars ?? 0) | bits;
  s.reqs[id] = { done: true, stars, best: old?.best == null ? ch : Math.min(old.best, ch), code: encode(song) };
  return { first: !old, newStars: starCount(stars) - was };
}

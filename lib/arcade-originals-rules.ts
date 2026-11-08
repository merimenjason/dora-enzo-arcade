// Shared vocabulary and save format. Each cabinet owns its transition rules.
export type Hero = 'dora' | 'enzo';
export type Difficulty = 'story' | 'standard' | 'expert';
export type Phase = 'playing' | 'clear' | 'lost';
export type Action = { id: string; text: string; to?: number };
export type Choice = { dora: string; enzo: string };
export type Spot = { name: string; x: number; y: number };
export type Edge = readonly [number, number];
export type EventPose = 'interact' | 'hurt' | 'ability' | 'victory';
export type Note = { text: string; tone?: 'warning' | 'good' };
export type Actor = { id: string; at: number; art: number; name: string };
export type View = {
  dora: number; enzo: number; doraPose?: EventPose; enzoPose?: EventPose;
  links: { edge: Edge; style: 'open' | 'closed' | 'hot' | 'linked' }[];
  marks: { at: number; art: number; label: string; kind?: 'safe' | 'warning' | 'focus' }[];
  actors: Actor[];
  facts: { label: string; value: string }[];
  objective: string; preview: string; hint: string; journal?: string[];
};
export type Mission = {
  title: string; story: string; chapter: number; limit: number; par: number;
};
export type State = {
  turn: number; phase: Phase; notes: Note[]; bonus: boolean;
};
export type Rules<S extends State, M extends Mission = Mission> = {
  id: string; title: string; caption: string; ending: string; chapterNames: string[];
  chapters: string[]; heroHelp: Record<Hero, string>; stepLabel: string;
  spots: Spot[]; missions: M[]; maxPlan: number;
  start: (index: number, difficulty: Difficulty, seed: number) => S;
  actions: (index: number, state: S, hero: Hero) => Action[];
  step: (index: number, state: S, pair: Choice) => S;
  view: (index: number, state: S) => View;
  rank: (index: number, state: S) => number;
  signature: (state: S) => string;
};

export const HEROES = ['dora', 'enzo'] as const;
export const wait: Action = { id: 'wait', text: 'Hold' };
export const emptyChoice = (): Choice => ({ dora: 'wait', enzo: 'wait' });
export const difficultyNames = { story: 'Story', standard: 'Standard', expert: 'Expert' };
export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'story' || value === 'standard' || value === 'expert';
export const totalTurns = (mission: Mission, difficulty: Difficulty) =>
  mission.limit + (difficulty === 'story' ? 7 : difficulty === 'expert' ? -2 : 0);
export const near = (edges: readonly Edge[], at: number) => edges.flatMap(([a, b]) => a === at ? [b] : b === at ? [a] : []);
export const edgeKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
export const moveActions = (edges: readonly Edge[], at: number, spots: Spot[], verb = 'Go to'): Action[] =>
  near(edges, at).map((to) => ({ id: `go:${to}`, text: `${verb} ${spots[to].name}`, to }));
export const gridSpots = (names: string[], tiers = [31, 54, 78]): Spot[] =>
  names.map((name, i) => ({ name, x: [16, 50, 84][i % 3], y: tiers[Math.floor(i / 3)] }));
export const seeded = (seed: number) => {
  let word = seed >>> 0 || 1;
  return () => {
    word = (Math.imul(word, 1664525) + 1013904223) >>> 0;
    return word / 0x100000000;
  };
};
export const secret = (index: number, seed: number, pool: number[]) => {
  const origin = Math.floor(seeded(91 + index * 107)() * pool.length);
  // Cycling the seed always moves the collectible, including consecutive seeds.
  return pool[((origin + seed - 91) % pool.length + pool.length) % pool.length];
};

export type Save = {
  v: 1; level: number; unlocked: number; seed: number; difficulty: Difficulty;
  assist: boolean; sound: boolean; active: boolean; records: Record<string, number>;
  keys: { step: string; undo: string; swap: string }; turns: Choice[];
};
export const DEFAULT_KEYS = { step: 'Enter', undo: 'KeyZ', swap: 'KeyQ' };
export const freshSave = (): Save => ({
  v: 1, level: 0, unlocked: 0, seed: 91, difficulty: 'standard',
  assist: true, sound: true, active: false, records: {}, keys: { ...DEFAULT_KEYS }, turns: [],
});
const validKey = (x: unknown): x is string => typeof x === 'string' && /^(Key[A-Z]|Digit[0-9]|Enter|Space)$/.test(x);
const integer = (x: unknown, low: number, high: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= low && x <= high;

export function validChoice<S extends State, M extends Mission>(rules: Rules<S, M>, index: number, state: S, pair: Choice) {
  return state.phase === 'playing' && HEROES.every((h) => rules.actions(index, state, h).some((a) => a.id === pair[h]));
}
export function replay<S extends State, M extends Mission>(rules: Rules<S, M>, save: Save) {
  let state = rules.start(save.level, save.difficulty, save.seed);
  for (const pair of save.turns) {
    if (!validChoice(rules, save.level, state, pair)) break;
    state = rules.step(save.level, state, pair);
  }
  return state;
}
export function readSave<S extends State, M extends Mission>(raw: string | null, rules: Rules<S, M>): Save {
  if (!raw) return freshSave();
  try {
    const s = JSON.parse(raw);
    const max = rules.missions.length - 1;
    if (s?.v !== 1 || !integer(s.level, 0, max) || !integer(s.unlocked, s.level, max) ||
      !integer(s.seed, 1, 0xffffffff) || !isDifficulty(s.difficulty) ||
      typeof s.assist !== 'boolean' || typeof s.sound !== 'boolean' || typeof s.active !== 'boolean' ||
      !Array.isArray(s.turns) || s.turns.length > 100 || !s.records || typeof s.records !== 'object') return freshSave();
    const keys = s.keys ?? {};
    const bindings = { step: keys.step, undo: keys.undo, swap: keys.swap };
    if (!Object.values(bindings).every(validKey) || new Set(Object.values(bindings)).size !== 3) return freshSave();
    if (s.turns.some((p: Choice) => !p || typeof p.dora !== 'string' || typeof p.enzo !== 'string')) return freshSave();
    const records = Object.fromEntries(Object.entries(s.records).filter(([k, v]) => /^(story|standard|expert):[0-9]{1,2}$/.test(k) && integer(v, 1, 3)));
    const result: Save = { ...s, keys: bindings, records };
    if (replay(rules, result).turn !== result.turns.length) return freshSave();
    return result;
  } catch { return freshSave(); }
}
export function applyTurns<S extends State, M extends Mission>(rules: Rules<S, M>, save: Save, pairs: Choice[]): Save {
  let state = replay(rules, save);
  const turns = [...save.turns];
  for (const p of pairs) {
    if (!validChoice(rules, save.level, state, p)) break;
    state = rules.step(save.level, state, p);
    turns.push(p);
  }
  if (state.phase !== 'clear') return { ...save, active: true, turns };
  const key = `${save.difficulty}:${save.level}`;
  const ribbons = 1 + Number(state.turn <= rules.missions[save.level].par) + Number(state.bonus);
  return {
    ...save, active: true, turns,
    unlocked: Math.min(rules.missions.length - 1, Math.max(save.unlocked, save.level + 1)),
    records: { ...save.records, [key]: Math.max(save.records[key] ?? 0, ribbons) },
  };
}

export function distance(edges: readonly Edge[], from: number, target: number) {
  const seen = new Map([[from, 0]]), todo = [from];
  for (const at of todo) {
    if (at === target) return seen.get(at)!;
    for (const n of near(edges, at)) if (!seen.has(n)) {
      seen.set(n, seen.get(at)! + 1);
      todo.push(n);
    }
  }
  return 12;
}

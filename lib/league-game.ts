// Snow Day League: the rules. Dora and Enzo coach the Burrow Snowcats, a snowball team of Andean neighbours, against
// seven rival burrows. Each week they pick one job in the office (train, scout, rest or sign), draft against the rival
// coach (bans and picks from their own squads plus four village loan cards dealt face up in the middle), then watch
// the match play itself. A season is a round robin of seven matches, then the top four play semis and a cup final;
// between seasons players age and grow, rookies arrive, someone may retire and the rivals get stronger.
//
// The match is a pure function of (seed, lineups, tactics, shouts): a fixed 30 ticks a second, a seeded random
// number generator and no DOM. Every unit has a role and the role's counters are real mechanics, not just numbers:
// - builders raise snow walls that stop throws (so builders beat throwers);
// - scouts lob over walls and flank to the backline (so scouts beat builders);
// - diggers bury anyone who comes close in a snow pile, scouts for longest (so diggers beat scouts);
// - throwers out-range diggers, who have to walk up to the fort to dig it (so throwers beat diggers);
// - medics are neutral. A counter also hits a little harder on top, for balance.
// Win by knocking every block out of the other fort (the tower goes last and the flag falls). At time-up the fort
// with more of itself left wins.

export const TICK = 30;
export const MATCH_TICKS = 90 * TICK;
export const HALF_TICKS = 45 * TICK;
export const FW = 400, FH = 150;
export const SAVE_KEY = 'snow-day-league-v1';
export const SQUAD_MAX = 9, SQUAD_MIN = 6, LINEUP = 5, POOL_SIZE = 4;

// ---------------------------------------------------------------- the random numbers
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (...n: number[]) => { let h = 2166136261; for (const x of n) { h ^= x >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13; } return h >>> 0; };
type Rand = () => number;
const pick = <T>(r: Rand, a: readonly T[]) => a[Math.floor(r() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- the animals, roles and personalities
export type Species = 'vizcacha' | 'guanaco' | 'pudu' | 'fox' | 'bear' | 'mara' | 'alpaca' | 'flamingo' | 'armadillo' | 'condor' | 'rhea' | 'vicuna' | 'cat';
export const SPECIES: Species[] = ['vizcacha', 'guanaco', 'pudu', 'fox', 'bear', 'mara', 'alpaca', 'flamingo', 'armadillo', 'condor', 'rhea', 'vicuna', 'cat'];
export const SPECIES_NAME: Record<Species, string> = { vizcacha: 'vizcacha', guanaco: 'guanaco', pudu: 'pudú', fox: 'culpeo fox', bear: 'spectacled bear', mara: 'mara', alpaca: 'alpaca', flamingo: 'flamingo', armadillo: 'armadillo', condor: 'condor', rhea: 'rhea', vicuna: 'vicuña', cat: 'Andean cat' };
export type Role = 'thrower' | 'digger' | 'builder' | 'scout' | 'medic';
export const ROLES: Role[] = ['thrower', 'digger', 'builder', 'scout', 'medic'];
export const ROLE_NAME: Record<Role, string> = { thrower: 'Thrower', digger: 'Digger', builder: 'Builder', scout: 'Scout', medic: 'Medic' };
/** who each role beats: builders beat throwers, scouts beat builders, diggers beat scouts, throwers beat diggers */
export const BEATS: Record<Role, Role | null> = { builder: 'thrower', scout: 'builder', digger: 'scout', thrower: 'digger', medic: null };
export const beats = (a: Role, b: Role) => BEATS[a] === b;
export const counterOf = (r: Role): Role | null => (ROLES.find((x) => BEATS[x] === r) ?? null);
export const ROLE_WHY: Record<Role, string> = {
  builder: 'a builder’s walls stop their throws',
  scout: 'a scout lobs over their walls',
  digger: 'a digger buries their scouts in snow',
  thrower: 'a thrower out-ranges their diggers',
  medic: 'a medic keeps everyone up',
};
export const SPECIAL: Record<Role, { name: string; what: string }> = {
  thrower: { name: 'Big Snowball', what: 'a giant snowball that bursts over a crowd or a fort' },
  digger: { name: 'Tunnel Dash', what: 'tunnels under everything and pops up at their fort' },
  builder: { name: 'Igloo Wall', what: 'raises a thick wall at once and patches themselves up' },
  scout: { name: 'Spin Throw', what: 'spins and hits everyone close by' },
  medic: { name: 'Cocoa Break', what: 'heals everyone near and wakes anyone knocked out' },
};
export type Personality = 'hothead' | 'steady' | 'shy' | 'showoff' | 'cheery';
export const PERSONALITY: Record<Personality, { name: string; what: string }> = {
  hothead: { name: 'Hothead', what: 'big swings: loves a win, hates the bench' },
  steady: { name: 'Steady', what: 'morale moves slowly either way' },
  shy: { name: 'Shy', what: 'doesn’t mind the bench; rest helps a lot' },
  showoff: { name: 'Show-off', what: 'specials come round sooner; hates the bench' },
  cheery: { name: 'Cheery', what: 'lifts the whole squad’s morale every week' },
};
export type Stat = 'aim' | 'speed' | 'grit';
export const STATS: Stat[] = ['aim', 'speed', 'grit'];
export const STAT_MAX = 10;

export type Player = {
  id: string; name: string; species: Species; role: Role;
  aim: number; speed: number; grit: number;
  personality: Personality; age: number; morale: number;
  /** a village loan card, only for one draft */
  loan?: boolean;
  games: number; kos: number; mvps: number;
};

const NAMES = ['Pico', 'Nube', 'Tula', 'Quilla', 'Inti', 'Mayu', 'Sami', 'Kusi', 'Wayra', 'Rumi', 'Tika', 'Puri', 'Nina', 'Yaku', 'Ayni', 'Chaska', 'Killa', 'Sumaq', 'Pacha', 'Urpi', 'Lumo', 'Taro', 'Kiri', 'Momo', 'Pom', 'Bixi', 'Dali', 'Juno', 'Remi', 'Sol', 'Luma', 'Teo', 'Coco', 'Mote', 'Pepa', 'Bombo', 'Zuri', 'Chip', 'Tuki', 'Lalo', 'Rafi', 'Nilo', 'Pacho', 'Wari', 'Tito', 'Yuri', 'Ollie', 'Pip', 'Kai', 'Noa', 'Ari', 'Ren', 'Suyu', 'Kuri', 'Paku', 'Llaki', 'Achi', 'Tumi', 'Wiri', 'Pinto', 'Chalo', 'Quinto', 'Mika', 'Lio', 'Bobo', 'Tanti', 'Rio', 'Yaya', 'Chui', 'Huayna', 'Pampa', 'Ichu', 'Qori', 'Sisa', 'Tupi', 'Allin', 'Kachi', 'Ñuqa', 'Pilu', 'Wawa', 'Kiko', 'Lulu', 'Nano', 'Popi', 'Rulo', 'Sepo', 'Toto', 'Ume', 'Vito', 'Yoyo', 'Zeta', 'Bru', 'Cusi', 'Dodo', 'Fizz', 'Gubi', 'Hopi', 'Iki', 'Jojo', 'Kuko', 'Loli', 'Mimo', 'Nuno', 'Opi', 'Paz', 'Quimo', 'Roro', 'Suri', 'Tolo', 'Uchu', 'Vivi', 'Wiki', 'Yupi', 'Zazu', 'Bolo', 'Chiri', 'Dui'];
/** every name in use in a save: our squad, the rivals and the free agents (loans are drawn against these too) */
export const namesIn = (s: { squad: Player[]; rivals: Record<string, Player[]>; free?: Player[] }, skipFree = false) => new Set([...s.squad, ...Object.values(s.rivals).flat(), ...(skipFree ? [] : s.free ?? [])].map((p) => p.name));

// ---------------------------------------------------------------- the teams
export type TeamId = 'snowcats' | 'flamingos' | 'armadillos' | 'condors' | 'alpacas' | 'rheas' | 'vicunas' | 'cats';
export type Habit = { ban: 'thrower' | 'builder' | 'digger' | 'medic' | 'scout' | 'best'; likes: Role[]; smart: number; tactic: Tactic };
export type TeamInfo = { id: TeamId; name: string; short: string; species: Species; colour: string; coach: string; blurb: string; habit: Habit; strength: number; taunt: string[]; shake: [string, string] };
export const TEAMS: TeamInfo[] = [
  { id: 'snowcats', name: 'Burrow Snowcats', short: 'Snowcats', species: 'fox', colour: '#d8352a', coach: 'Dora & Enzo', blurb: 'Our mixed squad of mountain neighbours.', habit: { ban: 'best', likes: [], smart: 1, tactic: 'balanced' }, strength: 0, taunt: ['Good luck out there!'], shake: ['Well played!', 'Good game!'] },
  { id: 'flamingos', name: 'Lagoon Flamingos', short: 'Flamingos', species: 'flamingo', colour: '#2f74d8', coach: 'Coach Rosada', blurb: 'Showy and balanced. Always bans your best thrower.', habit: { ban: 'thrower', likes: ['thrower', 'scout'], smart: 0.5, tactic: 'balanced' }, strength: 5.1, taunt: ['Darlings, do try to keep up.', 'We’ve practised our poses AND our throws.', 'Your best thrower won’t be playing. You’ll see why.'], shake: ['Fabulous match. Truly.', 'Hmph. Next time, we wear the sparkly scarves.'] },
  { id: 'armadillos', name: 'Pampa Armadillos', short: 'Armadillos', species: 'armadillo', colour: '#3f9b3a', coach: 'Coach Tatu', blurb: 'Love builders: walls everywhere, slow and stubborn.', habit: { ban: 'scout', likes: ['builder', 'builder', 'medic'], smart: 0.3, tactic: 'guard' }, strength: 4.7, taunt: ['You’ll never get through our walls.', 'Build, build, build. That’s the plan. Always.', 'Slow and steady takes the fort.'], shake: ['Solid game. Like a good wall.', 'Back to the brick pile for us.'] },
  { id: 'condors', name: 'Peak Condors', short: 'Condors', species: 'condor', colour: '#5a46b8', coach: 'Coach Kuntur', blurb: 'Throwers with long range. Bans your best builder.', habit: { ban: 'builder', likes: ['thrower', 'thrower'], smart: 0.4, tactic: 'balanced' }, strength: 5.3, taunt: ['We see everything from up here.', 'Our throws land before you hear them.', 'Your builder? Banned. Sorry not sorry.'], shake: ['A fine flight. Respect.', 'The wind was not with us today.'] },
  { id: 'alpacas', name: 'Valley Alpacas', short: 'Alpacas', species: 'alpaca', colour: '#16a094', coach: 'Coach Lanita', blurb: 'Patient and woolly. Medics first, always.', habit: { ban: 'best', likes: ['medic', 'builder'], smart: 0.4, tactic: 'guard' }, strength: 4.8, taunt: ['Hello, neighbours! Bring cocoa for after?', 'We’ve knitted extra mittens. You’ll need them.', 'Medics first, snowballs second.'], shake: ['Lovely match, neighbours!', 'Cocoa at ours next week, win or lose!'] },
  { id: 'rheas', name: 'Steppe Rheas', short: 'Rheas', species: 'rhea', colour: '#e5862a', coach: 'Coach Ñandú', blurb: 'Fast scouts that rush the flanks. Bans your best digger.', habit: { ban: 'digger', likes: ['scout', 'scout'], smart: 0.4, tactic: 'push' }, strength: 5.3, taunt: ['Blink and you’ll miss us!', 'We’ve already lapped the pitch twice this morning.', 'Your diggers can’t catch what they can’t see.'], shake: ['Phew! Good run!', 'We ran out of puff. Well played.'] },
  { id: 'vicunas', name: 'Salt Flat Vicuñas', short: 'Vicuñas', species: 'vicuna', colour: '#d9b322', coach: 'Coach Wari', blurb: 'Diggers that go straight for your fort. Bans your medic.', habit: { ban: 'medic', likes: ['digger', 'digger'], smart: 0.4, tactic: 'push' }, strength: 5.3, taunt: ['We dig, you worry.', 'Your fort’s foundations look… comfy.', 'No medic for you today, I think.'], shake: ['Good dig. Er, game.', 'The salt flats will have to wait.'] },
  { id: 'cats', name: 'Shadow Cats', short: 'Cats', species: 'cat', colour: '#d23c8c', coach: 'Coach Osqollo', blurb: 'Sneaky and clever: they draft the counter to whatever you pick.', habit: { ban: 'best', likes: ['scout', 'thrower'], smart: 0.95, tactic: 'balanced' }, strength: 5.8, taunt: ['Whatever you pick, we already know.', 'Purr. This will be quick.', 'We read your draft before you made it.'], shake: ['Hm. Clever coaches.', 'Interesting. We’ll remember this.'] },
];
export const team = (id: TeamId) => TEAMS.find((t) => t.id === id)!;

// ---------------------------------------------------------------- making players
let idSeq = 0;
const newId = (r: Rand) => `p${Math.floor(r() * 1e9).toString(36)}${(idSeq++).toString(36)}`;
/** the stats a role leans on */
const LEAN: Record<Role, [number, number, number]> = { thrower: [1.4, 0.8, 0.8], digger: [0.8, 1.15, 1.05], builder: [0.7, 0.7, 1.6], scout: [1, 1.5, 0.5], medic: [0.7, 1.1, 1.2] };
/** how good a player is at their role, about 1 to 10 */
export function rating(p: Pick<Player, 'role' | 'aim' | 'speed' | 'grit'>) {
  const [a, s, g] = LEAN[p.role];
  return (p.aim * a + p.speed * s + p.grit * g) / (a + s + g);
}
export const ovr = (p: Player) => Math.round(rating(p) * 10);
export function makePlayer(r: Rand, species: Species, role: Role, level: number, used: Set<string> = new Set()): Player {
  const [a, s, g] = LEAN[role];
  const st = (w: number) => clamp(Math.round(level * (0.75 + w * 0.22) + (r() - 0.5) * 2.4), 1, STAT_MAX);
  const open = NAMES.filter((n) => !used.has(n));
  let name = open.length ? pick(r, open) : pick(r, NAMES);
  for (let k = 2; used.has(name); k++) name = `${name.replace(/ \d+$/, '')} ${k}`;
  used.add(name);
  return { id: newId(r), name, species, role, aim: st(a), speed: st(s), grit: st(g), personality: pick(r, ['hothead', 'steady', 'shy', 'showoff', 'cheery'] as Personality[]), age: 2 + Math.floor(r() * 5), morale: 62, games: 0, kos: 0, mvps: 0 };
}
export function startingSquad(r: Rand): Player[] {
  const P = (name: string, species: Species, role: Role, aim: number, speed: number, grit: number, personality: Personality, age: number): Player => ({ id: newId(r), name, species, role, aim, speed, grit, personality, age, morale: 65, games: 0, kos: 0, mvps: 0 });
  return [
    P('Pico', 'vizcacha', 'thrower', 7, 5, 4, 'showoff', 4),
    P('Tupa', 'guanaco', 'digger', 4, 6, 6, 'steady', 5),
    P('Mayu', 'pudu', 'medic', 4, 6, 5, 'shy', 3),
    P('Rojo', 'fox', 'scout', 6, 7, 3, 'hothead', 4),
    P('Osi', 'bear', 'builder', 4, 3, 8, 'cheery', 3),
    P('Lebi', 'mara', 'digger', 4, 6, 5, 'cheery', 2),
    P('Pompom', 'alpaca', 'thrower', 5, 4, 5, 'steady', 2),
  ];
}
const RIVAL_ROLES: Record<Exclude<TeamId, 'snowcats'>, Role[]> = {
  flamingos: ['thrower', 'thrower', 'scout', 'builder', 'medic', 'digger', 'scout'],
  armadillos: ['builder', 'builder', 'builder', 'medic', 'thrower', 'digger', 'scout'],
  condors: ['thrower', 'thrower', 'thrower', 'builder', 'medic', 'digger', 'scout'],
  alpacas: ['medic', 'medic', 'builder', 'thrower', 'digger', 'scout', 'thrower'],
  rheas: ['scout', 'scout', 'scout', 'thrower', 'medic', 'digger', 'builder'],
  vicunas: ['digger', 'digger', 'digger', 'thrower', 'medic', 'builder', 'scout'],
  cats: ['scout', 'thrower', 'digger', 'builder', 'medic', 'thrower', 'scout'],
};
export function rivalSquad(r: Rand, id: Exclude<TeamId, 'snowcats'>, level: number, used = new Set<string>()): Player[] {
  const t = team(id);
  return RIVAL_ROLES[id].map((role, i) => { const p = makePlayer(r, t.species, role, level + (i < 3 ? 0.4 : -0.2), used); p.morale = 60; return p; });
}
const FREE_SPECIES: Species[] = ['vizcacha', 'guanaco', 'pudu', 'fox', 'bear', 'mara', 'alpaca', 'flamingo', 'armadillo', 'condor', 'rhea', 'vicuna'];
export function freeAgent(r: Rand, level: number, used?: Set<string>): Player { return makePlayer(r, pick(r, FREE_SPECIES), pick(r, ROLES), level, used); }
export const price = (p: Player) => Math.round((Math.max(3, rating(p)) - 2) * 22 / 5) * 5 + (p.age <= 3 ? 10 : 0);

// ---------------------------------------------------------------- the match
export type Tactic = 'balanced' | 'push' | 'guard';
export const TACTIC_NAME: Record<Tactic, string> = { balanced: 'Balanced', push: 'All-out attack', guard: 'Guard the fort' };
export type ShoutKind = 'attack' | 'hold' | 'protect';
export type Weather = 'clear' | 'snow' | 'wind' | 'fog';
export const WEATHER: Record<Weather, { name: string; what: string }> = {
  clear: { name: 'Clear skies', what: 'No surprises: a fair fight.' },
  snow: { name: 'Snowfall', what: 'Fresh snow: everyone makes snowballs faster but runs a little slower.' },
  wind: { name: 'Windy', what: 'The wind carries throws: the side with it at their backs aims better.' },
  fog: { name: 'Fog', what: 'Short sight: long throws are harder, and scouts sneak about unseen.' },
};
export type Phase = 'opening' | 'pressure' | 'comeback' | 'final';
export const PHASE_NAME: Record<Phase, string> = { opening: 'The opening scramble', pressure: 'Fort pressure', comeback: 'Comeback time', final: 'Final seconds!' };
export type Shout = { t: number; side: Side; kind: ShoutKind; target?: number };
export const SHOUT_TICKS = 12 * TICK;
export type Side = 0 | 1;
export type Anim = 'idle' | 'run' | 'throw' | 'special' | 'ko' | 'cheer' | 'dig' | 'build' | 'heal' | 'stun' | 'tunnel';
export type Unit = {
  id: number; side: Side; slot: number; p: Player; role: Role; name: string;
  x: number; y: number; px: number; py: number; face: 1 | -1;
  hp: number; maxHp: number; ammo: number; maxAmmo: number;
  cd: number; make: number; spec: number; specMax: number; tele: number; teleKind: Role | null;
  ko: number; stun: number; tunnel: number; prey: number; bury: number; work: number; cheer: number; shield: number;
  anim: Anim; animT: number; perf: number; reviving: number; revivedBy: number;
  stats: { kos: number; ko: number; dmg: number; fort: number; blocks: number; heal: number; fix: number; blocked: number; buries: number; specials: number };
};
export type Ball = { id: number; side: Side; from: number; x0: number; y0: number; tx: number; ty: number; target: number; fort: boolean; wall: number; t: number; dur: number; dmg: number; hit: boolean; big: boolean; lob: boolean };
export type Wall = { id: number; side: Side; by: number; x: number; y: number; hp: number; max: number; up: number };
export type Fort = { side: Side; x: number; y: number; blocks: number[]; max: number };
export type Ev =
  | { k: 'throw'; side: Side; u: number; big: boolean; lob: boolean }
  | { k: 'hit'; side: Side; u: number; by: number; dmg: number; counter: boolean; x: number; y: number }
  | { k: 'miss'; x: number; y: number }
  | { k: 'wallhit'; side: Side; wall: number; x: number; y: number; broke: boolean }
  | { k: 'fort'; side: Side; dmg: number; x: number; y: number; block: number; knocked: boolean; by: number; shake: boolean }
  | { k: 'ko'; side: Side; u: number; by: number; special: boolean }
  | { k: 'special'; side: Side; u: number; role: Role }
  | { k: 'tele'; side: Side; u: number; role: Role }
  | { k: 'wall'; side: Side; u: number; wall: number }
  | { k: 'bury'; side: Side; u: number; by: number }
  | { k: 'revive'; side: Side; u: number; by: number }
  | { k: 'respawn'; side: Side; u: number }
  | { k: 'repair'; side: Side; block: number }
  | { k: 'shout'; side: Side; kind: ShoutKind; target?: number }
  | { k: 'flag'; side: Side }
  | { k: 'surge'; side: Side }
  | { k: 'phase'; phase: Phase }
  | { k: 'comeback'; side: Side }
  | { k: 'cheer'; side: Side; u: number }
  | { k: 'end'; winner: Side | -1; how: 'flag' | 'time' };
export type Line = { t: number; text: string; side: Side | -1 };

export const BLOCK_HP = 25, FORT_BLOCKS = 16;
/** a lead only counts once it is more than this share of a fort */
const LEAD_BAND = 0.03;
export let COUNTER_HIT = 2.3, COUNTER_TAKE = 0.5;
let DIG_DMG = 1.6, KO_FORT = 10, DIG_SCOUT_REACH = 30, DIG_SCOUT_RANGE = 60;
const ROLE_DMG: Record<Role, number> = { thrower: 0.8, scout: 1, builder: 0.75, digger: 1, medic: 0.7 };
const DIG_TICKS = 26;
let REPAIR = 0.07, WALL_HALF = 18;
const FORT_RANGE: Record<Role, number> = { thrower: 250, scout: 160, digger: 0, builder: 0, medic: 0 };
let FORT_SHARE = 0.35;
export const tune = (k: string, v: number) => { if (k === 'COUNTER_HIT') COUNTER_HIT = v; if (k === 'COUNTER_TAKE') COUNTER_TAKE = v; if (k === 'DIG_DMG') DIG_DMG = v; if (k === 'KO_FORT') KO_FORT = v; if (k === 'DIG_SCOUT_REACH') DIG_SCOUT_REACH = v; if (k === 'DIG_SCOUT_RANGE') DIG_SCOUT_RANGE = v; if (k.startsWith('D_')) ROLE_DMG[k.slice(2) as Role] = v; if (k === 'FORT_SHARE') FORT_SHARE = v; if (k === 'REPAIR') REPAIR = v; if (k === 'WALL_HALF') WALL_HALF = v; if (k === 'STAR_LEVEL') STAR_LEVEL = v; if (k === 'SCOUT_MO') SCOUT_MO = v; if (k === 'W_COUNTER') W_COUNTER = v; if (k.startsWith('S_')) { const t = TEAMS.find((q) => q.id === k.slice(2)); if (t) t.strength = v; } };
const RANGE: Record<Role, number> = { thrower: 175, digger: 62, builder: 120, scout: 115, medic: 95 };
const CD: Record<Role, number> = { thrower: 34, digger: 40, builder: 44, scout: 36, medic: 60 };
const AMMO: Record<Role, number> = { thrower: 3, digger: 5, builder: 2, scout: 3, medic: 2 };
const MAKE: Record<Role, number> = { thrower: 26, digger: 10, builder: 30, scout: 26, medic: 34 };
const SPEC_CD = 15 * TICK;
/** kick-off spots (depth from the fort, then height), filled front-liners first */
const FORMATION: [number, number][] = [[82, 75], [70, 42], [70, 108], [54, 20], [54, 130]];
const ROLE_ROW: Record<Role, number> = { builder: 0, digger: 1, scout: 2, thrower: 3, medic: 4 };

export type Lineup = Player[];
export type MatchOpts = { seed: number; lineups: [Lineup, Lineup]; tactics?: [Tactic, Tactic]; shouts?: Shout[]; names?: [string, string]; coachAI?: [boolean, boolean]; knockout?: boolean; weather?: Weather; wind?: 1 | -1; momentum?: [number, number] };

export class Match {
  seed: number; r: Rand; t = 0; over = false; winner: Side | -1 = -1; how: 'flag' | 'time' | null = null;
  units: Unit[] = []; balls: Ball[] = []; walls: Wall[] = []; forts: [Fort, Fort];
  tactics: [Tactic, Tactic]; shouts: Shout[]; names: [string, string]; coachAI: [boolean, boolean]; knockout: boolean;
  /** the shout now in force on each side, with its ticks left */
  mode: [{ kind: ShoutKind; left: number; target?: number } | null, { kind: ShoutKind; left: number; target?: number } | null] = [null, null];
  used: [[boolean, boolean], [boolean, boolean]] = [[false, false], [false, false]];
  events: Ev[] = []; log: Line[] = [];
  /** fort health over time, for lead changes */
  leadChanges = 0; private lastLead: Side | -1 = -1;
  firstDamage = -1;
  weather: Weather; wind: 1 | -1;
  /** momentum builds with KOs and knocked blocks; full momentum is a surge: a few seconds of everyone at their best */
  momentum: [number, number] = [0, 0]; surge: [number, number] = [0, 0];
  comebacks = 0; private deficit: [number, number] = [0, 0];
  /** the deciding moment, for the replay: the last lead change (or the flag) */
  decisiveAt = -1; private lastKnockBy: [number, number] = [-1, -1];
  phase: Phase = 'opening'; private clutchSaid = false;
  /** both forts' health (percent) once a second, for the result screen's graph */
  trace: [number, number][] = [];
  private seq = 1;
  constructor(o: MatchOpts) {
    this.seed = o.seed >>> 0; this.r = rng(this.seed ^ 0x5eed);
    this.tactics = o.tactics ?? ['balanced', 'balanced'];
    this.shouts = [...(o.shouts ?? [])].sort((a, b) => a.t - b.t);
    this.names = o.names ?? ['Snowcats', 'Rivals'];
    this.coachAI = o.coachAI ?? [false, true];
    this.knockout = !!o.knockout;
    this.weather = o.weather ?? 'clear'; this.wind = o.wind ?? 1;
    if (o.momentum) this.momentum = [...o.momentum];
    const fort = (side: Side): Fort => ({ side, x: side === 0 ? 24 : FW - 24, y: FH / 2, blocks: Array(FORT_BLOCKS).fill(BLOCK_HP), max: FORT_BLOCKS * BLOCK_HP });
    this.forts = [fort(0), fort(1)];
    // the kick-off formation: the front-liners in the middle, the backs on the wings
    const rows = ([0, 1] as Side[]).map((side) => { const ls = o.lineups[side].slice(0, LINEUP); const order = ls.map((p, i) => i).sort((a, b) => ROLE_ROW[ls[a].role] - ROLE_ROW[ls[b].role] || a - b); const row: number[] = []; order.forEach((i, k) => { row[i] = k; }); return row; });
    for (const side of [0, 1] as Side[]) o.lineups[side].slice(0, LINEUP).forEach((p, slot) => {
      const maxHp = Math.round(46 + p.grit * 7 + (p.role === 'builder' ? 26 : 0));
      const perf = moraleFactor(p.morale);
      const [fx, fy] = FORMATION[rows[side][slot]];
      const y = fy, x = side === 0 ? fx : FW - fx;
      this.units.push({ id: this.units.length, side, slot, p, role: p.role, name: p.name, x, y, px: x, py: y, face: side === 0 ? 1 : -1, hp: maxHp, maxHp, ammo: AMMO[p.role], maxAmmo: AMMO[p.role], cd: 20 + slot * 7, make: 0,
        spec: Math.round(SPEC_CD * 0.6 * (p.personality === 'showoff' ? 0.8 : 1)), specMax: Math.round(SPEC_CD * (p.personality === 'showoff' ? 0.8 : 1)), tele: 0, teleKind: null, ko: 0, stun: 0, tunnel: 0, prey: -1, bury: 0, work: 0, cheer: 0, shield: -1,
        anim: 'idle', animT: 0, perf, reviving: 0, revivedBy: -1, stats: { kos: 0, ko: 0, dmg: 0, fort: 0, blocks: 0, heal: 0, fix: 0, blocked: 0, buries: 0, specials: 0 } });
    });
  }
  // ------------------------------------------------ reading the state
  fortHp(side: Side) { return this.forts[side].blocks.reduce((a, b) => a + Math.max(0, b), 0); }
  fortShare(side: Side) { return this.fortHp(side) / this.forts[side].max; }
  /** blocks still standing */
  blocksLeft(side: Side) { return this.forts[side].blocks.filter((b) => b > 0).length; }
  side(s: Side) { return this.units.filter((u) => u.side === s); }
  alive(u: Unit) { return u.ko === 0; }
  up(side: Side) { return this.units.filter((u) => u.side === side && u.ko === 0).length; }
  get half() { return this.t < HALF_TICKS ? 0 : 1; }
  canShout(side: Side) { return !this.over && !this.used[side][this.half] && this.mode[side] === null; }
  /** a coach's shout from the bench, now (it is recorded so a replay gives the same match) */
  shout(side: Side, kind: ShoutKind, target?: number) {
    if (!this.canShout(side)) return false;
    this.shouts.push({ t: this.t, side, kind, target }); this.applyShout({ t: this.t, side, kind, target }); return true;
  }
  private applyShout(s: Shout) {
    if (this.used[s.side][this.half]) return;
    this.used[s.side][this.half] = true;
    this.mode[s.side] = { kind: s.kind, left: SHOUT_TICKS, target: s.target };
    this.events.push({ k: 'shout', side: s.side, kind: s.kind, target: s.target });
    const who = s.side === 0 ? 'Dora and Enzo' : `The ${this.names[1]}’ coach`;
    const tu = s.target !== undefined ? this.units[s.target] : null;
    this.say(s.side, s.kind === 'attack' ? `${who}: “All attack!”` : s.kind === 'hold' ? `${who}: “Hold the walls!”` : `${who}: “Protect ${tu?.name ?? 'them'}!”`);
  }
  private say(side: Side | -1, text: string) { this.log.push({ t: this.t, text, side }); }
  private hurt(u: Unit) { return u.hp / u.maxHp; }

  // ------------------------------------------------ the tick
  step() {
    if (this.over) return;
    this.events = [];
    while (this.shouts.length && this.shouts[0].t <= this.t && this.shouts.find((s) => s.t === this.t)) {
      const i = this.shouts.findIndex((s) => s.t === this.t); if (i < 0) break;
      const s = this.shouts[i];
      // keep a record of live shouts (already applied) but apply scheduled ones now
      if (!this.used[s.side][this.half] && this.mode[s.side] === null) this.applyShout(s);
      this.shouts.splice(i, 1); (this.applied ??= []).push(s);
    }
    for (const side of [0, 1] as Side[]) { const m = this.mode[side]; if (m && --m.left <= 0) this.mode[side] = null; }
    for (const side of [0, 1] as Side[]) if (this.coachAI[side]) this.coach(side);
    for (const side of [0, 1] as Side[]) {
      if (this.surge[side] > 0) this.surge[side]--;
      else if (this.momentum[side] >= 100) { this.momentum[side] = 0; this.surge[side] = 6 * TICK; this.events.push({ k: 'surge', side }); this.say(side, side === 0 ? `The ${this.names[0]} are on a roll: everyone at their best!` : `The ${this.names[1]} are on a roll!`); }
      this.momentum[side] = Math.max(0, this.momentum[side] - 0.02);
    }
    const ph: Phase = this.t < 15 * TICK ? 'opening' : this.t < 60 * TICK ? 'pressure' : this.t < 78 * TICK ? 'comeback' : 'final';
    if (ph !== this.phase) { this.phase = ph; this.events.push({ k: 'phase', phase: ph }); this.say(-1, ph === 'pressure' ? 'The scramble’s over: now the forts feel the pressure.' : ph === 'comeback' ? 'Into the last half-minute: still time for a comeback!' : 'Final seconds!'); }
    for (const u of this.units) { u.px = u.x; u.py = u.y; this.think(u); }
    this.separate();
    this.flyBalls();
    for (const w of this.walls) if (w.up < 1) w.up = Math.min(1, w.up + 1 / 30);
    this.walls = this.walls.filter((w) => w.hp > 0);
    // the lead (by fort left) and the end
    const a = this.fortHp(0), b = this.fortHp(1);
    const band = this.forts[0].max * LEAD_BAND;
    const lead: Side | -1 = a > b + band ? 0 : b > a + band ? 1 : -1;
    if (this.t % TICK === 0) this.trace.push([Math.round(a / this.forts[0].max * 100), Math.round(b / this.forts[1].max * 100)]);
    if (lead !== -1 && this.lastLead !== -1 && lead !== this.lastLead) {
      this.leadChanges++; this.decisiveAt = this.t;
      if (this.deficit[lead] >= 0.12) { this.comebacks++; this.events.push({ k: 'comeback', side: lead }); this.say(lead, lead === 0 ? `What a comeback! The ${this.names[0]} take the lead!` : `The ${this.names[1]} come back to lead!`); }
      this.deficit = [0, 0];
    }
    if (lead !== -1) this.lastLead = lead;
    const gap = (a - b) / this.forts[0].max;
    if (gap < 0) this.deficit[0] = Math.max(this.deficit[0], -gap); else this.deficit[1] = Math.max(this.deficit[1], gap);
    if (this.firstDamage < 0 && (a < this.forts[0].max || b < this.forts[1].max)) this.firstDamage = this.t;
    this.t++;
    if (a <= 0 || b <= 0) this.finish(a <= 0 ? 1 : 0, 'flag');
    else if (this.t >= MATCH_TICKS) this.finish(a > b ? 0 : b > a ? 1 : this.tieBreak(), 'time');
  }
  /** shouts that were scheduled in advance and have been played */
  applied: Shout[] | undefined;
  private tieBreak(): Side | -1 {
    const k0 = this.units.filter((u) => u.side === 0).reduce((s, u) => s + u.stats.kos, 0), k1 = this.units.filter((u) => u.side === 1).reduce((s, u) => s + u.stats.kos, 0);
    if (k0 !== k1) return k0 > k1 ? 0 : 1;
    return this.knockout ? (this.r() < 0.5 ? 0 : 1) : -1;
  }
  finish(winner: Side | -1, how: 'flag' | 'time') {
    if (this.over) return;
    this.over = true; this.winner = winner; this.how = how;
    if (how === 'flag' || this.decisiveAt < 0) this.decisiveAt = how === 'flag' ? this.t : Math.max(0, this.lastKnockBy[winner === -1 ? 0 : winner]);
    if (how === 'flag' && winner !== -1) { const lost = (1 - winner) as Side; this.events.push({ k: 'flag', side: lost }); this.say(winner, winner === 0 ? `The ${this.names[1]}’ flag topples! The ${this.names[0]} win!` : `Our flag topples… the ${this.names[1]} win.`); }
    else this.say(winner, winner === -1 ? 'Time! The forts are level: a draw.' : `Time! The ${this.names[winner]} kept more of their fort.`);
    this.events.push({ k: 'end', winner, how });
    for (const u of this.units) if (u.ko === 0) { u.anim = u.side === winner ? 'cheer' : 'idle'; u.animT = 0; u.tele = 0; u.tunnel = 0; }
  }

  // ------------------------------------------------ the rival coach (and the bots' coach)
  private coach(side: Side) {
    if (!this.canShout(side)) return;
    const mine = this.fortShare(side), theirs = this.fortShare((1 - side) as Side);
    const at = side === 0 ? [26, 66] : [30, 70];
    const sec = this.t / TICK;
    if (this.half === 0 && sec >= at[0] && sec < 45) {
      if (mine < theirs - 0.06) this.shout(side, 'hold'); else this.shout(side, 'attack');
    } else if (this.half === 1 && sec >= at[1]) {
      if (mine < theirs) this.shout(side, 'attack');
      else if (mine - theirs < 0.12) this.shout(side, 'hold');
      else { const star = this.bestUnit(side); this.shout(side, 'protect', star?.id); }
    }
  }
  bestUnit(side: Side) { return this.units.filter((u) => u.side === side && u.ko === 0).sort((a, b) => (b.stats.kos * 3 + b.stats.fort / 10) - (a.stats.kos * 3 + a.stats.fort / 10) || rating(b.p) - rating(a.p))[0] ?? null; }

  // ------------------------------------------------ one unit's brain
  private enemies(u: Unit) { return this.units.filter((e) => e.side !== u.side && e.ko === 0 && e.tunnel === 0); }
  private friends(u: Unit) { return this.units.filter((e) => e.side === u.side && e !== u); }
  private dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }
  private speedOf(u: Unit) {
    const m = this.mode[u.side];
    return (0.62 + u.p.speed * 0.075 + (u.role === 'scout' ? 0.28 : 0) - (u.role === 'builder' ? 0.08 : 0)) * (m?.kind === 'attack' ? 1.15 : 1) * (this.weather === 'snow' ? 0.93 : 1) * (this.surge[u.side] > 0 ? 1.1 : 1);
  }
  /** how well a unit is playing right now: morale, a surge, clutch in the final seconds, a comeback push */
  power(u: Unit) {
    let k = u.perf;
    if (this.surge[u.side] > 0) k *= 1.12;
    if (this.phase === 'final' && (u.p.personality === 'steady' || u.p.morale >= 75)) k *= 1.08;
    if (this.t > 55 * TICK && this.deficit[u.side] > 0.15 && this.lastLead !== u.side) k *= 1.1;
    return k;
  }
  private moveTo(u: Unit, x: number, y: number, speed = this.speedOf(u)) {
    const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
    if (d < 1.5) return true;
    const s = Math.min(d, speed);
    u.x = clamp(u.x + dx / d * s, 6, FW - 6); u.y = clamp(u.y + dy / d * s, 8, FH - 6);
    if (Math.abs(dx) > 0.3) u.face = dx > 0 ? 1 : -1;
    if (u.anim !== 'throw' || u.animT > 8) { if (u.anim !== 'run') u.animT = 0; u.anim = 'run'; }
    return false;
  }
  private idle(u: Unit) { if (u.anim === 'run' || u.animT > 12) { if (u.anim !== 'idle') u.animT = 0; u.anim = 'idle'; } }
  private fwd(u: Unit) { return u.side === 0 ? 1 : -1; }
  /** x measured from our own fort toward theirs */
  private depth(u: { x: number }, side: Side) { return side === 0 ? u.x : FW - u.x; }
  private atDepth(side: Side, d: number) { return side === 0 ? d : FW - d; }

  private think(u: Unit) {
    u.animT++;
    if (u.ko > 0) {
      if (this.over) return;
      if (u.reviving > 0) return;
      if (--u.ko === 0) { const f = this.forts[u.side]; u.x = f.x + this.fwd(u) * 22; u.y = clamp(f.y + (u.slot - 2) * 16, 10, FH - 10); u.px = u.x; u.py = u.y; u.hp = Math.round(u.maxHp * 0.75); u.anim = 'idle'; u.animT = 0; this.events.push({ k: 'respawn', side: u.side, u: u.id }); }
      return;
    }
    if (this.over) return;
    if (u.cd > 0) u.cd--;
    if (u.spec > 0) u.spec--;
    if (u.bury > 0) u.bury--;
    if (u.stun > 0) { u.stun--; u.anim = 'stun'; if (u.stun === 0) { u.anim = 'idle'; u.animT = 0; } return; }
    if (u.tunnel > 0) { this.tunnelStep(u); return; }
    if (u.cheer > 0) { u.cheer--; u.anim = 'cheer'; return; }
    if (u.tele > 0) { if (--u.tele === 0) this.special(u); else return; return; }
    // make snowballs when out
    if (u.ammo <= 0) {
      if (++u.make >= MAKE[u.role] * (this.weather === 'snow' ? 0.7 : 1)) { u.make = 0; u.ammo = Math.min(u.maxAmmo, u.role === 'digger' ? 2 : 1 + (u.p.aim >= 7 ? 1 : 0)); }
    }
    // the medic's revive channel
    if (u.role === 'medic' && u.work > 0 && u.revivedBy >= 0) {
      const v = this.units[u.revivedBy];
      if (v.ko > 0 && this.dist(u, v) < 16) { u.anim = 'heal'; if (--u.work === 0) { this.revive(v, u, 0.5); u.revivedBy = -1; } return; }
      u.work = 0; u.revivedBy = -1; v.reviving = 0;
    }
    // a digger buries anyone who comes too close, scouts for longest
    if (u.bury === 0 && (u.role === 'digger')) {
      const near = this.enemies(u).filter((e) => this.dist(u, e) < (e.role === 'scout' ? DIG_SCOUT_REACH : 22) && e.stun === 0).sort((a, b) => (a.role === 'scout' ? 0 : 1) - (b.role === 'scout' ? 0 : 1))[0];
      if (near) {
        const long = near.role === 'scout' ? 70 : 22;
        near.stun = Math.round(long * (1.15 - near.p.grit * 0.03)); near.anim = 'stun'; near.tele = 0;
        u.bury = 110; u.anim = 'dig'; u.animT = 0; u.stats.buries++;
        this.damage(near, u, 6 + u.p.aim * 0.4, false);
        this.events.push({ k: 'bury', side: near.side, u: near.id, by: u.id });
        if (near.role === 'scout' && this.r() < 0.5) this.say(u.side, `${u.name} buries ${this.label(near)} in a snow pile!`);
        return;
      }
    }
    if (this.trySpecial(u)) return;
    switch (u.role) {
      case 'thrower': this.thrower(u); break;
      case 'digger': this.digger(u); break;
      case 'builder': this.builder(u); break;
      case 'scout': this.scout(u); break;
      case 'medic': this.medic(u); break;
    }
  }
  label(u: Unit) { return u.side === 0 ? u.name : `${u.name} the ${SPECIES_NAME[u.p.species]}`; }
  private modeOf(u: Unit) { return this.mode[u.side]?.kind ?? null; }
  private protectee(u: Unit) { const m = this.mode[u.side]; return m?.kind === 'protect' && m.target !== undefined ? this.units[m.target] : null; }
  /** where the team holds by default: how far out from its own fort the front line sits */
  private frontLine(side: Side) {
    const tac = this.tactics[side], m = this.mode[side]?.kind;
    if (m === 'hold') return 95;
    if (m === 'attack') return 290;
    const base = tac === 'push' ? 215 : tac === 'guard' ? 140 : 180;
    // the line creeps forward as the match goes on, and further when we have more players up
    const phase = this.phase === 'opening' ? 0 : this.phase === 'pressure' ? 35 : this.phase === 'comeback' ? 70 : 100;
    return base + phase + clamp(this.up(side) - this.up((1 - side) as Side), -2, 3) * 30;
  }
  private targetScore(u: Unit, e: Unit) {
    let s = 100 - this.dist(u, e) * 0.25 + (1 - this.hurt(e)) * 40;
    if (beats(u.role, e.role)) s += 35;
    if (u.role === 'scout' && (e.role === 'medic' || e.role === 'thrower')) s += 18;
    if (beats(e.role, u.role)) s -= 12;
    // anyone at our fort is the first job
    if (Math.abs(e.x - this.forts[u.side].x) < 70) s += 45;
    return s;
  }
  private bestTarget(u: Unit, range: number) {
    if (this.weather === 'fog') range *= 0.8;
    let best: Unit | null = null, bs = -1e9;
    for (const e of this.enemies(u)) {
      const d = this.dist(u, e); if (d > range) continue;
      const s = this.targetScore(u, e); if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  private nearestEnemy(u: Unit) { let best: Unit | null = null, bd = 1e9; for (const e of this.enemies(u)) { const d = this.dist(u, e); if (d < bd) { bd = d; best = e; } } return best ? { e: best, d: bd } : null; }
  private enemyFort(u: Unit) { return this.forts[1 - u.side]; }
  private fortPoint(f: Fort) { return { x: f.x, y: f.y }; }
  private retreat(u: Unit) {
    const f = this.forts[u.side], medic = this.friends(u).find((m) => m.role === 'medic' && m.ko === 0);
    if (medic) return this.moveTo(u, medic.x - this.fwd(u) * 10, medic.y);
    return this.moveTo(u, f.x + this.fwd(u) * 30, clamp(u.y, 20, FH - 20));
  }

  private thrower(u: Unit) {
    const range = RANGE.thrower + u.p.aim * 2, guard = this.protectee(u);
    if (this.hurt(u) < 0.3 && this.modeOf(u) !== 'attack') { if (this.canThrow(u)) { const t = this.bestTarget(u, range); if (t) return this.throwAt(u, t); } return this.retreat(u); }
    const near = this.nearestEnemy(u);
    if (near && near.d < 48 && near.e.role !== 'medic' && this.modeOf(u) !== 'attack') {
      // kite: back off from anyone close, toward home
      const f = this.forts[u.side];
      if (this.canThrow(u)) return this.throwAt(u, near.e);
      return this.moveTo(u, u.x - this.fwd(u) * 10, u.y + (u.y < f.y ? -4 : 4));
    }
    const t = this.bestTarget(u, range);
    const fort = this.enemyFort(u), fd = Math.abs(fort.x - u.x);
    if (this.canThrow(u) && this.fortTurn(u, fd)) return this.throwFort(u);
    if (t && this.modeOf(u) !== 'attack') { if (this.canThrow(u)) return this.throwAt(u, t); return this.idle(u); }
    if (fd < range - 10 && (this.modeOf(u) === 'attack' || !t)) { if (this.canThrow(u)) return this.throwFort(u); return this.idle(u); }
    if (t && this.canThrow(u)) return this.throwAt(u, t);
    // advance to the front line, keeping a lane
    const fortLine = this.depth({ x: fort.x }, u.side) - range + 25;
    const clear = !this.enemies(u).some((e) => this.dist(u, e) < range + 30);
    const line = clear ? fortLine : Math.min(this.frontLine(u.side) - 30 + this.quirk(u), fortLine);
    const ty = guard && guard !== u ? guard.y : 25 + u.slot * 25;
    if (this.moveTo(u, this.atDepth(u.side, Math.max(60, line)), ty)) this.idle(u);
  }
  private digger(u: Unit) {
    const fort = this.enemyFort(u), m = this.modeOf(u);
    if (this.hurt(u) < 0.28 && m !== 'attack') return this.retreat(u);
    if (m === 'hold') {
      const t = this.bestTarget(u, RANGE.digger + 30);
      if (t && this.canThrow(u)) return this.throwAt(u, t);
      if (this.moveTo(u, this.atDepth(u.side, 90), 40 + u.slot * 18)) this.idle(u);
      return;
    }
    const d = Math.hypot(fort.x - u.x, fort.y - u.y);
    if (d < 30) {
      // dig at their fort
      u.face = fort.x > u.x ? 1 : -1;
      if (u.anim !== 'dig') { u.anim = 'dig'; u.animT = 0; }
      if (++u.work >= DIG_TICKS) { u.work = 0; this.hitFort(fort, u, (DIG_DMG + u.p.aim * 0.15 + u.p.grit * 0.1) * this.power(u), fort.x - this.fwd(u) * 10, fort.y + (u.y - fort.y) * 0.5); }
      return;
    }
    // throw at anything close on the way (a scout in reach of a flick of snow first)
    const sc = this.enemies(u).filter((e) => e.role === 'scout' && this.dist(u, e) < RANGE.digger + DIG_SCOUT_RANGE).sort((a, b) => this.dist(u, a) - this.dist(u, b))[0];
    const t = sc ?? this.bestTarget(u, RANGE.digger);
    if (t && this.canThrow(u)) return this.throwAt(u, t);
    // wait for the moment in a guarded game; rush in a push
    const tac = this.tactics[u.side];
    if (tac === 'guard' && m !== 'attack' && this.t < 20 * TICK) { if (this.moveTo(u, this.atDepth(u.side, 120), 30 + u.slot * 22)) this.idle(u); return; }
    this.moveTo(u, fort.x - this.fwd(u) * 22, fort.y + ((u.slot % 2) ? 12 : -12));
  }
  private builder(u: Unit) {
    const own = this.forts[u.side], m = this.modeOf(u), guard = this.protectee(u);
    const nearE = this.nearestEnemy(u);
    // patch our fort when it's hurt and nobody is in our face
    const dmg = own.max - this.fortHp(u.side);
    if (dmg > 20 && (!nearE || nearE.d > 70) && m !== 'attack' && (m === 'hold' || Math.abs(u.x - own.x) < 40 || (this.t % 240 < 70))) {
      if (Math.hypot(u.x - own.x, u.y - own.y) < 32) { if (u.anim !== 'build') { u.anim = 'build'; u.animT = 0; } this.repair(own, u, (m === 'hold' ? REPAIR * 2 : REPAIR) * (0.6 + u.p.grit * 0.06)); return; }
      this.moveTo(u, own.x + this.fwd(u) * 26, own.y + (u.slot % 2 ? 10 : -10)); return;
    }
    // the shield: a snow wall the builder pushes along in front of them
    let sh = this.walls.find((w) => w.id === u.shield && w.hp > 0);
    if (!sh) {
      if (u.anim !== 'build') { u.anim = 'build'; u.animT = 0; }
      if (++u.work >= (m === 'hold' ? 20 : 34)) { u.work = 0; sh = this.raiseWall(u, u.x + this.fwd(u) * 12, u.y, 46 + u.p.grit * 4); u.shield = sh.id; }
      return;
    }
    const foes = this.enemies(u);
    // hunt their throwers behind the shield (or guard the one to protect, or hold near the fort)
    const shooters = foes.filter((e) => e.role === 'thrower').sort((a, b) => this.dist(u, a) - this.dist(u, b));
    let goal: { x: number; y: number } | null = null;
    if (guard && guard !== u) goal = { x: guard.x + this.fwd(u) * 18, y: guard.y };
    else if (m === 'hold') goal = { x: this.atDepth(u.side, 75), y: clamp(nearE ? nearE.e.y : own.y, 20, FH - 20) };
    else if (shooters.length) { const th = shooters[0]; const d = this.dist(u, th); goal = d > RANGE.builder - 25 ? { x: th.x, y: th.y } : null; u.face = th.x > u.x ? 1 : -1; }
    else goal = { x: this.atDepth(u.side, Math.min(this.frontLine(u.side) - 20, 260)), y: clamp(nearE ? nearE.e.y : FH / 2, 20, FH - 20) };
    const t = shooters.length && this.dist(u, shooters[0]) < RANGE.builder ? shooters[0] : this.bestTarget(u, RANGE.builder);
    if (t && this.canThrow(u)) this.throwAt(u, t);
    else if (goal) { if (this.moveTo(u, goal.x, goal.y, this.speedOf(u) * 0.9)) this.idle(u); }
    else this.idle(u);
    sh.x = clamp(u.x + u.face * 11, 30, FW - 30); sh.y = u.y; sh.up = Math.max(sh.up, 0.6);
  }
  private scout(u: Unit) {
    const m = this.modeOf(u);
    if (this.hurt(u) < 0.35 && m !== 'attack') return this.retreat(u);
    const range = RANGE.scout;
    // stay away from diggers
    const dig = this.enemies(u).find((e) => e.role === 'digger' && this.dist(u, e) < 34 && e.bury === 0);
    if (dig) return this.moveTo(u, u.x + (u.x - dig.x) * 2, u.y + (u.y - dig.y) * 2);
    const t = this.bestTarget(u, range);
    if (this.canThrow(u) && this.fortTurn(u, Math.abs(this.enemyFort(u).x - u.x))) return this.throwFort(u);
    if (t && this.canThrow(u)) return this.throwAt(u, t);
    if (m === 'hold') { if (this.moveTo(u, this.atDepth(u.side, 110), u.slot % 2 ? 30 : FH - 30)) this.idle(u); return; }
    // flank: run the edge to beyond their middle, then hunt the backline
    const edge = u.slot % 2 ? 14 : FH - 14;
    const back = this.enemies(u).filter((e) => e.role !== 'digger').sort((a, b) => this.targetScore(u, b) - this.targetScore(u, a))[0];
    const deep = this.depth(u, u.side);
    if (deep < 230 && !(back && this.dist(u, back) < range + 30)) { this.moveTo(u, this.atDepth(u.side, deep + 40), edge); return; }
    const fort = this.enemyFort(u);
    if (Math.abs(fort.x - u.x) < range && this.canThrow(u) && !(back && this.dist(u, back) < range)) return this.throwFort(u);
    if (back) { const d = this.dist(u, back); if (d > range - 15) this.moveTo(u, back.x, back.y); else this.idle(u); return; }
    if (Math.abs(fort.x - u.x) < range && this.canThrow(u)) return this.throwFort(u);
    this.moveTo(u, fort.x - this.fwd(u) * (range - 20), edge);
  }
  private medic(u: Unit) {
    const allies = this.friends(u), guard = this.protectee(u);
    // wake anyone knocked out nearby
    const down = allies.filter((a) => a.ko > 0 && a.reviving === 0 && this.dist(u, a) < 120).sort((a, b) => this.dist(u, a) - this.dist(u, b))[0];
    if (down) {
      if (this.dist(u, down) < 14) { u.work = 40; u.revivedBy = down.id; down.reviving = 1; u.anim = 'heal'; u.animT = 0; return; }
      this.moveTo(u, down.x, down.y); return;
    }
    const hurt = (guard && guard !== u && guard.ko === 0 ? [guard] : allies.filter((a) => a.ko === 0 && a.tunnel === 0 && this.hurt(a) < 0.85).sort((a, b) => this.hurt(a) - this.hurt(b)));
    const h = hurt[0];
    if (h) {
      const d = this.dist(u, h);
      if (d < 26) { const amt = (0.3 + u.p.grit * 0.025) * this.power(u); if (h.hp < h.maxHp) { h.hp = Math.min(h.maxHp, h.hp + amt); u.stats.heal += amt; } if (u.anim !== 'heal') { u.anim = 'heal'; u.animT = 0; } return; }
      this.moveTo(u, h.x - this.fwd(u) * 12, h.y); return;
    }
    if (this.hurt(u) < 0.95) u.hp = Math.min(u.maxHp, u.hp + 0.12);
    const t = this.bestTarget(u, RANGE.medic);
    if (t && this.canThrow(u)) return this.throwAt(u, t);
    // hang behind the middle of the team
    const live = allies.filter((a) => a.ko === 0);
    const cx = live.length ? live.reduce((s, a) => s + a.x, 0) / live.length : u.x, cy = live.length ? live.reduce((s, a) => s + a.y, 0) / live.length : u.y;
    if (this.moveTo(u, cx - this.fwd(u) * (30 - this.quirk(u)), cy)) this.idle(u);
  }
  /** a fort is a big target: throwers and scouts lob at it from further off, more often as the match goes on */
  private fortTurn(u: Unit, fd: number) {
    if (fd > FORT_RANGE[u.role]) return false;
    const m = this.modeOf(u); if (m === 'hold') return false;
    const share = m === 'attack' ? 0.9 : this.phase === 'opening' ? 0.1 : this.phase === 'pressure' ? FORT_SHARE : this.phase === 'comeback' ? FORT_SHARE + 0.15 : FORT_SHARE + 0.3;
    return this.r() < share;
  }
  /** personality on the pitch: shy players hang back, hotheads and show-offs creep forward */
  private quirk(u: Unit) { const p = u.p.personality; return p === 'shy' ? -18 : p === 'hothead' ? 14 : p === 'showoff' ? 8 : 0; }

  // ------------------------------------------------ specials
  private trySpecial(u: Unit) {
    if (u.spec > 0) return false;
    const foes = this.enemies(u), allies = this.friends(u);
    let go = false;
    switch (u.role) {
      case 'thrower': {
        const r = RANGE.thrower;
        const fort = this.enemyFort(u);
        go = foes.some((e) => this.dist(u, e) < r && foes.filter((o) => this.dist(o, e) < 26).length >= 2) || (Math.abs(fort.x - u.x) < r - 10 && this.modeOf(u) !== 'hold');
        break;
      }
      case 'digger': go = (Math.abs(this.enemyFort(u).x - u.x) > 150 && this.modeOf(u) !== 'hold' && this.depth(u, u.side) > 70) || !!this.scoutPrey(u); break;
      case 'builder': go = this.hurt(u) < 0.6 || foes.filter((e) => this.dist(u, e) < 130 && (e.role === 'thrower' || e.role === 'scout')).length >= 2; break;
      case 'scout': go = foes.filter((e) => this.dist(u, e) < 34).length >= 2 || (foes.some((e) => this.dist(u, e) < 30) && this.hurt(u) < 0.5); break;
      case 'medic': go = allies.filter((a) => (a.ko > 0 || (this.hurt(a) < 0.6 && a.tunnel === 0)) && this.dist(u, a) < 60).length >= 2 || allies.some((a) => a.ko > 0 && this.dist(u, a) < 50); break;
    }
    if (!go) return false;
    u.tele = 20; u.teleKind = u.role; u.anim = 'special'; u.animT = 0;
    this.events.push({ k: 'tele', side: u.side, u: u.id, role: u.role });
    return true;
  }
  private special(u: Unit) {
    u.spec = u.specMax; u.stats.specials++; u.anim = 'special'; u.animT = 0; u.teleKind = null;
    this.events.push({ k: 'special', side: u.side, u: u.id, role: u.role });
    const foes = this.enemies(u), allies = this.friends(u);
    switch (u.role) {
      case 'thrower': {
        const t = this.bestTarget(u, RANGE.thrower + 20);
        const fort = this.enemyFort(u);
        if (t && (foes.filter((o) => this.dist(o, t) < 26).length >= 2 || Math.abs(fort.x - u.x) > RANGE.thrower)) this.launch(u, t.x, t.y, t.id, false, 1.7, true, false);
        else this.launch(u, fort.x, fort.y, -1, true, 2.4, true, false);
        u.cd = CD.thrower;
        break;
      }
      case 'digger': { const prey = this.scoutPrey(u); u.tunnel = 1; u.anim = 'tunnel'; u.prey = prey ? prey.id : -1; this.say(u.side, prey ? `${this.label(u)} tunnels after ${this.label(prey)}!` : `${this.label(u)} dives into a ${SPECIAL.digger.name}!`); break; }
      case 'builder': {
        this.raiseWall(u, u.x + this.fwd(u) * 14, u.y, 90 + u.p.grit * 4, true);
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
        this.say(u.side, `${this.label(u)} throws up an ${SPECIAL.builder.name}!`);
        break;
      }
      case 'scout': {
        const hit = foes.filter((e) => this.dist(u, e) < 38);
        let kos = 0;
        for (const e of hit) if (this.damage(e, u, (12 + u.p.aim * 1.6) * this.power(u), true)) kos++;
        if (kos >= 2) this.say(u.side, `${this.label(u)}’s spin throw KOs ${kos === 2 ? 'two' : kos === 3 ? 'three' : kos} ${u.side === 0 ? this.names[1] : 'of ours'}!`);
        else if (hit.length) this.say(u.side, `${this.label(u)}’s ${SPECIAL.scout.name} catches ${hit.length === 1 ? this.label(hit[0]) : `${hit.length} at once`}!`);
        break;
      }
      case 'medic': {
        let woke = 0;
        for (const a of [u, ...allies]) {
          if (this.dist(u, a) > 64) continue;
          if (a.ko > 0) { this.revive(a, u, 0.6); woke++; } else { const amt = a.maxHp * 0.4; u.stats.heal += Math.min(amt, a.maxHp - a.hp); a.hp = Math.min(a.maxHp, a.hp + amt); }
        }
        this.say(u.side, woke ? `${this.label(u)}’s ${SPECIAL.medic.name} wakes ${woke === 1 ? 'a teammate' : `${woke} teammates`}!` : `${this.label(u)} hands round a ${SPECIAL.medic.name}.`);
        break;
      }
    }
  }
  /** a scout worth tunnelling after: close enough, out in the open */
  private scoutPrey(u: Unit) { return this.enemies(u).filter((e) => e.role === 'scout' && e.stun === 0 && this.dist(u, e) < 170).sort((a, b) => this.dist(u, a) - this.dist(u, b))[0] ?? null; }
  private tunnelStep(u: Unit) {
    u.tunnel++; u.anim = 'tunnel';
    const prey = u.prey >= 0 ? this.units[u.prey] : null;
    if (prey && (prey.ko > 0 || prey.tunnel > 0)) u.prey = -1;
    if (u.prey >= 0 && prey) {
      // up under the scout: buried, and a counter hit
      const done = this.moveTo(u, prey.x, prey.y, 3.4) || u.tunnel > 120;
      u.anim = 'tunnel';
      if (!done) return;
      u.tunnel = 0; u.anim = 'special'; u.animT = 0; u.prey = -1;
      if (this.dist(u, prey) < 14) {
        prey.stun = Math.max(prey.stun, 80); prey.anim = 'stun'; prey.tele = 0; u.stats.buries++;
        this.events.push({ k: 'bury', side: prey.side, u: prey.id, by: u.id });
        this.damage(prey, u, (9 + u.p.grit * 0.8) * this.power(u), true);
        this.say(u.side, `${this.label(u)} pops up under ${this.label(prey)}: buried!`);
      }
      return;
    }
    const fort = this.enemyFort(u), tx = fort.x - this.fwd(u) * 20, ty = fort.y + (u.slot % 2 ? 10 : -10);
    const done = this.moveTo(u, tx, ty, 3.2) || u.tunnel > 150;
    u.anim = 'tunnel';
    if (done) {
      u.tunnel = 0; u.anim = 'special'; u.animT = 0;
      this.hitFort(fort, u, (11 + u.p.grit) * this.power(u), fort.x, fort.y);
      for (const e of this.enemies(u)) if (this.dist(u, e) < 30) { e.stun = Math.max(e.stun, 28); e.tele = 0; }
      this.say(u.side, `${this.label(u)} pops up under the ${u.side === 0 ? this.names[1] : 'our'} fort!`);
    }
  }

  // ------------------------------------------------ throws
  private canThrow(u: Unit) { return u.cd === 0 && u.ammo > 0; }
  private throwAt(u: Unit, e: Unit) {
    u.face = e.x > u.x ? 1 : -1;
    const big = false;
    const base = (8.5 + u.p.aim * 0.95) * this.power(u);
    this.launch(u, e.x, e.y, e.id, false, 1, big, u.role === 'scout');
    void base;
  }
  private throwFort(u: Unit) { const f = this.enemyFort(u); u.face = f.x > u.x ? 1 : -1; this.launch(u, f.x, f.y + (this.r() - 0.5) * 20, -1, true, 1, false, u.role === 'scout'); }
  private launch(u: Unit, tx: number, ty: number, target: number, fort: boolean, mult: number, big: boolean, lob: boolean) {
    u.cd = Math.round(CD[u.role] * (1.1 - u.p.speed * 0.02)); if (!big) u.ammo--;
    u.anim = 'throw'; u.animT = 0;
    const d = Math.hypot(tx - u.x, ty - u.y);
    let hitP = 1;
    if (!fort) {
      const e = this.units[target];
      const windK = this.weather === 'wind' ? ((tx - u.x) * this.wind > 0 ? 0.07 : -0.07) : 0;
      const fogK = this.weather === 'fog' ? -d / 900 - (e.role === 'scout' ? 0.06 : 0) : 0;
      hitP = clamp(0.5 + u.p.aim * 0.05 - e.p.speed * 0.022 - d / 700 + (big ? 0.15 : 0) - (e.role === 'scout' ? 0.05 : 0) + windK + fogK, 0.18, 0.95);
    } else hitP = clamp(0.72 + u.p.aim * 0.03, 0.6, 0.98);
    const hit = this.r() < hitP;
    // walls in the way stop it, unless it's a scout's lob
    let wall = -1;
    if (!lob) {
      let best = 1e9;
      for (const w of this.walls) {
        if (w.side === u.side || w.up < 0.5) continue;
        if ((w.x - u.x) * (tx - w.x) <= 0) continue; // not between
        const k = (w.x - u.x) / (tx - u.x); const y = u.y + (ty - u.y) * k;
        if (Math.abs(y - w.y) <= WALL_HALF && Math.abs(w.x - u.x) < best) { best = Math.abs(w.x - u.x); wall = w.id; }
      }
    }
    let ex = tx, ey = ty;
    if (wall >= 0) { const w = this.walls.find((q) => q.id === wall)!; ex = w.x; ey = u.y + (ty - u.y) * ((w.x - u.x) / (tx - u.x)); }
    const dmg = (8.5 + u.p.aim * 0.95) * ROLE_DMG[u.role] * this.power(u) * mult * (u.p.personality === 'hothead' && u.p.morale > 70 ? 1.1 : 1);
    const dur = Math.max(8, Math.round(Math.hypot(ex - u.x, ey - u.y) / (lob ? 4.2 : 5.5)));
    this.balls.push({ id: this.seq++, side: u.side, from: u.id, x0: u.x + u.face * 4, y0: u.y - 6, tx: ex, ty: ey, target, fort, wall, t: 0, dur, dmg, hit, big, lob });
    this.events.push({ k: 'throw', side: u.side, u: u.id, big, lob });
  }
  private flyBalls() {
    const keep: Ball[] = [];
    for (const b of this.balls) {
      b.t++;
      // a ball at a player follows them a little (it was aimed with a lead)
      if (!b.fort && b.wall < 0 && b.target >= 0) { const e = this.units[b.target]; if (e.ko === 0 && e.tunnel === 0) { b.tx += (e.x - b.tx) * 0.25; b.ty += (e.y - b.ty) * 0.25; } }
      if (b.t < b.dur) { keep.push(b); continue; }
      const from = this.units[b.from];
      if (b.wall >= 0) {
        const w = this.walls.find((q) => q.id === b.wall);
        if (w && w.hp > 0) {
          w.hp -= b.dmg * (b.big ? 1.5 : 1) * 0.8;
          const by = this.units[w.by]; by.stats.blocked++;
          this.events.push({ k: 'wallhit', side: w.side, wall: w.id, x: b.tx, y: b.ty, broke: w.hp <= 0 });
          continue;
        }
        // the wall went: carry on to the target
        if (b.target >= 0 || b.fort) { b.wall = -1; const e = b.target >= 0 ? this.units[b.target] : null; const f = this.forts[1 - b.side]; b.x0 = b.tx; b.y0 = b.ty; b.tx = e ? e.x : f.x; b.ty = e ? e.y : f.y; b.t = 0; b.dur = 8; keep.push(b); continue; }
      }
      if (b.fort) {
        const f = this.forts[1 - b.side];
        if (b.hit) this.hitFort(f, from, b.dmg * (b.big ? 1 : 0.55), b.tx, b.ty);
        else this.events.push({ k: 'miss', x: b.tx, y: b.ty });
        continue;
      }
      const e = this.units[b.target];
      if (b.big) {
        let kos = 0, n = 0;
        for (const o of this.units) if (o.side !== b.side && o.ko === 0 && o.tunnel === 0 && Math.hypot(o.x - b.tx, o.y - b.ty) < 26) { n++; if (this.damage(o, from, b.dmg * (o === e ? 1 : 0.7), true)) kos++; }
        if (n === 0) this.events.push({ k: 'miss', x: b.tx, y: b.ty });
        if (kos >= 2) this.say(b.side, `${this.label(from)}’s ${SPECIAL.thrower.name} KOs ${kos === 2 ? 'two' : kos} at once!`);
        continue;
      }
      if (b.hit && e.ko === 0 && e.tunnel === 0) this.damage(e, from, b.dmg, false);
      else this.events.push({ k: 'miss', x: b.tx, y: b.ty });
    }
    this.balls = keep;
  }
  /** returns true if it knocked them out */
  private damage(e: Unit, by: Unit, dmg: number, special: boolean) {
    const counter = beats(by.role, e.role);
    let d = dmg * (counter ? COUNTER_HIT : 1) * (beats(e.role, by.role) ? COUNTER_TAKE : 1);
    const m = this.mode[e.side];
    if (m?.kind === 'hold') d *= 0.85;
    if (m?.kind === 'protect' && m.target === e.id) d *= 0.6;
    if (e.role === 'builder' && by.role !== 'scout') d *= 0.9;
    e.hp -= d; by.stats.dmg += d;
    this.events.push({ k: 'hit', side: e.side, u: e.id, by: by.id, dmg: d, counter, x: e.x, y: e.y });
    if (e.hp <= 0) {
      e.hp = 0; e.ko = 4 * TICK; e.anim = 'ko'; e.animT = 0; e.tele = 0; e.stun = 0; e.work = 0; e.reviving = 0;
      by.stats.kos++; e.stats.ko++;
      this.events.push({ k: 'ko', side: e.side, u: e.id, by: by.id, special });
      this.gain(by.side, 18);
      if (KO_FORT > 0) this.hitFort(this.forts[e.side], by, KO_FORT, this.forts[e.side].x, this.forts[e.side].y - 6, true);
      if (by.p.personality === 'showoff' && by.tele === 0 && by.tunnel === 0) { by.cheer = 24; by.anim = 'cheer'; by.animT = 0; this.events.push({ k: 'cheer', side: by.side, u: by.id }); }
      if (this.phase === 'final' && !this.clutchSaid && (by.p.personality === 'steady' || by.p.morale >= 75)) { this.clutchSaid = true; this.say(by.side, `Clutch! ${this.label(by)} keeps cool when it matters.`); }
      else if (!special && this.r() < 0.6) this.say(by.side, counter ? `${this.label(by)} KOs ${this.label(e)}: ${ROLE_NAME[by.role].toLowerCase()} beats ${ROLE_NAME[e.role].toLowerCase()}!` : signature(this.label(by), this.label(e), by.p.personality, this.r));
      return true;
    }
    return false;
  }
  private revive(v: Unit, by: Unit, share: number) {
    v.ko = 0; v.reviving = 0; v.hp = Math.round(v.maxHp * share); v.anim = 'idle'; v.animT = 0;
    by.stats.heal += v.hp; this.gain(by.side, 8);
    this.events.push({ k: 'revive', side: v.side, u: v.id, by: by.id });
    if (this.r() < 0.6) this.say(by.side, `${this.label(by)} wakes ${this.label(v)} up!`);
  }
  private gain(side: Side, n: number) { if (this.surge[side] > 0) return; const cheery = this.units.some((u) => u.side === side && u.p.personality === 'cheery' && u.ko === 0); this.momentum[side] = Math.min(100, this.momentum[side] + n * (cheery ? 1.2 : 1)); }
  private hitFort(f: Fort, by: Unit, dmg: number, x: number, y: number, shake = false) {
    const i = f.blocks.findIndex((b) => b > 0); if (i < 0) return;
    const before = this.blocksLeft(f.side);
    let left = dmg, j = i, knocked = false;
    while (left > 0 && j < f.blocks.length) {
      const take = Math.min(left, f.blocks[j]); f.blocks[j] -= take; left -= take;
      if (f.blocks[j] <= 0) { f.blocks[j] = 0; knocked = true; by.stats.blocks++; j++; } else break;
    }
    by.stats.fort += dmg;
    if (knocked) { this.gain(by.side, 9); this.lastKnockBy[by.side] = this.t; }
    this.events.push({ k: 'fort', side: f.side, dmg, x, y, block: i, knocked, by: by.id, shake });
    const after = this.blocksLeft(f.side);
    if (knocked && after <= 3 && before > 3) this.say(by.side, by.side === 0 ? `The ${this.names[1]}’ tower is wobbling!` : 'Our tower is wobbling!');
  }
  private repair(f: Fort, by: Unit, amt: number) {
    // the last block knocked (or the first damaged) gets patched first
    let j = f.blocks.findIndex((b) => b > 0); if (j < 0) return;
    if (f.blocks[j] >= BLOCK_HP && j > 0) j--;
    if (f.blocks[j] >= BLOCK_HP) return;
    const was = f.blocks[j];
    f.blocks[j] = Math.min(BLOCK_HP, f.blocks[j] + amt);
    by.stats.fix += amt;
    if (was <= 0 && f.blocks[j] > 0) this.events.push({ k: 'repair', side: f.side, block: j });
  }
  private raiseWall(u: Unit, x: number, y: number, hp: number, igloo = false): Wall {
    const w: Wall = { id: this.seq++, side: u.side, by: u.id, x: clamp(x, 40, FW - 40), y: clamp(y, 16, FH - 16), hp, max: hp, up: igloo ? 0.6 : 0 };
    const mine = this.walls.filter((q) => q.side === u.side && !this.units.some((b) => b.shield === q.id));
    if (igloo && mine.length >= 3) mine[0].hp = 0;
    this.walls.push(w);
    this.events.push({ k: 'wall', side: u.side, u: u.id, wall: w.id });
    return w;
  }
  private separate() {
    const us = this.units;
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j]; if (a.ko || b.ko || a.tunnel || b.tunnel) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 11) { const k = (11 - d) / d * 0.25; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
  }
  /** the player of the match: the most useful by KOs, fort damage, heals and walls */
  mvp(side?: Side) {
    const score = (u: Unit) => u.stats.kos * 10 + u.stats.fort * 0.45 + u.stats.heal * 0.12 + u.stats.fix * 0.06 + u.stats.blocked * 2 + u.stats.buries * 4 + u.stats.dmg * 0.05 - u.stats.ko * 2;
    return [...this.units].filter((u) => side === undefined || u.side === side).sort((a, b) => score(b) - score(a))[0];
  }
  /** run to the end (the skip button and the season's other matches) */
  run() { while (!this.over) this.step(); return this; }
}
export const moraleFactor = (m: number) => 0.86 + 0.28 * clamp(m, 0, 100) / 100;
const SIGNATURE: Record<Personality, string[]> = {
  hothead: ['{a} charges in and flattens {b}!', '{a} roars and bowls over {b}!'],
  steady: ['{a} calmly KOs {b}.', 'Cool as ice: {a} takes out {b}.'],
  shy: ['Quiet little {a} picks off {b}!', '{a} peeks out and bonks {b}!'],
  showoff: ['{a} KOs {b} and takes a bow!', '{a} flattens {b}, then waves to the crowd!'],
  cheery: ['{a} giggles and bonks {b}!', '{a} KOs {b} with a big grin!'],
};
function signature(a: string, b: string, p: Personality, r: Rand) { return pick(r, SIGNATURE[p]).replace('{a}', a).replace('{b}', b); }

// ---------------------------------------------------------------- the draft
export type DraftAct = { side: Side; kind: 'ban' | 'pick' };
/** bans first (one each, from the other squad), then picks 1-2-2, a ban each (their squad or the middle), then 2-2-1 */
export function draftOrder(first: Side): DraftAct[] {
  const a = first, b = (1 - first) as Side;
  return [
    { side: a, kind: 'ban' }, { side: b, kind: 'ban' },
    { side: a, kind: 'pick' }, { side: b, kind: 'pick' }, { side: b, kind: 'pick' }, { side: a, kind: 'pick' }, { side: a, kind: 'pick' },
    { side: a, kind: 'ban' }, { side: b, kind: 'ban' },
    { side: b, kind: 'pick' }, { side: b, kind: 'pick' }, { side: a, kind: 'pick' }, { side: a, kind: 'pick' }, { side: b, kind: 'pick' },
  ];
}
export type Draft = { squads: [Player[], Player[]]; pool: Player[]; order: DraftAct[]; step: number; picks: [string[], string[]]; bans: [string[], string[]]; names: [string, string] };
export function newDraft(us: Player[], them: Player[], pool: Player[], first: Side, names: [string, string] = ['Snowcats', 'Rivals']): Draft {
  return { squads: [us, them], pool, order: draftOrder(first), step: 0, picks: [[], []], bans: [[], []], names };
}
export const draftDone = (d: Draft) => d.step >= d.order.length;
export const draftTurn = (d: Draft) => d.order[d.step] ?? null;
const allBans = (d: Draft) => [...d.bans[0], ...d.bans[1]];
const allPicks = (d: Draft) => [...d.picks[0], ...d.picks[1]];
export const findCard = (d: Draft, id: string) => [...d.squads[0], ...d.squads[1], ...d.pool].find((p) => p.id === id) ?? null;
/** cards a side may pick now: its own squad plus the middle, minus anything banned or taken */
export function pickable(d: Draft, side: Side) {
  const gone = new Set([...allBans(d), ...allPicks(d)]);
  return [...d.squads[side], ...d.pool].filter((p) => !gone.has(p.id));
}
/** cards a side may ban now: the other squad's (first ban) and also the middle (second ban) */
export function bannable(d: Draft, side: Side) {
  const gone = new Set([...allBans(d), ...allPicks(d)]), other = (1 - side) as Side;
  const first = d.bans[side].length === 0;
  const need = LINEUP - d.picks[other].length;
  const cards = [...d.squads[other], ...(first ? [] : d.pool)].filter((p) => !gone.has(p.id));
  // never ban them below a full team
  return cards.filter((p) => pickable(d, other).length - 1 >= need || !pickable(d, other).some((q) => q.id === p.id));
}
export function legal(d: Draft, id: string) {
  const turn = draftTurn(d); if (!turn) return false;
  return (turn.kind === 'pick' ? pickable(d, turn.side) : bannable(d, turn.side)).some((p) => p.id === id);
}
export function act(d: Draft, id: string) {
  if (!legal(d, id)) return false;
  const turn = draftTurn(d)!;
  (turn.kind === 'pick' ? d.picks : d.bans)[turn.side].push(id);
  d.step++;
  // a skipped ban when nothing can be banned
  while (!draftDone(d) && draftTurn(d)!.kind === 'ban' && bannable(d, draftTurn(d)!.side).length === 0) d.step++;
  return true;
}
export const lineupOf = (d: Draft, side: Side) => d.picks[side].map((id) => findCard(d, id)!);

export type DraftStyle = 'random' | 'counter' | 'hint' | 'stats' | 'habit';
export type Advice = { id: string; why: string };
/** what the side can expect the other to field: their picks, then their likeliest remaining roles */
function theirRoles(d: Draft, side: Side) {
  const other = (1 - side) as Side;
  const picked = lineupOf(d, other).map((p) => p.role);
  const left = LINEUP - picked.length;
  const avail = pickable(d, other).filter((p) => !d.picks[side].includes(p.id)).sort((a, b) => rating(b) - rating(a));
  const likely = avail.slice(0, left).map((p) => p.role);
  return { picked, likely };
}
let W_COUNTER = 1;
const NEED: Record<Role, number> = { builder: 2.6, medic: 2.4, thrower: 2.2, digger: 1.8, scout: 1.4 };
function pickScore(d: Draft, side: Side, p: Player, style: DraftStyle, habit?: Habit) {
  const mine = lineupOf(d, side).map((q) => q.role);
  const have = mine.filter((r) => r === p.role).length;
  let s = rating(p) * 1.0 + (moraleFactor(p.morale) - 1) * 10;
  // a sound team: one of the core roles each, no piles of one thing
  s += have === 0 ? NEED[p.role] : have === 1 ? (p.role === 'thrower' || p.role === 'digger' ? 0.4 : p.role === 'medic' ? -2.5 : -0.8) : -3.5;
  if (style === 'stats') return rating(p) + (have === 0 ? 1 : -1);
  const { picked, likely } = theirRoles(d, side);
  for (const r of picked) { if (beats(p.role, r)) s += 1.7 * W_COUNTER; if (beats(r, p.role)) s -= 1.5 * W_COUNTER; }
  for (const r of likely) { if (beats(p.role, r)) s += 0.6 * W_COUNTER; if (beats(r, p.role)) s -= 0.5 * W_COUNTER; }
  if (habit) { const n = habit.likes.filter((r) => r === p.role).length; s += n * (have === 0 ? 2 : 1.2); }
  return s;
}
function banScore(d: Draft, side: Side, p: Player, habit?: Habit) {
  const other = (1 - side) as Side;
  const theirs = pickable(d, other);
  const sameRole = theirs.filter((q) => q.role === p.role).length;
  let s = rating(p) + (sameRole === 1 ? 2.2 : 0) + (p.loan ? -0.5 : 0);
  // ban what would counter what we've picked
  for (const r of lineupOf(d, side).map((q) => q.role)) if (beats(p.role, r)) s += 1.2;
  if (habit && habit.ban !== 'best') { if (p.role === habit.ban) s += 6; }
  return s;
}
/** one draft move for a side in a style: the move, and (for the Hint) a one-line reason */
export function advise(d: Draft, side: Side, style: DraftStyle, r: Rand = Math.random, habit?: Habit): Advice | null {
  const turn = draftTurn(d); if (!turn || turn.side !== side) return null;
  const opts = turn.kind === 'pick' ? pickable(d, side) : bannable(d, side);
  if (!opts.length) return null;
  if (style === 'random') return { id: pick(r, opts).id, why: '' };
  if (style === 'habit' && habit && r() > habit.smart) {
    // a rival coach's habit, with a little wobble
    const scored = opts.map((p) => ({ p, s: (turn.kind === 'pick' ? pickScore(d, side, p, 'stats', habit) + habit.likes.filter((x) => x === p.role).length * 1.5 : banScore(d, side, p, habit)) + r() * 1.2 }));
    scored.sort((a, b) => b.s - a.s); return { id: scored[0].p.id, why: '' };
  }
  const scored = opts.map((p) => ({ p, s: turn.kind === 'pick' ? pickScore(d, side, p, style === 'stats' ? 'stats' : 'counter', style === 'habit' ? habit : undefined) : banScore(d, side, p, style === 'habit' ? habit : undefined) }));
  scored.sort((a, b) => b.s - a.s);
  const best = scored[0].p;
  return { id: best.id, why: style === 'hint' ? reason(d, side, best, turn.kind) : '' };
}
function reason(d: Draft, side: Side, p: Player, kind: 'pick' | 'ban') {
  const other = (1 - side) as Side, them = d.names[other];
  if (kind === 'ban') {
    const theirs = pickable(d, other), same = theirs.filter((q) => q.role === p.role).length;
    if (same === 1 && !p.loan) return `Ban ${p.name}: their only ${ROLE_NAME[p.role].toLowerCase()}.`;
    if (p.loan) return `Ban ${p.name} from the middle: they’d suit the ${them} nicely.`;
    return `Ban ${p.name}: their strongest card (${ovr(p)}).`;
  }
  const mine = lineupOf(d, side).map((q) => q.role);
  const { picked } = theirRoles(d, side);
  const beaten = picked.find((r) => beats(p.role, r));
  if (beaten) return `Their ${ROLE_NAME[beaten].toLowerCase()}s are a problem: ${ROLE_WHY[p.role]}.`;
  if (!mine.includes(p.role) && (p.role === 'medic' || p.role === 'builder')) return `No ${ROLE_NAME[p.role].toLowerCase()} yet: ${p.name} ${p.role === 'medic' ? 'keeps everyone up' : 'guards the fort'}.`;
  const threat = picked.find((r) => beats(r, p.role));
  if (!threat && picked.length) return `${p.name} is safe: nothing they’ve picked counters a ${ROLE_NAME[p.role].toLowerCase()}.`;
  if (!mine.includes(p.role)) return `You need a ${ROLE_NAME[p.role].toLowerCase()}: ${p.name} is your best one (${ovr(p)}).`;
  return `${p.name} is the strongest card left (${ovr(p)}).`;
}
/** the whole rest of the draft for both sides, each in its own style */
export function autoDraft(d: Draft, styles: [DraftStyle, DraftStyle], r: Rand, habits: [Habit | undefined, Habit | undefined] = [undefined, undefined]) {
  let guard = 0;
  while (!draftDone(d) && guard++ < 40) {
    const turn = draftTurn(d)!;
    const a = advise(d, turn.side, styles[turn.side], r, habits[turn.side]);
    if (!a || !act(d, a.id)) { d.step++; }
  }
  return d;
}
/** the tactic that suits a lineup against another (the Hint's tactic) */
export function suggestTactic(us: Player[], them: Player[]): { tactic: Tactic; why: string } {
  const r = (ps: Player[], role: Role) => ps.filter((p) => p.role === role).length;
  if (r(them, 'digger') >= 2) return { tactic: 'guard', why: 'Their diggers will rush the fort: guard it.' };
  if (r(us, 'digger') + r(us, 'scout') >= 3 && r(them, 'builder') <= 1) return { tactic: 'push', why: 'Lots of runners and few walls to stop them: attack.' };
  if (r(them, 'thrower') >= 2 && r(us, 'builder') >= 1) return { tactic: 'balanced', why: 'Walls up against their throwers, then push.' };
  return { tactic: 'balanced', why: 'An even match: keep a balance.' };
}
/** the pool of village loan cards for a draft */
export function loanPool(r: Rand, level: number, used = new Set<string>()): Player[] {
  const roles = [...ROLES].sort(() => r() - 0.5).slice(0, POOL_SIZE);
  return roles.map((role) => { const p = makePlayer(r, pick(r, FREE_SPECIES), role, level - 0.4, used); p.loan = true; p.morale = 60; return p; });
}

// ---------------------------------------------------------------- the season
export type Standing = { team: TeamId; p: number; w: number; d: number; l: number; ff: number; fa: number; pts: number };
export type Fixture = { week: number; home: TeamId; away: TeamId; kind: 'league' | 'semi' | 'final'; done: boolean; hs?: number; as?: number; winner?: TeamId | 'draw' };
export type Trophy = { season: number; kind: 'cup' | 'league' | 'runner' | 'semi'; text: string };
/** a snapshot pinned to the office wall after a win: the player of the match's portrait, and what it was */
export type Photo = { season: number; week: number; kind: 'win' | 'derby' | 'semi' | 'cup'; species: Species; look: number; name: string; opp: TeamId; ours: number; theirs: number };
/** which of the four painted looks a player has (portrait and in-match touches): fixed by their id */
export const lookOf = (p: { id: string }) => { let h = 7; for (let i = 0; i < p.id.length; i++) h = Math.imul(h ^ p.id.charCodeAt(i), 16777619) >>> 0; return hash(h, 91) % 4; };
export type WeekAction = 'train' | 'scout' | 'rest' | 'sign';
export type Settings = { sound: boolean; music: boolean; motion: boolean; hint: boolean };
export type Save = {
  v: 1; seed: number; season: number; week: number; money: number;
  squad: Player[]; rivals: Record<string, Player[]>; rivalLevel: number;
  fixtures: Fixture[]; table: Standing[];
  acted: WeekAction | null; scouted: TeamId | null; free: Player[];
  trophies: Trophy[]; rivalry: Record<string, { w: number; d: number; l: number }>;
  news: string[]; goodbye: Player | null; seasonOver: boolean; started: boolean;
  settings: Settings; history: { season: number; place: number; cup: string }[];
  /** how close the last match against each rival was (for grudge matches): their fort share minus ours */
  last: Record<string, number>; tutorial: number;
  /** the photo wall in the office, oldest first (the last 24) */
  photos: Photo[];
};
/** the week's weather, the same for every match that week */
export function weatherOf(s: Pick<Save, 'seed' | 'season' | 'week'>): { weather: Weather; wind: 1 | -1 } {
  const r = rng(hash(s.seed, s.season, s.week, 808));
  const x = r();
  const weather: Weather = s.season === 1 && s.week === 0 ? 'clear' : x < 0.4 ? 'clear' : x < 0.65 ? 'snow' : x < 0.85 ? 'wind' : 'fog';
  return { weather, wind: r() < 0.5 ? 1 : -1 };
}
export const NEIGHBOURS: TeamId = 'alpacas';
/** a derby with the neighbours, or a grudge match after a close loss */
export function occasion(s: Save, opp: TeamId): { kind: 'derby' | 'grudge' | 'final' | 'semi' | null; text: string } {
  const f = ourFixture(s);
  if (f?.kind === 'final') return { kind: 'final', text: 'The Snow Day Cup final!' };
  if (f?.kind === 'semi') return { kind: 'semi', text: 'Cup semi-final: lose and we’re out.' };
  if (opp === NEIGHBOURS) return { kind: 'derby', text: 'The Valley Derby: the neighbours from over the hill. Bragging rights at stake!' };
  const l = s.last[opp];
  if (l !== undefined && l > 0 && l < 0.25) return { kind: 'grudge', text: `Grudge match! The ${team(opp).short} edged us last time. The squad wants this one.` };
  return { kind: null, text: '' };
}
export const LEAGUE_WEEKS = 7, SEASON_WEEKS = 9;
let STAR_LEVEL = 7.0, SCOUT_MO = 45;
const RIVAL_IDS = TEAMS.slice(1).map((t) => t.id) as Exclude<TeamId, 'snowcats'>[];
export function roundRobin(ids: TeamId[], r: Rand): Fixture[] {
  const t = [...ids]; const n = t.length; const out: Fixture[] = [];
  // shuffle the rivals but keep us in slot 0
  for (let i = n - 1; i > 1; i--) { const j = 1 + Math.floor(r() * i); [t[i], t[j]] = [t[j], t[i]]; }
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      const home = (round + i) % 2 === 0 ? a : b, away = home === a ? b : a;
      out.push({ week: round, home, away, kind: 'league', done: false });
    }
    t.splice(1, 0, t.pop()!);
  }
  return out;
}
export function newSave(seed = 1): Save {
  const r = rng(hash(seed, 77));
  const rivals: Record<string, Player[]> = {};
  const squad = startingSquad(r), used = new Set(squad.map((p) => p.name));
  for (const id of RIVAL_IDS) rivals[id] = rivalSquad(r, id, team(id).strength, used);
  const s: Save = {
    v: 1, seed, season: 1, week: 0, money: 120, squad, rivals, rivalLevel: 0,
    fixtures: roundRobin(TEAMS.map((t) => t.id), r), table: TEAMS.map((t) => ({ team: t.id, p: 0, w: 0, d: 0, l: 0, ff: 0, fa: 0, pts: 0 })),
    acted: null, scouted: null, free: [], trophies: [], rivalry: {}, news: ['Welcome to the Snow Day League! Pick one job for the week, then draft and watch the match.'], goodbye: null, seasonOver: false, started: false,
    settings: { sound: true, music: true, motion: true, hint: true }, history: [], last: {}, tutorial: 0, photos: [],
  };
  s.free = freeAgents(s);
  return s;
}
export function freeAgents(s: Save): Player[] {
  const r = rng(hash(s.seed, s.season, s.week, 31));
  const used = namesIn(s, true);
  // two ordinary cards and a star who costs real money
  return [0, 1, 2].map((i) => freeAgent(r, i === 2 ? STAR_LEVEL + s.rivalLevel * 0.6 : 4.4 + s.rivalLevel * 0.35 + i * 0.5, used));
}
export const squadOf = (s: Save, id: TeamId) => id === 'snowcats' ? s.squad : s.rivals[id];
export function sortedTable(s: Save) {
  return [...s.table].sort((a, b) => b.pts - a.pts || (b.ff - b.fa) - (a.ff - a.fa) || b.w - a.w || TEAMS.findIndex((t) => t.id === a.team) - TEAMS.findIndex((t) => t.id === b.team));
}
export const place = (s: Save, id: TeamId = 'snowcats') => sortedTable(s).findIndex((x) => x.team === id) + 1;
export function ourFixture(s: Save): Fixture | null { return s.fixtures.find((f) => f.week === s.week && !f.done && (f.home === 'snowcats' || f.away === 'snowcats')) ?? null; }
export function opponentOf(s: Save, f: Fixture | null = ourFixture(s)): TeamId | null { return f ? (f.home === 'snowcats' ? f.away : f.home) : null; }

// ---- the week's job
export function canAct(s: Save, a: WeekAction, cost = 0) {
  if (s.acted || s.seasonOver) return false;
  if (a === 'sign') return s.money >= cost && s.squad.length < SQUAD_MAX;
  if (a === 'scout') return !!opponentOf(s);
  return true;
}
export function train(s: Save, id: string, stat: Stat) {
  const p = s.squad.find((q) => q.id === id); if (!p || s.acted || p[stat] >= STAT_MAX) return false;
  p[stat]++; p.morale = clamp(p.morale + 4, 0, 100); s.acted = 'train'; s.news.unshift(`${p.name} trained hard: ${stat} up to ${p[stat]}.`); return true;
}
export function rest(s: Save) {
  if (s.acted) return false;
  for (const p of s.squad) p.morale = clamp(p.morale + (p.personality === 'shy' ? 20 : 14), 0, 100);
  s.acted = 'rest'; s.news.unshift('A day off: cocoa and sledging. Morale is up.'); return true;
}
export function scout(s: Save) {
  const o = opponentOf(s); if (!o || s.acted) return false;
  s.scouted = o; s.acted = 'scout'; s.news.unshift(`Scouted the ${team(o).name}: their coach’s habits are on the board.`); return true;
}
export function sign(s: Save, id: string, release?: string) {
  const p = s.free.find((q) => q.id === id); if (!p || s.acted) return false;
  const cost = price(p); if (s.money < cost) return false;
  if (s.squad.length >= SQUAD_MAX) { if (!release) return false; const i = s.squad.findIndex((q) => q.id === release); if (i < 0) return false; s.squad.splice(i, 1); }
  s.money -= cost; s.squad.push({ ...p, loan: false, morale: 70 }); s.free = s.free.filter((q) => q.id !== id);
  s.acted = 'sign'; s.news.unshift(`Signed ${p.name} the ${SPECIES_NAME[p.species]} (${ROLE_NAME[p.role].toLowerCase()}) for ${cost} coins.`); return true;
}
export function release(s: Save, id: string) {
  if (s.squad.length <= SQUAD_MIN) return false;
  const i = s.squad.findIndex((q) => q.id === id); if (i < 0) return false;
  const [p] = s.squad.splice(i, 1); s.news.unshift(`${p.name} said goodbye and joined the village team.`); return true;
}
/** what scouting tells you: their likely ban and picks against our squad */
export function scoutReport(s: Save, id: TeamId) {
  const t = team(id);
  const d = newDraft(s.squad, s.rivals[id], [], 1, ['Snowcats', t.short]);
  const banA = advise(d, 1, 'habit', () => 0.99, t.habit); // their habit's first choice
  const bans = banA ? [findCard(d, banA.id)!] : [];
  const picks = [...s.rivals[id]].sort((a, b) => (rating(b) + t.habit.likes.filter((r) => r === b.role).length * 1.5) - (rating(a) + t.habit.likes.filter((r) => r === a.role).length * 1.5)).slice(0, 3);
  return { bans, picks, tactic: t.habit.tactic, blurb: t.blurb };
}

// ---- playing a fixture
export type Played = { fixture: Fixture; match: Match; draft: Draft };
export function makeDraft(s: Save, f: Fixture): Draft {
  const opp = opponentOf(s, f)!;
  const r = rng(hash(s.seed, s.season, f.week, 5));
  const pool = loanPool(r, 4.8 + s.rivalLevel * 0.3, namesIn(s));
  const first: Side = f.home === 'snowcats' ? 0 : 1;
  return newDraft(s.squad, s.rivals[opp], pool, first, ['Snowcats', team(opp).short]);
}
export function matchSeed(s: Save, f: Fixture) { return hash(s.seed, s.season, f.week, TEAMS.findIndex((t) => t.id === f.home), TEAMS.findIndex((t) => t.id === f.away)); }
/** the rival's tactic in our match */
export function rivalTactic(s: Save, opp: TeamId): Tactic { return team(opp).habit.tactic; }
/** a match between two other teams, played in full by the engine */
export function simFixture(s: Save, f: Fixture) {
  const r = rng(hash(s.seed, s.season, f.week, 9, TEAMS.findIndex((t) => t.id === f.home)));
  const H = team(f.home), A = team(f.away);
  const d = newDraft(squadOf(s, f.home), squadOf(s, f.away), loanPool(r, 4.8 + s.rivalLevel * 0.3, namesIn(s)), 0, [H.short, A.short]);
  autoDraft(d, ['habit', 'habit'], r, [H.habit, A.habit]);
  const m = new Match({ seed: matchSeed(s, f), lineups: [lineupOf(d, 0), lineupOf(d, 1)], tactics: [H.habit.tactic, A.habit.tactic], names: [H.short, A.short], coachAI: [true, true], knockout: f.kind !== 'league', ...weatherOf(s) });
  m.run();
  return m;
}
/** the result of a fixture into the table, money, morale and news */
export function record(s: Save, f: Fixture, m: Match, lineup?: Player[]) {
  // in our own matches we are always side 0 (on the left), home or away
  const homeSide: Side = f.away === 'snowcats' ? 1 : 0, awaySide = (1 - homeSide) as Side;
  const hs = Math.round(m.fortShare(homeSide) * 100), as = Math.round(m.fortShare(awaySide) * 100);
  f.done = true; f.hs = hs; f.as = as;
  f.winner = m.winner === homeSide ? f.home : m.winner === awaySide ? f.away : 'draw';
  if (f.kind === 'league') {
    const H = s.table.find((x) => x.team === f.home)!, A = s.table.find((x) => x.team === f.away)!;
    H.p++; A.p++; H.ff += 100 - as; H.fa += 100 - hs; A.ff += 100 - hs; A.fa += 100 - as;
    if (m.winner === homeSide) { H.w++; A.l++; H.pts += 3; } else if (m.winner === awaySide) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  if (f.home !== 'snowcats' && f.away !== 'snowcats') return null;
  const ours = 0 as Side;
  const opp = f.home === 'snowcats' ? f.away : f.home;
  const won = m.winner === ours, drew = m.winner === -1;
  const pay = (won ? 45 : drew ? 25 : 15) * (f.kind === 'final' ? 2 : f.kind === 'semi' ? 1.5 : 1);
  s.money += Math.round(pay);
  const rv = (s.rivalry[opp] ??= { w: 0, d: 0, l: 0 }); if (won) rv.w++; else if (drew) rv.d++; else rv.l++;
  const ourShare = Math.round(m.fortShare(0) * 100), theirShare = Math.round(m.fortShare(1) * 100);
  s.last[opp] = (theirShare - ourShare) / 100;
  // morale: players who played swing with the result, the bench depends on who they are
  const played = new Set((lineup ?? []).map((p) => p.id));
  const mvp = m.mvp(ours as Side);
  const changes: { id: string; name: string; d: number }[] = [];
  for (const p of s.squad) {
    let d = 0;
    if (played.has(p.id)) {
      d = won ? 8 : drew ? 1 : -6;
      if (p.personality === 'hothead') d = won ? 12 : drew ? 0 : -10;
      if (p.personality === 'showoff' && mvp && mvp.p.id === p.id) d += 12;
      p.games++;
      const u = m.units.find((x) => x.side === ours && x.p.id === p.id); if (u) p.kos += u.stats.kos;
    } else d = p.personality === 'hothead' ? -10 : p.personality === 'showoff' ? -8 : p.personality === 'shy' ? 3 : p.personality === 'steady' ? -2 : -4;
    if (p.personality === 'steady') d = Math.round(d / 2);
    p.morale = clamp(p.morale + d, p.personality === 'steady' ? 40 : 0, 100);
    if (d) changes.push({ id: p.id, name: p.name, d });
  }
  if (mvp) { const p = s.squad.find((q) => q.id === mvp.p.id); if (p) p.mvps++; }
  if (won && mvp) {
    const kind: Photo['kind'] = f.kind === 'final' ? 'cup' : f.kind === 'semi' ? 'semi' : opp === NEIGHBOURS ? 'derby' : 'win';
    s.photos.push({ season: s.season, week: f.week, kind, species: mvp.p.species, look: lookOf(mvp.p), name: mvp.p.name, opp, ours: ourShare, theirs: theirShare });
    if (s.photos.length > 24) s.photos.splice(0, s.photos.length - 24);
  }
  s.news.unshift(`${won ? 'Won' : drew ? 'Drew' : 'Lost'} against the ${team(opp).name}: ${ourShare}% of our fort left, ${theirShare}% of theirs. +${Math.round(pay)} coins.`);
  return { won, drew, pay: Math.round(pay), changes, mvp: mvp?.p ?? null };
}
/** the end of a week: everyone else's matches, the sponsors, the morale drift, then the cup draw if it's time */
export function endWeek(s: Save) {
  for (const f of s.fixtures) if (f.week === s.week && !f.done) record(s, f, simFixture(s, f));
  s.money += 15;
  const cheery = s.squad.some((p) => p.personality === 'cheery');
  for (const p of s.squad) p.morale = clamp(p.morale + (p.morale < 60 ? 2 : p.morale > 75 ? -2 : 0) + (cheery ? 2 : 0), 0, 100);
  s.week++; s.acted = null; s.scouted = null;
  if (s.week === LEAGUE_WEEKS) {
    const top = sortedTable(s).slice(0, 4).map((x) => x.team);
    s.fixtures.push({ week: 7, home: top[0], away: top[3], kind: 'semi', done: false }, { week: 7, home: top[1], away: top[2], kind: 'semi', done: false });
    s.news.unshift(top.includes('snowcats') ? `We’re in the semi-finals! Up next: the ${team(top[0] === 'snowcats' ? top[3] : top[1] === 'snowcats' ? top[2] : top[2] === 'snowcats' ? top[1] : top[0]).name}.` : 'We missed the top four this time. The cup goes on without us.');
  }
  if (s.week === LEAGUE_WEEKS + 1) {
    const semis = s.fixtures.filter((f) => f.kind === 'semi');
    const w = semis.map((f) => (f.winner === 'draw' ? f.home : f.winner) as TeamId);
    s.fixtures.push({ week: 8, home: w[0], away: w[1], kind: 'final', done: false });
    if (w.includes('snowcats')) s.news.unshift(`Cup final! Against the ${team(w[0] === 'snowcats' ? w[1] : w[0]).name}.`);
  }
  // nothing left for us this season: play the rest out
  if (s.week >= SEASON_WEEKS) { endSeason(s); return; }
  if (!ourFixture(s)) {
    if (s.week >= LEAGUE_WEEKS) { while (s.week < SEASON_WEEKS) { for (const f of s.fixtures) if (f.week === s.week && !f.done) record(s, f, simFixture(s, f)); s.week++; if (s.week === LEAGUE_WEEKS + 1) { const semis = s.fixtures.filter((f) => f.kind === 'semi'); const w = semis.map((f) => (f.winner === 'draw' ? f.home : f.winner) as TeamId); s.fixtures.push({ week: 8, home: w[0], away: w[1], kind: 'final', done: false }); } } endSeason(s); return; }
  }
  s.free = freeAgents(s);
}
export function cupResult(s: Save): 'cup' | 'runner' | 'semi' | 'none' {
  const fin = s.fixtures.find((f) => f.kind === 'final');
  if (fin?.done && fin.winner === 'snowcats') return 'cup';
  if (fin && (fin.home === 'snowcats' || fin.away === 'snowcats')) return 'runner';
  if (s.fixtures.some((f) => f.kind === 'semi' && (f.home === 'snowcats' || f.away === 'snowcats'))) return 'semi';
  return 'none';
}
export function endSeason(s: Save) {
  s.seasonOver = true;
  const res = cupResult(s), pl = place(s);
  const fin = s.fixtures.find((f) => f.kind === 'final');
  const champ = fin?.winner && fin.winner !== 'draw' ? fin.winner : null;
  if (res === 'cup') s.trophies.push({ season: s.season, kind: 'cup', text: `Snow Day Cup, season ${s.season}` });
  else if (res === 'runner') s.trophies.push({ season: s.season, kind: 'runner', text: `Cup runners-up, season ${s.season}` });
  if (pl === 1) s.trophies.push({ season: s.season, kind: 'league', text: `League leaders, season ${s.season}` });
  s.history.push({ season: s.season, place: pl, cup: res });
  s.news.unshift(res === 'cup' ? 'CHAMPIONS! The Snow Day Cup comes home to the burrow.' : `Season ${s.season} is over: ${ordinal(pl)} in the league${champ ? `, and the ${team(champ).name} won the cup` : ''}.`);
}
export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
/** between seasons: ageing and growth, a retirement, rookies, stronger rivals and a new calendar */
export function newSeason(s: Save) {
  const r = rng(hash(s.seed, s.season, 404));
  s.season++; s.week = 0; s.acted = null; s.scouted = null; s.seasonOver = false; s.goodbye = null;
  s.rivalLevel++;
  const notes: string[] = [];
  for (const p of s.squad) {
    p.age++;
    if (p.age <= 4) { for (let i = 0; i < (p.age <= 2 ? 2 : 1); i++) { const k = pick(r, STATS); if (p[k] < STAT_MAX) p[k]++; } }
    else if (p.age >= 9) { const k = pick(r, STATS); if (p[k] > 1) p[k]--; }
    else if (r() < 0.5) { const k = pick(r, STATS); if (p[k] < STAT_MAX) p[k]++; }
    p.morale = clamp(Math.round((p.morale + 65) / 2), 0, 100);
  }
  // one veteran may hang up their mittens
  const old = s.squad.filter((p) => p.age >= 8).sort((a, b) => b.age - a.age)[0];
  if (old && s.squad.length > SQUAD_MIN && r() < (old.age - 6) * 0.25) {
    s.squad = s.squad.filter((p) => p !== old); s.goodbye = { ...old };
    notes.push(`${old.name} the ${SPECIES_NAME[old.species]} retires after ${old.games} matches. Thank you, ${old.name}!`);
  }
  // a rookie arrives (free) if there's room
  if (s.squad.length < SQUAD_MAX) { const rk = freeAgent(r, 3.6, namesIn(s)); rk.age = 1; rk.morale = 75; s.squad.push(rk); notes.push(`A rookie joins: ${rk.name} the ${SPECIES_NAME[rk.species]} (${ROLE_NAME[rk.role].toLowerCase()}).`); }
  // the rivals grow and sign a star each
  for (const id of RIVAL_IDS) {
    const sq = s.rivals[id];
    for (const p of sq) { p.age++; for (let i = 0; i < 3; i++) { const k = pick(r, STATS); if (p[k] < STAT_MAX && r() < 0.75) p[k]++; } }
    const weakest = [...sq].sort((a, b) => rating(a) - rating(b))[0];
    const star = makePlayer(r, team(id).species, weakest.role, team(id).strength + s.rivalLevel * 0.8 + 0.8, namesIn(s));
    s.rivals[id] = sq.map((p) => (p === weakest ? star : p));
  }
  s.fixtures = roundRobin(TEAMS.map((t) => t.id), r);
  s.table = TEAMS.map((t) => ({ team: t.id, p: 0, w: 0, d: 0, l: 0, ff: 0, fa: 0, pts: 0 }));
  s.free = freeAgents(s);
  s.news = [`Season ${s.season} begins! The rivals have been training, and each signed a new star.`, ...notes];
}

// ---- the save
export const serialise = (s: Save) => JSON.stringify(s);
const isPlayer = (p: unknown): p is Player => {
  const q = p as Player;
  return !!q && typeof q === 'object' && typeof q.id === 'string' && typeof q.name === 'string' && SPECIES.includes(q.species) && ROLES.includes(q.role) && STATS.every((k) => Number.isFinite(q[k]) && q[k] >= 1 && q[k] <= STAT_MAX) && Number.isFinite(q.morale) && Number.isFinite(q.age);
};
export function parseSave(raw: string | null): Save {
  if (!raw) return newSave(Math.floor(Math.random() * 1e9));
  try {
    const o = JSON.parse(raw) as Save;
    if (!o || o.v !== 1 || !Array.isArray(o.squad) || !o.squad.every(isPlayer) || o.squad.length < 1) throw new Error('bad');
    if (!o.rivals || RIVAL_IDS.some((id) => !Array.isArray(o.rivals[id]) || !o.rivals[id].every(isPlayer))) throw new Error('bad');
    if (!Array.isArray(o.fixtures) || !Array.isArray(o.table) || o.table.length !== TEAMS.length) throw new Error('bad');
    if (!Number.isFinite(o.money) || !Number.isFinite(o.season) || !Number.isFinite(o.week)) throw new Error('bad');
    const base = newSave(o.seed);
    const s: Save = { ...base, ...o, settings: { ...base.settings, ...(o.settings ?? {}) } };
    for (const k of ['sound', 'music', 'motion', 'hint'] as const) if (typeof s.settings[k] !== 'boolean') s.settings[k] = base.settings[k];
    if (!Array.isArray(s.free)) s.free = freeAgents(s);
    if (!Array.isArray(s.trophies)) s.trophies = [];
    if (!Array.isArray(s.news)) s.news = [];
    if (!Array.isArray(s.history)) s.history = [];
    if (!s.last || typeof s.last !== 'object') s.last = {};
    if (!Number.isFinite(s.tutorial)) s.tutorial = 0;
    if (!Array.isArray(s.photos)) s.photos = [];
    return s;
  } catch { return newSave(Math.floor(Math.random() * 1e9)); }
}

// ---------------------------------------------------------------- managers for the bots (and the page's auto-draft)
export type ManagerKind = 'casual' | 'pro' | 'random' | 'idle' | 'coach';
/** a manager's job for the week */
export function botWeek(s: Save, kind: ManagerKind, r: Rand) {
  if (s.acted || s.seasonOver) return;
  if (kind === 'idle') return;
  if (kind === 'random') {
    const a = pick(r, ['train', 'rest', 'scout', 'sign'] as WeekAction[]);
    if (a === 'train') { const p = pick(r, s.squad); train(s, p.id, pick(r, STATS)); }
    else if (a === 'rest') rest(s); else if (a === 'scout') scout(s);
    else { const f = pick(r, s.free); if (f && s.money >= price(f)) sign(s, f.id, s.squad.length >= SQUAD_MAX ? pick(r, s.squad).id : undefined); }
    return;
  }
  const avgMorale = s.squad.reduce((a, p) => a + p.morale, 0) / s.squad.length;
  if (kind === 'casual' || kind === 'coach') {
    // simple choices: rest when spirits are low, otherwise train the best player's main stat
    if (avgMorale < 55) { rest(s); return; }
    const p = [...s.squad].sort((a, b) => rating(b) - rating(a))[s.week % 3];
    const [a, sp, g] = LEAN[p.role]; const k: Stat = a >= sp && a >= g ? 'aim' : sp >= g ? 'speed' : 'grit';
    if (!train(s, p.id, k)) rest(s);
    return;
  }
  // the pro: sign a clear upgrade when the money is there, scout before the cup, rest when needed, train the core
  const weakest = [...s.squad].sort((a, b) => rating(a) - rating(b))[0];
  const best = [...s.free].filter((f) => s.money >= price(f) + 20).sort((a, b) => rating(b) - rating(a))[0];
  if (best && rating(best) > rating(weakest) + 1.2) { if (sign(s, best.id, s.squad.length >= SQUAD_MAX ? weakest.id : undefined)) return; }
  if (avgMorale < 58) { rest(s); return; }
  if (s.week >= LEAGUE_WEEKS && opponentOf(s)) { scout(s); return; }
  const core = [...s.squad].sort((a, b) => rating(b) - rating(a)).slice(0, 5);
  const p = core[s.week % core.length];
  const [a, sp, g] = LEAN[p.role]; const order: Stat[] = (a >= sp && a >= g ? ['aim', sp >= g ? 'speed' : 'grit'] : sp >= g ? ['speed', 'aim'] : ['grit', 'aim']) as Stat[];
  if (!train(s, p.id, order[0]) && !train(s, p.id, order[1])) rest(s);
}
/** a coach's shouts during a match: the Hint's advice for a shout, if any, right now */
export function shoutHint(m: Match, side: Side = 0): { kind: ShoutKind; target?: number; why: string } | null {
  if (!m.canShout(side)) return null;
  const sec = m.t / TICK, mine = m.fortShare(side), theirs = m.fortShare((1 - side) as Side);
  const late = m.half === 0 ? sec > 24 : sec > 64;
  const theirsUp = m.up((1 - side) as Side), mineUp = m.up(side);
  if (mine < theirs - 0.1 && mine < 0.75) return { kind: 'hold', why: 'Our fort is taking a beating: hold the walls!' };
  if (theirsUp <= 3 && mineUp >= 4) return { kind: 'attack', why: 'They’re down to a few: all attack!' };
  if (!late) return null;
  if (theirs < 0.45 || mine > theirs + 0.1) return { kind: 'attack', why: 'Their fort is crumbling: all attack!' };
  const star = m.bestUnit(side);
  if (star && (star.role === 'thrower' || star.role === 'digger') && star.hp < star.maxHp * 0.6) return { kind: 'protect', target: star.id, why: `${star.name} is our danger player: protect them!` };
  return { kind: mine < theirs ? 'hold' : 'attack', why: mine < theirs ? 'Steady the fort: hold the walls!' : 'Press the lead: all attack!' };
}
/** the options for our match this week: seed, weather, the rival's tactic, and a head start in momentum for a derby or grudge */
export function ourMatchOpts(s: Save, f: Fixture, us: Player[], them: Player[], tactic: Tactic, shouts: Shout[] = []): MatchOpts {
  const opp = opponentOf(s, f)!; const T = team(opp); const oc = occasion(s, opp);
  const mo: [number, number] = oc.kind === 'grudge' ? [35, 0] : oc.kind === 'derby' ? [20, 20] : [0, 0];
  // scouting them this week: we know their plan, so we start with momentum
  if (s.scouted === opp) mo[0] = Math.min(100, mo[0] + SCOUT_MO);
  return { seed: matchSeed(s, f), lineups: [us, them], tactics: [tactic, rivalTactic(s, opp)], names: ['Snowcats', T.short], coachAI: [false, true], knockout: f.kind !== 'league', shouts, momentum: mo, ...weatherOf(s) };
}
/** play our fixture this week as a bot would (draft, tactic, shouts) */
export function botMatch(s: Save, kind: ManagerKind, r: Rand) {
  const f = ourFixture(s); if (!f) return null;
  const opp = opponentOf(s, f)!; const T = team(opp);
  const d = makeDraft(s, f);
  const style: DraftStyle = kind === 'random' || kind === 'idle' ? 'random' : 'hint';
  autoDraft(d, [style, 'habit'], r, [undefined, T.habit]);
  const us = lineupOf(d, 0), them = lineupOf(d, 1);
  const tactic: Tactic = kind === 'random' || kind === 'idle' ? 'balanced' : suggestTactic(us, them).tactic;
  const m = new Match(ourMatchOpts(s, f, us, them, tactic));
  const shouts = kind === 'pro' || kind === 'casual' || kind === 'coach';
  while (!m.over) {
    if (shouts && m.t % 15 === 0) { const h = shoutHint(m, 0); if (h) m.shout(0, h.kind, h.target); }
    m.step();
  }
  const res = record(s, f, m, us.filter((p) => !p.loan));
  return { f, m, d, res };
}
/** a whole season for a bot manager; returns where it finished */
export function botSeason(s: Save, kind: ManagerKind, r: Rand) {
  let guard = 0;
  while (!s.seasonOver && guard++ < 20) {
    botWeek(s, kind, r);
    botMatch(s, kind, r);
    endWeek(s);
  }
  return { place: place(s), cup: cupResult(s) };
}

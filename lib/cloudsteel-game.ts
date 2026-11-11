// Cloudsteel: the rules of the duel. A fixed 60 Hz simulation with no DOM: Dora and Enzo, a tag team, in a round of
// ground against rounds of foes (the terrace duel: Atoq the fox sellsword, two of his sword-kin with a vizcacha archer,
// then Ukhu the bear warden; the story hands in one encounter at a time, with Dora's sword and Enzo's lantern
// upgrades). The player controls one hero at a time and swaps with E; the other stays near and helps a little. Dora is
// the duellist: steel attacks can be guarded, and guarding in the first moments of the press deflects them, which
// fills the foe's posture; a full posture bar breaks the foe open for her finisher. Enzo is the lantern: a slow, wide
// sweep that breaks posture across a group, a ward that stops arrows, and a hop. Jade attacks cannot be guarded and
// have to be dodged. Archers stand back and loose arrows down a red line. Hits, deflects, dodges and warded arrows
// fill the tag meter; a swap on a full meter is a tag strike. All randomness comes from the seed, so a seed replays a
// fight. The story's world (areas, talking, puzzles) is lib/cloudsteel-world.ts; drawing is in
// lib/cloudsteel-scene.ts, the page in app/cloudsteel/page.tsx.

export const DT = 1 / 60, ARENA_R = 7.6, SAVE_KEY = 'cloudsteel-v2', TAG_FULL = 100;
/** `tag` is E (swap heroes, a tag strike on a full meter); `swap` is Q (lock on to the next foe) */
export type Input = { x: number; z: number; attack: boolean; guard: boolean; dodge: boolean; tag: boolean; swap: boolean };
export const idleInput = (): Input => ({ x: 0, z: 0, attack: false, guard: false, dodge: false, tag: false, swap: false });

export type FoeKind = 'fox' | 'bear' | 'puma' | 'archer';
/** whose painting a foe wears: Atoq, a sword-kin, the kin captain, Titu the puma, Ukhu or a vizcacha archer */
export type Look = 'atoq' | 'kin' | 'mallku' | 'titu' | 'ukhu' | 'archer';
/** an attack: ticks of wind-up, active ticks, recovery, reach (m), half-angle (rad), damage, posture pressed onto a
 *  guard, whether it is a jade (unguardable) attack, and how far the foe steps in as it strikes */
export type Attack = { id: string; windup: number; active: number; recover: number; range: number; arc: number; dmg: number; press: number; jade: boolean; lunge: number };
export const ATTACKS: Record<FoeKind, Attack[]> = {
  fox: [
    { id: 'slash', windup: 36, active: 5, recover: 34, range: 2.3, arc: 1.1, dmg: 16, press: 34, jade: false, lunge: 0.6 },
    { id: 'lunge', windup: 46, active: 6, recover: 42, range: 2.7, arc: 0.5, dmg: 20, press: 40, jade: false, lunge: 2.4 },
  ],
  bear: [
    { id: 'sweep', windup: 50, active: 7, recover: 46, range: 3.3, arc: 1.7, dmg: 24, press: 50, jade: false, lunge: 0.8 },
    { id: 'thrust', windup: 42, active: 6, recover: 40, range: 3.8, arc: 0.4, dmg: 22, press: 45, jade: false, lunge: 1.6 },
    { id: 'slam', windup: 64, active: 6, recover: 60, range: 3.0, arc: Math.PI, dmg: 34, press: 0, jade: true, lunge: 0 },
  ],
  // the puma's crossing swipe is quick; his pounce leaps in from far off and cannot be guarded
  puma: [
    { id: 'swipe', windup: 30, active: 5, recover: 32, range: 2.2, arc: 1.2, dmg: 14, press: 30, jade: false, lunge: 0.8 },
    { id: 'pounce', windup: 50, active: 8, recover: 54, range: 2.1, arc: 0.9, dmg: 22, press: 0, jade: true, lunge: 3.0 },
  ],
  // the archer draws, takes aim (the red line locks where the hero stood), and looses one arrow down it
  archer: [
    { id: 'arrow', windup: 56, active: 1, recover: 30, range: 12, arc: Math.PI, dmg: 12, press: 24, jade: false, lunge: 0 },
  ],
};
export const FOES: Record<FoeKind, { hp: number; posture: number; speed: number; cd: [number, number]; reach: number; radius: number }> = {
  fox: { hp: 130, posture: 100, speed: 2.7, cd: [45, 90], reach: 2.0, radius: 0.45 },
  bear: { hp: 620, posture: 180, speed: 1.9, cd: [40, 80], reach: 2.7, radius: 0.9 },
  puma: { hp: 210, posture: 120, speed: 3.0, cd: [40, 80], reach: 2.0, radius: 0.5 },
  archer: { hp: 70, posture: 70, speed: 2.3, cd: [60, 110], reach: 6.2, radius: 0.4 },
};
/** the arrow: how many ticks before the loose the red line stops following the hero, its speed (m a tick), how close it
 *  has to pass to hit, and how far it flies */
export const ARROW = { lock: 20, speed: 0.26, hit: 0.5, range: 15 };
/** one foe of a round; `hp` overrides the kind's health (the kin captain is tougher than his kin) */
export type FoeDef = { kind: FoeKind; name: string; look: Look; hp?: number };
export type Round = { title: string; foes: FoeDef[] };
/** the terrace duel from the title menu */
export const ROUNDS: Round[] = [
  { title: 'Atoq the Sellsword', foes: [{ kind: 'fox', name: 'Atoq the Sellsword', look: 'atoq' }] },
  { title: 'The Sword-Kin', foes: [{ kind: 'fox', name: 'Sword-Kin Sami', look: 'kin' }, { kind: 'fox', name: 'Sword-Kin Wayra', look: 'kin' }, { kind: 'archer', name: 'Kin Archer Chaska', look: 'archer' }] },
  { title: 'Ukhu, Warden of the Bridge', foes: [{ kind: 'bear', name: 'Ukhu, Warden of the Bridge', look: 'ukhu' }] },
];
/** what the story's upgrades do in a fight: the rain-tempered edge cuts harder, the condor-feather wrap breaks
 *  posture faster, the puma-claw guard widens the deflect moment, and the second flame fills the meter faster and
 *  makes Enzo's lantern hit harder */
export type Upgrades = { edge: boolean; feather: boolean; claw: boolean; flame: boolean };
export const noUpgrades = (): Upgrades => ({ edge: false, feather: false, claw: false, flame: false });
export type FightOpts = { rounds?: Round[]; ups?: Partial<Upgrades> };
/** Dora's three cuts: length, the tick the cut lands, damage, posture damage, reach */
export const CUTS = [
  { len: 20, hit: 7, dmg: 5, post: 4, reach: 2.2 },
  { len: 22, hit: 8, dmg: 6, post: 4, reach: 2.2 },
  { len: 32, hit: 13, dmg: 10, post: 9, reach: 2.5 },
];
export const DODGE = { len: 22, from: 2, to: 15, dist: 3.2 }, FINISHER = { len: 46, hit: 20 }, TAG = { len: 56, hit: 26, radius: 4.5 };
/** Enzo's moves. The sweep: length, the tick it lands, reach, half-angle, damage, posture. The ward: how long it
 *  stands, the rest before the next, and how far round him it stops arrows. The hop: length, safe ticks, distance */
export const SWEEP = { len: 42, hit: 20, reach: 2.9, arc: 1.5, dmg: 5, post: 15 };
export const WARD = { len: 40, rest: 30, r: 1.5 };
export const HOP = { len: 18, from: 2, to: 12, dist: 2.2 };
/** a swap: the rest before the next; Dora's tag-in dash on a full meter (length, the tick it lands, damage, posture) */
export const SWAP = { rest: 30, out: 14 }, DASH = { len: 24, hit: 12, dmg: 16, post: 40 };
/** where the partner waits: behind the hero, off to one side */
const NEAR = { back: 1.7, side: 1.6 };
/** the partner's help: how near a foe has to be for them to have a go, and how often (ticks, at the least) */
const HELP = { reach: 3.6, every: 200 };

export type FoeState = 'enter' | 'stalk' | 'windup' | 'strike' | 'recover' | 'hit' | 'deflected' | 'broken' | 'dead';
export type Foe = { id: number; kind: FoeKind; look: Look; name: string; x: number; z: number; face: number; hp: number; maxHp: number; posture: number; maxPosture: number;
  state: FoeState; t: number; len: number; cd: number; atk: Attack | null; done: boolean; strafe: number; calm: number; gone: boolean;
  /** cuts taken since its last attack: at three it parries the next one and answers */
  poise: number;
  /** an archer's aim: where the red line points (it follows the hero until it locks) */
  aimX: number; aimZ: number };
export type Arrow = { id: number; from: number; x: number; z: number; vx: number; vz: number; flown: number; dead: boolean };
export type Hero = 'dora' | 'enzo';
/** Dora's states; `wait`, `tagout` and `help` are hers while Enzo is the one fighting, `tagin` her dash on a full meter */
export type DoraState = 'idle' | 'run' | 'cut1' | 'cut2' | 'cut3' | 'guard' | 'deflect' | 'dodge' | 'hit' | 'recoil' | 'broken' | 'finisher' | 'tag' | 'dead' | 'win'
  | 'wait' | 'tagout' | 'help' | 'tagin';
/** Enzo's states: as the partner (`wait`, `tagout`, `help`), coming in on a full meter (`leap`, `strike`), and fighting */
export type EnzoState = 'wait' | 'tagout' | 'help' | 'leap' | 'strike' | 'idle' | 'run' | 'sweep' | 'ward' | 'hop' | 'hit' | 'dead' | 'win';
export type Enzo = { x: number; z: number; face: number; state: EnzoState; t: number; tx: number; tz: number; hp: number; maxHp: number; invuln: number; wardCd: number; hopX: number; hopZ: number; hopCd: number; done: boolean };
export type Phase = 'intro' | 'fight' | 'clear' | 'won' | 'lost';
export type Rank = 'gold' | 'silver' | 'bronze';
export type FightEvent =
  | { t: 'round'; n: number } | { t: 'swing'; n: number } | { t: 'hit'; id: number; x: number; z: number; heavy: boolean } | { t: 'deflect'; id: number; x: number; z: number }
  | { t: 'block'; x: number; z: number } | { t: 'parried'; id: number; x: number; z: number } | { t: 'hurt'; dmg: number; jade: boolean; who: Hero } | { t: 'dodge' } | { t: 'evade' } | { t: 'windup'; id: number; jade: boolean; atk: string }
  | { t: 'strike'; id: number; atk: string } | { t: 'broken'; id: number } | { t: 'guardBroken' } | { t: 'finisher'; id: number } | { t: 'finisherHit'; id: number; x: number; z: number }
  | { t: 'tagReady' } | { t: 'tag'; to: Hero } | { t: 'tagHit'; x: number; z: number } | { t: 'swap'; to: Hero } | { t: 'down'; who: Hero }
  | { t: 'sweep' } | { t: 'sweepHit'; x: number; z: number; n: number } | { t: 'ward' } | { t: 'hop' } | { t: 'help'; who: Hero }
  | { t: 'loose'; id: number } | { t: 'warded'; x: number; z: number } | { t: 'arrowHit'; x: number; z: number }
  | { t: 'dead'; id: number } | { t: 'clear'; n: number } | { t: 'won' } | { t: 'lost' };
export type Result = { rank: Rank; seconds: number; deflects: number; bestCombo: number; damage: number; falls: number; score: number };
/** `story` is the story's own save (lib/cloudsteel-world.ts checks it); `climbs` counts finished stories; `quest` shows
 *  the quest arrow in the climb */
export type Save = { v: 2; best: Result | null; wins: number; fights: number; seenHow: boolean; settings: { assist: boolean; sound: boolean; music: boolean; fx: boolean; quest: boolean };
  story: Record<string, unknown> | null; climbs: number };

export const newSave = (): Save => ({ v: 2, best: null, wins: 0, fights: 0, seenHow: false, settings: { assist: true, sound: true, music: true, fx: true, quest: true }, story: null, climbs: 0 });
export const serialise = (s: Save) => JSON.stringify(s);
export function parseSave(raw: string | null): Save {
  const s = newSave();
  if (!raw) return s;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 2) return s;
    if (o.best && typeof o.best.score === 'number' && ['gold', 'silver', 'bronze'].includes(o.best.rank)) s.best = o.best;
    s.wins = Math.max(0, o.wins | 0); s.fights = Math.max(0, o.fights | 0); s.seenHow = !!o.seenHow;
    // a setting the save does not have yet (the quest arrow, before it existed) keeps its default
    for (const k of ['assist', 'sound', 'music', 'fx', 'quest'] as const) if (typeof o.settings?.[k] === 'boolean') s.settings[k] = o.settings[k];
    if (o.story && typeof o.story === 'object' && !Array.isArray(o.story)) s.story = o.story;
    s.climbs = Math.max(0, o.climbs | 0);
  } catch {}
  return s;
}
/** true when a is the better result */
export const better = (a: Result, b: Result | null) => !b || a.score > b.score;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const newEnzo = (): Enzo => ({ x: -1.6, z: 4.4, face: Math.PI, state: 'wait', t: 0, tx: 0, tz: 0, hp: 100, maxHp: 100, invuln: 0, wardCd: 0, hopX: 0, hopZ: 0, hopCd: 0, done: false });

export class Fight {
  readonly assist: boolean; readonly rounds: Round[]; readonly ups: Upgrades;
  private rand: () => number;
  tick_ = 0; phase: Phase = 'intro'; phaseT = 0; round = 0;
  /** who the player controls */
  hero: Hero = 'dora'; swapCd = 0;
  // Dora. Angles are yaw: 0 faces +z, and x = sin, z = cos.
  x = 0; z = 3; face = Math.PI; hp = 100; maxHp = 100; posture = 0; state: DoraState = 'idle'; t = 0;
  invuln = 0; guardT = 99; guardPress = -999; lastBlock = -999; dodgeCd = 0; dodgeX = 0; dodgeZ = 0; cutDone = false; queued = false;
  tag = 0; target = -1; combo = 0; comboT = 0;
  enzo: Enzo = newEnzo();
  foes: Foe[] = []; arrows: Arrow[] = []; private nextId = 1; private token = -1; private helpCd = 120;
  events: FightEvent[] = [];
  stats = { ticks: 0, deflects: 0, bestCombo: 0, damage: 0, falls: 0, hits: 0, finishers: 0, tags: 0, swaps: 0, enzoTicks: 0, warded: 0 };
  private prev: Input = idleInput(); private bufAttack = 99; private bufDodge = 99; private bufGuard = 99;

  constructor(seed: number, assist = true, opts: FightOpts = {}) {
    this.rand = rng(seed); this.assist = assist; this.rounds = opts.rounds ?? ROUNDS; this.ups = { ...noUpgrades(), ...opts.ups }; this.startRound(0);
  }

  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get deflectWindow() { return (this.assist ? 14 : 9) + (this.ups.claw ? 3 : 0); }
  get living() { return this.foes.filter((f) => f.state !== 'dead'); }
  foe(id: number) { return this.foes.find((f) => f.id === id) ?? null; }
  get targetFoe() { const f = this.foe(this.target); return f && f.state !== 'dead' ? f : null; }
  /** where the hero the player controls stands */
  get me() { return this.hero === 'dora' ? { x: this.x, z: this.z, face: this.face } : { x: this.enzo.x, z: this.enzo.z, face: this.enzo.face }; }
  get doraDown() { return this.state === 'dead'; }
  get enzoDown() { return this.enzo.state === 'dead'; }
  /** the hero the player controls can be struck */
  private get meUp() { return this.hero === 'dora' ? this.state !== 'dead' && this.state !== 'win' : this.enzo.state !== 'dead' && this.enzo.state !== 'win'; }

  private startRound(n: number) {
    this.round = n; this.phase = 'intro'; this.phaseT = 0; this.foes = []; this.arrows = []; this.token = -1;
    const defs = this.rounds[n].foes;
    defs.forEach((d, i) => {
      const a = Math.PI + (i - (defs.length - 1) / 2) * 0.7, st = FOES[d.kind], hp = d.hp ?? st.hp;
      this.foes.push({ id: this.nextId++, kind: d.kind, look: d.look, name: d.name, x: Math.sin(a) * (ARENA_R + 1.2), z: Math.cos(a) * (ARENA_R + 1.2), face: a + Math.PI, hp, maxHp: hp, posture: 0, maxPosture: st.posture,
        state: 'enter', t: 0, len: 0, cd: d.kind === 'archer' ? 110 + i * 30 : 40 + i * 50, atk: null, done: false, strafe: i % 2 ? 1 : -1, calm: 0, gone: false, poise: 0, aimX: 0, aimZ: 0 });
    });
    // lock on to a sword first: an archer at the back is a choice, not where the fight starts
    this.target = (this.foes.find((f) => f.kind !== 'archer') ?? this.foes[0]).id;
    this.events.push({ t: 'round', n });
  }
  /** after a fall: the same round again, both on full health, Dora in front */
  retryRound() {
    if (this.phase !== 'lost') return;
    this.stats.falls++; this.hp = this.maxHp; this.posture = 0; this.state = 'idle'; this.t = 0; this.x = 0; this.z = 3; this.face = Math.PI; this.invuln = 0; this.combo = 0;
    this.enzo = newEnzo(); this.hero = 'dora'; this.swapCd = 0;
    this.startRound(this.round);
  }
  result(): Result {
    const s = this.stats, seconds = Math.round(s.ticks * DT);
    const rank: Rank = s.falls === 0 && s.damage <= 45 ? 'gold' : s.falls <= 1 && s.damage <= 140 ? 'silver' : 'bronze';
    const score = Math.max(0, Math.round(3000 + s.deflects * 60 + s.bestCombo * 25 + s.finishers * 100 - s.damage * 6 - s.falls * 500 - Math.max(0, seconds - 90) * 4));
    return { rank, seconds, deflects: s.deflects, bestCombo: s.bestCombo, damage: Math.round(s.damage), falls: s.falls, score };
  }

  private dist(f: Foe) { return Math.hypot(f.x - this.x, f.z - this.z); }
  private distE(f: Foe) { return Math.hypot(f.x - this.enzo.x, f.z - this.enzo.z); }
  private setState(s: DoraState) { this.state = s; this.t = 0; this.cutDone = false; this.queued = false; }
  private setEnzo(s: EnzoState) { this.enzo.state = s; this.enzo.t = 0; this.enzo.done = false; }
  private setFoe(f: Foe, s: FoeState, len = 0) {
    if (this.token === f.id && s !== 'windup' && s !== 'strike' && s !== 'recover') this.token = -1;
    f.state = s; f.t = 0; f.len = len; f.done = false;
    if (s !== 'windup' && s !== 'strike' && s !== 'recover') f.atk = null;
  }
  private keepIn(o: { x: number; z: number }, r = ARENA_R) { const d = Math.hypot(o.x, o.z); if (d > r) { o.x *= r / d; o.z *= r / d; } }
  private pickTarget() {
    const m = this.me; let best: Foe | null = null, bd = 1e9;
    // the nearest sword first; an archer only when no sword is left standing
    for (const f of this.living) { const d = Math.hypot(f.x - m.x, f.z - m.z) + (f.kind === 'archer' ? 6 : 0); if (d < bd) { bd = d; best = f; } }
    this.target = best ? best.id : -1;
  }
  private addCombo() { this.combo++; this.comboT = 0; if (this.combo > this.stats.bestCombo) this.stats.bestCombo = this.combo; }
  private addTag(n: number) { const was = this.tag; this.tag = Math.min(TAG_FULL, this.tag + n * (this.ups.flame ? 1.3 : 1)); if (was < TAG_FULL && this.tag >= TAG_FULL) this.events.push({ t: 'tagReady' }); }
  private addPosture(f: Foe, n: number) {
    if (f.state === 'broken' || f.state === 'dead') return;
    f.posture = Math.min(f.maxPosture, f.posture + n); f.calm = 0;
    if (f.posture >= f.maxPosture) { this.setFoe(f, 'broken', this.assist ? 190 : 150); this.events.push({ t: 'broken', id: f.id }); }
  }
  private hurtFoe(f: Foe, dmg: number) {
    f.hp = Math.max(0, f.hp - dmg);
    if (f.hp <= 0 && f.state !== 'dead') { this.setFoe(f, 'dead', 90); this.events.push({ t: 'dead', id: f.id }); if (this.target === f.id) this.pickTarget(); }
  }

  tick(inp: Input) {
    this.events.length = 0; this.tick_++;
    const p = this.prev, pressed = { attack: inp.attack && !p.attack, guard: inp.guard && !p.guard, dodge: inp.dodge && !p.dodge, tag: inp.tag && !p.tag, swap: inp.swap && !p.swap };
    this.prev = { ...inp };
    this.phaseT++;
    if (this.phase === 'intro') { if (this.phaseT >= 70) { this.phase = 'fight'; this.phaseT = 0; } }
    else if (this.phase === 'clear') {
      if (this.phaseT >= 110) {
        if (this.round + 1 >= this.rounds.length) { this.phase = 'won'; this.phaseT = 0; this.setState('win'); this.setEnzo('win'); this.events.push({ t: 'won' }); }
        else {
          // between rounds: back on their feet, Dora in front
          const heal = (hp: number) => this.assist ? 100 : Math.min(100, Math.max(hp, 0) + 40);
          this.hp = heal(this.hp); this.enzo.hp = heal(this.enzo.hp); this.posture = 0;
          this.hero = 'dora'; this.setState('idle'); this.setEnzo('wait'); this.startRound(this.round + 1);
        }
      }
    }
    if (this.phase === 'fight') { this.stats.ticks++; if (this.hero === 'enzo') this.stats.enzoTicks++; }
    if (this.over) { this.t++; this.enzo.t++; for (const f of this.foes) f.t++; return; }
    if (this.swapCd > 0) this.swapCd--;
    if (++this.comboT > 240) this.combo = 0;
    if (pressed.attack) this.bufAttack = 0;
    if (pressed.dodge) this.bufDodge = 0;
    if (pressed.guard) this.bufGuard = 0;
    if (!this.targetFoe) this.pickTarget();
    if (pressed.swap) { const l = this.living; if (l.length > 1) { const i = l.findIndex((f) => f.id === this.target); this.target = l[(i + 1) % l.length].id; } }
    if (pressed.tag) this.trySwap();
    if (this.hero === 'dora') { this.stepDora(inp, pressed); this.stepEnzoPartner(); }
    else { this.stepEnzo(inp, pressed); this.stepDoraPartner(); }
    this.bufAttack++; this.bufDodge++; this.bufGuard++;
    for (const f of this.foes) this.stepFoe(f);
    this.stepArrows();
    this.separate();
    // a hero who falls hands over to the other; the round is lost when both are down
    const meDown = this.hero === 'dora' ? this.state === 'dead' && this.t >= 50 : this.enzo.state === 'dead' && this.enzo.t >= 50;
    if (this.phase === 'fight' && meDown && !(this.doraDown && this.enzoDown)) this.swapTo(this.hero === 'dora' ? 'enzo' : 'dora', false);
    if (this.phase === 'fight' && this.foes.every((f) => f.state === 'dead')) { this.phase = 'clear'; this.phaseT = 0; this.arrows = []; this.events.push({ t: 'clear', n: this.round }); }
    if (this.phase === 'fight' && this.doraDown && this.enzoDown && (this.hero === 'dora' ? this.t : this.enzo.t) >= 80) { this.phase = 'lost'; this.phaseT = 0; this.events.push({ t: 'lost' }); }
  }

  // ---------------------------------------------------------------- swapping
  /** E: the other hero takes over. On a full meter the one coming in arrives with a blow: Enzo leaps in with his
   *  lantern (every foe round him), Dora dashes in with a cut at the foe she is locked on to */
  private trySwap() {
    if (this.swapCd > 0 || (this.phase !== 'fight' && this.phase !== 'intro')) return;
    const to: Hero = this.hero === 'dora' ? 'enzo' : 'dora';
    if (to === 'enzo' ? this.enzoDown : this.doraDown) return;
    // not in the middle of a finisher or a tag strike
    if (this.state === 'finisher' || this.state === 'tag' || this.state === 'tagin' || this.enzo.state === 'leap' || this.enzo.state === 'strike') return;
    if (this.hero === 'dora' ? this.state === 'dead' : this.enzo.state === 'dead') return;
    this.swapTo(to, this.tag >= TAG_FULL && this.phase === 'fight' && this.living.length > 0);
  }
  private swapTo(to: Hero, strike: boolean) {
    const from = this.hero; this.hero = to; this.swapCd = SWAP.rest; this.stats.swaps++; this.bufAttack = 99; this.bufDodge = 99; this.combo = 0;
    const tg = this.targetFoe ?? this.living[0] ?? null;
    // the one going out skips back (and cannot be struck: only the hero in front is a target)
    if (from === 'dora' && this.state !== 'dead') this.setState('tagout');
    if (from === 'enzo' && this.enzo.state !== 'dead') this.setEnzo('tagout');
    if (strike && tg) {
      this.tag = 0; this.stats.tags++; this.events.push({ t: 'tag', to });
      if (to === 'enzo') {
        const e = this.enzo, a = Math.atan2(this.x - tg.x, this.z - tg.z) + 0.9;
        this.setEnzo('leap'); e.tx = tg.x + Math.sin(a) * 1.9; e.tz = tg.z + Math.cos(a) * 1.9; e.invuln = Math.max(e.invuln, TAG.len + 10);
      } else { this.setState('tagin'); this.invuln = Math.max(this.invuln, DASH.len + 10); this.face = Math.atan2(tg.x - this.x, tg.z - this.z); }
    } else {
      this.events.push({ t: 'swap', to });
      if (to === 'enzo') this.setEnzo('idle'); else this.setState('idle');
    }
    // the hero coming in keeps what they were last locked on to
    if (tg) this.target = tg.id;
  }

  // ---------------------------------------------------------------- Dora
  private stepDora(inp: Input, pressed: { attack: boolean; guard: boolean; dodge: boolean; tag: boolean; swap: boolean }) {
    this.t++; this.guardT++;
    if (this.invuln > 0) this.invuln--;
    if (this.dodgeCd > 0) this.dodgeCd--;
    const tg = this.targetFoe, s = this.state;
    if (s === 'dead' || s === 'win') return;
    const mag = Math.hypot(inp.x, inp.z), mx = mag > 1 ? inp.x / mag : inp.x, mz = mag > 1 ? inp.z / mag : inp.z, moving = mag > 0.15;
    const faceTarget = () => { if (tg) this.face = Math.atan2(tg.x - this.x, tg.z - this.z); };
    const fighting = this.phase === 'fight' || this.phase === 'intro';
    const free = s === 'idle' || s === 'run' || s === 'guard' || s === 'wait' || s === 'tagout' || s === 'help';
    // posture drains when the guard has had a rest
    if (s !== 'guard' && s !== 'broken' && this.tick_ - this.lastBlock > 60) this.posture = Math.max(0, this.posture - 0.35);

    if (s === 'hit') { if (this.t >= 20) this.setState('idle'); return; }
    if (s === 'recoil') { if (this.t >= 8 && inp.guard) this.startGuard(pressed.guard); else if (this.t >= 18) this.setState('idle'); return; }
    if (s === 'broken') { if (this.t >= 70) { this.posture = 0; this.setState('idle'); } return; }
    if (s === 'deflect') { faceTarget(); if (this.t >= 14 || (this.t >= 5 && (this.bufAttack < 10 || inp.guard))) this.setState(inp.guard ? 'guard' : 'idle'); else return; }
    if (s === 'finisher') {
      const f = this.foe(this.target);
      if (this.t === FINISHER.hit && f && f.state !== 'dead') {
        this.events.push({ t: 'finisherHit', id: f.id, x: f.x, z: f.z }); this.stats.finishers++; this.addCombo();
        f.posture = 0; this.hurtFoe(f, f.kind === 'bear' ? 90 : 60);
        if ((f.state as FoeState) !== 'dead') this.setFoe(f, 'hit', 50);
      }
      if (this.t >= FINISHER.len) this.setState('idle');
      return;
    }
    if (s === 'tag') { if (this.t >= TAG.len) this.setState('idle'); return; }
    if (s === 'tagin') { // the dash in on a full meter: across to her target, one heavy cut
      if (tg && this.t < DASH.hit) { faceTarget(); const d = this.dist(tg), want = FOES[tg.kind].radius + 1.1; if (d > want) { const k = Math.min(d - want, 0.45); this.x += Math.sin(this.face) * k; this.z += Math.cos(this.face) * k; this.keepIn(this); } }
      if (this.t === DASH.hit) {
        this.events.push({ t: 'tagHit', x: this.x + Math.sin(this.face) * 1.2, z: this.z + Math.cos(this.face) * 1.2 });
        for (const f of this.living) {
          if (this.dist(f) > CUTS[2].reach + FOES[f.kind].radius + 0.4 || Math.abs(wrap(Math.atan2(f.x - this.x, f.z - this.z) - this.face)) > 1.2) continue;
          this.addCombo(); this.addPosture(f, DASH.post * (this.ups.feather ? 1.25 : 1)); this.hurtFoe(f, DASH.dmg * (this.ups.edge ? 1.2 : 1));
          const now = f.state as FoeState; if (now !== 'dead' && now !== 'broken') this.setFoe(f, 'hit', 40);
        }
      }
      if (this.t >= DASH.len) this.setState('idle');
      return;
    }
    if (s === 'dodge') {
      const v = DODGE.dist / DODGE.len * (this.t < 14 ? 1.5 : 0.25);
      this.x += this.dodgeX * v; this.z += this.dodgeZ * v; this.keepIn(this);
      if (this.t >= DODGE.len) { this.dodgeCd = 8; this.setState('idle'); }
      return;
    }
    const cut = s === 'cut1' ? 0 : s === 'cut2' ? 1 : s === 'cut3' ? 2 : -1;
    if (cut >= 0) {
      const c = CUTS[cut];
      if (this.t <= c.hit && tg) { // step in towards the target as the cut starts
        faceTarget(); const d = this.dist(tg), want = FOES[tg.kind].radius + 1.15, reach = this.assist ? 5 : 3.2;
        if (d > want && d < reach) { const k = Math.min((d - want) / Math.max(1, c.hit - this.t + 1), 0.5); this.x += Math.sin(this.face) * k; this.z += Math.cos(this.face) * k; }
      }
      if (this.t === c.hit && !this.cutDone) {
        this.cutDone = true;
        for (const f of this.living) {
          const d = this.dist(f), a = Math.abs(wrap(Math.atan2(f.x - this.x, f.z - this.z) - this.face));
          if (d > c.reach + FOES[f.kind].radius || a > 1.15) continue;
          const open = f.state === 'broken' || f.state === 'deflected' || f.state === 'recover';
          // a sword turns the third cut aside and answers; an archer has only a bow, and cannot
          if (!open && f.kind !== 'archer' && f.state !== 'windup' && f.state !== 'strike' && f.poise >= 3) {
            f.poise = 0; f.cd = 0; this.setFoe(f, 'stalk'); this.events.push({ t: 'parried', id: f.id, x: (f.x + this.x) / 2, z: (f.z + this.z) / 2 });
            this.setState('recoil'); return;
          }
          if (!open) f.poise++;
          this.stats.hits++; this.addCombo(); this.addTag(6);
          this.events.push({ t: 'hit', id: f.id, x: f.x, z: f.z, heavy: cut === 2 });
          this.addPosture(f, c.post * (open ? 1.3 : 1) * (this.ups.feather ? 1.25 : 1));
          this.hurtFoe(f, c.dmg * (f.state === 'broken' ? 1.5 : 1) * (this.ups.edge ? 1.2 : 1));
          // nothing stops a foe that has started its swing: cutting into a wind-up is a trade. Otherwise a fox, the
          // puma or an archer flinches at every cut and the bear only at the heavy third
          const now = f.state as FoeState;
          if (now === 'dead' || now === 'broken' || now === 'strike' || now === 'windup') continue;
          if (f.kind !== 'bear' || cut === 2) this.setFoe(f, 'hit', cut === 2 ? 26 : 16);
        }
      }
      if (this.t > c.hit && this.bufAttack < 14) this.queued = true;
      const cancel = this.t > c.hit + 1;
      if (cancel && this.bufDodge < 8 && this.dodgeCd === 0) { this.startDodge(mx, mz, moving, tg); return; }
      if (cancel && inp.guard) { this.startGuard(pressed.guard); return; }
      if (this.t >= c.len - (this.queued ? 6 : 0)) {
        if (this.queued && fighting) { this.bufAttack = 99; if (!this.tryFinisher(tg)) this.startCut(cut === 2 ? 0 : cut + 1, tg); }
        else this.setState('idle');
      }
      return;
    }
    if (!free) return;
    if (this.bufDodge < 8 && this.dodgeCd === 0) { this.startDodge(mx, mz, moving, tg); return; }
    if (this.bufAttack < 10 && fighting) {
      this.bufAttack = 99;
      if (!this.tryFinisher(tg)) this.startCut(0, tg);
      return;
    }
    if (inp.guard) {
      if (s !== 'guard') this.startGuard(pressed.guard);
      faceTarget();
      if (moving) { this.x += mx * 1.6 * DT; this.z += mz * 1.6 * DT; this.keepIn(this); }
      return;
    }
    if (moving) {
      this.x += mx * 4.6 * DT; this.z += mz * 4.6 * DT; this.keepIn(this);
      this.face += wrap(Math.atan2(mx, mz) - this.face) * 0.3;
      if (s !== 'run') this.setState('run');
    } else if (s !== 'idle') this.setState('idle');
  }
  /** a cut at a foe whose posture is broken becomes the finisher */
  private tryFinisher(tg: Foe | null) {
    if (!tg || tg.state !== 'broken' || this.dist(tg) > 3.4 + FOES[tg.kind].radius) return false;
    this.face = Math.atan2(tg.x - this.x, tg.z - this.z);
    const d = Math.min(this.dist(tg), FOES[tg.kind].radius + 1.2);
    this.x = tg.x - Math.sin(this.face) * d; this.z = tg.z - Math.cos(this.face) * d;
    this.setState('finisher'); this.invuln = Math.max(this.invuln, FINISHER.len); this.events.push({ t: 'finisher', id: tg.id });
    return true;
  }
  private startCut(n: number, tg: Foe | null) {
    if (tg) this.face = Math.atan2(tg.x - this.x, tg.z - this.z);
    this.setState(n === 0 ? 'cut1' : n === 1 ? 'cut2' : 'cut3'); this.events.push({ t: 'swing', n });
  }
  private startGuard(fresh: boolean) {
    // a fresh press opens the deflect window; pressing again straight away (mashing) halves it without assist
    if (fresh) { const mash = !this.assist && this.tick_ - this.guardPress < 24; this.guardPress = this.tick_; this.guardT = mash ? Math.ceil(this.deflectWindow / 2) : 0; }
    this.setState('guard');
  }
  private startDodge(mx: number, mz: number, moving: boolean, tg: Foe | null) {
    this.bufDodge = 99;
    if (moving) { const m = Math.hypot(mx, mz); this.dodgeX = mx / m; this.dodgeZ = mz / m; }
    else if (tg) { const d = this.dist(tg) || 1; this.dodgeX = (this.x - tg.x) / d; this.dodgeZ = (this.z - tg.z) / d; }
    else { this.dodgeX = -Math.sin(this.face); this.dodgeZ = -Math.cos(this.face); }
    this.setState('dodge'); this.events.push({ t: 'dodge' });
  }

  // ---------------------------------------------------------------- Enzo, in front
  private stepEnzo(inp: Input, pressed: { attack: boolean; guard: boolean; dodge: boolean }) {
    const e = this.enzo; e.t++;
    if (e.invuln > 0) e.invuln--;
    if (e.wardCd > 0) e.wardCd--;
    if (e.hopCd > 0) e.hopCd--;
    const tg = this.targetFoe, s = e.state;
    if (s === 'dead' || s === 'win') return;
    const mag = Math.hypot(inp.x, inp.z), mx = mag > 1 ? inp.x / mag : inp.x, mz = mag > 1 ? inp.z / mag : inp.z, moving = mag > 0.15;
    const faceTarget = () => { if (tg) e.face = Math.atan2(tg.x - e.x, tg.z - e.z); };
    const fighting = this.phase === 'fight' || this.phase === 'intro';
    if (s === 'leap') { // in on a full meter: a leap to the foe, then the lantern
      const k = Math.min(1, e.t / 22); e.x = e.tx + (e.x - e.tx) * (1 - k * 0.35); e.z = e.tz + (e.z - e.tz) * (1 - k * 0.35);
      faceTarget(); if (e.t >= 22) { e.x = e.tx; e.z = e.tz; this.setEnzo('strike'); }
      return;
    }
    if (s === 'strike') {
      if (e.t === TAG.hit - 22) {
        this.events.push({ t: 'tagHit', x: e.x, z: e.z });
        for (const o of this.living) {
          if (Math.hypot(o.x - e.x, o.z - e.z) > TAG.radius + FOES[o.kind].radius) continue;
          this.addCombo(); this.addPosture(o, this.ups.flame ? 70 : 50); this.hurtFoe(o, this.ups.flame ? 26 : 20);
          const now = o.state as FoeState;
          if (now !== 'dead' && now !== 'broken') this.setFoe(o, 'hit', 50);
        }
      }
      if (e.t >= 30) this.setEnzo('idle');
      return;
    }
    if (s === 'hit') { if (e.t >= 20) this.setEnzo('idle'); return; }
    if (s === 'hop') {
      const v = HOP.dist / HOP.len * (e.t < 12 ? 1.4 : 0.3);
      e.x += e.hopX * v; e.z += e.hopZ * v; this.keepIn(e);
      if (e.t >= HOP.len) { e.hopCd = 8; this.setEnzo('idle'); }
      return;
    }
    if (s === 'sweep') {
      if (e.t < SWEEP.hit - 6) faceTarget();
      if (e.t === SWEEP.hit) {
        let n = 0;
        for (const f of this.living) {
          const d = this.distE(f), a = Math.abs(wrap(Math.atan2(f.x - e.x, f.z - e.z) - e.face));
          if (d > SWEEP.reach + FOES[f.kind].radius || a > SWEEP.arc) continue;
          n++; this.stats.hits++; this.addCombo(); this.addTag(4);
          const open = f.state === 'broken' || f.state === 'deflected' || f.state === 'recover';
          this.events.push({ t: 'hit', id: f.id, x: f.x, z: f.z, heavy: false });
          this.addPosture(f, SWEEP.post * (open ? 1.3 : 1) * (this.ups.flame ? 1.3 : 1));
          this.hurtFoe(f, SWEEP.dmg * (f.state === 'broken' ? 1.5 : 1));
          // light pushes them back a step, but stops nobody: a foe swept in its wind-up still swings
          if (f.state !== 'dead' && f.state !== 'broken') { const k = 0.35 / (d || 1); f.x += (f.x - e.x) * k; f.z += (f.z - e.z) * k; this.keepIn(f); }
        }
        this.events.push({ t: 'sweepHit', x: e.x + Math.sin(e.face) * 1.6, z: e.z + Math.cos(e.face) * 1.6, n });
      }
      if (e.t > SWEEP.hit + 4 && this.bufDodge < 8 && e.hopCd === 0) { this.startHop(mx, mz, moving, tg); return; }
      if (e.t > SWEEP.hit + 4 && this.bufGuard < 10 && e.wardCd === 0) { this.startWard(); return; }
      if (e.t >= SWEEP.len) this.setEnzo('idle');
      return;
    }
    if (s === 'ward') { faceTarget(); if (e.t >= WARD.len) { e.wardCd = WARD.rest; this.setEnzo('idle'); } else if (this.bufDodge < 8 && e.hopCd === 0) { e.wardCd = WARD.rest; this.startHop(mx, mz, moving, tg); } return; }
    // free: idle, running, or just tagged in
    if (this.bufDodge < 8 && e.hopCd === 0) { this.startHop(mx, mz, moving, tg); return; }
    if (this.bufGuard < 10 && e.wardCd === 0) { this.startWard(); return; }
    if (this.bufAttack < 10 && fighting) { this.bufAttack = 99; faceTarget(); this.setEnzo('sweep'); this.events.push({ t: 'sweep' }); return; }
    if (moving) {
      e.x += mx * 4.0 * DT; e.z += mz * 4.0 * DT; this.keepIn(e);
      e.face += wrap(Math.atan2(mx, mz) - e.face) * 0.3;
      if (s !== 'run') this.setEnzo('run');
    } else { if (s !== 'idle') this.setEnzo('idle'); faceTarget(); }
  }
  private startWard() { this.bufGuard = 99; this.setEnzo('ward'); this.events.push({ t: 'ward' }); }
  private startHop(mx: number, mz: number, moving: boolean, tg: Foe | null) {
    const e = this.enzo; this.bufDodge = 99;
    if (moving) { const m = Math.hypot(mx, mz); e.hopX = mx / m; e.hopZ = mz / m; }
    else if (tg) { const d = this.distE(tg) || 1; e.hopX = (e.x - tg.x) / d; e.hopZ = (e.z - tg.z) / d; }
    else { e.hopX = -Math.sin(e.face); e.hopZ = -Math.cos(e.face); }
    this.setEnzo('hop'); this.events.push({ t: 'hop' });
  }

  // ---------------------------------------------------------------- the partner
  /** where the one not fighting waits: behind the hero, to one side, out of the way */
  private partnerSpot(px: number, pz: number) {
    const m = this.me, tg = this.targetFoe ?? this.living[0];
    let ux = 0, uz = -1; if (tg) { const dx = tg.x - m.x, dz = tg.z - m.z, l = Math.hypot(dx, dz) || 1; ux = dx / l; uz = dz / l; }
    // keep to whichever side the partner is already on
    const side = (px - m.x) * uz - (pz - m.z) * ux >= 0 ? 1 : -1;
    const o = { x: m.x - ux * NEAR.back + uz * NEAR.side * side, z: m.z - uz * NEAR.back - ux * NEAR.side * side };
    this.keepIn(o, ARENA_R - 0.6); return o;
  }
  private walkTo(o: { x: number; z: number; face: number }, to: { x: number; z: number }, speed: number) {
    const dx = to.x - o.x, dz = to.z - o.z, d = Math.hypot(dx, dz);
    if (d < 0.2) return false;
    const v = Math.min(d, speed * DT * (d > 2 ? 1.3 : 1)); o.x += (dx / d) * v; o.z += (dz / d) * v; o.face += wrap(Math.atan2(dx, dz) - o.face) * 0.25;
    return true;
  }
  /** a foe near the partner that is not busy swinging at the hero: the partner may have a go at it */
  private helpTarget(px: number, pz: number, reach: number) {
    return this.living.find((f) => f.state !== 'windup' && f.state !== 'strike' && f.state !== 'broken' && Math.hypot(f.x - px, f.z - pz) < reach + FOES[f.kind].radius) ?? null;
  }
  /** the partner steps in to help, then the cut or the swing lands on whoever is in reach */
  private helpStep(o: { x: number; z: number; face: number }, t: number, hit: number, reach: number) {
    const f = this.helpTarget(o.x, o.z, HELP.reach + 0.6);
    if (f) { o.face = Math.atan2(f.x - o.x, f.z - o.z); const d = Math.hypot(f.x - o.x, f.z - o.z), want = FOES[f.kind].radius + reach - 0.5; if (t < hit && d > want) { const k = Math.min(d - want, 0.14); o.x += Math.sin(o.face) * k; o.z += Math.cos(o.face) * k; this.keepIn(o); } }
    return t === hit ? this.helpTarget(o.x, o.z, reach) : null;
  }
  /** Enzo while Dora fights: he waits near, lifts the lantern now and then at a foe that wanders close */
  private stepEnzoPartner() {
    const e = this.enzo; e.t++;
    if (e.invuln > 0) e.invuln--;
    const s = e.state, tg = this.targetFoe;
    if (s === 'dead' || s === 'win') return;
    if (s === 'leap' || s === 'strike') return; // cannot happen while Dora is in front, but stay still if it does
    if (s === 'tagout') { const v = 3.2 * DT; const tgt = this.partnerSpot(e.x, e.z), dx = tgt.x - e.x, dz = tgt.z - e.z, d = Math.hypot(dx, dz) || 1; e.x += (dx / d) * v; e.z += (dz / d) * v; if (e.t >= SWAP.out) this.setEnzo('wait'); return; }
    if (s === 'help') {
      const f = this.helpStep(e, e.t, SWEEP.hit, SWEEP.reach);
      if (f) { this.addPosture(f, 8); this.hurtFoe(f, 2); this.events.push({ t: 'help', who: 'enzo' }, { t: 'hit', id: f.id, x: f.x, z: f.z, heavy: false }); }
      if (e.t >= SWEEP.len) this.setEnzo('wait');
      return;
    }
    if (s !== 'wait') this.setEnzo('wait');
    const moved = this.walkTo(e, this.partnerSpot(e.x, e.z), 3.6);
    if (!moved && tg) e.face += wrap(Math.atan2(tg.x - e.x, tg.z - e.z) - e.face) * 0.2;
    if (this.phase === 'fight' && --this.helpCd <= 0) { this.helpCd = HELP.every + Math.floor(this.rand() * 120); if (this.helpTarget(e.x, e.z, HELP.reach)) this.setEnzo('help'); }
  }
  /** Dora while Enzo fights: she waits near with her sword low, and cuts at a foe that wanders close */
  private stepDoraPartner() {
    this.t++; if (this.invuln > 0) this.invuln--;
    if (this.tick_ - this.lastBlock > 60) this.posture = Math.max(0, this.posture - 0.35);
    const s = this.state, tg = this.targetFoe;
    if (s === 'dead' || s === 'win') return;
    if (s === 'tagout') { const v = 3.4 * DT, tgt = this.partnerSpot(this.x, this.z), dx = tgt.x - this.x, dz = tgt.z - this.z, d = Math.hypot(dx, dz) || 1; this.x += (dx / d) * v; this.z += (dz / d) * v; if (this.t >= SWAP.out) this.setState('wait'); return; }
    if (s === 'help') {
      const f = this.helpStep(this, this.t, CUTS[0].hit, CUTS[0].reach + 0.2);
      if (f) { this.addPosture(f, 4); this.hurtFoe(f, 3); this.events.push({ t: 'help', who: 'dora' }, { t: 'hit', id: f.id, x: f.x, z: f.z, heavy: false }); }
      if (this.t >= CUTS[0].len) this.setState('wait');
      return;
    }
    // anything she was doing when Enzo came in is over: she steps back to wait
    if (s !== 'wait') this.setState('wait');
    const moved = this.walkTo(this, this.partnerSpot(this.x, this.z), 3.8);
    if (!moved && tg) this.face += wrap(Math.atan2(tg.x - this.x, tg.z - this.z) - this.face) * 0.2;
    if (this.phase === 'fight' && --this.helpCd <= 0) { this.helpCd = HELP.every + Math.floor(this.rand() * 120); if (this.helpTarget(this.x, this.z, HELP.reach)) this.setState('help'); }
  }

  // ---------------------------------------------------------------- foes
  private stepFoe(f: Foe) {
    f.t++;
    const m = this.me, st = FOES[f.kind], dx = m.x - f.x, dz = m.z - f.z, d = Math.hypot(dx, dz) || 0.001, to = Math.atan2(dx, dz);
    const turn = (rate: number) => { f.face += clamp(wrap(to - f.face), -rate, rate); };
    if (f.state !== 'broken' && f.state !== 'dead' && ++f.calm > 150) f.posture = Math.max(0, f.posture - 0.12);
    const up = this.meUp, archer = f.kind === 'archer';
    const busy = this.hero === 'dora' ? this.state === 'finisher' || this.state === 'tag' || this.state === 'tagin' : this.enzo.state === 'leap' || this.enzo.state === 'strike';
    switch (f.state) {
      case 'dead': if (f.t >= f.len) f.gone = true; return;
      case 'enter': {
        turn(0.2); f.x += Math.sin(f.face) * st.speed * DT; f.z += Math.cos(f.face) * st.speed * DT;
        if (Math.hypot(f.x, f.z) < ARENA_R - 1.6 && this.phase === 'fight') this.setFoe(f, 'stalk');
        return;
      }
      case 'hit': case 'deflected': {
        if (f.t < 8) { f.x -= Math.sin(to) * 2.2 * DT; f.z -= Math.cos(to) * 2.2 * DT; this.keepIn(f); }
        if (f.t >= f.len) { f.cd = Math.max(f.cd, 26); this.setFoe(f, 'stalk'); }
        return;
      }
      case 'broken': if (f.t >= f.len) { f.posture = 0; f.cd = 40; this.setFoe(f, 'stalk'); } return;
      case 'stalk': {
        turn(0.12);
        const mine = this.token === -1 || this.token === f.id;
        let vx = 0, vz = 0;
        if (archer) { // stand back: give ground when the hero closes, come in when too far to aim
          if (d < st.reach - 1.6) { vx -= Math.sin(to) * 0.9; vz -= Math.cos(to) * 0.9; } else if (d > st.reach + 1.4) { vx += Math.sin(to); vz += Math.cos(to); }
          vx += Math.cos(to) * f.strafe * 0.3; vz -= Math.sin(to) * f.strafe * 0.3;
        } else {
          const want = mine ? st.reach : st.reach + 1.6;
          if (d > want + 0.3) { vx += Math.sin(to); vz += Math.cos(to); } else if (d < want - 0.6) { vx -= Math.sin(to) * 0.6; vz -= Math.cos(to) * 0.6; }
          vx += Math.cos(to) * f.strafe * 0.4; vz -= Math.sin(to) * f.strafe * 0.4;
        }
        f.x += vx * st.speed * DT; f.z += vz * st.speed * DT; this.keepIn(f, archer ? ARENA_R - 0.3 : ARENA_R);
        if (this.rand() < 0.006) f.strafe = -f.strafe;
        if (f.cd > 0) f.cd--;
        if (f.cd <= 0 && mine && up && this.phase === 'fight' && !busy) {
          const list = ATTACKS[f.kind].filter((a) => d < a.range + a.lunge + 0.4);
          if (list.length) {
            const atk = list[Math.floor(this.rand() * list.length)], slow = this.assist ? 1.25 : 1;
            this.token = f.id; this.setFoe(f, 'windup'); f.atk = { ...atk, windup: Math.round(atk.windup * slow) };
            f.poise = 0; f.aimX = m.x; f.aimZ = m.z; this.events.push({ t: 'windup', id: f.id, jade: atk.jade, atk: atk.id });
          }
        }
        return;
      }
      case 'windup': {
        const a = f.atk!;
        if (archer) {
          // the red line follows the hero until it locks, then the arrow goes where the line points
          if (f.t < a.windup - ARROW.lock) { turn(0.2); f.aimX = m.x; f.aimZ = m.z; }
          if (f.t >= a.windup) {
            const ax = f.aimX - f.x, az = f.aimZ - f.z, l = Math.hypot(ax, az) || 1;
            f.face = Math.atan2(ax, az);
            this.arrows.push({ id: f.id, from: f.id, x: f.x + (ax / l) * 0.5, z: f.z + (az / l) * 0.5, vx: (ax / l) * ARROW.speed, vz: (az / l) * ARROW.speed, flown: 0, dead: false });
            this.setFoe(f, 'strike'); f.atk = a; this.events.push({ t: 'strike', id: f.id, atk: a.id }, { t: 'loose', id: f.id });
          }
          return;
        }
        if (f.t < a.windup - 10) turn(0.08);
        if (f.t >= a.windup - 8 && a.lunge > 0 && d > st.radius + 1.0) { const k = Math.min(a.lunge / 8, d - st.radius - 1.0); f.x += Math.sin(f.face) * k; f.z += Math.cos(f.face) * k; this.keepIn(f); }
        if (f.t >= a.windup) { this.setFoe(f, 'strike'); f.atk = a; this.events.push({ t: 'strike', id: f.id, atk: a.id }); }
        return;
      }
      case 'strike': {
        const a = f.atk!;
        if (!archer && !f.done && up) {
          const off = Math.abs(wrap(to - f.face));
          if (d <= a.range + 0.35 && off <= a.arc) { f.done = true; this.resolve(f, a); }
        }
        if (f.t >= a.active) { this.setFoe(f, 'recover'); f.atk = a; }
        return;
      }
      case 'recover': {
        const a = f.atk!;
        if (f.t >= a.recover) {
          const hurt = f.kind === 'bear' && f.hp < f.maxHp / 2, cd = hurt ? [30, 60] : st.cd, slow = this.assist ? 1.15 : 1;
          f.cd = Math.round((cd[0] + this.rand() * (cd[1] - cd[0])) * slow); this.setFoe(f, 'stalk');
        }
        return;
      }
    }
  }
  /** arrows fly straight down the line; only the hero in front can be struck */
  private stepArrows() {
    for (const a of this.arrows) {
      if (a.dead) continue;
      a.x += a.vx; a.z += a.vz; a.flown += ARROW.speed;
      if (a.flown > ARROW.range || Math.hypot(a.x, a.z) > ARENA_R + 3) { a.dead = true; continue; }
      if (!this.meUp) continue;
      const m = this.me, d = Math.hypot(a.x - m.x, a.z - m.z);
      // Enzo's ward stops it short of him
      if (this.hero === 'enzo' && this.enzo.state === 'ward' && d < WARD.r) { a.dead = true; this.stats.warded++; this.addTag(10); this.addCombo(); this.events.push({ t: 'warded', x: a.x, z: a.z }); continue; }
      if (d < ARROW.hit) { a.dead = true; const f = this.foe(a.from); this.resolveArrow(f, a); }
    }
    this.arrows = this.arrows.filter((a) => !a.dead);
  }
  private resolveArrow(f: Foe | null, a: Arrow) {
    const atk = ATTACKS.archer[0], dmg = atk.dmg * (this.assist ? 0.75 : 1);
    if (this.hero === 'enzo') {
      const e = this.enzo;
      if (e.state === 'hop' && e.t >= HOP.from && e.t <= HOP.to) { this.addTag(8); this.events.push({ t: 'evade' }); return; }
      if (e.invuln > 0) return;
      this.hurtEnzo(dmg, false); this.events.push({ t: 'arrowHit', x: a.x, z: a.z });
      return;
    }
    if (this.state === 'dodge' && this.t >= DODGE.from && this.t <= DODGE.to) { this.addTag(8); this.events.push({ t: 'evade' }); return; }
    if (this.invuln > 0 || this.state === 'finisher' || this.state === 'tag' || this.state === 'tagin') return;
    if (this.state === 'guard' || this.state === 'deflect') {
      if (this.guardT <= this.deflectWindow || this.state === 'deflect') { // the arrow is turned aside, and the archer's nerve shaken
        this.stats.deflects++; this.addCombo(); this.addTag(22); this.guardT = 0; this.setState('deflect');
        this.events.push({ t: 'deflect', id: f?.id ?? -1, x: a.x, z: a.z }); if (f && f.state !== 'dead') this.addPosture(f, 30);
        return;
      }
      this.lastBlock = this.tick_; this.posture += atk.press; this.events.push({ t: 'block', x: a.x, z: a.z });
      if (this.posture >= 100) { this.posture = 100; this.setState('broken'); this.events.push({ t: 'guardBroken' }); }
      return;
    }
    this.hurtDora(dmg, false); this.events.push({ t: 'arrowHit', x: a.x, z: a.z });
  }
  /** a foe's strike has reached the hero in front */
  private resolve(f: Foe, a: Attack) {
    if (this.hero === 'enzo') { this.resolveEnzo(f, a); return; }
    if (this.state === 'dodge' && this.t >= DODGE.from && this.t <= DODGE.to) { this.addTag(8); this.events.push({ t: 'evade' }); return; }
    if (this.invuln > 0 || this.state === 'finisher' || this.state === 'tag' || this.state === 'tagin') return;
    const mx = (this.x + f.x) / 2, mz = (this.z + f.z) / 2;
    if (!a.jade && (this.state === 'guard' || this.state === 'deflect')) {
      if (this.guardT <= this.deflectWindow || this.state === 'deflect') {
        this.stats.deflects++; this.addCombo(); this.addTag(22); this.guardT = 0; this.setState('deflect');
        this.events.push({ t: 'deflect', id: f.id, x: mx, z: mz });
        this.setFoe(f, 'deflected', 46); this.addPosture(f, f.kind === 'bear' ? 46 : 40);
        return;
      }
      this.lastBlock = this.tick_; this.posture += a.press; this.events.push({ t: 'block', x: mx, z: mz });
      if (this.posture >= 100) { this.posture = 100; this.setState('broken'); this.events.push({ t: 'guardBroken' }); }
      return;
    }
    this.hurtDora(a.dmg * (this.assist ? 0.75 : 1), a.jade);
  }
  /** Enzo cannot deflect: a hop clears a blow, and the ward only softens steel (it is made for arrows) */
  private resolveEnzo(f: Foe, a: Attack) {
    const e = this.enzo;
    if (e.state === 'hop' && e.t >= HOP.from && e.t <= HOP.to) { this.addTag(8); this.events.push({ t: 'evade' }); return; }
    if (e.invuln > 0 || e.state === 'leap' || e.state === 'strike') return;
    let dmg = a.dmg * (this.assist ? 0.75 : 1);
    if (!a.jade && e.state === 'ward') { dmg *= 0.5; this.events.push({ t: 'block', x: (e.x + f.x) / 2, z: (e.z + f.z) / 2 }); }
    this.hurtEnzo(dmg, a.jade);
  }
  private hurtDora(dmg: number, jade: boolean) {
    this.hp = Math.max(0, this.hp - dmg); this.stats.damage += dmg; this.combo = 0; this.invuln = 40;
    this.events.push({ t: 'hurt', dmg, jade, who: 'dora' });
    if (this.hp <= 0) { this.setState('dead'); this.token = -1; this.events.push({ t: 'down', who: 'dora' }); } else this.setState('hit');
  }
  private hurtEnzo(dmg: number, jade: boolean) {
    const e = this.enzo;
    e.hp = Math.max(0, e.hp - dmg); this.stats.damage += dmg; this.combo = 0; e.invuln = 40;
    this.events.push({ t: 'hurt', dmg, jade, who: 'enzo' });
    if (e.hp <= 0) { this.setEnzo('dead'); this.token = -1; this.events.push({ t: 'down', who: 'enzo' }); } else this.setEnzo('hit');
  }
  private separate() {
    const me = this.hero === 'dora' ? this : this.enzo, mate = this.hero === 'dora' ? this.enzo : this;
    const fixedMe = this.hero === 'dora' ? this.state === 'finisher' : this.enzo.state === 'leap';
    const bodies: { o: { x: number; z: number }; r: number; fixed: boolean }[] = [{ o: me, r: 0.45, fixed: fixedMe }];
    for (const f of this.living) bodies.push({ o: f, r: FOES[f.kind].radius, fixed: f.state === 'broken' });
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.o.x - a.o.x, dz = b.o.z - a.o.z, d = Math.hypot(dx, dz) || 0.001, min = a.r + b.r + 0.1;
      if (d >= min) continue;
      const push = (min - d) / d, wa = a.fixed ? 0 : b.fixed ? 1 : 0.5, wb = 1 - wa;
      if (a.fixed && b.fixed) continue;
      a.o.x -= dx * push * wa; a.o.z -= dz * push * wa; b.o.x += dx * push * wb; b.o.z += dz * push * wb;
    }
    // the partner steps out of everyone's way, and never pushes
    for (const b of bodies) { const dx = mate.x - b.o.x, dz = mate.z - b.o.z, d = Math.hypot(dx, dz) || 0.001, min = b.r + 0.5; if (d < min) { mate.x += (dx / d) * (min - d); mate.z += (dz / d) * (min - d); } }
    this.keepIn(this); this.keepIn(this.enzo); for (const f of this.living) if (f.state !== 'enter') this.keepIn(f);
  }
}

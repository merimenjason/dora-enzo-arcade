// Cloudsteel: the rules of the duel. A fixed 60 Hz simulation with no DOM: Dora in a round of ground against rounds
// of foes (the terrace duel: Atoq the fox sellsword, two of his sword-kin, then Ukhu the bear warden; the story hands
// in one encounter at a time, with Dora's sword and Enzo's lantern upgrades). Steel attacks can be
// guarded, and guarding in the first moments of the press deflects them, which fills the foe's posture; a full
// posture bar breaks the foe open for a finisher. Jade attacks cannot be guarded and have to be dodged. Hits, deflects
// and dodges fill the tag meter that calls Enzo in. All randomness comes from the seed, so a seed replays a fight.
// The story's world (areas, talking, puzzles) is lib/cloudsteel-world.ts; drawing is in lib/cloudsteel-scene.ts, the
// page in app/cloudsteel/page.tsx.

export const DT = 1 / 60, ARENA_R = 7.6, SAVE_KEY = 'cloudsteel-v2', TAG_FULL = 100;
export type Input = { x: number; z: number; attack: boolean; guard: boolean; dodge: boolean; tag: boolean; swap: boolean };
export const idleInput = (): Input => ({ x: 0, z: 0, attack: false, guard: false, dodge: false, tag: false, swap: false });

export type FoeKind = 'fox' | 'bear' | 'puma';
/** whose painting a foe wears: Atoq, a sword-kin, the kin captain, Titu the puma or Ukhu */
export type Look = 'atoq' | 'kin' | 'mallku' | 'titu' | 'ukhu';
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
};
export const FOES: Record<FoeKind, { hp: number; posture: number; speed: number; cd: [number, number]; reach: number; radius: number }> = {
  fox: { hp: 130, posture: 100, speed: 2.7, cd: [45, 90], reach: 2.0, radius: 0.45 },
  bear: { hp: 620, posture: 180, speed: 1.9, cd: [40, 80], reach: 2.7, radius: 0.9 },
  puma: { hp: 210, posture: 120, speed: 3.0, cd: [40, 80], reach: 2.0, radius: 0.5 },
};
/** one foe of a round; `hp` overrides the kind's health (the kin captain is tougher than his kin) */
export type FoeDef = { kind: FoeKind; name: string; look: Look; hp?: number };
export type Round = { title: string; foes: FoeDef[] };
/** the terrace duel from the title menu */
export const ROUNDS: Round[] = [
  { title: 'Atoq the Sellsword', foes: [{ kind: 'fox', name: 'Atoq the Sellsword', look: 'atoq' }] },
  { title: 'The Sword-Kin', foes: [{ kind: 'fox', name: 'Sword-Kin Sami', look: 'kin' }, { kind: 'fox', name: 'Sword-Kin Wayra', look: 'kin' }] },
  { title: 'Ukhu, Warden of the Bridge', foes: [{ kind: 'bear', name: 'Ukhu, Warden of the Bridge', look: 'ukhu' }] },
];
/** what the story's upgrades do in a fight: the rain-tempered edge cuts harder, the condor-feather wrap breaks
 *  posture faster, the puma-claw guard widens the deflect moment, and the second flame fills Enzo's meter faster and
 *  makes his lantern hit harder */
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
export const ENZO_POST = { x: -6.3, z: 2.6 };

export type FoeState = 'enter' | 'stalk' | 'windup' | 'strike' | 'recover' | 'hit' | 'deflected' | 'broken' | 'dead';
export type Foe = { id: number; kind: FoeKind; look: Look; name: string; x: number; z: number; face: number; hp: number; maxHp: number; posture: number; maxPosture: number;
  state: FoeState; t: number; len: number; cd: number; atk: Attack | null; done: boolean; strafe: number; calm: number; gone: boolean;
  /** cuts taken since its last attack: at three it parries the next one and answers */
  poise: number };
export type DoraState = 'idle' | 'run' | 'cut1' | 'cut2' | 'cut3' | 'guard' | 'deflect' | 'dodge' | 'hit' | 'recoil' | 'broken' | 'finisher' | 'tag' | 'dead' | 'win';
export type Phase = 'intro' | 'fight' | 'clear' | 'won' | 'lost';
export type Rank = 'gold' | 'silver' | 'bronze';
export type FightEvent =
  | { t: 'round'; n: number } | { t: 'swing'; n: number } | { t: 'hit'; id: number; x: number; z: number; heavy: boolean } | { t: 'deflect'; id: number; x: number; z: number }
  | { t: 'block'; x: number; z: number } | { t: 'parried'; id: number; x: number; z: number } | { t: 'hurt'; dmg: number; jade: boolean } | { t: 'dodge' } | { t: 'evade' } | { t: 'windup'; id: number; jade: boolean; atk: string }
  | { t: 'strike'; id: number; atk: string } | { t: 'broken'; id: number } | { t: 'guardBroken' } | { t: 'finisher'; id: number } | { t: 'finisherHit'; id: number; x: number; z: number }
  | { t: 'tagReady' } | { t: 'tag' } | { t: 'tagHit'; x: number; z: number } | { t: 'dead'; id: number } | { t: 'clear'; n: number } | { t: 'won' } | { t: 'lost' };
export type Result = { rank: Rank; seconds: number; deflects: number; bestCombo: number; damage: number; falls: number; score: number };
/** `story` is the story's own save (lib/cloudsteel-world.ts checks it); `climbs` counts finished stories */
export type Save = { v: 2; best: Result | null; wins: number; fights: number; seenHow: boolean; settings: { assist: boolean; sound: boolean; music: boolean; fx: boolean };
  story: Record<string, unknown> | null; climbs: number };

export const newSave = (): Save => ({ v: 2, best: null, wins: 0, fights: 0, seenHow: false, settings: { assist: true, sound: true, music: true, fx: true }, story: null, climbs: 0 });
export const serialise = (s: Save) => JSON.stringify(s);
export function parseSave(raw: string | null): Save {
  const s = newSave();
  if (!raw) return s;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 2) return s;
    if (o.best && typeof o.best.score === 'number' && ['gold', 'silver', 'bronze'].includes(o.best.rank)) s.best = o.best;
    s.wins = Math.max(0, o.wins | 0); s.fights = Math.max(0, o.fights | 0); s.seenHow = !!o.seenHow;
    for (const k of ['assist', 'sound', 'music', 'fx'] as const) if (typeof o.settings?.[k] === 'boolean') s.settings[k] = o.settings[k];
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

export class Fight {
  readonly assist: boolean; readonly rounds: Round[]; readonly ups: Upgrades;
  private rand: () => number;
  tick_ = 0; phase: Phase = 'intro'; phaseT = 0; round = 0;
  // Dora. Angles are yaw: 0 faces +z, and x = sin, z = cos.
  x = 0; z = 3; face = Math.PI; hp = 100; maxHp = 100; posture = 0; state: DoraState = 'idle'; t = 0;
  invuln = 0; guardT = 99; guardPress = -999; lastBlock = -999; dodgeCd = 0; dodgeX = 0; dodgeZ = 0; cutDone = false; queued = false;
  tag = 0; target = -1; combo = 0; comboT = 0;
  enzo = { x: ENZO_POST.x, z: ENZO_POST.z, face: 0, state: 'wait' as 'wait' | 'leap' | 'strike' | 'back', t: 0, tx: 0, tz: 0 };
  foes: Foe[] = []; private nextId = 1; private token = -1;
  events: FightEvent[] = [];
  stats = { ticks: 0, deflects: 0, bestCombo: 0, damage: 0, falls: 0, hits: 0, finishers: 0, tags: 0 };
  private prev: Input = idleInput(); private bufAttack = 99; private bufDodge = 99;

  constructor(seed: number, assist = true, opts: FightOpts = {}) {
    this.rand = rng(seed); this.assist = assist; this.rounds = opts.rounds ?? ROUNDS; this.ups = { ...noUpgrades(), ...opts.ups }; this.startRound(0);
  }

  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get deflectWindow() { return (this.assist ? 14 : 9) + (this.ups.claw ? 3 : 0); }
  get living() { return this.foes.filter((f) => f.state !== 'dead'); }
  foe(id: number) { return this.foes.find((f) => f.id === id) ?? null; }
  get targetFoe() { const f = this.foe(this.target); return f && f.state !== 'dead' ? f : null; }

  private startRound(n: number) {
    this.round = n; this.phase = 'intro'; this.phaseT = 0; this.foes = []; this.token = -1;
    const defs = this.rounds[n].foes;
    defs.forEach((d, i) => {
      const a = Math.PI + (i - (defs.length - 1) / 2) * 0.7, st = FOES[d.kind], hp = d.hp ?? st.hp;
      this.foes.push({ id: this.nextId++, kind: d.kind, look: d.look, name: d.name, x: Math.sin(a) * (ARENA_R + 1.2), z: Math.cos(a) * (ARENA_R + 1.2), face: a + Math.PI, hp, maxHp: hp, posture: 0, maxPosture: st.posture,
        state: 'enter', t: 0, len: 0, cd: 40 + i * 50, atk: null, done: false, strafe: i % 2 ? 1 : -1, calm: 0, gone: false, poise: 0 });
    });
    this.target = this.foes[0].id;
    this.events.push({ t: 'round', n });
  }
  /** after a fall: the same round again, on full health */
  retryRound() {
    if (this.phase !== 'lost') return;
    this.stats.falls++; this.hp = this.maxHp; this.posture = 0; this.state = 'idle'; this.t = 0; this.x = 0; this.z = 3; this.face = Math.PI; this.invuln = 0; this.combo = 0;
    this.enzo = { x: ENZO_POST.x, z: ENZO_POST.z, face: 0, state: 'wait', t: 0, tx: 0, tz: 0 };
    this.startRound(this.round);
  }
  result(): Result {
    const s = this.stats, seconds = Math.round(s.ticks * DT);
    const rank: Rank = s.falls === 0 && s.damage <= 45 ? 'gold' : s.falls <= 1 && s.damage <= 140 ? 'silver' : 'bronze';
    const score = Math.max(0, Math.round(3000 + s.deflects * 60 + s.bestCombo * 25 + s.finishers * 100 - s.damage * 6 - s.falls * 500 - Math.max(0, seconds - 90) * 4));
    return { rank, seconds, deflects: s.deflects, bestCombo: s.bestCombo, damage: Math.round(s.damage), falls: s.falls, score };
  }

  private dist(f: Foe) { return Math.hypot(f.x - this.x, f.z - this.z); }
  private setState(s: DoraState) { this.state = s; this.t = 0; this.cutDone = false; this.queued = false; }
  private setFoe(f: Foe, s: FoeState, len = 0) {
    if (this.token === f.id && s !== 'windup' && s !== 'strike' && s !== 'recover') this.token = -1;
    f.state = s; f.t = 0; f.len = len; f.done = false;
    if (s !== 'windup' && s !== 'strike' && s !== 'recover') f.atk = null;
  }
  private keepIn(o: { x: number; z: number }, r = ARENA_R) { const d = Math.hypot(o.x, o.z); if (d > r) { o.x *= r / d; o.z *= r / d; } }
  private pickTarget() {
    let best: Foe | null = null, bd = 1e9;
    for (const f of this.living) { const d = this.dist(f); if (d < bd) { bd = d; best = f; } }
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
        if (this.round + 1 >= this.rounds.length) { this.phase = 'won'; this.phaseT = 0; this.setState('win'); this.events.push({ t: 'won' }); }
        else { this.hp = this.assist ? this.maxHp : Math.min(this.maxHp, this.hp + 40); this.posture = 0; this.startRound(this.round + 1); }
      }
    }
    if (this.phase === 'fight') this.stats.ticks++;
    if (this.over) { this.t++; this.stepEnzo(); for (const f of this.foes) f.t++; return; }
    this.stepDora(inp, pressed);
    this.stepEnzo();
    for (const f of this.foes) this.stepFoe(f);
    this.separate();
    // the round is cleared when every foe is down
    if (this.phase === 'fight' && this.foes.every((f) => f.state === 'dead')) { this.phase = 'clear'; this.phaseT = 0; this.events.push({ t: 'clear', n: this.round }); }
    if (this.phase === 'fight' && this.state === 'dead' && this.t >= 80) { this.phase = 'lost'; this.phaseT = 0; this.events.push({ t: 'lost' }); }
  }

  // ---------------------------------------------------------------- Dora
  private stepDora(inp: Input, pressed: { attack: boolean; guard: boolean; dodge: boolean; tag: boolean; swap: boolean }) {
    this.t++; this.guardT++; this.bufAttack++; this.bufDodge++;
    if (this.invuln > 0) this.invuln--;
    if (this.dodgeCd > 0) this.dodgeCd--;
    if (++this.comboT > 240) this.combo = 0;
    if (pressed.attack) this.bufAttack = 0;
    if (pressed.dodge) this.bufDodge = 0;
    if (!this.targetFoe) this.pickTarget();
    if (pressed.swap) { const l = this.living; if (l.length > 1) { const i = l.findIndex((f) => f.id === this.target); this.target = l[(i + 1) % l.length].id; } }
    const tg = this.targetFoe, s = this.state;
    if (s === 'dead' || s === 'win') return;
    const mag = Math.hypot(inp.x, inp.z), mx = mag > 1 ? inp.x / mag : inp.x, mz = mag > 1 ? inp.z / mag : inp.z, moving = mag > 0.15;
    const faceTarget = () => { if (tg) this.face = Math.atan2(tg.x - this.x, tg.z - this.z); };
    const fighting = this.phase === 'fight' || this.phase === 'intro';
    const free = s === 'idle' || s === 'run' || s === 'guard';
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
    if (s === 'dodge') {
      const v = DODGE.dist / DODGE.len * (this.t < 14 ? 1.5 : 0.25);
      this.x += this.dodgeX * v; this.z += this.dodgeZ * v; this.keepIn(this);
      if (this.t >= DODGE.len) { this.dodgeCd = 8; this.setState('idle'); }
      return;
    }
    // Enzo's tag: any time Dora is on her feet
    if (pressed.tag && this.tag >= TAG_FULL && fighting && this.living.length && this.enzo.state === 'wait') {
      const f = tg ?? this.living[0];
      this.tag = 0; this.stats.tags++; this.setState('tag'); this.invuln = Math.max(this.invuln, TAG.len + 10);
      this.enzo.state = 'leap'; this.enzo.t = 0; const a = Math.atan2(this.x - f.x, this.z - f.z) + 0.9;
      this.enzo.tx = f.x + Math.sin(a) * 1.9; this.enzo.tz = f.z + Math.cos(a) * 1.9;
      this.events.push({ t: 'tag' }); return;
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
          if (!open && f.state !== 'windup' && f.state !== 'strike' && f.poise >= 3) { // the foe turns the cut aside and answers
            f.poise = 0; f.cd = 0; this.setFoe(f, 'stalk'); this.events.push({ t: 'parried', id: f.id, x: (f.x + this.x) / 2, z: (f.z + this.z) / 2 });
            this.setState('recoil'); return;
          }
          if (!open) f.poise++;
          this.stats.hits++; this.addCombo(); this.addTag(6);
          this.events.push({ t: 'hit', id: f.id, x: f.x, z: f.z, heavy: cut === 2 });
          this.addPosture(f, c.post * (open ? 1.3 : 1) * (this.ups.feather ? 1.25 : 1));
          this.hurtFoe(f, c.dmg * (f.state === 'broken' ? 1.5 : 1) * (this.ups.edge ? 1.2 : 1));
          // nothing stops a foe that has started its swing: cutting into a wind-up is a trade. Otherwise a fox or
          // the puma flinches at every cut and the bear only at the heavy third
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

  // ---------------------------------------------------------------- Enzo
  private stepEnzo() {
    const e = this.enzo; e.t++;
    const f = this.targetFoe;
    if (e.state === 'wait') { e.face = Math.atan2((f ? f.x : 0) - e.x, (f ? f.z : 0) - e.z); return; }
    if (e.state === 'leap') {
      const k = Math.min(1, e.t / 22); e.x = ENZO_POST.x + (e.tx - ENZO_POST.x) * k; e.z = ENZO_POST.z + (e.tz - ENZO_POST.z) * k;
      if (f) e.face = Math.atan2(f.x - e.x, f.z - e.z);
      if (e.t >= 22) { e.state = 'strike'; e.t = 0; }
    } else if (e.state === 'strike') {
      if (e.t === TAG.hit - 22) {
        this.events.push({ t: 'tagHit', x: e.x, z: e.z });
        for (const o of this.living) {
          if (Math.hypot(o.x - e.x, o.z - e.z) > TAG.radius + FOES[o.kind].radius) continue;
          this.addCombo(); this.addPosture(o, this.ups.flame ? 70 : 50); this.hurtFoe(o, this.ups.flame ? 26 : 20);
          const now = o.state as FoeState;
          if (now !== 'dead' && now !== 'broken') this.setFoe(o, 'hit', 50);
        }
      }
      if (e.t >= 30) { e.state = 'back'; e.t = 0; e.tx = e.x; e.tz = e.z; }
    } else {
      const k = Math.min(1, e.t / 40); e.x = e.tx + (ENZO_POST.x - e.tx) * k; e.z = e.tz + (ENZO_POST.z - e.tz) * k; e.face = Math.atan2(ENZO_POST.x - e.tx, ENZO_POST.z - e.tz);
      if (e.t >= 40) { e.state = 'wait'; e.t = 0; }
    }
  }

  // ---------------------------------------------------------------- foes
  private stepFoe(f: Foe) {
    f.t++;
    const st = FOES[f.kind], dx = this.x - f.x, dz = this.z - f.z, d = Math.hypot(dx, dz) || 0.001, to = Math.atan2(dx, dz);
    const turn = (rate: number) => { f.face += clamp(wrap(to - f.face), -rate, rate); };
    if (f.state !== 'broken' && f.state !== 'dead' && ++f.calm > 150) f.posture = Math.max(0, f.posture - 0.12);
    const doraUp = this.state !== 'dead' && this.state !== 'win';
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
        const mine = this.token === -1 || this.token === f.id, want = mine ? st.reach : st.reach + 1.6;
        let vx = 0, vz = 0;
        if (d > want + 0.3) { vx += Math.sin(to); vz += Math.cos(to); } else if (d < want - 0.6) { vx -= Math.sin(to) * 0.6; vz -= Math.cos(to) * 0.6; }
        vx += Math.cos(to) * f.strafe * 0.4; vz -= Math.sin(to) * f.strafe * 0.4;
        f.x += vx * st.speed * DT; f.z += vz * st.speed * DT; this.keepIn(f);
        if (this.rand() < 0.006) f.strafe = -f.strafe;
        if (f.cd > 0) f.cd--;
        if (f.cd <= 0 && mine && doraUp && this.phase === 'fight' && this.state !== 'finisher' && this.state !== 'tag') {
          const list = ATTACKS[f.kind].filter((a) => d < a.range + a.lunge + 0.4);
          if (list.length) {
            const atk = list[Math.floor(this.rand() * list.length)], slow = this.assist ? 1.25 : 1;
            f.atk = { ...atk, windup: Math.round(atk.windup * slow) }; this.token = f.id; this.setFoe(f, 'windup'); f.atk = { ...atk, windup: Math.round(atk.windup * slow) };
            f.poise = 0; this.events.push({ t: 'windup', id: f.id, jade: atk.jade, atk: atk.id });
          }
        }
        return;
      }
      case 'windup': {
        const a = f.atk!;
        if (f.t < a.windup - 10) turn(0.08);
        if (f.t >= a.windup - 8 && a.lunge > 0 && d > st.radius + 1.0) { const k = Math.min(a.lunge / 8, d - st.radius - 1.0); f.x += Math.sin(f.face) * k; f.z += Math.cos(f.face) * k; this.keepIn(f); }
        if (f.t >= a.windup) { this.setFoe(f, 'strike'); f.atk = a; this.events.push({ t: 'strike', id: f.id, atk: a.id }); }
        return;
      }
      case 'strike': {
        const a = f.atk!;
        if (!f.done && doraUp) {
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
  /** a foe's strike has reached Dora */
  private resolve(f: Foe, a: Attack) {
    if (this.state === 'dodge' && this.t >= DODGE.from && this.t <= DODGE.to) { this.addTag(8); this.events.push({ t: 'evade' }); return; }
    if (this.invuln > 0 || this.state === 'finisher' || this.state === 'tag') return;
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
    const dmg = a.dmg * (this.assist ? 0.75 : 1);
    this.hp = Math.max(0, this.hp - dmg); this.stats.damage += dmg; this.combo = 0; this.invuln = 40;
    this.events.push({ t: 'hurt', dmg, jade: a.jade });
    if (this.hp <= 0) { this.setState('dead'); this.token = -1; } else this.setState('hit');
  }
  private separate() {
    const bodies: { o: { x: number; z: number }; r: number; fixed: boolean }[] = [{ o: this, r: 0.45, fixed: this.state === 'finisher' }];
    for (const f of this.living) bodies.push({ o: f, r: FOES[f.kind].radius, fixed: f.state === 'broken' });
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.o.x - a.o.x, dz = b.o.z - a.o.z, d = Math.hypot(dx, dz) || 0.001, min = a.r + b.r + 0.1;
      if (d >= min) continue;
      const push = (min - d) / d, wa = a.fixed ? 0 : b.fixed ? 1 : 0.5, wb = 1 - wa;
      if (a.fixed && b.fixed) continue;
      a.o.x -= dx * push * wa; a.o.z -= dz * push * wa; b.o.x += dx * push * wb; b.o.z += dz * push * wb;
    }
    this.keepIn(this); for (const f of this.living) if (f.state !== 'enter') this.keepIn(f);
  }
}

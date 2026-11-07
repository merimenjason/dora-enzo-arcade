// The Sunken Bellspire: the heroes' animation state machine. Drawing-side only and pure (no DOM), so the tests can
// drive it. Each tick the scene hands it a snapshot of what the hero is doing; it picks a state, keeps that state's
// clock, and answers with a frame of the hero strip plus a little squash, stretch and lean.
//
// It never holds up control: every state that shows the player's own input (run, jump, climb, attack, swim) is
// chosen straight from the body each tick, and the short one-shots (a landing, a skid, a turn) give way the moment
// the body does something else.
//
// HERO_FRAMES, the hero strips (public/art/bellspire/dora.webp and enzo.webp), 8 frames to a painted sheet:
//   a  0 idle  1-3 run (old)  4 rise  5 fall  6 hurt  7 dash
//   b  8-10 swing (old)  11 thrust (Dora) or spell (Enzo)  12 wall (Dora) or lantern up (Enzo)  13-15 swim and glide (old)
//   c 16-19 climb from behind  20 pull up over the top  21 step onto the ladder  22 landing squash  23 hard landing
//   d 24-29 run  30 skid  31 turn round
//   e 32 breathe in  33 blink  34-35 fidget  36 kneel to rest  37 from behind, looking up  38 item held high  39 lift a lid
//   f Dora: 40 wind-up  41 slash  42 low wind-up  43 rising slash  44 overhead wind-up  45 chop  46 spin  47 down-thrust
//     Enzo: 40 wind-up  41 swing  42 follow-through  43 spell wind-up  44 spell release  45 lantern high  46 chime strike  47 glide
//   g Dora: 48 wall slide  49 wall kick   Enzo: 48 glide  49 lowering the lantern
//     both: 50 knocked out  51 getting up  52 jump apex  53 hop back  54 leap in  55 holding a coin
//   h 56-59 swim strokes  60 dive  61 surface  62-63 wade
//   i Dora: 64 run start-up  65 Whirl Slash wind-up  66 spin from the front  67 spin from behind  68 pommel raised to
//           strike a bell  69 pommel strike  70-71 knee-deep, balancing
//     Enzo: 64 run start-up  65 overhead wind-up  66 overhead strike  67 low wind-up  68 (unused: its lantern was cut)  69 crouched wind-up
//           70 upward lantern swing  71 staff drawn back to strike a bell
//   j Dora: 72-74 treading water upright  75-77 and 79 spare takes  78 flying to the rope's target (the helping hand)
//     Enzo: 72 rapping a bell with the lantern end  73-74 knee-deep, balancing  75-77 treading water  78 spare  79 low sweep
//   k (the Windward Belfry) Dora: 80 throwing the Bell Rope  81 swinging back  82 swinging through the bottom
//           83 swinging forward  84 letting go  85 bracing against the wind  86 balancing on a swinging bell or a note
//           87 shielding from hail
//     Enzo: 80 sounding an echo bell  81 Frost Fan wind-up  82 Frost Fan release  83 Gale Wave wind-up  84 Gale Wave release
//           85 bracing against the wind  86 balancing on a swinging bell  87 hopping along the notes
//   l (the Foundry Below) Dora: 88 Bell Hammer wind-up  89 slam dive  90 slam impact  91 bounced high off a plate
//           92 wiping her brow in the heat  93 hand over her sword (Tupa's forge)  94 hopping on a hot floor
//           95 the hammer raised overhead
//     Enzo: 88 Resonance wind-up  89 Resonance ring  90 Resonance beam  91 low Frost Fan wind-up  92 low Frost Fan release
//           93 wiping his brow  94 hand over his staff (Tupa's forge)  95 hopping on a hot floor
//
// A state a hero can never be in has no frames for that hero (Enzo can't dash, wall-kick, thrust or whirl; Dora
// doesn't glide, cast, chime or carry the lantern), and every state a hero can be in has frames of its own.

import type { HeroId } from './bellspire-world.js';

export type AnimState =
  | 'idle' | 'blink' | 'fidget' | 'runStart' | 'run' | 'skid' | 'turn' | 'rise' | 'apex' | 'fall' | 'land' | 'hardLand'
  | 'climb' | 'climbOn' | 'climbOff' | 'wallSlide' | 'wallKick' | 'dash' | 'glide'
  | 'swing' | 'thrust' | 'whirl' | 'cast' | 'castWind' | 'lanternUp' | 'lanternDown' | 'chime'
  | 'hurt' | 'ko' | 'revive' | 'tagOut' | 'tagIn'
  | 'wade' | 'wadeStill' | 'swim' | 'tread' | 'dive' | 'surface'
  | 'rest' | 'chest' | 'relic' | 'ring' | 'read' | 'shop'
  | 'ropeThrow' | 'ropeSwing' | 'ropeRelease' | 'ropeFly' | 'brace' | 'balance' | 'shield' | 'echo' | 'frostWind' | 'frost' | 'galeWind' | 'gale' | 'noteHop'
  | 'slamWind' | 'slamDive' | 'slamLand' | 'bounce' | 'resWind' | 'resRing' | 'resBeam' | 'frostLowWind' | 'frostLow' | 'browWipe' | 'forge' | 'hotHop';

/** What the hero is doing this tick: read from the engine by the scene. */
export type AnimInput = {
  ground: boolean; vx: number; vy: number; face: 1 | -1;
  climb: boolean; swim: boolean; wade: boolean; glide: boolean;
  /** pressed against a wall in the air, sliding */
  wallSlide: boolean;
  dash: boolean; hurt: boolean; down: boolean;
  /** the current attack, if any: its kind, combo step, clock and the swing's wind-up and active ticks */
  act: { kind: 'swing' | 'thrust' | 'whirl' | 'cast' | 'tagin' | 'slam'; n: number; t: number; wind: number; active: number; spell?: string } | null;
  castHold: boolean; lanternUp: boolean;
  /** the Windward Belfry: on the Bell Rope (its angle and swing, both + toward the way the hero faces), the gust
   *  here (signed), what the hero stands on if it moves, hail falling close by, and a cast held past the Ember Ring */
  rope?: { ang: number; av: number } | null;
  /** flying off the rope to its target (the helping hand's guided release) */
  fly?: boolean; gust?: number; ride?: string; hail?: boolean; castLong?: boolean;
  /** the Foundry Below: the forge heat (0 to 100) and whether the hero is in it; flying up off a bounce plate */
  heat?: number; hot?: boolean; bounce?: boolean;
  /** one-off things that happened this tick: 'jumped', 'kicked', 'tagOut', 'rest', 'chest', 'relic', 'ring', 'read', 'shop', 'revive' */
  events: string[];
};

export type AnimOut = {
  state: AnimState; frame: number; flip: boolean;
  /** squash and stretch about the feet, and a lean (shear) that lags behind a change of speed */
  sx: number; sy: number; lean: number;
  /** draw fading copies behind (the dash) */
  trail: boolean;
  /** kick up dust this tick (a skid, a landing, a step in water) */
  dust: '' | 'skid' | 'land' | 'hard' | 'splash' | 'step';
};

type Def = { frames: number[] | { dora?: number[]; enzo?: number[] }; rate: number; loop: boolean; len?: number };

/** Every state's frames, how many ticks each frame shows, and whether it loops (a one-shot lasts `len` ticks). */
export const ANIMS: Record<AnimState, Def> = {
  idle: { frames: [0, 32], rate: 40, loop: true },
  blink: { frames: [33], rate: 6, loop: false, len: 6 },
  fidget: { frames: [34, 35, 34, 35, 34], rate: 22, loop: false, len: 110 },
  runStart: { frames: [64], rate: 6, loop: false, len: 6 },
  run: { frames: [24, 25, 26, 27, 28, 29], rate: 5, loop: true },
  skid: { frames: [30], rate: 10, loop: false, len: 10 },
  turn: { frames: [31], rate: 5, loop: false, len: 5 },
  rise: { frames: [4], rate: 60, loop: true },
  apex: { frames: [52], rate: 60, loop: true },
  fall: { frames: [5], rate: 60, loop: true },
  land: { frames: [22], rate: 6, loop: false, len: 6 },
  // a hard landing recovers through the ordinary landing frame: the one deliberate share (see the tests)
  hardLand: { frames: [23, 22], rate: 9, loop: false, len: 18 },
  climb: { frames: [16, 17, 18, 19], rate: 1, loop: true },
  climbOn: { frames: [21], rate: 7, loop: false, len: 7 },
  climbOff: { frames: [20], rate: 9, loop: false, len: 9 },
  wallSlide: { frames: { dora: [48] }, rate: 60, loop: true },
  wallKick: { frames: { dora: [49] }, rate: 10, loop: false, len: 10 },
  dash: { frames: { dora: [7] }, rate: 60, loop: true },
  glide: { frames: { enzo: [47, 48] }, rate: 10, loop: true },
  // a swing's frame comes from its combo step and clock (see swingFrame); these are all the frames it can show
  swing: { frames: { dora: [40, 41, 8, 42, 43, 9, 44, 45, 10], enzo: [65, 66, 67, 79, 69, 70] }, rate: 60, loop: true },
  thrust: { frames: { dora: [47] }, rate: 60, loop: true },
  // a crouched wind-up, then the spin from the front and from behind
  whirl: { frames: { dora: [65, 66, 67] }, rate: 3, loop: true },
  cast: { frames: { enzo: [44] }, rate: 60, loop: true },
  castWind: { frames: { enzo: [43] }, rate: 60, loop: true },
  lanternUp: { frames: { enzo: [45] }, rate: 60, loop: true },
  lanternDown: { frames: { enzo: [49] }, rate: 10, loop: false, len: 10 },
  chime: { frames: { enzo: [46] }, rate: 22, loop: false, len: 22 },
  hurt: { frames: [6], rate: 60, loop: true },
  ko: { frames: [50], rate: 60, loop: true },
  revive: { frames: [51], rate: 30, loop: false, len: 30 },
  tagOut: { frames: [53], rate: 14, loop: false, len: 14 },
  tagIn: { frames: [54], rate: 60, loop: true },
  wade: { frames: [62, 63], rate: 10, loop: true },
  wadeStill: { frames: { dora: [70, 71], enzo: [73, 74] }, rate: 30, loop: true },
  swim: { frames: [56, 57, 58, 59], rate: 8, loop: true },
  tread: { frames: { dora: [72, 73, 74], enzo: [75, 76, 77] }, rate: 12, loop: true },
  dive: { frames: [60], rate: 60, loop: true },
  surface: { frames: [61], rate: 60, loop: true },
  rest: { frames: [36], rate: 70, loop: false, len: 70 },
  chest: { frames: [39], rate: 30, loop: false, len: 30 },
  relic: { frames: [38], rate: 80, loop: false, len: 80 },
  // raise, then strike the bell (Dora with her sword's pommel, Enzo with the lantern end of his staff)
  ring: { frames: { dora: [68, 69], enzo: [71, 72] }, rate: 6, loop: false, len: 18 },
  read: { frames: [37], rate: 90, loop: false, len: 90 },
  shop: { frames: [55], rate: 40, loop: false, len: 40 },
  // the Windward Belfry
  ropeThrow: { frames: { dora: [80] }, rate: 8, loop: false, len: 8 },
  // a swing's frame comes from where along its arc the hero is (see ropeFrame)
  ropeSwing: { frames: { dora: [81, 82, 83] }, rate: 60, loop: true },
  ropeRelease: { frames: { dora: [84] }, rate: 12, loop: false, len: 12 },
  // the guided flight to a hook or a ledge (after the release kick): her own flying pose, reaching for where she lands
  ropeFly: { frames: { dora: [78] }, rate: 60, loop: true },
  brace: { frames: { dora: [85], enzo: [85] }, rate: 60, loop: true },
  balance: { frames: { dora: [86], enzo: [86] }, rate: 60, loop: true },
  shield: { frames: { dora: [87] }, rate: 60, loop: true },
  echo: { frames: { enzo: [80] }, rate: 22, loop: false, len: 22 },
  frostWind: { frames: { enzo: [81] }, rate: 60, loop: true },
  frost: { frames: { enzo: [82] }, rate: 60, loop: true },
  galeWind: { frames: { enzo: [83] }, rate: 60, loop: true },
  gale: { frames: { enzo: [84] }, rate: 60, loop: true },
  noteHop: { frames: { enzo: [87] }, rate: 60, loop: true },
  // the Foundry Below
  slamWind: { frames: { dora: [95, 88] }, rate: 4, loop: false },
  slamDive: { frames: { dora: [89] }, rate: 60, loop: true },
  slamLand: { frames: { dora: [90] }, rate: 14, loop: false, len: 14 },
  bounce: { frames: { dora: [91] }, rate: 60, loop: true },
  resWind: { frames: { enzo: [88] }, rate: 60, loop: true },
  resRing: { frames: { enzo: [89] }, rate: 60, loop: true },
  resBeam: { frames: { enzo: [90] }, rate: 26, loop: false, len: 26 },
  frostLowWind: { frames: { enzo: [91] }, rate: 60, loop: true },
  frostLow: { frames: { enzo: [92] }, rate: 60, loop: true },
  browWipe: { frames: { dora: [92], enzo: [93] }, rate: 50, loop: false, len: 50 },
  forge: { frames: { dora: [93], enzo: [94] }, rate: 70, loop: false, len: 70 },
  hotHop: { frames: { dora: [94], enzo: [95] }, rate: 60, loop: true },
};

/** Where along the rope's arc the hero is: drawn back (behind the hook, against the way they face), through the
 *  bottom, or swung out in front. */
export function ropeFrame(ang: number): number { return ang < -0.25 ? 81 : ang > 0.25 ? 83 : 82; }

/** The one-shots the player starts by pressing a button or touching something (they play out unless control moves on). */
const ONE_SHOT: AnimState[] = ['blink', 'fidget', 'runStart', 'skid', 'turn', 'land', 'hardLand', 'climbOn', 'climbOff', 'wallKick',
  'lanternDown', 'chime', 'revive', 'tagOut', 'rest', 'chest', 'relic', 'ring', 'read', 'shop', 'ropeThrow', 'ropeRelease', 'echo',
  'slamLand', 'resBeam', 'browWipe', 'forge'];
/** One-shots that hold even while the body moves a little (the scripted moments). */
const STICKY: AnimState[] = ['rest', 'chest', 'relic', 'read', 'shop', 'revive', 'chime', 'ring', 'echo', 'slamLand', 'resBeam', 'forge'];
const EVENT_STATE: Record<string, AnimState> = { rest: 'rest', chest: 'chest', relic: 'relic', ring: 'ring', read: 'read', shop: 'shop', revive: 'revive', tagOut: 'tagOut', kicked: 'wallKick', slammed: 'slamLand', beam: 'resBeam', forge: 'forge' };

const framesOf = (s: AnimState, hero: HeroId): number[] => { const f = ANIMS[s].frames; return Array.isArray(f) ? f : f[hero] ?? []; };
/** Whether a hero has this state at all. */
export const heroHas = (s: AnimState, hero: HeroId) => framesOf(s, hero).length > 0;

/** A swing in three beats, each combo step its own: wind-up (anticipation), the cut, and a follow-through. */
export function swingFrame(hero: HeroId, n: number, t: number, wind: number, active: number): number {
  // Dora: a level cut, a rising cut, an overhead chop. Enzo: an overhead strike, a low sweep, an upward lantern swing
  // (his strike pose holds through the follow-through)
  const beats = hero === 'dora' ? [[40, 41, 8], [42, 43, 9], [44, 45, 10]] : [[65, 66, 66], [67, 79, 79], [69, 70, 70]];
  const b = beats[Math.max(0, Math.min(2, n))];
  return t < wind ? b[0] : t < wind + active ? b[1] : b[2];
}

export class HeroAnimator {
  state: AnimState = 'idle';
  /** ticks in the current state */
  t = 0;
  /** distance climbed, which drives the climb cycle: it moves only while the hero moves */
  climbed = 0;
  /** ticks standing still, for the fidget */
  still = 0;
  /** ticks in the air, and the fastest fall, for the landing */
  airT = 0; fallV = 0;
  /** how fast the hero was running lately, for the skid */
  lastRun = 0;
  sq = 0; lean = 0; svx = 0;
  prev: AnimInput | null = null;
  /** the attack clock when a bell was struck, so the strike pose lasts as long as that attack */
  ringT = 1e9;
  private seed: number;

  constructor(readonly hero: HeroId, seed = 0) { this.seed = seed; }

  private go(s: AnimState) { if (this.state !== s) { this.state = s; this.t = 0; } }

  /** Pick this tick's state from the hero's snapshot. */
  choose(i: AnimInput): AnimState {
    const p = this.prev, cur = this.state, h = this.hero;
    const oneShotLive = ONE_SHOT.includes(cur) && this.t < (ANIMS[cur].len ?? 0);
    // the hero's own actions come first, always
    const has = (s: AnimState) => heroHas(s, h);
    if (i.down) return 'ko';
    if (i.hurt) return 'hurt';
    // a bell struck by an attack (or rung by the Chime) shows the bell strike for as long as that attack lasts
    if (i.events.includes('ring')) { this.ringT = i.act ? i.act.t : 1e9; return 'ring'; }
    if (cur === 'ring' && this.t < (ANIMS.ring.len ?? 0) && (!i.act || i.act.t > this.ringT)) { this.ringT = i.act ? i.act.t : 1e9; return 'ring'; }
    // the Bell Rope: the throw as it catches, the swing, and letting go
    if (i.rope) return cur === 'ropeThrow' && this.t < (ANIMS.ropeThrow.len ?? 0) ? cur : i.events.includes('hooked') ? 'ropeThrow' : 'ropeSwing';
    // a guided flight: the release kick first, then the flight
    if (i.fly && has('ropeFly')) return i.events.includes('unhooked') || (cur === 'ropeRelease' && oneShotLive) ? 'ropeRelease' : 'ropeFly';
    if (i.events.includes('unhooked') && has('ropeRelease')) return 'ropeRelease';
    if (cur === 'ropeRelease' && oneShotLive && !i.ground) return cur;
    if (i.act) {
      if (i.act.kind === 'swing') return 'swing';
      if (i.act.kind === 'thrust' && has('thrust')) return 'thrust';
      if (i.act.kind === 'whirl' && has('whirl')) return 'whirl';
      if (i.act.kind === 'slam' && has('slamDive')) return i.act.t < 7 ? 'slamWind' : 'slamDive';
      if (i.act.kind === 'tagin') return 'tagIn';
      if (i.act.kind === 'cast' && has('cast')) {
        if (i.act.spell === 'chime') return 'chime';
        if (i.act.spell === 'echo') return 'echo';
        if (i.act.spell === 'frost' && i.ground) return i.act.t < 6 ? 'frostLowWind' : 'frostLow';
        if (i.act.spell === 'frost') return i.act.t < 6 ? 'frostWind' : 'frost';
        // (a prism answering mid-chime: the beam pose takes over at once)
        if (i.act.spell === 'resonance') return i.events.includes('beam') || (cur === 'resBeam' && oneShotLive) ? 'resBeam' : i.act.t < 6 ? 'resWind' : 'resRing';
        if (i.act.spell === 'gale') return 'gale';
        if (i.act.spell === 'lantern') return i.lanternUp ? 'lanternUp' : 'lanternDown';
        return 'cast';
      }
    }
    if (i.castHold && i.castLong && has('galeWind')) return 'galeWind';
    if (i.castHold && has('castWind')) return 'castWind';
    for (const e of i.events) { const s = EVENT_STATE[e]; if (s && has(s)) return s; }
    if (oneShotLive && STICKY.includes(cur)) return cur;
    if (i.dash && has('dash')) return 'dash';
    if (i.swim) {
      if (i.vy > 1 && Math.abs(i.vx) < 1.2) return 'dive';
      if (i.vy < -1 && Math.abs(i.vx) < 1.2) return 'surface';
      return Math.abs(i.vx) > 0.4 || Math.abs(i.vy) > 0.4 ? 'swim' : 'tread';
    }
    if (i.climb) {
      if (!p || !p.climb) return 'climbOn';
      if (cur === 'climbOn' && oneShotLive && Math.abs(i.vy) < 0.1) return cur;
      return 'climb';
    }
    if (p && p.climb && !i.climb && i.ground && p.vy < 0) return 'climbOff';
    if (!i.ground) {
      if (i.glide && has('glide')) return 'glide';
      if (i.bounce && i.vy < 0 && has('bounce')) return 'bounce';
      if (i.wallSlide && has('wallSlide')) return 'wallSlide';
      if (cur === 'wallKick' && oneShotLive) return cur;
      if (i.vy < -1.2) return 'rise';
      if (i.vy > 1.2) return 'fall';
      return 'apex';
    }
    // on the ground
    const running = Math.abs(i.vx) > 0.3;
    if (p && !p.ground && !p.climb && !p.swim) return this.airT > 40 || this.fallV > 6 ? 'hardLand' : 'land';
    if (cur === 'climbOff' && oneShotLive) return cur;
    if (running) {
      if (p && Math.sign(i.vx) !== Math.sign(p.vx) && Math.abs(p.vx) > 0.5) return 'turn';
      if (cur === 'turn' && oneShotLive) return cur;
      // a landing gives way to running after a beat, a hard one after a longer beat
      if ((cur === 'land' && this.t < 3) || (cur === 'hardLand' && this.t < 8)) return cur;
      if (i.wade) return 'wade';
      if (cur === 'idle' || cur === 'blink' || cur === 'fidget' || cur === 'skid') return 'runStart';
      if (cur === 'runStart' && oneShotLive) return cur;
      return 'run';
    }
    if ((cur === 'run' || cur === 'runStart' || cur === 'turn') && this.lastRun > 1.2 && !i.wade) return 'skid';
    if (oneShotLive) return cur;
    // standing still on something that moves, in a gust, or under hail
    if (i.ride === 'note' && has('noteHop')) return 'noteHop';
    if (i.ride === 'note' || i.ride === 'bell') return 'balance';
    if (i.hail && has('shield')) return 'shield';
    if (i.gust) return 'brace';
    // the forge heat: hopping from foot to foot on a hot floor, wiping a brow now and then once it runs high
    if (i.hot && (i.heat ?? 0) > 70 && this.still > 40 && (this.t + this.seed * 37) % 240 === 239) return 'browWipe';
    if (i.hot && (i.heat ?? 0) > 35) return 'hotHop';
    if (i.lanternUp && has('lanternUp')) return 'lanternUp';
    if (cur === 'lanternUp' && !i.lanternUp) return 'lanternDown';
    if (i.wade) return 'wadeStill';
    if (this.still > 300) return 'fidget';
    if (cur === 'idle' && (this.t + this.seed * 37) % 210 === 209) return 'blink';
    return 'idle';
  }

  step(i: AnimInput): AnimOut {
    const prevState = this.state;
    const s = this.choose(i);
    this.go(s);
    if (this.state === prevState) this.t++;
    // clocks
    this.airT = i.ground || i.climb || i.swim ? 0 : this.airT + 1;
    if (this.airT) this.fallV = this.airT === 1 ? i.vy : Math.max(this.fallV, i.vy);
    // a guided flight sets her down gently: a clean landing, never a hard one
    if (i.fly) { this.airT = 1; this.fallV = 0; }
    if (i.climb) this.climbed += Math.abs(i.vy); else this.climbed = 0;
    this.still = s === 'idle' || s === 'blink' ? this.still + 1 : 0;
    this.lastRun = Math.abs(i.vx) > 0.3 ? Math.max(Math.abs(i.vx), this.lastRun * 0.9) : this.lastRun * 0.7;
    // the frame
    const fr = framesOf(s, this.hero), d = ANIMS[s];
    let frame: number;
    if (s === 'swing' && i.act) frame = swingFrame(this.hero, i.act.n, i.act.t, i.act.wind, i.act.active);
    else if (s === 'ropeSwing' && i.rope) frame = ropeFrame(i.rope.ang);
    else if (s === 'whirl') { const k = Math.floor(this.t / d.rate); frame = k === 0 ? fr[0] : fr[1 + ((k - 1) % 2)]; }
    else if (s === 'climb') frame = fr[Math.floor(this.climbed / 7) % fr.length];
    else if (s === 'run') frame = fr[Math.floor(this.t * Math.min(1.4, Math.max(0.7, Math.abs(i.vx) / 1.8)) / d.rate) % fr.length];
    else { const k = Math.floor(this.t / d.rate); frame = fr[d.loop ? k % fr.length : Math.min(fr.length - 1, k)]; }
    // facing: the spin turns the hero round every other frame; a wall slide faces away from the wall
    let flip = i.face < 0;
    // braced, a hero leans into the wind
    if (s === 'brace' && i.gust) flip = i.gust > 0;
    if (s === 'whirl') flip = Math.floor(this.t / d.rate) % 4 >= 2 ? !flip : flip;
    // squash and stretch, about the feet: a stretch on take-off, a squash on landing, easing back
    if (i.events.includes('jumped')) this.sq = -1;
    if (s === 'land' && this.t === 0) this.sq = 0.8;
    if (s === 'hardLand' && this.t === 0) this.sq = 1.4;
    this.sq *= 0.8;
    const sx = 1 + Math.max(0, this.sq) * 0.12 - Math.max(0, -this.sq) * 0.08;
    const sy = 1 - Math.max(0, this.sq) * 0.12 + Math.max(0, -this.sq) * 0.1;
    // the coat and tail lag behind: a lean against a change of speed
    this.svx += (i.vx - this.svx) * 0.15;
    this.lean = Math.max(-0.12, Math.min(0.12, (this.svx - i.vx) * 0.06 + (s === 'run' ? i.vx * 0.015 : 0)));
    // dust
    let dust: AnimOut['dust'] = '';
    if (s === 'skid' && this.t % 3 === 0) dust = 'skid';
    else if (s === 'land' && this.t === 0) dust = 'land';
    else if (s === 'hardLand' && this.t === 0) dust = 'hard';
    else if (s === 'wade' && this.t % 10 === 0) dust = 'splash';
    else if (s === 'run' && this.t % 15 === 0) dust = 'step';
    this.prev = i;
    return { state: s, frame, flip, sx, sy, lean: this.lean, trail: s === 'dash', dust };
  }
}

/** Every animation state's frames for a hero: for the tests and the contact sheets. */
export function animFrames(s: AnimState, hero: HeroId): number[] { return framesOf(s, hero); }

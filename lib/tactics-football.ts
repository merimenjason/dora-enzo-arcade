// Turn-based football: the shared engine. Football as a readable puzzle: a 15 by 9 grid pitch, our outfield players and
// a keeper against the Grumbles', and before every one of our turns the Grumbles' next moves are already showing (where
// each will go, the cells it will tackle, the keeper's covered cells, and with the ball their pass, shot or dribble).
// We move each of our players up to 2 cells and make the ball actions (ground passes, lofted passes, dribbles, shots,
// tackles), every one previewed before it's made and undoable until End turn; then the Grumbles resolve what they said
// they'd do, against wherever we've left our players. No dice: the only randomness is seeded tie-breaks and the wind.
// No DOM. Games plug in their own rules through hooks (Rulebook FC's laws; Combo Ball's chain scoring).
//
// API
//   const m = new Match({ seed, outfield: [4, 4], who, level, hooks });   // kicks off; our turn to plan
//   m.reach(id)                → cells unit `id` can move to this turn (with their path)
//   m.move(id, c, r)           → moves (a carrier dribbles); false if illegal
//   m.passPreview(id, to, bank?) / m.pass(id, to, bank?)   → ground pass to team-mate `to` (bank: 'top' | 'bottom'
//                                bounces it off a board when hooks.bank allows)
//   m.loftPreview(id, c, r) / m.loft(id, c, r)             → lofted pass to a cell
//   m.shotPreview(id, row) / m.shoot(id, row)              → shot at a row of their goal mouth (or a post row)
//   m.canTackle(id) / m.tackle(id)                         → when defending, next to their carrier
//   m.undo(), m.hint(), m.endTurn()                        → endTurn resolves the Grumbles and plans their next turn
//   m.s                        → the whole state (plain JSON, so undo is a snapshot): units, ball, intents, score, turn
//   m.events                   → what the last call did, in order, for the page to animate
//   m.zones() / m.resolved()   → their plan played out against where we stand now: each one's end cell, path and the
//                                cells he'll tackle; m.threat() the cells their pass or shot will travel through;
//                                m.screened() the cells their support runners screen off while they attack; m.danger()
//                                how much their planned ball action still threatens (0: stopped)
//   m.covered(side, dist, row, from, header) → does the keeper have this row covered (base cover 1 from 2 columns or
//                                less, 2 from 3 to 5, 3 further, never the whole mouth within 5; a header is +1)
// Rules of the board: we move MOVE (2) cells with the ball and DEFEND (1) when they have it; outfield players can't
// stand in the goal columns (0 and 14); there's no tackle-free turn after a kick-off unless hooks.grace says so.
// How the other side plays is a `Level`: a per-team style (pressers and how far they lunge, lanes read, speed, shot
// range, sweepers, long balls, tunnels, thieves, one-twos, extra players), so every opponent in a league feels
// different and other games can reuse the same teams.
// Every action returns false (and changes nothing) when it isn't allowed. Team 0 is ours and attacks right (to
// column 15); team 1 attacks left (to column -1). Cells are { c, r } with c 0..14 and r 0..8.

export const COLS = 15, ROWS = 9;
/** the default goal mouth: rows 3 to 5 */
export const MOUTH: [number, number] = [3, 5];
export const TURNS = 16;
/** cells a player of ours moves in a turn; DEFEND when the other side has the ball (we react, they act) */
export const MOVE = 2, DEFEND = 1, PASS = 6, LOFT: [number, number] = [3, 7], SHOT = 7, CAP = 4;

export type Cell = { c: number; r: number };
export type Team = 0 | 1;
export type Unit = {
  id: number; team: Team; who: string; keeper: boolean; c: number; r: number;
  /** has made his move this turn */ moved: boolean;
  /** may still make a ball action this turn */ canAct: boolean;
  /** started the turn on the ball */ started: boolean;
  /** got the ball from a pass this turn (and how: a ground pass or a lofted one caught at once) */ got: '' | 'ground' | 'loft';
  /** got a pass this turn (Sticky Boots keeps him safe from tackles at its end) */ safe: boolean;
};
export type Flight = { c: number; r: number; team: Team; from: number };
export type Ball = { holder: number; c: number; r: number; flight: Flight | null };
export type Intent = { id: number; kind: 'press' | 'mark' | 'lane' | 'hold' | 'keeper' | 'carry' | 'support'; path: Cell[]; zone: Cell[]; target: number; tunnel?: boolean };
export type BallIntent =
  | { k: 'shot'; row: number }
  | { k: 'pass'; to: number; then?: number; shoot?: number; alts?: number[] }
  | { k: 'loft'; to: number; shoot?: number }
  | { k: 'dribble' }
  | { k: 'hold' };
export type PassRec = { from: number; to: number; team: Team; lofted: boolean; len: number; back: boolean; banked: boolean; bent: boolean; turn: number; oneTouch: boolean; /** where the passer and the receiver stood */ a: Cell; b: Cell };
export type ShotCtx = { by: number; team: Team; c: number; r: number; row: number; dist: number; header: boolean; deflected: boolean; turn: number; chain: PassRec[]; lastTouch: Team };
export type ShotResult = 'goal' | 'saved' | 'blocked' | 'post' | 'far' | 'deflected';
export type ShotPreview = { result: ShotResult; cells: Cell[]; covered: number[]; blocker: number; value: number; notes: string[]; corner: boolean };
export type PassPreview = { ok: boolean; cells: Cell[]; by: number; reason: string; banked: boolean; bent: boolean; back: boolean; turnover: boolean };
export type LoftPreview = { ok: boolean; land: Cell; by: number; catcher: number; reason: string };
/** how the other side plays: a per-team style, so every opponent feels different. The numbers are the difficulty knobs;
 * the flags are the team's speciality */
export type Level = {
  /** players who close down our carrier */ press: number;
  /** cells a tackle lunges into beside its destination */ zone: number;
  /** passing lanes they stand in */ lanes: number;
  /** cells a player moves (3 for fast teams, 1 for slow ones) */ move: number;
  /** cells moved with the ball (a counter-attacking team breaks faster) */ attackMove?: number;
  /** the furthest out they shoot from */ shotRange: number;
  /** extra goal cells their keeper covers */ keeper?: number;
  /** players who stay home, on the line between the ball and their goal */ sweeper?: number;
  /** they love a long ball, and win any of our lofted passes that lands next to one of them */ aerial?: boolean;
  /** every other turn one of them tunnels to any free cell within 4 */ tunnel?: boolean;
  /** extra outfield players they field */ extra?: number;
  /** pressers tackle every cell within this many of where they stop (instead of `zone` cells) */ reach?: number;
  /** other team-mates a passer keeps in mind: if his pass is cut off he plays one of these instead (all are shown) */ options?: number;
  /** passes they make in one go when they have the ball (2: a quick one-two) */ passes?: number;
  /** they steal any ground pass that goes past next to one of them, not only through */ thief?: boolean;
  /** their carrier can't be tackled from in front */ front?: boolean;
};
export type State = {
  turn: number; maxTurns: number; golden: boolean; over: boolean;
  score: [number, number]; goals: [number, number];
  units: Unit[]; ball: Ball;
  intents: Intent[]; bi: BallIntent | null;
  /** our declared tackle (a unit id), resolved at End turn */ tackle: number;
  passes: number; secondWind: boolean; wind: number;
  chain: PassRec[];
  /** who kicks off after a goal, at the start of the next turn */ kickoff: Team | null;
  /** the last team to touch the ball */ lastTouch: Team;
  /** the turn straight after a kick-off: nobody can tackle the side kicking off */ fresh: boolean;
  /** the side that kicked off this turn, or -1 */ kicked: Team | -1;
  /** a game's own numbers, kept with the state so undo puts them back too (Combo Ball's chain bonuses) */
  data: Record<string, number>;
  rs: number;
};
export type Ev =
  | { k: 'move'; id: number; path: Cell[]; holder: number }
  | { k: 'pass'; from: Cell; to: Cell; lofted: boolean; team: Team; holder: number; flight: boolean; bank?: 'top' | 'bottom' }
  | { k: 'shot'; from: Cell; to: Cell; team: Team; result: ShotResult; holder: number; value: number; notes: string[] }
  | { k: 'tackle'; by: number; at: Cell; holder: number; won: boolean }
  | { k: 'intercept'; by: number; at: Cell; holder: number }
  | { k: 'land'; at: Cell; holder: number }
  | { k: 'goal'; team: Team; value: number; notes: string[] }
  | { k: 'kickoff'; team: Team }
  | { k: 'whistle' | 'golden' | 'full' | 'turnover' | 'hedge' | 'gust' | 'push'; holder: number };

export type Hooks = {
  /** turns in a match */ turns?: () => number;
  /** the rows of a goal mouth (side 0 is ours, on the left) */ mouth?: (side: Team) => [number, number];
  /** cells a unit may move this turn */ moveRange?: (u: Unit) => number;
  /** the cost of stepping onto a cell (mud) */ moveCost?: (c: number, r: number) => number;
  /** cells nobody can stand on or pass through (hedges) */ blocked?: (c: number, r: number) => boolean;
  /** the furthest ground pass */ passRange?: (team: Team) => number;
  /** where a lofted ball really lands (wind, bounce) */ landing?: (team: Team, from: Cell, to: Cell) => Cell;
  /** how many mouth cells a keeper covers against a shot from `dist` columns out (base: 1 from 2 or less, 2 from 3 to 5, 3 further) */ keeperCover?: (side: Team, dist: number, base: number) => number;
  /** the furthest out a shot can beat the keeper */ shotRange?: (team: Team) => number;
  /** a shot from beyond the range may still beat the keeper */ farShot?: (u: Unit) => boolean;
  /** a player who got a pass this turn can't be tackled at its end (Sticky Boots) */ sticky?: (team: Team) => boolean;
  /** ground passes a turn */ passCap?: () => number;
  /** ground passes may bank off the side boards */ bank?: (team: Team) => boolean;
  /** a ground pass may bend round one blocking defender */ bend?: (team: Team) => boolean;
  /** a backward pass hands the ball over */ noBack?: (team: Team, u: Unit, bent: boolean) => boolean;
  /** units that move 2 cells slide on a third */ slide?: () => boolean;
  /** one player a turn may move twice */ secondWind?: (team: Team) => boolean;
  /** what a goal is worth */ goalValue?: (team: Team, shot: ShotCtx) => { value: number; notes: string[] };
  /** a shot off the woodwork (a post row, or a saved shot at a corner) counts for this much (0: nothing) */ woodwork?: (team: Team, shot: ShotCtx, saved: boolean) => { value: number; notes: string[] };
  /** a keeper's save goes to the nearest of the shooter's team */ parry?: (team: Team) => boolean;
  /** a shot blocked by one defender goes in off him */ deflect?: (team: Team, shot: ShotCtx, blocker: Unit) => boolean;
  /** who kicks off after a goal by `scorer` */ kickoffSide?: (scorer: Team) => Team;
  /** does the side kicking off get its turn free of tackles? (no by default) */ grace?: (side: Team) => boolean;
  /** extra outfield units for a side */ extraUnits?: (team: Team) => number;
  /** the wind for this turn (lofted landings drift) */ wind?: (turn: number, rnd: () => number) => number;
  /** a completed pass, for the game's own scoring */ onPass?: (rec: PassRec) => void;
  /** a new turn has begun (hedges grow here) */ onTurn?: (turn: number) => void;
  /** a chain of passes is about to be wiped (the ball changed sides, or a kick-off) */ onChainReset?: (s: State, old: PassRec[]) => void;
  /** level at full time plays golden turns (yes by default) */ golden?: () => boolean;
};
export type Options = { seed: number; outfield?: [number, number]; who?: { ours: string[]; theirs: string[]; keepers?: [string, string] }; level: Level; hooks?: Hooks };

export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const cheb = (a: Cell, b: Cell) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const same = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;
const key = (c: number, r: number) => c * 32 + r;
export const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** the cells a straight line from a to b passes through, not counting either end */
export function line(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [], seen = new Set<number>([key(a.c, a.r), key(b.c, b.r)]);
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r)) * 8));
  for (let k = 1; k < n; k++) {
    const x = a.c + ((b.c - a.c) * k) / n, y = a.r + ((b.r - a.r) * k) / n;
    // a point exactly on a cell corner belongs to the cell up and to the right (consistently)
    const c = Math.floor(x + 0.5 + 1e-9), r = Math.floor(y + 0.5 + 1e-9);
    const kk = key(c, r);
    if (!seen.has(kk)) { seen.add(kk); out.push({ c, r }); }
  }
  return out;
}

export class Match {
  s: State;
  o: Options;
  h: Hooks;
  events: Ev[] = [];
  private stack: string[] = [];
  constructor(o: Options) {
    this.o = o; this.h = o.hooks ?? {};
    const [a, b] = o.outfield ?? [4, 4];
    const units: Unit[] = [];
    const ours = o.who?.ours ?? ['p0', 'p1', 'p2', 'p3', 'p4'], theirs = o.who?.theirs ?? ['g'];
    const mk = (team: Team, who: string, keeper: boolean): Unit => ({ id: units.length, team, who, keeper, c: 0, r: 0, moved: false, canAct: false, started: false, got: '', safe: false });
    for (let k = 0; k < a; k++) units.push(mk(0, ours[k % ours.length], false));
    units.push(mk(0, o.who?.keepers?.[0] ?? 'keeper', true));
    const nb = b + (o.level.extra ?? 0) + (this.h.extraUnits?.(1) ?? 0);
    for (let k = 0; k < nb; k++) units.push(mk(1, theirs[k % theirs.length], false));
    units.push(mk(1, o.who?.keepers?.[1] ?? 'gkeeper', true));
    this.s = {
      turn: 0, maxTurns: this.h.turns?.() ?? TURNS, golden: false, over: false, score: [0, 0], goals: [0, 0], units,
      ball: { holder: -1, c: 7, r: 4, flight: null }, intents: [], bi: null, tackle: -1, passes: 0, secondWind: false, wind: 0,
      chain: [], kickoff: null, lastTouch: 0, fresh: false, kicked: 0, data: {}, rs: o.seed >>> 0 || 1,
    };
    this.kickoffNow(0);
    this.startTurn();
    this.events = [{ k: 'whistle', holder: this.s.ball.holder }];
  }
  rnd() { const [v, n] = rngNext(this.s.rs); this.s.rs = n; return v; }
  get units() { return this.s.units; }
  unit(id: number) { return this.s.units[id]; }
  keeperOf(team: Team) { return this.s.units.find((u) => u.team === team && u.keeper)!; }
  /** whose ball it is: the holder's team, or the team of a ball in the air, or -1 */
  get poss(): Team | -1 { const b = this.s.ball; return b.holder >= 0 ? this.unit(b.holder).team : b.flight ? b.flight.team : -1; }
  get carrier() { return this.s.ball.holder >= 0 ? this.unit(this.s.ball.holder) : null; }
  mouth(side: Team): [number, number] { return this.h.mouth?.(side) ?? MOUTH; }
  at(c: number, r: number) { return this.s.units.find((u) => u.c === c && u.r === r) ?? null; }
  inside(c: number, r: number) { return c >= 0 && c < COLS && r >= 0 && r < ROWS && !(this.h.blocked?.(c, r) ?? false); }
  /** the distance from a cell to the goal a team attacks, in columns */
  dist(team: Team, c: number) { return team === 0 ? COLS - c : c + 1; }

  // ---------------------------------------------------------------- set pieces and turns
  /** everyone to their places; `side` has the ball on the centre spot */
  kickoffNow(side: Team) {
    const ours = this.s.units.filter((u) => u.team === 0 && !u.keeper), theirs = this.s.units.filter((u) => u.team === 1 && !u.keeper);
    const att: Cell[] = [{ c: 7, r: 4 }, { c: 5, r: 2 }, { c: 5, r: 6 }, { c: 3, r: 4 }, { c: 3, r: 1 }, { c: 3, r: 7 }];
    const def: Cell[] = [{ c: 5, r: 3 }, { c: 5, r: 5 }, { c: 3, r: 2 }, { c: 3, r: 6 }, { c: 2, r: 4 }, { c: 4, r: 0 }];
    const place = (list: Unit[], spots: Cell[], mirror: boolean) => list.forEach((u, k) => {
      const s = spots[k % spots.length];
      Object.assign(u, { c: mirror ? COLS - 1 - s.c : s.c, r: s.r });
    });
    // the spots are for the left half; the Grumbles take their mirror image
    place(ours, side === 0 ? att : def, false);
    place(theirs, side === 1 ? att : def, true);
    // a spot taken by a hedge: the nearest free cell
    for (const u of [...ours, ...theirs]) if (!this.inside(u.c, u.r) || this.s.units.some((v) => v !== u && v.c === u.c && v.r === u.r)) { const f = this.freeNear(u.c, u.r, u); u.c = f.c; u.r = f.r; }
    for (const team of [0, 1] as Team[]) { const k = this.keeperOf(team), [lo, hi] = this.mouth(team); Object.assign(k, { c: team ? COLS - 1 : 0, r: clamp(4, lo, hi) }); }
    const taker = side === 0 ? ours[0] : theirs[0];
    this.s.ball = { holder: taker.id, c: taker.c, r: taker.r, flight: null };
    this.s.lastTouch = side; this.h.onChainReset?.(this.s, this.s.chain); this.s.chain = []; this.s.kickoff = null; this.s.fresh = this.h.grace?.(side) ?? false; this.s.kicked = side;
    this.events.push({ k: 'kickoff', team: side });
  }
  freeNear(c: number, r: number, self?: Unit): Cell {
    for (let d = 0; d < 8; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue;
      const cc = c + dc, rr = r + dr;
      if (this.inside(cc, rr) && !this.s.units.some((u) => u !== self && u.c === cc && u.r === rr)) return { c: cc, r: rr };
    }
    return { c, r };
  }
  /** a new turn: hooks first (the hedges), then our keeper steps across to the ball, then the Grumbles plan */
  startTurn() {
    const s = this.s;
    this.h.onTurn?.(s.turn);
    // anyone standing where a hedge has grown is pushed out
    for (const u of s.units) if (!this.inside(u.c, u.r)) { const f = this.freeNear(u.c, u.r, u); u.c = f.c; u.r = f.r; this.events.push({ k: 'push', holder: s.ball.holder }); }
    s.wind = this.h.wind?.(s.turn, () => this.rnd()) ?? 0;
    s.passes = 0; s.secondWind = false; s.tackle = -1;
    this.looseBall();
    for (const u of s.units) { u.moved = false; u.got = ''; u.started = s.ball.holder === u.id; u.canAct = u.started && u.team === 0; }
    // our keeper follows the ball across his goal
    const k = this.keeperOf(0), [lo, hi] = this.mouth(0), b = this.ballCell();
    const want = clamp(b.r, lo, hi);
    if (!this.at(k.c, want) || this.at(k.c, want) === k) k.r = want; else k.r = clamp(k.r, lo, hi);
    this.plan();
    this.stack = [];
  }
  ballCell(): Cell { const b = this.s.ball; if (b.holder >= 0) { const u = this.unit(b.holder); return { c: u.c, r: u.r }; } return b.flight ? { c: b.flight.c, r: b.flight.r } : { c: b.c, r: b.r }; }
  /** a loose ball goes to the nearest player (a tie goes to whoever didn't touch it last) */
  looseBall() {
    const b = this.s.ball;
    if (b.holder >= 0 || b.flight) return;
    let best: Unit | null = null, bd = 1e9;
    for (const u of this.s.units) {
      const d = cheb(u, b) * 2 + (u.team === this.s.lastTouch ? 1 : 0);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) this.give(best);
  }
  give(u: Unit) {
    const b = this.s.ball, before = this.poss;
    b.holder = u.id; b.c = u.c; b.r = u.r; b.flight = null;
    if (before !== u.team) { this.h.onChainReset?.(this.s, this.s.chain); this.s.chain = []; }
    this.s.lastTouch = u.team;
  }

  // ---------------------------------------------------------------- moving
  rangeOf(u: Unit) { return u.keeper ? 1 : this.h.moveRange?.(u) ?? (u.team === 1 ? (this.s.ball.holder === u.id ? this.o.level.attackMove ?? this.o.level.move : this.o.level.move) : this.poss === 1 ? DEFEND : MOVE); }
  cost(c: number, r: number) { return this.h.moveCost?.(c, r) ?? 1; }
  /** every cell a unit can reach this turn with the path there, avoiding everyone (keepers stay on their goal line) */
  paths(u: Unit, range = this.rangeOf(u), ignore: Unit[] = []): Map<number, Cell[]> {
    const out = new Map<number, Cell[]>();
    const best = new Map<number, number>([[key(u.c, u.r), 0]]);
    out.set(key(u.c, u.r), [{ c: u.c, r: u.r }]);
    const q: [number, number, number][] = [[u.c, u.r, 0]];
    const [lo, hi] = this.mouth(u.team);
    const screen = u.team === 0 && !u.keeper ? this.screened() : null;
    while (q.length) {
      q.sort((a, b) => a[2] - b[2]);
      const [c, r, d] = q.shift()!;
      for (const [dc, dr] of DIRS) {
        const cc = c + dc, rr = r + dr;
        if (!this.inside(cc, rr)) continue;
        if (u.keeper && (cc !== u.c || rr < lo || rr > hi)) continue;
        // the goal columns are the keepers' alone
        if (!u.keeper && (cc === 0 || cc === COLS - 1)) continue;
        if (screen && screen.has(key(cc, rr))) continue;
        const occ = this.at(cc, rr);
        if (occ && occ !== u && !ignore.includes(occ)) continue;
        const nd = d + (u.keeper ? 1 : this.cost(cc, rr));
        if (nd > range) continue;
        const kk = key(cc, rr);
        if (best.has(kk) && best.get(kk)! <= nd) continue;
        best.set(kk, nd); out.set(kk, [...out.get(key(c, r))!, { c: cc, r: rr }]); q.push([cc, rr, nd]);
      }
    }
    return out;
  }
  /** where a unit could move to now: [] if he's moved */
  reach(id: number): { c: number; r: number; path: Cell[] }[] {
    const u = this.unit(id);
    if (u.team !== 0 || this.s.over || !this.canMove(u)) return [];
    return [...this.paths(u).values()].filter((p) => p.length > 1).map((p) => ({ ...p[p.length - 1], path: p }));
  }
  canMove(u: Unit) { return !u.moved || (!this.s.secondWind && !!this.h.secondWind?.(u.team) && !u.keeper); }
  /** Ice: two cells in a straight line slide a third, if it's free */
  slid(u: Unit, path: Cell[]) {
    if (!this.h.slide?.() || path.length !== 3 || u.keeper) return path;
    const d1 = [path[1].c - path[0].c, path[1].r - path[0].r], d2 = [path[2].c - path[1].c, path[2].r - path[1].r];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) return path;
    const n = { c: path[2].c + d2[0], r: path[2].r + d2[1] };
    if (!this.inside(n.c, n.r) || this.at(n.c, n.r)) return path;
    return [...path, n];
  }
  move(id: number, c: number, r: number) {
    this.events = [];
    const u = this.unit(id);
    if (!u || u.team !== 0 || this.s.over || !this.canMove(u)) return false;
    let path = this.paths(u).get(key(c, r));
    if (!path || path.length < 2) return false;
    this.save();
    if (u.moved) this.s.secondWind = true;
    path = this.slid(u, path);
    const end = path[path.length - 1];
    u.c = end.c; u.r = end.r; u.moved = true;
    if (!u.started) u.canAct = false;
    if (this.s.ball.holder === u.id) { this.s.ball.c = u.c; this.s.ball.r = u.r; }
    this.events.push({ k: 'move', id, path, holder: this.s.ball.holder });
    return true;
  }

  // ---------------------------------------------------------------- the Grumbles' intents, resolved against where we are now
  /** each Grumble's move played out against our current positions: where it ends and the cells it will tackle */
  resolved(): { id: number; end: Cell; path: Cell[]; zone: Cell[] }[] {
    const taken = new Set<number>();
    for (const u of this.s.units) if (u.team === 0) taken.add(key(u.c, u.r));
    const out: { id: number; end: Cell; path: Cell[]; zone: Cell[] }[] = [];
    const ints = this.s.intents;
    // Grumbles that don't move keep their cells
    const moving = new Set(ints.filter((i) => i.path.length > 1).map((i) => i.id));
    for (const u of this.s.units) if (u.team === 1 && !moving.has(u.id)) taken.add(key(u.c, u.r));
    for (const i of ints) {
      const u = this.unit(i.id);
      let k = 0;
      for (let j = 1; j < i.path.length; j++) {
        const p = i.path[j];
        if (taken.has(key(p.c, p.r)) || !this.inside(p.c, p.r)) break;
        k = j;
      }
      // a cell further along may be free again; but stopping short means stopping at the last free step
      const end = i.path.length ? i.path[k] : { c: u.c, r: u.r };
      taken.add(key(end.c, end.r));
      const dest = i.path.length ? i.path[i.path.length - 1] : end;
      const dc = end.c - dest.c, dr = end.r - dest.r;
      const zone = i.zone.map((z) => ({ c: z.c + dc, r: z.r + dr })).filter((z) => this.inside(z.c, z.r));
      out.push({ id: i.id, end, path: i.path.slice(0, k + 1), zone });
    }
    return out;
  }
  zones() { const z = new Map<number, number>(); for (const r of this.resolved()) for (const c of r.zone) if (!z.has(key(c.c, c.r))) z.set(key(c.c, c.r), r.id); return z; }

  /** the Grumbles plan their next turn (and their keeper his cells); shown to the person at once */
  plan() {
    const s = this.s, L = this.o.level;
    s.intents = []; s.bi = null;
    if (s.over) return;
    const g = s.units.filter((u) => u.team === 1 && !u.keeper);
    const reds = s.units.filter((u) => u.team === 0 && !u.keeper);
    const reserved = new Set<number>();
    const T = this.ballCell();
    const gk = this.keeperOf(1), [glo, ghi] = this.mouth(1);
    const keeperTo = (row: number) => {
      const want = clamp(row, glo, ghi);
      const path: Cell[] = [{ c: gk.c, r: gk.r }];
      for (let r = gk.r; r !== want;) { r += Math.sign(want - r); path.push({ c: gk.c, r }); }
      s.intents.push({ id: gk.id, kind: 'keeper', path, zone: [], target: -1 });
    };
    /** the reachable cell (not taken) that scores best */
    const bestCell = (u: Unit, score: (c: Cell) => number) => {
      let best: Cell[] = [{ c: u.c, r: u.r }], bs = -1e9;
      for (const p of this.paths(u, this.rangeOf(u), reds.filter(() => false)).values()) {
        const e = p[p.length - 1];
        if (reserved.has(key(e.c, e.r))) continue;
        const v = score(e) + this.rnd() * 0.01;
        if (v > bs) { bs = v; best = p; }
      }
      const e = best[best.length - 1]; reserved.add(key(e.c, e.r));
      return best;
    };
    const square = (d: Cell, n: number) => { const out: Cell[] = [d]; for (let dc = -n; dc <= n; dc++) for (let dr = -n; dr <= n; dr++) if ((dc || dr) && this.inside(d.c + dc, d.r + dr)) out.push({ c: d.c + dc, r: d.r + dr }); return out; };
    /** a tackle zone: the destination plus the `n` neighbouring cells nearest to a target */
    const zoneAt = (d: Cell, t: Cell, n: number) => {
      const around = DIRS.map(([dc, dr]) => ({ c: d.c + dc, r: d.r + dr })).filter((c) => this.inside(c.c, c.r));
      around.sort((a, b) => cheb(a, t) - cheb(b, t) || Math.hypot(a.c - t.c, a.r - t.r) - Math.hypot(b.c - t.c, b.r - t.r));
      return [d, ...around.slice(0, n)];
    };
    if (this.poss === 1 && s.ball.holder >= 0) return this.planAttack();
    // ---- defending: keeper to the ball's row; press, read lanes, mark
    keeperTo(T.r);
    const order = g.slice().sort((a, b) => cheb(a, T) - cheb(b, T) || a.id - b.id);
    // sweepers: the ones nearest their own goal stay home
    const sweepers = order.slice().sort((a, b) => b.c - a.c || a.id - b.id).slice(0, Math.min(L.sweeper ?? 0, Math.max(0, order.length - 1)));
    const field = order.filter((u) => !sweepers.includes(u));
    const pressers = field.slice(0, L.press), rest = field.slice(L.press);
    for (const p of sweepers) {
      const goal = { c: COLS - 1, r: 4 };
      const lane = line(T, goal).filter((c) => c.c >= Math.max(T.c + 2, COLS - 4));
      const want = lane[0] ?? { c: COLS - 3, r: 4 };
      const path = bestCell(p, (e) => -cheb(e, want) * 10 - Math.min(...(lane.length ? lane : [want]).map((l) => cheb(l, e))) * 3);
      const d = path[path.length - 1];
      s.intents.push({ id: p.id, kind: 'hold', path, zone: zoneAt(d, T, Math.max(0, L.zone - 1)), target: -1 });
    }
    for (const p of pressers) {
      const path = bestCell(p, (e) => -cheb(e, T) * 10 - Math.hypot(e.c - T.c, e.r - T.r) + e.c * 0.1);
      const d = path[path.length - 1];
      // a long-reaching presser lunges into every cell within `reach` of where he stops
      const zone = L.reach ? square(d, L.reach) : cheb(d, T) <= 1 ? zoneAt(d, T, L.zone) : zoneAt(d, T, Math.max(0, L.zone - 1));
      s.intents.push({ id: p.id, kind: 'press', path, zone, target: s.ball.holder });
    }
    // our most dangerous players: the furthest forward
    const danger = reds.filter((u) => u.id !== s.ball.holder).sort((a, b) => b.c - a.c || a.id - b.id);
    let lanes = L.lanes;
    const marked = new Set<number>();
    for (const p of rest) {
      if (lanes > 0 && danger.length) {
        lanes--;
        const tgt = danger.find((d) => !marked.has(d.id)) ?? danger[0];
        const lane = line(T, tgt);
        if (lane.length) {
          const path = bestCell(p, (e) => -Math.min(...lane.map((l) => cheb(l, e))) * 10 - cheb(e, tgt) * 0.5);
          const d = path[path.length - 1];
          s.intents.push({ id: p.id, kind: 'lane', path, zone: zoneAt(d, lane[Math.floor(lane.length / 2)], Math.max(0, L.zone - 1)), target: tgt.id });
          continue;
        }
      }
      const tgt = danger.find((d) => !marked.has(d.id));
      if (tgt) {
        marked.add(tgt.id);
        const gs = { c: Math.min(COLS - 1, tgt.c + 1), r: tgt.r };
        const path = bestCell(p, (e) => -cheb(e, gs) * 10 - Math.hypot(e.c - gs.c, e.r - gs.r) - (e.c < tgt.c ? 3 : 0));
        const d = path[path.length - 1];
        s.intents.push({ id: p.id, kind: 'mark', path, zone: cheb(d, tgt) <= 1 ? zoneAt(d, tgt, L.zone) : [d], target: tgt.id });
      } else {
        const home = { c: 11, r: clamp(p.r, 1, ROWS - 2) };
        const path = bestCell(p, (e) => -cheb(e, home));
        s.intents.push({ id: p.id, kind: 'hold', path, zone: [path[path.length - 1]], target: -1 });
      }
    }
    // a tunnelling team: every other turn the one furthest from the ball pops up next to it instead
    if (L.tunnel && s.turn % 2 === 1) {
      const far = s.intents.filter((i) => i.kind !== 'keeper' && i.kind !== 'press').sort((a, b) => cheb(this.unit(b.id), T) - cheb(this.unit(a.id), T) || a.id - b.id)[0];
      if (far) {
        const u = this.unit(far.id);
        const end = far.path[far.path.length - 1]; reserved.delete(key(end.c, end.r));
        let best: Cell | null = null, bs = 1e9;
        for (let dc = -4; dc <= 4; dc++) for (let dr = -4; dr <= 4; dr++) {
          const c = u.c + dc, r = u.r + dr;
          if (!this.inside(c, r) || this.at(c, r) || reserved.has(key(c, r))) continue;
          const v = cheb({ c, r }, T) * 10 + Math.hypot(c - T.c - 1, r - T.r);
          if (cheb({ c, r }, T) >= 1 && v < bs) { bs = v; best = { c, r }; }
        }
        if (best) {
          reserved.add(key(best.c, best.r));
          Object.assign(far, { kind: 'press', path: [{ c: u.c, r: u.r }, best], zone: cheb(best, T) <= 1 ? zoneAt(best, T, L.zone) : [best], target: s.ball.holder, tunnel: true });
        }
      }
    }
  }
  /** the rows a player of theirs could score at from where he stands (against our positions now) */
  openRows(u: Unit) {
    const d = this.dist(1, u.c), out: number[] = [];
    if (u.keeper || d > this.o.level.shotRange) return out;
    const [lo, hi] = this.mouth(0), tuft = this.keeperOf(0);
    const cov = this.covered(0, d, tuft.r, u.r);
    for (let row = lo; row <= hi; row++) {
      const cells = line(u, { c: -1, r: row }).filter((c) => c.c >= 0);
      if (cells.some((c) => { const o = this.at(c.c, c.r); return (o && o.id !== u.id && !o.keeper) || !this.inside(c.c, c.r); })) continue;
      if (!cov.includes(row) && !cells.some((c) => c.c === tuft.c && c.r === tuft.r)) out.push(row);
    }
    return out;
  }
  /** the best of those (furthest from our keeper), or -1 */
  clearShot(u: Unit) {
    const tuft = this.keeperOf(0);
    return this.openRows(u).sort((a, b) => Math.abs(b - tuft.r) - Math.abs(a - tuft.r) || a - b)[0] ?? -1;
  }
  /** the other side has the ball: every shot, dribble, pass and long ball its carrier could make, valued (by the
   * teams that read the game) against what we could do about it, and the best one taken */
  planAttack() {
    const s = this.s, L = this.o.level, car = this.carrier!;
    const g = s.units.filter((u) => u.team === 1 && !u.keeper);
    const reds = s.units.filter((u) => u.team === 0), outfield = reds.filter((u) => !u.keeper);
    const reserved = new Set<number>(s.units.map((u) => key(u.c, u.r)));
    const gk = this.keeperOf(1), [glo, ghi] = this.mouth(1);
    s.intents.push({ id: gk.id, kind: 'keeper', path: [{ c: gk.c, r: gk.r }, ...(gk.r !== clamp(4, glo, ghi) ? [{ c: gk.c, r: gk.r + Math.sign(4 - gk.r) }] : [])], zone: [], target: -1 });
    const range = this.h.passRange?.(1) ?? PASS;
    // teams that read lanes also read where we can get to: a cell one of ours can step onto, a carrier one of ours can
    // get next to (to tackle), a line one of ours can step into
    const care = Math.min(1, L.lanes);
    const reach = new Set<number>();
    for (const u of outfield) for (const p of this.paths(u, DEFEND).values()) { const e = p[p.length - 1]; reach.add(key(e.c, e.r)); }
    const reachable = (c: Cell) => reach.has(key(c.c, c.r));
    const cuttable = (cells: Cell[]) => cells.some(reachable);
    const tackleable = (e: Cell) => outfield.some((u) => cheb(u, e) <= DEFEND + 1 && !(L.front && u.c < e.c));
    const shotLine = (at: Cell, row: number) => line(at, { c: -1, r: row }).filter((c) => c.c >= 0);
    /** a shot from a cell, against our best reply: the rows none of us can step in front of, less what the keeper covers
     * after his step. 60 when it can't be stopped */
    const shotValue = (u: Unit, at: Cell) => {
      if (u.keeper || this.dist(1, at.c) > L.shotRange) return 0;
      const rows = this.openRows({ ...u, c: at.c, r: at.r });
      if (!rows.length) return 0;
      if (!care) return 20 + rows.length * 5;
      const [lo, hi] = this.mouth(0), tuft = this.keeperOf(0), d = this.dist(1, at.c);
      const safe = rows.filter((row) => !cuttable(shotLine(at, row)));
      const left = Math.min(...[tuft.r - 1, tuft.r, tuft.r + 1].filter((r) => r >= lo && r <= hi).map((kr) => safe.filter((row) => !this.covered(0, d, kr, at.r).includes(row)).length));
      return left > 0 ? 60 : 6 + safe.length * 4;
    };
    const near = (c: Cell) => Math.min(9, ...outfield.map((u) => cheb(u, c)));
    type Plan = { v: number; bi: BallIntent; path?: Cell[]; to?: Unit; then?: Unit; alts?: number[] };
    const plans: Plan[] = [];
    // shoot from here
    const sv = shotValue(car, car);
    if (sv > 0) {
      const row = this.clearShot(car);
      plans.push({ v: 40 + sv, bi: { k: 'shot', row } });
    }
    // dribble (or stand)
    for (const p of [[{ c: car.c, r: car.r }], ...this.paths(car).values()]) {
      if (car.keeper) break;
      const e = p[p.length - 1];
      let v = (car.c - e.c) * 2 + Math.min(near(e), 4) - Math.abs(e.r - 4) * 0.3 + this.rnd() * 0.01;
      if (care) { v += tackleable(e) ? -40 : 4; v += this.openRows({ ...car, c: e.c, r: e.r }).length * 3; }
      plans.push({ v, bi: p.length > 1 ? { k: 'dribble' } : { k: 'hold' }, path: p });
    }
    // pass to a team-mate (who shoots at once if he can)
    const passes: [Unit, number, boolean][] = [];
    for (const q of g) {
      if (q === car || cheb(q, car) > range || cheb(q, car) < 2) continue;
      const cells = line(car, q);
      if (cells.some((c) => this.at(c.c, c.r)?.team === 0)) continue;
      if (this.h.noBack?.(1, car, false) && q.c > car.c && !car.keeper) continue;
      const cut = cuttable(cells);
      let v = (car.c - q.c) * 2 + Math.min(near(q), 4) + (car.keeper ? 10 : 0);
      if (care) v += cut ? -25 : 6;
      passes.push([q, v, cut]);
    }
    passes.sort((a, b) => b[1] - a[1]);
    for (const [q, v, cut] of passes) {
      // the ones he keeps in mind if this one's cut off
      const alts = passes.filter((p) => p[0] !== q && p[1] > -10).slice(0, L.options ?? 0).map((p) => p[0]);
      const covered = cut && alts.some((a) => !passes.find((p) => p[0] === a)![2]);
      const shot = shotValue(q, q);
      plans.push({ v: v + (care && covered ? 25 : 0) + (shot ? 10 + shot : 0), bi: { k: 'pass', to: q.id, shoot: shot ? this.clearShot(q) : undefined, alts: alts.length ? alts.map((a) => a.id) : undefined }, to: q });
    }
    // a long ball: an aerial team's favourite, and a keeper's way out
    // a long ball to a free team-mate (a cross, if he can head it in): nobody of ours can get near where it drops
    for (const q of g) {
      if (q === car || cheb(q, car) < LOFT[0] || cheb(q, car) > LOFT[1] || (q.c >= car.c && !car.keeper)) continue;
      if (outfield.some((u) => cheb(u, q) <= DEFEND + 1)) continue;
      const head = shotValue(q, q);
      plans.push({ v: (car.c - q.c) * 2 + (L.aerial ? 8 : 0) + (head ? 10 + head : 0) - (L.aerial || car.keeper ? 0 : 6), bi: { k: 'loft', to: q.id, shoot: head ? this.clearShot(q) : undefined }, to: q });
    }
    plans.sort((a, b) => b.v - a.v);
    const best = plans[0] ?? { v: 0, bi: { k: 'hold' } as BallIntent, path: [{ c: car.c, r: car.r }] };
    // a slick team plays a pass on again at once
    if (best.bi.k === 'pass' && best.to && (L.passes ?? 1) > 1 && best.bi.shoot === undefined) {
      const to = best.to;
      const q2 = g.filter((q) => q !== car && q !== to && cheb(q, to) <= range && cheb(q, to) >= 2 && q.c < to.c - 1 && !line(to, q).some((c) => this.at(c.c, c.r)?.team === 0)).sort((a, b) => a.c - b.c || a.id - b.id)[0];
      if (q2) { best.bi.then = q2.id; best.then = q2; best.bi.alts = best.bi.alts?.filter((a) => a !== q2.id); }
    }
    s.bi = best.bi;
    if (best.path) {
      s.intents.push({ id: car.id, kind: 'carry', path: best.path, zone: [], target: -1 });
      const e = best.path[best.path.length - 1]; reserved.add(key(e.c, e.r));
      return this.support(g, car, reserved);
    }
    s.intents.push({ id: car.id, kind: 'carry', path: [{ c: car.c, r: car.r }], zone: [], target: best.to?.id ?? -1 });
    // the receivers wait for it; the rest (the other options too) make their runs, and are found where they end up
    const keep = [best.to, best.then].filter((u): u is Unit => !!u);
    for (const q of keep) s.intents.push({ id: q.id, kind: 'support', path: [{ c: q.c, r: q.r }], zone: [], target: car.id });
    this.support(g.filter((q) => !keep.includes(q)), car, reserved);
  }
  /** the cells a runner of theirs screens off when they attack: his cell and the ones beside it nearest our goal */
  screenAt(d: Cell) {
    const n = this.o.level.zone;
    const around = DIRS.map(([dc, dr]) => ({ c: d.c + dc, r: d.r + dr })).filter((c) => this.inside(c.c, c.r) && c.c > 0);
    around.sort((a, b) => a.c - b.c || Math.abs(a.r - d.r) - Math.abs(b.r - d.r));
    return [d, ...around.slice(0, n)];
  }
  /** while they attack, the screened cells our players can't step into */
  private screenCache: { of: Intent[]; n: number; set: Set<number> } | null = null;
  screened() {
    const s = this.s;
    if (this.poss !== 1) return null;
    if (this.screenCache?.of !== s.intents || this.screenCache.n !== s.intents.length) {
      const set = new Set<number>();
      for (const i of s.intents) if (i.kind === 'support' && this.unit(i.id).team === 1) for (const z of i.zone) set.add(key(z.c, z.r));
      this.screenCache = { of: s.intents, n: s.intents.length, set };
    }
    return this.screenCache.set;
  }
  /** Grumbles without the ball push up into open cells, spread across the rows; the receiver of a pass waits for it */
  private support(g: Unit[], car: Unit, reserved: Set<number>, to?: Unit, then?: Unit) {
    const reds = this.s.units.filter((u) => u.team === 0 && !u.keeper);
    for (const q of g) {
      if (q === car) continue;
      if (q === to || q === then) { this.s.intents.push({ id: q.id, kind: 'support', path: [{ c: q.c, r: q.r }], zone: [], target: car.id }); continue; }
      let best: Cell[] = [{ c: q.c, r: q.r }], bs = -1e9;
      for (const p of this.paths(q).values()) {
        const e = p[p.length - 1];
        if (p.length > 1 && reserved.has(key(e.c, e.r))) continue;
        const near = Math.min(...reds.map((u) => cheb(u, e)));
        // a run into a shooting position the carrier can find counts most
        const shots = this.openRows({ ...q, c: e.c, r: e.r }).length;
        const findable = cheb(e, car) <= PASS && !line(car, e).some((c) => this.at(c.c, c.r)?.team === 0);
        // and a line from the carrier that none of us can step onto
        const lane = line(car, e), safe = lane.every((c) => reds.every((u) => cheb(u, c) > DEFEND));
        const v = -Math.max(e.c, 1) * 1 + Math.min(near, 2) * 0.8 + (shots && findable ? 4 + shots * 2 : 0) + (findable ? 1.5 : 0) + (findable && safe ? 3 : 0) - Math.abs(e.r - 4) * 0.3 + this.rnd() * 0.01;
        if (v > bs) { bs = v; best = p; }
      }
      const e = best[best.length - 1]; reserved.add(key(e.c, e.r));
      this.s.intents.push({ id: q.id, kind: 'support', path: best, zone: this.screenAt(best[best.length - 1]), target: -1 });
    }
  }

  // ---------------------------------------------------------------- the ball: previews and actions
  canAct(u: Unit) { return !this.s.over && u.team === 0 && this.s.ball.holder === u.id && u.canAct && this.s.passes < (this.h.passCap?.() ?? CAP); }
  /** a ground pass: blocked by a Grumble's cell or a tackle zone on the way (Bender gets round one), a bank off the boards */
  passPreview(id: number, to: number, bank: 'top' | 'bottom' | null = null): PassPreview {
    const u = this.unit(id), q = this.unit(to);
    const bad = (reason: string): PassPreview => ({ ok: false, cells: [], by: -1, reason, banked: !!bank, bent: false, back: false, turnover: false });
    if (!u || !q || q.team !== u.team || q === u) return bad('no one there');
    if (u.team === 0 && !this.canAct(u)) return bad(u.canAct ? 'four passes a turn' : 'he can’t pass now');
    if (bank && !this.h.bank?.(u.team)) return bad('no banking');
    let cells: Cell[], len: number;
    if (bank) {
      // unfold the board: aim at the mirror image of the receiver, then fold the line back
      const h = this.edge(bank), mr = bank === 'top' ? 2 * h - 1 - q.r : 2 * h - 1 - q.r;
      const mirror = { c: q.c, r: mr };
      const fold = (r: number) => bank === 'top' ? (r < h ? 2 * h - 1 - r : r) : (r > h ? 2 * h - 1 - r : r);
      cells = line(u, mirror).map((c) => ({ c: c.c, r: fold(c.r) })).filter((c) => !same(c, q) && !same(c, u));
      len = cheb(u, mirror);
    } else { cells = line(u, q); len = cheb(u, q); }
    const range = this.h.passRange?.(u.team) ?? PASS;
    if (len > range) return { ...bad(`too far (${range} cells at most)`), cells };
    const z = this.zones();
    const blockers: number[] = [];
    for (const c of cells) {
      if (!this.inside(c.c, c.r)) return { ...bad('a hedge is in the way'), cells };
      const o = this.at(c.c, c.r);
      if (o && o.team !== u.team) { if (!blockers.includes(o.id)) blockers.push(o.id); continue; }
      const zz = z.get(key(c.c, c.r));
      if (zz !== undefined && u.team === 0 && !blockers.includes(zz)) blockers.push(zz);
      // a thieving team reaches out for anything that goes past next to one of them
      if (u.team === 0 && this.o.level.thief) for (const g of this.s.units) if (g.team === 1 && !g.keeper && cheb(g, c) === 1 && !blockers.includes(g.id)) blockers.push(g.id);
    }
    const back = u.team === 0 ? q.c < u.c : q.c > u.c;
    const bent = blockers.length === 1 && !!this.h.bend?.(u.team);
    const turnover = back && !!this.h.noBack?.(u.team, u, bent);
    if (blockers.length && !bent) return { ok: false, cells, by: blockers[0], reason: 'intercepted', banked: !!bank, bent: false, back, turnover };
    return { ok: !turnover, cells, by: -1, reason: turnover ? 'no back-passes' : '', banked: !!bank, bent, back, turnover };
  }
  /** the row a board sits beyond, after hedges: banking off the top folds the line about row edge - 0.5 */
  edge(side: 'top' | 'bottom') {
    if (side === 'top') { let h = 0; while (h < 4 && !this.inside(7, h)) h++; return h; }
    let h = ROWS; while (h > ROWS - 4 && !this.inside(7, h - 1)) h--; return h;
  }
  pass(id: number, to: number, bank: 'top' | 'bottom' | null = null) {
    this.events = [];
    const pv = this.passPreview(id, to, bank);
    const u = this.unit(id), q = this.unit(to);
    if (!(pv.ok || pv.reason === 'intercepted' || pv.turnover)) return false;
    if (u.team !== 0 || !this.canAct(u)) return false;
    this.save();
    u.canAct = false; this.s.passes++;
    const from = { c: u.c, r: u.r };
    if (pv.turnover) {
      // No Back-passes: the nearest Grumble gets the ball where it was played
      const g = this.s.units.filter((v) => v.team === 1 && !v.keeper).sort((a, b) => cheb(a, u) - cheb(b, u))[0];
      this.give(g);
      this.events.push({ k: 'pass', from, to: { c: q.c, r: q.r }, lofted: false, team: 0, holder: g.id, flight: false, bank: bank ?? undefined }, { k: 'turnover', holder: g.id });
      this.afterLoss();
      return true;
    }
    if (!pv.ok) {
      const g = this.unit(pv.by);
      this.give(g);
      this.events.push({ k: 'pass', from, to: { c: g.c, r: g.r }, lofted: false, team: 0, holder: g.id, flight: false }, { k: 'intercept', by: g.id, at: { c: g.c, r: g.r }, holder: g.id });
      this.afterLoss();
      return true;
    }
    this.completed(u, q, false, cheb(u, q), pv);
    this.events.push({ k: 'pass', from, to: { c: q.c, r: q.r }, lofted: false, team: 0, holder: q.id, flight: false, bank: bank ?? undefined });
    return true;
  }
  private completed(u: Unit, q: Unit, lofted: boolean, len: number, pv?: PassPreview) {
    const rec: PassRec = { from: u.id, to: q.id, team: u.team, lofted, len, back: u.team === 0 ? q.c < u.c : q.c > u.c, banked: !!pv?.banked, bent: !!pv?.bent, turn: this.s.turn, oneTouch: !u.started && u.got !== '', a: { c: u.c, r: u.r }, b: { c: q.c, r: q.r } };
    this.s.chain.push(rec);
    this.give(q);
    q.got = lofted ? 'loft' : 'ground';
    q.canAct = !q.moved;
    q.safe = true;
    this.h.onPass?.(rec);
  }
  /** after we lose the ball mid-turn: the Grumbles re-plan nothing (they've said what they'll do), but nobody can act */
  private afterLoss() { for (const v of this.s.units) if (v.team === 0) v.canAct = false; }

  /** a lofted pass: where it lands (after wind and bounce), who's waiting, and whether a tackle zone is there */
  loftPreview(id: number, c: number, r: number): LoftPreview {
    const u = this.unit(id);
    const bad = (reason: string, land = { c, r }): LoftPreview => ({ ok: false, land, by: -1, catcher: -1, reason });
    if (!u || (u.team === 0 && !this.canAct(u))) return bad('he can’t pass now');
    const d = cheb(u, { c, r });
    if (d < LOFT[0] || d > LOFT[1]) return bad(`${LOFT[0]} to ${LOFT[1]} cells`);
    let land = this.h.landing?.(u.team, { c: u.c, r: u.r }, { c, r }) ?? { c, r };
    land = { c: clamp(land.c, 0, COLS - 1), r: clamp(land.r, 0, ROWS - 1) };
    if (!this.inside(land.c, land.r)) return bad('it would land in a hedge', land);
    const o = this.at(land.c, land.r);
    if (o && o.team !== u.team) return { ok: false, land, by: o.id, catcher: -1, reason: 'a Grumble’s standing there' };
    const z = this.zones().get(key(land.c, land.r));
    if (z !== undefined && u.team === 0) return { ok: false, land, by: z, catcher: -1, reason: 'it lands in a tackle zone' };
    if (u.team === 0 && this.o.level.aerial) {
      const jumper = this.resolved().find((r) => cheb(r.end, land) <= 1);
      if (jumper) return { ok: false, land, by: jumper.id, catcher: -1, reason: 'they win everything in the air near them' };
    }
    const mates = this.s.units.filter((v) => v.team === u.team && v !== u && !v.keeper && cheb(v, land) <= 1).sort((a, b) => cheb(a, land) - cheb(b, land) || a.id - b.id);
    return { ok: true, land, by: -1, catcher: mates[0]?.id ?? -1, reason: mates.length ? '' : 'it lands at the end of the turn' };
  }
  loft(id: number, c: number, r: number) {
    this.events = [];
    const u = this.unit(id), pv = this.loftPreview(id, c, r);
    if (pv.reason === 'he can’t pass now' || /cells$/.test(pv.reason) || pv.reason === 'it would land in a hedge') return false;
    this.save();
    u.canAct = false; this.s.passes++;
    const from = { c: u.c, r: u.r };
    if (!pv.ok) {
      const g = this.unit(pv.by);
      this.give(g);
      this.events.push({ k: 'pass', from, to: pv.land, lofted: true, team: 0, holder: g.id, flight: false }, { k: 'intercept', by: g.id, at: { c: g.c, r: g.r }, holder: g.id });
      this.afterLoss(); return true;
    }
    if (pv.catcher >= 0) {
      const q = this.unit(pv.catcher);
      this.completed(u, q, true, cheb(u, pv.land));
      this.events.push({ k: 'pass', from, to: { c: q.c, r: q.r }, lofted: true, team: 0, holder: q.id, flight: false });
      return true;
    }
    // in the air until the end of the turn
    this.s.ball = { holder: -1, c: pv.land.c, r: pv.land.r, flight: { c: pv.land.c, r: pv.land.r, team: 0, from: u.id } };
    this.events.push({ k: 'pass', from, to: pv.land, lofted: true, team: 0, holder: -1, flight: true });
    return true;
  }

  /** the mouth cells a keeper at `row` covers against a shot from `dist` columns out and `from` row */
  covered(side: Team, dist: number, row: number, from: number, header = false) {
    const [lo, hi] = this.mouth(side);
    const base = dist <= 2 ? 1 : dist <= 5 ? 2 : 3;
    // a better keeper of theirs covers more, except point-blank
    // inside 6 columns no keeper can cover the whole mouth on his own (the laws aside)
    const kl = side === 1 ? this.o.level.keeper ?? 0 : 0, b2 = Math.min(dist <= 5 ? hi - lo : 9, base + (dist > 2 ? kl : Math.max(0, kl - 1)));
    // a header has less on it than a shot: the keeper gets to one more cell
    const b3 = b2 + (header ? 1 : 0);
    const n = Math.max(1, this.h.keeperCover?.(side, dist, b3) ?? b3);
    const out = [row];
    const toward = from === row ? (row - lo <= hi - row ? 1 : -1) : Math.sign(from - row);
    for (let k = 1; out.length < n && k < 8; k++) {
      for (const sgn of [toward, -toward]) if (out.length < n) { const rr = row + sgn * k; if (rr >= lo && rr <= hi) out.push(rr); }
    }
    return out.filter((r) => r >= lo && r <= hi);
  }
  shotCtx(u: Unit, row: number): ShotCtx {
    return { by: u.id, team: u.team, c: u.c, r: u.r, row, dist: this.dist(u.team, u.c), header: u.got === 'loft', deflected: false, turn: this.s.turn, chain: this.s.chain.slice(), lastTouch: u.team };
  }
  /** a shot at a row of the mouth (or the post rows either side): GOAL, SAVED, BLOCKED or the woodwork, and its worth */
  shotPreview(id: number, row: number): ShotPreview {
    const u = this.unit(id);
    const side: Team = u.team === 0 ? 1 : 0;
    const [lo, hi] = this.mouth(side);
    const empty: ShotPreview = { result: 'blocked', cells: [], covered: [], blocker: -1, value: 0, notes: [], corner: false };
    if (!u || (u.team === 0 && !this.canAct(u)) || row < lo - 1 || row > hi + 1) return empty;
    const gx = side === 1 ? COLS : -1;
    const cells = line(u, { c: gx, r: row }).filter((c) => c.c >= 0 && c.c < COLS);
    const dist = this.dist(u.team, u.c);
    const keeper = this.keeperOf(side);
    // their keeper stands where his intent takes him; ours where he is
    const kr = side === 1 ? (this.s.intents.find((i) => i.id === keeper.id)?.path.slice(-1)[0]?.r ?? keeper.r) : keeper.r;
    const covered = this.covered(side, dist, kr, u.r, u.got === 'loft');
    // a shot across the face of goal that runs through the keeper is his too
    if (cells.some((c) => c.c === keeper.c && c.r === kr) && !covered.includes(row)) covered.push(row);
    const ctx = this.shotCtx(u, row);
    const blockers = cells.map((c) => this.at(c.c, c.r)).filter((o): o is Unit => !!o && o !== u && !o.keeper);
    const res = (result: ShotResult, value = 0, notes: string[] = []): ShotPreview => ({ result, cells, covered, blocker: blockers[0]?.id ?? -1, value, notes, corner: row === lo || row === hi });
    for (const c of cells) if (!this.inside(c.c, c.r)) return res('blocked');
    // their tackle zones: a shooter standing in one is closed down, and a shot through one is charged down
    if (u.team === 0) {
      const z = this.zones(), by = z.get(key(u.c, u.r)) ?? cells.map((c) => z.get(key(c.c, c.r))).find((x) => x !== undefined);
      if (by !== undefined) return { ...res('blocked'), blocker: by };
    }
    const post = row === lo - 1 || row === hi + 1;
    if (blockers.length) {
      const b = blockers[0];
      if (blockers.length === 1 && b.team !== u.team && !post && !covered.includes(row) && (dist <= (this.h.shotRange?.(u.team) ?? SHOT) || this.h.farShot?.(u)) && this.h.deflect?.(u.team, ctx, b)) {
        const v = this.h.goalValue?.(u.team, { ...ctx, deflected: true, lastTouch: b.team }) ?? { value: 1, notes: [] };
        return res('deflected', v.value, v.notes);
      }
      return res('blocked');
    }
    if (post) { const w = this.h.woodwork?.(u.team, ctx, false) ?? { value: 0, notes: [] }; return res('post', w.value, w.notes); }
    const far = dist > (this.h.shotRange?.(u.team) ?? (u.team === 1 ? this.o.level.shotRange : SHOT)) && !this.h.farShot?.(u);
    if (far) return res('far');
    if (covered.includes(row)) {
      const w = (row === lo || row === hi) ? this.h.woodwork?.(u.team, ctx, true) ?? { value: 0, notes: [] } : { value: 0, notes: [] };
      return res('saved', w.value, w.notes);
    }
    const v = this.h.goalValue?.(u.team, ctx) ?? { value: 1, notes: [] };
    return res('goal', v.value, v.notes);
  }
  shoot(id: number, row: number) {
    this.events = [];
    const u = this.unit(id);
    if (!u || u.team !== 0 || !this.canAct(u)) return false;
    const [lo, hi] = this.mouth(1);
    if (row < lo - 1 || row > hi + 1) return false;
    const pv = this.shotPreview(id, row);
    this.save();
    u.canAct = false;
    this.resolveShot(u, row, pv);
    return true;
  }
  private resolveShot(u: Unit, row: number, pv: ShotPreview) {
    const side: Team = u.team === 0 ? 1 : 0, from = { c: u.c, r: u.r }, to = { c: side === 1 ? COLS : -1, r: row };
    const scoring = pv.result === 'goal' || pv.result === 'deflected' || pv.value > 0;
    let holder = -1;
    if (pv.result === 'blocked' && pv.blocker >= 0) { holder = pv.blocker; this.give(this.unit(pv.blocker)); }
    else if (!scoring || pv.result === 'saved' || pv.result === 'post') {
      // the keeper's ball, unless a parry sends it back out to the shooter's side
      const k = this.keeperOf(side);
      const kr = this.s.intents.find((i) => i.id === k.id)?.path.slice(-1)[0]?.r;
      if (side === 1 && kr !== undefined) k.r = kr;
      if (pv.result === 'saved' && this.h.parry?.(u.team)) {
        const mates = this.s.units.filter((v) => v.team === u.team && !v.keeper).sort((a, b) => cheb(a, k) - cheb(b, k) || a.id - b.id);
        holder = mates[0].id; this.give(mates[0]);
      } else { holder = k.id; this.give(k); }
    }
    this.events.push({ k: 'shot', from, to, team: u.team, result: pv.result, holder, value: pv.value, notes: pv.notes });
    if (scoring) this.scored(u.team, pv.value, pv.notes);
    else if (u.team === 0) this.afterLoss();
  }
  private scored(team: Team, value: number, notes: string[]) {
    const s = this.s;
    s.score[team] += value; s.goals[team]++;
    this.events.push({ k: 'goal', team, value, notes });
    s.ball = { holder: -1, c: team === 0 ? COLS - 1 : 0, r: 4, flight: null };
    s.kickoff = this.h.kickoffSide?.(team) ?? (team === 0 ? 1 : 0);
    for (const v of s.units) if (v.team === 0) v.canAct = false;
    if (s.golden) s.over = true;
  }

  // ---------------------------------------------------------------- defending: tackles
  canTackle(id: number) {
    const u = this.unit(id), c = this.carrier;
    return !!u && !!c && !this.s.over && u.team === 0 && !u.keeper && c.team === 1 && cheb(u, c) <= 1 && this.s.tackle < 0 && !c.keeper && !this.frontOn(id) && !this.s.fresh;
  }
  /** a team that can't be tackled from the front: we're in front of their carrier (on the side they attack) */
  frontOn(id: number) { const u = this.unit(id), c = this.carrier; return !!this.o.level.front && !!c && c.team === 1 && cheb(u, c) <= 1 && u.c < c.c; }
  /** will a tackle now win the ball? A tackle beats a dribble (or a carrier holding on); a pass or shot goes first */
  tacklePreview(id: number) {
    if (!this.canTackle(id)) return { ok: false, reason: this.s.fresh ? 'no tackling at a kick-off' : this.frontOn(id) ? 'can’t be tackled from the front' : 'not next to their carrier' };
    const bi = this.s.bi;
    if (bi && (bi.k === 'pass' || bi.k === 'shot' || bi.k === 'loft')) return { ok: false, reason: bi.k === 'shot' ? 'he shoots first' : 'he passes first' };
    return { ok: true, reason: 'wins the ball' };
  }
  tackle(id: number) {
    this.events = [];
    if (!this.canTackle(id)) return false;
    this.save();
    this.s.tackle = id;
    const u = this.unit(id); u.moved = true;
    return true;
  }

  // ---------------------------------------------------------------- undo and hints
  private save() { this.stack.push(JSON.stringify(this.s)); }
  get canUndo() { return this.stack.length > 0; }
  undo() { const t = this.stack.pop(); if (!t) return false; this.s = JSON.parse(t); this.events = []; return true; }
  /** the best safe thing to do with the ball now: a goal, else the most forward safe pass, else a step out of the zones */
  hint(): { k: 'shoot'; id: number; row: number } | { k: 'pass'; id: number; to: number } | { k: 'move'; id: number; c: number; r: number } | { k: 'tackle'; id: number } | null {
    const car = this.carrier;
    if (!car || this.s.over) return null;
    if (car.team === 1) {
      const bi = this.s.bi;
      if (bi && (bi.k === 'dribble' || bi.k === 'hold')) for (const u of this.s.units) if (u.team === 0 && this.tacklePreview(u.id).ok) return { k: 'tackle', id: u.id };
      // the step (keeper first) that does most to stop what they're about to do
      let best: { id: number; c: number; r: number } | null = null, bd = this.danger();
      if (bd <= 0) return null;
      for (const u of this.s.units.filter((v) => v.team === 0 && !v.moved).sort((a, b) => Number(b.keeper) - Number(a.keeper))) for (const r of this.reach(u.id)) {
        if (!this.move(u.id, r.c, r.r)) continue;
        const d = this.danger(); this.undo();
        if (d < bd) { bd = d; best = { id: u.id, c: r.c, r: r.r }; }
      }
      return best ? { k: 'move', ...best } : null;
    }
    if (!this.canAct(car) && car.moved) return null;
    const [lo, hi] = this.mouth(1);
    if (this.canAct(car)) {
      let bestRow = -1, bv = 0;
      for (let row = lo - 1; row <= hi + 1; row++) { const p = this.shotPreview(car.id, row); if ((p.result === 'goal' || p.result === 'deflected' || p.value > 0) && p.value > bv) { bv = p.value; bestRow = row; } }
      if (bestRow >= 0) return { k: 'shoot', id: car.id, row: bestRow };
      const z = this.zones();
      let best = -1, bs = -1e9;
      for (const q of this.s.units) {
        if (q.team !== 0 || q === car || q.keeper) continue;
        const p = this.passPreview(car.id, q.id);
        if (!p.ok) continue;
        const v = (q.c - car.c) * 2 - (z.has(key(q.c, q.r)) ? 6 : 0) + (q.moved ? 0 : 1);
        if (v > bs) { bs = v; best = q.id; }
      }
      if (best >= 0 && (bs > 0 || this.zones().has(key(car.c, car.r)))) return { k: 'pass', id: car.id, to: best };
    }
    if (!car.moved) {
      const z = this.zones();
      let best: Cell | null = null, bs = -1e9;
      for (const r of this.reach(car.id)) { if (z.has(key(r.c, r.r))) continue; const v = r.c - (Math.abs(r.r - 4) * 0.2); if (v > bs) { bs = v; best = r; } }
      if (best) return { k: 'move', id: car.id, c: best.c, r: best.r };
    }
    return null;
  }
  /** how much their planned ball action still threatens: 10 for every row they could score at, 1 for a pass or long
   * ball nobody's cut out, 1 for a dribble nobody can tackle. 0 means it's stopped */
  danger() {
    const bi = this.s.bi, car = this.carrier;
    if (!bi || !car || car.team !== 1) return 0;
    const cut = (a: Unit, b: Unit) => line(a, b).some((c) => this.at(c.c, c.r)?.team === 0);
    if (bi.k === 'shot') return this.openRows(car).length * 10;
    if (bi.k === 'pass') {
      const opts = [bi.to, ...(bi.alts ?? [])].map((i) => this.unit(i)).filter((q) => !cut(car, q));
      if (!opts.length) return 0;
      const q = opts[0];
      if (bi.then !== undefined && cut(q, this.unit(bi.then))) return 0;
      return 1 + Math.max(...opts.map((o) => this.openRows(o).length)) * (bi.shoot !== undefined || opts.length > 1 ? 10 : 0);
    }
    if (bi.k === 'loft') return this.s.units.some((u) => u.team === 0 && !u.keeper && cheb(u, this.unit(bi.to)) <= 1) ? 0 : 1 + (bi.shoot !== undefined ? this.openRows(this.unit(bi.to)).length * 10 : 0);
    return this.s.tackle >= 0 ? 0 : 1;
  }
  /** the cells their pass or shot will travel through (where one of ours can cut it out) */
  threat(): Cell[] {
    const bi = this.s.bi, car = this.carrier;
    if (!bi || !car || car.team !== 1) return [];
    // a shot can go at any row of the mouth: every line is a threat until it's blocked or the keeper has it
    const shots = (u: Unit) => { const [lo, hi] = this.mouth(0), out: Cell[] = []; for (let r = lo; r <= hi; r++) out.push(...line(u, { c: -1, r }).filter((c) => c.c >= 0)); return out; };
    if (bi.k === 'shot') return shots(car);
    if (bi.k === 'pass') {
      const q = this.unit(bi.to), out = line(car, q);
      if (bi.then !== undefined) out.push(...line(q, this.unit(bi.then)));
      if (bi.shoot !== undefined) out.push(...shots(q));
      for (const a of bi.alts ?? []) { const t = this.unit(a); out.push(...line(car, t)); if (this.openRows(t).length) out.push(...shots(t)); }
      return out;
    }
    return [];
  }

  // ---------------------------------------------------------------- End turn: the Grumbles do what they said
  endTurn() {
    this.events = [];
    const s = this.s;
    if (s.over) return false;
    this.stack = [];
    // after our goal the turn's over: straight to the kick-off
    if (s.kickoff !== null) return this.clock();
    const bi = s.bi, car = this.carrier;
    // 1. our tackle, if their carrier was going to dribble or hold on
    if (s.tackle >= 0 && car && car.team === 1 && (!bi || bi.k === 'dribble' || bi.k === 'hold')) {
      const t = this.unit(s.tackle);
      this.give(t); t.safe = false;
      this.events.push({ k: 'tackle', by: t.id, at: { c: car.c, r: car.r }, holder: t.id, won: true });
    }
    // 2. the Grumbles move (a pass's receiver waits; the carrier dribbles if he still has it)
    const res = this.resolved();
    const zoneOf = new Map(res.map((r) => [r.id, r.zone]));
    for (const r of res) {
      const u = this.unit(r.id);
      if (r.path.length < 2) continue;
      if (s.ball.holder === u.id && u.team === 1 && bi?.k !== 'dribble') continue;
      let path = this.slid(u, r.path);
      if (path !== r.path) { const e = path[path.length - 1]; if (this.at(e.c, e.r)) path = r.path; }
      const e = path[path.length - 1];
      u.c = e.c; u.r = e.r;
      if (s.ball.holder === u.id) { s.ball.c = u.c; s.ball.r = u.r; }
      this.events.push({ k: 'move', id: u.id, path, holder: s.ball.holder });
    }
    // 3. their ball action (if they've still got it)
    const c2 = this.carrier;
    if (c2 && car && c2.id === car.id && c2.team === 1 && bi && (bi.k === 'shot' || bi.k === 'pass' || bi.k === 'loft')) this.theirBall(c2, bi);
    // 4. tackle zones on our carrier
    const mine = this.carrier;
    if (mine && mine.team === 0) {
      for (const r of res) {
        if (!zoneOf.get(r.id)!.some((z) => same(z, mine))) continue;
        // sticky boots: a long lunge can't knock him off it, only a tackle from right beside him
        if ((mine.safe && this.h.sticky?.(0) && cheb(r.end, mine) > 1) || s.fresh) continue;
        const g = this.unit(r.id);
        this.give(g);
        this.events.push({ k: 'tackle', by: g.id, at: { c: mine.c, r: mine.r }, holder: g.id, won: true });
        // won in sight of goal: a snap shot, there and then; or a quick ball to a team-mate who has one
        const row = this.clearShot(g);
        if (row >= 0) this.theirBall(g, { k: 'shot', row });
        else {
          const range = this.h.passRange?.(1) ?? PASS;
          const q = s.units.filter((v) => v.team === 1 && !v.keeper && v !== g && cheb(v, g) >= 2 && cheb(v, g) <= range && this.clearShot(v) >= 0 && !line(g, v).some((c) => this.at(c.c, c.r)?.team === 0)).sort((a, b) => a.c - b.c || a.id - b.id)[0];
          if (q) this.theirBall(g, { k: 'pass', to: q.id, shoot: this.clearShot(q) });
        }
        break;
      }
    }
    // 5. a lofted ball lands
    if (s.ball.flight) {
      const f = s.ball.flight, at = { c: f.c, r: f.r };
      const zz = res.find((r) => r.zone.some((z) => same(z, at)));
      const onIt = this.at(at.c, at.r);
      let taker: Unit | null = null;
      const jumper = f.team === 0 && this.o.level.aerial ? s.units.find((v) => v.team === 1 && !v.keeper && cheb(v, at) <= 1) : undefined;
      if (onIt) taker = onIt;
      else if (zz && f.team === 0) taker = this.unit(zz.id);
      else if (jumper) taker = jumper;
      else {
        const near = s.units.filter((v) => !v.keeper && cheb(v, at) <= 1).sort((a, b) => cheb(a, at) - cheb(b, at) || (a.team === f.team ? -1 : 1) || a.id - b.id);
        taker = near[0] ?? null;
      }
      s.ball = { holder: -1, c: at.c, r: at.r, flight: null };
      s.lastTouch = f.team;
      if (taker) {
        if (taker.team === f.team && !taker.keeper) { const from = this.unit(f.from); this.completed(from, taker, true, cheb(from, at)); }
        else this.give(taker);
      }
      this.events.push({ k: 'land', at, holder: s.ball.holder });
    }
    for (const u of s.units) u.safe = false;
    return this.clock();
  }
  /** the turn's done: count it, maybe golden turns or full time, then the next turn (after a kick-off if there was a goal) */
  private clock() {
    this.s.fresh = false; this.s.kicked = -1;
    const s = this.s;
    s.turn++;
    if (!s.over && s.turn >= s.maxTurns) {
      if (!s.golden && s.score[0] === s.score[1] && (this.h.golden?.() ?? true)) { s.golden = true; s.maxTurns += 2; this.events.push({ k: 'golden', holder: s.ball.holder }); }
      else { s.over = true; this.events.push({ k: 'full', holder: s.ball.holder }); }
    }
    if (s.over) { s.intents = []; s.bi = null; return true; }
    if (s.kickoff !== null) this.kickoffNow(s.kickoff);
    this.startTurn();
    return true;
  }
  /** a Grumble's shot, pass or long ball, against wherever we've put our players */
  private theirBall(car: Unit, bi: BallIntent): void {
    const s = this.s, from = { c: car.c, r: car.r };
    if (bi.k === 'shot') {
      // a shooter picks his corner as he strikes it: whichever row is still open, else the one he planned
      const open = this.clearShot(car), row = open >= 0 ? open : bi.row;
      this.resolveShot(car, row, this.shotPreview(car.id, row));
      return;
    }
    const q = this.unit((bi as { to: number }).to);
    if (bi.k === 'loft') {
      // a long ball: any of ours next to where it drops heads it away
      const ours = s.units.filter((v) => v.team === 0 && !v.keeper && cheb(v, q) <= 1).sort((a, b) => cheb(a, q) - cheb(b, q) || a.id - b.id);
      const t = ours[0] ?? q;
      this.give(t);
      this.events.push({ k: 'pass', from, to: { c: q.c, r: q.r }, lofted: true, team: 1, holder: t.id, flight: false });
      if (t.team === 0) this.events.push({ k: 'intercept', by: t.id, at: { c: t.c, r: t.r }, holder: t.id });
      else if (bi.shoot !== undefined && !s.over) { t.got = 'loft'; const row = this.clearShot(t); this.theirBall(t, { k: 'shot', row: row >= 0 ? row : bi.shoot }); }
      return;
    }
    const cutOf = (t: Unit) => line(car, t).map((c) => this.at(c.c, c.r)).find((o) => o && o.team === 0) ?? null;
    const cut = cutOf(q);
    if (cut && bi.k === 'pass' && bi.alts) {
      // cut off: he plays one of the others instead, if one's open (and that one shoots if he can)
      const alt = bi.alts.map((a) => this.unit(a)).find((t) => !cutOf(t));
      if (alt) { const row = this.clearShot(alt); return this.theirBall(car, { k: 'pass', to: alt.id, shoot: row >= 0 ? row : undefined }); }
    }
    if (cut) {
      this.give(cut);
      this.events.push({ k: 'pass', from, to: { c: cut.c, r: cut.r }, lofted: false, team: 1, holder: cut.id, flight: false }, { k: 'intercept', by: cut.id, at: { c: cut.c, r: cut.r }, holder: cut.id });
      return;
    }
    const rec: PassRec = { from: car.id, to: q.id, team: 1, lofted: false, len: cheb(car, q), back: q.c > car.c, banked: false, bent: false, turn: s.turn, oneTouch: false, a: { c: car.c, r: car.r }, b: { c: q.c, r: q.r } };
    s.chain.push(rec); this.give(q); this.h.onPass?.(rec);
    this.events.push({ k: 'pass', from, to: { c: q.c, r: q.r }, lofted: false, team: 1, holder: q.id, flight: false });
    if (bi.k === 'pass' && bi.then !== undefined) this.theirBall(q, { k: 'pass', to: bi.then });
    else if (bi.k === 'pass' && bi.shoot !== undefined && !this.s.over) this.theirBall(q, { k: 'shot', row: bi.shoot });
  }
}

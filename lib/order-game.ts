// Turn Order: the rules. An 8 by 8 garden of critters, each with one fixed verb, and a golden acorn that has to end up
// in Dora's pot. The player never touches a piece: every round, every critter acts once in the order of the queue,
// and all the player can do is swap two neighbours in that queue (and spend a token to send one to the front).
// Deterministic, no DOM: boards are generated from a seed and graded by a breadth-first solver over swap choices.

export const W = 8, H = 8;
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export type Actor = 'hog' | 'frog' | 'shroom' | 'beetle' | 'snail' | 'mole' | 'grumble';
export type Kind = Actor | 'rock' | 'acorn';
export const ACTORS: Actor[] = ['hog', 'frog', 'shroom', 'beetle', 'snail', 'mole', 'grumble'];
export const isActor = (k: Kind): k is Actor => k !== 'rock' && k !== 'acorn';
/** what each critter does on its turn, and what Enzo says the first time one turns up */
export const CRITTERS: Record<Actor, { name: string; verb: string; line: string; faces: boolean }> = {
  hog: { name: 'Hedgehog', verb: 'Rolls one tile forward, pushing whatever’s in front. Blocked, it turns round.', line: 'A hedgehog! It rolls forward and shoves whatever’s in front of it. That’s how the acorn gets moving.', faces: true },
  frog: { name: 'Frog', verb: 'Eats one small thing next to it (an acorn, a mushroom or a snail), looking ahead first, then round to the right.', line: 'Careful, a frog! It gobbles anything small next to it. Acorns included!', faces: true },
  shroom: { name: 'Mushroom', verb: 'Grows a new mushroom into an empty tile next to it, ahead first. The new one joins the end of the queue.', line: 'Mushrooms spread! Each one sprouts another, and the new ones join the end of the queue.', faces: true },
  beetle: { name: 'Bomb Beetle', verb: 'Goes off, clearing everything in the 3 by 3 square round it, walls aside.', line: 'A Bomb Beetle! It clears the whole square round it, so keep the acorn well away when its turn comes.', faces: false },
  snail: { name: 'Snail', verb: 'Turns every critter next to it a quarter turn to the right.', line: 'A snail! It turns its neighbours to face a new way: a hedgehog round a corner, say.', faces: false },
  mole: { name: 'Mole', verb: 'Asleep, it’s as solid as a wall. Bumped, it wakes, and on its next turn it burrows away.', line: 'A sleeping mole. Nothing gets past it, but bump it and it’ll wake up and dig off.', faces: false },
  grumble: { name: 'Grumble', verb: 'Steps towards the acorn, and steals it if it’s next to it.', line: 'A Grumble! It wants that acorn. If it’s next to it on its turn, it’s gone.', faces: false },
};
/** what a frog can eat */
const EDIBLE = new Set<Kind>(['acorn', 'shroom', 'snail']);
/** most critters on a board, so mushrooms can't grow without end */
export const MAX_ACTORS = 14;
export type Mutator = 'none' | 'reverse' | 'rotate';
export const MUTATORS: Record<Mutator, string> = {
  none: '',
  reverse: 'The queue turns back to front after every round.',
  rotate: 'After every round, the first in the queue goes to the back.',
};
export const BOARDS = 11, HP = 3, TOKENS = 2;

export type Piece = { id: number; k: Kind; x: number; y: number; f: Dir; awake: boolean };
export type Lost = '' | 'eaten' | 'boom' | 'stolen' | 'rounds';
export type Board = {
  /** wall tiles, by index y * W + x */
  walls: number[]; pot: { x: number; y: number };
  pieces: Piece[]; queue: number[]; nextId: number;
  rounds: number; mutator: Mutator; potted: boolean; lost: Lost;
};
export type Act = { id: number; k: Kind; what: 'push' | 'step' | 'turnback' | 'eat' | 'grow' | 'boom' | 'turn' | 'wake' | 'dig' | 'sleep' | 'grab' | 'idle' | 'skip' | 'pot'; target?: number; born?: number };
export type Step = { act: Act; pieces: Piece[] };

export function rngNext(s: number): [number, number] {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (s + 0x6d2b79f5) >>> 0];
}
export const cloneBoard = (b: Board): Board => ({ ...b, walls: b.walls, pot: b.pot, pieces: b.pieces.map((p) => ({ ...p })), queue: [...b.queue] });
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
export const isWall = (b: Board, x: number, y: number) => !inside(x, y) || b.walls.includes(y * W + x);
export const at = (b: Board, x: number, y: number) => b.pieces.find((p) => p.x === x && p.y === y);
const isPot = (b: Board, x: number, y: number) => b.pot.x === x && b.pot.y === y;
/** an empty lawn tile: inside, no wall, no pot, nothing on it */
const open = (b: Board, x: number, y: number) => !isWall(b, x, y) && !isPot(b, x, y) && !at(b, x, y);
const remove = (b: Board, p: Piece) => {
  b.pieces = b.pieces.filter((q) => q !== p);
  if (p.k === 'acorn' && !b.potted) b.lost ||= 'eaten';
};
export const acorn = (b: Board) => b.pieces.find((p) => p.k === 'acorn');

/** one critter's turn: changes the board and says what happened */
export function act(b: Board, p: Piece): Act {
  const base = { id: p.id, k: p.k };
  switch (p.k) {
    case 'hog': {
      const dx = DX[p.f], dy = DY[p.f];
      const line: Piece[] = [];
      let x = p.x + dx, y = p.y + dy, intoPot = false, mole: Piece | null = null, blocked = false;
      for (;;) {
        if (isWall(b, x, y)) { blocked = true; break; }
        if (isPot(b, x, y)) { if (line.length && line[line.length - 1].k === 'acorn') intoPot = true; else blocked = true; break; }
        const q = at(b, x, y);
        if (!q) break;
        if (q.k === 'mole' && !q.awake) { mole = q; blocked = true; break; }
        line.push(q); x += dx; y += dy;
      }
      if (blocked) {
        p.f = ((p.f + 2) % 4) as Dir;
        if (mole) { mole.awake = true; return { ...base, what: 'wake', target: mole.id }; }
        return { ...base, what: 'turnback' };
      }
      for (let i = line.length - 1; i >= 0; i--) { line[i].x += dx; line[i].y += dy; }
      p.x += dx; p.y += dy;
      if (intoPot) {
        const a = line[line.length - 1];
        b.potted = true; b.pieces = b.pieces.filter((q) => q !== a);
        return { ...base, what: 'pot', target: a.id };
      }
      return line.length ? { ...base, what: 'push', target: line[0].id } : { ...base, what: 'step' };
    }
    case 'frog': {
      for (let i = 0; i < 4; i++) {
        const d = (p.f + i) % 4, q = at(b, p.x + DX[d], p.y + DY[d]);
        if (q && EDIBLE.has(q.k)) { remove(b, q); return { ...base, what: 'eat', target: q.id }; }
      }
      return { ...base, what: 'idle' };
    }
    case 'shroom': {
      if (b.pieces.filter((q) => isActor(q.k)).length >= MAX_ACTORS) return { ...base, what: 'idle' };
      for (let i = 0; i < 4; i++) {
        const d = (p.f + i) % 4, x = p.x + DX[d], y = p.y + DY[d];
        if (open(b, x, y)) {
          const n: Piece = { id: b.nextId++, k: 'shroom', x, y, f: p.f, awake: false };
          b.pieces.push(n); b.queue.push(n.id);
          return { ...base, what: 'grow', born: n.id };
        }
      }
      return { ...base, what: 'idle' };
    }
    case 'beetle': {
      const hit = b.pieces.filter((q) => Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1);
      for (const q of hit) remove(b, q);
      if (hit.some((q) => q.k === 'acorn')) b.lost = 'boom';
      return { ...base, what: 'boom' };
    }
    case 'snail': {
      let n = 0;
      for (let d = 0; d < 4; d++) { const q = at(b, p.x + DX[d], p.y + DY[d]); if (q && isActor(q.k)) { q.f = ((q.f + 1) % 4) as Dir; n++; } }
      return { ...base, what: n ? 'turn' : 'idle' };
    }
    case 'mole': {
      if (!p.awake) return { ...base, what: 'sleep' };
      b.pieces = b.pieces.filter((q) => q !== p);
      return { ...base, what: 'dig' };
    }
    case 'grumble': {
      const a = acorn(b);
      if (!a) return { ...base, what: 'idle' };
      if (Math.abs(a.x - p.x) + Math.abs(a.y - p.y) === 1) { b.pieces = b.pieces.filter((q) => q !== a); b.lost = 'stolen'; return { ...base, what: 'grab', target: a.id }; }
      const ex = a.x - p.x, ey = a.y - p.y;
      const h: Dir = ex > 0 ? 1 : 3, v: Dir = ey > 0 ? 2 : 0;
      const tries: Dir[] = Math.abs(ex) >= Math.abs(ey) ? [h, v] : [v, h];
      for (const d of tries) {
        if ((d === h && ex === 0) || (d === v && ey === 0)) continue;
        if (open(b, p.x + DX[d], p.y + DY[d])) { p.x += DX[d]; p.y += DY[d]; p.f = d; return { ...base, what: 'step' }; }
      }
      return { ...base, what: 'idle' };
    }
  }
  return { ...base, what: 'idle' };
}

/** a whole round in the given order (critters born this round wait for the next): the new board and every step */
export function round(b0: Board, order: number[], nap = -1): { board: Board; steps: Step[] } {
  const b = cloneBoard(b0), steps: Step[] = [];
  for (const id of order) {
    const p = b.pieces.find((q) => q.id === id);
    if (!p) continue;
    const a = id === nap ? { id, k: p.k, what: 'skip' as const } : act(b, p);
    steps.push({ act: a, pieces: b.pieces.map((q) => ({ ...q })) });
    if (b.potted || b.lost) break;
  }
  b.queue = b.queue.filter((id) => b.pieces.some((q) => q.id === id));
  b.rounds--;
  if (b.mutator === 'reverse') b.queue.reverse();
  else if (b.mutator === 'rotate' && b.queue.length) b.queue.push(b.queue.shift()!);
  if (!b.potted && !b.lost && b.rounds <= 0) b.lost = 'rounds';
  return { board: b, steps };
}
/** the queue with neighbours i and i + 1 swapped */
export const swapped = (q: number[], i: number) => { const o = [...q]; if (i >= 0 && i + 1 < o.length) [o[i], o[i + 1]] = [o[i + 1], o[i]]; return o; };

const keyOf = (b: Board) => `${b.queue.join(',')}|${b.pieces.map((p) => `${p.id}:${p.x}${p.y}${p.f}${p.awake ? 1 : 0}`).sort().join(';')}`;
/** the fewest rounds to pot the acorn with one swap (or none) a round, from this board; Infinity if it can't be done in
 * the rounds it has. Also which first-round choices (-1 for no swap, else the swap's left index) can win. */
export function solve(b0: Board, limit = 200000): { rounds: number; firsts: number[]; choices: number; states: number } {
  const choicesOf = (b: Board) => [-1, ...b.queue.slice(0, -1).map((_, i) => i)];
  const firstChoices = choicesOf(b0);
  let frontier: { b: Board; first: number }[] = [{ b: b0, first: -2 }];
  const seen = new Set<string>([keyOf(b0)]);
  let states = 0, best = Infinity;
  const firsts = new Set<number>();
  for (let r = 1; r <= b0.rounds && frontier.length; r++) {
    const next: typeof frontier = [];
    for (const { b, first } of frontier) {
      for (const c of choicesOf(b)) {
        const f = r === 1 ? c : first;
        const { board } = round(b, swapped(b.queue, c));
        states++;
        if (board.potted) { best = Math.min(best, r); firsts.add(f); continue; }
        if (board.lost) continue;
        const k = keyOf(board) + '|' + f;
        if (seen.has(k)) continue;
        seen.add(k); next.push({ b: board, first: f });
      }
      if (states > limit) break;
    }
    // every way to win in the fewest rounds is found by the end of that round's level
    if (best < Infinity) break;
    frontier = next;
    if (states > limit) break;
  }
  return { rounds: best, firsts: [...firsts].sort((a, b) => a - b), choices: firstChoices.length, states };
}
/** does the board win with the queue left alone every round? */
export function idle(b0: Board) {
  let b = b0;
  while (!b.potted && !b.lost) b = round(b, b.queue).board;
  return b.potted;
}

// ---------------------------------------------------------------- boards
export type Tier = 0 | 1 | 2 | 3;
export const tierOf = (ix: number): Tier => (ix >= BOARDS - 1 ? 3 : ix < 3 ? 0 : ix < 6 ? 1 : 2);
export const PLACES = ['The Lawn', 'The Vegetable Patch', 'The Rockery', 'The Grumble King’s Bed'];
const POOL: Record<Tier, Actor[]> = {
  0: ['frog', 'frog', 'hog'],
  1: ['frog', 'shroom', 'snail', 'hog'],
  2: ['frog', 'shroom', 'snail', 'beetle', 'mole', 'grumble', 'hog'],
  3: ['frog', 'shroom', 'snail', 'beetle', 'mole', 'hog'],
};
/** a generated board, its par (the solver's fewest rounds) and how many tries it took */
export type Made = { board: Board; par: number; tries: number };
/** a board for this place in the run: pot, acorn and a hedgehog lined up, then more critters, rocks and walls round
 * them, kept only if it can be won and can't be won by leaving the queue alone */
export function makeBoard(seed: number, ix: number): Made {
  let s = (seed ^ Math.imul(ix + 1, 0x9e3779b1)) >>> 0 || 1;
  const rnd = () => { const [v, n] = rngNext(s); s = n; return v; };
  const ri = (n: number) => Math.floor(rnd() * n);
  const tier = tierOf(ix);
  const extra = tier === 3 ? 6 : Math.min(6, 1 + Math.floor(ix / 2) + (ix > 0 ? 1 : 0));
  const slack = ix < 2 ? 1 : 0;
  for (let tries = 1; ; tries++) {
    // later tries ease off: fewer extra critters, and any solvable board will do
    const easy = tries > 120;
    const b: Board = { walls: [], pot: { x: 0, y: 0 }, pieces: [], queue: [], nextId: 1, rounds: 6, mutator: 'none', potted: false, lost: '' };
    const add = (k: Kind, x: number, y: number, f: Dir = 0) => { const p: Piece = { id: b.nextId++, k, x, y, f, awake: false }; b.pieces.push(p); if (isActor(k)) b.queue.push(p.id); return p; };
    // pot, acorn and the hedgehog that will push it, on one line
    const d = ri(4) as Dir, dist = 2 + ri(tier === 0 ? 2 : 3), gap = ri(2);
    const back = dist + 1 + gap;
    const px = 1 + ri(W - 2), py = 1 + ri(H - 2);
    const ax = px - DX[d] * dist, ay = py - DY[d] * dist, hx = px - DX[d] * back, hy = py - DY[d] * back;
    if (!inside(ax, ay) || !inside(hx, hy)) continue;
    b.pot = { x: px, y: py };
    add('acorn', ax, ay); add('hog', hx, hy, d);
    // a few walls, away from the line
    const line = (x: number, y: number) => (DX[d] === 0 ? x === px && (y - py) * DY[d] <= 0 && (y - hy) * DY[d] >= 0 : y === py && (x - px) * DX[d] <= 0 && (x - hx) * DX[d] >= 0);
    const nWalls = tier === 0 ? ri(3) : 1 + ri(4);
    for (let i = 0; i < nWalls; i++) { const x = ri(W), y = ri(H); if (!line(x, y) && !at(b, x, y) && !isPot(b, x, y)) b.walls.push(y * W + x); }
    // critters near the line, where they'll matter
    const near = () => {
      for (let k = 0; k < 30; k++) {
        const t = ri(back + 1), x = px - DX[d] * t + ri(5) - 2, y = py - DY[d] * t + ri(5) - 2;
        if (open(b, x, y) && !(line(x, y) && rnd() < 0.7)) return { x, y };
      }
      return null;
    };
    const n = easy ? Math.max(1, extra - 2) : extra;
    const pool = POOL[tier];
    for (let i = 0; i < n; i++) {
      // the first one is a frog by the acorn's path: something has to go wrong if nobody thinks
      const k: Actor = i === 0 ? 'frog' : pool[ri(pool.length)];
      const c = near(); if (!c) continue;
      add(k, c.x, c.y, ri(4) as Dir);
    }
    if (tier === 3) { const c = near(); if (c) add('grumble', c.x, c.y); }
    if (tier >= 1) for (let i = ri(3); i > 0; i--) { const c = near(); if (c) add('rock', c.x, c.y); }
    // shuffle the queue
    for (let i = b.queue.length - 1; i > 0; i--) { const j = ri(i + 1); [b.queue[i], b.queue[j]] = [b.queue[j], b.queue[i]]; }
    b.mutator = tier === 3 ? 'reverse' : ix >= 4 && rnd() < 0.5 ? (rnd() < 0.5 ? 'reverse' : 'rotate') : 'none';
    // graded: winnable, not by doing nothing, and (unless easing off) with at most half the first moves right
    b.rounds = tier === 3 ? 6 : 5;
    if (idle(b)) continue;
    const sol = solve(b, 60000);
    if (sol.rounds === Infinity || sol.rounds < (tier === 0 ? 2 : 3) - (easy ? 1 : 0)) continue;
    if (!easy && sol.firsts.length * 2 > sol.choices) continue;
    b.rounds = sol.rounds + slack + (tier === 3 ? 1 : 0);
    // with fewer rounds it must still not win by itself
    if (idle(b)) continue;
    return { board: b, par: sol.rounds, tries };
  }
}

// ---------------------------------------------------------------- the run
export const PERKS = [
  { id: 'tokens', name: 'Pocket of buttons', max: 3, text: 'Two more tokens. A token sends any critter to the front of the queue.' },
  { id: 'heart', name: 'Spare basket', max: 2, text: 'One more try: a board can go wrong once more before the run ends.' },
  { id: 'patience', name: 'Long afternoon', max: 2, text: 'One more round on every board.' },
  { id: 'nap', name: 'Lullaby', max: 1, text: 'Once a board, sing one critter to sleep so it skips its turn.' },
  { id: 'encore', name: 'Encore', max: 1, text: 'Two swaps in the first round of every board.' },
] as const;
export type PerkId = (typeof PERKS)[number]['id'];
export const noPerks = (): Record<PerkId, number> => ({ tokens: 0, heart: 0, patience: 0, nap: 0, encore: 0 });
export type Phase = 'plan' | 'pick' | 'won' | 'lost';
export type Ev = { k: 'swap' | 'unswap' | 'front' | 'nap' | 'potted' | 'fail' | 'retry' | 'won' | 'lost' | 'par'; why?: Lost };

export class Run {
  seed: number; rs: number;
  ix = 0; phase: Phase = 'plan';
  /** the board as it started, for a retry, and as it is now */
  start!: Board; board!: Board; par = 0;
  /** the order for the coming round, and what the player has done to it */
  order: number[] = []; swapsLeft = 1; spent = 0; nap = -1; napUsed = false;
  hp = HP; tokens = TOKENS; perks = noPerks(); offer: PerkId[] = [];
  stats = { boards: 0, rounds: 0, swaps: 0, tokens: 0, fails: 0, pars: 0 };
  seen: Actor[] = [];
  constructor(seed: number) { this.seed = seed >>> 0 || 1; this.rs = this.seed; this.enter(0); }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  get tier() { return tierOf(this.ix); }
  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get hpMax() { return HP + this.perks.heart; }
  get firstRound() { return this.board.rounds === this.start.rounds; }

  enter(ix: number) {
    this.ix = ix;
    const m = makeBoard(this.seed, ix);
    m.board.rounds += this.perks.patience;
    this.start = m.board; this.par = m.par; this.napUsed = false;
    this.reset(); this.phase = 'plan';
    for (const p of this.board.pieces) if (isActor(p.k) && !this.seen.includes(p.k)) this.seen.push(p.k);
  }
  /** back to the start of the board (after a mistake) */
  reset() { this.board = cloneBoard(this.start); this.napUsed = false; this.plan(); }
  /** a fresh plan for the coming round */
  plan() { this.order = [...this.board.queue]; this.swapsLeft = this.perks.encore && this.firstRound ? 2 : 1; this.tokens += this.spent; this.spent = 0; this.nap = -1; }
  swap(i: number): boolean {
    if (this.phase !== 'plan' || this.swapsLeft <= 0 || i < 0 || i + 1 >= this.order.length) return false;
    this.order = swapped(this.order, i); this.swapsLeft--; return true;
  }
  /** a token: this critter goes to the front of the queue */
  front(id: number): boolean {
    const i = this.order.indexOf(id);
    if (this.phase !== 'plan' || this.tokens <= 0 || i <= 0) return false;
    this.order = [id, ...this.order.filter((x) => x !== id)]; this.tokens--; this.spent++; return true;
  }
  setNap(id: number): boolean {
    if (this.phase !== 'plan' || !this.perks.nap || this.napUsed || !this.order.includes(id)) return false;
    this.nap = this.nap === id ? -1 : id; return true;
  }
  /** what the coming round would do, for the preview */
  preview() { return round(this.board, this.order, this.nap); }
  /** play the round */
  go(): { steps: Step[]; events: Ev[] } {
    if (this.phase !== 'plan') return { steps: [], events: [] };
    const events: Ev[] = [];
    const before = this.board.queue.join(',') !== this.order.join(',');
    if (before) this.stats.swaps++;
    if (this.spent) this.stats.tokens += this.spent;
    if (this.nap >= 0) this.napUsed = true;
    const { board, steps } = round(this.board, this.order, this.nap);
    this.board = board; this.spent = 0; this.stats.rounds++;
    if (board.potted) {
      this.stats.boards++;
      const used = this.start.rounds - board.rounds;
      events.push({ k: 'potted' });
      if (used <= this.par) { this.tokens++; this.stats.pars++; events.push({ k: 'par' }); }
      if (this.ix + 1 >= BOARDS) { this.phase = 'won'; events.push({ k: 'won' }); }
      else { this.phase = 'pick'; this.offer = this.makeOffer(); }
    } else if (board.lost) {
      this.hp--; this.stats.fails++;
      events.push({ k: 'fail', why: board.lost });
      if (this.hp <= 0) { this.phase = 'lost'; events.push({ k: 'lost' }); }
      else { events.push({ k: 'retry' }); this.reset(); }
    } else this.plan();
    return { steps, events };
  }
  makeOffer() {
    const pool: PerkId[] = PERKS.filter((p) => this.perks[p.id] < p.max).map((p) => p.id);
    const out: PerkId[] = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
    return out;
  }
  pick(id?: PerkId) {
    if (this.phase !== 'pick') return false;
    if (id) {
      if (!this.offer.includes(id)) return false;
      this.perks[id]++;
      if (id === 'tokens') this.tokens += 2;
      if (id === 'heart') this.hp++;
    }
    this.offer = []; this.enter(this.ix + 1); return true;
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'turn-order-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { board: number; pars: number };
  stats: { runs: number; wins: number; boards: number };
  seen: string[];
  settings: { sound: boolean; music: boolean; fast: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { board: 0, pars: 0 }, stats: { runs: 0, wins: 0, boards: 0 }, seen: [], settings: { sound: true, music: true, fast: false } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    s.intro = o.intro === true;
    s.best.board = Math.min(BOARDS, num(o.best?.board)); s.best.pars = num(o.best?.pars);
    for (const k of ['runs', 'wins', 'boards'] as const) s.stats[k] = num(o.stats?.[k]);
    s.seen = Array.isArray(o.seen) ? o.seen.filter((k: unknown): k is string => typeof k === 'string' && k in CRITTERS) : [];
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false; s.settings.fast = o.settings?.fast === true;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.boards += r.stats.boards;
  if (r.phase === 'won') s.stats.wins++;
  s.best.board = Math.max(s.best.board, r.phase === 'won' ? BOARDS : r.ix + 1);
  s.best.pars = Math.max(s.best.pars, r.stats.pars);
}

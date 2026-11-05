// The Clocktower Mystery rules: a point-and-click adventure. The evening before the Winter Fair the town clock stops
// at quarter past six with four of its wheels gone, and the fair can't open until it strikes eight in the morning.
// Dora and Enzo search the town through three chapters (dusk, night, before dawn): rooms with hotspots and exits, a
// shared satchel of items, things only Dora can do (she climbs) and things only Enzo can do (he listens and remembers
// tunes), and one puzzle where they have to be in two places at once. Every action is a pure step on a plain state, so
// the solver in tests/clocktower-bot.mjs can walk every reachable state and prove the mystery can always be finished.
// No DOM here; the page draws the paintings and places the hotspots (app/clocktower/rooms.ts).

export type Who = 'dora' | 'enzo';
export type RoomId = 'square' | 'tower' | 'clockroom' | 'bakery' | 'riverside' | 'boat' | 'mill' | 'hatshop';
export type ItemId = 'oilcan' | 'lantern' | 'tuft' | 'button' | 'boathook' | 'brass' | 'silver' | 'copper' | 'star' | 'note';
export type Speaker = Who | 'tock' | 'hollis' | 'nell' | 'twins' | 'gubbins' | 'rook';
export type Line = { who: Speaker; text: string };
export type Chapter = 1 | 2 | 3 | 4;
export type Flag =
  | 'metTock' | 'sawWorks' | 'readChart' | 'hatchOpen' | 'ledge' | 'metHollis' | 'ovenFixed' | 'clink' | 'sawSack'
  | 'metNell' | 'holding' | 'sawGlint' | 'tune' | 'gubbinsDown' | 'cornerLit' | 'heardTwins' | 'twinsOpen';

export type State = {
  v: 1; ch: Chapter; at: Record<Who, RoomId>; who: Who;
  /** in the satchel now, and everything ever picked up (so a used item doesn't reappear) */
  inv: ItemId[]; got: ItemId[]; flags: Flag[];
  /** the gear on each of the four spindles of the works */
  fitted: (ItemId | null)[];
  moves: number; hints: number; seen: RoomId[];
};
export type Action =
  | { k: 'go'; to: RoomId } | { k: 'spot'; id: string } | { k: 'item'; item: ItemId; id: string } | { k: 'swap' }
  | { k: 'fit'; item: ItemId; slot: number };
export type Sfx = 'pickup' | 'creak' | 'clink' | 'whistle' | 'splash' | 'chime' | 'nope' | 'door' | 'climb' | 'flap' | 'fit' | 'bell';
export type Outcome = { ok: boolean; lines: Line[]; sfx?: Sfx; open?: 'works'; chapterUp?: Chapter; end?: boolean; got?: ItemId };

export const ITEMS: Record<ItemId, { name: string; look: string }> = {
  oilcan: { name: 'Oil can', look: 'Mr Tock’s little brass oil can. Good for anything rusty or stuck.' },
  lantern: { name: 'Lantern', look: 'Mr Tock’s brass lantern. It lights up the darkest corner.' },
  tuft: { name: 'Tuft of red fur', look: 'A tuft of bright red-orange fur, snagged on the hatch up the tower. Squirrel fur.' },
  button: { name: 'Silver button', look: 'A shiny silver button from the cobbles by the well. Very shiny indeed.' },
  boathook: { name: 'Boathook', look: 'Captain Rook’s boathook: a long pole with a brass hook on the end.' },
  brass: { name: 'Brass wheel', look: 'The great brass going wheel, the biggest wheel in the clock. Still dripping.' },
  silver: { name: 'Silver wheel', look: 'The silver escape wheel, with its little hooked teeth. It makes the tick.' },
  copper: { name: 'Copper wheel', look: 'The copper strike wheel, with pins that lift the hammer. A bit doughy.' },
  star: { name: 'Star wheel', look: 'The tiny star wheel that plays the chime. Hettie gave it back.' },
  note: { name: 'Mr Tock’s note', look: 'A note from Mr Tock, sealed with a little clock. “I’m not cross. Come and ring the first chime with me.”' },
};
export const GEARS: ItemId[] = ['brass', 'copper', 'silver', 'star'];
/** the works' four spindles, left to right, take these wheels (sizes in the page: big, middle, small, tiny) */
export const SLOTS: ItemId[] = ['brass', 'copper', 'silver', 'star'];
export const ROOMS: Record<RoomId, { name: string; exits: RoomId[] }> = {
  square: { name: 'The market square', exits: ['tower', 'bakery', 'riverside', 'hatshop'] },
  tower: { name: 'The clock tower', exits: ['square', 'clockroom'] },
  clockroom: { name: 'The clock room', exits: ['tower'] },
  bakery: { name: 'Hollis’s bakery', exits: ['square'] },
  riverside: { name: 'The riverside', exits: ['square', 'mill', 'boat'] },
  boat: { name: 'Captain Rook’s barge', exits: ['riverside'] },
  mill: { name: 'Nell’s mill', exits: ['riverside'] },
  hatshop: { name: 'The Hatters’ shop', exits: ['square'] },
};
export const SPOTS: Record<string, { room: RoomId; name: string }> = {
  clockface: { room: 'square', name: 'The clock' }, stalls: { room: 'square', name: 'Fair stalls' }, well: { room: 'square', name: 'The well' },
  button: { room: 'square', name: 'Something shiny' }, drain: { room: 'square', name: 'Drain' }, hatdoor: { room: 'square', name: 'Hat shop door' },
  tock: { room: 'tower', name: 'Mr Tock' }, bench: { room: 'tower', name: 'Workbench' }, oilcan: { room: 'tower', name: 'Oil can' },
  chute: { room: 'tower', name: 'Little hatch' }, rope: { room: 'tower', name: 'Bell rope' },
  works: { room: 'clockroom', name: 'The works' }, chart: { room: 'clockroom', name: 'Chart' }, hatch: { room: 'clockroom', name: 'Hatch' },
  bell: { room: 'clockroom', name: 'The bell' },
  hollis: { room: 'bakery', name: 'Baker Hollis' }, tub1: { room: 'bakery', name: 'Dough tub' }, tub2: { room: 'bakery', name: 'Dough tub' },
  tub3: { room: 'bakery', name: 'Dough tub' }, oven: { room: 'bakery', name: 'Oven' }, damper: { room: 'bakery', name: 'Damper' },
  sack: { room: 'bakery', name: 'Torn sack' },
  wheel: { room: 'riverside', name: 'Waterwheel' }, outlet: { room: 'riverside', name: 'Drain outlet' },
  rook: { room: 'boat', name: 'Captain Rook' }, gubbins: { room: 'boat', name: 'Gubbins' }, nest: { room: 'boat', name: 'Crow’s nest' },
  musicbox: { room: 'boat', name: 'Music box' }, boathook: { room: 'boat', name: 'Boathook' },
  nell: { room: 'mill', name: 'Nell' }, lever: { room: 'mill', name: 'Sluice lever' }, stones: { room: 'mill', name: 'Millstones' },
  twins: { room: 'hatshop', name: 'Hob and Hettie' }, float: { room: 'hatshop', name: 'Parade float' }, hats: { room: 'hatshop', name: 'Hats' },
};
export const CHAPTERS: Record<Chapter, string> = { 1: 'The Clock Stops', 2: 'Night in Town', 3: 'Before Dawn', 4: 'Eight O’Clock' };

export const newState = (): State => ({
  v: 1, ch: 1, at: { dora: 'square', enzo: 'square' }, who: 'dora', inv: [], got: [], flags: [], fitted: [null, null, null, null], moves: 0, hints: 0, seen: ['square'],
});
export const clone = (s: State): State => JSON.parse(JSON.stringify(s));
export const has = (s: State, f: Flag) => s.flags.includes(f);
export const holds = (s: State, i: ItemId) => s.inv.includes(i);
export const room = (s: State) => s.at[s.who];
const other = (w: Who): Who => (w === 'dora' ? 'enzo' : 'dora');
const set = (s: State, f: Flag, on = true) => { s.flags = s.flags.filter((x) => x !== f); if (on) { s.flags.push(f); s.flags.sort(); } };
const give = (s: State, i: ItemId) => { if (!s.got.includes(i)) { s.got.push(i); s.got.sort(); } if (!s.inv.includes(i)) s.inv.push(i); };
const drop = (s: State, i: ItemId) => { s.inv = s.inv.filter((x) => x !== i); };
const L = (who: Speaker, text: string): Line => ({ who, text });
const say = (lines: Line[], sfx?: Sfx, ok = true): Outcome => ({ ok, lines, sfx });
const gearsFound = (s: State) => GEARS.filter((g) => s.got.includes(g)).length;

/** the hotspots you can see in a room right now */
export function spots(s: State, r: RoomId): string[] {
  const out: string[] = [];
  for (const [id, sp] of Object.entries(SPOTS)) {
    if (sp.room !== r) continue;
    if (id === 'button' && !(has(s, 'cornerLit') && !s.got.includes('button'))) continue;
    if (id === 'oilcan' && s.got.includes('oilcan')) continue;
    if (id === 'boathook' && s.got.includes('boathook')) continue;
    if (id === 'gubbins' && s.got.includes('silver')) continue;
    if (id === 'twins' && !has(s, 'twinsOpen')) continue;
    out.push(id);
  }
  return out;
}
/** the ways out of a room (all of them are shown; some say why not yet) */
export const exits = (r: RoomId) => ROOMS[r].exits;

// ---------------------------------------------------------------- doing things
export function act(s: State, a: Action): Outcome {
  const o = step(s, a);
  if (o.ok) s.moves++;
  return o;
}
function step(s: State, a: Action): Outcome {
  if (s.ch === 4) return say([], undefined, false);
  const me = s.who, here = room(s);
  if (a.k === 'swap') {
    s.who = other(me);
    return say([L(s.who, s.at[s.who] === here ? (s.who === 'dora' ? 'My turn!' : 'Over to me.') : s.who === 'dora' && has(s, 'holding') ? 'Still hanging on up here!' : 'Here I am.')]);
  }
  if (a.k === 'go') return go(s, a.to);
  if (a.k === 'fit') return fit(s, a.item, a.slot);
  if (!(a.id in SPOTS) || SPOTS[a.id].room !== here || !spots(s, here).includes(a.id)) return say([], undefined, false);
  if (a.k === 'item') {
    if (!holds(s, a.item)) return say([], undefined, false);
    return useItem(s, a.item, a.id);
  }
  return use(s, a.id);
}

function go(s: State, to: RoomId): Outcome {
  const me = s.who, from = room(s);
  if (!ROOMS[from].exits.includes(to)) return say([], undefined, false);
  // in the first chapter the clock comes first
  if (s.ch === 1 && (to === 'bakery' || to === 'riverside')) return say([L(me, me === 'dora' ? 'Let’s find out what’s wrong with the clock first. The tower’s right there.' : 'The clock first, I think. Mr Tock will be in the tower.')], 'nope', false);
  if (to === 'hatshop' && !has(s, 'twinsOpen')) return say([L(me, s.ch === 1 ? 'The Hatters’ shop is shut. “Back at seven.”' : 'Locked. Nobody’s answering.')], 'nope', false);
  if (me === 'dora' && has(s, 'holding')) { set(s, 'holding', false); }
  const partner = other(me), follows = s.at[partner] === from && !(partner === 'dora' && has(s, 'holding'));
  s.at[me] = to; if (follows) s.at[partner] = to;
  if (!s.seen.includes(to)) s.seen.push(to);
  return say([], 'door');
}

function fit(s: State, item: ItemId, slot: number): Outcome {
  if (room(s) !== 'clockroom' || !holds(s, item) || !GEARS.includes(item) || slot < 0 || slot > 3 || s.fitted[slot]) return say([], undefined, false);
  if (SLOTS[slot] !== item) return say([L(s.who, item === 'star' ? 'Far too small for that spindle. It just spins round.' : 'It won’t sit. Wrong size for that spindle.')], 'nope', false);
  s.fitted[slot] = item; drop(s, item);
  if (s.fitted.every(Boolean)) {
    s.ch = 4;
    return { ok: true, lines: [L('dora', 'The last one clicks home!'), L('enzo', 'Listen... tick. Tick. Tick. It’s going!')], sfx: 'chime', end: true, chapterUp: 4 };
  }
  return say([L(s.who, `The ${ITEMS[item].name.toLowerCase()} slides onto its spindle. ${4 - s.fitted.filter(Boolean).length} to go.`)], 'fit');
}

function use(s: State, id: string): Outcome {
  const me = s.who, D = me === 'dora';
  switch (id) {
    // ---------------------------------------------------------------- the square
    case 'clockface': return say([L(me, s.ch === 1 ? 'Quarter past six, and not budging. The fair opens when it strikes eight tomorrow morning!' : 'Still stuck at quarter past six.')]);
    case 'stalls': return say([L(me, s.ch === 1 ? 'The Winter Fair stalls going up: toffee apples, hot chestnuts, a coconut shy...' : 'All covered up for the night, waiting for the morning.')]);
    case 'well':
      if (has(s, 'cornerLit')) return say([L(me, 'Just the old well.')]);
      return say([L(me, s.ch === 1 ? 'The old well. That corner’s in deep shadow.' : 'Too dark to see anything in that corner. We need some light.')]);
    case 'button': give(s, 'button'); return { ok: true, lines: [L(me, 'A silver button, wedged between the cobbles. Ooh, shiny!')], sfx: 'pickup', got: 'button' };
    case 'drain': return say([L(me, has(s, 'ledge') ? 'Something brass went rattling down this drain, I bet. It runs all the way down to the river.' : 'A drain grate. It runs down to the river.')]);
    case 'hatdoor':
      if (s.ch === 1) return say([L(me, 'Shut. “Back at seven.” Hats in the window, nobody about.')]);
      if (has(s, 'twinsOpen')) return say([L(me, 'The door’s open now.')]);
      if (!D) { set(s, 'heardTwins'); return say([L('enzo', 'I put my ear to the door... whispering! Two voices: “What if they find out about the little star?” “Shh!”')], 'clink'); }
      return say([L('dora', has(s, 'heardTwins') ? 'Enzo heard whispering in there. They won’t open up though.' : 'Locked. There’s a light on upstairs, though.')]);
    // ---------------------------------------------------------------- the tower
    case 'tock': return tock(s);
    case 'bench': return say([L(me, 'Tweezers, springs, a magnifying glass, and a hundred tiny screws. Mr Tock’s workbench.')]);
    case 'oilcan': give(s, 'oilcan'); return { ok: true, lines: [L(me, 'A little brass oil can. Mr Tock won’t mind if we borrow it.')], sfx: 'pickup', got: 'oilcan' };
    case 'chute': return say([L(me, 'An old coal chute. Too small even for Dora.')]);
    case 'rope': return say([L(me, s.ch === 4 ? 'Ding!' : 'Better not ring the bell in the middle of the night. Or the evening.')]);
    // ---------------------------------------------------------------- the clock room
    case 'works': {
      if (s.inv.some((i) => GEARS.includes(i))) return { ok: true, lines: [L(me, 'Let’s fit what we’ve found.')], open: 'works' };
      if (!has(s, 'sawWorks')) {
        set(s, 'sawWorks');
        return say([L(me, 'Four bare spindles where four wheels should be!'), L(D ? 'enzo' : 'dora', D ? 'Not dropped, either. Somebody knocked the cover off, look: it’s hanging by one screw.' : 'And the cover’s been knocked off. Somebody was up here.')]);
      }
      return say([L(me, s.fitted.some(Boolean) ? `${s.fitted.filter(Boolean).length} of the four wheels back on. The rest are still out there somewhere.` : 'Four bare spindles. The wheels must be somewhere in town.')]);
    }
    case 'chart': set(s, 'readChart'); return say([L('enzo', 'Mr Tock’s chart of the clock: the great brass going wheel, the copper strike wheel, the silver escape wheel, and the tiny star wheel that plays the chime. Biggest to smallest, left to right.')]);
    case 'hatch':
      if (!has(s, 'hatchOpen')) return say([L(me, 'A little hatch out to the ledge. Rusted shut.')], 'nope');
      if (!D) return say([L('enzo', 'Heights and me don’t get on. You go, Dora.')]);
      if (has(s, 'ledge')) return say([L('dora', 'Brr. I’ve seen what I need out there.')]);
      set(s, 'ledge'); give(s, 'tuft');
      return { ok: true, sfx: 'climb', got: 'tuft', lines: [
        L('dora', 'Out on the ledge... whoa, it’s high! There’s a tuft of red fur snagged on the hinge.'),
        L('dora', 'And look down there: flour all over the cobbles where Hollis’s cart stood, a scrape leading to the drain, and Gubbins the magpie flapping off towards the river with something shiny!'),
        L('enzo', 'So the wheels fell. One in the flour, one down the drain, one in a magpie. That’s three. Where’s the fourth?'),
      ] };
    case 'bell': return say([L(me, 'The big bronze bell. It’s fine; the hammer just needs the clock to tell it when.')]);
    // ---------------------------------------------------------------- the bakery
    case 'hollis': return hollis(s);
    case 'tub1': case 'tub2': case 'tub3': return tub(s, id);
    case 'oven': return say([L(me, has(s, 'ovenFixed') ? 'Roaring away now. It smells wonderful.' : 'Cold and smoky. Hollis’s fire isn’t drawing.')]);
    case 'damper':
      if (has(s, 'ovenFixed')) return say([L(me, 'The damper’s wide open now.')]);
      if (!D) return say([L('enzo', 'That damper’s right up by the ceiling. Too high for me.')]);
      return say([L('dora', 'Up the flue I go... I’ve got the handle, but it’s rusted stuck.')], 'climb');
    case 'sack': set(s, 'sawSack'); return say([L(me, 'This sack’s torn. Something heavy and round went straight through it, and the flour’s all gone into the dough.')]);
    // ---------------------------------------------------------------- the riverside
    case 'wheel':
      if (s.got.includes('brass')) return say([L(me, 'The waterwheel, turning away again.')]);
      set(s, 'sawGlint');
      return say([L(me, holds(s, 'lantern') ? 'Hold the lantern up... something brass glints in the water, right under the wheel!' : 'The waterwheel, churning away.')]);
    case 'outlet': return say([L(me, 'The town drain comes out here. Anything dropped down the gutter in the square ends up by the mill.')]);
    // ---------------------------------------------------------------- the barge
    case 'rook': return say([L('rook', 'Zzz... sixteen gulls on a... zzz...'), L(me, 'Fast asleep. Nothing’s waking him before morning.')]);
    case 'nest': return say([L(me, 'Gubbins’s nest, right up the mast: spoons, keys, bottle tops, and a glint of silver.')]);
    case 'gubbins':
      if (!has(s, 'gubbinsDown')) {
        if (D) return say([L('dora', 'I’ll climb up and... OW! He pecks! Fine, Gubbins, keep your nest.')], 'flap');
        if (!has(s, 'tune')) return say([L('enzo', 'I whistle up at him... Gubbins doesn’t even look.')], 'whistle');
        set(s, 'gubbinsDown');
        return say([L('enzo', 'I whistle the supper tune from the music box...'), L('gubbins', 'Chak-chak!'), L('enzo', 'Here he comes, down to the rail. Something silver tucked under his wing.')], 'whistle');
      }
      return say([L('gubbins', 'Chak!'), L(me, 'He’s guarding something silver under his wing. He won’t give it up for nothing; it would have to be something shinier.')], 'flap');
    case 'musicbox':
      if (D) return say([L('dora', 'A tinkly little tune. Enzo’s the one for remembering tunes, not me.')], 'chime');
      if (has(s, 'tune')) return say([L('enzo', 'I know this one now. It’s how Rook calls Gubbins in for supper.')], 'chime');
      set(s, 'tune');
      return say([L('enzo', 'I listen hard... da-da-dee, da-dum. Got it! Rook must play this to call Gubbins in for supper.')], 'chime');
    case 'boathook': give(s, 'boathook'); return { ok: true, lines: [L(me, 'A long boathook. We’ll bring it back, Captain.')], sfx: 'pickup', got: 'boathook' };
    // ---------------------------------------------------------------- the mill
    case 'nell': return nell(s);
    case 'lever':
      if (!D) return say([L('enzo', 'That lever’s right up on the beam. I can’t reach.')]);
      if (s.got.includes('brass')) return say([L('dora', 'No need to stop the wheel now.')]);
      if (has(s, 'holding')) { set(s, 'holding', false); return say([L('dora', 'Letting go. The wheel starts up again.')], 'creak'); }
      set(s, 'holding');
      return say([L('dora', 'Up on the beam... got the lever! Oof, heavy. The wheel’s stopping!'), L('dora', 'I can’t let go or it’ll start again. Enzo, you fish it out!')], 'creak');
    case 'stones': return say([L(me, 'The big millstones, grinding flour for Hollis’s fair buns.')]);
    // ---------------------------------------------------------------- the hat shop
    case 'twins':
      if (s.got.includes('star')) return say([L('twins', 'We’re ringing the first chime! Mr Tock said so!')]);
      give(s, 'star');
      return { ok: true, sfx: 'pickup', got: 'star', lines: [
        L('twins', 'We only wanted to see the view from the top! Hob dared me. I leaned on the cover and it just... fell, and the wheels went everywhere.'),
        L('twins', 'We caught the little star one. We were going to use it for our parade reindeer, and then we were too scared to say.'),
        L('twins', 'Here. Is Mr Tock really not cross?'),
        L('dora', 'Not a bit. He wants you to ring the first chime.'),
      ] };
    case 'float': return say([L(me, 'A clockwork reindeer pulling a sleigh of hat boxes, for the parade. There’s a gap where its key-wheel goes, about the size of a little star...')]);
    case 'hats': return say([L(me, s.who === 'dora' ? 'I’d look very dashing in that top hat.' : 'Every hat in town. Except mine; I’ve got headphones.')]);
  }
  return say([], undefined, false);
}

function useItem(s: State, item: ItemId, id: string): Outcome {
  const me = s.who, D = me === 'dora';
  if (item === 'oilcan' && id === 'hatch' && !has(s, 'hatchOpen')) { set(s, 'hatchOpen'); return say([L(me, 'A squirt of oil on the hinges... creeeak! The hatch swings open. Cold air rushes in.')], 'creak'); }
  if (item === 'oilcan' && id === 'damper' && !has(s, 'ovenFixed')) {
    if (!D) return say([L('enzo', 'I can’t reach the damper. Dora could climb up there.')], 'nope', false);
    set(s, 'ovenFixed');
    return say([L('dora', 'A drop of oil on the damper... clunk! It’s open!'), L('hollis', 'My fire’s drawing! Listen to it roar! Oh, you clever pair.')], 'creak');
  }
  if (item === 'lantern' && id === 'well' && !has(s, 'cornerLit')) { set(s, 'cornerLit'); return say([L(me, 'I hold the lantern up to the dark corner... something glints between the cobbles!')]); }
  if (item === 'boathook' && id === 'wheel' && !s.got.includes('brass')) {
    if (!(s.at.dora === 'mill' && has(s, 'holding'))) return say([L(me, 'The wheel’s turning. It would snap the hook clean off. Somebody needs to stop it first.')], 'nope', false);
    give(s, 'brass'); set(s, 'holding', false);
    return { ok: true, sfx: 'splash', got: 'brass', lines: [L('enzo', 'The wheel’s stopped... reach under... got it! The great brass going wheel!'), L('dora', '(from the mill) Can I let go now? ...Letting go!')] };
  }
  if (item === 'button' && id === 'gubbins' && has(s, 'gubbinsDown')) {
    drop(s, 'button'); give(s, 'silver');
    return { ok: true, sfx: 'flap', got: 'silver', lines: [L(me, 'Here, Gubbins: the shiniest button in town.'), L('gubbins', 'Chak-chak-chak!'), L(me, 'He grabs it and drops... the silver escape wheel! Fair swap.')] };
  }
  if (item === 'tuft' && id === 'tock' && s.ch === 3 && !s.got.includes('note')) {
    give(s, 'note');
    return { ok: true, sfx: 'pickup', got: 'note', lines: [
      L('tock', 'Red squirrel fur... from the hatch? Hob and Hettie Hatter! Those two have been asking about the view from the top all winter.'),
      L('tock', 'They’ll be frightened half to death, poor things. Here, give them this note. Tell them I’m not cross; I just need my star wheel back.'),
    ] };
  }
  if (item === 'note' && id === 'hatdoor' && !has(s, 'twinsOpen')) {
    set(s, 'twinsOpen'); drop(s, 'note');
    return say([L(me, 'I slip Mr Tock’s note under the door...'), L(me, 'Footsteps on the stairs, a long pause, and the door creaks open.')], 'door');
  }
  if (GEARS.includes(item) && id === 'works') return { ok: true, lines: [L(me, 'Let’s fit it.')], open: 'works' };
  if (GEARS.includes(item) && id === 'tock') return say([L('tock', s.ch === 3 && holds(s, 'star') ? 'All four! Go on up and fit them yourselves; my eyes aren’t what they were.' : 'You found one! Keep it safe until we have them all.')]);
  // anything else: a gentle no
  const nos = [`That doesn’t do anything.`, `I don’t think the ${ITEMS[item].name.toLowerCase()} helps there.`, `Hmm. No.`];
  return say([L(me, nos[(item.length + id.length) % nos.length])], 'nope', false);
}

function tock(s: State): Outcome {
  if (s.ch === 1) {
    if (!has(s, 'metTock')) {
      set(s, 'metTock');
      return say([
        L('tock', 'Dora! Enzo! Oh, it’s a disaster. The clock stopped dead at quarter past six, and the fair can’t open until it strikes eight in the morning.'),
        L('tock', 'Something’s wrong up in the works, and my old eyes can’t see a thing up there by lamplight. Would you climb up and have a look?'),
      ]);
    }
    if (!has(s, 'sawWorks')) return say([L('tock', 'Up the stairs to the clock room. Tell me what you see.')]);
    if (!has(s, 'ledge')) return say([L('tock', 'Four wheels gone? Then they fell. That little hatch to the ledge would show you the square below, but it’s been rusted shut for years.')]);
    s.ch = 2; give(s, 'lantern');
    return { ok: true, sfx: 'pickup', got: 'lantern', chapterUp: 2, lines: [
      L('dora', 'Flour by the bakery, a scrape to the drain, and Gubbins the magpie with something shiny!'),
      L('tock', 'Then my wheels are scattered all over town. The brass, the copper, the silver and the little star.'),
      L('tock', 'It’s getting dark. Take my lantern, and bring back whatever you can find. I’ll be here.'),
    ] };
  }
  if (s.ch === 2) {
    if (['brass', 'silver', 'copper'].every((g) => s.got.includes(g as ItemId))) {
      s.ch = 3;
      return { ok: true, chapterUp: 3, sfx: 'chime', lines: [
        L('tock', 'The brass, the silver AND the copper! You marvels!'),
        L('tock', 'But the little star wheel is still missing, and without it the clock won’t chime. The fair can’t open on a clock that won’t chime.'),
        L('enzo', 'We still don’t know who knocked the cover off...'),
      ] };
    }
    const n = gearsFound(s);
    return say([L('tock', n === 0 ? 'The brass, the copper and the silver, and the little star. Follow the flour, the drain and that magpie.' : `${n} found! Keep going: the flour, the drain and that magpie.`)]);
  }
  if (!s.got.includes('note')) return say([L('tock', 'Who would climb up my tower and knock the cover off? If only we knew.')]);
  if (!s.got.includes('star')) return say([L('tock', 'Take my note to the Hatters’ shop.')]);
  return say([L('tock', 'All four! Go on up and fit them; my eyes aren’t what they were.')]);
}
function hollis(s: State): Outcome {
  if (s.got.includes('copper')) return say([L('hollis', 'A clock wheel in my dough! I’ve heard it all now. Here’s hoping the fair opens on time.')]);
  if (!has(s, 'metHollis')) {
    set(s, 'metHollis');
    return say([
      L('hollis', 'Evening, you two! Can’t stop, I’ve three tubs of fair buns proving and my oven won’t draw. The damper’s stuck right up the flue, and I’m no climber.'),
      L('hollis', 'And don’t you go poking in my dough, mind.'),
    ]);
  }
  if (!has(s, 'ovenFixed')) return say([L('hollis', 'That damper’s stuck right up the flue. If only someone could get up there.')]);
  return say([L('hollis', 'You fixed my oven! Go on then, look in a tub if you must. But just the one, and be sure it’s the right one.')]);
}
function tub(s: State, id: string): Outcome {
  const me = s.who, D = me === 'dora', right = id === 'tub2';
  if (s.got.includes('copper')) return say([L(me, 'Lovely dough. Just dough.')]);
  if (!D && !(right && has(s, 'clink') && has(s, 'ovenFixed'))) {
    if (!right) return say([L('enzo', 'I tap the side and listen... a soft squelch. Nothing in this one.')]);
    set(s, 'clink');
    return say([L('enzo', 'I tap the side and listen... clink! There’s something hard and metal in this one.')], 'clink');
  }
  if (!has(s, 'ovenFixed')) return say([L('hollis', 'Paws out of my dough!')], 'nope', false);
  if (!right || !has(s, 'clink')) return say([L(me, 'Hollis said just one tub. I’d better be sure which first. Enzo’s got good ears.')]);
  give(s, 'copper');
  return { ok: true, sfx: 'pickup', got: 'copper', lines: [L(me, 'Elbow-deep in dough... got it! The copper strike wheel!'), L('hollis', 'Well, I never!')] };
}
function nell(s: State): Outcome {
  if (s.got.includes('brass')) return say([L('nell', 'So that’s what was clunking under my wheel. Good luck with the clock, dears.')]);
  if (!has(s, 'metNell')) {
    set(s, 'metNell');
    return say([
      L('nell', 'Out late, you two. Something came clunking down the drain this evening and stuck fast under my waterwheel. Brass, by the glint.'),
      L('nell', 'You’d need to stop the wheel to get at it. That’s the sluice lever, up on the beam, and it only holds while someone hangs on to it. My climbing days are long gone.'),
      L('nell', 'And you’d want something long to reach under the wheel with.'),
    ]);
  }
  if (has(s, 'holding')) return say([L('nell', 'Hold on tight, dear! Now somebody fish it out!')]);
  return say([L('nell', 'Somebody up on the lever, and somebody at the wheel with something long. Two at once.')]);
}

// ---------------------------------------------------------------- Enzo's notebook
/** the next thing to do, from where the story is */
export function hint(s: State): string {
  if (s.ch === 1) {
    if (!has(s, 'metTock')) return 'The clock’s stopped! Mr Tock will be in the tower. Let’s ask him.';
    if (!has(s, 'sawWorks')) return 'Climb the stairs to the clock room and look at the works.';
    if (!has(s, 'hatchOpen')) return s.got.includes('oilcan') ? 'Oil the rusty hatch in the clock room.' : 'The hatch in the clock room is rusted shut. Mr Tock’s workbench might have something for rust.';
    if (!has(s, 'ledge')) return 'Dora can climb out of the hatch onto the ledge and look around.';
    return 'Tell Mr Tock what Dora saw from the ledge.';
  }
  if (s.ch === 2) {
    if (!s.got.includes('copper')) {
      if (!has(s, 'metHollis')) return 'The flour went to the bakery. Pop in and see Baker Hollis.';
      if (!has(s, 'ovenFixed')) return s.got.includes('oilcan') ? 'Hollis’s damper is stuck up the flue. Dora can climb; the oil can will loosen it.' : 'Hollis’s damper is rusted stuck. Something from Mr Tock’s bench would help.';
      if (!has(s, 'clink')) return 'Which tub? Enzo has good ears: he could tap each tub and listen.';
      return 'Take the gear from the tub that clinked.';
    }
    if (!s.got.includes('brass')) {
      if (!has(s, 'metNell')) return 'The drain runs down to the river. Ask Nell at the mill.';
      if (!s.got.includes('boathook')) return 'We need something long to reach under the waterwheel. Captain Rook’s barge is moored by the jetty.';
      return has(s, 'holding') ? 'Dora’s holding the lever! Switch to Enzo, go to the riverside and use the boathook on the wheel.' : 'Dora hangs on the mill’s lever while Enzo fishes at the wheel with the boathook. Switch between them with the Dora and Enzo buttons.';
    }
    if (!s.got.includes('silver')) {
      if (!has(s, 'tune')) return 'Gubbins has the silver wheel. Rook’s music box might tell us how to call him down. Enzo remembers tunes.';
      if (!has(s, 'gubbinsDown')) return 'Enzo could whistle the supper tune to Gubbins.';
      if (!s.got.includes('button')) return 'Gubbins wants something shinier. Something might glint by the well in the square, with a bit of light.';
      return 'Offer Gubbins the silver button.';
    }
    return 'Take the three wheels back to Mr Tock in the tower.';
  }
  if (!s.got.includes('note')) return 'Who knocked the cover off? Show Mr Tock the tuft of red fur from the ledge.';
  if (!has(s, 'twinsOpen')) return 'Slip Mr Tock’s note under the Hatters’ door.';
  if (!s.got.includes('star')) return 'Talk to Hob and Hettie in the hat shop.';
  return 'Fit all four wheels onto the works in the clock room.';
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'clocktower-mystery-v1';
export type Save = { v: 1; game: State | null; done: boolean; best: { moves: number; hints: number } | null; settings: { sound: boolean; music: boolean; fast: boolean } };
export const newSave = (): Save => ({ v: 1, game: null, done: false, best: null, settings: { sound: true, music: true, fast: false } });
const ALL_ROOMS = Object.keys(ROOMS) as RoomId[], ALL_ITEMS = Object.keys(ITEMS) as ItemId[];
const FLAGS: Flag[] = ['metTock', 'sawWorks', 'readChart', 'hatchOpen', 'ledge', 'metHollis', 'ovenFixed', 'clink', 'sawSack', 'metNell', 'holding', 'sawGlint', 'tune', 'gubbinsDown', 'cornerLit', 'heardTwins', 'twinsOpen'];
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo);
function parseState(d: unknown): State | null {
  if (!d || typeof d !== 'object') return null;
  const g = d as Record<string, unknown>, s = newState();
  if (![1, 2, 3, 4].includes(g.ch as number)) return null;
  s.ch = g.ch as Chapter;
  const at = (g.at ?? {}) as Record<string, unknown>;
  for (const w of ['dora', 'enzo'] as Who[]) { if (!ALL_ROOMS.includes(at[w] as RoomId)) return null; s.at[w] = at[w] as RoomId; }
  s.who = g.who === 'enzo' ? 'enzo' : 'dora';
  const items = (v: unknown) => (Array.isArray(v) ? ALL_ITEMS.filter((i) => v.includes(i)) : []);
  s.got = items(g.got); s.inv = items(g.inv).filter((i) => s.got.includes(i));
  s.flags = Array.isArray(g.flags) ? FLAGS.filter((f) => (g.flags as unknown[]).includes(f)).sort() : [];
  const fi = Array.isArray(g.fitted) ? g.fitted : [];
  s.fitted = SLOTS.map((want, k) => (fi[k] === want && s.got.includes(want) ? want : null));
  for (const it of s.fitted) if (it) s.inv = s.inv.filter((x) => x !== it);
  s.moves = int(g.moves, 0, 1e7); s.hints = int(g.hints, 0, 1e7);
  s.seen = Array.isArray(g.seen) ? ALL_ROOMS.filter((r) => (g.seen as unknown[]).includes(r)) : ['square'];
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  let d: Record<string, unknown>; try { d = JSON.parse(raw); } catch { return s; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return s;
  s.game = parseState(d.game); s.done = d.done === true;
  const b = d.best as Record<string, unknown> | null;
  if (b && typeof b === 'object') s.best = { moves: int(b.moves, 0, 1e7), hints: int(b.hints, 0, 1e7) };
  const st = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>;
  for (const k of ['sound', 'music', 'fast'] as const) if (typeof st[k] === 'boolean') s.settings[k] = st[k] as boolean;
  return s;
}
/** bank a finished mystery: the best is the fewest hints, then the fewest moves */
export function finish(sv: Save, g: State) {
  const b = sv.best, better = !b || g.hints < b.hints || (g.hints === b.hints && g.moves < b.moves);
  sv.done = true; if (better) sv.best = { moves: g.moves, hints: g.hints };
  return better;
}

// ---------------------------------------------------------------- the walkthrough
/** one way through the whole mystery (the tests play it, and the page's debug hook uses it to jump ahead) */
export const WALKTHROUGH: Action[] = [
  { k: 'go', to: 'tower' }, { k: 'spot', id: 'tock' }, { k: 'spot', id: 'oilcan' }, { k: 'go', to: 'clockroom' }, { k: 'spot', id: 'works' },
  { k: 'item', item: 'oilcan', id: 'hatch' }, { k: 'spot', id: 'hatch' }, { k: 'go', to: 'tower' }, { k: 'spot', id: 'tock' },
  // chapter 2: the copper wheel in the dough
  { k: 'go', to: 'square' }, { k: 'go', to: 'bakery' }, { k: 'spot', id: 'hollis' }, { k: 'item', item: 'oilcan', id: 'damper' }, { k: 'swap' },
  { k: 'spot', id: 'tub2' }, { k: 'spot', id: 'tub2' },
  // the silver wheel from Gubbins
  { k: 'go', to: 'square' }, { k: 'go', to: 'riverside' }, { k: 'go', to: 'mill' }, { k: 'spot', id: 'nell' }, { k: 'go', to: 'riverside' },
  { k: 'go', to: 'boat' }, { k: 'spot', id: 'boathook' }, { k: 'spot', id: 'musicbox' }, { k: 'spot', id: 'gubbins' }, { k: 'go', to: 'riverside' },
  { k: 'go', to: 'square' }, { k: 'item', item: 'lantern', id: 'well' }, { k: 'spot', id: 'button' }, { k: 'go', to: 'riverside' }, { k: 'go', to: 'boat' },
  { k: 'item', item: 'button', id: 'gubbins' }, { k: 'go', to: 'riverside' },
  // the brass wheel under the waterwheel: Dora on the lever, Enzo with the hook
  { k: 'go', to: 'mill' }, { k: 'swap' }, { k: 'spot', id: 'lever' }, { k: 'swap' }, { k: 'go', to: 'riverside' }, { k: 'item', item: 'boathook', id: 'wheel' },
  { k: 'swap' }, { k: 'go', to: 'riverside' }, { k: 'go', to: 'square' }, { k: 'go', to: 'tower' }, { k: 'spot', id: 'tock' },
  // chapter 3: the twins and the star wheel
  { k: 'item', item: 'tuft', id: 'tock' }, { k: 'go', to: 'square' }, { k: 'item', item: 'note', id: 'hatdoor' }, { k: 'go', to: 'hatshop' }, { k: 'spot', id: 'twins' },
  { k: 'go', to: 'square' }, { k: 'go', to: 'tower' }, { k: 'go', to: 'clockroom' },
  { k: 'fit', item: 'brass', slot: 0 }, { k: 'fit', item: 'copper', slot: 1 }, { k: 'fit', item: 'silver', slot: 2 }, { k: 'fit', item: 'star', slot: 3 },
];

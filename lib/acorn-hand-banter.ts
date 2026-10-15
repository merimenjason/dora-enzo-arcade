// What Acorn Hand's rivals say across the table, and who sits there each round. Page flavour only: no rules live
// here, and nothing draws from a run's random numbers, so a seed replays exactly as before.
import { BOSSES, type Rival } from './acorn-hand-cards.js';

export type Said = 'enter' | 'discard' | 'big' | 'rule' | 'beaten' | 'gloat';
export type Reaction = Said | 'idle' | 'hit';
export const SAID: Said[] = ['enter', 'discard', 'big', 'rule', 'beaten', 'gloat'];
export const RIVALS: Rival[] = ['fox', 'owl', 'hawk', 'snake', 'badger', 'skunk', 'weasel', 'mole', 'bear', 'cougar', 'beetle', 'lizard', 'armadillo'];
/** A hand worth this share of the target makes the rival recoil. */
export const BIG_HAND = 0.25;
/** How far up the scale each rival's chirp sits. */
export const PITCH: Record<Rival, number> = { fox: 4, owl: 2, hawk: 6, snake: 1, badger: 0, skunk: 3, weasel: 7, mole: -2, bear: -4, cougar: 2, beetle: 9, lizard: 1, armadillo: -1 };

export const BANTER: Record<Rival, Record<Said, string[]>> = {
  fox: {
    enter: ['Care for a friendly game? Heh.', 'Shuffle up, little fluffballs.'],
    discard: ['Throwing those away? Bold.', 'Nothing good in there, hm?'],
    big: ['Wait, that wasn\'t the plan!', 'Sly paws, chinchilla. Sly.'],
    rule: ['Acorns? Those are mine now.', 'Not one acorn counts here.'],
    beaten: ['Fine, fine. You outfoxed me.', 'Take the nuts. I\'ll be back.'],
    gloat: ['Outfoxed! Better luck next time.', 'Every hand has a sly ending.'],
  },
  owl: {
    enter: ['Do sit up straight. We begin.', 'Mind your manners at my table.'],
    discard: ['Hoo needs those? Not you.', 'A curious choice, dear.'],
    big: ['Goodness! Most irregular!', 'Hoo taught you that?'],
    rule: ['Clovers? How very ordinary.', 'Your clovers wilt before me.'],
    beaten: ['Well played. I concede.', 'Hoo would have guessed?'],
    gloat: ['Patience wins. Always.', 'Class dismissed, little ones.'],
  },
  hawk: {
    enter: ['I see every card from up here.', 'Sharp eyes, sharper claws. Deal.'],
    discard: ['Dropping those? I saw that.', 'Fumbling already?'],
    big: ['Ruffled my feathers, that did!', 'Hey! Keep it down there!'],
    rule: ['Berries are for the birds. Me.', 'Ha! Those berries score nothing.'],
    beaten: ['Grounded. Well flown.', 'I\'ll circle back for you.'],
    gloat: ['Swooped! Too slow, fluffballs.', 'From up here you look tiny.'],
  },
  snake: {
    enter: ['Sssit. Ssstay a while.', 'Let\'sss play, shall we?'],
    discard: ['Ssso indecisive.', 'Ssshed them all, why not.'],
    big: ['Hssss! Unexpected!', 'Ssstop that at once!'],
    rule: ['Pebblesss sssink without a trace.', 'Ssso many pebbles, ssso few points.'],
    beaten: ['Ssslithering off now...', 'You win thisss one.'],
    gloat: ['Ssswallowed whole!', 'Sssweet, sssweet victory.'],
  },
  badger: {
    enter: ['My table, my rules.', 'Dig in. No dawdling.'],
    discard: ['Digging for treasure, eh?', 'Hmph. Wasteful.'],
    big: ['Oof! Right in the burrow!', 'Now that\'s a proper dig!'],
    rule: ['Five cards. Always five.', 'Rules are rules. Five!'],
    beaten: ['Hmph. Fair and square.', 'You dug deeper. Well done.'],
    gloat: ['Back to your burrow, then.', 'Rules win again.'],
  },
  skunk: {
    enter: ['Smell that? It\'s your luck.', 'Hold your nose and deal.'],
    discard: ['Stinky cards? Toss \'em.', 'Phew, good riddance.'],
    big: ['Whoa! That one reeks of luck!', 'Ugh, that stings!'],
    rule: ['Can\'t see? That\'s the fog, dear.', 'Play blind. It\'s more fun.'],
    beaten: ['That stinks. For me.', 'Okay, okay, you win. Phew.'],
    gloat: ['Smells like victory. Mine.', 'Pee-yew, what a finish!'],
  },
  weasel: {
    enter: ['Hello, hello! Let\'s be friends.', 'Me? Cheat? Never once!'],
    discard: ['Ooh, can I have those?', 'Tossing them? I\'ll look later.'],
    big: ['Hey! That\'s my trick!', 'Ow ow ow! Not fair!'],
    rule: ['Who\'s that face? Guess!', 'Hidden faces, hidden fortunes.'],
    beaten: ['You weaseled out of that one.', 'Fine! I\'ll go count my socks.'],
    gloat: ['Pop goes the chinchilla!', 'Ha! Never saw it coming.'],
  },
  mole: {
    enter: ['Cosy down here, isn\'t it?', 'Mind your head. Low ceiling.'],
    discard: ['Bury them. I\'ll dig them up.', 'Hmm? Didn\'t see. Can\'t see.'],
    big: ['My spectacles! What was that?', 'That shook the tunnels!'],
    rule: ['Room\'s tight down here.', 'One card fewer. Cosy, isn\'t it?'],
    beaten: ['Back underground for me.', 'Well dug, well dug.'],
    gloat: ['Down you go, into the dark!', 'Tunnel vision wins again.'],
  },
  bear: {
    enter: ['Grr. Make it quick. Nap time.', 'Sit. Play. Don\'t poke me.'],
    discard: ['Grumble. Get on with it.', 'Toss, toss. Boring.'],
    big: ['GRR! Woke me right up!', 'Ow. My honey nerves.'],
    rule: ['Three plays. Then naptime.', 'No more plays. Bear says so.'],
    beaten: ['Fine. Nap time anyway.', 'Grumble. You win.'],
    gloat: ['Hibernation can wait. I won!', 'Back to the den with you.'],
  },
  cougar: {
    enter: ['Purr. No second chances.', 'Play carefully, little prey.'],
    discard: ['Prowling for better?', 'Nervous paws, hm?'],
    big: ['Mrrow! Claws out, are they?', 'Hiss! Lucky pounce.'],
    rule: ['No discards. Play what you hold.', 'Commit, little prey.'],
    beaten: ['You pounced first. Well done.', 'Purr... respect.'],
    gloat: ['Pounce! Got you.', 'The hunt is over.'],
  },
  beetle: {
    enter: ['Click click. Let\'s begin.', 'Small but shiny. Like my odds.'],
    discard: ['Click. Fewer cards, fewer worries.', 'Scuttle scuttle, toss it.'],
    big: ['Click! My shell rattled!', 'Eek! Six legs, all wobbly.'],
    rule: ['Three cards a draw. Click.', 'Slowly, slowly. Like me.'],
    beaten: ['Scuttling away now.', 'Click. Well played.'],
    gloat: ['Click-click, I win!', 'Small bug, big win.'],
  },
  lizard: {
    enter: ['Your favourite hand? I know it.', 'Bask a while. Then lose.'],
    discard: ['Shedding cards? I shed skin.', 'Blink. Gone.'],
    big: ['Hss! Tail nearly fell off!', 'That warmed my scales.'],
    rule: ['Your favourite hand? Halved.', 'I know your tricks. Halved.'],
    beaten: ['Cold-blooded loss. Ugh.', 'Back to my sunny rock.'],
    gloat: ['Predictable, chinchillas.', 'Same hand, same fate.'],
  },
  armadillo: {
    enter: ['Knock knock. Thick shell here.', 'Roll up, roll up! Let\'s play.'],
    discard: ['Rolling those away?', 'Tuck and toss. Good form.'],
    big: ['Ow! Right through the shell!', 'Clonk! Felt that one.'],
    rule: ['Half as high again. Good luck.', 'My shell needs more than that.'],
    beaten: ['Cracked my shell. Well done.', 'Rolling off in shame.'],
    gloat: ['Bounced right off me!', 'Thick shell, thin chances.'],
  },
};

export const sayLine = (rival: Rival, said: Said, n: number) => { const l = BANTER[rival][said]; return l[n % l.length]; };
export const rivalName = (rival: Rival) => BOSSES.find((b) => b.rival === rival)!.name;

const mix = (a: number) => { a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); return (a ^ (a >>> 16)) >>> 0; };
/** The rival across the table: the boss in the boss round, otherwise one of the others, different for each round of an ante. */
export function tableRival(seed: number, ante: number, blind: number, boss: Rival): Rival {
  if (blind >= 2) return boss;
  const others = RIVALS.filter((r) => r !== boss), a = mix(seed ^ Math.imul(ante, 0x9e3779b1)) % others.length;
  if (blind === 0) return others[a];
  const b = mix((seed + Math.imul(ante, 7919) + 1) >>> 0) % (others.length - 1);
  return others[b >= a ? b + 1 : b];
}

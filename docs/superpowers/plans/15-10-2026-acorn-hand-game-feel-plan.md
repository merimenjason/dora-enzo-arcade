# Acorn Hand game feel · implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Acorn Hand a rival who reacts across the table, cards that deal, fly and flip, scoring that lands with weight, and a shop that moves, without touching rules, saves or balance.

**Architecture:** Two new modules. `lib/acorn-hand-banter.ts` is pure data and functions (rival lines, which rival sits at the table) and runs in the Node suite. `app/acorn-hand/motion.ts` holds Web Animations API helpers that animate elements from where they were to where they are, and do nothing when motion is off. The page calls them around actions it already has; the engine is never changed and nothing waits for an animation.

**Tech Stack:** Next.js client page (vinext), TypeScript, Canvas 2D, Web Animations API, CSS, WebAudio cues via `lib/cue-sound.ts`, Node `assert` tests, Playwright browser suites.

**Spec:** `docs/superpowers/specs/15-10-2026-acorn-hand-game-feel-design.md`

## Global Constraints

- The engine (`lib/acorn-hand-game.ts`, `lib/acorn-hand-cards.ts`) is not edited; no draw from the run's `Rand`; `SAVE_VERSION` stays 2 and the save keys stay `acorn-hand-run-v2` and `acorn-hand-v1`.
- No new dependency. `package.json` changes only in the `test` and `test:acorn-hand` scripts; never commit a Playwright entry in it (check `git diff package.json` before staging).
- Motion never holds up input: state and DOM update at once; the only input lock stays the existing `anim` lock while a hand is counted.
- `prefers-reduced-motion: reduce` turns everything off (`document.getAnimations().length === 0` after an action), and the game stays playable.
- Elements created for motion (ghost copies, tossed nuts, paper bits) never carry a `data-testid` and never use the `card-` prefix; `[data-testid^="card-"]` must still count only hand cards.
- Big hand: a hand total of at least `BIG_HAND = 0.25` of the round target. Shake: at most 8 px, 300 ms.
- Nut pile: `ceil(10 × (1 − score ÷ target))` nuts, never below 0.
- Banter lines are at most 48 characters; 2 or 3 lines per rival per moment; picked in turn, never at random.
- Don't run `oxfmt`; match the hand-formatted style of each file. Dates in Markdown are dd-mm-yyyy.
- Never stage `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` or `.claude/skills/graft/SKILL.md`; stage files by name.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A dev server is already running on port 3000 for browser suites (`npm run test:e2e:acorn-hand`).

## Review Focus

- **A reload in the middle of a round** shows the same rival, no deal animation, and no bubble except the `enter` greeting; the test lives in Task 3.
- **Clicking fast during motion** (picking cards while the deal is still flying, discarding twice quickly) must act at once and never leave stray ghost copies on screen; Task 4 checks no `.ah-ghost` remains after the motion ends.
- **The round won or lost by the last hand** still reaches the cash-out or game-over panel after the count, and saving happens before the count, as now; Task 3 checks the table stays up during the count and the panel follows.
- **A missing painted rival or card back** (blocked image) still draws the canvas fallback and the motion still runs; Task 4 runs a round with `card-back.png` blocked.
- **Reduced motion** leaves no running animations anywhere, including the rival's idle bob and the CSS keyframes; Task 5 checks `document.getAnimations().length === 0`.

---

### Task 1: Rival banter and who sits at the table

**Files:**
- Create: `lib/acorn-hand-banter.ts`
- Modify: `package.json` (the `test` and `test:acorn-hand` scripts)
- Test: `tests/acorn-hand.mjs`

**Interfaces:**
- Consumes: `type Rival` and `BOSSES` from `lib/acorn-hand-cards.ts`.
- Produces: `type Reaction = 'enter' | 'idle' | 'discard' | 'hit' | 'big' | 'rule' | 'beaten' | 'gloat'`; `type Said = 'enter' | 'discard' | 'big' | 'rule' | 'beaten' | 'gloat'`; `SAID: Said[]`; `RIVALS: Rival[]` (13); `BANTER: Record<Rival, Record<Said, string[]>>`; `PITCH: Record<Rival, number>`; `BIG_HAND = 0.25`; `tableRival(seed: number, ante: number, blind: number, boss: Rival): Rival`; `sayLine(rival: Rival, said: Said, n: number): string`; `rivalName(rival: Rival): string`.

- [ ] **Step 1: Write the failing test.** Append to `tests/acorn-hand.mjs`, just before the final `console.log`, and add the import at the top under the existing import:

```js
import { BANTER, SAID, RIVALS, PITCH, BIG_HAND, tableRival, sayLine, rivalName } from '../.checks/acorn-hand-banter.js';
```

```js
// Banter and the table's rival
{
  assert.equal(RIVALS.length, 13); assert.deepEqual([...RIVALS].sort(), BOSSES.map((b) => b.rival).sort(), 'every boss rival can sit at the table');
  for (const rival of RIVALS) {
    assert.equal(typeof PITCH[rival], 'number', `${rival} has a chirp pitch`);
    assert.match(rivalName(rival), /^The /);
    for (const said of SAID) {
      const lines = BANTER[rival][said];
      assert.ok(lines.length >= 2 && lines.length <= 3, `${rival} ${said} has 2 or 3 lines`);
      for (const l of lines) assert.ok(l.length > 0 && l.length <= 48, `${rival} ${said}: "${l}" fits a bubble`);
    }
  }
  assert.equal(sayLine('fox', 'enter', 0), BANTER.fox.enter[0]); assert.equal(sayLine('fox', 'enter', BANTER.fox.enter.length), BANTER.fox.enter[0], 'lines go round in turn');
  assert.equal(BIG_HAND, 0.25);
  for (let seed = 1; seed < 400; seed += 7) for (let ante = 1; ante <= 9; ante++) {
    const boss = RIVALS[(seed + ante) % RIVALS.length];
    const small = tableRival(seed, ante, 0, boss), big = tableRival(seed, ante, 1, boss);
    assert.notEqual(small, boss, 'the small round is never the boss'); assert.notEqual(big, boss, 'nor the big round');
    assert.notEqual(small, big, 'the small and big rounds have different rivals');
    assert.equal(tableRival(seed, ante, 2, boss), boss, 'the boss round is the boss');
    assert.equal(tableRival(seed, ante, 0, boss), small, 'the same inputs give the same rival');
  }
  const seen = new Set(); for (let seed = 1; seed < 200; seed++) seen.add(tableRival(seed, 1, 0, 'fox'));
  assert.equal(seen.size, 12, 'every other rival turns up');
}
```

- [ ] **Step 2: Add the module to the test build.** In `package.json`, in the `test` script, replace `lib/acorn-hand-game.ts --target` with `lib/acorn-hand-game.ts lib/acorn-hand-banter.ts --target`; in `test:acorn-hand`, replace `tsc lib/acorn-hand-game.ts --target` with `tsc lib/acorn-hand-game.ts lib/acorn-hand-banter.ts --target`.

- [ ] **Step 3: Run the test to see it fail.** Run: `npm run test:acorn-hand`. Expected: tsc error `File 'lib/acorn-hand-banter.ts' not found`.

- [ ] **Step 4: Write `lib/acorn-hand-banter.ts`.**

```ts
// What Acorn Hand's rivals say across the table, and who sits there each round. Page flavour only: no rules live
// here, and nothing draws from a run's random numbers, so a seed replays exactly as before.
import { BOSSES, type Rival } from './acorn-hand-cards';

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
```

- [ ] **Step 5: Run the test to see it pass.** Run: `npm run test:acorn-hand`. Expected: the existing `PASS Acorn Hand: …` line, no assertion errors. If a line is over 48 characters, shorten that line.

- [ ] **Step 6: Commit.**

```bash
git diff package.json   # only the two tsc lists changed
git add lib/acorn-hand-banter.ts tests/acorn-hand.mjs package.json
git commit -m "Give Acorn Hand's rivals lines and a seat at every table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Motion helpers and the new sounds

**Files:**
- Create: `app/acorn-hand/motion.ts`
- Modify: `app/acorn-hand/sound.ts`
- Modify: `app/acorn-hand/acorn-hand.css` (append the motion classes)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, from `app/acorn-hand/motion.ts`: `type Box = { x: number; y: number; w: number; h: number }`; `setMotion(on: boolean): void`; `motionOn(): boolean`; `boxOf(el: Element | null): Box | null`; `remember(root: ParentNode | null, attr?: string): Map<string, Box>` (default attr `data-card-id`); `settle(root: ParentNode | null, from: Map<string, Box>, origin: Box | null, opts?: { attr?: string; flipNew?: boolean }): void`; `flip(el: Element, delay?: number): void`; `fly(el: Element | null, to: Box | 'away', opts?: { duration?: number; delay?: number; spin?: number; fade?: boolean; drop?: number }): void`; `toss(text: string, from: Box | null, to: Box | null, delay?: number): void`; `burst(at: Box | null, color: string, n?: number): void`; `emerge(els: Iterable<Element>, from: Box | null, gap?: number): void`; `play(el: Element | null, frames: Keyframe[], opts?: KeyframeAnimationOptions): Animation | null`; `shake(el: Element | null, strength: number): void`; `dropGhosts(): void`; `useTicker(value: number, active: boolean, ms?: number): number`; keyframe sets `REACT: Record<'enter' | 'discard' | 'hit' | 'big' | 'rule' | 'beaten' | 'gloat', [Keyframe[], KeyframeAnimationOptions]>`, `WIGGLE`, `POP`, `PUNCH`, `STAMP`, `FLIP_IN`, `FLARE`, `HOP`.
- From `sound.ts`: cue names `flip`, `whoosh`, `tear`, `chirp`.

- [ ] **Step 1: Write `app/acorn-hand/motion.ts`.**

```ts
/* oxlint-disable react/react-compiler -- A ticker sets state from an animation frame by design. */
// Acorn Hand's motion: small helpers on the Web Animations API. Nothing here changes game state or makes anything
// wait, so the game plays the same with motion off; every helper returns at once when motion is off.
import { useEffect, useRef, useState } from 'react';

export type Box = { x: number; y: number; w: number; h: number };
let on = true;
export const setMotion = (m: boolean) => { on = m; };
export const motionOn = () => on && typeof Element !== 'undefined' && 'animate' in Element.prototype;
const box = (el: Element): Box => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
export const boxOf = (el: Element | null) => (el ? box(el) : null);
const host = () => document.querySelector('.ah-shell') ?? document.body;
const SPRING = 'cubic-bezier(.2,1.3,.4,1)';

/** Where every element carrying `attr` under `root` is now, keyed by the attribute's value. */
export function remember(root: ParentNode | null, attr = 'data-card-id'): Map<string, Box> {
  const out = new Map<string, Box>();
  if (!root || !motionOn()) return out;
  root.querySelectorAll(`[${attr}]`).forEach((el) => out.set(el.getAttribute(attr)!, box(el)));
  return out;
}

/** Move each element from where it was to where it is; ones that were nowhere fly in from `origin`, if there is one. */
export function settle(root: ParentNode | null, from: Map<string, Box>, origin: Box | null, opts: { attr?: string; flipNew?: boolean } = {}) {
  if (!root || !motionOn()) return;
  const attr = opts.attr ?? 'data-card-id';
  let fresh = 0;
  root.querySelectorAll(`[${attr}]`).forEach((el) => {
    const now = box(el), was = from.get(el.getAttribute(attr)!), start = was ?? origin;
    if (!start || !now.w) return;
    const dx = start.x + start.w / 2 - (now.x + now.w / 2), dy = start.y + start.h / 2 - (now.y + now.h / 2), s = start.w / now.w;
    if (was && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const delay = was ? 0 : 50 * fresh++;
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }], { duration: was ? 220 : 320, delay, easing: SPRING, fill: 'backwards' });
    if (!was && opts.flipNew) flip(el, delay);
  });
}

/** Turn a card over: its `.ah-back` shows for the first half, its face for the second. */
export function flip(el: Element, delay = 0) {
  if (!motionOn()) return;
  const face = el.querySelector('canvas'), back = el.querySelector('.ah-back'), timing = { duration: 320, delay, fill: 'backwards' as const };
  face?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(0)', offset: 0.5 }, { transform: 'scaleX(1)' }], timing);
  back?.animate([{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 1, transform: 'scaleX(0)', offset: 0.5 }, { opacity: 0, transform: 'scaleX(0)' }], timing);
}

/** Send a copy of `el` from where it is to `to` (or off the right edge for 'away'), then drop the copy. */
export function fly(el: Element | null, to: Box | 'away', opts: { duration?: number; delay?: number; spin?: number; fade?: boolean; drop?: number } = {}) {
  if (!el || !motionOn()) return;
  const from = box(el), ghost = el.cloneNode(true) as HTMLElement;
  for (const n of [ghost, ...ghost.querySelectorAll('[data-testid],[data-card-id],[data-fly]')]) { n.removeAttribute('data-testid'); n.removeAttribute('data-card-id'); n.removeAttribute('data-fly'); }
  const src = el.querySelectorAll('canvas'), dst = ghost.querySelectorAll('canvas');
  dst.forEach((c, i) => { try { c.getContext('2d')?.drawImage(src[i], 0, 0); } catch { /* a blank copy still moves */ } });
  ghost.classList.add('ah-ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.removeAttribute('id');
  Object.assign(ghost.style, { position: 'fixed', left: `${from.x}px`, top: `${from.y}px`, width: `${from.w}px`, height: `${from.h}px`, margin: '0', pointerEvents: 'none', zIndex: '50', transform: 'none' });
  host().appendChild(ghost);
  const end = to === 'away' ? { x: innerWidth + from.w, y: from.y + (opts.drop ?? 60), w: from.w, h: from.h } : to;
  const dx = end.x + end.w / 2 - (from.x + from.w / 2), dy = end.y + end.h / 2 - (from.y + from.h / 2), s = end.w / (from.w || 1);
  const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(${opts.spin ?? 0}deg) scale(${s})`, opacity: opts.fade ? 0 : 1 }],
    { duration: opts.duration ?? 380, delay: opts.delay ?? 0, easing: 'cubic-bezier(.45,0,.7,.4)', fill: 'both' });
  a.onfinish = () => ghost.remove(); a.oncancel = () => ghost.remove();
}

/** Throw a little emoji from one box to another in an arc. */
export function toss(text: string, from: Box | null, to: Box | null, delay = 0) {
  if (!from || !to || !motionOn()) return;
  const bit = document.createElement('span');
  bit.className = 'ah-toss'; bit.textContent = text; bit.setAttribute('aria-hidden', 'true');
  bit.style.left = `${from.x + from.w / 2}px`; bit.style.top = `${from.y + from.h / 2}px`;
  host().appendChild(bit);
  const dx = to.x + to.w / 2 - (from.x + from.w / 2), dy = to.y + to.h / 2 - (from.y + from.h / 2);
  const a = bit.animate([
    { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 60}px)) scale(1.2)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8)`, opacity: 0.9 },
  ], { duration: 520, delay, easing: 'ease-in-out', fill: 'both' });
  a.onfinish = () => bit.remove(); a.oncancel = () => bit.remove();
}

/** A puff of paper bits from the centre of a box. */
export function burst(at: Box | null, color: string, n = 12) {
  if (!at || !motionOn()) return;
  for (let i = 0; i < n; i++) {
    const bit = document.createElement('span'), a = (i / n) * Math.PI * 2 + (i % 3) * 0.3, d = 60 + (i % 4) * 16;
    bit.className = 'ah-bit'; bit.setAttribute('aria-hidden', 'true'); bit.style.background = color;
    bit.style.left = `${at.x + at.w / 2}px`; bit.style.top = `${at.y + at.h / 2}px`;
    host().appendChild(bit);
    const an = bit.animate([{ transform: 'translate(-50%, -50%) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(${200 + i * 40}deg)`, opacity: 0 }],
      { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
    an.onfinish = () => bit.remove(); an.oncancel = () => bit.remove();
  }
}

/** Fan elements out one by one from a box, as if they came out of it. */
export function emerge(els: Iterable<Element>, from: Box | null, gap = 90) {
  if (!from || !motionOn()) return;
  let i = 0;
  for (const el of els) {
    const b = box(el), dx = from.x + from.w / 2 - (b.x + b.w / 2), dy = from.y + from.h / 2 - (b.y + b.h / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(-8deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: gap * i++, easing: SPRING, fill: 'backwards' });
  }
}

export function play(el: Element | null, frames: Keyframe[], opts: KeyframeAnimationOptions = {}) {
  if (!el || !motionOn()) return null;
  return el.animate(frames, { duration: 400, easing: 'ease-out', ...opts });
}

/** Shake the table: `strength` 0 to 1 sets how far, up to 8 px. */
export function shake(el: Element | null, strength: number) {
  const p = Math.round(2 + 6 * Math.min(1, Math.max(0, strength)));
  play(el, [{ transform: 'none' }, { transform: `translate(${-p}px, ${p / 2}px)` }, { transform: `translate(${p}px, ${-p / 2}px)` }, { transform: `translate(${-p / 2}px, 0)` }, { transform: 'none' }], { duration: 300 });
}

/** Remove any copies still in flight, for when the page goes away mid-motion. */
export const dropGhosts = () => { if (typeof document !== 'undefined') document.querySelectorAll('.ah-ghost, .ah-toss, .ah-bit').forEach((n) => n.remove()); };

/** A number that counts toward `value` over `ms` while `active`; otherwise exactly `value`. */
export function useTicker(value: number, active: boolean, ms = 140) {
  const [shown, setShown] = useState(value), from = useRef(value);
  useEffect(() => {
    if (!active || !motionOn()) { from.current = value; setShown(value); return; }
    const start = performance.now(), a = from.current; let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms), v = a + (value - a) * (1 - (1 - k) ** 3); from.current = v; setShown(v); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, ms]);
  return active && motionOn() ? shown : value;
}

export const POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' }];
export const PUNCH: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-3deg)', offset: 0.3 }, { transform: 'scale(.96)', offset: 0.6 }, { transform: 'scale(1)' }];
export const HOP: Keyframe[] = [{ transform: 'none' }, { transform: 'translateY(-10px)', offset: 0.4 }, { transform: 'none' }];
export const WIGGLE: Keyframe[] = [
  { transform: 'none', filter: 'none' }, { transform: 'rotate(-6deg) scale(1.08)', filter: 'drop-shadow(0 0 10px #ffd76a)', offset: 0.2 },
  { transform: 'rotate(6deg) scale(1.08)', offset: 0.45 }, { transform: 'rotate(-4deg) scale(1.04)', offset: 0.7 }, { transform: 'none', filter: 'none' },
];
export const STAMP: Keyframe[] = [{ transform: 'scale(1.3)', opacity: 0.4 }, { transform: 'scale(.95)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }];
export const FLIP_IN: Keyframe[] = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }];
export const FLARE: Keyframe[] = [{ filter: 'none' }, { filter: 'drop-shadow(0 0 10px #ffd76a) brightness(1.4)', offset: 0.3 }, { filter: 'none' }];
export const REACT: Record<'enter' | 'discard' | 'hit' | 'big' | 'rule' | 'beaten' | 'gloat', [Keyframe[], KeyframeAnimationOptions]> = {
  enter: [[{ transform: 'translateY(-30px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: 0.6 }, { transform: 'translateY(-6px)', offset: 0.8 }, { transform: 'none' }], { duration: 700 }],
  discard: [[{ transform: 'none' }, { transform: 'translateX(8px) rotate(6deg)', offset: 0.3 }, { transform: 'translateX(8px) rotate(6deg)', offset: 0.7 }, { transform: 'none' }], { duration: 900 }],
  hit: [[{ transform: 'none' }, { transform: 'translateX(-6px) rotate(-4deg)', offset: 0.4 }, { transform: 'none' }], { duration: 300 }],
  big: [[{ transform: 'none' }, { transform: 'translate(-14px, -4px) rotate(-10deg) scale(.95)', offset: 0.2 }, { transform: 'translateX(6px) rotate(5deg)', offset: 0.45 }, { transform: 'translateX(-3px) rotate(-2deg)', offset: 0.7 }, { transform: 'none' }], { duration: 700 }],
  rule: [[{ transform: 'none' }, { transform: 'translateY(-10px) scale(1.06)', offset: 0.3 }, { transform: 'none', offset: 0.5 }, { transform: 'translateY(-5px)', offset: 0.7 }, { transform: 'none' }], { duration: 600 }],
  beaten: [[{ transform: 'none', filter: 'none' }, { transform: 'translateY(10px) rotate(-8deg) scale(.94)', filter: 'grayscale(.8) brightness(.8)' }], { duration: 600, fill: 'forwards' }],
  gloat: [[{ transform: 'none' }, { transform: 'translateY(-14px)', offset: 0.25 }, { transform: 'none', offset: 0.5 }, { transform: 'translateY(-8px)', offset: 0.75 }, { transform: 'none' }], { duration: 700, iterations: 2 }],
};
```

- [ ] **Step 2: Add the four cues to `app/acorn-hand/sound.ts`.** Insert before the `click:` line:

```ts
  flip: [{ f: 3200, d: 0.03, noise: true, v: 0.02 }],
  whoosh: [{ f: 900, d: 0.22, noise: true, v: 0.035 }],
  tear: [{ f: 4000, d: 0.16, noise: true, v: 0.04 }, { f: 1200, d: 0.12, noise: true, v: 0.03, at: 0.08 }],
  chirp: [{ f: 880, to: 1320, d: 0.07, type: 'triangle', v: 0.03 }, { f: 1100, to: 990, d: 0.06, type: 'triangle', v: 0.025, at: 0.07 }],
```

- [ ] **Step 3: Append the motion classes to `app/acorn-hand/acorn-hand.css`,** just before the `@media (prefers-reduced-motion: reduce)` block:

```css
/* Motion: copies in flight, tossed nuts and paper bits live on top of everything and never take clicks. */
.ah-ghost { filter: drop-shadow(0 6px 6px #0007); }
.ah-ghost canvas { width: 100%; height: auto; display: block; }
.ah-ghost kbd, .ah-ghost .ah-pop { display: none; }
.ah-toss { position: fixed; z-index: 60; pointer-events: none; font-size: 22px; }
.ah-bit { position: fixed; z-index: 60; pointer-events: none; width: 9px; height: 6px; border-radius: 2px; }
```

- [ ] **Step 4: Typecheck.** Run: `npm run typecheck`. Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git add app/acorn-hand/motion.ts app/acorn-hand/sound.ts app/acorn-hand/acorn-hand.css
git commit -m "Add Acorn Hand motion helpers and flip, whoosh, tear and chirp cues

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The rival seat, the nut pile, Dora and Enzo, and the last hand on the table

**Files:**
- Modify: `app/acorn-hand/page.tsx`
- Modify: `app/acorn-hand/acorn-hand.css`
- Modify: `lib/acorn-hand-scene.ts` (`drawRival`, around line 227)
- Test: `tests/e2e/acorn-hand.mjs`

**Interfaces:**
- Consumes: `tableRival`, `sayLine`, `rivalName`, `PITCH`, `type Reaction`, `type Said` from Task 1; `play`, `REACT`, `setMotion`, `dropGhosts`, `toss`, `boxOf` from Task 2; cue `chirp`.
- Produces in `page.tsx`: `react(kind: Reaction): void`; state `mood: { kind: Reaction; n: number; line: string | null }`; `stage` (the phase the page shows: `anim ? 'round' : r.phase`); `Anim` gains `before: number`, `landed: boolean`, `ended: boolean`; a `later(fn: () => void)` queue run after each render; refs `tableRef`, `deckRef`, `mainRef`, `purseRef`, `scoreRef`, `chipsRef`, `multRef`, `totalRef`, `progressRef`. Test ids `rival` (with `data-rival`, `data-mood`), `rival-say`, `nut-pile` (with `data-left`), `pals`; `boss-rule` moves onto the sign.
- `drawRival(c, rival, w, h, t = 0.4, pose: 'calm' | 'happy' | 'sad' = 'calm')`.

- [ ] **Step 1: Write the failing browser checks.** In `tests/e2e/acorn-hand.mjs`, add after the `'a boss rule is shown and enforced'` check:

```js
await check('a rival sits across the table every round, says hello, and stays after a reload', async (page) => {
  await fresh(page); await deal(page);
  const rival = page.getByTestId('rival'); await rival.waitFor();
  const small = await rival.getAttribute('data-rival'); assert.ok(small);
  assert.ok((await page.getByTestId('rival-say').innerText()).trim().length > 0, 'a greeting on entering');
  assert.equal(await page.getByTestId('nut-pile').getAttribute('data-left'), '10');
  await setHand(page); await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click(); await page.getByTestId('play').click(); await settled(page);
  assert.ok(Number(await page.getByTestId('nut-pile').getAttribute('data-left')) < 10, 'nuts leave the pile as the score grows');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); await page.getByTestId('continue').click();
  assert.equal(await page.getByTestId('rival').getAttribute('data-rival'), small, 'the same rival after a reload');
  await run(page, '(r) => { r.round.target = 1; }'); await page.getByTestId('card-0').click(); await page.getByTestId('play').click();
  assert.equal(await page.getByTestId('table').count(), 1, 'the winning hand counts on the table');
  await settled(page); await page.getByTestId('cashout').waitFor();
  await page.getByTestId('collect').click(); await page.getByTestId('leave').click(); await page.getByTestId('start').click();
  const big = await page.getByTestId('rival').getAttribute('data-rival'); assert.notEqual(big, small, 'a new rival for the big round');
  const boss = await run(page, '(r) => r.bossFor(r.ante).rival'); assert.notEqual(big, boss);
});
```

and in the existing `'a boss rule is shown and enforced'` check, after `assert.match(await page.getByTestId('boss-rule').innerText(), /The Badger/);` add:

```js
  assert.equal(await page.getByTestId('rival').getAttribute('data-rival'), 'badger', 'the boss sits at the table');
```

- [ ] **Step 2: Run the checks to see them fail.** Run: `ONLY='rival sits' node tests/e2e/acorn-hand.mjs`. Expected: `FAIL a rival sits across the table…` (no `rival` test id).

- [ ] **Step 3: Give `drawRival` a pose.** In `lib/acorn-hand-scene.ts`, add `import { ACORN_CROPS } from './acorn-hand-crops';` beside the other imports (skip if already imported) and replace `drawRival` with:

```ts
export type Pose = 'calm' | 'happy' | 'sad';
/** A rival portrait. Happy and sad poses come from painted pose sheets once they exist; until then the calm one stands in. */
export function drawRival(c: C2D, rival: Rival, w: number, h: number, t = 0.4, pose: Pose = 'calm') {
  c.clearRect(0, 0, w, h);
  const rivals: Rival[] = ['fox', 'owl', 'hawk', 'snake', 'badger', 'skunk', 'weasel', 'mole', 'bear', 'cougar', 'beetle', 'lizard'];
  const index = rivals.indexOf(rival), sheet = rival === 'armadillo' ? 'rival-armadillo' : `rivals-${Math.floor(index / 6)}`, cell = rival === 'armadillo' ? 0 : index % 6;
  if (pose !== 'calm' && ACORN_CROPS[`${sheet}-${pose}`] && paintAcorn(c, `${sheet}-${pose}`, cell, 0, 0, w, h)) return;
  if (paintAcorn(c, sheet, cell, 0, 0, w, h)) return;
  if (CRITTERS[rival]) fitDraw(c, `ah-rival-${rival}`, 0, 0, w, h, (q) => critter(q, rival as CritterKind, CRITTERS[rival], t), -1);
  else fitDraw(c, `ah-rival-${rival}`, 0, 0, w, h, (q) => predator(q, rival as PredKind, tintOf(rival as PredKind, false), t), -1);
}
```

(The crop check keeps the loader from requesting a pose sheet that doesn't exist, which would show "Retry artwork".)

- [ ] **Step 4: Page state, the stage and the post-render queue.** In `app/acorn-hand/page.tsx`:

Change the React import to `import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';` and add:

```ts
import { tableRival, sayLine, rivalName, PITCH, type Reaction, type Said } from '../../lib/acorn-hand-banter';
import { play, REACT, setMotion, dropGhosts, toss, boxOf } from './motion';
```

Change `type Anim` to:

```ts
type Anim = { score: Score; cards: Card[]; step: number; total: boolean; landed: boolean; before: number; ended: boolean };
```

Change `RivalArt` to take a pose:

```ts
const RivalArt = ({ rival, pose = 'calm' }: { rival: Rival; pose?: 'calm' | 'happy' | 'sad' }) => <Paint w={160} h={120} sig={`${rival}-${pose}`} draw={(c, w, h) => drawRival(c, rival, w, h, 0.4, pose)} />;
```

Inside `AcornHandPage`, after the `useHoverNote` line, add:

```ts
  const [mood, setMood] = useState<{ kind: Reaction; n: number; line: string | null }>({ kind: 'idle', n: 0, line: null });
  const said = useRef(new Map<string, number>()), moodTimer = useRef(0), queued = useRef<(() => void)[]>([]);
  const tableRef = useRef<HTMLElement>(null), deckRef = useRef<HTMLDivElement>(null), mainRef = useRef<HTMLDivElement>(null), purseRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLElement>(null), chipsRef = useRef<HTMLOutputElement>(null), multRef = useRef<HTMLOutputElement>(null), totalRef = useRef<HTMLParagraphElement>(null), progressRef = useRef<HTMLProgressElement>(null);
  /** Run `fn` once, after the next render has reached the page. */
  const later = (fn: () => void) => { queued.current.push(fn); };
  useLayoutEffect(() => { const q = queued.current; queued.current = []; q.forEach((fn) => fn()); });
  const seat = run && run.round ? tableRival(run.seed, run.ante, run.blind, run.bossFor(run.ante).rival) : null;
  /** The rival reacts: a motion on its portrait and, for some moments, a line in a bubble for a couple of seconds. */
  const react = (kind: Reaction) => {
    if (!seat) return;
    let line: string | null = null;
    if (kind !== 'idle' && kind !== 'hit') { const k = `${seat}:${kind}`, n = said.current.get(k) ?? 0; said.current.set(k, n + 1); line = sayLine(seat, kind as Said, n); sound.cue('chirp', PITCH[seat], 1, 0); }
    setMood((m) => ({ kind, n: m.n + 1, line }));
    clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood((m) => ({ ...m, line: kind === 'beaten' || kind === 'gloat' ? m.line : null })), 2200);
  };
```

In the mount effect, change `sync` to also set the helpers' flag, and clean up on unmount:

```ts
    const media = matchMedia('(prefers-reduced-motion: reduce)'), sync = () => { motion.current = !media.matches; setMotion(motion.current); }; sync();
    media.addEventListener('change', sync);
    const pending = timers.current;
    return () => { media.removeEventListener('change', sync); pending.forEach(clearTimeout); clearTimeout(moodTimer.current); dropGhosts(); };
```

Greet when a round comes on screen (a new round, or a reload into one). Add after the mount effect:

```ts
  const roundKey = view === 'run' && run?.round && run.phase === 'round' ? `${run.seed}-${run.ante}-${run.blind}` : '';
  useEffect(() => { if (roundKey) react('enter'); }, [roundKey]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Keep the table up while the last hand counts.** In `playHand`, replace `setAnim({ score: s, cards, step: 0, total: false });` with

```ts
    const ended = r.phase !== 'round';
    setAnim({ score: s, cards, step: 0, total: false, landed: false, before: r.round!.score - s.total, ended });
```

and replace the last two `timers.current.push` lines with

```ts
    const T = 300 + s.steps.length * per + 120;
    timers.current.push(window.setTimeout(() => { setAnim((a) => (a ? { ...a, total: true } : a)); sound.cue('total'); }, T));
    timers.current.push(window.setTimeout(() => {
      setAnim((a) => (a ? { ...a, landed: true } : a));
      if (r.phase === 'cashout') react('beaten'); else if (r.phase === 'over') react('gloat');
    }, T + 450));
    timers.current.push(window.setTimeout(() => finishAnim(r, s), T + (ended ? 1700 : 900)));
```

After `const r = run, round = r.round, boss = r.bossFor(r.ante);` add `const stage = anim ? 'round' : r.phase;` and in the body chain replace `r.phase === 'pick'` with `stage === 'pick'`, `r.phase === 'round' && round` with `stage === 'round' && round`, `r.phase === 'cashout' && r.cash` with `stage === 'cashout' && r.cash`, `r.phase === 'shop' && r.shop` with `stage === 'shop' && r.shop`, `r.phase === 'pack' && r.pack` with `stage === 'pack' && r.pack`, `r.phase === 'victory'` with `stage === 'victory'`, `r.phase === 'over'` with `stage === 'over'`. In the final return, change `{r.phase === 'round' && counter}` to `{stage === 'round' && counter}` and `note && r.phase !== 'round'` to `note && stage !== 'round'`.

- [ ] **Step 6: The rival seat, the nut pile and Dora and Enzo.** Above `export default function AcornHandPage`, add:

```tsx
const MOOD_POSE: Partial<Record<Reaction, 'happy' | 'sad'>> = { enter: 'happy', gloat: 'happy', big: 'sad', beaten: 'sad' };
/** What is left of the target, as a pile of nuts that shrinks as the score climbs. */
function NutPile({ left }: { left: number }) {
  const ref = useRef<HTMLDivElement>(null), was = useRef(left);
  useLayoutEffect(() => {
    const from = boxOf(ref.current);
    for (let k = left; k < was.current; k++) if (from) toss('🌰', { ...from, h: 10 }, { x: from.x + (k % 2 ? 40 : -40), y: from.y - 70, w: 1, h: 1 }, (k - left) * 60);
    was.current = left;
  }, [left]);
  return <div className="ah-pile" ref={ref} data-testid="nut-pile" data-left={left} aria-label={`${left} of 10 nuts left to win`}>
    {Array.from({ length: left }, (_, i) => <span key={i} data-size={i % 3} aria-hidden="true">🌰</span>)}
  </div>;
}
function Pal({ who }: { who: 'dora' | 'enzo' }) {
  return <Paint w={72} h={72} sig={`pal-${who}`} draw={(c, w, h) => { c.clearRect(0, 0, w, h); fitDraw(c, `ah-pal-${who}`, 0, 0, w, h, (q) => drawChinchilla(q, who, 0, 0, { face: 1, h: 24, time: who === 'dora' ? 0.4 : 0.9 }), who === 'enzo' ? -1 : 1); }} />;
}
```

Inside the component, after `stage`, add:

```ts
  const pileLeft = round ? Math.max(0, Math.ceil(10 * (1 - shownScore / round.target))) : 0;
```

(`shownScore` is defined in Task 5; until then use `const shownScore = round ? (anim && !anim.landed ? anim.before : round.score) : 0;` placed just before this line. Task 5 replaces it with the ticker.)

In the round body, replace the opening of the table section and the played area with:

```tsx
    body = <section className="ah-table" data-testid="table" ref={tableRef}>
      {seat && <div className="ah-rival" data-testid="rival" data-rival={seat} data-mood={mood.kind}>
        <div className="ah-rival-art" ref={(el) => { rivalArt.current = el; }}><RivalArt rival={seat} pose={MOOD_POSE[mood.kind] ?? 'calm'} /></div>
        <div className="ah-rival-words">
          {r.blind === 2
            ? <div className="ah-sign" data-testid="boss-rule" {...tip(() => ({ title: boss.name, body: boss.text }))}><b>{boss.name}</b><span>{boss.text}</span></div>
            : <b className="ah-rival-name">{rivalName(seat)}</b>}
          {mood.line && <p className="ah-say" data-testid="rival-say" key={mood.n}>{mood.line}</p>}
        </div>
        <NutPile left={pileLeft} />
      </div>}
      <div className="ah-played" aria-label="Played cards" data-testid="played">
```

Add the portrait ref and the effect that plays each reaction next to the other refs, above the early `return` (like every hook in this plan):

```ts
  const rivalArt = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (mood.kind !== 'idle' && mood.kind in REACT) { const [frames, opts] = REACT[mood.kind as keyof typeof REACT]; play(rivalArt.current, frames, opts); } }, [mood.n]); // eslint-disable-line react-hooks/exhaustive-deps
```

Delete the `ah-boss-mini` line from `roundInfo`.

Put Dora and Enzo at the start of the actions row; replace `<div className="ah-actions">` with:

```tsx
      <div className="ah-actions">
        <div className="ah-pals" data-testid="pals" aria-hidden="true" data-mood={anim?.total ? (anim.ended && r.phase === 'over' ? 'sad' : 'cheer') : selected.length ? 'look' : 'calm'}><Pal who="dora" /><Pal who="enzo" /></div>
```

- [ ] **Step 7: Style the seat.** In `app/acorn-hand/acorn-hand.css`, replace the three `.ah-boss-mini` rules (and the two inside `@media (max-width: 560px)`) with:

```css
.ah-rival { display: grid; grid-template-columns: 140px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 112px; padding: 4px 8px; }
.ah-rival-art { animation: ah-breathe 3s ease-in-out infinite; transform-origin: 50% 90%; }
.ah-rival-art canvas { width: 140px; height: auto; display: block; }
.ah-rival[data-mood='beaten'] .ah-rival-art { filter: grayscale(.8) brightness(.8); }
.ah-rival-words { display: grid; gap: 6px; justify-items: start; min-width: 0; }
.ah-rival-name { font: 700 18px Georgia, serif; color: #ffb4a8; text-shadow: 0 1px 2px #000; }
.ah-sign { background: #3a1f2aee; border: 1px solid #b55a6a; border-radius: 10px; padding: 6px 10px; font-size: 13px; display: grid; gap: 2px; box-shadow: 0 3px 0 #0005; }
.ah-sign b { color: #ffb4a8; font: 700 16px Georgia, serif; }
.ah-say { position: relative; background: var(--paper); color: var(--paper-ink); border-radius: 14px; padding: 6px 12px; font-weight: 700; font-size: 15px; max-width: 320px; box-shadow: 0 4px 10px #0006; animation: ah-say .25s ease-out; }
.ah-say::before { content: ''; position: absolute; left: -8px; top: 50%; border: 8px solid transparent; border-right-color: var(--paper); border-left: 0; transform: translateY(-50%); }
.ah-pile { display: flex; flex-wrap: wrap-reverse; width: 96px; justify-content: center; gap: 0 2px; font-size: 20px; line-height: 1; }
.ah-pile span[data-size='1'] { font-size: 16px; }
.ah-pile span[data-size='2'] { font-size: 24px; }
.ah-pals { display: flex; gap: 2px; margin-right: auto; }
.ah-pals canvas { width: 56px; height: 56px; display: block; transition: transform .2s ease-out; }
.ah-pals[data-mood='look'] canvas { transform: translateY(-4px) rotate(4deg); }
.ah-pals[data-mood='cheer'] canvas { animation: ah-cheer .5s ease-out 2; }
.ah-pals[data-mood='sad'] canvas { transform: translateY(6px) scale(.94); filter: saturate(.6); }
@keyframes ah-breathe { 0%, 100% { transform: none; } 50% { transform: translateY(-3px) scale(1.015, .985); } }
@keyframes ah-say { from { transform: scale(.7); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ah-cheer { 0%, 100% { transform: none; } 40% { transform: translateY(-12px); } }
```

Inside `@media (max-width: 560px)` add:

```css
  .ah-rival { grid-template-columns: 56px minmax(0, 1fr) auto; min-height: 56px; gap: 8px; padding: 0; }
  .ah-rival-art canvas { width: 56px; }
  .ah-say { font-size: 12px; padding: 4px 8px; }
  .ah-sign { font-size: 11px; padding: 4px 6px; }
  .ah-sign b, .ah-rival-name { font-size: 13px; }
  .ah-pile { width: 40px; font-size: 13px; }
  .ah-pile span[data-size] { font-size: 13px; }
  .ah-pals { display: none; }
```

Change `.ah-actions` to `display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px;` (add `align-items: center`).

- [ ] **Step 8: Run the checks.** Run: `npm run typecheck && node tests/e2e/acorn-hand.mjs`. Expected: every check passes, including the new rival check and the boss check. If the `layout 360×640` check fails on fit, reduce `.ah-rival` gap and pile width at 560 px until it fits.

- [ ] **Step 9: Commit.**

```bash
git add app/acorn-hand/page.tsx app/acorn-hand/acorn-hand.css lib/acorn-hand-scene.ts tests/e2e/acorn-hand.mjs
git commit -m "Seat a reacting rival across the Acorn Hand table, and count the last hand on it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cards that deal, fly, flip and sweep away

**Files:**
- Modify: `app/acorn-hand/page.tsx`
- Modify: `app/acorn-hand/acorn-hand.css`
- Test: `tests/e2e/acorn-hand.mjs`

**Interfaces:**
- Consumes: `remember`, `settle`, `flip`, `fly`, `boxOf` from Task 2; `later`, `tableRef`, `deckRef` from Task 3; cues `flip`, `whoosh`.
- Produces: `trackCards(): void` in the page (remember card boxes now, settle after the next render, new cards from the deck); test id `deck-stack`; every hand card and played card carries `data-card-id`; each hand card has a `<span class="ah-back">`; the page's `main` sets `--back` to a data URL of the card back.

- [ ] **Step 1: Write the failing browser checks.** Add after the rival check:

```js
await check('cards deal from the deck, fly to the table and sweep away, leaving nothing behind', async (page) => {
  await fresh(page); await page.getByTestId('new-run').click(); await page.getByTestId('start').click();
  await page.getByTestId('deck-stack').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="card-7"]').getAnimations({ subtree: true }).length > 0);
  await setHand(page); await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click(); await page.getByTestId('play').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.ah-in-play')].some((c) => c.getAnimations().length > 0));
  await settled(page);
  assert.equal(await page.locator('[data-testid^="card-"]').count(), 8, 'ghost copies never count as hand cards');
  await page.getByTestId('card-7').click(); await page.getByTestId('card-6').click(); await page.getByTestId('discard').click();
  await page.waitForFunction(() => document.querySelectorAll('.ah-ghost').length > 0);
  await page.waitForFunction(() => document.querySelectorAll('.ah-ghost, .ah-toss, .ah-bit').length === 0, null, { timeout: 3000 });
  // Fast clicks during the deal still act at once.
  await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click();
  assert.equal(await page.evaluate(() => window.__acorn().selected.length), 2);
});

await check('a blocked card back still deals and plays', async (page) => {
  await page.route('**/art/acorn-hand/card-back.png*', (route) => route.abort());
  await fresh(page); await deal(page);
  await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page);
  assert.equal(await run(page, '(r) => r.round.plays'), 3);
});
```

- [ ] **Step 2: Run them to see them fail.** Run: `ONLY='cards deal' node tests/e2e/acorn-hand.mjs`. Expected: FAIL (no `deck-stack`).

- [ ] **Step 3: The card back as a CSS variable.** In the page, add `motion.ts` imports `remember, settle, flip, fly` to the motion import. Inside the component, after the `later` effect:

```ts
  const paintVersion = useSyncExternalStore(subscribeAcornPainting, acornPaintVersion, () => 0);
  const [backUrl, setBackUrl] = useState('');
  useEffect(() => {
    const cv = document.createElement('canvas'); cv.width = 150; cv.height = 210;
    drawCard(cv.getContext('2d')!, { id: -1, rank: 2, suit: 0, gloss: '' }, 150, 210, { down: true });
    try { setBackUrl(cv.toDataURL()); } catch { /* a tainted canvas: flips show the face only */ }
  }, [paintVersion]);
  /** Remember where the cards are; after the next render, glide them there and deal new ones from the deck. */
  const trackCards = () => { const from = remember(tableRef.current); later(() => settle(tableRef.current, from, boxOf(deckRef.current), { flipNew: true })); };
```

Replace the existing bare `useSyncExternalStore(subscribeAcornPainting, acornPaintVersion, () => 0);` line with nothing (the new `paintVersion` line keeps the subscription). On the final `<main className="ah-shell" … data-phase={r.phase}>`, add `style={backUrl ? { '--back': `url(${backUrl})` } as React.CSSProperties : undefined}`.

- [ ] **Step 4: Mark cards and add the deck stack.** In the hand map, change the card `<button key={id} className="ah-card" …>` to include `data-card-id={id}`, and put `<span className="ah-back" aria-hidden="true" />` right after `<CardArt … />`. In the played map, add `data-card-id={c.id}` to the `ah-in-play` div. At the end of `.ah-actions`, after the Sort button, add:

```tsx
        <div className="ah-deck" data-testid="deck-stack" ref={deckRef} aria-label={`${round.draw.length} cards left in the deck`}>
          <Paint w={60} h={84} sig="deck" draw={(c, w, h) => drawCard(c, { id: -1, rank: 2, suit: 0, gloss: '' }, w, h, { down: true })} /><span>{round.draw.length}</span>
        </div>
```

- [ ] **Step 5: Track every action that moves cards.**
  - Start of a round, in the pick body's `start` button: `onClick={() => { trackCards(); r.start(); resort(r); act(true, isBoss ? 'boss' : 'deal'); sound.cue('flip'); }}`.
  - `playHand`: call `trackCards();` right after `handBefore.current = …`.
  - `finishAnim`: at its top, before `setAnim(null)`:

    ```ts
    document.querySelectorAll('.ah-in-play').forEach((el, i) => fly(el, 'away', { delay: i * 40, spin: 20, drop: -30, duration: 360 }));
    if (r.phase === 'round') { trackCards(); sound.cue('whoosh'); }
    ```

  - `discard`: before `const ok = r.discard(selected);`:

    ```ts
    selected.forEach((id, i) => fly(document.querySelector(`[data-card-id="${id}"]`), 'away', { delay: i * 40, spin: 35, fade: true, drop: 140 }));
    trackCards(); sound.cue('whoosh');
    ```

  - `sortHand`: call `trackCards();` before `r.sort(by)`.
  - `applyItem`: call `trackCards();` before `const it = r.items[slot], ok = …`.

- [ ] **Step 6: Flip a card when its face is revealed.** Inside the component, after `trackCards`:

```ts
  const wasDown = useRef(new Set<number>());
  useLayoutEffect(() => {
    const hand = runRef.current?.round?.hand ?? [], now = new Set(hand.filter((id) => runRef.current!.hidden(id)));
    for (const id of wasDown.current) if (!now.has(id) && hand.includes(id)) { const el = document.querySelector(`[data-card-id="${id}"]`); if (el) { flip(el); sound.cue('flip'); } }
    wasDown.current = now;
  });
```

- [ ] **Step 7: CSS for the back, the deck and a springier pick.** In `acorn-hand.css`:
  - Change the `.ah-shell .ah-card` rule's `transition: transform .14s ease-out;` to `transition: transform .22s cubic-bezier(.2,1.6,.4,1);`.
  - Change `.ah-shell .ah-card[data-selected='true'] { transform: translateY(-18px); …` to `transform: translateY(-20px) rotate(-2deg); …` (keep the filters).
  - Add:

```css
.ah-back { position: absolute; inset: 0; border-radius: 10px; background: var(--back, #3a2448) center / 100% 100%; opacity: 0; pointer-events: none; }
.ah-deck { position: relative; margin-left: auto; width: 48px; filter: drop-shadow(2px 3px 0 #0006) drop-shadow(2px 3px 0 #0004); }
.ah-deck canvas { width: 48px; height: auto; display: block; }
.ah-deck span { position: absolute; right: -6px; bottom: -6px; background: #120c08e6; color: var(--gold); border-radius: 8px; padding: 1px 6px; font-weight: 800; font-size: 12px; }
```

  - Inside `@media (max-width: 560px)` add `.ah-deck { width: 30px; } .ah-deck canvas { width: 30px; }` and change `.ah-actions button { min-width: 0; flex: 1; … }` so the deck keeps its size: add `.ah-actions .ah-deck { flex: none; }`.

- [ ] **Step 8: Run the checks.** Run: `npm run typecheck && node tests/e2e/acorn-hand.mjs`. Expected: all pass, including both new checks and the six layouts.

- [ ] **Step 9: Commit.**

```bash
git add app/acorn-hand/page.tsx app/acorn-hand/acorn-hand.css tests/e2e/acorn-hand.mjs
git commit -m "Deal, fly, flip and sweep Acorn Hand's cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Scoring that lands, and the cash-out

**Files:**
- Modify: `app/acorn-hand/page.tsx`
- Modify: `app/acorn-hand/acorn-hand.css`
- Test: `tests/e2e/acorn-hand.mjs`

**Interfaces:**
- Consumes: `useTicker`, `play`, `shake`, `fly`, `toss`, `boxOf`, `WIGGLE`, `POP`, `PUNCH`, `FLARE` from Task 2; `react`, `later`, the refs and `Anim.landed/before/ended` from Task 3; `BIG_HAND` from Task 1.
- Produces: `shownScore` (replacing Task 3's stand-in); test id `banner`; charm pop-ups render inside the charm slot.

- [ ] **Step 1: Write the failing browser checks.** Add after the card checks, and extend the reduced-motion check:

```js
await check('a charm wiggles when it scores, the hand name crosses the table, and the score counts up', async (page) => {
  await fresh(page); await deal(page); await setHand(page);
  await run(page, '(r) => { r.charms = [{ id: "dora", state: 0 }]; }');
  await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click(); await page.getByTestId('play').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="charm-0"]').getAnimations({ subtree: true }).length > 0);
  await page.getByTestId('banner').waitFor(); assert.match(await page.getByTestId('banner').innerText(), /Pair/);
  await settled(page);
  assert.equal(await page.getByTestId('score').innerText(), String((10 + 10 + 10) * (2 + 4)), 'the score lands exactly');
});
```

In `'reduced motion scores at once'`, add at the end:

```js
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'nothing animates, not even the rival');
  await page.getByTestId('card-0').click(); await page.getByTestId('discard').click();
  assert.equal(await page.evaluate(() => document.querySelectorAll('.ah-ghost').length), 0);
```

- [ ] **Step 2: Run to see them fail.** Run: `ONLY='charm wiggles' node tests/e2e/acorn-hand.mjs`. Expected: FAIL waiting for the charm animation.

- [ ] **Step 3: Tick the counters and the score.** Replace Task 3's stand-in `shownScore` line with:

```ts
  const shownScore = useTicker(round ? (anim && !anim.landed ? anim.before : round.score) : 0, !!anim, 450);
```

Hooks must run on every render, so put the tickers above the early `return` for the title view, computed from `run?.round`; `pileLeft` stays where it is and now reads the ticker:

```ts
  const liveRound = run?.round ?? null;
  const shownScore = useTicker(liveRound ? (anim && !anim.landed ? anim.before : liveRound.score) : 0, !!anim, 450);
  const shownChips = useTicker(anim ? anim.score.steps[anim.step].chips : 0, !!anim);
  const shownMult = useTicker(anim ? anim.score.steps[anim.step].mult : 0, !!anim);
  const purse = useTicker(run?.nuts ?? 0, view === 'run', 600);
```

In the counter, use `fmt(shownChips)` for the chips during `anim` and, for the mult, `fmtMult(Number.isInteger(shownStep!.mult) ? Math.round(shownMult) : Math.round(shownMult * 10) / 10)`; add `ref={chipsRef}` and `ref={multRef}` to the two outputs. In `roundInfo`, show `fmt(shownScore)` in `score` and add `ref={scoreRef}`; add `ref={progressRef}` to the `<progress>` and set `value={Math.min(shownScore, round.target)}`. In the header purse use `🌰 {fmt(purse)}` and add `ref={purseRef}`.

- [ ] **Step 4: Juice each step.** In `playHand`'s step loop, replace the body of each step timer with:

```ts
      setAnim((a) => (a ? { ...a, step: i } : a));
      sound.cue(st.who === 'boss' ? 'sleep' : st.text.includes('×') ? 'times' : st.text.includes('mult') ? 'mult' : 'chip', Math.min(12, i), 1, 0.02);
      const prev = s.steps[i - 1];
      if (prev && prev.chips !== st.chips) play(chipsRef.current, POP, { duration: 200 });
      if (prev && prev.mult !== st.mult) play(multRef.current, st.text.includes('×') ? PUNCH : POP, { duration: st.text.includes('×') ? 360 : 200 });
      if (st.who === 'charm' || st.who === 'held') { const k = r.charms.findIndex((o) => o.id === st.ref); play(document.querySelector(`[data-testid="charm-${k}"] .ah-charm-face`), WIGGLE, { duration: 520 }); }
      if (st.who === 'boss') react('rule');
```

In the `T` timer (the total), after `sound.cue('total');` add:

```ts
      const share = s.total / Math.max(1, r.round!.target);
      react(share >= BIG_HAND ? 'big' : 'hit');
      if (share >= BIG_HAND) shake(tableRef.current, share);
```

In the `T + 450` timer, before the `react` calls, add:

```ts
      fly(totalRef.current, boxOf(scoreRef.current) ?? 'away', { fade: true, duration: 420 });
      if (r.phase === 'cashout') play(progressRef.current, FLARE, { duration: 900 });
```

Import `BIG_HAND` from the banter module and `useTicker, shake, WIGGLE, POP, PUNCH, FLARE` from `./motion`.

- [ ] **Step 5: The banner, the total and charm pop-ups.** In the counter, change the total to render only until it lands: `{anim?.total && !anim.landed && <p className="ah-total" data-testid="hand-total" ref={totalRef}>{fmt(anim.score.total)}</p>}`. In the table section, right after the rival seat, add:

```tsx
      {anim?.total && <div className="ah-banner" data-testid="banner" aria-hidden="true">{handById(anim.score.hand).name} · lvl {anim.score.level}</div>}
```

In `charmsRow`, inside each owned charm's `<div className="ah-charm" …>`, after the face button, add:

```tsx
          {anim && shownStep && (shownStep.who === 'charm' || shownStep.who === 'held') && shownStep.ref === o.id && <span className="ah-pop" data-testid="pop">{shownStep.text}</span>}
```

(`shownStep` is declared further down; move `const shownStep = anim ? anim.score.steps[anim.step] : null;` above `charmsRow`.) In the played area, change the wide pop's condition to show only for boss steps: `shownStep.who === 'boss'`.

The existing check `'a round by mouse'` asserts `hand-total` text; the total still renders from `total` until `landed` (450 ms), so `waitFor` still sees it.

- [ ] **Step 6: Cash-out nuts fly to the purse.** In the cash-out body, change the collect button's `onClick` to:

```tsx
onClick={() => {
  const last = r.blind === 2 && r.ante === ANTES && !r.endless, to = boxOf(purseRef.current);
  document.querySelectorAll('.ah-cash b').forEach((b, i) => { toss('🌰', boxOf(b), to, i * 120); timers.current.push(window.setTimeout(() => sound.cue('coin', i), i * 120 + 450)); });
  act(r.collect(), last ? 'victory' : 'coin');
}}
```

- [ ] **Step 7: CSS.** Add:

```css
.ah-charm { position: relative; }
.ah-banner { position: absolute; left: 0; right: 0; top: 40%; z-index: 5; text-align: center; font: 900 clamp(22px, 4vw, 40px) Georgia, serif; color: var(--gold); text-shadow: 0 3px 0 #0008, 0 0 18px #000; pointer-events: none; animation: ah-banner 1.1s ease-out both; }
.ah-table { position: relative; }
.ah-shell .ah-in-play { transition: transform .22s cubic-bezier(.2,1.6,.4,1), filter .2s; }
.ah-in-play[data-lit='true'] { transform: translateY(-18px) scale(1.1); filter: drop-shadow(0 0 10px #f2c45a) drop-shadow(0 4px 4px #0006); }
.ah-pop { animation: ah-rise .5s ease-out both; }
@keyframes ah-banner { 0% { transform: translateX(-30%) scale(.8); opacity: 0; } 25% { transform: none; opacity: 1; } 75% { transform: none; opacity: 1; } 100% { transform: translateX(20%); opacity: 0; } }
@keyframes ah-rise { from { transform: translate(-50%, 8px) scale(.6); opacity: 0; } 40% { transform: translate(-50%, -4px) scale(1.1); opacity: 1; } to { transform: translate(-50%, -10px) scale(1); opacity: 1; } }
```

and delete the old `.ah-in-play[data-lit='true'] { transform: translateY(-14px) scale(1.06); }` rule.

- [ ] **Step 8: Run all browser checks and the Node suite.** Run: `npm run typecheck && npm test && npm run test:e2e:acorn-hand`. Expected: all pass. If `'a round by mouse'` fails reading `score` as `100`, check the score ticker is inactive once `anim` is null (it returns `value` exactly).

- [ ] **Step 9: Commit.**

```bash
git add app/acorn-hand/page.tsx app/acorn-hand/acorn-hand.css tests/e2e/acorn-hand.mjs
git commit -m "Make Acorn Hand's scoring land: wiggling charms, counters, a banner, shake and flying nuts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The shop moves

**Files:**
- Modify: `app/acorn-hand/page.tsx`
- Test: `tests/e2e/acorn-hand.mjs`

**Interfaces:**
- Consumes: `remember`, `settle`, `fly`, `burst`, `emerge`, `play`, `boxOf`, `STAMP`, `FLIP_IN` from Task 2; `later`, `mainRef`, `purseRef` from Task 3; cue `tear`.
- Produces: `trackFly(): void` in the page; `data-fly` on shop charm and item art, pack charm options, charm slot faces and item slot icons.

- [ ] **Step 1: Write the failing browser check.** Add after the scoring check:

```js
await check('the shop moves: packs burst open, bought charms fly to their slot, rerolls flip', async (page) => {
  await fresh(page); await deal(page); await run(page, '(r) => { r.round.target = 1; }');
  await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page);
  await page.getByTestId('collect').click(); await page.getByTestId('shop').waitFor();
  await run(page, '(r) => { r.nuts = 200; r.shop.packs = ["charm", "card"]; }');
  await page.getByTestId('buy-charm-0').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="charm-0"]').getAnimations({ subtree: true }).length > 0);
  await page.getByTestId('reroll').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="offer-charm-0"]').getAnimations({ subtree: true }).length > 0);
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.ah-bit').length > 0 || document.querySelector('[data-testid="pack-option-0"]').getAnimations().length > 0);
  await page.getByTestId('skip-pack').click(); await page.getByTestId('shop').waitFor();
  await page.getByTestId('sell-0').click(); assert.equal(await run(page, '(r) => r.charms.length'), 0, 'selling still sells at once');
});
```

- [ ] **Step 2: Run to see it fail.** Run: `ONLY='shop moves' node tests/e2e/acorn-hand.mjs`. Expected: FAIL waiting for the charm-slot animation.

- [ ] **Step 3: Mark what can fly.** Add `ref={mainRef}` to `<div className="ah-main">`. Add `data-fly={`charm-${id}`}` to the shop charm offer's art wrapper `<div {...tip(charmTip(id, undefined, r.priceOf(id)))}>`, to the pack charm option's art wrapper in `packOption`, and `data-fly={`charm-${o.id}`}` to the charm slot's `.ah-charm-face` button. Add `data-fly={`item-${it.kind}-${it.id}`}` to the shop item's `ah-item-big` div and to the item slot's `ah-item-icon` span. Inside the component, next to `trackCards`:

```ts
  /** Remember where charms and items are; after the next render, glide anything that moved, such as a bought charm into its slot. */
  const trackFly = () => { const from = remember(mainRef.current, 'data-fly'); later(() => settle(mainRef.current, from, null, { attr: 'data-fly' })); };
```

- [ ] **Step 4: Wire the shop actions.**
  - Buy charm: `onClick={() => { trackFly(); act(r.buyCharm(i), 'buy'); }}`.
  - Buy item: `onClick={() => { trackFly(); act(r.buyItem(i), 'buy'); }}`.
  - Take from a pack (`takeOption`): call `trackFly();` before `const ok = r.takePack(i, selected);`, and for a card pack fly the option down before taking it:

    ```ts
    if (packById(r.pack.id)!.kind === 'card') fly(document.querySelector(`[data-testid="pack-option-${i}"] canvas`), { x: innerWidth / 2, y: innerHeight + 40, w: 20, h: 28 }, { fade: true, duration: 500 });
    ```

  - Buy voucher: `onClick={() => { act(r.buyVoucher(), 'buy'); later(() => { play(document.querySelector('[data-testid="offer-voucher"]'), STAMP, { duration: 360 }); play(document.querySelector('[data-testid="vouchers"] span:last-child'), STAMP, { duration: 360 }); }); }}`.
  - Reroll: `onClick={() => { act(r.reroll(), 'reroll'); later(() => document.querySelectorAll('[data-testid^="offer-charm-"] canvas').forEach((c, k) => play(c, FLIP_IN, { duration: 300, delay: 80 * k }))); }}`.
  - Sell: `onClick={() => { fly(document.querySelector(`[data-testid="charm-${i}"] .ah-charm-face`), boxOf(purseRef.current) ?? 'away', { fade: true, duration: 520 }); act(r.sell(i), 'sell'); }}`.
  - Open a pack:

    ```tsx
    onClick={(e) => {
      const from = boxOf(e.currentTarget.closest('article')), tint = { charm: '#e9a23b', almanac: '#5aa64a', treat: '#c6405a', card: '#7a8ca8' }[t.kind];
      setSelected([]);
      if (act(r.openPack(i), 'deal')) { burst(from, tint); sound.cue('tear'); later(() => emerge(document.querySelectorAll('[data-testid^="pack-option-"]'), from)); }
    }}
    ```

  Import `burst, emerge, STAMP, FLIP_IN` from `./motion`.

- [ ] **Step 5: Run all checks.** Run: `npm run typecheck && node tests/e2e/acorn-hand.mjs`. Expected: all pass, including the existing vouchers-and-packs check (actions still take effect at once).

- [ ] **Step 6: Commit.**

```bash
git add app/acorn-hand/page.tsx tests/e2e/acorn-hand.mjs
git commit -m "Move Acorn Hand's shop: bursting packs, flying charms, stamped vouchers, flipping rerolls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Layout checks, pose prompts, docs and the full run

**Files:**
- Modify: `tests/e2e/acorn-hand.mjs` (layout loop)
- Modify: `docs/acorn-hand-suit-prompts.md`
- Modify: `docs/acorn-hand.md`, `README.md` (Acorn Hand guide), `HANDOFF.md`, `CHANGELOG.md`, `docs/acorn-hand-art.md`

**Interfaces:**
- Consumes: everything above.
- Produces: docs only, and stronger layout checks.

- [ ] **Step 1: Extend the layout checks.** In the six-layout loop, after `assert.ok(play.x >= 0 && …)`, add:

```js
    const seat = await page.getByTestId('rival').boundingBox(), deck = await page.getByTestId('deck-stack').boundingBox(), hand = await page.getByTestId('hand').boundingBox();
    assert.ok(seat && seat.x >= 0 && seat.x + seat.width <= width + 1, 'the rival strip is on screen');
    assert.ok(deck && deck.x + deck.width <= width + 1, 'the deck is on screen');
    assert.ok(seat.y + seat.height <= hand.y + 1, 'the rival sits above the hand');
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    assert.ok(!overlap(deck, play), 'the deck does not cover the play button');
```

Run: `node tests/e2e/acorn-hand.mjs`. Expected: all pass; open `.checks/acorn-hand/table-360x640.png` and `table-1920x1080.png` and look at them. Fix spacing in CSS if anything crowds.

- [ ] **Step 2: Add the reaction-pose prompts.** Append to `docs/acorn-hand-suit-prompts.md` a section `## Rival reaction poses` saying: the game already plays motion for each reaction and will use painted poses when these files exist; files `rivals-0-happy.png`, `rivals-1-happy.png`, `rival-armadillo-happy.png` and the same three with `-sad`, saved in `public/art/acorn-hand/`; same grids and cell order as `rivals-0.png` (fox, owl, hawk, snake, badger, skunk), `rivals-1.png` (weasel, mole, bear, cougar, beetle, lizard) and `rival-armadillo.png`; attach the matching calm sheet as the reference so each rival keeps its look and size; the prompt for happy (smug grin, card fan raised, eyes bright) and sad (ears down, slumped, card fan drooping), same framing, all facing left, transparent, no text; and the integration note: measure crops into `lib/acorn-hand-crops.ts` under the keys `rivals-0-happy` etc., which `drawRival` looks up.

- [ ] **Step 3: Docs.**
  - `CHANGELOG.md`, under `## 15-10-2026`, **Added**: "**Acorn Hand** feels alive: a rival sits across the table every round, reacting to your discards and big hands and taunting in their own voice, with a pile of nuts that shrinks as you close in on the target; cards deal from the deck, flip, fly to the table and sweep away; charms wiggle as they score, the counters tick up, the hand's name crosses the table and big hands shake it; nuts fly to your purse at cash-out; packs burst open and bought charms fly to their slot. The hand that wins or loses a round now plays out on the table before the cash-out. Reduced motion turns it all off." Under **Documentation**: "A ChatGPT handoff for clearer **Acorn Hand** suit pips and rival reaction poses."
  - `docs/acorn-hand.md`: a short **Table and motion** section: who sits across the table (`tableRival`), the reactions table from the spec, the nut pile formula, that motion lives in `app/acorn-hand/motion.ts` and turns off under reduced motion, and that banter lives in `lib/acorn-hand-banter.ts`.
  - `README.md`, Acorn Hand guide **Play:** paragraph: one sentence about the rival at the table and the nut pile; **Tests:** paragraph: mention the banter checks and the motion checks.
  - `HANDOFF.md`: in the Acorn Hand section, record the game-feel pass, the pose sheets still to make, and fix the stale "bot wins 23%" to 33%.
  - `docs/acorn-hand-art.md`: link `acorn-hand-suit-prompts.md`.

- [ ] **Step 4: The full run.** Run: `npm run typecheck && npm test && npm run build && npm run test:e2e:acorn-hand`. Expected: all pass. Then play two rounds and a shop by hand at 1280×860 and 390×844 (Playwright screenshots are fine), and with `prefers-reduced-motion`.

- [ ] **Step 5: Commit.**

```bash
git add tests/e2e/acorn-hand.mjs docs/acorn-hand-suit-prompts.md docs/acorn-hand.md README.md HANDOFF.md CHANGELOG.md docs/acorn-hand-art.md docs/superpowers/specs/15-10-2026-acorn-hand-game-feel-design.md docs/superpowers/plans/15-10-2026-acorn-hand-game-feel-plan.md
git commit -m "Document Acorn Hand's game-feel pass and the suit and pose prompts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

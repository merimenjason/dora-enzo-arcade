# Handover for Codex: the arcade's magnum opus

Written 09-11-2026 for Codex (or anyone) building one new flagship game for Dora & Enzo's Arcade. Read it in full
before writing any code. The paste-in prompt is at the end.

## The goal

One original game that is clearly the best thing in the arcade: deeper than **Sunken Bellspire**
(`/bellspire`, the current flagship), and as polished as its Night Orchard. One game, not several. Depth beats breadth.

## What went wrong before, and why

These are the failures this handover exists to prevent. Each one passed its own tests.

1. **Faultline Rescue, The Night Wire and The Second Show (removed 09-11-2026).** Three games were built where one was
   asked for, all on one shared template: a 3×3 board of nine spots, a list of text buttons per hero and an "advance
   the turn" button. Each "mission" was one table row (a title, a sentence and six numbers). Players could not tell
   how to play, even after the board was made clickable with a step-by-step guide, because the game itself was a dry
   abstract puzzle with no direct control. The pitch-and-wait step in the prompt was skipped, and the pull request was
   merged (which deploys) without review. All three were removed the next day.
2. **The Salt Road (Bellspire expansion, 08-11-2026).** Its rooms came from a procedural `buildRoom()` that made flat
   boxes; the only mechanic was one lift used three times; the lower galleries were near-black because their dark
   stone vanished under dark-room lighting. It needed a polish pass to be shippable.
3. **What went right: the Night Orchard (09-11-2026).** Every room is hand-drawn as string rows, the art is painted in
   the castle's style, both heroes matter in every guardian fight, and the author measured 26 jump windows per hero
   with simulated human input. That is the working standard.

Lessons, in one line each:

- Tests prove the rules; only screenshots and human-timed simulation prove the game is good.
- If a player needs to read a manual, the core interaction is wrong. They should learn by doing in the first minute.
- A table of numbers is not content. A level someone laid out by hand is.
- Never merge your own pull request, and never push to `main`: pushing `main` deploys to the live site.

## The repo, briefly

- Live at https://chinchillas.jason.engineering. Read `CLAUDE.md`, `AGENTS.md`, `README.md` (especially **Adding a
  game**) and `HANDOFF.md`. Unbuilt ideas: `docs/game-ideas.md`.
- Every game splits three ways: `lib/<name>-game.ts` (deterministic engine, seeded randomness, no DOM),
  `lib/<name>-scene.ts` (drawing only) and `app/<route>/page.tsx` (input, loop, saving, HUD). Expose the running
  game as `window.__<name>()` and mark `main[data-ready="true"]` once hydrated.
- `npm test` compiles engines with `tsc` into `.checks/`, so a new engine joins both the `tsc` list and the `node`
  list of the `test` script, and gets its own `test:<name>` and `bot:<name>` scripts.
- Saves go in `localStorage` under a versioned key (`<name>-v1`); bump the version when the format changes.
- Browser tests use Playwright (install it with `npm i -D playwright`, never commit that). Build with
  `npm run build`, serve with `npx vinext start --port 3109`, and point tests at it with `BASE_URL`.
- Match the hand-formatted style of each file; never run `oxfmt` across the repo. Markdown dates are dd-mm-yyyy.
- Stage files by name, never `git add -A` (stray mock-ups and an embedded repo were once pushed to this public repo).

### Patterns worth copying from Bellspire

- **Engine-driven prompts** (`echoHint`, `frostHint`, `ventHint`, `founderHint` in `lib/bellspire-game.ts`, shown by
  the page with the player's own key bindings): the game tells you the next thing to try, at the moment it matters.
- **Shared geometry** between the game and its bot planner (`crystalSpans` in `lib/bellspire-world.ts`, used by
  `lib/bellspire-nav.ts`), so a bot never plans a move the game does not allow.
- **Measured jump windows**: `measureJumps` in `tests/bellspire-orchard.mjs` sweeps take-off points for both heroes
  and fails anything under 16 px.
- **The art pipeline**: prompts in `docs/bellspire-art/`, sheets painted on flat magenta or green, then
  `scripts/bellspire-art.py` keys, downscales, palette-snaps, outlines and packs them. Write the equivalent for the
  new game; never draw stand-in shapes.

## Hard rules (breaking any one gets the work rejected)

1. Work on a new branch in a fresh worktree off `origin/main`. Never push to `main`. Never merge a pull request:
   open it and stop.
2. Stop after Phase 1 and wait for the owner to choose a pitch.
3. A new, purpose-built engine, scene and page. Do not build a shared multi-game template. Shared helpers (save
   utilities, `drawChinchilla`) are fine.
4. Original: familiar genres and mechanics are fine, but no recreation of an existing commercial game (its names,
   characters, levels or look). Cast characters who fit the world; don't default to the Grumbles.
5. Don't touch other games, apart from the README, `GAMES` in `app/page.tsx` and the hardcoded counts.

## Phase 1: three pitches, then stop

For each pitch:

- the hook, the core verb (what your hands do every second), and the loop at 10 seconds, 10 minutes and a whole run;
- how Dora (cream-white fur) and Enzo (grey fur) play differently, and why switching between them matters;
- how a new player learns it in the first minute without reading anything;
- the content plan against the floor below, and why it isn't just Bellspire again;
- two painted mock-ups: one of moment-to-moment play, one of a boss or set piece.

## Content floor

- Real-time or action play (menus and text buttons are never the main interaction), or a tactics or puzzle game
  whose board is animated and directly manipulated.
- At least 6 areas, each with its own tileset, music mood, enemies and mechanic.
- At least 40 hand-authored levels or rooms. No procedural or table-row levels; each one introduces or remixes
  something.
- At least 10 enemy types with their own behaviours, and at least 5 bosses. Every boss needs both heroes, has phases
  and gives readable tells.
- Progression that opens old areas or changes how you play; at least 20 optional secrets; an ending; a post-game
  challenge.
- Roughly 3+ hours for a first clear by an ordinary player.

If it doesn't fit in one run, finish areas 1–2 to full quality and stop there, rather than spread thin across six.

## Craft

- Write a palette and style guide first, then paint every sheet. Heroes are large and expressive on screen.
- Every action has its own animation: idle, run, jump, land, climb, hurt, interact, each ability, victory.
- Dora and Enzo get outfits for this world, and no signature items.
- Juice: hit pauses, particles, screen shake, layered parallax, lighting, and tasteful sound and music.
- Engine-driven prompts showing the player's own keys; assist mode on by default (earlier games shipped too hard
  for humans).
- Keyboard, touch (works at 390×844) and gamepad.

## Proof (the numbers go in the pull request)

1. **Screenshots.** Every level, menu and boss at 1280×800 and 390×844, in contact sheets beside a Night Orchard
   screenshot. Redesign anything empty, flat, dark or unreadable, and say what you changed.
2. **Fairness.** Bots with 200–300 ms reaction delays and imperfect input. Every jump or timing challenge swept for
   both heroes from take-off points 4 px apart; report the windows, and treat anything under 16 px (or 6 frames) as
   a failure. Report clear rates per difficulty; a casual player must clear area 1 easily.
3. **Every action in a browser.** Press every player action, button and menu item with real keys or taps at
   1280×800, 844×390 and 390×844. A control that does nothing is a failure (one game once shipped with a dead Train
   button).
4. **First-minute test.** Record what a new player sees and does in the first 60 seconds, as a screenshot sequence.
   If it needs a wall of text to explain, redesign it.
5. **Must all pass:** `npm run typecheck`, `npm test`, `npm run build`, and your engine, bot and browser suites.
6. **Honesty.** Say what is weakest and what you would cut. Claim nothing you didn't measure.

## Ship-ready, as a pull request only

The **Adding a game** checklist in full; `test:` and `bot:` scripts; `docs/<name>.md`; a `CHANGELOG.md` entry under
a dd-mm-yyyy heading; a `HANDOFF.md` section. Open the pull request and stop.

## The prompt to paste into Codex

```
Read docs/codex-magnum-opus.md in /Users/jasonchua/repos/dora-enzo-arcade and follow it exactly. Build ONE game, the
arcade's magnum opus. Start with Phase 1: three pitches with two painted mock-ups each, then STOP and wait for me to
choose. Never push to main and never merge a pull request.
```

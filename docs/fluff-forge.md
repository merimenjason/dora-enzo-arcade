# Fluff Forge

A Mario Maker-style course builder: make a side-scrolling course out of parts, clear it yourself, and share it as a code. Rules live in `lib/fluff-forge-game.ts` (deterministic, no DOM), the Canvas 2D drawing in `lib/fluff-forge-scene.ts`, and the page in `app/fluff-forge/`. Numbers below come from the engine's constants.

## Courses

A `Course` is `{ title, theme, cols, time, tiles }`. `tiles` is a string of one-character parts, `ROWS` (15) tall and `cols` wide, stored column by column, so `index(c, r)` is `c * ROWS + r` and row 0 is the top of the screen. `PARTS` lists every character with its name, palette group and hint; `.` is empty. `U` is a spent prize block: it only exists during play and can't be placed.

`paint()` is the one way the editor changes a course. It returns the same object when nothing changes, which is what lets the page skip empty undo steps, and it keeps start (`@`) and goal (`G`) unique by clearing the old one first. `resize()` clamps to `MIN_COLS`..`MAX_COLS` (25 to 240), fills new columns with two rows of ground and moves the goal back inside when shrinking past it. `problems()` returns what stops a course from being played, in words for the maker.

`design()` is a pen for laying courses out in code (`ground`, `pit`, `pillar`, `row`, `fill`, `put`). The four `STARTERS` are drawn with it rather than as ASCII art, which kept every row the same length.

## Share codes

`encodeCourse()` writes `FLUFF-` plus URL-safe base64 of a small JSON record. The tiles go through `pack()`: each column is run-length encoded, and a run of identical columns is written once as `count*column`, with `|` between columns. Flat stretches cost almost nothing, so the starters come out at 580 to 790 characters. `decodeCourse()` ignores whitespace (codes survive being wrapped in a chat), rejects anything that isn't a complete playable course (bad prefix, bad base64, unknown part, wrong size, no start or goal) and falls back to defaults for an unknown theme, timer or blank title.

## The clear check

As in Mario Maker, a course can't be shared until its maker has cleared it. The page stores `cleared` on each saved course as the course's own code at the moment it was cleared from its start. The course counts as cleared while `cleared === encodeCourse(course)`, so any edit, including a title change, locks the share button again, and undoing back to the cleared version unlocks it. **Test from here** moves the start to the left edge of the view (`withStartAt()` in the page) and marks the run as practice, which never counts.

## Play

`FluffForgeGame` steps at a fixed 1/120 s. `build()` lays the course out fresh on every try: enemies, drifting clouds, checkpoints, the goal and the start become objects, and their characters are cleared from `tiles`. A try ends through `die()`: the hero pops up and falls, and 1.5 s later `build()` runs again from the last checkpoint with the clock reset. Raisins and raisin blocks cashed in before that checkpoint are recorded in `spent` when it is touched, so a restart can't pay them twice.

Movement is the usual platformer recipe. `HEROES` sets walk, run and jump speed per chinchilla. Rising with jump held uses gravity 950; everything else uses 1,900, which is what makes the jump variable. A jump pressed up to 0.1 s early is buffered and one pressed up to 0.08 s after stepping off a ledge still counts. A running jump adds 12% of your speed to the take-off. Ice cuts acceleration to 160 and friction to 80. Tiles collide axis by axis. Cloud ledges and springs only stop you from above, and holding down on a ledge sets `drop` for 0.2 s to fall through. A drifting cloud's `dx` is added to a hero riding it (`ride`) before they move.

Bumping from below goes through `bump()`: `?` pays a raisin, `C` and `F` release a clover or feather that rises out of the block, `B` breaks only for a powered-up hero, and any enemy standing on the bumped tile is flipped away. Power-ups grow the hero from 14 to 24 pixels tall. A hit while powered shrinks them with 1.5 s of safety (`hurt`), and spikes also knock you upward so you're not left standing on them.

Enemies wake when they come within three quarters of a screen of the camera, then stay awake. A stomp is a hit from above while falling with your previous bottom edge no lower than 6 pixels into the enemy; it bounces you 220 pixels a second, or 340 with jump held. Prickles can't be stomped.

`clone()` copies everything the step touches, which is what the bot's search relies on.

## The bot

`tests/fluff-forge-bot.mjs` is a beam search over the real engine. Every 0.1 s each kept run branches into nine button combinations. Runs that die are dropped, runs that end in the same place and state are merged, and the 60 furthest along are kept. It proves each starter can be cleared by both heroes without dying, typically in 10 to 14 seconds of game time. Run it on one course with `node tests/fluff-forge-bot.mjs <starter id>` after compiling, or widen the beam with `BEAM=200`.

## Drawing

`drawGame()` draws the backdrop, the visible tiles, lifts, flags, goal, items, enemies, the tag, the hero and effects, then the HUD. Each theme's backdrop has its own layers at different parallax speeds: meadow mountains, rolling hills with trees and flowers; salt-flat mesas over a mirror band and salt-crust hexagons; cave stalactites, glowing crystal clusters and drifting spores; snow peaks, two rows of pines and near and far snowfall. The bottom of every backdrop is darkened so a pit reads as a drop. Tiles look at their neighbours: open ground gets grass, salt crust, moss or a snow cap, exposed sides get a darker edge, and textures come from `hash()` so they don't shimmer as the camera moves. `drawEditor()` draws the raw course, with enemies, markers and drifting clouds shown where they were placed, a grid, a red line at the course's right edge and a ghost of the selected part under the cursor. Prize blocks all look like `?` blocks in play, and in the editor clover and feather blocks carry a small badge.

`chinchilla()` draws Dora or Enzo at any height, which is how the small and big sizes, the HUD portrait and the menu art share one drawing. The drawing itself lives in `lib/chinchilla-art.ts` (`drawChinchilla()`), shared with Fluffball Cup, Border Hop, Dust Bath Dash and Dusty Hollow; the Fluff Forge wrapper adds the power-up on the head through its `decorate` hook. It is drawn from the photos in `public/art/` (`dora.jpeg`, `enzo.jpeg`, `the-original-duo.jpg`) in a 24-unit frame, side-on: a round loaf of a body with the head set straight into it, and body, haunch, chest, head, muzzle and cheek fluff outlined as one silhouette (stroke every shape thick, then fill them all). `COATS` holds each coat. Dora is white with peach-pink ears you can almost see through, ruby eyes and pink toes. Enzo is standard grey with a darker wavy back, a paler face, a white chest and front legs, and black eyes. The tails and whiskers follow the painted pair in ChinChin · Snack Heist from the earlier ChatGPT arcade. `tail()` lays each tail out as circles along a cubic curve: a big plume that sweeps back from the rump, rises about as high as the ears and curls forward over the back. It has a smooth, softer outline than the body, with fur strokes combed toward the tip inside it. Dora's is white with a cream inner curve. Enzo's is grey, darker along the outside and paler inside, with light and dark streaks. It streams back when running and lifts in the air. `whiskers()` fans six long, fine whiskers from the whisker pad, drooping down and back past the chin, plus three fainter far-side ones drawn before the head so they poke out from behind the muzzle. They are white (with the odd darker one on Enzo), carry a faint dark underline so they show against a pale sky, sway, and flare wider when running. The pose follows the hero: a breathing idle with a twitching nose, a bounding stride with the tail streaming back, ears swept back and paws reaching out in the air, and crossed-out eyes when a try ends.

A tag leaves `tag` on the game (who left, and where and which way the hero faced), which the engine clears after a second; it never changes play. The newcomer dashes in from the screen edge behind the hero over 0.16 s, the partner turns to meet them nose to nose, a heart floats up, and the partner hops off the way the newcomer came. The engine also leaves `dust` effects for hard landings and quick feet, and a `sparkle` where a raisin was taken. Everything is in course pixels, and the page scales the canvas by 2.

## Saves

The page keeps one `localStorage` record, `fluff-forge-v1`: your courses (with their `cleared` code), best times keyed by starter id or course id, the chosen hero and the sound setting. Saved courses are checked on load (`parseMine()`), so a course still missing its start or goal loads fine but a damaged one is dropped.

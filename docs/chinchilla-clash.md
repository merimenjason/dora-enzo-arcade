# Dora & Enzo's Arcade · Chinchilla Clash

A Clash Royale-style lane battler. Dora and Enzo defend the Dust Palace at the bottom of the arena against a computer-controlled rival clan at the top. Both sides play cards with bath dust to send troops over the river, and the side that knocks down more towers wins.

The rules live in `lib/chinchilla-clash-game.ts`, a deterministic engine with no browser dependencies: every random choice (the deck shuffle, the computer's placement wobble) comes from a seeded generator, so a seed replays a whole match. `lib/chinchilla-clash-scene.ts` draws it, and `app/clash/page.tsx` is the page.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/clash`.

## The arena

The arena is 18 × 32 tiles; the player owns the bottom half. The river covers rows 15 to 17 and the bridges are two tiles wide, centred on columns 3.5 and 14.5. Towers, with side 1's mirrored top to bottom:

| Tower | Where (side 0) | Health | Damage | Hit speed | Range |
| --- | --- | --- | --- | --- | --- |
| Princess (left, right) | (3.5, 25.5), (14.5, 25.5) | 1400 | 50 | 0.8 s | 7.5 |
| King | (9, 28.5) | 2400 | 60 | 1 s | 7 |

The king tower sleeps (Dora and Enzo nap on top) until it takes damage or one of its princess towers falls. Towers shoot the nearest troop in range, ground or air, and keep shooting it while it stays in range.

## Dust and cards

- Each side starts with 5 dust and gains 1 every 2.8 seconds, up to 10. From 2:00 (the last minute of regulation) and through overtime it fills twice as fast.
- A deck is eight different cards. The deck is shuffled at the start; the first four are the hand and the rest wait in line. Playing a card moves it to the back of the line and the front card takes its slot.
- Troops and buildings must go on your own half (from row 17.5 down), or in the enemy half of a lane whose princess tower has fallen (from row 10, on that side of the centre line, not in the river). Spells go anywhere.
- Troops and buildings take 1 second to deploy, during which they can be hit but can't act.

| Card | Dust | Kind | Health | Damage | Hit speed | Range | Speed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kit Squad | 2 | 4 troops | 90 | 45 | 1 s | melee | fast | ground only |
| Pellet Flickers | 3 | 2 troops | 230 | 60 | 1 s | 5 | medium | hit air |
| Dora, Dust Duchess | 5 | troop | 650 | 140 | 1.4 s | 5.5 | medium | splash 1.3, hits air; player only |
| Enzo, Boulder Brawler | 4 | troop | 1350 | 150 | 1.6 s | melee | medium | spins: hits all ground troops within 1.8; player only |
| Grandpa Pebble | 5 | troop | 3200 | 190 | 1.5 s | melee | slow | buildings only |
| Dust Dasher | 4 | troop | 1150 | 210 | 1.6 s | melee | very fast | buildings only, leaps the river |
| Glider Gang | 3 | 3 flying troops | 190 | 80 | 1 s | 1.5 | very fast | hit air |
| Mochi the Capybara | 3 | troop | 1450 | 160 | 1.2 s | melee | medium | ground only |
| Hay Balloon | 5 | flying troop | 1100 | 450 | 3 s | melee | medium | buildings only; a 200-damage bale when popped |
| Dust Bomb | 4 | spell | | 520 | | radius 2.5 | | knocks ground troops back 1.2 tiles |
| Pellet Volley | 3 | spell | | 240 | | radius 4 | | |
| Hay Cannon | 3 | building | 800 | 120 | 0.9 s | 5.5 | | ground only; loses health over 30 s |

Speeds are tiles a second: slow 0.75, medium 1, fast 1.5, very fast 2. Towers take 35% of spell damage (the balloon's bales are not spells and hit in full). Spells fly from the caster's king tower and land after 0.3 s plus their flight time.

## How troops move and pick targets

- A troop attacks the nearest enemy it can hit within 5.5 tiles (or its range plus one, if longer). With nothing in sight it walks to the nearest enemy building, which is how a Hay Cannon in the middle pulls tower-hitters off their lane. Once something is in range it keeps attacking it.
- Tower-hitters (Grandpa Pebble, the Dust Dasher, the Hay Balloon) only ever target towers and buildings.
- Ground troops cross on the bridge nearest their route and never step into the water. The Dust Dasher jumps the river anywhere; flyers ignore it.
- Troops push each other apart (bigger ones push harder) and are pushed out of towers and buildings. When two meet head-on they slide sideways so they can step around each other.

## Winning

- A princess tower is one crown. The king tower is three crowns and ends the match at once.
- After 3:00, the side with more crowns wins. If crowns are level, one minute of overtime follows and the next crown wins.
- If it is still level after overtime, the side whose weakest tower has less health loses that tower (a crown for the other side). Exactly equal towers are a draw.

## The trophy road

Three arenas, each opened by beating the one before it. The rivals are clans of chinchilla colour types, with their own decks (never Dora or Enzo) and computer players tuned in `RIVALS`:

| Arena | Rival | Deck | Thinks every | Attacks at | Notes |
| --- | --- | --- | --- | --- | --- |
| Salt Flat Arena | Sandy’s Beige Brigade | Kits, Flickers, Mochi, Pebble, Gliders, Volley, Cannon, Dasher | 1.3 s | 9.5 dust | doesn't back its pushes, sloppy placement |
| Cactus Canyon | Duchess Velvet’s Violets | Kits, Flickers, Mochi, Dasher, Gliders, Dust Bomb, Volley, Pebble | 1.1 s | 9 dust | supports its tanks |
| Moonlit Summit | Baron Ebony’s Night Guard | Kits, Flickers, Pebble, Balloon, Gliders, Dust Bomb, Volley, Mochi | 0.45 s | 7 dust | supports its tanks, defends hard, spells towers it can finish |

On each decision the computer first spells a tower one spell would finish (if it snipes), then defends: it looks at the enemy troops nearest its towers and, if its own troops there are outweighed, plays the best answer it can afford (splash against swarms, something that hits air against flyers, a cannon against ground tower-hitters, a spell when it would pay off). Otherwise it backs a tank that is crossing the river with a support troop, and once it has saved enough dust it sends a tower-hitter (or its biggest troop) down the lane whose tower is weakest. When its dust is nearly full it plays something rather than waste it.

With the standard `STEADY` computer playing the starter deck, the rivals win roughly 1 in 30, 1 in 3 and 2 in 3 matches respectively (`tests/chinchilla-clash.mjs` checks each arena is harder than the last).

## Saves

The page keeps `chinchilla-clash-v1` in `localStorage`: the arenas beaten, your deck, total wins and three-crown wins. A missing or broken save falls back to the starter deck; private browsing still plays, it just isn't remembered.

## Controls

- Tap a card and then the arena, or drag a card onto the arena. A ghost shows the drop point, its footprint and its range; red tiles are where it can't go.
- 1–4 pick a card; the arrow keys or WASD move the drop point one tile; Enter or Space drops it; Escape puts it back.
- P, or Escape with no card picked: pause. Losing window focus pauses too.

## Drawing

Troops are the shared side-on Dora and Enzo drawing from `lib/chinchilla-art.ts`, in blue or red team vests, with coats for your side's kits and flickers and for the beige, violet and ebony clans. Dora waves a paper fan, Enzo spins with his claws out, Grandpa Pebble has white eyebrows, spectacles and a walking stick, and the Dust Dasher wears a scarf and goggles. Mochi the capybara (with an orange on her head), the sugar gliders, the hay balloon and the hay-bale cannon are drawn separately. Each arena has its own grass, river and scenery: salt crystals, cacti or twinkling stars. Towers carry a pellet flicker, with Dora and Enzo crowned on the king tower, or the rival leader on theirs.

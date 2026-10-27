# Hayloft Tycoon

Game 48, at `/hayloft`. An idle tycoon: Dora and Enzo start with one hay meadow and grow it into a valley-wide chinchilla business of twelve buildings. Buildings make coins on a cycle; helpers run them on their own, including while the game is closed. Great Migrations move the colony to a new valley with its own twist and earn Stardust for a Star Tree; Constellations, a second prestige layer, turn Stardust into Moonstones. It is built for short phone sessions: a portrait layout with a bottom tab bar, full offline progress, real-time trips and research, a daily gift, and something new to collect each time the game is opened. Written 28-10-2026.

## Files

| Part | File |
| --- | --- |
| Engine: economy, time online and away, visitors, Twig Shower, trips, research, prestige, saving, number formatting | `lib/hayloft-game.ts` |
| Scene: scrolling valley, buildings, helpers, Dora and Enzo, visitors, floating coins, the Twig Shower (Canvas 2D) | `lib/hayloft-scene.ts` |
| Sound: short Web Audio blips with a mute toggle (`hayloft-tycoon-muted`) | `app/hayloft/sound.ts` |
| Page: top bar, valley, six tabs, welcome-back card, pause, confirmations | `app/hayloft/page.tsx`, `app/hayloft/hayloft.css`, `app/hayloft/layout.tsx` |
| Paintings (5 valleys, 12 buildings, Dora and Enzo, 5 visitors, 2 twigs, a title), with drawn stand-ins until they load | `public/art/hayloft/`, listed in [`hayloft-tycoon-art-brief.md`](hayloft-tycoon-art-brief.md) |
| Tests | `tests/hayloft.mjs`, `tests/hayloft-bot.mjs`, `tests/e2e/hayloft.mjs` |

## Buildings

Each building has a base cost, a cost growth per level, a cycle and an output per level per cycle. Prices are the table values multiplied by `PACE` (10), the single knob tuned with the bot. A building is shown once the one before it is owned. Buying a level costs `cost × growth^level`; buying `n` at once costs the geometric sum, and **MAX** buys as many as the coins cover (capped at level 1000).

| # | Building | First price | Growth | Cycle | Output / level | Helper (price): perk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🌾 Hay Meadow | 40 | ×1.07 | 1 s | 1 | Dora (free, from the start): taps ×2 |
| 2 | 🛁 Dust Bath Spa | 600 | ×1.15 | 3 s | 60 | Pip (120K): Dust Bath Spa ×2 |
| 3 | 🪨 Pebble Polishery | 7.20K | ×1.14 | 6 s | 540 | Pebble (1.50M): buildings cost 3% less |
| 4 | 🍎 Apple-Twig Orchard | 86.4K | ×1.13 | 12 s | 4.32K | Juniper (20.0M): visitors stay 4 s longer |
| 5 | 🧺 Cozy Cushion Mill | 1.03M | ×1.12 | 24 s | 51.8K | Tuft (250M): Fluff Bursts last 5 s longer |
| 6 | 🍪 Hay Biscuit Bakery | 12.4M | ×1.11 | 48 s | 622K | Biscuit (3.00B): one more find per trip |
| 7 | 🏮 Glimmer Lantern Works | 149M | ×1.10 | 96 s | 7.46M | Lumen (36.0B): visitors 20% more often |
| 8 | 🔭 Moonlight Observatory | 1.79B | ×1.09 | 192 s | 89.5M | Nova (450B): Stardust +10% |
| 9 | 🎈 Cloudhopper Balloon Port | 21.4B | ×1.08 | 384 s | 1.07B | Breeze (5.50T): everything ×1.25 |
| 10 | 🍵 Starleaf Tea Garden | 257B | ×1.075 | 768 s | 12.8B | Sage (70.0T): everything ×2 |
| 11 | 🔔 Aurora Bell Tower | 3.09T | ×1.07 | 1536 s | 154B | Chime (900T): Twig Shower boosts last 50% longer |
| 12 | 🚀 Comet Skyship Dock | 37.1T | ×1.07 | 3072 s | 1.85T | Captain Wisp (11.0aa): everything ×3 |

- **Running by paw.** A building without a helper makes nothing until you tap it (on the valley, where it shows **TAP!**, or its **Run** button); it then runs one cycle and pays at the end. With a helper it pays continuously, `levels × output × multipliers / cycle` a second, and keeps going while you are away.
- **Milestones.** Each building multiplies its own output at levels 10 (×2), 25 (×2), 50 (×2), 100 (×3), 150 (×2), 200 (×3), 250 (×2), 300 (×3), 400 (×3), 500 (×4), 600, 700 (×2 each), 800, 900 (×3 each) and 1000 (×5).
- **Valley festivals.** When every building reaches 10, 25, 50, 100, 200, 300, 400 or 500, everything doubles again.
- **Upgrades.** Three per building (×3 each) at 1,000×, 100 million× and 10¹⁵× the building's first price, and six for everything: Valley Bunting (50.0M, ×2), Meadow Band (200B, ×2), Twilight Choir (10.0aa, ×3), Lantern Parade (10.0ac, ×3), Hay Jubilee (100ae, ×5), Aurora Gala (10.0ah, ×5). The Helpers tab shows the next six.

## Taps, Fluff Bursts, visitors and boosts

- **Taps.** A tap on the valley pays `max(1, rate × tap seconds)`. Tap seconds start at 0.02, Golden Paws add 0.02 a level, Golden Whiskers research adds 0.05; Dora's perk doubles the total, and Cloudreach doubles it again.
- **Fluff Burst.** Each tap adds one fluff (the meter drains 0.6 a second); 50 fluff makes a Fluff Burst: everything ×2 (+1 per Extra Fluffy level) for 15 s (+10 s with Fluff Science, +5 s with Tuft).
- **Visitors** fly across the sky every 75–150 s of play (divided by the visit rate) and stay 12 s. Tap one (or press C) to catch it: the Hummingbird with a Golden Acorn (weight 40: everything ×7 for 30 s), the Viscacha Pedlar (25: ten minutes of production, at least 25 coins), the Owl Scholar (15: a blueprint), the Berry Bat (10: a sunberry) and the Fluff Breeze (10: a Fluff Burst).
- **Twig Shower.** Every 6–10 minutes of play an offer appears for 45 s. Playing it drops apple twigs for 10 s (one every 0.26–0.44 s, falling faster as it goes, 12% golden and worth 3); tap them before they land. Each one caught adds 10% to a boost of up to ×6 that lasts two minutes (+50% with Twig Baskets and with Chime).
- **Items.** Sunberries (×3 for ten minutes; another adds ten more minutes) and clock acorns (an hour of steady production right away, or an hour off a research or a trip).
- Boosts multiply each other, and they run out on game time, so they last the same whether you watch or not.

## Time away

Time online and time away use the same production code, so an hour away pays the same as an hour of watching without tapping (tested to 10⁻⁹). Time away counts for up to **8 hours** at first; Long Naps (+2 h a level, up to 4), Comfy Naps (+2 h), Deep Naps (+4 h) and Long Dreams (+8 h a level, up to 2) raise the cap to as much as 38 h. Trips and research run on the wall clock in full, cap or not. Visitors and Twig Showers wait for you to come back. A **welcome-back card** says how long you were gone, what the valley made, which teams are home and which research finished. A tab that the browser slowed down in the background is caught up the same way.

## Trips and keepsakes

Two teams to start (Team Dora and Team Enzo), one more with Extra Team research and up to two more with Big Pockets. Places: Babbling Brook (15 min, 1 find), Whispering Woods (30 min, 2), Rosy Ridge (1 h, 3, 4% keepsake chance), Crystal Caves (2 h, 5, 10%), Moonlake Shore (4 h, 8, 20%) and Starpeak Summit (8 h, 14, 35%). Finds are rolled when a team sets off: a blueprint (42%), a sunberry (22%), a clock acorn (14%), after the first migration some Stardust (8%, 1% of all you have gathered), otherwise trail mix (20 minutes of production when unpacked). Trail Maps, Moon Maps (−15% each) and Map Makers (−10% a level) shorten trips. There are ten **keepsakes** for the shelf, each +10% to everything for good; a second copy becomes two blueprints.

## Research

Sixteen studies that cost blueprints and real time (5 minutes to 8 hours), one at a time, kept for good: Sharper Sickles (Hay Meadow ×3), Warm Sand (Spa ×3), Comfy Naps, Trail Maps, Twig Baskets, Bird Feeders (visitors +25%), Fluff Science, Golden Whiskers, Bulk Orders (prices −7%), Extra Team, Valley Harmony (×2), Star Charts (Stardust +15%), Deep Naps, Moon Maps, Grand Harmony (×3) and The Great Hay Library (×5, 40 blueprints, 8 h).

## The Great Migration

Owning a **Comet Skyship Dock** opens the migration. It gives `⌊10 × (coins earned in this valley / 10¹⁸)^¼ × Stardust multipliers⌋` Stardust (Moonbeam +10% a level, Comet Tail ×1.5 a level, Star Charts +15%, Nova +10%), then starts a new valley: coins (unless Warm Welcome), buildings, upgrades and helpers (unless Old Friends or Seasoned Founders) reset; Stardust, items, research, trips, keepsakes and achievements stay. Every Stardust ever earned shines on the valley: everything ×(1 + ½√Stardust).

The valleys come round in order, a year at a time: **Meadowvale** (no twist), **Snowdrift Valley** (buildings with a helper ×1.5, by-paw cycles twice as long), **Pebble Cove** (a tide of ±30% every four minutes, integrated exactly; Pebble Polishery ×5), **Glowcap Hollow** (visitors 2.5× as often; each caught one leaves a spore worth +3% for that valley) and **Cloudreach Isles** (the top six buildings ×3, taps ×2).

**Star Tree** (Stardust): Starlit Fields (everything ×1.5 a level, 10 × 6^level), Golden Paws, Eager Helpers (helpers −25% a level), Warm Welcome (start with 1K, 100K, 10M or 1B coins), Lucky Whiskers (visitors +15% a level), Long Naps, Old Friends (keep the first 4, 8 or all 12 helpers), Map Makers, Extra Fluffy, Thrift (prices −5% a level), Moonbeam and Big Pockets.

## Constellations

With 200K Stardust gathered you can name a Constellation for `⌊√(Stardust / 50,000)⌋` Moonstones. Stardust, the Star Tree and the valley count start over in Meadowvale; research, items, trips, keepsakes, achievements and Moonstones stay, and each named constellation twinkles in the sky. Moonstones buy Night Sky (everything ×3 a level, for good), Comet Tail (Stardust ×1.5 a level), Seasoned Founders (keep every helper), Starseed (start each valley with 4, 8 or 12 buildings at level 25) and Long Dreams.

## Achievements and the daily gift

59 achievements (owning 25 and 100 of each building, coins earned, visitors, taps, migrations, trips, research, Twig Showers, gift streaks, all helpers, a festival, a constellation, a full keepsake shelf), each +3% to everything for good. The **daily gift** opens once per local calendar day on a seven-day round: 2 blueprints, a sunberry, a clock acorn, 3 blueprints, 2 sunberries, 2 clock acorns, then 5 blueprints and Stardust (5, or 5% of all gathered); missing a day starts the round again.

## Numbers

Plain doubles. The engine's test builds the biggest valley the content allows (every building at 1000, every multiplier maxed, Stardust at 10³⁰, every boost on) and checks that two days of it and the most expensive purchase stay below 10²⁰⁰, far inside a double's 1.8 × 10³⁰⁸; the bot checks every number stays finite through a simulated day. Numbers read 999, 1.23K, 45.6M, 789B, 1.00T, then two letters per further thousand: aa, ab … az, ba … (digits are cut, never rounded up).

## Controls

- **Tap or click** the valley for coins and fluff; tap a building marked TAP! to run it; tap a visitor to catch it; **drag** sideways to look along the valley. In the Twig Shower, tap the twigs.
- Six tabs along the bottom: **Build** (buy amount ×1, ×10, ×100 or MAX; buildings, milestones and Run buttons), **Helpers** (helpers and upgrades), **Research**, **Trips** (and the keepsake shelf), **Stars** (migration, Star Tree, Constellations), **More** (daily gift, achievements, the valley book of stats, how to play, starting over). A red dot marks a tab with something ready.
- Keys: **Space** taps, **1**–**0**, **-** and **=** buy (or run) buildings 1–12, **B** changes the buy amount, **C** catches a visitor, **M** mutes, **P** or **Esc** pauses (helpers keep working, as when the game is closed).
- On wide screens the valley fills the left and the shop sits on the right.

## Saving

`localStorage` key `hayloft-tycoon-v1`, written every 5 s, when the tab is hidden and when the page closes. The save is the engine state as JSON; `readSave()` parses it defensively (anything broken, missing or from another version falls back field by field or to a fresh valley). The sound setting is under `hayloft-tycoon-muted`. The game is exposed on `window.__hayloft()` and the Twig Shower on `window.__hayloftShower()` for browser tests; `main[data-ready="true"]` marks hydration.

## Tests

- `tests/hayloft.mjs` (about 1,000 checks): content, prices and MAX, milestones and festivals, helpers and perks, running by paw, taps and Fluff Bursts, visitors and boosts, an hour away equal to an hour online in three valleys, the offline cap, the tide integral, every valley's twist, migration and the Star Tree, Constellations, research, trips and keepsakes, the daily gift, achievements, the Twig Shower, save round-trips and broken saves, determinism from a seed and an action log, number formatting and the number range.
- `tests/hayloft-bot.mjs`: three players run the real engine for a simulated day: an **active** tapper (8 h of play on three seeds), a **commuter** (two minutes every twenty, 16 waking hours a day) and an **idle** player (ten seconds every three hours). It asserts the first migration lands 45–90 minutes into active play, no more than five minutes of play ever pass without something to buy or a migration, earnings grow at every mark, later migrations pay much more than early ones, the commuter migrates on day one with Constellations still ahead, the idle player still reaches a migration, research keeps moving, numbers stay finite and a seeded run replays exactly. It prints the pacing table.
- `tests/e2e/hayloft.mjs`: the arcade card, tapping, buying ×1 and MAX, running by paw, hiring, saving, the welcome-back card after two hours away, a trip, catching a visitor, the Twig Shower, pausing, every tab, and the phone layout at 390 × 844.

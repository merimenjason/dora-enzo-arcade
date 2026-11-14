# Jade Street

Game 105, `/jade-street`. A top-down open-city caper set on the night before the Lantern Festival in an invented harbour quarter. The Magpie Crew have stolen five lucky heirlooms, and Dora (cream-white fur, red eyes, jade bomber with a gold crane) or Enzo (grey fur, vermilion tracksuit top) wins them back over 25 story jobs. It is original: the quarter, its people, the jobs, the heat system and the interface were all made for this game.

## Code layout

The engine is plain TypeScript with no DOM, split one file per system. It steps at a fixed 1/60 s, takes all randomness from seeded generators, and emits an event queue (`fx`) that the page drains for the scene and the sound.

| File | What it holds |
|---|---|
| `lib/jade-rng.ts` | the seeded generator, string hashing and small maths helpers |
| `lib/jade-city.ts` | the 120 × 92 tile city (64 world units a tile): ground, solidity (open, building, water, tall, low), roof flags, the five districts, buildings, props, decals, places (markets, safe houses, garages, contacts, spots), 50 lucky cats, 13 murals, 21 hiding spots and 4 fire ladders; `passable()` per way of moving |
| `lib/jade-nav.ts` | flow fields per way of moving (`foot` may hop low tiles, `walk` may not, `small` and `big` rides, `boat`, `fly`), `downhill()`, `nearestFree()` and line of sight |
| `lib/jade-move.ts` | direct-control movement for capsule bodies with wall sliding, the five rides' numbers, and on-foot numbers |
| `lib/jade-traffic.ts` | lane-following cars, the twelve traffic lights and their timing, cars stopping at the line on red, bumps and honks, `redRun()` |
| `lib/jade-folk.ts` | townsfolk with destinations (doors, stalls, food-court seats, benches) on 4-way flow fields over pavements and zebra crossings; they wait at the kerb for a green or a gap, sit and eat, gather round a busker and hop clear of anything fast |
| `lib/jade-remodel.ts` | breaking the grid after the city is built: merged landmark blocks, plazas and pocket plazas, food-court tables, the lighthouse, curving painted footpaths and the festival dressing plan |
| `lib/jade-events.ts` | street events in free roam: the magpie snatch, the lost duckling, the broken-down van and the busker |
| `lib/jade-weather.ts` | seeded passing showers per night |
| `lib/jade-diff.ts` | the Easy, Normal and Hard numbers |
| `lib/jade-medals.ts` | par times, the three medal marks and the goals text |
| `lib/jade-tutor.ts` | the lessons taught in context and when each one shows |
| `lib/jade-phone.ts` | texts from contacts: job offers, night tips, calls for help |
| `lib/jade-heat.ts` | lanterns, wardens, roadblocks, the blimp, hiding, evading and getting caught |
| `lib/jade-trade.ts` | the six goods, each market's leanings, nightly drift, tips, spreads, haggling, capacity, buying, selling and the stash |
| `lib/jade-story.ts` | the people, the five heirlooms and the 25 jobs as data (steps: talk, goto, pickup, deliver, ride, chase, tail, escort, race, stealth, collect, mini, heat, trade, fares) |
| `lib/jade-mission.ts` | runs a job: each step's rules, the actors (thieves, Pip, the lion, lookouts, racers, fares), checkpoints and their restore |
| `lib/jade-gigs.ts` | the 13 side-gig boards, each building a short job |
| `lib/jade-mini.ts` | the four mini-games as engines: lock, wires, wok and dumplings |
| `lib/jade-setpiece.ts` | the chase set pieces (stall smash, temple drums, drawbridge, crane, yard gate): when each triggers, its telegraph, the knock-downs and the tiles a closed bridge or gate blocks |
| `lib/jade-boss.ts` | Madame Glint's three phases: decoys, falling neon signs, then her float and the rooftop leap, with a checkpoint at each phase |
| `lib/jade-biz.ts` | the six businesses: prices, upgrades, nightly takings, the night's event, collecting, magpie raids and their defend job |
| `lib/jade-juice.ts`, `lib/jade-setdraw.ts` | drawing only: hit-stop, shake, painted debris, slow-mo and the zoom punch, speed lines, the boost trail, squash and stretch, pops and coin tallies, the heat flash (all tunable in `JUICE`); the set pieces, telegraphs, stalls and Glint's float |
| `lib/jade-duo.ts` | the partner: following on the flow fields (never stuck: a partner stalled or off screen too long catches up out of sight), riding as the passenger, hiding with you, posts a job gives them, switching heroes, the second player and the leash |
| `lib/jade-tag.ts` | the tag-team moves on F: the passenger's grab, boost up and haul up at seven walls, the double pounce, distracting a warden, wait and call over |
| `lib/jade-team.ts` | the job steps that need both heroes (post, switch, hold a lever, boost the partner, the loot-bag magpie), what each gadget does to a job's actors, blinded lookouts and the window lookout |
| `lib/jade-gear.ts` | the six gadgets: firing, aim assist, reloads, shots in flight, hits, bursts, splats and soap puddles, supply crates, Tock's toy stall and who carries what |
| `lib/jade-duodraw.ts` | drawing only: both heroes with their tag-team, firing and passenger poses, gadgets, shots, splats, crates, the stall and the job props (lever, sluice, shutter, pulley, window lookout, loot-bag magpie) |
| `lib/jade-save.ts` | the save (`jade-street-v5` in localStorage; v4, v3, v2, the first release, and v1 migrated: finished jobs become medal entries, the opening and chapter cards are marked seen and the basic lessons learned), outfits, paints, upgrades, safe houses, trophies, the daily event |
| `lib/jade-game.ts` | `World`: the player, rides, the step order, interaction, the clock, magpies, trading through the world, safe-house actions, routes and the objective |
| `lib/jade-art.ts` | generated by `scripts/jade-art.py`: every frame's atlas rectangle, its painted share (`FILL`), the textures and plain images |
| `lib/jade-life.ts` | drawing the living city on top of the scene: traffic lights, street events, the festival, sky lanterns, fireworks, rain streaks and ripples, wet reflections, umbrellas and seated townsfolk |
| `lib/jade-scene.ts` | Canvas 2D drawing (the loader decodes every atlas and texture first and reports progress): ground baked into 8 × 8 tile chunks (an LRU of 44), painted buildings with baked soft shadows, y-sorted sprites, hue-shifted outfit and paint variants, code-drawn glows, headlights, lantern strings, spotlights, fog over closed districts, the route line and the minimap |
| `app/jade-street/controller.ts` | the loop, keys, the touch stick, the fixed steps, saving every 5 s, music changes, and the `window.__jade` hook |
| `app/jade-street/page.tsx`, `hud.tsx`, `panels.tsx`, `minis.tsx`, `ui.tsx`, `jade.css` | the title, HUD, dialogue, failure card, touch controls, market, safe house, garage, pause and mini-game screens |
| `app/jade-street/extras.tsx` | the painted loading screen with retry, lesson hints, the phone, the radio, the jobs book and the controls page |
| `app/jade-street/map.tsx` | the painted paper map: pan, pinch and wheel zoom, fog, plaques, landmarks, pins, legend and Route here |
| `app/jade-street/story.tsx` | the storybook opening, chapter cards, the ending and the credits |
| `app/jade-street/sound.ts`, `music.ts`, `radio.ts` | WebAudio effects, district ambience and rain; the layered score (guzheng, erhu, drums, wood block, cymbal) with street, market, chase, boss, festival and menu themes that crossfade, and each speaker's babble voice; the ride radio's stations |
| `app/jade-street/biz.tsx` | the stall panel, the Businesses page and collecting at a safe house |
| `app/jade-street/duo.tsx`, `duo.css` | the duo bar (both portraits, the partner's status, click to switch), the F prompt, the gadget hands and Tock's toy stall |

The React HUD re-renders about ten times a second, or at once when a panel, dialogue or failure opens; the world itself is never rendered by React.

## Rules and numbers

**Moving.** On foot: walk (sneak) 145, run 235, a dash at 560 for 0.22 s (0.75 s cooldown), and a hop of 0.42 s that clears low tiles (crates, hedges, benches). Controls are direct: the stick or keys set the heading and speed, with no drifting. Rides:

| Ride | Top speed | Hold | Moves on | Notes |
|---|---|---|---|---|
| Scooter | 340 | 8 | small (alleys too) | some are locked and need a jump-start |
| Trishaw | 250 | 16 | big | a seat for a fare |
| Tuk-tuk | 310 | 20 | big | a seat for a fare |
| Delivery van | 285 | 40 | big | too wide for alleys |
| Canal boat | 250 | 30 | water | the canal and harbour |

Boost (Space on a ride) and honk (Q) replace dash and hop. Four fire ladders lead to the rooftops; up there you cross gaps by hopping, nobody adds heat, and a hop that would land off a roof puts you back where you took off.

**Heat.** Up to five lanterns. Bumping a warden (dashing on foot, or riding over 130) adds 0.3, knocking a roadblock 0.25, hitting a car above 160 adds 0.15 (twice that on Normal, three times on Hard), and on Normal and Hard riding into a lit crossing against a red light adds 0.55 (Hard 0.8); on Assist these count half while a job is running. Wardens on bicycles come one per lantern (one fewer on Easy, at least one), up to four, from behind or to the side of the way you are heading; they ride at 205 on Easy or 240 on Normal plus 12 a lantern. From three lanterns roadblocks of fruit crates appear on the road ahead of a ride; from four a blimp follows where you were last seen, and its spotlight sees you within 120. Wardens see 520 with clear line of sight. Out of sight for 3.2 s (Easy) or 4.6 s (Normal) puts a lantern out, twice as fast in a hiding spot. A jacket swap at a safe house clears all heat. A warden who reaches you on foot (0.35 s on Easy, 0.2 s on Normal) or beside a stopped ride (1.1 s) catches you: a fine of 5% of your coins (10 to 150), a trip to the nearest safe house, and any job restarts from its checkpoint.

**Trading.** Base prices: jade bangles 120, porcelain bowls 58, silk fans 44, mooncakes 34, tea 22, mangoes 12. Each market leans 0.68 to 1.38 on each good (the Docks sell jade cheap, the Arcade Strip pays most for it, Temple Hill sells tea cheap and the Canal Quarter pays for it, and so on), every night drifts each price by up to 14% either way, a contact's tip multiplies one good at one market, and the daily event adds one more. Buying costs 6% over the mid price and selling pays 6% under it, 3 points better for each reputation tier (20, 50 and 80). The haggle needle: in the gold middle the stall's prices improve by 14%, in the green by 7%, outside it nothing, and a sour miss costs 4%; the zone is wider with reputation and on Assist. You carry 4 on foot (plus one per cargo upgrade) or your ride's hold (plus a quarter of it per upgrade). Magpies swoop every 25 to 45 s while you carry anything worth having (a chance of up to 50% by cargo value, 60% of that on Assist) and take two of your most valuable good unless you dash, boost, hop or hide as they reach you.

**Progress.** Each job pays coins and reputation in its district. Safe houses cost 150 to 300 and 15 reputation; each has a stash (60, plus 20 per cargo upgrade), the jacket swap, sleep till the next night (new prices), and the choice of hero. Six outfits per hero (120 to 400 coins and 20 to 30 reputation in a district), three garage upgrades with three levels (engine +7% top speed a level for 150, 400, 900; tyres +10% steering for 120, 350, 800; racks for 100, 300, 700) and five paints (free to 120) that apply to every ride. A night lasts 720 game minutes, one a second (a little slower on Assist). There are 20 trophies.

**Assist** (on by default, in Settings): a gold route line to the objective and the nearest job, gentler timers and lookouts, slower and rarer magpies, half heat during jobs, a wider haggle zone, larger mini-game windows and a slower clock.

**Difficulty** (Settings; `lib/jade-diff.ts`):

| | Easy (default) | Normal | Hard |
|---|---|---|---|
| Out of sight to put a lantern out | 3.2 s | 5.4 s | 6.6 s |
| Warden speed (plus 12 a lantern) | 205 | 256 | 276 |
| Wardens per lantern | one fewer | one each | one more |
| Warden grab on foot | 0.35 s | 0.2 s | 0.15 s |
| Warden sight | 520 | 580 | 620 |
| Job timers | × 1 | × 0.56 | × 0.47 |
| Chase targets / race rivals | × 1 / × 1 | × 1.1 / × 1.02 | × 1.16 / × 1.08 |
| Lookouts' range and suspicion | × 1 | × 1.16 | × 1.26 |
| Time a chase target may be out of reach | × 1 | × 0.6 | × 0.45 |
| Heat for crashing into a car / running a red | × 1 / none | × 2 / 0.55 | × 3 / 0.8 |

**Failing fairly.** Every job can be failed, and shows how close you are before it happens: a timer (with a warning at ten seconds), a Getaway meter in chases (it fills while the thief is far away, 900 world units or 1150 on Assist, and empties when you close in, with four seconds' grace at the start and after a retry), a Wobble meter for fragile cargo (a warning two bumps before it breaks), Alert for lookouts (a warning at half), Suspicion when tailing, Troupe when the lion dance is left behind, Rival in races, Float for Glint's float and Got away in a raid. Thieves and race rivals stop at red lights on Normal and Hard, as the bots do. Each retry of a job eases rivals and lookouts by 4% (at most 12%).

**Set pieces.** Each chapter's heirloom chase has one, telegraphed first (longer on Assist, shorter on Hard): the Jade Dragon's cart smashes a fruit stall and scatters rubble (warning 1.1 s; a chunk knocks you down for 0.2 s, 0.35 on a ride), the Golden Bell's thief kicks three temple drums down the steps (1.4 s), the Pearl Lantern's drawbridge lowers after the boat (a bell 2.2 s ahead, shut 4 s on Assist and 5.5 s otherwise), the Silver Koi's yard has a swinging crane load (period 3.8 s on Assist, 3.2 s otherwise) and a gate that shuts after the cart (2.4 s warning, 5 or 7 s shut). **Glint's Last Flight** is a three-phase boss with a checkpoint at each: phase 1 she throws decoys (bump the one that sparkles gold), phase 2 neon signs fall in her path (warning, then a shadow; a hit knocks you down), phase 3 she rides off on her festival float and you climb the fire ladder and leap from a rooftop flag when the float is under it (a window of 96 units each side on Assist, 72 otherwise).

**Businesses.** Six stalls sell a stake once you have the reputation in their district:

| Business | District | Stake | Upgrades | Takings a night (levels 1 to 3) | Reputation |
|---|---|---|---|---|---|
| Noodle Cart | Night Market | 500 | 600, 1,000 | 70, 120, 190 | 15 |
| Mooncake Bakery | Night Market | 650 | 800, 1,300 | 90, 150, 240 | 20 |
| Hilltop Tea House | Temple Hill | 800 | 950, 1,600 | 110, 185, 290 | 20 |
| Canal Fan Shop | Canal Quarter | 950 | 1,150, 1,900 | 130, 220, 345 | 20 |
| Harbour Jade Counter | Docks | 1,500 | 1,800, 3,000 | 205, 345, 540 | 25 |
| Neon Claw Booth | Arcade Strip | 1,200 | 1,450, 2,400 | 165, 280, 440 | 25 |

Takings build through the night and are multiplied by the district's reputation (0.75 plus reputation ÷ 200), rain (busier for noodles, tea and the claw booth, quieter for fans), the night's event (a crowd × 1.3 or a quiet night × 0.8), a market tip for the stall's good (× 1.25), the daily event (× 1.3) and the festival (× 1.2). The till holds three nights; collect it at the stall or every till at once at a safe house. Each upgrade repaints the stall in the world. At 11 pm and 3 am a till with 20 or more coins may be raided (30% on Assist, 40% otherwise): a text, then a timed defend job where three magpies (four on Hard) grab from the till and flee; dash, hop or ride into each before it gets 11 tiles away. Let more than one escape (two on Assist), or quit, and they take 40% of the till; chase them off for 40 coins and 2 reputation. Everything costs 23,550 coins and earns about 1,745 a night at its grandest, so it is a goal for after the story. Trophies: Stallholder, Quarter Magnate and Till Keeper.

**Both heroes.** Dora and Enzo are always in the world together. The partner follows a little behind and to the side (running faster to catch up when more than 110 away), climbs the fire ladders after you, hops on with you (pillion on a scooter, on a trishaw's bench, in a boat's bow; inside the cab of a tuk-tuk or van), hides when you hide and cheers a job done. A partner off screen (more than 1,150 away) for long, or stuck against something, catches up out of sight, so they are never lost. Tab, or a click on the partner's portrait, switches heroes: the camera eases across, the save remembers who you play, and the hero you leave keeps doing what they were told (one simply walking with you keeps following; one posted by a job stays at the post). On a shared ride the passenger takes the handlebars.

**Tag-team moves** (F; the green prompt says what F will do). On a ride with the partner behind you: they grab (a magpie's loot within 130, 156 on Assist, a thief's prize, the loot-bag magpie). At seven walls with crates against them (four on the Arcade Strip, three in the Night Market): the partner boosts you onto the roof, and from the roof edge you haul them up. Near a magpie: the partner pounces on it; where a job's chase ends with a double pounce, you dash into the thief within 0.8 s of the partner (1.2 s on Assist). With lanterns lit and a warden within 560 of the partner: they wave and dance where the warden can see, and wardens within 650 stop to stare for as long as it lasts (5 s). Otherwise F tells the partner to wait or calls them over. Jobs add a lever or shutter to hold, a rope to haul and a partner to boost. Every move has its own painted pose for both heroes.

**Jobs for two.** Thirteen of the 25 jobs need both: Hot Wok, Cold Trail ends only with a double pounce, and The Silver Koi with a net or the passenger's grab; Whistle Stop's crates on the balconies need the passenger's grab or a shot; Shadow the Feathers is a relay (from the third waypoint Pip knows the starter, so you switch to the partner waiting ahead); The Jade Dragon ends with the passenger's grab; The Lion Wakes and Lantern Parade bring magpies from both sides while the partner guards the far flank; The Golden Bell's loot is carried off by a circling magpie you knock it from; The Pearl Lantern's lock gate stays shut until the partner holds the lever; Container Maze has a shutter the partner holds while you slip in; Jump-Start Jamboree posts the partner at one van while you switch to work it; Rooftop Relay starts with a boost onto the roofs and hands the race to the partner for the last marks; Crack the Claw has a lookout at a window the partner distracts (or a paint shot blinds); and Glint's float only swings in under the flags while the partner hauls the bunting rope (on Assist they go there by themselves). Every one of them stays finishable without firing a gadget on Assist (the test plays them all with gadgets off).

**Gadgets.** Six festival toys, never weapons, from the story (free) or Tock's toy stall in the Night Market (open after Hot Wok, Cold Trail). Each hero carries two; 1 and 2 or the mouse wheel swap, X reloads, the mouse aims and a click fires (hold to keep firing). Assist bends a shot toward the nearest fair target within 0.42 rad of where you aim; with no recent mouse it picks the nearest target anywhere. On a ride, the one behind fires.

| Gadget | Given by | Price | Clip | Reload | Range | Pack (price) | What it does |
|---|---|---|---|---|---|---|---|
| Slingshot | Whistle Stop | 120 | 6 | 0.9 s | 560 | 12 (20) | a magpie gets dizzy and drops what it holds; a cart wobbles |
| Paint squirter | Whistle Stop | 160 | 5 | 1.1 s | 440 | 10 (25) | blinds a lookout; dizzies a magpie; splats on stalls |
| Popper box | The Lion Wakes | 200 | 3 | 1.2 s | 400 | 6 (30) | lobbed: a burst that stuns everything within 110 |
| Net launcher | Night Shift | 260 | 2 | 1.6 s | 470 | 4 (40) | catches a magpie, tangles a getaway cart for 2.2 s |
| Bubble blower | Learn the Water | 180 | 8 | 1.0 s | 300 | 16 (25) | three bubbles that slow what they hit; soapy puddles trip wardens (1.4 s) |
| Confetti cannon | Neon Night Race | 220 | 2 | 1.4 s | 320 | 4 (30) | a burst (150) that scatters a whole flock |

Two tune-ups per gadget (150 to 480 coins) each add half a clip, a quarter more power and a fifth off the reload. A satchel holds six clips. Red supply crates beside every market, safe house and garage refill one pack of everything and come back after 150 s. Hitting a warden stuns them (0.5 s for confetti up to 2.5 s for a net) with its own pose and adds 0.3 heat (confetti 0.15); splattering a passer-by adds 0.15 (confetti only makes them cheer), and the first splat on a stall's awning in 30 s makes the stallholder cross (0.12).

**Two players** (pause menu, or Start on a gamepad). Player 2 plays the partner on the arrows, / dash, . hop, , or Enter action, ; fire, ' gadget, L tag-team and right Shift sneak, or a gamepad (stick, A dash, B hop, X action, RT or Y fire, the shoulders swap gadgets, LT sneaks). The camera frames both and zooms out a little; a leash (1,050 across, 600 up and down) holds back whoever is running away. Switching is off with two players; a job's switch step simply hands the lead over. Player 2 can board player 1's ride as the passenger.

**Game feel** (`JUICE` in `lib/jade-juice.ts`). Hits freeze the game for up to 0.11 s and shake the camera by their size; crashes, smashes and set pieces throw painted debris (up to 150 pieces); loot slows time to 0.3 for 0.55 s with a zoom punch, an heirloom for 0.95 s; boosting draws speed lines and a trail of ghosts; the hero squashes on landing and skids on a hard turn at a run; pickups pop and coins tally; a new lantern of heat flashes the screen. Settings has Screen shake and Reduce shake (gentler shake, no flashes, shorter slow-mo), and the game follows `prefers-reduced-motion`. Hit-stop and slow-mo scale the loop's time, never the engine's steps, so runs stay deterministic.

**Voices.** Dialogue types out at 48 letters a second (90 with reduced motion) with each speaker's babble voice; a press shows the whole line, the next moves on. Every line names a mood, and each speaker has three or four painted portraits (calm and some of happy, worried, angry, sly, sad or surprised).

**Medals.** Every story job has three marks, shown in the job offer and the jobs book before you start: under its par time (about 1.7 times the scripted solver's time from the safe house), no more lanterns than the job itself asks for, and no retries. One mark is bronze, two silver, three gold; best medal, best time and plays are kept. Any finished job can be replayed from the jobs book in the pause menu (it pays a quarter of its reward).

**Lessons.** A new game teaches one thing at a time, when it matters, with the right key or touch button: move, run, dash, hop, the tag-team key, switching heroes when a job asks, firing a gadget, getting on a ride, boost, honk, the map, the market, heat, hiding and sneaking. A lesson stays until you have done it once; the pause menu has a Controls page.

**The living city.** Twelve main crossings (the roads at rows 30, 46 and 62 with the avenues at 26, 42, 60 and 90) have lights on a 15 s cycle: one road has 5.5 s of green and 1.5 s of amber while the other is red, with an all-red moment between. Cars stop at the line on red and on an amber they could stop for; one already past the line clears the crossing. Up to 30 townsfolk walk to doors, stalls, food-court seats and benches; they cross roads only on the zebras, waiting for the green or for a gap in the traffic, sit and eat at the tables, open umbrellas in the rain, and stop to watch a busker. Each night has up to two seeded showers. In free roam a street event starts every 45 to 85 s near you: a magpie snatches a mango (dash into it or ride it down, 40 coins), a duckling follows you home to its mother (50), a broken-down van needs leaning into on foot for about three seconds (45, and the van starts), or a busker draws a crowd (tip 5 coins for a market tip). The phone gets texts: a job offer when a job opens, a tip at the start of most nights that really lifts that price, and a shout when an event starts. Each district has its own ambient sound, and every ride has a radio with several original stations (R or tap the radio to switch).

## The city

After the plan is built, `lib/jade-remodel.ts` merges groups of four shophouses into six painted landmarks (a food hall and an opera house in the Night Market, a bell tower on Temple Hill, a clock tower by the canal, a cinema on the Strip, and a lighthouse on the harbour wall), opens others into plazas with a fountain, banyan, koi pond, bamboo, a crane statue and benches, sets food-court tables beside the markets, and lays curving painted footpaths through the temple park and the plazas. 36 more building pictures were painted, and no two touching buildings share a picture. Five districts, each with a market, a safe house and contacts: the **Night Market** (south-west; shophouses, stalls, the wok stall and the first garage), **Temple Hill** (north-west; the temple, its hundred steps and the pagoda), the **Canal Quarter** (the middle; a canal with bridges, jetties and boats; the second garage), the **Docks** (south-east; warehouses, a container yard, the pier) and the **Arcade Strip** (north-east; neon). The map is a painted paper map of the real layout, tinted and framed by district, with painted fog over closed districts, landmark icons, name plaques and pins for markets, safe houses, garages, side gigs, jobs, found lucky cats and painted murals. Drag to pan, pinch or scroll to zoom; tap a pin (or open ground) for its name and Route here. After the last job the quarter dresses for the Lantern Festival: lantern arches over the streets, giant rabbit, carp and float lanterns, a stage you can dance on, poles where you let sky lanterns go, and fireworks overhead. Parked rides are placed out of the traffic; boats moor along the canal and harbour edges.

## The story

| Chapter | Jobs | Heirloom |
|---|---|---|
| 1 · Night Market | Opening Night, Hot Wok Cold Trail, Whistle Stop, Shadow the Feathers, The Jade Dragon | Jade Dragon |
| 2 · Temple Hill | Auntie's Tea Run, The Hundred Steps, The Lion Wakes, Wedding Cake Weather, The Golden Bell | Golden Bell |
| 3 · Canal Quarter | Learn the Water, Dumpling Disguise, Hot Tip, Wobbly Cargo, The Pearl Lantern | Pearl Lantern |
| 4 · Docks | Night Shift, Container Maze, Hot Goods, Jump-Start Jamboree, The Silver Koi | Silver Koi |
| 5 · Arcade Strip | Neon Night Race, Rooftop Relay, Crack the Claw, Lantern Parade, Glint's Last Flight | Phoenix Drum |

A painted storybook (four panels) opens a new game, a painted chapter card starts each chapter, and the last job leads into the ending (three panels: the heirlooms home, the lanterns rising, the fireworks), the credits, and festival free roam. All of them can be skipped. Each chapter's last job is a chase for the heirloom (the third, The Pearl Lantern, is on the canal by boat; the last is three chases against Madame Glint). Every job has checkpoints; a failure restarts it from the last one, with your ride, what you carry and your heading as they were then.

## Art pipeline

Codex paints every sprite, building, ride, person, prop, ground texture, mini-game scene, portrait and interface piece; code draws only light, glow, shadow, fog, lantern cables and route lines. The prompts are in `docs/jade-street-art/jobs.py` and `jobs2.py` (the second batch: the loading screen, five stall scenes with their keepers, the map paper, frame, icons and fog, the storybook, chapter cards and ending, medals, phone and controls pictures, new hero actions, seated townsfolk, street events, street props, the festival, fireworks and 24 buildings and landmarks) with the shared style in `style.txt`, and `gen.py` runs Codex image generation (up to six at once). The painted mock-ups that set the look are `mock-play.jpg`, `mock-city.jpg` and `mock-trade.jpg` there. `python3 scripts/jade-art.py <folder of paintings>` keys out the flat background, removes the magenta cast from fur and jackets, keeps Dora's fur cream-white, cuts each sheet into frames, scales them to world size, packs nine WebP atlases (about 13 MB with the textures and the full-screen paintings, in `public/art/jade-street/`) and writes `lib/jade-art.ts`. Each hero has walk and run cycles in three facings, idle, sneak, dash, hop, carry, bump, pickup, hide, climb, talk, swap, paint, pick, door, sleep, wave, cheer, caught, and riding poses for the scooter (and a bump and a cheer on it), the trishaw's pedals and the boat's pole; in a tuk-tuk or van the hero is inside the cab. Outfits and paints are hue shifts of the painted frames, cached per variant.

## Tests

- `npm run test:jade`: 31 engine tests, then 14 more for the third pass in `tests/jade-more.mjs`, then 12 for the fourth in `tests/jade-duo.mjs` (the partner over 70 s random walks in every district never off screen for long, never in a wall; switching on foot, on a shared ride and with a posted partner; the passenger seat and hiding; boost, haul, pounce, distract and the grab; at least ten team jobs and the lock gate shut until the lever is held; all 25 jobs finished by the casual bot with gadgets off; every gadget on magpies, wardens (heat), townsfolk and stalls; shots in flight, puddles, bursts and the net on a getaway; clips, reloads, empty satchels, crates and the stall; two players and the leash; v2, v3 and v4 saves migrating to v5 with the story's gadgets; the fourth batch of paintings) (a failure provoked in every job and every one showing a meter or warning first; the getaway, troupe and fragile meters; each set piece's trigger, telegraph, knock-down and blocked tiles and a retry from its checkpoint; Glint's phases and the leap; business prices, takings, the till cap and balance; raids won, lost and quit; the v2 and v3 saves migrating to v4; a painted portrait for every line's mood; the third batch of frames), listed in the README guide, including traffic lights, townsfolk, street events, rain, medals, difficulty, the v2 to v3 save migration, lessons, the phone, the grid-breaking and every painted asset. The two slowest play every job with a scripted solver (`playMission` from `tests/jade-bot.mjs`, perfect profile), then play each non-dialogue step again with a failure forced the first time it is reached, to prove every checkpoint restores to a finishable state.
- `npm run bot:jade`: a casual bot (reacts 0.2 to 0.3 s late, wobbles its heading by up to 0.28 rad, misses mini-game timing by up to a whole window) plays every job over ten seeds on Assist and Easy and must finish each at least 90% of the time; Normal and Hard bots (Assist off, slightly steadier, playing each job from a fresh start over eight seeds, waiting at red lights and now and then missing a beat) are reported with how often they finish and how often they finish first time; `--diff` runs only those. The full run also holds Normal and Hard to their targets (both finish at least 97% of runs, Normal fails some first tries, Hard more, and no job averages more than four tries). `--quick` (the same ten casual seeds, one Normal and one Hard run) is part of `npm test`.
- Jade Street is a desktop game (owner, 14-11-2026): there is no mobile optimisation, and new features get no phone checks. The phone passes below are from earlier and are kept while they pass; they may be dropped.
- `npm run test:e2e:jade`: every player action at 1280×800 (keys and mouse), 390×844 and 844×390 (real multi-touch through the DevTools protocol, so the stick stays held while another finger taps Dash or Honk), with sideways-scroll and contrast checks on every screen and a failure on any page or console error. `SHOTS=<dir>` saves the screens.
- The fourth pass's browser checks (`tests/e2e/jade-street-4.mjs`, 1280×800 only) press every new action with a real key or click: both portraits, Tab and the portrait click, boost and haul, the pounce, the distraction, each gadget fired with the mouse (with its pose), held fire, 1, 2, the wheel, X and a slot click, a magpie and a warden hit, the passenger's grab and back-seat fire, the lock lever, Tock's stall (ammo, tune, give), the Controls page, and a second player from the pause menu on the keyboard and from a fake gamepad (Start joins and leaves).
- `npm run play:jade`: plays two minutes in each district at 1280×800 with keys, rides, five-lantern heat, rain half the time with a busker's crowd gathered, and constant jumps to fresh streets, and fails under 55 fps.

### Results (15-11-2026, fourth pass: both heroes and gadgets)

Bots (now using the partner and gadgets: tag-team moves, switching, firing at magpies, carts and lookouts): the casual bot on Assist and Easy finished all 25 jobs in all ten seeds (100%), and it also finishes every job with gadgets switched off. With Assist off over eight seeds a job, Normal finished 100% and 88% first time, Hard 100% and 77% first time; no job averages more than 1.5 tries.

Frame rate on this Mac in headless Chromium at 1280×800, two minutes per district, with the partner following and riding behind and a gadget fired twice a second on top of the third pass's load: 60.0 fps average in all five districts; the lowest half-second was 56.0 in the Night Market.

Browser suite at 1280×800: 396 checks passed (the fourth pass adds 78), no page or console errors, every screen within the contrast check.

### Results (14-11-2026, third pass)

Bots: the casual bot on Assist and Easy finished all 25 jobs in all ten seeds (100% each; 247 of 250 first time). With Assist off, over eight seeds a job, Normal finished 100% and 90% first time, with first-try failures in ten jobs (The Hundred Steps, Wedding Cake Weather, Dumpling Disguise, Wobbly Cargo, The Pearl Lantern, Container Maze, Hot Goods, The Silver Koi, Neon Night Race and Glint's Last Flight; the lowest is 5 of 8 first time) and no job above 1.5 tries on average. Hard finished 100% and 75% first time, with first-try failures in sixteen jobs; the hardest are Container Maze (1 of 8 first time, 3.6 tries on average) and Hot Goods (1 of 8, 2.5 tries). The Pearl Lantern, which failed the casual bot once in ten on the second pass, was a real bug (the thief's loot could land on the quay out of reach of the boat) and is fixed.

Frame rate on this Mac in headless Chromium at 1280×800, two minutes per district, half of it in rain with a busker's crowd, every stall at its grandest and hits, smashes, debris and heirloom slow-mo firing every few seconds: 60.0 fps average in all five districts; the lowest half-second was 54.2 in the Night Market and 60.0 everywhere else. No page errors.

Browser suite: 868 checks passed (292 at 1280×800, 288 each at 390×844 and 844×390) with no page errors, before the owner ruled Jade Street desktop-only; the third pass's checks now run at 1280×800 only, while the older phone passes still run as they were.

## What is weakest

- **The partner is guided, not clever.** They follow on the flow fields and catch up out of sight when stuck or far off screen; they never pick a fight, fire a gadget or choose a tag-team move on their own. That is on purpose (direct control and predictability first), but it means the partner only helps when you press F.
- **Two players share one screen and one keyboard well, two gamepads not at all.** Player 2 has the right side of the keyboard or one gamepad; player 1 always uses the keyboard and mouse. The gamepad was tested with a fake pad in the browser suite, not a real controller.
- **Thirteen team jobs, not twenty-five.** The other twelve still play as before with the partner tagging along (and cheering), which is fine for deliveries and races but is a missed chance in a few.
- **Gadgets make some jobs easier.** A net on a getaway or paint on a lookout is quicker than doing it the old way; the medals' par times were not retuned for gadgets, so golds are a little easier than on the third pass.

- **Normal's failures are not spread across most jobs.** First tries fail in ten of the 25 jobs on Normal; the other fifteen (deliveries with generous timers, the tutorial jobs, side trips) are hard to fail for a steady player. Tightening them further made the easy jobs unfair for the casual bot before it made them interesting.
- **Hard leans on two jobs.** Container Maze and Hot Goods account for most of Hard's retries; Container Maze averages 3.6 tries, a little over the three we aimed for, even with the retry easing.
- **The bots are not people.** They react late, wobble and lapse, and they now wait at red lights, but they do not misread a telegraph or panic; the numbers are a guide, not a measurement of players.
- **The set pieces are scripted to each chase's route.** They fire where the thief goes, so a player who cuts across the city can sometimes miss one.
- **The businesses are a modest economy.** Six stalls at their grandest earn about 1,745 coins a night against 23,550 to buy everything; there is nothing to spend a fortune on once the outfits and garage are bought.
- **The city is still built on a grid underneath.** Landmarks, plazas and curving paths break it up, but the roads themselves are straight.
- **Phones are not a target.** The game is desktop-only; the older touch checks still pass in Chromium's phone emulation, but the third pass's features were not designed or checked for phones.
- **The contrast check skips text over paintings or the canvas**, where no single backing colour exists; those labels rely on their dark plates and outlines.
- **Sound is synthesized**: the score, babble voices, radio, ambience and effects are WebAudio; there are no recorded instruments or voices.

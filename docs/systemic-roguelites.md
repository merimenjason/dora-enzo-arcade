# Fifteen systemic roguelites (05-11-2026)

Strategy-first roguelites for a solo developer making a 2D pixel-art game. In each one, the depth comes from a few rules that interact, not from lots of content. They were narrowed down from about sixty candidates. Each originality audit is meant to be sceptical; several ideas only partly clear that bar, and those audits say so.

Scores are out of 10 and weighted: originality 25%, emergent depth 25%, replayability 20%, solo feasibility 15%, pixel clarity 10%, commercial hook 5%. The table and the top five prototypes are at the end.

---

## 1. Turn Order

**A. Pitch.** Nothing on the board is yours; you only decide who moves first.

**B. The unusual mechanic.**
- The board is 8×8, with 6–10 critters. Each critter has one fixed verb:
  - **Pusher:** shoves whatever is in front of it 1 tile.
  - **Eater:** removes an adjacent smaller thing.
  - **Grower:** copies itself into an empty neighbour.
  - **Bomber:** clears its 3×3 area after acting.
  - **Turner:** rotates its neighbours 90°.
  - **Sleeper:** inert until something hits it.
- Every round, each critter acts once, in the order on the queue bar.
- **Your only action:** one adjacent swap in the queue per round. You can also spend a token to move one slot anywhere.
- New critters join the end of the queue.
- *Into the Breach* shows you the enemies' order. Here the order is the only lever you have, and the same pieces produce very different results depending on how you sequence them.

**C. First 60 seconds.**
1. The goal is to get the seed into the pot. On the board are a seed, a Pusher facing it, an Eater next to it and a Grower.
2. The queue is Eater → Pusher → Grower. The ghost preview shows the Eater eating the seed.
3. Swap the first two: the Pusher now shoves the seed clear first, and the Eater bites air.
4. The preview now shows the Grower copying the Pusher, which creates a second Pusher facing the pot. Commit the round.

**D. Systemic engine.**
1. **Queue:** takes your swaps and outputs the action order.
2. **Verb interpreter:** takes the board and the order, and outputs the next board.
3. **Spawning:** Growers lengthen the queue.
4. **Tokens:** finishing a board under par earns tokens.
- **Feedback loop:** more Growers make a longer queue, so a single swap reaches less of it. But Growers are the only way to get more Pushers.

**E. Emergent strategies.**
1. **Eater sandwich.** Put a Grower just before an Eater, and the Eater always eats the fresh copy. Population stays stable while the Grower's copies keep landing on plates for a turn.
2. **Counterintuitive: let the Bomber go first.** It destroys your own Pushers, but it clears the jam so a late Pusher has a free lane.
3. **Turner last.** Put the Turner at the end of the queue and it re-aims every Pusher for next round, so one swap programs two rounds.

**F. Roguelite structure.**
- **A run:** 10 boards and a boss board, about 35 minutes.
- **Losing:** running out of rounds on a board three times.
- **Randomised:** layouts, the mix of critters, targets, and one mutator per board, e.g. "the queue reverses after each round".
- **Persists:** new verbs added to the pool, not more power.
- **Starting choice:** a "conductor" with one queue rule, e.g. "one long-range swap per board" or "you may freeze one slot".
- **By run 20:** the verb pool is twice as large and combinations you've never seen appear.

**G. Dilemmas.**
1. **Spend a token now, or bank it for the boss?** The boss mutators are unknown, so neither choice is always right.
2. **Finish under par, or clear the board fully?** Finishing under par earns a token; clearing fully lets you carry one critter onto the next board, which might be exactly what that board needs.
3. **Recruit a powerful verb?** A Bomber is strong, but every verb you add to the pool makes every later board less predictable.

**H. Pixel-art presentation.**
- Top-down at 320×180, with 16px tiles and critters, and one colour per verb.
- A queue bar of portraits runs across the top, and ghost arrows preview the round.
- During the round, each critter's queue number flashes as it acts, so chains read like a drum roll.

**I. One more run.** Every loss is a clear "if I'd swapped those two..." lesson, and new verbs promise combinations you haven't seen.

**J. Viral moment.** One swap, then ten critters act in sequence: push, turn, push, eat, grow, push. The seed drops into the pot on the last action.

**K. Scope.**
- **Complexity:** prototype 3/10, full game 5/10.
- **Core systems:** grid, queue, verb interpreter, preview.
- **Biggest risk:** generating boards whose solutions aren't obvious. A breadth-first solver over swap sequences can grade them.
- **Art:** about 5 asset categories.
- **Two-week prototype:** 6 verbs, 10 hand-built boards, and the preview.

**L. Originality audit.**
- ***Into the Breach:*** turn order matters and the board is deterministic. But you move units there, while here you move nothing except the order. That difference is enough.
- ***Baba Is You:*** you change rules. Here the rules are fixed and you change the sequence.
- **Zachtronics:** you program machines. Those are open sandboxes, while this is one swap a round under pressure.
- **Verdict:** a separate game is justified. The risk is that it plays as a puzzle game with a roguelite wrapper on top.

---

## 2. Delay Line

**A. Pitch.** Everything you do happens again three turns later, whether you like it or not.

**B. The unusual mechanic.**
- Turn-based grid with one action a turn: move, push, pull, pick up, drop or ring a bell.
- Every action is recorded. Three turns later, an echo (a see-through copy) repeats it from where you were.
- Echoes are physical: they push crates, hold plates down, ring bells, and can shove you.
- The delay is a rule that relics change: 2, 3 or 5 turns, or "echo twice".

**C. First 60 seconds.**
1. A door needs two plates held down at once, and you are one chinchilla.
2. Turn 1: step on plate A. Turns 2–3: walk to plate B.
3. Turn 4: your echo steps on plate A, and the door opens.
4. In the next room, a Grumble chases whichever body moved last, and that includes your echoes.

**D. Systemic engine.**
1. **Action recorder:** a queue of your past actions.
2. **Grid physics:** pushing, weight, plates.
3. **Grumbles:** they react to the nearest body that moved.
4. **Delay modifiers.**
- **Feedback loop:** your past self draws enemies, so routes you walk become decoys three turns later. That changes how you walk now.

**E. Emergent strategies.**
1. **Decoy walk.** Walk toward the Grumble and back. Three turns later, your echo walks into it and gets caught while you slip past.
2. **Counterintuitive: get pushed by your own echo.** Being shoved by your past self is a free move, so you can set up an echo to push you across a gap you couldn't otherwise cross.
3. **Pre-recording.** In a quiet room, do "useless" actions by the exit. Echoes carry through doors, so they fire as you arrive in the next room.

**F. Roguelite structure.**
- **A run:** 12 rooms over 3 floors, about 25 minutes.
- **Losing:** you have 3 hearts, lost to traps and Grumbles.
- **Randomised:** generated plate, door and crate rooms, plus mutators.
- **Persists:** new actions (pull, throw) and new mutators.
- **Starting choice:** the delay length. A delay of 2 is tactical; 5 lets you set up long plans.

**G. Dilemmas.**
1. **Act for now, or act for your echo?** The best move now is often a bad move in three turns.
2. **Take a longer delay?** It enables bigger set-ups but is riskier.
3. **Take "echo twice"?** It doubles your power and also doubles the chaos.

**H. Pixel-art presentation.** A top-down 16px grid. Echoes are drawn in a ghost palette with a countdown badge, and a timeline at the bottom shows the queued echoes.

**I. One more run.** Moments where your past self rescues you, and puzzles that change character whenever the delay changes.

**J. Viral moment.** The player walks a figure-8 doing nothing useful. Three turns later, a parade of echoes opens three doors at once.

**K. Scope.**
- **Complexity:** prototype 3/10, full game 5/10.
- **Biggest risk:** keeping eight echoes readable on screen at once.
- **Art:** about 6 asset categories.
- **Two-week prototype:** a fixed delay of 3, 4 actions, 8 rooms.

**L. Originality audit.**
- ***Braid:*** one world has a shadow that repeats your earlier actions. This is the closest match.
- ***Super Time Force:*** replays of yourself fight alongside you.
- ***The Swapper:*** clones of yourself.
- **What's different:** a fixed, rule-changeable delay as the whole game, played turn by turn on generated rooms.
- **Verdict:** a borderline case. It's justified only if the delay rules really vary across runs.

---

## 3. Taxonomist

**A. Pitch.** Sort the animals into drawers, and whatever drawer you choose, they become.

**B. The unusual mechanic.**
- Every creature has 3 visible traits: colour (4 options), shape (4) and habitat badge (4).
- Your cabinet has drawers, each labelled with a verb: Sleeps, Flees, Feeds, Breeds or Glows.
- Pinning a specimen in a drawer applies that verb to every creature in the meadow sharing at least 2 traits with the specimen.
- Each day the ecosystem runs: predators eat prey in reach, prey eat plants, and breeders multiply, with offspring mixing their parents' traits.
- You never place or control a creature. You only choose examples.

**C. First 60 seconds.**
1. The goal is to keep the red flowers uneaten for 7 days. There are twenty creatures.
2. Hover a green round beetle. Everything it would cover lights up: green round things, green meadow things and round meadow things, including the frog that eats the beetles.
3. Pin it in "Sleeps" anyway, or pick a different specimen with a narrower cover. Then advance the day.

**D. Systemic engine.**
1. **Trait similarity:** decides which creatures a pin covers.
2. **Verbs:** the effect applied to them.
3. **Ecology:** the food web and populations.
4. **Specimen supply:** pinning takes that individual out of the meadow.
- **Feedback loop:** breeding creates new mixes of traits, which changes what future pins cover, so the puzzle rewrites itself.

**E. Emergent strategies.**
1. **Hybrid key.** Breed a cross that shares 2 traits with both a predator and its prey, so one pin covers both.
2. **Counterintuitive: put a predator in "Breeds".** More predators eat the over-breeding prey that were stripping the flowers.
3. **Glow decoy.** In this game, glowing pulls fleeing creatures toward it. Pin a far-corner species into "Glows" to drain the flower bed.

**F. Roguelite structure.**
- **A run:** a season of 5 meadows, each 7 days, about 40 minutes.
- **Losing:** two missed targets.
- **Randomised:** which trait mixes form species, the edges of the food web, the targets, and the verbs offered.
- **Persists:** new verbs and a new trait axis (call sounds).
- **Starting choice:** a cabinet. Three broad drawers, or five precise ones that need 3 shared traits.

**G. Dilemmas.**
1. **A precise pin, or a broad one?** A broad pin causes collateral effects.
2. **Use your best specimen now?** Pinning it removes it, so it stops breeding.
3. **Which verb goes in your limited drawers?**

None of these has a fixed answer, because the food web changes every run.

**H. Pixel-art presentation.**
- A top-down meadow at 320×180, with 12px creatures built from parts: colour × silhouette × badge. That means very few base sprites.
- The cabinet sits on the right.
- Coverage shows as outlines. Shape always backs up colour, so it stays readable for colour-blind players.

**I. One more run.** A set-cover puzzle that evolves as you play, with a constant "if I'd bred the cross first..." pull.

**J. Viral moment.** One beetle is pinned in "Sleeps", and half the meadow drops asleep in a ripple.

**K. Scope.**
- **Complexity:** prototype 4/10, full game 6/10.
- **Biggest risk:** tuning the ecology while keeping it readable.
- **Art:** about 8 categories.
- **Two-week prototype:** 3 traits, 3 verbs, a 3-level food web.

**L. Originality audit.**
- ***Equilinox*** and *SimLife*: ecosystem simulations, but you place creatures there.
- **The card game *Set*:** trait matching, but it's static.
- ***Baba Is You*:** assigning properties, but with exact words. Here they're assigned by a fuzzy example that spreads by similarity.
- **Verdict:** clearly a separate game.

---

## 4. Underwriter

**A. Pitch.** Sell insurance to a village on a disaster map, then decide how much disaster to prevent.

**B. The unusual mechanic.**
- Hazards spread by visible rules: fire jumps to adjacent wood downwind, flood water runs downhill, and Grumble raids hit the weakest wall.
- Each week, villagers ask for quotes, and you set the premium and payout.
- Each villager knows part of their own risk, so the riskiest are the keenest buyers.
- Prevention (firebreaks, levees) lowers your payouts, but it also lowers demand.

**C. First 60 seconds.**
1. A dry wooden quarter sits downwind of the bakery oven. The baker asks for cheap fire cover, which is suspicious.
2. Price him high, decline, or accept and buy a firebreak.
3. End the week. The hazard rolls use dice with shown odds.

**D. Systemic engine.**
1. **Hazard spread.**
2. **Policies.**
3. **Village fear:** after any disaster, everyone wants cover.
4. **Prevention spending.**
- **Feedback loop:** a small fire raises demand and premiums everywhere, while total prevention kills your business.

**E. Emergent strategies.**
1. **Anti-correlated portfolio.** Insure riverside houses (flood) and hill houses (fire) together.
2. **Counterintuitive: let the empty shed burn.** A harmless fire scares the village into buying.
3. **Visible levees.** Build levees only in front of insured houses, and uninsured neighbours see the difference and buy.

**F. Roguelite structure.**
- **A run:** the firm's life, a fiscal year of 12 weeks, about 35 minutes. This is an unusual definition of a run.
- **Losing:** bankruptcy, or the village's trust collapsing because you refused claims.
- **Randomised:** maps, hazard mixes, and what each villager secretly knows.
- **Persists:** new policy instruments (deductibles, group policies).

**G. Dilemmas.**
1. **Prevent, or earn premiums?**
2. **Deny a dubious claim?** It saves money but costs trust.
3. **Spread your risk, or chase the lucrative risky quarter?**

**H. Pixel-art presentation.** A top-down village with 16px tiles. A hazard heat-map overlay shows risk, policy ribbons hang on the insured houses, and fire and flood spread tile by tile.

**I. One more run.** Weeks of quiet tension, then the storm: the "did I price it right?" moment.

**J. Viral moment.** A fire sweeps the map and stops dead at the one firebreak you built in front of every insured house.

**K. Scope.**
- **Complexity:** prototype 4/10, full game 6/10.
- **Biggest risk:** the economy feeling like a spreadsheet.
- **Art:** about 10 categories.

**L. Originality audit.**
- ***Papers, Please*:** judging individuals with hidden information.
- ***SimCity*:** disasters, but you're the mayor.
- ***Offworld Trading Company*:** economic competition.
- **Verdict:** being the insurer is new. The risk is in the tone and in keeping it readable.

---

## 5. Rootmarket

**A. Pitch.** You are the fungus under a forest, trading sugar and water between trees and taking a cut.

**B. The unusual mechanic.**
- The forest is a cross-section. Each tree has surpluses and deficits of sugar (from sun), water and nitrogen (from soil).
- You grow threads of mycelium between roots: graph edges that cost energy.
- Resources flow from surplus to deficit at a rate you set, and you skim a percentage as your own energy.
- Trees that prosper grow, shade their neighbours and drop seeds. Dead trees become nutrient patches.

**C. First 60 seconds.**
1. An oak is rich in sugar and short of water; a birch seedling is the opposite.
2. Link them and set a 10% skim.
3. Advance 5 years. The birch grows and starts shading the fern, which dies and leaves nitrogen behind.
4. Decide whether to let the birch outgrow the oak.

**D. Systemic engine.**
1. **Light and shade.**
2. **Soil grid.**
3. **Flow network with your skim.**
4. **Tree life cycle.**
- **Feedback loop:** a high skim makes you rich and starves the trees, so there are fewer trees and less to trade. Helping saplings creates shade that kills other trees.

**E. Emergent strategies.**
1. **Nurse network.** Keep a dying giant alive with sugar from many saplings, because its height shelters the seedlings from storms.
2. **Counterintuitive: starve a greedy tree.** Cut its thread, and its death releases nitrogen that fuels a boom.
3. **Seasonal arbitrage.** Store sugar in your own body in summer, and sell it at a high skim in winter.

**F. Roguelite structure.**
- **A run:** a forest's century, 100 turns of a year each, about 50 minutes. This is an unusual definition of a run.
- **Winning:** reaching an old-growth target.
- **Losing:** your mycelium's energy hits zero.
- **Randomised:** soil, the mix of species, and fire and drought events.
- **Persists:** new fungal abilities and new tree species.

**G. Dilemmas.**
1. **Skim rate:** wealth now, or a forest later?
2. **Which trees to favour?**
3. **Expand the network, or deepen it?**

**H. Pixel-art presentation.**
- Side view, with the canopy above and glowing threads below, on 8px soil tiles.
- Resources travel the threads as coloured dots: gold sugar, blue water, green nitrogen.
- The palette changes with the seasons.

**I. One more run.** Watching a whole forest result from your choices, and finding new combinations of species.

**J. Viral moment.** A hundred years in fifteen seconds: trees rise and fall over a pulsing web of light.

**K. Scope.**
- **Complexity:** prototype 5/10, full game 7/10.
- **Biggest risk:** making cause and effect clear over long timescales.
- **Art:** about 8 categories.

**L. Originality audit.**
- ***Oxygen Not Included*:** resource flow networks.
- ***SimEarth*:** ecosystem simulation over long time.
- **Small mycorrhizal-network games:** these exist, but none I know of is about trading.
- **What's different:** you act as an arbitrageur, with a skim.
- **Verdict:** clearly a separate game.

---

## 6. Loaded

**A. Pitch.** Every event in the valley is a visible die, and you can move the pips between its faces.

**B. The unusual mechanic.**
- Each turn, the valley's event dice roll: harvest, rain, raid and market price.
- You can see all their faces.
- Your chisel moves one pip from one face to another on any die. Each die's total number of pips stays fixed.
- Dice are linked: rain's result adds to harvest, and harvest pushes the market price down.
- Special faces (fire, double) can also be moved.

**C. First 60 seconds.**
1. You need to feed 10 villagers by turn 5. The raid die hits on a 5 or 6.
2. Move a pip from the raid die's 6 face onto its 1 face. The probability bar updates.
3. Roll.

**D. Systemic engine.**
1. **Die faces.**
2. **Link graph between the dice.**
3. **Stores.**
4. **Chisel charges:** earned from good outcomes.
- **Feedback loop:** a big harvest crashes the market price, so you earn fewer coins and fewer chisels.

**E. Emergent strategies.**
1. **Flatten a die.** Make every face a 3, so you know exactly what you'll get.
2. **Counterintuitive: make drought likely.** Drought spikes the market price while you sell your stores.
3. **Rewire a link with a relic.** Link rain to raids: wet Grumbles stay home.

**F. Roguelite structure.**
- **A run:** 30 turns, about 25 minutes.
- **Losing:** the village starves.
- **Randomised:** which dice appear, their links and their special faces.
- **Persists:** new dice and new link relics.

**G. Dilemmas.**
1. **Certainty, or expected value?**
2. **Chisel now, or save it?**
3. **Which link to rewire?**

**H. Pixel-art presentation.** A small valley sits above a large dice tray, with each die shown flattened out so you can see all its faces. Pips fly between faces when you chisel. The game needs fewer than 20 unique sprites.

**I. One more run.** You're engineering probability: Balatro-style jackpot moments without a deck.

**J. Viral moment.** Six pips are chiselled onto a single face of the raid die until it reads 0, 0, 0, 0, 0, 18: a one-in-six apocalypse, or nothing at all.

**K. Scope.**
- **Complexity:** prototype 2/10, full game 5/10.
- **Biggest risk:** the maths has to stay readable.
- **Art:** about 5 categories.

**L. Originality audit.**
- ***Slice & Dice*:** upgrading die faces. This is the closest match.
- ***Dicey Dungeons*:** dice manipulation in combat.
- ***Balatro*:** combinatorial scoring.
- **What's different:** the dice are world events, pips are conserved, and links chain the dice together.
- **Verdict:** a moderate difference, so be careful that it doesn't read as *Slice & Dice* without the fighting.

---

## 7. Seams

**A. Pitch.** The board's edges are stitched together however you like. Rewire them, and anything that walks off arrives somewhere new.

**B. The unusual mechanic.**
- The board is 6×6, and each edge segment is linked by a seam to another edge segment, with an orientation.
- Movers have simple rules: Grumbles walk straight, boulders roll, water flows.
- Each turn you may restitch one pair of seams.

**C. First 60 seconds.** A Grumble walks toward your burrow on the right. Restitch the right edge of row 3 to the top of column 1, and it re-enters walking downward into the pond.

**D. Systemic engine.**
1. **Seam map.**
2. **Movers.**
3. **Flows.**
4. **Restitch budget.**
- **Feedback loop:** loops you build trap enemies forever, and they also trap your own deliveries.

**E. Emergent strategies.**
1. **A seam-loop prison** for Grumbles.
2. **Counterintuitive: route the flood into your own field.** Water you thought was a threat irrigates the harvest.
3. **A Möbius twist.** Reverse a cart so it hits two targets.

**F. Roguelite structure.**
- **A run:** 8 boards, about 25 minutes.
- **Persists:** new kinds of seam: one-way, twisting.

**G. Dilemmas.**
1. **Use your restitch now, or keep it?**
2. **Build a loop?** It's powerful, but it can trap you too.
3. **Should a seam serve defence or delivery?**

**H. Pixel-art presentation.** Seams are drawn as coloured stitches along the edges, with matching stitches showing which edges are linked. Each linked pair also gets a unique pattern for colour-blind players.

**I. One more run.** Every board teaches you a new way to think about space.

**J. Viral moment.** One cart passes through six seams, visits every corner and lands in the target.

**K. Scope.**
- **Complexity:** prototype 4/10, full game 5/10.
- **Biggest risk:** keeping the links readable.

**L. Originality audit.**
- ***Portal*:** portals you place in space.
- ***Manifold Garden*:** a world that wraps around.
- ***Patrick's Parabox*:** recursion.
- **Verdict:** only moderately different. It could feel like grid *Portal*.

---

## 8. Timetable

**A. Pitch.** Write the village's daily timetables, then watch the day play out, where every meeting has consequences.

**B. The unusual mechanic.**
- Each villager has 8 time slots, and you assign a place to each slot.
- When villagers share a place at the same time, their personalities interact: gossip spreads a mood, trades swap goods, quarrels hurt both.

**C. First 60 seconds.** Put the grumpy miller and the cheerful baker at the well at 9:00, and see whether her cheer spreads or his gloom wins.

**D. Systemic engine.**
1. **Schedules.**
2. **Place capacity.**
3. **Pair interactions.**
4. **Moods and goods.**
- **Feedback loop:** happy villagers offer extra slots you can schedule.

**E. Emergent strategies.**
1. **A cheer relay** through the day.
2. **Counterintuitive: deliberately schedule a quarrel.** Two quarrellers go home early, freeing up the market.
3. **Goods chains** across several meetings.

**F. Roguelite structure.**
- **A run:** one week leading to the festival, about 30 minutes.
- **Randomised:** the villagers' personalities.

**G. Dilemmas.** Capacity versus mixing people; how much to rely on luck; whether to repair a mood now or later.

**H. Pixel-art presentation.** A top-down village with a timeline strip underneath.

**I. One more run.** Clockwork satisfaction as a day you designed plays out.

**J. Viral moment.** One timetable change and the whole village ends the day dancing.

**K. Scope.**
- **Complexity:** prototype 5/10, full game 6/10.
- **Biggest risk:** keeping the pair interactions readable.

**L. Originality audit.**
- ***The Sims*** and ***RimWorld*:** schedules.
- **Zachtronics:** programming.
- **Verdict:** a weak difference.

---

## 9. Hearthkeeper

**A. Pitch.** Heat flows tile by tile across a frozen village. Melt and refreeze the world to survive the winter.

**B. The unusual mechanic.**
- Every tile has a temperature and a material: snow, water, ice, wood or stone.
- Heat spreads by conductivity each tick.
- Snow melts into water above 0°, water runs downhill, and water freezes into ice below 0°.
- Ice is slippery, and it can be a bridge.
- You place and move stoves (which burn wood) and insulation.

**C. First 60 seconds.** Move a stove so the drift blocking the woodcutter's path melts. The meltwater runs into the lane and freezes overnight: a sled road, or a hazard.

**D. Systemic engine.**
1. **Heat diffusion.**
2. **Phase changes.**
3. **Water flow.**
4. **Wood economy.**
- **Feedback loop:** melting opens paths, but the water refreezes somewhere new.

**E. Emergent strategies.**
1. **An ice-bridge ravine.** Flood it deliberately and let it freeze.
2. **Counterintuitive: let a house go cold** to save wood for the cold snap.
3. **A thermal wall** around the orchard.

**F. Roguelite structure.**
- **A run:** one winter of 60 days, about 40 minutes. This is an unusual definition of a run.
- **Randomised:** maps and cold snaps.
- **Persists:** new materials.

**G. Dilemmas.**
1. **Heat paths, or heat homes?**
2. **Burn wood now, or save it?**
3. **Melt the snow?** Meltwater can freeze somewhere worse.

**H. Pixel-art presentation.** A temperature overlay in a cosy palette, with snow melting tile by tile.

**I. One more run.** Every winter's chain reactions are different.

**J. Viral moment.** One stove melts a hillside, and its water freezes into a sled run that delivers wood to the whole village.

**K. Scope.**
- **Complexity:** prototype 5/10, full game 6/10.
- **Biggest risk:** keeping the simulation readable.

**L. Originality audit.**
- ***Frostpunk*:** heat radius.
- ***Oxygen Not Included*:** temperature simulation.
- ***Noita*:** phase changes.
- **Verdict:** moderately different. The new part is phase change as the main lever, on a small turn-based grid.

---

## 10. Sunward

**A. Pitch.** Grow living bridges by steering sunlight with mirrors.

**B. The unusual mechanic.**
- Plants grow 1 tile a turn toward the strongest light. Grown vines can be walked on and hold weight.
- You rotate a limited number of mirrors.
- Plants shade each other.

**C. First 60 seconds.** Angle a mirror, and a vine crosses the gap in three turns.

**D. Systemic engine.**
1. **Light beams.**
2. **Plant growth.**
3. **Shade.**
4. **A traveller who needs paths.**

**E. Emergent strategies.**
1. **Counterintuitive: let a weed grow** so it blocks the beam feeding a thorn bush.
2. **Split beams** to grow two vines at once.
3. **Grow a canopy roof** against the rain.

**F. Roguelite structure.**
- **A run:** 10 cliffs, about 25 minutes.

**G. Dilemmas.** Which mirror to spend; whether to grow fast or grow safely.

**H. Pixel-art presentation.** Side view with glowing beams.

**I. One more run.** Discovering new plant species.

**J. Viral moment.** A garden grows into a bridge in ten seconds.

**K. Scope.**
- **Complexity:** prototype 4/10.

**L. Originality audit.**
- **Laser and mirror puzzles:** many exist.
- ***Grow Home*:** growing plants to climb.
- **Verdict:** a weak difference.

---

## 11. Nested

**A. Pitch.** Win the big board by winning the small boards inside it, where every small board has its own rule.

**B. The unusual mechanic.**
- The 3×3 board has a 3×3 board in every cell, and each small board has a mutator (gravity, swap, no diagonals).
- You play against the Grumbles. Where you move inside a small board decides which small board they must play in next.

**C–K. Summary.** Abstract strategy with drafted rules. It's very feasible: prototype 2/10, and it needs fewer than 20 sprites.

**L. Originality audit.**
- **Ultimate tic-tac-toe:** the core rule is identical.
- ***Patrick's Parabox*:** recursion.
- ***Balatro*:** mutators.
- **Verdict:** not original enough. It's included as a feasibility benchmark.

---

## 12. Etiquette

**A. Pitch.** Seat the guests, and their manners spread round the table like a contagion.

**B. The unusual mechanic.**
- Each guest has a status (1–5) and a manner: slurps, bows, toasts or jokes.
- Each course, every guest copies the manner of their highest-status neighbour, unless they're stubborn.
- You seat arrivals one at a time, and you can see the next three in line.
- Once per course, you can introduce one manner.

**C. First 60 seconds.** Seat the slurping duke between two stubborn aunts, so his slurping can't spread.

**D. Systemic engine.**
1. **The seating graph.**
2. **Status.**
3. **Manner spread.**
4. **Stubbornness.**
- **Feedback loop:** manners carry over to the next banquet.

**E. Emergent strategies.**
1. **Counterintuitive: build a firebreak of stubborn guests.**
2. **Status ladders** that carry a manner the length of the table.
3. **Delay a seating** until the right course.

**F. Roguelite structure.**
- **A run:** a banquet season of 5 banquets, about 30 minutes.

**G. Dilemmas.** Seat for this course, or for the final toast? Use your introduction now, or wait?

**H. Pixel-art presentation.** A top-down banquet hall, with manners shown as tiny emote icons above the guests.

**I. One more run.** Contagion chains, and the final toast.

**J. Viral moment.** One bow ripples down a fifty-seat table.

**K. Scope.**
- **Complexity:** prototype 3/10, full game 5/10.

**L. Originality audit.**
- **Voter and contagion models:** the science behind it.
- **Seating puzzles:** logic, not spread.
- **Verdict:** yes, it's different enough.

---

## 13. Ballast

**A. Pitch.** Your fortress sits on a giant balance. Every unit's weight tilts it, and the tilt aims everything.

**B. The unusual mechanic.**
- The fortress tilts according to the torque of everything on it.
- Cannons fire along the tilt.
- Units slide off when the tilt passes friction.
- Turn-based waves of enemies attack.

**C. First 60 seconds.** Place a heavy hedgehog at the far left: the fortress tilts and the cannons aim down at the ramp.

**D. Systemic engine.**
1. **Torque.**
2. **Friction.**
3. **Projectiles.**
4. **Waves.**

**E. Emergent strategies.**
1. **Counterintuitive: let enemies climb aboard.** Their weight tilts your cannons onto the next wave.
2. **Counterweight dancing.**
3. **Sliding attacks.**

**F. Roguelite structure.**
- **A run:** 10 waves, about 25 minutes.

**G. Dilemmas.** Aim versus stability.

**H. Pixel-art presentation.** Side view, with a big readable tilt.

**I. One more run.** Physics comedy.

**J. Viral moment.** Ten Grumbles climb on board, the fortress tips, and its cannons wipe out the whole wave.

**K. Scope.**
- **Complexity:** prototype 4/10.

**L. Originality audit.**
- ***Tricky Towers*:** physics balance.
- ***Angry Birds*:** physics projectiles.
- **Verdict:** moderately different.

---

## 14. Grudges

**A. Pitch.** You never attack. You make monsters blame each other.

**B. The unusual mechanic.**
- Every creature carries a grudge arrow pointing at whatever last hurt it.
- On its turn, it walks toward that target and attacks it. With no grudge, it attacks the nearest hero.
- Damage is blamed on whatever made physical contact, never on you.
- Your heroes only shove, swap places and redirect hazards.

**C. First 60 seconds.**
1. Shove Grumble A into Grumble B. B now holds a grudge against A.
2. Next turn, B attacks A, and A's grudge flips to B: a feud is born.

**D. Systemic engine.**
1. **The grudge graph.**
2. **Targeting.**
3. **Shoves and hazards.**
4. **Blame rules.**
- **Feedback loop:** feuds pull enemies away from you, but a feud that ends leaves a strong winner hunting the nearest hero.

**E. Emergent strategies.**
1. **A three-way feud loop** that wipes out a whole pack.
2. **Counterintuitive: let a monster hit you on purpose.** Stand where its attack also hits the creature behind you, and that creature's grudge turns on the attacker.
3. **A grudge relay** that drags the boss across the room into a trap.

**F. Roguelite structure.**
- **A run:** 12 rooms, about 30 minutes.
- **Randomised:** enemy types with different grudge rules, e.g. "never forgets" or "grudges its whole pack".

**G. Dilemmas.**
1. **End a feud now?**
2. **Who should come out of it as the winner?**
3. **How much should your hero risk?**

**H. Pixel-art presentation.** A top-down 16px grid, with grudge arrows drawn as red threads between creatures.

**I. One more run.** Clever "they did it themselves" wins.

**J. Viral moment.** One shove sets off a ten-creature brawl, and the heroes walk out untouched.

**K. Scope.**
- **Complexity:** prototype 4/10, full game 6/10.
- **Biggest risk:** making the AI's targeting easy to read.

**L. Originality audit.**
- ***Into the Breach*:** pushing enemies into each other. This is close.
- **MMO threat tables:** creatures choose targets by threat.
- ***Hitman GO*:** deterministic enemy rules.
- **What's different:** the grudge graph is persistent and it is your only weapon.
- **Verdict:** moderately different. The risk is that it reads as "*Into the Breach* with aggro".

---

## 15. Vow

**A. Pitch.** Swear constraints on yourself, and every vow you keep grows in power.

**B. The unusual mechanic.**
- You lay route tiles on a hex map toward a far shrine.
- At any time you can swear one of three offered vows, such as "never put forest next to water". A kept vow grows a power each turn.
- When a vow is forced to break, it shatters and leaves a curse.

**C–K. Summary.**
- **Complexity:** prototype 3/10.
- **Biggest risk:** a thin base layer. Laying tiles isn't interesting enough by itself.

**L. Originality audit.**
- ***Balatro*:** challenges as rule modifiers.
- ***Dorfromantik*:** tile laying.
- **Verdict:** a weak difference.

---

## Scores

| # | Concept | Orig 25% | Depth 25% | Replay 20% | Solo 15% | Pixel 10% | Hook 5% | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | Turn Order | 8 | 9 | 8 | 8 | 7 | 6 | **8.05** |
| 3 | Taxonomist | 9 | 8 | 8 | 6 | 7 | 6 | **7.75** |
| 5 | Rootmarket | 9 | 8 | 8 | 5 | 8 | 7 | **7.75** |
| 6 | Loaded | 8 | 8 | 8 | 8 | 6 | 7 | **7.75** |
| 14 | Grudges | 7 | 9 | 8 | 7 | 7 | 7 | **7.70** |
| 9 | Hearthkeeper | 7 | 8 | 8 | 6 | 9 | 7 | **7.50** |
| 2 | Delay Line | 7 | 8 | 7 | 8 | 7 | 7 | **7.40** |
| 12 | Etiquette | 8 | 8 | 7 | 6 | 7 | 8 | **7.40** |
| 4 | Underwriter | 8 | 7 | 7 | 7 | 6 | 7 | **7.15** |
| 13 | Ballast | 7 | 7 | 7 | 7 | 8 | 8 | **7.15** |
| 7 | Seams | 7 | 8 | 7 | 7 | 6 | 6 | **7.10** |
| 8 | Timetable | 6 | 8 | 7 | 6 | 7 | 5 | **6.75** |
| 10 | Sunward | 6 | 6 | 6 | 7 | 8 | 6 | **6.35** |
| 11 | Nested | 4 | 8 | 6 | 9 | 5 | 3 | **6.20** |
| 15 | Vow | 6 | 6 | 6 | 8 | 4 | 4 | **6.00** |

**Most potential, most risk.**
- **Rootmarket** and **Taxonomist** are the most original. Both rest on ecological simulations, which are the hardest thing here to make readable and to balance.
- **Loaded** is the cheapest to test, but it could collapse into maths a spreadsheet can solve.
- **Grudges** has the deepest tactics, but it lives in *Into the Breach*'s shadow.
- **Nested**, **Vow** and **Sunward** are in the list because they are feasible and give contrast, not because they are the best ideas.

---

## Dora and Enzo casting for the top five

Gameplay mock-ups: `ideas/px-order-play.webp`, `ideas/px-taxon-play.webp`, `ideas/px-roots-play.webp`, `ideas/px-dice-play.webp`, `ideas/px-grudge-play.webp`.

- **Turn Order:**
  - **Enzo** conducts the queue from a podium: one swap a round, and he never touches a piece.
  - **Dora** waits at the goal with a basket and can only catch.
- **Taxonomist:**
  - **Dora** nets specimens in the meadow.
  - **Enzo** pins them into the cabinet's drawers, which are labelled with pictures instead of words: moon sleeps, foot flees, heart breeds, sun glows, sprout feeds.
- **Rootmarket:**
  - **Enzo** listens to the roots underground to hear which tree needs what.
  - **Dora** plants and tends saplings in the canopy.
- **Loaded:**
  - **Enzo** chisels pips between the faces of the dice.
  - **Dora** works the valley and harvests what the dice give.
- **Grudges:**
  - **Dora** shoves and swaps creatures into each other.
  - **Enzo** works the levers that turn the traps.
  - Damage is never blamed on the heroes.

## Top five prototypes

### Turn Order (8.05)

**Minimum playable prototype.**
- One 8×8 board, six verbs and the queue bar with ghost preview.
- One swap a round, with a target and a round limit.
- Ten hand-built boards.

**Core data model.**
```
Critter { id, verb: Push|Eat|Grow|Bomb|Turn|Sleep, x, y, facing, size }
Board   { w, h, tiles[], critters[], target: Predicate, roundsLeft }
Queue   { order: critterId[] }   // new critters append
Round   { swap(i, i+1) -> preview(board, queue) -> commit }
```
Each verb is a pure function `act(board, critter) -> board`. A round folds those functions over the queue.

**One example run.**
1. Pick the conductor with "one free long swap per board".
2. Board 1: swap Eater and Pusher so the seed survives.
3. Swap Grower in front of Pusher, so the copy lands facing the pot.
4. Board 2: use the long swap to move the Bomber to the end, clearing debris after everyone has moved.
5. Draft the Turner verb.
6. Board 3: put the Turner last, re-aiming both Pushers for the next round.
7. Finish under par and bank a token.
8. Board 4 has the mutator "queue reverses each round". Plan for the order flipping.
9. Spend the token to put the Eater straight after the Grower: the Eater sandwich.
10. Boss board: chain three Pushers through a Turner to deliver the seed on the final action.

**First strategic discovery.** The Turner doesn't just rotate things; at the end of the queue it programs the *next* round. One swap now buys two rounds of control.

**Failure conditions.**
- Boards that a solver finds trivial, or that need more than 5 swaps to solve.
- Preview fatigue, where the player just tries every swap.
- Verb pools that leave only a single dominant order.

**Prototype success criteria.**
- Players laugh at chains they didn't predict.
- Players can explain their plan out loud before committing.
- Over a three-board session, players win on average in fewer than four tries per board.

### Taxonomist (7.75)

**Minimum playable prototype.** 3 traits with 3 values each, 3 verbs (Sleeps, Breeds, Flees), a 3-level food web, one meadow over 7 days, and one target.

**Core data model.**
```
Creature { traits: [colour, shape, habitat], diet: tier, hunger, x, y }
Pin      { specimen: traits, verb }        // covers creatures with >=2 shared traits
Day      { applyPins -> move -> eat -> breed (offspring mix parent traits) -> check target }
```

**One example run.**
1. Pick the broad cabinet.
2. Meadow 1, target "the flowers survive". Pin a green beetle in Sleeps, covering the beetles and the snails.
3. Day 2: the frogs starve. Accept that.
4. Day 3: pin a frog in Breeds to rebuild the frogs.
5. Day 5: the target is met.
6. Meadow 2: the target is 10 blue birds. Breed blue birds with meadow moths to make a blue meadow hybrid.
7. Pin the hybrid in Breeds. It now covers both the birds and the moths, which are their food.
8. Draft the Glows verb.
9. Meadow 3: use Glows on a far-corner species to draw the fleeing deer away from the crops.
10. Meadow 4: the remaining drawers are full. Unpin one to free it, which costs its specimen.

**First strategic discovery.** Breeding makes better keys: a hybrid can cover two species no wild creature could cover together.

**Failure conditions.**
- The simulation becomes too chaotic to predict, so pins feel random.
- Coverage previews become clutter.
- One verb dominates every run.

**Prototype success criteria.**
- Players can say why the meadow changed.
- Players deliberately breed hybrids to use as keys within their first three meadows.

### Rootmarket (7.75)

**Minimum playable prototype.** 6 trees of 2 species, 3 resources, threads with a single skim slider, 30 years, and one target.

**Core data model.**
```
Tree    { species, height, sugar, water, nitrogen, x }
Soil    { cells[x][depth]: water, nitrogen }
Thread  { a, b, rate }        // flow surplus->deficit, skim% to Fungus
Fungus  { energy, skim }
Year    { light(shade by height) -> uptake -> flow -> grow/die -> seed }
```

**One example run.**
1. Link the oak and the birch.
2. Set a 10% skim.
3. Year 5: the fern dies. Link the nitrogen patch.
4. Raise the skim to 20% while the birch grows.
5. Drought event: drop the skim to 0%.
6. Year 20: cut the greedy pine's thread.
7. Year 25: the pine dies and the nitrogen boom begins.
8. Grow a new thread to the saplings.
9. Store sugar for winter.
10. Year 30: reach the old-growth target.

**First strategic discovery.** A death can be an investment: starving a tree is how the network gets fertilised.

**Failure conditions.**
- Long gaps between cause and effect.
- A skim rate that is simply always best.

**Prototype success criteria.**
- Players can predict the shade outcome before advancing.
- Players make different decisions about the skim in different droughts.

### Loaded (7.75)

**Minimum playable prototype.** 3 dice (harvest, rain, raid), 1 link (rain adds to harvest), a chisel, and 15 turns.

**Core data model.**
```
Die    { faces: int[6], sum: const }
Link   { from: die, to: die, op: add|sub }
State  { food, coins, chisels, turn }
Turn   { chisel* -> roll all -> apply links -> resolve events }
```

**One example run.**
1. Flatten the rain die to all 3s.
2. Move harvest pips onto its 6 face.
3. Roll and get a high harvest.
4. The market price crashes. Accept it.
5. Save your chisels.
6. Raid season: move all of the raid die's pips onto one face.
7. Roll. It misses.
8. Buy the rain-to-raid link relic.
9. Make rain likely.
10. The Grumbles stay home, and the target is met.

**First strategic discovery.** Linked dice let you push risk around: moving pips on one die changes the odds of the others.

**Failure conditions.** An optimal move that is too easy to calculate; too little variety in the dice.

**Prototype success criteria.** Players take deliberate gambles, and they hesitate before rolling.

### Grudges (7.70)

**Minimum playable prototype.** 3 heroes who only shove, swap and redirect; 2 enemy types; a 10-room run; and grudge arrows on screen.

**Core data model.**
```
Creature { hp, grudgeTarget, rule: forgets|neverForgets|packGrudge }
Hit      { source, target } -> target.grudgeTarget = source
Turn     { heroes act -> creatures act toward grudge or nearest hero }
```

**One example run.**
1. Shove Grumble A into Grumble B.
2. B attacks A, and a feud begins.
3. Swap a hero out of the line of fire.
4. Redirect a spike trap onto the winner.
5. A third Grumble arrives. Shove it into A.
6. The feud now runs three ways.
7. Let one Grumble hit your hero on purpose, so its strike also lands on the creature behind.
8. The grudges flip and the pack collapses.
9. Room cleared.
10. Draft the "pack grudge" enemy type.

**First strategic discovery.** Where you place yourself is your weapon: getting hit can be the attack.

**Failure conditions.** AI targeting that's unclear; feuds that end too fast.

**Prototype success criteria.** Players plan feuds two turns ahead, and the first wipe-out produces a shout.

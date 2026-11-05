# Fifteen action roguelites (05-11-2026)

Action-heavy roguelites for a solo developer making a 2D pixel-art game in Godot 4. Each one is built on a combat verb that action roguelites don't normally have. They were narrowed down from about sixty candidates. The originality audits are deliberately sceptical, and several ideas only partly clear the bar.

Scores are out of 10 and weighted: originality 25%, moment-to-moment fun 25%, replayability and builds 20%, solo feasibility 15%, pixel appeal 10%, viral potential 5%. The ranking and the top five deep dives are at the end.

**How the brief's requirements are covered:**

| Requirement | Concepts |
|---|---|
| Movement or momentum as the weapon | Tetherball, Slipstream, Kinetic, Swapstrike |
| Physics and environment | Gravity Pins, Spillway, Tilt Table, Pillar Punch, Northpaw |
| Unusual enemy manipulation | Copycat, Glare, Stampede, Backspin, Tetherball |
| Unconventional controls | Copycat, Glare, Tilt Table |
| Time and causality | Ghost Strike, Backspin |
| Chain reactions | Tetherball, Gravity Pins, Spillway, Stampede, Pillar Punch |
| Fewer than 20 sprites | Tilt Table, Kinetic, Glare, Slipstream |
| No traditional weapon | Tetherball, Slipstream, Gravity Pins, Copycat, Northpaw, Spillway, Glare, Tilt Table, Kinetic, Backspin, Stampede |

---

## 1. Tetherball

**B. Hook.** Hook an enemy on a rope and swing it like a flail into everything else.

**C. Signature mechanic.**
- Aim with the mouse or right stick, and click to fire a 6-tile tether that latches onto the first enemy it hits.
- While it's latched, the enemy orbits you at rope length. Your movement sets its spin: circling spins it up, and reversing slows it down.
- Whatever the swung enemy hits takes damage equal to the impact speed, and the swung enemy takes the same.
- Click again to release it, and it flies off along its tangent.
- **Mass matters:** a heavier enemy drags *you* around instead.
- **What's different:** you have no weapon. The enemy is the weapon, and its mass and health are your weapon's stats.
- **Why it stays interesting:** every enemy type is a different flail, and the arena is full of things to hit.

**D. Controls.**
- **Move.**
- **Tether:** hook, and click again to release.
- **Dash:** a burst of speed that also yanks the rope.
- **Depth:** dashing at the right point in the orbit can double the swing speed, and the timing of the release sets the angle.

**E. First 30 seconds.**
1. A small arena with five slimes and a spiked pillar.
2. Hook a slime and circle twice. It bonks two other slimes, which go flying with a satisfying *thock*.
3. Release it toward the pillar, and it splats on the spikes.
4. A boar charges. Hook it, and it drags you across the floor.
5. Dash the opposite way: the rope snaps tight and the boar slingshots into the wall.

**F. Systems.**
1. **Rope constraint:** a length limit, with tension shown on screen.
2. **Momentum transfer:** collisions are elastic and weighted by mass.
3. **Damage from relative speed.**
4. **Hazards:** spikes, pits, and walls that break above a set speed.
- **Enemies push back:** mass, armour that only takes damage above a speed threshold, and anchoring enemies that resist being swung.

**G. Spectacular interactions.**
1. **Chain reaction:** fling a bomb beetle into a cluster. The blast knocks three enemies into a pit.
2. **Defensive technique:** swing a shield crab in a tight orbit. It blocks every projectile coming at you, like a meat shield.
3. **Disadvantage into offence:** a golem too heavy to swing drags you instead. Let it pull you through the crowd, and *you* become the flail.

**H. Feel.**
- **Movement:** quick, at 7 tiles a second with tight acceleration.
- **Dash:** 0.15 seconds.
- **Hitstop:** scales with impact speed, from 40 to 90 milliseconds.
- **Readability:** the rope changes colour with tension, and swung enemies draw speed lines. The screen only shakes above an impact threshold.
- **Telegraphs and buffering:** a one-frame flash before a charge, and a 100 ms buffer on the release.
- **With placeholder art:** rope physics and the bonk sound are enough to make it fun.

**I. Run structure.**
- **A run:** about 25 minutes, across 4 biomes of 5 arenas each, plus a boss.
- **Difficulty:** heavier and armoured enemies arrive as the run goes on.
- **Randomised:** each arena's hazards.
- **Upgrades change the rope:** elastic (a bungee whip), twin tethers, a release that explodes, or a longer rope (faster, but harder to control).
- **Persists:** new rope types.

**J. Builds.**
- **Flail:** a long rope for spinning.
- **Slingshot:** an elastic rope; the game is in the release.
- **Anchor:** tether to posts and swing *yourself* through enemies.
- **Bolas:** tie two enemies to each other.
- **Synergy:** bolas plus spin. Two enemies tied together whirl round each other as a moving hazard you can steer by hitting them.

**K. Enemies.**
- **Boar:** charges in a straight line and is heavy, so it drags you around. *Challenge:* redirect it rather than resist it. *AI:* a charge state machine.
- **Shellback:** only takes damage above speed 8, which makes it the perfect flail. *Challenge:* spin up before you hit it. *AI:* wanders around.
- **Kite:** a light flier that does no damage on impact but lifts you over pits. *Challenge:* it's for movement, not damage. *AI:* drifts in sine waves.

**L. Pixel art.**
- Top-down at a three-quarter angle, 320×180, with 16px characters.
- The rope is a pixel chain that stretches under tension.
- **Signature look:** a whirling enemy with speed lines, in every screenshot.

**M. Viral moment.** Hook a boar, circle three times and let go. It bowls through eight enemies and bursts through a wall.

**N. Feasibility.**
- **Difficulty:** prototype 3/10, full game 6/10.
- **Main challenges:** a stable rope (Verlet or a Godot joint), and tuning the damage.
- **Art:** about 10 enemy sprites.
- **Performance:** fine.

**O. Originality audit.**
- **Whip and flail weapons** (*Castlevania*, physics flails in indie brawlers): similar swinging, but your weapon is fixed there.
- ***Grapple Dog*:** tethers are for moving through terrain.
- ***Katamari Damacy*:** you use enemies as mass.
- **Verdict:** enemies as flails with a mass trade-off is meaningfully different.
- **If it feels derivative:** lean harder into heavy enemies dragging you around.

---

## 2. Slipstream

**B. Hook.** You can't attack. Your wake does.

**C. Signature mechanic.**
- Moving faster than walking pace leaves a trail of turbulent air that lasts 1.2 seconds. Its strength scales with your speed.
- Enemies that enter it are pushed along its flow and spun around.
- Where two stretches of wake cross, they form a vortex that pulls enemies together and damages them.
- **What's different:** the shape of your path is your attack, and drawing loops makes traps.

**D. Controls.**
- **Move.**
- **Boost:** hold it to go faster, at the cost of stamina.
- **Brake:** stop dead and send a gust of air forward.

**E. First 30 seconds.**
1. Boost in a circle around a pack of bats.
2. The ring of wake closes into a vortex and sucks the bats together. They collide.
3. Brake, and the gust blows the whole clump into the lava.

**F. Systems.** The wake trail as a vector field, vortex detection where wakes cross, enemy mass, and stamina.

**G. Interactions.**
1. **Chain:** a figure-8 makes two vortices at once.
2. **Defence:** a wake bends projectiles off course.
3. **Disadvantage into offence:** a fast chaser who follows you gets caught in your own vortex.

**H. Feel.** Floaty but responsive. The wake is drawn as pale pixel streaks.

**I. Run structure.** About 20 minutes. Upgrades change the wake: it can be hot, sticky or longer.

**J. Builds.** Vortex trapper, gust sniper, long-wake herder, and a fire wake that spreads flames.

**K. Enemies.** Heavy enemies that ignore weak wake, flyers that ride your wake, and divers that cut through it.

**L. Pixel art.** A sky arena where the wind streaks are the art. It needs fewer than 20 sprites.

**M. Viral moment.** A spiral of wake turns into a tornado full of enemies.

**N. Feasibility.** Prototype 4/10, full game 6/10. The challenge is a flow field that's cheap to compute and easy to read.

**O. Originality audit.**
- **Tron light cycles:** your trail is a hazard there too.
- ***Geometry Wars* Pacifism mode:** you defeat enemies without shooting.
- ***Flower*:** wind as the main tool.
- **Verdict:** only moderately different. It risks feeling like Tron with physics.

---

## 3. Catch & Return

**B. Hook.** Parry a bullet and it starts orbiting you, then throw the whole ring back as one volley.

**C. Signature mechanic.**
- Press parry in a 150 ms window and the incoming projectile is captured into a ring orbiting you, up to 8 at a time.
- Orbiting shots block other projectiles and hurt enemies that touch them.
- Throw releases them all in the direction you aim, and each keeps its own type: fire, bouncing or splitting.
- A fuller ring is wider. That blocks more, but it's harder to fit through gaps.
- **What's different:** enemy fire is your only ammunition.

**D. Controls.** Move, Parry (catch), Throw and Dash.

**E. First 30 seconds.**
1. A turret fires three bolts. Catch two of them, and the third grazes you.
2. A charger runs into your ring and takes damage.
3. Throw the volley, and the turret pops.
4. Now you have no ammo. You need someone to shoot at you again.

**F. Systems.**
1. **Projectile types,** each with its own behaviour.
2. **The orbit ring.**
3. **Parry timing.**
4. **Ammo supply:** shooters supply your ammunition.
- **Feedback loop:** killing the shooters cuts off your ammo, so it's often worth keeping one alive.

**G. Interactions.**
1. **Chain:** catch a bouncing shot and a fire shot, throw them into oil, and the fire spreads.
2. **Defence:** a full ring blocks a laser.
3. **Disadvantage into offence:** being swarmed by shooters means more ammunition.

**H. Feel.** Crisp parries with 60 ms of hitstop and a ring chime. Telegraphed shots flash before firing.

**I. Run structure.** About 25 minutes. Upgrades change the ring: two rings, a slower orbit, or shots that grow while caught.

**J. Builds.**
- **Fortress:** a big ring.
- **Sniper:** throw single shots.
- **Juggler:** catch, throw and recatch.
- **Hoarder:** caught shots grow over time.

**K. Enemies.**
- **Turret:** your supply.
- **Shield-bearer:** reflects your volley, so you have to catch your own shots.
- **Sponge:** sucks shots out of your ring.

**L. Pixel art.** Top-down. The ring of captured shots, each in its own colour, is the signature visual.

**M. Viral moment.** Catch eight different shots, then a single throw clears the room.

**N. Feasibility.** Prototype 3/10, full game 5/10.

**O. Originality audit.**
- ***Furi*** and ***Sekiro*:** parrying.
- ***Katana Zero*:** deflecting bullets.
- ***The Binding of Isaac*:** orbiting items.
- **Verdict:** storing parried shots as ammo and armour is a meaningful twist, but this is the most familiar concept in the top five.

---

## 4. Gravity Pins

**B. Hook.** You can't attack. You drop gravity wells that pull enemies into each other.

**C. Signature mechanic.**
- Tap to drop a pin at the cursor, up to 3 at a time.
- Each pin pulls in enemies and projectiles within its radius, and they collide with each other.
- After 4 seconds a pin collapses and flings everything outward.

**D. Controls.** Move, Pin, and Pop (collapse a pin early).

**E–M. Summary.**
- **The interesting part:** a well placed between a shooter and its target bends the shooter's own bullets around and into its allies.
- **Builds:** repulsor pins, wells that spin enemies, and chained pins.
- **Viral moment:** three wells slingshot one enemy through a whole room.

**N. Feasibility.** Prototype 3/10, full game 5/10.

**O. Originality audit.**
- ***Geometry Wars*:** has gravity-well enemies.
- ***Noita*:** black holes.
- ***Half-Life 2*:** the gravity gun.
- **Verdict:** moderately different.

---

## 5. Ghost Strike

**B. Hook.** Your attacks land where you were one second ago.

**C. Signature mechanic.**
- A ghost of you trails exactly one second behind.
- Pressing attack makes the *ghost* swing.
- So you lead enemies onto your own past path.

**E. First 30 seconds.** Run past a goblin, and a second later your ghost slashes it from behind while you're already safe.

**N. Feasibility.** Prototype 2/10.

**O. Originality audit.**
- ***Braid*** and ***Super Time Force*:** replays of yourself.
- **Verdict:** the idea is original, but the fun is doubtful. Hitting things feels indirect.

---

## 6. Swapstrike

**B. Hook.** Your attack swaps your position with whatever it hits.

**C. Signature mechanic.**
- Throw a swap dart. When it hits, you and the target trade places instantly.
- **Swap with a rocket:** you dodge it, and the rocket now flies at whatever it was heading toward from your old spot.
- **Swap an enemy:** drop it into the pit you were standing next to.

**D. Controls.** Move, Swap dart and a Short slash.

**N. Feasibility.** Prototype 2/10, full game 5/10.

**O. Originality audit.**
- ***The Swapper*:** swapping between clones.
- **Teleport abilities** in action games.
- **Verdict:** moderately different. Its strength is how quick and readable it is.

---

## 7. Copycat

**B. Hook.** Tag enemies, and they copy your every move. Walk them into their own traps.

**C. Signature mechanic.**
- A short-range tag marks an enemy, up to 4 at once.
- For 6 seconds, marked enemies copy your movement inputs: you step left, they step left.
- They also copy your actions. When you dash, they dash; when you attack, they attack whatever is in front of *them*.
- You're steering a squad of enemies with your own body, so you have to move in ways that are safe for you and deadly for them.
- **What's different:** the enemies run on your inputs, not on mind-control AI.

**D. Controls.**
- **Move.**
- **Tag.**
- **Dash:** copied by tagged enemies.
- **Hold (context):** tagged enemies stop copying until you let go.

**E. First 30 seconds.**
1. Three goblins, with a spike pit to the right of the middle one.
2. Tag him, then step right, and he steps into the spikes.
3. Two archers fire at you. Tag both, then turn to face the other archer, and they turn and shoot each other.

**F. Systems.**
1. **Marks,** with durations.
2. **Input broadcast:** your inputs go to every marked enemy.
3. **Action translation:** each enemy's own version of attack and dash.
4. **Hazards.**
- **Enemies push back:** some copy inverted, and alphas break marks when they roar.

**G. Interactions.**
1. **Chain:** tag a bomber and an archer. Swing at thin air, and the bomber explodes beside the archer's pack.
2. **Defence:** tag the charger, then stand still, and it stands still too.
3. **Disadvantage into offence:** surrounded by four enemies? Tag all four. They copy you and walk into each other.

**H. Feel.** Each mark is a coloured thread from you to the enemy, and ghost arrows preview where marked enemies will step. Movement is precise, and tagging has 50 ms of hitstop.

**I. Run structure.**
- **A run:** about 25 minutes.
- **Upgrades change the copying:** inverted copying, delayed copying, or more marks.

**J. Builds.**
- **Puppeteer:** many marks.
- **Mirror:** enemies move inverted.
- **Echo:** enemies copy with a delay.
- **Kamikaze:** marked enemies explode when the mark ends.

**K. Enemies.**
- **Brute:** marks only last half as long on it.
- **Mirror imp:** naturally copies you inverted.
- **Alpha:** its roar clears all marks, so kill it first.

**L. Pixel art.** Top-down 16px. Coloured threads link you to the enemies you control.

**M. Viral moment.** One step, and four enemies march in lockstep into lava.

**N. Feasibility.** Prototype 3/10, full game 6/10.

**O. Originality audit.**
- ***Brothers: A Tale of Two Sons*:** two characters on one controller.
- **Mirror-movement puzzle games:** copying turned into a puzzle.
- ***Hades*'s charm:** enemies fight for you, but they're AI-driven there.
- **Verdict:** copying your inputs in real time is meaningfully new.

---

## 8. Northpaw

**B. Hook.** Flip your polarity, and enemies either fly at you or away from you.

**C. Signature mechanic.**
- One button toggles your polarity.
- Each enemy has a polarity: opposite ones are pulled toward you, and matching ones are pushed away.
- Flick the polarity to slam enemies into each other or into walls. Projectiles have polarity too.

**O. Originality audit.**
- ***Ikaruga*:** polarity absorption.
- ***Teslagrad*:** magnetism.
- **Verdict:** only modestly different.

---

## 9. Spillway

**B. Hook.** Carry buckets of liquid and pour the battlefield.

**C. Signature mechanic.**
- Pour from buckets you refill at fountains: water, oil or honey.
- The liquids flow across a top-down height grid.
- Oil plus fire burns. Water carries lightning. Honey slows things down. Water freezes into ice.

**N. Feasibility.** Prototype 5/10, full game 8/10. The liquid simulation is the risk.

**O. Originality audit.**
- ***Divinity: Original Sin*:** surface effects.
- ***Magicka*:** combining elements.
- ***Noita*:** liquids.
- **Verdict:** moderately different. Pouring as the core verb is the new part.

---

## 10. Glare

**B. Hook.** Enemies freeze while you're looking at them.

**C. Signature mechanic.**
- Your facing is a cone. Enemies inside it freeze like statues.
- Enemies outside the cone move twice as fast.
- Frozen enemies are solid, so others charging in collide with them.
- Projectiles hang in mid-air inside the cone.
- You have no attack.

**D. Controls.** Move, aim your gaze, and Blink (close your eyes for a beat, which unfreezes everything).

**O. Originality audit.**
- **Boo** in *Mario*, which stops when you look at it.
- **SCP-173.**
- ***Superhot*.**
- **Verdict:** using the gaze as the main control in an action game is fairly new.

---

## 11. Tilt Table

**B. Hook.** Tilt the whole arena and everything slides, except you.

**C. Signature mechanic.**
- Two triggers tilt the arena up to 30 degrees.
- Loose enemies and objects slide. You keep your grip, unless you're on ice.
- Spikes and holes wait at the edges.

**O. Originality audit.**
- ***Marble Madness*.**
- ***Tilt to Live*.**
- ***Super Monkey Ball*.**
- **Verdict:** moderately different. Here you tilt the world to fight, not to steer yourself.

---

## 12. Kinetic

**B. Hook.** Run to charge up, then brake to blast.

**C. Signature mechanic.**
- Running fills a meter, and sharp turns drain it.
- Braking releases the stored speed as a shockwave.

**O. Originality audit.**
- **Sonic's spin dash.**
- **Verdict:** the least original idea here.

---

## 13. Backspin

**B. Hook.** Rewind your enemies, but not yourself.

**C. Signature mechanic.**
- Hold to rewind the enemies, up to 2 seconds.
- Projectiles fly back to their shooters and enemies walk backwards.
- Damage stays dealt. Only positions rewind.
- So you can hit an enemy, then rewind it back into the pit it just walked past.

**N. Feasibility.** Prototype 5/10, full game 6/10. It needs every entity's state recorded.

**O. Originality audit.**
- ***Braid*.**
- ***Prince of Persia: The Sands of Time*.**
- ***Superhot*.**
- **Verdict:** rewinding only the enemies is fairly new.

---

## 14. Stampede

**B. Hook.** You can't fight. You spook a herd into trampling everything.

**C. Signature mechanic.**
- Animals graze in a herd that follows flocking rules.
- Shouting sends out a cone of fear: spooked animals flee directly away from you at speed, trampling enemies and anything else in their way.
- The herd tires after a stampede, so it's a resource you have to rest.

**D. Controls.** Move, Shout (a cone), and Whistle (calls the herd toward you).

**E. First 30 seconds.**
1. Twelve sheep graze. Grumble raiders come in from the north.
2. Circle round behind the sheep and shout. They pour north and flatten the raiders.
3. Whistle them back before the next wave.

**F. Systems.**
1. **Flocking.**
2. **A fear field.**
3. **Herd stamina.**
4. **Trample damage,** scaled by herd size and speed.
- **Feedback loop:** a tired herd moves slowly, so you have to protect it before you can use it.

**G. Interactions.**
1. **Chain:** a spooked herd hits a bull, which panics too and adds its charge.
2. **Defence:** stand in the middle of the herd as cover.
3. **Disadvantage into offence:** a wolf scares the herd, and you steer the panic it caused.

**I. Run structure.** About 25 minutes. Upgrades change the herd: goats climb, a bull leads, ducks fly over walls.

**J. Builds.** One big herd; several small herds; a single bull; a mixed herd.

**K. Enemies.**
- **Wolf:** spooks your herd itself.
- **Fence-builder:** puts up walls in front of stampedes.
- **Shepherd raider:** steals your animals.

**L. Pixel art.** A top-down meadow with 12px animals. A dust cloud trails every stampede.

**M. Viral moment.** One shout, and sixty sheep pour across the screen and erase an army.

**N. Feasibility.** Prototype 4/10, full game 6/10. Flocking is cheap, but the herd needs to feel controllable.

**O. Originality audit.**
- **Sheepdog games.**
- ***Pikmin*:** directing creatures.
- ***Ape Out*:** shoving enemies around.
- **Verdict:** a stampede as your weapon is meaningfully new.

---

## 15. Pillar Punch

**B. Hook.** Every punch raises a stone pillar where it lands.

**C. Signature mechanic.**
- Your attack raises a pillar from the floor one tile ahead.
- A pillar raised under an enemy launches it into the air.
- Pillars block shots and paths.
- Punch an existing pillar and it topples in a line, crushing whatever is in the way.
- Hit a pillar side-on and it crumbles into flying rock.

**D. Controls.** Move, Punch (raises a pillar) and Stomp (drops nearby pillars back into the floor).

**E. First 30 seconds.**
1. Archers shoot at you, so raise pillars as cover.
2. Goblins run round the pillars, so punch one over and flatten two of them.
3. Stomp to clear the arena again.

**F. Systems.**
1. **Pillar grid.**
2. **Raise and topple physics.**
3. **Line of sight.**
4. **Enemy pathfinding.**
- **Feedback loop:** pillars protect you, but they also block your own movement.

**G. Interactions.**
1. **Chain:** topple a pillar into the next, and a row of pillars falls like dominoes.
2. **Defence:** stand in a ring of pillars.
3. **Disadvantage into offence:** an enemy that raises its own pillars gives you more ammunition.

**I. Run structure.** About 25 minutes. Upgrades change the pillars: crystal pillars reflect shots, lava pillars burn.

**J. Builds.** Fortress, domino, launcher and bridge (pillars across pits).

**K. Enemies.**
- **Archer:** shoots along clear lines.
- **Digger:** tunnels under pillars.
- **Brute:** smashes pillars.

**L. Pixel art.** Top-down at a three-quarter angle. Rising pillars make chunky, satisfying shapes.

**M. Viral moment.** A ring of pillars falls inward and flattens eight enemies at once.

**N. Feasibility.** Prototype 3/10, full game 6/10.

**O. Originality audit.**
- **Dig Dug's falling rocks.**
- ***Bomberman*'s blocks.**
- **Earthbending, as in Avatar.**
- **Verdict:** meaningfully different. Every attack also changes the arena.

---

## Ranking

| Rank | Concept | Orig 25% | Fun 25% | Replay 20% | Solo 15% | Pixel 10% | Viral 5% | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | Tetherball | 7 | 9 | 8 | 7 | 8 | 9 | **7.90** |
| 2 | Copycat | 9 | 7 | 8 | 6 | 7 | 8 | **7.60** |
| 2 | Catch & Return | 6 | 9 | 8 | 8 | 7 | 7 | **7.60** |
| 4 | Pillar Punch | 7 | 8 | 8 | 7 | 8 | 7 | **7.55** |
| 5 | Stampede | 8 | 8 | 7 | 6 | 8 | 8 | **7.50** |
| 6 | Glare | 8 | 7 | 7 | 8 | 7 | 8 | **7.45** |
| 6 | Tilt Table | 7 | 8 | 7 | 8 | 7 | 8 | **7.45** |
| 8 | Gravity Pins | 6 | 8 | 8 | 7 | 8 | 8 | **7.35** |
| 9 | Spillway | 7 | 8 | 8 | 4 | 9 | 8 | **7.25** |
| 9 | Backspin | 8 | 8 | 7 | 5 | 7 | 8 | **7.25** |
| 11 | Swapstrike | 6 | 8 | 7 | 8 | 6 | 7 | **7.05** |
| 12 | Slipstream | 7 | 8 | 5 | 7 | 6 | 7 | **6.75** |
| 12 | Ghost Strike | 8 | 5 | 7 | 8 | 6 | 6 | **6.75** |
| 14 | Northpaw | 5 | 8 | 7 | 7 | 7 | 6 | **6.70** |
| 15 | Kinetic | 5 | 8 | 5 | 9 | 5 | 6 | **6.40** |

**Selections.**
1. **Most original: Copycat.** No action game I know of drives enemies with your own inputs. *Weakness:* steering five bodies at once might overload players, so it needs strong previews.
2. **Most immediately addictive: Catch & Return.** The parry, catch and throw loop is rewarding every second. *Weakness:* it's the most familiar idea of the five.
3. **Most commercially promising: Tetherball.** Swinging a boar into a crowd sells itself in a two-second clip. *Weakness:* rope physics can feel floaty if it isn't tuned.
4. **Most feasible: Tilt Table.** One input, few sprites and simple physics. Kinetic is easier still, but it's too shallow to be worth making.
5. **Best overall: Tetherball.** Instant fun, clear depth from mass and swing angle, and a strong visual identity.

---

## Dora and Enzo casting for the top five

Gameplay mock-ups: `ideas/px-tether-play.webp`, `ideas/px-copy-play.webp`, `ideas/px-catch-play.webp`, `ideas/px-pillar-play.webp`, `ideas/px-herd-play.webp`.

- **Tetherball:**
  - **Dora** hooks and swings the enemies.
  - **Enzo** is a living anchor: Dora can tether to him and swing herself through the crowd.
- **Copycat:**
  - **Dora** tags Grumbles with paint pellets from her slingshot.
  - Tagged Grumbles copy **Enzo**'s moves, step for step.
- **Catch & Return:**
  - **Dora** parries shots into the ring orbiting her, then throws the whole ring back.
  - **Enzo**'s umbrella bounces stray shots back into her reach.
- **Pillar Punch:**
  - **Dora** punches pillars up out of the floor.
  - **Enzo** shoves them over, and a row of pillars falls like dominoes.
- **Stampede:**
  - **Dora**'s shout spooks the herd into a stampede.
  - **Enzo**'s whistle calls the herd back to rest.

## Top five deep dives

### Tetherball

**Two-week prototype.**
- **Controls:** WASD to move, mouse to aim, left click to hook and release, Space to dash.
- **Arena:** one arena with spikes, a pit and a breakable wall.
- **Enemies:** slime and boar.
- **Upgrades:** elastic rope, longer rope, and a release that explodes.
- **Winning:** survive 3 waves. **Losing:** 0 HP.

**Godot 4 architecture.**
- **Player:** `CharacterBody2D`.
- **Enemies:** `RigidBody2D` with mass and an armour threshold.
- **Tether:** a scene holding a `DampedSpringJoint2D` or a Verlet rope script, plus a `Line2D` to draw it.
- **Damage:** on `body_entered`, damage equals relative speed × factor, applied above a threshold.
- **Modifiers:** a resource array on the player, read by the tether and release logic.
- **State:** `tether_target`, `rope_length`, `angular_speed`.
- **Collision layers:** player, enemy, hazard, wall.
- **Performance:** cap active rigid bodies at about 40.

**30-second encounter.**
- **0 s:** hook a slime.
- **2 s:** circle clockwise, and the swing speed reaches 9.
- **4 s:** the slime hits two slimes, which go flying.
- **6 s:** a boar telegraphs its charge.
- **7 s:** release the slime at the boar, but it misses. *(Setback.)*
- **8 s:** the boar hits you, and you lose 1 HP.
- **10 s:** hook the boar. It drags you toward the pit.
- **11 s:** dash against the pull. The rope snaps taut, and the boar swings wide.
- **13 s:** the boar's swing knocks a bomb beetle into the pit edge, where it explodes. *(Emergent combination.)*
- **16 s:** release the boar into the breakable wall.
- **18 s:** the wall breaks, revealing a shortcut. *(Recovery.)*
- **20–30 s:** clean up the remaining slimes with short swings.

**First major discovery.** Heavy enemies aren't threats; they're vehicles. Being dragged is a way to move.

**Possible failures and fixes.**
- **Floaty feel:** add hitstop and snappier rope tension.
- **One dominant build (long rope):** make a longer rope slower to turn.
- **Visual chaos:** limit speed lines to the enemy on your tether.

**Validation.** Testers deliberately spin up before releasing within 5 minutes. They grin at the first bowling hit. Their deaths come from their own over-commitment, not from confusion.

### Copycat

**Two-week prototype.**
- **Controls:** move, tag, dash, and hold to freeze the copying.
- **Arena:** one arena with spike pits and lava.
- **Enemies:** goblin and archer.
- **Upgrades:** a fifth mark, inverted copying, and marked enemies exploding when the mark ends.
- **Winning:** clear 3 rooms. **Losing:** 0 HP.

**Godot 4 architecture.**
- **Player:** each frame, the player emits an `InputFrame` (move vector, dash, attack).
- **MarkManager:** forwards each input frame to marked enemies, which have a `CopyController` component that replaces their normal AI.
- **Enemies:** `CharacterBody2D` with simple state machines.
- **Preview:** a node draws the ghost arrows one step ahead.
- **Modifiers:** a pipeline that transforms each input frame (invert, delay).
- **Performance:** trivial.

**30-second encounter.**
- **0 s:** tag a goblin by the spike pit.
- **1 s:** step right. The goblin steps into the spikes.
- **4 s:** two archers fire. Dodge.
- **6 s:** tag one archer but miss the other. *(Setback.)*
- **8 s:** the second archer hits you. Lose 1 HP.
- **10 s:** tag the second archer.
- **11 s:** face the first archer and attack. Both archers turn and fire, and one hits the other.
- **14 s:** the alpha roars and clears both marks.
- **16 s:** dash behind the alpha and tag it.
- **18 s:** walk toward the lava. The alpha follows step for step and goes in. *(Recovery and emergent combination.)*
- **20–30 s:** re-tag the archer and finish the room.

**First major discovery.** You can stand still to make enemies stand still. Doing nothing is a move.

**Possible failures and fixes.**
- **Cognitive overload:** the ghost previews, and the hold to freeze the copying.
- **Dominant strategy (tag everything, then walk to the lava):** marks should break when a marked enemy takes damage.

**Validation.** Testers plan two moves ahead, and the first time they kill several enemies at once they say "oh!" out loud.

### Catch & Return

**Two-week prototype.**
- **Controls:** move, parry, throw, dash.
- **Arena:** one arena with oil patches.
- **Enemies:** turret and shield-bearer.
- **Upgrades:** two rings, catches that grow, and splitting throws.
- **Winning:** 3 waves. **Losing:** 0 HP.

**Godot 4 architecture.**
- **Projectiles:** `Area2D` nodes with a `type` resource.
- **Ring:** an `OrbitRing` node holding the captured shots and spacing them around the circle.
- **Parry:** a 150 ms window, checked with a parry `Area2D` that is active during the window.
- **Throw:** sets each captured shot's velocity toward the aim direction.
- **Performance:** pool the projectiles.

**30-second encounter.**
- **0 s:** the turret fires three shots.
- **0.5 s:** catch two. The third hits you. *(Setback.)*
- **3 s:** the shield-bearer advances.
- **5 s:** throw, and the shield reflects both shots back at you.
- **6 s:** catch both again. *(Recovery.)*
- **8 s:** dash behind the shield-bearer and throw. Hit.
- **12 s:** catch a fire shot.
- **14 s:** throw it into an oil patch, and it ignites the shield-bearer and the turret together. *(Emergent combination.)*
- **18–30 s:** dodge the final bursts and clear the wave.

**First major discovery.** Keeping one turret alive means an endless supply of ammo.

**Possible failures and fixes.** It may feel too much like *Furi*. Push the hoarding and the different projectile types.

**Validation.** Testers start fishing for shots on purpose.

### Pillar Punch

**Two-week prototype.**
- **Controls:** move, punch, stomp.
- **Arena:** one arena.
- **Enemies:** archer and brute.
- **Upgrades:** crystal pillars, longer topple lines, and higher launches.
- **Winning:** 3 waves.

**Godot 4 architecture.**
- **Pillars:** a `TileMap` layer for pillars, with each pillar's state (rising, standing, toppling) in a dictionary keyed by cell.
- **Toppling:** a raycast along the cells in the punch direction.
- **Enemies:** pathfinding with `AStarGrid2D`, updated whenever pillars change.
- **Performance:** cheap.

**30-second encounter.**
- **0 s:** raise cover from the archers.
- **3 s:** a brute smashes your cover. *(Setback.)*
- **5 s:** raise a pillar under the brute, and it's launched.
- **7 s:** topple a pillar line through the archers.
- **10 s:** the falling pillar knocks over the next one, a domino. *(Emergent combination.)*
- **12–30 s:** finish the wave from a ring of pillars, then stomp them down.

**First major discovery.** Pillars are both your cover and your ammunition.

**Possible failures and fixes.** The arena can clog with pillars. Cap the number of pillars and have them sink over time.

**Validation.** Testers knock over pillars on purpose to set up dominoes.

### Stampede

**Two-week prototype.**
- **Controls:** move, shout, whistle.
- **Arena:** one meadow.
- **Enemies:** raider and wolf.
- **Upgrades:** a bull, goats that climb, and a wider shout.
- **Winning:** protect the farm for 3 waves. **Losing:** the farm falls or the herd is lost.

**Godot 4 architecture.**
- **Herd:** boids, with separation, alignment and cohesion, plus a fear vector.
- **Animals:** `CharacterBody2D`, or a manual spatial hash if there are more than 60.
- **Trample:** damage from herd speed on contact.
- **Performance:** with a spatial hash, it scales to about 100 animals.

**30-second encounter.**
- **0 s:** raiders come in from the north.
- **3 s:** circle south of the herd.
- **6 s:** shout. The herd stampedes north, but half of them scatter. *(Setback.)*
- **9 s:** whistle the scattered half back.
- **12 s:** a wolf panics the herd. Steer the panic toward the raiders. *(Emergent combination and recovery.)*
- **16–30 s:** rest the herd while the next wave forms.

**First major discovery.** The enemy that scares your herd can do your shouting for you.

**Possible failures and fixes.** The herd may feel uncontrollable. Make the cohesion stronger and show the shout cone on screen.

**Validation.** Testers start positioning *before* shouting.

# Ember & Clover: Midnight Kitchen

Route `/kitchen`. A cooperative crew management game played by one player, using four existing Saga characters as chefs and all twenty as customers. Twelve campaign shifts last 90, 105 or 120 seconds. Goals grow from five to sixteen served orders. Five recipes unlock as shifts advance; the opening shift has two.

Each order owns its ingredient progress: new → preparing → prepared → baking → ready → delivering → served. An order never shares or consumes another order's progress. Each job occupies one chef. Expired orders cancel their job and free the chef. The base oven holds one job; its second upgrade opens two racks. Auto crew selects the free chef with the best speed for the task.

Dora prepares in 75% of base time; Pip in 65%. Ember heats in 65%; Enzo serves in 65%. Other multipliers are defined in `CREW`. Base recipe durations range from two to seven seconds. Preparation, oven and service upgrades each multiply duration by 0.9 per level. Service upgrades also give four seconds of customer patience per level. Each upgrade has three levels and costs 90, 150, then 210 gold.

Serve within ten seconds of the previous delivery to build a combo, capped at five. Score is 40 + up to 30 patience points + five per combo level. The rush bell speeds jobs by 50% for five seconds and restores up to four seconds of patience, with a 22-second cooldown. Campaign rewards are five gold per serve plus ten per star on a win; three gold per serve on a loss. Stars separately reward meeting the goal, no missed orders, and two serves above the goal. A win unlocks the next shift. Finish early after meeting the goal, or stay open to chase the third star.

Cozy kitchen uses all recipes, no expiration and no clock limit. It awards no campaign progress or gold. It can be closed manually. Profile storage is separate from Saga (`midnight-kitchen-v1`), bounded and validated. Saves happen between shifts; ongoing orders are not resumed. A blocked localStorage does not prevent playing. Sound has its own setting. Focus loss and hidden tabs pause automatically. Reduced motion disables decorative lantern/rush effects.

Q/W/E/R advance the left-to-right order slots; 1–4 select Dora/Enzo/Pip/Ember, 0 returns to Auto. Space rings the bell, P/Escape pauses, M changes sound. All controls also have touch buttons. Art loads asynchronously without blocking the kitchen; food names and chef labels remain available if art cannot load.

`npm run test:kitchen` includes 240 deterministic perfect-play campaign runs with no upgrades, an idle loss, order lifecycle, expiry, occupancy, oven capacity, bell cooldown, save recovery and upgrade validation. Browser tests use isolated saves and verify actual clicks, keyboard, serving, pausing, recovery, six viewport layouts and reduced motion.

# Pawhaven

Planned game 42, at `/pawhaven`: an isometric town-founding game. Dora and Enzo lead a band of chinchillas into an empty meadow and grow it into a busy town. Written 27-10-2026; this is the design the engine is built from.

How it differs from **Burrow Town** (game 14): Burrow Town is a small 3D valley where every building helps whatever is in its radius. Pawhaven is a large 2D isometric map where everything travels on the roads. Helpers walk out from their buildings and serve the homes they pass, carts carry goods between buildings, and homes grow through seven levels as their needs are met. Its pleasure is watching a town run, and fixing the street that doesn't.

## The loop

1. Lay roads, place homes. Newcomers arrive along the road from the map's entry point and move into empty homes.
2. Homes ask for more: water, then food, then dust baths, more foods, goods, a healer, stories. Each need met lets a home grow a level and hold more chinchillas, and bigger homes pay more acorns.
3. Needs are met by **walkers**: a helper leaves a service building, wanders the roads and serves every home beside the road it passes. A home remembers each visit for a while; a street no helper reaches goes without.
4. Food and goods come from **chains**: farms and gatherers make raw things, carts carry them to granaries and storehouses, workshops turn raw things into goods, and market stalls send buyers to fetch stock and sellers to hand it out.
5. Everything needs **workers**, and workers come from homes. Growing homes grows the workforce.
6. **Trade** sells what you have too much of and buys what the meadow can't make.
7. **Gentle threats** keep the town honest: fire where no fire watch walks, foxes on some maps, and storms and dry spells.

## Map

- A square grid, 32 to 48 tiles a side by meadow, drawn isometrically. Each tile is one terrain: grass, fertile meadow (darker, farms only here), water, rock (quarries beside it, nothing on it), trees (woodcutters beside them; clearing costs acorns), sand (dust pits on it).
- One **entry point** on the map edge, where newcomers and traders arrive along a road; one **exit point** where they leave. Both are road tiles that can't be removed. The entry is on the west edge and the exit on the east, on the middle row, and a five-row band along that row is always grass so the two can be joined.
- Buildings are 1×1, 2×2 or 3×3 tiles. A building works only if one of its edge tiles touches a road (**road access**). Walkers and carts move only on roads.

## Time

- The engine steps in fixed ticks: 10 per second at normal speed. Speeds: pause, ×1, ×2, ×4.
- A **month** is 300 ticks (30 s at ×1). Twelve months make a year. Acorns from homes and wages are settled each month. Seasons change farm growth.

## Homes

A home is a 1×1 plot that starts as a **Hay Nest** and grows when its needs are met. When a need is lost, it shrinks one level after a grace period (one month), so a short gap doesn't hurt.

| Level | Home | Holds | Acorns per month | Needs (all of the earlier ones too) |
| --- | --- | --- | --- | --- |
| 1 | Hay Nest | 4 | 1 | road access |
| 2 | Twig Hut | 6 | 2 | water (a water carrier's visit) |
| 3 | Snug Burrow | 9 | 3 | one kind of food |
| 4 | Dusty Burrow | 12 | 5 | a dust bath keeper's visit |
| 5 | Cosy Burrow | 16 | 7 | two kinds of food, pottery, a healer's visit |
| 6 | Fine Burrow | 20 | 10 | toys, a storyteller's visit, desirability at least 2 |
| 7 | Grand Burrow | 24 | 14 | three kinds of food, bedding, a musician's visit, desirability at least 4 |

- **Visits** last 3 months: a home that hasn't seen a water carrier for 3 months has no water.
- **Food** and **goods** are stocks in the home. A market seller hands out up to 2 months' food of each kind the home wants (1 kind up to Snug Burrow, 2 for Dusty and Cosy, 3 from Fine) and up to 2 of each ware it wants (pottery from Dusty, toys from Cosy, bedding from Fine). Food is eaten every month: 1 unit per 4 chinchillas in all, shared between the kinds the home holds. Goods wear out more slowly (1 unit of each per home every 3 months).
- **Desirability** is a number from −4 to +6 at each tile. Gardens, ponds, statues and the plaza raise it near them; farms, workshops, pits and stores lower it. The figure is the sum of the effects in range: full strength on the plot and the tiles next to it, then fading by 1 per tile further out.
- Newcomers arrive at 1 every 5 ticks while there is free space in homes and the town's **cosiness** is at least 30. Each one walks from the entry to the nearest home (by road) with room. Cosiness (0–100) moves up to 8 a month towards a target: 30, plus up to 25 for the share of residents with food, plus up to 30 for the share with at least three helpers' visits, plus 8 at low tax or minus 12 at high tax, minus 40 for each share of idle workers above 30%. At cosiness below 20, 4% of the chinchillas (at least 1) leave each month.
- **Tax** is low, normal or high: the homes' acorns are multiplied by 0.8, 1 or 1.25.

## Workers

- Two in three chinchillas work. Each workplace has a number of jobs; workers are shared out by priority (the town hall first, then food, water, services, industry, trade) and then by build order. A building without road access gets no workers. Wages are 0.2 acorns per worker per month. A building with fewer workers than jobs works at that share of its speed. The page always shows the jobs filled and the unemployed.

## Walkers

- A **service walker** leaves its building every 100 ticks while staffed (less often when short of workers). It walks up to 30 road tiles, choosing at each junction the road its building's walkers took least recently (no randomness needed), then walks home by the shortest road. Every home whose plot touches a road tile the walker steps on gets the visit.
- A **cart** carries one load (8 units) from a producer to the nearest building with room that accepts it, along the shortest road path: a workshop or bath house that uses it if one can be reached, otherwise a store. Stores take goods only while staffed. If there's nowhere to go, the producer stops when its own store (16 units, 32 for a farm) is full.
- A **market buyer** walks from the stall to the nearest granary or storehouse with something the stall lacks (under 12 of a food or ware), takes up to 16 units, the emptiest first, and walks back; a stall holds up to 24 of each. Workshops and dust bath houses have buyers too, for their input. A **market seller** roams like a service walker and hands out food and goods.
- **Newcomers** walk from the entry point to the home they will live in. **Traders** walk from the entry to the trading post and back out through the exit.

## Buildings

| Building | Size | Jobs | What it does |
| --- | --- | --- | --- |
| Road | 1 | – | Walkers and carts move on it. 2 acorns. |
| Home plot | 1 | – | Starts as a Hay Nest. 5 acorns. |
| Well | 1 | – | A water carrier with no workers needed, but only 12 road tiles. |
| Water tower | 2 | 4 | A water carrier with the full 30-tile walk. Must be within 3 tiles of water. |
| Hay farm, oat farm | 3 | 6 | On fertile meadow only. Grows a crop that's harvested every 2 months: 32 units in spring and summer, 24 in autumn, 16 in winter. |
| Berry bush patch | 2 | 4 | Anywhere on grass. 8 berries a month. |
| Woodcutter | 1 | 4 | Next to trees. 6 wood a month. |
| Clay pit | 2 | 4 | Within 2 tiles of water. 6 clay a month. |
| Sand pit | 2 | 4 | On sand. 6 sand a month. |
| Dust mill | 2 | 6 | 2 sand → 2 dust, 3 times a month. |
| Potter | 2 | 6 | 2 clay → 1 pottery, 3 times a month. |
| Toymaker | 2 | 6 | 2 wood → 1 toys, 3 times a month. |
| Bedding weaver | 2 | 6 | 2 hay → 1 bedding, 3 times a month. |
| Granary | 3 | 6 | Stores 400 units of hay, oats and berries. |
| Storehouse | 3 | 6 | Stores 400 units of anything else. |
| Market stall | 2 | 4 | A buyer and a seller. |
| Dust bath house | 2 | 4 | A dust bath keeper; uses 1 dust a month and stops when it has none (its buyer fetches 8 at a time). |
| Herb hut | 1 | 3 | A healer. |
| Story circle | 2 | 4 | A storyteller. |
| Music stump | 2 | 4 | A musician. |
| Fire watch | 1 | 2 | A fire watcher. |
| Fox watch | 1 | 3 | A guard who chases off any fox that comes within 6 tiles of it. |
| Fence | 1 | – | Foxes can't cross it. Walkers can't either: leave gaps on roads with a gate (a fence on a road tile is a gate, open to walkers, closed to foxes). |
| Garden, pond, statue | 1, 2, 3 | – | Desirability +2, +3, +5, falling 1 per tile. |
| Plaza | 2 | – | Desirability +3 and paved; counts as road for walkers. |
| Trading post | 3 | 6 | Where traders buy and sell. |
| Town hall | 3 | 8 | Required, one per town. Collects the month's acorns (no tax walker). |

Costs in acorns scale with size and use, from 2 (road, fence) to 250 (statue): home plot 5, well 15, garden 15, fire watch 35, berry patch 40, woodcutter and fox watch 45, pond 45, clay and sand pits 50, market stall, herb hut and plaza 60, water tower 60, farms 80, dust mill and dust bath house 90, potter and story circle 100, granary and storehouse 120, toymaker and music stump 130, bedding weaver and town hall 150, trading post 180. Clearing a tree costs 3. The table lives in `lib/pawhaven-game.ts`.

## Trade

- Each meadow lists 1 to 3 neighbours (the last two meadows list all four). Opening a route costs acorns once. Each route buys some goods and sells others, each at a set price, up to an amount of each good per year:

| Route | Cost | Buys from us | Sells to us | Per year, each good | Meadows |
| --- | --- | --- | --- | --- | --- |
| Pebble Ford | 150 | pottery 14, wood 5 | oats 4, berries 4 | 80 | Clayfoot, Foxglove, Pawhaven |
| Mossy Hollow | 100 | berries 3, hay 3, clay 4 | sand 5, dust 8 | 100 | Clayfoot, Pawhaven |
| Thistle Top | 200 | toys 20, dust 7 | clay 5, wood 6, pottery 18 | 60 | Foxglove, Stormy, Pawhaven |
| Bramble Gate | 250 | bedding 22, pottery 15 | toys 24, hay 4 | 60 | Stormy, Pawhaven |

- For each good, the player sets **trade**: keep, export above N, or import up to N. Every 2 months a caravan arrives at the trading post, sells and buys what is set, then leaves. Acorns change hands when it arrives.

## Gentle threats

- **Fire** (from Willow Bend on, where the fire watch opens). Every building except roads, fences, gardens, ponds, statues, plazas, wells and fire watches has a fire risk that rises each tick (0.05 for homes, markets and services, 0.04 for farms and stores, 0.06 for woodcutters, 0.1 for workshops) from a random start of 0 to 30, and resets when a fire watcher passes. At 100 it catches fire. A fire burns for 60 ticks and leaves rubble; a fire watcher passing a burning building puts it out at once. Nobody is hurt: the residents go to stay with friends (they leave the town), and rubble can be cleared for free.
- **Foxes** (Foxglove Edge and Pawhaven). Every 3 months, from the third month, a fox comes from a map edge and walks towards the nearest home. It crosses anything but water, fences and gates. If it reaches a home, the residents dash off and the home is empty for a month, then they come back. A staffed fox watch within 6 tiles chases it back off the map. A fox that can't reach any home trots home.
- **Weather.** Each meadow has a chance each month of a dry spell and of a storm (Stormy Downs 20% and 25%, Pawhaven 12% and 15%, the free meadow 8% and 8%, none before Stormy Downs). A **dry spell** halves farm and berry growth for a month unless the farm is within 3 tiles of water. A **storm** turns 1 to 3 road tiles into "puddles" that walkers can't use until cleared (free).

## Campaign

Seven meadows open one after another, plus a free-build meadow. Each has a short brief from Dora and Enzo, a starting purse, the buildings that are available, and goals.

| # | Meadow | Size | Purse | New | Goal | Years for two stars |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Clover Landing | 32 | 500 | homes, roads, town hall, wells, berry patches, granary, market stall | 60 chinchillas; 10 Snug Burrows | 2 |
| 2 | Willow Bend | 36 | 800 | water tower, hay and oat farms, woodcutter, storehouse, fire watch, garden | 150 chinchillas; cosiness 50 | 4 |
| 3 | Sandy Rise | 36 | 1000 | sand pit, dust mill, dust bath house, herb hut, pond | 250 chinchillas; 15 Dusty Burrows | 5 |
| 4 | Clayfoot Brook | 40 | 1400 | clay pit, potter, trading post, trade routes, plaza | 350 chinchillas; 600 acorns in the purse | 7 |
| 5 | Foxglove Edge | 40 | 1600 | foxes, fences, fox watch, toymaker, story circle | 450 chinchillas; 10 Fine Burrows | 8 |
| 6 | Stormy Downs | 44 | 2000 | storms and dry spells, bedding weaver, music stump, statue | 600 chinchillas; 5 Grand Burrows; cosiness 70 | 10 |
| 7 | Pawhaven | 48 | 3000 | everything; a bigger map | 900 chinchillas; 15 Grand Burrows | 14 |
| – | Free Meadow | 48 | 5000 | everything, no goals | – | – |

A level goal counts homes at that level or above. The meadow is finished when every goal holds at once. Stars per meadow: one for the goals, two for finishing within the set number of years, three for doing that with cosiness at least 80.

## Rules for the engine

- Deterministic: the meadow's seed makes the map, and the same actions on the same ticks give the same town. No `Math.random` in the engine.
- No DOM. The page sends actions (`build`, `clear`, `setTrade`, `openRoute`, `setSpeed`, `setTax`) and reads state; the engine pushes events (`levelUp`, `levelDown`, `fire`, `fox`, `caravan`, `goal`, and so on) for sound and banners.
- Saves under `pawhaven-v1`: campaign progress and up to three saved towns, each as the meadow id, the seed, and the full state as plain JSON.
- The bot (`npm run bot:pawhaven`) plays meadows 1 to 3 from a fixed build plan and must finish each within its two-star years. On 27-10-2026 it finished Clover Landing in year 1.0, Willow Bend in 2.2 and Sandy Rise in 2.4.

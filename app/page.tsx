// The arcade front door: every game Dora and Enzo star in, in one place.
import ContinuePlaying from './continue-playing';
const GAMES=[
 {href:'/fighter',title:'Paw Fighter II',tag:'FIGHTING',blurb:'Seven fighters, six rivals, one champion. Arcade, story and training modes with fireballs, risers and supers.',color:'#e0a35c',art:'🥊'},
 {href:'/checkpoint-remake',title:'Dust & Documents: Remake',tag:'NEW · INSPECTION',blurb:'A reimagined mountain crossing. Compare documents, justify denials, choose supper and keep Dora and Enzo’s booth open.',color:'#c2cda2',art:'📜'},
 {href:'/checkpoint',title:'Dust & Documents',tag:'INSPECTION',blurb:'Seven shifts in an Andean border booth. Read the day\u2019s rules, check every permit, decide who walks through the gate.',color:'#8fd0a5',art:'🛂'},
 {href:'/escape',title:'Spy Escape',tag:'STEALTH',blurb:'Slip past patrols, grab the gadgets and break both chinchillas out of detention.',color:'#7fa6e8',art:'🕵️'},
 {href:'/adventure',title:'Bounce / Burrow',tag:'ACTION RPG',blurb:'An endless procedural dungeon. Level up, spend skill points in two branching trees, beat the guardians.',color:'#c58ee0',art:'⚔️'},
 {href:'/chin-x-pit',title:'Chin x Pit · Classic',tag:'BALL-BOUNCING',blurb:'Aim bouncing balls, catch returning ricochets and fuse your collection. Clear twelve waves and descend with Dora and Enzo.',color:'#dab982',art:'🔮'},
 {href:'/survival',title:'Chin x Pit · Night Survivors',tag:'SURVIVAL',blurb:'Gather XP, grow your arsenal and hold off the predators of the pit for as long as you can.',color:'#e0796f',art:'🌙'},
 {href:'/kart',title:'Pawprint Grand Prix',tag:'RACING',blurb:'Three laps, five racers, drifts and items. Hold the line and take the checkered flag.',color:'#f0cd6b',art:'🏁'},
 {href:'/soccer',title:'Fluffball Cup',tag:'SPORTS',blurb:'Dora\u2019s Sky Squad against Enzo\u2019s Ember FC. Four a side, ninety seconds, bragging rights forever.',color:'#7fd0b8',art:'⚽'},
 {href:'/hop',title:'Border Hop',tag:'ARCADE',blurb:'Flap through twenty desert checkpoint gaps and get both friends to the welcome gate.',color:'#e8a9c4',art:'🪶'},
 {href:'/dust-bath',title:'Dust Bath Dash',tag:'NEW · COZY SPA',blurb:'Run a tiny chinchilla spa. Seat fluffy guests, time the perfect dust bath and grow your happy place. Two-minute shifts or untimed cozy mode.',color:'#b5c69d',art:'☁️'},
 {href:'/mountain-retreat',title:"Dora & Enzo’s Mountain Retreat",tag:'NEW · IDLE LODGE',blurb:'A soft place above the clouds. Welcome guests, gather supplies and grow a pixel-perfect mountain lodge, together.',color:'#a5bd91',art:'🏔️'},
 {href:'/paw-buster',title:'Paw Buster X',tag:'NEW · ACTION PLATFORMER',blurb:'Dash, wall-jump and charge your buster through six maverick stages, then storm the Cougar Citadel. Tag between Dora\u2019s buster and Enzo\u2019s saber.',color:'#7fd6ff',art:'🤖'},
 {href:'/burrow-town',title:'Burrow Town',tag:'CITY BUILDER',blurb:'A cozy 3D valley builder. Lay roads, dig burrows, plant hay and keep both Dora and Enzo happy across five Andean valleys.',color:'#9ec27a',art:'🏘️'},
 {href:'/dusty-hollow',title:'Dusty Hollow',tag:'NEW · VILLAGE LIFE',blurb:'Dora and Enzo move into a seaside Andean hollow together. Fish, catch bugs, dig fossils, shake fruit trees, befriend the neighbours and pay off your burrow, one six-minute day at a time, in chunky pixel art.',color:'#c98ab8',art:'🎣'},
 {href:'/fluff-forge',title:'Fluff Forge',tag:'NEW · COURSE MAKER',blurb:'Build your own platformer course from bricks, clouds, springs, beetles and bats, then run it as Dora or Enzo. Clear it to share a code with friends.',color:'#f29b6b',art:'🧱'},
 {href:'/fluffstevania',title:'Fluffstevania: Symphony of the Dust',tag:'NEW · METROIDVANIA',blurb:'Dora and Enzo explore a haunted mountain castle for the Golden Wolfberry. Tag between them, level up, find relics and gear, and face the owl and the Rat King.',color:'#c8a0e8',art:'🦇'},
 {href:'/clash',title:'Chinchilla Clash',tag:'NEW · CARD BATTLER',blurb:'A Clash Royale-style lane battle. Build an eight-card deck, spend bath dust to send kits, gliders and Grandpa Pebble over the river, and topple three rival clans\u2019 towers.',color:'#ffcf4a',art:'👑'},
 {href:'/hay-maze',title:'Hay Maze Defence',tag:'NEW · ROGUELITE TOWER DEFENCE',blurb:'Guard the Hearthlight through the night. Draw hay-bale blocks as cards, lay them into a winding maze, and stand ice, fire, spark and moonlight towers on top. Six levels, new meadows, relics and rewards.',color:'#ff9a4a',art:'🔥'},
 {href:'/chinchillas-vs-zombies',title:'Chinchillas vs Zombies',tag:'NEW · LANE DEFENCE',blurb:'Zombies are shambling up the lawn to Dora and Enzo\u2019s burrow. Collect sunflower seeds, plant chinchilla defenders in five lanes, and hold out through eight nights.',color:'#8fd45a',art:'🧟'},
 {href:'/scribble',title:'Chinchilla Scribble',tag:'NEW · WORD PUZZLE',blurb:'Write a word and it appears. Summon ladders, bridges, bombs and flying hay bales, stack adjectives, and help Dora and Enzo reach the golden wolfberry in twelve puzzles and a sandbox.',color:'#9a7ae8',art:'✏️'},
 {href:'/tactics',title:'Burrow Tactics',tag:'NEW · TURN-BASED TACTICS',blurb:'Predators show exactly what they will hit next. Move three chinchillas, push foxes into streams, brambles and each other, and keep the burrows standing through eighteen missions and a seven-battle run.',color:'#ffcf5a',art:'♟️'},
 {href:'/barrage',title:'Burrow Barrage',tag:'NEW · TURN-BASED ARTILLERY',blurb:'Two against two, one shot at a time. Set the angle and the power, mind the wind, and dig the ground out from under the other pair. Four rides, six maps, a ladder of rivals and pass-and-play for two.',color:'#b99cff',art:'🎯'},
 {href:'/summit',title:'Summit Shuffle',tag:'NEW · DECK-BUILDING CLIMB',blurb:'Ten plain cards and a mountain to climb. Read what every predator will do next, play your hand, add a card after each fight, and pick your trail past alphas, burrows and treat stalls to the Cougar of the Summit.',color:'#7fc4e8',art:'🏔️'},
 {href:'/poof',title:'Poof Panic',tag:'NEW · VERSUS PUZZLE',blurb:'Drop pairs of fluff balls, pop four of a colour, and build chains that bury your rival in dust. A ladder of six predator rivals, a hard ladder after it, endless solo play and twelve chain lessons.',color:'#ff8fb3',art:'🫧'},
 {href:'/express',title:'Burrow Express',tag:'NEW · TRANSPORT PUZZLE',blurb:'Draw coloured tunnels and send chinchilla carts between burrows, hay markets and dust baths. Share transfer stations, choose upgrades, clear cave-ins and keep three growing mountain warrens moving.',color:'#79d5b6',art:'🚂'},
 {href:'/moonlight',title:'Moonlight Mischief',tag:'NEW · COZY STEALTH',blurb:'Sneak through a sleeping woodland village. Switch between Dora and Enzo, outwit owl patrols, recover treats and bring a friend home before dawn.',color:'#d9ba78',art:'🦉'},
 {href:'/pinball',title:'Pawprint Pinball',tag:'NEW · WOODLAND PINBALL',blurb:'Two little paw flippers, golden wolfberries and a clockwork warren. Race the burrow ramps, rescue neighbours and release moonberry multiball.',color:'#dfb86e',art:'✨'},
 {href:'/detectives',title:'Pawprint Detectives',tag:'NEW · COZY MYSTERIES',blurb:'Dora notices the details, Enzo follows the scents. Question neighbours, connect clues and explain three gentle woodland mysteries.',color:'#e7ba79',art:'🔎'},
 {href:'/frontier',title:'Frostpaw Frontier',tag:'NEW · SURVIVAL BUILDER',blurb:'Uncover a snowy mountain tile by tile. Put chinchilla survivors to work, light glow lanterns, recruit heroes from old ruins, hold the burrow through every night raid and light the Summit Beacon.',color:'#9fc0ec',art:'🏔️'},
 {href:'/moonpond',title:'Moonpond',tag:'NEW · NIGHT-FISHING JOURNAL',blurb:'Cast from the dock under the moon, hook the bite and work the reel. Sketch forty pond creatures, each with its own hour, weather and lure, then let them go.',color:'#9db4ee',art:'🎣'},
 {href:'/saga',title:'Whisker Saga',tag:'NEW · HERO-SQUAD ADVENTURE',blurb:'Lead five heroes down eighty stages that fight on their own while you time their skills. Recruit, level and equip twenty heroes in three factions, and stun the boss before its slam lands.',color:'#f6c95a',art:'⚔️'},
 {href:'/kitchen',title:'Ember & Clover: Midnight Kitchen',tag:'NEW · COZY KITCHEN',blurb:'Heroes by day, bakers by moonlight. Whisk, bake and serve with Dora, Enzo, Pip and Ember across twelve lantern-lit shifts, or take your time in cozy mode.',color:'#e8bb69',art:'🥐'},
 {href:'/acorn-hand',title:'Acorn Hand',tag:'NEW · POKER-SCORING CARD RUN',blurb:'Play poker hands for chips × mult, gather chinchilla charms that bend the rules, and outwit eight woodland rivals whose boss rules change how you play.',color:'#c9a25a',art:'🌰'},
 {href:'/whisker-ware',title:'Whisker Ware',tag:'NEW · MICROGAME FRENZY',blurb:'Twenty five-second games in a row, faster and faster: stuff Enzo\'s cheeks, sneak past the Owl and pop the Fox\'s balloons before the fuse burns out.',color:'#e0784a',art:'⚡'},
 {href:'/brawl',title:'Hay Bale Brawl',tag:'NEW · AUTO-BATTLER',blurb:'Buy a crew of woodland critters, line them up on the hay bale and watch them brawl: merge copies, feed them snacks, and win ten fights before you lose five hearts.',color:'#d9a441',art:'🌾'},
 {href:'/trek',title:'Chinchilla Trek',tag:'NEW · ROGUELITE TREK',blurb:'Walk Dora or Enzo through thirty days of meadow, wood and mountain: pick a skill at every level-up, let the scraps play out, bargain with the Owl and the Fox, and bring home gear to go further next time.',color:'#7bb661',art:'🧭'},
 {href:'/cave',title:'Glimmer Cave',tag:'NEW · CAVE SURVIVAL',blurb:'Dive five layers under the Andes with Dora or Enzo: dig through rock, bonk swarms of soot sprites, mites and beetles while your weapons aim themselves, pick a card at every level-up, reach the drop pod in time, and bonk the grumpy Rock Wyrm.',color:'#8a6ad8',art:'💎'},
 {href:'/hunt',title:'Grumble Hunt',tag:'NEW · 3D STORYBOOK ADVENTURE',blurb:'Take Dora’s Acorn Hammer or Enzo’s Seed Bow into a painted meadow. Roll past the orange warnings, bonk five grumpy beasts into lovely naps, and bring little treasures home to the Forge.',color:'#e5ba73',art:'🐾'},
 {href:'/putt',title:'Puttering Paws',tag:'NEW · 3D MINI GOLF',blurb:'Putt with Dora and Enzo through two storybook nine-hole courses: ramps and windmills, burrows and dust baths, bouncy mushrooms and a sleepwalking Bristleback. Every hole hides a golden acorn.',color:'#9fcf7a',art:'⛳'},
 {href:'/roll',title:'Fluff Roll',tag:'NEW · 3D ROLL-AND-GROW',blurb:'Push a dust ball round the meadow with Dora while Enzo rides on top. Everything smaller sticks, from seeds and buttons to hay bales, barns and grassy hills.',color:'#f2bd64',art:'🧶'},
 {href:'/pawhaven',title:'Pawhaven',tag:'NEW · TOWN BUILDER',blurb:'Found a chinchilla town across seven meadows. Lay roads, send water, food and dust bath helpers down the streets, grow hay nests into grand burrows, and trade with the towns next door.',color:'#8cc46a',art:'🏡'},
 {href:'/disco',title:'Dust Disco',tag:'NEW · RHYTHM',blurb:'Dance with Dora and Enzo to twelve original tunes, from the home burrow to a stage among the stars. Tap the dust bunnies on the beat, hold the long notes and light up Dust Up.',color:'#b48cf0',art:'🪩'},
 {href:'/pebble',title:'Pebble Pop',tag:'NEW · BRICK BREAKER',blurb:'Bounce a pebble off Dora and Enzo’s hay bale and pop walls of crates, ice and dust clouds across fifteen steps, picking upgrades and calming three grumpy bosses.',color:'#ff8f5a',art:'🪨'},
 {href:'/safari',title:'Snapshot Safari',tag:'NEW · PHOTOGRAPHY',blurb:'Tiptoe along four Andes trails with a camera, hide in the grass and wait for the magic moment. Photograph 24 creatures and fill your field journal.',color:'#e0a458',art:'📸'},
 {href:'/dungeon',title:'Dust Bunny Dungeon',tag:'NEW · ROGUELIKE',blurb:'Tidy twelve burrow cellars of mischievous dust bunnies, one step at a time. Every bunny shows its next move, so push, bop and plan your way down to the Dust King.',color:'#c98a4b',art:'🧹'},
 {href:'/command',title:'Burrow Command',tag:'NEW · REAL-TIME STRATEGY',blurb:'Lead chinchillas, raccoons or wind-up beetles: gather hay and glimmer, build a burrow and poof rivals home dizzy in ten story missions and skirmishes.',color:'#e9b44c',art:'🏰'},
 {href:'/hayloft',title:'Hayloft Tycoon',tag:'NEW · IDLE TYCOON',blurb:'Grow one hay patch into a valley-wide chinchilla business. Hire helpers, send trips, migrate to new valleys for Stardust, and come back to a valley that kept busy while you were away.',color:'#e9b23b',art:'🌾'},
 {href:'/parade',title:'Kit Parade',tag:'NEW · PUZZLE',blurb:'A line of baby kits marches on and on. Hand out jobs (diggers, builders, stoppers, gliders and more) so everyone gets home to Dora and Enzo.',color:'#f2a65a',art:'🐾'},
 {href:'/prism',title:'Prism Paws',tag:'NEW · PUZZLE',blurb:'Steer moonlight with mirrors, candy glass and crystals to relight the festival lanterns, mixing colours like real light, without waking the sleeping kits.',color:'#8f7cf0',art:'🏮'},
];
export default function Arcade(){
 return <main className="arcade-shell">
  <header className="arcade-header"><span>DORA <em>&amp;</em> ENZO&rsquo;S ARCADE</span></header>
  <section className="arcade-hero">
   <p className="arcade-eyebrow">FIFTY ORIGINAL BROWSER GAMES · THE ANDES AND EVERYTHING AFTER</p>
   <h1>Small paws.<br/><em>Fifty ways to play.</em></h1>
   <p className="arcade-lede">One roster of chinchillas, fifty cabinets. Pick a machine and play; every game runs in your browser, no install and no sign-in.</p>
  </section>
  <ContinuePlaying games={GAMES.map(({href,title,color,art})=>({href,title,color,art}))}/>
  <nav className="arcade-grid" aria-label="Choose a game">
   {GAMES.map((game,i)=><a key={game.href} href={game.href} className="arcade-card" style={{'--game-color':game.color} as React.CSSProperties}>
    <span className="arcade-art" aria-hidden="true">{game.art}</span>
    <span className="arcade-number">{String(i+1).padStart(2,'0')}</span>
    <strong>{game.title}</strong>
    <small>{game.tag}</small>
    <span className="arcade-blurb">{game.blurb}</span>
    <span className="arcade-play">PLAY →</span>
   </a>)}
  </nav>
  <footer className="arcade-foot"><p>Keyboard and touch controls are listed inside each game. Everything here is original work starring Dora, a white chinchilla, and Enzo, a grey one.</p></footer>
 </main>;
}

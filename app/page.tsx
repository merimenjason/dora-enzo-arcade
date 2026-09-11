// The arcade front door: every game Dora and Enzo star in, in one place.
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
];
export default function Arcade(){
 return <main className="arcade-shell">
  <header className="arcade-header"><span>DORA <em>&amp;</em> ENZO&rsquo;S ARCADE</span><a href="/fighter">START WITH PAW FIGHTER II →</a></header>
  <section className="arcade-hero">
   <p className="arcade-eyebrow">THIRTEEN ORIGINAL BROWSER GAMES · THE ANDES AND EVERYTHING AFTER</p>
   <h1>Small paws.<br/><em>Thirteen ways to play.</em></h1>
   <p className="arcade-lede">One roster of chinchillas, thirteen cabinets. Pick a machine and play; every game runs in your browser, no install and no sign-in.</p>
  </section>
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

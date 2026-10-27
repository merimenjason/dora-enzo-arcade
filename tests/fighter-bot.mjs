// Paw Fighter II balance bot: hard CPU against hard CPU in every matchup, both sides, a few seeds each.
// Reports each fighter's round win rate and how rounds end, and fails if a fighter is far out of line.
import assert from 'node:assert/strict';
import {FighterGame,ROSTER} from '../.checks/fighter-game.js';
const ids=ROSTER.map(r=>r.id),SEEDS=[3,29,71,113,157],level=process.argv[2]??'hard';
const won=Object.fromEntries(ids.map(id=>[id,0])),played=Object.fromEntries(ids.map(id=>[id,0]));let kos=0,timeouts=0,throws=0,breaks=0,guardBreaks=0,cancels=0,rounds=0;
for(const a of ids)for(const b of ids){if(a===b)continue;for(const seed of SEEDS){
 const g=new FighterGame();g.seed=seed;g.pick(a);g.startVersus(b);g.demo=level;g.difficulty=level;g.ai=true;g.intro=0;
 // versus hands side two to a player; give it back to the CPU
 for(let i=0;i<120*62&&g.active;i++){g.step(1/120);for(const e of g.events.splice(0)){if(e.kind==='throw')throws++;if(e.kind==='break')breaks++;if(e.kind==='guardbreak')guardBreaks++;if(e.kind==='hit'&&e.combo>1)cancels++}}
 rounds++;played[a]++;played[b]++;if(g.result===0)won[a]++;else if(g.result===1)won[b]++;if(g.fighters.some(f=>f.hp<=0))kos++;else timeouts++}}
console.log(`${level} vs ${level}: ${rounds} rounds, ${kos} knockouts, ${timeouts} time-outs; ${throws} throws, ${breaks} throw breaks, ${guardBreaks} guard breaks, ${cancels} combo hits`);
for(const id of ids)console.log(`  ${id.padEnd(6)} ${(100*won[id]/played[id]).toFixed(0).padStart(3)}% of ${played[id]}`);
for(const id of ids){const rate=won[id]/played[id];assert(rate>=.3&&rate<=.7,`${id} wins ${(rate*100).toFixed(0)}%: out of balance`)}
assert(kos>rounds*.6,'most rounds end in a knockout');assert(throws>0&&cancels>0&&guardBreaks>0,'the CPU uses throws and cancels, and guards break');

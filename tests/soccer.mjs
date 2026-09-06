import assert from 'node:assert/strict';
import {SoccerGame,MATCH_SECONDS} from '../.checks/soccer-game.js';
const fresh=()=>{const g=new SoccerGame();g.start();return g};
const tick=(g,t,input)=>{for(let i=0;i<t*120;i++)g.step(1/120,input)};
const move=fresh();tick(move,.5,{x:1,y:0,sprint:true});assert(move.players[0].x>33);assert(move.players[0].stamina<1);move.pause();const t=move.time;tick(move,2);assert.equal(move.time,t);move.pause();
const pass=fresh();assert(pass.pass());assert.equal(pass.owner,null);assert(Math.hypot(pass.ball.vx,pass.ball.vy)>25);assert(!pass.shoot());
const shot=fresh();shot.aim={x:100,y:30};assert(shot.shoot());assert(shot.ball.vx>50);assert.equal(shot.lock,.18);
for(const team of [0,1]){const g=fresh();g.owner=null;g.ball={x:team===0?99.9:.1,y:30,vx:team===0?52:-52,vy:0};g.step(1/120);assert.equal(g.score[team],1);assert.equal(g.state,'goal');tick(g,2.1);assert.equal(g.state,'playing');assert.equal(g.players[g.owner].team,team===0?1:0);assert.equal(g.score[team],1)}
const post=fresh();post.owner=null;post.ball={x:99.9,y:10,vx:52,vy:0};post.step(1/120);assert.equal(post.score[0],0);assert(post.ball.vx<0);
const tackle=fresh();tackle.lock=0;tackle.players[4].x=tackle.players[0].x+.5;tackle.players[4].y=tackle.players[0].y;tackle.step(1/120);assert.equal(tackle.owner,4);assert(tackle.lock>0);
const change=fresh();change.switchPlayer();assert(change.active!==0);assert(!change.players[change.active].keeper);
const end=fresh();tick(end,110);assert.equal(end.state,'finished');assert(end.time>=MATCH_SECONDS);assert(end.players.every(p=>p.x>=2&&p.x<=98&&p.y>=3&&p.y<=57));console.log(`Full match: ${end.score.join('–')}, ${end.time.toFixed(1)}s.`);console.log('Passed movement/sprint, pause, passing, shooting, goals/kickoffs, rebound, tackling, player switching and complete match.');
const attack=fresh();for(let i=0;i<120*20&&attack.score[0]===0;i++){const p=attack.players[attack.active];if(attack.owner===attack.active&&p.x>65){attack.aim={x:100,y:24.5};attack.shoot()}attack.step(1/120,{x:attack.owner===attack.active?1:0,y:p.y>22?-1:0,sprint:true})}assert(attack.score[0]>0,'normal movement and a corner shot can score');console.log('Passed a player-controlled scoring attack.');

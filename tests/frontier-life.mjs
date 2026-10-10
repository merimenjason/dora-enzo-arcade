import assert from 'node:assert/strict';
import {Game} from '../.checks/frontier-game.js';
import {settlementRoute,settlementAt,settlementPaths} from '../.checks/frontier-life.js';
const g=new Game(0,1),before=JSON.stringify(g.snapshot());
const expected=g.buildings.reduce((n,b)=>n+b.workers,0);
for(let time=0;time<80;time+=.25){const actors=settlementAt(g,time);assert.equal(actors.filter(a=>a.kind==='worker').length,expected);for(const a of actors){assert.ok(g.held(Math.round(a.x),Math.round(a.y)),'residents stay on held tiles');assert.ok(!a.carrying||a.walking);}}
const colors=time=>Object.fromEntries(settlementAt(g,time).filter(a=>a.kind==='worker').map(a=>[a.id,a.coat]));
assert.equal(new Set(Object.values(colors(0))).size,4,'starting workers cover all four coats');assert.ok(Object.values(colors(0)).every(n=>Number.isInteger(n)&&n>=0&&n<4),'every coat has valid artwork');assert.deepEqual(colors(0),colors(19),'coats remain stable throughout work and delivery');const loaded=Game.load(g.snapshot());assert.deepEqual(Object.fromEntries(settlementAt(loaded,20).filter(a=>a.kind==='worker').map(a=>[a.id,a.coat])),colors(0),'coats survive save/load');
assert.equal(JSON.stringify(g.snapshot()),before,'presentation must not alter game state');
assert.notDeepEqual(settlementAt(g,1),settlementAt(g,5),'residents move and change activity');
assert.deepEqual(settlementAt(g,1,false),settlementAt(g,500,false),'reduced motion is stable');
const farm=g.buildings.find(b=>b.kind==='farm');g.assign(farm.id,-1);assert.equal(settlementAt(g,2).filter(a=>a.kind==='worker').length,expected-1);
farm.damaged=true;assert.ok(settlementAt(g,15).filter(a=>a.id.startsWith('worker-'+farm.id+'-')).every(a=>!a.walking&&!a.carrying&&!a.working));
const h=new Game(0,2);for(let y=0;y<13;y++)for(let x=0;x<13;x++){const t=h.tile(x,y);t.seen=false;t.t='meadow';t.f=undefined;}
for(let x=6;x<=9;x++)h.tile(x,6).seen=true;
assert.equal(settlementRoute(h,{x:9,y:6}).length,4);h.tile(8,6).t='crag';assert.equal(settlementRoute(h,{x:9,y:6}).length,0);
h.tile(8,6).t='meadow';h.tile(8,6).f='den';assert.equal(settlementRoute(h,{x:9,y:6}).length,0);
h.tile(8,6).f=undefined;h.tile(8,6).seen=false;assert.equal(settlementRoute(h,{x:9,y:6}).length,0);
for(const [a,b]of settlementPaths(g)){assert.ok(g.held(a.x,a.y)&&g.held(b.x,b.y));assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1);}
console.log('PASS settlement animation: exact worker count, safe paths, live reassignment/damage, walking and delivery phases, reduced motion and unchanged engine state.');

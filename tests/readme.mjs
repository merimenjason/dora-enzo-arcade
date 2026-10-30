import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
const routes=[...page.matchAll(/href:'(\/[\w-]+)'/g)].map(m=>m[1]);
assert(routes.length>0,'no games found in the GAMES list of app/page.tsx');

const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty','twenty-one','twenty-two','twenty-three','twenty-four','twenty-five','twenty-six','twenty-seven','twenty-eight','twenty-nine','thirty','thirty-one','thirty-two','thirty-three','thirty-four','thirty-five','thirty-six','thirty-seven','thirty-eight','thirty-nine','forty','forty-one','forty-two','forty-three','forty-four','forty-five','forty-six','forty-seven','forty-eight','forty-nine','fifty','fifty-one','fifty-two','fifty-three','fifty-four','fifty-five','fifty-six','fifty-seven'];
const count=words[routes.length]??String(routes.length);
assert(readme.includes(`A collection of ${count} original browser games`),`README intro must say "${count}" games`);

const rows=[...readme.matchAll(/^\| (\d{2}) \| .+? \| `(\/[\w-]+)` \|/gm)];
assert.deepEqual(rows.map(m=>m[2]),routes,'README games table must list every route in app/page.tsx GAMES, in arcade order');

const headings=[...readme.matchAll(/^### (\d{2}) · .+ \(`(\/[\w-]+)`\)$/gm)];
assert.deepEqual(headings.map(m=>m[2]),routes,'README must have one "### NN · Title (`/route`)" section per game, in arcade order');
headings.forEach((m,i)=>{
 const n=String(i+1).padStart(2,'0');
 assert.equal(m[1],n,`${m[2]} section should be numbered ${n}`);
 assert.equal(rows[i][1],n,`${m[2]} table row should be numbered ${n}`);
 const body=readme.slice(m.index+m[0].length,headings[i+1]?.index??readme.indexOf('\n## ',m.index));
 for(const label of ['**Play:**','**Controls:**','**Tests:**','**Docs:**'])assert(body.includes(label),`${m[2]} section is missing ${label}`);
});

console.log(`README documents all ${routes.length} arcade games in order with Play, Controls, Tests and Docs.`);

// Jade Street loading (lib/jade-load.ts): every atlas and ground texture has a tier, the eager set the loading bar
// waits for stays small, the heroes' everyday poses and the townsfolk are in it, each district's paintings go with
// its zone, a zone is let go only when it is far and idle, and the art is cache-busted by content hash (VER) in the
// code, the CSS and public/_headers.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FRAMES, ATLASES, TEXTURES, VER } from '../.checks/jade-art.js';
import { tierOf, ART_FILES, EAGER, filesOf, zonesNear, needFor, streamPlan, releasable, toRelease, ART_BUDGET, decodedBytes, ZONE_OF, ZONES } from '../.checks/jade-load.js';
import { DISTRICTS, districtAt, OW, CT_H, EAST_X0, FAR_X0 } from '../.checks/jade-city.js';
import { mvT } from '../.checks/jade-layout.js';

let n = 0;
const t = (name, f) => { f(); n++; };
const dir = new URL('../public/art/jade-street/', import.meta.url);
const bytes = f => statSync(new URL(`${f}.webp`, dir)).size;

t('every atlas and texture has a known tier, and every tier name is a real file', () => {
  const src = readFileSync(new URL('../lib/jade-load.ts', import.meta.url), 'utf8');
  for (const m of src.matchAll(/'(atlas-[\w-]+)': '/g)) assert.ok(ATLASES.includes(m[1]), `${m[1]} is listed in jade-load.ts but not packed`);
  for (const a of ATLASES) assert.ok(new RegExp(`'${a}': '`).test(src), `${a} has a tier in jade-load.ts`);
  for (const f of ART_FILES) assert.ok(['core', 'job', 'mini', ...ZONES].includes(tierOf(f)), f);
  assert.equal(ART_FILES.length, ATLASES.length + TEXTURES.length);
});

t('the eager set is small: under 10 MB to download and 180 MB decoded (all the art is about 25 MB and 360 MB)', () => {
  const dl = EAGER.reduce((a, f) => a + bytes(f), 0), all = ART_FILES.reduce((a, f) => a + bytes(f), 0);
  const dec = EAGER.reduce((a, f) => a + decodedBytes(f), 0);
  assert.ok(dl < 10e6, `eager download ${(dl / 1e6).toFixed(1)} MB`);
  assert.ok(dec < 180 * 1048576, `eager decoded ${Math.round(dec / 1048576)} MB`);
  assert.ok(dl < all * 0.45, 'eager is well under half of all the art');
  console.log(`  eager: ${EAGER.length} files, ${(dl / 1048576).toFixed(1)} MB (${Math.round(dec / 1048576)} MB decoded) of ${(all / 1048576).toFixed(1)} MB`);
});

t('the heroes\' everyday poses, the interface and the townsfolk load first; rarer poses fall back to idle', () => {
  const tierOfFrame = name => tierOf(ATLASES[FRAMES[name][0]]);
  for (const h of ['dora', 'enzo']) {
    for (const f of ['idle-down', 'idle-side', 'idle-up', 'walk-down-0', 'run-side-3', 'sneak', 'dash-up', 'hop-side', 'ride-scooter', 'talk', 'cheer-0', 'caught-1', 'swap', 'door'])
      if (FRAMES[`${h}-${f}`]) assert.equal(tierOfFrame(`${h}-${f}`), 'core', `${h}-${f}`);
    for (const m of ['happy', 'worried', 'cross', 'smug']) assert.equal(tierOfFrame(`face-${h}-${m}`), 'core', `face-${h}-${m}`);
    assert.equal(tierOfFrame(`face-${h}`), 'core');
    // every frame of a hero is either core or the job tier (drawHero falls back to the idle frame while one is missing)
    for (const k of Object.keys(FRAMES)) if (k.startsWith(h + '-')) assert.ok(['core', 'job'].includes(tierOfFrame(k)), k);
  }
  for (const f of ['ui-ring', 'face-kee', 'c-key', 'pin-job']) if (FRAMES[f]) assert.equal(tierOfFrame(f), 'core', f);
  assert.equal(tierOfFrame('npc-kee-idle-0'), 'town');
  assert.equal(tierOfFrame('mg-wok'), 'mini');
  assert.equal(tierOfFrame('face-kee-happy'), 'job');
});

t('each later district\'s buildings, givers and faces go with its zone', () => {
  const tierOfFrame = name => tierOf(ATLASES[FRAMES[name][0]]);
  assert.equal(tierOfFrame('npc-kamal-idle-0'), 'isle'); assert.equal(tierOfFrame('face-kaw-cross'), 'isle');
  assert.equal(tierOfFrame('npc-raju-idle-0'), 'east'); assert.equal(tierOfFrame('npc-duyung-idle-0'), 'resort');
  assert.equal(tierOfFrame('npc-ciku-idle-0'), 'far'); assert.equal(tierOfFrame('face-rosie-happy'), 'far');
  for (const k of Object.keys(FRAMES)) {
    if (/^(hdb|bay)-/.test(k)) assert.equal(tierOfFrame(k), 'isle', k);
    if (/^(india|glam)-/.test(k)) assert.equal(tierOfFrame(k), 'east', k);
    if (/^resort-/.test(k)) assert.equal(tierOfFrame(k), 'resort', k);
    if (/^(orchard|katong|changi)-/.test(k)) assert.equal(tierOfFrame(k), 'far', k);
  }
  for (const d of DISTRICTS) assert.ok(ZONES.includes(ZONE_OF[d]), d);
});

t('zones near a spot, what the world waits for, and what streams behind', () => {
  assert.deepEqual(zonesNear(...mvT(20, 20)), ['town']);
  assert.ok(zonesNear(...mvT(OW - 5, 20)).includes('isle'));
  assert.equal(zonesNear(...mvT(EAST_X0 + 20, 20))[0], 'east');
  assert.ok(zonesNear(...mvT(60, CT_H - 10)).includes('resort'));
  assert.equal(zonesNear(...mvT(FAR_X0 + 40, 20))[0], 'far');
  assert.equal(ZONE_OF[districtAt(...mvT(FAR_X0 + 40, 20))], 'far');
  const need = needFor({ here: ['town'], job: false, mini: false });
  assert.ok(filesOf(['core']).every(f => need.includes(f)) && need.includes('atlas-city') && !need.includes('atlas-gear') && !need.includes('atlas-isle'));
  assert.ok(needFor({ here: ['far'], job: true, mini: false }).includes('atlas-gear'));
  assert.ok(needFor({ here: ['town'], job: false, mini: true }).includes('atlas-mg'));
  assert.ok(needFor({ here: ['town'], job: false, mini: false, talk: true }).includes('atlas-faces-town'));
  const pl = streamPlan({ near: ['town', 'isle'], open: ['town', 'isle', 'east'] });
  assert.ok(pl.decode.indexOf('atlas-city') < pl.decode.indexOf('atlas-gear') && pl.decode.indexOf('atlas-gear') < pl.decode.indexOf('atlas-isle'), 'the zone here, the job tier, then the next zone');
  assert.ok(pl.prefetch.includes('atlas-east') && !pl.decode.includes('atlas-east') && !pl.prefetch.includes('atlas-far'));
  assert.equal(new Set([...pl.decode, ...pl.prefetch]).size, pl.decode.length + pl.prefetch.length);
});

t('only idle files nobody needs are let go', () => {
  const o = (near, x = {}) => ({ near, mini: false, job: false, ...x });
  assert.ok(!releasable('atlas-dora', 999, o([]))); assert.ok(!releasable('tex-changi', 999, o(['town'])), 'ground textures stay');
  assert.ok(!releasable('atlas-gear', 60, o(['town'])), 'the job tier stays, unless over the budget');
  assert.ok(releasable('atlas-gear', 60, o(['town']), 45, true)); assert.ok(!releasable('atlas-gear', 60, o(['town'], { job: true }), 45, true), 'never during a job');
  assert.ok(releasable('atlas-isle', 60, o(['town']))); assert.ok(!releasable('atlas-isle', 60, o(['isle'])));
  assert.ok(!releasable('atlas-isle', 10, o(['town'])), 'not while it was drawn lately');
  assert.ok(releasable('atlas-city', 60, o(['far'])), 'Chinatown goes too, from the far east coast');
  assert.ok(!releasable('atlas-mg', 99, o(['town'], { mini: true }))); assert.ok(releasable('atlas-mg', 99, o(['town'])));
});

t('the decoded paintings are kept under the budget, longest idle first, never the zone the heroes stand in', () => {
  const all = ART_FILES.map((n, i) => ({ n, idle: 10 + (i % 7) }));
  const total = all.reduce((a, r) => a + decodedBytes(r.n), 0);
  assert.ok(total > ART_BUDGET);
  const o = { here: ['town'], near: ['town', 'isle', 'east', 'resort', 'far'], mini: false, job: false };
  const go = toRelease(all, o);
  const left = all.filter(r => !go.includes(r.n)).reduce((a, r) => a + decodedBytes(r.n), 0);
  assert.ok(left <= ART_BUDGET, `left ${Math.round(left / 1048576)} MB`);
  assert.ok(!go.some(f => ['core', 'town'].includes(tierOf(f))), 'never the core or the zone here');
  assert.deepEqual(toRelease(all.map(r => ({ ...r, idle: 2 })), o), [], 'nothing drawn in the last 8 seconds');
  assert.deepEqual(toRelease(filesOf(['core', 'town']).map(n => ({ n, idle: 99 })), o), [], 'under budget: nothing');
});

t('every painting carries its content hash, in the code and the CSS, and public/_headers keeps them for a year', () => {
  const files = readdirSync(dir).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5));
  for (const f of files) assert.equal(VER[f], createHash('sha256').update(readFileSync(new URL(`${f}.webp`, dir))).digest('hex').slice(0, 10), `${f}: rerun scripts/jade-art.py`);
  assert.deepEqual(Object.keys(VER).sort(), files.sort());
  const app = new URL('../app/jade-street/', import.meta.url);
  for (const css of readdirSync(app).filter(f => f.endsWith('.css'))) {
    const src = readFileSync(new URL(css, app), 'utf8');
    for (const m of src.matchAll(/\/art\/jade-street\/([\w-]+)\.webp(\?v=(\w+))?/g)) assert.equal(m[3], VER[m[1]], `${css}: ${m[1]}.webp needs ?v=${VER[m[1]]}`);
  }
  for (const tsx of readdirSync(app).filter(f => /\.tsx?$/.test(f))) for (const line of readFileSync(new URL(tsx, app), 'utf8').split('\n'))
    if (!line.includes('const artUrl')) assert.ok(!/\$\{ART\}[^`]*\.webp/.test(line), `${tsx}: use artUrl() so the hash is sent`);
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/art\/jade-street\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/_next\/static\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
});

console.log(`jade (loading): ${n} tests ok`);

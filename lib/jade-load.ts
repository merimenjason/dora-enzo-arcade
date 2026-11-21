// Jade Street: which paintings load when (no DOM, so the Node tests can check it). Every atlas and ground texture has
// a tier: `core` (the heroes' everyday poses, the interface, the townsfolk, the traffic and Chinatown's ground) and
// `town` (Chinatown's buildings, props, givers and faces) make the eager set the loading bar waits for; `job` (set
// pieces, job props, gadgets, guards, the heroes' rarer poses, the empire) streams in first after the title; `mini`
// (the mini-games' pieces) loads when a mini-game opens; and each later zone (the island, Little India and Kampong
// Glam, Sentosa, the far east coast) loads when the heroes get near it, with the zones the save has opened fetched
// into the browser's cache ahead of time. Zones that are far away and not drawn for a while are let go again, so the
// decoded paintings stay well under the ~360 MB they come to all together (lib/jade-scene.ts runs the loading).
import { ATLASES, ATLAS_SIZE, TEXTURES } from './jade-art.js';
import { districtAt, W, H, type District } from './jade-city.js';

export type Zone = 'town' | 'isle' | 'east' | 'resort' | 'far' | 'south' | 'ubin' | 'kallang';
export type Tier = 'core' | 'job' | 'mini' | Zone;
export const ZONES: Zone[] = ['town', 'isle', 'east', 'resort', 'far', 'south', 'ubin', 'kallang'];
export const ZONE_OF: Record<District, Zone> = {
  market: 'town', temple: 'town', canal: 'town', docks: 'town', arcade: 'town', heartland: 'isle', bay: 'isle',
  india: 'east', glam: 'east', resort: 'resort', orchard: 'far', katong: 'far', changi: 'far', tiong: 'south', quay: 'south', jurong: 'south', pulau: 'ubin', kallang: 'kallang',
};

const ATLAS_TIER: Record<string, Tier> = {
  'atlas-dora': 'core', 'atlas-enzo': 'core', 'atlas-ui': 'core', 'atlas-folk': 'core', 'atlas-rides': 'core',
  // the fifteenth pass's four rides and the heroes' poses on them: each can be ridden anywhere, so they wait for no zone.
  // Core until the sixteenth pass; now in the job tier (streamed first after the title, let go only over the budget
  // and never during a job), which took 4 MB off the always-held core and kept the memory soak under 320 MB
  'atlas-rides15': 'job',
  'atlas-city': 'town', 'atlas-city2': 'town', 'atlas-props': 'town', 'atlas-sg': 'town', 'atlas-set': 'town', 'atlas-empire': 'town', 'atlas-cast-town': 'town',
  'atlas-dora2': 'job', 'atlas-enzo2': 'job', 'atlas-faces-town': 'job', 'atlas-set2': 'job', 'atlas-empire2': 'job', 'atlas-sg2': 'job', 'atlas-props2': 'job', 'atlas-gear': 'job', 'atlas-jobs': 'job', 'atlas-aware': 'job',
  'atlas-mg': 'mini',
  'atlas-isle': 'isle', 'atlas-isle2': 'isle', 'atlas-land': 'isle', 'atlas-cast-isle': 'isle', 'atlas-faces-isle': 'isle',
  'atlas-east': 'east', 'atlas-east2': 'east', 'atlas-cast-east': 'east', 'atlas-faces-east': 'east',
  'atlas-resort': 'resort', 'atlas-resort2': 'resort', 'atlas-cast-resort': 'resort', 'atlas-faces-resort': 'resort',
  'atlas-far': 'far', 'atlas-far2': 'far', 'atlas-cast-far': 'far', 'atlas-faces-far': 'far',
  'atlas-south': 'south', 'atlas-south2': 'south', 'atlas-cast-south': 'south', 'atlas-faces-south': 'south',
  // the sixteenth pass: the heroes' new ride actions stream with the job art (until then they ride in their everyday
  // frames); the two new givers, the six new stands and Jurong Lake's bank stream with their zones
  'atlas-act16': 'job', 'atlas-cast16-far': 'far', 'atlas-cast16-south': 'south', 'atlas-stands16': 'south', 'atlas-lake16': 'south',
  // the seventeenth pass: everything of Pulau Ubin's streams with the island (the heroes' island actions too: Changi's jetty is
  // within reach of it); the map icons are small and wait for a job
  'atlas-ubin': 'ubin', 'atlas-boars': 'ubin', 'atlas-cast-ubin': 'ubin', 'atlas-ui17': 'job',
  // the eighteenth pass: Kallang's paintings stream with its zone; the two new hero moves and the new icons are job art
  'atlas-kallang': 'kallang', 'atlas-cast-kallang': 'kallang', 'atlas-act18': 'job', 'atlas-ui18': 'job',
  // the twentieth pass: the heroes' rounds poses are job art; each district's carried things stream with its zone
  'atlas-act20': 'job', 'atlas-gig20-south': 'south', 'atlas-gig20-east': 'east', 'atlas-gig20-far': 'far',
  // (the heroes' new actions stream with the rest of their rarer poses: every hero frame is core or job)
  'atlas-act17': 'job',
};
const TEX_TIER: Record<string, Tier> = {
  road: 'core', walk: 'core', plaza: 'core', grass: 'core', canal: 'core', plank: 'core', temple: 'core', sea: 'core', dock: 'core', neon: 'core', path: 'core', cobble: 'core',
  xway: 'isle', hdb: 'isle', rubber: 'isle', granite: 'isle', deck: 'isle', bay: 'isle',
  india: 'east', glam: 'east', sand: 'resort', resort: 'resort', lagoon: 'resort', fort: 'resort',
  katong: 'far', orchard: 'far', tarmac: 'far', cycle: 'far', jewel: 'far', changi: 'far',
  tiong: 'south', quay: 'south', jurong: 'south', garden: 'south',
  dirt: 'ubin', kampong: 'ubin', mud: 'ubin', forest: 'ubin', quarry: 'ubin', rock: 'ubin', hub: 'kallang', prom: 'kallang', apron: 'kallang', basin: 'kallang',
};
/** the tier of an atlas ('atlas-x') or ground texture ('tex-x'); anything unlisted waits for its zone like a job's art */
export function tierOf(file: string): Tier {
  if (file.startsWith('tex-')) return TEX_TIER[file.slice(4)] ?? 'job';
  return ATLAS_TIER[file] ?? 'job';
}
/** every atlas and ground texture, as file names without the extension */
export const ART_FILES: string[] = [...ATLASES.map(a => a as string), ...TEXTURES.map(t => 'tex-' + t)];
export const filesOf = (tiers: Tier[]) => ART_FILES.filter(f => tiers.includes(tierOf(f)));
/** what the loading bar waits for: enough to draw the title's heroes and play in Chinatown */
export const EAGER = filesOf(['core', 'town']);
/** an atlas's decoded size in bytes (a ground texture is 256 × 256) */
export const decodedBytes = (f: string) => { const s = ATLAS_SIZE[f]; return s ? s[0] * s[1] * 4 : 256 * 256 * 4; };

/** the zones within `r` tiles of a tile (its own first) */
export function zonesNear(tx: number, ty: number, r = 34): Zone[] {
  const out: Zone[] = [];
  for (const [dx, dy] of [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]]) {
    const x = Math.max(0, Math.min(W - 1, Math.floor(tx + dx))), y = Math.max(0, Math.min(H - 1, Math.floor(ty + dy)));
    const z = ZONE_OF[districtAt(x, y)]; if (!out.includes(z)) out.push(z);
  }
  return out;
}
/** what has to be decoded before the world may run: the core, the zone each hero stands in, a job's art while one
 *  runs, Chinatown's dialogue faces while someone talks and the mini-games' pieces while one is open */
export function needFor(o: { here: Zone[]; job: boolean; mini: boolean; talk?: boolean }): string[] {
  const out = filesOf(['core', ...o.here, ...(o.job ? ['job' as Tier] : []), ...(o.mini ? ['mini' as Tier] : [])]);
  if (o.talk && !out.includes('atlas-faces-town')) out.push('atlas-faces-town');
  return out;
}
/** what to load in the background, in order: the zone the heroes stand in, the job tier (so a job starts without a
 *  wait), the zones near the heroes; then the zones the save has open and the mini-games' pieces are fetched (not
 *  decoded) so a ride across the island or a mini-game finds them in the browser's cache */
export function streamPlan(o: { near: Zone[]; open: Zone[] }): { decode: string[]; prefetch: string[] } {
  const decode = [...filesOf(['core']), ...(o.near.length ? filesOf([o.near[0]]) : []), ...filesOf(['job']), ...o.near.flatMap(z => filesOf([z]))];
  const prefetch = [...o.open.filter(z => !o.near.includes(z)).flatMap(z => filesOf([z])), ...filesOf(['mini'])];
  const uniq = (a: string[]) => [...new Set(a)];
  return { decode: uniq(decode), prefetch: uniq(prefetch).filter(f => !decode.includes(f)) };
}
/** may a decoded file be let go once nothing has drawn from it for `idle` seconds: never the core or a ground texture
 *  (tiny, and they live on in the scene's cached patterns); the job tier only to keep under the budget (`overBudget`)
 *  and never while a job runs; the mini-games' pieces while none is open; a zone's files when it is not near the
 *  heroes. (A file let go that is drawn again is asked for again at once, so letting go of something still wanted
 *  costs a moment's reload, never a blank hero.) */
export function releasable(f: string, idleS: number, o: { near: Zone[]; mini: boolean; job: boolean }, idle = 45, overBudget = false): boolean {
  const t = tierOf(f);
  if (t === 'core' || f.startsWith('tex-') || idleS <= idle) return false;
  if (t === 'job') return overBudget && !o.job;
  if (t === 'mini') return !o.mini;
  return !o.near.includes(t);
}
/** the decoded paintings are kept under this (bytes): core and Chinatown are ~135 MB and the job tier ~100 MB, all of
 *  them ~360 MB */
export const ART_BUDGET = 250 * 1048576;
/** which decoded files to let go now: every file `releasable` after 45 idle seconds, then, while the rest still come
 *  to more than `budget`, the longest-idle others not drawn for 8 seconds that are not in a zone a hero stands in
 *  (a zone nearby is fetched again when the heroes move on) */
export function toRelease(res: { n: string; idle: number }[], o: { here: Zone[]; near: Zone[]; mini: boolean; job: boolean }, budget = ART_BUDGET): string[] {
  const go = new Set(res.filter(r => releasable(r.n, r.idle, o)).map(r => r.n));
  let left = res.reduce((a, r) => a + (go.has(r.n) ? 0 : decodedBytes(r.n)), 0);
  for (const r of [...res].sort((a, b) => b.idle - a.idle)) {
    if (left <= budget) break;
    if (go.has(r.n) || !releasable(r.n, r.idle, { ...o, near: o.here }, 8, true)) continue;
    go.add(r.n); left -= decodedBytes(r.n);
  }
  return [...go];
}

// Highburrow: Enzo the advisor. Looks at the state and suggests one good next move, with the command that does it.
// The casual-player bot simply follows this advice; the other bots bend it (greedy expansion, ignoring Warmth).
import {
  Game, preview, hearts, findPath, siteScore, foundProblem, workTiles, tileYield, tileJob, parseTile, slotsFree, isSummit,
  bandAt, terrainAt, villageAt, caravanLoad, maxMp, jobFree, storeCap,
  NEIGHBOURS, NEIGHBOUR_IDS, BUILDS, DECISIONS, GOODS, FESTIVAL, FOOD, GOOD_NAME, TERRAIN, CARAVAN_CAP, W, H,
  idx, hexDist, neighbours, season,
  type Cmd, type Good, type Village, type Unit, type NeighbourId, type BuildKind, type State,
} from './highburrow-game.js';

export interface Advice { key: string; text: string; cmd: Cmd; focus?: { unit?: number; v?: number; q?: number; r?: number; n?: NeighbourId } }
export interface AdviseOpts { ignoreWarmth?: boolean; greedy?: boolean; skip?: Set<string> }

const total = (s: State, g: Good) => s.villages.reduce((a, v) => a + v.store[g], 0)
  + s.units.reduce((a, u) => a + (u.cargo?.[g] ?? 0), 0);
const summit = (s: State) => s.villages.find(isSummit);

/** the best place to found the next village, seen and reachable */
export function bestSite(g: Game, from: [number, number], wantSummit: boolean): [number, number] | null {
  const s = g.s; let best: [number, number] | null = null; let bs = -1e9;
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    if (!s.seen[idx(q, r)] || foundProblem(s, q, r)) continue;
    if (wantSummit !== (bandAt(q, r) >= 4)) continue;
    const sc = siteScore(s, q, r) - hexDist(from, [q, r]) * 0.6;
    if (sc > bs && findPath(s, from, [q, r])) { bs = sc; best = [q, r]; }
  }
  return best;
}
function wantSummitNow(g: Game) {
  const s = g.s;
  return !summit(s) && (s.villages.length >= 3 || s.turn >= 16 || g.pop() >= 10);
}

export function advise(g: Game, o: AdviseOpts = {}): Advice {
  const s = g.s; const skip = o.skip ?? new Set();
  const out: Advice[] = [];
  const push = (a: Advice) => { if (!skip.has(a.key)) out.push(a); };
  if (s.over) return { key: 'over', text: 'The scenario is over.', cmd: { k: 'end' } };
  // 0. a neighbour is waiting on an answer
  if (s.decision) {
    const d = DECISIONS.find(x => x.id === s.decision)!;
    const pick = choiceFor(g, d.id, o);
    return { key: `dec${d.id}`, text: `${d.choices[pick].label}: ${d.choices[pick].line}.`, cmd: { k: 'decide', choice: pick }, focus: d.who ? { n: d.who } : undefined };
  }
  // 1. the festival
  for (const v of s.villages) if (isSummit(v) && !g.festivalProblem(v))
    push({ key: 'fest', text: `Everything is ready. Hold the summit festival in ${v.name}!`, cmd: { k: 'festival', v: v.id }, focus: { v: v.id } });
  // 2. warmth and food per village
  for (const v of s.villages) {
    const p = preview(s, v);
    const cold = p.warmth.next < 30 || (p.warmth.delta < 0 && v.warmth + p.warmth.delta * 2 < 30);
    if (!o.ignoreWarmth && cold) {
      if (slotsFree(v, 'kiln') > 0) { const st = spare(s, v); if (st) push({ key: `kk${v.id}`, text: `${v.name} is getting cold. Put a settler on the kiln (+3 Warmth).`, cmd: { k: 'assign', v: v.id, settler: st.id, job: 'kiln' }, focus: { v: v.id } }); }
      if (slotsFree(v, 'hearth') > 0) { const st = spare(s, v); if (st) push({ key: `hh${v.id}`, text: `${v.name} will be cold (Warmth ${p.warmth.next}). Put a settler on the hearth (+3 Warmth).`, cmd: { k: 'assign', v: v.id, settler: st.id, job: 'hearth' }, focus: { v: v.id } }); }
      if (!v.built.includes('kiln') && !v.queue.includes('kiln')) push({ key: `qk${v.id}`, text: `Build a kiln in ${v.name}: +2 Warmth every turn.`, cmd: { k: 'queue', v: v.id, b: 'kiln' }, focus: { v: v.id } });
    }
    if (o.ignoreWarmth) for (const st of v.settlers) if (st.job === 'hearth' || st.job === 'kiln' || st.job === 'bath') {
      const t = freeFoodTile(s, v); if (t) push({ key: `cw${st.id}`, text: 'More hands in the fields!', cmd: { k: 'assign', v: v.id, settler: st.id, job: t } });
    }
    const foodStore = FOOD.reduce((a, f) => a + v.store[f], 0);
    if (p.food.net < 0 && foodStore + p.food.net * 3 < 0) {
      const t = freeFoodTile(s, v); const st = spare(s, v, true);
      if (t && st) push({ key: `ff${v.id}`, text: `${v.name} will run out of food. Move a settler to a food tile.`, cmd: { k: 'assign', v: v.id, settler: st.id, job: t }, focus: { v: v.id } });
    }
    // a build waiting on materials: work a tile that makes them
    const b0 = v.queue[0];
    if (b0) for (const [gd, n] of Object.entries(BUILDS[b0].cost) as [Good, number][]) {
      if (v.store[gd] >= n) continue;
      const t = workTiles(s, v).map(([q, r]) => tileJob(q, r)).find(j => { const tt = parseTile(j)!; return tileYield(s, v, tt[0], tt[1]).good === gd && jobFree(s, v, j); });
      const st = spare(s, v);
      if (t && st) push({ key: `mat${v.id}${gd}`, text: `${v.name} needs ${n - v.store[gd]} more ${gd} for the ${BUILDS[b0].name}. Put a settler on the ${TERRAIN[terrainAt(...parseTile(t)!)].job.toLowerCase()}.`, cmd: { k: 'assign', v: v.id, settler: st.id, job: t }, focus: { v: v.id } });
    }
    // a loom needs wool: staff a pasture
    if (v.built.includes('loom') && v.store.wool < 4 && total(s, 'cloth') < 8 && !v.settlers.some(x => { const t = parseTile(x.job); return t && TERRAIN[terrainAt(t[0], t[1])].good === 'wool'; })) {
      const t = workTiles(s, v).map(([q, r]) => tileJob(q, r)).find(j => { const tt = parseTile(j)!; return TERRAIN[terrainAt(tt[0], tt[1])].good === 'wool' && jobFree(s, v, j); });
      const st = spare(s, v); if (t && st && p.food.net >= 2) push({ key: `wt${v.id}`, text: `${v.name}'s loom needs wool. Put a settler on the alpaca pasture.`, cmd: { k: 'assign', v: v.id, settler: st.id, job: t }, focus: { v: v.id } });
    }
    // weave when there is wool and the league still needs cloth
    if (v.built.includes('loom') && v.store.wool >= 4 && slotsFree(v, 'weaver') > 0 && total(s, 'cloth') < 8 && p.food.net >= 0) {
      const st = spare(s, v); if (st) push({ key: `wv${v.id}`, text: `${v.name} has wool to spare. Set a weaver to work (cloth for the festival).`, cmd: { k: 'assign', v: v.id, settler: st.id, job: 'weaver' }, focus: { v: v.id } });
    }
    // a better tile than building when nothing is queued
    if (!v.queue.length) for (const st of v.settlers) if (st.job === 'builder') {
      const t = freeFoodTile(s, v) ?? bestTile(s, v); if (t) { push({ key: `bt${st.id}`, text: `Nothing is being built in ${v.name}; send the builder to the fields.`, cmd: { k: 'assign', v: v.id, settler: st.id, job: t }, focus: { v: v.id } }); break; }
    }
    if (v.queue.length && !v.settlers.some(x => x.job === 'builder') && v.settlers.length >= 3 && p.food.net >= 1) {
      const st = spare(s, v); if (st) push({ key: `bb${v.id}`, text: `Put a builder on the ${BUILDS[v.queue[0]].name} in ${v.name}.`, cmd: { k: 'assign', v: v.id, settler: st.id, job: 'builder' }, focus: { v: v.id } });
    }
    if (!v.queue.length) { const b = nextBuild(g, v, o); if (b) push({ key: `q${v.id}${b}`, text: `${v.name} is idle. Build a ${BUILDS[b].name}: ${BUILDS[b].line}`, cmd: { k: 'queue', v: v.id, b }, focus: { v: v.id } }); }
  }
  // 2b. caravan routes: carry surplus (or the festival goods) uphill once, then every turn by itself
  const ra = routeAdvice(g, o); if (ra) push(ra);
  // 3. friends: learn, deliver, trade
  for (const n of NEIGHBOUR_IDS) {
    const ns = s.nb[n], d = NEIGHBOURS[n];
    if (!ns.met) continue;
    if (!ns.learned && hearts(ns.fr) >= 3) push({ key: `l${n}`, text: `The ${d.name} will teach you ${d.skill.name}: ${d.skill.line}.`, cmd: { k: 'learn', n }, focus: { n } });
    const q = d.quest;
    for (const src of g.sources(n)) {
      const st = g.srcStore(src, n)!;
      if (q.kind === 'deliver' && ns.quest === 'open' && st[q.good] >= q.n)
        push({ key: `d${n}`, text: `Deliver ${q.n} ${q.good} to the ${d.name}: ${q.text}`, cmd: { k: 'deliver', n, src }, focus: { n } });
      d.offers.forEach((of, i) => {
        if (ns.traded.includes(i)) return;
        const [gg, gn] = of.give, [wg] = of.get;
        if (st[gg] >= gn + reserve(gg) && wants(s, wg)) push({ key: `t${n}${i}`, text: `Trade ${gn} ${gg} for ${of.get[1]} ${wg} with the ${d.name}.`, cmd: { k: 'trade', n, src, offer: i }, focus: { n } });
      });
    }
  }
  // 4. units
  for (const u of s.units) {
    if (u.mp <= 0 || u.rest || u.route) continue;
    const a = unitAdvice(g, u, o);
    if (a) push(a);
  }
  // 5b. reinforce the summit village from the biggest village
  const top = summit(s);
  if (top && top.settlers.length < 4 && !s.units.some(u => u.kind === 'settler') && s.villages.length >= 4) {
    const v = [...s.villages].filter(x => x !== top).sort((a, b) => b.settlers.length - a.settlers.length)[0];
    if (v && v.settlers.length >= 5) push({ key: `reinf${v.id}`, text: `${top.name} needs more hands. Send a settler up from ${v.name}.`, cmd: { k: 'send', v: v.id }, focus: { v: v.id } });
  }
  // 5. expansion: send a settler out
  const wantVillages = o.greedy ? 5 : summit(s) ? 4 : 5;
  const hasSettlerUnit = s.units.some(u => u.kind === 'settler');
  if (!hasSettlerUnit && s.villages.length < wantVillages) {
    const v = [...s.villages].sort((a, b) => b.settlers.length - a.settlers.length)[0];
    const min = o.greedy ? 2 : s.villages.length === 1 ? 3 : 4;
    if (v && v.settlers.length >= min && preview(s, v).food.net >= (o.greedy ? -5 : 0))
      push({ key: `send${v.id}`, text: wantSummitNow(g) ? `Send a settler from ${v.name} with Enzo to found a village on the snow line (for the festival).` : `${v.name} is growing. Send a settler out with Enzo to found a new village.`, cmd: { k: 'send', v: v.id }, focus: { v: v.id } });
  }
  out.push({ key: 'end', text: 'All done for this turn. End the turn.', cmd: { k: 'end' } });
  return out[0];
}

function unitAdvice(g: Game, u: Unit, o: AdviseOpts): Advice | null {
  const s = g.s;
  const mv = (q: number, r: number, text: string, key: string): Advice | null =>
    (u.q === q && u.r === r) || !findPath(s, [u.q, u.r], [q, r]) ? null : { key, text, cmd: { k: 'move', unit: u.id, q, r }, focus: { unit: u.id, q, r } };
  if (u.kind === 'dora') {
    // befriend whoever is due a visit, nearest first
    const due = NEIGHBOUR_IDS.filter(n => s.seen[idx(NEIGHBOURS[n].q, NEIGHBOURS[n].r)] && hearts(s.nb[n].fr) < 5 && s.turn - s.nb[n].befriendT >= 2)
      .sort((a, b) => hexDist([u.q, u.r], [NEIGHBOURS[a].q, NEIGHBOURS[a].r]) - hexDist([u.q, u.r], [NEIGHBOURS[b].q, NEIGHBOURS[b].r]));
    for (const n of due) {
      const d = NEIGHBOURS[n];
      if (hexDist([u.q, u.r], [d.q, d.r]) <= 1) return { key: `bf${n}`, text: `Dora is next to the ${d.name}. Befriend them!`, cmd: { k: 'befriend', unit: u.id }, focus: { unit: u.id, n } };
      const spot = neighbours(d.q, d.r).filter(([q, r]) => findPath(s, [u.q, u.r], [q, r])).sort((a, b) => hexDist([u.q, u.r], a) - hexDist([u.q, u.r], b))[0];
      if (spot && (!s.nb[n].met || hexDist([u.q, u.r], [d.q, d.r]) <= 6)) { const a = mv(spot[0], spot[1], s.nb[n].met ? `Visit the ${d.name} again to grow your friendship.` : `Walk Dora over to meet the ${d.name}.`, `go${n}`); if (a) return a; }
    }
    for (const n of NEIGHBOUR_IDS) {
      const q = NEIGHBOURS[n].quest;
      if (q.kind === 'visit' && s.nb[n].met && !s.nb[n].found) { const a = mv(q.q, q.r, `Find the ${q.thing} for the ${NEIGHBOURS[n].name}.`, `qv${n}`); if (a) return a; }
    }
    if (g.frontier(u)) return { key: 'ex', text: 'Send Dora exploring to lift the mist.', cmd: { k: 'explore', unit: u.id }, focus: { unit: u.id } };
    return null;
  }
  if (u.kind === 'enzo') {
    const st = s.units.find(x => x.kind === 'settler');
    if (st && st.q === u.q && st.r === u.r && !foundProblem(s, u.q, u.r)) return { key: 'found', text: 'Enzo and a settler are here. Found a village!', cmd: { k: 'found', unit: u.id }, focus: { unit: u.id } };
    if (st) {
      const site = bestSite(g, [u.q, u.r], (!o.greedy || s.villages.length >= 4) && wantSummitNow(g)) ?? bestSite(g, [u.q, u.r], false);
      if (site) return mv(site[0], site[1], `Walk Enzo to a good village site${bandAt(site[0], site[1]) >= 4 ? ' on the snow line' : ''}.`, 'esite');
    }
    // otherwise help build in the village that needs it most
    const v = [...s.villages].filter(x => x.queue.length).sort((a, b) => hexDist([u.q, u.r], [a.q, a.r]) - hexDist([u.q, u.r], [b.q, b.r]))[0];
    if (v && (u.q !== v.q || u.r !== v.r)) return mv(v.q, v.r, `Enzo can help build in ${v.name} (+4 work).`, 'ebuild');
    return null;
  }
  if (u.kind === 'settler') {
    const top = summit(s);
    if (top && s.villages.length >= 4) {
      if (u.q === top.q && u.r === top.r) return { key: 'join', text: `Let the settler join ${top.name}.`, cmd: { k: 'join', unit: u.id }, focus: { unit: u.id } };
      return mv(top.q, top.r, `Walk the settler up to ${top.name}.`, 'sup');
    }
    const e = s.units.find(x => x.kind === 'enzo')!;
    const v = villageAt(s, u.q, u.r);
    const site = e.path.length ? e.path[e.path.length - 1] : [e.q, e.r] as [number, number];
    if (!foundProblem(s, site[0], site[1]) || e.path.length) return mv(site[0], site[1], 'Walk the settler to meet Enzo at the new village site.', 'ssite');
    if (v && s.villages.length >= 5) return { key: 'join', text: `Let the settler join ${v.name}.`, cmd: { k: 'join', unit: u.id }, focus: { unit: u.id } };
    return null;
  }
  if (u.kind === 'caravan') return caravanAdvice(g, u);
  return null;
}

/** the caravan carries festival goods up to the summit village, and food to whoever is short */
function caravanAdvice(g: Game, u: Unit): Advice | null {
  const s = g.s; const top = summit(s); const here = villageAt(s, u.q, u.r);
  const cargo = u.cargo!;
  if (top) {
    const need = (Object.entries(FESTIVAL) as [Good, number][]).filter(([gd, n]) => top.store[gd] + 0 < n);
    if (here === top) {
      for (const gd of [...FOOD, 'cloth', 'silver', 'wool', 'stone'] as Good[]) if (cargo[gd] > 0) return { key: `un${gd}`, text: `Unload the ${GOOD_NAME[gd].toLowerCase()} at ${top.name}.`, cmd: { k: 'load', unit: u.id, good: gd, n: -cargo[gd] }, focus: { unit: u.id } };
    } else if (here) {
      const room = CARAVAN_CAP - caravanLoad(u);
      const p = preview(s, here);
      for (const [gd, n] of need) {
        const keep = FOOD.includes(gd) ? here.settlers.length * 2 : 0;
        const take = Math.min(room, n - top.store[gd] - cargo[gd], here.store[gd] - keep);
        if (take > 0) return { key: `ld${gd}${here.id}`, text: `Load ${take} ${GOOD_NAME[gd].toLowerCase()} for the festival.`, cmd: { k: 'load', unit: u.id, good: gd, n: take }, focus: { unit: u.id } };
      }
      // food for the summit's settlers
      const tp = preview(s, top);
      if (tp.food.net < 0 && room > 0 && p.food.net > 0 && here.store.potatoes > 6) return { key: `ldp${here.id}`, text: `Load potatoes to feed ${top.name}.`, cmd: { k: 'load', unit: u.id, good: 'potatoes', n: Math.min(room, here.store.potatoes - 6) }, focus: { unit: u.id } };
    }
    const carrying = caravanLoad(u) > 0;
    if (carrying) return { key: 'cvup', text: `Take the caravan up to ${top.name}.`, cmd: { k: 'move', unit: u.id, q: top.q, r: top.r }, focus: { unit: u.id } };
    // go where the needed goods are
    const src = s.villages.filter(v => v !== top && need.some(([gd]) => v.store[gd] > (FOOD.includes(gd) ? v.settlers.length * 2 : 0)))
      .sort((a, b) => hexDist([u.q, u.r], [a.q, a.r]) - hexDist([u.q, u.r], [b.q, b.r]))[0];
    if (src && src !== here) return { key: 'cvsrc', text: `Send the caravan to ${src.name} to pick up festival goods.`, cmd: { k: 'move', unit: u.id, q: src.q, r: src.r }, focus: { unit: u.id } };
    return null;
  }
  // before the summit: even out stone (buildings) and food between villages
  if (here) {
    for (const gd of ['stone', 'potatoes', 'quinoa', 'wool', 'salt'] as Good[]) if (cargo[gd] > 0 && preview(s, here).food.net >= -9) {
      const needy = needOf(s, here, gd); if (needy > 0) return { key: `udr${gd}`, text: `Unload ${GOOD_NAME[gd].toLowerCase()} in ${here.name}.`, cmd: { k: 'load', unit: u.id, good: gd, n: -cargo[gd] }, focus: { unit: u.id } };
    }
    for (const v of s.villages) if (v !== here) for (const gd of ['stone', 'potatoes', 'salt'] as Good[]) {
      const spareN = here.store[gd] - Math.max(6, needOf(s, here, gd) + 4);
      if (needOf(s, v, gd) > 0 && spareN >= 3 && caravanLoad(u) < CARAVAN_CAP && cargo[gd] === 0)
        return { key: `ldr${gd}${v.id}`, text: `Load ${GOOD_NAME[gd].toLowerCase()} for ${v.name}.`, cmd: { k: 'load', unit: u.id, good: gd, n: Math.min(spareN, 6) }, focus: { unit: u.id } };
    }
    if (caravanLoad(u) > 0) {
      const v = s.villages.find(x => x !== here && (['stone', 'potatoes', 'quinoa', 'salt'] as Good[]).some(gd => cargo[gd] > 0 && needOf(s, x, gd) > 0));
      if (v) return { key: `cvto${v.id}`, text: `Take the caravan to ${v.name}.`, cmd: { k: 'move', unit: u.id, q: v.q, r: v.r }, focus: { unit: u.id } };
    }
  }
  return null;
}
function needOf(s: State, v: Village, gd: Good) {
  if (gd === 'stone') { const b = v.queue[0]; return b ? (BUILDS[b].cost.stone ?? 0) - v.store.stone : 0; }
  if (gd === 'salt') { const b = v.queue[0]; return b ? (BUILDS[b].cost.salt ?? 0) - v.store.salt : 0; }
  if (FOOD.includes(gd)) { const p = preview(s, v); return p.food.net < 0 ? v.settlers.length * 3 - FOOD.reduce((a, f) => a + v.store[f], 0) : 0; }
  return 0;
}
function reserve(g: Good) { return g === 'quinoa' ? 10 : g === 'salt' ? 2 : g === 'potatoes' ? 8 : g === 'stone' ? 6 : g === 'cloth' ? 6 : 0; }
function wants(s: State, g: Good) {
  if (g === 'silver') return total(s, 'silver') < 6;
  if (g === 'salt') return total(s, 'salt') < 6 || s.villages.some(v => v.queue[0] && (BUILDS[v.queue[0]].cost.salt ?? 0) > v.store.salt);
  if (g === 'wool') return s.villages.some(v => v.built.includes('loom')) && total(s, 'cloth') < 8 && total(s, 'wool') < 10;
  if (g === 'stone') return total(s, 'stone') < 10;
  if (g === 'potatoes') return s.villages.some(v => preview(s, v).food.net < 0);
  return false;
}
function nextBuild(g: Game, v: Village, o: AdviseOpts): BuildKind | null {
  const s = g.s; const p = preview(s, v);
  const has = (b: BuildKind) => v.built.includes(b) || v.queue.includes(b);
  const anyLoom = s.villages.some(x => x.built.includes('loom') || x.queue.includes('loom'));
  const caravans = s.units.filter(u => u.kind === 'caravan').length + s.villages.reduce((a, x) => a + x.queue.filter(b => b === 'caravan').length, 0);
  if (!o.ignoreWarmth && !has('kiln') && (p.warmth.delta < 0 || bandAt(v.q, v.r) >= 2)) return 'kiln';
  if (o.greedy && caravans < 2) return 'caravan';
  const woolTile = workTiles(s, v).some(([q, r]) => TERRAIN[terrainAt(q, r)].good === 'wool');
  if (!has('loom') && total(s, 'cloth') < 8 && (woolTile || (!anyLoom && v.store.wool >= 2))) return 'loom';
  if (!o.ignoreWarmth && !has('bath') && bandAt(v.q, v.r) >= 3) return 'bath';
  if (!has('granary') && v.settlers.length >= 4) return 'granary';
  if (!has('lookout') && s.villages.length >= 2 && !s.villages.some(x => x.built.includes('lookout') || x.queue.includes('lookout'))) return 'lookout';
  if (caravans < 2 && s.villages.length >= 3) return 'caravan';
  if (!o.ignoreWarmth && !has('bath') && v.settlers.length >= 6) return 'bath';
  return null;
}
/** the settler whose job matters least right now */
function spare(s: State, v: Village, forFood = false) {
  const val = (job: string) => {
    if (job === 'builder') return 0;
    if (job === 'weaver') return 1;
    if (job === 'hearth' || job === 'kiln' || job === 'bath') return forFood ? 2 : 9;
    const t = parseTile(job); if (!t) return 1;
    const y = tileYield(s, v, t[0], t[1]);
    return y.good && FOOD.includes(y.good) ? 8 : 3 + y.n * 0.1;
  };
  return [...v.settlers].sort((a, b) => val(a.job) - val(b.job)).find(x => val(x.job) < (forFood ? 8 : 9));
}
function freeFoodTile(s: State, v: Village): string | null {
  const t = workTiles(s, v).map(([q, r]) => ({ j: tileJob(q, r), y: tileYield(s, v, q, r) }))
    .filter(x => x.y.good && FOOD.includes(x.y.good) && x.y.n >= 2 && jobFree(s, v, x.j)).sort((a, b) => b.y.n - a.y.n);
  return t[0]?.j ?? null;
}
function bestTile(s: State, v: Village): string | null {
  const t = workTiles(s, v).map(([q, r]) => ({ j: tileJob(q, r), y: tileYield(s, v, q, r) }))
    .filter(x => (x.y.n >= 1 || x.y.warmth) && jobFree(s, v, x.j)).sort((a, b) => b.y.n - a.y.n);
  return t[0]?.j ?? null;
}

/** things needing the player: units with moves and no orders, villages with a problem */
export function attention(g: Game): { text: string; unit?: number; v?: number }[] {
  const s = g.s; const out: { text: string; unit?: number; v?: number }[] = [];
  for (const u of s.units) if (u.mp > 0 && !u.rest && !u.path.length && u.mp >= maxMp(s, u)) out.push({ text: `${u.kind === 'settler' ? 'Settler' : u.kind === 'caravan' ? 'Caravan' : u.kind === 'dora' ? 'Dora' : 'Enzo'} is waiting for orders`, unit: u.id });
  for (const v of s.villages) {
    const p = preview(s, v);
    if (p.food.short) out.push({ text: `${v.name} will go hungry`, v: v.id });
    else if (p.warmth.next < 30) out.push({ text: `${v.name} is cold (Warmth ${p.warmth.next})`, v: v.id });
    else if (!v.queue.length) out.push({ text: `${v.name} is building nothing`, v: v.id });
  }
  return out;
}
export { season };

/** how each kind of player answers the mid-game requests */
function choiceFor(g: Game, id: string, o: AdviseOpts): number {
  const s = g.s;
  if (id === 'herd') return o.greedy ? 1 : s.villages.some(v => v.store.quinoa - (isSummit(v) ? 10 : 0) >= 8) ? 0 : 1;
  if (id === 'alpacas') return o.greedy ? 0 : 1;
  if (id === 'coldsnap') return o.ignoreWarmth || o.greedy ? 1 : 0;
  return 0;
}
/** where a standing caravan route would help most: a full storehouse wasting food, or the summit short of festival goods */
export function routeAdvice(g: Game, o: AdviseOpts = {}): Advice | null {
  const s = g.s; const cars = s.units.filter(u => u.kind === 'caravan');
  if (!cars.length) return null;
  const routed = (a: number, b: number) => s.units.some(u => u.route && u.route.a === a && u.route.b === b);
  const top = summit(s);
  const wasteOf = (v: Village) => (Object.entries(preview(s, v).waste) as [Good, number][]).filter(([, n]) => n > 0).map(([gd]) => gd);
  // the summit first: one caravan (taken off another route if need be) brings the festival goods uphill
  if (top) {
    const need = (['cloth', 'silver', 'quinoa'] as Good[]).filter(gd => top.store[gd] < ((FESTIVAL as Record<string, number>)[gd] ?? 0));
    const spareQ = (v: Village) => Math.max(0, v.store.quinoa - v.settlers.length * 4);
    const score = (v: Village) => need.reduce((t, gd) => t + Math.min(gd === 'quinoa' ? spareQ(v) : v.store[gd] * 3, 10), 0);
    const from = [...s.villages].filter(x => x !== top && !routed(x.id, top.id) && findPath(s, [x.q, x.r], [top.q, top.r])).sort((a, b) => score(b) - score(a))[0];
    const feeders = cars.filter(u => u.route?.b === top.id);
    const worst = feeders.map(u => ({ u, sc: score(s.villages.find(v => v.id === u.route!.a) ?? top) })).sort((a, b) => a.sc - b.sc)[0];
    const car = cars.find(u => !u.route) ?? cars.find(u => u.route && u.route.b !== top.id)
      ?? (from && worst && score(from) >= worst.sc + 6 ? worst.u : undefined);
    if (car && need.length && from && score(from) >= 3) {
      const carry = [...new Set([...(['quinoa', 'cloth', 'silver'] as Good[]), ...wasteOf(from).filter(gd => FOOD.includes(gd))])];
      return { key: `rt${from.id}-${top.id}`, text: `Set a llama route ${from.name} → ${top.name} carrying ${carry.join(', ')}: the festival goods${wasteOf(from).length ? ' and the surplus' : ''} will walk uphill every turn.`, cmd: { k: 'route', unit: car.id, a: from.id, b: top.id, carry }, focus: { v: from.id } };
    }
  }
  const free = cars.find(u => !u.route); if (!free) return null;
  for (const v of s.villages) {
    const w = wasteOf(v); if (!w.length) continue;
    const room = (x: Village) => w.reduce((t, gd) => t + Math.max(0, storeCap(x, gd) - x.store[gd]), 0);
    const to = [...s.villages].filter(x => x !== v && room(x) >= 10).sort((a, b) => (b === top ? 1 : 0) - (a === top ? 1 : 0) || bandAt(b.q, b.r) - bandAt(a.q, a.r) || room(b) - room(a))[0];
    if (!to || routed(v.id, to.id) || !findPath(s, [v.q, v.r], [to.q, to.r])) continue;
    return { key: `rt${v.id}-${to.id}`, text: `${v.name}'s storehouse is full and ${w.join(', ')} is going to waste. Set a llama route ${v.name} → ${to.name} to carry it uphill.`, cmd: { k: 'route', unit: free.id, a: v.id, b: to.id, carry: w }, focus: { v: v.id } };
  }
  void GOODS;
  return null;
}

// The village screen: a cut-away burrow with a ring of six worked tiles around it. Settlers are dragged (or tapped,
// then a destination tapped) between tiles and rooms. The side panel (a sheet on phones) shows the build queue,
// the storehouse, Warmth, happiness and growth, and every number explains itself.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { hexCenter, tileArt } from '@/lib/highburrow-scene';
import { FRAMES } from '@/lib/highburrow-art';
import {
  preview, tileYield, workTiles, jobFree, parseTile, tileJob, terrainAt, isSummit, slotsFree, reservedQuinoa, caravanLoad, storeCap,
  TERRAIN, GOODS, GOOD_NAME, GOOD_WHY, BUILDS, BUILD_IDS, INDOOR, FESTIVAL, FOOD, EAT, CARAVAN_CAP,
  type Village, type Good, type IndoorJob, type Settler, type Cmd, type BuildKind,
} from '@/lib/highburrow-game';
import { Sprite, Icon, partsHtml, ART } from './dom';
import type { Highburrow } from './controller';

const ROOMS: Record<string, { x: number; y: number; build?: BuildKind; art: string }> = {
  hearth: { x: 52, y: 37, art: 'b-store' },
  weaver: { x: 32, y: 52, build: 'loom', art: 'b-loom' },
  granary: { x: 70, y: 52, build: 'granary', art: 'b-granary' },
  kiln: { x: 26, y: 77, build: 'kiln', art: 'b-kiln' },
  bath: { x: 72, y: 77, build: 'bath', art: 'b-bath' },
  lookout: { x: 63, y: 15, build: 'lookout', art: 'b-lookout' },
  builder: { x: 47, y: 93, art: '' },
};
/** the six ring slots, by the direction of the neighbouring hex (screen angle) */
const SLOTS: [number, number][] = [[91, 50], [86, 17], [14, 17], [9, 50], [14, 83], [86, 83]];
const GOOD_JOB: Record<string, string> = { quinoa: 'job-quinoa', potatoes: 'job-potato', wool: 'job-wool', salt: 'job-salt', stone: 'job-stone', silver: 'job-silver' };
const JOB_ART: Record<string, string> = { hearth: 'job-hearth', builder: 'job-builder', weaver: 'job-weave', kiln: 'job-kiln', granary: 'job-granary', lookout: 'job-lookout', bath: 'job-bath' };
const pos = (x: number, y: number): CSSProperties => ({ left: `${x}%`, top: `${y}%` });

export function VillageView({ app }: { app: Highburrow }) {
  const g = app.g, s = g.s, v = g.village(app.village.id)!;
  const scroller = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<{ name: string; h: number; x: number; y: number } | null>(null);
  const [swiped, setSwiped] = useState(false);
  const centredAt = useRef(0);
  // stage size: as big as fits beside (or above) the panel, 3:2
  const narrow = innerWidth < 720 && innerHeight > innerWidth;
  const aw = narrow ? innerWidth : innerWidth - Math.min(340, innerWidth * 0.34);
  // on a phone held upright the cut-away is drawn wider than the screen (about 1.6×) and scrolls sideways,
  // so the settlers and their tiles are big enough to drag with a thumb
  const ah = narrow ? Math.min(innerHeight * 0.5, innerWidth * 1.6 / 1.5) : innerHeight;
  const sw = narrow ? ah * 1.5 : Math.min(aw, ah * 1.5); const U = sw / 100;
  useEffect(() => {
    if (!narrow || !scroller.current) return;
    const el = scroller.current; centredAt.current = performance.now(); el.scrollLeft = (sw - el.clientWidth) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.village.id, narrow]);
  if (!v) return null;
  const p = preview(s, v);
  const picked = app.village.picked != null ? v.settlers.find(x => x.id === app.village.picked) ?? null : null;
  const assign = (st: Settler, job: string) => { app.village.picked = null; app.act({ k: 'assign', v: v.id, settler: st.id, job }); app.refresh(); };
  const cmd = (c: Cmd) => { const r = app.act(c); app.say(r.msg, r.ok ? '' : 'bad'); };
  const isTarget = (job: string) => !!picked && (jobFree(s, v, job, picked) || v.settlers.some(x => x.job === job && parseTile(job)));
  const tapJob = (job: string) => (e: RMouseEvent) => { if ((e.target as Element).closest('.fig')) return; if (picked) { e.stopPropagation(); assign(picked, job); } };
  const drag = (e: RPointerEvent, st: Settler, name: string, h: number) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY; let dragging = false;
    const move = (m: PointerEvent) => {
      if (!dragging && Math.hypot(m.clientX - sx, m.clientY - sy) > 8) { dragging = true; app.village.picked = st.id; app.refresh(); }
      if (dragging) setGhost({ name, h, x: m.clientX, y: m.clientY });
    };
    const up = (m: PointerEvent) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      if (dragging) {
        setGhost(null);
        const t = document.elementFromPoint(m.clientX, m.clientY)?.closest('[data-job]') as HTMLElement | null;
        if (t) assign(st, t.dataset.job!); else { app.village.picked = null; app.refresh(); }
      } else { app.village.picked = app.village.picked === st.id ? null : st.id; app.refresh(); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };
  const figure = (st: Settler, art: string, h: number) => {
    // each settler keeps its own fur colour in every job pose
    const name = FRAMES[`${art}-${st.fur}`] ? `${art}-${st.fur}` : art;
    return <Sprite key={st.id} name={name} h={h} cls={'fig' + (picked?.id === st.id ? ' sel' : '')}
      tip={`<div class="tt">A ${['grey', 'beige', 'dark'][st.fur]} settler</div>${jobName(st.job)}<br><i>Drag to another tile or room, or tap then tap where to go.</i>`}
      onPointerDown={e => drag(e, st, name, h)} />;
  };
  // rooms
  const rooms: ReactNode[] = Object.entries(ROOMS).map(([job, r]) => {
    const built = !r.build || v.built.includes(r.build);
    const name = job === 'hearth' ? 'Hearth' : job === 'builder' ? 'Builders' : r.build ? BUILDS[r.build].name : job;
    const ij = job as IndoorJob;
    const tip = built
      ? `<div class="tt">${INDOOR[ij].name}</div>${INDOOR[ij].line} each.${job !== 'builder' ? `<br>${slotsFree(v, ij)} of ${INDOOR[ij].slots} places free.` : ''}${r.build ? `<br><i>${BUILDS[r.build].line}</i>` : ''}`
      : `<div class="tt">${name}</div>${BUILDS[r.build!].line}<br>Cost: ${costText(r.build!)}`;
    return (
      <div key={job} className={'room' + (built ? '' : ' unbuilt') + (isTarget(job) ? ' target' : '')} data-job={job} style={pos(r.x, r.y)} onClick={tapJob(job)}>
        {built && r.art && <Sprite name={r.art} h={U * (job === 'lookout' ? 20 : job === 'hearth' ? 9 : 11)} cls="rart" />}
        <div className="figs">{v.settlers.filter(x => x.job === job).map(st => figure(st, JOB_ART[job], U * 8.5))}</div>
        <div className="rtag" data-tip={tip} onClick={built ? undefined : () => cmd({ k: 'queue', v: v.id, b: r.build! })}>
          {name} <small>{built ? INDOOR[ij].line : v.queue.includes(r.build!) ? 'queued' : 'tap to build'}</small>
        </div>
      </div>
    );
  });
  // ring tiles
  const centre = hexCenter(v.q, v.r);
  const workable = new Set(workTiles(s, v).map(([q, r]) => tileJob(q, r)));
  const tiles = neighbourList(v).map(([q, r]) => {
    const pc = hexCenter(q, r); const ang = Math.atan2(pc.y - centre.y, pc.x - centre.x);
    const slot = SLOTS[((Math.round(-ang / (Math.PI / 3)) % 6) + 6) % 6];
    const job = tileJob(q, r); const t = TERRAIN[terrainAt(q, r)]; const work = workable.has(job);
    const hex = <Sprite name={s.seen[q + r * 18] ? tileArt(q, r) : 't-snow'} h={U * 22} w={U * 17} cls="thex" />;
    if (!work) {
      const why = !s.seen[q + r * 18] ? 'Unexplored' : TERRAIN[terrainAt(q, r)].work ? 'Neighbours’ land' : t.name;
      return <div key={job} className="vtile nowork" style={pos(slot[0], slot[1])}>{hex}<div className="tlabel nw">{why}</div></div>;
    }
    const y = tileYield(s, v, q, r);
    const st = v.settlers.find(x => x.job === job);
    const tip = partsHtml(`${t.job}${st ? '' : ' (nobody working)'}`, y.good ? y.parts : [{ label: 'Hot spring', n: y.warmth }], y.good ? `+${y.n} ${y.good}` : `+${y.warmth} Warmth`, st ? '' : 'Drag a settler here to work it.');
    return (
      <div key={job} className={'vtile' + (isTarget(job) ? ' target' : '')} data-job={job} style={pos(slot[0], slot[1])} onClick={tapJob(job)}>
        {hex}
        <div className={'tlabel' + (st ? '' : ' idle')} data-tip={tip}>
          {y.good ? <Icon name={y.good} size={U * 3.4} /> : y.warmth ? <Icon name="warmth" size={U * 3.4} /> : null}
          <span>{t.job} {y.good ? `+${y.n}` : `+${y.warmth} Warmth`}</span>
        </div>
        {st && figure(st, y.good ? GOOD_JOB[y.good] : 'job-bath', U * 9)}
      </div>
    );
  });
  // Dora and Enzo come out to wave when they are here
  const leaders = s.units.filter(x => x.q === v.q && x.r === v.r && (x.kind === 'dora' || x.kind === 'enzo'));
  return (
    <div className={'overlay village' + (narrow ? ' narrow' : '')} onPointerDown={e => { if (e.target === e.currentTarget) app.closeModal(); }}>
      <div className="vswipe-wrap">
        <div className="vscroll" ref={scroller} onScroll={() => { if (!swiped && performance.now() - centredAt.current > 400) setSwiped(true); }}>
          <div className={'vstage' + (picked ? ' picking' : '')} style={{ width: `${sw}px`, height: `${sw / 1.5}px` }}>
            <img className="vbg" src={`${ART}bg-village.webp`} alt="" />
            <div className="vbanner" data-tip={`<div class="tt">${v.name}</div>Founded on turn ${v.founded} on ${TERRAIN[terrainAt(v.q, v.r)].name.toLowerCase()}.<br>Each settler eats ${EAT} food a turn.`}>{v.name} · Population {v.settlers.length}</div>
            {rooms}{tiles}
            {leaders.map((x, i) => <Sprite key={x.id} name={x.kind === 'dora' ? 'dora-wave' : 'enzo-advise'} h={U * 15} cls="leader" style={pos(40 + i * 10, 97)} />)}
          </div>
        </div>
        {narrow && !swiped && <div className="vswipe">◂ Swipe to see the whole burrow ▸</div>}
      </div>
      <VillagePanel app={app} v={v} p={p} cmd={cmd} />
      {ghost && <Sprite name={ghost.name} h={ghost.h} cls="fig ghost" style={{ left: ghost.x - (FRAMES[ghost.name] ? ghost.h * FRAMES[ghost.name][3] / FRAMES[ghost.name][4] : ghost.h) / 2, top: ghost.y - ghost.h * 0.8 }} />}
    </div>
  );
}

function VillagePanel({ app, v, p, cmd }: { app: Highburrow; v: Village; p: ReturnType<typeof preview>; cmd: (c: Cmd) => void }) {
  const g = app.g, s = g.s;
  const sec = (title: string, body: ReactNode, key = title) => <section key={key} className="psec"><h3 className="ptitle">{title}</h3>{body}</section>;
  const why = isSummit(v) ? g.festivalProblem(v) : '';
  const waste = (Object.entries(p.waste) as [Good, number][]).filter(([, n]) => n > 0);
  const car = s.units.find(u => u.kind === 'caravan');
  const mood = v.happy >= 70 ? 'Happy' : v.happy >= 40 ? 'Content' : 'Unhappy';
  const net = p.food.net - p.spoil;
  return (
    <div className="vpanel woven">
      <button className="xbtn" title="Close (Esc)" onClick={() => app.closeModal()}>×</button>
      {isSummit(v) && sec('Summit festival', <>
        <div className="fneeds">
          {(Object.entries(FESTIVAL) as [Good, number][]).map(([gd, n]) => <span key={gd}><span className={v.store[gd] >= n ? 'pos' : 'neg'}>{GOOD_NAME[gd]} {Math.min(v.store[gd], n)}/{n}</span> · </span>)}
          <span className={g.pop() >= g.goal() ? 'pos' : 'neg'}>Chinchillas {g.pop()}/{g.goal()}</span>
        </div>
        <div className="fnote">Silver comes only from the condors: trade quinoa, salt or cloth with them, then let a llama route carry it up here.</div>
        <button className="wbtn red" disabled={!!why} title={why || 'Everything is ready!'} onClick={() => { app.modal = ''; app.act({ k: 'festival', v: v.id }); }}>Hold the summit festival</button>
      </>)}
      {sec('Building', <>
        {v.queue.map((k, i) => {
          const d = BUILDS[k]; const need = k === 'bath' && neighbourList(v).some(([q, r]) => terrainAt(q, r) === 'spring') ? d.work / 2 : d.work;
          const turns = p.work.n ? Math.ceil((need - v.work) / p.work.n) : 99;
          return (
            <div key={i} className="qrow">
              <Icon name={k} size={34} />
              <div className="qname">{d.name}{i === 0 ? '' : <> <small>next</small></>}</div>
              {i === 0 && <div className="bar" data-tip={partsHtml(`${d.name}: ${v.work}/${need} work`, p.work.parts, `+${p.work.n} a turn`, `${turns < 99 ? `About ${turns} turn${turns === 1 ? '' : 's'} left.` : 'Nobody is building.'} Needs ${costText(k)} when done.${missing(v, k)}`)}><i style={{ width: `${Math.min(100, v.work / need * 100)}%` }} /></div>}
              <button className="mini" title="Remove" onClick={() => cmd({ k: 'unqueue', v: v.id, i })}>×</button>
            </div>
          );
        })}
        {!v.queue.length && <div className="muted">Nothing queued. Pick something below.</div>}
        <div className="adds">
          {BUILD_IDS.filter(k => k === 'caravan' || !(v.built.includes(k) || v.queue.includes(k))).map(k => (
            <button key={k} className="addb" disabled={v.queue.length >= 3} data-tip={`<div class="tt">${BUILDS[k].name}</div>${BUILDS[k].line}<br>${BUILDS[k].work} work · ${costText(k)}`} onClick={() => cmd({ k: 'queue', v: v.id, b: k })}>
              <Icon name={k} size={30} /><span>{BUILDS[k].name}</span>
            </button>
          ))}
        </div>
      </>)}
      {sec('Storehouse', <>
        {GOODS.map(gd => {
          const d = p.goods[gd].n;
          const res = gd === 'quinoa' && reservedQuinoa(v) ? ` ${Math.min(v.store.quinoa, reservedQuinoa(v))} are set aside for the festival and not eaten.` : '';
          return (
            <div key={gd} className="grow" data-tip={partsHtml(GOOD_NAME[gd], p.goods[gd].parts, `${d >= 0 ? '+' : ''}${d} a turn`, GOOD_WHY[gd] + res + (FOOD.includes(gd) ? ' Eating is shown on the Food line.' : ''))}>
              <Icon name={gd} size={26} /><span className="gname">{GOOD_NAME[gd]}</span><b className="gnum">{v.store[gd]}</b>
              <span className={'gd ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '')}>{d ? `${d > 0 ? '+' : ''}${d}` : ''}</span>
            </div>
          );
        })}
        <div className="grow food" data-tip={partsHtml('Food each turn', [{ label: 'Grown (potatoes + quinoa)', n: p.food.make }, { label: `Eaten (${v.settlers.length} × ${EAT})`, n: -p.food.eat }, ...(p.spoil ? [{ label: 'Frost spoils potatoes', n: -p.spoil }] : [])], `${net}`, p.food.short ? `<b class="neg">Short ${p.food.short}: the village will go hungry.</b>` : 'Potatoes are eaten first.')}>
          <Icon name="potatoes" size={26} /><span className="gname">Food</span><b className="gnum">{`${p.food.net >= 0 ? '+' : ''}${net}`}</b><span className="gd">a turn</span>
        </div>
        {waste.length > 0 && <>
          <div className="grow waste" data-tip={`<div class="tt">The storehouse is full</div>It holds ${storeCap(v, 'stone')} of each good and ${storeCap(v, 'potatoes')} of each food${v.built.includes('granary') ? ' (the granary doubled the food)' : ''}. Anything over that spoils. Set a llama route to carry the surplus to a village that needs it.`}>
            <Icon name="potatoes" size={26} /><span className="gname">Wasted</span><b className="gnum neg">{waste.map(([gd, n]) => `${n} ${gd}`).join(', ')}</b><span className="gd">a turn</span>
          </div>
          <button className="wbtn teal sm" disabled={!car} data-tip={car ? 'Open the llama route editor.' : 'Build a caravan first (in the build list).'} onClick={() => { if (car) app.openRoute(car.id); }}>Carry it uphill</button>
        </>}
      </>)}
      {sec('Warmth', <>
        <div className="mrow" data-tip={partsHtml(`Warmth ${v.warmth}% → ${p.warmth.next}%`, p.warmth.parts, `${p.warmth.delta >= 0 ? '+' : ''}${p.warmth.delta} a turn`, 'Below 30: no growth and unhappy. At 0: freezing, work is halved. Hearth keepers, a kiln and a bath keep it up.')}>
          <Icon name="warmth" size={34} /><div className="meter warm"><i style={{ width: `${v.warmth}%` }} /></div><b className="mval">{v.warmth}%</b>
          <span className={'gd ' + (p.warmth.delta >= 0 ? 'pos' : 'neg')}>{`${p.warmth.delta >= 0 ? '+' : ''}${p.warmth.delta}`}</span>
        </div>
        <div className="mrow" data-tip={partsHtml(`Happiness ${v.happy} (heading for ${p.happy.target})`, p.happy.parts, `${p.happy.target}`, 'Moves up to 10 a turn toward the target. 70+: +1 growth. Below 40: no growth.')}>
          <Icon name="happy" size={34} /><b className="mood">{mood}</b><span className="mval">{v.happy}</span><span className="gd">→ {p.happy.next}</span>
        </div>
        <div className="mrow" data-tip={partsHtml('Growth: a new settler when full', p.growth.parts, p.growth.blocked ? 'stalled' : `+${p.growth.n} a turn`, p.growth.blocked ? `<b class="neg">${p.growth.blocked}</b>` : 'Spare food, happiness and a granary keeper fill it.')}>
          <Icon name="pop" size={34} /><div className="meter grow"><i style={{ width: `${Math.min(100, v.growth / p.growth.need * 100)}%` }} /></div><b className="mval">{v.growth}/{p.growth.need}</b>
          <span className={'gd ' + (p.growth.n ? 'pos' : 'neg')}>{p.growth.n ? `+${p.growth.n}` : 'stalled'}</span>
        </div>
      </>)}
      {s.units.filter(x => x.kind === 'caravan' && x.q === v.q && x.r === v.r).map(u => sec(`Llama caravan · ${caravanLoad(u)}/${CARAVAN_CAP}`,
        GOODS.filter(gd => v.store[gd] || u.cargo![gd]).map(gd => (
          <div key={gd} className="crow">
            <Icon name={gd} size={22} /><span className="gname">{u.cargo![gd]}</span>
            <button className="mini" title={`Load 2 ${gd}`} onClick={() => cmd({ k: 'load', unit: u.id, good: gd, n: 2 })}>+2</button>
            <button className="mini" title={`Load all ${gd}`} onClick={() => cmd({ k: 'load', unit: u.id, good: gd, n: 99 })}>All</button>
            <button className="mini" title={`Unload all ${gd}`} onClick={() => cmd({ k: 'load', unit: u.id, good: gd, n: -99 })}>↓</button>
          </div>
        )), `car-${u.id}`))}
      {sec('Village', <button className="wbtn teal" disabled={v.settlers.length < 2} data-tip="A settler leaves the village as a unit. Walk it to Enzo to found a new village, or into another village to join it."
        onClick={() => { const r = app.act({ k: 'send', v: v.id }); app.say(r.msg); if (r.ok) app.closeModal(); }}>Send out a settler</button>)}
    </div>
  );
}

function neighbourList(v: Village): [number, number][] {
  const odd = v.r & 1;
  const d = odd ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([a, b]) => [v.q + a, v.r + b] as [number, number]).filter(([q, r]) => q >= 0 && r >= 0 && q < 18 && r < 14);
}
export function costText(k: string) {
  return Object.entries(BUILDS[k as BuildKind].cost).map(([g, n]) => `${n} ${g}`).join(', ');
}
function missing(v: Village, k: BuildKind) {
  const m = Object.entries(BUILDS[k].cost).filter(([g, n]) => v.store[g as Good] < (n as number)).map(([g, n]) => `${(n as number) - v.store[g as Good]} ${g}`);
  return m.length ? ` <b class="neg">Still short: ${m.join(', ')}.</b>` : '';
}
export function jobName(job: string) {
  const t = parseTile(job);
  if (t) return `Working the ${TERRAIN[terrainAt(t[0], t[1])].job.toLowerCase()}.`;
  return `${INDOOR[job as IndoorJob]?.name ?? job}: ${INDOOR[job as IndoorJob]?.line ?? ''}`;
}

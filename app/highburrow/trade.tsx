// The trade and friendship screen: the mountain market, Dora and Enzo on the left, the neighbour on the right, and a
// woven panel with offers, the friendship hearts, the skill they teach and their favour. Also the llama route editor
// (A → B, carry these goods, every turn).
import { useEffect, useState } from 'react';
import { NEIGHBOURS, hearts, HEART_NAME, GOOD_NAME, GOODS, CARAVAN_CAP, caravanLoad, Game, type Good, type Cmd } from '@/lib/highburrow-game';
import { routeAdvice } from '@/lib/highburrow-advisor';
import { Sprite, Icon, partsHtml, ART } from './dom';
import type { Highburrow } from './controller';

export function TradeView({ app }: { app: Highburrow }) {
  const g = app.g, s = g.s, T = app.trade, n = T.n, d = NEIGHBOURS[n], ns = s.nb[n];
  const [, bump] = useState(0);
  const happy = Date.now() < T.happyT;
  useEffect(() => { if (!happy) return; const t = setTimeout(() => bump(x => x + 1), T.happyT - Date.now() + 100); return () => clearTimeout(t); }, [happy, T.happyT]);
  const H = Math.min(innerHeight * 0.42, innerWidth * 0.32);
  const doIt = (c: Cmd) => { const r = app.act(c); app.say(r.msg, r.ok ? 'good' : 'bad'); if (r.ok) { T.happyT = Date.now() + 1600; app.refresh(); } };
  const srcs = g.sources(n);
  const store = T.src ? g.srcStore(T.src, n) : null;
  const h = hearts(ns.fr);
  const q = d.quest;
  return (
    <div className="overlay trade">
      <div className="tscene">
        <img className="tbg" src={`${ART}bg-market.webp`} alt="" />
        <div className="theroes"><Sprite name={happy ? 'dora-wave' : 'dora-idle'} h={H} cls="dora" /><Sprite name={happy ? 'enzo-advise' : 'enzo-idle'} h={H} cls="enzo" /></div>
        <Sprite name={`nb-${n}${happy ? '-happy' : ''}`} h={H * (n === 'condors' ? 1.05 : n === 'viscachas' ? 0.85 : 1.3)} cls="tnb" />
        {happy && <div className="tsparks">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
        <div className="tbubble"><b>{d.who}:</b> {ns.met ? (ns.quest === 'done' ? 'Always good to see you, friends.' : d.greet) : 'Who are you, little ones?'}</div>
      </div>
      <button className="xbtn" title="Close (Esc)" onClick={() => app.closeModal()}>×</button>
      <div className="tpanel woven">
        <div className="ttitle">{d.name}</div>
        <div className="tcols">
          <div className="tcol offers">
            {!ns.met ? <p className="muted">Walk Dora next to their camp and press <b>Befriend</b> to meet them.</p>
              : !srcs.length ? <p className="muted">To trade, found a village within 3 tiles of their camp, or bring a llama caravan right next to it. At 3 hearts they come to any of your villages.</p>
                : <>
                  <div className="srcs">
                    {srcs.map((sc, i) => (
                      <button key={i} className={'srcb' + (JSON.stringify(sc) === JSON.stringify(T.src) ? ' on' : '')} data-tip="Goods come from and go to this storehouse." onClick={() => { T.src = sc; app.refresh(); }}>
                        {'village' in sc ? g.village(sc.village)!.name : `Caravan (${caravanLoad(g.unit(sc.caravan)!)}/${CARAVAN_CAP})`}
                      </button>
                    ))}
                  </div>
                  {d.offers.map((o, i) => {
                    const bonus = h >= 4 ? 1 : 0;
                    const used = ns.traded.includes(i), short = (store?.[o.give[0]] ?? 0) < o.give[1];
                    const full = !!T.src && 'caravan' in T.src && CARAVAN_CAP - caravanLoad(g.unit(T.src.caravan)!) + o.give[1] < o.get[1] + bonus;
                    return (
                      <div key={i} className={'offer' + (used ? ' used' : '')}>
                        <div className="og" data-tip={`You give ${o.give[1]} ${o.give[0]}. You have ${store?.[o.give[0]] ?? 0} here.`}><Icon name={o.give[0]} size={40} /><span>{GOOD_NAME[o.give[0]]} ×{o.give[1]}</span></div>
                        <div className="swap">⇄</div>
                        <div className="og" data-tip={`You get ${o.get[1] + bonus} ${o.get[0]}${bonus ? ' (+1 because you are good friends)' : ''}.`}><Icon name={o.get[0]} size={40} /><span>{GOOD_NAME[o.get[0]]} ×{o.get[1] + bonus}</span></div>
                        <button className="wbtn red sm" disabled={used || short || full} title={used ? 'Again next turn' : short ? `You need ${o.give[1]} ${o.give[0]}` : full ? 'The caravan has no room for that' : 'Trade (+6 friendship)'}
                          onClick={() => doIt({ k: 'trade', n, src: T.src!, offer: i })}>Trade</button>
                      </div>
                    );
                  })}
                </>}
          </div>
          <div className="tcol friend" data-tip={partsHtml(`Friendship ${ns.fr}/100`, [{ label: 'Dora befriends them', n: s.assist ? 15 : 12 }, { label: 'Each trade', n: 6 }, { label: 'Doing their favour', n: 30 }, { label: 'Asking them for help', n: -5 }], '', `${h < 5 ? `${ns.fr % 20}/20 toward the next heart.` : 'Best friends!'} Friends (3 hearts) teach their skill. Good friends (4) add +1 to every trade.`)}>
            <div className="chip">Friendship</div>
            <div className="hearts">{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < h ? 'h on' : 'h'}>♥</span>)}</div>
            <div className="hlabel">{HEART_NAME[h]}</div>
          </div>
          <div className="tcol skill">
            <div className="skcard">
              <Icon name={n === 'herders' ? 'loom' : n === 'condors' ? 'explore' : 'chuno'} size={46} />
              <div><b>{ns.learned ? 'Learned' : 'Learn'}: {d.skill.name}</b><br /><small>{d.skill.line}</small></div>
            </div>
            <div className="favour">
              <b>Favour:</b> {ns.quest === 'done' ? <><s>{q.text}</s> Done!</> : q.text}
              {ns.quest === 'open' && q.kind === 'deliver' && ns.met && T.src && (
                <button className="wbtn teal sm" disabled={(g.srcStore(T.src, n)?.[q.good as Good] ?? 0) < q.n} onClick={() => doIt({ k: 'deliver', n, src: T.src! })}>Give {q.n} {q.good}</button>
              )}
              {ns.quest === 'open' && q.kind === 'visit' && <small className="muted">{ns.found ? ' (Dora has it! Visit them.)' : ' (Look for a sparkle on the map.)'}</small>}
            </div>
            <div className="tbtns">
              {!ns.learned && <button className="wbtn red" disabled={h < 3 || !ns.met} title={h < 3 ? 'They teach friends (3 hearts)' : 'Learn the skill'} onClick={() => doIt({ k: 'learn', n })}>Learn</button>}
              <button className="wbtn teal" onClick={() => app.closeModal()}>Later</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteView({ app }: { app: Highburrow }) {
  const g = app.g, s = g.s, R = app.route, u = g.unit(R.unit);
  if (!u) return null;
  const cmd = (): Cmd => ({ k: 'route', unit: R.unit, a: R.a ?? -1, b: R.b ?? -1, carry: [...R.carry] });
  const A = s.villages.find(v => v.id === R.a);
  const ad = routeAdvice(g);
  const r = Game.load(g.save())!.apply(cmd());
  const pick = (label: string, which: 'a' | 'b') => (
    <div className={'rrow ' + which}>
      <div className="rlab">{label}</div>
      <div className="rchips">
        {s.villages.map(v => (
          <button key={v.id} className={'rchip' + (R[which] === v.id ? ' on' : '')} data-tip={`<div class="tt">${v.name}</div>${v.settlers.length} settlers`}
            onClick={() => { R[which] = v.id; if (which === 'a' && R.b === v.id) R.b = null; if (which === 'b' && R.a === v.id) R.a = null; app.refresh(); }}>
            <Sprite name={v.settlers.length >= 7 ? 'village-3' : v.settlers.length >= 4 ? 'village-2' : 'village-1'} h={34} /><span>{v.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="overlay routev">
      <div className="rpanel woven">
        <button className="xbtn" title="Close (Esc)" onClick={() => app.closeModal()}>×</button>
        <div className="ttitle">Llama route</div>
        <p className="rhint">Set it once: the caravan loads at the first village, walks to the second, unloads, and comes back, every turn.</p>
        {pick('From', 'a')}{pick('To', 'b')}
        <div className="rrow">
          <div className="rlab">Carry</div>
          <div className="rchips">
            {GOODS.map(gd => (
              <button key={gd} className={'rgood' + (R.carry.has(gd) ? ' on' : '')} data-tip={`<div class="tt">${GOOD_NAME[gd]}</div>${R.carry.has(gd) ? 'Carried on this route. Tap to drop it.' : 'Tap to carry it.'} The caravan holds 12 in all; it always leaves 4 food per settler behind.`}
                onClick={() => { if (R.carry.has(gd)) R.carry.delete(gd); else R.carry.add(gd); app.refresh(); }}>
                <Icon name={gd} size={30} /><span>{GOOD_NAME[gd]}{A ? ` ${A.store[gd]}` : ''}</span>
              </button>
            ))}
          </div>
        </div>
        {ad && ad.cmd.k === 'route' && (
          <div className="rtip">
            <Sprite name="enzo-face" h={40} /><span><b>Enzo:</b> {ad.text}</span>
            <button className="wbtn teal sm" onClick={() => { const c = ad.cmd as Extract<Cmd, { k: 'route' }>; R.unit = c.unit; R.a = c.a; R.b = c.b; R.carry = new Set(c.carry); app.refresh(); }}>Use this</button>
          </div>
        )}
        <div className="tbtns">
          <button className="wbtn red" disabled={!r.ok} data-tip={r.ok ? 'The llamas set off now and keep going every turn.' : `<span class="neg">${r.msg}</span>`}
            onClick={() => { const res = app.act(cmd()); if (res.ok) { app.say(res.msg, 'good'); app.closeModal(); } }}>{u.route ? 'Save route' : 'Start route'}</button>
          {u.route && <button className="wbtn teal" onClick={() => { app.act({ k: 'unroute', unit: u.id }); app.closeModal(); }}>Stop route</button>}
          {!r.ok && <div className="rwhy neg">{r.msg}</div>}
        </div>
      </div>
    </div>
  );
}

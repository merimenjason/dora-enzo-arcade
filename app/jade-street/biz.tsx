'use client';
// Jade Street businesses UI: the stall panel (buy a stake, upgrade, empty the till, with the painted stall at its
// current level and what tonight's takings depend on), the Businesses page in the pause menu (every stall, its level,
// nightly rate, till and the last nights' takings as a little bar chart, and the quarter's total), and the "collect
// the takings" row in a safe house. The rules are in lib/jade-biz.ts.
import { useState } from 'react';
import { BIZ, BIZ_OF, bizRate, canBuy, upgradeCost, owned, tillTotal, bizSprite, nightEvent, type BizId } from '@/lib/jade-biz';
import { DISTRICT_NAME } from '@/lib/jade-city';
import { PEOPLE } from '@/lib/jade-story';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Sprite, Btn, fmt, Icon } from './ui';

const dName = (d: string) => DISTRICT_NAME[d as keyof typeof DISTRICT_NAME].replace(/^the /, 'The ');
function Bars({ hist, testid }: { hist: number[]; testid?: string }) {
  const max = Math.max(1, ...hist);
  return (
    <div className="jade-bars" data-testid={testid} aria-label={hist.length ? `Last ${hist.length} nights: ${hist.join(', ')} coins` : 'No takings yet'}>
      {hist.length ? hist.map((v, i) => <span key={i} style={{ height: `${Math.max(6, Math.round(v / max * 100))}%` }} title={`${v} coins`} />) : <em>No nights yet</em>}
    </div>
  );
}

export function BizPanel({ play, id, snd, onClose, onSave }: { play: Play; id: BizId; snd: JadeSound | null; onClose: () => void; onSave: () => void }) {
  const w = play.w, s = w.s, b = BIZ_OF[id], st = s.biz[id]; const [msg, setMsg] = useState(''); const [, force] = useState(0);
  const done = (r: string | null, ok: string) => { if (r) { setMsg(r); snd?.bad(); } else { setMsg(ok); onSave(); } force(x => x + 1); play.bump(); };
  const open = [...w.open]; const rate = bizRate(s, id, open, { daily: w.event, festival: w.festival });
  const why = canBuy(s, id, open); const up = upgradeCost(id, st.lvl);
  return (
    <div className="jade-modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jade-panel biz" role="dialog" aria-label={b.name} data-testid="biz">
        <div className="jade-panel-head"><h2>{b.name}</h2><button type="button" className="jade-x" aria-label="Close" data-testid="close" onClick={onClose}>×</button></div>
        <div className="jade-panel-body">
          <div className="jade-biz-top">
            <Sprite name={bizSprite(id, st.lvl)} h={130} w={150} />
            <div>
              <p><b>{PEOPLE[b.keeper]?.name}</b> runs it in {dName(b.d)}.{b.good ? '' : ' A claw machine, not a trading good.'}</p>
              {st.lvl ? <p data-testid="biz-level">Your stake: level {st.lvl} of 3 · about <b>{rate.rate}</b> coins a night</p> : <p data-testid="biz-level">Stake for sale: {fmt(b.price)} coins. Earns {b.income[1]} coins a night at first, up to {b.income[3]} fully upgraded.</p>}
              {st.lvl > 0 && <p className="small" data-testid="biz-why">Tonight: {rate.parts.join(' · ')}</p>}
            </div>
          </div>
          {msg && <p className="jade-msg" data-testid="biz-msg">{msg}</p>}
          {st.lvl > 0 && <div className="jade-biz-till"><Icon name="ui-coin" size={22} /> <b data-testid="biz-till">{Math.floor(st.bank)}</b> coins in the till <Bars hist={st.hist} testid="biz-hist" /></div>}
          <div className="jade-card-btns">
            {!st.lvl && <Btn kind="gold" testid="biz-buy" disabled={!!why} onClick={() => done(w.buyBiz(id), `The ${b.name} is part yours! Takings start tonight.`)}>{why ?? `Buy a stake for ${fmt(b.price)} coins`}</Btn>}
            {st.lvl > 0 && st.lvl < 3 && <Btn kind="jade" testid="biz-up" disabled={s.cash < up} onClick={() => done(w.upgradeBiz(id), `Upgraded! The ${b.name} looks grander and takes more.`)}>Upgrade to level {st.lvl + 1} for {fmt(up)} coins</Btn>}
            {st.lvl > 0 && <Btn kind="gold" testid="biz-collect" disabled={st.bank < 1} onClick={() => { const n = w.collectBiz(id); done(null, `You pocket ${n} coins.`); }}>Collect the takings</Btn>}
          </div>
          <p className="small">The till holds about three nights of takings. Magpies sometimes raid a full till: you’ll get a text. Collect here or at any safe house.</p>
        </div>
      </div>
    </div>
  );
}

/** the Businesses page in the pause menu */
export function BizPage({ play }: { play: Play }) {
  const w = play.w, s = w.s, open = [...w.open]; const mine = owned(s);
  const ev = nightEvent(s.seed, s.night, open);
  const total = mine.reduce((a, b) => a + bizRate(s, b.id, open, { daily: w.event, festival: w.festival }).rate, 0);
  return (
    <div className="jade-bizpage" data-testid="biz-page">
      <p>{mine.length ? <>You own {mine.length} of {BIZ.length}. Tonight they should take about <b>{total}</b> coins; <b>{tillTotal(s)}</b> are waiting in the tills.</> : <>Buy a stake in a stall and it earns coins every night. Visit one to see the price.</>}</p>
      <p className="small">{ev.text}.</p>
      <div className="jade-bizlist">
        {BIZ.map(b => {
          const st = s.biz[b.id], r = bizRate(s, b.id, open, { daily: w.event, festival: w.festival }).rate;
          return (
            <div key={b.id} className={'jade-bizrow' + (st.lvl ? ' mine' : '')} data-testid={`biz-row-${b.id}`}>
              <Sprite name={bizSprite(b.id, st.lvl)} h={56} w={64} />
              <div><b>{b.name}</b><small>{dName(b.d)} · {st.lvl ? `level ${st.lvl} · ${r}/night · till ${Math.floor(st.bank)}` : `for sale: ${fmt(b.price)} (needs ${b.need} rep)`}{st.raids ? ` · raids ${st.defended}/${st.raids} chased off` : ''}</small></div>
              {st.lvl > 0 && <Bars hist={st.hist} />}
            </div>
          );
        })}
      </div>
      <div className="jade-biz-total"><b>The quarter, last nights</b><Bars hist={s.bizLog} testid="biz-log" /><small>Collected so far: {fmt(s.stats.bizCoins)} coins</small></div>
    </div>
  );
}

/** a safe house can empty every till at once */
export function CollectAll({ play, onDone }: { play: Play; onDone: (msg: string) => void }) {
  const s = play.w.s; if (!owned(s).length) return null; const n = tillTotal(s);
  return <Btn kind="gold" testid="safe-collect" disabled={n < 1} onClick={() => { const k = play.w.collectBiz(); onDone(`You collect ${k} coins from your businesses.`); }}>Collect business takings ({n})</Btn>;
}

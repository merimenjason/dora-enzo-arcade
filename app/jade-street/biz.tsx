'use client';
// Jade Street businesses UI: the stall panel (buy a stake, upgrade, empty the till, with the painted stall at its
// current level and what tonight's takings depend on, with the empire row from ./empire.tsx), and the "collect the
// takings" row in a safe house. The Empire page (every property) is in ./empire.tsx. The rules are in lib/jade-biz.ts.
import { useState } from 'react';
import { BIZ_OF, bizRate, canBuy, upgradeCost, owned, tillTotal, bizSprite, type BizId } from '@/lib/jade-biz';
import { DISTRICT_NAME } from '@/lib/jade-city';
import { PEOPLE } from '@/lib/jade-story';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Sprite, Btn, fmt, Icon } from './ui';
import { EmpireActions } from './empire';

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
              <p><b>{PEOPLE[b.keeper]?.name}</b> runs it in {dName(b.d)}.{b.id === 'claw' ? ' A claw machine, not a trading good.' : ''}</p>
              {st.lvl ? <p data-testid="biz-level">Your stake: level {st.lvl} of 3 · about <b>{rate.rate}</b> coins a night</p> : <p data-testid="biz-level">Stake for sale: {fmt(b.price)} coins. Earns {b.income[1]} coins a night at first, up to {b.income[3]} fully upgraded.</p>}
              {st.lvl > 0 && <p className="small" data-testid="biz-why">Tonight: {rate.parts.join(' · ')}</p>}
            </div>
          </div>
          {msg && <p className="jade-msg" data-testid="biz-msg">{msg}</p>}
          {st.lvl > 0 && <div className="jade-biz-till"><Icon name="ui-coin" size={22} /> <b data-testid="biz-till">{Math.floor(st.bank)}</b> coins in the till <Bars hist={st.hist} testid="biz-hist" /></div>}
          <div className="jade-card-btns">
            {!st.lvl && <Btn kind="gold" testid="biz-buy" disabled={!!why} onClick={() => done(w.buyBiz(id), `The ${b.name} is part yours! Takings start tonight.`)}>{why ?? `Buy it for ${fmt(b.price)} coins`}</Btn>}
            {st.lvl > 0 && st.lvl < 3 && <Btn kind="jade" testid="biz-up" disabled={s.cash < up} onClick={() => done(w.upgradeBiz(id), `Upgraded! The ${b.name} looks grander and takes more.`)}>Upgrade to level {st.lvl + 1} for {fmt(up)} coins</Btn>}
            {st.lvl > 0 && <Btn kind="gold" testid="biz-collect" disabled={st.bank < 1} onClick={() => { const n = w.collectBiz(id); done(null, `You pocket ${n} coins.`); }}>Collect the takings</Btn>}
          </div>
          <EmpireActions play={play} id={id} snd={snd} onClose={onClose} onSave={onSave} />
          <p className="small">The till holds about three nights of takings. Gangs sometimes raid a full till: you’ll get a text, a red pin and a clock. Collect here, at any safe house, or send your partner round (Empire tab).</p>
        </div>
      </div>
    </div>
  );
}

/** a safe house can empty every till at once */
export function CollectAll({ play, onDone }: { play: Play; onDone: (msg: string) => void }) {
  const s = play.w.s; if (!owned(s).length) return null; const n = tillTotal(s);
  return <Btn kind="gold" testid="safe-collect" disabled={n < 1} onClick={() => { const k = play.w.collectBiz(); onDone(`You collect ${k} coins from your businesses.`); }}>Collect business takings ({n})</Btn>;
}

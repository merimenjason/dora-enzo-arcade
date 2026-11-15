'use client';
// Jade Street, the eleventh pass: the phone's Contracts tab. Three offers made by lib/jade-proc.ts (an easy one, a
// middling one, a hard one), the contract of the day (the same for everyone, with today's best time) and, when the
// rivals are muscling in on one of your districts, the retake. Each card has the giver, the stars, the modifiers, the
// pay and a Route me button; the contract itself starts in person, at the giver. Rules in lib/jade-contracts.ts.
import { useState } from 'react';
import { listContracts, routeContract, contractsOpen, tierOf, territory, dayRecord, dayPaid, contestFactor, type Listed } from '@/lib/jade-contracts';
import { MOD_NAME, MOD_TEXT, KIND_NAME, GANG } from '@/lib/jade-proc';
import { DISTRICT_NAME } from '@/lib/jade-city';
import { PEOPLE } from '@/lib/jade-story';
import type { Play } from './controller';
import { Sprite, Btn, fmt } from './ui';
import './contracts.css';

const secs = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const dName = (d: string) => DISTRICT_NAME[d as keyof typeof DISTRICT_NAME].replace(/^the /, 'The ');

function Card({ play, l, onClose }: { play: Play; l: Listed; onClose?: () => void }) {
  const w = play.w, c = l.c, p = PEOPLE[c.giver], [msg, setMsg] = useState('');
  const pinned = w.s.contracts.pin === l.which, rec = l.tag === 'day' ? dayRecord(w) : null;
  const pay = l.tag === 'day' && dayPaid(w) ? Math.round(c.pay / 4) : c.pay;
  return (
    <li className={`jade-con ${l.tag}${pinned ? ' pinned' : ''}`} data-testid={`con-${l.which}`}>
      <Sprite name={p?.face ?? 'face-kee'} h={52} w={52} title={p?.name ?? c.giver} />
      <div className="jade-con-body">
        {l.tag === 'day' && <span className="jade-con-tag day">Contract of the day</span>}
        {l.tag === 'push' && <span className="jade-con-tag push">Retake · {GANG[c.gang].name}</span>}
        <b>{c.title}</b>
        <small>{p?.name ?? c.giver} · {dName(c.d)} · {KIND_NAME[c.kind]} · <span className="jade-con-stars" aria-label={`${c.stars} of 3 stars`}>{'★'.repeat(c.stars)}<i>{'★'.repeat(3 - c.stars)}</i></span></small>
        <p>{c.blurb}</p>
        {!!c.mods.length && <span className="jade-con-mods">{c.mods.map(m => <em key={m} title={MOD_TEXT[m]} data-testid={`con-mod-${m}`}>{MOD_NAME[m]}</em>)}</span>}
        <small className="jade-con-pay"><Sprite name="ui-coin" h={16} w={16} /> {fmt(pay)} coins{l.tag === 'day' && dayPaid(w) ? ' (paid today: replays pay a quarter)' : ''}{rec?.best ? ` · today’s best ${secs(rec.best)} (${rec.runs} run${rec.runs === 1 ? '' : 's'})` : ''}</small>
        {msg && <small className="jade-msg">{msg}</small>}
      </div>
      <Btn kind={pinned ? 'gold' : l.tag === 'push' ? 'red' : 'jade'} testid={`con-route-${l.which}`} disabled={!!w.run} onClick={() => { const why = routeContract(w, l.which); if (why) setMsg(why); else { play.bump(); onClose?.(); } }}>{pinned ? 'Routed' : 'Route me'}</Btn>
    </li>
  );
}

export function ContractsTab({ play, onClose }: { play: Play; onClose?: () => void }) {
  const w = play.w, s = w.s;
  if (!contractsOpen(s)) return <p data-testid="con-locked">Contracts open once the Phoenix Drum is home (the end of chapter six). After that, your contacts send you jobs of their own, every night, for good.</p>;
  const ls = listContracts(w), cs = s.contracts, ct = cs.contest;
  return (
    <div className="jade-cons" data-testid="con-tab">
      <p className="small">Three jobs from your contacts, dealt fresh every night, and a new one as soon as you finish one. Walk up to the giver to start. Tier {tierOf(s)} of 6 (your rank, your {territory(s)} district{territory(s) === 1 ? '' : 's'} and {cs.done} contract{cs.done === 1 ? '' : 's'} done): higher tiers pay more and bite harder.</p>
      {ct && <p className="jade-con-warn" data-testid="con-contest">The {GANG[ct.gang].name} are muscling in on {DISTRICT_NAME[ct.d]}: its tills take ×{contestFactor(s, ct.d)} until you win the retake.</p>}
      <ol className="jade-con-list">{ls.map(l => <Card key={l.which + l.c.id} play={play} l={l} onClose={onClose} />)}</ol>
    </div>
  );
}

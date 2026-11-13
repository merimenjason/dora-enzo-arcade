'use client';
// Cloudpop: the progression screens. Burrow Lore (the acorn tree, four branches of eleven), the Tower Lab (spend a
// tower's XP to unlock tiers 4 and 5 path by path), medals and trophies, and the daily challenge.
import { useState } from 'react';
import { TOWERS } from '@/lib/cloudpop-towerdata';
import { MAPS } from '@/lib/cloudpop-maps';
import { DIFFS, DIFF_NAME, MODES, MODE_INFO } from '@/lib/cloudpop-game';
import { HEROES } from '@/lib/cloudpop-heroes';
import {
  LORE, BRANCHES, loreReason, TIER_XP, tierCaps, labReason, towerUnlocked, TROPHIES, medalKey, daily, dayKey, type Save,
} from '@/lib/cloudpop-meta';
import type { TowerId } from '@/lib/cloudpop-towers';
import { Header, type Screen } from './menus';
import { Sprite, Icon, Btn, fmt, ART } from './ui';

const BRANCH_COL: Record<string, string> = { crew: '#2a9d9a', wonders: '#d4566a', hearth: '#e3a52e', legend: '#5f9e3c' };

export function Lore({ s, buy, go }: { s: Save; buy: (id: string) => void; go: (sc: Screen) => void }) {
  const [pick, setPick] = useState<string>('c1');
  const n = LORE.find(x => x.id === pick)!;
  const why = loreReason(s, pick);
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-library.webp)` }}>
      <Header s={s} title="Burrow Lore" onBack={() => go('title')} />
      <div className="lore">
        <div className="branches">
          {BRANCHES.map(b => (
            <div key={b.id} className="branch" style={{ ['--bc' as string]: BRANCH_COL[b.id] }}>
              <h3>{b.name}</h3><small>{b.desc}</small>
              <div className="tree">
                {[0, 1, 2, 3, 4, 5].map(row => (
                  <div className="trow" key={row}>
                    {LORE.filter(x => x.branch === b.id && x.row === row).map(x => {
                      const got = s.lore.includes(x.id), can = !loreReason(s, x.id);
                      return <button key={x.id} className={'node' + (got ? ' got' : can ? ' can' : '') + (pick === x.id ? ' on' : '')} data-testid={'lore-' + x.id} title={`${x.name} (${x.cost} acorns): ${x.desc}`} onClick={() => setPick(x.id)}>
                        <Sprite name={'lore-' + x.icon} h={40} w={40} />
                      </button>;
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="panel lorepick">
          <Sprite name={'lore-' + n.icon} h={64} w={64} />
          <h2>{n.name}</h2>
          <p>{n.desc}</p>
          <p className="muted"><Icon name="acorn" size={18} /> {n.cost} acorns{n.req.length ? ` · needs ${n.req.map(r => LORE.find(x => x.id === r)!.name).join(' or ')}` : ''}</p>
          {s.lore.includes(n.id) ? <p className="pos"><Icon name="ok" size={18} /> Learned</p> : <Btn kind="gold" testid="lore-buy" disabled={!!why} title={why} onClick={() => buy(n.id)}>Learn for {n.cost}</Btn>}
          {why && !s.lore.includes(n.id) && <small className="muted">{why}</small>}
          <p className="muted small">{s.lore.length} of {LORE.length} learned · win runs, earn medals and trophies and play the daily for acorns.</p>
        </div>
      </div>
    </div>
  );
}

export function Lab({ s, unlock, go }: { s: Save; unlock: (id: TowerId, path: number) => void; go: (sc: Screen) => void }) {
  const [pick, setPick] = useState<TowerId>('pebble');
  const t = TOWERS.find(x => x.id === pick)!;
  const caps = tierCaps(s, pick), xp = s.towerXp[pick] ?? 0;
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-library.webp)` }}>
      <Header s={s} title="Tower Lab" onBack={() => go('title')} />
      <div className="lab">
        <div className="labtowers">
          {TOWERS.map(x => <button key={x.id} className={'kind' + (x.id === pick ? ' on' : '') + (towerUnlocked(s, x.id) ? '' : ' locked')} data-testid={'lab-' + x.id} title={x.name} onClick={() => setPick(x.id)}>
            <Sprite name={`ic-${x.id}-portrait`} h={46} w={46} /><small>{fmt(s.towerXp[x.id] ?? 0)}</small>
          </button>)}
        </div>
        <div className="panel labpanel">
          <div className="row"><Sprite name={`${t.id === 'condor' ? 'condor-roost' : t.id + '-base-0'}`} h={110} /><div><h2>{t.name}</h2><p>{t.blurb}</p>
            <p className="muted"><Icon name="star" size={16} /> {fmt(xp)} {t.name} XP to spend · earned by this tower's pops{towerUnlocked(s, t.id) ? '' : ` · unlocks at player level ${t.level}`}</p></div></div>
          {t.paths.map((path, pi) => (
            <div className="labpath" key={pi}>
              <b>{t.pathNames[pi]}</b>
              <div className="slots">{path.map((u, i) => <span key={i} className={'slot' + (i < caps[pi] ? ' got' : '')} title={`Tier ${i + 1}: ${u.name}. ${u.desc}`}><Sprite name={`ic-${t.id}-${pi * 5 + i}`} h={34} w={34} />{i >= caps[pi] && <Icon name="lock" size={14} cls="lk" />}</span>)}</div>
              {caps[pi] < 5 ? <Btn kind="gold" testid={`lab-unlock-${pi}`} disabled={!!labReason(s, t.id, pi)} title={labReason(s, t.id, pi) || ''} onClick={() => unlock(t.id, pi)}>Unlock tier {caps[pi] + 1} · {fmt(TIER_XP[caps[pi] + 1])} XP</Btn> : <span className="pos">All open</span>}
            </div>
          ))}
          <p className="muted small">Tiers 1 to 3 are always open. Tier 4 costs {fmt(TIER_XP[4])} XP and tier 5 {fmt(TIER_XP[5])}, for each path.</p>
        </div>
      </div>
    </div>
  );
}

export function Trophies({ s, go }: { s: Save; go: (sc: Screen) => void }) {
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-library.webp)` }}>
      <Header s={s} title="Medals & trophies" onBack={() => go('title')} />
      <div className="trophies">
        <div className="panel">
          <h3>Medals ({s.medals.length})</h3>
          <table className="medtab"><thead><tr><th />{DIFFS.map(d => <th key={d}>{DIFF_NAME[d]}</th>)}</tr></thead>
            <tbody>{MAPS.map(m => <tr key={m.id}><td>{m.name}</td>{DIFFS.map(d => <td key={d}>{MODES[d].map(mo => <span key={mo} className={'md' + (s.medals.includes(medalKey(m.id, d, mo)) ? ' got' : '')} title={`${DIFF_NAME[d]} · ${MODE_INFO[mo].name}`}><Sprite name={mo === 'standard' ? (d === 'easy' ? 'm-bronze' : d === 'medium' ? 'm-silver' : 'm-gold') : 'm-' + mo} h={20} w={20} /></span>)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Trophies ({s.trophies.length}/{TROPHIES.length})</h3>
          <div className="trgrid">{TROPHIES.map(t => <div key={t.id} className={'tr' + (s.trophies.includes(t.id) ? ' got' : '')} data-testid={'trophy-' + t.id} title={t.desc}><Sprite name={'tr-' + (t.icon % 8)} h={40} w={40} /><b>{t.name}</b><small>{t.desc}</small></div>)}</div>
        </div>
      </div>
    </div>
  );
}

export function Daily({ s, play, go }: { s: Save; play: () => void; go: (sc: Screen) => void }) {
  const key = dayKey(new Date()), d = daily(key), done = s.daily.done.includes(key);
  const m = MAPS.find(x => x.id === d.map)!;
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-mapselect.webp)` }}>
      <Header s={s} title="Daily challenge" onBack={() => go('title')} />
      <div className="panel daily">
        <img src={`${ART}map-${d.map}.webp`} alt="" />
        <div>
          <h2>{d.title}</h2>
          <p className="muted">{key} · same challenge for everyone today</p>
          <ul>
            <li><b>{m.name}</b>, {DIFF_NAME[d.diff]}</li>
            <li>Rounds {d.startRound} to {d.lastRound}, starting with ${fmt(d.startCash)}</li>
            <li>Hero: {HEROES[d.hero].name}</li>
            <li className="dtowers">Only: {d.towers.map(t => <Sprite key={t} name={`ic-${t}-portrait`} h={30} w={30} title={TOWERS.find(x => x.id === t)!.name} />)}</li>
          </ul>
          <p>{done ? <span className="pos"><Icon name="ok" size={18} /> Done today. Come back tomorrow!</span> : <>Win for <Icon name="acorn" size={16} /> 12 acorns.</>} Streak: {s.daily.streak} day{s.daily.streak === 1 ? '' : 's'}.</p>
          <Btn kind="gold" cls="big" testid="daily-play" onClick={play}><Icon name="play" size={22} /> {done ? 'Play again' : 'Play'}</Btn>
        </div>
      </div>
    </div>
  );
}

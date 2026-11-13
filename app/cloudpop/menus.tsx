'use client';
// Cloudpop: the screens around a run. Title, map select (four tiers, medals per difficulty and mode), run setup
// (difficulty, mode, Single Kind tower, hero and look, assist), heroes, settings, and the end-of-run card.
import { useState } from 'react';
import { MAPS, TIERS, type Tier } from '@/lib/cloudpop-maps';
import { TOWERS, TOWER } from '@/lib/cloudpop-towerdata';
import { HEROES, HERO_IDS, type HeroId } from '@/lib/cloudpop-heroes';
import { DIFFS, DIFF_NAME, MODES, MODE_INFO, LAST_ROUND, START_LIVES, type Diff, type Mode } from '@/lib/cloudpop-game';
import { playerLevel, levelXp, mapUnlocked, towerUnlocked, medalKey, TROPHY_BY_ID, LORE, type Save, type RunReward, type RunSummary } from '@/lib/cloudpop-meta';
import type { TowerId } from '@/lib/cloudpop-towers';
import { Sprite, Icon, Btn, fmt, ART } from './ui';

export type Screen = 'title' | 'maps' | 'setup' | 'play' | 'lore' | 'lab' | 'trophies' | 'heroes' | 'daily' | 'settings';

export function Header({ s, title, onBack }: { s: Save; title: string; onBack: () => void }) {
  const lvl = playerLevel(s.xp), a = levelXp(lvl), b = levelXp(lvl + 1);
  return (
    <div className="cp-head">
      <button className="ibtn" data-testid="back" title="Back" onClick={onBack}><Icon name="back" size={28} /></button>
      <h1>{title}</h1>
      <span className="grow" />
      <span className="stat" title={`Player level ${lvl}: ${fmt(s.xp - a)} / ${fmt(b - a)} XP to the next`}><Icon name="star" /> <b>Lv {lvl}</b><span className="mini-xp"><span style={{ width: `${Math.round((s.xp - a) / (b - a) * 100)}%` }} /></span></span>
      <span className="stat" title="Acorns: spend them on Burrow Lore"><Icon name="acorn" /> <b data-testid="acorns">{fmt(s.acorns)}</b></span>
    </div>
  );
}

export function Title({ s, go }: { s: Save; go: (sc: Screen) => void }) {
  const lvl = playerLevel(s.xp);
  return (
    <div className="cp-screen cp-title" style={{ backgroundImage: `url(${ART}bg-title.webp)` }}>
      <div className="logo"><h1>Cloudpop</h1><p>Storm-puffs are drifting down the valley to rain out the harvest festival. Dora, Enzo and the crew have other ideas.</p></div>
      <div className="tmenu">
        <Btn kind="gold" cls="big" testid="play" onClick={() => go('maps')}><Icon name="play" size={26} /> Play</Btn>
        <Btn testid="daily" onClick={() => go('daily')}><Icon name="daily" size={22} /> Daily challenge</Btn>
        <Btn testid="lore" onClick={() => go('lore')}><Icon name="tree" size={22} /> Burrow Lore {s.acorns > 0 && <em className="badge">{s.acorns}</em>}</Btn>
        <Btn testid="lab" onClick={() => go('lab')}><Icon name="lab" size={22} /> Tower Lab</Btn>
        <Btn testid="heroes" onClick={() => go('heroes')}><Icon name="hero" size={22} /> Heroes</Btn>
        <Btn testid="trophies" onClick={() => go('trophies')}><Icon name="trophy" size={22} /> Medals &amp; trophies</Btn>
        <Btn kind="plain" testid="settings" onClick={() => go('settings')}><Icon name="gear" size={22} /> Settings</Btn>
      </div>
      <div className="tfoot"><span><Icon name="star" /> Level {lvl}</span><span><Icon name="acorn" /> {fmt(s.acorns)}</span><span><Icon name="medal" /> {s.medals.length} medals</span><span><Icon name="trophy" /> {s.trophies.length} trophies</span></div>
    </div>
  );
}

export function Maps({ s, onPick, go }: { s: Save; onPick: (map: string) => void; go: (sc: Screen) => void }) {
  const [tier, setTier] = useState<Tier>('beginner');
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-mapselect.webp)` }}>
      <Header s={s} title="Choose a valley" onBack={() => go('title')} />
      <div className="tabs">{TIERS.map(t => <button key={t} className={'tab' + (t === tier ? ' on' : '')} data-testid={'tier-' + t} onClick={() => setTier(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
      <div className="mapgrid">
        {MAPS.filter(m => m.tier === tier).map(m => {
          const open = mapUnlocked(s, m.id);
          return (
            <button key={m.id} className={'mapcard' + (open ? '' : ' locked')} data-testid={'map-' + m.id} disabled={!open} onClick={() => onPick(m.id)}>
              <img src={`${ART}map-${m.id}.webp`} alt="" loading="lazy" />
              <b>{m.name}</b>
              <small>{open ? m.blurb : `Reach level ${m.level}, or win on ${MAPS[MAPS.indexOf(m) - 1]?.name}`}</small>
              <span className="medals">
                {DIFFS.map(d => <span key={d} className={'md' + (s.medals.includes(medalKey(m.id, d, 'standard')) ? ' got' : '')} title={`${DIFF_NAME[d]} standard`}><Sprite name={d === 'easy' ? 'm-bronze' : d === 'medium' ? 'm-silver' : 'm-gold'} h={22} w={22} /></span>)}
                {(['reverse', 'onekind', 'lean', 'nightfall', 'endless'] as Mode[]).map(mo => s.medals.some(k => k.startsWith(m.id + ':') && k.endsWith(':' + mo)) && <span key={mo} className="md got" title={MODE_INFO[mo].name}><Sprite name={'m-' + mo} h={20} w={20} /></span>)}
              </span>
              {s.stats.best[m.id] ? <small className="best">Best round {s.stats.best[m.id]}</small> : null}
              {!open && <span className="lock"><Icon name="lock" size={32} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Setup({ s, map, onStart, onBack, setSave }: { s: Save; map: string; onStart: (diff: Diff, mode: Mode, kind?: TowerId) => void; onBack: () => void; setSave: (f: (s: Save) => void) => void }) {
  const m = MAPS.find(x => x.id === map)!;
  const [diff, setDiff] = useState<Diff>('easy');
  const [mode, setMode] = useState<Mode>('standard');
  const [kind, setKind] = useState<TowerId>('pebble');
  const modes = MODES[diff];
  const md = modes.includes(mode) ? mode : 'standard';
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-mapselect.webp)` }}>
      <Header s={s} title={m.name} onBack={onBack} />
      <div className="setup">
        <div className="panel">
          <h3>Difficulty</h3>
          <div className="row">{DIFFS.map(d => <button key={d} className={'opt' + (d === diff ? ' on' : '')} data-testid={'diff-' + d} onClick={() => setDiff(d)}><b>{DIFF_NAME[d]}</b><small>{LAST_ROUND[d]} rounds · {START_LIVES[d]} lives</small>{s.medals.includes(medalKey(map, d, 'standard')) && <Sprite name={d === 'easy' ? 'm-bronze' : d === 'medium' ? 'm-silver' : 'm-gold'} h={20} w={20} />}</button>)}</div>
          <h3>Mode</h3>
          <div className="row wrap">{modes.map(mo => <button key={mo} className={'opt' + (mo === md ? ' on' : '')} data-testid={'mode-' + mo} title={MODE_INFO[mo].desc} onClick={() => setMode(mo)}><b>{MODE_INFO[mo].name}</b><small>{MODE_INFO[mo].desc}</small>{s.medals.includes(medalKey(map, diff, mo)) && <Icon name="ok" size={16} />}</button>)}</div>
          {md === 'onekind' && <>
            <h3>The one kind</h3>
            <div className="row wrap kinds">{TOWERS.filter(t => towerUnlocked(s, t.id) && !t.income).map(t => <button key={t.id} className={'kind' + (t.id === kind ? ' on' : '')} data-testid={'kind-' + t.id} title={t.name} onClick={() => setKind(t.id)}><Sprite name={`ic-${t.id}-portrait`} h={40} w={40} /></button>)}</div>
          </>}
        </div>
        <div className="panel">
          <h3>Hero</h3>
          <div className="row">{HERO_IDS.map(h => {
            const open = s.heroes.includes(h);
            return <button key={h} className={'opt hero' + (s.hero === h ? ' on' : '')} data-testid={'hero-' + h} disabled={!open} onClick={() => setSave(x => { x.hero = h; })}>
              <Sprite name={`${h}${s.skin[h] ? '-' + s.skin[h] : ''}-face`} h={56} w={56} /><b>{HEROES[h].name}</b><small>{open ? HEROES[h].title : 'Win any run to unlock'}</small>
            </button>;
          })}</div>
          <label className="check"><input type="checkbox" data-testid="assist" checked={s.settings.assist} onChange={e => setSave(x => { x.settings.assist = e.target.checked; })} /> <b>Assist</b> <small>half again as many lives, a 20% bigger round bonus, one second chance and the next-round preview</small></label>
          <Btn kind="gold" cls="big" testid="start" onClick={() => onStart(diff, md, md === 'onekind' ? kind : undefined)}><Icon name="play" size={24} /> Start</Btn>
        </div>
      </div>
    </div>
  );
}

export function Heroes({ s, setSave, go }: { s: Save; setSave: (f: (s: Save) => void) => void; go: (sc: Screen) => void }) {
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-library.webp)` }}>
      <Header s={s} title="Heroes" onBack={() => go('title')} />
      <div className="heroes">
        {HERO_IDS.map((h: HeroId) => {
          const d = HEROES[h], open = s.heroes.includes(h), skins = [{ id: '', name: 'Festival', trophy: '' }, ...d.skins];
          const cur = s.skin[h] ?? '';
          return (
            <div key={h} className={'panel herocard' + (open ? '' : ' locked')}>
              <Sprite name={`${h}${cur ? '-' + cur : ''}-idle`} h={170} />
              <div>
                <h2>{d.name} <small>{d.title}</small></h2>
                <p>{d.blurb}</p>
                {!open && <p className="muted"><Icon name="lock" size={16} /> Win any run, or reach level 3, to unlock {d.name}.</p>}
                <ul className="lvls">{d.levels.filter(l => [3, 10, 20].includes(l.lvl)).map(l => <li key={l.lvl}><b>{l.lvl}</b> {l.text}</li>)}</ul>
                <div className="row">
                  {open && <Btn kind={s.hero === h ? 'gold' : 'teal'} testid={'choose-' + h} onClick={() => setSave(x => { x.hero = h; })}>{s.hero === h ? 'Chosen' : 'Choose'}</Btn>}
                  {skins.map(sk => {
                    const has = !sk.id || s.skins.includes(sk.id);
                    return <button key={sk.id || 'base'} className={'opt skin' + (cur === sk.id ? ' on' : '')} data-testid={`skin-${h}-${sk.id || 'base'}`} disabled={!has || !open} title={has ? sk.name : `Earn the trophy “${TROPHY_BY_ID[sk.trophy]?.name}”: ${TROPHY_BY_ID[sk.trophy]?.desc}`} onClick={() => setSave(x => { if (sk.id) x.skin[h] = sk.id; else delete x.skin[h]; })}>
                      <Sprite name={`${h}${sk.id ? '-' + sk.id : ''}-face`} h={44} w={44} /><small>{sk.name}</small>{!has && <Icon name="lock" size={14} />}
                    </button>;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Settings({ s, setSave, go, reset }: { s: Save; setSave: (f: (s: Save) => void) => void; go: (sc: Screen) => void; reset: () => void }) {
  const [sure, setSure] = useState(false);
  const row = (k: 'assist' | 'sound' | 'music' | 'auto' | 'tips', label: string, note: string) => (
    <label className="check"><input type="checkbox" data-testid={'opt-' + k} checked={s.settings[k]} onChange={e => setSave(x => { x.settings[k] = e.target.checked; })} /> <b>{label}</b> <small>{note}</small></label>
  );
  return (
    <div className="cp-screen" style={{ backgroundImage: `url(${ART}bg-library.webp)` }}>
      <Header s={s} title="Settings" onBack={() => go('title')} />
      <div className="panel narrow">
        {row('assist', 'Assist', 'On by default: more lives, a bigger round bonus, a second chance.')}
        {row('tips', 'Next-round preview', 'Shows which puffs come next.')}
        {row('auto', 'Auto-start rounds', 'Start each round as soon as the last one ends.')}
        {row('sound', 'Sound effects', '')}
        {row('music', 'Music', '')}
        <h3>Game speed at the start of a run</h3>
        <div className="row">{[1, 2, 3].map(n => <button key={n} className={'opt' + (s.settings.speed === n ? ' on' : '')} data-testid={'start-speed-' + n} onClick={() => setSave(x => { x.settings.speed = n; })}><b>{n}×</b></button>)}</div>
        <h3>Progress</h3>
        <p className="muted">{s.stats.games} runs · {s.stats.wins} wins · {fmt(s.stats.pops)} layers popped · {s.lore.length}/{LORE.length} lore</p>
        {!sure ? <Btn kind="red" testid="reset" onClick={() => setSure(true)}>Reset all progress</Btn>
          : <div className="row"><Btn kind="red" testid="reset-yes" onClick={() => { reset(); setSure(false); }}>Yes, start over</Btn><Btn kind="plain" testid="reset-no" onClick={() => setSure(false)}>Keep it</Btn></div>}
      </div>
    </div>
  );
}

export function EndCard({ won, r, reward, onFreeplay, onRetry, onMaps, onHome, canFreeplay }: { won: boolean; r: RunSummary; reward: RunReward | null; onFreeplay: () => void; onRetry: () => void; onMaps: () => void; onHome: () => void; canFreeplay: boolean }) {
  return (
    <div className="cp-modal end" data-testid="end-card" style={{ backgroundImage: `url(${ART}${won ? 'bg-win' : 'bg-lose'}.webp)` }}>
      <div className="card">
        <h2>{won ? 'The festival is saved!' : 'Rained out…'}</h2>
        <p>{won ? `All ${r.roundsWon} rounds held on ${MAPS.find(m => m.id === r.map)?.name}.` : `The storm got through on round ${r.round}. The crew will be back drier and wiser.`}</p>
        {reward && <ul className="rewards">
          <li><Icon name="star" /> +{fmt(reward.xp)} XP{reward.levelAfter > reward.levelBefore ? ` · level ${reward.levelAfter}!` : ''}</li>
          <li><Icon name="acorn" /> +{reward.acorns} acorns</li>
          {reward.medal && <li><Icon name="medal" /> New medal!</li>}
          {Object.entries(reward.towerXp).filter(([, n]) => n > 0).slice(0, 5).map(([id, n]) => <li key={id}><Sprite name={`ic-${id}-portrait`} h={20} w={20} /> {TOWER[id].name} +{fmt(n)} XP</li>)}
          {reward.newTrophies.map(t => <li key={t}><Icon name="trophy" /> {TROPHY_BY_ID[t].name}</li>)}
          {reward.unlocked.map(u => <li key={u} className="unlock"><Icon name="ok" /> Unlocked: {u.startsWith('tower:') ? TOWER[u.slice(6)].name : u.startsWith('map:') ? MAPS.find(m => m.id === u.slice(4))?.name : u.startsWith('hero:') ? 'Enzo' : u.startsWith('skin:') ? (u === 'skin:moonlit' ? 'Dora · Moonlit Fiesta' : 'Enzo · Harvest Gold') : u}</li>)}
        </ul>}
        <div className="row">
          {won && canFreeplay && <Btn kind="gold" testid="freeplay" onClick={onFreeplay}>Keep going (freeplay)</Btn>}
          <Btn testid="retry" onClick={onRetry}>Play again</Btn>
          <Btn kind="plain" testid="to-maps" onClick={onMaps}>Maps</Btn>
          <Btn kind="plain" testid="to-home" onClick={onHome}>Home</Btn>
        </div>
      </div>
    </div>
  );
}

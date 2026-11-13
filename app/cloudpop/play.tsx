'use client';
// Cloudpop: the in-run HUD. The top bar (lives, coins, round, speed, pause, auto), the shop of towers and the hero,
// the selected tower's upgrade panel (three paths of five, what the next tier changes, targeting, abilities, sell),
// the start button, quick ability buttons, the next-round preview and the pause menu.
import { TOWERS, TOWER } from '@/lib/cloudpop-towerdata';
import { TARGETS, crosspathReason, type Target, type TowerId } from '@/lib/cloudpop-towers';
import { HEROES, HERO_XP } from '@/lib/cloudpop-heroes';
import { PUFFS } from '@/lib/cloudpop-puffs';
import { preview } from '@/lib/cloudpop-rounds';
import { upgradeDiff, atkLine } from '@/lib/cloudpop-info';
import { MODE_INFO, DIFF_NAME } from '@/lib/cloudpop-game';
import { lookOf } from '@/lib/cloudpop-scene';
import type { Play } from './controller';
import { Sprite, Icon, Btn, fmt } from './ui';

const TARGET_NAME: Record<Target, string> = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };
const TARGET_ICON: Record<Target, string> = { first: 'first', last: 'last', strong: 'strong', close: 'close' };

export function TopBar({ p, onMenu }: { p: Play; onMenu: () => void }) {
  const g = p.g;
  return (
    <div className="cpop-top">
      <span className="stat" title="Lives: a puff that reaches the festival costs one life per layer it still has"><Icon name="heart" /> <b data-testid="lives">{fmt(g.lives)}</b></span>
      <span className="stat" title="Coins"><Icon name="coin" /> <b data-testid="cash">{fmt(g.cash)}</b>{g.incomePerRound() > 0 && <small> +{fmt(g.incomePerRound())}/rd</small>}</span>
      <span className="stat" title={`${DIFF_NAME[g.cfg.diff]} · ${MODE_INFO[g.cfg.mode].name}`}><Icon name="round" /> <b data-testid="round">{Math.min(g.round, g.freeplay ? g.round : g.lastRound)}</b><small>/{g.freeplay ? '∞' : g.lastRound}</small></span>
      <span className="grow" />
      <button className={'ibtn' + (p.paused ? ' on' : '')} data-testid="pause" title="Pause (P)" onClick={() => p.togglePause()}><Icon name={p.paused ? 'play' : 'pause'} size={26} /></button>
      {[1, 2, 3].map(s => <button key={s} className={'ibtn sp' + (p.speed === s ? ' on' : '')} data-testid={'speed' + s} title={`${s}× speed (click again to cycle)`} onClick={() => p.setSpeed(p.speed === s ? s % 3 + 1 : s)}>{s === 1 ? <Icon name="play" size={22} /> : <Icon name={s === 2 ? 'ff' : 'fff'} size={22} />}</button>)}
      <button className={'ibtn' + (g.auto ? ' on' : '')} data-testid="auto" title="Auto-start the next round (A)" onClick={() => p.toggleAuto()}><Icon name="auto" size={24} /></button>
      <button className="ibtn" data-testid="menu" title="Menu" onClick={onMenu}><Icon name="gear" size={24} /></button>
    </div>
  );
}

export function Shop({ p }: { p: Play }) {
  const g = p.g, hero = g.cfg.hero ? HEROES[g.cfg.hero] : null, heroOut = !!g.hero();
  return (
    <div className="cpop-shop">
      {hero && (
        <button className={'tcard hero' + (p.place === 'hero' ? ' on' : '') + (heroOut ? ' done' : '') + (g.heroPrice() > g.cash ? ' poor' : '')} data-testid="buy-hero" title={`${hero.name}, ${hero.title}. ${hero.blurb} (H)`} disabled={heroOut} onClick={() => p.pick('hero')}>
          <Sprite name={`${hero.id}${g.cfg.skin ? '-' + g.cfg.skin : ''}-face`} h={46} w={46} />
          <span className="tn">{hero.name}</span><span className="tc">{heroOut ? `Lv ${g.heroLvl}` : `$${fmt(g.heroPrice())}`}</span>
        </button>
      )}
      {TOWERS.map((t, i) => {
        const allowed = g.allowed(t.id), price = g.price(t.id);
        return (
          <button key={t.id} className={'tcard' + (p.place === t.id ? ' on' : '') + (price > g.cash ? ' poor' : '')} data-testid={'buy-' + t.id} disabled={!allowed}
            title={`${t.name} (${i < 9 ? i + 1 : i === 9 ? 0 : '-'}): ${t.role}. ${t.blurb}${t.place === 'water' ? ' Water only.' : ''}`} onClick={() => p.pick(t.id)}>
            <Sprite name={`ic-${t.id}-portrait`} h={46} w={46} />
            <span className="tn">{t.name}</span><span className="tc">{allowed ? `$${fmt(price)}` : <Icon name="lock" size={14} />}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TowerPanel({ p }: { p: Play }) {
  const g = p.g, t = g.towers.find(x => x.id === p.sel);
  if (!t) return null;
  const isHero = t.def === 'hero';
  const def = isHero ? null : TOWER[t.def];
  const name = isHero ? `${HEROES[g.cfg.hero!].name}, ${HEROES[g.cfg.hero!].title}` : def!.name;
  const abil = g.abilities(t);
  const portrait = isHero ? `${g.cfg.hero}${g.cfg.skin ? '-' + g.cfg.skin : ''}-face` : `ic-${t.def}-portrait`;
  return (
    <div className="cpop-tower" data-testid="tower-panel">
      <div className="ph">
        <Sprite name={portrait} h={54} w={54} />
        <div className="pt">
          <b>{name}</b>
          <small>{fmt(t.pops)} pops · {fmt(t.dmg)} damage{isHero ? ` · level ${g.heroLvl}` : ''}</small>
        </div>
        <button className="ibtn x" data-testid="close-panel" title="Close (Esc)" onClick={() => p.cancel()}><Icon name="x" size={20} /></button>
      </div>
      {isHero ? <HeroInfo p={p} /> : def!.paths.map((path, pi) => {
        const tier = t.tiers[pi], next = path[tier];
        const why = g.upgradeReason(t, pi), price = g.upgradePrice(t, pi);
        const cross = crosspathReason(t.tiers, pi);
        const diff = next ? upgradeDiff(t.def as TowerId, t.tiers, pi) : [];
        return (
          <div className={'path' + (cross ? ' closed' : '')} key={pi}>
            <div className="pn">{def!.pathNames[pi]}</div>
            <div className="slots">
              {path.map((u, i) => <span key={i} className={'slot' + (i < tier ? ' got' : i === tier ? ' next' : '')} title={`${u.name}: ${u.desc}`}><Sprite name={`ic-${t.def}-${pi * 5 + i}`} h={30} w={30} /></span>)}
            </div>
            {next ? (
              <button className={'buy' + (why ? ' no' : '')} data-testid={`up-${pi}`} title={why || `${next.name}: ${next.desc}`} onClick={() => p.upgrade(pi)}>
                <span className="un">{next.name}</span>
                <span className="up"><Icon name={why && why.startsWith('Tier') ? 'lock' : 'coin'} size={14} />{price === 0 ? 'Free' : `$${fmt(price)}`}</span>
              </button>
            ) : <span className="maxed">Complete</span>}
            {next && <div className="ud">{next.desc}{diff.length > 0 && <ul>{diff.slice(0, 4).map((d, i) => <li key={i}>{d}</li>)}</ul>}{why && <em>{why}</em>}</div>}
          </div>
        );
      })}
      {t.s.atks.length > 0 && (
        <div className="targets">
          {TARGETS.map(tg => <button key={tg} className={'ibtn' + (t.target === tg ? ' on' : '')} data-testid={'target-' + tg} title={`Target the ${TARGET_NAME[tg].toLowerCase()} puff (T)`} onClick={() => g.setTarget(t.id, tg)}><Icon name={TARGET_ICON[tg]} size={22} /><small>{TARGET_NAME[tg]}</small></button>)}
        </div>
      )}
      <div className="pf">
        {abil.map((a, i) => {
          const cd = t.abilityCd[i] ?? 0;
          return <button key={a.id} className={'cbtn gold abil' + (cd > 0 ? ' cool' : '')} data-testid={`ability-${a.id}`} title={a.desc} onClick={() => p.ability(t.id, i)}>{a.name}{cd > 0 ? ` ${Math.ceil(cd)}s` : ''}</button>;
        })}
        {!isHero && <span className="look" title="This look changes at tier 3 and tier 5">{lookOf(t.tiers) === 'base' ? '' : ''}</span>}
        <Btn kind="red" testid="sell" title="Sell (Backspace)" onClick={() => p.sell()}><Icon name="sell" size={18} /> Sell ${fmt(g.sellValue(t))}</Btn>
      </div>
      {t.s.atks.length > 0 && <div className="atks">{t.s.atks.map(a => <div key={a.id}><b>{a.label}</b> {atkLine(a)}</div>)}</div>}
    </div>
  );
}

function HeroInfo({ p }: { p: Play }) {
  const g = p.g, h = HEROES[g.cfg.hero!], lvl = g.heroLvl;
  const a = HERO_XP[lvl] ?? 0, b = HERO_XP[lvl + 1] ?? a, frac = lvl >= 20 ? 1 : (g.heroXp - a) / Math.max(1, b - a);
  const next = h.levels.find(l => l.lvl === lvl + 1);
  return (
    <div className="heroinfo">
      <div className="xpbar" title={`${Math.floor(g.heroXp)} XP`}><span style={{ width: `${Math.round(frac * 100)}%` }} /></div>
      <small>{lvl >= 20 ? 'Level 20: legendary.' : `Next, level ${lvl + 1}: ${next?.text}`}</small>
      <ul className="lvls">{h.levels.filter(l => l.lvl <= lvl).slice(-4).map(l => <li key={l.lvl}><b>{l.lvl}</b> {l.text}</li>)}</ul>
    </div>
  );
}

export function GoButton({ p }: { p: Play }) {
  const g = p.g;
  const label = g.active ? (p.speed === 1 ? 'Faster' : p.speed === 2 ? 'Fastest' : 'Normal') : g.over === 'won' && !g.freeplay ? 'Won!' : `Round ${g.round}`;
  return (
    <button className={'cpop-go' + (g.active ? ' running' : ' ready')} data-testid="go" title="Start the next round, or change speed (Space)" onClick={() => p.go()}>
      <Icon name={g.active ? (p.speed === 1 ? 'ff' : p.speed === 2 ? 'fff' : 'play') : 'play'} size={34} />
      <span>{label}</span>
    </button>
  );
}

export function QuickAbilities({ p }: { p: Play }) {
  const g = p.g;
  const list = g.towers.flatMap(t => g.abilities(t).map((a, i) => ({ t, a, i })));
  if (!list.length) return null;
  return (
    <div className="cpop-quick">
      {list.slice(0, 8).map(({ t, a, i }) => {
        const cd = t.abilityCd[i] ?? 0;
        return <button key={t.id + a.id} className={'qa' + (cd > 0 ? ' cool' : ' ready')} data-testid={`quick-${a.id}`} title={`${a.name}: ${a.desc}`} onClick={() => p.ability(t.id, i)}>
          <Sprite name={t.def === 'hero' ? `${g.cfg.hero}${g.cfg.skin ? '-' + g.cfg.skin : ''}-face` : `ic-${t.def}-portrait`} h={34} w={34} />
          {cd > 0 && <span className="cdn">{Math.ceil(cd)}</span>}
        </button>;
      })}
    </div>
  );
}

export function Preview({ p }: { p: Play }) {
  const g = p.g;
  if (g.active || (g.over && !g.freeplay)) return null;
  const list = preview(g.round, g.cfg.seed);
  return (
    <div className="cpop-preview" data-testid="preview" title="What the next round brings">
      <small>Next:</small>
      {list.slice(0, 6).map((q, i) => (
        <span key={i} className="pv" title={`${q.count} ${PUFFS[q.kind].name}${q.night ? ' (night)' : ''}${q.fog ? ' (fog)' : ''}${q.fort ? ' (roped)' : ''}: ${PUFFS[q.kind].hint}`}>
          <Sprite name={PUFFS[q.kind].boss ? `b-${q.kind}` : `p-${q.kind}-0`} h={24} w={28} />×{q.count}{q.night ? '☾' : ''}{q.fog ? '≈' : ''}{q.fort ? '⊗' : ''}
        </span>
      ))}
    </div>
  );
}

export function PauseMenu({ p, onQuit, onRestart, onClose, settings, setSetting }: { p: Play; onQuit: () => void; onRestart: () => void; onClose: () => void; settings: { sound: boolean; music: boolean; tips: boolean }; setSetting: (k: 'sound' | 'music' | 'tips', v: boolean) => void }) {
  const g = p.g;
  return (
    <div className="cpop-modal" data-testid="pause-menu">
      <div className="card">
        <h2>Paused</h2>
        <p className="muted">{g.map.name} · {DIFF_NAME[g.cfg.diff]} · {MODE_INFO[g.cfg.mode].name}</p>
        <div className="col">
          <Btn testid="resume" onClick={onClose}><Icon name="play" size={18} /> Resume</Btn>
          <Btn kind="gold" testid="restart" onClick={onRestart}><Icon name="auto" size={18} /> Restart</Btn>
          <Btn kind="red" testid="quit" onClick={onQuit}><Icon name="home" size={18} /> Leave the run</Btn>
        </div>
        <div className="toggles">
          <label><input type="checkbox" checked={settings.sound} onChange={e => setSetting('sound', e.target.checked)} data-testid="set-sound" /> Sound</label>
          <label><input type="checkbox" checked={settings.music} onChange={e => setSetting('music', e.target.checked)} data-testid="set-music" /> Music</label>
          <label><input type="checkbox" checked={settings.tips} onChange={e => setSetting('tips', e.target.checked)} data-testid="set-tips" /> Next-round preview</label>
        </div>
        <p className="keys"><kbd>Space</kbd> start / speed · <kbd>1</kbd>–<kbd>0</kbd> <kbd>-</kbd> towers · <kbd>H</kbd> hero · <kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd> upgrade · <kbd>T</kbd> target · <kbd>Q</kbd> ability · <kbd>⌫</kbd> sell · <kbd>P</kbd> pause · <kbd>A</kbd> auto</p>
      </div>
    </div>
  );
}

// The map HUD: the woven top bar of goods, Warmth and turn; the selected-unit panel with its actions; Enzo's advice;
// the end-of-turn summary; a neighbour's request; and the title, win and out-of-time cards.
import {
  preview, season, frostKnown, hearts, villageAt, campAt, maxMp, caravanLoad, isSummit,
  GOODS, GOOD_NAME, GOOD_WHY, NEIGHBOURS, NEIGHBOUR_IDS, TERRAIN, BANDS, LAST_TURN, CARAVAN_CAP, DECISIONS,
  terrainAt, hexDist, Game, type Cmd, type ReportItem,
} from '@/lib/highburrow-game';
import { attention } from '@/lib/highburrow-advisor';
import { Sprite, Icon, small, ART } from './dom';
import type { Highburrow } from './controller';

const sign = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

export function Top({ app }: { app: Highburrow }) {
  const g = app.g, s = g.s, I = small() ? 22 : 30;
  const ps = s.villages.map(v => ({ v, p: preview(s, v) }));
  const cold = [...s.villages].sort((a, b) => a.warmth - b.warmth)[0];
  const dry = season(s.turn) === 'dry', left = 8 - ((s.turn - 1) % 8);
  return (
    <div id="top" className="woven">
      {GOODS.map(gd => {
        const n = s.villages.reduce((a, v) => a + v.store[gd], 0), d = ps.reduce((a, x) => a + x.p.goods[gd].n, 0);
        const tip = `<div class="tt">${GOOD_NAME[gd]}: ${n}</div>` + s.villages.map(v => `<div class="tr"><span>${v.name}</span><b>${v.store[gd]}</b></div>`).join('')
          + (s.units.some(u => u.cargo?.[gd]) ? `<div class="tr"><span>On caravans</span><b>${s.units.reduce((a, u) => a + (u.cargo?.[gd] ?? 0), 0)}</b></div>` : '')
          + `<div class="tr tot"><span>Made each turn</span><b>${sign(d)}</b></div><div class="tn">${GOOD_WHY[gd]}</div>`;
        return <div key={gd} className={`res g-${gd}`} data-tip={tip}><Icon name={gd} size={I} /><span className="rn"><b>{n}</b></span></div>;
      })}
      <div className={'res warmth' + (cold && cold.warmth < 30 ? ' alarm' : '')} data-tip={`<div class="tt">Warmth (coldest village shown)</div>` + ps.map(({ v, p }) => `<div class="tr"><span>${v.name}</span><b class="${v.warmth < 30 ? 'neg' : ''}">${v.warmth}% <small>${sign(p.warmth.delta)}</small></b></div>`).join('') + '<div class="tn">Open a village to see where its Warmth comes from.</div>'}>
        <Icon name="warmth" size={I} /><span className="rn">Warmth <b>{cold?.warmth ?? 0}%</b></span>
      </div>
      <div className="res pop" data-tip={`<div class="tt">Chinchillas: ${g.pop()} of ${g.goal()}</div>The summit festival needs a league of ${g.goal()}.` + s.villages.map(v => `<div class="tr"><span>${v.name}</span><b>${v.settlers.length}</b></div>`).join('')}>
        <Icon name="pop" size={I} /><span className="rn"><b>{g.pop()}</b>/{g.goal()}</span>
      </div>
      <div className="res turn" data-tip={`<div class="tt">${dry ? 'Dry season' : 'Wet season'} (${left} turn${left === 1 ? '' : 's'} left)</div>${dry ? 'Cold nights: −2 Warmth everywhere, frost nights are likely, salt flats make +1.' : 'Rain: food tiles on the lower slopes make +1. Frost is rare.'}<div class="tn">Hold the summit festival before turn ${LAST_TURN}.</div>`}>
        <Icon name={dry ? 'dry' : 'wet'} size={I} /><span className="rn">Turn <b>{s.turn}</b>/{LAST_TURN} · {dry ? 'Dry' : 'Wet'}</span>
      </div>
      {s.frost && frostKnown(s) && (
        <div className="res frost" data-tip='<div class="tt">Frost tonight</div>When you end the turn every village loses extra Warmth, potatoes may spoil, and high food tiles make 1 less. Put settlers on the hearth now.'>
          <Icon name="frost" size={I} /><span className="rn"><b>Frost tonight</b></span>
        </div>
      )}
    </div>
  );
}

type Act = { ic: string; label: string; key: string; cmd: Cmd | (() => void); tip: string };
/** the panel for the selected unit; actions are greyed out with the reason when they can't be done */
export function UnitPanel({ app }: { app: Highburrow }) {
  const g = app.g, s = g.s;
  const u = app.sel != null ? g.unit(app.sel) : null;
  if (!u) return <div id="unit" className="woven" />;
  const sm = small();
  const name = u.kind === 'dora' ? 'Dora · Scout' : u.kind === 'enzo' ? 'Enzo · Leader' : u.kind === 'caravan' ? 'Llama caravan' : 'Settler';
  const face = u.kind === 'dora' ? 'dora-face' : u.kind === 'enzo' ? 'enzo-face' : u.kind === 'caravan' ? 'face-llama' : `face-settler${(u.fur ?? 0) === 1 ? 1 : 0}`;
  const mp = maxMp(s, u);
  const here = villageAt(s, u.q, u.r);
  const acts: Act[] = [];
  const add = (ic: string, label: string, key: string, cmd: Act['cmd'], tip: string) => acts.push({ ic, label, key, cmd, tip });
  if (u.kind === 'dora') {
    add('explore', 'Explore', 'E', { k: 'explore', unit: u.id }, 'Dora walks to the nearest edge of the mist.');
    add('befriend', 'Befriend', 'B', { k: 'befriend', unit: u.id }, 'Next to a camp: visit the neighbours, +friendship. Once every 2 turns each.');
  }
  if (u.kind === 'enzo') {
    add('found', 'Found', 'F', { k: 'found', unit: u.id }, 'With a settler on the same tile: found a new village here (3+ tiles from others).');
    add('build', 'Trail', 'T', { k: 'trail', unit: u.id }, 'Lay a trail on this tile: every unit crosses it for ½ step. Uses Enzo’s turn.');
  }
  if (u.kind === 'settler') add('pop', 'Join', 'J', { k: 'join', unit: u.id }, 'In a village: the settler moves in and starts work.');
  const camp = NEIGHBOUR_IDS.find(n => hexDist([u.q, u.r], [NEIGHBOURS[n].q, NEIGHBOURS[n].r]) <= 1 && s.nb[n].met);
  if (u.kind === 'caravan' && camp) add('caravan', 'Trade', 'G', () => app.openTrade(camp), `Trade the caravan’s goods with the ${NEIGHBOURS[camp].name}.`);
  if (u.kind === 'caravan') {
    add('caravan', u.route ? 'Edit route' : 'Route', 'O', () => app.openRoute(u.id), u.route ? 'Change where this caravan goes and what it carries.' : 'Set a standing route: from one village to another, carrying chosen goods, every turn.');
    if (u.route) add('rest', 'Stop route', 'X', { k: 'unroute', unit: u.id }, 'The caravan stops where it is and waits for orders.');
  }
  if (here) add('pop', 'Village', 'V', () => app.openVillage(here.id), `Open ${here.name}${u.kind === 'caravan' ? ' to load and unload goods' : ''}.`);
  if (!u.route) add('rest', 'Rest', 'R', { k: 'rest', unit: u.id }, 'Skip this unit until next turn.');
  const save = g.save();
  return (
    <div id="unit" className="woven on">
      <div className="pring"><Sprite name={face} h={sm ? 50 : 74} /></div>
      <div className="uinfo">
        <div className="uname">{name}</div>
        <div className="ump" data-tip={`<div class="tt">Moves</div>Grass, terraces and meadows cost 1 step. Forest, scree and snow cost 2. A trail costs ½.${u.kind === 'caravan' && caravanLoad(u) ? '<br>Carrying: ' + GOODS.filter(gd => u.cargo![gd]).map(gd => `${u.cargo![gd]} ${gd}`).join(', ') : ''}`}>
          {`Moves ${Math.floor(u.mp / 2)}${u.mp % 2 ? '½' : ''}/${mp / 2}${u.path.length ? ' · on the way' : ''}${u.kind === 'caravan' ? ` · Cargo ${caravanLoad(u)}/${CARAVAN_CAP}` : ''}`}
        </div>
        {u.route && <div className="uroute">Route: {g.village(u.route.a)?.name} → {g.village(u.route.b)?.name} · {u.route.carry.join(', ')}</div>}
        <div className="uacts">
          {acts.map(a => {
            let why = '';
            if (typeof a.cmd !== 'function') { const r = Game.load(save)!.apply(a.cmd); if (!r.ok) why = r.msg; }
            const cmd = a.cmd;
            return (
              <button key={a.label} className="act" disabled={!!why} data-act={a.label.toLowerCase()}
                data-tip={`<div class="tt">${a.label} <kbd>${a.key}</kbd></div>${a.tip}${why ? `<div class="tn neg">${why}</div>` : ''}`}
                onClick={() => typeof cmd === 'function' ? cmd() : app.act(cmd)}>
                <Icon name={a.ic} size={sm ? 32 : 40} /><span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Enzo's suggestion with a "Do it" button (always shown with Assist; on request without) */
export function AdviceBox({ app }: { app: Highburrow }) {
  if (!app.g.s.assist && !app.askAdvice) {
    return <div id="advice" className="woven"><button className="ask" title="Ask Enzo for advice (H)" onClick={() => { app.askAdvice = true; app.refresh(); }}><Sprite name="enzo-face" h={44} /></button></div>;
  }
  const a = app.advice; if (!a) return <div id="advice" className="woven" />;
  return (
    <div id="advice" className="woven">
      <Sprite name="enzo-face" h={small() ? 38 : 50} cls="aface" />
      <div className="atext"><b>Enzo:</b> {a.text}</div>
      <div className="arow">
        {a.cmd.k !== 'end' && <>
          <button className="wbtn red sm" title="Do it (A)" onClick={() => app.doAdvice()}>Do it</button>
          <button className="wbtn teal sm" title="Show another tip" onClick={() => { app.skip.add(a.key); app.refresh(); }}>Other tip</button>
        </>}
      </div>
    </div>
  );
}

export function tileText(app: Highburrow, q: number, r: number) {
  const s = app.g.s; const t = TERRAIN[terrainAt(q, r)];
  if (!s.seen[q + r * 18]) return '<div class="tt">Mist</div>Nobody has explored here yet. Send Dora.';
  const camp = campAt(q, r);
  return `<div class="tt">${t.name}</div>${BANDS[t.band]} band${t.good ? `<br>A settler here makes +${t.n} ${t.good}` : t.warmth ? `<br>A settler here adds +${t.warmth} Warmth` : ''}${!t.walk && t.name !== 'Hidden pass' ? '<br>Nobody can walk here.' : ''}${t.name === 'Hidden pass' && !s.passes ? '<br>Only the condors know the way.' : ''}${camp ? `<br>Home of the ${NEIGHBOURS[camp].name}.` : ''}${s.trail[q + r * 18] ? '<br>A trail runs here.' : ''}`;
}

const KIND_ICON: Record<string, string> = { good: 'festival', bad: 'happy', info: 'pop', frost: 'frost', event: 'wet', grow: 'pop', build: 'build', aid: 'befriend', friend: 'heart', season: 'dry', win: 'festival', route: 'caravan', decision: 'heart', waste: 'potatoes' };
export function Summary({ app }: { app: Highburrow }) {
  const s = app.g.s, rep = app.report;
  const frost = rep.some(r => r.kind === 'frost' && r.text.startsWith('Frost night'));
  const items: ReportItem[] = rep.length ? rep : [{ kind: 'info', text: 'A quiet turn in the valley.' }];
  const need = attention(app.g);
  return (
    <div className={'overlay summary' + (frost ? ' frosty' : '')}>
      <div className="spanel woven">
        <div className="ttitle">Turn {s.turn - 1} → {s.turn}</div>
        <div className="slist">
          {items.map((r, i) => (
            <div key={i} className={`sitem ${r.kind}${r.v != null ? ' link' : ''}`} onClick={r.v != null ? () => { app.modal = ''; app.openVillage(r.v!); } : undefined}>
              <Icon name={r.kind === 'bad' && r.text.includes('hungry') ? 'potatoes' : r.kind === 'bad' ? 'frost' : r.kind === 'season' ? (season(s.turn) === 'dry' ? 'dry' : 'wet') : KIND_ICON[r.kind]} size={30} />
              <span>{r.text}</span>
            </div>
          ))}
        </div>
        <div className="tbtns">
          <button className="wbtn red" autoFocus onClick={() => app.summaryNext()}>{s.decision ? 'Answer the request ▸' : need.length ? `Next: ${need[0].text} ▸` : 'Next ▸'}</button>
          <button className="wbtn teal" onClick={() => app.summaryOk()}>OK</button>
        </div>
      </div>
    </div>
  );
}

/** a neighbour's request: their portrait, the question, and one button per choice */
export function Decision({ app }: { app: Highburrow }) {
  const s = app.g.s; const d = DECISIONS.find(x => x.id === s.decision); if (!d) return null;
  return (
    <div className="overlay decision">
      <div className="dpanel woven">
        {d.who && <Sprite name={`face-${d.who}`} h={120} cls="dface" />}
        <div className="ttitle">{d.title}</div>
        <p className="dtext">{d.text}</p>
        {d.who && <div className="dwho">{NEIGHBOURS[d.who].name} · friendship {s.nb[d.who].fr}</div>}
        <div className="dchoices">
          {d.choices.map((c, i) => (
            <button key={i} className={'dchoice ' + (i ? 'teal' : 'red')} autoFocus={i === 0}
              onClick={() => { app.modal = ''; const r = app.act({ k: 'decide', choice: i }); if (r.ok) app.say(r.msg, 'good'); }}>
              <b>{c.label}</b><span>{c.line}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EndCard({ app }: { app: Highburrow }) {
  const g = app.g, s = g.s, won = s.over === 'won';
  const friends = NEIGHBOUR_IDS.filter(n => hearts(s.nb[n].fr) >= 3).length;
  return (
    <div className={'overlay endcard' + (won ? ' won' : '')}>
      {won && <img className="ebg" src={`${ART}bg-festival.webp`} alt="" />}
      <div className="epanel woven">
        <div className="ttitle">{won ? 'The Summit Festival!' : 'The festival waits'}</div>
        <p>{won
          ? `On turn ${s.wonTurn} the whole league climbed to ${s.villages.find(isSummit)?.name} to dance, share cloth, quinoa and silver, and thank their friends.`
          : `Turn ${LAST_TURN} has passed without the summit festival. The valley is still yours: keep playing, or start again.`}</p>
        <div className="estats">
          <div><b>{g.pop()}</b> chinchillas</div><div><b>{s.villages.length}</b> villages</div><div><b>{friends}</b>/3 friends</div>
          <div><b>{s.stats.trades}</b> trades</div><div><b>{s.stats.built}</b> built</div><div><b>{s.stats.frosts}</b> frost nights</div>
        </div>
        <div className="tbtns">
          {s.over === 'late' && <button className="wbtn teal" onClick={() => { s.over = ''; s.wonTurn = -1; app.modal = ''; app.save(); app.refresh(); }}>Keep playing</button>}
          <button className="wbtn red" onClick={() => app.newGame(s.assist)}>Play again</button>
        </div>
        <p className="tback"><a href="/">Back to the arcade</a></p>
      </div>
    </div>
  );
}

/** the title card: Continue (if there is a save) or New game, with the Assist choice */
export function Title({ app, saved, assist, setAssist }: { app: Highburrow; saved: Game | null; assist: boolean; setAssist: (b: boolean) => void }) {
  const cont = saved && !saved.s.over;
  return (
    <div className="overlay title">
      <div className="epanel woven">
        <div className="ttitle big">Highburrow</div>
        <p className="sub">The First Valley</p>
        <p>Lead the chinchillas up the Andes: found burrow-villages, keep them warm through frost nights, make friends with the vicuñas, condors and viscachas, and hold a summit festival before turn 60.</p>
        <div className="theroes small"><Sprite name="dora-wave" h={120} /><Sprite name="enzo-idle" h={120} /></div>
        <label className="assist"><input type="checkbox" checked={assist} onChange={e => setAssist(e.target.checked)} /><span> Assist: gentler frosts, Enzo’s tips always on</span></label>
        <div className="tbtns">
          {cont && <button className="wbtn red" autoFocus onClick={() => { app.modal = ''; app.refresh(); app.ask(); }}>Continue (turn {saved.s.turn})</button>}
          <button className={'wbtn ' + (cont ? 'teal' : 'red')} autoFocus={!cont} onClick={() => app.newGame(assist)}>New game</button>
        </div>
        <p className="tback"><a href="/">Back to the arcade</a></p>
      </div>
    </div>
  );
}

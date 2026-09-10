/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. Mount readiness gates SSR controls. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The labeled ARIA meter contains a custom needle and striped sweet-spot region, which native meter cannot render. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  DustBathGame,
  SHOP,
  STAGES,
  STAGE_INFO,
  type Bath,
  type Customer,
  type Temp,
  type Grain,
  type Upgrade,
} from '../../lib/dust-bath-game';
import './spa.css';

const SAVE_KEY = 'dust-bath-save-v2';
const TEMP_ICON: Record<Temp, string> = {
  cool: '❄',
  mild: '☁',
  toasty: '☀',
};
const GRAIN_ICON: Record<Grain, string> = {
  fine: '·',
  medium: '∴',
  coarse: '⁘',
};

/** Expressive chinchilla portrait. Distinct belly, optional mosaic patch and mood. */
function Chin({
  color = '#9aa6ad',
  belly = '#e8ecee',
  patch = false,
  mood = 'calm',
  vip = false,
}: {
  color?: string;
  belly?: string;
  patch?: boolean;
  mood?: 'calm' | 'happy' | 'bliss' | 'worried';
  vip?: boolean;
}) {
  // Gradient ids must be unique per coat. Sharing one id makes every portrait
  // reuse the first chinchilla's fill, which rendered Enzo in Dora's white.
  const gid = `db-body-${color}-${belly}`.replace(/[^a-zA-Z0-9-]/g, '');
  return (
    <svg
      className={`db-chin db-mood-${mood}`}
      viewBox="0 0 150 140"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor={belly} />
          <stop offset="72%" stopColor={color} />
          <stop offset="100%" stopColor={color} />
        </radialGradient>
      </defs>
      <ellipse cx="75" cy="128" rx="46" ry="8" fill="#3b332c22" />
      {/* tail */}
      <path
        d="M112 104 Q150 84 138 72 Q129 66 124 90"
        fill={color}
        stroke="#5f574f"
        strokeWidth="2.5"
      />
      {/* ears */}
      <ellipse
        cx="46"
        cy="30"
        rx="17"
        ry="24"
        fill={color}
        stroke="#5f574f"
        strokeWidth="2"
      />
      <ellipse
        cx="104"
        cy="30"
        rx="17"
        ry="24"
        fill={color}
        stroke="#5f574f"
        strokeWidth="2"
      />
      <ellipse cx="46" cy="31" rx="9" ry="15" fill="#eec7c1" />
      <ellipse cx="104" cy="31" rx="9" ry="15" fill="#eec7c1" />
      {/* body */}
      <ellipse
        cx="75"
        cy="86"
        rx="45"
        ry="38"
        fill={`url(#${gid})`}
        stroke="#5f574f"
        strokeWidth="2"
      />
      {/* head */}
      <ellipse
        cx="75"
        cy="62"
        rx="41"
        ry="35"
        fill={`url(#${gid})`}
        stroke="#5f574f"
        strokeWidth="2"
      />
      {patch && (
        <path
          d="M75 30 Q95 40 92 66 Q80 74 62 66 Q56 44 75 30Z"
          fill="#ffffff"
          opacity="0.55"
        />
      )}
      {/* cheeks */}
      <ellipse cx="50" cy="70" rx="9" ry="6" fill="#efb7ad" opacity="0.6" />
      <ellipse cx="100" cy="70" rx="9" ry="6" fill="#efb7ad" opacity="0.6" />
      {/* eyes */}
      {mood === 'happy' || mood === 'bliss' ? (
        <path
          d="M50 60q7-9 14 0m22 0q7-9 14 0"
          fill="none"
          stroke="#39332f"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      ) : (
        <g fill="#39332f">
          <circle cx="57" cy="60" r="4.6" />
          <circle cx="93" cy="60" r="4.6" />
          <circle cx="58.6" cy="58.4" r="1.5" fill="#fff" />
          <circle cx="94.6" cy="58.4" r="1.5" fill="#fff" />
        </g>
      )}
      {/* nose + mouth */}
      <ellipse cx="75" cy="72" rx="5" ry="3.4" fill="#c07f78" />
      {mood === 'worried' ? (
        <path
          d="M69 82q6-4 12 0"
          fill="none"
          stroke="#5f574f"
          strokeWidth="2"
        />
      ) : (
        <path
          d="M75 75v4m0 0q-6 5-11 1m11-1q6 5 11 1"
          fill="none"
          stroke="#5f574f"
          strokeWidth="2"
        />
      )}
      {/* whiskers */}
      <path
        d="M38 70l-21-4m22 11-21 4m94-15 21-4m-22 11 21 4"
        fill="none"
        stroke="#6f665e"
        strokeWidth="1.4"
      />
      {/* feet */}
      <ellipse cx="55" cy="120" rx="13" ry="6" fill={color} stroke="#5f574f" />
      <ellipse cx="95" cy="120" rx="13" ry="6" fill={color} stroke="#5f574f" />
      {vip && (
        <path
          d="M62 20 66 12 75 18 84 12 88 20Z"
          fill="#e7c14e"
          stroke="#b8942f"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

function Wish({
  temp,
  grain,
  reveal,
}: {
  temp: Temp;
  grain: Grain;
  reveal: boolean;
}) {
  return (
    <span className="db-wish" aria-hidden={!reveal}>
      {reveal ? (
        <>
          <i title={`Wants ${temp}`}>{TEMP_ICON[temp]}</i>
          <i title={`Wants ${grain} grain`}>{GRAIN_ICON[grain]}</i>
        </>
      ) : (
        <i className="db-wish-hidden">?</i>
      )}
    </span>
  );
}

export default function DustBath() {
  const game = useRef(new DustBathGame());
  const g = game.current;
  const [ready, setReady] = useState(false);
  const [, render] = useState(0);
  const [help, setHelp] = useState(false);
  const [easy, setEasy] = useState(false);
  const refresh = () => render((n) => n + 1);
  const act = (fn: () => unknown) => {
    fn();
    persist();
    refresh();
  };
  const persist = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ coins: g.coins, upgrades: g.upgrades }),
      );
    } catch {
      /* storage may be unavailable; game still runs in-memory */
    }
  };
  useEffect(() => {
    setReady(true);
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const save = JSON.parse(raw);
        g.restore(Number(save?.coins) || 0, save?.upgrades || {});
      }
    } catch {
      /* ignore malformed save */
    }
    refresh();
    let frame = 0,
      last = 0;
    const loop = (now: number) => {
      if (last) g.step(Math.min(0.05, (now - last) / 1000));
      last = now;
      refresh();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const pause = () => {
      if (g.state === 'playing') {
        g.pause();
        refresh();
      }
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      g.cancel();
    };
  }, [g]);
  const playing = g.state === 'playing';
  const lobby = g.state === 'ready' || g.state === 'finished';
  const scrub = () => act(() => (g.holding ? g.release() : g.begin()));
  const active = g.baths[g.activeBath];
  const sweet = g.spot(active);
  const inSpot = g.charge >= sweet.lo && g.charge <= sweet.hi;
  const reveal = g.upgrades.thermo;
  const stageName = active?.guest ? STAGES[active.stage] : 'pour';

  const chinMood = (c: Customer, worried = false) =>
    worried && c.patience < c.maxPatience * 0.3 ? 'worried' : 'calm';

  return (
    <main
      className={`db-shell ${g.upgrades.decor ? 'db-leafy' : ''} ${g.upgrades.lounge ? 'db-grand' : ''}`}
    >
      <div className="db-motes" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <header className="db-nav">
        <a href="/">← MAIN ARCADE</a>
        <span>DORA &amp; ENZO’S LITTLE SPA</span>
        <button disabled={lobby} onClick={() => act(() => g.pause())}>
          {g.state === 'paused' ? 'Resume' : 'Pause'}
        </button>
      </header>
      <section className="db-heading">
        <div>
          <p className="db-eyebrow">A LITTLE DUST. A LOT OF LOVE.</p>
          <h1>
            Dust Bath <em>Dash</em>
            <span>✦</span>
          </h1>
          <p>
            Run a cozy chinchilla spa. Read each guest’s wishes, pour, scrub,
            fluff and style, and chase perfect-bath combos.
          </p>
        </div>
        <div className="db-brand">
          <Chin color="#f4f0e6" belly="#ffffff" mood="happy" />
          <Chin color="#9aa6ad" belly="#e8ecee" mood="happy" />
          <span>DORA · ENZO</span>
        </div>
      </section>
      <div className="db-stats">
        <div>
          <small>
            {g.mode === 'cozy' && !lobby ? 'COZY MODE' : 'SHIFT CLOCK'}
          </small>
          <b data-testid="clock">
            {g.mode === 'cozy' && !lobby
              ? '∞ No rush'
              : `${Math.floor(Math.ceil(g.time) / 60)}:${String(Math.ceil(g.time) % 60).padStart(2, '0')}`}
          </b>
        </div>
        <div>
          <small>HAPPY GUESTS</small>
          <b data-testid="served">
            {g.served}
            <span> little clouds</span>
          </b>
        </div>
        <div>
          <small>COMBO STREAK</small>
          <b data-testid="streak">
            ✦ {g.streak}
            <span> ×{g.multiplier.toFixed(1)}</span>
          </b>
        </div>
        <div>
          <small>YOUR COIN JAR</small>
          <b data-testid="coins">
            ✧ {g.coins}
            <span> coins</span>
          </b>
        </div>
        <button
          onClick={() => {
            if (playing) g.pause();
            setHelp(!help);
            refresh();
          }}
        >
          {help ? 'Close guide' : 'How to play'}
        </button>
      </div>
      {(lobby || help) && (
        <section className="db-welcome">
          <div>
            <p className="db-eyebrow">
              {g.state === 'finished'
                ? 'THAT’S A WRAP'
                : 'WELCOME TO YOUR HAPPY PLACE'}
            </p>
            <h2>
              {g.state === 'finished'
                ? 'Small spa. Big feelings.'
                : 'Ready, set… relax.'}
            </h2>
            <p>
              {g.state === 'finished'
                ? `${g.served} guests pampered · ${g.perfect} perfect baths · best combo ×${(1 + Math.min(g.bestStreak, 5) * 0.2).toFixed(1)} · ${g.earned} coins earned · ${g.missed} left early. Spend below, then open again.`
                : 'Dora pampers the guests. Enzo keeps the dust flowing. You read each chinchilla and give the perfect bath.'}
            </p>
            <ol>
              <li>
                <b>Read &amp; seat.</b> Tap a waiting guest, then a bath. Each
                breed wants a temperature and grain (❄☁☀ · fine/coarse).
              </li>
              <li>
                <b>Set the dust.</b> Cycle warmth and grain to match the wish for
                a wider sweet spot and bonus coins.
              </li>
              <li>
                <b>Pour → scrub → fluff → style.</b> Hold SCRUB and release in
                the sweet spot each stage. VIPs need all four.
              </li>
              <li>
                <b>Chase combos.</b> Back-to-back flawless baths build a coin
                multiplier. A sneeze or missed wish resets it.
              </li>
            </ol>
            <p className="db-note">
              Keyboard: Tab to a control, Enter to activate. On SCRUB, hold Space
              or Enter and release. Prefer no holding? Enable two-tap scrubbing
              below. Cozy mode has no timer or impatient guests. Coins and
              upgrades save to this browser.
            </p>
            {lobby && (
              <div className="db-start">
                <button
                  disabled={!ready}
                  className="db-primary"
                  onClick={() => {
                    g.start('shift');
                    setHelp(false);
                    refresh();
                  }}
                >
                  Open spa · 2-minute shift →
                </button>
                <button
                  disabled={!ready}
                  onClick={() => {
                    g.start('cozy');
                    setHelp(false);
                    refresh();
                  }}
                >
                  ☁ Untimed cozy mode
                </button>
              </div>
            )}
          </div>
          <div className="db-postcard">
            <span>THE ANDES</span>
            <div>☁</div>
            <b>
              take a breath.
              <br />
              leave a little fluff.
            </b>
            <small>EST. WITH LOVE · OPEN TO EVERY PAW</small>
          </div>
        </section>
      )}
      {g.state === 'paused' && !help && (
        <section className="db-paused">
          <h2>A little breathing room.</h2>
          <p>The clock, guests and Enzo are all paused.</p>
          <button className="db-primary" onClick={() => act(() => g.pause())}>
            Resume spa →
          </button>
        </section>
      )}
      <div className="db-workspace" aria-label="Spa play area">
        <section className="db-room">
          <div className="db-scene" aria-hidden="true">
            <div className="db-sun" />
            <div className="db-hills" />
            <div className="db-shelf" />
          </div>
          <div className="db-section-title">
            <h2>
              01 <span>The waiting nook</span>
            </h2>
            <small>
              {g.queue.length} / 5 guests · wave {g.wave}
            </small>
          </div>
          <div className="db-queue">
            {g.queue.map((c) => (
              <button
                className={`db-guest ${g.selected === c.id ? 'selected' : ''} ${c.vip ? 'vip' : ''}`}
                key={c.id}
                disabled={!playing}
                aria-pressed={g.selected === c.id}
                aria-label={`Select ${c.name}, ${c.label}${c.vip ? ' VIP' : ''}. Wants ${c.temp} ${c.grain} dust.`}
                onClick={() => act(() => g.select(c.id))}
              >
                {c.vip && <span className="db-vip-tag">VIP</span>}
                <Chin
                  color={c.color}
                  belly={c.belly}
                  patch={c.patch}
                  vip={c.vip}
                  mood={chinMood(c, true)}
                />
                <b>{c.name}</b>
                <small className="db-breed">{c.label}</small>
                <Wish temp={c.temp} grain={c.grain} reveal={reveal} />
                <small>
                  {g.mode === 'cozy'
                    ? 'Happy to wait ♡'
                    : `${Math.ceil(c.patience)}s patience`}
                </small>
                <meter
                  min="0"
                  max={c.maxPatience}
                  value={c.patience}
                  aria-label={`${c.name} patience`}
                />
              </button>
            ))}
            {!g.queue.length && (
              <p className="db-empty">
                {lobby
                  ? 'Your first guests are just around the corner.'
                  : 'A quiet moment. More fluff arriving soon…'}
                <span>✿</span>
              </p>
            )}
          </div>
          <div className="db-section-title">
            <h2>
              02 <span>The dust-bath lounge</span>
            </h2>
            <div className="db-dora">
              <Chin color="#f4f1ec" belly="#ffffff" mood="happy" />
              <small>DORA’S STATION</small>
            </div>
          </div>
          <div className={`db-baths cols-${g.baths.length}`}>
            {g.baths.map((b, i) => (
              <BathCard
                key={i}
                bath={b}
                index={i}
                active={g.activeBath === i}
                playing={playing}
                holding={g.holding}
                mode={g.mode}
                reveal={reveal}
                match={g.matchScore(b)}
                onSeat={() => act(() => g.seat(i))}
                onTemp={() => act(() => g.cycleTemp(i))}
                onGrain={() => act(() => g.cycleGrain(i))}
              />
            ))}
          </div>
          {g.upgrades.decor && (
            <div className="db-ferns" aria-label="Fern sanctuary installed">
              ✿ 🌿 ✿ 🌿 ✿
            </div>
          )}
          <output className="db-status" aria-live="polite">
            ✦ <span>{g.message}</span>
          </output>
        </section>
        <aside className="db-controls">
          <div className="db-section-title">
            <h2>
              03 <span>A gentle touch</span>
            </h2>
          </div>
          <div className="db-stagebar" aria-label="Bath stages">
            {STAGES.map((s, idx) => {
              const total = active?.guest?.stages ?? 3;
              if (idx >= total) return null;
              const done = active?.guest ? active.stage > idx : false;
              const now = active?.guest ? active.stage === idx : idx === 0;
              return (
                <span
                  key={s}
                  className={`db-stagechip ${done ? 'done' : ''} ${now ? 'now' : ''}`}
                >
                  {done ? '✓' : idx + 1} {STAGE_INFO[s].label}
                </span>
              );
            })}
          </div>
          <p>
            Working on <b>bath {g.activeBath + 1}</b> ·{' '}
            <b>{STAGE_INFO[stageName].label}</b>
            <br />
            {active?.guest
              ? STAGE_INFO[stageName].hint + '. Release in the sweet spot.'
              : 'Seat a guest to begin their spa day.'}
          </p>
          <div
            className={`db-meter ${inSpot && g.holding ? 'hot' : ''}`}
            role="meter"
            aria-label="Scrub pressure"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(g.charge * 100)}
            aria-valuetext={
              inSpot
                ? 'Sweet spot, release now'
                : `${Math.round(g.charge * 100)} percent`
            }
          >
            <div
              className="db-sweet"
              style={{
                left: `${sweet.lo * 100}%`,
                width: `${(sweet.hi - sweet.lo) * 100}%`,
              }}
            />
            <span
              className="db-needle"
              style={{ left: `${Math.min(98, g.charge * 100)}%` }}
            />
          </div>
          <div className="db-meter-label">
            <span>GENTLE</span>
            <b>SWEET SPOT</b>
            <span>ACHOO!</span>
          </div>
          <p className="db-pressure" aria-live="polite" aria-atomic="true">
            {g.holding
              ? g.charge < sweet.lo
                ? 'Keep going…'
                : inSpot
                  ? '✓ Release now!'
                  : 'Too much! Release and redo.'
              : g.streak > 1
                ? `On a ${g.streak}× combo. Keep it flawless!`
                : 'Ready for a little fluff?'}
          </p>
          <button
            className="db-scrub"
            disabled={!playing || !active?.guest || (!g.dust && !g.holding && stageName === 'pour')}
            onPointerDown={(e) => {
              if (easy || e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.focus();
              e.currentTarget.setPointerCapture(e.pointerId);
              act(() => g.begin());
            }}
            onPointerUp={() => {
              if (!easy) act(() => g.release());
            }}
            onPointerCancel={() => act(() => g.cancel())}
            onLostPointerCapture={() => {
              if (!easy && g.holding) act(() => g.cancel());
            }}
            onKeyDown={(e) => {
              if (easy || ![' ', 'Enter'].includes(e.key)) return;
              e.preventDefault();
              if (!e.repeat) act(() => g.begin());
            }}
            onKeyUp={(e) => {
              if (!easy && [' ', 'Enter'].includes(e.key)) {
                e.preventDefault();
                act(() => g.release());
              }
            }}
            onBlur={() => {
              if (g.holding) act(() => g.cancel());
            }}
            onClick={() => {
              if (easy) scrub();
            }}
          >
            {easy
              ? g.holding
                ? `RELEASE ${STAGE_INFO[stageName].label.toUpperCase()}`
                : `START ${STAGE_INFO[stageName].label.toUpperCase()}`
              : g.holding
                ? 'RELEASE IN SWEET SPOT'
                : `HOLD TO ${STAGE_INFO[stageName].label.toUpperCase()}`}
            <small>
              {easy
                ? 'tap to start · tap to release'
                : 'touch, mouse, Space or Enter'}
            </small>
          </button>
          <label className="db-access">
            <input
              type="checkbox"
              checked={easy}
              onChange={(e) => {
                g.cancel();
                setEasy(e.target.checked);
              }}
            />{' '}
            Two-tap scrubbing (no holding)
          </label>
          <div className="db-enzo">
            <Chin color="#7c878f" belly="#c9d2d7" mood="calm" />
            <div>
              <b>Enzo’s supply corner</b>
              <small>Always happy to lend a paw.</small>
            </div>
          </div>
          <div className="db-supplies">
            <span>
              ✧ Dust <b>{g.dust}/{g.maxDust}</b>
            </span>
            <span>
              ♡ Treats <b>{g.treats}/3</b>
            </span>
          </div>
          <button
            className="db-refill"
            disabled={
              !playing ||
              g.refill > 0 ||
              (g.dust === g.maxDust && g.treats === 3)
            }
            onClick={() => act(() => g.refillSupplies())}
          >
            {g.refill > 0
              ? `Enzo is refilling… ${g.refill.toFixed(1)}s`
              : 'Refill dust & treats'}
          </button>
          <button
            disabled={!playing || !g.treats}
            onClick={() => act(() => g.treat())}
          >
            ♡ Give selected guest a treat
          </button>
          {g.mode === 'cozy' && playing && (
            <button onClick={() => act(() => g.finish())}>
              Close cozy spa & visit shop
            </button>
          )}
        </aside>
      </div>
      <section className="db-shop">
        <div className="db-section-title">
          <h2>
            Little upgrades. <span>Extra happy.</span>
          </h2>
          <small>SHOP BETWEEN SHIFTS · COINS SAVE TO THIS BROWSER</small>
        </div>
        <div className="db-shop-grid">
          {(Object.keys(SHOP) as Upgrade[]).map((key) => (
            <article key={key} className={g.upgrades[key] ? 'owned' : ''}>
              <span className="db-shop-icon">{SHOP[key].icon}</span>
              <div>
                <h3>{SHOP[key].name}</h3>
                <p>{SHOP[key].description}</p>
                <button
                  disabled={
                    !lobby || g.upgrades[key] || g.coins < SHOP[key].cost
                  }
                  onClick={() => act(() => g.buy(key))}
                >
                  {g.upgrades[key]
                    ? '✓ Installed'
                    : `${SHOP[key].cost} coins · Add to spa`}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <footer className="db-footer">
        No water. Just dust, soft paws, and a little kindness.{' '}
        <span>DORA &amp; ENZO · DUST BATH DASH</span>
      </footer>
    </main>
  );
}

function BathCard({
  bath,
  index,
  active,
  playing,
  holding,
  mode,
  reveal,
  match,
  onSeat,
  onTemp,
  onGrain,
}: {
  bath: Bath;
  index: number;
  active: boolean;
  playing: boolean;
  holding: boolean;
  mode: string;
  reveal: boolean;
  match: number;
  onSeat: () => void;
  onTemp: () => void;
  onGrain: () => void;
}) {
  const guest = bath.guest;
  const stage = guest ? STAGES[bath.stage] : 'pour';
  const mood = holding && active ? 'bliss' : guest ? 'happy' : 'calm';
  return (
    <div
      className={`db-bath ${active ? 'active' : ''} ${bath.flash > 0 ? 'puff' : ''} ${bath.perfectFlash > 0 ? 'sparkle' : ''}`}
    >
      <button
        className="db-bath-seat"
        disabled={!playing || holding}
        aria-pressed={active}
        aria-label={`Bath ${index + 1}${guest ? `, ${guest.name} the ${guest.label}, ${STAGE_INFO[stage].label} stage` : ', empty'}`}
        onClick={onSeat}
      >
        <span className="db-bath-number">0{index + 1}</span>
        <div className="db-tub-art">
          {guest ? (
            <Chin
              color={guest.color}
              belly={guest.belly}
              patch={guest.patch}
              vip={guest.vip}
              mood={mood}
            />
          ) : (
            <span className="db-vapor">✧</span>
          )}
          <div className={`db-tub temp-${bath.temp}`}>
            <span>{TEMP_ICON[bath.temp]}</span>
          </div>
          {bath.flash > 0 && <span className="db-dust-cloud">☁</span>}
          {bath.perfectFlash > 0 && <span className="db-sparkles">✦✧✦</span>}
        </div>
        <b>{guest?.name ?? 'Empty bath'}</b>
        <small>
          {guest
            ? `${guest.label}${guest.vip ? ' · VIP' : ''}`
            : active
              ? 'Tap to seat guest'
              : 'Choose a guest first'}
        </small>
        {guest && (
          <small className="db-bath-info">
            {bath.mess ? `${bath.mess} splash · ` : ''}
            {mode === 'cozy' ? 'Relaxed' : `${Math.ceil(guest.patience)}s`} ·
            match {match}/2
          </small>
        )}
      </button>
      {guest && (
        <div className="db-prep" aria-label={`Bath ${index + 1} dust settings`}>
          <button
            disabled={!playing || holding}
            onClick={onTemp}
            aria-label={`Warmth ${bath.temp}${reveal ? `, guest wants ${guest.temp}` : ''}`}
            className={reveal && bath.temp === guest.temp ? 'ok' : ''}
          >
            {TEMP_ICON[bath.temp]} {bath.temp}
          </button>
          <button
            disabled={!playing || holding}
            onClick={onGrain}
            aria-label={`Grain ${bath.grain}${reveal ? `, guest wants ${guest.grain}` : ''}`}
            className={reveal && bath.grain === guest.grain ? 'ok' : ''}
          >
            {GRAIN_ICON[bath.grain]} {bath.grain}
          </button>
        </div>
      )}
    </div>
  );
}

/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. Mount readiness gates SSR controls. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The labeled ARIA meter contains a custom needle and striped sweet-spot region, which native meter cannot render. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { DustBathGame, SHOP, type Upgrade } from '../../lib/dust-bath-game';
import './spa.css';

function Chin({
  color = '#faf7ef',
  happy = false,
}: {
  color?: string;
  happy?: boolean;
}) {
  return (
    <svg className="db-chin" viewBox="0 0 140 120" aria-hidden="true">
      <ellipse cx="72" cy="109" rx="46" ry="7" fill="#443d3620" />
      <path
        d="M106 92 Q139 69 125 61 Q117 57 115 78"
        fill={color}
        stroke="#655d57"
        strokeWidth="3"
      />
      <ellipse
        cx="68"
        cy="80"
        rx="42"
        ry="33"
        fill={color}
        stroke="#655d57"
        strokeWidth="2"
      />
      <ellipse
        cx="41"
        cy="28"
        rx="18"
        ry="25"
        fill={color}
        stroke="#655d57"
        strokeWidth="2"
      />
      <ellipse
        cx="94"
        cy="28"
        rx="18"
        ry="25"
        fill={color}
        stroke="#655d57"
        strokeWidth="2"
      />
      <ellipse cx="41" cy="28" rx="10" ry="17" fill="#edc4be" />
      <ellipse cx="94" cy="28" rx="10" ry="17" fill="#edc4be" />
      <ellipse
        cx="67"
        cy="62"
        rx="38"
        ry="31"
        fill={color}
        stroke="#655d57"
        strokeWidth="2"
      />
      {happy ? (
        <path
          d="M44 59q6-8 12 0m24 0q6-8 12 0"
          fill="none"
          stroke="#393e39"
          strokeWidth="3"
        />
      ) : (
        <g fill="#393e39">
          <circle cx="49" cy="58" r="4" />
          <circle cx="86" cy="58" r="4" />
        </g>
      )}
      <ellipse cx="68" cy="69" rx="5" ry="3" fill="#b67f79" />
      <path
        d="M68 72v5m0 0q-6 5-10 0m10 0q6 5 10 0M33 69l-19-4m20 10-19 3m86-9 20-4m-20 10 20 3"
        fill="none"
        stroke="#655d57"
        strokeWidth="1.5"
      />
      <ellipse cx="48" cy="105" rx="13" ry="5" fill={color} stroke="#655d57" />
      <ellipse cx="87" cy="105" rx="13" ry="5" fill={color} stroke="#655d57" />
    </svg>
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
    refresh();
  };
  useEffect(() => {
    setReady(true);
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
  return (
    <main className={`db-shell ${g.upgrades.decor ? 'db-leafy' : ''}`}>
      <header className="db-nav">
        <a href="/">← MAIN ARCADE</a>
        <span>DORA & ENZO’S LITTLE SPA</span>
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
          <p>Make the world softer, one fluffy customer at a time.</p>
        </div>
        <div className="db-brand">
          <Chin happy />
          <Chin color="#9ca6ad" happy />
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
                ? `${g.served} guests pampered · ${g.perfect} perfect baths · ${g.earned} coins earned · ${g.missed} left early. Spend your coins below, then open again.`
                : 'Dora handles the pampering. Enzo keeps the dust flowing. You bring the gentle touch.'}
            </p>
            <ol>
              <li>
                <b>Choose & seat.</b> Tap a waiting guest, then a bath.
              </li>
              <li>
                <b>Hold & release.</b> Hold SCRUB for about 1.3 seconds. Release
                inside the marked sweet spot to earn coins.
              </li>
              <li>
                <b>Keep it cozy.</b> Too long means a sneeze and neighboring
                splashes! Treats restore patience and soothe mess. Enzo refills
                both supplies.
              </li>
            </ol>
            <p className="db-note">
              Keyboard: Tab to a control, Enter to activate. On SCRUB, hold
              Space or Enter and release. Prefer no holding? Enable two-tap
              scrubbing below. Cozy mode has no timer or impatient guests.
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
          <div className="db-section-title">
            <h2>
              01 <span>The waiting nook</span>
            </h2>
            <small>{g.queue.length} / 4 guests</small>
          </div>
          <div className="db-queue">
            {g.queue.map((c) => (
              <button
                className={`db-guest ${g.selected === c.id ? 'selected' : ''}`}
                key={c.id}
                disabled={!playing}
                aria-pressed={g.selected === c.id}
                aria-label={`Select ${c.name}, guest ${c.id}`}
                onClick={() => act(() => g.select(c.id))}
              >
                <Chin color={c.color} />
                <b>{c.name}</b>
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
            <small>DORA’S STATION</small>
          </div>
          <div className="db-baths">
            {g.baths.map((b, i) => (
              <button
                key={i}
                disabled={!playing || g.holding}
                aria-pressed={g.activeBath === i}
                aria-label={`Bath ${i + 1}${b.guest ? `, ${b.guest.name}` : ', empty'}`}
                className={`db-bath ${g.activeBath === i ? 'active' : ''} ${b.flash > 0 ? 'puff' : ''}`}
                onClick={() => act(() => g.seat(i))}
              >
                <span className="db-bath-number">0{i + 1}</span>
                <div className="db-tub-art">
                  {b.guest ? (
                    <Chin
                      color={b.guest.color}
                      happy={g.holding && g.activeBath === i}
                    />
                  ) : (
                    <span className="db-vapor">✧</span>
                  )}
                  <div className="db-tub">
                    {g.upgrades.towels && <i />}
                    <span>✦</span>
                  </div>
                  {b.flash > 0 && <span className="db-dust-cloud">☁</span>}
                </div>
                <b>{b.guest?.name ?? 'Empty bath'}</b>
                <small>
                  {b.guest
                    ? `${b.mess ? `${b.mess} splash mess · ` : ''}${g.mode === 'cozy' ? 'Ready to relax' : `${Math.ceil(b.guest.patience)}s patience`}`
                    : g.selected
                      ? 'Tap to seat guest'
                      : 'Choose a guest first'}
                </small>
              </button>
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
          <p>
            Working on <b>bath {g.activeBath + 1}</b>
            <br />
            Release when the needle is in the sweet spot.
          </p>
          <div
            className="db-meter"
            role="meter"
            aria-label="Scrub pressure"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(g.charge * 100)}
            aria-valuetext={
              g.charge >= g.low && g.charge <= g.high
                ? 'Sweet spot, release now'
                : `${Math.round(g.charge * 100)} percent`
            }
          >
            <div
              className="db-sweet"
              style={{
                left: `${g.low * 100}%`,
                width: `${(g.high - g.low) * 100}%`,
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
              ? g.charge < g.low
                ? 'Keep going…'
                : g.charge <= g.high
                  ? '✓ Release now!'
                  : 'Too much! Release and try again.'
              : 'Ready for a little fluff?'}
          </p>
          <button
            className="db-scrub"
            disabled={
              !playing ||
              !g.baths[g.activeBath].guest ||
              (!g.dust && !g.holding)
            }
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
                ? 'RELEASE SCRUB'
                : 'START SCRUB'
              : g.holding
                ? 'RELEASE IN SWEET SPOT'
                : 'HOLD TO SCRUB'}
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
            <Chin color="#9ca6ad" />
            <div>
              <b>Enzo’s supply corner</b>
              <small>Always happy to lend a paw.</small>
            </div>
          </div>
          <div className="db-supplies">
            <span>
              ✧ Dust <b>{g.dust}/6</b>
            </span>
            <span>
              ♡ Treats <b>{g.treats}/3</b>
            </span>
          </div>
          <button
            className="db-refill"
            disabled={
              !playing || g.refill > 0 || (g.dust === 6 && g.treats === 3)
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
          <small>SHOP BETWEEN SHIFTS · COINS LAST THIS VISIT</small>
        </div>
        <div className="db-shop-grid">
          {(Object.keys(SHOP) as Upgrade[]).map((key, i) => (
            <article key={key}>
              <span className="db-shop-icon">{['▤', '✧', '❧'][i]}</span>
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
        <span>DORA & ENZO · DUST BATH DASH</span>
      </footer>
    </main>
  );
}

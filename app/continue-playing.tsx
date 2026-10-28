'use client';
// "Continue playing": remembers the last cabinet picked on this device and puts it one tap away.
import { useEffect, useState } from 'react';

type Game = { href: string; title: string; color: string; art: string };
const KEY = 'arcade-last-game-v1';

export default function ContinuePlaying({ games }: { games: Game[] }) {
 const [last, setLast] = useState<Game | null>(null);
 useEffect(() => {
  // localStorage only exists in the browser, so the shortcut appears after mount.
  // Coming back through a game's arcade link also counts, in case the card was tapped before this page woke up.
  const from = (() => { try { return new URL(document.referrer).origin === location.origin ? new URL(document.referrer).pathname : ''; } catch { return ''; } })();
  try {
   if (games.some((g) => g.href === from)) localStorage.setItem(KEY, from);
   setLast(games.find((g) => g.href === localStorage.getItem(KEY)) ?? null);
  } catch {}
  const remember = (e: MouseEvent) => {
   const card = (e.target as Element | null)?.closest?.('a.arcade-card');
   if (card) try { localStorage.setItem(KEY, card.getAttribute('href') ?? ''); } catch {}
  };
  document.addEventListener('click', remember);
  return () => document.removeEventListener('click', remember);
 }, [games]);
 if (!last) return null;
 return <a href={last.href} className="arcade-continue" style={{ '--game-color': last.color } as React.CSSProperties}>
  <span className="arcade-art" aria-hidden="true">{last.art}</span>
  <span><small>CONTINUE PLAYING</small><strong>{last.title}</strong></span>
  <span className="arcade-play">PLAY →</span>
 </a>;
}

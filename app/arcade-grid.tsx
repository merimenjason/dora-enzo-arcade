'use client';
// The arcade's game cards, with a row of genre buttons above them that stays at the top while scrolling. The chosen
// genre goes in the address (?genre=puzzle) so a filtered list can be bookmarked or shared. Cards keep their arcade
// number whatever is showing.
import { useEffect, useState } from 'react';
import { GENRES, GENRE_OF, type GenreId } from './arcade-genres';

type Game = { href: string; title: string; tag: string; blurb: string; color: string; art: string; cover?: string };
type Pick = GenreId | 'all';

export default function ArcadeGrid({ games }: { games: Game[] }) {
 const [pick, setPick] = useState<Pick>('all');
 useEffect(() => {
  const g = new URLSearchParams(location.search).get('genre');
  if (GENRES.some((x) => x.id === g)) setPick(g as GenreId);
 }, []);
 const choose = (p: Pick) => {
  setPick(p);
  const u = new URL(location.href);
  if (p === 'all') u.searchParams.delete('genre'); else u.searchParams.set('genre', p);
  history.replaceState(null, '', u);
 };
 const count = (id: GenreId) => games.filter((g) => GENRE_OF[g.href]?.includes(id)).length;
 return <>
  <div className="arcade-filter" role="group" aria-label="Filter games by genre">
   <button type="button" aria-pressed={pick === 'all'} onClick={() => choose('all')}>All <span>{games.length}</span></button>
   {GENRES.map((g) => <button key={g.id} type="button" data-genre={g.id} aria-pressed={pick === g.id} onClick={() => choose(g.id)}>{g.label} <span>{count(g.id)}</span></button>)}
  </div>
  <nav className="arcade-grid" aria-label="Choose a game">
   {games.map((game, i) => (pick === 'all' || GENRE_OF[game.href]?.includes(pick)) && <a key={game.href} href={game.href} className="arcade-card" style={{ '--game-color': game.color } as React.CSSProperties}>
    <span className="arcade-art" aria-hidden="true">{game.cover ? <img src={game.cover} alt="" loading="lazy" width={72} height={45} style={{objectFit:"cover",borderRadius:4,imageRendering:"pixelated"}}/> : game.art}</span>
    <span className="arcade-number">{String(i + 1).padStart(2, '0')}</span>
    <strong>{game.title}</strong>
    <small>{game.tag}</small>
    <span className="arcade-blurb">{game.blurb}</span>
    <span className="arcade-play">PLAY →</span>
   </a>)}
  </nav>
 </>;
}

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Jade Street · Dora & Enzo’s Arcade',
  description: 'A night-time open-city caper in a harbour quarter. Dora and Enzo walk, dash, hop, ride scooters, trishaws, tuk-tuks, vans and canal boats across five districts to win back five lucky heirlooms from the Magpie Crew: 25 story jobs, chases, tails, races and stealth, raccoon wardens and five lanterns of heat, trading between night markets, side gigs, lucky cats, murals, mini-games, garage upgrades and outfits.',
};
export default function JadeStreetLayout({ children }: { children: React.ReactNode }) { return children; }

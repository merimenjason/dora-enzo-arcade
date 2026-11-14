import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Jade Street · Dora & Enzo’s Arcade',
  description: 'A night-time open-city caper in Singapore’s Chinatown and along the river. Dora and Enzo walk, dash, hop, ride scooters, trishaws, tuk-tuks, vans and bumboats across five districts to win back five lucky heirlooms from the Kaypoh Crows: 25 story jobs, Hawker Tales side jobs, chases, tails, races and stealth, raccoon wardens, fines and five lanterns of heat, a hawker centre and kopi orders, trading between night markets, side gigs, lucky cats, murals, mini-games, garage upgrades and outfits.',
};
export default function JadeStreetLayout({ children }: { children: React.ReactNode }) { return children; }

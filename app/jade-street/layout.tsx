import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Jade Street · Dora & Enzo’s Arcade',
  description: 'A night-time open-city caper in Singapore’s Chinatown and along the river. Dora and Enzo walk, dash, hop, ride scooters, trishaws, tuk-tuks, vans and bumboats across Chinatown, Toa Payoh and Marina Bay to win back five lucky heirlooms from the Kaypoh Crows: six chapters of story jobs, Hawker Tales side jobs, the Jade Line and taxis, chases, tails, races and stealth, raccoon wardens, fines and five lanterns of heat, a hawker centre and kopi orders, trading between night markets, side gigs, lucky cats, murals, mini-games, garage upgrades and outfits.',
};
export default function JadeStreetLayout({ children }: { children: React.ReactNode }) { return children; }

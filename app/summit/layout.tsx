import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Summit Shuffle · Dora & Enzo's Arcade",
  description:
    'A deck-building climb in the style of Slay the Spire: start with ten plain cards, read what every predator will do next, and add a card after each fight. Three stretches of mountain, a branching trail, 48 cards, 30 trinkets and six altitudes. Local saves.',
};
export default function SummitShuffleLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Rulebook FC · Dora & Enzo’s Arcade', description: 'A turn-based football roguelite where you rewrite the laws of the game: the other side’s next moves are always showing, every win lets you write a new law into the rulebook, and every team in the animal league brings a law of its own.' };
export default function RulebookLayout({ children }: { children: React.ReactNode }) { return children; }

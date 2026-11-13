import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Every Creature · Dora & Enzo’s Arcade',
  description: 'Chapter One of a shapeshifting adventure. Dora and Enzo befriend the valley’s animals and become them: a tortoise ferries a frog over the pike’s lake, a bird lifts a beetle to a slick cliff, a shelled tortoise draws the hawk while a fox digs, an otter dives with a frog on its belly, and every pairing returns to free the Storm Heron.',
};
export default function EveryCreatureLayout({ children }: { children: React.ReactNode }) { return children; }

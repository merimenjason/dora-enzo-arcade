import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Poof Panic · Dora & Enzo's Arcade",
  description:
    'A versus falling-pair puzzler in the style of Puyo Puyo: drop pairs of fluff balls, pop four of a colour, and build chains that bury your rival in dust. A ladder of six predator rivals, a hard ladder, free matches, endless solo play and twelve chain lessons. Local saves.',
};
export default function PoofPanicLayout({ children }: { children: React.ReactNode }) {
  return children;
}

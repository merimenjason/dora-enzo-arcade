import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Burrow Express · Dora & Enzo's Arcade",
  description: 'Draw coloured tunnels, run chinchilla carts and keep the warren moving. A guided tutorial, three mountain maps, eight-day shifts and endless transport puzzles. Saves in this browser.',
};
export default function ExpressLayout({ children }: { children: React.ReactNode }) { return children; }

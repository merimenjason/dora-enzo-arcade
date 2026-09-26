import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Chinchilla Clash · Dora & Enzo's Arcade",
  description:
    'A Clash Royale-style card battler: build an eight-card deck, spend bath dust to send chinchilla troops over the river and knock down the rival clans’ towers. Three arenas, local saves.',
};
export default function ChinchillaClashLayout({ children }: { children: React.ReactNode }) {
  return children;
}

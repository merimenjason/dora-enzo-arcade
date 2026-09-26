import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Chinchillas vs Zombies · Dora & Enzo's Arcade",
  description:
    'A Plants vs Zombies-style lane defence: collect sunflower seeds, plant chinchilla defenders on the lawn and stop the zombies before they reach Dora and Enzo’s burrow. Eight nights, local saves.',
};
export default function ChinchillasVsZombiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

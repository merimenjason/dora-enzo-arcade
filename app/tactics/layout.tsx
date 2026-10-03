import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Burrow Tactics · Dora & Enzo's Arcade",
  description:
    'Turn-based tactics in the style of Into the Breach: predators show what they will hit, and Dora, Enzo and friends push them into streams, brambles and each other to protect the burrows. Eighteen missions, then a seeded seven-battle run. Local saves.',
};
export default function BurrowTacticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

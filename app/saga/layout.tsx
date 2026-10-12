import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Whisker Saga · Dora & Enzo's Arcade",
  description:
    'A hero-squad adventure: lead five heroes through eighty stages that fight on their own while you time their skills. Eighteen heroes in three factions to recruit, level, star and equip. Local saves.',
};
export default function SagaLayout({ children }: { children: React.ReactNode }) {
  return children;
}

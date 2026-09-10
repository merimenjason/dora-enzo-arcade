import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Mountain Retreat · Dora & Enzo's Arcade",
  description:
    'A cozy pixel lodge. Dora welcomes guests, Enzo gathers supplies, and together they build a mountain retreat. No accounts, local saves, eight-hour offline cap.',
};
export default function RetreatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
